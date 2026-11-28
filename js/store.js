'use strict';
/* ============ Dữ liệu: lưu trong localStorage của trình duyệt ============ */
const STORE_KEY = 'vivian.v1';

const COLORS = {
  sky: '#5b8def', rose: '#e5678f', lavender: '#9479e6', mint: '#33a98c',
  sun: '#e99a33', storm: '#34405e', peach: '#ee8466', teal: '#3a9bb5',
};
const COLOR_NAMES = { sky: 'Xanh trời', rose: 'Hồng', lavender: 'Oải hương', mint: 'Bạc hà', sun: 'Nắng', storm: 'Mây giông', peach: 'Đào', teal: 'Biển' };
const NOTE_COLORS = { cloud: '#ffffff', sky: '#dcebff', rose: '#ffe2eb', lavender: '#ece5ff', mint: '#dcf4ea', sun: '#fff0d4' };
const STATUSES = [
  { id: 'todo', name: 'Cần làm', color: '#34405e' },
  { id: 'doing', name: 'Đang làm', color: '#e5678f' },
  { id: 'done', name: 'Đã xong', color: '#5b8def' },
];
const EXPENSE_CATS = [
  { id: 'food', name: 'Ăn uống', emo: '🍜', color: 'peach' },
  { id: 'shop', name: 'Mua sắm', emo: '🛍️', color: 'rose' },
  { id: 'move', name: 'Đi lại', emo: '🛵', color: 'teal' },
  { id: 'beauty', name: 'Làm đẹp', emo: '💄', color: 'lavender' },
  { id: 'bill', name: 'Hóa đơn', emo: '🧾', color: 'storm' },
  { id: 'fun', name: 'Giải trí', emo: '🎬', color: 'sky' },
  { id: 'gift', name: 'Quà tặng', emo: '🎁', color: 'sun' },
  { id: 'other', name: 'Khác', emo: '☁️', color: 'mint' },
];
const INCOME_CATS = [
  { id: 'salary', name: 'Lương', emo: '💼', color: 'mint' },
  { id: 'bonus', name: 'Thưởng', emo: '✨', color: 'sun' },
  { id: 'side', name: 'Thu nhập thêm', emo: '🌱', color: 'teal' },
  { id: 'other-in', name: 'Khác', emo: '☁️', color: 'sky' },
];
const txCat = (type, id) => (type === 'in' ? INCOME_CATS : EXPENSE_CATS).find(c => c.id === id) || { name: 'Khác', emo: '☁️', color: 'mint' };

function defaultSettings() {
  return {
    name: 'Thanh Vân', nick: 'Vân',
    sky: 'auto', accent: '#6c8cff', blur: 18, glass: 0.55,
    clouds: true, cloudCount: 10, scale: 1,
    budget: 8000000, calRem: true, soundVol: {},
  };
}
function defaultCats() {
  return [
    { id: 'work', name: 'Công việc', color: 'storm' },
    { id: 'study', name: 'Học tập', color: 'lavender' },
    { id: 'self', name: 'Bản thân', color: 'sky' },
    { id: 'health', name: 'Sức khỏe', color: 'mint' },
    { id: 'home', name: 'Nhà cửa', color: 'sun' },
    { id: 'love', name: 'Hai đứa mình', color: 'rose' },
  ];
}
function emptyDB() {
  return {
    version: 1, settings: defaultSettings(), categories: defaultCats(),
    tasks: [], events: [], reminders: [], transactions: [], notes: [], projects: [], habits: [], focusLog: {}, alerted: {}, quick: '',
  };
}

let db;
function loadDB() {
  try {
    const raw = localStorage.getItem(STORE_KEY);
    if (raw) { db = migrate(JSON.parse(raw)); return; }
  } catch (e) { console.warn('Không đọc được dữ liệu cũ', e); }
  db = seedDB();
  saveNow(true); // dữ liệu mẫu: không tính là "đã sửa" để máy mới đăng nhập sẽ lấy bản trên mây
}
function migrate(d) {
  const base = emptyDB();
  const out = { ...base, ...d, settings: { ...base.settings, ...(d.settings || {}) } };
  out.tasks.forEach(t => { t.doneDates = t.doneDates || []; t.repeat = t.repeat || 'none'; if (t.remind == null) t.remind = ''; });
  out.events.forEach(e => { if (e.remind == null) e.remind = ''; });
  out.alerted = out.alerted || {};
  return out;
}
let saveTimer;
function save() { clearTimeout(saveTimer); saveTimer = setTimeout(saveNow, 120); }
function saveNow(silent = false) {
  clearTimeout(saveTimer);
  if (!silent) db.updatedAt = Date.now();
  try {
    localStorage.setItem(STORE_KEY, JSON.stringify(db));
    if (!silent && typeof Cloud !== 'undefined') Cloud.touched();
  }
  catch (e) { typeof toast === 'function' && toast('Không lưu được dữ liệu (bộ nhớ trình duyệt đầy?)', { type: 'error' }); }
}

/* ============ Truy vấn ============ */
const catOf = id => db.categories.find(c => c.id === id) || { id: '', name: 'Khác', color: 'storm' };
const colorOf = name => COLORS[name] || name || COLORS.storm;
const taskById = id => db.tasks.find(t => t.id === id);
const activeTasks = () => db.tasks.filter(t => !t.archived);

function isDone(t, d = today()) {
  return isRepeat(t) ? (t.doneDates || []).includes(d) : t.status === 'done';
}
function tasksOn(d) {
  return activeTasks().filter(t => occursOn(t, d)).map(t => ({ task: t, done: isDone(t, d) }));
}
/** Hạn chót rơi vào ngày d nhưng việc làm vào ngày khác */
function dueOn(d) {
  return activeTasks().filter(t => !isRepeat(t) && t.deadline === d && t.date !== d && t.status !== 'done');
}
function dueKey(t) { return t.deadline || t.date || ''; }
function overdueTasks() {
  const t = today();
  return activeTasks()
    .filter(x => !isRepeat(x) && x.status !== 'done' && dueKey(x) && dueKey(x) < t)
    .sort((a, b) => dueKey(a).localeCompare(dueKey(b)));
}
/* Sự kiện (lịch): có thể kéo dài nhiều ngày (date → endDate) hoặc lặp lại */
const eventById = id => db.events.find(e => e.id === id);
function eventOccursOn(e, d) {
  if (isRepeat(e)) return occursOn(e, d);
  return !!e.date && d >= e.date && d <= (e.endDate && e.endDate > e.date ? e.endDate : e.date);
}
function eventsOn(d) { return db.events.filter(e => !e.archived && eventOccursOn(e, d)); }
/** Giờ hiển thị của sự kiện trong ngày d ('' = cả ngày) */
function eventTime(e, d) {
  if (e.allDay || !e.start) return '';
  if (!isRepeat(e) && e.endDate && e.endDate > e.date && d !== e.date) return '';
  return e.start + (e.end ? '–' + e.end : '');
}

/** Mọi thứ hiển thị trong 1 ô lịch (sự kiện + nhắc), đã sắp xếp */
function dayItems(d, filter = 'all', withRem = true) {
  const items = [];
  const ok = x => filter === 'all' || x.cat === filter;
  eventsOn(d).forEach(ev => ok(ev) && items.push({ kind: 'event', ev, rank: eventTime(ev, d) ? 1 : 0, time: eventTime(ev, d) ? ev.start : '00' }));
  // nhắc hằng ngày / ngày thường lặp quá dày nên không vẽ lên lịch
  if (withRem) db.reminders.filter(r => !r.done && (withRem === 'all' || (r.repeat !== 'daily' && r.repeat !== 'weekdays')) && occursOn(r, d)).forEach(r => items.push({ kind: 'rem', rem: r, rank: 1, time: r.time || '99' }));
  return items.sort((a, b) => a.rank - b.rank || a.time.localeCompare(b.time));
}
function doneTodayCount() {
  const t = today();
  return db.tasks.filter(x => isRepeat(x) ? (x.doneDates || []).includes(t) : (x.status === 'done' && x.doneAt && ymd(new Date(x.doneAt)) === t)).length;
}

/* ============ Chuông "Nhắc tôi" gắn vào việc / sự kiện ============
   remind = '' (không nhắc) hoặc số phút báo trước (0 = đúng giờ).
   Việc/sự kiện không có giờ (hoặc cả ngày) thì coi như 08:00 sáng hôm đó. */
const REMIND_OPTS = [['', 'Không nhắc'], ['0', 'Đúng giờ'], ['5', 'Trước 5 phút'], ['15', 'Trước 15 phút'], ['30', 'Trước 30 phút'], ['60', 'Trước 1 giờ'], ['1440', 'Trước 1 ngày']];
const DEFAULT_HM = '08:00';
const hasRemind = x => x.remind !== '' && x.remind != null;
function remindShort(m) {
  m = Number(m);
  if (!m) return 'đúng giờ';
  if (m >= 1440) return `trước ${m / 1440} ngày`;
  if (m >= 60) return `trước ${m / 60} giờ`;
  return `trước ${m} phút`;
}
const atMs = (d, hm) => { const [h, m] = (hm || DEFAULT_HM).split(':').map(Number); const x = parseYmd(d); x.setHours(h, m, 0, 0); return x.getTime(); };
/** Các lần chuông của việc / sự kiện reo trong khoảng [fromMs, toMs) */
function itemAlerts(fromMs, toMs) {
  const out = [];
  const push = (kind, item, d, hm) => {
    const at = atMs(d, hm) - Number(item.remind) * 60000;
    if (at >= fromMs && at < toMs) out.push({ key: `${item.id}@${d}`, kind, item, date: d, hm: hm || '', at });
  };
  // chuông "trước 1 ngày" reo hôm nay cho việc của ngày mai → quét dư 1–2 ngày
  for (let d = ymd(new Date(fromMs)), last = addDays(ymd(new Date(toMs)), 2); d <= last; d = addDays(d, 1)) {
    activeTasks().forEach(t => { if (hasRemind(t) && occursOn(t, d) && !isDone(t, d)) push('task', t, d, t.time); });
    db.events.forEach(e => {
      if (e.archived || !hasRemind(e)) return;
      if (isRepeat(e) ? !occursOn(e, d) : e.date !== d) return;
      push('event', e, d, e.allDay ? '' : e.start);
    });
  }
  return out.sort((a, b) => a.at - b.at);
}
/** Mọi chuông (nhắc nhanh + việc + sự kiện) trong khoảng, để hiện danh sách */
function bellsBetween(fromMs, toMs) {
  const list = itemAlerts(fromMs, toMs);
  for (let d = ymd(new Date(fromMs)), last = ymd(new Date(toMs)); d <= last; d = addDays(d, 1)) {
    db.reminders.forEach(r => {
      if (r.done || !occursOn(r, d)) return;
      const at = atMs(d, r.time || '00:00');
      if (at >= fromMs && at < toMs) list.push({ key: `${r.id}@${d}`, kind: 'rem', item: r, date: d, hm: r.time || '', at });
    });
  }
  return list.sort((a, b) => a.at - b.at);
}

/* Nhắc nhanh */
function nextOcc(r) {
  if (!isRepeat(r)) return r.date;
  const t = today(), hm = nowHM();
  for (let i = 0; i < 400; i++) {
    const d = addDays(t, i);
    if (occursOn(r, d)) {
      if (i === 0 && (r.time || '00:00') < hm) continue;
      return d;
    }
  }
  return null;
}
function remIsLate(r) {
  if (r.done || isRepeat(r)) return false;
  const t = today();
  return r.date < t || (r.date === t && (r.time || '00:00') <= nowHM());
}

/* Thói quen */
function habitStreak(h) {
  let d = today(), n = 0;
  if (!h.log[d]) d = addDays(d, -1);
  while (h.log[d]) { n++; d = addDays(d, -1); }
  return n;
}

/* ============ Dữ liệu mẫu (tính theo hôm nay để luôn "sống") ============ */
function seedDB() {
  const d = emptyDB();
  const t = today();
  const D = n => addDays(t, n);
  const T = (title, cat, date, extra = {}) => ({
    id: uid(), title, note: '', cat, status: 'todo', date, time: '', deadline: '', repeat: 'none', remind: '',
    doneDates: [], projectId: '', priority: false, archived: false, createdAt: Date.now(), doneAt: null, ...extra,
  });
  const p1 = { id: uid(), name: 'Đà Lạt cuối năm', desc: 'Chuyến đi săn mây của hai đứa ☁', color: 'rose', deadline: D(24), archived: false, createdAt: Date.now(),
    milestones: [
      { id: uid(), title: 'Chốt ngày đi', done: true }, { id: uid(), title: 'Đặt homestay view đồi', done: true },
      { id: uid(), title: 'Mua vé xe giường nằm', done: false }, { id: uid(), title: 'Lên lịch trình săn mây', done: false },
      { id: uid(), title: 'Soạn đồ ấm', done: false },
    ] };
  const p2 = { id: uid(), name: 'Học tiếng Hàn sơ cấp', desc: 'Mỗi ngày một chút, xong 15 bài trước Tết.', color: 'lavender', deadline: D(60), archived: false, createdAt: Date.now(),
    milestones: [
      { id: uid(), title: 'Bảng chữ cái Hangul', done: true }, { id: uid(), title: 'Bài 1–5', done: true },
      { id: uid(), title: 'Bài 6–10', done: false }, { id: uid(), title: 'Bài 11–15', done: false },
    ] };
  const p3 = { id: uid(), name: 'Góc làm việc mới', desc: 'Dọn lại bàn, thêm cây và đèn vàng.', color: 'sun', deadline: D(12), archived: false, createdAt: Date.now(),
    milestones: [{ id: uid(), title: 'Chọn kệ sách', done: false }, { id: uid(), title: 'Mua đèn bàn', done: true }, { id: uid(), title: 'Sắp xếp dây điện', done: false }] };
  d.projects = [p1, p2, p3];

  d.tasks = [
    T('Gửi báo cáo tuần', 'work', D(0), { time: '10:00', priority: true, remind: 30 }),
    T('Họp nhóm dự án', 'work', D(0), { time: '14:30', status: 'doing' }),
    T('Uống đủ 2 lít nước', 'health', D(-20), { repeat: 'daily' }),
    T('Học 10 từ tiếng Hàn', 'study', D(-14), { repeat: 'daily', projectId: p2.id }),
    T('Tưới cây ban công', 'home', D(-6), { repeat: 'weekly' }),
    T('Yoga buổi tối', 'health', D(-12), { repeat: 'weekdays', time: '20:00' }),
    T('Hoàn thiện slide thuyết trình', 'work', D(-2), { deadline: D(-1) }),
    T('Trả sách thư viện', 'self', D(-3)),
    T('Mua vé xe đi Đà Lạt', 'love', D(1), { deadline: D(3), projectId: p1.id, priority: true }),
    T('Lên lịch trình săn mây', 'love', D(4), { projectId: p1.id }),
    T('Gọi điện cho mẹ', 'self', D(1), { time: '19:30', remind: 0 }),
    T('Dọn tủ quần áo', 'home', D(2)),
    T('Đặt lịch khám răng', 'health', D(3), { time: '09:00' }),
    T('Nộp bài tập tiếng Hàn', 'study', D(5), { deadline: D(6), projectId: p2.id }),
    T('Sinh nhật bạn Linh – mua quà', 'self', D(6), { deadline: D(8) }),
    T('Review hợp đồng đối tác', 'work', D(7), { deadline: D(9) }),
    T('Tổng kết chi tiêu tháng', 'self', D(9)),
    T('Chọn kệ sách', 'home', D(10), { projectId: p3.id }),
    T('Đọc xong "Nhà giả kim"', 'self', '', { status: 'doing' }),
    T('Lên ý tưởng quà kỷ niệm', 'love', ''),
    T('Học khóa Figma cơ bản', 'study', '', { deadline: D(14) }),
    T('Làm hồ sơ thuế', 'work', D(-5), { status: 'done', doneAt: Date.now() - 4 * 864e5 }),
    T('Đi siêu thị cuối tuần', 'home', D(-1), { status: 'done', doneAt: Date.now() - 864e5 }),
    T('Mua đèn bàn', 'home', D(-4), { status: 'done', projectId: p3.id, doneAt: Date.now() - 3 * 864e5 }),
  ];
  // vài việc lặp đã tick những ngày trước
  d.tasks[2].doneDates = [D(-1), D(-2), D(-3), D(-5)];
  d.tasks[3].doneDates = [D(-1), D(-2), D(-4)];

  const E = (title, cat, date, extra = {}) => ({
    id: uid(), title, note: '', location: '', cat, date, endDate: '', allDay: false, start: '', end: '', remind: '',
    repeat: 'none', archived: false, createdAt: Date.now(), ...extra,
  });
  d.events = [
    E('Họp nhóm dự án', 'work', D(0), { start: '14:30', end: '15:30', location: 'Phòng họp tầng 3', remind: 15 }),
    E('Cà phê với Linh', 'self', D(2), { start: '17:00', end: '18:30', location: 'The Coffee House' }),
    E('Khám răng', 'health', D(3), { start: '09:00', end: '10:00', location: 'Nha khoa Kim', remind: 60 }),
    E('Sinh nhật bạn Linh 🎂', 'self', D(8), { allDay: true, remind: 1440 }),
    E('Lớp tiếng Hàn', 'study', D(-12), { start: '19:00', end: '20:30', repeat: 'weekly' }),
    E('Đà Lạt săn mây ☁', 'love', D(20), { endDate: D(23), allDay: true, location: 'Đà Lạt' }),
    E('Hội thảo thiết kế', 'work', D(12), { start: '08:30', end: '11:30', location: 'GEM Center' }),
  ];

  const hm = nowHM();
  const R = (title, date, time, repeat = 'none', note = '') => ({ id: uid(), title, note, date, time, repeat, done: false, lastFired: (date === t && time <= hm) || date < t ? t : '' , createdAt: Date.now() });
  d.reminders = [
    R('Uống thuốc vitamin', D(-10), '08:00', 'daily'),
    R('Đứng dậy vươn vai', D(-10), '15:00', 'weekdays'),
    R('Thanh toán tiền điện', D(2), '09:00'),
    R('Gia hạn gói Spotify', D(5), '10:00', 'monthly'),
    R('Kỷ niệm ngày quen nhau 💗', D(11), '00:00', 'yearly', 'Đặt bàn nhà hàng trước 1 tuần'),
    R('Đi ngủ sớm nha', D(-10), '23:00', 'daily'),
  ];

  const ym = ymOf(t);
  const dayInMonth = n => { const x = `${ym}-${pad(Math.min(n, parseYmd(t).getDate()))}`; return x; };
  const X = (type, amount, cat, date, note) => ({ id: uid(), type, amount, cat, date, note, createdAt: Date.now() });
  d.transactions = [
    X('in', 15000000, 'salary', dayInMonth(1), 'Lương tháng'),
    X('in', 1200000, 'side', dayInMonth(8), 'Viết bài freelance'),
    X('out', 2500000, 'bill', dayInMonth(2), 'Tiền nhà'),
    X('out', 65000, 'food', dayInMonth(3), 'Bún bò sáng'),
    X('out', 450000, 'shop', dayInMonth(5), 'Áo len mới'),
    X('out', 120000, 'move', dayInMonth(6), 'Đổ xăng'),
    X('out', 320000, 'beauty', dayInMonth(9), 'Kem dưỡng'),
    X('out', 180000, 'fun', dayInMonth(12), 'Xem phim'),
    X('out', 95000, 'food', dayInMonth(15), 'Trà sữa với hội bạn'),
    X('out', 540000, 'food', dayInMonth(18), 'Đi chợ cả tuần'),
    X('out', 350000, 'gift', dayInMonth(20), 'Quà sinh nhật'),
    X('out', 55000, 'food', t, 'Cà phê sáng'),
  ];

  d.notes = [
    { id: uid(), title: 'Danh sách phim muốn xem', body: '• Your Name\n• Spirited Away\n• Little Forest\n• Before Sunrise', color: 'sky', pinned: true, archived: false, updatedAt: Date.now() - 3e6 },
    { id: uid(), title: 'Ý tưởng góc làm việc', body: 'Đèn vàng ấm, cây lưỡi hổ, kệ gỗ sáng màu. Dây điện gom vào máng.', color: 'sun', pinned: false, archived: false, updatedAt: Date.now() - 9e6 },
    { id: uid(), title: 'Câu thích hôm nay', body: 'Mây không vội, gió không vội, mình cũng không cần vội.', color: 'rose', pinned: false, archived: false, updatedAt: Date.now() - 2e7 },
    { id: uid(), title: 'Đồ mang đi Đà Lạt', body: 'Áo khoác dày, khăn len, son dưỡng, sạc dự phòng, máy ảnh film.', color: 'lavender', pinned: false, archived: false, updatedAt: Date.now() - 4e7 },
  ];

  const log = n => { const o = {}; for (let i = 1; i <= n; i++) if (Math.random() > .25) o[D(-i)] = true; return o; };
  d.habits = [
    { id: uid(), name: 'Uống nước', emo: '💧', color: 'sky', log: log(10) },
    { id: uid(), name: 'Đọc sách 20 phút', emo: '📖', color: 'lavender', log: log(10) },
    { id: uid(), name: 'Thiền 5 phút', emo: '🧘', color: 'mint', log: log(10) },
    { id: uid(), name: 'Ngủ trước 23h', emo: '🌙', color: 'storm', log: log(10) },
  ];
  return d;
}
