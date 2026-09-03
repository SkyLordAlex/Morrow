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
  updateAccount as updateAccountRequest,
  type AuthResult,
  type User,
} from '@workspace/api-client-react';

// Bearer-token auth for the web app. The token lives in localStorage and is
// attached to every API request by the `setAuthTokenGetter` hook that
// `custom-fetch.ts` already exposes (the same hook the mobile app uses).

const TOKEN_KEY = 'morrow.authToken';

function readToken(): string | null {
  try {
    return localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

let currentToken: string | null = readToken();

function applyToken(token: string | null): void {
  currentToken = token;
  try {
    if (token) localStorage.setItem(TOKEN_KEY, token);
    else localStorage.removeItem(TOKEN_KEY);
  } catch {
    /* Safari private mode and similar — auth still works for this tab. */
  }
}

// Registered once. The getter closes over the module-level `currentToken`, so
// it always returns the latest value without re-registering.
setAuthTokenGetter(() => currentToken);

type AuthStatus = 'loading' | 'authenticated' | 'unauthenticated';

interface AuthContextValue {
  status: AuthStatus;
  user: User | null;
  signInWithPassword: (email: string, password: string) => Promise<void>;
  registerAccount: (
    email: string,
    password: string,
    displayName?: string,
  ) => Promise<void>;
  signInWithGoogle: (idToken: string) => Promise<void>;
  signInWithApple: (identityToken: string) => Promise<void>;
  signOut: () => Promise<void>;
  deleteAccount: () => Promise<void>;
  updateDisplayName: (displayName: string) => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<AuthStatus>(
    currentToken ? 'loading' : 'unauthenticated',
  );
  const [user, setUser] = useState<User | null>(null);

  useEffect(() => {
    if (!currentToken) return;
    let cancelled = false;
    getAuthSession()
      .then((resolved) => {
        if (cancelled) return;
        setUser(resolved);
        setStatus('authenticated');
      })
      .catch(() => {
        if (cancelled) return;
        applyToken(null);
        setUser(null);
        setStatus('unauthenticated');
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const adopt = useCallback((result: AuthResult) => {
    applyToken(result.token);
    setUser(result.user);
    setStatus('authenticated');
  }, []);

  const clear = useCallback(() => {
    applyToken(null);
    setUser(null);
    setStatus('unauthenticated');
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      status,
      user,
      signInWithPassword: async (email, password) => {
        adopt(await loginRequest({ email, password }));
      },
      registerAccount: async (email, password, displayName) => {
        adopt(await registerRequest({ email, password, displayName }));
      },
      signInWithGoogle: async (idToken) => {
        adopt(await authGoogle({ idToken }));
      },
      signInWithApple: async (identityToken) => {
        adopt(await authApple({ identityToken }));
      },
      signOut: async () => {
        try {
          await logoutRequest();
        } catch {
          /* Revoke best-effort; clear locally regardless. */
        }
        clear();
      },
      deleteAccount: async () => {
        await deleteAccountRequest();
        clear();
      },
      updateDisplayName: async (displayName) => {
        const updated = await updateAccountRequest({ displayName });
        setUser(updated);
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
