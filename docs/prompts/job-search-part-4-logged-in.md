You are a QA engineer doing exploratory and functional testing of the CareerForce
Job Search page as a logged-in job seeker. Drive a real browser only through the
Playwright MCP tools (mcp__playwright-test__browser_*). Don't write or run spec
files. This is a manual test session, and the deliverable is a findings report.

This is part 4 of 4. It covers everything a logged-in job seeker can do on Job
Search (D). Part 1 (job-search-part-1-search.md) covers search, part 2
(job-search-part-2-sort-filters-paging.md) covers sort, filters, paging and URL
state, and part 3 (job-search-part-3-posting-and-accessibility.md) covers the
single posting, responsive layout and accessibility. The matching test plan is
test-suites/job-search/functional-job-search-logged-in.md.

## Target
- Base URL: https://qa.careerforce.link/job-search (QA or Stage only, never
  Production: this session saves and removes data on the account).
- Log in by loading the job seeker session with browser_set_storage_state from
  playwright/.auth/qa/jobseeker.json (playwright/.auth/stage/jobseeker.json on
  Stage). Then open /user and confirm you are logged in. If the file is missing
  or the session has expired (you land on a login page), stop and tell me to run
  `npm run login:manual -- jobseeker`. Don't try to log in yourself.
- Use only the dedicated job seeker test account. If the dashboard shows what
  looks like a real person's data, stop and ask.

## How the page works (use this to decide expected results)
- Every form uses GET, so the whole search state lives in the query string:
  title, location[text], radius, sort, company, loc, page, jvid.
- Results come live from the CareerOneStop API. Never assert exact counts.
- Logged in, the page shows: a "Jobs for me" block with two dropdowns (a group:
  Bookmarked jobs / Saved searches / Career goals / In demand jobs, listing only
  groups that have items; then an item, with the placeholder "Select <group>").
  Choosing an item navigates to its search. There is no "Customize my search"
  button.
- Bookmark icon: an AJAX toggle (GET /careerforce/ajax/job-post/add/<jvid>?token=…)
  that switches between its "add" and "remove bookmark" states without
  reloading. The same link removes. Limit: 15 bookmarks.
- "Save search" opens "Save this search to your dashboard" with a "Name job
  search" box. It saves the address of the page it was opened from (the
  Referer). After saving, the dialog closes and Jobs for me refreshes without a
  reload. Limit: 5 saved searches; at 5 the dialog warns "You have already
  reached the limit for saved jobs."
- Dashboard (/user, which opens /user/<uid>): a "Jobs For Me" section with
  "Saved searches" and "Bookmarked jobs", each item with an "x" remove link.
  Removing a saved search calls /careerforce/ajax/job-search/remove/<delta>/<hash>?token=….
- Career goals come from the account (/user/<uid>/skills-experience; add one
  from a career page such as /explore/careers/29-1141.00 with "Add to career
  goals"; limit 6). In demand jobs are the top 10 in-demand occupations for the
  account's My Region (set on the dashboard; Statewide when unset). Both link to
  /job-search?title=<Occupation> (<SOC code>).
- After a visitor logs in from the Bookmark or Save search dialog, the browser
  comes back to /job-search?<search>#bookmark[<jvid>] or #save-search, and the
  page finishes the action (bookmarks the job, or opens the save dialog).
- The jobseeker-tools tracker: on load the page calls
  /careerforce/jobseeker-tools-tracker?active_path=/job-search.
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
     dialog shown, each bookmark toggled, each save or remove),
   - once for the final state of every check, and
   - for every failure, at the moment you see it.
   Save them all in reports/job-search-part-4-logged-in-<YYYY-MM-DD-HHMM>/screenshots/ (one folder
   per session; use the session start time). Name each one
   <ID>-<NN>-<short-name>.png, where NN counts up from 01 within the check,
   for example D5-02-saved-search-listed.png. Use a viewport screenshot by
   default, an element screenshot (target) for a dropdown, a dialog or a single
   result, and fullPage only when the check is about the whole page. Before
   moving on, open the screenshot with Read and confirm it shows what the step
   claims; retake it if the page was still loading.
5. If a step fails, record it, clean up what that check added, and move on.
   Don't stop the session.

## Test cases

### D0. Starting state (do this first, change nothing)
Open the dashboard and record: every saved search (name and link), every
bookmarked job (title and jvid), the career goals on Goals & Experience, and My
Region. This is the baseline for cleanup. If the account has more than 3 saved
searches, more than 10 bookmarks, or 6 career goals, say which checks can't run
and skip them rather than removing anything that was already there.

### D. Signed in as a job seeker (cleans up after itself)
Name every saved search "Playwright test <timestamp> …".

- D1 Page as a job seeker (LI-1): /job-search?title=nurse shows Jobs for me
  with its dropdowns, no "Customize my search", bookmark icons in add/remove
  state (not the login dialog), and "Save search" opens the save dialog, not
  the login dialog (close it without saving). Check browser_network_requests
  for the tracker call and its status.
- D2 Bookmark from results (BK-1): on /job-search?title=nurse&sort=job-title-asc&page=1,
  bookmark a job that isn't bookmarked. The icon switches without a reload, and
  the URL and results don't change. Reload: still bookmarked. Open its Read
  more: still bookmarked there. Remove it.
- D3 Bookmark from the single posting (BK-2): open a job by ?jvid=, bookmark it.
  It shows on the dashboard by title and in Jobs for me → Bookmarked jobs
  (after a reload), and that item opens ?jvid=<same id>. Remove it.
- D4 Double-click and two tabs (BK-3, BK-4): double-click a bookmark icon, reload,
  and compare the icon with the dashboard (never listed twice). Then open the
  same search in two tabs (browser_tabs), bookmark a job in tab 1, click the
  same job's (stale) icon in tab 2, reload both. Does tab 2 silently undo tab
  1? Report exactly what happened. Remove what's left.
- D5 Save dialog (SV-1, SV-2): the dialog has a heading, a labelled name box,
  Save and close. Esc and the close button save nothing. Save with an empty
  name, then with only spaces: a "name required" message, nothing saved.
- D6 A saved search keeps every value (SV-3): search "nurse", Location "55101",
  Distance "50 miles", Sort "Company", then the city with the most jobs and the
  company with the most jobs in it. Save. Confirm it appears in Jobs for me
  without a reload. Open /job-search with no query and run it from Jobs for me,
  then from the dashboard. Every value (title, location[text], radius, sort,
  loc, company) comes back in the URL and the form, with the same jobs. Note
  any extra parameter (delta). Remove it.
- D7 Names (SV-4, SV-5, SV-6): save a search named
  `Playwright test <ts> <b>Bold</b> & "R&D" <script>alert(1)</script>`: no
  alert (browser_handle_dialog if one appears), shown as plain text in Jobs for
  me and on the dashboard. Try a 300-character name: what is the limit, and
  what happens past it? Save "nurse" and then "welder" under the same name:
  is the second refused, or are both kept and each opens its own search? If
  both are kept, remove the welder one and check the nurse one is untouched.
  Remove everything you added.
- D8 Remove with a changed list (SV-7): save A then B. Open the dashboard in two
  tabs. Remove A in tab 1, then B in tab 2. Reload: neither A nor B is listed,
  and every baseline search still is.
- D9 Limits (SV-8, BK-5): save searches until there are 5. The dialog shows the
  limit warning; try to save a 6th and record what happens. Remove one you
  added and save again: it works. Then bookmark jobs until there are 15 and try
  a 16th: record the message (a page message, or a browser alert with an error?)
  and that the dashboard lists exactly 15. Remove everything you added.
- D10 Save with nothing searched (SV-9): save from /job-search with no query and
  run it from Jobs for me: the default results, with no filters.
- D11 Jobs for me (JM-1, JM-3, JM-5): with at least one bookmark and one saved
  search of yours, pick each group in turn. Its items match the dashboard (same
  names, same order). Picking a group doesn't navigate; picking an item does.
  In demand jobs lists 1 to 10 occupations and one of them opens
  ?title=<Occupation> (<SOC>) with jobs or a friendly empty state. With the
  keyboard only, Tab to the item dropdown and press Down once: does it navigate
  before you confirm? Remove what you added.
- D12 Career goals (JM-2): if "Registered Nurses" isn't a career goal, add it
  from /explore/careers/29-1141.00. Jobs for me → Career goals lists every goal
  from Goals & Experience; picking Registered Nurses opens
  ?title=Registered Nurses (29-1141.00) with nursing jobs. Remove the goal if
  you added it.
- D13 My Region (JM-4): set My Region on the dashboard to "Duluth, MN", note
  the In demand jobs list, then "Saint Paul, MN", note it again. The lists
  differ. Put My Region back to the baseline (clear it if it was Statewide) and
  confirm the list matches the start.
- D14 Coming back after login (HO-1 to HO-4): open
  /job-search?title=nurse#save-search: the save dialog opens by itself; save
  and check the saved link has title=nurse and no #save-search. Open
  /job-search?title=nurse#bookmark[<jvid of a job that isn't bookmarked>]: the
  job gets bookmarked and the page reloads without the hash. Repeat with that
  same (now bookmarked) jvid: a plain "already bookmarked" message, and it
  stays bookmarked. Try #bookmark[00000000000000000000000000000000] and
  #bookmark[nothex]: no error, nothing added. Remove what you added.
- D15 Privacy (PV-1 to PV-5):
  - Bookmark a job, open /job-search?title=nurse, then open the same URL in a
    new browser context with no session (browser_set_storage_state with an
    empty state, or a fresh tab after clearing cookies with
    browser_cookie_clear; reload the job seeker state afterwards). The visitor
    must see the visitor page: "Customize my search", login-dialog bookmark
    icons, none of the job seeker's names or bookmarks.
  - From the bookmark icon's link and a dashboard "x" link, open each URL with
    the token removed and with a wrong token: each is refused and nothing
    changes.
  - As the job seeker, open /user/1: access denied or not found.
  - As a visitor, open /careerforce/ajax/jobs-for-me,
    /careerforce/forms/job_search_authenticated_modal and
    /careerforce/ajax/job-post/add/<jvid>: each refused.
  - Reload the job seeker session and confirm /user still shows you logged in.
    Remove the bookmark.
- D16 Phone (MO-1): browser_resize to 390×844. Open Filters, Save search, save;
  bookmark a job by tapping; pick the saved search in Jobs for me. The dialog is
  on top of the drawer, nothing scrolls sideways. Remove what you added. Resize
  back to desktop width.

### Cleanup (last step, always)
Open the dashboard and Goals & Experience and compare with the D0 baseline:
the same saved searches, bookmarks, career goals and My Region, nothing more,
nothing less. Remove anything left with a "Playwright test" name or a jvid you
bookmarked. Don't touch anything that was in the baseline. Record the final
state with a screenshot.

## Rules
- QA or Stage only. Never log out (it ends the saved session); use a separate
  context for visitor checks.
- Change only what you added, and put back anything you changed (My Region).
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
5. The cleanup result: baseline vs. final state, and anything that couldn't be
   put back.
6. Anything in the "How the page works" notes that turned out to be wrong.
