import { type ReactNode, useState } from 'react';
import { useLocation } from 'wouter';
import {
  ArrowRight,
  CalendarDays,
  Inbox,
  Leaf,
  LockKeyhole,
  Menu,
  MessageSquareHeart,
  ShieldCheck,
  Sparkles,
  Target,
  TrendingUp,
  X,
} from 'lucide-react';
import { AccountMenu } from '@/components/account-menu';
import { useAuth } from '@/auth/auth-context';

export type ShellSection =
  | 'today'
  | 'calendar'
  | 'week'
  | 'assignments'
  | 'reviews'
  | 'admin';

type NavItem = {
  label: string;
  icon: typeof Target;
  section: ShellSection;
  adminOnly?: boolean;
} & ({ href: string } | { anchor: string });

const NAV_ITEMS: NavItem[] = [
  { label: 'Today', icon: Target, section: 'today', href: '/' },
  {
    label: 'This week',
    icon: TrendingUp,
    section: 'week',
    anchor: 'week-section',
  },
  {
    label: 'Assignments',
    icon: Inbox,
    section: 'assignments',
    anchor: 'assignments-section',
  },
  { label: 'Calendar', icon: CalendarDays, section: 'calendar', href: '/calendar' },
  {
    label: 'Reviews',
    icon: MessageSquareHeart,
    section: 'reviews',
    href: '/reviews',
  },
  {
    label: 'Admin',
    icon: ShieldCheck,
    section: 'admin',
    href: '/admin',
    adminOnly: true,
  },
];

function Sidebar({
  active,
  mobileOpen,
  onClose,
  onPlan,
}: {
  active: ShellSection;
  mobileOpen: boolean;
  onClose: () => void;
  onPlan?: () => void;
}) {
  const [location, navigate] = useLocation();
  const { user } = useAuth();
  const items = NAV_ITEMS.filter(
    (item) => !item.adminOnly || user?.role === 'admin',
  );

  const go = (item: NavItem) => {
    if ('href' in item) {
      navigate(item.href);
    } else if (location === '/') {
      document
        .getElementById(item.anchor)
        ?.scrollIntoView({ behavior: 'smooth' });
    } else {
      navigate('/');
    }
    onClose();
  };

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
            onClick={() => navigate('/')}
            data-testid="button-brand-home"
            className="flex items-center gap-2.5 text-left"
          >
            <span className="grid h-9 w-9 place-items-center rounded-[11px] bg-sidebar-primary text-sidebar-primary-foreground shadow-sm">
              <Leaf className="h-[18px] w-[18px]" strokeWidth={2.5} />
            </span>
            <span>
              <span className="block font-serif text-[20px] leading-none tracking-tight text-sidebar-foreground">
                Morrow
              </span>
              <span className="mt-1 block font-mono text-[8px] uppercase tracking-[0.21em] text-sidebar-foreground/55">
                study planner
              </span>
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
          <p className="mb-3 px-3 font-mono text-[9px] uppercase tracking-[0.19em] text-sidebar-foreground/45">
            Your space
          </p>
          <nav className="space-y-1" aria-label="Planner sections">
            {items.map((item) => {
              const isActive = item.section === active;
              return (
                <button
                  key={item.label}
                  type="button"
                  onClick={() => go(item)}
                  data-testid={`button-nav-${item.label
                    .toLowerCase()
                    .replace(' ', '-')}`}
                  className={`group flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm transition-colors ${
                    isActive
                      ? 'bg-sidebar-accent text-sidebar-foreground'
                      : 'text-sidebar-foreground/58 hover:bg-sidebar-accent/70 hover:text-sidebar-foreground'
                  }`}
                >
                  <item.icon
                    className={`h-4 w-4 ${
                      isActive
                        ? 'text-sidebar-primary'
                        : 'text-sidebar-foreground/55'
                    }`}
                  />
                  <span className="font-semibold">{item.label}</span>
                  {isActive ? (
                    <span className="ml-auto h-1.5 w-1.5 rounded-full bg-sidebar-primary" />
                  ) : null}
                </button>
              );
            })}
          </nav>
        </div>

        {onPlan ? (
          <div className="mt-auto">
            <div className="rounded-2xl border border-sidebar-border bg-sidebar-accent/60 p-4">
              <div className="flex items-start justify-between">
                <span className="grid h-8 w-8 place-items-center rounded-lg bg-sidebar-primary/15 text-sidebar-primary">
                  <Sparkles className="h-4 w-4" />
                </span>
                <span className="font-mono text-[9px] uppercase tracking-[0.15em] text-sidebar-foreground/45">
                  coach
                </span>
              </div>
              <p className="mt-3 text-[13px] font-semibold leading-5 text-sidebar-foreground">
                A little structure goes a long way.
              </p>
              <p className="mt-1 text-[11px] leading-4 text-sidebar-foreground/55">
                Turn the pile in your head into your next clear step.
              </p>
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
        ) : (
          <div className="mt-auto flex items-center gap-2 px-1 text-[10px] text-sidebar-foreground/40">
            <LockKeyhole className="h-3 w-3" />
            <span>Your plans stay yours</span>
          </div>
        )}
      </aside>
    </>
  );
}

function Topbar({
  onMenu,
  healthOk,
}: {
  onMenu: () => void;
  healthOk?: boolean;
}) {
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
        {healthOk !== undefined ? (
          <div className="hidden items-center gap-2 rounded-full border border-border bg-card px-3 py-1.5 text-[10px] font-bold text-muted-foreground sm:flex">
            <span
              className={`h-1.5 w-1.5 rounded-full ${
                healthOk ? 'bg-[#6DAF89]' : 'bg-accent'
              }`}
            />
            {healthOk ? 'Planner ready' : 'Checking planner'}
          </div>
        ) : null}
        <AccountMenu />
      </div>
    </header>
  );
}

// Shared chrome (sidebar + top bar) for every full page. `onPlan` is only
// passed on the dashboard, where the plan composer lives.
export function AppShell({
  active,
  children,
  onPlan,
  healthOk,
}: {
  active: ShellSection;
  children: ReactNode;
  onPlan?: () => void;
  healthOk?: boolean;
}) {
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <div className="app-shell flex min-h-[100dvh] bg-background">
      <Sidebar
        active={active}
        mobileOpen={mobileOpen}
        onClose={() => setMobileOpen(false)}
        onPlan={onPlan}
      />
      <main className="min-w-0 flex-1">
        <Topbar onMenu={() => setMobileOpen(true)} healthOk={healthOk} />
        <div className="mx-auto max-w-[1260px] p-5 sm:p-8 lg:p-10">
          {children}
        </div>
      </main>
    </div>
  );
}
