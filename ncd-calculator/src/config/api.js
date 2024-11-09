export const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';

export const getProxyUrl = (url, contentType = 'application/json') =>
    `${API_BASE_URL}/api/proxy?url=${encodeURIComponent(url)}&contentType=${contentType}`;