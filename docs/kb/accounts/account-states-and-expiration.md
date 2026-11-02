# Account states and inactivity expiration

Every CareerForce account has a **state** that controls whether it can log in: Active, Pending, Blocked, Inactive or Suspended. Account Managers change states on the user's edit page. Staff and partner accounts that aren't used for 60 days are made Inactive automatically, so unused accounts with access to sensitive data are switched off.

## Who uses it

- **Account Managers and Platform Managers** change states and set the expiration rules.
- **Partners and State staff** start as Pending when they first register.

## The states

| State | Can log in? | Meaning |
|---|---|---|
| Pending | Yes | Partner or staff waiting for approval to join an organization |
| Active | Yes | Normal account |
| Blocked | No | Blocked for system reasons, or email not validated |
| Inactive | No | Switched off after a period of not being used |
| Suspended | No | Blocked by an admin, for example after suspicious activity. Check the notes before reactivating. |

> **Note:** The list of states, and which moves between them are allowed, is defined at `/admin/config/workflow/workflows/manage/user_state`. Only System Administrators can open that page.

## How it works

**Changing a state by hand**
Go to the user's **Account Settings** page, `/user/{user}/account-settings`, and edit the **User state** field. It shows the current state and only the states the editor is allowed to move it to. Every change is kept as history.

**Partner and staff approval**
1. A partner who registers at `/user/register-partner`, or a staff member signing in with MN Staff for the first time, gets a **Pending** account. They can log in.
2. A vetting connection is created for them (see [../services/](../services/)).
3. When staff close that vetting connection, the account becomes **Active**.

**Automatic expiration**
Once a day, around 02:00 UTC, CareerForce finds staff and partner accounts that haven't logged in for 60 days and sets them to **Inactive**. Accounts that never logged in are measured from the day they were created.

## Business rules

- Allowed moves:
  - Any state can go to Active or Suspended.
  - Active or Blocked can go to Blocked.
  - Active can go to Inactive.
  - Active, Blocked or Pending can go to Pending.
- So a Suspended or Inactive account can only go back to Active (or stay Suspended).
- Expiration applies to:
  - all partner and staff accounts, and
  - anyone with a staff-level role (Location Administrator up to System Administrator).
- **Job seekers never expire.**
- Inactive accounts are meant to be deleted after 365 days, but see Known issues.
- Pending accounts are not sent to the State's data system until they become Active.

## What admins can change

- **Expiration rules** (`/admin/config/people/user-policies`): which roles expire, after how many days, the daily run time, and when to purge. Account Managers and Platform Managers.
- **States and allowed moves** (`/admin/config/workflow/workflows/manage/user_state`): System Administrators only.
- **A user's state:** on their Account Settings page, `/user/{user}/account-settings`.

## Known issues

- **Purge never deletes anyone.** The step meant to delete accounts after 365 days inactive appears to stop exactly when it finds accounts to delete, and to keep running when there are none. Verify before relying on purge.

---
*Built in: `user_state` and `user_policies` (shared Portland Webworks module) modules.*
