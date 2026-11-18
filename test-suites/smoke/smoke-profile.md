# [Smoke] - Profile - Test Plan

Status: implemented
Implemented test: tests/smoke/profile/own-profile.spec.ts, tests/smoke/profile/admin-profile.spec.ts
Prod: No: edits user profiles.

## Overview

A quick check after each deploy that profiles can still be edited: a job
seeker edits a profile section, sets their veteran status and saves two
sections one after the other, and an admin views and edits the job seeker's
profile.

Every case edits the job seeker test account, so the plan runs on QA and
Stage only.

## Login

| **PF-1 to PF-3** | Job seeker role |
|---|---|
| **PF-4 and PF-5** | Admin role, standing in for customer support (see [Open questions](#open-questions)), and Job seeker role to check what the job seeker sees |
| **Accounts touched** | The job seeker account: the Alternate Phone Number, the veteran question and the caregiver question. Each case reads the original value first and puts it back afterwards, even when it fails. |

## Test cases

PF-1 to PF-3 are in `own-profile.spec.ts`, PF-4 and PF-5 in
`admin-profile.spec.ts`. `<uid>` is the job seeker's user ID, read from the
address `/user` goes to. After a section's "Save", the site goes to
`/user/<uid>` and shows "The profile has been saved."

| ID | Test | Page | Steps | Expected result |
|---|---|---|---|---|
| PF-1 | Job seeker edits a profile section | `/user/<uid>/profile/demographic` | 1. In Demographic Information, change Alternate Phone Number to `651-555-0101` (or `651-555-0102` if it already is) and click "Save". 2. Open the section again. **Cleanup:** put the original number back. | 1. "The profile has been saved." shows, with no error message. 2. Alternate Phone Number shows the new number. |
| PF-2 | Job seeker sets veteran status | `/user/<uid>/profile/demographic` | In Demographic Information, the question "Are you a veteran, current U.S. military service member, or eligible military spouse?": 1. Answer "No" and save. 2. Open the section, answer "Yes" and save. 3. Open the section again. **Cleanup:** put the original answer back. | 1. The profile is saved. 2. "No" was still selected when the section opened, and the profile is saved with no error message. 3. "Yes" is selected. |
| PF-3 | Sections save on their own | `/user/<uid>/profile/demographic`, `/user/<uid>/profile/military` | 1. In Demographic Information, change Alternate Phone Number (`651-555-0103` or `651-555-0104`) and save. 2. In Military and Veterans, change the answer to "Are you a caregiver for a U.S. Veteran?" and save. 3. Open both sections again. **Cleanup:** put both original values back. | 1. The profile is saved. 2. The profile is saved, with no error message. 3. Both changes are kept: saving Military and Veterans didn't undo the phone number. |
| PF-4 | Admin views another user's profile | `/admin/people` | 1. Filter People by the job seeker's email ("Name or email address contains", then "Filter"). 2. Click the job seeker's email. | 1. Exactly 1 user is listed, linked by that email. 2. "View Profile" opens at `/user/<uid>` and shows "User ID: <uid>", the sections Account Information, Demographic Information, Education and Employment, Equal Opportunity, Military and Veterans, and Income and Public Assistance, and no error message. |
| PF-5 | Admin edits another user's profile | `/user/<uid>/profile/demographic` | 1. As the admin, change the job seeker's Alternate Phone Number (`651-555-0105` or `651-555-0106`) and save. 2. As the job seeker, open Demographic Information. **Cleanup:** as the admin, put the original number back. | 1. "The profile has been saved." and "View Profile" show, with no error message, and Demographic Information shows the new number ("(651) 555-0105"). 2. Alternate Phone Number shows the new number. |

## Good to know

- **Each section is its own form**, with its own "Save", at
  `/user/<uid>/profile/<section>`: `demographic`,
  `education_and_employment`, `equal_opportunity`, `military`, `income`.
  Account Information is `/user/<uid>/edit`. The job seeker ("My Profile")
  and the admin ("Edit Profile") use the same forms.
- **Saving goes to `/user/<uid>`:** the job seeker's dashboard, or the
  admin's "View Profile", which lists every section's values.
- **"Sections save on their own"** (PF-3) comes from the source checklist:
  the sections aren't a step-by-step workflow, so saving one mustn't undo
  another.
- **PF-2 answers "No" before "Yes"**, so that it really saves a change even
  when the account already answered "Yes".
- **The email is managed by LoginMN**, so it is read-only on My Profile.
  PF-4 reads it there to find the account in People.
- **Only harmless fields are edited:** ones that don't change the account's
  role, tier or login. The phone numbers are synthetic `555-01xx` numbers.
- **Leaving a section with unsaved changes** asks "Leave site?". The tests
  accept it, so a case that stops mid-edit can still put the value back.

## Mobile

Desktop only: every case changes the job seeker account, so the tests are
tagged `@desktop-only`, and a phone run would make the same changes again.

## Not covered

- **Auto-population fields, the match dialog and "enter manually" links**
  (checklist §24): Phase 4, synthetic data only.
- **Tier 2 registration:** Phase 3, with event registration.
- **Customer support as its own role:** the admin stands in until there is
  a `customer-support` session.

## Open questions

1. Is there a separate customer support role that should be tested instead
   of the admin?
2. Which other fields are harmless to edit (don't trigger re-verification,
   emails or tier changes)?
