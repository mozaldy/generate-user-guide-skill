---
name: generate-user-guide-skill
description: Generate end-user guides, user manuals, and documentation PDFs for web apps from a live route, credentials, source-code feature discovery, browser screenshots, and a LaTeX template. Use when Codex is asked to create a user guide/manual PDF, document a web app UI workflow, run /generate-user-guide, or iteratively document one feature/user flow at a time with review checkpoints; not for API docs, code docs, READMEs, or developer-facing documentation.
---

# generate-user-guide

Generate an end-user guide PDF from a real web app. Default scope is the **entire app**, not only the URL provided by the user. The supplied route is the entry/login/start route for discovery and capture unless the user explicitly says to document only that route. Always use a multi-step, review-gated workflow: discover all features and user flows from source code first, create the full-app module plan, then write and capture one feature/user flow at a time, ask for feedback, and continue only after approval.

## Intake

Ask only for missing values.

Required:
- `TARGET_ROUTE` - entry/start route used to access the app, for example `/auth`, `/login`, or `/admin`. This is **not** the documentation scope by default.
- `BASE_URL` - live deployment URL, for example `https://myapp.com`
- `EMAIL` - login email or username
- `PASSWORD` - login password

Optional:
- `TEMPLATE_SOURCE` - template folder, file, or ZIP/archive
- `APP_NAME` - display name, default: infer from project
- `COMPANY` - company name, default: blank
- `SCOPE` - default: `entire-app`. Use `single-route` only when the user explicitly asks to document just the provided route.
- `MUTATIONS_ALLOWED` - default: `true`. When `true`, the agent may create/edit/delete records **it owns** per the Dummy Data Lifecycle below. When `false`, the agent never mutates anything (list/detail screenshots only — Create/Edit/Delete chapters fall back to "feature available; not captured in this revision").
- `DUMMY_DATA_NOTES` - free-text intake the user can use to constrain naming (e.g. "use English company names", "avoid the word Test", "use vendor names from the seed list").

Template rule:
- If `TEMPLATE_SOURCE` is provided, use it.
- If it is blank, use this skill's bundled fallback template at `template/`.
- If a ZIP/archive is provided, unpack it and normalize it into the same working shape.

Derive `APP_SLUG` by lowercasing and hyphenating `APP_NAME`. Name outputs `docs/user-guide-<APP_SLUG>.tex` and `docs/user-guide-<APP_SLUG>.pdf`.

## Scope Rule (Non-Negotiable)

When a user provides a login/auth/start URL plus credentials, assume they want a user guide for the entire authenticated application. Do **not** shrink the guide to the login route just because the URL path is `/auth`, `/login`, `/signin`, `/callback`, or `/select-role`.

Treat the route as:
- the place to begin browser login/capture
- an authentication flow to include in Getting Started
- a source-code anchor for discovering protected routes

Only produce a single-route guide when the user explicitly says one of:
- "only document this route"
- "login flow only"
- "single page guide"
- "document `/x` only"

If the scope is ambiguous, record the assumption in `docs/guide-inventory.md` as: "Scope: entire authenticated app; entry route: <TARGET_ROUTE>." Do not ask a clarifying question unless proceeding would risk using the wrong credentials, role, or production side effects.

## Dummy Data Lifecycle (Non-Negotiable)

CRUD captures use records the **agent created itself**, reused across Create → Edit → Delete, then deleted before reporting done. Mutating any pre-existing record is forbidden. Modifying the target app's source code, config, or repo state is forbidden. `MUTATIONS_ALLOWED=false` disables all mutations and falls back to list/detail screenshots only.

The ledger at `docs/.dummy-data-ledger.json` tracks every creation so cleanup survives `/clear`, compaction, and crashes. `scripts/validate-guide-structure.mjs` enforces a clean ledger as a precompile gate (use `UG_ALLOW_LEDGER_LEAKS=1` for mid-iteration drafts).

Read `references/dummy-data.md` before writing capture scripts or resuming a run.

## Review-Gated Iteration (Default Execution Model)

Do not attempt to complete the whole app in one uninterrupted generation pass unless the user explicitly says to skip checkpoints. The default workflow is:

1. Discover the full app.
2. Produce the full module/user-flow plan and `docs/guide-inventory.md`.
3. Set up the template, metadata, logo, colors, and initial shell sections.
4. Draft and capture exactly one feature module or user flow.
5. Compile or provide a focused review packet for that feature.
6. Ask the user for feedback/approval.
7. Continue to the next feature only after approval.

At the first checkpoint, report:
- the full app module list in intended chapter order
- the numbered user-flow list
- the first feature/user flow selected for drafting
- what screenshots were captured or will be captured
- any access/role limitations discovered

Set `docs/guide-progress.json` feature statuses as `pending`, `drafted`, `reviewed`, `approved`, or `skipped`. Do not mark a feature `approved` yourself just to satisfy validation. Mark it `drafted` after writing/capturing it, then ask the user to approve or request changes.

## Load References

Read these files as needed, not all at once:
- `references/source-discovery.md` before planning content or asking feature-scope questions.
- `references/screenshot-capture.md` before writing or running Playwright capture scripts.
- `references/dummy-data.md` before any Create/Edit/Delete capture, and on resume after `/clear` or compaction.
- `references/section-writing.md` before editing `docs/sections/*.tex` or preparing review packets.
- `references/validation.md` before compiling, self-reviewing, or reporting completion.

Bundled validators:
- `scripts/screenshot-qa.mjs <docs-dir>` checks screenshot dimensions, loading-state metadata, crop categories, and `screenshots/manifest.json`.
- `scripts/validate-guide-structure.mjs <docs-dir>` checks guide structure, stubs, UI macro wrapping, feature review progress, and common LaTeX content failures.
- For draft review packets, run `UG_ALLOW_DRAFT_PROGRESS=1 scripts/validate-guide-structure.mjs <docs-dir>` so `drafted`/`reviewed` features can validate before user approval. For final delivery, omit the flag so only `approved` or `skipped` features pass.

## Workflow

### Step 0 — Resolve the template source
Before doing anything else, determine which template source to use:
1. If the user provided a template path, use that.
2. If the user provided a ZIP/archive, unpack it and use the unpacked template folder.
3. If the user did not answer about the template, use the repo fallback template at `/generate-user-guide-skill/template`.

If the template source is ambiguous, ask for one of these:
- path to the template folder
- path to the ZIP/archive
- file location where the template is stored

### Step 1 — Explore the source / app
Spawn an Explore subagent for full-app discovery. `TARGET_ROUTE` is the entry/start route, not the feature boundary unless `SCOPE=single-route`.

Search all likely routing and module locations, including:
- `app/`, `pages/`, `src/app/`, `src/pages/`
- `src/routing/`, `src/routes/`, `src/router/`
- `src/modules/`, `src/features/`, `src/components/layout/`, `src/components/sidebar/`
- constants, i18n messages, permission guards, menu builders, and route helper files

Return:
- every public route, protected route, dynamic route, redirect route, and error route in the app
- what each page does (list, detail, form, modal, upload, search, etc.)
- navigation structure (sidebar, breadcrumbs, tabs)
- all interactive actions: add, edit, delete, search, filter, upload
- for every form/modal: every field label (the exact label text — used as the inline-screenshot lookup key), input type, required/optional, what it accepts
- forms that change fields based on a type/category selection — list each variant separately
- any domain-specific terms worth defining in a glossary
- anything that commonly confuses new users (for FAQ + troubleshooting)
- the full **module list** of the app — group routes/pages into named feature modules. This list drives the chapter-5+ feature-file split.

Produce a numbered list of user flows AND a numbered list of feature modules before proceeding.

Before writing any feature chapter, create `docs/guide-inventory.md` and `docs/guide-progress.json`. The inventory must include the full app scope assumption, the entry route, all discovered modules, and the intended chapter order. Stop at this checkpoint and ask the user to approve the plan before drafting the first feature unless the user explicitly requested no checkpoints.

---

### Step 2 — Check + install prerequisites

```bash
# Playwright
npx playwright --version 2>/dev/null || echo "MISSING"

# tectonic (always tectonic — never pdflatex/basictex)
which tectonic 2>/dev/null || echo "MISSING"
```

Install missing tools:

```bash
# Playwright
npm install --save-dev playwright @playwright/test
npx playwright install chromium

# tectonic (macOS)
brew install tectonic
```

---

### Step 3 — Set up docs directory

Use the chosen template source, but keep the repo fallback as the default if the user did not provide a different one.

```bash
TEMPLATE_ROOT="${TEMPLATE_SOURCE:-/generate-user-guide-skill/template}"

mkdir -p docs/screenshots
mkdir -p docs/sections
mkdir -p docs/ui/buttons docs/ui/fields docs/ui/menu

# Copy template files (always overwrite to stay on latest template)
cp "$TEMPLATE_ROOT/latex/"*.sty       docs/
cp "$TEMPLATE_ROOT/userguide-example.tex"  docs/user-guide-<APP_SLUG>.tex
cp "$TEMPLATE_ROOT/sections/"*.tex    docs/sections/
cp -R "$TEMPLATE_ROOT/img"             docs/
```

After copy:
- Open `docs/user-guide-<APP_SLUG>.tex` and update the `\input{sections/...}` list so it matches the **full-app module list discovered in Step 1**, not the entry route and not the template's example modules. Remove module file inputs that don't apply, add new ones for modules the example template doesn't cover, and **renumber the trailing chapters (Common Tasks through Appendix) so they continue sequentially after the last feature module**.
- For each new module file, copy one of the existing Insight Doc modules (e.g. `06-versioning.tex` is a good short skeleton — 78 lines, 4 subsections; `05-document-management.tex` is a good long skeleton — 632 lines) and rewrite it for the target app.
- Rename the trailing files to keep numbering contiguous. Examples:
  - 1 feature module → `05-<feature>.tex`, then `06-common-tasks.tex` … `11-appendix.tex` (11 numbered chapters total).
  - 5 feature modules → chapters 5–9, then `10-common-tasks.tex` … `15-appendix.tex` (15 numbered chapters total).
  - 12 feature modules (bundled reference) → chapters 5–16, then `17-common-tasks.tex` … `22-appendix.tex` (22 numbered chapters total).
- The final TOC must have at minimum: Document Control (unnumbered) + Introduction + System Overview + Getting Started + UI Overview + (≥1 feature chapter) + Common Tasks + Troubleshooting + FAQ + Best Practices + Glossary + Appendix.

The LaTeX support files are already in the template. Do not rewrite them for tectonic compatibility — use the template as-is and override only project-specific values.

---

### Step 4 — App theming (logo + colors)

**4a. Logo (MANDATORY — do not skip, do not proceed to Step 4b until complete).** The logo MUST come from the target app's real brand. A pre-compile gate in Step 9 will reject any build where the logo was not extracted. Search in this priority order:
1. The live deployment — open `BASE_URL` in browser, find the brand logo on the public landing page or login page (top-left `<img>` with `alt` containing the app or company name). Download the actual image file via its `src` URL, or take an `element.screenshot()` of the `<img>` element. **Do not screenshot the whole page** — capture only the logo element.
2. The repo's static assets:
   ```bash
   ls public/icon.svg public/logo.svg public/*.svg public/logo.* 2>/dev/null
   ls app/icon.* app/icon-*.* src/assets/logo* 2>/dev/null
   ```
3. Only if 1 and 2 fail, ask the user for a logo file.

Convert SVG → PNG if needed:
```bash
# Linux (rsvg-convert, usually available)
rsvg-convert -w 300 public/icon.svg -o docs/img/original-logo.png
# macOS native
sips -s format png public/icon.svg --out docs/img/original-logo.png
```

**After saving the logo file**, create a sentinel that proves extraction happened:
```bash
echo "extracted from: <SOURCE_URL_OR_PATH>" > docs/.logo-verified
```

Replace both `docs/img/original-logo.png` and `docs/img/white-logo.png` with the target app's logo. For `white-logo.png`, use a white/light version of the logo if available; otherwise copy the same file.

In `docs/sections/00-metadata.tex`, set `\ugLogo{img/original-logo}` (no extension). Also set `\ugCompany`, `\ugAppName`, `\ugAppSubtitle`, `\ugVersion`, `\ugReleaseDate`, and any other metadata commands the template exposes.

**4b. Colors (MANDATORY — do not skip, do not proceed to Step 5 until complete).** Extract the target app's brand colors and generate a customized `userguide-colors.sty` for that app. A pre-compile gate in Step 9 will reject any PDF build that still contains the bundled purple template colors.

**Extract colors from the target app:**
- `app/globals.css` (Next.js / shadcn)
- `app/styles/globals.css`
- `tailwind.config.{js,ts}`
- `src/index.css`
- Live web deployment: open in browser, use DevTools color picker to sample buttons, headers, links

Look for `--primary`, `--secondary`, `--accent`, `--background`, `--border`. Values may be `oklch(...)`, `hsl(...)`, rgb, or hex.

Convert to hex via inline Node.js. Example for oklch:

```bash
node -e "
const { converter, formatHex } = require('culori');
const toHex = s => formatHex(converter('rgb')(s));
console.log('primary:', toHex('oklch(0.65 0.12 110)'));
"
```

If `culori` is not installed: `npm install --no-save culori`. Or hand-roll a converter (OKLCh→sRGB math is <20 lines).

**Generate a NEW `userguide-colors.sty` for the target app** (do NOT use the bundled purple theme template):

1. Copy the template's `template/latex/userguide-colors.sty` as a reference.
2. Override EVERY color variable with the target app's actual brand colors:
   - `ugPrimary` ← main brand color
   - `ugPrimaryDark` ← darker shade (darken primary by 15–25%)
   - `ugSecondary` ← secondary brand or accent color
   - `ugAccent` ← highlight color (often matches secondary)
   - `ugLightBg` ← light tint of primary (lighten by 85–90%)
   - `ugTableHead` ← same as `ugPrimary`
   - `ugCoverGradA` / `ugCoverGradB` ← primary / primary-dark
   - `ugBorder` ← border tint (light tint of primary, or neutral gray)
   - `ugSuccess` ← green for OK/positive states
   - `ugDanger` ← red for error/destructive states
   - `ugWarning` ← amber/orange for warnings
   - `ugInfo` ← blue for informational messages
   - `ugCodeBg` ← very light tint for code blocks (should contrast with text)

3. Keep body text and muted text neutral (do NOT use the app's primary color for body):
   - `ugDarkText` ← near-black (#1A1A2E or app's actual text color)
   - `ugMutedText` ← neutral gray (#6B7B8D or app's muted gray)

4. Save the customized file to `docs/userguide-colors.sty` in the working directory.
5. When building the PDF, `toctonic` will load `docs/userguide-colors.sty` instead of the template version.

**Validate:** The final PDF cover, chapter headers, table headers, buttons, and links should all use the target app's actual brand colors. If the PDF still shows purple or any color from the bundled template, colors were not properly extracted or patched.

**Important page-layout rule:** do not let document control spill into the rest of the guide. The document control section should stand alone, then the next section begins on a new page.

**Important page-layout rule:** do not let document control spill into the rest of the guide. The document control section should stand alone, then the next section begins on a new page.

---

### Step 5 — Capture screenshots with browser/Playwright

Write `scripts/capture-screenshots.mjs` and use real browser captures for every page/state.

**Mutation policy.** Read `references/dummy-data.md` before writing the capture script. On resume after `/clear` or compaction, drain `docs/.dummy-data-ledger.json` (delete leaked records) before capturing anything new.

Rules:
1. Use Chromium/Playwright for the actual screenshot capture. The browser may be driven by the Hermes browser tool or by Playwright in a script, but the final image must come from the live UI.
2. Login: navigate to sign-in route → fill EMAIL/PASSWORD → submit → wait for redirect.
3. For the current review batch, capture only the selected user flow/feature module plus any shared shell screenshots needed to understand it. Do not try to capture every app module in one pass unless the user explicitly approved an all-at-once run.
4. For each user flow:
   - Navigate to the URL (use real IDs from live data — click through to discover them)
   - `await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {})`
   - **Loading-guard rule (non-negotiable — do not screenshot a loading state):** after `networkidle`, explicitly wait for all loading indicators to disappear and real content to appear before capturing. Use this pattern:
     ```js
     // Hide loading spinners / skeletons
     await page.waitForFunction(() => {
       const spinners = document.querySelectorAll(
         '[class*="spinner"], [class*="skeleton"], [class*="loading"], [aria-busy="true"], [data-loading="true"]'
       );
       return [...spinners].every(el => !el.offsetParent);
     }, { timeout: 10000 }).catch(() => {});
     // Then confirm at least one meaningful content element is visible
     // e.g. await page.waitForSelector('table, [role="main"] h1, .card', { state: 'visible', timeout: 10000 }).catch(() => {});
     ```
   - If the page uses a skeleton loader that shares no obvious selector, wait for a known content element instead (a table row, a heading, a card) with `waitForSelector(..., { state: 'visible' })`.
   - Never capture a screenshot if the viewport still shows a blank box, spinning icon, or placeholder skeleton — always verify content is rendered first.
   - **Container-first capture rule (non-negotiable):** capture one container per screenshot — one card, one table, one sidebar block, one modal, or one form section. Never capture a full page just to show a single container.
   - For the sidebar specifically: capture only the sidebar element, not the whole dashboard. The crop should show the sidebar block plus enough header/search/menu context to read it clearly. Center it narrowly in the page.
   - Crop the smallest useful live container. If only one chart/table card is needed, capture only that card.
   - If a page has multiple visible containers (e.g. a dashboard with summary cards, charts, and tables), capture each important container separately and let the PDF explain them in sequence.
   - Do not use annotated browser-vision screenshots in the final document. Red boxes and numbered callouts are for internal analysis only.
   - If browser-vision was used with annotations, recapture the same state cleanly with `annotate: false` or with a browser/Playwright screenshot before saving the file.
   - For modal flows: click trigger → wait 500ms → screenshot → `Escape`.
   - For forms with type variants: open modal, select each type, screenshot each separately.
   - Save to `docs/screenshots/NN-descriptive-name.png` (zero-padded).
   - `console.log` each file saved.
   - **CRUD capture lifecycle.** When `MUTATIONS_ALLOWED=true`, follow the Create → Edit → Delete sequence on agent-owned records and update the ledger at every Create/Delete. Full pattern, helper code, and forbidden-mutation list in `references/dummy-data.md`. When `MUTATIONS_ALLOWED=false`, capture list/detail views only.

When deciding what a container means, read the source code first. Use the component tree, route file, and layout files to identify the real structure and the intended label for each container before writing the explanation. Source code is only for route/structure discovery; it is not a substitute for the browser screenshot.

**Per-screenshot code map (record while capturing).** For every screenshot you save, record a short note tying the file to its source: route path, component file, primary data source (API/DB), key state variables, and any role guard. Save this as `docs/screenshots/_code-map.json` (or markdown) so Step 8 can pull from it instead of re-deriving the mapping. Example entry:
```json
{
  "05-document-list.png": {
    "route": "app/(app)/documents/page.tsx",
    "component": "components/document/DocumentTable.tsx",
    "api": "app/api/documents/route.ts (GET)",
    "fields": ["title", "version", "status", "owner", "updatedAt"],
    "statuses": ["draft", "review", "approved", "archived"],
    "roleGate": "any authenticated user; only Admin sees Delete column"
  }
}
```

Crop helper pattern:
- Prefer `locator.screenshot()` for a single container, button, card, sidebar, or table.
- If you need extra padding around a container, use `locator.boundingBox()` and `page.screenshot({ clip })`.
- Clip a little wider/taller than the element if the screenshot needs context, but keep the crop focused on the required container.
- For dashboards, capture distinct regions separately: sidebar, top bar, summary cards, chart cards, and table cards — each as its own file.
- If a container is partially off-screen, scroll it into view before capturing it.
- Avoid capturing horizontal slivers that cut content (e.g. half a username, half a number). If the natural element bounding box truncates content, expand `clip` to include the full visible row/column.

**PDF width parameters (non-negotiable — these control how large a screenshot renders in the final PDF):**
- Standard container screenshot (card, table, form, modal): `\ugScreenshot{path}{0.85}`
- Sidebar / narrow panel crop: `\ugScreenshot{path}{0.5}`
- Full-width only for genuine full-width UI (e.g. a header bar that spans 100% of the page): `\ugScreenshot{path}{0.95}` — this is the absolute maximum
- **NEVER pass `1.0` or omit the width parameter** — it causes the image to bleed outside the text block
- **NEVER drop a raw `\includegraphics[width=\textwidth]` for a page screenshot** — wrap with `\ugScreenshot` and the correct fraction
- If a chapter has an "overview" screenshot (e.g. Chapter 4 UI Overview), it must still follow the container-first rule and use ≤ 0.85 width — there is no "overview exception"
- Garbled text in the compiled PDF (e.g. `FSdbXXX dklk SfikSlkk`) almost always means a `\ugScreenshot` path points to a PNG that does not exist. If you see garbled text: check the path, verify the file exists in `docs/screenshots/` or `docs/ui/`, fix the path or recapture, then recompile.

Selectors:
- Buttons: `page.getByRole('button', { name: /text/i }).first()`
- Form inputs: `page.getByRole('textbox', { name: /label/i })`
- Shadcn dropdowns: `page.locator('[role="combobox"]').first()` → click → `page.locator('[role="option"]').filter({ hasText: label })`
- Sidebar nav: `page.getByRole('link', { name: /label/i })`

```bash
node scripts/capture-screenshots.mjs
ls docs/screenshots/
```

---

### Step 6 — Capture inline UI element screenshots

For every `\ugButton{X}`, `\ugField{Y}`, `\ugMenu{Z}` planned for the section files, capture the matching live UI element itself with Playwright `element.screenshot()` or a browser-tool screenshot of the live page. Use the exact UI label string from the app so the lookup hits the real control. The final PDF should show the UI control as a screenshot image when capture succeeds, not as styled text.

For `\ugField{Y}` specifically, capture the visible field label together with its input/select/textarea, not the raw input box alone. Prefer the smallest form-field group containing the label and control. If the UI only exposes the input locator, compute a tight union crop from the input bounding box plus `label[for=...]`, a wrapping `<label>`, or the nearest visible label-like text directly above the control.

Prefer tight crops or component-only shots for inline UI references; do not capture a full page just to extract a single label. Do not create synthetic UI assets with PIL, CSS mockups, or text-drawn surrogates.

If a capture fails or the element cannot be isolated cleanly, fall back to the normal styled-text rendering from `\ugButtonOrig`, `\ugFieldOrig`, or `\ugMenuOrig`. Do not invent fake image assets just to preserve the screenshot workflow.

Build a list of every label that will be referenced. Group by type (button / field / menu). Every planned label should have a matching screenshot image when practical, but normal colored-text rendering is the approved fallback when capture is not possible.

Write `scripts/capture-ui-elements.mjs`:

```js
import { chromium } from 'playwright';
import path from 'path';

const slug = s => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

async function saveBtn(page, label) {
  const el = page.getByRole('button', { name: new RegExp(`^${label}$`, 'i') }).first();
  await el.waitFor({ state: 'visible', timeout: 5000 });
  await el.screenshot({ path: `docs/ui/buttons/${slug(label)}.png` });
}
async function saveField(page, label) {
  const el = page.getByLabel(new RegExp(label, 'i')).first();
  await el.waitFor({ state: 'visible', timeout: 5000 });
  const captured = await captureFieldWithLabel(page, el, `docs/ui/fields/${slug(label)}.png`);
  if (!captured) await el.screenshot({ path: `docs/ui/fields/${slug(label)}.png` });
}
async function saveMenu(page, label) {
  const el = page.getByRole('link', { name: new RegExp(`^${label}$`, 'i') }).first();
  await el.waitFor({ state: 'visible', timeout: 5000 });
  await el.screenshot({ path: `docs/ui/menu/${slug(label)}.png` });
}

// Login, then navigate to each context (page / open modal / select variant)
// and call save* for every label visible there.
```

**Important:** the `\ugField{Foo}` lookup uses the exact label string from the source code (e.g. `<FormLabel>Foo</FormLabel>`) — not a paraphrased / user-friendly version. Capture using the same string. If the UI label is `SRS Challenge Count`, the section text should write `\ugField{SRS Challenge Count}`, not `\ugField{Review Count}`.

For dynamic-text buttons (e.g. `Upload N Image(s)` where N changes), do not capture them as text labels. Either capture the exact rendered state you need or omit the reference from the guide.

---

### Step 7 — Generate `docs/ui-overrides.tex`

Emit a LaTeX file that builds `\ifstrequal` lookup chains based on which PNGs exist in `docs/ui/`. This file is loaded automatically by the .sty via `\InputIfFileExists`.

```bash
# Pseudocode — generate in your scripting language of choice:
# For each .png in docs/ui/buttons/:
#   slug = filename without .png
#   label = reverse-map from slug to original label (track during Step 6, or
#           store a labels.json mapping)
# Emit:
#   \renewcommand{\ugButton}[1]{%
#     \ifstrequal{#1}{Add Section}{\ugElemImg{ui/buttons/add-section.png}}{%
#     \ifstrequal{#1}{Add Unit}{\ugElemImg{ui/buttons/add-unit.png}}{%
#     ...
#     \ugButtonOrig{#1}}}...}
#   }
# Same for \ugField (use \ugElemImgField) and \ugMenu (use \ugElemImgMenu).
```

Output structure of `docs/ui-overrides.tex`:

```latex
% Auto-generated by generate-user-guide skill. Do not edit by hand.
\renewcommand{\ugButton}[1]{%
  \ifstrequal{#1}{Add Section}{\ugElemImg{ui/buttons/add-section.png}}{%
  \ifstrequal{#1}{Add Unit}{\ugElemImg{ui/buttons/add-unit.png}}{%
  \ugButtonOrig{#1}}}%
}

\renewcommand{\ugField}[1]{%
  \ifstrequal{#1}{Email}{\ugElemImgField{ui/fields/email.png}}{%
  \ifstrequal{#1}{Password}{\ugElemImgField{ui/fields/password.png}}{%
  \ugFieldOrig{#1}}}%
}

\renewcommand{\ugMenu}[1]{%
  \ifstrequal{#1}{Dashboard}{\ugElemImgMenu{ui/menu/dashboard.png}}{%
  \ugMenuOrig{#1}}%
}
```

The `\ugElemImg*` macros and `\ug*Orig` originals are pre-defined in the .sty. Don't redefine them — just use them.

Only map labels that have real browser-captured PNGs. If a label has no captured screenshot, leave the original `\ugButtonOrig`, `\ugFieldOrig`, or `\ugMenuOrig` rendering in place so the guide still uses the normal colored-text style. Do not invent image assets as a fallback.

---

### Step 8 — Write section files

Replace each skeleton in `docs/sections/` with project-specific content incrementally. Write shared shell sections first (`00`–`04`), then write one feature-module chapter per approved iteration. Use the template's own section-by-section structure as the guide, especially where the template already breaks a section into deeper subtopics.

**Iteration rule (non-negotiable):** in the first implementation pass after discovery, write only the shared chapters plus the first selected feature/user-flow chapter. Leave later feature files as pending only if they are not included in the current compiled review packet, or include a clear planned file list without compiling the final full guide. Do not ship a final PDF that silently omits discovered modules. For final compilation, every discovered module must have a real chapter or be explicitly marked `skipped` with a reason approved by the user.

**Codebase-walk rule (non-negotiable — each feature must be explained from real code, not from the screenshot alone):** before writing any feature-module chapter or container description, read the actual source code for that feature. The screenshot shows surface UI; the code shows behavior, validation, side effects, and edge cases. Without the codebase walk the prose collapses to "this card shows data" filler.

For each feature module / screen / container, locate and read:
- the **route/page file** (`app/<route>/page.tsx`, `pages/<route>.tsx`, `src/app/<route>/`) — entry point, layout, what data it requests
- the **component file(s)** rendered inside — props, state, conditional rendering, empty states, error states
- the **form schema / validation** — Zod / Yup / react-hook-form rules: required fields, min/max, regex, custom validators
- the **API route or server action** invoked on submit / load — `app/api/<x>/route.ts`, `server/<x>.ts`, tRPC procedure, GraphQL resolver
- the **data layer** — Prisma model, SQL query, ORM call — what fields exist, what defaults, what relations
- the **permission / role check** — middleware, `auth()`, RBAC guard — who can see this, who can act
- the **side effects** — emails sent, audit log entries, webhooks fired, notifications triggered, files written
- any **business-rule comments** or constants (`STATUS = ['draft','approved',...]`, `MAX_UPLOAD_SIZE`, retry counts, expiry windows)

For every feature chapter, the prose must reflect what the code actually does:
- list the **exact fields** the form sends, not paraphrased ones
- list the **exact statuses / roles / states** the code defines, not invented ones
- describe the **real outcome** of clicking each button (POST to which endpoint, which DB write, which redirect, which toast)
- describe **error states** the code can produce (validation failures, 401/403/409/422 responses, server errors) and what the user sees for each
- describe **empty states** and loading states the component renders
- describe **permission gates** — what each role can / cannot do on this screen, sourced from the auth check
- describe **side effects** that are not visible in the screenshot (audit log written, email sent, file moved, webhook fired)

When the codebase walk reveals behavior the screenshot cannot show, write a short subsection or `\begin{ugNote}` block explaining it. A feature chapter that only restates what the screenshot shows is a stub — recapture the source-code findings in prose before shipping.

**No-stub rule (non-negotiable):** every section file must ship with real, project-specific content. Do not output a section that contains only a heading, an empty table header, a bullet list of bare terms, or a placeholder note. The previous run of this skill failed because Troubleshooting shipped an empty `ugErrorTable` header, Glossary shipped term names without definitions, and Common Tasks were collapsed to one-line steps. Every section must look as substantive as the corresponding section in the bundled example template.

**Layout rules (non-negotiable):**
- Document control should be a single page, followed by a new page for the rest of the guide.
- Keep the same broad chapter order as the template.
- The TOC of the final PDF must mirror the chosen `userguide-example.tex` `\input{}` order. Do not let any section silently drop because its file is empty.
- For chapters 5+, list one chapter entry per major feature module of the target app, numbered sequentially. **Never collapse multiple modules into a generic single chapter** — even a small app with 2–3 features must split each into its own `NN-<feature>.tex` file. The reference PDF demonstrates this pattern with 12 separate feature chapters (5: Document Management, 6: Versioning, 7: Approval Workflow, 8: Document Preview, 9: Secure Download, 10: Share Links, 11: Access Control, 12: Audit & Analytics, 13: Dashboard Analytics, 14: AI Intelligence, 15: Master Data, 16: Lifecycle Management).
- If a chapter has multiple major subsections, keep the chapter title at the top of its new page and let the subsections continue below it.
- Preserve the template's deeper subdivision pattern when the content naturally fits it.

**Language rules (non-negotiable):**
- Plain English or formal Indonesian, depending on the project/user request
- No jargon unless the app itself uses that term in the UI
- Avoid internal field names when a user-facing label exists
- "pop-up window" not "modal/dialog"
- "three-dot button (…)" not "actions menu"
- Second person ("you", "your") throughout
- Short sentences, active voice
- Field descriptions: say what user should type, not what system stores
- Container descriptions must answer **what the user sees, what it means, and what to do with it** — never a generic "this card shows data" sentence. Borrow the example template's pattern: Purpose → What the code/UI does → What it means → Step-by-step usage → Expected result.

**Inline UI element rule:** when referencing a button / field / menu item, use the exact UI label string so the override lookup hits. `\ugButton{Save Section}` not `\ugButton{Save}`. If the actual UI label is awkward (e.g. `SRS Challenge Count`), use it as-is — the inline screenshot is the user's anchor; matching prose can describe it more naturally around the inline reference.

**Template command reference:**

| Need | Command |
|------|---------|
| Screenshot | `\ugScreenshot[0.9]{screenshots/NN-name.png}{Plain caption}` |
| Numbered steps | `\begin{ugSteps} \item ... \end{ugSteps}` |
| Info box | `\begin{ugNote}[Optional Title] ... \end{ugNote}` |
| Tip | `\begin{ugTip} ... \end{ugTip}` |
| Warning | `\begin{ugWarning} ... \end{ugWarning}` |
| Button ref | `\ugButton{Save Section}` |
| Field ref | `\ugField{Email}` |
| Menu path | `\ugMenu{Documents > Document List}` |
| Keyboard key | `\ugKey{Esc}` |
| Role pill | `\ugRole{Admin}` |
| Status pill | `\ugStatus{ugWarning}{Review}` |
| Feature module | `\begin{ugModule}{Module Name} ... \end{ugModule}` |
| Step-by-step task | `\begin{ugTask}{Task Title} ... \end{ugTask}` |
| FAQ entry | `\ugFAQ{Question?}{Answer.}` |
| Glossary entry | `\ugGlossaryEntry{Term}{Definition.}` |
| Error table | `\begin{ugErrorTable} \ugError{msg}{cause}{fix} \end{ugErrorTable}` |
| Best practice | `\begin{ugBestPractice}[Title] ... \end{ugBestPractice}` |

**Note on `\ugScreenshot`:** the width argument is just the multiplier (`0.9`, not `0.9\textwidth`). The macro multiplies internally. For step-by-step screenshots, use smaller crops when the step is about a single control or button, and use wider shots when the user needs to understand layout or context.

**Note on `\ugBestPractice`:** the title goes in **square brackets** as an optional argument: `\begin{ugBestPractice}[Use the correct role]`. Do not put the title inside the body or as a `{}` argument — that produces the broken "Use the correct role Always choose…" run-on layout.

**Note on `\ugFAQ`:** both the question and the answer are required. Always include a real, multi-sentence answer. Do not ship `\ugFAQ{Question}{}`.

**Note on `\ugGlossaryEntry`:** every entry needs a definition body. A bare term name is not a glossary entry — replace `\ugGlossaryEntry{SSO}{}` with `\ugGlossaryEntry{SSO}{Single Sign-On — a centralized login flow that lets one credential authenticate across multiple applications.}`.

**Note on `\ugErrorTable`:** every Troubleshooting section must contain at least three real `\ugError{message}{cause}{fix}` rows scoped to the target app. An empty `ugErrorTable` with only a header row is not acceptable output.

**Section guidelines** — keep the template's richer section-by-section shape:

- `00-metadata.tex` — fill app name, subtitle, version, company, classification, tagline, logo, and cover image fields with the **target app's** values (not the example template's defaults).
- `00-document-control.tex` — unnumbered preamble chapter (rendered before the TOC). One revision-history table and one approvals table. Single page only.
- `01-introduction.tex` — purpose, problem statement, scope, intended audience, prerequisites, document conventions, how to use the guide, related documents, support channels. Multi-paragraph; not a stub.
- `02-system-overview.tex` — what the system does, business objectives, key capabilities, system architecture, infrastructure components, user roles, security architecture, lifecycle, functional module map, data model, integration points, deployment model.
- `03-getting-started.tex` — system requirements, accessing the application, first login, understanding your role, dashboard overview, language switch, logout/session, first-time navigation, browser tips. Use a `ugSteps` block when a flow has 4+ steps.
- `04-ui-overview.tex` — main layout, sidebar navigation, common UI elements, status badges, modal dialogs, data grid operations, search syntax, keyboard shortcuts, accessibility.
  - For the sidebar: write a short explanatory sentence and place one centered, narrow live crop of the sidebar or menu container. Never use a full-page dashboard screenshot to "show" the sidebar.
  - The crop should show only the sidebar block and enough header/search/menu context to read it clearly.
  - Use `tabularx` tables when describing region-by-region or menu-by-menu structure (see the bundled example for layout).
- `05-<feature>.tex` … `NN-<feature>.tex` — one file per major feature module of the target app, numbered sequentially. Match the depth of the bundled `05-document-management.tex` (long, 632 lines, multiple subsections, multiple tabularx tables, business rules block) for complex modules; match `06-versioning.tex` (short, 78 lines, 4 subsections: Key Functions / Step-by-Step / Information Recorded / Business Rules) for simple modules. Each module file should include:
  - `\begin{ugModule}{Overview}` block with **Purpose** and **Who Can Access** (`\ugRole{...}` pills).
  - One or more `\subsection{}` blocks per page/screen inside the module — give every module at minimum 3 subsections.
  - For data grids: a `tabularx` columns table with `\textbf{Column} / \textbf{Sortable} / \textbf{Description}` and one row per real column.
  - For forms: a `tabularx` field table with `\ugField{Label} / Input type / Required / Description`.
  - For container/card-based screens: a `\begin{ugModule}` or labeled subsection per container, each with **Purpose**, **What the code does**, **What it means**, **Step-by-step usage**, and **Expected result** — matching the depth of the reference PDF.
  - One screenshot per container/state, captioned plainly.
  - A final **Business Rules** subsection with bulleted constraints, validation, and access rules — every module file in the bundled example has one.
  - Business rules / tips / warnings in `\begin{ugNote}` / `\begin{ugTip}` / `\begin{ugWarning}` blocks.
- `<N+1>-common-tasks.tex` (`17-common-tasks.tex` in the bundled 12-module reference) — 3–6 `\begin{ugTask}{Task Title}` blocks. Each task must contain `\textbf{Objective:}`, `\begin{ugSteps} ... \end{ugSteps}`, and `\textbf{Expected Outcome:}` (or `\textbf{Tip:}` where appropriate). Use `\ugButton`/`\ugField`/`\ugMenu` references inside the steps. Do not collapse a multi-step task into a one-line "Click X" instruction.
- `<N+2>-troubleshooting.tex` (`18-troubleshooting.tex` in the reference) — `\begin{ugErrorTable}` with at least three `\ugError{message}{cause}{fix}` rows tied to real failure modes the user is likely to hit (failed login, missing role, empty dashboard, permission denied, etc.).
- `<N+3>-faq.tex` (`19-faq.tex` in the reference) — at minimum five `\ugFAQ{question}{multi-sentence answer}` entries derived from non-obvious behaviour discovered in Step 1. No empty answers.
- `<N+4>-best-practices.tex` (`20-best-practices.tex` in the reference) — 3–6 `\begin{ugBestPractice}[Title]` boxes, each with a bulleted list (`itemize`) of concrete practices. Title belongs in `[brackets]`, not inside the body.
- `<N+5>-glossary.tex` (`21-glossary.tex` in the reference) — `\ugGlossaryEntry{Term}{Definition.}` per domain-specific term. Every term must have a real definition sentence. Cover at minimum: every role name, every status label, the auth method (SSO/OAuth/etc.), and any UI noun the guide uses (Dashboard, Container, Module, Workspace, etc.).
- `<N+6>-appendix.tex` (`22-appendix.tex` in the reference) — keyboard shortcuts, reference tables (status codes, transition rules, roles & permissions matrix, default config, supported browsers, tech stack, contact info). Include the live `BASE_URL`, support contact, and any environment-specific URLs.

---

### Step 9 — Compile PDF

**BLOCKING PRE-COMPILE CHECK — run this before xelatex/tectonic. Do NOT skip.**

```bash
# Gate 1: logo must have been extracted (sentinel file created in Step 4a)
if [ ! -f docs/.logo-verified ]; then
  echo "ERROR: docs/.logo-verified not found."
  echo "Go back to Step 4a: extract the target app's logo from the live web, save to docs/img/original-logo.png, then create docs/.logo-verified."
  exit 1
fi
echo "OK: logo extracted ($(cat docs/.logo-verified))"

# Gate 2: colors must have been extracted (bundled purple template not present)
if grep -q "4A148C\|Purple Theme\|ugPrimary.*Deep purple" docs/userguide-colors.sty 2>/dev/null; then
  echo "ERROR: userguide-colors.sty still contains bundled template colors (purple #4A148C)."
  echo "Go back to Step 4b: extract the target app's brand colors from the live web and rewrite docs/userguide-colors.sty before compiling."
  exit 1
fi
echo "OK: colors customized."

# Gate 3: all PNG files referenced in section .tex files must exist
MISSING=0
for TEX_FILE in docs/sections/*.tex; do
  while IFS= read -r match; do
    PNG_PATH="docs/${match}"
    if [ ! -f "$PNG_PATH" ]; then
      echo "ERROR: missing image: $PNG_PATH (referenced in $TEX_FILE)"
      MISSING=$((MISSING + 1))
    fi
  done < <(grep -oP '(?<=\\ugScreenshot\{)[^}]+' "$TEX_FILE" 2>/dev/null)
  while IFS= read -r match; do
    PNG_PATH="docs/${match}"
    if [ ! -f "$PNG_PATH" ]; then
      echo "ERROR: missing image: $PNG_PATH (referenced in $TEX_FILE)"
      MISSING=$((MISSING + 1))
    fi
  done < <(grep -oP '(?<=\\includegraphics(\[[^\]]*\])?\{)[^}]+' "$TEX_FILE" 2>/dev/null)
done
if [ "$MISSING" -gt 0 ]; then
  echo "ERROR: $MISSING missing PNG file(s). Fix paths or recapture before compiling. Missing images produce garbled text in the PDF."
  exit 1
fi
echo "OK: all referenced images exist."
```

Gate 4 (dummy-data ledger drained) is enforced by `scripts/validate-guide-structure.mjs`. Set `UG_ALLOW_LEDGER_LEAKS=1` to bypass during mid-iteration draft compiles.

If any check fails: stop, complete the failing step, re-run all checks, then compile.

```bash
cd docs && tectonic user-guide-<APP_SLUG>.tex
# Output: docs/user-guide-<APP_SLUG>.pdf
```

If errors:
```bash
cd docs && tectonic --print user-guide-<APP_SLUG>.tex 2>&1 | grep -i "error\|not found"
```

If you see Overfull `\hbox` warnings near `\ugField` in tables: the field PNG is wider than the column allows. If your tables use narrower columns, either widen them or reduce the inline image width in the template macros.

Common errors and fixes:
- `File '...' not found` for an inline UI image → the PNG slug doesn't match the `\ifstrequal` key in `ui-overrides.tex`. Re-check spelling (case-sensitive label, slug must be lowercase-hyphenated).
- `\ugScreenshot` argument mismatch → the macro multiplies by `\textwidth` internally; pass `0.9` not `0.9\textwidth`.
- `Missing \begin{document}` in a section file → the section was overwritten with a non-LaTeX placeholder. Replace with real LaTeX content.
- TOC entries missing → a corresponding `\input{sections/NN-...}` line is missing from `user-guide-<APP_SLUG>.tex`, or the file exists but has no `\section{}` heading.

---

### Step 10 — Self-review before reporting

Before declaring success, open the compiled PDF (or grep the section files) and verify all of the following:

- [ ] `docs/.logo-verified` exists and contains a real source URL or file path (not the template default).
- [ ] The cover logo is the **target app's brand**, not the bundled template's example logo. Open the PDF cover and compare the logo visually against the live web app's top-left logo.
- [ ] All colors match the target app's actual web colors (primary, secondary, accent), not the bundled purple template. Check: cover gradient, chapter headers, table headers, button styles, sidebar backgrounds, link colors, and callout boxes. Every color element should reference the app's brand, not the template's default.
- [ ] The TOC lists section 6 as multiple `06-XX` sub-modules — **one chapter per feature module, never collapsed**.
- [ ] Total chapter count in TOC ≥ 12 (Doc Control + Intro + System + Getting Started + UI + at least one feature module + Common Tasks + Troubleshooting + FAQ + Best Practices + Glossary + Appendix).
- [ ] Every feature-module `.tex` file (chapters 5+) ends with a **Business Rules** subsection.
- [ ] No bundled "Insight Doc" / "SOP" / "Sinergi Dimensi Informatika" / "Keycloak" / "MinIO" / "Qdrant" string remains in any section file (those are the bundled reference's content; a generated guide must replace them with the target app's terms).
- [ ] No section is empty or stub-only.
- [ ] Troubleshooting has ≥3 real `\ugError` rows.
- [ ] FAQ has ≥5 real `\ugFAQ` entries with multi-sentence answers.
- [ ] Glossary has a definition body for every entry.
- [ ] Best Practices uses `\begin{ugBestPractice}[Title]` with the title in brackets.
- [ ] Sidebar screenshots are narrow centered crops (`\ugScreenshot{...}{0.5}`), not full-page dashboards.
- [ ] No screenshot uses width > 0.95 (never `1.0` or `\textwidth` directly). Check every `\ugScreenshot` call and every `\includegraphics` in section files.
- [ ] No garbled text (e.g. `FSdb...` letter-scramble) visible in any page. If found: the `\ugScreenshot` path at that location points to a PNG that does not exist — fix the path or recapture, then recompile.
- [ ] Each dashboard container is captured separately and explained with Purpose / What it means / Step-by-step / Expected result, not a generic "this card shows data" sentence.
- [ ] Every inline `\ugButton`, `\ugField`, `\ugMenu` uses the exact UI label string from the source code.
- [ ] Dummy-data and codebase-mutation checks pass — see `references/validation.md` self-review section.

If any check fails, fix the underlying file and recompile. Do not ship a guide with known stub sections.

---

### Step 11 — Report

```bash
ls -lh docs/user-guide-<APP_SLUG>.pdf
ls docs/screenshots/ | wc -l
ls docs/ui/buttons docs/ui/fields docs/ui/menu | wc -l
```

Report:
- Path to PDF
- Sections included (with the full `06-XX` sub-module list)
- Page-screenshot count
- UI-element count (buttons / fields / menu)
- Any flows that could not be captured and why
- Any inline UI labels that fell through to text-only rendering (no PNG captured)
- Confirmation that all Step 10 self-review checks passed
