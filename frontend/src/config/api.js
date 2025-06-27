// API configuration that works in both development and production
const getApiBaseUrl = () => {
  // In production, use relative URLs (same domain/port as the frontend)
  if (import.meta.env.PROD) {
    return '';
  }
  
  // In development, use the development server URL
  // You can adjust this port if needed for your dev setup
  return 'http://localhost:3000';
};

export const API_BASE_URL = getApiBaseUrl();

console.log('🔧 API Base URL configured:', API_BASE_URL || 'relative URLs'); 