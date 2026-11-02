# Form fields, widgets and form behaviours

Several small modules change entity edit forms:

- `cf_conditional_fields` makes conditionally-required address fields work and checks that training program schedules are filled in.
- `cf_dependent_entity_reference` filters one entity reference field's options by another field's value (for example staff by location) and can show a preview.
- `contact_field` provides a "Preferred Contact" field type and a 10-digit US phone field type.
- `element_tooltip` adds an info-icon tooltip to any form widget or Views field label.
- `cf_webform_access` makes "duplicate submission" a per-webform access rule.

Editors, staff entering events and appointments, and site builders configuring forms are affected.

## What users see

- **Conditionally required address subfields.** On forms such as the external event session form (`happenings_session_ext`), when a condition makes an address field required, only the configured subfields (for example address line 1, city, state) get the required marker and HTML5 required state, not the whole address wrapper.
- **Training program edit form** (`node_training_program_edit_form`): if "Scheduled / Self-paced" (`field_scheduled_self_paced`) is `0`, at least one Program Dates (`field_program_dates`, office hours) row must be filled in. Otherwise the error is "This value should not be null."
- **Dependent selects.** On appointment/event session and occurrence forms and service records, changing the parent field (for example `location`) reloads by AJAX the options of dependent fields such as `field_staff_member`, `field_meeting_location`, `field_facilitators`, `field_moderators`, `field_locations_alternate`. The "Select list with Preview" widget also renders the chosen entity, or the parent session's location, in a view mode below the select.
- **Preferred contact field** (used on `connection.standard.field_preferred_contact`): a "Preferred contact method" select (Email/Phone) that shows either an email input or a 10-digit phone input.
- **Tooltips**: an info button next to a field label. Clicking or focusing it shows formatted help text. Used on several `profile.career_seeker` form modes, `happenings_*` forms, and many admin Views, including `views.view.resumes`, `user_admin_people` and `service_records`. 61 config files reference `element_tooltip`.
- **Webform submission "Duplicate"**: denied by default for everyone on every webform. A webform's Access tab gets "Duplicate any submissions" and "Duplicate own submissions" rules to grant it.

## How it works

### cf_conditional_fields

- On contrib `conditional_fields`' edit form (`conditional_field_edit_form` / `_tab`), for a single target field of type `address`, it adds "Address field settings > Subfields". The checkboxes list the address subfields not hidden by the field's overrides, and are visible only when the state is `required`. It saves to the dependency settings as `cf_address_required_subfields`.
- Its submit handler also changes the field config: each selected subfield's `field_overrides[<subfield>].override` becomes `optional`, so it's only required through the condition. A comment says this is automatic.
- `rootFormAfterBuild()` runs on every content entity form. It reads the `default` form display's conditional_fields settings, and for address fields with `state: required` and subfields it moves `#states['required']` from the wrapper to `widget[0]['address'][<property>]`.
- Dependencies declared: `address`, `conditional_fields`. The validator also uses `office_hours` classes, which is not declared. Composer patch `conditional_fields-3507266-4.patch` ("Empty action sets field value to undefined") is applied to the contrib module (`composer.json`).

### cf_dependent_entity_reference

1. A field's selection handler is set to "CareerForce Dependent Entity Reference: Views by parent field". The settings add a required "Parent field", chosen from the other entity reference fields on the bundle.
2. `DependentEntityReference::getDisplayExecutionResults()` reads the parent field's target IDs from `$this->configuration['entity']`, joins them with commas and prepends them to the view arguments.
3. `FormHooks::formAlter()` wraps each dependent field in `div#cf-der-<field>-wrapper`. It recursively adds `#ajax` (events `change autocompleteclose`) to the first input-like element of the parent field. `updateChild()` returns `ReplaceCommand`s for every dependent field. It unsets `#group` first because of a field_group conflict (drupal.org issue 3201653).
4. `DependentOptionsSelectWidget` rebuilds options from `$form_object->buildEntity()` on every build, so they reflect unsaved input. It also clears the cached `$this->options`.
5. `DependentOptionsSelectPreviewWidget` adds:
   - preview settings: title, current-field view mode, parent-field view mode, "Render parent when empty";
   - clearing the value when the parent field triggered the rebuild (`shouldReset()`);
   - a preview. Fallback order when empty: the `location` of the session in `asid`/`hsid`, then the parent field entities.
6. `ViewsSelectWidget` is independent of the selection handler. It executes a chosen entity-reference Views display with no limit, and resolves arguments such as `@route:civiserv_location`.

Fields using the handler (from `config/sync/field.field.*`):
- `appointments_session`/`appointments_occurrence`: `field_staff_member`, `field_meeting_location`
- `happenings_session`/`happenings_occurrence`: `field_facilitators`, `field_moderators`, `field_locations_alternate`
- `service_record`: `field_staff_member`, `field_meeting_location`

For example, `field_staff_member` uses the view `careerforce_member_location_admin_user_entity_reference:group_members_by_location` with parent field `location`. `cf_views_select` is used in the bulk-edit form displays `appointments_occurrence.bulk_edit` and `happenings_occurrence.bulk_edit_staff_member`.

### contact_field

- `preferred_contact`: columns `preferred_contact_method` (64), `email` (255), `phone_number` (ascii 32). The field is empty if there is no method, or if the value for the chosen method is missing. The widget uses `#states` to show email or phone based on the select. The formatter outputs `.preferred-contact__method` and `.preferred-contact__info--email|--phone`, with the phone formatted through `PhoneFormatter`.
- `ten_digit_us_phone`: columns `phone_number` (ascii 32), `extension` (ascii 10). The widget limits the phone to 10 characters and the extension to 5, and validates against format `xxxxxxxxxx`. The formatter setting `phone_number_format` defaults to `(xxx) xxx-xxxx` and appends ` ext: <n>`. No field storage of this type exists in `config/sync`.

### element_tooltip

- Field widgets: `hook_field_widget_third_party_settings_form` adds "Tooltip text" (text_format), stored as `third_party_settings.element_tooltip.element_tooltip_text`. `hook_field_widget_single_element_form_alter` attaches `#element_tooltip` to `$element['value']`, or to the element itself for datelists and composite widgets.
- Theme suggestions `form_element__element_tooltip`, `fieldset__element_tooltip` and `datetime_wrapper__element_tooltip` render the tooltip. `element-tooltip.html.twig` outputs a `<button aria-label="Show tooltip for: <label>" aria-describedby="element-tooltip-<field>">` and a `role="tooltip"` div whose text is processed with the stored format (default `plain_text`).
- Views: the field handler config form gets "Field label tooltip". `hook_preprocess_views_view_fields` renders the tooltip into `label_suffix` when the field has no suffix.

### cf_webform_access

- `hook_webform_access_rules` registers `duplicate_any` and `duplicate_own`.
- `hook_webform_submission_access` returns forbidden for operation `duplicate` unless `checkWebformSubmissionAccess('duplicate', ...)` allows it through those rules or the webform's `administer` rule. A docblock explains this also overrides the global `administer webform` / `administer webform submission` permissions.
- The route subscriber makes the admin duplicate route check `duplicate` access instead of only `update`.

## Configuration and permissions

- Conditional field address subfields: Manage form display > Dependencies (contrib UI).
- Dependent reference: field settings (selection handler, parent field) and form display (widget, preview settings).
- Tooltips: Manage form display > widget settings, or Views UI > field > "Field label tooltip".
- Webform duplicate: each webform's Access tab. Only `webform.webform.external_event` lists the keys, with empty roles, users and permissions, so nobody is granted it.

## Related

- ../events/, ../appointments/, ../services/: forms using dependent references and address conditions
- ../accounts/: connections (`field_preferred_contact`), career seeker profile tooltips
- [bulk-operations.md](../content-authoring/bulk-operations.md): bulk-edit form modes that use `cf_views_select`
