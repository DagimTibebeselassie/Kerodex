const form = document.querySelector("#resultsSearch");
const grid = document.querySelector("#resultsGrid");
const mapView = document.querySelector("#resultsMapView");
const title = document.querySelector("#resultsTitle");
const subtitle = document.querySelector("#resultsSubtitle");
const themeButton = document.querySelector("#resultsTheme");
const logoutButton = document.querySelector("#resultsLogoutButton");
const profileToggle = document.querySelector("#resultsProfileToggle");
const profileMenu = document.querySelector("#resultsProfileMenu");
const filterbar = document.querySelector("#resultsFilterbar");
const filterToggle = document.querySelector("#filterToggle");
let listingsCache = [];
let browseListingsCache = [];
let resultsMap;
let resultsMarkerLayer;
let resultsTileLayer;
let resultsTileThemeName;
let activeFilterMenu;
let resultsMapPreviewCard;
let userLocation;
const MAP_BOUNDS = [[18, -170], [72, -50]];

function savedListingIds() {
  if (!localStorage.getItem("kerodex-user")) return [];
  try {
    return JSON.parse(localStorage.getItem("kerodex-saved-listings") || "[]");
  } catch {
    return [];
  }
}

function setSavedListingIds(ids) {
  if (!localStorage.getItem("kerodex-user")) return;
  localStorage.setItem("kerodex-saved-listings", JSON.stringify([...new Set(ids)]));
}

function isSaved(listingId) {
  return savedListingIds().includes(listingId);
}

function toggleSavedListing(listingId) {
  if (!localStorage.getItem("kerodex-user")) {
    window.location.href = "/";
    return;
  }
  const ids = savedListingIds();
  if (ids.includes(listingId)) {
    setSavedListingIds(ids.filter((id) => id !== listingId));
  } else {
    setSavedListingIds([...ids, listingId]);
  }
}

const filterLabels = {
  maxPrice: "Price",
  bodyType: "Vehicle type",
  make: "Make",
  year: "Years",
  maxMileage: "Mileage",
  fuelType: "Fuel type",
  drivetrain: "Drivetrain",
  cleanTitle: "Clean title",
  noAccidents: "No accidents"
};

const commonMakesModels = {
  Acura: ["ILX", "Integra", "MDX", "RDX", "TLX"],
  Audi: ["A3", "A4", "A5", "Q5", "Q7"],
  BMW: ["3 Series", "5 Series", "M3", "X3", "X5"],
  Chevrolet: ["Camaro", "Corvette", "Equinox", "Silverado", "Tahoe"],
  Ford: ["Bronco", "Escape", "Explorer", "F-150", "Mustang"],
  Honda: ["Accord", "Civic", "CR-V", "Odyssey", "Pilot"],
  Hyundai: ["Elantra", "Ioniq 5", "Palisade", "Santa Fe", "Sonata", "Tucson"],
  Jeep: ["Cherokee", "Grand Cherokee", "Wrangler"],
  Kia: ["K5", "Sorento", "Sportage", "Telluride"],
  Lexus: ["ES", "GX 460", "IS", "NX", "RX"],
  Mazda: ["CX-5", "CX-9", "Mazda3", "Mazda6", "MX-5 Miata"],
  Mercedes: ["C-Class", "E-Class", "GLC", "GLE", "S-Class"],
  Nissan: ["Altima", "Frontier", "Maxima", "Rogue", "Sentra"],
  Porsche: ["911", "Cayenne", "Macan", "Panamera"],
  Subaru: ["Crosstrek", "Forester", "Impreza", "Outback", "WRX"],
  Tesla: ["Model 3", "Model S", "Model X", "Model Y"],
  Toyota: ["4Runner", "Camry", "Corolla", "Highlander", "Prius", "RAV4", "Tacoma", "Tundra"]
};

const rangeFilters = {
  maxPrice: { title: "Price range", minKey: "minPrice", maxKey: "maxPrice", min: 0, max: 120000, step: 1000, prefix: "$", fallbackMin: 0, fallbackMax: 75000 },
  year: { title: "Year range", minKey: "minYear", maxKey: "maxYear", min: 2015, max: 2026, step: 1, prefix: "", fallbackMin: 2018, fallbackMax: 2026 },
  maxMileage: { title: "Mileage range", minKey: "minMileage", maxKey: "maxMileage", min: 0, max: 120000, step: 2500, prefix: "", suffix: " mi", fallbackMin: 0, fallbackMax: 60000 }
};

const filterOptions = {
  maxPrice: [
    ["", "Any price"],
    ["30000", "Under $30k"],
    ["40000", "Under $40k"],
    ["55000", "Under $55k"],
    ["75000", "Under $75k"]
  ],
  bodyType: [
    ["", "Any type"],
    ["SUV", "SUV"],
    ["Sedan", "Sedan"],
    ["Truck", "Truck"],
    ["Coupe", "Coupe"]
  ],
  make: [
    ["", "Any make"],
    ...Object.keys(commonMakesModels).sort().map((make) => [make, make])
  ],
  year: [
    ["", "Any year"],
    ["2024", "2024+"],
    ["2022", "2022+"],
    ["2020", "2020+"],
    ["2018", "2018+"]
  ],
  maxMileage: [
    ["", "Any mileage"],
    ["25000", "Under 25k"],
    ["40000", "Under 40k"],
    ["60000", "Under 60k"],
    ["90000", "Under 90k"]
  ],
  fuelType: [
    ["", "Any fuel"],
    ["Electric", "Electric"],
    ["Plug-in hybrid", "Plug-in hybrid"],
    ["Hybrid", "Hybrid"],
    ["Gasoline", "Gasoline"]
  ],
  drivetrain: [
    ["", "Any drivetrain"],
    ["AWD", "AWD"],
    ["4WD", "4WD"],
    ["RWD", "RWD"],
    ["FWD", "FWD"]
  ],
  cleanTitle: [
    ["", "Any title"],
    ["1", "Clean title only"]
  ],
  noAccidents: [
    ["", "Any history"],
    ["1", "No accidents"]
  ]
};

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

function currentParams() {
  return new URLSearchParams(window.location.search);
}

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
      if (listingsCache.length) {
        listingsCache = sortByLocation(listingsCache);
        renderResultRows(listingsCache, browseListingsCache);
        if (document.body.classList.contains("map-mode")) renderMapView();
      }
    },
    () => {},
    { enableHighAccuracy: false, maximumAge: 300000, timeout: 4000 }
  );
}

function hydrateForm() {
  const params = currentParams();
  for (const [key, value] of params.entries()) {
    const field = form.elements[key];
    if (field) field.value = value;
  }
}

function cleanParams(params) {
  [...params.entries()].forEach(([key, value]) => {
    if (!value || key === "v") params.delete(key);
  });
  return params;
}

function syncCustomSelectLabels() {
  document.querySelectorAll(".choice-select-trigger").forEach((trigger) => {
    const select = trigger.closest("label")?.querySelector("select");
    const option = select?.options[select.selectedIndex] || select?.options[0];
    if (option) trigger.textContent = option.textContent;
  });
}

function updateFilterButtons() {
  const params = currentParams();
  document.querySelectorAll("[data-filter-param]").forEach((button) => {
    const key = button.dataset.filterParam;
    const range = rangeFilters[key];
    if (range) {
      const minValue = params.get(range.minKey);
      const maxValue = params.get(range.maxKey);
      button.classList.toggle("is-active", Boolean(minValue || maxValue));
      if (minValue || maxValue) {
        const minLabel = minValue ? formatRangeValue(range, minValue) : "Any";
        const maxLabel = maxValue ? formatRangeValue(range, maxValue) : "Any";
        button.textContent = `${minLabel} - ${maxLabel}`;
      } else {
        button.textContent = filterLabels[key];
      }
      return;
    }
    if (key === "make") {
      const make = params.get("make") || "";
      const model = params.get("model") || "";
      button.classList.toggle("is-active", Boolean(make || model));
      button.textContent = model ? `${make} / ${model}` : make || filterLabels[key];
      return;
    }
    const value = params.get(key) || "";
    const option = filterOptions[key]?.find(([optionValue]) => optionValue === value);
    button.classList.toggle("is-active", Boolean(value));
    button.textContent = value && option ? option[1] : filterLabels[key];
  });
}

function makeModelIndex() {
  const index = new Map();
  Object.entries(commonMakesModels).forEach(([make, models]) => {
    index.set(make, new Set(models));
  });
  [...browseListingsCache, ...listingsCache].forEach((listing) => {
    if (!listing.make) return;
    if (!index.has(listing.make)) index.set(listing.make, new Set());
    if (listing.model) index.get(listing.make).add(listing.model);
  });
  return [...index.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([make, models]) => [make, [...models].sort((a, b) => a.localeCompare(b))]);
}

function formatRangeValue(range, value) {
  const number = Number(value || 0);
  if (range.prefix === "$") return `${range.prefix}${Math.round(number / 1000)}k`;
  if (range.suffix) return `${number.toLocaleString()}${range.suffix}`;
  return String(number);
}

function mapPreviewHtml(listing) {
  const listingDistance = distanceMiles(userLocation, listing);
  const distance = Number.isFinite(listingDistance) ? `${Math.round(listingDistance)} mi away` : listing.location;
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
function showResultsMapPreview(listing) {
  const panel = document.querySelector(".results-map-panel");
  if (!panel || !listing) return;
  if (!resultsMapPreviewCard) {
    resultsMapPreviewCard = document.createElement("article");
    resultsMapPreviewCard.className = "map-preview-card";
    panel.appendChild(resultsMapPreviewCard);
  }
  resultsMapPreviewCard.innerHTML = mapPreviewHtml(listing);
  resultsMapPreviewCard.hidden = false;
}

function closeFilterMenu() {
  if (activeFilterMenu) {
    activeFilterMenu.remove();
    activeFilterMenu = null;
  }
  document.querySelectorAll("[data-filter-param]").forEach((button) => {
    button.setAttribute("aria-expanded", "false");
  });
}

function openFilterMenu(button) {
  const key = button.dataset.filterParam;
  const options = filterOptions[key] || [];
  const params = currentParams();
  const currentValue = params.get(key) || "";

  closeFilterMenu();
  button.setAttribute("aria-expanded", "true");

  const menu = document.createElement("div");
  menu.className = "filter-menu";
  menu.setAttribute("role", "listbox");
  const range = rangeFilters[key];
  if (range) {
    const minValue = Number(params.get(range.minKey) || range.fallbackMin);
    const maxValue = Number(params.get(range.maxKey) || range.fallbackMax);
    menu.classList.add("range-filter-menu");
    menu.innerHTML = `
      <div class="filter-menu-title">${range.title}</div>
      <div class="range-filter-values">
        <label><span>Min</span><input data-range-field="min" type="number" min="${range.min}" max="${range.max}" step="${range.step}" value="${minValue}"></label>
        <label><span>Max</span><input data-range-field="max" type="number" min="${range.min}" max="${range.max}" step="${range.step}" value="${maxValue}"></label>
      </div>
      <div class="range-slider-stack">
        <input data-range-slider="min" type="range" min="${range.min}" max="${range.max}" step="${range.step}" value="${minValue}">
        <input data-range-slider="max" type="range" min="${range.min}" max="${range.max}" step="${range.step}" value="${maxValue}">
      </div>
      <div class="range-filter-actions">
        <button type="button" data-range-clear>Clear</button>
        <button type="button" data-range-apply>Apply</button>
      </div>
    `;
  } else {
    if (key === "make") {
      const selectedMake = params.get("make") || "";
      const selectedModel = params.get("model") || "";
      const index = makeModelIndex();
      const models = index.find(([make]) => make === selectedMake)?.[1] || [];
      menu.classList.add("make-model-filter-menu");
      menu.innerHTML = `
        <div class="filter-menu-title">Make</div>
        <div class="make-model-columns">
          <div>
            <button class="${!selectedMake ? "selected" : ""}" type="button" data-make-option="">Any make</button>
            ${index.map(([make]) => `<button class="${make === selectedMake ? "selected" : ""}" type="button" data-make-option="${make}">${make}</button>`).join("")}
          </div>
          <div>
            <div class="filter-menu-title small">Model</div>
            <button class="${!selectedModel ? "selected" : ""}" type="button" data-model-option="">Any model</button>
            ${models.map((model) => `<button class="${model === selectedModel ? "selected" : ""}" type="button" data-model-option="${model}">${model}</button>`).join("")}
          </div>
        </div>
      `;
    } else {
      const selectedValue = currentValue;
      menu.innerHTML = `
        <div class="filter-menu-title">${filterLabels[key]}</div>
        ${options
          .map(([value, label]) => `
            <button class="${value === selectedValue ? "selected" : ""}" type="button" data-filter-option="${value}" role="option" aria-selected="${value === selectedValue}">
              <span>${label}</span>
            </button>
          `)
          .join("")}
      `;
    }
  }

  document.body.appendChild(menu);
  const buttonRect = button.getBoundingClientRect();
  const menuWidth = range ? 320 : 210;
  menu.style.left = `${Math.min(Math.max(12, buttonRect.left), window.innerWidth - menuWidth - 12)}px`;
  menu.style.top = `${buttonRect.bottom + 8}px`;
  activeFilterMenu = menu;

  if (range) {
    const minInput = menu.querySelector('[data-range-field="min"]');
    const maxInput = menu.querySelector('[data-range-field="max"]');
    const minSlider = menu.querySelector('[data-range-slider="min"]');
    const maxSlider = menu.querySelector('[data-range-slider="max"]');
    const syncRange = (source) => {
      let minValue = Number(minInput.value);
      let maxValue = Number(maxInput.value);
      if (source === "min" && minValue > maxValue) maxValue = minValue;
      if (source === "max" && maxValue < minValue) minValue = maxValue;
      minInput.value = minSlider.value = minValue;
      maxInput.value = maxSlider.value = maxValue;
    };
    [minInput, minSlider].forEach((control) => control.addEventListener("input", () => {
      minInput.value = minSlider.value = control.value;
      syncRange("min");
    }));
    [maxInput, maxSlider].forEach((control) => control.addEventListener("input", () => {
      maxInput.value = maxSlider.value = control.value;
      syncRange("max");
    }));
    menu.querySelector("[data-range-clear]").addEventListener("click", () => {
      const nextParams = currentParams();
      nextParams.delete(range.minKey);
      nextParams.delete(range.maxKey);
      if (key === "year") nextParams.delete("year");
      closeFilterMenu();
      updateUrlAndResults(nextParams);
    });
    menu.querySelector("[data-range-apply]").addEventListener("click", () => {
      const nextParams = currentParams();
      nextParams.set(range.minKey, minInput.value);
      nextParams.set(range.maxKey, maxInput.value);
      if (key === "year") nextParams.delete("year");
      closeFilterMenu();
      updateUrlAndResults(nextParams);
    });
    return;
  }

  menu.addEventListener("click", (event) => {
    const makeOption = event.target.closest("[data-make-option]");
    if (makeOption) {
      const nextParams = currentParams();
      if (makeOption.dataset.makeOption) nextParams.set("make", makeOption.dataset.makeOption);
      else nextParams.delete("make");
      nextParams.delete("model");
      closeFilterMenu();
      updateUrlAndResults(nextParams);
      return;
    }

    const modelOption = event.target.closest("[data-model-option]");
    if (modelOption) {
      const nextParams = currentParams();
      if (modelOption.dataset.modelOption) nextParams.set("model", modelOption.dataset.modelOption);
      else nextParams.delete("model");
      closeFilterMenu();
      updateUrlAndResults(nextParams);
      return;
    }

    const option = event.target.closest("[data-filter-option]");
    if (!option) return;
    const nextValue = option.dataset.filterOption;
    const nextParams = currentParams();
    if (nextValue) {
      nextParams.set(key, nextValue);
    } else {
      nextParams.delete(key);
    }
    closeFilterMenu();
    updateUrlAndResults(nextParams);
  });
}

function updateUrlAndResults(params) {
  cleanParams(params);
  const query = params.toString();
  window.history.pushState({}, "", query ? `/search.html?${query}` : "/search.html");
  hydrateForm();
  syncCustomSelectLabels();
  updateFilterButtons();
  loadResults();
}

function resultCard(listing) {
  const savings = Math.abs(Math.min(listing.fairValueDelta || 0, 0));
  const saved = isSaved(listing.id);
  return `
    <article class="result-card explore-card" data-listing-id="${listing.id}" tabindex="0">
      <div class="result-media">
        <img src="${listing.images[0]}" alt="${listing.title}" loading="lazy">
        <span class="vehicle-ribbon">${listing.fuelType === "Electric" || listing.fuelType === "Plug-in hybrid" ? "EV available" : "Private seller"}</span>
        <span class="vehicle-as-shown">As listed: ${currency.format(listing.price)} · ${listing.mileage.toLocaleString()} mi</span>
        <button class="result-save${saved ? " is-saved" : ""}" type="button" aria-label="${saved ? "Unsave" : "Save"} ${listing.title}" data-save-listing="${listing.id}">${saved ? "Saved" : "Save"}</button>
      </div>
      <div class="result-card-body">
        <p class="result-year">${listing.year}</p>
        <h2>${listing.title}</h2>
        <p class="result-meta">${listing.year} · ${listing.mileage.toLocaleString()} mi · ${listing.dealScore} deal score</p>
        <p class="result-detail">${listing.location} · ${listing.seller.name}</p>
        <div class="result-trust">
          <span>Owner verified</span>
          <span>VIN ready</span>
          <span>${listing.seller.responseTime}</span>
        </div>
        <div class="badges">
          ${listing.badges.slice(0, 3).map((badge) => `<span>${badge}</span>`).join("")}
        </div>
        <div class="result-specs">
          <div><strong>${currency.format(listing.price)}</strong><span>Asking price</span></div>
          <div><strong>${listing.mileage.toLocaleString()}</strong><span>Mileage</span></div>
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

function uniqueListings(listings) {
  const seen = new Set();
  return listings.filter((listing) => {
    if (!listing?.id || seen.has(listing.id)) return false;
    seen.add(listing.id);
    return true;
  });
}

function relatedListings(matches, allListings, count = 18) {
  const matchIds = new Set(matches.map((listing) => listing.id));
  const matchMakes = new Set(matches.map((listing) => listing.make).filter(Boolean));
  const matchTypes = new Set(matches.map((listing) => listing.bodyType).filter(Boolean));
  const preferred = allListings.filter((listing) => {
    if (matchIds.has(listing.id)) return false;
    return matchMakes.has(listing.make) || matchTypes.has(listing.bodyType);
  });
  const preferredIds = new Set(preferred.map((listing) => listing.id));
  const general = allListings.filter((listing) => !matchIds.has(listing.id) && !preferredIds.has(listing.id));
  return uniqueListings([...preferred, ...general]).slice(0, count);
}

function renderResultRow(titleText, helperText, listings) {
  if (!listings.length) return "";
  return `
    <section class="results-carousel-row">
      <div class="results-row-heading">
        <div>
          <h2>${titleText}</h2>
          <p>${helperText}</p>
        </div>
      </div>
      <div class="results-carousel-track">
        ${listings.map(resultCard).join("")}
      </div>
    </section>
  `;
}

function renderResultRows(matches, allListings) {
  if (!matches.length) {
    grid.innerHTML = `<div class="results-empty">No listings matched this search yet.</div>`;
    return;
  }

  const related = relatedListings(matches, allListings);
  const firstRow = matches.length >= 3 ? matches : uniqueListings([...matches, ...related]).slice(0, Math.max(3, matches.length));
  const firstRowIds = new Set(firstRow.map((listing) => listing.id));
  const comparisonRow = related.filter((listing) => !firstRowIds.has(listing.id)).slice(0, 12);
  const lowMileageRow = uniqueListings([...allListings].sort((a, b) => a.mileage - b.mileage)).slice(0, 12);

  grid.innerHTML = [
    renderResultRow("Best matches", "Private-party listings that fit your search.", firstRow),
    renderResultRow("Worth comparing", "Similar cars nearby so you are not boxed into one result.", comparisonRow),
    renderResultRow("Lower-mileage options", "Cleaner odometers from verified private sellers.", lowMileageRow)
  ].join("");
}

function markerHtml(listing) {
  return `<button class="leaflet-price-pin" type="button">${Math.round(listing.price / 1000)}k</button>`;
}

function currentResultsMapTheme() {
  return document.body.classList.contains("dark") ? "dark" : "light";
}

function setResultsMapTileTheme() {
  if (!resultsMap || !window.L) return;
  const themeName = currentResultsMapTheme();
  if (resultsTileLayer && resultsTileThemeName === themeName) return;
  const tileUrl = themeName === "dark"
    ? "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
    : "https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png";
  const nextTileLayer = L.tileLayer(tileUrl, {
    attribution: "&copy; OpenStreetMap contributors &copy; CARTO",
    maxZoom: 20,
    minZoom: 3,
    noWrap: true,
    bounds: L.latLngBounds(MAP_BOUNDS),
    subdomains: "abcd"
  }).addTo(resultsMap);

  window.setTimeout(() => {
    if (resultsTileLayer && resultsTileLayer !== nextTileLayer) resultsTileLayer.remove();
    resultsTileLayer = nextTileLayer;
    resultsTileThemeName = themeName;
    resultsMap.invalidateSize(true);
  }, 160);
}

function ensureResultsMap() {
  if (!window.L || resultsMap) return Boolean(resultsMap);
  resultsMap = L.map("resultsMap", {
    center: [39.5, -98.35],
    zoom: 4,
    minZoom: 3,
    scrollWheelZoom: true,
    worldCopyJump: false,
    maxBounds: MAP_BOUNDS,
    maxBoundsViscosity: 1,
    zoomControl: false
  });
  resultsMap.setMaxBounds(MAP_BOUNDS);
  L.control.zoom({ position: "bottomright" }).addTo(resultsMap);
  setResultsMapTileTheme();
  resultsMarkerLayer = L.layerGroup().addTo(resultsMap);
  return true;
}

function renderMapView() {
  if (!ensureResultsMap()) return;
  resultsMap.invalidateSize(true);
  resultsMarkerLayer.clearLayers();
  const bounds = [];
  if (userLocation) bounds.push([userLocation.lat, userLocation.lng]);
  listingsCache.forEach((listing) => {
    const marker = L.marker([listing.lat, listing.lng], {
      icon: L.divIcon({ className: "", html: markerHtml(listing), iconAnchor: [24, 18] })
    })
      .on("click", () => showResultsMapPreview(listing))
      .addTo(resultsMarkerLayer);
    setTimeout(() => {
      marker.getElement()?.querySelector(".leaflet-price-pin")?.addEventListener("click", () => showResultsMapPreview(listing));
    }, 0);
    bounds.push([listing.lat, listing.lng]);
  });
  if (bounds.length) {
    [80, 260].forEach((delay) => {
      setTimeout(() => {
        resultsMap.invalidateSize(true);
        resultsMap.fitBounds(bounds, { padding: [60, 60], maxZoom: 7 });
      }, delay);
    });
  }
}

function renderMapViewWhenReady() {
  window.requestAnimationFrame(() => {
    syncMapViewportOffset();
    renderMapView();
    window.requestAnimationFrame(() => {
      resultsMap?.invalidateSize(true);
      renderMapView();
    });
  });
}

function syncMapViewportOffset() {
  const top = Math.ceil(filterbar?.getBoundingClientRect().bottom || 0);
  document.documentElement.style.setProperty("--results-map-top", `${top}px`);
}

function setResultsView(view) {
  const isMap = view === "map";
  document.body.classList.toggle("map-mode", isMap);
  grid.hidden = isMap;
  mapView.hidden = !isMap;
  syncMapViewportOffset();
  if (isMap) renderMapViewWhenReady();
}

async function loadResults() {
  const params = currentParams();
  const response = await fetch(`/api/listings?${params.toString()}`);
  const data = await response.json();
  const listings = sortByLocation(data.listings || []);
  listingsCache = listings;
  let allListings = listings;
  try {
    const browseResponse = await fetch("/api/listings");
    const browseData = await browseResponse.json();
    allListings = uniqueListings([...(browseData.listings || []), ...listings]);
  } catch {
    allListings = listings;
  }
  browseListingsCache = allListings;
  const query = params.get("q") || params.get("make") || "cars";

  title.textContent = `${listings.length || "No"} cars available`;
  subtitle.textContent = listings.length
    ? `Results matching "${query}" from private sellers.`
    : `No exact matches for "${query}" yet. Try a broader search.`;

  renderResultRows(listings, browseListingsCache);
  if (document.body.classList.contains("map-mode")) renderMapView();
}

form.addEventListener("submit", (event) => {
  event.preventDefault();
  const params = new URLSearchParams(new FormData(form));
  cleanParams(params);
  window.location.href = `/search.html?${params.toString()}`;
});

themeButton?.addEventListener("click", () => {
  document.body.classList.toggle("dark");
  localStorage.setItem("kerodex-theme", document.body.classList.contains("dark") ? "dark" : "light");
  setResultsMapTileTheme();
});

logoutButton?.addEventListener("click", () => {
  localStorage.removeItem("kerodex-token");
  localStorage.removeItem("kerodex-user");
  profileMenu.hidden = true;
  profileToggle?.setAttribute("aria-expanded", "false");
});

document.querySelectorAll(".seller-link, .results-menu button:not(#resultsTheme):not(#resultsLogoutButton)").forEach((button) => {
  button.addEventListener("click", () => {
    window.location.href = localStorage.getItem("kerodex-user") ? "/profile.html#seller" : "/profile.html";
  });
});

profileToggle?.addEventListener("click", () => {
  const isOpen = !profileMenu.hidden;
  profileMenu.hidden = isOpen;
  profileToggle.setAttribute("aria-expanded", String(!isOpen));
});

document.addEventListener("click", (event) => {
  if (event.target.closest(".map-preview-close")) {
    if (resultsMapPreviewCard) resultsMapPreviewCard.hidden = true;
    return;
  }

  if (event.target.closest(".filter-menu") || event.target.closest("[data-filter-param]")) return;
  closeFilterMenu();
  if (!profileMenu || !profileToggle) return;
  if (event.target.closest(".profile-shell")) return;
  profileMenu.hidden = true;
  profileToggle.setAttribute("aria-expanded", "false");
});

filterToggle?.addEventListener("click", () => {
  const isOpen = !filterbar.classList.contains("filters-open");
  filterbar.classList.toggle("filters-open", isOpen);
  filterToggle.setAttribute("aria-expanded", String(isOpen));
  if (!isOpen) closeFilterMenu();
});

document.querySelectorAll("[data-results-view]").forEach((button) => {
  button.addEventListener("click", () => {
    document.querySelectorAll("[data-results-view]").forEach((item) => {
      item.classList.toggle("active", item === button);
    });
    setResultsView(button.dataset.resultsView === "map" ? "map" : "grid");
  });
});

document.querySelectorAll("[data-filter-param]").forEach((button) => {
  button.setAttribute("aria-haspopup", "listbox");
  button.setAttribute("aria-expanded", "false");
  button.addEventListener("click", () => {
    openFilterMenu(button);
  });
});

document.querySelector("[data-filter-clear]")?.addEventListener("click", () => {
  const params = currentParams();
  ["minPrice", "maxPrice", "bodyType", "make", "model", "year", "minYear", "maxYear", "minMileage", "maxMileage", "fuelType", "drivetrain", "cleanTitle", "noAccidents"].forEach((key) => params.delete(key));
  updateUrlAndResults(params);
});

grid.addEventListener("click", (event) => {
  const saveButton = event.target.closest(".result-save");
  if (saveButton) {
    toggleSavedListing(saveButton.dataset.saveListing);
    renderResultRows(listingsCache, browseListingsCache);
    return;
  }
  const card = event.target.closest(".result-card[data-listing-id]");
  if (card) window.location.href = `/listing.html?id=${encodeURIComponent(card.dataset.listingId)}`;
});

if (localStorage.getItem("kerodex-theme") === "dark") {
  document.body.classList.add("dark");
}

if (logoutButton) {
  logoutButton.hidden = !localStorage.getItem("kerodex-user");
}

hydrateForm();
enhanceSelects();
updateFilterButtons();
loadResults();
window.addEventListener("resize", syncMapViewportOffset);
window.addEventListener("scroll", syncMapViewportOffset, { passive: true });
requestUserLocation();

