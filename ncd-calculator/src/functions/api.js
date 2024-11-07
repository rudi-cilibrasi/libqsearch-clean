export const encodeURIWithApiKey = (uri) => {
    if (import.meta.env.VITE_NCBI_API_KEY) {
        return encodeURI(uri + "&api_key" + import.meta.env.VITE_NCBI_API_KEY);
    } else {
        return encodeURI(uri);
    }
}