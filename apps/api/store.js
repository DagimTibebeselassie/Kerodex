const fs = require("fs");
const path = require("path");

const SEED_DIR = path.resolve(__dirname, "seed");
const USE_DATABASE = Boolean(process.env.DATABASE_URL);

function readJsonFile(fileName) {
  const filePath = path.join(SEED_DIR, fileName);
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

const makes = ["Toyota", "Honda", "Tesla", "Ford", "Chevrolet", "BMW", "Mercedes-Benz", "Subaru", "Lexus", "Hyundai"];
const regions = ["New York, NY", "Los Angeles, CA", "Chicago, IL", "Atlanta, GA", "Dallas, TX", "Seattle, WA", "Miami, FL", "Denver, CO"];
const devices = ["iPhone 15 Pro / Safari", "MacBook Pro / Chrome", "Windows 11 / Edge", "Pixel 8 / Chrome", "iPad / Safari"];
const reportTypes = ["Fraud", "Scam Attempt", "Fake Vehicle", "Harassment", "Spam", "Offensive Content"];
const verificationStatuses = ["pending", "approved", "rejected", "expired"];
const riskLevels = ["low", "medium", "high", "critical"];

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
    const role = index % 11 === 0 ? "seller" : index % 5 === 0 ? "buyer_seller" : "buyer";
    const status = index % 17 === 0 ? "suspended" : index % 23 === 0 ? "banned" : "active";
    const verificationStatus = index % 7 === 0 ? "pending" : index % 9 === 0 ? "rejected" : index % 3 === 0 ? "approved" : "not_started";
    const listingCount = listings.filter((listing) => (listing.seller?.name || "").toLowerCase() === name.toLowerCase()).length;
    const messageCount = conversations.reduce((total, conversation) => {
      return total + ((conversation.participants || []).includes(name) ? conversation.messages?.length || 0 : 0);
    }, 0);
    return {
      id: `usr_admin_${String(index + 1).padStart(3, "0")}`,
      fullName: name,
      email: `${name.toLowerCase().replace(/[^a-z0-9]+/g, ".").replace(/^\.+|\.+$/g, "") || "user"}@example.com`,
      phone: `+1 555 ${String(100 + index).padStart(3, "0")} ${String(1000 + index * 37).slice(-4)}`,
      role,
      status,
      accountCreatedAt: daysAgo(90 - (index % 60)),
      lastLoginAt: daysAgo(index % 14),
      verificationStatus,
      profileCompletion: Math.min(100, 48 + ((index * 13) % 53)),
      listingCount,
      messagesSent: messageCount + index * 3,
      reportsReceived: index % 8,
      shadowBanned: index % 29 === 0,
      messagingDisabled: index % 19 === 0,
      listingCreationDisabled: index % 31 === 0,
      internalNotes: index % 6 === 0 ? "Watch duplicate device and VIN reuse before approving new listings." : "",
      loginHistory: [0, 2, 7].map((offset) => ({ at: daysAgo((index + offset) % 30), ip: `172.16.${index % 18}.${20 + offset}`, region: regions[(index + offset) % regions.length] })),
      ipHistory: [`172.16.${index % 18}.20`, `10.8.${index % 9}.${40 + index}`],
      deviceHistory: [devices[index % devices.length], devices[(index + 2) % devices.length]],
      timeline: [
        { at: daysAgo(index % 30), event: "Logged in", detail: devices[index % devices.length] },
        { at: daysAgo((index + 3) % 30), event: "Search performed", detail: makes[index % makes.length] },
        { at: daysAgo((index + 5) % 30), event: "Listing viewed", detail: listings[index % listings.length]?.title || "Vehicle listing" }
      ]
    };
  });
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
    location: listing.location,
    status: index % 13 === 0 ? "flagged" : index % 9 === 0 ? "sold" : index % 7 === 0 ? "pending" : "active",
    verificationStatus: index % 4 === 0 ? "pending" : "verified",
    views: 180 + index * 47,
    favorites: 8 + (index * 7) % 96,
    inquiries: 2 + (index * 5) % 34,
    riskLevel: riskLevels[index % riskLevels.length],
    riskScore: 18 + (index * 11) % 82,
    updatedAt: listing.updatedAt || daysAgo(index % 20),
    history: [
      { at: daysAgo(index % 10), action: "Listing updated", actor: "seller" },
      { at: daysAgo((index + 3) % 12), action: "Fraud scan completed", actor: "system" }
    ]
  }));

  const verifications = users.slice(0, 18).map((user, index) => ({
    id: `ver_${String(index + 1).padStart(4, "0")}`,
    userId: user.id,
    userName: user.fullName,
    email: user.email,
    type: index % 2 === 0 ? "identity" : "ownership",
    status: verificationStatuses[index % verificationStatuses.length],
    submittedAt: daysAgo(index % 18),
    selfiePhoto: "private://identity/selfie.jpg",
    governmentIdFront: "private://identity/id-front.jpg",
    governmentIdBack: "private://identity/id-back.jpg",
    vehicleVin: adminListings[index % adminListings.length]?.vin,
    titleUpload: "private://ownership/title.pdf",
    registrationUpload: "private://ownership/registration.pdf",
    licensePlateImage: "private://ownership/plate.jpg",
    notes: index % 3 === 0 ? "Name and address need manual comparison." : "",
    history: [
      { at: daysAgo(index % 12), action: "Submitted", actor: user.fullName },
      { at: daysAgo((index + 1) % 12), action: "Document scan queued", actor: "system" }
    ]
  }));

  const fraudFlags = adminListings.slice(0, 16).map((listing, index) => ({
    id: `flag_${String(index + 1).padStart(4, "0")}`,
    listingId: listing.id,
    userId: users[index % users.length].id,
    reason: ["Suspicious Pricing", "Duplicate Listing", "VIN Mismatch", "Image Manipulation", "High Report Volume", "Rapid Account Creation"][index % 6],
    confidence: 54 + (index * 7) % 45,
    riskLevel: riskLevels[(index + 1) % riskLevels.length],
    status: index % 5 === 0 ? "escalated" : "open",
    detectedAt: daysAgo(index % 8),
    relatedAccounts: [users[(index + 2) % users.length].id],
    relatedListings: [adminListings[(index + 3) % adminListings.length].id]
  }));

  const reports = Array.from({ length: 22 }, (_, index) => ({
    id: `rep_${String(index + 1).padStart(4, "0")}`,
    type: reportTypes[index % reportTypes.length],
    status: index % 6 === 0 ? "resolved" : "open",
    reporter: users[(index + 4) % users.length].fullName,
    reportedUser: users[index % users.length].fullName,
    listingId: adminListings[index % adminListings.length].id,
    conversationId: conversations[index % conversations.length]?.id || `conv_${index}`,
    priority: riskLevels[index % riskLevels.length],
    submittedAt: daysAgo(index % 15),
    evidence: "Conversation, listing snapshot, account timeline, and fraud score attached."
  }));

  const auditLogs = [
    { id: "audit_0001", timestamp: now, adminAccount: "system", actionType: "admin.dashboard_bootstrapped", targetType: "system", targetId: "local", previousValue: null, newValue: "demo admin state", immutable: true },
    { id: "audit_0002", timestamp: daysAgo(1), adminAccount: "admin@kerodex.local", actionType: "verification.reviewed", targetType: "verification", targetId: verifications[0]?.id, previousValue: "pending", newValue: "approved", immutable: true }
  ];

  const traffic = Array.from({ length: 30 }, (_, index) => {
    const day = 29 - index;
    return {
      date: formatDay(day),
      visitors: 420 + index * 19 + (index % 6) * 32,
      uniqueVisitors: 310 + index * 13 + (index % 5) * 19,
      pageViews: 980 + index * 54 + (index % 4) * 88,
      sessions: 390 + index * 16,
      signups: 16 + (index % 8) * 3,
      listingsCreated: 6 + (index % 5) * 2,
      contacts: 19 + (index % 7) * 4
    };
  });

  return {
    users,
    listings: adminListings,
    verifications,
    fraudFlags,
    reports,
    auditLogs,
    notifications: [
      { id: "note_1", type: "New Verification Submission", priority: "high", message: "3 identity reviews are waiting for approval.", createdAt: now },
      { id: "note_2", type: "New Fraud Alert", priority: "critical", message: "A critical VIN mismatch was detected.", createdAt: daysAgo(0) },
      { id: "note_3", type: "Critical System Error", priority: "medium", message: "Upload retry queue has elevated failures.", createdAt: daysAgo(1) }
    ],
    tickets: [
      { id: "ticket_1001", subject: "Buyer cannot contact seller", status: "open", priority: "medium" },
      { id: "ticket_1002", subject: "Seller requested title review", status: "waiting", priority: "high" }
    ],
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
}

function addAdminMethods(StoreClass) {
  StoreClass.prototype.getAdminDashboard = async function getAdminDashboard() {
    const state = await ensureAdminState(this);
    const today = state.traffic[state.traffic.length - 1];
    const previousWeek = state.traffic.slice(-14, -7).reduce((total, day) => total + day.visitors, 0);
    const currentWeek = state.traffic.slice(-7).reduce((total, day) => total + day.visitors, 0);
    const previousMonth = state.traffic.slice(0, 15).reduce((total, day) => total + day.visitors, 0);
    const currentMonth = state.traffic.slice(15).reduce((total, day) => total + day.visitors, 0);
    const activeUsers24h = state.users.filter((user) => Date.parse(user.lastLoginAt) >= Date.now() - 24 * 60 * 60 * 1000).length;
    const activeUsers7d = state.users.filter((user) => Date.parse(user.lastLoginAt) >= Date.now() - 7 * 24 * 60 * 60 * 1000).length;
    const pendingVerifications = state.verifications.filter((item) => item.status === "pending").length;
    const reportsOpen = state.reports.filter((item) => item.status === "open").length;
    const verifiedListings = state.listings.filter((item) => item.verificationStatus === "verified").length;
    const soldListings = state.listings.filter((item) => item.status === "sold").length;
    const averagePrice = state.listings.reduce((total, listing) => total + listing.price, 0) / state.listings.length;

    return {
      cards: {
        totalUsers: state.users.length,
        newUsersToday: 7,
        newUsersThisWeek: 42,
        newUsersThisMonth: 138,
        activeUsers24h,
        activeUsers7d,
        totalListings: state.listings.length,
        newListingsToday: today.listingsCreated,
        verifiedListings,
        pendingVerificationRequests: pendingVerifications,
        vehiclesSold: soldListings,
        messagesSentToday: 186,
        totalConversations: (await this.getConversations()).length,
        reportsSubmitted: reportsOpen,
        fraudFlagsTriggered: state.fraudFlags.filter((flag) => flag.status !== "dismissed").length,
        inspectionsRequested: 11,
        revenue: 0,
        averageTimeToSellVehicle: "18 days"
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
        bounceRate: 36,
        averageSessionDuration: "3m 42s",
        signupConversionRate: 7.8,
        listingViewConversionRate: 24.1,
        searchToContactConversionRate: 9.4
      },
      charts: {
        userGrowth: state.traffic.map((day, index) => ({ date: day.date, value: 1500 + index * 37 + day.signups })),
        listingGrowth: state.traffic.map((day, index) => ({ date: day.date, value: state.listings.length + index + day.listingsCreated })),
        visitors: state.traffic.map((day) => ({ date: day.date, value: day.visitors })),
        pageViews: state.traffic.map((day) => ({ date: day.date, value: day.pageViews })),
        signups: state.traffic.map((day) => ({ date: day.date, value: day.signups })),
        sales: state.traffic.map((day, index) => ({ date: day.date, value: 2 + (index % 5) })),
        verificationApprovalRate: state.traffic.map((day, index) => ({ date: day.date, value: 72 + (index % 9) })),
        fraudTrends: state.traffic.map((day, index) => ({ date: day.date, value: 4 + (index % 6) })),
        heatmap: Array.from({ length: 24 }, (_, hour) => ({ hour, activity: 30 + ((hour * 17) % 70) })),
        popularMakes: makes.map((make, index) => ({ label: make, value: 260 - index * 17 })),
        popularModels: state.listings.slice(0, 8).map((listing) => ({ label: listing.title.split(" ").slice(1, 3).join(" "), value: listing.views })),
        averageListingPrice: money(averagePrice),
        averageMileageByCategory: [
          { label: "Sedan", value: 48200 },
          { label: "SUV", value: 53600 },
          { label: "Truck", value: 61200 },
          { label: "EV", value: 29800 }
        ],
        geographicDistribution: regions.map((region, index) => ({ label: region, value: 140 - index * 9 }))
      },
      funnel: [
        { label: "Visitor", value: 10000 },
        { label: "Account Created", value: 780 },
        { label: "Verification Started", value: 420 },
        { label: "Verification Approved", value: 316 },
        { label: "Listing Created", value: 146 },
        { label: "Buyer Contacted", value: 94 },
        { label: "Vehicle Sold", value: 32 }
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
    const q = String(query || "").trim().toLowerCase();
    if (!q) return { users: [], listings: [], verifications: [], reports: [] };
    return {
      users: filterByQuery(state.users, q, ["fullName", "email", "phone", "id"]).slice(0, 8),
      listings: filterByQuery(state.listings, q, ["title", "vin", "id", "seller"]).slice(0, 8),
      verifications: filterByQuery(state.verifications, q, ["id", "userName", "email", "vehicleVin"]).slice(0, 8),
      reports: filterByQuery(state.reports, q, ["id", "type", "reporter", "reportedUser", "listingId"]).slice(0, 8)
    };
  };

  StoreClass.prototype.getAdminCollection = async function getAdminCollection(name, params = new URLSearchParams()) {
    const state = await ensureAdminState(this);
    const q = params.get("q") || "";
    const status = params.get("status") || "";
    const collections = {
      users: filterByQuery(state.users, q, ["fullName", "email", "phone", "id"]),
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
    const map = {
      users: state.users,
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
    const map = {
      users: state.users,
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
