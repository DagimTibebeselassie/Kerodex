import { useMemo, useState } from 'react';
import { useRouterState } from '@tanstack/react-router';
import { BasicButton as Button } from '@/components/BasicButton';
import { BasicInput as Input } from '@/components/BasicInput';
import { Accessibility, CheckCircle2, FileWarning, Mail, ShieldCheck } from 'lucide-react';
import { createReport } from '@/lib/api';
import { useAuth } from '@/hooks/useAuth';

const updated = 'June 21, 2026';
const supportEmail = 'support@kerodexofficial.com';

const reportCategories = [
  ['fake_listing', 'Fake or misleading listing'],
  ['dealer_or_commercial_listing', 'Dealer or commercial listing'],
  ['vin_mismatch', 'Wrong VIN, title, or mileage'],
  ['suspected_scam', 'Scam or fraud concern'],
  ['payment_request', 'Suspicious payment request'],
  ['harassment', 'Harassment or unsafe behavior'],
  ['message_issue', 'Message or conversation issue'],
  ['account_issue', 'Account issue'],
  ['accessibility_issue', 'Accessibility issue'],
  ['privacy_issue', 'Privacy request or concern'],
  ['general_support', 'General support'],
  ['other', 'Other'],
] as const;

function SupportReportForm({ compact = false, defaultCategory = 'general_support' }: { compact?: boolean; defaultCategory?: string }) {
  const { user } = useAuth();
  const route = useRouterState({ select: (state) => `${state.location.pathname}${state.location.searchStr || ''}` });
  const [category, setCategory] = useState(defaultCategory);
  const [email, setEmail] = useState(user?.email || '');
  const [url, setUrl] = useState(() => (typeof window === 'undefined' ? route : window.location.href));
  const [description, setDescription] = useState('');
  const [relatedId, setRelatedId] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [busy, setBusy] = useState(false);

  const emailRequired = !user;
  const canSubmit = description.trim().length >= 10 && (!emailRequired || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email));
  const categoryLabel = useMemo(
    () => reportCategories.find(([value]) => value === category)?.[1] || 'Support request',
    [category]
  );

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError('');
    setSuccess('');
    if (!canSubmit) {
      setError('Enter a valid email and at least 10 characters describing the issue.');
      return;
    }
    setBusy(true);
    try {
      const result = await createReport({
        category,
        description,
        email: email.trim(),
        url: url.trim(),
        listingId: category.includes('listing') || category === 'vin_mismatch' ? relatedId.trim() : undefined,
        messageId: category === 'message_issue' ? relatedId.trim() : undefined,
        reportedUserId: category === 'harassment' ? relatedId.trim() : undefined,
      });
      setSuccess(`${result.message} Report ID: ${result.reportId || result.report?.id || 'recorded'}.`);
      setDescription('');
      setRelatedId('');
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Unable to save this request.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <form onSubmit={submit} className={`border border-border bg-card ${compact ? 'p-5' : 'p-6 md:p-8'} space-y-5`} noValidate>
      <div>
        <h2 className="text-[15px] font-black tracking-tight">Send a request to Kerodex</h2>
        <p className="mt-1 text-[12px] leading-relaxed text-muted-foreground">
          This form saves directly to the protected admin review queue. It does not pretend an email was sent.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <label htmlFor="support-category" className="text-[11px] font-bold uppercase tracking-wider">Category</label>
          <select
            id="support-category"
            value={category}
            onChange={(event) => setCategory(event.target.value)}
            className="h-10 w-full border border-input bg-background px-3 text-[13px] outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            {reportCategories.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </select>
        </div>
        <div className="space-y-1.5">
          <label htmlFor="support-email" className="text-[11px] font-bold uppercase tracking-wider">
            Email {emailRequired ? '(required)' : '(optional)'}
          </label>
          <Input
            id="support-email"
            type="email"
            autoComplete="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            aria-describedby="support-email-help"
          />
          <p id="support-email-help" className="text-[10px] text-muted-foreground">Used only to follow up about this request.</p>
        </div>
      </div>

      <div className="space-y-1.5">
        <label htmlFor="support-url" className="text-[11px] font-bold uppercase tracking-wider">Related page URL (optional)</label>
        <Input id="support-url" type="url" value={url} onChange={(event) => setUrl(event.target.value)} />
      </div>

      <div className="space-y-1.5">
        <label htmlFor="support-related-id" className="text-[11px] font-bold uppercase tracking-wider">
          Related listing, user, or message ID (optional)
        </label>
        <Input id="support-related-id" value={relatedId} onChange={(event) => setRelatedId(event.target.value)} />
      </div>

      <div className="space-y-1.5">
        <label htmlFor="support-description" className="text-[11px] font-bold uppercase tracking-wider">
          Describe the {categoryLabel.toLowerCase()}
        </label>
        <textarea
          id="support-description"
          value={description}
          onChange={(event) => setDescription(event.target.value)}
          rows={6}
          minLength={10}
          required
          aria-invalid={Boolean(error)}
          aria-describedby="support-description-help support-form-status"
          className="w-full resize-y border border-input bg-background px-3 py-3 text-[13px] leading-relaxed outline-none focus-visible:ring-2 focus-visible:ring-ring"
        />
        <p id="support-description-help" className="text-[10px] text-muted-foreground">
          Include what happened, what you expected, and any relevant usernames or IDs. Do not include passwords or payment information.
        </p>
      </div>

      <div id="support-form-status" aria-live="polite">
        {error && <p role="alert" className="text-[12px] text-destructive">{error}</p>}
        {success && <p className="flex items-start gap-2 text-[12px] leading-relaxed text-foreground"><CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />{success}</p>}
      </div>

      <Button type="submit" disabled={!canSubmit || busy} className="h-11 px-6 text-[11px] font-bold uppercase tracking-wider">
        {busy ? 'Saving…' : 'Submit to Admin Review'}
      </Button>
    </form>
  );
}

export function ContactSupportPage() {
  return (
    <div className="animate-fade-in px-4 py-14 md:px-6 md:py-16 max-w-5xl mx-auto">
      <section className="max-w-3xl mb-10">
        <p className="text-[11px] font-bold uppercase tracking-[0.22em] text-muted-foreground mb-5">Contact and support</p>
        <h1 className="text-4xl md:text-6xl font-black tracking-tight leading-[0.96] mb-6">How can we help?</h1>
        <p className="text-[15px] text-muted-foreground leading-relaxed">
          Use the form for account issues, listing questions, fraud or safety concerns, accessibility feedback, privacy requests, and general support.
        </p>
      </section>
      <div className="grid gap-6 lg:grid-cols-[1fr_300px]">
        <SupportReportForm />
        <aside className="border border-border p-6 h-fit space-y-5" aria-label="Alternative contact options">
          <Mail className="h-5 w-5" />
          <div>
            <h2 className="text-[12px] font-bold uppercase tracking-widest">Direct email</h2>
            <a href={`mailto:${supportEmail}`} className="mt-2 block break-all text-[13px] underline underline-offset-4">{supportEmail}</a>
          </div>
          <p className="text-[12px] leading-relaxed text-muted-foreground">
            For immediate danger, theft, or suspected criminal activity, contact local emergency services or law enforcement. Kerodex is not an emergency service.
          </p>
        </aside>
      </div>
    </div>
  );
}

export function ReportProblemPage() {
  return (
    <div className="animate-fade-in px-4 py-14 md:px-6 md:py-16 max-w-4xl mx-auto">
      <section className="mb-10 max-w-2xl">
        <div className="mb-5 inline-flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.2em] text-muted-foreground">
          <FileWarning className="h-4 w-4" /> Report a problem
        </div>
        <h1 className="text-4xl md:text-6xl font-black tracking-tight leading-[0.96] mb-6">Help us review what went wrong.</h1>
        <p className="text-[14px] leading-relaxed text-muted-foreground">
          Report a listing, user, message, scam, harassment, dealer inventory, inaccurate vehicle information, accessibility problem, or privacy concern.
        </p>
      </section>
      <SupportReportForm />
    </div>
  );
}

export function AccessibilityStatementPage() {
  return (
    <div className="animate-fade-in px-4 py-14 md:px-6 md:py-16 max-w-4xl mx-auto">
      <div className="mb-10">
        <div className="mb-5 inline-flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.2em] text-muted-foreground">
          <Accessibility className="h-4 w-4" /> Accessibility
        </div>
        <h1 className="text-4xl md:text-6xl font-black tracking-tight leading-[0.96]">Accessibility Statement</h1>
        <p className="mt-4 text-[11px] font-bold uppercase tracking-widest text-muted-foreground">Last updated: {updated}</p>
      </div>

      <div className="space-y-8 text-[13px] md:text-[14px] leading-relaxed text-muted-foreground">
        <section>
          <h2 className="mb-3 text-[13px] font-black uppercase tracking-[0.15em] text-foreground">Our goal</h2>
          <p>Kerodex strives to meet WCAG 2.1 AA accessibility standards.</p>
        </section>
        <section>
          <h2 className="mb-3 text-[13px] font-black uppercase tracking-[0.15em] text-foreground">Ongoing work</h2>
          <p>Accessibility is an ongoing process. We review keyboard navigation, focus visibility, form labels, image descriptions, headings, color contrast, and compatibility with common browsers and assistive technologies.</p>
        </section>
        <section>
          <h2 className="mb-3 text-[13px] font-black uppercase tracking-[0.15em] text-foreground">Report an accessibility barrier</h2>
          <p>If you encounter an accessibility issue, contact:</p>
          <a href={`mailto:${supportEmail}`} className="mt-3 inline-flex items-center gap-2 text-foreground underline underline-offset-4">
            <Mail className="h-4 w-4" /> {supportEmail}
          </a>
          <p className="mt-4 font-semibold text-foreground">Please include:</p>
          <ul className="mt-2 list-disc space-y-1 pl-5">
            <li>Page URL</li>
            <li>Description of the issue</li>
            <li>Browser/device used</li>
          </ul>
        </section>
      </div>

      <div className="mt-10">
        <SupportReportForm compact defaultCategory="accessibility_issue" />
      </div>

      <div className="mt-8 flex gap-3 border border-border bg-muted/30 p-5">
        <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0" />
        <p className="text-[12px] leading-relaxed text-muted-foreground">We will make reasonable efforts to investigate accessibility reports and provide an accessible alternative when possible.</p>
      </div>
    </div>
  );
}
