# [Stage] - Profile - Test Plan

Status: ready to generate
Implemented test: —

Split out from [deed-smoke-test-plan.md](../docs/deed-smoke-test-plan.md)
§22, Phase 2.

## Running it

```bash
npm run login:manual -- jobseeker
npm run login:manual -- admin
BASE_URL=https://qa.careerforce.link npx playwright test tests/stage/profile
```

## Scope

- Edits profile fields on the job seeker test account and
  puts every field back to its original value in `finally`.
- Synthetic values only — no real names, phone numbers, dates of birth, or
  SSNs.
- Only "harmless" fields are edited: ones that don't change the account's
  role, tier, or login.

## Persona / fixtures

- **Job seeker** — `playwright/.auth/jobseeker.json`.
- **Admin** (stands in for customer support) — `playwright/.auth/admin.json`.
- Admin cases need the job seeker account's user name or uid.

## Test cases

| ID | Title | Persona | Steps | Assertions | Notes |
|---|---|---|---|---|---|
| PF-1 | Job seeker edits a profile section | Job seeker | Open own profile, edit one section, change a harmless field (e.g. phone to `555-0100`), save | Status message confirms the save; the profile shows the new value | Read the original value first and restore it in `finally` |
| PF-2 | Job seeker sets veteran status | Job seeker | Edit profile, set veteran status to Yes, save | The profile shows veteran status as Yes, plus any veteran-specific content or flag | Restore the original value in `finally` |
| PF-3 | Sections save on their own | Job seeker | Edit and save section A, then edit and save section B | Both changes are kept; saving B didn't undo A | Source checklist: "sections are not set up as a workflow" |
| PF-4 | Admin views another user's profile | Admin | `goto('/admin/people')`, filter by the job seeker's user name, open their profile | The profile page renders every section with no error messages | |
| PF-5 | Admin edits another user's profile | Admin, Job seeker | As admin, edit a harmless field on the job seeker's profile, save. Then open the profile as the job seeker | Admin sees the status message and new value; the job seeker sees the same new value | Restore the original value in `finally` |

## Non-goals

- Auto-population fields, match modal, and "enter manually" links (§24) —
  Phase 4, synthetic data only.
- Tier 2 registration — Phase 3 (part of event registration).
- Customer support as its own role — admin stands in until there is a
  `customer-support` session (open question 1).

## Open questions

1. Is there a separate customer support role that should be tested instead
   of admin?
2. Which fields count as harmless to edit (don't trigger re-verification,
   emails, or tier changes)?

## Suggested files

```
tests/
  stage/profile/
    own-profile.spec.ts     # PF-1 .. PF-3
    admin-profile.spec.ts   # PF-4, PF-5
  pages/
    profile.page.ts
```
