(() => {
  const stories = [...document.querySelectorAll('.video-story')].map(element => ({
    element,
    video: element.querySelector('video'),
    summary: element.querySelector('summary'),
  }));

  const closeStory = story => {
    if (story.summary) {
      if (story.element.contains(document.activeElement) && document.activeElement !== story.summary) {
        story.summary.focus({ preventScroll: true });
      }
      story.element.open = false;
    }
    story.video.pause();
    story.syncPlay();
  };

  stories.forEach(story => {
    const { video, summary, element } = story;
    const button = element.querySelector('.video-play');
    const status = element.querySelector('.video-status');
    const title = element.querySelector('.video-story-title > span').textContent.trim();

    const syncPlay = () => {
      const action = video.ended ? 'Смотреть заново' : video.currentTime > 0 ? 'Продолжить' : 'Смотреть';
      button.setAttribute('aria-label', `${action} видео «${title}»`);
      button.hidden = !video.paused && !video.ended;
      if (summary) summary.setAttribute('aria-label', `${element.open ? 'Свернуть' : action} видео «${title}»`);
    };
    story.syncPlay = syncPlay;

    story.play = async () => {
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
    };
    button.addEventListener('click', story.play);

    video.addEventListener('play', () => {
      stories.forEach(other => { if (other !== story) closeStory(other); });
      // Keep keyboard control when the poster button disappears.
      if (document.activeElement === button || document.activeElement === summary) {
        video.focus({ preventScroll: true });
      }
      status.hidden = true;
      status.textContent = '';
      syncPlay();
    });
    ['pause', 'ended', 'emptied'].forEach(event => video.addEventListener(event, syncPlay));

    if (summary) {
      // The supporting clip is open in HTML; without JavaScript its native
      // player remains available. The featured clip is always visible.
      element.open = false;
      summary.addEventListener('click', event => {
        event.preventDefault();
        if (element.open) {
          closeStory(story);
          return;
        }
        element.open = true;
        syncPlay();
        // Start inside the tap/keyboard event, preserving mobile media permission.
        const playing = story.play();
        element.scrollIntoView({ block: 'start' });
        return playing;
      });
      element.addEventListener('toggle', () => {
        if (!element.open) closeStory(story);
        syncPlay();
      });
    }
    syncPlay();
  });
})();
