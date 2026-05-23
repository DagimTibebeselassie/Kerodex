const form = document.querySelector("#resultsSearch");
const grid = document.querySelector("#resultsGrid");
const mapView = document.querySelector("#resultsMapView");
const mapList = document.querySelector("#resultsMapList");
const title = document.querySelector("#resultsTitle");
const subtitle = document.querySelector("#resultsSubtitle");
const themeButton = document.querySelector("#resultsTheme");
let listingsCache = [];
let resultsMap;
let resultsMarkerLayer;

const currency = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 0
});

function currentParams() {
  return new URLSearchParams(window.location.search);
}

function hydrateForm() {
  const params = currentParams();
  for (const [key, value] of params.entries()) {
    const field = form.elements[key];
    if (field) field.value = value;
  }
}

function resultCard(listing) {
  const savings = Math.abs(Math.min(listing.fairValueDelta || 0, 0));
  return `
    <article class="result-card">
      <div class="result-media">
        <img src="${listing.images[0]}" alt="${listing.title}" loading="lazy">
        <button class="result-save" type="button" aria-label="Save ${listing.title}">♡</button>
      </div>
      <div class="result-card-body">
        <h2>${listing.title}</h2>
        <p class="result-meta">${listing.year} · ${listing.mileage.toLocaleString()} mi · ${listing.dealScore} deal score</p>
        <p class="result-detail">${listing.location} · ${listing.seller.name}</p>
        <div class="badges">
          ${listing.badges.slice(0, 3).map((badge) => `<span>${badge}</span>`).join("")}
        </div>
        <div class="result-price">
          <span>${savings ? `Save ${currency.format(savings)}` : "Fair value"}</span>
          <strong>${currency.format(listing.price)}</strong>
        </div>
      </div>
    </article>
  `;
}

function compactCard(listing) {
  return `
    <article class="result-card compact">
      <div class="result-media">
        <img src="${listing.images[0]}" alt="${listing.title}" loading="lazy">
      </div>
      <div class="result-card-body">
        <h2>${listing.title}</h2>
        <p class="result-meta">${listing.location} · ${listing.mileage.toLocaleString()} mi</p>
        <strong>${currency.format(listing.price)}</strong>
      </div>
    </article>
  `;
}

function markerHtml(listing) {
  return `<button class="leaflet-price-pin" type="button">${Math.round(listing.price / 1000)}k</button>`;
}

function ensureResultsMap() {
  if (!window.L || resultsMap) return Boolean(resultsMap);
  resultsMap = L.map("resultsMap", {
    center: [39.5, -98.35],
    zoom: 4,
    scrollWheelZoom: false,
    zoomControl: true
  });
  L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    attribution: "&copy; OpenStreetMap contributors"
  }).addTo(resultsMap);
  resultsMarkerLayer = L.layerGroup().addTo(resultsMap);
  return true;
}

function renderMapView() {
  mapList.innerHTML = listingsCache.map(compactCard).join("");
  if (!ensureResultsMap()) return;
  resultsMarkerLayer.clearLayers();
  const bounds = [];
  listingsCache.forEach((listing) => {
    L.marker([listing.lat, listing.lng], {
      icon: L.divIcon({ className: "", html: markerHtml(listing), iconAnchor: [24, 18] })
    })
      .bindPopup(`<strong>${listing.title}</strong><br>${currency.format(listing.price)} · ${listing.location}`)
      .addTo(resultsMarkerLayer);
    bounds.push([listing.lat, listing.lng]);
  });
  if (bounds.length) resultsMap.fitBounds(bounds, { padding: [30, 30], maxZoom: 6 });
  setTimeout(() => resultsMap.invalidateSize(), 80);
}

async function loadResults() {
  const params = currentParams();
  const response = await fetch(`/api/listings?${params.toString()}`);
  const data = await response.json();
  const listings = data.listings || [];
  listingsCache = listings;
  const query = params.get("q") || params.get("make") || "cars";

  title.textContent = `${listings.length || "No"} cars available`;
  subtitle.textContent = listings.length
    ? `Results matching "${query}" from private sellers.`
    : `No exact matches for "${query}" yet. Try a broader search.`;

  grid.innerHTML = listings.length
    ? listings.map(resultCard).join("")
    : `<div class="results-empty">No listings matched this search yet.</div>`;
  renderMapView();
}

form.addEventListener("submit", (event) => {
  event.preventDefault();
  const params = new URLSearchParams(new FormData(form));
  [...params.entries()].forEach(([key, value]) => {
    if (!value) params.delete(key);
  });
  window.location.href = `/search.html?${params.toString()}`;
});

themeButton.addEventListener("click", () => {
  document.body.classList.toggle("dark");
  localStorage.setItem("kerodex-theme", document.body.classList.contains("dark") ? "dark" : "light");
});

document.querySelectorAll("[data-results-view]").forEach((button) => {
  button.addEventListener("click", () => {
    document.querySelectorAll("[data-results-view]").forEach((item) => {
      item.classList.toggle("active", item === button);
    });
    const isMap = button.dataset.resultsView === "map";
    grid.hidden = isMap;
    mapView.hidden = !isMap;
    if (isMap) renderMapView();
  });
});

document.querySelectorAll(".results-filterbar > button").forEach((button) => {
  button.addEventListener("click", () => {
    button.classList.toggle("is-active");
  });
});

if (localStorage.getItem("kerodex-theme") === "dark") {
  document.body.classList.add("dark");
}

hydrateForm();
loadResults();
