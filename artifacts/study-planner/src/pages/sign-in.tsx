import { useState, type FormEvent } from 'react';
import { Link } from 'wouter';
import { Leaf, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useAuth } from '@/auth/auth-context';
import {
  APPLE_CLIENT_ID,
  AppleSignInButton,
  GOOGLE_CLIENT_ID,
  GoogleSignInButton,
} from '@/auth/social-auth';

function errorMessage(error: unknown): string {
  if (error && typeof error === 'object') {
    const data = (error as { data?: unknown }).data;
    if (data && typeof data === 'object' && typeof (data as { error?: unknown }).error === 'string') {
      return (data as { error: string }).error;
    }
    const message = (error as { message?: unknown }).message;
    if (typeof message === 'string' && message) return message;
  }
  return 'Something went wrong. Try again.';
}

type Mode = 'signin' | 'register';

export default function SignIn() {
  const { signInWithPassword, registerAccount, signInWithGoogle, signInWithApple } =
    useAuth();
  const [mode, setMode] = useState<Mode>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const run = async (action: () => Promise<void>) => {
    setBusy(true);
    setError(null);
    try {
      await action();
    } catch (caught) {
      setError(errorMessage(caught));
      setBusy(false);
    }
  };

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (busy) return;
    void run(() =>
      mode === 'signin'
        ? signInWithPassword(email.trim(), password)
        : registerAccount(email.trim(), password, displayName.trim() || undefined),
    );
  };

  const hasSocial = Boolean(GOOGLE_CLIENT_ID || APPLE_CLIENT_ID);

  return (
    <div className="app-shell flex min-h-[100dvh] items-center justify-center bg-background px-5 py-10">
      <div className="w-full max-w-[400px]">
        <div className="mb-8 flex flex-col items-center text-center">
          <span className="grid h-11 w-11 place-items-center rounded-[13px] bg-primary text-primary-foreground shadow-sm">
            <Leaf className="h-5 w-5" strokeWidth={2.5} />
          </span>
          <h1 className="mt-4 font-serif text-[32px] leading-none text-foreground">
            {mode === 'signin' ? 'Welcome back' : 'Create your account'}
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            {mode === 'signin'
              ? 'Sign in to pick up your plan.'
              : 'A few small steps, kept in one place.'}
          </p>
        </div>

        <div className="rounded-2xl border border-border/80 bg-card p-6 shadow-sm">
          <form onSubmit={submit} className="space-y-4">
            {mode === 'register' ? (
              <div className="space-y-1.5">
                <Label htmlFor="displayName">Name</Label>
                <Input
                  id="displayName"
                  autoComplete="name"
                  value={displayName}
                  onChange={(event) => setDisplayName(event.target.value)}
                  data-testid="input-display-name"
                  placeholder="Ada"
                />
              </div>
            ) : null}

            <div className="space-y-1.5">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                required
                autoComplete="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                data-testid="input-email"
                placeholder="you@school.edu"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                required
                minLength={8}
                autoComplete={mode === 'signin' ? 'current-password' : 'new-password'}
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                data-testid="input-password"
                placeholder={mode === 'register' ? 'At least 8 characters' : '••••••••'}
              />
            </div>

            {error ? (
              <p
                className="rounded-md bg-destructive/10 px-3 py-2 text-xs font-semibold text-destructive"
                data-testid="text-auth-error"
              >
                {error}
              </p>
            ) : null}

            <Button
              type="submit"
              disabled={busy}
              className="w-full"
              data-testid="button-submit-auth"
            >
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              {mode === 'signin' ? 'Sign in' : 'Create account'}
            </Button>
          </form>

          {hasSocial ? (
            <>
              <div className="my-5 flex items-center gap-3 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                <span className="h-px flex-1 bg-border" />
                or
                <span className="h-px flex-1 bg-border" />
              </div>
              <div className="space-y-2.5">
                <GoogleSignInButton
                  onCredential={(idToken) =>
                    void run(() => signInWithGoogle(idToken))
                  }
                  onError={setError}
                />
                <AppleSignInButton
                  onIdentityToken={(identityToken) =>
                    void run(() => signInWithApple(identityToken))
                  }
                  onError={setError}
                />
              </div>
            </>
          ) : null}
        </div>

        <p className="mt-5 text-center text-sm text-muted-foreground">
          {mode === 'signin' ? "Don't have an account? " : 'Already have an account? '}
          <button
            type="button"
            onClick={() => {
              setMode(mode === 'signin' ? 'register' : 'signin');
              setError(null);
            }}
            data-testid="button-toggle-auth-mode"
            className="font-bold text-primary hover:underline"
          >
            {mode === 'signin' ? 'Sign up' : 'Sign in'}
          </button>
        </p>

        <p className="mt-6 text-center text-[11px] leading-4 text-muted-foreground/80">
          By continuing you agree to our{' '}
          <Link href="/terms" className="underline">
            Terms of Use
          </Link>{' '}
          and{' '}
          <Link href="/privacy" className="underline">
            Privacy Policy
          </Link>
          .
        </p>
      </div>
    </div>
  );
}
