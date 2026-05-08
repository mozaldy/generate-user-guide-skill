# generate-user-guide-skill

A reusable AI agent skill that turns a live web app into a polished PDF user guide. Give it credentials and a working directory; the agent explores the app, captures screenshots, and compiles a branded LaTeX PDF in the target language.

Works with any AI agent that can read files and run shell commands: Claude Code, OpenClaw, Hermes, or any other.

---

## What it produces

- Multi-chapter PDF user guide (22 chapters: intro → features → troubleshooting → appendix)
- Screenshots captured per-container via Playwright (no full-page dumps)
- Brand colors and logo extracted from the live app — not the purple template default
- Full content in any language (e.g. Bahasa Indonesia)

---

## How it handles your data

The skill captures CRUD flows by creating its **own** dummy records, reusing the same record across the Create → Edit → Delete capture sequence, then deleting every record before reporting done. A ledger at `docs/.dummy-data-ledger.json` tracks every record the agent creates so cleanup survives `/clear`, compaction, or crashes.

**Will:**
- Create dummy records with realistic-looking names ("Quarterly Sales Review", "Acme Corporation") on the target app
- Edit and delete those same records to capture the full CRUD lifecycle
- Read pre-existing data for list/detail screenshots (read-only)
- Read your codebase to understand feature behavior

**Will not:**
- Edit or delete any record the agent did not create itself
- Send real emails/notifications/webhooks (unless you explicitly authorize it)
- Modify the target app's source code, config, env files, or repo state
- Run bulk operations, role/permission changes, or billing actions

If you need a fully read-only run (no writes whatsoever), set `MUTATIONS_ALLOWED: false` in the prompt config — the agent will skip Create/Edit/Delete captures and note "feature available; not captured in this revision" in those chapters.

---

## Requirements

On the machine where the agent runs:

```bash
tectonic --version      # LaTeX compiler (or xelatex)
node --version          # Node 18+
npx playwright install chromium
```

---

## Setup

1. Clone this repo somewhere the agent can read it:
   ```bash
   git clone <this-repo> /your/path/generate-user-guide-skill
   ```

2. Create a working directory for your project (anywhere you like):
   ```bash
   mkdir -p /your/path/my-project
   ```

3. The agent copies template files into `docs/` inside the working directory automatically during Step 1 of SKILL.md.

---

## How to prompt

Two prompts, that's it. Replace every `YOUR_*` placeholder with real values.

### Prompt 1 — Initial setup + first chapter

Send once. The agent sets up the full 22-chapter structure, writes chapters 1–5 fully, and leaves 6–16 as placeholders.

```
Use the skill at YOUR_SKILL_PATH/SKILL.md to generate a user guide for YOUR_APP_NAME.

Config:
- BASE_URL: https://your-app.com
- EMAIL: your@email.com
- PASSWORD: yourpassword
- APP_SLUG: your-app
- APP_NAME: Your App Name
- COMPANY: Your Company Name
- Working dir: YOUR_PROJECT_PATH
- Skill path: YOUR_SKILL_PATH
- LANGUAGE: [your language, e.g. "Bahasa Indonesia" or "English"]
- MUTATIONS_ALLOWED: true   # set to false for fully read-only run
- DUMMY_DATA_NOTES: [optional naming constraints, e.g. "use English company names", "avoid the word Test"]

Data handling: the agent will create its own dummy records to capture Create/Edit/Delete flows, reuse the same record across the lifecycle, and delete every record it created before reporting done. It tracks every creation in docs/.dummy-data-ledger.json so cleanup survives compaction. It will NOT mutate any record it did not create itself, and will NOT modify the target app's source code or repo state.

BLOCKING — complete before any screenshots:

Step 4a (mandatory):
- Navigate to BASE_URL
- element.screenshot() the logo <img> in the top-left only (not full page)
- Save to docs/img/original-logo.png and docs/img/white-logo.png
- Write "extracted from: BASE_URL" to docs/.logo-verified

Step 4b (mandatory):
- Sample the app's brand colors from the live web (check tailwind.config.* or globals.css)
- Rewrite docs/userguide-colors.sty with the app's colors — no purple, no #4A148C
- Run the Step 9 gate check before compiling. Fix failures before proceeding.

STRUCTURE — create all 22 chapters at once:
- Chapters 1–4 (Introduction, System Overview, Getting Started, UI Overview): write fully
- Chapter 5 ([first feature module]): write FULLY with screenshots and step-by-step
- Chapters 6–16 ([remaining feature modules]): fill with placeholder: "This module will be documented in the next revision."
- Chapters 17–22 (Common Tasks, Troubleshooting, FAQ, Best Practices, Glossary, Appendix): write basic skeleton, to be expanded after all features are done

Compile when finished. Report the PDF path and which chapters are complete vs placeholder.
```

> **Tip:** Before sending, list your app's sidebar modules in order so the agent numbers chapters correctly:
> `Ch 5: Login → Ch 6: Dashboard → Ch 7: Reports → ...`

---

### Prompt "continue" — Fill in the next chapter

Copy-paste this each time you want to add the next feature chapter. The agent finds the lowest-numbered placeholder automatically.

```
Continue the YOUR_APP_NAME user guide at YOUR_PROJECT_PATH/docs/.

Check docs/sections/ and find the lowest-numbered chapter that still contains the placeholder "will be documented in the next revision". Write that chapter FULLY following the Step 8 guidelines in SKILL.md:
- Navigate to the relevant route at BASE_URL (log in first if needed)
- Screenshot per container (not full page)
- Write Purpose, Step-by-step, Business Rules table
- All content text in [your language]

Do not modify other chapters. Do not re-extract logo or colors (docs/.logo-verified already exists). Recompile when done. Report which chapter was completed and which placeholder is next.
```

Repeat until all chapters are filled. Each run completes exactly one chapter and tells you what's next.

---

## Template structure

```
generate-user-guide-skill/
├── SKILL.md                      ← full step-by-step instructions for the agent
└── template/
    ├── userguide-example.tex     ← main LaTeX entry point (copied per project)
    ├── latex/
    │   ├── userguide.sty         ← master style loader
    │   ├── userguide-colors.sty  ← color palette (overwritten per app)
    │   ├── userguide-boxes.sty
    │   ├── userguide-tables.sty
    │   └── ...
    ├── sections/                 ← 22 reference section files (copied per project)
    └── img/                      ← placeholder images (replaced per app)
```

The agent copies `template/` into `YOUR_PROJECT_PATH/docs/`, then overwrites:
- `docs/userguide-colors.sty` — target app's brand colors
- `docs/img/original-logo.png` + `docs/img/white-logo.png` — live logo
- `docs/sections/NN-*.tex` — real content per chapter

---

## Guardrails baked into SKILL.md

| What | How |
|------|-----|
| Wrong logo | `docs/.logo-verified` sentinel — build exits 1 if missing |
| Purple template colors | Gate 2 greps for `#4A148C` — build exits 1 if found |
| Missing PNG files | Gate 3 checks every `\ugScreenshot` path — build exits 1 with list |
| Leaked dummy data | Gate 4 scans `docs/.dummy-data-ledger.json` — final compile exits 1 if any entry is `deleted: false` and lacks an `undeletableReason` |
| Mutating real records | Step 5 only permits Create/Edit/Delete on records the agent itself created and logged in the ledger |
| Modifying target codebase | Step 10 self-review checks `git status` of the target app's repo for unintended changes |
| Resume after compaction | Re-read `docs/.dummy-data-ledger.json` and clean up any leaked records before drafting new chapters |
| Full-page screenshots | Step 5 enforces width limits: container ≤ 0.85, sidebar ≤ 0.5, max 0.95 |
| Garbled text in PDF | Symptom of a missing PNG — Step 5 documents the fix |
