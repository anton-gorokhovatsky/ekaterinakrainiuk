const { test } = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { resolve } = require('node:path');
const { runInNewContext } = require('node:vm');

const source = readFileSync(resolve(__dirname, '../video.js'), 'utf8');

function visit() {
  const roots = [];
  const document = { activeElement: null };
  const element = properties => {
    const listeners = new Map();
    return {
      tagName: 'DIV', className: '', childNodes: [], parentNode: null,
      ...properties,
      addEventListener(name, callback) { listeners.set(name, callback); },
      emit(name, event) { return listeners.get(name)?.(event); },
      focus() { document.activeElement = this; },
      scrollIntoView(options) { this.scrollRequest = options; },
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
        this.playCalls = (this.playCalls || 0) + 1;
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
    };
  });
  document.querySelectorAll = () => roots;
  document.createElement = tag => element({ tagName: tag.toUpperCase(), ...(tag === 'details' ? { open: false } : {}) });
  runInNewContext(source, { document });
  return { document, stories };
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

test('the supporting poster starts once in the same activation and pauses the first video', async () => {
  const { document, stories: [first, second] } = visit();
  assert.equal(first.tagName, 'FIGURE');
  assert.equal(second.tagName, 'FIGURE');
  assert.equal(second.button['aria-label'], 'Смотреть видео «Как прошёл заплыв»');
  await first.button.emit('click');
  second.button.focus();
  const playing = second.button.emit('click');
  // play() must run before the event returns, not from a later toggle or timer.
  assert.equal(second.video.paused, false);
  assert.equal(second.video.playCalls, 1);
  assert.equal(first.video.paused, true);
  assert.equal(document.activeElement, second.video);
  await playing;
  assert.equal(second.video.playCalls, 1);
});

test('pausing the supporting clip restores its poster control and preserves playback position', async () => {
  const { document, stories: [, second] } = visit();
  second.button.focus();
  await second.button.emit('click');
  second.video.currentTime = 6;
  second.video.pause();
  assert.equal(second.video.paused, true);
  assert.equal(second.video.playCalls, 1);
  assert.equal(document.activeElement, second.video);
  assert.equal(second.button.hidden, false);
  assert.equal(second.button['aria-label'], 'Продолжить видео «Как прошёл заплыв»');
  await second.button.emit('click');
  assert.equal(second.video.paused, false);
  assert.equal(second.video.currentTime, 6);
  assert.equal(second.video.playCalls, 2);
});

test('a failed supporting start leaves a working retry control beside the error', async () => {
  const { stories: [, second] } = visit();
  second.video.failure = { name: 'NotAllowedError' };
  await second.button.emit('click');
  assert.equal(second.video.paused, true);
  assert.equal(second.button.hidden, false);
  assert.equal(second.status.hidden, false);
  delete second.video.failure;
  await second.button.emit('click');
  assert.equal(second.video.paused, false);
  assert.equal(second.status.hidden, true);
});

test('returning to the featured clip pauses the supporting clip without hiding it', async () => {
  const { document, stories: [first, second] } = visit();
  await second.button.emit('click');
  first.button.focus();
  await first.button.emit('click');
  assert.equal(second.tagName, 'FIGURE');
  assert.equal(second.video.paused, true);
  assert.equal(first.video.paused, false);
  assert.equal(document.activeElement, first.video);
  assert.equal(first.tagName, 'FIGURE');
});
