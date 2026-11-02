# Platform and operations

Logging and auditing, security, the shared Portland Webworks modules CareerForce
is built on, and site-wide behavior that isn't tied to one feature. Written
from the `master` branch at commit `db37480b7` (2026-10-28).

| Doc | What it covers |
|---|---|
| [logging-and-auditing.md](logging-and-auditing.md) | Stenographer recorders, CloudWatch and PWW Auditor storage plugins, `dblog_filter`, known bugs. |
| [security-and-waf.md](security-and-waf.md) | `aws_waf` module, Shield, ClamAV, Email TFA, SecKit, trusted hosts, 403→404 on user routes. |
| [shared-pww-modules.md](shared-pww-modules.md) | CiviServ and Display Maestro submodules, `pww_module`, `decision_tree`, Toolshed: what they give CareerForce. |
| [site-wide-behavior.md](site-wide-behavior.md) | Behavior from the main CareerForce module that isn't tied to one feature: redirects and page-access rules, what happens after login, batch jobs, Drush commands and deploy steps. |

Other KB areas: [../jobs-and-careers/](../jobs-and-careers/),
[../job-seeker-tools/](../job-seeker-tools/), [../events/](../events/),
[../appointments/](../appointments/), [../services/](../services/),
[../accounts/](../accounts/), [../locations/](../locations/),
[../content-authoring/](../content-authoring/), [../miscellaneous/theme-overview.md](../miscellaneous/theme-overview.md).
