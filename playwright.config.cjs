const { defineConfig } = require('@playwright/test');

module.exports = defineConfig({
  testDir: './scripts/browser',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: 0,
  workers: 2,
  timeout: 30_000,
  expect: { timeout: 8_000 },
  reporter: [['list'], ['html', { open: 'never' }]],
  use: {
    baseURL: 'http://127.0.0.1:4188/ekaterinakrainiuk/',
    reducedMotion: 'reduce',
    colorScheme: 'light',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [
    { name: 'chromium-desktop', use: { browserName: 'chromium', channel: 'chromium', viewport: { width: 1440, height: 900 } } },
    { name: 'chromium-mobile', use: { browserName: 'chromium', channel: 'chromium', viewport: { width: 390, height: 844 }, hasTouch: true } },
    { name: 'webkit-mobile', use: {
      browserName: 'webkit', viewport: { width: 390, height: 844 }, hasTouch: true,
    } },
  ],
  webServer: {
    command: 'python3 scripts/serve_test.py',
    url: 'http://127.0.0.1:4188/ekaterinakrainiuk/',
    reuseExistingServer: false,
    timeout: 15_000,
    stdout: 'ignore',
    stderr: 'ignore',
  },
});
