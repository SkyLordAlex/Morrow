import { setBaseUrl } from '@workspace/api-client-react';

// In production the web app and the API are on different origins, so point the
// generated client at the API. `VITE_API_URL` is baked in at build time — set
// it to the API service's URL (protocol optional). Locally it's unset and the
// vite dev proxy forwards `/api` instead.
const raw = import.meta.env.VITE_API_URL?.trim();
if (raw) {
  const withProtocol = /^https?:\/\//.test(raw) ? raw : `https://${raw}`;
  setBaseUrl(withProtocol.replace(/\/+$/, ''));
}
