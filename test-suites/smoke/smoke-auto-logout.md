# [Smoke] - Auto Logout - Test Plan

Status: implemented
Implemented test: tests/smoke/auto-logout/*.spec.ts
No-prod cases: AO-7

## Overview

A quick check after each deploy that inactive users are logged out: job
seeker pages carry the warning and logout settings, the warning comes at
10 minutes and Yes keeps the session, visitors get no timer, and a page
really left alone for 15 minutes ends the session. The admin cases (AO-1,
AO-3 and AO-5) moved to [](../site-wide/functional-site-wide-auto-logout.md)
as ALO-1 to ALO-3; their IDs aren't reused here.

AO-2, AO-4 and AO-6 only open pages, answer the warning and read settings,
and the logout requests are blocked, so they are marked prod-safe (see
[Open questions](#open-questions)). AO-7 is not: it logs a dedicated
partner account in through the login form and waits out a real logout,
so it is `Prod: No` and runs only where that account is set up (see
[Test data](#test-data)).

[MNDEED-8448](https://portland-webworks.atlassian.net/browse/MNDEED-8448)
asks that every role is logged out after 15 minutes of inactivity, with a
5-minute warning before that: the warning comes at **10 minutes** of
inactivity (`timeout` 600 seconds) and the logout 5 minutes later, at
**15 minutes** (`timeout_padding` 300 seconds).

## Login

| **AO-2 and AO-4** | Job seeker role |
|---|---|
| **AO-6** | Visitor, not logged in |
| **AO-7** | The dedicated partner account, logged in through the `/user/login` form (see [Test data](#test-data)); no saved session |
| **Accounts touched** | AO-7 logs the dedicated partner account in and lets it be logged out; nothing on the account is changed. Logging in ends any earlier session of that account (single session is on), which nobody else uses. |

## Test cases

AO-2 only reads the page's settings, in `settings.spec.ts`. AO-4 checks
the warning, in `warning.spec.ts`: before opening the page,
the test installs Playwright's clock on it and blocks the logout addresses
(see [Good to know](#good-to-know)), and doesn't move the mouse or type
until the warning shows. AO-6 checks what a visitor sees after a logout,
in `after-logout.spec.ts`. AO-7 waits out a real logout, in
`real-logout.spec.ts`, tagged `@no-prod`: the real clock, no blocked
logout addresses, and nothing touched on the page after it loads. It
runs in the normal desktop smoke project, but its spec needs a long
timeout (about 20 minutes: the login, 15:45 of waiting and the last
check).

| ID | Test | Page | Steps | Expected result | Required login | Prod |
|---|---|---|---|---|---|---|
| AO-2 | The job seeker dashboard carries the logout settings | `/user` | Open the dashboard, read its `drupalSettings.autologout`, then go to `about:blank` straight away. | `timeout` is 600000 (10 minutes), `timeout_padding` is 300000 (5 minutes), `no_dialog` and `disable_buttons` are false, `refresh_only` is false, `title` is "CareerForce Alert", `yes_button` is "Yes", `no_button` is "No", and `redirect_url` starts with `/user/login?` and has `autologout_timeout=1`. | `jobseeker` | Yes |
| AO-4 | Job seeker: warning at 10 minutes, Yes keeps the session | `/user` | 1. Open the page and advance its clock by 9 minutes 50 seconds. 2. Advance it 15 seconds more (to 10:05), then pause it. 3. Click "Yes". 4. Reload the page. | No request to a logout address is sent at any step. 1. No warning shows. 2. A modal dialog titled "CareerForce Alert" shows the message "We are about to log you out for inactivity. If we do, you will lose any unsaved work. Do you need more time?" with "Yes" and "No" buttons. 3. The dialog closes, and a request to `/autologout_ajax_set_last` succeeds (HTTP 200). 4. The dashboard still shows (no login page). | `jobseeker` | Yes |
| AO-6 | Visitors: the inactivity message, and no timer | `/user/login` | Don't log in. 1. Open `/user/login`. 2. Open `/user/login?destination=/user&autologout_timeout=1` (the address a logged-out page goes to). | 1. The page has no `drupalSettings.autologout` and shows no "logged out due to inactivity" message. 2. A status message says "You have been logged out due to inactivity.", and the login page shows. | | Yes |
| AO-7 | A page left alone really logs out at 15 minutes | `/user/login`, `/user` | The case skips when the account isn't set up for the environment, or when step 1's login says the account doesn't exist (see [Test data](#test-data)). From step 2 to step 6 nothing on the page is touched and no other request is made with this account. 1. Log in with the account through the Drupal login form for partners on `/user/login`. 2. Open `/user` and note when it has loaded (T0). 3. Leave the page alone until T0 + 9:30. 4. Wait for the warning, up to T0 + 10:30, and don't answer it. 5. Leave the page alone until T0 + 14:30. 6. Wait for the page to change, up to T0 + 15:45. 7. Open `/user`. | Steps 3 and 4 are soft checks, so a wrong warning time still lets the logout be checked. 1. The login page is left with no error message, on `/user/<its user ID>` or, while its partner profile isn't complete, `/user/<its user ID>/partner`: either means the login worked. Any other login failure fails the case. 2. The page has `drupalSettings.autologout`, and its `redirect_url` has `autologout_timeout=1`. 3. No "CareerForce Alert" dialog shows yet. 4. The "CareerForce Alert" dialog shows, with the message, "Yes" and "No" as in AO-4: at 10 minutes, 30 seconds either side. 5. The page is still the one opened in step 2, with the dialog open: not logged out yet. 6. The page is on `/user/login`, its address has `autologout_timeout=1`, and a status message says "You have been logged out due to inactivity." 7. `/user` goes to the login page ("Log In or Register"), not the account's page: the session really ended on the server. | The dedicated partner account, through the login form | No: logs a real account in and waits 15 minutes for a real logout; no account is set up for Production |

## Test data

### Account for AO-7

- **The account:** a dedicated test account with the authenticated role
  and the **partner** profile type, used by AO-7 alone. It is not the SSO
  `partner` saved session. Each environment has its own pair in `.env`:
  `AUTO_LOGOUT_USER_<ENV>` and `AUTO_LOGOUT_PASSWORD_<ENV>` (`QA`,
  `STAGE`, `SANDBOX`, `LOCAL`; see `.env.example`). The username and
  password are never written in the plan, the spec or a report.
- **Checking it exists before the test runs.** The test doesn't use any
  other login to look the account up. It checks in this order:
  1. The pair for the current environment isn't set: the case skips with
     "The auto logout account isn't set up for <env>
     (AUTO_LOGOUT_USER_<ENV>, AUTO_LOGOUT_PASSWORD_<ENV>)."
  2. It is set, and the login form answers "Unrecognized username or
     password": the case skips with "The auto logout account doesn't
     exist on <env>, or its password in .env is wrong." Drupal gives the
     same message for both, so the test can't tell them apart.
  3. Any other login failure (no partner form, another error, no
     redirect away from `/user/login`): the case fails.
- **Nothing is created** and nothing on the account is changed. The
  account is logged out at the end by the real autologout, so there is
  nothing to clean up.

## Good to know

- **The shared saved session must survive every case.** The job seeker
  session is used by every other job seeker plan, and login is SSO, so a
  session that gets logged out stays dead until someone logs in by hand.
  AO-2, AO-4 and AO-6 are built so they can't log anyone out:
  - The page's clock is moved forward with Playwright's clock control, so
    the warning shows in seconds. Real time hardly passes, so the server's
    own 15-minute check (see [On the server](#from-the-source)) never fires.
  - Every page these cases open blocks the two logout addresses
    (`/autologout_ajax_logout` and `/autologout_alt_logout`): the test
    aborts any request to them before it leaves the browser and records
    that it was sent (`tests/helpers/autologout.ts`). A mistake in the
    test then can't end the session.
  - The clock never goes past 15:05 after the page loaded, the warning's
    close button (the "x" in its title bar) is never clicked, and nothing
    on the page is touched before the clock is moved (a mouse move or key
    press counts as activity and changes when the warning shows).
- **AO-7 can't hurt the shared sessions.** It logs in with its own
  account through the `/user/login` form, so the real logout ends only
  that account's session. It uses no saved session.
- **AO-7's timing.** The page's script shows the warning `timeout` after
  the page loads (plus one short request to the server), and asks the
  server again `timeout_padding` later; the server ends the session once
  900 seconds have passed since the page's own request, and the page then
  goes to `redirect_url`. So the warning is checked in a minute around 10
  (9:30 to 10:30) and the logout between 14:30 and 15:45; the extra 45
  seconds after 15:00 cover the logout request, the redirect and the
  login page loading.
- **No content is created.** The cases only open pages, answer the
  warning, and read settings.

### On QA

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
- **The login form:** how AO-7 logs in, the partner form on `/user/login`
  and where a partner lands, is in
  [Logging in with the partner login form](../../README.md#logging-in-with-the-partner-login-form).
- **AO-7 on QA on 2026-11-24:** the dedicated account logs in through
  the partner form (QA's test reCAPTCHA passes with one click) and lands
  on `/user/<ID>/partner`, because its organization profile isn't filled
  in. Left alone, the page showed the warning at about 10 minutes, was still logged in at 14:30, and went to the login page with
  "You have been logged out due to inactivity." before 15:45; `/user`
  then showed the login page.
- **Visitors:** `/user/login` and `/` have no `drupalSettings.autologout`
  and no autologout script. `/user/login?destination=/user/185476&autologout_timeout=1`
  shows a status message "You have been logged out due to inactivity."
  (`x-drupal-cache: UNCACHEABLE`, so it isn't served from the page cache);
  `/user/login` without the parameter shows no message.

### From the source

From the source (`drupal/autologout` 2.0.3, `config/sync/autologout.*`,
`user_policies`) only.

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
- **When the warning comes:** with these settings the warning comes **5
  minutes** before the logout: at 10 minutes, with the logout at 15. If
  the user was
  active in the 30 seconds before the 10-minute check, the timer restarts
  silently and the warning comes 10 minutes later.
- **On the server:** every ordinary request from a logged-in user records
  its time in the session (`autologout_last`). A request that comes 900
  seconds (timeout + padding, 15 minutes) or more after the last one logs
  the user out on the spot and shows the inactivity message. The three
  autologout AJAX addresses don't count as activity. This is why a saved
  session that no test uses for 15 minutes is dead, with or without a page
  open.
- **One session per account:** `$settings['user_policies']['single_session']`
  is on, so logging in again elsewhere ends the earlier session.

## Mobile

Desktop only. The cases check timers and requests, not layout, and each
phone run would use the shared sessions again (and run AO-7's 15-minute
wait twice) (`auto-logout` is in
`DESKTOP_ONLY_SMOKE_AREAS` in `tests/helpers/devices.mts`).

## Not covered

- **The real logout for the other roles.** AO-7 waits it out with one
  partner account; every role gets the same settings (AO-2, and ALO-1 in
  [](../site-wide/functional-site-wide-auto-logout.md)), so it
  stands for them. A real logout with a shared session would need a new
  login by hand.
- **The server's own 15-minute check with no page open** (a request after
  15 idle minutes is logged out even if no script ran). The shared sessions
  dying after 15 idle minutes shows it works.
- **Activity in the last 30 seconds restarting the timer silently**, and
  several tabs keeping each other alive. Functional depth.
- **The dialog on a phone.** `modal_width` is 450, wider than a 390px
  phone; whether the dialog fits is checked in
  [](../site-wide/functional-site-wide-auto-logout.md), not in this
  smoke plan.
- **Admin pages:** checked in
  [](../site-wide/functional-site-wide-auto-logout.md).

## Open questions

1. **Job seeker on QA:** the job seeker session had expired, so AO-2 and
   AO-4 rest on the source. Check their values on the first run.
2. **"Use highest role timeout value"** is ticked on QA but off in
   `config/sync/autologout.settings.yml`: config drift. Harmless today
   (every role has the same timeout). Is it meant to be on?
3. **Production:** AO-2, AO-4 and AO-6 are marked prod-safe (they only
   read and answer the warning; the logout addresses are blocked). Is there
   a saved job seeker session for Production, and may the tests use it?
