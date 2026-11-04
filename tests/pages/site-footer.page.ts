import { type Locator, type Page } from '@playwright/test';

// The site footer, the same on every page. The contact phone number is
// plain text, not a link; the email address is a mailto: link.
export class SiteFooter {
  readonly page: Page;
  readonly footer: Locator;
  readonly contactHeading: Locator;
  readonly emailLink: Locator;

  constructor(page: Page) {
    this.page = page;
    this.footer = page.getByRole('contentinfo');
    this.contactHeading = this.footer.getByRole('heading', { name: 'Contact CareerForce' });
    this.emailLink = this.footer.locator('a[href^="mailto:"]');
  }

  link(name: string): Locator {
    return this.footer.getByRole('link', { name, exact: true });
  }
}
