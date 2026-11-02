# Explore Careers search and occupation (career) pages

"Explore Careers" lets anyone search O*Net occupations by title, alternate title or keyword, and open a career page with labor market data for Minnesota and its regions: wages, demand, projections, cost of living, education, licensing, certifications, daily work activities and a video. Signed-in users can add the career to their goals. The search runs on the Solr `occupations` index; the career page is a client-side Vue template filled from a JSON endpoint.

## What users see

| URL | What |
|---|---|
| `/explore/careers?otitle=<keywords>` | Search results: view `occupations_search`, display `explore_careers` (search_api, 10 per page, sorted by relevance then title). The `otitle` filter is fulltext. |
| Explore Careers block | `explore-careers` block: one text field and Search button that GETs `/explore/careers?otitle=…`. Placed on the home page (`home_page` Page Manager variant) and through `block.block.explorecareers` on `/node/26`, `/node/81`, `/node/55`–`58`, `/node/20962`. The configurable header is shown with the first word in bold. |
| `/explore/careers/{soc}` | Career page (route `civiserv_jobs.occupation.canonical`, `no_cache`). `{soc}` is any SOC format; links use the 8-digit form, e.g. `/explore/careers/29114100`. Returns 404 if the SOC is not in the O*Net database. |
| `/explore/careers/{soc}/similar-military-careers` | View `similar_military_careers`. The career page links to it only when the occupation has a MOC crosswalk row (see [military-occupation-crosswalk.md](military-occupation-crosswalk.md)). |

Career page sections, from the `default` Occupation Display (`config/sync/civiserv_jobs.occupation_display.default.yml`, layout `occupation_detail_twocol_rows`):

| Row | Left | Right |
|---|---|---|
| 1 | Title ("Occupation") | "View job posts" button |
| 2 | Description, similar military careers link, "Also known as", "Daily Work Activities" | COS video |
| 3 | Region picker map | Demand (projection + demand stars), Wages, Cost of Living |
| 4 | Certification Information | Education, Licensing Information |
| 5 | Add to dashboard / career goals buttons | |

## How it works

### Search

The `occupations` index has two datasources: O*Net SOC items (title, alternate titles, description, industries, SOC code) and MOC items (see the military doc). Title fields are indexed three ways (stemmed text, unstemmed, ngram), with boosts of title 13, MOC 21, MOC title 5 and alternate titles 2. The view filters on datasource and language. Index options: `index_directly: true`, `cron_limit: 50`. Items are tracked from the O*Net DB through `ONetOccupationListProvider::getOccupationCodes()`, paged by `search_api.settings:tracking_page_size`. `include_subcode: 1` means sub-codes like `.03` are indexed too.

### Career page

1. `SocParamConverter` validates and resolves `{soc_code}`. A code missing from O*Net gives a 404.
2. `displayDetails()` returns only an empty container `<div class="occupation-display occupation-display--page" data-soc="…" data-view-mode="page">`, with the libraries attached and cache contexts `route`, `session`, `cookies:pending_careers`.
3. JS fetches `/occupation/template/page` (falls back to the `default` display). The template contains `v-html="<data_name>"` placeholders and the display's CSS.
4. JS fetches `/occupation/{soc}/json`. `OccupationDataCaller::loadOccupation()` runs all configured data requests (see [occupation-data-framework.md](occupation-data-framework.md)), and each data point is rendered server-side to HTML.
5. Region-aware data points (wages, projection/demand, cost of living) come back as `{context: 'wpr', rendered: {<wpr>: html, …}}`. The `edr` data context picks the current WPR, defaulting to statewide `2701000000`. The region picker map and the EDR selector fire `careerforce.update_edr`, and the page swaps HTML without another request.
6. The page title comes from `occupationTitle()`, which loads the full occupation.

### Buttons on the page

- **View job posts**: `ViewJobsRequest` builds `/job-search?title=<Occupation title> (<SOC plaintext>)`. Job search detects the parenthesised SOC and searches by code (see [job-search.md](job-search.md)).
- **Add to dashboard** (`AddToDashboardRequest::buildValue()`):
  - Anonymous: "Add to dashboard" / "Remove from pending 'add to dashboard'" toggles the `pending_careers` cookie.
  - `career_seeker` or `partner` profile type (from `field_extended_profile_type`, default `career_seeker`): "Add to / Remove from career goals".
  - `partner` with `careerforce_profile` enabled: also "Add to / Remove from now hiring".
  - All links are `use-ajax` with a CSRF token in the query. Details in [career-goals-and-suggesters.md](career-goals-and-suggesters.md).

## External services and integrations

- Solr server `occupations` (search_api_solr). Local Lando config mounts `services/solr/occupations`.
- O*Net DB (indexing, title/description).
- CareerOneStop `occupation` (one call per SOC with `alternateOnetTitles`, `dwas`, `tasks`, `video`; location `MN`), `license`, `certificationfinder`.
- DEED MN LMI (`OesOccWages`, `Projections`, `OccDemandIndicator`, `Col`, `MedianEducation`).

## Configuration and permissions

- Career page and search: `access content`.
- Occupation Displays: `/admin/config/services/civiserv-jobs/occupation-display` (`administer site configuration`). Edit regions/labels per display; the add route is commented out.
- Which plugin feeds each section: `/admin/config/services/civiserv-jobs`.
- Index/server: standard search_api admin. Changes to `search_api.index.occupations` need a reindex.

## Related

- [occupation-data-framework.md](occupation-data-framework.md)
- [lmi-regions-and-industries.md](lmi-regions-and-industries.md): what the wage/demand/projection data means.
- [career-goals-and-suggesters.md](career-goals-and-suggesters.md)
- [military-occupation-crosswalk.md](military-occupation-crosswalk.md)
- [job-search.md](job-search.md)
- [../miscellaneous/theme-overview.md](../miscellaneous/theme-overview.md): `block--explore-careers.html.twig`, career page layout CSS.
