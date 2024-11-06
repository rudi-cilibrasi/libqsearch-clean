export const encodeURIWithApiKey = (uri) => {
    return uri + "&api_key" + import.meta.env.VITE_NCBI_API_KEY;
}