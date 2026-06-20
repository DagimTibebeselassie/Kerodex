const fs = require("fs");
const path = require("path");
const { execFileSync } = require("child_process");
const { buildDemoListings, LOCATIONS } = require("./demo-listings-data");

function loadEnv(filePath) {
  if (!fs.existsSync(filePath)) return;
  for (const line of fs.readFileSync(filePath, "utf8").split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#") || !trimmed.includes("=")) continue;
    const index = trimmed.indexOf("=");
    const key = trimmed.slice(0, index).trim();
    let value = trimmed.slice(index + 1).trim().replace(/^["']|["']$/g, "");
    if (key && process.env[key] === undefined) process.env[key] = value;
  }
}

const root = path.resolve(__dirname, "..");
const listingFile = path.join(root, "apps", "api", "seed", "listings.json");
loadEnv(path.join(root, ".env.local"));
loadEnv(path.join(root, ".env"));

function runManager(mode) {
  execFileSync(process.execPath, [path.join(__dirname, "manage-demo-listings.js"), mode], {
    cwd: root,
    env: process.env,
    stdio: "pipe"
  });
}

async function main() {
  const generated = buildDemoListings();
  if (generated.length !== 75) throw new Error("Demo generator must create exactly 75 listings.");
  if (new Set(generated.map((listing) => listing.id)).size !== 75) throw new Error("Demo listing IDs must be unique.");
  if (generated.some((listing) => !listing.isDemo || !listing.demoSeedId)) throw new Error("Every demo listing must be marked.");
  if (generated.some((listing) => listing.images.some((image) => /^https?:\/\//.test(image)))) throw new Error("Demo listings must not use remote images.");
  if (generated.some((listing) => listing.images.some((image) => image.endsWith(".svg") || !/\.(?:jpe?g|png|webp)$/i.test(image)))) {
    throw new Error("Demo listings must use realistic local raster photos instead of illustrated placeholders.");
  }
  if (generated.some((listing) => listing.images.some((image) => !image.startsWith("/demo-assets/vehicles/models/")))) {
    throw new Error("Every demo listing must use its exact per-listing model photo.");
  }
  const expectedLocations = new Map(LOCATIONS.map(([city, state, zip, lat, lng]) => [`${city}, ${state}`, { zip, lat, lng }]));
  if (new Set(generated.map((listing) => listing.location)).size !== LOCATIONS.length) {
    throw new Error("Demo listings must cover every configured nationwide city.");
  }
  for (const listing of generated) {
    const expected = expectedLocations.get(listing.location);
    if (!expected || listing.zip !== expected.zip || listing.lat !== expected.lat || listing.lng !== expected.lng) {
      throw new Error(`Demo listing coordinates do not match ${listing.location}.`);
    }
    for (const image of listing.images) {
      const localImage = path.join(root, "apps", "web-react", "public", image.replace(/^\//, ""));
      if (!fs.existsSync(localImage)) throw new Error(`Missing local demo vehicle photo: ${image}`);
    }
  }
  const attribution = JSON.parse(fs.readFileSync(path.join(root, "apps", "web-react", "public", "demo-assets", "vehicles", "ATTRIBUTION.json"), "utf8"));
  if (Object.keys(attribution.listings || {}).length !== 75) throw new Error("Every demo photo must have an attribution record.");
  if (generated.some((listing) => !attribution.listings?.[listing.id]?.sourcePage || !attribution.listings?.[listing.id]?.license)) {
    throw new Error("Every demo photo must retain its Commons source page and license.");
  }

  const sentinel = {
    id: "test_real_listing_preservation",
    title: "Real listing preservation test",
    make: "Test",
    model: "Preserve",
    year: 2020,
    price: 10000,
    mileage: 50000,
    status: "active",
    images: ["/uploads/real-listing-test.webp"],
    isDemo: false
  };

  const currentLocal = JSON.parse(fs.readFileSync(listingFile, "utf8"));
  fs.writeFileSync(listingFile, `${JSON.stringify([...currentLocal, sentinel], null, 2)}\n`);

  let pool = null;
  try {
    if (process.env.DATABASE_URL) {
      const { Pool } = require("pg");
      pool = new Pool({
        connectionString: process.env.DATABASE_URL,
        ssl: process.env.DATABASE_SSL === "true" ? { rejectUnauthorized: false } : undefined
      });
      await pool.query(
        `INSERT INTO listing_records (id, payload, is_demo, demo_seed_id, updated_at)
         VALUES ($1, $2, FALSE, NULL, NOW())
         ON CONFLICT (id) DO UPDATE SET payload = EXCLUDED.payload, is_demo = FALSE, demo_seed_id = NULL, updated_at = NOW()`,
        [sentinel.id, sentinel]
      );
    }

    runManager("clear");
    const afterClear = JSON.parse(fs.readFileSync(listingFile, "utf8"));
    if (!afterClear.some((listing) => listing.id === sentinel.id)) throw new Error("Local clear removed a real listing.");
    if (afterClear.some((listing) => listing.isDemo || listing.is_demo)) throw new Error("Local clear left demo listings behind.");

    if (pool) {
      const result = await pool.query(
        `SELECT
           COUNT(*) FILTER (WHERE is_demo)::int AS demo_count,
           COUNT(*) FILTER (WHERE id = $1)::int AS sentinel_count
         FROM listing_records`,
        [sentinel.id]
      );
      if (result.rows[0].demo_count !== 0) throw new Error("Database clear left demo listings behind.");
      if (result.rows[0].sentinel_count !== 1) throw new Error("Database clear removed a real listing.");
      await pool.query("DELETE FROM listing_records WHERE id = $1", [sentinel.id]);
    }

    fs.writeFileSync(listingFile, `${JSON.stringify(afterClear.filter((listing) => listing.id !== sentinel.id), null, 2)}\n`);
    runManager("seed");

    const finalLocal = JSON.parse(fs.readFileSync(listingFile, "utf8"));
    if (finalLocal.filter((listing) => listing.isDemo || listing.is_demo).length !== 75) throw new Error("Final local seed count is not 75.");
    if (pool) {
      const result = await pool.query("SELECT COUNT(*)::int AS count FROM listing_records WHERE is_demo");
      if (result.rows[0].count !== 75) throw new Error("Final database seed count is not 75.");
    }

    console.log(JSON.stringify({
      ok: true,
      generated: 75,
      clearPreservedRealListing: true,
      finalDemoCount: 75,
      databaseChecked: Boolean(pool)
    }, null, 2));
  } finally {
    if (pool) {
      await pool.query("DELETE FROM listing_records WHERE id = $1", [sentinel.id]).catch(() => {});
      await pool.end();
    }
    const local = JSON.parse(fs.readFileSync(listingFile, "utf8")).filter((listing) => listing.id !== sentinel.id);
    fs.writeFileSync(listingFile, `${JSON.stringify(local, null, 2)}\n`);
  }
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
