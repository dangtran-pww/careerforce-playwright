# Homepage layout compared with the comparison site

**Role:** anonymous
**Compare with:** default
**Viewports:** desktop 1366x768, phone 390x844
**Screenshots:** 16
**Parallel:** yes

HP-5 in test-suites/smoke/smoke-public-site.md. From the DEED smoke checklist:
"Review the Homepage for layout/styling issues. Comparison to be done with the
Live (qa based on new changes) site/side-by-side. Review both desktop and
responsive. Note any discrepancies."

"default" compares Local, QA and Sandbox with Stage and Production, and Stage
with Production. On Production it
compares with the screenshots of the last run on Production (run it before a
deploy, then again after). A run can pick another site to compare with.

## Prompt

Review the homepage (/) for layout and styling problems, side by side with the
comparison site, on desktop and on a phone.

At each viewport, scroll the whole homepage on both sites and compare every
section: the header and main menu (on the phone, open and close the menu
button), the Job Search block, "What brings you here today?", "Upcoming
Events", "Explore Careers", "Upcoming Training Programs", the "create an
account" section, "Connect to our Services", "CareerForce Blog" and the
footer.

Note every layout or styling difference between the two sites, and anything
on the site under test that looks broken, overlapping, cut off or unstyled.
Don't click anything that leaves the homepage.
