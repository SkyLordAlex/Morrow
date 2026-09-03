import { useEffect, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Check, Loader2, Monitor, Moon, Sun } from 'lucide-react';
import {
  getGetSettingsQueryKey,
  useGetSettings,
  useUpdateSettings,
} from '@workspace/api-client-react';
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
  const [savedAt, setSavedAt] = useState(0);

  useEffect(() => {
    if (!query.data) return;
    setMinutes(String(query.data.defaultAvailableMinutes));
    setBlocked(query.data.blockedWeekdays);
  }, [query.data]);

  const save = (next: { defaultAvailableMinutes?: number; blockedWeekdays?: number[] }) => {
    update.mutate(
      { data: next },
      {
        onSuccess: (result) => {
          setMinutes(String(result.defaultAvailableMinutes));
          setBlocked(result.blockedWeekdays);
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
        </div>
      )}
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
