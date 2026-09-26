/* A small, deliberately fictional sports oracle. No network or saved personal data. */
(() => {
  'use strict';
  const disciplines = [
    { id: 'run', title: 'Бег', icon: 'run', detail: 'Кроссовки, номер — и на старт!', formats: ['Быстрая пятёрка', 'Городская десятка', 'Полумарафон', 'Марафон'] },
    { id: 'trail', title: 'Трейл', icon: 'mountain', detail: 'За каждым поворотом — приключение.', formats: ['Лесной маршрут', 'Горный трейл', 'Ночной старт', 'Трейл у моря'] },
    { id: 'swim', title: 'Плавание', icon: 'swimming', detail: 'Вода, горизонт и ровное дыхание.', formats: ['Морской заплыв', 'Озёрная миля', 'Открытая вода', 'Заплыв на рассвете'] },
    { id: 'bike', title: 'Велоспорт', icon: 'bike', detail: 'Два колеса и столько планов.', formats: ['Гранфондо', 'Горный серпантин', 'Гравийная гонка', 'Гонка с раздельным стартом'] },
    { id: 'tri', title: 'Триатлон', icon: 'medal-2', detail: 'Зачем выбирать что-то одно?', formats: ['Спринт', 'Олимпийская дистанция', 'Половинка', 'Экстремальный триатлон'] },
    { id: 'swimrun', title: 'Свимран', icon: 'route', detail: 'Из воды — на тропу. И обратно.', formats: ['Островной маршрут', 'Озёра и тропы', 'Командный старт', 'Прибрежная дистанция'] },
    { id: 'duathlon', title: 'Дуатлон', icon: 'bike', detail: 'Бег, велосипед и бег на десерт.', formats: ['Городской спринт', 'Кросс-дуатлон', 'Длинная дистанция', 'Осенний старт'] }
  ];
  const omens = [
    { id: 'sun', title: 'Солнце', icon: 'sun', detail: 'На финише вы будете сиять ярче собственной медали. Фотограф, приготовьтесь.' },
    { id: 'star', title: 'Звезда', icon: 'star', detail: 'Кто-то крикнет: «Давай-давай!» — и это почему-то сработает. Болельщикам — отдельная медаль.' },
    { id: 'fool', title: 'Шут', icon: 'mood-smile', detail: 'Вы снова скажете: «Это мой последний старт». Карты вежливо промолчат.' },
    { id: 'magician', title: 'Маг', icon: 'sparkles', detail: 'После финиша вы чудесным образом найдёте силы на прогулку за мороженым.' },
    { id: 'strength', title: 'Сила', icon: 'barbell', detail: 'Самый громкий крик поддержки окажется вашим. И адресован он будет кому-то рядом.' },
    { id: 'world', title: 'Мир', icon: 'world', detail: 'Всё сойдётся: место, люди и настроение. Домой увезёте медаль и желание повторить.' },
    { id: 'fortune', title: 'Колесо фортуны', icon: 'wheel', detail: 'На этот раз финишное фото понравится с первого взгляда. Кажется, это личный рекорд.' },
    { id: 'balance', title: 'Умеренность', icon: 'yin-yang', detail: 'План на день: немного волнения, много впечатлений и что-нибудь вкусное после.' }
  ];
  const pick = (items, random) => items[Math.min(items.length - 1, Math.max(0, Math.floor(random() * items.length)))];
  function createSpread(random = Math.random, previous = null) {
    const sport = pick(disciplines.filter(item => item.id !== previous?.sport.id), random);
    const format = pick(sport.formats, random);
    const omen = pick(omens.filter(item => item.id !== previous?.omen.id), random);
    return { sport, format, omen };
  }
  // Keep short Russian prepositions with the following word, including game copy.
  const type = value => value
    .replace(/(^|[\s«(])((?:(?:[вксоуяаи]|на|по|из|за|не|ни|но|до|от|во|со|об|ко|без|для|при|над|под) )+)(?=\S)/gi, (_, boundary, words) => boundary + words.replace(/ /g, '\u00a0'))
    .replace(/ — /g, '\u00a0— ');
  if (typeof module !== 'undefined' && module.exports) module.exports = { disciplines, omens, createSpread, type };
  if (typeof document === 'undefined') return;
  const root = document.querySelector('#tarot');
  if (!root) return;
  const cards = [...root.querySelectorAll('.tarot-card')];
  const dealButton = root.querySelector('[data-tarot-deal]');
  const status = root.querySelector('[data-tarot-status]');
  const instruction = root.querySelector('[data-tarot-instruction]');
  if (cards.length !== 3 || !dealButton || !status || !instruction) return;
  let spread = createSpread();
  let opened = new Set();
  let busy = false;
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)');
  const roles = ['Дисциплина', 'Формат старта', 'Знак на финише'];
  function fill() {
    const values = [spread.sport, { title: spread.format, icon: 'compass', detail: 'Кажется, намечается что-то интересное.' }, spread.omen];
    cards.forEach((card, index) => {
      const value = values[index];
      card.querySelector('h3').textContent = type(value.title);
      card.querySelector('.tarot-description').textContent = type(value.detail);
      card.querySelector('.tarot-front use').setAttribute('href', `assets/icons/tabler.svg#${value.icon}`);
      card.querySelector('.tarot-front').setAttribute('aria-hidden', 'true');
      const toggle = card.querySelector('button');
      toggle.hidden = false;
      toggle.setAttribute('aria-expanded', 'false');
      toggle.setAttribute('aria-label', `Открыть карту «${roles[index]}»`);
      card.classList.remove('is-revealed');
    });
  }
  function reveal(index) {
    if (opened.has(index)) return;
    opened.add(index);
    const card = cards[index];
    card.classList.add('is-revealed');
    card.querySelector('.tarot-front').removeAttribute('aria-hidden');
    card.querySelector('button').setAttribute('aria-expanded', 'true');
    card.querySelector('button').setAttribute('aria-label', `Закрыть карту «${card.querySelector('h3').textContent}»`);
    if (opened.size === cards.length) {
      dealButton.querySelector('span').textContent = 'Ещё расклад';
      instruction.textContent = type('Вот это планы! Интересно, что выпадет в следующий раз?');
      status.textContent = type(`${spread.sport.title}. ${spread.format}. ${spread.omen.title}. ${spread.omen.detail}`);
    }
  }
  cards.forEach((card, index) => card.querySelector('button').addEventListener('click', () => {
    if (busy) return;
    if (!opened.has(index)) { reveal(index); return; }
    opened.delete(index);
    card.classList.remove('is-revealed');
    card.querySelector('.tarot-front').setAttribute('aria-hidden', 'true');
    card.querySelector('button').setAttribute('aria-expanded', 'false');
    card.querySelector('button').setAttribute('aria-label', `Открыть карту «${roles[index]}»`);
    dealButton.querySelector('span').textContent = 'Открыть расклад';
    instruction.textContent = type('Откройте оставшиеся карты — и расклад сложится.');
    status.textContent = '';
  }));
  const rail = root.querySelector('.tarot-spread');
  cards.forEach(card => card.querySelector('button').addEventListener('focus', () => {
    if (rail.scrollWidth > rail.clientWidth) card.scrollIntoView({ block: 'nearest', inline: 'center', behavior: 'instant' });
  }));
  dealButton.addEventListener('click', () => {
    if (busy) return;
    if (opened.size < cards.length) {
      cards.forEach((_, index) => reveal(index));
      return;
    }
    busy = true;
    dealButton.setAttribute('aria-disabled', 'true');
    cards.forEach(card => {
      card.classList.remove('is-revealed');
      card.querySelector('.tarot-front').setAttribute('aria-hidden', 'true');
    });
    status.textContent = '';
    window.setTimeout(() => {
      spread = createSpread(Math.random, spread);
      opened = new Set();
      fill();
      root.querySelector('.tarot-spread').scrollTo({ left: 0, behavior: reduced.matches ? 'instant' : 'smooth' });
      instruction.textContent = type('Новый расклад готов. Откройте карты по одной или все сразу.');
      dealButton.querySelector('span').textContent = 'Открыть расклад';
      dealButton.removeAttribute('aria-disabled');
      busy = false;
    }, reduced.matches ? 0 : 350);
  });
  fill();
  root.classList.add('tarot-ready');
  instruction.textContent = type('Откройте три карты. Каким окажется ваш следующий старт?');
  dealButton.hidden = false;
})();
