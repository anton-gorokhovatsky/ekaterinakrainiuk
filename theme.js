(() => {
  const storageKey = 'ekaterinakrainiuk-theme';
  const systemTheme = window.matchMedia('(prefers-color-scheme: dark)');
  const validChoice = (value) => ['light', 'dark'].includes(value) ? value : 'system';
  let choice = 'system';
  let select;
  let picker;
  let pickerSummary;
  let options = [];
  const choiceNames = { system: 'Как в системе', light: 'Светлая', dark: 'Тёмная' };

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
    options.forEach(option => { option.checked = option.value === choice; });
    if (pickerSummary) {
      const label = `Тема сайта: ${choiceNames[choice]}`;
      pickerSummary.setAttribute('aria-label', label);
      pickerSummary.title = label;
    }
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
    const choose = (value) => {
      choice = validChoice(value);
      applyTheme();
      try {
        localStorage.setItem(storageKey, choice);
      } catch {
        // Keep the choice for this visit even if it cannot be saved.
      }
    };
    select.addEventListener('change', () => choose(select.value));
    picker = document.querySelector('.theme-picker');
    if (picker) {
      pickerSummary = picker.querySelector('summary');
      options = [...picker.querySelectorAll('input[name="desktop-theme"]')];
      options.forEach(option => option.addEventListener('change', () => {
        if (option.checked) choose(option.value);
      }));
      const closeOutside = event => {
        if (!picker.contains(event.target)) picker.open = false;
      };
      document.addEventListener('pointerdown', closeOutside);
      document.addEventListener('focusin', closeOutside);
      document.addEventListener('keydown', event => {
        if (event.key !== 'Escape' || !picker.open) return;
        event.preventDefault();
        picker.open = false;
        pickerSummary.focus({ preventScroll: true });
      });
      window.matchMedia('(max-width: 1000px)').addEventListener('change', () => { picker.open = false; });
      picker.hidden = false;
    }
    applyTheme();
    select.closest('.theme-control').hidden = false;
  });
})();
