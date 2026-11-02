# Customer support: account search and user support tabs

Customer service and user-management staff can find any account (job seeker, partner or staff) and open support pages for that user: their groups, webform submissions, content submissions and account settings. This is mostly a set of permissions, menu links and tabs that open pages built elsewhere on the site.

## Who uses it

| Role | Access |
|---|---|
| Platform Manager | All search pages and all user tabs |
| Account Manager | All search pages and all user tabs |
| Job Service Administrator | Job seeker search only, plus viewing profiles |
| Job Service Manager | Job seeker search only, plus viewing profiles |

## How it works

**Searching** (under People in the admin menu)
1. Open **Search all accounts** (`/admin/people/search-users/all-accounts`) to search every account.
2. Or open **Search Job Seekers** (`/admin/people/search-users/job-seekers`) or **Search Partners/Staff** (`/admin/people/search-users/partners-staff`).
3. Use the filter bar, including a created-date range, and expand a row for more detail.
4. Platform Managers and System Administrators can also export the Partners/Staff list at `/admin/people/search-users/partners-staff/export`.

**Opening a user.** From a result, the user's page has these tabs:

| Tab | Path | Needs |
|---|---|---|
| Groups | `/user/{user}/groups` | access to the groups list |
| Webform Submissions | `/user/{user}/webform-submissions` | access to the webform submissions list |
| Content Submissions | `/user/{user}/content-submissions` | access to the content submissions list |
| Account Settings | `/user/{user}/account-settings` | access to account settings (a restricted permission) |

A job seeker's **Services** tab is described in [service-records-and-catalog.md](service-records-and-catalog.md). **Back to List** returns to the search page that matches the user's type.

## Business rules

- Each search page has its own permission, so a role can be allowed one search and not the others. Job Service Administrators and Job Service Managers get a 403 (no access) on the other two.
- The export is limited by role (Platform Manager, System Administrator), not by permission.
- The same roles that see the tabs can also open the Labor Market and Skills and Experience pages for a user. See [../job-seeker-tools/](../job-seeker-tools/).

## Connected systems

None.

## What admins can change

- Which roles get each search and tab permission, on the permissions page. Access to account settings is marked restricted.
- The user search actions and user states are covered in [../accounts/](../accounts/).

## Known issues

None found.

---
*Built in: `cf_customer_support` module.*
