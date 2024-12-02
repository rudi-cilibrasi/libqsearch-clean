import axios from "axios";
import {BACKEND_BASE_URL} from "../config/api.js";

export const getLoginUser = async () => {
    try {
        const response = await axios.get(`${BACKEND_BASE_URL}/auth/user-info`, {
            withCredentials: true,
        });
        return response.data.userName;
    } catch (err) {
        console.error(err);
        return null;
    }
};