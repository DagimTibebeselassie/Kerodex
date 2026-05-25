const fs = require("fs");
const path = require("path");

const SEED_DIR = path.resolve(__dirname, "seed");

function readJsonFile(fileName) {
  const filePath = path.join(SEED_DIR, fileName);
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

class JsonStore {
  constructor() {
    this.listings = readJsonFile("listings.json");
    this.conversations = readJsonFile("conversations.json");
  }

  getListings() {
    return this.listings;
  }

  getListingById(id) {
    return this.listings.find((listing) => listing.id === id);
  }

  getConversations() {
    return this.conversations;
  }
}

module.exports = new JsonStore();
