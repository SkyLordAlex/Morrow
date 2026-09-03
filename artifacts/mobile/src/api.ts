import Constants from 'expo-constants';
import { setBaseUrl } from '@workspace/api-client-react';

// The web build talks to the API through a same-origin path (`/api/...`).
// A native bundle has no origin, so every relative request needs an absolute
// base. `setBaseUrl` is the hook lib/api-client-react/src/custom-fetch.ts
// already exposes for exactly this case.
//
// Resolution order:
//   1. EXPO_PUBLIC_API_BASE_URL  — set in .env for local device testing
//   2. expo.extra.apiBaseUrl     — set in app.json for release builds
//
// Note the `/api` suffix: the API server is mounted under that path by
// artifacts/api-server/.replit-artifact/artifact.toml.
const fromEnv = process.env.EXPO_PUBLIC_API_BASE_URL;
const fromConfig = Constants.expoConfig?.extra?.apiBaseUrl as string | undefined;

export const API_BASE_URL = `${(fromEnv || fromConfig || '').replace(/\/+$/, '')}/api`;

export function configureApi(): void {
  if (!fromEnv && !fromConfig) {
    // Fail loudly in dev rather than silently firing requests at nothing.
    console.warn(
      '[api] No API base URL configured. Set EXPO_PUBLIC_API_BASE_URL in ' +
        'artifacts/mobile/.env, or expo.extra.apiBaseUrl in app.json.',
    );
    return;
  }
  setBaseUrl(API_BASE_URL);
}
