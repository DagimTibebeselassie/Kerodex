const http = require("http");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const { URL } = require("url");

function loadLocalEnvFile(filePath) {
  if (!fs.existsSync(filePath)) return;
  const lines = fs.readFileSync(filePath, "utf8").split(/\r?\n/);
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#") || !trimmed.includes("=")) continue;
    const index = trimmed.indexOf("=");
    const key = trimmed.slice(0, index).trim();
    const value = trimmed.slice(index + 1).trim().replace(/^["']|["']$/g, "");
    if (key && process.env[key] === undefined) process.env[key] = value;
  }
}

if (process.env.SKIP_LOCAL_ENV !== "true") {
  loadLocalEnvFile(path.resolve(__dirname, "../../.env.local"));
  loadLocalEnvFile(path.resolve(__dirname, "../../.env"));
}

const marketCheck = require("./marketcheck");
const store = require("./store");
const vehiclePresence = require("./vehicle-presence");
const buyerGuideEngine = require("./buyer-guide");
const twilio = require("twilio");
const PORT = Number(process.env.PORT || 4100);
const REACT_DIST_DIR = path.resolve(__dirname, "../web-react/dist");
const PUBLIC_DIR = fs.existsSync(REACT_DIST_DIR)
  ? REACT_DIST_DIR
  : path.resolve(__dirname, "../web/public");
const users = new Map();
const sessions = new Map();
const adminSessions = new Map();
const oauthStates = new Map();
const emailVerifications = new Map();
const passwordResets = new Map();
const phoneVerificationBuckets = new Map();
const phoneVerificationCooldowns = new Map();
const pendingPresenceCodes = new Map();
const vehiclePresenceJobs = new Set();
const vehiclePresenceVinJobs = new Map();
const guestBuyerGuideSessions = new Map();
const TERMS_VERSION = "v1.0";
const PRIVACY_VERSION = "v1.0";
const IS_PRODUCTION = process.env.NODE_ENV === "production";
// Beta safety gate: keep identity verification unavailable until Kerodex has a
// signed Persona webhook and server-authoritative inquiry decision handling.
const PERSONA_IDENTITY_VERIFICATION_ENABLED = false;
const JSON_BODY_LIMIT_BYTES = Number(process.env.JSON_BODY_LIMIT_BYTES || 512 * 1024);
const ALLOWED_CORS_ORIGINS = new Set([
  "https://kerodexofficial.com",
  "https://www.kerodexofficial.com",
  "http://localhost:4100",
  "http://localhost:4101",
  "http://localhost:5173",
  "http://127.0.0.1:4100",
  "http://127.0.0.1:4101",
  "http://127.0.0.1:5173"
]);
const rateLimitBuckets = new Map();
const failedLoginAttempts = new Map();
const SAFETY_NOTICE_TEXT = "Safety reminder: Meet in a public, well-lit place. Bring another person if possible. Do not send deposits or payments before verifying the vehicle and documents in person. Verify the title, VIN, seller identity, and vehicle condition before completing a purchase. If anything feels suspicious, stop the conversation and report the user.";
const REPORT_CATEGORIES = new Set([
  "suspected_scam",
  "fake_listing",
  "stolen_photos",
  "vin_mismatch",
  "title_issue",
  "misleading_price",
  "dealer_or_commercial_listing",
  "prohibited_item",
  "unsafe_behavior",
  "spam",
  "payment_request",
  "harassment",
  "other"
]);
const REQUIRED_TITLE_STATUSES = new Set(["Clean Title", "Lienholder / Loan", "Rebuilt Title", "Salvage Title", "Lien Reported", "Not Sure"]);
const REQUIRED_ACCIDENT_OPTIONS = new Set(["No accidents reported", "Minor accident disclosed", "Major accident disclosed", "Not sure"]);
const REQUIRED_OWNER_OPTIONS = new Set(["One previous owner", "Two previous owners", "Three or more owners", "1 previous owner", "2 previous owners", "3+ previous owners", "Not sure"]);
const SELLER_CHECKLIST_KEYS = [
  "authorizedToList",
  "privateParty",
  "vinMatchesVehicle",
  "accurateInformation"
];
const BUYER_GUIDE_STEP_IDS = [
  "review_listing",
  "message_seller",
  "verify_title_ownership",
  "schedule_safe_meetup",
  "inspect_vehicle",
  "mechanic_inspection",
  "agree_on_price",
  "complete_paperwork",
  "make_payment_safely",
  "insurance_registration",
  "complete_purchase"
];
const PHONE_VERIFICATION_TTL_MS = 183 * 24 * 60 * 60 * 1000;

if (typeof store.setRuntimeUserProvider === "function") {
  store.setRuntimeUserProvider(() => Array.from(users.values()).map(adminRuntimeUser));
}

const adminRoles = {
  support_agent: ["dashboard:read", "users:read", "reports:read", "reports:write", "audit:read"],
  verification_specialist: ["dashboard:read", "users:read", "verifications:read", "verifications:write", "audit:read"],
  moderator: ["dashboard:read", "users:read", "listings:read", "listings:write", "reports:read", "reports:write", "fraud:read", "fraud:write", "audit:read"],
  administrator: ["dashboard:read", "users:read", "users:write", "listings:read", "listings:write", "verifications:read", "verifications:write", "reports:read", "reports:write", "fraud:read", "fraud:write", "analytics:read", "system:read", "audit:read"],
  super_admin: ["*"]
};

const adminAccount = {
  id: "adm_001",
  email: normalize(process.env.ADMIN_EMAIL || "founder@kerodexofficial.com"),
  name: "Kerodex Admin",
  role: "super_admin"
};
const ADMIN_SESSION_TTL_MS = 12 * 60 * 60 * 1000;

const mimeTypes = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp"
};

function securityHeaders() {
  const headers = {
    "x-content-type-options": "nosniff",
    "x-frame-options": "DENY",
    "referrer-policy": "strict-origin-when-cross-origin",
    "permissions-policy": "camera=(), microphone=(), geolocation=(self)",
    "cross-origin-opener-policy": "same-origin",
    "cross-origin-resource-policy": "same-site",
    "x-dns-prefetch-control": "off",
    "origin-agent-cluster": "?1"
  };
  if (IS_PRODUCTION) {
    headers["strict-transport-security"] = "max-age=15552000; includeSubDomains";
  }
  return headers;
}

function isAllowedCorsOrigin(origin = "") {
  if (!origin) return true;
  if (ALLOWED_CORS_ORIGINS.has(origin)) return true;
  if (!IS_PRODUCTION && /^http:\/\/(localhost|127\.0\.0\.1):\d+$/.test(origin)) return true;
  return false;
}

function corsHeaders(req) {
  const origin = String(req?.headers?.origin || "");
  if (!origin || !isAllowedCorsOrigin(origin)) return {};
  return {
    "access-control-allow-origin": origin,
    "access-control-allow-credentials": "true",
    vary: "Origin"
  };
}

function responseHeaders(res, extra = {}) {
  return {
    ...securityHeaders(),
    ...(res._kerodexCorsHeaders || {}),
    ...extra
  };
}

function sendJson(res, status, body) {
  const payload = IS_PRODUCTION && body && typeof body === "object"
    ? Object.fromEntries(Object.entries(body).filter(([key]) => !["detail", "stack"].includes(key)))
    : body;
  res.writeHead(status, responseHeaders(res, {
    "content-type": "application/json; charset=utf-8",
    "cache-control": "no-store"
  }));
  res.end(JSON.stringify(payload));
}

function redirect(res, location) {
  res.writeHead(302, responseHeaders(res, {
    location,
    "cache-control": "no-store"
  }));
  res.end();
}

function sendHtml(res, status, html) {
  res.writeHead(status, responseHeaders(res, {
    "content-type": "text/html; charset=utf-8",
    "cache-control": "no-store"
  }));
  res.end(html);
}

function sendCsv(res, fileName, csv) {
  res.writeHead(200, responseHeaders(res, {
    "content-type": "text/csv; charset=utf-8",
    "content-disposition": `attachment; filename="${fileName}"`,
    "cache-control": "no-store"
  }));
  res.end(csv);
}

function makePublicError(message, status = 400) {
  const error = new Error(message);
  error.status = status;
  error.publicMessage = message;
  return error;
}

function publicError(error, fallback = "Request failed.") {
  return error?.publicMessage || (IS_PRODUCTION ? fallback : error?.message || fallback);
}

function readJson(req, options = {}) {
  const maxBytes = Number(options.maxBytes || JSON_BODY_LIMIT_BYTES);
  return new Promise((resolve, reject) => {
    let body = "";
    let rejected = false;
    req.on("data", (chunk) => {
      if (rejected) return;
      body += chunk;
      if (Buffer.byteLength(body, "utf8") > maxBytes) {
        rejected = true;
        reject(makePublicError("Request body is too large.", 413));
      }
    });
    req.on("end", () => {
      if (rejected) return;
      if (!body) {
        resolve({});
        return;
      }
      try {
        resolve(JSON.parse(body));
      } catch (error) {
        reject(makePublicError("Invalid JSON request body.", 400));
      }
    });
    req.on("error", reject);
  });
}

function readText(req) {
  return new Promise((resolve, reject) => {
    let body = "";
    let rejected = false;
    req.on("data", (chunk) => {
      if (rejected) return;
      body += chunk;
      if (Buffer.byteLength(body, "utf8") > JSON_BODY_LIMIT_BYTES) {
        rejected = true;
        reject(makePublicError("Request body is too large.", 413));
      }
    });
    req.on("end", () => {
      if (!rejected) resolve(body);
    });
    req.on("error", reject);
  });
}

async function readForm(req) {
  const body = await readText(req);
  return Object.fromEntries(new URLSearchParams(body));
}

function makeToken() {
  return `krx_${Date.now().toString(36)}_${crypto.randomBytes(24).toString("base64url")}`;
}

function makeCode(length = 6) {
  const min = 10 ** (length - 1);
  const max = 9 * min;
  return String(crypto.randomInt(min, min + max));
}

function normalizePhone(value) {
  const digits = String(value || "").replace(/\D/g, "");
  if (digits.length === 10) return `+1${digits}`;
  if (digits.length === 11 && digits.startsWith("1")) return `+${digits}`;
  if (/^\+[1-9]\d{7,14}$/.test(String(value || "").trim())) return String(value || "").trim();
  return "";
}

function isFreshPhoneVerification(value) {
  const timestamp = Date.parse(value || "");
  return Boolean(timestamp && Date.now() - timestamp < PHONE_VERIFICATION_TTL_MS);
}

function phoneVerificationExpiresAt(value) {
  const timestamp = Date.parse(value || "");
  if (!timestamp) return "";
  return new Date(timestamp + PHONE_VERIFICATION_TTL_MS).toISOString();
}

function stripExpiredPhoneVerification(user) {
  if (!user) return user;
  if (!user.phoneVerified || isFreshPhoneVerification(user.phoneVerifiedAt)) return user;
  return {
    ...user,
    phone: "",
    phoneNumber: "",
    phoneVerified: false,
    phoneVerifiedAt: "",
    phoneVerificationExpiredAt: user.phoneVerificationExpiredAt || new Date().toISOString()
  };
}

function hasTwilioVerifyConfig() {
  return Boolean(process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN && process.env.TWILIO_VERIFY_SERVICE_SID);
}

function twilioVerifyClient() {
  if (!hasTwilioVerifyConfig()) {
    throw makePublicError("Phone verification is not configured yet.", 503);
  }
  return twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);
}

function phoneBucketKey(kind, value) {
  return `${kind}:${crypto.createHash("sha256").update(String(value || "")).digest("hex")}`;
}

function applyPhoneAttemptLimit({ userId, ip, phone, action }) {
  const now = Date.now();
  const windows = [
    { key: phoneBucketKey(`${action}:user`, userId), limit: action === "start" ? 4 : 8, windowMs: 15 * 60 * 1000 },
    { key: phoneBucketKey(`${action}:ip`, ip), limit: action === "start" ? 8 : 20, windowMs: 15 * 60 * 1000 },
    { key: phoneBucketKey(`${action}:phone`, phone), limit: action === "start" ? 3 : 8, windowMs: 60 * 60 * 1000 }
  ];
  for (const rule of windows) {
    const bucket = phoneVerificationBuckets.get(rule.key);
    const next = !bucket || bucket.resetAt <= now
      ? { count: 1, resetAt: now + rule.windowMs }
      : { count: bucket.count + 1, resetAt: bucket.resetAt };
    phoneVerificationBuckets.set(rule.key, next);
    if (next.count > rule.limit) {
      console.warn(`[Kerodex security] phone_verify_rate_limit action=${action} user=${userId} ip=${ip} phoneLast4=${String(phone).slice(-4)}`);
      return false;
    }
  }
  return true;
}

function applyPhoneResendCooldown({ userId, phone }) {
  const key = phoneBucketKey("start:cooldown", `${userId}:${phone}`);
  const now = Date.now();
  const lastSentAt = phoneVerificationCooldowns.get(key) || 0;
  if (now - lastSentAt < 60 * 1000) return false;
  phoneVerificationCooldowns.set(key, now);
  return true;
}

async function startPhoneVerificationWithProvider(phone) {
  const client = twilioVerifyClient();
  return client.verify.v2
    .services(process.env.TWILIO_VERIFY_SERVICE_SID)
    .verifications
    .create({ to: phone, channel: "sms" });
}

async function checkPhoneVerificationWithProvider(phone, code) {
  const client = twilioVerifyClient();
  return client.verify.v2
    .services(process.env.TWILIO_VERIFY_SERVICE_SID)
    .verificationChecks
    .create({ to: phone, code });
}

async function phoneBelongsToAnotherUser(phone, userId) {
  const normalized = normalizePhone(phone);
  if (!normalized) return false;
  if (typeof store.getUserByPhone === "function") {
    const owner = await store.getUserByPhone(normalized);
    return Boolean(owner && owner.id !== userId && owner.phoneVerified);
  }
  const storedUsers = typeof store.getUsers === "function" ? await store.getUsers() : [];
  const runtimeUsers = Array.from(users.values());
  return [...runtimeUsers, ...storedUsers].some((candidate) =>
    candidate?.id !== userId &&
    candidate?.phoneVerified &&
    isFreshPhoneVerification(candidate.phoneVerifiedAt) &&
    normalizePhone(candidate.phoneNumber || candidate.phone) === normalized
  );
}

function createReportRecord({ reporter, reportedUserId = "", listingId = "", messageId = "", conversationId = "", category = "other", description = "", source = "user_report", metadata = {} }) {
  const now = new Date().toISOString();
  const safeCategory = REPORT_CATEGORIES.has(String(category || "")) ? String(category) : "other";
  return {
    id: `rep_${Date.now().toString(36)}_${crypto.randomBytes(3).toString("hex")}`,
    type: safeCategory,
    category: safeCategory,
    reporterId: reporter?.id || "system",
    reporter: reporter?.name || reporter?.email || "Kerodex system",
    reportedUserId: normalizeLimitedString(reportedUserId, 80),
    reportedUser: normalizeLimitedString(reportedUserId, 80),
    listingId: normalizeLimitedString(listingId, 80),
    messageId: normalizeLimitedString(messageId, 80),
    conversationId: normalizeLimitedString(conversationId, 80),
    description: normalizeLimitedString(description, 1500),
    status: "open",
    priority: source === "scam_detector" ? "high" : "medium",
    source,
    createdAt: now,
    reviewedAt: "",
    adminNotes: "",
    metadata
  };
}

async function transferVerifiedPhoneOwnership(phone, user) {
  if (typeof store.getUserByPhone !== "function") return null;
  const owner = await store.getUserByPhone(phone);
  if (!owner || owner.id === user.id) return null;
  const previousOwner = {
    ...owner,
    phone: "",
    phoneNumber: "",
    phoneVerified: false,
    phoneVerifiedAt: "",
    phoneVerificationTransferredAt: new Date().toISOString(),
    phoneVerificationTransferredToUserId: user.id
  };
  await saveRuntimeUser(previousOwner);
  return owner;
}

function createBuyerGuideRecord({ buyer, listing }) {
  const now = new Date().toISOString();
  const sellerId = listing.userId || listing.seller?.id || "";
  return {
    id: `bg_${Date.now().toString(36)}_${crypto.randomBytes(4).toString("hex")}`,
    buyer_id: buyer.id,
    buyerId: buyer.id,
    listing_id: listing.id,
    listingId: listing.id,
    seller_id: sellerId,
    sellerId,
    status: "active",
    current_step: BUYER_GUIDE_STEP_IDS[0],
    currentStep: BUYER_GUIDE_STEP_IDS[0],
    completed_steps: [],
    completedSteps: [],
    buyer_state: "",
    buyerState: "",
    seller_state: "",
    sellerState: "",
    notes: {},
    created_at: now,
    createdAt: now,
    updated_at: now,
    updatedAt: now
  };
}

function createDiscoveryBuyerGuideRecord(user = null) {
  const now = new Date().toISOString();
  const buyerId = user?.id || null;
  return {
    id: `bgs_${Date.now().toString(36)}_${crypto.randomBytes(5).toString("hex")}`,
    buyer_id: buyerId,
    buyerId,
    listing_id: null,
    listingId: null,
    seller_id: null,
    sellerId: null,
    journey_type: "discovery",
    journeyType: "discovery",
    status: "active",
    current_stage: "understand_buyer",
    currentStage: "understand_buyer",
    current_step: "purpose",
    currentStep: "purpose",
    buyer_answers: {},
    buyerAnswers: {},
    buyer_profile: {},
    buyerProfile: {},
    recommendations: null,
    listing_matches: [],
    listingMatches: [],
    selected_listing_id: null,
    selectedListingId: null,
    safety_red_flags: [],
    safetyRedFlags: [],
    completed_steps: [],
    completedSteps: [],
    notes: {},
    created_at: now,
    createdAt: now,
    updated_at: now,
    updatedAt: now
  };
}

async function getBuyerGuideSession(id, user = null) {
  const persisted = typeof store.getBuyerGuideById === "function" ? await store.getBuyerGuideById(id) : null;
  if (persisted) {
    const ownerId = persisted.buyer_id || persisted.buyerId;
    return user && ownerId === user.id ? persisted : null;
  }
  const guest = guestBuyerGuideSessions.get(id) || null;
  return guest && !(guest.buyer_id || guest.buyerId) ? guest : null;
}

async function saveBuyerGuideSession(session) {
  const now = new Date().toISOString();
  const next = { ...session, updated_at: now, updatedAt: now };
  if (next.buyer_id || next.buyerId) {
    guestBuyerGuideSessions.delete(next.id);
    return store.saveBuyerGuide(next);
  }
  guestBuyerGuideSessions.set(next.id, next);
  return next;
}

async function decorateBuyerGuide(guide) {
  if (!guide) return null;
  const listingId = guide.listing_id || guide.listingId;
  const sellerId = guide.seller_id || guide.sellerId;
  const listing = listingId ? await store.getListingById(listingId) : null;
  const seller = sellerId && typeof store.getSellerById === "function" ? await store.getSellerById(sellerId) : null;
  return {
    ...guide,
    buyer_id: guide.buyer_id || guide.buyerId,
    buyerId: guide.buyerId || guide.buyer_id,
    listing_id: listingId,
    listingId,
    seller_id: sellerId,
    sellerId,
    current_step: guide.current_step || guide.currentStep || BUYER_GUIDE_STEP_IDS[0],
    currentStep: guide.currentStep || guide.current_step || BUYER_GUIDE_STEP_IDS[0],
    completed_steps: Array.isArray(guide.completed_steps) ? guide.completed_steps : (guide.completedSteps || []),
    completedSteps: Array.isArray(guide.completedSteps) ? guide.completedSteps : (guide.completed_steps || []),
    buyer_state: guide.buyer_state || guide.buyerState || "",
    buyerState: guide.buyerState || guide.buyer_state || "",
    seller_state: guide.seller_state || guide.sellerState || "",
    sellerState: guide.sellerState || guide.seller_state || "",
    updated_at: guide.updated_at || guide.updatedAt,
    updatedAt: guide.updatedAt || guide.updated_at,
    listing: listing ? listingWithReadableImages(listing) : null,
    seller: seller ? sellerWithReadableImages(seller) : {
      id: sellerId,
      name: listing?.seller?.name || listing?.sellerName || "Kerodex seller",
      verification: {
        email: Boolean(listing?.seller?.emailVerified),
        phone: Boolean(listing?.seller?.phoneVerified),
        identity: Boolean(listing?.seller?.verified)
      }
    }
  };
}

function eventFromRequest(req, eventType, user = null, metadata = {}) {
  const requestUrl = new URL(req.url, `http://${req.headers.host}`);
  const forwarded = String(req.headers["x-forwarded-for"] || "").split(",")[0].trim();
  const ip = forwarded || req.socket.remoteAddress || "local";
  return {
    id: `evt_${Date.now().toString(36)}_${crypto.randomBytes(4).toString("hex")}`,
    eventType,
    userId: user?.id || "",
    sessionId: String(req.headers["x-kerodex-session"] || req.headers["cf-ray"] || ""),
    ipHash: crypto.createHash("sha256").update(`${ip}:${process.env.ANALYTICS_IP_SALT || "kerodex-local"}`).digest("hex").slice(0, 24),
    route: metadata.route || requestUrl.pathname,
    listingId: metadata.listingId || "",
    conversationId: metadata.conversationId || "",
    relatedEntityType: metadata.relatedEntityType || "",
    relatedEntityId: metadata.relatedEntityId || "",
    city: metadata.city || "",
    state: metadata.state || "",
    country: metadata.country || "",
    metadata,
    userAgent: String(req.headers["user-agent"] || ""),
    referrer: String(req.headers.referer || req.headers.referrer || ""),
    createdAt: new Date().toISOString()
  };
}

function requestIp(req) {
  const forwarded = String(req.headers["x-forwarded-for"] || "").split(",")[0].trim();
  return forwarded || req.socket.remoteAddress || "local";
}

function rateLimitCategory(pathname, method = "GET") {
  if (pathname === "/api/health") return null;
  if (
    pathname === "/api/auth/phone/status" ||
    pathname === "/api/auth/phone/start" ||
    pathname === "/api/auth/phone/check" ||
    pathname === "/api/me/phone/start" ||
    pathname === "/api/me/phone/verify"
  ) {
    return { name: "phone_verify", limit: 80, windowMs: 15 * 60 * 1000 };
  }
  if (pathname === "/api/auth/google" || pathname === "/api/auth/microsoft") {
    return { name: `oauth_start:${pathname.split("/").pop()}`, limit: 30, windowMs: 15 * 60 * 1000 };
  }
  if (pathname.startsWith("/api/auth/callback/")) {
    return { name: `oauth_callback:${pathname.split("/").pop()}`, limit: 20, windowMs: 15 * 60 * 1000 };
  }
  if (pathname === "/api/admin/auth/login") {
    return { name: "admin_auth", limit: 10, windowMs: 15 * 60 * 1000 };
  }
  if (pathname.startsWith("/api/admin/")) {
    return { name: "admin_api", limit: 600, windowMs: 15 * 60 * 1000 };
  }
  if (pathname.startsWith("/api/buyer-guide/")) {
    return { name: "buyer_guide", limit: 80, windowMs: 15 * 60 * 1000 };
  }
  if (
    pathname === "/api/auth/email" ||
    pathname === "/api/auth/password/forgot" ||
    pathname === "/api/auth/password/reset"
  ) {
    return { name: `auth:${pathname}`, limit: 10, windowMs: 15 * 60 * 1000 };
  }
  if (/^\/api\/uploads\b/.test(pathname) || /verification|vehicle-presence|documents\/ocr|persona|phone/i.test(pathname)) {
    return { name: "verification_upload", limit: 20, windowMs: 60 * 60 * 1000 };
  }
  if (method === "GET" || method === "HEAD") {
    return { name: "public_read", limit: 1200, windowMs: 15 * 60 * 1000 };
  }
  return { name: "general_write", limit: 200, windowMs: 15 * 60 * 1000 };
}

const EVENT_NAME_ALIASES = {
  signup: "user_signed_up",
  login: "user_logged_in",
  create_listing: "listing_submitted",
  update_listing: "listing_updated",
  listing_view: "listing_viewed",
  save_listing: "listing_saved",
  unsave_listing: "listing_unsaved",
  send_message: "message_sent",
  report_listing: "report_submitted",
  report_user: "report_submitted",
  phone_verified: "phone_verification_passed",
  buyer_guide_discovery_started: "buyer_guide_started",
  buyer_guide_recommendations_generated: "buyer_guide_completed",
  buyer_guide_listing_selected: "buyer_guide_listing_recommended"
};

function canonicalEventName(eventType) {
  return EVENT_NAME_ALIASES[eventType] || eventType;
}

function applyRateLimit(req, res, pathname) {
  if (!pathname.startsWith("/api/")) return true;
  const category = rateLimitCategory(pathname, req.method);
  if (!category) return true;
  const ip = requestIp(req);
  const key = `${category.name}:${ip}`;
  const now = Date.now();
  const bucket = rateLimitBuckets.get(key);
  const nextBucket = !bucket || bucket.resetAt <= now
    ? { count: 1, resetAt: now + category.windowMs }
    : { count: bucket.count + 1, resetAt: bucket.resetAt };
  rateLimitBuckets.set(key, nextBucket);
  if (nextBucket.count <= category.limit) return true;
  console.warn(`[Kerodex security] rate_limit category=${category.name} ip=${ip} path=${pathname}`);
  trackSystemEvent("rate_limit_hit", { route: pathname, category: category.name }).catch(() => {});
  sendJson(res, 429, {
    success: false,
    error: "Too many requests. Please try again later.",
    retryAfterSeconds: Math.max(1, Math.ceil((nextBucket.resetAt - now) / 1000))
  });
  return false;
}

function pruneRateLimitBuckets() {
  const now = Date.now();
  for (const [key, bucket] of rateLimitBuckets.entries()) {
    if (bucket.resetAt <= now) rateLimitBuckets.delete(key);
  }
  for (const [key, attempt] of failedLoginAttempts.entries()) {
    if (attempt.resetAt <= now) failedLoginAttempts.delete(key);
  }
  for (const [key, bucket] of phoneVerificationBuckets.entries()) {
    if (bucket.resetAt <= now) phoneVerificationBuckets.delete(key);
  }
  for (const [key, lastSentAt] of phoneVerificationCooldowns.entries()) {
    if (now - lastSentAt > 15 * 60 * 1000) phoneVerificationCooldowns.delete(key);
  }
  for (const [key, session] of guestBuyerGuideSessions.entries()) {
    if (now - Date.parse(session.updated_at || session.updatedAt || session.created_at || session.createdAt || 0) > 24 * 60 * 60 * 1000) {
      guestBuyerGuideSessions.delete(key);
    }
  }
}

setInterval(pruneRateLimitBuckets, 5 * 60 * 1000).unref();

async function trackEvent(req, eventType, user = null, metadata = {}) {
  if (typeof store.trackEvent !== "function") return null;
  try {
    return await store.trackEvent(eventFromRequest(req, canonicalEventName(eventType), user, metadata));
  } catch (error) {
    console.warn(`[Kerodex] Unable to track event ${eventType}: ${error.message}`);
    return null;
  }
}

async function auditMarketplaceAction(req, actionType, targetType, targetId, actor = null, details = {}) {
  if (typeof store.saveAuditLog !== "function") return null;
  try {
    const log = {
      id: `audit_${Date.now().toString(36)}_${crypto.randomBytes(4).toString("hex")}`,
      timestamp: new Date().toISOString(),
      adminAccount: actor?.email || actor?.id || "system",
      actionType,
      targetType,
      targetId: normalizeLimitedString(targetId, 120),
      previousValue: details.previousValue ?? null,
      newValue: details.newValue ?? null,
      notes: normalizeLimitedString(details.notes || "", 1000),
      actorId: actor?.id || "",
      actorType: details.actorType || (actor ? "user" : "system"),
      ipHash: crypto.createHash("sha256").update(`${requestIp(req)}:${process.env.ANALYTICS_IP_SALT || "kerodex-local"}`).digest("hex").slice(0, 24),
      metadata: details.metadata || {},
      immutable: true
    };
    return await store.saveAuditLog(log);
  } catch (error) {
    console.warn(`[Kerodex] Unable to write audit log ${actionType}: ${error.message}`);
    return null;
  }
}

async function saveReport(report) {
  if (typeof store.createReport === "function") return store.createReport(report);
  return report;
}

function scanMessageForScamRisk(content) {
  const text = String(content || "").toLowerCase();
  const checks = [
    { flag: "off_platform_contact", weight: 25, patterns: [/text me/i, /call me/i, /whatsapp/i, /telegram/i, /email me/i, /\b\d{3}[-.\s]?\d{3}[-.\s]?\d{4}\b/] },
    { flag: "advance_payment", weight: 35, patterns: [/deposit/i, /wire/i, /zelle/i, /cashapp/i, /venmo/i, /gift card/i, /crypto/i, /bitcoin/i] },
    { flag: "shipping_pressure", weight: 25, patterns: [/ship(ping)? agent/i, /mover/i, /transport company/i, /out of state/i] },
    { flag: "urgency_pressure", weight: 15, patterns: [/today only/i, /urgent/i, /asap/i, /first come/i, /hold it/i] },
    { flag: "document_evasion", weight: 30, patterns: [/no title/i, /lost title/i, /can't show/i, /won't show/i, /skip/i] }
  ];
  const flags = checks
    .filter((check) => check.patterns.some((pattern) => pattern.test(text)))
    .map((check) => check.flag);
  const score = checks
    .filter((check) => flags.includes(check.flag))
    .reduce((total, check) => total + check.weight, 0);
  const scamRiskScore = Math.min(100, score);
  let moderationStatus = "clear";
  if (scamRiskScore >= 70) moderationStatus = "high_risk";
  else if (scamRiskScore >= 35) moderationStatus = "needs_review";
  return { scamRiskScore, scamFlags: flags, moderationStatus };
}

function publicAdmin(admin) {
  return {
    id: admin.id,
    email: admin.email,
    name: admin.name,
    role: admin.role,
    permissions: adminRoles[admin.role] || []
  };
}

function hasAdminPermission(admin, permission) {
  const permissions = adminRoles[admin.role] || [];
  return permissions.includes("*") || permissions.includes(permission);
}

function getAdminFromRequest(req) {
  const auth = req.headers.authorization || "";
  const requestUrl = new URL(req.url, `http://${req.headers.host}`);
  const token = auth.startsWith("Bearer ") ? auth.slice(7) : requestUrl.searchParams.get("token") || "";
  const session = adminSessions.get(token);
  if (!session) return null;
  if (session.expiresAt <= Date.now()) {
    adminSessions.delete(token);
    return null;
  }
  return session.adminId === adminAccount.id ? adminAccount : null;
}

function requireAdmin(req, res, permission) {
  const admin = getAdminFromRequest(req);
  if (!admin) {
    sendJson(res, 401, { error: "Admin sign-in required." });
    return null;
  }
  if (permission && !hasAdminPermission(admin, permission)) {
    sendJson(res, 403, { error: "This admin role cannot access that resource.", requiredPermission: permission });
    return null;
  }
  return admin;
}

function adminLogin(body) {
  const code = String(body.accessCode || "");
  const expectedCode = String(process.env.ADMIN_ACCESS_CODE || "");
  if (!expectedCode || !code) return null;
  const actualBuffer = Buffer.from(code);
  const expectedBuffer = Buffer.from(expectedCode);
  if (actualBuffer.length !== expectedBuffer.length || !crypto.timingSafeEqual(actualBuffer, expectedBuffer)) return null;
  const token = makeToken();
  adminSessions.set(token, {
    adminId: adminAccount.id,
    expiresAt: Date.now() + ADMIN_SESSION_TTL_MS
  });
  return { token, admin: publicAdmin(adminAccount) };
}

function sendAdminEvents(req, res) {
  const admin = requireAdmin(req, res, "dashboard:read");
  if (!admin) return;

  res.writeHead(200, {
    ...securityHeaders(),
    ...(res._kerodexCorsHeaders || {}),
    "content-type": "text/event-stream",
    "cache-control": "no-cache",
    connection: "keep-alive"
  });

  res.write(`: admin event stream connected for ${admin.role}\n\n`);
  const heartbeat = setInterval(() => res.write(`: heartbeat ${Date.now()}\n\n`), 30000);
  req.on("close", () => clearInterval(heartbeat));
}

function publicUser(user) {
  const safeUser = stripExpiredPhoneVerification(user) || {};
  const avatarS3Key = safeUser.avatarS3Key || safeUser.profileImageS3Key || "";
  return {
    id: safeUser.id,
    email: safeUser.email,
    name: safeUser.name,
    firstName: safeUser.firstName || "",
    lastName: safeUser.lastName || "",
    username: safeUser.username || "",
    birthday: safeUser.birthday || "",
    phone: safeUser.phoneNumber || safeUser.phone || "",
    phoneVerifiedAt: safeUser.phoneVerifiedAt || safeUser.phone_verified_at || "",
    phoneVerificationExpiresAt: phoneVerificationExpiresAt(safeUser.phoneVerifiedAt || safeUser.phone_verified_at),
    provider: safeUser.provider,
    emailVerified: Boolean(safeUser.emailVerified),
    phoneVerified: Boolean(safeUser.phoneVerified && isFreshPhoneVerification(safeUser.phoneVerifiedAt)),
    identityVerified: PERSONA_IDENTITY_VERIFICATION_ENABLED && Boolean(safeUser.identityVerified),
    selfieVerified: PERSONA_IDENTITY_VERIFICATION_ENABLED && Boolean(safeUser.selfieVerified),
    personaInquiryId: safeUser.personaInquiryId || "",
    personaReferenceId: safeUser.personaReferenceId || "",
    identityVerificationStatus: PERSONA_IDENTITY_VERIFICATION_ENABLED
      ? safeUser.identityVerificationStatus || "unverified"
      : "unverified",
    identityVerifiedAt: safeUser.identityVerifiedAt || "",
    avatarUrl: avatarS3Key ? createS3PresignedGet(avatarS3Key, 3600) || safeUser.avatarUrl || safeUser.profileImageUrl || "" : safeUser.avatarUrl || safeUser.profileImageUrl || "",
    avatarS3Key,
    favoriteBrands: Array.isArray(safeUser.favoriteBrands) ? safeUser.favoriteBrands : [],
    preferredVehicleTypes: Array.isArray(safeUser.preferredVehicleTypes) ? safeUser.preferredVehicleTypes : [],
    onboardingCompleted: Boolean(safeUser.onboardingCompleted),
    onboardingCompletedAt: safeUser.onboardingCompletedAt || "",
    featureTourCompletedAt: safeUser.featureTourCompletedAt || safeUser.feature_tour_completed_at || "",
    lastActiveAt: safeUser.lastActiveAt || safeUser.lastLoginAt || "",
    termsVersion: safeUser.termsVersion || "",
    acceptedTermsAt: safeUser.acceptedTermsAt || "",
    privacyVersion: safeUser.privacyVersion || "",
    acceptedPrivacyAt: safeUser.acceptedPrivacyAt || "",
    safetyNoticeSeenAt: safeUser.safetyNoticeSeenAt || "",
    createdAt: safeUser.createdAt || safeUser.acceptedTermsAt || ""
  };
}

function adminRuntimeUser(user) {
  const createdAt = user.createdAt || new Date().toISOString();
  const lastLoginAt = user.lastLoginAt || createdAt;
  return {
    id: user.id,
    fullName: user.name || user.email.split("@")[0],
    email: user.email,
    phone: user.phoneNumber || user.phone || "",
    role: "buyer",
    status: "active",
    accountCreatedAt: createdAt,
    lastLoginAt,
    verificationStatus: user.emailVerified ? "approved" : "pending",
    profileCompletion: user.emailVerified ? 35 : 15,
    listingCount: 0,
    messagesSent: 0,
    reportsReceived: 0,
    shadowBanned: false,
    messagingDisabled: false,
    listingCreationDisabled: false,
    internalNotes: user.provider === "email" && !user.emailVerified ? "Email verification pending." : "",
    loginHistory: [{ at: lastLoginAt, ip: "local", region: "Local development" }],
    ipHistory: ["local"],
    deviceHistory: [user.provider || "email"],
    timeline: [
      { at: createdAt, event: "Account created", detail: user.provider || "email" },
      { at: lastLoginAt, event: "Signed in", detail: user.emailVerified ? "verified account" : "verification pending" }
    ]
  };
}

function getAuthUser(req) {
  const auth = req.headers.authorization || "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7) : "";
  const userId = sessions.get(token);
  if (!userId) return null;
  const user = Array.from(users.values()).find((item) => item.id === userId) || null;
  if (["banned", "suspended", "deleted"].includes(String(user?.status || "").toLowerCase())) return null;
  if (user) user.lastActiveAt = new Date().toISOString();
  return user;
}

function authTokenFromRequest(req) {
  const auth = req.headers.authorization || "";
  return auth.startsWith("Bearer ") ? auth.slice(7) : "";
}

async function invalidateSession(token) {
  if (!token) return;
  sessions.delete(token);
  if (typeof store.deleteAuthSession === "function") {
    await store.deleteAuthSession(token);
  }
}

async function trackSystemEvent(eventType, metadata = {}) {
  if (typeof store.trackEvent !== "function") return null;
  try {
    return await store.trackEvent({
      id: `evt_${Date.now().toString(36)}_${crypto.randomBytes(4).toString("hex")}`,
      eventType: canonicalEventName(eventType),
      userId: metadata.userId || "",
      sessionId: "",
      ipHash: "",
      route: metadata.route || "system",
      listingId: metadata.listingId || "",
      conversationId: metadata.conversationId || "",
      relatedEntityType: metadata.relatedEntityType || "",
      relatedEntityId: metadata.relatedEntityId || "",
      metadata,
      userAgent: "kerodex-server",
      referrer: "",
      createdAt: new Date().toISOString()
    });
  } catch (error) {
    console.warn(`[Kerodex] Unable to track system event ${eventType}: ${error.message}`);
    return null;
  }
}

function estimatedUnitCost(serviceName) {
  const costs = {
    openai: Number(process.env.COST_OPENAI_VEHICLE_VERIFICATION || 0.01),
    persona: Number(process.env.COST_PERSONA_VERIFICATION || 1),
    twilio: Number(process.env.COST_TWILIO_SMS_VERIFICATION || 0.05),
    marketcheck: Number(process.env.COST_MARKETCHECK_REQUEST || 0.01),
    s3: Number(process.env.COST_S3_UPLOAD_ESTIMATE || 0.001)
  };
  return Number.isFinite(costs[serviceName]) ? costs[serviceName] : 0;
}

async function recordCost(serviceName, actionType, details = {}) {
  if (typeof store.saveCostRecord !== "function") return null;
  try {
    const unitsUsed = Number(details.unitsUsed ?? 1);
    const record = {
      id: `cost_${Date.now().toString(36)}_${crypto.randomBytes(4).toString("hex")}`,
      serviceName,
      actionType,
      userId: details.userId || "",
      listingId: details.listingId || "",
      requestId: details.requestId || "",
      status: details.status || "success",
      unitsUsed: Number.isFinite(unitsUsed) ? unitsUsed : null,
      estimatedCost: Number(details.estimatedCost ?? (estimatedUnitCost(serviceName) * (Number.isFinite(unitsUsed) ? unitsUsed : 1))),
      metadata: details.metadata || {},
      createdAt: new Date().toISOString()
    };
    await store.saveCostRecord(record);
    await trackSystemEvent("api_cost_recorded", {
      userId: record.userId,
      listingId: record.listingId,
      serviceName,
      actionType,
      status: record.status,
      estimatedCost: record.estimatedCost
    });
    return record;
  } catch (error) {
    console.warn(`[Kerodex] Unable to record ${serviceName} cost: ${error.message}`);
    return null;
  }
}

function defaultProfileIconUrl(seed) {
  const value = String(seed || "kerodex-user");
  let hash = 0;
  for (let index = 0; index < value.length; index += 1) {
    hash = ((hash << 5) - hash) + value.charCodeAt(index);
    hash |= 0;
  }
  return `/pfpicon${Math.abs(hash) % 10}.png`;
}

async function invalidateUserSessions(userId) {
  const tokens = Array.from(sessions.entries())
    .filter(([, sessionUserId]) => sessionUserId === userId)
    .map(([token]) => token);
  await Promise.all(tokens.map((token) => invalidateSession(token)));
}

function createSession(user) {
  const token = makeToken();
  user.lastLoginAt = new Date().toISOString();
  user.lastActiveAt = user.lastLoginAt;
  sessions.set(token, user.id);
  saveRuntimeUser(user).catch(() => {});
  if (typeof store.saveAuthSession === "function") {
    store.saveAuthSession({
      token,
      userId: user.id,
      createdAt: user.lastLoginAt,
      lastSeenAt: user.lastActiveAt
    }).catch(() => {});
  }
  return { token, user: publicUser(user) };
}

async function hydrateRuntimeAuthFromStore() {
  if (typeof store.getUsers === "function") {
    const storedUsers = await store.getUsers();
    storedUsers.forEach((user) => {
      const safeUser = stripExpiredPhoneVerification(user);
      if (safeUser?.email) users.set(normalize(safeUser.email), safeUser);
    });
  }
  if (typeof store.getActiveAuthSessions === "function") {
    const storedSessions = await store.getActiveAuthSessions();
    storedSessions.forEach((session) => {
      if (session?.token && session?.userId) sessions.set(session.token, session.userId);
    });
    if (storedSessions.length) {
      console.log(`[Kerodex] Restored ${storedSessions.length} auth session${storedSessions.length === 1 ? "" : "s"} from storage.`);
    }
  }
}

async function findUserByEmail(email) {
  const normalized = normalize(email);
  if (!normalized) return null;
  const cached = users.get(normalized);
  if (cached) return stripExpiredPhoneVerification(cached);
  if (typeof store.getUserByEmail === "function") {
    const stored = await store.getUserByEmail(normalized);
    if (stored) {
      const safeUser = stripExpiredPhoneVerification(stored);
      users.set(normalized, safeUser);
      return safeUser;
    }
  }
  return null;
}

async function saveRuntimeUser(user) {
  if (!user?.email) return user;
  user = stripExpiredPhoneVerification(user);
  user.email = normalize(user.email);
  Array.from(users.entries()).forEach(([email, cached]) => {
    if (cached?.id === user.id && email !== user.email) users.delete(email);
  });
  users.set(user.email, user);
  if (typeof store.saveUser === "function") await store.saveUser(user);
  return user;
}

async function deleteRuntimeUserAccount(user) {
  if (!user?.id) return;
  const id = user.id;
  if (typeof store.deleteUserAccount === "function") {
    await store.deleteUserAccount(id);
  }
  Array.from(sessions.entries()).forEach(([token, userId]) => {
    if (userId === id) sessions.delete(token);
  });
  Array.from(users.entries()).forEach(([email, cached]) => {
    if (cached?.id === id) users.delete(email);
  });
}

function normalizeUsername(value) {
  return String(value || "").trim().toLowerCase().replace(/[^a-z0-9_]/g, "");
}

async function isUsernameAvailable(username, currentUserId = "") {
  const normalized = normalizeUsername(username);
  if (!normalized || normalized.length < 3) return false;
  const runtimeUsers = Array.from(users.values());
  const storedUsers = typeof store.getUsers === "function" ? await store.getUsers() : [];
  return [...runtimeUsers, ...storedUsers].every((user) => {
    if (!user?.username) return true;
    return normalizeUsername(user.username) !== normalized || user.id === currentUserId;
  });
}

function nextUserId() {
  return `usr_${Date.now().toString(36)}_${crypto.randomBytes(3).toString("hex")}`;
}

async function upsertSocialUser(provider) {
  const email = provider === "microsoft" ? "microsoft.demo@kerodex.local" : "google.demo@kerodex.local";
  const existing = await findUserByEmail(email);
  if (existing) return existing;

  const user = {
    id: nextUserId(),
    email,
    name: provider === "microsoft" ? "Microsoft Demo User" : "Google Demo User",
    password: null,
    provider,
    emailVerified: false,
    phoneVerified: false,
    identityVerified: false,
    selfieVerified: false,
    personaInquiryId: "",
    personaReferenceId: "",
    identityVerificationStatus: "unverified",
    identityVerifiedAt: "",
    featureTourCompletedAt: "",
    createdAt: new Date().toISOString(),
    lastLoginAt: null
  };
  return saveRuntimeUser(user);
}

async function upsertOAuthUser(provider, profile, legalConsent = {}) {
  const email = normalize(profile.email);
  if (!email) throw new Error("The provider did not return an email address.");
  const existing = await findUserByEmail(email);
  if (existing) {
    existing.provider = existing.provider || provider;
    existing.emailVerified = Boolean(profile.emailVerified || existing.emailVerified);
    existing.name = existing.name || profile.name || email.split("@")[0];
    if (legalConsent.termsAccepted && legalConsent.privacyAccepted && !existing.acceptedTermsAt) {
      const acceptedAt = new Date().toISOString();
      existing.termsVersion = TERMS_VERSION;
      existing.acceptedTermsAt = acceptedAt;
      existing.privacyVersion = PRIVACY_VERSION;
      existing.acceptedPrivacyAt = acceptedAt;
    }
    return saveRuntimeUser(existing);
  }

  if (!legalConsent.termsAccepted || !legalConsent.privacyAccepted) {
    const error = new Error(`No account found with this ${provider === "microsoft" ? "Microsoft" : "Google"} login. Please create an account first.`);
    error.code = "oauth_account_missing";
    throw error;
  }

  const acceptedAt = new Date().toISOString();

  const user = {
    id: nextUserId(),
    email,
    name: profile.name || email.split("@")[0],
    firstName: String(profile.name || "").trim().split(/\s+/)[0] || "",
    lastName: String(profile.name || "").trim().split(/\s+/).slice(1).join(" "),
    username: "",
    birthday: "",
    onboardingCompleted: false,
    featureTourCompletedAt: "",
    favoriteBrands: [],
    preferredVehicleTypes: [],
    password: null,
    provider,
    emailVerified: Boolean(profile.emailVerified),
    phoneVerified: false,
    identityVerified: false,
    selfieVerified: false,
    personaInquiryId: "",
    personaReferenceId: "",
    identityVerificationStatus: "unverified",
    identityVerifiedAt: "",
    termsVersion: TERMS_VERSION,
    acceptedTermsAt: acceptedAt,
    privacyVersion: PRIVACY_VERSION,
    acceptedPrivacyAt: acceptedAt,
    createdAt: new Date().toISOString(),
    lastLoginAt: null
  };
  return saveRuntimeUser(user);
}

function appOrigin(req) {
  const proto = req.headers["x-forwarded-proto"] || "http";
  return `${proto}://${req.headers.host}`;
}

function isLocalRequest(req) {
  const host = String(req.headers.host || "");
  return host.startsWith("localhost:") || host.startsWith("127.0.0.1:");
}

function s3Config() {
  const region = process.env.AWS_REGION || process.env.S3_REGION || "";
  const bucket = process.env.S3_BUCKET || "";
  const accessKeyId = process.env.AWS_ACCESS_KEY_ID || "";
  const secretAccessKey = process.env.AWS_SECRET_ACCESS_KEY || "";
  const publicBaseUrl = String(process.env.S3_PUBLIC_BASE_URL || "").replace(/\/+$/, "");
  const missing = [];
  if (!region) missing.push("AWS_REGION");
  if (!bucket) missing.push("S3_BUCKET");
  if (!accessKeyId) missing.push("AWS_ACCESS_KEY_ID");
  if (!secretAccessKey) missing.push("AWS_SECRET_ACCESS_KEY");
  if (!publicBaseUrl) missing.push("S3_PUBLIC_BASE_URL");
  if (missing.length) return { missing };
  return { region, bucket, accessKeyId, secretAccessKey, publicBaseUrl };
}

function hmac(key, value, encoding) {
  return crypto.createHmac("sha256", key).update(value, "utf8").digest(encoding);
}

function sha256(value) {
  return crypto.createHash("sha256").update(value, "utf8").digest("hex");
}

function encodeRfc3986(value) {
  return encodeURIComponent(value).replace(/[!'()*]/g, (char) => `%${char.charCodeAt(0).toString(16).toUpperCase()}`);
}

function s3PublicUrl(bucket, region, key) {
  const base = String(process.env.S3_PUBLIC_BASE_URL || "").replace(/\/+$/, "");
  if (base) return `${base}/${key.split("/").map(encodeRfc3986).join("/")}`;
  return `s3://${bucket}/${key}`;
}

function uploadPurposeConfig(purpose = "listing-photo", contentType = "", documentType = "") {
  const normalizedDocumentType = String(documentType || "").toLowerCase();
  const normalizedPurpose = String(purpose || "").toLowerCase();
  const isProfilePicture = ["profile-picture", "profile-photo", "avatar", "user-avatar"].includes(normalizedPurpose);
  const isTitleDocument = purpose === "title-document" || normalizedDocumentType === "title";
  const isMaintenanceDocument = purpose === "maintenance-document" || purpose === "document" || normalizedDocumentType === "maintenance";
  const isPresence = purpose === "vehicle-presence" || purpose === "verification-photo";
  const isImage = /^image\/(jpeg|png|webp)$/i.test(contentType || "");
  const isPdf = /^application\/pdf$/i.test(contentType || "");
  if (isProfilePicture) {
    return {
      prefix: "profile-pictures",
      allowed: isImage,
      maxBytes: 5 * 1024 * 1024,
      message: "Only JPEG, PNG, and WebP images can be uploaded as profile pictures."
    };
  }
  if (isPresence) {
    return {
      prefix: "verification",
      allowed: isImage,
      maxBytes: 10 * 1024 * 1024,
      message: "Only JPEG, PNG, and WebP images can be uploaded as verification photos."
    };
  }
  if (isTitleDocument) {
    return {
      prefix: "title-documents",
      allowed: isImage || isPdf,
      maxBytes: 15 * 1024 * 1024,
      message: "Only PDF, JPEG, PNG, and WebP files can be uploaded as title documents."
    };
  }
  if (isMaintenanceDocument) {
    return {
      prefix: "maintenance-records",
      allowed: isImage || isPdf,
      maxBytes: 15 * 1024 * 1024,
      message: "Only PDF, JPEG, PNG, and WebP files can be uploaded as maintenance records."
    };
  }
  return {
    prefix: "listings",
    allowed: isImage,
    maxBytes: 10 * 1024 * 1024,
    message: "Only JPEG, PNG, and WebP images can be uploaded."
  };
}

function extensionMatchesContentType(extension, contentType) {
  const ext = String(extension || "").toLowerCase();
  const type = String(contentType || "").toLowerCase();
  const allowed = {
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".png": "image/png",
    ".webp": "image/webp",
    ".pdf": "application/pdf"
  };
  return Boolean(allowed[ext] && allowed[ext] === type);
}

function createS3PresignedPut({ fileName, contentType, fileSize = 0, user, purpose = "listing-photo", documentType = "" }) {
  const config = s3Config();
  if (config?.missing?.length) {
    const error = new Error(`S3 uploads are not configured. Missing: ${config.missing.join(", ")}.`);
    error.status = 503;
    throw error;
  }
  const uploadPurpose = uploadPurposeConfig(purpose, contentType, documentType);
  if (!uploadPurpose.allowed) {
    const error = new Error(uploadPurpose.message);
    error.status = 400;
    throw error;
  }
  const size = Number(fileSize || 0);
  if (!Number.isFinite(size) || size <= 0) {
    const error = new Error("File size is required before generating an S3 upload URL.");
    error.status = 400;
    throw error;
  }
  if (size > uploadPurpose.maxBytes) {
    const error = new Error(`File is too large. Max upload size is ${Math.round(uploadPurpose.maxBytes / 1024 / 1024)} MB.`);
    error.status = 400;
    throw error;
  }

  const extension = path.extname(String(fileName || "")).toLowerCase().replace(/[^a-z0-9.]/g, "") || "";
  if (!extension || !extensionMatchesContentType(extension, contentType)) {
    const error = new Error("File extension does not match the uploaded file type.");
    error.status = 400;
    throw error;
  }
  const safeUserId = String(user.id || "user").replace(/[^a-zA-Z0-9_-]/g, "");
  const key = `${uploadPurpose.prefix}/${safeUserId}/${Date.now()}-${crypto.randomBytes(8).toString("hex")}${extension}`;
  const host = `${config.bucket}.s3.${config.region}.amazonaws.com`;
  const now = new Date();
  const amzDate = now.toISOString().replace(/[:-]|\.\d{3}/g, "");
  const dateStamp = amzDate.slice(0, 8);
  const credentialScope = `${dateStamp}/${config.region}/s3/aws4_request`;
  const signedHeaders = "content-type;host";
  const canonicalUri = `/${key.split("/").map(encodeRfc3986).join("/")}`;
  const query = {
    "X-Amz-Algorithm": "AWS4-HMAC-SHA256",
    "X-Amz-Credential": `${config.accessKeyId}/${credentialScope}`,
    "X-Amz-Date": amzDate,
    "X-Amz-Expires": "300",
    "X-Amz-SignedHeaders": signedHeaders
  };
  const canonicalQuery = Object.entries(query)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([keyName, value]) => `${encodeRfc3986(keyName)}=${encodeRfc3986(value)}`)
    .join("&");
  const canonicalHeaders = `content-type:${contentType}\nhost:${host}\n`;
  const canonicalRequest = [
    "PUT",
    canonicalUri,
    canonicalQuery,
    canonicalHeaders,
    signedHeaders,
    "UNSIGNED-PAYLOAD"
  ].join("\n");
  const stringToSign = [
    "AWS4-HMAC-SHA256",
    amzDate,
    credentialScope,
    sha256(canonicalRequest)
  ].join("\n");
  const dateKey = hmac(`AWS4${config.secretAccessKey}`, dateStamp);
  const regionKey = hmac(dateKey, config.region);
  const serviceKey = hmac(regionKey, "s3");
  const signingKey = hmac(serviceKey, "aws4_request");
  const signature = hmac(signingKey, stringToSign, "hex");
  const uploadUrl = `https://${host}${canonicalUri}?${canonicalQuery}&X-Amz-Signature=${signature}`;

  return {
    uploadUrl,
    publicUrl: s3PublicUrl(config.bucket, config.region, key),
    key,
    headers: { "content-type": contentType }
  };
}

function createS3PresignedGet(key, expires = 900) {
  const config = s3Config();
  if (!config || config.missing?.length || !key) return "";
  const host = `${config.bucket}.s3.${config.region}.amazonaws.com`;
  const now = new Date();
  const amzDate = now.toISOString().replace(/[:-]|\.\d{3}/g, "");
  const dateStamp = amzDate.slice(0, 8);
  const credentialScope = `${dateStamp}/${config.region}/s3/aws4_request`;
  const signedHeaders = "host";
  const canonicalUri = `/${String(key).split("/").map(encodeRfc3986).join("/")}`;
  const query = {
    "X-Amz-Algorithm": "AWS4-HMAC-SHA256",
    "X-Amz-Credential": `${config.accessKeyId}/${credentialScope}`,
    "X-Amz-Date": amzDate,
    "X-Amz-Expires": String(expires),
    "X-Amz-SignedHeaders": signedHeaders
  };
  const canonicalQuery = Object.entries(query)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([keyName, value]) => `${encodeRfc3986(keyName)}=${encodeRfc3986(value)}`)
    .join("&");
  const canonicalHeaders = `host:${host}\n`;
  const canonicalRequest = [
    "GET",
    canonicalUri,
    canonicalQuery,
    canonicalHeaders,
    signedHeaders,
    "UNSIGNED-PAYLOAD"
  ].join("\n");
  const stringToSign = [
    "AWS4-HMAC-SHA256",
    amzDate,
    credentialScope,
    sha256(canonicalRequest)
  ].join("\n");
  const dateKey = hmac(`AWS4${config.secretAccessKey}`, dateStamp);
  const regionKey = hmac(dateKey, config.region);
  const serviceKey = hmac(regionKey, "s3");
  const signingKey = hmac(serviceKey, "aws4_request");
  const signature = hmac(signingKey, stringToSign, "hex");
  return `https://${host}${canonicalUri}?${canonicalQuery}&X-Amz-Signature=${signature}`;
}

function listingWithReadableImages(listing) {
  if (!listing || typeof listing !== "object") return listing;
  const publicListing = {
    ...listing,
    seller: listing.seller
      ? { ...listing.seller, verified: false }
      : listing.seller
  };
  const uploads = Array.isArray(listing.imageUploads) ? listing.imageUploads : [];
  const keys = Array.isArray(listing.imageS3Keys)
    ? listing.imageS3Keys
    : uploads.map((item) => item?.s3Key || item?.key).filter(Boolean);
  if (!keys.length) return publicListing;

  const signedImages = keys
    .map((key) => createS3PresignedGet(key, 3600))
    .filter(Boolean);
  if (!signedImages.length) return publicListing;

  return {
    ...publicListing,
    images: signedImages,
    imageUploads: uploads.map((item, index) => ({
      ...item,
      signedUrl: signedImages[index] || item.signedUrl || item.fileUrl || item.url
    }))
  };
}

async function listingWithReadableSeller(listing) {
  if (!listing || typeof listing !== "object") return listing;
  const readableListing = listingWithReadableImages(listing);
  const sellerId = readableListing.userId || readableListing.seller?.id || "";
  if (!sellerId || typeof store.getUserById !== "function") return readableListing;
  const owner = await store.getUserById(sellerId);
  if (!owner) return readableListing;
  const safeOwner = publicUser(owner);
  return {
    ...readableListing,
    seller: {
      ...(readableListing.seller || {}),
      id: sellerId,
      name: readableListing.seller?.name || safeOwner.name || safeOwner.email?.split("@")[0] || "Kerodex seller",
      avatarUrl: safeOwner.avatarUrl || readableListing.seller?.avatarUrl || defaultProfileIconUrl(sellerId),
      avatarS3Key: safeOwner.avatarS3Key || readableListing.seller?.avatarS3Key || "",
      phoneVerified: Boolean(safeOwner.phoneVerified),
      verified: PERSONA_IDENTITY_VERIFICATION_ENABLED && Boolean(safeOwner.identityVerified),
      memberSince: readableListing.seller?.memberSince || owner.createdAt || owner.acceptedTermsAt || ""
    }
  };
}

function listingsWithReadableImages(listings) {
  return Array.isArray(listings) ? listings.map(listingWithReadableImages) : [];
}

function sellerWithReadableImages(seller) {
  if (!seller || typeof seller !== "object") return seller;
  const avatarS3Key = seller.avatarS3Key || seller.profileImageS3Key || "";
  return {
    ...seller,
    avatarUrl: avatarS3Key
      ? createS3PresignedGet(avatarS3Key, 3600) || seller.avatarUrl || seller.profileImageUrl || ""
      : seller.avatarUrl || seller.profileImageUrl || "",
    avatarS3Key,
    listings: listingsWithReadableImages(seller.listings)
  };
}

function personaTemplateId() {
  return process.env.PERSONA_INQUIRY_TEMPLATE_ID || process.env.PERSONA_TEMPLATE_ID || "";
}

function buildPersonaHostedUrl(req, user) {
  const templateId = personaTemplateId();
  if (!templateId) {
    const error = new Error("Persona inquiry template ID is not configured.");
    error.status = 503;
    throw error;
  }
  const personaUrl = new URL("https://inquiry.withpersona.com/verify");
  personaUrl.searchParams.set("inquiry-template-id", templateId);
  personaUrl.searchParams.set("reference-id", user.id);
  personaUrl.searchParams.set("redirect-uri", `${appOrigin(req)}/verify?persona=return`);
  return personaUrl.toString();
}

function makeOAuthState(provider, legalConsent = {}) {
  const state = crypto.randomBytes(24).toString("hex");
  oauthStates.set(state, { provider, legalConsent, createdAt: Date.now() });
  return state;
}

function consumeOAuthState(state, provider) {
  const record = oauthStates.get(state);
  oauthStates.delete(state);
  if (!record || record.provider !== provider || Date.now() - record.createdAt >= 10 * 60 * 1000) return null;
  return record;
}

function decodeJwtPayload(jwt) {
  const payload = String(jwt || "").split(".")[1];
  if (!payload) return {};
  const normalized = payload.replace(/-/g, "+").replace(/_/g, "/");
  return JSON.parse(Buffer.from(normalized, "base64").toString("utf8"));
}

async function exchangeGoogleCode({ code, redirectUri }) {
  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: process.env.GOOGLE_CLIENT_ID,
      client_secret: process.env.GOOGLE_CLIENT_SECRET,
      redirect_uri: redirectUri,
      grant_type: "authorization_code"
    })
  });
  const tokenBody = await response.json();
  if (!response.ok) throw new Error(tokenBody.error_description || tokenBody.error || "Google token exchange failed.");
  const userInfoResponse = await fetch("https://openidconnect.googleapis.com/v1/userinfo", {
    headers: { authorization: `Bearer ${tokenBody.access_token}` }
  });
  const profile = await userInfoResponse.json();
  if (!userInfoResponse.ok) throw new Error(profile.error_description || profile.error || "Google profile lookup failed.");
  return {
    email: profile.email,
    name: profile.name,
    emailVerified: profile.email_verified === true
  };
}

async function exchangeMicrosoftCode({ code, redirectUri }) {
  const tenant = process.env.MICROSOFT_TENANT_ID || "common";
  const response = await fetch(`https://login.microsoftonline.com/${encodeURIComponent(tenant)}/oauth2/v2.0/token`, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: process.env.MICROSOFT_CLIENT_ID,
      client_secret: process.env.MICROSOFT_CLIENT_SECRET,
      redirect_uri: redirectUri,
      grant_type: "authorization_code"
    })
  });
  const tokenBody = await response.json();
  if (!response.ok) throw new Error(tokenBody.error_description || tokenBody.error || "Microsoft token exchange failed.");
  const payload = decodeJwtPayload(tokenBody.id_token);
  return {
    email: payload.email || payload.preferred_username || payload.upn,
    name: payload.name || (payload.email ? String(payload.email).split("@")[0] : "Microsoft user"),
    emailVerified: true
  };
}

async function sendVerificationEmail({ email, code, req }) {
  const expiresAt = Date.now() + 15 * 60 * 1000;
  emailVerifications.set(email, { code, expiresAt });

  const verifyUrl = `${appOrigin(req)}/verify?email=${encodeURIComponent(email)}`;
  return sendCodeEmail({
    email,
    code,
    req,
    subject: "[Kerodex] Email verification code",
    heading: "Please verify your email",
    intro: "Here is your Kerodex email verification code:",
    reason: "a verification code was requested for your Kerodex account.",
    fallbackText: `Your Kerodex verification code is ${code}. It expires in 15 minutes. Open ${verifyUrl} to continue.`
  });
}

async function sendPasswordResetEmail({ email, code, req }) {
  const expiresAt = Date.now() + 15 * 60 * 1000;
  passwordResets.set(email, { code, expiresAt });

  return sendCodeEmail({
    email,
    code,
    req,
    subject: "[Kerodex] Password reset code",
    heading: "Reset your password",
    intro: "Here is your Kerodex password reset code:",
    reason: "a password reset code was requested for your Kerodex account.",
    fallbackText: `Your Kerodex password reset code is ${code}. It expires in 15 minutes.`
  });
}

function emailBrandLogo() {
  const siteUrl = String(process.env.PUBLIC_SITE_URL || "https://kerodexofficial.com").replace(/\/+$/, "");
  return `<img src="${siteUrl}/assets/darkmodeNonTransparent.png" width="88" height="88" alt="Kerodex" style="display:block;width:88px;height:88px;margin:0 auto 28px;border:0;border-radius:0;object-fit:cover;background:#000000;" />`;
}

async function sendCodeEmail({ email, code, subject, heading, intro, reason, fallbackText }) {
  const html = `<!doctype html>
  <html>
    <body style="margin:0;background:#ffffff;color:#000000;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;">
      <div style="max-width:600px;margin:0 auto;padding:48px 24px;text-align:center;">
        ${emailBrandLogo()}
        <h1 style="font-size:24px;font-weight:600;letter-spacing:-0.02em;line-height:1.3;margin:0 0 24px;color:#000000;">${heading}</h1>
        <div style="border:1px solid #e5e5e5;text-align:left;padding:28px;margin:0 auto 24px;max-width:480px;background:#ffffff;">
          <p style="font-size:15px;line-height:1.6;margin:0 0 24px;color:#171717;">${intro}</p>
          <div style="font-size:34px;font-weight:600;letter-spacing:0.32em;text-align:center;margin:0 0 24px;color:#000000;">${code}</div>
          <p style="font-size:14px;line-height:1.6;margin:0 0 16px;color:#404040;">This code is valid for <strong>15 minutes</strong> and can only be used once.</p>
          <p style="font-size:14px;line-height:1.6;margin:0;color:#404040;"><strong>Do not share this code.</strong> Kerodex will never ask for it by phone or email.</p>
          <p style="font-size:14px;line-height:1.6;margin:28px 0 0;color:#171717;">Thanks,<br/>The Kerodex Team</p>
        </div>
        <p style="max-width:480px;margin:0 auto;text-align:left;font-size:12px;line-height:1.6;color:#737373;">You're receiving this email because ${reason} If this wasn't you, you can ignore it.</p>
      </div>
    </body>
  </html>`;

  if (process.env.RESEND_API_KEY && process.env.AUTH_EMAIL_FROM) {
    try {
      const response = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          authorization: `Bearer ${process.env.RESEND_API_KEY}`,
          "content-type": "application/json"
        },
        body: JSON.stringify({
          from: process.env.AUTH_EMAIL_FROM,
          to: email,
          subject,
          text: fallbackText,
          html
        })
      });
      if (response.ok) return { sent: true, devCode: undefined };

      const detail = await response.text().catch(() => "");
      console.warn(`[Kerodex email verification failed] ${detail || response.status}`);
    } catch (error) {
      console.warn(`[Kerodex email verification failed] ${error.message}`);
    }
    emailVerifications.delete(email);
    passwordResets.delete(email);
    throw new Error("We could not send the email code. Check the Resend sender/domain settings and try again.");
  }

  console.log(`[Kerodex email code] ${email}: ${code}`);
  return {
    sent: false,
    devCode: process.env.NODE_ENV === "production" ? undefined : code
  };
}

async function sendTransactionalEmail({ to, subject, heading, body, actionUrl = "", actionLabel = "Open Kerodex" }) {
  const email = normalizeLimitedString(to, 254);
  if (!isValidEmail(email) || !subject || !body) return { sent: false, skipped: true };
  if (!process.env.RESEND_API_KEY || !process.env.AUTH_EMAIL_FROM) return { sent: false, skipped: true };
  const button = actionUrl
    ? `<p style="margin:28px 0 0;"><a href="${actionUrl}" style="display:inline-block;background:#000000;color:#ffffff;text-decoration:none;padding:12px 18px;font-weight:600;font-size:14px;">${actionLabel}</a></p>`
    : "";
  const html = `<!doctype html><html><body style="margin:0;background:#ffffff;color:#000000;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;">
    <div style="max-width:600px;margin:0 auto;padding:48px 24px;text-align:center;">
      ${emailBrandLogo()}
      <div style="border:1px solid #e5e5e5;padding:28px;text-align:left;background:#ffffff;">
        <h1 style="font-size:22px;font-weight:600;letter-spacing:-0.02em;line-height:1.35;margin:0 0 16px;color:#000000;">${heading}</h1>
        <p style="font-size:15px;line-height:1.65;color:#262626;margin:0;">${body}</p>
        ${button}
      </div>
      <p style="margin:24px 0 0;font-size:12px;line-height:1.6;color:#737373;text-align:left;">Kerodex marketplace notification. If this was unexpected, contact founder@kerodexofficial.com.</p>
    </div>
  </body></html>`;
  try {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        authorization: `Bearer ${process.env.RESEND_API_KEY}`,
        "content-type": "application/json"
      },
      body: JSON.stringify({
        from: process.env.AUTH_EMAIL_FROM,
        to: email,
        subject,
        text: `${heading}\n\n${body}${actionUrl ? `\n\n${actionUrl}` : ""}`,
        html
      })
    });
    if (response.ok) return { sent: true };
    const detail = await response.text().catch(() => "");
    console.warn(`[Kerodex transactional email failed] ${detail || response.status}`);
  } catch (error) {
    console.warn(`[Kerodex transactional email failed] ${error.message}`);
  }
  return { sent: false };
}

function sendAuthSetup(res, provider) {
  const label = provider === "microsoft" ? "Microsoft" : "Google";
  const expectedEnv = provider === "microsoft"
    ? "MICROSOFT_CLIENT_ID and MICROSOFT_CLIENT_SECRET"
    : "GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET";
  sendHtml(res, 200, `<!doctype html>
    <html lang="en">
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1">
        <title>Kerodex ${label} Auth Setup</title>
      </head>
      <body style="background:#0b1119;color:#f8fafc;font-family:Inter,system-ui,sans-serif;margin:0;min-height:100vh;display:grid;place-items:center;padding:24px">
        <main style="max-width:680px;background:#121a25;border:1px solid rgba(248,250,252,.12);border-radius:24px;padding:28px;box-shadow:0 24px 80px rgba(0,0,0,.36)">
          <p style="color:#5eead4;font-weight:800;letter-spacing:.08em;text-transform:uppercase;margin:0 0 12px">Auth setup required</p>
          <h1 style="font-size:clamp(2rem,5vw,4rem);line-height:1;margin:0 0 18px">${label} login is ready to wire up.</h1>
          <p style="color:#a7b0bf;line-height:1.6">To avoid the OAuth 401 invalid client error, Kerodex will not send you to ${label} with a fake client ID. Add a real ${label} client ID in the server environment, then this route will redirect to the provider.</p>
          <p style="color:#a7b0bf;line-height:1.6"><strong style="color:#f8fafc">Expected env vars:</strong> ${expectedEnv}</p>
          <a href="/?v=10#browse" style="display:inline-flex;align-items:center;min-height:44px;background:#f8fafc;color:#0b1119;border-radius:999px;padding:0 18px;text-decoration:none;font-weight:800">Back to Kerodex</a>
        </main>
      </body>
    </html>`);
}

function normalize(value) {
  return String(value || "").trim().toLowerCase();
}

function normalizeLimitedString(value, maxLength = 500) {
  return String(value ?? "").replace(/\s+/g, " ").trim().slice(0, maxLength);
}

function sellerChecklistComplete(value = {}) {
  if (!value || typeof value !== "object") return false;
  return SELLER_CHECKLIST_KEYS.every((key) => value[key] === true);
}

function verifiedListingMatchesVin(listing, vin, excludeId = "") {
  if (!listing || normalizeVin(listing.vin) !== vin || listing.id === excludeId) return false;
  const status = String(listing.status || "active");
  if (["deleted", "removed", "sold", "expired", "rejected"].includes(status)) return false;
  const presenceStatus = String(
    listing.vehiclePresence?.verificationStatus ||
    listing.vehiclePresence?.verification_status ||
    ""
  );
  return Boolean(
    listing.vehiclePresenceVerified ||
    listing.verificationStatus === "vehicle_presence_verified" ||
    presenceStatus === vehiclePresence.PRESENCE_STATUSES.VERIFIED
  );
}

async function findVerifiedListingByVin(vin, excludeId = "") {
  const listings = await store.getListings();
  return listings.find((listing) => verifiedListingMatchesVin(listing, vin, excludeId)) || null;
}

function validateSellerListingInput(body = {}, { requirePresence = false } = {}) {
  const errors = [];
  const price = Number(body.price);
  const mileage = Number(body.mileage);
  const year = Number(body.year);
  const cleanVin = normalizeVin(body.vin);
  const titleStatus = normalizeLimitedString(body.titleStatus, 80);
  const accidentHistory = normalizeLimitedString(body.accidentHistory, 80);
  const ownerCount = normalizeLimitedString(body.ownerCount, 80);
  const description = normalizeLimitedString(body.description, 5000);
  const photos = Array.isArray(body.images) ? body.images.filter(Boolean) : [];
  const uploads = Array.isArray(body.imageUploads) ? body.imageUploads.filter((item) => item?.url || item?.fileUrl) : [];

  if (!normalizeLimitedString(body.make, 40)) errors.push("Make is required.");
  if (!normalizeLimitedString(body.model, 60)) errors.push("Model is required.");
  if (!Number.isFinite(year) || year < 1981 || year > new Date().getFullYear() + 1) errors.push("Enter a valid vehicle year.");
  if (!Number.isFinite(price) || price < 500 || price > 500000) errors.push("Enter a realistic asking price.");
  if (!Number.isFinite(mileage) || mileage < 0 || mileage > 1000000) errors.push("Enter a realistic mileage.");
  if (!/^[A-HJ-NPR-Z0-9]{17}$/.test(cleanVin)) errors.push("A valid 17-character VIN is required for vehicle presence verification.");
  if (!REQUIRED_TITLE_STATUSES.has(titleStatus)) errors.push("Choose a title status before publishing.");
  if (!REQUIRED_ACCIDENT_OPTIONS.has(accidentHistory)) errors.push("Choose an accident history disclosure before publishing.");
  if (!REQUIRED_OWNER_OPTIONS.has(ownerCount)) errors.push("Choose an ownership history disclosure before publishing.");
  if (description.length < 20) errors.push("Add a description with at least 20 characters.");
  if (photos.length + uploads.length < 1) errors.push("Add at least one vehicle photo before publishing.");
  if (body.listingAccuracyCertified !== true) errors.push("Certify that this listing is accurate before publishing.");
  if (!sellerChecklistComplete(body.sellerChecklist)) errors.push("Complete the seller checklist before publishing.");
  if (requirePresence && (!String(body.vehiclePresencePhotoUrl || "").trim() || !String(body.vehiclePresenceToken || "").trim())) {
    errors.push("Upload a vehicle presence verification photo before submitting this listing.");
  }

  return { errors, cleanVin, price, mileage, year, titleStatus, accidentHistory, ownerCount };
}

function listingNeedsPriceReview(listing) {
  const marketValue = Number(listing.marketValue || 0);
  const price = Number(listing.price || 0);
  if (!marketValue || !price) return false;
  return price < marketValue * 0.65 || price > marketValue * 1.45;
}

function isValidEmail(value) {
  const email = normalize(value);
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email) && email.length <= 254;
}

function validateStrongPassword(password) {
  const value = String(password || "");
  const lower = value.toLowerCase();
  const weak = new Set(["password", "password1", "password123", "12345678", "123456789", "qwerty123", "kerodex123"]);
  if (value.length < 8) return "Use a password with at least 8 characters.";
  if (value.length > 128) return "Use a password shorter than 128 characters.";
  if (weak.has(lower)) return "Choose a stronger password.";
  if (!/[a-z]/i.test(value) || !/\d/.test(value)) return "Use at least one letter and one number in your password.";
  return "";
}

function hashPassword(password, salt = crypto.randomBytes(16).toString("base64url")) {
  const iterations = 210000;
  const hash = crypto.pbkdf2Sync(String(password), salt, iterations, 32, "sha256").toString("base64url");
  return `pbkdf2_sha256$${iterations}$${salt}$${hash}`;
}

function verifyPassword(storedPassword, candidate) {
  const stored = String(storedPassword || "");
  const password = String(candidate || "");
  if (stored.startsWith("pbkdf2_sha256$")) {
    const [, iterationsRaw, salt, expected] = stored.split("$");
    const iterations = Number(iterationsRaw);
    if (!iterations || !salt || !expected) return false;
    const actual = crypto.pbkdf2Sync(password, salt, iterations, 32, "sha256").toString("base64url");
    if (actual.length !== expected.length) return false;
    return crypto.timingSafeEqual(Buffer.from(actual), Buffer.from(expected));
  }
  return stored === password;
}

function recordFailedLogin(req, email) {
  const key = `${requestIp(req)}:${normalize(email)}`;
  const now = Date.now();
  const existing = failedLoginAttempts.get(key);
  const next = !existing || existing.resetAt <= now
    ? { count: 1, resetAt: now + 15 * 60 * 1000 }
    : { count: existing.count + 1, resetAt: existing.resetAt };
  failedLoginAttempts.set(key, next);
  if (next.count >= 5) {
    console.warn(`[Kerodex security] repeated_failed_login ip=${requestIp(req)} email=${normalize(email)} count=${next.count}`);
  }
}

function clearFailedLogin(req, email) {
  failedLoginAttempts.delete(`${requestIp(req)}:${normalize(email)}`);
}

async function filterListings(params) {
  const query = normalize(params.get("q"));
  const make = normalize(params.get("make"));
  const bodyType = normalize(params.get("bodyType"));
  const fuelType = normalize(params.get("fuelType"));
  const drivetrain = normalize(params.get("drivetrain"));
  const model = normalize(params.get("model"));
  const minPrice = Number(params.get("minPrice") || 0);
  const maxPrice = Number(params.get("maxPrice") || 0);
  const minMileage = Number(params.get("minMileage") || 0);
  const maxMileage = Number(params.get("maxMileage") || 0);
  const minYear = Number(params.get("minYear") || params.get("year") || 0);
  const maxYear = Number(params.get("maxYear") || 0);
  const cleanTitleOnly = params.get("cleanTitle") === "1";
  const noAccidentsOnly = params.get("noAccidents") === "1";
  const radius = Number(params.get("radius") || 0);
  const requestedLat = Number(params.get("lat") || "");
  const requestedLng = Number(params.get("lng") || "");
  const fallbackLocation = radius > 0 ? { lat: 33.749, lng: -84.388 } : null;
  const userLat = Number.isFinite(requestedLat) ? requestedLat : fallbackLocation?.lat;
  const userLng = Number.isFinite(requestedLng) ? requestedLng : fallbackLocation?.lng;
  const sort = normalize(params.get("sort"));
  const hasLocation = Number.isFinite(userLat) && Number.isFinite(userLng);

  const listings = await store.getListings();
  return listings
    .filter((listing) => listing.status === "active" || listing.status === "sold")
    .filter((listing) => {
      const haystack = normalize([
        listing.title,
        listing.make,
        listing.model,
        listing.trim,
        listing.bodyType,
        listing.fuelType,
        Array.isArray(listing.features) ? listing.features.join(" ") : ""
      ].join(" "));

      const listingDistance = hasLocation && Number.isFinite(Number(listing.lat)) && Number.isFinite(Number(listing.lng))
        ? distanceMiles(userLat, userLng, Number(listing.lat), Number(listing.lng))
        : null;

      return (
        (!query || haystack.includes(query)) &&
        (!make || normalize(listing.make) === make) &&
        (!model || normalize(listing.model) === model) &&
        (!bodyType || normalize(listing.bodyType) === bodyType) &&
        (!fuelType || normalize(listing.fuelType) === fuelType) &&
        (!drivetrain || normalize(listing.drivetrain) === drivetrain || (Array.isArray(listing.features) ? listing.features : []).some((feature) => normalize(feature).includes(drivetrain))) &&
        (!minPrice || listing.price >= minPrice) &&
        (!maxPrice || listing.price <= maxPrice) &&
        (!minMileage || listing.mileage >= minMileage) &&
        (!maxMileage || listing.mileage <= maxMileage) &&
        (!minYear || listing.year >= minYear) &&
        (!maxYear || listing.year <= maxYear) &&
        (!cleanTitleOnly || (listing.badges || []).some((badge) => normalize(badge).includes("clean title"))) &&
        (!noAccidentsOnly || (listing.badges || []).some((badge) => normalize(badge).includes("no accidents"))) &&
        (!radius || (listingDistance !== null && listingDistance <= radius))
      );
    })
    .map((listing) => {
      const distance = hasLocation && Number.isFinite(Number(listing.lat)) && Number.isFinite(Number(listing.lng))
        ? distanceMiles(userLat, userLng, Number(listing.lat), Number(listing.lng))
        : null;
      return distance === null ? listing : { ...listing, distanceMiles: Math.round(distance * 10) / 10 };
    })
    .sort((a, b) => {
      if (sort === "closest" && hasLocation) {
        return Number(a.distanceMiles ?? Number.POSITIVE_INFINITY) - Number(b.distanceMiles ?? Number.POSITIVE_INFINITY);
      }
      if (sort === "price_low") return Number(a.price || 0) - Number(b.price || 0);
      if (sort === "price_high") return Number(b.price || 0) - Number(a.price || 0);
      if (sort === "mileage_low") return Number(a.mileage || 0) - Number(b.mileage || 0);
      return Number(b.dealScore || 0) - Number(a.dealScore || 0);
    });
}

function normalizeSellerReviewBody(body, user, sellerId) {
  const rating = Number(body.rating);
  const comment = String(body.comment || "").trim().replace(/\s+/g, " ");
  if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
    throw makePublicError("Choose a review rating from 1 to 5.", 400);
  }
  if (comment.length < 10) {
    throw makePublicError("Write at least 10 characters for the review.", 400);
  }
  if (comment.length > 800) {
    throw makePublicError("Keep reviews under 800 characters.", 400);
  }
  return {
    id: `rev_${Date.now().toString(36)}_${crypto.randomBytes(4).toString("hex")}`,
    sellerId,
    reviewerId: user.id,
    reviewerName: user.name || user.email?.split("@")[0] || "Kerodex buyer",
    rating,
    comment,
    createdAt: new Date().toISOString()
  };
}

function distanceMiles(lat1, lng1, lat2, lng2) {
  const toRad = (degrees) => degrees * Math.PI / 180;
  const earthMiles = 3958.8;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a = Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
    Math.sin(dLng / 2) ** 2;
  return 2 * earthMiles * Math.asin(Math.sqrt(a));
}

function normalizeVin(value) {
  return String(value || "").trim().toUpperCase().replace(/[^A-Z0-9]/g, "");
}

function numberFrom(value, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function cacheAgeDays(record) {
  const updatedAt = Date.parse(record?.updatedAt || record?.payload?.valuationDate || "");
  if (!Number.isFinite(updatedAt)) return Number.POSITIVE_INFINITY;
  return (Date.now() - updatedAt) / (24 * 60 * 60 * 1000);
}

function valuationCacheKey({ vin, mileage, zip, location, condition }) {
  return [
    marketCheck.normalizeVin(vin),
    Math.round(numberFrom(mileage, 0)),
    String(zip || "").trim().toUpperCase(),
    normalize(location),
    normalize(condition)
  ].join(":");
}

async function getCachedMarketCheckDecode(vin) {
  const cleanVin = marketCheck.assertValidVin(vin);
  const cached = await store.getMarketCheckCache("vin_decode", cleanVin);
  if (cached?.payload) return { ...cached.payload, cached: true, cacheUpdatedAt: cached.updatedAt };
  let decoded;
  try {
    decoded = await marketCheck.decodeVin(cleanVin);
    await recordCost("marketcheck", "vin_decode", { status: "success" });
  } catch (error) {
    await recordCost("marketcheck", "vin_decode", { status: "failure", metadata: { error: error.message } });
    throw error;
  }
  await store.setMarketCheckCache("vin_decode", cleanVin, decoded);
  return { ...decoded, cached: false };
}

async function getCachedMarketCheckValuation(listing, { forceRefresh = false } = {}) {
  const cleanVin = marketCheck.assertValidVin(listing.vin);
  const key = valuationCacheKey(listing);
  const cached = await store.getMarketCheckCache("market_value", key);
  const refreshDays = numberFrom(process.env.MARKETCHECK_REFRESH_DAYS, 14);
  if (!forceRefresh && cached?.payload && cacheAgeDays(cached) <= refreshDays) {
    return { ...cached.payload, cached: true, cacheUpdatedAt: cached.updatedAt };
  }
  let valuation;
  try {
    valuation = await marketCheck.getMarketValue({
      vin: cleanVin,
      mileage: listing.mileage,
      zip: listing.zip,
      location: listing.location,
      condition: listing.condition,
      radius: listing.marketValueRadius || 100
    });
    await recordCost("marketcheck", "market_valuation", { listingId: listing.id || "", userId: listing.userId || "", status: "success" });
  } catch (error) {
    await recordCost("marketcheck", "market_valuation", { listingId: listing.id || "", userId: listing.userId || "", status: "failure", metadata: { error: error.message } });
    throw error;
  }
  await store.setMarketCheckCache("market_value", key, valuation);
  return { ...valuation, cached: false };
}

async function enrichListingWithMarketCheck(listing, { forceValuationRefresh = false } = {}) {
  if (!listing.vin) return listing;
  const vin = marketCheck.assertValidVin(listing.vin);

  const next = {
    ...listing,
    vin,
    marketValueSource: "MarketCheck"
  };

  let decoded = null;
  try {
    decoded = await getCachedMarketCheckDecode(vin);
    next.marketCheckVin = decoded;
    next.marketCheckDecodeError = "";
  } catch (error) {
    next.marketCheckDecodeError = error.message || "MarketCheck VIN decode failed.";
    next.marketCheckDecodeErrorCode = error.code || "marketcheck_decode_failed";
    return next;
  }

  if (decoded.year) next.year = numberFrom(decoded.year, next.year);
  if (decoded.make) next.make = decoded.make;
  if (decoded.model) next.model = decoded.model;
  if (decoded.trim) next.trim = decoded.trim;
  if (decoded.body_type) next.bodyType = decoded.body_type;
  if (decoded.engine) next.engine = decoded.engine;
  if (decoded.transmission) next.transmission = decoded.transmission;
  if (decoded.drivetrain) next.drivetrain = decoded.drivetrain;
  if (decoded.fuel_type) next.fuelType = decoded.fuel_type;
  next.title = [next.year, next.make, next.model, next.trim].filter(Boolean).join(" ");

  try {
    const valuation = await getCachedMarketCheckValuation({ ...listing, vin }, { forceRefresh: forceValuationRefresh });
    next.marketValue = valuation.marketValue;
    next.marketValueMsrp = valuation.msrp;
    next.marketValueDate = valuation.valuationDate;
    next.marketValueRadius = valuation.radiusUsed;
    next.marketValueComparableCount = valuation.comparableCount;
    next.marketValueRaw = valuation.raw;
    next.marketCheckValuationError = "";
  } catch (error) {
    next.marketCheckValuationError = error.message || "MarketCheck valuation failed.";
    next.marketCheckValuationErrorCode = error.code || "marketcheck_valuation_failed";
  }

  return next;
}

function marketCheckRefreshFieldsChanged(previous = {}, next = {}) {
  return ["vin", "mileage", "zip", "location", "condition"].some((field) =>
    String(previous[field] || "").trim() !== String(next[field] || "").trim()
  );
}

function normalizeListingDocument(record = {}, documentType = "maintenance") {
  const fileUrl = String(record.file_url || record.fileUrl || record.url || "").trim();
  const status = String(
    record.document_check_status ||
    record.documentCheckStatus ||
    (documentType === "title" ? "title_uploaded" : "uploaded")
  ).trim();
  const matchedKeywords = Array.isArray(record.matched_keywords)
    ? record.matched_keywords
    : Array.isArray(record.matchedKeywords)
      ? record.matchedKeywords
      : [];
  const extractedText = String(record.extracted_text || record.extractedText || "");
  const ocrProcessedAt = String(record.ocr_processed_at || record.ocrProcessedAt || "");
  return {
    id: String(record.id || `${documentType}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`),
    name: String(record.name || record.fileName || (documentType === "title" ? "Title document" : "Maintenance record")).trim(),
    type: String(record.type || (documentType === "title" ? "Title" : "Other")).trim(),
    date: String(record.date || "").trim(),
    notes: String(record.notes || "").trim(),
    document_type: documentType,
    documentType,
    file_url: fileUrl,
    fileUrl,
    s3Key: String(record.s3Key || record.key || "").trim(),
    extracted_text: extractedText,
    extractedText,
    matched_keywords: matchedKeywords,
    matchedKeywords,
    document_check_status: status,
    documentCheckStatus: status,
    ocr_provider: String(record.ocr_provider || record.ocrProvider || ""),
    ocrProvider: String(record.ocr_provider || record.ocrProvider || ""),
    ocr_processed_at: ocrProcessedAt,
    ocrProcessedAt: ocrProcessedAt,
    ocr_error: String(record.ocr_error || record.ocrError || ""),
    ocrError: String(record.ocr_error || record.ocrError || ""),
    ocr_status: String(record.ocr_status || record.ocrStatus || ""),
    ocrStatus: String(record.ocr_status || record.ocrStatus || ""),
    extractedVins: Array.isArray(record.extractedVins) ? record.extractedVins : [],
    titleBrandingTerms: Array.isArray(record.titleBrandingTerms) ? record.titleBrandingTerms : []
  };
}

async function sellerWithReadableProfile(seller, sellerId = "") {
  if (!seller || typeof seller !== "object") return seller;
  const id = seller.id || sellerId;
  const owner = id && typeof store.getUserById === "function" ? await store.getUserById(id) : null;
  const safeOwner = owner ? publicUser(owner) : null;
  return sellerWithReadableImages({
    ...seller,
    listings: Array.isArray(seller.listings)
      ? seller.listings.filter((listing) => ["active", "sold"].includes(String(listing?.status || "").toLowerCase()))
      : [],
    id,
    name: seller.name || safeOwner?.name || safeOwner?.email?.split("@")[0] || "Kerodex seller",
    avatarUrl: safeOwner?.avatarUrl || seller.avatarUrl || seller.profileImageUrl || defaultProfileIconUrl(id || seller.name),
    avatarS3Key: safeOwner?.avatarS3Key || seller.avatarS3Key || seller.profileImageS3Key || "",
    verification: {
      ...(seller.verification || {}),
      email: Boolean(seller.verification?.email || safeOwner?.emailVerified),
      phone: Boolean(seller.verification?.phone || safeOwner?.phoneVerified),
      identity: PERSONA_IDENTITY_VERIFICATION_ENABLED &&
        Boolean(seller.verification?.identity || safeOwner?.identityVerified),
      selfie: PERSONA_IDENTITY_VERIFICATION_ENABLED &&
        Boolean(seller.verification?.selfie || safeOwner?.selfieVerified)
    }
  });
}

function presenceCodePayload(user) {
  const token = crypto.randomBytes(18).toString("hex");
  const code = vehiclePresence.generateCode();
  const generatedAt = new Date().toISOString();
  const record = {
    token,
    code,
    userId: user.id,
    generatedAt,
    expiresAt: vehiclePresence.expiresAt(Number(process.env.VEHICLE_PRESENCE_CODE_HOURS || 36))
  };
  pendingPresenceCodes.set(token, record);
  return record;
}

function consumePresenceCode({ token, code, user }) {
  const record = pendingPresenceCodes.get(String(token || ""));
  if (!record || record.userId !== user.id) return null;
  if (Date.parse(record.expiresAt) < Date.now()) {
    pendingPresenceCodes.delete(record.token);
    return null;
  }
  if (vehiclePresence.normalizeCode(record.code) !== vehiclePresence.normalizeCode(code)) return null;
  pendingPresenceCodes.delete(record.token);
  return record;
}

function vehiclePresenceReviewNeeded(status) {
  return [
    vehiclePresence.PRESENCE_STATUSES.MANUAL_REVIEW,
    vehiclePresence.PRESENCE_STATUSES.CODE_MISSING,
    vehiclePresence.PRESENCE_STATUSES.CODE_MISMATCH,
    vehiclePresence.PRESENCE_STATUSES.VIN_MISMATCH,
    vehiclePresence.PRESENCE_STATUSES.VIN_NOT_DETECTED,
    vehiclePresence.PRESENCE_STATUSES.VEHICLE_NOT_DETECTED
  ].includes(status);
}

async function createVehiclePresenceReview(listing, result) {
  if (typeof store.createVerificationRequest !== "function") return null;
  return store.createVerificationRequest(
    {
      id: listing.userId || listing.seller?.id || "unknown",
      name: listing.seller?.name || "Kerodex seller",
      email: listing.seller?.email || `${listing.userId || "seller"}@kerodex.local`
    },
    "vehicle_presence",
    {
      listingId: listing.id,
      vehicleVin: listing.vin || "",
      status: result.status === vehiclePresence.PRESENCE_STATUSES.MANUAL_REVIEW ? "pending" : "pending",
      notes: [
        `Presence verification status: ${result.status}`,
        result.reason ? `Reason: ${result.reason}` : "",
        Number.isFinite(result.confidence) ? `Confidence: ${Math.round(result.confidence * 100)}%` : ""
      ].filter(Boolean).join("\n")
    }
  );
}

async function withVehiclePresenceVinLock(vin, callback) {
  const key = normalizeVin(vin) || "missing_vin";
  const previous = vehiclePresenceVinJobs.get(key) || Promise.resolve();
  let release;
  const current = new Promise((resolve) => {
    release = resolve;
  });
  const tail = previous.then(() => current);
  vehiclePresenceVinJobs.set(key, tail);
  await previous;
  try {
    return await callback();
  } finally {
    release();
    if (vehiclePresenceVinJobs.get(key) === tail) vehiclePresenceVinJobs.delete(key);
  }
}

async function processVehiclePresenceUnlocked(listingId) {
  const listing = await store.getListingById(listingId);
  if (!listing || !listing.vehiclePresence) return null;
  const uploadIdentity = listing.vehiclePresence.verificationPhotoS3Key ||
    listing.vehiclePresence.verification_photo_url ||
    listing.vehiclePresence.verificationPhotoUrl ||
    "";
  if (
    uploadIdentity &&
    listing.vehiclePresence.analyzedUploadIdentity === uploadIdentity &&
    listing.vehiclePresence.analyzedAt
  ) {
    console.info("[vehicle-presence] Verification skipped; upload already analyzed", {
      at: new Date().toISOString(),
      listingId,
      verificationStatus: listing.vehiclePresence.verification_status || listing.vehiclePresence.verificationStatus || ""
    });
    return listing;
  }
  console.info("[vehicle-presence] Verification job started", {
    at: new Date().toISOString(),
    listingId,
    status: listing.status || "",
    verificationStatus: listing.verificationStatus || "",
    hasVehiclePresence: Boolean(listing.vehiclePresence),
    hasS3Key: Boolean(listing.vehiclePresence.verificationPhotoS3Key),
    hasPhotoUrl: Boolean(listing.vehiclePresence.verification_photo_url || listing.vehiclePresence.verificationPhotoUrl),
    vinPresent: Boolean(listing.vin),
    vinLength: String(listing.vin || "").length
  });
  const startedAt = new Date().toISOString();
  const inProgress = {
    ...listing,
    vehiclePresence: {
      ...listing.vehiclePresence,
      verification_status: vehiclePresence.PRESENCE_STATUSES.IN_PROGRESS,
      verificationStatus: vehiclePresence.PRESENCE_STATUSES.IN_PROGRESS,
      analysisStartedAt: startedAt
    },
    updatedAt: startedAt
  };
  await store.createListing(inProgress);

  const signedImageUrl = createS3PresignedGet(listing.vehiclePresence.verificationPhotoS3Key, 900) ||
    listing.vehiclePresence.verification_photo_url ||
    listing.vehiclePresence.verificationPhotoUrl;
  console.info("[vehicle-presence] OpenAI image verification request started", {
    at: new Date().toISOString(),
    listingId,
    provider: vehiclePresence.openAiConfig() ? "openai" : "manual_review_fallback",
    model: vehiclePresence.openAiConfig()?.model || "",
    hasImageUrl: Boolean(signedImageUrl),
    imageSource: listing.vehiclePresence.verificationPhotoS3Key ? "s3_signed_get" : "stored_url",
    hasCode: Boolean(listing.vehiclePresence.verification_code || listing.vehiclePresence.verificationCode)
  });
  let result = await vehiclePresence.analyze({
    imageUrl: signedImageUrl,
    code: listing.vehiclePresence.verification_code || listing.vehiclePresence.verificationCode,
    listing
  });
  if (result.status === vehiclePresence.PRESENCE_STATUSES.VERIFIED) {
    const reservedBy = await findVerifiedListingByVin(normalizeVin(listing.vin), listing.id);
    if (reservedBy) {
      result = {
        ...result,
        status: vehiclePresence.PRESENCE_STATUSES.MANUAL_REVIEW,
        reason: `This VIN is already reserved by verified listing ${reservedBy.id}. Remove that listing before publishing another one with this VIN.`,
        duplicateVerifiedListingId: reservedBy.id
      };
    }
  }
  if (vehiclePresence.openAiConfig()) {
    await recordCost("openai", "vehicle_presence_verification", {
      userId: listing.userId || listing.seller?.id || "",
      listingId,
      status: result.provider === "openai" ? "success" : "failure",
      metadata: { provider: result.provider, verificationStatus: result.status }
    });
  }
  const verified = result.status === vehiclePresence.PRESENCE_STATUSES.VERIFIED;
  await trackSystemEvent(verified ? "vehicle_presence_verification_passed" : "vehicle_presence_verification_failed", {
    userId: listing.userId || listing.seller?.id || "",
    listingId,
    status: result.status,
    reason: result.reason || ""
  });
  if (verified) {
    await trackSystemEvent("listing_published", {
      userId: listing.userId || listing.seller?.id || "",
      listingId
    });
  }
  const now = new Date().toISOString();
  const next = {
    ...inProgress,
    status: verified ? "active" : "pending_verification",
    verificationStatus: verified ? "vehicle_presence_verified" : result.status,
    vehiclePresenceVerified: verified,
    photoChallengeVerified: verified,
    livePhotoVerified: verified,
    challengeCodeVerified: verified,
    photoChallengeCompletedAt: verified ? now : "",
    badges: Array.from(new Set([
      ...(Array.isArray(inProgress.badges) ? inProgress.badges : []),
      verified ? "Vehicle Presence Verified" : ""
    ].filter(Boolean))),
    vehiclePresence: {
      ...inProgress.vehiclePresence,
      verification_status: result.status,
      verificationStatus: result.status,
      verified_at: verified ? now : "",
      verifiedAt: verified ? now : "",
      confidence: result.confidence,
      analysisProvider: result.provider,
      analysisReason: result.reason,
      analysisChecks: result.checks,
      ocrText: "",
      ocrError: "",
      extractedVins: result.extractedVins || [],
      observedVin: result.observedVin || "",
      observedText: result.observedText || "",
      analyzedUploadIdentity: uploadIdentity,
      analyzedAt: now
    },
    sellerNotification: verified
      ? "Your listing passed vehicle presence verification and is now public."
      : "Vehicle presence verification needs review. Upload a new verification photo if requested.",
    updatedAt: now
  };
  if (vehiclePresenceReviewNeeded(result.status)) {
    await createVehiclePresenceReview(next, result);
  }
  console.info("[vehicle-presence] Verification job completed", {
    at: new Date().toISOString(),
    listingId,
    resultStatus: result.status,
    savedStatus: next.status,
    savedVerificationStatus: next.verificationStatus,
    confidence: result.confidence,
    checks: result.checks,
    provider: result.provider
  });
  return store.createListing(next);
}

async function processVehiclePresenceNow(listingId) {
  const listing = await store.getListingById(listingId);
  if (!listing) return null;
  return withVehiclePresenceVinLock(listing.vin, () => processVehiclePresenceUnlocked(listingId));
}

function scheduleVehiclePresenceVerification(listingId) {
  if (vehiclePresenceJobs.has(listingId)) {
    console.info("[vehicle-presence] Verification already scheduled", {
      at: new Date().toISOString(),
      listingId
    });
    return false;
  }
  vehiclePresenceJobs.add(listingId);
  setTimeout(() => {
    processVehiclePresenceNow(listingId).catch(async (error) => {
      console.error("[vehicle-presence] Background verification failed", {
        listingId,
        error: error.message
      });
      const listing = await store.getListingById(listingId).catch(() => null);
      if (!listing) return;
      const result = {
        status: vehiclePresence.PRESENCE_STATUSES.MANUAL_REVIEW,
        confidence: 0,
        reason: error.message || "Vehicle presence verification failed."
      };
      await createVehiclePresenceReview(listing, result).catch(() => {});
      await store.createListing({
        ...listing,
        status: "pending_verification",
        verificationStatus: vehiclePresence.PRESENCE_STATUSES.MANUAL_REVIEW,
        vehiclePresence: {
          ...(listing.vehiclePresence || {}),
          verification_status: vehiclePresence.PRESENCE_STATUSES.MANUAL_REVIEW,
          verificationStatus: vehiclePresence.PRESENCE_STATUSES.MANUAL_REVIEW,
          analysisReason: result.reason,
          analyzedAt: new Date().toISOString()
        }
      }).catch(() => {});
    }).finally(() => vehiclePresenceJobs.delete(listingId));
  }, 0);
  return true;
}

function createSellerListing(body = {}, user = null) {
  const year = numberFrom(body.year, new Date().getFullYear());
  const make = String(body.make || "").trim() || "Unknown make";
  const model = String(body.model || "").trim() || "Unknown model";
  const trim = String(body.trim || "").trim();
  const title = [year, make, model, trim].filter(Boolean).join(" ");
  const id = body.id && String(body.id).startsWith("seller_") ? String(body.id) : `seller_${Date.now()}`;
  const mileage = numberFrom(body.mileage, 0);
  const price = numberFrom(body.price, 0);
  const images = Array.isArray(body.images)
    ? body.images.filter(Boolean).map(String)
    : [];
  const imageUploads = Array.isArray(body.imageUploads)
    ? body.imageUploads
        .filter((item) => item && (item.url || item.fileUrl || item.s3Key || item.key))
        .map((item, index) => ({
          url: String(item.url || item.fileUrl || images[index] || "").trim(),
          fileUrl: String(item.fileUrl || item.url || images[index] || "").trim(),
          s3Key: String(item.s3Key || item.key || "").trim(),
          key: String(item.key || item.s3Key || "").trim(),
          name: String(item.name || item.fileName || "").trim(),
          contentType: String(item.contentType || "").trim(),
          size: numberFrom(item.size, 0),
          uploadedAt: String(item.uploadedAt || new Date().toISOString())
        }))
    : images.map((url) => ({
        url,
        fileUrl: url,
        s3Key: "",
        key: "",
        name: "",
        contentType: "",
        size: 0,
        uploadedAt: new Date().toISOString()
      }));
  const image = String(body.image || images[0] || "").trim() || "https://images.unsplash.com/photo-1549924231-f129b911e442?auto=format&fit=crop&w=1600&q=80";
  const submittedFeatures = Array.isArray(body.features)
    ? body.features.filter(Boolean).map(String)
    : [];
  const maintenanceNames = Array.isArray(body.maintenanceNames)
    ? body.maintenanceNames.filter(Boolean).map(String)
    : [];
  const maintenanceRecords = Array.isArray(body.maintenanceRecords)
    ? body.maintenanceRecords
        .filter((record) => record && (record.name || record.fileName))
        .map((record) => normalizeListingDocument(record, "maintenance"))
    : maintenanceNames.map((name) => ({
        ...normalizeListingDocument({ name, type: "Other" }, "maintenance")
      }));
  const titleDocument = body.titleDocument
    ? normalizeListingDocument(body.titleDocument, "title")
    : null;
  const historyTimeline = Array.isArray(body.historyTimeline)
    ? body.historyTimeline
        .filter((event) => event && (event.title || event.notes || event.date))
        .map((event) => ({
          id: String(event.id || `hist_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`),
          date: String(event.date || "").trim(),
          title: String(event.title || "").trim(),
          notes: String(event.notes || "").trim()
        }))
    : [];
  const titleStatus = String(body.titleStatus || "").trim();
  const accidentHistory = String(body.accidentHistory || "").trim();
  const ownerCount = String(body.ownerCount || "").trim();
  const listingAccuracyCertifiedAt = body.listingAccuracyCertified
    ? String(body.listingAccuracyCertifiedAt || new Date().toISOString())
    : "";
  const sellerChecklist = SELLER_CHECKLIST_KEYS.reduce((acc, key) => {
    acc[key] = Boolean(body.sellerChecklist?.[key]);
    return acc;
  }, {});
  const presenceCode = String(body.vehiclePresenceCode || body.verification_code || body.verificationCode || "").trim();
  const presenceGeneratedAt = String(body.vehiclePresenceGeneratedAt || body.generated_at || "").trim();
  const presenceExpiresAt = String(body.vehiclePresenceExpiresAt || body.expires_at || "").trim();
  const presencePhotoUrl = String(body.vehiclePresencePhotoUrl || body.verification_photo_url || body.verificationPhotoUrl || "").trim();
  const presenceS3Key = String(body.vehiclePresenceS3Key || body.verificationPhotoS3Key || "").trim();

  const listing = {
    id,
    title,
    make,
    model,
    year,
    trim,
    price,
    mileage,
    location: String(body.location || "Private seller").trim(),
    zip: String(body.zip || "").trim(),
    lat: numberFrom(body.lat, 39.5),
    lng: numberFrom(body.lng, -98.35),
    bodyType: String(body.bodyType || "Sedan").trim(),
    fuelType: String(body.fuelType || "Gasoline").trim(),
    transmission: String(body.transmission || "Automatic").trim(),
    drivetrain: String(body.drivetrain || "").trim(),
    color: String(body.color || "").trim(),
    condition: String(body.condition || "Good").trim(),
    sellerRating: 0,
    dealScore: numberFrom(body.dealScore, 75),
    fairValueDelta: numberFrom(body.fairValueDelta, 0),
    status: "pending_verification",
    expiresAt: String(body.expiresAt || new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()),
    reviewFlags: [],
    vin: normalizeVin(body.vin),
    titleStatus,
    accidentHistory,
    ownerCount,
    maintenanceNames: maintenanceRecords.map((record) => record.name),
    maintenanceRecords,
    titleDocument,
    historyTimeline,
    historyHighlights: [titleStatus, accidentHistory, ownerCount].filter(Boolean),
    verificationStatus: vehiclePresence.PRESENCE_STATUSES.PENDING,
    vehiclePresenceVerified: false,
    vehiclePresence: {
      verification_code: presenceCode,
      verificationCode: presenceCode,
      generated_at: presenceGeneratedAt,
      generatedAt: presenceGeneratedAt,
      expires_at: presenceExpiresAt,
      expiresAt: presenceExpiresAt,
      verification_photo_url: presencePhotoUrl,
      verificationPhotoUrl: presencePhotoUrl,
      verificationPhotoS3Key: presenceS3Key,
      verification_status: vehiclePresence.PRESENCE_STATUSES.PENDING,
      verificationStatus: vehiclePresence.PRESENCE_STATUSES.PENDING,
      verified_at: "",
      verifiedAt: ""
    },
    photoChallengeCode: presenceCode,
    challengeCode: presenceCode,
    photoChallengeProofImage: presencePhotoUrl,
    photoChallengeVerified: false,
    livePhotoVerified: false,
    challengeCodeVerified: false,
    listingAccuracyCertified: Boolean(body.listingAccuracyCertified),
    listingAccuracyVersion: String(body.listingAccuracyVersion || (body.listingAccuracyCertified ? "v1.0" : "")),
    listingAccuracyCertifiedAt,
    listingAccuracyCertifiedIp: String(body.listingAccuracyCertifiedIp || ""),
    sellerChecklist,
    badges: [
      "Private seller",
      "Seller draft",
      "Verification pending",
      titleStatus === "Clean Title" ? "Clean title disclosed" : "",
      accidentHistory === "No accidents reported" ? "No accidents disclosed" : ""
    ].filter(Boolean),
    features: submittedFeatures,
    images: images.length ? images : [image],
    imageUploads,
    imageS3Keys: imageUploads.map((item) => item.s3Key).filter(Boolean),
    seller: {
      name: String(body.sellerName || "Kerodex seller").trim(),
      id: body.userId ? String(body.userId) : "",
      responseTime: "New listing",
      completedSales: 0,
      verified: false,
      memberSince: new Date().toISOString()
    },
    description: String(body.description || "").trim(),
    updatedAt: new Date().toISOString()
  };

  if (user) {
    listing.userId = user.id;
    listing.seller = {
      id: user.id,
      name: user.name || user.email.split("@")[0] || "Kerodex seller",
      avatarUrl: publicUser(user).avatarUrl || "",
      avatarS3Key: user.avatarS3Key || user.profileImageS3Key || "",
      responseTime: "New listing",
      completedSales: 0,
      phoneVerified: Boolean(user.phoneVerified && isFreshPhoneVerification(user.phoneVerifiedAt)),
      verified: PERSONA_IDENTITY_VERIFICATION_ENABLED && Boolean(user.identityVerified),
      memberSince: user.createdAt || new Date().toISOString()
    };
  }

  return listing;
}

function createConversationRecord({ listing, buyer, message }) {
  const sellerId = listing.userId || listing.seller?.id || `seller_${listing.id}`;
  const id = `conv_${buyer.id}_${listing.id}`;
  const now = new Date().toISOString();
  const content = normalizeLimitedString(message || "Hi, is this still available?", 2000);
  const scan = scanMessageForScamRisk(content);
  const conversation = {
    id,
    listingId: listing.id,
    buyerId: buyer.id,
    sellerId,
    buyerName: buyer.name || buyer.email.split("@")[0],
    sellerName: listing.seller?.name || "Kerodex seller",
    vehicleTitle: listing.title || `${listing.year} ${listing.make} ${listing.model}`,
    lastMessage: content,
    unread: 1,
    unreadByUser: { [sellerId]: 1 },
    scamRiskScore: scan.scamRiskScore,
    scamFlags: scan.scamFlags,
    moderationStatus: scan.moderationStatus,
    buyerLastActiveAt: buyer.lastActiveAt || buyer.lastLoginAt || now,
    sellerLastActiveAt: listing.seller?.lastActiveAt || listing.updatedAt || now,
    isDemo: Boolean(listing.isDemo || listing.is_demo),
    updatedAt: now,
    messages: [
      {
        id: `msg_${Date.now()}`,
        senderId: buyer.id,
        receiverId: sellerId,
        vehicleId: listing.id,
        content,
        createdAt: now,
        scamRiskScore: scan.scamRiskScore,
        scamFlags: scan.scamFlags,
        moderationStatus: scan.moderationStatus
      }
    ]
  };
  if (conversation.isDemo) {
    const replyAt = new Date(Date.now() + 1000).toISOString();
    const reply = "Thanks for trying Kerodex Messages. This is an automated demo-seller reply—this vehicle is not actually for sale, and no real seller was contacted.";
    conversation.messages.push({
      id: `msg_demo_${Date.now()}`,
      senderId: sellerId,
      receiverId: buyer.id,
      vehicleId: listing.id,
      content: reply,
      createdAt: replyAt,
      scamRiskScore: 0,
      scamFlags: [],
      moderationStatus: "clear"
    });
    conversation.lastMessage = reply;
    conversation.unread = 1;
    conversation.unreadByUser = { [buyer.id]: 1, [sellerId]: 0 };
    conversation.updatedAt = replyAt;
  }
  return conversation;
}

function runtimeUserById(id) {
  return Array.from(users.values()).find((user) => user.id === id) || null;
}

function decorateConversation(conversation, user) {
  const currentIsBuyer = conversation.buyerId === user.id;
  const partnerId = currentIsBuyer ? conversation.sellerId : conversation.buyerId;
  const runtimePartner = partnerId ? runtimeUserById(partnerId) : null;
  const partnerName = runtimePartner?.name ||
    (currentIsBuyer ? conversation.sellerName : conversation.buyerName) ||
    "Kerodex member";
  const partnerLastActiveAt = runtimePartner?.lastActiveAt ||
    (currentIsBuyer ? conversation.sellerLastActiveAt : conversation.buyerLastActiveAt) ||
    conversation.updatedAt;
  const receivedRiskMessages = (conversation.messages || []).filter((message) =>
    message.receiverId === user.id && message.moderationStatus && message.moderationStatus !== "clear"
  );
  const visibleRiskScore = receivedRiskMessages.reduce(
    (max, message) => Math.max(max, Number(message.scamRiskScore || 0)),
    0
  );
  const visibleScamFlags = Array.from(new Set(receivedRiskMessages.flatMap((message) => message.scamFlags || [])));
  const visibleModerationStatus = receivedRiskMessages.some((message) => message.moderationStatus === "high_risk")
    ? "high_risk"
    : (receivedRiskMessages.length ? "needs_review" : "clear");
  return {
    ...conversation,
    currentUserRole: currentIsBuyer ? "buyer" : "seller",
    outcomes: conversation.outcomes || {},
    currentUserOutcome: conversation.outcomes?.[currentIsBuyer ? "buyer" : "seller"] || "",
    partnerId,
    partnerName,
    partnerLastActiveAt,
    unread: Number(conversation.unreadByUser?.[user.id] ?? conversation.unread ?? 0),
    scamRiskScore: visibleRiskScore,
    scamFlags: visibleScamFlags,
    moderationStatus: visibleModerationStatus,
    vehicleTitle: conversation.vehicleTitle || `Vehicle ${String(conversation.listingId || "").slice(0, 6)}`
  };
}

function appendConversationMessage(conversation, user, content) {
  const currentIsBuyer = conversation.buyerId === user.id;
  const currentIsSeller = conversation.sellerId === user.id;
  if (!currentIsBuyer && !currentIsSeller) return null;
  const now = new Date().toISOString();
  const receiverId = currentIsBuyer ? conversation.sellerId : conversation.buyerId;
  const cleanContent = normalizeLimitedString(content, 2000);
  const scan = scanMessageForScamRisk(cleanContent);
  const message = {
    id: `msg_${Date.now()}_${crypto.randomBytes(3).toString("hex")}`,
    senderId: user.id,
    receiverId,
    vehicleId: conversation.listingId,
    content: cleanContent,
    createdAt: now,
    scamRiskScore: scan.scamRiskScore,
    scamFlags: scan.scamFlags,
    moderationStatus: scan.moderationStatus
  };
  if (!message.content) return null;
  const nextRiskScore = Math.max(Number(conversation.scamRiskScore || 0), scan.scamRiskScore);
  const nextFlags = Array.from(new Set([...(conversation.scamFlags || []), ...scan.scamFlags]));
  const nextModerationStatus = scan.moderationStatus === "high_risk" || conversation.moderationStatus === "high_risk"
    ? "high_risk"
    : (scan.moderationStatus === "needs_review" || conversation.moderationStatus === "needs_review" ? "needs_review" : "clear");
  const unreadByUser = {
    ...(conversation.unreadByUser || {}),
    [receiverId]: Number(conversation.unreadByUser?.[receiverId] || 0) + 1
  };
  const unreadTotal = Object.values(unreadByUser).reduce((sum, value) => sum + Number(value || 0), 0);
  return {
    ...conversation,
    messages: [...(conversation.messages || []), message],
    lastMessage: message.content,
    unread: unreadTotal,
    unreadByUser,
    scamRiskScore: nextRiskScore,
    scamFlags: nextFlags,
    moderationStatus: nextModerationStatus,
    buyerLastActiveAt: currentIsBuyer ? now : conversation.buyerLastActiveAt,
    sellerLastActiveAt: currentIsSeller ? now : conversation.sellerLastActiveAt,
    updatedAt: now
  };
}

async function notifyMessageRecipient(conversation, sender, listing) {
  const lastMessage = (conversation.messages || [])[conversation.messages.length - 1];
  const recipientId = lastMessage?.receiverId;
  if (!recipientId) return;
  const recipient = runtimeUserById(recipientId) || (typeof store.getUserById === "function" ? await store.getUserById(recipientId) : null);
  if (!recipient?.email) return;
  await sendTransactionalEmail({
    to: recipient.email,
    subject: `[Kerodex] New message about ${conversation.vehicleTitle || listing?.title || "a vehicle"}`,
    heading: "You have a new Kerodex message",
    body: `${sender.name || sender.email || "A Kerodex member"} sent you a message about ${conversation.vehicleTitle || listing?.title || "your vehicle"}. Open Kerodex to reply safely inside the marketplace.`,
    actionUrl: `${process.env.PUBLIC_SITE_URL || "https://kerodexofficial.com"}/messages`,
    actionLabel: "Open messages"
  });
}

async function decodeVin(vin) {
  const cleanVin = normalizeVin(vin);
  if (!/^[A-HJ-NPR-Z0-9]{17}$/.test(cleanVin)) {
    return {
      ok: false,
      error: "VIN must be 17 characters and cannot include I, O, or Q.",
      vin: cleanVin
    };
  }

  const apiUrl = `https://vpic.nhtsa.dot.gov/api/vehicles/DecodeVinValues/${encodeURIComponent(cleanVin)}?format=json`;
  const response = await fetch(apiUrl, {
    headers: {
      accept: "application/json",
      "user-agent": "Kerodex local prototype VIN verification"
    }
  });

  if (!response.ok) {
    throw new Error(`NHTSA vPIC request failed with ${response.status}`);
  }

  const data = await response.json();
  const result = data.Results && data.Results[0] ? data.Results[0] : {};
  const errorCode = String(result.ErrorCode || "");
  return {
    ok: errorCode === "0" || errorCode === "",
    vin: cleanVin,
    errorCode,
    errorText: result.ErrorText || "",
    vehicle: {
      year: result.ModelYear || "",
      make: result.Make || "",
      model: result.Model || "",
      trim: result.Trim || result.Series || result.Trim2 || "",
      series: result.Series || "",
      bodyClass: result.BodyClass || "",
      vehicleType: result.VehicleType || "",
      fuelType: result.FuelTypePrimary || "",
      driveType: result.DriveType || "",
      plantCountry: result.PlantCountry || ""
    },
    source: "NHTSA vPIC"
  };
}

function serveStatic(req, res, pathname) {
  const requestedPath = pathname === "/" ? "/index.html" : pathname;
  const filePath = path.resolve(PUBLIC_DIR, `.${requestedPath}`);

  if (!filePath.startsWith(PUBLIC_DIR)) {
    sendJson(res, 403, { error: "Forbidden" });
    return;
  }

  fs.readFile(filePath, (error, file) => {
    if (error) {
      fs.readFile(path.join(PUBLIC_DIR, "index.html"), (fallbackError, fallback) => {
        if (fallbackError) {
          sendJson(res, 404, { error: "Not found" });
          return;
        }
        res.writeHead(200, responseHeaders(res, { "content-type": mimeTypes[".html"] }));
        res.end(fallback);
      });
      return;
    }

    const ext = path.extname(filePath);
    const isHtml = ext === ".html";
    const cacheControl = isHtml ? "no-store" : "public, max-age=31536000, immutable";
    res.writeHead(200, responseHeaders(res, {
      "content-type": mimeTypes[ext] || "application/octet-stream",
      "cache-control": cacheControl
    }));
    res.end(file);
  });
}

function handleEvents(req, res) {
  res.writeHead(200, responseHeaders(res, {
    "content-type": "text/event-stream",
    "cache-control": "no-cache",
    connection: "keep-alive"
  }));

  const send = async () => {
    const listings = await store.getListings();
    if (!listings.length) return;
    const listing = listings
      .slice()
      .sort((a, b) => Date.parse(b.updatedAt || b.createdAt || "") - Date.parse(a.updatedAt || a.createdAt || ""))[0];
    res.write(`event: listing.updated\n`);
    res.write(`data: ${JSON.stringify({ id: listing.id, updatedAt: new Date().toISOString() })}\n\n`);
  };

  send().catch(() => {});
  const timer = setInterval(() => send().catch(() => {}), 12000);
  req.on("close", () => clearInterval(timer));
}

const server = http.createServer((req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);
  const origin = String(req.headers.origin || "");
  res._kerodexCorsHeaders = corsHeaders(req);

  if (origin && !isAllowedCorsOrigin(origin)) {
    console.warn(`[Kerodex security] blocked_cors origin=${origin} path=${url.pathname}`);
    sendJson(res, 403, { success: false, error: "Origin is not allowed." });
    return;
  }

  if (req.method === "OPTIONS") {
    res.writeHead(204, responseHeaders(res, {
      "access-control-allow-methods": "GET,POST,PATCH,OPTIONS",
      "access-control-allow-headers": "content-type,authorization,x-kerodex-session",
      "access-control-max-age": "600"
    }));
    res.end();
    return;
  }

  if (!applyRateLimit(req, res, url.pathname)) return;

  const contentLength = Number(req.headers["content-length"] || 0);
  if (contentLength > JSON_BODY_LIMIT_BYTES && url.pathname.startsWith("/api/")) {
    sendJson(res, 413, { success: false, error: "Request body is too large." });
    return;
  }

  if (url.pathname === "/api/health") {
    Promise.resolve(typeof store.healthCheck === "function" ? store.healthCheck() : { ok: true, kind: store.kind })
      .then((database) => sendJson(res, database.ok ? 200 : 503, {
        ok: Boolean(database.ok),
        service: "kerodex-api",
        dataSource: store.kind,
        database,
        timestamp: new Date().toISOString()
      }))
      .catch((error) => sendJson(res, 503, {
        ok: false,
        service: "kerodex-api",
        dataSource: store.kind,
        database: {
          ok: false,
          kind: store.kind,
          databaseStatus: "unreachable",
          error: IS_PRODUCTION ? "Database health check failed." : error.message
        },
        timestamp: new Date().toISOString()
      }));
    return;
  }

  if (url.pathname === "/api/events/track" && req.method === "POST") {
    const user = getAuthUser(req);
    readJson(req)
      .then(async (body) => {
        const allowed = new Set([
          "page_view",
          "listing_view",
          "listing_viewed",
          "search_performed",
          "filter_used",
          "save_listing",
          "unsave_listing",
          "listing_started",
          "listing_photos_uploaded",
          "seller_contact_clicked",
          "buyer_guide_started",
          "buyer_guide_completed"
        ]);
        const eventType = allowed.has(String(body.eventType || "")) ? String(body.eventType) : "page_view";
        await trackEvent(req, eventType, user, {
          route: String(body.route || ""),
          listingId: String(body.listingId || ""),
          query: String(body.query || "").slice(0, 120),
          filter: String(body.filter || "").slice(0, 120)
        });
        sendJson(res, 202, { ok: true });
      })
      .catch((error) => sendJson(res, 400, { error: "Unable to track event.", detail: error.message }));
    return;
  }

  if (url.pathname === "/api/admin/auth/login" && req.method === "POST") {
    readJson(req)
      .then(async (body) => {
        const session = adminLogin(body);
        if (!session) {
          sendJson(res, 401, { error: "Invalid admin password." });
          return;
        }
        store.recordAdminAction({
          adminAccount: session.admin.email,
          actionType: "admin.login",
          targetType: "admin_account",
          targetId: session.admin.id,
          previousValue: null,
          newValue: "session_created"
        }).catch(() => {});
        sendJson(res, 200, session);
      })
      .catch((error) => sendJson(res, 400, { error: error.message || "Invalid request body." }));
    return;
  }

  if (url.pathname === "/api/admin/session" && req.method === "GET") {
    const admin = requireAdmin(req, res, "dashboard:read");
    if (!admin) return;
    sendJson(res, 200, { admin: publicAdmin(admin) });
    return;
  }

  if (url.pathname === "/api/admin/dashboard" && req.method === "GET") {
    const admin = requireAdmin(req, res, "dashboard:read");
    if (!admin) return;
    store.getAdminDashboard({ includeDemo: url.searchParams.get("includeDemo") === "true" })
      .then((dashboard) => sendJson(res, 200, dashboard))
      .catch((error) => sendJson(res, 500, { error: "Unable to load admin dashboard.", detail: error.message }));
    return;
  }

  if (url.pathname === "/api/admin/analytics" && req.method === "GET") {
    const admin = requireAdmin(req, res, "analytics:read");
    if (!admin) return;
    store.getAdminDashboard({ includeDemo: url.searchParams.get("includeDemo") === "true" })
      .then((dashboard) => sendJson(res, 200, { website: dashboard.website, charts: dashboard.charts, funnel: dashboard.funnel }))
      .catch((error) => sendJson(res, 500, { error: "Unable to load analytics.", detail: error.message }));
    return;
  }

  if (url.pathname === "/api/admin/costs" && req.method === "GET") {
    const admin = requireAdmin(req, res, "analytics:read");
    if (!admin) return;
    store.getCostRecords()
      .then((records) => {
        const now = Date.now();
        const sumSince = (days) => records
          .filter((record) => Date.parse(record.createdAt) >= now - days * 86400000)
          .reduce((sum, record) => sum + Number(record.estimatedCost || 0), 0);
        const byService = Object.entries(records.reduce((acc, record) => {
          acc[record.serviceName] = (acc[record.serviceName] || 0) + Number(record.estimatedCost || 0);
          return acc;
        }, {})).map(([service, cost]) => ({ service, cost: Number(Number(cost).toFixed(4)) }));
        sendJson(res, 200, {
          summary: {
            today: Number(sumSince(1).toFixed(4)),
            last7Days: Number(sumSince(7).toFixed(4)),
            last30Days: Number(sumSince(30).toFixed(4)),
            failedCalls: records.filter((record) => record.status === "failure").length,
            totalRecords: records.length
          },
          byService,
          records: records.slice(0, 250)
        });
      })
      .catch((error) => sendJson(res, 500, { error: "Unable to load cost analytics.", detail: error.message }));
    return;
  }

  if (url.pathname === "/api/admin/feedback" && req.method === "GET") {
    const admin = requireAdmin(req, res, "analytics:read");
    if (!admin) return;
    store.getFeedbackRecords()
      .then((records) => sendJson(res, 200, {
        records,
        summary: {
          total: records.length,
          averageRating: (() => {
            const ratings = records.map((record) => Number(record.rating)).filter(Number.isFinite);
            return ratings.length ? Number((ratings.reduce((sum, rating) => sum + rating, 0) / ratings.length).toFixed(1)) : null;
          })(),
          byContext: Object.entries(records.reduce((acc, record) => {
            acc[record.context] = (acc[record.context] || 0) + 1;
            return acc;
          }, {})).map(([context, count]) => ({ context, count }))
        }
      }))
      .catch((error) => sendJson(res, 500, { error: "Unable to load feedback.", detail: error.message }));
    return;
  }

  if (url.pathname === "/api/admin/activity" && req.method === "GET") {
    const admin = requireAdmin(req, res, "audit:read");
    if (!admin) return;
    store.getAdminActivity(url.searchParams)
      .then((activity) => sendJson(res, 200, activity))
      .catch((error) => sendJson(res, 500, { error: "Unable to load platform activity.", detail: error.message }));
    return;
  }

  if (url.pathname === "/api/admin/search" && req.method === "GET") {
    const admin = requireAdmin(req, res, "dashboard:read");
    if (!admin) return;
    store.searchAdmin(url.searchParams.get("q"))
      .then((results) => sendJson(res, 200, results))
      .catch((error) => sendJson(res, 500, { error: "Unable to search admin data.", detail: error.message }));
    return;
  }

  if (url.pathname === "/api/admin/system" && req.method === "GET") {
    const admin = requireAdmin(req, res, "system:read");
    if (!admin) return;
    store.getAdminSystem()
      .then((system) => sendJson(res, 200, system))
      .catch((error) => sendJson(res, 500, { error: "Unable to load system health.", detail: error.message }));
    return;
  }

  if (url.pathname === "/api/admin/messages/review" && req.method === "GET") {
    const admin = requireAdmin(req, res, "reports:read");
    if (!admin) return;
    const conversationId = String(url.searchParams.get("conversationId") || "").trim();
    const reason = String(url.searchParams.get("reason") || "").trim();
    if (!conversationId || reason.length < 5) {
      sendJson(res, 400, { error: "Conversation ID and review reason are required." });
      return;
    }
    Promise.resolve(typeof store.getConversationById === "function" ? store.getConversationById(conversationId) : null)
      .then(async (conversation) => {
        if (!conversation) {
          sendJson(res, 404, { error: "Conversation not found." });
          return;
        }
        await store.recordAdminAction({
          adminAccount: admin.email,
          actionType: "messages.review_accessed",
          targetType: "conversation",
          targetId: conversationId,
          previousValue: null,
          newValue: "conversation_viewed",
          notes: reason
        });
        sendJson(res, 200, { conversation });
      })
      .catch((error) => sendJson(res, 500, { error: "Unable to load message review.", detail: error.message }));
    return;
  }

  if (url.pathname === "/api/admin/events") {
    sendAdminEvents(req, res);
    return;
  }

  const adminCollectionMatch = url.pathname.match(/^\/api\/admin\/(users|listings|verifications|reports|fraud-flags|audit-logs|notifications|tickets|feature-flags)$/);
  if (adminCollectionMatch && req.method === "GET") {
    const routeName = adminCollectionMatch[1];
    const collection = routeName.replace(/-([a-z])/g, (_, letter) => letter.toUpperCase());
    const permissionMap = {
      users: "users:read",
      listings: "listings:read",
      verifications: "verifications:read",
      reports: "reports:read",
      fraudFlags: "fraud:read",
      auditLogs: "audit:read",
      notifications: "dashboard:read",
      tickets: "reports:read",
      featureFlags: "system:read"
    };
    const admin = requireAdmin(req, res, permissionMap[collection]);
    if (!admin) return;
    store.getAdminCollection(collection, url.searchParams)
      .then((body) => sendJson(res, 200, body))
      .catch((error) => sendJson(res, 500, { error: `Unable to load ${routeName}.`, detail: error.message }));
    return;
  }

  const adminItemMatch = url.pathname.match(/^\/api\/admin\/(users|listings|verifications|reports|fraud-flags)\/([^/]+)$/);
  if (adminItemMatch && req.method === "GET") {
    const routeName = adminItemMatch[1];
    const collection = routeName.replace(/-([a-z])/g, (_, letter) => letter.toUpperCase());
    const permissionMap = {
      users: "users:read",
      listings: "listings:read",
      verifications: "verifications:read",
      reports: "reports:read",
      fraudFlags: "fraud:read"
    };
    const admin = requireAdmin(req, res, permissionMap[collection]);
    if (!admin) return;
    store.getAdminItem(collection, decodeURIComponent(adminItemMatch[2]))
      .then((item) => sendJson(res, item ? 200 : 404, item || { error: "Admin record not found." }))
      .catch((error) => sendJson(res, 500, { error: `Unable to load ${routeName}.`, detail: error.message }));
    return;
  }

  const adminActionMatch = url.pathname.match(/^\/api\/admin\/(users|listings|verifications|reports|fraud-flags)\/([^/]+)\/actions$/);
  if (adminActionMatch && req.method === "PATCH") {
    const routeName = adminActionMatch[1];
    const collection = routeName.replace(/-([a-z])/g, (_, letter) => letter.toUpperCase());
    const permissionMap = {
      users: "users:write",
      listings: "listings:write",
      verifications: "verifications:write",
      reports: "reports:write",
      fraudFlags: "fraud:write"
    };
    const admin = requireAdmin(req, res, permissionMap[collection]);
    if (!admin) return;
    readJson(req)
      .then(async (body) => {
        const action = String(body.action || "");
        const notes = String(body.notes || "").trim();
        const sensitive = new Set(["ban", "unban", "suspend", "unsuspend", "delete", "remove", "restore", "approve", "reject", "request_resubmission", "shadow_ban", "disable_messaging", "disable_listing_creation", "review", "resolve", "dismiss", "warn_user", "escalate", "mark_fraud_confirmed"]);
        if (sensitive.has(action) && notes.length < 5) {
          throw new Error("Admin action reason is required.");
        }
        const id = decodeURIComponent(adminActionMatch[2]);
        const result = await store.applyAdminAction(collection, id, action, admin.email, notes);
        if (result && collection === "users" && typeof store.getUserById === "function") {
          const updatedUser = await store.getUserById(id);
          if (updatedUser?.email) {
            users.set(normalize(updatedUser.email), updatedUser);
            if (["banned", "suspended", "deleted"].includes(String(updatedUser.status || "").toLowerCase())) {
              await invalidateUserSessions(updatedUser.id);
            }
          }
        }
        if (result && collection === "listings" && ["remove", "restore", "flag", "mark_sold"].includes(action)) {
          const listing = await store.getListingById(id);
          const owner = listing?.userId && typeof store.getUserById === "function" ? await store.getUserById(listing.userId) : null;
          if (owner?.email) {
            sendTransactionalEmail({
              to: owner.email,
              subject: `[Kerodex] Listing ${action.replace(/_/g, " ")}`,
              heading: "Your Kerodex listing was updated",
              body: `A Kerodex moderator marked "${listing.title || "your listing"}" as ${action.replace(/_/g, " ")}. Reason: ${notes}`,
              actionUrl: `${process.env.PUBLIC_SITE_URL || "https://kerodexofficial.com"}/vehicle/${listing.id}`,
              actionLabel: "View listing"
            }).catch(() => {});
          }
        }
        if (result && collection === "verifications" && ["approve", "reject", "request_resubmission"].includes(action)) {
          const listingId = result.item?.listingId;
          const listing = listingId ? await store.getListingById(listingId) : null;
          const owner = listing?.userId && typeof store.getUserById === "function" ? await store.getUserById(listing.userId) : null;
          if (owner?.email) {
            sendTransactionalEmail({
              to: owner.email,
              subject: `[Kerodex] Vehicle verification ${action.replace(/_/g, " ")}`,
              heading: "Vehicle verification update",
              body: `Kerodex updated the verification status for "${listing?.title || "your listing"}". Status: ${action.replace(/_/g, " ")}. ${notes}`,
              actionUrl: `${process.env.PUBLIC_SITE_URL || "https://kerodexofficial.com"}/vehicle/${listing?.id || ""}`,
              actionLabel: "Open listing"
            }).catch(() => {});
          }
        }
        return result;
      })
      .then((result) => sendJson(res, result ? 200 : 404, result || { error: "Admin record not found." }))
      .catch((error) => sendJson(res, 400, { error: "Unable to apply admin action.", detail: error.message }));
    return;
  }

  const adminMarketCheckRefreshMatch = url.pathname.match(/^\/api\/admin\/listings\/([^/]+)\/marketcheck-refresh$/);
  if (adminMarketCheckRefreshMatch && req.method === "POST") {
    const admin = requireAdmin(req, res, "listings:write");
    if (!admin) return;
    const id = decodeURIComponent(adminMarketCheckRefreshMatch[1]);
    store.getListingById(id)
      .then(async (listing) => {
        if (!listing) {
          sendJson(res, 404, { error: "Listing not found." });
          return;
        }
        if (!listing.vin) {
          sendJson(res, 400, { error: "Listing does not have a VIN to refresh." });
          return;
        }
        const refreshed = await enrichListingWithMarketCheck(listing, { forceValuationRefresh: true });
        const saved = await store.createListing(refreshed);
        await store.recordAdminAction({
          adminAccount: admin.email,
          actionType: "listings.marketcheck_refresh",
          targetType: "listings",
          targetId: id,
          previousValue: null,
          newValue: JSON.stringify({ marketValueDate: saved.marketValueDate, marketValue: saved.marketValue }),
          notes: "Manual MarketCheck refresh"
        });
        sendJson(res, 200, { listing: listingWithReadableImages(saved), marketCheckRefreshed: true });
      })
      .catch((error) => sendJson(res, error.status || 400, {
        error: error.message || "Unable to refresh MarketCheck data.",
        code: error.code,
        detail: error.detail || error.message
      }));
    return;
  }

  const adminExportMatch = url.pathname.match(/^\/api\/admin\/export\/(users|listings|verifications|reports|fraud-flags|audit-logs)$/);
  if (adminExportMatch && req.method === "GET") {
    const routeName = adminExportMatch[1];
    const collection = routeName.replace(/-([a-z])/g, (_, letter) => letter.toUpperCase());
    const admin = requireAdmin(req, res, "audit:read");
    if (!admin) return;
    store.exportAdminCollection(collection)
      .then((csv) => sendCsv(res, `${routeName}.csv`, csv))
      .catch((error) => sendJson(res, 500, { error: "Unable to export CSV.", detail: error.message }));
    return;
  }

  if (url.pathname === "/api/auth/google") {
    const clientId = process.env.GOOGLE_CLIENT_ID;
    const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
    if (!clientId || !clientSecret) {
      if ((req.headers.accept || "").includes("application/json")) {
        sendJson(res, 503, { error: "Google sign in needs GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET." });
        return;
      }
      sendAuthSetup(res, "google");
      return;
    }
    const redirectUri = `${appOrigin(req)}/api/auth/callback/google`;
    const authUrl = new URL("https://accounts.google.com/o/oauth2/v2/auth");
    authUrl.searchParams.set("client_id", clientId);
    authUrl.searchParams.set("redirect_uri", redirectUri);
    authUrl.searchParams.set("response_type", "code");
    authUrl.searchParams.set("scope", "openid email profile");
    authUrl.searchParams.set("prompt", "select_account");
    authUrl.searchParams.set("state", makeOAuthState("google", {
      termsAccepted: url.searchParams.get("termsAccepted") === "true",
      privacyAccepted: url.searchParams.get("privacyAccepted") === "true"
    }));
    redirect(res, authUrl.toString());
    return;
  }

  if (url.pathname === "/api/auth/microsoft") {
    const clientId = process.env.MICROSOFT_CLIENT_ID;
    const clientSecret = process.env.MICROSOFT_CLIENT_SECRET;
    if (!clientId || !clientSecret) {
      if ((req.headers.accept || "").includes("application/json")) {
        sendJson(res, 503, { error: "Microsoft sign in needs MICROSOFT_CLIENT_ID and MICROSOFT_CLIENT_SECRET." });
        return;
      }
      sendAuthSetup(res, "microsoft");
      return;
    }
    const tenant = process.env.MICROSOFT_TENANT_ID || "common";
    const redirectUri = `${appOrigin(req)}/api/auth/callback/microsoft`;
    const authUrl = new URL(`https://login.microsoftonline.com/${encodeURIComponent(tenant)}/oauth2/v2.0/authorize`);
    authUrl.searchParams.set("client_id", clientId);
    authUrl.searchParams.set("redirect_uri", redirectUri);
    authUrl.searchParams.set("response_type", "code");
    authUrl.searchParams.set("scope", "openid email profile");
    authUrl.searchParams.set("response_mode", "query");
    authUrl.searchParams.set("prompt", "select_account");
    authUrl.searchParams.set("state", makeOAuthState("microsoft", {
      termsAccepted: url.searchParams.get("termsAccepted") === "true",
      privacyAccepted: url.searchParams.get("privacyAccepted") === "true"
    }));
    redirect(res, authUrl.toString());
    return;
  }

  if (url.pathname.startsWith("/api/auth/callback/")) {
    const provider = url.pathname.endsWith("/microsoft") ? "microsoft" : "google";
    const readPayload = req.method === "POST" ? readForm(req) : Promise.resolve(Object.fromEntries(url.searchParams));
    readPayload
      .then(async (payload) => {
        const code = String(payload.code || "");
        const state = String(payload.state || "");
        const stateRecord = consumeOAuthState(state, provider);
        if (!code || !stateRecord) {
          throw new Error("OAuth state is invalid or expired. Try signing in again.");
        }
        const redirectUri = `${appOrigin(req)}/api/auth/callback/${provider}`;
        const profile = provider === "microsoft"
          ? await exchangeMicrosoftCode({ code, redirectUri })
          : await exchangeGoogleCode({ code, redirectUri });
        const user = await upsertOAuthUser(provider, profile, stateRecord.legalConsent || {});
        const session = createSession(user);
        await trackEvent(req, "login", user, { provider });
        redirect(res, `/?auth=success&token=${encodeURIComponent(session.token)}&user=${encodeURIComponent(JSON.stringify(session.user))}`);
      })
      .catch((error) => {
        const message = error.code === "oauth_account_missing"
          ? "No account exists for that Google or Microsoft sign-in yet. Create an account first, then connect this sign-in method."
          : "Authentication failed. Please try again.";
        console.warn(`[Kerodex security] oauth_callback_failed provider=${provider} ${error.message}`);
        redirect(res, `/?auth=error&message=${encodeURIComponent(message)}`);
      });
    return;
  }

  if (url.pathname === "/api/auth/session" && req.method === "GET") {
    const token = authTokenFromRequest(req);
    const userId = sessions.get(token);
    const user = Array.from(users.values()).find((item) => item.id === userId);
    sendJson(res, user ? 200 : 401, user ? { user: publicUser(user) } : { error: "Not signed in" });
    return;
  }

  if (url.pathname === "/api/auth/logout" && req.method === "POST") {
    invalidateSession(authTokenFromRequest(req))
      .then(() => sendJson(res, 200, { success: true, message: "Signed out." }))
      .catch((error) => {
        console.warn(`[Kerodex security] logout_failed ${error.message}`);
        sendJson(res, 200, { success: true, message: "Signed out." });
      });
    return;
  }

  if (url.pathname === "/api/auth/email" && req.method === "POST") {
    readJson(req)
      .then(async (body) => {
        const mode = body.mode === "create" ? "create" : "signin";
        const email = normalize(body.email);
        const password = String(body.password || "");
        const name = normalizeLimitedString(body.name, 80);
        const termsAccepted = body.termsAccepted === true;
        const privacyAccepted = body.privacyAccepted === true;

        if (!isValidEmail(email)) {
          sendJson(res, 400, { error: "Use a valid email address." });
          return;
        }
        const passwordError = validateStrongPassword(password);
        if (passwordError && mode === "create") {
          sendJson(res, 400, { error: passwordError });
          return;
        }

        const existing = await findUserByEmail(email);
        if (mode === "create") {
          if (!termsAccepted || !privacyAccepted) {
            sendJson(res, 400, { error: "Agree to the Terms of Service and Privacy Policy before creating an account." });
            return;
          }
          if (existing) {
            sendJson(res, 409, { error: "An account already exists. Try signing in." });
            return;
          }

          const acceptedAt = new Date().toISOString();
          const user = {
            id: nextUserId(),
            email,
            name: name || email.split("@")[0],
            firstName: String(name || "").trim().split(/\s+/)[0] || "",
            lastName: String(name || "").trim().split(/\s+/).slice(1).join(" "),
            username: "",
            birthday: "",
            onboardingCompleted: false,
            featureTourCompletedAt: "",
            favoriteBrands: [],
            preferredVehicleTypes: [],
            password: hashPassword(password),
            provider: "email",
            emailVerified: false,
            phoneVerified: false,
            identityVerified: false,
            selfieVerified: false,
            personaInquiryId: "",
            personaReferenceId: "",
            identityVerificationStatus: "unverified",
            identityVerifiedAt: "",
            termsVersion: TERMS_VERSION,
            acceptedTermsAt: acceptedAt,
            termsAcceptedIp: req.socket.remoteAddress || "",
            privacyVersion: PRIVACY_VERSION,
            acceptedPrivacyAt: acceptedAt,
            privacyAcceptedIp: req.socket.remoteAddress || "",
            createdAt: new Date().toISOString(),
            lastLoginAt: null
          };
          const mail = await sendVerificationEmail({ email, code: makeCode(), req });
          await saveRuntimeUser(user);
          await trackEvent(req, "signup", user, { provider: "email" });
          sendJson(res, 201, {
            requiresVerification: true,
            email,
            devCode: mail.devCode,
            message: mail.sent
              ? "Check your email for the Kerodex verification code."
              : "Email sending is not configured yet. Use the local development code to verify this account."
          });
          return;
        }

        if (!existing || !verifyPassword(existing.password, password)) {
          recordFailedLogin(req, email);
          sendJson(res, 401, { error: "Email or password is incorrect." });
          return;
        }
        clearFailedLogin(req, email);
        if (existing.password && !String(existing.password).startsWith("pbkdf2_sha256$")) {
          existing.password = hashPassword(password);
          await saveRuntimeUser(existing);
        }

        if (!existing.emailVerified) {
          const mail = await sendVerificationEmail({ email, code: makeCode(), req });
          sendJson(res, 200, {
            requiresVerification: true,
            email,
            devCode: mail.devCode,
            error: mail.sent
              ? "Verify your email before signing in. We sent you a new code."
              : "Verify your email before signing in. Email sending is not configured, so use the local development code."
          });
          return;
        }

        const session = createSession(existing);
        await trackEvent(req, "login", existing, { provider: existing.provider || "email" });
        sendJson(res, 200, session);
      })
      .catch((error) => sendJson(res, 400, { error: error.message || "Invalid request body." }));
    return;
  }

  if (url.pathname === "/api/auth/email/verify" && req.method === "POST") {
    readJson(req)
      .then(async (body) => {
        const email = normalize(body.email);
        const code = String(body.code || "").trim();
        const record = emailVerifications.get(email);
        const user = await findUserByEmail(email);
        if (!user || !record || record.code !== code || record.expiresAt < Date.now()) {
          sendJson(res, 400, { error: "Verification code is invalid or expired." });
          return;
        }
        emailVerifications.delete(email);
        user.emailVerified = true;
        await saveRuntimeUser(user);
        const session = createSession(user);
        await trackEvent(req, "login", user, { provider: "email", emailVerified: true });
        sendJson(res, 200, session);
      })
      .catch((error) => sendJson(res, 400, { error: error.message || "Invalid request body." }));
    return;
  }

  if (url.pathname === "/api/auth/password/forgot" && req.method === "POST") {
    readJson(req)
      .then(async (body) => {
        const email = normalize(body.email);
        if (!email || !email.includes("@")) {
          sendJson(res, 400, { error: "Use a valid email address." });
          return;
        }

        const existing = await findUserByEmail(email);
        if (!existing || existing.provider !== "email") {
          sendJson(res, 200, {
            requiresResetCode: true,
            email,
            message: "If an email account exists, we sent a password reset code."
          });
          return;
        }

        const mail = await sendPasswordResetEmail({ email, code: makeCode(), req });
        sendJson(res, 200, {
          requiresResetCode: true,
          email,
          devCode: mail.devCode,
          message: mail.sent
            ? "Check your email for the Kerodex password reset code."
            : "Email sending is not configured yet. Use the local development code to reset your password."
        });
      })
      .catch((error) => sendJson(res, 400, { error: error.message || "Invalid request body." }));
    return;
  }

  if (url.pathname === "/api/auth/password/reset" && req.method === "POST") {
    readJson(req)
      .then(async (body) => {
        const email = normalize(body.email);
        const code = String(body.code || "").trim();
        const password = String(body.password || "");
        const record = passwordResets.get(email);
        const user = await findUserByEmail(email);
        if (!user || !record || record.code !== code || record.expiresAt < Date.now()) {
          sendJson(res, 400, { error: "Reset code is invalid or expired." });
          return;
        }
        const passwordError = validateStrongPassword(password);
        if (passwordError) {
          sendJson(res, 400, { error: passwordError });
          return;
        }
        user.password = hashPassword(password);
        user.emailVerified = true;
        await saveRuntimeUser(user);
        passwordResets.delete(email);
        sendJson(res, 200, createSession(user));
      })
      .catch((error) => sendJson(res, 400, { error: error.message || "Invalid request body." }));
    return;
  }

  if (url.pathname === "/api/listings" && req.method === "GET") {
    const user = getAuthUser(req);
    if ([...url.searchParams.keys()].length) {
      trackEvent(req, "search_performed", user, {
        route: url.pathname,
        query: url.searchParams.get("q") || "",
        filters: Object.fromEntries(url.searchParams)
      }).catch(() => {});
    }
    filterListings(url.searchParams)
      .then((listings) => sendJson(res, 200, { listings: listingsWithReadableImages(listings) }))
      .catch((error) => sendJson(res, 500, { error: "Unable to load listings.", detail: error.message }));
    return;
  }

  if (url.pathname === "/api/me/listings" && req.method === "GET") {
    const user = getAuthUser(req);
    if (!user) {
      sendJson(res, 401, { error: "Sign in to view your listings." });
      return;
    }
    store.getListings()
      .then((listings) => sendJson(res, 200, {
        listings: listingsWithReadableImages(listings.filter((listing) => listing.userId === user.id))
      }))
      .catch((error) => sendJson(res, 500, { error: "Unable to load your listings.", detail: error.message }));
    return;
  }

  if (url.pathname === "/api/users/check-username" && req.method === "GET") {
    const username = normalizeUsername(url.searchParams.get("username"));
    const user = getAuthUser(req);
    if (!username || username.length < 3) {
      sendJson(res, 400, { available: false, error: "Username must be at least 3 characters." });
      return;
    }
    isUsernameAvailable(username, user?.id || "")
      .then((available) => sendJson(res, 200, { username, available }))
      .catch((error) => sendJson(res, 500, { available: false, error: error.message || "Unable to check username." }));
    return;
  }

  if (url.pathname === "/api/me" && req.method === "GET") {
    const user = getAuthUser(req);
    if (!user) {
      sendJson(res, 401, { error: "Sign in to view your account." });
      return;
    }
    sendJson(res, 200, { user: publicUser(user) });
    return;
  }

  if (url.pathname === "/api/me" && req.method === "PATCH") {
    const user = getAuthUser(req);
    if (!user) {
      sendJson(res, 401, { error: "Sign in to update your account." });
      return;
    }
    readJson(req)
      .then(async (body) => {
        const next = { ...user };
        const firstName = String(body.firstName ?? "").trim();
        const lastName = String(body.lastName ?? "").trim();
        const name = String(body.name ?? "").trim();
        const username = body.username !== undefined ? normalizeUsername(body.username) : normalizeUsername(next.username);
        const phone = body.phone !== undefined ? normalizePhone(body.phone) || String(body.phone || "").trim() : next.phone || "";
        const birthday = String(body.birthday ?? next.birthday ?? "").trim();

        if (body.username !== undefined) {
          if (username.length < 3) {
            sendJson(res, 400, { error: "Username must be at least 3 characters." });
            return;
          }
          if (!(await isUsernameAvailable(username, user.id))) {
            sendJson(res, 409, { error: "That username is already taken." });
            return;
          }
          next.username = username;
        }
        if (body.firstName !== undefined) next.firstName = firstName;
        if (body.lastName !== undefined) next.lastName = lastName;
        if (body.name !== undefined || body.firstName !== undefined || body.lastName !== undefined) {
          next.name = name || [firstName || next.firstName, lastName || next.lastName].filter(Boolean).join(" ") || next.name;
        }
        if (body.phone !== undefined) next.phone = phone;
        if (body.birthday !== undefined) next.birthday = birthday;
        if (Array.isArray(body.favoriteBrands)) next.favoriteBrands = body.favoriteBrands.map(String).slice(0, 12);
        if (Array.isArray(body.preferredVehicleTypes)) next.preferredVehicleTypes = body.preferredVehicleTypes.map(String).slice(0, 12);
        if (body.onboardingCompleted === true) {
          if (!next.firstName || !next.username || !next.birthday) {
            sendJson(res, 400, { error: "Complete your name, username, and birthday before finishing onboarding." });
            return;
          }
          next.onboardingCompleted = true;
          next.onboardingCompletedAt = new Date().toISOString();
        }
        await saveRuntimeUser(next);
        await trackEvent(req, "profile_updated", next, {
          fields: Object.keys(body).filter((key) => !["password", "code"].includes(key)).slice(0, 20)
        });
        sendJson(res, 200, { message: "Account updated.", user: publicUser(next) });
      })
      .catch((error) => sendJson(res, 400, { error: error.message || "Unable to update account." }));
    return;
  }

  if (url.pathname === "/api/me/listing-analytics" && req.method === "GET") {
    const user = getAuthUser(req);
    if (!user) {
      sendJson(res, 401, { error: "Sign in to view listing analytics." });
      return;
    }
    Promise.all([
      store.getListings(),
      store.getConversations(),
      store.getAnalyticsEvents({ limit: 20000 }),
      store.getReports()
    ]).then(([listings, conversations, events, reports]) => {
      const owned = listings.filter((listing) => listing.userId === user.id);
      const analytics = owned.map((listing) => {
        const listingEvents = events.filter((event) => event.listingId === listing.id);
        const listingConversations = conversations.filter((conversation) => conversation.listingId === listing.id);
        const messagesReceived = listingConversations.reduce((total, conversation) =>
          total + (conversation.messages || []).filter((message) => message.receiverId === user.id).length, 0);
        const uniqueViewers = new Set(listingEvents
          .filter((event) => ["listing_view", "listing_viewed"].includes(event.eventType))
          .map((event) => event.userId || event.sessionId || event.ipHash)
          .filter(Boolean)).size;
        const createdAt = listing.createdAt || listing.updatedAt;
        const daysActive = createdAt ? Math.max(0, Math.ceil((Date.now() - Date.parse(createdAt)) / 86400000)) : 0;
        return {
          listing: listingWithReadableImages(listing),
          metrics: {
            views: listingEvents.filter((event) => ["listing_view", "listing_viewed"].includes(event.eventType)).length,
            uniqueViewers,
            saves: Number(listing.favorites || listing.saves || 0),
            contactClicks: listingEvents.filter((event) => event.eventType === "seller_contact_clicked").length,
            conversations: listingConversations.length,
            messagesReceived,
            daysActive,
            verificationStatus: listing.verificationStatus || "not_started",
            reportCount: reports.filter((report) => report.listingId === listing.id).length,
            soldStatus: listing.status === "sold",
            soldSource: listing.saleOutcome?.soldSource || "",
            finalSalePrice: listing.saleOutcome?.finalSalePrice || null,
            lastActivityAt: [listing.updatedAt, ...listingEvents.map((event) => event.createdAt), ...listingConversations.map((conversation) => conversation.updatedAt)]
              .filter(Boolean).sort((a, b) => Date.parse(b) - Date.parse(a))[0] || ""
          }
        };
      });
      sendJson(res, 200, { analytics });
    }).catch((error) => sendJson(res, 500, { error: "Unable to load listing analytics.", detail: error.message }));
    return;
  }

  if (url.pathname === "/api/me/followups" && req.method === "GET") {
    const user = getAuthUser(req);
    if (!user) {
      sendJson(res, 401, { error: "Sign in to view follow-ups." });
      return;
    }
    Promise.all([store.getConversations(), store.getFollowupsByUser(user.id)])
      .then(([conversations, answered]) => {
        const answeredKeys = new Set(answered.map((record) => `${record.listingId}:${record.conversationId}`));
        const prompts = conversations
          .filter((conversation) => conversation.buyerId === user.id && (conversation.messages || []).length >= 2)
          .filter((conversation) => !answeredKeys.has(`${conversation.listingId}:${conversation.id}`))
          .map((conversation) => ({
            listingId: conversation.listingId,
            conversationId: conversation.id,
            vehicleTitle: conversation.vehicleTitle || "this vehicle",
            createdAt: conversation.createdAt || conversation.updatedAt
          }));
        sendJson(res, 200, { prompts, responses: answered });
      })
      .catch((error) => sendJson(res, 500, { error: "Unable to load follow-ups.", detail: error.message }));
    return;
  }

  if (url.pathname === "/api/me/followups" && req.method === "POST") {
    const user = getAuthUser(req);
    if (!user) {
      sendJson(res, 401, { error: "Sign in to answer follow-ups." });
      return;
    }
    readJson(req).then(async (body) => {
      const allowedAnswers = new Set(["bought_through_kerodex", "still_looking", "bought_elsewhere", "seller_no_response", "already_sold", "other", "dismissed"]);
      const answer = String(body.answer || "");
      if (!allowedAnswers.has(answer)) throw makePublicError("Choose a valid follow-up answer.", 400);
      const conversation = await store.getConversationById(String(body.conversationId || ""));
      if (!conversation || conversation.buyerId !== user.id || conversation.listingId !== String(body.listingId || "")) {
        throw makePublicError("Follow-up conversation not found.", 404);
      }
      const record = await store.saveFollowup({
        id: `followup_${Date.now().toString(36)}_${crypto.randomBytes(4).toString("hex")}`,
        userId: user.id,
        listingId: conversation.listingId,
        conversationId: conversation.id,
        followupType: "buyer_purchase",
        answer: answer === "dismissed" ? "" : answer,
        feedbackText: normalizeLimitedString(body.feedbackText || "", 1000),
        dismissed: answer === "dismissed",
        createdAt: new Date().toISOString()
      });
      await trackEvent(req, "buyer_purchase_followup_answered", user, {
        listingId: conversation.listingId,
        conversationId: conversation.id,
        answer,
        relatedEntityType: "conversation",
        relatedEntityId: conversation.id
      });
      sendJson(res, 201, { followup: record });
    }).catch((error) => sendJson(res, error.status || 400, { error: publicError(error, "Unable to save follow-up.") }));
    return;
  }

  if (url.pathname === "/api/feedback" && req.method === "POST") {
    const user = getAuthUser(req);
    readJson(req).then(async (body) => {
      const context = normalizeLimitedString(body.context, 80);
      if (!context) throw makePublicError("Feedback context is required.", 400);
      const rating = body.rating === undefined || body.rating === null ? null : Number(body.rating);
      if (rating !== null && (!Number.isInteger(rating) || rating < 1 || rating > 5)) {
        throw makePublicError("Feedback rating must be from 1 to 5.", 400);
      }
      const record = await store.saveFeedback({
        id: `feedback_${Date.now().toString(36)}_${crypto.randomBytes(4).toString("hex")}`,
        userId: user?.id || "",
        listingId: normalizeLimitedString(body.listingId || "", 120),
        context,
        rating,
        responseText: normalizeLimitedString(body.responseText || "", 1500),
        metadata: {},
        createdAt: new Date().toISOString()
      });
      sendJson(res, 201, { feedback: record });
    }).catch((error) => sendJson(res, error.status || 400, { error: publicError(error, "Unable to save feedback.") }));
    return;
  }

  if (url.pathname === "/api/me/saved" && req.method === "GET") {
    const user = getAuthUser(req);
    if (!user) {
      sendJson(res, 401, { error: "Sign in to view saved vehicles." });
      return;
    }
    store.getSavedListings(user.id)
      .then((listings) => sendJson(res, 200, {
        listingIds: listings.map((listing) => listing.id),
        listings: listingsWithReadableImages(listings),
        count: listings.length
      }))
      .catch((error) => sendJson(res, 500, { error: "Unable to load saved vehicles.", detail: error.message }));
    return;
  }

  if (url.pathname === "/api/me/saved/sync" && req.method === "POST") {
    const user = getAuthUser(req);
    if (!user) {
      sendJson(res, 401, { error: "Sign in to sync saved vehicles." });
      return;
    }
    readJson(req)
      .then(async (body) => {
        const listingIds = Array.isArray(body.listingIds) ? body.listingIds.map(String).slice(0, 500) : [];
        const listings = await store.syncSavedListings(user.id, listingIds);
        sendJson(res, 200, {
          listingIds: listings.map((listing) => listing.id),
          listings: listingsWithReadableImages(listings),
          count: listings.length
        });
      })
      .catch((error) => sendJson(res, 400, { error: "Unable to sync saved vehicles.", detail: error.message }));
    return;
  }

  if (url.pathname === "/api/admin/auth/logout" && req.method === "POST") {
    const auth = req.headers.authorization || "";
    const token = auth.startsWith("Bearer ") ? auth.slice(7) : "";
    const admin = requireAdmin(req, res, "dashboard:read");
    if (!admin) return;
    adminSessions.delete(token);
    store.recordAdminAction({
      adminAccount: admin.email,
      actionType: "admin.logout",
      targetType: "admin_account",
      targetId: admin.id,
      previousValue: "session_active",
      newValue: "session_invalidated"
    }).catch(() => {});
    sendJson(res, 200, { ok: true });
    return;
  }

  if (url.pathname === "/api/me" && req.method === "DELETE") {
    const user = getAuthUser(req);
    if (!user) {
      sendJson(res, 401, { error: "Sign in to delete your account." });
      return;
    }
    deleteRuntimeUserAccount(user)
      .then(async () => {
        await auditMarketplaceAction(req, "account.deleted_immediately", "user", user.id, user, {
          previousValue: "active",
          newValue: "deleted",
          notes: "Immediate self-service deletion for testing."
        }).catch(() => {});
        sendJson(res, 200, { message: "Account deleted." });
      })
      .catch((error) => sendJson(res, 500, { error: publicError(error, "Unable to delete account.") }));
    return;
  }

  if (url.pathname === "/api/me/feature-tour" && req.method === "PATCH") {
    const user = getAuthUser(req);
    if (!user) {
      sendJson(res, 401, { error: "Sign in to update your Kerodex guide status." });
      return;
    }
    readJson(req)
      .then(async (body) => {
        if (body.completed !== true) {
          sendJson(res, 400, { error: "Feature tour completion must be true." });
          return;
        }
        const next = {
          ...user,
          featureTourCompletedAt: user.featureTourCompletedAt || new Date().toISOString()
        };
        await saveRuntimeUser(next);
        sendJson(res, 200, { message: "Kerodex guide status updated.", user: publicUser(next) });
      })
      .catch((error) => sendJson(res, 400, { error: error.message || "Unable to update Kerodex guide status." }));
    return;
  }

  if (url.pathname === "/api/me/password" && req.method === "PATCH") {
    const user = getAuthUser(req);
    if (!user) {
      sendJson(res, 401, { error: "Sign in to change your password." });
      return;
    }
    readJson(req)
      .then(async (body) => {
        const currentPassword = String(body.currentPassword || "");
        const newPassword = String(body.newPassword || "");
        const storedUser = await store.getUserByEmail(user.email);
        if (!storedUser || !storedUser.password) {
          sendJson(res, 400, { error: "This account uses Google or Microsoft sign-in. Password changes are not available for this sign-in method." });
          return;
        }
        if (!verifyPassword(storedUser.password, currentPassword)) {
          sendJson(res, 401, { error: "Current password is incorrect." });
          return;
        }
        const passwordError = validateStrongPassword(newPassword);
        if (passwordError) {
          sendJson(res, 400, { error: passwordError });
          return;
        }
        storedUser.password = hashPassword(newPassword);
        storedUser.updatedAt = new Date().toISOString();
        const savedUser = await saveRuntimeUser(storedUser);
        sendJson(res, 200, { message: "Password updated.", user: publicUser(savedUser) });
      })
      .catch((error) => sendJson(res, 400, { error: "Unable to change password.", detail: error.message }));
    return;
  }

  if (url.pathname === "/api/me/avatar" && req.method === "PATCH") {
    const user = getAuthUser(req);
    if (!user) {
      sendJson(res, 401, { error: "Sign in to update your profile picture." });
      return;
    }
    readJson(req)
      .then(async (body) => {
        const avatarUrl = String(body.avatarUrl || "").trim();
        const avatarS3Key = String(body.avatarS3Key || "").trim();
        const isUploadedProfilePhoto = Boolean(avatarS3Key && avatarS3Key.startsWith("profile-pictures/"));
        const isDefaultProfileIcon = /^\/pfpicon[0-9]\.png$/.test(avatarUrl);
        if (!avatarUrl || (!isUploadedProfilePhoto && !isDefaultProfileIcon)) {
          sendJson(res, 400, { error: "Upload a valid profile picture before saving it." });
          return;
        }
        user.avatarUrl = avatarUrl;
        user.avatarS3Key = isUploadedProfilePhoto ? avatarS3Key : "";
        await saveRuntimeUser(user);
        await trackEvent(req, "profile_updated", user, { fields: ["avatar"] });
        sendJson(res, 200, { message: "Profile picture updated.", user: publicUser(user) });
      })
      .catch((error) => sendJson(res, 400, { error: error.message || "Unable to update profile picture." }));
    return;
  }

  if (url.pathname === "/api/me/persona/start" && req.method === "POST") {
    const user = getAuthUser(req);
    if (!user) {
      sendJson(res, 401, { error: "Sign in to verify identity." });
      return;
    }
    sendJson(res, 503, {
      error: "Identity verification is coming soon and is unavailable during the current beta.",
      code: "identity_verification_beta_disabled"
    });
    return;
  }

  if (url.pathname === "/api/me/persona/return" && req.method === "POST") {
    const user = getAuthUser(req);
    if (!user) {
      sendJson(res, 401, { error: "Sign in to finish identity verification." });
      return;
    }
    sendJson(res, 503, {
      error: "Identity verification is coming soon and is unavailable during the current beta.",
      code: "identity_verification_beta_disabled"
    });
    return;
  }

  // TODO(Persona): add POST /api/persona/webhook with signature verification.
  // The webhook should look up users by reference-id, then set identityVerificationStatus
  // and identityVerifiedAt from Persona's final inquiry decision.

  if (url.pathname === "/api/me/verifications" && req.method === "POST") {
    const user = getAuthUser(req);
    if (!user) {
      sendJson(res, 401, { error: "Sign in to submit verification." });
      return;
    }
    readJson(req)
      .then(async (body) => {
        const type = String(body.type || "").trim();
        if (!["identity", "selfie", "ownership", "phone"].includes(type)) {
          sendJson(res, 400, { error: "Choose a valid verification type." });
          return;
        }
        const verification = await store.createVerificationRequest(user, type);
        await trackEvent(req, "verification_started", user, { verificationId: verification.id, type });
        sendJson(res, 201, { verification });
      })
      .catch((error) => sendJson(res, 400, { error: "Unable to submit verification.", detail: error.message }));
    return;
  }

  if (url.pathname === "/api/auth/phone/status" && req.method === "GET") {
    const user = getAuthUser(req);
    if (!user) {
      sendJson(res, 401, { error: "Sign in to check phone verification status." });
      return;
    }
    sendJson(res, 200, {
      ok: true,
      provider: "twilio_verify",
      configured: hasTwilioVerifyConfig(),
      accountSidLoaded: Boolean(process.env.TWILIO_ACCOUNT_SID),
      authTokenLoaded: Boolean(process.env.TWILIO_AUTH_TOKEN),
      serviceSidLoaded: Boolean(process.env.TWILIO_VERIFY_SERVICE_SID),
      serviceSidPrefix: process.env.TWILIO_VERIFY_SERVICE_SID ? String(process.env.TWILIO_VERIFY_SERVICE_SID).slice(0, 2) : "",
      phoneVerified: Boolean(user.phoneVerified),
      phoneLast4: String(user.phoneNumber || user.phone || "").slice(-4)
    });
    return;
  }

  if ((url.pathname === "/api/auth/phone/start" || url.pathname === "/api/me/phone/start") && req.method === "POST") {
    const user = getAuthUser(req);
    if (!user) {
      sendJson(res, 401, { error: "Sign in to verify your phone." });
      return;
    }
    readJson(req)
      .then(async (body) => {
        const phone = normalizePhone(body.phone);
        if (!phone) {
          sendJson(res, 400, { error: "Enter a valid US phone number." });
          return;
        }
        if (!applyPhoneAttemptLimit({ userId: user.id, ip: requestIp(req), phone, action: "start" })) {
          sendJson(res, 429, { success: false, error: "Too many requests. Please try again later." });
          return;
        }
        if (!applyPhoneResendCooldown({ userId: user.id, phone })) {
          sendJson(res, 429, { success: false, error: "Please wait before requesting another code." });
          return;
        }

        const verification = await startPhoneVerificationWithProvider(phone);
        await recordCost("twilio", "phone_verification_sms", { userId: user.id, requestId: verification.sid, status: "success" });
        console.info("[Kerodex phone verification] Twilio Verify start accepted", {
          userId: user.id,
          phoneLast4: phone.slice(-4),
          verificationSid: verification.sid,
          status: verification.status,
          channel: verification.channel
        });
        await trackEvent(req, "phone_verification_started", user, {
          status: verification.status || "sent",
          phoneConflict: await phoneBelongsToAnotherUser(phone, user.id)
        });
        sendJson(res, 200, {
          ok: true,
          message: "Verification code sent.",
          phoneLast4: phone.slice(-4)
        });
      })
      .catch((error) => {
        recordCost("twilio", "phone_verification_sms", { userId: user.id, status: "failure", metadata: { error: error.message } }).catch(() => {});
        console.warn(`[Kerodex phone verification start failed] ${error.message}`);
        sendJson(res, error.status || 500, { success: false, error: publicError(error, "Unable to send verification code.") });
      });
    return;
  }

  if ((url.pathname === "/api/auth/phone/check" || url.pathname === "/api/me/phone/verify") && req.method === "POST") {
    const user = getAuthUser(req);
    if (!user) {
      sendJson(res, 401, { error: "Sign in to verify your phone." });
      return;
    }
    readJson(req)
      .then(async (body) => {
        const phone = normalizePhone(body.phone || user.phoneNumber || user.phone);
        const code = String(body.code || "").trim();
        if (!phone || !/^\d{4,10}$/.test(code)) {
          sendJson(res, 400, { error: "Invalid verification code." });
          return;
        }
        if (!applyPhoneAttemptLimit({ userId: user.id, ip: requestIp(req), phone, action: "check" })) {
          sendJson(res, 429, { success: false, error: "Too many requests. Please try again later." });
          return;
        }

        const result = await checkPhoneVerificationWithProvider(phone, code);
        console.info("[Kerodex phone verification] Twilio Verify check completed", {
          userId: user.id,
          phoneLast4: phone.slice(-4),
          verificationSid: result.sid,
          status: result.status,
          valid: result.valid === true
        });
        if (result.status !== "approved" || result.valid !== true) {
          await trackEvent(req, "phone_verification_failed", user, { type: "phone" });
          sendJson(res, 400, { error: "Invalid verification code." });
          return;
        }

        const now = new Date().toISOString();
        const previousOwner = await transferVerifiedPhoneOwnership(phone, user);
        user.phoneNumber = phone;
        user.phone = phone;
        user.phoneVerified = true;
        user.phoneVerifiedAt = now;
        await saveRuntimeUser(user);
        await trackEvent(req, "phone_verification_passed", user, {
          type: "phone",
          transferredFromAnotherAccount: Boolean(previousOwner)
        });
        sendJson(res, 200, { ok: true, message: "Phone verified.", user: publicUser(user) });
      })
      .catch((error) => {
        console.warn(`[Kerodex phone verification check failed] ${error.message}`);
        sendJson(res, error.status || 500, { success: false, error: publicError(error, "Unable to verify phone.") });
      });
    return;
  }

  if (url.pathname === "/api/me/safety-notice" && req.method === "POST") {
    const user = getAuthUser(req);
    if (!user) {
      sendJson(res, 401, { error: "Sign in to update safety settings." });
      return;
    }
    user.safetyNoticeSeenAt = new Date().toISOString();
    saveRuntimeUser(user)
      .then(() => sendJson(res, 200, { message: "Safety notice acknowledged.", user: publicUser(user) }))
      .catch((error) => sendJson(res, 500, { error: "Unable to save safety notice.", detail: error.message }));
    return;
  }

  if (url.pathname === "/api/reports" && req.method === "POST") {
    const user = getAuthUser(req);
    if (!user) {
      sendJson(res, 401, { error: "Sign in to report a concern." });
      return;
    }
    readJson(req)
      .then(async (body) => {
        const description = normalizeLimitedString(body.description, 1500);
        const category = String(body.category || "other");
        if (!REPORT_CATEGORIES.has(category)) {
          sendJson(res, 400, { error: "Choose a valid report category." });
          return;
        }
        if (description.length < 10) {
          sendJson(res, 400, { error: "Add at least 10 characters so Kerodex can review the report." });
          return;
        }
        const report = createReportRecord({
          reporter: user,
          reportedUserId: String(body.reportedUserId || ""),
          listingId: String(body.listingId || ""),
          messageId: String(body.messageId || ""),
          conversationId: String(body.conversationId || ""),
          category,
          description,
          source: "user_report"
        });
        await saveReport(report);
        await trackEvent(req, report.listingId ? "report_listing" : "report_user", user, {
          listingId: report.listingId,
          reportedUserId: report.reportedUserId,
          category: report.category
        });
        await auditMarketplaceAction(req, "report.submitted", report.listingId ? "listing" : "user", report.listingId || report.reportedUserId || report.id, user, {
          newValue: report.status,
          notes: `Report category: ${report.category}`,
          metadata: { reportId: report.id, conversationId: report.conversationId, messageId: report.messageId }
        });
        sendJson(res, 201, { report, message: "Report submitted for Kerodex review." });
      })
      .catch((error) => sendJson(res, 400, { error: "Unable to submit report.", detail: error.message }));
    return;
  }

  if (url.pathname === "/api/buyer-guide/start" && req.method === "POST") {
    const user = getAuthUser(req);
    readJson(req)
      .then(async () => {
        let session = null;
        if (user && typeof store.getActiveDiscoveryBuyerGuide === "function") {
          session = await store.getActiveDiscoveryBuyerGuide(user.id);
        }
        if (!session) {
          session = createDiscoveryBuyerGuideRecord(user);
          session = await saveBuyerGuideSession(session);
        }
        await trackEvent(req, session.created_at === session.updated_at ? "buyer_guide_discovery_started" : "buyer_guide_discovery_resumed", user, {
          guideId: session.id,
          guest: !user
        });
        sendJson(res, 200, { session, guest: !user });
      })
      .catch((error) => sendJson(res, error.status || 400, { error: "Unable to start Buyer Guide.", detail: error.message }));
    return;
  }

  if (url.pathname === "/api/buyer-guide/respond" && req.method === "POST") {
    const user = getAuthUser(req);
    readJson(req)
      .then(async (body) => {
        const id = normalizeLimitedString(body.sessionId, 120);
        const session = await getBuyerGuideSession(id, user);
        if (!session) {
          sendJson(res, 404, { error: "Buyer Guide session not found." });
          return;
        }
        const answerKey = normalizeLimitedString(body.answerKey, 80);
        const incomingAnswers = body.answers && typeof body.answers === "object" ? body.answers : {};
        const buyerAnswers = {
          ...(session.buyer_answers || session.buyerAnswers || {}),
          ...incomingAnswers
        };
        if (answerKey) buyerAnswers[answerKey] = body.value;
        const saved = await saveBuyerGuideSession({
          ...session,
          buyer_answers: buyerAnswers,
          buyerAnswers,
          current_stage: normalizeLimitedString(body.currentStage || session.current_stage || "understand_buyer", 80),
          currentStage: normalizeLimitedString(body.currentStage || session.currentStage || "understand_buyer", 80),
          current_step: normalizeLimitedString(body.currentStep || session.current_step || "", 80),
          currentStep: normalizeLimitedString(body.currentStep || session.currentStep || "", 80)
        });
        await trackEvent(req, "buyer_guide_answered", user, {
          guideId: saved.id,
          answerKey,
          guest: !user
        });
        sendJson(res, 200, { session: saved });
      })
      .catch((error) => sendJson(res, error.status || 400, { error: "Unable to save Buyer Guide response.", detail: error.message }));
    return;
  }

  if (url.pathname === "/api/buyer-guide/recommendations" && req.method === "POST") {
    const user = getAuthUser(req);
    readJson(req)
      .then(async (body) => {
        const id = normalizeLimitedString(body.sessionId, 120);
        const session = await getBuyerGuideSession(id, user);
        if (!session) {
          sendJson(res, 404, { error: "Buyer Guide session not found." });
          return;
        }
        const answers = body.answers && typeof body.answers === "object"
          ? body.answers
          : (session.buyer_answers || session.buyerAnswers || {});
        const recommendations = await buyerGuideEngine.generateRecommendations(answers);
        const listings = await store.getListings();
        const listingMatches = buyerGuideEngine.matchListings(listings, recommendations).map((match) => ({
          ...match,
          listing: listingWithReadableImages(match.listing)
        }));
        const saved = await saveBuyerGuideSession({
          ...session,
          buyer_answers: answers,
          buyerAnswers: answers,
          buyer_profile: {
            summary: recommendations.buyerProfileSummary,
            categories: recommendations.recommendedCategories
          },
          buyerProfile: {
            summary: recommendations.buyerProfileSummary,
            categories: recommendations.recommendedCategories
          },
          recommendations,
          listing_matches: listingMatches,
          listingMatches,
          current_stage: "listing_matches",
          currentStage: "listing_matches",
          current_step: "review_matches",
          currentStep: "review_matches"
        });
        await trackEvent(req, "buyer_guide_recommendations_generated", user, {
          guideId: saved.id,
          provider: recommendations.provider || "unknown",
          matchCount: listingMatches.length,
          guest: !user
        });
        sendJson(res, 200, {
          session: saved,
          recommendations,
          matches: listingMatches,
          fallbackUsed: recommendations.provider !== "openai"
        });
      })
      .catch((error) => sendJson(res, error.status || 400, { error: "Unable to generate Buyer Guide recommendations.", detail: error.message }));
    return;
  }

  const buyerGuideSessionMatch = url.pathname.match(/^\/api\/buyer-guide\/session\/([^/]+)$/);
  if (buyerGuideSessionMatch && req.method === "GET") {
    const user = getAuthUser(req);
    const id = decodeURIComponent(buyerGuideSessionMatch[1]);
    Promise.resolve(getBuyerGuideSession(id, user))
      .then((session) => {
        if (!session) {
          sendJson(res, 404, { error: "Buyer Guide session not found." });
          return;
        }
        sendJson(res, 200, { session });
      })
      .catch((error) => sendJson(res, 500, { error: "Unable to load Buyer Guide session.", detail: error.message }));
    return;
  }

  if (buyerGuideSessionMatch && req.method === "PATCH") {
    const user = getAuthUser(req);
    const id = decodeURIComponent(buyerGuideSessionMatch[1]);
    readJson(req)
      .then(async (body) => {
        const session = await getBuyerGuideSession(id, user);
        if (!session) {
          sendJson(res, 404, { error: "Buyer Guide session not found." });
          return;
        }
        const saved = await saveBuyerGuideSession({
          ...session,
          buyer_id: session.buyer_id || session.buyerId || user?.id || null,
          buyerId: session.buyerId || session.buyer_id || user?.id || null,
          status: ["active", "completed", "abandoned"].includes(String(body.status)) ? String(body.status) : session.status,
          current_stage: normalizeLimitedString(body.currentStage || body.current_stage || session.current_stage || "", 80),
          currentStage: normalizeLimitedString(body.currentStage || body.current_stage || session.currentStage || "", 80),
          current_step: normalizeLimitedString(body.currentStep || body.current_step || session.current_step || "", 80),
          currentStep: normalizeLimitedString(body.currentStep || body.current_step || session.currentStep || "", 80),
          buyer_answers: body.buyerAnswers || body.buyer_answers || session.buyer_answers || {},
          buyerAnswers: body.buyerAnswers || body.buyer_answers || session.buyerAnswers || {},
          completed_steps: Array.isArray(body.completedSteps || body.completed_steps) ? (body.completedSteps || body.completed_steps).map(String) : (session.completed_steps || []),
          completedSteps: Array.isArray(body.completedSteps || body.completed_steps) ? (body.completedSteps || body.completed_steps).map(String) : (session.completedSteps || [])
        });
        sendJson(res, 200, { session: saved });
      })
      .catch((error) => sendJson(res, error.status || 400, { error: "Unable to update Buyer Guide session.", detail: error.message }));
    return;
  }

  const buyerGuideListingMatch = url.pathname.match(/^\/api\/buyer-guide\/session\/([^/]+)\/listing\/([^/]+)$/);
  if (buyerGuideListingMatch && req.method === "POST") {
    const user = getAuthUser(req);
    const id = decodeURIComponent(buyerGuideListingMatch[1]);
    const listingId = decodeURIComponent(buyerGuideListingMatch[2]);
    Promise.resolve().then(async () => {
      const session = await getBuyerGuideSession(id, user);
      const listing = await store.getListingById(listingId);
      if (!session || !listing) {
        sendJson(res, 404, { error: "Buyer Guide session or listing not found." });
        return;
      }
      if (user && listing.userId === user.id) {
        sendJson(res, 400, { error: "Buyer Guide cannot be started for your own listing." });
        return;
      }
      if (user && typeof store.getActiveBuyerGuide === "function") {
        const existing = await store.getActiveBuyerGuide(user.id, listing.id);
        if (existing && existing.id !== session.id) {
          await saveBuyerGuideSession({ ...session, status: "abandoned" });
          sendJson(res, 200, { session: existing, guide: await decorateBuyerGuide(existing), resumed: true });
          return;
        }
      }
      const sellerId = listing.userId || listing.seller?.id || "";
      const saved = await saveBuyerGuideSession({
        ...session,
        listing_id: listing.id,
        listingId: listing.id,
        seller_id: sellerId,
        sellerId,
        selected_listing_id: listing.id,
        selectedListingId: listing.id,
        journey_type: "purchase",
        journeyType: "purchase",
        current_stage: "evaluate_listing",
        currentStage: "evaluate_listing",
        current_step: BUYER_GUIDE_STEP_IDS[0],
        currentStep: BUYER_GUIDE_STEP_IDS[0]
      });
      await trackEvent(req, "buyer_guide_listing_selected", user, {
        guideId: saved.id,
        listingId: listing.id,
        guest: !user
      });
      sendJson(res, 200, { session: saved, guide: await decorateBuyerGuide(saved) });
    }).catch((error) => sendJson(res, error.status || 400, { error: "Unable to select this listing.", detail: error.message }));
    return;
  }

  if (url.pathname === "/api/buyer-guides/start" && req.method === "POST") {
    const user = getAuthUser(req);
    if (!user) {
      sendJson(res, 401, { error: "Sign in to start a buyer guide." });
      return;
    }
    readJson(req)
      .then(async (body) => {
        const listingId = normalizeLimitedString(body.listingId, 120);
        if (!listingId) {
          sendJson(res, 400, { error: "Listing ID is required." });
          return;
        }
        const listing = await store.getListingById(listingId);
        if (!listing || !["active", "sold"].includes(String(listing.status || "active"))) {
          sendJson(res, 404, { error: "Listing not found." });
          return;
        }
        if (listing.userId === user.id) {
          sendJson(res, 400, { error: "You cannot start a buyer guide for your own listing." });
          return;
        }
        const existing = typeof store.getActiveBuyerGuide === "function"
          ? await store.getActiveBuyerGuide(user.id, listing.id)
          : null;
        const guide = existing || await store.saveBuyerGuide(createBuyerGuideRecord({ buyer: user, listing }));
        await trackEvent(req, existing ? "buyer_guide_resumed" : "buyer_guide_started", user, {
          listingId: listing.id,
          guideId: guide.id
        });
        sendJson(res, existing ? 200 : 201, { guide: await decorateBuyerGuide(guide) });
      })
      .catch((error) => sendJson(res, error.status || 400, { error: "Unable to start buyer guide.", detail: error.message }));
    return;
  }

  if (url.pathname === "/api/buyer-guides" && req.method === "GET") {
    const user = getAuthUser(req);
    if (!user) {
      sendJson(res, 401, { error: "Sign in to view buyer guides." });
      return;
    }
    Promise.resolve(typeof store.getBuyerGuidesByBuyer === "function" ? store.getBuyerGuidesByBuyer(user.id) : [])
      .then(async (guides) => {
        const decorated = await Promise.all(guides.map((guide) => decorateBuyerGuide(guide)));
        sendJson(res, 200, { guides: decorated.filter(Boolean) });
      })
      .catch((error) => sendJson(res, 500, { error: "Unable to load buyer guides.", detail: error.message }));
    return;
  }

  const buyerGuideMatch = url.pathname.match(/^\/api\/buyer-guides\/([^/]+)$/);
  if (buyerGuideMatch && req.method === "GET") {
    const user = getAuthUser(req);
    if (!user) {
      sendJson(res, 401, { error: "Sign in to view this buyer guide." });
      return;
    }
    const id = decodeURIComponent(buyerGuideMatch[1]);
    Promise.resolve(typeof store.getBuyerGuideById === "function" ? store.getBuyerGuideById(id) : null)
      .then(async (guide) => {
        if (!guide || (guide.buyer_id || guide.buyerId) !== user.id) {
          sendJson(res, 404, { error: "Buyer guide not found." });
          return;
        }
        sendJson(res, 200, { guide: await decorateBuyerGuide(guide) });
      })
      .catch((error) => sendJson(res, 500, { error: "Unable to load buyer guide.", detail: error.message }));
    return;
  }

  if (buyerGuideMatch && req.method === "PATCH") {
    const user = getAuthUser(req);
    if (!user) {
      sendJson(res, 401, { error: "Sign in to update this buyer guide." });
      return;
    }
    const id = decodeURIComponent(buyerGuideMatch[1]);
    readJson(req)
      .then(async (body) => {
        const guide = typeof store.getBuyerGuideById === "function" ? await store.getBuyerGuideById(id) : null;
        if (!guide || (guide.buyer_id || guide.buyerId) !== user.id) {
          sendJson(res, 404, { error: "Buyer guide not found." });
          return;
        }
        const currentStep = BUYER_GUIDE_STEP_IDS.includes(String(body.current_step || body.currentStep || ""))
          ? String(body.current_step || body.currentStep)
          : (guide.current_step || guide.currentStep || BUYER_GUIDE_STEP_IDS[0]);
        const completedSteps = Array.isArray(body.completed_steps || body.completedSteps)
          ? Array.from(new Set((body.completed_steps || body.completedSteps).map(String).filter((step) => BUYER_GUIDE_STEP_IDS.includes(step))))
          : (guide.completed_steps || guide.completedSteps || []);
        const status = ["active", "completed", "cancelled"].includes(String(body.status || ""))
          ? String(body.status)
          : guide.status || "active";
        const notes = body.notes && typeof body.notes === "object" ? body.notes : (guide.notes || {});
        const updatedAt = new Date().toISOString();
        const updated = {
          ...guide,
          status,
          current_step: currentStep,
          currentStep,
          completed_steps: completedSteps,
          completedSteps,
          buyer_state: normalizeLimitedString(body.buyer_state ?? body.buyerState ?? guide.buyer_state ?? guide.buyerState ?? "", 40),
          buyerState: normalizeLimitedString(body.buyerState ?? body.buyer_state ?? guide.buyerState ?? guide.buyer_state ?? "", 40),
          seller_state: normalizeLimitedString(body.seller_state ?? body.sellerState ?? guide.seller_state ?? guide.sellerState ?? "", 40),
          sellerState: normalizeLimitedString(body.sellerState ?? body.seller_state ?? guide.sellerState ?? guide.seller_state ?? "", 40),
          notes,
          updated_at: updatedAt,
          updatedAt
        };
        const saved = await store.saveBuyerGuide(updated);
        await trackEvent(req, "buyer_guide_updated", user, {
          listingId: saved.listing_id || saved.listingId,
          guideId: saved.id,
          status: saved.status,
          completedCount: completedSteps.length
        });
        sendJson(res, 200, { guide: await decorateBuyerGuide(saved) });
      })
      .catch((error) => sendJson(res, error.status || 400, { error: "Unable to update buyer guide.", detail: error.message }));
    return;
  }

  if (url.pathname === "/api/uploads/presign" && req.method === "POST") {
    const user = getAuthUser(req);
    if (!user) {
      sendJson(res, 401, { error: "Sign in to upload listing photos." });
      return;
    }
    readJson(req)
      .then(async (body) => {
        const fileName = String(body.fileName || "");
        const contentType = String(body.contentType || "");
        const fileSize = Number(body.fileSize || 0);
        const purpose = String(body.purpose || "listing-photo");
        const documentType = String(body.documentType || "");
        const upload = createS3PresignedPut({ fileName, contentType, fileSize, user, purpose, documentType });
        await recordCost("s3", "upload_prepared", {
          userId: user.id,
          status: "success",
          unitsUsed: fileSize > 0 ? fileSize / (1024 * 1024) : 1,
          metadata: { purpose, contentType }
        });
        sendJson(res, 201, upload);
      })
      .catch((error) => sendJson(res, error.status || 400, {
        error: error.message || "Unable to prepare upload."
      }));
    return;
  }

  if (url.pathname === "/api/vehicle-presence/code" && req.method === "POST") {
    const user = getAuthUser(req);
    if (!user) {
      sendJson(res, 401, { error: "Sign in to generate a vehicle verification code." });
      return;
    }
    const record = presenceCodePayload(user);
    sendJson(res, 201, {
      token: record.token,
      code: record.code,
      generatedAt: record.generatedAt,
      expiresAt: record.expiresAt,
      instructions: "Write the verification code on a piece of paper and hold or place it next to the windshield VIN visible through the windshield. Upload a clear photo showing both the windshield VIN and the verification code."
    });
    return;
  }

  if (url.pathname === "/api/listings" && req.method === "POST") {
    const user = getAuthUser(req);
    if (!user) {
      sendJson(res, 401, { error: "Sign in to publish a listing." });
      return;
    }
    if (user.listingCreationDisabled) {
      sendJson(res, 403, { error: "Listing creation is disabled for this account. Contact Kerodex support if this looks wrong." });
      return;
    }
    readJson(req)
      .then(async (body) => {
        const validation = validateSellerListingInput(body, { requirePresence: true });
        if (validation.errors.length) {
          sendJson(res, 400, { error: validation.errors[0], errors: validation.errors });
          return;
        }
        const cleanVin = validation.cleanVin;
        const duplicate = await findVerifiedListingByVin(cleanVin);
        if (duplicate) {
          sendJson(res, 409, {
            error: "This VIN is already attached to a verified Kerodex listing. Remove that listing before creating another one with this VIN.",
            code: "duplicate_vin"
          });
          return;
        }
        const presenceRecord = consumePresenceCode({
          token: body.vehiclePresenceToken,
          code: body.vehiclePresenceCode,
          user
        });
        if (!presenceRecord || !String(body.vehiclePresencePhotoUrl || "").trim()) {
          sendJson(res, 400, { error: "Upload a vehicle presence verification photo before submitting this listing." });
          return;
        }
        const listing = createSellerListing({
          ...body,
          vin: cleanVin,
          title: normalizeLimitedString(body.title, 120),
          description: normalizeLimitedString(body.description, 5000),
          make: normalizeLimitedString(body.make, 40),
          model: normalizeLimitedString(body.model, 60),
          trim: normalizeLimitedString(body.trim, 80),
          vehiclePresenceCode: presenceRecord.code,
          vehiclePresenceGeneratedAt: presenceRecord.generatedAt,
          vehiclePresenceExpiresAt: presenceRecord.expiresAt,
          listingAccuracyCertifiedIp: req.socket.remoteAddress || ""
        }, user);
        const enriched = listing.vin ? await enrichListingWithMarketCheck(listing) : listing;
        if (listingNeedsPriceReview(enriched)) {
          enriched.status = "pending_review";
          enriched.reviewFlags = Array.from(new Set([...(enriched.reviewFlags || []), "price_outlier"]));
        }
        const created = await store.createListing(enriched);
        await trackEvent(req, "create_listing", user, { listingId: created.id, route: "/sell" });
        await trackEvent(req, "vehicle_presence_verification_started", user, { listingId: created.id });
        await auditMarketplaceAction(req, "listing.created", "listing", created.id, user, {
          newValue: created.status,
          notes: created.reviewFlags?.length ? `Review flags: ${created.reviewFlags.join(", ")}` : "Seller submitted listing.",
          metadata: { vin: created.vin, price: created.price, mileage: created.mileage }
        });
        if (created.reviewFlags?.includes("price_outlier")) {
          const report = createReportRecord({
            reporter: null,
            listingId: created.id,
            reportedUserId: user.id,
            category: "misleading_price",
            description: "Listing price is far outside the saved market valuation and needs moderator review.",
            source: "system_review",
            metadata: { price: created.price, marketValue: created.marketValue, reviewFlags: created.reviewFlags }
          });
          await saveReport(report);
        }
        scheduleVehiclePresenceVerification(created.id);
        sendJson(res, 201, { listing: listingWithReadableImages(created) });
      })
      .catch((error) => sendJson(res, error.status || 400, {
        error: error.message || "Unable to create listing.",
        code: error.code,
        detail: error.detail || error.message
      }));
    return;
  }

  if (url.pathname.startsWith("/api/marketcheck/decode/") && req.method === "GET") {
    const vin = decodeURIComponent(url.pathname.split("/").pop() || "");
    getCachedMarketCheckDecode(vin)
      .then((decoded) => sendJson(res, 200, decoded))
      .catch((error) => {
        sendJson(res, error.status || 500, {
          error: error.message || "Unable to decode VIN with MarketCheck.",
          code: error.code,
          detail: error.detail || error.message
        });
      });
    return;
  }

  const sellerListingUpdateMatch = url.pathname.match(/^\/api\/listings\/([^/]+)$/);
  if (sellerListingUpdateMatch && (req.method === "PATCH" || req.method === "PUT")) {
    const user = getAuthUser(req);
    if (!user) {
      sendJson(res, 401, { error: "Sign in to update a listing." });
      return;
    }
    const id = decodeURIComponent(sellerListingUpdateMatch[1]);
    readJson(req)
      .then(async (body) => {
        const existing = await store.getListingById(id);
        if (!existing) {
          sendJson(res, 404, { error: "Listing not found." });
          return;
        }
        if (existing.userId !== user.id) {
          sendJson(res, 403, { error: "You can only update your own listings." });
          return;
        }
        if (body.price !== undefined) {
          const price = Number(body.price);
          if (!Number.isFinite(price) || price < 500 || price > 500000) {
            sendJson(res, 400, { error: "Enter a realistic asking price." });
            return;
          }
        }
        if (body.mileage !== undefined) {
          const mileage = Number(body.mileage);
          if (!Number.isFinite(mileage) || mileage < 0 || mileage > 1000000) {
            sendJson(res, 400, { error: "Enter a realistic mileage." });
            return;
          }
        }
        if (body.year !== undefined) {
          const year = Number(body.year);
          if (!Number.isFinite(year) || year < 1981 || year > new Date().getFullYear() + 1) {
            sendJson(res, 400, { error: "Enter a valid vehicle year." });
            return;
          }
        }
        const updated = {
          ...existing,
          ...body,
          id: existing.id,
          userId: existing.userId,
          seller: {
            ...(existing.seller || {}),
            id: user.id,
            name: existing.seller?.name || user.name || user.email.split("@")[0] || "Kerodex seller",
            avatarUrl: publicUser(user).avatarUrl || existing.seller?.avatarUrl || "",
            avatarS3Key: user.avatarS3Key || user.profileImageS3Key || existing.seller?.avatarS3Key || "",
            phoneVerified: Boolean(user.phoneVerified && isFreshPhoneVerification(user.phoneVerifiedAt)),
            verified: PERSONA_IDENTITY_VERIFICATION_ENABLED && Boolean(user.identityVerified)
          },
          vin: body.vin !== undefined ? marketCheck.normalizeVin(body.vin) : existing.vin,
          updatedAt: new Date().toISOString()
        };
        ["title", "description", "make", "model", "trim", "location"].forEach((field) => {
          if (updated[field] !== undefined) updated[field] = normalizeLimitedString(updated[field], field === "description" ? 5000 : 120);
        });
        const mergedValidation = validateSellerListingInput(updated, { requirePresence: false });
        if (mergedValidation.errors.length) {
          sendJson(res, 400, { error: mergedValidation.errors[0], errors: mergedValidation.errors });
          return;
        }
        if (updated.vin) {
          const duplicate = await findVerifiedListingByVin(normalizeVin(updated.vin), existing.id);
          if (duplicate) {
            sendJson(res, 409, {
              error: "This VIN is already attached to another verified Kerodex listing. Remove that listing before using this VIN.",
              code: "duplicate_vin"
            });
            return;
          }
        }
        updated.sellerChecklist = SELLER_CHECKLIST_KEYS.reduce((acc, key) => {
          acc[key] = Boolean(updated.sellerChecklist?.[key]);
          return acc;
        }, {});
        if (Array.isArray(updated.maintenanceRecords)) {
          updated.maintenanceRecords = updated.maintenanceRecords.map((record) => normalizeListingDocument(record, "maintenance"));
          updated.maintenanceNames = updated.maintenanceRecords.map((record) => record.name).filter(Boolean);
        }
        if (updated.titleDocument) {
          updated.titleDocument = normalizeListingDocument(updated.titleDocument, "title");
        }
        let shouldVerifyPresence = false;
        if (body.vehiclePresenceToken && body.vehiclePresenceCode && body.vehiclePresencePhotoUrl) {
          const presenceRecord = consumePresenceCode({
            token: body.vehiclePresenceToken,
            code: body.vehiclePresenceCode,
            user
          });
          if (!presenceRecord) {
            sendJson(res, 400, { error: "Generate a fresh vehicle presence code before submitting this verification photo." });
            return;
          }
          updated.status = "pending_verification";
          updated.verificationStatus = vehiclePresence.PRESENCE_STATUSES.PENDING;
          updated.vehiclePresenceVerified = false;
          updated.photoChallengeVerified = false;
          updated.livePhotoVerified = false;
          updated.challengeCodeVerified = false;
          updated.photoChallengeCode = presenceRecord.code;
          updated.challengeCode = presenceRecord.code;
          updated.photoChallengeProofImage = String(body.vehiclePresencePhotoUrl || "").trim();
          updated.vehiclePresence = {
            ...(updated.vehiclePresence || {}),
            verification_code: presenceRecord.code,
            verificationCode: presenceRecord.code,
            generated_at: presenceRecord.generatedAt,
            generatedAt: presenceRecord.generatedAt,
            expires_at: presenceRecord.expiresAt,
            expiresAt: presenceRecord.expiresAt,
            verification_photo_url: String(body.vehiclePresencePhotoUrl || "").trim(),
            verificationPhotoUrl: String(body.vehiclePresencePhotoUrl || "").trim(),
            verificationPhotoS3Key: String(body.vehiclePresenceS3Key || "").trim(),
            verification_status: vehiclePresence.PRESENCE_STATUSES.PENDING,
            verificationStatus: vehiclePresence.PRESENCE_STATUSES.PENDING,
            verified_at: "",
            verifiedAt: ""
          };
          shouldVerifyPresence = true;
        }
        delete updated.vehiclePresenceToken;
        delete updated.vehiclePresenceCode;
        delete updated.vehiclePresenceGeneratedAt;
        delete updated.vehiclePresenceExpiresAt;
        delete updated.vehiclePresencePhotoUrl;
        delete updated.vehiclePresenceS3Key;
        const shouldRefresh =
          updated.status === "active" &&
          updated.vin &&
          marketCheckRefreshFieldsChanged(existing, updated);
        const finalListing = shouldRefresh
          ? await enrichListingWithMarketCheck(updated, { forceValuationRefresh: true })
          : updated;
        if (listingNeedsPriceReview(finalListing)) {
          finalListing.reviewFlags = Array.from(new Set([...(finalListing.reviewFlags || []), "price_outlier"]));
          if (finalListing.status === "active") finalListing.status = "pending_review";
        } else {
          finalListing.reviewFlags = (finalListing.reviewFlags || []).filter((flag) => flag !== "price_outlier");
        }
        const saved = await store.createListing(finalListing);
        await trackEvent(req, "update_listing", user, { listingId: saved.id, marketCheckRefreshed: Boolean(shouldRefresh) });
        await auditMarketplaceAction(req, "listing.updated", "listing", saved.id, user, {
          previousValue: JSON.stringify({
            price: existing.price,
            mileage: existing.mileage,
            vin: existing.vin,
            titleStatus: existing.titleStatus
          }),
          newValue: JSON.stringify({
            price: saved.price,
            mileage: saved.mileage,
            vin: saved.vin,
            titleStatus: saved.titleStatus,
            status: saved.status
          }),
          metadata: { marketCheckRefreshed: Boolean(shouldRefresh), reviewFlags: saved.reviewFlags || [] }
        });
        if (shouldVerifyPresence) scheduleVehiclePresenceVerification(saved.id);
        sendJson(res, 200, { listing: listingWithReadableImages(saved), marketCheckRefreshed: Boolean(shouldRefresh) });
      })
      .catch((error) => sendJson(res, error.status || 400, {
        error: error.message || "Unable to update listing.",
        code: error.code,
        detail: error.detail || error.message
      }));
    return;
  }

  const listingOcrMatch = url.pathname.match(/^\/api\/listings\/([^/]+)\/documents\/ocr$/);
  if (listingOcrMatch && req.method === "POST") {
    const user = getAuthUser(req);
    if (!user) {
      sendJson(res, 401, { error: "Sign in to process listing documents." });
      return;
    }
    const id = decodeURIComponent(listingOcrMatch[1]);
    store.getListingById(id)
      .then(async (listing) => {
        if (!listing) {
          sendJson(res, 404, { error: "Listing not found." });
          return;
        }
        if (listing.userId !== user.id) {
          sendJson(res, 403, { error: "You can only process your own listing documents." });
          return;
        }
        sendJson(res, 200, {
          queued: false,
          message: "Automated document OCR is not configured. Uploaded documents remain available for manual review."
        });
      })
      .catch((error) => sendJson(res, error.status || 400, {
        error: error.message || "Unable to review listing documents."
      }));
    return;
  }

  const listingStatusMatch = url.pathname.match(/^\/api\/listings\/([^/]+)\/status$/);
  if (listingStatusMatch && req.method === "POST") {
    const user = getAuthUser(req);
    if (!user) {
      sendJson(res, 401, { error: "Sign in to update listing status." });
      return;
    }
    const id = decodeURIComponent(listingStatusMatch[1]);
    readJson(req).then(async (body) => {
      const listing = await store.getListingById(id);
      if (!listing) throw makePublicError("Listing not found.", 404);
      if (listing.userId !== user.id) throw makePublicError("You can only update your own listing.", 403);
      if (listing.isDemo || listing.is_demo) throw makePublicError("Demo listing outcomes cannot be changed.", 403);
      const status = String(body.status || "");
      if (!["sold", "active"].includes(status)) throw makePublicError("Choose sold or active status.", 400);
      const now = new Date().toISOString();
      const soldSource = String(body.soldSource || "");
      const wouldUseAgain = String(body.wouldUseAgain || "");
      if (status === "sold" && !["kerodex", "elsewhere", "prefer_not_to_say"].includes(soldSource)) {
        throw makePublicError("Choose how the vehicle was sold.", 400);
      }
      if (status === "sold" && !["yes", "maybe", "no"].includes(wouldUseAgain)) {
        throw makePublicError("Choose whether you would use Kerodex again.", 400);
      }
      const finalSalePrice = body.finalSalePrice === "" || body.finalSalePrice === undefined ? null : Number(body.finalSalePrice);
      if (finalSalePrice !== null && (!Number.isFinite(finalSalePrice) || finalSalePrice < 0 || finalSalePrice > 1000000)) {
        throw makePublicError("Enter a valid final sale price.", 400);
      }
      const next = {
        ...listing,
        status,
        soldAt: status === "sold" ? now : "",
        saleOutcome: status === "sold" ? {
          soldSource,
          finalSalePrice,
          daysToSell: listing.createdAt ? Math.max(0, Math.ceil((Date.now() - Date.parse(listing.createdAt)) / 86400000)) : null,
          wouldUseAgain,
          feedbackText: normalizeLimitedString(body.feedbackText || "", 1500),
          recordedAt: now
        } : listing.saleOutcome,
        updatedAt: now
      };
      const saved = await store.createListing(next);
      await trackEvent(req, status === "sold" ? "listing_marked_sold" : "listing_marked_available", user, {
        listingId: id,
        soldSource: status === "sold" ? soldSource : "",
        finalSalePrice
      });
      if (status === "sold") {
        await trackEvent(req, "seller_sale_followup_answered", user, { listingId: id, soldSource, wouldUseAgain });
        if (body.feedbackText) {
          await store.saveFeedback({
            id: `feedback_${Date.now().toString(36)}_${crypto.randomBytes(4).toString("hex")}`,
            userId: user.id,
            listingId: id,
            context: "seller_sale_outcome",
            rating: null,
            responseText: normalizeLimitedString(body.feedbackText, 1500),
            metadata: { soldSource, wouldUseAgain },
            createdAt: now
          });
        }
      }
      sendJson(res, 200, { listing: listingWithReadableImages(saved) });
    }).catch((error) => sendJson(res, error.status || 400, { error: publicError(error, "Unable to update listing status.") }));
    return;
  }

  const listingDeleteMatch = url.pathname.match(/^\/api\/listings\/([^/]+)$/);
  if (listingDeleteMatch && req.method === "DELETE") {
    const user = getAuthUser(req);
    if (!user) {
      sendJson(res, 401, { error: "Sign in to remove a listing." });
      return;
    }
    const id = decodeURIComponent(listingDeleteMatch[1]);
    Promise.resolve().then(async () => {
      const listing = await store.getListingById(id);
      if (!listing) throw makePublicError("Listing not found.", 404);
      if (listing.userId !== user.id) throw makePublicError("You can only remove your own listing.", 403);
      const saved = await store.createListing({ ...listing, status: "removed", removedAt: new Date().toISOString(), updatedAt: new Date().toISOString() });
      await trackEvent(req, "listing_deleted", user, { listingId: id });
      sendJson(res, 200, { listing: listingWithReadableImages(saved) });
    }).catch((error) => sendJson(res, error.status || 400, { error: publicError(error, "Unable to remove listing.") }));
    return;
  }

  const listingFavoriteMatch = url.pathname.match(/^\/api\/listings\/([^/]+)\/favorite$/);
  if (listingFavoriteMatch && req.method === "POST") {
    const user = getAuthUser(req);
    if (!user) {
      sendJson(res, 401, { error: "Sign in to save vehicles." });
      return;
    }
    const id = decodeURIComponent(listingFavoriteMatch[1]);
    readJson(req)
      .then(async (body) => {
        const saved = Boolean(body.saved);
        const result = await store.setListingSaved(user.id, id, saved);
        if (!result) {
          sendJson(res, 404, { error: "Listing not found." });
          return;
        }
        await trackEvent(req, saved ? "save_listing" : "unsave_listing", user, { listingId: id });
        sendJson(res, 200, {
          saved: result.saved,
          listing: listingWithReadableImages(result.listing)
        });
      })
      .catch((error) => sendJson(res, 400, { error: "Unable to update saved vehicle.", detail: error.message }));
    return;
  }

  const listingPresenceMatch = url.pathname.match(/^\/api\/listings\/([^/]+)\/vehicle-presence$/);
  if (listingPresenceMatch && req.method === "POST") {
    const user = getAuthUser(req);
    if (!user) {
      sendJson(res, 401, { error: "Sign in to submit vehicle presence verification." });
      return;
    }
    const id = decodeURIComponent(listingPresenceMatch[1]);
    readJson(req)
      .then(async (body) => {
        const listing = await store.getListingById(id);
        if (!listing) {
          sendJson(res, 404, { error: "Listing not found." });
          return;
        }
        if (listing.userId !== user.id) {
          sendJson(res, 403, { error: "You can only verify your own listings." });
          return;
        }
        if (!/^[A-HJ-NPR-Z0-9]{17}$/.test(normalizeVin(listing.vin))) {
          sendJson(res, 400, { error: "Add a valid VIN before submitting vehicle presence verification." });
          return;
        }
        const presenceRecord = consumePresenceCode({
          token: body.vehiclePresenceToken,
          code: body.vehiclePresenceCode,
          user
        });
        if (!presenceRecord || !String(body.vehiclePresencePhotoUrl || "").trim()) {
          sendJson(res, 400, { error: "Generate a fresh code and upload a verification photo." });
          return;
        }
        const updated = {
          ...listing,
          status: "pending_verification",
          verificationStatus: vehiclePresence.PRESENCE_STATUSES.PENDING,
          vehiclePresenceVerified: false,
          photoChallengeVerified: false,
          livePhotoVerified: false,
          challengeCodeVerified: false,
          photoChallengeCode: presenceRecord.code,
          challengeCode: presenceRecord.code,
          photoChallengeProofImage: String(body.vehiclePresencePhotoUrl || "").trim(),
          vehiclePresence: {
            ...(listing.vehiclePresence || {}),
            verification_code: presenceRecord.code,
            verificationCode: presenceRecord.code,
            generated_at: presenceRecord.generatedAt,
            generatedAt: presenceRecord.generatedAt,
            expires_at: presenceRecord.expiresAt,
            expiresAt: presenceRecord.expiresAt,
            verification_photo_url: String(body.vehiclePresencePhotoUrl || "").trim(),
            verificationPhotoUrl: String(body.vehiclePresencePhotoUrl || "").trim(),
            verificationPhotoS3Key: String(body.vehiclePresenceS3Key || "").trim(),
            verification_status: vehiclePresence.PRESENCE_STATUSES.PENDING,
            verificationStatus: vehiclePresence.PRESENCE_STATUSES.PENDING,
            verified_at: "",
            verifiedAt: ""
          },
          updatedAt: new Date().toISOString()
        };
        const saved = await store.createListing(updated);
        scheduleVehiclePresenceVerification(saved.id);
        sendJson(res, 202, { listing: saved, queued: true });
      })
      .catch((error) => sendJson(res, error.status || 400, {
        error: error.message || "Unable to submit vehicle presence verification."
      }));
    return;
  }

  if (url.pathname.startsWith("/api/vin/decode/")) {
    const vin = decodeURIComponent(url.pathname.split("/").pop() || "");
    decodeVin(vin)
      .then((body) => sendJson(res, body.ok ? 200 : 400, body))
      .catch((error) => {
        sendJson(res, 502, {
          ok: false,
          error: "VIN decoder is unavailable right now. Save the VIN and retry before publishing.",
          detail: error.message
        });
      });
    return;
  }

  if (url.pathname.startsWith("/api/listings/")) {
    const id = url.pathname.split("/").pop();
    store.getListingById(id)
      .then(async (listing) => {
        if (!listing) {
          sendJson(res, 404, { error: "Listing not found" });
          return;
        }
        const user = getAuthUser(req);
        const publicStatus = listing.status === "active" || listing.status === "sold";
        if (!publicStatus && listing.userId !== user?.id) {
          sendJson(res, 404, { error: "Listing is not public yet." });
          return;
        }
        trackEvent(req, "listing_view", user, { listingId: listing.id, route: url.pathname }).catch(() => {});
        sendJson(res, 200, await listingWithReadableSeller(listing));
      })
      .catch((error) => sendJson(res, 500, { error: "Unable to load listing.", detail: error.message }));
    return;
  }

  const sellerReviewMatch = url.pathname.match(/^\/api\/sellers\/([^/]+)\/reviews$/);
  if (sellerReviewMatch && req.method === "POST") {
    const user = getAuthUser(req);
    if (!user) {
      sendJson(res, 401, { error: "Sign in to leave a seller review." });
      return;
    }
    const sellerId = decodeURIComponent(sellerReviewMatch[1] || "");
    if (!sellerId || sellerId === user.id) {
      sendJson(res, 400, { error: "You cannot review this seller." });
      return;
    }
    readJson(req)
      .then(async (body) => {
        const sellerProfile = typeof store.getSellerById === "function" ? await store.getSellerById(sellerId) : null;
        if (sellerProfile?.isDemo || sellerProfile?.is_demo) {
          sendJson(res, 403, { error: "Demo seller profiles cannot receive reviews.", code: "demo_seller_review_disabled" });
          return;
        }
        const review = normalizeSellerReviewBody(body, user, sellerId);
        const seller = await store.addSellerReview(sellerId, review);
        if (!seller) {
          sendJson(res, 404, { error: "Seller not found." });
          return;
        }
        trackEvent(req, "seller_review_created", user, {
          sellerId,
          rating: review.rating
        }).catch(() => {});
        sendJson(res, 201, { seller: await sellerWithReadableProfile(seller, sellerId), review });
      })
      .catch((error) => sendJson(res, error.status || 400, { error: publicError(error, "Unable to save review.") }));
    return;
  }

  if (url.pathname.startsWith("/api/sellers/")) {
    const id = decodeURIComponent(url.pathname.split("/").pop() || "");
    store.getSellerById(id)
      .then(async (seller) => sendJson(res, seller ? 200 : 404, seller ? await sellerWithReadableProfile(seller, id) : { error: "Seller not found" }))
      .catch((error) => sendJson(res, 500, { error: "Unable to load seller.", detail: error.message }));
    return;
  }

  if (url.pathname === "/api/conversations" && req.method === "GET") {
    const user = getAuthUser(req);
    if (!user) {
      sendJson(res, 401, { error: "Sign in to view conversations." });
      return;
    }
    store.getConversations()
      .then((conversations) => sendJson(res, 200, {
        conversations: conversations.filter((conversation) =>
          conversation.buyerId === user.id || conversation.sellerId === user.id
        ).map((conversation) => decorateConversation(conversation, user))
      }))
      .catch((error) => sendJson(res, 500, { error: "Unable to load conversations.", detail: error.message }));
    return;
  }

  if (url.pathname === "/api/conversations" && req.method === "POST") {
    const user = getAuthUser(req);
    if (!user) {
      sendJson(res, 401, { error: "Sign in to message a seller." });
      return;
    }
    if (user.messagingDisabled) {
      sendJson(res, 403, { error: "Messaging is disabled for this account. Contact Kerodex support if this looks wrong." });
      return;
    }
    readJson(req)
      .then(async (body) => {
        const listing = await store.getListingById(String(body.listingId || ""));
        if (!listing) {
          sendJson(res, 404, { error: "Listing not found." });
          return;
        }
        if (listing.status === "sold") {
          sendJson(res, 409, { error: "This vehicle is marked sold and is not accepting new buyer messages.", code: "listing_sold" });
          return;
        }
        if (listing.userId === user.id) {
          sendJson(res, 400, { error: "You cannot message yourself about your own listing." });
          return;
        }
        const conversationId = `conv_${user.id}_${listing.id}`;
        const existing = typeof store.getConversationById === "function"
          ? await store.getConversationById(conversationId)
          : null;
        if (existing) {
          const updated = appendConversationMessage(existing, user, body.message || "Hi, is this still available?");
          const saved = await store.createConversation(updated || existing);
          if (updated?.moderationStatus === "high_risk") {
            await saveReport(createReportRecord({
              reporter: { id: "system", name: "Kerodex safety scanner", email: "" },
              reportedUserId: user.id,
              listingId: listing.id,
              conversationId: saved.id,
              category: "suspected_scam",
              description: "Automated scanner marked this conversation as high risk. Review before taking action.",
              source: "scam_detector",
              metadata: { scamFlags: updated.scamFlags, scamRiskScore: updated.scamRiskScore }
            }));
          }
          await trackEvent(req, "send_message", user, { listingId: listing.id, conversationId: saved.id });
          notifyMessageRecipient(saved, user, listing).catch(() => {});
          sendJson(res, 200, { conversation: decorateConversation(saved, user) });
          return;
        }
        const conversation = createConversationRecord({
          listing,
          buyer: user,
          message: body.message
        });
        const created = await store.createConversation(conversation);
        if (created.moderationStatus === "high_risk") {
          await saveReport(createReportRecord({
            reporter: { id: "system", name: "Kerodex safety scanner", email: "" },
            reportedUserId: user.id,
            listingId: listing.id,
            conversationId: created.id,
            category: "suspected_scam",
            description: "Automated scanner marked this conversation as high risk. Review before taking action.",
            source: "scam_detector",
            metadata: { scamFlags: created.scamFlags, scamRiskScore: created.scamRiskScore }
          }));
        }
        await trackEvent(req, "send_message", user, { listingId: listing.id, conversationId: created.id });
        notifyMessageRecipient(created, user, listing).catch(() => {});
        sendJson(res, 201, { conversation: decorateConversation(created, user) });
      })
      .catch((error) => sendJson(res, 400, { error: "Unable to start conversation.", detail: error.message }));
    return;
  }

  const conversationOutcomeMatch = url.pathname.match(/^\/api\/conversations\/([^/]+)\/outcome$/);
  if (conversationOutcomeMatch && req.method === "POST") {
    const user = getAuthUser(req);
    if (!user) {
      sendJson(res, 401, { error: "Sign in to update conversation status." });
      return;
    }
    const conversationId = decodeURIComponent(conversationOutcomeMatch[1]);
    readJson(req).then(async (body) => {
      const conversation = await store.getConversationById(conversationId);
      if (!conversation) throw makePublicError("Conversation not found.", 404);
      const role = conversation.buyerId === user.id ? "buyer" : conversation.sellerId === user.id ? "seller" : "";
      if (!role) throw makePublicError("You cannot update this conversation.", 403);
      const allowed = role === "buyer"
        ? new Set(["interested", "scheduled_meetup", "passed", "bought", "seller_no_response"])
        : new Set(["still_available", "test_drive_scheduled", "buyer_no_show", "sold", "passed"]);
      const status = String(body.status || "");
      if (!allowed.has(status)) throw makePublicError("Choose a valid conversation outcome.", 400);
      const outcomes = { ...(conversation.outcomes || {}), [role]: status };
      const saved = await store.createConversation({ ...conversation, outcomes, updatedAt: new Date().toISOString() });
      await trackEvent(req, "conversation_outcome_updated", user, {
        listingId: conversation.listingId,
        conversationId,
        role,
        status,
        relatedEntityType: "conversation",
        relatedEntityId: conversationId
      });
      sendJson(res, 200, { conversation: decorateConversation(saved, user) });
    }).catch((error) => sendJson(res, error.status || 400, { error: publicError(error, "Unable to update conversation status.") }));
    return;
  }

  const conversationReadMatch = url.pathname.match(/^\/api\/conversations\/([^/]+)\/read$/);
  if (conversationReadMatch && req.method === "POST") {
    const user = getAuthUser(req);
    if (!user) {
      sendJson(res, 401, { error: "Sign in to update conversations." });
      return;
    }
    const conversationId = decodeURIComponent(conversationReadMatch[1]);
    Promise.resolve()
      .then(async () => {
        const conversation = typeof store.getConversationById === "function"
          ? await store.getConversationById(conversationId)
          : (await store.getConversations()).find((item) => item.id === conversationId);
        if (!conversation) {
          sendJson(res, 404, { error: "Conversation not found." });
          return;
        }
        if (conversation.buyerId !== user.id && conversation.sellerId !== user.id) {
          sendJson(res, 403, { error: "You cannot update this conversation." });
          return;
        }
        const unreadByUser = { ...(conversation.unreadByUser || {}) };
        unreadByUser[user.id] = 0;
        const unread = Object.values(unreadByUser).reduce((sum, value) => sum + Number(value || 0), 0);
        const saved = await store.createConversation({ ...conversation, unread, unreadByUser });
        sendJson(res, 200, { conversation: decorateConversation(saved, user) });
      })
      .catch((error) => sendJson(res, 500, { error: "Unable to mark conversation read.", detail: error.message }));
    return;
  }

  const messageCreateMatch = url.pathname.match(/^\/api\/conversations\/([^/]+)\/messages$/);
  if (messageCreateMatch && req.method === "POST") {
    const user = getAuthUser(req);
    if (!user) {
      sendJson(res, 401, { error: "Sign in to send messages." });
      return;
    }
    if (user.messagingDisabled) {
      sendJson(res, 403, { error: "Messaging is disabled for this account. Contact Kerodex support if this looks wrong." });
      return;
    }
    const conversationId = decodeURIComponent(messageCreateMatch[1]);
    readJson(req)
      .then(async (body) => {
        const conversation = typeof store.getConversationById === "function"
          ? await store.getConversationById(conversationId)
          : (await store.getConversations()).find((item) => item.id === conversationId);
        if (!conversation) {
          sendJson(res, 404, { error: "Conversation not found." });
          return;
        }
        const updated = appendConversationMessage(conversation, user, body.content);
        if (!updated) {
          sendJson(res, 403, { error: "You cannot send a message in this conversation." });
          return;
        }
        const listing = await store.getListingById(conversation.listingId);
        if (listing?.status === "sold") {
          sendJson(res, 409, { error: "This vehicle is marked sold. New messages are disabled.", code: "listing_sold" });
          return;
        }
        const saved = await store.createConversation(updated);
        if (updated.moderationStatus === "high_risk") {
          await saveReport(createReportRecord({
            reporter: { id: "system", name: "Kerodex safety scanner", email: "" },
            reportedUserId: user.id,
            listingId: updated.listingId,
            conversationId: updated.id,
            category: "suspected_scam",
            description: "Automated scanner marked this conversation as high risk. Review before taking action.",
            source: "scam_detector",
            metadata: { scamFlags: updated.scamFlags, scamRiskScore: updated.scamRiskScore }
          }));
        }
        await trackEvent(req, "send_message", user, { listingId: updated.listingId, conversationId: updated.id });
        Promise.resolve(listing)
          .then((currentListing) => notifyMessageRecipient(saved, user, currentListing))
          .catch(() => {});
        sendJson(res, 201, { conversation: decorateConversation(saved, user) });
      })
      .catch((error) => sendJson(res, 400, { error: "Unable to send message.", detail: error.message }));
    return;
  }

  if (url.pathname === "/api/events") {
    handleEvents(req, res);
    return;
  }

  serveStatic(req, res, url.pathname);
});

function auditEnvironment() {
  const warnings = [];
  if (IS_PRODUCTION && !process.env.ADMIN_ACCESS_CODE) warnings.push("ADMIN_ACCESS_CODE is required in production.");
  if (!process.env.ANALYTICS_IP_SALT) warnings.push("ANALYTICS_IP_SALT is not set; using local default for IP hashing.");
  if (!process.env.DATABASE_URL && process.env.REQUIRE_DATABASE === "true") warnings.push("DATABASE_URL is required because REQUIRE_DATABASE=true.");
  if (!process.env.RESEND_API_KEY || !process.env.AUTH_EMAIL_FROM) warnings.push("Resend email is not fully configured.");
  if (!hasTwilioVerifyConfig()) warnings.push("Twilio Verify phone OTP is not fully configured.");
  if (!process.env.S3_BUCKET || !process.env.AWS_REGION || !process.env.AWS_ACCESS_KEY_ID || !process.env.AWS_SECRET_ACCESS_KEY) warnings.push("S3 uploads are not fully configured.");
  if (!process.env.MARKETCHECK_API_KEY) warnings.push("MarketCheck API key is not configured.");
  if (!process.env.OPENAI_API_KEY && !process.env.VEHICLE_PRESENCE_OPENAI_API_KEY) warnings.push("Vehicle presence AI verification is not configured; photo challenges will require manual review.");
  warnings.forEach((warning) => console.warn(`[Kerodex security] env_warning ${warning}`));
}

async function startServer() {
  try {
    auditEnvironment();
    const database = typeof store.connect === "function"
      ? await store.connect()
      : { ok: true, kind: store.kind, databaseStatus: store.kind };
    await hydrateRuntimeAuthFromStore();
    if (store.kind === "postgres") {
      console.log(`[Kerodex] Postgres connected successfully (${database.databaseStatus}).`);
    } else {
      console.log(`[Kerodex] Using ${store.kind} storage (${database.databaseStatus || "local fallback"}).`);
    }
    server.listen(PORT, () => {
      console.log(`Kerodex running at http://localhost:${PORT}`);
    });
  } catch (error) {
    console.error(`[Kerodex] Database startup check failed: ${error.message}`);
    if (process.env.REQUIRE_DATABASE === "true") {
      console.error("[Kerodex] REQUIRE_DATABASE=true, so the API will not start with local JSON fallback.");
      process.exit(1);
      return;
    }
    server.listen(PORT, () => {
      console.log(`Kerodex running at http://localhost:${PORT}`);
    });
  }
}

startServer();
