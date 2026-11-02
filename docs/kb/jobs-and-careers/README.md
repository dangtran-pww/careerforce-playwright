# Jobs, job search and career data

KB docs for the custom code behind job search, career exploration and labor market data on careerforce.mn.gov. Source: `master` at commit `db37480b7` (2026-10-28).

Modules covered: the job and career parts of `web/modules/custom/careerforce`, `web/modules/custom/careerforce/modules/cf_skills_comparison`, `web/modules/custom/civiserv_jobs` (with `occupation_moc`), `web/modules/custom/careeronestop`, and `web/modules/custom/onet`.

| Doc | What it covers |
|---|---|
| [job-search.md](job-search.md) | `/job-search`: the CareerOneStop job search API, search/filter/sort/results blocks, single-posting view, location parsing, caching. |
| [bookmarks-and-saved-searches.md](bookmarks-and-saved-searches.md) | Bookmarked jobs (max 15), saved searches (max 5), "Jobs for me" selector, anonymous → LoginMN modal flow, dashboard listing. |
| [occupation-data-framework.md](occupation-data-framework.md) | `civiserv_jobs` datasource and data request plugins, the request→plugin map, occupation loading and caching, `/api/occupation/*` endpoints, O*Net DB, credentials config. |
| [explore-careers-and-occupation-pages.md](explore-careers-and-occupation-pages.md) | Explore Careers search (Solr `occupations` index) and career pages `/explore/careers/{soc}` (Vue template + JSON, region switching, "View job posts", "Add to career goals"). |
| [lmi-regions-and-industries.md](lmi-regions-and-industries.md) | DEED MN LMI API plugins, EDR/WPR region model, county lookup table, My Region, `/api/regional-lmi/*`, industry/region pages, Industry Region Map and Featured Careers blocks, per-environment LMI endpoint. |
| [career-goals-and-suggesters.md](career-goals-and-suggesters.md) | Career goals (field + anonymous cookie), My Goals & Experience page, occupation suggesters (In-Demand, Skills Matcher, Interest Profiler, pending careers), login hand-off, SOC conversion queue. |
| [military-occupation-crosswalk.md](military-occupation-crosswalk.md) | `occupation_moc` MOC→SOC tables and CSV imports, military career lookup, military detail pages, similar military careers, military work experience. |
| [skills-comparison.md](skills-comparison.md) | `cf_skills_comparison`: Compare Skills tabs, skills match/gap LMI calls, region resolution, print view. |

## Suspected bugs found while writing these docs

These come from reading the code, not from running the site. Check them before filing.

| Where | Issue | Doc |
|---|---|---|
| `JobPostController::removeSavedSearch()` | The first loop decrements `$delta` but tests `$index`. It looks like an endless loop when the hash at the given delta doesn't match. | [bookmarks-and-saved-searches.md](bookmarks-and-saved-searches.md) |
| `JobSearchAuthenticatedUserForm` | At the 5-search limit it warns but still saves; the 6th item is probably dropped silently. | same |
| `job-search-redirect-modal.es6.js` | Reads `matches[1]` when the regex returned `null`. Likely a console TypeError on every `/job-search` load without a hash. | [job-search.md](job-search.md) |
| `JobSearchRequest` cache contexts | `company` query arg missing from the cache contexts (`loc` is present). | same |
| `RegionalLmiDataController` | Uses `$this->loggerFactory`, which is never set, in its catch blocks. Errors may become 500s. | [lmi-regions-and-industries.md](lmi-regions-and-industries.md) |
| `IndustryRegionAliasType` | Bulk update/delete query the removed `url_alias` table. | same |
| `InDemandOptions` / `JobsForMeForm` | An LMI HTTP failure is not caught. | [bookmarks-and-saved-searches.md](bookmarks-and-saved-searches.md) |
| `JobSeekerToolsTracker` + skills comparison | The tracker key `/occupations/compare-skills` never matches the real tab URLs. | [skills-comparison.md](skills-comparison.md) |
| `ExcerptHighlight` search_api processor | No plugin annotation, so it is never registered. | [explore-careers-and-occupation-pages.md](explore-careers-and-occupation-pages.md) |

## Related folders

[../job-seeker-tools/](../job-seeker-tools/) · [../accounts/](../accounts/) · [../locations/](../locations/) · [../platform-and-operations/](../platform-and-operations/) · [../content-authoring/](../content-authoring/) · [../miscellaneous/theme-overview.md](../miscellaneous/theme-overview.md) · [../events/](../events/) · [../appointments/](../appointments/) · [../services/](../services/)
