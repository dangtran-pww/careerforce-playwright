# Job search

The public job search at `/job-search`. Anyone can search job postings by keyword, location and distance, filter by company and city, sort the results, and open a single posting. The postings are not stored in Drupal. Every search is a live call to the CareerOneStop (COS) job search API through our `careeronestop` module. Signed-in job seekers also get bookmarks, saved searches and the "Jobs for me" selector on this page; those are covered in [bookmarks-and-saved-searches.md](bookmarks-and-saved-searches.md).

## What users see

| URL / place | What it is |
|---|---|
| `/job-search` | Page Manager page `job_search` (variant `job_search-layout_builder-0`, layout `job_search`). Holds the search form, sort form, filter form, results, the "Jobs for me" block, two custom content blocks ("Job Search - Services", "Job Search - Resources") and a featured-event view block. No access conditions, so it is open to everyone. |
| `/job-search?title=…&location[text]=…&radius=…&sort=…&company=…&loc=…&page=…` | Results. All forms use GET, so the whole search state is in the query string. |
| `/job-search?jvid=<32–40 hex chars>` | Single-posting view: the same results block showing one job with the full HTML description. The "Share" and "Read more" links on each result point here. |
| `/job-search/{jvid}` | JSON only: the raw COS posting for that JVID (route `careerforce.job_post_detail`). Not a themed page. |
| Home page (`/homepage`) and some node pages | The Job Search Form block is also placed in the home page Page Manager variant and inside the `careerforce_skin_careerforceskinsdcjobsearch` block (SDC "Job Search Inner page", shown on `/node/26`, `/node/81`, `/node/55`–`58`, `/node/108632`). |
| Results banner | The heading/body/button panel above the results ("Get matched with the right jobs" → Skills Matcher). Hidden on the single-posting view. |

Each result shows title, company, location, a snippet, a "Posted/Available … ago" label, a "Learn more and apply" link to the external posting (new tab), a Share button that copies the `?jvid=` URL, and a bookmark icon.

## How it works

**One API call per request.** The four blocks each inject `careeronestop.jobsearch`. `JobSearchRequest::doApiCall()` memoizes `$this->results`, so the form, filters, sort and results share one COS call. The filter block reads `getCompanyValues()` / `getLocationValues()` (the COS `Companies` and `Locations` facets) from the same response.

**Forms are GET-only.** Every form sets `setMethod('GET')`, disables form cache and token, and strips `form_id`/`form_build_id`/`form_token` in `#after_build`. `submitForm()` is never called. On submit, `job-search-filter.es6.js` collects the values of every form with `data-form-group="job-search"`, merges them, and sets `window.location`. That is how the keyword search keeps the current filters and sort, and the other way round.

**Building the COS request** (`doApiCall()`):

- Defaults: keyword `0` (all jobs), location `MN`, radius `20`, age `0`, sort `best-match`, page size `10`, max results `500`.
- `title`: if it contains exactly one `(…)` pair holding a valid SOC code (e.g. `Registered Nurses (29-1141.00)`), only the formatted SOC code is sent as the keyword. Career pages and "Jobs for me" links use this format (see `ViewJobsRequest`, `CareerGoalOptions`, `InDemandOptions`).
- `location[text]` goes through `formatLocation()`: US/USA → `United States`; any 5-digit ZIP → the ZIP only; `<city>, <MN|WI|SD|ND|IA or full name>` → `City, ST`, with `St`/`Saint` normalized to `St.`. Anything else is passed through unchanged. A comment says COS returns nothing unless the location is `city, ST`, `ST` or a ZIP.
- `radius` only affects the results when the location is a ZIP (code comment).
- `sort` maps to a sort column and direction via `JobSearchRequest::sortOptions()`: `best-match` (Relevance, `0`/`0`), `date-posted-desc` (`acquisitiondate DESC`), `job-title-asc` (`jobtitle ASC`), `company-asc` (`company ASC`).
- `loc` → `locationFilter`, `company` → `companyName` query args. `enableJobDescriptionSnippet=true`, `showFilters=true` are always sent.
- `CareerOneStopDatasource::buildRequestInfo()` builds the URI as `{version}/jobsearch/{api_user_id}/` followed by the URL-encoded positional params in this order: keyword, location, radius, sort column, sort direction, offset, page size, age. Offset is `pageSize × page`.

```php
$result = $this->datasourceManager->createInstance('careeronestop')
  ->sendRequest('jobsearch', [$keyword, $location, $radius,
    $sort['sort'], $sort['dir'], $offset, $defaults['pageSize'], $age], $query);
```

**Response handling.** The v2 response can be nested, so the code looks for the first array with a `JobCount` key. The total is capped at 500 for paging. The pager is created in `JobSearchResultsBlock` only when there are more than 10 results.

**Single posting (`?jvid=`).** `getJobPost($jvid, TRUE)` calls `jobsearch/{userId}/{jvid}?isHtml=true`. If the snippet is empty, the first 250 characters of the description are used. If COS returns 404, the code falls back to the matching item in the user's `field_bookmarked_jobs` and builds an "Expired" stub (title, company, post date, no apply URL). The template then greys the card out, and the JS blocks re-bookmarking an expired job. The template prints the full description with `|raw` only in single-job mode.

**Per-job links added in PHP.** `bookmarkLink` is a toggle link to `careerforce.job_post.bookmark` for signed-in users, or a modal link to the login prompt for anonymous users. `shareUrl` is an absolute `/job-search?jvid=…` URL. `isSingleJob` is a flag for the template.

**Caching.** `JobSearchRequest` declares max-age 300 s and the cache contexts `user` plus the query args `title, location, loc, radius, age, sort, page, jvid`. All job search blocks merge these. `company` is **not** in the context list, so results filtered by company may be served from a cached page for a different company. The JSON detail route caches for 300 s per route.

**Results banner.** `JobSearchResultsBlock` reads `careerforce_config.job_search` (`heading`, `body`, `button_text`, `button_url`, `published`) and passes it to the template unless it is a single-job view.

**Tracking.** `JobPostSearchFormCareerForce::buildForm()` calls `JobSeekerToolsTracker::attach()`. For a signed-in user, the JS then calls `/careerforce/jobseeker-tools-tracker?active_path=/job-search`, which invokes `hook_job_search_load()`. The route comment in `careerforce.routing.yml` explains why the library must not be attached by hand (see [../platform-and-operations/](../platform-and-operations/)).

## External services and integrations

- **CareerOneStop Web API** (`api.careeronestop.org`). Config object `careeronestop.connection_settings`: `api_base_uri` (scheme + path), `api_user_id`, `api_token`, `job_search_api_version` (sync value `v2`; the class default is `v1`). The token is sent as `Authorization: Bearer`. Endpoints used here: `jobsearch` (list and by-JVID).
- **Google Places** autocomplete for the location field via Mapkit's `mapkit_autocomplete` element (`#handler: gmap_places`, city match type, biased to the Minnesota bounding box, filter pattern for MN/WI/SD/ND/IA). Mapkit is contrib; we only configure the element.

## Configuration and permissions

| Item | Where |
|---|---|
| COS credentials, base URI, job search API version | `/admin/config/services/civiserv-jobs/careeronestop` (`CareeronestopConfigurationForm`, permission `administer site configuration`). Values are currently committed in `config/sync/careeronestop.connection_settings.yml` and in `web/modules/custom/careeronestop/config/install/`. Treat them as secrets. |
| Results banner | `/admin/config/careerforce/job-search`, permission `administer careerforce_config` (roles `content_moderator`, `site_admin` in sync config). |
| Page layout | Page Manager `job_search` at `/admin/structure/page_manager`. The form builds its default action from the route name `page_manager.page_view_job_search_job_search-layout_builder-0` so the path can change; renaming the page or variant breaks those links. |
| Page access | `access content` (detail JSON route); the page itself has no access conditions. |

No config split differences touch job search.

## Related

- [bookmarks-and-saved-searches.md](bookmarks-and-saved-searches.md): bookmark, save search, Jobs for me, anonymous login modal.
- [occupation-data-framework.md](occupation-data-framework.md): the datasource plugins this feature reuses.
- [explore-careers-and-occupation-pages.md](explore-careers-and-occupation-pages.md): the "View job posts" link on career pages.
- [../platform-and-operations/](../platform-and-operations/): job seeker tools tracker, logging.
- [../miscellaneous/theme-overview.md](../miscellaneous/theme-overview.md): `sdc_job_search` component and job search layout.
