# Job seeker tools tracker (usage statistics)

CareerForce counts when logged-in users open the job seeker tools: job search, Skills Matcher, Interest Profiler, Compare Skills and the Employment Readiness Assessment. It also counts when career goals change. Each event is a module hook (`*_load`, `career_goals_update`), and the stenographer recorder `job_seeker_tools` stores it as a statistic. Some events fire server-side when the tool form is built. Others go through a small JS beacon (`JobSeekerToolsTracker`) that calls a tracking route after the page loads. Users see nothing.

## What users see
Nothing. On tool pages a logged-in browser makes one background `GET /careerforce/jobseeker-tools-tracker?active_path=<path>` that returns `[]`.

## How it works
1. A tool form calls `JobSeekerToolsTracker::attach($build)`. This adds the library and sets `canAccess` from `accessManager()->checkNamedRoute('careerforce.jobseeker_tools_tracker')`, and adds that access result's cache metadata to the build so the flag varies per user.
2. The JS returns early unless `canAccess` is true. Anonymous users therefore never call the route. That prevents the r4032login "Please create an account or log in" message that used to leak onto the next page (MNDEED-9618, per the library comment). Pushing the library by hand leaves the flag unset, so the beacon does nothing ("fail closed").
3. `trackToolVisit()` looks up the **exact** `active_path` in this map and invokes the hook if found:

   | Path | Hook |
   |---|---|
   | `/occupations/compare-skills` | `compare_skills_load` |
   | `/job-search` | `job_search_load` |
   | `/occupations/interest_profiler` | `interest_profiler_load` |
   | `/occupations/skills_matcher` | `skills_matcher_load` |
   | `/employment-readiness/take` | `employment_readiness_load` (marked `// not working` in the code) |

4. Separately, several forms invoke their hook directly in `buildForm()` for authenticated users:
   - `InterestProfilerStepOneForm` → `interest_profiler_load`
   - `SkillsMatcherStepOneForm` → `skills_matcher_load`
   - `TransferrableSkillsForm` → `compare_skills_load`
   - `EmploymentReadinessAssessment::buildQuiz()` → `employment_readiness_load`

   `career_goals_update` is invoked from `CareerSearchAutocompleteForm`, `OccupationSuggestionForm` and `civiserv_jobs` `FieldAccountOccupationData::removeOccupation()`.

## External services and integrations
- Stenographer storage `@default` (environment-specific; see `../platform-and-operations/`).

## Configuration and permissions
- No settings. Route access is "logged in".
- To track a new tool: add its path → hook to `$pathHookMap`, add the hook to `job_seeker_tools.trigger.hook` in `careerforce.stenographer.yml`, and call `JobSeekerToolsTracker::attach()` from the tool's render array.

## Related
- [employment-readiness-assessment.md](employment-readiness-assessment.md)
- [goals-and-experience.md](goals-and-experience.md)
- `../jobs-and-careers/` (the tools themselves)
- `../platform-and-operations/` (stenographer)
