import { readFileSync } from 'node:fs';
import path from 'node:path';

import { test, expect } from '../../helpers/fixtures';
import { useRole } from '../../helpers/roles';
import { uniqueToken } from '../../helpers/test-data';
import { rolePage } from '../../helpers/visitor';
import { ResumeCenter, deleteByUrl, idFrom } from '../../pages/resume-builder.page';

// [Smoke] - Resume Builder - Test Plan, RB-6 and RB-7. See
// test-suites/smoke/smoke-resume-builder.md.
//
// RB-6 uploads two synthetic files (tests/fixtures/) under run-unique names
// and deletes them in `finally`. RB-7 only reads the dashboard.

useRole('jobseeker');

const FIXTURES = path.join(__dirname, '../../fixtures');
const token = uniqueToken();
const FILES = [
  {
    name: `playwright-test-${token}.docx`,
    mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    buffer: readFileSync(path.join(FIXTURES, 'sample-resume.docx')),
  },
  {
    name: `playwright-test-${token}.pdf`,
    mimeType: 'application/pdf',
    buffer: readFileSync(path.join(FIXTURES, 'sample.pdf')),
  },
];

test('RB-6: Upload a resume file', { tag: ['@no-prod', '@desktop-only'] }, async ({ page, browser }, testInfo) => {
  const center = new ResumeCenter(page);
  try {
    // 1. Upload the .docx, then the .pdf.
    for (const file of FILES) {
      await center.open();
      await center.upload(file);
    }

    // 2. Both are listed by file name, and each download link answers 200.
    await center.open();
    for (const file of FILES) {
      const link = center.item('Uploaded Resumes', file.name);
      await expect(link).toBeVisible();
      const href = await link.getAttribute('href');
      expect(href, `${file.name} links to its download`).toMatch(/^\/media\/\d+\/download/);
      const response = await page.request.get(href!);
      expect(response.status(), `${file.name} downloads`).toBe(200);
    }
  } finally {
    const cleanup = await rolePage(browser, testInfo, 'jobseeker');
    try {
      const cleanupCenter = new ResumeCenter(cleanup);
      await cleanupCenter.open();
      const hrefs = await Promise.all(
        FILES.map((file) => cleanupCenter.item('Uploaded Resumes', file.name).first().getAttribute('href', { timeout: 2000 }).catch(() => null)),
      );
      for (const href of hrefs) {
        const mid = href && idFrom(href, 'media');
        if (mid) await deleteByUrl(cleanup, `/media/${mid}/delete-uploaded-resume`);
      }
    } finally {
      await cleanup.context().close();
    }
  }
});

test('RB-7: My Resume Center link on the dashboard', { tag: '@no-prod' }, async ({ page }) => {
  const uid = await new ResumeCenter(page).open();

  // 1. The dashboard's Quick Links has "My Resume Center"; it opens My
  // Resume Center.
  await page.goto(`/user/${uid}`);
  const quickLinks = page
    .locator('main .block')
    .filter({ has: page.getByRole('heading', { name: 'Quick Links' }) })
    .first();
  const link = quickLinks.getByRole('link', { name: 'My Resume Center', exact: true });
  await expect(link).toBeVisible();
  await link.click();
  await expect(page).toHaveURL(new RegExp(`/user/${uid}/my-resumes$`));
  await expect(page.getByRole('heading', { name: 'My Resume Center', level: 1 })).toBeVisible();
});
