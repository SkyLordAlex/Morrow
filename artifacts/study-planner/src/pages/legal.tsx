import { type ReactNode } from 'react';
import { Link } from 'wouter';
import { ArrowLeft, Leaf } from 'lucide-react';

// NOTE: this is a plain-language starting template, not legal advice. Fill in
// the [bracketed] fields and have it reviewed before you rely on it — an app
// that collects student emails and study notes has real obligations.

const CONTACT_EMAIL = '[your-support-email@example.com]';
const COMPANY = '[Your name or company]';
const JURISDICTION = '[your state / country]';
const LAST_UPDATED = 'September 2, 2026';

function LegalShell({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <div className="app-shell min-h-[100dvh] bg-background">
      <div className="mx-auto max-w-[680px] px-6 py-10">
        <Link
          href="/"
          className="inline-flex items-center gap-1.5 text-xs font-bold text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-3.5 w-3.5" /> Back to Morrow
        </Link>
        <div className="mt-6 flex items-center gap-2.5">
          <span className="grid h-8 w-8 place-items-center rounded-[10px] bg-primary text-primary-foreground">
            <Leaf className="h-4 w-4" strokeWidth={2.5} />
          </span>
          <span className="font-serif text-[20px] text-foreground">Morrow</span>
        </div>
        <h1 className="mt-6 font-serif text-[34px] leading-tight text-foreground">
          {title}
        </h1>
        <p className="mt-1 font-mono text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
          Last updated {LAST_UPDATED}
        </p>
        <div className="legal mt-8 space-y-5 text-sm leading-6 text-muted-foreground [&_h2]:mt-8 [&_h2]:font-serif [&_h2]:text-[20px] [&_h2]:text-foreground [&_strong]:text-foreground">
          {children}
        </div>
        <p className="mt-12 border-t border-border/70 pt-6 text-xs text-muted-foreground">
          Questions? Email {CONTACT_EMAIL}.
        </p>
      </div>
    </div>
  );
}

export function Terms() {
  return (
    <LegalShell title="Terms of Use">
      <p>
        These terms govern your use of Morrow (the &ldquo;Service&rdquo;),
        operated by {COMPANY}. By creating an account or using the Service you
        agree to them.
      </p>

      <h2>Your account</h2>
      <p>
        You must provide accurate information and keep your login credentials
        secure. You&rsquo;re responsible for activity under your account. The
        Service is intended for students; if you are under the age of digital
        consent in your region, you need a parent or guardian&rsquo;s permission.
      </p>

      <h2>Acceptable use</h2>
      <p>
        Don&rsquo;t misuse the Service: no attempting to break, overload, or gain
        unauthorized access to it; no uploading unlawful content; no automated
        scraping or resale of the Service. We may suspend accounts that do.
      </p>

      <h2>Your content</h2>
      <p>
        You keep ownership of the notes and study information you enter. You
        grant {COMPANY} a limited licence to store and process that content
        solely to provide the Service to you (including sending your notes to our
        AI provider to generate a study plan &mdash; see the Privacy Policy).
      </p>

      <h2>Availability and changes</h2>
      <p>
        The Service is provided &ldquo;as is&rdquo; and may change, be
        interrupted, or be discontinued. We don&rsquo;t guarantee that study
        plans are complete or accurate &mdash; they&rsquo;re a starting point,
        not academic advice.
      </p>

      <h2>Limitation of liability</h2>
      <p>
        To the extent permitted by law, {COMPANY} is not liable for indirect or
        consequential damages, or for lost data, arising from your use of the
        Service. Nothing here limits liability that cannot legally be limited.
      </p>

      <h2>Termination</h2>
      <p>
        You can delete your account at any time from the account menu. We may
        terminate or suspend access if you breach these terms.
      </p>

      <h2>Governing law</h2>
      <p>
        These terms are governed by the laws of {JURISDICTION}. We may update
        them; material changes will be posted here with a new date.
      </p>
    </LegalShell>
  );
}

export function Privacy() {
  return (
    <LegalShell title="Privacy Policy">
      <p>
        This policy explains what {COMPANY} collects when you use Morrow, why,
        and your choices.
      </p>

      <h2>What we collect</h2>
      <p>
        <strong>Account data:</strong> your email address, a display name if you
        provide one, and &mdash; for Sign in with Apple or Google &mdash; a
        provider account identifier. Passwords are stored only as a salted hash.
      </p>
      <p>
        <strong>Study data:</strong> the assignments, tasks, study sessions, and
        notes you create, and their completion status.
      </p>
      <p>
        <strong>Reviews:</strong> any rating and review text you submit, shown to
        other signed-in users with your display name.
      </p>
      <p>
        We do <strong>not</strong> run third-party advertising or analytics
        trackers, and we don&rsquo;t sell personal data.
      </p>

      <h2>How we use it</h2>
      <p>
        To run the Service: authenticate you, save and sync your planner across
        your devices, and generate study plans. When you create a plan, the text
        of your note is sent to our AI provider (Google, via the Gemini API) to
        turn it into assignments and tasks. Google processes it under their API
        terms; on the free tier, inputs may be used to improve their models.
      </p>

      <h2>Where it&rsquo;s stored</h2>
      <p>
        On our hosting and database providers&rsquo; servers. Sessions are bearer
        tokens; we store only a hash of each token.
      </p>

      <h2>Retention and deletion</h2>
      <p>
        Your data is kept while your account is active. <strong>Deleting your
        account</strong> (account menu &rarr; Delete account) immediately and
        permanently removes your account, planner data, reviews, and sessions
        from our database. You can also clear just your plans from the dashboard.
      </p>

      <h2>Your rights</h2>
      <p>
        Depending on where you live, you may have rights to access, correct, or
        delete your personal data, or to object to processing. You can exercise
        the main ones in-app, or email {CONTACT_EMAIL}.
      </p>

      <h2>Children</h2>
      <p>
        Morrow is for students. If you are under the age of digital consent in
        your region, use it only with a parent or guardian&rsquo;s involvement.
        We don&rsquo;t knowingly collect more data than needed to run the
        Service.
      </p>

      <h2>Changes</h2>
      <p>
        We&rsquo;ll post updates here with a new date. Significant changes will
        be more prominently noted.
      </p>
    </LegalShell>
  );
}
