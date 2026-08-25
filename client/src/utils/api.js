/**
 * API Utility Helper cho FileTools Client
 */

const API_BASE = import.meta.env.VITE_API_URL || '';

export async function request(url, options = {}) {
  const token = localStorage.getItem('token');
  const headers = {
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...options.headers,
  };

  const res = await fetch(`${API_BASE}${url}`, {
    ...options,
    headers,
  });

  const data = await res.json().catch(() => ({}));

  if (!res.ok) {
    const error = new Error(data.error || res.statusText || 'Yêu cầu thất bại');
    error.status = res.status;
    error.data = data;
    throw error;
  }

  return data;
}

export const api = {
  get: (url, opts) => request(url, { method: 'GET', ...opts }),
  post: (url, body, opts) =>
    request(url, {
      method: 'POST',
      headers: body instanceof FormData ? {} : { 'Content-Type': 'application/json' },
      body: body instanceof FormData ? body : JSON.stringify(body),
      ...opts,
    }),
  delete: (url, opts) => request(url, { method: 'DELETE', ...opts }),
};

export default api;
