# [Smoke] - Auto Logout - Test Plan

Status: ready to generate
Implemented test: —

Devices: desktop only. The cases check timers and requests, not layout, and each phone run would use the shared sessions again (add `auto-logout` to `DESKTOP_ONLY_SMOKE_AREAS` in `tests/helpers/devices.mts`).

The team's post-deploy checklist on Confluence ("Prod DEED Smoke Testing
11/05/2026") asks, per
[MNDEED-8448](https://portland-webworks.atlassian.net/browse/MNDEED-8448),
that every role is logged out after 15 minutes of inactivity, with a
warning before that ("5 min warning given at 11 min"). Testers checked it
as system admin and as job seeker. The warning is meant to come at **11
minutes** of inactivity, with the logout at **15 minutes** (decided
2026-11-12). QA is configured for a warning at 10 minutes (see "What the
site has"), so AO-1 to AO-5 fail there until the setting is changed.

## Scope

- **The shared saved sessions must survive every case.** `admin` and
  `jobseeker` are used by every other logged-in plan, and login is SSO, so
  a session that gets logged out stays dead until someone logs in by hand.
  AO-1 to AO-6 are built so they can't log anyone out:
  - The page's clock is moved forward with Playwright's clock control, so
    the warning shows in seconds. Real time hardly passes, so the server's
    own 15-minute check (see "What the site has") never fires.
  - Every page these cases open blocks the two logout addresses
    (`/autologout_ajax_logout` and `/autologout_alt_logout`): the test
    aborts any request to them before it leaves the browser and records
    that it was sent. A mistake in the test then can't end the session.
  - The clock is never moved past 14 minutes after the page loaded, the
    warning's close button (the "x" in its title bar) is never clicked, and
    nothing on the page is touched before the clock is moved (a mouse move
    or key press counts as activity and changes when the warning shows).
- **The real logout** (the server ends the session and the browser lands
  on the login page) stays a manual check (see "Not covered").
- Not data-changing: the cases only open pages, answer the warning, and
  read settings.

## Login and test data

- **Admin** (`admin`): `playwright/.auth/<env>/admin.json` (`useRole('admin')`).
- **Job seeker** (`jobseeker`): `playwright/.auth/<env>/jobseeker.json`
  (`useRole('jobseeker')`).
- **Visitor**: AO-6, no login.
- No content is created.

## What the site has

Checked on QA with the admin session on 2026-11-12, without saving
anything. The admin pages were read as raw HTML (requests, no page
JavaScript run), so no timer started. The job seeker session had expired,
so the job seeker side comes from the source only.

- **Every logged-in page has the settings** in `drupalSettings.autologout`
  (checked on `/user`, `/job-search`, `/admin/reports/status` and
  `/admin/config/people/autologout`): `timeout` 600000 (ms, 10 minutes),
  `timeout_padding` 300000 (ms, 5 minutes), `title` "CareerForce Alert",
  `message` "We are about to log you out for inactivity. If we do, you
  will lose any unsaved work. Do you need more time?", `yes_button` "Yes",
  `no_button` "No", `no_dialog` false, `disable_buttons` false,
  `refresh_only` false (also on admin pages), `use_alt_logout_method`
  false, `logout_regardless_of_activity` false, `modal_width` 450, and
  `redirect_url` `/user/login?destination=<this page>&autologout_timeout=1`.
  It also has the four addresses the script calls, each with a token:
  `ajax_get_time_left_url`, `ajax_set_last_url`, `ajax_logout_url`,
  `alt_logout_url`.
- **Settings page** `/admin/config/people/autologout`, heading "Automated
  logout settings": "Enable autologout" ticked, "Timeout value in seconds"
  600, "Timeout padding" 300, "Role Timeout" ticked, and every role in the
  role table (Authenticated user, Location Administrator, Job Service
  Administrator, Content Manager, Account Manager, Event Manager, Job
  Service Manager, Platform Manager, System Administrator) enabled with
  600. "Use highest role timeout value" is ticked on QA (it is off in the
  repository's config); with every role at 600 it makes no difference.
- **Visitors:** `/user/login` and `/` have no `drupalSettings.autologout`
  and no autologout script. `/user/login?destination=/user/185476&autologout_timeout=1`
  shows a status message "You have been logged out due to inactivity."
  (`x-drupal-cache: UNCACHEABLE`, so it isn't served from the page cache);
  `/user/login` without the parameter shows no message.

From the source (`drupal/autologout` 2.0.3, `config/sync/autologout.*`,
`user_policies`) only:

- **Who is logged out:** every logged-in user. The `authenticated` role is
  enabled with 600 seconds, and every account has it. Job seekers have no
  role of their own (`config/sync` has no `user.role.job_seeker`; the
  leftover `autologout.role.job_seeker` is disabled), so they get 600 from
  `authenticated`. Users can't set their own timeout ("Disable
  user-specific logout thresholds" is ticked). No environment split
  changes these settings; only local development turns autologout off
  (`settings.local.php`).
- **In the page (client):** 10 minutes (`timeout`) after the page loads or
  after the last refresh, the script checks for activity (a mouse move, key
  press or form change in the last 30 seconds). If there was some, it calls
  `ajax_set_last_url` and starts another 10 minutes. If not, it asks
  `ajax_get_time_left_url` with `uactive=false`; the server then answers
  "0 left" without looking at the session, so the warning shows. The
  warning is a modal dialog titled "CareerForce Alert" with the message
  and two buttons, "Yes" and "No"; Escape doesn't close it.
  - **Yes:** sets the `Drupal.visitor.autologout_login` cookie, calls
    `ajax_set_last_url` (the server records the time) and starts another
    10 minutes.
  - **No, or closing it with its "x":** POSTs to `ajax_logout_url`, then
    goes to `redirect_url`.
  - **No answer:** 5 minutes (`timeout_padding`) later the script asks
    `ajax_get_time_left_url` again. The time left is 0 or less, so it
    POSTs to `ajax_logout_url` and goes to `redirect_url`, where the
    visitor sees "You have been logged out due to inactivity."
  So with QA's settings the warning comes **5 minutes** before the logout:
  at 10 minutes, with the logout at 15. The intended warning at 11 minutes
  needs `timeout` 660 seconds and `timeout_padding` 240 seconds (logout
  still at 15). If the user was active in the 30 seconds before the
  10-minute check, the timer restarts silently and the warning comes 10
  minutes later.
- **On the server:** every ordinary request from a logged-in user records
  its time in the session (`autologout_last`). A request that comes 900
  seconds (timeout + padding, 15 minutes) or more after the last one logs
  the user out on the spot and shows the inactivity message. The three
  autologout AJAX addresses don't count as activity. This is why a saved
  session that no test uses for 15 minutes is dead, with or without a page
  open.
- **One session per account:** `$settings['user_policies']['single_session']`
  is on, so logging in again elsewhere ends the earlier session.

## Test cases

AO-1 and AO-2 only read the page's settings, in
`tests/smoke/auto-logout/settings.spec.ts`. AO-3 to AO-5 check the warning,
in `tests/smoke/auto-logout/warning.spec.ts`: before opening the page,
install Playwright's clock on the page and block the logout addresses (see
Scope), and don't move the mouse or type until the warning shows. AO-6
checks what a visitor sees after a logout.

| ID | Test | Page | Steps | Expected result | Required login | Prod |
|---|---|---|---|---|---|---|
| AO-1 | Admin pages carry the 11 + 4 minute settings | `/admin/reports/status`, `/user` | Read the settings from the page's `drupalSettings.autologout`, then go to `about:blank` straight away. 1. Open the status report. 2. Open the account page. | Each step: **1.** `timeout` is 660000 (11 minutes), `timeout_padding` is 240000 (4 minutes), `no_dialog` and `disable_buttons` are false, `refresh_only` is false, `title` is "CareerForce Alert", `yes_button` is "Yes", `no_button` is "No", and `redirect_url` starts with `/user/login?` and has `autologout_timeout=1`. **2.** The same values, and `redirect_url` has `destination=/user/<the admin's user ID>`. | `admin` | Yes |
| AO-2 | Job seeker pages carry the same settings | `/user`, `/job-search` | Read as in AO-1. 1. Open the dashboard. 2. Open Job Search. | **1.** `timeout` is 660000 and `timeout_padding` is 240000, with the same dialog values as AO-1. **2.** The same values. | `jobseeker` | Yes |
| AO-3 | Admin: warning at 11 minutes, Yes keeps the session | `/admin/reports/status` | 1. Open the page and advance its clock by 10 minutes 50 seconds. 2. Advance it 15 seconds more (to 11:05), then pause it. 3. Click "Yes". 4. Reload the page. | No request to a logout address is sent at any step. **1.** No warning shows. **2.** A modal dialog titled "CareerForce Alert" shows the message "We are about to log you out for inactivity. If we do, you will lose any unsaved work. Do you need more time?" with "Yes" and "No" buttons. **3.** The dialog closes, and a request to `/autologout_ajax_set_last` succeeds (HTTP 200). **4.** The status report still shows (no login page), so the session is still valid. | `admin` | Yes |
| AO-4 | Job seeker: warning at 11 minutes, Yes keeps the session | `/user` | As AO-3, on the dashboard. 1. Open the page and advance its clock by 10 minutes 50 seconds. 2. Advance it 15 seconds more (to 11:05), then pause it. 3. Click "Yes". 4. Reload the page. | No request to a logout address is sent at any step. **1.** No warning shows. **2.** The "CareerForce Alert" dialog shows with the same message and buttons as AO-3. **3.** The dialog closes, and a request to `/autologout_ajax_set_last` succeeds (HTTP 200). **4.** The dashboard still shows (no login page). | `jobseeker` | Yes |
| AO-5 | No, or no answer, asks to log out | `/admin/reports/status` | The logout addresses are blocked, so the session isn't really ended. 1. Open the page, advance its clock to 11:05 and click "No". 2. Open the page again in a new page with a fresh clock, advance it to 11:05, then advance it 4 minutes more (to 15:05) without answering. 3. Open `/admin/reports/status` again. | **1.** The dialog closes and the page sends one POST to `/autologout_ajax_logout` (blocked by the test). **2.** The dialog closes by itself and the page sends one POST to `/autologout_ajax_logout` (blocked). **3.** The status report shows: the session is still valid. | `admin` | Yes |
| AO-6 | Visitors: the inactivity message, and no timer | `/user/login` | Don't log in. 1. Open `/user/login`. 2. Open `/user/login?destination=/user&autologout_timeout=1` (the address a logged-out page goes to). | **1.** The page has no `drupalSettings.autologout` and shows no "logged out due to inactivity" message. **2.** A status message says "You have been logged out due to inactivity.", and the login page shows. | | Yes |

## Not covered

- **The real logout after 15 idle minutes** stays a manual check, as in
  the team's checklist (decided 2026-11-12): log in as each role, leave the
  page alone, see the warning at 11 minutes, and at 15 minutes land on the
  login page with "You have been logged out due to inactivity." A test
  can't do it without ending a shared session, which needs a new login by
  hand.
- **The server's own 15-minute check with no page open** (a request after
  15 idle minutes is logged out even if no script ran). The shared sessions
  dying after 15 idle minutes shows it works.
- **Activity in the last 30 seconds restarting the timer silently**, and
  several tabs keeping each other alive. Functional depth.
- **The dialog on a phone.** `modal_width` is 450, wider than a 390px
  phone; whether the dialog fits wasn't checked (Open questions).
- **The settings page itself** (`/admin/config/people/autologout`): AO-1
  reads the values the page gets, which is what matters after a deploy.
- **Roles without a saved login** (Content Manager, Event Manager, and the
  rest). They all get 600 from the `authenticated` role, so AO-1 and AO-2
  stand for them.

## Open questions

1. **Job seeker on QA:** the job seeker session had expired, so AO-2 and
   AO-4 rest on the source. Check their values on the first run.
2. **"Use highest role timeout value"** is ticked on QA but off in
   `config/sync/autologout.settings.yml`: config drift. Harmless today
   (every role has the same timeout). Is it meant to be on?
3. **Production:** AO-1 to AO-6 are marked prod-safe (they only read and
   answer the warning; the logout addresses are blocked). Is there a saved
   admin and job seeker session for Production, and may the tests use it?
4. **Phone:** should the dialog's fit on a phone (450px wide) be checked,
   e.g. as a prompt case?

## Suggested files

```
tests/
  smoke/auto-logout/
    settings.spec.ts   # AO-1 (useRole('admin')), AO-2 (useRole('jobseeker'))
    warning.spec.ts    # AO-3, AO-5 (admin); AO-4 (jobseeker); clock + blocked logout routes
    after-logout.spec.ts  # AO-6 (visitor)
  helpers/
    autologout.ts      # read drupalSettings.autologout; block and record the logout routes
```
