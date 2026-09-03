import { useEffect, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Loader2, Star, Trash2 } from 'lucide-react';
import {
  getListReviewsQueryKey,
  useDeleteMyReview,
  useDeleteReview,
  useListReviews,
  useUpsertMyReview,
  type Review,
} from '@workspace/api-client-react';
import { AppShell } from '@/components/app-shell';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/auth/auth-context';

function Stars({
  value,
  onChange,
  size = 18,
}: {
  value: number;
  onChange?: (next: number) => void;
  size?: number;
}) {
  const interactive = Boolean(onChange);
  return (
    <div className="flex items-center gap-0.5" role={interactive ? 'radiogroup' : undefined}>
      {[1, 2, 3, 4, 5].map((n) => (
        <button
          key={n}
          type="button"
          disabled={!interactive}
          onClick={() => onChange?.(n)}
          aria-label={`${n} star${n > 1 ? 's' : ''}`}
          aria-checked={interactive ? value === n : undefined}
          role={interactive ? 'radio' : undefined}
          data-testid={interactive ? `star-${n}` : undefined}
          className={interactive ? 'transition-transform hover:scale-110' : 'cursor-default'}
        >
          <Star
            style={{ width: size, height: size }}
            className={
              n <= value
                ? 'fill-secondary text-secondary'
                : 'fill-transparent text-muted-foreground/40'
            }
          />
        </button>
      ))}
    </div>
  );
}

function formatDate(iso: string) {
  const parsed = new Date(iso);
  return Number.isNaN(parsed.getTime())
    ? ''
    : parsed.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      });
}

function ReviewCard({
  review,
  onModerate,
}: {
  review: Review;
  onModerate?: () => void;
}) {
  return (
    <div
      className="border-b border-border/70 py-5 last:border-b-0"
      data-testid={`review-${review.id}`}
    >
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <span className="text-sm font-bold text-foreground">
            {review.authorName || 'A student'}
          </span>
          {review.mine ? (
            <span className="rounded-full bg-secondary/20 px-2 py-0.5 text-[10px] font-extrabold uppercase tracking-wide text-primary">
              You
            </span>
          ) : null}
        </div>
        <div className="flex items-center gap-2">
          <span className="font-mono text-[10px] text-muted-foreground">
            {formatDate(review.createdAt)}
          </span>
          {onModerate && !review.mine ? (
            <button
              type="button"
              onClick={onModerate}
              data-testid={`button-moderate-review-${review.id}`}
              className="text-[10px] font-bold text-muted-foreground hover:text-destructive"
            >
              Remove
            </button>
          ) : null}
        </div>
      </div>
      <div className="mt-1.5">
        <Stars value={review.rating} size={14} />
      </div>
      {review.body ? (
        <p className="mt-2 text-sm leading-6 text-muted-foreground">
          {review.body}
        </p>
      ) : null}
    </div>
  );
}

function YourReview({ mine }: { mine: Review | null }) {
  const queryClient = useQueryClient();
  const upsert = useUpsertMyReview();
  const remove = useDeleteMyReview();
  const [rating, setRating] = useState(mine?.rating ?? 0);
  const [body, setBody] = useState(mine?.body ?? '');

  useEffect(() => {
    setRating(mine?.rating ?? 0);
    setBody(mine?.body ?? '');
  }, [mine?.id, mine?.rating, mine?.body]);

  const invalidate = () =>
    queryClient.invalidateQueries({ queryKey: getListReviewsQueryKey() });

  const save = () => {
    if (rating < 1) return;
    upsert.mutate(
      { data: { rating, body: body.trim() || undefined } },
      { onSuccess: invalidate },
    );
  };

  const dirty =
    rating !== (mine?.rating ?? 0) || body.trim() !== (mine?.body ?? '');

  return (
    <div className="rounded-2xl border border-border/80 bg-card p-5 shadow-sm sm:p-6">
      <p className="font-mono text-[10px] uppercase tracking-[0.17em] text-primary">
        {mine ? 'Your review' : 'Rate Morrow'}
      </p>
      <h2 className="mt-1 font-serif text-[24px]">
        {mine ? 'Update how it’s going' : 'How’s it working for you?'}
      </h2>

      <div className="mt-4">
        <Stars value={rating} onChange={setRating} size={26} />
      </div>

      <textarea
        value={body}
        onChange={(event) => setBody(event.target.value)}
        maxLength={2000}
        placeholder="What’s working, what isn’t? (optional)"
        data-testid="input-review-body"
        className="mt-4 min-h-[96px] w-full resize-none rounded-xl border border-input bg-background px-3 py-2.5 text-sm leading-6 outline-none focus:border-primary focus:ring-2 focus:ring-primary/10"
      />

      {upsert.isError ? (
        <p className="mt-2 text-xs font-semibold text-destructive">
          Couldn’t save that — pick a rating and try again.
        </p>
      ) : null}

      <div className="mt-4 flex items-center gap-3">
        <Button
          type="button"
          onClick={save}
          disabled={rating < 1 || upsert.isPending || (Boolean(mine) && !dirty)}
          data-testid="button-save-review"
        >
          {upsert.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
          {mine ? 'Save changes' : 'Post review'}
        </Button>
        {mine ? (
          <button
            type="button"
            onClick={() => remove.mutate(undefined, { onSuccess: invalidate })}
            disabled={remove.isPending}
            data-testid="button-delete-review"
            className="inline-flex items-center gap-1.5 text-xs font-bold text-muted-foreground hover:text-destructive"
          >
            <Trash2 className="h-3.5 w-3.5" />
            Delete
          </button>
        ) : null}
      </div>
    </div>
  );
}

export default function Reviews() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const query = useListReviews({
    query: { queryKey: getListReviewsQueryKey() },
  });
  const moderate = useDeleteReview();
  const summary = query.data;

  const removeAsAdmin = (id: number) =>
    moderate.mutate(
      { id },
      {
        onSuccess: () =>
          queryClient.invalidateQueries({
            queryKey: getListReviewsQueryKey(),
          }),
      },
    );

  return (
    <AppShell active="reviews">
      <div className="animate-rise mb-8">
        <p className="font-mono text-[10px] uppercase tracking-[0.19em] text-primary">
          What students say
        </p>
        <h1 className="mt-2 font-serif text-[42px] leading-[.95] tracking-tight text-foreground sm:text-[48px]">
          Reviews
        </h1>
        {summary && summary.count > 0 ? (
          <div className="mt-3 flex items-center gap-3">
            <span className="font-serif text-[28px] text-foreground">
              {summary.average.toFixed(1)}
            </span>
            <Stars value={Math.round(summary.average)} size={18} />
            <span className="text-sm text-muted-foreground">
              {summary.count} review{summary.count === 1 ? '' : 's'}
            </span>
          </div>
        ) : (
          <p className="mt-3 max-w-lg text-sm leading-6 text-muted-foreground">
            No reviews yet — be the first to say how Morrow is working for you.
          </p>
        )}
      </div>

      <div className="grid gap-7 lg:grid-cols-[.9fr_1.1fr]">
        <YourReview mine={summary?.myReview ?? null} />

        <div>
          <p className="mb-3 font-mono text-[10px] uppercase tracking-[0.17em] text-muted-foreground">
            Everyone else
          </p>
          <div className="rounded-2xl border border-border/80 bg-card px-5 shadow-sm">
            {query.isLoading ? (
              <div className="flex min-h-[160px] items-center justify-center">
                <Loader2 className="h-5 w-5 animate-spin text-primary" />
              </div>
            ) : summary && summary.reviews.length > 0 ? (
              summary.reviews.map((review) => (
                <ReviewCard
                  key={review.id}
                  review={review}
                  onModerate={
                    user?.role === 'admin'
                      ? () => removeAsAdmin(review.id)
                      : undefined
                  }
                />
              ))
            ) : (
              <div className="flex min-h-[160px] items-center justify-center px-4 text-center">
                <p className="max-w-xs text-xs leading-5 text-muted-foreground">
                  When students leave reviews, they’ll show up here.
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </AppShell>
  );
}
