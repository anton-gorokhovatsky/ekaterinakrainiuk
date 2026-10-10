const { test: base, expect } = require('@playwright/test');

// Exercise real DOM, native media and focus in each engine. Weather uses an
// incomplete response to verify its fallback; analytics is blocked so automated
// visits do not pollute the production counter or depend on a third-party script.
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
    await page.route('https://mc.yandex.ru/**', route => route.abort());
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

test('one action plays actual video, switches audio and keeps captions and focus', async ({ page, browserName }) => {
  const mediaRequests = [];
  page.on('request', request => { if (/\.mp4(?:\?|$)/.test(request.url())) mediaRequests.push(request.url()); });
  await page.goto('./#results');
  const stories = page.locator('.video-story');
  const first = page.locator('#andrey-finish-video');
  const second = page.locator('#andrey-coaching-video');
  for (const video of [first, second]) {
    await expect(video).toHaveAttribute('preload', 'none');
    await expect(video).toHaveJSProperty('autoplay', false);
    await expect(video).toHaveJSProperty('paused', true);
    await expect(video).toHaveJSProperty('currentTime', 0);
    await expect(video).toHaveJSProperty('controls', false);
  }
  // preload is a native hint, not a network guarantee. Linux WebKit can issue
  // early media requests; Chromium must still defer them until user activation.
  if (browserName === 'chromium') {
    expect(mediaRequests, 'Chromium defers MP4 requests until the visitor chooses a video').toEqual([]);
  }
  const compact = page.viewportSize().width <= 760;
  const trigger = index => stories.nth(index).locator('.video-play');
  await expect(page.locator('figure.video-story')).toHaveCount(4);
  await expect(first).toBeVisible();
  await expect(second).toBeVisible();
  await trigger(0).focus();
  await trigger(0).press('Enter');
  await expect.poll(() => first.evaluate(video => !video.paused && video.currentTime > 0)).toBe(true);
  await expect(first).toHaveJSProperty('controls', true);
  await expect(first).toBeFocused();
  // Native caption preferences differ by OS. Request the real track through its API;
  // parsing and cue loading still run in the browser, without substituting media.
  await first.evaluate(video => { video.textTracks[0].mode = 'showing'; });
  await expect.poll(() => first.evaluate(video => video.textTracks[0]?.cues?.length || 0)).toBeGreaterThan(0);
  await expect(first).toHaveJSProperty('videoWidth', 720);
  await expect(first).toHaveJSProperty('videoHeight', 1280);
  if (!compact) {
    await trigger(1).hover();
    await test.info().attach('andrey-poster-hover', {
      body: await page.locator('#andrey-review').screenshot(), contentType: 'image/png',
    });
  }
  await trigger(1).click();
  await expect.poll(() => second.evaluate(video => !video.paused && video.currentTime > 0)).toBe(true);
  await expect(first).toHaveJSProperty('paused', true);
  await expect(first).toHaveJSProperty('controls', true);
  // Switching through the visible poster pauses the other real player.
  // Native video keyboard shortcuts differ between Chromium and WebKit.
  await trigger(0).click();
  await expect(second).toHaveJSProperty('paused', true);
  await expect(trigger(1)).toBeVisible();
  await trigger(1).press('Enter');
  await expect.poll(() => second.evaluate(video => !video.paused && video.currentTime > 0)).toBe(true);
  await expect(second).toBeFocused();
  const secondPlayer = await second.elementHandle();
  await page.setViewportSize({ width: compact ? 1440 : 390, height: 900 });
  await expect(page.locator('video')).toHaveCount(4);
  expect(await second.evaluate((video, original) => video === original, secondPlayer)).toBe(true);
  await expect(second).toHaveJSProperty('paused', false);
  await expect(second).toBeFocused();
  // Switching through the visible poster pauses the other real player.
  // Native video keyboard shortcuts differ between Chromium and WebKit.
  await trigger(0).click();
  await expect(second).toHaveJSProperty('paused', true);
  await noOverflow(page);
});

test('round messages play inline with reachable controls, captions and one soundtrack', async ({ page, browserName }) => {
  await page.goto('./#maria-review');
  const maria = page.locator('#maria-review .video-story');
  const vyacheslav = page.locator('#vyacheslav-review .video-story');
  const first = maria.locator('video');
  const second = vyacheslav.locator('video');
  await expect(maria.locator('.round-video-caption')).toBeHidden();
  await expect(vyacheslav.locator('.round-video-caption')).toBeHidden();
  for (const video of [first, second]) {
    await expect(video).toHaveJSProperty('paused', true);
    await expect(video).toHaveJSProperty('controls', false);
  }
  await maria.locator('.video-play').press('Enter');
  await expect.poll(() => first.evaluate(video => !video.paused && video.currentTime > 0)).toBe(true);
  await expect(maria.locator('[data-video-toggle]')).toBeFocused();
  await expect(first).toHaveJSProperty('videoWidth', 720);
  await expect(first).toHaveJSProperty('videoHeight', 720);
  await expect.poll(() => first.evaluate(video => video.textTracks[0].cues?.length || 0)).toBeGreaterThan(0);
  await expect(maria.locator('.round-video-caption')).toContainText('Катя');
  await maria.locator('[data-video-mute]').click();
  await expect(first).toHaveJSProperty('muted', true);
  await maria.locator('[data-video-captions]').click();
  await expect(maria.locator('.round-video-caption')).toBeHidden();
  await maria.locator('[data-video-captions]').click();
  await expect(maria.locator('.round-video-caption')).toBeVisible();
  await maria.locator('[data-video-toggle]').press('Space');
  await expect(first).toHaveJSProperty('paused', true);
  const seek = maria.locator('[data-video-seek]');
  const seekBox = await seek.boundingBox();
  await seek.click({ position: { x: seekBox.width / 2, y: seekBox.height / 2 } });
  const duration = await first.evaluate(video => video.duration);
  await expect.poll(() => first.evaluate(video => video.currentTime)).toBeGreaterThan(duration * .45);
  await expect.poll(() => first.evaluate(video => video.currentTime)).toBeLessThan(duration * .55);
  // Safari can reselect native captions when media loads or its preference
  // changes. Inline playback must keep a single caption outside the circle.
  await first.evaluate(video => { video.textTracks[0].mode = 'showing'; });
  await expect.poll(() => first.evaluate(video => video.textTracks[0].mode)).toBe('hidden');
  const captionHeight = await maria.locator('.round-video-caption').evaluate(element => element.getBoundingClientRect().height);
  const copyTop = () => page.locator('#maria-review .round-review-copy').evaluate(element => element.getBoundingClientRect().top + scrollY);
  const copyPosition = await copyTop();
  for (const time of [4, 11, 20.2]) {
    await first.evaluate((video, time) => { video.currentTime = time; }, time);
    await expect.poll(() => first.evaluate(video => !video.seeking)).toBe(true);
    await expect(maria.locator('.round-video-caption')).toBeVisible();
    expect(await maria.locator('.round-video-caption').evaluate(element => element.getBoundingClientRect().height)).toBe(captionHeight);
    expect(await copyTop()).toBe(copyPosition);
  }
  await expect(maria.locator('.round-video-caption')).toHaveText('');
  await first.evaluate(video => { video.currentTime = 0.5; });
  await expect.poll(() => first.evaluate(video => !video.seeking)).toBe(true);
  const position = await first.evaluate(video => video.currentTime);
  await maria.locator('[data-video-seek]').press('End');
  await expect.poll(() => first.evaluate(video => video.currentTime)).toBeGreaterThan(position + 15);
  // The range's 0.1s step can stop just short of the media end. The caption
  // area stays open on pause; it collapses when playback actually finishes.
  await first.evaluate(video => video.play());
  await expect(first).toHaveJSProperty('ended', true);
  await expect(maria.locator('.round-video-caption')).toBeHidden();
  await maria.locator('[data-video-seek]').press('Home');
  await expect.poll(() => first.evaluate(video => video.currentTime)).toBeLessThan(1);
  await maria.locator('[data-video-toggle]').press('Enter');
  await expect.poll(() => first.evaluate(video => !video.paused && video.currentTime > 0)).toBe(true);
  await vyacheslav.locator('.video-play').click();
  await expect.poll(() => second.evaluate(video => !video.paused && video.currentTime > 0)).toBe(true);
  await expect(first).toHaveJSProperty('paused', true);
  await expect(second).toHaveJSProperty('videoWidth', 400);
  await expect(second).toHaveJSProperty('videoHeight', 400);
  await expect.poll(() => second.evaluate(video => video.textTracks[0].cues?.length || 0)).toBeGreaterThan(0);
  await second.click();
  await expect(second).toHaveJSProperty('paused', true);
  await vyacheslav.locator('.video-play').click();
  await expect(second).toHaveJSProperty('paused', false);
  if (browserName === 'chromium' && page.viewportSize().width > 1000) {
    await vyacheslav.locator('[data-video-fullscreen]').click();
    await expect.poll(() => page.evaluate(() => document.fullscreenElement?.className || '')).toContain('video-story-round');
    await vyacheslav.locator('[data-video-fullscreen]').click();
    await expect.poll(() => page.evaluate(() => document.fullscreenElement)).toBeNull();
    await expect(vyacheslav.locator('[data-video-fullscreen]')).toBeFocused();
  }
  // Pointer startup is covered above; bring the earlier player on screen
  // before checking soundtrack coordination through keyboard activation.
  const andreyPoster = page.locator('#andrey-finish-video').locator('..').locator('.video-play');
  await andreyPoster.scrollIntoViewIfNeeded();
  await andreyPoster.press('Enter');
  await expect.poll(() => page.locator('#andrey-finish-video').evaluate(video => !video.paused && video.currentTime > 0)).toBe(true);
  await expect(second).toHaveJSProperty('paused', true);
  await noOverflow(page);
});

test('a failed round-message start keeps a usable retry and readable facts', async ({ page }) => {
  await page.route('**/maria-lukyanova-limassol.mp4?*', route => route.fulfill({
    status: 200, contentType: 'video/mp4', body: 'unavailable video',
  }));
  await page.goto('./#maria-review');
  const story = page.locator('#maria-review .video-story');
  await story.locator('.video-play').click();
  await expect(story.locator('.video-status')).toContainText('Не удалось запустить видео');
  await expect(story.locator('.video-play')).toBeVisible();
  await expect(story.locator('[data-video-toggle]')).toBeEnabled();
  await expect(page.locator('#maria-review')).toContainText('1:20:01');
  await page.unroute('**/maria-lukyanova-limassol.mp4?*');
  await story.locator('.video-play').click();
  await expect.poll(() => story.locator('video').evaluate(video => !video.paused && video.currentTime > 0)).toBe(true);
  await expect(story.locator('.video-status')).toBeHidden();
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

test('Terrain text keeps its foreground aligned after resizing and remains readable at 200%', async ({ page }) => {
  await page.goto('./#channel');
  const panel = page.locator('#channel');
  await panel.scrollIntoViewIfNeeded();
  await expect(panel).toHaveClass(/is-contrast-ready/);
  for (const width of [1440, 980, 760, 390, 320]) {
    await page.setViewportSize({ width, height: 900 });
    await panel.scrollIntoViewIfNeeded();
    await expect.poll(() => panel.evaluate(element => {
      const bounds = element.getBoundingClientRect();
      return [...element.querySelectorAll('.channel-contrast-text')].every(field => {
        const [w, h] = getComputedStyle(field).getPropertyValue('--terrain-contrast-size').split(' ').map(parseFloat);
        return Math.abs(w - bounds.width) < 1 && Math.abs(h - bounds.height) < 1;
      });
    })).toBe(true);
    await noOverflow(page);
  }
  await page.addStyleTag({ content: ':root { font-size: 200%; }' });
  await panel.scrollIntoViewIfNeeded();
  const clipped = await panel.locator('.channel-title, .channel-copy, .channel-link').evaluateAll(fields =>
    fields.filter(field => field.scrollWidth > field.clientWidth + 1).map(field => field.textContent));
  expect(clipped).toEqual([]);
  const brokenWords = await panel.locator('.channel-title span').evaluateAll(spans => spans.flatMap(span => {
    const text = span.firstChild;
    return [...text.textContent.matchAll(/\S+/g)].filter(match => {
      const range = document.createRange();
      range.setStart(text, match.index);
      range.setEnd(text, match.index + match[0].length);
      return range.getClientRects().length > 1;
    }).map(match => match[0]);
  }));
  expect(brokenWords, 'the enlarged title keeps words and their punctuation together').toEqual([]);
  await expect(page.getByRole('link', { name: 'Читать в Telegram' })).toHaveAttribute('href', 'https://t.me/ekatyulyaslife');
});

test('a failed Terrain canvas keeps the complete text and channel link readable', async ({ page }) => {
  await page.addInitScript(() => {
    window.channelCanvasAttempts = 0;
    CanvasRenderingContext2D.prototype.getImageData = function () {
      window.channelCanvasAttempts++;
      throw new Error('Test canvas unavailable');
    };
  });
  await page.goto('./#channel');
  await page.locator('#channel').scrollIntoViewIfNeeded();
  await expect.poll(() => page.evaluate(() => window.channelCanvasAttempts)).toBeGreaterThan(0);
  await expect(page.locator('#channel')).not.toHaveClass(/is-contrast-ready/);
  await expect(page.locator('.channel-copy')).toHaveCSS('color', 'rgb(244, 243, 238)');
  await expect(page.locator('.channel-link')).toHaveCSS('color', 'rgb(244, 243, 238)');
  await expect(page.locator('#channel-title')).toContainText('будем танцевать');
  await noOverflow(page);
});

test.describe('Terrain movement and fallback', () => {
  test.use({ reducedMotion: 'no-preference', deviceScaleFactor: 2 });

  test('the field autoplays on screen and the separate control freezes and resumes it', async ({ page }) => {
    await page.goto('./#channel');
    const panel = page.locator('#channel'), control = panel.locator('.channel-motion');
    await panel.scrollIntoViewIfNeeded();
    await expect(control).toBeVisible();
    await expect(panel).toHaveClass(/is-contrast-ready/);
    await expect(control).toHaveAttribute('aria-pressed', 'true');
    await expect(control).toHaveAccessibleName('Остановить фон');
    expect(await control.evaluate(button => button.getBoundingClientRect().height)).toBeGreaterThanOrEqual(44);
    const density = await panel.locator('.channel-moving-art').evaluate(canvas => canvas.width / canvas.getBoundingClientRect().width);
    expect(density).toBeCloseTo(2, 1);
    await expect(control.locator('use')).toHaveAttribute('href', /#player-pause$/);
    await expect.poll(async () => Number(await panel.getAttribute('data-motion-frame'))).toBeGreaterThan(1);
    await control.focus();
    await page.keyboard.press('Enter');
    await expect(control).toHaveAttribute('aria-pressed', 'false');
    await expect(control).toHaveAccessibleName('Оживить фон');
    await expect(control.locator('use')).toHaveAttribute('href', /#player-play$/);
    const frozen = await panel.getAttribute('data-motion-frame');
    await page.waitForTimeout(400);
    expect(await panel.getAttribute('data-motion-frame')).toBe(frozen);

    // Compare the rendered artwork to the adaptive foreground from the same frame.
    const contrasts = await panel.evaluate(async element => {
      const art = element.querySelector('.channel-moving-art');
      const url = getComputedStyle(element.querySelector('.channel-title'))
        .getPropertyValue('--terrain-contrast-image').trim().slice(4, -1).replace(/^['"]|['"]$/g, '');
      const mask = new Image(); mask.src = url; await mask.decode();
      const copy = document.createElement('canvas'); copy.width = mask.width; copy.height = mask.height;
      const context = copy.getContext('2d'); context.drawImage(mask, 0, 0);
      const foreground = context.getImageData(0, 0, copy.width, copy.height).data;
      context.drawImage(art, 0, 0, copy.width, copy.height);
      const background = context.getImageData(0, 0, copy.width, copy.height).data;
      const linear = value => { value /= 255; return value <= .04045 ? value / 12.92 : ((value + .055) / 1.055) ** 2.4; };
      let contrast = Infinity;
      for (let y = 12; y < copy.height; y += 37) for (let x = 12; x < copy.width; x += 43) {
        const i = (y * copy.width + x) * 4;
        const light = .2126 * linear(background[i]) + .7152 * linear(background[i + 1]) + .0722 * linear(background[i + 2]);
        const ink = foreground[i] ? 1 : 0;
        contrast = Math.min(contrast, (Math.max(light, ink) + .05) / (Math.min(light, ink) + .05));
      }
      const icons = [];
      const bounds = element.getBoundingClientRect();
      for (const icon of element.querySelectorAll('.link-icon')) {
        const box = icon.getBoundingClientRect(), style = getComputedStyle(icon);
        const url = style.maskImage.slice(4, -1).replace(/^['"]|['"]$/g, '');
        const shape = new Image(); shape.src = url; await shape.decode();
        const strokes = document.createElement('canvas'); strokes.width = Math.ceil(box.width); strokes.height = Math.ceil(box.height);
        const c = strokes.getContext('2d'); c.drawImage(shape, 0, 0, strokes.width, strokes.height);
        const alpha = c.getImageData(0, 0, strokes.width, strokes.height).data;
        let minimum = Infinity, count = 0;
        for (let y = 0; y < strokes.height; y++) for (let x = 0; x < strokes.width; x++) {
          if (alpha[(y * strokes.width + x) * 4 + 3] < 200) continue;
          const px = Math.round((box.left - bounds.left + x) * copy.width / bounds.width);
          const py = Math.round((box.top - bounds.top + y) * copy.height / bounds.height);
          const i = (py * copy.width + px) * 4;
          const light = .2126 * linear(background[i]) + .7152 * linear(background[i + 1]) + .0722 * linear(background[i + 2]);
          const ink = foreground[i] ? 1 : 0;
          minimum = Math.min(minimum, (Math.max(light, ink) + .05) / (Math.min(light, ink) + .05)); count++;
        }
        icons.push({ minimum, count });
      }
      return { text: contrast, icons };
    });
    expect(contrasts.text).toBeGreaterThanOrEqual(4.5);
    expect(contrasts.icons).toHaveLength(2);
    for (const icon of contrasts.icons) {
      expect(icon.count, 'the canonical icon has visible, uncut strokes').toBeGreaterThan(5);
      expect(icon.minimum, 'each icon stroke contrasts with its actual background').toBeGreaterThanOrEqual(3);
    }
    // A deliberate pause survives leaving and returning to the section.
    await page.locator('#training').scrollIntoViewIfNeeded();
    await control.scrollIntoViewIfNeeded();
    await expect(control).toHaveAttribute('aria-pressed', 'false');
    expect(await panel.getAttribute('data-motion-frame')).toBe(frozen);
    await control.focus();
    await page.keyboard.press('Space');
    await expect.poll(async () => Number(await panel.getAttribute('data-motion-frame'))).toBeGreaterThan(Number(frozen));
    await page.locator('#training').scrollIntoViewIfNeeded();
    await expect.poll(() => panel.evaluate(element => {
      const r = element.getBoundingClientRect(); return r.top >= innerHeight || r.bottom <= 0;
    })).toBe(true);
    await expect(control).toHaveAttribute('aria-pressed', 'true');
    await expect(control).toHaveAccessibleName('Остановить фон');
    const outside = await panel.getAttribute('data-motion-frame');
    await page.waitForTimeout(400);
    expect(await panel.getAttribute('data-motion-frame')).toBe(outside);
    await control.scrollIntoViewIfNeeded();
    await expect(control).toHaveAttribute('aria-pressed', 'true');
    await expect.poll(async () => Number(await panel.getAttribute('data-motion-frame'))).toBeGreaterThan(Number(outside) + .35);
    await noOverflow(page);
  });

  test('a delayed foreground decode keeps the preceding complete frame readable', async ({ page }) => {
    await page.addInitScript(() => {
      window.channelDecodeGate = false;
      window.channelWaitingFrames = [];
      const decode = HTMLImageElement.prototype.decode;
      HTMLImageElement.prototype.decode = async function () {
        await decode.call(this);
        if (this.src.startsWith('data:image/png') && window.channelDecodeGate) {
          await new Promise(resolve => window.channelWaitingFrames.push(resolve));
        }
      };
    });
    await page.goto('./#channel');
    const panel = page.locator('#channel');
    await panel.scrollIntoViewIfNeeded();
    await expect(panel).toHaveClass(/is-contrast-ready/);
    await expect.poll(async () => Number(await panel.getAttribute('data-motion-frame'))).toBeGreaterThan(1);
    await page.evaluate(() => { window.channelDecodeGate = true; });
    await expect.poll(() => page.evaluate(() => window.channelWaitingFrames.length)).toBe(1);
    const visibleFrame = () => panel.evaluate(element => {
      const art = element.querySelector('.channel-moving-art');
      const pixels = art.getContext('2d').getImageData(0, 0, art.width, art.height).data;
      let checksum = 0;
      for (let i = 0; i < pixels.length; i += 103) checksum = (checksum * 31 + pixels[i]) >>> 0;
      return {
        phase: element.dataset.motionFrame,
        foreground: getComputedStyle(element.querySelector('.channel-title')).backgroundImage,
        checksum
      };
    });
    const held = await visibleFrame();
    expect(held.foreground).toMatch(/^url\(/);
    await page.waitForTimeout(150);
    expect(await visibleFrame(), 'loading a new PNG never clears the previous text or artwork').toEqual(held);
    await page.evaluate(() => {
      window.channelDecodeGate = false;
      for (const resolve of window.channelWaitingFrames) resolve();
    });
    await expect.poll(async () => Number(await panel.getAttribute('data-motion-frame'))).toBeGreaterThan(Number(held.phase));
    await expect(panel.locator('.channel-motion')).toHaveAttribute('aria-pressed', 'true');
  });

  test('paused Terrain keeps its text and icons aligned and its service control apart across widths and enlarged text', async ({ page }) => {
    await page.goto('./#channel');
    const panel = page.locator('#channel'), control = panel.locator('.channel-motion');
    await panel.scrollIntoViewIfNeeded();
    await expect(control).toHaveAttribute('aria-pressed', 'true');
    await control.click();
    await expect(control).toHaveAttribute('aria-pressed', 'false');
    // Geometry is checked on the same frozen frame: rendering new frames during
    // each viewport transition would add work without testing this pause state.
    for (const width of [1440, 980, 760, 700, 390, 320]) {
      await page.setViewportSize({ width, height: 844 });
      await control.scrollIntoViewIfNeeded();
      await expect.poll(() => panel.evaluate(element => {
        const bounds = element.getBoundingClientRect();
        return [...element.querySelectorAll('.channel-contrast-text,.channel-contrast-icon')].every(field => {
          const style = getComputedStyle(field), box = field.getBoundingClientRect();
          const [w, h] = style.getPropertyValue('--terrain-contrast-size').split(' ').map(parseFloat);
          const [x, y] = style.getPropertyValue('--terrain-contrast-position').split(' ').map(parseFloat);
          return Math.abs(w - bounds.width) < 1 && Math.abs(h - bounds.height) < 1
            && Math.abs(x - (bounds.left - box.left)) < 1 && Math.abs(y - (bounds.top - box.top)) < 1;
        });
      })).toBe(true);
      const separated = await panel.evaluate(element => {
        const p = element.getBoundingClientRect(), cta = element.querySelector('.channel-link').getBoundingClientRect();
        const pause = element.querySelector('.channel-motion').getBoundingClientRect();
        // The established <=360px layout has an 8px inner gutter to keep enlarged words intact.
        return pause.top >= cta.bottom + 12 && pause.bottom <= p.bottom - 12 && pause.right <= p.right - 8;
      });
      expect(separated, `pause stays inside the frame and apart from the CTA at ${width}px`).toBe(true);
      await noOverflow(page);
    }
    await page.addStyleTag({ content: ':root { font-size: 200%; }' });
    await control.scrollIntoViewIfNeeded();
    expect(await panel.locator('.channel-title, .channel-copy, .channel-link, .channel-motion').evaluateAll(fields =>
      fields.filter(field => field.scrollWidth > field.clientWidth + 1).map(field => field.textContent))).toEqual([]);
    const enlarged = await panel.evaluate(element => {
      const b = element.getBoundingClientRect(), p = element.querySelector('.channel-motion').getBoundingClientRect();
      const a = element.querySelector('.channel-link').getBoundingClientRect();
      return p.left >= b.left && p.right <= b.right && p.top >= a.bottom + 12 && p.bottom <= b.bottom - 12;
    });
    expect(enlarged, 'the separate pause fits at 320px with 200% text').toBe(true);
  });

  test('unavailable WebGL keeps the full photo, readable copy and native channel link', async ({ page }) => {
    await page.addInitScript(() => {
      const original = HTMLCanvasElement.prototype.getContext;
      HTMLCanvasElement.prototype.getContext = function (type, ...options) {
        return type === 'webgl' ? null : original.call(this, type, ...options);
      };
    });
    await page.goto('./#channel');
    await page.locator('#channel').scrollIntoViewIfNeeded();
    await expect(page.locator('.channel-motion')).toBeHidden();
    await expect(page.locator('.channel-photo')).toBeVisible();
    await expect(page.locator('.channel-copy')).toHaveCSS('color', 'rgb(244, 243, 238)');
    await expect(page.getByRole('link', { name: 'Читать в Telegram' })).toHaveAttribute('href', 'https://t.me/ekatyulyaslife');
    await noOverflow(page);
  });

  test('reduced motion stays still and forced colours preserve system text and the link', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto('./#channel');
    const panel = page.locator('#channel');
    await panel.scrollIntoViewIfNeeded();
    await expect(panel).toHaveClass(/is-contrast-ready/);
    await expect(panel).toHaveAttribute('data-motion-frame', 'still');
    await expect(panel.locator('.channel-motion')).toBeHidden();
    await page.emulateMedia({ forcedColors: 'active' });
    await expect(panel.locator('.channel-moving-art')).toBeHidden();
    await expect(panel.locator('.channel-title')).not.toHaveCSS('color', 'rgba(0, 0, 0, 0)');
    await expect(page.getByRole('link', { name: 'Читать в Telegram' })).toBeVisible();
  });
});

test('completed tarot exports a portrait PNG and clears stale results on closing or redealing', async ({ page }, testInfo) => {
  await page.addInitScript(() => {
    // Draw the long single-word format that previously overflowed, then check redealing.
    const rolls = [.99, .3, 0];
    let roll = 0;
    Math.random = () => rolls[roll++ % rolls.length];
    window.storyDraws = [];
    const fillText = CanvasRenderingContext2D.prototype.fillText;
    CanvasRenderingContext2D.prototype.fillText = function (text, x, y, ...rest) {
      window.storyDraws.push({ text, x, y, font: this.font, width: this.measureText(text).width });
      return fillText.call(this, text, x, y, ...rest);
    };
  });
  await page.goto('./#tarot');
  const save = page.locator('[data-tarot-save]');
  const reading = page.locator('[data-tarot-reading]');
  const link = page.locator('[data-tarot-export-link]');
  const swipe = page.locator('.tarot-swipe');
  const openingHint = 'Листайте карты и открывайте по одной';
  const readingHint = 'Листайте карты, чтобы прочитать каждую';
  await expect(swipe).toHaveText(openingHint);
  await expect(save).toBeHidden();
  await page.locator('.tarot-card-toggle').first().focus();
  await page.keyboard.press('Enter');
  await expect(save).toBeHidden();
  await page.locator('[data-tarot-deal]').click();
  await expect(reading).toBeVisible();
  await expect(swipe).toHaveText(readingHint);
  await expect(save).toBeVisible();
  const resultAxis = await page.locator('#tarot').evaluate(element => {
    const reading = element.querySelector('[data-tarot-reading]').getBoundingClientRect();
    const deal = element.querySelector('[data-tarot-deal]');
    const label = deal.querySelector('span').getBoundingClientRect();
    return { delta: Math.abs(reading.left - label.left), height: deal.getBoundingClientRect().height };
  });
  if (page.viewportSize().width <= 760) {
    expect(resultAxis.delta, 'the mobile redeal label follows the reading text axis').toBeLessThan(1);
  }
  expect(resultAxis.height).toBeGreaterThanOrEqual(44);
  const text = await reading.textContent();
  const download = page.waitForEvent('download');
  await save.click();
  const file = await download;
  const filename = testInfo.outputPath('story.png');
  await file.saveAs(filename);
  const png = require('node:fs').readFileSync(filename);
  expect(png.subarray(0, 8)).toEqual(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
  expect(png.readUInt32BE(16)).toBe(1080);
  expect(png.readUInt32BE(20)).toBe(1920);
  expect(png.length).toBeGreaterThan(20000);
  await expect(link).toBeVisible();
  await expect(save).not.toHaveAttribute('aria-disabled', 'true');
  const draws = await page.evaluate(() => window.storyDraws);
  expect(draws.some(draw => draw.text === 'Кросс-дуатлон')).toBe(true);
  expect(draws.every(draw => draw.font.includes('Golos Text'))).toBe(true);
  expect(draws.some(draw => draw.text === 'Карты — ради забавы. Подготовка — по плану.')).toBe(true);
  expect(draws.filter(draw => draw.y >= 1185 && draw.y < 1490).length).toBeLessThanOrEqual(5);
  expect(draws.every(draw => draw.width <= (draw.y < 1000 && draw.x === 0 ? 236 : 912))).toBe(true);
  await page.locator('.tarot-card-toggle').first().click();
  await expect(reading).toBeHidden();
  await expect(swipe).toHaveText(openingHint);
  await expect(save).toBeHidden();
  await expect(link).not.toHaveAttribute('href');
  await page.locator('.tarot-card-toggle').first().click();
  await expect(reading).toHaveText(text);
  await expect(swipe).toHaveText(readingHint);
  await page.locator('[data-tarot-deal]').click();
  await expect(reading).toBeHidden();
  await expect(page.locator('.tarot-card.is-revealed')).toHaveCount(0);
  await expect(swipe).toHaveText(openingHint);
  await noOverflow(page);
});

test('tarot export failure offers a retry without changing the reading', async ({ page }) => {
  await page.addInitScript(() => {
    const toBlob = HTMLCanvasElement.prototype.toBlob;
    let failOnce = true;
    HTMLCanvasElement.prototype.toBlob = function (callback, ...args) {
      if (failOnce) { failOnce = false; callback(null); return; }
      return toBlob.call(this, callback, ...args);
    };
  });
  await page.goto('./#tarot');
  await page.locator('[data-tarot-deal]').click();
  const reading = await page.locator('[data-tarot-reading]').textContent();
  await page.locator('[data-tarot-save]').click();
  await expect(page.locator('[data-tarot-export-note]')).toContainText('Попробуйте ещё раз');
  const download = page.waitForEvent('download');
  await page.locator('[data-tarot-save]').click();
  await download;
  await expect(page.locator('[data-tarot-export-link]')).toBeVisible();
  await expect(page.locator('[data-tarot-reading]')).toHaveText(reading);
});

test('completed tarot remains readable at 320px with 200% text in both themes', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 740 });
  await page.goto('./#tarot');
  await page.locator('[data-tarot-deal]').click();
  await noOverflow(page);
  await page.addStyleTag({ content: ':root { font-size: 200%; }' });
  for (const theme of ['light', 'dark']) {
    await chooseTheme(page, theme);
    await page.locator('[data-tarot-reading]').scrollIntoViewIfNeeded();
    // Existing 200% overflow in the hero and services is outside this game change.
    // Check the affected section and its text without treating the intentional card rail as an error.
    expect(await page.locator('#tarot').evaluate(element => element.getBoundingClientRect().width <= innerWidth + 1)).toBe(true);
    const clipped = await page.locator('#tarot .tarot-front h3, #tarot .tarot-description, #tarot .tarot-reading h3, #tarot .tarot-reading > p:last-child, #tarot .tarot-save, #tarot .tarot-deal').evaluateAll(elements =>
      elements.filter(element => element.scrollWidth > element.clientWidth + 1).map(element => element.textContent.trim()));
    expect(clipped, 'card copy, complete reading and actions stay readable').toEqual([]);
    await expect(page.locator('[data-tarot-save]')).toBeVisible();
    await expect(page.locator('.tarot-card.is-revealed')).toHaveCount(3);
  }
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

test('editorial and service photographs retain the full source frame across widths', async ({ page }) => {
  await page.goto('./');
  await page.evaluate(async () => {
    document.querySelectorAll('details.route, details.service').forEach(details => { details.open = true; });
    await Promise.all([...document.querySelectorAll('.route-content img, .service-body img')].map(async image => {
      image.loading = 'eager';
      await image.decode();
    }));
  });
  for (const width of [320, 760, 980, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    const cropped = await page.locator('.route-content img, .service-body img').evaluateAll(images =>
      images.filter(image => {
        const style = getComputedStyle(image);
        const renderedRatio = parseFloat(style.width) / parseFloat(style.height);
        return !image.naturalWidth || Math.abs(renderedRatio - image.naturalWidth / image.naturalHeight) > .01;
      }).map(image => image.getAttribute('src')));
    expect(cropped, `photographs preserve their natural proportions at ${width}px`).toEqual([]);
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
    await expect(page.locator('figure.video-story')).toHaveCount(4);
    await expect(page.locator('details.video-story')).toHaveCount(0);
    await expect(page.locator('#andrey-coaching-video')).toBeVisible();
    await expect(page.locator('video').first()).toHaveAttribute('controls', '');
    for (const id of ['maria-lukyanova-limassol', 'vyacheslav-lyukshin-zavidovo']) {
      await expect(page.locator(`#${id}-video`)).toHaveAttribute('controls', '');
      await expect(page.locator(`#${id}-video track`)).toHaveAttribute('default', '');
    }
    await expect(page.locator('.video-play').first()).toBeHidden();
    await expect(page.locator('.tarot-card-toggle').first()).toBeHidden();
    await page.locator('#channel').scrollIntoViewIfNeeded();
    await expect(page.locator('.channel-copy')).toHaveCSS('color', 'rgb(244, 243, 238)');
    await expect(page.getByRole('link', { name: 'Читать в Telegram' })).toHaveAttribute('href', 'https://t.me/ekatyulyaslife');
    const light = await page.locator('body').evaluate(element => getComputedStyle(element).backgroundColor);
    await page.emulateMedia({ colorScheme: 'dark' });
    await expect.poll(() => page.locator('body').evaluate(element => getComputedStyle(element).backgroundColor)).not.toBe(light);
    await noOverflow(page);
  } finally {
    await context.close();
  }
});

test('reviews keep text readable across widths and at 200%', async ({ page }) => {
  await page.goto('./#results');
  await page.evaluate(() => document.fonts.ready);
  const overflowingReviewText = () => page.locator('#results').evaluate(section =>
    [...section.querySelectorAll('h2, h3, p, blockquote, .result-entry-times, .video-story-title')]
      .filter(element => element.getClientRects().length && element.scrollWidth > element.clientWidth + 1)
      .map(element => element.textContent.trim()));
  for (const width of [320, 760, 980, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    expect(await overflowingReviewText(), `review text fits at ${width}px`).toEqual([]);
  }
  await page.setViewportSize({ width: 320, height: 900 });
  await page.addStyleTag({ content: ':root { font-size: 200%; }' });
  expect(await overflowingReviewText(), 'review text stays readable at 200%').toEqual([]);
  await expect(page.locator('.result-records table')).toBeVisible();
  await expect(page.locator('.video-story-featured video')).toBeVisible();
});
