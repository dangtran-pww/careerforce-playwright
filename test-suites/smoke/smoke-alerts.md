# [Smoke] - Alerts and Notifications - Test Plan

Status: ready to generate
Implemented test: —
Prod: No: places an alert and a notification that every visitor sees on every page; the checklist also says not to test this on Production during prime time.

Devices: desktop only. Admin and editor screens are not tested on a phone (`DESKTOP_ONLY_SMOKE_AREAS` in `tests/helpers/devices.mts`). The visitor checks also stay on desktop: the alert and notification markup has no phone-specific layout (no breakpoint classes in the component template), and both regions are printed the same way at every width, so a phone run would repeat the desktop checks while placing the blocks a second time.

The team's manual checklist on Confluence,
[DEED Smoke Testing Template](https://portland-webworks.atlassian.net/wiki/spaces/MNDEED/pages/1540882433),
asks for "(don't test on prod during prime time) Notifications/alerts as
applicable: admin/structure/block (make sure both notifications and alerts
are working)". These cases do that with two throwaway blocks of the type
"Alert & Notification": one of each kind. They also check the layout fixed
by [MNDEED-7946](https://portland-webworks.atlassian.net/browse/MNDEED-7946)
(notification border box shrinking, Done).

## Running it

```bash
npm run login:manual -- admin
BASE_URL=https://qa.careerforce.link npx playwright test tests/smoke/alerts --project=smoke-desktop
```

## Scope

- Creates two Alert & Notification blocks, an alert and a notification,
  places the alert in Page Pre Top and the notification in Notifications,
  checks them as a visitor, then removes both placements and deletes both
  blocks. The test does the removal in `finally` as well: a block left
  behind shows at the top of every page for every visitor.
- What visitors see is checked in a second, logged-out browser context.
- The cases share the two blocks and run in order (AL-1 to AL-5), in one
  spec.

## Login and test data

- **Admin** (`admin`): `playwright/.auth/<env>/admin.json`. See
  [smoke-admin-maintenance.md → Login](smoke-admin-maintenance.md#login).
- **Visitor**: a logged-out context, for the visibility checks.
- Alert block: description `Playwright test <timestamp> alert`, body text
  `Playwright alert body <timestamp>`.
- Notification block: description `Playwright test <timestamp> notification`,
  body text `Playwright notification body <timestamp>`. Keep it this short:
  a short text is what made the bordered box shrink before MNDEED-7946.

## What the site has

**From [smoke-block-placement.md](smoke-block-placement.md)** (checked on QA
with the admin session on 2026-11-12):

- The block types include **Alert & Notification**. Block library
  `/admin/content/block` (filter by "Block description" and "Block type",
  Edit and Delete per row), Block layout `/admin/structure/block` for the
  "CareerForce Skin" theme, each region's "Place block" link to
  `/admin/structure/block/library/careerforce_skin?region=<region>`, the
  "Configure block" form ("Title", "Display title" ticked by default, the
  visibility tabs, "Save block"), and "Remove" in a placement's operations.
- `/events` redirects to `/education-and-training/events`, so the cases use
  the second address.
- Visitors get pages from Drupal's page cache with no CDN in front, on QA
  and Stage. Saving or removing a block clears the cached pages that show
  it, so the visitor checks need no cache-busting query. If a visitor still
  sees the old page after a save, that is a bug to report.

**From the KB and the mn-careerforce source at commit `fda433001`** (not
checked on a running site):

- **Block type.** `alert_notification`, label "Alert & Notification", so the
  add form appears to be `/block/add/alert_notification`. Form fields, in
  order: Block description, **Color** (a box widget offering `#005cab`,
  `#b12028`, `#ad6400`, `#ffb606`, `#328721`, `#6F2277`; optional), **Icon**
  (an icon picker; default "info-circle"; optional), **Body** (required),
  Language, and **Type** (a select: "Notification", the default, or
  "Alert"; required). Config: `config/sync/block_content.type.alert_notification.yml`,
  `field.field.block_content.alert_notification.*.yml`,
  `field.storage.block_content.field_type.yml`,
  `core.entity_form_display.block_content.alert_notification.default.yml`.
- **Regions.** Page Pre Top (`page_pre_top`) is printed in
  `templates/layout/html.html.twig` as the first thing in `<body>`, before
  the "Skip to main content" link (`.skip-link`); it appears to have no
  region wrapper `div`, because `Preprocess/Html.php` builds it with
  twig_tweak's `RegionViewBuilder`. Notifications (`notifications`) is
  printed first inside the page header (`header#page__header`) in
  `templates/layouts/page.html.twig`, above both the mobile and the desktop
  header. Neither region has an enabled block in config; the site's old
  alerts sit disabled in them (mostly Page Pre Top, one in Notifications).
  The site theme is only used on the public pages; the admin theme is
  Claro, so the blocks don't show on admin pages.
- **Markup** (`components/sdc-alert-notification/sdc-alert-notification.twig`,
  picked by the Type field):
  - **Alert:** a full-width bar, text centred, small text, with
    `role="status"`. With a Color, its background is that color and the
    text, links and icon are white (dark text for `#ffb606`).
  - **Notification:** a row: the icon in a box filled with the Color (at
    least 7.3rem wide), then the text in a box with a gray border and
    rounded right corners. MNDEED-7946 (commit `9cf7d92a21`) added
    `tw-grow` to that text box so it fills the rest of the row.
  - `BlockPreprocessor.php` gives the block's wrapper `role="alert"` for
    both kinds (MNDEED-6886), and gives the icon `role="img"`, an
    `aria-label` and a `title` from the icon's alt text.
- **No dismiss.** Neither the component nor the theme or custom modules have
  a close or dismiss control, or any script for one (searched for "dismiss"
  and for the component name). An alert or notification shows on every page
  view until it is removed, so there is no "stays dismissed" behaviour to
  test.
- **Location announcements** (`docs/kb/locations/location-announcements.md`)
  are a separate kind of notice: `announcement` entities that location and
  account managers add per group or location under
  `/group/{group}/announcement`, shown in the Status region of group and
  location pages only, with start and end dates. They are not managed in
  `admin/structure/block`, which is what the checklist item names, so they
  are not covered here (see Non-goals).

## Test cases

| ID | Test | Page | Steps | Expected result |
|---|---|---|---|---|
| AL-1 | Create an alert and a notification | `/block/add/alert_notification` | 1. Enter the alert's description and body text (see "Login and test data"), pick the color `#b12028`, leave the icon as it is, set Type to "Alert" and click "Save". 2. Open the add form again, enter the notification's description and body text, pick the color `#005cab`, leave the icon and Type ("Notification") as they are, and click "Save". 3. Open `/admin/content/block` and filter by `Playwright test <timestamp>`. **Cleanup:** AL-5. | **1.** A status message confirms the block was created, with no error message. **2.** A status message confirms the block was created, with no error message. **3.** Both blocks are listed once each, with the type "Alert & Notification". |
| AL-2 | Alert shows on every page | `/admin/structure/block` | Use the alert from AL-1. 1. Click "Place block" for the Page Pre Top region, find the alert by its description, and click its "Place block". 2. Untick "Display title", leave the visibility settings as they are, and click "Save block". 3. As a visitor, open `/` and `/education-and-training/events`. **Cleanup:** AL-5. | **1.** The "Configure block" form opens with the Page Pre Top region chosen. **2.** Block layout shows a status message confirming the save, and the alert is listed under Page Pre Top. **3.** On both pages the alert body text shows once, at the top of the page before the "Skip to main content" link and outside the page header; it is inside an element with `role="alert"`; its bar has the background color `#b12028` (rgb(177, 32, 40)) and white text. |
| AL-3 | Notification shows on every page | `/admin/structure/block` | Use the notification from AL-1. 1. Click "Place block" for the Notifications region, find the notification by its description, and click its "Place block". 2. Untick "Display title", leave the visibility settings as they are, and click "Save block". 3. As a visitor, open `/` and `/education-and-training/events`. **Cleanup:** AL-5. | **1.** The "Configure block" form opens with the Notifications region chosen. **2.** Block layout shows a status message confirming the save, and the notification is listed under Notifications. **3.** On both pages the notification body text shows once, inside the page header (`#page__header`) above the site menu; it is inside an element with `role="alert"`; the icon box beside it has the background color `#005cab` (rgb(0, 92, 171)); the alert from AL-2 still shows too. |
| AL-4 | Notification text box fills the row (MNDEED-7946) | `/` | Use the placement from AL-3; check as a visitor at 1280x800, without saving anything. 1. Open `/`. 2. Measure the notification's icon box, the bordered text box beside it, and the row that holds both. | **1.** The notification shows. **2.** The bordered text box starts where the icon box ends and its right edge is within 2px of the row's right edge, so the box is much wider than its short text; the icon box and the text box are the same height. |
| AL-5 | Remove the alert and the notification | `/admin/structure/block` | Use the blocks from AL-1 and their placements. 1. Remove both placements: in each block's operations, click "Remove" and confirm. 2. Delete both blocks: in `/admin/content/block`, click each one's "Delete" and confirm. 3. As a visitor, open `/` and `/education-and-training/events`. | **1.** A status message confirms each removal, and neither block is listed under Page Pre Top or Notifications. **2.** A status message confirms each deletion, and filtering the library by `Playwright test <timestamp>` lists nothing. **3.** Neither page shows the alert or the notification body text. |

AL-5 is also the test's cleanup: the spec runs its steps in `finally`,
skipping a step whose item doesn't exist.

## Non-goals

- Dismissing an alert or notification: the site has no dismiss control
  (see "What the site has").
- Location announcements: a separate feature, managed per group and shown
  only on group and location pages, not in `admin/structure/block`. If the
  team wants them in the smoke run, add them as their own plan (create one
  for a test location, check its group or location page, delete it).
- Restricting the alert to some pages: the Pages tab is covered by BP-3 in
  [smoke-block-placement.md](smoke-block-placement.md).
- Alert colors other than the two used, the `#ffb606` dark-text case,
  other icons, and alerts in other regions (some old ones sit in
  Pre-content or Status).
- Phone width: see "Devices" above.

## Open questions

- Does the checklist's "notifications" mean the Notification type of this
  block, as assumed here, or location announcements? If it is announcements,
  they need their own plan.
- How does the Color box widget take a value (click a swatch, or type a
  hex code)? The plan picks two of its offered colors; check the form on QA
  when generating.
- Is Page Pre Top for alerts and Notifications for notifications still how
  the team places them? The source only has disabled examples, and it
  can't show which Type each old block uses.

## Suggested files

```
tests/
  smoke/alerts/
    alerts.spec.ts            # AL-1 .. AL-5, in order, with cleanup in finally
  pages/
    block-layout.page.ts      # reuse from block-placement: place, remove, delete
```
