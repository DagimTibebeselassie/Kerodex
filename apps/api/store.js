const fs = require("fs");
const path = require("path");

const SEED_DIR = path.resolve(__dirname, "seed");
const USE_DATABASE = Boolean(process.env.DATABASE_URL);
const REQUIRE_DATABASE = process.env.REQUIRE_DATABASE === "true";
const PHONE_VERIFICATION_TTL_MS = 183 * 24 * 60 * 60 * 1000;

function isFreshPhoneVerification(value) {
  const timestamp = Date.parse(value || "");
  return Boolean(timestamp && Date.now() - timestamp < PHONE_VERIFICATION_TTL_MS);
}

function stripExpiredPhoneVerification(user) {
  if (!user) return user;
  if (!user.phoneVerifiedAt || isFreshPhoneVerification(user.phoneVerifiedAt)) return user;
  return {
    ...user,
    phone: "",
    phoneNumber: "",
    phoneVerified: false,
    phoneVerifiedAt: "",
    phoneVerificationExpiredAt: user.phoneVerificationExpiredAt || new Date().toISOString()
  };
}

function postgresConnectionString() {
  const raw = process.env.DATABASE_URL || "";
  if (process.env.DATABASE_SSL !== "true") return raw;
  try {
    const url = new URL(raw);
    url.searchParams.delete("sslmode");
    return url.toString();
  } catch {
    return raw;
  }
}

function readJsonFile(fileName) {
  const filePath = path.join(SEED_DIR, fileName);
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

const makes = ["Toyota", "Honda", "Tesla", "Ford", "Chevrolet", "BMW", "Mercedes-Benz", "Subaru", "Lexus", "Hyundai"];
const devices = ["Chrome", "Safari", "Edge", "Mobile browser"];

function daysAgo(days) {
  const date = new Date();
  date.setDate(date.getDate() - days);
  return date.toISOString();
}

function formatDay(daysBack) {
  return daysAgo(daysBack).slice(0, 10);
}

function percent(part, total) {
  return total ? Math.round((part / total) * 100) : 0;
}

function money(value) {
  return Math.round(value);
}

function followupFromRow(row) {
  return {
    id: row.id,
    userId: row.user_id,
    listingId: row.listing_id,
    conversationId: row.conversation_id || "",
    followupType: row.followup_type,
    answer: row.answer || "",
    feedbackText: row.feedback_text || "",
    dismissed: Boolean(row.dismissed),
    createdAt: row.created_at.toISOString(),
    updatedAt: row.updated_at.toISOString()
  };
}

function initialsForName(name) {
  return String(name || "Kerodex Seller")
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() || "")
    .join("") || "KS";
}

function splitLocation(location = "") {
  const [city = "", state = ""] = String(location).split(",").map((part) => part.trim());
  return { city, state };
}

function sellerProfileFromRecords(id, user = null, listings = []) {
  const listing = listings.find((item) => item.userId === id || item.seller?.id === id) || {};
  const listingSeller = listing.seller || {};
  const name = listingSeller.name || user?.name || user?.fullName || user?.email?.split("@")[0] || "Kerodex Seller";
  const location = splitLocation(listing.location || listingSeller.location || "");
  return {
    id,
    name,
    initials: listingSeller.initials || initialsForName(name),
    city: listingSeller.city || location.city,
    state: listingSeller.state || location.state,
    memberSince: user?.createdAt || user?.accountCreatedAt || listing.createdAt || new Date().toISOString(),
    bio: listingSeller.bio || "Private-party seller on Kerodex.",
    responseTime: listingSeller.responseTime || "Response time not available yet",
    responseRate: listingSeller.responseRate || 0,
    completedSales: listingSeller.completedSales || 0,
    rating: null,
    reviewCount: 0,
    reviews: [],
    verification: {
      email: Boolean(user?.emailVerified),
      phone: Boolean(user?.phoneVerified),
      identity: Boolean(user?.identityVerified || user?.identityVerificationStatus === "approved"),
      selfie: Boolean(user?.selfieVerified)
    }
  };
}

function applySellerReview(seller, review) {
  const existingReviews = Array.isArray(seller.reviews) ? seller.reviews : [];
  const nextReviews = [
    review,
    ...existingReviews.filter((item) => item.reviewerId !== review.reviewerId)
  ].sort((a, b) => Date.parse(b.createdAt || "") - Date.parse(a.createdAt || ""));
  const ratingTotal = nextReviews.reduce((sum, item) => sum + Number(item.rating || 0), 0);
  const rating = nextReviews.length ? Math.round((ratingTotal / nextReviews.length) * 10) / 10 : null;
  return {
    ...seller,
    reviews: nextReviews,
    rating,
    reviewCount: nextReviews.length,
    updatedAt: new Date().toISOString()
  };
}

function buildDemoUsers(listings, conversations) {
  const sellerNames = listings.map((listing, index) => listing.seller?.name || `Kerodex Seller ${index + 1}`);
  const buyerNames = conversations.flatMap((conversation) => conversation.participants || []);
  const names = Array.from(new Set([...sellerNames, ...buyerNames])).slice(0, 36);

  return names.map((name, index) => {
    const listingCount = listings.filter((listing) => (listing.seller?.name || "").toLowerCase() === name.toLowerCase()).length;
    const messageCount = conversations.reduce((total, conversation) => {
      return total + ((conversation.participants || []).includes(name) ? conversation.messages?.length || 0 : 0);
    }, 0);
    const listing = listings.find((item) => (item.seller?.name || "").toLowerCase() === name.toLowerCase());
    const sellerVerified = Boolean(listing?.seller?.verified);
    return {
      id: `usr_admin_${String(index + 1).padStart(3, "0")}`,
      fullName: name,
      email: `${name.toLowerCase().replace(/[^a-z0-9]+/g, ".").replace(/^\.+|\.+$/g, "") || "user"}@example.com`,
      phone: "",
      role: listingCount > 0 ? "seller" : "buyer",
      status: "active",
      accountCreatedAt: daysAgo(90 - (index % 60)),
      lastLoginAt: daysAgo(index % 14),
      verificationStatus: sellerVerified ? "approved" : "not_started",
      profileCompletion: sellerVerified ? 90 : 60,
      listingCount,
      messagesSent: messageCount,
      reportsReceived: 0,
      shadowBanned: false,
      messagingDisabled: false,
      listingCreationDisabled: false,
      internalNotes: "",
      loginHistory: [{ at: daysAgo(index % 14), ip: "local-demo", region: listing?.location || "Unknown" }],
      ipHistory: ["local-demo"],
      deviceHistory: [devices[index % devices.length], devices[(index + 2) % devices.length]],
      timeline: [
        { at: daysAgo(index % 30), event: "Logged in", detail: devices[index % devices.length] },
        ...(listingCount ? [{ at: listing?.updatedAt || daysAgo((index + 3) % 30), event: "Listing active", detail: listing?.title || "Vehicle listing" }] : []),
        { at: daysAgo((index + 5) % 30), event: "Listing viewed", detail: listings[index % listings.length]?.title || "Vehicle listing" }
      ]
    };
  });
}

function listingRiskLevel(listing) {
  const score = Number(listing.trustScore || listing.riskScore || 0);
  if (score >= 85) return "low";
  if (score >= 70) return "medium";
  if (score >= 50) return "high";
  return "critical";
}

function listingVerificationStatus(listing) {
  const status = String(listing.verificationStatus || "");
  if (listing.vehiclePresenceVerified || status === "vehicle_presence_verified") return "vehicle_presence_verified";
  if (String(listing.status || "").includes("pending_verification") || status.includes("manual_review") || status.includes("rejected_")) return "pending";
  if (status.includes("reviewed") || listing.seller?.verified) return "verified";
  if (status.includes("pending")) return "pending";
  return "not_started";
}

function buildAdminState(listings, conversations) {
  const users = buildDemoUsers(listings, conversations);
  const now = new Date().toISOString();
  const adminListings = listings.map((listing, index) => ({
    id: listing.id,
    seller: listing.seller?.name || users[index % users.length]?.fullName || "Kerodex Seller",
    vin: listing.vin || `DEMO${String(index + 1).padStart(13, "0")}`,
    title: listing.title,
    price: listing.price,
    mileage: Number(listing.mileage || 0),
    location: listing.location,
    status: listing.status || "active",
    isDemo: Boolean(listing.isDemo || listing.is_demo),
    demoSeedId: listing.demoSeedId || "",
    verificationStatus: listingVerificationStatus(listing),
    views: Number(listing.views || 0),
    favorites: Number(listing.saves || listing.favorites || 0),
    inquiries: Number(listing.inquiries || 0),
    riskLevel: listingRiskLevel(listing),
    riskScore: Math.max(0, 100 - Number(listing.trustScore || 75)),
    updatedAt: listing.updatedAt || daysAgo(index % 20),
    history: [
      { at: daysAgo(index % 10), action: "Listing updated", actor: "seller" },
      { at: daysAgo((index + 3) % 12), action: "Fraud scan completed", actor: "system" }
    ]
  }));

  const verifications = [];
  const fraudFlags = [];
  const reports = [];

  const auditLogs = [
    { id: "audit_0001", timestamp: now, adminAccount: "system", actionType: "admin.dashboard_bootstrapped", targetType: "system", targetId: "local", previousValue: null, newValue: "runtime admin state", immutable: true }
  ];

  const traffic = Array.from({ length: 30 }, (_, index) => {
    const day = 29 - index;
    const visitors = 0;
    const signups = 0;
    const listingsCreated = 0;
    return {
      date: formatDay(day),
      visitors,
      uniqueVisitors: Math.max(8, visitors - 5),
      pageViews: 0,
      sessions: 0,
      signups,
      listingsCreated,
      contacts: 0
    };
  });

  return {
    users,
    listings: adminListings,
    verifications,
    fraudFlags,
    reports,
    auditLogs,
    notifications: [],
    tickets: [],
    featureFlags: [
      { key: "featured_listings", enabled: false },
      { key: "inspection_services", enabled: false },
      { key: "escrow_services", enabled: false },
      { key: "shadow_ban_tools", enabled: true },
      { key: "announcement_system", enabled: true }
    ],
    traffic
  };
}

function toAdminListingRecord(listing, index = 0) {
  return {
    id: listing.id,
    userId: listing.userId || listing.seller?.id || "",
    sellerId: listing.seller?.id || listing.userId || "",
    seller: listing.seller?.name || "Kerodex Seller",
    sellerRecord: listing.seller || {},
    vin: listing.vin || `DEMO${String(index + 1).padStart(13, "0")}`,
    title: listing.title,
    make: listing.make || "",
    model: listing.model || "",
    trim: listing.trim || "",
    year: Number(listing.year || 0),
    price: listing.price,
    mileage: Number(listing.mileage || 0),
    location: listing.location,
    status: listing.status || "active",
    verificationStatus: listingVerificationStatus(listing),
    views: Number(listing.views || 0),
    favorites: Number(listing.saves || listing.favorites || 0),
    inquiries: Number(listing.inquiries || 0),
    riskLevel: listingRiskLevel(listing),
    riskScore: Math.max(0, 100 - Number(listing.trustScore || 75)),
    photosCount: Array.isArray(listing.images) ? listing.images.filter(Boolean).length : 0,
    createdAt: listing.createdAt || listing.updatedAt || new Date().toISOString(),
    updatedAt: listing.updatedAt || new Date().toISOString(),
    history: [
      { at: listing.updatedAt || new Date().toISOString(), action: "Listing synced", actor: "system" }
    ]
  };
}

function toAdminUserRecord(user) {
  const createdAt = user.createdAt || user.acceptedTermsAt || new Date().toISOString();
  const lastLoginAt = user.lastLoginAt || user.lastActiveAt || createdAt;
  return {
    id: user.id,
    fullName: user.name || String(user.email || "").split("@")[0] || "Kerodex user",
    email: user.email || "",
    phone: user.phoneNumber ? `•••• ${String(user.phoneNumber).slice(-4)}` : "",
    role: "member",
    status: user.status || "active",
    accountCreatedAt: createdAt,
    lastLoginAt,
    verificationStatus: user.identityVerified ? "approved" : (user.emailVerified ? "email_verified" : "pending"),
    profileCompletion: [user.emailVerified, user.phoneVerified, user.identityVerified, user.selfieVerified].filter(Boolean).length * 25,
    listingCount: 0,
    messagesSent: 0,
    reportsReceived: 0,
    shadowBanned: Boolean(user.shadowBanned),
    messagingDisabled: Boolean(user.messagingDisabled),
    listingCreationDisabled: Boolean(user.listingCreationDisabled),
    internalNotes: user.internalNotes || "",
    loginHistory: [{ at: lastLoginAt, ip: "masked", region: "Unknown" }],
    ipHistory: ["masked"],
    deviceHistory: [user.provider || "email"],
    timeline: [
      { at: createdAt, event: "Account created", detail: user.provider || "email" },
      { at: lastLoginAt, event: "Last active", detail: user.emailVerified ? "email verified" : "email pending" }
    ]
  };
}

function isPublicMarketplaceListing(listing) {
  return ["active", "sold"].includes(String(listing?.status || "").toLowerCase());
}

function realAdminUsersForStore(store, persistedUsers = []) {
  const runtimeUsers = store.kind === "postgres" ? [] : store.getRuntimeAdminUsers();
  const seedUsers = store.kind === "postgres" ? [] : (store.adminState?.users || []);
  const userMap = new Map([...seedUsers, ...persistedUsers, ...runtimeUsers].map((user) => [user.email || user.id, user]));
  return Array.from(userMap.values());
}

function listingVerificationQueueRecord(listing) {
  const presence = listing.vehiclePresence || {};
  const status = presence.verification_status || presence.verificationStatus || listing.verificationStatus || "";
  const pendingStatuses = new Set([
    "pending_verification",
    "verification_in_progress",
    "manual_review_required",
    "rejected_vin_mismatch",
    "rejected_code_mismatch",
    "rejected_vin_not_detected"
  ]);
  if (!pendingStatuses.has(String(status)) && !String(listing.status || "").includes("pending_verification")) return null;
  return {
    id: `vehicle_presence_${listing.id}`,
    userId: listing.userId || listing.seller?.id || "",
    userName: listing.seller?.name || listing.sellerName || "Seller",
    email: listing.seller?.email || "",
    type: "vehicle_presence",
    listingId: listing.id,
    listingTitle: listing.title,
    vehicleVin: listing.vin || presence.vin || "",
    challengeCode: listing.vehiclePresenceCode || presence.verification_code || presence.code || "",
    verificationPhotoUrl: listing.vehiclePresencePhotoUrl || presence.verification_photo_url || presence.photoUrl || "",
    verificationPhotoS3Key: listing.vehiclePresenceS3Key || presence.verification_photo_s3_key || presence.s3Key || "",
    status: String(status || listing.status || "pending"),
    confidence: presence.confidence ?? listing.vehiclePresenceConfidence ?? null,
    submittedAt: presence.submitted_at || presence.submittedAt || listing.updatedAt || listing.createdAt || "",
    notes: presence.manualReviewNotes || listing.adminNotes || "",
    history: presence.history || listing.history || []
  };
}

function adminVerificationRecordsFromListings(listings) {
  return listings.map(listingVerificationQueueRecord).filter(Boolean);
}

function dateKey(iso) {
  return new Date(iso || Date.now()).toISOString().slice(0, 10);
}

function countEvents(events, type, sinceMs = 0) {
  const types = Array.isArray(type) ? type : [type];
  return events.filter((event) =>
    (!type || types.includes(event.eventType)) &&
    (!sinceMs || Date.parse(event.createdAt) >= sinceMs)
  ).length;
}

function occurredSince(value, sinceMs) {
  const timestamp = Date.parse(value || "");
  return Number.isFinite(timestamp) && timestamp >= sinceMs;
}

function eventTarget(event) {
  const metadata = event.metadata || {};
  return {
    targetUserId: metadata.targetUserId || metadata.reportedUserId || "",
    conversationId: metadata.conversationId || "",
    messageId: metadata.messageId || "",
    adminId: metadata.adminId || ""
  };
}

function platformActivityRecords(events, auditLogs) {
  const analytics = events.map((event) => ({
    id: event.id,
    source: "platform",
    eventType: event.eventType,
    actorUserId: event.userId || "",
    listingId: event.listingId || "",
    ...eventTarget(event),
    route: event.route || "",
    metadata: event.metadata || {},
    ipHash: event.ipHash || "",
    userAgent: event.userAgent || "",
    createdAt: event.createdAt
  }));
  const adminEventNames = {
    "users.ban": "admin_banned_user",
    "users.unban": "admin_unbanned_user",
    "users.suspend": "admin_suspended_user",
    "users.unsuspend": "admin_unsuspended_user",
    "listings.approve": "admin_approved_listing",
    "listings.reject": "admin_rejected_listing",
    "listings.remove": "admin_removed_listing",
    "listings.restore": "admin_restored_listing",
    "verifications.approve": "vehicle_verification_approved",
    "verifications.reject": "vehicle_verification_rejected",
    "reports.review": "report_reviewed",
    "reports.resolve": "report_resolved",
    "reports.dismiss": "report_dismissed",
    "admin.login": "admin_login"
  };
  const admin = auditLogs.map((log) => ({
    id: log.id,
    source: log.adminAccount === "system" ? "system" : "admin",
    eventType: adminEventNames[log.actionType] || log.actionType,
    actorUserId: "",
    targetUserId: log.targetType === "users" || log.targetType === "user" ? log.targetId : "",
    listingId: log.targetType === "listings" || log.targetType === "listing" ? log.targetId : "",
    conversationId: log.targetType === "conversation" ? log.targetId : "",
    messageId: "",
    adminId: log.adminAccount || "",
    route: "",
    metadata: {
      targetType: log.targetType,
      targetId: log.targetId,
      previousValue: log.previousValue,
      newValue: log.newValue,
      notes: log.notes || ""
    },
    ipHash: "",
    userAgent: "",
    createdAt: log.timestamp
  }));
  return [...analytics, ...admin].sort((a, b) => Date.parse(b.createdAt || "") - Date.parse(a.createdAt || ""));
}

function enrichAdminUsers(users, listings, conversations, reports, events) {
  return users.map((user) => {
    const userListings = listings.filter((listing) => listing.userId === user.id || listing.seller?.id === user.id);
    const userConversations = conversations.filter((conversation) =>
      conversation.buyerId === user.id || conversation.sellerId === user.id
    );
    const userReports = reports.filter((report) =>
      report.reporterId === user.id || report.reportedUserId === user.id
    );
    const userEvents = events.filter((event) =>
      event.userId === user.id || eventTarget(event).targetUserId === user.id
    );
    const savedListingsCount = userEvents.filter((event) => event.eventType === "save_listing").length
      - userEvents.filter((event) => event.eventType === "unsave_listing").length;
    return {
      ...user,
      listingCount: userListings.length,
      activeListingCount: userListings.filter((listing) => listing.status === "active").length,
      conversationsCount: userConversations.length,
      messagesSent: userConversations.reduce(
        (total, conversation) => total + (conversation.messages || []).filter((message) => message.senderId === user.id).length,
        0
      ),
      savedListingsCount: Math.max(0, savedListingsCount),
      reportsReceived: userReports.filter((report) => report.reportedUserId === user.id).length,
      reportsSubmitted: userReports.filter((report) => report.reporterId === user.id).length,
      lastActivityAt: userEvents[0]?.createdAt || user.lastLoginAt || user.accountCreatedAt
    };
  });
}

function buildTrafficFromEvents(events, days = 30) {
  return Array.from({ length: days }, (_, index) => {
    const day = days - 1 - index;
    const date = formatDay(day);
    const dayEvents = events.filter((event) => dateKey(event.createdAt) === date);
    const pageViews = dayEvents.filter((event) => event.eventType === "page_view").length;
    const visitorKeys = new Set(dayEvents.map((event) => event.sessionId || event.ipHash || event.userId || event.id));
    return {
      date,
      visitors: visitorKeys.size,
      uniqueVisitors: visitorKeys.size,
      pageViews,
      sessions: visitorKeys.size,
      signups: dayEvents.filter((event) => event.eventType === "signup").length,
      listingsCreated: dayEvents.filter((event) => event.eventType === "create_listing").length,
      contacts: dayEvents.filter((event) => event.eventType === "send_message").length
    };
  });
}

function syncAdminListing(store, listing) {
  if (!store.adminState || !listing?.id) return;
  const existingIndex = store.adminState.listings.findIndex((item) => item.id === listing.id);
  const record = toAdminListingRecord(listing, existingIndex >= 0 ? existingIndex : store.adminState.listings.length);
  if (existingIndex >= 0) store.adminState.listings[existingIndex] = { ...store.adminState.listings[existingIndex], ...record };
  else store.adminState.listings.unshift(record);
}

async function ensureAdminState(store) {
  if (!store.adminState) {
    const listings = await store.getListings();
    const conversations = await store.getConversations();
    store.adminState = buildAdminState(listings, conversations);
  }
  if (typeof store.getReports === "function") {
    store.adminState.reports = await store.getReports();
  }
  return store.adminState;
}

function filterByQuery(items, query, fields) {
  const normalized = String(query || "").trim().toLowerCase();
  if (!normalized) return items;
  return items.filter((item) => fields.some((field) => String(item[field] || "").toLowerCase().includes(normalized)));
}

function toCsv(rows) {
  if (!rows.length) return "";
  const keys = Object.keys(rows[0]).filter((key) => typeof rows[0][key] !== "object");
  const escape = (value) => `"${String(value ?? "").replace(/"/g, '""')}"`;
  return [keys.join(","), ...rows.map((row) => keys.map((key) => escape(row[key])).join(","))].join("\n");
}

class JsonStore {
  constructor() {
    if (REQUIRE_DATABASE) {
      throw new Error("REQUIRE_DATABASE=true but DATABASE_URL is not set. Add DATABASE_URL before starting the API.");
    }
    this.kind = "json";
    this.listings = readJsonFile("listings.json");
    this.conversations = readJsonFile("conversations.json");
    this.sellers = readJsonFile("sellers.json");
    this.reports = [];
    this.events = [];
    this.favorites = [];
    this.costRecords = [];
    this.feedbackRecords = [];
    this.followupRecords = [];
    this.buyerGuides = [];
    this.marketCheckCache = new Map();
    this.authSessions = new Map();
  }

  async getListings() {
    return this.listings.map((listing) => this.withListingMetrics(listing));
  }

  async connect() {
    return {
      ok: true,
      kind: this.kind,
      databaseStatus: "json fallback"
    };
  }

  async healthCheck() {
    return {
      ok: true,
      kind: this.kind,
      databaseStatus: "json fallback"
    };
  }

  async getListingById(id) {
    const listing = this.listings.find((item) => item.id === id);
    return listing ? this.withListingMetrics(listing) : null;
  }

  withListingMetrics(listing) {
    const views = this.events.filter((event) => ["listing_view", "listing_viewed"].includes(event.eventType) && event.listingId === listing.id).length;
    const favorites = this.favorites.filter((favorite) => favorite.listingId === listing.id).length;
    return { ...listing, views, favorites, saves: favorites };
  }

  async getSavedListings(userId) {
    const liveIds = new Set(this.listings.map((listing) => listing.id));
    this.favorites = this.favorites.filter((favorite) => liveIds.has(favorite.listingId));
    const savedIds = new Set(this.favorites.filter((favorite) => favorite.userId === userId).map((favorite) => favorite.listingId));
    return this.listings.filter((listing) => savedIds.has(listing.id)).map((listing) => this.withListingMetrics(listing));
  }

  async setListingSaved(userId, listingId, saved) {
    const listing = this.listings.find((item) => item.id === listingId);
    if (!listing) return null;
    this.favorites = this.favorites.filter((favorite) => !(favorite.userId === userId && favorite.listingId === listingId));
    if (saved) this.favorites.push({ userId, listingId, createdAt: new Date().toISOString() });
    return { saved, listing: this.withListingMetrics(listing) };
  }

  async syncSavedListings(userId, listingIds) {
    const liveIds = new Set(this.listings.map((listing) => listing.id));
    const validIds = Array.from(new Set(listingIds)).filter((id) => liveIds.has(id));
    const existing = new Set(this.favorites.filter((favorite) => favorite.userId === userId).map((favorite) => favorite.listingId));
    validIds.forEach((listingId) => {
      if (!existing.has(listingId)) this.favorites.push({ userId, listingId, createdAt: new Date().toISOString() });
    });
    return this.getSavedListings(userId);
  }

  async createListing(listing) {
    const existingIndex = this.listings.findIndex((item) => item.id === listing.id);
    if (existingIndex >= 0) {
      this.listings[existingIndex] = { ...this.listings[existingIndex], ...listing };
      syncAdminListing(this, this.listings[existingIndex]);
      return this.listings[existingIndex];
    }
    this.listings.unshift(listing);
    syncAdminListing(this, listing);
    return listing;
  }

  async getMarketCheckCache(kind, key) {
    return this.marketCheckCache.get(`${kind}:${key}`) || null;
  }

  async setMarketCheckCache(kind, key, payload) {
    const record = {
      kind,
      key,
      payload,
      updatedAt: new Date().toISOString()
    };
    this.marketCheckCache.set(`${kind}:${key}`, record);
    return record;
  }

  async getConversations() {
    return this.conversations;
  }

  async getConversationById(id) {
    return this.conversations.find((conversation) => conversation.id === id) || null;
  }

  async createConversation(conversation) {
    const existingIndex = this.conversations.findIndex((item) => item.id === conversation.id);
    if (existingIndex >= 0) {
      this.conversations[existingIndex] = { ...this.conversations[existingIndex], ...conversation };
      return this.conversations[existingIndex];
    }
    this.conversations.unshift(conversation);
    return conversation;
  }

  async getReports() {
    return this.reports;
  }

  async createReport(report) {
    this.reports.unshift(report);
    const state = await ensureAdminState(this);
    state.reports = this.reports;
    return report;
  }

  async getBuyerGuidesByBuyer(buyerId) {
    return this.buyerGuides
      .filter((guide) => guide.buyer_id === buyerId || guide.buyerId === buyerId)
      .sort((a, b) => Date.parse(b.updated_at || b.updatedAt || "") - Date.parse(a.updated_at || a.updatedAt || ""));
  }

  async getBuyerGuideById(id) {
    return this.buyerGuides.find((guide) => guide.id === id) || null;
  }

  async getAllBuyerGuides() {
    return this.buyerGuides.slice().sort((a, b) => Date.parse(b.updated_at || b.updatedAt || "") - Date.parse(a.updated_at || a.updatedAt || ""));
  }

  async getActiveDiscoveryBuyerGuide(buyerId) {
    return this.buyerGuides.find((guide) =>
      (guide.buyer_id === buyerId || guide.buyerId === buyerId) &&
      !(guide.listing_id || guide.listingId) &&
      String(guide.status || "active") === "active"
    ) || null;
  }

  async getActiveBuyerGuide(buyerId, listingId) {
    return this.buyerGuides.find((guide) =>
      (guide.buyer_id === buyerId || guide.buyerId === buyerId) &&
      (guide.listing_id === listingId || guide.listingId === listingId) &&
      String(guide.status || "active") === "active"
    ) || null;
  }

  async saveBuyerGuide(guide) {
    const existingIndex = this.buyerGuides.findIndex((item) => item.id === guide.id);
    if (existingIndex >= 0) {
      this.buyerGuides[existingIndex] = { ...this.buyerGuides[existingIndex], ...guide };
      return this.buyerGuides[existingIndex];
    }
    this.buyerGuides.unshift(guide);
    return guide;
  }

  async trackEvent(event) {
    this.events.unshift(event);
    return event;
  }

  async getAnalyticsEvents(params = {}) {
    const limit = Number(params.limit || 5000);
    return this.events.slice(0, limit);
  }

  async getSellers() {
    return this.sellers;
  }

  async getUserByEmail(email) {
    return null;
  }

  async getUserById(id) {
    return null;
  }

  async saveUser(user) {
    return user;
  }

  async saveCostRecord(record) {
    this.costRecords.unshift(record);
    return record;
  }

  async getCostRecords() {
    return this.costRecords.slice();
  }

  async saveFeedback(record) {
    this.feedbackRecords.unshift(record);
    return record;
  }

  async getFeedbackRecords() {
    return this.feedbackRecords.slice();
  }

  async saveFollowup(record) {
    const index = this.followupRecords.findIndex((item) =>
      item.userId === record.userId && item.listingId === record.listingId && item.conversationId === record.conversationId
    );
    if (index >= 0) this.followupRecords[index] = { ...this.followupRecords[index], ...record };
    else this.followupRecords.unshift(record);
    return record;
  }

  async getFollowupsByUser(userId) {
    return this.followupRecords.filter((record) => record.userId === userId);
  }

  async getAllFollowups() {
    return this.followupRecords.slice();
  }

  async deleteUserAccount(userId) {
    const id = String(userId || "");
    this.listings = this.listings.filter((listing) => listing.userId !== id && listing.seller?.id !== id);
    this.sellers = this.sellers.filter((seller) => seller.id !== id);
    this.buyerGuides = this.buyerGuides.filter((guide) =>
      (guide.buyer_id || guide.buyerId) !== id && (guide.seller_id || guide.sellerId) !== id
    );
    this.conversations = this.conversations.filter((conversation) =>
      conversation.buyerId !== id &&
      conversation.sellerId !== id &&
      conversation.partnerId !== id &&
      !(conversation.participants || []).includes(id)
    );
    this.favorites = this.favorites.filter((favorite) => favorite.userId !== id);
    Array.from(this.authSessions.entries()).forEach(([token, session]) => {
      if (session.userId === id) this.authSessions.delete(token);
    });
    return { deleted: true };
  }

  async saveAuthSession(session) {
    this.authSessions.set(session.token, session);
    return session;
  }

  async getActiveAuthSessions() {
    return Array.from(this.authSessions.values());
  }

  async deleteAuthSession(token) {
    this.authSessions.delete(String(token || ""));
  }

  async getUsers() {
    return [];
  }

  async getSellerById(id) {
    const seller = this.sellers.find((item) => item.id === id);
    if (!seller) return null;
    const listings = this.listings.filter((listing) =>
      listing.userId === id && isPublicMarketplaceListing(listing)
    );
    return { ...seller, listings };
  }

  async addSellerReview(sellerId, review) {
    const listings = this.listings.filter((listing) =>
      (listing.userId === sellerId || listing.seller?.id === sellerId) &&
      isPublicMarketplaceListing(listing)
    );
    const existingIndex = this.sellers.findIndex((item) => item.id === sellerId);
    const current = existingIndex >= 0
      ? this.sellers[existingIndex]
      : sellerProfileFromRecords(sellerId, null, listings);
    const next = applySellerReview(current, review);
    if (existingIndex >= 0) {
      this.sellers[existingIndex] = next;
    } else {
      this.sellers.push(next);
    }
    return { ...next, listings };
  }
}

class PostgresStore {
  constructor() {
    let Pool;
    try {
      ({ Pool } = require("pg"));
    } catch (error) {
      throw new Error("DATABASE_URL is set, but the pg package is not installed. Run npm install before starting the API.");
    }

    this.kind = "postgres";
    this.pool = new Pool({
      connectionString: postgresConnectionString(),
      ssl: process.env.DATABASE_SSL === "true" ? { rejectUnauthorized: false } : undefined
    });
    this.coreTablesReady = false;
    this.marketCacheReady = false;
  }

  async connect() {
    await this.pool.query("SELECT 1 AS ok");
    await this.ensureCoreTables();
    await this.ensureMarketCheckCacheTable();
    return {
      ok: true,
      kind: this.kind,
      databaseStatus: "connected"
    };
  }

  async healthCheck() {
    const result = await this.pool.query("SELECT 1 AS ok");
    return {
      ok: result.rows[0]?.ok === 1,
      kind: this.kind,
      databaseStatus: "connected"
    };
  }

  async ensureCoreTables() {
    if (this.coreTablesReady) return;
    await this.pool.query(`
      CREATE TABLE IF NOT EXISTS listing_records (
        id TEXT PRIMARY KEY,
        payload JSONB NOT NULL,
        is_demo BOOLEAN NOT NULL DEFAULT FALSE,
        demo_seed_id TEXT,
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);
    await this.pool.query(`ALTER TABLE listing_records ADD COLUMN IF NOT EXISTS is_demo BOOLEAN NOT NULL DEFAULT FALSE`);
    await this.pool.query(`ALTER TABLE listing_records ADD COLUMN IF NOT EXISTS demo_seed_id TEXT`);
    await this.pool.query(`
      CREATE TABLE IF NOT EXISTS conversation_records (
        id TEXT PRIMARY KEY,
        payload JSONB NOT NULL,
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);
    await this.pool.query(`
      CREATE TABLE IF NOT EXISTS seller_records (
        id TEXT PRIMARY KEY,
        payload JSONB NOT NULL,
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);
    await this.pool.query(`
      CREATE TABLE IF NOT EXISTS user_records (
        id TEXT PRIMARY KEY,
        email TEXT NOT NULL UNIQUE,
        phone_number TEXT,
        phone_verified_at TIMESTAMPTZ,
        payload JSONB NOT NULL,
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);
    await this.pool.query(`ALTER TABLE user_records ADD COLUMN IF NOT EXISTS phone_number TEXT`);
    await this.pool.query(`ALTER TABLE user_records ADD COLUMN IF NOT EXISTS phone_verified_at TIMESTAMPTZ`);
    await this.pool.query(`
      CREATE TABLE IF NOT EXISTS report_records (
        id TEXT PRIMARY KEY,
        payload JSONB NOT NULL,
        status TEXT NOT NULL DEFAULT 'open',
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);
    await this.pool.query(`
      CREATE TABLE IF NOT EXISTS analytics_events (
        id TEXT PRIMARY KEY,
        event_type TEXT NOT NULL,
        user_id TEXT,
        session_id TEXT,
        ip_hash TEXT,
        route TEXT,
        listing_id TEXT,
        metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
        user_agent TEXT,
        referrer TEXT,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);
    await this.pool.query(`
      CREATE TABLE IF NOT EXISTS audit_records (
        id TEXT PRIMARY KEY,
        payload JSONB NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);
    await this.pool.query(`ALTER TABLE analytics_events ADD COLUMN IF NOT EXISTS conversation_id TEXT`);
    await this.pool.query(`ALTER TABLE analytics_events ADD COLUMN IF NOT EXISTS related_entity_type TEXT`);
    await this.pool.query(`ALTER TABLE analytics_events ADD COLUMN IF NOT EXISTS related_entity_id TEXT`);
    await this.pool.query(`ALTER TABLE analytics_events ADD COLUMN IF NOT EXISTS city TEXT`);
    await this.pool.query(`ALTER TABLE analytics_events ADD COLUMN IF NOT EXISTS state TEXT`);
    await this.pool.query(`ALTER TABLE analytics_events ADD COLUMN IF NOT EXISTS country TEXT`);
    await this.pool.query(`
      CREATE TABLE IF NOT EXISTS verification_records (
        id TEXT PRIMARY KEY,
        user_id TEXT,
        listing_id TEXT,
        type TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'pending',
        payload JSONB NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);
    await this.pool.query(`
      CREATE TABLE IF NOT EXISTS auth_sessions (
        token TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        payload JSONB NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        last_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        expires_at TIMESTAMPTZ
      )
    `);
    await this.pool.query(`
      CREATE TABLE IF NOT EXISTS buyer_purchase_guides (
        id TEXT PRIMARY KEY,
        buyer_id TEXT,
        listing_id TEXT,
        seller_id TEXT,
        status TEXT NOT NULL DEFAULT 'active',
        current_step TEXT,
        completed_steps JSONB NOT NULL DEFAULT '[]'::jsonb,
        buyer_state TEXT,
        seller_state TEXT,
        notes JSONB NOT NULL DEFAULT '{}'::jsonb,
        payload JSONB NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);
    await this.pool.query(`
      CREATE TABLE IF NOT EXISTS favorite_records (
        user_id TEXT NOT NULL,
        listing_id TEXT NOT NULL REFERENCES listing_records(id) ON DELETE CASCADE,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        PRIMARY KEY (user_id, listing_id)
      )
    `);
    await this.pool.query(`
      CREATE TABLE IF NOT EXISTS cost_records (
        id TEXT PRIMARY KEY,
        service_name TEXT NOT NULL,
        action_type TEXT NOT NULL,
        user_id TEXT,
        listing_id TEXT,
        request_id TEXT,
        status TEXT NOT NULL,
        units_used NUMERIC,
        estimated_cost NUMERIC(12, 6) NOT NULL DEFAULT 0,
        metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);
    await this.pool.query(`
      CREATE TABLE IF NOT EXISTS feedback_records (
        id TEXT PRIMARY KEY,
        user_id TEXT,
        listing_id TEXT,
        context TEXT NOT NULL,
        rating INTEGER,
        response_text TEXT,
        metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);
    await this.pool.query(`
      CREATE TABLE IF NOT EXISTS followup_records (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        listing_id TEXT NOT NULL,
        conversation_id TEXT,
        followup_type TEXT NOT NULL,
        answer TEXT,
        feedback_text TEXT,
        dismissed BOOLEAN NOT NULL DEFAULT FALSE,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        UNIQUE (user_id, listing_id, conversation_id, followup_type)
      )
    `);
    await this.pool.query(`ALTER TABLE buyer_purchase_guides ALTER COLUMN buyer_id DROP NOT NULL`);
    await this.pool.query(`ALTER TABLE buyer_purchase_guides ALTER COLUMN listing_id DROP NOT NULL`);
    await this.pool.query(`CREATE INDEX IF NOT EXISTS idx_listing_records_status ON listing_records ((payload->>'status'))`);
    await this.pool.query(`CREATE INDEX IF NOT EXISTS idx_listing_records_vin ON listing_records ((payload->>'vin'))`);
    await this.pool.query(`CREATE INDEX IF NOT EXISTS idx_listing_records_demo ON listing_records (is_demo, updated_at DESC)`);
    await this.pool.query(`CREATE UNIQUE INDEX IF NOT EXISTS idx_listing_records_demo_seed_unique ON listing_records (demo_seed_id) WHERE demo_seed_id IS NOT NULL`);
    await this.pool.query(`CREATE INDEX IF NOT EXISTS idx_report_records_status_created ON report_records (status, created_at DESC)`);
    await this.pool.query(`CREATE INDEX IF NOT EXISTS idx_analytics_events_type_created ON analytics_events (event_type, created_at DESC)`);
    await this.pool.query(`CREATE INDEX IF NOT EXISTS idx_analytics_events_user_created ON analytics_events (user_id, created_at DESC)`);
    await this.pool.query(`CREATE INDEX IF NOT EXISTS idx_analytics_events_listing_created ON analytics_events (listing_id, created_at DESC)`);
    await this.pool.query(`CREATE INDEX IF NOT EXISTS idx_analytics_events_conversation_created ON analytics_events (conversation_id, created_at DESC)`);
    await this.pool.query(`CREATE INDEX IF NOT EXISTS idx_audit_records_created ON audit_records (created_at DESC)`);
    await this.pool.query(`CREATE INDEX IF NOT EXISTS idx_verification_records_status_updated ON verification_records (status, updated_at DESC)`);
    await this.pool.query(`CREATE INDEX IF NOT EXISTS idx_verification_records_listing ON verification_records (listing_id)`);
    await this.pool.query(`CREATE INDEX IF NOT EXISTS idx_auth_sessions_user ON auth_sessions (user_id, last_seen_at DESC)`);
    await this.pool.query(`CREATE INDEX IF NOT EXISTS idx_buyer_guides_buyer_updated ON buyer_purchase_guides (buyer_id, updated_at DESC)`);
    await this.pool.query(`CREATE UNIQUE INDEX IF NOT EXISTS idx_buyer_guides_active_unique ON buyer_purchase_guides (buyer_id, listing_id) WHERE status = 'active'`);
    await this.pool.query(`CREATE UNIQUE INDEX IF NOT EXISTS idx_buyer_guides_active_discovery_unique ON buyer_purchase_guides (buyer_id) WHERE status = 'active' AND listing_id IS NULL AND buyer_id IS NOT NULL`);
    await this.pool.query(`CREATE INDEX IF NOT EXISTS idx_favorite_records_user_created ON favorite_records (user_id, created_at DESC)`);
    await this.pool.query(`CREATE INDEX IF NOT EXISTS idx_favorite_records_listing ON favorite_records (listing_id)`);
    await this.pool.query(`CREATE INDEX IF NOT EXISTS idx_cost_records_service_created ON cost_records (service_name, created_at DESC)`);
    await this.pool.query(`CREATE INDEX IF NOT EXISTS idx_cost_records_listing ON cost_records (listing_id, created_at DESC)`);
    await this.pool.query(`CREATE INDEX IF NOT EXISTS idx_feedback_records_context_created ON feedback_records (context, created_at DESC)`);
    await this.pool.query(`CREATE INDEX IF NOT EXISTS idx_followup_records_user ON followup_records (user_id, updated_at DESC)`);
    try {
      await this.pool.query(`CREATE UNIQUE INDEX IF NOT EXISTS idx_user_records_verified_phone_unique ON user_records (phone_number) WHERE phone_number IS NOT NULL AND phone_verified_at IS NOT NULL`);
    } catch (error) {
      console.warn(`[Kerodex] Unable to create verified phone uniqueness index: ${error.message}`);
    }
    this.coreTablesReady = true;
    await this.clearExpiredPhoneVerifications();
  }

  async ensureMarketCheckCacheTable() {
    if (this.marketCacheReady) return;
    await this.pool.query(`
      CREATE TABLE IF NOT EXISTS marketcheck_cache (
        kind TEXT NOT NULL,
        cache_key TEXT NOT NULL,
        payload JSONB NOT NULL,
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        PRIMARY KEY (kind, cache_key)
      )
    `);
    this.marketCacheReady = true;
  }

  async getListings() {
    await this.ensureCoreTables();
    const result = await this.pool.query(`
      SELECT
        listing_records.payload,
        COUNT(DISTINCT favorite_records.user_id)::int AS favorites,
        COUNT(DISTINCT analytics_events.id) FILTER (WHERE analytics_events.event_type IN ('listing_view', 'listing_viewed'))::int AS views
      FROM listing_records
      LEFT JOIN favorite_records ON favorite_records.listing_id = listing_records.id
      LEFT JOIN analytics_events ON analytics_events.listing_id = listing_records.id
      GROUP BY listing_records.id, listing_records.payload, listing_records.updated_at
      ORDER BY COALESCE((listing_records.payload->>'dealScore')::int, 0) DESC, listing_records.updated_at DESC
    `);
    return result.rows.map((row) => ({ ...row.payload, favorites: row.favorites, saves: row.favorites, views: row.views }));
  }

  async getListingById(id) {
    await this.ensureCoreTables();
    const result = await this.pool.query(`
      SELECT
        listing_records.payload,
        (SELECT COUNT(*)::int FROM favorite_records WHERE listing_id = listing_records.id) AS favorites,
        (SELECT COUNT(*)::int FROM analytics_events WHERE listing_id = listing_records.id AND event_type IN ('listing_view', 'listing_viewed')) AS views
      FROM listing_records
      WHERE listing_records.id = $1
      LIMIT 1
    `, [id]);
    const row = result.rows[0];
    return row ? { ...row.payload, favorites: row.favorites, saves: row.favorites, views: row.views } : null;
  }

  async getSavedListings(userId) {
    await this.ensureCoreTables();
    const result = await this.pool.query(`
      SELECT
        listing_records.payload,
        (SELECT COUNT(*)::int FROM favorite_records all_favorites WHERE all_favorites.listing_id = listing_records.id) AS favorites,
        (SELECT COUNT(*)::int FROM analytics_events WHERE listing_id = listing_records.id AND event_type IN ('listing_view', 'listing_viewed')) AS views
      FROM favorite_records
      JOIN listing_records ON listing_records.id = favorite_records.listing_id
      WHERE favorite_records.user_id = $1
      ORDER BY favorite_records.created_at DESC
    `, [String(userId || "")]);
    return result.rows.map((row) => ({ ...row.payload, favorites: row.favorites, saves: row.favorites, views: row.views }));
  }

  async setListingSaved(userId, listingId, saved) {
    await this.ensureCoreTables();
    const listing = await this.getListingById(listingId);
    if (!listing) return null;
    if (saved) {
      await this.pool.query(
        "INSERT INTO favorite_records (user_id, listing_id) VALUES ($1, $2) ON CONFLICT (user_id, listing_id) DO NOTHING",
        [String(userId || ""), String(listingId || "")]
      );
    } else {
      await this.pool.query(
        "DELETE FROM favorite_records WHERE user_id = $1 AND listing_id = $2",
        [String(userId || ""), String(listingId || "")]
      );
    }
    return { saved, listing: await this.getListingById(listingId) };
  }

  async syncSavedListings(userId, listingIds) {
    await this.ensureCoreTables();
    const ids = Array.from(new Set(listingIds.map(String).filter(Boolean))).slice(0, 500);
    if (ids.length) {
      await this.pool.query(`
        INSERT INTO favorite_records (user_id, listing_id)
        SELECT $1, id
        FROM listing_records
        WHERE id = ANY($2::text[])
        ON CONFLICT (user_id, listing_id) DO NOTHING
      `, [String(userId || ""), ids]);
    }
    return this.getSavedListings(userId);
  }

  async createListing(listing) {
    await this.ensureCoreTables();
    await this.pool.query(
      `INSERT INTO listing_records (id, payload, is_demo, demo_seed_id, updated_at)
       VALUES ($1, $2, $3, $4, NOW())
       ON CONFLICT (id) DO UPDATE SET
         payload = EXCLUDED.payload,
         is_demo = EXCLUDED.is_demo,
         demo_seed_id = EXCLUDED.demo_seed_id,
         updated_at = NOW()`,
      [listing.id, listing, Boolean(listing.isDemo || listing.is_demo), listing.demoSeedId || null]
    );
    syncAdminListing(this, listing);
    return listing;
  }

  async getMarketCheckCache(kind, key) {
    await this.ensureMarketCheckCacheTable();
    const result = await this.pool.query(
      "SELECT payload, updated_at FROM marketcheck_cache WHERE kind = $1 AND cache_key = $2 LIMIT 1",
      [kind, key]
    );
    const row = result.rows[0];
    return row ? { kind, key, payload: row.payload, updatedAt: row.updated_at.toISOString() } : null;
  }

  async setMarketCheckCache(kind, key, payload) {
    await this.ensureMarketCheckCacheTable();
    await this.pool.query(
      `INSERT INTO marketcheck_cache (kind, cache_key, payload, updated_at)
       VALUES ($1, $2, $3, NOW())
       ON CONFLICT (kind, cache_key) DO UPDATE SET payload = EXCLUDED.payload, updated_at = NOW()`,
      [kind, key, payload]
    );
    return { kind, key, payload, updatedAt: new Date().toISOString() };
  }

  async getConversations() {
    await this.ensureCoreTables();
    const result = await this.pool.query("SELECT payload FROM conversation_records ORDER BY updated_at DESC");
    return result.rows.map((row) => row.payload);
  }

  async getConversationById(id) {
    await this.ensureCoreTables();
    const result = await this.pool.query("SELECT payload FROM conversation_records WHERE id = $1 LIMIT 1", [id]);
    return result.rows[0]?.payload || null;
  }

  async createConversation(conversation) {
    await this.ensureCoreTables();
    await this.pool.query(
      "INSERT INTO conversation_records (id, payload, updated_at) VALUES ($1, $2, NOW()) ON CONFLICT (id) DO UPDATE SET payload = EXCLUDED.payload, updated_at = NOW()",
      [conversation.id, conversation]
    );
    return conversation;
  }

  async getReports() {
    await this.ensureCoreTables();
    const result = await this.pool.query("SELECT payload FROM report_records ORDER BY created_at DESC");
    return result.rows.map((row) => row.payload);
  }

  async createReport(report) {
    await this.ensureCoreTables();
    await this.pool.query(
      `INSERT INTO report_records (id, payload, status, created_at, updated_at)
       VALUES ($1, $2, $3, NOW(), NOW())
       ON CONFLICT (id) DO UPDATE SET payload = EXCLUDED.payload, status = EXCLUDED.status, updated_at = NOW()`,
      [report.id, report, report.status || "open"]
    );
    if (this.adminState) this.adminState.reports = await this.getReports();
    return report;
  }

  async getBuyerGuidesByBuyer(buyerId) {
    await this.ensureCoreTables();
    const result = await this.pool.query(
      "SELECT payload FROM buyer_purchase_guides WHERE buyer_id = $1 ORDER BY updated_at DESC",
      [buyerId]
    );
    return result.rows.map((row) => row.payload);
  }

  async getBuyerGuideById(id) {
    await this.ensureCoreTables();
    const result = await this.pool.query("SELECT payload FROM buyer_purchase_guides WHERE id = $1 LIMIT 1", [id]);
    return result.rows[0]?.payload || null;
  }

  async getAllBuyerGuides() {
    await this.ensureCoreTables();
    const result = await this.pool.query("SELECT payload FROM buyer_purchase_guides ORDER BY updated_at DESC");
    return result.rows.map((row) => row.payload);
  }

  async getActiveDiscoveryBuyerGuide(buyerId) {
    await this.ensureCoreTables();
    const result = await this.pool.query(
      "SELECT payload FROM buyer_purchase_guides WHERE buyer_id = $1 AND listing_id IS NULL AND status = 'active' ORDER BY updated_at DESC LIMIT 1",
      [buyerId]
    );
    return result.rows[0]?.payload || null;
  }

  async getActiveBuyerGuide(buyerId, listingId) {
    await this.ensureCoreTables();
    const result = await this.pool.query(
      "SELECT payload FROM buyer_purchase_guides WHERE buyer_id = $1 AND listing_id = $2 AND status = 'active' LIMIT 1",
      [buyerId, listingId]
    );
    return result.rows[0]?.payload || null;
  }

  async saveBuyerGuide(guide) {
    await this.ensureCoreTables();
    await this.pool.query(
      `INSERT INTO buyer_purchase_guides
        (id, buyer_id, listing_id, seller_id, status, current_step, completed_steps, buyer_state, seller_state, notes, payload, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, NOW())
       ON CONFLICT (id) DO UPDATE SET
        buyer_id = EXCLUDED.buyer_id,
        listing_id = EXCLUDED.listing_id,
        seller_id = EXCLUDED.seller_id,
        status = EXCLUDED.status,
        current_step = EXCLUDED.current_step,
        completed_steps = EXCLUDED.completed_steps,
        buyer_state = EXCLUDED.buyer_state,
        seller_state = EXCLUDED.seller_state,
        notes = EXCLUDED.notes,
        payload = EXCLUDED.payload,
        updated_at = NOW()`,
      [
        guide.id,
        guide.buyer_id ?? guide.buyerId ?? null,
        guide.listing_id ?? guide.listingId ?? null,
        guide.seller_id ?? guide.sellerId ?? null,
        guide.status || "active",
        guide.current_step || guide.currentStep || "",
        guide.completed_steps || guide.completedSteps || [],
        guide.buyer_state || guide.buyerState || "",
        guide.seller_state || guide.sellerState || "",
        guide.notes || {},
        guide,
        guide.created_at || guide.createdAt || new Date().toISOString()
      ]
    );
    return guide;
  }

  async trackEvent(event) {
    await this.ensureCoreTables();
    await this.pool.query(
      `INSERT INTO analytics_events (id, event_type, user_id, session_id, ip_hash, route, listing_id, conversation_id, related_entity_type, related_entity_id, city, state, country, metadata, user_agent, referrer, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17)
       ON CONFLICT (id) DO NOTHING`,
      [
        event.id,
        event.eventType,
        event.userId || null,
        event.sessionId || null,
        event.ipHash || null,
        event.route || null,
        event.listingId || null,
        event.conversationId || null,
        event.relatedEntityType || null,
        event.relatedEntityId || null,
        event.city || null,
        event.state || null,
        event.country || null,
        event.metadata || {},
        event.userAgent || "",
        event.referrer || "",
        event.createdAt || new Date().toISOString()
      ]
    );
    return event;
  }

  async getAnalyticsEvents(params = {}) {
    await this.ensureCoreTables();
    const limit = Math.min(20000, Math.max(100, Number(params.limit || 5000)));
    const result = await this.pool.query(
      `SELECT id, event_type, user_id, session_id, ip_hash, route, listing_id, conversation_id, related_entity_type, related_entity_id, city, state, country, metadata, user_agent, referrer, created_at
       FROM analytics_events
       ORDER BY created_at DESC
       LIMIT $1`,
      [limit]
    );
    return result.rows.map((row) => ({
      id: row.id,
      eventType: row.event_type,
      userId: row.user_id || "",
      sessionId: row.session_id || "",
      ipHash: row.ip_hash || "",
      route: row.route || "",
      listingId: row.listing_id || "",
      conversationId: row.conversation_id || "",
      relatedEntityType: row.related_entity_type || "",
      relatedEntityId: row.related_entity_id || "",
      city: row.city || "",
      state: row.state || "",
      country: row.country || "",
      metadata: row.metadata || {},
      userAgent: row.user_agent || "",
      referrer: row.referrer || "",
      createdAt: row.created_at.toISOString()
    }));
  }

  async saveAuditLog(log) {
    await this.ensureCoreTables();
    await this.pool.query(
      "INSERT INTO audit_records (id, payload, created_at) VALUES ($1, $2, $3) ON CONFLICT (id) DO NOTHING",
      [log.id, log, log.timestamp || new Date().toISOString()]
    );
    return log;
  }

  async getAuditLogs() {
    await this.ensureCoreTables();
    const result = await this.pool.query("SELECT payload FROM audit_records ORDER BY created_at DESC LIMIT 5000");
    return result.rows.map((row) => row.payload);
  }

  async saveCostRecord(record) {
    await this.ensureCoreTables();
    await this.pool.query(
      `INSERT INTO cost_records (id, service_name, action_type, user_id, listing_id, request_id, status, units_used, estimated_cost, metadata, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
       ON CONFLICT (id) DO NOTHING`,
      [record.id, record.serviceName, record.actionType, record.userId || null, record.listingId || null, record.requestId || null, record.status, record.unitsUsed ?? null, record.estimatedCost || 0, record.metadata || {}, record.createdAt]
    );
    return record;
  }

  async getCostRecords() {
    await this.ensureCoreTables();
    const result = await this.pool.query("SELECT * FROM cost_records ORDER BY created_at DESC LIMIT 20000");
    return result.rows.map((row) => ({
      id: row.id,
      serviceName: row.service_name,
      actionType: row.action_type,
      userId: row.user_id || "",
      listingId: row.listing_id || "",
      requestId: row.request_id || "",
      status: row.status,
      unitsUsed: row.units_used === null ? null : Number(row.units_used),
      estimatedCost: Number(row.estimated_cost || 0),
      metadata: row.metadata || {},
      createdAt: row.created_at.toISOString()
    }));
  }

  async saveFeedback(record) {
    await this.ensureCoreTables();
    await this.pool.query(
      `INSERT INTO feedback_records (id, user_id, listing_id, context, rating, response_text, metadata, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [record.id, record.userId || null, record.listingId || null, record.context, record.rating ?? null, record.responseText || "", record.metadata || {}, record.createdAt]
    );
    return record;
  }

  async getFeedbackRecords() {
    await this.ensureCoreTables();
    const result = await this.pool.query("SELECT * FROM feedback_records ORDER BY created_at DESC LIMIT 5000");
    return result.rows.map((row) => ({
      id: row.id,
      userId: row.user_id || "",
      listingId: row.listing_id || "",
      context: row.context,
      rating: row.rating,
      responseText: row.response_text || "",
      metadata: row.metadata || {},
      createdAt: row.created_at.toISOString()
    }));
  }

  async saveFollowup(record) {
    await this.ensureCoreTables();
    await this.pool.query(
      `INSERT INTO followup_records (id, user_id, listing_id, conversation_id, followup_type, answer, feedback_text, dismissed, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW())
       ON CONFLICT (user_id, listing_id, conversation_id, followup_type) DO UPDATE SET
         answer = EXCLUDED.answer, feedback_text = EXCLUDED.feedback_text, dismissed = EXCLUDED.dismissed, updated_at = NOW()`,
      [record.id, record.userId, record.listingId, record.conversationId || "", record.followupType, record.answer || "", record.feedbackText || "", Boolean(record.dismissed), record.createdAt]
    );
    return record;
  }

  async getFollowupsByUser(userId) {
    await this.ensureCoreTables();
    const result = await this.pool.query("SELECT * FROM followup_records WHERE user_id = $1 ORDER BY updated_at DESC", [userId]);
    return result.rows.map(followupFromRow);
  }

  async getAllFollowups() {
    await this.ensureCoreTables();
    const result = await this.pool.query("SELECT * FROM followup_records ORDER BY updated_at DESC LIMIT 10000");
    return result.rows.map(followupFromRow);
  }

  async saveVerificationRequest(verification) {
    await this.ensureCoreTables();
    await this.pool.query(
      `INSERT INTO verification_records (id, user_id, listing_id, type, status, payload, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())
       ON CONFLICT (id) DO UPDATE SET
        user_id = EXCLUDED.user_id,
        listing_id = EXCLUDED.listing_id,
        type = EXCLUDED.type,
        status = EXCLUDED.status,
        payload = EXCLUDED.payload,
        updated_at = NOW()`,
      [
        verification.id,
        verification.userId || "",
        verification.listingId || "",
        verification.type || "identity",
        verification.status || "pending",
        verification,
        verification.submittedAt || verification.createdAt || new Date().toISOString()
      ]
    );
    return verification;
  }

  async getVerificationRequests() {
    await this.ensureCoreTables();
    const result = await this.pool.query("SELECT payload FROM verification_records ORDER BY updated_at DESC LIMIT 5000");
    return result.rows.map((row) => row.payload);
  }

  async getSellers() {
    await this.ensureCoreTables();
    const result = await this.pool.query("SELECT payload FROM seller_records ORDER BY payload->>'name'");
    return result.rows.map((row) => row.payload);
  }

  async getUserByEmail(email) {
    await this.ensureCoreTables();
    const result = await this.pool.query("SELECT payload, phone_number, phone_verified_at FROM user_records WHERE email = $1 LIMIT 1", [String(email || "").toLowerCase()]);
    return this.userFromRow(result.rows[0]);
  }

  async getUserById(id) {
    await this.ensureCoreTables();
    const result = await this.pool.query("SELECT payload, phone_number, phone_verified_at FROM user_records WHERE id = $1 LIMIT 1", [String(id || "")]);
    return this.userFromRow(result.rows[0]);
  }

  userFromRow(row) {
    if (!row?.payload) return null;
    const user = { ...row.payload };
    const phoneVerifiedAt = row.phone_verified_at ? row.phone_verified_at.toISOString() : "";
    const phoneIsFresh = isFreshPhoneVerification(phoneVerifiedAt);
    if (row.phone_number && phoneIsFresh) {
      user.phoneNumber = row.phone_number;
      user.phone = user.phone || row.phone_number;
      user.phoneVerified = true;
      user.phoneVerifiedAt = phoneVerifiedAt;
    } else if (row.phone_number || row.phone_verified_at || user.phoneVerified) {
      user.phone = "";
      user.phoneNumber = "";
      user.phoneVerified = false;
      user.phoneVerifiedAt = "";
    }
    return user;
  }

  async getUserByPhone(phone) {
    await this.ensureCoreTables();
    await this.clearExpiredPhoneVerifications();
    const result = await this.pool.query(
      "SELECT payload, phone_number, phone_verified_at FROM user_records WHERE phone_number = $1 AND phone_verified_at IS NOT NULL AND phone_verified_at > NOW() - INTERVAL '183 days' LIMIT 1",
      [String(phone || "")]
    );
    return this.userFromRow(result.rows[0]);
  }

  async saveUser(user) {
    await this.ensureCoreTables();
    await this.clearExpiredPhoneVerifications();
    const normalizedUser = stripExpiredPhoneVerification(user);
    const phoneNumber = normalizedUser.phoneVerified ? (normalizedUser.phoneNumber || normalizedUser.phone || null) : null;
    const phoneVerifiedAt = normalizedUser.phoneVerified && normalizedUser.phoneVerifiedAt ? normalizedUser.phoneVerifiedAt : null;
    await this.pool.query(
      `INSERT INTO user_records (id, email, phone_number, phone_verified_at, payload, updated_at)
       VALUES ($1, $2, $3, $4, $5, NOW())
       ON CONFLICT (id) DO UPDATE SET
        email = EXCLUDED.email,
        phone_number = EXCLUDED.phone_number,
        phone_verified_at = EXCLUDED.phone_verified_at,
        payload = EXCLUDED.payload,
        updated_at = NOW()`,
      [normalizedUser.id, String(normalizedUser.email || "").toLowerCase(), phoneNumber, phoneVerifiedAt, normalizedUser]
    );
    return normalizedUser;
  }

  async clearExpiredPhoneVerifications() {
    if (!this.coreTablesReady) return;
    await this.pool.query(`
      UPDATE user_records
      SET
        phone_number = NULL,
        phone_verified_at = NULL,
        payload = jsonb_set(
          jsonb_set(
            jsonb_set(
              jsonb_set(payload, '{phoneVerified}', 'false'::jsonb, true),
              '{phoneVerifiedAt}',
              '""'::jsonb,
              true
            ),
            '{phoneNumber}',
            '""'::jsonb,
            true
          ),
          '{phone}',
          '""'::jsonb,
          true
        ),
        updated_at = NOW()
      WHERE phone_verified_at IS NOT NULL
        AND phone_verified_at <= NOW() - INTERVAL '183 days'
    `);
  }

  async deleteUserAccount(userId) {
    await this.ensureCoreTables();
    const id = String(userId || "");
    const client = await this.pool.connect();
    try {
      await client.query("BEGIN");
      await client.query("DELETE FROM auth_sessions WHERE user_id = $1", [id]);
      await client.query("DELETE FROM favorite_records WHERE user_id = $1", [id]);
      await client.query("DELETE FROM buyer_purchase_guides WHERE buyer_id = $1 OR seller_id = $1", [id]);
      await client.query("DELETE FROM conversation_records WHERE payload->>'buyerId' = $1 OR payload->>'sellerId' = $1 OR payload->>'partnerId' = $1", [id]);
      await client.query("DELETE FROM listing_records WHERE payload->>'userId' = $1 OR payload->'seller'->>'id' = $1", [id]);
      await client.query("DELETE FROM seller_records WHERE id = $1", [id]);
      await client.query("DELETE FROM user_records WHERE id = $1", [id]);
      await client.query("COMMIT");
      return { deleted: true };
    } catch (error) {
      await client.query("ROLLBACK").catch(() => {});
      throw error;
    } finally {
      client.release();
    }
  }

  async saveAuthSession(session) {
    await this.ensureCoreTables();
    await this.pool.query(
      `INSERT INTO auth_sessions (token, user_id, payload, created_at, last_seen_at, expires_at)
       VALUES ($1, $2, $3, NOW(), NOW(), $4)
       ON CONFLICT (token) DO UPDATE SET user_id = EXCLUDED.user_id, payload = EXCLUDED.payload, last_seen_at = NOW(), expires_at = EXCLUDED.expires_at`,
      [session.token, session.userId, session, session.expiresAt || null]
    );
    return session;
  }

  async getActiveAuthSessions() {
    await this.ensureCoreTables();
    const result = await this.pool.query(
      `SELECT payload FROM auth_sessions
       WHERE expires_at IS NULL OR expires_at > NOW()
       ORDER BY last_seen_at DESC
       LIMIT 5000`
    );
    return result.rows.map((row) => row.payload);
  }

  async deleteAuthSession(token) {
    await this.ensureCoreTables();
    await this.pool.query("DELETE FROM auth_sessions WHERE token = $1", [String(token || "")]);
  }

  async getUsers() {
    await this.ensureCoreTables();
    const result = await this.pool.query("SELECT payload, phone_number, phone_verified_at FROM user_records ORDER BY updated_at DESC");
    return result.rows.map((row) => this.userFromRow(row)).filter(Boolean);
  }

  async getSellerById(id) {
    await this.ensureCoreTables();
    const sellerResult = await this.pool.query("SELECT payload FROM seller_records WHERE id = $1 LIMIT 1", [id]);
    let seller = sellerResult.rows[0]?.payload;
    const listingsResult = await this.pool.query(
      `SELECT payload
       FROM listing_records
       WHERE payload->>'userId' = $1
         AND payload->>'status' IN ('active', 'sold')
       ORDER BY updated_at DESC`,
      [id]
    );
    if (!seller) {
      const userResult = await this.pool.query("SELECT payload FROM user_records WHERE id = $1 LIMIT 1", [id]);
      const user = userResult.rows[0]?.payload || null;
      if (!user && !listingsResult.rows.length) return null;
      seller = sellerProfileFromRecords(id, user, listingsResult.rows.map((row) => row.payload));
      await this.pool.query(
        "INSERT INTO seller_records (id, payload, updated_at) VALUES ($1, $2, NOW()) ON CONFLICT (id) DO NOTHING",
        [id, seller]
      );
    }
    return { ...seller, listings: listingsResult.rows.map((row) => row.payload) };
  }

  async addSellerReview(sellerId, review) {
    await this.ensureCoreTables();
    const sellerResult = await this.pool.query("SELECT payload FROM seller_records WHERE id = $1 LIMIT 1", [sellerId]);
    const listingsResult = await this.pool.query(
      `SELECT payload
       FROM listing_records
       WHERE payload->>'userId' = $1
         AND payload->>'status' IN ('active', 'sold')
       ORDER BY updated_at DESC`,
      [sellerId]
    );
    const listings = listingsResult.rows.map((row) => row.payload);
    let seller = sellerResult.rows[0]?.payload;
    if (!seller) {
      const userResult = await this.pool.query("SELECT payload FROM user_records WHERE id = $1 LIMIT 1", [sellerId]);
      const user = userResult.rows[0]?.payload || null;
      if (!user && !listings.length) return null;
      seller = sellerProfileFromRecords(sellerId, user, listings);
    }
    const next = applySellerReview(seller, review);
    await this.pool.query(
      `INSERT INTO seller_records (id, payload, updated_at)
       VALUES ($1, $2, NOW())
       ON CONFLICT (id) DO UPDATE SET payload = EXCLUDED.payload, updated_at = NOW()`,
      [sellerId, next]
    );
    return { ...next, listings };
  }
}

function addAdminMethods(StoreClass) {
  StoreClass.prototype.setRuntimeUserProvider = function setRuntimeUserProvider(provider) {
    this.runtimeUserProvider = provider;
    if (!this.runtimeUserOverrides) this.runtimeUserOverrides = new Map();
  };

  StoreClass.prototype.getRuntimeAdminUsers = function getRuntimeAdminUsers() {
    if (typeof this.runtimeUserProvider !== "function") return [];
    if (!this.runtimeUserOverrides) this.runtimeUserOverrides = new Map();
    return this.runtimeUserProvider().map((user) => ({
      ...user,
      ...(this.runtimeUserOverrides.get(user.id) || {})
    }));
  };

  StoreClass.prototype.createVerificationRequest = async function createVerificationRequest(user, type, details = {}) {
    const state = await ensureAdminState(this);
    const now = new Date().toISOString();
    const existing = state.verifications.find((item) =>
      item.userId === user.id && item.type === type && item.status === "pending" &&
      (!details.listingId || item.listingId === details.listingId)
    );
    if (existing) return existing;
    const verification = {
      id: `ver_${String(state.verifications.length + 1).padStart(4, "0")}`,
      userId: user.id,
      userName: user.name || user.email,
      email: user.email,
      type,
      listingId: details.listingId || "",
      vehicleVin: details.vehicleVin || "",
      status: details.status || "pending",
      submittedAt: now,
      notes: details.notes || "",
      history: [{ at: now, action: "Submitted", actor: user.name || user.email }]
    };
    state.verifications.unshift(verification);
    if (typeof this.saveVerificationRequest === "function") {
      await this.saveVerificationRequest(verification);
    }
    state.notifications.unshift({
      id: `note_${Date.now()}`,
      type: "New Verification Submission",
      priority: "high",
      message: `${verification.userName} submitted ${type} verification for review.`,
      createdAt: now
    });
    await this.recordAdminAction({
      adminAccount: "system",
      actionType: "verification.submitted",
      targetType: "verification",
      targetId: verification.id,
      previousValue: null,
      newValue: "pending",
      notes: ""
    });
    return verification;
  };

  StoreClass.prototype.getAdminDashboard = async function getAdminDashboard(options = {}) {
    const state = await ensureAdminState(this);
    const persistedUsers = typeof this.getUsers === "function" ? (await this.getUsers()).map(toAdminUserRecord) : [];
    const allRawListings = await this.getListings();
    const includeDemo = options.includeDemo === true;
    const rawListings = includeDemo ? allRawListings : allRawListings.filter((listing) => !(listing.isDemo || listing.is_demo));
    const listings = rawListings.map(toAdminListingRecord);
    const conversations = await this.getConversations();
    const persistedVerifications = typeof this.getVerificationRequests === "function" ? await this.getVerificationRequests() : [];
    const buyerGuides = typeof this.getAllBuyerGuides === "function" ? await this.getAllBuyerGuides() : [];
    const costRecords = typeof this.getCostRecords === "function" ? await this.getCostRecords() : [];
    const feedbackRecords = typeof this.getFeedbackRecords === "function" ? await this.getFeedbackRecords() : [];
    const followups = typeof this.getAllFollowups === "function" ? await this.getAllFollowups() : [];
    state.verifications = [
      ...adminVerificationRecordsFromListings(rawListings),
      ...persistedVerifications,
      ...(this.kind === "postgres" ? [] : state.verifications)
    ].filter((item, index, arr) => arr.findIndex((candidate) => candidate.id === item.id) === index);
    const allEvents = typeof this.getAnalyticsEvents === "function" ? await this.getAnalyticsEvents({ limit: 20000 }) : [];
    const demoListingIds = new Set(allRawListings.filter((listing) => listing.isDemo || listing.is_demo).map((listing) => listing.id));
    const events = includeDemo ? allEvents : allEvents.filter((event) => !event.listingId || !demoListingIds.has(event.listingId));
    const auditLogs = typeof this.getAuditLogs === "function" ? await this.getAuditLogs() : state.auditLogs;
    const traffic = buildTrafficFromEvents(events);
    state.traffic = traffic;
    state.listings = listings;
    const runtimeUsers = this.kind === "postgres" ? [] : this.getRuntimeAdminUsers();
    const users = enrichAdminUsers(
      realAdminUsersForStore(this, persistedUsers),
      rawListings,
      conversations,
      state.reports,
      events
    );
    const today = traffic[traffic.length - 1] || { visitors: 0, pageViews: 0, sessions: 0, contacts: 0 };
    const now = Date.now();
    const startOfToday = new Date(new Date().toISOString().slice(0, 10)).getTime();
    const startOfWeek = now - 7 * 24 * 60 * 60 * 1000;
    const startOfMonth = now - 30 * 24 * 60 * 60 * 1000;
    const previousWeek = traffic.slice(-14, -7).reduce((total, day) => total + day.visitors, 0);
    const currentWeek = traffic.slice(-7).reduce((total, day) => total + day.visitors, 0);
    const previousMonth = traffic.slice(0, 15).reduce((total, day) => total + day.visitors, 0);
    const currentMonth = traffic.slice(15).reduce((total, day) => total + day.visitors, 0);
    const activeUsers24h = users.filter((user) => Date.parse(user.lastLoginAt) >= Date.now() - 24 * 60 * 60 * 1000).length;
    const activeUsers7d = users.filter((user) => Date.parse(user.lastLoginAt) >= Date.now() - 7 * 24 * 60 * 60 * 1000).length;
    const pendingVerifications = state.verifications.filter((item) => ["pending", "pending_verification", "verification_in_progress"].includes(item.status)).length;
    const reportsOpen = state.reports.filter((item) => item.status === "open").length;
    const reportsResolved = state.reports.filter((item) => ["resolved", "dismissed", "warning_sent"].includes(item.status)).length;
    const verifiedListings = listings.filter((item) => ["verified", "vehicle_presence_verified"].includes(item.verificationStatus)).length;
    const soldListings = listings.filter((item) => item.status === "sold").length;
    const averagePrice = listings.reduce((total, listing) => total + Number(listing.price || 0), 0) / Math.max(1, listings.length);
    const newListingsToday = listings.filter((listing) => occurredSince(listing.createdAt, startOfToday)).length;
    const newListingsThisWeek = listings.filter((listing) => occurredSince(listing.createdAt, startOfWeek)).length;
    const newListingsThisMonth = listings.filter((listing) => occurredSince(listing.createdAt, startOfMonth)).length;
    const newUsersToday = users.filter((user) => occurredSince(user.accountCreatedAt, startOfToday)).length;
    const signupsThisWeek = users.filter((user) => occurredSince(user.accountCreatedAt, startOfWeek)).length;
    const signupsThisMonth = users.filter((user) => occurredSince(user.accountCreatedAt, startOfMonth)).length;
    const totalMessages = conversations.reduce((total, conversation) => total + Number(conversation.messages?.length || 0), 0);
    const conversationsToday = conversations.filter((conversation) => occurredSince(conversation.createdAt || conversation.updatedAt, startOfToday)).length;
    const conversationsThisWeek = conversations.filter((conversation) => occurredSince(conversation.createdAt || conversation.updatedAt, startOfWeek)).length;
    const conversationsThisMonth = conversations.filter((conversation) => occurredSince(conversation.createdAt || conversation.updatedAt, startOfMonth)).length;
    const flaggedConversations = conversations.filter((conversation) =>
      ["needs_review", "high_risk"].includes(conversation.moderationStatus) ||
      Number(conversation.scamRiskScore || 0) >= 35
    ).length;
    const suspiciousUserIds = new Set(users.filter((user) => ["banned", "suspended"].includes(user.status)).map((user) => user.id));
    const suspiciousConversations = conversations.filter((conversation) =>
      suspiciousUserIds.has(conversation.buyerId) || suspiciousUserIds.has(conversation.sellerId)
    ).length;
    const savedVehicles = countEvents(events, ["save_listing", "listing_saved"]);
    const listingViews = countEvents(events, ["listing_view", "listing_viewed"]);
    const searchActivity = countEvents(events, "search_performed");
    const loginActivity = countEvents(events, ["login", "user_logged_in"]);
    const totalPageViews = traffic.reduce((total, day) => total + day.pageViews, 0);
    const signupConversionRate = totalPageViews ? Number(((signupsThisMonth / totalPageViews) * 100).toFixed(1)) : 0;
    const listingViewConversionRate = totalPageViews ? Number(((listingViews / totalPageViews) * 100).toFixed(1)) : 0;
    const searchToContactConversionRate = searchActivity ? Number(((countEvents(events, "send_message") / searchActivity) * 100).toFixed(1)) : 0;

    return {
      cards: {
        totalUsers: users.length,
        newUsersToday,
        newUsersThisWeek: signupsThisWeek,
        newUsersThisMonth: signupsThisMonth,
        activeUsers24h,
        activeUsers7d,
        bannedUsers: users.filter((user) => user.status === "banned").length,
        suspendedUsers: users.filter((user) => user.status === "suspended").length,
        verifiedUsers: users.filter((user) => ["approved", "email_verified"].includes(user.verificationStatus)).length,
        unverifiedUsers: users.filter((user) => !["approved", "email_verified"].includes(user.verificationStatus)).length,
        usersWithListings: users.filter((user) => user.listingCount > 0).length,
        usersWithConversations: users.filter((user) => user.conversationsCount > 0).length,
        totalListings: listings.length,
        demoListings: allRawListings.filter((listing) => listing.isDemo || listing.is_demo).length,
        realListings: listings.filter((listing) => !listing.isDemo).length,
        demoDataIncluded: includeDemo,
        activeListings: listings.filter((listing) => listing.status === "active").length,
        approvedListings: listings.filter((listing) => listing.status === "active").length,
        pendingListings: listings.filter((listing) => String(listing.status || "").includes("pending")).length,
        rejectedListings: listings.filter((listing) => String(listing.status || "").includes("rejected")).length,
        deletedListings: listings.filter((listing) => ["deleted", "removed"].includes(listing.status)).length,
        removedListings: listings.filter((listing) => listing.status === "removed").length,
        draftListings: listings.filter((listing) => listing.status === "draft").length,
        newListingsToday,
        newListingsThisWeek,
        newListingsThisMonth,
        listingsMissingPhotos: listings.filter((listing) => listing.photosCount === 0).length,
        listingsMissingVin: listings.filter((listing) => !listing.vin || String(listing.vin).startsWith("DEMO")).length,
        listingsMissingPrice: listings.filter((listing) => !Number(listing.price)).length,
        listingsMissingLocation: listings.filter((listing) => !listing.location).length,
        verifiedListings,
        pendingVerificationRequests: pendingVerifications,
        vehiclesSold: soldListings,
        totalMessages,
        messagesSentToday: today.contacts,
        totalConversations: conversations.length,
        conversationsToday,
        conversationsThisWeek,
        conversationsThisMonth,
        flaggedConversations,
        suspiciousConversations,
        reportsSubmitted: reportsOpen,
        reportsResolved,
        reportsReviewing: state.reports.filter((item) => item.status === "reviewing").length,
        reportsDismissed: state.reports.filter((item) => item.status === "dismissed").length,
        verificationAttempts: state.verifications.length,
        approvedVerifications: state.verifications.filter((item) => ["approved", "verified"].includes(item.status)).length,
        manualReviewVerifications: state.verifications.filter((item) => item.status === "manual_review_required").length,
        failedVerificationAttempts: state.verifications.filter((item) => ["rejected", "failed", "expired"].includes(item.status)).length,
        averageVerificationConfidence: (() => {
          const values = state.verifications.map((item) => Number(item.confidence)).filter(Number.isFinite);
          return values.length ? Number((values.reduce((sum, value) => sum + value, 0) / values.length).toFixed(2)) : null;
        })(),
        fraudFlagsTriggered: state.fraudFlags.filter((flag) => flag.status !== "dismissed").length,
        savedVehicles,
        listingViews,
        searchActivity,
        loginActivity,
        inspectionsRequested: state.verifications.filter((item) => item.type === "inspection").length,
        revenue: 0,
        averageTimeToSellVehicle: "Not enough data",
        buyerGuideSessions: buyerGuides.length,
        buyerGuideCompleted: buyerGuides.filter((guide) => guide.status === "completed").length,
        buyerGuideAbandoned: buyerGuides.filter((guide) => guide.status === "abandoned").length,
        buyerGuideSelectedListings: buyerGuides.filter((guide) => guide.selected_listing_id || guide.selectedListingId || guide.listing_id || guide.listingId).length,
        buyerGuideSafetyFlags: buyerGuides.reduce((total, guide) => total + Number((guide.safety_red_flags || guide.safetyRedFlags || []).length), 0)
        ,
        phoneVerificationAttempts: countEvents(events, "phone_verification_started"),
        phoneVerificationPassed: countEvents(events, "phone_verification_passed"),
        phoneVerificationFailed: countEvents(events, "phone_verification_failed"),
        personaVerificationAttempts: countEvents(events, "persona_verification_started"),
        personaVerificationPassed: countEvents(events, "persona_verification_passed"),
        personaVerificationFailed: countEvents(events, "persona_verification_failed"),
        vehiclePresenceAttempts: countEvents(events, "vehicle_presence_verification_started"),
        vehiclePresencePassed: countEvents(events, "vehicle_presence_verification_passed"),
        vehiclePresenceFailed: countEvents(events, "vehicle_presence_verification_failed"),
        soldThroughKerodex: rawListings.filter((listing) => listing.saleOutcome?.soldSource === "kerodex").length,
        soldElsewhere: rawListings.filter((listing) => listing.saleOutcome?.soldSource === "elsewhere").length,
        soldSourceUnknown: rawListings.filter((listing) => listing.status === "sold" && !["kerodex", "elsewhere"].includes(listing.saleOutcome?.soldSource)).length,
        buyerFollowupResponses: followups.filter((record) => record.followupType === "buyer_purchase" && record.answer).length,
        buyerPurchasesThroughKerodex: followups.filter((record) => record.answer === "bought_through_kerodex").length,
        buyerPurchasesElsewhere: followups.filter((record) => record.answer === "bought_elsewhere").length,
        sellerWouldUseAgainYes: rawListings.filter((listing) => listing.saleOutcome?.wouldUseAgain === "yes").length,
        estimatedCost30d: Number(costRecords.filter((record) => occurredSince(record.createdAt, startOfMonth)).reduce((sum, record) => sum + Number(record.estimatedCost || 0), 0).toFixed(4)),
        failedPaidCalls: costRecords.filter((record) => record.status === "failure").length,
        feedbackResponses: feedbackRecords.length
      },
      breakdowns: {
        listingsByStatus: Object.entries(listings.reduce((acc, listing) => {
          acc[listing.status || "unknown"] = (acc[listing.status || "unknown"] || 0) + 1;
          return acc;
        }, {})).map(([label, value]) => ({ label, value })),
        listingsByVerification: Object.entries(listings.reduce((acc, listing) => {
          const key = listing.verificationStatus || "unverified";
          acc[key] = (acc[key] || 0) + 1;
          return acc;
        }, {})).map(([label, value]) => ({ label, value })),
        reportsByCategory: Object.entries(state.reports.reduce((acc, report) => {
          const key = report.category || report.type || "other";
          acc[key] = (acc[key] || 0) + 1;
          return acc;
        }, {})).map(([label, value]) => ({ label, value })),
        adminActions: Object.entries(auditLogs.reduce((acc, log) => {
          if (log.adminAccount && log.adminAccount !== "system") {
            acc[log.actionType || "unknown"] = (acc[log.actionType || "unknown"] || 0) + 1;
          }
          return acc;
        }, {})).map(([label, value]) => ({ label, value })),
        actionsByAdmin: Object.entries(auditLogs.reduce((acc, log) => {
          const key = log.adminAccount || "system";
          acc[key] = (acc[key] || 0) + 1;
          return acc;
        }, {})).map(([label, value]) => ({ label, value })),
        mostReportedUsers: Object.entries(state.reports.reduce((acc, report) => {
          if (report.reportedUserId) acc[report.reportedUserId] = (acc[report.reportedUserId] || 0) + 1;
          return acc;
        }, {})).map(([label, value]) => ({ label, value })).sort((a, b) => b.value - a.value).slice(0, 10),
        mostReportedListings: Object.entries(state.reports.reduce((acc, report) => {
          if (report.listingId) acc[report.listingId] = (acc[report.listingId] || 0) + 1;
          return acc;
        }, {})).map(([label, value]) => ({ label, value })).sort((a, b) => b.value - a.value).slice(0, 10),
        buyerGuideRecommendedModels: Object.entries(buyerGuides.reduce((acc, guide) => {
          for (const item of guide.recommendations?.recommendedModels || []) {
            const key = [item.make, item.model].filter(Boolean).join(" ");
            if (key) acc[key] = (acc[key] || 0) + 1;
          }
          return acc;
        }, {})).map(([label, value]) => ({ label, value })).sort((a, b) => b.value - a.value).slice(0, 10),
        costsByService: Object.entries(costRecords.reduce((acc, record) => {
          acc[record.serviceName] = (acc[record.serviceName] || 0) + Number(record.estimatedCost || 0);
          return acc;
        }, {})).map(([label, value]) => ({ label, value: Number(value.toFixed(4)) })),
        feedbackByContext: Object.entries(feedbackRecords.reduce((acc, record) => {
          acc[record.context] = (acc[record.context] || 0) + 1;
          return acc;
        }, {})).map(([label, value]) => ({ label, value }))
      },
      recent: {
        users: users.slice().sort((a, b) => Date.parse(b.accountCreatedAt) - Date.parse(a.accountCreatedAt)).slice(0, 8),
        listings: listings.slice().sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt)).slice(0, 8),
        verifications: state.verifications.slice().sort((a, b) => Date.parse(b.submittedAt || b.updatedAt || "") - Date.parse(a.submittedAt || a.updatedAt || "")).slice(0, 8),
        conversations: conversations.slice().sort((a, b) => Date.parse(b.updatedAt || "") - Date.parse(a.updatedAt || "")).slice(0, 8),
        reports: state.reports.slice().sort((a, b) => Date.parse(b.createdAt || b.submittedAt || "") - Date.parse(a.createdAt || a.submittedAt || "")).slice(0, 8),
        adminActions: auditLogs.slice(0, 10)
      },
      website: {
        totalVisitors: traffic.reduce((total, day) => total + day.visitors, 0),
        uniqueVisitors: traffic.reduce((total, day) => total + day.uniqueVisitors, 0),
        pageViews: totalPageViews,
        sessions: traffic.reduce((total, day) => total + day.sessions, 0),
        visitorsToday: today.visitors,
        visitorsThisWeek: currentWeek,
        visitorsThisMonth: currentMonth,
        weekOverWeekGrowth: percent(currentWeek - previousWeek, previousWeek),
        monthOverMonthGrowth: percent(currentMonth - previousMonth, previousMonth),
        bounceRate: "Needs session tracking",
        averageSessionDuration: "Needs session tracking",
        signupConversionRate,
        listingViewConversionRate,
        searchToContactConversionRate
      },
      charts: {
        userGrowth: traffic.map((day, index) => ({ date: day.date, value: traffic.slice(0, index + 1).reduce((total, item) => total + item.signups, 0) })),
        listingGrowth: traffic.map((day, index) => ({ date: day.date, value: traffic.slice(0, index + 1).reduce((total, item) => total + item.listingsCreated, 0) })),
        visitors: traffic.map((day) => ({ date: day.date, value: day.visitors })),
        pageViews: traffic.map((day) => ({ date: day.date, value: day.pageViews })),
        signups: traffic.map((day) => ({ date: day.date, value: day.signups })),
        sales: traffic.map((day) => ({ date: day.date, value: listings.filter((listing) => listing.status === "sold" && dateKey(listing.updatedAt) === day.date).length })),
        messageVolume: traffic.map((day) => ({ date: day.date, value: day.contacts })),
        verificationApprovalRate: traffic.map((day) => ({
          date: day.date,
          value: state.verifications.length ? percent(state.verifications.filter((item) => item.status === "approved").length, state.verifications.length) : 0
        })),
        fraudTrends: traffic.map((day) => ({ date: day.date, value: state.fraudFlags.filter((flag) => dateKey(flag.detectedAt) === day.date && flag.status !== "dismissed").length })),
        heatmap: Array.from({ length: 24 }, (_, hour) => ({ hour, activity: events.filter((event) => new Date(event.createdAt).getHours() === hour).length })),
        popularMakes: makes.map((make) => ({ label: make, value: listings.filter((listing) => listing.title.startsWith(make) || listing.title.includes(` ${make} `)).length })).filter((item) => item.value > 0),
        popularModels: listings.slice(0, 8).map((listing) => ({ label: listing.title.split(" ").slice(1, 3).join(" "), value: listing.views })),
        averageListingPrice: money(averagePrice),
        averageMileageByCategory: Array.from(new Set(listings.map((listing) => listing.title.split(" ").slice(-1)[0] || "Vehicle"))).map((label) => {
          const matching = listings.filter((listing) => (listing.title.split(" ").slice(-1)[0] || "Vehicle") === label);
          return { label, value: Math.round(matching.reduce((total, listing) => total + Number(listing.mileage || 0), 0) / Math.max(1, matching.length)) };
        }),
        geographicDistribution: Array.from(new Set(listings.map((listing) => listing.location))).map((location) => ({
          label: location,
          value: listings.filter((listing) => listing.location === location).length
        })),
        deviceBreakdown: Array.from(new Set(events.map((event) => String(event.userAgent || "Unknown").split(" ")[0] || "Unknown"))).map((label) => ({
          label,
          value: events.filter((event) => String(event.userAgent || "Unknown").startsWith(label)).length
        }))
      },
      funnel: [
        { label: "Visitor", value: traffic.reduce((total, day) => total + day.visitors, 0) },
        { label: "Account Created", value: signupsThisMonth },
        { label: "Verification Started", value: state.verifications.length },
        { label: "Verification Approved", value: state.verifications.filter((item) => item.status === "approved").length },
        { label: "Listing Created", value: listings.length },
        { label: "Buyer Contacted", value: traffic.reduce((total, day) => total + day.contacts, 0) },
        { label: "Vehicle Sold", value: soldListings }
      ],
      sellerFunnel: [
        { label: "Site visits", value: traffic.reduce((total, day) => total + day.visitors, 0) },
        { label: "Signed up", value: countEvents(events, ["signup", "user_signed_up"]) },
        { label: "Listing started", value: countEvents(events, "listing_started") },
        { label: "Photos uploaded", value: countEvents(events, "listing_photos_uploaded") },
        { label: "Listing submitted", value: countEvents(events, ["create_listing", "listing_submitted"]) },
        { label: "Verification passed", value: countEvents(events, "vehicle_presence_verification_passed") },
        { label: "Listing published", value: countEvents(events, "listing_published") },
        { label: "Received view", value: new Set(events.filter((event) => ["listing_view", "listing_viewed"].includes(event.eventType)).map((event) => event.listingId).filter(Boolean)).size },
        { label: "Received save", value: new Set(events.filter((event) => ["save_listing", "listing_saved"].includes(event.eventType)).map((event) => event.listingId).filter(Boolean)).size },
        { label: "Received message", value: new Set(events.filter((event) => ["send_message", "message_sent"].includes(event.eventType)).map((event) => event.listingId).filter(Boolean)).size },
        { label: "Marked sold", value: countEvents(events, "listing_marked_sold") }
      ],
      buyerFunnel: [
        { label: "Site visits", value: traffic.reduce((total, day) => total + day.visitors, 0) },
        { label: "Search or filter", value: countEvents(events, ["search_performed", "filter_used"]) },
        { label: "Viewed listing", value: countEvents(events, ["listing_view", "listing_viewed"]) },
        { label: "Saved listing", value: countEvents(events, ["save_listing", "listing_saved"]) },
        { label: "Messaged seller", value: countEvents(events, ["send_message", "message_sent"]) },
        { label: "Follow-up answered", value: countEvents(events, "buyer_purchase_followup_answered") },
        { label: "Reported purchase", value: followups.filter((record) => ["bought_through_kerodex", "bought_elsewhere"].includes(record.answer)).length }
      ],
      futureRevenue: [
        { label: "Featured Listings", enabled: false, projectedMonthly: 0 },
        { label: "Subscription Plans", enabled: false, projectedMonthly: 0 },
        { label: "Listing Promotions", enabled: false, projectedMonthly: 0 },
        { label: "Inspection Services", enabled: false, projectedMonthly: 0 },
        { label: "Escrow Services", enabled: false, projectedMonthly: 0 },
        { label: "Advertising Revenue", enabled: false, projectedMonthly: 0 }
      ]
    };
  };

  StoreClass.prototype.searchAdmin = async function searchAdmin(query) {
    const state = await ensureAdminState(this);
    const persistedUsers = typeof this.getUsers === "function" ? (await this.getUsers()).map(toAdminUserRecord) : [];
    const users = realAdminUsersForStore(this, persistedUsers);
    const rawListings = await this.getListings();
    const listings = rawListings.map(toAdminListingRecord);
    const persistedVerifications = typeof this.getVerificationRequests === "function" ? await this.getVerificationRequests() : [];
    const verifications = [
      ...adminVerificationRecordsFromListings(rawListings),
      ...persistedVerifications,
      ...(this.kind === "postgres" ? [] : state.verifications)
    ].filter((item, index, arr) => arr.findIndex((candidate) => candidate.id === item.id) === index);
    const q = String(query || "").trim().toLowerCase();
    if (!q) return { users: [], listings: [], verifications: [], reports: [] };
    return {
      users: filterByQuery(users, q, ["fullName", "email", "phone", "id"]).slice(0, 8),
      listings: filterByQuery(listings, q, ["title", "vin", "id", "seller"]).slice(0, 8),
      verifications: filterByQuery(verifications, q, ["id", "userName", "email", "vehicleVin", "listingTitle"]).slice(0, 8),
      reports: filterByQuery(state.reports, q, ["id", "type", "reporter", "reportedUser", "listingId"]).slice(0, 8)
    };
  };

  StoreClass.prototype.getAdminActivity = async function getAdminActivity(params = new URLSearchParams()) {
    const events = typeof this.getAnalyticsEvents === "function" ? await this.getAnalyticsEvents({ limit: 20000 }) : [];
    const auditLogs = typeof this.getAuditLogs === "function" ? await this.getAuditLogs() : [];
    let items = platformActivityRecords(events, auditLogs);
    const q = String(params.get("q") || "").trim().toLowerCase();
    const eventType = String(params.get("eventType") || "").trim();
    const userId = String(params.get("userId") || "").trim();
    const listingId = String(params.get("listingId") || "").trim();
    const source = String(params.get("source") || "").trim();
    const dateFrom = Date.parse(params.get("dateFrom") || "");
    const dateTo = Date.parse(params.get("dateTo") || "");
    if (q) {
      items = items.filter((item) => JSON.stringify(item).toLowerCase().includes(q));
    }
    if (eventType) items = items.filter((item) => item.eventType === eventType);
    if (userId) items = items.filter((item) => item.actorUserId === userId || item.targetUserId === userId);
    if (listingId) items = items.filter((item) => item.listingId === listingId);
    if (source) items = items.filter((item) => item.source === source);
    if (Number.isFinite(dateFrom)) items = items.filter((item) => Date.parse(item.createdAt) >= dateFrom);
    if (Number.isFinite(dateTo)) items = items.filter((item) => Date.parse(item.createdAt) <= dateTo + 24 * 60 * 60 * 1000 - 1);
    const page = Math.max(1, Number(params.get("page") || 1));
    const pageSize = Math.min(100, Math.max(10, Number(params.get("pageSize") || 50)));
    const start = (page - 1) * pageSize;
    return {
      items: items.slice(start, start + pageSize),
      total: items.length,
      page,
      pageSize,
      eventTypes: Array.from(new Set(platformActivityRecords(events, auditLogs).map((item) => item.eventType))).sort()
    };
  };

  StoreClass.prototype.getAdminCollection = async function getAdminCollection(name, params = new URLSearchParams()) {
    const state = await ensureAdminState(this);
    const persistedUsers = typeof this.getUsers === "function" ? (await this.getUsers()).map(toAdminUserRecord) : [];
    const rawListings = await this.getListings();
    const conversations = await this.getConversations();
    const events = typeof this.getAnalyticsEvents === "function" ? await this.getAnalyticsEvents({ limit: 20000 }) : [];
    const users = enrichAdminUsers(realAdminUsersForStore(this, persistedUsers), rawListings, conversations, state.reports, events);
    const listings = rawListings.map(toAdminListingRecord);
    const persistedVerifications = typeof this.getVerificationRequests === "function" ? await this.getVerificationRequests() : [];
    const verifications = [
      ...adminVerificationRecordsFromListings(rawListings),
      ...persistedVerifications,
      ...(this.kind === "postgres" ? [] : state.verifications)
    ].filter((item, index, arr) => arr.findIndex((candidate) => candidate.id === item.id) === index);
    state.listings = listings;
    state.verifications = verifications;
    if (typeof this.getAuditLogs === "function") state.auditLogs = await this.getAuditLogs();
    const q = params.get("q") || "";
    const status = params.get("status") || "";
    const collections = {
      users: filterByQuery(users, q, ["fullName", "email", "phone", "id"]),
      listings: filterByQuery(listings, q, ["title", "vin", "id", "seller", "location"]),
      verifications: filterByQuery(verifications, q, ["id", "userName", "email", "vehicleVin", "listingTitle"]),
      reports: filterByQuery(state.reports, q, ["id", "type", "reporter", "reportedUser", "listingId"]),
      fraudFlags: filterByQuery(state.fraudFlags, q, ["id", "reason", "listingId", "userId"]),
      auditLogs: state.auditLogs,
      notifications: state.notifications,
      tickets: state.tickets,
      featureFlags: state.featureFlags
    };
    let items = collections[name] || [];
    if (status) {
      items = items.filter((item) =>
        (status === "demo" && item.isDemo) ||
        (status === "real" && !item.isDemo) ||
        item.status === status ||
        item.verificationStatus === status ||
        item.riskLevel === status
      );
    }
    const page = Math.max(1, Number(params.get("page") || 1));
    const pageSize = Math.min(100, Math.max(10, Number(params.get("pageSize") || 25)));
    const start = (page - 1) * pageSize;
    return { items: items.slice(start, start + pageSize), total: items.length, page, pageSize };
  };

  StoreClass.prototype.getAdminItem = async function getAdminItem(collection, id) {
    const state = await ensureAdminState(this);
    const persistedUsers = typeof this.getUsers === "function" ? (await this.getUsers()).map(toAdminUserRecord) : [];
    const rawListings = await this.getListings();
    const conversations = await this.getConversations();
    const events = typeof this.getAnalyticsEvents === "function" ? await this.getAnalyticsEvents({ limit: 20000 }) : [];
    const auditLogs = typeof this.getAuditLogs === "function" ? await this.getAuditLogs() : state.auditLogs;
    const users = enrichAdminUsers(realAdminUsersForStore(this, persistedUsers), rawListings, conversations, state.reports, events);
    const listings = rawListings.map(toAdminListingRecord);
    const persistedVerifications = typeof this.getVerificationRequests === "function" ? await this.getVerificationRequests() : [];
    const verifications = [
      ...adminVerificationRecordsFromListings(rawListings),
      ...persistedVerifications,
      ...(this.kind === "postgres" ? [] : state.verifications)
    ].filter((item, index, arr) => arr.findIndex((candidate) => candidate.id === item.id) === index);
    const map = {
      users,
      listings,
      verifications,
      reports: state.reports,
      fraudFlags: state.fraudFlags
    };
    const item = (map[collection] || []).find((candidate) => candidate.id === id);
    if (!item) return null;
    if (collection === "users") {
      return {
        ...item,
        listings: rawListings.filter((listing) => listing.userId === id || listing.seller?.id === id).map(toAdminListingRecord),
        conversations: conversations.filter((conversation) => conversation.buyerId === id || conversation.sellerId === id),
        reports: state.reports.filter((report) => report.reporterId === id || report.reportedUserId === id),
        activity: platformActivityRecords(events, auditLogs).filter((event) => event.actorUserId === id || event.targetUserId === id).slice(0, 100),
        adminActions: auditLogs.filter((log) => log.targetId === id).slice(0, 100)
      };
    }
    if (collection === "listings") {
      return {
        ...item,
        rawListing: rawListings.find((listing) => listing.id === id),
        sellerRecord: users.find((user) => user.id === item.userId) || item.sellerRecord,
        conversations: conversations.filter((conversation) => conversation.listingId === id),
        reports: state.reports.filter((report) => report.listingId === id),
        activity: platformActivityRecords(events, auditLogs).filter((event) => event.listingId === id).slice(0, 100),
        adminActions: auditLogs.filter((log) => log.targetId === id).slice(0, 100)
      };
    }
    if (collection === "reports") {
      return {
        ...item,
        relatedUser: users.find((user) => user.id === item.reportedUserId) || null,
        relatedListing: listings.find((listing) => listing.id === item.listingId) || null,
        adminActions: auditLogs.filter((log) => log.targetId === id).slice(0, 100)
      };
    }
    return item;
  };

  StoreClass.prototype.recordAdminAction = async function recordAdminAction({ adminAccount, actionType, targetType, targetId, previousValue, newValue, notes }) {
    const state = await ensureAdminState(this);
    const log = {
      id: `audit_${String(state.auditLogs.length + 1).padStart(4, "0")}`,
      timestamp: new Date().toISOString(),
      adminAccount,
      actionType,
      targetType,
      targetId,
      previousValue,
      newValue,
      notes: notes || "",
      immutable: true
    };
    state.auditLogs.unshift(log);
    if (typeof this.saveAuditLog === "function") await this.saveAuditLog(log);
    return log;
  };

  StoreClass.prototype.applyAdminAction = async function applyAdminAction(collection, id, action, adminAccount, notes = "") {
    const item = await this.getAdminItem(collection, id);
    if (!item) return null;
    const previous = JSON.stringify({ status: item.status, verificationStatus: item.verificationStatus, shadowBanned: item.shadowBanned });
    if (collection === "users") {
      if (action === "suspend") item.status = "suspended";
      if (action === "unsuspend") item.status = "active";
      if (action === "ban") item.status = "banned";
      if (action === "unban") item.status = "active";
      if (action === "delete") item.status = "deleted";
      if (action === "restore") item.status = "active";
      if (action === "approve") item.status = "active";
      if (action === "shadow_ban") item.shadowBanned = true;
      if (action === "remove_shadow_ban") item.shadowBanned = false;
      if (action === "disable_messaging") item.messagingDisabled = true;
      if (action === "enable_messaging") item.messagingDisabled = false;
      if (action === "disable_listing_creation") item.listingCreationDisabled = true;
      if (action === "enable_listing_creation") item.listingCreationDisabled = false;
      if (action === "reset_verification") item.verificationStatus = "not_started";
      if (action === "verify_email") item.verificationStatus = "email_verified";
      if (action === "verify_phone") item.phoneVerified = true;
      if (action === "force_password_reset") item.passwordResetRequired = true;
      if (action === "add_note") item.internalNotes = [item.internalNotes, notes].filter(Boolean).join("\n");
      if (typeof this.getUserById === "function" && typeof this.saveUser === "function") {
        const appUser = await this.getUserById(item.id);
        if (appUser) {
          await this.saveUser({
            ...appUser,
            status: item.status,
            shadowBanned: Boolean(item.shadowBanned),
            messagingDisabled: Boolean(item.messagingDisabled),
            listingCreationDisabled: Boolean(item.listingCreationDisabled),
            passwordResetRequired: Boolean(item.passwordResetRequired),
            internalNotes: item.internalNotes || appUser.internalNotes || "",
            emailVerified: action === "verify_email" ? true : appUser.emailVerified,
            phoneVerified: action === "verify_phone" ? true : appUser.phoneVerified,
            updatedAt: new Date().toISOString()
          });
        }
      }
      const state = await ensureAdminState(this);
      const isSeedUser = state.users.some((user) => user.id === item.id);
      if (!isSeedUser) {
        if (!this.runtimeUserOverrides) this.runtimeUserOverrides = new Map();
        this.runtimeUserOverrides.set(item.id, {
          status: item.status,
          shadowBanned: item.shadowBanned,
          messagingDisabled: item.messagingDisabled,
          listingCreationDisabled: item.listingCreationDisabled,
          verificationStatus: item.verificationStatus,
          passwordResetRequired: item.passwordResetRequired,
          internalNotes: item.internalNotes
        });
      }
    }
    if (collection === "listings") {
      if (action === "remove") item.status = "removed";
      if (action === "restore") item.status = "active";
      if (action === "approve") item.status = "active";
      if (action === "reject") item.status = "rejected";
      if (action === "feature") item.featured = true;
      if (action === "unfeature") item.featured = false;
      if (action === "flag") item.status = "flagged";
      if (action === "mark_sold") item.status = "sold";
      if (action === "delete") item.status = "deleted";
      const listing = await this.getListingById(item.id);
      if (listing) {
        const nextListing = {
          ...listing,
          status: item.status,
          featured: item.featured,
          adminNotes: [listing.adminNotes, notes].filter(Boolean).join("\n"),
          history: [
            ...(listing.history || []),
            { at: new Date().toISOString(), action: `admin.${action}`, actor: adminAccount, notes }
          ],
          updatedAt: new Date().toISOString()
        };
        await this.createListing(nextListing);
      }
    }
    if (collection === "verifications") {
      if (action === "approve") item.status = "approved";
      if (action === "reject") item.status = "rejected";
      if (action === "request_resubmission") item.status = "pending";
      if (notes) item.notes = [item.notes, notes].filter(Boolean).join("\n");
      item.reviewedAt = new Date().toISOString();
      item.reviewedBy = adminAccount;
      if (item.type === "vehicle_presence" && item.listingId) {
        const listing = await this.getListingById(item.listingId);
        if (listing) {
          const now = new Date().toISOString();
          let next = listing;
          if (action === "approve") {
            next = {
              ...listing,
              status: "active",
              verificationStatus: "vehicle_presence_verified",
              vehiclePresenceVerified: true,
              photoChallengeVerified: true,
              livePhotoVerified: true,
              challengeCodeVerified: true,
              photoChallengeCompletedAt: now,
              badges: Array.from(new Set([...(listing.badges || []), "Vehicle Presence Verified"].filter(Boolean))),
              vehiclePresence: {
                ...(listing.vehiclePresence || {}),
                verification_status: "verified",
                verificationStatus: "verified",
                verified_at: now,
                verifiedAt: now,
                manualReviewNotes: notes || "",
                reviewedAt: now
              },
              updatedAt: now
            };
          }
          if (action === "reject" || action === "request_resubmission") {
            next = {
              ...listing,
              status: "pending_verification",
              verificationStatus: action === "reject" ? "rejected_code_mismatch" : "pending_verification",
              vehiclePresenceVerified: false,
              photoChallengeVerified: false,
              livePhotoVerified: false,
              challengeCodeVerified: false,
              vehiclePresence: {
                ...(listing.vehiclePresence || {}),
                verification_status: action === "reject" ? "rejected_code_mismatch" : "pending_verification",
                verificationStatus: action === "reject" ? "rejected_code_mismatch" : "pending_verification",
                manualReviewNotes: notes || "Upload a new verification photo.",
                reviewedAt: now
              },
              updatedAt: now
            };
          }
          await this.createListing(next);
        }
      }
      if (typeof this.saveVerificationRequest === "function") {
        await this.saveVerificationRequest(item);
      }
    }
    if (collection === "reports") {
      if (action === "review") item.status = "reviewing";
      if (action === "resolve") item.status = "resolved";
      if (action === "dismiss") item.status = "dismissed";
      if (action === "warn_user") item.status = "warning_sent";
      if (action === "escalate") item.status = "escalated";
      item.reviewedAt = new Date().toISOString();
      item.adminNotes = [item.adminNotes, notes].filter(Boolean).join("\n");
      if (typeof this.createReport === "function") await this.createReport(item);
    }
    if (collection === "fraudFlags") {
      if (action === "dismiss") item.status = "dismissed";
      if (action === "escalate") item.status = "escalated";
      if (action === "mark_fraud_confirmed") item.status = "confirmed";
    }
    const auditLog = await this.recordAdminAction({
      adminAccount,
      actionType: `${collection}.${action}`,
      targetType: collection,
      targetId: id,
      previousValue: previous,
      newValue: JSON.stringify({ status: item.status, verificationStatus: item.verificationStatus, shadowBanned: item.shadowBanned }),
      notes
    });
    return { item, auditLog };
  };

  StoreClass.prototype.getAdminSystem = async function getAdminSystem() {
    let databaseStatus = this.kind === "postgres" ? "connected" : "json fallback";
    let apiStatus = "healthy";
    let events = [];
    let auditLogs = [];
    try {
      if (typeof this.healthCheck === "function") {
        const health = await this.healthCheck();
        databaseStatus = health.databaseStatus || databaseStatus;
      }
      events = typeof this.getAnalyticsEvents === "function" ? await this.getAnalyticsEvents({ limit: 1000 }) : [];
      auditLogs = typeof this.getAuditLogs === "function" ? await this.getAuditLogs() : [];
    } catch (error) {
      databaseStatus = "unreachable";
      apiStatus = "degraded";
    }
    const recentErrors = auditLogs.filter((log) =>
      String(log.actionType || "").includes("error") ||
      String(log.newValue || "").toLowerCase().includes("failed")
    ).length;
    return {
      serverStatus: "online",
      databaseStatus,
      storageUsage: "Use AWS/S3 console",
      apiStatus,
      recentErrors,
      failedJobs: events.filter((event) => event.eventType === "verification_failed").length,
      authenticationErrors: events.filter((event) => event.eventType === "auth_failed").length,
      uploadFailures: events.filter((event) => event.eventType === "upload_failed").length,
      failedVinLookups: events.filter((event) => event.eventType === "vin_decode_failed").length,
      analyticsEventsStored: events.length,
      alerts: [
        { level: "high", message: "Message review requires a moderation reason." },
        { level: "high", message: "Sensitive admin actions require a reason." },
        { level: "medium", message: "Exports and admin actions are logged in audit history." }
      ]
    };
  };

  StoreClass.prototype.exportAdminCollection = async function exportAdminCollection(name) {
    const state = await ensureAdminState(this);
    const persistedUsers = typeof this.getUsers === "function" ? (await this.getUsers()).map(toAdminUserRecord) : [];
    const users = realAdminUsersForStore(this, persistedUsers);
    const rawListings = await this.getListings();
    const listings = rawListings.map(toAdminListingRecord);
    const persistedVerifications = typeof this.getVerificationRequests === "function" ? await this.getVerificationRequests() : [];
    const verifications = [
      ...adminVerificationRecordsFromListings(rawListings),
      ...persistedVerifications,
      ...(this.kind === "postgres" ? [] : state.verifications)
    ].filter((item, index, arr) => arr.findIndex((candidate) => candidate.id === item.id) === index);
    if (typeof this.getAuditLogs === "function") state.auditLogs = await this.getAuditLogs();
    const map = {
      users,
      listings,
      verifications,
      reports: state.reports,
      fraudFlags: state.fraudFlags,
      auditLogs: state.auditLogs
    };
    return toCsv(map[name] || []);
  };
}

addAdminMethods(JsonStore);
addAdminMethods(PostgresStore);

module.exports = USE_DATABASE ? new PostgresStore() : new JsonStore();
