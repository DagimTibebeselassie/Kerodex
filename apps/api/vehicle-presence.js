const crypto = require("crypto");

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

function openAiConfig() {
  const apiKey = process.env.OPENAI_API_KEY || process.env.VEHICLE_PRESENCE_OPENAI_API_KEY || "";
  if (!apiKey) return null;
  return {
    apiKey,
    model: process.env.VEHICLE_PRESENCE_MODEL || "gpt-4o-mini"
  };
}

async function analyzeWithOpenAi({ imageUrl, code, listing, ocrText = "" }) {
  const config = openAiConfig();
  if (!config) {
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

  const prompt = [
    "You are reviewing a private-party car listing verification photo for Kerodex.",
    "The seller was instructed to hold or place a handwritten or printed verification code next to the windshield VIN plate visible through the windshield.",
    "Determine whether the photo likely shows a real vehicle, a visible windshield VIN plate, and a visible handwritten or printed verification code beside that windshield VIN.",
    "The exact listing-specific code must match. The visible VIN must match the listing VIN.",
    "Look for screenshot-like artifacts such as app chrome, browser UI, obvious copied marketplace screenshots, or a photo of a screen.",
    "Return JSON only with keys: vehicleVisible, vinPlateVisible, textVisible, codeMatches, vinMatches, likelyNewPhoto, confidence, observedText, observedVin, reason.",
    `Expected verification code: ${code}`,
    `Expected VIN: ${listing.vin || ""}`,
    `OCR text from the uploaded photo: ${ocrText || "not available"}`,
    `Listing: ${listing.year || ""} ${listing.make || ""} ${listing.model || ""}`.trim()
  ].join("\n");

  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      authorization: `Bearer ${config.apiKey}`,
      "content-type": "application/json"
    },
    body: JSON.stringify({
      model: config.model,
      input: [{
        role: "user",
        content: [
          { type: "input_text", text: prompt },
          { type: "input_image", image_url: imageUrl }
        ]
      }]
    })
  });

  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    return {
      status: PRESENCE_STATUSES.MANUAL_REVIEW,
      confidence: 0,
      reason: body.error?.message || `AI verification failed with status ${response.status}.`,
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
    body.output_text ||
    body.output?.flatMap((item) => item.content || []).map((part) => part.text || "").join("\n") ||
    "";
  const parsed = parseJsonObject(outputText) || {};
  const confidence = Math.max(0, Math.min(1, Number(parsed.confidence || 0)));
  const combinedText = [ocrText, parsed.observedText, parsed.observedVin].filter(Boolean).join("\n");
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

  return {
    status,
    confidence,
    reason: String(parsed.reason || ""),
    observedText: String(parsed.observedText || ""),
    observedVin: String(parsed.observedVin || extractedVins[0] || ""),
    extractedVins,
    ocrText,
    checks,
    provider: "openai",
    raw: parsed
  };
}

async function analyze({ imageUrl, code, listing, ocrText = "" }) {
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
  return analyzeWithOpenAi({ imageUrl, code, listing, ocrText });
}

module.exports = {
  PRESENCE_STATUSES,
  analyze,
  expiresAt,
  extractVins,
  generateCode,
  normalizeVin,
  normalizeCode
};
