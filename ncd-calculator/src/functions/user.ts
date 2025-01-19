import axios, { AxiosResponse } from "axios";
import { BACKEND_BASE_URL } from "../config/api.js";

interface UserResponse {
  userName: string;
}

export const getLoginUser = async (): Promise<string | null> => {
  try {
    const response: AxiosResponse<UserResponse> = await axios.get(
      `${BACKEND_BASE_URL}/auth/user-info`,
      {
        withCredentials: true,
      }
    );
    return response.data.userName;
  } catch (err) {
    console.error(err);
    return null;
  }
};
