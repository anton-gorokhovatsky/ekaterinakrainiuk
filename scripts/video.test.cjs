const { test } = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { resolve } = require('node:path');
const { runInNewContext } = require('node:vm');

const source = readFileSync(resolve(__dirname, '../video.js'), 'utf8');

function visit({ mobile = false } = {}) {
  const document = { activeElement: null };
  const element = properties => {
    const listeners = new Map();
    return {
      ...properties,
      addEventListener(name, callback) { listeners.set(name, callback); },
      emit(name) { return listeners.get(name)?.(); },
      focus() { document.activeElement = this; },
      setAttribute(name, value) { this[name] = value; },
    };
  };
  const stories = ['Сразу после финиша', 'Как прошёл заплыв'].map(title => {
    const video = element({
      paused: true, ended: false, currentTime: 0,
      async play() {
        if (this.failure) throw this.failure;
        this.ended = false;
        this.paused = false;
        this.emit('play');
      },
      pause() { this.paused = true; this.emit('pause'); },
    });
    const button = element({ hidden: true });
    const status = element({ hidden: true, textContent: '' });
    const summary = element({});
    const contents = { video, '.video-play': button, '.video-status': status, summary,
      '.video-story-title > span': { textContent: title } };
    const story = element({
      open: true, video, button, status, summary,
      querySelector: selector => contents[selector],
      contains: node => Object.values(contents).includes(node),
    });
    return story;
  });
  document.querySelectorAll = () => stories;
  const compact = element({ matches: mobile });
  runInNewContext(source, { document, window: { matchMedia: () => compact } });
  return { document, stories, compact };
}

test('large poster control transfers keyboard focus and follows pause and replay states', async () => {
  const { document, stories: [{ button, video }] } = visit();
  assert.equal(button.hidden, false);
  assert.equal(button['aria-label'], 'Смотреть видео «Сразу после финиша»');
  button.focus();
  await button.emit('click');
  assert.equal(video.paused, false);
  assert.equal(button.hidden, true);
  assert.equal(document.activeElement, video);
  video.currentTime = 8;
  video.pause();
  assert.equal(button.hidden, false);
  assert.equal(button['aria-label'], 'Продолжить видео «Сразу после финиша»');
  video.ended = true;
  video.emit('ended');
  assert.equal(button['aria-label'], 'Смотреть заново видео «Сразу после финиша»');
  await button.emit('click');
  assert.equal(button.hidden, true);
  assert.equal(video.paused, false);
});

test('native playback also pauses the other soundtrack and restores its poster control', async () => {
  const { stories: [first, second] } = visit();
  await first.video.play();
  first.video.currentTime = 3;
  await second.video.play();
  assert.equal(first.video.paused, true);
  assert.equal(first.button.hidden, false);
  assert.equal(second.video.paused, false);
  assert.equal(second.button.hidden, true);
});

test('failed starts remain retryable, while a cancelled start is not announced as an error', async () => {
  for (const name of ['NotSupportedError', 'AbortError']) {
    const { stories: [{ video, button, status }] } = visit();
    video.failure = { name };
    await button.emit('click');
    assert.equal(button.hidden, false);
    assert.equal(status.hidden, name === 'AbortError');
    assert.equal(Boolean(status.textContent), name !== 'AbortError');
    delete video.failure;
    await button.emit('click');
    assert.equal(video.paused, false);
    assert.equal(status.hidden, true);
    assert.equal(status.textContent, '');
  }
});

test('on mobile, opening the second story stops and closes the first', async () => {
  const { stories: [first, second] } = visit({ mobile: true });
  assert.equal(first.open, false);
  assert.equal(second.open, false);
  first.open = true;
  first.emit('toggle');
  await first.video.play();
  second.open = true;
  second.summary.focus();
  second.emit('toggle');
  assert.equal(first.video.paused, true);
  assert.equal(first.open, false);
  assert.equal(second.open, true);
});

test('collapsing a focused player at the mobile breakpoint preserves a visible focus target', async () => {
  const { document, compact, stories: [first, second] } = visit();
  await first.video.play();
  first.video.focus();
  compact.matches = true;
  compact.emit('change');
  assert.equal(first.video.paused, true);
  assert.equal(first.open, false);
  assert.equal(second.open, false);
  assert.equal(document.activeElement, first.summary);
  compact.matches = false;
  compact.emit('change');
  assert.equal(first.open, true);
  assert.equal(second.open, true);
  assert.equal(first.video.paused, true);
});
