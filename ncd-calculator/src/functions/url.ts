export const getUri = (url: string, endpoint: string, params: string | string[][] | Record<string, string> | URLSearchParams | undefined) => {
    const createdUrl = new URL(`${url}/${endpoint}`);
    createdUrl.search = new URLSearchParams(params).toString();
    return createdUrl.toString();
}

export const getUriWithParams = (url: any, params: string | Record<string, string> | URLSearchParams | string[][] | undefined) => {
    const createdUrl = new URL(`${url}`);
    createdUrl.search = new URLSearchParams(params).toString();
    return createdUrl.toString();
}