const DEMO_VEHICLE_IMAGES = Object.freeze({
  sedan: "/assets/sedan1.webp",
  suv: "/assets/suv1.webp",
  truck: "/assets/truck1.webp",
  hatchback: "/assets/hatchback1.webp",
  coupe: "/assets/coupe1.webp",
  minivan: "/assets/minivan1.webp",
  ev: "/assets/ev1.webp"
});

const DEMO_VEHICLE_ALT_TEXT = Object.freeze({
  sedan: "Demo sedan vehicle",
  suv: "Demo SUV vehicle",
  truck: "Demo truck vehicle",
  hatchback: "Demo hatchback vehicle",
  coupe: "Demo coupe vehicle",
  minivan: "Demo minivan vehicle",
  ev: "Demo electric vehicle"
});

function normalize(value) {
  return String(value || "").trim().toLowerCase();
}

function demoVehicleCategory(vehicle = {}) {
  const fuelType = normalize(vehicle.fuelType || vehicle.fuel_type);
  const bodyType = normalize(vehicle.bodyType || vehicle.body_type);

  if (fuelType === "electric" || fuelType === "ev" || fuelType.includes("battery electric")) return "ev";
  if (bodyType.includes("suv") || bodyType.includes("crossover")) return "suv";
  if (bodyType.includes("truck") || bodyType.includes("pickup")) return "truck";
  if (bodyType.includes("hatchback") || bodyType.includes("wagon")) return "hatchback";
  if (bodyType.includes("coupe")) return "coupe";
  if (bodyType.includes("minivan") || bodyType === "van" || bodyType.includes("passenger van")) return "minivan";
  if (bodyType.includes("sedan")) return "sedan";
  return null;
}

function demoVehicleImageFor(vehicle = {}, options = {}) {
  const category = demoVehicleCategory(vehicle);
  const resolvedCategory = category || "sedan";
  if (!category && options.logUnknown !== false && process.env.NODE_ENV !== "production") {
    const recordId = vehicle.id || vehicle.demoSeedId || vehicle.title || "unknown demo listing";
    console.warn(`[demo-vehicle-images] Unknown body type for ${recordId}; defaulting to sedan1.`);
  }
  return {
    category: resolvedCategory,
    image: DEMO_VEHICLE_IMAGES[resolvedCategory],
    alt: DEMO_VEHICLE_ALT_TEXT[resolvedCategory],
    usedFallback: !category
  };
}

module.exports = {
  DEMO_VEHICLE_IMAGES,
  DEMO_VEHICLE_ALT_TEXT,
  demoVehicleCategory,
  demoVehicleImageFor
};
