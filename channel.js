/* Paint accessible HTML with ink/paper sampled from the same local Terrain artwork. */
(() => {
  const panel = document.querySelector('.channel-note');
  if (!panel || !window.CSS?.supports('background-clip', 'text')) return;
  const fields = [...panel.querySelectorAll('.channel-kicker, .channel-title, .channel-copy, .channel-link .link-label')];
  const icon = panel.querySelector('.channel-link .link-icon');
  const canvas = document.createElement('canvas');
  const context = canvas.getContext('2d', { willReadFrequently: true });
  if (!context) return;
  const image = new Image();
  const linear = Array.from({ length: 256 }, (_, i) => {
    const value = i / 255;
    return value <= .04045 ? value / 12.92 : ((value + .055) / 1.055) ** 2.4;
  });
  const luminance = (r, g, b) => .2126 * linear[r] + .7152 * linear[g] + .0722 * linear[b];
  // Pure black/white give the better of two contrasts at least 4.58:1 for any opaque RGB pixel.
  const ink = [0, 0, 0], paper = [255, 255, 255];
  const inkL = luminance(...ink), paperL = luminance(...paper);
  let cachedSize = '', paint = '', pending = false, nearby = false;

  function update() {
    pending = false;
    if (!nearby || !image.complete || !image.naturalWidth) return;
    try {
      const frame = panel.getBoundingClientRect();
      const positionX = parseFloat(getComputedStyle(panel).getPropertyValue('--channel-art-x')) / 100 || .5;
      const pixelRatio = Math.min(devicePixelRatio || 1, 2);
      const size = `${frame.width}:${frame.height}:${pixelRatio}:${positionX}`;
      if (size !== cachedSize) {
        canvas.width = Math.ceil(frame.width * pixelRatio);
        canvas.height = Math.ceil(frame.height * pixelRatio);
        const scale = Math.max(canvas.width / image.naturalWidth, canvas.height / image.naturalHeight);
        const width = image.naturalWidth * scale, height = image.naturalHeight * scale;
        context.drawImage(image, (canvas.width - width) * positionX, (canvas.height - height) / 2, width, height);
        const pixels = context.getImageData(0, 0, canvas.width, canvas.height);
        for (let i = 0; i < pixels.data.length; i += 4) {
          const light = luminance(pixels.data[i], pixels.data[i + 1], pixels.data[i + 2]);
          const color = (light + .05) / (inkL + .05) >= (paperL + .05) / (light + .05) ? ink : paper;
          pixels.data[i] = color[0]; pixels.data[i + 1] = color[1]; pixels.data[i + 2] = color[2];
        }
        context.putImageData(pixels, 0, 0);
        paint = `url(${canvas.toDataURL('image/png')})`;
        cachedSize = size;
      }
      for (const element of fields) {
        const bounds = element.getBoundingClientRect();
        element.style.setProperty('--terrain-contrast-image', paint);
        element.style.setProperty('--terrain-contrast-size', `${frame.width}px ${frame.height}px`);
        element.style.setProperty('--terrain-contrast-position', `${frame.left - bounds.left}px ${frame.top - bounds.top}px`);
        element.classList.add('channel-contrast-text');
      }
      if (icon) {
        const bounds = icon.getBoundingClientRect();
        const x = Math.max(0, Math.min(canvas.width - 1, Math.round((bounds.left + bounds.width / 2 - frame.left) * pixelRatio)));
        const y = Math.max(0, Math.min(canvas.height - 1, Math.round((bounds.top + bounds.height / 2 - frame.top) * pixelRatio)));
        const [r, g, b] = context.getImageData(x, y, 1, 1).data;
        icon.style.setProperty('--channel-icon-color', `rgb(${r}, ${g}, ${b})`);
      }
      panel.classList.add('is-contrast-ready');
    } catch {
      // A failed canvas enhancement must restore the readable fallback, including its link.
      panel.classList.remove('is-contrast-ready');
      icon?.style.removeProperty('--channel-icon-color');
    }
  }
  function schedule() {
    if (pending || !nearby) return;
    pending = true;
    requestAnimationFrame(update);
  }
  function activate() {
    if (!image.getAttribute('src')) image.src = 'assets/illustrations/channel-terrain-9b844270.png';
    schedule();
  }
  image.addEventListener('load', schedule);
  image.addEventListener('error', () => panel.classList.remove('is-contrast-ready'));
  if ('IntersectionObserver' in window) {
    new IntersectionObserver(entries => {
      nearby = entries[0].isIntersecting;
      if (nearby) activate();
    }, { rootMargin: '400px' }).observe(panel);
  } else {
    nearby = true;
    activate();
  }
  if ('ResizeObserver' in window) new ResizeObserver(schedule).observe(panel);
  document.fonts?.ready.then(schedule);
  window.addEventListener('resize', schedule);
})();
