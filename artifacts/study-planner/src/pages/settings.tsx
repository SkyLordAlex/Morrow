import { Monitor, Moon, Sun } from 'lucide-react';
import { AppShell } from '@/components/app-shell';
import { useAuth } from '@/auth/auth-context';
import { useTheme, type ThemeMode } from '@/theme/theme-context';

const THEME_OPTIONS: {
  value: ThemeMode;
  label: string;
  hint: string;
  icon: typeof Sun;
}[] = [
  { value: 'light', label: 'Light', hint: 'Always the light theme', icon: Sun },
  {
    value: 'system',
    label: 'System',
    hint: 'Match your device setting',
    icon: Monitor,
  },
  { value: 'dark', label: 'Dark', hint: 'Always the dark theme', icon: Moon },
];

export default function Settings() {
  const { user } = useAuth();
  const { mode, resolved, setMode } = useTheme();

  return (
    <AppShell active="settings">
      <div className="animate-rise mb-8">
        <p className="font-mono text-[10px] uppercase tracking-[0.19em] text-primary">
          Make it yours
        </p>
        <h1 className="mt-2 font-serif text-[42px] leading-[.95] tracking-tight text-foreground sm:text-[48px]">
          Settings
        </h1>
      </div>

      <div className="max-w-2xl space-y-7">
        <section
          className="rounded-2xl border border-border/80 bg-card p-5 shadow-sm sm:p-6"
          data-testid="section-appearance"
        >
          <p className="font-mono text-[10px] uppercase tracking-[0.17em] text-muted-foreground">
            Appearance
          </p>
          <h2 className="mt-1 font-serif text-[24px]">Theme</h2>
          <p className="mt-1.5 text-sm leading-6 text-muted-foreground">
            Choose how Morrow looks.{' '}
            {mode === 'system'
              ? `Following your device — currently ${resolved}.`
              : `Set to ${mode}.`}
          </p>

          <div className="mt-5 grid gap-3 sm:grid-cols-3">
            {THEME_OPTIONS.map((option) => {
              const selected = mode === option.value;
              return (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => setMode(option.value)}
                  aria-pressed={selected}
                  data-testid={`button-theme-${option.value}`}
                  className={`flex flex-col items-start gap-2 rounded-xl border p-4 text-left transition-colors ${
                    selected
                      ? 'border-primary bg-primary/5 ring-1 ring-primary'
                      : 'border-border hover:border-primary/40 hover:bg-muted/40'
                  }`}
                >
                  <span
                    className={`grid h-9 w-9 place-items-center rounded-lg ${
                      selected
                        ? 'bg-primary text-primary-foreground'
                        : 'bg-muted text-muted-foreground'
                    }`}
                  >
                    <option.icon className="h-4 w-4" />
                  </span>
                  <span className="text-sm font-bold text-foreground">
                    {option.label}
                  </span>
                  <span className="text-[11px] leading-4 text-muted-foreground">
                    {option.hint}
                  </span>
                </button>
              );
            })}
          </div>
        </section>

        {user ? (
          <section
            className="rounded-2xl border border-border/80 bg-card p-5 shadow-sm sm:p-6"
            data-testid="section-account"
          >
            <p className="font-mono text-[10px] uppercase tracking-[0.17em] text-muted-foreground">
              Account
            </p>
            <h2 className="mt-1 font-serif text-[24px]">You</h2>
            <dl className="mt-4 space-y-3 text-sm">
              <div className="flex items-center justify-between gap-4">
                <dt className="text-muted-foreground">Name</dt>
                <dd className="font-semibold text-foreground">
                  {user.displayName || '—'}
                </dd>
              </div>
              <div className="flex items-center justify-between gap-4">
                <dt className="text-muted-foreground">Email</dt>
                <dd className="truncate font-semibold text-foreground">
                  {user.email}
                </dd>
              </div>
              {user.role === 'admin' ? (
                <div className="flex items-center justify-between gap-4">
                  <dt className="text-muted-foreground">Role</dt>
                  <dd className="font-semibold text-primary">Admin</dd>
                </div>
              ) : null}
            </dl>
            <p className="mt-4 text-[11px] leading-4 text-muted-foreground">
              Sign out or delete your account from the menu in the top-right.
            </p>
          </section>
        ) : null}
      </div>
    </AppShell>
  );
}
