import {
  ArrowRight,
  CalendarDays,
  Check,
  CheckCircle2,
  Clock3,
  Flame,
  Inbox,
  Leaf,
  Loader2,
  LockKeyhole,
  Menu,
  MoveRight,
  Plus,
  RefreshCcw,
  Sparkles,
  Target,
  TimerReset,
  X,
} from 'lucide-react';
import { useMemo, useState, type FormEvent } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import {
  getGetPlannerDashboardQueryKey,
  getHealthCheckQueryKey,
  type Assignment,
  type PlannerDashboard,
  type StudyPlan,
  type StudySession,
  type StudyTask,
  useCompleteStudySession,
  useCreateStudyPlan,
  useGetPlannerDashboard,
  useHealthCheck,
  useRescheduleStudySession,
  useUpdatePlannerTask,
} from '@workspace/api-client-react';

const accentStyles: Record<string, { ink: string; soft: string; line: string }> = {
  amber: { ink: '#B36A1E', soft: '#FFF0C9', line: '#E3B35D' },
  coral: { ink: '#B84E49', soft: '#FFE2D7', line: '#E99B87' },
  blue: { ink: '#347A8D', soft: '#DDEFF1', line: '#8FC4C8' },
  violet: { ink: '#75617E', soft: '#EEE5F2', line: '#B6A0BF' },
  sage: { ink: '#4E826B', soft: '#DDEDE4', line: '#9CC4AF' },
};

const fallbackAccent = accentStyles.amber;

function accentFor(value: string | undefined) {
  if (!value) return fallbackAccent;
  return accentStyles[value.toLowerCase()] ?? fallbackAccent;
}

function minutesLabel(minutes: number) {
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  const remainder = minutes % 60;
  return remainder ? `${hours}h ${remainder}m` : `${hours}h`;
}

function clockLabel(time: string) {
  const [hourValue, minute = '00'] = time.split(':');
  const hour = Number(hourValue);
  if (Number.isNaN(hour)) return time;
  const suffix = hour >= 12 ? 'PM' : 'AM';
  const displayHour = hour % 12 || 12;
  return `${displayHour}:${minute} ${suffix}`;
}

function formatDate(date: string) {
  if (!date) return 'Choose a day';
  const parsed = new Date(`${date}T12:00:00`);
  return Number.isNaN(parsed.getTime())
    ? date
    : parsed.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function SectionHeading({
  eyebrow,
  title,
  action,
  onAction,
}: {
  eyebrow: string;
  title: string;
  action?: string;
  onAction?: () => void;
}) {
  return (
    <div className="mb-4 flex items-end justify-between gap-4">
      <div>
        <p className="font-mono text-[10px] font-medium uppercase tracking-[0.18em] text-muted-foreground">{eyebrow}</p>
        <h2 className="mt-1 font-serif text-[26px] leading-none text-foreground">{title}</h2>
      </div>
      {action && onAction ? (
        <button
          type="button"
          onClick={onAction}
          data-testid={`button-${action.toLowerCase().replaceAll(' ', '-')}`}
          className="group flex shrink-0 items-center gap-1.5 text-xs font-bold text-primary transition-transform hover:translate-x-0.5"
        >
          {action}
          <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
        </button>
      ) : null}
    </div>
  );
}

function Sidebar({
  mobileOpen,
  onClose,
  onPlan,
}: {
  mobileOpen: boolean;
  onClose: () => void;
  onPlan: () => void;
}) {
  const navItems = [
    { label: 'Today', icon: Target, target: 'today-section', active: true },
    { label: 'This week', icon: CalendarDays, target: 'week-section', active: false },
    { label: 'Assignments', icon: Inbox, target: 'assignments-section', active: false },
  ];

  return (
    <>
      {mobileOpen ? (
        <button
          type="button"
          aria-label="Close navigation"
          data-testid="button-close-navigation"
          onClick={onClose}
          className="fixed inset-0 z-40 bg-[#123B35]/30 backdrop-blur-sm lg:hidden"
        />
      ) : null}
      <aside
        className={`fixed inset-y-0 left-0 z-50 flex w-[248px] flex-col bg-sidebar px-5 py-6 text-sidebar-foreground transition-transform duration-300 lg:static lg:z-auto lg:translate-x-0 ${
          mobileOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
        data-testid="navigation-sidebar"
      >
        <div className="flex items-center justify-between">
          <button
            type="button"
            onClick={() => document.getElementById('today-section')?.scrollIntoView({ behavior: 'smooth' })}
            data-testid="button-brand-home"
            className="flex items-center gap-2.5 text-left"
          >
            <span className="grid h-9 w-9 place-items-center rounded-[11px] bg-sidebar-primary text-sidebar-primary-foreground shadow-sm">
              <Leaf className="h-[18px] w-[18px]" strokeWidth={2.5} />
            </span>
            <span>
              <span className="block font-serif text-[20px] leading-none tracking-tight text-sidebar-foreground">Morrow</span>
              <span className="mt-1 block font-mono text-[8px] uppercase tracking-[0.21em] text-sidebar-foreground/55">study planner</span>
            </span>
          </button>
          <button
            type="button"
            onClick={onClose}
            data-testid="button-close-sidebar"
            aria-label="Close sidebar"
            className="rounded-md p-1 text-sidebar-foreground/50 hover:bg-sidebar-accent hover:text-sidebar-foreground lg:hidden"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="mt-14">
          <p className="mb-3 px-3 font-mono text-[9px] uppercase tracking-[0.19em] text-sidebar-foreground/45">Your space</p>
          <nav className="space-y-1" aria-label="Planner sections">
            {navItems.map(({ label, icon: Icon, target, active }) => (
              <button
                key={label}
                type="button"
                onClick={() => {
                  document.getElementById(target)?.scrollIntoView({ behavior: 'smooth' });
                  onClose();
                }}
                data-testid={`button-nav-${label.toLowerCase().replace(' ', '-')}`}
                className={`group flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm transition-colors ${
                  active
                    ? 'bg-sidebar-accent text-sidebar-foreground'
                    : 'text-sidebar-foreground/58 hover:bg-sidebar-accent/70 hover:text-sidebar-foreground'
                }`}
              >
                <Icon className={`h-4 w-4 ${active ? 'text-sidebar-primary' : 'text-sidebar-foreground/55'}`} />
                <span className="font-semibold">{label}</span>
                {active ? <span className="ml-auto h-1.5 w-1.5 rounded-full bg-sidebar-primary" /> : null}
              </button>
            ))}
          </nav>
        </div>

        <div className="mt-auto">
          <div className="rounded-2xl border border-sidebar-border bg-sidebar-accent/60 p-4">
            <div className="flex items-start justify-between">
              <span className="grid h-8 w-8 place-items-center rounded-lg bg-sidebar-primary/15 text-sidebar-primary">
                <Sparkles className="h-4 w-4" />
              </span>
              <span className="font-mono text-[9px] uppercase tracking-[0.15em] text-sidebar-foreground/45">coach</span>
            </div>
            <p className="mt-3 text-[13px] font-semibold leading-5 text-sidebar-foreground">A little structure goes a long way.</p>
            <p className="mt-1 text-[11px] leading-4 text-sidebar-foreground/55">Turn the pile in your head into your next clear step.</p>
            <button
              type="button"
              onClick={onPlan}
              data-testid="button-sidebar-plan"
              className="mt-4 flex w-full items-center justify-between rounded-lg bg-sidebar-primary px-3 py-2 text-xs font-extrabold text-sidebar-primary-foreground transition-transform hover:-translate-y-0.5"
            >
              Make a plan <ArrowRight className="h-3.5 w-3.5" />
            </button>
          </div>
          <div className="mt-5 flex items-center gap-2 px-1 text-[10px] text-sidebar-foreground/40">
            <LockKeyhole className="h-3 w-3" />
            <span>Your plans stay yours</span>
          </div>
        </div>
      </aside>
    </>
  );
}

function Topbar({ onMenu, healthOk }: { onMenu: () => void; healthOk: boolean }) {
  return (
    <header className="flex items-center justify-between border-b border-border/70 px-5 py-4 sm:px-8 lg:px-10">
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={onMenu}
          aria-label="Open navigation"
          data-testid="button-open-navigation"
          className="rounded-lg p-2 text-muted-foreground hover:bg-muted lg:hidden"
        >
          <Menu className="h-5 w-5" />
        </button>
        <div className="hidden items-center gap-2 text-xs text-muted-foreground sm:flex">
          <span className="h-1.5 w-1.5 rounded-full bg-secondary" />
          <span>Small steps, steady progress</span>
        </div>
      </div>
      <div className="flex items-center gap-3">
        <div className="hidden items-center gap-2 rounded-full border border-border bg-card px-3 py-1.5 text-[10px] font-bold text-muted-foreground sm:flex">
          <span className={`h-1.5 w-1.5 rounded-full ${healthOk ? 'bg-[#6DAF89]' : 'bg-accent'}`} />
          {healthOk ? 'Planner ready' : 'Checking planner'}
        </div>
        <div className="grid h-8 w-8 place-items-center rounded-full bg-primary text-[11px] font-extrabold text-primary-foreground">AM</div>
      </div>
    </header>
  );
}

function FocusCard({
  focus,
  onComplete,
  pending,
  onReschedule,
}: {
  focus: PlannerDashboard['todayFocus'];
  onComplete: () => void;
  pending: boolean;
  onReschedule: () => void;
}) {
  if (!focus) {
    return (
      <div className="relative overflow-hidden rounded-[24px] bg-primary px-6 py-7 text-primary-foreground shadow-lg shadow-primary/10 sm:px-8 sm:py-8">
        <div className="absolute -right-10 -top-16 h-48 w-48 rounded-full border-[24px] border-secondary/15" />
        <div className="relative">
          <p className="font-mono text-[10px] uppercase tracking-[0.19em] text-primary-foreground/60">Today&apos;s focus</p>
          <h2 className="mt-4 max-w-lg font-serif text-[32px] leading-[1.02] sm:text-[38px]">You have room to breathe.</h2>
          <p className="mt-3 max-w-md text-sm leading-6 text-primary-foreground/65">Nothing is scheduled here yet. Make a plan when you&apos;re ready, and we&apos;ll find a gentle place to begin.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="relative overflow-hidden rounded-[24px] bg-primary px-6 py-7 text-primary-foreground shadow-lg shadow-primary/10 sm:px-8 sm:py-8">
      <div className="absolute -right-14 -top-20 h-56 w-56 rounded-full border-[27px] border-secondary/15" />
      <div className="absolute -bottom-24 right-24 h-44 w-44 rounded-full border border-secondary/10" />
      <div className="relative flex flex-col justify-between gap-8 sm:flex-row">
        <div>
          <div className="flex items-center gap-2">
            <span className="font-mono text-[10px] uppercase tracking-[0.19em] text-primary-foreground/60">Your next step</span>
            <span className="h-px w-8 bg-secondary/60" />
          </div>
          <h2 className="mt-4 max-w-xl font-serif text-[35px] leading-[1.03] sm:text-[43px]" data-testid="text-focus-title">{focus.title}</h2>
          <p className="mt-3 max-w-md text-sm leading-6 text-primary-foreground/65" data-testid="text-focus-context">{focus.context}</p>
          <div className="mt-5 flex flex-wrap items-center gap-x-5 gap-y-2 text-xs text-primary-foreground/70">
            <span className="inline-flex items-center gap-1.5"><Clock3 className="h-3.5 w-3.5 text-secondary" /> {clockLabel(focus.startTime)}</span>
            <span className="inline-flex items-center gap-1.5"><TimerReset className="h-3.5 w-3.5 text-secondary" /> {minutesLabel(focus.durationMinutes)}</span>
            <span className="rounded-full bg-primary-foreground/10 px-2.5 py-1 font-semibold">{focus.subject}</span>
          </div>
        </div>
        <div className="flex shrink-0 items-end gap-2 sm:flex-col sm:items-end sm:justify-end">
          <button
            type="button"
            disabled={pending}
            onClick={onComplete}
            data-testid={`button-complete-focus-${focus.sessionId}`}
            className="group inline-flex items-center gap-2 rounded-xl bg-secondary px-4 py-3 text-xs font-extrabold text-secondary-foreground transition-transform hover:-translate-y-0.5 disabled:opacity-60"
          >
            {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4 transition-transform group-hover:scale-110" />}
            Mark complete
          </button>
          <button
            type="button"
            onClick={onReschedule}
            data-testid={`button-reschedule-focus-${focus.sessionId}`}
            className="inline-flex items-center gap-2 rounded-xl px-3 py-2 text-xs font-bold text-primary-foreground/55 transition-colors hover:text-primary-foreground"
          >
            Move this session <MoveRight className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
}

function SessionRow({
  session,
  onComplete,
  onReschedule,
  pending,
}: {
  session: StudySession;
  onComplete: () => void;
  onReschedule: () => void;
  pending: boolean;
}) {
  const isComplete = session.status === 'complete';
  return (
    <div className={`group flex items-center gap-3 border-b border-border/70 py-3.5 last:border-b-0 ${isComplete ? 'opacity-55' : ''}`} data-testid={`row-session-${session.id}`}>
      <button
        type="button"
        disabled={isComplete || pending}
        aria-label={isComplete ? `${session.title} complete` : `Complete ${session.title}`}
        onClick={onComplete}
        data-testid={`button-complete-session-${session.id}`}
        className={`grid h-7 w-7 shrink-0 place-items-center rounded-full border transition-all ${
          isComplete
            ? 'animate-check-pop border-primary bg-primary text-primary-foreground'
            : 'border-border bg-background text-transparent hover:border-primary hover:bg-primary/10'
        } ${pending ? 'animate-pulse' : ''}`}
      >
        <Check className="h-3.5 w-3.5" strokeWidth={3} />
      </button>
      <div className="min-w-0 flex-1">
        <p className={`truncate text-[13px] font-bold ${isComplete ? 'line-through' : 'text-foreground'}`} data-testid={`text-session-title-${session.id}`}>{session.title}</p>
        <p className="mt-0.5 text-[11px] text-muted-foreground">{session.subject} · {minutesLabel(session.durationMinutes)}</p>
      </div>
      <span className="hidden font-mono text-[10px] text-muted-foreground sm:block">{clockLabel(session.startTime)}</span>
      {!isComplete ? (
        <button
          type="button"
          onClick={onReschedule}
          data-testid={`button-move-session-${session.id}`}
          className="rounded-lg px-2 py-1.5 text-[10px] font-bold text-muted-foreground opacity-0 transition-opacity hover:bg-muted hover:text-foreground group-hover:opacity-100 focus:opacity-100"
        >
          Move
        </button>
      ) : null}
    </div>
  );
}

function AssignmentRow({ assignment }: { assignment: Assignment }) {
  const colors = accentFor(assignment.accent);
  const progress = assignment.totalMinutes ? Math.min(100, Math.round((assignment.completedMinutes / assignment.totalMinutes) * 100)) : 0;
  return (
    <div className="group flex items-center gap-3 border-b border-border/70 py-4 last:border-b-0" data-testid={`row-assignment-${assignment.id}`}>
      <span className="h-9 w-1 rounded-full" style={{ backgroundColor: colors.line }} />
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <p className="truncate text-[13px] font-bold text-foreground" data-testid={`text-assignment-title-${assignment.id}`}>{assignment.title}</p>
          {assignment.status === 'at_risk' ? <span className="shrink-0 rounded-full bg-accent/15 px-2 py-0.5 text-[9px] font-extrabold uppercase tracking-wide text-[#B84E49]">at risk</span> : null}
          {assignment.status === 'complete' ? <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-primary" /> : null}
        </div>
        <div className="mt-2 flex items-center gap-2">
          <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
            <div className="h-full rounded-full transition-all duration-500" style={{ width: `${progress}%`, backgroundColor: colors.ink }} />
          </div>
          <span className="font-mono text-[9px] text-muted-foreground">{progress}%</span>
        </div>
      </div>
      <div className="shrink-0 text-right">
        <p className="font-mono text-[10px] font-medium text-foreground">{assignment.dueLabel}</p>
        <p className="mt-1 text-[10px] text-muted-foreground">{minutesLabel(Math.max(0, assignment.totalMinutes - assignment.completedMinutes))} left</p>
      </div>
    </div>
  );
}

function Workload({ days }: { days: PlannerDashboard['workload'] }) {
  const maxMinutes = Math.max(...days.map((day) => day.minutes), 1);
  return (
    <div className="rounded-2xl border border-border/80 bg-card p-5 shadow-sm">
      <div className="flex items-start justify-between">
        <div>
          <p className="font-mono text-[10px] uppercase tracking-[0.17em] text-muted-foreground">The week ahead</p>
          <h3 className="mt-1 font-serif text-[23px]">Your rhythm</h3>
        </div>
        <span className="grid h-8 w-8 place-items-center rounded-lg bg-secondary/25 text-primary"><CalendarDays className="h-4 w-4" /></span>
      </div>
      {days.length ? (
        <div className="mt-6 flex h-[134px] items-end justify-between gap-2">
          {days.map((day) => {
            const height = Math.max(9, (day.minutes / maxMinutes) * 100);
            return (
              <div key={day.date} className="flex h-full flex-1 flex-col items-center justify-end gap-2" data-testid={`bar-workload-${day.date}`}>
                <span className="font-mono text-[9px] text-muted-foreground">{day.minutes ? minutesLabel(day.minutes) : '—'}</span>
                <div className="flex h-[84px] w-full items-end rounded-md bg-muted/70">
                  <div
                    className={`w-full rounded-md transition-all duration-700 ${day.isToday ? 'bg-secondary' : 'bg-primary/25'}`}
                    style={{ height: `${height}%` }}
                    title={`${day.sessionCount} sessions`}
                  />
                </div>
                <span className={`text-[10px] font-bold ${day.isToday ? 'text-primary' : 'text-muted-foreground'}`}>{day.dayLabel}</span>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="mt-6 flex h-[134px] items-center justify-center rounded-xl bg-muted/45 text-center" data-testid="state-workload-empty">
          <p className="max-w-[220px] text-xs leading-5 text-muted-foreground">Your rhythm will appear here once a few sessions are on the calendar.</p>
        </div>
      )}
    </div>
  );
}

function PlanComposer({
  open,
  onClose,
  onCreated,
}: {
  open: boolean;
  onClose: () => void;
  onCreated: (plan: StudyPlan) => void;
}) {
  const createStudyPlan = useCreateStudyPlan();
  const [note, setNote] = useState('');
  const [availableMinutes, setAvailableMinutes] = useState('90');
  const error = createStudyPlan.isError;

  if (!open) return null;

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (note.trim().length < 3) return;
    createStudyPlan.mutate(
      { data: { note: note.trim(), availableMinutesPerDay: Number(availableMinutes) } },
      {
        onSuccess: (plan) => {
          onCreated(plan);
          setNote('');
          onClose();
        },
      },
    );
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-end justify-center bg-primary/30 p-0 backdrop-blur-sm sm:items-center sm:p-6" role="dialog" aria-modal="true" aria-labelledby="plan-dialog-title">
      <button type="button" aria-label="Close plan composer" data-testid="button-close-plan" onClick={onClose} className="absolute inset-0 cursor-default" />
      <div className="animate-rise relative w-full max-w-[620px] overflow-hidden rounded-t-[28px] border border-border bg-card shadow-2xl sm:rounded-[28px]">
        <div className="flex items-start justify-between border-b border-border/70 px-6 py-5 sm:px-8">
          <div>
            <p className="font-mono text-[10px] uppercase tracking-[0.19em] text-primary">Make it lighter</p>
            <h2 id="plan-dialog-title" className="mt-1 font-serif text-[30px] leading-none">What&apos;s on your plate?</h2>
            <p className="mt-2 max-w-md text-xs leading-5 text-muted-foreground">Tell Morrow the messy version. It will shape the first few steps for you.</p>
          </div>
          <button type="button" onClick={onClose} data-testid="button-dismiss-plan" aria-label="Dismiss plan composer" className="rounded-full p-2 text-muted-foreground hover:bg-muted hover:text-foreground"><X className="h-4 w-4" /></button>
        </div>
        <form onSubmit={submit} className="px-6 py-6 sm:px-8">
          <label htmlFor="plan-note" className="mb-2 block text-xs font-extrabold text-foreground">Your note</label>
          <textarea
            id="plan-note"
            value={note}
            onChange={(event) => setNote(event.target.value)}
            placeholder="I need to finish my biology lab, review for Friday's quiz, and start the history essay..."
            data-testid="input-plan-note"
            className="min-h-[132px] w-full resize-none rounded-2xl border border-input bg-background px-4 py-3 text-sm leading-6 text-foreground shadow-inner outline-none transition-colors placeholder:text-muted-foreground/65 focus:border-primary focus:ring-2 focus:ring-primary/10"
          />
          <div className="mt-5 flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
            <label className="block">
              <span className="mb-2 block text-xs font-extrabold text-foreground">Time I have each day</span>
              <span className="flex items-center gap-2">
                <input
                  type="number"
                  min={15}
                  max={480}
                  step={15}
                  value={availableMinutes}
                  onChange={(event) => setAvailableMinutes(event.target.value)}
                  data-testid="input-available-minutes"
                  className="w-[92px] rounded-xl border border-input bg-background px-3 py-2.5 font-mono text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/10"
                />
                <span className="text-xs text-muted-foreground">minutes</span>
              </span>
            </label>
            {error ? <p className="max-w-[220px] text-xs font-semibold leading-5 text-destructive" data-testid="status-plan-error">We couldn&apos;t shape that plan. Try once more.</p> : null}
            <button
              type="submit"
              disabled={createStudyPlan.isPending || note.trim().length < 3}
              data-testid="button-submit-plan"
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-primary px-5 py-3 text-xs font-extrabold text-primary-foreground transition-transform hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {createStudyPlan.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
              {createStudyPlan.isPending ? 'Finding the first steps...' : 'Shape my plan'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function PlanResult({
  plan,
  onTaskUpdate,
  pendingTaskId,
}: {
  plan: StudyPlan;
  onTaskUpdate: (task: StudyTask) => void;
  pendingTaskId: number | null;
}) {
  const tasks = useMemo(() => [...plan.tasks].sort((a, b) => a.sortOrder - b.sortOrder), [plan.tasks]);
  return (
    <section className="animate-rise rounded-2xl border border-secondary/60 bg-secondary/10 p-5 sm:p-6" data-testid="section-generated-plan">
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-primary">
            <Sparkles className="h-4 w-4" />
            <p className="font-mono text-[10px] font-medium uppercase tracking-[0.17em]">A plan for right now</p>
          </div>
          <h2 className="mt-2 font-serif text-[25px] leading-tight">Start small. Keep going.</h2>
        </div>
        <span className="hidden rounded-full bg-card px-3 py-1 font-mono text-[9px] text-muted-foreground sm:block">{plan.sessions.length} sessions shaped</span>
      </div>
      <p className="mt-3 max-w-2xl text-sm leading-6 text-muted-foreground" data-testid="text-plan-summary">{plan.summary}</p>
      <div className="mt-5 grid gap-2">
        {tasks.length ? tasks.map((task) => {
          const done = task.status === 'done';
          return (
            <button
              key={task.id}
              type="button"
              disabled={pendingTaskId === task.id}
              onClick={() => onTaskUpdate(task)}
              data-testid={`button-toggle-task-${task.id}`}
              className="flex items-center gap-3 rounded-xl border border-border/70 bg-card px-3 py-3 text-left transition-colors hover:border-primary/30 hover:bg-card/80 disabled:opacity-60"
            >
              <span className={`grid h-6 w-6 shrink-0 place-items-center rounded-full border ${done ? 'animate-check-pop border-primary bg-primary text-primary-foreground' : 'border-border text-transparent'}`}>
                {pendingTaskId === task.id ? <Loader2 className="h-3 w-3 animate-spin text-primary" /> : <Check className="h-3 w-3" strokeWidth={3} />}
              </span>
              <span className={`min-w-0 flex-1 text-xs font-bold ${done ? 'text-muted-foreground line-through' : 'text-foreground'}`}>{task.title}</span>
              <span className="font-mono text-[10px] text-muted-foreground">{minutesLabel(task.durationMinutes)}</span>
            </button>
          );
        }) : <p className="rounded-xl bg-card px-4 py-3 text-xs text-muted-foreground">Your sessions are ready on the dashboard.</p>}
      </div>
    </section>
  );
}

function LoadingDashboard() {
  return (
    <div className="space-y-7" data-testid="state-dashboard-loading">
      <div className="space-y-3"><div className="h-3 w-32 animate-pulse rounded bg-muted" /><div className="h-12 w-80 max-w-full animate-pulse rounded-xl bg-muted" /><div className="h-4 w-60 animate-pulse rounded bg-muted" /></div>
      <div className="h-[280px] animate-pulse rounded-[24px] bg-primary/15" />
      <div className="grid gap-6 lg:grid-cols-[1.12fr_.88fr]"><div className="h-72 animate-pulse rounded-2xl bg-muted" /><div className="h-72 animate-pulse rounded-2xl bg-muted" /></div>
    </div>
  );
}

function ErrorDashboard({ onRetry }: { onRetry: () => void }) {
  return (
    <div className="grid min-h-[60vh] place-items-center rounded-2xl border border-border bg-card p-8 text-center" data-testid="state-dashboard-error">
      <div className="max-w-sm">
        <span className="mx-auto grid h-12 w-12 place-items-center rounded-2xl bg-accent/15 text-accent"><RefreshCcw className="h-5 w-5" /></span>
        <h2 className="mt-5 font-serif text-3xl">The plan took a breather.</h2>
        <p className="mt-2 text-sm leading-6 text-muted-foreground">We couldn&apos;t load your day. Your work is safe — give it another try.</p>
        <button type="button" onClick={onRetry} data-testid="button-retry-dashboard" className="mt-5 inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-xs font-extrabold text-primary-foreground hover:-translate-y-0.5">Try again <ArrowRight className="h-3.5 w-3.5" /></button>
      </div>
    </div>
  );
}

export default function Dashboard() {
  const queryClient = useQueryClient();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [composerOpen, setComposerOpen] = useState(false);
  const [generatedPlan, setGeneratedPlan] = useState<StudyPlan | null>(null);
  const [rescheduleId, setRescheduleId] = useState<number | null>(null);
  const [rescheduleDate, setRescheduleDate] = useState('');
  const [pendingTaskId, setPendingTaskId] = useState<number | null>(null);
  const dashboardQuery = useGetPlannerDashboard({ query: { queryKey: getGetPlannerDashboardQueryKey() } });
  const healthQuery = useHealthCheck({ query: { queryKey: getHealthCheckQueryKey(), staleTime: 30000 } });
  const completeSession = useCompleteStudySession();
  const rescheduleSession = useRescheduleStudySession();
  const updateTask = useUpdatePlannerTask();
  const dashboard = dashboardQuery.data;

  const invalidateDashboard = () => {
    queryClient.invalidateQueries({ queryKey: getGetPlannerDashboardQueryKey() });
  };

  const complete = (id: number) => {
    completeSession.mutate({ id }, { onSuccess: invalidateDashboard });
  };

  const openReschedule = (session: StudySession) => {
    setRescheduleId(session.id);
    setRescheduleDate(session.date);
  };

  const moveSession = () => {
    if (rescheduleId === null || !rescheduleDate) return;
    rescheduleSession.mutate({ id: rescheduleId, data: { date: rescheduleDate } }, {
      onSuccess: () => {
        setRescheduleId(null);
        invalidateDashboard();
      },
    });
  };

  const handleTaskUpdate = (task: StudyTask) => {
    const nextStatus = task.status === 'done' ? 'todo' : 'done';
    setPendingTaskId(task.id);
    updateTask.mutate({ id: task.id, data: { status: nextStatus } }, {
      onSuccess: (updatedTask) => {
        setGeneratedPlan((previous) => previous ? { ...previous, tasks: previous.tasks.map((item) => item.id === updatedTask.id ? updatedTask : item) } : previous);
        setPendingTaskId(null);
        invalidateDashboard();
      },
      onError: () => setPendingTaskId(null),
    });
  };

  if (dashboardQuery.isLoading) {
    return (
      <div className="app-shell flex min-h-[100dvh] bg-background">
        <Sidebar mobileOpen={false} onClose={() => undefined} onPlan={() => setComposerOpen(true)} />
        <main className="min-w-0 flex-1"><Topbar onMenu={() => setMobileOpen(true)} healthOk={false} /><div className="mx-auto max-w-[1260px] p-5 sm:p-8 lg:p-10"><LoadingDashboard /></div></main>
        <PlanComposer open={composerOpen} onClose={() => setComposerOpen(false)} onCreated={setGeneratedPlan} />
      </div>
    );
  }

  if (dashboardQuery.isError || !dashboard) {
    return (
      <div className="app-shell flex min-h-[100dvh] bg-background">
        <Sidebar mobileOpen={mobileOpen} onClose={() => setMobileOpen(false)} onPlan={() => setComposerOpen(true)} />
        <main className="min-w-0 flex-1"><Topbar onMenu={() => setMobileOpen(true)} healthOk={Boolean(healthQuery.data)} /><div className="mx-auto max-w-[1260px] p-5 sm:p-8 lg:p-10"><ErrorDashboard onRetry={() => dashboardQuery.refetch()} /></div></main>
        <PlanComposer open={composerOpen} onClose={() => setComposerOpen(false)} onCreated={setGeneratedPlan} />
      </div>
    );
  }

  const todaySessions = dashboard.todaySessions ?? [];
  const assignments = dashboard.upcomingAssignments ?? [];

  return (
    <div className="app-shell flex min-h-[100dvh] bg-background">
      <Sidebar mobileOpen={mobileOpen} onClose={() => setMobileOpen(false)} onPlan={() => setComposerOpen(true)} />
      <main className="min-w-0 flex-1">
        <Topbar onMenu={() => setMobileOpen(true)} healthOk={Boolean(healthQuery.data)} />
        <div className="mx-auto max-w-[1260px] p-5 sm:p-8 lg:p-10">
          <div className="animate-rise mb-8 flex flex-col justify-between gap-5 sm:flex-row sm:items-end">
            <div>
              <p className="font-mono text-[10px] uppercase tracking-[0.19em] text-primary" data-testid="text-date-label">{dashboard.dateLabel}</p>
              <h1 className="mt-2 font-serif text-[42px] leading-[.95] tracking-tight text-foreground sm:text-[52px]" data-testid="text-greeting">{dashboard.greeting}</h1>
              <p className="mt-3 max-w-lg text-sm leading-6 text-muted-foreground">Let&apos;s make the next hour feel a little more possible.</p>
            </div>
            <button
              type="button"
              onClick={() => setComposerOpen(true)}
              data-testid="button-open-plan"
              className="group inline-flex w-fit items-center gap-2 rounded-xl border border-primary bg-primary px-4 py-3 text-xs font-extrabold text-primary-foreground shadow-sm transition-transform hover:-translate-y-0.5"
            >
              <Plus className="h-4 w-4 transition-transform group-hover:rotate-90" /> Make a plan
            </button>
          </div>

          <section id="today-section" className="animate-rise delay-1 scroll-mt-6">
            <FocusCard
              focus={dashboard.todayFocus}
              pending={completeSession.isPending}
              onComplete={() => dashboard.todayFocus && complete(dashboard.todayFocus.sessionId)}
              onReschedule={() => {
                if (!dashboard.todayFocus) return;
                const match = todaySessions.find((session) => session.id === dashboard.todayFocus?.sessionId);
                if (match) openReschedule(match);
              }}
            />
          </section>

          {rescheduleId !== null ? (
            <div className="mt-4 flex flex-col gap-3 rounded-2xl border border-secondary/60 bg-secondary/10 px-4 py-3 sm:flex-row sm:items-center sm:justify-between" data-testid="panel-reschedule">
              <div className="flex items-center gap-2.5 text-xs font-semibold text-foreground"><CalendarDays className="h-4 w-4 text-primary" /> Pick a new day for this session</div>
              <div className="flex items-center gap-2">
                <input type="date" value={rescheduleDate} onChange={(event) => setRescheduleDate(event.target.value)} data-testid="input-reschedule-date" className="rounded-lg border border-input bg-card px-2.5 py-2 font-mono text-[10px] outline-none focus:border-primary" />
                <button type="button" disabled={rescheduleSession.isPending} onClick={moveSession} data-testid="button-confirm-reschedule" className="rounded-lg bg-primary px-3 py-2 text-[10px] font-extrabold text-primary-foreground disabled:opacity-50">{rescheduleSession.isPending ? 'Moving...' : 'Move session'}</button>
                <button type="button" onClick={() => setRescheduleId(null)} data-testid="button-cancel-reschedule" aria-label="Cancel reschedule" className="rounded-lg p-2 text-muted-foreground hover:bg-card"><X className="h-3.5 w-3.5" /></button>
              </div>
            </div>
          ) : null}

          <div className="mt-9 grid gap-7 lg:grid-cols-[1.12fr_.88fr]">
            <section className="animate-rise delay-2" data-testid="section-today-sessions">
              <SectionHeading eyebrow="On the desk today" title="Your sessions" action={todaySessions.length ? 'Reset view' : undefined} onAction={() => window.scrollTo({ top: 0, behavior: 'smooth' })} />
              <div className="rounded-2xl border border-border/80 bg-card px-5 shadow-sm">
                {todaySessions.length ? todaySessions.map((session) => (
                  <SessionRow
                    key={session.id}
                    session={session}
                    pending={completeSession.isPending}
                    onComplete={() => complete(session.id)}
                    onReschedule={() => openReschedule(session)}
                  />
                )) : (
                  <div className="flex min-h-[174px] flex-col items-center justify-center px-4 text-center" data-testid="state-sessions-empty">
                    <span className="grid h-10 w-10 place-items-center rounded-xl bg-secondary/20 text-primary"><Target className="h-4 w-4" /></span>
                    <p className="mt-3 text-sm font-bold">A clear day is a good day.</p>
                    <p className="mt-1 max-w-xs text-xs leading-5 text-muted-foreground">Make a plan to turn one of your deadlines into a next action.</p>
                  </div>
                )}
              </div>
            </section>
            <section className="animate-rise delay-3" id="assignments-section" data-testid="section-upcoming-assignments">
              <SectionHeading eyebrow="Keep it in sight" title="Coming up" />
              <div className="rounded-2xl border border-border/80 bg-card px-5 shadow-sm">
                {assignments.length ? assignments.slice(0, 4).map((assignment) => <AssignmentRow key={assignment.id} assignment={assignment} />) : (
                  <div className="flex min-h-[174px] flex-col items-center justify-center px-4 text-center" data-testid="state-assignments-empty">
                    <span className="grid h-10 w-10 place-items-center rounded-xl bg-secondary/20 text-primary"><Inbox className="h-4 w-4" /></span>
                    <p className="mt-3 text-sm font-bold">Nothing due yet.</p>
                    <p className="mt-1 text-xs text-muted-foreground">That&apos;s a nice place to be.</p>
                  </div>
                )}
              </div>
            </section>
          </div>

          <section className="mt-9 animate-rise delay-3" id="week-section" data-testid="section-weekly-rhythm">
            <SectionHeading eyebrow="Minutes, not guilt" title="A week you can see" />
            <div className="grid gap-6 lg:grid-cols-[1.15fr_.85fr]">
              <Workload days={dashboard.workload ?? []} />
              <div className="rounded-2xl border border-border/80 bg-primary p-5 text-primary-foreground shadow-sm sm:p-6">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="font-mono text-[10px] uppercase tracking-[0.17em] text-primary-foreground/55">Your quiet progress</p>
                    <h3 className="mt-2 font-serif text-[27px]">Keep the thread.</h3>
                  </div>
                  <Flame className="h-5 w-5 text-secondary" />
                </div>
                <div className="mt-8 grid grid-cols-3 divide-x divide-primary-foreground/15">
                  <div className="pr-3"><p className="font-serif text-3xl text-secondary">{minutesLabel(dashboard.totalMinutesThisWeek)}</p><p className="mt-1 text-[10px] text-primary-foreground/55">planned this week</p></div>
                  <div className="px-3"><p className="font-serif text-3xl">{dashboard.completedSessions}</p><p className="mt-1 text-[10px] text-primary-foreground/55">sessions complete</p></div>
                  <div className="pl-3"><p className="font-serif text-3xl text-secondary">{dashboard.streakDays}</p><p className="mt-1 text-[10px] text-primary-foreground/55">day streak</p></div>
                </div>
                <div className="mt-8 flex items-center gap-2 border-t border-primary-foreground/15 pt-4 text-xs text-primary-foreground/65"><Leaf className="h-3.5 w-3.5 text-secondary" /> Consistency beats catching up.</div>
              </div>
            </div>
          </section>

          {generatedPlan ? (
            <div className="mt-9">
              <PlanResult plan={generatedPlan} onTaskUpdate={handleTaskUpdate} pendingTaskId={pendingTaskId} />
            </div>
          ) : null}

          <footer className="mt-12 flex flex-col justify-between gap-2 border-t border-border/70 py-6 text-[10px] text-muted-foreground sm:flex-row">
            <span>Morrow is here for the next right-sized step.</span>
            <span className="font-mono uppercase tracking-[0.13em]">Built for better tomorrows</span>
          </footer>
        </div>
      </main>
      <PlanComposer open={composerOpen} onClose={() => setComposerOpen(false)} onCreated={(plan) => { setGeneratedPlan(plan); invalidateDashboard(); }} />
    </div>
  );
}