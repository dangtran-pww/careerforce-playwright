# [Smoke] - Block Placement - Test Plan

Status: implemented
Implemented test: tests/smoke/block-placement/*.spec.ts
Prod: No: places a block that every visitor sees.

Devices: desktop only. Admin and editor screens are not tested on a phone (`DESKTOP_ONLY_SMOKE_AREAS` in `tests/helpers/devices.mts`).

The team's manual checklist on Confluence,
[DEED Smoke Testing Template](https://portland-webworks.atlassian.net/wiki/spaces/MNDEED/pages/1540882433),
asks to "review the process of placing existing block content: custom
blocks, page restricted block". These cases do that with a throwaway block.

## Running it

```bash
npm run login:manual -- admin
BASE_URL=https://qa.careerforce.link npx playwright test tests/smoke/block-placement --project=smoke-desktop
```

## Scope

- Creates one content block, places it, restricts it to one page, then
  removes the placement and deletes the block. The test does the removal in
  `finally` as well: a block left behind shows in the footer of every page
  for every visitor.
- What visitors see is checked in a second, logged-out browser context.
- The cases share one block and run in order (BP-1 to BP-4), in one spec.

## Login and test data

- **Admin** (`admin`): `playwright/.auth/<env>/admin.json`. See
  [smoke-admin-maintenance.md → Login](smoke-admin-maintenance.md#login).
- **Visitor**: a logged-out context, for the visibility checks.
- Block description `Playwright test <timestamp>`; body text
  `Playwright block body <timestamp>`, so a visibility check matches only
  this run's block.

## What the site has

Checked on QA with the admin session on 2026-11-12, without saving anything.

- **Block types.** There is no "Basic block" type, so `/block/add/basic` is
  "Page Not Found". The types are Alert & Notification, Call to Action,
  Contact Info, Generic text block, Image Carousel, Link Group, Paragraph and
  Sidebar Nav. **Generic text block** is the plain one:
  `/block/add/generic_text_block`, heading "Add Generic text block content
  block". Fields: "Block description" (`info[0][value]`), "Body" (CKEditor,
  text format Full HTML by default), an optional link ("URL", "Link text"),
  "Language" (English by default), "Gray background" and "Revision log
  message". Buttons: "Save" and "Save and configure".
- **Block library.** `/admin/content/block`, heading "Custom block
  library", filtered by "Block description" and "Block type"; each row has
  Edit and Delete.
- **Block layout.** `/admin/structure/block` shows the site theme,
  "CareerForce Skin" (`careerforce_skin`). Each region has a "Place block"
  link to `/admin/structure/block/library/careerforce_skin?region=<region>`,
  where each block has its own "Place block" link to the "Configure block"
  form.
- **Region.** Use **Footer Content** (`footer`). It is on every page (the
  footer's contact block is in it), so the block shows on `/` and on the
  events page. Sub-content is not used: it isn't on the homepage.
- **Configure block form.** "Title" and "Display title" (ticked by
  default), "Block Visibility Groups" (default "No Block Visibility Group";
  the site has one group, for the blue page-title banner), a long list of
  visibility tabs, the region, and "Save block". The **Pages** tab has a
  "Pages" box (`visibility[request_path][pages]`) and the choices "Show for
  the listed pages" (default) and "Hide for the listed pages". The **Roles**
  tab lists the site's roles.
- **Events page.** `/events` redirects (301) to
  `/education-and-training/events`, so the cases use the second address.
- **Page cache.** Visitors get pages from Drupal's page cache
  (`x-drupal-cache: HIT`, `cache-control: max-age=300, public`), with no CDN
  in front, on QA and on Stage. Saving or removing a block clears the cached
  pages that show it, so the visitor checks need no cache-busting query. A
  new logged-out context has no browser cache. If a visitor still sees the
  old page after a save, that is a bug to report.

## Test cases

| ID | Test | Page | Steps | Expected result |
|---|---|---|---|---|
| BP-1 | Create a content block | `/block/add/generic_text_block` | 1. Enter the block description and body text (see "Login and test data") and click "Save". 2. Open `/admin/content/block` and filter by the block description. | **1.** A status message confirms the block was created, with no error message. **2.** The block is listed once, with the type "Generic text block". |
| BP-2 | Place the block on every page | `/admin/structure/block` | Use the block from BP-1. 1. Click "Place block" for the Footer Content region, find the block by its description, and click its "Place block". 2. Untick "Display title", leave the visibility settings and "Block Visibility Groups" as they are, and click "Save block". 3. As a visitor, open `/` and `/education-and-training/events`. | **1.** The "Configure block" form opens with the Footer Content region chosen. **2.** Block layout shows a status message confirming the save, and the block is listed under Footer Content. **3.** Both pages show the body text in the footer (`.region--footer`). |
| BP-3 | Restrict the block to one page | `/admin/structure/block` | Use the placement from BP-2. 1. Open its "Configure", go to the Pages tab, enter `/education-and-training/events`, keep "Show for the listed pages", and click "Save block". 2. As a visitor, open `/education-and-training/events` and `/`. | **1.** A status message confirms the save. **2.** The events page shows the body text, and `/` doesn't. |
| BP-4 | Remove the block | `/admin/structure/block` | Use the block from BP-1 and its placement. 1. Remove the placement: in the block's operations, click "Remove" and confirm. 2. Delete the block: in `/admin/content/block`, click its "Delete" and confirm. 3. As a visitor, open `/education-and-training/events` and `/`. | **1.** A status message confirms the removal, and the block is no longer under Footer Content. **2.** A status message confirms the deletion, and filtering the library by the description lists nothing. **3.** Neither page shows the body text. |

BP-4 is also the test's cleanup: the spec runs its steps in `finally`,
skipping a step whose item doesn't exist.

## Non-goals

- Notifications and alerts (the Alert & Notification block type, placed in
  Page Pre Top or Notifications), from the checklist's "Notifications/alerts
  as applicable" item. They show on every page, so they're tested off-peak
  only; add them as their own plan later.
  [MNDEED-7946](https://portland-webworks.atlassian.net/browse/MNDEED-7946)
  (notification border box shrinking) is Done.
- Layout Builder: not used on this site.
- Block Visibility Groups and the other visibility tabs beyond Pages.

## Open questions

None at the moment.

## Suggested files

```
tests/
  smoke/block-placement/
    block-placement.spec.ts   # BP-1 .. BP-4, in order, with cleanup in finally
  pages/
    block-layout.page.ts      # create block, place, set Pages visibility, remove, delete
```
