#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";

const docsDir = process.argv[2] || "docs";
const screenshotDir = path.join(docsDir, "screenshots");
const manifestPath = path.join(screenshotDir, "manifest.json");

let failed = false;
let warned = false;

function error(message) {
  failed = true;
  console.error(`ERROR: ${message}`);
}

function warn(message) {
  warned = true;
  console.warn(`WARN: ${message}`);
}

function ok(message) {
  console.log(`OK: ${message}`);
}

function readPngSize(file) {
  const buffer = fs.readFileSync(file);
  const signature = buffer.subarray(0, 8).toString("hex");
  if (signature !== "89504e470d0a1a0a") {
    throw new Error("not a PNG file");
  }
  return {
    width: buffer.readUInt32BE(16),
    height: buffer.readUInt32BE(20)
  };
}

function normalizeManifest(raw) {
  const entries = new Map();
  const defaultViewport = raw.viewport || { width: 1440, height: 1000 };
  const source = raw.screenshots && typeof raw.screenshots === "object" ? raw.screenshots : raw;
  const items = Array.isArray(raw.screenshots)
    ? raw.screenshots
    : Object.entries(source).filter(([key]) => key !== "viewport" && key !== "version").map(([key, value]) => ({
        file: key,
        ...(typeof value === "object" && value ? value : {})
      }));

  for (const item of items) {
    const file = item.file || item.path || item.name;
    if (!file) continue;
    const basename = path.basename(file);
    entries.set(basename, {
      viewport: item.viewport || defaultViewport,
      ...item,
      file: basename
    });
  }
  return entries;
}

function readManifest() {
  if (!fs.existsSync(manifestPath)) {
    error(`${manifestPath} not found. Capture scripts must write screenshot metadata.`);
    return new Map();
  }

  try {
    return normalizeManifest(JSON.parse(fs.readFileSync(manifestPath, "utf8")));
  } catch (err) {
    error(`${manifestPath} is not valid JSON: ${err.message}`);
    return new Map();
  }
}

function categoryFor(file, entry) {
  return [
    entry?.category,
    entry?.type,
    entry?.kind,
    entry?.role,
    entry?.purpose,
    file
  ].filter(Boolean).join(" ").toLowerCase();
}

function viewportFor(entry) {
  const viewport = entry?.viewport || {};
  return {
    width: Number(viewport.width) || 1440,
    height: Number(viewport.height) || 1000
  };
}

function checkLoadingState(file, entry) {
  if (!entry) return;
  const ready = entry.ready || {};
  if (ready.ok === false) error(`${file} was captured before the app-ready gate passed.`);
  if (ready.loadingDetected || ready.loadingTextVisible || entry.loadingDetected || entry.loadingTextVisible) {
    error(`${file} manifest says a loading state was visible.`);
  }
  if (typeof entry.loadingState === "string" && !/^(none|complete|ready|loaded)$/i.test(entry.loadingState)) {
    error(`${file} has non-ready loadingState: ${entry.loadingState}`);
  }
}

function checkGeometry(file, size, entry) {
  const category = categoryFor(file, entry);
  const viewport = viewportFor(entry);
  const ratio = size.height / Math.max(size.width, 1);
  const isSidebarLike = /\b(sidebar|side-bar|menu|navigation|nav)\b/.test(category);
  const isLayout = entry?.fullPage === true || /\b(layout|full-page|full page|viewport|whole-page)\b/.test(category);

  if (isSidebarLike) {
    if (size.height > viewport.height) {
      error(`${file} is ${size.width}x${size.height}; sidebar/menu crops must not exceed viewport height ${viewport.height}.`);
    }
    if (ratio > 3.5) {
      error(`${file} has height/width ratio ${ratio.toFixed(2)}; crop meaningful sidebar/menu content instead of whitespace.`);
    }
  }

  if (!isLayout && size.width >= viewport.width * 0.75 && size.height >= viewport.height * 0.95) {
    error(`${file} looks like a full-page capture (${size.width}x${size.height}) but is not marked as layout/fullPage.`);
  }

  if (size.width < 80 || size.height < 40) {
    warn(`${file} is very small (${size.width}x${size.height}); confirm the crop is readable.`);
  }
}

if (!fs.existsSync(screenshotDir)) {
  error(`${screenshotDir} not found.`);
  process.exit(1);
}

const manifest = readManifest();
const pngFiles = fs.readdirSync(screenshotDir)
  .filter((file) => file.toLowerCase().endsWith(".png"))
  .sort();

if (!pngFiles.length) {
  error(`${screenshotDir} contains no PNG screenshots.`);
}

for (const file of pngFiles) {
  const fullPath = path.join(screenshotDir, file);
  let size;
  try {
    size = readPngSize(fullPath);
  } catch (err) {
    error(`${file} cannot be read as PNG: ${err.message}`);
    continue;
  }

  const entry = manifest.get(file);
  if (!entry) {
    error(`${file} is missing from screenshots/manifest.json.`);
  }

  checkLoadingState(file, entry);
  checkGeometry(file, size, entry);
}

if (!failed) {
  ok(`screenshot QA passed for ${pngFiles.length} PNG file(s).`);
  if (warned) process.exitCode = 0;
} else {
  process.exit(1);
}
