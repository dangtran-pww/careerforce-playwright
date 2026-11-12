# [Smoke] - Public Site - General - Test Plan

**Status: implemented.**

**Implemented test:** `tests/smoke/anonymous/*.spec.ts`

**Parallel:** yes

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
- **Locations, Events, Programs and Services:** the pages load with their
  main content, and the Events and Programs and Services pages list at
  least 1 item.
- **Career tools:** the Skills Matcher and Interest Profiler can be filled in
  and show results, and the Employment Readiness Assessment opens.
- **Filters:** on Events, Programs and Services, site search and Training
  Programs, two different filters (or sort orders) give different results
  ([Filters](#filters)).
- **Homepage layout (HP-5, a prompt case):** Claude compares the homepage
  side by side with another site, on desktop and on a phone, and notes any
  layout or styling difference ([Prompt case HP-5](#prompt-case-hp-5)).
- **Site-wide:** an unknown address shows the "Page Not Found" page, the
  footer has its contact details and links, the 5 main menu pages open,
  "Skip to main content" works from the keyboard, and the main pages load
  without JavaScript errors.

Job Search has its own plan, [smoke-job-search.md](smoke-job-search.md).
Its cases (JS-1 to JS-5, and FL-5 and FL-6, now JF-1 and JF-2) moved there.
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

The checks come from the team's manual checklist on Confluence,
[DEED Smoke Testing Template](https://portland-webworks.atlassian.net/wiki/spaces/MNDEED/pages/1540882433).

## Login

| | |
|---|---|
| **Site login** | None. Every test runs as a visitor who isn't logged in. |
| **Role** | Anonymous. No saved session is used, so there is nothing to run `npm run login:manual` for, and nothing that can expire. |
| **Site password gate** | QA and Stage ask for a username and password (a browser "Sign in" pop-up) before showing any page. The tests answer it with `BASIC_AUTH_USER` / `BASIC_AUTH_PASSWORD` from your `.env` file ([one-time setup](../README.md#one-time-setup)). Production has no gate. |
| **Accounts touched** | None. HP-2 opens the login sections but never fills them in or submits. |

If a run fails with 401 / "Unauthorized" on QA or Stage, the gate
password in `.env` is out of date. Ask the team for the current values.

## Running it

No login needed. First time? Do the [one-time setup](../README.md#one-time-setup).
Run the command for the environment you want (about 1–2 minutes).

QA:

```bash
BASE_URL=https://qa.careerforce.link npx playwright test tests/smoke/anonymous --project=smoke-desktop
```

Stage:

```bash
BASE_URL=https://stage.careerforce.link npx playwright test tests/smoke/anonymous --project=smoke-desktop
```

Production:

```bash
BASE_URL=https://careerforce.mn.gov npx playwright test tests/smoke/anonymous --project=smoke-desktop
```

Keep `--project=smoke-desktop` in the command. Without it, the same tests also run on
the phone ([Mobile](#mobile)), 78 runs in all.

Add `--ui` to [watch it run](../README.md#watching-a-run). A successful run ends
with `44 passed` ([Expected result](#expected-result)).

To save a full-page screenshot of every test, even the ones that pass, put
`SCREENSHOT=on` in front ([more on screenshots](../README.md#screenshots-of-every-test)):

```bash
SCREENSHOT=on BASE_URL=https://qa.careerforce.link npx playwright test tests/smoke/anonymous --project=smoke-desktop
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

### Prompt case HP-5

HP-5 has no test code. It is a [prompt case](../README.md#rule-2-prompt-cases):
Claude opens the site in a browser, follows
[prompts/homepage-compare.md](prompts/homepage-compare.md) and gives a
verdict (pass, fail or unsure) with findings and screenshots. The
`npx playwright test` commands above don't run it. Run it from the dashboard
(it runs with the rest of the plan), or on its own:

```bash
npm run prompt -- HP-5 --env qa
```

It compares the homepage with a second site, at desktop and phone sizes:

| Site under test | Compared with |
|---|---|
| QA | Stage |
| Stage | Production |
| Production | The screenshots of the last HP-5 run on Production (the baseline) |

On Production, run HP-5 before a deploy and again after it: the second run
reports what the deploy changed. With no earlier run, it reviews the page on
its own. Add `--compare <env>` (for example `--compare prod`) to compare with
another site, or pick it under "Compare with" in the dashboard. Each run
costs Claude usage (a few minutes, shown at the end).

## Test cases

Every test starts as a visitor who isn't logged in. "Page" is the address
after the site name, for example `/programs-services` means
`qa.careerforce.link/programs-services`.

| ID | Test | Page | Steps | Expected result |
|---|---|---|---|---|
| HP-1 | Homepage loads | `/` | Open the homepage. | **1.** The main content shows. **2.** All 8 sections show their headings: "Job Search", "What brings you here today?", "Upcoming Events", "Explore Careers", "Upcoming Training Programs", "Get the most out of CareerForce, create an account", "Connect to our Services", "CareerForce Blog". **3.** The Job Search block shows the text "CareerForce is Minnesota's official career exploration and job search resource.", a keyword box, a location box, a distance dropdown, and a "Search" button. **4.** The "What brings you here today?" section shows a "Choose a path" dropdown and 3 cards, each with an image that has loaded (not an empty or broken image) and a title. **5.** "Upcoming Events", "Upcoming Training Programs", "Connect to our Services" and "CareerForce Blog" each list at least 1 item, and link to their full list: "Find a filterable list of all events, workshops and appointments" (`/education-and-training/events`), "Find a filterable list of all training programs" (`/training-programs`), "Find a filterable list of all programs and services" (`/programs-services`), "Find more posts" (`/careerforce-blog`). |
| HP-2 | Login page offers all 3 logins | `/user/login` | Don't fill in or submit anything. 1. Open the login page. 2. Click "CareerForce partner organization or a training program provider" to open it. 3. Click "DEED Staff Member" to open it. | **1.** The Job Seekers section shows the "Job Seekers" heading, a list of what registering lets them do (at least 1 item; its wording isn't checked), a "Log In or Register with LoginMN" button, and a "Data Privacy Notice" with a link to DEED's data privacy policies (`https://mn.gov/deed/about/what-guides-us/data-practices/`). The partner and DEED staff sections start closed. **2.** The partner section shows a "Log In" heading, "Email address" and "Password" boxes, a "Forgot your password?" link to `/user/password`, a "Submit" button, and a "Request one today" link to `/user/register-partner`. **3.** The DEED staff section shows 2 buttons on QA and Stage, "Log In" and "PWW Staff Log In", and only the "Log In" button on Production. |
| HP-3 | Tracking code is present | `/`, `/job-search`, `/user/login` | 1. Open the homepage. 2. Open Job Search. 3. Open the login page. | After each step: **1.** The page loads (no error or "Page not found" page). **2.** Its Google Tag Manager tracking code loads the container for this environment, and no other container: `GTM-WL36T6M` on Production, `GTM-P8D2THV` on QA and Stage. A "GTM-…" text elsewhere on the page (in an article or a link) doesn't count. |
| HP-4 | Decision Tree walks every path | `/` | See [Decision Tree for HP-4](#decision-tree-for-hp-4). In "What brings you here today?": 1. Note the starting cards. 2. For each option under "Choose a path", one at a time: open "Choose a path" and click the option, then open "Make a selection" and click its first answer. 3. On the first path, click each of its answers in turn. 4. With an answer chosen, pick a different option under "Choose a path". 5. Click "Reset selections". 6. Pick the first path again and click its first card. | At every step, at least 1 card shows, each with a title, a loaded image and a link. **1.** "Choose a path", at least 2 options, 3 cards, no "Tell us more." and no Reset. **2.** After an option: the dropdown closes; "Choose a path" shows the option; a "Tell us more." question appears, its toggle says "Make a selection" and it has at least 2 answers; the cards differ from the starting cards; "Reset selections" shows. After an answer: "Make a selection" shows the answer and the cards differ from the option's cards. **3.** Each answer shows a different set of cards. **4.** "Tell us more." goes back to "Make a selection", lists the new option's answers, and the cards change. **5.** Back to "Choose a path" and the starting cards, with no "Tell us more." and no Reset. **6.** The card opens its page with HTTP 200 (after any redirects). The page title isn't checked. |
| HP-5 | Homepage layout matches the comparison site | `/` | **Prompt:** [homepage-compare](prompts/homepage-compare.md): Claude compares the homepage with the [comparison site](#prompt-case-hp-5) at desktop and phone sizes, section by section. | **1.** No layout or styling difference that looks unintended: no missing, extra or reordered sections, no broken spacing, fonts, colours or images, and nothing cut off, overlapping or scrolling sideways. **2.** Differences that are only content (other jobs, events, posts or dates) are listed as notes and don't fail the case. **3.** Paired screenshots of each section at each size are saved with the result. |
| SR-1 | Site search returns results | `/search` | 1. Search with no words. 2. Search for "job fair", "networking", and "farmer", one at a time. 3. Search for a made-up word ("zzqxnotaword"). | **1.** At least 1 result shows. **2.** Each search shows at least 1 result and "Search results 1-N of N", and its first result is a page on this site. **3.** "No results found." shows, with no results. |
| SR-2 | Career search returns results | `/explore/careers` | 1. Search for "Nursing", "taxi driver", and "project manager", one at a time. 2. Search for a made-up word ("zzqxnotaword"). | **1.** Each search shows at least 1 result. **2.** "No results found." shows, with no results. |
| SR-3 | Career page opens | `/explore/careers` | 1. Search for "Nursing" and click the "Registered Nurses" result. It opens in a new tab. 2. Click "Find current job openings in this occupation". | **1.** The career page `/explore/careers/29-1141.00` shows the title "Registered Nurses" and the sections "Also known as", "Daily Work Activities", "Data By Region", and "Qualifications". **2.** Job Search opens for "Registered Nurses" with at least 1 job. |
| SR-4 | Homepage Explore Careers box runs a career search | `/` | On the homepage, type "Nursing" in the Explore Careers box and click "Search". | The box is its own form, separate from the career search page, so this checks that it sends the search there; HP-1 only checks its heading. **1.** The box opens `/explore/careers?otitle=Nursing`. **2.** At least 1 result is listed. |
| SR-5 | Header search box runs a site search | `/` | On the homepage, type "networking" in the header's "Search CareerForce" box and press Enter (on a phone, tap the header's "Search" button first). | The header box is its own form, separate from the site search page, so this checks that it sends the search there. **1.** The box opens `/search?k=networking`. **2.** At least 1 result is listed. |
| LV-1 | Location pages load | see the list below | Open each of the 4 location pages. | **1.** Each page shows its title ("CareerForce in Aitkin", …, "CareerForce from Anywhere") and a "Programs and Services" section. **2.** The 3 offices also show "Location Details" with Address, Phone (a link to call), Email (a link to email), Hours (at least 1 day with a time), and a map. **3.** "CareerForce from Anywhere" is virtual: no Location Details, but a phone link and an email link. |
| LV-2 | Events page lists events | `/education-and-training/events` | Don't register. 1. Open the page. 2. Click the first event. | **1.** The page title "Events" shows, with at least 1 event listed below it. The first event card has a title, a date, a start time and a place. **2.** The event's page has the event title, the sections "Date", "Time", "Location" and "Offered By", and a "Log In or Create Account" button. |
| LV-3 | Programs and Services page lists services | `/programs-services` | 1. Open the page. 2. Open the first 2 programs. | **1.** The page title "Programs and Services" shows, with at least 1 program or service listed below it. **2.** Each opened program's page has the same title as its card. |
| CT-1 | Skills Matcher gives results | `/occupations/skills_matcher` | 1. Answer the 10 skill groups on the first page. 2. Click "Continue" until the last page. 3. Submit. | A "Matching Careers By My Skills" results page shows. |
| CT-2 | Interest Profiler gives results | `/occupations/interest_profiler` | 1. On each page, answer every question and click "Continue" (60 questions in all). 2. On the last page, submit. | An "Interest Assessment Results" page shows. |
| CT-3 | Employment Readiness Assessment opens | `/employment-readiness/take` | Open the page. | **1.** The page title "Employment Readiness Assessment" shows. **2.** No login is needed. |
| MB-1 | Mobile menu opens (phones only) | `/` | 1. On a phone, tap the menu button (☰) in the header. 2. Tap the arrow next to "Find a Job". 3. Tap the menu button again. | **1.** The menu opens and shows "Find a Job", "Job Loss Resources", "Job Search Tools", "Education and Training", and "Resources for". **2.** The "Find a Job" sub-menu opens with "Job Search", "Job Fairs and Networking Events", "Explore Careers", and "Explore Industries". **3.** The menu closes. |
| FL-1 | Events: Online vs In Person | `/education-and-training/events` | 1. Open the page with no filter. 2. Filter by Format "Online". 3. Filter by "In Person" instead. | See [Filters](#filters). **1.** At least 1 event is listed. **2.** "Online" stays ticked, with no more events than in step 1. **3.** The same for "In Person", and the results differ from step 2's (a different total, or different events on the first page). |
| FL-2 | Events: two topics | `/education-and-training/events` | 1. Open the page with no filter. 2. Filter by Topic "Resumes". 3. Filter by "Job Search" instead. | See [Filters](#filters). **1.** At least 1 event is listed. **2.** "Resumes" stays ticked, with no more events than in step 1. **3.** The same for "Job Search", and the results differ from step 2's (a different total, or different events on the first page). |
| FL-3 | Events: two event types | `/education-and-training/events` | 1. Open the page with no filter. 2. Filter by Event Type "Workshop". 3. Filter by "Job Club" instead. | See [Filters](#filters). **1.** At least 1 event is listed. **2.** "Workshop" stays ticked, with no more events than in step 1. **3.** The same for "Job Club", and the results differ from step 2's (a different total, or different events on the first page). |
| FL-4 | Programs and Services: two keywords | `/programs-services` | 1. Open the page with no keyword. 2. Search "veterans". 3. Search "youth". | See [Filters](#filters). **1.** At least 1 service is listed. **2.** "veterans" stays in the box, there are no more services than in step 1, and "Veterans Employment Services" is listed. **3.** "youth" stays in the box, there are no more services than in step 1, "Youth Employment" is listed, and the results differ from step 2's. |
| FL-7 | Site search: newest vs oldest first | `/search?k=job` | 1. Search "job". 2. Sort by Date Published, Desc. 3. Sort by Date Published, Asc. | **1.** At least 1 result shows. **2.** The same number of results as step 1. **3.** The same number of results as step 1, in a different order from step 2. |
| FL-8 | Training Programs: virtual vs not | `/training-programs` | 1. Open the page with no filter. 2. Set Virtual/Hybrid to "True". 3. Set it to "False". | See [Filters](#filters). **1.** At least 1 program is listed. **2.** The dropdown shows "True", with no more programs than in step 1. **3.** The dropdown shows "False", with no more programs than in step 1, and the results differ from step 2's. |
| GN-1 | Page Not Found | an address that doesn't exist, e.g. `/pww-smoke-test-no-such-page` | Open it. | **1.** The site answers "not found" (HTTP 404). **2.** The title "Page Not Found" shows. **3.** The links to the homepage (`/`), search (`/search`), and events (`/events`, which opens the Events page) work. |
| GN-2 | Footer | `/` | Look at the footer. | **1.** "Contact CareerForce" with a phone number and an email link. **2.** Links to CareerForce Locations, Connect to Our Services, Our Partners, Blog, About CareerForce, Your Right to Fair Treatment, and Site Index. **3.** Facebook, X, LinkedIn, YouTube, and Instagram links that open in a new tab. |
| GN-3 | Main menu pages open | see the list below | For each of the 5 main menu items: 1. Check the homepage header has the menu link. 2. Open its page. | **1.** The header has the link. **2.** The page opens, and its title starts with the menu item's name. |
| GN-4 | Skip to main content | `/` | 1. Press Tab once. 2. Press Enter. 3. Press Tab again. | **1.** The "Skip to main content" link shows. **2.** The page goes to the main content (`#main-content`). **3.** Focus lands inside the main content, not in the header menu. |
| GN-5 | No JavaScript errors | see the list below | Open each page. | No JavaScript error, other than the ones listed in `tests/helpers/known-issues.ts`. |

Location pages for LV-1:

| Location | Page |
|---|---|
| Aitkin | `/careerforce-location/careerforce-aitkin` |
| Bloomington | `/careerforce-location/careerforce-bloomington` |
| Brooklyn Center | `/careerforce-location/careerforce-brooklyn-center` |
| CareerForce from Anywhere | `/anywhere` |

### Decision Tree for HP-4

The Decision Tree has 2 levels: an option under "Choose a path", then an
answer under "Tell us more.". This is what it showed on QA on 2026-11-10.
HP-4 doesn't check this wording or the card titles, only the structure:
editors change them, and Production may differ.

| Option ("Choose a path") | Answers ("Tell us more.") | Cards after the option |
|---|---|---|
| I want to find a job | I want to find a job as soon as possible; I am thinking about finding a new job in the future; I want some help with my job search | Job Search, Job Loss Resources, Schedule an Appointment |
| I'm seeking career training or education | I'm seeking short-term career training; I want to work on my computer skills or English skills, or prepare for a GED; I'm seeking workshops to help improve my job search skills | Education and Training Options, Training Program Finder, Events and Workshops |
| I'm interested in learning more about my career options | I want to explore career paths and industries; I want to learn how different careers fit with my interests and skills | Explore Industries, Explore Career Options, Jobs in Demand |
| I want to learn about resources available to me | I am receiving unemployment benefits, and I want to complete tasks for my Work Search Plan; I need support for my job search | CareerForce Services Overview, Programs and Services, Connect With CareerForce |

Before any choice, the cards are Find a Job, Connect With CareerForce and Job
Loss Resources. Every answer shows 3 cards, except "I am receiving
unemployment benefits…", which shows 5.

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
  only on QA and Stage, not on Production. HP-2 checks that it is there on QA
  and Stage, and that it is absent on Production.
- **HP-2 never logs in.** The partner form has a reCAPTCHA, and the test
  only opens the two sections to check what's inside them.
- **"Choose a path" starts closed** in the Decision Tree. Click it to open the
  options. "Make a selection" works the same way, and only one of the two
  can be open at a time.
- **The Decision Tree changes in place.** Each choice reloads only the block:
  the address stays `/`, the browser's Back button leaves the homepage
  instead of undoing the choice, and reloading the page starts over.
- **Not every Decision Tree answer shows 3 cards** (one shows 5), so HP-4
  only expects 3 at the start.
- **HP-4 opens the first card, whatever it links to.** Editors can point a
  card at any page, so the test doesn't expect a particular address.
- **Location pages don't always have an "Events" section.** It only appears
  when that location has events scheduled, so LV-1 doesn't check for it.
- **Skills Matcher needs only 10 answers** (all on the first page), but Submit
  is only on the last page, so you still click "Continue" to get there. The
  **Interest Profiler needs all 60 answers.**
- **Career pages load in two steps.** The page says "Loading..." until the
  career details arrive, so wait for the title before checking anything.
- **GN-5 checks only real JavaScript errors**, not every red line in the
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

Pages for GN-5:

| Page | Address |
|---|---|
| Homepage | `/` |
| Site search | `/search?k=job` |
| Explore Careers | `/explore/careers?otitle=Nursing` |

### Known issues

None at the moment.

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

- **Every filter is in the page address**, for example
  `/education-and-training/events?ff[virtual]=virtual`, so the tests open
  that address rather than clicking the form.
- **FL-5 and FL-6 moved** to [smoke-job-search.md](smoke-job-search.md) as
  JF-1 and JF-2. The other FL cases keep their numbers.

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
- **No page may scroll sideways.** After each case, the test also checks that
  the page fits the screen width. If something sticks out past the right edge,
  the test fails and names the widest element.

To run the mobile tests, see [Running the mobile tests](#running-the-mobile-tests).

## Expected result

The terminal ends with `44 passed`. The desktop run has 26 test cases (all
but MB-1, which is phone only), but some are repeated with different inputs,
so they add up to 44 runs:

| Test case | Runs | Why |
|---|---|---|
| HP-1, HP-2, HP-4 | 3 | once each |
| HP-3 | 3 | Homepage, Job Search, login page |
| SR-1 | 5 | an empty search; "job fair", "networking", "farmer"; a word with no matches |
| SR-2 | 4 | "Nursing", "taxi driver", "project manager"; a word with no matches |
| SR-3, SR-4, SR-5 | 3 | once each |
| LV-1 | 4 | Aitkin, Bloomington, Brooklyn Center, CareerForce from Anywhere |
| LV-2, LV-3 | 2 | once each |
| CT-1, CT-2, CT-3 | 3 | once each |
| FL-1 to FL-4, FL-7, FL-8 | 6 | once each |
| GN-1, GN-2, GN-4 | 3 | once each |
| GN-3 | 5 | the 5 main menu pages |
| GN-5 | 3 | Homepage, site search, Explore Careers |
| **Total** | **44** | |

If the total is anything other than 43, or anything fails, see
[When something fails](../README.md#when-something-fails).

The mobile run (`--project=smoke-mobile`) has 35 runs: the same 43 minus
the 3 HP-3 runs and the 6 FL cases, plus MB-1. A successful run ends with `35 passed`.
