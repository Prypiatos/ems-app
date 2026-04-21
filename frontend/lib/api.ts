import axios from 'axios';

/**
 * Centralized API client for all backend communication via Kong Gateway.
 * 
 * Note: In this static frontend setup, we use Basic Auth. 
 * The browser's native credential caching handles the persistence
 * of the username/password after the first 401 response from Kong.
 */
const api = axios.create({
  baseURL: 'http://localhost:8000/api',
  headers: {
    'Content-Type': 'application/json',
  },
  // This allows the browser to send credentials (cookies, auth headers) automatically
  withCredentials: true,
});

// Response interceptor for global error handling
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      console.error('Unauthorized access - Kong Gateway rejected credentials');
    }
    return Promise.reject(error);
  }
);

export default api;
