(() => {
  const storageKey = 'ekaterinakrainiuk-theme';
  const systemTheme = window.matchMedia('(prefers-color-scheme: dark)');
  const validChoice = (value) => ['light', 'dark'].includes(value) ? value : 'system';
  let choice = 'system';
  let select;

  try {
    choice = validChoice(localStorage.getItem(storageKey));
  } catch {
    // The theme still works when the browser blocks local storage.
  }

  const applyTheme = () => {
    const dark = choice === 'dark' || (choice === 'system' && systemTheme.matches);
    document.documentElement.dataset.theme = choice;
    document.querySelectorAll('meta[name="theme-color"]').forEach((meta) => {
      meta.content = dark ? '#101216' : '#f4f3ee';
    });
    if (select) select.value = choice;
  };

  // Run in the head, before the stylesheet and first paint.
  applyTheme();
  systemTheme.addEventListener('change', applyTheme);

  window.addEventListener('storage', (event) => {
    if (event.key === storageKey || event.key === null) {
      choice = validChoice(event.newValue);
      applyTheme();
    }
  });

  document.addEventListener('DOMContentLoaded', () => {
    select = document.querySelector('#theme-choice');
    if (!select) return;
    select.value = choice;
    select.addEventListener('change', () => {
      choice = validChoice(select.value);
      applyTheme();
      try {
        localStorage.setItem(storageKey, choice);
      } catch {
        // Keep the choice for this visit even if it cannot be saved.
      }
    });
    select.closest('.theme-control').hidden = false;
  });
})();
