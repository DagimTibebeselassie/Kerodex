const profileCurrency = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 0
});

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
    { key: "vinPhoto", label: "VIN plate photo uploaded", passed: Boolean(state.vinPhotoName), points: 10 },
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
  event.currentTarget.hidden = true;
});

document.querySelectorAll("[data-profile-panel]").forEach((tab) => {
  tab.addEventListener("click", () => showPanel(tab.dataset.profilePanel));
});

if (isSignedIn() && window.location.hash === "#verification") {
  showPanel("verification");
}

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
}
