# Dummy Data Lifecycle

The skill captures CRUD flows by creating its own dummy records, reusing the same record across the Create → Edit → Delete sequence, and deleting every record before reporting done. This is the only way the skill is allowed to mutate the target app.

## Allowed mutations

Only on records the agent itself just created:
- `Create` / `Save` / `Submit` a new record using realistic dummy values
- `Edit` / `Update` that same record
- `Delete` / `Archive` that same record

## Forbidden mutations (always)

- Create/Edit/Delete/Approve/Publish/Send/Upload against any **pre-existing** record. Pre-existing data is read-only — list/detail screenshots only.
- Any modification to the target app's source code, config, env files, or repo state. The skill reads the codebase to understand behavior; it never writes to it.
- Bulk operations, role/permission changes, billing actions, or anything that fans out to other users (real emails, notifications, webhooks) — even on agent-created records — unless the user has explicitly authorized it.

When `MUTATIONS_ALLOWED=false` (intake), all mutations are forbidden. CRUD chapters fall back to "feature available; not captured in this revision."

## Realistic naming

Names should look natural in screenshots: "Quarterly Sales Review", "Acme Corporation", "Demo Customer ABC". Avoid lorem ipsum, "test123", or `_GUIDE_DEMO_*` prefixes. The ledger is what makes cleanup safe — not the name. Honor any `DUMMY_DATA_NOTES` constraint from intake.

## Ledger

`docs/.dummy-data-ledger.json` is the single source of truth for what the agent created. Every Create appends an entry **before** clicking submit. Every Delete patches the entry to `deleted: true`. Cleanup survives `/clear`, compaction, and crashes because state lives on disk, not in conversation context.

Entry shape:

```json
{
  "createdAt": "2026-05-08T10:14:22Z",
  "feature": "documents",
  "entity": "Document",
  "id": "abc-123",
  "displayName": "Quarterly Sales Review",
  "deleteRoute": "/documents/abc-123",
  "deleteSelector": "button[aria-label='Delete']",
  "deleted": false
}
```

If a record cannot be deleted via the UI (immutable audit log, completed workflow, etc.), set `"undeletableReason": "..."` instead of `"deleted": true`. The undeletable entries surface in the final report so the user can decide whether to clean up manually.

Helper functions:

```js
import fs from "node:fs/promises";
const LEDGER = "docs/.dummy-data-ledger.json";

async function ledgerAdd(entry) {
  const data = JSON.parse(await fs.readFile(LEDGER, "utf8").catch(() => "[]"));
  data.push({ ...entry, createdAt: new Date().toISOString(), deleted: false });
  await fs.writeFile(LEDGER, JSON.stringify(data, null, 2));
}

async function ledgerMarkDeleted(id) {
  const data = JSON.parse(await fs.readFile(LEDGER, "utf8"));
  const entry = data.find((row) => row.id === id);
  if (entry) entry.deleted = true;
  await fs.writeFile(LEDGER, JSON.stringify(data, null, 2));
}
```

## Capture order per CRUD feature

1. Navigate to the feature's list/index — screenshot **before** any mutation (real production state).
2. Click `Create` / `Add` — screenshot the empty form.
3. Fill with realistic dummy values — screenshot the filled form.
4. Append a ledger entry **before** submit. After submit, capture the returned `id` from the URL or success response and patch it into the entry.
5. Submit — screenshot the success toast and the new row in the list.
6. Open the same row → `Edit` — screenshot the pre-filled edit form.
7. Change one realistic field → submit — screenshot the updated row.
8. Click `Delete` on the same row — screenshot the confirmation modal, click confirm, screenshot the post-delete list. Mark ledger entry `deleted: true`.

If a feature exposes only some of these actions, capture the ones that exist and skip the rest. Never invent a Delete capture by deleting a real record.

## Resume after `/clear` or compaction

Before capturing anything new on resume:

1. Read `docs/.dummy-data-ledger.json`.
2. For every entry with `deleted: false`, log into the app and delete the record via the UI.
3. Patch the entry to `deleted: true`.
4. If a record can no longer be found in the UI (already cleaned up manually, or reference broken), set `"deletedNote": "not found on resume"` and mark `deleted: true`.

Only after the ledger is drained should the script proceed to capture new chapters.

## Cleanup gate

`scripts/validate-guide-structure.mjs` checks that every ledger entry is `deleted: true` or has `undeletableReason` set. The check runs as part of the precompile gate.

For mid-iteration draft compiles, set `UG_ALLOW_LEDGER_LEAKS=1` to bypass the gate while still capturing additional features. The final compile must run without the bypass.
