import { useEffect, useRef, useState } from 'react';

// "Continue with Google/Apple" for the web. Each provider's JS SDK is loaded
// on demand and only when its client ID is configured, so an unconfigured
// build simply doesn't render the button.

export const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID;
export const APPLE_CLIENT_ID = import.meta.env.VITE_APPLE_CLIENT_ID;

const scriptCache = new Map<string, Promise<void>>();

function loadScript(src: string): Promise<void> {
  const cached = scriptCache.get(src);
  if (cached) return cached;
  const promise = new Promise<void>((resolve, reject) => {
    const el = document.createElement('script');
    el.src = src;
    el.async = true;
    el.onload = () => resolve();
    el.onerror = () => reject(new Error(`Failed to load ${src}`));
    document.head.appendChild(el);
  });
  scriptCache.set(src, promise);
  return promise;
}

// --- Google ---------------------------------------------------------------

interface GoogleIdApi {
  accounts: {
    id: {
      initialize: (config: {
        client_id: string;
        callback: (response: { credential?: string }) => void;
      }) => void;
      renderButton: (
        parent: HTMLElement,
        options: Record<string, unknown>,
      ) => void;
    };
  };
}

declare global {
  interface Window {
    google?: GoogleIdApi;
    AppleID?: AppleIdApi;
  }
}

export function GoogleSignInButton({
  onCredential,
  onError,
}: {
  onCredential: (idToken: string) => void;
  onError: (message: string) => void;
}) {
  const container = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!GOOGLE_CLIENT_ID) return;
    let cancelled = false;
    loadScript('https://accounts.google.com/gsi/client')
      .then(() => {
        if (cancelled || !container.current || !window.google) return;
        window.google.accounts.id.initialize({
          client_id: GOOGLE_CLIENT_ID,
          callback: (response) => {
            if (response.credential) onCredential(response.credential);
            else onError('Google did not return a credential.');
          },
        });
        window.google.accounts.id.renderButton(container.current, {
          theme: 'outline',
          size: 'large',
          text: 'continue_with',
          width: 320,
        });
      })
      .catch(() => onError('Could not load Google sign-in.'));
    return () => {
      cancelled = true;
    };
  }, [onCredential, onError]);

  if (!GOOGLE_CLIENT_ID) return null;
  return <div ref={container} className="flex justify-center" />;
}

// --- Apple --------------------------------------------------------------

interface AppleIdApi {
  auth: {
    init: (config: {
      clientId: string;
      scope: string;
      redirectURI: string;
      usePopup: boolean;
    }) => void;
    signIn: () => Promise<{
      authorization?: { id_token?: string };
    }>;
  };
}

export function AppleSignInButton({
  onIdentityToken,
  onError,
}: {
  onIdentityToken: (identityToken: string) => void;
  onError: (message: string) => void;
}) {
  const [busy, setBusy] = useState(false);

  if (!APPLE_CLIENT_ID) return null;

  const start = async () => {
    setBusy(true);
    try {
      await loadScript(
        'https://appleid.cdn-apple.com/appleauth/static/jsapi/appleid/1/en_US/appleid.auth.js',
      );
      if (!window.AppleID) throw new Error('Apple SDK unavailable');
      window.AppleID.auth.init({
        clientId: APPLE_CLIENT_ID,
        scope: 'email',
        redirectURI: window.location.origin,
        usePopup: true,
      });
      const response = await window.AppleID.auth.signIn();
      const idToken = response.authorization?.id_token;
      if (idToken) onIdentityToken(idToken);
      else onError('Apple did not return an identity token.');
    } catch {
      onError('Apple sign-in was cancelled or failed.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <button
      type="button"
      onClick={start}
      disabled={busy}
      data-testid="button-apple-signin"
      className="flex min-h-10 w-full items-center justify-center gap-2 rounded-md bg-[#050708] px-4 text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-50"
    >
      <svg viewBox="0 0 14 17" className="h-4 w-4" fill="currentColor" aria-hidden>
        <path d="M11.6 8.9c0-2 1.6-2.9 1.7-3-1-1.4-2.4-1.6-2.9-1.6-1.2-.1-2.4.7-3 .7-.6 0-1.6-.7-2.6-.7-1.3 0-2.6.8-3.2 2-1.4 2.4-.4 6 1 8 .7 1 1.4 2 2.4 2 1 0 1.3-.6 2.5-.6s1.5.6 2.5.6 1.7-1 2.3-2c.7-1.1 1-2.2 1-2.3 0 0-2-.8-2-3.1zM9.7 3c.5-.7.9-1.6.8-2.5-.8 0-1.7.5-2.3 1.2-.5.6-.9 1.5-.8 2.4.9.1 1.8-.4 2.3-1.1z" />
      </svg>
      {busy ? 'Opening Apple…' : 'Continue with Apple'}
    </button>
  );
}
