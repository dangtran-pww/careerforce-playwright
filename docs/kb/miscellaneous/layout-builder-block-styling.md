# Block styling and Layout Builder extras

Three small modules let site builders style blocks without custom CSS. `cf_block` adds a "top and bottom padding" option to placed blocks. `cf_layout_builder_block_configuration` adds a "Manage CareerForce attributes" dialog to Layout Builder blocks: title colour, icon, heading level and padding. `cf_ui_patterns` adds a "Basic markup" source for UI Patterns components that supports tokens. Site builders and admins configuring layouts use these.

## What users see

- **Block placement form** (`/admin/structure/block/manage/<id>`, any form with base ID `block_form`): checkbox "Apply top & bottom padding", described as "Adding a spacing 30px on top and bottom of the block". When checked, the rendered block gets the class `cf-margin-y`.
- **Layout Builder contextual link** "Manage CareerForce attributes" on every block in the Layout Builder UI. It opens an off-canvas dialog at `/layout_builder/update/cf-block-attributes/{section_storage_type}/{section_storage}/{delta}/{uuid}` with:
  - Block title attributes: Text color (Default, Green, Blue, Orange), an icon picker from the `careerforce_iconset` iconset, Icon alt text (only shown when an icon is chosen), and a Heading Selector (h2/h3).
  - Block attributes: "Apply top & bottom padding".
- **UI Patterns source "Basic markup"** (`cf_basic_html`): a text field whose value can contain tokens and is rendered into a component slot, string prop or URL prop.

Layout Builder displays that already store our attributes (`cf_component_attributes` in `config/sync`): `core.entity_view_display.taxonomy_term.industry.full`, `taxonomy_term.region.full`, `paragraph.call_to_action_split.default`. The `cf_basic_html` source is used in `core.entity_view_display.appointments_occurrence.appointments_occurrence.booking_success`, `happenings_occurrence.happenings_occurrence.registration_success` and `happenings_occurrence.happenings_occurrence.waitlist_success`.

## How it works

### cf_block

The block form alter writes `third_party_settings.cf_block.apply_top_bottom_padding` on the `block` config entity. `cf_block_preprocess_block()` loads the block by `#id`, attaches `cf_block/cf_block.style`, and adds `cf-margin-y` when the setting is on. This applies only to blocks placed through the Block UI (config entities), not to Layout Builder components.

### cf_layout_builder_block_configuration

1. `ManageComponentAttributesForm::submitForm()` stores the values on the section component as an additional property `cf_component_attributes`, then saves the layout tempstore. A code comment says this should move to third-party settings once Drupal issue 3015152 lands. Stored shape:
   ```yaml
   cf_component_attributes:
     block_title_attributes: { text_color, icon: { iconset, icon }, icon_alt_text, heading_selector }
     block_attributes: { apply_top_bottom_padding }
   ```
2. `LayoutBuilderComponentRenderArray` subscribes to `LayoutBuilderEvents::SECTION_COMPONENT_BUILD_RENDER_ARRAY` and copies the property into `$build['#cf_component_attributes']`.
3. `cf_layout_builder_block_configuration_theme_suggestions_block_alter()` puts `block__cf_layout_builder` first in the suggestions when attributes exist.
4. `cf_layout_builder_block_configuration_preprocess_block()`:
   - `text_color` adds the title class `cf-text-<color>`.
   - `heading_selector` sets `$variables['tag']`.
   - `icon` builds an `iconset_icon` render element (contrib `iconset`) with the alt text.
   - `apply_top_bottom_padding` adds `cf-margin-y`.
   The theme defines `.cf-margin-y` and `.cf-text-*` in `web/themes/custom/careerforce_skin/components/02-base/_utility.scss`.
5. The template renders `<{{ tag ?: "h2" }} class="cf-block-title">{{ icon }}{{ label }}`.

Access to the dialog uses `_layout_builder_access: 'view'`, the same as the Layout Builder UI.

### cf_ui_patterns `BasicHtmlSource`

- Prop types: `slot`, `string`, `url`. Optional `entity` context.
- `getPropValue()` runs token replacement on the setting. For a slot it returns `processed_text` with the format hard-coded to `content_html`. For string and URL props it returns a plain string that Twig autoescapes.
- In preview (a sample entity with no ID) token errors are swallowed and the value becomes empty. Outside preview they are rethrown.
- Adds a module dependency on `token` when that module is enabled.

## Configuration and permissions

- No settings forms. Block padding is set per placed block. Layout Builder attributes are set per component and saved with the layout (entity display config or per-entity override).
- Layout Builder permissions decide who sees the contextual link.
- `cf_ui_patterns.info.yml` requires `^11` and lists dependency `ui_paterns:ui_patterns` (note the misspelled project prefix).

## Related

- [content-blocks.md](../content-authoring/content-blocks.md): CareerForce block plugins you can place in Layout Builder
- theme-overview.md: the `careerforce_skin` utility classes and iconset
- ../events/, ../appointments/: the success displays that use `cf_basic_html`
