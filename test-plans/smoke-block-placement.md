# [Stage] - Block Placement - Test Plan

Status: ready to generate
Implemented test: —

Split out from [deed-smoke-test-plan.md](../docs/deed-smoke-test-plan.md)
§13 (block placement), Phase 2.

## Running it

```bash
npm run login:manual -- admin
BASE_URL=https://qa.careerforce.link npx playwright test tests/stage/block-placement
```

## Scope

- Creates one custom block, places it, then removes the
  placement and deletes the block in `finally` — a block left behind is
  visible to every visitor on the site.
- Visibility is checked from an anonymous context.

## Persona / fixtures

- **Admin** — `playwright/.auth/admin.json`.
- **Anonymous** — a logged-out context, for visibility checks.
- Block description and body text: `Playwright test <timestamp>`.

## Test cases

| ID | Title | Persona | Steps | Assertions | Notes |
|---|---|---|---|---|---|
| BP-1 | Create custom block content | Admin | `goto('/block/add/basic')`, enter a unique description and body, Save | Status message confirms the save; the block is listed in the content block library | |
| BP-2 | Place a custom block on every page | Admin, Anonymous | `goto('/admin/structure/block')`, "Place block" in a content region (theme default), choose the BP-1 block, Save | Anonymous context sees the block's body text on `/` and on `/events` | Region choice — pick one that renders on both pages; confirm during generation |
| BP-3 | Restrict a block to one page | Admin, Anonymous | Configure the placement from BP-2: Visibility → Pages → "Show for the listed pages" → `/events`, Save | Anonymous context sees the text on `/events` and does **not** see it on `/` | This is the "page restricted block" from the source checklist |
| BP-4 | Remove a block | Admin, Anonymous | Remove the placement, then delete the block content | Status messages confirm both; the text no longer appears on `/events` or `/` | Same steps the `finally` cleanup runs |

## Non-goals

- Notifications / alerts block ([MNDEED-7946](https://portland-webworks.atlassian.net/browse/MNDEED-7946),
  §10) — off-peak only; add as its own plan later.
- Layout Builder — not used on this site.

## Open questions

1. Is the page cache cleared on block save, or does the
   anonymous check need a cache-busting query string?
2. Which region is safest to place a test block in so it can't break
   layout for a real tester working at the same time?

## Suggested files

```
tests/
  stage/block-placement/
    block-placement.spec.ts   # BP-1 .. BP-4
  pages/
    block-layout.page.ts      # place, configure visibility, remove
```
