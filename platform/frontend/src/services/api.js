import axios from 'axios';

const api = axios.create({
  baseURL: process.env.REACT_APP_API_URL || '/api',
});

// Attach JWT automatically
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// Auto-logout on 401
api.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401) {
      localStorage.removeItem('token');
      window.location.href = '/login';
    }
    return Promise.reject(err);
  }
);

export const authAPI = {
  register: (data) => api.post('/auth/register', data),
  login: (data) => api.post('/auth/login', data),
  me: () => api.get('/auth/me'),
};

export const creatorsAPI = {
  list: (params) => api.get('/creators', { params }),
  getProfile: (username) => api.get(`/creators/${username}`),
  getTiers: (username) => api.get(`/creators/${username}/tiers`),
  becomeCreator: () => api.post('/creators/become'),
  updateProfile: (data) => api.patch('/creators/profile', data),
};

export const postsAPI = {
  feed: (params) => api.get('/posts/feed', { params }),
  byCreator: (username) => api.get(`/posts/creator/${username}`),
  get: (id) => api.get(`/posts/${id}`),
  create: (data) => api.post('/posts', data),
  delete: (id) => api.delete(`/posts/${id}`),
  like: (id) => api.post(`/posts/${id}/like`),
};

export const subscriptionsAPI = {
  createTier: (data) => api.post('/subscriptions/tiers', data),
  checkout: (tier_id) => api.post('/subscriptions/checkout', { tier_id }),
  mine: () => api.get('/subscriptions/my'),
  subscribers: () => api.get('/subscriptions/subscribers'),
  cancel: (id) => api.delete(`/subscriptions/${id}`),
};

export const moderationAPI = {
  getPolicy: () => api.get('/moderation/policy'),
  report: (data) => api.post('/moderation/report', data),
  submitAppeal: (data) => api.post('/moderation/appeals', data),
};

export default api;
