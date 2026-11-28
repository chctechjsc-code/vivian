'use strict';
/* ============ Các trang ============ */
const Views = {};

function pageHead(title, sub = '', right = '') {
  return `<header class="page-head"><div><h1>${title}</h1>${sub ? `<p class="sub">${sub}</p>` : ''}</div><div class="head-right">${right}</div></header>`;
}
function greeting() {
  const h = new Date().getHours();
  if (h < 5) return 'Khuya rồi';
  if (h < 11) return 'Chào buổi sáng';
  if (h < 13) return 'Trưa an lành';
  if (h < 18) return 'Chiều dịu dàng';
  if (h < 22) return 'Buổi tối êm';
  return 'Ngủ ngon sớm nha';
}
const QUOTES = [
  'Hôm nay trời trong, mình làm từng việc nhỏ thôi nhé.',
  'Mây trôi chậm, Vân cũng không cần vội.',
  'Xong một việc là thêm một đám mây trắng.',
  'Mệt thì nghỉ, nghỉ xong mình làm tiếp.',
  'Bầu trời này là của riêng Vân.',
  'Làm ít mà đều, còn hơn nhiều mà mệt.',
  'Cười một cái rồi bắt đầu nha.',
  'Sau cơn mưa là trời lại xanh.',
];
const quoteOfDay = () => QUOTES[dayOfYear() % QUOTES.length];

/* ---------- mảnh ghép dùng chung ---------- */
function taskRow(task, d, opts = {}) {
  const done = isDone(task, d), c = catOf(task.cat), col = colorOf(c.color);
  return `<div class="trow ${done ? 'done' : ''}" data-act="editTask" data-id="${task.id}">
    <button type="button" class="chk ${done ? 'on' : ''}" style="--c:${col}" data-act="toggleTask" data-id="${task.id}" data-date="${d}" aria-label="Đánh dấu xong">${icon('check', 13, 3)}</button>
    <div class="trow-main">
      <div class="trow-title">${task.priority ? '<span class="star">★</span> ' : ''}${esc(task.title)}</div>
      <div class="trow-meta"><span class="dot" style="--c:${col}"></span>${esc(c.name)}${task.time ? ` · ${task.time}` : ''}${isRepeat(task) ? ` · ${icon('repeat', 11)} ${REPEAT_SHORT[task.repeat]}` : ''}${opts.meta || ''}</div>
    </div>${opts.right || ''}</div>`;
}
function catOptions(sel) { return db.categories.map(c => opt(c.id, c.name, sel)).join(''); }
function ringSvg(pct, size = 104) {
  const C = 2 * Math.PI * 34;
  return `<div class="hero-ring" style="width:${size}px;height:${size}px"><svg viewBox="0 0 80 80" class="ring"><circle cx="40" cy="40" r="34" class="ring-bg"/><circle cx="40" cy="40" r="34" class="ring-fg" stroke-dasharray="${C.toFixed(1)}" stroke-dashoffset="${(C * (1 - pct / 100)).toFixed(1)}"/></svg><div class="ring-txt">${pct}%<small>hôm nay</small></div></div>`;
}
const HERO_ART = `<svg viewBox="0 0 220 130" aria-hidden="true">
  <circle cx="160" cy="40" r="26" fill="#ffe7a8" opacity=".9"/><circle cx="160" cy="40" r="38" fill="#ffe7a8" opacity=".25"/>
  <g fill="#fff"><path transform="translate(70 34) scale(.62)" d="${CLOUD_PATH}" opacity=".95"/><path transform="translate(6 72) scale(.42)" d="${CLOUD_PATH}" opacity=".8"/><path transform="translate(140 84) scale(.34)" d="${CLOUD_PATH}" opacity=".7"/></g></svg>`;

/* =================== DASHBOARD =================== */
Views.dashboard = () => {
  const t = today(), s = db.settings;
  const list = tasksOn(t), dues = dueOn(t);
  const total = list.length + dues.length, doneN = list.filter(x => x.done).length;
  const pct = total ? Math.round(doneN / total * 100) : 0;
  const od = overdueTasks();
  const remToday = db.reminders.filter(r => !r.done && occursOn(r, t));
  const ym = ymOf(t);
  const spent = db.transactions.filter(x => x.type === 'out' && x.date.startsWith(ym)).reduce((a, b) => a + b.amount, 0);
  const bPct = s.budget ? Math.min(100, Math.round(spent / s.budget * 100)) : 0;
  const clouds = doneTodayCount();
  const left = total - doneN;

  const jar = Array.from({ length: Math.max(clouds, 5) }, (_, i) => `<span class="mc ${i < clouds ? '' : 'ghost'}" style="animation-delay:${-i * .4}s">${CLOUD_SVG}</span>`).join('');

  const sortedToday = [...list].sort((a, b) => (a.done - b.done) || ((b.task.priority ? 1 : 0) - (a.task.priority ? 1 : 0)) || (a.task.time || '99').localeCompare(b.task.time || '99'));
  const todayHtml = sortedToday.length || dues.length
    ? sortedToday.map(x => taskRow(x.task, t)).join('') + dues.map(task => taskRow(task, t, { meta: ` · <span class="late">Hạn hôm nay</span>` })).join('')
    : emptyState('Hôm nay trống trơn, như bầu trời không mây.<br>Thêm việc ở dưới nhé.');

  const odHtml = od.length
    ? od.slice(0, 6).map(task => taskRow(task, t, {
      meta: ` · <span class="late">trễ ${diffDays(dueKey(task), t)} ngày</span>`,
      right: `<button type="button" class="btn ghost sm" data-act="moveToday" data-id="${task.id}" title="Dời sang hôm nay">Dời hôm nay</button>`,
    })).join('') + (od.length > 6 ? `<button type="button" class="more-btn" data-act="go" data-view="tasks">+${od.length - 6} việc nữa</button>` : '')
    : emptyState('Không có gì quá hạn. Tuyệt vời!');

  const week = Array.from({ length: 7 }, (_, i) => {
    const d = addDays(t, i), items = dayItems(d, 'all', true);
    return `<div class="wday ${i === 0 ? 'is-today' : ''}" data-act="openDay" data-date="${d}">
      <div class="wday-h"><span>${i === 0 ? 'Hôm nay' : WD_SHORT[weekdayIdx(d)]}</span><b>${parseYmd(d).getDate()}</b></div>
      ${items.slice(0, 4).map(it => calPill(it, d)).join('')}
      ${items.length > 4 ? `<span class="more">+${items.length - 4} mục khác</span>` : ''}
    </div>`;
  }).join('');

  const habits = db.habits.map(h => `<button type="button" class="habit-chip ${h.log[t] ? 'on' : ''}" style="--c:${colorOf(h.color)}" data-act="habitToggle" data-id="${h.id}" data-date="${t}">${esc(h.emo)} ${esc(h.name)}</button>`).join('');
  const rems = db.reminders.filter(r => !r.done).map(r => ({ r, n: nextOcc(r) })).filter(x => x.n && x.n >= t)
    .sort((a, b) => (a.n + (a.r.time || '')).localeCompare(b.n + (b.r.time || ''))).slice(0, 4);

  return `
  ${pageHead(`${greeting()}, ${esc(s.nick)} <span style="font-weight:400">☁</span>`, `${fmtLong(t)} · ${quoteOfDay()}`)}
  <div class="dash">
    <section class="glass hero">
      ${ringSvg(pct)}
      <div class="hero-text">
        <h2>${total === 0 ? 'Một ngày thảnh thơi' : left === 0 ? 'Xong hết việc hôm nay rồi! 🎉' : `Còn ${left} việc nữa thôi`}</h2>
        <p>${total ? `Đã xong ${doneN}/${total} việc hôm nay${od.length ? ` · ${od.length} việc đang trễ hạn` : ''}.` : 'Không có việc nào lên lịch hôm nay.'}</p>
        <div class="cloud-jar">${jar}<small>${clouds} đám mây gom được hôm nay</small></div>
      </div>
      <div class="hero-art">${HERO_ART}</div>
    </section>

    <section class="stats">
      <a class="glass stat" href="#/tasks" style="--c:#5b8def"><span class="lbl-s"><span class="ic-wrap">${icon('tasks', 16)}</span>Việc hôm nay</span><span class="num">${doneN}/${total}</span><span class="hint">${pct}% hoàn thành</span></a>
      <a class="glass stat" href="#/tasks" style="--c:#e0507a"><span class="lbl-s"><span class="ic-wrap">${icon('alert', 16)}</span>Quá hạn</span><span class="num ${od.length ? 'bad' : ''}">${od.length}</span><span class="hint">${od.length ? 'cần xử lý sớm' : 'không có việc trễ'}</span></a>
      <a class="glass stat" href="#/reminders" style="--c:#9479e6"><span class="lbl-s"><span class="ic-wrap">${icon('bell', 16)}</span>Nhắc hôm nay</span><span class="num">${remToday.length}</span><span class="hint">${remToday.length ? remToday.map(r => r.time).sort()[0] + ' là nhắc sớm nhất' : 'yên tĩnh'}</span></a>
      <a class="glass stat" href="#/finance" style="--c:${bPct >= 90 ? '#e0507a' : '#33a98c'}"><span class="lbl-s"><span class="ic-wrap">${icon('wallet', 16)}</span>Chi tiêu tháng</span><span class="num">${fmtMoneyShort(spent)}</span><div class="bar"><i style="width:${bPct}%"></i></div><span class="hint">${bPct}% ngân sách ${fmtMoneyShort(s.budget)}</span></a>
    </section>

    <section class="glass card d-today">
      <div class="card-head"><h3>${icon('sun', 18)} Hôm nay cần làm</h3><span class="count">${total} việc</span></div>
      ${todayHtml}
      <form class="quick-add" data-submit="quickTask">
        <input class="field" name="title" placeholder="Thêm nhanh việc cho hôm nay…" autocomplete="off">
        <button class="btn primary" type="submit">${icon('plus', 16)}</button>
      </form>
    </section>

    <section class="glass card d-over">
      <div class="card-head"><h3>${icon('alert', 18)} Quá hạn</h3><span class="count">${od.length}</span></div>
      ${odHtml}
    </section>

    <div class="d-side">
      <section class="glass card">
        <div class="card-head"><h3>${icon('leaf', 18)} Thói quen</h3><a class="link-btn" href="#/relax">Xem tuần</a></div>
        <div class="habit-chips">${habits || '<span class="muted small">Chưa có thói quen nào.</span>'}</div>
      </section>
      <section class="glass card">
        <div class="card-head"><h3>${icon('bell', 18)} Sắp nhắc</h3><a class="link-btn" href="#/reminders">Tất cả</a></div>
        <div class="mini-list">${rems.length ? rems.map(({ r, n }) => `<div class="mini-item" data-act="editRem" data-id="${r.id}">${icon('bell', 14)}<span class="t">${esc(r.title)}</span><span class="when">${relDay(n)} ${r.time || ''}</span></div>`).join('') : '<span class="muted small">Không có nhắc nào sắp tới.</span>'}</div>
      </section>
    </div>

    <section class="glass card d-week">
      <div class="card-head"><h3>${icon('calendar', 18)} Sự kiện 7 ngày tới</h3><a class="link-btn" href="#/tasks">Mở lịch tháng →</a></div>
      <div class="week">${week}</div>
    </section>
  </div>`;
};

/* =================== CÔNG VIỆC: bảng việc + lịch sự kiện =================== */
function calPill(it, d) {
  if (it.kind === 'event') {
    const e = it.ev, c = colorOf(catOf(e.cat).color), tm = eventTime(e, d);
    const multi = !isRepeat(e) && e.endDate && e.endDate > e.date;
    const tip = `${e.title}${tm ? ' · ' + tm : ''}${e.location ? ' · ' + e.location : ''}`;
    return `<div class="pill ev ${tm ? '' : 'allday'}" style="--c:${c}" draggable="true" data-drag-event="${e.id}" data-from="${d}" data-act="editEvent" data-id="${e.id}" title="${esc(tip)}">${tm ? `<b>${e.start}</b> ` : ''}${multi && d !== e.date ? '↳ ' : ''}${esc(e.title)}</div>`;
  }
  return `<div class="rem-pill" data-act="editRem" data-id="${it.rem.id}" title="Nhắc: ${esc(it.rem.title)}">${icon('bell', 11, 2.2)}${it.rem.time ? it.rem.time + ' ' : ''}${esc(it.rem.title)}</div>`;
}
function taskCard(t) {
  const c = catOf(t.cat), col = colorOf(c.color), td = today();
  const late = !isRepeat(t) && t.status !== 'done' && dueKey(t) && dueKey(t) < td;
  const canTick = !isRepeat(t) || occursOn(t, td);
  const done = isRepeat(t) ? isDone(t, td) : t.status === 'done';
  const sub = [esc(c.name)];
  if (isRepeat(t)) sub.push(`${REPEAT_SHORT[t.repeat]}${t.time ? ' ' + t.time : ''}`);
  else if (t.date) sub.push(relDay(t.date) + (t.time ? ' ' + t.time : ''));
  if (t.deadline) sub.push(`<span class="${late ? 'late' : ''}">Hạn ${fmtDM(t.deadline)}</span>`);
  else if (late) sub.push('<span class="late">trễ</span>');
  return `<div class="tcard ${done && !isRepeat(t) ? 'done' : ''}" draggable="true" data-drag-task="${t.id}" data-act="editTask" data-id="${t.id}" style="--c:${col}">
    ${canTick ? `<button type="button" class="chk sm ${done ? 'on' : ''}" style="--c:${col}" data-act="toggleTask" data-id="${t.id}" data-date="${td}" aria-label="Xong">${icon('check', 11, 3)}</button>` : `<span style="color:${col};margin-top:1px">${icon('repeat', 16)}</span>`}
    <div class="tcard-body"><div class="tcard-title">${t.priority ? '<span class="star">★</span> ' : ''}${esc(t.title)}</div><div class="tcard-sub">${sub.join(' · ')}</div></div>
  </div>`;
}
function groupBlock(key, title, color, tasks, extraHead = '', dropStatus = '') {
  const LIMIT = 6, open = ui.expanded[key];
  const shown = open ? tasks : tasks.slice(0, LIMIT);
  return `<div class="group" ${dropStatus ? `data-drop-status="${dropStatus}"` : ''}>
    <div class="group-h"><span class="dot" style="--c:${color};width:10px;height:10px"></span>${title}<span class="count">· ${tasks.length}</span><span class="sp"></span>${extraHead}</div>
    ${shown.map(taskCard).join('') || `<div class="muted small" style="padding:4px 6px 8px">Kéo thả việc vào đây</div>`}
    ${tasks.length > LIMIT ? `<button type="button" class="more-btn" data-act="expand" data-key="${key}">${open ? 'Thu gọn ↑' : `Xem thêm ${tasks.length - LIMIT} ↓`}</button>` : ''}
  </div>`;
}
Views.tasks = () => {
  const y = ui.calY, m = ui.calM, ym = `${y}-${pad(m + 1)}`, td = today();
  const f = ui.calFilter;
  const pool = activeTasks().filter(t => f === 'all' || t.cat === f);
  let panel;
  if (ui.panelTab === 'board') {
    const one = pool.filter(t => !isRepeat(t));
    const sortT = arr => arr.sort((a, b) => (b.priority - a.priority) || (dueKey(a) || '9999').localeCompare(dueKey(b) || '9999'));
    const todo = sortT(one.filter(t => t.status === 'todo'));
    const doing = sortT(one.filter(t => t.status === 'doing'));
    const done = one.filter(t => t.status === 'done').sort((a, b) => (b.doneAt || 0) - (a.doneAt || 0));
    panel = groupBlock('todo', 'Cần làm', STATUSES[0].color, todo, '', 'todo')
      + groupBlock('doing', 'Đang làm', STATUSES[1].color, doing, '', 'doing')
      + groupBlock('done', 'Đã xong', STATUSES[2].color, done, done.length ? `<button type="button" class="link-btn" data-act="archiveDone">Cất vào lưu trữ</button>` : '', 'done');
  } else {
    const rep = pool.filter(isRepeat);
    const by = r => rep.filter(t => t.repeat === r);
    panel = ['daily', 'weekdays', 'weekly', 'monthly', 'yearly'].filter(r => by(r).length)
      .map(r => groupBlock('rep-' + r, REPEAT_LABEL[r], COLORS.sky, by(r))).join('')
      || emptyState('Chưa có việc lặp lại.<br>Tạo việc và chọn “Lặp lại”.');
  }

  const start = calendarStart(y, m);
  const rows = Math.ceil((diffDays(start, `${ym}-01`) + daysInMonth(y, m)) / 7);
  let cells = '';
  for (let i = 0; i < rows * 7; i++) {
    const d = addDays(start, i), dt = parseYmd(d);
    const items = dayItems(d, f, db.settings.calRem);
    // vẽ hết, sau đó fitCells() đo chiều cao thật của ô và gom phần dư thành "+n mục khác"
    cells += `<div class="cell ${dt.getMonth() !== m ? 'out' : ''} ${d === td ? 'today' : ''} ${weekdayIdx(d) === 6 ? 'weekend' : ''}" data-drop-date="${d}">
      <div class="cell-top"><button type="button" class="cell-add" data-act="newEvent" data-date="${d}" aria-label="Thêm sự kiện ngày ${fmtDM(d)}">${icon('plus', 14, 2.2)}</button><span class="dnum" data-act="openDay" data-date="${d}" style="cursor:pointer">${dt.getDate()}</span></div>
      <div class="cell-items" data-date="${d}">${items.map(it => calPill(it, d)).join('')}</div>
    </div>`;
  }

  const chips = [`<button type="button" class="fchip ${f === 'all' ? 'on' : ''}" data-act="calFilter" data-cat="all">Tất cả</button>`]
    .concat(db.categories.map(c => `<button type="button" class="fchip ${f === c.id ? 'on' : ''}" data-act="calFilter" data-cat="${c.id}"><span class="dot" style="--c:${colorOf(c.color)}"></span>${esc(c.name)}</button>`)).join('');

  return `
  ${pageHead('Công việc', '', `<label class="check small">${''}<input type="checkbox" data-change="calRem" ${db.settings.calRem ? 'checked' : ''}> Hiện nhắc việc trên lịch</label><button type="button" class="btn primary" data-act="newTask">${icon('plus', 16)} Việc mới</button>`)}
  <div class="tasks-wrap">
    <aside class="glass panel">
      <div class="seg"><button type="button" class="${ui.panelTab === 'board' ? 'on' : ''}" data-act="panelTab" data-tab="board">Bảng việc</button><button type="button" class="${ui.panelTab === 'routine' ? 'on' : ''}" data-act="panelTab" data-tab="routine">${icon('repeat', 13)} Lặp lại</button></div>
      <button type="button" class="add-row" data-act="newTask">${icon('plus', 15)} Thêm việc</button>
      <div class="panel-scroll">${panel}</div>
    </aside>
    <section class="glass cal">
      <div class="cal-head">
        <h2>${fmtMonth(ym)}</h2>
        <div class="cal-filters">${chips}</div>
        <div class="month-nav">
          <button type="button" class="icon-btn" data-act="calNav" data-d="-1" aria-label="Tháng trước">${icon('left')}</button>
          <span class="lbl-m">Tháng ${m + 1}</span>
          <button type="button" class="icon-btn" data-act="calNav" data-d="1" aria-label="Tháng sau">${icon('right')}</button>
          <button type="button" class="btn ghost sm" data-act="calToday">Hôm nay</button>
          <button type="button" class="btn primary sm" data-act="newEvent">${icon('plus', 14)} Sự kiện</button>
        </div>
      </div>
      <div class="cal-wd">${WD_LONG.map((w, i) => `<div><span class="wl">${w}</span><span class="ws">${WD_SHORT[i]}</span></div>`).join('')}</div>
      <div class="cal-grid" style="grid-template-rows:repeat(${rows},minmax(0,1fr))">${cells}</div>
    </section>
  </div>`;
};

/* =================== NHẮC VIỆC =================== */
function remRow(r) {
  const n = nextOcc(r), late = remIsLate(r);
  const when = r.done ? 'Đã xong' : n ? `${relDay(n)}${r.time ? ' · ' + r.time : ''}` : '—';
  return `<div class="rem-row ${r.done ? 'done' : ''} ${late ? 'alert' : ''}">
    <span class="rem-ic">${icon('bell', 18)}</span>
    <div class="rem-main" data-act="editRem" data-id="${r.id}">
      <div class="rem-t">${esc(r.title)}</div>
      <div class="rem-m">${late ? `<span class="tag red">Đến giờ rồi</span>` : ''}<span>${icon('clock', 12)}</span>${when}${isRepeat(r) ? `<span class="tag">${icon('repeat', 10)} ${REPEAT_SHORT[r.repeat]}</span>` : ''}${r.note ? ` · ${esc(r.note)}` : ''}</div>
    </div>
    ${isRepeat(r) ? '' : `<button type="button" class="chk ${r.done ? 'on' : ''}" data-act="remDone" data-id="${r.id}" aria-label="Xong">${icon('check', 13, 3)}</button>`}
    <button type="button" class="icon-btn plain" data-act="delRem" data-id="${r.id}" aria-label="Xóa">${icon('trash', 16)}</button>
  </div>`;
}
Views.reminders = () => {
  const t = today();
  const act = db.reminders.filter(r => !r.done);
  const withN = act.map(r => ({ r, n: nextOcc(r) }));
  const late = withN.filter(x => remIsLate(x.r));
  const todayL = withN.filter(x => !remIsLate(x.r) && x.n === t);
  const later = withN.filter(x => !remIsLate(x.r) && x.n && x.n > t).sort((a, b) => (a.n + a.r.time).localeCompare(b.n + b.r.time));
  const done = db.reminders.filter(r => r.done);
  const sortT = arr => arr.sort((a, b) => (a.r.time || '').localeCompare(b.r.time || ''));
  const perm = ('Notification' in window) ? Notification.permission : 'unsupported';
  const sec = (title, arr) => arr.length ? `<div class="section-t">${title} · ${arr.length}</div>${arr.map(x => remRow(x.r || x)).join('')}` : '';
  return `
  ${pageHead('Nhắc việc', 'Để Vivian nhớ giùm Vân — chuông sẽ reo khi trang đang mở.', `<button type="button" class="btn primary" data-act="newRem">${icon('plus', 16)} Nhắc mới</button>`)}
  ${perm === 'default' ? `<div class="banner">${icon('bell', 18)}<span>Bật thông báo để nhận nhắc kể cả khi đang ở tab khác.</span><span class="sp"></span><button type="button" class="btn accent sm" data-act="askNotify">Bật thông báo</button></div>` : ''}
  <div class="two-col">
    <form class="glass card stack" data-submit="quickRem">
      <h3>${icon('plus', 18)} Nhắc nhanh</h3>
      <input class="field" name="title" placeholder="Nhắc Vân điều gì nè?" required autocomplete="off">
      <div class="grid2">
        <label class="lbl">Ngày<input class="field" type="date" name="date" value="${t}" required></label>
        <label class="lbl">Giờ<input class="field" type="time" name="time" value="${pad((new Date().getHours() + 1) % 24)}:00" required></label>
      </div>
      <label class="lbl">Lặp lại<select class="field" name="repeat">${Object.entries(REPEAT_LABEL).map(([k, v]) => opt(k, v, 'none')).join('')}</select></label>
      <button class="btn primary" type="submit">${icon('bell', 16)} Đặt nhắc</button>
    </form>
    <section class="glass card">
      ${sec('Đến giờ rồi', sortT(late))}${sec('Hôm nay', sortT(todayL))}${sec('Sắp tới', later)}
      ${!late.length && !todayL.length && !later.length ? emptyState('Chưa có nhắc việc nào.') : ''}
      ${done.length ? `<div class="section-t">Đã xong · ${done.length} <button type="button" class="link-btn" data-act="clearDoneRem" style="margin-left:8px">Xóa hết</button></div>${done.slice(0, 20).map(remRow).join('')}` : ''}
    </section>
  </div>`;
};

/* =================== CHI TIÊU =================== */
Views.finance = () => {
  const ym = ui.finYM, s = db.settings;
  const txs = db.transactions.filter(x => x.date.startsWith(ym)).sort((a, b) => b.date.localeCompare(a.date) || b.createdAt - a.createdAt);
  const inc = txs.filter(x => x.type === 'in').reduce((a, b) => a + b.amount, 0);
  const out = txs.filter(x => x.type === 'out').reduce((a, b) => a + b.amount, 0);
  const bPct = s.budget ? Math.round(out / s.budget * 100) : 0;
  const byCat = {};
  txs.filter(x => x.type === 'out').forEach(x => byCat[x.cat] = (byCat[x.cat] || 0) + x.amount);
  const cats = Object.entries(byCat).sort((a, b) => b[1] - a[1]);
  const max = cats.length ? cats[0][1] : 1;
  const groups = {};
  txs.forEach(x => (groups[x.date] = groups[x.date] || []).push(x));
  const isCur = ym === ymOf(today());
  // dự báo: chi trung bình/ngày × số ngày của tháng
  const [yy, mm] = ym.split('-').map(Number);
  const dayN = isCur ? parseYmd(today()).getDate() : daysInMonth(yy, mm - 1);
  const forecast = Math.round(out / dayN * daysInMonth(yy, mm - 1));

  return `
  ${pageHead('Chi tiêu', 'Theo dõi tiền vào, tiền ra — nhẹ nhàng như mây.', `
    <div class="month-nav"><button type="button" class="icon-btn" data-act="finNav" data-d="-1" aria-label="Tháng trước">${icon('left')}</button><span class="lbl-m">${fmtMonth(ym)}</span><button type="button" class="icon-btn" data-act="finNav" data-d="1" aria-label="Tháng sau">${icon('right')}</button></div>`)}
  <div class="fin-stats">
    <div class="glass stat" style="--c:#33a98c"><span class="lbl-s"><span class="ic-wrap">${icon('download', 16)}</span>Thu nhập</span><span class="num money-in">${fmtMoney(inc)}</span></div>
    <div class="glass stat" style="--c:#e0507a"><span class="lbl-s"><span class="ic-wrap">${icon('upload', 16)}</span>Chi tiêu</span><span class="num money-out">${fmtMoney(out)}</span>${isCur ? `<span class="hint">Dự kiến cả tháng ~ ${fmtMoneyShort(forecast)}</span>` : ''}</div>
    <div class="glass stat" style="--c:#5b8def"><span class="lbl-s"><span class="ic-wrap">${icon('wallet', 16)}</span>Còn lại</span><span class="num">${fmtMoney(inc - out)}</span></div>
    <div class="glass stat" style="--c:${bPct >= 100 ? '#e0507a' : bPct >= 80 ? '#e99a33' : '#9479e6'}"><span class="lbl-s"><span class="ic-wrap">${icon('flag', 16)}</span>Ngân sách</span><span class="num">${bPct}%</span><div class="bar"><i style="width:${Math.min(100, bPct)}%"></i></div><span class="hint">${fmtMoney(out)} / ${fmtMoney(s.budget)}</span></div>
  </div>
  <div class="two-col">
    <div class="stack">
      <form class="glass card stack" data-submit="addTx">
        <h3>${icon('plus', 18)} Ghi khoản mới</h3>
        <div class="seg" style="align-self:flex-start"><label><input type="radio" name="type" value="out" checked data-change="txType"><span>Chi ra</span></label><label><input type="radio" name="type" value="in" data-change="txType"><span>Thu vào</span></label></div>
        <input class="field big" name="amount" inputmode="numeric" placeholder="0 ₫" data-input="money" required autocomplete="off">
        <div class="grid2">
          <label class="lbl">Danh mục<select class="field" name="cat" id="tx-cat">${EXPENSE_CATS.map(c => opt(c.id, c.emo + ' ' + c.name)).join('')}</select></label>
          <label class="lbl">Ngày<input class="field" type="date" name="date" value="${isCur ? today() : ym + '-01'}" required></label>
        </div>
        <input class="field" name="note" placeholder="Ghi chú (tùy chọn)" autocomplete="off">
        <button class="btn primary" type="submit">Lưu khoản này</button>
      </form>
      <section class="glass card">
        <div class="card-head"><h3>Chi theo danh mục</h3></div>
        <div class="cat-bars">${cats.length ? cats.map(([id, v]) => { const c = txCat('out', id); return `<div><div class="cat-bar-h"><span>${c.emo} ${c.name}</span><span>${fmtMoney(v)} · ${Math.round(v / out * 100)}%</span></div><div class="bar" style="--c:${colorOf(c.color)}"><i style="width:${v / max * 100}%"></i></div></div>`; }).join('') : '<span class="muted small">Chưa có khoản chi nào tháng này.</span>'}</div>
      </section>
    </div>
    <section class="glass card">
      <div class="card-head"><h3>Sổ giao dịch</h3><span class="count">${txs.length} khoản</span></div>
      ${Object.keys(groups).length ? Object.entries(groups).map(([d, arr]) => `<div class="section-t">${relDay(d)} · ${fmtDM(d)}</div>${arr.map(x => { const c = txCat(x.type, x.cat); return `<div class="tx-row"><span class="tx-emo">${c.emo}</span><div class="tx-main"><b>${esc(c.name)}</b><small>${esc(x.note || '—')}</small></div><span class="tx-amt ${x.type === 'in' ? 'money-in' : 'money-out'}">${x.type === 'in' ? '+' : '−'}${fmtMoney(x.amount)}</span><button type="button" class="icon-btn plain" data-act="delTx" data-id="${x.id}" aria-label="Xóa">${icon('trash', 15)}</button></div>`; }).join('')}`).join('') : emptyState('Chưa có giao dịch nào trong tháng.')}
    </section>
  </div>`;
};

/* =================== GHI CHÚ =================== */
function notesGrid() {
  const q = ui.noteQ.trim().toLowerCase();
  const list = db.notes.filter(n => !n.archived && (!q || (n.title + ' ' + n.body).toLowerCase().includes(q)))
    .sort((a, b) => (b.pinned - a.pinned) || b.updatedAt - a.updatedAt);
  if (!list.length) return emptyState(q ? 'Không tìm thấy ghi chú nào.' : 'Chưa có ghi chú. Gõ vào ô “Ghi nhanh” bên trái cũng được nè.');
  return `<div class="notes-grid">${list.map(n => `<article class="note" style="--nc:${NOTE_COLORS[n.color] || '#fff'}" data-act="editNote" data-id="${n.id}">
    ${n.pinned ? `<span class="pin">${icon('pin', 15)}</span>` : ''}
    ${n.title ? `<h4>${esc(n.title)}</h4>` : ''}<p>${esc(n.body)}</p>
    <div class="note-d">${relDay(ymd(new Date(n.updatedAt)))}</div></article>`).join('')}</div>`;
}
Views.notes = () => `
  ${pageHead('Ghi chú', 'Những điều nhỏ xinh muốn nhớ.', `
    <div style="position:relative"><input class="field" style="width:220px;padding-left:34px" placeholder="Tìm ghi chú…" value="${esc(ui.noteQ)}" data-input="noteSearch"><span style="position:absolute;left:11px;top:11px;color:var(--ink-3)">${icon('search', 15)}</span></div>
    <button type="button" class="btn primary" data-act="newNote">${icon('plus', 16)} Ghi chú mới</button>`)}
  <div id="notes-grid">${notesGrid()}</div>`;

/* =================== DỰ ÁN =================== */
Views.projects = () => {
  const list = db.projects.filter(p => !p.archived);
  return `
  ${pageHead('Dự án', 'Những điều lớn, chia thành từng bước nhỏ.', `<button type="button" class="btn primary" data-act="newProject">${icon('plus', 16)} Dự án mới</button>`)}
  <div class="proj-grid">
    ${list.map(p => {
      const ms = p.milestones || [], dn = ms.filter(x => x.done).length, pct = ms.length ? Math.round(dn / ms.length * 100) : 0;
      const tasks = db.tasks.filter(t => t.projectId === p.id && !t.archived), open = tasks.filter(t => !isRepeat(t) && t.status !== 'done').length;
      const left = p.deadline ? diffDays(today(), p.deadline) : null;
      return `<article class="glass proj" style="--c:${colorOf(p.color)}" data-act="editProject" data-id="${p.id}">
        <h3>${esc(p.name)}</h3>
        ${p.desc ? `<p class="desc">${esc(p.desc)}</p>` : '<div style="height:12px"></div>'}
        <div class="bar" style="--c:${colorOf(p.color)}"><i style="width:${pct}%"></i></div>
        <div class="meta"><span>${pct}% · ${dn}/${ms.length} bước</span><span class="${left !== null && left < 0 ? 'late' : ''}">${left === null ? '' : left < 0 ? `trễ ${-left} ngày` : left === 0 ? 'hạn hôm nay' : `còn ${left} ngày`}</span></div>
        <div class="ms-list">${ms.slice(0, 4).map(x => `<div class="ms ${x.done ? 'done' : ''}"><button type="button" class="chk sm ${x.done ? 'on' : ''}" style="--c:${colorOf(p.color)}" data-act="toggleMs" data-pid="${p.id}" data-mid="${x.id}">${icon('check', 11, 3)}</button><span>${esc(x.title)}</span></div>`).join('')}${ms.length > 4 ? `<span class="muted small">+${ms.length - 4} bước nữa</span>` : ''}</div>
        <div class="meta" style="margin-top:12px"><span>${icon('tasks', 13)}</span><span style="margin-right:auto;margin-left:6px">${tasks.length} việc liên kết · ${open} đang mở</span></div>
      </article>`;
    }).join('')}
    <button type="button" class="proj-new" data-act="newProject">${icon('plus', 22)} Thêm dự án</button>
  </div>`;
};

/* =================== THƯ GIÃN =================== */
const relax = { breath: false, breathTimer: null, pomo: { mode: 'focus', left: 25 * 60, running: false, end: 0 }, sleepAt: 0, sleepMin: 0 };
function pomoText() { const l = Math.max(0, relax.pomo.left); return pad(Math.floor(l / 60)) + ':' + pad(l % 60); }
Views.relax = () => {
  const t = today(), ws = weekStart(t);
  const vols = db.settings.soundVol || {};
  const days = Array.from({ length: 7 }, (_, i) => addDays(t, i - 6)); // 7 ngày gần nhất, kết thúc hôm nay
  const focusToday = db.focusLog[t] || 0;
  return `
  ${pageHead('Thư giãn', 'Một góc mây yên tĩnh của riêng Vân.')}
  <div class="relax-grid">
    <section class="glass card r-sounds">
      <div class="card-head"><h3>${icon('cloud', 18)} Âm thanh mây</h3>
        <div class="seg">${[0, 15, 30, 60].map(mn => `<button type="button" class="${relax.sleepMin === mn ? 'on' : ''}" data-act="sleepTimer" data-min="${mn}">${mn ? mn + ' phút' : 'Không hẹn'}</button>`).join('')}</div>
      </div>
      <div class="snd-grid">${SOUND_DEFS.map(sd => `<div class="snd ${Sound.isOn(sd.id) ? 'on' : ''}" id="snd-${sd.id}">
        <button type="button" data-act="sound" data-id="${sd.id}"><span class="emo">${sd.emo}</span><span><b>${sd.name}</b><small>${sd.desc}</small></span></button>
        <input type="range" min="0" max="100" value="${vols[sd.id] ?? 60}" data-input="soundVol" data-id="${sd.id}" aria-label="Âm lượng ${sd.name}">
      </div>`).join('')}</div>
      <p class="muted small" style="margin-top:12px">Bật nhiều âm cùng lúc để tự trộn. Âm thanh được tạo trực tiếp, không cần mạng. <span id="sleep-left"></span></p>
    </section>

    <section class="glass card r-breathe">
      <div class="card-head"><h3>${icon('leaf', 18)} Hít thở cùng mây</h3><span class="count">4 · 4 · 6</span></div>
      <div class="breath-stage">
        <div class="breath-cloud" id="breath">${CLOUD_SVG}<span id="breath-txt">${relax.breath ? '…' : 'Sẵn sàng'}</span></div>
        <button type="button" class="btn ${relax.breath ? 'ghost' : 'primary'}" data-act="breath">${relax.breath ? 'Dừng lại' : 'Bắt đầu thở'}</button>
      </div>
    </section>

    <section class="glass card r-focus">
      <div class="card-head"><h3>${icon('clock', 18)} Tập trung</h3><span class="count">Hôm nay: ${focusToday} phiên</span></div>
      <div class="pomo">
        <div class="seg"><button type="button" class="${relax.pomo.mode === 'focus' ? 'on' : ''}" data-act="pomoMode" data-mode="focus">Tập trung 25′</button><button type="button" class="${relax.pomo.mode === 'short' ? 'on' : ''}" data-act="pomoMode" data-mode="short">Nghỉ 5′</button><button type="button" class="${relax.pomo.mode === 'long' ? 'on' : ''}" data-act="pomoMode" data-mode="long">Nghỉ 15′</button></div>
        <div class="pomo-time" id="pomo-time">${pomoText()}</div>
        <div class="row"><button type="button" class="btn primary" data-act="pomoToggle" id="pomo-btn">${relax.pomo.running ? icon('pause', 16) + ' Tạm dừng' : icon('play', 16) + ' Bắt đầu'}</button><button type="button" class="icon-btn" data-act="pomoReset" aria-label="Đặt lại">${icon('reset', 16)}</button></div>
      </div>
    </section>

    <section class="glass card r-habits">
      <div class="card-head"><h3>${icon('check', 18)} Thói quen 7 ngày qua</h3></div>
      <table class="habit-table">
        <thead><tr><th></th>${days.map(d => `<th class="${d === t ? 'today-col' : ''}">${WD_SHORT[weekdayIdx(d)]}<br>${parseYmd(d).getDate()}</th>`).join('')}<th></th><th></th></tr></thead>
        <tbody>${db.habits.map(h => `<tr><td class="hname">${esc(h.emo)} ${esc(h.name)}</td>${days.map(d => `<td><button type="button" class="hcell ${h.log[d] ? 'on' : ''} ${d > t ? 'future' : ''}" style="--c:${colorOf(h.color)}" data-act="habitToggle" data-id="${h.id}" data-date="${d}" aria-label="${esc(h.name)} ${fmtDM(d)}">${icon('check', 14, 3)}</button></td>`).join('')}<td class="streak">🔥 ${habitStreak(h)}</td><td><button type="button" class="icon-btn plain hdel" data-act="delHabit" data-id="${h.id}" aria-label="Xóa thói quen">${icon('x', 14)}</button></td></tr>`).join('')}</tbody>
      </table>
      <form class="row" style="margin-top:10px" data-submit="addHabit">
        <input class="field" name="emo" value="✨" style="width:56px;text-align:center" maxlength="4" aria-label="Biểu tượng">
        <input class="field" name="name" placeholder="Thói quen mới, ví dụ: Đi bộ 15 phút" required autocomplete="off">
        <select class="field" name="color" style="width:130px">${Object.keys(COLORS).map(k => opt(k, COLOR_NAMES[k], 'sky')).join('')}</select>
        <button class="btn primary" type="submit">${icon('plus', 16)}</button>
      </form>
    </section>
  </div>`;
};

/* =================== MÀU & KÍNH =================== */
const SKIES = {
  dawn: { name: 'Bình minh', g: ['#f6c9dc', '#fbe0d4', '#d6e6ff'], mode: 'light' },
  day: { name: 'Trời trong', g: ['#86bdfc', '#c6e2ff', '#f1f8ff'], mode: 'light' },
  cotton: { name: 'Kẹo bông', g: ['#c4b5ff', '#f3c4e2', '#fff0f6'], mode: 'light' },
  sunset: { name: 'Hoàng hôn', g: ['#7a83d8', '#e9a3c6', '#ffd6ad'], mode: 'light' },
  night: { name: 'Đêm sao', g: ['#0f1533', '#262f68', '#474a8a'], mode: 'dark' },
};
const ACCENTS = ['#6c8cff', '#e5678f', '#9479e6', '#33a98c', '#e99a33', '#3a9bb5', '#34405e'];
Views.theme = () => {
  const s = db.settings;
  const skyOpt = (id, name, g) => `<button type="button" class="sky-opt ${s.sky === id ? 'on' : ''}" data-act="setSky" data-sky="${id}"><div class="pv" style="background:${g}">${CLOUD_SVG}</div><span>${name}</span></button>`;
  const slider = (key, label, min, max, step, val, unit) => `<div class="slider-row"><span>${label}</span><input type="range" min="${min}" max="${max}" step="${step}" value="${val}" data-input="setting" data-key="${key}"><output id="out-${key}">${val}${unit}</output></div>`;
  return `
  ${pageHead('Màu & kính', 'Tùy chỉnh bầu trời theo tâm trạng.')}
  <div class="theme-grid">
    <div class="stack">
      <section class="glass card">
        <div class="card-head"><h3>${icon('cloud', 18)} Bầu trời</h3></div>
        <div class="sky-opts">
          ${skyOpt('auto', 'Theo giờ trong ngày', 'linear-gradient(135deg,#f6c9dc,#86bdfc 40%,#e9a3c6 70%,#262f68)')}
          ${Object.entries(SKIES).map(([id, k]) => skyOpt(id, k.name, `linear-gradient(180deg,${k.g.join(',')})`)).join('')}
        </div>
      </section>
      <section class="glass card stack">
        <h3>${icon('palette', 18)} Màu nhấn</h3>
        <div class="swatches">${ACCENTS.map(c => `<button type="button" class="sw acc-sw ${s.accent === c ? 'on' : ''}" style="--c:${c}" data-act="setAccent" data-c="${c}" aria-label="Màu ${c}"></button>`).join('')}
          <label class="sw acc-sw" style="--c:conic-gradient(red,yellow,lime,cyan,blue,magenta,red)" title="Tự chọn màu"><input type="color" value="${s.accent}" data-input="accentPick"></label></div>
      </section>
      <section class="glass card stack">
        <h3>${icon('sun', 18)} Kính mờ & mây</h3>
        ${slider('blur', 'Độ nhòe kính', 0, 40, 1, s.blur, 'px')}
        ${slider('glass', 'Độ đục kính', 15, 90, 1, Math.round(s.glass * 100), '%')}
        ${slider('cloudCount', 'Số đám mây', 0, 24, 1, s.cloudCount, '')}
        ${slider('scale', 'Cỡ chữ', 90, 115, 1, Math.round(s.scale * 100), '%')}
        <label class="check"><input type="checkbox" data-change="cloudsOn" ${s.clouds ? 'checked' : ''}> Cho mây trôi trên nền</label>
        <div><button type="button" class="btn ghost sm" data-act="resetTheme">${icon('reset', 14)} Về mặc định</button></div>
      </section>
    </div>
    <section class="glass card stack" style="position:sticky;top:0">
      <h3>Xem trước</h3>
      <div class="tcard" style="--c:${COLORS.rose}"><span class="chk sm on" style="--c:${COLORS.rose}">${icon('check', 11, 3)}</span><div class="tcard-body"><div class="tcard-title">Hẹn cà phê cuối tuần</div><div class="tcard-sub">Hai đứa mình · Thứ Bảy 9:00</div></div></div>
      <div class="tcard" style="--c:${COLORS.storm}"><span class="chk sm" style="--c:${COLORS.storm}"></span><div class="tcard-body"><div class="tcard-title">Gửi báo cáo tuần</div><div class="tcard-sub">Công việc · <span class="late">Hạn hôm nay</span></div></div></div>
      <div class="row"><div class="pill" style="--c:${COLORS.sky};flex:1">Học tiếng Hàn</div><div class="pill" style="--c:${COLORS.mint};flex:1">Yoga</div></div>
      <div class="due"><span class="bang">!</span><div><small>Hạn chót</small><span>Nộp bài tập</span></div></div>
      <div class="row"><button type="button" class="btn primary">Nút chính</button><button type="button" class="btn accent">Màu nhấn</button></div>
    </section>
  </div>`;
};

/* =================== LƯU TRỮ =================== */
Views.archive = () => {
  const tab = ui.archTab;
  let rows = [];
  if (tab === 'tasks') rows = db.tasks.filter(t => t.archived).sort((a, b) => (b.doneAt || 0) - (a.doneAt || 0)).map(t => ({ id: t.id, title: t.title, sub: `${catOf(t.cat).name}${t.date ? ' · ' + fmtDM(t.date) : ''}${t.status === 'done' ? ' · đã xong' : ''}` }));
  if (tab === 'notes') rows = db.notes.filter(n => n.archived).map(n => ({ id: n.id, title: n.title || n.body.slice(0, 50), sub: relDay(ymd(new Date(n.updatedAt))) }));
  if (tab === 'projects') rows = db.projects.filter(p => p.archived).map(p => ({ id: p.id, title: p.name, sub: `${(p.milestones || []).length} bước` }));
  return `
  ${pageHead('Lưu trữ', 'Những thứ đã cất đi — vẫn khôi phục được.', rows.length ? `<button type="button" class="btn ghost danger-text" data-act="purgeArchive" data-kind="${tab}">${icon('trash', 15)} Xóa vĩnh viễn tất cả</button>` : '')}
  <div class="seg" style="margin-bottom:14px">${[['tasks', 'Công việc'], ['notes', 'Ghi chú'], ['projects', 'Dự án']].map(([k, v]) => `<button type="button" class="${tab === k ? 'on' : ''}" data-act="archTab" data-tab="${k}">${v}</button>`).join('')}</div>
  <section class="glass card">
    ${rows.length ? rows.map(r => `<div class="list-row"><div class="t"><b>${esc(r.title)}</b><small>${esc(r.sub)}</small></div>
      <button type="button" class="btn ghost sm" data-act="restore" data-kind="${tab}" data-id="${r.id}">${icon('restore', 14)} Khôi phục</button>
      <button type="button" class="icon-btn plain" data-act="purgeOne" data-kind="${tab}" data-id="${r.id}" aria-label="Xóa vĩnh viễn">${icon('trash', 15)}</button></div>`).join('') : emptyState('Kho lưu trữ trống.')}
  </section>`;
};

/* =================== CÀI ĐẶT =================== */
let lastTests = null;
Views.settings = () => {
  const s = db.settings;
  const perm = ('Notification' in window) ? Notification.permission : 'unsupported';
  const permTxt = { granted: 'Đã bật ✓', denied: 'Đã bị chặn — mở lại trong cài đặt trình duyệt', default: 'Chưa bật', unsupported: 'Trình duyệt không hỗ trợ' }[perm];
  return `
  ${pageHead('Cài đặt', 'Hồ sơ, nhóm việc và dữ liệu.')}
  <div class="set-grid">
    <form class="glass card stack" data-submit="saveProfile">
      <h3>${icon('heart', 18)} Hồ sơ</h3>
      <label class="lbl">Tên đầy đủ<input class="field" name="name" value="${esc(s.name)}"></label>
      <label class="lbl">Tên gọi thân mật (hiện trên lời chào)<input class="field" name="nick" value="${esc(s.nick)}"></label>
      <label class="lbl">Ngân sách chi tiêu mỗi tháng<input class="field" name="budget" inputmode="numeric" data-input="money" value="${groupDigits(s.budget)}"></label>
      <div><button class="btn primary" type="submit">Lưu hồ sơ</button></div>
    </form>

    <section class="glass card stack">
      <h3>${icon('tasks', 18)} Nhóm việc</h3>
      <div id="cat-list">${db.categories.map(c => `<div class="cat-edit">
        <span class="dot" style="--c:${colorOf(c.color)};width:12px;height:12px"></span>
        <input class="field" value="${esc(c.name)}" data-change="catName" data-id="${c.id}" aria-label="Tên nhóm">
        <select class="field" data-change="catColor" data-id="${c.id}" aria-label="Màu">${Object.keys(COLORS).map(k => opt(k, COLOR_NAMES[k], c.color)).join('')}</select>
        <button type="button" class="icon-btn plain" data-act="delCat" data-id="${c.id}" aria-label="Xóa nhóm">${icon('trash', 15)}</button></div>`).join('')}</div>
      <form class="row" data-submit="addCat"><input class="field" name="name" placeholder="Tên nhóm mới" required autocomplete="off"><button class="btn ghost" type="submit">${icon('plus', 15)} Thêm</button></form>
    </section>

    <section class="glass card stack">
      <h3>${icon('bell', 18)} Thông báo</h3>
      <p class="muted small">Trạng thái: <b>${permTxt}</b>. Nhắc việc chỉ reo khi Vivian đang mở trong trình duyệt (có thể ở tab nền).</p>
      <div class="row"><button type="button" class="btn ghost" data-act="askNotify">Bật thông báo</button><button type="button" class="btn ghost" data-act="testChime">${icon('bell', 15)} Thử chuông</button></div>
    </section>

    ${cloudCard()}

    <section class="glass card stack">
      <h3>${icon('archive', 18)} Dữ liệu</h3>
      <p class="muted small">${Cloud.user ? 'Dữ liệu được lưu trong trình duyệt và tự sao lên đám mây.' : 'Mọi thứ đang lưu ngay trong trình duyệt này.'} Thỉnh thoảng xuất thêm một bản sao lưu cho chắc nhé.</p>
      <div class="row" style="flex-wrap:wrap">
        <button type="button" class="btn ghost" data-act="exportData">${icon('download', 15)} Xuất sao lưu</button>
        <label class="btn ghost">${icon('upload', 15)} Nhập sao lưu<input type="file" accept="application/json,.json" hidden data-change="importData"></label>
      </div>
      <div class="row" style="flex-wrap:wrap">
        <button type="button" class="btn ghost" data-act="seedData">Tạo lại dữ liệu mẫu</button>
        <button type="button" class="btn ghost danger-text" data-act="wipeData">Xóa sạch dữ liệu</button>
      </div>
    </section>

    <section class="glass card">
      <div class="card-head"><h3>${icon('check', 18)} Kiểm tra logic</h3><button type="button" class="btn ghost sm" data-act="runTests">Chạy kiểm tra</button></div>
      <p class="muted small">Đảm bảo 1 + 1 = 2, hôm nay là hôm nay, hôm qua là hôm nay − 1.</p>
      ${lastTests ? `<div class="test-list">${lastTests.map(r => `<div><span class="${r.ok ? 'ok' : 'bad'}">${r.ok ? '✓' : '✗'}</span>${esc(r.name)}${r.ok ? '' : ` — nhận <code>${esc(r.got)}</code>, cần <code>${esc(r.exp)}</code>`}</div>`).join('')}<div style="margin-top:6px"><b>${lastTests.filter(r => r.ok).length}/${lastTests.length}</b> phép thử đạt</div></div>` : ''}
    </section>
  </div>
  <p class="love">Vivian — một bầu trời nhỏ làm riêng cho ${esc(s.name)} ☁</p>`;
};

/* ---------- Thẻ đồng bộ đám mây (trang Cài đặt) ---------- */
function cloudCard() {
  if (!Cloud.configured()) return `<section class="glass card stack" id="cloud-card">
      <h3>${icon('cloud', 18)} Đồng bộ đám mây</h3>
      <p class="muted small">Chưa kết nối máy chủ. Điền <code>url</code> và <code>anonKey</code> của Supabase vào <code>js/config.js</code> để bật.</p></section>`;
  const u = Cloud.user;
  if (!u) return `<form class="glass card stack" id="cloud-card" data-submit="cloudSignIn">
      <h3>${icon('cloud', 18)} Đồng bộ đám mây</h3>
      <p class="muted small">Đăng nhập để dữ liệu tự đồng bộ giữa điện thoại và máy tính, đổi máy cũng không mất.</p>
      <label class="lbl">Email<input class="field" name="email" type="email" autocomplete="email" required></label>
      <label class="lbl">Mật khẩu<input class="field" name="password" type="password" autocomplete="current-password" minlength="6" required></label>
      <div class="row" style="flex-wrap:wrap">
        <button class="btn primary" type="submit">Đăng nhập</button>
        <button class="btn ghost" type="button" data-act="cloudSignUp">Tạo tài khoản</button>
        <button class="link-btn" type="button" data-act="cloudReset">Quên mật khẩu?</button>
      </div></form>`;
  const st = Cloud.status;
  const line = {
    syncing: 'Đang đồng bộ…',
    ok: `Đã đồng bộ lúc ${new Date(Cloud.lastAt).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}`,
    error: `Lỗi: ${esc(Cloud.error)}`,
    offline: 'Đang mất mạng — dữ liệu vẫn lưu trên máy, có mạng sẽ tự đồng bộ.',
  }[st] || '';
  return `<section class="glass card stack" id="cloud-card">
      <h3>${icon('cloud', 18)} Đồng bộ đám mây</h3>
      <p class="small">Đang đăng nhập: <b>${esc(u.email)}</b></p>
      <p class="muted small sync-line" data-state="${st}">${line}</p>
      <div class="row" style="flex-wrap:wrap">
        <button type="button" class="btn ghost" data-act="cloudSync">${icon('repeat', 15)} Đồng bộ ngay</button>
        <button type="button" class="btn ghost" data-act="cloudSignOut">Đăng xuất</button>
      </div></section>`;
}

/* ---------- Phép thử logic ---------- */
function runSelfTests() {
  const r = [], eq = (name, got, exp) => r.push({ name, ok: got === exp, got: String(got), exp: String(exp) });
  const t = today();
  eq('1 + 1 = 2', 1 + 1, 2);
  eq('Hôm nay khớp đồng hồ máy', t, ymd(new Date()));
  eq('Hôm qua = hôm nay − 1', diffDays(addDays(t, -1), t), 1);
  eq('Ngày mai − hôm qua = 2', diffDays(addDays(t, -1), addDays(t, 1)), 2);
  eq('Qua cuối tháng 31/1 → 1/2', addDays('2026-01-31', 1), '2026-02-01');
  eq('Năm nhuận 28/2/2028 → 29/2', addDays('2028-02-28', 1), '2028-02-29');
  eq('Năm thường 28/2/2026 → 1/3', addDays('2026-02-28', 1), '2026-03-01');
  eq('Qua năm mới 31/12 → 1/1', addDays('2026-12-31', 1), '2027-01-01');
  eq('1/11/2026 là Chủ Nhật', WD_LONG[weekdayIdx('2026-11-01')], 'Chủ Nhật');
  eq('Lịch T11/2026 bắt đầu từ 26/10', calendarStart(2026, 10), '2026-10-26');
  eq('Lặp mỗi tuần: T2 → T2 tuần sau', occursOn({ date: '2026-11-02', repeat: 'weekly' }, '2026-11-09'), true);
  eq('Lặp mỗi tuần: không rơi vào T3', occursOn({ date: '2026-11-02', repeat: 'weekly' }, '2026-11-10'), false);
  eq('Lặp tháng ngày 31 → 30/11', occursOn({ date: '2026-10-31', repeat: 'monthly' }, '2026-11-30'), true);
  eq('Lặp tháng ngày 31 → 28/2', occursOn({ date: '2026-01-31', repeat: 'monthly' }, '2026-02-28'), true);
  eq('Không lặp trước ngày bắt đầu', occursOn({ date: '2026-11-10', repeat: 'daily' }, '2026-11-09'), false);
  eq('Ngày thường bỏ qua Thứ Bảy', occursOn({ date: '2026-11-02', repeat: 'weekdays' }, '2026-11-21'), false);
  eq('Lặp năm: kỷ niệm 29/2 → 28/2 năm thường', occursOn({ date: '2028-02-29', repeat: 'yearly' }, '2029-02-28'), true);
  eq('Tháng sau của 12/2026 là 01/2027', addMonths('2026-12', 1), '2027-01');
  eq('Đọc tiền "1.500.000"', parseMoney('1.500.000'), 1500000);
  eq('Sự kiện 30/11 → 2/12 có mặt ngày 1/12', eventOccursOn({ date: '2026-11-30', endDate: '2026-12-02', repeat: 'none' }, '2026-12-01'), true);
  eq('Sự kiện 30/11 → 2/12 không có ngày 3/12', eventOccursOn({ date: '2026-11-30', endDate: '2026-12-02', repeat: 'none' }, '2026-12-03'), false);
  eq('Sự kiện lặp tuần rơi đúng thứ', eventOccursOn({ date: '2026-11-02', endDate: '', repeat: 'weekly' }, '2026-11-16'), true);
  eq('Việc lặp tick riêng từng ngày',isDone({ repeat: 'daily', doneDates: [t] }, addDays(t, -1)), false);
  return r;
}
