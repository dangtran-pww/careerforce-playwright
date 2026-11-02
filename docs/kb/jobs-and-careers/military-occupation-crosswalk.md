# Military occupation (MOC) crosswalk

Veterans and service members can look up their military job (MOC/MOS code or title, by branch) and see matching civilian occupations. Career pages link to "similar military careers", and job seekers can record military jobs as work experience. The data comes from our own MOC→SOC tables (filled by CSV imports in the `occupation_moc` submodule of `civiserv_jobs`) and from the O*Net Web Services `veterans/military` API. Both are indexed into the same Solr `occupations` index as civilian careers.

## What users see

| Place | What |
|---|---|
| "Military Career Lookup" block (`military_career_lookup_block`) | Branch select + "Enter a military job title or occupation code". Placed on `/veterans-resources`, `/veterans-employer-resources`, `/MilitarySkillsTranslator` (`block.block.militarycareerlookup`) and on `/user/*/labor-market` (`block.block.careerforce_skin_militarycareerlookup`). The block plugin lives in `careerforce_profile`; the form is ours. |
| `/occupation/moc-lookup/results?moc=…&branch=…` | AJAX results: MOC title, code, branch, personnel category (Enlisted / Commissioned Officer / Warrant Officer) and a "Careers in the Military" link when known. 5 per page with an AJAX pager. |
| `/military-occupation/{branch}/{moc}` (and `/json`) | One military occupation with up to 7 related civilian careers, each with a "Learn more" link to the career page. |
| `/explore/careers/{soc}/similar-military-careers` | View `similar_military_careers`: MOCs whose crosswalk contains the SOC. The career page shows the link only when a crosswalk row exists. |
| "Search Careers by Military Experience" (`/careerforce/forms/military_occupation`, also used inside My Goals & Experience) | Adds a MOC as military work experience (`field_work_experience`), then redirects to `/user/{uid}/skills-experience`. Authenticated only. |
| `/admin/config/services/civiserv-jobs/occupation_moc` ("MOC Import" tab) | Upload CSV crosswalk files. `administer site configuration`. |
| `/admin/moc-search` (+ `/admin/moc-search/csv`) | Admin view `moc_search` over the index, with a CSV export. Roles: `content_moderator`, `contributor`, `site_admin`, `system_admin`. |

## How it works

### Import

`CrosswalkImportForm::getBatchObject()` chooses the batch by file name (`.csv` only):

| File name pattern | Batch | Effect |
|---|---|---|
| `milx<digits>.csv` | `CrosswalkImport` | **Truncates both tables**, then imports `SVC, MOC, STATUS, EDATE, MOC_TITLE, MPC, ONET1..4, ONET1..4_TITLE`. Obsolete rows are handled in a second pass. Takes the persistent lock `occupation_moc_crosswalk_import` for up to 1 h. |
| `vow<digits>.csv` | `VowImport` | Adds or updates (merge) VOW data: Service, MOC, MOC Title, MOC Personnel Category, O*NET Code/Title, MOC Description, Minimum Pay Grade. |
| `army_ksa*.csv` | `ArmyKsaCrosswalkImport` | Army MOS → O*NET-SOC. |
| `<source>_supplemental_data.csv` | `MocAdditionalDataImport` with `setSocSource(<source>)` | Supplemental MOC → SOC rows, tagged with the source. |
| anything else | `MocAdditionalDataImport` | Generic supplemental format (`SVC, Code, Title, MPC, O*NET-SOC Code, O*NET-SOC Title`). |

The last import date is kept in state `occupation_moc.import_date` and shown on the form.

### Branches

`MocSvcMapper` maps service codes to branches: `A,J,Q` army; `F,X,Y,Z` air_force; `N,P,S,V` navy; `M` marine_corps; `C` coast_guard; `D` dod; `G,K` other. The lookup only searches Army, Air Force, Navy, Marine Corps and Coast Guard (`svc IN (A,F,N,M,C)` without a branch, or the branch's codes with one).

### Lookup and details

- `MocLookupController::doSearch()` runs a search_api query on the `occupations` index: datasource `occupation_moc`, fulltext over `moc`, `moc_title`, `moc_title_partial`, sorted by `edate` DESC then relevance.
- For each result without a `citm_uri`, it calls `loadMilitary()` to find a `careersinthemilitary.com` link in O*Net's `external_info`. It writes the result back to `occupation_moc.citm_uri` (`'0'` when none), so each MOC triggers at most one O*Net call.
- `loadMilitary()` calls O*Net `veterans/military` first. It falls back to the local tables (first matching MOC for the branch's service codes, up to 7 related SOCs from `occupation_moc_soc`). The result is cached in `civiserv_jobs_occupations` (`moc::<code>`) for 3 days.
- The similar-careers view filters the index on the `crosswalk` field (related SOCs) using the `%soc` path argument.

## External services and integrations

- O*Net Web Services `veterans/military` (basic auth, `onet.connection_settings`).
- careersinthemilitary.com: only stored as an outbound link.
- Solr `occupations` index (shared with Explore Careers).

## Configuration and permissions

- Import: `administer site configuration`, admin theme (`_use_admin: TRUE`).
- Lookup results, autocomplete, military details: `access content`.
- Military work experience form: `_role: authenticated`.
- After an import, reindex `occupations` so the lookup and similar-careers view see the new rows (`index_directly` only covers entity saves, and these are table writes; inferred).

## Related

- [occupation-data-framework.md](occupation-data-framework.md)
- [explore-careers-and-occupation-pages.md](explore-careers-and-occupation-pages.md)
- [career-goals-and-suggesters.md](career-goals-and-suggesters.md): work experience on My Goals & Experience.
- [../job-seeker-tools/](../job-seeker-tools/): My Labor Market page and Military Career Lookup block placement.
