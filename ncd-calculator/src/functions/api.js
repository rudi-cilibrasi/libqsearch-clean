export const encodeURIWithApiKey = (uri, apiKey = null) => {
    return encodeURI(uri + getApiKeyRequestParam(apiKey));
}

export const getApiKeyRequestParam = (apiKey) => {
    if (apiKey) {
        return "&api_key" + apiKey;
    }
    return ""
}