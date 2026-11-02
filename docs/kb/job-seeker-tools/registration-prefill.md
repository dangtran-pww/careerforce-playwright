# Registration prefill (profile match / auto-population)

After step 1 of registration, CareerForce asks MN DEED's API whether other State systems already hold data for this person, matching on SSN, last name and birth date. If they do, the job seeker is asked whether to use it. If they agree, the matched values are treated as the answers to the profile questions: the fields show as locked ("pre-filled") and the values go to the profile API without being stored on the Drupal profile. The user can unlock any field to enter it by hand. The `cf_profile_match` module implements this.

## What users see
- **After step 1:** if a match was found, the Demographic step opens a modal at `/cf_profile_match/profile-data-usage-form`. Title and text are configurable; defaults are "Use Your Existing Information?", "Yes, use my data" and "No, I'll enter it myself".
- **On "Yes":** the modal swaps to "We found matching information", with an optional sample image of a pre-filled field and an "Okay" button that reloads the page.
- **On every job seeker step form:** matched fields carry `data-profile-match="user-match"`, are disabled, and have an **Enter manually** button (`es6/manual-field-entry.es6.js`). Users with `access profile match data` also see a "Current entry: …" line with the matched value.
- **Matching also moves the user to tier 2:** registration then continues through all tier-2 steps.
- **Staff views:** Views can show `field_phone` / `field_alternate_phone_number` "(Profile Matched)" columns. When the viewer has permission and the user accepted a match with that value, the column renders the matched value in place of the stored one. The method name says "fallback", but the code applies the match even when a stored override exists.

## How it works
1. **Match (once per user).** On `PROFILE_PRE_SUBMIT` for step `-`, if the user has no `cf_profile_match` row, `ProfileMatchData::retrieveMatch()` builds a `registration_prefill` request from first/last name, SSN (NULL if opted out) and profile `field_birth_date`.
   - If the API returns `found` and `profile`, the non-null properties are stored as JSON with `use_match = 0`. The subscriber then calls `setTier($account, 2)` (stored, not session-only) and sets the session flag `cf_prompt_use_match`.
   - A "no match" response, or a missing required parameter (for example SSN opted out), still writes a row with `data = NULL`. That counts as the user's one attempt.
   - API/transport errors write **no** row, so the user keeps their chance (see the code comment in `retrieveMatch()`).
2. **Consent.** The demographic form alter sees the session flag, removes it, and attaches `auto_population_prompt.js`, which opens the modal via Drupal AJAX. "Yes" calls `setDataUseFlag(TRUE)`. "No" just closes the dialog, leaving `use_match = 0`.
3. **Locked fields.**
   - `getProfileMatchedFieldNames()` maps the API keys back to profile fields with `ProfileFieldDataMap::getMatchToField()`, only when `use_match` is set.
   - Locked fields lose `#required` (the original is kept in `data-cf-profile-match-is-required-field`) so empty locked fields do not block submit.
   - **Enter manually** adds the field to the hidden `overridden_fields` value (`|`-separated).
   - On save, `ProfileMatchStepForm::buildFieldOverrides()` sets every matched field on this step that was *not* overridden to NULL. The Drupal profile therefore holds only user-entered overrides.
4. **Sending.** On `PROFILE_SEND_ALTER`:
   - The payload gets `cfdatausage` (a match exists) and `manualentry` (the user declined).
   - If the user accepted, each mapped field that is empty on the profile gets the matched value, unless a conditional-field rule excludes it. Those rules are evaluated against the profile value, or the matched value when the profile value is empty.
5. **Location.** `careerforce_profile` uses the matched `zipCode` to assign the nearest CareerForce location when the profile has no postal code ([job-seeker-registration-and-profile.md](job-seeker-registration-and-profile.md)).

## External services and integrations
- MN DEED `RegistrationPrefill` endpoint through the shared profile datasource ([sending-profiles-to-mn-deed.md](../accounts/sending-profiles-to-mn-deed.md)). Request ID `registration_prefill`, disabled in `config/sync`. On AWS it is enabled/tokenised from the SSM parameter `<prefix>/azure/profile_data`.
- Audit: events `registration_prefill:attempt`, `registration_prefill:matched`, `registration_prefill:no_match`, recorded to stenographer storages `stenographer_cloudwatch` and `pww_auditor`.

## Configuration and permissions
- `/admin/config/careerforce/cf_profile_match` (`administer cf_profile_match`): modal titles, messages, button labels, optional uploaded sample image (otherwise `assets/sample-pre-filled-field.jpg`). Config `cf_profile_match.settings` is translatable (`cf_profile_match.config_translation.yml`).
- `access profile match data`: see all matched values ("Current entry" on forms, Views fields). Roles: `site_admin`, `job_services_administrator`.
- `access profile match data field_phone` and `… field_alternate_phone_number`: per-field Views access. Roles: `job_services_admin`, `user_manager`.
- The consent route is open to any logged-in `career_seeker`.

## Related
- [job-seeker-registration-and-profile.md](job-seeker-registration-and-profile.md)
- [sending-profiles-to-mn-deed.md](../accounts/sending-profiles-to-mn-deed.md)
