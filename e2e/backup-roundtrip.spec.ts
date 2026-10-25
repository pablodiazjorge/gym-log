import { readFileSync } from 'node:fs';
import { expect, test } from '@playwright/test';
import {
  acceptNextDialog,
  expectNoSeriousA11yViolations,
  homeHeading,
  openHomeWith,
} from './support/app';
import { demoPushSession } from './support/demo-data';

test('a session survives export, deletion and import', async ({ page }, testInfo) => {
  await openHomeWith(page, { gym_sessions: [demoPushSession] });

  // Export: the backup is one JSON file with every session in it.
  const download = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Export' }).click();
  const backupPath = testInfo.outputPath('backup.json');
  await (await download).saveAs(backupPath);
  const backup = JSON.parse(readFileSync(backupPath, 'utf8'));
  expect(backup.version).toBe('2.0');
  expect(backup.sessions.map((s: { id: string }) => s.id)).toEqual([demoPushSession.id]);

  // Delete it from History, the only screen that can.
  await page.getByRole('main').getByRole('link', { name: 'History' }).click();
  await expect(page.getByText('1 sessions logged')).toBeVisible();
  await expectNoSeriousA11yViolations(page, 'History');
  const confirmDelete = acceptNextDialog(page);
  await page.getByRole('button', { name: /^Delete the session of/ }).click();
  expect(await confirmDelete).toBe('Delete this session?');
  await expect(page.getByText('No sessions yet')).toBeVisible();

  // Import the file back from Home.
  await page.goto('/');
  await expect(homeHeading(page)).toBeVisible();
  const chooser = page.waitForEvent('filechooser');
  const importReport = acceptNextDialog(page);
  await page.getByRole('button', { name: 'Import' }).click();
  await (await chooser).setFiles(backupPath);
  expect(await importReport).toBe('Imported 1 new session.');

  await page.getByRole('main').getByRole('link', { name: 'History' }).click();
  await expect(page.getByText('1 sessions logged')).toBeVisible();
  await expect(page.getByRole('main').getByText('Incline Machine Press')).toBeVisible();
});
