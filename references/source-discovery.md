# Source Discovery

Read source code before writing guide content or capturing screenshots. Source discovery determines the full-app feature list, user-flow order, scenario coverage, and exact UI labels. The user-provided route is the entry/start route by default, not the documentation boundary.

## Search Targets

Search likely app entry points and route definitions:
- React/Vite: `src/main.*`, `src/routing/**`, `src/routes/**`, `src/modules/**`
- Next.js: `app/**`, `src/app/**`, `pages/**`, `src/pages/**`
- Shared UI: `src/components/**`, `components/**`
- Types and constants: `src/types/**`, `src/constants/**`, `src/i18n/**`

Use `rg` first. Prefer source truth over browser guessing for route structure, labels, roles, and form variants.

## Required Inventory

Create `docs/guide-inventory.md` with:
- app name, full-app scope assumption, entry/start route, base URL, date, role used for capture
- complete public, protected, dynamic, redirect, and error route/page list for the app
- authentication flow from the entry route through the authenticated shell
- navigation hierarchy: sidebar groups, tabs, breadcrumbs, top-bar actions
- user flows, numbered in documentation order
- feature modules, numbered in chapter order from chapter 5 onward
- every page's purpose: list, detail, form, modal, upload, preview, search, filter, chart, settings, approval, etc.
- every interactive action: add, edit, delete, archive, restore, approve, reject, search, filter, upload, download, share, export, print, refresh
- every form/modal field: exact label, type, required/optional, accepted values, validation, conditional visibility
- every form variant caused by type/category/role/status selections
- every data grid: columns, sortable/filterable/searchable state, row actions, bulk actions, empty state
- roles and permissions visible in code or route guards
- status labels and lifecycle transitions
- likely failure modes for troubleshooting
- glossary candidates: app terms, role names, statuses, domain nouns, auth method, workflow terms

Create `docs/guide-progress.json` before writing feature chapters. Use this shape:

```json
{
  "version": 1,
  "scope": "entire-app",
  "entryRoute": "/auth",
  "baseUrl": "https://example.com",
  "reviewPolicy": "one-feature-at-a-time",
  "features": [
    {
      "id": "login",
      "title": "Login and Role Selection",
      "kind": "user-flow",
      "chapter": "03-getting-started",
      "status": "pending",
      "approvedAt": null,
      "scenarios": ["happy path", "invalid credential", "missing role", "logout"]
    }
  ]
}
```

Valid statuses are `pending`, `drafted`, `reviewed`, `approved`, and `skipped`. Use `skipped` only with a reason.

Do not set `status: "approved"` until the user explicitly approves that feature/user flow. After drafting and capturing a feature, set `status: "drafted"` and stop for review.

## Feature Grouping

Group routes into feature modules by user intent, not by implementation folder alone. A feature module should usually map to one major sidebar entry or workflow family.

Use these defaults:
- Authentication/login and role selection are user flows, documented before feature modules.
- UI shell/navigation is covered in UI Overview, not as a feature chapter.
- CRUD for one resource is usually one feature module, with list/create/update/detail/upload/delete subsections.
- Approval and access-request workflows deserve separate modules when they have distinct roles, statuses, or screens.
- Master-data submodules can be separate chapters when users manage them independently.

If the entry route is `/auth`, `/login`, `/signin`, `/callback`, or `/select-role`, still discover the entire authenticated application after login. Document login as Getting Started or an authentication flow, then continue with the protected app modules.

## Exhaustive Flow Checklist

For each flow, list and later document:
- entry point and required role
- happy path
- required fields and validation failures
- permission-denied or missing-access behavior
- empty data state
- loading or delayed data state, documented only in prose unless the app intentionally exposes it
- success state, toast, redirect, or changed row/status
- cancel/back/close behavior
- destructive confirmation behavior
- recoverable error states

Login must cover at minimum:
- how to reach the sign-in screen
- credential entry
- successful sign-in
- role selection when shown
- invalid credentials or failed sign-in
- missing/unauthorized role
- session timeout or logout

## Before Proceeding

Do not start writing feature sections until `docs/guide-inventory.md` contains a numbered user-flow list and full-app feature-module list. Stop after the inventory/plan checkpoint and ask the user to approve the module order and first feature, unless the user explicitly asked to skip checkpoints. If source code reveals multiple plausible feature groupings, choose the one that matches the navigation users see in the live app and record that assumption.
