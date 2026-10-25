import { defineConfig, devices } from '@playwright/test';
import base from './playwright.config';

/**
 * `npm run screenshots`: redraws docs/screenshots/ for the README on a phone
 * viewport, with invented data and a fixed clock and time zone.
 */
export default defineConfig({
  ...base,
  testDir: 'e2e/screenshots',
  testMatch: /\.screens\.ts$/,
  retries: 0,
  projects: [
    {
      name: 'readme',
      use: { ...devices['Pixel 7'], deviceScaleFactor: 2, locale: 'en-GB', timezoneId: 'UTC' },
    },
  ],
});
