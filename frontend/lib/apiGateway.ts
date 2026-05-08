// Centralized API gateway client utilities
export const API_GATEWAY = typeof process !== 'undefined' && process.env?.NEXT_PUBLIC_API_GATEWAY_URL
  ? process.env.NEXT_PUBLIC_API_GATEWAY_URL
  : (typeof window !== 'undefined'
    ? window.location.origin
    : 'http://localhost');

function joinPath(base: string, path: string) {
  if (!path) return base;
  if (path.startsWith('/')) return `${base}${path}`;
  return `${base}/${path}`;
}

export async function apiFetch(path: string, opts: RequestInit = {}) {
  const url = joinPath(API_GATEWAY, path);
  return fetch(url, opts);
}

export function wsUrl(path: string) {
  // Convert API_GATEWAY (http/https) -> ws/wss and preserve hostname:port
  try {
    const u = new URL(API_GATEWAY);
    const proto = u.protocol === 'https:' ? 'wss:' : 'ws:';
    return `${proto}//${u.host}${path.startsWith('/') ? path : '/' + path}`;
  } catch {
    // Fallback to localhost:8000
    const proto = typeof window !== 'undefined' && window.location.protocol === 'https:' ? 'wss' : 'ws';
    return `${proto}://${typeof window !== 'undefined' ? window.location.hostname : 'localhost'}:8000${path.startsWith('/') ? path : '/' + path}`;
  }
}

export function gatewayBase() {
  return API_GATEWAY;
}
