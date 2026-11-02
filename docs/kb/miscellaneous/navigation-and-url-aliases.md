# Navigation, breadcrumbs and industry/region URL aliases

This covers the code that decides where a page sits in the site navigation and what URL it gets:

- `toolshed_menu`, a PWW module in `web/modules/custom`: menu-based breadcrumbs, a "Menu Navigation" block, a menu active-trail override, and a per-bundle "virtual menu position" setting.
- The `careerforce` module's two breadcrumb builders, for taxonomy terms and CiviServ locations.
- The `careerforce` pathauto alias type that gives industry and region combination pages URLs like `/industry/<industry>/<region>`.

Site builders configure these. Visitors see the breadcrumbs, side menus and URLs.

## What users see

- **Breadcrumbs** on most front-end pages: "Home > menu parents > current page title". With `include_title: true` (current config), the current page title is appended as unlinked text, except on admin routes, on pages the user can't access, and on `entity.page.edit_form`.
- **Taxonomy term pages** (`entity.taxonomy_term.canonical`) with no menu match: "Home > <term>".
- **CiviServ location pages** (`entity.civiserv_location.canonical`) with no menu match: "Home" only.
- **Menu Navigation blocks** (`toolshed_menu_navigation`):
  - "Private Page Menu Block" (`block.block.toolshedmenunavigationblock_2`): sidebar_second on `private_page` nodes; menu `staff-partner-only-resource`; full menu, depth 3, collapsible; resolver `entity_route_menu_resolver`.
  - "Mobile Menu Navigation" (`block.block.toolshed_menu_navigation_mobile`): region `mobile_nav`; menus `secondary-footer`, `header-utility-navigation`, `main`; "Show trail with siblings", depth 2; resolver `default_menu_resolver`.
- **Bundle Menu Trail** on content type, media type and vocabulary edit forms. You pick a menu position for each menu, and pages of that bundle behave as if they sat under that link, without a real menu link. Only `node.type.article` sets one, a link in `header-utility-navigation`. Other bundles store an empty `entity_menu`.
- **Industry and region pages**: `/taxonomy/term/{industry}/{taxonomy_term}` (route `careerforce.region.industry`, controller `IndustryRegionController::view`) gets the alias `/industry/<industry name>/<region name>`.
- **Admin**: `/admin/config/user-interface/toolshed-breadcrumbs` ("Toolshed Menu Breadcrumb", permission `administer site configuration`).

## How it works

### Breadcrumb precedence

Drupal asks builders in priority order. `toolshed_menu.breadcrumb` (10) runs first. It applies only when the configured resolver finds a menu link for the current route in the configured menus: `main`, `header-utility-navigation`, `policy-guidance`, `primary-footer`, resolver `default_menu_resolver`. If it doesn't apply, the careerforce builders (5) handle term and location pages, then core's path-based builder. `toolshed_menu_system_breadcrumb_alter()` runs after whichever builder won and appends the title when `include_title` is on.

Toolshed's `build()`:
1. Adds "Home", unless on the front page.
2. Loads parent menu items by mlid from `menu_tree`.
3. Batch-loads `menu_link_content` entities by UUID to get translated titles and URLs. Other links use their route or URI.
4. Adds cache contexts `languages` plus the resolver's contexts and tags.

### Menu resolvers

- `DefaultMenuResolver::resolve()` loads `menu_tree` rows by route name and sorted raw params. Links that have a query in their options win only if their query is a subset of the request's query. Otherwise links without a query are used. Ties go to the first menu in priority order (`determineMenuItem()`).
- `EntityOrRouteMenuResolver` handles `entity.<type>.canonical` routes. It reads the bundle's `toolshed_menu.entity_menu[<menu>]` link ID and loads that item, falling back to the default resolver. Cache tag: `<bundle_entity_type>:<bundle>`.
- `ActiveTrailDecorator::getActiveLink()` always uses `default_menu_resolver` with the request query, so menu active classes respect query-string links. If nothing matches it returns `NULL`.

### Menu Navigation block

`build()` resolves a link in the enabled menus and computes the active trail and a "rooted" trail from the per-menu root settings. It then builds the tree with the chosen style ("Show trail to root", "Show trail with siblings", "Show full menu") and applies `checkAccess` and `generateIndexAndSort`. Other options: exclude root siblings, minimum depth, max tree height, collapsible. Errors are logged to channel `toolshed_menu` and the block renders nothing.

### Industry/region aliases

- `IndustryRegionAliasType` applies to `industry` terms. `createAlias()` builds source `/taxonomy/term/<industry>/<region>` and alias `/industry/[industry:name]/[region:name]`, using hard-coded replacements because, per the code comment, core does not support two tokens of the same type. It cleans the alias with pathauto, uniquifies it (with a message on conflict), honours `pathauto.settings:update_action` "no new", and saves through `pathauto.alias_storage_helper`.
- `careerforce_taxonomy_term_update()`/`_insert()` call `updateTaxonomyAlias()` for every saved term. For a region term it regenerates aliases for all industries times that region. For an industry term it does that industry times all regions, for every translation of the industry. Exceptions are logged to channel `careerforce`.
- The pattern config `pathauto.pattern.industry_region` (`/industry/[term:name]/[term:name]`) mainly enables the type. The real format is hard-coded.

## Configuration and permissions

- Breadcrumb settings: `/admin/config/user-interface/toolshed-breadcrumbs` (`administer site configuration`). Excluded menus: `admin`, `tools`, `devel`.
- Menu navigation block settings live on each placed block.
- Bundle Menu Trail is on the bundle edit forms (`administer content types`, and so on).
- Pathauto: `/admin/config/search/path/patterns`. Bulk generate: `/admin/config/search/path/update_bulk`.
- No config split differences.

## Related

- [content-blocks.md](../content-authoring/content-blocks.md): Quick Links block (menu by profile type)
- theme-overview.md: breadcrumb and menu templates and styling
- ../jobs-and-careers/: industry/region pages (`IndustryRegionController`, `IndustryRegionMapBlock`)
- ../locations/: CiviServ location pages
