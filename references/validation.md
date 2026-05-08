# Validation

Run validation before compiling and before final reporting.

## Prerequisites

```bash
npx playwright --version 2>/dev/null || echo "MISSING"
which tectonic 2>/dev/null || echo "MISSING"
```

Install missing tools only when needed:

```bash
npm install --save-dev playwright @playwright/test
npx playwright install chromium
```

Use `tectonic` for PDF compilation.

## Precompile Gates

Run:

```bash
node <skill>/scripts/screenshot-qa.mjs docs
node <skill>/scripts/validate-guide-structure.mjs docs
```

Fix all errors before compiling.

The structure validator checks:
- `docs/.logo-verified`
- customized colors, not bundled purple template colors
- one feature chapter per feature module
- approved review progress for every non-skipped feature/user flow
- no empty or stub-only section files
- Business Rules in each feature chapter
- wrapped UI references
- troubleshooting, FAQ, glossary, and best-practice completeness
- absence of common bundled template residue
- `docs/.dummy-data-ledger.json` is drained (every entry deleted or marked `undeletableReason`); set `UG_ALLOW_LEDGER_LEAKS=1` for mid-iteration drafts

The screenshot validator checks:
- `docs/screenshots/manifest.json`
- manifest entry for every PNG
- app-ready/loading metadata
- sidebar/menu crops that are not full-height whitespace captures
- non-layout captures that look like full-page screenshots
- invalid or unreadable PNG files

## Compile

```bash
cd docs && tectonic user-guide-<APP_SLUG>.tex
```

On errors:

```bash
cd docs && tectonic --print user-guide-<APP_SLUG>.tex 2>&1 | grep -i "error\|not found"
```

Common fixes:
- Missing screenshot file: check filename and `ui-overrides.tex` slug.
- `\ugScreenshot` argument error: pass `0.9`, not `0.9\textwidth`.
- Missing `\begin{document}`: a section file was overwritten with non-LaTeX content.
- Missing TOC entry: the main `.tex` file lacks an `\input{sections/...}` line.
- Overfull boxes near inline UI captures: retighten the crop or reduce image height in the project override.

## Self-Review

Before reporting completion, verify:
- cover logo is the target app logo
- colors match the target app
- document control stands alone before the rest of the guide
- TOC follows the chosen section order
- each feature chapter has Business Rules
- no copied template product terms remain
- sidebar screenshots are narrow meaningful crops
- no screenshot shows skeletons, spinners, or accidental loading states
- inline UI labels match the exact app labels
- `docs/ui-overrides.tex` maps only real captured PNGs
- every skipped capture has a reason
- `docs/.dummy-data-ledger.json` is empty or every entry has `deleted: true` (or a documented `undeletableReason`)
- target app's source code, config, and repo state were not modified by the run
- every CRUD chapter shows the same agent-owned row across Create / Edit / Delete screenshots

## Final Report

Report:
- PDF path
- section/chapter list
- page screenshot count
- inline UI counts by button/field/menu
- skipped captures and reasons
- labels that fell through to text rendering
- confirmation that screenshot QA, structure validation, and PDF compilation passed
