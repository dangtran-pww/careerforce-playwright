# [Stage] - Content Lifecycle - Test Plan

Status: ready to generate
Implemented test: —

Split out from [deed-smoke-test-plan.md](../docs/deed-smoke-test-plan.md)
§13 (publish/unpublish, revisioning) and §17 (translation), Phase 2.

## Running it

```bash
npm run login:manual -- content-manager
BASE_URL=https://qa.careerforce.link npx playwright test tests/stage/content-lifecycle
```

## Scope

- Creates, edits, and deletes a throwaway Basic page.
- One page per test, titled `Playwright test <timestamp>`, deleted (with any
  translations) in a `finally` block.
- Anonymous checks use a fresh browser context with no `storageState`.

## Persona / fixtures

- **Content manager** — `playwright/.auth/content-manager.json`.
- **Anonymous** — a second, logged-out context, for visibility checks.

## Test cases

| ID | Title | Persona | Steps | Assertions | Notes |
|---|---|---|---|---|---|
| CL-1 | Create and publish a page | Content manager | `goto('/node/add/page')`, enter a unique title and body, set state to Published, Save | Status message confirms the save; the page shows the title as its H1; an anonymous context can open the page URL and sees the title | |
| CL-2 | Unpublish (archive) a page | Content manager, Anonymous | Create a published page (as CL-1). Edit it, change the state to Archived (or uncheck Published, whichever this content type uses), Save | Anonymous context gets "Access denied" / 403 or 404 for the URL; content manager can still open it and sees it marked unpublished; it shows as unpublished on `/admin/content` | Source checklist calls this "unpublish (archive)" — confirm the moderation states (open question 1) |
| CL-3 | Revisions list and old revisions render | Content manager | Create a page with body "Revision 1". Edit body to "Revision 2", save; edit to "Revision 3", save. `goto('/node/<nid>/revisions')`. Open the oldest revision | Revisions list has at least 3 rows; the oldest revision page shows "Revision 1" with no error messages | Make sure "Create new revision" is on when saving, if the form shows it |
| CL-4 | Revert to an older revision | Content manager | From CL-3's state, click "Revert" on the oldest revision and confirm | Status message confirms the revert; the page body now shows "Revision 1"; the revisions list has one more row than before | |
| CL-5 | Translate a page | Content manager | Create a published page. `goto('/node/<nid>/translations')`, click Add for the enabled second language, enter a translated title and body, Save | The translated URL (e.g. `/es/...`) shows the translated title; the original-language page still shows the original title | Write to the expected behaviour. [MNDEED-8191](https://portland-webworks.atlassian.net/browse/MNDEED-8191) is open, so mark with `test.fail()` and the ticket link until it is fixed. Which language — open question 2 |
| CL-6 | Published page is findable by search | Content manager | Create and publish a page with a unique title, then run a site search for that title | At least one result links to the new page | Depends on indexing being immediate — open question 3. If it isn't, run cron or "Index now" first, or drop this case |

## Non-goals

- Content parity against Live and the "recreate a complex page" exercise
  (§18) — stays manual.
- Rich text editing inside the body — covered by the
  [CKEditor plan](smoke-ckeditor.md).

## Open questions

1. Does the Basic page type use content moderation (Draft / Published /
   Archived) or a plain Published checkbox? The steps and the CL-2
   assertion differ.
2. Which language(s) are enabled for translation?
3. Does saving a node index it right away (`index directly` on the General
   index), or does it wait for cron?
4. Does the content manager role have permission to delete its own nodes
   (needed for cleanup)? If not, cleanup needs the admin session.

## Suggested files

```
tests/
  stage/content-lifecycle/
    publish.spec.ts       # CL-1, CL-2, CL-6
    revisions.spec.ts     # CL-3, CL-4
    translation.spec.ts   # CL-5
  pages/
    node-form.page.ts     # add/edit/delete a page, set state
    revisions.page.ts
  helpers/
    test-data.ts          # uniqueTitle()
```
