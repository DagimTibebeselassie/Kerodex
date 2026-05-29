import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Link } from '@tanstack/react-router';
import { Vehicle } from '@/types';
import { useAuth } from '@/hooks/useAuth';
import { listVehicles, saveVehicleLocal, savedVehicleIds } from '@/lib/api';
import {
  Button,
  Input,
  Badge,
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  Separator,
  toast,
} from '@blinkdotnew/ui';
import {
  User,
  Mail,
  Phone,
  MapPin,
  Heart,
  Settings,
  Shield,
  BarChart3,
  Lock,
  Car,
  CheckCircle2,
  AlertTriangle,
  Edit2,
  X,
  Check,
  Camera,
  ExternalLink,
  Trash2,
  ChevronRight,
} from 'lucide-react';

type TabId = 'personal' | 'saved' | 'cockpit' | 'verify' | 'security';

const TABS: { id: TabId; label: string; icon: React.ReactNode }[] = [
  { id: 'personal', label: 'Personal Information', icon: <User className="h-4 w-4" /> },
  { id: 'saved', label: 'Saved Cars', icon: <Heart className="h-4 w-4" /> },
  { id: 'cockpit', label: 'Seller Cockpit', icon: <BarChart3 className="h-4 w-4" /> },
  { id: 'verify', label: 'Verification', icon: <Shield className="h-4 w-4" /> },
  { id: 'security', label: 'Security', icon: <Lock className="h-4 w-4" /> },
];

// ── Auth Gate ─────────────────────────────────────────────────────────────────
function AuthGate({ onLogin }: { onLogin: () => void }) {
  return (
    <div id="profile-auth-gate" className="flex flex-col items-center justify-center py-32 px-6 text-center">
      <div className="h-20 w-20 border border-border flex items-center justify-center mb-8">
        <User className="h-10 w-10 text-muted-foreground" />
      </div>
      <h2 className="text-2xl font-bold tracking-tight mb-3">Sign in to your account</h2>
      <p className="text-muted-foreground text-[14px] mb-10 max-w-sm leading-relaxed">
        Manage your profile, saved cars, seller listings, and account security.
      </p>
      <Button
        onClick={onLogin}
        className="h-12 px-10 text-[12px] font-bold uppercase tracking-widest"
      >
        Sign In
      </Button>
    </div>
  );
}

// ── Editable Field ─────────────────────────────────────────────────────────────
function EditableField({
  id,
  label,
  value,
  onSave,
  placeholder,
  readOnly,
  readOnlyNote,
}: {
  id: string;
  label: string;
  value: string;
  onSave?: (v: string) => void;
  placeholder?: string;
  readOnly?: boolean;
  readOnlyNote?: string;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);

  const handleSave = () => {
    onSave?.(draft);
    setEditing(false);
    toast.success('Changes saved.');
  };

  return (
    <div className="py-5 border-b border-border/60 space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">{label}</span>
        {!readOnly && !editing && (
          <button
            className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground hover:text-foreground flex items-center gap-1.5 transition-colors"
            onClick={() => setEditing(true)}
          >
            <Edit2 className="h-3 w-3" /> Edit
          </button>
        )}
        {readOnlyNote && !editing && (
          <button className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground hover:text-foreground transition-colors">
            {readOnlyNote}
          </button>
        )}
      </div>
      {editing ? (
        <div className="flex gap-2">
          <Input
            id={id}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder={placeholder}
            className="text-[13px] h-10 flex-1"
          />
          <Button size="sm" className="h-10 px-4" onClick={handleSave}>
            <Check className="h-4 w-4" />
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="h-10 px-4"
            onClick={() => { setDraft(value); setEditing(false); }}
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      ) : (
        <div id={id} className="text-[14px] font-medium text-foreground">
          {value || <span className="text-muted-foreground italic">Not set</span>}
        </div>
      )}
    </div>
  );
}

// ── Personal Information ───────────────────────────────────────────────────────
function PersonalTab({ user }: { user: any }) {
  const [name, setName] = useState(user?.name || '');
  const [phone, setPhone] = useState('');
  const [location, setLocation] = useState('');

  return (
    <div className="space-y-0 animate-fade-in">
      <h2 className="text-[18px] font-bold tracking-tight mb-8">Personal Information</h2>

      {/* Avatar */}
      <div className="pb-8 border-b border-border/60 flex items-center gap-6">
        <div className="h-20 w-20 bg-foreground text-background flex items-center justify-center font-bold text-[24px] shrink-0">
          {(user?.name || user?.email || 'U').charAt(0).toUpperCase()}
        </div>
        <div className="space-y-2">
          <div className="text-[14px] font-medium">{user?.name || 'Your Name'}</div>
          <Button variant="outline" size="sm" className="text-[11px] font-bold uppercase tracking-widest h-9">
            <Camera className="h-3.5 w-3.5 mr-2" /> Upload Photo
          </Button>
        </div>
      </div>

      <EditableField
        id="profile-name-field"
        label="Full Name"
        value={name}
        onSave={setName}
        placeholder="Jane Smith"
      />
      <EditableField
        id="profile-email-field"
        label="Email Address"
        value={user?.email || ''}
        readOnly
        readOnlyNote="Change email"
      />
      <EditableField
        id="profile-phone-field"
        label="Phone Number"
        value={phone}
        onSave={setPhone}
        placeholder="+1 (555) 000-0000"
      />
      <EditableField
        label="Location"
        id="profile-location-field"
        value={location}
        onSave={setLocation}
        placeholder="San Francisco, CA"
      />
    </div>
  );
}

// ── Saved Cars ─────────────────────────────────────────────────────────────────
function SavedTab({ user }: { user: any }) {
  const queryClient = useQueryClient();

  const { data: savedVehicles, isLoading } = useQuery({
    queryKey: ['saved-vehicles', user?.id],
    queryFn: async () => {
      if (!user) return [];
      const ids = savedVehicleIds();
      if (ids.size === 0) return [];
      const vehicles = await listVehicles();
      return vehicles.filter((vehicle) => ids.has(vehicle.id)) as Vehicle[];
    },
    enabled: !!user,
  });

  const removeMutation = useMutation({
    mutationFn: async (vehicleId: string) => {
      saveVehicleLocal(vehicleId, false);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['saved-vehicles', user?.id] });
      toast.success('Removed from saved.');
    },
  });

  return (
    <div className="animate-fade-in">
      <h2 className="text-[18px] font-bold tracking-tight mb-8">Saved Cars</h2>
      {isLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {[...Array(4)].map((_, i) => <div key={i} className="aspect-video bg-muted animate-pulse" />)}
        </div>
      ) : !savedVehicles?.length ? (
        <div className="border border-border py-20 flex flex-col items-center justify-center text-center space-y-4">
          <Heart className="h-10 w-10 text-muted-foreground" />
          <div>
            <div className="text-[15px] font-bold mb-1">No saved vehicles yet</div>
            <div className="text-[13px] text-muted-foreground">Browse the marketplace and heart listings you love.</div>
          </div>
          <Link to="/search">
            <Button variant="outline" size="sm" className="text-[11px] font-bold uppercase tracking-widest mt-2">
              Browse Marketplace
            </Button>
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {savedVehicles.map((v) => (
            <div key={v.id} className="border border-border bg-background group relative">
              <Link to="/vehicle/$id" params={{ id: v.id }}>
                <div className="aspect-video overflow-hidden bg-muted">
                  <img
                    src={v.images?.[0] || ''}
                    alt=""
                    className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                  />
                </div>
              </Link>
              <div className="p-4 space-y-2">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div className="text-[13px] font-bold">{v.year} {v.make} {v.model}</div>
                    <div className="text-[12px] text-muted-foreground">{v.mileage?.toLocaleString()} mi · {v.location}</div>
                  </div>
                  <div className="text-[13px] font-bold shrink-0">${v.price?.toLocaleString()}</div>
                </div>
                <button
                  className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground hover:text-destructive transition-colors flex items-center gap-1.5"
                  onClick={() => removeMutation.mutate(v.id)}
                >
                  <X className="h-3 w-3" /> Remove
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Seller Cockpit Preview ─────────────────────────────────────────────────────
function CockpitTab({ user }: { user: any }) {
  const { data: vehicles, isLoading } = useQuery({
    queryKey: ['my-vehicles', user?.id],
    queryFn: async () => {
      if (!user) return [];
      const vehicles = await listVehicles();
      return vehicles.filter((vehicle) => vehicle.userId === user.id || vehicle.seller?.name === user.name) as Vehicle[];
    },
    enabled: !!user,
  });

  const preview = vehicles?.slice(0, 3) ?? [];

  return (
    <div className="animate-fade-in space-y-8">
      <div className="flex items-start justify-between">
        <h2 className="text-[18px] font-bold tracking-tight">Seller Cockpit</h2>
        <Link to="/cockpit">
          <Button size="sm" className="text-[11px] font-bold uppercase tracking-widest h-9">
            <ExternalLink className="h-3.5 w-3.5 mr-2" /> Open Cockpit
          </Button>
        </Link>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: 'Total Views', value: '1,284' },
          { label: 'Active Listings', value: isLoading ? '–' : String(vehicles?.length ?? 0) },
          { label: 'Messages', value: '12' },
        ].map(({ label, value }) => (
          <div key={label} className="border border-border p-5 space-y-1 text-center">
            <div className="text-[22px] font-bold">{value}</div>
            <div className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">{label}</div>
          </div>
        ))}
      </div>

      {/* Preview listings */}
      <div>
        <div className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground mb-4">Recent Listings</div>
        {isLoading ? (
          <div className="space-y-3">{[...Array(3)].map((_, i) => <div key={i} className="h-14 bg-muted animate-pulse" />)}</div>
        ) : preview.length === 0 ? (
          <div className="border border-border py-12 text-center">
            <div className="text-[13px] text-muted-foreground">No listings yet.</div>
            <Link to="/sell">
              <Button variant="outline" size="sm" className="mt-4 text-[11px] font-bold uppercase tracking-widest">
                Create First Listing
              </Button>
            </Link>
          </div>
        ) : (
          <div className="border border-border divide-y divide-border">
            {preview.map((v) => (
              <div key={v.id} className="flex items-center justify-between px-5 py-4">
                <div className="flex items-center gap-4">
                  <div className="h-10 w-14 bg-muted overflow-hidden shrink-0">
                    <img src={v.images?.[0] || ''} alt="" className="w-full h-full object-cover" />
                  </div>
                  <div>
                    <div className="text-[13px] font-bold">{v.year} {v.make} {v.model}</div>
                    <div className="text-[11px] text-muted-foreground capitalize">{v.status}</div>
                  </div>
                </div>
                <div className="text-[13px] font-bold">${v.price?.toLocaleString()}</div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Verification ───────────────────────────────────────────────────────────────
function VerifyTab() {
  return (
    <div className="animate-fade-in space-y-8">
      <div className="flex items-start justify-between">
        <h2 className="text-[18px] font-bold tracking-tight">Verification</h2>
        <Link to="/verify">
          <Button size="sm" variant="outline" className="text-[11px] font-bold uppercase tracking-widest h-9">
            <ExternalLink className="h-3.5 w-3.5 mr-2" /> Verification Center
          </Button>
        </Link>
      </div>

      <div className="space-y-3">
        {[
          { label: 'Identity Verification', status: 'verified', note: 'Government ID confirmed' },
          { label: 'Email Address', status: 'verified', note: 'Confirmed at sign-up' },
          { label: 'Phone Number', status: 'pending', note: 'Add phone to verify' },
          { label: 'Ownership Document', status: 'pending', note: 'Upload title or registration' },
        ].map(({ label, status, note }) => (
          <div key={label} className="border border-border p-5 flex items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              {status === 'verified' ? (
                <CheckCircle2 className="h-5 w-5 text-foreground shrink-0" />
              ) : (
                <AlertTriangle className="h-5 w-5 text-muted-foreground shrink-0" />
              )}
              <div>
                <div className="text-[13px] font-bold">{label}</div>
                <div className="text-[11px] text-muted-foreground">{note}</div>
              </div>
            </div>
            <Badge
              className={`text-[10px] uppercase tracking-widest font-bold border ${
                status === 'verified'
                  ? 'bg-background border-foreground text-foreground'
                  : 'bg-background border-border text-muted-foreground'
              }`}
            >
              {status === 'verified' ? '✓ Verified' : '⚠ Pending'}
            </Badge>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Security ───────────────────────────────────────────────────────────────────
function SecurityTab() {
  const [pwDialogOpen, setPwDialogOpen] = useState(false);
  const [twoFAEnabled, setTwoFAEnabled] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState(false);

  return (
    <div className="animate-fade-in space-y-8">
      <h2 className="text-[18px] font-bold tracking-tight">Security</h2>

      <div className="space-y-3">
        {/* Change Password */}
        <div className="border border-border p-5 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Lock className="h-5 w-5 text-muted-foreground" />
            <div>
              <div className="text-[13px] font-bold">Password</div>
              <div className="text-[11px] text-muted-foreground">Last changed 30 days ago</div>
            </div>
          </div>
          <Button
            variant="outline"
            size="sm"
            className="text-[11px] font-bold uppercase tracking-widest h-9"
            onClick={() => setPwDialogOpen(true)}
          >
            Change
          </Button>
        </div>

        {/* 2FA */}
        <div className="border border-border p-5 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Shield className="h-5 w-5 text-muted-foreground" />
            <div>
              <div className="text-[13px] font-bold">Two-Factor Authentication</div>
              <div className="text-[11px] text-muted-foreground">
                {twoFAEnabled ? 'Active – adds an extra layer of security' : 'Disabled – enable for better protection'}
              </div>
            </div>
          </div>
          <button
            onClick={() => { setTwoFAEnabled(!twoFAEnabled); toast.success(twoFAEnabled ? '2FA disabled.' : '2FA enabled.'); }}
            className={`relative w-11 h-6 border transition-colors shrink-0 ${twoFAEnabled ? 'bg-foreground border-foreground' : 'bg-background border-border'}`}
          >
            <span className={`absolute top-1 w-4 h-4 bg-background border border-border transition-transform ${twoFAEnabled ? 'translate-x-5 bg-background' : 'translate-x-1 bg-muted'}`} />
          </button>
        </div>

        <Separator />

        {/* Delete Account */}
        <div className="border border-border border-destructive/40 p-5 space-y-3">
          <div className="flex items-center gap-3">
            <Trash2 className="h-5 w-5 text-destructive" />
            <div>
              <div className="text-[13px] font-bold text-destructive">Delete Account</div>
              <div className="text-[11px] text-muted-foreground">Permanently removes all your data. This cannot be undone.</div>
            </div>
          </div>
          {!deleteConfirm ? (
            <Button
              variant="outline"
              size="sm"
              className="text-[11px] font-bold uppercase tracking-widest h-9 border-destructive/40 text-destructive hover:bg-destructive hover:text-destructive-foreground"
              onClick={() => setDeleteConfirm(true)}
            >
              Delete Account
            </Button>
          ) : (
            <div className="space-y-2">
              <div className="text-[12px] text-destructive font-medium">Are you absolutely sure?</div>
              <div className="flex gap-2">
                <Button
                  size="sm"
                  className="h-9 text-[11px] font-bold uppercase tracking-widest bg-destructive hover:bg-destructive/90 text-destructive-foreground"
                  onClick={() => { toast.error('Account deletion requested.'); setDeleteConfirm(false); }}
                >
                  Yes, Delete
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-9 text-[11px] font-bold uppercase tracking-widest"
                  onClick={() => setDeleteConfirm(false)}
                >
                  Cancel
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Change Password Dialog */}
      <Dialog open={pwDialogOpen} onOpenChange={setPwDialogOpen}>
        <DialogContent className="max-w-md bg-background border border-border">
          <DialogHeader>
            <DialogTitle className="text-[14px] font-bold uppercase tracking-widest">Change Password</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <div className="space-y-2">
              <label className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">Current Password</label>
              <Input type="password" className="h-10 text-[13px]" placeholder="••••••••" />
            </div>
            <div className="space-y-2">
              <label className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">New Password</label>
              <Input type="password" className="h-10 text-[13px]" placeholder="••••••••" />
            </div>
            <div className="space-y-2">
              <label className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">Confirm New Password</label>
              <Input type="password" className="h-10 text-[13px]" placeholder="••••••••" />
            </div>
            <div className="flex gap-3 pt-2">
              <Button
                className="flex-1 h-10 text-[12px] font-bold uppercase tracking-widest"
                onClick={() => { toast.success('Password updated.'); setPwDialogOpen(false); }}
              >
                Update Password
              </Button>
              <Button variant="outline" className="h-10 text-[12px] font-bold uppercase tracking-widest" onClick={() => setPwDialogOpen(false)}>
                Cancel
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ── Main Profile Page ──────────────────────────────────────────────────────────
export function ProfilePage() {
  const { user, isLoading, login } = useAuth();

  // Sync tab from URL hash
  const getHashTab = (): TabId => {
    const hash = window.location.hash.replace('#', '') as TabId;
    if (window.location.pathname === '/cockpit') return 'cockpit';
    if (window.location.pathname === '/verify') return 'verify';
    return TABS.find((t) => t.id === hash) ? hash : 'personal';
  };
  const [activeTab, setActiveTab] = useState<TabId>(getHashTab);

  useEffect(() => {
    const onHashChange = () => setActiveTab(getHashTab());
    window.addEventListener('hashchange', onHashChange);
    return () => window.removeEventListener('hashchange', onHashChange);
  }, []);

  const handleTabChange = (id: TabId) => {
    setActiveTab(id);
    window.history.pushState(null, '', `#${id}`);
  };

  if (isLoading) {
    return (
      <div className="animate-pulse px-6 py-16 max-w-screen-xl mx-auto space-y-8">
        <div className="h-8 w-48 bg-muted" />
        <div className="h-64 bg-muted" />
      </div>
    );
  }

  if (!user) return <AuthGate onLogin={login} />;

  return (
    <div className="animate-fade-in px-4 lg:px-8 py-12 max-w-screen-xl mx-auto">
      <div className="mb-10">
        <h1 className="text-3xl font-bold tracking-tight mb-1">Account</h1>
        <p className="text-muted-foreground text-[13px]">
          {user.email}
        </p>
      </div>

      <div className="flex flex-col lg:flex-row gap-8 lg:gap-12">
        {/* ── Sidebar tabs (desktop) / Horizontal pills (mobile) ── */}
        <nav className="shrink-0 lg:w-56">
          {/* Mobile: horizontal scroll */}
          <div className="flex lg:hidden gap-1 overflow-x-auto pb-2 border-b border-border mb-6">
            {TABS.map((tab) => (
              <button
                key={tab.id}
                id={`tab-${tab.id}`}
                onClick={() => handleTabChange(tab.id)}
                className={`flex items-center gap-2 px-4 py-2.5 text-[11px] font-bold uppercase tracking-widest whitespace-nowrap shrink-0 transition-colors border ${
                  activeTab === tab.id
                    ? 'bg-foreground text-background border-foreground'
                    : 'bg-background text-muted-foreground border-border hover:text-foreground hover:border-foreground'
                }`}
              >
                {tab.icon}
                {tab.label}
              </button>
            ))}
          </div>

          {/* Desktop: vertical sidebar */}
          <div className="hidden lg:flex flex-col gap-1">
            {TABS.map((tab) => (
              <button
                key={tab.id}
                id={`tab-${tab.id}`}
                onClick={() => handleTabChange(tab.id)}
                className={`flex items-center justify-between px-4 py-3 text-[12px] font-bold uppercase tracking-wider transition-colors border ${
                  activeTab === tab.id
                    ? 'bg-foreground text-background border-foreground'
                    : 'bg-background text-muted-foreground border-transparent hover:text-foreground hover:bg-muted/40'
                }`}
              >
                <span className="flex items-center gap-3">
                  {tab.icon}
                  {tab.label}
                </span>
                <ChevronRight className={`h-3.5 w-3.5 transition-opacity ${activeTab === tab.id ? 'opacity-100' : 'opacity-0'}`} />
              </button>
            ))}
          </div>
        </nav>

        {/* ── Tab Content ── */}
        <div className="flex-1 min-w-0">
          {activeTab === 'personal' && <PersonalTab user={user} />}
          {activeTab === 'saved' && <SavedTab user={user} />}
          {activeTab === 'cockpit' && <CockpitTab user={user} />}
          {activeTab === 'verify' && <VerifyTab />}
          {activeTab === 'security' && <SecurityTab />}
        </div>
      </div>
    </div>
  );
}
