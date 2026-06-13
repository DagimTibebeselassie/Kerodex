const fs = require("fs");
const path = require("path");

const SEED_DIR = path.resolve(__dirname, "seed");
const USE_DATABASE = Boolean(process.env.DATABASE_URL);
const REQUIRE_DATABASE = process.env.REQUIRE_DATABASE === "true";

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
    seller: listing.seller?.name || "Kerodex Seller",
    vin: listing.vin || `DEMO${String(index + 1).padStart(13, "0")}`,
    title: listing.title,
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

function dateKey(iso) {
  return new Date(iso || Date.now()).toISOString().slice(0, 10);
}

function countEvents(events, type, sinceMs = 0) {
  return events.filter((event) =>
    (!type || event.eventType === type) &&
    (!sinceMs || Date.parse(event.createdAt) >= sinceMs)
  ).length;
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
    this.marketCheckCache = new Map();
    this.authSessions = new Map();
  }

  async getListings() {
    return this.listings;
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
    return this.listings.find((listing) => listing.id === id);
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
    const listings = this.listings.filter((listing) => listing.userId === id);
    return { ...seller, listings };
  }

  async addSellerReview(sellerId, review) {
    const listings = this.listings.filter((listing) => listing.userId === sellerId || listing.seller?.id === sellerId);
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
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);
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
        payload JSONB NOT NULL,
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);
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
    await this.pool.query(`CREATE INDEX IF NOT EXISTS idx_listing_records_status ON listing_records ((payload->>'status'))`);
    await this.pool.query(`CREATE INDEX IF NOT EXISTS idx_listing_records_vin ON listing_records ((payload->>'vin'))`);
    await this.pool.query(`CREATE INDEX IF NOT EXISTS idx_report_records_status_created ON report_records (status, created_at DESC)`);
    await this.pool.query(`CREATE INDEX IF NOT EXISTS idx_analytics_events_type_created ON analytics_events (event_type, created_at DESC)`);
    await this.pool.query(`CREATE INDEX IF NOT EXISTS idx_audit_records_created ON audit_records (created_at DESC)`);
    await this.pool.query(`CREATE INDEX IF NOT EXISTS idx_auth_sessions_user ON auth_sessions (user_id, last_seen_at DESC)`);
    this.coreTablesReady = true;
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
    const result = await this.pool.query("SELECT payload FROM listing_records ORDER BY COALESCE((payload->>'dealScore')::int, 0) DESC, updated_at DESC");
    return result.rows.map((row) => row.payload);
  }

  async getListingById(id) {
    await this.ensureCoreTables();
    const result = await this.pool.query("SELECT payload FROM listing_records WHERE id = $1 LIMIT 1", [id]);
    return result.rows[0]?.payload;
  }

  async createListing(listing) {
    await this.ensureCoreTables();
    await this.pool.query(
      "INSERT INTO listing_records (id, payload, updated_at) VALUES ($1, $2, NOW()) ON CONFLICT (id) DO UPDATE SET payload = EXCLUDED.payload, updated_at = NOW()",
      [listing.id, listing]
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

  async trackEvent(event) {
    await this.ensureCoreTables();
    await this.pool.query(
      `INSERT INTO analytics_events (id, event_type, user_id, session_id, ip_hash, route, listing_id, metadata, user_agent, referrer, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
       ON CONFLICT (id) DO NOTHING`,
      [
        event.id,
        event.eventType,
        event.userId || null,
        event.sessionId || null,
        event.ipHash || null,
        event.route || null,
        event.listingId || null,
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
      `SELECT id, event_type, user_id, session_id, ip_hash, route, listing_id, metadata, user_agent, referrer, created_at
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

  async getSellers() {
    await this.ensureCoreTables();
    const result = await this.pool.query("SELECT payload FROM seller_records ORDER BY payload->>'name'");
    return result.rows.map((row) => row.payload);
  }

  async getUserByEmail(email) {
    await this.ensureCoreTables();
    const result = await this.pool.query("SELECT payload FROM user_records WHERE email = $1 LIMIT 1", [String(email || "").toLowerCase()]);
    return result.rows[0]?.payload || null;
  }

  async getUserById(id) {
    await this.ensureCoreTables();
    const result = await this.pool.query("SELECT payload FROM user_records WHERE id = $1 LIMIT 1", [String(id || "")]);
    return result.rows[0]?.payload || null;
  }

  async saveUser(user) {
    await this.ensureCoreTables();
    await this.pool.query(
      `INSERT INTO user_records (id, email, payload, updated_at)
       VALUES ($1, $2, $3, NOW())
       ON CONFLICT (id) DO UPDATE SET email = EXCLUDED.email, payload = EXCLUDED.payload, updated_at = NOW()`,
      [user.id, String(user.email || "").toLowerCase(), user]
    );
    return user;
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
    const result = await this.pool.query("SELECT payload FROM user_records ORDER BY updated_at DESC");
    return result.rows.map((row) => row.payload);
  }

  async getSellerById(id) {
    await this.ensureCoreTables();
    const sellerResult = await this.pool.query("SELECT payload FROM seller_records WHERE id = $1 LIMIT 1", [id]);
    let seller = sellerResult.rows[0]?.payload;
    const listingsResult = await this.pool.query("SELECT payload FROM listing_records WHERE payload->>'userId' = $1 ORDER BY updated_at DESC", [id]);
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
    const listingsResult = await this.pool.query("SELECT payload FROM listing_records WHERE payload->>'userId' = $1 ORDER BY updated_at DESC", [sellerId]);
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

  StoreClass.prototype.getAdminDashboard = async function getAdminDashboard() {
    const state = await ensureAdminState(this);
    const persistedUsers = typeof this.getUsers === "function" ? (await this.getUsers()).map(toAdminUserRecord) : [];
    const listings = (await this.getListings()).map(toAdminListingRecord);
    const conversations = await this.getConversations();
    const events = typeof this.getAnalyticsEvents === "function" ? await this.getAnalyticsEvents({ limit: 20000 }) : [];
    const traffic = buildTrafficFromEvents(events);
    state.traffic = traffic;
    state.listings = listings;
    const runtimeUsers = this.getRuntimeAdminUsers();
    const userMap = new Map([...state.users, ...persistedUsers, ...runtimeUsers].map((user) => [user.email || user.id, user]));
    const users = Array.from(userMap.values());
    const today = traffic[traffic.length - 1] || { visitors: 0, pageViews: 0, sessions: 0, contacts: 0 };
    const previousWeek = traffic.slice(-14, -7).reduce((total, day) => total + day.visitors, 0);
    const currentWeek = traffic.slice(-7).reduce((total, day) => total + day.visitors, 0);
    const previousMonth = traffic.slice(0, 15).reduce((total, day) => total + day.visitors, 0);
    const currentMonth = traffic.slice(15).reduce((total, day) => total + day.visitors, 0);
    const activeUsers24h = users.filter((user) => Date.parse(user.lastLoginAt) >= Date.now() - 24 * 60 * 60 * 1000).length;
    const activeUsers7d = users.filter((user) => Date.parse(user.lastLoginAt) >= Date.now() - 7 * 24 * 60 * 60 * 1000).length;
    const pendingVerifications = state.verifications.filter((item) => item.status === "pending").length;
    const reportsOpen = state.reports.filter((item) => item.status === "open").length;
    const reportsResolved = state.reports.filter((item) => ["resolved", "dismissed", "warning_sent"].includes(item.status)).length;
    const verifiedListings = listings.filter((item) => ["verified", "vehicle_presence_verified"].includes(item.verificationStatus)).length;
    const soldListings = listings.filter((item) => item.status === "sold").length;
    const averagePrice = listings.reduce((total, listing) => total + Number(listing.price || 0), 0) / Math.max(1, listings.length);
    const todayStamp = new Date().toISOString().slice(0, 10);
    const newListingsToday = listings.filter((listing) => String(listing.updatedAt || "").startsWith(todayStamp)).length;
    const runtimeNewUsersToday = runtimeUsers.filter((user) => String(user.accountCreatedAt || "").startsWith(todayStamp)).length;
    const runtimeNewUsersThisWeek = runtimeUsers.filter((user) => Date.parse(user.accountCreatedAt) >= Date.now() - 7 * 24 * 60 * 60 * 1000).length;
    const newUsersToday = users.filter((user) => String(user.accountCreatedAt || "").startsWith(todayStamp)).length;
    const signupsThisWeek = traffic.slice(-7).reduce((total, day) => total + day.signups, 0) + runtimeNewUsersThisWeek;
    const signupsThisMonth = traffic.reduce((total, day) => total + day.signups, 0) + persistedUsers.length + runtimeUsers.length;
    const totalMessages = conversations.reduce((total, conversation) => total + Number(conversation.messages?.length || 0), 0);
    const savedVehicles = countEvents(events, "save_listing");
    const listingViews = countEvents(events, "listing_view");
    const searchActivity = countEvents(events, "search_performed");
    const loginActivity = countEvents(events, "login");
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
        verifiedUsers: users.filter((user) => ["approved", "email_verified"].includes(user.verificationStatus)).length,
        totalListings: listings.length,
        activeListings: listings.filter((listing) => listing.status === "active").length,
        pendingListings: listings.filter((listing) => String(listing.status || "").includes("pending")).length,
        rejectedListings: listings.filter((listing) => String(listing.status || "").includes("rejected")).length,
        deletedListings: listings.filter((listing) => ["deleted", "removed"].includes(listing.status)).length,
        newListingsToday,
        verifiedListings,
        pendingVerificationRequests: pendingVerifications,
        vehiclesSold: soldListings,
        totalMessages,
        messagesSentToday: today.contacts,
        totalConversations: conversations.length,
        reportsSubmitted: reportsOpen,
        reportsResolved,
        verificationAttempts: state.verifications.length,
        failedVerificationAttempts: state.verifications.filter((item) => ["rejected", "failed", "expired"].includes(item.status)).length,
        fraudFlagsTriggered: state.fraudFlags.filter((flag) => flag.status !== "dismissed").length,
        savedVehicles,
        listingViews,
        searchActivity,
        loginActivity,
        inspectionsRequested: state.verifications.filter((item) => item.type === "inspection").length,
        revenue: 0,
        averageTimeToSellVehicle: "Not enough data"
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
    const users = [...state.users, ...persistedUsers, ...this.getRuntimeAdminUsers()];
    const listings = (await this.getListings()).map(toAdminListingRecord);
    const q = String(query || "").trim().toLowerCase();
    if (!q) return { users: [], listings: [], verifications: [], reports: [] };
    return {
      users: filterByQuery(users, q, ["fullName", "email", "phone", "id"]).slice(0, 8),
      listings: filterByQuery(listings, q, ["title", "vin", "id", "seller"]).slice(0, 8),
      verifications: filterByQuery(state.verifications, q, ["id", "userName", "email", "vehicleVin"]).slice(0, 8),
      reports: filterByQuery(state.reports, q, ["id", "type", "reporter", "reportedUser", "listingId"]).slice(0, 8)
    };
  };

  StoreClass.prototype.getAdminCollection = async function getAdminCollection(name, params = new URLSearchParams()) {
    const state = await ensureAdminState(this);
    const persistedUsers = typeof this.getUsers === "function" ? (await this.getUsers()).map(toAdminUserRecord) : [];
    const users = [...state.users, ...persistedUsers, ...this.getRuntimeAdminUsers()];
    const listings = (await this.getListings()).map(toAdminListingRecord);
    state.listings = listings;
    if (typeof this.getAuditLogs === "function") state.auditLogs = await this.getAuditLogs();
    const q = params.get("q") || "";
    const status = params.get("status") || "";
    const collections = {
      users: filterByQuery(users, q, ["fullName", "email", "phone", "id"]),
      listings: filterByQuery(listings, q, ["title", "vin", "id", "seller"]),
      verifications: filterByQuery(state.verifications, q, ["id", "userName", "email", "vehicleVin"]),
      reports: filterByQuery(state.reports, q, ["id", "type", "reporter", "reportedUser", "listingId"]),
      fraudFlags: filterByQuery(state.fraudFlags, q, ["id", "reason", "listingId", "userId"]),
      auditLogs: state.auditLogs,
      notifications: state.notifications,
      tickets: state.tickets,
      featureFlags: state.featureFlags
    };
    let items = collections[name] || [];
    if (status) {
      items = items.filter((item) => item.status === status || item.verificationStatus === status || item.riskLevel === status);
    }
    const page = Math.max(1, Number(params.get("page") || 1));
    const pageSize = Math.min(100, Math.max(10, Number(params.get("pageSize") || 25)));
    const start = (page - 1) * pageSize;
    return { items: items.slice(start, start + pageSize), total: items.length, page, pageSize };
  };

  StoreClass.prototype.getAdminItem = async function getAdminItem(collection, id) {
    const state = await ensureAdminState(this);
    const persistedUsers = typeof this.getUsers === "function" ? (await this.getUsers()).map(toAdminUserRecord) : [];
    const users = [...state.users, ...persistedUsers, ...this.getRuntimeAdminUsers()];
    const listings = (await this.getListings()).map(toAdminListingRecord);
    const map = {
      users,
      listings,
      verifications: state.verifications,
      reports: state.reports,
      fraudFlags: state.fraudFlags
    };
    return (map[collection] || []).find((item) => item.id === id);
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
    }
    if (collection === "reports") {
      if (action === "resolve") item.status = "resolved";
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
    const users = [...state.users, ...persistedUsers, ...this.getRuntimeAdminUsers()];
    const listings = (await this.getListings()).map(toAdminListingRecord);
    if (typeof this.getAuditLogs === "function") state.auditLogs = await this.getAuditLogs();
    const map = {
      users,
      listings,
      verifications: state.verifications,
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
