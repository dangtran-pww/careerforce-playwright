# [Functional] - Auto Logout - Test Plan

Status: partially implemented
Implemented test: tests/functional/site-wide/auto-logout.spec.ts
Pending cases: ALO-1, ALO-2, ALO-3 — generated, waiting for a first passing run

## Overview

This plan tests the inactivity logout for admin pages: they carry the
warning and logout settings, the warning comes at 10 minutes and Yes keeps
the session, and No or no answer leads to logging out. The cases moved
here from [](../smoke/smoke-auto-logout.md), which keeps the job seeker,
visitor and real-logout checks: ALO-1 was AO-1, ALO-2 was AO-3 and ALO-3
was AO-5.

The cases only open pages, answer the warning and read settings, and the
logout requests are blocked, so they are safe on QA, Stage and Production.

[MNDEED-8448](https://portland-webworks.atlassian.net/browse/MNDEED-8448)
asks that every role is logged out after 15 minutes of inactivity, with a
5-minute warning before that: the warning comes at **10 minutes** of
inactivity (`timeout` 600 seconds) and the logout 5 minutes later, at
**15 minutes** (`timeout_padding` 300 seconds).

## Login

| **Every case** | Admin role |
|---|---|

## Test cases

ALO-1 only reads the page's settings. ALO-2 and ALO-3 check the warning:
before opening the page, the test installs Playwright's clock on it and
blocks the logout addresses (see [Good to know](#good-to-know)), and
doesn't move the mouse or type until the warning shows.

| ID | Test | Page | Steps | Expected result | Required login |
|---|---|---|---|---|---|
| ALO-1 | Admin pages carry the 10 + 5 minute settings | `/admin/reports/status`, `/user` | Read the settings from the page's `drupalSettings.autologout`, then go to `about:blank` straight away. 1. Open the status report. 2. Open the account page. | 1. `timeout` is 600000 (10 minutes), `timeout_padding` is 300000 (5 minutes), `no_dialog` and `disable_buttons` are false, `refresh_only` is false, `title` is "CareerForce Alert", `yes_button` is "Yes", `no_button` is "No", and `redirect_url` starts with `/user/login?` and has `autologout_timeout=1`. 2. The same values, and `redirect_url` has `destination=/user/<the admin's user ID>`. | `admin` |
| ALO-2 | Admin: warning at 10 minutes, Yes keeps the session | `/admin/reports/status` | 1. Open the page and advance its clock by 9 minutes 50 seconds. 2. Advance it 15 seconds more (to 10:05), then pause it. 3. Click "Yes". 4. Reload the page. | No request to a logout address is sent at any step. 1. No warning shows. 2. A modal dialog titled "CareerForce Alert" shows the message "We are about to log you out for inactivity. If we do, you will lose any unsaved work. Do you need more time?" with "Yes" and "No" buttons. 3. The dialog closes, and a request to `/autologout_ajax_set_last` succeeds (HTTP 200). 4. The status report still shows (no login page), so the session is still valid. | `admin` |
| ALO-3 | No, or no answer, asks to log out | `/admin/reports/status` | The logout addresses are blocked, so the session isn't really ended. 1. Open the page, advance its clock to 10:05 and click "No". 2. Open the page again in a new page with a fresh clock, advance it to 10:05, then advance it 5 minutes more (to 15:05) without answering. 3. Open `/admin/reports/status` again. | 1. The dialog closes and the page sends a POST to `/autologout_ajax_logout` (blocked by the test; the module sends it twice, from the button and from the dialog's close handler). 2. At 15:00 the page sends one POST to `/autologout_ajax_logout` (blocked). With the logout blocked the script shows the warning again, so the dialog isn't checked. 3. The status report shows: the session is still valid. | `admin` |

## Good to know

- **The shared admin session must survive every case.** It is used by
  every other admin plan, and login is SSO, so a session that gets logged
  out stays dead until someone logs in by hand. The cases are built so
  they can't log anyone out:
  - The page's clock is moved forward with Playwright's clock control, so
    the warning shows in seconds. Real time hardly passes, so the server's
    own 15-minute check never fires.
  - Every page these cases open blocks the two logout addresses
    (`/autologout_ajax_logout` and `/autologout_alt_logout`): the test
    aborts any request to them before it leaves the browser and records
    that it was sent (`tests/helpers/autologout.ts`). A mistake in the
    test then can't end the session.
  - The clock never goes past 15:05 after the page loaded, the warning's
    close button (the "x" in its title bar) is never clicked, and nothing
    on the page is touched before the clock is moved (a mouse move or key
    press counts as activity and changes when the warning shows).
- **QA's settings** (checked with the admin session on 2026-11-12):
  `timeout` 600000 (10 minutes) and `timeout_padding` 300000 (5 minutes)
  on every logged-in page, admin pages included, with the dialog values
  in ALO-1. The settings page `/admin/config/people/autologout` has every
  role at 600 seconds.
- **How the module works** (the warning, Yes, No, no answer, and the
  server's 15-minute check) is described in
  [](../smoke/smoke-auto-logout.md#from-the-source).
- **No content is created.** The cases only open pages, answer the
  warning, and read settings.

## Mobile

Desktop only. The cases check timers and requests, not layout, and each
phone run would use the shared admin session again (the spec is tagged
`@desktop-only`).

## Not covered

- **The settings page itself** (`/admin/config/people/autologout`): ALO-1
  reads the values the page gets, which is what matters after a deploy.
- **Admin roles without a saved login** (Content Manager, Event Manager,
  and the rest). They all get 600 from the `authenticated` role, so ALO-1
  stands for them.

## Open questions

1. **Production:** the cases are prod-safe. Is there a saved admin session
   for Production, and may the tests use it?
