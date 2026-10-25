import { expect, test } from '@playwright/test';
import { homeHeading, openHomeWith } from '../support/app';
import { DEMO_NOW, demoHistory } from './demo-history';

/**
 * Regenerates the three README screenshots in docs/screenshots/ from invented
 * data: `npm run screenshots`. Not part of the e2e suite.
 */

const shot = (name: string) => ({
  path: `docs/screenshots/${name}.png`,
  animations: 'disabled' as const,
});

test.beforeEach(async ({ page }) => {
  // Start the clock at DEMO_NOW but let it run: Chart.js animates on Date.now()
  await page.clock.install({ time: DEMO_NOW });
  await openHomeWith(page, { gym_sessions: demoHistory() });
});

test('home', async ({ page }) => {
  await expect(homeHeading(page)).toBeVisible();
  await page.screenshot(shot('home'));
});

test('workout', async ({ page }) => {
  await page.getByRole('button', { name: /^Push/ }).click();
  await page.getByRole('button', { name: /Incline Machine Press/ }).click();
  await page.getByRole('button', { name: 'Start workout' }).click();
  await expect(page.getByRole('heading', { name: 'Incline Machine Press' })).toBeVisible();
  // Close the warm-up so the picture shows a logged set above the open ones
  await page.getByRole('button', { name: 'Set completed' }).first().click();
  await expect(page.getByRole('button', { name: 'Edit set 1' })).toBeVisible();
  // Scroll as a user would: the open set starts just below the sticky exercise
  // header, so its "Set completed" is not hidden under the sticky footer
  await page.evaluate(() => {
    const card = document.querySelector('[aria-label="Set 2 weight in kg"]')!.closest('.rounded-xl')!;
    const header = document.querySelector('header.sticky.z-40')!;
    const top = card.getBoundingClientRect().top - header.getBoundingClientRect().bottom - 8;
    window.scrollTo(0, window.scrollY + top);
  });
  await page.screenshot(shot('workout'));
});

test('analysis', async ({ page }) => {
  await page.goto('/analysis/exercise/incline-machine-press');
  await expect(page.locator('canvas').first()).toBeVisible();
  await page.waitForTimeout(1500); // let the chart finish its 1 s entry animation
  await page.screenshot(shot('analysis'));
});
