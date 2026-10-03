(() => {
  const stories = [...document.querySelectorAll('.video-story')].map(element => ({
    element,
    video: element.querySelector('video'),
  }));
  const videos = stories.map(story => story.video);
  const compact = window.matchMedia('(max-width: 760px)');

  const closeStory = story => {
    const summary = story.element.querySelector('summary');
    if (story.element.contains(document.activeElement) && document.activeElement !== summary) {
      summary.focus({ preventScroll: true });
    }
    story.video.pause();
    story.element.open = false;
  };

  stories.forEach(story => {
    const video = story.video;
    const button = story.element.querySelector('.video-play');
    const status = story.element.querySelector('.video-status');
    const title = story.element.querySelector('.video-story-title > span').textContent.trim();

    const syncPlay = () => {
      const action = video.ended ? 'Смотреть заново' : video.currentTime > 0 ? 'Продолжить' : 'Смотреть';
      button.setAttribute('aria-label', `${action} видео «${title}»`);
      button.hidden = !video.paused && !video.ended;
    };

    button.addEventListener('click', async () => {
      status.hidden = true;
      status.textContent = '';
      try {
        await video.play();
      } catch (error) {
        syncPlay();
        // Switching stories or closing a player can cancel an unfinished start.
        if (error.name !== 'AbortError') {
          status.hidden = false;
          status.textContent = 'Не удалось запустить видео. Попробуйте ещё раз.';
        }
      }
    });

    video.addEventListener('play', () => {
      videos.forEach(other => { if (other !== video) other.pause(); });
      // Keep keyboard control when the poster button disappears.
      if (document.activeElement === button) video.focus({ preventScroll: true });
      status.hidden = true;
      status.textContent = '';
      syncPlay();
    });
    ['pause', 'ended', 'emptied'].forEach(event => video.addEventListener(event, syncPlay));
    syncPlay();
  });

  const syncStories = () => {
    stories.forEach(story => {
      const tag = compact.matches ? 'details' : 'figure';
      const previous = story.element;
      if (previous.tagName.toLowerCase() === tag) return;
      const focused = previous.contains(document.activeElement) ? document.activeElement : null;
      const oldHeading = previous.firstElementChild;
      const heading = document.createElement(compact.matches ? 'summary' : 'figcaption');
      const element = document.createElement(tag);
      element.className = previous.className;
      // Move the existing media and labels; there is only one player per story.
      story.video.pause();
      heading.append(...oldHeading.childNodes);
      oldHeading.remove();
      element.append(heading, ...previous.childNodes);
      previous.replaceWith(element);
      story.element = element;

      if (compact.matches) {
        element.addEventListener('toggle', () => {
          if (story.element !== element) return;
          if (!element.open) closeStory(story);
          else stories.forEach(other => { if (other !== story) closeStory(other); });
        });
      }
      // A collapsing mobile player returns focus to its summary. On desktop,
      // the caption is ordinary text, so focus goes to the visible play control.
      if (focused) {
        const target = compact.matches ? heading : element.querySelector('.video-play');
        target.focus({ preventScroll: true });
      }
    });
  };
  syncStories();
  compact.addEventListener('change', syncStories);
})();
