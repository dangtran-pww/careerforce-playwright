---
name: publish-report-confluence
description: Publish a test report made by /test-plan-report (reports/<plan>-<stamp>/report.md) to Confluence as a new page under a given parent, with every step screenshot uploaded and shown in place, then check the live page to confirm no image was dropped. Use when the user asks to upload, publish, post, or share a test report on Confluence.
argument-hint: <report-dir> <confluence-parent-url>
---

# Publish a test report to Confluence

Arguments: `$ARGUMENTS`. They name a report folder (for example
`reports/smoke-anonymous-2026-11-02-0511`) and a Confluence URL. The new page
goes under the page or space at that URL.

The page shows the report as written. Don't rewrite or summarize it. If the
report itself is wrong, fix `report.md` first and then publish.

**Why there's a script.** Confluence silently drops an image that sits inside a
list item. The report puts each step's screenshot inside the numbered step,
so a hand-made conversion loses images without any error. That is how the
first smoke-anonymous page lost 13 of its 24 screenshots.
[scripts/confluence-report.mjs](../../../scripts/confluence-report.mjs) does
the risky parts in code:

- It uploads every screenshot.
- It converts the Markdown, ending each list before an image and resuming
  the numbering after it.
- It refuses to write the page if any image is missing.

Never build or edit the page HTML by hand.

## 1. Inputs

- **Report folder:** if none was given, list the `reports/*/report.md`
  files, newest first, and ask which one to publish. Then stop.
- **Parent:** if no Confluence URL was given, ask for one. Then stop. From the
  URL, take:
  - `cloudId`: the hostname, e.g. `portland-webworks.atlassian.net`.
  - The space key: the part after `/spaces/`, e.g. `DTS`.
  - The parent ID:
    - the number after `/pages/` for a page URL;
    - the `homepageId=` value for a space overview URL;
    - otherwise, call `getConfluenceSpaces` with `keys: <KEY>` and use its
      `homepageId`.

## 2. Check the report

```bash
node scripts/confluence-report.mjs check <report-dir>
```

It prints the page title and each image the report uses. If any image is
`MISSING`, stop and tell the user. Don't publish a report that has broken
images.

## 3. Load the Confluence tools

Load them all in one ToolSearch call:

- `mcp__claude_ai_Atlassian_Rovo__createConfluencePage`
- `mcp__claude_ai_Atlassian_Rovo__updateConfluencePage`
- `mcp__claude_ai_Atlassian_Rovo__getConfluencePage`
- `mcp__claude_ai_Atlassian_MCP__executeWrite`

If the Atlassian tools are missing or need authorization, tell the user and
stop.

## 4. Create the page

Call `createConfluencePage` with:

- `cloudId`
- `spaceId`: the space key
- `parentId`
- `title`: the title from step 2
- `body`: `<p>Report is being uploaded.</p>`

Note the returned `id` (the page ID) and `_links` (`base` + `webui` is the
page URL).

If creation fails because a page with that title already exists, ask the user
whether to update that page or stop. To update it, find its ID, read it with
`getConfluencePage`, and continue from step 5 with that ID.

## 5. Upload the screenshots

Prepare an upload token for the page:

```
executeWrite  name: createConfluenceAttachment
              cloudId: <cloudId>
              inputs: { contentId: <page id>, localFilePath: <report-dir>/report.md }
```

Take `uploadUrl` and `mediaToken` from the result. One token covers every
upload to this page for about 5 minutes.

Run the upload right away:

```bash
NODE_USE_ENV_PROXY=1 CONFLUENCE_MEDIA_TOKEN='<mediaToken>' \
  node scripts/confluence-report.mjs upload <report-dir> '<uploadUrl>'
```

- `NODE_USE_ENV_PROXY=1` makes Node send its requests through the sandbox's
  network proxy. Without it, the upload fails with `getaddrinfo EAI_AGAIN`.
  Also pass the Confluence host in `allowed_domains`. If the sandbox still
  blocks the request, rerun the command outside the sandbox.
- Never show the token in your reply or write it to a file.
- **Exit code 2** means the token expired. Prepare a new token and rerun the
  same command. Images that already uploaded are skipped.
- **Exit code 1** means some uploads failed (they are listed). Rerun once. If
  uploads still fail, stop and report which images failed and the HTTP error.

The script records each image's Confluence file ID in
`<report-dir>/confluence/media.json`.

## 6. Build the page body

```bash
node scripts/confluence-report.mjs html <report-dir>
```

This writes three files to `<report-dir>/confluence/`:

- `body.html`: the page body.
- `title.txt`: the page title.
- `expected.json`: the image count and the file IDs that the page must
  contain.

It fails if any image has no uploaded file or was not placed in the page.

## 7. Publish

Read `body.html` and call `updateConfluencePage` with:

- `cloudId`
- `pageId`
- `title`: the contents of `title.txt`
- `contentFormat: "html"`
- `body`: the **entire** contents of `body.html`, exactly as written. Don't
  retype, reformat, shorten, or "fix" any part of it, and in particular don't
  move any `<figure>` into a list.
- `versionMessage: "Publish test report"`

## 8. Verify every image is on the live page

Call `getConfluencePage` with `contentFormat: "html"`. In the returned body:

1. Count the `data-type="media"` elements. The count must equal
   `imageCount` in `expected.json`.
2. Check that every file ID in `expected.json` appears as a `data-id`.
3. Check that no `<li>` contains a `<figure>`.

If an image is missing, look up its report path in `media.json` and republish
once from `body.html` (step 7). Then verify again. If it is still missing,
tell the user exactly which screenshots are missing, and don't call the page
complete.

## 9. Tell the user

Reply briefly with:

- The page link, as a clickable URL.
- The title and the parent it was published under.
- The image check, e.g. "24 of 24 screenshots verified on the live page", or
  the screenshots that are missing.
