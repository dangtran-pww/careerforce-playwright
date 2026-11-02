# Password and session policies

Accounts that log in with a CareerForce password must follow the State's password rules: minimum length, mixed characters, no reuse, and regular expiry. Staff-level roles get stricter rules than everyone else. Each account can also be logged in from only one place at a time. People who sign in only through LoginMN or MN Staff follow those systems' password rules instead.

## Who uses it

- **Partners**, who log in with a password.
- **Staff-level roles** that log in with a password.

## How it works

- While typing a new password, a live checklist shows which rules are met and whether the two entries match.
- If the password breaks a rule, saving fails with an error.
- When a password expires, every page sends the user to `/user/{user}/edit/password` with "Your password has expired, please update it". The Cancel button becomes **Logout**.
- Logging in from a second browser or device ends the first session.
- Browsers are asked not to autofill password and email fields.

## Business rules

| | Staff-level roles | Everyone else |
|---|---|---|
| Minimum length | 12 | 8 |
| Character types (upper, lower, number, symbol) | All 4 | 3 of 4 |
| Can't reuse | Last 24 passwords | Last 24 passwords |
| Expires after | 60 days | 90 days |
| Minimum time between changes | 1 day | None |
| Can't contain | Username, site name or account name | Same |

- Staff-level roles: Location Administrator, Job Service Administrator, Content Manager, Event Manager, Job Service Manager, Account Manager, Platform Manager, System Administrator.
- The expiry clock only restarts when users change **their own** password. A password set by an admin doesn't count.
- If someone is given a staff-level role, they must change their password at their next page load, because the stricter rules now apply.

## What admins can change

- Password rules: `/admin/config/people/user-policies/password` (System Administrators).

## Known issues

- **New accounts created by an admin** never expire until the user sets their own password.
- **Existing accounts reset by an admin** keep the old expiry date, so the user may be told the password has expired right after an admin reset.

---
*Built in: `user_policies` (shared Portland Webworks module).*
