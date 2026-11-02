# My Goals & Experience (career goals, work and military experience)

The "My Goals & Experience" page lets a job seeker keep a list of career goals and past work experience, both as occupation codes, and launches the career exploration tools. Work experience can be added from a civilian job title (SOC code) or from a military occupation (MOC code, by branch). The page, its AJAX endpoints and the work/military experience forms live in the main `careerforce` module. Storage and the occupation/MOC lookups come from `civiserv_jobs` and `occupation_moc` (see `../jobs-and-careers/`).

## What users see
- **`/user/{uid}/skills-experience`**, tab "My Goals & Experience" on the user page. The title is "My Goals & Experience" on your own page and "Goals & Experience" when staff view someone else's. It shows:
  - **Career goals:** the saved occupations, with remove buttons on your own page, plus a career search autocomplete (`CareerSearchAutocompleteForm`) to add more.
  - **Work experience:** "Add Your Work Experience" with a job-title autocomplete. Military-experience fields appear for veterans (details below).
  - **Tool cards:**

    | Card | Opens |
    |---|---|
    | Search skills | Skills Matcher |
    | Search interests | Interest Profiler |
    | Search experience | Jumps to `#work-experience-ajax-wrapper` |
    | Search careers by my military experience | Modal |
    | View in demand careers | In-demand careers |

    The Skills Matcher and Interest Profiler cards change to "See my … results" / "View careers" once the user has saved answers.
- **Military experience in the work experience form:**
  - If the profile's `field_veteran_or_military` is `1`, the form shows "Add Your Military Experience" (branch select + military occupation autocomplete).
  - If the value is unset or `'NULL'`, it shows a "Do you have military experience?" checkbox that reveals those fields over AJAX.
  - If it is any other value, the military fields are not shown.
- **`/careerforce/forms/military_occupation`**: the "Search Careers by Military Experience" form, opened as a modal from the military tool card (branch + MOC autocomplete).
- Access to the page: authenticated `career_seeker`, `partner` or `staff` user viewing their own page, or anyone with user `view` access plus `access skills experience` (defined in `cf_customer_support`; granted to `site_admin` and `user_manager`).

## How it works
- **Storage:**
  - Career goals go to user field `field_career_goals` (max `civiserv_jobs.max_career_goals` = 6) for authenticated users. Anonymous visitors use cookie `pending_careers` (max 12) through `AuthBasedOccupationData`.
  - Work experience goes to `field_work_experience`. Its limit `civiserv_jobs.max_work_experience` is `0`, which the code treats as no limit.
  - Items are stored as `{type, code}`, where type is SOC or MOC (`MocCode` = moc + branch, lower-cased).
- **Page build:** `content()` sets `#cache max-age 0`. It passes the goals, experience and remove URLs (with CSRF tokens) to `drupalSettings.CareerForce`, which the JS in library `careerforce/skills-experience` appears to render as cards (not traced in detail). Remove links and add forms are only built on your own page.
- **Adding work experience:**
  - The value must come from the `civiserv_jobs.soc_autocomplete` suggestions. It is parsed with the regex `[ … ]` → `SocCode`.
  - Duplicates are rejected with "This occupation is already a part of your work experience."
  - On success the AJAX response sends `AddOccupationCommand('workExpDisplays', …)`. Errors come back as a JS `alert()`.
- **Military:**
  - The forms parse the value chosen from `occupation_moc.autocomplete` as `moc::<code>::<branch>` → `MocCode` or `soc::<code>` → `SocCode`. Any other prefix fails with "Please select a valid … occupation".
  - In the modal form, Submit adds the code and closes the dialog with `AddOccupationCommand(...)->setJumpTo(TRUE)`. Without AJAX it redirects back to the page.
- **Removal:** GET routes with `_csrf_token` return `RemoveOccupationCommand`. Removing items calls `setOccupations()`, which shows "Successfully updated your …" and invokes `hook_career_goals_update` (stenographer `job_seeker_tools`).
- **Goal add (`/careerforce/ajax/career_goals/add/{soc}`):** CSRF only, no role requirement, so it also works for anonymous visitors (cookie storage). It alerts when the maximum is reached or the code is already saved.

## External services and integrations
- Occupation titles and in-demand lists come through `civiserv_jobs` / `mn_lmi` data requests, and MOC lookups through the `occupation_moc` module. See `../jobs-and-careers/`.

## Configuration and permissions
- Limits are container parameters in `civiserv_jobs.services.yml`, not config.
- `access skills experience` (from `cf_customer_support`): view another user's page.
- AJAX remove routes for experience require the `authenticated` role plus a CSRF token.

## Related
- [job-seeker-tools-tracker.md](job-seeker-tools-tracker.md)
- [jobs-for-me-personalization.md](jobs-for-me-personalization.md) (career goals feed the "Jobs for me" selector)
- `../jobs-and-careers/` (Skills Matcher, Interest Profiler, career search, `civiserv_jobs`)
