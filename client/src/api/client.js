const BASE = import.meta.env.VITE_API_URL || '/api';

/**
 * Authentication transport
 * ------------------------
 * The session lives in an httpOnly + sameSite cookie issued by the API — no JWT
 * is ever written to localStorage or sessionStorage, so scripts cannot read it.
 *
 * A copy of the token is also kept in a module variable (memory only) so the
 * SPA keeps working inside embedded previews where third-party cookies can be
 * blocked. It disappears on reload and is never persisted.
 */
let memoryToken = null;

export function setMemoryToken(token) {
  memoryToken = token || null;
}

export function getMemoryToken() {
  return memoryToken;
}

let unauthorizedHandler = null;
export function setUnauthorizedHandler(handler) {
  unauthorizedHandler = handler;
}

async function request(path, { method = 'GET', body, params, signal } = {}) {
  const url = new URL(`${BASE}${path}`, window.location.origin);
  if (params) {
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined && value !== null && value !== '') {
        url.searchParams.set(key, String(value));
      }
    });
  }

  const headers = {};
  if (body) headers['Content-Type'] = 'application/json';
  if (memoryToken) headers.Authorization = `Bearer ${memoryToken}`;

  const response = await fetch(url.toString(), {
    method,
    credentials: 'include',
    headers,
    body: body ? JSON.stringify(body) : undefined,
    signal,
  });

  let data = null;
  try {
    data = await response.json();
  } catch {
    data = null;
  }

  if (!response.ok) {
    if (response.status === 401) {
      memoryToken = null;
      if (unauthorizedHandler) unauthorizedHandler();
    }
    const error = new Error(data?.message || `Request failed with status ${response.status}.`);
    error.status = response.status;
    error.details = data?.details;
    throw error;
  }

  return data;
}

export const api = {
  get: (path, params) => request(path, { params }),
  post: (path, body) => request(path, { method: 'POST', body }),
  patch: (path, body) => request(path, { method: 'PATCH', body }),
  put: (path, body) => request(path, { method: 'PUT', body }),
  delete: (path) => request(path, { method: 'DELETE' }),
};

export default api;
