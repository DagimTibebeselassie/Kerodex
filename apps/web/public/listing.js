const currency = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 0
});

const params = new URLSearchParams(window.location.search);
const listingId = params.get("id");
const creditProfiles = {
  excellent: { label: "780+ Excellent", apr: 6.09 },
  "very-good": { label: "720-779 Very good", apr: 7.35 },
  good: { label: "660-719 Good", apr: 9.75 },
  fair: { label: "600-659 Fair", apr: 13.25 },
  rebuilding: { label: "Below 600 Rebuilding", apr: 17.9 }
};
const conditionMultipliers = {
  excellent: 1,
  "very-good": 0.93,
  good: 0.84,
  fair: 0.72
};

let activeListing;
let allListings = [];
let activeImageIndex = 0;
let cashDown = 0;
let tradeCredit = 0;
let selectedTerm = 60;
let selectedCredit = "excellent";
let purchaseMode = "finance";
const purchaseSectionIds = ["payment", "trade", "start"];

function byId(id) {
  return document.getElementById(id);
}

function pseudoVin(listing) {
  return `KRDX${String(listing.year).slice(-2)}${listing.make.slice(0, 3).toUpperCase()}${listing.id.replace(/[^a-z0-9]/gi, "").slice(0, 8).toUpperCase()}`;
}

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

function isSaved(id) {
  return savedListingIds().includes(id);
}

function setText(id, value) {
  const el = byId(id);
  if (el) el.textContent = value;
}

function apr() {
  return creditProfiles[selectedCredit]?.apr || creditProfiles.excellent.apr;
}

function feesFor(price) {
  return Math.round(price * 0.073);
}

function amountFinanced(price) {
  return Math.max(0, price + feesFor(price) - cashDown - tradeCredit);
}

function paymentFor(price, months = selectedTerm) {
  if (purchaseMode === "cash") return 0;
  const principal = amountFinanced(price);
  const monthlyRate = apr() / 100 / 12;
  if (!monthlyRate) return Math.round(principal / months);
  return Math.round((principal * monthlyRate) / (1 - Math.pow(1 + monthlyRate, -months)));
}

function renderGallery(listing) {
  const images = listing.images?.length ? listing.images : [""];
  activeImageIndex = Math.max(0, Math.min(activeImageIndex, images.length - 1));
  const image = byId("listingMainImage");
  image.src = images[activeImageIndex];
  image.alt = listing.title;
  setText("galleryCount", `${activeImageIndex + 1} of ${images.length}`);
  byId("listingThumbs").innerHTML = images
    .map((src, index) => `<button class="${index === activeImageIndex ? "active" : ""}" type="button" data-thumb="${index}"><img src="${src}" alt="${listing.title} thumbnail ${index + 1}"></button>`)
    .join("");
}

function syncSaveButtons() {
  if (!activeListing) return;
  const saved = isSaved(activeListing.id);
  document.querySelectorAll("[data-save-listing]").forEach((button) => {
    button.classList.toggle("is-saved", saved);
    button.textContent = saved ? "♥" : "♡";
    button.setAttribute("aria-label", saved ? "Unsave listing" : "Save listing");
  });
}

function updateFinanceSummary() {
  if (!activeListing) return;
  const price = activeListing.price;
  const financed = amountFinanced(price);
  const selectedPayment = paymentFor(price, selectedTerm);
  const profile = creditProfiles[selectedCredit] || creditProfiles.excellent;
  const modeLabel = {
    finance: "Finance",
    cash: "Cash",
    offer: "Offer",
    unsure: "Estimate"
  }[purchaseMode];

  setText("payment36", currency.format(paymentFor(price, 36)));
  setText("payment48", currency.format(paymentFor(price, 48)));
  setText("payment60", currency.format(paymentFor(price, 60)));
  setText("monthlyPayment", purchaseMode === "cash" ? currency.format(0) : currency.format(selectedPayment));
  setText("summaryApr", purchaseMode === "cash" ? "0.00%" : `${profile.apr.toFixed(2)}%`);
  setText("summaryTerm", purchaseMode === "cash" ? "Cash" : `${selectedTerm} mos.`);
  setText("summaryMode", modeLabel);
  setText("downPayment", purchaseMode === "cash" ? "Cash purchase selected" : `${currency.format(cashDown)} down payment*`);
  setText("summaryPrice", currency.format(price));
  setText("summaryTrade", `-${currency.format(tradeCredit)}`);
  setText("summaryFees", currency.format(feesFor(price)));
  setText("summaryFinanced", currency.format(financed));
  document.querySelectorAll("[data-apr-label]").forEach((label) => {
    label.textContent = `${profile.apr.toFixed(2)}% APR`;
  });
}

function setActivePurchaseSection(sectionId) {
  if (!purchaseSectionIds.includes(sectionId)) return;
  document.querySelectorAll("[data-purchase-nav]").forEach((link) => {
    const targetId = (link.getAttribute("href") || "").replace("#", "");
    link.classList.toggle("active", targetId === sectionId);
    if (targetId === sectionId) link.setAttribute("aria-current", "step");
    else link.removeAttribute("aria-current");
  });
}

function bindPurchaseNavigation() {
  document.querySelectorAll("[data-purchase-nav]").forEach((link) => {
    link.addEventListener("click", (event) => {
      const targetId = (link.getAttribute("href") || "").replace("#", "");
      const target = byId(targetId);
      if (!target) return;
      event.preventDefault();
      setActivePurchaseSection(targetId);
      target.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  });

  if (!("IntersectionObserver" in window)) return;
  const observer = new IntersectionObserver(
    (entries) => {
      const visible = entries
        .filter((entry) => entry.isIntersecting)
        .sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
      if (visible?.target?.id) setActivePurchaseSection(visible.target.id);
    },
    { rootMargin: "-28% 0px -58% 0px", threshold: [0.05, 0.2, 0.45] }
  );
  purchaseSectionIds.forEach((id) => {
    const section = byId(id);
    if (section) observer.observe(section);
  });
}

function renderListing(listing) {
  activeListing = listing;
  cashDown = Math.round(listing.price * 0.1);
  tradeCredit = Number(localStorage.getItem(`kerodex-trade-credit-${listing.id}`) || 0);
  const vin = pseudoVin(listing);
  const features = listing.features?.slice(0, 3).join(", ") || listing.badges?.slice(0, 3).join(", ");

  document.title = `Kerodex | ${listing.title}`;
  setText("listingVin", `VIN ${vin}`);
  setText("listingMsrp", `Asking price ${currency.format(listing.price)}`);
  setText("listingTitle", listing.title);
  setText("purchaseVehicleTitle", listing.title);
  setText("listingPrice", currency.format(listing.price));
  setText("listingAvailability", `${listing.location} private-party listing. Seller usually replies in ${listing.seller.responseTime}.`);
  setText("listingExterior", listing.color || "Seller-provided exterior");
  setText("listingInterior", "Seller-provided interior");
  setText("listingFuel", `${listing.fuelType} | ${listing.mileage.toLocaleString()} miles`);
  setText("listingPowertrain", `${listing.year} ${listing.make} ${listing.model} ${listing.trim || ""}`.trim());
  setText("listingFeatures", features || "VIN, title, and inspection signals ready");
  const slider = byId("cashDownSlider");
  if (slider) {
    slider.max = String(Math.max(1000, Math.round(listing.price * 0.5)));
    slider.value = String(cashDown);
  }
  byId("cashDownInput").value = cashDown;
  updateFinanceSummary();
  renderGallery(listing);
  syncSaveButtons();
}

function similarCard(listing) {
  return `
    <article class="similar-card" data-listing-id="${listing.id}">
      <span>Private seller price ${currency.format(listing.price)}</span>
      <h3>${listing.title}</h3>
      <p>VIN ${pseudoVin(listing)}</p>
      <img src="${listing.images[0]}" alt="${listing.title}" loading="lazy">
      <strong>${currency.format(listing.price)}</strong>
      <small>${listing.location} | ${listing.mileage.toLocaleString()} mi</small>
    </article>
  `;
}

function renderSimilar(current, listings) {
  const sameMake = listings.filter((listing) => listing.id !== current.id && listing.make === current.make);
  const sameType = listings.filter((listing) => listing.id !== current.id && listing.bodyType === current.bodyType && listing.make !== current.make);
  const others = listings.filter((listing) => listing.id !== current.id && !sameMake.includes(listing) && !sameType.includes(listing));
  const related = [...sameMake, ...sameType, ...others].slice(0, 8);
  byId("similarSubtitle").textContent = `Similar ${current.make} and ${current.bodyType || "private-party"} vehicles from verified sellers.`;
  byId("similarTrack").innerHTML = related.map(similarCard).join("");
}

function estimateTradeValue() {
  const year = Number(byId("tradeYear").value || 0);
  const make = byId("tradeMake").value.trim().toLowerCase();
  const model = byId("tradeModel").value.trim().toLowerCase();
  const mileage = Number(byId("tradeMileage").value || 0);
  const condition = byId("tradeCondition").value;

  if (!year || !make || !model || !mileage) {
    return { error: "Add year, make, model, and mileage to estimate a trade-in." };
  }

  const makeMatches = allListings.filter((listing) => listing.make.toLowerCase() === make);
  const modelMatches = makeMatches.filter((listing) => listing.model.toLowerCase().includes(model) || model.includes(listing.model.toLowerCase()));
  const source = modelMatches.length ? modelMatches : makeMatches;
  const basePrice = source.length
    ? source.reduce((sum, listing) => sum + listing.price, 0) / source.length
    : Math.max(6500, (new Date().getFullYear() - year <= 4 ? 28000 : 18000));
  const ageAdjustment = Math.max(0.48, 1 - Math.max(0, new Date().getFullYear() - year) * 0.055);
  const mileageAdjustment = Math.max(0.55, 1 - Math.max(0, mileage - 12000) / 180000);
  const conditionAdjustment = conditionMultipliers[condition] || conditionMultipliers.good;
  const privateSaleEstimate = basePrice * ageAdjustment * mileageAdjustment * conditionAdjustment;
  const tradeEstimate = Math.round((privateSaleEstimate * 0.84) / 100) * 100;

  return {
    value: Math.max(1200, tradeEstimate),
    sourceCount: source.length,
    label: `${year} ${byId("tradeMake").value.trim()} ${byId("tradeModel").value.trim()}`
  };
}

async function loadListing() {
  const allResponse = await fetch("/api/listings");
  const allData = await allResponse.json();
  allListings = allData.listings || [];
  const fallback = allListings[0];
  let listing = fallback;

  if (listingId) {
    const response = await fetch(`/api/listings/${encodeURIComponent(listingId)}`);
    if (response.ok) listing = await response.json();
  }

  renderListing(listing);
  renderSimilar(listing, allListings);
}

byId("galleryPrev")?.addEventListener("click", () => {
  if (!activeListing) return;
  activeImageIndex = (activeImageIndex - 1 + activeListing.images.length) % activeListing.images.length;
  renderGallery(activeListing);
});

byId("galleryNext")?.addEventListener("click", () => {
  if (!activeListing) return;
  activeImageIndex = (activeImageIndex + 1) % activeListing.images.length;
  renderGallery(activeListing);
});

byId("listingThumbs")?.addEventListener("click", (event) => {
  const thumb = event.target.closest("[data-thumb]");
  if (!thumb || !activeListing) return;
  activeImageIndex = Number(thumb.dataset.thumb);
  renderGallery(activeListing);
});

[byId("cashDownSlider"), byId("cashDownInput")].forEach((control) => {
  control?.addEventListener("input", () => {
    cashDown = Number(control.value || 0);
    const slider = byId("cashDownSlider");
    const input = byId("cashDownInput");
    if (slider && slider !== control) slider.value = String(cashDown);
    if (input && input !== control) input.value = cashDown;
    updateFinanceSummary();
  });
});

byId("creditScoreSelect")?.addEventListener("change", (event) => {
  selectedCredit = event.target.value;
  updateFinanceSummary();
});

document.querySelectorAll('input[name="term"]').forEach((radio) => {
  radio.addEventListener("change", () => {
    selectedTerm = Number(radio.value || 60);
    updateFinanceSummary();
  });
});

document.querySelectorAll("[data-purchase-mode]").forEach((button) => {
  button.addEventListener("click", () => {
    purchaseMode = button.dataset.purchaseMode;
    document.querySelectorAll("[data-purchase-mode]").forEach((item) => item.classList.toggle("active", item === button));
    updateFinanceSummary();
  });
});

document.querySelectorAll("[data-save-listing]").forEach((button) => {
  button.addEventListener("click", () => {
    if (!activeListing) return;
    if (!localStorage.getItem("kerodex-user")) {
      window.location.href = "/";
      return;
    }
    const ids = savedListingIds();
    if (ids.includes(activeListing.id)) {
      setSavedListingIds(ids.filter((id) => id !== activeListing.id));
    } else {
      setSavedListingIds([...ids, activeListing.id]);
    }
    syncSaveButtons();
  });
});

byId("tradeForm")?.addEventListener("submit", (event) => {
  event.preventDefault();
  const result = estimateTradeValue();
  const output = byId("tradeResult");
  output.hidden = false;
  if (result.error) {
    output.innerHTML = `<strong>More details needed</strong><span>${result.error}</span>`;
    return;
  }

  tradeCredit = result.value;
  if (activeListing) localStorage.setItem(`kerodex-trade-credit-${activeListing.id}`, String(tradeCredit));
  output.innerHTML = `
    <strong>${currency.format(result.value)} estimated trade-in credit</strong>
    <span>${result.label}. ${result.sourceCount ? `Based on ${result.sourceCount} Kerodex listing signal${result.sourceCount === 1 ? "" : "s"}.` : "Based on local depreciation signals until a valuation provider is connected."}</span>
  `;
  updateFinanceSummary();
  setActivePurchaseSection("trade");
});

document.querySelectorAll("[data-contact-seller]").forEach((button) => {
  button.addEventListener("click", () => {
    const status = byId("purchaseStatus");
    if (status) status.textContent = "Availability request saved. Messaging will open here when seller chat is connected.";
  });
});

document.querySelectorAll("[data-continue-purchase]").forEach((button) => {
  button.addEventListener("click", () => {
    const status = byId("purchaseStatus");
    if (status) status.textContent = "Your offer estimate is ready. Sign-in, identity checks, and offer submission are the next backend steps.";
    setActivePurchaseSection("start");
    byId("start")?.scrollIntoView({ behavior: "smooth", block: "center" });
  });
});

byId("similarTrack")?.addEventListener("click", (event) => {
  const card = event.target.closest("[data-listing-id]");
  if (card) window.location.href = `/listing.html?id=${encodeURIComponent(card.dataset.listingId)}`;
});

byId("listingThemeToggle")?.addEventListener("click", () => {
  document.body.classList.toggle("dark");
  localStorage.setItem("kerodex-theme", document.body.classList.contains("dark") ? "dark" : "light");
});

if (localStorage.getItem("kerodex-theme") === "dark") {
  document.body.classList.add("dark");
}

bindPurchaseNavigation();
loadListing().catch(() => {
  byId("listingTitle").textContent = "Listing unavailable";
});
