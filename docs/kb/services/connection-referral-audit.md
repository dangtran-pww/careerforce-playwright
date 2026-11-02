# Connection (referral) audit and aging statistics

CareerForce keeps a history of changes to **connections**, which the system also calls referrals. Connections appear to link a user to a group or provider, and come in two types: CareerForce and vetting. Admins read the change history on a report page, and a second report shows how long connections take to be assigned and closed.

## Who uses it

- **Anyone who can view site reports** can read the Referral Audit.
- **Platform Managers and System Administrators** can open the Connection Aging Report and export it.

## How it works

**Referral Audit** (`/admin/reports/referral-audit`) is a sortable table, 50 rows per page. Columns: Referral Id, Type, User, Field Name, New Id, New Value and Modified.

Each time a connection is created or changed, CareerForce records one row for each of these that changed: owner, sender, assignee, provider, content, workflow status and vetting type. The row shows the person who made the change.

**Connection Aging Report** (`/admin/reports/connection-aging-report`, with a CSV export) shows, for each connection:
- when it was opened,
- when it was first assigned,
- when it was first closed,
- how long it took, from opened to first closed.

A connection counts as closed when its status becomes closed, denied or archived.

## Business rules

- Only changes to a value that is not empty are logged. Clearing a field leaves no row.
- Assigned and closed times are set once and never reset, so reopening a connection does not change them.
- Opened is the day the connection was created.

## Connected systems

None. History is kept on the site only.

## What admins can change

Nothing. There are no settings for either report.

## Known issues

- **Report help text does not match the figures.** The help text says "first time moderation state was set to Open" and "last time" assigned or closed. The figures appear to be the creation time and the first assignment and first close. Verify before filing.
- **Rare duplicate-change errors.** Two changes to the same field on the same connection in the same second could clash in the history. This is unlikely from the screens, but could happen in bulk updates. Verify before filing.

For how connections are used (self-connect, vetting approval, notification emails), see [../accounts/](../accounts/) and [../locations/](../locations/).

---
*Built in: `civiserv_referral_audit` module.*
