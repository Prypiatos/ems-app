import { apiFetch } from './apiGateway';

export function goPath(path: string) {
  if (path.startsWith('/')) return `/go${path}`;
  return `/go/${path}`;
}

export async function goFetch(path: string, opts: RequestInit = {}) {
  return apiFetch(goPath(path), opts);
}

export default { goFetch, goPath };
