# Legacy resume builder (form_wizard)

`form_wizard` is an older, session-based resume builder. The user fills six wizard steps, and the data lives only in a private tempstore that expires. At the end they download a Word or RTF file; nothing is saved to their account. The module is still enabled (`config/sync/core.extension.yml`), but no menu, config or other custom module links to its routes (only a theme SCSS file mentions it). It appears to have been replaced by the entity-based [Resume Builder](resume-builder.md) and is reachable only by URL.

## What users see

| Path | Page |
|---|---|
| `/user/{uid}/resume-builder-info` | Intro page. Title and body come from config `form_wizard.resume_info`; "Continue" goes to step 0. |
| `/user/{uid}/resume-builder/{n}` | Wizard step `n` (0–5): Contact Info, Summary, Skills, Experience, Education, Review. An invalid `n` redirects to step 0. |
| `/user/{uid}/resume-builder/download?format=docx\|rtf` | Download confirmation. "Download" sends `MyResume.<ext>` and ends the session. "Cancel" redirects to step `countSteps()`, which is 0 if the wizard was not initialised or 6 (an invalid index that bounces to 0). Either way it appears to land on step 0, not on Review. |

Access: logged in, and only for your own `{uid}` (`FormWizardController::checkAccess`).

## How it works
- The service `form_wizard.private_tempstore` is a `PrivateTempStoreFactory` with a 7200-second expiry, so wizard data lasts about 2 hours of inactivity.
- Each step's values are saved under the step's form class name.
- On download, `buildResumeFile()` maps each step form to a `Resume\*Section` class and builds the document.
- The response is sent as `MyResume.docx` or `MyResume.rtf`. The form then calls `deleteStepData()`.
- Logging out also clears the data.
- `templates/resume_template.docx` is not referenced by code (appears unused).

## External services and integrations
None.

## Configuration and permissions
- `/admin/config/careerforce/resume-builder` (`administer careerforce_config`): intro page title and body.
- No module-specific permissions. Routes require `access content` plus the own-account check.

## Related
- [resume-builder.md](resume-builder.md)
