import { expect, test } from '@playwright/test';
import { expectNoSeriousA11yViolations } from './support/app';

test('an invalid routine is rejected until it is fixed', async ({ page }) => {
  await page.goto('/routines');
  await expect(page.getByText('No custom routines yet')).toBeVisible();
  await expectNoSeriousA11yViolations(page, 'Routines');

  await page.getByRole('link', { name: 'New routine' }).first().click();
  await expect(page.getByRole('main').getByRole('heading', { name: 'New routine' })).toBeVisible();

  // Nothing filled in: both rules fail and nothing is saved.
  const create = page.getByRole('button', { name: 'Create routine' });
  await create.click();
  await expect(page.getByText('Routine name cannot be empty.')).toBeVisible();
  await expect(page.getByText('A routine needs at least one exercise.')).toBeVisible();
  await expect(page).toHaveURL(/\/routines\/new$/);
  await expectNoSeriousA11yViolations(page, 'routine editor with errors');

  // A name alone is still not a routine.
  await page.getByLabel('Routine name').fill('Upper A');
  await create.click();
  await expect(page.getByText('Routine name cannot be empty.')).toHaveCount(0);
  await expect(page.getByText('A routine needs at least one exercise.')).toBeVisible();

  // Add one exercise from the picker and it saves.
  await page.getByRole('button', { name: '+ Add exercise' }).click();
  await expectNoSeriousA11yViolations(page, 'exercise picker');
  await page.getByRole('button', { name: /Pec Deck/ }).click();
  await expect(page.getByText('Pec Deck / Chest Fly Machine')).toBeVisible();
  await create.click();

  await expect(page).toHaveURL(/\/routines$/);
  await expect(page.getByRole('heading', { name: 'Upper A' })).toBeVisible();
  await expect(page.getByText('No custom routines yet')).toHaveCount(0);
});
