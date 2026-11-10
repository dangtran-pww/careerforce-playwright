# [Functional] - Job Search - Test Plan

**Status: implemented.**

**Implemented test:** `tests/functional/job-search/search.spec.ts`

## Overview

This plan checks the Job Search page (`/job-search`) in more depth than the
smoke test, as seen by a visitor who isn't logged in. It covers part 1,
searching:

- **The search form:** the page loads with its form, results and filters.
  Keyword and Location from the form end up in the address and in the
  results.
- **Locations:** a ZIP code, a city, a state, a nearby state's city, and a
  nationwide location each find jobs in the right area.
- **Distance:** a wider distance finds jobs in more cities, for a ZIP code and
  for a city.
- **Empty and special searches:** an empty search falls back to Minnesota, an
  occupation keyword finds that occupation, and a made-up word shows "No
  results found."
- **Bad input:** characters the Keyword doesn't allow, a keyword that is too
  long, and HTML in the search each get handled safely.
- **Location suggestions:** typing in Location offers nearby places, and
  picking one searches there.

The checks never log in, and they don't save, bookmark or apply for anything.
No external site is opened. The plan is safe to run on QA, Stage, and
**Production**.

It isn't part of the smoke run, though. It runs about 25 searches against the
live CareerOneStop job feed, which is too many for a post-deploy check.

The cases come from the manual session prompt
[docs/prompts/job-search-part-1-search.md](../docs/prompts/job-search-part-1-search.md)
(checks A1–A8). The expected results follow what the site actually did in the
manual session on QA on 2026-11-04
(`reports/job-search-part-1-search-2026-11-04-1515/report.md`), not the
prompt's notes where the session showed them to be wrong (see
[Corrections to the prompt](#corrections-to-the-prompt)).

## Running it

No login needed. First time? Do the [one-time setup](README.md#one-time-setup).
Run the command for the environment you want.

QA:

```bash
BASE_URL=https://qa.careerforce.link npx playwright test --project=functional-desktop tests/functional/job-search
```

Stage:

```bash
BASE_URL=https://stage.careerforce.link npx playwright test --project=functional-desktop tests/functional/job-search
```

Production:

```bash
BASE_URL=https://careerforce.mn.gov npx playwright test --project=functional-desktop tests/functional/job-search
```

Add `--ui` to [watch it run](README.md#watching-a-run). A successful run ends
with `21 passed` ([Expected result](#expected-result)).

To save a full-page screenshot of every test, even the ones that pass, put
`SCREENSHOT=on` in front ([more on screenshots](README.md#screenshots-of-every-test)):

```bash
SCREENSHOT=on BASE_URL=https://qa.careerforce.link npx playwright test --project=functional-desktop tests/functional/job-search
```

The screenshots open with `npx playwright show-report`, under each test's
Attachments, and the image files are saved in `test-results/`.

## Test cases

Every test starts as a visitor who isn't logged in. "Start" is the address
after the site name, for example `/job-search` means
`qa.careerforce.link/job-search`.

| ID | Test | Start | Steps | Expected result |
|---|---|---|---|---|
| JSS-1 | Page loads with the search form and results | `/job-search` | Open the page. | Heading "Job Search". Keyword and Location boxes, Distance dropdown set to "20 miles", Search button, Reset link to `/job-search`. "Sort by" set to "Relevance". Company and City filters. "Showing N jobs" with N > 0, 10 job cards, and a pager. The "Get matched with the right jobs" banner and the "Jobs For Me", "Services" and "Resources" sections. No JavaScript errors other than the [known one](#known-issues). |
| JSS-2 | Keyword and location from the form | `/job-search` | Type "nurse" in Keyword and "Saint Paul, MN" in Location. Click Search. | The URL holds `title=nurse`, `location[text]=Saint Paul, MN`, `radius=20` and `sort=best-match`. The boxes still read "nurse" and "Saint Paul, MN". At least 1 job. Every city in the City filter is in MN or WI. |
| JSS-3 | Location formats | `/job-search` | Search "nurse" with each Location: `55101`, `Minneapolis, Minnesota`, `Fargo, ND`, `MN`, `Chicago, IL`. | Each shows at least 1 job, in the expected area: `55101`, `Minneapolis, Minnesota` and `MN` only MN cities; `Fargo, ND` includes a ND city; `Chicago, IL` includes an IL city. |
| JSS-4 | Nationwide location | `/job-search` | Search "nurse" with each Location: `USA`, `US`, `United States`. | Each shows at least 1 job. **Currently fails:** see [Known issues](#known-issues). |
| JSS-5 | Distance widens a ZIP search | `/job-search?title=nurse&location[text]=55101` | Search with Distance "5 miles". Then pick "100 miles" in the Distance dropdown and click Search. | The URL holds `radius=100`. The 100-mile search lists more cities, and more jobs in total, in the City filter than the 5-mile one. |
| JSS-6 | Distance widens a city search | `/job-search?title=nurse&location[text]=Duluth, MN` | Search at 5 miles, then at 100 miles. | The 100-mile search lists more cities in the City filter than the 5-mile one. |
| JSS-7 | Empty search | `/job-search` | Leave every box empty. Click Search. | The URL holds `title=`, `location[text]=`, `radius=20` and `sort=best-match`. At least 1 job. Every city in the City filter is in MN. |
| JSS-8 | Default sort on a plain page load | `/job-search` | Open `/job-search` with no query string. Then open the empty search from JSS-7. | Both show the same first 10 jobs in the same order, because both say "Relevance". **Currently fails:** see [Known issues](#known-issues). |
| JSS-9 | Occupation keyword | `/job-search` | Search for `Registered Nurses (29-1141.00)`. | At least 1 job. Every job title on the first page is a nursing job (contains "nurs" or "RN"). |
| JSS-10 | No matches | `/job-search` | Search for `zzqxqzz`. | "No results found." and no job cards. No error message. |
| JSS-11 | Characters the Keyword doesn't allow | `/job-search` | Search for `C++ & "R&D"`. | Under Keyword: "Please only use letters, numbers, periods (.), commas (,), hyphens (-), slashes (/), pluses (+), single-quotes (') and double-quotes (")." The box is marked invalid and still holds `C++ & "R&D"`. |
| JSS-12 | Keyword longer than 256 characters | `/job-search` | Type 300 characters in Keyword. Then open the search with the 300-character keyword in the URL. | The box keeps only the first 256. From the URL: "Keyword cannot be longer than 256 characters but is currently 300 characters long." |
| JSS-13 | HTML is shown as text, never run | `/job-search` | Search with Keyword `<b>x</b>` and Location `<i>y</i>`. Then search for `<script>alert(1)</script>`. | The first search: both boxes hold the text as typed, and no `<b>` or `<i>` from it appears in the page. The second search: no dialog opens and no script runs (the WAF answers 403). |
| JSS-14 | Blocked search shows a CareerForce error page | `/job-search` | Search for `<script>alert(1)</script>`. | A CareerForce page with the site header and a way back to Job Search. **Currently fails:** see [Known issues](#known-issues). |
| JSS-15 | Location suggestions | `/job-search` | Type "Roch" in Location, one letter at a time. Click "Rochester, MN". Type "nurse" in Keyword and click Search. | A list of suggestions opens with "Rochester, MN". Every suggestion is in MN, WI, SD, ND or IA. After the click, the box reads "Rochester, MN" and the list closes. The search shows at least 1 job, and the City filter includes "Rochester, MN". |

Good to know:

- **Every form uses GET**, so the whole search is in the address: `title`,
  `location[text]`, `radius`, `sort`.
- **Defaults:** an empty Location (the server searches Minnesota), Distance
  20 miles, Sort "Relevance" (`best-match`), 10 jobs per page, at most 500.
- **The Keyword box takes up to 256 characters** (`maxlength`). It accepts
  letters, numbers and `. , - / + ' "`. Anything else gets a message under the
  box.
- **The Location box is a combobox.** Typing shows suggestions in a list below
  it.
- **A search that contains `<script>` is blocked by the WAF** before it
  reaches the site.
- **The jobs come from an outside job feed** (CareerOneStop), so no test
  names a job or checks an exact count. The tests check that results exist and
  that they match the search.
- **"Showing N jobs" stops at 500**, so it can't show the difference between
  two large searches. Where a test compares two searches, it compares the City
  filter instead, which lists every city in the whole result set with its job
  count.
- **Desktop only.** The search runs on the server and works the same on any
  device.

### Known issues

These bugs were found on QA on 2026-11-04. The cases that check them are
marked as expected to fail (`test.fail`), so a run stays green while the bug
is open. Once a bug is fixed, the run reports "expected to fail, but passed";
then remove the `test.fail` line.

| Bug | Case | Found |
|---|---|---|
| A nationwide location (`USA`, `US`, `United States`) shows "No results found." | JSS-4 | Manual session BUG-1 (Medium) |
| A plain `/job-search` load lists jobs A–Z while "Relevance" is shown; a submitted empty search shows a different order | JSS-8 | Manual session BUG-2 (Low) |
| A keyword with `<script>` gets a bare, unbranded "403 Forbidden" page from the WAF | JSS-14 | Manual session BUG-3 (Low) |
| `/job-search` throws `TypeError: Cannot read properties of null (reading '1')` on every load | JSS-1 | Already in `tests/helpers/known-issues.ts`; JSS-1 allows for it |

### Corrections to the prompt

The manual session showed these notes in the prompt to be wrong. The plan
follows what the site does.

- **"Radius only changes results when the location is a ZIP."** It changes
  city searches too (JSS-6).
- **"Location shown as St. Paul, MN."** The box keeps what the visitor typed
  (JSS-2).
- **"Default location MN."** The box is empty by default. The server still
  searches Minnesota (JSS-7).

## Not covered

- Sort, filters, paging and URL state (part 2 of the manual session prompt).
- The single posting, Share, layout on a phone and accessibility (part 3).
- Save search and Bookmark. They need a login; smoke JS-4 covers the login
  prompt.

## Expected result

The terminal ends with `21 passed`. The plan has 15 test cases, but some are
repeated with different inputs, so they add up to 21 runs:

| Test case | Runs | Why |
|---|---|---|
| JSS-1, JSS-2 | 2 | once each |
| JSS-3 | 5 | `55101`, `Minneapolis, Minnesota`, `Fargo, ND`, `MN`, `Chicago, IL` |
| JSS-4 | 3 | `USA`, `US`, `United States` |
| JSS-5 to JSS-15 | 11 | once each |
| **Total** | **21** | |

The 5 runs of JSS-4, JSS-8 and JSS-14 count as passed while they fail as
expected ([Known issues](#known-issues)).

If the total is anything other than 21, or anything fails, see
[When something fails](README.md#when-something-fails).
