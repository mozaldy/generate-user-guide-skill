# Screenshot Capture

Use Playwright/Chromium for all final screenshots. Source code identifies what to capture; the browser supplies the actual image.

## App-Ready Gate

Do not capture after a best-effort `networkidle` alone. Implement a blocking readiness helper and call it before every screenshot.

Minimum behavior:

```js
async function waitForAppReady(page, {
  stableSelector = "main",
  timeout = 20000,
  idleTimeout = 15000
} = {}) {
  await page.waitForLoadState("domcontentloaded", { timeout });
  await page.waitForLoadState("networkidle", { timeout: idleTimeout });
  await page.locator(stableSelector).first().waitFor({ state: "visible", timeout });
  await page.evaluate(() => document.fonts?.ready).catch(() => {});

  const loadingSelectors = [
    "[data-loading='true']",
    "[aria-busy='true']",
    ".skeleton",
    "[class*='skeleton']",
    "[class*='animate-pulse']",
    "[class*='animate-spin']",
    "text=/^Loading\\.\\.\\.$/i",
    "text=/Memuat|Loading|Please wait/i"
  ];

  for (const selector of loadingSelectors) {
    const locator = page.locator(selector);
    await locator.first().waitFor({ state: "hidden", timeout: 5000 }).catch(() => {});
    if (await locator.first().isVisible().catch(() => false)) {
      throw new Error(`Page is still loading: ${selector}`);
    }
  }

  await assertStableBox(page.locator(stableSelector).first());
}

async function assertStableBox(locator, samples = 3) {
  let previous = null;
  for (let i = 0; i < samples; i += 1) {
    const box = await locator.boundingBox();
    if (!box) throw new Error("Stable element has no bounding box.");
    if (previous) {
      const same = Math.abs(box.x - previous.x) < 1 &&
        Math.abs(box.y - previous.y) < 1 &&
        Math.abs(box.width - previous.width) < 1 &&
        Math.abs(box.height - previous.height) < 1;
      if (!same) {
        await locator.page().waitForTimeout(250);
        previous = box;
        continue;
      }
    }
    previous = box;
    await locator.page().waitForTimeout(250);
  }
}
```

If the gate fails, retry the navigation or action once. If it still fails, do not save the screenshot. Record the skipped capture and reason in the review packet.

## Capture Manifest

Every capture script must write `docs/screenshots/manifest.json`. This is required by `scripts/screenshot-qa.mjs`.

```json
{
  "version": 1,
  "viewport": { "width": 1440, "height": 1000 },
  "screenshots": [
    {
      "file": "03-document-sidebar.png",
      "route": "/document/jdih",
      "selector": "[data-slot='sidebar']",
      "category": "sidebar",
      "description": "Expanded document sidebar menu",
      "fullPage": false,
      "ready": { "ok": true, "loadingDetected": false }
    }
  ]
}
```

Use `category` values such as `sidebar`, `navigation`, `toolbar`, `table`, `card`, `form`, `modal`, `chart`, `tab`, `layout`, and `full-page`.

## Container-First Rule

Capture one semantic container per screenshot:
- one sidebar/menu block
- one toolbar
- one table
- one card
- one form section
- one modal/pop-up window
- one chart or chart group
- one tab panel

Full-page screenshots are allowed only when documenting the whole layout. Mark them with `category: "layout"` or `fullPage: true` in the manifest.

## Sidebar and Menu Crops

Do not screenshot the full fixed-height sidebar element when most of it is whitespace. Crop the union of meaningful visible children instead:
- logo/header
- search box, if present
- visible menu group labels
- visible menu items and expanded submenu items

Compute the crop from child bounding boxes and add 8-16 px padding. The crop should normally be narrow and no taller than the viewport.

Pattern:

```js
async function sidebarClip(page) {
  const items = page.locator([
    "[data-slot='sidebar-header']",
    "[data-sidebar='input']",
    "[data-sidebar='group-label']",
    "[data-sidebar='menu-item']",
    "[data-sidebar='footer']"
  ].join(","));
  const boxes = [];
  for (let i = 0; i < await items.count(); i += 1) {
    const item = items.nth(i);
    if (await item.isVisible().catch(() => false)) {
      const box = await item.boundingBox();
      if (box) boxes.push(box);
    }
  }
  if (!boxes.length) throw new Error("No visible sidebar content.");
  const viewport = page.viewportSize() || { width: 1440, height: 1000 };
  const left = Math.min(...boxes.map((b) => b.x));
  const top = Math.min(...boxes.map((b) => b.y));
  const right = Math.max(...boxes.map((b) => b.x + b.width));
  const bottom = Math.max(...boxes.map((b) => b.y + b.height));
  const padding = 12;
  return {
    x: Math.max(0, left - padding),
    y: Math.max(0, top - padding),
    width: Math.min(viewport.width, right - left + padding * 2),
    height: Math.min(viewport.height, bottom - top + padding * 2)
  };
}
```

## Inline Field Crops

For every inline `\ugField{Label}` capture, include the field's visible label with the input/select/textarea. Do not crop only the raw input box; unlabeled fields are ambiguous in the PDF.

Preferred behavior:
- Start from the matched input/select/textarea, or find one inside the matched field container.
- Include an explicit `label[for=...]`, a wrapping `<label>`, or the nearest visible label-like text directly above the control.
- If the app groups label and input in a small form-field container, crop that container when it contains at most a small number of controls.
- Add 4-8 px padding and keep the crop tight. Avoid including an entire form row when only one field is being referenced.
- If no label is visible, capture the tight input crop and record the missing label in the skipped/notes report.

Pattern:

```js
async function captureFieldWithLabel(page, locator, filePath) {
  const handle = await locator.elementHandle().catch(() => null);
  if (!handle) return false;

  const clip = await page.evaluate((element) => {
    const input = element.matches("input, textarea, select")
      ? element
      : element.querySelector("input, textarea, select");
    if (!input) return null;

    const boxes = [];
    const addBox = (node) => {
      if (!node) return;
      const rect = node.getBoundingClientRect();
      if (rect.width > 0 && rect.height > 0) boxes.push(rect);
    };

    addBox(input);

    if (input.id) {
      for (const label of document.querySelectorAll(`label[for="${CSS.escape(input.id)}"]`)) {
        addBox(label);
      }
    }

    addBox(input.closest("label"));

    let cursor = input.parentElement;
    for (let depth = 0; cursor && depth < 4; depth += 1, cursor = cursor.parentElement) {
      const labels = [...cursor.querySelectorAll("label")]
        .filter((label) => label.getBoundingClientRect().height > 0);
      if (labels.length > 0 && cursor.querySelectorAll("input, textarea, select").length <= 2) {
        addBox(cursor);
        break;
      }
    }

    const inputRect = input.getBoundingClientRect();
    const labelLike = [...document.querySelectorAll("label, div, span, p")]
      .filter((node) => {
        const text = (node.textContent || "").trim();
        const rect = node.getBoundingClientRect();
        if (!text || rect.width <= 0 || rect.height <= 0) return false;
        const verticallyNear = rect.bottom <= inputRect.top + 4 && inputRect.top - rect.bottom < 44;
        const horizontallyAligned = rect.left < inputRect.right && rect.right > inputRect.left;
        return verticallyNear && horizontallyAligned;
      })
      .sort((a, b) => b.getBoundingClientRect().bottom - a.getBoundingClientRect().bottom);
    labelLike.slice(0, 1).forEach(addBox);

    if (!boxes.length) return null;

    const left = Math.min(...boxes.map((box) => box.left));
    const top = Math.min(...boxes.map((box) => box.top));
    const right = Math.max(...boxes.map((box) => box.right));
    const bottom = Math.max(...boxes.map((box) => box.bottom));
    const padding = 4;

    return {
      x: Math.max(0, left - padding),
      y: Math.max(0, top - padding),
      width: Math.min(window.innerWidth, right - left + padding * 2),
      height: Math.min(window.innerHeight, bottom - top + padding * 2)
    };
  }, handle).catch(() => null);

  await handle.dispose();
  if (!clip || clip.width < 20 || clip.height < 20) return false;
  await page.screenshot({ path: filePath, clip });
  return true;
}
```

## Capture Standards

- Scroll the target container into view before capture.
- Use `locator.screenshot()` for self-contained elements.
- Use `page.screenshot({ clip })` only when padding or union crops are needed.
- Avoid clipped table columns, half text, half icons, or horizontal slivers.
- For modals, open the pop-up window, wait for readiness, capture the dialog container, then close with `Escape`.
- For dynamic forms, capture every visible variant caused by type/category/role/status selections.
- Never use browser-vision screenshots with red boxes or numbered callouts in the final guide. Recapture cleanly.

## QA

Run after capture:

```bash
node <skill>/scripts/screenshot-qa.mjs docs
```

Fix every `ERROR`. Warnings may be reported to the user only if they are intentional and documented in the review packet.
