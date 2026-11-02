# Skills Comparison (transferable skills)

The "Compare Skills" tool takes a user's current or past occupation (and optionally a location) and shows how their skills transfer. It has three tabs: in-demand careers in their region, best skill matches, or one chosen career of interest. For a chosen pair it shows a percent match, the skills to develop, and wages, cost of living, demand and education for the target career, with a printable version. All skill data comes from the DEED MN LMI API (SHINE-based skills match and skills gap). Provided by the `cf_skills_comparison` submodule of `careerforce`.

## What users see

| URL | What |
|---|---|
| `/occupations/compare-skills/in-demand` (default) | Tab "In-Demand Careers": in-demand occupations ranked by skill match against "Your Experience". |
| `/occupations/compare-skills/skill-matches` | Tab "Best Skill Matches": closest occupations by skills (SHINE). |
| `/occupations/compare-skills/career-interest` | Tab "Career of Interest": one-to-one comparison with a second occupation field. |
| `/occupations/compare-skills/<anything else>` | Redirects to the first tab by weight (`in-demand`). |
| `/print-compare-skills/{soc_code_1}/{soc_code_2}?wpr=…&location[text]=…` | Printable comparison (intro, your experience, location, target career with demand, percent match, wages, cost of living, education, skills gap). |

Form fields: "Your Experience" (occupation autocomplete from `/occupation/autocomplete/soc`), "Your Location" (Mapkit/Google Places city autocomplete, pre-filled from the user's My Region), the "Compare Skills" AJAX button, and "Career of Interest" on the third tab. Access is `access content`, so anonymous users can use it.

## How it works

1. `index($type)` builds all comparison plugins and marks the one whose `type` matches the URL as active. It renders `TransferrableSkillsForm` plus one results container per plugin (`data-plugin-skills-comparison-results=<plugin id>`). Only the active one is filled server-side.
2. **Region**: `getLookupWpr($location)` uses, in order:
   1. the county and state from the Places result (`administrative_area_level_2/1`) → EDR → WPR;
   2. for signed-in users, a server-side geocode of the typed text (`careerforce.geocoder_lookup`);
   3. for signed-in users, `field_my_region_edr` or `field_my_region_county`;
   4. otherwise statewide.
3. **Per tab**:
   - *In-Demand*: `civiserv_jobs.skills_match_in_demand` plugin (`mn_lmi:skills_match_in_demand`) with `soc` + `wpr`.
   - *Best Skill Matches*: the `skills_match` request from `civiserv_jobs.data_requests` (`mn_lmi:skills_match`).
   - *Career of Interest*: `buildSkillsGap(soc, to_soc)`.
4. **`buildSkillsGap()`**: gets the percent match from `SkillsMatchOneToOne` (`round(shine)`). The skills gap (`SkillsGap`, args `OccCodeInput`/`OccCodeOutput`) is fetched **only if the match is above 0**. It adds demand stars from the `demand` request for the WPR.
5. **Print**: loads the full target occupation (`loadOccupation`) for demand, wages, cost of living and education rendered for the WPR, plus the one-to-one match and the skills gap in `print` view mode.

Which plugins are used is set in the Data Requests admin (`civiserv_jobs.skills_gap`, `civiserv_jobs.skills_match_one_to_one`, `civiserv_jobs.skills_match_in_demand`, and `skills_match` in `civiserv_jobs.data_requests`).

## External services and integrations

DEED MN LMI `CFLmiApi`: `SkillsMatch`, `SkillsMatchInDemand`, `SkillsMatchOneToOne`, `SkillsGap`, plus `OccDemandIndicator`, `OesOccWages`, `Col`, `MedianEducation` on print. Google Places / Geocoder for location. Endpoint per environment: see [lmi-regions-and-industries.md](lmi-regions-and-industries.md).

## Configuration and permissions

- Routes: `access content`.
- Plugin selection: `/admin/config/services/civiserv-jobs` (`administer site configuration`).
- Module dependencies: `careerforce`, `cf_printable`, `mapkit`.

## Related

- [lmi-regions-and-industries.md](lmi-regions-and-industries.md)
- [occupation-data-framework.md](occupation-data-framework.md)
- [career-goals-and-suggesters.md](career-goals-and-suggesters.md)
- [../job-seeker-tools/](../job-seeker-tools/)
