import {BACKEND_BASE_URL} from "../config/api.js";
import axios from "axios";

// export const sendRequestToProxy = async (requestInfo) => {
//     try {
//         const response = await fetch(`${BACKEND_BASE_URL}/external/forward`, {
//             method: 'POST',
//             headers: {
//                 'Content-Type': 'application/json',
//             },
//             body: JSON.stringify(requestInfo),
//         });
//
//         return await response;
//     } catch (error) {
//         console.error('Error in sending request to proxy:', error);
//         throw error;
//     }
// };

export const sendRequestToProxy = async (requestBody, requestHeader = {}) => {
    try {
        const response = await axios.post(`${BACKEND_BASE_URL}/external/forward`, requestBody, requestHeader);
        return await response.data;
    } catch (error) {
        console.error('Error in sending request to proxy:', error);
        throw error;
    }
};

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
            console.log(error);
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

