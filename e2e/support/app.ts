import { expect, Page, test } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

/**
 * Small helpers shared by the e2e specs. Everything the app knows lives in
 * localStorage (ADR-0002), so every test starts from an empty browser profile
 * and seeds what it needs here.
 */

/** Open Home with the given localStorage entries already in place */
export async function openHomeWith(page: Page, storage: Record<string, unknown>): Promise<void> {
  await page.goto('/');
  await page.evaluate((entries) => {
    for (const [key, value] of Object.entries(entries)) {
      localStorage.setItem(key, JSON.stringify(value));
    }
  }, storage);
  await page.reload();
  await expect(homeHeading(page)).toBeVisible();
}

/** The page title on Home (the shared header repeats it, so scope to <main>) */
export function homeHeading(page: Page) {
  return page.getByRole('main').getByRole('heading', { name: 'Gym Tracker' });
}

/**
 * Accept the next confirm() or alert() and hand back its text. The app asks
 * before destructive actions and reports the result of an import this way.
 */
export function acceptNextDialog(page: Page): Promise<string> {
  return new Promise((resolve) => {
    page.once('dialog', async (dialog) => {
      const message = dialog.message();
      await dialog.accept();
      resolve(message);
    });
  });
}

/**
 * Fail on serious or critical axe findings for what is on screen. Moderate and
 * minor ones are reported by axe too but do not gate the suite (ADR-0016).
 */
export async function expectNoSeriousA11yViolations(page: Page, screen: string): Promise<void> {
  await test.step(`axe: ${screen}`, async () => {
    const { violations } = await new AxeBuilder({ page }).analyze();
    const serious = violations
      .filter((v) => v.impact === 'serious' || v.impact === 'critical')
      .map(
        (v) =>
          `${v.impact} ${v.id} (${v.help}): ${v.nodes.map((n) => n.target.join(' ')).join(', ')}`,
      );
    expect(serious, `serious accessibility violations on ${screen}`).toEqual([]);
  });
}
