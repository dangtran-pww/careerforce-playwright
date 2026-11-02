# Event search and detail pages

The public side of events: the **Events** search page at
`/education-and-training/events`, the occurrence detail page, and the
"upcoming events" style blocks on other pages. The search lists CareerForce
event occurrences and approved external events from one Solr index, with
keyword, distance, topic, format, type and date filters. This doc covers the
event-specific code; general site search is owned by other docs.

## What users see

- `/education-and-training/events`: view `content_search`, display
  `events_search` (Search API index `general_site_content`). Exposed filters
  and their query keys:

  | Key | Filter |
  |---|---|
  | `fq` | Event Name (full text) |
  | `fp` | From (distance from a location; 10–100 mi options; `mapkit_location_filter`) |
  | `ft` | Topic |
  | `ff` | Format |
  | `fy` | Type |
  | `fs` / `fe` | Date From / To |
  | `fa` | Featured statewide event |

  The page also has a sort select (`cf_sort_select` BEF plugin, area plugin
  `cf_happenings_sorts`) and "Filters"/"Reset" buttons (block
  `cf_events_search_buttons`).
- Other displays of the same view: `upcoming_events` (block), `featured_event`
  (block), `block_events_by_service_location` ("Events by a location", 6 per
  page, used on location pages).
- `/events/event-occurrence/{id}` (or its alias): the occurrence `full` view
  display, built with Layout Builder. It holds event details, the
  registration buttons and status messages (see
  [event-registration-and-waitlist.md](event-registration-and-waitlist.md)),
  the "Event Full" message, and a "more like this" list (`views_block:events_mlt`,
  also on external event pages). The "Additional Times (When Full)" block is
  placed on the `registration` and `waitlist` view displays, not on `full`.
- External events (`happenings_session_ext`) have canonical pages under
  `/events/event-external/{id}` (rewritten from `/happenings/external-session/...`
  by `cf_happenings` `EntityHooks::entityTypeAlter()`), aliased to
  `/events/external/[label]`.
- Path aliases (Pathauto patterns in `config/sync`): a session is
  `<location URL>/location-events/<label>/<session id>`; an occurrence is
  `<session URL>/<occurrence id>`.
- A "Format & Catalog Item Taxonomy" pseudo-field
  (`cf_happenings_event_details`, template `cf-happenings-event-details.html.twig`)
  lists format, event type and topic labels on sessions, occurrences and
  external sessions.
- An "Events Webform CTA" block (`cf_events_webform_cta`) with heading, body,
  internal URL and link text. It is placed by
  `block.block.careerforce_skin_eventswebformcta` (and a `_mobile` copy) as
  "For Employers … Submit your event" linking to `/form/external-event`
  (see [external-event-submissions.md](external-event-submissions.md)).

## How it works

- **Datasources.** The `events_search` display filters
  `search_api_datasource` to occurrences and external sessions. It also has
  hidden filters: `field_private != 1` (private events are excluded) and the
  Display Window filter
  `happenings_occurrence_future_window_filter__happenings_session`. The
  Display Window filter adds an OR group: "not an occurrence" OR "start <= now
  + 45 days" (`OccurrenceSearchApiFutureWindowFilter::query()`), so external
  events are not limited by it.
- **Proximity.** CiviServ's location proximity processor expects CiviServ
  field names that happenings entities don't have. Instead of reimplementing
  it, `LocationProximity` adds occurrence location data to the existing
  CiviServ proximity fields, and `LocationValueAggregator` writes external
  event addresses into those same fields (both class docblocks explain why).
  Distance filtering and sorting therefore work across both datasources.
- **Inclusive end date.** `ViewsHooks::viewsPreBuild()` appends ` 23:59:59`
  to the `fe` value when it is a bare `Y-m-d` date.
- **More like this.** Search API Solr's MLT handler loads the argument ID
  from every datasource, so occurrence 30 and external session 30 would
  collide. `MltSourceEntityArgumentBase` builds the combined Search API item
  ID for one datasource; `OccurrenceMltQuerySubscriber` swaps it into the Solr
  query; `MltExcludeSameCatalogItem` removes other occurrences of the same
  catalog item.
- **Additional times.** `AdditionalTimesBlock` renders only when the current
  occurrence is full for the current user (`isRegistrationFull()`, which
  counts reservations held by other users). It shows view `happenings_occurrence`,
  display `additional_times` (other dates of the same session), and is hidden
  when that view has no results.
- **Registrant count** (`cf_happenings_registrant_count`): counts Registered +
  Attended from the Registration API. It is cached with tag
  `happenings_registrant_count:<occurrence id>`, which the attendee screens
  invalidate.

## External services and integrations

- Solr through Search API (`general_site_content`, `events_mlt`).
- Mapkit and CiviServ proximity filter for distance.
- Registration API for "full" checks and registrant counts (see
  [registration-api-integration.md](registration-api-integration.md)).

## Configuration and permissions

- Viewing occurrences needs `view happenings_occurrence`. Unpublished
  occurrences also need `view happenings_occurrence unpublished`, and query
  access hides them from listings (`OccurrenceQueryAccessHooks`).
- The display window (45 days) is in
  `happenings.occurrence_manager_settings.happenings_session:occurrence_display.display_limit_days_in_future`.
- Online label for dashboard/location fields:
  `cf_happenings.settings:happenings_occurrence.online_label` (`Online`).

## Related

- [event-content-model.md](event-content-model.md)
- [event-registration-and-waitlist.md](event-registration-and-waitlist.md)
- [external-event-submissions.md](external-event-submissions.md)
- ../content-authoring/ (general site search, Layout Builder)
- ../locations/ (CiviServ locations, location pages)
- ../miscellaneous/theme-overview.md (event card and detail templates)
