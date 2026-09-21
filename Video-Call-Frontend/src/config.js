const inferredBackendUrl = `${window.location.protocol}//${window.location.hostname}:3001`;

export const BACKEND_URL =
  process.env.REACT_APP_BACKEND_URL || inferredBackendUrl;
