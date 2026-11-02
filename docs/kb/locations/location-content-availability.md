# Location content availability

A group such as a CareerForce Location or a Partner owns content: `service` and `training_program` nodes, added to the group as group relationships. "Content availability" controls **which of the group's physical locations** each piece of content is offered at. It can also bring in content shared through **provider networks**. Location managers and account managers use two forms: one per piece of content ("make this available at these locations") and one per location ("make this content available here"). Public location pages then list the content assigned to each location.

## What users see

| Path | Form / block | Purpose |
|---|---|---|
| `/group/{group}/content/{group_relationship}/availability` | `ContentLocationAvailabilityForm` ("Manage Content Availability") | Heading "Make %content available to these locations." One checkbox per location of the group; unpublished locations get " (unpublished)". "Update Availability" saves; "Cancel" returns to `/group/{group}/content`. |
| `/group/{group}/location/{civiserv_location}/content/availability` | `LocationContentAvailabilityForm` | Heading "Make content available to %location." Checkboxes for the group's own content, grouped by node type, and an "Available from Provider Networks" list. Saves back to `/group/{group}/location/{location}/content`. |
| `/node/*` | Block `group_content_availability_block` ("Manage Content Availability" button, `block.block.managecontentavailability`) | On a group-owned node, links to the per-content form. Hidden when the user lacks access. |
| `/group/*/location/*/content` | Block `shared_location_content` (`block.block.sharedlocationcontent`) | Heading "Shared Content" plus the `location_shared_content:block_1` view, only when that view has results. |
| Group content list and location list | "Manage Availability" entity operation | Added by `careerforce_entity_operation()` on `group_relationship` rows for `group_node` plugins, and on `civiserv_location` rows. |

Saving a `training_program` node created from within a group redirects to the per-content availability form (`careerforce_training_program_redirect_submit()`).

## How it works

### Data model

- A group's content is a `group_relationship` of a `group_node:*` type, for example `group_content_type_a5ec24b39f1f1` (workforce_center ↔ service).
- Availability is stored on that relationship's multi-value `civiserv_location` field (a civiserv base field). It lists the location IDs where the content is offered.
- A location belongs to a group through `civiserv_location.civiserv_provider`.
- Shared content from a **provider network** is stored differently. The network's member groups can see content whose relationship's `provider_networks` field references the network. Making it available at a location creates a `network_lease` entity of type `group_locations` through `provider_network.network_lease_manager` (`createLocationLease()` / `removeLocationLease()`). These come from the civiserv submodule's `provider_network` module.

### Access (`LocationContentAvailabilityAccessCheck::access()`)

The route requirement names the parameter to check: `civiserv_location` or `group`. Access is granted when the first of these matches:
1. The global permission `administer civiserv settings` **or** `administer civiserv location entities`.
2. The group permission `assign content to any civiserv location`.
3. The member has group permission `assign content to member civiserv locations`, **and**:
   - **with a location in the route:** that location is in the membership's `civiserv_location` or `field_primary_location`;
   - **without one (per-content form):** the membership has non-empty `civiserv_location` **and** non-empty `field_primary_location`. As written, both must be set.

Results vary by `user.group_permissions` and depend on the membership and location entities.

### Per-content form (`ContentLocationAvailabilityForm`)

`getGroupLocations()` returns:
- all the group's locations, for civiserv admins or members with "any location";
- otherwise only the locations on the member's `field_primary_location` / `civiserv_location`.

On submit, locations the user **cannot see are kept unchanged**. Only the visible checkboxes are applied. Then the relationship is saved.

### Per-location form (`LocationContentAvailabilityForm`)

- Lists every `group_node` relationship in the group (`accessCheck(TRUE)`), grouped by relationship type. A checkbox is ticked when the location ID is in the relationship's `civiserv_location`.
- On submit, it adds or removes this location on each relationship and saves only the changed ones.
- For network content (`getNetworkNodes()`: published provider networks the group is a member of), it creates or removes the lease for each checkbox. Then it invalidates cache tag `network_lease_list`.
- A code comment notes a TODO: network content is not filtered to published entities.

### Blocks

- `GroupContentAvailablityBlock::availabilityUrl()`:
  1. Finds the group from the node's `civiserv_provider` field, else its `group` field.
  2. Finds the node's group relationship in that group.
  3. Builds the per-content route URL.
  
  `blockAccess()` uses `Url::access()`, so the button follows the access check above. Cache contexts: `user`, `route`.
- `SharedLocationContentBlock` passes the raw route parameters `group` and `civiserv_location` to `location_shared_content:block_1`. It is cache-tagged `network_lease_list`, so saving the per-location form refreshes it.

## External services and integrations

None.

## Configuration and permissions

- Global: `administer civiserv settings`, `administer civiserv location entities` (civiserv). `user_manager` and `content_moderator` have the latter in sync.
- Group permissions (defined by civiserv):
  - `assign content to any civiserv location`: granted to the account and content management outsider roles and the internal account manager roles across group types, among others.
  - `assign content to member civiserv locations`: granted to the location manager roles (`workforce_center-moderator`, `community_partner-moderator`) and the account management roles.
- Block visibility uses request paths (see the table above).

## Related

- [location-groups-and-memberships.md](location-groups-and-memberships.md)
- [location-announcements.md](location-announcements.md)
- [../content-authoring/](../content-authoring/) (service and training program nodes), [../appointments/](../appointments/), [../services/](../services/)
