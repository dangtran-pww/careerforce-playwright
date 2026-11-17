# [Smoke] - Resume Builder - Test Plan

Status: implemented
Implemented test: tests/smoke/resume-builder/*.spec.ts
Prod: No: creates, edits and uploads resumes on the job seeker account.

A quick check after each deploy that the Resume Builder still works for a
job seeker: create a master resume, add and edit an experience with duties,
create and update a tailored resume, upload a resume file, and see the
"My Resume Center" link on the dashboard.

## Scope

- Creates master and tailored resumes and uploads resume
  files on the job seeker account; deletes all of them in `finally`.
- An account holds one master resume, so RB-1 first deletes the master
  resume already on the account. Targeted resumes and uploads the tests
  didn't make are left alone.
- All resume content is synthetic: fake employer names, made-up duties, no
  real contact details.
- Cases RB-1 .. RB-5 build on each other, so they run as one serial
  `describe` block with shared cleanup.

## Persona / fixtures

- **Job seeker** — `playwright/.auth/<env>/jobseeker.json`. The tests find
  `<uid>` from `/user/my-resumes`, which redirects to
  `/user/<uid>/my-resumes`.
- `tests/fixtures/sample-resume.docx` and `tests/fixtures/sample.pdf` —
  synthetic.

## Test cases

| ID | Title | Persona | Steps | Assertions | Notes |
|---|---|---|---|---|---|
| RB-1 | Create a master resume | Job seeker | `goto('/user/<uid>/my-resumes')`, delete the existing master resume if there is one, then "+ Build your master resume" → "Build a resume", fill contact and summary sections, save | Resume is listed on My Resume Center; the preview shows the summary | One master resume per account |
| RB-2 | Add an experience with duties | Job seeker | Edit the master resume, add a job (employer "Playwright Test Co", title, dates) with two duties, save | The preview shows the job and both duties | Source checklist: "be sure to test adding and editing experiences and duties" |
| RB-3 | Edit an experience and its duties | Job seeker | Change the job title, edit one duty's text, delete the other duty, save | The preview shows the new title and edited duty; the deleted duty is gone | |
| RB-4 | Create a tailored resume | Job seeker | From the master resume, create a tailored resume with a unique name, remove the experience from it | The tailored resume is listed under Targeted Resumes; its preview has the summary but not the experience | |
| RB-5 | Update a tailored resume | Job seeker | Edit the tailored resume (change its summary), save | The tailored preview shows the change; the master resume is unchanged | |
| RB-6 | Upload a resume file | Job seeker | On My resumes, upload `sample-resume.docx`, then `sample.pdf`, each under a run-unique name | Both are listed by file name; each download link responds with 200 | See [MNDEED-8325](https://portland-webworks.atlassian.net/browse/MNDEED-8325) on resume-upload file type display |
| RB-7 | My Resume Center link on the dashboard | Job seeker | `goto('/user/<uid>')`, click "My Resume Center" under Quick Links | My Resume Center (`/user/<uid>/my-resumes`) opens | From the Appointments section of the source checklist. The dashboard has no resume promo block, only this Quick Links link |

## Non-goals

- Resume content quality or PDF export layout — visual, manual.
- Staff viewing a job seeker's resumes — not in the source checklist.

## Suggested files

```
tests/
  fixtures/
    sample-resume.docx
    sample.pdf
  smoke/resume-builder/
    resume-builder.spec.ts   # RB-1 .. RB-5 (serial)
    resume-upload.spec.ts    # RB-6, RB-7
  pages/
    resume-builder.page.ts
```
