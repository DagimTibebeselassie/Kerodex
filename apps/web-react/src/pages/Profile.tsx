import { useRef, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Link, useNavigate } from '@tanstack/react-router';
import { useAuth } from '@/hooks/useAuth';
import { createUploadUrl, deleteAccountImmediately, getConversationCount, listMyVehicles, updateAccountPassword, updateAccountProfile, updateProfileAvatar } from '@/lib/api';
import { useSavedVehicles } from '@/hooks/useSavedVehicles';
import { DEFAULT_PROFILE_ICONS, defaultProfileIconForUser } from '@/lib/profile-icons';
import { BasicButton as Button } from '@/components/BasicButton';
import { BasicInput as Input } from '@/components/BasicInput';
import { toast } from 'sonner';
import {
  User, BadgeCheck, Shield, Bell, Lock, Car, Heart, MessageSquare,
  LayoutDashboard, ChevronRight, CheckCircle2, AlertCircle, Edit3,
  Phone, Mail, Camera, Sparkles, Trash2,
} from 'lucide-react';

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

function SectionHeader({ title, description }: { title: string; description?: string }) {
  return (
    <div className="mb-6">
      <h2 className="text-[13px] font-black uppercase tracking-[0.18em]">{title}</h2>
      {description && <p className="text-[12px] text-muted-foreground mt-1">{description}</p>}
    </div>
  );
}

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
  const navigate = useNavigate();

  const [editMode, setEditMode] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteText, setDeleteText] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [username, setUsername] = useState('');
  const [birthday, setBirthday] = useState('');
  const [phone, setPhone] = useState('');
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [avatarMenuOpen, setAvatarMenuOpen] = useState(false);
  const avatarInputRef = useRef<HTMLInputElement | null>(null);

  const { data: myVehicles } = useQuery({
    queryKey: ['my-vehicles-count', user?.id],
    queryFn: async () => {
      if (!user) return [];
      return await listMyVehicles();
    },
    enabled: !!user,
  });

  const { count: savedCount } = useSavedVehicles(user?.id);
  const { data: messageCount = 0 } = useQuery({
    queryKey: ['conversation-count', user?.id],
    queryFn: getConversationCount,
    enabled: Boolean(user),
    staleTime: 60_000,
    initialData: 0,
  });
  const totalViews = (myVehicles || []).reduce((sum, vehicle: any) => sum + Number(vehicle.views || 0), 0);
  const trustScore =
    (user?.emailVerified ? 10 : 0) +
    (user?.phoneVerified ? 20 : 0);
  const trustMax = 30;
  const memberSince = user?.createdAt
    ? new Date(user.createdAt).getFullYear()
    : user?.acceptedTermsAt
      ? new Date(user.acceptedTermsAt).getFullYear()
      : '—';

  const updateMutation = useMutation({
    mutationFn: async () => {
      return updateAccountProfile({
        name: displayName,
        username,
        birthday,
        phone,
      });
    },
    onSuccess: () => {
      toast.success('Profile updated.');
      setEditMode(false);
      queryClient.invalidateQueries({ queryKey: ['auth'] });
    },
    onError: () => toast.error('Failed to update profile.'),
  });

  const avatarMutation = useMutation({
    mutationFn: async (file: File) => {
      const upload = await createUploadUrl(file.name, file.type || 'image/jpeg', {
        purpose: 'profile-picture',
        fileSize: file.size,
      });
      const response = await fetch(upload.uploadUrl, {
        method: 'PUT',
        headers: upload.headers || { 'content-type': file.type || 'image/jpeg' },
        body: file,
      });
      if (!response.ok) throw new Error('Profile picture upload failed.');
      return updateProfileAvatar(upload.publicUrl, upload.key);
    },
    onSuccess: () => {
      toast.success('Profile picture updated.');
      setAvatarMenuOpen(false);
      queryClient.invalidateQueries({ queryKey: ['auth'] });
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : 'Failed to update profile picture.'),
  });

  const defaultAvatarMutation = useMutation({
    mutationFn: async (avatarUrl: string) => updateProfileAvatar(avatarUrl, ''),
    onSuccess: () => {
      toast.success('Default profile icon updated.');
      setAvatarMenuOpen(false);
      queryClient.invalidateQueries({ queryKey: ['auth'] });
    },
    onError: () => toast.error('Failed to update profile icon.'),
  });

  const passwordMutation = useMutation({
    mutationFn: async () => updateAccountPassword(currentPassword, newPassword),
    onSuccess: () => {
      toast.success('Password updated.');
      setCurrentPassword('');
      setNewPassword('');
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : 'Unable to update password.'),
  });

  const deleteMutation = useMutation({
    mutationFn: deleteAccountImmediately,
    onSuccess: () => {
      toast.success('Account deleted.');
      queryClient.clear();
      navigate({ to: '/' });
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : 'Unable to delete account.'),
  });

  const handleAvatarFile = (file?: File) => {
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      toast.error('Please upload an image file.');
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast.error('Profile picture must be under 5 MB.');
      return;
    }
    avatarMutation.mutate(file);
  };

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
  const defaultAvatarUrl = defaultProfileIconForUser(user);

  return (
    <div className="animate-fade-in px-4 md:px-6 py-10 max-w-screen-lg mx-auto">
      <div className="flex flex-col sm:flex-row items-start sm:items-center gap-6 mb-12 pb-12 border-b border-border">
        {/* Avatar */}
        <div className="relative w-20">
            <div className="h-20 w-20 rounded-full bg-primary flex items-center justify-center text-primary-foreground font-black text-2xl shrink-0 overflow-hidden">
              <img
                src={user.avatarUrl || defaultAvatarUrl}
                alt=""
                className="h-full w-full object-cover"
                onError={(event) => {
                  event.currentTarget.style.display = 'none';
                  event.currentTarget.parentElement?.append(document.createTextNode(initials));
                }}
              />
            </div>
            <input
              ref={avatarInputRef}
              type="file"
              aria-label="Upload profile image"
              accept="image/jpeg,image/png,image/webp,image/gif"
              className="hidden"
              onChange={(event) => handleAvatarFile(event.target.files?.[0])}
            />
            <button
              type="button"
              aria-label="Change avatar"
              aria-expanded={avatarMenuOpen}
              disabled={avatarMutation.isPending || defaultAvatarMutation.isPending}
              onClick={() => setAvatarMenuOpen((open) => !open)}
              className="absolute -bottom-1 -right-1 h-7 w-7 rounded-full bg-background border border-border flex items-center justify-center hover:bg-muted transition-colors"
            >
              {avatarMutation.isPending || defaultAvatarMutation.isPending ? (
                <span className="h-3.5 w-3.5 rounded-full border border-muted-foreground border-t-transparent animate-spin" />
              ) : (
                <Camera className="h-3.5 w-3.5 text-muted-foreground" />
              )}
            </button>

            {avatarMenuOpen && (
              <>
                <button
                  type="button"
                  aria-label="Close avatar menu"
                  className="fixed inset-0 z-20 cursor-default"
                  onClick={() => setAvatarMenuOpen(false)}
                />
                <div className="absolute left-0 top-[calc(100%+0.75rem)] z-30 w-72 border border-border bg-background p-3 shadow-xl">
                  <button
                    type="button"
                    onClick={() => avatarInputRef.current?.click()}
                    className="flex w-full items-center gap-3 border border-border px-3 py-2.5 text-left text-[12px] font-bold transition-colors hover:bg-muted"
                  >
                    <Camera className="h-4 w-4 text-muted-foreground" />
                    Select from device
                  </button>

                  <div className="mt-3 border-t border-border pt-3">
                    <div className="mb-2 flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.16em] text-muted-foreground">
                      <Sparkles className="h-3.5 w-3.5" />
                      Kerodex icons
                    </div>
                    <div className="grid grid-cols-5 gap-2">
                      {DEFAULT_PROFILE_ICONS.map((icon) => {
                        const selected = (user.avatarUrl || defaultAvatarUrl) === icon;
                        return (
                          <button
                            key={icon}
                            type="button"
                            aria-label="Choose default profile icon"
                            onClick={() => defaultAvatarMutation.mutate(icon)}
                            disabled={defaultAvatarMutation.isPending}
                            className={`h-9 w-9 rounded-full overflow-hidden border bg-muted transition-colors ${
                              selected ? 'border-foreground ring-2 ring-foreground/10' : 'border-border hover:border-muted-foreground'
                            }`}
                          >
                            <img src={icon} alt="" className="h-full w-full object-cover" />
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>
              </>
            )}
          </div>

        {/* Info */}
        <div className="flex-1 min-w-0">
          {editMode ? (
            <div className="space-y-3 max-w-xl">
              <div className="grid sm:grid-cols-2 gap-3">
                <Input
                  value={displayName || user.name || ''}
                  onChange={(e) => setDisplayName(e.target.value)}
                  placeholder="Display name"
                  className="h-9 text-[14px]"
                  autoFocus
                />
                <Input
                  value={username}
                  onChange={(e) => setUsername(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ''))}
                  placeholder="Username"
                  className="h-9 text-[14px]"
                />
                <Input
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="Phone number"
                  className="h-9 text-[14px]"
                />
                <Input
                  type="date"
                  value={birthday}
                  onChange={(e) => setBirthday(e.target.value)}
                  className="h-9 text-[14px]"
                />
              </div>
              <div className="flex items-center gap-3">
                <Button
                  onClick={() => updateMutation.mutate()}
                  disabled={updateMutation.isPending}
                  className="h-9 px-4 text-[11px] font-bold uppercase tracking-wider"
                >
                  {updateMutation.isPending ? 'Saving...' : 'Save'}
                </Button>
                <Button
                  variant="ghost"
                  onClick={() => setEditMode(false)}
                  className="h-9 px-3 text-[11px]"
                >
                  Cancel
                </Button>
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-black tracking-tight truncate">
                {user.name || user.email?.split('@')[0] || 'My Account'}
              </h1>
              <button
                onClick={() => {
                  setEditMode(true);
                  setDisplayName(user.name || '');
                  setUsername(user.username || '');
                  setBirthday(user.birthday || '');
                  setPhone(user.phone || '');
                }}
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
              Member since {memberSince}
            </span>
          </div>
        </div>
      </div>

      <section className="mb-12">
        <SectionHeader title="Activity" />
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <StatTile icon={<Car className="h-5 w-5" />} label="Listings" value={myVehicles?.length ?? 0} href="/cockpit" />
          <StatTile icon={<Heart className="h-5 w-5" />} label="Saved" value={savedCount} href="/saved" />
          <StatTile icon={<MessageSquare className="h-5 w-5" />} label="Messages" value={messageCount} href="/messages" />
          <StatTile icon={<LayoutDashboard className="h-5 w-5" />} label="Views" value={totalViews} href="/cockpit" />
        </div>
      </section>

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
          <VerifBadge done={Boolean(user.phoneVerified)} label="Phone Verified" />
          <VerifBadge done={false} label="Identity Verification — Coming Soon" />
          <VerifBadge done={false} label="Selfie Match — Coming Soon" />
        </div>

        {/* Trust Score Preview */}
        <div className="mt-4 p-5 border border-border bg-card flex items-center justify-between gap-4">
          <div>
            <div className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground mb-1">Trust Score</div>
            <div className="text-3xl font-black tracking-tight">
              {trustScore}<span className="text-[16px] text-muted-foreground font-normal">/{trustMax}</span>
            </div>
            <div className="text-[12px] text-amber-500 font-medium mt-1">
              {trustScore === trustMax ? 'Fully verified' : 'Complete verification steps to improve'}
            </div>
          </div>
          <Link to="/verify">
            <Button className="h-10 px-5 text-[11px] font-bold uppercase tracking-wider">
              Verification Center
            </Button>
          </Link>
        </div>
      </section>

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
                <div className="text-[13px] font-medium text-muted-foreground">{user.phone || 'Not added'}</div>
              </div>
            </div>
            <Link to="/verify">
              <Button variant="outline" size="sm" className="text-[11px] font-bold uppercase tracking-wider h-8 px-3">
                Add Phone
              </Button>
            </Link>
          </div>

          <div className="p-4 border border-border bg-card">
            <div className="flex items-center gap-3 mb-4">
              <Lock className="h-4 w-4 text-muted-foreground" />
              <div>
                <div className="text-[11px] text-muted-foreground uppercase tracking-widest font-bold">Password</div>
                <div className="text-[13px] font-medium">Update password for email sign-in</div>
              </div>
            </div>
            <div className="grid sm:grid-cols-[1fr_1fr_auto] gap-3">
              <Input
                type="password"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                placeholder="Current password"
                className="h-9 text-[13px]"
              />
              <Input
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="New password"
                className="h-9 text-[13px]"
              />
              <Button
                variant="outline"
                disabled={passwordMutation.isPending || !currentPassword || newPassword.length < 6}
                onClick={() => passwordMutation.mutate()}
                className="h-9 px-4 text-[11px] font-bold uppercase tracking-wider"
              >
                {passwordMutation.isPending ? 'Saving...' : 'Update'}
              </Button>
            </div>
          </div>
        </div>
      </section>

      <section className="mb-12">
        <SectionHeader title="Account" />
        <div className="space-y-1">
          {[
            { to: '/feature-tour', icon: <Sparkles className="h-4 w-4" />, label: 'View Kerodex Guide', desc: 'Replay the quick feature tour' },
            { to: '/cockpit', icon: <LayoutDashboard className="h-4 w-4" />, label: 'Seller Cockpit', desc: 'Manage your listings and view performance' },
            { to: '/verify', icon: <Shield className="h-4 w-4" />, label: 'Verification Center', desc: 'Complete verification to unlock all features' },
            { to: '/saved', icon: <Heart className="h-4 w-4" />, label: 'Saved Vehicles', desc: `${savedCount} saved listings` },
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

      <section>
        <SectionHeader
          title="Danger Zone"
          description="Account deletion takes effect immediately and permanently removes access to your Kerodex account."
        />
        <div className="border border-destructive/30 bg-destructive/5 p-4 md:p-5">
          {!deleteOpen ? (
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="flex items-start gap-3">
                <Trash2 className="h-4 w-4 text-destructive mt-0.5 shrink-0" />
                <div>
                  <div className="text-[13px] font-bold">Delete account immediately</div>
                  <p className="text-[12px] text-muted-foreground mt-1 max-w-xl">
                    This removes your account, active sessions, seller profile, your listings, your buyer guides, and conversations tied to this account.
                  </p>
                </div>
              </div>
              <Button
                variant="outline"
                onClick={() => setDeleteOpen(true)}
                className="h-9 px-4 text-[11px] font-bold uppercase tracking-wider border-destructive/40 text-destructive hover:bg-destructive/10"
              >
                Delete Account
              </Button>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="flex items-start gap-3">
                <AlertCircle className="h-4 w-4 text-destructive mt-0.5 shrink-0" />
                <div>
                  <div className="text-[13px] font-bold">Confirm immediate deletion</div>
                  <p className="text-[12px] text-muted-foreground mt-1">
                    This testing version deletes the account right away. Type <span className="font-bold text-foreground">DELETE</span> to confirm.
                  </p>
                </div>
              </div>
              <Input
                value={deleteText}
                onChange={(event) => setDeleteText(event.target.value)}
                placeholder="Type DELETE"
                className="h-9 text-[13px] max-w-sm"
              />
              <div className="flex flex-wrap gap-3">
                <Button
                  variant="outline"
                  disabled={deleteMutation.isPending || deleteText !== 'DELETE'}
                  onClick={() => deleteMutation.mutate()}
                  className="h-9 px-4 text-[11px] font-bold uppercase tracking-wider border-destructive/40 text-destructive hover:bg-destructive/10"
                >
                  {deleteMutation.isPending ? 'Deleting...' : 'Delete Immediately'}
                </Button>
                <Button
                  variant="ghost"
                  disabled={deleteMutation.isPending}
                  onClick={() => {
                    setDeleteOpen(false);
                    setDeleteText('');
                  }}
                  className="h-9 px-3 text-[11px]"
                >
                  Cancel
                </Button>
              </div>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
