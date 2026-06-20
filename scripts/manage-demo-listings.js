const fs = require("fs");
const path = require("path");
const {
  LEGACY_DEMO_LISTING_IDS,
  LEGACY_DEMO_SELLER_IDS,
  buildDemoListings,
  buildDemoSellers,
  isDemoRecord
} = require("./demo-listings-data");

function loadLocalEnvFile(filePath) {
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
const seedDir = path.join(root, "apps", "api", "seed");
const listingFile = path.join(seedDir, "listings.json");
const sellerFile = path.join(seedDir, "sellers.json");
const conversationFile = path.join(seedDir, "conversations.json");

loadLocalEnvFile(path.join(root, ".env.local"));
loadLocalEnvFile(path.join(root, ".env"));

function readJson(filePath) {
  return fs.existsSync(filePath) ? JSON.parse(fs.readFileSync(filePath, "utf8")) : [];
}

function writeJson(filePath, value) {
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function listingIdFromConversation(conversation = {}) {
  return conversation.listingId || conversation.listing_id || conversation.vehicleId || "";
}

function updateLocalSeeds(mode, demoListings, demoSellers) {
  const currentListings = readJson(listingFile);
  const currentSellers = readJson(sellerFile);
  const currentConversations = readJson(conversationFile);
  const removedListingIds = new Set(currentListings.filter(isDemoRecord).map((item) => item.id));
  LEGACY_DEMO_LISTING_IDS.forEach((id) => removedListingIds.add(id));

  const realListings = currentListings.filter((item) => !isDemoRecord(item));
  const realSellers = currentSellers.filter((item) => !isDemoRecord(item));
  const safeConversations = currentConversations.filter((item) => !removedListingIds.has(listingIdFromConversation(item)));

  if (mode === "seed") {
    writeJson(listingFile, [...realListings, ...demoListings]);
    writeJson(sellerFile, [...realSellers, ...demoSellers]);
  } else {
    writeJson(listingFile, realListings);
    writeJson(sellerFile, realSellers);
  }
  writeJson(conversationFile, safeConversations);
  return {
    realListingsPreserved: realListings.length,
    demoListingsWritten: mode === "seed" ? demoListings.length : 0,
    conversationsPreserved: safeConversations.length
  };
}

async function updateDatabase(mode, demoListings, demoSellers) {
  if (!process.env.DATABASE_URL) return { databaseUpdated: false };
  const { Pool } = require("pg");
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.DATABASE_SSL === "true" ? { rejectUnauthorized: false } : undefined
  });
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS listing_records (
        id TEXT PRIMARY KEY,
        payload JSONB NOT NULL,
        is_demo BOOLEAN NOT NULL DEFAULT FALSE,
        demo_seed_id TEXT,
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
      CREATE TABLE IF NOT EXISTS seller_records (
        id TEXT PRIMARY KEY,
        payload JSONB NOT NULL,
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
      CREATE TABLE IF NOT EXISTS conversation_records (
        id TEXT PRIMARY KEY,
        payload JSONB NOT NULL,
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);
    await pool.query(`ALTER TABLE listing_records ADD COLUMN IF NOT EXISTS is_demo BOOLEAN NOT NULL DEFAULT FALSE`);
    await pool.query(`ALTER TABLE listing_records ADD COLUMN IF NOT EXISTS demo_seed_id TEXT`);
    await pool.query(`CREATE UNIQUE INDEX IF NOT EXISTS idx_listing_records_demo_seed_unique ON listing_records (demo_seed_id) WHERE demo_seed_id IS NOT NULL`);

    const existingDemoRows = await pool.query(
      `SELECT id FROM listing_records
       WHERE is_demo
          OR COALESCE((payload->>'isDemo')::boolean, false)
          OR COALESCE((payload->>'is_demo')::boolean, false)
          OR payload->>'demoSeedId' LIKE 'kerodex-ga-demo-%'
          OR payload->>'demoSeedId' LIKE 'kerodex-us-demo-%'
          OR id = ANY($1::text[])`,
      [LEGACY_DEMO_LISTING_IDS]
    );
    const demoIdsToRemove = existingDemoRows.rows.map((row) => row.id);
    if (demoIdsToRemove.length) {
      await pool.query(
        `DELETE FROM conversation_records
         WHERE payload->>'listingId' = ANY($1::text[])
            OR payload->>'listing_id' = ANY($1::text[])
            OR payload->>'vehicleId' = ANY($1::text[])`,
        [demoIdsToRemove]
      );
      await pool.query("DELETE FROM listing_records WHERE id = ANY($1::text[])", [demoIdsToRemove]);
    }
    await pool.query(
      `DELETE FROM seller_records
       WHERE COALESCE((payload->>'isDemo')::boolean, false)
          OR COALESCE((payload->>'is_demo')::boolean, false)
          OR payload->>'demoSeedId' LIKE 'kerodex-ga-demo-%'
          OR payload->>'demoSeedId' LIKE 'kerodex-us-demo-%'
          OR id = ANY($1::text[])`,
      [LEGACY_DEMO_SELLER_IDS]
    );

    if (mode === "seed") {
      for (const seller of demoSellers) {
        await pool.query(
          `INSERT INTO seller_records (id, payload, updated_at)
           VALUES ($1, $2, NOW())
           ON CONFLICT (id) DO UPDATE SET payload = EXCLUDED.payload, updated_at = NOW()`,
          [seller.id, seller]
        );
      }
      for (const listing of demoListings) {
        await pool.query(
          `INSERT INTO listing_records (id, payload, is_demo, demo_seed_id, updated_at)
           VALUES ($1, $2, TRUE, $3, NOW())
           ON CONFLICT (id) DO UPDATE SET
             payload = EXCLUDED.payload,
             is_demo = TRUE,
             demo_seed_id = EXCLUDED.demo_seed_id,
             updated_at = NOW()`,
          [listing.id, listing, listing.demoSeedId]
        );
      }
    }
    return {
      databaseUpdated: true,
      removedDemoListings: demoIdsToRemove.length,
      insertedDemoListings: mode === "seed" ? demoListings.length : 0
    };
  } finally {
    await pool.end();
  }
}

async function main() {
  const mode = process.argv[2];
  if (!["seed", "clear"].includes(mode)) {
    throw new Error("Usage: node scripts/manage-demo-listings.js <seed|clear>");
  }
  const demoListings = buildDemoListings();
  const demoSellers = buildDemoSellers();
  const local = updateLocalSeeds(mode, demoListings, demoSellers);
  const database = await updateDatabase(mode, demoListings, demoSellers);
  console.log(JSON.stringify({ mode, ...local, ...database }, null, 2));
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
