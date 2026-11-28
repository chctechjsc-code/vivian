'use strict';
/* ============ Đồng bộ đám mây (Supabase) ============
   Mỗi tài khoản có 1 dòng trong bảng vivian_docs chứa toàn bộ dữ liệu.
   - Máy vẫn lưu localStorage như cũ (dùng được khi mất mạng).
   - Mỗi lần sửa: sau ~1,5 giây đẩy lên mây.
   - Mở lại tab / mỗi 45 giây: hỏi mây có bản mới hơn không, có thì tải về.
   - Ghi có điều kiện (updated_at phải khớp bản đã biết) nên 2 máy không đè mất dữ liệu của nhau:
     nếu cả hai cùng sửa thì gộp lại (xem mergeDocs). */
const Cloud = (() => {
  const cfg = window.VIVIAN_CLOUD || {};
  const TABLE = 'vivian_docs';
  const META_KEY = 'vivian.sync';
  let sb = null, user = null, pushTimer = null, running = null, again = false;
  let rev = 0;               // tăng mỗi lần dữ liệu trên máy thay đổi
  let status = 'off';        // off | out | syncing | ok | error | offline
  let lastAt = 0, lastErr = '';
  let recovering = false, recoveryShown = false; // đang mở từ link "đặt lại mật khẩu" trong email

  const configured = () => !!(cfg.url && cfg.anonKey);
  const meta = () => { try { return JSON.parse(localStorage.getItem(META_KEY)) || {}; } catch (e) { return {}; } };
  const setMeta = m => { try { localStorage.setItem(META_KEY, JSON.stringify({ ...meta(), ...m })); } catch (e) {} };

  function setStatus(s, err = '') {
    status = s; lastErr = err;
    if (s === 'ok') lastAt = Date.now();
    paintBadge();
    if (typeof ui !== 'undefined' && ui.view === 'settings' && !modalOpen()) {
      const box = document.getElementById('cloud-card');
      if (box && !box.contains(document.activeElement) && typeof cloudCard === 'function') box.outerHTML = cloudCard();
    }
  }
  const modalOpen = () => !!document.querySelector('#modal-root > *');

  function paintBadge() {
    const el = document.getElementById('sync-badge'); if (!el) return;
    const txt = {
      off: '', out: 'Chưa đồng bộ', syncing: 'Đang đồng bộ…', ok: 'Đã đồng bộ',
      error: 'Lỗi đồng bộ', offline: 'Mất mạng — sẽ đồng bộ sau',
    }[status];
    el.hidden = status === 'off';
    el.dataset.state = status;
    el.title = lastErr || txt;
    el.querySelector('span').textContent = txt;
  }

  /* ---------- Khởi động ---------- */
  async function init() {
    if (!configured()) { setStatus('off'); return; }
    if (!window.supabase?.createClient) { setStatus('offline', 'Không tải được thư viện Supabase'); return; }
    // Đọc link email TRƯỚC khi thư viện xử lý và xóa nó khỏi thanh địa chỉ
    const hp = new URLSearchParams(location.hash.replace(/^#\/?/, '').replace(/^[^#]*#/, ''));
    const qp = new URLSearchParams(location.search);
    recovering = hp.get('type') === 'recovery' || qp.get('type') === 'recovery';
    const linkErr = hp.get('error_description') || qp.get('error_description');
    if (linkErr) setTimeout(() => showLinkError(linkErr, hp.get('error_code') || qp.get('error_code')), 400);
    sb = window.supabase.createClient(cfg.url, cfg.anonKey, {
      auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true, storageKey: 'vivian.auth' },
    });
    sb.auth.onAuthStateChange((ev, session) => {
      const u = session?.user || null;
      const changed = (u?.id || null) !== (user?.id || null);
      user = u;
      if (ev === 'PASSWORD_RECOVERY') recovering = true;
      if (!user) { setStatus('out'); return; }
      if (recovering) { showRecovery(); return; }   // đặt mật khẩu mới trước, đồng bộ sau
      if (changed) { cleanHash(); sync(); }
    });
    const { data } = await sb.auth.getSession();
    user = data.session?.user || null;
    if (!user) setStatus('out');
    else if (recovering) showRecovery();
    else sync();

    document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') sync(); else flush(); });
    window.addEventListener('online', () => sync());
    window.addEventListener('offline', () => user && setStatus('offline'));
    window.addEventListener('pagehide', flush);
    setInterval(() => { if (document.visibilityState === 'visible') sync(); }, 45000);
  }
  function showRecovery() {
    if (recoveryShown) return;
    recoveryShown = true;
    cleanHash(true);
    setStatus('ok');
    setTimeout(() => typeof newPasswordModal === 'function' && newPasswordModal(), 300);
  }
  function showLinkError(msg, code) {
    cleanHash(true);
    const expired = code === 'otp_expired' || /expired|invalid/i.test(msg);
    typeof toast === 'function' && toast(expired
      ? 'Link trong email đã hết hạn hoặc đã được dùng. Nhập email rồi bấm “Quên mật khẩu?” để nhận link mới (mở link trong vòng 1 giờ, chỉ bấm 1 lần).'
      : 'Link trong email không dùng được: ' + msg, { type: 'error', timeout: 12000 });
  }
  // Link trong email trả về dạng #access_token=… / #error=… → đưa về trang Cài đặt
  function cleanHash(force) {
    if (force) {
      history.replaceState(null, '', location.pathname + '#/settings');
      typeof route === 'function' && route();
      return;
    }
    if (/access_token|error_description|type=signup/.test(location.hash)) {
      history.replaceState(null, '', location.pathname + '#/settings');
      typeof route === 'function' && route();
    }
  }

  /* ---------- Gọi từ saveNow() khi dữ liệu trên máy thay đổi ---------- */
  function touched() {
    rev++;
    if (!sb) return;
    setMeta({ dirty: true });
    if (!user) return;
    clearTimeout(pushTimer);
    pushTimer = setTimeout(sync, 1500);
  }
  function flush() { if (user && meta().dirty) { clearTimeout(pushTimer); sync(); } }

  /* ---------- Đồng bộ: kéo về nếu mây mới hơn, đẩy lên nếu máy có thay đổi ---------- */
  function sync() {
    if (!sb || !user) return Promise.resolve();
    if (running) { again = true; return running; }
    running = doSync().finally(() => { running = null; if (again) { again = false; sync(); } });
    return running;
  }

  async function doSync() {
    if (!navigator.onLine) { setStatus('offline'); return; }
    clearTimeout(pushTimer);
    setStatus('syncing');
    try {
      const { data: row, error } = await sb.from(TABLE).select('data, updated_at').eq('user_id', user.id).maybeSingle();
      if (error) throw error;
      const m = meta(), mine = m.uid === user.id; // đọc SAU khi tải về, để không bỏ sót chỉnh sửa vừa xảy ra

      if (!row) { await push(null); return done(); }                 // tài khoản mới: đẩy dữ liệu máy này lên
      if (!mine) {                                                    // lần đầu đăng nhập tài khoản này trên máy này
        const keepLocal = m.dirty && await askFirstMerge();
        if (keepLocal) await push(row.updated_at); else applyRemote(row, 'Đã tải dữ liệu từ đám mây ☁');
        return done();
      }
      if (row.updated_at !== m.base) {                                // máy khác đã sửa
        if (!m.dirty) applyRemote(row, 'Đã cập nhật từ thiết bị khác ☁');
        else if (modalOpen()) { setTimeout(sync, 4000); return done(); }
        else {                                                        // cả hai cùng sửa → gộp lại rồi đẩy lên
          db = migrate(mergeDocs(db, row.data));
          try { localStorage.setItem(STORE_KEY, JSON.stringify(db)); } catch (e) {}
          refreshUI();
          await push(row.updated_at);
          typeof toast === 'function' && toast('Đã gộp thay đổi từ thiết bị khác ☁');
        }
        return done();
      }
      if (m.dirty) await push(m.base);
      done();
    } catch (e) {
      console.warn('[Vivian] đồng bộ lỗi', e);
      setStatus(navigator.onLine ? 'error' : 'offline', e.message || String(e));
    }
  }
  const done = () => setStatus('ok');

  async function push(base) {
    const startRev = rev, now = new Date().toISOString();
    db.updatedAt = db.updatedAt || Date.now();
    const q = base
      ? sb.from(TABLE).update({ data: db, updated_at: now }).eq('user_id', user.id).eq('updated_at', base).select('updated_at')
      : sb.from(TABLE).insert({ user_id: user.id, data: db, updated_at: now }).select('updated_at');
    const { data, error } = await q;
    if (error) {
      if (error.code === '23505') { setMeta({ uid: user.id, base: '__stale__' }); again = true; return; } // máy khác vừa tạo trước
      throw error;
    }
    if (!data?.length) { setMeta({ uid: user.id, base: '__stale__' }); again = true; return; }       // bị máy khác chen ngang
    setMeta({ uid: user.id, base: data[0].updated_at, dirty: rev !== startRev });
    if (rev !== startRev) again = true;
  }

  function applyRemote(row, msg) {
    if (modalOpen()) { again = false; setTimeout(sync, 4000); return; } // đang mở hộp thoại thì để lát nữa
    db = migrate(row.data);
    try { localStorage.setItem(STORE_KEY, JSON.stringify(db)); } catch (e) {}
    setMeta({ uid: user.id, base: row.updated_at, dirty: false });
    refreshUI();
    msg && typeof toast === 'function' && toast(msg);
  }
  function refreshUI() {
    const ta = document.getElementById('quick-note'); if (ta && document.activeElement !== ta) ta.value = db.quick || '';
    if (typeof applyTheme === 'function') { applyTheme(); buildClouds(true); render(); }
  }

  /* Gộp 2 bản khi cả hai máy cùng sửa: danh sách (việc, ghi chú, chi tiêu…) gộp theo id —
     mục có ở cả hai thì lấy theo bản sửa sau cùng; mục chỉ có ở một bên thì giữ lại.
     Giá trị đơn lẻ (cài đặt, ghi nhanh) lấy theo bản sửa sau cùng. */
  function mergeDocs(a, b) {
    const [older, newer] = (a.updatedAt || 0) > (b.updatedAt || 0) ? [b, a] : [a, b];
    const out = { ...older, ...newer };
    for (const k of Object.keys(out)) {
      const n = newer[k], o = older[k];
      if (Array.isArray(n) && Array.isArray(o) && n.concat(o).every(x => x && x.id)) {
        const ids = new Set(n.map(x => x.id));
        out[k] = [...n, ...o.filter(x => !ids.has(x.id))];
      } else if (n && o && typeof n === 'object' && typeof o === 'object' && !Array.isArray(n)) {
        out[k] = { ...o, ...n };
      }
    }
    out.updatedAt = Date.now();
    return out;
  }

  function askFirstMerge() {
    return confirmBox('Tài khoản này đã có dữ liệu trên đám mây, và máy này cũng có dữ liệu riêng. Giữ bản nào?<br><small class="muted">“Dùng bản trên mây” là an toàn nhất. Chọn giữ máy này sẽ ghi đè bản trên mây.</small>',
      { title: 'Đồng bộ lần đầu', ok: 'Giữ dữ liệu máy này', cancel: 'Dùng bản trên mây', danger: true });
  }

  /* ---------- Tài khoản ---------- */
  const redirect = () => location.origin + location.pathname;
  async function signIn(email, password) {
    const { error } = await sb.auth.signInWithPassword({ email, password });
    if (error) throw error;
  }
  async function signUp(email, password) {
    const { data, error } = await sb.auth.signUp({ email, password, options: { emailRedirectTo: redirect() } });
    if (error) throw error;
    return !data.session; // true = cần bấm link xác nhận trong email
  }
  async function resetPassword(email) {
    // redirectTo phải TRÙNG địa chỉ đã khai trong Supabase → Authentication → URL Configuration.
    // Không gắn thêm "#/settings": phần # sẽ va với mã đăng nhập Supabase gắn vào link.
    const { error } = await sb.auth.resetPasswordForEmail(email, { redirectTo: redirect() });
    if (error) throw error;
  }
  async function updatePassword(password) {
    const { error } = await sb.auth.updateUser({ password });
    if (error) throw error;
    recovering = false;
    sync();
  }
  async function signOut() {
    await flush();
    await sb.auth.signOut();
    setMeta({ uid: null, base: null });
    user = null; setStatus('out');
  }

  return {
    init, touched, sync, signIn, signUp, signOut, resetPassword, updatePassword,
    configured, mergeDocs, get recovering() { return recovering; }, get user() { return user; }, get status() { return status; }, get lastAt() { return lastAt; }, get error() { return lastErr; },
  };
})();
