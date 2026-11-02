# CareerForce Skin theme: overview and structure

Source: `master` export, commit `db37480b7` (2026-10-28). All paths are relative to the repository root.

## Summary

`careerforce_skin` is the site's default front-end theme (`config/sync/system.theme.yml`: `default: careerforce_skin`, `admin: claro`). It is a self-contained custom theme. It does **not** inherit from a CiviServ theme at runtime, even though its description says so. It adds:

- 20 regions and a page template with separate desktop and mobile headers.
- Thirteen Layout Builder / Panels layouts (`careerforce_skin.layouts.yml`).
- Global CSS from two pipelines: Sass (`components/`), compiled by Gulp, and Tailwind CSS (`resources/css/`), compiled by Laravel Mix.
- Preprocess logic split across the classic `.theme` file, two `includes/*.inc` files, OOP hooks in `src/Hook/`, and 65 Transmuter preprocess plugins in `src/Preprocess/`.
- Single Directory Components (SDC) and legacy UI Patterns.

## Base theme relationship

| Fact | Evidence |
|---|---|
| The runtime base theme is core `stable9`. | `careerforce_skin.info.yml`: `base theme: stable9` |
| The description still says "inherits from the CiviServ Base Theme" and the package is `CiviServ`. | `careerforce_skin.info.yml` |
| No CiviServ theme exists in the repo. `web/themes/` contains only `custom/careerforce_skin`. `web/modules/custom/civiserv` is a git submodule of a **module** (`civiserv-module.git`) and is empty in this export. | `.gitmodules`, directory listing |
| Several leftovers point to an older "CiviServ Portals" theme this one was apparently copied from: the `# from civiserv_portals` comment on `global_styles`, the `theme-settings.php` docblock, the schema label `CiviServ Portals settings`, the iconset id `civiserv_ui`, and the `.theme` docblock "Base theme file for the grayscale simple theme". | `careerforce_skin.libraries.yml`, `theme-settings.php`, `config/schema/careerforce_skin.schema.yml`, `careerforce_skin.iconset.yml`, `careerforce_skin.theme` |

In practice, everything this theme renders comes from the theme itself, core `stable9`, or module templates. Some templates depend on CiviServ **module** entities and services, such as `Drupal\civiserv\Entity\Location` and `connection.connection_link_builder` in `careerforce_skin.theme`.

## How it works

### Global assets (every page)

`careerforce_skin.info.yml` attaches these libraries globally:

- `core/normalize`
- `careerforce/cf-throbber`: a **module** library from `web/modules/custom/careerforce`, so the theme depends on that module.
- `careerforce_skin/global_styles`: `css/theme-styles.min.css` (Sass), `dist/css/app.css` (Tailwind), and `js/global_styles.min.js` (header/menu behavior).
- `careerforce_skin/behaviors`
- `careerforce_skin/ajax_reset_for_ajax_views`

It also:

- Removes the Font Awesome 6.4.2 CDN stylesheet that `social_media_links/fontawesome.component` would add (`libraries-override`). The theme compiles its own Font Awesome from `components/04-fontawesome/` with webfonts in `webfonts/`.
- Extends `core/drupal.dialog.ajax` with `careerforce_skin.dialog.ajax`.
- Registers the SDC/Twig namespace `careerforce_skin: components` (`components:` key, used by the contrib `components` module).
- Sets the CKEditor 5 content stylesheet to `css/editor.min.css`, compiled from `components/editor.scss`.
- Declares a dependency on `drupal:twig_tweak`.

### Regions

Declared in `careerforce_skin.info.yml`; printed in `templates/layout/html.html.twig`, `templates/layouts/page.html.twig` and `templates/includes/*.html.twig`. "Enabled blocks" is taken from `config/sync/block.block.*.yml` where `theme: careerforce_skin` and `status: true`.

| Region (machine name) | Printed in | Enabled blocks in config/sync (examples) |
|---|---|---|
| `page_pre_top` | `html.html.twig`, before the skip link. `Preprocess/Html.php` builds it with `RegionViewBuilder`. | None enabled. Holds disabled site-wide alert blocks (downtime, feature-update and language-switcher notices). |
| `notifications` | Top of `<header>` | None enabled |
| `utility` / `utility_mobile` | `desktop-header` / `mobile-header` includes | Account menu, header utility navigation, language switcher |
| `search` | `desktop-header` | `careerforce_skin_toolshedsearchblock` |
| `masthead` / `masthead_mobile` | `desktop-header` / `mobile-header` | Branding, main menu, mobile search block |
| `secondary_nav` | `<header>` | `toolshedmenunavigationblock` |
| `mobile_nav` | `<header>` | `toolshed_menu_navigation_mobile` |
| `status` | Top of `.page__content` | Messages, announcements |
| `top` | Above `<main>` | Breadcrumbs |
| `pre_content` | `<main>` → `.page-layout-pre-content` | Page title, anchor links, exposed filters, instructional text, SDC job search |
| `sidebar_first` / `sidebar_second` | Inside `.page-layout`, rendered as `<aside role="complementary">` | Event/appointment search filters; newsroom search, job cards |
| `content` | Inside `.page-layout` | Main content, local tasks/actions, profile links, customer-support blocks |
| `sub_content` | `<main>` → `.page-layout-sub-content` | Help, explore careers, military career lookup, paragraphs |
| `footer`, `footer_secondary` | `templates/includes/footer.html.twig` (only when either has content) | Primary/secondary footer, contact, social links |
| `attribution` | After the footer | Register to vote, tertiary footer, WIF text |
| `page_bottom` | Core | none |

`templates/layouts/page.html.twig` adds:

- Modifier classes `page-layout--sidebar-first`, `--sidebar-second` and `--sidebar-both`, based on which sidebars have content.
- A gray wrapper with a white inner panel (`component__background--gray` / `--white`) when `page.content['#gray_background']` is set.
- A `page--bare-title` class when `#page_title_bare` is set.

`Preprocess/Region.php` gives every region `data-region="<name>"` and a unique `id`. Tailwind classes are pushed onto specific regions by `Region/RegionFooter.php`, `RegionMasthead.php`, `RegionUtility.php` and `RegionAttribution.php`.

### Header: desktop vs mobile

`page.html.twig` includes both headers and switches them at the Tailwind `lg` breakpoint (1024px):

- `<div class="lg:tw-hidden">` contains `includes/mobile-header.html.twig`.
- `<div class="tw-hidden lg:tw-block">` contains `includes/desktop-header.html.twig`.

The mobile header prints only the `*_mobile` regions. A template comment explains why: "printing a region in both headers duplicates its IDs".

The mobile header has a search button (`data-search-btn`) and a hamburger button (`data-menu-btn`, `aria-expanded`). The JavaScript for both is in `es6/global_styles.es6.js`.

`Preprocess/Block/BlockPreprocessor.php` maps `masthead_mobile` → `masthead` and `utility_mobile` → `utility` before it passes the region as a menu attribute. Because of this, menu theme suggestions (`menu__<region>`, see `theme_suggestions.inc`) resolve the same for desktop and mobile.

### Page-level preprocess rules (`src/Preprocess/Page.php`, `careerforce_skin.theme`)

These rules change page chrome per route. They explain why some pages look different:

| Condition | Effect |
|---|---|
| Path ends in `/print` (`careerforce_skin_preprocess_page`) | Empties `notifications`, `utility`, `utility_mobile`, `masthead`, `masthead_mobile`, `secondary_nav`, `mobile_nav`, `footer` and `footer_secondary` |
| Route `careerforce_profile.register.form` | Removes the utility navigation, search, main menus, secondary/mobile nav, `top`, the footers and `attribution`, plus everything in `pre_content` except `pagetitle`. Adds class `page--register`. |
| Article node; views `article_content` / `in_the_news`; the newsroom page_manager page; route `cf_skills_comparison.skills_comparison`; route `employment_readiness.take_quiz`; region taxonomy terms | Sets `#gray_background` (gray page wrapper) |
| Newsroom page, region and industry terms | Sets `#page_title_bare` |
| Views `article_content` / `in_the_news` | Puts the view title in `pre_content` as an `<h1 class="pre-content-title">` and adds a flex wrapper to the content region (`region--content.html.twig`) |
| Profile edit routes (`entity.user.edit_form`, `profile.user_page.single`, `fam.user.edit_mail`, `fam.user.edit_pass`, `careerforce_profile.profile.form`) | Moves `profilelinksblock` into a sidebar and the main content and SSO block into a flex container. Adds `page--profile*` classes. |
| `dismae.page.taxonomy_page` | Gray background on the `careerforce_skin_content` block |
| My Events & Appointments page_manager route | Adds class `page--events-appointments` |

`Preprocess/Html.php` overrides the `<title>` on `entity.user.canonical` ("Dashboard | CareerForce", or "View Profile | CareerForce" for the `default_dashboard-layout_builder-1` variant) and on `entity.user.edit_form` ("My Profile | CareerForce"). It also adds `my-labor-market-dashboard` to `<html>` on `careerforce_profile.labor_market`.

### Style categories (organization color coding)

`_careerforce_skin_get_style_category_from_group()`, `..._from_location()` and `..._from_node()` in `careerforce_skin.theme` return one of five CSS classes. Copies of the same helpers are in `src/Utility/CommonFunctions.php`.

| Class | Source |
|---|---|
| `style-category--cf-location` | Group type `workforce_center` |
| `style-category--adult-basic-education` | Group type `adult_basic_education` |
| `style-category--board-or-association` | `community_partner` with `field_partner_type = board_or_association` |
| `style-category--cf-partner` | `community_partner` with `careerforce_partner` |
| `style-category--normal` | Everything else, including employers |

For nodes, the highest-priority category among all related groups wins, in the order listed above. These classes are set on groups (`careerforce_skin_preprocess_group`) and on location pages (`careerforce_skin_preprocess_location_default`). If you change the mapping, change it in both the `.theme` file and `CommonFunctions.php`.

### Layouts (`careerforce_skin.layouts.yml`)

All are in category "CareerForce Layouts". "Used by" comes from searching `config/sync`.

| Layout id | Template | Library | Used by |
|---|---|---|---|
| `landing_default` | `templates/layouts/landing/landing_default` (rows 1–4) | none | `page_manager.page_variant.home_page-panels_variant-0` |
| `dashboard_default` | `templates/layouts/dashboard/dashboard_default` (top/main/secondary). Prints `<h1>{{ dashboard_title }}</h1>` ("<first name>'s Dashboard", from `careerforce_skin_preprocess_dashboard_default`). | none | `page_manager.page_variant.default_dashboard-panels_variant-0` |
| `planning_region` | `templates/layouts/planning_region/planning-region` | `layout_planning_region` | Taxonomy term `region` full display |
| `industry` | `templates/layouts/industry/industry` | `layout_industry` | No reference found in `config/sync` |
| `location_default` | `templates/layouts/location/location_default` (main, bottom bar, subordinate, 3 sidebar areas) | none | All four `civiserv_location` bundle default displays |
| `trainig_program_default` (sic) | `templates/layouts/training_program/training_program_default` | none | `node.training_program.default` |
| `occupation_detail_twocol_rows` | `templates/layouts/occupation/...` | none | `civiserv_jobs.occupation_display.default` |
| `job_search` | `templates/layouts/job-search` | `layout_job_search` | `page_manager.page_variant.job_search-layout_builder-0` |
| `profile_account_info` | `templates/layouts/profile-account-info` | `layout_profile_acct_info` | `user.user.view_profile` display |
| `appointments_booking` | `templates/layouts/cf-appointments-booking` | none | Appointment occurrence/session displays |
| `event_search_sidebar` | `templates/layouts/event-search-sidebar` | `layout_event_search_sidebar` | Exposed-form blocks `careerforce_skin_exposedformcontent_searchevents_search` and `..._book_an_appointmentpage_1_3` (`layout:` key) |
| `cf_card` | `templates/layouts/cf-card` | `layout_cf_card` | `happenings_occurrence.teaser` |
| `events_two_col` | `templates/layouts/events-two-col` | `layout_events_two_col` | Seven happenings occurrence/session displays |

Do not rename layout ids. They are stored in config, including the misspelled `trainig_program_default`.

Several `icon:` paths point to files that don't exist. `landing_default` and `dashboard_default` point to `templates/layouts/homepage/...`, but the PNGs are in `landing/` and `dashboard/`. There are no `training_program_default.png` or `occupation_detail_twocol_rows.png` files. Layout Builder will show no icon for these layouts.

UI Patterns also exposes SDC components as layouts with ids like `ui_patterns:careerforce_skin:sdc_cta`.

### Theme libraries

| Library | Assets | Attached by |
|---|---|---|
| `global_styles` | `css/theme-styles.min.css`, `dist/css/app.css`, `js/global_styles.min.js` | `info.yml` (global) |
| `behaviors` | `js/behaviors.min.js` (+ `jquery-touch-events`) | `info.yml` (global) |
| `ajax_reset_for_ajax_views` | `js/ajax-reset-for-ajax-views.min.js` | `info.yml` (global) |
| `careerforce_skin.dialog.ajax` | `js/dialog.ajax.min.js` | `libraries-extend` of `core/drupal.dialog.ajax` |
| `jquery-touch-events` | `js/jquery.event.move.js`, `js/jquery.event.swipe.js` (vendored, committed) | dependency of `behaviors` |
| `webform` | `js/webform.min.js` | `careerforce_skin_preprocess_webform_submission_form()` |
| `layout_*` (planning_region, industry, job_search, profile_acct_info, event_search_sidebar, cf_card, events_two_col) | `css/layout-*.min.css` or `resources/css/*.css` served as-is | `careerforce_skin.layouts.yml` |
| `occurrence_additional_times` | `js/occurrence-additional-times.js` | `Preprocess/View/ViewsViewHappeningsOccurrenceAdditionalTimes.php` |
| `occupation-details-collapsibility` | `js/occupation-details-collapsibility.js` | `templates/module/civiserv-jobs-occupation-display.html.twig` |
| `career-recommendation-modal-collapsibility` | `js/career-recommendation-modal-collapsibility.min.js` | `careerforce_skin_preprocess_civiserv_occupation_datatable()` |
| `admin_css` | `css/admin-styles.css` | `careerforce_form_alter()` for `node_page_form` / `node_page_edit_form` (`web/modules/custom/careerforce/careerforce.module`) |
| `tooltip` | `https://unpkg.com/popper.js@1` (external), `/libraries/tippyjs/dist/tippy-bundle.umd.min.js`, `js/tooltip.min.js` | `templates/location/location-regions.html.twig` |
| `pww_jump_link_menu` | `js/jump-link-menu.js` (depends on `pww_module_jump_link_menu/jump_link_menu`) | `Preprocess/PWWJumpLinkMenu.php` |
| `links__language_block` | `js/links--language-block.js` | `Preprocess/LinksLanguageBlock.php` |
| `menu_more_dropdown` | `js/menu-more-dropdown.min.js` | `Preprocess/Region/RegionSecondaryNav.php` |
| `dropdown_menu` | `js/dropdown-menu.min.js` | `Preprocess/Menu/MenuSecondaryNav.php`, `Preprocess/Navigation/MenuLocalTasks.php` |
| `local_tasks_menu` | `js/local-tasks-menu.min.js` | `Preprocess/Navigation/MenuLocalTasks.php` |
| `share_this` | `js/share-this.min.js` | `templates/social-media-links.html.twig` |
| `resume_dropbutton_operations` | `js/resume-dropbutton-operations.min.js` | `templates/navigation/links--dropbutton--operations--threedots.html.twig` |
| `slick_accessibility` | `js/slick-accessibility.js` | `Preprocess/Slick.php` (only when the Slick optionset has `accessibility: false`) |
| `decision_tree_dropdown` | `js/decision-tree-dropdown.js` | `Preprocess/DecisionTree/DecisionTreeQuestionOptions.php` |
| `keyboard_trap`, `focusable` | `js/keyboard-trap.js`, `js/focusable-selector.js` (committed, no ES6 source) | No attachment found |
| `resume_preview` | `js/resume-preview.min.js` | No attachment found |
| `user_nav_menu` | `js/user-nav-menu.min.js` | No attachment found, and there is no source file `es6/user-nav-menu.es6.js` |
| `react`, `react-dom` | unpkg React 16 UMD (external) | No attachment found |

## Configuration

Theme settings live at `config/sync/careerforce_skin.settings.yml`. The form is in `theme-settings.php`.

| Setting | Value in config/sync | Effect |
|---|---|---|
| `dynamic_branding_front_page` | `true` | Only shown when `toolshed` is enabled. Per the form description, it caches the branding block differently on the front page. The cache alter lives in Toolshed, not in this repo. |
| `use_dev_assets` | **`true`** | `careerforce_skin_library_info_alter()` calls `Drupal\toolshed\Utility\LibraryMinifyAlter::minifiedToExpanded()` on every `careerforce_skin` library. Going by the setting's description, this serves the expanded (non-`.min`) CSS/JS. `config/` has no environment override, so this appears to apply in every environment, including prod. Changing it clears the library cache (`_careerforce_skin_form_system_theme_settings_submit`). |
| `features.*`, `logo`, `favicon` | Core defaults (favicon on, user pictures off) | `logo.svg` / `favicon.ico` in the theme root are used |

Breakpoints are defined in `careerforce_skin.breakpoints.yml`. The file header says changes must be mirrored in `components/00-settings/_layout.scss`.

| Breakpoint | Media query | Sass var | Tailwind screen (tailwind.config.js) |
|---|---|---|---|
| xsmall | `min-width: 0` | none | none |
| small | `min-width: 475px` | `$screen-width-sm` | `sm` = 640px (Tailwind default) |
| medium | `min-width: 768px` | `$screen-width-md` | `md` = 768px |
| large | `min-width: 1024px` | `$screen-width-lg` | `lg` = 1024px |
| extra_large | `min-width: 1400px` | `$screen-width-xl` (= `$container-max-width`) | `xl` = 1280px (default), `2xl` = 1370px (override) |

Modules also read this group. `SkillsMatcherStepOneForm` and `InterestProfilerStepOneForm` in `web/modules/custom/careerforce/src/Form/` pass `careerforce_skin.screen_layout` to `drupalSettings`.

## Related

- Feature areas: [../accounts/](../accounts/), [../locations/](../locations/), [../events/](../events/), [../appointments/](../appointments/), [../services/](../services/), [../jobs-and-careers/](../jobs-and-careers/), [../content-authoring/](../content-authoring/), [../platform-and-operations/](../platform-and-operations/)
