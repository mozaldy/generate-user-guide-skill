# Section Writing

Write for end users. Use source code for facts and the live app for screenshots. Do not expose implementation names unless the UI itself uses them.

## Review-Gated Writing

Write one feature/user flow at a time. The default review artifact is draft content plus screenshots, not a partial PDF.

For each feature/user flow:
1. Mark its `docs/guide-progress.json` entry as `drafted`.
2. Write or update the relevant section file.
3. Capture screenshots and inline UI controls used by that section.
4. Run screenshot QA for the new images.
5. Present a review packet and stop.
6. Continue only when the user explicitly says `no feedback`, `approved`, `ok`, or `continue`.
7. Mark the entry `approved` before moving to the next feature/user flow.

Review packet format:

```text
Review: <Feature/User Flow>
Draft files:
- docs/sections/03-getting-started.tex
Screenshots:
- docs/screenshots/01-login-form.png
- docs/screenshots/02-select-role.png
Coverage:
- Happy path: covered
- Validation/error state: covered
- Role/permission differences: covered
- Empty/loading states: covered in prose; no intentional loading screenshots
- Variants: none
Skipped captures:
- none
Questions:
- none
```

## Language Rules

- Use plain English or formal Indonesian, depending on the user's request and app language.
- Use second person: "you" and "your".
- Use short sentences and active voice.
- Use "pop-up window", not "modal" or "dialog", unless the UI uses that term.
- Use "three-dot button (...)" instead of "actions menu".
- Say what the user should type or choose, not what the database stores.

## UI Macro Rules

Every prose reference to a user-facing control must be wrapped:

| Control | Macro |
| --- | --- |
| Button | `\ugButton{Exact Label}` |
| Field | `\ugField{Exact Label}` |
| Sidebar/menu/link/tab | `\ugMenu{Exact Label}` |
| Status | `\ugStatus{ugSuccess}{Done}` |
| Role | `\ugRole{Admin}` |
| Keyboard | `\ugKey{Esc}` |

Use the exact UI label from source code or the rendered app. Do not paraphrase inside the macro. If the actual label is awkward, keep it in the macro and explain naturally around it.

## Full Template Macro Reference

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

### Macro-specific notes

- `\ugScreenshot` — width argument is a multiplier only (`0.9`, not `0.9\textwidth`). The macro multiplies internally. Use smaller crops when the step is about a single control or button; use wider shots when the user needs layout context.
- `\ugBestPractice` — title goes in **square brackets** as the optional argument: `\begin{ugBestPractice}[Use the correct role]`. Do not put the title inside the body or as a `{}` argument — that produces the broken "Use the correct role Always choose…" run-on layout.
- `\ugFAQ` — both question and answer are required. Always include a real, multi-sentence answer. Do not ship `\ugFAQ{Question}{}`.
- `\ugGlossaryEntry` — every entry needs a definition body. Replace `\ugGlossaryEntry{SSO}{}` with `\ugGlossaryEntry{SSO}{Single Sign-On — a centralized login flow that lets one credential authenticate across multiple applications.}`.
- `\ugErrorTable` — every Troubleshooting section must contain at least three real `\ugError{message}{cause}{fix}` rows scoped to the target app. An empty `ugErrorTable` with only a header row is not acceptable output.

## Codebase-Walk Rule (Non-Negotiable)

Before writing any feature-module chapter or container description, read the actual source code for that feature. The screenshot shows surface UI; the code shows behavior, validation, side effects, and edge cases. Without the codebase walk the prose collapses to "this card shows data" filler.

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

## Section Type Quick Reference

The authoritative contract per section type lives in `template/MANIFEST.yaml` (`section_types{}`). The summary below is a fast reminder of the *shape* of each type — always verify against MANIFEST before writing.

- `metadata` / `document-control` — cover-page + preamble chapter; fill with target-app values, not template defaults.
- `introduction` / `system-overview` / `getting-started` / `ui-overview` — multi-paragraph framing chapters; each has a checklist of subsections in MANIFEST.
- `feature-module` — repeats once per real feature; needs `ugModule{Overview}` (Purpose + Who Can Access), at least 3 `\subsection{}` blocks, tabularx tables for grids/forms, container-by-container breakdown (Purpose / What the code does / What it means / Step-by-step usage / Expected result), and a final Business Rules subsection. Match `complex` depth (e.g. document management) for big modules, `simple` depth (e.g. versioning: Key Functions / Step-by-Step / Information Recorded / Business Rules) for small ones.
- `common-tasks` — 3–6 `ugTask{}` blocks, each with `\textbf{Objective:}` + `ugSteps` + `\textbf{Expected Outcome:}`.
- `troubleshooting` — `ugErrorTable` with ≥3 real `ugError{msg}{cause}{fix}` rows.
- `faq` — ≥5 `ugFAQ{Q}{multi-sentence A}` entries derived from non-obvious behaviour found in source-code discovery.
- `best-practices` — 3–6 `ugBestPractice[Title]` boxes wrapping `itemize` lists. Title in **[brackets]**, never in the body.
- `glossary` — one `ugGlossaryEntry{Term}{Definition.}` per domain term; every role, status label, auth method, and UI noun must be covered.
- `appendix` — keyboard shortcuts + reference tables + live `BASE_URL`, support contact, environment URLs.

Good:

```latex
Enter your \ugField{Email} and \ugField{Password}, then click \ugButton{Log In}.
```

Bad:

```latex
Enter your email and password, then click the login button.
```

## Screenshot Macro

Use:

```latex
\ugScreenshot[0.9]{screenshots/NN-name.png}{Plain caption}
```

The width argument is a multiplier only, such as `0.9`, not `0.9\textwidth`.

Every user-facing step should include a screenshot or `\ugScreenshotPlaceholder` only when capture is genuinely impossible. Prefer actual screenshots.

## Chapter Structure

Keep this order:
- Document Control
- Introduction
- System Overview
- Getting Started
- UI Overview
- one chapter per feature module, starting at `05-`
- Common Tasks
- Troubleshooting
- FAQ
- Best Practices
- Glossary
- Appendix

Feature modules:
- one `.tex` file per major feature module
- at least three subsections per module unless the feature truly has fewer screens
- an Overview `ugModule` block with purpose and who can access
- data-grid column table when a grid exists
- field table when a form exists
- screenshot per important container/state
- final `\subsection{Business Rules}` with constraints, validation, and access rules

Container/card explanations must answer:
- Purpose
- What you see
- What it means
- What to do with it
- Expected result

## Supporting Chapters

Common Tasks:
- 3-6 `ugTask` blocks.
- Each task contains Objective, `ugSteps`, and Expected Outcome.

Troubleshooting:
- At least three target-app `\ugError{message}{cause}{fix}` rows.
- Include failed login, missing role/permission, empty data, and failed upload/download when applicable.

FAQ:
- At least five `\ugFAQ{question}{answer}` entries.
- Answers must be real multi-sentence answers.

Best Practices:
- Use `\begin{ugBestPractice}[Title]`.
- The title belongs in square brackets.
- Include concrete bullets inside each box.

Glossary:
- Every `\ugGlossaryEntry{Term}{Definition}` must have a real definition.
- Cover role names, status labels, auth method, and domain-specific UI nouns.

Appendix:
- Include live `BASE_URL`, supported browsers, roles/permissions matrix when known, keyboard shortcuts, status/reference tables, support contact, and environment-specific URLs.

## No-Stub Gate

Never ship:
- `TBD`, `TODO`, lorem ipsum, or placeholder prose
- empty tables
- one-line feature chapters
- empty FAQ answers
- glossary terms without definitions
- copied template product names that do not belong to the target app
