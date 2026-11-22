'use strict';
/* ============ Tiện ích ngày tháng (không dùng toISOString để tránh lệch múi giờ) ============ */
const pad = n => String(n).padStart(2, '0');
function ymd(d) { return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; }
function parseYmd(s) { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d); }
function today() { return ymd(new Date()); }
function addDays(s, n) { const d = parseYmd(s); d.setDate(d.getDate() + n); return ymd(d); }
function diffDays(a, b) {
  const A = parseYmd(a), B = parseYmd(b);
  return Math.round((Date.UTC(B.getFullYear(), B.getMonth(), B.getDate()) - Date.UTC(A.getFullYear(), A.getMonth(), A.getDate())) / 86400000);
}
function daysInMonth(y, m) { return new Date(y, m + 1, 0).getDate(); }
/** 0 = Thứ Hai … 6 = Chủ Nhật */
function weekdayIdx(s) { return (parseYmd(s).getDay() + 6) % 7; }
function calendarStart(y, m) { const f = new Date(y, m, 1); f.setDate(1 - (f.getDay() + 6) % 7); return ymd(f); }
function weekStart(s) { return addDays(s, -weekdayIdx(s)); }
function nowHM() { const d = new Date(); return pad(d.getHours()) + ':' + pad(d.getMinutes()); }
function ymOf(s) { return s.slice(0, 7); }
function addMonths(ym, n) { const [y, m] = ym.split('-').map(Number); const d = new Date(y, m - 1 + n, 1); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}`; }

const WD_LONG = ['Thứ Hai', 'Thứ Ba', 'Thứ Tư', 'Thứ Năm', 'Thứ Sáu', 'Thứ Bảy', 'Chủ Nhật'];
const WD_SHORT = ['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN'];

function fmtDM(s) { const d = parseYmd(s); return pad(d.getDate()) + '/' + pad(d.getMonth() + 1); }
function fmtLong(s) { const d = parseYmd(s); return `${WD_LONG[weekdayIdx(s)]}, ${d.getDate()} tháng ${d.getMonth() + 1}, ${d.getFullYear()}`; }
function fmtMonth(ym) { const [y, m] = ym.split('-').map(Number); return `Tháng ${m}, ${y}`; }
function relDay(s) {
  const n = diffDays(today(), s);
  if (n === 0) return 'Hôm nay';
  if (n === 1) return 'Ngày mai';
  if (n === -1) return 'Hôm qua';
  if (n > 1 && n < 7) return WD_LONG[weekdayIdx(s)];
  if (n < -1 && n > -7) return `${-n} ngày trước`;
  return fmtDM(s);
}

/* ============ Lặp lại ============ */
const REPEAT_LABEL = { none: 'Không lặp', daily: 'Mỗi ngày', weekdays: 'Ngày thường (T2–T6)', weekly: 'Mỗi tuần', monthly: 'Mỗi tháng', yearly: 'Mỗi năm' };
const REPEAT_SHORT = { none: '', daily: 'mỗi ngày', weekdays: 'T2–T6', weekly: 'mỗi tuần', monthly: 'mỗi tháng', yearly: 'mỗi năm' };
function isRepeat(x) { return !!x.repeat && x.repeat !== 'none'; }

/** Item (task/reminder) có diễn ra vào ngày d không — xét ngày bắt đầu & kiểu lặp */
function occursOn(item, d) {
  if (!item.date || d < item.date) return false;
  if (item.until && d > item.until) return false;
  const r = item.repeat || 'none';
  if (r === 'none') return d === item.date;
  if (r === 'daily') return true;
  if (r === 'weekdays') return weekdayIdx(d) < 5;
  if (r === 'weekly') return weekdayIdx(d) === weekdayIdx(item.date);
  const A = parseYmd(item.date), B = parseYmd(d);
  // ngày 31 lặp hằng tháng → rơi vào ngày cuối của tháng ngắn
  const want = Math.min(A.getDate(), daysInMonth(B.getFullYear(), B.getMonth()));
  if (r === 'monthly') return B.getDate() === want;
  if (r === 'yearly') return A.getMonth() === B.getMonth() && B.getDate() === want;
  return false;
}

/* ============ Linh tinh ============ */
function uid() { return Math.random().toString(36).slice(2, 9) + Date.now().toString(36).slice(-4); }
const ESC = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
function esc(s) { return String(s ?? '').replace(/[&<>"']/g, c => ESC[c]); }
function fmtMoney(n) { return (n < 0 ? '−' : '') + Math.abs(Math.round(n)).toLocaleString('vi-VN') + ' ₫'; }
function fmtMoneyShort(n) {
  const a = Math.abs(n);
  if (a >= 1e9) return (n / 1e9).toFixed(1).replace('.0', '') + ' tỷ';
  if (a >= 1e6) return (n / 1e6).toFixed(1).replace('.0', '') + ' tr';
  if (a >= 1e3) return Math.round(n / 1e3) + 'k';
  return String(n);
}
function parseMoney(s) { return Number(String(s).replace(/[^\d]/g, '')) || 0; }
function groupDigits(s) { const n = parseMoney(s); return n ? n.toLocaleString('vi-VN') : ''; }
function dayOfYear(d = new Date()) { return Math.floor((d - new Date(d.getFullYear(), 0, 0)) / 86400000); }
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];

/* ============ Icon (nét mảnh, kiểu Lucide) ============ */
const ICONS = {
  home: '<path d="M3 10.5 12 3l9 7.5"/><path d="M5 9.5V21h14V9.5"/><path d="M10 21v-6h4v6"/>',
  tasks: '<rect x="3" y="4" width="18" height="17" rx="4"/><path d="M3 9h18M8 2.5v3M16 2.5v3"/><path d="m8.5 14.5 2.5 2.5 4.5-5"/>',
  bell: '<path d="M6 8a6 6 0 1 1 12 0c0 7 3 9 3 9H3s3-2 3-9"/><path d="M10.3 21a1.94 1.94 0 0 0 3.4 0"/>',
  wallet: '<rect x="3" y="6" width="18" height="14" rx="3"/><path d="M3 10h18"/><path d="M7 6V5a2 2 0 0 1 2-2h8"/><circle cx="16.5" cy="15" r="1.2"/>',
  note: '<path d="M5 3h10l4 4v14H5z"/><path d="M15 3v4h4"/><path d="M9 12h6M9 16h4"/>',
  project: '<rect x="3" y="3" width="7.5" height="7.5" rx="2"/><rect x="13.5" y="3" width="7.5" height="7.5" rx="2"/><rect x="3" y="13.5" width="7.5" height="7.5" rx="2"/><path d="M17.25 14v6.5M14 17.25h6.5"/>',
  leaf: '<path d="M11 20A7 7 0 0 1 9.8 6.1C15.5 5 17 4.48 19 2c1 2 2 4.18 2 8 0 5.5-4.78 10-10 10Z"/><path d="M2 21c0-3 1.85-5.36 5.08-6C9.5 14.52 12 13 13 12"/>',
  palette: '<circle cx="13.5" cy="6.5" r=".8"/><circle cx="17.5" cy="10.5" r=".8"/><circle cx="8.5" cy="7.5" r=".8"/><circle cx="6.5" cy="12.5" r=".8"/><path d="M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10c.93 0 1.65-.75 1.65-1.69 0-.44-.18-.84-.44-1.13-.29-.29-.44-.65-.44-1.13a1.64 1.64 0 0 1 1.67-1.67h2c3.05 0 5.55-2.5 5.55-5.55C21.97 6.01 17.46 2 12 2z"/>',
  archive: '<rect x="3" y="4" width="18" height="5" rx="1.5"/><path d="M5 9v10a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V9"/><path d="M10 13h4"/>',
  settings: '<path d="M4 6h9M17 6h3M4 12h3M11 12h9M4 18h11M19 18h1"/><circle cx="15" cy="6" r="2"/><circle cx="9" cy="12" r="2"/><circle cx="17" cy="18" r="2"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  x: '<path d="M18 6 6 18M6 6l12 12"/>',
  check: '<path d="m5 12.5 4.5 4.5L19 7.5"/>',
  left: '<path d="m15 18-6-6 6-6"/>',
  right: '<path d="m9 18 6-6-6-6"/>',
  trash: '<path d="M3 6h18M8 6V4h8v2M6 6l1 14a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-14"/>',
  edit: '<path d="M12 20h9"/><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z"/>',
  repeat: '<path d="m17 2 4 4-4 4"/><path d="M3 11v-1a4 4 0 0 1 4-4h14"/><path d="m7 22-4-4 4-4"/><path d="M21 13v1a4 4 0 0 1-4 4H3"/>',
  clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  calendar: '<rect x="3" y="4" width="18" height="17" rx="3"/><path d="M3 9h18M8 2.5v3M16 2.5v3"/>',
  pin: '<path d="M12 17v5"/><path d="M9 10.76a2 2 0 0 1-1.11 1.79l-1.78.9A2 2 0 0 0 5 15.24V17h14v-1.76a2 2 0 0 0-1.11-1.79l-1.78-.9A2 2 0 0 1 15 10.76V7h1a2 2 0 0 0 0-4H8a2 2 0 0 0 0 4h1z"/>',
  play: '<path d="M7 4.5v15l12-7.5z"/>',
  pause: '<path d="M8 4v16M16 4v16"/>',
  reset: '<path d="M3 12a9 9 0 1 0 3-6.7L3 8"/><path d="M3 3v5h5"/>',
  search: '<circle cx="11" cy="11" r="7"/><path d="m21 21-4.3-4.3"/>',
  download: '<path d="M12 3v12M7 10l5 5 5-5"/><path d="M5 21h14"/>',
  upload: '<path d="M12 21V9M7 14l5-5 5 5"/><path d="M5 3h14"/>',
  alert: '<path d="M12 9v4M12 17h.01"/><path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z"/>',
  restore: '<path d="M3 12a9 9 0 1 0 3-6.7L3 8"/><path d="M3 3v5h5"/><path d="M12 8v4l3 2"/>',
  sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>',
  cloud: '<path d="M17.5 19a4.5 4.5 0 1 0-1.4-8.8A6 6 0 0 0 4.5 12 3.5 3.5 0 0 0 5 19z"/>',
  flag: '<path d="M4 22V4M4 4h13l-2 4 2 4H4"/>',
  heart: '<path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z"/>',
};
function icon(name, size = 18, sw = 1.8) {
  return `<svg class="ic" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="${sw}" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICONS[name] || ''}</svg>`;
}

/* hình đám mây dùng chung */
const CLOUD_PATH = 'M58 112C28 112 10 95 10 72c0-21 16-37 38-38C55 13 76 0 100 0c23 0 42 13 50 32 5-2 11-3 17-3 27 0 47 20 47 44 0 22-17 39-40 39z';
const CLOUD_SVG = `<svg viewBox="0 0 220 114" aria-hidden="true"><path d="${CLOUD_PATH}"/></svg>`;
const LOGO_SVG = `<svg viewBox="0 0 48 48" aria-hidden="true">
  <defs><linearGradient id="lg-v" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#8ec5ff"/><stop offset="1" stop-color="#f5b3cf"/></linearGradient></defs>
  <rect width="48" height="48" rx="15" fill="url(#lg-v)"/>
  <path fill="#fff" d="M15.5 34.5c-4.4 0-7.5-3-7.5-6.8 0-3.6 2.8-6.5 6.5-6.7C15.6 16.5 19.4 13 24 13s8.4 3.3 9.4 7.6h.6c3.8 0 6.8 3 6.8 6.9 0 3.9-3 7-6.9 7z"/>
  <path d="m19.5 21.5 4.5 8.5 4.5-8.5" fill="none" stroke="#7d93ff" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/>
</svg>`;
