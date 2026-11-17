import { test, expect } from '../../helpers/fixtures';
import { useRole } from '../../helpers/roles';
import { currentUid } from '../../pages/my-events.page';
import { expectNoErrors } from '../../pages/node-form.page';
import { CAREGIVER_QUESTION, ProfilePage, VETERAN_QUESTION } from '../../pages/profile.page';

// [Smoke] - Profile - Test Plan, PF-1 to PF-3: the job seeker edits their own
// profile. See test-suites/smoke/smoke-profile.md.
//
// QA and Stage only: it edits the job seeker test account. Every field is
// read first and put back in `finally`, with synthetic values only
// (555-01xx phone numbers).

useRole('jobseeker');

test.describe('profile: the job seeker edits their own', { tag: ['@no-prod', '@desktop-only'] }, () => {
  test('PF-1: Job seeker edits a profile section', async ({ page }) => {
    const profile = new ProfilePage(page);
    const uid = await currentUid(page);
    await profile.openSection(uid, 'demographic');
    const original = await profile.alternatePhone.inputValue();
    const value = original === '651-555-0101' ? '651-555-0102' : '651-555-0101';

    try {
      await test.step('1. change the alternate phone and save', async () => {
        await profile.alternatePhone.fill(value);
        await profile.save(uid);
        await expectNoErrors(page);
      });

      await test.step('2. the section shows the new value', async () => {
        await profile.openSection(uid, 'demographic');
        await expect(profile.alternatePhone).toHaveValue(value);
      });
    } finally {
      await profile.setAlternatePhone(uid, original);
    }
  });

  test('PF-2: Job seeker sets veteran status', async ({ page }) => {
    const profile = new ProfilePage(page);
    const uid = await currentUid(page);
    await profile.openSection(uid, 'demographic');
    const original = await profile.checkedAnswer(VETERAN_QUESTION);

    try {
      // Saving Yes over Yes would prove nothing, so it is No first.
      await test.step('1. set veteran status to No and save', async () => {
        await profile.answer(VETERAN_QUESTION, 'No');
        await profile.save(uid);
      });

      await test.step('2. set veteran status to Yes and save', async () => {
        await profile.openSection(uid, 'demographic');
        await expect(
          profile.question(VETERAN_QUESTION).getByRole('radio', { name: 'No', exact: true }),
        ).toBeChecked();
        await profile.answer(VETERAN_QUESTION, 'Yes');
        await profile.save(uid);
        await expectNoErrors(page);
      });

      await test.step('3. the profile shows veteran status Yes', async () => {
        await profile.openSection(uid, 'demographic');
        await expect(
          profile.question(VETERAN_QUESTION).getByRole('radio', { name: 'Yes', exact: true }),
        ).toBeChecked();
      });
    } finally {
      if (original && original !== 'Yes') {
        await profile.setAnswer(uid, 'demographic', VETERAN_QUESTION, original);
      }
    }
  });

  test('PF-3: Sections save on their own', async ({ page }) => {
    const profile = new ProfilePage(page);
    const uid = await currentUid(page);
    await profile.openSection(uid, 'demographic');
    const originalPhone = await profile.alternatePhone.inputValue();
    const phone = originalPhone === '651-555-0103' ? '651-555-0104' : '651-555-0103';
    await profile.openSection(uid, 'military');
    const originalCaregiver = await profile.checkedAnswer(CAREGIVER_QUESTION);
    const caregiver = originalCaregiver === 'Yes' ? 'No' : 'Yes';

    try {
      await test.step('1. Demographic Information: change the alternate phone and save', async () => {
        await profile.setAlternatePhone(uid, phone);
      });

      await test.step('2. Military and Veterans: change the caregiver answer and save', async () => {
        await profile.setAnswer(uid, 'military', CAREGIVER_QUESTION, caregiver);
        await expectNoErrors(page);
      });

      await test.step('3. both changes are kept', async () => {
        await profile.openSection(uid, 'demographic');
        await expect(profile.alternatePhone).toHaveValue(phone);
        await profile.openSection(uid, 'military');
        await expect(
          profile.question(CAREGIVER_QUESTION).getByRole('radio', { name: caregiver, exact: true }),
        ).toBeChecked();
      });
    } finally {
      await profile.setAlternatePhone(uid, originalPhone);
      if (originalCaregiver) {
        await profile.setAnswer(uid, 'military', CAREGIVER_QUESTION, originalCaregiver);
      }
    }
  });
});
