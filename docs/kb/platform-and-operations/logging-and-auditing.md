# Logging and auditing (Stenographer)

## Summary

Audit and activity logging is built on **Stenographer**, a contributed Drupal
module (`drupal/stenographer`, branch `1.0.x-dev`, source
`git.drupalcode.org/project/stenographer`, maintainer Liem Khuu / `lemming`).
Modules declare "recorders" in `<module>.stenographer.yml`. A recorder has a
trigger (hook, entity operation, form, exception), data adapters that pick
properties, optional conditions, and one or more storage targets.

CareerForce adds two custom storage plugins:

- `stenographer_cloudwatch`: writes JSON events to AWS CloudWatch Logs.
- `stenographer_auditor` (plugin id `pww_auditor`): POSTs events to the PWW
  Auditor HTTP service.

Most recorders write to both. A small `dblog_filter` module exists to drop
debug-level watchdog entries but is not enabled.

All Stenographer modules are enabled **only by the `prod` config split**, so
they run on every hosted environment and not locally.

## How it works

### Storage selection

In the base module's `RecorderManager::processDefinition()`:

1. If `$settings['stenographer.dev']['storage']` is set, it replaces the
   storage of **every** recorder. The local settings template sets it to
   `drupal_watchdog`.
2. Otherwise a recorder with `storage: '@default'` gets
   `$settings['stenographer']['default_storage']`.

`settings.aws.php` sets the default storage to:

```php
$settings['stenographer']['default_storage'] = [
  'cloudwatch' => 'stenographer_cloudwatch',
  'azure' => 'pww_auditor',
];
```

So in practice every recorder on hosted environments writes to CloudWatch and
the PWW Auditor, whether it names them explicitly or uses `@default`.

Base module storages also available: `drupal_watchdog`, `db_table`.

### CloudWatchStore

- Credentials from `$settings['stenographer_cloudwatch'][<plugin id>]` or
  `['default']` (keys `key`, `secret`, optional `token`, `region`, `group`).
  On hosted envs `default` is loaded from SSM `/careerforce/log/auth` with
  region `us-east-2` and group `/mn-deed/dev/drupal` (prod:
  `/mn-deed/prod/drupal`).
- Stream name defaults to `$_SERVER['AWS_ENVIRONMENT']` (falls back to the
  HTTP host). One stream per environment inside the group.
- Throws `InvalidArgumentException` at construction if key/secret are missing.
- Each event is sent synchronously with `PutLogEvents`; the stream is created
  if missing; on `InvalidSequenceTokenException` it refreshes the token and
  retries once.

### PwwAuditor

- Implements `BufferedStoreInterface`. `write()` fires an async Guzzle POST;
  `flush()` waits for all pending requests before the request ends.
- URL is `<schema>://<host>:<port><path>` from `stenographer_auditor.settings`
  (`endpoint.host`, `endpoint.path`, `port`; default port 5376). Timeout 1.5 s,
  TLS verification off, no redirects. Failures are logged to the
  `stenographer_auditor` channel; HTTP 400 bodies are included.
- Payload: root keys `id, type, capture, session, account, accountId,
  actionId, ipAddress, ipv6Address, owner, targetId, targetType, timestamp`
  (kept in this order because the auditor's JSON deserializer is
  order-sensitive, per code comment); everything else goes under `data`.
  `timestamp` is ISO 8601, `ipv6Address` is always `::0`. For `audit` events,
  missing `accountId`/`owner`/`targetId` default to `'0'` and `targetType` to
  `none`.
- Host/port on hosted envs come from SSM `/careerforce/<env>/auditor/endpoint`.

The same auditor is also **read** by `cf_service`'s `ServicesLastAccessBlock`
(`web/modules/custom/careerforce/modules/cf_service/src/Plugin/Block/ServicesLastAccessBlock.php`),
which GETs `<path>/jobseeker-tools/user/<uid>` and shows a "Tool / Last
Access" table (Career Goals, Compare Skills, Employment Readiness, Interest
Profiler, Job Search, Resume Builder, Skills Matcher).

### CareerForce recorders (`careerforce.stenographer.yml`)

| Recorder | Type | Trigger | Storage |
|---|---|---|---|
| `users_fields_report` | audit | none (called from code: `admin:users_fields_data_view`) | `@default` |
| `user_access` | audit | exception `access` → `user:access_denied`; hook `user_login` → `user:login` | `@default` |
| `careerforce_user_alter` | audit | user entity create/update/delete; includes `@changeset` | CloudWatch + Auditor |
| `careerforce_user_roles` | audit | user update, action `user:role_change`, only if `rolesChanged` has data | CloudWatch + Auditor |
| `careerforce_permissions_add` | audit | `user_role` create/update, `role:permission_added`, only if permissions were added | CloudWatch + Auditor |
| `careerforce_permissions_removed` | audit | `user_role` update, `role:permission_removed` | CloudWatch + Auditor |
| `careerforce_login` | audit | `user_login_form` validate → `user:login_fail` (username) | CloudWatch + Auditor |
| `file_upload_infected` | audit | hook `file_upload_infected` → `file_upload:infected` (file URI, name, size, MIME, IP). Hook comes from the local ClamAV patch. | CloudWatch + Auditor |
| `job_seeker_tools` | statistic | hooks `compare_skills_load`, `job_search_load`, `interest_profiler_load`, `skills_matcher_load`, `employment_readiness_load`, `career_goals_update` | `@default` |

Recorders in other modules (ids only; details belong to those features):
`registration_api_events_registration`, `registration_api_appointments_registration`,
`registration_api_events_occurrence`, `happenings_catalog_items`,
`happenings_sessions`, `happenings_occurrences`, `service_items`,
`service_records`, `careerforce_profile`, `cf_profile_match_request`,
`webform_submission_external_event` (uses the `webform_submission` adapter),
`external_event`, `resume_actions`, `resume_file_upload`,
`resume_file_download`, `appointments_occurrences`.

### Suppressing audit events during bulk work

Deploy hooks in `careerforce.deploy.php` fetch
`stenographer.trigger.kill_switch` (null-safe, since the module may be off) and
call `->halt()` before bulk user updates, so mass changes do not flood the
audit log. Use the same pattern in new deploy hooks or batch jobs.

### dblog_filter

`LogFilter` decorates `logger.dblog` and only forwards entries with level
below `RfcLogLevel::DEBUG`, i.e. drops debug messages from watchdog. The
module is **not** listed in `config/sync/core.extension.yml`, so it is not
active. `dblog` itself is enabled with `row_limit: 10000`.

## Configuration

| Item | Where |
|---|---|
| Auditor endpoint, port, retries | `stenographer_auditor.settings` (defaults in module `config/install`; prod split: path `/api/audit`, port 5376, retries 2; host from SSM) |
| CloudWatch credentials/group | `$settings['stenographer_cloudwatch']` in `settings.aws.php` |
| Default storage | `$settings['stenographer']['default_storage']` |
| Dev override | `$settings['stenographer.dev']['storage']` in `settings.local.php` |

## Known issues found in code

- `StenographerAuditorSettings` form reads config `stenographer_auditor_settings`
  and saves to `stenographer_auditor`; neither is the real
  `stenographer_auditor.settings`. The module also has no routing file, so the
  form is not reachable. Configure through config/settings only.
- `PwwAuditor::write()` and `ServicesLastAccessBlock` read `$endpoint['schema']`,
  but the config key is `scheme`. They always fall back to `http`, even though
  the prod split sets `scheme: https`.
- `retries` is stored in config but not used by `PwwAuditor`.
- `UsersSearchViewsHooks` exists twice: in `careerforce` (views
  `user_admin_people` and `account_admin`) and in `careerforce_profile`
  (`user_admin_people`). With both modules enabled, opening the People admin
  view appears to log `admin:users_fields_data_view` twice.
- `JobSeekerToolsTracker` marks `/employment-readiness/take` with the comment
  `// not working`.

## QA notes

- Audit logging cannot be checked locally unless you enable `stenographer`
  (and it then goes to watchdog because of `stenographer.dev`). On QA, check
  CloudWatch group `/mn-deed/dev/drupal`, in the stream named after that
  environment's `AWS_ENVIRONMENT` value (presumably `qa`).
- The "Last Access" block on a user's services page depends on the auditor
  service being reachable; with no data or an error it shows the "no data"
  state and logs to `stenographer_auditor`.
- CloudWatch writes are synchronous. If CloudWatch is slow, user saves and
  logins on hosted envs get slower too.

## Related

- [../job-seeker-tools/](../job-seeker-tools/) (tool usage hooks)
- [../events/](../events/), [../appointments/](../appointments/), [../services/](../services/) (their recorders)
