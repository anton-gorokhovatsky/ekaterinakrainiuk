const menuButton = document.querySelector('.menu-toggle');
const navigation = document.querySelector('#navigation');
const menuLabel = document.querySelector('[data-menu-label]');

if (menuButton && navigation) {
  const mobileLayout = window.matchMedia('(max-width: 1000px)');

  const closeMenu = (restoreFocus = false) => {
    menuButton.setAttribute('aria-expanded', 'false');
    navigation.classList.remove('is-open');
    document.body.classList.remove('menu-open');
    if (menuLabel) menuLabel.textContent = 'Меню';
    if (restoreFocus) menuButton.focus({ preventScroll: true });
  };

  menuButton.addEventListener('click', () => {
    const opening = menuButton.getAttribute('aria-expanded') !== 'true';
    menuButton.setAttribute('aria-expanded', String(opening));
    navigation.classList.toggle('is-open', opening);
    document.body.classList.toggle('menu-open', opening);
    if (menuLabel) menuLabel.textContent = opening ? 'Закрыть' : 'Меню';
  });

  navigation.addEventListener('click', (event) => {
    if (event.target.closest('a')) closeMenu();
  });

  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && menuButton.getAttribute('aria-expanded') === 'true') {
      closeMenu(true);
    }
  });

  document.addEventListener('click', (event) => {
    if (!event.target.closest('.site-header')) closeMenu();
  });

  navigation.addEventListener('focusout', (event) => {
    if (event.relatedTarget && !event.relatedTarget.closest('.site-header')) closeMenu();
  });

  mobileLayout.addEventListener('change', () => closeMenu());
  document.documentElement.classList.add('js');
  menuButton.hidden = false;
}

// Measure the header for anchors and share one glass surface with the open menu.
const header = document.querySelector('.site-header');
if (header && 'ResizeObserver' in window) {
  const updateHeaderLayout = () => {
    document.documentElement.style.setProperty('--header-height', `${Math.ceil(header.getBoundingClientRect().height)}px`);
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
    openRoute(link.hash, true);
  });
});
window.addEventListener('hashchange', () => openRoute(window.location.hash));
openRoute(window.location.hash);

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
