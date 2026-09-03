import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Trash2 } from 'lucide-react';
import {
  getGetPlannerDashboardQueryKey,
  getListPlannerSessionsQueryKey,
  useClearPlanner,
} from '@workspace/api-client-react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

export function ClearPlannerButton({
  disabled,
  variant = 'inline',
}: {
  disabled?: boolean;
  variant?: 'inline' | 'block';
}) {
  const queryClient = useQueryClient();
  const clearPlanner = useClearPlanner();
  const [open, setOpen] = useState(false);

  const confirm = () =>
    clearPlanner.mutate(undefined, {
      onSuccess: () => {
        setOpen(false);
        queryClient.invalidateQueries({
          queryKey: getGetPlannerDashboardQueryKey(),
        });
        queryClient.invalidateQueries({
          queryKey: getListPlannerSessionsQueryKey(),
        });
      },
    });

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        disabled={disabled}
        data-testid="button-clear-planner"
        className={
          variant === 'block'
            ? 'inline-flex items-center gap-2 rounded-xl border border-destructive/40 px-3.5 py-2.5 text-xs font-extrabold text-destructive transition-colors hover:bg-destructive/10 disabled:opacity-40'
            : 'inline-flex items-center gap-1.5 text-xs font-bold text-muted-foreground transition-colors hover:text-destructive disabled:opacity-40'
        }
      >
        <Trash2 className="h-3.5 w-3.5" />
        Delete all plans
      </button>

      <AlertDialog open={open} onOpenChange={setOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete all plans?</AlertDialogTitle>
            <AlertDialogDescription>
              This removes every assignment, task, and study session from your
              planner. Your account stays. This can&apos;t be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={clearPlanner.isPending}>
              Keep my plans
            </AlertDialogCancel>
            <AlertDialogAction
              data-testid="button-confirm-clear-planner"
              disabled={clearPlanner.isPending}
              onClick={(event) => {
                event.preventDefault();
                confirm();
              }}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {clearPlanner.isPending ? 'Deleting…' : 'Delete everything'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
