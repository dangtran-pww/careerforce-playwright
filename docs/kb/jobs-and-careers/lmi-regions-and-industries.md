# Labor market data (MN LMI), regions and industry pages

CareerForce shows Minnesota labor market information (LMI) from the DEED `CFLmiApi`: wages, demand, job projections, cost of living, typical education, in-demand occupations, and regional economic indicators. Data is shown statewide or for one of six WIOA planning regions (WPR). Users map to a region through the county of their "My Region" setting. This doc covers the LMI integration, the region model and region selector, and the industry/region pages with their map and featured careers.

## What users see

| Place | What |
|---|---|
| Career pages `/explore/careers/{soc}` | Wages, Demand (stars), Projections, Cost of Living, Education. The region picker switches between statewide and the 6 regions. See [explore-careers-and-occupation-pages.md](explore-careers-and-occupation-pages.md). |
| "My Region" block on the dashboard (`/user/{user}`) | Shows the saved location (city, state, ZIP) or "Statewide". The form "Find your Economic Development Region" geocodes a city/ZIP to a county and saves county, EDR and address on the user. Placed in the `default_dashboard` Page Manager variants. Also available as a page at `/careerforce/forms/my_region_form` (authenticated). |
| "In demand jobs" (Jobs for me), In-Demand Careers suggester, skills comparison | Use the in-demand list for the user's region. |
| Industry term page `/taxonomy/term/{tid}` (industry vocabulary) | Layout Builder full display with the **Industry Region Map** block and the **Featured Careers** block. |
| Industry + region page `/taxonomy/term/{industry}/{region}`, aliased `/industry/<industry-name>/<region-name>` | Same industry display; the map highlights the region from the URL. |
| `/user/{user}/labor-market` ("My Labor Market") | Uses the regional LMI plugins below. It is owned by `careerforce_profile`; see [../job-seeker-tools/](../job-seeker-tools/). |
| `/api/regional-lmi/{api_name}?wpr=…|edr=…[&_format=json]` | Public JSON/HTML for the regional plugins (`current_employment`, `unemployment`, `quarterly_census_employment_wages`). |

## How it works

### LMI requests

| Plugin | Request name | LMI API | Returns (per WPR) |
|---|---|---|---|
| `mn_lmi:hourly_wage` | `hourly-wage` | `OesOccWages` | location, year, period, employment count, 25th/75th percentile. Also US rows. If a crosswalk returns several SOCs, it keeps the row with the higher employment count per region. |
| `mn_lmi:projection` | `projection` | `Projections` | openings, % change per period. Its `build()` also embeds the `demand` stars, so one "Demand" section shows both. |
| `mn_lmi:demand` | `demand` | `OccDemandIndicator` | rank, `StarsIndicator` |
| `mn_lmi:living_cost` | `living-cost` | `Col` | cost of living |
| `mn_lmi:typical_edu` | `typical_edu` | `MedianEducation` | typical education |
| `mn_lmi:education_level` | `education-level` | `PctEduByLevel` | % by education level (not in the active request map) |
| `mn_lmi:occupation_in_demand` | `occupations-in-demand` | `OccInDemand` | list of in-demand occupations (title + SOC) for a WPR |
| `mn_lmi:skills_match` | `skills_match` | `SkillsMatch` | related occupations by SHINE score |
| `mn_lmi:current_employment` | `current_employment` | `Ces` | regional (no SOC) |
| `mn_lmi:unemployment` | `unemployment` | `Laus` | labor force, unemployment rate, year-ago rate; accepts `wpr` or `edr` |
| `mn_lmi:quarterly_census_employment_wages` | `quarterly_census_employment_wages` | `Qcew` | regional (no SOC) |

Area codes from the API are turned into WPR codes: `AreaCode == '000000'` → `2701000000` (statewide), otherwise `2709` + `AreaCode`. Several plugins apply a crosswalk trait first, mainly `MnLmi2018To2019EstimateNewTrait`, which maps 2018 SOCs with no OES data to the 2019 estimate code. `MnLmiDataRequest::formatParams()` sends only the first code of a multi-code crosswalk; `HourlyWageDataRequest` queries them all.

### Region model

- **EDR** (Economic Development Region, 13 codes `2708R01000`…`2708R11000`, incl. 6E/6W/7E/7W) maps to **WPR** (WIOA planning region, 6 codes: Northwest `2709NW0000`, Northeast `2709NE0000`, Central `2709CENT00`, Metro `2709TC0000`, Southwest `2709SW0000`, Southeast `2709SE0000`). Statewide is `2701000000`, nationwide `0000000000`. The map is `Edr::getEdrToWprMap()`.
- County → EDR uses the table `careerforce_edr_counties` (`administrative_area` default `MN`, `county`, `edr`). `Edr::getEdr()` strips "County" and normalizes `St.`/`Ste.` to `Saint`/`Sainte`. An empty county gives statewide.
- The table is filled by the "Rebuild Counties Lookup Table" batch, which deletes all rows and then calls LMI `EdrCounties` for each EDR.
- User fields written by `MyRegionForm::submitForm()`: `field_my_region_county`, `field_my_region_edr`, `field_my_region_address` (country US, state, city, ZIP). Clearing the county sets the EDR back to NULL (statewide).

### Industry pages

- Vocabularies `industry` and `region`. Region terms carry `field_associated_wpr` (list of the 6 WPRs + statewide) and `field_map_code`.
- `/taxonomy/term/{industry}/{taxonomy_term}` is a custom route. The second parameter is named `taxonomy_term` on purpose: `IndustryRegionMapBlock::create()` maps its `region` context to `@taxonomy_term.taxonomy_term_route_context:taxonomy_term`, so the region comes from the URL. The `industry` context comes from Layout Builder (the block sits in `core.entity_view_display.taxonomy_term.industry.full`).
- The map lists every `region` term, sorted in WPR order. With an industry context it links to `/taxonomy/term/{industry}/{region}`. Helper text supports the `@industry` and `@region` placeholders; `@region` is always replaced with an empty string in code. When the page has an `article_content` view, `industry-page.es6.js` handles region link clicks itself: it highlights the region, `pushState`s the region URL, and refreshes that view by AJAX with the industry/region args (no full page load).
- Aliases: the pathauto pattern `industry_region` (`/industry/[term:name]/[term:name]`). Our alias type builds `/industry/<industry>/<region>` itself (fake tokens, see the code comment). On every industry or region term save, `careerforce_taxonomy_term_update()` rebuilds aliases for all industry×region pairs.
- **Featured Careers**: `careerforce_config.featured_careers_by_industry` maps an industry **term ID** to a list of 8-digit SOCs (edited at `/admin/config/careerforce/featured-careers-by-industry`, SOC autocomplete). The block shows a career only if it has a title **and** a COS video. On an industry page it shows that industry only; elsewhere it shows all industries. It renders nothing if no career qualifies.

## External services and integrations

- **DEED LMI API** `CFLmiApi` (`careerforce.data_api:lmi_endpoint`):
  - `config/sync`: `apps.deed.state.mn.us/CFLmiApi`.
  - `config/lowhost` (non-prod AWS, enabled in `settings.aws.php` when `AWS_ENVIRONMENT` ≠ `prod`) and the `config/develop` patch: `apps2qa.deed.state.mn.us/CFLmiApi`.
  - On prod, `settings.aws.php` also hard-sets the prod endpoint in `$config`.
- **Google Places** (EDR selector and Mapkit autocomplete) and **Geocoder** providers (`geocoder_provider` entities) for server-side county lookup.

## Configuration and permissions

| Setting | Where | Permission |
|---|---|---|
| LMI endpoint, counties rebuild | `/admin/config/services/civiserv-jobs/lmi-data` | `administer site configuration` |
| Featured careers per industry | `/admin/config/careerforce/featured-careers-by-industry` | `administer featured industry careers` (`content_moderator`, `site_admin`) |
| Industry Region Map block settings | Layout Builder on the industry display: helper text, region code field (list fields on `region`) | — |
| `/api/regional-lmi/*` | — | `access civiserv_jobs data api calls` (anonymous + authenticated) |
| My Region form route | `/careerforce/forms/my_region_form` | `_role: authenticated` |

## Related

- [occupation-data-framework.md](occupation-data-framework.md)
- [explore-careers-and-occupation-pages.md](explore-careers-and-occupation-pages.md)
- [career-goals-and-suggesters.md](career-goals-and-suggesters.md): In-Demand suggester.
- [skills-comparison.md](skills-comparison.md)
- [../job-seeker-tools/](../job-seeker-tools/): My Labor Market page, dashboard.
- [../content-authoring/](../content-authoring/): industry term content and Layout Builder.
