import { useMemo, useState, type ReactNode } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link } from '@tanstack/react-router';
import { Button, Input, toast } from '@blinkdotnew/ui';
import {
  adminApplyAction,
  adminActivity,
  adminAnalytics,
  adminCollection,
  adminDashboard,
  adminItem,
  adminLogin,
  adminLogout,
  adminSession,
  ApiRequestError,
  clearAdminSession,
  currentAdmin,
  type AdminAccount,
} from '@/lib/api';
import {
  Activity,
  AlertTriangle,
  BadgeCheck,
  BarChart3,
  Car,
  ClipboardCheck,
  FileWarning,
  Loader2,
  LogOut,
  MessageSquare,
  Shield,
  TrendingUp,
  Users,
  Eye,
  X,
} from 'lucide-react';

type AdminTab = 'overview' | 'activity' | 'users' | 'listings' | 'verifications' | 'reports' | 'analytics' | 'logs';
type PendingAction = { id: string; action: string; label: string; record: string } | null;
type DetailRecord = { collection: string; id: string; title: string } | null;

const tabs: Array<{ id: AdminTab; label: string; icon: ReactNode }> = [
  { id: 'overview', label: 'Overview', icon: <Activity className="h-4 w-4" /> },
  { id: 'activity', label: 'Activity', icon: <TrendingUp className="h-4 w-4" /> },
  { id: 'users', label: 'Users', icon: <Users className="h-4 w-4" /> },
  { id: 'listings', label: 'Listings', icon: <Car className="h-4 w-4" /> },
  { id: 'verifications', label: 'Verifications', icon: <ClipboardCheck className="h-4 w-4" /> },
  { id: 'reports', label: 'Reports', icon: <FileWarning className="h-4 w-4" /> },
  { id: 'analytics', label: 'Analytics', icon: <BarChart3 className="h-4 w-4" /> },
  { id: 'logs', label: 'Admin Logs', icon: <Shield className="h-4 w-4" /> },
];

const statusOptions: Record<AdminTab, string[]> = {
  overview: [],
  users: ['active', 'suspended', 'banned', 'deleted'],
  listings: ['active', 'pending_verification', 'removed', 'rejected', 'flagged', 'sold', 'vehicle_presence_verified'],
  verifications: ['pending', 'manual_review_required', 'approved', 'rejected', 'verified'],
  reports: ['open', 'reviewing', 'resolved', 'dismissed', 'escalated', 'warning_sent'],
  activity: [],
  analytics: [],
  logs: [],
};

const actionOptions: Record<AdminTab, Array<{ action: string; label: string; tone?: 'danger' | 'normal' }>> = {
  overview: [],
  users: [
    { action: 'ban', label: 'Ban', tone: 'danger' },
    { action: 'unban', label: 'Unban' },
    { action: 'suspend', label: 'Suspend' },
    { action: 'unsuspend', label: 'Unsuspend' },
    { action: 'disable_messaging', label: 'Disable Messages', tone: 'danger' },
    { action: 'enable_messaging', label: 'Enable Messages' },
  ],
  listings: [
    { action: 'approve', label: 'Approve' },
    { action: 'reject', label: 'Reject', tone: 'danger' },
    { action: 'remove', label: 'Remove', tone: 'danger' },
    { action: 'restore', label: 'Restore' },
    { action: 'flag', label: 'Flag' },
    { action: 'mark_sold', label: 'Mark Sold' },
  ],
  verifications: [
    { action: 'approve', label: 'Approve' },
    { action: 'reject', label: 'Reject', tone: 'danger' },
    { action: 'request_resubmission', label: 'Request New Photo' },
  ],
  reports: [
    { action: 'review', label: 'Review' },
    { action: 'resolve', label: 'Resolve' },
    { action: 'dismiss', label: 'Dismiss' },
    { action: 'warn_user', label: 'Warn User' },
    { action: 'escalate', label: 'Escalate', tone: 'danger' },
  ],
  activity: [],
  analytics: [],
  logs: [],
};

function availableActions(tab: AdminTab, item: any) {
  const status = String(item.status || item.verificationStatus || '').toLowerCase();
  if (tab === 'users') {
    return actionOptions.users.filter((option) => {
      if (option.action === 'ban') return status !== 'banned';
      if (option.action === 'unban') return status === 'banned';
      if (option.action === 'suspend') return !['suspended', 'banned'].includes(status);
      if (option.action === 'unsuspend') return status === 'suspended';
      if (option.action === 'disable_messaging') return !item.messagingDisabled;
      if (option.action === 'enable_messaging') return Boolean(item.messagingDisabled);
      return true;
    });
  }
  if (tab === 'listings') {
    return actionOptions.listings.filter((option) => {
      if (option.action === 'approve') return status !== 'active';
      if (option.action === 'reject') return status !== 'rejected';
      if (option.action === 'remove') return !['removed', 'deleted'].includes(status);
      if (option.action === 'restore') return ['removed', 'deleted', 'rejected', 'flagged'].includes(status);
      if (option.action === 'flag') return status !== 'flagged';
      if (option.action === 'mark_sold') return status !== 'sold';
      return true;
    });
  }
  if (tab === 'verifications') {
    return actionOptions.verifications.filter((option) => {
      if (option.action === 'approve') return !['approved', 'verified'].includes(status);
      if (option.action === 'reject') return status !== 'rejected';
      return true;
    });
  }
  if (tab === 'reports') {
    return actionOptions.reports.filter((option) => {
      if (option.action === 'review') return status === 'open';
      if (option.action === 'resolve') return !['resolved', 'dismissed'].includes(status);
      if (option.action === 'dismiss') return status !== 'dismissed';
      if (option.action === 'escalate') return status !== 'escalated';
      return true;
    });
  }
  return actionOptions[tab];
}

function formatDate(value?: string) {
  if (!value) return 'Not recorded';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString();
}

function money(value: unknown) {
  const numeric = Number(value || 0);
  return numeric ? `$${numeric.toLocaleString()}` : '—';
}

function StatusPill({ value }: { value?: string }) {
  const text = value || 'unknown';
  const risky = /ban|reject|remove|flag|open|pending|manual|escalated/i.test(text);
  return (
    <span className={`inline-flex items-center rounded-full border px-2 py-1 text-[11px] font-semibold uppercase tracking-wider ${
      risky ? 'border-amber-500/30 text-amber-600 dark:text-amber-300' : 'border-border text-muted-foreground'
    }`}>
      {text.replace(/_/g, ' ')}
    </span>
  );
}

function AdminLogin({ onLogin }: { onLogin: (admin: AdminAccount) => void }) {
  const [accessCode, setAccessCode] = useState('');
  const mutation = useMutation({
    mutationFn: () => adminLogin(accessCode),
    onSuccess: (admin) => {
      toast.success('Admin signed in.');
      onLogin(admin);
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : 'Unable to sign in.'),
  });

  return (
    <main className="min-h-screen flex items-center justify-center px-4 py-16">
      <section className="w-full max-w-md border border-border bg-card p-8 shadow-sm">
        <div className="mb-8">
          <p className="text-[11px] font-bold uppercase tracking-[0.28em] text-muted-foreground">Kerodex Admin</p>
          <h1 className="mt-3 text-3xl font-semibold tracking-tight">Admin access</h1>
          <p className="mt-3 text-sm text-muted-foreground">Enter the private Kerodex administrator password.</p>
        </div>
        <div className="space-y-4">
          <Input
            value={accessCode}
            onChange={(event) => setAccessCode(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter' && accessCode) mutation.mutate();
            }}
            placeholder="Admin password"
            type="password"
            autoFocus
          />
          <Button onClick={() => mutation.mutate()} disabled={mutation.isPending} className="w-full h-11 text-[12px] font-bold uppercase tracking-widest">
            {mutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Sign In'}
          </Button>
        </div>
      </section>
    </main>
  );
}

function StatCard({ label, value, icon }: { label: string; value: ReactNode; icon: ReactNode }) {
  return (
    <div className="border border-border bg-card p-5">
      <div className="mb-4 flex items-center justify-between text-muted-foreground">
        <span className="text-[11px] font-bold uppercase tracking-[0.22em]">{label}</span>
        {icon}
      </div>
      <div className="text-3xl font-semibold tracking-tight">{value}</div>
    </div>
  );
}

function Overview({ dashboard }: { dashboard: Record<string, any> }) {
  const cards = dashboard.cards || {};
  const website = dashboard.website || {};
  const activity = [
    ['Total users', cards.totalUsers, <Users className="h-4 w-4" />],
    ['New today', cards.newUsersToday, <Activity className="h-4 w-4" />],
    ['Active this week', cards.activeUsers7d, <TrendingUp className="h-4 w-4" />],
    ['Verified users', cards.verifiedUsers, <BadgeCheck className="h-4 w-4" />],
    ['Listings', cards.totalListings, <Car className="h-4 w-4" />],
    ['Active listings', cards.activeListings, <BadgeCheck className="h-4 w-4" />],
    ['Pending listings', cards.pendingListings, <AlertTriangle className="h-4 w-4" />],
    ['Vehicles sold', cards.vehiclesSold, <Car className="h-4 w-4" />],
    ['Messages', cards.totalMessages, <MessageSquare className="h-4 w-4" />],
    ['Reports open', cards.reportsSubmitted, <FileWarning className="h-4 w-4" />],
    ['Verification queue', cards.pendingVerificationRequests, <ClipboardCheck className="h-4 w-4" />],
    ['Fraud flags', cards.fraudFlagsTriggered, <Shield className="h-4 w-4" />],
  ];

  return (
    <div className="space-y-8">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {activity.map(([label, value, icon]) => (
          <StatCard key={String(label)} label={String(label)} value={String(value ?? 0)} icon={icon} />
        ))}
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <section className="border border-border bg-card p-5">
          <h2 className="text-lg font-semibold">Traffic</h2>
          <div className="mt-4 grid gap-3 text-sm">
            <div className="flex justify-between border-b border-border pb-3"><span className="text-muted-foreground">Visitors today</span><strong>{website.visitorsToday || 0}</strong></div>
            <div className="flex justify-between border-b border-border pb-3"><span className="text-muted-foreground">Visitors this week</span><strong>{website.visitorsThisWeek || 0}</strong></div>
            <div className="flex justify-between border-b border-border pb-3"><span className="text-muted-foreground">Page views</span><strong>{website.pageViews || 0}</strong></div>
            <div className="flex justify-between border-b border-border pb-3"><span className="text-muted-foreground">Week-over-week</span><strong>{website.weekOverWeekGrowth || 0}%</strong></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Searches</span><strong>{cards.searchActivity || 0}</strong></div>
          </div>
        </section>
        <section className="border border-border bg-card p-5">
          <h2 className="text-lg font-semibold">Conversion</h2>
          <div className="mt-4 space-y-3 text-sm text-muted-foreground">
            <div className="flex justify-between border-b border-border pb-3"><span>Signup conversion</span><strong className="text-foreground">{website.signupConversionRate || 0}%</strong></div>
            <div className="flex justify-between border-b border-border pb-3"><span>Listing-view conversion</span><strong className="text-foreground">{website.listingViewConversionRate || 0}%</strong></div>
            <div className="flex justify-between border-b border-border pb-3"><span>Search-to-contact</span><strong className="text-foreground">{website.searchToContactConversionRate || 0}%</strong></div>
            <div className="flex justify-between border-b border-border pb-3"><span>Listing views</span><strong className="text-foreground">{cards.listingViews || 0}</strong></div>
            <div className="flex justify-between"><span>Saved vehicles</span><strong className="text-foreground">{cards.savedVehicles || 0}</strong></div>
          </div>
        </section>
      </div>
      <section className="border border-border bg-card p-5">
        <h2 className="text-lg font-semibold">Marketplace funnel</h2>
        <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-7">
          {(dashboard.funnel || []).map((item: any) => (
            <div key={item.label} className="border-l-2 border-border pl-3">
              <div className="text-2xl font-semibold">{item.value || 0}</div>
              <div className="mt-1 text-xs text-muted-foreground">{item.label}</div>
            </div>
          ))}
        </div>
      </section>
      <div className="grid gap-4 lg:grid-cols-3">
        <MetricList title="User operations" items={[
          { label: 'Unverified users', value: cards.unverifiedUsers || 0 },
          { label: 'Banned users', value: cards.bannedUsers || 0 },
          { label: 'Suspended users', value: cards.suspendedUsers || 0 },
          { label: 'Users with listings', value: cards.usersWithListings || 0 },
          { label: 'Users with conversations', value: cards.usersWithConversations || 0 },
        ]} />
        <MetricList title="Listing quality" items={[
          { label: 'Created this week', value: cards.newListingsThisWeek || 0 },
          { label: 'Draft listings', value: cards.draftListings || 0 },
          { label: 'Missing photos', value: cards.listingsMissingPhotos || 0 },
          { label: 'Missing VIN', value: cards.listingsMissingVin || 0 },
          { label: 'Removed listings', value: cards.removedListings || 0 },
        ]} />
        <MetricList title="Safety operations" items={[
          { label: 'Manual verification review', value: cards.manualReviewVerifications || 0 },
          { label: 'Approved verifications', value: cards.approvedVerifications || 0 },
          { label: 'Flagged conversations', value: cards.flaggedConversations || 0 },
          { label: 'Suspicious-user conversations', value: cards.suspiciousConversations || 0 },
          { label: 'Reports under review', value: cards.reportsReviewing || 0 },
        ]} />
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <MetricList title="Listings by status" items={dashboard.breakdowns?.listingsByStatus} />
        <MetricList title="Recent admin actions" items={(dashboard.recent?.adminActions || []).slice(0, 8).map((item: any) => ({
          label: `${item.actionType || 'action'} / ${item.targetId || ''}`,
          value: formatDate(item.timestamp),
        }))} />
      </div>
    </div>
  );
}

function AdminTable({
  tab,
  items,
  onAction,
  onView,
}: {
  tab: AdminTab;
  items: any[];
  onAction: (item: any, action: string, label: string) => void;
  onView: (item: any) => void;
}) {
  if (!items.length) {
    return (
      <div className="border border-dashed border-border p-10 text-center">
        <p className="text-sm font-semibold">Nothing here yet</p>
        <p className="mt-2 text-sm text-muted-foreground">This section will populate from live Kerodex data.</p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto border border-border bg-card">
      <table className="w-full min-w-[860px] text-left text-sm">
        <thead className="border-b border-border text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
          <tr>
            <th className="px-4 py-3">Record</th>
            <th className="px-4 py-3">Status</th>
            <th className="px-4 py-3">Details</th>
            <th className="px-4 py-3">Updated</th>
            <th className="px-4 py-3 text-right">Actions</th>
          </tr>
        </thead>
        <tbody>
          {items.map((item) => {
            const title = item.fullName || item.title || item.listingTitle || item.type || item.actionType || item.id;
            const subtitle = item.email || item.seller || item.vehicleVin || item.reporter || item.adminAccount || item.id;
            const status = item.status || item.verificationStatus || item.riskLevel || item.actionType;
            const details = tab === 'listings'
              ? `${item.vin || 'No VIN'} • ${item.location || 'No location'} • ${money(item.price)}`
              : tab === 'users'
                ? `${item.id} • ${item.listingCount || 0} listings • ${item.messagesSent || 0} messages`
                : tab === 'verifications'
                  ? `${item.type || 'verification'} • ${item.listingId || 'No listing'} • ${item.challengeCode || 'No code'}`
                  : tab === 'reports'
                    ? `${item.category || item.type || 'report'} • ${item.listingId || item.reportedUserId || 'No target'}`
                    : `${item.targetType || ''} ${item.targetId || ''}`;
            return (
              <tr key={item.id} className="border-b border-border last:border-0">
                <td className="px-4 py-4 align-top">
                  <div className="font-semibold">{title}</div>
                  <div className="mt-1 text-xs text-muted-foreground">{subtitle}</div>
                </td>
                <td className="px-4 py-4 align-top"><StatusPill value={status} /></td>
                <td className="px-4 py-4 align-top text-muted-foreground">{details}</td>
                <td className="px-4 py-4 align-top text-muted-foreground">{formatDate(item.updatedAt || item.reviewedAt || item.submittedAt || item.timestamp || item.accountCreatedAt)}</td>
                <td className="px-4 py-4 align-top">
                  <div className="flex flex-wrap justify-end gap-2">
                    {tab === 'listings' && item.id && <Link to="/vehicle/$id" params={{ id: item.id }} className="text-xs font-semibold underline underline-offset-4">Open</Link>}
                    {['users', 'listings', 'verifications', 'reports'].includes(tab) && (
                      <button
                        onClick={() => onView(item)}
                        className="inline-flex items-center gap-1 border border-border px-2.5 py-1 text-[11px] font-bold uppercase tracking-wider text-muted-foreground hover:bg-muted hover:text-foreground"
                      >
                        <Eye className="h-3 w-3" /> Details
                      </button>
                    )}
                    {availableActions(tab, item).map((option) => (
                      <button
                        key={option.action}
                        onClick={() => onAction(item, option.action, option.label)}
                        className={`border px-2.5 py-1 text-[11px] font-bold uppercase tracking-wider transition-colors ${
                          option.tone === 'danger'
                            ? 'border-destructive/40 text-destructive hover:bg-destructive hover:text-destructive-foreground'
                            : 'border-border text-muted-foreground hover:bg-muted hover:text-foreground'
                        }`}
                      >
                        {option.label}
                      </button>
                    ))}
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function ActionDialog({
  pending,
  reason,
  busy,
  onReasonChange,
  onCancel,
  onConfirm,
}: {
  pending: Exclude<PendingAction, null>;
  reason: string;
  busy: boolean;
  onReasonChange: (value: string) => void;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 px-4" role="dialog" aria-modal="true" aria-labelledby="admin-action-title">
      <section className="w-full max-w-lg border border-border bg-background p-6 shadow-2xl">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-[0.24em] text-muted-foreground">Moderation action</p>
            <h3 id="admin-action-title" className="mt-2 text-2xl font-semibold">{pending.label}</h3>
            <p className="mt-2 text-sm text-muted-foreground">{pending.record}</p>
          </div>
          <button onClick={onCancel} aria-label="Close" className="p-1 text-muted-foreground hover:text-foreground">
            <X className="h-5 w-5" />
          </button>
        </div>
        <label className="mt-6 block text-xs font-bold uppercase tracking-[0.18em]" htmlFor="admin-action-reason">
          Reason
        </label>
        <textarea
          id="admin-action-reason"
          value={reason}
          onChange={(event) => onReasonChange(event.target.value)}
          placeholder="Explain why this action is being taken. This is saved to the audit log."
          rows={4}
          autoFocus
          className="mt-2 w-full resize-none border border-input bg-background px-3 py-3 text-sm outline-none focus:border-foreground"
        />
        <p className="mt-2 text-xs text-muted-foreground">Use at least 5 characters. The reason is recorded with the admin action.</p>
        <div className="mt-6 flex justify-end gap-3">
          <Button variant="outline" onClick={onCancel} disabled={busy}>Cancel</Button>
          <Button onClick={onConfirm} disabled={busy || reason.trim().length < 5}>
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : `Confirm ${pending.label}`}
          </Button>
        </div>
      </section>
    </div>
  );
}

function MetricList({ title, items }: { title: string; items?: Array<{ label: string; value: number | string }> }) {
  return (
    <section className="border border-border bg-card p-5">
      <h3 className="text-sm font-semibold">{title}</h3>
      <div className="mt-4 space-y-3">
        {(items || []).length ? items!.map((item) => (
          <div key={item.label} className="flex items-center justify-between gap-4 text-sm">
            <span className="truncate text-muted-foreground">{String(item.label).replace(/_/g, ' ')}</span>
            <strong>{item.value}</strong>
          </div>
        )) : <p className="text-sm text-muted-foreground">No recorded data yet.</p>}
      </div>
    </section>
  );
}

function AnalyticsView({ analytics, dashboard }: { analytics: Record<string, any>; dashboard: Record<string, any> }) {
  const charts = analytics.charts || {};
  const latest = (values: any[]) => (values || []).slice(-14);
  const maxValue = (values: any[]) => Math.max(1, ...latest(values).map((item) => Number(item.value || 0)));
  const MiniChart = ({ title, values }: { title: string; values: any[] }) => {
    const max = maxValue(values);
    return (
      <section className="border border-border bg-card p-5">
        <h3 className="text-sm font-semibold">{title}</h3>
        <div className="mt-5 flex h-36 items-end gap-1.5">
          {latest(values).map((item) => (
            <div key={item.date} className="group relative flex min-w-0 flex-1 items-end">
              <div
                className="w-full bg-foreground/80 transition-opacity hover:opacity-70"
                style={{ height: `${Math.max(3, (Number(item.value || 0) / max) * 100)}%` }}
                title={`${item.date}: ${item.value}`}
              />
            </div>
          ))}
        </div>
      </section>
    );
  };
  return (
    <div className="space-y-5">
      <div className="grid gap-4 lg:grid-cols-2">
        <MiniChart title="Daily visitors" values={charts.visitors || []} />
        <MiniChart title="Daily signups" values={charts.signups || []} />
        <MiniChart title="Listing growth" values={charts.listingGrowth || []} />
        <MiniChart title="Message volume" values={charts.messageVolume || []} />
      </div>
      <div className="grid gap-4 lg:grid-cols-3">
        <MetricList title="Listings by status" items={dashboard.breakdowns?.listingsByStatus} />
        <MetricList title="Listings by verification" items={dashboard.breakdowns?.listingsByVerification} />
        <MetricList title="Reports by category" items={dashboard.breakdowns?.reportsByCategory} />
        <MetricList title="Popular makes" items={charts.popularMakes} />
        <MetricList title="Geographic distribution" items={charts.geographicDistribution} />
        <MetricList title="Actions by administrator" items={dashboard.breakdowns?.actionsByAdmin} />
      </div>
    </div>
  );
}

function ActivityView({
  data,
  loading,
  eventType,
  source,
  dateFrom,
  dateTo,
  onEventType,
  onSource,
  onDateFrom,
  onDateTo,
}: {
  data?: any;
  loading: boolean;
  eventType: string;
  source: string;
  dateFrom: string;
  dateTo: string;
  onEventType: (value: string) => void;
  onSource: (value: string) => void;
  onDateFrom: (value: string) => void;
  onDateTo: (value: string) => void;
}) {
  return (
    <div className="space-y-5">
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <select value={eventType} onChange={(event) => onEventType(event.target.value)} className="h-10 border border-input bg-background px-3 text-sm">
          <option value="">All event types</option>
          {(data?.eventTypes || []).map((item: string) => <option key={item} value={item}>{item.replace(/_/g, ' ')}</option>)}
        </select>
        <select value={source} onChange={(event) => onSource(event.target.value)} className="h-10 border border-input bg-background px-3 text-sm">
          <option value="">All sources</option>
          <option value="platform">User/platform</option>
          <option value="admin">Admin</option>
          <option value="system">System</option>
        </select>
        <Input type="date" value={dateFrom} onChange={(event) => onDateFrom(event.target.value)} />
        <Input type="date" value={dateTo} onChange={(event) => onDateTo(event.target.value)} />
      </div>
      {loading ? <div className="flex h-64 items-center justify-center"><Loader2 className="h-5 w-5 animate-spin" /></div> : (
        <div className="border border-border bg-card">
          {(data?.items || []).length ? data.items.map((item: any) => (
            <div key={`${item.source}-${item.id}`} className="grid gap-2 border-b border-border p-4 last:border-0 md:grid-cols-[170px_1fr_220px]">
              <div>
                <StatusPill value={item.source} />
                <div className="mt-2 text-xs text-muted-foreground">{formatDate(item.createdAt)}</div>
              </div>
              <div>
                <div className="font-semibold">{String(item.eventType || '').replace(/_/g, ' ')}</div>
                <div className="mt-1 text-xs text-muted-foreground">
                  Actor: {item.actorUserId || item.adminId || 'system'}
                </div>
              </div>
              <div className="text-xs text-muted-foreground">
                {item.listingId && <div>Listing: {item.listingId}</div>}
                {item.targetUserId && <div>User: {item.targetUserId}</div>}
                {item.conversationId && <div>Conversation: {item.conversationId}</div>}
              </div>
            </div>
          )) : <div className="p-10 text-center text-sm text-muted-foreground">No activity matches these filters.</div>}
        </div>
      )}
    </div>
  );
}

function DetailDialog({ detail, data, loading, onClose }: { detail: Exclude<DetailRecord, null>; data?: any; loading: boolean; onClose: () => void }) {
  const sections = data ? [
    ['Account / record', Object.fromEntries(Object.entries(data).filter(([key, value]) => !Array.isArray(value) && typeof value !== 'object' && !['rawListing'].includes(key)))],
    ['Listings', data.listings],
    ['Conversations', data.conversations],
    ['Reports', data.reports],
    ['Activity', data.activity],
    ['Admin actions', data.adminActions],
  ] : [];
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 px-4 py-8" role="dialog" aria-modal="true">
      <section className="max-h-full w-full max-w-4xl overflow-y-auto border border-border bg-background p-6 shadow-2xl">
        <div className="flex items-start justify-between gap-4 border-b border-border pb-5">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-[0.24em] text-muted-foreground">{detail.collection} record</p>
            <h3 className="mt-2 text-2xl font-semibold">{detail.title}</h3>
            <p className="mt-1 text-xs text-muted-foreground">{detail.id}</p>
          </div>
          <button onClick={onClose} aria-label="Close"><X className="h-5 w-5" /></button>
        </div>
        {loading ? <div className="flex h-64 items-center justify-center"><Loader2 className="h-5 w-5 animate-spin" /></div> : (
          <div className="mt-6 space-y-6">
            {sections.filter(([, value]) => value && (!Array.isArray(value) || value.length)).map(([title, value]) => (
              <section key={String(title)}>
                <h4 className="text-xs font-bold uppercase tracking-[0.18em] text-muted-foreground">{String(title)}</h4>
                {Array.isArray(value) ? (
                  <div className="mt-3 space-y-2">
                    {value.slice(0, 20).map((item: any, index: number) => (
                      <div key={item.id || index} className="border border-border p-3 text-xs">
                        <div className="font-semibold">{item.title || item.eventType || item.actionType || item.category || item.id}</div>
                        <div className="mt-1 text-muted-foreground">{formatDate(item.createdAt || item.updatedAt || item.timestamp)}</div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <dl className="mt-3 grid gap-3 sm:grid-cols-2">
                    {Object.entries(value as Record<string, any>).map(([key, item]) => (
                      <div key={key} className="border-b border-border pb-2">
                        <dt className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">{key.replace(/([A-Z])/g, ' $1')}</dt>
                        <dd className="mt-1 break-words text-sm">{String(item ?? '-')}</dd>
                      </div>
                    ))}
                  </dl>
                )}
              </section>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

export function AdminPage() {
  const queryClient = useQueryClient();
  const [admin, setAdmin] = useState<AdminAccount | null>(() => currentAdmin());
  const [tab, setTab] = useState<AdminTab>('overview');
  const [q, setQ] = useState('');
  const [status, setStatus] = useState('');
  const [reason, setReason] = useState('');
  const [pendingAction, setPendingAction] = useState<PendingAction>(null);
  const [detailRecord, setDetailRecord] = useState<DetailRecord>(null);
  const [activityEventType, setActivityEventType] = useState('');
  const [activitySource, setActivitySource] = useState('');
  const [activityDateFrom, setActivityDateFrom] = useState('');
  const [activityDateTo, setActivityDateTo] = useState('');

  const sessionQuery = useQuery({
    queryKey: ['admin-session'],
    queryFn: adminSession,
    enabled: !!admin,
    retry: false,
  });

  const dashboardQuery = useQuery({
    queryKey: ['admin-dashboard'],
    queryFn: adminDashboard,
    enabled: !!admin,
    refetchInterval: 30000,
  });

  const analyticsQuery = useQuery({
    queryKey: ['admin-analytics'],
    queryFn: adminAnalytics,
    enabled: !!admin && tab === 'analytics',
  });

  const activityQuery = useQuery({
    queryKey: ['admin-activity', q, activityEventType, activitySource, activityDateFrom, activityDateTo],
    queryFn: () => adminActivity({
      q,
      eventType: activityEventType,
      source: activitySource,
      dateFrom: activityDateFrom,
      dateTo: activityDateTo,
      pageSize: 100,
    }),
    enabled: !!admin && tab === 'activity',
  });

  const collectionName = tab === 'logs' ? 'audit-logs' : tab;
  const collectionQuery = useQuery({
    queryKey: ['admin-collection', collectionName, q, status],
    queryFn: () => adminCollection(collectionName, { q, status, pageSize: 50 }),
    enabled: !!admin && !['overview', 'activity', 'analytics'].includes(tab),
  });

  const detailQuery = useQuery({
    queryKey: ['admin-item', detailRecord?.collection, detailRecord?.id],
    queryFn: () => adminItem(detailRecord!.collection, detailRecord!.id),
    enabled: !!admin && !!detailRecord,
  });

  const actionMutation = useMutation({
    mutationFn: ({ id, action }: { id: string; action: string }) => adminApplyAction(collectionName, id, action, reason),
    onSuccess: (result, variables) => {
      const updatedItem = (result as any).item;
      if (updatedItem) {
        queryClient.setQueryData(
          ['admin-collection', collectionName, q, status],
          (current: any) => current
            ? {
                ...current,
                items: (current.items || []).map((item: any) => item.id === variables.id ? { ...item, ...updatedItem } : item),
              }
            : current
        );
      }
      toast.success(`${pendingAction?.label || 'Admin action'} completed.`);
      setReason('');
      setPendingAction(null);
      queryClient.invalidateQueries({ queryKey: ['admin-dashboard'] });
      queryClient.invalidateQueries({ queryKey: ['admin-collection', collectionName] });
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : 'Unable to apply admin action.'),
  });

  const effectiveAdmin = sessionQuery.data || admin;
  const items = collectionQuery.data?.items || [];
  const activeStatusOptions = useMemo(() => statusOptions[tab] || [], [tab]);
  const handleLogin = (nextAdmin: AdminAccount) => {
    queryClient.removeQueries({ queryKey: ['admin-session'] });
    setAdmin(nextAdmin);
  };

  if (!admin) {
    return <AdminLogin onLogin={handleLogin} />;
  }
  if (sessionQuery.isLoading) {
    return <main className="flex min-h-screen items-center justify-center"><Loader2 className="h-6 w-6 animate-spin" /></main>;
  }
  if (sessionQuery.isError) {
    const error = sessionQuery.error;
    if (error instanceof ApiRequestError && error.status === 401) {
      clearAdminSession();
      return <AdminLogin onLogin={handleLogin} />;
    }
    return (
      <main className="flex min-h-screen items-center justify-center px-4">
        <section className="w-full max-w-md border border-border bg-card p-8 text-center">
          <AlertTriangle className="mx-auto h-6 w-6 text-amber-500" />
          <h1 className="mt-4 text-xl font-semibold">Admin connection interrupted</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Your admin session is still saved. Retry the connection instead of signing in again.
          </p>
          <Button className="mt-6" onClick={() => sessionQuery.refetch()}>Retry</Button>
        </section>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-background">
      <div className="mx-auto flex w-full max-w-[1500px] gap-0 px-4 py-6 md:px-6">
        <aside className="hidden w-64 shrink-0 border-r border-border pr-4 md:block">
          <div className="mb-8">
            <p className="text-[11px] font-bold uppercase tracking-[0.28em] text-muted-foreground">Kerodex</p>
            <h1 className="mt-2 text-2xl font-semibold tracking-tight">Admin</h1>
          </div>
          <nav className="space-y-1">
            {tabs.map((item) => (
              <button
                key={item.id}
                onClick={() => { setTab(item.id); setStatus(''); }}
                className={`flex w-full items-center gap-3 px-3 py-2 text-left text-sm transition-colors ${
                  tab === item.id ? 'bg-foreground text-background' : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                }`}
              >
                {item.icon}
                {item.label}
              </button>
            ))}
          </nav>
        </aside>

        <section className="min-w-0 flex-1 md:pl-6">
          <div className="mb-6 flex flex-col gap-4 border-b border-border pb-5 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <p className="text-[11px] font-bold uppercase tracking-[0.24em] text-muted-foreground">{effectiveAdmin?.role || 'admin'}</p>
              <h2 className="mt-1 text-3xl font-semibold tracking-tight">{tabs.find((item) => item.id === tab)?.label}</h2>
              <p className="mt-2 text-sm text-muted-foreground">Live platform controls backed by Kerodex API data.</p>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                onClick={async () => {
                  await adminLogout();
                  queryClient.removeQueries({ queryKey: ['admin-session'] });
                  queryClient.removeQueries({ queryKey: ['admin-dashboard'] });
                  queryClient.removeQueries({ queryKey: ['admin-collection'] });
                  setAdmin(null);
                }}
                className="h-10 gap-2 text-[12px] font-bold uppercase tracking-widest"
              >
                <LogOut className="h-4 w-4" /> Sign Out
              </Button>
            </div>
          </div>

          <div className="mb-5 flex gap-2 overflow-x-auto pb-1 md:hidden">
            {tabs.map((item) => (
              <button
                key={item.id}
                onClick={() => { setTab(item.id); setStatus(''); }}
                className={`shrink-0 border px-3 py-2 text-xs font-bold uppercase tracking-wider ${
                  tab === item.id ? 'bg-foreground text-background' : 'border-border text-muted-foreground'
                }`}
              >
                {item.label}
              </button>
            ))}
          </div>

          {tab === 'overview' ? (
            dashboardQuery.isLoading ? (
              <div className="flex h-64 items-center justify-center"><Loader2 className="h-5 w-5 animate-spin" /></div>
            ) : dashboardQuery.isError ? (
              <div className="border border-destructive/40 p-6 text-sm text-destructive">Unable to load admin dashboard.</div>
            ) : (
              <Overview dashboard={dashboardQuery.data || {}} />
            )
          ) : tab === 'analytics' ? (
            analyticsQuery.isLoading || dashboardQuery.isLoading ? (
              <div className="flex h-64 items-center justify-center"><Loader2 className="h-5 w-5 animate-spin" /></div>
            ) : analyticsQuery.isError ? (
              <div className="border border-destructive/40 p-6 text-sm text-destructive">Unable to load analytics.</div>
            ) : (
              <AnalyticsView analytics={analyticsQuery.data || {}} dashboard={dashboardQuery.data || {}} />
            )
          ) : tab === 'activity' ? (
            <div className="space-y-5">
              <Input value={q} onChange={(event) => setQ(event.target.value)} placeholder="Search platform activity..." />
              <ActivityView
                data={activityQuery.data}
                loading={activityQuery.isLoading}
                eventType={activityEventType}
                source={activitySource}
                dateFrom={activityDateFrom}
                dateTo={activityDateTo}
                onEventType={setActivityEventType}
                onSource={setActivitySource}
                onDateFrom={setActivityDateFrom}
                onDateTo={setActivityDateTo}
              />
            </div>
          ) : (
            <div className="space-y-5">
              <div className="grid gap-3 lg:grid-cols-[1fr_220px]">
                <Input value={q} onChange={(event) => setQ(event.target.value)} placeholder={`Search ${tab}...`} />
                <select value={status} onChange={(event) => setStatus(event.target.value)} className="h-10 border border-input bg-background px-3 text-sm">
                  <option value="">All statuses</option>
                  {activeStatusOptions.map((item) => <option key={item} value={item}>{item.replace(/_/g, ' ')}</option>)}
                </select>
              </div>
              {collectionQuery.isLoading ? (
                <div className="flex h-64 items-center justify-center"><Loader2 className="h-5 w-5 animate-spin" /></div>
              ) : collectionQuery.isError ? (
                <div className="border border-destructive/40 p-6 text-sm text-destructive">Unable to load {tab}.</div>
              ) : (
                <>
                  <div className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                    {collectionQuery.data?.total || 0} records
                  </div>
                  <AdminTable
                    tab={tab}
                    items={items}
                    onView={(item) => {
                      const collection = tab === 'logs' ? 'audit-logs' : tab;
                      setDetailRecord({
                        collection,
                        id: item.id,
                        title: item.fullName || item.title || item.listingTitle || item.type || item.id,
                      });
                    }}
                    onAction={(item, action, label) => {
                      const record = item.fullName || item.title || item.listingTitle || item.type || item.id;
                      setReason('');
                      setPendingAction({ id: item.id, action, label, record });
                    }}
                  />
                </>
              )}
            </div>
          )}
        </section>
      </div>
      {pendingAction && (
        <ActionDialog
          pending={pendingAction}
          reason={reason}
          busy={actionMutation.isPending}
          onReasonChange={setReason}
          onCancel={() => {
            if (!actionMutation.isPending) {
              setPendingAction(null);
              setReason('');
            }
          }}
          onConfirm={() => actionMutation.mutate({ id: pendingAction.id, action: pendingAction.action })}
        />
      )}
      {detailRecord && (
        <DetailDialog
          detail={detailRecord}
          data={detailQuery.data}
          loading={detailQuery.isLoading}
          onClose={() => setDetailRecord(null)}
        />
      )}
    </main>
  );
}
