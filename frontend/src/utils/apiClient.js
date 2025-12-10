// frontend/src/utils/apiClient.js
/**
 * Centralized fetch wrapper that:
 * - Attaches Authorization header when we have an access token
 * - On 401, tries /api/auth/refresh and retries once
 * - If refresh fails, clears tokens and rejects
 */

const STORAGE_KEYS = {
  access: 'ph_access_token',
  refresh: 'ph_refresh_token',
};

const API_BASE = (import.meta.env?.VITE_API_BASE || '').replace(/\/+$/, '');

export function buildApiUrl(path) {
  if (!path || /^https?:\/\//i.test(path)) return path;
  if (!API_BASE || !path.startsWith('/')) return path;
  return `${API_BASE}${path}`;
}

export function getApiBase() {
  return API_BASE;
}

export function setTokens({ access_token, refresh_token }) {
  if (access_token) localStorage.setItem(STORAGE_KEYS.access, access_token);
  if (refresh_token) localStorage.setItem(STORAGE_KEYS.refresh, refresh_token);
}

export function clearTokens() {
  localStorage.removeItem(STORAGE_KEYS.access);
  localStorage.removeItem(STORAGE_KEYS.refresh);
}

export function getAccessToken() {
  return localStorage.getItem(STORAGE_KEYS.access);
}

export function getRefreshToken() {
  return localStorage.getItem(STORAGE_KEYS.refresh);
}

export async function fetchJsonWithTimeout(url, options = {}, timeoutMs = 10000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetchJson(url, { ...options, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

async function refreshTokens() {
  const refresh = getRefreshToken();
  if (!refresh) throw new Error('No refresh token');

  const res = await fetch(buildApiUrl('/api/auth/refresh'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ refresh_token: refresh }),
  });

  if (!res.ok) throw new Error('Refresh failed');
  const data = await res.json();
  // expected shape: { access_token, refresh_token, user, token_type }
  setTokens(data);
  return data;
}

export async function fetchJson(url, options = {}, retry = true) {
  const headers = new Headers(options.headers || {});
  const token = getAccessToken();
  if (token) headers.set('Authorization', `Bearer ${token}`);

  const res = await fetch(buildApiUrl(url), { ...options, headers });
  if (res.status === 401 && retry) {
    try {
      await refreshTokens();
      // retry once with new access token
      return await fetchJson(url, options, false);
    } catch {
      clearTokens();
      throw new Error('Unauthorized');
    }
  }
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(text || `Request failed: ${res.status}`);
  }
  // Try JSON first; fall back to text
  const contentType = res.headers.get('content-type') || '';
  return contentType.includes('application/json') ? res.json() : res.text();
}
