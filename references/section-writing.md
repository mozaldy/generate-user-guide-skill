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
