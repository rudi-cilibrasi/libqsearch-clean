import crypto from "crypto";
import http from "http";
import {AddressInfo} from "net";
import express from "express";
import {sequelize} from "../configurations/databaseConnection";
import {AnonymousActivityDay} from "../models/anonymousActivityDay";
import {AnonymousCalculationEvent} from "../models/anonymousCalculationEvent";
import {AnonymousPrincipal} from "../models/anonymousPrincipal";
import {createAnonymousRouter} from "../routes/anonymous";
import {
    ANONYMOUS_COOKIE_NAME,
    hashAnonymousCredential,
} from "../services/anonymousPrincipalService";

jest.mock("../configurations/logger", () => ({
    __esModule: true,
    default: {
        info: jest.fn(),
        warn: jest.fn(),
        error: jest.fn(),
    },
}));

const METRICS_TOKEN = "test-metrics-token-with-at-least-32-characters";

let server: http.Server;
let baseUrl: string;

const postJson = async (
    path: string,
    body: object | undefined,
    headers: Record<string, string> = {},
): Promise<Response> => fetch(`${baseUrl}${path}`, {
    method: "POST",
    headers: {
        ...(body ? {"Content-Type": "application/json"} : {}),
        ...headers,
    },
    body: body ? JSON.stringify(body) : undefined,
});

const extractCookiePair = (response: Response): string => {
    const setCookie = response.headers.get("set-cookie");
    if (!setCookie) throw new Error("Expected the response to set an anonymous credential cookie");
    return setCookie.split(";", 1)[0];
};

beforeAll(async () => {
    const testApp = express();
    testApp.use(express.json());
    testApp.use("/api/anonymous", createAnonymousRouter({
        isProduction: false,
        metricsToken: METRICS_TOKEN,
    }));
    server = http.createServer(testApp);
    await new Promise<void>((resolve, reject) => {
        server.once("error", reject);
        server.listen(0, "127.0.0.1", () => resolve());
    });
    const address = server.address() as AddressInfo;
    baseUrl = `http://127.0.0.1:${address.port}`;
});

beforeEach(async () => {
    await sequelize.sync({force: true});
});

afterAll(async () => {
    await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
    await sequelize.close();
});

describe("anonymous principal API", () => {
    test("issues an opaque credential and reuses the same principal", async () => {
        const firstResponse = await postJson("/api/anonymous/session", undefined);
        expect(firstResponse.status).toBe(201);
        expect(await firstResponse.json()).toEqual({ready: true, created: true});
        const setCookie = firstResponse.headers.get("set-cookie") ?? "";
        expect(setCookie).toContain(`${ANONYMOUS_COOKIE_NAME}=`);
        expect(setCookie).toContain("HttpOnly");
        expect(setCookie).toContain("SameSite=Lax");
        expect(setCookie).toContain("Path=/");

        const cookiePair = extractCookiePair(firstResponse);
        const rawCredential = cookiePair.slice(cookiePair.indexOf("=") + 1);
        const storedPrincipal = await AnonymousPrincipal.findOne();
        expect(storedPrincipal).not.toBeNull();
        expect(storedPrincipal?.credentialHash).toBe(hashAnonymousCredential(rawCredential));
        expect(storedPrincipal?.credentialHash).not.toContain(rawCredential);

        const repeatedResponse = await postJson(
            "/api/anonymous/session",
            undefined,
            {Cookie: cookiePair},
        );
        expect(repeatedResponse.status).toBe(200);
        expect(await repeatedResponse.json()).toEqual({ready: true, created: false});
        expect(repeatedResponse.headers.get("set-cookie")).toBeNull();
        expect(await AnonymousPrincipal.count()).toBe(1);

        await storedPrincipal?.update({credentialExpiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000)});
        const renewalResponse = await postJson(
            "/api/anonymous/session",
            undefined,
            {Cookie: cookiePair},
        );
        expect(renewalResponse.status).toBe(200);
        expect(renewalResponse.headers.get("set-cookie")).toContain(`${ANONYMOUS_COOKIE_NAME}=`);
        expect(await AnonymousPrincipal.count()).toBe(1);
    });

    test("records idempotent start and completion activity without accepting arbitrary metadata", async () => {
        const runId = crypto.randomUUID();
        const startedEvent = {
            eventId: crypto.randomUUID(),
            runId,
            eventType: "calculation_started",
            inputKind: "objects",
            objectCount: 4,
        };
        const startedResponse = await postJson("/api/anonymous/events", startedEvent);
        expect(startedResponse.status).toBe(202);
        expect(await startedResponse.json()).toEqual({accepted: true, duplicate: false});
        const cookiePair = extractCookiePair(startedResponse);

        const duplicateResponse = await postJson(
            "/api/anonymous/events",
            startedEvent,
            {Cookie: cookiePair},
        );
        expect(duplicateResponse.status).toBe(200);
        expect(await duplicateResponse.json()).toEqual({accepted: true, duplicate: true});

        const conflictingResponse = await postJson(
            "/api/anonymous/events",
            {...startedEvent, objectCount: 5},
            {Cookie: cookiePair},
        );
        expect(conflictingResponse.status).toBe(409);

        const completedResponse = await postJson(
            "/api/anonymous/events",
            {
                ...startedEvent,
                eventId: crypto.randomUUID(),
                eventType: "calculation_completed",
            },
            {Cookie: cookiePair},
        );
        expect(completedResponse.status).toBe(202);

        const principal = await AnonymousPrincipal.findOne();
        const activityDay = await AnonymousActivityDay.findOne();
        expect(principal?.activatedAt).toBeInstanceOf(Date);
        expect(principal?.firstCompletedAt).toBeInstanceOf(Date);
        expect(activityDay?.calculationStartedCount).toBe(1);
        expect(activityDay?.calculationCompletedCount).toBe(1);
        expect(await AnonymousCalculationEvent.count()).toBe(2);

        const rejectedResponse = await postJson("/api/anonymous/events", {
            ...startedEvent,
            eventId: crypto.randomUUID(),
            contents: "research data must never enter anonymous telemetry",
        });
        expect(rejectedResponse.status).toBe(400);
        expect(await AnonymousPrincipal.count()).toBe(1);
    });

    test("reports installation semantics through a bearer-protected aggregate endpoint", async () => {
        const runId = crypto.randomUUID();
        const startResponse = await postJson("/api/anonymous/events", {
            eventId: crypto.randomUUID(),
            runId,
            eventType: "calculation_started",
            inputKind: "distance-matrix",
            objectCount: 8,
        });
        const cookiePair = extractCookiePair(startResponse);
        await postJson("/api/anonymous/events", {
            eventId: crypto.randomUUID(),
            runId,
            eventType: "calculation_completed",
            inputKind: "distance-matrix",
            objectCount: 8,
        }, {Cookie: cookiePair});

        const unauthorized = await fetch(`${baseUrl}/api/anonymous/metrics`);
        expect(unauthorized.status).toBe(401);

        const response = await fetch(`${baseUrl}/api/anonymous/metrics`, {
            headers: {Authorization: `Bearer ${METRICS_TOKEN}`},
        });
        expect(response.status).toBe(200);
        expect(await response.json()).toMatchObject({
            semantics: "anonymous-browser-installations",
            totals: {
                issuedInstallations: 1,
                activatedInstallations: 1,
                completedInstallations: 1,
                calculationStarts: 1,
                calculationCompletions: 1,
            },
            last30Days: {activeInstallations: 1},
        });
    });

    test("rejects explicit cross-site writes before creating a principal", async () => {
        const response = await postJson(
            "/api/anonymous/session",
            undefined,
            {"Sec-Fetch-Site": "cross-site"},
        );
        expect(response.status).toBe(403);
        expect(await AnonymousPrincipal.count()).toBe(0);
    });

    test("uses a host-only secure cookie in production", async () => {
        const productionApp = express();
        productionApp.use(express.json());
        productionApp.use("/api/anonymous", createAnonymousRouter({
            isProduction: true,
            metricsToken: METRICS_TOKEN,
        }));
        const productionServer = http.createServer(productionApp);
        await new Promise<void>((resolve, reject) => {
            productionServer.once("error", reject);
            productionServer.listen(0, "127.0.0.1", () => resolve());
        });
        try {
            const address = productionServer.address() as AddressInfo;
            const response = await fetch(`http://127.0.0.1:${address.port}/api/anonymous/session`, {method: "POST"});
            const setCookie = response.headers.get("set-cookie") ?? "";
            expect(setCookie).toContain("__Host-complearn_anonymous=");
            expect(setCookie).toContain("Secure");
            expect(setCookie).toContain("HttpOnly");
            expect(setCookie).not.toContain("Domain=");
        } finally {
            await new Promise<void>((resolve, reject) => (
                productionServer.close(error => error ? reject(error) : resolve())
            ));
        }
    });
});
