const menuButton = document.querySelector('.menu-toggle');
const navigation = document.querySelector('#navigation');
const menuLabel = document.querySelector('[data-menu-label]');
const headerShell = document.querySelector('.site-header-shell');
const header = document.querySelector('.site-header');

if (menuButton && navigation && headerShell) {
  const mobileLayout = window.matchMedia('(max-width: 1000px)');
  const pageRegions = document.querySelectorAll('.skip-link, main, footer');
  const menuIsOpen = () => menuButton.getAttribute('aria-expanded') === 'true';

  const closeMenu = (restoreFocus = false) => {
    menuButton.setAttribute('aria-expanded', 'false');
    navigation.classList.remove('is-open');
    document.body.classList.remove('menu-open');
    headerShell.removeAttribute('role');
    headerShell.removeAttribute('aria-modal');
    headerShell.removeAttribute('aria-label');
    pageRegions.forEach(region => { region.inert = false; });
    if (menuLabel) menuLabel.textContent = 'Меню';
    if (restoreFocus) menuButton.focus({ preventScroll: true });
  };

  menuButton.addEventListener('click', () => {
    if (menuIsOpen()) return closeMenu(true);
    if (!mobileLayout.matches) return;
    menuButton.setAttribute('aria-expanded', 'true');
    navigation.classList.add('is-open');
    document.body.classList.add('menu-open');
    headerShell.setAttribute('role', 'dialog');
    headerShell.setAttribute('aria-modal', 'true');
    headerShell.setAttribute('aria-label', 'Меню');
    pageRegions.forEach(region => { region.inert = true; });
    if (menuLabel) menuLabel.textContent = 'Закрыть';
    navigation.scrollTop = 0;
    navigation.querySelector('.nav-main a').focus({ preventScroll: true });
  });

  // Unlock the destination before a sport link opens and focuses its native story.
  navigation.addEventListener('click', (event) => {
    const link = event.target.closest('a');
    if (!link || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    closeMenu();
    if (!link.hasAttribute('data-route-link') && link.hash) {
      document.getElementById(link.hash.slice(1))?.focus({ preventScroll: true });
    }
  }, true);

  document.addEventListener('keydown', (event) => {
    if (!menuIsOpen()) return;
    if (event.key === 'Escape') {
      event.preventDefault();
      closeMenu(true);
    } else if (event.key === 'Tab') {
      const controls = [...headerShell.querySelectorAll('a[href], button, select')]
        .filter(element => !element.disabled && element.getClientRects().length);
      const first = controls[0];
      const last = controls[controls.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }
  });

  mobileLayout.addEventListener('change', () => {
    const focused = document.activeElement;
    closeMenu();
    if (headerShell.contains(focused) && !focused.getClientRects().length) {
      (mobileLayout.matches ? menuButton : navigation.querySelector('.nav-main a')).focus({ preventScroll: true });
    }
  });
  window.addEventListener('pagehide', () => closeMenu());
  document.documentElement.classList.add('js');
  menuButton.hidden = false;
}

// Mark the section actually being read, including after scrolling or opening a story.
const navSections = [...document.querySelectorAll('[data-nav-section]')]
  .map(link => ({ link, section: document.getElementById(link.hash.slice(1)) }))
  .filter(entry => entry.section);
if (navSections.length) {
  const navDestinations = [...navigation.querySelectorAll('.nav-contact[href^="#"]')]
    .map(link => ({ link, section: document.getElementById(link.hash.slice(1)) }))
    .filter(entry => entry.section);
  let framePending = false;
  const updateCurrentSection = () => {
    framePending = false;
    const headerHeight = header?.getBoundingClientRect().height || 0;
    const readingLine = headerHeight + Math.min(120, window.innerHeight * .2);
    const current = navSections.find(({ section }) => {
      const bounds = section.getBoundingClientRect();
      return bounds.top <= readingLine && bounds.bottom > readingLine;
    });
    navSections.forEach(({ link }) => {
      if (link === current?.link) link.setAttribute('aria-current', 'location');
      else link.removeAttribute('aria-current');
    });
    navDestinations.forEach(({ link, section }) => {
      link.toggleAttribute('data-nav-up', section.getBoundingClientRect().top < headerHeight - 8);
    });
  };
  const queueCurrentSection = () => {
    if (framePending) return;
    framePending = true;
    requestAnimationFrame(updateCurrentSection);
  };
  window.addEventListener('scroll', queueCurrentSection, { passive: true });
  window.addEventListener('resize', queueCurrentSection);
  window.addEventListener('pageshow', queueCurrentSection);
  if ('ResizeObserver' in window) {
    const contentObserver = new ResizeObserver(queueCurrentSection);
    document.querySelectorAll('main, footer').forEach(region => contentObserver.observe(region));
  }
  queueCurrentSection();
}

// Measure the header for anchors and share one glass surface with the open menu.
if (header && 'ResizeObserver' in window) {
  const updateHeaderLayout = () => {
    document.documentElement.style.setProperty('--header-height', `${header.getBoundingClientRect().height}px`);
    const menuHeight = navigation?.classList.contains('is-open') ? navigation.getBoundingClientRect().height : 0;
    header.style.setProperty('--menu-height', `${Math.ceil(menuHeight)}px`);
    header.dataset.sharedGlass = '';
  };
  const headerObserver = new ResizeObserver(updateHeaderLayout);
  headerObserver.observe(header);
  if (navigation) headerObserver.observe(navigation);
  updateHeaderLayout();
}

// A photo opens its native story. Direct links and browser history do the same.
const openRoute = (hash, focus = false) => {
  if (!hash || !/^#[a-z-]+$/.test(hash)) return;
  const route = document.getElementById(hash.slice(1));
  if (!route?.matches('details.route')) return;
  route.open = true;
  if (focus) route.querySelector('summary').focus({ preventScroll: true });
};
document.querySelectorAll('[data-route-link]').forEach(link => {
  link.addEventListener('click', event => {
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    openRoute(link.hash);
    // Native fragment navigation can move focus to the body after the click.
    requestAnimationFrame(() => {
      if (window.location.hash === link.hash) openRoute(link.hash, true);
    });
  });
});
window.addEventListener('hashchange', () => openRoute(window.location.hash));
openRoute(window.location.hash);

// The photograph responds only inside its own row; titles and controls stay fixed.
const routePreviewMotion = window.matchMedia('(min-width: 1200px) and (hover: hover) and (pointer: fine) and (prefers-reduced-motion: no-preference)');
document.querySelectorAll('.route > summary').forEach(summary => {
  const preview = summary.querySelector('.route-preview');
  if (!preview) return;
  let frame = 0;
  let pointerX = 0;
  let pointerY = 0;
  const reset = () => {
    cancelAnimationFrame(frame);
    frame = 0;
    ['--preview-x', '--preview-y', '--preview-angle'].forEach(name => preview.style.removeProperty(name));
  };
  summary.addEventListener('pointermove', event => {
    if (!routePreviewMotion.matches || summary.parentElement.open || event.pointerType === 'touch') return;
    pointerX = event.clientX;
    pointerY = event.clientY;
    if (frame) return;
    frame = requestAnimationFrame(() => {
      frame = 0;
      const bounds = summary.getBoundingClientRect();
      const x = Math.max(-1, Math.min(1, 2 * (pointerX - bounds.left) / bounds.width - 1));
      const y = Math.max(-1, Math.min(1, 2 * (pointerY - bounds.top) / bounds.height - 1));
      preview.style.setProperty('--preview-x', `${x * 8}px`);
      preview.style.setProperty('--preview-y', `${y * 4}px`);
      preview.style.setProperty('--preview-angle', `${-3 + x * 3}deg`);
    });
  }, { passive: true });
  summary.addEventListener('pointerleave', reset);
  summary.addEventListener('blur', reset);
  summary.parentElement.addEventListener('toggle', reset);
  routePreviewMotion.addEventListener('change', reset);
});

// A quiet photo preview in the spare column; disclosures remain the source of truth.
const trainingHeading = document.querySelector('.training-heading');
if (trainingHeading) {
  const previewLayout = window.matchMedia('(min-width: 1001px) and (hover: hover) and (pointer: fine)');
  const preview = document.createElement('div');
  preview.className = 'training-preview';
  preview.setAttribute('aria-hidden', 'true');
  const image = document.createElement('img');
  image.alt = '';
  image.width = 1200;
  image.height = 900;
  preview.append(image);
  trainingHeading.append(preview);
  let hovered = null;
  let focused = null;
  let shown = null;
  let revision = 0;

  const updatePreview = async () => {
    const summary = hovered || focused;
    const target = previewLayout.matches && summary && !summary.parentElement.open ? summary : null;
    if (target === shown) return;
    shown = target;
    const request = ++revision;
    preview.classList.remove('is-visible');
    if (!target) return;
    const source = target.parentElement.querySelector('.service-body img');
    if (!source) return;
    const photo = new Image();
    photo.src = source.currentSrc || source.src;
    try { await photo.decode(); } catch { return; }
    if (request !== revision) return;
    image.src = photo.src;
    preview.classList.add('is-visible');
  };

  document.querySelectorAll('.service > summary').forEach(summary => {
    summary.addEventListener('pointerenter', () => { hovered = summary; updatePreview(); });
    summary.addEventListener('pointerleave', () => { hovered = null; updatePreview(); });
    summary.addEventListener('focus', () => {
      focused = summary.matches(':focus-visible') ? summary : null;
      if (focused) hovered = null;
      updatePreview();
    });
    summary.addEventListener('blur', () => { focused = null; updatePreview(); });
    summary.parentElement.addEventListener('toggle', updatePreview);
  });
  previewLayout.addEventListener('change', () => { hovered = null; focused = null; updatePreview(); });
}
