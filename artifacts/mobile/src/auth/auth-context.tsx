import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import {
  authApple,
  authGoogle,
  deleteAccount as deleteAccountRequest,
  getAuthSession,
  login as loginRequest,
  logout as logoutRequest,
  register as registerRequest,
  setAuthTokenGetter,
  type AuthResult,
  type User,
} from '@workspace/api-client-react';

import { readToken, writeToken } from './storage';

// Bearer-token auth for the app. The token is attached to every API request by
// the `setAuthTokenGetter` hook in lib/api-client-react/src/custom-fetch.ts.
// The getter reads a module-level variable so it always sees the latest token
// without being re-registered.

let currentToken: string | null = null;
setAuthTokenGetter(() => currentToken);

type AuthStatus = 'loading' | 'authenticated' | 'unauthenticated';

interface AuthContextValue {
  status: AuthStatus;
  isAuthenticated: boolean;
  user: User | null;
  signInWithPassword: (email: string, password: string) => Promise<void>;
  registerAccount: (
    email: string,
    password: string,
    displayName?: string,
  ) => Promise<void>;
  signInWithApple: (identityToken: string) => Promise<void>;
  signInWithGoogle: (idToken: string) => Promise<void>;
  signOut: () => Promise<void>;
  deleteAccount: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<AuthStatus>('loading');
  const [user, setUser] = useState<User | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const stored = await readToken();
      currentToken = stored;
      if (!stored) {
        if (!cancelled) setStatus('unauthenticated');
        return;
      }
      try {
        const resolved = await getAuthSession();
        if (cancelled) return;
        setUser(resolved);
        setStatus('authenticated');
      } catch {
        currentToken = null;
        await writeToken(null);
        if (!cancelled) setStatus('unauthenticated');
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const adopt = useCallback(async (result: AuthResult) => {
    currentToken = result.token;
    await writeToken(result.token);
    setUser(result.user);
    setStatus('authenticated');
  }, []);

  const clear = useCallback(async () => {
    currentToken = null;
    await writeToken(null);
    setUser(null);
    setStatus('unauthenticated');
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      status,
      isAuthenticated: status === 'authenticated',
      user,
      signInWithPassword: async (email, password) => {
        await adopt(await loginRequest({ email: email.trim(), password }));
      },
      registerAccount: async (email, password, displayName) => {
        await adopt(
          await registerRequest({
            email: email.trim(),
            password,
            displayName: displayName?.trim() || undefined,
          }),
        );
      },
      signInWithApple: async (identityToken) => {
        await adopt(await authApple({ identityToken }));
      },
      signInWithGoogle: async (idToken) => {
        await adopt(await authGoogle({ idToken }));
      },
      signOut: async () => {
        try {
          await logoutRequest();
        } catch {
          /* best effort */
        }
        await clear();
      },
      deleteAccount: async () => {
        await deleteAccountRequest();
        await clear();
      },
    }),
    [status, user, adopt, clear],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const value = useContext(AuthContext);
  if (!value) throw new Error('useAuth must be used within an <AuthProvider>');
  return value;
}
