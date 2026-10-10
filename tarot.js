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
  // Fictional editorial copy, never a training recommendation or a coach's promise.
  const formats = {
    'Быстрая пятёрка': ['Дистанция короткая. История про неё после финиша — вряд ли.', 'Пять километров промелькнут быстрее, чем очередь за стартовым номером.'],
    'Городская десятка': ['Знакомые улицы, непривычный ракурс: сегодня вы на проезжей части.', 'На знакомых улицах появятся разметка, болельщики и вы со стартовым номером.'],
    'Полумарафон': ['Город, двадцать один километр и разговоры, которые продолжатся за кофе.', 'Город приготовил двадцать один километр новых впечатлений.'],
    'Марафон': ['Целый город успеет сменить декорации, пока вы добираетесь до финиша.', 'За один марафон город успеет показаться вам несколькими разными городами.'],
    'Лесной маршрут': ['Тропинка петляет. Часы считают. Лес никуда не торопится.', 'Вместо городских перекрёстков вам достанутся повороты лесной тропы.'],
    'Горный трейл': ['Подъём, ещё подъём — и вид, ради которого стоило сюда забраться.', 'Горы приготовили подъёмы и виды, которые не помещаются в телефон.'],
    'Ночной старт': ['Налобный фонарь, шорох тропы и очень необычное свидание с лесом.', 'Знакомая тропа станет другой, когда дорогу будет освещать только ваш фонарь.'],
    'Трейл у моря': ['На тропе пахнет морем. Отдых всё время притворяется соревнованием.', 'Море будет мелькать между поворотами и отвлекать от показаний часов.'],
    'Морской заплыв': ['Соль на губах, буи впереди и берег, который становится ближе.', 'Ваш маршрут нарисуют буи, а декорации к нему приготовит море.'],
    'Озёрная миля': ['Озеро, яркие шапочки и миля, которую потом будут обсуждать на берегу.', 'Ваша история начнётся с озера, яркой шапочки и одной мили до берега.'],
    'Открытая вода': ['Дорожек нет. Зато есть горизонт и совсем другое чувство пространства.', 'Вместо дорожки бассейна вам достанется целый горизонт.'],
    'Заплыв на рассвете': ['Вода ещё сонная. Вы уже в шапочке. Утро начинается необычно.', 'Вы встретите утро в воде, пока остальные только ищут кнопку будильника.'],
    'Гранфондо': ['Пелотон, длинный маршрут и остановки, о которых потом расскажут отдельно.', 'Дорога приготовила длинный маршрут и немало поводов смотреть по сторонам.'],
    'Горный серпантин': ['За каждым поворотом новый вид. У велосипеда тоже большие планы.', 'Серпантин будет рисовать повороты, а вы — собирать новые виды.'],
    'Гравийная гонка': ['Пыль на раме, хруст под колёсами и приключение за пределами асфальта.', 'Асфальт закончится, а приключение продолжится по гравию.'],
    'Гонка с раздельным стартом': ['Вы, велосипед и дорога. Разговор с секундомером получается личным.', 'На дороге будут вы, велосипед и очень внимательный секундомер.'],
    'Спринт': ['Три вида спорта и транзитная зона: маленькое путешествие с переодеваниями.', 'Впереди три вида спорта и две смены образа в транзитной зоне.'],
    'Олимпийская дистанция': ['Поплавать, покрутить, побегать. День точно будет о чём вспомнить.', 'В один день поместятся вода, велосипед и беговая дорожка к финишу.'],
    'Половинка': ['Длинный спортивный день. Медаль, фотографии и ужин станут его эпилогом.', 'Карты приготовили длинный день, в котором успеют случиться три разных истории.'],
    'Экстремальный триатлон': ['Вода, горы, велосипед и бег. Обычное слово «старт» становится тесным.', 'Вода и горы превратят ваш старт в настоящее маленькое путешествие.'],
    'Островной маршрут': ['С одного берега на другой: море сегодня соединяет беговые тропы.', 'Беговые тропы и вода соединят острова в один маршрут.'],
    'Озёра и тропы': ['Плыть, бежать, снова плыть. Кроссовки познакомятся с местными озёрами.', 'Тропа несколько раз приведёт вас к воде, а вода — обратно на тропу.'],
    'Командный старт': ['Рядом напарник. История про этот старт получится сразу на двоих.', 'Вода, тропа и напарник рядом: этот маршрут вы будете вспоминать вдвоём.'],
    'Прибрежная дистанция': ['Берег то под ногами, то впереди. У моря сегодня два способа знакомства.', 'Берег будет то под ногами, то впереди — сегодня вы узнаете его с двух сторон.'],
    'Городской спринт': ['Бег, велосипед, снова бег. Город смотрит, как вы меняете транспорт.', 'Город увидит вас сначала в кроссовках, потом на велосипеде и снова в кроссовках.'],
    'Кросс-дуатлон': ['Тропа, велосипед и ещё одна тропа. Чистая форма останется на фотографии до старта.', 'Тропы приготовили повороты и немного пыли для вас и вашего велосипеда.'],
    'Длинная дистанция': ['Побегать, покрутить и вернуться к бегу. У дня будет несколько глав.', 'Спортивный день разделится на три главы: бег, велосипед и снова бег.'],
    'Осенний старт': ['Листья под ногами, прохладный воздух и велосипед между двумя пробежками.', 'Осень рассыплет листья по маршруту между вашими двумя пробежками.']
  };
  const endings = {
    sun: 'А на финише улыбка окажется ярче медали. Фотограф, приготовьтесь.',
    star: 'В нужный момент кто-то крикнет: «Давай-давай!» Болельщикам — отдельная медаль.',
    fool: 'После финиша прозвучит: «Это мой последний старт». Карты вежливо промолчат.',
    magician: 'После финиша откуда-то возьмутся силы на прогулку за мороженым. Магия.',
    strength: 'Самый громкий крик поддержки окажется вашим — для кого-то рядом.',
    world: 'На финише сойдутся место, люди и настроение. Захочется повторить.',
    fortune: 'А финишное фото наконец-то понравится с первого взгляда. Тоже личный рекорд.',
    balance: 'После — немного разговоров, много впечатлений и что-нибудь вкусное.'
  };
  const art = {
    sun: 'assets/illustrations/oracle/sun.svg?v=14f27ffb5fda',
    star: 'assets/illustrations/oracle/star.svg?v=6b3e4e577d7a',
    fool: 'assets/illustrations/oracle/fool.svg?v=09894673a0b9',
    magician: 'assets/illustrations/oracle/magician.svg?v=87cbded8910b',
    strength: 'assets/illustrations/oracle/strength.svg?v=f7f63bbd18b2',
    world: 'assets/illustrations/oracle/world.svg?v=eefee48d669e',
    fortune: 'assets/illustrations/oracle/fortune.svg?v=a83c0d723dec',
    balance: 'assets/illustrations/oracle/balance.svg?v=37021e678029'
  };
  const reading = spread => `${formats[spread.format][1]} ${endings[spread.omen.id]}`;
  const sportArt = {
    run: 'assets/illustrations/oracle/run.svg?v=8e7ae48ce577',
    trail: 'assets/illustrations/oracle/trail.svg?v=b8d535095f0e',
    swim: 'assets/illustrations/oracle/swim.svg?v=a169d7a336a6',
    bike: 'assets/illustrations/oracle/bike.svg?v=3d6a6c79929e',
    tri: 'assets/illustrations/oracle/tri.svg?v=08a9422f9f65',
    swimrun: 'assets/illustrations/oracle/swimrun.svg?v=59042cb5d3dc',
    duathlon: 'assets/illustrations/oracle/duathlon.svg?v=ea0d4cbcf3de'
  };
  const formatArt = 'assets/illustrations/oracle/compass.svg?v=0fefe860eace';
  const storyName = spread => `karty-na-start-${spread.sport.id}-${spread.sport.formats.indexOf(spread.format) + 1}-${spread.omen.id}.png`;
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
  if (typeof module !== 'undefined' && module.exports) module.exports = { disciplines, omens, formats, art, sportArt, formatArt, reading, storyName, createSpread, type };
  if (typeof document === 'undefined') return;
  const root = document.querySelector('#tarot');
  if (!root) return;
  const cards = [...root.querySelectorAll('.tarot-card')];
  const dealButton = root.querySelector('[data-tarot-deal]');
  const status = root.querySelector('[data-tarot-status]');
  const instruction = root.querySelector('[data-tarot-instruction]');
  const result = root.querySelector('[data-tarot-reading]');
  const saveButton = root.querySelector('[data-tarot-save]');
  const exportNote = root.querySelector('[data-tarot-export-note]');
  const exportLink = root.querySelector('[data-tarot-export-link]');
  if (cards.length !== 3 || !dealButton || !status || !instruction || !result || !saveButton || !exportNote || !exportLink) return;
  let spread = createSpread();
  let opened = new Set();
  let busy = false;
  let exporting = false;
  let exportedURL = '';
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)');
  const roles = ['Дисциплина', 'Формат старта', 'Знак на финише'];
  function updateInstruction(fresh = false) {
    const remaining = cards.length - opened.size;
    instruction.textContent = type(remaining === 0
      ? 'Три карты открыты. Вот ваша история.'
      : remaining === 1 ? 'Откройте последнюю карту — и расклад сложится.'
      : remaining === 2 ? 'Осталось открыть две карты. Что ещё вас ждёт?'
      : fresh ? 'Новый расклад готов. Откройте карты по одной или все сразу.'
      : 'Откройте три карты. Каким окажется ваш следующий старт?');
    dealButton.querySelector('span').textContent = remaining ? 'Открыть расклад' : 'Ещё расклад';
    root.classList.toggle('has-reading', remaining === 0);
    result.hidden = remaining !== 0;
    saveButton.hidden = remaining !== 0;
    if (remaining !== 0) clearExport();
  }
  function clearExport() {
    exportNote.hidden = true;
    exportLink.hidden = true;
    exportLink.removeAttribute('href');
    if (exportedURL) URL.revokeObjectURL(exportedURL);
    exportedURL = '';
  }
  function fill() {
    const values = [spread.sport, { title: spread.format, icon: 'compass', detail: formats[spread.format][0] }, spread.omen];
    cards.forEach((card, index) => {
      const value = values[index];
      card.querySelector('h3').textContent = type(value.title);
      card.querySelector('.tarot-description').textContent = type(value.detail);
      card.querySelector('.tarot-art').src = [sportArt[spread.sport.id], formatArt, art[spread.omen.id]][index];
      card.querySelector('.tarot-front').setAttribute('aria-hidden', 'true');
      const toggle = card.querySelector('button');
      toggle.hidden = false;
      toggle.removeAttribute('aria-disabled');
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
    updateInstruction();
    if (opened.size === cards.length) {
      result.querySelector('h3').textContent = type(`${spread.sport.title} · ${spread.format} · ${spread.omen.title}`);
      result.querySelector('[data-tarot-reading-text]').textContent = type(reading(spread));
      status.textContent = type(`${spread.sport.title}. ${spread.format}. ${spread.omen.title}. ${reading(spread)}`);
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
    updateInstruction();
    status.textContent = '';
  }));
  const rail = root.querySelector('.tarot-spread');
  cards.forEach(card => card.querySelector('button').addEventListener('focus', event => {
    if (!event.target.matches(':focus-visible') || rail.scrollWidth <= rail.clientWidth) return;
    // Move only the horizontal rail. Pointer clicks must not reposition the page.
    const bounds = card.getBoundingClientRect();
    const viewport = rail.getBoundingClientRect();
    rail.scrollTo({ left: rail.scrollLeft + bounds.left - viewport.left - (rail.clientWidth - bounds.width) / 2, behavior: reduced.matches ? 'instant' : 'smooth' });
  }));
  dealButton.addEventListener('click', () => {
    if (busy) return;
    if (opened.size < cards.length) {
      cards.forEach((_, index) => reveal(index));
      return;
    }
    busy = true;
    result.hidden = true;
    saveButton.hidden = true;
    root.classList.remove('has-reading');
    clearExport();
    dealButton.setAttribute('aria-disabled', 'true');
    cards.forEach((card, index) => {
      card.classList.remove('is-revealed');
      card.querySelector('.tarot-front').setAttribute('aria-hidden', 'true');
      card.querySelector('button').setAttribute('aria-disabled', 'true');
      card.querySelector('button').setAttribute('aria-expanded', 'false');
      card.querySelector('button').setAttribute('aria-label', `Пересдаём карту «${roles[index]}»`);
    });
    status.textContent = '';
    window.setTimeout(() => {
      spread = createSpread(Math.random, spread);
      opened = new Set();
      fill();
      root.querySelector('.tarot-spread').scrollTo({ left: 0, behavior: reduced.matches ? 'instant' : 'smooth' });
      updateInstruction(true);
      dealButton.removeAttribute('aria-disabled');
      busy = false;
    }, reduced.matches ? 0 : 350);
  });
  // A portrait story, composed separately from the responsive page. All assets
  // and fonts are local; nothing is uploaded and no personal data is collected.
  const image = src => new Promise((resolve, reject) => {
    const element = new Image();
    element.onload = () => resolve(element);
    element.onerror = () => reject(new Error('Could not load story artwork'));
    element.src = src;
  });
  function lines(ctx, text, width) {
    const words = text.split(/\s+/);
    const rows = [];
    let row = '';
    for (const word of words) {
      const next = row ? `${row} ${word}` : word;
      if (row && ctx.measureText(next).width > width) { rows.push(row); row = word; }
      else row = next;
    }
    if (row) rows.push(row);
    return rows;
  }
  function panel(ctx, x, y, width, height, corner) {
    // A continuous corner, with a flatter approach than a circular radius.
    ctx.beginPath();
    ctx.moveTo(x + corner, y);
    ctx.lineTo(x + width - corner, y);
    ctx.bezierCurveTo(x + width, y, x + width, y, x + width, y + corner);
    ctx.lineTo(x + width, y + height - corner);
    ctx.bezierCurveTo(x + width, y + height, x + width, y + height, x + width - corner, y + height);
    ctx.lineTo(x + corner, y + height);
    ctx.bezierCurveTo(x, y + height, x, y + height, x, y + height - corner);
    ctx.lineTo(x, y + corner);
    ctx.bezierCurveTo(x, y, x, y, x + corner, y);
    ctx.closePath();
    ctx.fill();
  }
  async function storyCanvas(value) {
    // Load Cyrillic and Latin subsets at each exported weight before drawing.
    const text = `${value.sport.title} ${value.format} ${value.omen.title} ${reading(value)} ekaterinakrainiuk.ru`;
    await Promise.all([400, 500, 700, 800].map(weight => document.fonts.load(`${weight} 40px "Golos Text"`, text)));
    const pictures = await Promise.all([image(sportArt[value.sport.id]), image(formatArt), image(art[value.omen.id])]);
    const canvas = document.createElement('canvas');
    canvas.width = 1080;
    canvas.height = 1920;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Canvas is unavailable');
    const ink = '#101216', paper = '#f4f1eb', rose = '#edbed1';
    ctx.fillStyle = rose;
    ctx.fillRect(0, 0, 1080, 1920);
    // Nonessential decoration may bleed; all information lives at y=280..1620.
    ctx.strokeStyle = ink;
    ctx.lineWidth = 3;
    ctx.beginPath(); ctx.arc(1040, 110, 180, 0, Math.PI * 2); ctx.stroke();
    ctx.beginPath(); ctx.arc(25, 1850, 220, 0, Math.PI * 2); ctx.stroke();
    ctx.fillStyle = ink;
    ctx.textBaseline = 'top';
    ctx.font = '500 26px "Golos Text", Arial, sans-serif';
    ctx.fillText('БЮРО СПОРТИВНЫХ ПРЕДСКАЗАНИЙ', 84, 280);
    ctx.font = '800 100px "Golos Text", Arial, sans-serif';
    ctx.fillText('КАРТЫ', 78, 335);
    ctx.fillText('НА СТАРТ', 78, 436);
    const values = [value.sport.title, value.format, value.omen.title];
    const labels = ['I / СПОРТ', 'II / СТАРТ', 'III / ЗНАК'];
    [223, 540, 857].forEach((x, index) => {
      ctx.save(); ctx.translate(x, 808); ctx.rotate([-5, 2, 5][index] * Math.PI / 180);
      ctx.fillStyle = paper; panel(ctx, -137, -228, 274, 456, 28);
      ctx.fillStyle = ink; ctx.textAlign = 'center';
      ctx.font = '500 24px "Golos Text", Arial, sans-serif'; ctx.fillText(labels[index], 0, -192);
      ctx.drawImage(pictures[index], -110, -153, 220, 220);
      ctx.fillStyle = ink;
      let size = 34;
      ctx.font = `700 ${size}px "Golos Text", Arial, sans-serif`;
      while (size > 28 && (lines(ctx, values[index], 236).length > 3 || lines(ctx, values[index], 236).some(row => ctx.measureText(row).width > 236))) {
        size -= 2;
        ctx.font = `700 ${size}px "Golos Text", Arial, sans-serif`;
      }
      const rows = lines(ctx, values[index], 236);
      rows.forEach((row, rowIndex) => ctx.fillText(row, 0, 104 + rowIndex * (size + 6)));
      ctx.restore();
    });
    ctx.textAlign = 'left'; ctx.fillStyle = ink;
    ctx.font = '500 26px "Golos Text", Arial, sans-serif'; ctx.fillText('ВАШ РАСКЛАД', 84, 1130);
    let size = 40;
    ctx.font = `${size}px "Golos Text", Arial, sans-serif`;
    while (lines(ctx, reading(value), 912).length > 5 && size > 34) { size -= 2; ctx.font = `${size}px "Golos Text", Arial, sans-serif`; }
    lines(ctx, reading(value), 912).forEach((row, index) => ctx.fillText(row, 84, 1185 + index * 52));
    ctx.font = '500 27px "Golos Text", Arial, sans-serif'; ctx.fillText('ekaterinakrainiuk.ru', 84, 1490);
    ctx.font = '24px "Golos Text", Arial, sans-serif';
    ctx.fillText('Карты — ради забавы. Подготовка — по плану.', 84, 1540);
    ctx.font = '20px "Golos Text", Arial, sans-serif';
    ctx.fillText('Icons: Caro Asercion & Delapouite · CC BY 3.0 · game-icons.net', 84, 1590);
    return canvas;
  }
  saveButton.addEventListener('click', async () => {
    if (exporting || busy || opened.size !== cards.length) return;
    const value = spread;
    exporting = true;
    saveButton.setAttribute('aria-disabled', 'true');
    saveButton.querySelector('span').textContent = 'Готовим картинку…';
    exportNote.hidden = false;
    exportNote.textContent = 'Готовим ваш расклад для сторис.';
    try {
      const canvas = await storyCanvas(value);
      const blob = await new Promise((resolve, reject) => canvas.toBlob(result => result ? resolve(result) : reject(new Error('Could not save PNG')), 'image/png'));
      // A new deal made while rendering must never expose the previous image.
      if (spread !== value || opened.size !== cards.length) return;
      clearExport();
      exportedURL = URL.createObjectURL(blob);
      exportLink.href = exportedURL;
      exportLink.download = storyName(value);
      exportLink.hidden = false;
      exportNote.textContent = 'PNG для сторис · 1080 × 1920';
      exportNote.hidden = false;
      exportLink.click();
      status.textContent = 'Картинка расклада готова. Если скачивание не началось, нажмите «Скачать картинку». ';
    } catch (_) {
      if (spread === value && opened.size === cards.length) {
        exportNote.hidden = false;
        exportNote.textContent = 'Не получилось сохранить картинку. Попробуйте ещё раз.';
        status.textContent = exportNote.textContent;
      }
    } finally {
      exporting = false;
      saveButton.removeAttribute('aria-disabled');
      saveButton.querySelector('span').textContent = 'Сохранить для сторис';
    }
  });
  fill();
  root.classList.add('tarot-ready');
  updateInstruction();
  dealButton.hidden = false;
})();
