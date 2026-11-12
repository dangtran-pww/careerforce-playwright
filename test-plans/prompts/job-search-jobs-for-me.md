# Jobs for me matches the account

**Role:** jobseeker

The read-only part of JM-1 to JM-3 in
test-plans/functional-job-search-logged-in.md: the "Jobs for me" selector
on Job Search lists the job seeker's own saved searches and bookmarks, and
its career-goal and in-demand items open matching job searches. It only
reads what the account already has; it adds nothing.

## Prompt

1. Open /user (the job seeker's dashboard). In its "Jobs For Me" section,
   note the names under "Saved searches" and the titles under "Bookmarked
   jobs" (or their "You have no …" messages).
2. Open /job-search. In the "Jobs for me" block, pick each group in the first
   dropdown in turn and read the second dropdown's items (don't pick an item
   yet). Check that:
   - only groups with items are listed;
   - after picking a group the page doesn't navigate, and the second dropdown
     shows the placeholder "Select <group>";
   - "Saved searches" lists the same names as the dashboard, in the same
     order, and "Bookmarked jobs" the same jobs.
3. If "Career goals" is listed, pick its first item. The page navigates to
   /job-search?title=<Occupation> (<code>), the Keyword box shows that text,
   and at least 1 job is listed.
4. Go back to /job-search. If "In demand jobs" is listed, check it has 1 to
   10 items and pick the first. The page navigates to
   /job-search?title=<Occupation> (<code>) and shows jobs or a plain "No
   results found." message, with no error.
5. browser_console_messages has no JavaScript errors.

Fail if a list doesn't match the dashboard, a group navigates on its own, or
an item leads to an error. If the account has no items in any group, give
"unsure" and say so. Never click Save search, a bookmark icon, or any remove
("x") link.
