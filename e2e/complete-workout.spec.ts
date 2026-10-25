import { expect, test } from '@playwright/test';
import { expectNoSeriousA11yViolations, homeHeading } from './support/app';

test('a full workout is logged from Home and lands in History', async ({ page }) => {
  await page.goto('/');
  await expect(homeHeading(page)).toBeVisible();
  await expectNoSeriousA11yViolations(page, 'Home');

  // The built-in Abs day has one choice group: pick the exercise, then start.
  await page.getByRole('button', { name: /^Abs/ }).click();
  await expect(page.getByText('Pick at least one exercise to start')).toBeVisible();
  await expectNoSeriousA11yViolations(page, 'exercise selection');

  await page.getByRole('button', { name: /Cable Crunch/ }).click();
  await page.getByRole('button', { name: 'Start workout' }).click();
  await expect(page.getByRole('heading', { name: 'Cable Crunch' })).toBeVisible();
  await expectNoSeriousA11yViolations(page, 'active workout');

  // Cable Crunch comes with 2 warm-ups and 4 work sets, all pre-filled.
  const completeSet = page.getByRole('button', { name: 'Set completed' });
  await expect(completeSet).toHaveCount(6);
  for (let remaining = 5; remaining >= 0; remaining--) {
    await completeSet.first().click();
    await expect(completeSet).toHaveCount(remaining);
  }

  // Closing the last set opens the summary.
  await expect(page.getByRole('heading', { name: 'Workout complete!' })).toBeVisible();
  await expect(page.getByText('4 sets + 2 warm-up')).toBeVisible();
  await expectNoSeriousA11yViolations(page, 'workout summary');
  await page.getByRole('button', { name: 'Save & close' }).click();

  // Back on Home: it is the last session and nothing is left in progress.
  await expect(homeHeading(page)).toBeVisible();
  await expect(page.getByText('Last', { exact: true }).locator('..')).toContainText('Abs');
  await expect(page.getByText('Unfinished session')).toHaveCount(0);

  await page.getByRole('main').getByRole('link', { name: 'History' }).click();
  await expect(page.getByText('1 sessions logged')).toBeVisible();
  await expect(page.getByRole('main').getByText('Cable Crunch')).toBeVisible();
  await expectNoSeriousA11yViolations(page, 'History');
});
