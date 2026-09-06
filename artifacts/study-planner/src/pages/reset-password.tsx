import { useState, type FormEvent } from 'react';
import { Link } from 'wouter';
import { CheckCircle2, Leaf, Loader2 } from 'lucide-react';
import { useResetPassword } from '@workspace/api-client-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

function errorMessage(error: unknown): string {
  if (error && typeof error === 'object') {
    const data = (error as { data?: unknown }).data;
    if (
      data &&
      typeof data === 'object' &&
      typeof (data as { error?: unknown }).error === 'string'
    ) {
      return (data as { error: string }).error;
    }
  }
  return 'Something went wrong. Try again.';
}

const home = import.meta.env.BASE_URL.replace(/\/$/, '') || '/';

export default function ResetPassword() {
  const reset = useResetPassword();
  const token = new URLSearchParams(window.location.search).get('token') ?? '';
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    if (password.length < 8) {
      setError('Use at least 8 characters.');
      return;
    }
    if (password !== confirm) {
      setError("The two passwords don't match.");
      return;
    }
    reset.mutate(
      { data: { token, newPassword: password } },
      {
        onSuccess: () => setDone(true),
        onError: (caught) => setError(errorMessage(caught)),
      },
    );
  };

  return (
    <div className="app-shell flex min-h-[100dvh] items-center justify-center bg-background px-5 py-10">
      <div className="w-full max-w-[400px]">
        <div className="mb-8 flex flex-col items-center text-center">
          <span className="grid h-11 w-11 place-items-center rounded-[13px] bg-primary text-primary-foreground shadow-sm">
            <Leaf className="h-5 w-5" strokeWidth={2.5} />
          </span>
          <h1 className="mt-4 font-serif text-[32px] leading-none text-foreground">
            {done ? 'Password reset' : 'Set a new password'}
          </h1>
        </div>

        <div className="rounded-2xl border border-border/80 bg-card p-6 shadow-sm">
          {done ? (
            <div className="text-center">
              <CheckCircle2 className="mx-auto h-8 w-8 text-primary" />
              <p className="mt-3 text-sm text-muted-foreground">
                Your password has been updated. You&apos;ve been signed out
                everywhere — sign in with the new one.
              </p>
              <a
                href={home}
                data-testid="link-to-sign-in"
                className="mt-5 inline-block rounded-xl bg-primary px-4 py-2.5 text-xs font-extrabold text-primary-foreground"
              >
                Go to sign in
              </a>
            </div>
          ) : !token ? (
            <p className="text-sm text-muted-foreground">
              This link is missing its reset code. Request a new one from the
              sign-in screen.
            </p>
          ) : (
            <form onSubmit={submit} className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="new-password">New password</Label>
                <Input
                  id="new-password"
                  type="password"
                  required
                  minLength={8}
                  autoComplete="new-password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  data-testid="input-new-password"
                  placeholder="At least 8 characters"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="confirm-password">Confirm password</Label>
                <Input
                  id="confirm-password"
                  type="password"
                  required
                  autoComplete="new-password"
                  value={confirm}
                  onChange={(event) => setConfirm(event.target.value)}
                  data-testid="input-confirm-password"
                  placeholder="Re-enter it"
                />
              </div>

              {error ? (
                <p
                  className="rounded-md bg-destructive/10 px-3 py-2 text-xs font-semibold text-destructive"
                  data-testid="text-reset-error"
                >
                  {error}
                </p>
              ) : null}

              <Button
                type="submit"
                disabled={reset.isPending}
                className="w-full"
                data-testid="button-submit-reset"
              >
                {reset.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : null}
                Reset password
              </Button>
            </form>
          )}
        </div>

        <p className="mt-5 text-center text-sm text-muted-foreground">
          <Link href="/" className="font-bold text-primary hover:underline">
            Back to sign in
          </Link>
        </p>
      </div>
    </div>
  );
}
