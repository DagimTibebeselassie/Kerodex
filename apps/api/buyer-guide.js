const RECOMMENDATION_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: [
    "buyerProfileSummary",
    "recommendedCategories",
    "recommendedModels",
    "kerodexFilters",
    "safetyNotes"
  ],
  properties: {
    buyerProfileSummary: { type: "string" },
    recommendedCategories: {
      type: "array",
      minItems: 1,
      maxItems: 4,
      items: { type: "string" }
    },
    recommendedModels: {
      type: "array",
      minItems: 3,
      maxItems: 8,
      items: {
        type: "object",
        additionalProperties: false,
        required: ["make", "model", "reason", "idealYears", "idealMileageMax", "tradeoffs"],
        properties: {
          make: { type: "string" },
          model: { type: "string" },
          reason: { type: "string" },
          idealYears: { type: "string" },
          idealMileageMax: { type: "integer" },
          tradeoffs: { type: "array", items: { type: "string" }, maxItems: 4 }
        }
      }
    },
    kerodexFilters: {
      type: "object",
      additionalProperties: false,
      required: ["makes", "models", "maxPrice", "bodyTypes", "maxMileage"],
      properties: {
        makes: { type: "array", items: { type: "string" } },
        models: { type: "array", items: { type: "string" } },
        maxPrice: { type: "integer" },
        bodyTypes: { type: "array", items: { type: "string" } },
        maxMileage: { type: "integer" }
      }
    },
    safetyNotes: { type: "array", minItems: 2, maxItems: 6, items: { type: "string" } }
  }
};

const MODEL_CATALOG = [
  { make: "Toyota", model: "Corolla", bodyType: "sedan", strengths: ["reliability", "fuel economy", "low maintenance"], tradeoff: "Less cargo room than a crossover." },
  { make: "Honda", model: "Civic", bodyType: "sedan", strengths: ["reliability", "fuel economy", "comfort"], tradeoff: "Clean examples can command higher used prices." },
  { make: "Mazda", model: "Mazda3", bodyType: "sedan", strengths: ["style", "comfort", "performance"], tradeoff: "Rear-seat space is tighter than some rivals." },
  { make: "Toyota", model: "Prius", bodyType: "hatchback", strengths: ["fuel economy", "reliability", "cargo"], tradeoff: "Battery condition matters on older examples." },
  { make: "Toyota", model: "RAV4", bodyType: "SUV", strengths: ["reliability", "cargo", "space"], tradeoff: "Usually costs more than a comparable sedan." },
  { make: "Honda", model: "CR-V", bodyType: "SUV", strengths: ["space", "reliability", "comfort"], tradeoff: "Popular trims can be priced aggressively." },
  { make: "Mazda", model: "CX-5", bodyType: "SUV", strengths: ["style", "comfort", "performance"], tradeoff: "Cargo space trails the roomiest compact SUVs." },
  { make: "Subaru", model: "Outback", bodyType: "SUV", strengths: ["cargo", "long distance", "space"], tradeoff: "Maintenance history is especially important." },
  { make: "Toyota", model: "Highlander", bodyType: "SUV", strengths: ["passengers", "space", "reliability"], tradeoff: "Higher purchase price and fuel use than compact SUVs." },
  { make: "Honda", model: "Odyssey", bodyType: "minivan", strengths: ["passengers", "cargo", "comfort"], tradeoff: "Large footprint and higher fuel use." },
  { make: "Ford", model: "Maverick", bodyType: "truck", strengths: ["cargo", "fuel economy", "utility"], tradeoff: "Used availability and pricing can vary widely." },
  { make: "Toyota", model: "Tacoma", bodyType: "truck", strengths: ["reliability", "utility", "resale"], tradeoff: "Ride comfort and fuel economy are truck-like." }
];

function numberAnswer(answers, key, fallback) {
  const value = Number(answers?.[key]);
  return Number.isFinite(value) ? value : fallback;
}

function arrayAnswer(answers, key) {
  const value = answers?.[key];
  return Array.isArray(value) ? value.map(String).filter(Boolean) : value ? [String(value)] : [];
}

function fallbackRecommendations(answers = {}) {
  const idealBudget = numberAnswer(answers, "idealBudget", 18000);
  const maxPrice = Math.max(idealBudget, numberAnswer(answers, "maxPrice", idealBudget + 4000));
  const passengers = numberAnswer(answers, "passengers", 2);
  const priorities = arrayAnswer(answers, "priorities").map((value) => value.toLowerCase());
  const requestedBodies = arrayAnswer(answers, "bodyTypes").map((value) => value.toLowerCase());
  const liked = String(answers.likes || "").toLowerCase();
  const disliked = String(answers.dislikes || "").toLowerCase();
  const inferredBodies = requestedBodies.length
    ? requestedBodies
    : passengers >= 6
      ? ["suv", "minivan"]
      : passengers >= 4 || answers.cargo === "important"
        ? ["suv", "hatchback"]
        : ["sedan", "hatchback"];

  const scored = MODEL_CATALOG.map((item) => {
    let score = inferredBodies.includes(item.bodyType.toLowerCase()) ? 5 : 0;
    score += item.strengths.filter((strength) => priorities.some((priority) => strength.includes(priority) || priority.includes(strength))).length * 2;
    if (liked.includes(item.make.toLowerCase()) || liked.includes(item.model.toLowerCase())) score += 4;
    if (disliked.includes(item.make.toLowerCase()) || disliked.includes(item.model.toLowerCase())) score -= 10;
    if (answers.longDistance === "often" && item.strengths.includes("comfort")) score += 2;
    if (answers.fuelEconomy === "very_important" && item.strengths.includes("fuel economy")) score += 3;
    return { ...item, score };
  }).sort((a, b) => b.score - a.score).slice(0, 6);

  const maxMileage = maxPrice < 14000 ? 120000 : maxPrice < 22000 ? 100000 : 80000;
  const yearStart = maxPrice < 14000 ? 2014 : maxPrice < 22000 ? 2017 : 2020;
  const models = scored.map((item) => ({
    make: item.make,
    model: item.model,
    reason: `${item.make} ${item.model} aligns with your priorities around ${item.strengths.slice(0, 2).join(" and ")}.`,
    idealYears: `${yearStart}-${new Date().getFullYear()}`,
    idealMileageMax: maxMileage,
    tradeoffs: [item.tradeoff]
  }));

  return {
    buyerProfileSummary: `You are looking for a ${inferredBodies.join(" or ")} around $${idealBudget.toLocaleString()}, with a serious ceiling near $${maxPrice.toLocaleString()}.`,
    recommendedCategories: inferredBodies,
    recommendedModels: models,
    kerodexFilters: {
      makes: Array.from(new Set(models.map((item) => item.make))),
      models: models.map((item) => item.model),
      maxPrice,
      bodyTypes: inferredBodies,
      maxMileage
    },
    safetyNotes: [
      "Get an independent pre-purchase inspection before paying.",
      "Verify that the VIN matches the listing, vehicle, and title.",
      "Confirm the title is in the seller's name and review any lien or title branding.",
      "Avoid gift cards, crypto, or wire transfers before seeing the vehicle and documents."
    ],
    provider: "static_fallback"
  };
}

function parseResponseOutput(body) {
  const outputText =
    body?.output_text ||
    body?.output?.flatMap((item) => item.content || []).map((part) => part.text || "").join("\n") ||
    "";
  try {
    return JSON.parse(outputText);
  } catch {
    const match = String(outputText).match(/\{[\s\S]*\}/);
    if (!match) return null;
    try {
      return JSON.parse(match[0]);
    } catch {
      return null;
    }
  }
}

async function generateRecommendations(answers = {}) {
  const apiKey = process.env.OPENAI_API_KEY || process.env.BUYER_GUIDE_OPENAI_API_KEY || "";
  if (!apiKey) return fallbackRecommendations(answers);
  const model = process.env.BUYER_GUIDE_MODEL || "gpt-4o-mini";
  const fallback = fallbackRecommendations(answers);
  const prompt = [
    "Create safe, practical used-vehicle recommendations for the Kerodex Buyer Guide.",
    "Base recommendations on buyer needs, not current inventory.",
    "Do not claim Kerodex guarantees a seller, listing, vehicle, title, inspection, or legal outcome.",
    "Do not provide absolute legal advice. Always encourage VIN, title, seller identity, and inspection checks.",
    "Never recommend gift cards, crypto, or wire transfers to an unknown seller.",
    `Buyer answers: ${JSON.stringify(answers)}`,
    `Use this deterministic fallback as context, but improve it when appropriate: ${JSON.stringify(fallback)}`
  ].join("\n");

  try {
    const response = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        authorization: `Bearer ${apiKey}`,
        "content-type": "application/json"
      },
      body: JSON.stringify({
        model,
        input: [{ role: "user", content: [{ type: "input_text", text: prompt }] }],
        text: {
          format: {
            type: "json_schema",
            name: "buyer_guide_recommendations",
            strict: true,
            schema: RECOMMENDATION_SCHEMA
          }
        }
      })
    });
    const body = await response.json().catch(() => ({}));
    if (!response.ok) return { ...fallback, providerError: body?.error?.message || `OpenAI status ${response.status}` };
    const parsed = parseResponseOutput(body);
    return parsed ? { ...parsed, provider: "openai" } : { ...fallback, providerError: "Structured recommendation output could not be parsed." };
  } catch (error) {
    return { ...fallback, providerError: error.message || "Recommendation provider unavailable." };
  }
}

function listingMatch(listing, recommendations) {
  const filters = recommendations.kerodexFilters || {};
  const make = String(listing.make || "").toLowerCase();
  const model = String(listing.model || "").toLowerCase();
  const bodyType = String(listing.bodyType || "").toLowerCase();
  const exactModels = (filters.models || []).map((value) => String(value).toLowerCase());
  const makes = (filters.makes || []).map((value) => String(value).toLowerCase());
  const bodyTypes = (filters.bodyTypes || []).map((value) => String(value).toLowerCase());
  const maxPrice = Number(filters.maxPrice || 0);
  const maxMileage = Number(filters.maxMileage || 0);
  let score = 0;
  const reasons = [];
  const concerns = [];
  if (listing.isDemo || listing.is_demo) {
    reasons.push("Available for testing the Kerodex buying flow");
    concerns.push("Demo listing only; this vehicle is not actually for sale. Messages use an automated demo seller.");
  }
  if (exactModels.includes(model)) { score += 45; reasons.push("Recommended model"); }
  else if (makes.includes(make)) { score += 20; reasons.push("Recommended make"); }
  if (bodyTypes.some((value) => bodyType.includes(value) || value.includes(bodyType))) { score += 20; reasons.push("Body style fits your needs"); }
  if (!maxPrice || Number(listing.price || 0) <= maxPrice) { score += 20; reasons.push("Within your maximum budget"); }
  else concerns.push(`Price is $${Math.round(Number(listing.price) - maxPrice).toLocaleString()} above your stated maximum.`);
  if (!maxMileage || Number(listing.mileage || 0) <= maxMileage) { score += 10; reasons.push("Mileage is within your target"); }
  else concerns.push("Mileage is above your preferred range.");
  if (listing.vehiclePresenceVerified || String(listing.verificationStatus || "").includes("verified")) score += 5;
  else concerns.push("Vehicle presence verification is not complete; verify the VIN and vehicle in person.");
  if (String(listing.titleStatus || "").toLowerCase().includes("salvage") || String(listing.titleStatus || "").toLowerCase().includes("rebuilt")) {
    concerns.push(`Review the disclosed ${listing.titleStatus} carefully with an inspection and title check.`);
  }
  return {
    listing,
    score,
    matchLevel: score >= 70 ? "best" : score >= 40 ? "close" : "explore",
    matchReason: reasons.slice(0, 3).join(". ") || "A broader inventory option to compare.",
    concerns
  };
}

function matchListings(listings = [], recommendations) {
  return listings
    .filter((listing) => ["active", "available", "pending_review"].includes(String(listing.status || "active")))
    .map((listing) => listingMatch(listing, recommendations))
    .sort((a, b) => b.score - a.score)
    .slice(0, 12);
}

module.exports = {
  RECOMMENDATION_SCHEMA,
  fallbackRecommendations,
  generateRecommendations,
  matchListings
};
