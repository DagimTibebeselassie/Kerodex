const fs = require("fs");
const path = require("path");
const store = require("../apps/api/store");
const buyerGuideEngine = require("../apps/api/buyer-guide");

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

const root = path.resolve(__dirname, "..");
const requiredFiles = [
  "apps/api/server.js",
  "apps/api/store.js",
  "apps/api/buyer-guide.js",
  "apps/api/seed/sellers.json",
  "apps/api/seed/listings.json",
  "apps/api/seed/conversations.json",
  "apps/admin/server.js",
  "apps/admin/public/index.html",
  "apps/admin/public/admin.js",
  "apps/admin/public/admin.css",
  "apps/web/public/index.html",
  "apps/web/public/app.js",
  "apps/web/public/styles.css",
  "apps/web-react/src/pages/BuyerGuideFlow.tsx",
  "apps/web-react/src/components/buyer-guide/BuyerGuideComponents.tsx"
];

requiredFiles.forEach((file) => {
  assert(fs.existsSync(path.join(root, file)), `Missing required file: ${file}`);
});

(async () => {
  const listings = await store.getListings();
  assert(Array.isArray(listings), "Listings store must return an array.");
  assert(listings.length >= 75, "Expected the 75-listing realistic demo marketplace.");
  const demoListings = listings.filter((listing) => listing.isDemo || listing.is_demo);
  assert(demoListings.length === 75, "Expected exactly 75 clearly marked demo listings.");
  assert(new Set(demoListings.map((listing) => listing.demoSeedId)).size === 75, "Demo seed IDs must be unique.");
  assert(demoListings.every((listing) => listing.images.every((image) => !/^https?:\/\//.test(image))), "Demo listings must use local app-owned vehicle photos.");
  assert(demoListings.every((listing) => listing.images.every((image) => image.startsWith("/demo-assets/vehicles/models/") && /\.(?:jpe?g|png|webp)$/i.test(image))), "Demo listings must use exact-model local vehicle photos.");
  assert(demoListings.every((listing) => listing.images.every((image) => !image.includes("demo-vehicles") && !image.endsWith(".svg"))), "Illustrated demo vehicle placeholders must not be used.");
  assert(new Set(demoListings.map((listing) => listing.location)).size >= 23, "Demo listings must cover the configured nationwide city set.");
  const demoPhotoAttribution = JSON.parse(fs.readFileSync(path.join(root, "apps/web-react/public/demo-assets/vehicles/ATTRIBUTION.json"), "utf8"));
  assert(Object.keys(demoPhotoAttribution.listings || {}).length === 75, "Every exact-model demo photo must have attribution metadata.");
  assert(demoListings.every((listing) => String(listing.description || "").includes("demonstration/testing only")), "Every demo description must disclose testing-only status.");

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

  const savedSmokeUser = `saved_smoke_${Date.now()}`;
  const savedSmokeListing = listings[0];
  const initialViews = Number(savedSmokeListing.views || 0);
  await store.trackEvent({
    id: `evt_saved_smoke_${Date.now()}`,
    eventType: "listing_view",
    userId: savedSmokeUser,
    listingId: savedSmokeListing.id,
    metadata: {},
    createdAt: new Date().toISOString()
  });
  const viewedListing = await store.getListingById(savedSmokeListing.id);
  assert(Number(viewedListing.views || 0) === initialViews + 1, "Listing views must be derived from persisted listing-view events.");
  await store.setListingSaved(savedSmokeUser, savedSmokeListing.id, true);
  const savedSmokeListings = await store.getSavedListings(savedSmokeUser);
  assert(savedSmokeListings.length === 1 && savedSmokeListings[0].id === savedSmokeListing.id, "Saved vehicles must be stored and returned by the backend.");
  const syncedSmokeListings = await store.syncSavedListings(savedSmokeUser, ["listing_that_no_longer_exists"]);
  assert(syncedSmokeListings.length === 1, "Syncing an orphaned listing ID must not create a phantom saved vehicle.");
  await store.setListingSaved(savedSmokeUser, savedSmokeListing.id, false);
  assert((await store.getSavedListings(savedSmokeUser)).length === 0, "Unsaving must remove the backend favorite record.");

  const html = fs.readFileSync(path.join(root, "apps/web/public/index.html"), "utf8");
  assert(html.includes("collectionStack"), "Homepage must include collection rows container.");
  assert(html.includes("mapCanvas"), "Homepage must include map canvas.");

  const dashboard = await store.getAdminDashboard({ includeDemo: true });
  assert(dashboard.cards.totalListings >= listings.length, "Admin dashboard must report listing totals.");
  assert(Number.isFinite(dashboard.website.totalVisitors), "Admin website analytics must report visitor totals.");
  assert(dashboard.funnel.length >= 6, "Admin dashboard must include marketplace funnel stages.");

  const users = await store.getAdminCollection("users");
  assert(users.items.length > 0, "Admin users collection must return records.");

  const adminHtml = fs.readFileSync(path.join(root, "apps/admin/public/index.html"), "utf8");
  assert(adminHtml.includes("Website Analytics"), "Admin app must include website analytics section.");
  assert(adminHtml.includes("Audit Logs"), "Admin app must include audit logs section.");

  const appSource = fs.readFileSync(path.join(root, "apps/web-react/src/App.tsx"), "utf8");
  ["/support", "/prohibited-listings", "/dealer-policy", "/admin", "/buyer-guide"].forEach((route) => {
    assert(appSource.includes(route), `React app must expose crawlable ${route} route.`);
  });
  assert(appSource.includes("notFoundComponent"), "React app must render the styled not-found page for unknown routes.");
  assert(fs.existsSync(path.join(root, "apps/web-react/src/pages/Admin.tsx")), "React admin page must exist.");
  assert(fs.existsSync(path.join(root, "apps/web-react/src/pages/NotFound.tsx")), "Styled not-found page must exist.");

  const homeSource = fs.readFileSync(path.join(root, "apps/web-react/src/pages/Home.tsx"), "utf8");
  assert(homeSource.includes("Verify who you're dealing with"), "Homepage must include the identity verification feature section.");
  assert(homeSource.includes("Persona identity verification is coming soon"), "Homepage must disclose that identity verification is unavailable during beta.");
  assert(fs.existsSync(path.join(root, "apps/web-react/public/Dagim_editorial_vector_illustration_vehicle_verification_conc_466c222c-fe96-4e55-80ec-9d17c19483a1_1.png")), "Homepage identity verification image must exist.");

  const serverSource = fs.readFileSync(path.join(root, "apps/api/server.js"), "utf8");
  const storeSource = fs.readFileSync(path.join(root, "apps/api/store.js"), "utf8");
  const searchSource = fs.readFileSync(path.join(root, "apps/web-react/src/pages/Search.tsx"), "utf8");
  const verificationSource = fs.readFileSync(path.join(root, "apps/web-react/src/pages/Verification.tsx"), "utf8");
  assert(verificationSource.includes("Powered by Persona"), "Verification page must identify Persona as the identity provider.");
  assert(verificationSource.includes("Coming soon · Powered by Persona"), "Persona must be visibly disabled during beta.");
  assert(verificationSource.includes("Verified Seller badges are not being issued during the current beta"), "Beta must disclose that Verified Seller badges are disabled.");
  assert(serverSource.includes("PERSONA_IDENTITY_VERIFICATION_ENABLED = false"), "Persona identity verification must have a hard beta safety gate.");
  assert(serverSource.includes("identity_verification_beta_disabled"), "Persona start and return routes must reject beta submissions.");
  assert(!serverSource.includes('returnedStatus === "approved"'), "Browser-returned Persona status must never award identity verification.");
  assert(serverSource.includes("seller: listing.seller") && serverSource.includes("verified: false"), "Public listing responses must suppress legacy Verified Seller flags.");
  assert(!searchSource.includes('label="Verified Seller"'), "Search must not offer a Verified Seller filter while Persona is disabled.");
  assert(verificationSource.includes("Can I submit my ID during beta?"), "Verification page must explain that identity submission is unavailable.");
  assert(verificationSource.includes("No identity documents can currently be submitted"), "Verification page must accurately disclose the disabled identity flow.");

  const verifiedSellerTrustSource = fs.readFileSync(path.join(root, "apps/web-react/src/components/VerifiedSellerTrust.tsx"), "utf8");
  assert(verifiedSellerTrustSource.includes("It does not guarantee the vehicle"), "Verified Seller badges must include the trust limitation.");

  const legalSource = fs.readFileSync(path.join(root, "apps/web-react/src/pages/LegalPage.tsx"), "utf8");
  assert(legalSource.includes("Kerodex plans to use Persona to provide identity verification services."), "Privacy policy must identify Persona and disclose beta availability.");

  const seoSource = fs.readFileSync(path.join(root, "apps/web-react/src/components/Seo.tsx"), "utf8");
  assert(seoSource.includes("Prohibited Listings"), "SEO metadata must include prohibited listings page.");
  assert(seoSource.includes("Dealer Policy"), "SEO metadata must include dealer policy page.");

  assert(serverSource.includes("SELLER_CHECKLIST_KEYS"), "API must define seller checklist validation.");
  ["authorizedToList", "privateParty", "vinMatchesVehicle", "accurateInformation"].forEach((key) => {
    assert(serverSource.includes(`"${key}"`), `API Seller Checklist validation must require ${key}.`);
  });
  ["noProhibitedContent", "safeCommunication"].forEach((key) => {
    assert(!serverSource.includes(`"${key}"`), `API Seller Checklist validation must not require removed key ${key}.`);
  });
  const sellSource = fs.readFileSync(path.join(root, "apps/web-react/src/pages/Sell.tsx"), "utf8");
  [
    "I own this vehicle or am authorized by the owner to list it.",
    "This is a private-party listing and not dealership inventory.",
    "The VIN entered matches the vehicle and any verification materials submitted.",
    "I certify that this listing is accurate to the best of my knowledge, including mileage, condition, title status, accident history, images, and documents, and I agree to communicate honestly and safely on Kerodex."
  ].forEach((item) => assert(sellSource.includes(item), `Seller Checklist must include: ${item}`));
  [
    "The VIN, mileage, price, title, accident history, and condition are accurate.",
    "This listing does not include prohibited, stolen, or misleading content.",
    "I agree to keep buyer communication safe and accurate on Kerodex."
  ].forEach((item) => assert(!sellSource.includes(item), `Seller Checklist must remove: ${item}`));
  assert(serverSource.includes("duplicate_vin"), "API must reject duplicate verified VINs.");
  assert(serverSource.includes("findVerifiedListingByVin"), "Only verified listings should reserve a VIN.");
  assert(
    serverSource.includes("listing.vehiclePresenceVerified") &&
      serverSource.includes('listing.verificationStatus === "vehicle_presence_verified"'),
    "VIN reservation must require successful vehicle-presence verification."
  );
  assert(
    serverSource.includes("withVehiclePresenceVinLock"),
    "Vehicle verification publication must be serialized by VIN."
  );
  assert(serverSource.includes("auditMarketplaceAction"), "API must write marketplace audit actions.");
  assert(serverSource.includes("/api/buyer-guides/start"), "API must expose buyer guide start route.");
  assert(serverSource.includes("/api/buyer-guide/recommendations"), "API must expose Buyer Guide recommendations route.");
  assert(serverSource.includes("automated demo-seller reply"), "Demo listings must support a clearly sandboxed messaging experience.");
  assert(!serverSource.includes("demo_listing_contact_disabled"), "Demo listings must no longer block the messaging demo.");
  assert(serverSource.includes("/api/me/saved"), "API must expose authenticated saved-vehicle records.");
  assert(
    serverSource.includes("transferVerifiedPhoneOwnership"),
    "A valid Twilio code must be able to transfer a recycled phone number from an older account."
  );
  assert(
    storeSource.includes("isPublicMarketplaceListing") &&
      storeSource.includes("payload->>'status' IN ('active', 'sold')"),
    "Public seller profiles must exclude removed and non-public listings."
  );
  assert(serverSource.includes("/favorite"), "API must expose a database-backed listing favorite action.");
  assert(serverSource.includes("/api/me/listing-analytics"), "API must expose seller-owned listing analytics.");
  assert(serverSource.includes("/status"), "API must expose the seller sold/available flow.");
  assert(serverSource.includes("/api/me/followups"), "API must expose buyer purchase follow-ups.");
  assert(serverSource.includes("/outcome"), "API must expose conversation outcome tracking.");
  assert(serverSource.includes("/api/admin/costs"), "API must expose protected admin cost analytics.");
  assert(serverSource.includes("/api/admin/feedback"), "API must expose protected admin feedback analytics.");
  assert(!fs.readFileSync(path.join(root, "apps/web-react/src/pages/BuyerGuideFlow.tsx"), "utf8").includes("OPENAI_API_KEY"), "Frontend must not expose the OpenAI API key.");

  const fallbackRecommendations = buyerGuideEngine.fallbackRecommendations({
    purpose: "commuting",
    idealBudget: 18000,
    maxPrice: 22000,
    priorities: ["reliability", "fuel economy"],
    bodyTypes: ["sedan"]
  });
  assert(fallbackRecommendations.recommendedModels.length >= 3, "Buyer Guide fallback must return model recommendations.");
  assert(fallbackRecommendations.kerodexFilters.maxPrice === 22000, "Buyer Guide fallback must preserve structured budget filters.");
  const guideMatches = buyerGuideEngine.matchListings(listings, fallbackRecommendations);
  assert(Array.isArray(guideMatches), "Buyer Guide listing matcher must return an array.");
  assert(guideMatches.every((match) => match.listing && Number.isFinite(match.score)), "Buyer Guide matches must include listings and numeric scores.");
  assert(guideMatches.some((match) => match.concerns.some((concern) => concern.includes("Demo listing only"))), "Buyer Guide must identify demo listings.");

  const vehicleCardSource = fs.readFileSync(path.join(root, "apps/web-react/src/components/VehicleCard.tsx"), "utf8");
  assert(vehicleCardSource.includes("Demo Listing"), "Listing cards must display the Demo Listing badge.");
  assert(vehicleCardSource.includes("useSavedVehicles"), "Listing cards must use backend-backed saved state.");
  const profileSource = fs.readFileSync(path.join(root, "apps/web-react/src/pages/Profile.tsx"), "utf8");
  assert(!profileSource.includes("Member since 2026"), "Profile membership date must not be hardcoded.");
  assert(!profileSource.includes('label="Views" value="-"'), "Profile listing views must be dynamic.");
  assert(!profileSource.includes('label="Messages" value={0}'), "Profile message count must be dynamic.");
  const vehicleDetailSource = fs.readFileSync(path.join(root, "apps/web-react/src/pages/VehicleDetail.tsx"), "utf8");
  assert(vehicleDetailSource.includes("This listing is for demonstration/testing only"), "Listing detail must display the demo-only notice.");
  assert(!searchSource.includes('placeholder="Search make, model..."'), "Search results page must not duplicate the global header search bar.");
  assert(searchSource.includes("kerodex-scrollbar-hidden hidden md:flex"), "Map listing rail must hide its visible scrollbar.");
  assert(searchSource.includes("style={{ height: 'calc(100vh - 7rem)' }}"), "Map search workspace must retain its stable fixed-height layout.");
  assert(searchSource.includes("sticky top-[7rem]"), "Grid filters must remain fully scrollable and aligned beside long result sets.");
  assert(!searchSource.includes("radius: current.radius || '100'"), "Enabling map location must not activate a radius filter.");
  assert(searchSource.includes("locationFocusRequest"), "Map location control must support reliable repeated recentering.");
  assert(serverSource.includes("darkmodeNonTransparent.png"), "Email templates must use the non-transparent black Kerodex logo.");
  assert(serverSource.includes("background:#ffffff;color:#000000"), "Email templates must use a minimal white and black visual style.");
  const buyerGuideComponentsSource = fs.readFileSync(path.join(root, "apps/web-react/src/components/buyer-guide/BuyerGuideComponents.tsx"), "utf8");
  ["Sedan", "SUV", "Truck", "Hatchback", "Coupe", "Minivan", "EV"].forEach((bodyStyle) => {
    assert(buyerGuideComponentsSource.includes(`label: '${bodyStyle}'`), `Buyer Guide must include the ${bodyStyle} photo card.`);
  });
  assert(buyerGuideComponentsSource.includes("buyerGuideBodyStyleImage"), "Buyer Guide body-style cards must use the centralized local image mapping.");
  assert(buyerGuideComponentsSource.includes("imagePosition: 'center 72%'"), "Buyer Guide low-profile vehicle images must use balanced crops that keep wheels visible.");
  assert(buyerGuideComponentsSource.includes("imagePosition: 'center 56%'"), "Buyer Guide truck image must use its subtle crop adjustment.");
  assert(buyerGuideComponentsSource.includes("if (item.value === 'open')"), "Buyer Guide open-options choice must render as a standalone button without an image frame.");
  const buyerGuideImageMapSource = fs.readFileSync(path.join(root, "apps/web-react/src/components/buyer-guide/buyerGuideBodyStyleImages.ts"), "utf8");
  ["sedan1.png", "suv2.png", "coupe1.png", "truck1.png", "minivan1.png", "hatchback1.png", "ev1.png"].forEach((image) => {
    assert(buyerGuideImageMapSource.includes(image), `Buyer Guide image map must include ${image}.`);
    assert(fs.existsSync(path.join(root, "apps/web-react/public/buyer-guide/body-styles", image)), `Buyer Guide asset must exist: ${image}.`);
  });
  assert(buyerGuideImageMapSource.includes("vehicle-placeholder.svg"), "Buyer Guide image map must include a neutral missing-image fallback.");

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

    const discoveryGuide = await store.saveBuyerGuide({
      id: `bgs_smoke_${Date.now()}`,
      buyer_id: "smoke_discovery_buyer",
      buyerId: "smoke_discovery_buyer",
      listing_id: null,
      listingId: null,
      status: "active",
      journey_type: "discovery",
      journeyType: "discovery",
      current_stage: "understand_buyer",
      currentStage: "understand_buyer",
      current_step: "purpose",
      currentStep: "purpose",
      buyer_answers: { purpose: "commuting" },
      buyerAnswers: { purpose: "commuting" },
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    });
    assert(discoveryGuide.id, "Logged-in Buyer Guide discovery progress must save.");
    const activeDiscoveryGuide = await store.getActiveDiscoveryBuyerGuide("smoke_discovery_buyer");
    assert(activeDiscoveryGuide?.id === discoveryGuide.id, "Logged-in Buyer Guide discovery progress must resume.");
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

  const verification = await store.createVerificationRequest(
    { id: "smoke_user", name: "Smoke User", email: "smoke@example.com" },
    "vehicle_presence",
    { listingId: listings[0].id, vehicleVin: listings[0].vin || "SMOKEVIN", status: "pending" }
  );
  assert(verification.id, "Admin verification queue must accept verification records.");
  const verifications = await store.getAdminCollection("verifications");
  assert(verifications.items.some((item) => item.id === verification.id || item.listingId === listings[0].id), "Admin verifications collection must include review records.");

  console.log(`Smoke test passed with ${listings.length} listings using ${store.kind} storage and admin dashboard coverage.`);
})().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
