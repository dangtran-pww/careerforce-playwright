# [Smoke] - Resume Builder - Test Plan

Status: implemented
Implemented test: tests/smoke/resume-builder/*.spec.ts
Prod: No: creates, edits and uploads resumes on the job seeker account.

## Overview

A quick check after each deploy that the Resume Builder still works for a
job seeker: create a master resume, add and edit an experience with duties,
create and update a targeted resume, upload resume files, and open My
Resume Center from the dashboard.

Every case but RB-7 changes the job seeker account, so the plan runs on QA
and Stage only.

## Login

| **Every case** | Job seeker role |
|---|---|
| **Accounts touched** | The job seeker account: RB-1 deletes its master resume and builds a new one, RB-4 adds a targeted resume and RB-6 uploads 2 files. The tests delete the resumes and files they made, even when a case fails. Targeted resumes and uploads they didn't make are left alone. |

## Test cases

RB-1 to RB-5 are in `resume-builder.spec.ts`. They build on each other, so
they run in order, one at a time. RB-6 and RB-7 are in
`resume-upload.spec.ts`. `<uid>` is the job seeker's user ID: `/user/my-resumes`
goes to `/user/<uid>/my-resumes`. `<token>` is unique to each run; see
[Test data](#test-data) for the values.

| ID | Test | Page | Steps | Expected result |
|---|---|---|---|---|
| RB-1 | Create a master resume | `/user/<uid>/my-resumes` | If the account has a master resume, delete it first. 1. Click "Build your master resume", then "Build a resume". Fill in Contact Information and click "Save and continue", then the Summary and "Save and continue". 2. Open My Resume Center, then the resume. | 1. The resume is created. 2. My Resume Center lists it as the master resume, and its preview shows the name and the summary. |
| RB-2 | Add an experience with duties | `/resume/<id>/experience` | 1. Add a job (company, location, title, start date March 2021, "This is my current job") with 2 duties, and click "Save and continue". 2. Open the resume. | 1. The experience is saved. 2. The preview shows the job's title and company, and both duties. |
| RB-3 | Edit an experience and its duties | `/resume/<id>/experience` | 1. Change the job title, change duty 1's text, remove duty 2 and click "Save and continue". 2. Open the resume. | 1. The experience is saved. 2. The preview shows the new title and duty 1's new text, and neither the old title nor duty 2. |
| RB-4 | Create a targeted resume | `/resume/<id>` | 1. On the master resume, click "Build a targeted resume", enter a unique Resume Title and click "Save and continue". 2. In its Experience step, remove the job and click "Save and continue". 3. Open My Resume Center, then the targeted resume. | 1. "Craft your targeted resume in just a few steps!" shows, and saving opens the targeted resume's Contact Information step. 2. The experience is saved. 3. My Resume Center lists it under Targeted Resumes, and its preview shows the master's summary but not the job or its duty. |
| RB-5 | Update a targeted resume | `/resume/<id>/summary` | 1. Change the targeted resume's summary and click "Save and continue". 2. Open the targeted resume, then the master resume. | 1. The summary is saved. 2. The targeted preview shows the new summary and not the master's. The master preview still shows its own summary and the job, and not the targeted summary. |
| RB-6 | Upload resume files | `/user/<uid>/my-resumes` | 1. Click "Upload a resume", choose `sample-resume.docx` under a unique name and click "Save". Do the same with `sample.pdf`. 2. Open My Resume Center. **Cleanup:** delete both uploads. | 1. Each file's name shows in the "Add Resume: Uploaded" dialog once it has uploaded. 2. Both files are listed under Uploaded Resumes by name, and each one's download link (`/media/<id>/download`) answers 200. |
| RB-7 | My Resume Center link on the dashboard | `/user/<uid>` | Click "My Resume Center" under Quick Links on the dashboard. | My Resume Center opens at `/user/<uid>/my-resumes`. |

## Test data

All synthetic: no real names, employers or contact details.

| Data | Value |
|---|---|
| Contact (RB-1) | Pat Example `<token>`, Saint Paul, Minnesota |
| Master summary (RB-1) | `Playwright test <token> master summary: …` |
| Job (RB-2) | Playwright Test Co, Saint Paul, MN, "Synthetic Analyst `<token>`", from March 2021, current job |
| Duties (RB-2) | "Reviewed made-up reports for test `<token>`.", "Filed synthetic tickets for test `<token>`." |
| New title and duty 1 (RB-3) | "Senior Synthetic Analyst `<token>`", "Reviewed and summarized made-up reports for test `<token>`." |
| Targeted resume (RB-4, RB-5) | Title `Playwright test <token> targeted`, summary `Playwright test <token> targeted summary for a made-up opening.` |
| Uploads (RB-6) | `tests/fixtures/sample-resume.docx` and `tests/fixtures/sample.pdf`, uploaded as `playwright-test-<token>.docx` and `.pdf` |

## Good to know

- **One master resume per account**, so RB-1 deletes the one already there.
  An account also holds up to 5 targeted resumes and 5 uploaded files.
- **A targeted resume starts as a copy of the master**, which is why RB-4
  removes the job from it, and RB-5 checks that changing it leaves the
  master alone.
- **Each step is its own form** at `/resume/<id>/<step>`
  (`contact_information`, `summary`, `skills`, `experience`, `education`),
  saved with "Save and continue". The resume's own page, `/resume/<id>`,
  shows a preview of it.
- **Duties are added and removed in place:** "Add a job duty/accomplishment"
  and "Remove" rebuild the list without reloading the page.
- **An uploaded file uploads as soon as it is chosen**, and its name then
  shows in the dialog; "Save" adds it to My Resume Center.
- **Resume-upload file type display:** see
  [MNDEED-8325](https://portland-webworks.atlassian.net/browse/MNDEED-8325).
- **RB-7:** the dashboard has no resume block, only this Quick Links link.

## Mobile

RB-7 only reads the dashboard, so it runs on desktop and on a phone. RB-1 to
RB-6 change the job seeker account, so they are tagged `@desktop-only`: a
phone run would make the same changes again.

## Not covered

- **Resume content quality and PDF export layout:** visual, checked by hand.
- **Staff viewing a job seeker's resumes:** not part of the smoke run.
