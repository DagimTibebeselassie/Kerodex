const fs = require("fs");
const path = require("path");
const store = require("../apps/api/store");

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

const root = path.resolve(__dirname, "..");
const requiredFiles = [
  "apps/api/server.js",
  "apps/api/store.js",
  "apps/api/seed/listings.json",
  "apps/api/seed/conversations.json",
  "apps/web-react/src/App.tsx",
  "apps/web-react/src/lib/api.ts",
  "apps/web-react/src/components/MapView.tsx",
  "apps/web-react/src/pages/Search.tsx"
];

requiredFiles.forEach((file) => {
  assert(fs.existsSync(path.join(root, file)), `Missing required file: ${file}`);
});

(async () => {
  const listings = await store.getListings();
  assert(Array.isArray(listings), "Listings store must return an array.");
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

  const app = fs.readFileSync(path.join(root, "apps/web-react/src/App.tsx"), "utf8");
  const apiClient = fs.readFileSync(path.join(root, "apps/web-react/src/lib/api.ts"), "utf8");
  const mapView = fs.readFileSync(path.join(root, "apps/web-react/src/components/MapView.tsx"), "utf8");
  assert(app.includes("SearchPage"), "React app must include the search route.");
  assert(apiClient.includes("/api/listings"), "React API client must use Kerodex listing endpoints.");
  assert(mapView.includes("cartocdn.com"), "MapView must keep the CARTO/Leaflet map tiles wired.");

  console.log(`Smoke test passed with ${listings.length} listings from ${store.kind}.`);
})().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
