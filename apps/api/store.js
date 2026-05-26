const fs = require("fs");
const path = require("path");

const SEED_DIR = path.resolve(__dirname, "seed");
const USE_DATABASE = Boolean(process.env.DATABASE_URL);

function readJsonFile(fileName) {
  const filePath = path.join(SEED_DIR, fileName);
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

class JsonStore {
  constructor() {
    this.kind = "json";
    this.listings = readJsonFile("listings.json");
    this.conversations = readJsonFile("conversations.json");
  }

  async getListings() {
    return this.listings;
  }

  async getListingById(id) {
    return this.listings.find((listing) => listing.id === id);
  }

  async getConversations() {
    return this.conversations;
  }
}

class PostgresStore {
  constructor() {
    let Pool;
    try {
      ({ Pool } = require("pg"));
    } catch (error) {
      throw new Error("DATABASE_URL is set, but the pg package is not installed. Run npm install before starting the API.");
    }

    this.kind = "postgres";
    this.pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: process.env.DATABASE_SSL === "true" ? { rejectUnauthorized: false } : undefined
    });
  }

  async getListings() {
    const result = await this.pool.query("SELECT payload FROM listing_records ORDER BY COALESCE((payload->>'dealScore')::int, 0) DESC, updated_at DESC");
    return result.rows.map((row) => row.payload);
  }

  async getListingById(id) {
    const result = await this.pool.query("SELECT payload FROM listing_records WHERE id = $1 LIMIT 1", [id]);
    return result.rows[0]?.payload;
  }

  async getConversations() {
    const result = await this.pool.query("SELECT payload FROM conversation_records ORDER BY updated_at DESC");
    return result.rows.map((row) => row.payload);
  }
}

module.exports = USE_DATABASE ? new PostgresStore() : new JsonStore();
