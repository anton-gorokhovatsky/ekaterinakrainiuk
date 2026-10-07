(() => {
  const stories = [...document.querySelectorAll('.video-story')].map(element => ({
    element,
    video: element.querySelector('video'),
  }));

  const pauseStory = story => {
    story.video.pause();
    story.syncPlay();
  };

  stories.forEach(story => {
    const { video, element } = story;
    const button = element.querySelector('.video-play');
    const status = element.querySelector('.video-status');
    const title = element.querySelector('.video-story-title > span').textContent.trim();

    const syncPlay = () => {
      const action = video.ended ? 'Смотреть заново' : video.currentTime > 0 ? 'Продолжить' : 'Смотреть';
      // Before the first start, Safari's native play sits behind the glass cutout.
      // Restore native controls once playback starts, and retain them on pause.
      const controls = !video.paused || video.currentTime > 0 || video.ended;
      if (video.controls !== controls) video.controls = controls;
      button.setAttribute('aria-label', `${action} видео «${title}»`);
      button.hidden = !video.paused && !video.ended;
    };
    story.syncPlay = syncPlay;

    story.play = async () => {
      status.hidden = true;
      status.textContent = '';
      try {
        await video.play();
      } catch (error) {
        syncPlay();
        // Switching stories can cancel an unfinished start.
        if (error.name !== 'AbortError') {
          status.hidden = false;
          status.textContent = 'Не удалось запустить видео. Попробуйте ещё раз.';
        }
      }
    };
    button.addEventListener('click', story.play);

    video.addEventListener('play', () => {
      const returnFocus = document.activeElement === button;
      stories.forEach(other => { if (other !== story) pauseStory(other); });
      syncPlay();
      // Keep keyboard control when the poster button disappears.
      if (returnFocus) {
        video.focus({ preventScroll: true });
      }
      status.hidden = true;
      status.textContent = '';
    });
    ['pause', 'ended', 'emptied'].forEach(event => video.addEventListener(event, syncPlay));

    syncPlay();
  });
})();
