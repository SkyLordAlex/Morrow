import * as SecureStore from 'expo-secure-store';

// The bearer token is kept in the iOS keychain via expo-secure-store, not
// AsyncStorage — it's a credential.

const TOKEN_KEY = 'morrow.authToken';

export async function readToken(): Promise<string | null> {
  try {
    return await SecureStore.getItemAsync(TOKEN_KEY);
  } catch {
    return null;
  }
}

export async function writeToken(token: string | null): Promise<void> {
  try {
    if (token) await SecureStore.setItemAsync(TOKEN_KEY, token);
    else await SecureStore.deleteItemAsync(TOKEN_KEY);
  } catch {
    /* Keychain unavailable (e.g. simulator quirk) — session still works in memory. */
  }
}
