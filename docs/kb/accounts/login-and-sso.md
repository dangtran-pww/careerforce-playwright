# Login and single sign-on (SSO)

CareerForce has one login page, `/user/login`, with a different way in for each kind of user. Job seekers sign in with LoginMN, the State of Minnesota's sign-in service for residents. State staff sign in with their State Microsoft account. Partners use an email and password stored in CareerForce. Signing in through another organization's system like this is called single sign-on (SSO).

## Who uses it

| User | How they sign in |
|---|---|
| Job seekers | **Log In or Register with LoginMN** button |
| Partners | Email and password, in the **Partner Log In** section |
| State staff | **Log In** under the **Staff Log In** section (MN Staff, State Microsoft accounts) |
| Portland Webworks developers | **PWW Staff Log In** (Google), on test environments only |

## How it works

**Job seekers (LoginMN)**
1. The job seeker clicks **Log In or Register with LoginMN**.
2. They sign in on the LoginMN site and are sent back to CareerForce.
3. If a CareerForce account already uses the same email, the two are linked. Otherwise a new Job Seeker account is created, with first and last name taken from LoginMN.
4. They land on the page they were trying to reach.

**State staff (MN Staff)**
Same steps, using the State Microsoft sign-in. A new staff account starts as **Pending** (see [account-states-and-expiration.md](account-states-and-expiration.md)) and is always marked as a Staff profile.

**Partners (email and password)**
1. The partner opens the **Partner Log In** section and enters their email and password.
2. On live environments, people with staff-level roles then get a 6-digit security code by email and must enter it.
3. If the login fails, the section stays open and a new CAPTCHA is shown.

**After login**
- A user whose password has expired is sent to the change-password page first (see [password-and-session-policies.md](password-and-session-policies.md)).
- A visitor who saved careers before logging in is taken to their saved careers list (see [../jobs-and-careers/career-goals-and-suggesters.md](../jobs-and-careers/career-goals-and-suggesters.md)).

## Business rules

- Only Job Seeker accounts may use LoginMN. A partner or staff account that tries is turned away (see [sso-profile-type-restrictions.md](sso-profile-type-restrictions.md)).
- People with a State staff email (`state.mn.us`) must use the MN Staff sign-in, not a password.
- Users log in with their **email address**. Usernames are generated in the background and never shown; the email is displayed as the user's name.
- A new email address must belong to a real domain, otherwise the form shows "Email address domain is unverified".
- The login page has no "Create account" or "Reset password" links under the partner form.

## Connected systems

| System | Used for |
|---|---|
| LoginMN (State of Minnesota) | Job seeker sign-in and registration |
| Microsoft (State tenant) | State staff sign-in |
| Google | Portland Webworks developer sign-in (test environments only) |

## What admins can change

- **SSO providers** (`/admin/config/account/fam-auth-provider`): which sign-in systems exist and how new accounts are set up. System administrators only.
- **Who may use each provider:** see [sso-profile-type-restrictions.md](sso-profile-type-restrictions.md).

## Known issues

- The "Connected Accounts" page on a user's profile can only be opened by System Administrators.

---
*Built in: `fam_oidc`, `careerforce` modules, with contrib FAM and OpenID Connect.*
