const fs = require("fs");
const path = require("path");

const DEMO_SEED_VERSION = "kerodex-us-demo-v3";
const PHOTO_MANIFEST_PATH = path.resolve(__dirname, "../apps/web-react/public/demo-assets/vehicles/ATTRIBUTION.json");

const LOCATIONS = [
  ["Atlanta", "GA", "30303", 33.7490, -84.3880],
  ["Miami", "FL", "33130", 25.7617, -80.1918],
  ["Orlando", "FL", "32801", 28.5383, -81.3792],
  ["Charlotte", "NC", "28202", 35.2271, -80.8431],
  ["Nashville", "TN", "37219", 36.1627, -86.7816],
  ["Dallas", "TX", "75201", 32.7767, -96.7970],
  ["Houston", "TX", "77002", 29.7604, -95.3698],
  ["Austin", "TX", "78701", 30.2672, -97.7431],
  ["Phoenix", "AZ", "85004", 33.4484, -112.0740],
  ["Denver", "CO", "80202", 39.7392, -104.9903],
  ["Los Angeles", "CA", "90012", 34.0522, -118.2437],
  ["San Diego", "CA", "92101", 32.7157, -117.1611],
  ["San Francisco", "CA", "94103", 37.7749, -122.4194],
  ["Seattle", "WA", "98101", 47.6062, -122.3321],
  ["Portland", "OR", "97205", 45.5152, -122.6784],
  ["Chicago", "IL", "60601", 41.8781, -87.6298],
  ["Detroit", "MI", "48226", 42.3314, -83.0458],
  ["New York", "NY", "10007", 40.7128, -74.0060],
  ["Boston", "MA", "02108", 42.3601, -71.0589],
  ["Philadelphia", "PA", "19107", 39.9526, -75.1652],
  ["Washington", "DC", "20001", 38.9072, -77.0369],
  ["Newark", "NJ", "07102", 40.7357, -74.1724],
  ["Las Vegas", "NV", "89101", 36.1699, -115.1398]
];

const SELLER_NAMES = [
  "Jordan Mitchell", "Avery Brooks", "Marcus Reed", "Nina Patel", "Cameron Hill",
  "Taylor Morgan", "Elena Davis", "Andre Lewis", "Maya Thompson", "Chris Bennett",
  "Priya Shah", "Noah Williams", "Tasha Green", "Daniel Ross", "Brianna Cole"
];

const COLORS = [
  ["Crystal Black", "Black"], ["Pearl White", "Gray"], ["Silver Metallic", "Black"],
  ["Deep Blue", "Beige"], ["Graphite Gray", "Black"], ["Ruby Red", "Black"],
  ["Forest Green", "Tan"], ["Midnight Blue", "Gray"]
];

const PROFILES = [
  ["Toyota", "Corolla", "Sedan", "Gasoline", "Automatic", "FWD", ["LE", "SE", "XLE"], 15000, [2015, 2018, 2020, 2022]],
  ["Toyota", "Camry", "Sedan", "Gasoline", "Automatic", "FWD", ["LE", "SE", "XSE"], 19500, [2016, 2018, 2020, 2022]],
  ["Toyota", "RAV4", "SUV", "Gasoline", "Automatic", "AWD", ["LE", "XLE", "Adventure"], 24000, [2016, 2019, 2021, 2023]],
  ["Toyota", "Prius", "Hatchback", "Hybrid", "CVT", "FWD", ["Two", "LE", "XLE"], 20500, [2016, 2018, 2020, 2022]],
  ["Honda", "Civic", "Sedan", "Gasoline", "CVT", "FWD", ["LX", "Sport", "EX"], 18000, [2016, 2019, 2021, 2023]],
  ["Honda", "Accord", "Sedan", "Gasoline", "CVT", "FWD", ["LX", "Sport", "EX-L"], 20500, [2016, 2018, 2020, 2022]],
  ["Honda", "CR-V", "SUV", "Gasoline", "CVT", "AWD", ["LX", "EX", "EX-L"], 23000, [2016, 2019, 2021]],
  ["Mazda", "Mazda3", "Sedan", "Gasoline", "Automatic", "FWD", ["Sport", "Select", "Preferred"], 16500, [2017, 2019, 2021]],
  ["Mazda", "CX-5", "SUV", "Gasoline", "Automatic", "AWD", ["Sport", "Touring", "Grand Touring"], 21000, [2017, 2019, 2021]],
  ["Hyundai", "Elantra", "Sedan", "Gasoline", "Automatic", "FWD", ["SE", "SEL", "Limited"], 14500, [2017, 2020, 2022]],
  ["Hyundai", "Sonata", "Sedan", "Gasoline", "Automatic", "FWD", ["SE", "SEL", "Limited"], 17000, [2016, 2019, 2021]],
  ["Kia", "Forte", "Sedan", "Gasoline", "Automatic", "FWD", ["LX", "LXS", "GT-Line"], 14000, [2017, 2020, 2022]],
  ["Kia", "Optima", "Sedan", "Gasoline", "Automatic", "FWD", ["LX", "S", "EX"], 14500, [2016, 2018, 2020]],
  ["Kia", "K5", "Sedan", "Gasoline", "Automatic", "FWD", ["LXS", "GT-Line", "EX"], 22500, [2021, 2022, 2023]],
  ["Nissan", "Altima", "Sedan", "Gasoline", "CVT", "FWD", ["S", "SV", "SR"], 16500, [2017, 2020, 2022]],
  ["Nissan", "Rogue", "SUV", "Gasoline", "CVT", "AWD", ["S", "SV", "SL"], 18500, [2017, 2020, 2022]],
  ["Ford", "F-150", "Truck", "Gasoline", "Automatic", "4WD", ["XL", "XLT", "Lariat"], 28500, [2016, 2019, 2021]],
  ["Toyota", "Tacoma", "Truck", "Gasoline", "Automatic", "4WD", ["SR5", "TRD Sport", "TRD Off-Road"], 31500, [2016, 2019, 2021]],
  ["Chevrolet", "Malibu", "Sedan", "Gasoline", "Automatic", "FWD", ["LS", "LT", "Premier"], 14500, [2017, 2019, 2021]],
  ["Lexus", "ES", "Sedan", "Gasoline", "Automatic", "FWD", ["350", "350 Luxury", "300h"], 30500, [2016, 2019, 2021]],
  ["Acura", "TLX", "Sedan", "Gasoline", "Automatic", "AWD", ["Base", "Technology", "A-Spec"], 27000, [2017, 2020, 2022]],
  ["Subaru", "Outback", "SUV", "Gasoline", "CVT", "AWD", ["Premium", "Limited", "Onyx Edition"], 22500, [2017, 2020, 2022]],
  ["Tesla", "Model 3", "Sedan", "Electric", "Single-speed", "RWD", ["Standard Range Plus", "Long Range", "Performance"], 25500, [2019, 2021, 2023]]
];

const LEGACY_DEMO_LISTING_IDS = Array.from({ length: 14 }, (_, index) => `lst_${201 + index}`);
const LEGACY_DEMO_SELLER_IDS = [
  "seller_maya_rivera", "seller_andre_turner", "seller_lena_kim", "seller_omar_williams",
  "seller_priya_shah", "seller_chris_bennett", "seller_tasha_green", "seller_marcus_hill",
  "seller_elena_brooks", "seller_noah_reed", "seller_brianna_cole", "seller_daniel_ross"
];

function initials(name) {
  return name.split(/\s+/).map((part) => part[0]).join("").slice(0, 2).toUpperCase();
}

function makeDemoVin(index, make, model) {
  const letters = `${make}${model}`.toUpperCase().replace(/[^A-HJ-NPR-Z0-9]/g, "");
  return `KDX${letters.slice(0, 3).padEnd(3, "X")}${String(10000000000 + index).slice(-11)}`;
}

function exactPhotoFor(listingId) {
  if (!fs.existsSync(PHOTO_MANIFEST_PATH)) {
    throw new Error("Demo photo attribution manifest is missing. Run npm run refresh:demo-listing-images.");
  }
  const manifest = JSON.parse(fs.readFileSync(PHOTO_MANIFEST_PATH, "utf8"));
  const photo = manifest.listings?.[listingId]?.localPath;
  if (!photo) throw new Error(`Exact demo vehicle photo is missing for ${listingId}.`);
  return [photo];
}

function priceFor(base2020, year, mileage, profileIndex, variantIndex) {
  const premiumStep = base2020 >= 27000 ? 3000 : base2020 >= 22000 ? 2400 : 1900;
  const yearAdjusted = base2020 + (year - 2020) * premiumStep;
  const expectedMileage = Math.max(18000, (2026 - year) * 10500);
  const mileageAdjustment = Math.round((expectedMileage - mileage) * 0.055);
  const marketFactor = [0.93, 0.99, 1.05, 1.11][(profileIndex + variantIndex) % 4];
  return Math.max(5200, Math.round((yearAdjusted + mileageAdjustment) * marketFactor / 100) * 100);
}

function descriptionFor({ year, make, model, trim, mileage, condition, accidentHistory, city }) {
  const use = mileage > 100000
    ? "It has been used mainly for commuting and highway trips"
    : "It has been used as a daily driver with a mix of city and highway miles";
  return `${year} ${make} ${model} ${trim} offered as a Kerodex demonstration listing in ${city}. ${use}. The demo record shows ${condition.toLowerCase()} condition, routine maintenance notes, and ${accidentHistory.toLowerCase()}. This listing is for demonstration/testing only and the vehicle is not actually for sale.`;
}

function buildDemoSellers() {
  return SELLER_NAMES.map((name, index) => {
    const [city, state] = LOCATIONS[index];
    return {
      id: `demo_seller_${String(index + 1).padStart(2, "0")}`,
      name,
      initials: initials(name),
      city,
      state,
      memberSince: new Date(Date.UTC(2025, index % 12, 4 + index)).toISOString(),
      bio: "Demo private-party seller profile created for Kerodex marketplace testing.",
      responseTime: ["Replies within a few hours", "Usually replies same day", "Usually replies in 1 day"][index % 3],
      responseRate: 78 + (index % 6) * 3,
      completedSales: index % 3,
      rating: index % 4 === 0 ? null : Number((4.6 + (index % 4) * 0.1).toFixed(1)),
      reviewCount: index % 4 === 0 ? 0 : 1 + (index % 5),
      isDemo: true,
      is_demo: true,
      demoSeedId: `${DEMO_SEED_VERSION}:seller:${index + 1}`,
      verification: {
        email: true,
        phone: index % 5 !== 0,
        identity: index % 3 !== 0,
        selfie: index % 4 !== 0
      }
    };
  });
}

function buildDemoListings() {
  const listings = [];
  let sequence = 1;
  PROFILES.forEach((profile, profileIndex) => {
    const [make, model, bodyType, fuelType, transmission, drivetrain, trims, base2020, years] = profile;
    const count = profileIndex < 6 ? 4 : 3;
    for (let variantIndex = 0; variantIndex < count; variantIndex += 1) {
      const year = years[variantIndex % years.length];
      const trim = trims[variantIndex % trims.length];
      const age = 2026 - year;
      const mileage = Math.max(12000, age * 9800 + ((profileIndex * 3700 + variantIndex * 6100) % 19000));
      const price = priceFor(base2020, year, mileage, profileIndex, variantIndex);
      const [city, state, zip, lat, lng] = LOCATIONS[(sequence - 1) % LOCATIONS.length];
      const [color, interiorColor] = COLORS[(profileIndex + variantIndex * 2) % COLORS.length];
      const condition = ["Good", "Very good", "Excellent", "Good"][(profileIndex + variantIndex) % 4];
      const titleStatus = ["Clean Title", "Clean Title", "Clean Title", "Lienholder / Loan"][(profileIndex + variantIndex) % 4];
      const accidentHistory = ["No accidents reported", "No accidents reported", "Minor accident disclosed", "No accidents reported"][(profileIndex + variantIndex) % 4];
      const ownerCount = age <= 4 ? "One previous owner" : age <= 8 ? "Two previous owners" : "Three or more owners";
      const seller = buildDemoSellers()[(profileIndex + variantIndex) % SELLER_NAMES.length];
      const presenceVerified = (profileIndex + variantIndex) % 3 === 0;
      const createdAt = new Date(Date.UTC(2026, 5, 1 + (sequence % 18), 13 + (sequence % 7), sequence % 60)).toISOString();
      const listingId = `demo_ga_${String(sequence).padStart(3, "0")}`;
      listings.push({
        id: listingId,
        demoSeedId: `${DEMO_SEED_VERSION}:listing:${sequence}`,
        externalDemoId: `us-${make}-${model}-${year}-${variantIndex}`.toLowerCase().replace(/[^a-z0-9-]/g, "-"),
        isDemo: true,
        is_demo: true,
        demoNotice: "This listing is for demonstration/testing only.",
        userId: seller.id,
        sellerType: "demo_private_party",
        title: `${year} ${make} ${model} ${trim}`,
        make,
        model,
        year,
        trim,
        price,
        mileage,
        location: `${city}, ${state}`,
        zip,
        lat,
        lng,
        bodyType,
        fuelType,
        transmission,
        drivetrain,
        color,
        exteriorColor: color,
        interiorColor,
        condition,
        sellerRating: seller.rating,
        dealScore: 68 + ((profileIndex * 7 + variantIndex * 5) % 27),
        fairValueDelta: Math.round(price * ([0.07, 0.01, -0.05, -0.09][(profileIndex + variantIndex) % 4])),
        status: "active",
        vin: makeDemoVin(sequence, make, model),
        verificationStatus: presenceVerified ? "vehicle_presence_verified" : (profileIndex + variantIndex) % 2 === 0 ? "ownership_pending" : "vin_only",
        vehiclePresenceVerified: presenceVerified,
        photoChallengeVerified: presenceVerified,
        titleStatus,
        accidentHistory,
        ownerCount,
        badges: [
          "Demo Listing",
          seller.verification.identity ? "Identity verified (demo)" : "Email verified (demo)",
          presenceVerified ? "Vehicle Presence Verified (demo)" : "VIN submitted (demo)"
        ],
        features: bodyType === "Truck"
          ? ["Backup camera", "Tow package", "Bluetooth", "Cruise control"]
          : fuelType === "Electric"
            ? ["Navigation", "Heated seats", "Backup camera", "Driver assistance"]
            : ["Backup camera", "Bluetooth", "Cruise control", "USB audio"],
        images: exactPhotoFor(listingId),
        imageUploads: [],
        description: descriptionFor({ year, make, model, trim, mileage, condition, accidentHistory, city }),
        maintenanceNames: ["Oil and filter service", "Tire rotation"],
        historyHighlights: [titleStatus, accidentHistory, ownerCount],
        seller: {
          id: seller.id,
          name: seller.name,
          initials: seller.initials,
          responseTime: seller.responseTime,
          responseRate: seller.responseRate,
          completedSales: seller.completedSales,
          verified: seller.verification.identity,
          phoneVerified: seller.verification.phone,
          memberSince: seller.memberSince,
          rating: seller.rating,
          reviewCount: seller.reviewCount,
          isDemo: true
        },
        createdAt,
        updatedAt: createdAt
      });
      sequence += 1;
    }
  });
  if (listings.length !== 75) throw new Error(`Expected 75 demo listings, generated ${listings.length}.`);
  return listings;
}

function isDemoRecord(record = {}) {
  return Boolean(
    record.isDemo ||
    record.is_demo ||
    /^kerodex-(?:ga|us)-demo-/.test(String(record.demoSeedId || "")) ||
    LEGACY_DEMO_LISTING_IDS.includes(record.id) ||
    LEGACY_DEMO_SELLER_IDS.includes(record.id)
  );
}

module.exports = {
  DEMO_SEED_VERSION,
  LOCATIONS,
  LEGACY_DEMO_LISTING_IDS,
  LEGACY_DEMO_SELLER_IDS,
  buildDemoListings,
  buildDemoSellers,
  isDemoRecord
};
