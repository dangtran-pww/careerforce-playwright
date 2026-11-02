# Office hours time format

Location and group pages show their opening hours with the contrib `office_hours` field. Module `cf_office_hours` adds one extra choice to that field's formatter: **"12 hour time, uppercase AM/PM (9:00 AM)"** (PHP format `g:i A`). Site builders use it, and the public sees the result wherever office hours are displayed.

## What users see

- Public: hours rendered like `9:00 AM - 5:00 PM` on displays configured with the new format.
- Site builders: the extra option in the formatter's **Time notation** select. It appears both in Field UI "Manage display" and in Layout Builder's "Configure block" for a field block.

Displays that use `time_format: 'g:i A'` in `config/sync` include:

- `core.entity_view_display.civiserv_location.{careerforce_location,statewide_or_virtual,partner_or_employer,partner_statewide_virtual}.default`, plus the `card` view modes for the two partner bundles
- `core.entity_view_display.group.{community_partner,employer,workforce_center}.default`
- `core.entity_view_display.happenings_occurrence.happenings_occurrence.teaser`

The `office_hours` fields are `civiserv_location.field_hours`, `group.field_weekly_hours` and `node.field_program_dates` (`config/sync/field.storage.*`).

## How it works

`FormHooks` only adds a select option. Formatting itself is done by `office_hours`, which takes the option key as a PHP date format.

- `form_entity_view_display_edit_form_alter`: on the Manage display form, appends `extraTimeFormats()` to every field's `settings_edit_form.settings.time_format.#options`.
- `form_layout_builder_configure_block_alter`: adds `#process` callback `processFieldBlockFormatterSettings` to `settings.formatter`. The formatter settings are built late inside the Layout Builder field block form, so the option can only be added from a process callback.
- `extraTimeFormats()` returns `['g:i A' => '12 hour time, uppercase AM/PM (9:00 AM)']`.

## Configuration and permissions

None of its own. To use the format, pick it in the formatter settings and export the display config.

## Related

- [../locations/](../locations/): locations and groups that show hours
- [../events/](../events/): event occurrence teaser
