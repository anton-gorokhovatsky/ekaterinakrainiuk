(() => {
  const stories = [...document.querySelectorAll('details.video-story')];
  const videos = stories.map(story => story.querySelector('video'));
  const compact = window.matchMedia('(max-width: 760px)');

  const closeStory = story => {
    const summary = story.querySelector('summary');
    if (story.contains(document.activeElement) && document.activeElement !== summary) {
      summary.focus({ preventScroll: true });
    }
    story.querySelector('video').pause();
    story.open = false;
  };

  stories.forEach(story => {
    const video = story.querySelector('video');
    const button = story.querySelector('.video-play');
    const status = story.querySelector('.video-status');
    const title = story.querySelector('.video-story-title > span').textContent.trim();

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

    story.addEventListener('toggle', () => {
      if (!story.open) closeStory(story);
      else if (compact.matches) {
        stories.forEach(other => { if (other !== story) closeStory(other); });
      }
    });
  });

  const syncStories = () => {
    stories.forEach(story => {
      if (compact.matches) closeStory(story);
      else story.open = true;
    });
  };
  syncStories();
  compact.addEventListener('change', syncStories);
})();
