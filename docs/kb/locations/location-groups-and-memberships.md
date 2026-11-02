# Location groups, memberships and the membership audit log

CareerForce models organizations as Drupal **groups**: CareerForce Locations (workforce centers), partners, employers, Adult Basic Education hotlines and others. Each group can have physical **locations**, which are `civiserv_location` entities linked to the group through their `civiserv_provider` field. Staff and partners become group members, and a membership can be tied to specific locations. This doc covers the group structure as configured, our small custom additions around memberships and group pages, and the audit log of membership changes.

The `civiserv_location` entity, the location group permissions and the provider networks come from the `civiserv` git submodule, which is not in the master export. They are mentioned here only where our code uses them.

## What users see

- **Group page** `/group/{group}`: the full view mode adds:
  - an embedded "services by group" view (`programs_services:by_group`);
  - training programs (`training_programs:block_3`);
  - for `careerforce_system` groups only, private page content (`private_content:private_page_content_block`).
- **"Back to Group" button** (block `back_to_group_block`, placed as `block.block.backtogroup` in `content`) on:
  - `/group/*/location/*`
  - `/group/*/location/*/*`
  - `/node/*`
  
  It links to the group from the route, or from the node's `civiserv_provider` or `group` field. It shows only when the viewer can view that group.
- **Add or edit group member form** (`entity.group_relationship.add_form` with plugin `group_membership`, and the edit form for memberships): the group roles field description reads "Leave both boxes unchecked if this user will only need to manage their assigned connections."
- **Location page** (`entity.civiserv_location.canonical`): the breadcrumb is just "Home" (`LocationBreadcrumbBuilder`).
- **Group Membership Log** `/admin/reports/group-membership-log` (view `group_membership_log`, roles `site_admin` and `system_admin`): who added or removed which member, in which group, and when.

## How it works

### Group types and relationships (config)

| Group type | Label | Can contain |
|---|---|---|
| `workforce_center` | CareerForce Location | members, `service` nodes, `training_program` nodes |
| `community_partner` | Partner | members, `service` nodes, `training_program` nodes |
| `employer` | Employer | members, `service` nodes |
| `careerforce_system` | Staff & Partner Only | members, `private_page` nodes |
| `careerforce_admin` | CareerForce.MN.gov Account Management | members |
| `adult_basic_education` | Adult Basic Education ("Literacy Hotlines") | members |
| `training_provider` | Training Provider (ETPL) | members |

Group roles follow one pattern per type:
- **Outsider roles** sync from global roles: "CareerForceMN.com Account Management" ← `user_manager`, "… Content Management" ← `content_moderator`, "… System Management" ← `site_admin`, and so on.
- **Insider roles** for the same global roles: "Internal Account Manager", "Internal Admin".
- **One individual role per type:** "CareerForce Location Manager" (`workforce_center-moderator`) and "Partner Location Manager" (`community_partner-moderator`).

### Member locations

Memberships of `workforce_center` (`group_content_type_10b87285f9336`) and `community_partner` (`group_content_type_dca79e84b1a94`) have `field_primary_location`, a single `civiserv_location`.

Our access code also reads a multi-value `civiserv_location` field on memberships and content relationships. It is not in `config/sync`. It is a base field defined in the civiserv submodule's `civiserv.module`, which the php83 checkout shows.

`careerforce.settings:group_relationship.primary_location_field` maps the workforce_center membership type to `civiserv_location`. The other types are empty.

`LocationAssignmentAccessCheck::checkAccess($location, $account, $perm)` grants access when either:
- the user has `$perm` in the location's group, or
- the user has `"$perm for assigned locations"` **and** their membership's configured location field references that location.

The result is always cacheable per user, location, group and membership. On routes it returns forbidden rather than neutral. It is used by `cf_appointments` routes and `cf_service` access hooks; see [../appointments/](../appointments/), [../services/](../services/).

### Membership audit log (careerforce_group_membership_audit)

- `hook_group_relationship_insert` and `hook_group_relationship_delete`: when the relationship plugin is `GroupMembership` and the related entity is a `User`, `GroupMembershipLogger::writeDb()` inserts a row into `careerforce_group_membership_audits`:

  | Column | Meaning |
  |---|---|
  | `lid` | Serial ID |
  | `membership_id` | Membership relationship ID |
  | `member_uid` | The member |
  | `admin_uid` | The current user making the change |
  | `group_id` | The group |
  | `operation` | `added` / `removed` |
  | `modified` | Request time |

- Only additions and removals are logged. Changes to an existing membership's roles or locations are not.
- `hook_views_data` exposes the table as a Views base table with relationships to the admin and member users. `hook_views_data_alter` adds a "Membership Audits" relationship from groups.
- `careerforce_group_membership_audit_update_8101()` adds the primary key on `lid`.

## External services and integrations

None.

## Configuration and permissions

- Group roles and permissions: Group module UI at `/admin/group/types/manage/{type}/permissions`. Config lives in `config/sync/group.role.*.yml`.
- Location assignment field mapping: `careerforce.settings` → `group_relationship.primary_location_field`. No admin form for it was found in the code read.
- Membership log access: Views role access, `site_admin` and `system_admin`.

## Related

- [location-content-availability.md](location-content-availability.md)
- [location-announcements.md](location-announcements.md)
- [roles-and-account-administration.md](../accounts/roles-and-account-administration.md)
- [../appointments/](../appointments/), [../services/](../services/), [../content-authoring/](../content-authoring/)
