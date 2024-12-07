export const encodeURIWithApiKey = (uri: string, apiKey: string | null = null): string => {
    return encodeURI(uri + getApiKeyRequestParam(apiKey));
}

export const getApiKeyRequestParam = (apiKey: string | null): string => {
    if (apiKey) {
        return "&api_key" + apiKey;
    }
    return "";
}