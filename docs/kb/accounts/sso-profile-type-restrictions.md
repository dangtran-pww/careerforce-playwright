# SSO restrictions by profile type

Each CareerForce account has a **profile type**: Job Seeker, Partner or Staff. This feature controls which profile types may sign in with each SSO provider. Its main job is to stop partner and staff accounts from signing in with LoginMN, which is meant for job seekers only. It also gives Platform Managers a tool to clean up accounts whose profile setup has gone wrong.

## Who uses it

- **Job seekers, partners and staff** are affected when they sign in.
- **Platform Managers** use the SSO / Profile Management tool.

## How it works

1. The first time someone signs in with an SSO provider, CareerForce links their account to that provider.
2. Before linking, it checks the account's profile type against the provider's allowed list.
3. If the type isn't allowed, the link is refused. The user is returned to `/user/login` with a message, for LoginMN: "Only Job Seekers may login with LoginMN."
4. Once an account is linked, later sign-ins are **not** re-checked.

**SSO / Profile Management tool** (`/admin/config/account/fam-profile/sso-profile-management`)
A list of accounts, 100 per page, showing each one's email, profile type, roles and profiles. It can be filtered to show:
- accounts with more than one profile, or
- job seeker accounts that also have staff roles.

Actions on selected accounts:
- **Set Profile Type**: change the account's profile type.
- **Align Profile with Profile Type**: keep the newest matching profile active and switch off the others.
- **Clear connected accounts**: remove the SSO links. The restriction is checked again on the next sign-in.

## Business rules

| Provider | Who may sign in |
|---|---|
| LoginMN | Job Seekers, and accounts with no profile type yet (new registrations) |
| MN Staff | Anyone |
| PWW (developers) | Anyone |

- Changing an account's profile type does not unlink an existing SSO connection. Use **Clear connected accounts** to make the new rule apply.

## What admins can change

- Allowed profile types and the blocked message for each provider are set on the provider's edit page. System administrators only.
- The management tool is available to Platform Managers.

---
*Built in: `fam_profile` module.*
