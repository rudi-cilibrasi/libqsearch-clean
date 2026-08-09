const BACKEND_PORT = 3001; // move to env file later

const protocol = window.location.protocol; // e.g., "https:"
const hostname = window.location.hostname; // e.g., "opendata.com"
const configuredBaseUrl = import.meta.env.VITE_BACKEND_BASE_URL?.trim().replace(/\/+$/, "");

let finalUrl = configuredBaseUrl || `${protocol}//${hostname}`;

if (configuredBaseUrl) {
    // Use the explicitly configured API when the frontend and backend have different hosts.
} else if (hostname === "localhost") {
    finalUrl += `:${BACKEND_PORT}/api`
} else if (hostname === "www.staging.openscienceresearchpark.com") {
    finalUrl += `/shawn_api`
} else if (hostname === "complearn.staging.openscienceresearchpark.com") {
    finalUrl += `/nam_api`
} else {
    // prod environment http://openscienceresearchpark.com/api
    finalUrl += `/api`
}

console.log("api.tsx finalUrl", finalUrl);
export const BACKEND_BASE_URL = finalUrl;
