import { ArrowRight, CalendarDays, Leaf, Loader2 } from 'lucide-react';
import { useGetSharedPlan } from '@workspace/api-client-react';

const accentLine: Record<string, string> = {
  amber: '#E3B35D',
  coral: '#E99B87',
  blue: '#8FC4C8',
  violet: '#B6A0BF',
  sage: '#9CC4AF',
  green: '#9CC4AF',
  indigo: '#A6A8DA',
};

function lineFor(accent: string) {
  return accentLine[accent?.toLowerCase()] ?? accentLine.indigo;
}

function minutesLabel(minutes: number) {
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return rest ? `${hours}h ${rest}m` : `${hours}h`;
}

function clockLabel(time: string) {
  const [h, m = '00'] = time.split(':');
  const hour = Number(h);
  if (Number.isNaN(hour)) return time;
  const suffix = hour >= 12 ? 'PM' : 'AM';
  return `${hour % 12 || 12}:${m} ${suffix}`;
}

function dayLabel(dateKey: string) {
  const parsed = new Date(`${dateKey}T12:00:00`);
  return Number.isNaN(parsed.getTime())
    ? dateKey
    : parsed.toLocaleDateString('en-US', {
        weekday: 'long',
        month: 'short',
        day: 'numeric',
      });
}

function StartCta() {
  return (
    <a
      href={import.meta.env.BASE_URL}
      data-testid="link-make-your-own"
      className="group flex items-center justify-between gap-4 rounded-2xl bg-primary px-6 py-5 text-primary-foreground shadow-lg shadow-primary/10 transition-transform hover:-translate-y-0.5"
    >
      <span>
        <span className="block font-serif text-[22px] leading-tight">
          Plan your own week
        </span>
        <span className="mt-1 block text-xs text-primary-foreground/70">
          One note in, a gentle schedule out. Free.
        </span>
      </span>
      <ArrowRight className="h-5 w-5 shrink-0 transition-transform group-hover:translate-x-1" />
    </a>
  );
}

export default function SharedPlan({ token }: { token: string }) {
  const query = useGetSharedPlan(token, {
    query: { queryKey: ['shared', token] },
  });

  const plan = query.data;

  // The API serialises `date` as a full ISO timestamp; work in day keys.
  const byDay = new Map<string, NonNullable<typeof plan>['upcoming']>();
  for (const session of plan?.upcoming ?? []) {
    const day = session.date.slice(0, 10);
    const list = byDay.get(day) ?? [];
    list.push(session);
    byDay.set(day, list);
  }

  return (
    <div className="min-h-[100dvh] bg-background px-5 py-10">
      <div className="mx-auto w-full max-w-[560px]">
        <header className="mb-8 flex items-center gap-2.5">
          <span className="grid h-9 w-9 place-items-center rounded-[11px] bg-primary text-primary-foreground shadow-sm">
            <Leaf className="h-[18px] w-[18px]" strokeWidth={2.5} />
          </span>
          <span className="font-serif text-[20px] leading-none text-foreground">
            Morrow
          </span>
        </header>

        {query.isLoading ? (
          <div className="flex h-40 items-center justify-center">
            <Loader2 className="h-5 w-5 animate-spin text-primary" />
          </div>
        ) : query.isError || !plan ? (
          <div className="rounded-2xl border border-border bg-card p-8 text-center">
            <h1 className="font-serif text-2xl">This link isn&apos;t active.</h1>
            <p className="mt-2 text-sm text-muted-foreground">
              The plan may have been unshared. You can still make your own.
            </p>
            <div className="mt-6">
              <StartCta />
            </div>
          </div>
        ) : (
          <>
            <div className="mb-7">
              <p className="font-mono text-[10px] uppercase tracking-[0.19em] text-primary">
                A shared study plan
              </p>
              <h1 className="mt-2 font-serif text-[38px] leading-[.95] tracking-tight text-foreground">
                {plan.ownerName ? `${plan.ownerName}’s plan` : 'A study plan'}
              </h1>
            </div>

            {plan.assignments.length > 0 ? (
              <section className="mb-7">
                <p className="mb-3 font-mono text-[10px] uppercase tracking-[0.17em] text-muted-foreground">
                  Working on
                </p>
                <div className="rounded-2xl border border-border/80 bg-card px-5 shadow-sm">
                  {plan.assignments.map((assignment, index) => (
                    <div
                      key={`${assignment.title}-${index}`}
                      className="flex items-center gap-3 border-b border-border/70 py-4 last:border-b-0"
                    >
                      <span
                        className="h-9 w-1 rounded-full"
                        style={{ backgroundColor: lineFor(assignment.accent) }}
                      />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-[13px] font-bold text-foreground">
                          {assignment.title}
                        </p>
                        <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-muted">
                          <div
                            className="h-full rounded-full bg-primary/70"
                            style={{ width: `${assignment.progress}%` }}
                          />
                        </div>
                      </div>
                      <span className="shrink-0 font-mono text-[10px] text-muted-foreground">
                        {assignment.dueLabel}
                      </span>
                    </div>
                  ))}
                </div>
              </section>
            ) : null}

            {byDay.size > 0 ? (
              <section className="mb-8">
                <p className="mb-3 font-mono text-[10px] uppercase tracking-[0.17em] text-muted-foreground">
                  Coming up
                </p>
                <div className="space-y-4">
                  {[...byDay.entries()].map(([date, sessions]) => (
                    <div key={date}>
                      <p className="mb-1.5 flex items-center gap-1.5 text-xs font-bold text-foreground">
                        <CalendarDays className="h-3.5 w-3.5 text-primary" />
                        {dayLabel(date)}
                      </p>
                      <div className="rounded-xl border border-border/80 bg-card px-4 shadow-sm">
                        {sessions.map((session, index) => (
                          <div
                            key={`${session.title}-${index}`}
                            className="flex items-center gap-3 border-b border-border/60 py-2.5 last:border-b-0"
                          >
                            <span
                              className="h-1.5 w-1.5 shrink-0 rounded-full"
                              style={{ backgroundColor: lineFor(session.accent) }}
                            />
                            <span className="min-w-0 flex-1 truncate text-[12px] font-semibold text-foreground">
                              {session.title}
                            </span>
                            <span className="shrink-0 font-mono text-[10px] text-muted-foreground">
                              {clockLabel(session.startTime)} ·{' '}
                              {minutesLabel(session.durationMinutes)}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            ) : null}

            {plan.assignments.length === 0 && byDay.size === 0 ? (
              <p className="mb-8 rounded-2xl border border-border bg-card p-6 text-center text-sm text-muted-foreground">
                Nothing scheduled here right now.
              </p>
            ) : null}

            <StartCta />
          </>
        )}
      </div>
    </div>
  );
}
