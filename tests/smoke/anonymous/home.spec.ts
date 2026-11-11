import { test, expect } from '../../helpers/fixtures';
import { HomePage } from '../../pages/home.page';
import { expectedGtmId } from '../../helpers/environment';
import { gtmContainerIds } from '../../helpers/gtm';

// [Smoke] - Public Site - General - Test Plan, HP-1/HP-3/HP-4.
// See test-plans/smoke-public-site.md.

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

// The pages HP-3 checks for the GTM container: the homepage plus 2 pages
// built differently (the Job Search app and the login form).
const GTM_PAGES = [
  { name: 'homepage', path: '/' },
  { name: 'Job Search', path: '/job-search' },
  { name: 'login page', path: '/user/login' },
];

// The GTM ID is in the HTML whatever the device, so mobile skips this.
for (const { name, path } of GTM_PAGES) {
  test(
    `HP-3: ${name} loads the GTM container expected for this environment`,
    { tag: '@desktop-only' },
    async ({ page, baseURL }) => {
      const response = await page.goto(path);
      // Drupal's 404 and error pages include GTM too, so check the page
      // itself loaded before trusting the ID.
      expect(response?.status(), `HTTP status of ${path}`).toBe(200);
      expect(await gtmContainerIds(page), `GTM containers on ${path}`).toEqual([
        expectedGtmId(baseURL!),
      ]);
    },
  );
}

// The Decision Tree has 2 levels: a path under "Choose a path", then an
// answer under "Tell us more.". Each pick reloads only the block and changes
// the cards. Only the structure is checked, not the wording: editors change it, and Production may differ from QA. Nothing is
// saved; following an option is just a GET.
test('HP-4: homepage Decision Tree walks every path', async ({ page }) => {
  const home = new HomePage(page);

  // Checked after every step: every card has a title, a loaded image and a
  // link. Returns the card titles.
  const checkStep = async (): Promise<string[]> => {
    await expect(home.decisionTreeCards().first()).toBeVisible();
    for (const card of await home.decisionTreeCards().all()) {
      await expect(card.getByRole('heading', { level: 3 })).not.toBeEmpty();
      await expect(card.getByRole('link')).toHaveAttribute('href', /\S/);
      const image = card.locator('img');
      await image.scrollIntoViewIfNeeded();
      await expect.poll(() => home.imageNaturalWidth(image)).toBeGreaterThan(0);
    }
    return home.decisionTreeCardTitles();
  };

  // The cards before any choice, noted in the Start step.
  let startCards: string[] = [];

  // Picks a path and checks the step after it: the cards change from the
  // previous step and differ from the starting cards. Returns that step's cards.
  const pickPath = async (path: string, previousCards: string[]) => {
    await home.pickDecisionTreeOption(0, path);
    await expect(home.decisionTreeQuestionDropdown(0)).toHaveJSProperty('open', false);
    await expect(home.decisionTreeFollowUp()).toBeVisible();
    await expect(home.decisionTreeQuestionToggle(1)).toHaveText('Make a selection');
    expect((await home.decisionTreeOptionTexts(1)).length).toBeGreaterThanOrEqual(2);
    await expect(home.resetDecisionTreeButton()).toBeVisible();
    await expect
      .poll(() => home.decisionTreeCardTitles(), { message: `cards change after "${path}"` })
      .not.toEqual(previousCards);
    const cards = await checkStep();
    expect(cards, `"${path}" cards differ from the starting cards`).not.toEqual(startCards);
    return cards;
  };

  // Picks an answer and checks its cards differ from the path's.
  const pickAnswer = async (answer: string, pathCards: string[]) => {
    // The cards on screen right now: the path's, or the previous answer's.
    const before = await home.decisionTreeCardTitles();
    await home.pickDecisionTreeOption(1, answer);
    await expect(home.decisionTreeQuestionDropdown(1)).toHaveJSProperty('open', false);
    // Wait for this answer's cards to replace them.
    await expect
      .poll(() => home.decisionTreeCardTitles(), { message: `cards change after "${answer}"` })
      .not.toEqual(before);
    const cards = await checkStep();
    expect(cards, `"${answer}" cards differ from the path's cards`).not.toEqual(pathCards);
    return cards;
  };

  await home.goto();
  let paths: string[] = [];

  await test.step('Start', async () => {
    await expect(home.decisionTreeToggle()).toHaveText('Choose a path');
    paths = await home.decisionTreeOptionTexts(0);
    expect(paths.length).toBeGreaterThanOrEqual(2);
    await expect(home.decisionTreeCards()).toHaveCount(3);
    startCards = await checkStep();
    await expect(home.decisionTreeFollowUp()).toBeHidden();
    await expect(home.resetDecisionTreeButton()).toBeHidden();
  });

  // Each path with its first answer. Picking the next path straight after
  // also checks that changing the path resets "Tell us more.".
  let previousCards = startCards;
  const answersByPath = new Map<string, string[]>();
  for (const path of paths) {
    await test.step(`Path "${path}" and its first answer`, async () => {
      const pathCards = await pickPath(path, previousCards);
      const answers = await home.decisionTreeOptionTexts(1);
      answersByPath.set(path, answers);
      previousCards = await pickAnswer(answers[0], pathCards);
    });
  }

  await test.step(`Every answer of "${paths[0]}"`, async () => {
    const pathCards = await pickPath(paths[0], previousCards);
    const seen: string[][] = [];
    for (const answer of await home.decisionTreeOptionTexts(1)) {
      const cards = await pickAnswer(answer, pathCards);
      expect(seen, `"${answer}" shows its own cards`).not.toContainEqual(cards);
      seen.push(cards);
    }
  });

  // An answer of the first path is chosen at this point. pickPath runs the
  // full "after an option" checks (dropdown closes, "Make a selection",
  // Reset shows, cards change).
  await test.step('Changing the path resets "Tell us more."', async () => {
    const before = await home.decisionTreeCardTitles();
    await pickPath(paths[1], before);
    await expect
      .poll(() => home.decisionTreeOptionTexts(1))
      .toEqual(answersByPath.get(paths[1]));
  });

  await test.step('Reset selections', async () => {
    await home.resetDecisionTreeButton().click();
    await expect(home.decisionTreeToggle()).toHaveText('Choose a path');
    await expect(home.decisionTreeFollowUp()).toBeHidden();
    await expect(home.resetDecisionTreeButton()).toBeHidden();
    await expect.poll(() => home.decisionTreeCardTitles()).toEqual(startCards);
    await checkStep();
  });

  await test.step('A card opens its page', async () => {
    await pickPath(paths[0], startCards);
    // Cards can link anywhere, so open the first one, whatever its page.
    const card = home.decisionTreeCards().first().getByRole('link');
    const href = (await card.getAttribute('href'))!;
    // The page's own response, after any redirects. Its status is the check:
    // the page title isn't, since a real page's title can contain any word.
    const response = page.waitForResponse(
      (r) =>
        r.request().isNavigationRequest() &&
        r.frame() === page.mainFrame() &&
        (r.status() < 300 || r.status() >= 400),
    );
    // The link may be relative, so resolve it against the homepage address.
    const linkUrl = new URL(href, page.url()).href;
    await card.click();
    const finalResponse = await response;
    expect(finalResponse.status(), `HTTP status of ${href}`).toBe(200);
    // The card's link may redirect, so the browser can end up somewhere else.
    // Check the navigation started at the card's link, then that the browser
    // shows the page it was redirected to.
    let firstRequest = finalResponse.request();
    while (firstRequest.redirectedFrom()) firstRequest = firstRequest.redirectedFrom()!;
    expect(firstRequest.url(), 'the click followed the card link').toBe(linkUrl);
    await expect(page).toHaveURL(finalResponse.url());
  });
});
