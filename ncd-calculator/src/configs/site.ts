export const normalizeBaseUrl = (baseUrl: string): string => {
    const value = baseUrl.trim();

    if (!value || value === "." || value === "./") {
        return "/";
    }

    const pathname = value.startsWith("http://") || value.startsWith("https://")
        ? new URL(value).pathname
        : value;
    const segments = pathname.split("/").filter(Boolean);

    return segments.length === 0 ? "/" : `/${segments.join("/")}/`;
};

export const APP_BASE_URL = normalizeBaseUrl(import.meta.env.BASE_URL);
export const ROUTER_BASENAME = APP_BASE_URL === "/"
    ? "/"
    : APP_BASE_URL.slice(0, -1);
export const AUTH_ENABLED = import.meta.env.VITE_AUTH_ENABLED !== "false";
