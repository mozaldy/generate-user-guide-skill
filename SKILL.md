# generate-user-guide

## When to use
Invoke when user asks to generate a user guide, user manual, or documentation PDF for a web app.
Also invoke on `/generate-user-guide`.

Do NOT invoke for: API docs, code docs, README files, or developer-facing docs.

---

## Arguments

Use this intake order. Ask only for missing items.

Required from user:
- `TARGET_ROUTE` — section of the app to document, for example `/admin`
- `BASE_URL` — live deployment URL, for example `https://myapp.com`
- `EMAIL` — login email
- `PASSWORD` — login password

Template input:
- `TEMPLATE_SOURCE` — template folder, template file, or ZIP/archive path

Optional:
- `APP_NAME` — display name for the app, default: infer from project
- `COMPANY` — company name, default: blank

Template rule:
- If the user gives `TEMPLATE_SOURCE`, use it.
- If the user does not answer about the template, use the bundled fallback template at `/home/ubuntu/generate-user-guide-skill/template`.
- If the user asks where the template is stored and gives no other location, answer with the fallback path and proceed with that source.

Derive `APP_SLUG` by lowercasing and hyphenating `APP_NAME` (for example, `Adibasa` → `adibasa`).
The working `.tex` and final `.pdf` are both named `user-guide-<APP_SLUG>`.

Copy-ready intake prompt:
- Target route:
- Base URL:
- Email:
- Password:
- Template source: (optional; if blank, use the bundled fallback)
- App name: (optional)
- Company: (optional)

---

## Template location

Default fallback template for this skill repo:

```text
/home/ubuntu/generate-user-guide-skill/template/
```

Supported template sources:
- a template directory containing `userguide.sty`, `userguide-example.tex`, and `sections/`
- a ZIP/archive that can be unpacked into a template directory
- a template bundle file or folder the user points to explicitly

Canonical template contents to mirror:
- `userguide.sty`
- `userguide-example.tex`
- `sections/00-metadata.tex`
- `sections/01-document-control.tex`
- `sections/02-introduction.tex`
- `sections/03-system-overview.tex`
- `sections/04-getting-started.tex`
- `sections/05-ui-overview.tex`
- `sections/06-core-features.tex`
- `sections/07-common-tasks.tex`
- `sections/08-troubleshooting.tex`
- `sections/09-faq.tex`
- `sections/10-best-practices.tex`
- `sections/11-glossary.tex`
- `sections/12-appendix.tex`
- `images/` — screenshot and icon assets
- `build/` — compiled output directory
- `build.ps1` / `build.bat` — wrappers if present in the template

Important template conventions:
- all section files use `«...»` placeholder syntax and every placeholder must be replaced
- `06-core-features.tex` is the most important section and should be expanded for every major feature module
- every user-facing step should include a screenshot reference or `\ugScreenshotPlaceholder`
- button and icon references should use the template's inline commands such as `\ugButton{...}`, `\ugButtonIcon{...}`, `\ugIconRef{...}` when available
- the template's structure and section order are the source of truth; do not invent a different hierarchy unless the user explicitly asks for one

The bundled `userguide.sty` should already include tectonic-safe adjustments, such as:
- Unicode stubs instead of FontAwesome5 OTF loads
- `\let\@ugLogoPath\empty` and `\let\@ugCoverImagePath\empty`
- inline image macros for buttons / fields / menus
- `\InputIfFileExists{ui-overrides.tex}{}{}` for project-specific overrides

If the user supplies a ZIP template, normalize it into the skill workspace shape rather than inventing a new file hierarchy. The conversion rule is:
- keep the ZIP’s section ordering and placeholder content as the source of truth
- mirror it into the skill workspace under the expected Hermes layout
- preserve the repo’s LaTeX semantics, but adapt file placement so the skill can operate consistently
- if the user asks for a different structure, change only the final PDF’s section organization, not the underlying template source format

Do not patch `userguide.sty` for tectonic compatibility during each project. Keep the template stable and override only project-specific values.

---

## Workflow

### Step 0 — Resolve the template source
Before doing anything else, determine which template source to use:
1. If the user provided a template path, use that.
2. If the user provided a ZIP/archive, unpack it and use the unpacked template folder.
3. If the user did not answer about the template, use the repo fallback template at `/home/ubuntu/generate-user-guide-skill/template`.

If the template source is ambiguous, ask for one of these:
- path to the template folder
- path to the ZIP/archive
- file location where the template is stored

### Step 1 — Explore the source / app
Spawn an Explore subagent targeting `TARGET_ROUTE`. Search in `app/`, `pages/`, `src/app/`, `src/pages/`.

Return:
- every route/page under the target
- what each page does (list, detail, form, modal, upload, search, etc.)
- navigation structure (sidebar, breadcrumbs, tabs)
- all interactive actions: add, edit, delete, search, filter, upload
- for every form/modal: every field label (the exact label text — used as the inline-screenshot lookup key), input type, required/optional, what it accepts
- forms that change fields based on a type/category selection — list each variant separately
- any domain-specific terms worth defining in a glossary
- anything that commonly confuses new users (for FAQ + troubleshooting)

Produce a numbered list of user flows before proceeding.

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
TEMPLATE_ROOT="${TEMPLATE_SOURCE:-/home/ubuntu/generate-user-guide-skill/template}"

mkdir -p docs/screenshots
mkdir -p docs/sections
mkdir -p docs/ui/buttons docs/ui/fields docs/ui/menu

# Copy template files (always overwrite to stay on latest template)
cp "$TEMPLATE_ROOT/userguide.sty"          docs/userguide.sty
cp "$TEMPLATE_ROOT/userguide-example.tex"  docs/user-guide-<APP_SLUG>.tex
cp "$TEMPLATE_ROOT/sections/"*.tex         docs/sections/
```

The .sty is already patched. Do not edit it for tectonic compatibility — that work is done.

---

### Step 4 — App theming (logo + colors)

**4a. Logo.** Find the app logo:

```bash
# Common locations
ls public/icon.svg public/logo.svg public/*.svg 2>/dev/null
ls app/icon.* app/icon-*.* 2>/dev/null
```

Convert SVG → PNG (macOS native, no extra deps):
```bash
sips -s format png public/icon.svg --out docs/logo.png
# Or for high-res: render at larger dimensions first
```

In `docs/sections/00-metadata.tex`, set `\ugLogo{logo}` (no extension; LaTeX adds it).

**4b. Colors.** Read the app's CSS variables. Locations to try:
- `app/globals.css` (Next.js / shadcn)
- `app/styles/globals.css`
- `tailwind.config.{js,ts}`
- `src/index.css`

Look for `--primary`, `--secondary`, `--accent`, `--background`, `--border`. Values may be `oklch(...)`, `hsl(...)`, or hex.

Convert to hex via inline Node.js. Example for oklch:

```bash
node -e "
const { converter, formatHex } = require('culori');
const toHex = s => formatHex(converter('rgb')(s));
console.log('primary:', toHex('oklch(0.65 0.12 110)'));
"
```

If `culori` is not installed: `npm install --no-save culori`. Or hand-roll a converter (the OKLCh→sRGB math is short).

Patch `docs/userguide.sty` color block — overwrite these variables with the target app's brand colors:
- `ugPrimary` ← main brand color from the web app
- `ugPrimaryDark` ← darker shade of the same brand color
- `ugSecondary` ← secondary brand or accent color
- `ugLightBg` ← light tint of the primary color
- `ugTableHead` ← same as `ugPrimary` or slightly darker
- `ugCoverGradA` / `ugCoverGradB` ← primary / primary-dark
- `ugBorder` ← border tint that matches the app

Keep body text neutral:
- `ugDarkText` remains near-black
- `ugMutedText` remains neutral gray

**Important page-layout rule:** do not let document control spill into the rest of the guide. The document control section should stand alone, then the next section begins on a new page.

---

### Step 5 — Capture screenshots by container / component

Write `scripts/capture-screenshots.mjs`:

1. Headless Chromium at 1440×900
2. Login: navigate to sign-in route → fill EMAIL/PASSWORD → submit → wait for redirect
3. For each user flow:
   - Navigate to the URL (use real IDs from live data — click through to discover them)
   - `await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {})`
   - Prefer container-sized captures: one card, one table, one sidebar block, one modal, or one form section per screenshot
   - Avoid one huge full-page capture if it will make the document tall, cramped, or hard to read
   - If a page has multiple visible containers, capture each important container separately and let the PDF explain them in sequence
   - Do not add red annotation boxes to the final screenshots unless the user explicitly asks for annotated UI review images
   - For modal flows: click trigger → wait 500ms → screenshot → `Escape`
   - For forms with type variants: open modal, select each type, screenshot each separately
   - Save to `docs/screenshots/NN-descriptive-name.png` (zero-padded)
   - `console.log` each file saved

When deciding what a container means, read the source code first. Use the component tree, route file, and layout files to identify the real structure and the intended label for each container before writing the explanation.

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

For every `\ugButton{X}`, `\ugField{Y}`, `\ugMenu{Z}` planned for the section files, capture the element itself with Playwright `element.screenshot()`. These render inline in the PDF as small images instead of styled text.

Prefer tight crops or component-only shots for inline UI references; do not capture a full page just to extract a single label.

Build a list of every label that will be referenced. Group by type (button / field / menu).

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
  await el.screenshot({ path: `docs/ui/fields/${slug(label)}.png` });
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

For dynamic-text buttons (e.g. `Upload N Image(s)` where N changes), capture only if the label is stable enough to match in the UI. Otherwise let them fall back to styled text.

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

Labels with no captured PNG fall through to the `Orig` macro (styled text). This is intentional fallback for dynamic-text labels.

---

### Step 8 — Write section files

Replace each skeleton in `docs/sections/` with project-specific content. Use only template commands (full reference below).

**Layout rules (non-negotiable):**
- Document control should be a single page, followed by a new page for the rest of the guide.
- Each major chapter must start on a new page:
  - 1 Introduction
  - 2 System Overview
  - 3 Getting Started
  - 5 Core Features
  - 6 Common Tasks
  - and any other large chapter the user wants separated
- If a chapter has multiple major subsections, keep the chapter title at the top of its new page and let the subsections continue below it.

**Language rules (non-negotiable):**
- Plain English or formal Indonesian, depending on the project/user request
- No jargon unless the app itself uses that term in the UI
- Avoid internal field names when a user-facing label exists
- "pop-up window" not "modal/dialog"
- "three-dot button (…)" not "actions menu"
- Second person ("you", "your") throughout
- Short sentences, active voice
- Field descriptions: say what user should type, not what system stores

**Inline UI element rule:** when referencing a button / field / menu item, use the exact UI label string so the override lookup hits. `\ugButton{Save Section}` not `\ugButton{Save}`. If the actual UI label is awkward (e.g. `SRS Challenge Count`), use it as-is — the inline screenshot is the user's anchor; matching prose can describe it more naturally around the inline reference.

**Template command reference:**

| Need | Command |
|------|---------|
| Screenshot | `\ugScreenshot[0.9]{screenshots/NN-name.png}{Plain caption}` |
| Numbered steps | `\begin{ugSteps} \item ... \end{ugSteps}` |
| Info box | `\begin{ugNote} ... \end{ugNote}` |
| Tip | `\begin{ugTip} ... \end{ugTip}` |
| Warning | `\begin{ugWarning} ... \end{ugWarning}` |
| Button ref | `\ugButton{Save Section}` |
| Field ref | `\ugField{Email}` |
| Menu path | `\ugMenu{Courses}` |
| Keyboard key | `\ugKey{Esc}` |
| Feature module | `\begin{ugModule}{Module Name} ... \end{ugModule}` |
| Step-by-step task | `\begin{ugTask}{Task Title} ... \end{ugTask}` |
| FAQ entry | `\ugFAQ{Question?}{Answer.}` |
| Glossary entry | `\ugGlossaryEntry{Term}{Definition}` |
| Error table | `\begin{ugErrorTable} \ugError{msg}{cause}{fix} \end{ugErrorTable}` |
| Best practice | `\begin{ugBestPractice}{Title} ... \end{ugBestPractice}` |

**Note on `\ugScreenshot`:** the width argument is just the multiplier (`0.9`, not `0.9\textwidth`). The macro multiplies internally. For step-by-step screenshots, use smaller crops when the step is about a single control or button, and use wider shots when the user needs to understand layout or context.

**Section guidelines** (one-line each — see skeleton stubs for structure):

- `00-metadata.tex` — fill app name, version, date, classification, logo
- `01-document-control.tex` — one revision row (`\today`, "Generated", "Initial release")
- `02-introduction.tex` — purpose, scope, audience, prerequisites
- `03-system-overview.tex` — paragraph on what the system does, bullet capabilities, `ugModule{}` per major area
- `04-getting-started.tex` — sign-in sequence with a screenshot for every step and separate button/field crops when useful
- `05-ui-overview.tex` — overall layout description, sidebar nav table using `\ugMenu`, dashboard `\ugScreenshot`, optional `ugNote`
- `06-core-features.tex` — organize by feature, then modules; each module must include purpose, who can access, key functions, step-by-step usage, business rules, and expected result
- `07-common-tasks.tex` — 3–5 `ugTask{}` blocks with a screenshot for every step, plus inline `\ugButton`/`\ugField`/`\ugMenu` references
- `08-troubleshooting.tex` — `ugErrorTable` with 3–5 common mistakes
- `09-faq.tex` — 4–6 `\ugFAQ` entries from non-obvious behaviour
- `10-best-practices.tex` — 3 `ugBestPractice` boxes (data entry, organisation, security/access)
- `11-glossary.tex` — `\ugGlossaryEntry` per domain-specific term
- `12-appendix.tex` — keyboard shortcuts table, optional reference tables

---

### Step 9 — Compile PDF

```bash
cd docs && tectonic user-guide-<APP_SLUG>.tex
# Output: docs/user-guide-<APP_SLUG>.pdf
```

If errors:
```bash
cd docs && tectonic --print user-guide-<APP_SLUG>.tex 2>&1 | grep -i "error\|not found"
```

If you see Overfull `\hbox` warnings near `\ugField` in tables: the field PNG is wider than the column allows. The `\ugElemImgField` macro caps width at 2.9cm by default for `p{3cm}` columns. If your tables use narrower columns, either widen them or reduce the cap (in `userguide.sty`, search `width=2.9cm`).

Common errors and fixes:
- `File '...' not found` for an inline UI image → the PNG slug doesn't match the `\ifstrequal` key in `ui-overrides.tex`. Re-check spelling (case-sensitive label, slug must be lowercase-hyphenated).
- `\ugScreenshot` argument mismatch → the macro multiplies by `\textwidth` internally; pass `0.9` not `0.9\textwidth`.

---

### Step 10 — Report

```bash
ls -lh docs/user-guide-<APP_SLUG>.pdf
ls docs/screenshots/ | wc -l
ls docs/ui/buttons docs/ui/fields docs/ui/menu | wc -l
```

Report:
- Path to PDF
- Sections included
- Page-screenshot count
- UI-element count (buttons / fields / menu)
- Any flows that could not be captured and why
- Any inline UI labels that fell through to text-only rendering (no PNG captured)
