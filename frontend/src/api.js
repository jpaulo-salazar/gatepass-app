const API_BASE_STORAGE_KEY = 'gate_pass_api_base';

// Force API base: use ?api=http://192.168.100.20:8000 in the URL to fix wrong localhost; stored in sessionStorage for the session
function getApiBase() {
  if (typeof window === 'undefined') return import.meta.env.VITE_API_URL || 'http://localhost:8000';

  const params = new URLSearchParams(window.location.search);
  const fromQuery = params.get('api') || params.get('apiBase');
  if (fromQuery && fromQuery.startsWith('http')) {
    try {
      new URL(fromQuery);
      sessionStorage.setItem(API_BASE_STORAGE_KEY, fromQuery.replace(/\/$/, ''));
      return fromQuery.replace(/\/$/, '');
    } catch (_) {}
  }
  // When page is opened by IP (e.g. 192.168.100.20:5173), always use same host for API so login works
  const loc = window.location;
  const host = loc.hostname || '';
  if (host !== 'localhost' && host !== '127.0.0.1') {
    return loc.protocol + '//' + host + ':8000';
  }
  const fromStorage = sessionStorage.getItem(API_BASE_STORAGE_KEY);
  if (fromStorage) return fromStorage;

  if (window.__GATE_PASS_API_BASE__) return window.__GATE_PASS_API_BASE__;

  const env = import.meta.env.VITE_API_URL;
  if (env) return env;
  return 'http://localhost:8000';
}

export function getAuthHeader() {
  const token = localStorage.getItem('token');
  return token ? { Authorization: `Bearer ${token}` } : {};
}

const API_TIMEOUT_MS = 15000;

export async function api(path, options = {}) {
  const base = getApiBase();
  const url = `${base}${path}`;
  if (typeof window !== 'undefined' && path === '/auth/login') {
    console.log('[Gate Pass] API base:', base, '→', url);
  }
  const headers = {
    'Content-Type': 'application/json',
    ...getAuthHeader(),
    ...options.headers,
  };
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), API_TIMEOUT_MS);
  try {
    const res = await fetch(url, { ...options, headers, signal: controller.signal });
    clearTimeout(timeoutId);
    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: res.statusText }));
      throw new Error(err.detail || res.statusText);
    }
    return res.json();
  } catch (e) {
    clearTimeout(timeoutId);
    if (e.name === 'AbortError') {
      throw new Error(`Request timed out. Is the backend running at ${getApiBase()}?`);
    }
    throw e;
  }
}

export async function login(username, password) {
  return api('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ username, password }),
  });
}

export async function getUsers() {
  return api('/users', { headers: getAuthHeader() });
}
export async function createUser(data) {
  return api('/users', { method: 'POST', body: JSON.stringify(data), headers: getAuthHeader() });
}
export async function updateUser(id, data) {
  return api(`/users/${id}`, { method: 'PUT', body: JSON.stringify(data), headers: getAuthHeader() });
}
export async function deleteUser(id) {
  return api(`/users/${id}`, { method: 'DELETE', headers: getAuthHeader() });
}

export async function getProducts() {
  return api('/products', { headers: getAuthHeader() });
}
export async function createProduct(data) {
  return api('/products', { method: 'POST', body: JSON.stringify(data), headers: getAuthHeader() });
}
export async function updateProduct(id, data) {
  return api(`/products/${id}`, { method: 'PUT', body: JSON.stringify(data), headers: getAuthHeader() });
}
export async function deleteProduct(id) {
  return api(`/products/${id}`, { method: 'DELETE', headers: getAuthHeader() });
}

export async function getGatePasses() {
  return api('/gate-passes', { headers: getAuthHeader() });
}
export async function getGatePass(id) {
  return api(`/gate-passes/${id}`, { headers: getAuthHeader() });
}
export async function getGatePassByNumber(gpNumber) {
  return api(`/gate-passes/by-number/${encodeURIComponent(gpNumber)}`);
}
export async function createGatePass(data) {
  return api('/gate-passes', { method: 'POST', body: JSON.stringify(data), headers: getAuthHeader() });
}
export async function updateGatePassStatus(id, { status, rejected_remarks, approved_by }) {
  return api(`/gate-passes/${id}/status`, {
    method: 'PATCH',
    body: JSON.stringify({ status, rejected_remarks, approved_by }),
    headers: getAuthHeader(),
  });
}