import { apiFetch } from './apiGateway';

export function pyPath(path: string) {
  if (path.startsWith('/')) return `/py${path}`;
  return `/py/${path}`;
}

export async function pyFetch(path: string, opts: RequestInit = {}) {
  return apiFetch(pyPath(path), opts);
}

export default { pyFetch, pyPath };
