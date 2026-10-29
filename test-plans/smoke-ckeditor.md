# [Stage] - CKEditor 5 - Test Plan

Status: ready to generate
Implemented test: —

Split out from [deed-smoke-test-plan.md](../docs/deed-smoke-test-plan.md)
§15, Phase 2. The source checklist used
`/testdiversity-manufacturing-initiative-dimi` on QA as its example page;
these tests use a throwaway page instead so they don't edit real content.

## Running it

```bash
npm run login:manual -- content-manager
BASE_URL=https://qa.careerforce.link npx playwright test tests/stage/ckeditor
```

## Scope

- Each test creates one Basic page, edits the body in
  CKEditor, saves, checks the rendered page, and deletes the page in
  `finally`.
- Assertions are on the **rendered page**, not on the editor's internal
  markup, so they test what visitors actually see.
- Click `.ck-editor__editable` before typing (see the README
  troubleshooting section).

## Persona / fixtures

- **Content manager** — `playwright/.auth/content-manager.json`.
- At least one image in the media library (for CK-5). If the library could
  be empty, upload `tests/fixtures/sample.jpg` first.
- `tests/helpers/ckeditor-toolbars.ts` — the expected toolbar buttons per
  text format (for CK-1).

## Test cases

| ID | Title | Persona | Steps | Assertions | Notes |
|---|---|---|---|---|---|
| CK-1 | Toolbar matches expected, per text format | Content manager | Data-driven over Full HTML, Basic HTML, Restricted HTML: `goto('/node/add/page')`, choose the text format under the body field | The toolbar's button labels equal the expected list for that format in `ckeditor-toolbars.ts` | The source checklist compares against Live. The expected lists are captured once by hand from Live (open question 1). If Restricted HTML has no editor (plain textarea), assert that instead |
| CK-2 | Headings | Content manager | In the body, add three lines and set them to Heading 2, Heading 3, Heading 4 from the heading dropdown. Save | The rendered page has an `h2`, `h3`, and `h4` with those texts | |
| CK-3 | Bulleted and numbered lists, including sub-items | Content manager | Add a bulleted list with one indented sub-item and a numbered list with one indented sub-item. Save | The rendered page has a nested bulleted list (`ul li ul`) and a nested numbered list (`ol li ol`) with the expected texts | Sub-bullet styling is known to be minimal — check structure only, not styling |
| CK-4 | Table | Content manager | Insert a 2×2 table from the toolbar, type text in each cell. Save | The rendered page has a table with those 4 cell texts | |
| CK-5 | Media embed | Content manager | Click the toolbar's media button, pick an existing image from the library, insert. Save | The rendered page shows the image (`img` inside the embedded media wrapper) and it loads (natural width > 0) | |
| CK-6 | Basic formatting and links | Content manager | Type text, make one word bold, one italic, and turn one into a link to `/events`. Save | The rendered page has `strong`, `em`, and a link to `/events` with the expected texts | |

## Non-goals

- Pixel styling of editor content — visual review stays manual.
- Configuring text formats (`/admin/config/content/formats`) — read only.

## Open questions

1. Who captures the Live toolbar baseline for CK-1, and how often is it
   refreshed? Suggest: capture once by hand on Live, store in
   `ckeditor-toolbars.ts`, and update it when a ticket changes a toolbar.
2. Can the content manager role pick Full HTML, or is it admin-only? If
   admin-only, CK-1 for Full HTML runs with the admin session.
3. Which content type is the best throwaway target — Basic page, or a type
   whose body allows all three formats?

## Suggested files

```
tests/
  stage/ckeditor/
    toolbar.spec.ts       # CK-1
    formatting.spec.ts    # CK-2 .. CK-6
  pages/
    ckeditor.ts           # helpers: focus editor, pick heading, insert table, etc.
  helpers/
    ckeditor-toolbars.ts  # expected toolbar buttons per format
```
