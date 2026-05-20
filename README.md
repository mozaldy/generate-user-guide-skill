# generate-user-guide-skill

A reusable AI agent skill that turns a live web app into a polished PDF user guide. Give it credentials and a working directory; the agent explores the app, captures screenshots, and compiles a branded LaTeX PDF in the target language.

Works with any AI agent that can read files and run shell commands: Claude Code, OpenClaw, Hermes, or any other.

---

## What it produces

- Multi-chapter PDF user guide (introduction → features → troubleshooting → appendix), one PDF per role
- Screenshots captured per-container via Playwright (no full-page dumps)
- Brand colors and logo extracted from the live app — not the template default
- Full content in any language (e.g. Bahasa Indonesia)

The chapter list, ordering, and numbering are driven by `template/MANIFEST.yaml` plus the real feature modules the agent discovers in your codebase. Different apps produce different chapter counts.

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

## Install

No per-agent install step. The skill is just a folder with `SKILL.md` at the root — any agent that can read files and run shell commands loads it by absolute path.

1. Clone this repo somewhere the agent can read it:
   ```bash
   git clone <this-repo> /your/path/generate-user-guide-skill
   ```

2. Create a working directory for your project (anywhere you like):
   ```bash
   mkdir -p /your/path/my-project
   ```

3. Point your agent at `SKILL.md` in the prompt (see [How to prompt](#how-to-prompt)). The `YOUR_SKILL_PATH` placeholder is the absolute path from step 1.

### Per-agent notes

- **Claude Code** — works from any path. For a globally available skill, you can also place the folder at `~/.claude/skills/generate-user-guide/` (or `.claude/skills/generate-user-guide/` inside a project) and Claude Code will auto-discover it; otherwise just reference the absolute path in the prompt.
- **OpenClaw** — reference the absolute `SKILL.md` path in the prompt. No registration needed.
- **Hermes** — reference the absolute `SKILL.md` path in the prompt. No registration needed.
- **Any other agent** — same pattern: clone the repo, pass the absolute `SKILL.md` path in the prompt.

The agent copies template files into `docs/` inside the working directory automatically when you invoke the skill.

---

## How to prompt

You don't need to know the internal workflow. The skill drives discovery, role selection, theming, capture, review checkpoints, and compilation by itself. Just hand it the config.

### Prompt 1 — Start a guide

Send once. The agent discovers your app's modules, asks which role the PDF is for (if the app has multiple roles), and works through the guide one feature at a time with review checkpoints between each.

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
```

The agent will pause at each review checkpoint. Approve or request changes — it continues only after approval.

### Prompt "continue" — Resume the same guide

If the run was interrupted (compaction, crash, new session), point the agent back at the same working directory:

```
Continue the YOUR_APP_NAME user guide at YOUR_PROJECT_PATH/docs/.
```

The agent reads `docs/guide-progress.json` and `docs/.dummy-data-ledger.json` to figure out what's done, what's pending, and whether any dummy records need cleanup. It picks up at the next pending feature.

### One PDF per role

Most apps gate features by role. The skill produces **one PDF per role** — re-run with a different `TARGET_ROLE` for each role you need to document. The agent enumerates roles during discovery and asks which one this run is for.

---

## Template structure

```
generate-user-guide-skill/
├── SKILL.md                      ← full instructions for the agent
└── template/
    ├── MANIFEST.yaml             ← section list + per-section quality contract
    ├── userguide-example.tex     ← main LaTeX entry point (copied per project)
    ├── latex/
    │   ├── userguide.sty         ← master style loader
    │   ├── userguide-colors.sty  ← color palette (overwritten per app)
    │   ├── userguide-boxes.sty
    │   ├── userguide-tables.sty
    │   └── ...
    ├── sections/                 ← reference section files (copied per project)
    └── img/                      ← placeholder images (replaced per app)
```

`template/MANIFEST.yaml` is the source of truth for the template's section structure. To add or remove a section type, or to change the chapter contract, edit MANIFEST — not SKILL.md.

The agent copies `template/` into `YOUR_PROJECT_PATH/docs/`, then overwrites:
- `docs/userguide-colors.sty` — target app's brand colors
- `docs/img/original-logo.png` + `docs/img/white-logo.png` — live logo
- `docs/sections/<chapter>.tex` — real content per chapter (filenames and count come from MANIFEST plus the discovered feature modules)

---

## Guardrails baked into SKILL.md

| What | How |
|------|-----|
| Wrong logo | `docs/.logo-verified` sentinel — build exits 1 if missing |
| Bundled template colors | Pre-compile gate greps for unmodified template colors — build exits 1 if found |
| Missing PNG files | Pre-compile gate checks every `\ugScreenshot` path — build exits 1 with list |
| Leaked dummy data | Final-compile gate scans `docs/.dummy-data-ledger.json` — exits 1 if any entry is `deleted: false` and lacks an `undeletableReason` |
| Mutating real records | The agent only permits Create/Edit/Delete on records it created itself and logged in the ledger |
| Modifying target codebase | Self-review checks `git status` of the target app's repo for unintended changes |
| Resume after compaction | The agent re-reads `docs/.dummy-data-ledger.json` and cleans up any leaked records before drafting new chapters |
| Full-page screenshots | Width limits enforced: container ≤ 0.85, sidebar ≤ 0.5, max 0.95 |
| Garbled text in PDF | Symptom of a missing PNG — diagnostic guidance lives in SKILL.md |
