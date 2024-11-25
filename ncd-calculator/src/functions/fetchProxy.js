import axios from "axios";

export const getApiResponseText = async (url, params) => {
    const response = await axios.get(url, {params: params});
    if (!response.data) {
        throw new Error("Network response was not ok");
    }
    return await response.data;
}


export const sendRequestToProxy = async (proxy = "http://localhost:3001/api/ncbi/forward", uriToForward) => {
    const params = {
       uri: uriToForward
    }
    return await fetchWithRetry(getApiResponseText, proxy, params);
}


const retries = 5;
const delayMs = 1000;

const delay = (ms) => {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function fetchWithRetry(func, ...params) {
    for (let i = 0; i < retries; i++) {
        let response;
        try {
            if (params.length === 1) {
                response = await func(params[0]);
            } else {
                response = await func(params[0], params[1]);
            }
            if (response && response.length !== 0) {
                return response;
            } else {
                if (i < retries - 1) {
                    console.log(`Attempt ${i + 1} failed. Retrying in 1 seconds...`);
                    await delay(delayMs);
                } else {
                    console.log('All retries failed.');
                    return null;
                }
            }
        } catch (error) {
            if (i < retries - 1) {
                console.log(`Attempt ${i + 1} failed. Retrying in 1 seconds...`);
                await delay(delayMs);
            } else {
                console.log('All retries failed.');
                return null;
            }
        }
    }
}

