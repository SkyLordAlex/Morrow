import { useEffect, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import {
  Check,
  Loader2,
  Monitor,
  Moon,
  Sun,
  Sunrise,
  Sunset,
} from 'lucide-react';
import {
  getGetSettingsQueryKey,
  useChangePassword,
  useGetSettings,
  useUpdateSettings,
} from '@workspace/api-client-react';
import { AppShell } from '@/components/app-shell';
import { useAuth } from '@/auth/auth-context';
import { useTheme, type ThemeMode } from '@/theme/theme-context';
import { useWeekStart } from '@/lib/week-start';

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

type PreferredTime = 'morning' | 'afternoon' | 'evening';

const STUDY_TIMES: {
  value: PreferredTime;
  label: string;
  hint: string;
  icon: typeof Sun;
}[] = [
  { value: 'morning', label: 'Morning', hint: 'from ~8 AM', icon: Sunrise },
  { value: 'afternoon', label: 'Afternoon', hint: 'from ~1 PM', icon: Sun },
  { value: 'evening', label: 'Evening', hint: 'from ~6 PM', icon: Sunset },
];

// 0 = Sunday … 6 = Saturday, matching the server.
const WEEKDAYS = [
  { value: 0, label: 'S', full: 'Sunday' },
  { value: 1, label: 'M', full: 'Monday' },
  { value: 2, label: 'T', full: 'Tuesday' },
  { value: 3, label: 'W', full: 'Wednesday' },
  { value: 4, label: 'T', full: 'Thursday' },
  { value: 5, label: 'F', full: 'Friday' },
  { value: 6, label: 'S', full: 'Saturday' },
];

function SavedTick({ saving, saved }: { saving: boolean; saved: boolean }) {
  if (saving)
    return <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />;
  if (saved)
    return (
      <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-primary">
        <Check className="h-3.5 w-3.5" /> Saved
      </span>
    );
  return null;
}

function PlanningSettings() {
  const queryClient = useQueryClient();
  const query = useGetSettings({ query: { queryKey: getGetSettingsQueryKey() } });
  const update = useUpdateSettings();

  const [minutes, setMinutes] = useState('90');
  const [blocked, setBlocked] = useState<number[]>([]);
  const [preferredTime, setPreferredTime] = useState<PreferredTime>('afternoon');
  const [savedAt, setSavedAt] = useState(0);

  useEffect(() => {
    if (!query.data) return;
    setMinutes(String(query.data.defaultAvailableMinutes));
    setBlocked(query.data.blockedWeekdays);
    setPreferredTime(query.data.preferredTime);
  }, [query.data]);

  const save = (next: {
    defaultAvailableMinutes?: number;
    blockedWeekdays?: number[];
    preferredTime?: PreferredTime;
  }) => {
    update.mutate(
      { data: next },
      {
        onSuccess: (result) => {
          setMinutes(String(result.defaultAvailableMinutes));
          setBlocked(result.blockedWeekdays);
          setPreferredTime(result.preferredTime);
          setSavedAt(Date.now());
          queryClient.invalidateQueries({ queryKey: getGetSettingsQueryKey() });
        },
      },
    );
  };

  const commitMinutes = () => {
    const parsed = Math.min(480, Math.max(15, Math.round(Number(minutes) || 90)));
    if (parsed === query.data?.defaultAvailableMinutes) return;
    save({ defaultAvailableMinutes: parsed });
  };

  const toggleDay = (day: number) => {
    const next = blocked.includes(day)
      ? blocked.filter((d) => d !== day)
      : [...blocked, day].sort((a, b) => a - b);
    setBlocked(next);
    save({ blockedWeekdays: next });
  };

  const showSaved = savedAt > 0 && Date.now() - savedAt < 4000;

  return (
    <section
      className="rounded-2xl border border-border/80 bg-card p-5 shadow-sm sm:p-6"
      data-testid="section-planning"
    >
      <div className="flex items-center justify-between">
        <p className="font-mono text-[10px] uppercase tracking-[0.17em] text-muted-foreground">
          Planning
        </p>
        <SavedTick saving={update.isPending} saved={showSaved} />
      </div>
      <h2 className="mt-1 font-serif text-[24px]">Defaults for new plans</h2>
      <p className="mt-1.5 text-sm leading-6 text-muted-foreground">
        Used every time you make a plan, so you don&apos;t have to repeat yourself.
        You can still override them in the moment.
      </p>

      {query.isLoading ? (
        <div className="mt-5 flex h-24 items-center">
          <Loader2 className="h-5 w-5 animate-spin text-primary" />
        </div>
      ) : (
        <div className="mt-5 space-y-6">
          <div>
            <label
              htmlFor="default-minutes"
              className="block text-xs font-extrabold text-foreground"
            >
              Time I have each day
            </label>
            <div className="mt-2 flex items-center gap-2">
              <input
                id="default-minutes"
                type="number"
                min={15}
                max={480}
                step={15}
                value={minutes}
                onChange={(event) => setMinutes(event.target.value)}
                onBlur={commitMinutes}
                data-testid="input-default-minutes"
                className="w-[92px] rounded-xl border border-input bg-background px-3 py-2.5 font-mono text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/10"
              />
              <span className="text-xs text-muted-foreground">minutes</span>
            </div>
          </div>

          <div>
            <span className="block text-xs font-extrabold text-foreground">
              Days I never study
            </span>
            <p className="mt-1 text-[11px] leading-4 text-muted-foreground">
              These are skipped when scheduling, on top of anything a note says.
            </p>
            <div className="mt-3 flex gap-1.5">
              {WEEKDAYS.map((day) => {
                const on = blocked.includes(day.value);
                return (
                  <button
                    key={day.value}
                    type="button"
                    onClick={() => toggleDay(day.value)}
                    aria-pressed={on}
                    aria-label={day.full}
                    title={day.full}
                    data-testid={`button-blockday-${day.value}`}
                    className={`h-9 w-9 rounded-lg text-xs font-bold transition-colors ${
                      on
                        ? 'bg-primary text-primary-foreground'
                        : 'border border-border bg-background text-muted-foreground hover:border-primary/40'
                    }`}
                  >
                    {day.label}
                  </button>
                );
              })}
            </div>
          </div>

          <div>
            <span className="block text-xs font-extrabold text-foreground">
              When sessions start
            </span>
            <p className="mt-1 text-[11px] leading-4 text-muted-foreground">
              Study sessions are scheduled from this time each day (a little
              earlier on weekends).
            </p>
            <div className="mt-3 grid gap-2 sm:grid-cols-3">
              {STUDY_TIMES.map((option) => {
                const selected = preferredTime === option.value;
                return (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => {
                      setPreferredTime(option.value);
                      save({ preferredTime: option.value });
                    }}
                    aria-pressed={selected}
                    data-testid={`button-studytime-${option.value}`}
                    className={`flex items-center gap-2.5 rounded-xl border p-3 text-left transition-colors ${
                      selected
                        ? 'border-primary bg-primary/5 ring-1 ring-primary'
                        : 'border-border hover:border-primary/40 hover:bg-muted/40'
                    }`}
                  >
                    <span
                      className={`grid h-8 w-8 shrink-0 place-items-center rounded-lg ${
                        selected
                          ? 'bg-primary text-primary-foreground'
                          : 'bg-muted text-muted-foreground'
                      }`}
                    >
                      <option.icon className="h-4 w-4" />
                    </span>
                    <span className="min-w-0">
                      <span className="block text-xs font-bold text-foreground">
                        {option.label}
                      </span>
                      <span className="block text-[10px] text-muted-foreground">
                        {option.hint}
                      </span>
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </section>
  );
}

function AccountSettings() {
  const { user, updateDisplayName } = useAuth();
  const [name, setName] = useState(user?.displayName ?? '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(false);
  const [savedAt, setSavedAt] = useState(0);

  useEffect(() => {
    setName(user?.displayName ?? '');
  }, [user?.displayName]);

  if (!user) return null;

  const trimmed = name.trim();
  const dirty = trimmed !== (user.displayName ?? '').trim();

  const save = () => {
    if (!trimmed || !dirty) return;
    setSaving(true);
    setError(false);
    updateDisplayName(trimmed)
      .then(() => setSavedAt(Date.now()))
      .catch(() => setError(true))
      .finally(() => setSaving(false));
  };

  const showSaved = savedAt > 0 && Date.now() - savedAt < 4000;

  return (
    <section
      className="rounded-2xl border border-border/80 bg-card p-5 shadow-sm sm:p-6"
      data-testid="section-account"
    >
      <div className="flex items-center justify-between">
        <p className="font-mono text-[10px] uppercase tracking-[0.17em] text-muted-foreground">
          Account
        </p>
        <SavedTick saving={saving} saved={showSaved} />
      </div>
      <h2 className="mt-1 font-serif text-[24px]">You</h2>

      <div className="mt-4">
        <label
          htmlFor="display-name"
          className="block text-xs font-extrabold text-foreground"
        >
          Name
        </label>
        <div className="mt-2 flex items-center gap-2">
          <input
            id="display-name"
            value={name}
            maxLength={80}
            onChange={(event) => setName(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter') save();
            }}
            placeholder="Your name"
            data-testid="input-display-name"
            className="w-full max-w-xs rounded-xl border border-input bg-background px-3 py-2.5 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/10"
          />
          <button
            type="button"
            onClick={save}
            disabled={!trimmed || !dirty || saving}
            data-testid="button-save-name"
            className="rounded-xl bg-primary px-3.5 py-2.5 text-xs font-extrabold text-primary-foreground transition-transform hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Save
          </button>
        </div>
        {error ? (
          <p className="mt-1.5 text-[11px] font-semibold text-destructive">
            Couldn&apos;t save that — try again.
          </p>
        ) : null}
      </div>

      <dl className="mt-5 space-y-3 border-t border-border/60 pt-4 text-sm">
        <div className="flex items-center justify-between gap-4">
          <dt className="text-muted-foreground">Email</dt>
          <dd className="truncate font-semibold text-foreground">
            {user.email}
          </dd>
        </div>
        <div className="flex items-center justify-between gap-4">
          <dt className="text-muted-foreground">Sign in with</dt>
          <dd className="flex flex-wrap justify-end gap-1.5">
            {user.hasPassword ? (
              <span className="rounded-full bg-muted px-2 py-0.5 text-[11px] font-bold text-foreground">
                Password
              </span>
            ) : null}
            {user.providers.map((provider) => (
              <span
                key={provider}
                className="rounded-full bg-muted px-2 py-0.5 text-[11px] font-bold capitalize text-foreground"
              >
                {provider}
              </span>
            ))}
          </dd>
        </div>
        {user.role === 'admin' ? (
          <div className="flex items-center justify-between gap-4">
            <dt className="text-muted-foreground">Role</dt>
            <dd className="font-semibold text-primary">Admin</dd>
          </div>
        ) : null}
      </dl>

      <PasswordForm hasPassword={user.hasPassword} />

      <p className="mt-4 text-[11px] leading-4 text-muted-foreground">
        Sign out or delete your account from the menu in the top-right.
      </p>
    </section>
  );
}

function PasswordForm({ hasPassword }: { hasPassword: boolean }) {
  const changePassword = useChangePassword();
  const [open, setOpen] = useState(false);
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [confirm, setConfirm] = useState('');
  const [message, setMessage] = useState<
    { kind: 'ok' | 'error'; text: string } | null
  >(null);

  const reset = () => {
    setCurrent('');
    setNext('');
    setConfirm('');
    setMessage(null);
  };

  const submit = () => {
    if (next.length < 8) {
      setMessage({ kind: 'error', text: 'Use at least 8 characters.' });
      return;
    }
    if (next !== confirm) {
      setMessage({ kind: 'error', text: "The two passwords don't match." });
      return;
    }
    changePassword.mutate(
      {
        data: {
          newPassword: next,
          ...(hasPassword ? { currentPassword: current } : {}),
        },
      },
      {
        onSuccess: () => {
          reset();
          setOpen(false);
          setMessage({ kind: 'ok', text: 'Password updated.' });
        },
        onError: (error) => {
          const text =
            error instanceof Error && 'data' in error
              ? ((error.data as { error?: string })?.error ??
                'Could not update your password.')
              : 'Could not update your password.';
          setMessage({ kind: 'error', text });
        },
      },
    );
  };

  return (
    <div className="mt-5 border-t border-border/60 pt-4">
      {!open ? (
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => {
              reset();
              setOpen(true);
            }}
            data-testid="button-open-password"
            className="rounded-xl border border-border px-3.5 py-2.5 text-xs font-extrabold text-foreground hover:bg-muted"
          >
            {hasPassword ? 'Change password' : 'Set a password'}
          </button>
          {message?.kind === 'ok' ? (
            <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-primary">
              <Check className="h-3.5 w-3.5" /> {message.text}
            </span>
          ) : null}
        </div>
      ) : (
        <div className="max-w-xs space-y-2.5" data-testid="form-password">
          {hasPassword ? (
            <input
              type="password"
              value={current}
              onChange={(event) => setCurrent(event.target.value)}
              placeholder="Current password"
              autoComplete="current-password"
              data-testid="input-current-password"
              className="w-full rounded-xl border border-input bg-background px-3 py-2.5 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/10"
            />
          ) : null}
          <input
            type="password"
            value={next}
            onChange={(event) => setNext(event.target.value)}
            placeholder="New password"
            autoComplete="new-password"
            data-testid="input-new-password"
            className="w-full rounded-xl border border-input bg-background px-3 py-2.5 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/10"
          />
          <input
            type="password"
            value={confirm}
            onChange={(event) => setConfirm(event.target.value)}
            placeholder="Confirm new password"
            autoComplete="new-password"
            data-testid="input-confirm-password"
            className="w-full rounded-xl border border-input bg-background px-3 py-2.5 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/10"
          />
          {message?.kind === 'error' ? (
            <p className="text-[11px] font-semibold text-destructive">
              {message.text}
            </p>
          ) : null}
          <div className="flex items-center gap-2 pt-0.5">
            <button
              type="button"
              onClick={submit}
              disabled={changePassword.isPending}
              data-testid="button-save-password"
              className="rounded-xl bg-primary px-3.5 py-2.5 text-xs font-extrabold text-primary-foreground disabled:opacity-50"
            >
              {changePassword.isPending ? 'Saving…' : 'Save password'}
            </button>
            <button
              type="button"
              onClick={() => {
                reset();
                setOpen(false);
              }}
              className="rounded-xl px-3 py-2.5 text-xs font-bold text-muted-foreground hover:text-foreground"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function CalendarSettings() {
  const [weekStart, setWeekStart] = useWeekStart();
  const options: { value: 0 | 1; label: string }[] = [
    { value: 0, label: 'Sunday' },
    { value: 1, label: 'Monday' },
  ];

  return (
    <section
      className="rounded-2xl border border-border/80 bg-card p-5 shadow-sm sm:p-6"
      data-testid="section-calendar"
    >
      <p className="font-mono text-[10px] uppercase tracking-[0.17em] text-muted-foreground">
        Calendar
      </p>
      <h2 className="mt-1 font-serif text-[24px]">Week starts on</h2>
      <p className="mt-1.5 text-sm leading-6 text-muted-foreground">
        The first column of the month grid.
      </p>
      <div className="mt-4 inline-flex rounded-xl border border-border p-1">
        {options.map((option) => {
          const selected = weekStart === option.value;
          return (
            <button
              key={option.value}
              type="button"
              onClick={() => setWeekStart(option.value)}
              aria-pressed={selected}
              data-testid={`button-weekstart-${option.value}`}
              className={`rounded-lg px-4 py-2 text-xs font-bold transition-colors ${
                selected
                  ? 'bg-primary text-primary-foreground'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              {option.label}
            </button>
          );
        })}
      </div>
    </section>
  );
}

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

        <PlanningSettings />

        <CalendarSettings />

        {user ? <AccountSettings /> : null}
      </div>
    </AppShell>
  );
}
