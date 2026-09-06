import { useState } from 'react';
import { useLocation } from 'wouter';
import { Sprout, Star, X } from 'lucide-react';
import {
  getListReviewsQueryKey,
  useListReviews,
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
 * A gentle nudge to leave a review, shown once the student has completed a few
 * sessions and hasn't reviewed yet. Dismissible, per device.
 */
export function ReviewPrompt({ completedSessions }: { completedSessions: number }) {
  const [, navigate] = useLocation();
  const [hidden, setHidden] = useState(dismissed);
  const reviews = useListReviews({
    query: {
      queryKey: getListReviewsQueryKey(),
      enabled: completedSessions >= THRESHOLD && !hidden,
    },
  });

  if (completedSessions < THRESHOLD || hidden) return null;
  if (!reviews.data || reviews.data.myReview) return null;

  const close = () => {
    try {
      localStorage.setItem(DISMISS_KEY, '1');
    } catch {
      /* ignore */
    }
    setHidden(true);
  };

  return (
    <div
      className="animate-rise mt-6 flex items-center gap-4 rounded-2xl border border-secondary/60 bg-secondary/10 px-5 py-4"
      data-testid="card-review-prompt"
    >
      <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-secondary/25 text-primary">
        <Sprout className="h-4 w-4" />
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-[13px] font-bold text-foreground">
          {completedSessions} sessions done — how&apos;s Morrow working for you?
        </p>
        <div className="mt-1.5 flex items-center gap-0.5">
          {[1, 2, 3, 4, 5].map((n) => (
            <button
              key={n}
              type="button"
              aria-label={`Rate ${n} star${n > 1 ? 's' : ''}`}
              onClick={() => navigate('/reviews')}
              data-testid={`review-prompt-star-${n}`}
              className="text-muted-foreground/40 transition-transform hover:scale-110 hover:text-secondary"
            >
              <Star className="h-5 w-5" />
            </button>
          ))}
        </div>
      </div>
      <button
        type="button"
        onClick={close}
        aria-label="Dismiss"
        data-testid="button-dismiss-review-prompt"
        className="shrink-0 rounded-full p-1.5 text-muted-foreground hover:bg-card hover:text-foreground"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}
