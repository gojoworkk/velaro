(async () => {
  'use strict';

  // ── Данные ──────────────────────────────────────────────
  // Фото — Unsplash (бесплатная лицензия). Для продакшна замените на свои снимки парка.
  const CARS = [
    { id: 'gt3rs', name: 'Porsche 911 GT3 RS', cat: 'sport', power: 500, accel: '3,3', seats: 2, price: 95000, deposit: 300000,
      img: 'photo-1580274455191-1c62238fa333', pos: '50% 52%', alt: 'Матово-чёрный Porsche 911 GT3 RS на набережной на закате' },
    { id: 'ferrari-roma', name: 'Ferrari Roma', cat: 'sport', power: 620, accel: '3,4', seats: 4, price: 120000, deposit: 300000,
      img: 'https://cdn.gamma.app/bqylkkqzpmrgkk7/design-anything/ssVBmKe1Rtbzk08WVEUQD/UDahfs1fTqskaxKOek1OQ.jpg',
      pos: '50% 58%', alt: 'Чёрная Ferrari Roma в профиль в тёмной студии' },
    { id: 'huracan', name: 'Lamborghini Huracán EVO', cat: 'sport', power: 640, accel: '2,9', seats: 2, price: 150000, deposit: 300000,
      img: 'photo-1657217674164-9cbf85acfc6d', pos: '50% 60%', alt: 'Серая Lamborghini Huracán, вид спереди' },
    { id: 'g63', name: 'Mercedes-AMG G 63', cat: 'suv', power: 585, accel: '4,5', seats: 5, price: 65000, deposit: 150000,
      img: 'photo-1756704756051-9aa48231c440', pos: '50% 70%', alt: 'Чёрный Mercedes-AMG G 63 у серых ворот' },
    { id: 'urus', name: 'Lamborghini Urus', cat: 'suv', power: 650, accel: '3,6', seats: 5, price: 110000, deposit: 300000,
      img: 'photo-1748189285388-c8852b6a7ed6', pos: '50% 65%', alt: 'Чёрный Lamborghini Urus на городской улице' },
    { id: 'range-rover', name: 'Range Rover', cat: 'suv', power: 530, accel: '4,6', seats: 5, price: 45000, deposit: 100000,
      img: 'photo-1767274592417-c986b7619c8c', pos: '50% 65%', alt: 'Белый Range Rover на мощёной площадке' },
    { id: 's63', name: 'Mercedes-AMG S 63', cat: 'business', power: 612, accel: '3,5', seats: 5, price: 50000, deposit: 100000,
      img: 'photo-1619221496652-7ee3d7406203', pos: '55% 70%', alt: 'Чёрный Mercedes-AMG S 63 у кирпичного фасада вечером' },
    { id: 'm5', name: 'BMW M5 Competition', cat: 'business', power: 625, accel: '3,3', seats: 5, price: 40000, deposit: 100000,
      img: 'photo-1729966085578-c7b281cf11da', pos: '60% 65%', alt: 'Белый BMW M5 в бетонном паркинге' },
    { id: 'bentley', name: 'Bentley Continental GT', cat: 'business', power: 550, accel: '4,0', seats: 4, price: 85000, deposit: 200000,
      img: 'photo-1471289549423-04adaecfa1f1', pos: '40% 60%', alt: 'Синий Bentley Continental GT, вид спереди' }
  ];

  const CATS = { sport: 'Спорт', suv: 'Внедорожники', business: 'Бизнес' };

  // Скидка за срок: от 3 суток −10%, от 7 −20%, от 14 −30%
  const TIERS = [
    { min: 1, max: 2, term: '1–2 суток', rate: 0 },
    { min: 3, max: 6, term: '3–6 суток', rate: 0.10 },
    { min: 7, max: 13, term: '7–13 суток', rate: 0.20, featured: true },
    { min: 14, max: null, term: 'От 14 суток', rate: 0.30 }
  ];

  // ── Утилиты ─────────────────────────────────────────────
  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];
  const numberFmt = new Intl.NumberFormat('ru-RU');
  const rub = (n) => `${numberFmt.format(n)} ₽`;
  const dayMonth = new Intl.DateTimeFormat('ru-RU', { day: 'numeric', month: 'long' });
  // id снимка Unsplash или полный адрес (свои кадры, фото из админки)
  const imgUrl = (id, w) => id.includes('/') ? id : `https://images.unsplash.com/${id}?auto=format&fit=crop&w=${w}&q=80`;
  const byId = (id) => CARS.find((c) => c.id === id);

  const plural = (n, one, few, many) => {
    const m10 = n % 10, m100 = n % 100;
    if (m10 === 1 && m100 !== 11) return one;
    if (m10 >= 2 && m10 <= 4 && (m100 < 12 || m100 > 14)) return few;
    return many;
  };
  const daysWord = (n) => plural(n, 'сутки', 'суток', 'суток');

  const tierFor = (days) => TIERS.find((t) => days >= t.min && (t.max === null || days <= t.max));
  const dayRate = (price, days) => Math.round(price * (1 - tierFor(days).rate) / 100) * 100;

  const toISO = (d) => {
    const z = new Date(d.getTime() - d.getTimezoneOffset() * 60000);
    return z.toISOString().slice(0, 10);
  };
  const parseISO = (s) => {
    if (!s) return null;
    const [y, m, d] = s.split('-').map(Number);
    return new Date(y, m - 1, d);
  };
  // Сутки считаем по датам: 14→17 октября = 3 суток, в тот же день = 1 сутки
  const countDays = (from, to) => {
    const a = parseISO(from), b = parseISO(to);
    if (!a || !b || b < a) return 0;
    return Math.max(1, Math.round((b - a) / 86400000));
  };
  const formatRange = (from, to) => {
    const a = parseISO(from), b = parseISO(to);
    if (a.getMonth() === b.getMonth() && a.getFullYear() === b.getFullYear()) {
      return `${a.getDate()}–${dayMonth.format(b)}`;
    }
    return `${dayMonth.format(a)} — ${dayMonth.format(b)}`;
  };

  // ── Каталог с сервера ───────────────────────────────────
  // Машины, цены и скидки ведутся в админке. Если сервер не ответил за 2,5 с,
  // остаются встроенные CARS и TIERS выше — сайт не будет пустым.
  const termLabel = (min, max) => (max === null ? `От ${min} суток`
    : min === max ? `${min} ${daysWord(min)}` : `${min}–${max} суток`);
  try {
    const res = await fetch('/api/catalog', { signal: AbortSignal.timeout(2500) });
    if (res.ok) {
      const data = await res.json();
      if (Array.isArray(data.cars) && data.cars.length) CARS.splice(0, CARS.length, ...data.cars);
      if (Array.isArray(data.tiers) && data.tiers.length === 4) {
        TIERS.splice(0, TIERS.length, ...data.tiers.map((t, i, all) => {
          const max = i < all.length - 1 ? all[i + 1].minDays - 1 : null;
          return { min: t.minDays, max, term: termLabel(t.minDays, max), rate: t.percent / 100, featured: i === 2 };
        }));
      }
    }
  } catch { /* сеть или таймаут — работаем со встроенными данными */ }

  // Суммы и количество в тексте страницы — из каталога
  const COUNT_WORDS = ['', 'Один', 'Два', 'Три', 'Четыре', 'Пять', 'Шесть', 'Семь', 'Восемь', 'Девять', 'Десять',
    'Одиннадцать', 'Двенадцать', 'Тринадцать', 'Четырнадцать', 'Пятнадцать', 'Шестнадцать', 'Семнадцать',
    'Восемнадцать', 'Девятнадцать', 'Двадцать'];
  const minOf = (key) => rub(Math.min(...CARS.map((c) => c[key])));
  $$('[data-min-price]').forEach((el) => { el.textContent = minOf('price'); });
  $$('[data-min-deposit]').forEach((el) => { el.textContent = minOf('deposit'); });
  $$('[data-car-count]').forEach((el) => {
    const n = CARS.length;
    el.textContent = `${COUNT_WORDS[n] || n} ${plural(n, 'автомобиль', 'автомобиля', 'автомобилей')}`;
  });

  // ── Плавный скролл (Lenis, как на референсе design/source.html) ──
  // Колесо мыши и тачпад прокручивают страницу с инерцией; на тачскринах — обычная прокрутка.
  // Если пользователь попросил меньше анимаций или библиотека не загрузилась — обычный скролл.
  const NAV_OFFSET = -96; // место под шапку, как scroll-padding-top
  const lenis = window.Lenis && !prefersReducedMotion() ? new window.Lenis({ lerp: 0.1, smoothWheel: true }) : null;
  if (lenis) {
    const raf = (time) => { lenis.raf(time); requestAnimationFrame(raf); };
    requestAnimationFrame(raf);
  }
  function scrollToEl(el) {
    if (!el) return;
    if (lenis) lenis.scrollTo(el, { offset: NAV_OFFSET });
    else el.scrollIntoView({ behavior: prefersReducedMotion() ? 'auto' : 'smooth' });
  }
  // Ссылки-якоря (#fleet, #terms…) тоже едут плавно
  document.addEventListener('click', (e) => {
    const link = e.target.closest('a[href^="#"]');
    if (!link || link.getAttribute('href').length < 2) return;
    const target = document.getElementById(link.getAttribute('href').slice(1));
    if (!target) return;
    e.preventDefault();
    scrollToEl(target);
  });

  // ── Состояние ───────────────────────────────────────────
  const state = { from: '', to: '', filter: 'all' };
  const days = () => countDays(state.from, state.to);

  // ── Навигация (мобильное меню) ──────────────────────────
  const navToggle = $('.nav__toggle');
  const navLinks = $('#nav-links');
  const setMenu = (open) => {
    navToggle.setAttribute('aria-expanded', String(open));
    navToggle.textContent = open ? 'Закрыть' : 'Меню';
    navLinks.classList.toggle('is-open', open);
  };
  navToggle.addEventListener('click', () => setMenu(navToggle.getAttribute('aria-expanded') !== 'true'));
  navLinks.addEventListener('click', (e) => { if (e.target.closest('a')) setMenu(false); });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') setMenu(false); });

  // ── Даты: общие для подбора и формы ─────────────────────
  const today = toISO(new Date());
  const dateInputs = $$('input[data-date]');   // скрытые поля с ISO-датами
  const dateButtons = $$('[data-picker]');      // видимые «поля» дат

  const syncDates = () => {
    dateInputs.forEach((input) => { input.value = input.dataset.date === 'from' ? state.from : state.to; });
    dateButtons.forEach((b) => {
      const v = b.dataset.picker === 'from' ? state.from : state.to;
      b.textContent = v ? dayMonth.format(parseISO(v)) : b.dataset.placeholder;
      b.classList.toggle('is-empty', !v);
    });
  };

  // ── Занятость машин ─────────────────────────────────────
  const addDaysISO = (iso, n) => { const d = parseISO(iso); d.setDate(d.getDate() + n); return toISO(d); };
  const busyOf = (carId) => (byId(carId) && byId(carId).busy) || [];
  const isBusyDay = (ranges, iso) => ranges.some(([a, b]) => a <= iso && iso <= b);
  const rangeIsFree = (ranges, from, to) => !ranges.some(([a, b]) => a <= to && from <= b);
  // Первый занятый день после даты получения: возврат не может «перешагнуть» через бронь
  const nextBusyAfter = (ranges, from) => ranges.map(([a]) => a).filter((a) => a > from).sort()[0] || null;

  function setDates(from, to) {
    state.from = from;
    state.to = to;
    syncDates();
    dateButtons.forEach((b) => b.removeAttribute('aria-invalid'));
    ['f-from-err', 'f-to-err'].forEach((id) => { const el = document.getElementById(id); if (el) el.textContent = ''; });
    updateFleetPrices();
    markAvailability();
    renderSummary();
  }

  // ── Календарь дат в стиле сайта ─────────────────────────
  const MONTHS_NOM = ['Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь', 'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь'];
  const firstOfThisMonth = today.slice(0, 8) + '01';
  const dp = document.createElement('div');
  dp.className = 'dp';
  dp.hidden = true;
  dp.setAttribute('role', 'dialog');
  dp.setAttribute('aria-label', 'Выбор дат аренды');
  dp.innerHTML = `
    <div class="dp__head">
      <button type="button" class="dp__nav" data-dp-nav="-1" aria-label="Предыдущий месяц">‹</button>
      <p class="dp__title" aria-live="polite"></p>
      <button type="button" class="dp__nav" data-dp-nav="1" aria-label="Следующий месяц">›</button>
    </div>
    <div class="dp__week" aria-hidden="true"><span>Пн</span><span>Вт</span><span>Ср</span><span>Чт</span><span>Пт</span><span>Сб</span><span>Вс</span></div>
    <div class="dp__grid"></div>
    <p class="dp__hint"></p>
    <div class="dp__foot">
      <button type="button" class="dp__clear">Сбросить</button>
      <button type="button" class="btn btn--light btn--sm dp__done">Готово</button>
    </div>`;
  document.body.append(dp);
  const picker = { anchor: null, carId: '', phase: 'from', month: null, from: '', to: '' };
  const isSheet = () => window.matchMedia('(max-width: 640px)').matches;

  function renderPicker() {
    const y = picker.month.getFullYear(), m = picker.month.getMonth();
    $('.dp__title', dp).textContent = `${MONTHS_NOM[m]} ${y}`;
    $('[data-dp-nav="-1"]', dp).disabled = toISO(picker.month) <= firstOfThisMonth;
    const ranges = picker.carId ? busyOf(picker.carId) : [];
    const limit = picker.phase === 'to' && picker.from ? nextBusyAfter(ranges, picker.from) : null;
    const offset = (new Date(y, m, 1).getDay() + 6) % 7;
    const total = new Date(y, m + 1, 0).getDate();
    let html = '<span></span>'.repeat(offset);
    for (let day = 1; day <= total; day++) {
      const iso = toISO(new Date(y, m, day));
      const busy = isBusyDay(ranges, iso);
      const beyond = Boolean(limit) && iso >= limit && iso > picker.from;
      const disabled = iso < today || busy || beyond;
      const cls = ['dp__day'];
      if (busy) cls.push('is-busy');
      if (iso === today) cls.push('is-today');
      if (iso === picker.from) cls.push('is-start');
      if (iso === picker.to) cls.push('is-end');
      if (picker.from && picker.to && iso > picker.from && iso < picker.to) cls.push('is-in');
      const label = `${dayMonth.format(parseISO(iso))}${busy ? ', занято' : ''}`;
      const pressed = iso === picker.from || iso === picker.to ? ' aria-pressed="true"' : '';
      html += `<button type="button" class="${cls.join(' ')}" data-iso="${iso}" aria-label="${label}"${disabled ? ' disabled' : ''}${pressed}>${day}</button>`;
    }
    $('.dp__grid', dp).innerHTML = html;
    $('.dp__hint', dp).textContent = (picker.phase === 'from' ? 'Выберите дату получения' : 'Выберите дату возврата') +
      (ranges.length ? ' · зачёркнутые дни заняты' : '');
  }

  function placePicker() {
    dp.classList.toggle('dp--sheet', isSheet());
    if (isSheet()) { dp.style.left = ''; dp.style.top = ''; return; }
    const r = picker.anchor.getBoundingClientRect();
    const w = dp.offsetWidth, h = dp.offsetHeight;
    const left = Math.min(Math.max(16, r.left), document.documentElement.clientWidth - w - 16) + window.scrollX;
    const above = r.bottom + h + 12 > window.innerHeight && r.top > h + 12;
    dp.style.left = `${left}px`;
    dp.style.top = `${(above ? r.top - h - 8 : r.bottom + 8) + window.scrollY}px`;
  }

  function focusDay() {
    const want = picker.phase === 'to' && picker.to ? picker.to : picker.from;
    const target = (want && $(`.dp__day[data-iso="${want}"]:not([disabled])`, dp)) || $('.dp__day:not([disabled])', dp);
    if (target) target.focus({ preventScroll: true });
  }

  function openPicker(btn) {
    picker.anchor = btn;
    picker.carId = btn.closest('#request-form') ? $('#f-car').value : '';
    picker.from = state.from;
    picker.to = state.to;
    picker.phase = btn.dataset.picker === 'to' && state.from ? 'to' : 'from';
    const base = parseISO((btn.dataset.picker === 'to' && state.to) || state.from || today);
    picker.month = new Date(base.getFullYear(), base.getMonth(), 1);
    dateButtons.forEach((b) => b.setAttribute('aria-expanded', String(b === btn)));
    dp.hidden = false;
    renderPicker();
    placePicker();
    focusDay();
  }

  function closePicker(returnFocus = true) {
    if (dp.hidden) return;
    dp.hidden = true;
    dateButtons.forEach((b) => b.setAttribute('aria-expanded', 'false'));
    if (returnFocus && picker.anchor) picker.anchor.focus({ preventScroll: true });
  }

  function pickDay(iso) {
    if (picker.phase === 'from' || !picker.from || iso < picker.from) {
      picker.from = iso;
      picker.to = '';
      picker.phase = 'to';
    } else {
      picker.to = iso;
      picker.phase = 'from';
    }
    setDates(picker.from, picker.to);
    if (picker.to) closePicker();
    else { renderPicker(); focusDay(); }
  }

  function shiftPickerMonth(delta) {
    const next = new Date(picker.month.getFullYear(), picker.month.getMonth() + delta, 1);
    if (toISO(next) < firstOfThisMonth) return;
    picker.month = next;
    renderPicker();
  }

  dateButtons.forEach((b) => b.addEventListener('click', () => (dp.hidden || picker.anchor !== b ? openPicker(b) : closePicker())));
  dp.addEventListener('click', (e) => {
    const day = e.target.closest('.dp__day');
    if (day && !day.disabled) pickDay(day.dataset.iso);
    const nav = e.target.closest('[data-dp-nav]');
    if (nav && !nav.disabled) shiftPickerMonth(Number(nav.dataset.dpNav));
    if (e.target.closest('.dp__clear')) {
      picker.from = '';
      picker.to = '';
      picker.phase = 'from';
      setDates('', '');
      renderPicker();
    }
    if (e.target.closest('.dp__done')) closePicker();
  });
  dp.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') { e.preventDefault(); closePicker(); return; }
    if (e.key === 'PageUp' || e.key === 'PageDown') {
      e.preventDefault();
      shiftPickerMonth(e.key === 'PageUp' ? -1 : 1);
      focusDay();
      return;
    }
    const day = e.target.closest('.dp__day');
    const step = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -7, ArrowDown: 7 }[e.key];
    if (!day || !step) return;
    e.preventDefault();
    const iso = addDaysISO(day.dataset.iso, step);
    const d = parseISO(iso);
    if (d.getMonth() !== picker.month.getMonth()) {
      if (iso < today) return;
      picker.month = new Date(d.getFullYear(), d.getMonth(), 1);
      renderPicker();
    }
    const target = $(`.dp__day[data-iso="${iso}"]`, dp);
    if (target) target.focus();
  });
  document.addEventListener('pointerdown', (e) => {
    if (!dp.hidden && !dp.contains(e.target) && !e.target.closest('[data-picker]')) closePicker(false);
  });
  window.addEventListener('resize', () => { if (!dp.hidden) placePicker(); });

  // ── Каталог ─────────────────────────────────────────────
  const fleetList = $('#fleet-list');
  const fleetNote = $('#fleet-note');

  fleetList.innerHTML = CARS.map((car) => `
    <li class="car" data-id="${car.id}" data-cat="${car.cat}">
      <div class="car__card">
      <div class="car__media">
        <img src="${imgUrl(car.img, 900)}" alt="${car.alt}" loading="lazy" style="object-position:${car.pos}">
        <span class="badge-overlay">${CATS[car.cat]}</span>
        <span class="badge-overlay car__busy" data-busy hidden>Занята в эти даты</span>
      </div>
      <div class="car__body">
        <h3 class="car__name">${car.name}</h3>
        <p class="car__specs">${car.power} л.с., до сотни за ${car.accel} с, ${car.seats} ${plural(car.seats, 'место', 'места', 'мест')}</p>
        <div class="car__foot">
          <p class="car__price">
            <span class="car__price-value" data-price></span>
            <span class="car__price-note" data-price-note></span>
          </p>
          <button class="btn btn--soft btn--sm" type="button" data-book="${car.id}" aria-label="Забронировать ${car.name}">Забронировать</button>
        </div>
      </div>
      </div>
    </li>`).join('') + '<li class="fleet__empty" hidden>В этом классе пока нет свободных машин.</li>';

  function updateFleetPrices() {
    const d = days();
    $$('.car', fleetList).forEach((el) => {
      const car = byId(el.dataset.id);
      const value = $('[data-price]', el);
      const note = $('[data-price-note]', el);
      if (d) {
        const rate = dayRate(car.price, d);
        value.textContent = rub(rate * d);
        note.textContent = `за ${d} ${daysWord(d)}, ${rub(rate)} в сутки`;
      } else {
        value.textContent = `от ${rub(car.price)}`;
        note.textContent = 'в сутки';
      }
    });
    if (d) {
      const tier = tierFor(d);
      fleetNote.textContent = `${formatRange(state.from, state.to)}: ${d} ${daysWord(d)}` +
        (tier.rate ? `, скидка ${Math.round(tier.rate * 100)}% уже учтена` : '');
    } else {
      fleetNote.textContent = 'Цена за сутки при аренде на 1–2 дня';
    }
  }

  // Даты выбраны — машины, занятые в них, нельзя забронировать
  function markAvailability() {
    const has = Boolean(state.from && state.to);
    $$('.car', fleetList).forEach((el) => {
      const busy = has && !rangeIsFree(busyOf(el.dataset.id), state.from, state.to);
      el.classList.toggle('car--busy', busy);
      $('[data-busy]', el).hidden = !busy;
      $('[data-book]', el).disabled = busy;
    });
    $$('#f-car option').forEach((opt) => {
      if (!opt.value) return;
      const busy = has && !rangeIsFree(busyOf(opt.value), state.from, state.to);
      opt.disabled = busy;
      opt.textContent = opt.dataset.label + (busy ? ' — занята в эти даты' : '');
    });
  }

  const filterButtons = $$('[data-filter]');
  function applyFilter(value) {
    state.filter = value;
    filterButtons.forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.filter === value)));
    let visible = 0;
    $$('.car', fleetList).forEach((el) => {
      const show = value === 'all' || el.dataset.cat === value;
      el.hidden = !show;
      if (show) visible += 1;
    });
    $('.fleet__empty', fleetList).hidden = visible > 0;
    // Новый набор машин: по центру вторая, чтобы изгиб был виден с обеих сторон
    fleetTrack.scrollLeft = visible > 2 ? cardStep() : 0;
    curveFleet();
  }
  filterButtons.forEach((b) => b.addEventListener('click', () => applyFilter(b.dataset.filter)));

  // ── Изогнутая лента каталога ────────────────────────────
  // Карточка у центра ровная; к краям разворачивается к зрителю, как на внутренней
  // стороне цилиндра, и чуть растёт. Справа, уходя за изгиб, гаснет.
  const fleetTrack = $('#fleet-track');
  const fleetArrows = $$('[data-fleet-step]');
  let curveFrame = 0;

  function curveFleet() {
    curveFrame = 0;
    const half = fleetTrack.clientWidth / 2;
    const visible = $$('.car:not([hidden])', fleetList);
    visible.forEach((card) => {
      const center = card.offsetLeft + card.offsetWidth / 2 - fleetTrack.scrollLeft;
      const t = Math.max(-1.6, Math.min(1.6, (center - half) / half));
      const fade = t > 0.5 ? Math.max(0, 1 - (t - 0.5) / 0.75) : 1;
      // Наклоняем внутреннюю обёртку: сама карточка остаётся ровной точкой «прилипания» ленты
      const inner = card.firstElementChild;
      inner.style.transform = `perspective(1100px) rotateY(${(-t * 30).toFixed(2)}deg) scale(${(1 + Math.abs(t) * 0.06).toFixed(3)})`;
      inner.style.opacity = fade.toFixed(3);
    });
    const max = fleetTrack.scrollWidth - fleetTrack.clientWidth;
    fleetArrows[0].disabled = fleetTrack.scrollLeft <= 2;
    fleetArrows[1].disabled = fleetTrack.scrollLeft >= max - 2;
  }
  const requestCurve = () => { if (!curveFrame) curveFrame = requestAnimationFrame(curveFleet); };
  fleetTrack.addEventListener('scroll', requestCurve, { passive: true });
  window.addEventListener('resize', requestCurve);

  // Стрелки — на одну карточку
  const cardStep = () => {
    const card = $('.car:not([hidden])', fleetList);
    return card ? card.offsetWidth + 20 : fleetTrack.clientWidth * 0.8;
  };
  // Своя плавная прокрутка: встроенная smooth-прокрутка гасится «прилипанием» карточек,
  // поэтому на время анимации прилипание выключаем и доезжаем точно до позиции карточки
  let glide = 0;
  let glideDone = 0;
  function glideTo(target) {
    const max = fleetTrack.scrollWidth - fleetTrack.clientWidth;
    const step = cardStep();
    const to = Math.max(0, Math.min(max, Math.round(target / step) * step));
    cancelAnimationFrame(glide);
    if (prefersReducedMotion()) { fleetTrack.scrollLeft = to; curveFleet(); return; }
    const from = fleetTrack.scrollLeft;
    const start = performance.now();
    const duration = 650;
    fleetTrack.classList.add('is-gliding');
    const finish = () => {
      cancelAnimationFrame(glide);
      clearTimeout(glideDone);
      fleetTrack.scrollLeft = to;
      fleetTrack.classList.remove('is-gliding');
      curveFleet();
    };
    const tick = (now) => {
      const p = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - p, 3);
      fleetTrack.scrollLeft = from + (to - from) * eased;
      if (p < 1) glide = requestAnimationFrame(tick);
      else finish();
    };
    glide = requestAnimationFrame(tick);
    // Страховка, если кадров мало (фоновая вкладка): по времени всё равно встаём точно на карточку
    clearTimeout(glideDone);
    glideDone = setTimeout(finish, duration + 60);
  }
  fleetArrows.forEach((b) => b.addEventListener('click', () => {
    glideTo(fleetTrack.scrollLeft + Number(b.dataset.fleetStep) * cardStep());
  }));
  fleetTrack.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
      e.preventDefault();
      glideTo(fleetTrack.scrollLeft + (e.key === 'ArrowLeft' ? -1 : 1) * cardStep());
    }
  });

  // Перетаскивание мышью; на тачскринах лента листается сама
  let drag = null;
  fleetTrack.addEventListener('pointerdown', (e) => {
    if (e.pointerType !== 'mouse' || e.button !== 0) return;
    drag = { x: e.clientX, left: fleetTrack.scrollLeft, moved: false };
  });
  window.addEventListener('pointermove', (e) => {
    if (!drag) return;
    const dx = e.clientX - drag.x;
    if (!drag.moved && Math.abs(dx) > 5) { drag.moved = true; fleetTrack.classList.add('is-dragging'); }
    if (drag.moved) fleetTrack.scrollLeft = drag.left - dx;
  });
  window.addEventListener('pointerup', () => {
    if (!drag) return;
    const moved = drag.moved;
    drag = null;
    if (!moved) return;
    // Вернуть «прилипание» к центру и не дать отпущенной кнопке сработать как клик
    fleetTrack.classList.remove('is-dragging');
    glideTo(fleetTrack.scrollLeft);
    const swallow = (ev) => { ev.stopPropagation(); ev.preventDefault(); };
    fleetTrack.addEventListener('click', swallow, { capture: true });
    setTimeout(() => fleetTrack.removeEventListener('click', swallow, { capture: true }), 0);
  });

  // «Забронировать» на витрине и в карточках → форма с выбранной машиной
  document.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-book]');
    if (!btn) return;
    carSelect.value = btn.dataset.book;
    clearError(carSelect);
    renderSummary();
    scrollToEl($('#request'));
    setTimeout(() => $('#f-name').focus({ preventScroll: true }), prefersReducedMotion() ? 0 : 600);
  });

  // ── Витрина на первом экране ────────────────────────────
  // Кадры машин сгенерированы в Gamma: 2752×1536, строгий профиль, машина смотрит влево.
  // wheels — [x, y, радиус диска] ступиц в пикселях кадра; tire — радиус шины;
  // ground — линия, где шины касаются пола (доля высоты кадра); light — фара;
  // glow — сила вспышки фары (1 — обычная).
  const FRAME = { w: 2752, h: 1536 };
  const FLOOR = 0.86; // линия пола в долях высоты сцены (центр кольца подиума)
  const STAGE_RATIO = 465 / 1000;
  const SHOWCASE_ALL = [
    { id: 'g63', brand: 'Mercedes-AMG', model: 'G 63',
      src: 'https://cdn.gamma.app/bqylkkqzpmrgkk7/design-anything/QNisRoo2UaXm7JmJi8W9U/xuFjXbfaM00jJGzMfYVBT.jpg',
      alt: 'Чёрный Mercedes-AMG G 63 в профиль в тёмной студии',
      ground: 0.819, tire: 170, wheels: [[719, 1099, 120], [1992, 1091, 122]], light: [440, 790] },
    { id: 'gt3rs', brand: 'Porsche', model: '911 GT3 RS',
      src: 'https://cdn.gamma.app/bqylkkqzpmrgkk7/design-anything/sKFLJ8vNQA3IDWBsucNjH/_jnS9m1RTWYliH77xmRMv.jpg',
      alt: 'Матово-чёрный Porsche 911 GT3 RS в профиль в тёмной студии',
      ground: 0.778, tire: 156, wheels: [[786, 1039, 109], [1913, 1039, 110]], light: [600, 850] },
    { id: 'urus', brand: 'Lamborghini', model: 'Urus',
      src: 'https://cdn.gamma.app/bqylkkqzpmrgkk7/design-anything/adQ4kuinLGj84hkq72Mtv/cVTgeYlAVc0Y6Gcalq9-o.jpg',
      alt: 'Матово-чёрный Lamborghini Urus в профиль в тёмной студии',
      ground: 0.755, tire: 152, wheels: [[810, 1013, 108], [1949, 1014, 108]], light: [605, 812] },
    { id: 'ferrari-roma', brand: 'Ferrari', model: 'Roma',
      src: 'https://cdn.gamma.app/bqylkkqzpmrgkk7/design-anything/ssVBmKe1Rtbzk08WVEUQD/UDahfs1fTqskaxKOek1OQ.jpg',
      alt: 'Чёрная Ferrari Roma в профиль в тёмной студии',
      ground: 0.702, tire: 138, wheels: [[789, 940, 112], [1949, 940, 112]], light: [530, 828] },
    { id: 'huracan', brand: 'Lamborghini', model: 'Huracán EVO',
      src: 'https://cdn.gamma.app/bqylkkqzpmrgkk7/design-anything/C52qONmUKhpG7zw1t2GKt/6T1nYKedyNSn5lSM5n-oj.jpg',
      alt: 'Матово-чёрный Lamborghini Huracán EVO в профиль в тёмной студии',
      ground: 0.668, tire: 146, wheels: [[833, 880, 125], [2040, 880, 125]], light: [522, 778],
      glow: 0.75 } // матовый серый кузов сильнее подхватывает свет — приглушаем
  ];
  // Машина, скрытая в админке, не выезжает на первый экран
  const SHOWCASE = SHOWCASE_ALL.filter((item) => byId(item.id));
  if (!SHOWCASE.length) SHOWCASE.push(SHOWCASE_ALL[0]);
  const showcase = $('.showcase');
  const stage = $('#stage');
  const showHead = $('.showcase__head', showcase);
  const show = (key) => $(`[data-show="${key}"]`, showcase);
  let current = Math.min(1, SHOWCASE.length - 1);
  // Список машин витрины — из того, что осталось после фильтра
  $('.showcase__list', showcase).innerHTML = SHOWCASE.map((item, i) =>
    `<li><button type="button" data-goto="${i}"${i === current ? ' aria-current="true"' : ''}>${item.brand} ${item.model}</button></li>`).join('');
  const gotoButtons = $$('.showcase__list [data-goto]', showcase);

  // Собираем машины: фото + два вращающихся диска + фара
  const pct = (n) => `${(n * 100).toFixed(3)}%`;
  // Диски колёс — вырезки из того же кадра, их можно вращать
  const wheelsMarkup = (item) => item.wheels.map(([x, y, r]) => `<span class="ride__wheel" style="` +
    `left:${pct((x - r) / FRAME.w)};top:${pct((y - r) / FRAME.h)};` +
    `width:${pct(2 * r / FRAME.w)};height:${pct(2 * r / FRAME.h)};` +
    `background-image:url('${item.src}');` +
    `background-size:${pct(FRAME.w / (2 * r))} ${pct(FRAME.h / (2 * r))};` +
    `background-position:${pct((x - r) / (FRAME.w - 2 * r))} ${pct((y - r) / (FRAME.h - 2 * r))}"></span>`).join('');
  const rides = SHOWCASE.map((item, i) => {
    const el = document.createElement('div');
    el.className = 'ride' + (i === current ? ' is-active' : '');
    el.setAttribute('aria-hidden', String(i !== current));
    el.style.setProperty('--top', pct(FLOOR - item.ground * (FRAME.h / FRAME.w) / STAGE_RATIO));
    el.innerHTML = `<img class="ride__img" src="${item.src}" alt="${item.alt}"${i === current ? ' fetchpriority="high"' : ''}>` +
      wheelsMarkup(item) + `<span class="ride__light" aria-hidden="true" style="--lx:${pct(item.light[0] / FRAME.w)};--ly:${pct(item.light[1] / FRAME.h)};--gy:${pct(item.ground)};--glow:${item.glow || 1}">` +
      '<span class="hl-beam"></span><span class="hl-pool"></span><span class="hl-bloom"></span><span class="hl-core"></span></span>';
    $('#cars').append(el);
    return el;
  });

  const taglineFor = (car) => `${car.power} л.с. и ${car.accel} с до сотни. В аренду от ${rub(car.price)} в сутки.`;

  function renderShowcaseText() {
    const item = SHOWCASE[current];
    const car = byId(item.id);
    show('brand').textContent = item.brand;
    show('model').textContent = item.model;
    show('tagline').textContent = car ? taglineFor(car) : '';
    show('book').dataset.book = car ? car.id : '';
    gotoButtons.forEach((b) => {
      if (Number(b.dataset.goto) === current) b.setAttribute('aria-current', 'true');
      else b.removeAttribute('aria-current');
    });
    // Миниатюра показывает следующую машину
    const nextIndex = (current + 1) % SHOWCASE.length;
    const next = SHOWCASE[nextIndex];
    const thumb = show('thumb');
    thumb.dataset.goto = nextIndex;
    thumb.setAttribute('aria-label', `Показать ${next.brand} ${next.model}`);
    const img = $('img', thumb);
    img.src = next.src;
    img.style.objectPosition = '50% 62%';
  }

  // Колёса катятся без проскальзывания: угол = путь / радиус шины
  const spin = (item, distancePct) => (distancePct / 100) * (FRAME.w / item.tire) * (180 / Math.PI);
  // Текущее положение машины (в % её ширины) и угол колеса — чтобы прерванный проезд продолжался без рывка
  const shiftPct = (el) => (new DOMMatrixReadOnly(getComputedStyle(el).transform).m41 / el.offsetWidth) * 100;
  const angleOf = (el) => {
    const m = new DOMMatrixReadOnly(getComputedStyle(el).transform);
    return Math.atan2(m.b, m.a) * (180 / Math.PI);
  };
  let trip = null; // текущий проезд: { anims, cars }

  // Завершить проезд: машины, не участвующие в новом (keep), прячем, анимации снимаем
  function settle(t, keep = []) {
    t.cars.forEach((el) => { if (!keep.includes(el)) el.classList.remove('is-moving'); });
    t.anims.forEach((a) => a.cancel());
  }

  // dir = 1 — вперёд: машина уезжает влево, следующая въезжает справа.
  // dir = -1 — назад (задний ход): машина уезжает вправо, откуда приехала, прошлая возвращается слева.
  function drive(fromIndex, toIndex, dir = 1) {
    const from = rides[fromIndex], to = rides[toIndex];
    const fromItem = SHOWCASE[fromIndex], toItem = SHOWCASE[toIndex];
    const fromWheels = $$('.ride__wheel', from), toWheels = $$('.ride__wheel', to);

    // Если машина ещё едет — стартуем с того места, где она сейчас
    const startPct = trip ? shiftPct(from) : 0;
    const startAngles = fromWheels.map((wh) => (trip ? angleOf(wh) : 0));
    if (trip) settle(trip, [from, to]);

    const box = from.parentElement.getBoundingClientRect();
    const w = box.width;
    // Сколько проехать (в % ширины машины), чтобы скрыться за левым / правым краем экрана
    const offLeft = -(((box.left + w * 0.9) / w) * 100);
    const offRight = ((window.innerWidth - box.left - w * 0.1) / w) * 100 + 4;
    const exitTo = dir === 1 ? offLeft : offRight;
    const enterFrom = dir === 1 ? offRight : offLeft;
    // Задним ходом машины едут чуть медленнее
    const pace = dir === 1 ? 1 : 1.15;
    const out = { duration: 950 * pace, easing: 'cubic-bezier(.45, 0, .75, .45)', fill: 'forwards' };
    // Следующая машина ждёт, пока предыдущая отъедет, и тормозит в центре
    const inn = { duration: 1500 * pace, delay: 520 * pace, easing: 'cubic-bezier(.12, .6, .25, 1)', fill: 'backwards' };

    from.classList.add('is-moving');
    from.classList.remove('is-active');
    to.classList.add('is-active', 'is-moving');
    from.setAttribute('aria-hidden', 'true');
    to.setAttribute('aria-hidden', 'false');

    // Колесо поворачивается на угол, пропорциональный пути: вправо — по часовой, влево — против
    const anims = [];
    anims.push(from.animate([{ transform: `translateX(${startPct}%)` }, { transform: `translateX(${exitTo}%)` }], out));
    fromWheels.forEach((wh, i) => anims.push(wh.animate([
      { transform: `rotate(${startAngles[i]}deg)` },
      { transform: `rotate(${startAngles[i] + spin(fromItem, exitTo - startPct)}deg)` }
    ], out)));
    anims.push(to.animate([{ transform: `translateX(${enterFrom}%)` }, { transform: 'translateX(0)' }], inn));
    toWheels.forEach((wh) => anims.push(
      wh.animate([{ transform: `rotate(${spin(toItem, enterFrom)}deg)` }, { transform: 'rotate(0deg)' }], inn)));

    const t = { anims, cars: [from, to] };
    trip = t;
    Promise.all(anims.map((a) => a.finished)).then(() => {
      if (trip !== t) return; // уже начался новый проезд, он сам приберёт
      settle(t);
      trip = null;
    }).catch(() => {});
  }

  function showSlide(index, dir) {
    const target = (index + SHOWCASE.length) % SHOWCASE.length;
    if (target === current) return;
    const prev = current;
    current = target;
    if (prefersReducedMotion()) {
      rides.forEach((r, i) => { r.classList.toggle('is-active', i === target); r.setAttribute('aria-hidden', String(i !== target)); });
      renderShowcaseText();
      return;
    }
    // Без явного направления (список, миниатюра): дальше по списку — вперёд, раньше — назад
    drive(prev, target, dir || (index > prev ? 1 : -1));
    showHead.classList.add('is-swapping');
    setTimeout(() => { renderShowcaseText(); showHead.classList.remove('is-swapping'); }, 300);
  }

  // Левая стрелка — вперёд (следующая машина), правая — задний ход (прошлая машина)
  $$('[data-step]', stage).forEach((b) => b.addEventListener('click', () => {
    const step = Number(b.dataset.step);
    showSlide(current + step, step);
  }));
  showcase.addEventListener('click', (e) => {
    const b = e.target.closest('[data-goto]');
    if (b) showSlide(Number(b.dataset.goto));
  });
  showcase.addEventListener('keydown', (e) => {
    if (e.target.closest('input, select, textarea')) return;
    if (e.key === 'ArrowLeft') showSlide(current + 1, 1);
    if (e.key === 'ArrowRight') showSlide(current - 1, -1);
  });
  // Свайп на телефоне: толкаешь машину влево — едет вперёд, вправо — задним ходом
  let swipeX = null;
  stage.addEventListener('pointerdown', (e) => { swipeX = e.clientX; });
  stage.addEventListener('pointerup', (e) => {
    if (swipeX === null) return;
    const dx = e.clientX - swipeX;
    swipeX = null;
    if (Math.abs(dx) > 50) showSlide(current + (dx < 0 ? 1 : -1), dx < 0 ? 1 : -1);
  });

  const more = show('more');
  const rest = CARS.length - SHOWCASE.length;
  more.textContent = `+${rest}`;
  more.setAttribute('aria-label', `Ещё ${rest} ${plural(rest, 'автомобиль', 'автомобиля', 'автомобилей')} в автопарке`);


  // ── Быстрый подбор на первом экране ─────────────────────
  $('#booking').addEventListener('submit', (e) => {
    e.preventDefault();
    applyFilter(e.currentTarget.elements.cls.value);
    scrollToEl($('#fleet'));
  });

  // ── Условия и цены: карточки классов ────────────────────
  const M5 = {
    src: 'https://cdn.gamma.app/bqylkkqzpmrgkk7/design-anything/og2ISECVy6ToADSOJrhHc/mpip5UxCps9Q__r2GrZFh.jpg',
    alt: 'Чёрный BMW M5 Competition в профиль в тёмной студии',
    ground: 0.757, tire: 168, wheels: [[580, 994, 122], [2075, 994, 122]]
  };
  const PLANS = [
    { cat: 'business', name: 'Бизнес', car: M5, button: 'Смотреть бизнес-класс',
      desc: 'Для деловых встреч, трансферов и поездок за город' },
    { cat: 'sport', name: 'Спорт', car: SHOWCASE_ALL[1], button: 'Смотреть спорткары', popular: true,
      desc: 'Для выходных, трека и особых поводов' },
    { cat: 'suv', name: 'Внедорожники', car: SHOWCASE_ALL[0], button: 'Смотреть внедорожники',
      desc: 'Полный привод и пять мест — для семьи и дальних маршрутов' }
  ];
  const PLAN_SIDES = ['left', 'center', 'right'];
  // Кадр машины в карточке: шире карточки на 18%, колёса — на 88% высоты окна 2.2:1
  const PLAN_SCALE = 1.18, PLAN_RATIO = 2.2, PLAN_FLOOR = 0.88;
  const plansEl = $('#plans');
  const plansGrid = $('#plans-grid');
  // Переключатель срока — по ступеням скидок из админки
  $('[data-term-group]', plansEl).innerHTML = TIERS.map((t, i) =>
    `<button type="button" aria-pressed="${i === 0}" data-term="${t.min}">${t.term}` +
    `${t.rate ? ` <span class="plans__save">−${Math.round(t.rate * 100)}%</span>` : ''}</button>`).join('');
  const termButtons = $$('[data-term]', plansEl);
  let planTerm = 1;

  const classInfo = (cat) => {
    const cars = CARS.filter((c) => c.cat === cat);
    return {
      cars,
      price: Math.min(...cars.map((c) => c.price)),
      deposit: Math.min(...cars.map((c) => c.deposit))
    };
  };
  const featuresFor = (cat) => {
    const { cars, deposit } = classInfo(cat);
    return [
      cars.map((c) => c.name).join(', '),
      cat === 'sport' ? 'Возраст от 25 лет и стаж от 5 лет' : 'Возраст от 23 лет и стаж от 3 лет',
      `Депозит от ${rub(deposit)}, вернём полностью`,
      'КАСКО и ОСАГО уже в цене',
      '300 км в сутки и подача по Москве'
    ];
  };

  const check = '<svg class="plan__check" width="16" height="16" viewBox="0 0 16 16" aria-hidden="true"><path d="M3.5 8.5 6.5 11.5 12.5 4.5" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg>';
  const star = '<svg width="14" height="14" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2.5l2.9 6.1 6.6.8-4.9 4.6 1.3 6.6L12 17.3l-5.9 3.3 1.3-6.6L2.5 9.4l6.6-.8z" fill="currentColor"/></svg>';

  plansGrid.innerHTML = PLANS.map((p, i) => {
    const car = p.car;
    const innerH = PLAN_SCALE * (FRAME.h / FRAME.w);           // высота кадра в ширинах окна
    const top = (PLAN_FLOOR / PLAN_RATIO - car.ground * innerH) * PLAN_RATIO; // доля высоты окна
    const spin = -(0.05 * FRAME.w / car.tire) * (180 / Math.PI); // поворот колеса при сдвиге на 5%
    return `
      <article class="plan plan--${PLAN_SIDES[i]}${p.popular ? ' plan--popular' : ''}" data-cat="${p.cat}">
        ${p.popular ? `<span class="plan__badge">${star}Чаще всего берут</span>` : ''}
        <h3 class="plan__name">${p.name}</h3>
        <div class="plan__car" style="--spin:${spin.toFixed(1)}deg">
          <div class="plan__ride" style="top:${pct(top)};left:${pct(-(PLAN_SCALE - 1) / 2)};width:${pct(PLAN_SCALE)}">
            <img class="ride__img" src="${car.src}" alt="${car.alt}" loading="lazy">
            ${wheelsMarkup(car)}
          </div>
        </div>
        <p class="plan__price">
          <span class="plan__from">от</span>
          <span class="plan__amount" data-amount></span>
          <span class="plan__unit">₽ / сутки</span>
        </p>
        <p class="plan__total" data-total></p>
        <ul class="plan__features">
          ${featuresFor(p.cat).map((f) => `<li>${check}<span>${f}</span></li>`).join('')}
        </ul>
        <hr class="plan__rule">
        <button class="btn ${p.popular ? 'btn--light' : 'btn--ghost'} plan__btn" type="button" data-plan="${p.cat}">${p.button}</button>
        <p class="plan__desc">${p.desc}</p>
      </article>`;
  }).join('');

  // Цифры «прокручиваются», как на счётчике: каждая — колонка 0–9
  function setAmount(el, value) {
    const text = numberFmt.format(value);
    el.setAttribute('aria-label', `${text} ₽`);
    const chars = [...text];
    const fresh = el.dataset.mask !== chars.map((c) => (/\d/.test(c) ? 'd' : c)).join('');
    if (fresh) {
      el.dataset.mask = chars.map((c) => (/\d/.test(c) ? 'd' : c)).join('');
      el.innerHTML = chars.map((c) => (/\d/.test(c)
        ? `<span class="odo" aria-hidden="true"><span class="odo__col">${'0123456789'.split('').map((d) => `<span>${d}</span>`).join('')}</span></span>`
        : `<span class="odo__sep" aria-hidden="true">${c}</span>`)).join('');
    }
    let k = 0;
    $$('.odo__col', el).forEach((col) => {
      const digit = chars.filter((c) => /\d/.test(c))[k];
      col.style.transitionDelay = `${k * 45}ms`;
      col.style.transform = `translateY(${-Number(digit)}em)`;
      k += 1;
    });
  }

  function renderPlans() {
    $$('.plan', plansGrid).forEach((card) => {
      const { price } = classInfo(card.dataset.cat);
      const rate = dayRate(price, planTerm);
      setAmount($('[data-amount]', card), rate);
      $('[data-total]', card).textContent = planTerm === 1
        ? `Базовый тариф на ${TIERS[0].term}`
        : `за ${planTerm} ${daysWord(planTerm)} — от ${rub(rate * planTerm)}`;
    });
  }

  termButtons.forEach((b) => b.addEventListener('click', () => {
    planTerm = Number(b.dataset.term);
    termButtons.forEach((x) => x.setAttribute('aria-pressed', String(x === b)));
    // Прокручиваем только сам переключатель по горизонтали (на телефоне), страницу не трогаем
    const bar = b.parentElement;
    const shift = b.getBoundingClientRect().left - bar.getBoundingClientRect().left - (bar.clientWidth - b.offsetWidth) / 2;
    bar.scrollBy({ left: shift, behavior: prefersReducedMotion() ? 'auto' : 'smooth' });
    renderPlans();
  }));

  // Кнопка карточки → каталог с фильтром по классу
  plansGrid.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-plan]');
    if (!btn) return;
    applyFilter(btn.dataset.plan);
    scrollToEl($('#fleet'));
  });

  // Карточки «раскладываются» веером, когда блок появляется на экране
  if ('IntersectionObserver' in window) {
    const io = new IntersectionObserver((entries) => {
      if (entries.some((en) => en.isIntersecting)) { plansEl.classList.add('is-in'); io.disconnect(); }
    }, { threshold: 0.25 });
    io.observe(plansEl);
  } else {
    plansEl.classList.add('is-in');
  }

  // ── Форма заявки ────────────────────────────────────────
  const form = $('#request-form');
  const carSelect = $('#f-car');
  const phoneInput = $('#f-phone');
  const addressField = $('#address-field');
  const summary = $('#summary');

  Object.entries(CATS).forEach(([cat, label]) => {
    const group = document.createElement('optgroup');
    group.label = label;
    CARS.filter((c) => c.cat === cat).forEach((c) => {
      const opt = new Option(`${c.name} — от ${rub(c.price)} в сутки`, c.id);
      opt.dataset.label = opt.textContent;
      group.append(opt);
    });
    carSelect.append(group);
  });

  carSelect.addEventListener('change', renderSummary);
  // Смена машины: если её даты заняты — сбрасываем их и объясняем почему
  carSelect.addEventListener('change', () => {
    if (state.from && state.to && !rangeIsFree(busyOf(carSelect.value), state.from, state.to)) {
      setDates('', '');
      setError($('#f-from'), 'Эти даты заняты у выбранной машины — выберите другие.');
    }
  });

  const isDelivery = () => form.elements.delivery.value === 'delivery';
  $$('input[name="delivery"]', form).forEach((r) => r.addEventListener('change', () => {
    addressField.hidden = !isDelivery();
    renderSummary();
  }));

  // Маска телефона: +7 (999) 000-00-00
  const phoneDigits = (v) => {
    let d = v.replace(/\D/g, '');
    if (d.startsWith('8')) d = '7' + d.slice(1);
    if (d && !d.startsWith('7')) d = '7' + d;
    return d.slice(0, 11);
  };
  const formatPhone = (d) => {
    if (!d) return '';
    let out = '+7';
    if (d.length > 1) out += ' (' + d.slice(1, 4);
    if (d.length >= 4) out += ')';
    if (d.length > 4) out += ' ' + d.slice(4, 7);
    if (d.length > 7) out += '-' + d.slice(7, 9);
    if (d.length > 9) out += '-' + d.slice(9, 11);
    return out;
  };
  phoneInput.addEventListener('input', () => {
    phoneInput.value = formatPhone(phoneDigits(phoneInput.value));
  });

  function renderSummary() {
    const car = byId(carSelect.value);
    const d = days();
    if (!car) {
      summary.innerHTML = `
        <div class="summary__empty">
          <h3 class="h4">Расчёт стоимости</h3>
          <p>Выберите автомобиль и даты — здесь появится итоговая сумма со скидкой за срок.</p>
        </div>`;
      return;
    }
    const delivery = isDelivery() ? 'Бесплатно в пределах МКАД' : 'Пресненская наб., 12';
    let rows = '';
    let total = '';
    if (d) {
      const tier = tierFor(d);
      const rate = dayRate(car.price, d);
      rows = `
        <div class="summary__row"><dt>Срок</dt><dd>${d} ${daysWord(d)}, ${formatRange(state.from, state.to)}</dd></div>
        <div class="summary__row"><dt>Цена за сутки</dt><dd>${rub(rate)}${tier.rate ? `, −${Math.round(tier.rate * 100)}%` : ''}</dd></div>`;
      total = `
        <div class="summary__total"><span>Итого</span><span class="summary__total-value">${rub(rate * d)}</span></div>`;
    } else {
      rows = `<div class="summary__row"><dt>Цена за сутки</dt><dd>от ${rub(car.price)}</dd></div>`;
      total = '<p class="summary__note">Укажите даты получения и возврата, чтобы посчитать итог.</p>';
    }
    summary.innerHTML = `
      <div class="summary__media"><img src="${imgUrl(car.img, 800)}" alt="${car.alt}" style="object-position:${car.pos}"></div>
      <h3 class="h4 summary__name">${car.name}</h3>
      <dl class="summary__rows">
        ${rows}
        <div class="summary__row"><dt>${isDelivery() ? 'Доставка' : 'Самовывоз'}</dt><dd>${delivery}</dd></div>
        <div class="summary__row"><dt>Депозит</dt><dd>${rub(car.deposit)}</dd></div>
      </dl>
      ${total}
      <p class="summary__note">Депозит вернём на карту через 14 дней после окончания аренды.</p>`;
  }

  // Валидация
  const errorEl = (input) => $('#' + input.getAttribute('aria-describedby'));
  function setError(input, message) {
    input.setAttribute('aria-invalid', 'true');
    errorEl(input).textContent = message;
  }
  function clearError(input) {
    input.removeAttribute('aria-invalid');
    const el = errorEl(input);
    if (el) el.textContent = '';
  }
  $$('input, select', form).forEach((el) => {
    if (!el.getAttribute('aria-describedby')) return;
    el.addEventListener('input', () => clearError(el));
    el.addEventListener('change', () => clearError(el));
  });

  function validate() {
    const f = form.elements;
    const errors = [];
    if (!f.name.value.trim()) errors.push([f.name, 'Укажите имя, чтобы мы знали, как к вам обращаться.']);
    if (phoneDigits(f.phone.value).length !== 11) errors.push([f.phone, 'Укажите телефон полностью: +7 и ещё 10 цифр.']);
    if (!f.car.value) errors.push([f.car, 'Выберите автомобиль из списка.']);
    const fromBtn = $('#f-from'), toBtn = $('#f-to');
    if (!f.from.value) errors.push([fromBtn, 'Укажите дату получения.']);
    else if (f.from.value < today) errors.push([fromBtn, 'Дата получения не может быть в прошлом.']);
    if (!f.to.value) errors.push([toBtn, 'Укажите дату возврата.']);
    else if (f.from.value && f.to.value < f.from.value) errors.push([toBtn, 'Дата возврата должна быть не раньше даты получения.']);
    else if (f.car.value && f.from.value && !rangeIsFree(busyOf(f.car.value), f.from.value, f.to.value)) {
      errors.push([fromBtn, 'Эти даты заняты у выбранной машины — выберите другие.']);
    }
    if (isDelivery() && !f.address.value.trim()) errors.push([f.address, 'Укажите адрес, куда привезти автомобиль.']);
    return errors;
  }

  const formStatus = $('#form-status');
  const submitBtn = $('button[type="submit"]', form);
  // Ключи ошибок сервера → поля формы
  const SERVER_FIELDS = { name: 'name', phone: 'phone', carId: 'car', dateFrom: 'from', dateTo: 'to', address: 'address', comment: 'comment' };
  const CALL_US = 'Позвоните нам: +7 495 000-00-00.';

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    $$('[aria-invalid]', form).forEach(clearError);
    formStatus.hidden = true;
    const errors = validate();
    if (errors.length) {
      errors.forEach(([input, message]) => setError(input, message));
      errors[0][0].focus();
      return;
    }

    const f = form.elements;
    const payload = {
      name: f.name.value, phone: f.phone.value, carId: f.car.value,
      dateFrom: f.from.value, dateTo: f.to.value, delivery: f.delivery.value,
      address: f.address.value, comment: f.comment.value, website: f.website.value,
    };
    const label = submitBtn.textContent;
    submitBtn.disabled = true;
    submitBtn.textContent = 'Отправляем…';

    try {
      const res = await fetch('/api/requests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        const car = byId(carSelect.value);
        $('#success-title').textContent = data.id ? `Заявка №${data.id} отправлена.` : 'Заявка отправлена.';
        $('#success-text').textContent =
          `${car.name}, ${formatRange(state.from, state.to)}. Перезвоним на ${f.phone.value} в течение 15 минут и подтвердим бронь.`;
        form.hidden = true;
        const success = $('#form-success');
        success.hidden = false;
        success.focus();
        return;
      }
      if (res.status === 400 && data.errors) {
        const fields = Object.entries(data.errors)
          .map(([key, message]) => [['from', 'to'].includes(SERVER_FIELDS[key]) ? $('#f-' + SERVER_FIELDS[key]) : f[SERVER_FIELDS[key]], message])
          .filter(([input]) => input);
        fields.forEach(([input, message]) => setError(input, message));
        if (fields.length) { fields[0][0].focus(); return; }
      }
      formStatus.textContent = res.status === 429
        ? `Слишком много заявок подряд. ${CALL_US}`
        : `Не получилось отправить заявку. ${CALL_US}`;
      formStatus.hidden = false;
    } catch {
      formStatus.textContent = `Нет связи с сервером. Проверьте интернет или ${CALL_US.toLowerCase()}`;
      formStatus.hidden = false;
    } finally {
      submitBtn.disabled = false;
      submitBtn.textContent = label;
    }
  });

  $('#form-reset').addEventListener('click', () => {
    form.reset();
    formStatus.hidden = true;
    $('#success-title').textContent = 'Заявка отправлена.';
    state.from = '';
    state.to = '';
    syncDates();
    markAvailability();
    addressField.hidden = false;
    updateFleetPrices();
    renderSummary();
    $('#form-success').hidden = true;
    form.hidden = false;
    $('#f-name').focus();
  });

  function prefersReducedMotion() {
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  }

  // ── Отзывы: лента из четырёх колонок ────────────────
  // Источник — скрытый список отзывов (его читают скринридеры); здесь только визуальная копия
  const reviews = $$('.reviews .review').map((fig) => ({
    text: $('blockquote', fig).textContent,
    initials: $('.avatar', fig).textContent,
    name: $('.review__name', fig).textContent,
    car: $('.review__car', fig).textContent
  }));
  const escapeHtml = (t) => t.replace(/[&<>"]/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[ch]));
  const tcard = (r) => `
    <figure class="tcard">
      <div class="tcard__top">
        <span class="tcard__avatar">${escapeHtml(r.initials)}</span>
        <figcaption><span class="tcard__name">${escapeHtml(r.name)}</span><span class="tcard__car">${escapeHtml(r.car)}</span></figcaption>
      </div>
      <blockquote class="tcard__text">${escapeHtml(r.text)}</blockquote>
    </figure>`;
  // Каждая колонка начинает со своего отзыва, чтобы соседние не совпадали
  $('.testimonials__plane').innerHTML = [0, 1, 2, 3].map((col) => {
    const list = reviews.map((_, i) => reviews[(i + [0, 4, 7, 2][col]) % reviews.length]);
    const group = `<div class="mq__group">${list.map(tcard).join('')}</div>`;
    return `<div class="mq${col % 2 ? ' mq--reverse' : ''}" style="--duration:${[120, 140, 130, 150][col]}s">${group.repeat(3)}</div>`;
  }).join('');

  // ── Как проходит аренда: стойки вырастают при появлении ─
  const journey = $('#journey');
  if ('IntersectionObserver' in window && !prefersReducedMotion()) {
    journey.classList.add('is-ready');
    const jo = new IntersectionObserver((entries) => {
      if (entries.some((en) => en.isIntersecting)) { journey.classList.add('is-in'); jo.disconnect(); }
    }, { threshold: 0.3 });
    jo.observe(journey);
  }

  // ── Старт ───────────────────────────────────────────────
  renderShowcaseText();
  syncDates();
  updateFleetPrices();
  applyFilter('all');
  renderPlans();
  renderSummary();
})();
