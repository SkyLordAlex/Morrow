import { useMemo, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import {
  CalendarDays,
  Check,
  ChevronLeft,
  ChevronRight,
  Clock3,
  Loader2,
  X,
} from 'lucide-react';
import {
  getGetPlannerDashboardQueryKey,
  getListPlannerSessionsQueryKey,
  useCompleteStudySession,
  useListPlannerSessions,
  useRescheduleStudySession,
  type StudySession,
} from '@workspace/api-client-react';
import { AppShell } from '@/components/app-shell';
import { useWeekStart } from '@/lib/week-start';

const accentStyles: Record<string, { ink: string; soft: string; line: string }> = {
  amber: { ink: '#B36A1E', soft: '#FFF0C9', line: '#E3B35D' },
  coral: { ink: '#B84E49', soft: '#FFE2D7', line: '#E99B87' },
  blue: { ink: '#347A8D', soft: '#DDEFF1', line: '#8FC4C8' },
  violet: { ink: '#75617E', soft: '#EEE5F2', line: '#B6A0BF' },
  sage: { ink: '#4E826B', soft: '#DDEDE4', line: '#9CC4AF' },
  green: { ink: '#4E826B', soft: '#DDEDE4', line: '#9CC4AF' },
  indigo: { ink: '#5B5E9E', soft: '#E6E7F6', line: '#A6A8DA' },
};

const fallbackAccent = accentStyles.indigo;

function accentFor(value: string | undefined) {
  if (!value) return fallbackAccent;
  return accentStyles[value.toLowerCase()] ?? fallbackAccent;
}

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

function pad(n: number) {
  return String(n).padStart(2, '0');
}

/** A local "YYYY-MM-DD" key for a Date, read in the browser's own zone. */
function dateKey(date: Date) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
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

function longDate(key: string) {
  const parsed = new Date(`${key}T12:00:00`);
  return Number.isNaN(parsed.getTime())
    ? key
    : parsed.toLocaleDateString('en-US', {
        weekday: 'long',
        month: 'long',
        day: 'numeric',
      });
}

type DayCell = {
  key: string;
  day: number;
  inMonth: boolean;
  isToday: boolean;
  sessions: StudySession[];
};

function buildGrid(
  year: number,
  month: number,
  byDay: Map<string, StudySession[]>,
  todayKey: string,
  weekStart: 0 | 1,
): DayCell[] {
  const first = new Date(year, month, 1);
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const leading = (first.getDay() - weekStart + 7) % 7;
  const weeks = Math.ceil((leading + daysInMonth) / 7);
  const start = new Date(year, month, 1 - leading);
  const cells: DayCell[] = [];
  for (let i = 0; i < weeks * 7; i += 1) {
    const date = new Date(start.getFullYear(), start.getMonth(), start.getDate() + i);
    const key = dateKey(date);
    cells.push({
      key,
      day: date.getDate(),
      inMonth: date.getMonth() === month,
      isToday: key === todayKey,
      sessions: byDay.get(key) ?? [],
    });
  }
  return cells;
}

function SessionChip({ session }: { session: StudySession }) {
  const colors = accentFor(session.accent);
  const done = session.status === 'complete';
  return (
    <div
      className="flex items-center gap-1 truncate rounded-md px-1.5 py-0.5 text-[10px] font-semibold"
      style={{
        backgroundColor: done ? 'transparent' : colors.soft,
        color: done ? 'var(--muted-foreground)' : colors.ink,
        textDecoration: done ? 'line-through' : undefined,
      }}
      title={`${session.title} · ${clockLabel(session.startTime)}`}
    >
      <span
        className="h-1.5 w-1.5 shrink-0 rounded-full"
        style={{ backgroundColor: colors.line }}
      />
      <span className="truncate">{session.title}</span>
    </div>
  );
}

function DayPanel({
  dayKey,
  sessions,
  onClose,
  onComplete,
  onMove,
  pendingId,
}: {
  dayKey: string;
  sessions: StudySession[];
  onClose: () => void;
  onComplete: (id: number) => void;
  onMove: (id: number, date: string) => void;
  pendingId: number | null;
}) {
  const [movingId, setMovingId] = useState<number | null>(null);
  const [moveDate, setMoveDate] = useState(dayKey);

  const ordered = [...sessions].sort((a, b) => a.startTime.localeCompare(b.startTime));

  return (
    <div
      className="animate-rise rounded-2xl border border-border/80 bg-card p-5 shadow-sm"
      data-testid="panel-calendar-day"
    >
      <div className="flex items-start justify-between">
        <div>
          <p className="font-mono text-[10px] uppercase tracking-[0.17em] text-primary">
            {sessions.length} session{sessions.length === 1 ? '' : 's'}
          </p>
          <h3 className="mt-1 font-serif text-[22px] leading-tight">{longDate(dayKey)}</h3>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close day"
          className="rounded-full p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      {ordered.length === 0 ? (
        <p className="mt-4 text-sm text-muted-foreground">Nothing scheduled this day.</p>
      ) : (
        <ul className="mt-4 space-y-2.5">
          {ordered.map((session) => {
            const colors = accentFor(session.accent);
            const done = session.status === 'complete';
            return (
              <li
                key={session.id}
                className="rounded-xl border border-border/70 px-3 py-2.5"
                data-testid={`calendar-session-${session.id}`}
              >
                <div className="flex items-center gap-2.5">
                  <button
                    type="button"
                    disabled={done || pendingId === session.id}
                    onClick={() => onComplete(session.id)}
                    aria-label={done ? `${session.title} complete` : `Complete ${session.title}`}
                    className={`grid h-6 w-6 shrink-0 place-items-center rounded-full border transition-colors ${
                      done
                        ? 'border-primary bg-primary text-primary-foreground'
                        : 'border-border text-transparent hover:border-primary hover:bg-primary/10'
                    }`}
                  >
                    {pendingId === session.id ? (
                      <Loader2 className="h-3 w-3 animate-spin text-primary" />
                    ) : (
                      <Check className="h-3 w-3" strokeWidth={3} />
                    )}
                  </button>
                  <div className="min-w-0 flex-1">
                    <p
                      className={`truncate text-[13px] font-bold ${
                        done ? 'text-muted-foreground line-through' : 'text-foreground'
                      }`}
                    >
                      {session.title}
                    </p>
                    <p className="mt-0.5 flex items-center gap-2 text-[11px] text-muted-foreground">
                      <span
                        className="inline-block h-1.5 w-1.5 rounded-full"
                        style={{ backgroundColor: colors.line }}
                      />
                      {session.subject} · {minutesLabel(session.durationMinutes)}
                      <span className="inline-flex items-center gap-1">
                        <Clock3 className="h-3 w-3" /> {clockLabel(session.startTime)}
                      </span>
                    </p>
                  </div>
                  {!done ? (
                    <button
                      type="button"
                      onClick={() =>
                        setMovingId((current) => (current === session.id ? null : session.id))
                      }
                      className="rounded-lg px-2 py-1 text-[10px] font-bold text-muted-foreground hover:bg-muted hover:text-foreground"
                    >
                      Move
                    </button>
                  ) : null}
                </div>

                {movingId === session.id ? (
                  <div className="mt-2.5 flex items-center gap-2 border-t border-border/60 pt-2.5">
                    <input
                      type="date"
                      value={moveDate}
                      onChange={(event) => setMoveDate(event.target.value)}
                      className="rounded-lg border border-input bg-background px-2.5 py-1.5 font-mono text-[11px] outline-none focus:border-primary"
                    />
                    <button
                      type="button"
                      disabled={!moveDate || pendingId === session.id}
                      onClick={() => {
                        onMove(session.id, moveDate);
                        setMovingId(null);
                      }}
                      className="rounded-lg bg-primary px-3 py-1.5 text-[10px] font-extrabold text-primary-foreground disabled:opacity-50"
                    >
                      Move session
                    </button>
                  </div>
                ) : null}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

export default function Calendar() {
  const queryClient = useQueryClient();
  const now = new Date();
  const todayKey = dateKey(now);
  const [view, setView] = useState({ year: now.getFullYear(), month: now.getMonth() });
  const [selectedDay, setSelectedDay] = useState<string | null>(null);
  const [pendingId, setPendingId] = useState<number | null>(null);

  const sessionsQuery = useListPlannerSessions({
    query: { queryKey: getListPlannerSessionsQueryKey() },
  });
  const completeSession = useCompleteStudySession();
  const rescheduleSession = useRescheduleStudySession();
  const [weekStart] = useWeekStart();

  const weekdayHeader = useMemo(
    () => (weekStart === 1 ? [...WEEKDAYS.slice(1), WEEKDAYS[0]] : WEEKDAYS),
    [weekStart],
  );

  // The API serialises `date` as a full ISO timestamp; the calendar works in
  // plain "YYYY-MM-DD" day keys.
  const sessions = useMemo(
    () =>
      (sessionsQuery.data?.sessions ?? []).map((session) => ({
        ...session,
        date: session.date.slice(0, 10),
      })),
    [sessionsQuery.data],
  );

  const byDay = useMemo(() => {
    const map = new Map<string, StudySession[]>();
    for (const session of sessions) {
      const list = map.get(session.date) ?? [];
      list.push(session);
      map.set(session.date, list);
    }
    return map;
  }, [sessions]);

  const grid = useMemo(
    () => buildGrid(view.year, view.month, byDay, todayKey, weekStart),
    [view, byDay, todayKey, weekStart],
  );

  const monthLabel = `${MONTHS[view.month]} ${view.year}`;
  const monthSessionCount = grid.filter((c) => c.inMonth).reduce((sum, c) => sum + c.sessions.length, 0);

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: getListPlannerSessionsQueryKey() });
    queryClient.invalidateQueries({ queryKey: getGetPlannerDashboardQueryKey() });
  };

  const shiftMonth = (delta: number) => {
    setView((current) => {
      const next = new Date(current.year, current.month + delta, 1);
      return { year: next.getFullYear(), month: next.getMonth() };
    });
    setSelectedDay(null);
  };

  const goToday = () => {
    setView({ year: now.getFullYear(), month: now.getMonth() });
    setSelectedDay(todayKey);
  };

  const complete = (id: number) => {
    setPendingId(id);
    completeSession.mutate(
      { id },
      {
        onSuccess: () => {
          setPendingId(null);
          invalidate();
        },
        onError: () => setPendingId(null),
      },
    );
  };

  const move = (id: number, date: string) => {
    setPendingId(id);
    rescheduleSession.mutate(
      { id, data: { date } },
      {
        onSuccess: () => {
          setPendingId(null);
          setSelectedDay(date);
          setView((current) => {
            const target = new Date(`${date}T12:00:00`);
            return Number.isNaN(target.getTime())
              ? current
              : { year: target.getFullYear(), month: target.getMonth() };
          });
          invalidate();
        },
        onError: () => setPendingId(null),
      },
    );
  };

  return (
    <AppShell active="calendar">
      <div className="animate-rise mb-8 flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <p className="font-mono text-[10px] uppercase tracking-[0.19em] text-primary">
            Every session, laid out
          </p>
          <h1 className="mt-2 font-serif text-[42px] leading-[.95] tracking-tight text-foreground sm:text-[48px]">
            Calendar
          </h1>
          <p className="mt-3 max-w-lg text-sm leading-6 text-muted-foreground">
            {monthSessionCount > 0
              ? `${monthSessionCount} study session${monthSessionCount === 1 ? '' : 's'} this month. Tap a day to work through it.`
              : 'No sessions this month yet. Make a plan and they’ll land here.'}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => shiftMonth(-1)}
            aria-label="Previous month"
            className="rounded-lg border border-border bg-card p-2 text-muted-foreground hover:text-foreground"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={goToday}
            className="rounded-lg border border-border bg-card px-3 py-2 text-xs font-bold text-foreground hover:bg-muted"
          >
            Today
          </button>
          <button
            type="button"
            onClick={() => shiftMonth(1)}
            aria-label="Next month"
            className="rounded-lg border border-border bg-card p-2 text-muted-foreground hover:text-foreground"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1.5fr_.9fr]">
        <div className="rounded-2xl border border-border/80 bg-card p-4 shadow-sm sm:p-5">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="font-serif text-[22px]" data-testid="text-calendar-month">
              {monthLabel}
            </h2>
            <span className="grid h-8 w-8 place-items-center rounded-lg bg-secondary/25 text-primary">
              <CalendarDays className="h-4 w-4" />
            </span>
          </div>

          {sessionsQuery.isLoading ? (
            <div className="flex h-[420px] items-center justify-center">
              <Loader2 className="h-5 w-5 animate-spin text-primary" />
            </div>
          ) : (
            <>
              <div className="grid grid-cols-7 gap-1">
                {weekdayHeader.map((weekday) => (
                  <div
                    key={weekday}
                    className="pb-1 text-center font-mono text-[9px] font-medium uppercase tracking-[0.12em] text-muted-foreground"
                  >
                    {weekday}
                  </div>
                ))}
              </div>
              <div className="grid grid-cols-7 gap-1">
                {grid.map((cell) => {
                  const isSelected = cell.key === selectedDay;
                  const extra = cell.sessions.length - 3;
                  return (
                    <button
                      type="button"
                      key={cell.key}
                      onClick={() => setSelectedDay(cell.key)}
                      data-testid={`calendar-day-${cell.key}`}
                      className={`flex min-h-[54px] flex-col gap-1 rounded-lg border p-1.5 text-left transition-colors sm:min-h-[92px] ${
                        isSelected
                          ? 'border-primary bg-primary/5'
                          : 'border-border/60 hover:border-primary/40'
                      } ${cell.inMonth ? 'bg-background' : 'bg-muted/30'}`}
                    >
                      <span
                        className={`inline-flex h-5 w-5 items-center justify-center rounded-full text-[11px] font-bold ${
                          cell.isToday
                            ? 'bg-primary text-primary-foreground'
                            : cell.inMonth
                              ? 'text-foreground'
                              : 'text-muted-foreground/50'
                        }`}
                      >
                        {cell.day}
                      </span>
                      {/* Compact dots on phones, full chips from sm up. */}
                      {cell.sessions.length > 0 ? (
                        <span className="flex flex-wrap gap-1 px-0.5 sm:hidden">
                          {cell.sessions.slice(0, 4).map((session) => (
                            <span
                              key={session.id}
                              className="h-1.5 w-1.5 rounded-full"
                              style={{
                                backgroundColor:
                                  session.status === 'complete'
                                    ? 'var(--border)'
                                    : accentFor(session.accent).line,
                              }}
                            />
                          ))}
                        </span>
                      ) : null}
                      <span className="hidden flex-col gap-0.5 overflow-hidden sm:flex">
                        {cell.sessions.slice(0, 3).map((session) => (
                          <SessionChip key={session.id} session={session} />
                        ))}
                        {extra > 0 ? (
                          <span className="px-1 text-[9px] font-bold text-muted-foreground">
                            +{extra} more
                          </span>
                        ) : null}
                      </span>
                    </button>
                  );
                })}
              </div>
            </>
          )}
        </div>

        <div>
          {selectedDay ? (
            <DayPanel
              dayKey={selectedDay}
              sessions={byDay.get(selectedDay) ?? []}
              onClose={() => setSelectedDay(null)}
              onComplete={complete}
              onMove={move}
              pendingId={pendingId}
            />
          ) : (
            <div className="rounded-2xl border border-dashed border-border/70 bg-card/50 p-6 text-center">
              <span className="mx-auto grid h-10 w-10 place-items-center rounded-xl bg-secondary/20 text-primary">
                <CalendarDays className="h-4 w-4" />
              </span>
              <p className="mt-3 text-sm font-bold">Pick a day</p>
              <p className="mt-1 text-xs leading-5 text-muted-foreground">
                Select any date to see its sessions and check them off.
              </p>
            </div>
          )}
        </div>
      </div>
    </AppShell>
  );
}
