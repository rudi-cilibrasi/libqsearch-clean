export type CalculationAnalyticsEvent = "calculation_started" | "calculation_completed";
export type CalculationInputKind = "objects" | "distance-matrix";

export interface CalculationAnalyticsContext {
    readonly inputKind: CalculationInputKind;
    readonly objectCount: number;
}

declare global {
    interface Window {
        dataLayer?: unknown[];
        gtag?: (...args: unknown[]) => void;
    }
}

const GOOGLE_TAG_SCRIPT_ID = "complearn-google-analytics";
const MEASUREMENT_ID_PATTERN = /^G-[A-Z0-9]+$/;

let configuredMeasurementId: string | null = null;

const normalizeMeasurementId = (value: string | undefined): string | null => {
    const measurementId = value?.trim().toUpperCase() ?? "";
    return MEASUREMENT_ID_PATTERN.test(measurementId) ? measurementId : null;
};

const ensureGoogleTagQueue = (): ((...args: unknown[]) => void) => {
    window.dataLayer ??= [];
    window.gtag ??= function googleTagQueue(): void {
        window.dataLayer?.push(arguments);
    };
    return window.gtag;
};

/**
 * Loads GA4 only when a valid public measurement ID is configured. Advertising
 * storage and personalization remain disabled; analytics storage is required
 * for GA4's first-party client ID and browser-level user counts.
 */
export const initializeGoogleAnalytics = (
    rawMeasurementId: string | undefined = import.meta.env.VITE_GA_MEASUREMENT_ID,
): boolean => {
    if (typeof window === "undefined" || typeof document === "undefined") return false;

    const measurementId = normalizeMeasurementId(rawMeasurementId);
    if (!measurementId) {
        if (rawMeasurementId?.trim()) console.warn("VITE_GA_MEASUREMENT_ID is not a valid GA4 measurement ID.");
        return false;
    }
    if (configuredMeasurementId === measurementId) return true;
    if (configuredMeasurementId) {
        console.warn("Google Analytics is already configured with a different measurement ID.");
        return false;
    }

    const gtag = ensureGoogleTagQueue();
    configuredMeasurementId = measurementId;

    gtag("consent", "default", {
        ad_storage: "denied",
        ad_user_data: "denied",
        ad_personalization: "denied",
        analytics_storage: "granted",
    });
    gtag("js", new Date());
    gtag("config", measurementId, {
        allow_google_signals: false,
        allow_ad_personalization_signals: false,
        send_page_view: true,
    });

    if (!document.getElementById(GOOGLE_TAG_SCRIPT_ID)) {
        const script = document.createElement("script");
        script.id = GOOGLE_TAG_SCRIPT_ID;
        script.async = true;
        script.src = `https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(measurementId)}`;
        document.head.appendChild(script);
    }

    return true;
};

/**
 * Sends only coarse product-usage fields. Labels, filenames, contents,
 * matrices, hashes, and a custom user ID are deliberately excluded.
 */
export const trackCalculationEvent = (
    event: CalculationAnalyticsEvent,
    context: CalculationAnalyticsContext,
): void => {
    if (typeof window === "undefined" || !configuredMeasurementId || !window.gtag) return;
    if (!Number.isSafeInteger(context.objectCount) || context.objectCount < 1) return;

    window.gtag("event", event, {
        input_kind: context.inputKind,
        object_count: context.objectCount,
        send_to: configuredMeasurementId,
    });
};
