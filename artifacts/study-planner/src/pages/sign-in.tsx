import { useState, type FormEvent } from 'react';
import { Link } from 'wouter';
import { Leaf, Loader2, Star } from 'lucide-react';
import {
  getListReviewHighlightsQueryKey,
  useForgotPassword,
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

type Mode = 'signin' | 'register' | 'forgot';

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
  const forgotPassword = useForgotPassword();
  const [mode, setMode] = useState<Mode>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [forgotSent, setForgotSent] = useState(false);

  const goForgot = () => {
    setMode('forgot');
    setError(null);
    setForgotSent(false);
  };

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
    if (mode === 'forgot') {
      setError(null);
      forgotPassword.mutate(
        { data: { email: email.trim() } },
        {
          onSuccess: () => setForgotSent(true),
          onError: (caught) => setError(errorMessage(caught)),
        },
      );
      return;
    }
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
            {mode === 'signin'
              ? 'Welcome back'
              : mode === 'register'
                ? 'Create your account'
                : 'Reset your password'}
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            {mode === 'signin'
              ? 'Sign in to pick up your plan.'
              : mode === 'register'
                ? 'A few small steps, kept in one place.'
                : "Enter your email and we'll send a reset link."}
          </p>
        </div>

        <div className="rounded-2xl border border-border/80 bg-card p-6 shadow-sm">
          {mode === 'forgot' && forgotSent ? (
            <div className="text-center" data-testid="text-forgot-sent">
              <p className="text-sm leading-6 text-muted-foreground">
                If an account exists for{' '}
                <span className="font-semibold text-foreground">
                  {email.trim()}
                </span>
                , a reset link is on its way. It expires in an hour.
              </p>
              <button
                type="button"
                onClick={() => {
                  setMode('signin');
                  setForgotSent(false);
                }}
                className="mt-4 text-xs font-bold text-primary hover:underline"
              >
                Back to sign in
              </button>
            </div>
          ) : (
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
              {mode === 'register' ? (
                <p className="text-[11px] leading-4 text-muted-foreground">
                  Use a real inbox you can get into — it&apos;s how you reset a
                  forgotten password and get important account notices.
                </p>
              ) : null}
            </div>

            {mode !== 'forgot' ? (
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <Label htmlFor="password">Password</Label>
                  {mode === 'signin' ? (
                    <button
                      type="button"
                      onClick={goForgot}
                      data-testid="button-forgot-password"
                      className="text-[11px] font-bold text-primary hover:underline"
                    >
                      Forgot password?
                    </button>
                  ) : null}
                </div>
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
            ) : null}

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
              disabled={busy || forgotPassword.isPending}
              className="w-full"
              data-testid="button-submit-auth"
            >
              {busy || forgotPassword.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : null}
              {mode === 'signin'
                ? 'Sign in'
                : mode === 'register'
                  ? 'Create account'
                  : 'Send reset link'}
            </Button>
          </form>
          )}

          {mode !== 'forgot' && hasSocial ? (
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
          {mode === 'forgot'
            ? 'Remembered it? '
            : mode === 'signin'
              ? "Don't have an account? "
              : 'Already have an account? '}
          <button
            type="button"
            onClick={() => {
              setMode(mode === 'register' ? 'signin' : mode === 'signin' ? 'register' : 'signin');
              setError(null);
              setForgotSent(false);
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
