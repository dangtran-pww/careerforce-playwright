# [Smoke] - Public Site - General - Test Plan

Status: implemented
Implemented test: tests/smoke/anonymous/*.spec.ts
Parallel: yes

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
- **Locations, Programs and Services:** the pages load with their main
  content, and the Programs and Services page lists at least 1 item.
- **Filters:** on Programs and Services, site search and Training
  Programs, two different filters (or sort orders) give different results
  ([Filters](#filters)).
- **Homepage layout (HP-5, a prompt case):** Claude compares the homepage
  side by side with another site, on desktop and on a phone, and notes any
  layout or styling difference ([prompts/homepage-compare.md](prompts/homepage-compare.md)).
- **Site-wide:** an unknown address shows the "Page Not Found" page, the
  footer has its contact details and links, and each main menu item
  shows its submenu when the mouse is on it and opens its page.
- **On a phone:** the same checks again in an emulated Android phone
  browser, plus the header menu button (MB-1) and a check that no page
  scrolls sideways ([Mobile](#mobile)).

Job Search, the Events page and the career tools have their own plans, and
their cases moved there:

- [](smoke-job-search.md): JS-1 to JS-5, and FL-5 and FL-6 (now JF-1 and
  JF-2).
- [](smoke-events.md): LV-2 (now EP-4), and FL-1 to FL-3 (now EP-5 to
  EP-7).
- [](smoke-jobseeker-tools.md): CT-1 to CT-3 (now JT-6 to JT-8).
- [](../site-wide/functional-site-wide-header-navigation.md): GN-4 (now
  HN-1).

The checks never log in, and they don't create, edit, or delete any site
content. The only things they do besides viewing pages are what any visitor
can do: make choices in the Decision Tree, and filter and sort listings, so
the plan is safe to run on QA, Stage, and **Production**.

The checks don't cover emails or anything that takes longer than a single
visit. Run them after each deployment to confirm the site still works for the
public.

## Login

| **Every case** | Visitor, not logged in |
|---|---|

## Test cases

The tests are in `tests/smoke/anonymous/`. "Page" is the address
after the site name, for example `/programs-services` means
`qa.careerforce.link/programs-services`.

| ID | Test | Page | Steps | Expected result |
|---|---|---|---|---|
| HP-1 | Homepage loads | `/` | Open the homepage. | 1. The main content shows. 2. All 8 sections show their headings: "Job Search", "What brings you here today?", "Upcoming Events", "Explore Careers", "Upcoming Training Programs", "Get the most out of CareerForce, create an account", "Connect to our Services", "CareerForce Blog". 3. The Job Search block shows the text "CareerForce is Minnesota's official career exploration and job search resource.", a keyword box, a location box, a distance dropdown, and a "Search" button. 4. The "What brings you here today?" section shows a "Choose a path" dropdown and 3 cards, each with an image that has loaded (not an empty or broken image) and a title. 5. "Upcoming Events", "Upcoming Training Programs", "Connect to our Services" and "CareerForce Blog" each list at least 1 item, and link to their full list: "Find a filterable list of all events, workshops and appointments" (`/education-and-training/events`), "Find a filterable list of all training programs" (`/training-programs`), "Find a filterable list of all programs and services" (`/programs-services`), "Find more posts" (`/careerforce-blog`). |
| HP-2 | Login page offers all 3 logins | `/user/login` | Don't fill in or submit anything. 1. Open the login page. 2. Click "CareerForce partner organization or a training program provider" to open it. 3. Click "DEED Staff Member" to open it. | 1. The Job Seekers section shows the "Job Seekers" heading, a list of what registering lets them do (at least 1 item; its wording isn't checked), a "Log In or Register with LoginMN" button, and a "Data Privacy Notice" with a link to DEED's data privacy policies (`https://mn.gov/deed/about/what-guides-us/data-practices/`). The partner and DEED staff sections start closed. 2. The partner section shows a "Log In" heading, "Email address" and "Password" boxes, a "Forgot your password?" link to `/user/password`, a "Submit" button, and a "Request one today" link to `/user/register-partner`. 3. The DEED staff section shows 2 buttons on QA and Stage, "Log In" and "PWW Staff Log In", and only the "Log In" button on Production. |
| HP-3 | Tracking code is present | `/`, `/job-search`, `/user/login` | 1. Open the homepage. 2. Open Job Search. 3. Open the login page. | After each step: 1. The page loads (no error or "Page not found" page). 2. Its Google Tag Manager tracking code loads the container for this environment, and no other container: `GTM-WL36T6M` on Production, `GTM-P8D2THV` on QA and Stage. A "GTM-…" text elsewhere on the page (in an article or a link) doesn't count. |
| HP-4 | Decision Tree walks every path | `/` | See [Decision Tree for HP-4](#decision-tree-for-hp-4). In "What brings you here today?": 1. Note the starting cards. 2. For each option under "Choose a path", one at a time: open "Choose a path" and click the option, then open "Make a selection" and click its first answer. 3. On the first path, click each of its answers in turn. 4. With an answer chosen, pick a different option under "Choose a path". 5. Click "Reset selections". 6. Pick the first path again and click its first card. | At every step, at least 1 card shows, each with a title, a loaded image and a link. 1. "Choose a path", at least 2 options, 3 cards, no "Tell us more." and no Reset. 2. After an option: the dropdown closes; "Choose a path" shows the option; a "Tell us more." question appears, its toggle says "Make a selection" and it has at least 2 answers; the cards differ from the starting cards; "Reset selections" shows. After an answer: "Make a selection" shows the answer and the cards differ from the option's cards. 3. Each answer shows a different set of cards. 4. "Tell us more." goes back to "Make a selection", lists the new option's answers, and the cards change. 5. Back to "Choose a path" and the starting cards, with no "Tell us more." and no Reset. 6. The card opens its page with HTTP 200 (after any redirects). The page title isn't checked. |
| SR-1 | Site search returns results | `/search` | 1. Search with no words. 2. Search for "job fair", "networking", and "farmer", one at a time. 3. Search for a made-up word ("zzqxnotaword"). | 1. At least 1 result shows. 2. Each search shows at least 1 result and "Search results 1-N of N", and its first result is a page on this site. 3. "No results found." shows, with no results. |
| SR-2 | Career search returns results | `/explore/careers` | 1. Search for "Nursing", "taxi driver", and "project manager", one at a time. 2. Search for a made-up word ("zzqxnotaword"). | 1. Each search shows at least 1 result. 2. "No results found." shows, with no results. |
| SR-3 | Career page opens | `/explore/careers` | 1. Search for "Nursing" and click the "Registered Nurses" result. It opens in a new tab. 2. Click "Find current job openings in this occupation". | 1. The career page `/explore/careers/29-1141.00` shows the title "Registered Nurses" and the sections "Also known as", "Daily Work Activities", "Data By Region", and "Qualifications". 2. Job Search opens for "Registered Nurses" with at least 1 job. |
| SR-4 | Homepage Explore Careers box runs a career search | `/` | On the homepage, type "Nursing" in the Explore Careers box and click "Search". | The box is its own form, separate from the career search page, so this checks that it sends the search there; HP-1 only checks its heading. 1. The box opens `/explore/careers?otitle=Nursing`. 2. At least 1 result is listed. |
| SR-5 | Header search box runs a site search | `/` | On the homepage, type "networking" in the header's "Search CareerForce" box and press Enter (on a phone, tap the header's "Search" button first). | The header box is its own form, separate from the site search page, so this checks that it sends the search there. 1. The box opens `/search?k=networking`. 2. At least 1 result is listed. |
| LV-1 | Location pages load | `/careerforce-location/careerforce-aitkin`, `/careerforce-location/careerforce-bloomington`, `/careerforce-location/careerforce-brooklyn-center`, `/anywhere` | Open each of the 4 location pages. | 1. Each page shows its title ("CareerForce in Aitkin", …, "CareerForce from Anywhere") and a "Programs and Services" section. 2. The 3 offices also show "Location Details" with Address, Phone (a link to call), Email (a link to email), Hours (at least 1 day with a time), and a map. 3. "CareerForce from Anywhere" is virtual: no Location Details, but a phone link and an email link. |
| LV-3 | Programs and Services page lists services | `/programs-services` | 1. Open the page. 2. Open the first 2 programs. | 1. The page title "Programs and Services" shows, with at least 1 program or service listed below it. 2. Each opened program's page has the same title as its card. |
| MB-1 | Mobile menu opens (phones only) | `/` | 1. On a phone, tap the menu button (☰) in the header. 2. Tap the arrow next to "Find a Job". 3. Tap the menu button again. | 1. The menu opens and shows "Find a Job", "Job Loss Resources", "Job Search Tools", "Education and Training", and "Resources for". 2. The "Find a Job" sub-menu opens with "Job Search", "Job Fairs and Networking Events", "Explore Careers", and "Explore Industries". 3. The menu closes. |
| FL-4 | Programs and Services: two keywords | `/programs-services` | 1. Open the page with no keyword. 2. Search "veterans". 3. Search "youth". | See [Filters](#filters). 1. At least 1 service is listed. 2. "veterans" stays in the box, there are no more services than in step 1, and "Veterans Employment Services" is listed. 3. "youth" stays in the box, there are no more services than in step 1, "Youth Employment" is listed, and the results differ from step 2's. |
| FL-7 | Site search: newest vs oldest first | `/search?k=job` | 1. Search "job". 2. Sort by Date Published, Desc. 3. Sort by Date Published, Asc. | 1. At least 1 result shows. 2. The same number of results as step 1. 3. The same number of results as step 1, in a different order from step 2. |
| FL-8 | Training Programs: virtual vs not | `/training-programs` | 1. Open the page with no filter. 2. Set Virtual/Hybrid to "True". 3. Set it to "False". | See [Filters](#filters). 1. At least 1 program is listed. 2. The dropdown shows "True", with no more programs than in step 1. 3. The dropdown shows "False", with no more programs than in step 1, and the results differ from step 2's. |
| GN-1 | Page Not Found page answers 404 and links back | an address that doesn't exist, e.g. `/pww-smoke-test-no-such-page` | Open it. | 1. The site answers "not found" (HTTP 404). 2. The title "Page Not Found" shows. 3. The links to the homepage (`/`), search (`/search`), and events (`/events`, which opens the Events page) work. |
| GN-2 | Footer shows its contact details and links | `/` | Look at the footer. | 1. "Contact CareerForce" with a phone number and an email link. 2. Links to CareerForce Locations, Connect to Our Services, Our Partners, Blog, About CareerForce, Your Right to Fair Treatment, and Site Index. 3. Facebook, X, LinkedIn, YouTube, and Instagram links that open in a new tab. |
| GN-3 | Main menu submenus show on hover and the menu pages open | `/`, then the pages in [Main menu for GN-3](#main-menu-for-gn-3) | Read the main menu's items from the homepage (text and links aren't fixed). For each item, one at a time, starting on the homepage: 1. Move the mouse onto the item. 2. Move the mouse off the menu. 3. Open the item's own page. | The menu has at least 1 item. 1. Its submenu shows below it with at least 1 link, every link visible, and no other item's submenu shows. 2. The submenu closes. 3. The page opens with HTTP 200. |

## Prompt cases

A prompt case has no test code: Claude follows its prompt file in a browser and gives a verdict ([Rule 2](../README.md#rule-2-prompt-cases)). The prompt file says what Claude checks, as which role, and what passes. It runs after the test cases.

| ID | Test | Prompt |
|---|---|---|
| HP-5 | Homepage layout matches the comparison site | [homepage-compare](prompts/homepage-compare.md) |

## Test data

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

### Main menu for GN-3

The main menu items, their pages, and the links in their submenus, as QA
showed them on 2026-11-19. GN-3 doesn't check any of this wording or these
links: it reads the items from the page, expects at least 1 item and at
least 1 visible link per submenu, opens each item's page, and doesn't open
the submenu links (see [Good to know](#good-to-know)).

| Menu item | Page | Submenu links |
|---|---|---|
| Find a Job | `/find-job` | Job Search (`/job-search`); Job Fairs and Networking Events (`/jobfairs`); Explore Careers (`/explore/careers`); Explore Industries (`/industry/all-industries-careerseekers`, which redirects to `/industry/all-industries`) |
| Job Loss Resources | `/job-loss-resources` | CareerForce Services Overview (`/careerforce-services-overview`); Dislocated Worker (`/dislocatedworker`) |
| Job Search Tools | `/job-search-tools` | Employment Readiness Assessment (`/employment-readiness/take`); Compare Skills (`/occupations/compare-skills`); Interest Assessment (`/occupations/interest_profiler`); Skills Matcher (`/occupations/skills_matcher`); Resumes (`/resumes`); Cover Letters (`/cover-letter`); Applications (`/applications`); Interviews (`/interviews`); Networking (`/networking`) |
| Education and Training | `/education-and-training` | Events (`/education-and-training/events`); Training Program Finder (`/training-programs`); Creative Job Search (`/CreativeJobSearch`); Adult Basic Education (`/minnesota-adult-basic-education`); Education and Training Options (`/education-and-training-options`) |
| Resources for | `/resources-job-seekers-and-career-explorers` | Veterans (`/veterans-resources`); Job Seekers with Disabilities (`/disability-resources`); Job Seekers Over 55 (`/finding-employment-after-55`); Youth (`/youth-resources`); Justice-Involved (`/JusticeInvolved`); Migrant and Seasonal Farmworkers (`/migrant-and-seasonal-farmworker-services`); New Americans (`/resources-new-americans`) |

All 27 submenu links answered HTTP 200 on QA on 2026-11-19 (Explore
Industries after its redirect).

## Good to know

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
- **Career pages load in two steps.** The page says "Loading..." until the
  career details arrive, so wait for the title before checking anything.
- **Search result counts change** as content is added or removed. The tests
  only check that there's at least 1 result, not an exact number. The same
  goes for the Programs and Services listing (LV-3).
- **The Page Not Found page has a 4th link**, "new career opportunity". It
  sends a visitor who isn't logged in to the login page, so GN-1 doesn't
  check it.
- **The footer phone number is plain text**, not a link you can tap to call,
  so GN-2 checks the text only.

The main menu (GN-3), checked on QA at desktop width (1280 and 1366 pixels
wide) as a visitor on 2026-11-19, without clicking any menu link:

- **A submenu opens on mouse hover only.** It shows as soon as the mouse is
  on the item (its name or the space around it), with no delay or
  animation to wait for, and it stays open while the mouse moves down into
  it. Only the hovered item's submenu shows, and it closes as soon as the
  mouse leaves the item and its submenu.
- **Hovering doesn't change any attribute.** Each item has a small arrow
  button next to it ("Sub-menu for Find a Job", …) with `aria-expanded`,
  but hovering leaves it at `"false"`. A test checks that the submenu list
  is visible, not the attribute.
- **Keyboard users open a submenu with the arrow button,** not by tabbing to
  the item's name: focusing the name doesn't open it. Tab moves from the
  name to its arrow button, and clicking it (or Enter) opens the submenu
  and sets `aria-expanded="true"`; clicking again closes it. GN-3 doesn't
  check this; it belongs in [](../site-wide/functional-site-wide-header-navigation.md).
- **A submenu opened with its arrow stays open while another is hovered,**
  so two submenus can show at once. GN-3 only hovers, so it never opens one
  with the arrow.
- **GN-3 doesn't check the menu's wording, links or number of items.**
  Editors change the main menu (both the top-level items and their
  submenus) from the admin pages, and Production may differ from QA, so a
  fixed list would fail on content changes rather than on a broken menu.
  GN-3 reads the top-level items from the page each run. "At least 1 item"
  catches an empty menu, "at least 1 visible link per submenu" an empty
  submenu, and opening each item's page a broken top-level link.
- **GN-3 doesn't open the submenu links.** It checks that the menu works:
  each submenu shows on hover and each top-level page opens. The pages the
  submenu links lead to are covered by their own features' plans.
- **The desktop menu shows from 1024 pixels wide.** Narrower windows show
  the ☰ menu button instead (MB-1), with the same links.

From the app source (careerforce_skin theme), not seen on the site:

- The hover is plain CSS (`.menu-item:hover .menu` shows the submenu from
  the medium breakpoint up); the arrow buttons are added by the theme's
  JavaScript (`es6/global_styles.es6.js`), which also closes other
  arrow-opened submenus and closes one when focus leaves it.
- The menu is Drupal's "Main navigation" menu, placed twice (the desktop
  menu and the phone menu) with 2 levels. Its links are menu content
  editors can change, not site configuration.

### Filters

The FL cases check that a filter actually filters. Each one opens the listing
with no filter, then with filter X, then with filter Y, and expects:

- The unfiltered listing shows at least 1 result.
- X and Y each show no more results than the unfiltered listing.
- **X and Y show different results:** a different total, or different items
  on the first page.

An empty result is fine. QA has no job fairs at the moment, for example, so
filtering by them shows "No results found." A filter can also match
everything. Only X and Y showing the very
same results fails, because that means the filter was ignored. Exact counts
are never checked.

- **Every filter is in the page address**, for example
  `/training-programs?field_virtual=1`, so the tests open
  that address rather than clicking the form.

## Mobile

The same plan also runs on an emulated Android phone (Pixel 7, in Chrome), to
check that the public pages work and fit a small screen. Its project is
`mobile`.

On the phone:

- **Every case runs except HP-3 and the FL cases.** The tracking code is in
  the page whatever the device, and the filtering happens on the server, so
  checking them once on desktop is enough.
- **MB-1 runs only on phones.** On desktop the menu is always shown, so there
  is no menu button.
- **GN-3 skips steps 1 and 2 on the phone.** A phone has no mouse to hover
  with, and the desktop menu is hidden; the ☰ menu and its sub-menus are
  MB-1's job. Step 3 still runs: each item's own page opens.
- **No page may scroll sideways.** After each case, the test also checks that
  the page fits the screen width. If something sticks out past the right edge,
  the test fails and names the widest element.


