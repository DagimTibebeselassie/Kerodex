const currency = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 0
});

const params = new URLSearchParams(window.location.search);
const listingId = params.get("id");
let activeListing;
let activeImageIndex = 0;
let cashDown = 0;

function byId(id) {
  return document.getElementById(id);
}

function pseudoVin(listing) {
  return `KRDX${String(listing.year).slice(-2)}${listing.make.slice(0, 3).toUpperCase()}${listing.id.replace(/[^a-z0-9]/gi, "").slice(0, 8).toUpperCase()}`;
}

function paymentFor(price, months = 60, downOverride = cashDown) {
  const down = Math.max(0, Math.min(price, downOverride || Math.round(price * 0.1)));
  const financed = price - down;
  return Math.round(financed / months + financed * 0.006);
}

function setText(id, value) {
  const el = byId(id);
  if (el) el.textContent = value;
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

function renderListing(listing) {
  activeListing = listing;
  cashDown = Math.round(listing.price * 0.1);
  const financed = listing.price - cashDown;
  const fees = Math.round(listing.price * 0.073);
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
  setText("summaryPrice", currency.format(listing.price));
  setText("summaryFees", currency.format(fees));
  setText("summaryFinanced", currency.format(financed + fees));
  const slider = byId("cashDownSlider");
  if (slider) {
    slider.max = String(Math.max(1000, Math.round(listing.price * 0.5)));
    slider.value = String(cashDown);
  }
  byId("cashDownInput").value = cashDown;
  updateFinanceSummary();
  renderGallery(listing);
}

function updateFinanceSummary() {
  if (!activeListing) return;
  const fees = Math.round(activeListing.price * 0.073);
  const financed = activeListing.price - cashDown;
  setText("payment36", currency.format(paymentFor(activeListing.price, 36, cashDown)));
  setText("payment48", currency.format(paymentFor(activeListing.price, 48, cashDown)));
  setText("payment60", currency.format(paymentFor(activeListing.price, 60, cashDown)));
  setText("monthlyPayment", currency.format(paymentFor(activeListing.price, 60, cashDown)));
  setText("downPayment", `${currency.format(cashDown)} down payment*`);
  setText("summaryFinanced", currency.format(financed + fees));
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

async function loadListing() {
  const allResponse = await fetch("/api/listings");
  const allData = await allResponse.json();
  const allListings = allData.listings || [];
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

byId("similarTrack")?.addEventListener("click", (event) => {
  const card = event.target.closest("[data-listing-id]");
  if (card) window.location.href = `/listing.html?id=${encodeURIComponent(card.dataset.listingId)}`;
});

loadListing().catch(() => {
  byId("listingTitle").textContent = "Listing unavailable";
});
