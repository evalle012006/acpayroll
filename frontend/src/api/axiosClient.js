import axios from "axios";

const emitAuthChanged = () => window.dispatchEvent(new Event("auth-changed"));

const api = axios.create({
  baseURL: "http://localhost:5000/api",
  withCredentials: false,
});

api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem("token");
    if (token) config.headers.Authorization = `Bearer ${token}`;
    return config;
  },
  (error) => Promise.reject(error)
);

api.interceptors.response.use(
  (response) => response,
  (error) => {
    const status = error?.response?.status;

    if (status === 401) {
      localStorage.removeItem("token");
      localStorage.removeItem("user");
      emitAuthChanged();
    }

    return Promise.reject(error);
  }
);

export default api;