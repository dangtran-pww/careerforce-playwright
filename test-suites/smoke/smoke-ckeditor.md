# [Smoke] - CKEditor 5 - Test Plan

Status: implemented
Implemented test: tests/smoke/ckeditor/*.spec.ts
Prod: No: creates and deletes test pages.

Devices: desktop only. Admin and editor screens are not tested on a phone (`DESKTOP_ONLY_SMOKE_AREAS` in `tests/helpers/devices.mts`).

From the team's manual checklist on Confluence,
[DEED Smoke Testing Template](https://portland-webworks.atlassian.net/wiki/spaces/MNDEED/pages/1540882433):
toolbars per text format "consistent with Live", tables, media embed,
headers, and the available formatting. The checklist edits
`/testdiversity-manufacturing-initiative-dimi` on QA; these tests use a
throwaway page instead so they don't change real content.

## Scope

- CK-2 to CK-6 each create one Page, edit its Body in CKEditor, save it as
  **Draft** (so visitors never see it), check the saved page, and delete the
  page in `finally`. CK-1 only opens the add form and saves nothing.
- Checks are on the **saved page**, not on the editor's markup, so they
  test what visitors would see.
- Click into the editor (`.ck-editor__editable`) before typing (see the
  README troubleshooting section).

## Login and test data

- **Admin** (`admin`): `playwright/.auth/<env>/admin.json`. See
  [smoke-admin-maintenance.md → Login](smoke-admin-maintenance.md#login).
  The checklist is done as an admin, and admin can use every text format.
- Page title `Playwright test <timestamp>`.
- CK-5 uses an image already in the media library (QA had more than 8 on
  2026-11-12), so it uploads nothing.

## What the site has

Checked on QA with the admin session on 2026-11-12, without saving anything.

- **The page form.** `/node/add/page`, heading "Create Page". The Body has
  a "Text format" select under it (`body[0][format]`, default **Full
  HTML**). "Save as" (`moderation_state[0][state]`) offers Draft (default),
  Review Draft, Published and Archived. The form also has Introduction,
  paragraph buttons ("Add Text Block", "Add Hero", …) and a teaser image,
  which these cases leave empty.
- **Text formats** (`/admin/config/content/formats`) and who can use them:

  | Format | Editor | Roles |
  |---|---|---|
  | Full HTML | CKEditor 5 | Content Manager, Platform Manager, System Administrator |
  | Basic HTML | CKEditor 5 | Anonymous, Authenticated, Location Administrator, System Administrator |
  | Restricted HTML | CKEditor 5 | Content Manager, Platform Manager, System Administrator |
  | HTML Rich Emails | CKEditor 5 | Platform Manager, System Administrator |
  | HTML with embeds | none | Content Manager, Platform Manager, System Administrator |
  | Content HTML | none | System Administrator |
  | Email HTML | none | Platform Manager, System Administrator |
  | Plain text | none | everyone (not offered on the Page body) |

- **Toolbars.** The expected toolbar for each format, read from QA with
  the Body empty. A "·" marks a separator, and "⏎" a line break. "Heading"
  is the dropdown whose label shows the current block ("Normal"); it offers
  Normal and Heading 2 to Heading 6 (there's no Heading 1). "Styles" stays
  disabled until something in the editor is selected.

  | Format | Toolbar |
  |---|---|
  | Full HTML | Full screen · Heading · Undo, Redo · Remove Format · Source ⏎ Block quote, Horizontal line · Bold, Underline, Italic, Strikethrough, Superscript, Subscript · Bulleted List, Numbered List, Decrease indent, Increase indent · Text alignment · Insert Media, File Embed, Link · Insert table, Styles, Accordion Item, Jump Link |
  | Basic HTML | Full screen · Undo, Redo ⏎ Block quote · Bold, Italic · Bulleted List, Numbered List, Increase indent, Decrease indent · Link, Accordion Item, Jump Link |
  | Restricted HTML | Full screen · Heading · Undo, Redo · Source ⏎ Block quote · Bold, Italic · Bulleted List, Numbered List, Increase indent, Decrease indent · Insert Media, Link |
  | HTML Rich Emails | Full screen · Undo, Redo · Source ⏎ Block quote · Bold, Italic, Underline · Bulleted List, Numbered List, Decrease indent, Increase indent · Link |
  | HTML with embeds, Content HTML, Email HTML | no editor: a plain text box |

  Keep this table in `tests/helpers/ckeditor-toolbars.ts` and change both
  when a ticket changes a toolbar. Changing the format while the Body is
  empty switches the editor straight away; with text in it, Drupal asks to
  confirm first.

## Test cases

Every case runs as `admin`. CK-2 to CK-6 start the same way: open
`/node/add/page`, enter the title, keep the text format Full HTML and "Save
as" Draft. "Click Save" below means the form's "Save" button.

| ID | Test | Page | Steps | Expected result |
|---|---|---|---|---|
| CK-1 | The toolbar of each text format is as expected | `/node/add/page` | Choose each of the 7 formats in the Body's "Text format" select, in turn, without typing anything. | **1.** For each CKEditor 5 format, the toolbar has exactly the buttons in the "Toolbars" table above, in that order. **2.** For HTML with embeds, Content HTML and Email HTML, there is no toolbar, only a plain text box. **3.** No JavaScript error. |
| CK-2 | Headings | `/node/add/page` | 1. In the Body, type three lines and set them to Heading 2, Heading 3 and Heading 4 from the Heading dropdown. 2. Click Save. **Cleanup:** delete the page. | **1.** The Heading dropdown shows each line's heading as it is selected. **2.** A status message confirms the save, and the page has an `h2`, an `h3` and an `h4` with those texts. |
| CK-3 | Bulleted and numbered lists with sub-items | `/node/add/page` | 1. Add a bulleted list of two items, and make the second a sub-item with "Increase indent". 2. Add a numbered list the same way. 3. Click Save. **Cleanup:** delete the page. | **1.** The editor shows the sub-item indented under the first bullet. **2.** The editor shows the sub-item indented under item 1. **3.** The page has a nested bulleted list (`ul li ul`) and a nested numbered list (`ol li ol`) with those texts. Only the structure is checked: the checklist notes that sub-bullet and sub-number styling is minimal. |
| CK-4 | Table | `/node/add/page` | 1. Click "Insert table" and pick a 2 × 2 grid. 2. Type a different text in each of the 4 cells and click Save. **Cleanup:** delete the page. | **1.** A 2 × 2 table appears in the editor. **2.** The page has a table with those 4 texts, 2 per row. |
| CK-5 | Media embed | `/node/add/page` | 1. Click "Insert Media". 2. Pick an existing image and insert it. 3. Click Save. **Cleanup:** delete the page. | **1.** The media library dialog opens and lists images. **2.** The image shows in the editor. **3.** The page shows the image inside the embedded media, and it has loaded (its natural width is above 0). |
| CK-6 | Bold, italic and a link | `/node/add/page` | 1. Type a sentence, make one word bold and another italic. 2. Select a third word, click "Link", enter `/education-and-training/events` and confirm. 3. Click Save. **Cleanup:** delete the page. | **1.** The two words show bold and italic in the editor. **2.** The third word is a link in the editor. **3.** The page has a `strong` and an `em` with those words, and a link to `/education-and-training/events` with the third word. |

## Non-goals

- Pixel styling of editor content: visual review stays manual.
- Changing the text formats (`/admin/config/content/formats`): read only.
- File Embed, Accordion Item, Jump Link, Styles and Source editing: on the
  toolbar (checked by CK-1) but not used.
- Comparing with Production: the checklist compares the toolbars with Live,
  which needs an admin login on Production. CK-1 compares with the table
  above instead.

## Open questions

1. The toolbars above were read from QA, not from Production. Does someone
   with Production admin access want to confirm they match before the table
   becomes the baseline?
2. Should these cases also run as `content-manager`, to check that role's
   formats (it has Full HTML, Basic HTML through "Authenticated" and
   Restricted HTML, but not HTML Rich Emails)? No content-manager login is
   saved for QA yet.

## Suggested files

```
tests/
  smoke/ckeditor/
    toolbar.spec.ts       # CK-1
    formatting.spec.ts    # CK-2 .. CK-6
  pages/
    ckeditor.ts           # focus editor, pick heading, insert table, insert media, link
    node-form.page.ts     # add/delete a page (shared with content-lifecycle)
  helpers/
    ckeditor-toolbars.ts  # expected toolbar buttons per format
```
