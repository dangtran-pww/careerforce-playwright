# Security and infrastructure modules

## Summary

This page covers the custom `aws_waf` module and the security-related settings
that sit around it: Shield basic auth on non-prod, ClamAV upload scanning,
Email TFA, SecKit, trusted hosts, Apache headers and the 403→404 rewrite for
user routes. Login/SSO (LoginMN, FAM, user policies) is covered in
[../accounts/](../accounts/).

## How aws_waf works

- `AwsWafHooks::pageAttachments()` (`src/Hook/AwsWafHooks.php`) adds
  `<script src="<script_url>" defer>` to `html_head` on every page (admin
  included) when `enabled` is true and `script_url` is not empty. Cache tag
  `config:aws_waf.settings`.
- Settings form at `/admin/config/services/aws-waf`
  (`aws_waf.settings_form`), permission `administer aws waf settings`
  (restricted). Validation: the URL host must equal or be a subdomain of an
  entry in `allowed_domains`; a host-less URL must point to an existing file
  under the module's `js/` folder. The form only edits `enabled` and
  `script_url`; `allowed_domains` is config-only.
- The WAF rules themselves live in AWS, not in this repo. The script appears
  to be the AWS WAF challenge/bot-control JS SDK (`challenge.js`).

Gotcha: the base config enables the module with the local path
`/modules/custom/aws_waf/js/aws_waf.js`, but the module has no `js/` folder in
git (and `.gitignore` ignores every `js/` directory). Locally, and anywhere the
split overrides do not apply, the page appears to request a script that
returns 404. This is harmless but shows in the browser console.

## Other security settings

- **Shield** (`lowhost` split): HTTP basic auth on qa/stage/sandbox/account,
  user `careerforce`, password from env `SHIELD_PASSWORD`, `allow_cli: true`.
  Automated tests against these hosts need the credentials (from the team,
  not from the repo).
- **ClamAV** (`prod` split): `scan_mode: 0`, daemon TCP; host/port from env
  `CLAMAV_ENDPOINT`, or from SSM `/careerforce/clamav/endpoint` via
  `raini awsresolve`. `outage_action: 0`. A local patch to `drupal/clamav`
  fires `hook_file_upload_infected`, which the `file_upload_infected`
  Stenographer recorder logs.
- **Email TFA** (`prod` split): enabled on all hosted envs; disabled locally.
- **SecKit**: patched for a Permissions-Policy header; CSP is not
  enabled in `config/sync`.
- **Trusted hosts** (hosted only, `settings.aws.php`): `*.careerforce.link`,
  `*.careerforcemn.com`, `*.careerforce.mn.gov`. Locally
  `trusted_host_patterns` is empty.
- **Reverse proxy**: `reverse_proxy = TRUE` with `REMOTE_ADDR` as the trusted
  proxy, so client IPs come from `X-Forwarded-For`.
- **Sessions**: `user_policies.single_session = TRUE` in `settings.php`
  (one session per user).
- **403 → 404**: `User403to404HttpSubscriber::on403()` turns an access denied
  on any route in `careerforce.user_routes` (user canonical/edit, FAM email
  and password pages, profile pages, several `page_manager` "my account"
  pages, webform submissions per user) into a 404. Only for HTML responses.
- **Group member creation** is blocked: `careerforce/src/Routing/RouteSubscriber.php`
  sets `_access: FALSE` on `entity.user.civiserv_create_member` because it
  "bypasses some CareerForce policies and the Entra ID".
- **Instance hardening**:
  FIPS mode, daily security updates, read-only code tree after deploy,
  `hash_salt` stored on EFS `.keys/`.

## QA notes

- Visiting another user's profile or edit page as a logged-in user should give
  **404, not 403**. Test cases that expect "Access denied" on those routes
  will fail by design.
- On hosted non-prod, expect the browser basic auth prompt before any page.
- The WAF challenge script is loaded on every page; WAF blocks or CAPTCHA
  challenges seen during automated runs come from AWS WAF rules, not Drupal.
- Uploading a test virus file (for example EICAR) should be rejected on hosted
  envs only; ClamAV is off locally.

## Related

- [logging-and-auditing.md](logging-and-auditing.md)
- [site-wide-behavior.md](site-wide-behavior.md)
- [../accounts/](../accounts/)
