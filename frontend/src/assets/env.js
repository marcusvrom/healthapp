// Default runtime config for local development.
// In Docker, this file is overwritten by entrypoint.sh using the API_URL env var.
window.__env__ = {
  apiUrl: 'http://localhost:3000/api/v1'
};
