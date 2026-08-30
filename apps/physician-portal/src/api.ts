import axios from 'axios';

// Create a configured axios instance
export const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:8000/api/v1',
  withCredentials: true, // Crucial for sending/receiving HttpOnly cookies (like refresh_physician_token)
  headers: {
    'Content-Type': 'application/json',
    'X-Portal-Type': 'physician',
  },
});


// Flag to prevent infinite retry loops if refresh also fails
let isRefreshing = false;
let failedQueue: Array<{
  resolve: (value?: unknown) => void;
  reject: (reason?: any) => void;
}> = [];

const processQueue = (error: any, physician_token: string | null = null) => {
  failedQueue.forEach((prom) => {
    if (error) {
      prom.reject(error);
    } else {
      prom.resolve(physician_token);
    }
  });
  failedQueue = [];
};

// Request Interceptor: Attach access physician_token
api.interceptors.request.use(
  (config) => {
    const physician_token = localStorage.getItem('physician_token');
    if (physician_token && config.headers) {
      config.headers.Authorization = `Bearer ${physician_token}`;
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
      // If we are already trying to refresh the physician_token, add this request to the queue
      if (isRefreshing) {
        return new Promise((resolve, reject) => {
          failedQueue.push({ resolve, reject });
        })
          .then((physician_token) => {
            originalRequest.headers.Authorization = `Bearer ${physician_token}`;
            return api(originalRequest);
          })
          .catch((err) => {
            return Promise.reject(err);
          });
      }

      originalRequest._retry = true;
      isRefreshing = true;

      try {
        // Attempt to get a new access physician_token using the HttpOnly refresh physician_token cookie
        const refreshResponse = await axios.post(
          'http://localhost:8000/api/v1/auth/refresh/',
          {}, // Body can be empty, cookie is sent automatically
          { 
            withCredentials: true,
            headers: { 'X-Portal-Type': 'physician' }
          }
        );

        const newAccessToken = refreshResponse.data.access;
        localStorage.setItem('physician_token', newAccessToken);

        // Update the default header for future requests
        api.defaults.headers.common['Authorization'] = `Bearer ${newAccessToken}`;
        
        // Update the failed request header
        originalRequest.headers.Authorization = `Bearer ${newAccessToken}`;

        // Process all queued requests with the new physician_token
        processQueue(null, newAccessToken);

        // Retry the original request
        return api(originalRequest);
      } catch (refreshError) {
        // Refresh token expired or is invalid. Log out the user.
        processQueue(refreshError, null);
        localStorage.removeItem('token');
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
