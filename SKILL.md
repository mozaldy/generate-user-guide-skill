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
- If the user does not answer about the template, use the bundled fallback template at `/generate-user-guide-skill/template`.
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
/generate-user-guide-skill/template/
```

Supported template sources:
- a template directory containing `userguide-example.tex`, `latex/`, `sections/`, and `img/`
- a ZIP/archive that can be unpacked into a template directory
- a template bundle file or folder the user points to explicitly

Canonical template contents to mirror:
- `userguide-example.tex`
- `latex/userguide.sty`
- `latex/userguide-boxes.sty`
- `latex/userguide-code.sty`
- `latex/userguide-colors.sty`
- `latex/userguide-layout.sty`
- `latex/userguide-lists.sty`
- `latex/userguide-tables.sty`
- `latex/userguide-titlepage.sty`
- `latex/userguide-typography.sty`
- `sections/00-metadata.tex` (config: app name, company, version, logo, cover)
- `sections/00-document-control.tex` (unnumbered preamble, rendered before TOC)
- `sections/01-introduction.tex` (chapter 1)
- `sections/02-system-overview.tex` (chapter 2)
- `sections/03-getting-started.tex` (chapter 3)
- `sections/04-ui-overview.tex` (chapter 4)
- `sections/05-<feature>.tex` … `NN-<feature>.tex` — one file per major feature/module of the target app, numbered sequentially starting at 5 (mandatory split — see below). The bundled reference uses chapters 5–16 for 12 modules.
- `sections/<N+1>-common-tasks.tex` (after the last feature module)
- `sections/<N+2>-troubleshooting.tex`
- `sections/<N+3>-faq.tex`
- `sections/<N+4>-best-practices.tex`
- `sections/<N+5>-glossary.tex`
- `sections/<N+6>-appendix.tex`

For the bundled 12-module reference: `17-common-tasks.tex` … `22-appendix.tex`.
- `img/` — logo and cover assets
- `Makefile`, `build.ps1`, `build.bat` — wrappers if present in the template

Important template conventions:
- The bundled template is the **source of truth**. It compiles to a 22-chapter reference PDF (`userguide-template/userguide-template/build/userguide-example.pdf`) — Document Control + 22 numbered chapters: Introduction (1), System Overview (2), Getting Started (3), UI Overview (4), then 12 per-feature module chapters (5–16), Common Tasks (17), Troubleshooting (18), FAQ (19), Best Practices (20), Glossary (21), Appendix (22). Use this PDF as the **depth and structure target**.
- All section files ship with real Insight Doc content. When generating a guide for a different app, **rewrite every section file end-to-end** with the target app's content — keep the same chapter ordering, same subsection breakdown, same `\begin{ugModule}{Overview}` / `\begin{ugTask}` / `\begin{ugFAQ}` / `\begin{ugBestPractice}[Title]` / `tabularx` patterns, and the same depth as the reference. **Never ship a section with a bare stub, an empty table, or a single-line "TBD" body.**
- The feature-module cluster (chapters 5 … N) is the source of truth for feature coverage. Mirror the target app's real module list into separate `NN-<feature>.tex` files starting at `05-` and list each one in `userguide-example.tex`. **One file per feature module is mandatory** — never collapse multiple features into a single chapter. Minimum is one feature module file (chapter 5); the bundled example uses 12 (chapters 5–16: `05-document-management.tex` through `16-lifecycle-management.tex`).
- After the last feature chapter, the trailing chapters continue sequentially: Common Tasks, Troubleshooting, FAQ, Best Practices, Glossary, Appendix. For the 12-module reference these end up as chapters 17–22.
- Every user-facing step should include a screenshot reference or `\ugScreenshotPlaceholder`.
- Button, field, and menu references must use the template's inline commands: `\ugButton{...}`, `\ugField{...}`, `\ugMenu{...}`, `\ugKey{...}`, `\ugRole{...}`, `\ugStatus{<colorMacro>}{Label}`.
- Inline UI labels must be rendered from browser/Playwright-captured screenshots, not synthetic drawings, text styling, or hand-made approximations.
- The template's structure and section order are the source of truth; do not invent a different hierarchy unless the user explicitly asks for one.

The bundled `userguide.sty` should already include tectonic-safe adjustments, such as:
- Unicode stubs instead of FontAwesome5 OTF loads
- `\let\@ugLogoPath\empty` and `\let\@ugCoverImagePath\empty`
- inline image macros for buttons / fields / menus
- `\InputIfFileExists{ui-overrides.tex}{}{}` for project-specific overrides

If the user supplies a ZIP template, normalize it into the skill workspace shape rather than inventing a new file hierarchy. The conversion rule is:
- keep the ZIP's section ordering and placeholder content as the source of truth
- mirror it into the skill workspace under the expected Hermes layout
- preserve the repo's LaTeX semantics, but adapt file placement so the skill can operate consistently
- if the user asks for a different structure, change only the final PDF's section organization, not the underlying template source format

Do not patch `userguide.sty` for tectonic compatibility during each project. Keep the template stable and override only project-specific values.

---

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
- the full **module list** of the target app — group routes/pages into named feature modules. This list drives the chapter-5+ feature-file split.

Produce a numbered list of user flows AND a numbered list of feature modules before proceeding.

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
- Open `docs/user-guide-<APP_SLUG>.tex` and update the `\input{sections/...}` list so it matches the **module list discovered in Step 1**, not the template's example modules. Remove module file inputs that don't apply, add new ones for modules the example template doesn't cover, and **renumber the trailing chapters (Common Tasks through Appendix) so they continue sequentially after the last feature module**.
- For each new module file, copy one of the existing Insight Doc modules (e.g. `06-versioning.tex` is a good short skeleton — 78 lines, 4 subsections; `05-document-management.tex` is a good long skeleton — 632 lines) and rewrite it for the target app.
- Rename the trailing files to keep numbering contiguous. Examples:
  - 1 feature module → `05-<feature>.tex`, then `06-common-tasks.tex` … `11-appendix.tex` (11 numbered chapters total).
  - 5 feature modules → chapters 5–9, then `10-common-tasks.tex` … `15-appendix.tex` (15 numbered chapters total).
  - 12 feature modules (bundled reference) → chapters 5–16, then `17-common-tasks.tex` … `22-appendix.tex` (22 numbered chapters total).
- The final TOC must have at minimum: Document Control (unnumbered) + Introduction + System Overview + Getting Started + UI Overview + (≥1 feature chapter) + Common Tasks + Troubleshooting + FAQ + Best Practices + Glossary + Appendix.

The LaTeX support files are already in the template. Do not rewrite them for tectonic compatibility — use the template as-is and override only project-specific values.

---

### Step 4 — App theming (logo + colors)

**4a. Logo.** The logo MUST come from the target app's real brand. Search in this priority order:
1. The live deployment — open `BASE_URL` in Playwright/browser, find the brand logo on the public landing page or login page (often a top-left `<img>` with `alt` containing the app or company name). Save the rendered logo via `element.screenshot()` or download the source `src` attribute.
2. The repo's static assets:
   ```bash
   ls public/icon.svg public/logo.svg public/*.svg public/logo.* 2>/dev/null
   ls app/icon.* app/icon-*.* src/assets/logo* 2>/dev/null
   ```
3. Only if 1 and 2 fail, ask the user for a logo file.

Convert SVG → PNG (macOS native, no extra deps):
```bash
sips -s format png public/icon.svg --out docs/logo.png
# Or for high-res: render at larger dimensions first
```

Make sure `docs/logo.png` is the **target app's logo**, not the bundled template's example logo. Overwrite `docs/img/original-logo.png` and `docs/img/white-logo.png` if the template uses them on the cover.

In `docs/sections/00-metadata.tex`, set `\ugLogo{logo}` (no extension; LaTeX adds it). Also set `\ugCompany`, `\ugAppName`, `\ugAppSubtitle`, `\ugVersion`, `\ugReleaseDate`, and any other metadata commands the template exposes.

**4b. Colors.** Extract the target app's brand colors and generate a customized `userguide-colors.sty` for that app.

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

Rules:
1. Use Chromium/Playwright for the actual screenshot capture. The browser may be driven by the Hermes browser tool or by Playwright in a script, but the final image must come from the live UI.
2. Login: navigate to sign-in route → fill EMAIL/PASSWORD → submit → wait for redirect.
3. For each user flow:
   - Navigate to the URL (use real IDs from live data — click through to discover them)
   - `await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {})`
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

When deciding what a container means, read the source code first. Use the component tree, route file, and layout files to identify the real structure and the intended label for each container before writing the explanation. Source code is only for route/structure discovery; it is not a substitute for the browser screenshot.

Crop helper pattern:
- Prefer `locator.screenshot()` for a single container, button, card, sidebar, or table.
- If you need extra padding around a container, use `locator.boundingBox()` and `page.screenshot({ clip })`.
- Clip a little wider/taller than the element if the screenshot needs context, but keep the crop focused on the required container.
- For dashboards, capture distinct regions separately: sidebar, top bar, summary cards, chart cards, and table cards — each as its own file.
- If a container is partially off-screen, scroll it into view before capturing it.
- Avoid capturing horizontal slivers that cut content (e.g. half a username, half a number). If the natural element bounding box truncates content, expand `clip` to include the full visible row/column.

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

Replace each skeleton in `docs/sections/` with project-specific content. Use the template's own section-by-section structure as the guide, especially where the template already breaks a section into deeper subtopics.

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

- [ ] The cover logo is the **target app's brand**, not the bundled template's example logo.
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
- [ ] Sidebar screenshots are narrow centered crops, not full-page dashboards.
- [ ] Each dashboard container is captured separately and explained with Purpose / What it means / Step-by-step / Expected result, not a generic "this card shows data" sentence.
- [ ] Every inline `\ugButton`, `\ugField`, `\ugMenu` uses the exact UI label string from the source code.

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
