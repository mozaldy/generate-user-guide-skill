# generate-user-guide

## When to use
Invoke when user asks to generate a user guide, user manual, or documentation PDF for a web app.
Also invoke on `/generate-user-guide`.

Do NOT invoke for: API docs, code docs, README files, or developer-facing docs.

---

## Arguments

Expect from user (prompt if missing):
- `TARGET_ROUTE` — section of the app to document (e.g. `/admin`)
- `BASE_URL` — live deployment URL (e.g. `https://myapp.com`)
- `EMAIL` — login email
- `PASSWORD` — login password

Optional (ask if not provided):
- `APP_NAME` — display name for the app (default: infer from project)
- `COMPANY` — company name (default: blank)

Derive `APP_SLUG` = lowercase-hyphenated `APP_NAME` (e.g. "Adibasa" → `adibasa`).
The working `.tex` and final `.pdf` are both named `user-guide-<APP_SLUG>`.

---

## Template location

```
~/.claude/skills/generate-user-guide/template/
  userguide.sty           ← pre-patched style — DO NOT modify in template
  userguide-example.tex   ← main document skeleton
  sections/00-metadata.tex
  sections/01-document-control.tex
  ...
  sections/12-appendix.tex
```

The bundled `userguide.sty` is already patched for tectonic/XeLaTeX:
- fontawesome5 → Unicode stubs (otherwise tectonic crashes loading the OTF)
- `\let\@ugLogoPath\empty` and `\@ugCoverImagePath\empty` (XeLaTeX `\ifx` fix)
- `\ugElemImg` / `\ugElemImgField` / `\ugElemImgMenu` macros
- `\let\ugButtonOrig\ugButton` etc. (originals saved for fallback)
- `\InputIfFileExists{ui-overrides.tex}{}{}` (per-project overrides loaded if present)

The bundled `sections/` are skeleton stubs. The skill replaces their content per project, but unedited stubs still compile.

---

## Workflow (follow in order)

### Step 1 — Explore source code

Spawn an **Explore subagent** targeting `TARGET_ROUTE`. Search in `app/`, `pages/`, `src/app/`, `src/pages/`.

Return:
- Every route/page under the target
- What each page does (list, detail, form, modal, upload, search, etc.)
- Navigation structure (sidebar, breadcrumbs, tabs)
- All interactive actions: add, edit, delete, search, filter, upload
- For every form/modal: every field label (the **exact** label text — used as the inline-screenshot lookup key), input type, required/optional, what it accepts
- Forms that change fields based on a type/category selection — list **each variant separately**
- Any domain-specific terms worth defining in a glossary
- Anything that commonly confuses new users (for FAQ + troubleshooting)

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

```bash
SKILL_TEMPLATE=~/.claude/skills/generate-user-guide/template

mkdir -p docs/screenshots
mkdir -p docs/sections
mkdir -p docs/ui/buttons docs/ui/fields docs/ui/menu

# Copy template files (always overwrite to stay on latest template)
cp "$SKILL_TEMPLATE/userguide.sty"          docs/userguide.sty
cp "$SKILL_TEMPLATE/userguide-example.tex"  docs/user-guide-<APP_SLUG>.tex
cp "$SKILL_TEMPLATE/sections/"*.tex         docs/sections/
```

The .sty is already patched. **Do not edit it for tectonic compatibility** — that work is done.

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

Patch `docs/userguide.sty` color block — overwrite these variables:
- `ugPrimary` ← `--primary`
- `ugPrimaryDark` ← darker shade of primary (manually or by reducing lightness ~15%)
- `ugSecondary` ← `--secondary` (or `--accent`)
- `ugLightBg` ← light background tint of primary (high lightness, low chroma)
- `ugTableHead` ← same as `ugPrimary` or slightly darker
- `ugCoverGradA` / `ugCoverGradB` ← primary / primary-dark
- `ugBorder` ← border tint

**Do NOT change `ugDarkText` or `ugMutedText`.** Body text must stay neutral black/gray (`#111111` / `#6B7280`). Brand colors on body text reduces readability — user feedback on a previous run.

---

### Step 5 — Capture page screenshots

Write `scripts/capture-screenshots.mjs`:

1. Headless Chromium at 1440×900
2. Login: navigate to sign-in route → fill EMAIL/PASSWORD → submit → wait for redirect
3. For each user flow:
   - Navigate to the URL (use real IDs from live data — click through to discover them)
   - `await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {})`
   - For modal flows: click trigger → wait 500ms → screenshot → `Escape`
   - For forms with type variants: open modal, select each type, screenshot each separately
   - Save to `docs/screenshots/NN-descriptive-name.png` (zero-padded)
   - `console.log` each file saved

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

**Important:** the `\ugField{Foo}` lookup uses the **exact label string** from the source code (e.g. `<FormLabel>Foo</FormLabel>`) — not a paraphrased / user-friendly version. Capture using the same string. If the UI label is `SRS Challenge Count`, the section text should write `\ugField{SRS Challenge Count}`, not `\ugField{Review Count}`.

For dynamic-text buttons (e.g. `Upload N Image(s)` where N changes), do **not** capture them — they will fall back to the original styled-text rendering, which is correct behaviour.

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

**Language rules (non-negotiable):**
- Plain English, no jargon, no internal field names, no tech terms
- "pop-up window" not "modal/dialog"
- "three-dot button (…)" not "actions menu"
- Second person ("you", "your") throughout
- Short sentences, active voice
- Field descriptions: say what user should type, not what system stores

**Inline UI element rule:** when referencing a button / field / menu item, use the **exact UI label string** so the override lookup hits. `\ugButton{Save Section}` not `\ugButton{Save}`. If the actual UI label is awkward (e.g. `SRS Challenge Count`), use it as-is — the inline screenshot is the user's anchor; matching prose can describe it more naturally around the inline reference.

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

**Note on `\ugScreenshot`:** the width argument is just the multiplier (`0.9`, not `0.9\textwidth`). The macro multiplies internally.

**Section guidelines** (one-line each — see skeleton stubs for structure):

- `00-metadata.tex` — fill app name, version, date, classification, logo
- `01-document-control.tex` — one revision row (`\today`, "Generated", "Initial release")
- `02-introduction.tex` — purpose, scope, audience, prerequisites
- `03-system-overview.tex` — paragraph on what the system does, bullet capabilities, `ugModule{}` per major area
- `04-getting-started.tex` — sign-in `ugSteps` + `\ugScreenshot` of login page
- `05-ui-overview.tex` — overall layout description, sidebar nav table using `\ugMenu`, dashboard `\ugScreenshot`, optional `ugNote`
- `06-core-features.tex` — one `ugModule{}` per major feature area, field tables using `\ugField`, `\ugScreenshot` per screen, one `ugTask{}` per form variant
- `07-common-tasks.tex` — 3–5 `ugTask{}` blocks with `ugSteps`, inline `\ugButton`/`\ugField`/`\ugMenu` references
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
