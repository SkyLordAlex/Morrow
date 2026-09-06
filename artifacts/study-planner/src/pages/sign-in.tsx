import { useState, type FormEvent } from 'react';
import { Link } from 'wouter';
import { Leaf, Loader2, Star } from 'lucide-react';
import {
  getListReviewHighlightsQueryKey,
  useListReviewHighlights,
} from '@workspace/api-client-react';
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

function SocialProof() {
  const query = useListReviewHighlights({
    query: { queryKey: getListReviewHighlightsQueryKey() },
  });
  const data = query.data;
  if (!data || data.count === 0) return null;

  return (
    <div className="mt-8" data-testid="section-social-proof">
      <div className="flex items-center justify-center gap-2 text-sm">
        <span className="flex items-center gap-0.5">
          {[1, 2, 3, 4, 5].map((n) => (
            <Star
              key={n}
              className={`h-3.5 w-3.5 ${
                n <= Math.round(data.average)
                  ? 'fill-secondary text-secondary'
                  : 'fill-transparent text-muted-foreground/40'
              }`}
            />
          ))}
        </span>
        <span className="font-bold text-foreground">
          {data.average.toFixed(1)}
        </span>
        <span className="text-muted-foreground">
          · {data.count} review{data.count === 1 ? '' : 's'}
        </span>
      </div>
      {data.highlights.length > 0 ? (
        <div className="mt-4 space-y-2.5">
          {data.highlights.slice(0, 2).map((review, index) => (
            <blockquote
              key={index}
              className="rounded-xl border border-border/70 bg-card px-4 py-3 text-xs leading-5 text-muted-foreground"
            >
              “{review.body}”
              {review.authorName ? (
                <span className="mt-1 block font-semibold text-foreground/70">
                  — {review.authorName}
                </span>
              ) : null}
            </blockquote>
          ))}
        </div>
      ) : null}
    </div>
  );
}

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

        <SocialProof />

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
