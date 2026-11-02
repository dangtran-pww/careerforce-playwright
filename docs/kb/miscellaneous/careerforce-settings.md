# CareerForce admin settings, printable pages and suggester override

`careerforce_config` adds the "CareerForce" section under Configuration (`/admin/config/careerforce`) with settings forms that content moderators and site admins use to adjust site text and behaviour without a deploy. This doc also covers `cf_printable`, a bare HTML page theme used for printer-friendly output, and the `careerforce` module's occupation-suggester service override.

## What users see

All routes are in `web/modules/custom/careerforce/modules/careerforce_config/careerforce_config.routing.yml`.

| Admin path | Form | Config object | Permission | What it controls (consumer) |
|---|---|---|---|---|
| `/admin/config/careerforce` | System admin menu block | n/a | `access administration pages` | Landing page listing the links below |
| `/admin/config/careerforce/referral` | `ReferralSettingsForm` | `careerforce_config.referral` | `administer careerforce_config` | "Create referral option" checkboxes and the "Organization provider" (`enable_referral_option`, `civiserv_provider_id`). Read by `careerforce_profile/src/Hook/ProfileHooks.php` |
| `/admin/config/careerforce/username-profanity` | `UsernameProfanitySettingsForm` | `careerforce_config.username_profanity` | `administer careerforce_config` | `enable_validation`, `wordlist` ("Restricted Words"). No consumer found in custom code |
| `/admin/config/careerforce/regional-team` | `RegionalTeamSettingsForm` | `careerforce_config.regional_team` | `administer regional team` | Name/email/phone contacts per region and program area. Read by `RegionalTeamBlock` |
| `/admin/config/careerforce/featured-careers-by-industry` | `FeaturedCareersByIndustrySettingsForm` | `careerforce_config.featured_careers_by_industry` | `administer featured industry careers` | Featured careers per industry. Read by `FeaturedCareersByIndustryBlock` |
| `/admin/config/careerforce/job-search` | `JobSearchSettingsForm` | `careerforce_config.job_search` | `administer careerforce_config` | Job search CTA banner: heading, body, button URL and text, published. Read by `JobSearchResultsBlock` |
| `/admin/config/careerforce/ssn` | `SsnSettingsForm` | `careerforce.ssn_settings` | `administer careerforce_config` | SSN helper text, accordion header and body, opt-out checkbox and label. Read by `careerforce_profile/src/Form/UserRegistrationProfileForm.php` |
| `/admin/config/careerforce/user-routes` | `UserRoutesSettingsForm` | `careerforce.user_routes` | `administer careerforce_config` | Route names that answer 404 instead of 403. Read by `careerforce/src/EventSubscriber/User403to404HttpSubscriber.php` |
| `/admin/config/careerforce/date_input` | `DateInputSettingsForm` | `careerforce.date_input_settings` | `administer careerforce_config` | Default `min`/`max` years for HTML date inputs. Read by `careerforce/src/Hook/DateHooks.php` |

Roles with `administer careerforce_config`, `administer regional team` and `administer featured industry careers`: `content_moderator`, `site_admin` (from `config/sync/user.role.*.yml`). All three permissions are `restrict access: TRUE`.

**Printable page:** `cf_printable` provides the theme hooks `printable` (a full `<html>` document) and `printable_header` (logo). The only caller found is `/print-compare-skills/{soc_code_1}/{soc_code_2}` (`cf_skills_comparison.print_skills_comparison`), which returns the rendered page as a raw `Response`.

## How it works

- **Date inputs.** For every `input__date` without its own `min`/`max`, `DateHooks::preprocessInputDate()` sets `min = today - date_min years` and `max = today + date_max years`. Current config: `date_min: 50`, `date_max: 20`. Empty values add nothing.
- **User routes.** `UserRoutesSettingsForm` uses `#config_target` with a `ConfigTarget` that splits and joins on `\r\n`. `User403to404HttpSubscriber::on403()` (HTML only) swaps the 403 for a `NotFoundHttpException` when the route name is in the list. Current list (`config/sync/careerforce.user_routes.yml`) includes `entity.user.canonical`, `entity.user.edit_form`, `profile.user_page.single`, `fam.user.edit_mail`/`edit_pass`, and the Page Manager user pages (account settings, my resumes, my events and appointments, and others). A comment in the form says the purpose is to avoid revealing which user IDs exist.
- **SSN settings** are translatable (`careerforce_config.config_translation.yml`, base route `careerforce_config.config.ssn`).
- **Printable.** `template_preprocess_printable()` sets `base_url` (module path), `title` (from the title resolver for the current route) and `html_attributes` (lang/dir). The template has inline CSS that hides `.node_view ul li` and outputs `{{ header }}` and `{{ content }}` inside `div.page.page--printable`. The template also references `head_title`, `favicon`, `include_css` and `attributes`, which preprocess never sets.
- **Occupation suggester.** `careerforce\Suggester\OccupationSuggesterProvider` only overrides `SUGGESTION_FORM_CLASS` to `\Drupal\careerforce\Form\OccupationSuggestionForm`. `careerforce/src/Routing/RouteSubscriber.php` points route `civiserv_jobs.occupation_suggester` (`/occupations/{suggester_id}`) at `\Drupal\careerforce\Controller\OccupationSuggestionController::buildSuggestions`, which uses this service. Behaviour is covered in the jobs KB.

## Configuration and permissions

- See the table above. The forms are standard `ConfigFormBase` forms, and their config is exported in `config/sync`.
- No config split overrides any of these objects.

## Related

- ../jobs-and-careers/: job search CTA, featured careers by industry, occupation suggester, skills comparison
- ../accounts/: referral, SSN and registration, user pages behind the 404 rule
- [navigation-and-url-aliases.md](navigation-and-url-aliases.md)
