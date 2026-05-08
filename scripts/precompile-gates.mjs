#!/usr/bin/env node
// precompile-gates.mjs — blocking gates that MUST pass before xelatex/tectonic.
//
// Run from the project working directory (the directory that contains docs/).
// Exits non-zero on any failure and prints a remediation hint per gate.
//
// Gates:
//   1. logo extracted   — docs/.logo-verified sentinel exists (created by Step 4a).
//   2. colors extracted — docs/userguide-colors.sty no longer contains bundled
//                         purple template colors.
//   3. images present   — every PNG referenced by \ugScreenshot{...} or
//                         \includegraphics{...} in docs/sections/*.tex exists.
//
// Gate 4 (dummy-data ledger drained) is enforced separately by
// scripts/validate-guide-structure.mjs. Set UG_ALLOW_LEDGER_LEAKS=1 to bypass
// during mid-iteration draft compiles.
//
// Usage:
//   node scripts/precompile-gates.mjs [docs-dir]

import fs from "node:fs";
import path from "node:path";

const docsDir = process.argv[2] || process.env.UG_DOCS_DIR || "docs";

let failed = false;

function fail(...lines) {
  failed = true;
  for (const line of lines) console.error(`ERROR: ${line}`);
}

function ok(message) {
  console.log(`OK: ${message}`);
}

// ---- Gate 1: logo extracted -------------------------------------------------
const logoSentinel = path.join(docsDir, ".logo-verified");
if (!fs.existsSync(logoSentinel)) {
  fail(
    `${logoSentinel} not found.`,
    "Go back to Step 4a: extract the target app's logo from the live web,",
    `save to ${path.join(docsDir, "img/original-logo.png")}, then create ${logoSentinel}.`
  );
} else {
  const source = fs.readFileSync(logoSentinel, "utf8").trim();
  ok(`logo extracted (${source})`);
}

// ---- Gate 2: colors customized ---------------------------------------------
const colorsPath = path.join(docsDir, "userguide-colors.sty");
const bundledMarkers = [/4A148C/i, /Purple Theme/i, /ugPrimary.*Deep purple/i];
if (fs.existsSync(colorsPath)) {
  const colors = fs.readFileSync(colorsPath, "utf8");
  const hit = bundledMarkers.find((re) => re.test(colors));
  if (hit) {
    fail(
      `${colorsPath} still contains bundled template colors (matched ${hit}).`,
      "Go back to Step 4b: extract the target app's brand colors from the live web",
      `and rewrite ${colorsPath} before compiling.`
    );
  } else {
    ok("colors customized.");
  }
} else {
  fail(
    `${colorsPath} not found.`,
    "Step 3 should have copied the template's userguide-colors.sty into docs/."
  );
}

// ---- Gate 3: every referenced PNG exists -----------------------------------
const sectionsDir = path.join(docsDir, "sections");
const screenshotRe = /\\ugScreenshot(?:\[[^\]]*\])?\{([^}]+)\}/g;
const includeRe = /\\includegraphics(?:\[[^\]]*\])?\{([^}]+)\}/g;

let missing = 0;
if (!fs.existsSync(sectionsDir)) {
  fail(`${sectionsDir} not found — nothing to scan.`);
} else {
  const texFiles = fs
    .readdirSync(sectionsDir)
    .filter((f) => f.endsWith(".tex"))
    .map((f) => path.join(sectionsDir, f));

  for (const texFile of texFiles) {
    const content = fs.readFileSync(texFile, "utf8");
    for (const re of [screenshotRe, includeRe]) {
      re.lastIndex = 0;
      let match;
      while ((match = re.exec(content)) !== null) {
        const ref = match[1].trim();
        const pngPath = path.join(docsDir, ref);
        const candidates = [pngPath];
        if (!path.extname(ref)) {
          candidates.push(`${pngPath}.png`, `${pngPath}.jpg`, `${pngPath}.pdf`);
        }
        if (!candidates.some((p) => fs.existsSync(p))) {
          console.error(`ERROR: missing image: ${pngPath} (referenced in ${texFile})`);
          missing += 1;
        }
      }
    }
  }

  if (missing > 0) {
    failed = true;
    console.error(
      `ERROR: ${missing} missing image file(s). Fix paths or recapture before compiling.`
    );
    console.error("Missing images produce garbled text in the PDF.");
  } else {
    ok("all referenced images exist.");
  }
}

if (failed) {
  process.exit(1);
}
console.log("All pre-compile gates passed. Safe to run xelatex/tectonic.");
