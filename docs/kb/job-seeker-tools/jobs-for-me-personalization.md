# "Jobs for me" personalization (cf_personal)

On the job search page, logged-in users get a "Jobs for me" selector. They pick a category (bookmarked jobs, saved searches, career goals, in-demand jobs), then an item, and the page reloads with that search applied. Each category is a `CfPersonal` plugin. The `cf_personal` module provides the plugin type, and the four plugins live in the main `careerforce` module. The search page itself is covered in `../jobs-and-careers/`.

## What users see
- Block **"Jobs for me search"** (`careerforce_jobs_for_me`), placed on the page_manager `job_search` page (`/job-search`).
  - **Logged in:** optional intro text, then two selects added by JS. The first is labelled "Jobs for me" (category); the second lists that category's items with the placeholder "Select <category>". Choosing an item navigates to the item's URL.
  - **Anonymous:** intro text and a "Customize my search" button that opens `careerforce.job_search_anonymous_user_form` in a modal.
- Category icons come from each plugin's `icon` (`job-bookmark`, `saved-search`, `career-goal`, `in-demand`).

## How it works
1. The block builds `JobsForMeForm` for the current user.
2. The form calls `getByAction('job_search')` and asks each plugin for its options. A plugin with no options is skipped, and a plugin that throws `PluginException` is ignored.
3. Option values are relative query strings (`?jvid=…`, `?title=…`). The JS sets `window.location.href = select.value`, so the query is applied to the **current page** (`/job-search`).
4. When the user saves a search, the server sends `refreshJobsForMe`. The JS then fetches `/careerforce/ajax/jobs-for-me` and rebuilds both selects.

To add a category, add a class in any module's `src/Plugin/CfPersonal/` with `#[CfPersonalAttribute(id: …, label: …, actions: ['job_search'], icon: …, weight: …)]` that implements `PersonalInterface`.

## External services and integrations
- In-demand jobs: the `mn_lmi:occupation_in_demand` data request through `plugin.manager.civiserv_jobs.data_request` / `.datasource` (DEED LMI). See `../jobs-and-careers/`.

## Configuration and permissions
- Block settings (in the page_manager variant): `intro`, `select_label` (default "Search by my"), `placeholder` (default "Saved jobs"), `anonymous_intro`, `anonymous_text`.
- No permissions of its own. Data comes from the current user's fields.

## Related
- [goals-and-experience.md](goals-and-experience.md) (career goals)
- `../jobs-and-careers/` (job search page, bookmarks, saved searches, LMI)
