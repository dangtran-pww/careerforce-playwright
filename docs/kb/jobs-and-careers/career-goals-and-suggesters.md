# Career goals and occupation suggesters

Career goals are the occupations a user wants to pursue. A signed-in user keeps up to 6 on their account; an anonymous visitor can collect up to 12 "pending" careers in a cookie and save them after logging in. Goals can be added from career pages, the "My Goals & Experience" page, and the occupation suggesters. The suggesters are tools that recommend occupations: In-Demand Careers, Skills Matcher and Interest Profiler. Goals then feed "Jobs for me" on the job search page.

> Scope note: the Interest Profiler and Skills Matcher are also job seeker tools. This doc covers the plugin and data side in our career modules. For tool-level UX and test plans, see [../job-seeker-tools/](../job-seeker-tools/).

## What users see

| URL | What | Who |
|---|---|---|
| `/occupations/mn_in_demand` (hyphens also accepted, e.g. `/occupations/mn-in-demand`) | "In Demand Careers": up to 20 in-demand occupations for the user's region, as checkboxes to save as goals. | Anyone with `access civiserv_jobs occupation suggesters` (anonymous + authenticated) |
| `/occupations/skills_matcher` | "Skills Matcher": a question form, then up to 50 matching occupations. | same |
| `/occupations/interest_profiler` | "Interest Profiler": a 6-step questionnaire, then RIASEC scores and matching careers. | same |
| `/occupations/anon_stored_careers` | "Careers You Wanted to Add": the anonymous user's pending careers, shown after login so they can be saved. | same |
| `/occupation-goals-anonymous` | "Save Your Career Goals": a static page with Log in / Sign up links. | same |
| Career page buttons | "Add to career goals" / "Remove from career goals"; anonymous: "Add to dashboard" / "Remove from pending…"; partners: also "Add to / Remove from now hiring". | see [explore-careers-and-occupation-pages.md](explore-careers-and-occupation-pages.md) |
| `/user/{user}/skills-experience` | "My Goals & Experience" (or "Goals & Experience" for staff viewing someone else): career goals, work experience (civilian SOC and military MOC), occupation search box, career tools panel. | Profile type `career_seeker`, `partner` or `staff`, with view access to the user; another user's page also needs `access skills experience` (`user_manager`, `site_admin`). Add/remove controls show only on your own page. |

## How it works

### Storage

`field_career_goals` and `field_work_experience` are `occupation_code` fields (unlimited cardinality in storage). The 6-goal limit comes from the container parameter `civiserv_jobs.max_career_goals`, enforced in `SkillsExperienceController::goalAdd()` and the suggestion form, not by the field.

### Add / remove routes

| Route | Path | Requirements |
|---|---|---|
| `careerforce.career_goals.add` | `/careerforce/ajax/career_goals/add/{soc_code}` | CSRF token only (works for anonymous, which uses the cookie). |
| `careerforce.career_goals.remove` | `/careerforce/ajax/career_goals/remove/{soc_code}` | CSRF token only; `soc_code` existence check off. |
| `careerforce.work_experience.remove` | `/careerforce/ajax/work_experience/remove/{soc_code}` | authenticated + CSRF |
| `careerforce.military_work_experience.remove` | `/careerforce/ajax/military_work_experience/remove/{branch}/{moc}` | authenticated + CSRF |

`goalAdd()` returns `AlertCommand` messages for "maximum of N Career Goals" (anonymous: "…careers pending addition to your dashboard"), and "This occupation is already one of your career goals."

### Suggester flow (`/occupations/{suggester_id}`)

1. `OccupationSuggesterProvider::buildSuggestionStep()` loads the user's saved answers for this suggester.
2. If there are none and the suggester is multi-step (Skills Matcher, Interest Profiler), it shows the question form (`buildStep()`).
3. When the questions are complete, or answers were already saved, it builds `OccupationSuggestionForm`: the suggestions as checkboxes, with the current goals pre-checked and a "Current career goals" table.
4. Submit calls `setOccupations()` with the full checked set, so un-checking removes a goal. For signed-in users, our form also invokes `hook_career_goals_update()`.
5. "Reset" (Interest Profiler, Skills Matcher) discards the answers and starts again. The forms support `_drupal_ajax` to run inside a modal.

Per suggester:

| ID | Source of suggestions | Count |
|---|---|---|
| `mn_in_demand` | MN LMI `OccInDemand` for the WPR from `context['wpr']`, else the user's `field_my_region_edr`, else statewide | 20 |
| `skills_matcher` | CareerOneStop **`skillsmatcher`** via datasource `careeronestopjson` (POST `SKAValueList`, sorted by `Rank` DESC). Answers saved. | 50 |
| `interest_profiler` | O*Net Web Services Interest Profiler: answers (1–5 per question) → RIASEC scores → careers. Answers saved. Results template `interest_profiler_results` (theme) with percent match and career clusters (`careerforce_preprocess_interest_profiler_results()`). | default 10 (base) |
| `anon_stored_careers` | The `pending_careers` cookie | all |

### Anonymous → login hand-off

1. `careerforce_user_login()` queues login actions in the session (`UserLoginQueueManager`).
2. `careerforce_preprocess_page()` runs them on the next themed page (skipped on admin routes).
3. `AnonOccupationsLoginAction` resets the `civiserv_jobs.account_goals_data` service and, if the cookie has codes, redirects to `/occupations/anon_stored_careers`.
4. `civiserv_jobs_user_logout()` clears the cookie.

## External services and integrations

- MN LMI `OccInDemand` (In-Demand).
- CareerOneStop `skillsmatcher` (POST JSON) (Skills Matcher).
- O*Net Web Services `mnm/interestprofiler/questions`, `results`, `careers` (Interest Profiler), basic auth from `onet.connection_settings`.
- Occupation titles for goals: O*Net DB (`occupation_desc`).

## Configuration and permissions

- Limits: `civiserv_jobs.max_career_goals` (6), `civiserv_jobs.max_anon_careers` (12), `civiserv_jobs.max_work_experience` (0 = none) in `web/modules/custom/civiserv_jobs/civiserv_jobs.services.yml`. These are code, not config.
- `access civiserv_jobs occupation suggesters`: anonymous + authenticated.
- `access skills experience`: view other users' Goals & Experience pages.
- Suggester plugin config (number of suggestions) is set in each class's `defaultConfiguration()`; there is no admin UI.

## Related

- [explore-careers-and-occupation-pages.md](explore-careers-and-occupation-pages.md)
- [bookmarks-and-saved-searches.md](bookmarks-and-saved-searches.md): goals in "Jobs for me".
- [military-occupation-crosswalk.md](military-occupation-crosswalk.md): military work experience.
- [skills-comparison.md](skills-comparison.md)
- [../job-seeker-tools/](../job-seeker-tools/): dashboard and tool UX.
- [../accounts/](../accounts/): profile types, LoginMN.
