const http = require("http");
const fs = require("fs");
const path = require("path");
const { URL } = require("url");
const store = require("./store");

const PORT = Number(process.env.PORT || 4100);
const PUBLIC_DIR = path.resolve(__dirname, "../web/public");
const users = new Map();
const sessions = new Map();

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

function makeToken() {
  return `dev_${Date.now().toString(36)}_${Math.random().toString(36).slice(2)}`;
}

function publicUser(user) {
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    provider: user.provider
  };
}

function createSession(user) {
  const token = makeToken();
  sessions.set(token, user.id);
  return { token, user: publicUser(user) };
}

function upsertSocialUser(provider) {
  const email = provider === "apple" ? "apple.demo@kerodex.local" : "google.demo@kerodex.local";
  const existing = users.get(email);
  if (existing) return existing;

  const user = {
    id: `usr_${users.size + 1}`,
    email,
    name: provider === "apple" ? "Apple Demo User" : "Google Demo User",
    password: null,
    provider
  };
  users.set(email, user);
  return user;
}

function sendAuthSetup(res, provider) {
  const label = provider === "apple" ? "Apple" : "Google";
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
          <p style="color:#a7b0bf;line-height:1.6"><strong style="color:#f8fafc">Expected env var:</strong> ${provider === "apple" ? "APPLE_CLIENT_ID" : "GOOGLE_CLIENT_ID"}</p>
          <a href="/?v=10#browse" style="display:inline-flex;align-items:center;min-height:44px;background:#f8fafc;color:#0b1119;border-radius:999px;padding:0 18px;text-decoration:none;font-weight:800">Back to Kerodex</a>
        </main>
      </body>
    </html>`);
}

function normalize(value) {
  return String(value || "").trim().toLowerCase();
}

function filterListings(params) {
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

  return store
    .getListings()
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

  const send = () => {
    const listings = store.getListings();
    const listing = listings[Math.floor(Math.random() * listings.length)];
    res.write(`event: listing.updated\n`);
    res.write(`data: ${JSON.stringify({ id: listing.id, updatedAt: new Date().toISOString() })}\n\n`);
  };

  send();
  const timer = setInterval(send, 12000);
  req.on("close", () => clearInterval(timer));
}

const server = http.createServer((req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);

  if (req.method === "OPTIONS") {
    res.writeHead(204, {
      "access-control-allow-origin": "*",
      "access-control-allow-methods": "GET,POST,OPTIONS",
      "access-control-allow-headers": "content-type,authorization"
    });
    res.end();
    return;
  }

  if (url.pathname === "/api/health") {
    sendJson(res, 200, { ok: true, service: "kerodex-api", timestamp: new Date().toISOString() });
    return;
  }

  if (url.pathname === "/api/auth/google") {
    const clientId = process.env.GOOGLE_CLIENT_ID;
    if (!clientId) {
      const session = createSession(upsertSocialUser("google"));
      if ((req.headers.accept || "").includes("application/json")) {
        sendJson(res, 200, session);
        return;
      }
      redirect(res, `/?v=14#browse&auth=google&token=${encodeURIComponent(session.token)}`);
      return;
    }
    const redirectUri = `http://${req.headers.host}/api/auth/callback/google`;
    const authUrl = new URL("https://accounts.google.com/o/oauth2/v2/auth");
    authUrl.searchParams.set("client_id", clientId);
    authUrl.searchParams.set("redirect_uri", redirectUri);
    authUrl.searchParams.set("response_type", "code");
    authUrl.searchParams.set("scope", "openid email profile");
    authUrl.searchParams.set("prompt", "select_account");
    redirect(res, authUrl.toString());
    return;
  }

  if (url.pathname === "/api/auth/apple") {
    const clientId = process.env.APPLE_CLIENT_ID;
    if (!clientId) {
      const session = createSession(upsertSocialUser("apple"));
      if ((req.headers.accept || "").includes("application/json")) {
        sendJson(res, 200, session);
        return;
      }
      redirect(res, `/?v=14#browse&auth=apple&token=${encodeURIComponent(session.token)}`);
      return;
    }
    const redirectUri = `http://${req.headers.host}/api/auth/callback/apple`;
    const authUrl = new URL("https://appleid.apple.com/auth/authorize");
    authUrl.searchParams.set("client_id", clientId);
    authUrl.searchParams.set("redirect_uri", redirectUri);
    authUrl.searchParams.set("response_type", "code");
    authUrl.searchParams.set("scope", "name email");
    authUrl.searchParams.set("response_mode", "form_post");
    redirect(res, authUrl.toString());
    return;
  }

  if (url.pathname.startsWith("/api/auth/callback/")) {
    sendHtml(res, 200, `<!doctype html>
      <html lang="en">
        <head><meta charset="utf-8"><title>Kerodex Auth</title></head>
        <body style="font-family:system-ui;margin:48px;max-width:680px">
          <h1>Kerodex authentication callback</h1>
          <p>The provider returned to the local development app. A production build would exchange the code for tokens here.</p>
          <p><a href="/?v=9#browse">Return to Kerodex</a></p>
        </body>
      </html>`);
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
      .then((body) => {
        const mode = body.mode === "create" ? "create" : "signin";
        const email = normalize(body.email);
        const password = String(body.password || "");

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
            name: email.split("@")[0],
            password,
            provider: "email"
          };
          users.set(email, user);
          sendJson(res, 201, createSession(user));
          return;
        }

        if (!existing || existing.password !== password) {
          sendJson(res, 401, { error: "Email or password is incorrect." });
          return;
        }

        sendJson(res, 200, createSession(existing));
      })
      .catch(() => sendJson(res, 400, { error: "Invalid request body." }));
    return;
  }

  if (url.pathname === "/api/listings") {
    sendJson(res, 200, { listings: filterListings(url.searchParams) });
    return;
  }

  if (url.pathname.startsWith("/api/listings/")) {
    const id = url.pathname.split("/").pop();
    const listing = store.getListingById(id);
    sendJson(res, listing ? 200 : 404, listing || { error: "Listing not found" });
    return;
  }

  if (url.pathname === "/api/conversations") {
    sendJson(res, 200, { conversations: store.getConversations() });
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
