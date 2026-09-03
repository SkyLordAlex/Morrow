import { useState } from 'react';
import { useLocation } from 'wouter';
import { LogOut, SlidersHorizontal, Trash2 } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
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
import { useAuth } from '@/auth/auth-context';

function initials(user: { displayName: string | null; email: string }): string {
  const source = user.displayName?.trim() || user.email;
  const parts = source.split(/[\s@._-]+/).filter(Boolean);
  return (parts[0]?.[0] ?? '?').concat(parts[1]?.[0] ?? '').toUpperCase();
}

export function AccountMenu() {
  const { user, signOut, deleteAccount } = useAuth();
  const [, navigate] = useLocation();
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);

  if (!user) return null;

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger
          data-testid="button-account-menu"
          className="grid h-8 w-8 place-items-center rounded-full bg-primary text-[11px] font-extrabold text-primary-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          aria-label="Account menu"
        >
          {initials(user)}
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-56">
          <DropdownMenuLabel className="truncate font-normal text-muted-foreground">
            {user.email}
          </DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            data-testid="button-open-settings"
            onSelect={() => navigate('/settings')}
          >
            <SlidersHorizontal className="h-4 w-4" />
            Settings
          </DropdownMenuItem>
          <DropdownMenuItem
            data-testid="button-sign-out"
            onSelect={() => void signOut()}
          >
            <LogOut className="h-4 w-4" />
            Sign out
          </DropdownMenuItem>
          <DropdownMenuItem
            data-testid="button-delete-account"
            onSelect={(event) => {
              event.preventDefault();
              setConfirmingDelete(true);
            }}
            className="text-destructive focus:text-destructive"
          >
            <Trash2 className="h-4 w-4" />
            Delete account
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <AlertDialog open={confirmingDelete} onOpenChange={setConfirmingDelete}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete your account?</AlertDialogTitle>
            <AlertDialogDescription>
              This permanently removes your account and every assignment, task,
              and study session tied to it. This can&apos;t be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Keep my account</AlertDialogCancel>
            <AlertDialogAction
              data-testid="button-confirm-delete-account"
              disabled={deleting}
              onClick={(event) => {
                event.preventDefault();
                setDeleting(true);
                void deleteAccount().catch(() => setDeleting(false));
              }}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleting ? 'Deleting…' : 'Delete everything'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
