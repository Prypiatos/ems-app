"use client";

import axios from 'axios';

/**
 * Centralized API client for all backend communication via Kong Gateway.
 */
const api = axios.create({
  baseURL: 'http://localhost:8000/api',
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor to add the Basic Auth header if credentials exist
api.interceptors.request.use((config) => {
  const authHeader = localStorage.getItem('ems_auth');
  if (authHeader) {
    config.headers['Authorization'] = `Basic ${authHeader}`;
  }
  return config;
});

// Response interceptor to handle 401s (Unauthorized)
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      // Clear invalid credentials and redirect to login
      localStorage.removeItem('ems_auth');
      if (window.location.pathname !== '/login') {
        window.location.href = '/login';
      }
    }
    return Promise.reject(error);
  }
);

export default api;
