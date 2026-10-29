# [Stage] - Resume Builder - Test Plan

Status: ready to generate
Implemented test: —

Split out from [deed-smoke-test-plan.md](../docs/deed-smoke-test-plan.md)
§14, Phase 2.

## Running it

```bash
npm run login:manual -- jobseeker
BASE_URL=https://qa.careerforce.link npx playwright test tests/stage/resume-builder
```

## Scope

- Creates master and tailored resumes and uploads a resume
  file on the job seeker account; deletes all of them in `finally`.
- All resume content is synthetic: fake employer names, made-up duties, no
  real contact details.
- Cases RB-1 .. RB-5 build on each other, so they run as one serial
  `describe` block with shared cleanup.

## Persona / fixtures

- **Job seeker** — `playwright/.auth/jobseeker.json`, ideally a dedicated
  account with no existing resumes (open question 1).
- `tests/fixtures/sample-resume.docx` and `tests/fixtures/sample.pdf` —
  synthetic.

## Test cases

| ID | Title | Persona | Steps | Assertions | Notes |
|---|---|---|---|---|---|
| RB-1 | Create a master resume | Job seeker | `goto('/user/<uid>/my-resumes')`, start a master resume, fill contact and summary sections, save | Resume is listed on My resumes; the preview shows the summary | |
| RB-2 | Add an experience with duties | Job seeker | Edit the master resume, add a job (employer "Playwright Test Co", title, dates) with two duties, save | The preview shows the job and both duties | Source checklist: "be sure to test adding and editing experiences and duties" |
| RB-3 | Edit an experience and its duties | Job seeker | Change the job title, edit one duty's text, delete the other duty, save | The preview shows the new title and edited duty; the deleted duty is gone | |
| RB-4 | Create a tailored resume | Job seeker | From the master resume, create a tailored resume with a unique name, leave out one item | The tailored resume is listed; its preview doesn't include the left-out item | |
| RB-5 | Update a tailored resume | Job seeker | Edit the tailored resume (change its summary), save | The tailored preview shows the change; the master resume is unchanged | |
| RB-6 | Upload a resume file | Job seeker | On My resumes, upload `sample-resume.docx`, then `sample.pdf` | Both are listed by file name; each download link responds with 200 | See [MNDEED-8325](https://portland-webworks.atlassian.net/browse/MNDEED-8325) on resume-upload file type display |
| RB-7 | Resume promo block on the dashboard | Job seeker | `goto('/user/<uid>')` | The resume builder promo block is visible and links to My resumes | From the Appointments section of the source checklist |

## Non-goals

- Resume content quality or PDF export layout — visual, manual.
- Staff viewing a job seeker's resumes — not in the source checklist.

## Open questions

1. Is there a limit of one master resume per account? If so, the test
   account must start with none, or RB-1 becomes "edit the master resume".
2. How is `<uid>` best found — from the dashboard link after login, or
   stored with the session?

## Suggested files

```
tests/
  fixtures/
    sample-resume.docx
    sample.pdf
  stage/resume-builder/
    resume-builder.spec.ts   # RB-1 .. RB-5 (serial)
    resume-upload.spec.ts    # RB-6, RB-7
  pages/
    resume-builder.page.ts
```
