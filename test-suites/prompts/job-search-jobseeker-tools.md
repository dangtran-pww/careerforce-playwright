# Job Search as a job seeker

**Role:** jobseeker

The read-only part of LI-1 in test-plans/functional-job-search-logged-in.md:
Job Search shows a logged-in job seeker their own tools, not the visitor's
login dialog. The full logged-in session, which saves and bookmarks, is
docs/prompts/job-search-part-4-logged-in.md and is run by hand.

## Prompt

Open /job-search?title=nurse. Check that:

1. At least 1 job is listed.
2. There is no "Customize my search" button. The "Jobs for me" block shows a
   group dropdown instead. Open it and note which groups it lists (Bookmarked
   jobs, Saved searches, Career goals, In demand jobs); pick none.
3. Each job's bookmark icon is a bookmark toggle (its name or state says
   "bookmark" / "remove bookmark"), not a link that opens "Create an account
   or log in to use this feature". Don't click any bookmark icon.
4. Clicking "Save search" opens a dialog "Save this search to your
   dashboard" with a "Name job search" box, not the login dialog. Close it
   with its close button or Esc without typing a name or clicking Save, and
   check it closed.
5. browser_network_requests shows a request to
   /careerforce/jobseeker-tools-tracker with active_path=/job-search that
   answered 2xx.
6. browser_console_messages has no JavaScript errors.

Fail if any of these doesn't hold. Never click Save, a bookmark icon, or any
remove ("x") link.
