import {afterEach, beforeEach, describe, expect, test, vi} from "vitest";

const loadAnalytics = async () => import("@/services/GoogleAnalytics");

const readDataLayer = (): unknown[][] => (
    (window.dataLayer ?? []).map(entry => Array.from(entry as ArrayLike<unknown>))
);

beforeEach(() => {
    vi.resetModules();
    delete window.dataLayer;
    delete window.gtag;
    document.getElementById("complearn-google-analytics")?.remove();
});

afterEach(() => {
    vi.restoreAllMocks();
});

describe("Google Analytics usage measurement", () => {
    test("does nothing when the GA4 measurement ID is absent or invalid", async () => {
        const {initializeGoogleAnalytics} = await loadAnalytics();
        const warning = vi.spyOn(console, "warn").mockImplementation(() => undefined);

        expect(initializeGoogleAnalytics(undefined)).toBe(false);
        expect(initializeGoogleAnalytics("UA-legacy-id")).toBe(false);
        expect(document.getElementById("complearn-google-analytics")).toBeNull();
        expect(window.gtag).toBeUndefined();
        expect(warning).toHaveBeenCalledOnce();
    });

    test("loads one Google tag with analytics-only consent and privacy controls", async () => {
        const {initializeGoogleAnalytics} = await loadAnalytics();

        expect(initializeGoogleAnalytics(" g-test123 ")).toBe(true);
        expect(initializeGoogleAnalytics("G-TEST123")).toBe(true);

        const scripts = document.querySelectorAll("#complearn-google-analytics");
        expect(scripts).toHaveLength(1);
        expect((scripts[0] as HTMLScriptElement).src).toBe(
            "https://www.googletagmanager.com/gtag/js?id=G-TEST123",
        );
        expect(readDataLayer()).toEqual([
            ["consent", "default", {
                ad_storage: "denied",
                ad_user_data: "denied",
                ad_personalization: "denied",
                analytics_storage: "granted",
            }],
            ["js", expect.any(Date)],
            ["config", "G-TEST123", {
                allow_google_signals: false,
                allow_ad_personalization_signals: false,
                send_page_view: true,
            }],
        ]);
    });

    test("sends only coarse calculation fields to the configured stream", async () => {
        const {initializeGoogleAnalytics, trackCalculationEvent} = await loadAnalytics();
        initializeGoogleAnalytics("G-TEST123");

        trackCalculationEvent("calculation_started", {
            inputKind: "objects",
            objectCount: 12,
        });
        trackCalculationEvent("calculation_completed", {
            inputKind: "distance-matrix",
            objectCount: 8,
        });

        expect(readDataLayer().slice(-2)).toEqual([
            ["event", "calculation_started", {
                input_kind: "objects",
                object_count: 12,
                send_to: "G-TEST123",
            }],
            ["event", "calculation_completed", {
                input_kind: "distance-matrix",
                object_count: 8,
                send_to: "G-TEST123",
            }],
        ]);
    });
});
