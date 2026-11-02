# Location announcements

Location and account managers can post short, time-limited notices on a group or on individual locations: holiday hours, delays, closures, severe weather and so on. The `announcement` module, a submodule of `careerforce`, provides an `announcement` content entity with group-level and location-level management pages. The active notice appears in the status area of group and location pages, and expired notices are deleted automatically by cron.

## What users see

| Path | Who | What |
|---|---|---|
| `/group/{group}/announcement` | Group announcement managers | View `announcements:page_1`: the group's announcements, with a Location filter. The filter is a select of the group's published locations, plus "- Group -" for group-level items. Local action "Add new announcement". |
| `/group/{group}/announcement/add` | Same | Add form. The Location field is a checkbox list of the group's locations. With more than one location it shows the help text "Selecting no Locations or all Locations will create a group level Announcement." |
| `/group/{group}/location/{civiserv_location}/announcement` | Location announcement managers | View `announcements:page_2`, with local action "Add new announcement". |
| `/group/{group}/location/{civiserv_location}/announcement/add` | Same | Add form with the location fixed (shown as static text). Redirects back to the location list on save. |
| `/group/{group}/announcement/{announcement}`, `/edit`, `/delete` | Managers | Canonical, edit and delete pages. |
| Group pages, status region | Public | Block `announcements` (`block.block.announcements`), visible on adult_basic_education, community_partner, employer and workforce_center groups. It shows the newest active **group** announcement, plus the newest active announcement for the location in the route. |
| Group display component "Announcement" | Public | `workforce_center` group displays can also render the active group announcement as an extra field (`careerforce_entity_extra_field_info()` / `careerforce_entity_view()`). |
| `/admin/structure/announcement/settings` | `administer announcement entity` | Field UI base route ("Manage field settings here."). |

Fields on the form:
- Administrative label
- Announcement type: Holiday, Delay, Closure, Safe measure, Before you visit, Severe weather
- Announcement text
- Start date and time
- End date and time
- Location

Validation:
- Start must be before End (`StartEndDateConstraint`).
- A location must belong to the announcement's group (`GroupLocationConstraint`).

## How it works

### Data model (`Announcement::baseFieldDefinitions()`)

| Field | Notes |
|---|---|
| `label` | Administrative label |
| `type` | list_string |
| `body` | text_long |
| `start`, `end` | datetime, stored in UTC |
| `group` | Entity reference to a group, required. Selection is limited to the `workforce_center` bundle. |
| `location` | Unlimited references to `civiserv_location`; widget `civiserv_provider_entity_checkbox_widget` |
| `active` | Boolean, hidden on the form |

- Entity key `civiserv_provider` → `group`.
- Link templates live under `/group/{group}/announcement`. `urlRouteParameters()` fills in `{group}` from the field.
- A group-level announcement has **no** location.

### All locations means group-level

`AnnouncementForm::submitForm()` checks whether every location checkbox is ticked. If so, it zeroes them all, which saves the announcement with no location, the same as a group announcement.

`AnnouncementAccessControlHandler::checkAccess()` treats an announcement with more than one location as group-level. Its location context is set only when exactly one location is referenced, so location-only managers cannot edit multi-location items.

### Access (`AnnouncementAccessControlHandler::hasPermission('manage', …)`)

1. Global permission `manage announcement entity` → allowed. In sync: `content_moderator`, `user_manager`, `site_admin`.
2. Otherwise, if a group is in context:
   - A non-member gets **forbidden**.
   - A member with the group permission `manage announcement entity` → allowed.
3. Otherwise, if a location is in context and the member has the group permission `manage announcement entity by location`, allowed when the membership's `civiserv_location` contains that location.

The same check covers `view`, `edit`, `update`, `delete` and create. The views pages use `AnnouncementsAccess` with the group and location route contexts (cache contexts `route.group`, `user.group_permissions`).

### Public display

`LocationAnnouncementsBlock::build()`:
1. Takes `group` from the route and asks storage for the single newest active group-level item (`start < now < end`, `location IS NULL`).
2. If `civiserv_location` is in the route, adds the single newest active item for that location.
3. Renders through the view builder.

Cache: context `route`; tags `announcement:group:{gid}` and `announcement:civiserv_location:{lid}`. The entity invalidates `group:{gid}` and `announcement:group:{gid}` on save.

### Cron (`announcement_cron()`)

- `purgeExpiredAnnouncements()` **deletes** every announcement whose `end` is in the past, and logs to channel `announcement`.
- `activateAnnouncements()` sets `active = TRUE` on items whose `start` has passed. Nothing in the code read reads `active` back. Display uses the start and end dates directly.

## External services and integrations

None.

## Configuration and permissions

| Permission | Type | Granted to (sync) |
|---|---|---|
| `manage announcement entity` | global | content_moderator, user_manager, site_admin |
| `manage announcement entity` | group | account management roles (`*-cf_account_mgmt`, `*-in_account_mgnr` / `in_acct_mngr`, `careerforce_system-cf_acc_mgmt` / `in_acct`, `careerforce_admin-moderator`, `adult_basic_education-out_acct`) |
| `manage announcement entity by location` | group | the above, plus the content management roles (`workforce_center-cf_content_mgmt`, `community_partner-cf_content_mgt`, `employer-cf_content_mgmt`) |
| `administer announcement entity` | global | admin permission for the entity type and settings page |

Note: the location managers (`workforce_center-moderator`, `community_partner-moderator`) are **not** in either group list in sync config.

## Related

- [location-groups-and-memberships.md](location-groups-and-memberships.md)
- [location-content-availability.md](location-content-availability.md)
- [../miscellaneous/theme-overview.md](../miscellaneous/theme-overview.md) (announcement template and styling)
