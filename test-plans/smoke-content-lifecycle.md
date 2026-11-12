# [Smoke] - Content Lifecycle - Test Plan

Status: implemented
Implemented test: tests/smoke/content-lifecycle/*.spec.ts
Prod: No: creates, publishes, translates and deletes test pages.

Devices: desktop only. Admin and editor screens are not tested on a phone (`DESKTOP_ONLY_SMOKE_AREAS` in `tests/helpers/devices.mts`).

From the team's manual checklist on Confluence,
[DEED Smoke Testing Template](https://portland-webworks.atlassian.net/wiki/spaces/MNDEED/pages/1540882433):
"unpublish (archive) a page", "revert previous versions", "view older
versions with no errors", "translate a page", and "after the page is
created and published, confirm that it can be found via a keyword search".

## Running it

```bash
npm run login:manual -- admin
BASE_URL=https://qa.careerforce.link npx playwright test tests/smoke/content-lifecycle --project=smoke-desktop
```

## Scope

- Each case creates its own Page, titled `Playwright test <timestamp>`, and
  deletes it (with any translation) in `finally`.
- A published test page is visible to visitors for the few seconds the case
  runs, and the search can find it. That's why the plan is no-prod.
- What visitors see is checked in a second, logged-out browser context.

## Login and test data

- **Admin** (`admin`): `playwright/.auth/<env>/admin.json`. See
  [smoke-admin-maintenance.md → Login](smoke-admin-maintenance.md#login).
  The checklist is done as an admin, and admin can delete any page, so
  cleanup needs no other login.
- **Visitor**: a logged-out context, for the visibility checks.

## What the site has

Checked on QA with the admin session on 2026-11-12, without saving anything.

- **Moderation.** Pages use the "Content Review" workflow
  (`/admin/config/workflow/workflows/manage/editorial`), not a Published
  checkbox. States: Draft, Review Draft, Published, Pending Updates, Review
  Updates, Archived. Transitions include Publish (to Published), Archive
  (any state to Archived), Restore (Archived to Published) and Return to
  Draft. On `/node/add/page` the select is "Save as"
  (`moderation_state[0][state]`) with Draft (default), Review Draft,
  Published and Archived. The same workflow covers Program or Service and
  Training Program.
- **Addresses.** Pages get an automatic alias from the title (pathauto), and
  the tabs use it: `/<alias>/edit`, `/<alias>/revisions`,
  `/<alias>/translations`, `/<alias>/delete`.
- **Content list.** `/admin/content` filters by Title, Content type,
  "Published status" (Published / Unpublished) and Language. There's also a
  "Moderated content" tab (`/admin/content/moderated`).
- **Revisions.** There's no "Create new revision" checkbox: every save of a
  moderated page makes a revision, with an optional "Revision log message".
  `/<alias>/revisions` ("Revisions for <title>") lists them newest first
  with the Diff module's "Compare selected revisions". The newest row says
  "Current revision"; each older row links its date to
  `/<alias>/revisions/<vid>/view` and has "Revert" (`…/revert`) and Delete.
- **Translation.** Languages: English (default), Spanish (`/es/`) and Somali
  (`/so/`). `/<alias>/translations` ("Translations of <title>") has one row
  per language; a missing one says "Not translated" with an "Add" link to
  `/es/node/<nid>/translations/add/en/es`.
- **Search.** The General site content index has "Index items immediately"
  on, so a saved page is searchable without cron. The site search is
  `/search?k=<keywords>`.

## Test cases

Every case runs as `admin` and starts by creating a Page at
`/node/add/page` with a unique title and a body text; the steps say what
"Save as" to pick. **Cleanup** in every case: delete the page
(`/<alias>/delete`, confirm), which also deletes its translations.

| ID | Test | Page | Steps | Expected result |
|---|---|---|---|---|
| CL-1 | Create and publish a page | `/node/add/page` | 1. Enter the title and body, set "Save as" to Published and click "Save". 2. As a visitor, open the page's address. | **1.** A status message confirms the page was created; the page's address is its alias, and its H1 is the title. **2.** The visitor sees the title and body. |
| CL-2 | Archive a page, then restore it | The new page's `/<alias>/edit` | Create a published page as in CL-1. 1. Edit it, change the moderation state to Archived and click "Save". 2. As a visitor, open its address. 3. As the admin, open its address, then `/admin/content` filtered by its title. 4. Edit it again, change the state to Published and click "Save"; then, as a visitor, open its address again. | **1.** A status message confirms the save. **2.** The visitor gets "Access denied" (HTTP 403), and neither the title nor the body shows. **3.** The admin still sees the page, and the content list shows it as Unpublished. **4.** The visitor sees the page again. |
| CL-3 | Revisions list and an old revision | The new page's `/<alias>/revisions` | 1. Create a published page with the body "Revision 1". 2. Edit it to "Revision 2" and save, then to "Revision 3" and save. 3. Open the Revisions tab. 4. Click the date of the oldest revision. | **1.** The page shows "Revision 1". **2.** The page shows "Revision 3". **3.** "Revisions for <title>" lists at least 3 revisions, and the newest says "Current revision". **4.** The old revision opens at `/<alias>/revisions/<vid>/view` and shows "Revision 1", with no error message. |
| CL-4 | Revert to an older revision | The new page's `/<alias>/revisions` | Set up the page as in CL-3. 1. Click "Revert" on the oldest revision and confirm. 2. Open the page. 3. Open the Revisions tab again. | **1.** A status message confirms the revert. **2.** The page shows "Revision 1". **3.** There's one more revision than before, and it's the current one. |
| CL-5 | Translate a page, then delete the translation | The new page's `/<alias>/translations` | Create a published page as in CL-1. 1. Open the Translate tab and click "Add" for Spanish. 2. Enter a Spanish title and body, set "Save as" to Published, and click "Save". 3. As a visitor, open the Spanish page and the English page. 4. Back on the Translate tab, delete the Spanish translation and confirm. | **1.** The add form opens at `/es/node/<nid>/translations/add/en/es`. **2.** A status message confirms the save, and the Translate tab shows Spanish as Published. **3.** The Spanish page, under `/es/`, shows the Spanish title; the English page still shows the English title. **4.** A status message confirms the deletion, with no error message or PHP error, and Spanish is "Not translated" again. |
| CL-6 | A published page can be found by search | `/search?k=<title>` | 1. Create a published page as in CL-1, with a unique word in its title. 2. As a visitor, search the site for that word. | **1.** A status message confirms the page was created. **2.** At least one result links to the new page. |

CL-5 step 4 is where
[MNDEED-8191](https://portland-webworks.atlassian.net/browse/MNDEED-8191)
("Deleting translation throws PHP error") showed. It's Done, so the case
expects no error, as in the checklist's "Translate a page" item.

## Non-goals

- Content parity against Live, the "review custom built pages" item, and
  the "recreate a complex page" exercise (§18): stay manual.
- Rich text editing inside the body: covered by the
  [CKEditor plan](smoke-ckeditor.md).
- The review states (Review Draft, Pending Updates, Review Updates) and
  Compare selected revisions.

## Open questions

1. Should these cases also run as `content-manager`, the role that does
   this work day to day? No content-manager login is saved for QA yet.

## Suggested files

```
tests/
  smoke/content-lifecycle/
    publish.spec.ts       # CL-1, CL-2, CL-6
    revisions.spec.ts     # CL-3, CL-4
    translation.spec.ts   # CL-5
  pages/
    node-form.page.ts     # add/edit/delete a page, set the moderation state (shared with ckeditor)
    revisions.page.ts
  helpers/
    test-data.ts          # uniqueTitle()
```
