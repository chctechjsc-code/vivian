'use strict';
/* ============ Âm thanh tạo bằng Web Audio — không cần file mp3 ============ */
const SOUND_DEFS = [
  { id: 'rain', name: 'Mưa rơi', emo: '🌧️', desc: 'mưa rì rào ngoài hiên' },
  { id: 'wind', name: 'Gió mây', emo: '🌬️', desc: 'gió thổi qua đồi' },
  { id: 'ocean', name: 'Sóng biển', emo: '🌊', desc: 'sóng vỗ chậm rãi' },
  { id: 'brown', name: 'Ồn nâu', emo: '🟤', desc: 'trầm ấm, dễ ngủ' },
  { id: 'white', name: 'Ồn trắng', emo: '⚪', desc: 'che tiếng ồn xung quanh' },
  { id: 'fire', name: 'Lửa bập bùng', emo: '🔥', desc: 'củi tí tách' },
];

const Sound = (() => {
  let ctx, master;
  const bufs = {};
  const live = {}; // id -> { out, nodes, timers }

  function ensure() {
    if (!ctx) {
      ctx = new (window.AudioContext || window.webkitAudioContext)();
      master = ctx.createGain(); master.gain.value = 0.9; master.connect(ctx.destination);
    }
    if (ctx.state === 'suspended') ctx.resume();
    return ctx;
  }
  function noise(type) {
    if (bufs[type]) return bufs[type];
    const len = ctx.sampleRate * 6, buf = ctx.createBuffer(2, len, ctx.sampleRate);
    for (let c = 0; c < 2; c++) {
      const data = buf.getChannelData(c);
      let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0, last = 0;
      for (let i = 0; i < len; i++) {
        const w = Math.random() * 2 - 1;
        if (type === 'white') data[i] = w * 0.5;
        else if (type === 'pink') {
          b0 = .99886 * b0 + w * .0555179; b1 = .99332 * b1 + w * .0750759; b2 = .969 * b2 + w * .153852;
          b3 = .8665 * b3 + w * .3104856; b4 = .55 * b4 + w * .5329522; b5 = -.7616 * b5 - w * .016898;
          data[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + w * .5362) * .11; b6 = w * .115926;
        } else { last = (last + .02 * w) / 1.02; data[i] = last * 3.5; }
      }
    }
    return (bufs[type] = buf);
  }
  function src(type) { const s = ctx.createBufferSource(); s.buffer = noise(type); s.loop = true; s.start(0, Math.random() * 5); return s; }
  function filt(type, freq, q = .7) { const f = ctx.createBiquadFilter(); f.type = type; f.frequency.value = freq; f.Q.value = q; return f; }
  function lfo(rate, depth, target) { const o = ctx.createOscillator(); o.frequency.value = rate; const g = ctx.createGain(); g.gain.value = depth; o.connect(g).connect(target); o.start(); return o; }

  const BUILD = {
    rain(out) {
      const s = src('pink'), hp = filt('highpass', 500), lp = filt('lowpass', 7000);
      const g = ctx.createGain(); g.gain.value = .9;
      s.connect(hp).connect(lp).connect(g).connect(out);
      const s2 = src('white'), bp = filt('bandpass', 3200, .6), g2 = ctx.createGain(); g2.gain.value = .12;
      s2.connect(bp).connect(g2).connect(out);
      return [s, s2];
    },
    wind(out) {
      const s = src('brown'), bp = filt('bandpass', 420, .9), g = ctx.createGain(); g.gain.value = .9;
      s.connect(bp).connect(g).connect(out);
      const o1 = lfo(.07, 260, bp.frequency), o2 = lfo(.11, .45, g.gain);
      return [s, o1, o2];
    },
    ocean(out) {
      const s = src('brown'), lp = filt('lowpass', 1100), g = ctx.createGain(); g.gain.value = .55;
      s.connect(lp).connect(g).connect(out);
      const o = lfo(.085, .5, g.gain), o2 = lfo(.085, 500, lp.frequency);
      return [s, o, o2];
    },
    brown(out) { const s = src('brown'), lp = filt('lowpass', 700), g = ctx.createGain(); g.gain.value = 1; s.connect(lp).connect(g).connect(out); return [s]; },
    white(out) { const s = src('white'), lp = filt('lowpass', 2200), g = ctx.createGain(); g.gain.value = .55; s.connect(lp).connect(g).connect(out); return [s]; },
    fire(out, entry) {
      const s = src('brown'), lp = filt('lowpass', 500), g = ctx.createGain(); g.gain.value = .7;
      s.connect(lp).connect(g).connect(out);
      const crackle = () => {
        if (!live.fire) return;
        const t = ctx.currentTime, b = ctx.createBufferSource(); b.buffer = noise('white');
        const hp = filt('highpass', 1800 + Math.random() * 2500), eg = ctx.createGain();
        eg.gain.setValueAtTime(0, t); eg.gain.linearRampToValueAtTime(.25 + Math.random() * .5, t + .004); eg.gain.exponentialRampToValueAtTime(.001, t + .03 + Math.random() * .06);
        b.connect(hp).connect(eg).connect(out); b.start(t, Math.random() * 5); b.stop(t + .12);
        entry.timers.push(setTimeout(crackle, 40 + Math.random() * 380));
      };
      entry.timers.push(setTimeout(crackle, 200));
      return [s];
    },
  };

  function start(id, vol = .6) {
    ensure();
    if (live[id]) return;
    const out = ctx.createGain(); out.gain.value = 0; out.connect(master);
    const entry = { out, nodes: [], timers: [] };
    live[id] = entry;
    entry.nodes = BUILD[id](out, entry);
    out.gain.linearRampToValueAtTime(vol, ctx.currentTime + 1.2);
  }
  function stop(id) {
    const e = live[id]; if (!e) return;
    delete live[id];
    e.timers.forEach(clearTimeout);
    e.out.gain.cancelScheduledValues(ctx.currentTime);
    e.out.gain.setValueAtTime(e.out.gain.value, ctx.currentTime);
    e.out.gain.linearRampToValueAtTime(0, ctx.currentTime + .8);
    setTimeout(() => { e.nodes.forEach(n => { try { n.stop(); } catch (_) {} }); e.out.disconnect(); }, 900);
  }
  function setVol(id, v) { const e = live[id]; if (e) e.out.gain.setTargetAtTime(v, ctx.currentTime, .1); }
  function isOn(id) { return !!live[id]; }
  function stopAll() { Object.keys(live).forEach(stop); }
  function anyOn() { return Object.keys(live).length > 0; }

  /** tiếng chuông nhẹ khi nhắc việc / hết pomodoro */
  function chime() {
    try {
      ensure();
      const t = ctx.currentTime;
      [[880, 0], [1318.5, .16], [1760, .32]].forEach(([f, dt]) => {
        const o = ctx.createOscillator(), g = ctx.createGain();
        o.type = 'sine'; o.frequency.value = f;
        g.gain.setValueAtTime(0, t + dt); g.gain.linearRampToValueAtTime(.22, t + dt + .02); g.gain.exponentialRampToValueAtTime(.001, t + dt + 1.4);
        o.connect(g).connect(master); o.start(t + dt); o.stop(t + dt + 1.5);
      });
    } catch (e) { /* trình duyệt chặn âm thanh khi chưa tương tác */ }
  }
  return { start, stop, setVol, isOn, stopAll, anyOn, chime };
})();
