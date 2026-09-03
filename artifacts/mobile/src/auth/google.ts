import { useEffect } from 'react';
import Constants from 'expo-constants';
import * as WebBrowser from 'expo-web-browser';
import * as Google from 'expo-auth-session/providers/google';

// Google sign-in via the system browser (Expo AuthSession). This works in Expo
// Go without a development build — unlike the native Google SDK. We ask for an
// ID token and hand it straight to `POST /auth/google`, which verifies it.

WebBrowser.maybeCompleteAuthSession();

const iosClientId =
  process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID ||
  (Constants.expoConfig?.extra?.googleIosClientId as string | undefined);
const webClientId =
  process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID ||
  (Constants.expoConfig?.extra?.googleWebClientId as string | undefined);

export const isGoogleConfigured = Boolean(iosClientId || webClientId);

export function useGoogleSignIn(
  onIdToken: (idToken: string) => void,
  onError: (message: string) => void,
) {
  const [request, response, promptAsync] = Google.useIdTokenAuthRequest({
    iosClientId,
    webClientId,
  });

  useEffect(() => {
    if (!response) return;
    if (response.type === 'success') {
      const idToken = response.params?.['id_token'];
      if (idToken) onIdToken(idToken);
      else onError('Google did not return an ID token.');
    } else if (response.type === 'error') {
      onError('Google sign-in failed. Try again.');
    }
    // 'dismiss' / 'cancel' are silent — the user backed out on purpose.
  }, [response, onIdToken, onError]);

  return {
    available: isGoogleConfigured && Boolean(request),
    promptAsync,
  };
}
