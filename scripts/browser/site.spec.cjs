const { test: base, expect } = require('@playwright/test');

// Exercise real DOM, native media and focus in each engine. Only weather is isolated:
// a deliberately incomplete response also verifies the existing offline fallback.
const test = base.extend({
  page: async ({ page }, use) => {
    const failures = [];
    page.on('pageerror', error => failures.push(error.message));
    page.on('response', response => {
      if (response.url().startsWith('http://127.0.0.1:4188/') && response.status() >= 400) {
        failures.push(`${response.status()} ${response.url()}`);
      }
    });
    page.on('requestfailed', request => {
      const error = request.failure()?.errorText || 'unknown network error';
      // Navigation/player changes can cancel an in-flight load intentionally.
      if (request.url().startsWith('http://127.0.0.1:4188/') && !/ERR_ABORTED|cancelled|canceled/i.test(error)) {
        failures.push(`${error} ${request.url()}`);
      }
    });
    await page.route('https://api.met.no/**', route => route.fulfill({
      status: 200, contentType: 'application/json', body: '{}',
    }));
    await use(page);
    expect(failures, 'No script errors or failed local resources').toEqual([]);
  },
});

const menu = page => page.locator('.menu-toggle');
const mobile = page => page.viewportSize().width <= 1000;
const noOverflow = async page => {
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
};
const unlocked = async page => {
  await expect(page.locator('body')).not.toHaveClass(/menu-open/);
  await expect(page.locator('main')).toHaveJSProperty('inert', false);
  await expect(page.locator('.site-header-shell')).not.toHaveAttribute('aria-modal', 'true');
};
async function navTo(page, hash) {
  if (mobile(page)) await menu(page).click();
  await page.locator(`#navigation a[href="${hash}"]`).click();
}
async function chooseTheme(page, choice) {
  if (mobile(page)) {
    await menu(page).click();
    await page.locator('#theme-choice').selectOption(choice);
    await page.keyboard.press('Escape');
  } else {
    await page.locator('.theme-picker > summary').click();
    await page.locator(`.theme-options label:has(input[value="${choice}"])`).click();
    await page.keyboard.press('Escape');
    await expect(page.locator('.theme-picker > summary')).toBeFocused();
  }
}

test('section links, reading position, direct stories and browser history', async ({ page }) => {
  await page.goto('./');
  await navTo(page, '#training');
  await expect(page).toHaveURL(/#training$/);
  await expect(page.locator('#training')).toBeFocused();
  await expect(page.locator('#navigation a[href="#training"]')).toHaveAttribute('aria-current', 'location');
  await expect.poll(async () => page.locator('#training').evaluate(element => {
    const header = document.querySelector('.site-header').getBoundingClientRect();
    return element.getBoundingClientRect().top >= header.bottom - 2;
  })).toBe(true);
  await unlocked(page);
  await page.locator('.portal-water').click();
  await expect(page.locator('#water')).toHaveJSProperty('open', true);
  await expect(page.locator('#water > summary')).toBeFocused();
  await page.goBack();
  await expect(page).toHaveURL(/#training$/);
  await page.goto('./#ride');
  await expect(page.locator('#ride')).toHaveJSProperty('open', true);
  await noOverflow(page);
});

test('mobile menu traps keyboard focus, Escape restores it and resizing unlocks the page', async ({ page, browserName }, testInfo) => {
  await page.setViewportSize({ width: 390, height: 844 });
  // macOS WebKit uses Option+Tab to include all native controls without an OS preference change.
  const tabKey = process.platform === 'darwin' && browserName === 'webkit' ? 'Alt+Tab' : 'Tab';
  await page.goto('./');
  await menu(page).focus();
  await page.keyboard.press('Enter');
  await expect(page.locator('#navigation a[href="#training"]')).toBeFocused();
  await expect(page.locator('main')).toHaveJSProperty('inert', true);
  await page.keyboard.press(`Shift+${tabKey}`);
  await expect(menu(page)).toBeFocused();
  await page.keyboard.press(`Shift+${tabKey}`);
  await expect(page.locator('.nav-contact')).toBeFocused();
  await page.keyboard.press(tabKey);
  await expect(menu(page)).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(menu(page)).toBeFocused();
  await unlocked(page);
  await menu(page).click();
  await page.locator('#navigation a[href="#water"]').click();
  await expect(page.locator('#water')).toHaveJSProperty('open', true);
  await expect(page.locator('#water > summary')).toBeFocused();
  await unlocked(page);
  await menu(page).click();
  await page.locator('#theme-choice').focus();
  await expect(page.locator('#theme-choice')).toBeFocused();
  await page.setViewportSize({ width: 1440, height: 900 });
  // Keep the rendered breakpoint state available with failure diagnostics.
  await page.screenshot({ path: testInfo.outputPath('menu-resized-wide.png') });
  await expect(page.locator('#navigation a[href="#training"]')).toBeFocused();
  await unlocked(page);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({ path: testInfo.outputPath('menu-resized-narrow.png') });
  await expect(menu(page)).toBeFocused();
  await expect(menu(page)).toHaveAttribute('aria-expanded', 'false');
  await page.locator('#water > summary').focus();
  await page.setViewportSize({ width: 1440, height: 900 });
  await expect(page.locator('#water > summary')).toBeFocused();
});

test('theme choices persist, follow the system and apply on the 404 page', async ({ page }) => {
  await page.goto('./');
  const background = () => page.locator('body').evaluate(element => getComputedStyle(element).backgroundColor);
  const light = await background();
  await chooseTheme(page, 'dark');
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  await expect.poll(background).not.toBe(light);
  await page.reload();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  await page.goto('404.html');
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  await page.getByRole('link', { name: 'На главную' }).click();
  await chooseTheme(page, 'system');
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'system');
  await page.emulateMedia({ colorScheme: 'light' });
  await expect.poll(background).toBe(light);
  await page.emulateMedia({ colorScheme: 'dark' });
  await expect.poll(background).not.toBe(light);
  await chooseTheme(page, 'light');
  await expect.poll(background).toBe(light);
});

test('one action plays actual video, switches audio and keeps captions and focus', async ({ page }) => {
  const downloads = [];
  page.on('request', request => { if (/\.mp4(?:\?|$)/.test(request.url())) downloads.push(request.url()); });
  await page.goto('./#results');
  expect(downloads, 'Videos must not download before the visitor chooses one').toEqual([]);
  const stories = page.locator('.video-story');
  const first = page.locator('#andrey-finish-video');
  const second = page.locator('#andrey-coaching-video');
  const compact = page.viewportSize().width <= 760;
  const trigger = index => stories.nth(index).locator(compact ? ':scope > summary' : '.video-play');
  await trigger(0).focus();
  await trigger(0).press('Enter');
  await expect.poll(() => first.evaluate(video => !video.paused && video.currentTime > 0)).toBe(true);
  await expect(first).toBeFocused();
  // Native caption preferences differ by OS. Request the real track through its API;
  // parsing and cue loading still run in the browser, without substituting media.
  await first.evaluate(video => { video.textTracks[0].mode = 'showing'; });
  await expect.poll(() => first.evaluate(video => video.textTracks[0]?.cues?.length || 0)).toBeGreaterThan(0);
  await expect(first).toHaveJSProperty('videoWidth', 720);
  await expect(first).toHaveJSProperty('videoHeight', 1280);
  await trigger(1).click();
  await expect.poll(() => second.evaluate(video => !video.paused && video.currentTime > 0)).toBe(true);
  await expect(first).toHaveJSProperty('paused', true);
  if (compact) {
    await expect(stories.nth(0)).toHaveJSProperty('open', false);
    await trigger(1).click();
    await expect(second).toHaveJSProperty('paused', true);
    await expect(trigger(1)).toBeFocused();
  }
  await page.setViewportSize({ width: compact ? 1440 : 390, height: 900 });
  await expect(page.locator('video')).toHaveCount(2);
  await expect(second).toHaveJSProperty('paused', true);
  await noOverflow(page);
});

test('local sprite references survive dynamic tarot updates and resources render', async ({ page }) => {
  await page.goto('./');
  await page.locator('[data-tarot-deal]').click();
  await expect(page.locator('.tarot-card.is-revealed')).toHaveCount(3);
  await expect(page.locator('[data-tarot-status]')).not.toBeEmpty();
  const firstSpread = await page.locator('[data-tarot-status]').textContent();
  await page.locator('[data-tarot-deal]').click();
  await expect(page.locator('.tarot-card.is-revealed')).toHaveCount(0);
  await page.locator('[data-tarot-deal]').click();
  await expect(page.locator('[data-tarot-status]')).not.toHaveText(firstSpread);
  const missing = await page.locator('use').evaluateAll(async elements => {
    const cache = new Map();
    const errors = [];
    for (const element of elements) {
      const url = new URL(element.getAttribute('href'), document.baseURI);
      const id = url.hash.slice(1);
      url.hash = '';
      if (!cache.has(url.href)) cache.set(url.href, new DOMParser().parseFromString(await (await fetch(url)).text(), 'image/svg+xml'));
      if (!cache.get(url.href).getElementById(id)) errors.push(id);
    }
    return errors;
  });
  expect(missing).toEqual([]);
  await page.locator('.channel-photo').scrollIntoViewIfNeeded();
  await expect.poll(() => page.locator('.channel-photo').evaluate(image => image.complete && image.naturalWidth > 0)).toBe(true);
  await expect.poll(() => page.evaluate(() => document.fonts.status)).toBe('loaded');
  await noOverflow(page);
});

test('320px layout keeps open content inside the page in both themes', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 740 });
  await page.goto('./');
  for (const theme of ['light', 'dark']) {
    await chooseTheme(page, theme);
    await page.locator('.service > summary').first().click();
    await page.locator('.service[open] .service-body').first().scrollIntoViewIfNeeded();
    await noOverflow(page);
    await page.locator('.service[open] > summary').first().click();
    await navTo(page, '#contact');
    await noOverflow(page);
  }
});

test('native content, navigation, video controls and system theme work without JavaScript', async ({ browser, baseURL }, testInfo) => {
  const context = await browser.newContext({
    javaScriptEnabled: false,
    viewport: testInfo.project.use.viewport,
    colorScheme: 'light',
    reducedMotion: 'reduce',
  });
  try {
    const page = await context.newPage();
    await page.goto(baseURL);
    await expect(page.locator('.menu-toggle')).toBeHidden();
    await page.locator('#navigation a[href="#training"]').click();
    await expect(page).toHaveURL(/#training$/);
    const service = page.locator('.service').first();
    await service.locator('summary').click();
    await expect(service.locator('.service-body')).toBeVisible();
    await expect(page.locator('figure.video-story')).toHaveCount(2);
    await expect(page.locator('video').first()).toHaveAttribute('controls', '');
    await expect(page.locator('.video-play').first()).toBeHidden();
    await expect(page.locator('.tarot-card-toggle').first()).toBeHidden();
    const light = await page.locator('body').evaluate(element => getComputedStyle(element).backgroundColor);
    await page.emulateMedia({ colorScheme: 'dark' });
    await expect.poll(() => page.locator('body').evaluate(element => getComputedStyle(element).backgroundColor)).not.toBe(light);
    await noOverflow(page);
  } finally {
    await context.close();
  }
});
