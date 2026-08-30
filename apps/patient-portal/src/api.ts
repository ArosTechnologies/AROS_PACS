import axios from 'axios';

// Create a configured axios instance
export const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:8000/api/v1',
  withCredentials: true, // Crucial for sending/receiving HttpOnly cookies (like refresh_patient_token)
  headers: {
    'Content-Type': 'application/json',
    'X-Portal-Type': 'patient',
  },
});

// Flag to prevent infinite retry loops if refresh also fails
let isRefreshing = false;
let failedQueue: Array<{
  resolve: (value?: unknown) => void;
  reject: (reason?: any) => void;
}> = [];

const processQueue = (error: any, token: string | null = null) => {
  failedQueue.forEach((prom) => {
    if (error) {
      prom.reject(error);
    } else {
      prom.resolve(token);
    }
  });
  failedQueue = [];
};

// Request Interceptor: Attach access token
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('patient_token');
    if (token && config.headers) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Response Interceptor: Silent Refresh
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    // If it's a 401 (Unauthorized) and we haven't already retried this request
    if (error.response?.status === 401 && !originalRequest._retry) {
      // If we are already trying to refresh the token, add this request to the queue
      if (isRefreshing) {
        return new Promise((resolve, reject) => {
          failedQueue.push({ resolve, reject });
        })
          .then((token) => {
            originalRequest.headers.Authorization = `Bearer ${token}`;
            return api(originalRequest);
          })
          .catch((err) => {
            return Promise.reject(err);
          });
      }

      originalRequest._retry = true;
      isRefreshing = true;

      try {
        // Attempt to get a new access token using the HttpOnly refresh token cookie
        const refreshResponse = await axios.post(
           `${import.meta.env.VITE_API_URL || 'http://localhost:8000/api/v1'}/auth/refresh/`,
           {}, // Body can be empty, cookie is sent automatically
           { 
             withCredentials: true,
             headers: { 'X-Portal-Type': 'patient' }
           }
        );

        const newAccessToken = refreshResponse.data.access;
        localStorage.setItem('patient_token', newAccessToken);

        // Update the default header for future requests
        api.defaults.headers.common['Authorization'] = `Bearer ${newAccessToken}`;
        
        // Update the failed request header
        originalRequest.headers.Authorization = `Bearer ${newAccessToken}`;

        // Process all queued requests with the new token
        processQueue(null, newAccessToken);

        // Retry the original request
        return api(originalRequest);
      } catch (refreshError) {
        // Refresh token expired or is invalid. Log out the user.
        processQueue(refreshError, null);
        localStorage.removeItem('patient_token');
        // Let the application handle the redirect based on the missing token
        // E.g., a reload or triggering a state change
        if (window.location.pathname !== '/') {
            window.location.href = '/'; 
        }
        return Promise.reject(refreshError);
      } finally {
        isRefreshing = false;
      }
    }

    return Promise.reject(error);
  }
);
