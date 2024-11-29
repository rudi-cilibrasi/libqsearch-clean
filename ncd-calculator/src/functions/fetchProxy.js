import {BACKEND_BASE_URL} from "../config/api.js";
import axios from "axios";
import axiosRetry from 'axios-retry';

const delay = (ms) => new Promise(_ => setTimeout(_, ms));

axiosRetry(axios, {
    retries: 3,
    retryDelay: (retryCount) => {
        const baseDelay = 500; // in ms
        return baseDelay * Math.pow(2, retryCount - 1);
    },
    retryCondition: (error) => {
        return error.response && error.response.status === 429;
    },
});

export const sendRequestToProxy = async (requestBody, requestHeader = {}) => {
    try {
        const waitTime = delay(300);
        const response = axios.post(`${BACKEND_BASE_URL}/external/forward`, requestBody, requestHeader);
        const results = await Promise.all([waitTime, response]);
        return results[1].data;
    } catch (error) {
        console.error('Error in sending request to proxy:', error);
        throw error;
    }
};

export const getApiResponse = async (uri) => {
    try {
        const response = await axios.get(uri);
        return response.data;
    } catch (error) {
        console.error('Error in getApiResponse:', error);
        throw error;
    }
};

export default axios;