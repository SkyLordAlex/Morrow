import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Loader2, ShieldCheck, ShieldOff, Trash2 } from 'lucide-react';
import {
  getGetAdminStatsQueryKey,
  getListAdminUsersQueryKey,
  getListReviewsQueryKey,
  useGetAdminStats,
  useListAdminUsers,
  useListReviews,
  useSetUserRole,
  useDeleteReview,
  useDeleteUser,
  type AdminUser,
} from '@workspace/api-client-react';
import { AppShell } from '@/components/app-shell';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/auth/auth-context';

function StatTile({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="rounded-2xl border border-border/80 bg-card p-4 shadow-sm">
      <p className="font-serif text-[28px] leading-none text-foreground">
        {value}
      </p>
      <p className="mt-1.5 font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
        {label}
      </p>
    </div>
  );
}

function UserRow({
  user,
  selfId,
}: {
  user: AdminUser;
  selfId: number | undefined;
}) {
  const queryClient = useQueryClient();
  const setRole = useSetUserRole();
  const deleteUser = useDeleteUser();
  const [confirming, setConfirming] = useState(false);
  const isSelf = user.id === selfId;
  const nextRole = user.role === 'admin' ? 'user' : 'admin';

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: getListAdminUsersQueryKey() });
    queryClient.invalidateQueries({ queryKey: getGetAdminStatsQueryKey() });
  };

  const toggle = () =>
    setRole.mutate(
      { id: user.id, data: { role: nextRole } },
      { onSuccess: invalidate },
    );

  const remove = () =>
    deleteUser.mutate({ id: user.id }, { onSuccess: invalidate });

  return (
    <div
      className="flex items-center gap-3 border-b border-border/70 py-3 last:border-b-0"
      data-testid={`admin-user-${user.id}`}
    >
      <div className="min-w-0 flex-1">
        <p className="truncate text-[13px] font-bold text-foreground">
          {user.displayName || user.email}
        </p>
        <p className="truncate text-[11px] text-muted-foreground">
          {user.email} · {user.assignmentCount} assignments · {user.reviewCount}{' '}
          reviews
        </p>
      </div>
      <span
        className={`rounded-full px-2 py-0.5 text-[10px] font-extrabold uppercase tracking-wide ${
          user.role === 'admin'
            ? 'bg-primary/15 text-primary'
            : 'bg-muted text-muted-foreground'
        }`}
      >
        {user.role}
      </span>
      <button
        type="button"
        disabled={isSelf || setRole.isPending}
        onClick={toggle}
        data-testid={`button-toggle-role-${user.id}`}
        title={isSelf ? "You can't change your own role here" : undefined}
        className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--button-outline)] px-2.5 py-1.5 text-[11px] font-bold text-foreground transition-colors hover:bg-muted disabled:opacity-40"
      >
        {user.role === 'admin' ? (
          <ShieldOff className="h-3.5 w-3.5" />
        ) : (
          <ShieldCheck className="h-3.5 w-3.5" />
        )}
        {user.role === 'admin' ? 'Make user' : 'Make admin'}
      </button>
      {isSelf ? (
        <span className="w-[76px]" />
      ) : confirming ? (
        <span className="flex items-center gap-1.5">
          <button
            type="button"
            disabled={deleteUser.isPending}
            onClick={remove}
            data-testid={`button-confirm-delete-user-${user.id}`}
            className="rounded-lg bg-destructive px-2.5 py-1.5 text-[11px] font-extrabold text-destructive-foreground disabled:opacity-50"
          >
            {deleteUser.isPending ? '…' : 'Delete'}
          </button>
          <button
            type="button"
            onClick={() => setConfirming(false)}
            className="rounded-lg px-1.5 py-1.5 text-[11px] font-bold text-muted-foreground hover:text-foreground"
          >
            Cancel
          </button>
        </span>
      ) : (
        <button
          type="button"
          onClick={() => setConfirming(true)}
          data-testid={`button-delete-user-${user.id}`}
          aria-label={`Delete ${user.email}`}
          className="rounded-lg border border-[var(--button-outline)] p-1.5 text-muted-foreground transition-colors hover:border-destructive hover:text-destructive"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      )}
    </div>
  );
}

export default function Admin() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const stats = useGetAdminStats({
    query: { queryKey: getGetAdminStatsQueryKey(), retry: false },
  });
  const users = useListAdminUsers({
    query: { queryKey: getListAdminUsersQueryKey(), retry: false },
  });
  const reviews = useListReviews({
    query: { queryKey: getListReviewsQueryKey() },
  });
  const deleteReview = useDeleteReview();

  const forbidden =
    user?.role !== 'admin' ||
    (stats.error as { status?: number } | null)?.status === 403;

  if (forbidden) {
    return (
      <AppShell active="admin">
        <div className="grid min-h-[50vh] place-items-center text-center">
          <div>
            <h1 className="font-serif text-3xl text-foreground">
              Admins only
            </h1>
            <p className="mt-2 text-sm text-muted-foreground">
              This area isn&apos;t available on your account.
            </p>
          </div>
        </div>
      </AppShell>
    );
  }

  const removeReview = (id: number) =>
    deleteReview.mutate(
      { id },
      {
        onSuccess: () =>
          queryClient.invalidateQueries({
            queryKey: getListReviewsQueryKey(),
          }),
      },
    );

  return (
    <AppShell active="admin">
      <div className="animate-rise mb-8">
        <p className="font-mono text-[10px] uppercase tracking-[0.19em] text-primary">
          Behind the scenes
        </p>
        <h1 className="mt-2 font-serif text-[42px] leading-[.95] tracking-tight text-foreground sm:text-[48px]">
          Admin
        </h1>
      </div>

      <section className="mb-9">
        {stats.data ? (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            <StatTile label="Users" value={stats.data.userCount} />
            <StatTile label="Admins" value={stats.data.adminCount} />
            <StatTile label="New this week" value={stats.data.signupsLast7Days} />
            <StatTile
              label="Avg rating"
              value={
                stats.data.reviewCount
                  ? stats.data.averageRating.toFixed(1)
                  : '—'
              }
            />
            <StatTile label="Reviews" value={stats.data.reviewCount} />
            <StatTile label="Assignments" value={stats.data.assignmentCount} />
            <StatTile label="Study sessions" value={stats.data.sessionCount} />
          </div>
        ) : (
          <div className="flex h-24 items-center">
            <Loader2 className="h-5 w-5 animate-spin text-primary" />
          </div>
        )}
      </section>

      <div className="grid gap-9 lg:grid-cols-[1.15fr_.85fr]">
        <section>
          <h2 className="mb-3 font-serif text-[24px]">Accounts</h2>
          <div className="rounded-2xl border border-border/80 bg-card px-5 shadow-sm">
            {users.isLoading ? (
              <div className="flex min-h-[120px] items-center justify-center">
                <Loader2 className="h-5 w-5 animate-spin text-primary" />
              </div>
            ) : (
              users.data?.users.map((row) => (
                <UserRow key={row.id} user={row} selfId={user?.id} />
              ))
            )}
          </div>
        </section>

        <section>
          <h2 className="mb-3 font-serif text-[24px]">Reviews</h2>
          <div className="rounded-2xl border border-border/80 bg-card px-5 shadow-sm">
            {reviews.data && reviews.data.reviews.length > 0 ? (
              reviews.data.reviews.map((review) => (
                <div
                  key={review.id}
                  className="flex items-start gap-3 border-b border-border/70 py-3.5 last:border-b-0"
                  data-testid={`admin-review-${review.id}`}
                >
                  <div className="min-w-0 flex-1">
                    <p className="text-[12px] font-bold text-foreground">
                      {review.authorName || 'A student'} · {review.rating}★
                    </p>
                    {review.body ? (
                      <p className="mt-1 text-xs leading-5 text-muted-foreground">
                        {review.body}
                      </p>
                    ) : null}
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    disabled={deleteReview.isPending}
                    onClick={() => removeReview(review.id)}
                    data-testid={`button-admin-delete-review-${review.id}`}
                    className="text-destructive"
                  >
                    Remove
                  </Button>
                </div>
              ))
            ) : (
              <div className="flex min-h-[120px] items-center justify-center px-4 text-center text-xs text-muted-foreground">
                No reviews yet.
              </div>
            )}
          </div>
        </section>
      </div>
    </AppShell>
  );
}
