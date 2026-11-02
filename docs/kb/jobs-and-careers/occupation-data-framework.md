# Occupation data framework (civiserv_jobs, onet, careeronestop)

The backend that every career feature uses. `civiserv_jobs` defines plugin types for datasources (where data comes from) and data requests (one data point, such as wages or licensing, for one occupation code). It also provides the `Occupation` value object, a caching loader, SOC/MOC code utilities, and public JSON endpoints. The `onet`, `careeronestop` and `careerforce` modules supply the actual datasources and requests. Mostly developer-facing; QA sees it through the career pages and the `/api/...` endpoints.

## What users see

No page of its own. Routes it serves:

| Path | Purpose | Access |
|---|---|---|
| `/api/occupation/{request_name}?soc=…[&wpr=…][&_format=json]` | Runs one configured data request (`request_name` is a key in `civiserv_jobs.data_requests`, e.g. `hourly-wage`, `projection`) and returns JSON or rendered HTML. | `access civiserv_jobs data api calls` (anonymous + authenticated in sync config) |
| `/api/occupation-data/skills-gap?soc=…&to_soc=…[&_format=json]` | Skills gap between two occupations (plugin from `civiserv_jobs.skills_gap`). | same |
| `/occupation/{soc_code}/json` | All configured data points for one occupation, rendered per data point; the career page JS uses it. | `access content` |
| `/occupation/template/{view_mode}` | Rendered Vue template + CSS for an Occupation Display. | `access content` |
| `/occupation/autocomplete/soc` | Occupation title autocomplete (Solr, `solr_autocomplete` plugin). | `access content` |
| `/careeronestop_occupation_autocomplete/{limit}/{filter}` | Occupation autocomplete straight from COS. | `access content` |
| `/onet/military_autocomplete/{filter}/{limit}` | Military occupation autocomplete from O*Net Web Services. | `access content` |
| `/admin/config/services/civiserv-jobs` | "Data Requests" admin: which plugin serves each request name, skills-gap/match plugins, "Reset Occupation Data Cache". | `administer site configuration` |
| `/admin/config/services/civiserv-jobs/occupation-display` | Occupation Display config entities (layouts for career pages). Adding new displays is disabled in routing. | `administer site configuration` |
| `/admin/config/services/civiserv-jobs/careeronestop`, `/onet`, `/lmi-data`, `/occupation_moc` | Tabs for COS, O*Net, MN LMI and MOC import settings. | `administer site configuration` |

## How it works

### Datasources

| ID | Module | Backend | Notes |
|---|---|---|---|
| `onet_db` | civiserv_jobs | Local MySQL DB `onet` | Throws `InvalidDatasourceException` if the connection is missing. |
| `onet_web_services` | onet | `services.onetcenter.org/ws/` | Basic auth (`api_username`, `api_password`). Rejects a base URI path that contains `://`. |
| `careeronestop` | careeronestop | `api.careeronestop.org` | Bearer token. `{version}/{api}/{api_user_id}/{params…}`; `jobsearch` uses `job_search_api_version`, everything else `v1`. COS 404 is "no data" and is not logged. |
| `careeronestopjson` | careeronestop | same | POST, query array sent as a JSON body (Skills Matcher). |
| `mn_lmi` | careerforce | DEED `CFLmiApi` (`careerforce.data_api:lmi_endpoint`) | DEED returns HTTP 200 with `Status`/`Message` in the body; `handleResponse()` turns a non-200 `Status` into an exception. |
| `careerforce_mock` | careerforce | none | Empty class. Requests such as `view_job_posts`, `region_picker_map`, `similar_military_careers`, `dashboard_add` compute their own data. |

All HTTP datasources use a 10 s timeout and `verify => FALSE` (from `HttpRequestDatasourceBase::getRequestOptions()`).

### Request name → plugin map

`config/sync/civiserv_jobs.data_requests.yml` decides which plugin serves each data point. It is edited in the Data Requests admin form.

| Name | Plugin | Source |
|---|---|---|
| `occupation_desc` | `onet:occupation_desc` | O*Net DB |
| `occupation_licensing` | `careeronestop:occupation_licensing` | COS `license` (state `MN`) |
| `occupation_dwas` | `careeronestop:occupation_dwas` | COS `occupation` |
| `occupation_video` | `careeronestop:occupation_video` | COS `occupation` |
| `occupation_certifications` | `careeronestop:occupation_certifications` | COS `certificationfinder` |
| `typical_edu` | `mn_lmi:typical_edu` | LMI `MedianEducation` |
| `skills_match` | `mn_lmi:skills_match` | LMI `SkillsMatch` (SHINE) |
| `hourly-wage` | `mn_lmi:hourly_wage` | LMI `OesOccWages` |
| `demand` | `mn_lmi:demand` | LMI `OccDemandIndicator` |
| `projection` | `mn_lmi:projection` | LMI `Projections` |
| `living-cost` | `mn_lmi:living_cost` | LMI `Col` |
| `region_picker_map`, `similar_military_careers`, `view_job_posts`, `dashboard_add` | `careerforce_mock:*` | local |

Separate one-plugin settings: `civiserv_jobs.skills_gap` → `mn_lmi:skills_gap`, `civiserv_jobs.skills_match_one_to_one` → `mn_lmi:skills_gap_one_to_one`, `civiserv_jobs.skills_match_in_demand` → `mn_lmi:skills_match_in_demand`.

### Loading an occupation

`OccupationDataCaller::loadOccupation(SocCode)`:

1. Static per-request cache, then the cache bin `civiserv_jobs_occupations` (cid `occupation:<soc>`).
2. Takes the persistent lock `civiserv_jobs_occupation:<soc>`. It retries about 20 times with `lock->wait($lockId, 200)` between attempts, then carries on without the lock. This stops concurrent requests from calling the APIs twice for the same code.
3. Runs **every** active data request. Plugins that implement `DataAsyncRequestInterface` (all `MnLmiDataRequest` subclasses) run in parallel through Guzzle promises; the rest run synchronously.
4. If `occupation_desc` failed, the occupation counts as not found (returns NULL).
5. Builds `new Occupation($soc, $data, $hasErrors)`. It is cached for **3 days** (`259200` s) **only if no async request failed**. Partial results are served but not cached, and `/occupation/{soc}/json` then sends max-age 0.

`loadOccupationTitleAndDesc()` runs only `occupation_desc`. The param converter uses it to check that a code exists. It reads the cache bin but never writes to it (static cache only).

`careeronestop` occupation requests have a second cache: `OccupationDataRequestBase` stores the whole COS `occupation` response per code in the bin `careeronestop_occupations` with **no expiry**, behind its own lock `CareerOneStop:<soc>`.

### Rendering

`Occupation::build($name, $context)` passes `$context['occupation'] = $this` to the request plugin's `build()`. Regional plugins (`MnLmiRegionalDataRequest`) implement `formatData()` to pre-render a version for statewide and every WPR region: `{context: 'wpr', render: {<wpr>: html}}`. The front end then switches region without another request. `OccupationDetailsController::fetchJson()` outputs these structures.

Occupation Displays (`civiserv_jobs_occupation_display`) map data request names to layout regions with labels. `buildTemplate()` outputs Vue placeholders (`v-html="<name>"`), which `civiserv_jobs/occupation-displays` (Vue 2.6) fills from the JSON endpoint. Displays in sync: `default`, `summary`, `employer_summary`, `work_experience`.

### Code types

`occupation_code` fields (for example `field_career_goals`, `field_work_experience`) store a `type` (`soc`/`moc`), `code` and `branch`. `civiserv_jobs.install` updates 8102–8104 migrated older `_soc` columns to this shape. `careerforce_update_8109` queues every user into `careerforce_user_saved_soc_converter` (cron, 15 s) to convert stored SOC 2010 codes with `Onet2010ToOnet2019Trait`.

## External services and integrations

| Service | Config object | Keys (names only) |
|---|---|---|
| O*Net Web Services | `onet.connection_settings` | `api_base_uri`, `api_username`, `api_password` |
| CareerOneStop | `careeronestop.connection_settings` | `api_base_uri`, `api_user_id`, `api_token`, `job_search_api_version` |
| DEED MN LMI (`CFLmiApi`) | `careerforce.data_api` | `lmi_endpoint` (scheme + path) |
| O*Net database | `settings.php` `$databases['onet']['default']`; on AWS it comes from SSM parameter `…/db/onet/endpoint` (`web/sites/default/settings.aws.php`) | — |
| Solr | search_api server `occupations` | see [explore-careers-and-occupation-pages.md](explore-careers-and-occupation-pages.md) |

The O*Net and COS credential values are committed in `config/sync` (and COS also in `web/modules/custom/careeronestop/config/install/`). Do not copy them into tests or docs.

## Configuration and permissions

- `access civiserv_jobs data api calls`: anonymous and authenticated. The `/api/occupation/*` endpoints are public by design.
- `access civiserv_jobs occupation suggesters`: anonymous and authenticated.
- All admin forms: `administer site configuration`.
- `civiserv_jobs.settings:include_subcodes: true`: include O*Net sub-codes (e.g. `47-1011.03`) in search.
- Container parameters (`civiserv_jobs.services.yml`): `civiserv_jobs.max_career_goals: 6`, `civiserv_jobs.max_anon_careers: 12`, `civiserv_jobs.max_work_experience: 0` (0 means no limit).
- Config split: only `careerforce.data_api` differs (see [lmi-regions-and-industries.md](lmi-regions-and-industries.md)).

## Related

- [explore-careers-and-occupation-pages.md](explore-careers-and-occupation-pages.md)
- [lmi-regions-and-industries.md](lmi-regions-and-industries.md)
- [military-occupation-crosswalk.md](military-occupation-crosswalk.md)
- [career-goals-and-suggesters.md](career-goals-and-suggesters.md)
- [../platform-and-operations/](../platform-and-operations/): settings files, Solr hosting, AWS SSM.
