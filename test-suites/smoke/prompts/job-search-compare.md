# Job Search layout compared with the comparison sites

**Role:** anonymous
**Compare with:** default
**Viewports:** desktop 1280x800, phone 390x844
**Screenshots:** 16
**Parallel:** yes

JL-1 in test-suites/smoke/smoke-job-search.md. Reviews Job Search the way
HP-5 (homepage-compare.md) reviews the homepage.

"default" compares Local, QA and Sandbox with Stage and Production, and Stage
with Production. On Production it compares with the screenshots of the last
run on Production (run it before a deploy, then again after). A run can pick
other sites to compare with.

16 screenshots is the limit for one comparison site; comparing with two sites
allows 24.

## Prompt

Review the Job Search page (/job-search) for layout and styling problems,
side by side with the comparison sites, on desktop and on a phone. Open
/job-search with nothing after it in the address, on every site.

At each viewport, scroll the whole page on every site and compare each part:

- the header and main menu (on the phone, open and close the menu button);
- the "Job Search" heading and the search form: the Keyword, Location and
  Distance fields and the "Search" button;
- "Jobs for me";
- the number of jobs shown, the Sort dropdown, the Company and City filters,
  "Reset" and "Save search" (on the phone they are in a drawer behind the
  "Filters" button: open it, compare the drawer, then close it);
- the list of jobs: each job's title, company, place and "Posted … ago"
  label, its "Learn more and apply" and "Read more" links and its Bookmark
  icon (compare the first few jobs, not every one);
- the paging links under the list, and the footer.

Note every layout or styling difference between the site under test and each
comparison site, and anything on the site under test that looks broken,
overlapping, cut off or unstyled. The jobs come from an outside feed, so
different jobs, companies, cities, dates and job counts are content, not
differences. Don't type a search, change a filter, click Bookmark or Save
search, or click anything that leaves Job Search.
