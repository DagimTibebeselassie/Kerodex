const fs = require("fs");
const path = require("path");

const SEED_DIR = path.resolve(__dirname, "seed");
const USE_DATABASE = Boolean(process.env.DATABASE_URL);

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

async function ensureAdminState(store) {
  if (!store.adminState) {
    const listings = await store.getListings();
    const conversations = await store.getConversations();
    store.adminState = buildAdminState(listings, conversations);
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
    this.kind = "json";
    this.listings = readJsonFile("listings.json");
    this.conversations = readJsonFile("conversations.json");
    this.sellers = readJsonFile("sellers.json");
  }

  async getListings() {
    return this.listings;
  }

  async getListingById(id) {
    return this.listings.find((listing) => listing.id === id);
  }

  async createListing(listing) {
    this.listings.unshift(listing);
    return listing;
  }

  async getConversations() {
    return this.conversations;
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

  async getSellers() {
    return this.sellers;
  }

  async getSellerById(id) {
    const seller = this.sellers.find((item) => item.id === id);
    if (!seller) return null;
    const listings = this.listings.filter((listing) => listing.userId === id);
    return { ...seller, listings };
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
      connectionString: process.env.DATABASE_URL,
      ssl: process.env.DATABASE_SSL === "true" ? { rejectUnauthorized: false } : undefined
    });
  }

  async getListings() {
    const result = await this.pool.query("SELECT payload FROM listing_records ORDER BY COALESCE((payload->>'dealScore')::int, 0) DESC, updated_at DESC");
    return result.rows.map((row) => row.payload);
  }

  async getListingById(id) {
    const result = await this.pool.query("SELECT payload FROM listing_records WHERE id = $1 LIMIT 1", [id]);
    return result.rows[0]?.payload;
  }

  async createListing(listing) {
    await this.pool.query(
      "INSERT INTO listing_records (id, payload, updated_at) VALUES ($1, $2, NOW()) ON CONFLICT (id) DO UPDATE SET payload = EXCLUDED.payload, updated_at = NOW()",
      [listing.id, listing]
    );
    return listing;
  }

  async getConversations() {
    const result = await this.pool.query("SELECT payload FROM conversation_records ORDER BY updated_at DESC");
    return result.rows.map((row) => row.payload);
  }

  async createConversation(conversation) {
    await this.pool.query(
      "INSERT INTO conversation_records (id, payload, updated_at) VALUES ($1, $2, NOW()) ON CONFLICT (id) DO UPDATE SET payload = EXCLUDED.payload, updated_at = NOW()",
      [conversation.id, conversation]
    );
    return conversation;
  }

  async getSellers() {
    const result = await this.pool.query("SELECT payload FROM seller_records ORDER BY payload->>'name'");
    return result.rows.map((row) => row.payload);
  }

  async getSellerById(id) {
    const sellerResult = await this.pool.query("SELECT payload FROM seller_records WHERE id = $1 LIMIT 1", [id]);
    const seller = sellerResult.rows[0]?.payload;
    if (!seller) return null;
    const listingsResult = await this.pool.query("SELECT payload FROM listing_records WHERE payload->>'userId' = $1 ORDER BY updated_at DESC", [id]);
    return { ...seller, listings: listingsResult.rows.map((row) => row.payload) };
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

  StoreClass.prototype.createVerificationRequest = async function createVerificationRequest(user, type) {
    const state = await ensureAdminState(this);
    const now = new Date().toISOString();
    const existing = state.verifications.find((item) =>
      item.userId === user.id && item.type === type && item.status === "pending"
    );
    if (existing) return existing;
    const verification = {
      id: `ver_${String(state.verifications.length + 1).padStart(4, "0")}`,
      userId: user.id,
      userName: user.name || user.email,
      email: user.email,
      type,
      status: "pending",
      submittedAt: now,
      notes: "",
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
    const runtimeUsers = this.getRuntimeAdminUsers();
    const userMap = new Map([...state.users, ...runtimeUsers].map((user) => [user.email || user.id, user]));
    const users = Array.from(userMap.values());
    const today = state.traffic[state.traffic.length - 1];
    const previousWeek = state.traffic.slice(-14, -7).reduce((total, day) => total + day.visitors, 0);
    const currentWeek = state.traffic.slice(-7).reduce((total, day) => total + day.visitors, 0);
    const previousMonth = state.traffic.slice(0, 15).reduce((total, day) => total + day.visitors, 0);
    const currentMonth = state.traffic.slice(15).reduce((total, day) => total + day.visitors, 0);
    const activeUsers24h = users.filter((user) => Date.parse(user.lastLoginAt) >= Date.now() - 24 * 60 * 60 * 1000).length;
    const activeUsers7d = users.filter((user) => Date.parse(user.lastLoginAt) >= Date.now() - 7 * 24 * 60 * 60 * 1000).length;
    const pendingVerifications = state.verifications.filter((item) => item.status === "pending").length;
    const reportsOpen = state.reports.filter((item) => item.status === "open").length;
    const verifiedListings = state.listings.filter((item) => item.verificationStatus === "verified").length;
    const soldListings = state.listings.filter((item) => item.status === "sold").length;
    const averagePrice = state.listings.reduce((total, listing) => total + listing.price, 0) / state.listings.length;
    const todayStamp = new Date().toISOString().slice(0, 10);
    const newListingsToday = state.listings.filter((listing) => String(listing.updatedAt || "").startsWith(todayStamp)).length;
    const runtimeNewUsersToday = runtimeUsers.filter((user) => String(user.accountCreatedAt || "").startsWith(todayStamp)).length;
    const runtimeNewUsersThisWeek = runtimeUsers.filter((user) => Date.parse(user.accountCreatedAt) >= Date.now() - 7 * 24 * 60 * 60 * 1000).length;
    const signupsThisWeek = state.traffic.slice(-7).reduce((total, day) => total + day.signups, 0) + runtimeNewUsersThisWeek;
    const signupsThisMonth = state.traffic.reduce((total, day) => total + day.signups, 0) + runtimeUsers.length;

    return {
      cards: {
        totalUsers: users.length,
        newUsersToday: runtimeNewUsersToday,
        newUsersThisWeek: signupsThisWeek,
        newUsersThisMonth: signupsThisMonth,
        activeUsers24h,
        activeUsers7d,
        totalListings: state.listings.length,
        newListingsToday,
        verifiedListings,
        pendingVerificationRequests: pendingVerifications,
        vehiclesSold: soldListings,
        messagesSentToday: today.contacts,
        totalConversations: (await this.getConversations()).length,
        reportsSubmitted: reportsOpen,
        fraudFlagsTriggered: state.fraudFlags.filter((flag) => flag.status !== "dismissed").length,
        inspectionsRequested: Math.min(2, state.listings.length),
        revenue: 0,
        averageTimeToSellVehicle: "Not enough data"
      },
      website: {
        totalVisitors: state.traffic.reduce((total, day) => total + day.visitors, 0),
        uniqueVisitors: state.traffic.reduce((total, day) => total + day.uniqueVisitors, 0),
        pageViews: state.traffic.reduce((total, day) => total + day.pageViews, 0),
        sessions: state.traffic.reduce((total, day) => total + day.sessions, 0),
        visitorsToday: today.visitors,
        visitorsThisWeek: currentWeek,
        visitorsThisMonth: currentMonth,
        weekOverWeekGrowth: percent(currentWeek - previousWeek, previousWeek),
        monthOverMonthGrowth: percent(currentMonth - previousMonth, previousMonth),
        bounceRate: 41,
        averageSessionDuration: "2m 18s",
        signupConversionRate: 3.2,
        listingViewConversionRate: 18.4,
        searchToContactConversionRate: 4.8
      },
      charts: {
        userGrowth: state.traffic.map((day, index) => ({ date: day.date, value: users.length + state.traffic.slice(0, index + 1).reduce((total, item) => total + item.signups, 0) })),
        listingGrowth: state.traffic.map((day, index) => ({ date: day.date, value: Math.min(state.listings.length, state.traffic.slice(0, index + 1).reduce((total, item) => total + item.listingsCreated, 0)) })),
        visitors: state.traffic.map((day) => ({ date: day.date, value: day.visitors })),
        pageViews: state.traffic.map((day) => ({ date: day.date, value: day.pageViews })),
        signups: state.traffic.map((day) => ({ date: day.date, value: day.signups })),
        sales: state.traffic.map((day) => ({ date: day.date, value: 0 })),
        verificationApprovalRate: state.traffic.map((day) => ({
          date: day.date,
          value: state.verifications.length ? percent(state.verifications.filter((item) => item.status === "approved").length, state.verifications.length) : 0
        })),
        fraudTrends: state.traffic.map((day) => ({ date: day.date, value: state.fraudFlags.filter((flag) => flag.status !== "dismissed").length })),
        heatmap: Array.from({ length: 24 }, (_, hour) => ({ hour, activity: 0 })),
        popularMakes: makes.map((make) => ({ label: make, value: state.listings.filter((listing) => listing.title.startsWith(make) || listing.title.includes(` ${make} `)).length })).filter((item) => item.value > 0),
        popularModels: state.listings.slice(0, 8).map((listing) => ({ label: listing.title.split(" ").slice(1, 3).join(" "), value: listing.views })),
        averageListingPrice: money(averagePrice),
        averageMileageByCategory: Array.from(new Set(state.listings.map((listing) => listing.title.split(" ").slice(-1)[0] || "Vehicle"))).map((label) => {
          const matching = state.listings.filter((listing) => (listing.title.split(" ").slice(-1)[0] || "Vehicle") === label);
          return { label, value: Math.round(matching.reduce((total, listing) => total + Number(listing.mileage || 0), 0) / Math.max(1, matching.length)) };
        }),
        geographicDistribution: Array.from(new Set(state.listings.map((listing) => listing.location))).map((location) => ({
          label: location,
          value: state.listings.filter((listing) => listing.location === location).length
        }))
      },
      funnel: [
        { label: "Visitor", value: state.traffic.reduce((total, day) => total + day.visitors, 0) },
        { label: "Account Created", value: signupsThisMonth },
        { label: "Verification Started", value: state.verifications.length },
        { label: "Verification Approved", value: state.verifications.filter((item) => item.status === "approved").length },
        { label: "Listing Created", value: state.listings.length },
        { label: "Buyer Contacted", value: state.traffic.reduce((total, day) => total + day.contacts, 0) },
        { label: "Vehicle Sold", value: soldListings }
      ],
      futureRevenue: [
        { label: "Featured Listings", enabled: false, projectedMonthly: 1800 },
        { label: "Subscription Plans", enabled: false, projectedMonthly: 2600 },
        { label: "Listing Promotions", enabled: false, projectedMonthly: 1450 },
        { label: "Inspection Services", enabled: false, projectedMonthly: 3200 },
        { label: "Escrow Services", enabled: false, projectedMonthly: 4100 },
        { label: "Advertising Revenue", enabled: false, projectedMonthly: 900 }
      ]
    };
  };

  StoreClass.prototype.searchAdmin = async function searchAdmin(query) {
    const state = await ensureAdminState(this);
    const users = [...state.users, ...this.getRuntimeAdminUsers()];
    const q = String(query || "").trim().toLowerCase();
    if (!q) return { users: [], listings: [], verifications: [], reports: [] };
    return {
      users: filterByQuery(users, q, ["fullName", "email", "phone", "id"]).slice(0, 8),
      listings: filterByQuery(state.listings, q, ["title", "vin", "id", "seller"]).slice(0, 8),
      verifications: filterByQuery(state.verifications, q, ["id", "userName", "email", "vehicleVin"]).slice(0, 8),
      reports: filterByQuery(state.reports, q, ["id", "type", "reporter", "reportedUser", "listingId"]).slice(0, 8)
    };
  };

  StoreClass.prototype.getAdminCollection = async function getAdminCollection(name, params = new URLSearchParams()) {
    const state = await ensureAdminState(this);
    const users = [...state.users, ...this.getRuntimeAdminUsers()];
    const q = params.get("q") || "";
    const status = params.get("status") || "";
    const collections = {
      users: filterByQuery(users, q, ["fullName", "email", "phone", "id"]),
      listings: filterByQuery(state.listings, q, ["title", "vin", "id", "seller"]),
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
    const users = [...state.users, ...this.getRuntimeAdminUsers()];
    const map = {
      users,
      listings: state.listings,
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
    return log;
  };

  StoreClass.prototype.applyAdminAction = async function applyAdminAction(collection, id, action, adminAccount, notes = "") {
    const item = await this.getAdminItem(collection, id);
    if (!item) return null;
    const previous = JSON.stringify({ status: item.status, verificationStatus: item.verificationStatus, shadowBanned: item.shadowBanned });
    if (collection === "users") {
      if (action === "suspend") item.status = "suspended";
      if (action === "ban") item.status = "banned";
      if (action === "approve") item.status = "active";
      if (action === "shadow_ban") item.shadowBanned = true;
      if (action === "disable_messaging") item.messagingDisabled = true;
      if (action === "disable_listing_creation") item.listingCreationDisabled = true;
      if (action === "reset_verification") item.verificationStatus = "not_started";
      if (action === "force_password_reset") item.passwordResetRequired = true;
      if (action === "add_note") item.internalNotes = [item.internalNotes, notes].filter(Boolean).join("\n");
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
      if (action === "flag") item.status = "flagged";
      if (action === "mark_sold") item.status = "sold";
    }
    if (collection === "verifications") {
      if (action === "approve") item.status = "approved";
      if (action === "reject") item.status = "rejected";
      if (action === "request_resubmission") item.status = "pending";
      if (notes) item.notes = [item.notes, notes].filter(Boolean).join("\n");
    }
    if (collection === "reports") {
      if (action === "resolve") item.status = "resolved";
      if (action === "warn_user") item.status = "warning_sent";
      if (action === "escalate") item.status = "escalated";
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
    return {
      serverStatus: "online",
      databaseStatus: this.kind === "postgres" ? "connected" : "json fallback",
      storageUsage: "18%",
      apiStatus: "healthy",
      errorRate: "0.08%",
      failedJobs: 2,
      authenticationErrors: 4,
      uploadFailures: 1,
      alerts: [
        { level: "critical", message: "Critical failures trigger real-time admin notifications." },
        { level: "medium", message: "Upload retry queue needs review before production." }
      ]
    };
  };

  StoreClass.prototype.exportAdminCollection = async function exportAdminCollection(name) {
    const state = await ensureAdminState(this);
    const users = [...state.users, ...this.getRuntimeAdminUsers()];
    const map = {
      users,
      listings: state.listings,
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
