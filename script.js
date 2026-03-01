/**
 * ═══════════════════════════════════════════════════
 * SELF GROWTH — Executive Habit Tracker PWA
 * script.js
 * ═══════════════════════════════════════════════════
 */

'use strict';

/* ─── CONFIG ─── */

const EMOJIS = [
  '🧘','🏃','💪','📚','✍️','🎯','💧','🍎','🌿','🧠',
  '🎨','🎸','🎵','🌙','☀️','⚡','🔥','🌊','🧗','🚴',
  '🏋️','🤸','📝','🧪','🌱','🍵','🛁','💤','⭐','🎓',
  '💎','🎭','🔬','🏆','🗂️','✨','🦋','🌺','🎬','🥗',
  '🧬','🏊','🤾','🎾','⛹️','🚶','🏄','🎻','🪐','🌍',
];

// Accent colors for habits (muted, professional)
const ACCENT_COLORS = [
  '#C6A75E', // gold
  '#6B9FD4', // steel blue
  '#7DC87A', // sage green
  '#C47E7E', // muted rose
  '#9B8EC4', // lavender
  '#6BBCB6', // teal
  '#C49B6B', // copper
  '#7AA3C8', // sky
  '#B0C87A', // lime sage
  '#C47EAB', // mauve
];

const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
const MONTHS_FULL = ['January','February','March','April','May','June',
  'July','August','September','October','November','December'];
const DAYS_SHORT = ['SUN','MON','TUE','WED','THU','FRI','SAT'];

const SK_HABITS = 'sg_habits_v3';
const SK_LOGS   = 'sg_logs_v3';

/* ─── STATE ─── */
const state = {
  habits: [],         // { id, name, emoji, type, goal, color, createdAt }
  logs: {},           // { habitId: { 'YYYY-MM-DD': count } }  count >= goal = complete
  activeTab: 'habits',
  sortMode: 'manual',
  selectedEmoji: EMOJIS[0],
  selectedColor: ACCENT_COLORS[0],
  selectedType: 'build',
  detailHabitId: null,
  detailCalMonth: new Date().getMonth(),
  detailCalYear: new Date().getFullYear(),
};

/* ─── PERSISTENCE ─── */
function persist() {
  try {
    localStorage.setItem(SK_HABITS, JSON.stringify(state.habits));
    localStorage.setItem(SK_LOGS,   JSON.stringify(state.logs));
  } catch(e) { console.warn('Storage error', e); }
}

function hydrate() {
  try {
    state.habits = JSON.parse(localStorage.getItem(SK_HABITS)) || [];
    state.logs   = JSON.parse(localStorage.getItem(SK_LOGS))   || {};
  } catch(e) { state.habits = []; state.logs = {}; }
}

/* ─── DATE UTILS ─── */
function toDateStr(d = new Date()) {
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}

function todayStr() { return toDateStr(); }

function startOfYear(year) {
  return new Date(year, 0, 1);
}

/** Get all date strings for the past N days including today */
function pastNDays(n) {
  const arr = [];
  for (let i = n-1; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    arr.push(toDateStr(d));
  }
  return arr;
}

function currentWeekDates() {
  const today = new Date();
  const day = today.getDay();
  return Array.from({length: 7}, (_, i) => {
    const d = new Date(today);
    d.setDate(today.getDate() - day + i);
    return toDateStr(d);
  });
}

function formatHeaderDate() {
  const now = new Date();
  const wd = ['SUNDAY','MONDAY','TUESDAY','WEDNESDAY','THURSDAY','FRIDAY','SATURDAY'][now.getDay()];
  const day = String(now.getDate()).padStart(2,'0');
  const mo  = MONTHS_FULL[now.getMonth()].toUpperCase();
  return `${wd} · ${day} ${mo} ${now.getFullYear()}`;
}

/* ─── LOG HELPERS ─── */
function getCount(habitId, ds) {
  return (state.logs[habitId]?.[ds]) || 0;
}

function setCount(habitId, ds, val) {
  if (!state.logs[habitId]) state.logs[habitId] = {};
  state.logs[habitId][ds] = Math.max(0, val);
  persist();
}

function isComplete(habitId, ds) {
  const h = state.habits.find(x => x.id === habitId);
  if (!h) return false;
  return getCount(habitId, ds) >= h.goal;
}

function toggleComplete(habitId, ds) {
  const h = state.habits.find(x => x.id === habitId);
  if (!h) return;
  const done = isComplete(habitId, ds);
  setCount(habitId, ds, done ? 0 : h.goal);
}

function incrementCount(habitId, ds, delta) {
  const h = state.habits.find(x => x.id === habitId);
  if (!h) return;
  const cur = getCount(habitId, ds);
  setCount(habitId, ds, Math.min(cur + delta, h.goal * 10)); // cap at 10x goal
}

/* ─── DOMAIN STATS ─── */

/** Streak: consecutive completed days ending today (or yesterday if today not done) */
function calcStreak(habitId) {
  let streak = 0;
  const today = new Date();
  let check = new Date(today);
  if (!isComplete(habitId, toDateStr(check))) {
    check.setDate(check.getDate() - 1);
  }
  for (let i = 0; i < 3650; i++) {
    if (isComplete(habitId, toDateStr(check))) {
      streak++;
      check.setDate(check.getDate() - 1);
    } else break;
  }
  return streak;
}

/** Longest streak ever */
function calcLongestStreak(habitId) {
  const h = state.habits.find(x => x.id === habitId);
  if (!h) return 0;
  const created = new Date(h.createdAt);
  const today   = new Date();
  let best = 0, run = 0;
  for (let d = new Date(created); d <= today; d.setDate(d.getDate()+1)) {
    if (isComplete(habitId, toDateStr(new Date(d)))) { run++; best = Math.max(best, run); }
    else run = 0;
  }
  return best;
}

/** Days missed this week */
function missedThisWeek(habitId) {
  const today = todayStr();
  return currentWeekDates()
    .filter(ds => ds <= today && !isComplete(habitId, ds))
    .length;
}

/** Discipline score: total completions / total possible (since creation) * 100 */
function disciplineScore(habitId) {
  const h = state.habits.find(x => x.id === habitId);
  if (!h) return 0;
  const created = new Date(h.createdAt);
  const today   = new Date();
  let total = 0, done = 0;
  for (let d = new Date(created); d <= today; d.setDate(d.getDate()+1)) {
    total++;
    if (isComplete(habitId, toDateStr(new Date(d)))) done++;
  }
  return total === 0 ? 0 : Math.round((done / total) * 100);
}

/** % habits completed today */
function todayCompletionPct() {
  if (!state.habits.length) return 0;
  const ds = todayStr();
  const done = state.habits.filter(h => isComplete(h.id, ds)).length;
  return Math.round((done / state.habits.length) * 100);
}

/** Global discipline score across all habits */
function globalDisciplineScore() {
  if (!state.habits.length) return 0;
  return Math.round(state.habits.reduce((acc, h) => acc + disciplineScore(h.id), 0) / state.habits.length);
}

/** Total completed habit-days / total possible habit-days */
function globalCompletionPct() {
  if (!state.habits.length) return 0;
  const today = new Date();
  let total = 0, done = 0;
  state.habits.forEach(h => {
    const created = new Date(h.createdAt);
    for (let d = new Date(created); d <= today; d.setDate(d.getDate()+1)) {
      total++;
      if (isComplete(h.id, toDateStr(new Date(d)))) done++;
    }
  });
  return total === 0 ? 0 : Math.round((done / total) * 100);
}

/** Longest streak across all habits */
function globalLongestStreak() {
  if (!state.habits.length) return 0;
  return Math.max(...state.habits.map(h => calcLongestStreak(h.id)));
}

/** Total missed this week across all habits */
function globalMissedThisWeek() {
  return state.habits.reduce((acc, h) => acc + missedThisWeek(h.id), 0);
}

/* ─── SORT ─── */
function getSortedHabits() {
  const arr = [...state.habits];
  switch (state.sortMode) {
    case 'name':       return arr.sort((a,b) => a.name.localeCompare(b.name));
    case 'streak':     return arr.sort((a,b) => calcStreak(b.id) - calcStreak(a.id));
    case 'completion': return arr.sort((a,b) => disciplineScore(b.id) - disciplineScore(a.id));
    case 'created':    return arr.sort((a,b) => a.createdAt - b.createdAt);
    default:           return arr;
  }
}

/* ─── RENDER ORCHESTRATOR ─── */
function render() {
  renderHeader();
  if (state.activeTab === 'habits')  renderHabitsTab();
  if (state.activeTab === 'stats')   renderStatsTab();
  if (state.activeTab === 'grids')   renderGridsTab();
}

/* ─── HEADER ─── */
function renderHeader() {
  const el = document.getElementById('headerDate');
  if (el) el.textContent = formatHeaderDate();
}

/* ─── HABITS TAB ─── */
function renderHabitsTab() {
  renderHeroSub();
  renderWeekStrip();
  renderHabitList();
}

function renderHeroSub() {
  const el = document.getElementById('heroSub');
  if (!el) return;
  const n = state.habits.length;
  if (n === 0) { el.textContent = 'No disciplines configured.'; return; }
  const done = state.habits.filter(h => isComplete(h.id, todayStr())).length;
  el.textContent = `${done} of ${n} completed today · ${todayCompletionPct()}%`;
}

function renderWeekStrip() {
  const el = document.getElementById('weekStrip');
  if (!el) return;
  const weekDates = currentWeekDates();
  const todayDs   = todayStr();
  const total     = state.habits.length;

  el.innerHTML = weekDates.map((ds, i) => {
    const isToday = ds === todayDs;
    const isPast  = ds <= todayDs;
    const done    = total === 0 ? 0 : state.habits.filter(h => isComplete(h.id, ds)).length;
    const isFull  = total > 0 && done === total && isPast;
    const isPartial = !isFull && done > 0 && isPast;
    const dayLbl  = DAYS_SHORT[i].slice(0,2);
    const numLbl  = new Date(ds + 'T00:00:00').getDate();

    return `
      <div class="week-cell">
        <span class="week-cell__day">${dayLbl}</span>
        <div class="week-cell__dot${isToday ? ' is-today' : ''}${isFull ? ' is-full' : ''}${isPartial ? ' is-partial' : ''}">
          ${numLbl}
        </div>
      </div>
    `;
  }).join('');
}

function renderHabitList() {
  const listEl  = document.getElementById('habitList');
  const emptyEl = document.getElementById('emptyState');
  if (!listEl || !emptyEl) return;

  if (state.habits.length === 0) {
    listEl.innerHTML = '';
    emptyEl.style.display = 'flex';
    return;
  }
  emptyEl.style.display = 'none';

  const ds = todayStr();
  listEl.innerHTML = getSortedHabits().map((h, idx) => {
    const done    = isComplete(h.id, ds);
    const count   = getCount(h.id, ds);
    const streak  = calcStreak(h.id);
    const pct     = Math.round(Math.min(1, count / h.goal) * 100);
    const accent  = h.color || ACCENT_COLORS[0];

    return `
      <div class="habit-card${done ? ' is-complete' : ''}"
           style="animation-delay:${idx * 25}ms"
           data-id="${h.id}">
        <div class="habit-card__strip" style="${done ? `background:${accent}` : ''}"></div>
        <div class="habit-card__row">
          <!-- Complete toggle -->
          <button class="habit-toggle" data-action="toggle" data-id="${h.id}" aria-label="Toggle complete">
            <svg class="habit-toggle__check" width="10" height="8" viewBox="0 0 10 8" fill="none">
              <path d="M1 4l3 3 5-6" stroke="#0D0D0F" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/>
            </svg>
          </button>

          <!-- Emoji -->
          <span class="habit-emoji">${h.emoji}</span>

          <!-- Info -->
          <div class="habit-info" data-action="detail" data-id="${h.id}">
            <div class="habit-name">${esc(h.name)}</div>
            <div class="habit-tags">
              <span class="habit-tag">${h.type.toUpperCase()}</span>
              ${streak > 0 ? `<span class="habit-streak" style="color:${accent}">↑ ${streak}d</span>` : ''}
            </div>
          </div>

          <!-- Count control -->
          <div class="habit-count">
            <button class="count-btn" data-action="decrement" data-id="${h.id}">−</button>
            <span class="count-val" style="${done ? `color:${accent}` : ''}">${count}/${h.goal}</span>
            <button class="count-btn" data-action="increment" data-id="${h.id}">+</button>
          </div>
        </div>

        <!-- Progress bar -->
        <div class="habit-card__progress">
          <div class="progress-track">
            <div class="progress-fill" style="width:${pct}%;${done ? `background:${accent}` : ''}"></div>
          </div>
          <span class="progress-label">${pct}% today</span>
        </div>
      </div>
    `;
  }).join('');
}

/* ─── STATS TAB ─── */
function renderStatsTab() {
  const score = globalDisciplineScore();

  // Score card
  const scoreEl = document.getElementById('disciplineScore');
  const barEl   = document.getElementById('disciplineBar');
  const subEl   = document.getElementById('disciplineScoreSub');
  if (scoreEl) scoreEl.textContent = score + '%';
  if (barEl)   barEl.style.width   = score + '%';
  if (subEl) {
    const total = state.habits.length;
    const done  = state.habits.filter(h => isComplete(h.id, todayStr())).length;
    subEl.textContent = `${done}/${total} habits completed today · Global completion ${globalCompletionPct()}%`;
  }

  // Stats grid
  const grid = document.getElementById('statsGrid2');
  if (grid) {
    grid.innerHTML = `
      <div class="stat-box stat-box--accent">
        <div class="stat-box__val">${Math.max(...[0, ...state.habits.map(h => calcStreak(h.id))])}</div>
        <div class="stat-box__lbl">Current Streak</div>
      </div>
      <div class="stat-box">
        <div class="stat-box__val">${globalLongestStreak()}</div>
        <div class="stat-box__lbl">Longest Streak Ever</div>
      </div>
      <div class="stat-box">
        <div class="stat-box__val">${globalMissedThisWeek()}</div>
        <div class="stat-box__lbl">Missed This Week</div>
      </div>
      <div class="stat-box">
        <div class="stat-box__val">${todayCompletionPct()}%</div>
        <div class="stat-box__lbl">Habits Done Today</div>
      </div>
      <div class="stat-box">
        <div class="stat-box__val">${globalCompletionPct()}%</div>
        <div class="stat-box__lbl">All-Time Completion</div>
      </div>
      <div class="stat-box">
        <div class="stat-box__val">${state.habits.length}</div>
        <div class="stat-box__lbl">Total Disciplines</div>
      </div>
    `;
  }

  // Habit breakdown
  const bkEl = document.getElementById('habitBreakdown');
  if (bkEl) {
    if (state.habits.length === 0) {
      bkEl.innerHTML = '<p style="color:var(--text-3);font-size:13px;padding:20px 0">No habits yet.</p>';
      return;
    }
    bkEl.innerHTML = getSortedHabits().map(h => {
      const streak  = calcStreak(h.id);
      const longest = calcLongestStreak(h.id);
      const missed  = missedThisWeek(h.id);
      const score   = disciplineScore(h.id);
      const accent  = h.color || ACCENT_COLORS[0];

      return `
        <div class="breakdown-row" data-action="detail" data-id="${h.id}">
          <div class="breakdown-row__top">
            <span class="breakdown-row__emoji">${h.emoji}</span>
            <span class="breakdown-row__name">${esc(h.name)}</span>
            <span class="breakdown-row__score" style="color:${accent}">${score}%</span>
          </div>
          <div class="breakdown-row__stats">
            <div>
              <div class="breakdown-stat__val">${streak}</div>
              <div class="breakdown-stat__lbl">Streak</div>
            </div>
            <div>
              <div class="breakdown-stat__val">${longest}</div>
              <div class="breakdown-stat__lbl">Best</div>
            </div>
            <div>
              <div class="breakdown-stat__val">${missed}</div>
              <div class="breakdown-stat__lbl">Missed wk</div>
            </div>
          </div>
          <div class="breakdown-row__bar">
            <div class="breakdown-row__fill" style="width:${score}%;background:${accent}"></div>
          </div>
        </div>
      `;
    }).join('');
  }
}

/* ─── GRIDS TAB ─── */
function renderGridsTab() {
  const container = document.getElementById('gridsContainer');
  const emptyEl   = document.getElementById('gridsEmpty');
  if (!container || !emptyEl) return;

  if (state.habits.length === 0) {
    container.innerHTML = '';
    emptyEl.style.display = 'flex';
    return;
  }
  emptyEl.style.display = 'none';

  container.innerHTML = state.habits.map(h => buildYearGrid(h)).join('');
}

function buildYearGrid(habit) {
  const accent  = habit.color || ACCENT_COLORS[0];
  const today   = new Date();
  const todayDs = toDateStr(today);
  const year    = today.getFullYear();

  // Build 365-day cell data (current year)
  const jan1    = new Date(year, 0, 1);
  const jan1Day = jan1.getDay(); // 0=Sun: number of empty cells before Jan 1

  // Build array: [empty cells...] + [day cells...]
  const cells = [];

  // Empty before Jan 1
  for (let i = 0; i < jan1Day; i++) {
    cells.push({ empty: true });
  }

  // All days of the year up to today
  const daysInYear = ((year % 4 === 0 && year % 100 !== 0) || year % 400 === 0) ? 366 : 365;
  for (let d = 0; d < daysInYear; d++) {
    const date = new Date(year, 0, d + 1);
    const ds   = toDateStr(date);
    const isFuture = ds > todayDs;
    const count = getCount(habit.id, ds);
    const done  = isComplete(habit.id, ds);

    let level = 0;
    if (!isFuture) {
      if (done) level = 3;
      else if (count > 0) level = 1;
    }

    cells.push({
      ds,
      level,
      isFuture,
      isToday: ds === todayDs,
      date,
    });
  }

  // Month label positions (week index where month starts)
  const monthLabels = buildMonthLabels(year, jan1Day);

  // Stat summary
  const streak  = calcStreak(habit.id);
  const score   = disciplineScore(habit.id);

  // Build cell HTML
  const cellsHtml = cells.map(c => {
    if (c.empty) return `<div class="grid-cell" data-level="0" style="background:transparent"></div>`;
    if (c.isFuture) return `<div class="grid-cell" data-level="0"></div>`;
    return `<div class="grid-cell${c.isToday ? ' grid-cell--today' : ''}"
               data-level="${c.level}"
               style="${c.level > 0 ? `background:${accent}` : ''}"
               title="${c.ds}${c.level > 0 ? ' ✓' : ''}"></div>`;
  }).join('');

  // Legend cells
  const legendHtml = [0,1,2,3].map(l => `
    <div class="grid-legend__cell" style="${l === 0 ? 'background:var(--surface-2)' : `background:${accent};opacity:${l === 1 ? 0.35 : l === 2 ? 0.65 : 1}`}"></div>
  `).join('');

  return `
    <div class="habit-grid-card">
      <div class="habit-grid-card__header">
        <span class="habit-grid-card__emoji">${habit.emoji}</span>
        <div class="habit-grid-card__info">
          <div class="habit-grid-card__name">${esc(habit.name)}</div>
          <div class="habit-grid-card__sub">${score}% discipline score · ${year}</div>
        </div>
        <span class="habit-grid-card__streak" style="color:${accent}">${streak}d ↑</span>
      </div>

      <div class="year-grid-wrap">
        <div class="year-grid">${cellsHtml}</div>
      </div>

      <div class="grid-legend">
        <span class="grid-legend__label">Less</span>
        <div class="grid-legend__cells">${legendHtml}</div>
        <span class="grid-legend__label">More</span>
      </div>
    </div>
  `;
}

function buildMonthLabels(year, startOffset) {
  // Returns array of {month, weekIndex}
  const labels = [];
  for (let m = 0; m < 12; m++) {
    const firstOfMonth = new Date(year, m, 1);
    const dayOfYear    = Math.floor((firstOfMonth - new Date(year, 0, 0)) / 86400000);
    const weekIndex    = Math.floor((dayOfYear - 1 + startOffset) / 7);
    labels.push({ label: MONTHS[m], weekIndex });
  }
  return labels;
}

/* ─── DETAIL MODAL ─── */
function openDetailModal(habitId) {
  const h = state.habits.find(x => x.id === habitId);
  if (!h) return;
  state.detailHabitId = habitId;
  state.detailCalMonth = new Date().getMonth();
  state.detailCalYear  = new Date().getFullYear();

  const accent   = h.color || ACCENT_COLORS[0];
  const streak   = calcStreak(h.id);
  const longest  = calcLongestStreak(h.id);
  const missed   = missedThisWeek(h.id);
  const score    = disciplineScore(h.id);
  const compPct  = globalCompletionPct(); // per-habit all-time completion
  // Actually per-habit:
  const habCompletion = score; // same formula

  const titleEl = document.getElementById('detailTitle');
  const bodyEl  = document.getElementById('detailBody');
  if (titleEl) titleEl.textContent = h.name.toUpperCase();

  if (bodyEl) {
    bodyEl.innerHTML = `
      <div class="detail-hero">
        <span class="detail-hero__emoji">${h.emoji}</span>
        <div>
          <div class="detail-hero__name">${esc(h.name)}</div>
          <div class="detail-hero__type">${h.type} · goal ${h.goal}×/day</div>
        </div>
      </div>

      <div class="detail-stats">
        <div class="detail-stat">
          <div class="detail-stat__val" style="color:${accent}">${streak}</div>
          <div class="detail-stat__lbl">Current Streak</div>
        </div>
        <div class="detail-stat">
          <div class="detail-stat__val">${longest}</div>
          <div class="detail-stat__lbl">Longest Ever</div>
        </div>
        <div class="detail-stat">
          <div class="detail-stat__val">${missed}</div>
          <div class="detail-stat__lbl">Missed Wk</div>
        </div>
        <div class="detail-stat">
          <div class="detail-stat__val" style="color:${accent}">${score}%</div>
          <div class="detail-stat__lbl">Disc. Score</div>
        </div>
        <div class="detail-stat">
          <div class="detail-stat__val">${habCompletion}%</div>
          <div class="detail-stat__lbl">Completion</div>
        </div>
        <div class="detail-stat">
          <div class="detail-stat__val">${calcTotalDone(h.id)}</div>
          <div class="detail-stat__lbl">Total Done</div>
        </div>
      </div>

      <div id="detailCalContainer"></div>

      <button class="detail-delete" data-action="delete" data-id="${h.id}">REMOVE DISCIPLINE</button>
    `;

    renderDetailCal();
  }

  openModal('detailModal');
}

function calcTotalDone(habitId) {
  const logs = state.logs[habitId] || {};
  return Object.keys(logs).filter(ds => isComplete(habitId, ds)).length;
}

function renderDetailCal() {
  const h = state.habits.find(x => x.id === state.detailHabitId);
  if (!h) return;
  const container = document.getElementById('detailCalContainer');
  if (!container) return;

  const accent = h.color || ACCENT_COLORS[0];
  const month  = state.detailCalMonth;
  const year   = state.detailCalYear;
  const todayDs = todayStr();
  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const monthName = `${MONTHS_FULL[month].toUpperCase()} ${year}`;

  let cellsHtml = '';
  for (let i = 0; i < firstDay; i++) cellsHtml += `<div class="mini-cal__cell mini-cal__cell--empty"></div>`;
  for (let d = 1; d <= daysInMonth; d++) {
    const ds = `${year}-${String(month+1).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
    const isFuture = ds > todayDs;
    const done     = isComplete(h.id, ds);
    const isToday  = ds === todayDs;
    let cls = 'mini-cal__cell';
    if (isFuture) cls += ' mini-cal__cell--future';
    else if (done) cls += ' mini-cal__cell--done';
    if (isToday) cls += ' mini-cal__cell--today';
    const style = done && !isFuture ? `style="background:${accent}"` : '';
    cellsHtml += `<div class="${cls}" ${style}>${d}</div>`;
  }

  container.innerHTML = `
    <div class="mini-cal">
      <div class="mini-cal__nav">
        <span class="mini-cal__title">${monthName}</span>
        <div style="display:flex;gap:4px">
          <button class="mini-cal__arrow" id="calPrevBtn">‹</button>
          <button class="mini-cal__arrow" id="calNextBtn">›</button>
        </div>
      </div>
      <div class="mini-cal__weekdays">
        ${['S','M','T','W','T','F','S'].map(d => `<div class="mini-cal__wd">${d}</div>`).join('')}
      </div>
      <div class="mini-cal__grid">${cellsHtml}</div>
    </div>
  `;

  document.getElementById('calPrevBtn')?.addEventListener('click', () => {
    state.detailCalMonth--;
    if (state.detailCalMonth < 0) { state.detailCalMonth = 11; state.detailCalYear--; }
    renderDetailCal();
  });

  document.getElementById('calNextBtn')?.addEventListener('click', () => {
    state.detailCalMonth++;
    if (state.detailCalMonth > 11) { state.detailCalMonth = 0; state.detailCalYear++; }
    renderDetailCal();
  });
}

/* ─── MODALS ─── */
function openModal(id) {
  const el = document.getElementById(id);
  if (el) { el.classList.add('open'); el.setAttribute('aria-hidden','false'); }
}

function closeModal(id) {
  const el = document.getElementById(id);
  if (el) { el.classList.remove('open'); el.setAttribute('aria-hidden','true'); }
}

/* ─── ADD HABIT FORM ─── */
function renderEmojiGrid() {
  const el = document.getElementById('emojiGrid');
  if (!el) return;
  el.innerHTML = EMOJIS.map(e => `
    <button class="emoji-btn${e === state.selectedEmoji ? ' selected' : ''}" data-emoji="${e}" type="button">${e}</button>
  `).join('');
}

function renderColorGrid() {
  const el = document.getElementById('colorGrid');
  if (!el) return;
  el.innerHTML = ACCENT_COLORS.map(c => `
    <div class="color-swatch${c === state.selectedColor ? ' selected' : ''}"
         style="background:${c}"
         data-color="${c}"></div>
  `).join('');
}

function resetAddForm() {
  const nameEl = document.getElementById('inputName');
  const goalEl = document.getElementById('inputGoal');
  if (nameEl) nameEl.value = '';
  if (goalEl) goalEl.value = '1';
  state.selectedEmoji = EMOJIS[0];
  state.selectedColor = ACCENT_COLORS[0];
  state.selectedType  = 'build';
  document.getElementById('btnBuild')?.classList.add('active');
  document.getElementById('btnBreak')?.classList.remove('active');
  renderEmojiGrid();
  renderColorGrid();
}

function saveHabit() {
  const name = document.getElementById('inputName')?.value.trim();
  const goal = parseInt(document.getElementById('inputGoal')?.value) || 1;
  if (!name) {
    const inp = document.getElementById('inputName');
    if (inp) { inp.style.borderColor = 'rgba(229,115,115,0.5)'; setTimeout(() => inp.style.borderColor = '', 1200); inp.focus(); }
    return;
  }
  state.habits.push({
    id: `h_${Date.now()}_${Math.random().toString(36).slice(2,5)}`,
    name,
    emoji: state.selectedEmoji,
    type:  state.selectedType,
    goal,
    color: state.selectedColor,
    createdAt: Date.now(),
  });
  persist();
  closeModal('addModal');
  resetAddForm();
  render();
}

function deleteHabit(id) {
  state.habits = state.habits.filter(h => h.id !== id);
  delete state.logs[id];
  persist();
  closeModal('detailModal');
  render();
}

/* ─── UTILITY ─── */
function esc(str) {
  const d = document.createElement('div');
  d.appendChild(document.createTextNode(str));
  return d.innerHTML;
}

/* ─── EVENT DELEGATION ─── */
document.addEventListener('click', e => {
  const el = e.target.closest('[data-action]');
  if (!el) return;
  const action = el.dataset.action;
  const id     = el.dataset.id;

  switch (action) {
    case 'toggle':
      toggleComplete(id, todayStr());
      render();
      break;
    case 'increment':
      incrementCount(id, todayStr(), 1);
      render();
      break;
    case 'decrement':
      incrementCount(id, todayStr(), -1);
      render();
      break;
    case 'detail':
      openDetailModal(id);
      break;
    case 'delete':
      deleteHabit(id);
      break;
  }
});

/* ─── BOOT ─── */
document.addEventListener('DOMContentLoaded', () => {
  hydrate();
  render();
  renderEmojiGrid();
  renderColorGrid();

  // Header date
  const headerDate = document.getElementById('headerDate');
  if (headerDate) headerDate.textContent = formatHeaderDate();

  /* ── Tab navigation ── */
  document.querySelectorAll('.nav-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const tab = btn.dataset.tab;
      state.activeTab = tab;
      document.querySelectorAll('.nav-btn').forEach(b => b.classList.toggle('active', b.dataset.tab === tab));
      document.querySelectorAll('.tab-content').forEach(t => t.classList.toggle('active', t.id === `tab-${tab}`));
      render();
    });
  });

  /* ── Add modal ── */
  document.getElementById('openAddBtn')?.addEventListener('click', () => {
    resetAddForm();
    openModal('addModal');
  });
  document.getElementById('emptyAddBtn')?.addEventListener('click', () => {
    resetAddForm();
    openModal('addModal');
  });
  document.getElementById('closeAddModal')?.addEventListener('click', () => closeModal('addModal'));
  document.getElementById('cancelAddBtn')?.addEventListener('click', () => closeModal('addModal'));
  document.getElementById('saveHabitBtn')?.addEventListener('click', saveHabit);
  document.getElementById('inputName')?.addEventListener('keydown', e => { if (e.key === 'Enter') saveHabit(); });

  /* ── Type toggle ── */
  document.getElementById('btnBuild')?.addEventListener('click', () => {
    state.selectedType = 'build';
    document.getElementById('btnBuild').classList.add('active');
    document.getElementById('btnBreak').classList.remove('active');
  });
  document.getElementById('btnBreak')?.addEventListener('click', () => {
    state.selectedType = 'break';
    document.getElementById('btnBreak').classList.add('active');
    document.getElementById('btnBuild').classList.remove('active');
  });

  /* ── Emoji picker ── */
  document.getElementById('emojiGrid')?.addEventListener('click', e => {
    const btn = e.target.closest('.emoji-btn');
    if (!btn) return;
    state.selectedEmoji = btn.dataset.emoji;
    document.querySelectorAll('.emoji-btn').forEach(b =>
      b.classList.toggle('selected', b.dataset.emoji === state.selectedEmoji));
  });

  /* ── Color grid ── */
  document.getElementById('colorGrid')?.addEventListener('click', e => {
    const sw = e.target.closest('.color-swatch');
    if (!sw) return;
    state.selectedColor = sw.dataset.color;
    document.querySelectorAll('.color-swatch').forEach(s =>
      s.classList.toggle('selected', s.dataset.color === state.selectedColor));
  });

  /* ── Sort modal ── */
  document.getElementById('openSortBtn')?.addEventListener('click', () => {
    document.querySelectorAll('.sort-item').forEach(s =>
      s.classList.toggle('active', s.dataset.sort === state.sortMode));
    openModal('sortModal');
  });
  document.getElementById('closeSortModal')?.addEventListener('click', () => closeModal('sortModal'));
  document.querySelectorAll('.sort-item').forEach(item => {
    item.addEventListener('click', () => {
      state.sortMode = item.dataset.sort;
      document.querySelectorAll('.sort-item').forEach(s => s.classList.toggle('active', s === item));
      closeModal('sortModal');
      render();
    });
  });

  /* ── Detail modal ── */
  document.getElementById('closeDetailModal')?.addEventListener('click', () => closeModal('detailModal'));

  /* ── Close modals on overlay click ── */
  document.querySelectorAll('.modal-overlay').forEach(overlay => {
    overlay.addEventListener('click', e => {
      if (e.target === overlay) closeModal(overlay.id);
    });
  });

  /* ── Keyboard ── */
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') {
      ['addModal','sortModal','detailModal'].forEach(closeModal);
    }
  });

  /* ── Service Worker ── */
 
});
