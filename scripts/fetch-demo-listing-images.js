const fs = require("fs");
const path = require("path");
const { buildDemoListings } = require("./demo-listings-data");

const root = path.resolve(__dirname, "..");
const publicRoot = path.join(root, "apps", "web-react", "public");
const outputDir = path.join(publicRoot, "demo-assets", "vehicles", "models");
const manifestPath = path.join(publicRoot, "demo-assets", "vehicles", "ATTRIBUTION.json");
const userAgent = "KerodexDemoAssetAudit/1.0 (founder@kerodexofficial.com)";
const allowedLicenses = /^(CC0|CC BY(?:-SA)? \d(?:\.\d)?|Public domain)$/i;
const SOURCE_FILE_OVERRIDES = {
  demo_ga_008: "File:2022 Toyota Camry SE Standard Package in Celestial Silver Metallic, Front Left.jpg",
  demo_ga_015: "File:2020 Toyota Prius au SIAM 2020.jpg",
  demo_ga_016: "File:2018 Toyota Prius (facelift).jpg",
  demo_ga_024: "File:2022 Honda Accord Sport in Sonic Grey Pearl, Front Left, 01-30-2022.jpg",
  demo_ga_037: "File:2016 Hyundai Sonata (LF) Active sedan (2018-05-25) 01.jpg",
  demo_ga_048: "File:2021 Kia K5 GT-Line, front left.jpg",
  demo_ga_053: "File:Nissan Rogue (T32) facelift (United States).jpg",
  demo_ga_060: "File:2019 Toyota Tacoma SR5 4WD Access Cab, front right, 09-03-2022.jpg"
};

function normalized(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/model 3/g, "model3")
    .replace(/f-150/g, "f150")
    .replace(/mazda3/g, "mazda 3")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function scoreCandidate(listing, candidate) {
  const title = normalized(candidate.title.replace(/^File:/, ""));
  const make = normalized(listing.make);
  const model = normalized(listing.model);
  const modelTokens = model.split(" ").filter(Boolean);
  const exactYearModelPrefix = new RegExp(`^${listing.year}\\s+${make}\\s+${model}\\b|^${make}\\s+${model}\\s+${listing.year}\\b`);
  const modelPrefixWithYear = new RegExp(`^${make}\\s+${model}\\b.*\\b${listing.year}\\b`);
  const years = [...title.matchAll(/\b(19\d{2}|20\d{2})\b/g)].map((match) => Number(match[1]));
  const range = title.match(/\b(19\d{2}|20\d{2})\s+(19\d{2}|20\d{2})\b/);
  const yearMatches = years.length === 0
    || years[0] === listing.year
    || (range && listing.year >= Number(range[1]) && listing.year <= Number(range[2]));
  if (!yearMatches) return -100;
  if (model === "corolla" && /\bcross\b/.test(title)) return -100;
  if (model === "prius" && /\bprius c\b|\bprius v\b|\btaxi\b/.test(title)) return -100;
  if (listing.bodyType === "Sedan" && /\bhatch\b|\bhatchback\b/.test(title)) return -100;
  if (listing.bodyType === "SUV" && /\bsedan\b|\bhatchback\b/.test(title)) return -100;
  let score = 0;
  if (exactYearModelPrefix.test(title)) score += 42;
  else if (modelPrefixWithYear.test(title)) score += 30;
  else if (range) score += 18;
  else if (years.length === 0) score += 10;
  else if (years.includes(listing.year)) score += 2;
  if (title.includes(make)) score += 14;
  if (modelTokens.every((token) => title.includes(token))) score += 22;
  if (/\bfront\b|\bthree quarter\b|\b3 4\b/.test(title)) score += 4;
  if (/\bright\b|\bleft\b/.test(title)) score += 2;
  if (/\brear\b|\binterior\b|\binstrument\b|\bengine\b|\bpolice\b|\btaxi\b|\brace\b|\bcrash\b|\bpdf\b/.test(title)) score -= 18;
  return score;
}

function metadataValue(metadata, key) {
  return String(metadata?.[key]?.value || "").replace(/<[^>]+>/g, "").trim();
}

async function commonsCandidates(listing) {
  const queries = [
    `${listing.year} ${listing.make} ${listing.model} ${listing.bodyType}`,
    `${listing.year} ${listing.make} ${listing.model}`
  ];
  const pages = [];
  for (const query of queries) {
    const params = new URLSearchParams({
      action: "query",
      format: "json",
      origin: "*",
      generator: "search",
      gsrnamespace: "6",
      gsrlimit: "30",
      gsrsearch: query,
      prop: "imageinfo",
      iiprop: "url|mime|extmetadata",
      iiurlwidth: "1400"
    });
    const response = await fetchWithRetry(`https://commons.wikimedia.org/w/api.php?${params}`);
    if (!response.ok) throw new Error(`Commons search failed for ${query}: ${response.status}`);
    const data = await response.json();
    pages.push(...Object.values(data.query?.pages || {}));
    await sleep(250);
  }
  return pages
    .map((page) => {
      const info = page.imageinfo?.[0] || {};
      const license = metadataValue(info.extmetadata, "LicenseShortName");
      return {
        title: page.title,
        descriptionUrl: info.descriptionurl,
        downloadUrl: info.thumburl || info.url,
        originalUrl: info.url,
        mime: info.mime || "",
        license,
        licenseUrl: metadataValue(info.extmetadata, "LicenseUrl"),
        artist: metadataValue(info.extmetadata, "Artist"),
        credit: metadataValue(info.extmetadata, "Credit"),
        source: metadataValue(info.extmetadata, "ImageDescription"),
        score: scoreCandidate(listing, { title: page.title })
      };
    })
    .filter((candidate) => candidate.downloadUrl && /^image\/(jpeg|png|webp)$/i.test(candidate.mime))
    .filter((candidate) => allowedLicenses.test(candidate.license))
    .filter((candidate, index, all) => all.findIndex((item) => item.originalUrl === candidate.originalUrl) === index)
    .sort((a, b) => b.score - a.score);
}

async function commonsFile(title, listing) {
  const params = new URLSearchParams({
    action: "query",
    format: "json",
    origin: "*",
    titles: title,
    prop: "imageinfo",
    iiprop: "url|mime|extmetadata",
    iiurlwidth: "1400"
  });
  const response = await fetchWithRetry(`https://commons.wikimedia.org/w/api.php?${params}`);
  if (!response.ok) throw new Error(`Commons file lookup failed for ${title}: ${response.status}`);
  const data = await response.json();
  const page = Object.values(data.query?.pages || {})[0];
  const info = page?.imageinfo?.[0];
  if (!info) throw new Error(`Commons override file not found: ${title}`);
  const license = metadataValue(info.extmetadata, "LicenseShortName");
  if (!allowedLicenses.test(license)) throw new Error(`Commons override has unsupported license ${license}: ${title}`);
  return {
    title: page.title,
    descriptionUrl: info.descriptionurl,
    downloadUrl: info.thumburl || info.url,
    originalUrl: info.url,
    mime: info.mime || "",
    license,
    licenseUrl: metadataValue(info.extmetadata, "LicenseUrl"),
    artist: metadataValue(info.extmetadata, "Artist"),
    credit: metadataValue(info.extmetadata, "Credit"),
    source: metadataValue(info.extmetadata, "ImageDescription"),
    score: scoreCandidate(listing, { title: page.title }),
    manuallyVerified: true
  };
}

function sleep(milliseconds) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

async function fetchWithRetry(url, attempts = 5) {
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    const response = await fetch(url, { headers: { "user-agent": userAgent } });
    if (response.ok || ![429, 502, 503, 504].includes(response.status) || attempt === attempts) return response;
    await sleep(attempt * 1500);
  }
  throw new Error(`Unable to fetch ${url}`);
}

function extensionFor(contentType, url) {
  if (/png/i.test(contentType)) return ".png";
  if (/webp/i.test(contentType)) return ".webp";
  if (/jpe?g/i.test(contentType)) return ".jpg";
  const extension = path.extname(new URL(url).pathname).toLowerCase();
  return [".jpg", ".jpeg", ".png", ".webp"].includes(extension) ? extension : ".jpg";
}

async function downloadCandidate(listing, candidate) {
  const response = await fetchWithRetry(candidate.downloadUrl);
  if (!response.ok) throw new Error(`Image download failed for ${listing.id}: ${response.status}`);
  const contentType = response.headers.get("content-type") || candidate.mime;
  const extension = extensionFor(contentType, candidate.downloadUrl);
  const filename = `${listing.id}-${listing.make}-${listing.model}-${listing.year}`
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-") + extension;
  const filePath = path.join(outputDir, filename);
  fs.writeFileSync(filePath, Buffer.from(await response.arrayBuffer()));
  return `/demo-assets/vehicles/models/${filename}`;
}

async function main() {
  fs.mkdirSync(outputDir, { recursive: true });
  const listings = buildDemoListings();
  const usedUrls = new Set();
  const manifest = {
    generatedAt: new Date().toISOString(),
    source: "Wikimedia Commons",
    note: "Each image was selected for its exact listing year, make, and model. See each source page for full attribution and license terms.",
    listings: {}
  };

  for (const listing of listings) {
    await sleep(450);
    const override = SOURCE_FILE_OVERRIDES[listing.id];
    const candidates = override ? [] : await commonsCandidates(listing);
    const candidate = override
      ? await commonsFile(override, listing)
      : candidates.find((item) => item.score >= 40 && !usedUrls.has(item.originalUrl))
        || candidates.find((item) => item.score >= 40);
    if (!candidate) {
      throw new Error(`No verified exact-model Commons image found for ${listing.id}: ${listing.year} ${listing.make} ${listing.model}`);
    }
    const localPath = await downloadCandidate(listing, candidate);
    usedUrls.add(candidate.originalUrl);
    manifest.listings[listing.id] = {
      title: listing.title,
      localPath,
      sourceFile: candidate.title,
      sourcePage: candidate.descriptionUrl,
      originalUrl: candidate.originalUrl,
      license: candidate.license,
      licenseUrl: candidate.licenseUrl,
      artist: candidate.artist,
      credit: candidate.credit,
      matchScore: candidate.score,
      manuallyVerified: Boolean(candidate.manuallyVerified)
    };
    process.stdout.write(`${listing.id}\t${listing.year} ${listing.make} ${listing.model}\t${candidate.title}\t${candidate.license}\n`);
  }

  fs.writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
  process.stdout.write(`Saved ${Object.keys(manifest.listings).length} exact-model images and attribution records.\n`);
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
