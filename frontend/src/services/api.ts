import axios from 'axios';
import { User, EmailJob, SchedulerMetrics, SenderOption } from '../types';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

/**
 * Returns the Bull-Board Queue Monitor URL.
 * In production, it dynamically resolves to the deployed backend's /admin/queues
 * derived from VITE_API_URL (e.g., https://backend.onrender.com/admin/queues)
 * or VITE_ADMIN_QUEUES_URL if explicitly configured.
 */
export const getAdminQueuesUrl = (): string => {
  if (import.meta.env.VITE_ADMIN_QUEUES_URL) {
    return import.meta.env.VITE_ADMIN_QUEUES_URL;
  }
  const apiUrl = (import.meta.env.VITE_API_URL || 'http://localhost:5000/api').trim();
  const backendBase = apiUrl.replace(/\/api\/?$/, '');
  return `${backendBase || ''}/admin/queues`;
};

export const apiClient = axios.create({
  baseURL: API_BASE_URL,
});

apiClient.interceptors.request.use((config) => {
  const token = localStorage.getItem('reachinbox_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

export const api = {
  // Auth
  googleLogin: async (credential: string) => {
    const res = await apiClient.post<{ token: string; user: User }>('/auth/google', { credential });
    return res.data;
  },
  devLogin: async (name?: string, email?: string) => {
    const res = await apiClient.post<{ token: string; user: User }>('/auth/dev-login', { name, email });
    return res.data;
  },
  getCurrentUser: async () => {
    const res = await apiClient.get<User>('/auth/me');
    return res.data;
  },

  // Senders
  getSenders: async () => {
    const res = await apiClient.get<SenderOption[]>('/emails/senders');
    return res.data;
  },

  // Email Scheduling
  scheduleEmails: async (formData: FormData) => {
    const res = await apiClient.post<{ message: string; count: number }>('/emails/schedule', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return res.data;
  },

  getScheduledEmails: async (q = '', page = 1) => {
    const res = await apiClient.get<{ emails: EmailJob[]; total: number; totalPages: number }>(
      `/emails/scheduled?q=${encodeURIComponent(q)}&page=${page}`
    );
    return res.data;
  },

  getSentEmails: async (q = '', status = 'ALL', page = 1) => {
    const res = await apiClient.get<{ emails: EmailJob[]; total: number; totalPages: number }>(
      `/emails/sent?q=${encodeURIComponent(q)}&status=${status}&page=${page}`
    );
    return res.data;
  },

  getMetrics: async () => {
    const res = await apiClient.get<SchedulerMetrics>('/emails/metrics');
    return res.data;
  },

  cancelScheduledEmail: async (id: string) => {
    const res = await apiClient.delete(`/emails/${id}`);
    return res.data;
  },

  // Slack Integration
  getSlackStatus: async () => {
    const res = await apiClient.get<{
      connected: boolean;
      channel: string | null;
      team: string | null;
      isDefault?: boolean;
    }>('/slack/status');
    return res.data;
  },

  connectSlackWebhook: async (webhookUrl: string, channelName?: string) => {
    const res = await apiClient.post('/slack/connect-webhook', { webhookUrl, channelName });
    return res.data;
  },

  disconnectSlack: async () => {
    const res = await apiClient.post('/slack/disconnect');
    return res.data;
  },

  testSlackAlert: async () => {
    const res = await apiClient.post<{ message: string }>('/slack/test');
    return res.data;
  },
};

export default api;
