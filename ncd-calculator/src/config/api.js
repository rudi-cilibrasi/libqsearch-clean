export const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';
export const BACKEND_BASE_URL = import.meta.env.VITE_BACKEND_BASE_URL || 'http://localhost:3001/api';

export const getProxyUrl = (url, contentType = 'application/json') =>
    `${API_BASE_URL}/api/proxy?url=${encodeURIComponent(url)}&contentType=${contentType}`;