import crypto from "crypto";
import {Request, Response, Router} from "express";
import {validate as validateUuid} from "uuid";
import ENV_LOADER from "../configurations/envLoader";
import logger from "../configurations/logger";
import {
    AnonymousEventConflictError,
    ANONYMOUS_COOKIE_MAX_AGE_MS,
    ensureAnonymousPrincipal,
    getAnonymousCookieName,
    getAnonymousUsageSummary,
    recordAnonymousCalculationEvent,
    RecordAnonymousCalculationEventInput,
} from "../services/anonymousPrincipalService";

const EVENT_BODY_FIELDS = new Set(["eventId", "runId", "eventType", "inputKind", "objectCount"]);

const configuredFrontendOrigin = (() => {
    if (!ENV_LOADER.FRONTEND_BASE_URL) return "";
    try {
        return new URL(ENV_LOADER.FRONTEND_BASE_URL).origin;
    } catch {
        return ENV_LOADER.FRONTEND_BASE_URL;
    }
})();

interface AnonymousRouterOptions {
    isProduction?: boolean;
    metricsToken?: string;
}

const setCredentialCookie = (
    response: Response,
    cookieName: string,
    rawCredential: string,
    isProduction: boolean,
): void => {
    response.cookie(cookieName, rawCredential, {
        httpOnly: true,
        secure: isProduction,
        sameSite: "lax",
        path: "/",
        maxAge: ANONYMOUS_COOKIE_MAX_AGE_MS,
    });
};

const rejectCrossSiteWrite = (request: Request, response: Response): boolean => {
    if (request.get("Sec-Fetch-Site") === "cross-site") {
        response.status(403).json({error: "Cross-site requests are not allowed"});
        return true;
    }
    const origin = request.get("Origin");
    if (origin && configuredFrontendOrigin && origin !== configuredFrontendOrigin) {
        response.status(403).json({error: "Request origin is not allowed"});
        return true;
    }
    return false;
};

const parseEventBody = (body: unknown): RecordAnonymousCalculationEventInput | null => {
    if (!body || typeof body !== "object" || Array.isArray(body)) return null;
    const input = body as Record<string, unknown>;
    if (Object.keys(input).some(field => !EVENT_BODY_FIELDS.has(field))) return null;
    if (Object.keys(input).length !== EVENT_BODY_FIELDS.size) return null;
    if (typeof input.eventId !== "string" || !validateUuid(input.eventId)) return null;
    if (typeof input.runId !== "string" || !validateUuid(input.runId)) return null;
    if (input.eventType !== "calculation_started" && input.eventType !== "calculation_completed") return null;
    if (input.inputKind !== "objects" && input.inputKind !== "distance-matrix") return null;
    if (!Number.isSafeInteger(input.objectCount) || Number(input.objectCount) < 4 || Number(input.objectCount) > 10_000) {
        return null;
    }
    return {
        eventId: input.eventId,
        runId: input.runId,
        eventType: input.eventType,
        inputKind: input.inputKind,
        objectCount: Number(input.objectCount),
    };
};

export const isMetricsRequestAuthorized = (authorization: string | undefined, expectedToken: string): boolean => {
    const expected = Buffer.from(expectedToken, "utf8");
    if (expected.length < 32 || !authorization?.startsWith("Bearer ")) return false;
    const suppliedToken = authorization.slice("Bearer ".length);
    const supplied = Buffer.from(suppliedToken, "utf8");
    return supplied.length === expected.length && crypto.timingSafeEqual(supplied, expected);
};

export const createAnonymousRouter = (options: AnonymousRouterOptions = {}): Router => {
    const router = Router();
    const isProduction = options.isProduction ?? ENV_LOADER.NODE_ENV === "production";
    const cookieName = getAnonymousCookieName(isProduction);
    const metricsToken = options.metricsToken ?? ENV_LOADER.ANONYMOUS_METRICS_TOKEN;

    router.post("/session", async (request: Request, response: Response) => {
        if (rejectCrossSiteWrite(request, response)) return;
        try {
            const ensured = await ensureAnonymousPrincipal(request.headers.cookie, cookieName);
            if (ensured.rawCredential) {
                setCredentialCookie(response, cookieName, ensured.rawCredential, isProduction);
            }
            response.setHeader("Cache-Control", "no-store");
            response.status(ensured.created ? 201 : 200).json({ready: true, created: ensured.created});
        } catch (error) {
            logger.error({requestId: request.requestId, message: "Unable to create anonymous session", error});
            response.status(503).json({error: "Anonymous session is temporarily unavailable"});
        }
    });

    router.post("/events", async (request: Request, response: Response) => {
        if (rejectCrossSiteWrite(request, response)) return;
        const event = parseEventBody(request.body);
        if (!event) {
            response.status(400).json({error: "Invalid anonymous calculation event"});
            return;
        }
        try {
            const ensured = await ensureAnonymousPrincipal(request.headers.cookie, cookieName);
            if (ensured.rawCredential) {
                setCredentialCookie(response, cookieName, ensured.rawCredential, isProduction);
            }
            const result = await recordAnonymousCalculationEvent(ensured.principal, event);
            response.setHeader("Cache-Control", "no-store");
            response.status(result.recorded ? 202 : 200).json({accepted: true, duplicate: !result.recorded});
        } catch (error) {
            if (error instanceof AnonymousEventConflictError) {
                response.status(409).json({error: error.message});
                return;
            }
            logger.error({requestId: request.requestId, message: "Unable to record anonymous activity", error});
            response.status(503).json({error: "Anonymous activity is temporarily unavailable"});
        }
    });

    router.get("/metrics", async (request: Request, response: Response) => {
        if (!isMetricsRequestAuthorized(request.get("Authorization"), metricsToken)) {
            response.status(metricsToken ? 401 : 404).json({error: "Not found"});
            return;
        }
        try {
            response.setHeader("Cache-Control", "no-store");
            response.json(await getAnonymousUsageSummary());
        } catch (error) {
            logger.error({requestId: request.requestId, message: "Unable to read anonymous metrics", error});
            response.status(503).json({error: "Anonymous metrics are temporarily unavailable"});
        }
    });

    return router;
};

export default createAnonymousRouter();
