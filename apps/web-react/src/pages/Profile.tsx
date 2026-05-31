import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Link } from '@tanstack/react-router';
import { useAuth } from '@/hooks/useAuth';
import { listMyVehicles, savedVehicleIds } from '@/lib/api';
import { Button, Input, toast } from '@blinkdotnew/ui';
import {
  User, BadgeCheck, Shield, Bell, Lock, Car, Heart, MessageSquare,
  LayoutDashboard, ChevronRight, CheckCircle2, AlertCircle, Edit3,
  Phone, Mail, Camera,
} from 'lucide-react';

// ── Stat Tile ──────────────────────────────────────────────────────────────
function StatTile({ icon, label, value, href }: {
  icon: React.ReactNode;
  label: string;
  value: string | number;
  href?: string;
}) {
  const inner = (
    <div className="flex items-center gap-4 p-5 border border-border bg-card hover:border-primary/40 transition-colors group">
      <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center text-primary shrink-0">
        {icon}
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-[11px] font-bold uppercase tracking-[0.15em] text-muted-foreground">{label}</div>
        <div className="text-[22px] font-black tracking-tight mt-0.5">{value}</div>
      </div>
      {href && <ChevronRight className="h-4 w-4 text-muted-foreground group-hover:text-foreground transition-colors" />}
    </div>
  );
  return href ? <Link to={href as any}>{inner}</Link> : inner;
}

// ── Section Header ──────────────────────────────────────────────────────────
function SectionHeader({ title, description }: { title: string; description?: string }) {
  return (
    <div className="mb-6">
      <h2 className="text-[13px] font-black uppercase tracking-[0.18em]">{title}</h2>
      {description && <p className="text-[12px] text-muted-foreground mt-1">{description}</p>}
    </div>
  );
}

// ── Verification Badge ──────────────────────────────────────────────────────
function VerifBadge({ done, label }: { done: boolean; label: string }) {
  return (
    <div className={`flex items-center gap-2.5 px-3 py-2 border text-[12px] font-medium ${
      done
        ? 'border-primary/30 bg-primary/5 text-foreground'
        : 'border-border bg-muted/40 text-muted-foreground'
    }`}>
      {done
        ? <CheckCircle2 className="h-4 w-4 text-primary shrink-0" />
        : <AlertCircle className="h-4 w-4 shrink-0" />}
      {label}
    </div>
  );
}

export function ProfilePage() {
  const { user, login, isLoading: authLoading } = useAuth();
  const queryClient = useQueryClient();

  const [editMode, setEditMode] = useState(false);
  const [displayName, setDisplayName] = useState('');
  const [phone, setPhone] = useState('');

  const { data: myVehicles } = useQuery({
    queryKey: ['my-vehicles-count', user?.id],
    queryFn: async () => {
      if (!user) return [];
      return await listMyVehicles();
    },
    enabled: !!user,
  });

  const { data: savedCount } = useQuery({
    queryKey: ['saved-count', user?.id],
    queryFn: async () => {
      if (!user) return [];
      return [...savedVehicleIds()];
    },
    enabled: !!user,
  });

  const updateMutation = useMutation({
    mutationFn: async () => {
      const stored = JSON.parse(localStorage.getItem('kerodex-user') || '{}');
      localStorage.setItem('kerodex-user', JSON.stringify({ ...stored, name: displayName }));
      window.dispatchEvent(new CustomEvent('kerodex:auth-changed'));
    },
    onSuccess: () => {
      toast.success('Profile updated.');
      setEditMode(false);
      queryClient.invalidateQueries({ queryKey: ['auth'] });
    },
    onError: () => toast.error('Failed to update profile.'),
  });

  if (authLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="animate-spin rounded-full h-8 w-8 border-2 border-primary border-t-transparent" />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="flex flex-col items-center justify-center py-32 px-6 text-center">
        <User className="h-12 w-12 text-muted-foreground mb-6" />
        <h2 className="text-xl font-bold mb-2">Sign in to view your account</h2>
        <p className="text-muted-foreground text-[13px] mb-8 max-w-xs">
          Access your profile, saved cars, listings, and messages.
        </p>
        <Button onClick={login} className="h-10 px-8 text-[12px] font-bold uppercase tracking-widest">
          Sign In
        </Button>
      </div>
    );
  }

  const display = user.name || user.email || 'U';
  const initials = display
    .split(' ')
    .map((n: string) => n[0])
    .join('')
    .substring(0, 2)
    .toUpperCase();

  return (
    <div className="animate-fade-in px-4 md:px-6 py-10 max-w-screen-lg mx-auto">
      {/* ── Hero / Avatar ─────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center gap-6 mb-12 pb-12 border-b border-border">
        {/* Avatar */}
        <div className="relative">
          <div className="h-20 w-20 rounded-full bg-primary flex items-center justify-center text-primary-foreground font-black text-2xl shrink-0">
            {initials}
          </div>
          <button
            aria-label="Change avatar"
            className="absolute -bottom-1 -right-1 h-7 w-7 rounded-full bg-background border border-border flex items-center justify-center hover:bg-muted transition-colors"
          >
            <Camera className="h-3.5 w-3.5 text-muted-foreground" />
          </button>
        </div>

        {/* Info */}
        <div className="flex-1 min-w-0">
          {editMode ? (
            <div className="flex items-center gap-3">
              <Input
                value={displayName || user.name || ''}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder="Display name"
                className="h-9 text-[14px] max-w-xs"
                autoFocus
              />
              <Button
                onClick={() => updateMutation.mutate()}
                disabled={updateMutation.isPending}
                className="h-9 px-4 text-[11px] font-bold uppercase tracking-wider"
              >
                Save
              </Button>
              <Button
                variant="ghost"
                onClick={() => setEditMode(false)}
                className="h-9 px-3 text-[11px]"
              >
                Cancel
              </Button>
            </div>
          ) : (
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-black tracking-tight truncate">
                {user.name || user.email?.split('@')[0] || 'My Account'}
              </h1>
              <button
                onClick={() => { setEditMode(true); setDisplayName(user.name || ''); }}
                className="text-muted-foreground hover:text-foreground transition-colors"
              >
                <Edit3 className="h-4 w-4" />
              </button>
            </div>
          )}
          <p className="text-[13px] text-muted-foreground mt-1">{user.email}</p>
          <div className="flex flex-wrap gap-2 mt-3">
            <span className={`inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider px-2 py-1 border ${
              user.emailVerified ? 'border-primary/30 text-primary bg-primary/5' : 'border-border text-muted-foreground'
            }`}>
              <BadgeCheck className="h-3 w-3" /> {user.emailVerified ? 'Email Verified' : 'Email Unverified'}
            </span>
            <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider px-2 py-1 border border-border text-muted-foreground">
              Member since 2026
            </span>
          </div>
        </div>
      </div>

      {/* ── Quick Stats ────────────────────────────────────────────────── */}
      <section className="mb-12">
        <SectionHeader title="Activity" />
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <StatTile icon={<Car className="h-5 w-5" />} label="Listings" value={myVehicles?.length ?? 0} href="/cockpit" />
          <StatTile icon={<Heart className="h-5 w-5" />} label="Saved" value={savedCount?.length ?? 0} href="/saved" />
          <StatTile icon={<MessageSquare className="h-5 w-5" />} label="Messages" value={0} href="/messages" />
          <StatTile icon={<LayoutDashboard className="h-5 w-5" />} label="Views" value="—" href="/cockpit" />
        </div>
      </section>

      {/* ── Verification Status ────────────────────────────────────────── */}
      <section className="mb-12">
        <div className="flex items-center justify-between mb-6">
          <SectionHeader title="Verification Status" description="Complete verification to earn trust badges on all your listings." />
          <Link to="/verify">
            <Button variant="outline" className="h-8 px-4 text-[11px] font-bold uppercase tracking-wider">
              <Shield className="h-3.5 w-3.5 mr-2" /> Manage
            </Button>
          </Link>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          <VerifBadge done={Boolean(user.emailVerified)} label="Email Verified" />
          <VerifBadge done={false} label="Phone Verified" />
          <VerifBadge done={false} label="Identity Verified (Gov ID)" />
          <VerifBadge done={false} label="Selfie Verification" />
        </div>

        {/* Trust Score Preview */}
        <div className="mt-4 p-5 border border-border bg-card flex items-center justify-between gap-4">
          <div>
            <div className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground mb-1">Trust Score</div>
            <div className="text-3xl font-black tracking-tight">
              24<span className="text-[16px] text-muted-foreground font-normal">/100</span>
            </div>
            <div className="text-[12px] text-amber-500 font-medium mt-1">⚠ Partially Verified — Complete steps to improve</div>
          </div>
          <Link to="/verify">
            <Button className="h-10 px-5 text-[11px] font-bold uppercase tracking-wider">
              Improve Score
            </Button>
          </Link>
        </div>
      </section>

      {/* ── Personal Info ──────────────────────────────────────────────── */}
      <section className="mb-12">
        <SectionHeader title="Personal Information" />
        <div className="space-y-3">
          <div className="flex items-center justify-between p-4 border border-border bg-card">
            <div className="flex items-center gap-3">
              <Mail className="h-4 w-4 text-muted-foreground" />
              <div>
                <div className="text-[11px] text-muted-foreground uppercase tracking-widest font-bold">Email</div>
                <div className="text-[13px] font-medium">{user.email}</div>
              </div>
            </div>
            <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-1 border ${
              user.emailVerified ? 'text-primary border-primary/20 bg-primary/5' : 'text-muted-foreground border-border'
            }`}>
              {user.emailVerified ? 'Verified' : 'Unverified'}
            </span>
          </div>

          <div className="flex items-center justify-between p-4 border border-border bg-card">
            <div className="flex items-center gap-3">
              <Phone className="h-4 w-4 text-muted-foreground" />
              <div>
                <div className="text-[11px] text-muted-foreground uppercase tracking-widest font-bold">Phone</div>
                <div className="text-[13px] font-medium text-muted-foreground">Not added</div>
              </div>
            </div>
            <Link to="/verify">
              <Button variant="outline" size="sm" className="text-[11px] font-bold uppercase tracking-wider h-8 px-3">
                Add Phone
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* ── Quick Links ────────────────────────────────────────────────── */}
      <section>
        <SectionHeader title="Account" />
        <div className="space-y-1">
          {[
            { to: '/cockpit', icon: <LayoutDashboard className="h-4 w-4" />, label: 'Seller Cockpit', desc: 'Manage your listings and view performance' },
            { to: '/verify', icon: <Shield className="h-4 w-4" />, label: 'Verification Center', desc: 'Complete verification to unlock all features' },
            { to: '/saved', icon: <Heart className="h-4 w-4" />, label: 'Saved Vehicles', desc: `${savedCount?.length ?? 0} saved listings` },
            { to: '/messages', icon: <MessageSquare className="h-4 w-4" />, label: 'Messages', desc: 'View all conversations' },
          ].map((item) => (
            <Link key={item.to} to={item.to as any}>
              <div className="flex items-center gap-4 p-4 border border-border bg-card hover:border-primary/30 transition-colors group">
                <div className="text-muted-foreground group-hover:text-primary transition-colors shrink-0">{item.icon}</div>
                <div className="flex-1 min-w-0">
                  <div className="text-[13px] font-bold">{item.label}</div>
                  <div className="text-[12px] text-muted-foreground">{item.desc}</div>
                </div>
                <ChevronRight className="h-4 w-4 text-muted-foreground group-hover:text-foreground transition-colors" />
              </div>
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}
