# CKEditor plugins: Accordion Item and Anchor/Jump Link

We ship two custom CKEditor 5 plugins for the Basic HTML and Full HTML text formats. **Accordion Item** (`cf_accordion_item_ckeditor`) lets editors build collapsible accordion groups inside body text, rendered on the front end through the theme's `sdc-accordion-item` component. **Anchor/Jump Link** (`cf_jumplink_ckeditor`) lets editors turn selected text into an in-page anchor with an ID made from the text, so other links can jump to it. Content editors use both.

## What users see

**Editors (node/block edit forms, Basic HTML or Full HTML):**

- Toolbar button **Accordion Item** inserts a group containing one item. The item has an editable header (default text "Header") and a content area (default "Content Slot") that accepts anything the root allows. In the editor, a group is a widget `div.cf-accordion-group` holding `<details class="cf-accordion-item">` with a `<summary>` header.
- A widget toolbar on an accordion has **Insert item above**, **Insert item below** and **Delete item**.
- Toolbar button **Jump Link** (tooltip "Jump Link") opens a balloon with a "Jump Link" switch and Save/Cancel. When text is already marked, the balloon shows **Unlink** and **Edit link**. In the editor, marked text has a dashed blue border and an anchor icon (`css/jumplink_item_editor.css`).

**Site visitors:**

- Accordions render as the `careerforce_skin:sdc-accordion-item` component (`<details>/<summary>`), wrapped in `div.cf-sdc-accordion-group`.
- Jump-link text renders as `<span id="<slug>" linkattributeid="...">text</span>`, which can be the target of `#<slug>` links.

Both toolbar buttons are in `config/sync/editor.editor.basic_html.yml` and `editor.editor.full_html.yml`. Both filters (`accordion-item`, `cf-anchor-jump-link`) are enabled in `filter.format.basic_html.yml` and `filter.format.full_html.yml`, and in no other format.

## How it works

### Accordion Item

Stored markup (data downcast) uses custom tags:

```html
<cf-accordion-group>
  <cf-accordion-item>
    <cf-accordion-item-header>Header</cf-accordion-item-header>
    <cf-accordion-item-content><p>Content Slot</p></cf-accordion-item-content>
  </cf-accordion-item>
</cf-accordion-group>
```

- Model schema: `accordionGroup` (object, allowed where a block is), `accordionItem` (object, inside a group), `accordionItemHeader` (limit, `$block` content), `accordionItemContent` (limit, `$root` content).
- Editing-view quirks handled in `accordionitemediting.js`:
  - On blur of a `<summary>`, it re-inserts the summary's HTML with zero-width spaces stripped.
  - On keydown of Space inside a `<summary>`, it inserts a space through `insertText` and stops the event, because a native space toggles `<details>`.
- `AccordionItem::process()` (filter, weight 100):
  1. Replaces each `<cf-accordion-group>` with `<div class="cf-sdc-accordion-group">`.
  2. For each `<cf-accordion-item>`, extracts the inner HTML of the header and content tags with regexes.
  3. Builds `['#type' => 'component', '#component' => <configured component>]`, mapping props and slots by the settings `component_settings.props.<prop> = header|content` and `component_settings.slots.<slot> = header|content`. The current config maps prop `header` to header and slot `content` to content.
  4. Renders in its own render context, merges bubbleable metadata, and swaps the node for the rendered HTML.
  5. Attaches library `cf_accordion_item_ckeditor/accordion_item_style`.
- Settings form at `/admin/config/content/cf_accordion_item_ckeditor` (permission `administer filters`): pick any SDC component, then for each prop (except `attributes`) and slot choose None, Header or Content. The component select rebuilds the mapping section by AJAX.

### Anchor/Jump Link

- The model allows `linkattributeid` and `linkid` attributes on `$text`, plus an inline object `linkAttribute`, the placeholder used when the selection is collapsed.
- With text selected, the "Jump Link" command sets `linkattributeid` on the range and `linkid = linkAttributeSlugify(selectedText)`. The slug is NFKD-normalised, lower-cased, uses hyphens for spaces and underscores, and strips non-word characters. Upcast reads `<a linkattributeid>` and `<a linkid>` back.
- `LinkAttribute::process()` finds `//a[@linkattributeid]` that also has a non-empty `linkid`. It creates a `<span>`, copies children and attributes, sets `id` to the `linkid` value and removes `linkid`. It attaches `cf_accordion_item_ckeditor/accordion_item_style`, the accordion module's library, which looks like a copy-paste leftover.
- `cf_jumplink_ckeditor.info.yml` depends on `pww_module:pww_module_jump_link_menu`, which comes from the PWW composer package `portlandwebworks/pww_module` and is not in this repo export. It is enabled in `core.extension.yml`. Given the name, it appears to build a jump-link menu from these anchors. I could not verify this.

## Configuration and permissions

- Text format and editor config: `/admin/config/content/formats` (Basic HTML, Full HTML).
- Accordion component mapping: `/admin/config/content/cf_accordion_item_ckeditor`, config `cf_accordion_item_ckeditor.settings`.
- JS builds: each module has its own `package.json` and `webpack.config.js` (`npm run build`). The built files under `js/build/` are committed.

## Related

- ../miscellaneous/theme-overview.md: `sdc-accordion-item` component and utility styles
- [content-blocks.md](content-blocks.md): `cf_anchor_link_block` for skip links outside body text
