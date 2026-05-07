# generate-user-guide-skill

A reusable AI agent skill that turns a live web app into a polished PDF user guide. Give it credentials and a working directory; the agent explores the app, captures screenshots, and compiles a branded LaTeX PDF in the target language.

Works with any AI agent that can read files and run shell commands: Claude Code, OpenClaw, Hermes, or any other.

---

## What it produces

- Multi-chapter PDF user guide (22 chapters: intro → features → troubleshooting → appendix)
- Screenshots captured per-container via Playwright (no full-page dumps)
- Brand colors and logo extracted from the live app — not the purple template default
- Full content in any language (e.g. Bahasa Indonesia)

## What it will NOT do

- **Never mutates data on the target system.** Default mode is read-only. The skill will not click Save / Submit / Create / Update / Delete / Approve / Upload / Send / Confirm / Publish / Archive — only navigate, hover, open-and-Escape modals, and screenshot. Login submit is the one exception.
- **Never modifies your codebase.** It only reads source files (to walk routes, components, schemas, API handlers) and writes inside `YOUR_PROJECT_PATH/docs/` — its own scratch space.
- **Never creates fresh records to demo "success" states.** It uses pre-existing records you already have. If your app has no demo data for a feature, that screenshot is skipped and reported as a gap.

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
- READ_ONLY_MODE: true   # default. Skill will not Save/Submit/Create/Delete/Approve/Upload anything. Set false ONLY on a non-prod env if you accept real data mutations.

READ-ONLY: do not click Save / Submit / Create / Delete / Approve / Upload / Send / Confirm / Publish / Archive. Open modals only to screenshot the empty state, then Escape. For populated/success-state screenshots, navigate to pre-existing records — do not create fresh ones. Login submit is the only allowed form submission.

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

Copy-paste this each time you want to add the next feature chapter. SKILL.md uses review-gated iteration with `docs/guide-progress.json` (statuses: `pending` / `drafted` / `reviewed` / `approved` / `skipped`) — survives context compaction, `/clear`, and fresh conversations because state lives on disk.

```
Continue the YOUR_APP_NAME user guide at YOUR_PROJECT_PATH/docs/ using YOUR_SKILL_PATH/SKILL.md.

Read docs/guide-progress.json. Pick the lowest-numbered feature whose status is `pending`. Draft and capture that one feature only, then mark it `drafted` and ask me for review. Do not re-extract logo or colors if already done. Do not modify already-approved chapters.

READ_ONLY_MODE: true. Do not Save/Submit/Create/Delete/Approve/Upload anything. Modals: open → screenshot → Escape. Login submit is the only allowed form submission.

Recompile when done. Report which chapter was drafted and which is next.
```

Repeat until all features reach `approved` or `skipped`. Each run completes exactly one feature and tells you what's next.

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
| Lost progress after `/clear` or compaction | `docs/guide-progress.json` tracks per-feature status (`pending` / `drafted` / `reviewed` / `approved` / `skipped`) — review-gated iteration resumes from the manifest |
| Re-extracting logo / colors after restart | `docs/.logo-verified` sentinel + Step 9 colors gate detect prior work; agent skips Step 4 when both pass |
| Overwriting approved chapters | Review-gated iteration — only `pending` features get drafted; `approved` files are not re-touched |
| Mutating live data while capturing | Read-Only Mode rule: `READ_ONLY_MODE=true` by default. Forbidden clicks: Save, Submit, Create, Delete, Approve, Upload, Send, Confirm, Publish, Archive. Allowed: navigate, hover, open modals → screenshot → Escape, login submit only. Step 10 grep verifies. |
| Modifying target project's source code | Skill only writes inside `docs/` and `scripts/` — never edits the app being documented |
| Wrong logo | `docs/.logo-verified` sentinel — build exits 1 if missing |
| Purple template colors | Gate 2 greps for `#4A148C` — build exits 1 if found |
| Missing PNG files | Gate 3 checks every `\ugScreenshot` path — build exits 1 with list |
| Full-page screenshots | Step 5 enforces width limits: container ≤ 0.85, sidebar ≤ 0.5, max 0.95 |
| Garbled text in PDF | Symptom of a missing PNG — Step 5 documents the fix |
