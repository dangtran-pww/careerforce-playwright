# Regional team block ("Meet Your Regional Team")

Each **Region** taxonomy term page shows a sidebar block listing the DEED regional contacts for that region, grouped by program area. Content managers maintain the contacts on one settings form. The block is not tied to Drupal groups. It is keyed by region term and program-area term.

## What users see

- **Region term pages** (taxonomy term, vocabulary `region`, full view mode): a sidebar block placed with Layout Builder in `core.entity_view_display.taxonomy_term.region.full`. Its label is "Meet Your Regional Team", and the template adds a "For Employers" heading above it.
  - Each program area with at least one named contact shows the area name, then up to two contacts: name, `mailto:` email and phone.
  - Program areas with no named contact are skipped. If the region has no saved contacts, the block is empty.
- **Admin form:** `/admin/config/careerforce/regional-team` ("Manage Regional Team Block", permission `administer regional team`).
  1. Pick the "Program Areas category" vocabulary. This loads the rest of the form by AJAX.
  2. For each region term there is a collapsible section; inside it, each program area term has "Contact 1" and "Contact 2" with name, email and phone.
- The block's own configuration form links to the admin form ("Additional Block configuration found here.").

## How it works

- **Config shape:**
  ```
  regional_contacts:
    regional_team_category: regional_team_program_areas
    regions_config:
      term-{region tid}:
        {program-area tid}:
          0: {name, email, phone}
          1: {name, email, phone}
  ```
- **Saving:** `submitForm()` stores the entire form-state values under `regional_contacts`. That is why `submit: 'Save configuration'` also appears in the stored config.
- **`RegionalTeamBlock::build()`:**
  1. Reads the region from context and looks up `regions_config['term-' . tid]`.
  2. Loads all terms of the program-area vocabulary for labels.
  3. Emits `program_areas[]`, each with `area_name` and `contacts[]` as `#plain_text` elements, under `#theme => regional_team_block`. The block wrapper template prints `content.program_areas`.
- **Caching:** no custom cache metadata. The block relies on Layout Builder and block defaults; the config object is not added as a cacheable dependency, so this is an inference: a contact edit may need a cache clear before it shows.

## External services and integrations

None.

## Configuration and permissions

- `administer regional team`: `site_admin`, `content_moderator`.
- The contact data lives in **synced config** (`config/sync/careerforce_config.regional_team.yml`), and `config_ignore` only ignores `google_tag.container.gtm`. Edits made on an environment through the form are likely to be overwritten by the next config import, unless they are exported back into the repo. This is an inference from the config setup.

## Related

- [location-groups-and-memberships.md](location-groups-and-memberships.md)
- [../content-authoring/](../content-authoring/) (region pages and Layout Builder), [../miscellaneous/theme-overview.md](../miscellaneous/theme-overview.md)
