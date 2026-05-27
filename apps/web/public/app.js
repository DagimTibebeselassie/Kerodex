const state = {
  filters: {},
  view: "best",
  listings: [],
  rawListings: [],
  requestKey: "",
  selectedListingId: null
};

const form = document.querySelector("#searchForm");
const navSearchForm = document.querySelector("#navSearchForm");
const collectionStackEl = document.querySelector("#collectionStack");
const listingsEl = document.querySelector("#listings");
const skeletonsEl = document.querySelector("#skeletons");
const resultCountEl = document.querySelector("#resultCount");
const appLoader = document.querySelector("#appLoader");
const themeToggle = document.querySelector("#themeToggle");
const authMenuButton = document.querySelector("#authMenuButton");
const profileMenuProfileLink = document.querySelector("#profileMenuProfileLink");
const logoutButton = document.querySelector("#logoutButton");
const listCarButton = document.querySelector("#listCarButton");
const becomeSellerButton = document.querySelector("#becomeSellerButton");
const startListingDraftButton = document.querySelector("#startListingDraftButton");
const profileToggle = document.querySelector("#profileToggle");
const profileMenu = document.querySelector("#profileMenu");
const authModal = document.querySelector("#authModal");
const sellModal = document.querySelector("#sellModal");
const authEyebrow = document.querySelector("#authEyebrow");
const authSubmit = document.querySelector("#authSubmit");
const authEmail = document.querySelector("#authEmail");
const authPassword = document.querySelector("#authPassword");
const authMessage = document.querySelector("#authMessage");
const sellMessage = document.querySelector("#sellMessage");
const mapCountEl = document.querySelector("#mapCount");
const mapPanel = document.querySelector(".map-panel");
let mapPreviewCard;

let leafletMap;
let markerLayer;
let markerByListingId = new Map();
let tileLayer;
let tileThemeName;
let activeRequest;
let searchTimer;
let userLocation;
const listingCache = new Map();

function enhanceSelects(scope = document) {
  scope.querySelectorAll("select").forEach((select) => {
    if (select.dataset.enhancedSelect === "true") return;
    select.dataset.enhancedSelect = "true";

    const wrapper = document.createElement("div");
    wrapper.className = "choice-select";
    const trigger = document.createElement("button");
    trigger.className = "choice-select-trigger";
    trigger.type = "button";
    trigger.setAttribute("aria-haspopup", "listbox");
    trigger.setAttribute("aria-expanded", "false");
    const menu = document.createElement("div");
    menu.className = "choice-select-menu";
    menu.setAttribute("role", "listbox");
    menu.hidden = true;

    const positionMenu = () => {
      const rect = trigger.getBoundingClientRect();
      const menuWidth = Math.max(190, Math.min(260, rect.width + 56));
      menu.style.width = `${menuWidth}px`;
      menu.style.left = `${Math.min(Math.max(12, rect.left + window.scrollX), window.scrollX + window.innerWidth - menuWidth - 12)}px`;
      menu.style.top = `${rect.bottom + window.scrollY + 8}px`;
    };

    const syncTrigger = () => {
      const option = select.options[select.selectedIndex] || select.options[0];
      trigger.textContent = option?.textContent || "";
    };

    Array.from(select.options).forEach((option) => {
      const item = document.createElement("button");
      item.type = "button";
      item.className = "choice-select-option";
      item.textContent = option.textContent;
      item.setAttribute("role", "option");
      item.addEventListener("click", () => {
        select.value = option.value;
        Array.from(select.options).forEach((candidate) => {
          candidate.selected = candidate === option;
        });
        select.dispatchEvent(new Event("input", { bubbles: true }));
        select.dispatchEvent(new Event("change", { bubbles: true }));
        syncTrigger();
        menu.hidden = true;
        trigger.setAttribute("aria-expanded", "false");
      });
      menu.appendChild(item);
    });

    trigger.addEventListener("click", (event) => {
      event.stopPropagation();
      document.querySelectorAll(".choice-select-menu").forEach((openMenu) => {
        if (openMenu !== menu) openMenu.hidden = true;
      });
      menu.hidden = !menu.hidden ? true : false;
      if (!menu.hidden) positionMenu();
      trigger.setAttribute("aria-expanded", String(!menu.hidden));
    });

    select.addEventListener("change", syncTrigger);
    select.insertAdjacentElement("afterend", wrapper);
    wrapper.append(trigger);
    document.body.appendChild(menu);
    syncTrigger();
  });
}

document.addEventListener("click", () => {
  document.querySelectorAll(".choice-select-menu").forEach((menu) => {
    menu.hidden = true;
  });
  document.querySelectorAll(".choice-select-trigger").forEach((trigger) => {
    trigger.setAttribute("aria-expanded", "false");
  });
});

const currency = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 0
});

const mapThemes = {
  light: {
    url: "https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png",
    attribution: "&copy; OpenStreetMap contributors &copy; CARTO"
  },
  dark: {
    url: "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png",
    attribution: "&copy; OpenStreetMap contributors &copy; CARTO"
  }
};

function distanceMiles(origin, listing) {
  if (!origin || !Number.isFinite(listing.lat) || !Number.isFinite(listing.lng)) return Number.POSITIVE_INFINITY;
  const radius = 3958.8;
  const toRadians = (value) => value * Math.PI / 180;
  const lat1 = toRadians(origin.lat);
  const lat2 = toRadians(listing.lat);
  const deltaLat = toRadians(listing.lat - origin.lat);
  const deltaLng = toRadians(listing.lng - origin.lng);
  const a = Math.sin(deltaLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(deltaLng / 2) ** 2;
  return radius * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function sortByLocation(listings) {
  if (!userLocation) return listings;
  return [...listings].sort((a, b) => distanceMiles(userLocation, a) - distanceMiles(userLocation, b));
}

function requestUserLocation() {
  if (!navigator.geolocation) return;
  navigator.geolocation.getCurrentPosition(
    (position) => {
      userLocation = {
        lat: position.coords.latitude,
        lng: position.coords.longitude
      };
      if (state.rawListings.length) renderListings(visibleListings(sortByLocation(state.rawListings)));
    },
    () => {},
    { enableHighAccuracy: false, maximumAge: 300000, timeout: 4000 }
  );
}

function paramsFromForm() {
  const data = new FormData(form);
  const params = new URLSearchParams();

  for (const [key, value] of data.entries()) {
    if (value) params.set(key, value);
  }

  for (const [key, value] of Object.entries(state.filters)) {
    if (value) params.set(key, value);
  }

  return params;
}

function paramsKey() {
  return paramsFromForm().toString();
}

function syncSearchForms(sourceForm) {
  const targetForm = sourceForm === form ? navSearchForm : form;
  if (!targetForm) return;

  const sourceData = new FormData(sourceForm);
  for (const [key, value] of sourceData.entries()) {
    const target = targetForm.elements[key];
    if (target && target.value !== value) target.value = value;
  }
}

function setFormField(key, value) {
  [form, navSearchForm].forEach((targetForm) => {
    const field = targetForm?.elements[key];
    if (field) {
      field.value = value;
      field.dispatchEvent(new Event("change", { bubbles: true }));
    }
  });
}

function listingCard(listing) {
  const badges = listing.badges.map((badge) => `<span>${badge}</span>`).join("");
  return `
    <article class="vehicle-card${state.selectedListingId === listing.id ? " is-selected" : ""}" data-listing-id="${listing.id}" tabindex="0">
      <img src="${listing.images[0]}" alt="${listing.title}" loading="lazy">
      <div class="vehicle-body">
        <div class="vehicle-title-row">
          <div>
            <h3>${listing.title}</h3>
            <div class="vehicle-meta">${listing.mileage.toLocaleString()} mi &middot; ${listing.location}</div>
          </div>
          <div class="price">${currency.format(listing.price)}</div>
        </div>
        <div class="badges">${badges}</div>
        <div class="card-footer">
          <span class="seller-line">${listing.seller.name} &middot; ${listing.seller.responseTime}</span>
          <span class="deal-score">${listing.dealScore} deal</span>
        </div>
      </div>
    </article>
  `;
}

function miniListingCard(listing) {
  return `
    <article class="mini-card" data-listing-id="${listing.id}" tabindex="0">
      <img src="${listing.images[0]}" alt="${listing.title}" loading="lazy">
      <div>
        <span>${listing.location}</span>
        <h3>${listing.title}</h3>
        <p>${currency.format(listing.price)} &middot; ${listing.mileage.toLocaleString()} mi</p>
      </div>
    </article>
  `;
}

function collectionRow(title, subtitle, listings) {
  if (!listings.length) return "";
  return `
    <section class="collection-row">
      <div class="collection-heading">
        <div>
          <h3>${title}</h3>
          <p>${subtitle}</p>
        </div>
        <span>${listings.length} cars</span>
      </div>
      <div class="carousel-track">
        ${listings.map(miniListingCard).join("")}
      </div>
    </section>
  `;
}

function renderCollections(listings) {
  const recent = [...listings].sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt)).slice(0, 10);
  const evs = listings.filter((listing) => listing.fuelType === "Electric" || listing.fuelType === "Plug-in hybrid").slice(0, 10);
  const toyotas = listings.filter((listing) => listing.make === "Toyota").slice(0, 10);
  const clean = listings.filter((listing) => listing.badges.includes("No accidents") || listing.badges.includes("Clean title")).slice(0, 10);
  const west = listings.filter((listing) => ["CA", "CO", "WA", "OR", "AZ"].some((region) => listing.location.endsWith(region))).slice(0, 10);

  collectionStackEl.innerHTML = [
    collectionRow("Newest listings", "Fresh private-party cars just added.", recent),
    collectionRow("EVs and plug-ins", "Electric picks with battery and warranty signals.", evs),
    collectionRow("Toyota favorites", "Reliable Toyotas from owners, not dealers.", toyotas),
    collectionRow("Clean-title confidence", "Clean-title and no-accident signals.", clean),
    collectionRow("Western market", "Cars around CA, CO, WA, OR, and AZ.", west)
  ].join("");
}

function visibleListings(listings) {
  const sorted = [...listings];

  if (state.view === "recent") {
    return sorted.sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));
  }

  if (state.view === "dropped") {
    return sorted
      .filter((listing) => listing.badges.includes("Price dropped") || listing.fairValueDelta <= -1800)
      .sort((a, b) => a.fairValueDelta - b.fairValueDelta);
  }

  return sorted.sort((a, b) => b.dealScore - a.dealScore);
}

function markerHtml(listing) {
  return `<button class="leaflet-price-pin${state.selectedListingId === listing.id ? " is-selected" : ""}" type="button" data-map-listing="${listing.id}">$${Math.round(listing.price / 1000)}k</button>`;
}

function popupHtml(listing) {
  return `
    <div class="map-popup">
      <img src="${listing.images[0]}" alt="${listing.title}">
      <strong>${listing.title}</strong>
      <span>${currency.format(listing.price)} &middot; ${listing.mileage.toLocaleString()} mi &middot; ${listing.location}</span>
      <button type="button" data-popup-listing="${listing.id}">View listing</button>
    </div>
  `;
}

function mapPreviewHtml(listing) {
  const miles = distanceMiles(userLocation, listing);
  const distance = Number.isFinite(miles) ? `${Math.round(miles)} mi away` : listing.location;
  return `
    <button class="map-preview-close" type="button" aria-label="Close preview">x</button>
    <button class="map-preview-save" type="button" aria-label="Save listing">♡</button>
    <a class="map-preview-media" href="/listing.html?id=${encodeURIComponent(listing.id)}">
      <img src="${listing.images[0]}" alt="${listing.title}">
    </a>
    <div class="map-preview-copy">
      <div class="map-preview-title-row">
        <strong>${listing.title}</strong>
        <span>${listing.dealScore} score</span>
      </div>
      <span>${listing.bodyType || listing.fuelType} · ${listing.mileage.toLocaleString()} mi · ${distance}</span>
      <small>${currency.format(listing.price)} · ${listing.seller.name} · ${listing.seller.responseTime}</small>
      <a href="/listing.html?id=${encodeURIComponent(listing.id)}">View listing</a>
    </div>
  `;
}
function showMapPreview(listing) {
  if (!mapPanel || !listing) return;
  if (!mapPreviewCard) {
    mapPreviewCard = document.createElement("article");
    mapPreviewCard.className = "map-preview-card";
    mapPanel.appendChild(mapPreviewCard);
  }
  mapPreviewCard.innerHTML = mapPreviewHtml(listing);
  mapPreviewCard.hidden = false;
}

function ensureMap() {
  if (!window.L || leafletMap) return Boolean(leafletMap);

  leafletMap = L.map("mapCanvas", {
    center: [39.5, -98.35],
    zoom: 4,
    minZoom: 3,
    wheelDebounceTime: 90,
    wheelPxPerZoomLevel: 180,
    preferCanvas: true,
    zoomAnimation: false,
    fadeAnimation: false,
    markerZoomAnimation: false,
    boxZoom: false,
    doubleClickZoom: false,
    dragging: true,
    keyboard: false,
    scrollWheelZoom: false,
    touchZoom: false,
    worldCopyJump: true,
    zoomControl: false
  });
  L.control.zoom({ position: "bottomright" }).addTo(leafletMap);

  setMapTileTheme();
  markerLayer = L.layerGroup().addTo(leafletMap);
  leafletMap.on("moveend zoomend resize", refreshMarkerIcons);
  new ResizeObserver(() => leafletMap.invalidateSize()).observe(mapPanel);
  mapPanel.classList.add("has-real-map");
  return true;
}

function currentMapTheme() {
  return document.body.classList.contains("dark") ? "dark" : "light";
}

function setMapTileTheme() {
  if (!leafletMap || !window.L) return;

  const name = currentMapTheme();
  const theme = mapThemes[name];
  if (tileLayer && tileThemeName === name) return;

  const nextTileLayer = L.tileLayer(theme.url, {
    attribution: theme.attribution,
    crossOrigin: true,
    detectRetina: false,
    keepBuffer: 12,
    maxNativeZoom: 20,
    maxZoom: 20,
    minZoom: 3,
    subdomains: "abc",
    tileSize: 256,
    updateInterval: 80,
    updateWhenIdle: false,
    updateWhenZooming: true,
    zIndex: 1
  });

  nextTileLayer.on("tileerror", (event) => {
    const src = event.tile.getAttribute("src");
    if (!src || event.tile.dataset.retry === "1") return;
    event.tile.dataset.retry = "1";
    window.setTimeout(() => {
      event.tile.src = `${src}${src.includes("?") ? "&" : "?"}retry=${Date.now()}`;
    }, 350);
  });

  nextTileLayer.on("load", () => {
    if (tileLayer && tileLayer !== nextTileLayer) tileLayer.remove();
    tileLayer = nextTileLayer;
    tileThemeName = name;
  });

  nextTileLayer.addTo(leafletMap);

  setTimeout(() => {
    if (tileLayer && tileLayer !== nextTileLayer) tileLayer.remove();
    tileLayer = nextTileLayer;
    tileThemeName = name;
    leafletMap.invalidateSize();
  }, 500);
}

function priceIcon(listing) {
  return L.divIcon({
    className: "",
    html: markerHtml(listing),
    iconAnchor: [24, 18],
    popupAnchor: [0, -18]
  });
}

function refreshMarkerIcons() {
  if (!markerByListingId.size) return;

  markerByListingId.forEach((marker, id) => {
    const listing = state.listings.find((item) => item.id === id);
    if (listing) marker.setIcon(priceIcon(listing));
  });
}

function selectListing(listingId, options = {}) {
  state.selectedListingId = listingId;

  document.querySelectorAll(".vehicle-card, .mini-card").forEach((card) => {
    card.classList.toggle("is-selected", card.dataset.listingId === listingId);
  });

  const listing = state.listings.find((item) => item.id === listingId);
  refreshMarkerIcons();

  if (leafletMap && listing) {
    showMapPreview(listing);
    if (options.pan !== false) leafletMap.panTo([listing.lat, listing.lng]);
  }

  const card = document.querySelector(`.vehicle-card[data-listing-id="${listingId}"]`);
  if (card && options.scroll !== false) {
    card.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }
}

function renderMap(listings) {
  if (!ensureMap()) return;

  markerLayer.clearLayers();
  markerByListingId = new Map();

  const bounds = [];
  if (userLocation) bounds.push([userLocation.lat, userLocation.lng]);
  listings.forEach((listing) => {
    const marker = L.marker([listing.lat, listing.lng], {
      icon: priceIcon(listing),
      keyboard: true,
      title: listing.title
    })
      .on("click", () => selectListing(listing.id, { scroll: false, pan: false }));

    marker.addTo(markerLayer);
    markerByListingId.set(listing.id, marker);
    bounds.push([listing.lat, listing.lng]);
  });

  if (bounds.length) {
    leafletMap.fitBounds(bounds, { padding: [50, 50], maxZoom: 7 });
  }

  setTimeout(() => {
    leafletMap.invalidateSize();
    refreshMarkerIcons();
  }, 80);
}

function renderListings(listings) {
  state.listings = listings;
  renderCollections(listings);
  listingsEl.innerHTML = listings.map(listingCard).join("");
  resultCountEl.textContent = `${listings.length} cars`;
  mapCountEl.textContent = listings.length;
  renderMap(listings);
}

function hideLoader() {
  if (!appLoader || appLoader.classList.contains("is-hidden")) return;
  appLoader.classList.add("is-hidden");
  window.setTimeout(() => {
    appLoader.hidden = true;
  }, 320);
}

function updateNavState() {
  document.body.classList.toggle("nav-scrolled", window.scrollY > 72);
}

async function loadListings() {
  const requestKey = paramsKey();
  state.requestKey = requestKey;
  skeletonsEl.hidden = false;
  skeletonsEl.classList.remove("is-hidden");
  listingsEl.innerHTML = "";

  try {
    if (listingCache.has(requestKey)) {
      state.rawListings = listingCache.get(requestKey);
      renderListings(visibleListings(sortByLocation(state.rawListings)));
      return;
    }

    if (activeRequest) activeRequest.abort();
    activeRequest = new AbortController();
    const response = await fetch(`/api/listings?${requestKey}`, {
      signal: activeRequest.signal
    });
    const data = await response.json();
    listingCache.set(requestKey, data.listings);
    state.rawListings = data.listings;
    renderListings(visibleListings(sortByLocation(state.rawListings)));
  } catch (error) {
    if (error.name !== "AbortError") throw error;
  } finally {
    if (state.requestKey === requestKey) {
      skeletonsEl.hidden = true;
      skeletonsEl.classList.add("is-hidden");
      hideLoader();
    }
  }
}

form.addEventListener("submit", (event) => {
  event.preventDefault();
  syncSearchForms(form);
  window.location.href = `/search.html?${paramsFromForm().toString()}`;
});

navSearchForm?.addEventListener("submit", (event) => {
  event.preventDefault();
  syncSearchForms(navSearchForm);
  window.location.href = `/search.html?${paramsFromForm().toString()}`;
});

document.querySelectorAll("[data-view]").forEach((button) => {
  button.addEventListener("click", () => {
    document.querySelectorAll("[data-view]").forEach((tab) => {
      tab.classList.toggle("active", tab === button);
    });
    state.view = button.dataset.view;
    renderListings(visibleListings(state.rawListings));
  });
});

document.querySelectorAll("[data-filter-key]").forEach((button) => {
  button.addEventListener("click", () => {
    const key = button.dataset.filterKey;
    const value = button.dataset.filterValue;
    state.filters = value ? { [key]: value } : {};
    if (value) {
      setFormField(key, value);
    } else {
      ["make", "bodyType", "fuelType", "maxMileage"].forEach((field) => setFormField(field, ""));
    }
    document.querySelectorAll("[data-filter-key]").forEach((chip) => {
      chip.classList.toggle("active", chip === button);
    });
    document.querySelector("#browse")?.scrollIntoView({ behavior: "smooth" });
    loadListings();
  });
});

listingsEl.addEventListener("click", (event) => {
  const card = event.target.closest(".vehicle-card");
  if (card) window.location.href = `/listing.html?id=${encodeURIComponent(card.dataset.listingId)}`;
});

collectionStackEl.addEventListener("click", (event) => {
  const card = event.target.closest(".mini-card");
  if (card) window.location.href = `/listing.html?id=${encodeURIComponent(card.dataset.listingId)}`;
});

document.addEventListener("click", (event) => {
  if (event.target.closest(".map-preview-close")) {
    if (mapPreviewCard) mapPreviewCard.hidden = true;
    return;
  }

  const mapPin = event.target.closest("[data-map-listing]");
  if (mapPin) {
    event.preventDefault();
    selectListing(mapPin.dataset.mapListing, { scroll: false, pan: false });
    return;
  }

  const popupButton = event.target.closest("[data-popup-listing]");
  if (popupButton) selectListing(popupButton.dataset.popupListing, { pan: false });
});

function queueSearch(sourceForm) {
  syncSearchForms(sourceForm);
  window.clearTimeout(searchTimer);
  searchTimer = window.setTimeout(loadListings, 180);
}

form.addEventListener("input", () => queueSearch(form));
navSearchForm?.addEventListener("input", () => queueSearch(navSearchForm));

themeToggle.addEventListener("click", () => {
  document.body.classList.toggle("dark");
  localStorage.setItem("kerodex-theme", document.body.classList.contains("dark") ? "dark" : "light");
  setMapTileTheme();
});

function setAuthMode(mode) {
  const isCreate = mode === "create";
  authEyebrow.textContent = isCreate ? "Join Kerodex" : "Welcome back";
  authSubmit.textContent = isCreate ? "Create account" : "Sign in";
  authMessage.textContent = "";
  authMessage.className = "auth-message";
  document.querySelectorAll("[data-auth-mode]").forEach((button) => {
    button.classList.toggle("active", button.dataset.authMode === mode);
  });
}

function openModal(modal, mode = "signin") {
  if (modal === authModal) setAuthMode(mode);
  modal.hidden = false;
  const input = modal.querySelector("input");
  if (input) input.focus();
}

function closeModals() {
  authModal.hidden = true;
  sellModal.hidden = true;
}

function setAuthMessage(message, type = "") {
  authMessage.textContent = message;
  authMessage.className = `auth-message${type ? ` is-${type}` : ""}`;
}

function displayUserName(user) {
  if (!user) return "Guest account";
  if (String(user.email || "").endsWith("@kerodex.local")) return "Kerodex account";
  return user.name || user.email || "Kerodex account";
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

function updateAuthMenu() {
  const user = currentUser();
  const signedIn = Boolean(user);
  authMenuButton.hidden = signedIn;
  profileMenuProfileLink.hidden = !signedIn;
  logoutButton.hidden = !signedIn;
  document.querySelectorAll("[data-auth-only]").forEach((item) => {
    item.hidden = !signedIn;
  });
  if (signedIn) {
    profileMenuProfileLink.querySelector("span").textContent = displayUserName(user);
  } else {
    profileMenuProfileLink.querySelector("span").textContent = "Account";
  }
}

function storeSession(session) {
  localStorage.setItem("kerodex-token", session.token);
  localStorage.setItem("kerodex-user", JSON.stringify(session.user));
  updateAuthMenu();
  setAuthMessage(`Signed in as ${session.user.email}`, "success");
}

function logout() {
  localStorage.removeItem("kerodex-token");
  localStorage.removeItem("kerodex-user");
  updateAuthMenu();
  profileMenu.hidden = true;
  profileToggle?.setAttribute("aria-expanded", "false");
}

async function finishAuth(response) {
  const data = await response.json();
  if (!response.ok) {
    setAuthMessage(data.error || "Authentication failed.", "error");
    return;
  }
  storeSession(data);
  window.setTimeout(closeModals, 650);
}

async function emailAuth() {
  const activeMode = document.querySelector("[data-auth-mode].active")?.dataset.authMode || "signin";
  setAuthMessage("Checking credentials...");
  const response = await fetch("/api/auth/email", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      mode: activeMode,
      email: authEmail.value,
      password: authPassword.value
    })
  });
  await finishAuth(response);
}

async function socialAuth(provider) {
  setAuthMessage(`Connecting ${provider === "apple" ? "Apple" : "Google"}...`);
  const response = await fetch(`/api/auth/${provider}`, {
    headers: { accept: "application/json" }
  });
  await finishAuth(response);
}

authMenuButton.addEventListener("click", () => openModal(authModal, "signin"));
listCarButton.addEventListener("click", () => openModal(sellModal));
becomeSellerButton?.addEventListener("click", () => openModal(sellModal));
profileMenu?.addEventListener("click", (event) => {
  if (event.target.closest("#logoutButton")) logout();
});
startListingDraftButton?.addEventListener("click", () => {
  if (!currentUser()) {
    closeModals();
    openModal(authModal, "create");
    setAuthMessage("Create an account before starting a seller draft.", "error");
    return;
  }

  localStorage.setItem("kerodex-listing-draft", JSON.stringify({
    startedAt: new Date().toISOString(),
    status: "verification-required"
  }));
  if (sellMessage) {
    sellMessage.textContent = "Draft started. Opening the seller cockpit.";
    sellMessage.className = "auth-message is-success";
  }
  window.setTimeout(() => {
    window.location.href = "/profile.html#seller-cockpit";
  }, 450);
});

profileToggle?.addEventListener("click", () => {
  const isOpen = !profileMenu.hidden;
  profileMenu.hidden = isOpen;
  profileToggle.setAttribute("aria-expanded", String(!isOpen));
});

window.addEventListener("scroll", updateNavState, { passive: true });

document.querySelectorAll("[data-auth-mode]").forEach((button) => {
  button.addEventListener("click", () => setAuthMode(button.dataset.authMode));
});

authSubmit.addEventListener("click", emailAuth);

document.querySelectorAll("[data-social-provider]").forEach((button) => {
  button.addEventListener("click", () => socialAuth(button.dataset.socialProvider));
});

document.querySelectorAll("[data-close-modal]").forEach((button) => {
  button.addEventListener("click", closeModals);
});

document.querySelectorAll(".modal-backdrop").forEach((backdrop) => {
  backdrop.addEventListener("click", (event) => {
    if (event.target === backdrop) closeModals();
  });
});

document.addEventListener("keydown", (event) => {
  if (event.key === "Escape") closeModals();
  if (event.key === "Escape" && profileMenu) {
    profileMenu.hidden = true;
    profileToggle?.setAttribute("aria-expanded", "false");
  }
});

document.addEventListener("click", (event) => {
  if (!profileMenu || !profileToggle) return;
  if (event.target.closest(".profile-shell")) return;
  profileMenu.hidden = true;
  profileToggle.setAttribute("aria-expanded", "false");
});

if (localStorage.getItem("kerodex-theme") === "dark") {
  document.body.classList.add("dark");
}

updateNavState();

updateAuthMenu();

if ("EventSource" in window) {
  const events = new EventSource("/api/events");
  events.addEventListener("listing.updated", () => {
    document.querySelector(".stats-strip div:last-child span").textContent = "Updated moments ago";
  });
}

enhanceSelects();
loadListings();
requestUserLocation();

