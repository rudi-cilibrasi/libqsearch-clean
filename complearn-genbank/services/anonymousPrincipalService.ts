import crypto from "crypto";
import {Op} from "sequelize";
import {v7 as uuidv7} from "uuid";
import {sequelize} from "../configurations/databaseConnection";
import {
    AnonymousCalculationEvent,
    AnonymousCalculationEventType,
    AnonymousCalculationInputKind,
} from "../models/anonymousCalculationEvent";
import {AnonymousActivityDay} from "../models/anonymousActivityDay";
import {AnonymousPrincipal} from "../models/anonymousPrincipal";

export const ANONYMOUS_COOKIE_MAX_AGE_MS = 365 * 24 * 60 * 60 * 1000;
export const ANONYMOUS_COOKIE_RENEWAL_WINDOW_MS = 30 * 24 * 60 * 60 * 1000;
export const ANONYMOUS_COOKIE_NAME = "complearn_anonymous";
export const ANONYMOUS_PRODUCTION_COOKIE_NAME = "__Host-complearn_anonymous";

const RAW_CREDENTIAL_PATTERN = /^[A-Za-z0-9_-]{43}$/;

export interface EnsuredAnonymousPrincipal {
    principal: AnonymousPrincipal;
    created: boolean;
    rawCredential?: string;
}

export interface RecordAnonymousCalculationEventInput {
    eventId: string;
    runId: string;
    eventType: AnonymousCalculationEventType;
    inputKind: AnonymousCalculationInputKind;
    objectCount: number;
}

export interface AnonymousUsageSummary {
    semantics: "anonymous-browser-installations";
    generatedAt: string;
    windowStart: string;
    totals: {
        issuedInstallations: number;
        activatedInstallations: number;
        completedInstallations: number;
        calculationStarts: number;
        calculationCompletions: number;
    };
    last30Days: {
        activeInstallations: number;
    };
}

export class AnonymousEventConflictError extends Error {
    public constructor() {
        super("The event identifier is already associated with different calculation data");
        this.name = "AnonymousEventConflictError";
    }
}

export const getAnonymousCookieName = (isProduction: boolean): string => (
    isProduction ? ANONYMOUS_PRODUCTION_COOKIE_NAME : ANONYMOUS_COOKIE_NAME
);

export const hashAnonymousCredential = (rawCredential: string): string => (
    crypto.createHash("sha256").update(rawCredential, "utf8").digest("hex")
);

export const readCookieValue = (cookieHeader: string | undefined, cookieName: string): string | null => {
    if (!cookieHeader) return null;

    for (const segment of cookieHeader.split(";")) {
        const separatorIndex = segment.indexOf("=");
        if (separatorIndex < 1) continue;
        const name = segment.slice(0, separatorIndex).trim();
        if (name !== cookieName) continue;
        const value = segment.slice(separatorIndex + 1).trim();
        return RAW_CREDENTIAL_PATTERN.test(value) ? value : null;
    }
    return null;
};

const createAnonymousPrincipal = async (now: Date): Promise<EnsuredAnonymousPrincipal> => {
    const rawCredential = crypto.randomBytes(32).toString("base64url");
    const principal = await AnonymousPrincipal.create({
        id: uuidv7(),
        credentialHash: hashAnonymousCredential(rawCredential),
        credentialExpiresAt: new Date(now.getTime() + ANONYMOUS_COOKIE_MAX_AGE_MS),
        activatedAt: null,
        firstCompletedAt: null,
        lastSeenAt: now,
    });

    return {principal, created: true, rawCredential};
};

export const ensureAnonymousPrincipal = async (
    cookieHeader: string | undefined,
    cookieName: string,
    now = new Date(),
): Promise<EnsuredAnonymousPrincipal> => {
    const rawCredential = readCookieValue(cookieHeader, cookieName);
    if (!rawCredential) return createAnonymousPrincipal(now);

    const principal = await AnonymousPrincipal.findOne({
        where: {
            credentialHash: hashAnonymousCredential(rawCredential),
            credentialExpiresAt: {[Op.gt]: now},
        },
    });
    if (!principal) return createAnonymousPrincipal(now);

    const startOfUtcDay = new Date(Date.UTC(
        now.getUTCFullYear(),
        now.getUTCMonth(),
        now.getUTCDate(),
    ));
    const updates: {lastSeenAt?: Date; credentialExpiresAt?: Date} = {};
    if (principal.lastSeenAt < startOfUtcDay) updates.lastSeenAt = now;
    if (
        principal.credentialExpiresAt
        && principal.credentialExpiresAt.getTime() <= now.getTime() + ANONYMOUS_COOKIE_RENEWAL_WINDOW_MS
    ) {
        updates.credentialExpiresAt = new Date(now.getTime() + ANONYMOUS_COOKIE_MAX_AGE_MS);
    }
    if (Object.keys(updates).length > 0) await principal.update(updates);
    return {
        principal,
        created: false,
        rawCredential: updates.credentialExpiresAt ? rawCredential : undefined,
    };
};

const eventMatches = (
    event: AnonymousCalculationEvent,
    principalId: string,
    input: RecordAnonymousCalculationEventInput,
): boolean => (
    event.principalId === principalId
    && event.runId === input.runId
    && event.eventType === input.eventType
    && event.inputKind === input.inputKind
    && event.objectCount === input.objectCount
);

export const recordAnonymousCalculationEvent = async (
    principal: AnonymousPrincipal,
    input: RecordAnonymousCalculationEventInput,
    now = new Date(),
): Promise<{recorded: boolean}> => sequelize.transaction(async transaction => {
    const eventWithSameId = await AnonymousCalculationEvent.findByPk(input.eventId, {transaction});
    if (eventWithSameId) {
        if (!eventMatches(eventWithSameId, principal.id, input)) throw new AnonymousEventConflictError();
        return {recorded: false};
    }

    const [event, created] = await AnonymousCalculationEvent.findOrCreate({
        where: {
            principalId: principal.id,
            runId: input.runId,
            eventType: input.eventType,
        },
        defaults: {
            id: input.eventId,
            principalId: principal.id,
            runId: input.runId,
            eventType: input.eventType,
            inputKind: input.inputKind,
            objectCount: input.objectCount,
            occurredAt: now,
        },
        transaction,
    });
    if (!created) {
        if (!eventMatches(event, principal.id, input)) throw new AnonymousEventConflictError();
        return {recorded: false};
    }

    const activityDate = now.toISOString().slice(0, 10);
    const [activityDay] = await AnonymousActivityDay.findOrCreate({
        where: {principalId: principal.id, activityDate},
        defaults: {
            principalId: principal.id,
            activityDate,
            calculationStartedCount: 0,
            calculationCompletedCount: 0,
        },
        transaction,
    });
    const countField = input.eventType === "calculation_started"
        ? "calculationStartedCount"
        : "calculationCompletedCount";
    await activityDay.increment(countField, {by: 1, transaction});

    await AnonymousPrincipal.update(
        {lastSeenAt: now},
        {where: {id: principal.id}, transaction},
    );
    await AnonymousPrincipal.update(
        {activatedAt: now},
        {where: {id: principal.id, activatedAt: null}, transaction},
    );
    if (input.eventType === "calculation_completed") {
        await AnonymousPrincipal.update(
            {firstCompletedAt: now},
            {where: {id: principal.id, firstCompletedAt: null}, transaction},
        );
    }

    return {recorded: true};
});

const utcDateStringDaysAgo = (now: Date, daysAgo: number): string => {
    const date = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
    date.setUTCDate(date.getUTCDate() - daysAgo);
    return date.toISOString().slice(0, 10);
};

export const getAnonymousUsageSummary = async (now = new Date()): Promise<AnonymousUsageSummary> => {
    const windowStart = utcDateStringDaysAgo(now, 29);
    const [
        issuedInstallations,
        activatedInstallations,
        completedInstallations,
        calculationStarts,
        calculationCompletions,
        activeInstallations,
    ] = await Promise.all([
        AnonymousPrincipal.count(),
        AnonymousPrincipal.count({where: {activatedAt: {[Op.not]: null}}}),
        AnonymousPrincipal.count({where: {firstCompletedAt: {[Op.not]: null}}}),
        AnonymousActivityDay.sum("calculationStartedCount"),
        AnonymousActivityDay.sum("calculationCompletedCount"),
        AnonymousActivityDay.count({
            distinct: true,
            col: "principalId",
            where: {activityDate: {[Op.gte]: windowStart}},
        }),
    ]);

    return {
        semantics: "anonymous-browser-installations",
        generatedAt: now.toISOString(),
        windowStart,
        totals: {
            issuedInstallations,
            activatedInstallations,
            completedInstallations,
            calculationStarts: Number(calculationStarts ?? 0),
            calculationCompletions: Number(calculationCompletions ?? 0),
        },
        last30Days: {activeInstallations},
    };
};
