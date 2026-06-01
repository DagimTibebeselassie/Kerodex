const fs = require("fs");
const path = require("path");

async function main() {
  if (!process.env.DATABASE_URL) {
    throw new Error("Set DATABASE_URL before running npm run db:seed.");
  }

  const { Pool } = require("pg");
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.DATABASE_SSL === "true" ? { rejectUnauthorized: false } : undefined
  });

  const seedDir = path.resolve(__dirname, "../apps/api/seed");
  const listings = JSON.parse(fs.readFileSync(path.join(seedDir, "listings.json"), "utf8"));
  const conversations = JSON.parse(fs.readFileSync(path.join(seedDir, "conversations.json"), "utf8"));
  const sellers = JSON.parse(fs.readFileSync(path.join(seedDir, "sellers.json"), "utf8"));

  await pool.query(`
    CREATE TABLE IF NOT EXISTS listing_records (
      id TEXT PRIMARY KEY,
      payload JSONB NOT NULL,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );

    CREATE TABLE IF NOT EXISTS conversation_records (
      id TEXT PRIMARY KEY,
      payload JSONB NOT NULL,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );

    CREATE TABLE IF NOT EXISTS seller_records (
      id TEXT PRIMARY KEY,
      payload JSONB NOT NULL,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );
  `);

  await pool.query("TRUNCATE listing_records, conversation_records, seller_records;");

  for (const seller of sellers) {
    await pool.query(
      `INSERT INTO seller_records (id, payload, updated_at)
       VALUES ($1, $2, now())
       ON CONFLICT (id) DO UPDATE SET payload = EXCLUDED.payload, updated_at = now()`,
      [seller.id, seller]
    );
  }

  for (const listing of listings) {
    await pool.query(
      `INSERT INTO listing_records (id, payload, updated_at)
       VALUES ($1, $2, now())
       ON CONFLICT (id) DO UPDATE SET payload = EXCLUDED.payload, updated_at = now()`,
      [listing.id, listing]
    );
  }

  for (const conversation of conversations) {
    await pool.query(
      `INSERT INTO conversation_records (id, payload, updated_at)
       VALUES ($1, $2, now())
       ON CONFLICT (id) DO UPDATE SET payload = EXCLUDED.payload, updated_at = now()`,
      [conversation.id, conversation]
    );
  }

  await pool.end();
  console.log(`Seeded ${sellers.length} sellers, ${listings.length} listings, and ${conversations.length} conversations.`);
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
