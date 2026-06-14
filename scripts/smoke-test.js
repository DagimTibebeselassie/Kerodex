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
  "apps/api/seed/sellers.json",
  "apps/api/seed/listings.json",
  "apps/api/seed/conversations.json",
  "apps/admin/server.js",
  "apps/admin/public/index.html",
  "apps/admin/public/admin.js",
  "apps/admin/public/admin.css",
  "apps/web/public/index.html",
  "apps/web/public/app.js",
  "apps/web/public/styles.css"
];

requiredFiles.forEach((file) => {
  assert(fs.existsSync(path.join(root, file)), `Missing required file: ${file}`);
});

(async () => {
  const listings = await store.getListings();
  assert(Array.isArray(listings), "Listings store must return an array.");
  assert(listings.length >= 8, "Expected at least 8 realistic seed listings.");

  const sellers = await store.getSellers();
  assert(Array.isArray(sellers), "Seller store must return an array.");
  assert(sellers.length >= 6, "Expected realistic seed sellers.");

  const ids = new Set();
  listings.forEach((listing) => {
    assert(listing.id && !ids.has(listing.id), `Duplicate or missing listing id: ${listing.id}`);
    ids.add(listing.id);
    assert(listing.title, `Listing ${listing.id} is missing a title.`);
    assert(Number.isFinite(listing.lat), `Listing ${listing.id} is missing latitude.`);
    assert(Number.isFinite(listing.lng), `Listing ${listing.id} is missing longitude.`);
    assert(listing.images && listing.images.length > 0, `Listing ${listing.id} is missing images.`);
    assert(listing.seller?.id, `Listing ${listing.id} is missing a linked seller id.`);
    assert(sellers.some((seller) => seller.id === listing.seller.id), `Listing ${listing.id} points to an unknown seller.`);
  });

  const sampleSeller = await store.getSellerById(listings[0].seller.id);
  assert(sampleSeller?.listings?.length > 0, "Seller profile must include linked listings.");

  const html = fs.readFileSync(path.join(root, "apps/web/public/index.html"), "utf8");
  assert(html.includes("collectionStack"), "Homepage must include collection rows container.");
  assert(html.includes("mapCanvas"), "Homepage must include map canvas.");

  const dashboard = await store.getAdminDashboard();
  assert(dashboard.cards.totalListings >= listings.length, "Admin dashboard must report listing totals.");
  assert(Number.isFinite(dashboard.website.totalVisitors), "Admin website analytics must report visitor totals.");
  assert(dashboard.funnel.length >= 6, "Admin dashboard must include marketplace funnel stages.");

  const users = await store.getAdminCollection("users");
  assert(users.items.length > 0, "Admin users collection must return records.");

  const adminHtml = fs.readFileSync(path.join(root, "apps/admin/public/index.html"), "utf8");
  assert(adminHtml.includes("Website Analytics"), "Admin app must include website analytics section.");
  assert(adminHtml.includes("Audit Logs"), "Admin app must include audit logs section.");

  const appSource = fs.readFileSync(path.join(root, "apps/web-react/src/App.tsx"), "utf8");
  ["/support", "/prohibited-listings", "/dealer-policy"].forEach((route) => {
    assert(appSource.includes(route), `React app must expose crawlable ${route} route.`);
  });

  const seoSource = fs.readFileSync(path.join(root, "apps/web-react/src/components/Seo.tsx"), "utf8");
  assert(seoSource.includes("Prohibited Listings"), "SEO metadata must include prohibited listings page.");
  assert(seoSource.includes("Dealer Policy"), "SEO metadata must include dealer policy page.");

  const serverSource = fs.readFileSync(path.join(root, "apps/api/server.js"), "utf8");
  assert(serverSource.includes("SELLER_CHECKLIST_KEYS"), "API must define seller checklist validation.");
  assert(serverSource.includes("duplicate_vin"), "API must reject duplicate active VINs.");
  assert(serverSource.includes("auditMarketplaceAction"), "API must write marketplace audit actions.");
  assert(serverSource.includes("/api/buyer-guides/start"), "API must expose buyer guide start route.");

  if (typeof store.saveBuyerGuide === "function") {
    const guide = await store.saveBuyerGuide({
      id: `bg_smoke_${Date.now()}`,
      buyer_id: "smoke_buyer",
      buyerId: "smoke_buyer",
      listing_id: listings[0].id,
      listingId: listings[0].id,
      seller_id: listings[0].seller.id,
      sellerId: listings[0].seller.id,
      status: "active",
      current_step: "review_listing",
      currentStep: "review_listing",
      completed_steps: ["review_listing"],
      completedSteps: ["review_listing"],
      notes: { review_listing: "Smoke test note" },
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    });
    assert(guide.id, "Buyer guide store must save guide records.");
    const fetchedGuide = await store.getBuyerGuideById(guide.id);
    assert(fetchedGuide?.id === guide.id, "Buyer guide store must fetch guide by id.");
    const buyerGuides = await store.getBuyerGuidesByBuyer("smoke_buyer");
    assert(buyerGuides.some((item) => item.id === guide.id), "Buyer guide store must list guides by buyer.");
  }

  const report = await store.createReport({
    id: `rep_smoke_${Date.now()}`,
    type: "fake_listing",
    category: "fake_listing",
    reporterId: "smoke",
    reporter: "Smoke Test",
    listingId: listings[0].id,
    status: "open",
    description: "Smoke test report record.",
    createdAt: new Date().toISOString()
  });
  assert(report.id, "Report store must persist report records.");
  const reports = await store.getReports();
  assert(reports.some((item) => item.id === report.id), "Admin reports must read persisted reports.");

  if (typeof store.saveAuditLog === "function") {
    const audit = await store.saveAuditLog({
      id: `audit_smoke_${Date.now()}`,
      timestamp: new Date().toISOString(),
      adminAccount: "smoke",
      actionType: "smoke.audit",
      targetType: "system",
      targetId: "smoke",
      immutable: true
    });
    assert(audit.id, "Audit store must persist audit records.");
    const auditLogs = await store.getAuditLogs();
    assert(auditLogs.some((item) => item.id === audit.id), "Admin audit logs must read persisted audit records.");
  }

  console.log(`Smoke test passed with ${listings.length} listings using ${store.kind} storage and admin dashboard coverage.`);
})().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
