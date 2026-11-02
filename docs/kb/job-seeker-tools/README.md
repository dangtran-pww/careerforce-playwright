# Job seeker profile and tools

KB docs for the custom code behind the job seeker account: registration and profile, data sharing with MN DEED, the Resume Builder, the Employment Readiness Assessment, goals & experience, "Jobs for me", and tool usage tracking. Source: `master` at commit `db37480b7`.

| Doc | What it covers |
|---|---|
| [job-seeker-registration-and-profile.md](job-seeker-registration-and-profile.md) | Tiered multi-step job seeker registration and profile editing, the tier-1 route gate, profile blocks, and the `agree_terms` field (`careerforce_profile`, `agree_terms`) |
| [registration-prefill.md](registration-prefill.md) | Prefilling registration from other State systems: match, consent modal, locked fields, payload merge (`cf_profile_match`) |
| [resume-builder.md](resume-builder.md) | Master/targeted resumes, steps, limits, access, uploads, audit, and `.docx` export (`cf_resume`, `cf_resume_word`) |
| [legacy-resume-builder-form-wizard.md](legacy-resume-builder-form-wizard.md) | Older session-based resume wizard that appears unlinked (`form_wizard`) |
| [employment-readiness-assessment.md](employment-readiness-assessment.md) | The 12-question assessment, live recommendations and printable results (`employment_readiness`, `quizer`) |
| [goals-and-experience.md](goals-and-experience.md) | "My Goals & Experience" page: career goals, work and military experience forms (`careerforce` module) |
| [jobs-for-me-personalization.md](jobs-for-me-personalization.md) | The "Jobs for me" selector on job search and its `CfPersonal` plugins (`cf_personal`) |
| [job-seeker-tools-tracker.md](job-seeker-tools-tracker.md) | Usage statistics for job seeker tools (`JobSeekerToolsTracker`, stenographer `job_seeker_tools`) |

Related areas: `../jobs-and-careers/`, `../events/`, `../appointments/`, `../services/`, `../accounts/`, `../locations/`, `../content-authoring/`, `../miscellaneous/theme-overview.md`, `../platform-and-operations/`.
