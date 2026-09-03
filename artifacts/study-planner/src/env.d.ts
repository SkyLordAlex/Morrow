/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Google OAuth *Web* client ID — enables "Continue with Google" on the sign-in screen. */
  readonly VITE_GOOGLE_CLIENT_ID?: string;
  /** Apple *Services ID* — enables "Continue with Apple" on the sign-in screen. */
  readonly VITE_APPLE_CLIENT_ID?: string;
  /** Dev-only: where the vite `/api` proxy forwards. Defaults to http://localhost:5000. */
  readonly VITE_API_PROXY_TARGET?: string;
  /** Production: absolute URL of the API service (protocol optional). Baked in at build time. */
  readonly VITE_API_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
