// API URL is resolved at runtime from window.__env__ (set by entrypoint.sh).
// Falls back to localhost for development without Docker.
const runtimeApiUrl: string =
  (typeof window !== 'undefined'
    ? (window as { __env__?: { apiUrl?: string } }).__env__?.apiUrl
    : undefined)
  ?? 'http://localhost:3000/api/v1';

export const environment = {
  production: false,
  apiUrl: runtimeApiUrl,
};
