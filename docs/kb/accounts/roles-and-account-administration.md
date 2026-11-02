# Roles and account administration

CareerForce staff have roles that decide what they can do. Roles are ranked, so a manager can only edit accounts and assign roles below their own rank. This doc lists the roles and describes the tools Account Managers use: giving roles, unlocking accounts that were locked out, and how other people's account pages are hidden.

## The roles

Ranked from most to least powerful. Job seekers and partners usually have no extra role.

| Role | What it's for |
|---|---|
| System Administrator | Full access to everything. |
| Platform Manager | Runs the site. Can assign any role except System Administrator. Has the SSO / Profile Management tool. |
| Account Manager | Manages users, account states, groups and partner vetting. Can unlock accounts. |
| Content Manager | Site-wide content, menus, announcements and settings. |
| Event Manager | Events, appointment sessions and service items. |
| Job Service Manager | Appointments, event registrations, resumes and service records. |
| Job Service Administrator | Location-level content, plus job seeker search, resumes, profiles and service records. |
| Location Administrator | Creates and edits their own location's pages, services and training programs. |

Account Manager, Content Manager, Event Manager and Job Service Manager share the same rank.

## How it works

**Ranking**
- You can edit an account only if your highest role ranks above theirs.
- You can't change your own roles.
- You can give or remove only roles that rank below your own.

**Giving roles**
Roles are set on the user's edit page. There is no separate Roles tab.

| Role | Can give |
|---|---|
| Account Manager | Location Administrator, Job Service Administrator |
| Platform Manager | Every role except System Administrator |

**Unlocking an account**
After 3 failed password logins, an account is locked for up to 2 hours. An Account Manager or Platform Manager can pick **Reset Login Timeout** on the account in the people list to unlock it straight away.

**Hiding other people's pages**
If you open a page that belongs to someone else (their dashboard, profile, resumes, settings), you get "Page not found" instead of "Access denied". This avoids revealing which accounts exist.

## What admins can change

- The list of pages that show "Page not found" instead of "Access denied": `/admin/config/careerforce/user-routes`.
- Role rankings: on each role's settings page (developers).

## Known issues

- **Content Manager offered but refused:** Account Managers are offered Content Manager, but saving fails because it ranks the same as their own role.
- **Unlock link has no CSRF check:** the Reset Login Timeout link works as a plain link, which a security review may want to change.

---
*Built in: `user_policies`, `cf_role_delegation`, `flood_reset`, `careerforce` modules.*
