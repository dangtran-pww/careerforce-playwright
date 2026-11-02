# CareerForce content blocks

The main `careerforce` module provides general-purpose block plugins that site builders place through the Block UI, Layout Builder or Page Manager. They cover skip links, link lists, newsroom search, per-profile quick links, vocabulary descriptions, an embedded entity edit form, flag links, a GovDelivery subscribe button, a Register To Vote badge, and a Views exposed-filter block whose fields can be arranged in a layout. Site builders configure them; site visitors see their output.

Blocks for jobs, events, appointments and regions in the same folder (for example `JobSearch*Block`, `FeaturedCareersByIndustryBlock`, `RegionalTeamBlock`, `EventsAppts*Block`) are covered in other KB areas.

## What users see

| Block (admin label) | Plugin ID | Where it is placed in `config/sync` | What it renders |
|---|---|---|---|
| Anchor Link | `cf_anchor_link_block` | `block.block.careerforce_skin_anchorlink` ("Anchor Link - Event Search"), region `pre_content`, route `view.content_search.events_search` (`/education-and-training/events`) | A link to `#<anchor_id>` with text "Skip to event search results", visually hidden |
| Newsroom Article Search | `newsroom-article-search` | `block.block.newsroomarticlesearch`, region `sidebar_second`, on `article` nodes | GET form with Keyword, Audience, Industry, Region that submits to `/careerforce-blog` |
| Configurable Links | `cf_configurable_links` | `block.block.careerforce_skin_configurablelinks` ("Events and Workshops Top Links"), `pre_content`, events search route | Optional `<h2>` intro ("What are you searching for today?") and a `<nav>` list of links |
| Quick Links | `careerforce_quick_links_block` | Page Manager `default_dashboard` (`/user/{user}`) variants | A menu (depth 2) chosen by the user's profile type, for example `career-seeker-quick-links` |
| Taxonomy Vocabulary | `careerforce_taxonomy_reference_block` | no placement found | The description of a chosen vocabulary |
| Entity Edit Form Block | `entity_edit_form_block` | Page Manager `user_account_settings` (`/user/{user}/account-settings`), entity = user, form mode `account_settings` | The context entity's edit form in a chosen form mode |
| Flag Action Block | `flag_action_block` | no placement found | Flag links for the current node |
| GovDelivery Subscribe | `govdelivery_subscribe` | no placement found | A "Subscribe Now" button to a GovDelivery topic |
| Register To Vote | `register_to_vote` | `block.block.registertovote`, region `attribution` | Two image links: mn.gov portal and the Secretary of State voter registration page |
| Views Exposed Filter Block (configurable layout) | `cf_configurable_views_filter_block_block:<view>-<display>` | Events search and "Schedule an appointment" sidebars (`block.block.careerforce_skin_exposedformcontent_searchevents_search*`, `...book_an_appointmentpage_1_3`), layout `event_search_sidebar` | A view's exposed form with its elements arranged in layout regions |

"No placement found" means `config/sync` has no block config entity or Layout Builder/Page Manager component for that plugin. The block may still be placed in per-entity Layout Builder overrides, which live in content, not config.

## How it works

**AnchorLinkBlock.** Config: `anchor_link_text` (default "Skip to main content"), `anchor_id`, `hidden_link`. Builds `Url::fromUserInput('#'.$anchor_id)`. When hidden, it adds the classes `visually-hidden focusable`. The link text goes through `$this->t()`.

**ArticleSearchBlock / NewsroomArticleSearchForm.** The block builds the form with GET method and caching disabled. The form removes `form_id`, `form_build_id` and `form_token` in `#after_build` so the URL stays clean. Fields `search_api_fulltext`, `field_target_audiences` (vocabulary `audience`), `field_industry` (`industry`) and `field_economic_region` (`region`) default to `All`. `#action` is hard-coded to `/careerforce-blog`, the `views.view.article_content` page. `submitForm()` is intentionally empty.

**ConfigurableLinksBlock.** The block form has "Intro text" plus an AJAX "Add another link" button. Each link has a URL and text. Empty rows are dropped on submit. When building, `getProcessedLinks()` turns each URL into a `Url`:
- strings containing `://` or starting with `//` go through `fromUri`;
- strings starting with `internal:` or `entity:` go through `fromUri`;
- strings without a leading `/` get one prepended and go through `fromUri`;
- otherwise `fromUserInput`.

Invalid URLs are skipped silently. Routed URLs are access-checked for the current user, and links the user can't reach are hidden. Cache tags, contexts (plus `user.permissions`) and max-age merge the access results. If no links remain, the block renders nothing.

**QuickLinksBlock.** Takes a `user` context. If the context is empty it falls back to the current user. It reads `field_extended_profile_type` on the account to pick a menu from `quick_links_menu[<profile_type>]`, falling back to `default`. It loads the menu tree with max depth 2 and runs the core access manipulators plus `checkUserAccess()`, which re-checks each routed link with `user` set to the viewed account. `blockAccess()` allows the block only when the route's `{user}` is the viewing account. Cache: tag `user:<id>`, context `route`. The block form lists every `profile_type` plus "Default" with a menu select each.

**TaxonomyReferenceBlock.** The form has an entity-autocomplete for `taxonomy_vocabulary`. `build()` renders `['#markup' => $vocabulary->getDescription()]`.

**EntityEditFormBlock.** Needs an `entity` context and a required "Form Mode" text field. `blockAccess()` forbids access unless the entity is fieldable and the user has `update` access. `build()` returns nothing in preview mode, otherwise `entityFormBuilder->getForm($entity, $form_mode)`. A comment points to `\Drupal\cf_resume\Entity\Resume` for the whitelist of form modes.

**FlagActionBlock.** Takes a `node` context. The config `flags_to_display` is a checkbox list of all flags. `build()` keeps only flags that apply to the node's bundle (`getAllFlags('node', bundle)`) and builds each with `flag.link_builder`. The output order is reversed. Max-age is 0 and the cache context is `url.path`.

**GovDeliveryBlock.** The URL is `https://public.govdelivery.com/accounts/MNDEED/subscriber/new?topic_id=` followed by the "GovDelivery code" setting (default `MNDEED_`). The link has classes `button button-primary govdelivery-link`. The default `link_text` is "Subscribe Now".

**RegisterToVoteBlock.** Renders the `register_to_vote` theme hook. The template is in the theme, and both images open in a new tab with `rel="noopener nofollow"`.

**CfConfigurableViewsExposedFilterBlock.** Uses the core `ViewsExposedFilterBlock` deriver, so there is one plugin per view display with exposed filters. Added settings:
- `layout`: any core layout plugin.
- `region_mapping`: one select per exposed element (filters, submit, reset, sort_by and sort_order, items_per_page and offset), shown only when the element is visible under "visible_filters" and the "no_reset/no_sort/no_pager" options.
- `submit_text`: optional override, behind "Override submit button text".

At render time each mapped element is copied into its region with `$layout->build($regions)` and the original is hidden with `#access = FALSE`. Lookup order is `$build[$name]`, then `$build[$name.'_wrapper']`, then `$build['actions'][$name]`. If the layout is missing or not defined, the parent output is returned unchanged.

## External services and integrations

- GovDelivery (MN DEED account `MNDEED`). The URL base is a class constant in `GovDeliveryBlock`.
- Register To Vote links go to `https://mn.gov/portal/` and `https://www.sos.state.mn.us/elections-voting/register-to-vote/`.

## Configuration and permissions

- All are standard block plugins. Settings live in block config, Layout Builder components or Page Manager variants.
- Quick Links menus are ordinary menus. The `career_seeker` mapping points to `career-seeker-quick-links`.
- No config split differences.

## Related

- [layout-builder-block-styling.md](../miscellaneous/layout-builder-block-styling.md): styling options for these blocks
- [navigation-and-url-aliases.md](../miscellaneous/navigation-and-url-aliases.md): Toolshed menu navigation block
- ../events/, ../appointments/: the search views the exposed-filter block serves
- ../accounts/: user dashboard and account settings pages
