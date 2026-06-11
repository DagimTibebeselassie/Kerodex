const profileCurrency = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 0
});

let marketListingsCache = null;

function savedListingIds() {
  try {
    return JSON.parse(localStorage.getItem("kerodex-saved-listings") || "[]");
  } catch {
    return [];
  }
}

function currentUser() {
  const storedUser = localStorage.getItem("kerodex-user");
  if (!storedUser) return null;
  try {
    return JSON.parse(storedUser);
  } catch {
    return null;
  }
}

function isSignedIn() {
  return Boolean(currentUser());
}

function requireSignedIn() {
  const signedIn = isSignedIn();
  document.querySelector("#signedOutProfile").hidden = signedIn;
  document.querySelector("#profileApp").hidden = !signedIn;
  document.querySelector("#profileInitial").hidden = !signedIn;
  return signedIn;
}

function setProfileAuthMode(mode) {
  const isCreate = mode === "create";
  document.querySelector("#profileAuthEyebrow").textContent = isCreate ? "Join Kerodex" : "Welcome back";
  document.querySelector("#profileAuthSubmit").textContent = isCreate ? "Create account" : "Sign in";
  document.querySelector("#profileAuthMessage").textContent = "";
  document.querySelector("#profileAuthMessage").className = "auth-message";
  document.querySelectorAll("[data-profile-auth-mode]").forEach((button) => {
    button.classList.toggle("active", button.dataset.profileAuthMode === mode);
  });
}

function openProfileAuth(mode = "signin") {
  setProfileAuthMode(mode);
  document.querySelector("#profileAuthModal").hidden = false;
  document.querySelector("#profileAuthEmail").focus();
}

function closeProfileAuth() {
  document.querySelector("#profileAuthModal").hidden = true;
}

function setProfileAuthMessage(message, type = "") {
  const el = document.querySelector("#profileAuthMessage");
  el.textContent = message;
  el.className = `auth-message${type ? ` is-${type}` : ""}`;
}

function storeProfileSession(session) {
  const user = {
    ...session.user,
    joinedYear: session.user?.joinedYear || new Date().getFullYear()
  };
  localStorage.setItem("kerodex-token", session.token);
  localStorage.setItem("kerodex-user", JSON.stringify(user));
  window.location.href = "/";
}

async function finishProfileAuth(response) {
  const data = await response.json();
  if (!response.ok) {
    setProfileAuthMessage(data.error || "Authentication failed.", "error");
    return;
  }
  storeProfileSession(data);
}

async function emailProfileAuth() {
  const activeMode = document.querySelector("[data-profile-auth-mode].active")?.dataset.profileAuthMode || "signin";
  setProfileAuthMessage("Checking credentials...");
  const response = await fetch("/api/auth/email", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      mode: activeMode,
      email: document.querySelector("#profileAuthEmail").value,
      password: document.querySelector("#profileAuthPassword").value
    })
  });
  await finishProfileAuth(response);
}

async function socialProfileAuth(provider) {
  setProfileAuthMessage(`Connecting ${provider === "apple" ? "Apple" : "Google"}...`);
  const response = await fetch(`/api/auth/${provider}`, {
    headers: { accept: "application/json" }
  });
  await finishProfileAuth(response);
}

function defaultVerification() {
  return {
    legalName: "",
    email: "",
    phone: "",
    idDocumentName: "",
    selfieName: "",
    vin: "",
    vinDecoded: null,
    ownershipDocumentName: "",
    vinPhotoName: "",
    odometerPhotoName: "",
    platePhotoName: "",
    liveProofPhotoName: "",
    proofCode: `KERODEX-${Math.floor(100000 + Math.random() * 900000)}`,
    reviewedAt: "",
    status: "not-ready"
  };
}

function loadVerification() {
  try {
    return { ...defaultVerification(), ...JSON.parse(localStorage.getItem("kerodex-verification") || "{}") };
  } catch {
    return defaultVerification();
  }
}

function saveVerification(next) {
  localStorage.setItem("kerodex-verification", JSON.stringify(next));
}

function fileNameFor(input) {
  return input.files && input.files[0] ? input.files[0].name : "";
}

function verificationChecks(state = loadVerification()) {
  const vinVehicle = state.vinDecoded?.vehicle || {};
  const hasDecodedVehicle = Boolean(state.vinDecoded?.ok && vinVehicle.year && vinVehicle.make && vinVehicle.model);
  return [
    { key: "email", label: "Email provided", passed: Boolean(state.email && state.email.includes("@")), points: 10 },
    { key: "phone", label: "Phone provided", passed: String(state.phone || "").replace(/\D/g, "").length >= 10, points: 10 },
    { key: "legalName", label: "Legal name on profile", passed: String(state.legalName || "").trim().split(/\s+/).length >= 2, points: 10 },
    { key: "idDocument", label: "Government ID uploaded privately", passed: Boolean(state.idDocumentName), points: 10 },
    { key: "selfie", label: "Selfie/liveness photo uploaded", passed: Boolean(state.selfieName), points: 10 },
    { key: "vinDecode", label: "VIN decoded by NHTSA vPIC", passed: hasDecodedVehicle, points: 15 },
    { key: "ownership", label: "Title or registration uploaded", passed: Boolean(state.ownershipDocumentName), points: 15 },
    { key: "vinPhoto", label: "Windshield VIN proof photo uploaded", passed: Boolean(state.vinPhotoName), points: 10 },
    { key: "odometer", label: "Odometer photo uploaded", passed: Boolean(state.odometerPhotoName), points: 5 },
    { key: "liveProof", label: "Live app-code proof photo uploaded", passed: Boolean(state.liveProofPhotoName), points: 15 }
  ];
}

function verificationScore(state = loadVerification()) {
  return verificationChecks(state).reduce((sum, check) => sum + (check.passed ? check.points : 0), 0);
}

function verificationStatus(score) {
  if (score >= 95) return { status: "verified", title: "Verified seller profile", text: "This profile is ready to publish verified listings with buyer-facing trust badges." };
  if (score >= 70) return { status: "review", title: "Ready for manual review", text: "Most signals are present. A reviewer should compare ID, ownership document, VIN photos, and proof photo." };
  if (score >= 35) return { status: "in-progress", title: "Verification in progress", text: "Keep collecting identity and car ownership proof before allowing public listings." };
  return { status: "not-ready", title: "Not ready to list yet", text: "Complete identity, VIN, ownership, and live-proof checks before publishing a car." };
}

function defaultSellerDraft() {
  return {
    vin: "",
    year: "",
    make: "",
    model: "",
    trim: "",
    mileage: "",
    price: "",
    photoNames: [],
    maintenanceNames: [],
    damage: "",
    description: "",
    requireVerified: true,
    hideLowball: true,
    showPrecheck: true,
    updatedAt: ""
  };
}

function loadSellerDraft() {
  try {
    return { ...defaultSellerDraft(), ...JSON.parse(localStorage.getItem("kerodex-seller-draft") || "{}") };
  } catch {
    return defaultSellerDraft();
  }
}

function saveSellerDraft(draft) {
  localStorage.setItem("kerodex-seller-draft", JSON.stringify({ ...draft, updatedAt: new Date().toISOString() }));
}

function loadSellerCars() {
  try {
    return JSON.parse(localStorage.getItem("kerodex-seller-cars") || "[]");
  } catch {
    return [];
  }
}

function saveSellerCars(cars) {
  localStorage.setItem("kerodex-seller-cars", JSON.stringify(cars));
}

function namesForFiles(input) {
  return Array.from(input?.files || []).map((file) => file.name);
}

function readFirstImage(input) {
  const file = input?.files && input.files[0];
  if (!file) return Promise.resolve("");
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = () => resolve("");
    reader.readAsDataURL(file);
  });
}

const conservativeMarketGuide = {
  toyota: {
    corolla: 20000,
    camry: 22500,
    tacoma: 33500,
    "4runner": 37500
  },
  honda: {
    civic: 20500,
    accord: 23500
  },
  tesla: {
    "model 3": 28500,
    "model y": 34000
  },
  ford: {
    "f-150": 35500,
    mustang: 31500
  },
  bmw: {
    "3 series": 28500,
    "m3": 64500
  },
  lexus: {
    "gx 460": 41000
  }
};

async function marketListings() {
  if (marketListingsCache) return marketListingsCache;
  try {
    const response = await fetch("/api/listings");
    const data = await response.json();
    marketListingsCache = data.listings || [];
  } catch {
    marketListingsCache = [];
  }
  return marketListingsCache;
}

function normalizeMarketText(value) {
  return String(value || "").trim().toLowerCase();
}

function guideBaseValue(draft) {
  const make = normalizeMarketText(draft.make);
  const model = normalizeMarketText(draft.model);
  if (!make || !model) return 0;
  const makeGuide = conservativeMarketGuide[make] || {};
  const exact = makeGuide[model];
  if (exact) return exact;
  const partialKey = Object.keys(makeGuide).find((key) => model.includes(key) || key.includes(model));
  if (partialKey) return makeGuide[partialKey];
  return 0;
}

function adjustMarketValue(base, draft, referenceYear = 2023, referenceMileage = 30000) {
  const year = Number(draft.year || new Date().getFullYear());
  const mileage = Number(draft.mileage || 0);
  let adjusted = base;
  if (year) adjusted += (year - referenceYear) * 950;
  if (mileage) adjusted -= ((mileage - referenceMileage) / 1000) * 85;
  if (String(draft.damage || "").trim() && !/^none$/i.test(String(draft.damage).trim())) adjusted -= 2200;
  return Math.max(3000, adjusted);
}

function sellerPricingEstimate(draft = loadSellerDraft(), comparableListings = []) {
  const make = normalizeMarketText(draft.make);
  const model = normalizeMarketText(draft.model);
  const year = Number(draft.year || 0);
  const mileage = Number(draft.mileage || 0);
  if (!make || !model) {
    return {
      low: 0,
      high: 0,
      midpoint: 0,
      needsVehicle: true,
      source: "Add make and model to start the beta pricing guide."
    };
  }
  const exact = comparableListings.filter((listing) => {
    return normalizeMarketText(listing.make) === make && normalizeMarketText(listing.model) === model;
  });

  if (exact.length >= 2) {
    const adjustedValues = exact.map((listing) => adjustMarketValue(Number(listing.price || 0), draft, Number(listing.year || year || 2023), Number(listing.mileage || mileage || 30000)));
    adjustedValues.sort((a, b) => a - b);
    const middle = adjustedValues.slice(0, Math.min(5, adjustedValues.length));
    const average = middle.reduce((sum, value) => sum + value, 0) / middle.length;
    const low = Math.max(3000, Math.round(average * 0.94 / 250) * 250);
    const high = Math.max(low + 1000, Math.round(average * 1.04 / 250) * 250);
    return {
      low,
      high,
      midpoint: Math.round((low + high) / 500) * 250,
      source: `${exact.length} Kerodex ${draft.make} ${draft.model} comps`
    };
  }

  const baseValue = guideBaseValue(draft);
  if (!baseValue) {
    return {
      low: 0,
      high: 0,
      midpoint: 0,
      needsVehicle: true,
      source: "This model needs comparable listings or a manual value check."
    };
  }
  const guided = adjustMarketValue(baseValue, draft);
  const low = Math.max(3000, Math.round(guided * 0.94 / 250) * 250);
  const high = Math.max(low + 1000, Math.round(guided * 1.04 / 250) * 250);
  return {
    low,
    high,
    midpoint: Math.round((low + high) / 500) * 250,
    source: mileage
      ? "Conservative beta guide; not a live KBB, CarMax, or dealer offer"
      : "Add mileage to tighten this beta range; not a live KBB, CarMax, or dealer offer"
  };
}

function sellerQualityChecks(draft = loadSellerDraft()) {
  return [
    { label: "VIN entered and decoded-ready", passed: /^[A-HJ-NPR-Z0-9]{17}$/.test(String(draft.vin || "").toUpperCase()) },
    { label: "Year, make, model, trim filled", passed: Boolean(draft.year && draft.make && draft.model && draft.trim) },
    { label: "Mileage and asking price added", passed: Boolean(draft.mileage && draft.price) },
    { label: "At least 5 vehicle photos uploaded", passed: (draft.photoNames || []).length >= 5 },
    { label: "Damage disclosure completed", passed: Boolean(String(draft.damage || "").trim()) },
    { label: "Maintenance records attached", passed: (draft.maintenanceNames || []).length > 0 },
    { label: "Description generated or written", passed: String(draft.description || "").trim().length >= 120 }
  ];
}

function sellerQualityScore(draft = loadSellerDraft()) {
  const checks = sellerQualityChecks(draft);
  return Math.round((checks.filter((check) => check.passed).length / checks.length) * 100);
}

function generateSellerDescription(draft = loadSellerDraft()) {
  const title = [draft.year, draft.make, draft.model, draft.trim].filter(Boolean).join(" ") || "This vehicle";
  const mileage = draft.mileage ? `${Number(draft.mileage).toLocaleString()} miles` : "mileage ready to confirm";
  const records = (draft.maintenanceNames || []).length ? "Maintenance records are attached for buyer review." : "Maintenance records can be added before publishing.";
  const damage = String(draft.damage || "").trim() || "Damage disclosure is pending.";
  return `${title} is being prepared as a verified private-party Kerodex listing with ${mileage}. The seller is collecting VIN, ownership, photo, and live-proof signals before the listing goes public. ${records} Damage disclosure: ${damage}. Serious buyers can use verification badges, pricing guidance, and secure messaging to move forward with confidence.`;
}

function hydrateSellerForm() {
  const draft = loadSellerDraft();
  document.querySelector("#sellerVin").value = draft.vin;
  document.querySelector("#sellerYear").value = draft.year;
  document.querySelector("#sellerMake").value = draft.make;
  document.querySelector("#sellerModel").value = draft.model;
  document.querySelector("#sellerTrim").value = draft.trim;
  document.querySelector("#sellerMileage").value = draft.mileage;
  document.querySelector("#sellerPrice").value = draft.price;
  document.querySelector("#sellerDamage").value = draft.damage;
  document.querySelector("#sellerDescription").value = draft.description;
  document.querySelector("#sellerRequireVerified").checked = draft.requireVerified;
  document.querySelector("#sellerHideLowball").checked = draft.hideLowball;
  document.querySelector("#sellerPrecheck").checked = draft.showPrecheck;
  renderSellerHub();
  marketListings().then(renderSellerHub);
}

function draftFromSellerForm() {
  const existing = loadSellerDraft();
  const photoNames = namesForFiles(document.querySelector("#sellerPhotos"));
  const maintenanceNames = namesForFiles(document.querySelector("#sellerMaintenance"));
  return {
    ...existing,
    vin: document.querySelector("#sellerVin").value.trim().toUpperCase(),
    year: document.querySelector("#sellerYear").value.trim(),
    make: document.querySelector("#sellerMake").value.trim(),
    model: document.querySelector("#sellerModel").value.trim(),
    trim: document.querySelector("#sellerTrim").value.trim(),
    mileage: document.querySelector("#sellerMileage").value.trim(),
    price: document.querySelector("#sellerPrice").value.trim(),
    photoNames: photoNames.length ? photoNames : existing.photoNames,
    maintenanceNames: maintenanceNames.length ? maintenanceNames : existing.maintenanceNames,
    damage: document.querySelector("#sellerDamage").value.trim(),
    description: document.querySelector("#sellerDescription").value.trim(),
    requireVerified: document.querySelector("#sellerRequireVerified").checked,
    hideLowball: document.querySelector("#sellerHideLowball").checked,
    showPrecheck: document.querySelector("#sellerPrecheck").checked
  };
}

function renderSellerHub() {
  const draft = loadSellerDraft();
  const cars = loadSellerCars();
  const trustScore = verificationScore(loadVerification());
  const quality = sellerQualityScore(draft);
  const pricing = sellerPricingEstimate(draft, marketListingsCache || []);
  const price = Number(draft.price || 0);
  const signal = pricing.needsVehicle
    ? "Add year, make, model, and mileage before using the pricing guide."
    : !price
    ? "Add an asking price for competitiveness."
    : price < pricing.low
      ? "Priced competitive, watch for lowball spam."
      : price > pricing.high
        ? "Priced high versus the current estimate."
        : "Priced inside the fair-value range.";

  document.querySelector("#sellerTrustScore").textContent = trustScore;
  document.querySelector("#sellerDraftCount").textContent = cars.length;
  document.querySelector("#sellerQualityAverage").textContent = cars.length ? `${Math.round(cars.reduce((sum, car) => sum + Number(car.quality || 0), 0) / cars.length)}%` : `${quality}%`;
  document.querySelector("#sellerBuyerRule").textContent = draft.requireVerified ? "Verified" : "Open";
  document.querySelector("#sellerDraftStatus").textContent = trustScore >= 70 ? "Review-ready draft" : "Private draft";
  document.querySelector("#sellerPricingRange").textContent = pricing.needsVehicle
    ? "Add vehicle details"
    : `${profileCurrency.format(pricing.low)} - ${profileCurrency.format(pricing.high)}`;
  document.querySelector("#sellerPricingSignal").textContent = signal;
  document.querySelector("#sellerPricingSource").textContent = pricing.source;
  document.querySelector("#sellerQualityScore").textContent = `${quality}%`;
  document.querySelector("#sellerQualityFill").style.width = `${quality}%`;
  document.querySelector("#sellerQualityList").innerHTML = sellerQualityChecks(draft)
    .map((check) => `<li class="${check.passed ? "done" : ""}"><span>${check.passed ? "Done" : "Next"}</span>${check.label}</li>`)
    .join("");

  const buyerRules = [
    { name: "Maya R.", badge: "Identity verified", note: "Asked to schedule a test drive", score: "High intent" },
    { name: "Chris W.", badge: draft.showPrecheck ? "Financing pre-check" : "Buyer verified", note: "Saved listing twice this week", score: "Good" },
    { name: "Unknown buyer", badge: draft.hideLowball ? "Filtered" : "Open", note: "Copy-paste message and low offer pattern", score: draft.hideLowball ? "Hidden" : "Review" }
  ];
  document.querySelector("#sellerBuyerList").innerHTML = buyerRules
    .map((buyer) => `<div><strong>${buyer.name}</strong><span>${buyer.badge}</span><p>${buyer.note}</p><em>${buyer.score}</em></div>`)
    .join("");

  const stats = cars.reduce((totals, car) => ({
    views: totals.views + Number(car.views || 0),
    saves: totals.saves + Number(car.saves || 0),
    messages: totals.messages + Number(car.messages || 0),
    days: totals.days + Number(car.daysListed || 0)
  }), { views: 0, saves: 0, messages: 0, days: 0 });
  document.querySelector("#sellerTotalViews").textContent = stats.views.toLocaleString();
  document.querySelector("#sellerTotalSaves").textContent = stats.saves.toLocaleString();
  document.querySelector("#sellerTotalMessages").textContent = stats.messages.toLocaleString();
  document.querySelector("#sellerAvgDays").textContent = cars.length ? Math.round(stats.days / cars.length) : "0";

  document.querySelector("#sellerListingsGrid").innerHTML = cars.length
    ? cars.map((car) => `
      <article data-seller-car-id="${car.id}">
        <img class="seller-car-thumb" src="${car.image || "https://images.unsplash.com/photo-1549924231-f129b911e442?auto=format&fit=crop&w=800&q=80"}" alt="${car.title}">
        <div class="seller-car-main">
          <strong>${car.title}</strong>
          <span>${profileCurrency.format(Number(car.price || 0))} | ${Number(car.mileage || 0).toLocaleString()} mi</span>
          <p>${car.description || "No public description yet."}</p>
        </div>
        <div class="seller-car-stats">
          <em>${car.quality}% quality</em>
          <em>${car.views} views</em>
          <em>${car.saves} saves</em>
          <em>${car.messages} messages</em>
        </div>
        <button type="button" data-remove-seller-car="${car.id}">Remove</button>
      </article>
    `).join("")
    : `<article class="seller-empty-car"><strong>No cars listed yet</strong><span>Add a car with the draft form above.</span><p>Your seller stats will appear here once you add cars.</p></article>`;
}

function setSavedListingIds(ids) {
  localStorage.setItem("kerodex-saved-listings", JSON.stringify([...new Set(ids)]));
}

function initialsFor(value) {
  return String(value || "Account").trim().slice(0, 1).toUpperCase() || "A";
}

function setProfileText(name, location) {
  document.querySelector("#profileName").textContent = name;
  document.querySelector("#profileLocation").textContent = location;
  document.querySelector("#profileInitial").textContent = initialsFor(name);
  document.querySelector(".profile-tab-avatar").textContent = initialsFor(name);
  if (!document.querySelector("#profilePhoto").classList.contains("has-image")) {
    document.querySelector("#profilePhoto").textContent = initialsFor(name);
  }
}

function loadProfile() {
  const user = currentUser();
  let name = "Account";
  let location = localStorage.getItem("kerodex-profile-location") || "Atlanta, GA";
  if (user) name = user.name || user.email || name;
  name = localStorage.getItem("kerodex-profile-name") || name;
  document.querySelector("#profileNameInput").value = name;
  document.querySelector("#profileLocationInput").value = location;
  document.querySelector("#joinedYear").textContent = user?.joinedYear || "2026";
  setProfileText(name, location);
  document.querySelector("#settingsName").textContent = name;
  document.querySelector("#settingsEmail").textContent = user?.email || "Not added";
}

function renderSavedCard(listing) {
  return `
    <article class="saved-car-card" data-listing-id="${listing.id}">
      <img src="${listing.images[0]}" alt="${listing.title}" loading="lazy">
      <div>
        <span>${listing.year} | ${listing.mileage.toLocaleString()} mi</span>
        <h3>${listing.title}</h3>
        <p>${listing.location} | ${listing.seller.name}</p>
        <strong>${profileCurrency.format(listing.price)}</strong>
        <div class="saved-card-actions">
          <a href="/listing.html?id=${encodeURIComponent(listing.id)}">View listing</a>
          <button type="button" data-unsave-listing="${listing.id}">Remove</button>
        </div>
      </div>
    </article>
  `;
}

async function renderSavedCars() {
  const grid = document.querySelector("#savedCarsGrid");
  if (!isSignedIn()) {
    document.querySelector("#savedCount").textContent = "0";
    grid.innerHTML = `<div class="saved-empty"><h3>Sign in to save cars</h3><p>Your saved cars are tied to your account.</p><a href="/">Log in or sign up</a></div>`;
    return;
  }
  const ids = savedListingIds();
  document.querySelector("#savedCount").textContent = ids.length;

  if (!ids.length) {
    grid.innerHTML = `<div class="saved-empty"><h3>No saved cars yet</h3><p>Save cars from search results or listing pages and they will appear here.</p><a href="/search.html">Browse cars</a></div>`;
    return;
  }

  const response = await fetch("/api/listings");
  const data = await response.json();
  const listings = (data.listings || []).filter((listing) => ids.includes(listing.id));
  grid.innerHTML = listings.length
    ? listings.map(renderSavedCard).join("")
    : `<div class="saved-empty"><h3>Saved cars unavailable</h3><p>Those listings may have been removed from the current seed data.</p></div>`;
}

function hydrateVerificationForm() {
  const state = loadVerification();
  document.querySelector("#verifyLegalName").value = state.legalName;
  document.querySelector("#verifyEmail").value = state.email;
  document.querySelector("#verifyPhone").value = state.phone;
  document.querySelector("#verifyVin").value = state.vin;
  document.querySelector("#proofCode").textContent = state.proofCode;
  renderVinDecodeResult(state);
  renderVerification();
}

function renderVinDecodeResult(state = loadVerification()) {
  const result = document.querySelector("#vinDecodeResult");
  if (!state.vinDecoded) {
    result.hidden = true;
    result.innerHTML = "";
    return;
  }

  result.hidden = false;
  if (!state.vinDecoded.ok) {
    result.innerHTML = `<strong>VIN needs review</strong><span>${state.vinDecoded.error || state.vinDecoded.errorText || "The decoder could not validate this VIN."}</span>`;
    return;
  }

  const vehicle = state.vinDecoded.vehicle || {};
  result.innerHTML = `
    <strong>${vehicle.year || "Year pending"} ${vehicle.make || "Make pending"} ${vehicle.model || "Model pending"}</strong>
    <span>${vehicle.bodyClass || "Body pending"}${vehicle.fuelType ? ` | ${vehicle.fuelType}` : ""}${vehicle.plantCountry ? ` | Built in ${vehicle.plantCountry}` : ""}</span>
    <small>Source: ${state.vinDecoded.source || "NHTSA vPIC"}</small>
  `;
}

function renderVerification() {
  const state = loadVerification();
  const score = verificationScore(state);
  const status = verificationStatus(score);
  state.status = status.status;
  saveVerification(state);

  document.querySelector("#verificationScore").textContent = score;
  document.querySelector("#verificationStatusTitle").textContent = status.title;
  document.querySelector("#verificationStatusText").textContent = status.text;
  document.querySelector(".verification-hero-card").dataset.status = status.status;
  document.querySelector("#verificationChecklist").innerHTML = verificationChecks(state)
    .map((check) => `
      <div class="${check.passed ? "passed" : ""}">
        <span>${check.passed ? "Done" : "Needed"}</span>
        <strong>${check.label}</strong>
        <em>${check.points} pts</em>
      </div>
    `)
    .join("");
  const completed = Math.max(1, Math.min(3, Math.round(score / 34)));
  document.querySelector("#accountSecurityFill").style.width = `${completed / 3 * 100}%`;
  document.querySelector("#accountSecurityText").textContent = `${completed} of 3 completed`;
  document.querySelector("#settingsPhone").textContent = state.phone || "No phone number added";
}

function showPanel(name) {
  if (!isSignedIn()) {
    document.querySelector("#signedOutProfile").hidden = false;
    document.querySelector("#profileApp").hidden = true;
    return;
  }
  document.querySelectorAll(".profile-tab").forEach((tab) => {
    tab.classList.toggle("active", tab.dataset.profilePanel === name);
  });
  document.querySelectorAll(".profile-panel").forEach((panel) => {
    const active = panel.id.toLowerCase().includes(name);
    panel.hidden = !active;
    panel.classList.toggle("active", active);
  });
  if (name === "saved") renderSavedCars();
  if (name === "seller") renderSellerHub();
  const nextHash = {
    about: "personal-information",
    saved: "saved-cars",
    verification: "verification",
    seller: "seller-cockpit"
  }[name] || "personal-information";
  window.history.replaceState({}, "", `/profile.html#${nextHash}`);
}

function panelFromHash() {
  const hash = window.location.hash.replace("#", "");
  if (hash === "saved" || hash === "saved-cars") return "saved";
  if (hash === "personal-information" || hash === "about") return "about";
  if (hash === "verification") return "verification";
  if (hash === "seller" || hash === "seller-cockpit" || hash === "draft") return "seller";
  return "about";
}

if (localStorage.getItem("kerodex-theme") === "dark") {
  document.body.classList.add("dark");
}

if (requireSignedIn()) {
  loadProfile();
  renderSavedCars();
} else {
  document.querySelector("#profileLogoutButton").hidden = true;
}

const storedProfilePhoto = localStorage.getItem("kerodex-profile-photo");
const profilePhoto = document.querySelector("#profilePhoto");
if (isSignedIn() && storedProfilePhoto) {
  profilePhoto.textContent = "";
  profilePhoto.style.backgroundImage = `url("${storedProfilePhoto}")`;
  profilePhoto.classList.add("has-image");
}

document.querySelector("#profilePageMenuToggle").addEventListener("click", () => {
  const menu = document.querySelector("#profilePageMenu");
  const isOpen = !menu.hidden;
  menu.hidden = isOpen;
  document.querySelector("#profilePageMenuToggle").setAttribute("aria-expanded", String(!isOpen));
});

document.addEventListener("click", (event) => {
  if (event.target.closest(".profile-shell")) return;
  document.querySelector("#profilePageMenu").hidden = true;
  document.querySelector("#profilePageMenuToggle").setAttribute("aria-expanded", "false");
});

document.querySelector("#profileThemeToggle").addEventListener("click", () => {
  document.body.classList.toggle("dark");
  localStorage.setItem("kerodex-theme", document.body.classList.contains("dark") ? "dark" : "light");
});

document.querySelector("#profileAuthPromptButton")?.addEventListener("click", () => openProfileAuth("signin"));
document.querySelector("#profileAuthClose")?.addEventListener("click", closeProfileAuth);
document.querySelector("#profileAuthModal")?.addEventListener("click", (event) => {
  if (event.target === event.currentTarget) closeProfileAuth();
});
document.querySelectorAll("[data-profile-auth-mode]").forEach((button) => {
  button.addEventListener("click", () => setProfileAuthMode(button.dataset.profileAuthMode));
});
document.querySelector("#profileAuthSubmit")?.addEventListener("click", emailProfileAuth);
document.querySelectorAll("[data-profile-social-provider]").forEach((button) => {
  button.addEventListener("click", () => socialProfileAuth(button.dataset.profileSocialProvider));
});

document.querySelector("#profileLogoutButton").addEventListener("click", () => {
  localStorage.removeItem("kerodex-token");
  localStorage.removeItem("kerodex-user");
  localStorage.removeItem("kerodex-profile-name");
  localStorage.removeItem("kerodex-profile-location");
  localStorage.removeItem("kerodex-profile-photo");
  window.location.href = "/";
});

document.querySelector("#profileImageInput").addEventListener("change", (event) => {
  const file = event.target.files && event.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    profilePhoto.textContent = "";
    profilePhoto.style.backgroundImage = `url("${reader.result}")`;
    profilePhoto.classList.add("has-image");
    try {
      localStorage.setItem("kerodex-profile-photo", reader.result);
    } catch {
      document.querySelector(".profile-photo-action").textContent = "Image too large";
    }
  };
  reader.readAsDataURL(file);
});

document.querySelector("#editProfileButton").addEventListener("click", () => {
  const form = document.querySelector("#profileEditForm");
  form.hidden = !form.hidden;
});

document.querySelector("#profileEditForm").addEventListener("submit", (event) => {
  event.preventDefault();
  const name = document.querySelector("#profileNameInput").value.trim() || "Account";
  const location = document.querySelector("#profileLocationInput").value.trim() || "Atlanta, GA";
  localStorage.setItem("kerodex-profile-name", name);
  localStorage.setItem("kerodex-profile-location", location);
  setProfileText(name, location);
  document.querySelector("#settingsName").textContent = name;
  event.currentTarget.hidden = true;
});

document.querySelectorAll("[data-profile-edit-shortcut]").forEach((button) => {
  button.addEventListener("click", () => {
    const form = document.querySelector("#profileEditForm");
    form.hidden = false;
    form.scrollIntoView({ behavior: "smooth", block: "center" });
  });
});

document.querySelectorAll("[data-profile-panel]").forEach((tab) => {
  tab.addEventListener("click", () => showPanel(tab.dataset.profilePanel));
});

if (isSignedIn()) {
  showPanel(panelFromHash());
}

document.querySelectorAll(".seller-link").forEach((button) => {
  button.addEventListener("click", () => {
    if (!isSignedIn()) {
      openProfileAuth("create");
      return;
    }
    showPanel("seller");
    window.history.replaceState({}, "", "/profile.html#seller-cockpit");
  });
});

document.querySelector("#savedCarsGrid").addEventListener("click", (event) => {
  const button = event.target.closest("[data-unsave-listing]");
  if (!button) return;
  setSavedListingIds(savedListingIds().filter((id) => id !== button.dataset.unsaveListing));
  renderSavedCars();
});

document.querySelector("#accountVerificationForm").addEventListener("submit", (event) => {
  event.preventDefault();
  const state = loadVerification();
  state.legalName = document.querySelector("#verifyLegalName").value.trim();
  state.email = document.querySelector("#verifyEmail").value.trim();
  state.phone = document.querySelector("#verifyPhone").value.trim();
  saveVerification(state);
  renderVerification();
});

document.querySelector("#documentVerificationForm").addEventListener("submit", (event) => {
  event.preventDefault();
  const state = loadVerification();
  state.idDocumentName = fileNameFor(document.querySelector("#verifyIdDocument")) || state.idDocumentName;
  state.selfieName = fileNameFor(document.querySelector("#verifySelfie")) || state.selfieName;
  saveVerification(state);
  renderVerification();
});

document.querySelector("#vinVerificationForm").addEventListener("submit", async (event) => {
  event.preventDefault();
  const state = loadVerification();
  const vin = document.querySelector("#verifyVin").value.trim().toUpperCase();
  state.vin = vin;
  state.ownershipDocumentName = fileNameFor(document.querySelector("#verifyOwnershipDocument")) || state.ownershipDocumentName;
  state.vinPhotoName = fileNameFor(document.querySelector("#verifyVinPhoto")) || state.vinPhotoName;
  state.odometerPhotoName = fileNameFor(document.querySelector("#verifyOdometerPhoto")) || state.odometerPhotoName;
  state.platePhotoName = fileNameFor(document.querySelector("#verifyPlatePhoto")) || state.platePhotoName;
  state.vinDecoded = { ok: false, error: "Decoding VIN..." };
  saveVerification(state);
  renderVinDecodeResult(state);

  try {
    const response = await fetch(`/api/vin/decode/${encodeURIComponent(vin)}`);
    state.vinDecoded = await response.json();
  } catch {
    state.vinDecoded = { ok: false, error: "VIN decoder is unavailable. Retry before publishing." };
  }
  saveVerification(state);
  renderVinDecodeResult(state);
  renderVerification();
});

["#verifyOwnershipDocument", "#verifyVinPhoto", "#verifyOdometerPhoto", "#verifyPlatePhoto", "#verifyLiveProofPhoto"].forEach((selector) => {
  document.querySelector(selector)?.addEventListener("change", () => {
    const state = loadVerification();
    state.ownershipDocumentName = fileNameFor(document.querySelector("#verifyOwnershipDocument")) || state.ownershipDocumentName;
    state.vinPhotoName = fileNameFor(document.querySelector("#verifyVinPhoto")) || state.vinPhotoName;
    state.odometerPhotoName = fileNameFor(document.querySelector("#verifyOdometerPhoto")) || state.odometerPhotoName;
    state.platePhotoName = fileNameFor(document.querySelector("#verifyPlatePhoto")) || state.platePhotoName;
    state.liveProofPhotoName = fileNameFor(document.querySelector("#verifyLiveProofPhoto")) || state.liveProofPhotoName;
    saveVerification(state);
    renderVerification();
  });
});

document.querySelector("#refreshProofCode").addEventListener("click", () => {
  const state = loadVerification();
  state.proofCode = `KERODEX-${Math.floor(100000 + Math.random() * 900000)}`;
  saveVerification(state);
  document.querySelector("#proofCode").textContent = state.proofCode;
});

document.querySelector("#runVerificationReview").addEventListener("click", () => {
  const state = loadVerification();
  state.reviewedAt = new Date().toISOString();
  saveVerification(state);
  renderVerification();
});

document.querySelector("#clearVerification").addEventListener("click", () => {
  saveVerification(defaultVerification());
  hydrateVerificationForm();
});

if (isSignedIn()) {
  hydrateVerificationForm();
  hydrateSellerForm();
}

document.querySelector("#sellerNewDraftButton")?.addEventListener("click", () => {
  saveSellerDraft(defaultSellerDraft());
  hydrateSellerForm();
  document.querySelector("#sellerDraftMessage").textContent = "Fresh private draft started.";
});

document.querySelector("#sellerDecodeVin")?.addEventListener("click", async () => {
  const draft = draftFromSellerForm();
  saveSellerDraft(draft);
  document.querySelector("#sellerDraftMessage").textContent = "Decoding VIN...";
  try {
    const response = await fetch(`/api/vin/decode/${encodeURIComponent(draft.vin)}`);
    const decoded = await response.json();
    if (!decoded.ok) {
      document.querySelector("#sellerDraftMessage").textContent = decoded.error || "VIN needs review before publishing.";
      return;
    }
    const vehicle = decoded.vehicle || {};
    document.querySelector("#sellerYear").value = vehicle.year || draft.year;
    document.querySelector("#sellerMake").value = vehicle.make || draft.make;
    document.querySelector("#sellerModel").value = vehicle.model || draft.model;
    document.querySelector("#sellerTrim").value = vehicle.trim || vehicle.series || draft.trim;
    document.querySelector("#sellerDraftMessage").textContent = vehicle.trim || vehicle.series ? "VIN decoded and trim filled." : "VIN decoded. NHTSA did not return a trim for this VIN.";
    saveSellerDraft(draftFromSellerForm());
    renderSellerHub();
  } catch {
    document.querySelector("#sellerDraftMessage").textContent = "VIN decoder is unavailable. Save the VIN and retry before publishing.";
  }
});

document.querySelector("#sellerGenerateDescription")?.addEventListener("click", () => {
  const draft = draftFromSellerForm();
  draft.description = generateSellerDescription(draft);
  saveSellerDraft(draft);
  document.querySelector("#sellerDescription").value = draft.description;
  document.querySelector("#sellerDraftMessage").textContent = "Description generated from the current draft.";
  renderSellerHub();
});

document.querySelector("#sellerDraftForm")?.addEventListener("submit", async (event) => {
  event.preventDefault();
  const draft = draftFromSellerForm();
  saveSellerDraft(draft);
  const title = [draft.year, draft.make, draft.model, draft.trim].filter(Boolean).join(" ") || "Untitled car";
  const quality = sellerQualityScore(draft);
  const image = await readFirstImage(document.querySelector("#sellerPhotos"));
  const currentUserName = currentUser()?.name || currentUser()?.email || "Kerodex seller";
  let apiListing = null;
  try {
    const response = await fetch("/api/listings", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        ...draft,
        image,
        sellerName: currentUserName,
        location: localStorage.getItem("kerodex-profile-location") || "Private seller"
      })
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || "Unable to add listing.");
    apiListing = data.listing;
    marketListingsCache = null;
  } catch (error) {
    document.querySelector("#sellerDraftMessage").textContent = error.message || "Saved locally, but the listing API did not accept it.";
  }
  const cars = loadSellerCars();
  cars.unshift({
    id: apiListing?.id || `seller_${Date.now()}`,
    title: apiListing?.title || title,
    price: apiListing?.price || draft.price || 0,
    mileage: apiListing?.mileage || draft.mileage || 0,
    image: apiListing?.images?.[0] || image,
    description: draft.description,
    quality,
    views: Math.max(12, quality * 9 + cars.length * 17),
    saves: Math.max(1, Math.round(quality / 11)),
    messages: Math.max(0, Math.round(quality / 18)),
    daysListed: 1,
    createdAt: new Date().toISOString()
  });
  saveSellerCars(cars);
  saveSellerDraft(defaultSellerDraft());
  hydrateSellerForm();
  document.querySelector("#sellerDraftMessage").textContent = apiListing ? "Car added to your seller cockpit and local search." : "Car added to your seller cockpit.";
  renderSellerHub();
});

["#sellerRequireVerified", "#sellerHideLowball", "#sellerPrecheck"].forEach((selector) => {
  document.querySelector(selector)?.addEventListener("change", () => {
    saveSellerDraft(draftFromSellerForm());
    renderSellerHub();
  });
});

document.querySelector("#sellerDraftForm")?.addEventListener("input", () => {
  saveSellerDraft(draftFromSellerForm());
  renderSellerHub();
});

document.querySelector("#sellerListingsGrid")?.addEventListener("click", (event) => {
  const button = event.target.closest("[data-remove-seller-car]");
  if (!button) return;
  saveSellerCars(loadSellerCars().filter((car) => car.id !== button.dataset.removeSellerCar));
  document.querySelector("#sellerDraftMessage").textContent = "Car removed from your seller cockpit.";
  renderSellerHub();
});
