---
name: generate-user-guide
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
- `TARGET_ROLE` - role this guide is written for (e.g. `super-admin`, `admin`, `manager`, `operator`, `viewer`). Default: ask the user after Step 1 role discovery. The selected role drives which routes, modules, actions, and UI elements appear in the guide. One PDF per role — re-run for additional roles.
- `MUTATIONS_ALLOWED` - default: `true`. When `true`, the agent may create/edit/delete records **it owns** per the Dummy Data Lifecycle below. When `false`, the agent never mutates anything (list/detail screenshots only — Create/Edit/Delete chapters fall back to "feature available; not captured in this revision").
- `DUMMY_DATA_NOTES` - free-text intake the user can use to constrain naming (e.g. "use English company names", "avoid the word Test", "use vendor names from the seed list").

Template rule:
- If `TEMPLATE_SOURCE` is provided, use it.
- If it is blank, use this skill's bundled fallback template at `template/`.
- If a ZIP/archive is provided, unpack it and normalize it into the same working shape.

Derive `APP_SLUG` by lowercasing and hyphenating `APP_NAME`. Derive `ROLE_SLUG` by lowercasing and hyphenating `TARGET_ROLE`. Name outputs `docs/user-guide-<APP_SLUG>-<ROLE_SLUG>.tex` and `docs/user-guide-<APP_SLUG>-<ROLE_SLUG>.pdf`. If the app has only one role (no role gates found), omit `-<ROLE_SLUG>` and fall back to `docs/user-guide-<APP_SLUG>.{tex,pdf}`.

## Role-Based Scoping (Non-Negotiable)

This skill produces **one PDF per role**. Most target apps gate routes, sidebar entries, actions, and form fields by role (Super Admin, Admin, Manager, Operator, Viewer, etc.). The same app shown to a Super Admin and to a Viewer is effectively two different products — collapsing them into one manual produces a guide that is wrong for every reader.

Workflow:

1. During Step 1 discovery, enumerate **every role** the codebase defines (auth guards, RBAC tables, middleware, permission constants, role-gated sidebar items, role-gated actions/fields). Record each role's accessible routes, modules, sidebar items, action buttons, and form fields.
2. After Step 1, present the role list to the user and **ask which role this PDF is for**. Do not skip this question. Use the live web's role-selection screen (e.g. `/select-role`) as a cross-check that the discovered list is complete.
3. Once `TARGET_ROLE` is chosen, scope every later step to that role:
   - Login as a user with `TARGET_ROLE` for capture.
   - Only document routes/modules the role can reach.
   - Only document actions the role can perform on each screen.
   - Mark gated-out features as out-of-scope in the inventory (do not silently omit them; record "not visible to <role>").
   - The cover page, Getting Started, and System Overview must say which role the guide is for.
4. To produce a guide for another role, re-run the skill with a different `TARGET_ROLE`. Each run produces its own PDF.

If the app has no role gates (single-role app), set `TARGET_ROLE=default` and skip the role question. Note this assumption in `docs/guide-inventory.md`.

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
- `bash scripts/precompile-gates.sh` runs the three blocking pre-compile gates (logo extracted, colors customized, every referenced PNG exists). Run from the project working directory before xelatex/tectonic — see Step 9.
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
- the full **role list** of the app — every role/permission identifier defined in code (RBAC tables, auth middleware, permission constants, role enums, role-gated sidebar/menu builders, `if (role === ...)` checks). For each role, record: display name, internal identifier, accessible routes, accessible sidebar/menu entries, role-gated actions (e.g. only Admin sees Delete), role-gated fields (e.g. only Super Admin sees `internalNotes`).

Produce a numbered list of user flows, a numbered list of feature modules, AND a numbered list of roles (with per-role scope) before proceeding.

**Role-selection checkpoint (mandatory before drafting).** After producing the role list, stop and ask the user which role this PDF is for. Present the discovered roles as choices. Wait for the answer before continuing. Do not pick a role yourself unless the app has only one role. Once chosen, store `TARGET_ROLE` and `ROLE_SLUG`, and from this point forward filter every list (routes, modules, sidebar items, actions, fields) to what `TARGET_ROLE` can see/do.

Before writing any feature chapter, create `docs/guide-inventory.md` and `docs/guide-progress.json`. The inventory must include the full app scope assumption, the entry route, **the selected `TARGET_ROLE` and the per-role scope (routes/modules/actions visible to that role, plus what is gated out)**, all discovered modules in scope, and the intended chapter order. Stop at this checkpoint and ask the user to approve the plan before drafting the first feature unless the user explicitly requested no checkpoints.

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
- Read `docs/MANIFEST.yaml` (copied from `template/MANIFEST.yaml`). It lists the section types this template ships and their order. Treat MANIFEST as the contract — never invent filenames not declared there.
- Replace every `feature-module` entry in MANIFEST `sections[]` with one entry per **real feature module discovered in Step 1** for the target app. Keep `type: feature-module` (and pick `depth: complex` or `depth: simple` per module size). Drop the bundled reference's feature filenames; pick filenames from the target app's real module names.
- Update `docs/user-guide-<APP_SLUG>.tex` so its `\input{sections/...}` list matches MANIFEST `sections[]` exactly, in order. Renumber the trailing non-feature chapters (the `common-tasks`, `troubleshooting`, `faq`, `best-practices`, `glossary`, `appendix` types — or whatever non-feature types MANIFEST currently lists) so numbering stays contiguous after the last feature module.
- Rename the actual `.tex` files in `docs/sections/` to match the new MANIFEST entries. Examples (illustrating the *contiguous-numbering principle* — actual filenames come from MANIFEST + the target app's feature names):
  - 1 feature module → 1 feature file numbered `05-…`, then trailing chapters `06-` through `11-` (≈11 numbered chapters total, depending on which non-feature types MANIFEST ships).
  - 5 feature modules → chapters 5–9, then trailing chapters resume at `10-`.
  - 12 feature modules (bundled reference) → chapters 5–16, then trailing chapters resume at `17-`.
- For each new feature `.tex` file, copy a **same-`depth` skeleton from `template/sections/`** (a `complex` feature-module file in the bundled template for big modules, a `simple` one for small modules) and rewrite it for the target app.
- The final TOC must contain every section type MANIFEST declares — never silently drop one because its file ended up empty.

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

Replace each skeleton in `docs/sections/` with project-specific content incrementally. Write shared shell sections first (the metadata / document-control / introduction / system-overview / getting-started / ui-overview chapters), then write one feature-module chapter per approved iteration.

**Read `references/section-writing.md` before drafting any section.** It is the operational reference for: language rules, UI macro rules, full template-macro reference (`\ugButton`, `\ugField`, `\ugScreenshot`, `\ugTask`, `\ugBestPractice`, `\ugFAQ`, `\ugErrorTable`, `\ugGlossaryEntry` etc.) including the macro-specific gotchas (e.g. `\ugBestPractice[title-in-brackets]`, `\ugScreenshot` width is a multiplier not `\textwidth`), the **codebase-walk rule** (read the route/page/component/schema/API/data-layer/permission/side-effects code before describing any feature), the no-stub gate, and the per-type quick reference.

**Section structure is driven by `template/MANIFEST.yaml`, NOT by hard-coded filenames.** MANIFEST defines, for the template currently checked out:

1. `sections[]` — the ordered chapter list, each entry tagged with a `type:` (`metadata`, `feature-module`, `troubleshooting`, etc.).
2. `section_types{}` — the abstract content/quality contract per type (`must_contain`, `forbidden`, `depth_targets`, layout rules).

How to use it (every run):

1. Open `template/MANIFEST.yaml`. This is the contract for the template snapshot in use.
2. For each entry in `sections[]`, populate the named `<file>.tex` by applying the rules of its declared `type` from `section_types{}`. Do not invent extra files. Do not skip files. Do not reorder.
3. The `\input{}` order in `userguide-example.tex` must mirror `sections[]` exactly.
4. For repeatable types (notably `feature-module`), replace MANIFEST's reference entries with one `feature-module` entry per real feature module of the target app — keep the type, swap filenames and order. Never collapse multiple modules into a single chapter.
5. If a section type referenced by `sections[]` is not defined in `section_types{}`, halt and surface the gap rather than guessing.

**Iteration rule (non-negotiable):** in the first implementation pass after discovery, write only the shared chapters plus the first selected feature/user-flow chapter. Leave later feature files as pending only if they are not included in the current compiled review packet, or include a clear planned file list without compiling the final full guide. Do not ship a final PDF that silently omits discovered modules. For final compilation, every discovered module must have a real chapter or be explicitly marked `skipped` with a reason approved by the user.

**TOC integrity (non-negotiable):** the TOC of the final PDF must mirror MANIFEST `sections[]` exactly. Do not let any section silently drop because its file ended up empty. Document control is a single page, followed by a new page for the rest of the guide.

**If you find yourself writing a filename without first reading it from MANIFEST, stop.** Reference-template filenames like `05-document-management.tex` or `17-common-tasks.tex` are artifacts of the bundled DMS example. The target app's chapters get whatever filenames MANIFEST and the live feature inventory dictate.

---

### Step 9 — Compile PDF

**BLOCKING PRE-COMPILE CHECK — run this before xelatex/tectonic. Do NOT skip.**

```bash
bash scripts/precompile-gates.sh
```

This runs three gates: logo extracted (`docs/.logo-verified` sentinel), colors customized (no bundled template purple in `docs/userguide-colors.sty`), and every PNG referenced by `\ugScreenshot{...}` / `\includegraphics{...}` in `docs/sections/*.tex` actually exists. The script exits non-zero with a remediation hint on the first failing gate.

Gate 4 (dummy-data ledger drained) is enforced separately by `scripts/validate-guide-structure.mjs`. Set `UG_ALLOW_LEDGER_LEAKS=1` to bypass during mid-iteration draft compiles.

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
