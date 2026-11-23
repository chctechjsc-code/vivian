'use strict';
/* ============ Modal, xác nhận, toast ============ */
let modalState = null;

function openModal({ title, body, foot = '', size = '', onSubmit, onMount, onClose, refresh }) {
  closeModal(true);
  const root = $('#modal-root');
  root.innerHTML = `
    <div class="modal-back" data-act="modalBack">
      <div class="modal glass ${size}" role="dialog" aria-modal="true" aria-label="${esc(title)}">
        <div class="modal-head"><h3>${title}</h3><button type="button" class="icon-btn plain" data-act="closeModal" aria-label="Đóng">${icon('x')}</button></div>
        <form class="modal-body" id="modal-form" novalidate>${body}${foot ? `<div class="modal-foot">${foot}</div>` : ''}</form>
      </div>
    </div>`;
  const form = $('#modal-form');
  modalState = { onClose, refresh };
  form.addEventListener('submit', e => {
    e.preventDefault();
    if (!onSubmit) return;
    const res = onSubmit(new FormData(form), form);
    if (res !== false) { modalState && (modalState.onClose = null); closeModal(true); }
  });
  onMount && onMount(form);
  setTimeout(() => { const f = form.querySelector('[autofocus]'); f && f.focus(); }, 40);
}
function closeModal(silent = false) {
  const st = modalState;
  modalState = null;
  $('#modal-root').innerHTML = '';
  if (!silent && st && st.onClose) st.onClose();
}
function refreshModal() { modalState && modalState.refresh && modalState.refresh(); }

function confirmBox(msg, { ok = 'Đồng ý', cancel = 'Hủy', danger = false, title = 'Xác nhận' } = {}) {
  return new Promise(resolve => {
    let done = false;
    openModal({
      title, size: 'sm',
      body: `<p class="confirm-msg">${msg}</p>`,
      foot: `<span class="sp"></span><button type="button" class="btn ghost" data-act="closeModal">${cancel}</button><button type="submit" class="btn ${danger ? 'danger' : 'primary'}" autofocus>${ok}</button>`,
      onSubmit: () => { done = true; resolve(true); },
      onClose: () => { if (!done) resolve(false); },
    });
  });
}

function toast(msg, { type = '', action, timeout = 3200, iconName } = {}) {
  const wrap = $('#toasts');
  const el = document.createElement('div');
  el.className = 'toast ' + type;
  el.innerHTML = `${iconName ? icon(iconName, 18) : ''}<span>${msg}</span>${action ? `<button type="button">${esc(action.label)}</button>` : ''}`;
  wrap.appendChild(el);
  const kill = () => { el.classList.add('out'); setTimeout(() => el.remove(), 260); };
  if (action) el.querySelector('button').onclick = () => { action.fn(); kill(); };
  setTimeout(kill, timeout);
  return el;
}

const CHEERS = ['Xong rồi! Thêm một đám mây ☁', 'Giỏi quá Vân ơi ✨', 'Nhẹ tênh như mây luôn ☁', 'Một việc nhỏ, một niềm vui nhỏ 💗', 'Tick! Bầu trời sáng thêm chút nữa ☀'];
function cheer() { toast(CHEERS[Math.floor(Math.random() * CHEERS.length)], { iconName: 'cloud' }); }

function emptyState(text) {
  return `<div class="empty"><div class="mini-cloud">${CLOUD_SVG}</div>${text}</div>`;
}
function opt(value, label, sel) { return `<option value="${esc(value)}" ${String(value) === String(sel) ? 'selected' : ''}>${esc(label)}</option>`; }
