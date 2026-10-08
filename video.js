(() => {
  const stories = [...document.querySelectorAll('.video-story')].map(element => ({
    element,
    video: element.querySelector('video'),
  }));

  const pauseStory = story => {
    story.video.pause();
    story.syncPlay();
  };

  const clock = seconds => {
    const value = Math.max(0, Math.floor(seconds || 0));
    return `${Math.floor(value / 60)}:${String(value % 60).padStart(2, '0')}`;
  };

  // Round messages keep their picture circular; controls and captions stay
  // outside the mask. The HTML video retains native controls without this script.
  const prepareRoundControls = (story, controls, title) => {
    const { video, element } = story;
    const toggle = controls.querySelector('[data-video-toggle]');
    const mute = controls.querySelector('[data-video-mute]');
    const captions = controls.querySelector('[data-video-captions]');
    const fullscreen = controls.querySelector('[data-video-fullscreen]');
    const seek = controls.querySelector('[data-video-seek]');
    const time = controls.querySelector('[data-video-time]');
    const subtitle = element.querySelector('.round-video-caption');
    const track = video.textTracks[0];
    const trackElement = video.querySelector('track');
    const sprite = toggle.querySelector('use').getAttribute('href').split('#')[0];
    let captionsOn = true;
    let started = false;
    let nativeFullscreen = false;
    let captionSizeKey = '';
    let wasFullscreen = false;

    const icon = (button, name) => button.querySelector('use').setAttribute('href', `${sprite}#${name}`);
    const syncTime = () => {
      const duration = Number.isFinite(video.duration) ? video.duration : Number(seek.max);
      if (Number.isFinite(video.duration)) {
        seek.max = video.duration;
        seek.disabled = false;
      }
      seek.value = video.currentTime;
      seek.style.setProperty('--video-progress', `${duration > 0 ? Math.min(100, Math.max(0, video.currentTime / duration * 100)) : 0}%`);
      seek.setAttribute('aria-valuetext', `${clock(video.currentTime)} из ${clock(duration)}`);
      time.textContent = `${clock(video.currentTime)} / ${clock(duration)}`;
    };
    const syncTrackMode = () => {
      if (!track) return;
      const mode = captionsOn ? nativeFullscreen ? 'showing' : 'hidden' : 'disabled';
      if (track.mode !== mode) track.mode = mode;
    };
    const sizeCaptions = () => {
      if (!track?.cues?.length) return;
      const width = controls.getBoundingClientRect().width;
      const style = getComputedStyle(subtitle);
      const key = `${width}/${style.font}/${style.lineHeight}/${track.cues.length}`;
      if (!width || key === captionSizeKey) return;
      // Measure every cue at the actual text width once, rather than resizing
      // the page on each cue. The probe is invisible to readers and layout.
      const probe = subtitle.cloneNode(false);
      probe.removeAttribute('id');
      probe.hidden = false;
      probe.setAttribute('aria-hidden', 'true');
      Object.assign(probe.style, {
        position: 'absolute', visibility: 'hidden', pointerEvents: 'none',
        width: `${width}px`, height: 'auto', minHeight: '0', margin: '0',
      });
      element.append(probe);
      let height = 0;
      for (const cue of track.cues) {
        probe.textContent = cue.text;
        height = Math.max(height, probe.getBoundingClientRect().height);
      }
      probe.remove();
      subtitle.style.minHeight = `${Math.ceil(height)}px`;
      captionSizeKey = key;
    };
    const syncCaptions = () => {
      const visible = started && !video.ended && captionsOn && !nativeFullscreen && Boolean(track?.cues?.length);
      subtitle.textContent = visible ? [...(track.activeCues || [])].map(cue => cue.text).join('\n') : '';
      subtitle.hidden = !visible;
      captions.setAttribute('aria-pressed', String(captionsOn));
    };
    const syncSound = () => {
      icon(mute, video.muted ? 'volume-off' : 'volume');
      mute.setAttribute('aria-label', `${video.muted ? 'Включить' : 'Выключить'} звук видео «${title}»`);
      mute.title = video.muted ? 'Включить звук' : 'Выключить звук';
    };
    story.syncRound = () => {
      const paused = video.paused || video.ended;
      const action = video.ended ? 'Смотреть заново' : paused ? 'Смотреть' : 'Пауза';
      toggle.setAttribute('aria-label', `${action} видео «${title}»`);
      toggle.title = action;
      icon(toggle, paused ? 'player-play' : 'player-pause');
      syncTime();
    };
    toggle.addEventListener('click', () => video.paused || video.ended ? story.play() : pauseStory(story));
    video.addEventListener('click', () => {
      if (!video.controls) video.paused || video.ended ? story.play() : pauseStory(story);
    });
    mute.addEventListener('click', () => { video.muted = !video.muted; });
    captions.addEventListener('click', () => {
      captionsOn = !captionsOn;
      syncTrackMode();
      sizeCaptions();
      syncCaptions();
    });
    seek.addEventListener('input', () => {
      if (Number.isFinite(video.duration)) video.currentTime = Number(seek.value);
      syncTime();
    });
    fullscreen.addEventListener('click', async () => {
      try {
        if (document.fullscreenElement === element) await document.exitFullscreen();
        else if (element.requestFullscreen) await element.requestFullscreen();
        else if (video.webkitEnterFullscreen) video.webkitEnterFullscreen();
      } catch {
        const status = element.querySelector('.video-status');
        status.hidden = false;
        status.textContent = 'Полный экран недоступен. Видео можно смотреть здесь.';
      }
    });
    if (!element.requestFullscreen && !video.webkitEnterFullscreen) fullscreen.hidden = true;
    document.addEventListener('fullscreenchange', () => {
      const expanded = document.fullscreenElement === element;
      if (!expanded && !wasFullscreen) return;
      icon(fullscreen, expanded ? 'minimize' : 'maximize');
      fullscreen.setAttribute('aria-label', `${expanded ? 'Выйти из полного экрана' : 'На полный экран'}: «${title}»`);
      if (!expanded) fullscreen.focus({ preventScroll: true });
      wasFullscreen = expanded;
    });
    video.addEventListener('volumechange', syncSound);
    ['loadedmetadata', 'durationchange', 'timeupdate', 'seeked'].forEach(event => video.addEventListener(event, syncTime));
    if (track) {
      // Keep default for Safari's cue loading and no-JS playback. Reconcile
      // automatic selection after loading so native captions never duplicate ours.
      const refreshCaptions = () => { syncTrackMode(); sizeCaptions(); syncCaptions(); };
      video.textTracks.addEventListener('change', () => {
        if (nativeFullscreen) captionsOn = track.mode === 'showing';
        refreshCaptions();
      });
      trackElement.addEventListener('load', refreshCaptions);
      video.addEventListener('loadedmetadata', refreshCaptions);
      video.addEventListener('seeked', syncCaptions);
      track.addEventListener('cuechange', syncCaptions);
      video.addEventListener('play', () => { started = true; refreshCaptions(); });
      ['ended', 'emptied', 'error'].forEach(event => video.addEventListener(event, () => {
        started = false;
        syncCaptions();
      }));
      // iPhone's native fullscreen player needs its own captions; the inline
      // player and element fullscreen continue to use our external caption area.
      video.addEventListener('webkitbeginfullscreen', () => {
        nativeFullscreen = true;
        refreshCaptions();
      });
      video.addEventListener('webkitendfullscreen', () => {
        nativeFullscreen = false;
        refreshCaptions();
        fullscreen.focus({ preventScroll: true });
      });
      new ResizeObserver(() => requestAnimationFrame(() => {
        sizeCaptions();
        syncCaptions();
      })).observe(controls);
      document.fonts.ready.then(refreshCaptions);
      syncTrackMode();
    } else captions.hidden = true;
    element.classList.add('is-round-ready');
    controls.hidden = false;
    syncSound();
    syncCaptions();
    return toggle;
  };

  stories.forEach(story => {
    const { video, element } = story;
    const button = element.querySelector('.video-play');
    const status = element.querySelector('.video-status');
    const title = element.querySelector('.video-story-title > span').textContent.trim();
    const roundControls = element.querySelector('.round-video-controls');

    const syncPlay = () => {
      const action = video.ended ? 'Смотреть заново' : video.currentTime > 0 ? 'Продолжить' : 'Смотреть';
      // Before the first start, Safari's native play sits behind the glass cutout.
      // Restore native controls once playback starts, and retain them on pause.
      const controls = !roundControls && (!video.paused || video.currentTime > 0 || video.ended);
      if (video.controls !== controls) video.controls = controls;
      button.setAttribute('aria-label', `${action} видео «${title}»`);
      button.hidden = !video.paused && !video.ended;
      story.syncRound?.();
    };
    story.syncPlay = syncPlay;

    const loadError = () => {
      video.pause();
      syncPlay();
      status.hidden = false;
      status.textContent = 'Не удалось запустить видео. Попробуйте ещё раз.';
    };
    video.addEventListener('error', loadError);
    // A video with <source> can leave play() pending when every source fails.
    video.querySelectorAll?.('source').forEach(source => source.addEventListener('error', loadError));

    story.play = async () => {
      status.hidden = true;
      status.textContent = '';
      try {
        if (video.error || video.networkState === 3) video.load();
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
    const keyboardControl = roundControls ? prepareRoundControls(story, roundControls, title) : video;

    video.addEventListener('play', () => {
      const returnFocus = document.activeElement === button;
      stories.forEach(other => { if (other !== story) pauseStory(other); });
      syncPlay();
      // Keep keyboard control when the poster button disappears.
      if (returnFocus) {
        keyboardControl.focus({ preventScroll: true });
      }
      status.hidden = true;
      status.textContent = '';
    });
    ['pause', 'ended', 'emptied'].forEach(event => video.addEventListener(event, syncPlay));

    syncPlay();
  });
})();
