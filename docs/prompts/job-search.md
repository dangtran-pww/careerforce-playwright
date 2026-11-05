You are a QA engineer doing exploratory and functional testing of the CareerForce
Job Search page. Drive a real browser only through the Playwright MCP tools
(mcp__playwright-test__browser_*). Don't write or run spec files. This is a
manual test session, and the deliverable is a findings report.

## Target
- Base URL: https://qa.careerforce.link/job-search
- QA sits behind HTTP Basic Auth. Open the first page with credentials in the URL:
  https://<BASIC_AUTH_USER>:<BASIC_AUTH_PASSWORD>@qa.careerforce.link/job-search
  (values are in .env). If the page asks for credentials again, stop and tell me.
- Signed-in section only: load the job seeker session with
  browser_set_storage_state from playwright/.auth/jobseeker.json. If that file
  is missing or the session has expired, skip section D and say so.

## How the page works (use this to decide expected results)
- Every form uses GET, so the whole search state lives in the query string:
  title, location[text], radius, sort, company, loc, page, jvid. Submitting any
  one form (keyword, sort, filters) should keep the values of the others.
- Results come live from the CareerOneStop API. Never assert exact counts.
  Assert that results exist, that filters narrow them, and that ordering holds.
- Defaults: location MN, radius 20, sort best-match, 10 per page, at most 500
  results. The pager only shows when there are more than 10 results.
- Location is normalized: "US"/"USA" → United States; a 5-digit ZIP → the ZIP;
  "<city>, <MN|WI|SD|ND|IA or full state name>" → "City, ST", with St/Saint →
  "St.". Radius only changes results when the location is a ZIP.
- Sort options: best-match, date-posted-desc, job-title-asc, company-asc.
- A title like "Registered Nurses (29-1141.00)" is searched by SOC code only.
- Each result shows: title, company, location, snippet, "Posted/Available … ago",
  "Learn more and apply" (external, opens a new tab), Share (copies a
  /job-search?jvid=… URL), Read more, and a bookmark icon.
- /job-search?jvid=<id> shows one posting with the full description, and the
  "Get matched with the right jobs" banner is hidden.
- Known issue: /job-search throws one JavaScript error from the footer JS
  aggregate on every load (see tests/helpers/known-issues.ts). Note it, but
  don't report it as new.
- Suspected bug to confirm: `company` is not in the cache context, so filtering
  by company A and then by company B may return company A's cached results.

## Method for every check
1. Before each interaction, call browser_snapshot and use the refs it returns.
   Don't guess selectors.
2. After each action, check the URL query string, the visible results, and
   browser_console_messages (errors only).
3. Wait for specific text or elements with browser_wait_for. Don't use fixed sleeps.
4. Capture screenshots along the way, not only at the end. Call
   browser_take_screenshot:
   - after every action that changes the page (each search submitted, each
     dropdown or autocomplete opened, each option picked, each dialog shown),
   - once for the final state of every check, and
   - for every failure, at the moment you see it.
   Save them all in reports/job-search-<YYYY-MM-DD-HHMM>/screenshots/ (one folder
   per session; use the session start time). Name each one
   <ID>-<NN>-<short-name>.png, where NN counts up from 01 within the check,
   for example A3-02-fargo-nd.png. Use a viewport screenshot by default, an
   element screenshot (target) for a dropdown or a single result, and
   fullPage only when the check is about the whole page. Before moving on,
   open the screenshot with Read and confirm it shows what the step claims;
   retake it if the page was still loading.
5. If a step fails, record it and move on. Don't stop the session.

## Test cases

### A. Search
- A1 Page load: form fields (keyword, location, distance), sort, filters,
  results, banner, "Jobs for me" block, Services/Resources blocks. Note the
  console errors.
- A2 Keyword + location: "nurse" + "Saint Paul, MN". Results > 0, URL holds
  both values, location shown as "St. Paul, MN" (or check how it's displayed).
- A3 Location formats, each with keyword "nurse": "55101", "Minneapolis,
  Minnesota", "Fargo, ND", "USA", "MN", "Chicago, IL" (not a supported state).
  Record which return results.
- A4 Radius: with ZIP 55101, compare the smallest and largest distance. The
  larger radius should give ≥ results. Then confirm radius makes no difference
  for "Duluth, MN".
- A5 Empty search: submit with no keyword. It should fall back to all MN jobs.
- A6 SOC keyword: title=Registered Nurses (29-1141.00). Results should be nursing jobs.
- A7 Bad input: a nonsense keyword ("zzqxqzz"), special characters
  (`C++ & "R&D"`), a 300-character string, and `<script>alert(1)</script>`.
  Expect a friendly empty state, no raw errors, nothing executed or unescaped
  in the page, and a handled dialog check (browser_handle_dialog if one appears).
- A8 Location autocomplete: type "Roch" in the location field. Suggestions
  should appear, biased to MN, WI, SD, ND and IA. Pick one and search.

### B. Sort, filters, paging, URL state
- B1 Each sort option: check the order on page 1 (titles A→Z, companies A→Z,
  posted date newest first). The sort should stay set after a new keyword search.
- B2 Company filter: apply one company. Every result should show that company,
  and the count should be ≤ the unfiltered count. Clear it to get the original back.
- B3 City filter (loc): same checks as B2, against the location shown.
- B4 Cache bug: filter company A, then switch to company B (by UI and by
  editing the URL). Results should be company B's. Report clearly if they aren't.
- B5 Combined state: keyword + location + sort + company together. Re-submit the
  keyword form, then the sort form. Nothing else in the URL should be dropped.
- B6 Paging: go to page 2 and to the last page. The results differ from
  page 1, and the other params persist. Try page=999 and page=-1 by URL.
- B7 Back/forward: after three searches, browser back and forward should
  restore each form state and its results.
- B8 Deep link: open a full results URL in a fresh tab. It should show the same
  form values and results.

### C. Single posting
- C1 Read more opens ?jvid=…, with one job, the full description, and the banner hidden.
- C2 Share: capture what gets copied (browser_evaluate on
  navigator.clipboard, or watch for the UI confirmation). It should be an
  absolute /job-search?jvid=… URL that opens the same job.
- C3 "Learn more and apply" has target=_blank and an external href. Check the
  new tab opens (browser_tabs), then close it. Don't apply.
- C4 Bad jvid values: ?jvid=0000…(32 zeros), ?jvid=nothex. Expect a handled
  state, not a server error.
- C5 Anonymous Bookmark, Save search and "Customize my search": each opens the
  "Create an account or log in to use this feature" modal. Check the modal
  closes with Esc and with its close button, and that focus returns to the page.

### D. Signed in as a job seeker (cleans up after itself)
- D1 Bookmark a job. The icon switches to remove. Bookmark it again to remove it.
- D2 Save search named "Playwright test <timestamp>". Then confirm it shows in
  "Jobs for me" → Saved searches, and that choosing it re-runs the search.
- D3 "Jobs for me": each group (Bookmarked jobs, Saved searches, Career goals,
  In demand jobs) loads options, and choosing one navigates to a search.
- Cleanup: remove every bookmark and saved search you created, from the
  dashboard (/user/<uid>) if needed. Confirm they're gone. Don't touch
  anything you didn't create.

### E. Responsive and basic accessibility
- E1 Resize to 390×844. Run A2 and B2 again. The filters should still be
  reachable, with no horizontal scroll and usable modals.
- E2 Keyboard only (browser_press_key Tab/Enter/Space): run a search, change
  the sort, open a modal and close it. Check that focus is always visible.
- E3 From the snapshot: every form control has an accessible name, and the
  results have a sensible heading structure.

## Rules
- Read-only, except section D, which must clean up.
- Never submit an application or follow an external site past the first load.
- Don't hammer the API. Run at most one search per check, plus the comparisons
  it needs.

## Report (write it at the end)
Save the report as report.md in the same reports/ folder as the screenshots.
1. A summary table: ID | Title | Result (Pass / Fail / Blocked / Observation) | Notes.
2. Bugs, each with severity, exact steps, the URL, expected vs. actual, and the
   screenshot names.
3. Evidence: for each check, its screenshots in order, each with one line on
   what it shows. Link them by relative path so the report renders them.
4. Console errors and failed network requests (browser_network_requests),
   excluding the known footer error.
5. Anything in the "How the page works" notes that turned out to be wrong.
