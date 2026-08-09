import {BACKEND_BASE_URL} from "@/configs/api";

export type AnonymousCalculationInputKind = "objects" | "distance-matrix";
export type AnonymousCalculationEventType = "calculation_started" | "calculation_completed";

export interface AnonymousCalculationRun {
    readonly runId: string;
    readonly inputKind: AnonymousCalculationInputKind;
    readonly objectCount: number;
}

interface AnonymousCalculationEvent extends AnonymousCalculationRun {
    readonly eventId: string;
    readonly eventType: AnonymousCalculationEventType;
}

const anonymousApiUrl = (path: string): string => `${BACKEND_BASE_URL}/anonymous/${path}`;

export const createAnonymousCalculationRun = (
    inputKind: AnonymousCalculationInputKind,
    objectCount: number,
): AnonymousCalculationRun => ({
    runId: globalThis.crypto.randomUUID(),
    inputKind,
    objectCount,
});

const sendJson = async (path: string, body?: object): Promise<Response> => fetch(anonymousApiUrl(path), {
    method: "POST",
    credentials: "include",
    keepalive: true,
    headers: body ? {"Content-Type": "application/json"} : undefined,
    body: body ? JSON.stringify(body) : undefined,
});

/**
 * Creates or resumes the first-party anonymous principal without exposing its
 * opaque HttpOnly credential to JavaScript. Future cloud-save calls can use
 * this before creating a principal-owned workspace.
 */
export const ensureAnonymousSession = async (): Promise<void> => {
    const response = await sendJson("session");
    if (!response.ok) throw new Error(`Anonymous session request failed with status ${response.status}`);
};
export const recordAnonymousCalculationEvent = async (
    run: AnonymousCalculationRun,
    eventType: AnonymousCalculationEventType,
): Promise<void> => {
    const event: AnonymousCalculationEvent = {
        ...run,
        eventId: globalThis.crypto.randomUUID(),
        eventType,
    };
    const response = await sendJson("events", event);
    if (!response.ok) throw new Error(`Anonymous activity request failed with status ${response.status}`);
};

/**
 * Anonymous usage reporting must never make a local scientific calculation
 * fail. The backend remains authoritative for validation and deduplication.
 */
export const trackAnonymousCalculationEvent = (
    run: AnonymousCalculationRun,
    eventType: AnonymousCalculationEventType,
): void => {
    void recordAnonymousCalculationEvent(run, eventType).catch(() => {
        console.warn("Anonymous usage activity could not be recorded.");
    });
};
