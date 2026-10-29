# [Stage] - Media Browser - Test Plan

Status: ready to generate
Implemented test: —

Split out from [deed-smoke-test-plan.md](../docs/deed-smoke-test-plan.md)
§16, Phase 2.

## Running it

```bash
npm run login:manual -- content-manager
BASE_URL=https://qa.careerforce.link npx playwright test tests/stage/media
```

## Scope

- Uploads small synthetic files and deletes them in
  `finally`, along with any throwaway node used to host a media field.
- Media item names are unique: `Playwright test <timestamp>`.

## Persona / fixtures

- **Content manager** — `playwright/.auth/content-manager.json`.
- `tests/fixtures/sample.jpg` — small image, synthetic.
- `tests/fixtures/sample.pdf` — small one-page PDF, synthetic.

## Test cases

| ID | Title | Persona | Steps | Assertions | Notes |
|---|---|---|---|---|---|
| MB-1 | Browse the library from a media field | Content manager | Open the add form for a content type with a media field. Click "Add media" to open the media library dialog. Select an existing item, Insert. Save the node | The dialog lists at least one existing item; after insert the field shows the selected item; the saved page shows it | Which content type and field — confirm during generation (open question 1) |
| MB-2 | Upload an image through a media field | Content manager | In the media library dialog, upload `sample.jpg`, fill in alt text, Save, Insert. Save the node | The saved page shows the image; the item is listed on `/admin/content/media` | |
| MB-3 | Upload a document to the library | Content manager | `goto('/media/add/document')`, upload `sample.pdf`, give it a unique name, Save | Status message confirms the save; `/admin/content/media` lists it with type Document | |
| MB-4 | Delete newly uploaded media | Content manager | Delete the items from MB-2 and MB-3 via their delete forms | Status message confirms each delete; neither appears on `/admin/content/media` | Written to the expected behaviour. The source doc noted delete as untested and raised [MNDEED-8325](https://portland-webworks.atlassian.net/browse/MNDEED-8325) about file / resume-upload type display. If delete fails, mark `test.fail()` with the ticket rather than asserting the bug |

## Non-goals

- Media embedded in CKEditor — covered by CK-5 in the
  [CKEditor plan](smoke-ckeditor.md).
- Media fields on blocks and components — one field is enough for a smoke
  check; add more cases if a regression shows up there.

## Open questions

1. Which content type has a media field the content manager can use?
2. Can the content manager delete media they uploaded, or does cleanup need
   the admin session?

## Suggested files

```
tests/
  fixtures/
    sample.jpg
    sample.pdf
  stage/media/
    media-library.spec.ts   # MB-1 .. MB-4
  pages/
    media-library.page.ts   # dialog: browse, upload, insert
```
