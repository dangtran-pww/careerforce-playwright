You are a QA engineer doing exploratory and functional testing of the CareerForce
Job Search page. Drive a real browser only through the Playwright MCP tools
(mcp__playwright-test__browser_*). Don't write or run spec files. This is a
manual test session, and the deliverable is a findings report.

This is part 3 of 3. It covers the single posting view (C) and responsive
layout and basic accessibility (E). Part 1 (job-search-part-1-search.md) covers
search, and part 2 (job-search-part-2-sort-filters-paging.md) covers sort,
filters, paging and URL state. Signed-in testing (section D in the original
plan) is out of scope for now.

## Target
- Base URL: https://qa.careerforce.link/job-search
- Test as an anonymous visitor only. Don't sign in and don't load a saved session.

## How the page works (use this to decide expected results)
- Every form uses GET, so the whole search state lives in the query string:
  title, location[text], radius, sort, company, loc, page, jvid.
- Results come live from the CareerOneStop API. Never assert exact counts.
- Location is normalized: "<city>, <MN|WI|SD|ND|IA or full state name>" →
  "City, ST", with St/Saint → "St.".
- Each result shows: title, company, location, snippet, "Posted/Available … ago",
  "Learn more and apply" (external, opens a new tab), Share (copies a
  /job-search?jvid=… URL), Read more, and a bookmark icon.
- /job-search?jvid=<id> shows one posting with the full description, and the
  "Get matched with the right jobs" banner is hidden.
- Anonymous visitors who use Bookmark, Save search or "Customize my search" get
  a "Create an account or log in to use this feature" modal.
- /job-search used to throw one JavaScript error from the footer JS
  aggregate on every load. If it still does, report it as a bug.

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
   Save them all in reports/job-search-part-3-posting-and-accessibility-<YYYY-MM-DD-HHMM>/screenshots/ (one folder
   per session; use the session start time). Name each one
   <ID>-<NN>-<short-name>.png, where NN counts up from 01 within the check,
   for example A3-02-fargo-nd.png. Use a viewport screenshot by default, an
   element screenshot (target) for a dropdown or a single result, and
   fullPage only when the check is about the whole page. Before moving on,
   open the screenshot with Read and confirm it shows what the step claims;
   retake it if the page was still loading.
5. If a step fails, record it and move on. Don't stop the session.

## Test cases

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

### E. Responsive and basic accessibility
- E1 Resize to 390×844, then:
  - Search for keyword "nurse" + location "Saint Paul, MN". Results > 0, and
    the URL holds both values.
  - Apply one company filter. Every result should show that company. Clear it.
  - The filters should still be reachable, with no horizontal scroll, and the
    C5 modal should be usable at this width.
  Resize back to desktop width when done.
- E2 Keyboard only (browser_press_key Tab/Enter/Space): run a search, change
  the sort, open a modal and close it. Check that focus is always visible.
- E3 From the snapshot: every form control has an accessible name, and the
  results have a sensible heading structure.

## Rules
- Read-only. Don't sign in, bookmark, or save searches.
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
