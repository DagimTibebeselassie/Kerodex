const fs = require("fs");
const path = require("path");

function loadEnvFile(filePath) {
  if (!fs.existsSync(filePath)) return;
  for (const line of fs.readFileSync(filePath, "utf8").split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#") || !trimmed.includes("=")) continue;
    const index = trimmed.indexOf("=");
    const key = trimmed.slice(0, index).trim();
    let value = trimmed.slice(index + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) value = value.slice(1, -1);
    if (key && process.env[key] === undefined) process.env[key] = value;
  }
}

const root = path.resolve(__dirname, "..");
[path.join(root, ".env"), path.join(root, ".env.local")].forEach(loadEnvFile);

const buyerGuide = require("../apps/api/buyer-guide");

(async () => {
  const recommendations = await buyerGuide.generateRecommendations({
    purpose: "commuting",
    idealBudget: 18000,
    maxPrice: 22000,
    passengers: 2,
    priorities: ["reliability", "fuel economy", "low maintenance"],
    bodyTypes: ["sedan", "hatchback"],
    agePreference: "balanced",
    fuelEconomy: "very_important",
    longDistance: "sometimes",
    cargo: "some"
  });

  if (!recommendations?.buyerProfileSummary) throw new Error("Missing buyer profile summary.");
  if (!Array.isArray(recommendations.recommendedModels) || recommendations.recommendedModels.length < 3) {
    throw new Error("Structured recommendations did not include at least three models.");
  }
  if (!recommendations.kerodexFilters || !Array.isArray(recommendations.kerodexFilters.models)) {
    throw new Error("Structured Kerodex filters are missing.");
  }
  if (!Array.isArray(recommendations.safetyNotes) || recommendations.safetyNotes.length < 2) {
    throw new Error("Structured safety notes are missing.");
  }

  console.log(JSON.stringify({
    ok: true,
    provider: recommendations.provider,
    modelCount: recommendations.recommendedModels.length,
    filterModelCount: recommendations.kerodexFilters.models.length,
    safetyNoteCount: recommendations.safetyNotes.length,
    providerError: recommendations.providerError || ""
  }, null, 2));
})().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
