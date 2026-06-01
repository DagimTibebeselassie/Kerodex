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

loadLocalEnvFile(path.resolve(__dirname, "../../.env.local"));
loadLocalEnvFile(path.resolve(__dirname, "../../.env"));

const store = require("./store");
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

const adminAccounts = [
  { id: "adm_001", email: "admin@kerodex.local", name: "Kerodex Admin", role: "super_admin" },
  { id: "adm_002", email: "moderator@kerodex.local", name: "Marketplace Moderator", role: "moderator" },
  { id: "adm_003", email: "verify@kerodex.local", name: "Verification Specialist", role: "verification_specialist" },
  { id: "adm_004", email: "support@kerodex.local", name: "Support Agent", role: "support_agent" }
];

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

function sendJson(res, status, body) {
  res.writeHead(status, {
    "content-type": "application/json; charset=utf-8",
    "cache-control": "no-store",
    "access-control-allow-origin": "*"
  });
  res.end(JSON.stringify(body));
}

function redirect(res, location) {
  res.writeHead(302, {
    location,
    "cache-control": "no-store"
  });
  res.end();
}

function sendHtml(res, status, html) {
  res.writeHead(status, {
    "content-type": "text/html; charset=utf-8",
    "cache-control": "no-store"
  });
  res.end(html);
}

function sendCsv(res, fileName, csv) {
  res.writeHead(200, {
    "content-type": "text/csv; charset=utf-8",
    "content-disposition": `attachment; filename="${fileName}"`,
    "cache-control": "no-store",
    "access-control-allow-origin": "*"
  });
  res.end(csv);
}

function readJson(req) {
  return new Promise((resolve, reject) => {
    let body = "";
    req.on("data", (chunk) => {
      body += chunk;
      if (body.length > 1_000_000) {
        req.destroy();
        reject(new Error("Request body too large"));
      }
    });
    req.on("end", () => {
      if (!body) {
        resolve({});
        return;
      }
      try {
        resolve(JSON.parse(body));
      } catch (error) {
        reject(error);
      }
    });
    req.on("error", reject);
  });
}

function readText(req) {
  return new Promise((resolve, reject) => {
    let body = "";
    req.on("data", (chunk) => {
      body += chunk;
      if (body.length > 1_000_000) {
        req.destroy();
        reject(new Error("Request body too large"));
      }
    });
    req.on("end", () => resolve(body));
    req.on("error", reject);
  });
}

async function readForm(req) {
  const body = await readText(req);
  return Object.fromEntries(new URLSearchParams(body));
}

function makeToken() {
  return `dev_${Date.now().toString(36)}_${Math.random().toString(36).slice(2)}`;
}

function makeCode(length = 6) {
  const min = 10 ** (length - 1);
  const max = 9 * min;
  return String(Math.floor(min + Math.random() * max));
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
  const adminId = adminSessions.get(token);
  return adminAccounts.find((account) => account.id === adminId);
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
  const email = normalize(body.email);
  const code = String(body.accessCode || "");
  const expectedCode = process.env.ADMIN_ACCESS_CODE || "kerodex-admin-local";
  const admin = adminAccounts.find((account) => account.email === email);
  if (!admin || code !== expectedCode) return null;
  const token = makeToken();
  adminSessions.set(token, admin.id);
  return { token, admin: publicAdmin(admin) };
}

function sendAdminEvents(req, res) {
  const admin = requireAdmin(req, res, "dashboard:read");
  if (!admin) return;

  res.writeHead(200, {
    "content-type": "text/event-stream",
    "cache-control": "no-cache",
    connection: "keep-alive",
    "access-control-allow-origin": "*"
  });

  res.write(`: admin event stream connected for ${admin.role}\n\n`);
  const heartbeat = setInterval(() => res.write(`: heartbeat ${Date.now()}\n\n`), 30000);
  req.on("close", () => clearInterval(heartbeat));
}

function publicUser(user) {
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    provider: user.provider,
    emailVerified: Boolean(user.emailVerified),
    phoneVerified: Boolean(user.phoneVerified),
    identityVerified: Boolean(user.identityVerified),
    selfieVerified: Boolean(user.selfieVerified)
  };
}

function adminRuntimeUser(user) {
  const createdAt = user.createdAt || new Date().toISOString();
  const lastLoginAt = user.lastLoginAt || createdAt;
  return {
    id: user.id,
    fullName: user.name || user.email.split("@")[0],
    email: user.email,
    phone: user.phone || "",
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
  return Array.from(users.values()).find((item) => item.id === userId) || null;
}

function createSession(user) {
  const token = makeToken();
  user.lastLoginAt = new Date().toISOString();
  sessions.set(token, user.id);
  return { token, user: publicUser(user) };
}

function upsertSocialUser(provider) {
  const email = provider === "microsoft" ? "microsoft.demo@kerodex.local" : "google.demo@kerodex.local";
  const existing = users.get(email);
  if (existing) return existing;

  const user = {
    id: `usr_${users.size + 1}`,
    email,
    name: provider === "microsoft" ? "Microsoft Demo User" : "Google Demo User",
    password: null,
    provider,
    emailVerified: false,
    phoneVerified: false,
    identityVerified: false,
    selfieVerified: false,
    createdAt: new Date().toISOString(),
    lastLoginAt: null
  };
  users.set(email, user);
  return user;
}

function upsertOAuthUser(provider, profile) {
  const email = normalize(profile.email);
  if (!email) throw new Error("The provider did not return an email address.");
  const existing = users.get(email);
  if (existing) {
    existing.provider = existing.provider || provider;
    existing.emailVerified = Boolean(profile.emailVerified || existing.emailVerified);
    existing.name = existing.name || profile.name || email.split("@")[0];
    return existing;
  }

  const user = {
    id: `usr_${users.size + 1}`,
    email,
    name: profile.name || email.split("@")[0],
    password: null,
    provider,
    emailVerified: Boolean(profile.emailVerified),
    phoneVerified: false,
    identityVerified: false,
    selfieVerified: false,
    createdAt: new Date().toISOString(),
    lastLoginAt: null
  };
  users.set(email, user);
  return user;
}

function appOrigin(req) {
  const proto = req.headers["x-forwarded-proto"] || "http";
  return `${proto}://${req.headers.host}`;
}

function makeOAuthState(provider) {
  const state = crypto.randomBytes(24).toString("hex");
  oauthStates.set(state, { provider, createdAt: Date.now() });
  return state;
}

function consumeOAuthState(state, provider) {
  const record = oauthStates.get(state);
  oauthStates.delete(state);
  return record && record.provider === provider && Date.now() - record.createdAt < 10 * 60 * 1000;
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

async function sendCodeEmail({ email, code, subject, heading, intro, reason, fallbackText }) {
  const html = `<!doctype html>
  <html>
    <body style="margin:0;background:#ffffff;color:#24292f;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;">
      <div style="max-width:640px;margin:0 auto;padding:56px 24px 40px;text-align:center;">
        <div style="font-size:28px;font-weight:700;letter-spacing:-0.03em;margin-bottom:28px;">Kerodex</div>
        <h1 style="font-size:24px;font-weight:400;line-height:1.35;margin:0 0 24px;">${heading}</h1>
        <div style="border:1px solid #d0d7de;border-radius:6px;text-align:left;padding:24px 28px;margin:0 auto 24px;max-width:480px;">
          <p style="font-size:15px;line-height:1.5;margin:0 0 24px;color:#24292f;">${intro}</p>
          <div style="font-size:32px;letter-spacing:0.35em;text-align:center;margin:0 0 24px;color:#24292f;">${code}</div>
          <p style="font-size:15px;line-height:1.5;margin:0 0 18px;color:#24292f;">This code is valid for <strong>15 minutes</strong> and can only be used once.</p>
          <p style="font-size:15px;line-height:1.5;margin:0;color:#24292f;"><strong>Please don't share this code with anyone:</strong> Kerodex will never ask for it by phone or email.</p>
          <p style="font-size:15px;line-height:1.5;margin:28px 0 0;color:#24292f;">Thanks,<br/>The Kerodex Team</p>
        </div>
        <p style="max-width:480px;margin:0 auto 24px;text-align:left;font-size:14px;line-height:1.6;color:#57606a;">You're receiving this email because ${reason} If this wasn't you, you can ignore this email.</p>
        <hr style="border:0;border-top:1px solid #d8dee4;margin:28px auto 0;max-width:480px;" />
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

  const listings = await store.getListings();
  return listings
    .filter((listing) => {
      const haystack = normalize([
        listing.title,
        listing.make,
        listing.model,
        listing.trim,
        listing.bodyType,
        listing.fuelType,
        listing.features.join(" ")
      ].join(" "));

      return (
        (!query || haystack.includes(query)) &&
        (!make || normalize(listing.make) === make) &&
        (!model || normalize(listing.model) === model) &&
        (!bodyType || normalize(listing.bodyType) === bodyType) &&
        (!fuelType || normalize(listing.fuelType) === fuelType) &&
        (!drivetrain || normalize(listing.drivetrain) === drivetrain || listing.features.some((feature) => normalize(feature).includes(drivetrain))) &&
        (!minPrice || listing.price >= minPrice) &&
        (!maxPrice || listing.price <= maxPrice) &&
        (!minMileage || listing.mileage >= minMileage) &&
        (!maxMileage || listing.mileage <= maxMileage) &&
        (!minYear || listing.year >= minYear) &&
        (!maxYear || listing.year <= maxYear) &&
        (!cleanTitleOnly || listing.badges.some((badge) => normalize(badge).includes("clean title"))) &&
        (!noAccidentsOnly || listing.badges.some((badge) => normalize(badge).includes("no accidents")))
      );
    })
    .sort((a, b) => b.dealScore - a.dealScore);
}

function normalizeVin(value) {
  return String(value || "").trim().toUpperCase().replace(/[^A-Z0-9]/g, "");
}

function numberFrom(value, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
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
  const image = String(body.image || images[0] || "").trim() || "https://images.unsplash.com/photo-1549924231-f129b911e442?auto=format&fit=crop&w=1600&q=80";

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
    status: "active",
    vin: normalizeVin(body.vin),
    badges: ["Private seller", "Seller draft", "Verification pending"],
    features: [
      trim ? `${trim} trim` : "Trim pending",
      body.damage && !/^none$/i.test(String(body.damage)) ? "Damage disclosed" : "Damage disclosure ready",
      body.maintenanceNames?.length ? "Maintenance records uploaded" : "Maintenance records pending"
    ],
    images: images.length ? images : [image],
    seller: {
      name: String(body.sellerName || "Kerodex seller").trim(),
      responseTime: "New listing",
      completedSales: 0,
      verified: false
    },
    description: String(body.description || "").trim(),
    updatedAt: new Date().toISOString()
  };

  if (user) {
    listing.userId = user.id;
    listing.seller = {
      name: user.name || user.email.split("@")[0] || "Kerodex seller",
      responseTime: "New listing",
      completedSales: 0,
      verified: Boolean(user.identityVerified)
    };
  }

  return listing;
}

function createConversationRecord({ listing, buyer, message }) {
  const sellerId = listing.userId || listing.seller?.id || `seller_${listing.id}`;
  const id = `conv_${buyer.id}_${listing.id}`;
  return {
    id,
    listingId: listing.id,
    buyerId: buyer.id,
    sellerId,
    buyerName: buyer.name || buyer.email.split("@")[0],
    sellerName: listing.seller?.name || "Kerodex seller",
    vehicleTitle: listing.title || `${listing.year} ${listing.make} ${listing.model}`,
    lastMessage: String(message || "Hi, is this still available?").trim(),
    unread: 0,
    updatedAt: new Date().toISOString(),
    messages: [
      {
        id: `msg_${Date.now()}`,
        senderId: buyer.id,
        receiverId: sellerId,
        vehicleId: listing.id,
        content: String(message || "Hi, is this still available?").trim(),
        createdAt: new Date().toISOString()
      }
    ]
  };
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
        res.writeHead(200, { "content-type": mimeTypes[".html"] });
        res.end(fallback);
      });
      return;
    }

    const ext = path.extname(filePath);
    const isHtml = ext === ".html";
    const cacheControl = isHtml ? "no-store" : "public, max-age=31536000, immutable";
    res.writeHead(200, {
      "content-type": mimeTypes[ext] || "application/octet-stream",
      "cache-control": cacheControl
    });
    res.end(file);
  });
}

function handleEvents(req, res) {
  res.writeHead(200, {
    "content-type": "text/event-stream",
    "cache-control": "no-cache",
    connection: "keep-alive",
    "access-control-allow-origin": "*"
  });

  const send = async () => {
    const listings = await store.getListings();
    if (!listings.length) return;
    const listing = listings[Math.floor(Math.random() * listings.length)];
    res.write(`event: listing.updated\n`);
    res.write(`data: ${JSON.stringify({ id: listing.id, updatedAt: new Date().toISOString() })}\n\n`);
  };

  send().catch(() => {});
  const timer = setInterval(() => send().catch(() => {}), 12000);
  req.on("close", () => clearInterval(timer));
}

const server = http.createServer((req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);

  if (req.method === "OPTIONS") {
    res.writeHead(204, {
      "access-control-allow-origin": "*",
      "access-control-allow-methods": "GET,POST,PATCH,OPTIONS",
      "access-control-allow-headers": "content-type,authorization"
    });
    res.end();
    return;
  }

  if (url.pathname === "/api/health") {
    sendJson(res, 200, { ok: true, service: "kerodex-api", dataSource: store.kind, timestamp: new Date().toISOString() });
    return;
  }

  if (url.pathname === "/api/admin/auth/login" && req.method === "POST") {
    readJson(req)
      .then((body) => {
        const session = adminLogin(body);
        if (!session) {
          sendJson(res, 401, { error: "Invalid admin email or access code." });
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
    store.getAdminDashboard()
      .then((dashboard) => sendJson(res, 200, dashboard))
      .catch((error) => sendJson(res, 500, { error: "Unable to load admin dashboard.", detail: error.message }));
    return;
  }

  if (url.pathname === "/api/admin/analytics" && req.method === "GET") {
    const admin = requireAdmin(req, res, "analytics:read");
    if (!admin) return;
    store.getAdminDashboard()
      .then((dashboard) => sendJson(res, 200, { website: dashboard.website, charts: dashboard.charts, funnel: dashboard.funnel }))
      .catch((error) => sendJson(res, 500, { error: "Unable to load analytics.", detail: error.message }));
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
      .then((body) => store.applyAdminAction(collection, decodeURIComponent(adminActionMatch[2]), String(body.action || ""), admin.email, String(body.notes || "")))
      .then((result) => sendJson(res, result ? 200 : 404, result || { error: "Admin record not found." }))
      .catch((error) => sendJson(res, 400, { error: "Unable to apply admin action.", detail: error.message }));
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
    authUrl.searchParams.set("state", makeOAuthState("google"));
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
    authUrl.searchParams.set("state", makeOAuthState("microsoft"));
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
        if (!code || !consumeOAuthState(state, provider)) {
          throw new Error("OAuth state is invalid or expired. Try signing in again.");
        }
        const redirectUri = `${appOrigin(req)}/api/auth/callback/${provider}`;
        const profile = provider === "microsoft"
          ? await exchangeMicrosoftCode({ code, redirectUri })
          : await exchangeGoogleCode({ code, redirectUri });
        const user = upsertOAuthUser(provider, profile);
        const session = createSession(user);
        redirect(res, `/?auth=success&token=${encodeURIComponent(session.token)}&user=${encodeURIComponent(JSON.stringify(session.user))}`);
      })
      .catch((error) => {
        redirect(res, `/?auth=error&message=${encodeURIComponent(error.message || "Authentication failed.")}`);
      });
    return;
  }

  if (url.pathname === "/api/auth/session" && req.method === "GET") {
    const auth = req.headers.authorization || "";
    const token = auth.startsWith("Bearer ") ? auth.slice(7) : "";
    const userId = sessions.get(token);
    const user = Array.from(users.values()).find((item) => item.id === userId);
    sendJson(res, user ? 200 : 401, user ? { user: publicUser(user) } : { error: "Not signed in" });
    return;
  }

  if (url.pathname === "/api/auth/email" && req.method === "POST") {
    readJson(req)
      .then(async (body) => {
        const mode = body.mode === "create" ? "create" : "signin";
        const email = normalize(body.email);
        const password = String(body.password || "");
        const name = String(body.name || "").trim();

        if (!email || !email.includes("@") || password.length < 6) {
          sendJson(res, 400, { error: "Use a valid email and a password with at least 6 characters." });
          return;
        }

        const existing = users.get(email);
        if (mode === "create") {
          if (existing) {
            sendJson(res, 409, { error: "An account already exists. Try signing in." });
            return;
          }

          const user = {
            id: `usr_${users.size + 1}`,
            email,
            name: name || email.split("@")[0],
            password,
            provider: "email",
            emailVerified: false,
            phoneVerified: false,
            identityVerified: false,
            selfieVerified: false,
            createdAt: new Date().toISOString(),
            lastLoginAt: null
          };
          const mail = await sendVerificationEmail({ email, code: makeCode(), req });
          users.set(email, user);
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

        if (!existing || existing.password !== password) {
          sendJson(res, 401, { error: "Email or password is incorrect." });
          return;
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

        sendJson(res, 200, createSession(existing));
      })
      .catch((error) => sendJson(res, 400, { error: error.message || "Invalid request body." }));
    return;
  }

  if (url.pathname === "/api/auth/email/verify" && req.method === "POST") {
    readJson(req)
      .then((body) => {
        const email = normalize(body.email);
        const code = String(body.code || "").trim();
        const record = emailVerifications.get(email);
        const user = users.get(email);
        if (!user || !record || record.code !== code || record.expiresAt < Date.now()) {
          sendJson(res, 400, { error: "Verification code is invalid or expired." });
          return;
        }
        emailVerifications.delete(email);
        user.emailVerified = true;
        sendJson(res, 200, createSession(user));
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

        const existing = users.get(email);
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
      .then((body) => {
        const email = normalize(body.email);
        const code = String(body.code || "").trim();
        const password = String(body.password || "");
        const record = passwordResets.get(email);
        const user = users.get(email);
        if (!user || !record || record.code !== code || record.expiresAt < Date.now()) {
          sendJson(res, 400, { error: "Reset code is invalid or expired." });
          return;
        }
        if (password.length < 6) {
          sendJson(res, 400, { error: "Use a password with at least 6 characters." });
          return;
        }
        user.password = password;
        user.emailVerified = true;
        passwordResets.delete(email);
        sendJson(res, 200, createSession(user));
      })
      .catch((error) => sendJson(res, 400, { error: error.message || "Invalid request body." }));
    return;
  }

  if (url.pathname === "/api/listings" && req.method === "GET") {
    filterListings(url.searchParams)
      .then((listings) => sendJson(res, 200, { listings }))
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
      .then((listings) => sendJson(res, 200, { listings: listings.filter((listing) => listing.userId === user.id) }))
      .catch((error) => sendJson(res, 500, { error: "Unable to load your listings.", detail: error.message }));
    return;
  }

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
        sendJson(res, 201, { verification });
      })
      .catch((error) => sendJson(res, 400, { error: "Unable to submit verification.", detail: error.message }));
    return;
  }

  if (url.pathname === "/api/listings" && req.method === "POST") {
    const user = getAuthUser(req);
    if (!user) {
      sendJson(res, 401, { error: "Sign in to publish a listing." });
      return;
    }
    readJson(req)
      .then((body) => {
        if (!String(body.make || "").trim() || !String(body.model || "").trim() || !Number(body.year) || !Number(body.price)) {
          sendJson(res, 400, { error: "Add year, make, model, and asking price before publishing locally." });
          return;
        }
        const listing = createSellerListing(body, user);
        return store.createListing(listing).then((created) => sendJson(res, 201, { listing: created }));
      })
      .catch((error) => sendJson(res, 400, { error: "Unable to create listing.", detail: error.message }));
    return;
  }

  if (url.pathname.startsWith("/api/vin/decode/")) {
    const vin = decodeURIComponent(url.pathname.split("/").pop() || "");
    decodeVin(vin)
      .then((body) => sendJson(res, body.ok ? 200 : 400, body))
      .catch((error) => sendJson(res, 502, {
        ok: false,
        error: "VIN decoder is unavailable right now. Save the VIN and retry before publishing.",
        detail: error.message
      }));
    return;
  }

  if (url.pathname.startsWith("/api/listings/")) {
    const id = url.pathname.split("/").pop();
    store.getListingById(id)
      .then((listing) => sendJson(res, listing ? 200 : 404, listing || { error: "Listing not found" }))
      .catch((error) => sendJson(res, 500, { error: "Unable to load listing.", detail: error.message }));
    return;
  }

  if (url.pathname.startsWith("/api/sellers/")) {
    const id = decodeURIComponent(url.pathname.split("/").pop() || "");
    store.getSellerById(id)
      .then((seller) => sendJson(res, seller ? 200 : 404, seller || { error: "Seller not found" }))
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
        )
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
    readJson(req)
      .then(async (body) => {
        const listing = await store.getListingById(String(body.listingId || ""));
        if (!listing) {
          sendJson(res, 404, { error: "Listing not found." });
          return;
        }
        if (listing.userId === user.id) {
          sendJson(res, 400, { error: "You cannot message yourself about your own listing." });
          return;
        }
        const conversation = createConversationRecord({
          listing,
          buyer: user,
          message: body.message
        });
        const created = await store.createConversation(conversation);
        sendJson(res, 201, { conversation: created });
      })
      .catch((error) => sendJson(res, 400, { error: "Unable to start conversation.", detail: error.message }));
    return;
  }

  if (url.pathname === "/api/events") {
    handleEvents(req, res);
    return;
  }

  serveStatic(req, res, url.pathname);
});

server.listen(PORT, () => {
  console.log(`Kerodex running at http://localhost:${PORT}`);
});
