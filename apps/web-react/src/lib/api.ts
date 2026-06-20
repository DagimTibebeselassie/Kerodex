import { Vehicle } from '@/types';

const TOKEN_KEY = 'kerodex-token';
const USER_KEY = 'kerodex-user';
const ADMIN_TOKEN_KEY = 'kerodex-admin-token';
const ADMIN_USER_KEY = 'kerodex-admin-user';

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
  firstName?: string;
  lastName?: string;
  username?: string;
  birthday?: string;
  phone?: string;
  favoriteBrands?: string[];
  preferredVehicleTypes?: string[];
  onboardingCompleted?: boolean;
  onboardingCompletedAt?: string;
  featureTourCompletedAt?: string;
  lastActiveAt?: string;
  termsVersion?: string;
  acceptedTermsAt?: string;
  privacyVersion?: string;
  acceptedPrivacyAt?: string;
  safetyNoticeSeenAt?: string;
  createdAt?: string;
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
  outcomes?: Record<'buyer' | 'seller', string>;
  currentUserOutcome?: string;
  isDemo?: boolean;
}

export interface SellerProfileRecord {
  id: string;
  name: string;
  isDemo?: boolean;
  is_demo?: boolean;
  initials?: string;
  avatarUrl?: string;
  avatarS3Key?: string;
  city?: string;
  state?: string;
  memberSince?: string;
  bio?: string;
  responseTime?: string;
  responseRate?: number;
  completedSales?: number;
  rating?: number | null;
  reviewCount?: number;
  reviews?: SellerReviewRecord[];
  verification?: Record<string, boolean>;
  listings?: ListingPayload[];
}

export interface SellerReviewRecord {
  id: string;
  sellerId: string;
  reviewerId: string;
  reviewerName: string;
  rating: number;
  comment: string;
  createdAt: string;
}

export interface BuyerPurchaseGuideRecord {
  id: string;
  buyer_id?: string;
  buyerId?: string;
  listing_id?: string;
  listingId?: string;
  seller_id?: string;
  sellerId?: string;
  status: 'active' | 'completed' | 'cancelled' | 'abandoned';
  current_step?: string;
  currentStep?: string;
  completed_steps?: string[];
  completedSteps?: string[];
  buyer_state?: string;
  buyerState?: string;
  seller_state?: string;
  sellerState?: string;
  notes?: Record<string, string>;
  created_at?: string;
  createdAt?: string;
  updated_at?: string;
  updatedAt?: string;
  listing?: ListingPayload;
  seller?: SellerProfileRecord | Record<string, any>;
  journey_type?: 'discovery' | 'purchase';
  journeyType?: 'discovery' | 'purchase';
  current_stage?: string;
  currentStage?: string;
  buyer_answers?: Record<string, any>;
  buyerAnswers?: Record<string, any>;
  buyer_profile?: Record<string, any>;
  buyerProfile?: Record<string, any>;
  recommendations?: BuyerGuideRecommendations | null;
  listing_matches?: BuyerGuideListingMatch[];
  listingMatches?: BuyerGuideListingMatch[];
  selected_listing_id?: string | null;
  selectedListingId?: string | null;
}

export interface BuyerGuideRecommendedModel {
  make: string;
  model: string;
  reason: string;
  idealYears: string;
  idealMileageMax: number;
  tradeoffs: string[];
}

export interface BuyerGuideRecommendations {
  buyerProfileSummary: string;
  recommendedCategories: string[];
  recommendedModels: BuyerGuideRecommendedModel[];
  kerodexFilters: {
    makes: string[];
    models: string[];
    maxPrice: number;
    bodyTypes: string[];
    maxMileage: number;
  };
  safetyNotes: string[];
  provider?: string;
  providerError?: string;
}

export interface BuyerGuideListingMatch {
  listing: ListingPayload;
  score: number;
  matchLevel: 'best' | 'close' | 'explore';
  matchReason: string;
  concerns: string[];
}

type ListingPayload = Record<string, any>;

export class ApiRequestError extends Error {
  status: number;
  retryAfterSeconds?: number;

  constructor(message: string, status: number, retryAfterSeconds?: number) {
    super(message);
    this.name = 'ApiRequestError';
    this.status = status;
    this.retryAfterSeconds = retryAfterSeconds;
  }
}

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
    throw new ApiRequestError(
      body.error || body.detail || 'Kerodex request failed.',
      response.status,
      Number(body.retryAfterSeconds || 0) || undefined
    );
  }
  return body as T;
}

function authHeaders(): Record<string, string> {
  const token = localStorage.getItem(TOKEN_KEY);
  return token ? { authorization: `Bearer ${token}` } : {};
}

function adminHeaders(): Record<string, string> {
  const token = sessionStorage.getItem(ADMIN_TOKEN_KEY);
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
    isDemo: Boolean(listing.isDemo || listing.is_demo),
    is_demo: Boolean(listing.is_demo || listing.isDemo),
    demoSeedId: listing.demoSeedId || '',
    demoNotice: listing.demoNotice || '',
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

export async function clearSession() {
  const token = localStorage.getItem(TOKEN_KEY);
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
  window.dispatchEvent(new CustomEvent('kerodex:auth-changed'));

  if (token) {
    await fetch(apiUrl('/api/auth/logout'), {
      method: 'POST',
      headers: { authorization: `Bearer ${token}` },
    }).catch(() => {});
  }
}

export async function deleteAccountImmediately() {
  const body = await request<{ message: string }>('/api/me', {
    method: 'DELETE',
    headers: authHeaders(),
  });
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
  window.dispatchEvent(new CustomEvent('kerodex:auth-changed'));
  return body;
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
  const body = await request<{ ok: boolean; message: string; phoneLast4?: string }>('/api/auth/phone/start', {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify({ phone }),
  });
  if (!body.ok) throw new Error(body.message || 'Unable to send verification code.');
  return body;
}

export async function verifyPhoneCode(phone: string, code: string) {
  const body = await request<{ ok: boolean; message: string; user: KerodexUser }>('/api/auth/phone/check', {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify({ phone, code }),
  });
  if (!body.ok || !body.user?.id) throw new Error(body.message || 'Invalid verification code.');
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

export async function refreshCurrentUser() {
  const body = await request<{ user: KerodexUser }>('/api/me', {
    headers: authHeaders(),
  });
  const token = localStorage.getItem(TOKEN_KEY);
  if (token) saveSession({ token, user: body.user });
  return body.user;
}

export async function checkUsername(username: string) {
  const search = new URLSearchParams({ username });
  return request<{ username: string; available: boolean; error?: string }>(`/api/users/check-username?${search}`, {
    headers: authHeaders(),
  });
}

export async function updateAccountProfile(payload: Partial<KerodexUser> & { name?: string }) {
  const body = await request<{ message: string; user: KerodexUser }>('/api/me', {
    method: 'PATCH',
    headers: authHeaders(),
    body: JSON.stringify(payload),
  });
  const token = localStorage.getItem(TOKEN_KEY);
  if (token) saveSession({ token, user: body.user });
  return body;
}

export async function completeFeatureTour() {
  const body = await request<{ message: string; user: KerodexUser }>('/api/me/feature-tour', {
    method: 'PATCH',
    headers: authHeaders(),
    body: JSON.stringify({ completed: true }),
  });
  const token = localStorage.getItem(TOKEN_KEY);
  if (token) saveSession({ token, user: body.user });
  return body;
}

export async function updateAccountPassword(currentPassword: string, newPassword: string) {
  return request<{ message: string; user: KerodexUser }>('/api/me/password', {
    method: 'PATCH',
    headers: authHeaders(),
    body: JSON.stringify({ currentPassword, newPassword }),
  });
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

export async function startBuyerGuide(listingId: string) {
  const body = await request<{ guide: BuyerPurchaseGuideRecord }>('/api/buyer-guides/start', {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify({ listingId }),
  });
  return body.guide;
}

export async function startBuyerGuideDiscovery() {
  const body = await request<{ session: BuyerPurchaseGuideRecord; guest: boolean }>('/api/buyer-guide/start', {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify({}),
  });
  return body;
}

export async function respondToBuyerGuide(
  sessionId: string,
  payload: { answerKey?: string; value?: any; answers?: Record<string, any>; currentStage?: string; currentStep?: string }
) {
  const body = await request<{ session: BuyerPurchaseGuideRecord }>('/api/buyer-guide/respond', {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify({ sessionId, ...payload }),
  });
  return body.session;
}

export async function getBuyerGuideRecommendations(sessionId: string, answers: Record<string, any>) {
  return request<{
    session: BuyerPurchaseGuideRecord;
    recommendations: BuyerGuideRecommendations;
    matches: BuyerGuideListingMatch[];
    fallbackUsed: boolean;
  }>('/api/buyer-guide/recommendations', {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify({ sessionId, answers }),
  });
}

export async function getBuyerGuideSession(sessionId: string) {
  const body = await request<{ session: BuyerPurchaseGuideRecord }>(`/api/buyer-guide/session/${encodeURIComponent(sessionId)}`, {
    headers: authHeaders(),
  });
  return body.session;
}

export async function updateBuyerGuideSession(sessionId: string, payload: Partial<BuyerPurchaseGuideRecord>) {
  const body = await request<{ session: BuyerPurchaseGuideRecord }>(`/api/buyer-guide/session/${encodeURIComponent(sessionId)}`, {
    method: 'PATCH',
    headers: authHeaders(),
    body: JSON.stringify(payload),
  });
  return body.session;
}

export async function selectBuyerGuideListing(sessionId: string, listingId: string) {
  return request<{ session: BuyerPurchaseGuideRecord; guide: BuyerPurchaseGuideRecord }>(
    `/api/buyer-guide/session/${encodeURIComponent(sessionId)}/listing/${encodeURIComponent(listingId)}`,
    {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify({}),
    }
  );
}

export async function listBuyerGuides() {
  const body = await request<{ guides: BuyerPurchaseGuideRecord[] }>('/api/buyer-guides', {
    headers: authHeaders(),
  });
  return body.guides;
}

export async function getBuyerGuide(id: string) {
  const body = await request<{ guide: BuyerPurchaseGuideRecord }>(`/api/buyer-guides/${encodeURIComponent(id)}`, {
    headers: authHeaders(),
  });
  return body.guide;
}

export async function updateBuyerGuide(id: string, payload: Partial<BuyerPurchaseGuideRecord>) {
  const body = await request<{ guide: BuyerPurchaseGuideRecord }>(`/api/buyer-guides/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    headers: authHeaders(),
    body: JSON.stringify(payload),
  });
  return body.guide;
}

export async function trackAnalyticsEvent(payload: {
  eventType: 'page_view' | 'listing_view' | 'listing_viewed' | 'search_performed' | 'filter_used' | 'save_listing' | 'unsave_listing' | 'listing_started' | 'listing_photos_uploaded' | 'seller_contact_clicked' | 'buyer_guide_started' | 'buyer_guide_completed';
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

export async function leaveSellerReview(sellerId: string, rating: number, comment: string) {
  const body = await request<{ seller: SellerProfileRecord; review: SellerReviewRecord }>(`/api/sellers/${encodeURIComponent(sellerId)}/reviews`, {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify({ rating, comment }),
  });
  return {
    ...body,
    seller: {
      ...body.seller,
      listings: (body.seller.listings || []).map(toVehicle),
    },
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

export async function listMyListingAnalytics() {
  const body = await request<{ analytics: Array<{ listing: ListingPayload; metrics: Record<string, any> }> }>('/api/me/listing-analytics', {
    headers: authHeaders(),
  });
  return body.analytics.map((item) => ({ listing: toVehicle(item.listing), metrics: item.metrics }));
}

export async function updateListingStatus(
  listingId: string,
  payload: {
    status: 'sold' | 'active';
    soldSource?: 'kerodex' | 'elsewhere' | 'prefer_not_to_say';
    finalSalePrice?: number | null;
    wouldUseAgain?: 'yes' | 'maybe' | 'no';
    feedbackText?: string;
  }
) {
  const body = await request<{ listing: ListingPayload }>(`/api/listings/${encodeURIComponent(listingId)}/status`, {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify(payload),
  });
  return toVehicle(body.listing);
}

export async function removeListing(listingId: string) {
  const body = await request<{ listing: ListingPayload }>(`/api/listings/${encodeURIComponent(listingId)}`, {
    method: 'DELETE',
    headers: authHeaders(),
  });
  return toVehicle(body.listing);
}

export async function updateConversationOutcome(conversationId: string, status: string) {
  const body = await request<{ conversation: ConversationRecord }>(`/api/conversations/${encodeURIComponent(conversationId)}/outcome`, {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify({ status }),
  });
  return body.conversation;
}

export async function listBuyerFollowups() {
  return request<{ prompts: Array<{ listingId: string; conversationId: string; vehicleTitle: string; createdAt: string }>; responses: any[] }>('/api/me/followups', {
    headers: authHeaders(),
  });
}

export async function answerBuyerFollowup(payload: {
  listingId: string;
  conversationId: string;
  answer: string;
  feedbackText?: string;
}) {
  return request<{ followup: any }>('/api/me/followups', {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify(payload),
  });
}

export async function submitFeedback(payload: {
  listingId?: string;
  context: string;
  rating?: number;
  responseText?: string;
}) {
  return request<{ feedback: any }>('/api/feedback', {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify(payload),
  });
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

export async function markConversationRead(conversationId: string) {
  const body = await request<{ conversation: ConversationRecord }>(`/api/conversations/${encodeURIComponent(conversationId)}/read`, {
    method: 'POST',
    headers: authHeaders(),
  });
  return body.conversation;
}

interface SavedVehiclesResponse {
  listingIds: string[];
  listings: ListingPayload[];
  count: number;
}

function legacySavedVehicleKey(userId: string) {
  return `kerodex-saved-vehicles:${userId}`;
}

export async function listSavedVehicles() {
  const user = currentUser();
  if (!user) return { listingIds: [], vehicles: [], count: 0 };

  const legacyKey = legacySavedVehicleKey(user.id);
  let legacyIds: string[] = [];
  try {
    legacyIds = JSON.parse(localStorage.getItem(legacyKey) || '[]') as string[];
  } catch {
    legacyIds = [];
  }

  const path = legacyIds.length ? '/api/me/saved/sync' : '/api/me/saved';
  const body = await request<SavedVehiclesResponse>(path, {
    method: legacyIds.length ? 'POST' : 'GET',
    headers: authHeaders(),
    ...(legacyIds.length ? { body: JSON.stringify({ listingIds: legacyIds }) } : {}),
  });
  localStorage.removeItem(legacyKey);
  return {
    listingIds: body.listingIds,
    vehicles: body.listings.map(toVehicle),
    count: body.count,
  };
}

export async function setVehicleSaved(vehicleId: string, saved: boolean) {
  const body = await request<{ saved: boolean; listing: ListingPayload }>(`/api/listings/${encodeURIComponent(vehicleId)}/favorite`, {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify({ saved }),
  });
  window.dispatchEvent(new CustomEvent('kerodex:saved-changed'));
  return { saved: body.saved, vehicle: toVehicle(body.listing) };
}

export interface AdminAccount {
  id: string;
  email: string;
  name: string;
  role: string;
  permissions?: string[];
}

export function currentAdmin(): AdminAccount | null {
  const raw = sessionStorage.getItem(ADMIN_USER_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as AdminAccount;
  } catch {
    return null;
  }
}

export function clearAdminSession() {
  sessionStorage.removeItem(ADMIN_TOKEN_KEY);
  sessionStorage.removeItem(ADMIN_USER_KEY);
  localStorage.removeItem(ADMIN_TOKEN_KEY);
  localStorage.removeItem(ADMIN_USER_KEY);
}

export async function adminLogin(accessCode: string) {
  const session = await request<{ token: string; admin: AdminAccount }>('/api/admin/auth/login', {
    method: 'POST',
    body: JSON.stringify({ accessCode }),
  });
  sessionStorage.setItem(ADMIN_TOKEN_KEY, session.token);
  sessionStorage.setItem(ADMIN_USER_KEY, JSON.stringify(session.admin));
  return session.admin;
}

export async function adminSession() {
  const body = await request<{ admin: AdminAccount }>('/api/admin/session', {
    headers: adminHeaders(),
  });
  sessionStorage.setItem(ADMIN_USER_KEY, JSON.stringify(body.admin));
  return body.admin;
}

export async function adminLogout() {
  try {
    await request<{ ok: true }>('/api/admin/auth/logout', {
      method: 'POST',
      headers: adminHeaders(),
    });
  } finally {
    clearAdminSession();
  }
}

export async function adminDashboard(includeDemo = false) {
  return request<Record<string, any>>(`/api/admin/dashboard?includeDemo=${includeDemo ? 'true' : 'false'}`, { headers: adminHeaders() });
}

export async function adminAnalytics(includeDemo = false) {
  return request<Record<string, any>>(`/api/admin/analytics?includeDemo=${includeDemo ? 'true' : 'false'}`, { headers: adminHeaders() });
}

export async function adminCosts() {
  return request<Record<string, any>>('/api/admin/costs', { headers: adminHeaders() });
}

export async function adminFeedback() {
  return request<Record<string, any>>('/api/admin/feedback', { headers: adminHeaders() });
}

export async function adminActivity(params: Record<string, string | number> = {}) {
  const query = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value !== '' && value !== undefined && value !== null) query.set(key, String(value));
  });
  return request<{ items: any[]; total: number; page: number; pageSize: number; eventTypes: string[] }>(
    `/api/admin/activity${query.toString() ? `?${query.toString()}` : ''}`,
    { headers: adminHeaders() }
  );
}

export async function adminItem(collection: string, id: string) {
  return request<Record<string, any>>(`/api/admin/${collection}/${encodeURIComponent(id)}`, {
    headers: adminHeaders(),
  });
}

export async function adminCollection(name: string, params: Record<string, string | number> = {}) {
  const query = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value !== '' && value !== undefined && value !== null) query.set(key, String(value));
  });
  return request<{ items: any[]; total: number; page: number; pageSize: number }>(
    `/api/admin/${name}${query.toString() ? `?${query.toString()}` : ''}`,
    { headers: adminHeaders() }
  );
}

export async function adminApplyAction(collection: string, id: string, action: string, notes: string) {
  return request<Record<string, any>>(`/api/admin/${collection}/${encodeURIComponent(id)}/actions`, {
    method: 'PATCH',
    headers: adminHeaders(),
    body: JSON.stringify({ action, notes }),
  });
}

export async function adminMessageReview(conversationId: string, reason: string) {
  const query = new URLSearchParams({ conversationId, reason });
  return request<{ conversation: ConversationRecord }>(`/api/admin/messages/review?${query.toString()}`, {
    headers: adminHeaders(),
  });
}
