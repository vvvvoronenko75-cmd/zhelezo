/* Железо — мобильный планировщик тренировок. Русский интерфейс, веса в кг. */
'use strict';

const LS_KEY = 'zhelezo.v1';
const $ = sel => document.querySelector(sel);
const DOW = ['Вс','Пн','Вт','Ср','Чт','Пт','Сб'];
const MONTHS = ['января','февраля','марта','апреля','мая','июня','июля','августа','сентября','октября','ноября','декабря'];
const MONTHS_NOM = ['Январь','Февраль','Март','Апрель','Май','Июнь','Июль','Август','Сентябрь','Октябрь','Ноябрь','Декабрь'];

const fmtW = w => (Math.round(w * 100) / 100).toLocaleString('ru-RU');
/* Подход умеет три вещи сверх «повторов»: диапазон (r..rmax), работу на время
   (unit:'sec') и вес, который ещё не подобран (w = 0 — показываем «вес?»). */
const repsRange = s => (s.rmax && s.rmax !== s.r) ? `${s.r}–${s.rmax}` : `${s.r}`;
const isTimed = s => s.unit === 'sec';
const repsText = s => isTimed(s) ? `${repsRange(s)} сек` : repsRange(s);
/* Тоннаж считаем только там, где он имеет смысл: секунды в килограммы не переводятся */
const setVol = s => isTimed(s) ? 0 : (s.ws ? s.ws.reduce((a, b) => a + b, 0) : s.w) * s.r;
/* У суперсета вес свой на каждую часть: «60 / 45 кг», у тройки — три числа */
const wText = s => {
  const ws = s.ws || [s.w];
  if (!ws.some(w => w > 0)) return '<span class="w-unset">· вес не задан</span>';
  return `@ ${ws.map(fmtW).join(' / ')} кг`;
};
/* Схема упражнения одной строкой: «3×6–10», «3×30–40 сек» */
const exScheme = ex => ex.sets.length ? `${ex.sets.length}×${repsText(ex.sets[0])}` : '—';
const restText = sec => sec >= 60 && sec % 60 === 0 ? `${sec / 60} мин` : `${sec} сек`;
const iso = d => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const fromIso = s => { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d); };
const fmtDate = s => { const d = fromIso(s); return `${DOW[d.getDay()]}, ${d.getDate()} ${MONTHS[d.getMonth()]}`; };

function mondayOfCurrentWeek() {
  const d = new Date();
  const shift = (d.getDay() + 6) % 7;
  d.setDate(d.getDate() - shift);
  d.setHours(0, 0, 0, 0);
  return d;
}

/* ---------- Сид: «База 5×5», по умолчанию 12 недель, 3 дня в неделю ----------
   Параметры: weeksCount — длина плана; daysPerWeek — 2/3/4 тренировки в неделю.
   Прогрессия и даты строятся на весь срок, а не клонированием последней недели. */
const DAY_OFFSETS = { 2: [0, 3], 3: [0, 2, 4], 4: [0, 1, 3, 4] }; // Пн/Чт · Пн/Ср/Пт · Пн/Вт/Чт/Пт
function seedProgram(weeksCount = 12, daysPerWeek = 3) {
  const start = mondayOfCurrentWeek();
  const dayOffsets = DAY_OFFSETS[daysPerWeek] || DAY_OFFSETS[3];
  const startW = { 'Приседания со штангой': 60, 'Жим лёжа': 50, 'Тяга штанги в наклоне': 55, 'Жим стоя': 35, 'Становая тяга': 80 };
  const inc = { 'Приседания со штангой': 2.5, 'Жим лёжа': 2.5, 'Тяга штанги в наклоне': 2.5, 'Жим стоя': 2.5, 'Становая тяга': 5 };
  const done = Object.fromEntries(Object.keys(startW).map(k => [k, 0])); // счётчик сессий упражнения

  const dayA = ['Приседания со штангой', 'Жим лёжа', 'Тяга штанги в наклоне'];
  const dayB = ['Приседания со штангой', 'Жим стоя', 'Становая тяга'];

  const weeks = [];
  let sessionNo = 0;
  for (let w = 0; w < weeksCount; w++) {
    const days = [];
    for (let di = 0; di < dayOffsets.length; di++) {
      const isA = sessionNo % 2 === 0;
      const names = isA ? dayA : dayB;
      const date = new Date(start);
      date.setDate(date.getDate() + w * 7 + dayOffsets[di]);
      days.push({
        title: isA ? 'Тренировка A' : 'Тренировка B',
        date: iso(date),
        exercises: names.map(n => {
          const weight = startW[n] + inc[n] * done[n];
          done[n]++;
          const setsCount = n === 'Становая тяга' ? 1 : 5;
          const reps = 5;
          return { name: n, sets: Array.from({ length: setsCount }, () => ({ w: weight, r: reps, done: false })) };
        }),
      });
      sessionNo++;
    }
    weeks.push({ days });
  }
  return { name: 'База 5×5', startDate: iso(start), daysPerWeek: dayOffsets.length, weeks };
}


/* ---------- Готовая программа владельца: День A (понедельник) ----------
   Суперсет — два упражнения подряд без отдыха между ними; помечены полем ss
   (общий ярлык пары). Вес нигде не задан (0): подбирается в первый заход,
   поэтому автоматической прогрессии тут нет — план повторяется неделя в неделю. */
function programDayAB(weeksCount = 12) {
  const start = mondayOfCurrentWeek();
  const planA = [
    { name: 'Приседания', sets: 3, r: 6, rmax: 10, rest: 120 },
    { name: 'Жим лёжа + Тяга к поясу', parts: ['Жим лёжа', 'Тяга к поясу'], sets: 3, r: 8, rmax: 12, rest: 90 },
    { name: 'Разгибание ног + Сгибание ног', parts: ['Разгибание ног', 'Сгибание ног'], sets: 3, r: 12, rmax: 15, rest: 60 },
    { name: 'Махи в стороны + Разведения в наклоне', parts: ['Махи в стороны', 'Разведения в наклоне'], sets: 3, r: 12, rmax: 15, rest: 60 },
    { name: 'Походка фермера', sets: 3, r: 30, rmax: 40, rest: 60, unit: 'sec' },
  ];
  const planB = [
    { name: 'Ягодичный мост + Боковые подъёмы', parts: ['Ягодичный мост', 'Боковые подъёмы'], sets: 3, r: 10, rmax: 15, rest: 90 },
    { name: 'Свенд-жим + Горизонтальная тяга сидя', parts: ['Свенд-жим', 'Горизонтальная тяга сидя'], sets: 3, r: 10, rmax: 15, rest: 90 },
    { name: 'Плечи (жим + махи + разведения в наклоне)', parts: ['Жим', 'Махи', 'Разведения в наклоне'], sets: 3, r: 12, rmax: 15, rest: 60 },
    { name: 'Подъём на носки', sets: 3, r: 12, rmax: 20, rest: 60 },
  ];
  const planC = [
    { name: 'Румынская тяга', sets: 3, r: 8, rmax: 12, rest: 120 },
    { name: 'Тяга вертикального блока + Жим гантелей', parts: ['Тяга вертикального блока', 'Жим гантелей'], sets: 3, r: 8, rmax: 12, rest: 90 },
    { name: 'Пулловер с гантелью', sets: 3, r: 10, rmax: 15, rest: 60 },
    { name: 'Махи в стороны + Тяга к лицу', parts: ['Махи в стороны', 'Тяга к лицу'], sets: 3, r: 12, rmax: 15, rest: 60 },
    { name: 'Подъём на носки стоя', sets: 3, r: 12, rmax: 20, rest: 60 },
  ];
  /* Три тренировки в неделю через день: понедельник, среда, пятница */
  const days = [
    { title: 'День A', offset: 0, plan: planA },
    { title: 'День B', offset: 2, plan: planB },
    { title: 'День C', offset: 4, plan: planC },
  ];
  const weeks = [];
  for (let w = 0; w < weeksCount; w++) {
    weeks.push({ days: days.map(d => {
      const date = new Date(start);
      date.setDate(date.getDate() + w * 7 + d.offset); /* Пн / Ср / Пт */
      return {
        title: d.title,
        date: iso(date),
        exercises: d.plan.map(e => ({
          name: e.name,
          rest: e.rest,
          parts: e.parts,               /* части суперсета/тройки — одна строка плана */
          sets: Array.from({ length: e.sets }, () => {
            const st = { w: 0, r: e.r, rmax: e.rmax, done: false };
            if (e.unit) st.unit = e.unit;
            if (e.parts) st.ws = e.parts.map(() => 0); /* по весу на каждую часть */
            return st;
          }),
        })),
      };
    }) });
  }
  return { name: 'Дни A, B и C', v: PROGRAM_V, startDate: iso(start), daysPerWeek: days.length, weeks };
}


/* ---------- Обновление сохранённой программы ----------
   Программа лежит в устройстве вместе с отметками и весами, поэтому новая версия
   приложения её не переписывает молча. Здесь — перенос: строится свежий план,
   в него переносятся веса и отметки старого по названиям упражнений и датам.
   Старые названия, изменённые по ходу правок, сопоставляются через ALIAS. */
const PROGRAM_V = 3;
const ALIAS = {
  'разведения на плечи': 'разведения в наклоне',
  'разведения': 'разведения в наклоне',
  'горизонтальная тяга': 'горизонтальная тяга сидя',
  /* родня из «Базы 5×5» — для перехода на «Дни A, B и C» с переносом весов */
  'приседания со штангой': 'приседания',
  'тяга штанги в наклоне': 'тяга к поясу',
  'жим стоя': 'жим',
};
const normName = n => {
  const k = String(n || '').trim().toLowerCase();
  return ALIAS[k] || k;
};
/* Наша ли это встроенная программа: обновлять чужую (созданную «Базу 5×5» или
   переименованную вручную) нельзя — там может быть что угодно. */
const isBuiltIn = p => !!p && /день a/i.test(p.weeks?.[0]?.days?.[0]?.title || '');
const needsUpdate = () => isBuiltIn(state.program) && (state.program.v || 0) < PROGRAM_V;
/* «База 5×5» (дни называются «Тренировка A/B») — переход предлагаем, но не навязываем */
const isSeed55 = p => !!p && /^тренировка/i.test(p.weeks?.[0]?.days?.[0]?.title || '');
const offerSwitch = () => isSeed55(state.program) && !state.ui.hideSwitch;

function migrateProgram() {
  const old = state.program;
  const fromSeed = isSeed55(old);
  const fresh = programDayAB(old.weeks.length);
  /* Своё название владельца сохраняем; наши стандартные («День A (Пн)», «Дни A и B») обновляем на новое */
  fresh.name = old.name && !fromSeed && !/^(день a|дни a)/i.test(old.name) ? old.name : fresh.name;

  /* Указатель на старые упражнения: неделя + буква дня → имя → упражнение.
     Именно по букве, а не по дате: расписание могло сдвинуться (День B был
     в четверг, стал в среду), и привязка к дате потеряла бы отметки. */
  const byWeekDay = {};
  old.weeks.forEach((w, wi) => w.days.forEach(d => {
    const key = wi + '|' + dayLetter(d.title);
    const m = byWeekDay[key] || (byWeekDay[key] = {});
    d.exercises.forEach(e => {
      m[normName(e.name)] = e;
      /* Старый суперсет хранится одной строкой с общим именем — раскладываем его
         на части, иначе новый план, ищущий по половинам, не найдёт ни весов, ни отметок */
      (e.parts || []).forEach((pn, pi) => {
        m[normName(pn)] = { sets: e.sets.map(st => ({ w: st.ws ? (st.ws[pi] || 0) : st.w, done: !!st.done })) };
      });
    });
  }));
  /* Веса могли задаваться в любой день — берём последний известный по каждому имени */
  const lastW = {};
  old.weeks.forEach(w => w.days.forEach(d => d.exercises.forEach(e => {
    const w0 = e.sets?.[0]?.w;
    if (w0 > 0) lastW[normName(e.name)] = w0;
    (e.parts || []).forEach((pn, pi) => {
      const pw = e.sets?.[0]?.ws?.[pi];
      if (pw > 0) lastW[normName(pn)] = pw;
    });
  })));

  let keptDone = 0, keptW = 0;
  fresh.weeks.forEach((w, wi) => w.days.forEach(d => {
    const oldDay = byWeekDay[wi + '|' + dayLetter(d.title)] || {};
    d.exercises.forEach(ex => {
      const parts = ex.parts || [ex.name];
      const srcs = parts.map(n => oldDay[normName(n)]);
      /* вес каждой части: из того же дня, иначе последний известный по имени */
      const ws = parts.map((n, pi) => {
        const v = srcs[pi]?.sets?.[0]?.w ?? lastW[normName(n)] ?? 0;
        if (v > 0) keptW++;
        return v;
      });
      ex.sets.forEach((st, si) => {
        if (ex.parts) { st.ws = ws.slice(); st.w = ws[0]; } else { st.w = ws[0]; }
        /* подход считается выполненным, если он был отмечен у всех частей строки;
           при переходе с «Базы 5×5» отметки не переносим — это зачёт другой программы */
        const known = srcs.filter(Boolean);
        if (!fromSeed && known.length === parts.length && known.every(e => e.sets?.[si]?.done)) { st.done = true; keptDone++; }
      });
    });
  }));

  state.program = fresh;
  state.ui.sel = findUpcoming(fresh);
  state.ui.openWeek = 0; state.ui.editSet = null;
  render(); scrollTop();
  showToast(fromSeed ? `Вы на «Днях A, B и C»: веса перенесены (${keptW})` : `Программа обновлена: перенесено отметок — ${keptDone}, весов — ${keptW}`);
}

/* ---------- Состояние ----------
   В хранилище лежит { program, ui, rev }. rev — версия ДАННЫХ программы: растёт
   только тогда, когда сама программа изменилась. По ней вкладки понимают, чья
   копия свежее: вкладка с устаревшей копией сначала забирает чужую новую и лишь
   потом пишет — иначе тап в давно открытой вкладке стирал отметки, сделанные в
   соседней. ui (вкладка, выбранный день, таймер) у каждой вкладки своё и версию
   не двигает, поэтому вкладки не гоняют записи друг другу по кругу. */
let state = load();
let lastProgJson = JSON.stringify(state.program); /* данные на момент последней записи/чтения */
let lastRaw = null;                               /* строка, которую мы сами последней положили в хранилище */

function blankState() {
  const s = { program: programDayAB(), ui: { tab: 'program', openWeek: 0, sel: null, rest: null }, rev: Date.now() };
  s.ui.sel = findUpcoming(s.program);
  return s;
}
/* объявление функцией, а не стрелкой: load() вызывается выше по файлу */
function validState(s) { return !!(s && s.program && Array.isArray(s.program.weeks) && s.program.weeks.length && s.ui); }

function load() {
  let s = null;
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (raw) s = JSON.parse(raw);
  } catch (e) { s = null; /* повреждённые данные или закрытое хранилище — начинаем заново */ }
  if (!validState(s)) return blankState();
  s.rev = Number.isFinite(Number(s.rev)) ? Number(s.rev) : Date.now();
  s.ui.rest = sanitizeRest(s.ui.rest);
  return s;
}

/* Таймер отдыха переживает перезагрузку: хранится абсолютный конец, поэтому
   после возврата видно реально оставшееся время. Мусор, уже истёкший и
   неправдоподобно длинный таймер отбрасываем. */
function sanitizeRest(r) {
  if (!r || !Number.isFinite(r.end) || !Number.isFinite(r.total) || r.total <= 0) return null;
  const left = r.end - Date.now();
  if (left <= 0 || left > 6 * 3600e3) return null;
  return { end: r.end, total: r.total };
}

let storageBroken = false;
function save() {
  const progJson = JSON.stringify(state.program);
  if (progJson !== lastProgJson) {          /* данные изменились — новая версия */
    state.rev = Math.max(Number(state.rev || 0) + 1, Date.now());
    lastProgJson = progJson;
  }
  try {
    const raw = JSON.stringify(state);
    localStorage.setItem(LS_KEY, raw);
    lastRaw = raw;                          /* чтобы сверка перед действием была дешёвой */
    if (storageBroken) { storageBroken = false; hideToast(); }
  } catch (e) {
    /* приватный режим или переполненная квота: экран рисуется, но на диск ничего
       не легло. Молчать нельзя — человек потеряет тренировку, не подозревая об этом. */
    storageBroken = true;
    showToast('Не удалось сохранить: память браузера переполнена или закрыта. Изменения видны на экране, но не сохранятся.');
  }
}

/* Соседняя вкладка записала более новые данные — забираем их, своё ui не трогаем. */
function adoptExternal(inc) {
  if (!validState(inc)) return false;
  const incRev = Number(inc.rev);
  if (!Number.isFinite(incRev) || incRev <= Number(state.rev || 0)) return false;
  state.program = inc.program;
  state.rev = incRev;
  lastProgJson = JSON.stringify(state.program);
  const sel = state.ui.sel;
  if (!sel || !state.program.weeks[sel.w]?.days[sel.d]) state.ui.sel = findUpcoming(state.program);
  state.ui.openWeek = Math.min(state.ui.openWeek ?? 0, state.program.weeks.length - 1);
  state.ui.editSet = null;                 /* индексы относились к прежней копии */
  return true;
}
/* Сверка перед действием: если в хранилище ровно то, что мы сами туда положили,
   разбирать JSON незачем — сравнение строк дешевле и тап не тяжелеет (lastRaw
   объявлен выше, рядом с состоянием). */
function syncFromStorage() {
  let inc = null;
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (raw === lastRaw) return false;
    lastRaw = raw;
    inc = raw ? JSON.parse(raw) : null;
  } catch (e) { return false; }
  return adoptExternal(inc);
}
window.addEventListener('storage', e => {
  if (e.key && e.key !== LS_KEY) return;
  let inc = null;
  try { inc = e.newValue ? JSON.parse(e.newValue) : null; } catch (err) { return; }
  if (adoptExternal(inc)) render();
});
/* Вкладку могли заморозить (телефон свернули) — тогда storage-события не придут.
   Поэтому сверяемся с хранилищем ещё и при возврате на вкладку, и перед КАЖДЫМ
   действием: capture-фаза на документе срабатывает раньше любых обработчиков,
   так что действие всегда применяется к свежим данным. */
['pageshow', 'focus', 'visibilitychange'].forEach(ev =>
  window.addEventListener(ev, () => { if (!document.hidden && syncFromStorage()) render(); }));
document.addEventListener('click', () => { if (syncFromStorage()) render(); }, true);

/* Негромкое предупреждение поверх экрана — для того, о чём нельзя промолчать. */
let toastTimer = null;
function showToast(msg) {
  let el = $('#toast');
  if (!el) {
    el = document.createElement('div');
    el.id = 'toast';
    el.setAttribute('role', 'status');
    document.body.appendChild(el);
  }
  el.textContent = msg;
  el.classList.remove('hidden');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.add('hidden'), 8000);
}
function hideToast() { clearTimeout(toastTimer); $('#toast')?.classList.add('hidden'); }

function findUpcoming(program) {
  const today = iso(new Date());
  for (let w = 0; w < program.weeks.length; w++)
    for (let d = 0; d < program.weeks[w].days.length; d++) {
      const day = program.weeks[w].days[d];
      /* день без упражнений — не тренировка, ближайшей считаться не может */
      if (day.date >= today && day.exercises.length > 0) return { w, d };
    }
  return { w: 0, d: 0 };
}

const getDay = sel => state.program.weeks[sel.w]?.days[sel.d];
/* День без упражнений не считается запланированной тренировкой: он не попадает
   ни в знаменатели прогресса, ни в календарь — иначе план навсегда застревает
   ниже 100% и «Завершить» становится мёртвой кнопкой. */
const dayPlanned = day => day.exercises.length > 0;
const dayDone = day => day.exercises.length > 0 && day.exercises.every(ex => ex.sets.every(s => s.done));
const dayTouched = day => day.exercises.some(ex => ex.sets.some(s => s.done));
const MAX_W = 999;   /* потолок веса — один и тот же в форме и в кнопках ± */
const MAX_R = 50;    /* потолок повторов — один и тот же в форме и в кнопках ± */
/* Разбор числа из поля: пустое/мусор → прежнее значение, а не молчаливый ноль. */
function clampNum(raw, lo, hi, fallback, int) {
  let v = parseFloat(String(raw ?? '').replace(',', '.'));
  if (!Number.isFinite(v)) return fallback;
  if (int) v = Math.round(v);
  return Math.max(lo, Math.min(hi, v));
}

/* ---------- Рендер ---------- */
const TITLES = { program: 'Программа', workout: 'Тренировка', calendar: 'Календарь', progress: 'Прогресс' };

function render() {
  $('#topbar-title').textContent = TITLES[state.ui.tab];
  document.querySelectorAll('.tab').forEach(b => b.classList.toggle('active', b.dataset.tab === state.ui.tab));
  const el = $('#screen');
  if (state.ui.tab === 'program') el.innerHTML = renderProgram();
  else if (state.ui.tab === 'workout') el.innerHTML = renderWorkout();
  else if (state.ui.tab === 'calendar') el.innerHTML = renderCalendar();
  else el.innerHTML = renderProgress();
  if (state.ui.tab === 'progress') drawChart();
  if (state.ui.tab === 'calendar') initCalNav();
  tickRest();
  save();
}

/* --- Навигация по месяцам календаря --- */
const calMonthsEls = () => [...document.querySelectorAll('.cal-month')];
function initCalNav() {
  const nav = $('#cal-nav'); if (!nav) return;
  nav.style.top = (($('#topbar')?.offsetHeight || 64) - 1) + 'px'; /* липнет ровно под шапкой */
  padCalBottom();
  calAuto = false;
  updateCalNavTitle();
}
/* Запас снизу, чтобы последний месяц мог доехать до верха экрана и стать «активным».
   Без него титул застревал на предпоследнем месяце: низ страницы наступал раньше. */
function padCalBottom() {
  const els = calMonthsEls(); if (!els.length) return;
  const last = els[els.length - 1];
  const off = ($('#topbar')?.offsetHeight || 64) + ($('#cal-nav')?.offsetHeight || 40) + 8;
  const pad = Math.max(0, window.innerHeight - off - last.offsetHeight);
  last.style.marginBottom = pad + 'px';
}
window.addEventListener('resize', () => { if (state.ui.tab === 'calendar') { padCalBottom(); updateCalNavTitle(); } });
/* Линия под липкой полоской: месяц, чья сетка пересекла её сверху, и есть текущий.
   Порог 16px > 8px отступа в calScrollToMonth — прижатый месяц считается активным. */
function calMonthLine() {
  const nav = $('#cal-nav');
  return (nav ? nav.getBoundingClientRect().bottom : 100) + 16;
}
/* Активен ПОСЛЕДНИЙ месяц, верх которого уже ушёл под полоску, — то есть ровно тот,
   что стоит сейчас вверху экрана. Индекс монотонен по прокрутке: «‹» всегда
   уменьшает его, «›» всегда увеличивает ровно на один месяц.
   (Прежний выбор «по наибольшей видимой площади» немонотонен: более высокий
   следующий месяц побеждал прижатый к верху — титул врал, «‹» заклинивало.) */
function calActiveIdx() {
  const els = calMonthsEls();
  const line = calMonthLine();
  let idx = 0;
  els.forEach((el, i) => { if (el.getBoundingClientRect().top <= line) idx = i; });
  return idx;
}
/* Пейджер ведёт СВОЙ индекс месяца: стрелка двигает его ровно на ±1 и скроллит
   к нему. Пока едет наша прокрутка (calAuto), позиция страницы индекс не
   переопределяет — иначе быстрые нажатия подряд читали бы недоехавший экран и
   месяц повторялся бы. При ручной прокрутке индекс синхронизируется по странице. */
let calIdx = 0, calAuto = false, calAutoTimer = null;
function calGo(delta) {
  const els = calMonthsEls(); if (!els.length) return;
  if (!calAuto) calIdx = calActiveIdx();
  calIdx = Math.max(0, Math.min(els.length - 1, calIdx + delta));
  calAuto = true;
  clearTimeout(calAutoTimer);
  calAutoTimer = setTimeout(() => { calAuto = false; updateCalNavTitle(); }, 900);
  calScrollToMonth(calIdx);
  updateCalNavTitle();
}
function updateCalNavTitle() {
  const els = calMonthsEls();
  if (!els.length || !$('#cal-nav')) return;
  if (!calAuto) calIdx = calActiveIdx();
  const i = Math.max(0, Math.min(els.length - 1, calIdx));
  $('#cal-nav-title').textContent = els[i].dataset.title || '';
  document.querySelector('[data-act="cal-prev"]')?.toggleAttribute('disabled', i === 0);
  document.querySelector('[data-act="cal-next"]')?.toggleAttribute('disabled', i === els.length - 1);
}
function calScrollToMonth(i) {
  const els = calMonthsEls(); if (!els[i]) return;
  const nav = $('#cal-nav');
  const off = ($('#topbar')?.offsetHeight || 64) + (nav ? nav.offsetHeight : 40) + 8;
  window.scrollTo({ top: window.scrollY + els[i].getBoundingClientRect().top - off, behavior: 'smooth' });
}
window.addEventListener('scroll', () => { if (state.ui.tab === 'calendar') updateCalNavTitle(); }, { passive: true });

/* --- Программа --- */
const MONTHS_SHORT = ['янв', 'фев', 'мар', 'апр', 'мая', 'июн', 'июл', 'авг', 'сен', 'окт', 'ноя', 'дек'];
const weekTonnage = w => w.days.reduce((n, d) => n + d.exercises.reduce((m, e) => m + e.sets.reduce((k, s) => k + setVol(s), 0), 0), 0);
const weekDoneAll = w => { const ds = w.days.filter(dayPlanned); return ds.length > 0 && ds.every(dayDone); };

function weekRange(week) {
  if (!week.days.length) return '';
  const a = fromIso(week.days[0].date), b = fromIso(week.days.at(-1).date);
  if (a.getMonth() === b.getMonth()) return `${a.getDate()}–${b.getDate()} ${MONTHS_SHORT[a.getMonth()]}`;
  return `${a.getDate()} ${MONTHS_SHORT[a.getMonth()]} – ${b.getDate()} ${MONTHS_SHORT[b.getMonth()]}`;
}

/* Ключевая цифра прогрессии недели: пиковый вес главного (первого) лифта.
   Подпись с явным префиксом «пик:» — читается без догадок. */
const LIFT_SHORT = { 'приседания': 'присед', 'подтягивания': 'подтяг' };
function weekKeyLift(week) {
  const mainName = week.days[0]?.exercises[0]?.name;
  if (!mainName) return '';
  let top = 0;
  week.days.forEach(d => d.exercises.forEach(e => {
    if (e.name === mainName) e.sets.forEach(s => { top = Math.max(top, s.w); });
  }));
  const first = mainName.split(' ')[0].toLowerCase();
  const short = LIFT_SHORT[first] || first;
  return `пик: ${short} ${fmtW(top)} кг`;
}

function renderProgram() {
  const p = state.program;
  const total = p.weeks.reduce((n, w) => n + w.days.filter(dayPlanned).length, 0);
  const doneCnt = p.weeks.reduce((n, w) => n + w.days.filter(dayDone).length, 0);
  const pct = total ? Math.round(doneCnt / total * 100) : 0;
  const months = Math.round(p.weeks.length / 4.345 * 10) / 10;
  const curW = findUpcoming(p).w;

  const tons = p.weeks.map(weekTonnage);
  /* Пока веса не подобраны, тоннаж всюду 0: график и «пик» рисовать нечем — честнее сказать это словами */
  const noWeights = tons.every(t => t === 0);
  const loT = Math.min(...tons), hiT = Math.max(...tons);
  const firstT = tons[0] || 0, lastT = tons.at(-1) || 0;
  const delta = firstT ? Math.round((lastT - firstT) / firstT * 100) : 0;
  /* Шкала от минимальной недели к максимальной: виден и рост, и провалы (например Н2 < Н1) */
  const bars = p.weeks.map((w, wi) => {
    const h = hiT === loT ? 100 : 16 + (tons[wi] - loT) / (hiT - loT) * 84;
    const cls = weekDoneAll(w) ? ' done' : (wi === curW ? ' cur' : '');
    return `<div class="lbar${cls}" style="height:${h.toFixed(1)}%" title="Н${wi + 1}: ${fmtW(tons[wi])} кг"></div>`;
  }).join('');

  /* Лёгкие подписи оси: Н1 / Н4 / Н8 / Н12 (края + две промежуточные) */
  const axisIdx = new Set([0, p.weeks.length - 1]);
  if (p.weeks.length > 5) {
    axisIdx.add(Math.floor((p.weeks.length - 1) / 3));
    axisIdx.add(Math.floor((p.weeks.length - 1) * 2 / 3));
  }
  const axis = p.weeks.map((w, wi) => `<span class="lax">${axisIdx.has(wi) ? 'Н' + (wi + 1) : ''}</span>`).join('');

  let html = needsUpdate() ? `
  <div class="card upd-card">
    <div class="h2">Программа обновилась</div>
    <div class="muted" style="margin:4px 0 10px">Три тренировки в неделю (Пн · Ср · Пт), суперсеты одной строкой, тройка плеч, уточнённые названия. Ваши отметки и подобранные веса перенесутся.</div>
    <button class="btn" data-act="migrate">Обновить программу</button>
  </div>` : '';
  if (offerSwitch()) html += `
  <div class="card upd-card">
    <div class="h2">Готова программа «Дни A, B и C»</div>
    <div class="muted" style="margin:4px 0 10px">Три тренировки в неделю (Пн · Ср · Пт) с суперсетами — та, что вы продиктовали. Веса совпадающих упражнений (присед, жим лёжа, тяга, жим) перенесутся из «Базы 5×5» по неделям; отметки «Базы» относятся к другой программе и в зачёт новой не пойдут.</div>
    <div class="row">
      <button class="btn secondary" data-act="hide-switch">Остаться на «Базе 5×5»</button>
      <button class="btn" data-act="migrate">Перейти</button>
    </div>
  </div>`;
  html += `
  <div class="card">
    <div class="prog-top">
      <div>
        <div class="h1">${esc(p.name)}</div>
        <div class="muted" style="margin-top:2px">${p.weeks.length} ${plural(p.weeks.length, 'неделя', 'недели', 'недель')} (~${months.toLocaleString('ru-RU')} мес.) · ${p.daysPerWeek} дн/нед</div>
      </div>
      <button class="btn small secondary" data-act="rename">Изменить</button>
    </div>
    <div class="meter"><div class="meter-fill" style="width:${pct}%"></div></div>
    <div class="small" style="margin-top:6px">Выполнено ${doneCnt} из ${total} тренировок (${pct}%)</div>
    <div class="prog-divider"></div>
    ${noWeights ? `
    <div class="label-row"><span class="mini-label">Нагрузка по неделям</span></div>
    <div class="small" style="margin-top:6px">Веса пока не заданы. Впишите рабочий вес на первой тренировке — здесь появится нагрузка по неделям и рост за цикл.</div>
    ` : `
    <div class="label-row">
      <span class="mini-label">Нагрузка по неделям</span>
      <span class="chip">${delta >= 0 ? '+' : ''}${delta}% за цикл</span>
    </div>
    <div class="loadbars">${bars}</div>
    <div class="loadbars-axis">${axis}</div>
    `}
  </div>`;

  html += `<div class="section-label">План по неделям</div>`;
  html += p.weeks.map((week, wi) => {
    const open = state.ui.openWeek === wi;
    const wDone = week.days.filter(dayDone).length;
    const all = week.days.filter(dayPlanned).length;
    const isCur = wi === curW && !weekDoneAll(week);
    const dots = week.days.filter(dayPlanned).map(d => `<span class="dot${dayDone(d) ? ' on' : ''}"></span>`).join('');
    const body = open ? `<div class="week-body">` + week.days.map((day, di) => `
      <div class="day-row" data-act="open-day" data-w="${wi}" data-d="${di}">
        <div class="day-main">
          <div class="day-name">${esc(day.title)} · ${fmtDate(day.date)}</div>
          <div class="day-list">${day.exercises.length ? day.exercises.map(ex => `
            <div class="day-ex"><span class="dx-n">${ex.parts ? '<b class="ss-tag">СС</b> ' : ''}${esc(ex.name)}</span><span class="dx-v">${exScheme(ex)}${(ex.sets[0]?.w ?? 0) > 0 ? " · " + fmtW(ex.sets[0].w) + "&nbsp;кг" : ''}</span></div>`).join('')
            : `<div class="day-ex"><span class="dx-n">Нет упражнений</span><span class="dx-v">не в зачёт</span></div>`}
          </div>
        </div>
        <div class="caret${dayDone(day) ? ' ok' : ''}">${dayDone(day) ? '✓' : '›'}</div>
      </div>`).join('') + `</div>` : '';
    return `<div class="week${isCur ? ' cur' : ''}${weekDoneAll(week) ? ' done-wk' : ''}">
      <div class="week-head" data-act="toggle-week" data-w="${wi}">
        <div class="wk-num">${weekDoneAll(week) ? '✓' : wi + 1}</div>
        <div class="wk-main">
          <div class="wk-title">Неделя ${wi + 1}</div>
          <div class="wk-sub">${weekRange(week)}${weekTonnage(week) ? ` · ${fmtW(weekTonnage(week))} кг` : ''}</div>
        </div>
        <div class="wk-right">
          <div class="wk-ton">${noWeights ? '' : weekKeyLift(week)}</div>
          <div class="wk-status">${dots}<span class="wk-cnt">${wDone}/${all}</span></div>
        </div>
        <span class="caret">${open ? '▾' : '▸'}</span>
      </div>${body}</div>`;
  }).join('');

  html += `<button class="btn secondary" data-act="new-program" style="margin-top:10px">Новая программа</button>`;
  return html;
}

/* --- Тренировка --- */
/* Максимальный запланированный вес упражнения за весь цикл — база для процентов */
function cycleMax(name) {
  let m = 0;
  state.program.weeks.forEach(w => w.days.forEach(d => d.exercises.forEach(e => {
    if (e.name === name) e.sets.forEach(s => { m = Math.max(m, s.w); });
  })));
  return m;
}

/* Максимальные запланированные повторы — цель для упражнений с собственным весом,
   где рекорд меряется не килограммами, а повторами. */
function cycleMaxR(name) {
  let m = 0;
  state.program.weeks.forEach(w => w.days.forEach(d => d.exercises.forEach(e => {
    if (e.name === name) e.sets.forEach(s => { m = Math.max(m, s.r); });
  })));
  return m;
}

function setEditor(ex, ei, si, s) {
  /* Вес: у обычного упражнения один степпер, у суперсета/тройки — по степперу
     на каждую часть, подписанному её именем. Повторы (или секунды) — общие. */
  const wRows = s.ws
    ? s.ws.map((wv, pi) => `
    <div class="edit-grp">
      <button data-act="wp-" data-e="${ei}" data-s="${si}" data-p="${pi}">−2,5</button>
      <div class="edit-val"><b>${fmtW(wv)}</b><span>${esc((ex.parts?.[pi] || 'кг').slice(0, 14))}</span></div>
      <button data-act="wp+" data-e="${ei}" data-s="${si}" data-p="${pi}">+2,5</button>
    </div>`).join('')
    : `
    <div class="edit-grp">
      <button data-act="w-" data-e="${ei}" data-s="${si}">−2,5</button>
      <div class="edit-val"><b>${fmtW(s.w)}</b><span>кг</span></div>
      <button data-act="w+" data-e="${ei}" data-s="${si}">+2,5</button>
    </div>`;
  return `
  <div class="set-edit">
    ${wRows}
    <div class="edit-grp">
      <button data-act="r-" data-e="${ei}" data-s="${si}">−1</button>
      <div class="edit-val"><b>${s.r}</b><span>${isTimed(s) ? 'сек' : 'повт'}</span></div>
      <button data-act="r+" data-e="${ei}" data-s="${si}">+1</button>
    </div>
    <button class="edit-close" data-act="edit-set" data-e="${ei}" data-s="${si}">Готово</button>
  </div>`;
}

function renderWorkout() {
  const sel = state.ui.sel || findUpcoming(state.program);
  const day = getDay(sel);
  if (!day) return '<div class="card"><div class="muted">Тренировка не найдена</div></div>';
  const total = day.exercises.reduce((n, e) => n + e.sets.length, 0);
  const dn = day.exercises.reduce((n, e) => n + e.sets.filter(s => s.done).length, 0);
  const tonnage = day.exercises.reduce((n, e) => n + e.sets.filter(s => s.done).reduce((m, s) => m + setVol(s), 0), 0);
  const pct = total ? Math.round(dn / total * 100) : 0;
  const leftMin = Math.round((total - dn) * 2.5); // ~2,5 мин на подход с отдыхом
  const complete = total > 0 && dn === total;
  const es = state.ui.editSet;

  let html = `
  <div class="card wo-head">
    <div class="wo-top">
      <div>
        <div class="h2">${esc(day.title)}</div>
        <div class="muted" style="margin-top:2px">Неделя ${sel.w + 1} из ${state.program.weeks.length} · ${fmtDate(day.date)}</div>
      </div>
      ${complete
        ? '<span class="chip ok">Выполнена ✓</span>'
        : total > 0
          ? '<button class="btn small" data-act="finish-day">Завершить</button>'
          : '<span class="chip gray">Пустой день</span>'}
    </div>
    <div class="wo-stats">
      <div class="wo-stat"><b>${dn}/${total}</b><span>подходов</span></div>
      <div class="wo-stat"><b>${fmtW(tonnage)}</b><span>тоннаж, кг</span></div>
      <div class="wo-stat"><b>${complete ? '—' : '~' + leftMin}</b><span>мин осталось</span></div>
    </div>
    <div class="meter slim"><div class="meter-fill${complete ? ' ok' : ''}" style="width:${pct}%"></div></div>
  </div>`;

  html += day.exercises.map((ex, ei) => {
    const max = cycleMax(ex.name);
    const exDn = ex.sets.filter(s => s.done).length;
    const exDone = exDn === ex.sets.length && ex.sets.length > 0;
    /* Единый вид строки везде: одинаковые подходы подряд сворачиваем в строку
       «5×5 @ 62,5 кг · 42%» с кружком на каждый подход. Одиночный подход — та же
       строка «1×5 @ 80 кг»; тап по ней раскрывает редактор кг/повт, тап по
       группе открывает шторку упражнения. */
    const grps = [];
    ex.sets.forEach((s, si) => {
      const g = grps.at(-1);
      const key = s => `${s.w}|${(s.ws || []).join(',')}|${s.r}|${s.rmax}|${s.unit}`;
      if (g && key(g) === key(s)) g.items.push(si);
      else grps.push({ w: s.w, ws: s.ws, r: s.r, rmax: s.rmax, unit: s.unit, items: [si] });
    });
    const expanded = state.ui.openSets === ei;
    let rows;
    if (expanded) {
      /* Поштучно: своя строка у каждого подхода, тап — редактор веса и повторов
         именно этого подхода. Правки не трогают соседние подходы и будущие дни. */
      rows = ex.sets.map((st, si) => {
        const editing = es && es.e === ei && es.s === si;
        const pctS = (max && !ex.parts && st.w > 0) ? ` <span class="sg-pct">· ${Math.round(st.w / max * 100)}%</span>` : '';
        return `
      <div class="set-grp one${editing ? ' sedit' : ''}" data-act="edit-set" data-e="${ei}" data-s="${si}">
        <div class="sg-main">
          <div class="sg-val">Подход ${si + 1} · ${repsText(st)} ${wText(st)}${pctS}<span class="sg-edit">✎</span></div>
        </div>
        <div class="sg-checks"><button class="set-check grp${st.done ? ' done' : ''}" data-act="check" data-e="${ei}" data-s="${si}">${st.done ? '✓' : si + 1}</button></div>
      </div>${editing ? setEditor(ex, ei, si, st) : ''}`;
      }).join('') + `
      <div class="sg-fold" data-act="toggle-sets" data-e="${ei}">Свернуть подходы ▴</div>`;
    } else rows = grps.map(g => {
      const dnG = g.items.filter(si => ex.sets[si].done).length;
      const pctG = (max && !ex.parts) ? Math.round(g.w / max * 100) : 0;
      const single = g.items.length === 1;
      const si0 = g.items[0];
      const editing = single && es && es.e === ei && es.s === si0;
      /* Тап по одиночному подходу — сразу редактор; по группе — раскрыть поштучно */
      const act = single
        ? `data-act="edit-set" data-e="${ei}" data-s="${si0}"`
        : `data-act="toggle-sets" data-e="${ei}"`;
      return `
      <div class="set-grp${editing ? ' sedit' : ''}" ${act}>
        <div class="sg-main">
          <div class="sg-val">${g.items.length}×${repsText(g)} ${wText(g)}${pctG ? ` <span class="sg-pct">· ${pctG}%</span>` : ''}<span class="sg-edit">✎</span></div>
          <div class="sg-sub">выполнено ${dnG} из ${g.items.length}${single ? '' : ' · тап — подходы поштучно'}</div>
        </div>
        <div class="sg-checks">${g.items.map(si => `<button class="set-check grp${ex.sets[si].done ? ' done' : ''}" data-act="check" data-e="${ei}" data-s="${si}">${ex.sets[si].done ? '✓' : si + 1}</button>`).join('')}</div>
      </div>${editing ? setEditor(ex, ei, si0, ex.sets[si0]) : ''}`;
    }).join('');
    return `
  <div class="card ex-card${ex.parts ? ' in-ss' : ''}">
    <div class="ex-head" data-act="edit-ex" data-e="${ei}">
      <div class="ex-no${exDone ? ' ok' : ''}">${exDone ? '✓' : ei + 1}</div>
      <div class="ex-title">
        <div class="ex-name">${ex.parts ? `<span class="ss-tag">${ex.parts.length > 2 ? 'ТРОЙКА' : 'СУПЕРСЕТ'}</span> ` : ''}${esc(ex.name)}</div>
        <div class="ex-sub">${exScheme(ex)}${ex.parts ? ' · подряд без отдыха' : (max ? ` · % — от макс. цикла ${fmtW(max)} кг` : '')}${ex.rest ? ` · отдых ${restText(ex.rest)}` : ''}</div>
      </div>
      <span class="ex-cnt${exDone ? ' ok' : ''}">${exDn}/${ex.sets.length}</span>
      <span class="caret">›</span>
    </div>
    ${rows}
  </div>`;
  }).join('');

  if (!day.exercises.length)
    html += `<div class="card"><div class="muted">В этом дне нет упражнений — он не считается тренировкой и не тянет план вниз. Добавьте упражнение, чтобы вернуть день в зачёт.</div></div>`;
  html += complete
    ? `<div class="card finish-card">Тренировка завершена · ${fmtW(tonnage)} кг за сессию</div>`
    : '';
  html += `<button class="btn secondary" data-act="add-ex">+ Добавить упражнение</button>`;
  return html;
}

/* --- Календарь --- */
/* Буква типа тренировки: «Тренировка A» → A */
const dayLetter = title => ((title || '').trim().split(' ').pop() || 'Т').charAt(0).toUpperCase();

function renderCalendar() {
  const p = state.program;
  const byDate = {};
  const sessions = [];
  p.weeks.forEach((w, wi) => w.days.forEach((d, di) => {
    if (!dayPlanned(d)) return; /* пустой день — обычный день отдыха */
    byDate[d.date] = { day: d, wi, di };
    sessions.push({ day: d, wi, di });
  }));
  const today = iso(new Date());

  /* Сводка: весь план, эта неделя, пропуски */
  const totalCnt = sessions.length;
  const doneCnt = sessions.filter(s => dayDone(s.day)).length;
  const passedCnt = sessions.filter(s => s.day.date < today).length;
  const missCnt = sessions.filter(s => s.day.date < today && !dayDone(s.day)).length;
  const mon = mondayOfCurrentWeek();
  const sun = new Date(mon); sun.setDate(sun.getDate() + 6);
  const wkAll = sessions.filter(s => s.day.date >= iso(mon) && s.day.date <= iso(sun));
  const wkDone = wkAll.filter(s => dayDone(s.day)).length;

  /* Ближайшая невыполненная тренировка */
  const next = sessions.find(s => s.day.date >= today && !dayDone(s.day));
  let html = '';
  if (next) {
    const isToday = next.day.date === today;
    const nextL = dayLetter(next.day.title);
    const exLine = next.day.exercises
      .map(e => `${esc(e.name)} · ${fmtW(e.sets[0]?.w ?? 0)} кг`).join('<span class="sep"> — </span>');
    html += `
  <div class="card cal-hero">
    <div class="wo-top">
      <div>
        <div class="mini-label accent">${isToday ? 'Сегодня' : 'Ближайшая тренировка'}</div>
        <div class="h2" style="margin-top:3px">${esc(next.day.title)} <i class="cal-tag plan ${nextL === 'B' ? 'tb' : 'ta'}">${esc(nextL)}</i></div>
        <div class="muted" style="margin-top:2px">${fmtDate(next.day.date)} · Неделя ${next.wi + 1} из ${p.weeks.length}</div>
      </div>
      <button class="btn small" data-act="open-day" data-w="${next.wi}" data-d="${next.di}">${isToday ? 'Начать' : 'Открыть'}</button>
    </div>
    <div class="cal-hero-ex">${exLine}</div>
    <div class="wo-stats">
      <div class="wo-stat"><b>${wkDone}/${wkAll.length}</b><span>эта неделя</span></div>
      <div class="wo-stat"><b>${doneCnt}/${totalCnt}</b><span>весь план</span></div>
      <div class="wo-stat"><b>${missCnt}/${passedCnt}</b><span>пропущено</span></div>
    </div>
  </div>
  <div class="cal-legend">
    <span><i class="cal-tag plan ta">A</i> тренировка A</span>
    <span><i class="cal-tag plan tb">B</i> тренировка B</span>
    <span><i class="cal-tag done">✓A</i> выполнена</span>
    <span><i class="cal-tag miss">×A</i> пропущена</span>
  </div>`;
  }

  /* Липкая полоска: текущий месяц + стрелки быстрого перехода */
  html += `
  <div class="cal-nav" id="cal-nav">
    <button class="cal-nav-btn" data-act="cal-prev" aria-label="Предыдущий месяц">‹</button>
    <div class="cal-nav-title" id="cal-nav-title"></div>
    <button class="cal-nav-btn" data-act="cal-next" aria-label="Следующий месяц">›</button>
  </div>`;

  const start = fromIso(p.startDate);
  const last = fromIso(p.weeks.at(-1).days.at(-1).date);
  const cur = new Date(start.getFullYear(), start.getMonth(), 1);
  while (cur <= last) {
    const y = cur.getFullYear(), m = cur.getMonth();
    /* Титул месяца один — в липком пейджере сверху; в списке разделителей нет */
    html += `<div class="cal-month" data-title="${MONTHS_NOM[m]} ${y}"><div class="cal-grid">`;
    html += ['Пн','Вт','Ср','Чт','Пт','Сб','Вс'].map(d => `<div class="cal-dow">${d}</div>`).join('');
    const first = new Date(y, m, 1);
    const lead = (first.getDay() + 6) % 7;
    for (let i = 0; i < lead; i++) html += '<div></div>';
    const dim = new Date(y, m + 1, 0).getDate();
    for (let d = 1; d <= dim; d++) {
      const dateS = iso(new Date(y, m, d));
      const t = byDate[dateS];
      const todayCls = dateS === today ? ' today' : '';
      if (!t) {
        html += `<div class="cal-cell rest${todayCls}"><span class="cal-num">${d}</span></div>`;
        continue;
      }
      const L = dayLetter(t.day.title);
      const tCls = L === 'B' ? ' tb' : ' ta'; /* цвет плашки кодирует тип: A — оранжевый, B — голубой */
      let st = 'plan', tag = L;
      if (dayDone(t.day)) { st = 'done'; tag = '✓' + L; }
      else if (dateS < today) { st = 'miss'; tag = '×' + L; }
      html += `<div class="cal-cell ${st}${todayCls}" data-act="open-day" data-w="${t.wi}" data-d="${t.di}">
        <span class="cal-num">${d}</span><span class="cal-tag ${st}${st === 'plan' ? tCls : ''}">${esc(tag)}</span></div>`;
    }
    html += '</div></div>';
    cur.setMonth(cur.getMonth() + 1);
  }
  return html;
}

/* --- Прогресс --- */
function exerciseNames() {
  const set = new Set();
  state.program.weeks.forEach(w => w.days.forEach(d => d.exercises.forEach(e => set.add(e.name))));
  return [...set];
}

/* Русские окончания: plural(5,'подход','подхода','подходов') */
const plural = (n, one, few, many) => {
  const m10 = n % 10, m100 = n % 100;
  if (m10 === 1 && m100 !== 11) return one;
  if (m10 >= 2 && m10 <= 4 && (m100 < 12 || m100 > 14)) return few;
  return many;
};

function renderProgress() {
  const p = state.program;
  /* Все цифры считаются от одной базы — отмеченных подходов, поэтому не расходятся */
  let full = 0, started = 0, totalDays = 0, dnSets = 0, totalSets = 0, tonnage = 0;
  const pr = {}, prDate = {}, startW = {};
  const prR = {}, prRDate = {}, startR = {}, doneCntEx = {};
  p.weeks.forEach(w => w.days.forEach(d => {
    if (!dayPlanned(d)) return; /* пустые дни не считаются ни в числителе, ни в знаменателе */
    totalDays++;
    if (dayDone(d)) full++; else if (dayTouched(d)) started++;
    d.exercises.forEach(e => {
      if (startW[e.name] === undefined) startW[e.name] = e.sets[0]?.w ?? 0;
      if (startR[e.name] === undefined) startR[e.name] = e.sets[0]?.r ?? 0;
      e.sets.forEach(s => {
        totalSets++;
        if (s.done) {
          dnSets++; tonnage += setVol(s);
          /* === undefined, а не (pr||0): собственный вес (0 кг) — тоже рекорд */
          if (pr[e.name] === undefined || pr[e.name] < s.w) { pr[e.name] = s.w; prDate[e.name] = d.date; }
          /* для собственного веса рекорд меряется повторами */
          if (prR[e.name] === undefined || prR[e.name] < s.r) { prR[e.name] = s.r; prRDate[e.name] = d.date; }
          doneCntEx[e.name] = (doneCntEx[e.name] || 0) + 1;
        }
      });
    });
  }));
  const names = exerciseNames();
  const selName = state.ui.chartEx && names.includes(state.ui.chartEx) ? state.ui.chartEx : names[0];
  const selStart = startW[selName] ?? 0, selGoal = cycleMax(selName);
  /* Сколько сессий выбранного упражнения уже дали фактическую точку */
  let selFacts = 0;
  p.weeks.forEach(w => w.days.forEach(d => d.exercises.forEach(e => {
    if (e.name === selName && e.sets.some(s => s.done)) selFacts++;
  })));
  const compactChart = selFacts <= 1; /* 0–1 точка — график в компактном виде */

  /* Тоннаж по неделям: план и факт */
  const planTons = p.weeks.map(weekTonnage);
  const factTons = p.weeks.map(w => w.days.reduce((n, d) =>
    n + d.exercises.reduce((m, e) => m + e.sets.filter(s => s.done).reduce((k, s) => k + setVol(s), 0), 0), 0));
  const maxT = Math.max(1, ...planTons);
  const curW = findUpcoming(p).w;
  const tonBars = p.weeks.map((w, wi) => {
    const h = Math.max(8, Math.round(planTons[wi] / maxT * 100));
    const f = planTons[wi] && factTons[wi] > 0 ? Math.min(100, Math.max(7, Math.round(factTons[wi] / planTons[wi] * 100))) : 0;
    return `<div class="tonbar${wi === curW ? ' cur' : ''}" style="height:${h}%"><div class="tonbar-fact" style="height:${f}%"></div></div>`;
  }).join('');

  let html = `
  <div class="stat-row">
    <div class="stat">
      <div class="small">Полные тренировки</div>
      <div class="big">${full}<span class="big-dim">/${totalDays}</span></div>
      <div class="stat-sub">${started ? `${plural(started, 'начата', 'начаты', 'начато')} ${started} · ` : ''}в зачёт — только полные</div>
    </div>
    <div class="stat">
      <div class="small">Тоннаж, кг</div>
      <div class="big">${fmtW(tonnage)}</div>
      <div class="stat-sub">за ${dnSets} ${plural(dnSets, 'выполненный подход', 'выполненных подхода', 'выполненных подходов')}</div>
    </div>
  </div>
  <div class="card">
    <div class="label-row">
      <span class="h2">Динамика весов</span>
      <span class="chip">+${fmtW(selGoal - selStart)} кг за цикл</span>
    </div>
    <div class="field" style="margin:10px 0 4px"><select id="chart-ex">${names.map(n => `<option${n === selName ? ' selected' : ''}>${esc(n)}</option>`).join('')}</select></div>
    <canvas id="chart" width="760" height="${compactChart ? 220 : 440}"></canvas>
    ${compactChart ? `<div class="small" style="margin-top:6px">${selFacts === 1 ? 'Пока одна тренировка' : 'Пока нет тренировок'} — график вырастет с данными.</div>` : ''}
    <div class="chart-legend">
      <span><i class="lgl fact"></i>факт</span>
      <span><i class="lgl plan"></i>план</span>
      <span class="lg-cap">${fmtW(selStart)} → ${fmtW(selGoal)} кг</span>
    </div>
  </div>
  <div class="card">
    <div class="label-row">
      <span class="h2">Тоннаж по неделям</span>
      <span class="chip gray">факт ${fmtW(tonnage)} кг</span>
    </div>
    <div class="tonwrap">
      <div class="ton-ax"><span>${fmtW(maxT)}</span><span>0</span></div>
      <div class="tonbars">${tonBars}</div>
    </div>
    <div class="chart-legend"><span><i class="lgs fact"></i>факт</span><span><i class="lgs plan"></i>план</span><span class="lg-cap">недели Н1–Н${p.weeks.length} · кг</span></div>
  </div>
  <div class="card">
    <div class="label-row">
      <span class="h2">Рекорды</span>
      <span class="chip gray">${Object.keys(pr).length} из ${names.length} упражнений</span>
    </div>
    ${!Object.keys(pr).length ? '<div class="muted" style="margin-top:8px">Пока нет выполненных подходов — отметьте их на вкладке «Тренировка».</div>' : ''}
    ${names.map(n => {
      const has = pr[n] !== undefined;
      /* Собственный вес (подтягивания, отжимания): весь цикл идёт на 0 кг —
         рекорд «0 кг» ничего не значит, поэтому считаем в повторах и подходах. */
      const bw = cycleMax(n) === 0;
      const val = bw ? (prR[n] ?? 0) : pr[n];
      const s0 = bw ? (startR[n] ?? 0) : (startW[n] ?? 0);
      const g = bw ? cycleMaxR(n) : cycleMax(n);
      const unit = bw ? 'повт' : 'кг';
      const dt = bw ? prRDate[n] : prDate[n];
      const cnt = doneCntEx[n] || 0;
      const pct = has && g > s0 ? Math.max(2, Math.min(100, Math.round((val - s0) / (g - s0) * 100))) : 0;
      return `
      <div class="pr-row">
        <div class="pr-top">
          <div>
            <div class="pr-name">${esc(n)}</div>
            <div class="pr-sub">${has
              ? `рекорд · ${fmtDate(dt)}${bw ? ` · ${cnt} ${plural(cnt, 'подход', 'подхода', 'подходов')}` : ''}`
              : 'подходы ещё не отмечены'}</div>
          </div>
          ${has
            ? `<span class="pr-val">${fmtW(val)} <span class="u">${unit}</span>${val > s0 ? `<span class="pr-delta">+${fmtW(val - s0)}</span>` : ''}</span>`
            : '<span class="pr-none">—</span>'}
        </div>
        <div class="pr-bar"><div class="pr-fill" style="width:${pct}%"></div></div>
        <div class="pr-cap"><span>старт ${fmtW(s0)} ${unit}</span><span>цель ${fmtW(g)} ${unit}</span></div>
      </div>`;
    }).join('')}
  </div>`;
  return html;
}

/* Красивый круглый шаг оси: 1 / 2 / 2,5 / 5 / 10 × 10^k */
function niceStep(span) {
  const raw = Math.max(span, 1) / 4;
  const mag = Math.pow(10, Math.floor(Math.log10(raw)));
  for (const m of [1, 2, 2.5, 5, 10]) if (m * mag >= raw) return m * mag;
  return 10 * mag;
}

function drawChart() {
  const cv = $('#chart'); if (!cv) return;
  const name = $('#chart-ex')?.value;
  const pts = []; // на сессию: план (верхний вес) и факт (верхний отмеченный вес)
  state.program.weeks.forEach((w, wi) => w.days.forEach(d => d.exercises.forEach(e => {
    if (e.name === name && e.sets.length) {
      const dn = e.sets.filter(s => s.done);
      pts.push({ plan: Math.max(...e.sets.map(s => s.w)), fact: dn.length ? Math.max(...dn.map(s => s.w)) : null, wi, date: d.date });
    }
  })));
  const ctx = cv.getContext('2d');
  ctx.clearRect(0, 0, cv.width, cv.height);
  if (!pts.length) return;

  /* Окно: пока фактических точек 0–1 — весь цикл (метки Н1…Н12 разреженно);
     когда факта два и больше — от старта до последнего факта + ~2 недели плана. */
  const lastFact = pts.reduce((a, p, i) => (p.fact != null ? i : a), -1);
  const factCnt = pts.filter(p => p.fact != null).length;
  const view = factCnt > 1 ? pts.slice(0, Math.min(pts.length, Math.max(lastFact + 7, 8))) : pts;

  const compact = cv.height < 300; /* компактный вид: чуть мельче шрифты и отступы */
  const padL = compact ? 58 : 66, padR = 18, padT = compact ? 16 : 22, padB = compact ? 30 : 36;
  const W = cv.width - padL - padR, H = cv.height - padT - padB;
  const all = view.flatMap(p => p.fact != null ? [p.plan, p.fact] : [p.plan]);
  let step = niceStep(Math.max(...all) - Math.min(...all));
  if (step < 2.5) step = 2.5; /* веса шагают по 2,5 кг — ось не мельче */
  const lo = Math.floor(Math.min(...all) / step) * step;
  let hi = Math.ceil(Math.max(...all) / step) * step;
  if (hi === lo) hi = lo + step;
  const X = i => padL + (view.length === 1 ? W / 2 : i / (view.length - 1) * W);
  const Y = v => padT + H - (v - lo) / (hi - lo) * H;

  /* Сетка и круглые подписи оси Y */
  ctx.font = `700 ${compact ? 16 : 19}px Manrope, sans-serif`;
  ctx.textAlign = 'right'; ctx.textBaseline = 'middle';
  for (let v = lo; v <= hi + 1e-9; v += step) {
    ctx.strokeStyle = '#26262d'; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(padL, Y(v)); ctx.lineTo(padL + W, Y(v)); ctx.stroke();
    ctx.fillStyle = '#6a6a74';
    ctx.fillText(fmtW(v), padL - 12, Y(v));
  }

  /* Подписи недель по оси X */
  ctx.textAlign = 'center'; ctx.textBaseline = 'top';
  const wksInView = view.at(-1).wi - view[0].wi + 1;
  const wkStep = Math.max(1, Math.ceil(wksInView / 6));
  const seen = new Set();
  view.forEach((p, i) => {
    if (seen.has(p.wi)) return;
    seen.add(p.wi);
    if (p.wi % wkStep !== 0) return;
    ctx.fillStyle = '#6a6a74';
    ctx.fillText('Н' + (p.wi + 1), Math.min(Math.max(X(i), padL + 14), padL + W - 14), padT + H + 10);
  });

  /* Метка «сегодня» */
  const todayS = iso(new Date());
  const ti = view.findIndex(p => p.date >= todayS);
  if (ti > 0) {
    ctx.strokeStyle = 'rgba(244,244,246,.16)'; ctx.setLineDash([4, 6]); ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.moveTo(X(ti), padT); ctx.lineTo(X(ti), padT + H); ctx.stroke();
    ctx.setLineDash([]);
  }

  /* План — блёклый пунктир (фон), факт — крупно и ярко (главное) */
  ctx.strokeStyle = '#43434c'; ctx.lineWidth = 2; ctx.setLineDash([5, 7]);
  ctx.beginPath();
  view.forEach((p, i) => i ? ctx.lineTo(X(i), Y(p.plan)) : ctx.moveTo(X(i), Y(p.plan)));
  ctx.stroke(); ctx.setLineDash([]);

  /* Факт — сплошная линия с точками поверх плана */
  const fi = view.map((p, i) => p.fact != null ? i : -1).filter(i => i >= 0);
  if (fi.length > 1) {
    const grad = ctx.createLinearGradient(0, padT, 0, padT + H);
    grad.addColorStop(0, 'rgba(255,122,47,.22)'); grad.addColorStop(1, 'rgba(255,122,47,0)');
    ctx.fillStyle = grad; ctx.beginPath();
    fi.forEach((i, k) => k ? ctx.lineTo(X(i), Y(view[i].fact)) : ctx.moveTo(X(i), Y(view[i].fact)));
    ctx.lineTo(X(fi.at(-1)), padT + H); ctx.lineTo(X(fi[0]), padT + H); ctx.closePath(); ctx.fill();

    ctx.strokeStyle = '#ff7a2f'; ctx.lineWidth = 4; ctx.beginPath();
    fi.forEach((i, k) => k ? ctx.lineTo(X(i), Y(view[i].fact)) : ctx.moveTo(X(i), Y(view[i].fact)));
    ctx.stroke();
  }
  fi.forEach(i => {
    ctx.beginPath(); ctx.arc(X(i), Y(view[i].fact), 7, 0, Math.PI * 2);
    ctx.fillStyle = '#ff7a2f'; ctx.fill();
    ctx.lineWidth = 3; ctx.strokeStyle = '#1b1b20'; ctx.stroke();
  });
  if (fi.length) {
    const li = fi.at(-1);
    ctx.font = `800 ${compact ? 18 : 22}px Manrope, sans-serif`;
    ctx.fillStyle = '#ffa04d'; ctx.textAlign = 'center'; ctx.textBaseline = 'bottom';
    ctx.fillText(fmtW(view[li].fact), Math.min(Math.max(X(li), padL + 34), padL + W - 34), Y(view[li].fact) - 13);
  }
}

/* ---------- Таймер отдыха ----------
   Живёт в state.ui.rest и уходит в хранилище вместе с остальным состоянием:
   телефон перезагружает свёрнутую вкладку сам, и отдых должен вернуться, а не
   исчезнуть без следа. Отсчёт ведётся от абсолютного конца (end), поэтому после
   возврата на экране остаётся ровно столько, сколько реально осталось. */
let restInt = null;
function ensureRestInt() { if (!restInt) restInt = setInterval(tickRest, 250); }
function startRest(sec = 90) {
  state.ui.rest = { end: Date.now() + sec * 1000, total: sec * 1000 };
  ensureRestInt();
  tickRest();
}
/* save() здесь обязателен: «Пропустить» ничего больше не перерисовывает, а без
   записи снятый таймер воскресал бы при следующей перезагрузке. */
function stopRest() { state.ui.rest = null; tickRest(); save(); }
function tickRest() {
  const el = $('#rest-timer');
  if (!el) return;
  let rest = state.ui.rest;
  if (rest && Date.now() >= rest.end) { state.ui.rest = null; rest = null; save(); }
  if (!rest || state.ui.tab !== 'workout') {
    el.classList.add('hidden');
    document.body.classList.remove('rest-open');
    if (!rest && restInt) { clearInterval(restInt); restInt = null; }
    return;
  }
  ensureRestInt();   /* после перезагрузки тикать некому — заводим отсчёт заново */
  el.classList.remove('hidden');
  document.body.classList.add('rest-open'); /* нижний отступ контенту, чтобы таймер не перекрывал список */
  const ms = rest.end - Date.now();
  const s = Math.ceil(ms / 1000);
  $('#rest-count').textContent = `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
  $('#rest-fill').style.width = `${Math.min(100, (1 - ms / rest.total) * 100)}%`;
}

/* ---------- Шторка (bottom sheet) ---------- */
function openSheet(html) { $('#sheet').innerHTML = html; $('#sheet').classList.remove('hidden'); $('#sheet-backdrop').classList.remove('hidden'); }
function closeSheet() { $('#sheet').classList.add('hidden'); $('#sheet-backdrop').classList.add('hidden'); armTapShield(); }

/* Кнопки шторки («Сохранить», «Создать», «Добавить») лежат ровно поверх
   таб-бара. Первый тап закрывает шторку — и обычный повторный тап тем же
   пальцем попадает уже на вкладку под ней и уводит с экрана. Поэтому сразу
   после закрытия на 600 мс кладём прозрачный щит поверх всего: он глотает
   случайный второй тап, а через 600 мс интерфейс снова полностью живой. */
const TAP_SHIELD_MS = 600;
let shieldTimer = null;
function armTapShield(ms = TAP_SHIELD_MS) {
  let sh = $('#tap-shield');
  if (!sh) {
    sh = document.createElement('div');
    sh.id = 'tap-shield';
    ['pointerdown', 'pointerup', 'mousedown', 'mouseup', 'click', 'dblclick', 'touchstart', 'touchend']
      .forEach(type => sh.addEventListener(type, ev => { ev.preventDefault(); ev.stopPropagation(); }, { passive: false }));
    document.body.appendChild(sh);
  }
  sh.classList.remove('hidden');
  clearTimeout(shieldTimer);
  shieldTimer = setTimeout(() => sh.classList.add('hidden'), ms);
}
const tapShieldUp = () => { const sh = $('#tap-shield'); return !!sh && !sh.classList.contains('hidden'); };

function sheetEditExercise(ei) {
  const day = getDay(state.ui.sel); const ex = day?.exercises[ei];
  if (!ex) return render();   /* карточка исчезла (данные приехали из соседней вкладки) */
  openSheet(`
    <div class="sheet-title">Упражнение</div>
    <div class="field"><label>Название</label><input id="f-name" value="${esc(ex.name)}"></div>
    <div class="row">
      <div class="field"><label>Подходы</label><input id="f-sets" type="number" min="1" max="12" value="${ex.sets.length}"></div>
      <div class="field"><label>Повторы</label><input id="f-reps" type="number" min="1" max="${MAX_R}" value="${ex.sets[0]?.r ?? 5}"></div>
      ${ex.parts ? '' : `<div class="field"><label>Вес, кг</label><input id="f-w" type="number" step="2.5" min="0" max="${MAX_W}" value="${ex.sets[0]?.w ?? 20}"></div>`}
    </div>
    ${ex.parts ? `<div class="row">${ex.parts.map((part, pi) => `
      <div class="field"><label>${esc(part)}, кг</label><input id="f-w${pi}" type="number" step="2.5" min="0" max="${MAX_W}" value="${ex.sets[0]?.ws?.[pi] ?? 0}"></div>`).join('')}
    </div>` : ''}
    <div class="field check"><label><input id="f-future" type="checkbox" checked> <span>Применить и ко всем будущим «${esc(day.title)}»</span></label>
      <div class="field-hint">Меняется только то, что вы правите. Вес в будущих днях сдвигается на ту же разницу — прогрессия сохраняется. «Удалить» при включённой галке уберёт упражнение и из будущих таких дней.</div></div>
    <div class="row">
      <button class="btn secondary" data-act="del-ex" data-e="${ei}">Удалить</button>
      <button class="btn" data-act="save-ex" data-e="${ei}">Сохранить</button>
    </div>`);
}

function sheetAddExercise() {
  if (!getDay(state.ui.sel)) return render();
  openSheet(`
    <div class="sheet-title">Новое упражнение</div>
    <div class="field"><label>Название</label><input id="f-name" placeholder="Например: Подтягивания"></div>
    <div class="row">
      <div class="field"><label>Подходы</label><input id="f-sets" type="number" min="1" max="12" value="3"></div>
      <div class="field"><label>Повторы</label><input id="f-reps" type="number" min="1" max="${MAX_R}" value="10"></div>
      <div class="field"><label>Вес, кг</label><input id="f-w" type="number" step="2.5" min="0" max="${MAX_W}" value="20"></div>
    </div>
    <div class="field check"><label><input id="f-future" type="checkbox" checked> <span>Добавить и во все будущие «${esc(getDay(state.ui.sel).title)}»</span></label></div>
    <button class="btn" data-act="save-new-ex">Добавить</button>`);
}

function sheetRename() {
  openSheet(`
    <div class="sheet-title">Программа</div>
    <div class="field"><label>Название</label><input id="f-name" value="${esc(state.program.name)}"></div>
    <button class="btn" data-act="save-name">Сохранить</button>`);
}

function sheetNewProgram() {
  openSheet(`
    <div class="sheet-title">Новая программа</div>
    <div class="muted" style="margin-bottom:10px">Текущая программа будет заменена вместе с отметками.</div>
    <div class="field"><label>Программа</label>
      <select id="f-kind">
        <option value="dayA" selected>Дни A, B и C — суперсеты, 3 тренировки в неделю</option>
        <option value="base55">База 5×5 — линейный рост весов</option>
      </select>
    </div>
    <div class="field"><label>Название</label><input id="f-name" value="Дни A, B и C"></div>
    <div class="row">
      <div class="field"><label>Недель</label><input id="f-weeks" type="number" min="4" max="52" value="12"></div>
      <div class="field"><label>Дней в неделю</label>
        <select id="f-days"><option value="1">1</option><option value="2">2</option><option value="3">3</option><option value="4">4</option></select>
      </div>
    </div>
    <div class="small" style="margin:-4px 0 10px">«Дней в неделю» действует только для «Базы 5×5»: в «Днях A, B и C» три тренировки — понедельник, среда, пятница.</div>
    <button class="btn" data-act="create-program">Создать</button>`);
}

/* ---------- Прокрутка при смене вкладки ----------
   Новый экран всегда открывается сверху. Перенесённая прокрутка прячет шапку
   экрана (плитки, график, сводку) — человек видит середину списка и решает,
   что страница «уже уехала». */
function scrollTop() {
  window.scrollTo(0, 0);
  requestAnimationFrame(() => {
    window.scrollTo(0, 0);
    if (state.ui.tab === 'calendar') { calAuto = false; calIdx = 0; updateCalNavTitle(); }
  });
}
function goTab(tab) { state.ui.tab = tab; render(); scrollTop(); }

/* ---------- События ---------- */
document.addEventListener('click', e => {
  const t = e.target.closest('[data-act]');
  if (e.target.id === 'sheet-backdrop') return closeSheet();
  if (!t) return;
  const act = t.dataset.act;
  const sel = state.ui.sel || findUpcoming(state.program);
  const day = getDay(sel);
  const step = 2.5;

  if (act === 'toggle-week') { state.ui.openWeek = state.ui.openWeek === +t.dataset.w ? -1 : +t.dataset.w; render(); }
  else if (act === 'open-day') { state.ui.sel = { w: +t.dataset.w, d: +t.dataset.d }; state.ui.editSet = null; state.ui.openSets = null; goTab('workout'); }
  else if (act === 'check') {
    /* индекс мог устареть (данные приехали из соседней вкладки) — просто перерисуемся */
    const s = day?.exercises[+t.dataset.e]?.sets[+t.dataset.s];
    if (!s) return render();
    s.done = !s.done;
    if (s.done && !dayDone(day)) startRest(day.exercises[+t.dataset.e]?.rest || 90); else if (dayDone(day)) stopRest();
    render();
  }
  else if (act === 'toggle-sets') {
    const k = +t.dataset.e;
    state.ui.openSets = state.ui.openSets === k ? null : k;
    state.ui.editSet = null;
    render();
  }
  else if (act === 'wp+' || act === 'wp-') {
    const st = day?.exercises[+t.dataset.e]?.sets[+t.dataset.s];
    const pi = +t.dataset.p;
    if (!st || !st.ws || st.ws[pi] === undefined) return render();
    st.ws[pi] = Math.max(0, Math.min(MAX_W, st.ws[pi] + (act === 'wp+' ? step : -step)));
    st.w = st.ws[0];   /* первый вес — «главный»: по нему проценты и рекорды */
    render();
  }
  else if (act === 'edit-set') {
    const k = { e: +t.dataset.e, s: +t.dataset.s };
    const es = state.ui.editSet;
    state.ui.editSet = es && es.e === k.e && es.s === k.s ? null : k;
    render();
  }
  else if (act === 'finish-day') {
    if (!day) return render();
    day.exercises.forEach(ex => ex.sets.forEach(s => { s.done = true; }));
    state.ui.editSet = null; stopRest(); render();
  }
  else if (act === 'rest-add') { const r = state.ui.rest; if (r) { r.end += 30000; r.total += 30000; tickRest(); save(); } }
  else if (act === 'rest-skip') stopRest();
  else if (act === 'cal-prev') calGo(-1);
  else if (act === 'cal-next') calGo(1);
  else if (act === 'w+' || act === 'w-') { const s = day?.exercises[+t.dataset.e]?.sets[+t.dataset.s]; if (!s) return render(); s.w = Math.max(0, Math.min(MAX_W, s.w + (act === 'w+' ? step : -step))); render(); }
  else if (act === 'r+' || act === 'r-') { const s = day?.exercises[+t.dataset.e]?.sets[+t.dataset.s]; if (!s) return render(); s.r = Math.max(1, Math.min(MAX_R, s.r + (act === 'r+' ? 1 : -1))); render(); }
  else if (act === 'edit-ex') sheetEditExercise(+t.dataset.e);
  else if (act === 'add-ex') sheetAddExercise();
  else if (act === 'rename') sheetRename();
  else if (act === 'migrate') migrateProgram();
  else if (act === 'hide-switch') { state.ui.hideSwitch = true; render(); }
  else if (act === 'new-program') sheetNewProgram();
  else if (act === 'save-name') { state.program.name = $('#f-name').value.trim() || state.program.name; closeSheet(); render(); }
  else if (act === 'del-ex') { delExercise(+t.dataset.e); }
  else if (act === 'save-ex') applyExerciseEdit(+t.dataset.e);
  else if (act === 'save-new-ex') addExercise();
  else if (act === 'create-program') {
    const name = $('#f-name').value.trim() || 'Моя программа';
    /* clampNum, а не «+value || 12»: ноль — валидное число, его надо зажать в 4 */
    const weeks = clampNum($('#f-weeks').value, 4, 52, 12, true);
    const days = clampNum($('#f-days').value, 2, 4, 3, true);
    const kind = $('#f-kind') ? $('#f-kind').value : 'base55';
    /* даты и прогрессия считаются на весь срок, а не клонированием последней недели */
    const p = kind === 'dayA' ? programDayAB(weeks) : seedProgram(weeks, days);
    p.name = name;
    state.program = p;
    state.ui.sel = findUpcoming(p); state.ui.openWeek = 0; state.ui.editSet = null;
    closeSheet(); render(); scrollTop();
  }
});

document.addEventListener('change', e => { if (e.target.id === 'chart-ex') { state.ui.chartEx = e.target.value; render(); } });
/* Пока поднят щит после закрытия шторки, вкладки не переключаются: этот тап —
   «лишний» второй тап по кнопке шторки, а не осознанный уход с экрана. */
document.querySelectorAll('.tab').forEach(b => b.addEventListener('click', () => { if (tapShieldUp()) return; goTab(b.dataset.tab); }));
$('#sheet-backdrop').addEventListener('click', closeSheet);

function forEachFutureDay(fromSel, cb) {
  state.program.weeks.forEach((w, wi) => w.days.forEach((d, di) => {
    if (wi > fromSel.w || (wi === fromSel.w && di >= fromSel.d)) cb(d, wi, di);
  }));
}

function forEachFutureSameTitle(fromSel, cb) {
  const fromDay = getDay(fromSel);
  forEachFutureDay(fromSel, (d, wi, di) => { if (d.title === fromDay.title) cb(d, wi, di); });
}

/* Меняем в упражнении ровно то, что владелец правил в форме.
   На сегодняшнем дне вес ставится как есть, в будущих — сдвигается на дельту,
   чтобы линейная прогрессия не превращалась в плоскую линию. */
function applyExChange(ex, o) {
  if (o.chName) ex.name = o.name;
  if (!o.chSets && !o.chReps && !o.chW && !o.chWs) return;
  const base = ex.sets;
  const len = o.chSets ? o.sets : base.length;
  ex.sets = Array.from({ length: len }, (_, i) => {
    const src = base[i] || base[base.length - 1] || { w: 0, r: o.reps, done: false };
    let w = src.w;
    if (o.chW) w = o.absolute ? o.w : Math.max(0, Math.min(MAX_W, src.w + o.dW));
    /* Диапазон повторов и работу на время правка не съедает: если человек не менял
       повторы, поля rmax/unit остаются как были; если менял — новое число становится
       нижней границей, верхняя сохраняется, пока она выше. */
    const r = o.chReps ? o.reps : src.r;
    const out = { w, r, done: base[i] ? base[i].done : false };
    if (src.unit) out.unit = src.unit;
    if (src.rmax && src.rmax > r) out.rmax = src.rmax;
    if (src.ws) {
      out.ws = src.ws.map((sw, pi) => {
        if (!o.chWs || !o.ws) return sw;
        return o.absolute ? o.ws[pi] : Math.max(0, Math.min(MAX_W, sw + (o.dWs[pi] || 0)));
      });
      out.w = out.ws[0];   /* первый вес — «главный», по нему считаются рекорды и проценты */
    }
    return out;
  });
}

/* Удаление упражнения. Галка «ко всем будущим» распространяется и на «Удалить»:
   пользователь, оставивший её включённой, ждёт чистки всей программы, а не одного дня.
   Совпадение в будущем дне ищем так же, как при сохранении (индекс → тот же по счёту → первое имя).
   editSet сбрасывается: иначе «прилипший» индекс раскрывает редактор у чужого упражнения. */
function delExercise(ei) {
  const sel = state.ui.sel || findUpcoming(state.program);
  const day = getDay(sel);
  const ex = day && day.exercises[ei];
  if (!ex) { state.ui.editSet = null; closeSheet(); render(); return; }
  const name = ex.name;
  const future = $('#f-future')?.checked;

  if (future) {
    const ord = day.exercises.slice(0, ei).filter(x => x.name === name).length;
    forEachFutureSameTitle(sel, (d, wi, di) => {
      if (wi === sel.w && di === sel.d) return;
      const byIdx = d.exercises[ei];
      const same = d.exercises.filter(x => x.name === name);
      const victim = byIdx && byIdx.name === name ? byIdx : (same[ord] || same[0]);
      const k = victim ? d.exercises.indexOf(victim) : -1;
      if (k >= 0) d.exercises.splice(k, 1);
    });
  }

  day.exercises.splice(ei, 1);
  state.ui.editSet = null;
  closeSheet(); render();
}

function applyExerciseEdit(ei) {
  const sel = state.ui.sel; const day = getDay(sel);
  const target = day.exercises[ei];         /* по индексу карточки, а не по имени */
  if (!target) { closeSheet(); render(); return; }
  const oldName = target.name;
  const oldSets = target.sets.length;
  const oldReps = target.sets[0]?.r ?? 5;
  const oldW = target.sets[0]?.w ?? 0;

  const name = $('#f-name').value.trim() || oldName;
  const sets = clampNum($('#f-sets').value, 1, 12, oldSets, true);
  const reps = clampNum($('#f-reps').value, 1, MAX_R, oldReps, true);
  const wEl = $('#f-w');   /* у суперсета/тройки его нет: там поля по частям */
  const w = wEl ? clampNum(wEl.value, 0, MAX_W, oldW) : oldW;
  /* У суперсета/тройки вес свой на каждую часть: читаем столько полей, сколько частей */
  const oldWs = target.sets[0]?.ws;
  let ws = null, dWs = null, chWs = false;
  if (oldWs) {
    ws = oldWs.map((ow, pi) => {
      const el = $('#f-w' + pi);
      return el ? clampNum(el.value, 0, MAX_W, ow) : ow;
    });
    dWs = ws.map((nw, pi) => nw - oldWs[pi]);
    chWs = dWs.some(d => d !== 0);
  }
  const o = {
    name, sets, reps, w, dW: w - oldW,
    ws, dWs, chWs,
    chName: name !== oldName, chSets: sets !== oldSets, chReps: reps !== oldReps, chW: !!wEl && w !== oldW,
  };

  applyExChange(target, { ...o, absolute: true });

  if ($('#f-future').checked) {
    /* Только дни той же буквы — как у парного сценария добавления упражнения.
       Внутри дня: тот же индекс, если по нему стоит одноимённое упражнение;
       иначе то же по счёту одноимённое; иначе первое совпадение имени. */
    const ord = day.exercises.slice(0, ei).filter(x => x.name === oldName).length;
    forEachFutureSameTitle(sel, (d, wi, di) => {
      if (wi === sel.w && di === sel.d) return;
      const byIdx = d.exercises[ei];
      const same = d.exercises.filter(x => x.name === oldName);
      const ex = byIdx && byIdx.name === oldName ? byIdx : (same[ord] || same[0]);
      if (ex) applyExChange(ex, { ...o, absolute: false });
    });
  }
  closeSheet(); render();
}

/* Ошибка прямо в поле: мёртвых кнопок без объяснения быть не должно */
function fieldError(input, msg) {
  input.classList.add('bad');
  const f = input.closest('.field'); if (!f) return;
  let e = f.querySelector('.field-err');
  if (!e) { e = document.createElement('div'); e.className = 'field-err'; f.appendChild(e); }
  e.textContent = msg;
  input.focus();
  input.addEventListener('input', () => { input.classList.remove('bad'); e.remove(); }, { once: true });
}

function addExercise() {
  const sel = state.ui.sel;
  const day = getDay(sel);
  if (!day) { closeSheet(); render(); return; }
  const input = $('#f-name');
  const name = input.value.trim();
  if (!name) { fieldError(input, 'Введите название упражнения'); return; }
  const sets = clampNum($('#f-sets').value, 1, 12, 3, true);
  const reps = clampNum($('#f-reps').value, 1, MAX_R, 10, true);
  const w = clampNum($('#f-w').value, 0, MAX_W, 0);
  const mk = () => ({ name, sets: Array.from({ length: sets }, () => ({ w, r: reps, done: false })) });
  if ($('#f-future').checked) forEachFutureSameTitle(sel, d => d.exercises.push(mk()));
  else day.exercises.push(mk());
  closeSheet(); render();
}

function esc(s) { return String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])); }

render();
