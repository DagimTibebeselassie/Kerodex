const crypto = require("crypto");
const { URL } = require("url");

const PRESENCE_STATUSES = {
  PENDING: "pending_verification",
  IN_PROGRESS: "verification_in_progress",
  VERIFIED: "verified",
  CODE_MISSING: "rejected_code_mismatch",
  CODE_MISMATCH: "rejected_code_mismatch",
  VIN_MISMATCH: "rejected_vin_mismatch",
  VIN_NOT_DETECTED: "rejected_vin_not_detected",
  VEHICLE_NOT_DETECTED: "rejected_vin_not_detected",
  MANUAL_REVIEW: "manual_review_required"
};

function generateCode() {
  const prefixes = ["KRX", "KDX", "KER"];
  const prefix = prefixes[crypto.randomInt(0, prefixes.length)];
  const digits = crypto.randomInt(1000, 10000);
  return `${prefix}-${digits}`;
}

function expiresAt(hours = 36) {
  return new Date(Date.now() + hours * 60 * 60 * 1000).toISOString();
}

function normalizeCode(value) {
  return String(value || "").toUpperCase().replace(/[^A-Z0-9]/g, "");
}

function normalizeVin(value) {
  return String(value || "").toUpperCase().replace(/[^A-Z0-9]/g, "");
}

function extractVins(text) {
  return Array.from(new Set(String(text || "").toUpperCase().match(/[A-HJ-NPR-Z0-9]{17}/g) || []));
}

function parseJsonObject(text) {
  const raw = String(text || "").trim();
  try {
    return JSON.parse(raw);
  } catch {
    const match = raw.match(/\{[\s\S]*\}/);
    if (!match) return null;
    try {
      return JSON.parse(match[0]);
    } catch {
      return null;
    }
  }
}

function vehiclePresenceLog(event, payload = {}) {
  console.info(`[vehicle-presence] ${event}`, {
    at: new Date().toISOString(),
    ...payload
  });
}

function vehiclePresenceError(event, payload = {}) {
  console.error(`[vehicle-presence] ${event}`, {
    at: new Date().toISOString(),
    ...payload
  });
}

function safeImageUrlSummary(imageUrl = "") {
  if (!imageUrl) return { present: false };
  try {
    const parsed = new URL(imageUrl);
    return {
      present: true,
      protocol: parsed.protocol,
      host: parsed.host,
      pathname: parsed.pathname,
      hasQuery: Boolean(parsed.search)
    };
  } catch {
    return {
      present: true,
      invalidUrl: true,
      length: String(imageUrl).length
    };
  }
}

function openAiErrorDetail(body, status) {
  if (body?.error?.message) return body.error.message;
  if (typeof body === "string" && body.trim()) return body.trim().slice(0, 1000);
  return `AI verification failed with status ${status}.`;
}

function openAiConfig() {
  const apiKey = process.env.OPENAI_API_KEY || process.env.VEHICLE_PRESENCE_OPENAI_API_KEY || "";
  if (!apiKey) return null;
  return {
    apiKey,
    model: process.env.VEHICLE_PRESENCE_MODEL || "gpt-4o-mini"
  };
}

async function analyzeWithOpenAi({ imageUrl, code, listing }) {
  const config = openAiConfig();
  if (!config) {
    vehiclePresenceLog("OpenAI client not initialized; missing API key", {
      hasOpenAiKey: Boolean(process.env.OPENAI_API_KEY),
      hasVehiclePresenceKey: Boolean(process.env.VEHICLE_PRESENCE_OPENAI_API_KEY)
    });
    return {
      status: PRESENCE_STATUSES.MANUAL_REVIEW,
      confidence: 0,
      reason: "AI provider is not configured. Manual review is required.",
      checks: {
        vehicleVisible: false,
        vinPlateVisible: false,
        vinMatches: false,
        textVisible: false,
        codeMatches: false,
        likelyNewPhoto: false
      },
      provider: "manual_review_fallback"
    };
  }

  vehiclePresenceLog("OpenAI client initialized", {
    model: config.model,
    keySource: process.env.OPENAI_API_KEY ? "OPENAI_API_KEY" : "VEHICLE_PRESENCE_OPENAI_API_KEY",
    keyPresent: true
  });

  const prompt = [
    "You are reviewing a private-party car listing verification photo for Kerodex.",
    "The seller was instructed to hold or place a handwritten or printed verification code next to the windshield VIN plate visible through the windshield.",
    "Determine whether the photo likely shows a real vehicle, a visible windshield VIN plate, and a visible handwritten or printed verification code beside that windshield VIN.",
    "Extract the visible VIN from the image. Extract the visible verification code from the image. The exact listing-specific code must match. The visible VIN must match the listing VIN.",
    "Look for screenshot-like artifacts such as app chrome, browser UI, obvious copied marketplace screenshots, or a photo of a screen.",
    "Return JSON only with keys: vehicleVisible, vinPlateVisible, textVisible, codeMatches, vinMatches, likelyNewPhoto, confidence, observedText, observedVin, reason.",
    "Confidence must be a decimal from 0.0 to 1.0, not a percentage.",
    `Expected verification code: ${code}`,
    `Expected VIN: ${listing.vin || ""}`,
    `Listing: ${listing.year || ""} ${listing.make || ""} ${listing.model || ""}`.trim()
  ].join("\n");

  const requestBody = {
    model: config.model,
    input: [{
      role: "user",
      content: [
        { type: "input_text", text: prompt },
        { type: "input_image", image_url: imageUrl }
      ]
    }]
  };

  vehiclePresenceLog("OpenAI request started", {
    model: requestBody.model,
    listingId: listing.id || "",
    vinPresent: Boolean(normalizeVin(listing.vin)),
    expectedVinLength: normalizeVin(listing.vin).length,
    expectedCodePresent: Boolean(code),
    image: safeImageUrlSummary(imageUrl),
    contentTypes: requestBody.input[0].content.map((part) => part.type)
  });

  let response;
  try {
    response = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        authorization: `Bearer ${config.apiKey}`,
        "content-type": "application/json"
      },
      body: JSON.stringify(requestBody)
    });
  } catch (error) {
    vehiclePresenceError("OpenAI request failed", {
      model: config.model,
      listingId: listing.id || "",
      error: error.message
    });
    throw error;
  }

  const responseText = await response.text();
  let body = {};
  try {
    body = responseText ? JSON.parse(responseText) : {};
  } catch {
    body = responseText || {};
  }

  vehiclePresenceLog("OpenAI request succeeded", {
    model: config.model,
    listingId: listing.id || "",
    status: response.status,
    ok: response.ok,
    responseId: typeof body === "object" ? body.id || "" : "",
    outputTextLength: typeof body === "object" ? String(body.output_text || "").length : 0,
    errorType: typeof body === "object" ? body.error?.type || "" : "",
    errorCode: typeof body === "object" ? body.error?.code || "" : ""
  });

  if (!response.ok) {
    vehiclePresenceError("OpenAI request failed", {
      model: config.model,
      listingId: listing.id || "",
      status: response.status,
      message: openAiErrorDetail(body, response.status),
      type: typeof body === "object" ? body.error?.type || "" : "",
      code: typeof body === "object" ? body.error?.code || "" : ""
    });
    return {
      status: PRESENCE_STATUSES.MANUAL_REVIEW,
      confidence: 0,
      reason: openAiErrorDetail(body, response.status),
      checks: {
        vehicleVisible: false,
        vinPlateVisible: false,
        vinMatches: false,
        textVisible: false,
        codeMatches: false,
        likelyNewPhoto: false
      },
      provider: "openai",
      raw: body
    };
  }

  const outputText =
    (typeof body === "object" ? body.output_text : "") ||
    (typeof body === "object" ? body.output?.flatMap((item) => item.content || []).map((part) => part.text || "").join("\n") : "") ||
    "";
  const parsed = parseJsonObject(outputText) || {};
  const confidence = Math.max(0, Math.min(1, Number(parsed.confidence || 0)));
  const combinedText = [parsed.observedText, parsed.observedVin].filter(Boolean).join("\n");
  const expectedVin = normalizeVin(listing.vin);
  const extractedVins = extractVins(combinedText);
  const vinMatches = Boolean(expectedVin && extractedVins.includes(expectedVin)) ||
    Boolean(parsed.vinMatches && expectedVin);
  const codeMatches = normalizeCode(combinedText).includes(normalizeCode(code)) || Boolean(parsed.codeMatches);
  const likelyNewPhoto = parsed.likelyNewPhoto !== false;
  const checks = {
    vehicleVisible: Boolean(parsed.vehicleVisible),
    vinPlateVisible: Boolean(parsed.vinPlateVisible) || vinMatches,
    vinMatches,
    textVisible: Boolean(parsed.textVisible) || codeMatches,
    codeMatches,
    likelyNewPhoto
  };

  let status = PRESENCE_STATUSES.VERIFIED;
  if (!expectedVin || (!extractedVins.length && !checks.vinMatches)) status = PRESENCE_STATUSES.VIN_NOT_DETECTED;
  else if (!checks.vinMatches) status = PRESENCE_STATUSES.VIN_MISMATCH;
  else if (!checks.vehicleVisible || !checks.vinPlateVisible) status = PRESENCE_STATUSES.VIN_NOT_DETECTED;
  else if (!checks.textVisible) status = PRESENCE_STATUSES.CODE_MISMATCH;
  else if (!checks.codeMatches) status = PRESENCE_STATUSES.CODE_MISMATCH;
  else if (!checks.likelyNewPhoto || confidence < 0.65) status = PRESENCE_STATUSES.MANUAL_REVIEW;

  vehiclePresenceLog("OpenAI verification interpreted", {
    listingId: listing.id || "",
    status,
    confidence,
    checks,
    extractedVinCount: extractedVins.length,
    observedVinPresent: Boolean(parsed.observedVin || extractedVins[0]),
    reason: String(parsed.reason || "").slice(0, 300)
  });

  return {
    status,
    confidence,
    reason: String(parsed.reason || ""),
    observedText: String(parsed.observedText || ""),
    observedVin: String(parsed.observedVin || extractedVins[0] || ""),
    extractedVins,
    checks,
    provider: "openai",
    raw: parsed
  };
}

async function analyze({ imageUrl, code, listing }) {
  if (!imageUrl || !code) {
    return {
      status: PRESENCE_STATUSES.CODE_MISSING,
      confidence: 0,
      reason: "Verification photo or code is missing.",
      checks: {
        vehicleVisible: false,
        vinPlateVisible: false,
        vinMatches: false,
        textVisible: false,
        codeMatches: false,
        likelyNewPhoto: false
      },
      provider: "server"
    };
  }
  return analyzeWithOpenAi({ imageUrl, code, listing });
}

module.exports = {
  PRESENCE_STATUSES,
  analyze,
  expiresAt,
  extractVins,
  generateCode,
  openAiConfig,
  normalizeVin,
  normalizeCode
};
