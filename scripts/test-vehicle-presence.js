const fs = require("fs");
const path = require("path");
const vehiclePresence = require("../apps/api/vehicle-presence");

function loadEnvFile(filePath) {
  if (!fs.existsSync(filePath)) return;
  const content = fs.readFileSync(filePath, "utf8");
  for (const line of content.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#") || !trimmed.includes("=")) continue;
    const index = trimmed.indexOf("=");
    const key = trimmed.slice(0, index).trim();
    let value = trimmed.slice(index + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    if (key && process.env[key] === undefined) process.env[key] = value;
  }
}

function parseArgs(argv) {
  const args = {};
  for (let index = 2; index < argv.length; index += 1) {
    const item = argv[index];
    if (!item.startsWith("--")) continue;
    const key = item.slice(2);
    const next = argv[index + 1];
    if (!next || next.startsWith("--")) {
      args[key] = true;
    } else {
      args[key] = next;
      index += 1;
    }
  }
  return args;
}

function usage() {
  return [
    "Usage:",
    "  node scripts/test-vehicle-presence.js --image-url <signed-or-public-url> --vin <17-char-vin> --code <KDX-1234>",
    "  node scripts/test-vehicle-presence.js --image-file <local-image> --vin <17-char-vin> --code <KDX-1234>",
    "",
    "Optional:",
    "  --year 2023 --make Toyota --model Corolla",
    "",
    "The script reads .env, .env.local, apps/api/.env, and apps/api/.env.local if present."
  ].join("\n");
}

function imageFileToDataUrl(filePath) {
  const extension = path.extname(filePath).toLowerCase();
  const contentTypes = {
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".png": "image/png",
    ".webp": "image/webp"
  };
  const contentType = contentTypes[extension];
  if (!contentType) throw new Error("Only JPG, PNG, and WebP sample images are supported.");
  const bytes = fs.readFileSync(filePath);
  return `data:${contentType};base64,${bytes.toString("base64")}`;
}

async function main() {
  const root = path.resolve(__dirname, "..");
  [
    path.join(root, ".env"),
    path.join(root, ".env.local"),
    path.join(root, "apps", "api", ".env"),
    path.join(root, "apps", "api", ".env.local")
  ].forEach(loadEnvFile);

  const args = parseArgs(process.argv);
  if (args.help || (!args["image-url"] && !args["image-file"]) || !args.vin || !args.code) {
    console.log(usage());
    process.exit(args.help ? 0 : 1);
  }

  const imageUrl = args["image-url"] || imageFileToDataUrl(path.resolve(args["image-file"]));
  const listing = {
    id: args["listing-id"] || "vehicle_presence_local_test",
    vin: args.vin,
    year: args.year || "",
    make: args.make || "",
    model: args.model || ""
  };

  console.log("[vehicle-presence-test] Starting sample verification", {
    model: vehiclePresence.openAiConfig()?.model || "",
    hasOpenAiConfig: Boolean(vehiclePresence.openAiConfig()),
    imageSource: args["image-url"] ? "url" : "local_file_data_url",
    vinLength: vehiclePresence.normalizeVin(args.vin).length,
    codePresent: Boolean(args.code)
  });

  const result = await vehiclePresence.analyze({
    imageUrl,
    code: args.code,
    listing
  });

  console.log("[vehicle-presence-test] Result");
  console.log(JSON.stringify(result, null, 2));
}

main().catch((error) => {
  console.error("[vehicle-presence-test] Failed", {
    message: error.message,
    stack: error.stack
  });
  process.exit(1);
});
