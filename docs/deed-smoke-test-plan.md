# DEED Smoke Testing — Automation Plan

Source: [Prod DEED Smoke Testing 10/21/2026 (Sol)](https://portland-webworks.atlassian.net/wiki/spaces/MNDEED/pages/1568571395/Prod+DEED+Smoke+Testing+10+21+2026+Sol)

That Confluence page is a manual, run-it-by-hand checklist QA uses after every
prod deploy. This document regroups it into something we can build Playwright
coverage from: what's safe to automate, what needs a test inbox or a
third-party login provider, and what has to stay a manual/visual check.

Legend: 🤖 automatable now · ✉️ needs a test inbox · 👁 visual/manual only ·
🚫 stage/QA only, never prod

## Environments

| Env | URL pattern | Use |
|---|---|---|
| Prod | careerforce.mn.gov / careerforcemn.com | read-only checks only |
| Stage | stage.careerforce.link | full read/write flows |
| QA | qa.careerforce.link | full read/write flows |
| Sandbox | sandbox.careerforce.link | account-type switching for test setup |

Many checklist items are explicitly "do not test on prod" (search-api
reindex, permissions rebuild, event/appointment registration, resume builder,
groups). Those become stage/QA-only suites, same as `admin.spec.ts` in this
repo today — prod only ever gets the read-only suites, same rule the
`tests/smoke/` suite already follows.

## Personas / fixtures needed

Mirrors the by-hand `login:manual -- <role>` pattern (see README), one
storage state per role:

- **Anonymous** — no login
- **Job seeker** — plain account, plus a variant with Tier 2 registration
  completed (needed for event/appointment registration tests) and a
  "vet" profile variant
- **Staff / facilitator** — can manage a location's events/appointments
- **Partner / employer** — registers via the "join Careerforce" connection
  path
- **Admin / customer support** — can view/edit other users' profiles, manage
  groups, mark attendance

None of these need real PII. Where the source doc tests SSN/DOB-driven
auto-population, use synthetic values only — never real identifiers.

## Suite breakdown

### 1. Platform health (P0, read-only, prod-safe)
- 🤖 `/admin/reports/status` — assert no *new* errors vs. a known-issues
  baseline (the Solr "Content" error is accepted as known-good)
- 🤖 `/admin/reports/translations` warning is expected on stage/prod, not QA
  — assert presence/absence matches that pattern
- 👁 recent log messages — needs human judgment on what's a regression

### 2. Search (P0, read-only, prod-safe)
- 🤖 keyword search on the General content index — compare result count
  between live and the environment under test
- 🤖 `/explore/careers` keyword search
- 🤖 search-api index counts (General, Occupation) — read the admin counts
  page, don't trigger reindex outside stage/QA

### 3. Search-API maintenance 🚫 (P1, stage/QA only)
- 🤖 rebuild tracking + reindex each index, assert it completes without
  error

### 4. Homepage & responsive layout
- 👁 desktop/mobile layout vs. live — visual, but worth a Playwright
  `toHaveScreenshot()` baseline per viewport once stage settles, to flag
  unintended diffs between deploys
- 🤖 Decision Tree widget on the homepage — functional interaction test
- 🤖 GTM container ID present (`GTM-P8D2THV` lower envs, `GTM-WL36T6M` prod)
  — assert the script tag/dataLayer, not full tag-manager behavior

### 5. System emails ✉️
- Forgot username, password reset (+ "password changed" notice)
- Needs a test-inbox integration (Mailtrap/Mailosaur/Gmail API) before this
  can assert email *content*, not just "an email exists." Until that's
  wired up, keep as a manual checklist item.

### 6. Auto logout (P1)
- 🤖 15-minute timeout, 5-minute warning, for both admin and job seeker
  roles ([MNDEED-8448](https://portland-webworks.atlassian.net/browse/MNDEED-8448))
  — long-running test (~15 min); worth a dedicated low-frequency suite
  rather than running every PR

### 7. Staff/Partner registration via LoginMN 🚫✉️
- Redirects to a third-party IdP (LoginMN) — can assert the redirect
  happens, but a full account-creation round trip needs either a LoginMN
  sandbox or stays manual. Flag as an open question (see below).

### 8. Location & view pages (P0/P1, prod-safe read checks)
- 🤖 location page shows events/programs/services sections (e.g.
  `/brooklyncenter`)
- 🤖 `/events`, `/programs-services` view pages render and list content

### 9. Permissions rebuild 🚫 (P1, stage/QA only)
- 🤖 `/admin/reports/status/rebuild` completes without error

### 10. Notifications/alerts block 🚫 (P1, stage/QA, off-peak only)
- 🤖 block at `/admin/structure/block` renders both notification and alert
  types ([MNDEED-7946](https://portland-webworks.atlassian.net/browse/MNDEED-7946))

### 11. Custom tools — anonymous + job seeker (P1)
- 🤖 Skills Matcher (`/occupations/skills_matcher`) — compare skills, add to
  goals
- 🤖 Interest Profiler (`/occupations/interest_profiler`) — the doc's
  console snippet that randomizes radio answers is a manual-debugging
  shortcut; a Playwright version should just fill the form via the DOM
  directly instead of injecting that script
- 🤖 Employment readiness assessment (`/employment-readiness/take`)

### 12. Job search (P1)
- 🤖 `/job-search` filters
- 🤖 saved searches
- 🤖 "my job search" management on the dashboard

### 13. Content admin (P1)
- 🤖 publish/unpublish (archive) a page
- 🤖 revisioning — revert and view older revisions with no errors
- 🤖 block placement — custom blocks and page-restricted blocks

### 14. Resume builder 🚫 (P1, stage/QA only — explicitly "don't test in prod")
- 🤖 create/update master resume (add/edit experience & duties)
- 🤖 create/update tailored resume
- 🤖 upload resume

### 15. CKEditor 5 (P1)
- 🤖 toolbar parity across Full HTML / Basic HTML / Restricted HTML formats
- 🤖 table formatting, media embed, headers, list formatting

### 16. Media browser (P1)
- 🤖 browse/add existing media wherever media fields exist
- 🤖 upload new media; delete is a known bug
  ([MNDEED-8325](https://portland-webworks.atlassian.net/browse/MNDEED-8325)) —
  write the test to the *expected* behavior and let it fail until fixed,
  rather than asserting the bug

### 17. Translation (P1)
- 🤖 translate a page — [MNDEED-8191](https://portland-webworks.atlassian.net/browse/MNDEED-8191)
  is open; same approach as above, assert correct behavior

### 18. Content parity checks (manual, not automated)
- 👁 side-by-side custom-page comparison vs. Live
- 👁 "recreate a complex page from scratch" exercise — this is a one-off
  content QA exercise per release, not a repeatable regression test; leave
  it manual

### 19. Groups: Connections & Location Groups 🚫✉️ (P2)
- Partner/employer "join Careerforce" vetting flow, new-partner email,
  location-group member emails
  ([MNDEED-8299](https://portland-webworks.atlassian.net/browse/MNDEED-8299)
  still reproducing) — blocked on the same test-inbox need as #5

### 20. Job seeker registration via LoginMN (new feature) 🚫✉️ (P1)
- Anonymous user tries to save a search/career → LoginMN modal → account
  creation → welcome email → returned to original context. Same third-party
  IdP dependency as #7.

### 21. Event & appointment registration/cancellation 🚫✉️ (P1)
- Register/cancel as job seeker and as admin, for both events and
  appointments; assert dashboard and "my events & appts" state changes.
  Known bug: cancellation email subject line is wrong
  ([MNDEED-9748](https://portland-webworks.atlassian.net/browse/MNDEED-9748)).
  Reference sheet: the team's
  [cancellation-flow spreadsheet](https://docs.google.com/spreadsheets/d/1HeTwX1NgBvml9CJDmJn3dxKcPsxLQd7el0Kw_-Bpi48/edit)
  is the source of truth for exact flows — use it to derive test cases, not
  this summary.

### 22. Profile & admin views (P1)
- 🤖 job seeker edits own profile (including vet status)
- 🤖 admin/customer-support views and edits another user's profile

### 23. Waitlist 🚫 (P2, stage/QA only)
- Join waitlist on a full event, admin cancels waitlist entry, dashboard
  updates reflect it on both sides

### 24. Auto Population 🚫 (P2, stage/QA only, synthetic data only)
- New user record with First/Last/DOB — **use fabricated test values only,
  never real SSN/DOB**. Covers: match modal accept/decline, blank+disabled
  auto-pop fields for the end user, conditional-field suppression, "enter
  manually" / "cancel manual entry" links, and the staff-facing raw-value
  view on Edit Profile.

### 25. Events admin (P2, stage/QA only)
- Create catalog item, schedule/cancel occurrences and sessions, group
  location-scheduler permission check, 45-day public-visibility cutoff

### 26. Location Events (P2, stage/QA only, ✉️)
- Alternate-location create/delete, associate to event, moving a
  registered job seeker's event location and confirming the email +
  dashboard updates on both staff and job-seeker sides. Known bug: "MN" not
  shown for online-only events on cards
  ([MNDEED-9620](https://portland-webworks.atlassian.net/browse/MNDEED-9620))

### 27. Appointments (P1/P2)
- 🤖 public search, 8-day visibility cutoff
- 🚫 admin create/view via location menu, dashboard blocks for both admin
  and job-seeker views

### 28. Service & Activity Tracking 🚫 (P2, stage/QA only)
- Admin marks attendance → service record auto-created; service record
  created from an attended appointment; self-service activity logging
  (job search, resumes, etc.) shows on the user's own services dashboard

### 29. Private & external events (P2)
- 🤖 private events excluded from search, location listings, and the
  featured state-wide block
- External events: not detailed enough in the source doc to scope —
  needs a follow-up conversation with the dev team before writing tests

### 30. Out of scope for this plan
- "Individual stories from latest sprint" — changes every sprint, belongs
  in per-ticket acceptance tests, not a standing smoke suite

## Proposed phasing

1. **Phase 1 — prod-safe read-only smoke** (already underway in
   `tests/smoke/`): platform health, search comparisons, location/view
   pages, GTM tag presence, Decision Tree, anonymous custom-tools usage. No
   new infrastructure needed; ship first.
2. **Phase 2 — stage/QA interactive flows, no email dependency**: CKEditor,
   media browser, revisioning, block placement, translation, publish/
   unpublish, profile edit, job search, resume builder, skills
   matcher/interest profiler as a logged-in job seeker, permissions
   rebuild, search-api reindex.
3. **Phase 3 — email- and third-party-dependent flows**: everything gated
   ✉️ above (system emails, LoginMN registration, event/appointment
   registration & cancellation, groups/connections, location events).
   Blocked until the test-inbox and LoginMN-sandbox questions below are
   answered.
4. **Phase 4 — long-running or sensitive**: auto logout (~15 min per run,
   keep it in a separate low-frequency job), auto-population (synthetic
   data only), waitlist, service tracking.

## Open questions

- **Test inbox**: is there an existing Mailtrap/Mailosaur/Gmail-API setup
  the team uses for the `davidmread+...@gmail.com`-style test addresses, or
  does one need to be set up before Phase 3 can start?
- **LoginMN**: is there a sandbox/test instance of the LoginMN identity
  provider Playwright can drive end-to-end, or does that leg of
  registration stay a manual step forever?
- **Visual regression**: worth investing in `toHaveScreenshot()` baselines
  for the homepage/mobile homepage comparisons, or keep those manual since
  they're usually eyeballed against Live during a release window anyway?

## Suggested file layout

```
tests/
  setup/
    job-seeker.setup.ts       # + a tier-2-registered variant
    staff.setup.ts
    admin.setup.ts
    partner.setup.ts
  smoke/                        # already underway: platform health, search, GTM, views
  search-api.spec.ts           # 🚫 stage/QA
  homepage.spec.ts             # decision tree + GTM + (later) visual baseline
  auto-logout.spec.ts          # long-running, separate CI job
  job-search.spec.ts
  resume-builder.spec.ts       # 🚫
  ckeditor.spec.ts
  media-browser.spec.ts
  revisioning.spec.ts
  translation.spec.ts
  block-placement.spec.ts
  profile.spec.ts
  events.spec.ts               # 🚫
  appointments.spec.ts
  registration-cancellation.spec.ts  # 🚫 ✉️
  groups-connections.spec.ts   # 🚫 ✉️
  location-events.spec.ts      # 🚫 ✉️
  service-tracking.spec.ts     # 🚫
  auto-population.spec.ts      # 🚫, synthetic data only
  helpers/
    email.ts                  # test-inbox client, once chosen
    test-data.ts               # rebuild as a JSON:API helper if/when a role needs it again
```

Each suite should open with the manual Given/When/Then this repo's README
already asks for, so QA/BA readers can verify a spec matches the intended
journey without reading Playwright code.
