const MARKETCHECK_HOST = "https://api.marketcheck.com";
const TOKEN_URL = `${MARKETCHECK_HOST}/oauth2/token`;
const TOKEN_SKEW_MS = 60 * 1000;

let tokenCache = null;

class MarketCheckError extends Error {
  constructor(message, { status = 500, code = "marketcheck_error", detail = "" } = {}) {
    super(message);
    this.name = "MarketCheckError";
    this.status = status;
    this.code = code;
    this.detail = detail;
  }
}

function normalizeVin(value) {
  return String(value || "").trim().toUpperCase().replace(/[^A-Z0-9]/g, "");
}

function assertValidVin(value) {
  const vin = normalizeVin(value);
  if (!/^[A-HJ-NPR-Z0-9]{17}$/.test(vin)) {
    throw new MarketCheckError("VIN must be exactly 17 characters and cannot include I, O, or Q.", {
      status: 400,
      code: "invalid_vin"
    });
  }
  return vin;
}

function credentials() {
  const apiKey = process.env.MARKETCHECK_API_KEY;
  const clientSecret = process.env.MARKETCHECK_CLIENT_SECRET;
  if (!apiKey) {
    throw new MarketCheckError("MarketCheck credentials are missing.", {
      status: 503,
      code: "missing_marketcheck_credentials"
    });
  }
  return { apiKey, clientSecret };
}

function classifyError(status, body) {
  const detail = typeof body === "string" ? body : JSON.stringify(body || {});
  if (status === 401 || status === 403) {
    return new MarketCheckError("MarketCheck authentication failed.", {
      status: 502,
      code: "marketcheck_auth_error",
      detail
    });
  }
  if (status === 429) {
    return new MarketCheckError("MarketCheck rate limit reached.", {
      status: 429,
      code: "marketcheck_rate_limited",
      detail
    });
  }
  if (status >= 500) {
    return new MarketCheckError("MarketCheck service is unavailable.", {
      status: 502,
      code: "marketcheck_server_error",
      detail
    });
  }
  return new MarketCheckError("MarketCheck request failed.", {
    status: 502,
    code: "marketcheck_request_failed",
    detail
  });
}

async function readJson(response) {
  const text = await response.text();
  if (!text) return {};
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

async function getAccessToken() {
  const { apiKey, clientSecret } = credentials();
  if (!clientSecret) {
    throw new MarketCheckError("MarketCheck OAuth client secret is missing.", {
      status: 503,
      code: "missing_marketcheck_oauth_credentials"
    });
  }
  if (tokenCache && tokenCache.expiresAt > Date.now() + TOKEN_SKEW_MS) {
    return tokenCache.token;
  }

  const response = await fetch(TOKEN_URL, {
    method: "POST",
    headers: {
      accept: "application/json",
      "content-type": "application/json"
    },
    body: JSON.stringify({
      grant_type: "client_credentials",
      client_id: apiKey,
      client_secret: clientSecret
    })
  });
  const body = await readJson(response);
  if (!response.ok) throw classifyError(response.status, body);

  const token = body.access_token || body.token;
  if (!token) {
    throw new MarketCheckError("MarketCheck OAuth token response did not include an access token.", {
      status: 502,
      code: "marketcheck_oauth_token_missing"
    });
  }
  const expiresIn = Number(body.expires_in || 6 * 60 * 60);
  tokenCache = {
    token,
    expiresAt: Date.now() + expiresIn * 1000
  };
  return token;
}

async function requestMarketCheck(pathname, params = {}, { useOAuth = false } = {}) {
  const { apiKey } = credentials();
  const url = new URL(useOAuth ? `${MARKETCHECK_HOST}/oauth/v2${pathname}` : `${MARKETCHECK_HOST}/v2${pathname}`);
  Object.entries(params).forEach(([key, value]) => {
    if (value === undefined || value === null || value === "") return;
    url.searchParams.set(key, String(value));
  });

  const headers = { accept: "application/json" };
  if (useOAuth) {
    headers.authorization = `Bearer ${await getAccessToken()}`;
  } else {
    url.searchParams.set("api_key", apiKey);
  }

  const response = await fetch(url, { headers });
  const body = await readJson(response);
  if (!response.ok) throw classifyError(response.status, body);
  return body;
}

async function marketCheckGet(pathname, params = {}) {
  try {
    return await requestMarketCheck(pathname, params, { useOAuth: false });
  } catch (error) {
    if (
      error instanceof MarketCheckError &&
      error.code === "marketcheck_auth_error" &&
      process.env.MARKETCHECK_CLIENT_SECRET
    ) {
      return requestMarketCheck(pathname, params, { useOAuth: true });
    }
    throw error;
  }
}

function findValueDeep(value, keys) {
  const wanted = new Set(keys.map((key) => key.toLowerCase()));
  const seen = new Set();

  function visit(node) {
    if (!node || typeof node !== "object" || seen.has(node)) return "";
    seen.add(node);
    if (Array.isArray(node)) {
      for (const item of node) {
        const found = visit(item);
        if (found !== "") return found;
      }
      return "";
    }
    for (const [key, item] of Object.entries(node)) {
      if (wanted.has(key.toLowerCase()) && item !== undefined && item !== null && item !== "") return item;
    }
    for (const item of Object.values(node)) {
      const found = visit(item);
      if (found !== "") return found;
    }
    return "";
  }

  return visit(value);
}

function findNumberDeep(value, keys) {
  const found = findValueDeep(value, keys);
  const number = Number(found);
  return Number.isFinite(number) ? number : null;
}

function normalizeDecode(raw, vin) {
  return {
    vin,
    year: String(findValueDeep(raw, ["year", "model_year", "modelYear", "ModelYear"]) || ""),
    make: String(findValueDeep(raw, ["make", "Make"]) || ""),
    model: String(findValueDeep(raw, ["model", "Model"]) || ""),
    trim: String(findValueDeep(raw, ["trim", "Trim", "series", "Series"]) || ""),
    body_type: String(findValueDeep(raw, ["body_type", "bodyType", "body_style", "bodyStyle", "bodyClass", "BodyClass"]) || ""),
    engine: String(findValueDeep(raw, ["engine", "engine_description", "engineDescription", "engine_size", "engineSize"]) || ""),
    transmission: String(findValueDeep(raw, ["transmission", "transmission_type", "transmissionType"]) || ""),
    drivetrain: String(findValueDeep(raw, ["drivetrain", "drive_type", "driveType", "DriveType"]) || ""),
    fuel_type: String(findValueDeep(raw, ["fuel_type", "fuelType", "FuelTypePrimary"]) || ""),
    raw
  };
}

function normalizeMarketValue(raw, { vin, mileage, zip, location, condition, radius }) {
  const marketValue =
    findNumberDeep(raw, ["marketcheck_price", "marketcheckPrice", "predicted_price", "predictedPrice", "price", "market_value", "marketValue"]) ||
    null;
  const msrp = findNumberDeep(raw, ["msrp", "predicted_msrp", "predictedMsrp"]);
  const comparableCount =
    findNumberDeep(raw, ["comparable_count", "comparableCount", "comparables_count", "comparablesCount", "total"]) ||
    (Array.isArray(raw?.comparables) ? raw.comparables.length : 0);

  return {
    vin,
    marketValue,
    msrp,
    mileage: Number(mileage || 0),
    zip: zip || "",
    location: location || "",
    condition: condition || "",
    valuationDate: new Date().toISOString(),
    radiusUsed: Number(radius || 100),
    comparableCount: Number(comparableCount || 0),
    raw
  };
}

async function decodeVin(vin) {
  const cleanVin = assertValidVin(vin);
  const raw = await marketCheckGet(`/decode/car/${encodeURIComponent(cleanVin)}/specs`);
  return normalizeDecode(raw, cleanVin);
}

async function getMarketValue({ vin, mileage, zip, location, condition, radius = 100 }) {
  const cleanVin = assertValidVin(vin);
  const params = {
    vin: cleanVin,
    miles: Number(mileage || 0),
    dealer_type: "independent",
    zip,
    is_certified: false
  };

  if (!zip && location) {
    const [city, state] = String(location).split(",").map((item) => item.trim());
    if (city) params.city = city;
    if (state) params.state = state.length === 2 ? state.toUpperCase() : state;
  }

  const raw = await marketCheckGet("/predict/car/us/marketcheck_price", params);
  return normalizeMarketValue(raw, { vin: cleanVin, mileage, zip, location, condition, radius });
}

module.exports = {
  MarketCheckError,
  assertValidVin,
  decodeVin,
  getMarketValue,
  normalizeVin
};
