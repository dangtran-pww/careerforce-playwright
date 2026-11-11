# [Functional] - Job Search - Job Posting and Accessibility - Test Plan

Status: ready to generate
Implemented test: —

## Overview

Part 3 of 4 of the functional plans for Job Search (`/job-search`). It tests
one job on its own (Read more, Share, "Learn more and apply", bad job IDs),
the "log in to use this feature" dialog that visitors get, the page at phone
width, and basic accessibility: keyboard use, visible focus, names for every
control, and headings.

The other parts:
[functional-job-search-search.md](functional-job-search-search.md)
(the search itself),
[functional-job-search-sort-filters-paging.md](functional-job-search-sort-filters-paging.md)
(sort, filters, paging and the address) and
[functional-job-search-logged-in.md](functional-job-search-logged-in.md)
(everything a logged-in job seeker can do).

Every case runs as a visitor who isn't logged in and changes nothing, so the
whole plan is safe on QA, Stage and Production. No case logs in or applies
for a job, and no case goes further than the first page of another site.

The cases come from the manual test session in
`docs/prompts/job-search-part-3-posting-and-accessibility.md`: PO-1 is C1,
PO-2 is C2, PO-3 is C3, PO-4 and PO-5 are C4, PO-6 to PO-8 are C5, RS-1 to
RS-3 are E1, AX-1 to AX-4 are E2, and AX-5 and AX-6 are E3. PO-9 is added.

## Login

| | |
|---|---|
| **Role** | None. A visitor who isn't logged in. No saved session is loaded. |
| **Site password gate** | QA and Stage ask for the `BASIC_AUTH_USER` / `BASIC_AUTH_PASSWORD` from `.env` ([one-time setup](README.md#one-time-setup)). Production has no gate. |
| **Accounts touched** | None. |

## Running it

First time? Do the [one-time setup](README.md#one-time-setup).

```bash
BASE_URL=https://qa.careerforce.link npx playwright test tests/functional/job-search/posting.spec.ts tests/functional/job-search/responsive.spec.ts tests/functional/job-search/accessibility.spec.ts --project=functional-desktop
BASE_URL=https://qa.careerforce.link npx playwright test tests/functional/job-search/posting.spec.ts tests/functional/job-search/accessibility.spec.ts --project=functional-mobile
```

Add `--ui` to [watch it run](README.md#watching-a-run), or put
`SCREENSHOT=on` in front to
[save a screenshot of every test](README.md#screenshots-of-every-test).

## Checked in every case

- **No JavaScript error** in the browser console.
- **No failed request** to the site itself (no 4xx or 5xx answer from the
  CareerForce host), except where a case expects one.
- **No raw error on the page:** no "The website encountered an unexpected
  error", no PHP or Drupal error message, no stack trace.

## Test cases

"Page" is the address after the site name. "The login dialog" is the dialog
"Create an account or log in to use this feature", with a "Log In or
Register" button, a "Continue Browsing" link and a "DEED staff and partners
log in here." link.

### One job on its own

`tests/functional/job-search/posting.spec.ts`

| ID | Test | Page | Steps | Expected result |
|---|---|---|---|---|
| PO-1 | Read more opens the job on its own | `/job-search?title=nurse` | Note the first job's title, company, location and short description. Click its "Read more". | The address is `/job-search?jvid=<job ID>`, where the ID is 32 to 40 letters a–f and digits. Exactly one job shows, with the same title, company and location. Its description is the full one: longer than the short description, and starting with the same words. It has "Learn more and apply", "Share" and a bookmark icon. The "Get matched with the right jobs" banner and the pager are not shown. |
| PO-2 | Share copies a link to the job | `/job-search?title=nurse` | Allow the page to use the clipboard. Click "Share" on the first job. Read the clipboard. Open what was copied in a new tab. | The page confirms the copy (for example "Link copied"). The clipboard holds a full address: `https://<this site>/job-search?jvid=<ID>`, with the same site as the page and the same ID as that job's "Read more" link. The new tab shows that one job, as in PO-1. |
| PO-3 | "Learn more and apply" opens the employer's site in a new tab | `/job-search?title=nurse` | Look at the first job's "Learn more and apply" link. Click it. Wait for the new tab's first page to start loading. Close the new tab. | The link opens in a new tab (`target="_blank"`) and has `rel="noopener"` (or `noreferrer`). Its address is a full `https://` address on another site, not this one. Clicking it opens exactly one new tab with that address, and the Job Search tab stays where it was. Nothing is filled in or submitted on the other site. |
| PO-4 | A job ID that doesn't exist | `/job-search?jvid=00000000000000000000000000000000` (32 zeros) | Open the page. | A page from this site (not an error page) says plainly that the job wasn't found or is no longer available, with a way back to Job Search. No empty job card and no "Learn more and apply" without an address. |
| PO-5 | A job ID that isn't a job ID | `/job-search?jvid=nothex`, then `?jvid=<41 letters a–f>`, then `?jvid=<script>alert(1)</script>` | Open each. | No error and no alert. Each shows either the friendly "not found" message from PO-4 or the normal Job Search page with jobs. The page never shows the raw value as markup. |
| PO-6 | Bookmark asks a visitor to log in | `/job-search?title=nurse` | Click the bookmark icon on the first job. Press Esc. Click it again and close with the dialog's close button. Click it again and click "Continue Browsing". | Each time, the login dialog opens on top of the page and keyboard focus moves into it. Esc, the close button and "Continue Browsing" each close it, and focus goes back to the bookmark icon that opened it. The address and the jobs listed are unchanged. |
| PO-7 | Save search asks a visitor to log in | `/job-search?title=nurse` | Same as PO-6 with "Save search". | Same as PO-6, with focus going back to "Save search". |
| PO-8 | Customize my search asks a visitor to log in | `/job-search?title=nurse` | Same as PO-6 with "Customize my search" in the Jobs for me block. | Same as PO-6, with focus going back to "Customize my search". |
| PO-9 | The dialog's login links come back to this search | `/job-search?title=nurse` | Open the login dialog from the first job's bookmark icon. Look where "Log In or Register" and "DEED staff and partners log in here." go (their link, or the address the browser is sent to; don't log in, and don't go further than the first page). Do the same from "Save search". | "Log In or Register" leads to the login page (LoginMN, or this site's `/user/login`) with a return address back to this search (`/job-search?title=nurse`), followed by `#bookmark[<that job's ID>]` from the bookmark icon or `#save-search` from "Save search". "DEED staff and partners log in here." leads to this site's `/user/login`, with a return address back to this search. |

### At phone width

`tests/functional/job-search/responsive.spec.ts`. Each case sets the browser
to 390 × 844 pixels and checks that no page in it scrolls sideways.

| ID | Test | Page | Steps | Expected result |
|---|---|---|---|---|
| RS-1 | Search at phone width | `/job-search` | Type "nurse" in Keyword and "Saint Paul, MN" in Location. Search. | The address has `title=nurse` and `location[text]=Saint Paul, MN`. At least 1 job is listed. The form, the results and every job's links fit the width, with no sideways scrolling and no text or button cut off. |
| RS-2 | Company filter at phone width | `/job-search?title=nurse` | Open "Filters". Pick the company with the most jobs. Then open "Filters" again and clear the company. | The "Filters" button opens the drawer, and the Company and City dropdowns and "Save search" are in it and can be used. With the filter, every job listed shows that company. After clearing, the original total is back. No sideways scrolling with the drawer open or closed. |
| RS-3 | The login dialog at phone width | `/job-search?title=nurse` | Open the login dialog from the first job's bookmark icon. Close it. Open "Filters", click "Save search", and close the dialog. Then open the first job's "Read more". | Each time the dialog fits the screen: its text, its three links and its close button are all visible without sideways scrolling, and it is on top of the drawer, not behind it. It closes and leaves the page usable. The job on its own fits the width too. |

### Keyboard and accessibility

`tests/functional/job-search/accessibility.spec.ts`. Keyboard cases use only
Tab, Shift+Tab, Enter, Space, Esc and the arrow keys: no mouse clicks.
"Focus is visible" means the focused control shows an outline, ring or
other change that isn't there when it isn't focused.

| ID | Test | Page | Steps | Expected result |
|---|---|---|---|---|
| AX-1 | Search with the keyboard only | `/job-search` | From the top of the page, Tab to Keyword and type "nurse". Tab to Location and type "Saint Paul, MN". Tab to Distance and pick "10 miles" with the arrow keys. Tab to "Search" and press Enter. | Every control is reached by Tab, in the order Keyword, Location, Distance, Search (with only the Location suggestions, if open, between them). Focus is visible at every stop. A "Skip to main content" link (or similar) is the first stop. The search runs: the address has `title=nurse`, `location[text]=Saint Paul, MN` and `radius=10`, and jobs are listed. |
| AX-2 | Change the sort with the keyboard only | `/job-search?title=nurse` | Tab to the Sort dropdown. Choose "Job title" with the keyboard (open it with Space or Alt+Down, move with the arrows, confirm with Enter). | Focus is visible on the dropdown. Moving through the options doesn't reload the page until the choice is confirmed. After confirming, the address has `sort=job-title-asc` and the dropdown shows "Job title". |
| AX-3 | Open and close the login dialog with the keyboard only | `/job-search?title=nurse` | Tab to the first job's bookmark icon and press Enter. Tab through the dialog until focus comes back to where it started. Press Esc. Then do the same with Space instead of Enter, and close with the dialog's close button (Tab to it, press Enter). | Enter and Space both open the dialog, and focus moves into it. Tab stays inside the dialog (it goes round its controls, not to the page behind). Focus is visible on every control in it. Esc and the close button both close it, and focus goes back to the bookmark icon. |
| AX-4 | Pick a location suggestion with the keyboard | `/job-search` | Tab to Location and type "Roch". Press Down until "Rochester, MN" is highlighted. Press Enter. | The suggestions open. Down moves the highlight through them, and screen readers are told which one is highlighted (the box's `aria-activedescendant` changes, or the highlighted option has focus). Enter puts "Rochester, MN" in the box and closes the list, without running the search. |
| AX-5 | Every control has a name | `/job-search?title=nurse`, then the first job's `?jvid=` page | Read the accessibility tree of each page. | Every text box, dropdown, button and link in the search form, the sort, the filters, the Jobs for me block and the results has a non-empty accessible name. Each dropdown and text box has a label (not only a hint). The bookmark and Share controls, which are icons, have a name such as "Bookmark" and "Share". |
| AX-6 | Headings | `/job-search?title=nurse`, then the first job's `?jvid=` page | Read the headings of each page. | Each page has exactly one level-1 heading, "Job Search". Each job's title is a heading, and all job titles are at the same level, below level 1. No level is skipped on the way down (for example 1 then 3). Blocks such as Jobs for me, Services and Resources have their own headings. |

## Good to know

- **The job IDs come from an outside job feed** (CareerOneStop), so cases use
  the first job of a "nurse" search rather than a fixed ID. PO-4 uses an ID
  that can't exist.
- **The clipboard** has to be allowed for the browser before PO-2
  (`clipboard-read` and `clipboard-write`). If it can't be read, PO-2 checks
  the address the Share button holds instead and says so in its result.
- **The login dialog's "Log In or Register"** goes to LoginMN, another site.
  PO-9 only looks at where it leads; it doesn't log in.
- **"Learn more and apply"** goes to the employer's or job board's site.
  PO-3 never fills in or submits anything there.
- **On a phone, the Company and City filters and Save search are in a
  drawer** behind a "Filters" button.

## Mobile

PO-1 to PO-9 and AX-5, AX-6 run on desktop (`functional-desktop`) and on an
emulated phone (`functional-mobile`, Pixel 7); on the phone, PO-7 opens
"Filters" first. RS-1 to RS-3 set their own 390 × 844 size, so they run on
desktop only (`@desktop-only`). AX-1 to AX-4 are keyboard cases, so they are
desktop only too.

## Expected result

| Project | Runs | Cases |
|---|---|---|
| `functional-desktop` | 18 | PO-1 to PO-9, RS-1 to RS-3, AX-1 to AX-6 |
| `functional-mobile` | 11 | PO-1 to PO-9, AX-5, AX-6 |

## Not covered

- **Bookmark, Save search and Jobs for me when logged in:** part 4.
- **An expired job** (greyed out on its own page). It only shows for a job
  that a job seeker bookmarked and the feed has since dropped; it can't be set
  up on purpose.
- **A full accessibility audit.** These cases check keyboard use, focus,
  names and headings. Colour contrast, zoom to 400% and screen reader testing
  are not covered; an automated scan (axe) could be added later.
- **The job's JSON at `/job-search/<job ID>`.** It's used by the page, not by
  visitors.
