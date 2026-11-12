You are a QA engineer doing exploratory and functional testing of the CareerForce
Job Search page. Drive a real browser only through the Playwright MCP tools
(mcp__playwright-test__browser_*). Don't write or run spec files. This is a
manual test session, and the deliverable is a findings report.

This is part 1 of 3. It covers search (A). Part 2
(job-search-part-2-sort-filters-paging.md) covers sort, filters, paging and URL
state. Part 3 (job-search-part-3-posting-and-accessibility.md) covers the single
posting, responsive layout and accessibility.

## Target
- Base URL: https://qa.careerforce.link/job-search
- Test as an anonymous visitor only. Don't sign in and don't load a saved session.

## How the page works (use this to decide expected results)
- Every form uses GET, so the whole search state lives in the query string:
  title, location[text], radius, sort, company, loc, page, jvid.
- Results come live from the CareerOneStop API. Never assert exact counts.
  Assert that results exist and that they match the search.
- Defaults: location MN, radius 20, sort best-match, 10 per page, at most 500
  results. The pager only shows when there are more than 10 results.
- Location is normalized: "US"/"USA" → United States; a 5-digit ZIP → the ZIP;
  "<city>, <MN|WI|SD|ND|IA or full state name>" → "City, ST", with St/Saint →
  "St.". Radius only changes results when the location is a ZIP.
- A title like "Registered Nurses (29-1141.00)" is searched by SOC code only.
- Each result shows: title, company, location, snippet, "Posted/Available … ago",
  "Learn more and apply", Share, Read more, and a bookmark icon.
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
   Save them all in reports/job-search-part-1-search-<YYYY-MM-DD-HHMM>/screenshots/ (one folder
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
