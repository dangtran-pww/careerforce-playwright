# Literacy Hotline group import

The `hotline_group` module imports Adult Basic Education (ABE) provider data
from the Minnesota Literacy Hotline JSON feed into Group entities of type
`adult_basic_education`. A weekly job keeps them in sync, and admins can run
the import by hand. Despite the module description ("Content, imports and
registration handling for Literacy Hotline Group data"), the code contains no
registration handling: it only imports and cleans up groups.

## What users see

- **Admin**: `/admin/content/hotline-groups/import` ("Configure and review
  literacy hotline imports"; menu link "Manage Hotline Groups" under Groups,
  and an "Import" tab on the group collection). It shows the last update date,
  the number of imported groups, an import control from the CiviServ import
  base form (accepts `.json` files), and, for users with
  `administer hotline_group settings`, a **Data URI** field with "Save
  Settings".
- **Public**: the imported `adult_basic_education` groups and wherever they
  are listed. Their display is config-driven
  (`core.entity_view_display.group.adult_basic_education.*`) and not covered
  by custom code in this module.

## How it works

1. Drush (cron) or the form builds the feed URL from
   `hotline_group.settings:data_uri` (`scheme`, `host`, optional `port`,
   `path`). Older config that has the host at the start of `path` is still
   supported (`buildDataUrl()`).
2. `HotlineImport::init()` takes a persistent lock `hotline_group_import`
   (1 hour). If a run is already in progress, Drush prints "An instance of
   this batch is already running.".
3. Each JSON record is mapped onto an `adult_basic_education` group
   (`entity_writer`, langcode `en`):

   | Feed key | Group field |
   |---|---|
   | `HotlineName` | `label` |
   | `SubSiteID` | `field_sub_site_id` (tracking key) |
   | `SiteID` | `field_site_id` |
   | `Email`, `Phone`, `Fax` | `field_contact_email`, `field_contact_phone_number`, `field_fax_number` |
   | `Description` | `field_description` (field default used when empty) |
   | `url` | `field_website` |
   | `ContentList` | `field_class_list` |
   | `Latitude`/`Longitude` | `field_lat_lng` |
   | `Address`, `City`, `State` (always MN), `PostalCode` | `field_location` |

4. The `entity_field_tracker` records each `subsite_id` with the current
   batch ID in `hotline_imports`, so existing groups are updated instead of
   duplicated.
5. `batchCleanup()` **deletes every `adult_basic_education` group** that is
   not tracked in the current batch, in chunks of 50. That includes groups
   created by hand. It then removes orphan `groups_field_data` rows of that
   type.
6. `finalizeImport()` releases the lock and stores the run time in state
   `hotline_group.import_date` (shown as "Last Update").
7. On failure the Drush command emails the addresses in
   `civiserv_import.settings:notify_emails` (mail key
   `civiserv_import_batch_incomplete`, labelled "Workshop import").

## External services and integrations

- Feed: `https://hotline.mnabe.org/api/hotline` (from `config/sync`, the
  `develop`/`lowhost` config splits, and the production override in
  `web/sites/default/settings.aws.php`). No authentication is sent.
- Depends on CiviServ's `civiserv_import` framework (batch base, writers,
  trackers, loggers). That module is in the `civiserv` git submodule and was
  not part of the reviewed export, so its internals are not described here.

## Configuration and permissions

- Permissions (both restricted): `use hotline_group importer form` and
  `administer hotline_group settings`. The route requires
  `'use hotline_group importer form, administer hotline_group settings'`. In
  Drupal route requirements a comma means **both** permissions are required,
  so in practice only users with both can open the page.
- Config splits: `config/develop/config_split.patch.hotline_group.settings.yml`
  moves the host into `data_uri.host`; `config/lowhost/hotline_group.settings.yml`
  sets scheme/host/path explicitly; prod sets it in `settings.aws.php`.

## Related

- ../locations/ (Groups and CiviServ)
- ../platform-and-operations/ (server cron, config splits)
