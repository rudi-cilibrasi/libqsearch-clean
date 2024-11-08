export const encodeURIWithApiKey = (uri, apiKey = null) => {
    if (apiKey) {
        uri += "&api_key" + apiKey;
    }
    return encodeURI(uri);
}