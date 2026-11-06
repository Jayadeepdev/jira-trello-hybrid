import axios from 'axios';

const getBaseUrl = () => {
  const envUrl = import.meta.env.VITE_API_URL;

  if (!envUrl) {
    // Local dev only
    if (import.meta.env.DEV) return 'http://localhost:5000/api';
    // Production/preview build without the variable: fail loudly
    throw new Error('VITE_API_URL was not set at build time');
  }

  const clean = envUrl.replace(/\/+$/, ''); // strip trailing slashes
  return clean.endsWith('/api') ? clean : `${clean}/api`;
};

export const API_URL = getBaseUrl();

export const api = axios.create({
  baseURL: API_URL,
  withCredentials: true,
  headers: { 'Content-Type': 'application/json' },
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401 && window.location.pathname !== '/login') {
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);