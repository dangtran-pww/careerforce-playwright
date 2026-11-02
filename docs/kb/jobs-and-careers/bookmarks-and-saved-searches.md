# Bookmarked jobs, saved searches and "Jobs for me"

Signed-in users can bookmark individual CareerOneStop postings (up to 15) and save a job search URL under a name (up to 5). Both show on the user dashboard with remove links. The "Jobs for me" selector on `/job-search` turns bookmarks, saved searches, career goals and in-demand occupations into one-click searches. Anonymous users who click Bookmark, Save search or "Customize my search" get a modal that sends them to LoginMN and then back to finish the action.

## What users see

| Place | Who | Behaviour |
|---|---|---|
| Bookmark icon on each result at `/job-search` | Signed in | Toggles the bookmark through AJAX. The icon class switches between `bookmark--add` and `bookmark--remove`. |
| Bookmark icon | Anonymous | Opens the modal "Create an account or log in to use this feature" (`/careerforce/forms/job_search_anonymous_modal?action_type=bookmark[<jvid>]`). |
| "Save search" link in the filter panel | Signed in | Modal "Save this search to your dashboard" with a "Name job search" field (`/careerforce/forms/job_search_authenticated_modal`). |
| "Save search" link | Anonymous | Same login modal, with `action_type=save-search`. |
| "Jobs for me" block on `/job-search` | Signed in | Two selects: a group (Bookmarked jobs / Saved searches / Career goals / In demand jobs), then an item. Choosing an item navigates to the search. |
| "Jobs for me" block | Anonymous | Intro text and a "Customize my search" button that opens the login modal. |
| Dashboard `/user/{user}` | Owner | The view `dashboard_jobs` (block `block_dashboard_jobs`) lists saved searches and bookmarked jobs with an "x" remove link each. It is placed in the `default_dashboard` Page Manager variants. |

## How it works

### Data model

- `user.field_bookmarked_jobs` (`careerforce_job_post`, max 15). The title, company and posting date are copied from COS when the bookmark is added, so the dashboard can still list a posting after COS stops returning it.
- `user.field_job_search` (core `link`, max 5). `uri` is `internal:/job-search?<query>` taken from the **HTTP Referer** of the save request; `title` is the name the user typed.

### Bookmark toggle (`GET /careerforce/ajax/job-post/add/{jvid}`)

Route `careerforce.job_post.bookmark`, `_role: authenticated`, `_csrf_token: TRUE`, `jvid` must match `[0-9a-f]{32,40}`. `addBookmark()`:

1. If the JVID is already in the field, it removes it and returns `{title: 'bookmark', class: [bookmark, bookmark--add]}`.
2. Otherwise, if there is room, it fetches the posting from COS (`jobsearch/{user}/{jvid}`), appends `jvid/title/company/post_date`, and returns the "Remove bookmark" state.
3. If the field is full, or anything throws, it returns HTTP **408** with an `error` message. The JS shows it with `alert()`.

The same route is the dashboard "remove" link, because it toggles.

### Saved search

`JobSearchAuthenticatedUserForm::saveSearchSubmit()` parses the Referer, builds `path?query`, and appends `{uri: internal:…, title}`. The AJAX callback closes the modal and sends `RefreshJobsForMeCommand`, which fires the `careerforce.jobsforme` event, and the selector refetches `/careerforce/ajax/jobs-for-me`. If the user already has 5 saved searches, the form shows a warning ("You have already reached the limit for saved jobs."), but the Save button still runs.

Removal: `GET /careerforce/ajax/job-search/remove/{delta}/{hash}` (`_csrf_token` only, no role requirement). `hash` is `md5(title . uri [. query])`, computed in `JobPostController::computeSavedSearchHash()`. The controller searches for the matching item starting at `delta`, so a list changed in another tab still removes the right item.

### "Jobs for me"

`JobsForMeForm` asks `plugin.manager.cf_personal` (from the `cf_personal` submodule) for every plugin with the action `job_search`, ordered by weight:

| Plugin | Label | Options built from |
|---|---|---|
| `careerforce_bookmarked_job` | Bookmarked jobs | `?jvid=<jvid>` per bookmark |
| `careerforce_saved_searches` | Saved searches | stored query + `&delta=<n>` |
| `careerforce_career_goals` | Career goals | `?title=<Occupation title> (<SOC>)` per `field_career_goals` item; titles from `civiserv_jobs.occupation_data->loadOccupationTitleAndDesc()` |
| `careerforce_in_demand_jobs` | In demand jobs | Top 10 from the MN LMI `mn_lmi:occupation_in_demand` request for the user's region (from `field_my_region_edr` → WPR, statewide by default) |

The option values are relative query strings. The JS sets `window.location.href = value` on change, so they resolve against the current page, which is `/job-search`. The block varies by `user` and is tagged `user:<uid>`, so it updates when the account is saved. Block settings: intro text, select label, placeholder, anonymous intro, anonymous button label (schema `block.settings.careerforce_jobs_for_me`).

### Anonymous flow

1. The anonymous user clicks Bookmark, Save search or "Customize my search", which opens `JobSearchAnonymousUserForm` in a modal.
2. The return URL is the Referer (only if `path.validator` accepts it, otherwise `/job-search`), cleaned of `op`/`form_id`/`form_build_id`. `action_type` (`save-search` or `bookmark[<jvid>]`) becomes the URL **fragment**.
3. "Log In or Register" loads the `fam_auth_provider` entity `loginmn` and, if it is enabled, returns its login response with that destination. Otherwise it redirects to `/user/login?destination=…`. "DEED staff and partners log in here." always goes to `/user/login`.
4. Back on `/job-search#save-search` or `#bookmark[<jvid>]`, `job-search-redirect-modal.es6.js` opens the save-search modal or `/careerforce/forms/bookmark-job-form?jvid=…` (`BookmarkJobForm`). That form refetches the posting, checks for duplicates and the limit, saves, and then sends `RefreshJobSearchCommand` (reloads the page without the hash).

## External services and integrations

- CareerOneStop `jobsearch` by JVID, to validate and copy posting details (see [job-search.md](job-search.md)).
- MN LMI `OccInDemand` for the "In demand jobs" group (see [lmi-regions-and-industries.md](lmi-regions-and-industries.md)).
- LoginMN through the `fam_oidc` provider entity `loginmn` (see [../accounts/](../accounts/)).

## Configuration and permissions

- Limits are field-storage cardinalities: bookmarks 15, saved searches 5. Change them in field storage config; the code reads the cardinality at runtime.
- Routes: bookmark toggle, Jobs-for-me JSON, bookmark form and saved-search modal require the `authenticated` role. The anonymous modal needs `access content`. Saved-search removal has only a CSRF token check.
- "Jobs for me" block text is set per placement in the `job_search` Page Manager variant (current label "Search by").

## Related

- [job-search.md](job-search.md)
- [career-goals-and-suggesters.md](career-goals-and-suggesters.md): career goals feed the selector.
- [lmi-regions-and-industries.md](lmi-regions-and-industries.md): My Region and in-demand data.
- [../job-seeker-tools/](../job-seeker-tools/): the dashboard and other job seeker tools.
- [../accounts/](../accounts/): LoginMN / FAM auth.
