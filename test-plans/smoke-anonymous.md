# [Smoke] - Anonymous - Test Plan

**Status: implemented.**

**Implemented test:** `tests/smoke/anonymous/*.spec.ts`

## Overview

This plan is a quick health check of the public side of CareerForce, as seen
by a visitor who isn't logged in. It covers the pages and tools most people
use:

- **Homepage:** every section loads, the Decision Tree ("What brings you here
  today?") works, and the Google Tag Manager tracking code is present.
- **Login page:** offers the 3 ways to log in: LoginMN for job seekers, an
  email and password form for partners, and a "Log In" button for DEED staff.
- **Search:** site search and the Explore Careers search both return
  results, and a career page opens from the results with its main sections.
- **Job Search:** the homepage Job Search leads to results; each job has its
  links; a job opens on its own; Save search and Bookmark ask a visitor to
  log in; and the main pages load without JavaScript errors.
- **Locations, Events, Programs and Services:** the pages load with their
  main content, and the Events and Programs and Services pages list at
  least 1 item.
- **Career tools:** the Skills Matcher and Interest Profiler can be filled in
  and show results, and the Employment Readiness Assessment opens.
- **Filters:** on Events, Programs and Services, Job Search, site search and
  Training Programs, two different filters (or sort orders) give different
  results ([Filters](#filters)).
- **Site-wide:** an unknown address shows the "Page Not Found" page, the
  footer has its contact details and links, the 5 main menu pages open, and
  "Skip to main content" works from the keyboard.
- **On a phone:** the same checks again in an emulated Android phone
  browser, plus the header menu button (MB-1) and a check that no page
  scrolls sideways ([Mobile](#mobile)).

The checks never log in, and they don't create, edit, or delete any site
content. The only things they do besides viewing pages are what any visitor
can do: make choices in the Decision Tree, filter and sort listings, and
submit the Skills Matcher and Interest Profiler forms. Both are approved for Production, so the plan is safe
to run on QA, Stage, and **Production**.

The checks don't cover emails or anything that takes longer than a single
visit. Run them after each deployment to confirm the site still works for the
public.

The checks come from the DEED smoke-testing checklist
([deed-smoke-test-plan.md](../docs/deed-smoke-test-plan.md)).

## Running it

No login needed. First time? Do the [one-time setup](README.md#one-time-setup).
Run the command for the environment you want (about 1–2 minutes).

QA:

```bash
BASE_URL=https://qa.careerforce.link npx playwright test tests/smoke/anonymous --project=smoke
```

Stage:

```bash
BASE_URL=https://stage.careerforce.link npx playwright test tests/smoke/anonymous --project=smoke
```

Production:

```bash
BASE_URL=https://careerforce.mn.gov npx playwright test tests/smoke/anonymous --project=smoke
```

Keep `--project=smoke` in the command. Without it, the same tests also run on
the phone ([Mobile](#mobile)), 88 runs in all.

Add `--ui` to [watch it run](README.md#watching-a-run). A successful run ends
with `48 passed` ([Expected result](#expected-result)).

To save a full-page screenshot of every test, even the ones that pass, put
`SCREENSHOT=on` in front ([more on screenshots](README.md#screenshots-of-every-test)):

```bash
SCREENSHOT=on BASE_URL=https://qa.careerforce.link npx playwright test tests/smoke/anonymous --project=smoke
```

The screenshots open with `npx playwright show-report`, under each test's
Attachments, and the image files are saved in `test-results/`.

### Running the mobile tests

The mobile tests ([Mobile](#mobile)) run on your computer, in a browser that
emulates the phone. Run the command for the environment you want.

QA:

```bash
BASE_URL=https://qa.careerforce.link npx playwright test tests/smoke/anonymous --project=smoke-mobile
```

Stage:

```bash
BASE_URL=https://stage.careerforce.link npx playwright test tests/smoke/anonymous --project=smoke-mobile
```

Production:

```bash
BASE_URL=https://careerforce.mn.gov npx playwright test tests/smoke/anonymous --project=smoke-mobile
```

The mobile tests can't tell whether a page *looks* right. To review the
layout, save full-page screenshots and look through them:

```bash
SCREENSHOT=on BASE_URL=https://qa.careerforce.link npx playwright test tests/smoke/anonymous --project=smoke-mobile
```

## Test cases

Every test starts as a visitor who isn't logged in. "Page" is the address
after the site name, for example `/programs-services` means
`qa.careerforce.link/programs-services`.

| ID | Test | Page | Steps | Expected result |
|---|---|---|---|---|
| HP-1 | Homepage loads | `/` | Open the homepage. | All 8 sections show their headings: "Job Search", "What brings you here today?", "Upcoming Events", "Explore Careers", "Upcoming Training Programs", "Get the most out of CareerForce, create an account", "Connect to our Services", "CareerForce Blog". The Job Search block shows the text "CareerForce is Minnesota's official career exploration and job search resource.", a keyword box, a location box, a distance dropdown, and a "Search" button. The "What brings you here today?" section shows a "Choose a path" dropdown and 3 cards, each with an image and a title. "Upcoming Events", "Upcoming Training Programs", "Connect to our Services" and "CareerForce Blog" each list at least 1 item, and link to their full list: `/education-and-training/events`, `/training-programs`, `/programs-services`, `/careerforce-blog`. |
| HP-2 | Login page offers all 3 logins | `/user/login` | Open the login page. Click "CareerForce partner organization or a training program provider" to open it. Then click "DEED Staff Member" to open it. Don't fill in or submit anything. | **Job Seekers:** the "Job Seekers" heading, a "Register to:" list, a "Log In or Register with LoginMN" button, and a "Data Privacy Notice" with a link to DEED's data privacy policies. **Partners:** the section starts closed; once opened it shows a "Log In" heading, "Email address" and "Password" boxes, a "Forgot your password?" link, a "Submit" button, and a "Request one today" link to `/user/register-partner`. **DEED staff:** the section starts closed; once opened it shows a "Log In" button. |
| HP-3 | Tracking code is present | `/` | Open the homepage. | The page includes the Google Tag Manager code for this environment: `GTM-WL36T6M` on Production, `GTM-P8D2THV` on QA and Stage. |
| HP-4 | Decision Tree works | `/` | In "What brings you here today?", open "Choose a path" and click the first option. Then click "Reset selections". | After picking: "Choose a path" shows the chosen option, a "Tell us more." question appears, the 3 cards change, and a "Reset selections" button shows. After Reset: back to "Choose a path" and the original 3 cards, with no "Tell us more." and no Reset button. |
| SR-1 | Site search returns results | `/search` | Search with no words. Then search for "job fair", "networking", and "farmer", one at a time. Then search for a made-up word ("zzqxnotaword"). Finally, on the homepage, type "networking" in the header's "Search CareerForce" box and press Enter (on a phone, tap the header's "Search" button first). | Every real search shows at least 1 result. The 3 keyword searches show "Search results 1-N of N", and their first result is a page on this site. The made-up word shows "No results found." and no results. The header box opens `/search?k=networking` with results. |
| SR-2 | Career search returns results | `/explore/careers` | Search for "Nursing", "taxi driver", and "project manager", one at a time. Then, on the homepage, type "Nursing" in the Explore Careers box and click "Search". | Every search shows at least 1 result. The homepage box opens `/explore/careers?otitle=Nursing`. |
| SR-3 | Career page opens | `/explore/careers` | Search for "Nursing" and click the "Registered Nurses" result. It opens in a new tab. Then click "Find current job openings in this occupation". | The career page `/explore/careers/29-1141.00` shows the title "Registered Nurses" and the sections "Also known as", "Daily Work Activities", "Data By Region", and "Qualifications". The job openings link opens Job Search for "Registered Nurses" with at least 1 job. |
| JS-1 | Homepage Job Search works | `/` | In the Job Search block, type "nurse" and click "Search". | Job Search opens (`/job-search?title=nurse…`, distance 20 miles) with "nurse" still in the Keyword box and at least 1 job. |
| JS-2 | Jobs have their links | `/job-search?title=nurse` | Look at the first 3 jobs. | Each has a title, a "Learn more and apply" link that opens the employer's posting on another site in a new tab, and a "Read more" link to that job. |
| JS-3 | A job opens on its own | `/job-search?title=nurse` | Click "Read more" on the first job. | Only that job shows (same title), with its full description. |
| JS-4 | Save search and Bookmark ask to log in | `/job-search?title=nurse` | Click "Bookmark" on the first job, then close the dialog. Then click "Save search" (on a phone, open "Filters" first), then close the dialog. Don't log in. | Each time, a dialog shows on top of the page, saying "Create an account or log in to use this feature", with a "Log In or Register" button, a "Continue Browsing" link, and a "DEED staff and partners log in here." link back to this search. On a phone this currently fails for Save search; see [Known issues](#known-issues). |
| JS-5 | No JavaScript errors | see the list below | Open each page. | No JavaScript error, other than the ones listed in [Known issues](#known-issues). |
| LV-1 | Location pages load | see the list below | Open each of the 4 location pages. | Each page shows its title ("CareerForce in Aitkin", …, "CareerForce from Anywhere") and a "Programs and Services" section. The 3 offices also show "Location Details" with Address, Phone (a link to call), Email (a link to email), Hours (at least 1 day with a time), and a map. "CareerForce from Anywhere" is virtual: no Location Details, but a phone link and an email link. |
| LV-2 | Events page lists events | `/education-and-training/events` | Open the page. Click the first event. Don't register. | The page title "Events" shows, with at least 1 event listed below it. The first event card has a title, a date, a start time and a place. Its page has the event title, the sections "Date", "Time", "Location" and "Offered By", and a "Log In or Create Account" button. |
| LV-3 | Programs and Services page lists services | `/programs-services` | Open the page. Open the first 2 programs. | The page title "Programs and Services" shows, with at least 1 program or service listed below it. Each opened program's page has the same title as its card. |
| CT-1 | Skills Matcher gives results | `/occupations/skills_matcher` | Answer the 10 skill groups on the first page, click "Continue" until the last page, then submit. | A "Matching Careers By My Skills" results page shows. |
| CT-2 | Interest Profiler gives results | `/occupations/interest_profiler` | Answer every question on each page, clicking "Continue" between pages (60 questions in all), then submit. | An "Interest Assessment Results" page shows. |
| CT-3 | Employment Readiness Assessment opens | `/employment-readiness/take` | Open the page. | The page title "Employment Readiness Assessment" shows, with no login needed. |
| MB-1 | Mobile menu opens (phones only) | `/` | On a phone, tap the menu button (☰) in the header. Tap the arrow next to "Find a Job". Then tap the menu button again. | The menu opens and shows "Find a Job", "Job Loss Resources", "Job Search Tools", "Education and Training", and "Resources for". The "Find a Job" sub-menu opens with "Job Search", "Job Fairs and Networking Events", "Explore Careers", and "Explore Industries". The second tap closes the menu. |
| FL-1 | Events: Online vs In Person | `/education-and-training/events` | Open the page with no filter. Then filter by Format "Online", then by "In Person". | See [Filters](#filters). The ticked format stays ticked. |
| FL-2 | Events: two topics | `/education-and-training/events` | Same, with Topic "Resumes", then "Job Search". | See [Filters](#filters). The ticked topic stays ticked. |
| FL-3 | Events: two event types | `/education-and-training/events` | Same, with Event Type "Workshop", then "Job Club". | See [Filters](#filters). The ticked type stays ticked. |
| FL-4 | Programs and Services: two keywords | `/programs-services` | Open with no keyword. Then search "veterans", then "youth". | See [Filters](#filters). The keyword stays in the box, and each search lists a service named after it ("Veterans Employment Services", "Youth Employment"). |
| FL-5 | Job Search: two companies | `/job-search?title=nurse` | Search "nurse". Pick the 2 companies with the most jobs in the Company dropdown, and filter by each in turn. | See [Filters](#filters). The dropdown shows the chosen company, and every job listed is from it. |
| FL-6 | Job Search: two cities | `/job-search?title=nurse` | Same with the City dropdown. | See [Filters](#filters). The dropdown shows the chosen city, and every job listed is in it. |
| FL-7 | Site search: newest vs oldest first | `/search?k=job` | Search "job". Then sort by Date Published, Desc, then Asc. | Both sorts show the same number of results as the unsorted search, in a different order. |
| FL-8 | Training Programs: virtual vs not | `/training-programs` | Open with no filter. Then set Virtual/Hybrid to "True", then "False". | See [Filters](#filters). The dropdown shows the chosen value. |
| GN-1 | Page Not Found | an address that doesn't exist, e.g. `/pww-smoke-test-no-such-page` | Open it. | The site answers "not found" (HTTP 404) and shows the title "Page Not Found", with working links to the homepage (`/`), search (`/search`), and events (`/events`, which opens the Events page). |
| GN-2 | Footer | `/` | Look at the footer. | "Contact CareerForce" with a phone number and an email link. Links to CareerForce Locations, Connect to Our Services, Our Partners, Blog, About CareerForce, Your Right to Fair Treatment, and Site Index. Facebook, X, LinkedIn, YouTube, and Instagram links that open in a new tab. |
| GN-3 | Main menu pages open | see the list below | Check the homepage header has the menu link, then open its page. Do this for each of the 5 main menu items. | Each page opens, and its title starts with the menu item's name. |
| GN-4 | Skip to main content | `/` | Press Tab once, then Enter, then Tab again. | The first Tab shows the "Skip to main content" link. Enter goes to the main content (`#main-content`), and the next Tab lands inside it, not in the header menu. |

Location pages for LV-1:

| Location | Page |
|---|---|
| Aitkin | `/careerforce-location/careerforce-aitkin` |
| Bloomington | `/careerforce-location/careerforce-bloomington` |
| Brooklyn Center | `/careerforce-location/careerforce-brooklyn-center` |
| CareerForce from Anywhere | `/anywhere` |

Main menu pages for GN-3:

| Menu item | Page |
|---|---|
| Find a Job | `/find-job` |
| Job Loss Resources | `/job-loss-resources` |
| Job Search Tools | `/job-search-tools` |
| Education and Training | `/education-and-training` |
| Resources for | `/resources-job-seekers-and-career-explorers` |

Good to know:

- **Job seekers log in with LoginMN** (the State of Minnesota's shared login),
  so the Job Seekers section has no username or password boxes of its own.
  Only partners and training providers use the email and password form.
- **The "PWW Staff Log In" button** in the DEED Staff Member section shows
  only on QA and Stage, not on Production, so HP-2 doesn't check for it.
- **HP-2 never logs in.** The partner form has a reCAPTCHA, and the test
  only opens the two sections to check what's inside them.
- **"Choose a path" starts closed** in the Decision Tree. Click it to open the
  options.
- **Location pages don't always have an "Events" section.** It only appears
  when that location has events scheduled, so LV-1 doesn't check for it.
- **Skills Matcher needs only 10 answers** (all on the first page), but Submit
  is only on the last page, so you still click "Continue" to get there. The
  **Interest Profiler needs all 60 answers.**
- **The jobs on Job Search come from an outside job feed**, so JS-1 to JS-4
  never name a job; they use whatever "nurse" returns.
- **Career pages load in two steps.** The page says "Loading..." until the
  career details arrive, so wait for the title before checking anything.
- **JS-5 checks only real JavaScript errors**, not every red line in the
  browser console. The tests block the analytics and AWS WAF scripts on
  purpose, and those blocked loads show up in the console as errors.
- **Search result counts change** as content is added or removed. The tests
  only check that there's at least 1 result, not an exact number. The same
  goes for the Events and Programs and Services listings (LV-2, LV-3).
- **The Page Not Found page has a 4th link**, "new career opportunity". It
  sends a visitor who isn't logged in to the login page, so GN-1 doesn't
  check it.
- **The footer phone number is plain text**, not a link you can tap to call,
  so GN-2 checks the text only.

Pages for JS-5:

| Page | Address |
|---|---|
| Homepage | `/` |
| Job Search | `/job-search?title=nurse` |
| Site search | `/search?k=job` |
| Explore Careers | `/explore/careers?otitle=Nursing` |

### Known issues

These bugs were found on QA on 2026-11-04. The tests allow for them, so a run
stays green and a *new* problem still fails. When one is fixed, remove its
entry as described.

| Bug | Where | How the test allows for it |
|---|---|---|
| Job Search throws `TypeError: Cannot read properties of null (reading '1')` on every load | `/job-search` | JS-5 lists it in `tests/helpers/known-issues.ts` and adds a "known issue" note to the report. Remove the entry once fixed. |
| On a phone, Save search opens its login dialog *behind* the full-screen Filters panel, so the visitor sees nothing happen | `/job-search`, phones only | JS-4 is marked as expected to fail on phones (`test.fail`). Once fixed, the run reports "expected to fail, but passed"; then remove the `test.fail` line. |

### Filters

The FL cases check that a filter actually filters. Each one opens the listing
with no filter, then with filter X, then with filter Y, and expects:

- The unfiltered listing shows at least 1 result.
- X and Y each show no more results than the unfiltered listing.
- **X and Y show different results:** a different total, or different items
  on the first page.

An empty result is fine. QA has no job fairs at the moment, for example, so
filtering by them shows "No results found." A filter can also match
everything: on QA, every event is In Person. Only X and Y showing the very
same results fails, because that means the filter was ignored. Exact counts
are never checked.

- **Job Search companies and cities come from an outside job feed**, so FL-5
  and FL-6 don't name them. They use the 2 with the most jobs in the
  dropdown at the time.
- **Every filter is in the page address**, for example
  `/education-and-training/events?ff[virtual]=virtual`, so the tests open
  that address rather than clicking the form.
- **Job Search's Location and Distance aren't covered.** The location only
  works when it's picked from the address suggestions, so a typed location
  shows no jobs at any distance.

## Mobile

The same plan also runs on an emulated Android phone (Pixel 7, in Chrome), to
check that the public pages work and fit a small screen. Its project is
`smoke-mobile`.

On the phone:

- **Every case runs except HP-3 and the FL cases.** The tracking code is in
  the page whatever the device, and the filtering happens on the server, so
  checking them once on desktop is enough.
- **MB-1 runs only on phones.** On desktop the menu is always shown, so there
  is no menu button.
- **JS-4 is expected to fail on phones** until the Save search dialog bug
  is fixed ([Known issues](#known-issues)). It still counts as passed.
- **No page may scroll sideways.** After each case, the test also checks that
  the page fits the screen width. If something sticks out past the right edge,
  the test fails and names the widest element.

To run the mobile tests, see [Running the mobile tests](#running-the-mobile-tests).

## Expected result

The terminal ends with `48 passed`. The desktop run has 30 test cases (all
but MB-1, which is phone only), but some are repeated with different inputs,
so they add up to 48 runs:

| Test case | Runs | Why |
|---|---|---|
| HP-1, HP-2, HP-3, HP-4 | 4 | once each |
| SR-1 | 6 | an empty search; "job fair", "networking", "farmer"; a word with no matches; the header search box |
| SR-2 | 4 | "Nursing", "taxi driver", "project manager"; the homepage Explore Careers box |
| SR-3 | 1 | once |
| JS-1, JS-2, JS-3, JS-4 | 4 | once each |
| JS-5 | 4 | Homepage, Job Search, site search, Explore Careers |
| LV-1 | 4 | Aitkin, Bloomington, Brooklyn Center, CareerForce from Anywhere |
| LV-2, LV-3 | 2 | once each |
| CT-1, CT-2, CT-3 | 3 | once each |
| FL-1 to FL-8 | 8 | once each |
| GN-1, GN-2, GN-4 | 3 | once each |
| GN-3 | 5 | the 5 main menu pages |
| **Total** | **48** | |

If the total is anything other than 48, or anything fails, see
[When something fails](README.md#when-something-fails).

The mobile run (`--project=smoke-mobile`) has 40 runs: the same 48 minus
HP-3 and the 8 FL cases, plus MB-1. A successful run ends with `40 passed`.
JS-4 counts as passed there while it fails as expected ([Known issues](#known-issues)).

