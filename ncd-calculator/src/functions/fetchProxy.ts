import { BACKEND_BASE_URL } from "@/configs/api.js";
import axios, { AxiosError } from "axios";
import axiosRetry from "axios-retry";

const delay = (ms: number) => new Promise((_) => setTimeout(_, ms));

axiosRetry(axios, {
  retries: 3,
  retryDelay: (retryCount) => {
    const baseDelay = 500; // in ms
    return baseDelay * Math.pow(2, retryCount - 1) + Math.random() * 500;
  },
  retryCondition: (error: AxiosError): boolean => {
    return !!error.response && error.response.status === 429;
  },
});

interface ProxyRequestBody {
  [key: string]: any;
}

interface ProxyRequestHeader {
  [key: string]: string;
}

export const sendRequestToProxy = async (
  requestBody: ProxyRequestBody,
  requestHeader: ProxyRequestHeader = {}
): Promise<any> => {
  try {
    const waitTime = delay(300);
    const response = axios.post(
      `${BACKEND_BASE_URL}/external/forward`,
      requestBody,
      requestHeader
    );
    const results = await Promise.all([waitTime, response]);
    return results[1].data;
  } catch (error) {
    console.error("Error in sending request to proxy:", error);
    throw error;
  }
};

export interface ApiResponse {
  [key: string]: any;
}

export const getApiResponse = async (uri: string): Promise<ApiResponse> => {
  try {
    const response = await axios.get(uri);
    return response.data;
  } catch (error) {
    console.error("Error in getApiResponse:", error);
    throw error;
  }
};

export default axios;
