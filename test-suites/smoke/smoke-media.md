# [Smoke] - Media Browser - Test Plan

Status: implemented
Implemented test: tests/smoke/media/media-library.spec.ts
Prod: No: uploads to and deletes from the media library.

A quick check after each deploy that editors can still use the
media library: browse it from a media field, upload an image and use it in
that field, upload a document, and delete what was uploaded.

Devices: desktop only. Admin and editor screens are not tested on a phone (`DESKTOP_ONLY_SMOKE_AREAS` in `tests/helpers/devices.mts`).

## Scope

- Uploads small synthetic files (`tests/fixtures/`) and deletes them, and
  the Draft pages used to host the media field, after each test, even when
  it fails.
- Media item names and page titles are unique: `Playwright test <token>`.
- The media field is the **Teaser Image** field (`field_teaser_image`) of
  the Page content type, in a collapsed "Teaser Image" section of the form.
  Pages are saved as Draft so visitors never see them.
- Media fields on QA use Entity Browser, not Drupal's media library widget:
  "Select images" opens a dialog that only lists existing media ("Add
  Existing", with "Filter by image name"). None of the site's entity
  browsers has an upload tab, so new media is uploaded on `/media/add/<type>`
  and then picked in the field.
- QA's media types are File, Image, Remote video and Resume: Uploaded.
  There is no "Document" type: a PDF is a **File** media item
  (`/media/add/file`).

## Persona / fixtures

- **Admin** — `playwright/.auth/<env>/admin.json` (`npm run login:manual --
  admin`). The plan first named the content manager; it uses admin, like
  the [CKEditor plan](smoke-ckeditor.md).
- `tests/fixtures/sample.jpg` — 400 × 300 image, synthetic.
- `tests/fixtures/sample.pdf` — one-page PDF, synthetic.

## Test cases

Every case runs as `admin`. ML-1 and ML-2 start the same way: open
`/node/add/page`, enter a unique title and set "Save as" to Draft. "Select
images" is the button in the form's Teaser Image section (open the section
first).

| ID | Test | Page | Steps | Expected result |
|---|---|---|---|---|
| ML-1 | Browse the library from a media field | `/node/add/page` | 1. Click "Select images". 2. Tick the first listed image and click "Select images" in the dialog. 3. Click Save, then open the page's edit form. **Cleanup:** delete the page. | **1.** The dialog opens and lists at least one image. **2.** The dialog closes and the section shows the image. **3.** A status message confirms the save, and the edit form's Teaser Image still holds that image. |
| ML-2 | Use a newly uploaded image in a media field | `/media/add/image`, then `/node/add/page` | 1. On `/media/add/image`, upload `sample.jpg`, give it a unique name and alt text, click Save, then open `/admin/content/media` filtered to the name. 2. On a new page, click "Select images", filter by the name, tick the image and click "Select images" in the dialog. 3. Click Save, then open the page's edit form. **Cleanup:** delete the page and the image. | **1.** A status message confirms the save, and the list has one row with the name, of type Image. **2.** The dialog lists only that image; after selecting, the section shows it. **3.** A status message confirms the save, and the edit form's Teaser Image holds the new image. |
| ML-3 | Upload a document to the library | `/media/add/file` | 1. Upload `sample.pdf`, give it a unique name and click Save. 2. Open `/admin/content/media` filtered to the name. **Cleanup:** delete the file. | **1.** A status message confirms the save, with no error. **2.** The list has one row with the name, of type File. |
| ML-4 | Delete newly uploaded media | `/media/<id>/delete` | Add an image (`/media/add/image`, `sample.jpg`) and a file (`/media/add/file`, `sample.pdf`), each with a unique name. 1. Delete each from its delete form. 2. Open `/admin/content/media` filtered to each name. | **1.** A status message names each item and says it has been deleted. **2.** Neither name is on the list. |

## Non-goals

- Media embedded in CKEditor — covered by CK-5 in the
  [CKEditor plan](smoke-ckeditor.md).
- Media fields on blocks and components — one field is enough for a smoke
  check; add more cases if a regression shows up there.

## Suggested files

```
tests/
  fixtures/
    sample.jpg
    sample.pdf
  smoke/media/
    media-library.spec.ts   # ML-1 .. ML-4
  pages/
    media-library.page.ts   # entity browser field, add forms, list, delete
```
