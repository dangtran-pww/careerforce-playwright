# CareerForce knowledge base

Feature docs for the custom code in the Minnesota CareerForce Drupal site
([mn-careerforce](https://bitbucket.org/portlandwebworks/mn-careerforce/src/master/)).
They cover what we built on top of Drupal (custom modules under
`web/modules/custom`, the `careerforce_skin` theme, and the project tooling),
not Drupal core or contrib themselves.

**Source:** `master` at commit `db37480b7` (2026-10-28, MNDEED-8343), with
these git submodules:

| Submodule | Path | Commit |
|---|---|---|
| civiserv | `web/modules/custom/civiserv` | `3b2cdb62` (2026-09-24) |
| user_policies | `web/modules/custom/user_policies` | `3735340` (2026-08-21) |
| dismae | `web/modules/custom/dismae` | `402fd4a` (2025-06-26) |

Code paths in the docs are relative to the mn-careerforce repo root.

Each feature doc follows the same outline: what users see, how it works,
external services, configuration and permissions, known issues, and related
docs. Statements inferred from code rather than confirmed on a running site
are marked "appears to".

## Areas

| Area | What it covers |
|---|---|
| [Jobs and careers](jobs-and-careers/README.md) | Job search (CareerOneStop), bookmarks and saved searches, occupation data framework, Explore Careers, LMI regions and industries, career goals, military crosswalk, skills comparison |
| [Job seeker tools](job-seeker-tools/README.md) | Two-tier registration and profile, registration prefill, Resume Builder, employment readiness, goals and experience, "Jobs for me", tools tracker |
| [Events](events/README.md) | Event content model, recurrence and occurrence generation, event search, registration and waitlist, attendee management, Registration API client, external event submissions |
| [Appointments](appointments/README.md) | Appointment sessions and staff tools, booking flow |
| [Services](services/README.md) | Service catalog and service records, customer support account search, connection referral audit |
| [Accounts](accounts/README.md) | SSO login (LoginMN, MN Staff, PWW) via FAM/OpenID Connect, account states and expiration, password/session policies, roles, sending profiles to MN DEED |
| [Locations](locations/README.md) | Location groups and memberships, content availability across locations, announcements, regional team block |
| [Content authoring](content-authoring/README.md) | Content moderation, content blocks, CKEditor plugins, bulk operations |
| [Platform and operations](platform-and-operations/README.md) | Logging and auditing, security/WAF, shared PWW modules, site-wide behavior |
| [Miscellaneous](miscellaneous/README.md) | Small customizations that don't belong to one area, such as the office hours time format, CareerForce settings pages, form helpers, block styling, media, navigation, Literacy Hotline groups, and the theme |

## Suspected bugs

Suspected bugs found while reading the code are listed in each doc's "Known
issues" section; `jobs-and-careers/README.md` also collects its own in a
table. These come from reading code only. Reproduce one on QA before filing
it.

## Keeping this up to date

These docs are a snapshot of one commit. When a feature changes, update its
doc in the same area folder and bump the source commit above if you
re-check the whole KB.
