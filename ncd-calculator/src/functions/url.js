export const getUri = (url, endpoint, params) => {
    const createdUrl = new URL(`${url}/${endpoint}`);
    createdUrl.search = new URLSearchParams(params);
    return createdUrl.toString();
}

export const getUriWithParams = (url, params) => {
    const createdUrl = new URL(`${url}`);
    createdUrl.search = new URLSearchParams(params);
    return createdUrl.toString();
}