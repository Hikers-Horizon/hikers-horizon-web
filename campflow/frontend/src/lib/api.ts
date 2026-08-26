import axios from "axios";

export const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_URL ??
  (typeof window !== "undefined" && window.location.hostname !== "localhost"
    ? ""
    : "http://localhost:8000");

export const api = axios.create({ baseURL: API_BASE_URL });

api.interceptors.request.use((config) => {
  if (typeof window !== "undefined") {
    const token = localStorage.getItem("campflow_token");
    const orgId = localStorage.getItem("campflow_org_id");
    if (token) config.headers.Authorization = `Bearer ${token}`;
    if (orgId) config.headers["X-Organization-Id"] = orgId;
  }
  return config;
});

api.interceptors.response.use(
  (res) => res,
  (err) => {
    if (typeof window !== "undefined" && err.response?.status === 401) {
      localStorage.removeItem("campflow_token");
      localStorage.removeItem("campflow_org_id");
      const basePath = process.env.NEXT_PUBLIC_BASE_PATH || "/campflow";
      window.location.href = `${basePath}/login`;
    }
    return Promise.reject(err);
  }
);
