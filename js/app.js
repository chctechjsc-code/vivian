'use strict';
/* ============ Khởi động, điều hướng, hành động ============ */
const now0 = new Date();
const ui = {
  view: 'dashboard', calY: now0.getFullYear(), calM: now0.getMonth(), calFilter: 'all',
  panelTab: 'board', expanded: {}, finYM: ymOf(today()), noteQ: '', archTab: 'tasks',
  lastDay: today(),
};
const NAV = [
  { id: 'dashboard', label: 'Tổng quan', icon: 'home' },
  { id: 'tasks', label: 'Công việc', icon: 'tasks' },
  { id: 'reminders', label: 'Nhắc việc', icon: 'bell' },
  { id: 'finance', label: 'Chi tiêu', icon: 'wallet' },
  { id: 'notes', label: 'Ghi chú', icon: 'note' },
  { id: 'projects', label: 'Dự án', icon: 'project' },
  { id: 'relax', label: 'Thư giãn', icon: 'leaf' },
  { id: 'theme', label: 'Màu & kính', icon: 'palette' },
];
const NAV2 = [{ id: 'archive', label: 'Lưu trữ', icon: 'archive' }, { id: 'settings', label: 'Cài đặt', icon: 'settings' }];

function navHtml(list) {
  const od = overdueTasks().length;
  const rem = db.reminders.filter(r => remIsLate(r)).length;
  return list.map(n => {
    let badge = '';
    if (n.id === 'tasks' && od) badge = `<span class="badge" title="${od} việc quá hạn">${od}</span>`;
    if (n.id === 'reminders' && rem) badge = `<span class="badge" title="${rem} nhắc đã đến giờ">${rem}</span>`;
    return `<a href="#/${n.id}" class="${ui.view === n.id ? 'on' : ''}">${icon(n.icon, 19)}<span>${n.label}</span>${badge}</a>`;
  }).join('');
}
function renderNav() { $('#nav').innerHTML = navHtml(NAV); $('#nav2').innerHTML = navHtml(NAV2); }

function render() {
  renderNav();
  const main = $('#main');
  const keep = main.scrollTop;
  main.dataset.view = ui.view;
  main.innerHTML = Views[ui.view]();
  main.scrollTop = keep;
  if (ui.view === 'relax') syncRelaxUI();
  if (ui.view === 'tasks') fitCells();
}
/** Ẩn bớt mục không vừa ô lịch, thay bằng nút "+n mục khác" */
function fitCells() {
  $$('.cell-items').forEach(box => {
    const kids = [...box.children].filter(k => !k.classList.contains('more'));
    kids.forEach(k => (k.style.display = ''));
    box.querySelector('.more')?.remove();
    if (box.scrollHeight <= box.clientHeight + 1) return;
    const more = document.createElement('button');
    more.type = 'button'; more.className = 'more'; more.dataset.act = 'openDay'; more.dataset.date = box.dataset.date;
    box.appendChild(more);
    let hidden = 0;
    for (let i = kids.length - 1; i >= 0 && box.scrollHeight > box.clientHeight + 1; i--) {
      kids[i].style.display = 'none'; hidden++;
      more.textContent = `+${hidden} mục khác`;
    }
  });
}
let fitTimer;
window.addEventListener('resize', () => { clearTimeout(fitTimer); fitTimer = setTimeout(() => ui.view === 'tasks' && fitCells(), 120); });
function rerender() { render(); refreshModal(); }
function route() {
  const v = location.hash.replace(/^#\/?/, '') || 'dashboard';
  const next = Views[v] ? v : 'dashboard';
  const changed = next !== ui.view;
  ui.view = next;
  render();
  if (changed) $('#main').scrollTop = 0;
}

/* ============ Bầu trời ============ */
function skyPhase() {
  const s = db.settings.sky;
  if (s !== 'auto' && SKIES[s]) return s;
  const h = new Date().getHours();
  if (h >= 5 && h < 8) return 'dawn';
  if (h >= 8 && h < 17) return 'day';
  if (h >= 17 && h < 19) return 'sunset';
  return 'night';
}
function applyTheme() {
  const s = db.settings, ph = skyPhase(), sk = SKIES[ph], r = document.documentElement;
  r.dataset.mode = sk.mode; r.dataset.sky = ph;
  r.style.setProperty('--sky-1', sk.g[0]); r.style.setProperty('--sky-2', sk.g[1]); r.style.setProperty('--sky-3', sk.g[2]);
  r.style.setProperty('--accent', s.accent);
  r.style.setProperty('--blur', s.blur + 'px');
  r.style.setProperty('--glass-a', sk.mode === 'dark' ? Math.min(.9, s.glass + .1) : s.glass);
  r.style.setProperty('--fs', s.scale);
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', sk.g[1]);
}
let cloudSig = '';
function buildClouds(force) {
  const n = db.settings.clouds ? db.settings.cloudCount : 0;
  const sig = String(n);
  if (sig === cloudSig && !force) return;
  cloudSig = sig;
  let h = '';
  for (let i = 0; i < n; i++) {
    const w = 150 + Math.random() * 340, dur = 70 + Math.random() * 110;
    h += `<div class="cloud" style="width:${w.toFixed(0)}px;top:${(Math.random() * 88 - 6).toFixed(1)}%;animation-duration:${dur.toFixed(0)}s;animation-delay:${(-Math.random() * dur).toFixed(0)}s;opacity:${(.35 + Math.random() * .55).toFixed(2)}">${CLOUD_SVG}</div>`;
  }
  $('#clouds').innerHTML = h;
}
function buildStars() {
  let h = '';
  for (let i = 0; i < 80; i++) h += `<i class="star-dot" style="left:${Math.random() * 100}%;top:${Math.random() * 70}%;animation-delay:${-Math.random() * 4}s;transform:scale(${.6 + Math.random() * 1.2})"></i>`;
  $('#stars').innerHTML = h;
}

/* ============ Modal: việc ============ */
function taskModal(task, preset = {}) {
  const isNew = !task;
  const t = task || { title: '', note: '', cat: preset.cat || (ui.calFilter !== 'all' ? ui.calFilter : db.categories[0]?.id), status: 'todo', date: preset.date ?? '', time: '', deadline: '', repeat: 'none', projectId: preset.projectId || '', priority: false };
  openModal({
    title: isNew ? 'Việc mới ☁' : 'Sửa việc',
    body: `
      <input class="field big" name="title" placeholder="Cần làm gì nè?" value="${esc(t.title)}" required autofocus autocomplete="off">
      <textarea class="field" name="note" rows="2" placeholder="Ghi chú thêm…">${esc(t.note)}</textarea>
      <div class="grid2">
        <label class="lbl">Nhóm<select class="field" name="cat">${catOptions(t.cat)}</select></label>
        <label class="lbl">Trạng thái<select class="field" name="status" ${isRepeat(t) ? 'disabled' : ''}>${STATUSES.map(s => opt(s.id, s.name, t.status)).join('')}</select></label>
        <label class="lbl">Ngày làm<input class="field" type="date" name="date" value="${t.date}"></label>
        <label class="lbl">Giờ<input class="field" type="time" name="time" value="${t.time}"></label>
        <label class="lbl">Hạn chót<input class="field" type="date" name="deadline" value="${t.deadline}"></label>
        <label class="lbl">Lặp lại<select class="field" name="repeat">${Object.entries(REPEAT_LABEL).map(([k, v]) => opt(k, v, t.repeat)).join('')}</select></label>
        <label class="lbl">Dự án<select class="field" name="projectId">${opt('', '— Không —', t.projectId)}${db.projects.filter(p => !p.archived).map(p => opt(p.id, p.name, t.projectId)).join('')}</select></label>
        <label class="check" style="align-self:end;padding-bottom:10px"><input type="checkbox" name="priority" ${t.priority ? 'checked' : ''}> ★ Quan trọng</label>
      </div>
      <p class="muted small" id="task-hint"></p>`,
    foot: `${isNew ? '' : `<button type="button" class="btn ghost danger-text" data-act="deleteTask" data-id="${t.id}">${icon('trash', 15)} Xóa</button><button type="button" class="btn ghost" data-act="archiveTask" data-id="${t.id}">${icon('archive', 15)} Cất</button>`}
      <span class="sp"></span><button type="button" class="btn ghost" data-act="closeModal">Hủy</button><button type="submit" class="btn primary">${isNew ? 'Thêm việc' : 'Lưu'}</button>`,
    onMount(form) {
      const hint = $('#task-hint', form);
      const upd = () => {
        const rep = form.repeat.value;
        form.status.disabled = rep !== 'none';
        hint.textContent = rep !== 'none' ? `Lặp ${REPEAT_LABEL[rep].toLowerCase()} kể từ ngày làm (${form.date.value ? fmtDM(form.date.value) : 'hôm nay'}). Mỗi lần tick chỉ đánh dấu đúng ngày đó.` : '';
      };
      form.repeat.addEventListener('change', upd); form.date.addEventListener('change', upd); upd();
    },
    onSubmit(fd) {
      const data = {
        title: (fd.get('title') || '').trim(), note: (fd.get('note') || '').trim(), cat: fd.get('cat'),
        date: fd.get('date') || '', time: fd.get('time') || '', deadline: fd.get('deadline') || '',
        repeat: fd.get('repeat'), projectId: fd.get('projectId') || '', priority: !!fd.get('priority'),
      };
      if (!data.title) { toast('Vân chưa nhập tên việc nè', { type: 'error' }); return false; }
      if (data.repeat !== 'none' && !data.date) data.date = today();
      if (data.deadline && data.date && data.deadline < data.date) { toast('Hạn chót đang trước ngày làm — kiểm tra lại nhé', { type: 'error' }); return false; }
      if (data.repeat === 'none') data.status = fd.get('status') || (task ? task.status : 'todo');
      if (isNew) {
        db.tasks.push({ id: uid(), ...data, status: data.status || 'todo', doneDates: [], archived: false, createdAt: Date.now(), doneAt: data.status === 'done' ? Date.now() : null });
        toast('Đã thêm việc ☁', { iconName: 'check' });
      } else {
        if (data.status === 'done' && task.status !== 'done') data.doneAt = Date.now();
        if (data.status && data.status !== 'done') data.doneAt = null;
        Object.assign(task, data);
      }
      save(); render();
    },
  });
}

/* ============ Modal: sự kiện ============ */
function eventModal(ev, preset = {}) {
  const isNew = !ev;
  const e = ev || { title: '', note: '', location: '', cat: ui.calFilter !== 'all' ? ui.calFilter : db.categories[0]?.id, date: preset.date || today(), endDate: '', allDay: false, start: '', end: '', repeat: 'none' };
  openModal({
    title: isNew ? 'Sự kiện mới ☁' : 'Sửa sự kiện',
    body: `
      <input class="field big" name="title" placeholder="Sự kiện gì nè?" value="${esc(e.title)}" required autofocus autocomplete="off">
      <input class="field" name="location" placeholder="Ở đâu? (tùy chọn)" value="${esc(e.location || '')}" autocomplete="off">
      <div class="grid2">
        <label class="lbl">Ngày<input class="field" type="date" name="date" value="${e.date}" required></label>
        <label class="lbl">Đến ngày<input class="field" type="date" name="endDate" value="${e.endDate || ''}"></label>
        <label class="check" style="grid-column:1/-1"><input type="checkbox" name="allDay" ${e.allDay ? 'checked' : ''}> Cả ngày</label>
        <label class="lbl ev-time">Bắt đầu<input class="field" type="time" name="start" value="${e.start || ''}"></label>
        <label class="lbl ev-time">Kết thúc<input class="field" type="time" name="end" value="${e.end || ''}"></label>
        <label class="lbl">Nhóm<select class="field" name="cat">${catOptions(e.cat)}</select></label>
        <label class="lbl">Lặp lại<select class="field" name="repeat">${Object.entries(REPEAT_LABEL).map(([k, v]) => opt(k, v, e.repeat)).join('')}</select></label>
      </div>
      <textarea class="field" name="note" rows="2" placeholder="Ghi chú thêm…">${esc(e.note || '')}</textarea>`,
    foot: `${isNew ? '' : `<button type="button" class="btn ghost danger-text" data-act="deleteEvent" data-id="${e.id}">${icon('trash', 15)} Xóa</button>`}
      <span class="sp"></span><button type="button" class="btn ghost" data-act="closeModal">Hủy</button><button type="submit" class="btn primary">${isNew ? 'Thêm sự kiện' : 'Lưu'}</button>`,
    onMount(form) {
      const upd = () => {
        form.querySelectorAll('.ev-time').forEach(x => (x.style.display = form.allDay.checked ? 'none' : ''));
        const rep = form.repeat.value !== 'none';
        form.endDate.disabled = rep; if (rep) form.endDate.value = '';
      };
      form.allDay.addEventListener('change', upd); form.repeat.addEventListener('change', upd); upd();
    },
    onSubmit(fd) {
      const allDay = !!fd.get('allDay');
      const data = {
        title: (fd.get('title') || '').trim(), location: (fd.get('location') || '').trim(), note: (fd.get('note') || '').trim(),
        cat: fd.get('cat'), date: fd.get('date') || '', endDate: fd.get('endDate') || '', repeat: fd.get('repeat') || 'none',
        allDay, start: allDay ? '' : fd.get('start') || '', end: allDay ? '' : fd.get('end') || '',
      };
      if (!data.title) { toast('Vân chưa nhập tên sự kiện nè', { type: 'error' }); return false; }
      if (!data.date) { toast('Chọn ngày cho sự kiện nhé', { type: 'error' }); return false; }
      if (data.repeat !== 'none' || data.endDate === data.date) data.endDate = '';
      if (data.endDate && data.endDate < data.date) { toast('“Đến ngày” đang trước ngày bắt đầu — kiểm tra lại nhé', { type: 'error' }); return false; }
      if (!data.start) data.end = '';
      if (data.start && data.end && !data.endDate && data.end < data.start) { toast('Giờ kết thúc đang trước giờ bắt đầu', { type: 'error' }); return false; }
      if (isNew) { db.events.push({ id: uid(), ...data, archived: false, createdAt: Date.now() }); toast('Đã thêm sự kiện ☁', { iconName: 'check' }); }
      else Object.assign(ev, data);
      save(); render();
    },
  });
}

/* ============ Modal: một ngày ============ */
function dayModal(d) {
  const items = dayItems(d, 'all', 'all');
  const body = items.length ? items.map(it => {
    if (it.kind === 'event') {
      const e = it.ev, c = colorOf(catOf(e.cat).color), tm = eventTime(e, d);
      const meta = [tm || 'Cả ngày', e.location && esc(e.location), isRepeat(e) && REPEAT_SHORT[e.repeat], esc(catOf(e.cat).name)].filter(Boolean).join(' · ');
      return `<div class="trow" data-act="editEvent" data-id="${e.id}"><span class="rem-ic" style="width:26px;height:26px;border-radius:8px;color:${c}">${icon('calendar', 14)}</span><div class="trow-main"><div class="trow-title">${esc(e.title)}</div><div class="trow-meta">${meta}</div></div></div>`;
    }
    return `<div class="trow" data-act="editRem" data-id="${it.rem.id}"><span class="rem-ic" style="width:26px;height:26px;border-radius:8px">${icon('bell', 14)}</span><div class="trow-main"><div class="trow-title">${esc(it.rem.title)}</div><div class="trow-meta">Nhắc lúc ${it.rem.time || '—'}${isRepeat(it.rem) ? ' · ' + REPEAT_SHORT[it.rem.repeat] : ''}</div></div></div>`;
  }).join('') : emptyState('Ngày này còn trống.');
  openModal({
    title: `${relDay(d) === fmtDM(d) ? '' : relDay(d) + ' · '}${fmtLong(d)}`,
    body: `<div>${body}</div>`,
    foot: `<button type="button" class="btn ghost" data-act="newRem" data-date="${d}">${icon('bell', 15)} Thêm nhắc</button><span class="sp"></span><button type="button" class="btn primary" data-act="newEvent" data-date="${d}">${icon('plus', 15)} Thêm sự kiện</button>`,
    refresh: () => dayModal(d),
  });
}

/* ============ Modal: nhắc việc ============ */
function remModal(r, preset = {}) {
  const isNew = !r;
  const x = r || { title: '', note: '', date: preset.date || today(), time: pad((new Date().getHours() + 1) % 24) + ':00', repeat: 'none' };
  openModal({
    title: isNew ? 'Nhắc mới' : 'Sửa nhắc việc', size: 'sm',
    body: `<input class="field big" name="title" value="${esc(x.title)}" placeholder="Nhắc điều gì?" required autofocus autocomplete="off">
      <div class="grid2"><label class="lbl">Ngày${isRepeat(x) ? ' bắt đầu' : ''}<input class="field" type="date" name="date" value="${x.date}" required></label><label class="lbl">Giờ<input class="field" type="time" name="time" value="${x.time}" required></label></div>
      <label class="lbl">Lặp lại<select class="field" name="repeat">${Object.entries(REPEAT_LABEL).map(([k, v]) => opt(k, v, x.repeat)).join('')}</select></label>
      <input class="field" name="note" value="${esc(x.note)}" placeholder="Ghi chú (tùy chọn)">`,
    foot: `${isNew ? '' : `<button type="button" class="btn ghost danger-text" data-act="delRem" data-id="${x.id}">${icon('trash', 15)} Xóa</button>`}<span class="sp"></span><button type="button" class="btn ghost" data-act="closeModal">Hủy</button><button type="submit" class="btn primary">Lưu</button>`,
    onSubmit(fd) {
      const data = { title: (fd.get('title') || '').trim(), date: fd.get('date'), time: fd.get('time'), repeat: fd.get('repeat'), note: (fd.get('note') || '').trim() };
      if (!data.title || !data.date) { toast('Thiếu tên hoặc ngày', { type: 'error' }); return false; }
      if (isNew) db.reminders.push({ id: uid(), ...data, done: false, lastFired: '', createdAt: Date.now() });
      else { if (data.date !== r.date || data.time !== r.time) r.lastFired = ''; Object.assign(r, data); }
      save(); render(); toast('Đã đặt nhắc ' + icon('bell', 14));
    },
  });
}

/* ============ Modal: ghi chú ============ */
function noteModal(n) {
  const isNew = !n;
  const x = n || { title: '', body: '', color: 'cloud', pinned: false };
  openModal({
    title: isNew ? 'Ghi chú mới' : 'Ghi chú',
    body: `<input class="field big" name="title" value="${esc(x.title)}" placeholder="Tiêu đề" autocomplete="off">
      <textarea class="field" name="body" rows="9" placeholder="Viết gì đó…" autofocus>${esc(x.body)}</textarea>
      <div class="row"><div class="swatches">${Object.entries(NOTE_COLORS).map(([k, c]) => `<label class="sw" style="--c:${c}" title="${k}"><input type="radio" name="color" value="${k}" ${x.color === k ? 'checked' : ''}></label>`).join('')}</div><span class="sp"></span><label class="check"><input type="checkbox" name="pinned" ${x.pinned ? 'checked' : ''}> Ghim lên đầu</label></div>`,
    foot: `${isNew ? '' : `<button type="button" class="btn ghost danger-text" data-act="delNote" data-id="${x.id}">${icon('trash', 15)} Xóa</button><button type="button" class="btn ghost" data-act="archiveNote" data-id="${x.id}">${icon('archive', 15)} Cất</button>`}<span class="sp"></span><button type="button" class="btn ghost" data-act="closeModal">Hủy</button><button type="submit" class="btn primary">Lưu</button>`,
    onSubmit(fd) {
      const data = { title: (fd.get('title') || '').trim(), body: (fd.get('body') || '').trim(), color: fd.get('color') || 'cloud', pinned: !!fd.get('pinned'), updatedAt: Date.now() };
      if (!data.title && !data.body) { toast('Ghi chú đang trống', { type: 'error' }); return false; }
      if (isNew) db.notes.push({ id: uid(), archived: false, ...data }); else Object.assign(n, data);
      save(); render();
    },
  });
}

/* ============ Modal: dự án ============ */
function projectModal(p) {
  const isNew = !p;
  const x = p || { name: '', desc: '', color: 'sky', deadline: '', milestones: [] };
  let ms = (x.milestones || []).map(m => ({ ...m }));
  openModal({
    title: isNew ? 'Dự án mới' : 'Dự án', size: 'lg',
    body: `<input class="field big" name="name" value="${esc(x.name)}" placeholder="Tên dự án" required autofocus autocomplete="off">
      <textarea class="field" name="desc" rows="2" placeholder="Mô tả ngắn">${esc(x.desc)}</textarea>
      <div class="grid2"><label class="lbl">Hạn chót<input class="field" type="date" name="deadline" value="${x.deadline}"></label>
      <div class="lbl">Màu<div class="swatches">${Object.keys(COLORS).map(k => `<label class="sw" style="--c:${COLORS[k]}" title="${COLOR_NAMES[k]}"><input type="radio" name="color" value="${k}" ${x.color === k ? 'checked' : ''}></label>`).join('')}</div></div></div>
      <div class="lbl">Các bước</div><div id="ms-list"></div>
      <div class="row"><input class="field" id="ms-new" placeholder="Thêm bước rồi nhấn Enter…" autocomplete="off"><button type="button" class="btn ghost" id="ms-add">${icon('plus', 15)}</button></div>
      ${!isNew ? `<div class="row"><button type="button" class="btn ghost sm" data-act="newTask" data-project="${x.id}">${icon('plus', 14)} Thêm việc vào dự án</button></div>` : ''}`,
    foot: `${isNew ? '' : `<button type="button" class="btn ghost danger-text" data-act="delProject" data-id="${x.id}">${icon('trash', 15)} Xóa</button><button type="button" class="btn ghost" data-act="archiveProject" data-id="${x.id}">${icon('archive', 15)} Cất</button>`}<span class="sp"></span><button type="button" class="btn ghost" data-act="closeModal">Hủy</button><button type="submit" class="btn primary">Lưu</button>`,
    onMount(form) {
      const list = $('#ms-list', form), inp = $('#ms-new', form);
      const draw = () => {
        list.innerHTML = ms.map((m, i) => `<div class="ms-edit ${m.done ? 'done' : ''}"><input type="checkbox" data-i="${i}" ${m.done ? 'checked' : ''} style="accent-color:var(--accent)"><input type="text" value="${esc(m.title)}" data-i="${i}"><button type="button" class="icon-btn plain" data-del="${i}" aria-label="Xóa bước">${icon('x', 14)}</button></div>`).join('') || '<p class="muted small">Chưa có bước nào.</p>';
      };
      list.addEventListener('change', e => { const i = e.target.dataset.i; if (i == null) return; if (e.target.type === 'checkbox') { ms[i].done = e.target.checked; draw(); } else ms[i].title = e.target.value; });
      list.addEventListener('click', e => { const b = e.target.closest('[data-del]'); if (b) { e.stopPropagation(); ms.splice(+b.dataset.del, 1); draw(); } });
      const add = () => { const v = inp.value.trim(); if (!v) return; ms.push({ id: uid(), title: v, done: false }); inp.value = ''; draw(); inp.focus(); };
      inp.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); add(); } });
      $('#ms-add', form).addEventListener('click', add);
      draw();
    },
    onSubmit(fd) {
      const pending = $('#ms-new')?.value.trim(); if (pending) ms.push({ id: uid(), title: pending, done: false });
      const data = { name: (fd.get('name') || '').trim(), desc: (fd.get('desc') || '').trim(), deadline: fd.get('deadline') || '', color: fd.get('color') || 'sky', milestones: ms.filter(m => m.title.trim()) };
      if (!data.name) { toast('Dự án cần có tên', { type: 'error' }); return false; }
      if (isNew) db.projects.push({ id: uid(), archived: false, createdAt: Date.now(), ...data }); else Object.assign(p, data);
      save(); render();
    },
  });
}

/* ============ Hành động (event delegation qua data-act) ============ */
function toggleTask(id, d) {
  const t = taskById(id); if (!t) return;
  let nowDone;
  if (isRepeat(t)) {
    const i = t.doneDates.indexOf(d);
    if (i >= 0) { t.doneDates.splice(i, 1); nowDone = false; } else { t.doneDates.push(d); nowDone = true; }
  } else {
    nowDone = t.status !== 'done';
    t.status = nowDone ? 'done' : 'todo';
    t.doneAt = nowDone ? Date.now() : null;
  }
  save(); rerender();
  if (nowDone) cheer();
}
function setSetting(key, val) { db.settings[key] = val; save(); applyTheme(); }

const ACT = {
  go: el => (location.hash = '#/' + el.dataset.view),
  closeModal: () => closeModal(),
  modalBack: (el, e) => { if (e.target === el) closeModal(); },

  newTask: el => taskModal(null, { date: el.dataset.date ?? (ui.view === 'dashboard' ? today() : ''), projectId: el.dataset.project }),
  editTask: el => { const t = taskById(el.dataset.id); t && taskModal(t); },
  toggleTask: el => toggleTask(el.dataset.id, el.dataset.date || today()),
  moveToday: el => { const t = taskById(el.dataset.id); if (!t) return; const td = today(); t.date = td; if (t.deadline && t.deadline < td) t.deadline = td; save(); render(); toast('Đã dời sang hôm nay'); },
  deleteTask: async el => {
    const t = taskById(el.dataset.id); if (!t) return;
    if (await confirmBox(`Xóa việc “${esc(t.title)}”? Không thể hoàn tác.`, { ok: 'Xóa', danger: true })) { db.tasks = db.tasks.filter(x => x !== t); save(); render(); toast('Đã xóa'); }
  },
  archiveTask: el => { const t = taskById(el.dataset.id); if (!t) return; t.archived = true; save(); closeModal(); render(); toast('Đã cất vào lưu trữ', { action: { label: 'Hoàn tác', fn: () => { t.archived = false; save(); render(); } } }); },
  archiveDone: () => { const list = db.tasks.filter(t => !t.archived && !isRepeat(t) && t.status === 'done'); list.forEach(t => t.archived = true); save(); render(); toast(`Đã cất ${list.length} việc`, { action: { label: 'Hoàn tác', fn: () => { list.forEach(t => t.archived = false); save(); render(); } } }); },
  openDay: el => dayModal(el.dataset.date),
  newEvent: el => eventModal(null, { date: el.dataset.date }),
  editEvent: el => { const e = eventById(el.dataset.id); e && eventModal(e); },
  deleteEvent: async el => {
    const e = eventById(el.dataset.id); if (!e) return;
    if (await confirmBox(`Xóa sự kiện “${esc(e.title)}”?`, { ok: 'Xóa', danger: true })) {
      db.events = db.events.filter(x => x !== e); save(); closeModal(); render();
      toast('Đã xóa sự kiện', { action: { label: 'Hoàn tác', fn: () => { db.events.push(e); save(); render(); } } });
    }
  },
  panelTab: el => { ui.panelTab = el.dataset.tab; render(); },
  expand: el => { ui.expanded[el.dataset.key] = !ui.expanded[el.dataset.key]; render(); },
  calFilter: el => { ui.calFilter = el.dataset.cat; render(); },
  calNav: el => { const d = new Date(ui.calY, ui.calM + Number(el.dataset.d), 1); ui.calY = d.getFullYear(); ui.calM = d.getMonth(); render(); },
  calToday: () => { const d = new Date(); ui.calY = d.getFullYear(); ui.calM = d.getMonth(); render(); },

  newRem: el => remModal(null, { date: el.dataset.date }),
  editRem: el => { const r = db.reminders.find(x => x.id === el.dataset.id); r && remModal(r); },
  remDone: el => { const r = db.reminders.find(x => x.id === el.dataset.id); if (!r) return; r.done = !r.done; save(); render(); if (r.done) cheer(); },
  delRem: async el => {
    const r = db.reminders.find(x => x.id === el.dataset.id); if (!r) return;
    if (await confirmBox(`Xóa nhắc “${esc(r.title)}”?`, { ok: 'Xóa', danger: true })) { db.reminders = db.reminders.filter(x => x !== r); save(); render(); }
  },
  clearDoneRem: () => { db.reminders = db.reminders.filter(r => !r.done); save(); render(); },
  askNotify: async () => {
    if (!('Notification' in window)) return toast('Trình duyệt không hỗ trợ thông báo', { type: 'error' });
    const p = await Notification.requestPermission();
    toast(p === 'granted' ? 'Đã bật thông báo 🔔' : 'Chưa được cấp quyền thông báo'); render();
  },
  testChime: () => Sound.chime(),

  finNav: el => { ui.finYM = addMonths(ui.finYM, Number(el.dataset.d)); render(); },
  delTx: el => {
    const x = db.transactions.find(t => t.id === el.dataset.id); if (!x) return;
    db.transactions = db.transactions.filter(t => t !== x); save(); render();
    toast('Đã xóa khoản ' + fmtMoney(x.amount), { action: { label: 'Hoàn tác', fn: () => { db.transactions.push(x); save(); render(); } } });
  },

  newNote: () => noteModal(null),
  editNote: el => { const n = db.notes.find(x => x.id === el.dataset.id); n && noteModal(n); },
  delNote: async el => { const n = db.notes.find(x => x.id === el.dataset.id); if (n && await confirmBox('Xóa ghi chú này?', { ok: 'Xóa', danger: true })) { db.notes = db.notes.filter(x => x !== n); save(); render(); } },
  archiveNote: el => { const n = db.notes.find(x => x.id === el.dataset.id); if (!n) return; n.archived = true; save(); closeModal(); render(); toast('Đã cất ghi chú'); },

  newProject: () => projectModal(null),
  editProject: el => { const p = db.projects.find(x => x.id === el.dataset.id); p && projectModal(p); },
  toggleMs: el => { const p = db.projects.find(x => x.id === el.dataset.pid); const m = p?.milestones.find(x => x.id === el.dataset.mid); if (!m) return; m.done = !m.done; save(); render(); if (m.done) cheer(); },
  delProject: async el => {
    const p = db.projects.find(x => x.id === el.dataset.id); if (!p) return;
    if (await confirmBox(`Xóa dự án “${esc(p.name)}”? Các việc liên kết vẫn được giữ lại.`, { ok: 'Xóa', danger: true })) { db.projects = db.projects.filter(x => x !== p); db.tasks.forEach(t => { if (t.projectId === p.id) t.projectId = ''; }); save(); render(); }
  },
  archiveProject: el => { const p = db.projects.find(x => x.id === el.dataset.id); if (!p) return; p.archived = true; save(); closeModal(); render(); toast('Đã cất dự án'); },

  habitToggle: el => { const h = db.habits.find(x => x.id === el.dataset.id); if (!h) return; const d = el.dataset.date; if (h.log[d]) delete h.log[d]; else { h.log[d] = true; if (d === today()) cheer(); } save(); render(); },
  delHabit: async el => { const h = db.habits.find(x => x.id === el.dataset.id); if (h && await confirmBox(`Xóa thói quen “${esc(h.name)}” và lịch sử của nó?`, { ok: 'Xóa', danger: true })) { db.habits = db.habits.filter(x => x !== h); save(); render(); } },
  sound: el => {
    const id = el.dataset.id, vol = (db.settings.soundVol[id] ?? 60) / 100;
    if (Sound.isOn(id)) Sound.stop(id); else Sound.start(id, vol);
    $('#snd-' + id)?.classList.toggle('on', Sound.isOn(id));
  },
  sleepTimer: el => { relax.sleepMin = Number(el.dataset.min); relax.sleepAt = relax.sleepMin ? Date.now() + relax.sleepMin * 60000 : 0; render(); },
  breath: () => { relax.breath ? stopBreath() : startBreath(); render(); },
  pomoMode: el => { const m = el.dataset.mode; relax.pomo = { mode: m, left: POMO_LEN[m], running: false, end: 0 }; render(); },
  pomoToggle: () => { const p = relax.pomo; if (p.running) { p.running = false; p.left = Math.max(0, Math.round((p.end - Date.now()) / 1000)); } else { p.running = true; p.end = Date.now() + p.left * 1000; } syncRelaxUI(); },
  pomoReset: () => { relax.pomo = { mode: relax.pomo.mode, left: POMO_LEN[relax.pomo.mode], running: false, end: 0 }; syncRelaxUI(); },

  setSky: el => { setSetting('sky', el.dataset.sky); render(); },
  setAccent: el => { setSetting('accent', el.dataset.c); render(); },
  resetTheme: () => { const d = defaultSettings(); ['sky', 'accent', 'blur', 'glass', 'clouds', 'cloudCount', 'scale'].forEach(k => db.settings[k] = d[k]); save(); applyTheme(); buildClouds(true); render(); },

  archTab: el => { ui.archTab = el.dataset.tab; render(); },
  restore: el => { const arr = { tasks: db.tasks, notes: db.notes, projects: db.projects }[el.dataset.kind]; const x = arr.find(i => i.id === el.dataset.id); if (x) { x.archived = false; save(); render(); toast('Đã khôi phục'); } },
  purgeOne: async el => { const k = el.dataset.kind; if (await confirmBox('Xóa vĩnh viễn mục này? Không thể hoàn tác.', { ok: 'Xóa vĩnh viễn', danger: true })) { db[k] = db[k].filter(i => i.id !== el.dataset.id); save(); render(); } },
  purgeArchive: async el => { const k = el.dataset.kind, n = db[k].filter(i => i.archived).length; if (await confirmBox(`Xóa vĩnh viễn ${n} mục đã lưu trữ? Không thể hoàn tác.`, { ok: 'Xóa vĩnh viễn', danger: true })) { db[k] = db[k].filter(i => !i.archived); save(); render(); } },

  delCat: async el => {
    if (db.categories.length <= 1) return toast('Cần giữ ít nhất một nhóm', { type: 'error' });
    const c = catOf(el.dataset.id), n = db.tasks.filter(t => t.cat === c.id).length;
    if (await confirmBox(`Xóa nhóm “${esc(c.name)}”?${n ? ` ${n} việc trong nhóm sẽ chuyển sang “${esc(db.categories.find(x => x.id !== c.id).name)}”.` : ''}`, { ok: 'Xóa', danger: true })) {
      db.categories = db.categories.filter(x => x.id !== c.id);
      db.tasks.forEach(t => { if (t.cat === c.id) t.cat = db.categories[0].id; });
      db.events.forEach(e => { if (e.cat === c.id) e.cat = db.categories[0].id; });
      if (ui.calFilter === c.id) ui.calFilter = 'all';
      save(); render();
    }
  },
  exportData: () => {
    const blob = new Blob([JSON.stringify(db, null, 2)], { type: 'application/json' });
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = `vivian-saoluu-${today()}.json`; a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  },
  seedData: async () => { if (await confirmBox('Thay toàn bộ dữ liệu hiện tại bằng dữ liệu mẫu?', { ok: 'Tạo mẫu', danger: true })) { const keep = db.settings; db = seedDB(); db.settings = keep; save(); render(); toast('Đã tạo dữ liệu mẫu'); } },
  wipeData: async () => { if (await confirmBox('Xóa sạch mọi việc, nhắc, chi tiêu, ghi chú, dự án và thói quen? Không thể hoàn tác — nên xuất sao lưu trước.', { ok: 'Xóa sạch', danger: true })) { const keep = db.settings, cats = db.categories; db = emptyDB(); db.settings = keep; db.categories = cats; save(); render(); toast('Đã xóa sạch — bầu trời mới tinh ☁'); } },
  runTests: () => { lastTests = runSelfTests(); render(); },
  cloudSignUp: async el => {
    const f = el.closest('form'); if (!f.reportValidity()) return;
    try {
      const needConfirm = await Cloud.signUp(f.email.value.trim(), f.password.value);
      if (needConfirm) toast('Đã gửi email xác nhận — mở hộp thư và bấm vào link nhé 💌', { timeout: 7000 });
      else toast('Tạo tài khoản xong ☁');
    } catch (e) { toast(authMsg(e), { type: 'error', timeout: 5000 }); }
  },
  cloudReset: async el => {
    const f = el.closest('form'), email = f.email.value.trim();
    if (!email) { f.email.focus(); return toast('Nhập email trước nhé', { type: 'error' }); }
    try { await Cloud.resetPassword(email); toast('Đã gửi email đặt lại mật khẩu 💌', { timeout: 6000 }); }
    catch (e) { toast(authMsg(e), { type: 'error', timeout: 5000 }); }
  },
  cloudSync: () => Cloud.sync().then(() => Cloud.status === 'ok' && toast('Đã đồng bộ ☁')),
  cloudSignOut: async () => {
    if (await confirmBox('Đăng xuất khỏi đồng bộ? Dữ liệu trên máy này vẫn giữ nguyên.', { ok: 'Đăng xuất' })) { await Cloud.signOut(); render(); }
  },
};

function authMsg(e) {
  const m = (e && e.message) || String(e);
  if (/Invalid login credentials/i.test(m)) return 'Sai email hoặc mật khẩu';
  if (/Email not confirmed/i.test(m)) return 'Email chưa xác nhận — mở hộp thư và bấm link xác nhận nhé';
  if (/already registered|already exists/i.test(m)) return 'Email này đã có tài khoản — bấm Đăng nhập';
  if (/Password should be at least/i.test(m)) return 'Mật khẩu cần ít nhất 6 ký tự';
  if (/rate limit|too many/i.test(m)) return 'Thử nhiều lần quá — đợi một lát rồi thử lại';
  if (/Failed to fetch|NetworkError/i.test(m)) return 'Không kết nối được máy chủ — kiểm tra mạng';
  if (/only request this after|security purposes/i.test(m)) return 'Vừa gửi email rồi — đợi khoảng 1 phút rồi bấm lại nhé';
  if (/should be different/i.test(m)) return 'Mật khẩu mới phải khác mật khẩu cũ';
  if (/session missing|not authenticated|JWT/i.test(m)) return 'Phiên đặt lại mật khẩu đã hết — bấm “Quên mật khẩu?” để nhận link mới';
  if (/sending.*email|send.*email|smtp/i.test(m)) return 'Máy chủ chưa gửi được email — xem lại cấu hình email của Supabase';
  return m;
}
function newPasswordModal() {
  openModal({
    title: 'Đặt mật khẩu mới', size: 'sm',
    body: `<p class="muted small">Đang đặt lại mật khẩu cho <b>${esc(Cloud.user?.email || '')}</b>.</p>
      <label class="lbl">Mật khẩu mới<input class="field" name="pw" type="password" minlength="6" autocomplete="new-password" required autofocus></label>
      <label class="lbl">Nhập lại mật khẩu mới<input class="field" name="pw2" type="password" minlength="6" autocomplete="new-password" required></label>`,
    foot: `<span class="sp"></span><button type="submit" class="btn primary">Lưu mật khẩu</button>`,
    onSubmit: fd => {
      const pw = fd.get('pw');
      if (!pw || pw.length < 6) { toast('Mật khẩu cần ít nhất 6 ký tự', { type: 'error' }); return false; }
      if (pw !== fd.get('pw2')) { toast('Hai mật khẩu chưa khớp nhau', { type: 'error' }); return false; }
      Cloud.updatePassword(pw).then(() => { toast('Đã đổi mật khẩu ✓ Lần sau đăng nhập bằng mật khẩu mới nhé', { timeout: 6000 }); render(); })
        .catch(e => { toast(authMsg(e), { type: 'error', timeout: 6000 }); if (!/session|JWT|authenticated/i.test(e?.message || '')) setTimeout(newPasswordModal, 400); });
    },
  });
}

const SUBMIT = {
  quickTask: f => { const v = f.title.value.trim(); if (!v) return; db.tasks.push({ id: uid(), title: v, note: '', cat: db.categories[0].id, status: 'todo', date: today(), time: '', deadline: '', repeat: 'none', doneDates: [], projectId: '', priority: false, archived: false, createdAt: Date.now(), doneAt: null }); save(); render(); $('.quick-add input')?.focus(); },
  quickRem: f => { const fd = new FormData(f); const title = fd.get('title').trim(); if (!title) return; db.reminders.push({ id: uid(), title, note: '', date: fd.get('date'), time: fd.get('time'), repeat: fd.get('repeat'), done: false, lastFired: '', createdAt: Date.now() }); save(); render(); toast('Đã đặt nhắc lúc ' + fd.get('time')); },
  addTx: f => {
    const fd = new FormData(f), amount = parseMoney(fd.get('amount'));
    if (!amount) return toast('Nhập số tiền nhé', { type: 'error' });
    const x = { id: uid(), type: fd.get('type'), amount, cat: fd.get('cat'), date: fd.get('date'), note: fd.get('note').trim(), createdAt: Date.now() };
    db.transactions.push(x); save();
    if (!x.date.startsWith(ui.finYM)) ui.finYM = ymOf(x.date);
    render(); toast(`${x.type === 'in' ? 'Thu' : 'Chi'} ${fmtMoney(amount)} ✓`);
    const s = db.settings, ym = ymOf(today());
    if (x.type === 'out' && s.budget) { const out = db.transactions.filter(t => t.type === 'out' && t.date.startsWith(ym)).reduce((a, b) => a + b.amount, 0); if (out > s.budget) toast('Tháng này đã vượt ngân sách rồi nè 🥲', { type: 'error' }); }
  },
  addHabit: f => { const fd = new FormData(f); const name = fd.get('name').trim(); if (!name) return; db.habits.push({ id: uid(), name, emo: fd.get('emo').trim() || '✨', color: fd.get('color'), log: {} }); save(); render(); },
  saveProfile: f => { const fd = new FormData(f); db.settings.name = fd.get('name').trim() || 'Thanh Vân'; db.settings.nick = fd.get('nick').trim() || 'Vân'; db.settings.budget = parseMoney(fd.get('budget')); save(); render(); toast('Đã lưu hồ sơ'); },
  cloudSignIn: async f => {
    const btn = f.querySelector('[type=submit]'); btn.disabled = true;
    try { await Cloud.signIn(f.email.value.trim(), f.password.value); toast('Đăng nhập thành công ☁'); render(); }
    catch (e) { toast(authMsg(e), { type: 'error', timeout: 5000 }); btn.disabled = false; }
  },
  addCat: f => { const name = f.name.value.trim(); if (!name) return; const keys = Object.keys(COLORS); db.categories.push({ id: uid(), name, color: keys[db.categories.length % keys.length] }); save(); render(); },
};

const INPUT = {
  money: el => { const pos = el.value.length - el.selectionStart; el.value = groupDigits(el.value); const p = Math.max(0, el.value.length - pos); el.setSelectionRange(p, p); },
  noteSearch: el => { ui.noteQ = el.value; $('#notes-grid').innerHTML = notesGrid(); },
  soundVol: el => { const v = Number(el.value); db.settings.soundVol[el.dataset.id] = v; Sound.setVol(el.dataset.id, v / 100); save(); },
  setting: el => {
    const k = el.dataset.key, v = Number(el.value);
    const val = k === 'glass' || k === 'scale' ? v / 100 : v;
    setSetting(k, val);
    const o = $('#out-' + k); if (o) o.textContent = v + ({ blur: 'px', glass: '%', scale: '%' }[k] || '');
    if (k === 'cloudCount') buildClouds();
  },
  accentPick: el => setSetting('accent', el.value),
};
const CHANGE = {
  calRem: el => { db.settings.calRem = el.checked; save(); render(); },
  cloudsOn: el => { db.settings.clouds = el.checked; save(); buildClouds(); },
  txType: el => { const list = el.value === 'in' ? INCOME_CATS : EXPENSE_CATS; $('#tx-cat').innerHTML = list.map(c => opt(c.id, c.emo + ' ' + c.name)).join(''); },
  catName: el => { const c = db.categories.find(x => x.id === el.dataset.id); if (c && el.value.trim()) { c.name = el.value.trim(); save(); renderNav(); } },
  catColor: el => { const c = db.categories.find(x => x.id === el.dataset.id); if (c) { c.color = el.value; save(); render(); } },
  importData: el => {
    const file = el.files[0]; if (!file) return;
    file.text().then(async txt => {
      let data; try { data = JSON.parse(txt); } catch (e) { return toast('File không hợp lệ', { type: 'error' }); }
      if (!data || !Array.isArray(data.tasks)) return toast('File này không phải bản sao lưu Vivian', { type: 'error' });
      if (await confirmBox('Thay dữ liệu hiện tại bằng bản sao lưu này?', { ok: 'Nhập', danger: true })) { db = migrate(data); saveNow(); applyTheme(); buildClouds(true); render(); toast('Đã nhập sao lưu ✓'); }
    });
  },
};

document.addEventListener('click', e => {
  const el = e.target.closest('[data-act]');
  if (!el) return;
  const fn = ACT[el.dataset.act];
  if (fn) { if (el.tagName === 'A') e.preventDefault(); fn(el, e); }
});
document.addEventListener('submit', e => { const fn = SUBMIT[e.target.dataset.submit]; if (fn) { e.preventDefault(); fn(e.target); } });
document.addEventListener('input', e => { const fn = INPUT[e.target.dataset.input]; fn && fn(e.target); });
document.addEventListener('change', e => { const fn = CHANGE[e.target.dataset.change]; fn && fn(e.target); });

/* ============ Kéo thả: việc sang trạng thái khác, sự kiện sang ngày khác ============ */
let dragOver = null, dragKind = '';
document.addEventListener('dragstart', e => {
  const el = e.target.closest && e.target.closest('[data-drag-task],[data-drag-event]'); if (!el) return;
  dragKind = el.dataset.dragEvent ? 'event' : 'task';
  const payload = dragKind === 'event' ? `ev:${el.dataset.dragEvent}:${el.dataset.from || ''}` : el.dataset.dragTask;
  e.dataTransfer.setData('text/plain', payload); e.dataTransfer.effectAllowed = 'move';
  el.classList.add('dragging'); document.body.classList.add('is-dragging');
});
const dropSel = () => dragKind === 'event' ? '[data-drop-date]' : '[data-drop-status]';
document.addEventListener('dragend', () => { $$('.dragging').forEach(x => x.classList.remove('dragging')); document.body.classList.remove('is-dragging'); dragOver && dragOver.classList.remove('over'); dragOver = null; });
document.addEventListener('dragover', e => {
  const z = e.target.closest && e.target.closest(dropSel()); if (!z) return;
  e.preventDefault();
  if (z !== dragOver) { dragOver && dragOver.classList.remove('over'); z.classList.add('over'); dragOver = z; }
});
document.addEventListener('drop', e => {
  const z = e.target.closest && e.target.closest('[data-drop-date],[data-drop-status]'); if (!z) return;
  e.preventDefault();
  const raw = e.dataTransfer.getData('text/plain');
  if (raw.startsWith('ev:')) {
    const [, id, from] = raw.split(':'), ev = eventById(id), d = z.dataset.dropDate;
    if (!ev || !d) return;
    const shift = diffDays(from || ev.date, d); if (!shift) return;
    ev.date = addDays(ev.date, shift);
    if (ev.endDate) ev.endDate = addDays(ev.endDate, shift);
    toast(`Đã dời “${esc(ev.title)}” sang ${relDay(ev.date).toLowerCase()} (${fmtDM(ev.date)})`);
    save(); render(); return;
  }
  const t = taskById(raw); if (!t) return;
  if (z.dataset.dropStatus && !isRepeat(t)) {
    const s = z.dataset.dropStatus; if (t.status === s) return;
    t.status = s; t.doneAt = s === 'done' ? Date.now() : null;
    if (s === 'done') cheer();
  }
  save(); render();
});

/* ============ Ghi nhanh ở thanh bên ============ */
function initQuick() {
  const ta = $('#quick-note');
  ta.value = db.quick || '';
  ta.addEventListener('input', () => { db.quick = ta.value; save(); });
  const commit = () => {
    const v = ta.value.trim(); if (!v) return;
    const [first, ...rest] = v.split('\n');
    db.notes.push({ id: uid(), title: rest.length ? first.trim() : '', body: rest.length ? rest.join('\n').trim() : first.trim(), color: 'cloud', pinned: false, archived: false, updatedAt: Date.now() });
    ta.value = ''; db.quick = ''; save();
    if (ui.view === 'notes') render();
    toast('Đã lưu vào Ghi chú', { action: { label: 'Xem', fn: () => (location.hash = '#/notes') } });
  };
  ta.addEventListener('keydown', e => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); commit(); } });
  $('#quick-save').addEventListener('click', commit);
}

/* ============ Hít thở & Pomodoro ============ */
const BREATH = [['Hít vào…', 4, 'in'], ['Giữ nhẹ…', 4, 'hold'], ['Thở ra…', 6, 'out']];
function startBreath() {
  relax.breath = true; let i = 0;
  const step = () => {
    if (!relax.breath) return;
    const [txt, sec, cls] = BREATH[i % 3];
    const el = $('#breath'), tx = $('#breath-txt');
    if (el) { el.className = 'breath-cloud ' + cls; el.style.transitionDuration = sec + 's'; }
    if (tx) tx.textContent = txt;
    i++; relax.breathTimer = setTimeout(step, sec * 1000);
  };
  setTimeout(step, 50);
}
function stopBreath() { relax.breath = false; clearTimeout(relax.breathTimer); }
const POMO_LEN = { focus: 25 * 60, short: 5 * 60, long: 15 * 60 };
function syncRelaxUI() {
  const p = relax.pomo;
  const tEl = $('#pomo-time'), b = $('#pomo-btn');
  if (tEl) tEl.textContent = pomoText();
  if (b) b.innerHTML = p.running ? icon('pause', 16) + ' Tạm dừng' : icon('play', 16) + ' Bắt đầu';
  const sl = $('#sleep-left');
  if (sl) sl.textContent = relax.sleepAt ? `Tự tắt sau ${Math.max(0, Math.ceil((relax.sleepAt - Date.now()) / 60000))} phút.` : '';
  if (relax.breath && ui.view === 'relax') { const tx = $('#breath-txt'); if (tx && tx.textContent === '…') tx.textContent = 'Hít vào…'; }
}
function tick() {
  const p = relax.pomo;
  if (p.running) {
    p.left = Math.max(0, Math.round((p.end - Date.now()) / 1000));
    if (p.left === 0) {
      p.running = false; Sound.chime();
      if (p.mode === 'focus') { const t = today(); db.focusLog[t] = (db.focusLog[t] || 0) + 1; save(); toast('Xong một phiên tập trung! Nghỉ chút nha ☁', { timeout: 6000 }); relax.pomo = { mode: 'short', left: POMO_LEN.short, running: false, end: 0 }; }
      else { toast('Hết giờ nghỉ, quay lại nào ✨', { timeout: 6000 }); relax.pomo = { mode: 'focus', left: POMO_LEN.focus, running: false, end: 0 }; }
      if (ui.view === 'relax') render();
    }
    document.title = `${pomoText()} · Vivian`;
  } else if (document.title !== 'Vivian · Bầu trời của Vân') document.title = 'Vivian · Bầu trời của Vân';
  if (relax.sleepAt && Date.now() >= relax.sleepAt) { relax.sleepAt = 0; relax.sleepMin = 0; Sound.stopAll(); toast('Đã tắt âm thanh, ngủ ngon nha 🌙'); if (ui.view === 'relax') render(); }
  if (ui.view === 'relax') syncRelaxUI();
}

/* ============ Chuông nhắc việc ============ */
function checkReminders() {
  const t = today(), hm = nowHM();
  let fired = false;
  db.reminders.forEach(r => {
    if (r.done || !occursOn(r, t)) return;
    if ((r.time || '00:00') <= hm && r.lastFired !== t) { r.lastFired = t; fired = true; fireReminder(r); }
  });
  if (fired) { save(); renderNav(); if (ui.view === 'reminders' || ui.view === 'dashboard') render(); }
}
function fireReminder(r) {
  Sound.chime();
  toast(`${esc(r.title)}${r.time ? ` <small style="opacity:.7">· ${r.time}</small>` : ''}`, {
    iconName: 'bell', timeout: 15000,
    action: isRepeat(r) ? null : { label: 'Xong', fn: () => { r.done = true; save(); render(); } },
  });
  if ('Notification' in window && Notification.permission === 'granted') {
    try { new Notification('Vivian nhắc Vân ☁', { body: r.title + (r.note ? '\n' + r.note : ''), tag: r.id + r.lastFired }); } catch (e) { /* bỏ qua */ }
  }
}

/* ============ Phím tắt ============ */
document.addEventListener('keydown', e => {
  if (e.key === 'Escape' && modalState) { closeModal(); return; }
  const typing = /INPUT|TEXTAREA|SELECT/.test(document.activeElement?.tagName) || document.activeElement?.isContentEditable;
  if (typing || modalState || e.ctrlKey || e.metaKey || e.altKey) return;
  if (e.key === 'n') { e.preventDefault(); taskModal(null, { date: ui.view === 'dashboard' ? today() : '' }); }
  if (e.key === 'e') { e.preventDefault(); eventModal(null); }
  if (e.key === 't' && ui.view === 'tasks') ACT.calToday();
  if (ui.view === 'tasks' && (e.key === 'ArrowLeft' || e.key === 'ArrowRight')) ACT.calNav({ dataset: { d: e.key === 'ArrowLeft' ? -1 : 1 } });
});

/* ============ Khởi động ============ */
function boot() {
  loadDB();
  $('#brand-mark').innerHTML = LOGO_SVG;
  applyTheme(); buildStars(); buildClouds(true);
  initQuick();
  route();
  window.addEventListener('hashchange', route);
  const results = runSelfTests(), bad = results.filter(r => !r.ok);
  console.info(`[Vivian] kiểm tra logic: ${results.length - bad.length}/${results.length} đạt`, bad.length ? bad : '');
  setInterval(tick, 1000);
  setInterval(() => {
    checkReminders();
    applyTheme();
    if (today() !== ui.lastDay) { ui.lastDay = today(); render(); } // qua nửa đêm
  }, 15000);
  setTimeout(checkReminders, 1500);
  Cloud.init();
}
boot();
