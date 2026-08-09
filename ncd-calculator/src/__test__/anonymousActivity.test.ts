import {afterEach, describe, expect, test, vi} from "vitest";
import {
    createAnonymousCalculationRun,
    ensureAnonymousSession,
    recordAnonymousCalculationEvent,
    trackAnonymousCalculationEvent,
} from "../services/AnonymousActivity";

afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
});
describe("anonymous activity client", () => {
    test("sends a typed calculation event with credentials and no research content", async () => {
        const fetchMock = vi.fn(async () => new Response(null, {status: 202}));
        vi.stubGlobal("fetch", fetchMock);
        const run = createAnonymousCalculationRun("objects", 4);

        await recordAnonymousCalculationEvent(run, "calculation_started");

        expect(run.runId).toMatch(/^[0-9a-f-]{36}$/);
        expect(fetchMock).toHaveBeenCalledOnce();
        const [url, options] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
        expect(url).toContain("/api/anonymous/events");
        expect(options).toMatchObject({
            method: "POST",
            credentials: "include",
            keepalive: true,
        });
        const body = JSON.parse(String(options.body)) as Record<string, unknown>;
        expect(body).toMatchObject({
            runId: run.runId,
            eventType: "calculation_started",
            inputKind: "objects",
            objectCount: 4,
        });
        expect(body.eventId).toMatch(/^[0-9a-f-]{36}$/);
        expect(Object.keys(body).sort()).toEqual([
            "eventId",
            "eventType",
            "inputKind",
            "objectCount",
            "runId",
        ]);
    });

    test("can bootstrap a future anonymous cloud workspace explicitly", async () => {
        const fetchMock = vi.fn(async () => new Response(null, {status: 201}));
        vi.stubGlobal("fetch", fetchMock);

        await ensureAnonymousSession();

        expect(fetchMock).toHaveBeenCalledWith(
            expect.stringContaining("/api/anonymous/session"),
            expect.objectContaining({method: "POST", credentials: "include"}),
        );
    });

    test("keeps reporting failures out of the calculation control flow", async () => {
        vi.stubGlobal("fetch", vi.fn(async () => new Response(null, {status: 503})));
        const warning = vi.spyOn(console, "warn").mockImplementation(() => undefined);
        const run = createAnonymousCalculationRun("distance-matrix", 8);

        expect(() => trackAnonymousCalculationEvent(run, "calculation_started")).not.toThrow();
        await vi.waitFor(() => expect(warning).toHaveBeenCalledOnce());
    });
});
