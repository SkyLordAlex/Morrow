import { type ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Leaf } from 'lucide-react';
import { ErrorBoundary } from '@/components/error-boundary';
import { Toaster } from '@/components/ui/toaster';
import { TooltipProvider } from '@/components/ui/tooltip';
import { AuthProvider, useAuth } from '@/auth/auth-context';
import NotFound from '@/pages/not-found';
import Dashboard from '@/pages/dashboard';
import Reviews from '@/pages/reviews';
import Admin from '@/pages/admin';
import SignIn from '@/pages/sign-in';
import { Privacy, Terms } from '@/pages/legal';
import {
  Route,
  Switch,
  useLocation,
  Router as WouterRouter,
} from 'wouter';

const queryClient = new QueryClient();

function Router() {
  return (
    // Keep a shared shell (sidebar, navbar) outside the boundary so it
    // survives a page crash.
    <RoutedErrorBoundary>
      <Switch>
        <Route path="/" component={Dashboard} />
        <Route path="/reviews" component={Reviews} />
        <Route path="/admin" component={Admin} />
        <Route component={NotFound} />
      </Switch>
    </RoutedErrorBoundary>
  );
}

function RoutedErrorBoundary({ children }: { children: ReactNode }) {
  const [location] = useLocation();
  return <ErrorBoundary resetKey={location}>{children}</ErrorBoundary>;
}

function AuthGate() {
  const { status } = useAuth();
  const [location] = useLocation();

  // Legal pages are reachable without an account — the sign-in screen links them.
  if (location === '/terms') return <Terms />;
  if (location === '/privacy') return <Privacy />;

  if (status === 'loading') {
    return (
      <div className="flex min-h-[100dvh] items-center justify-center bg-background">
        <span className="grid h-11 w-11 animate-pulse place-items-center rounded-[13px] bg-primary text-primary-foreground">
          <Leaf className="h-5 w-5" strokeWidth={2.5} />
        </span>
      </div>
    );
  }

  if (status === 'unauthenticated') {
    return <SignIn />;
  }

  return <Router />;
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <AuthProvider>
          <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, '')}>
            <AuthGate />
          </WouterRouter>
          <Toaster />
        </AuthProvider>
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
