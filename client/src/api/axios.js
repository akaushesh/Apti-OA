import axios from "axios";

const apiHost = (import.meta.env.VITE_API_HOST || "http://localhost:8000").replace(/\/$/, "");
const apiBasePath = (import.meta.env.VITE_API_BASE_URL || "/api").replace(/\/$/, "");
const baseURL = `${apiHost}${apiBasePath}`;

const API = axios.create({
  baseURL,
  withCredentials: true
});

API.interceptors.request.use((config) => {
  const token = localStorage.getItem("accessToken");
  if (token) {
    config.headers["Authorization"] = `Bearer ${token}`;
  }
  return config;
});

API.interceptors.response.use(
  res => res,
  async (err) => {
    const originalRequest = err.config;
    if (err.response?.status === 401 && originalRequest && !originalRequest._retry && !originalRequest.url?.includes("/login") && !originalRequest.url?.includes("/refresh-token")) {
      originalRequest._retry = true;
      try {
        const refreshResponse = await axios.post(`${baseURL}/users/refresh-token`, {}, {
          withCredentials: true
        });
        const newAccessToken = refreshResponse.data.data.accessToken;
        localStorage.setItem("accessToken", newAccessToken);
        API.defaults.headers.common["Authorization"] = `Bearer ${newAccessToken}`;
        originalRequest.headers["Authorization"] = `Bearer ${newAccessToken}`;
        return API(originalRequest);
      } catch (refreshError) {
        localStorage.removeItem("accessToken");
        localStorage.removeItem("auth");
        window.location.href = "/";
        return Promise.reject(refreshError);
      }
    }
    return Promise.reject(err);
  }
);

export default API;