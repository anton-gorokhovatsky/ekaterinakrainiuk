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
    if (restoreFocus) menuButton.focus();
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

// Keep anchor destinations visible below the actual, font-dependent header height.
const header = document.querySelector('.site-header');
if (header && 'ResizeObserver' in window) {
  const updateHeaderHeight = () => document.documentElement.style.setProperty('--header-height', `${Math.ceil(header.getBoundingClientRect().height)}px`);
  new ResizeObserver(updateHeaderHeight).observe(header);
  updateHeaderHeight();
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
