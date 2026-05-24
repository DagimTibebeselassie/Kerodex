const form = document.querySelector("#resultsSearch");
const grid = document.querySelector("#resultsGrid");
const mapView = document.querySelector("#resultsMapView");
const mapList = document.querySelector("#resultsMapList");
const title = document.querySelector("#resultsTitle");
const subtitle = document.querySelector("#resultsSubtitle");
const themeButton = document.querySelector("#resultsTheme");
const profileToggle = document.querySelector("#resultsProfileToggle");
const profileMenu = document.querySelector("#resultsProfileMenu");
const filterbar = document.querySelector("#resultsFilterbar");
const filterToggle = document.querySelector("#filterToggle");
let listingsCache = [];
let browseListingsCache = [];
let resultsMap;
let resultsMarkerLayer;
let activeFilterMenu;
let resultsMapPreviewCard;

const filterLabels = {
  maxPrice: "Price",
  bodyType: "Vehicle type",
  make: "Make & model",
  year: "Years",
  maxMileage: "Mileage",
  fuelType: "Fuel type",
  drivetrain: "Drivetrain",
  cleanTitle: "Clean title",
  noAccidents: "No accidents"
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
    ["Toyota|", "Toyota"],
    ["Toyota|Camry", "Toyota Camry"],
    ["Toyota|Tacoma", "Toyota Tacoma"],
    ["Toyota|4Runner", "Toyota 4Runner"],
    ["Porsche|", "Porsche"],
    ["Porsche|911", "Porsche 911"],
    ["Tesla|", "Tesla"],
    ["Tesla|Model 3", "Tesla Model 3"],
    ["Tesla|Model Y", "Tesla Model Y"],
    ["BMW|", "BMW"],
    ["Ford|F-150", "Ford F-150"],
    ["Honda|Civic", "Honda Civic"],
    ["Lexus|GX 460", "Lexus GX 460"]
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
      button.textContent = model ? `${make} ${model}` : make || filterLabels[key];
      return;
    }
    const value = params.get(key) || "";
    const option = filterOptions[key]?.find(([optionValue]) => optionValue === value);
    button.classList.toggle("is-active", Boolean(value));
    button.textContent = value && option ? option[1] : filterLabels[key];
  });
}

function formatRangeValue(range, value) {
  const number = Number(value || 0);
  if (range.prefix === "$") return `${range.prefix}${Math.round(number / 1000)}k`;
  if (range.suffix) return `${number.toLocaleString()}${range.suffix}`;
  return String(number);
}

function mapPreviewHtml(listing) {
  return `
    <button class="map-preview-close" type="button" aria-label="Close preview">×</button>
    <img src="${listing.images[0]}" alt="${listing.title}">
    <div>
      <strong>${listing.title}</strong>
      <span>${currency.format(listing.price)} · ${listing.mileage.toLocaleString()} mi · ${listing.location}</span>
      <small>${listing.seller.name} · ${listing.seller.responseTime}</small>
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
    const selectedValue = key === "make" ? `${params.get("make") || ""}|${params.get("model") || ""}` : currentValue;
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
    const option = event.target.closest("[data-filter-option]");
    if (!option) return;
    const nextValue = option.dataset.filterOption;
    const nextParams = currentParams();
    if (key === "make") {
      const [make, model] = nextValue.split("|");
      if (make) nextParams.set("make", make);
      else nextParams.delete("make");
      if (model) nextParams.set("model", model);
      else nextParams.delete("model");
    } else if (nextValue) {
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
  return `
    <article class="result-card explore-card" data-listing-id="${listing.id}" tabindex="0">
      <div class="result-media">
        <img src="${listing.images[0]}" alt="${listing.title}" loading="lazy">
        <span class="vehicle-ribbon">${listing.fuelType === "Electric" || listing.fuelType === "Plug-in hybrid" ? "EV available" : "Private seller"}</span>
        <span class="vehicle-as-shown">As listed: ${currency.format(listing.price)} · ${listing.mileage.toLocaleString()} mi</span>
        <button class="result-save" type="button" aria-label="Save ${listing.title}">♡</button>
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
      .on("click", () => showResultsMapPreview(listing))
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
  renderMapView();
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
    const isMap = button.dataset.resultsView === "map";
    grid.hidden = isMap;
    mapView.hidden = !isMap;
    if (isMap) renderMapView();
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
  if (event.target.closest(".result-save")) return;
  const card = event.target.closest(".result-card[data-listing-id]");
  if (card) window.location.href = `/listing.html?id=${encodeURIComponent(card.dataset.listingId)}`;
});

if (localStorage.getItem("kerodex-theme") === "dark") {
  document.body.classList.add("dark");
}

hydrateForm();
enhanceSelects();
updateFilterButtons();
loadResults();
