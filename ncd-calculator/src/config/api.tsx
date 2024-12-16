const BACKEND_PORT = 3001; // move to env file later

const protocol = window.location.protocol; // e.g., "https:"
const hostname = window.location.hostname; // e.g., "opendata.com"

let finalUrl = `${protocol}//${hostname}`;

if (hostname === "localhost") {
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
export const VITE_REDIS_ENDPOINT = BACKEND_BASE_URL + "/redis";