import { BACKEND_BASE_URL } from "@/configs/api.js";
import axios, {type AxiosRequestConfig} from "axios";

interface ProxyRequestBody {
  readonly externalUrl: string;
}

export const sendRequestToProxy = async (
  requestBody: ProxyRequestBody,
  requestConfig: AxiosRequestConfig = {},
): Promise<any> => {
  try {
    const response = await axios.post(
      `${BACKEND_BASE_URL}/external/forward`,
      requestBody,
      requestConfig,
    );
    return response.data;
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
