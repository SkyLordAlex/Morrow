import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Check, Loader2, Sprout, Star, X } from 'lucide-react';
import {
  getListReviewsQueryKey,
  useListReviews,
  useUpsertMyReview,
} from '@workspace/api-client-react';

const DISMISS_KEY = 'morrow.reviewPromptDismissed';
const THRESHOLD = 3;

function dismissed(): boolean {
  try {
    return localStorage.getItem(DISMISS_KEY) === '1';
  } catch {
    return false;
  }
}

/**
 * A gentle nudge to leave a review once the student has completed a few
 * sessions. Clicking a star drops down an inline form so they can rate and
 * write a note without leaving the dashboard. Dismissible, per device.
 */
export function ReviewPrompt({ completedSessions }: { completedSessions: number }) {
  const queryClient = useQueryClient();
  const upsert = useUpsertMyReview();
  const [hidden, setHidden] = useState(dismissed);
  const [rating, setRating] = useState(0);
  const [hover, setHover] = useState(0);
  const [body, setBody] = useState('');
  const [done, setDone] = useState(false);

  const reviews = useListReviews({
    query: {
      queryKey: getListReviewsQueryKey(),
      enabled: completedSessions >= THRESHOLD && !hidden,
    },
  });

  if (completedSessions < THRESHOLD || hidden) return null;
  if (!done && (!reviews.data || reviews.data.myReview)) return null;

  const stopShowing = () => {
    try {
      localStorage.setItem(DISMISS_KEY, '1');
    } catch {
      /* ignore */
    }
    setHidden(true);
  };

  const submit = () => {
    if (rating < 1) return;
    upsert.mutate(
      { data: { rating, body: body.trim() || undefined } },
      {
        onSuccess: () => {
          setDone(true);
          queryClient.invalidateQueries({ queryKey: getListReviewsQueryKey() });
        },
      },
    );
  };

  if (done) {
    return (
      <div
        className="animate-rise mt-6 flex items-center gap-3 rounded-2xl border border-secondary/60 bg-secondary/10 px-5 py-4"
        data-testid="card-review-prompt"
      >
        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-primary text-primary-foreground">
          <Check className="h-4 w-4" />
        </span>
        <p className="text-[13px] font-bold text-foreground">
          Thanks — that really helps.
        </p>
      </div>
    );
  }

  const open = rating > 0;

  return (
    <div
      className="animate-rise mt-6 rounded-2xl border border-secondary/60 bg-secondary/10 px-5 py-4"
      data-testid="card-review-prompt"
    >
      <div className="flex items-center gap-4">
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-secondary/25 text-primary">
          <Sprout className="h-4 w-4" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-[13px] font-bold text-foreground">
            {completedSessions} sessions done — how&apos;s Morrow working for you?
          </p>
          <div
            className="mt-1.5 flex items-center gap-0.5"
            onMouseLeave={() => setHover(0)}
          >
            {[1, 2, 3, 4, 5].map((n) => {
              const filled = n <= (hover || rating);
              return (
                <button
                  key={n}
                  type="button"
                  aria-label={`Rate ${n} star${n > 1 ? 's' : ''}`}
                  aria-pressed={rating === n}
                  onMouseEnter={() => setHover(n)}
                  onClick={() => setRating(n)}
                  data-testid={`review-prompt-star-${n}`}
                  className="transition-transform hover:scale-110"
                >
                  <Star
                    className={`h-5 w-5 ${
                      filled
                        ? 'fill-secondary text-secondary'
                        : 'fill-transparent text-muted-foreground/40'
                    }`}
                  />
                </button>
              );
            })}
          </div>
        </div>
        <button
          type="button"
          onClick={stopShowing}
          aria-label="Dismiss"
          data-testid="button-dismiss-review-prompt"
          className="shrink-0 rounded-full p-1.5 text-muted-foreground hover:bg-card hover:text-foreground"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      {open ? (
        <div className="animate-rise mt-3 pl-14" data-testid="review-prompt-form">
          <textarea
            value={body}
            onChange={(event) => setBody(event.target.value)}
            maxLength={2000}
            autoFocus
            placeholder="What's working, what isn't? (optional)"
            data-testid="input-review-prompt-body"
            className="min-h-[72px] w-full resize-none rounded-xl border border-input bg-background px-3 py-2.5 text-sm leading-6 outline-none focus:border-primary focus:ring-2 focus:ring-primary/10"
          />
          {upsert.isError ? (
            <p className="mt-1.5 text-[11px] font-semibold text-destructive">
              Couldn&apos;t post that — try again.
            </p>
          ) : null}
          <div className="mt-2 flex items-center gap-2">
            <button
              type="button"
              onClick={submit}
              disabled={upsert.isPending}
              data-testid="button-post-review-prompt"
              className="inline-flex items-center gap-1.5 rounded-xl bg-primary px-3.5 py-2 text-xs font-extrabold text-primary-foreground disabled:opacity-50"
            >
              {upsert.isPending ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : null}
              Post review
            </button>
            <button
              type="button"
              onClick={() => {
                setRating(0);
                setBody('');
              }}
              className="rounded-xl px-3 py-2 text-xs font-bold text-muted-foreground hover:text-foreground"
            >
              Cancel
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
