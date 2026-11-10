import type { Page } from '@playwright/test';

// The GTM container IDs the page's tracking snippet loads, distinct and
// sorted, so a test can check the page has exactly the expected container.
//
// Only the snippet counts, not any "GTM-…" text elsewhere in the page (a blog
// post, a link): Drupal's google_tag module puts the IDs in
// drupalSettings.gtm.tagIds, and its gtm.js adds a loader script for each
// (https://www.googletagmanager.com/gtm.js?id=GTM-…). Both are read. The
// loader script is in the page even though tests block googletagmanager.com
// (tests/helpers/blocked-hosts.mts); only its download fails.
export async function gtmContainerIds(page: Page): Promise<string[]> {
  const ids = await page.evaluate(() => {
    const settings = (
      window as { drupalSettings?: { gtm?: { tagIds?: unknown } } }
    ).drupalSettings;
    const tagIds = settings?.gtm?.tagIds;
    const fromSettings = Array.isArray(tagIds) ? tagIds.map(String) : [];
    const fromLoaders = Array.from(
      document.querySelectorAll<HTMLScriptElement>(
        'script[src*="googletagmanager.com/gtm.js"]',
      ),
      (script) => new URL(script.src).searchParams.get('id') ?? '',
    );
    return [...fromSettings, ...fromLoaders].filter(Boolean);
  });
  return [...new Set(ids)].sort();
}
