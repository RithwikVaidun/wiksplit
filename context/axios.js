import axios from "axios";
import Cookies from "js-cookie";

const token = Cookies.get("authToken");

const apiClient = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_BASE,
  headers: {
    Authorization: token ? `Bearer ${token} ` : "",
    "ngrok-skip-browser-warning": "69420",
  },
});

export default apiClient;
