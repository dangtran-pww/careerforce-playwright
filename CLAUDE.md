# CareerForce Playwright: notes for Claude

See README.md for the project layout and rules.

## Publishing reports to Confluence

Publish a test report to Confluence only with the `/publish-report-confluence`
skill (`scripts/confluence-report.mjs`). Never write or edit the page HTML
yourself.

Confluence silently drops a `<figure>` inside an `<li>`, even though the
Atlassian HTML format guide allows it. The reports put each screenshot inside
its numbered step, so a hand-built page loses images with no error. The
script places each image outside the list and resumes the numbering. The skill
then reads the live page back and checks that every image is there. Report
that check to the user, for example "24 of 24 screenshots verified".
