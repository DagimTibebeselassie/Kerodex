const fs = require("fs");
const path = require("path");
const { listings } = require("../apps/api/data");

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

const root = path.resolve(__dirname, "..");
const requiredFiles = [
  "apps/api/server.js",
  "apps/api/data.js",
  "apps/web/public/index.html",
  "apps/web/public/app.js",
  "apps/web/public/styles.css"
];

requiredFiles.forEach((file) => {
  assert(fs.existsSync(path.join(root, file)), `Missing required file: ${file}`);
});

assert(Array.isArray(listings), "Listings export must be an array.");
assert(listings.length >= 25, "Expected at least 25 seed listings.");

const ids = new Set();
listings.forEach((listing) => {
  assert(listing.id && !ids.has(listing.id), `Duplicate or missing listing id: ${listing.id}`);
  ids.add(listing.id);
  assert(listing.title, `Listing ${listing.id} is missing a title.`);
  assert(Number.isFinite(listing.lat), `Listing ${listing.id} is missing latitude.`);
  assert(Number.isFinite(listing.lng), `Listing ${listing.id} is missing longitude.`);
  assert(listing.images && listing.images.length > 0, `Listing ${listing.id} is missing images.`);
});

const html = fs.readFileSync(path.join(root, "apps/web/public/index.html"), "utf8");
assert(html.includes("collectionStack"), "Homepage must include collection rows container.");
assert(html.includes("mapCanvas"), "Homepage must include map canvas.");

console.log(`Smoke test passed with ${listings.length} listings.`);
