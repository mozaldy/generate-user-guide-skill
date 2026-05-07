#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";

const docsDir = process.argv[2] || "docs";
const sectionsDir = path.join(docsDir, "sections");

let failed = false;

function error(message) {
  failed = true;
  console.error(`ERROR: ${message}`);
}

function ok(message) {
  console.log(`OK: ${message}`);
}

function read(file) {
  return fs.readFileSync(file, "utf8");
}

function listTexFiles(dir) {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir)
    .filter((file) => file.endsWith(".tex"))
    .sort()
    .map((file) => path.join(dir, file));
}

function extractInputs(mainTex) {
  const matches = [...mainTex.matchAll(/\\input\{sections\/([^}]+)\}/g)];
  return matches.map((match) => match[1].endsWith(".tex") ? match[1] : `${match[1]}.tex`);
}

function lineHits(file, regex, rejectRegex = null) {
  return read(file).split(/\r?\n/).flatMap((line, index) => {
    if (regex.test(line) && !(rejectRegex && rejectRegex.test(line))) {
      return [`${file}:${index + 1}: ${line}`];
    }
    return [];
  });
}

if (!fs.existsSync(sectionsDir)) {
  error(`${sectionsDir} not found.`);
  process.exit(1);
}

const sectionFiles = listTexFiles(sectionsDir);
const allSectionText = sectionFiles.map(read).join("\n");

if (!fs.existsSync(path.join(docsDir, ".logo-verified"))) {
  error("docs/.logo-verified not found.");
} else {
  ok("logo verification sentinel exists.");
}

const colorsPath = path.join(docsDir, "userguide-colors.sty");
if (!fs.existsSync(colorsPath)) {
  error("docs/userguide-colors.sty not found.");
} else if (/4A148C|Purple Theme|Deep purple/i.test(read(colorsPath))) {
  error("docs/userguide-colors.sty still contains bundled purple template colors.");
} else {
  ok("colors are customized.");
}

const mainTexCandidates = fs.readdirSync(docsDir)
  .filter((file) => /^user-guide-.*\.tex$/.test(file))
  .sort();

let inputFiles = [];
if (!mainTexCandidates.length) {
  error("No docs/user-guide-<slug>.tex file found.");
} else {
  inputFiles = extractInputs(read(path.join(docsDir, mainTexCandidates[0])));
  const missingInputs = inputFiles.filter((file) => !fs.existsSync(path.join(sectionsDir, file)));
  if (missingInputs.length) error(`main TeX references missing section files: ${missingInputs.join(", ")}`);
  else ok("main TeX section inputs exist.");
}

const sectionNames = sectionFiles.map((file) => path.basename(file));
const commonIndex = sectionNames.findIndex((file) => /common-tasks\.tex$/.test(file));
const featureNames = sectionNames.filter((file) => /^\d{2}-/.test(file))
  .filter((file) => {
    const number = Number(file.slice(0, 2));
    if (number < 5) return false;
    if (commonIndex === -1) return !/(troubleshooting|faq|best-practices|glossary|appendix)\.tex$/.test(file);
    return sectionNames.indexOf(file) < commonIndex;
  });

if (!featureNames.length) {
  error("No feature chapter files found from chapter 05 onward.");
} else {
  ok(`${featureNames.length} feature chapter file(s) found.`);
}

for (const name of featureNames) {
  const file = path.join(sectionsDir, name);
  const text = read(file);
  if (!/\\section\{[^}]+\}/.test(text)) error(`${name} has no section heading.`);
  if (!/\\subsection\{Business Rules\}/.test(text)) error(`${name} is missing \\subsection{Business Rules}.`);
}

const stubPatterns = [
  /\bTBD\b/i,
  /\bTODO\b/i,
  /lorem ipsum/i,
  /placeholder/i,
  /coming soon/i,
  /to be added/i
];

for (const file of sectionFiles) {
  const text = read(file).trim();
  if (text.length < 200 && !/00-metadata\.tex$/.test(file)) {
    error(`${path.basename(file)} is too short and likely stub-only.`);
  }
  for (const pattern of stubPatterns) {
    if (pattern.test(text)) error(`${path.basename(file)} contains stub text matching ${pattern}.`);
  }
}

const forbiddenResidue = [
  "Insight Doc",
  "Sinergi Dimensi Informatika",
  "Keycloak",
  "MinIO",
  "Qdrant"
];
for (const term of forbiddenResidue) {
  if (allSectionText.includes(term)) error(`template residue remains: ${term}`);
}
if (!forbiddenResidue.some((term) => allSectionText.includes(term))) {
  ok("no blocked template residue found.");
}

const rawControlRegex = /\b(click|press|tap|select|hit|tekan|klik|pilih)\s+(the\s+)?[A-Za-z][A-Za-z0-9 ]*\s+(button|tombol|field|kolom|menu|link)\b/i;
const rawHits = sectionFiles.flatMap((file) => lineHits(file, rawControlRegex, /\\ug(Button|Field|Menu|Status)\{/));
if (rawHits.length) error(`plain UI control references are not wrapped:\n${rawHits.join("\n")}`);
else ok("prose UI control references are wrapped.");

const errorRows = (allSectionText.match(/\\ugError\{/g) || []).length;
if (errorRows < 3) error("Troubleshooting has fewer than 3 \\ugError rows.");
else ok("Troubleshooting rows present.");

const faqEntries = [...allSectionText.matchAll(/\\ugFAQ\{([^}]*)\}\{([^}]*)\}/g)];
if (faqEntries.length < 5) {
  error("FAQ has fewer than 5 entries.");
} else if (faqEntries.some(([, , answer]) => answer.trim().split(/\s+/).length < 8)) {
  error("At least one FAQ answer is empty or too short.");
} else {
  ok("FAQ entries are substantive.");
}

const emptyGlossary = allSectionText.match(/\\ugGlossaryEntry\{[^}]+\}\{\s*\}/g) || [];
if (emptyGlossary.length) error("Glossary contains empty definitions.");
else ok("Glossary definitions present.");

if (!/\\begin\{ugBestPractice\}\[[^\]]+\]/.test(allSectionText)) {
  error("Best Practices must use bracketed titles.");
} else {
  ok("Best Practices use bracketed titles.");
}

const progressPath = path.join(docsDir, "guide-progress.json");
if (!fs.existsSync(progressPath)) {
  error("docs/guide-progress.json not found. Multi-step review progress is required.");
} else {
  try {
    const progress = JSON.parse(read(progressPath));
    if (!Array.isArray(progress.features) || !progress.features.length) {
      error("docs/guide-progress.json must contain a non-empty features array.");
    } else {
      const notApproved = progress.features.filter((feature) =>
        feature.status !== "approved" && feature.status !== "skipped"
      );
      if (notApproved.length) {
        error(`features/user flows not approved: ${notApproved.map((feature) => feature.id || feature.title).join(", ")}`);
      } else {
        ok("guide review progress is approved or skipped for every feature/user flow.");
      }
    }
  } catch (err) {
    error(`docs/guide-progress.json is not valid JSON: ${err.message}`);
  }
}

if (failed) process.exit(1);
ok("guide structure validation passed.");
