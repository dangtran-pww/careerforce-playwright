import { test, expect } from '../../helpers/fixtures';
import { HomePage } from '../../pages/home.page';
import { expectedGtmId } from '../../helpers/environment';

// [Smoke] - Anonymous - Test Plan, HP-1/HP-3/HP-4.
// See test-plans/smoke-anonymous.md.

// The homepage's listing sections, each a Drupal view (see HomePage.sectionItems).
const HOME_SECTIONS = [
  {
    name: 'Upcoming Events',
    view: '.view-display-id-upcoming_events',
    moreLink: 'Find a filterable list of all events, workshops and appointments',
    moreHref: '/education-and-training/events',
  },
  {
    name: 'Upcoming Training Programs',
    view: '.view-display-id-upcoming_training_programs',
    moreLink: 'Find a filterable list of all training programs',
    moreHref: '/training-programs',
  },
  {
    name: 'Connect to our Services',
    view: '.view-id-featured_services',
    moreLink: 'Find a filterable list of all programs and services',
    moreHref: '/programs-services',
  },
  {
    name: 'CareerForce Blog',
    view: '.view-id-article_content',
    moreLink: 'Find more posts',
    moreHref: '/careerforce-blog',
  },
];

test('HP-1: homepage loads for an anonymous visitor', async ({ page }) => {
  const home = new HomePage(page);
  await home.goto();
  await expect(home.main).toBeVisible();
  await expect(home.jobSearchHeading).toBeVisible();
  // The sentence has a <br> after "exploration", so textContent would run
  // "explorationand" together; innerText renders it as a space.
  await expect(home.jobSearchIntro).toHaveText(
    "CareerForce is Minnesota's official career exploration and job search resource.",
    { useInnerText: true },
  );
  await expect(home.jobSearchKeywordInput).toBeVisible();
  await expect(home.jobSearchLocationInput).toBeVisible();
  await expect(home.jobSearchDistanceSelect).toBeVisible();
  await expect(home.jobSearchButton).toBeVisible();
  await expect(home.whatBringsYouHereHeading).toBeVisible();
  await expect(home.decisionTreeToggle()).toBeVisible();
  await expect(home.decisionTreeToggle()).toHaveText('Choose a path');
  await expect(home.decisionTreeCards()).toHaveCount(3);
  for (const card of await home.decisionTreeCards().all()) {
    const image = card.locator('img');
    await image.scrollIntoViewIfNeeded();
    await expect(image).toBeVisible();
    await expect.poll(() => home.imageNaturalWidth(image)).toBeGreaterThan(0);
    await expect(card.getByRole('heading', { level: 3 })).not.toBeEmpty();
  }
  await expect(home.upcomingEventsHeading).toBeVisible();
  await expect(home.exploreCareersHeading).toBeVisible();
  await expect(home.upcomingTrainingProgramsHeading).toBeVisible();
  await expect(home.createAccountCta).toBeVisible();
  await expect(home.connectToServicesHeading).toBeVisible();
  await expect(home.blogHeading).toBeVisible();

  // Each listing section shows at least 1 item and links to its full list.
  for (const section of HOME_SECTIONS) {
    await test.step(`${section.name} lists items`, async () => {
      await expect(home.sectionItems(section.view).first()).toBeVisible();
      const moreLink = home.sectionMoreLink(section.view, section.moreLink);
      await expect(moreLink).toBeVisible();
      await expect(moreLink).toHaveAttribute('href', section.moreHref);
    });
  }
});

// The GTM ID is in the HTML whatever the device, so mobile skips this.
test(
  'HP-3: homepage loads the GTM container expected for this environment',
  { tag: '@desktop-only' },
  async ({ page, baseURL }) => {
    const home = new HomePage(page);
    await home.goto();
    const gtmId = await home.gtmContainerId();
    expect(gtmId).toBe(expectedGtmId(baseURL!));
  },
);

// Picking a path changes the widget in place: the toggle shows the chosen
// path, a "Tell us more." question appears, and the 3 cards change. Reset
// puts everything back. Nothing is saved; it's all in the page.
test('HP-4: homepage Decision Tree widget advances to a second step', async ({
  page,
}) => {
  const home = new HomePage(page);
  await home.goto();
  const firstStepCards = await home.decisionTreeCardTitles();
  expect(firstStepCards).toHaveLength(3);

  await home.decisionTreeToggle().click();
  const option = home.firstDecisionTreeOption();
  const optionText = ((await option.textContent()) ?? '').trim();
  await option.click();

  await test.step('second step', async () => {
    await expect(home.resetDecisionTreeButton()).toBeVisible();
    await expect(home.decisionTreeToggle()).toHaveText(optionText);
    await expect(home.decisionTreeFollowUp()).toBeVisible();
    await expect
      .poll(() => home.decisionTreeCardTitles(), {
        message: 'the cards should change after picking a path',
      })
      .not.toEqual(firstStepCards);
  });

  await test.step('Reset selections', async () => {
    await home.resetDecisionTreeButton().click();
    await expect(home.decisionTreeToggle()).toHaveText('Choose a path');
    await expect(home.decisionTreeFollowUp()).toBeHidden();
    await expect(home.resetDecisionTreeButton()).toBeHidden();
    await expect.poll(() => home.decisionTreeCardTitles()).toEqual(firstStepCards);
  });
});
