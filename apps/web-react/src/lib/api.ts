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
  }>;
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
    status: listing.status === 'sold' ? 'sold' : 'available',
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

export async function emailAuth(mode: 'signin' | 'create', email: string, password: string, name = '') {
  const result = await request<AuthSession | EmailVerificationRequired>('/api/auth/email', {
    method: 'POST',
    body: JSON.stringify({ mode, email, password, name }),
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

export async function socialAuth(provider: 'google' | 'microsoft') {
  window.location.assign(apiUrl(`/api/auth/${provider}`));
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

export function consumeAuthRedirect() {
  const params = new URLSearchParams(window.location.search);
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
  const listing = await request<ListingPayload>(`/api/listings/${encodeURIComponent(id)}`);
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

export async function startConversation(listingId: string, message = 'Hi, is this still available?') {
  const body = await request<{ conversation: ConversationRecord }>('/api/conversations', {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify({ listingId, message }),
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
  window.dispatchEvent(new CustomEvent('kerodex:saved-changed'));
}

export function savedVehicleIds() {
  const user = currentUser();
  const key = user ? `kerodex-saved-vehicles:${user.id}` : 'kerodex-saved-vehicles:guest';
  return new Set(JSON.parse(localStorage.getItem(key) || '[]') as string[]);
}
