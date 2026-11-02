# Job seeker registration and profile

Job seekers (users whose `field_extended_profile_type` is `career_seeker`) finish a multi-step registration profile after their first login, then edit the same steps later from their account. The steps are split into two registration tiers. Tier 1 is required to use features such as the Resume Builder. Tier 2 is a longer eligibility profile needed for some services, such as event registration and appointment booking. The `careerforce_profile` module handles the step forms, tier tracking, route gating, navigation blocks and the hand-off to the profile data API. The `agree_terms` field type is also covered here.

## What users see

| Path | What it is | Who |
|---|---|---|
| `/user/{uid}/register/-` | Step 1, "Account Information": first/last name, birth date, Social Security Number (SSN) with an opt-out checkbox. Title "Create an Account: Step 1". | The job seeker only (own account) |
| `/user/{uid}/register/{form_mode}` | The other registration steps, titled "Create an Account: Step N" | The job seeker only |
| `/user/{uid}/profile/{form_mode}` | Edit a step after registration. Title is "My Profile: <step>" for your own profile and "Edit Profile: <step>" for staff editing someone else's. | Anyone with `update` access on the profile entity |
| `/user/{uid}/edit` | Core account form. It is set as a non-admin route so the front-end theme is used. | Owner / admins |

Steps (from `config/sync/careerforce_profile.registration_edit_profile.yml`, key `career_seeker.steps`):

| Step key | Tier | Form mode label | Fields (from `core.entity_form_display.profile.career_seeker.<mode>.yml`) |
|---|---|---|---|
| `-` | 1 | Account Information (user form mode `job_seeker_registration_step_1`) | user first/last name, embedded profile `field_birth_date`, plus the SSN element |
| `demographic` | 1 | Demographic Information | address, phones, gender, ethnicity, race, sexual orientation, disability, veteran/military, migrant/seasonal worker, how you heard about CareerForce. User fields `field_preferred_name` and `field_middle_initial` are added. |
| `education_and_employment` | 2 | Education and Employment | education level, school status, employment status, unemployed duration, months at last job, and more |
| `equal_opportunity` | 2 | Equal Opportunity | homeless, runaway, foster child, justice involved |
| `military` | 2 | Military and Veterans | served, separation date, transitioning, TAP/OBTT, branch, campaign veteran, spouse, caregiver, and more |
| `income` | 2 | Income and Public Assistance | dependents, SNAP, TANF, SSI, SSDI, Ticket to Work, and more |

Tier 2 steps have a "Go Back" link during registration (`has_back_option_on_registration`).

Blocks:
- **Job Seeker Registration Navigation Block** (`js_registration_navigation_block`) shows a step indicator with `is-active` and `completed` classes and configurable body text. Only the job seeker sees it, on their own pages.
- **Profile Links Block** (`profile_links_block`) lists "Account Information" plus a link per profile step. Tier 2 step links appear only once tier 2 is complete. It can be set to show a single step with a custom label.
- While on the registration route, the account menu is cut down to logout links only (`Menu/AccountMenuBuilder.php`).

## How it works

### Data model
- Profile entity type `profile` (contrib `profile` module), bundle `career_seeker`. One profile per user. Fields are listed above.
- The user field `field_extended_profile_type` (target `profile_type`) decides the user type: `career_seeker`, `partner` or `staff`.
- The user base field `profile_status` is computed and has no storage of its own. `ProfileStatusList::computeValue()` reads table `careerforce_profile_data` (primary key `uid`+`type`, columns `tier`, `status` (`in-progress` | `complete`), `submitted`, `steps` as a JSON list of completed step keys). Defaults are tier 1, `in-progress`.
- A temporary higher tier can be stored in the session under key `<profile_type>:<uid>`. It only applies to the logged-in user's own account, and is always `in-progress`.

### Tier logic (`ProfileTierHelper`)
- `getSteps($account, $tier)` returns every step whose `tier <= $tier`, in config order. Step `-` is always included. Other steps are kept only if a profile form mode with that ID exists.
- `updateProfileStatus($op)` adds the step to `steps`. It then walks up the tiers (max `MAX_TIER = 2`) and marks a tier `complete` once all its steps are done. The result is merged into `careerforce_profile_data`.
- `setTier($account, $tier, $forSession)` raises the target tier. With `$forSession = TRUE` the tier is kept in the session only, unless the user has already finished it. `user_update` calls `setTier()` with the tier from the admin widget, so staff can push a user to tier 2.
- `ProfileStatusItem::isTier($n)` is TRUE if status is `complete` and tier ≥ n, or if a higher tier is in progress but every step of tier n is done.

### Registration flow
1. **Login** (`ProfileUpdateHooks::userLogin`). For a job seeker it reads the login destination (from the OpenID Connect session or `?destination`). If that path is a tier-2 route, it calls `setTier(2, forSession: TRUE)` and dispatches `PROFILE_LOGIN_DESTINATION_ALTER`. If a next step exists, the destination becomes `/user/{uid}/register/{next}` and the original destination is carried along. Partner/staff users without a profile are sent to `profile.user_page.single`.
2. **Step `-`** (`UserRegistrationProfileForm`). The user form embeds the `career_seeker_profiles` widget (contrib `profile_form`, holding `field_birth_date`). It adds an `ssn` element, plus helper text, an accordion and an opt-out checkbox from `careerforce.ssn_settings` (admin form `/admin/config/careerforce/ssn` in `careerforce_config`).
   - Validation: SSN is required unless opted out. `validateProfileData()` then calls `transmit_profile` during validation. An HTTP 400 gives an "invalid SSN" error. A 409 gives the same error plus a link to find a location, and counts attempts in form state (`ssn_error_count`, with a `@todo` to lock accounts). Any other API failure shows "temporary system failure".
   - Entity builder: sets user `field_ssn_share` to FALSE when the user opts out or leaves SSN empty. The SSN itself is not stored on any entity in this code.
   - Save: `updateProfileStatus('-')`, then dispatches `PROFILE_PRE_SUBMIT` (used by prefill), then calls `transmit_profile` again and sets `submitted` if the API says so, then redirects to the next step. The `destination` query is passed on unless it is `/user`, `/user/login` or `/user/<id>`.
3. **Profile steps** (`ProfileStepForm`, as `ProfileMatchStepForm` when `cf_profile_match` is on).
   - `user_fields` from the step config are rendered from the `user.user.default` form display and saved on the owner.
   - Conditional fields from `career_seeker.conditional_fields`:
     - If the dependee is on the same form, `state_settings` become `#states` (visible/required), with up to 2 levels of nesting.
     - If the dependee is on another step (for example `field_runaway`/`field_foster_child` depend on `field_birth_date` through `ProfileDateCondition`, age < 18), the callback decides `#access`.
     - On submit, a dependent value is reset to `value_settings.value_form` when the dependee holds one of `dependee_value_form`.
     - `hook_profile_presave` also resets fields that have `reset_value` when their dependee changed and the condition no longer holds.
   - In edit mode the fields in `edit_hidden_fields` get `#access = FALSE` (demographics, terms, some tier-2 questions).
   - `save()` marks the step complete the first time, transmits (see [sending-profiles-to-mn-deed.md](../accounts/sending-profiles-to-mn-deed.md)), then routes to the next step in registration mode or to the user page.
4. **Route gating** (`ProfileTierCheckSubscriber`, on every request). For an authenticated job seeker without tier 1 who requests a tier-1 route, it clears the session tier, sends a 302 to the next registration step with `destination`, and shows "Please complete your profile before using this feature."
   - Tier-1 routes come from `cf_resume` (`src/EventSubscriber/CareerForceProfileSubscriber.php`: resume pages and the three page_manager resume pages).
   - Tier-2 routes come from `web/modules/custom/registration_api/src/EventSubscriber/CareerForceProfileSubscriber.php`: event occurrence, registration confirmation, appointment booking.
   - This subscriber only enforces tier 1. Tier-2 routes are used here only to raise the session tier at login. The route list is cached in `cache.default` under `careerforce_profile.routes.tiered`.

### Other hooks
- `profile_insert`/`profile_update` for `career_seeker`: if the owner's `field_cf_location` is empty, it takes the profile postal code (or the prefill `zipCode` if the user accepted prefill), maps it to a WFC (Workforce Center) ID with `Drupal\careerforce\Utility\Lwda::getWfcidAssignToZipcode()`, and sets the matching `civiserv_location` in the CareerForce group. For other bundles it calls `transmit_staff`.
- `profile_delete` deletes the user's `careerforce_profile_data` row.
- Form alters on the user form: removes `account.name`. Job seekers on the default form get roles hidden and are redirected to their user page on save. If the account is from an external auth provider and OIDC claim mappings exist, the mapped fields are shown disabled with "This information is managed by <provider>" and a link to the provider account.

### Events this module dispatches (`src/Event/CareerForceProfileEvents.php`)
| Constant | Fired from | Used by |
|---|---|---|
| `PROFILE_TIERED_ROUTES` | `TieredRoutes` (once, then cached) | `cf_resume`, `registration_api` |
| `PROFILE_LOGIN_DESTINATION_ALTER` | `userLogin()` for tier-2 destinations | `registration_api` (rewrites occurrence page → registration confirmation) |
| `PROFILE_PRE_SUBMIT` | step 1 save | `cf_profile_match` |
| `PROFILE_SEND_ALTER` | building the transmit payload | `cf_profile_match` |

### Terms of use field (`agree_terms`)
- Field type `agree_terms` (boolean column) and widget `AgreeTermsCheckboxWidget`. The widget has a checkbox label, an optional link to `terms_path`, and an optional `details` accordion with terms content. Its formatter prints on/off labels.
- Used as `field_terms_use` on `career_seeker`, `partner` and `staff` profiles. On `career_seeker` it appears only on the `default` form display, not on any registration step, and it is in `edit_hidden_fields`.
- `agree_terms_entity_field_access()` allows view/edit for `bypass node access`, `administer content types` or `administer the agree_terms field`, and view for `view any agree_terms`. For the owner it allows view with `view own agree_terms`, and edit only while the value is still unchecked.

## External services and integrations
- Profile data API (`transmit_profile`, `transmit_staff`). See [sending-profiles-to-mn-deed.md](../accounts/sending-profiles-to-mn-deed.md).
- Registration prefill. See [registration-prefill.md](registration-prefill.md).
- SSO: `openid_connect` session destination and `fam` auth provider for "managed by" fields. See `../accounts/`.

## Configuration and permissions
- `careerforce_profile.registration_edit_profile` (config only, no UI): steps, tiers, `user_fields`, `conditional_fields`, `edit_hidden_fields`. Steps need a matching `core.entity_form_mode.profile.<id>`.
- `careerforce_profile.settings` at `/admin/config/careerforce/careerforce_profile` (`administer careerforce profile`). The "complete profile" message fields are all set to `#access => FALSE`, so the form currently shows nothing editable.
- `careerforce_config.ssn_settings` at `/admin/config/careerforce/ssn` (`administer careerforce_config`).
- `agree_terms` permissions: `view own agree_terms`, `view any agree_terms`, `edit own agree_terms`, `administer the agree_terms field`. `site_admin` and `user_manager` have `view any`.
- There are no config split differences for this module's own config.

## Other code in this module (not job seeker features)
These are briefly noted so nobody looks for them elsewhere:
- **My Labor Market** `/user/{uid}/labor-market` (`src/Controller/LaborMarketController.php`). It is for partner and staff only (own page, or permission `access labor market`). It shows statewide/regional LMI data with saved regions (`field_my_labor_market_regions`), a "Now Hiring" occupation list (`field_employer_hiring`, max 12) and a military career lookup. The data comes from the `mn_lmi:*` data request plugins (`plugin.manager.careerforce.data_request`), which are covered in `../jobs-and-careers/`.
- **Customer support blocks** (`CustomerSupport*Block.php`) and **`Tier2UserSelection` / `Tier2VeteranUserSelection`** entity reference selection plugins. The selection plugins list active users whose `careerforce_profile_data` row is tier 2 `complete` (optionally veteran = `YES`). See `../accounts/` and `../services/`.
- Partner/staff profile add creates an automatic "vetting" `connection` (`ProfileHooks::profileStaffAndPartnerAddFormSubmitCallback`), and partner registration at `/user/register-partner`. See `../accounts/`.

## Related
- [sending-profiles-to-mn-deed.md](../accounts/sending-profiles-to-mn-deed.md)
- [registration-prefill.md](registration-prefill.md)
- [resume-builder.md](resume-builder.md) (tier-1 gated)
- `../accounts/`, `../locations/`, `../events/`, `../appointments/`, `../services/`
