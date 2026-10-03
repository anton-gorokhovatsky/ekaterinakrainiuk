const { test } = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { resolve } = require('node:path');
const { runInNewContext } = require('node:vm');

const source = readFileSync(resolve(__dirname, '../video.js'), 'utf8');

function visit({ mobile = false } = {}) {
  const roots = [];
  const document = { activeElement: null };
  const element = properties => {
    const listeners = new Map();
    return {
      tagName: 'DIV', className: '', childNodes: [], parentNode: null,
      ...properties,
      addEventListener(name, callback) { listeners.set(name, callback); },
      emit(name) { return listeners.get(name)?.(); },
      focus() { document.activeElement = this; },
      setAttribute(name, value) { this[name] = value; },
      get firstElementChild() { return this.childNodes[0]; },
      append(...nodes) {
        for (const node of nodes) {
          node.remove();
          node.parentNode = this;
          this.childNodes.push(node);
        }
      },
      remove() {
        if (this.parentNode) {
          const siblings = this.parentNode.childNodes;
          siblings.splice(siblings.indexOf(this), 1);
          this.parentNode = null;
        }
      },
      replaceWith(node) {
        roots[roots.indexOf(this)] = node;
        if (this.contains(document.activeElement)) document.activeElement = null;
      },
      contains(node) { return this === node || this.childNodes.some(child => child.contains(node)); },
      querySelector(selector) {
        for (const child of this.childNodes) {
          if (child.selector === selector || child.tagName.toLowerCase() === selector ||
              selector.startsWith('.') && child.className.split(' ').includes(selector.slice(1))) return child;
          const match = child.querySelector(selector);
          if (match) return match;
        }
        return null;
      },
    };
  };
  const stories = ['Сразу после финиша', 'Как прошёл заплыв'].map((title, index) => {
    const video = element({
      tagName: 'VIDEO', paused: true, ended: false, currentTime: 0,
      async play() {
        if (this.failure) throw this.failure;
        this.ended = false;
        this.paused = false;
        this.emit('play');
      },
      pause() { this.paused = true; this.emit('pause'); },
    });
    const button = element({ className: 'video-play', hidden: true });
    const status = element({ className: 'video-status', hidden: true, textContent: '' });
    const caption = element({ tagName: 'FIGCAPTION' });
    caption.append(element({ selector: '.video-story-title > span', textContent: title }));
    const player = element({ className: 'video-player' });
    player.append(video, button);
    const story = element({ tagName: 'FIGURE', className: 'video-story' });
    story.append(caption, player, status);
    roots.push(story);
    return {
      video, button, status,
      get tagName() { return roots[index].tagName; },
      get summary() { return roots[index].querySelector('summary'); },
      get open() { return roots[index].open; },
      set open(value) { roots[index].open = value; },
      emit(name) { return roots[index].emit(name); },
    };
  });
  document.querySelectorAll = () => roots;
  document.createElement = tag => element({ tagName: tag.toUpperCase(), ...(tag === 'details' ? { open: false } : {}) });
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
  assert.equal(first.tagName, 'FIGURE');
  assert.equal(second.tagName, 'FIGURE');
  assert.equal(first.summary, null);
  assert.equal(first.video.paused, true);
  assert.equal(document.activeElement, first.button);
});

test('desktop stories are static figures and repeated resizing keeps the same working players', async () => {
  const { stories, compact } = visit();
  const videos = stories.map(story => story.video);
  for (const story of stories) {
    assert.equal(story.tagName, 'FIGURE');
    assert.equal(story.summary, null);
  }
  for (let cycle = 0; cycle < 3; cycle++) {
    compact.matches = true;
    compact.emit('change');
    for (const story of stories) {
      assert.equal(story.tagName, 'DETAILS');
      assert.equal(story.open, false);
    }
    stories[0].open = true;
    stories[0].emit('toggle');
    await stories[0].button.emit('click');
    assert.equal(stories[0].video.paused, false);
    compact.matches = false;
    compact.emit('change');
    assert.equal(stories[0].video.paused, true);
    stories.forEach((story, index) => {
      assert.equal(story.video, videos[index]);
      assert.equal(story.tagName, 'FIGURE');
      assert.equal(story.summary, null);
    });
  }
});
