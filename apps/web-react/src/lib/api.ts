import { Vehicle } from '@/types';

const TOKEN_KEY = 'kerodex-token';
const USER_KEY = 'kerodex-user';

export interface KerodexUser {
  id: string;
  email: string;
  name?: string;
  provider?: string;
}

export interface AuthSession {
  token: string;
  user: KerodexUser;
}

export interface ConversationRecord {
  id: string;
  listingId: string;
  buyerName: string;
  sellerName: string;
  lastMessage: string;
  unread: number;
  updatedAt: string;
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

export async function emailAuth(mode: 'signin' | 'create', email: string, password: string) {
  const session = await request<AuthSession>('/api/auth/email', {
    method: 'POST',
    body: JSON.stringify({ mode, email, password }),
  });
  saveSession(session);
  return session;
}

export async function socialAuth(provider: 'google' | 'apple') {
  const session = await request<AuthSession>(`/api/auth/${provider}`, {
    headers: { accept: 'application/json' },
  });
  saveSession(session);
  return session;
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

export async function createVehicle(payload: ListingPayload) {
  const body = await request<{ listing: ListingPayload }>('/api/listings', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
  return toVehicle(body.listing);
}

export async function listConversations() {
  const body = await request<{ conversations: ConversationRecord[] }>('/api/conversations');
  return body.conversations;
}

export function saveVehicleLocal(vehicleId: string, saved: boolean) {
  const key = 'kerodex-saved-vehicles';
  const ids = new Set(JSON.parse(localStorage.getItem(key) || '[]') as string[]);
  if (saved) ids.add(vehicleId);
  else ids.delete(vehicleId);
  localStorage.setItem(key, JSON.stringify([...ids]));
  window.dispatchEvent(new CustomEvent('kerodex:saved-changed'));
}

export function savedVehicleIds() {
  return new Set(JSON.parse(localStorage.getItem('kerodex-saved-vehicles') || '[]') as string[]);
}
