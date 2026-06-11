import { Vehicle } from '@/types';

const TOKEN_KEY = 'kerodex-token';
const USER_KEY = 'kerodex-user';

export interface KerodexUser {
  id: string;
  email: string;
  name?: string;
  provider?: string;
  emailVerified?: boolean;
  phoneVerified?: boolean;
  identityVerified?: boolean;
  selfieVerified?: boolean;
  personaInquiryId?: string;
  personaReferenceId?: string;
  identityVerificationStatus?: 'unverified' | 'pending' | 'approved' | 'declined' | 'failed';
  identityVerifiedAt?: string;
  avatarUrl?: string;
  avatarS3Key?: string;
  lastActiveAt?: string;
  termsVersion?: string;
  acceptedTermsAt?: string;
  privacyVersion?: string;
  acceptedPrivacyAt?: string;
  safetyNoticeSeenAt?: string;
}

export interface AuthSession {
  token: string;
  user: KerodexUser;
}

export interface EmailVerificationRequired {
  requiresVerification: true;
  email: string;
  message?: string;
  error?: string;
  devCode?: string;
}

export interface PasswordResetRequired {
  requiresResetCode: true;
  email: string;
  message?: string;
  error?: string;
  devCode?: string;
}

export interface ConversationRecord {
  id: string;
  listingId: string;
  buyerId?: string;
  sellerId?: string;
  buyerName: string;
  sellerName: string;
  vehicleTitle?: string;
  partnerId?: string;
  partnerName?: string;
  partnerLastActiveAt?: string;
  currentUserRole?: 'buyer' | 'seller';
  buyerLastActiveAt?: string;
  sellerLastActiveAt?: string;
  lastMessage: string;
  unread: number;
  updatedAt: string;
  messages?: Array<{
    id: string;
    senderId: string;
    receiverId: string;
    vehicleId: string;
    content: string;
    createdAt: string;
    scamRiskScore?: number;
    scamFlags?: string[];
    moderationStatus?: 'clear' | 'needs_review' | 'high_risk';
  }>;
  scamRiskScore?: number;
  scamFlags?: string[];
  moderationStatus?: 'clear' | 'needs_review' | 'high_risk';
}

export interface SellerProfileRecord {
  id: string;
  name: string;
  initials?: string;
  city?: string;
  state?: string;
  memberSince?: string;
  bio?: string;
  responseTime?: string;
  responseRate?: number;
  completedSales?: number;
  rating?: number | null;
  reviewCount?: number;
  verification?: Record<string, boolean>;
  listings?: ListingPayload[];
}

type ListingPayload = Record<string, any>;

function apiUrl(path: string) {
  const base = import.meta.env.VITE_API_BASE_URL || '';
  return `${base}${path}`;
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(apiUrl(path), {
    ...init,
    headers: {
      'content-type': 'application/json',
      ...(init?.headers || {}),
    },
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(body.error || body.detail || 'Kerodex request failed.');
  }
  return body as T;
}

function authHeaders(): Record<string, string> {
  const token = localStorage.getItem(TOKEN_KEY);
  return token ? { authorization: `Bearer ${token}` } : {};
}

function parseImages(value: unknown): string[] {
  if (Array.isArray(value)) return value.filter(Boolean).map(String);
  if (typeof value !== 'string') return [];
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed.filter(Boolean).map(String) : [value];
  } catch {
    return value ? [value] : [];
  }
}

export function toVehicle(listing: ListingPayload): Vehicle {
  const images = parseImages(listing.images);
  return {
    ...listing,
    id: String(listing.id),
    userId: listing.userId || listing.seller?.id || 'seller_demo',
    make: listing.make || '',
    model: listing.model || '',
    trim: listing.trim || '',
    year: Number(listing.year || 0),
    price: Number(listing.price || 0),
    mileage: Number(listing.mileage || 0),
    location: listing.location || 'Private seller',
    description: listing.description || '',
    images,
    status: listing.status || 'available',
    createdAt: listing.createdAt || listing.updatedAt || new Date().toISOString(),
    lat: Number(listing.lat || 39.5),
    lng: Number(listing.lng || -98.35),
  };
}

export function currentUser(): KerodexUser | null {
  const raw = localStorage.getItem(USER_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as KerodexUser;
  } catch {
    return null;
  }
}

export function saveSession(session: AuthSession) {
  localStorage.setItem(TOKEN_KEY, session.token);
  localStorage.setItem(USER_KEY, JSON.stringify(session.user));
  window.dispatchEvent(new CustomEvent('kerodex:auth-changed'));
}

export function clearSession() {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
  window.dispatchEvent(new CustomEvent('kerodex:auth-changed'));
}

export async function emailAuth(
  mode: 'signin' | 'create',
  email: string,
  password: string,
  name = '',
  legalConsent?: { termsAccepted?: boolean; privacyAccepted?: boolean }
) {
  const result = await request<AuthSession | EmailVerificationRequired>('/api/auth/email', {
    method: 'POST',
    body: JSON.stringify({ mode, email, password, name, ...(legalConsent || {}) }),
  });
  if ('token' in result) saveSession(result);
  return result;
}

export async function verifyEmail(email: string, code: string) {
  const session = await request<AuthSession>('/api/auth/email/verify', {
    method: 'POST',
    body: JSON.stringify({ email, code }),
  });
  saveSession(session);
  return session;
}

export async function socialAuth(
  provider: 'google' | 'microsoft',
  legalConsent?: { termsAccepted?: boolean; privacyAccepted?: boolean }
) {
  const search = new URLSearchParams();
  if (legalConsent?.termsAccepted) search.set('termsAccepted', 'true');
  if (legalConsent?.privacyAccepted) search.set('privacyAccepted', 'true');
  const suffix = search.toString() ? `?${search}` : '';
  window.location.assign(apiUrl(`/api/auth/${provider}${suffix}`));
}

export async function requestPasswordReset(email: string) {
  return request<PasswordResetRequired>('/api/auth/password/forgot', {
    method: 'POST',
    body: JSON.stringify({ email }),
  });
}

export async function resetPassword(email: string, code: string, password: string) {
  const session = await request<AuthSession>('/api/auth/password/reset', {
    method: 'POST',
    body: JSON.stringify({ email, code, password }),
  });
  saveSession(session);
  return session;
}

export async function submitVerificationRequest(type: 'identity' | 'selfie' | 'ownership' | 'phone') {
  return request<{ verification: Record<string, any> }>('/api/me/verifications', {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify({ type }),
  });
}

export async function startPhoneVerification(phone: string) {
  return request<{ message: string; phoneLast4: string; devCode?: string }>('/api/me/phone/start', {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify({ phone }),
  });
}

export async function verifyPhoneCode(code: string) {
  const body = await request<{ message: string; user: KerodexUser }>('/api/me/phone/verify', {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify({ code }),
  });
  const token = localStorage.getItem(TOKEN_KEY);
  if (token) saveSession({ token, user: body.user });
  return body;
}

export async function markSafetyNoticeSeen() {
  const body = await request<{ message: string; user: KerodexUser }>('/api/me/safety-notice', {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify({}),
  });
  const token = localStorage.getItem(TOKEN_KEY);
  if (token) saveSession({ token, user: body.user });
  return body;
}

export async function updateProfileAvatar(avatarUrl: string, avatarS3Key: string) {
  const body = await request<{ message: string; user: KerodexUser }>('/api/me/avatar', {
    method: 'PATCH',
    headers: authHeaders(),
    body: JSON.stringify({ avatarUrl, avatarS3Key }),
  });
  const token = localStorage.getItem(TOKEN_KEY);
  if (token) saveSession({ token, user: body.user });
  return body;
}

export async function createReport(payload: {
  reportedUserId?: string;
  listingId?: string;
  messageId?: string;
  conversationId?: string;
  category?: string;
  description?: string;
}) {
  return request<{ message: string; report: Record<string, any> }>('/api/reports', {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify(payload),
  });
}

export async function trackAnalyticsEvent(payload: {
  eventType: 'page_view' | 'listing_view' | 'search_performed' | 'filter_used' | 'save_listing' | 'unsave_listing';
  route?: string;
  listingId?: string;
  query?: string;
  filter?: string;
}) {
  try {
    await request<{ ok: boolean }>('/api/events/track', {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify(payload),
    });
  } catch {
    // Analytics should never interrupt a buyer or seller workflow.
  }
}

export function consumeAuthRedirect() {
  const params = new URLSearchParams(window.location.search);
  if (params.get('persona') === 'return') {
    const status = params.get('status');
    window.history.replaceState({}, document.title, window.location.pathname || '/verify');
    return { ok: true, persona: true, status };
  }
  const token = params.get('token');
  const user = params.get('user');
  const errorMessage = params.get('message');
  if (token && user) {
    try {
      saveSession({ token, user: JSON.parse(user) });
      window.history.replaceState({}, document.title, window.location.pathname || '/');
      return { ok: true };
    } catch {
      return { ok: false, error: 'Unable to finish sign in.' };
    }
  }
  if (params.get('auth') === 'error') {
    window.history.replaceState({}, document.title, window.location.pathname || '/');
    return { ok: false, error: errorMessage || 'Authentication failed.' };
  }
  return null;
}

export async function listVehicles(params: Record<string, string | number | boolean | undefined> = {}) {
  const search = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value === undefined || value === '' || value === false) return;
    search.set(key, String(value));
  });
  const suffix = search.toString() ? `?${search}` : '';
  const body = await request<{ listings: ListingPayload[] }>(`/api/listings${suffix}`);
  return body.listings.map(toVehicle);
}

export async function getVehicle(id: string) {
  const listing = await request<ListingPayload>(`/api/listings/${encodeURIComponent(id)}`, {
    headers: authHeaders(),
  });
  return toVehicle(listing);
}

export async function getSellerProfile(id: string): Promise<Omit<SellerProfileRecord, 'listings'> & { listings: Vehicle[] }> {
  const seller = await request<SellerProfileRecord>(`/api/sellers/${encodeURIComponent(id)}`);
  return {
    ...seller,
    listings: (seller.listings || []).map(toVehicle),
  };
}

export async function createVehicle(payload: ListingPayload) {
  const body = await request<{ listing: ListingPayload }>('/api/listings', {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify(payload),
  });
  return toVehicle(body.listing);
}

export async function updateVehicle(id: string, payload: ListingPayload) {
  const body = await request<{ listing: ListingPayload }>(`/api/listings/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    headers: authHeaders(),
    body: JSON.stringify(payload),
  });
  return toVehicle(body.listing);
}

export async function createUploadUrl(
  fileName: string,
  contentType: string,
  options: { purpose?: string; documentType?: string; fileSize?: number } = {}
) {
  return request<{
    uploadUrl: string;
    publicUrl: string;
    key: string;
    headers?: Record<string, string>;
  }>('/api/uploads/presign', {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify({ fileName, contentType, ...options }),
  });
}

export async function createVehiclePresenceCode() {
  return request<{
    token: string;
    code: string;
    generatedAt: string;
    expiresAt: string;
    instructions: string;
  }>('/api/vehicle-presence/code', {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify({}),
  });
}

export async function submitVehiclePresence(
  listingId: string,
  payload: {
    vehiclePresenceToken: string;
    vehiclePresenceCode: string;
    vehiclePresencePhotoUrl: string;
    vehiclePresenceS3Key?: string;
  }
) {
  const body = await request<{ listing: ListingPayload; queued: boolean }>(
    `/api/listings/${encodeURIComponent(listingId)}/vehicle-presence`,
    {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify(payload),
    }
  );
  return toVehicle(body.listing);
}

export async function listConversations() {
  const body = await request<{ conversations: ConversationRecord[] }>('/api/conversations', {
    headers: authHeaders(),
  });
  return body.conversations;
}

export async function listMyVehicles() {
  const body = await request<{ listings: ListingPayload[] }>('/api/me/listings', {
    headers: authHeaders(),
  });
  return body.listings.map(toVehicle);
}

export async function startPersonaVerification() {
  return request<{ url: string; status: string; referenceId: string }>('/api/me/persona/start', {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify({}),
  });
}

export async function savePersonaReturn(inquiryId: string, status?: string | null, referenceId?: string | null) {
  const session = await request<AuthSession>('/api/me/persona/return', {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify({ inquiryId, status, referenceId }),
  });
  saveSession(session);
  return session;
}

export async function startConversation(listingId: string, message = 'Hi, is this still available?') {
  const body = await request<{ conversation: ConversationRecord }>('/api/conversations', {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify({ listingId, message }),
  });
  return body.conversation;
}

export async function sendConversationMessage(conversationId: string, content: string) {
  const body = await request<{ conversation: ConversationRecord }>(`/api/conversations/${encodeURIComponent(conversationId)}/messages`, {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify({ content }),
  });
  return body.conversation;
}

export function saveVehicleLocal(vehicleId: string, saved: boolean) {
  const user = currentUser();
  const key = user ? `kerodex-saved-vehicles:${user.id}` : 'kerodex-saved-vehicles:guest';
  const ids = new Set(JSON.parse(localStorage.getItem(key) || '[]') as string[]);
  if (saved) ids.add(vehicleId);
  else ids.delete(vehicleId);
  localStorage.setItem(key, JSON.stringify([...ids]));
  trackAnalyticsEvent({ eventType: saved ? 'save_listing' : 'unsave_listing', listingId: vehicleId });
  window.dispatchEvent(new CustomEvent('kerodex:saved-changed'));
}

export function savedVehicleIds() {
  const user = currentUser();
  const key = user ? `kerodex-saved-vehicles:${user.id}` : 'kerodex-saved-vehicles:guest';
  return new Set(JSON.parse(localStorage.getItem(key) || '[]') as string[]);
}
