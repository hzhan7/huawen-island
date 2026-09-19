/* =====================================================================
 * 华文小岛 2.0 · 🥁 绕口令节拍（parts/45_beat.js）  speak · twisters
 * 音乐节奏游戏：绕口令的每个字（头上带拼音）踩着鼓点从右往左一跳一跳地来到左边的“鼓圈”，
 * 字落进圈的一刹那，一边读、一边敲鼓（点屏幕 / 空格 / F J）→ 完美 / 不错 / 错过。
 *
 * 计分设计（SPEC_ARCADE §4-5）：
 *   · 每个字单独判定：命中 → 连击 +1、加分、粒子、字飞上歌词牌；错过 → 断连击、字掉下去。
 *   · 每一小句（按标点切，超过 10 字再按“不拆词”切开）= 1 个回合：本句命中率 ≥ 门槛 → g.right(绕口令)；
 *     否则 g.wrong(绕口令, 本局没跟上的句子（原句 + 拼音 + 敲中几个）+ 提示) 扣 1 心。心没了 = 失败；唱完 = 通关。
 *   · 防狂点：字还差一点才进圈就敲 =“太早了”，这个字算错过（连点每 0.1 秒一下必定先落进这一区）。
 *   · 触屏延迟自适应（lag）；暂停 / 切后台回来先数 3·2·1 再走；两根手指轮流敲也认（自己挂 pointerdown）。
 *   · 关卡 = 速度：BPM 随关卡上升（慢 → 中 → 快 → 超快），判定窗口变窄、过句门槛变高；
 *     短绕口令两首连唱。开局“卷轴”展示全文，有中文朗读时按本关语速示范（点鼓可跳过）。
 * 音乐：引擎背景音乐的 BPM 固定、拿不到节拍相位，没法和音符对齐，所以本游戏自带一个小合成器，
 *   鼓点 / 贝斯 / 五声旋律与音符共用同一个“歌曲时钟”（songT）；声音开关与引擎同源。
 * ===================================================================== */
(function () {
  'use strict';
  const W = window;
  const HW = W.HW;
  if (!HW || typeof HW.register !== 'function') return;

  const TAU = Math.PI * 2, NAVY = '#1d2b53';
  const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
  const frac = (x) => x - Math.floor(x);
  const isHan = (ch) => /[㐀-鿿豈-﫿]/.test(ch);
  const BRK = '，。！？；：、,.!?;:…—';
  const SENT = /[。！？!?；;]/;
  const NOTE_COL = ['#FF5A5F', '#3AA0FF', '#B25CFF', '#22B573', '#FF8A3D'];
  const now = () => (W.performance && performance.now ? performance.now() : Date.now());

  /* ---------- 声音开关：与引擎同一来源 ---------- */
  let sndC = true, sndAt = -1e9;
  function soundOn() {
    const t = now();
    if (t - sndAt < 300) return sndC;
    sndAt = t;
    let v = true;
    try {
      if (typeof HW.soundOn === 'function') v = !!HW.soundOn();
      else if (typeof HW.sound === 'boolean') v = HW.sound;
      else if (HW.settings && typeof HW.settings.sound === 'boolean') v = HW.settings.sound;
      else {
        const s = W.localStorage.getItem('hw.v1.settings');
        if (s) { const o = JSON.parse(s); if (o && o.sound === false) v = false; }
      }
    } catch (e) { v = true; }
    sndC = v;
    return v;
  }

  /* ================= 小合成器（与音符同一时钟） ================= */
  const PENTA = [0, 2, 4, 7, 9];
  const mtof = (m) => 440 * Math.pow(2, (m - 69) / 12);
  const deg = (d) => 72 + Math.floor(d / 5) * 12 + PENTA[((d % 5) + 5) % 5];
  const ROOTS = [48, 45, 41, 43];
  const MEL = [
    [[0, -1, 2, -1, 4, -1, 2, -1], [5, -1, 4, -1, 2, -1, -1, -1], [3, -1, 2, -1, 0, -1, 2, -1], [1, -1, 2, -1, 4, 3, 2, -1]],
    [[4, -1, 5, 4, 2, -1, 4, -1], [5, -1, 7, -1, 6, -1, 5, -1], [4, -1, 2, -1, 3, -1, 4, -1], [2, -1, 1, -1, 0, -1, -1, -1]]
  ];
  function makeSynth() {
    const S = { ac: null, master: null, mus: null, fx: null, nz: null, dead: false, on: true, chk: 0 };
    function tone(t, f0, f1, dur, vol, type, dest, lp) {
      const ac = S.ac; if (!ac || !dest) return;
      try {
        const o = ac.createOscillator(), gn = ac.createGain();
        o.type = type || 'sine';
        o.frequency.setValueAtTime(Math.max(20, f0), t);
        if (f1 && f1 !== f0) o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur * 0.85);
        gn.gain.setValueAtTime(0.0001, t);
        gn.gain.exponentialRampToValueAtTime(Math.max(0.0002, vol), t + 0.005);
        gn.gain.exponentialRampToValueAtTime(0.0001, t + dur);
        let node = o;
        if (lp) { const f = ac.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = lp; o.connect(f); node = f; }
        node.connect(gn); gn.connect(dest);
        o.start(t); o.stop(t + dur + 0.05);
      } catch (e) { /* ignore */ }
    }
    function noise(t, dur, vol, ft, f0, f1, q, dest) {
      const ac = S.ac; if (!ac || !S.nz || !dest) return;
      try {
        const src = ac.createBufferSource(); src.buffer = S.nz;
        const f = ac.createBiquadFilter(); f.type = ft; f.Q.value = q || 0.8;
        f.frequency.setValueAtTime(f0, t);
        if (f1 && f1 !== f0) f.frequency.exponentialRampToValueAtTime(f1, t + dur);
        const gn = ac.createGain();
        gn.gain.setValueAtTime(0.0001, t);
        gn.gain.exponentialRampToValueAtTime(Math.max(0.0002, vol), t + 0.004);
        gn.gain.exponentialRampToValueAtTime(0.0001, t + dur);
        src.connect(f); f.connect(gn); gn.connect(dest);
        src.start(t, Math.random() * 0.4); src.stop(t + dur + 0.05);
      } catch (e) { /* ignore */ }
    }
    S.ensure = function () {
      if (S.dead) return null;
      if (S.ac) {
        if (S.ac.state === 'suspended' && S.ac.resume) { try { S.ac.resume().catch(() => {}); } catch (e) { /* ignore */ } }
        return S.ac;
      }
      const C = W.AudioContext || W.webkitAudioContext;
      if (!C) return null;
      try {
        const ac = new C();
        S.on = soundOn();
        S.master = ac.createGain(); S.master.gain.value = S.on ? 0.85 : 0;
        const comp = ac.createDynamicsCompressor();
        comp.threshold.value = -12; comp.knee.value = 10; comp.ratio.value = 4; comp.attack.value = 0.003; comp.release.value = 0.18;
        S.master.connect(comp); comp.connect(ac.destination);
        S.mus = ac.createGain(); S.mus.gain.value = 0.5; S.mus.connect(S.master);
        S.fx = ac.createGain(); S.fx.gain.value = 1; S.fx.connect(S.master);
        const len = Math.floor(ac.sampleRate * 0.9), buf = ac.createBuffer(1, len, ac.sampleRate), d = buf.getChannelData(0);
        for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
        S.nz = buf; S.ac = ac;
        if (ac.state === 'suspended' && ac.resume) ac.resume().catch(() => {});
      } catch (e) { S.ac = null; }
      return S.ac;
    };
    S.running = () => !!(S.ac && S.ac.state === 'running');
    /* 输出延迟补偿：伴奏提前这么多排进音频时钟，耳朵听到的鼓点才和画面上音符落圈同一刻 */
    S.lat = () => { const ac = S.ac; if (!ac) return 0; const v = (+ac.outputLatency || 0) || (+ac.baseLatency || 0); return clamp(v, 0, 0.12); };
    S.time = () => (S.ac ? S.ac.currentTime : 0);
    S.follow = function () {
      if (!S.ac) return;
      const t = now(); if (t - S.chk < 250) return; S.chk = t;
      const on = soundOn();
      if (on !== S.on) { S.on = on; try { S.master.gain.setTargetAtTime(on ? 0.85 : 0, S.ac.currentTime, 0.04); } catch (e) { /* ignore */ } }
    };
    /* 第 k 个八分音符（k<0 = 预备拍），t = 音频时间 */
    S.step = function (k, t, lv) {
      if (!S.running()) return;
      const M = S.mus, st = ((k % 8) + 8) % 8, bar = Math.floor(k / 8);
      if (k < 0) {
        if (st % 2 === 0) { const last = k === -2; tone(t, last ? 2500 : 1900, last ? 2100 : 1500, 0.06, last ? 0.42 : 0.3, 'square', M, 6500); noise(t, 0.03, 0.2, 'highpass', 5000, 5000, 0.7, M); }
        return;
      }
      const root = ROOTS[((bar % 4) + 4) % 4];
      if (st === 0 || st === 4 || (lv >= 6 && st === 7)) tone(t, 150, 44, 0.3, st === 0 ? 0.95 : 0.75, 'sine', M);
      if (st === 2 || st === 6) { noise(t, 0.16, 0.42, 'bandpass', 1900, 1200, 0.9, M); tone(t, 240, 150, 0.08, 0.22, 'triangle', M); }
      if (st % 2 === 0 || lv >= 3) noise(t, 0.035, st % 2 ? 0.1 : 0.16, 'highpass', 7600, 7600, 0.7, M);
      if (st === 0) tone(t, mtof(root - 12), mtof(root - 12), 0.42, 0.26, 'triangle', M);
      if (st === 3 && lv >= 2) tone(t, mtof(root - 5), mtof(root - 5), 0.2, 0.18, 'triangle', M);
      if (st === 4) tone(t, mtof(root - 12), mtof(root - 12), 0.32, 0.22, 'triangle', M);
      if (st === 6 && lv >= 4) tone(t, mtof(root), mtof(root), 0.18, 0.16, 'triangle', M);
      const dg = MEL[Math.floor(bar / 4) % 2][((bar % 4) + 4) % 4][st];
      if (dg >= 0) { const f = mtof(deg(dg)); tone(t, f, f, 0.22, 0.07, 'square', M, 2400); tone(t, f * 2, f * 2, 0.12, 0.025, 'triangle', M); }
    };
    S.finale = function (t) {
      if (!S.running()) return;
      if (t == null) t = S.ac.currentTime + 0.02;
      tone(t, 150, 40, 0.5, 1, 'sine', S.mus);
      noise(t, 1.4, 0.4, 'highpass', 6000, 3200, 0.5, S.mus);
      [72, 76, 79, 84].forEach((m) => tone(t, mtof(m), mtof(m), 0.9, 0.06, 'triangle', S.mus));
    };
    /* 孩子敲鼓：咚（大音符更厚） */
    S.don = function (big) {
      if (!S.running()) return false;
      const t = S.ac.currentTime + 0.002;
      tone(t, big ? 170 : 200, 56, 0.34, 1, 'sine', S.fx);
      tone(t, 110, 52, 0.3, 0.45, 'triangle', S.fx);
      noise(t, 0.05, 0.45, 'lowpass', 1800, 400, 1, S.fx);
      return true;
    };
    S.chime = function (perfect, big) {
      if (!S.running()) return;
      const t = S.ac.currentTime + 0.01;
      if (perfect) { tone(t, 1568, 1568, 0.16, 0.12, 'triangle', S.fx); tone(t + 0.04, 2093, 2093, 0.2, 0.08, 'triangle', S.fx); }
      else tone(t, 1175, 1175, 0.14, 0.1, 'triangle', S.fx);
      if (big) [1047, 1319, 1568, 2093].forEach((f, i) => tone(t + 0.05 + i * 0.045, f, f, 0.2, 0.08, 'square', S.fx, 4200));
    };
    S.bonk = function () {
      if (!S.running()) return;
      const t = S.ac.currentTime + 0.005;
      tone(t, 180, 120, 0.16, 0.22, 'square', S.fx, 700);
    };
    /* 暂停回来后的预备拍（木鱼“嗒”） */
    S.tick = function (hi) {
      if (!S.running()) return false;
      const t = S.ac.currentTime + 0.005;
      tone(t, hi ? 2500 : 1900, hi ? 2100 : 1500, 0.06, hi ? 0.42 : 0.3, 'square', S.mus, 6500);
      noise(t, 0.03, 0.2, 'highpass', 5000, 5000, 0.7, S.mus);
      return true;
    };
    /* 失败：下行“哇哦~”长号 */
    S.sad = function () {
      if (!S.running()) return;
      const t = S.ac.currentTime + 0.05;
      [[392, 370], [370, 349], [349, 330], [330, 262]].forEach((p, i) => tone(t + i * 0.28, p[0], p[1], i === 3 ? 0.9 : 0.3, 0.13, 'sawtooth', S.fx, 900));
    };
    S.close = function () {
      S.dead = true;
      try { if (S.ac && S.ac.close) S.ac.close().catch(() => {}); } catch (e) { /* ignore */ }
      S.ac = null;
    };
    return S;
  }

  /* ================= 谱面：绕口令 → 小句 → 音符（每字一拍，句末休止对齐到半小节） ================= */
  function hanCount(s) { let n = 0; for (const ch of String(s || '')) if (isHan(ch)) n++; return n; }
  /* 没有标点的长句要切成小句：在均分点附近找“不拆词”的位置（不拆数字、数量词，“不/比/在…”不落句尾，“的/了/子…”不落句首） */
  const NUM = '一二三四五六七八九十百千万两零几半';
  const MEAS = '个只条张头辆匹座棵根盏块颗瓶斤位本支把件双群朵片年月日时分秒点岁天号';
  const TIE_NEXT = '不没很也都还就在把被给向从对比倒又再才更最太小大老第每这那';
  const TIE_PREV = '的了子着过们吗呢吧啊儿得地坏完掉住';
  const TONED = /[āáǎàēéěèīíǐìōóǒòūúǔùǖǘǚǜ]/;
  function splitPhrase(notes, maxChunk) {
    const n = notes.length;
    if (n <= maxChunk) return [notes];
    const parts = Math.ceil(n / maxChunk), bal = n / parts;
    let best = Math.round(bal), bc = 1e9;
    for (let k = 2; k <= n - 2; k++) {
      if (k > maxChunk + 1 || n - k > maxChunk * (parts - 1) + 1) continue;
      const a = notes[k - 1].ch, b = notes[k].ch;
      let pen = 0;
      if (NUM.indexOf(a) >= 0 && (NUM.indexOf(b) >= 0 || MEAS.indexOf(b) >= 0)) pen += 3;
      if (TIE_NEXT.indexOf(a) >= 0) pen += 2;
      if (TIE_PREV.indexOf(b) >= 0) pen += 2;
      if (notes[k].py && !TONED.test(notes[k].py)) pen += 3;   // 轻声字（扁担的“担”）粘着前一个字
      const cost = Math.abs(k - bal) + pen;
      if (cost < bc) { bc = cost; best = k; }
    }
    return [notes.slice(0, best)].concat(splitPhrase(notes.slice(best), maxChunk));
  }
  function buildSong(tw, maxChunk) {
    const chars = Array.from(String(tw.text || ''));
    const syl = String(tw.py || '').trim().split(/\s+/).filter(Boolean);
    const useSyl = syl.length === hanCount(tw.text);
    const phrases = [];
    let cur = [], k = 0;
    for (const ch of chars) {
      if (isHan(ch)) { cur.push({ ch, py: useSyl ? syl[k] : '' }); k++; }
      else if (BRK.indexOf(ch) >= 0) {
        if (cur.length) { phrases.push({ notes: cur, end: ch }); cur = []; }
        else if (phrases.length) phrases[phrases.length - 1].end += ch;
      }
    }
    if (cur.length) phrases.push({ notes: cur, end: '' });
    const chunks = [];
    for (const ph of phrases) {
      const parts = splitPhrase(ph.notes, maxChunk);
      parts.forEach((notes, i) => {
        const last = i === parts.length - 1;
        chunks.push({ notes, last, end: last ? ph.end : '', text: notes.map((x) => x.ch).join(''), judged: 0, hits: 0, perf: 0, done: false, pass: false });
      });
    }
    const notes = [];
    let beat = 0;
    chunks.forEach((c, ci) => {
      c.i = ci;
      c.notes.forEach((n, j) => { n.beat = beat++; n.chunk = c; n.j = j; n.idx = notes.length; n.res = ''; notes.push(n); });
      if (c.last) {
        const sent = SENT.test(c.end) || ci === chunks.length - 1;
        if (sent && c.notes.length) c.notes[c.notes.length - 1].big = true;
        beat += sent ? 2 : 1;
        if (beat % 2) beat++;
      }
    });
    return { tw, chunks, notes, beats: beat, lastBeat: notes.length ? notes[notes.length - 1].beat : 0 };
  }

  HW.register({
    id: 'beat', skill: 'speak', kind: 'arcade', name: '绕口令节拍', icon: '🥁',
    blurb: '字跳进鼓圈时，边读边敲鼓', needs: [], cols: ['twisters'],
    start(ctx) {
      if (!HW.arcade || typeof HW.arcade.run !== 'function') {
        try { ctx.el.textContent = '游戏引擎没有加载。'; } catch (e) { /* ignore */ }
        return function () {};
      }
      const synth = makeSynth();
      /* 触屏延迟自适应：手机从手指碰到屏幕到 JS 收到事件、再加上画面显示延迟，常常整体晚 50–100 ms。
         记住最近命中的平均早晚（只学命中的，夹在 -30..+90 ms），判定时扣掉，整局 / 换关都沿用 */
      let lag = 0.02;
      let unlockRoot = null, cvEl = null, onCvDown = null;
      const unlock = () => { synth.ensure(); };

      /* ---------- 布局（按 g.w / g.h 自适应） ---------- */
      function layout(g) {
        const B = g.B; if (!B) return;
        const w = g.w, h = g.h, top = g.hudTop;
        const wide = w >= 700 && w > h * 1.05;   // 横屏；平板竖屏按手机竖屏构图放大
        const u = clamp(Math.min(w / 400, (h - top) / 720), 0.8, 1.45);
        const L = B.L = {};
        L.u = u; L.wide = wide;
        L.boardW = Math.min(w - 20 * u, 760 * u);
        L.boardX = (w - L.boardW) / 2;
        L.boardY = top + 4 * u;
        L.boardH = (wide ? 150 : 136) * u;
        L.R = (wide ? 33 : 29) * u;
        L.hop = L.R * 0.3;
        L.laneTop = L.boardY + L.boardH + 12 * u;
        L.noteY = L.laneTop + 26 * u + L.hop + L.R;
        L.laneBot = L.noteY + L.R + 12 * u;
        L.jx = wide ? Math.max(130 * u, w * 0.11) : L.R + 28 * u;
        L.spacing = clamp((w - L.jx) / 6.2, 2.4 * L.R, 150 * u);
        L.popY = L.laneBot + 30 * u;
        L.stageTop = L.laneBot + 6 * u;
        const avail = h - L.stageTop;
        L.crowdH = clamp(avail * 0.15, 44 * u, 78 * u);
        let rx = Math.min(w * (wide ? 0.2 : 0.41), (avail - L.crowdH * 0.45 - 58 * u) / 2.1, 250 * u);
        rx = Math.max(rx, 64);
        L.rx = rx; L.ry = rx * 0.4; L.bodyH = rx * 0.62; L.panda = Math.min(rx * 0.72, 124 * u);
        const groupH = L.panda * 0.95 + L.ry * 0.6 + L.bodyH + L.ry + rx * 0.2;
        const free = Math.max(0, avail - L.crowdH * 0.45 - groupH - 58 * u);
        L.dx = w / 2;
        L.fy = L.stageTop + 58 * u + free * 0.45 + L.panda * 0.95 + L.ry * 0.6;
        L.headY = L.fy - L.ry - L.panda * 0.26;
        L.floorY = L.fy + L.bodyH + L.ry * 0.35;
        L.lanX = wide ? Math.min(L.dx - rx - 150 * u, w * 0.2) : 30 * u;
        L.lanX2 = w - L.lanX;
        L.lanY = L.stageTop + 30 * u;
        L.lanSz = (wide ? 58 : 40) * u;
        // 歌词牌
        L.tagY = L.boardY + 17 * u;
        L.ballY = L.boardY + (wide ? 35 : 33) * u;
        L.pyY = L.boardY + (wide ? 53 : 49) * u;
        L.chY = L.boardY + (wide ? 92 : 82) * u;
        L.nextY = L.boardY + L.boardH - 17 * u;
        L.cellMax = (wide ? 66 : 52) * u; L.fsMax = (wide ? 50 : 42) * u;
      }
      function lineGeom(L, chunk) {
        const n = chunk ? chunk.notes.length : 1, u = L.u;
        const cell = Math.min(L.cellMax, (L.boardW - 40 * u) / Math.max(n, 4));
        return { cell, x0: L.boardX + L.boardW / 2 - (n * cell) / 2 + cell / 2, fs: Math.round(Math.min(cell * 0.82, L.fsMax)), ps: Math.round(clamp(cell * 0.3, 11, (L.wide ? 18 : 16) * u)) };
      }

      /* ---------- 状态机 ---------- */
      function levelParams(g, B) {
        const lv = g.level, gn = g.gradeNum || 3;
        B.bpm = Math.round(64 + 3 * gn + 9 * (lv - 1));
        B.spb = 60 / B.bpm;
        const easy = gn <= 3 ? 1 : 0;
        B.perfW = 0.085 - 0.003 * (lv - 1) + easy * 0.012;
        B.goodW = Math.min(0.45 * B.spb, 0.17 - 0.006 * (lv - 1) + easy * 0.02);
        // “太早”区：紧挨在好球窗口前面、且不碰到上一个字的窗口（连点 0.1 秒一下一定会先落进这里）
        B.earlyW = clamp(B.spb - 2 * B.goodW - 0.03, 0.1, 0.2);
        B.thr = Math.min(0.75, 0.45 + 0.03 * lv);
        B.rate = clamp(0.5 + (lv - 1) * 0.08, 0.5, 1.25);
        B.speed = lv <= 2 ? '🐢 慢速' : lv <= 5 ? '🚶 中速' : lv <= 8 ? '🐇 快速' : '🚀 超快';
      }
      function startIntro(g, B, i) {
        if (!B.songs[i]) return;
        B.si = i; B.song = B.songs[i];
        B.phase = 'demo'; B.demoT = 0; B.demoDone = false; B.demoSkip = false; B.boardCi = -1; B.boardOut = null;
        B.songT = -4 * B.spb; B.stepK = -9; B.nextJ = 0; B.cntI = -99; B.fin = false;
        B.scroll = { open: 0, closing: false };
        B.hint = i === 0; B.hintHits = 0;
        g.tween(B.scroll, { open: 1 }, 0.55, 'outBack');
        g.sfx('whoosh');
        let tts = false;
        try { tts = !!(g.ctx.tts && g.ctx.tts.ok); } catch (e) { tts = false; }
        B.tts = tts;
        const n = hanCount(B.song.tw.text);
        B.demoWait = tts ? 99 : clamp(2.2 + n * 0.035, 2.8, 6);
        B.demoPart = false;
        if (tts) {
          let text = B.song.tw.text;
          if (n > 40) {
            const sents = text.replace(/([。！？!?；;])/g, '$1\u0001').split('\u0001').filter(Boolean);
            let acc = '';
            for (const st of sents) { if (acc && hanCount(acc + st) > 36) break; acc += st; }
            if (acc && acc.length < text.length) { text = acc; B.demoPart = true; }
          }
          g.after(0.6, () => {
            if (g.B !== B || B.phase !== 'demo' || B.demoDone) return;
            B.speakingDemo = true;
            g.say(text, { rate: B.rate }).then(() => { B.speakingDemo = false; if (g.B === B && B.phase === 'demo') g.after(0.5, () => { if (g.B === B) B.demoDone = true; }); });
          });
        }
      }
      function skipDemo(g, B) {
        if (B.demoDone || B.scroll.closing) return;
        if (B.speakingDemo) { try { g.ctx.tts.stop(); } catch (e) { /* ignore */ } }
        B.demoDone = true; B.demoSkip = true;
      }
      function closeDemo(g, B) {
        B.scroll.closing = true;
        g.tween(B.scroll, { open: 0 }, 0.3, 'inQuad', () => {
          if (g.B !== B) return;
          B.phase = 'song';
          B.songT = -4 * B.spb; B.stepK = -9;
          synth.ensure();
        });
      }
      /* 本关结束的舞台演出（引擎的过关/失败面板 0.5 秒后才盖上来，这之前舞台自己要有反应） */
      function stageEnd(g, B, win) {
        if (B.endFx || g.state !== 'over') return;
        B.endFx = win ? 'win' : 'lose';
        const L = B.L;
        if (win) {
          if (B.finaleAt !== B.si) synth.finale();
          B.cheer = 1; B.panda.jump = 1;
          g.burst(L.dx, L.fy, { kind: 'confetti', n: 40 });
          g.burst(L.dx, L.fy - L.ry, { kind: 'star', n: 16, color: '#FFE45C' });
          g.ring(L.dx, L.fy, '#FFE45C', L.rx * 1.6);
        } else {
          synth.sad();
          B.panda.sweat = 1; B.panda.shk = 1;
        }
      }
      function holdTick(g, B) {
        B.cnt = { text: String(B.hold), t: 0 };
        if (!synth.tick(B.hold === 1)) g.sfx('tick');
      }
      function songDone(g, B) {
        if (g.state !== 'play' || B.phase !== 'song') return;
        if (B.si + 1 < B.songs.length) {
          B.phase = 'gap';
          B.banner = { t: 0, text: '第 ' + (B.si + 2) + ' 首！', sub: '接着敲，别停！' };
          g.sfx('power');
          g.after(1.5, () => { if (g.B === B) { B.banner = null; startIntro(g, B, B.si + 1); } });
        } else {
          B.phase = 'done';
          g.after(0.3, () => { if (g.B === B && g.state === 'play') { g.win(); stageEnd(g, B, true); } });
        }
      }

      /* ---------- 判定 ---------- */
      function addPop(B, text, col, sub) {
        B.pops.push({ text, col, sub: sub || '', t: 0 });
        if (B.pops.length > 4) B.pops.shift();
      }
      function drumFx(g, B, big) {
        const d = B.drum;
        d.sq = 1; d.side = -d.side;
        if (d.side < 0) d.sL = 1; else d.sR = 1;
        B.ripples.push({ t: 0 }); if (B.ripples.length > 6) B.ripples.shift();
        if (!synth.don(big)) g.sfx('beat');
      }
      function startFly(g, B, n) {
        const L = B.L, geo = lineGeom(L, n.chunk);
        const f = { n, t: 0, x0: L.jx, y0: L.noteY, x1: geo.x0 + n.j * geo.cell, y1: L.chY, rot: (Math.random() - 0.5) * 2 };
        B.flyers.push(f);
        g.tween(f, { t: 1 }, 0.32, 'inOutQuad', () => {
          f.done = true; n.lit = 1; n.landed = true;
          g.burst(f.x1, f.y1, { kind: 'spark', n: 6, color: '#FFF3A0' });
        });
      }
      function judge(g, n, kind, off, early) {
        const B = g.B, L = B.L, c = n.chunk;
        n.res = kind; n.rt = B.songT;
        c.judged++;
        if (kind === 'miss') {
          g.combo = 0;
          if (early) addPop(B, '太早了', '#FF9FB2', '字进圈再敲');
          else addPop(B, '错过', '#B9C3EA', '');
          B.panda.sweat = 1; B.panda.shk = 1;
          synth.bonk();
          g.shake(3);
        } else {
          c.hits++; if (kind === 'perfect') c.perf++;
          g.combo++; if (g.combo > g.maxCombo) g.maxCombo = g.combo;
          const mult = g.combo >= 30 ? 4 : g.combo >= 20 ? 3 : g.combo >= 10 ? 2 : 1;
          g.addScore((kind === 'perfect' ? 5 : 2) * mult * (n.big ? 2 : 1));
          const x = L.jx, y = L.noteY, pf = kind === 'perfect';
          g.burst(x, y, { kind: 'star', n: pf ? 9 : 5, color: pf ? '#FFD23F' : '#9BE89B' });
          g.burst(x, y, { kind: 'spark', n: 8 });
          if (n.big) g.burst(x, y, { kind: 'confetti', n: 22 });
          g.ring(x, y, pf ? '#FFE45C' : '#9BE89B', L.R * 2.5);
          B.jflash = 1;
          addPop(B, pf ? '完美' : '不错', pf ? '#FFD23F' : '#8BE38B', pf ? '' : (off < 0 ? '早了一点' : '晚了一点'));
          synth.chime(pf, n.big);
          startFly(g, B, n);
          B.panda.jump = 1;
          if (B.hint && ++B.hintHits >= 2) B.hint = false;
          if (g.combo > 0 && g.combo % 10 === 0) {
            g.float('连击 ' + g.combo + '！', g.w / 2, L.stageTop + 34 * L.u, { color: g.combo >= 20 ? '#FF9CF0' : '#FFE45C', size: 36 });
            g.sfx('combo'); B.cheer = 1;
            g.burst(L.dx, L.fy, { kind: 'confetti', n: 26 });
          }
        }
        if (c.judged >= c.notes.length && !c.done) evalChunk(g, c);
      }
      /* 错题本说明：哪首绕口令 + 本局没跟上的每一句（原句 + 课本拼音 + 敲中几个）+ 发音提示。
         同一首只记一条（后一次覆盖前一次），所以把本局所有没过的句子都写进去；核心只留 240 字，放不下时保留最近的句子 */
      function wrongNote(B, tw) {
        const all = Array.from(String(tw.text || ''));
        const head = '绕口令“' + all.slice(0, 10).join('') + (all.length > 10 ? '…' : '') + '”没跟上的句子：';
        const tip = tw.tip ? '提示：' + tw.tip : '';
        const parts = (B.fails.get(tw) || []).map((c) => {
          const py = c.notes.map((x) => x.py).filter(Boolean).join(' ');
          return '“' + c.text + '”（' + (py ? py + '，' : '') + '敲中 ' + c.hits + '/' + c.notes.length + '）';
        });
        let body = '';
        for (let i = parts.length - 1; i >= 0; i--) {
          const nb = parts[i] + (body ? '；' + body : '');
          if (body && (head + nb + '。' + tip).length > 240) break;
          body = nb;
        }
        return head + body + '。' + tip;
      }
      function evalChunk(g, c) {
        const B = g.B, L = B.L, tw = B.song.tw;
        c.done = true;
        const need = Math.max(1, Math.ceil(c.notes.length * B.thr - 1e-9));
        c.pass = c.hits >= need;
        const allP = c.perf === c.notes.length;
        B.stamps.push({ ok: c.pass, all: allP, t: 0 });
        if (B.stamps.length > 3) B.stamps.shift();
        const bx = L.dx, by = L.fy - L.ry * 0.3;
        if (c.pass) {
          // 连击按“字”算（judge 里已加过）。g.right 会再 +1 并在连击 = 3 / 5 的倍数时在 HUD 下方飘“连击×N！”
          // （正好盖住歌词牌）：临时换成倍率相同、但不触发飘字的值，调用完恢复 combo / maxCombo。
          const cb = g.combo, mc = g.maxCombo;
          let eff = cb;
          if (eff === 3 || eff === 5) eff = 4;
          else if (eff >= 10 && eff % 5 === 0) eff += 1;
          const mult = eff >= 10 ? 4 : eff >= 6 ? 3 : eff >= 3 ? 2 : 1;
          g.combo = eff - 1;
          g.right(tw, bx, by, (allP ? '整句完美 +' : '这句过关 +') + 10 * mult);
          g.combo = cb; g.maxCombo = mc;
          B.cheer = 1;
          stageEnd(g, B, true);
        } else {
          if (!B.fails.has(tw)) B.fails.set(tw, []);
          B.fails.get(tw).push(c);
          g.wrong(tw, wrongNote(B, tw), bx, by);
          stageEnd(g, B, false);
        }
      }
      function hit(g) {
        const B = g.B;
        if (!B || g.state !== 'play') return;
        synth.ensure();
        const nx = B.song && B.phase === 'song' ? B.song.notes[B.nextJ] : null;
        drumFx(g, B, !!(nx && nx.big));
        if (B.phase === 'demo') { if (B.scroll.open > 0.5) skipDemo(g, B); return; }
        if (B.phase !== 'song' || B.hold > 0) return;
        const T = B.songT + clamp((now() - B.lastUpd) / 1000, 0, 0.034) - lag;
        const notes = B.song.notes;
        let best = null, bd = 1e9, first = null;
        for (let j = B.nextJ; j < notes.length; j++) {
          const n = notes[j];
          if (n.res) continue;
          if (!first) first = n;
          if (n.beat * B.spb - T > B.goodW) break;
          const d = Math.abs(T - n.beat * B.spb);
          if (d <= B.goodW && d < bd) { best = n; bd = d; }
        }
        if (!best && first) {
          // 字差一点点才进圈就敲 = 太早：这个字直接算错过。
          // 否则一直狂点（每 0.1 秒一下）也能把每个字“碰”中——不读、不看也能三星过关。
          const d = first.beat * B.spb - T;
          if (d > B.goodW && d <= B.goodW + B.earlyW) { judge(g, first, 'miss', -d, true); return; }
        }
        if (!best) {
          B.spam.push(T);
          while (B.spam.length && T - B.spam[0] > 1.2) B.spam.shift();
          if (B.spam.length >= 4) { B.spam.length = 0; g.combo = 0; addPop(B, '别乱敲', '#FF9FB2', '字进圈再敲'); }
          return;
        }
        const off = T - best.beat * B.spb;
        lag = clamp(lag + off * 0.15, -0.03, 0.09);
        judge(g, best, bd <= B.perfW ? 'perfect' : 'good', off);
      }

      /* ================= 绘制 ================= */
      function circle(c, x, y, r) { c.beginPath(); c.arc(x, y, r, 0, TAU); }
      function drawSpots(c, g, B, L, vb, T) {
        const lvl = B.endFx === 'win' ? 1 : B.endFx === 'lose' ? 0 : clamp(g.combo / 20, 0, 1);
        c.save();
        c.globalCompositeOperation = 'lighter';
        const oy = L.stageTop - 20 * L.u, len = (g.h - oy) * 1.25;
        for (let i = 0; i < 2; i++) {
          const ox = i ? g.w + 20 : -20;
          const base = Math.atan2(L.fy - oy, L.dx - ox);
          const ang = base + Math.sin(T * 0.8 + i * 2.1) * 0.22;
          const wd = 0.16 + 0.05 * lvl;
          const gr = c.createRadialGradient(ox, oy, 0, ox, oy, len);
          gr.addColorStop(0, i ? 'rgba(255,120,210,.55)' : 'rgba(255,225,120,.55)');
          gr.addColorStop(1, 'rgba(255,255,255,0)');
          c.globalAlpha = 0.28 + 0.45 * lvl + 0.12 * Math.pow(1 - frac(vb), 3);
          c.fillStyle = gr;
          c.beginPath(); c.moveTo(ox, oy); c.arc(ox, oy, len, ang - wd, ang + wd); c.closePath(); c.fill();
        }
        c.restore();
      }
      function drawFloor(c, g, L) {
        const y = L.floorY, w = g.w, u = L.u;
        const gr = c.createLinearGradient(0, y, 0, g.h);
        gr.addColorStop(0, '#A86E38'); gr.addColorStop(1, '#5B3717');
        c.fillStyle = gr; c.fillRect(-20, y, w + 40, g.h - y + 20);
        c.strokeStyle = 'rgba(50,25,8,.35)'; c.lineWidth = 2;
        c.beginPath();
        for (let i = -8; i <= 8; i++) { c.moveTo(w / 2 + i * 60 * u, y); c.lineTo(w / 2 + i * 110 * u, g.h); }
        c.stroke();
        c.fillStyle = '#D8322E'; c.fillRect(-20, y - 7 * u, w + 40, 9 * u);
        c.fillStyle = '#FFC928'; c.fillRect(-20, y + 2 * u, w + 40, 3 * u);
        c.fillStyle = 'rgba(255,230,170,.4)'; c.fillRect(-20, y - 7 * u, w + 40, 2 * u);
      }
      function drawLantern(c, g, x, y0, sz, ang, label, glow) {
        const len = sz * 0.55;
        c.save(); c.translate(x, y0); c.rotate(ang);
        c.strokeStyle = '#2b2233'; c.lineWidth = 2;
        c.beginPath(); c.moveTo(0, 0); c.lineTo(0, len); c.stroke();
        c.translate(0, len + sz * 0.5);
        const gr = c.createRadialGradient(0, 0, 0, 0, 0, sz * 1.5);
        gr.addColorStop(0, 'rgba(255,170,70,' + (0.5 * glow).toFixed(3) + ')'); gr.addColorStop(1, 'rgba(255,120,40,0)');
        c.fillStyle = gr; circle(c, 0, 0, sz * 1.5); c.fill();
        c.fillStyle = '#F2B233'; c.fillRect(-sz * 0.22, -sz * 0.52, sz * 0.44, sz * 0.12); c.fillRect(-sz * 0.22, sz * 0.4, sz * 0.44, sz * 0.12);
        c.fillStyle = '#E8332A'; c.beginPath(); c.ellipse(0, 0, sz * 0.6, sz * 0.46, 0, 0, TAU); c.fill();
        c.lineWidth = 2.5; c.strokeStyle = NAVY; c.stroke();
        c.strokeStyle = 'rgba(120,10,10,.45)'; c.lineWidth = 1.6;
        c.beginPath(); c.ellipse(0, 0, sz * 0.32, sz * 0.46, 0, 0, TAU); c.stroke();
        c.beginPath(); c.moveTo(0, -sz * 0.46); c.lineTo(0, sz * 0.46); c.stroke();
        c.fillStyle = 'rgba(255,255,255,.28)'; c.beginPath(); c.ellipse(-sz * 0.3, -sz * 0.16, sz * 0.1, sz * 0.18, 0.3, 0, TAU); c.fill();
        g.text(label, 0, sz * 0.02, { size: Math.round(sz * 0.44), font: 'kai', color: '#FFE27A', weight: 700, stroke: '#8A1010', strokeW: 2 });
        c.strokeStyle = '#F2B233'; c.lineWidth = 2;
        c.beginPath();
        for (let i = -2; i <= 2; i++) { c.moveTo(i * sz * 0.05, sz * 0.52); c.lineTo(i * sz * 0.07 + Math.sin(ang * 6) * 2, sz * 0.9); }
        c.stroke();
        c.restore();
      }
      function drawPanda(c, g, B, L, vb) {
        const P = L.panda, u = L.u;
        const bob = Math.pow(1 - frac(vb), 2) * 5 * u;
        const hy = L.headY - B.panda.jump * 12 * u + bob;
        const rot = Math.sin(B.panda.shk * 18) * 0.12 * B.panda.shk;
        B.panda.hy = hy;
        c.fillStyle = '#23263A';
        c.beginPath(); c.ellipse(L.dx, L.fy - L.ry * 0.7 + bob * 0.5, P * 0.6, P * 0.42, 0, 0, TAU); c.fill();
        c.fillStyle = '#F7F7F7';
        c.beginPath(); c.ellipse(L.dx, L.fy - L.ry * 0.55 + bob * 0.5, P * 0.34, P * 0.3, 0, 0, TAU); c.fill();
        g.emoji('🐼', L.dx, hy, P, { rot });
        // 红头巾
        c.save(); c.translate(L.dx, hy); c.rotate(rot);
        c.strokeStyle = NAVY; c.lineWidth = 9 * u; c.lineCap = 'round';
        c.beginPath(); c.ellipse(0, P * 0.08, P * 0.4, P * 0.36, 0, Math.PI * 1.16, Math.PI * 1.84); c.stroke();
        c.strokeStyle = '#E8332A'; c.lineWidth = 6 * u;
        c.beginPath(); c.ellipse(0, P * 0.08, P * 0.4, P * 0.36, 0, Math.PI * 1.16, Math.PI * 1.84); c.stroke();
        const kx = P * 0.33, ky = -P * 0.14, fl = Math.sin(now() / 120) * 3 * u;
        c.fillStyle = '#E8332A'; c.strokeStyle = NAVY; c.lineWidth = 2;
        c.beginPath(); c.moveTo(kx, ky); c.quadraticCurveTo(kx + 16 * u, ky - 8 * u + fl, kx + 26 * u, ky - 2 * u + fl); c.lineTo(kx + 22 * u, ky + 6 * u + fl); c.closePath(); c.fill(); c.stroke();
        c.beginPath(); c.moveTo(kx, ky); c.quadraticCurveTo(kx + 14 * u, ky + 10 * u - fl, kx + 20 * u, ky + 18 * u - fl); c.lineTo(kx + 12 * u, ky + 18 * u - fl); c.closePath(); c.fill(); c.stroke();
        c.restore();
        if (g.combo >= 20) g.emoji('🕶️', L.dx, hy - P * 0.02, P * 0.56, { rot });
        if (B.panda.sweat > 0) g.emoji('💦', L.dx + P * 0.5, hy - P * 0.28 - (1 - B.panda.sweat) * 12 * u, P * 0.3, { alpha: Math.min(1, B.panda.sweat * 1.5) });
      }
      function drawSticks(c, g, B, L) {
        const P = L.panda, u = L.u, dy = (B.panda.hy || L.headY) - L.headY;
        const back = L.fy - L.ry;
        c.lineCap = 'round';
        for (let s = -1; s <= 1; s += 2) {
          const k = s < 0 ? B.drum.sL : B.drum.sR;
          const e = k * k * (3 - 2 * k);
          const shx = L.dx + s * P * 0.4, shy = back + 3 * u + dy * 0.5;
          const prx = L.dx + s * P * 0.88, pry = back - P * 0.3 + dy;
          const phx = L.dx + s * P * 0.6, phy = back - L.ry * 0.02;
          const px = prx + (phx - prx) * e, py = pry + (phy - pry) * e;
          const trx = prx + s * P * 0.3, try_ = pry - P * 0.66;
          const thx = L.dx + s * L.rx * 0.2, thy = L.fy + L.ry * 0.15;
          const tx = trx + (thx - trx) * e, ty = try_ + (thy - try_) * e;
          c.strokeStyle = NAVY; c.lineWidth = 19 * u;
          c.beginPath(); c.moveTo(shx, shy); c.lineTo(px, py); c.stroke();
          c.strokeStyle = '#23263A'; c.lineWidth = 14 * u;
          c.beginPath(); c.moveTo(shx, shy); c.lineTo(px, py); c.stroke();
          c.strokeStyle = NAVY; c.lineWidth = 10 * u;
          c.beginPath(); c.moveTo(px, py); c.lineTo(tx, ty); c.stroke();
          c.strokeStyle = '#E0A060'; c.lineWidth = 6 * u;
          c.beginPath(); c.moveTo(px, py); c.lineTo(tx, ty); c.stroke();
          c.fillStyle = '#E8332A'; circle(c, tx, ty, 7.5 * u); c.fill(); c.lineWidth = 2.2 * u; c.strokeStyle = NAVY; c.stroke();
          c.fillStyle = '#23263A'; circle(c, px, py, 9 * u); c.fill();
        }
      }
      function ellPath(c, x, y, rx, ry) { c.beginPath(); c.ellipse(x, y, rx, ry, 0, 0, TAU); }
      function drawDrum(c, g, B, L, vb, T) {
        const u = L.u, x = L.dx, rx = L.rx, sq = B.drum.sq, bh = L.bodyH;
        const fy = L.fy + sq * 3 * u, ry = L.ry * (1 - 0.09 * sq);
        const combo = g.combo;
        // 鼓架
        c.strokeStyle = NAVY; c.lineWidth = 13 * u; c.lineCap = 'round';
        c.beginPath(); c.moveTo(x - rx * 0.62, fy + bh * 0.55); c.lineTo(x - rx * 0.92, L.floorY + rx * 0.08); c.moveTo(x + rx * 0.62, fy + bh * 0.55); c.lineTo(x + rx * 0.92, L.floorY + rx * 0.08); c.stroke();
        c.strokeStyle = '#7A4A22'; c.lineWidth = 8 * u;
        c.beginPath(); c.moveTo(x - rx * 0.62, fy + bh * 0.55); c.lineTo(x - rx * 0.92, L.floorY + rx * 0.08); c.moveTo(x + rx * 0.62, fy + bh * 0.55); c.lineTo(x + rx * 0.92, L.floorY + rx * 0.08); c.stroke();
        // 火焰（高连击）
        if (combo >= 20) {
          for (let i = 0; i < 2; i++) {
            const s = i ? 1 : -1;
            g.emoji('🔥', x + s * rx * 1.02, fy + bh * 0.2 - 8 * u, (42 + 8 * Math.sin(T * 13 + i)) * u, { flip: i === 1 });
          }
        }
        // 鼓身
        c.beginPath();
        c.moveTo(x - rx, fy);
        c.bezierCurveTo(x - rx * 1.12, fy + bh * 0.35, x - rx * 1.1, fy + bh * 0.7, x - rx * 0.95, fy + bh);
        c.ellipse(x, fy + bh, rx * 0.95, ry * 0.95, 0, Math.PI, 0, true);
        c.bezierCurveTo(x + rx * 1.1, fy + bh * 0.7, x + rx * 1.12, fy + bh * 0.35, x + rx, fy);
        c.ellipse(x, fy, rx, ry, 0, 0, Math.PI, false);
        c.closePath();
        const gb = c.createLinearGradient(x - rx, 0, x + rx, 0);
        gb.addColorStop(0, '#8E1426'); gb.addColorStop(0.28, '#E0303F'); gb.addColorStop(0.42, '#FF5A5F'); gb.addColorStop(0.7, '#C8243A'); gb.addColorStop(1, '#7E1022');
        c.fillStyle = gb; c.fill();
        c.lineWidth = 4 * u; c.strokeStyle = NAVY; c.stroke();
        // 金箍 + 铜钉
        const bands = [0.16, 0.86];
        for (let b = 0; b < 2; b++) {
          const by = fy + bh * bands[b], k = b ? 0.97 : 1.06;
          c.strokeStyle = '#F2B233'; c.lineWidth = 6 * u;
          c.beginPath(); c.ellipse(x, by, rx * k, ry * k, 0, 0.08, Math.PI - 0.08); c.stroke();
          const N = 11;
          for (let i = 0; i < N; i++) {
            const a = Math.PI * (i + 0.5) / N;
            const sx = x + Math.cos(a) * rx * k, sy = by + Math.sin(a) * ry * k;
            const lit = combo >= 10 ? 0.5 + 0.5 * Math.sin(T * 9 - i * 0.9 + b) : 0;
            c.fillStyle = lit > 0.6 ? '#FFFBD0' : '#FFD34D';
            circle(c, sx, sy, (3.6 + lit * 1.6) * u); c.fill();
            c.lineWidth = 1.4; c.strokeStyle = '#8A5A10'; c.stroke();
          }
        }
        // 福字铜牌
        const mr = Math.min(bh * 0.24, rx * 0.2), my = fy + bh * 0.5 + ry * 0.45;
        c.fillStyle = '#FFD34D'; circle(c, x, my, mr); c.fill(); c.lineWidth = 3 * u; c.strokeStyle = NAVY; c.stroke();
        c.strokeStyle = '#C8871A'; c.lineWidth = 1.5 * u; circle(c, x, my, mr * 0.8); c.stroke();
        g.text('福', x, my + mr * 0.04, { size: Math.round(mr * 1.2), font: 'kai', color: '#C8243A', weight: 700 });
        // 鼓面
        const gf = c.createRadialGradient(x - rx * 0.2, fy - ry * 0.3, rx * 0.05, x, fy, rx);
        gf.addColorStop(0, '#FFF8E6'); gf.addColorStop(0.7, '#F6DFB0'); gf.addColorStop(1, '#E2BE82');
        c.fillStyle = gf; ellPath(c, x, fy, rx, ry); c.fill();
        c.lineWidth = 4 * u; c.strokeStyle = NAVY; c.stroke();
        c.strokeStyle = 'rgba(160,110,50,.35)'; c.lineWidth = 2 * u; ellPath(c, x, fy, rx * 0.84, ry * 0.84); c.stroke();
        // 连击发光
        const glow = Math.min(0.6, combo / 30) + B.jflash * 0.25;
        if (glow > 0.02) {
          c.save(); c.globalCompositeOperation = 'lighter';
          const gg = c.createRadialGradient(x, fy, 0, x, fy, rx);
          gg.addColorStop(0, 'rgba(255,220,90,' + glow.toFixed(3) + ')'); gg.addColorStop(1, 'rgba(255,160,40,0)');
          c.fillStyle = gg; ellPath(c, x, fy, rx, ry); c.fill();
          c.restore();
        }
        if (combo >= 30) {
          c.lineWidth = 5 * u;
          c.strokeStyle = 'hsl(' + Math.round((T * 160) % 360) + ',95%,62%)';
          ellPath(c, x, fy, rx * 1.05, ry * 1.08); c.stroke();
        }
        // 波纹
        for (const r of B.ripples) {
          const k = r.t / 0.5; if (k >= 1) continue;
          c.globalAlpha = 1 - k; c.lineWidth = (6 - 4 * k) * u; c.strokeStyle = '#FFFFFF';
          ellPath(c, x, fy, rx * (0.15 + 0.8 * k), ry * (0.15 + 0.8 * k)); c.stroke();
        }
        c.globalAlpha = 1;
        // 连击数（预备拍 / 手指提示时让位）；平时鼓面印一个淡淡的“咚”
        const busy = (B.phase === 'song' && B.cnt && B.cnt.t < 0.6) || (B.hint && B.phase === 'song');
        if (combo < 3 && !busy) g.text('咚', x, fy + ry * 0.04, { size: Math.round(ry * 1.05), font: 'kai', weight: 700, color: 'rgba(190,70,50,.16)' });
        if (combo >= 3 && !busy) {
          const bump = 1 + 0.25 * B.jflash;
          c.save(); c.translate(x, fy - ry * 0.05); c.scale(bump, bump);
          g.text(String(combo), 0, -ry * 0.12, { size: Math.round(ry * 0.95), font: 'num', color: combo >= 20 ? '#FF6BD6' : combo >= 10 ? '#FF8A1C' : '#E8332A', stroke: NAVY, strokeW: 4, shadow: true });
          g.text('连击', 0, ry * 0.5, { size: Math.round(ry * 0.34), font: 'round', color: NAVY });
          c.restore();
        }
      }
      function drawCrowd(c, g, B, L, vb) {
        const u = L.u, sp = 36 * u, n = Math.ceil(g.w / sp) + 1, hc = L.crowdH;
        const lit = B.endFx === 'win' ? n : g.combo >= 3 ? Math.min(n, 2 + Math.floor(g.combo / 3)) : 0;
        const cols = ['#FF4FB3', '#3DE3FF', '#FFE14D', '#7CFF6B', '#B98CFF'];
        for (let i = 0; i < n; i++) {
          const x = (i + 0.3 + (i % 2) * 0.3) * sp - sp * 0.3;
          const jmp = Math.abs(Math.sin(Math.PI * (vb + (i % 3) * 0.1))) * (3 * u + B.cheer * 14 * u + Math.min(g.combo, 30) * 0.2 * u);
          const y = g.h - hc * 0.62 - jmp + (i % 2) * 7 * u;
          if ((i * 7) % n < lit) {
            const a = Math.sin(Math.PI * vb + i) * 0.5 + (i % 2 ? 0.25 : -0.25);
            const hx = x + (i % 2 ? 14 : -14) * u, hy = y + 6 * u;
            const ex = hx + Math.sin(a) * 34 * u, ey = hy - Math.cos(a) * 34 * u;
            const col = cols[i % cols.length];
            c.lineCap = 'round';
            c.globalAlpha = 0.35; c.strokeStyle = col; c.lineWidth = 12 * u;
            c.beginPath(); c.moveTo(hx, hy); c.lineTo(ex, ey); c.stroke();
            c.globalAlpha = 1; c.lineWidth = 4.5 * u; c.strokeStyle = '#FFFFFF';
            c.beginPath(); c.moveTo(hx, hy); c.lineTo(ex, ey); c.stroke();
          }
          c.fillStyle = i % 2 ? '#2A1F55' : '#1C1542';
          c.beginPath(); c.ellipse(x, y + hc * 0.7, 21 * u, hc * 0.6, 0, Math.PI, 0); c.lineTo(x + 21 * u, g.h + 10); c.lineTo(x - 21 * u, g.h + 10); c.closePath(); c.fill();
          circle(c, x, y, 13 * u); c.fill();
          c.fillStyle = 'rgba(255,200,140,.25)';
          c.beginPath(); c.arc(x, y, 13 * u, Math.PI * 1.1, Math.PI * 1.6); c.lineTo(x, y); c.fill();
        }
      }
      function drawLane(c, g, B, L, vb, T) {
        const u = L.u, top = L.laneTop, bot = L.laneBot, w = g.w;
        const fever = g.combo >= 20;
        c.fillStyle = 'rgba(12,16,44,.84)'; c.fillRect(0, top, w, bot - top);
        const sh = c.createLinearGradient(0, top, 0, bot);
        sh.addColorStop(0, 'rgba(120,150,255,.16)'); sh.addColorStop(0.5, 'rgba(120,150,255,0)'); sh.addColorStop(1, 'rgba(0,0,0,.25)');
        c.fillStyle = sh; c.fillRect(0, top, w, bot - top);
        const bcol = fever ? 'hsl(' + Math.round((T * 140) % 360) + ',95%,62%)' : '#FFC928';
        c.fillStyle = NAVY; c.fillRect(0, top - 6 * u, w, 6 * u); c.fillRect(0, bot, w, 6 * u);
        c.fillStyle = bcol; c.fillRect(0, top - 5 * u, w, 3.5 * u); c.fillRect(0, bot + 1.5 * u, w, 3.5 * u);
        // 节拍线（和音符同速滚动）
        const bp = B.songT / B.spb;
        for (let b = Math.floor(bp) - 2; ; b++) {
          const x = L.jx + (b - bp) * L.spacing;
          if (x > w + 10) break;
          if (x < -10) continue;
          const bar = ((b % 4) + 4) % 4 === 0;
          c.fillStyle = bar ? 'rgba(255,255,255,.26)' : 'rgba(255,255,255,.08)';
          c.fillRect(x - (bar ? 1.5 : 1), top + 5 * u, bar ? 3 : 2, bot - top - 10 * u);
        }
        // 判定圈
        const x = L.jx, y = L.noteY, R = L.R;
        let near = 0;
        const nx = B.song && B.phase === 'song' ? B.song.notes[B.nextJ] : null;
        if (nx) { const d = nx.beat * B.spb - B.songT; near = clamp(1 - Math.abs(d) / (B.goodW * 1.8), 0, 1); }
        const pulse = Math.pow(1 - frac(vb), 3);
        c.save(); c.globalCompositeOperation = 'lighter';
        const gg = c.createRadialGradient(x, y, R * 0.3, x, y, R * 2.1);
        gg.addColorStop(0, 'rgba(255,228,92,' + (0.12 + 0.3 * near + 0.25 * B.jflash + 0.08 * pulse).toFixed(3) + ')'); gg.addColorStop(1, 'rgba(255,200,60,0)');
        c.fillStyle = gg; circle(c, x, y, R * 2.1); c.fill();
        c.restore();
        c.fillStyle = 'rgba(255,240,200,.12)'; circle(c, x, y, R * 1.08); c.fill();
        c.lineWidth = (4 + 2 * near) * u; c.strokeStyle = near > 0.35 ? '#FFE45C' : '#FFFFFF';
        circle(c, x, y, R * (1.12 + 0.06 * pulse)); c.stroke();
        c.lineWidth = 2 * u; c.strokeStyle = 'rgba(255,255,255,.4)';
        circle(c, x, y, R * 0.66); c.stroke();
        if (B.jflash > 0) { c.globalAlpha = B.jflash * 0.7; c.fillStyle = '#FFFFFF'; circle(c, x, y, R * 1.1); c.fill(); c.globalAlpha = 1; }
        // 提示手指
        if (B.hint && B.phase === 'song' && nx) {
          const d = nx.beat * B.spb - B.songT;
          if (d < B.spb * 2.2) {
            const bl = 0.5 + 0.5 * Math.sin(T * 12);
            c.lineWidth = 5 * u; c.strokeStyle = 'rgba(255,90,120,' + (0.4 + 0.6 * bl).toFixed(3) + ')';
            circle(c, x, y, R * 1.45 + bl * 5 * u); c.stroke();
          }
        }
      }
      function noteX(B, L, n) { return L.jx + (n.beat - B.songT / B.spb) * L.spacing; }
      function drawNote(c, g, L, n, x, y, alpha, gray, sc) {
        const u = L.u, R = L.R * (n.big ? 1.14 : 1);
        c.save(); c.translate(x, y); if (sc !== 1) c.scale(sc, sc);
        c.globalAlpha = alpha;
        c.fillStyle = 'rgba(0,0,0,.35)'; circle(c, 0, 5 * u, R); c.fill();
        c.fillStyle = gray ? '#7C84A8' : n.big ? '#FFC928' : NOTE_COL[n.chunk.i % NOTE_COL.length];
        circle(c, 0, 0, R); c.fill();
        c.lineWidth = 3.2 * u; c.strokeStyle = NAVY; c.stroke();
        c.fillStyle = gray ? '#CDD2E4' : '#FFF7E4'; circle(c, 0, 0, R * 0.74); c.fill();
        c.fillStyle = 'rgba(255,255,255,.55)'; c.beginPath(); c.ellipse(-R * 0.42, -R * 0.52, R * 0.2, R * 0.1, -0.6, 0, TAU); c.fill();
        if (n.big && !gray) {
          c.fillStyle = '#FFFFFF';
          for (let i = 0; i < 4; i++) { const a = now() / 400 + i * TAU / 4; circle(c, Math.cos(a) * R * 0.87, Math.sin(a) * R * 0.87, 2.4 * u); c.fill(); }
        }
        g.text(n.ch, 0, R * 0.03, { size: Math.round(L.R * (n.big ? 1.12 : 1.02)), font: 'kai', weight: 700, color: gray ? '#5A6185' : NAVY, alpha });
        if (n.py) g.text(n.py, 0, -R - 11 * u, { size: Math.round(clamp(L.R * 0.5, 12, 18)), font: 'py', color: gray ? '#AEB5D0' : '#FFFFFF', stroke: NAVY, strokeW: 3, alpha });
        c.restore();
        c.globalAlpha = 1;
      }
      function drawNotes(c, g, B, L) {
        if (!B.song) return;
        const notes = B.song.notes, bp = B.songT / B.spb, w = g.w;
        for (let j = Math.max(0, B.nextJ - 12); j < notes.length; j++) {
          const n = notes[j];
          const x = noteX(B, L, n);
          if (x > w + L.R * 2) break;
          if (n.res && n.res !== 'miss') continue;
          if (n.res === 'miss') {
            const dt = B.songT - n.rt;
            const y = L.noteY + 700 * dt * dt + 20 * dt;
            if (y > g.h + 50 || dt > 1.2) continue;
            drawNote(c, g, L, n, x - 40 * dt, y, clamp(1 - dt, 0, 1), true, 1);
            continue;
          }
          const dist = n.beat - bp;
          const hop = Math.abs(Math.sin(Math.PI * dist)) * L.hop * (dist < 0 ? 0.2 : 1);
          const a = clamp((w + L.R - x) / (L.R * 1.5), 0, 1);
          const sc = 0.82 + 0.18 * a;
          drawNote(c, g, L, n, x, L.noteY - hop, a, false, sc);
        }
      }
      function drawFlyers(c, g, B, L) {
        for (const f of B.flyers) {
          if (f.done) continue;
          const t = f.t, x = f.x0 + (f.x1 - f.x0) * t, y = f.y0 + (f.y1 - f.y0) * t - Math.sin(Math.PI * t) * 60 * L.u;
          const n = f.n, s = 1 - 0.45 * t;
          c.save(); c.translate(x, y); c.rotate(f.rot * t); c.scale(s, s);
          c.fillStyle = '#FFE45C'; circle(c, 0, 0, L.R * 0.8); c.fill(); c.lineWidth = 3; c.strokeStyle = NAVY; c.stroke();
          g.text(n.ch, 0, 1, { size: Math.round(L.R * 1.02), font: 'kai', weight: 700, color: NAVY });
          c.restore();
        }
        let j = 0;
        for (let i = 0; i < B.flyers.length; i++) if (!B.flyers[i].done) B.flyers[j++] = B.flyers[i];
        B.flyers.length = j;
      }
      function drawBoardLine(c, g, B, L, ch, dy, alpha, ballOn) {
        if (!ch) return;
        const geo = lineGeom(L, ch), u = L.u;
        const cur = ballOn && B.song && (B.phase === 'song' || B.phase === 'demo') ? B.song.notes[B.nextJ] : null;
        if (cur && cur.chunk === ch) {
          const hx = geo.x0 + cur.j * geo.cell, hw = geo.cell * 0.96, hh = L.chY + geo.fs * 0.58 - (L.pyY - 11 * u);
          const pl = 0.5 + 0.5 * Math.pow(1 - frac(B.songT / B.spb), 2);
          c.globalAlpha = alpha;
          g.rrect(hx - hw / 2, L.pyY - 11 * u + dy, hw, hh, 10 * u, 'rgba(255,210,63,' + (0.12 + 0.14 * pl).toFixed(3) + ')', '#FFD23F', 2.5 * u);
          c.globalAlpha = 1;
        }
        for (const n of ch.notes) {
          const x = geo.x0 + n.j * geo.cell, y = L.chY + dy;
          let col = '#FFF4DA';
          // 敲中的字落到牌上后一直亮着（完美 = 金、不错 = 绿），一句唱完整行是亮的
          if (n.res === 'perfect' && n.landed) col = '#FFD23F';
          else if (n.res === 'good' && n.landed) col = '#9BEA8E';
          else if (n.res === 'miss') col = '#7E88AE';
          const pop = n.lit ? 1 + 0.35 * n.lit : 1;
          if (n.lit) n.lit = Math.max(0, n.lit - 0.06);
          if (pop !== 1) { c.save(); c.translate(x, y); c.scale(pop, pop); g.text(n.ch, 0, 0, { size: geo.fs, font: 'kai', weight: 700, color: col, alpha, stroke: NAVY, strokeW: 3 }); c.restore(); }
          else g.text(n.ch, x, y, { size: geo.fs, font: 'kai', weight: 700, color: col, alpha, stroke: NAVY, strokeW: 3 });
          if (n.py) g.text(n.py, x, L.pyY + dy, { size: geo.ps, font: 'py', color: n.res === 'miss' ? '#7E88AE' : '#BFD2FF', alpha, maxW: geo.cell - 2 });
          if (n.res === 'miss') {
            c.globalAlpha = alpha; c.strokeStyle = '#FF5A6E'; c.lineWidth = 3 * u; c.lineCap = 'round';
            c.beginPath(); c.moveTo(x - geo.fs * 0.42, y + geo.fs * 0.3); c.lineTo(x + geo.fs * 0.42, y - geo.fs * 0.3); c.stroke();
            c.globalAlpha = 1;
          }
        }
        if (ballOn && B.phase === 'song') {
          const bp = B.songT / B.spb;
          const first = ch.notes[0], last = ch.notes[ch.notes.length - 1];
          let bx, hop;
          if (bp <= first.beat) { bx = geo.x0; hop = Math.abs(Math.sin(Math.PI * (bp - first.beat))); }
          else if (bp >= last.beat) { bx = geo.x0 + last.j * geo.cell; hop = 0; }
          else {
            const k = bp - first.beat, j = Math.floor(k), f = k - j;
            bx = geo.x0 + (j + f) * geo.cell; hop = Math.sin(Math.PI * f);
          }
          const by = L.ballY - hop * 11 * u + dy;
          c.fillStyle = '#FF5A6E'; circle(c, bx, by, 7.5 * u); c.fill();
          c.lineWidth = 2.5; c.strokeStyle = '#FFFFFF'; c.stroke();
          c.fillStyle = 'rgba(255,255,255,.85)'; circle(c, bx - 2.4 * u, by - 2.4 * u, 2.4 * u); c.fill();
        }
      }
      function drawBoard(c, g, B, L) {
        const u = L.u, x = L.boardX, y = L.boardY, bw = L.boardW, bh = L.boardH;
        g.rrect(x, y + 5 * u, bw, bh, 20 * u, 'rgba(8,12,34,.55)');
        g.rrect(x, y, bw, bh, 20 * u, 'rgba(22,28,72,.94)', NAVY, 4 * u);
        g.rrect(x + 5 * u, y + 5 * u, bw - 10 * u, bh - 10 * u, 15 * u, null, '#F2B233', 2.5 * u);
        c.fillStyle = '#E8332A';
        for (let i = 0; i < 4; i++) { const cx = i % 2 ? x + bw - 14 * u : x + 14 * u, cy = i < 2 ? y + 14 * u : y + bh - 14 * u; c.save(); c.translate(cx, cy); c.rotate(Math.PI / 4); c.fillRect(-4.5 * u, -4.5 * u, 9 * u, 9 * u); c.restore(); }
        const tagS = Math.round(12.5 * u);
        const nSong = B.songs.length;
        const tag = (nSong > 1 ? '绕口令 ' + (B.si + 1) + '/' + nSong : '绕口令') + ' · ' + B.speed + ' ♩' + B.bpm;
        const tgw = g.measure(tag, tagS, 'round') + 22 * u;
        g.rrect(x + 22 * u, y - 11 * u, tgw, 22 * u, 11 * u, '#2A3478', '#F2B233', 2 * u);
        g.text(tag, x + 33 * u, y + 0.5 * u, { size: tagS, font: 'round', color: '#FFD86B', align: 'left' });
        if (!B.song) return;
        const chunks = B.song.chunks;
        let ci = B.song.notes[B.nextJ] ? B.song.notes[B.nextJ].chunk.i : chunks.length - 1;
        if (B.phase === 'demo' || B.phase === 'wait') ci = 0;
        if (ci !== B.boardCi) {
          const old = B.boardCi >= 0 && B.boardCi < chunks.length ? chunks[B.boardCi] : null;
          const nn = B.song.notes[B.nextJ];
          const soon = !nn || nn.beat * B.spb - B.songT < 0.15;
          if (old && ci > B.boardCi && !soon && B.flyers.some((f) => !f.done && f.n.chunk === old)) ci = B.boardCi;   // 等飞上来的字落定再换行
          else {
            if (old && ci > B.boardCi) B.boardOut = { ch: old, t: 0 };
            B.boardCi = ci; B.boardIn = 0;
          }
        }
        const inK = B.boardIn < 1 ? g.ease.outBack(clamp((B.boardIn - 0.25) / 0.75, 0, 1)) : 1;
        c.save();
        c.beginPath(); c.rect(x + 6 * u, y + 21 * u, bw - 12 * u, L.nextY - y - 31 * u); c.clip();
        if (B.boardOut && B.boardOut.t < 1) drawBoardLine(c, g, B, L, B.boardOut.ch, -44 * u * B.boardOut.t, clamp(1 - B.boardOut.t * 1.4, 0, 1), false);
        drawBoardLine(c, g, B, L, chunks[ci], (1 - inK) * 30 * u, clamp((B.boardIn - 0.25) * 2.2, 0, 1), true);
        c.restore();
        const nx = chunks[ci + 1];
        if (nx) {
          const tx = '下一句：' + nx.text;
          g.text(tx, L.boardX + bw / 2, L.nextY, { size: Math.round((L.wide ? 17 : 15) * u), font: 'kai', weight: 700, color: 'rgba(200,210,255,.72)', maxW: bw - 40 * u });
        } else if (B.si + 1 < B.songs.length) {
          g.text('最后一句！接着还有第 ' + (B.si + 2) + ' 首', L.boardX + bw / 2, L.nextY, { size: Math.round(14 * u), font: 'round', color: 'rgba(255,216,107,.8)' });
        } else {
          g.text('最后一句！', L.boardX + bw / 2, L.nextY, { size: Math.round(14 * u), font: 'round', color: 'rgba(255,216,107,.85)' });
        }
        // 印章
        for (const s of B.stamps) {
          if (s.t > 1.3) continue;
          const k = s.t < 0.22 ? 2.2 - 1.2 * (s.t / 0.22) : 1;
          const a = s.t > 1 ? 1 - (s.t - 1) / 0.3 : 1;
          const sz = 36 * u;
          c.save(); c.translate(x + bw - 24 * u, y + 18 * u); c.rotate(-0.2); c.scale(k, k); c.globalAlpha = clamp(a, 0, 1);
          g.rrect(-sz / 2, -sz / 2, sz, sz, 6 * u, s.ok ? '#D7263D' : '#6E7597', '#FFF3D6', 2.5 * u);
          g.text(s.ok ? (s.all ? '妙' : '好') : '练', 0, 1, { size: Math.round(sz * 0.62), font: 'kai', weight: 700, color: '#FFF3D6' });
          c.restore();
        }
        c.globalAlpha = 1;
      }
      function drawPops(c, g, B, L) {
        const u = L.u;
        for (let i = 0; i < B.pops.length; i++) {
          const p = B.pops[i];
          if (p.t > 0.7 || i < B.pops.length - 1) continue;
          const k = p.t < 0.14 ? 0.5 + (p.t / 0.14) * 0.75 : p.t < 0.24 ? 1.25 - (p.t - 0.14) / 0.1 * 0.25 : 1;
          const a = p.t > 0.5 ? 1 - (p.t - 0.5) / 0.2 : 1;
          const px = Math.max(L.jx, 62 * u), py = L.popY + 4 * u - p.t * 12 * u;
          c.save(); c.translate(px, py); c.scale(k, k);
          g.text(p.text, 0, 0, { size: Math.round(36 * u), font: 'round', color: p.col, stroke: NAVY, strokeW: 6, shadow: true, alpha: clamp(a, 0, 1) });
          if (p.sub) g.text(p.sub, 0, 30 * u, { size: Math.round(15 * u), font: 'round', color: '#FFFFFF', stroke: NAVY, strokeW: 4, alpha: clamp(a, 0, 1) });
          c.restore();
        }
      }
      function drawCount(c, g, B, L) {
        if (B.phase !== 'song' || !B.cnt || B.cnt.t > 0.6) return;
        const k = B.cnt.t < 0.15 ? 0.4 + B.cnt.t / 0.15 * 0.8 : 1.2 - Math.min(0.2, (B.cnt.t - 0.15));
        const a = B.cnt.t > 0.4 ? 1 - (B.cnt.t - 0.4) / 0.2 : 1;
        c.save(); c.translate(L.dx, L.fy - L.ry * 0.1); c.scale(k, k);
        g.shadowText(B.cnt.text, 0, 0, { size: Math.round(L.ry * (B.cnt.text.length > 1 ? 0.8 : 1.3)), font: B.cnt.text.length > 1 ? 'round' : 'num', color: '#FFE45C', alpha: clamp(a, 0, 1) });
        c.restore();
      }
      function drawHint(c, g, B, L, T) {
        if (!B.hint || B.phase !== 'song' || !B.song || g.state === 'over' || B.hold > 0) return;
        const nx = B.song.notes[B.nextJ];
        if (!nx || nx.beat * B.spb - B.songT > B.spb * 3.2) return;
        const u = L.u;
        const tap = Math.abs(Math.sin(T * 5));
        g.emoji('👆', L.dx + L.rx * 0.34, L.fy + L.ry * 0.55 + tap * 16 * u, 52 * u, { rot: -0.2 });
        const msg = '字进圈 · 敲鼓！';
        const tw = g.measure(msg, Math.round(19 * u), 'round') + 30 * u;
        const bx = L.dx - tw / 2, by = L.popY + 30 * u;
        c.globalAlpha = 0.75 + 0.25 * Math.sin(T * 8);
        g.rrect(bx, by - 17 * u, tw, 34 * u, 17 * u, '#FF5A6E', NAVY, 3 * u);
        g.text(msg, L.dx, by + 1, { size: Math.round(19 * u), font: 'round', color: '#FFFFFF' });
        c.globalAlpha = 1;
      }
      function drawScroll(c, g, B, L, T) {
        const sc = B.scroll;
        if (!sc || sc.open <= 0.01 || !B.song) return;
        const u = L.u, tw = B.song.tw;
        const sw = Math.min(g.w - 24 * u, 640 * u), inner = sw - 50 * u;
        const top0 = L.laneTop - 16 * u, maxH = g.h - L.crowdH * 0.5 - top0 - 16 * u;
        let fs = Math.round((L.wide ? 34 : 27) * u), lines = g.wrapText(tw.text, inner, fs, 'kai');
        const tipLines = tw.tip ? g.wrapText('💡 ' + tw.tip, inner, Math.round(14 * u), 'round').slice(0, 3) : [];
        const fixed = 76 * u + tipLines.length * 20 * u + 70 * u;
        while (fs > 15 && lines.length * fs * 1.5 + fixed > maxH) { fs -= 2; lines = g.wrapText(tw.text, inner, fs, 'kai'); }
        const sh = lines.length * fs * 1.5 + fixed;
        const cx = g.w / 2, cy = top0 + Math.min(maxH, sh) / 2 + Math.max(0, (maxH - sh) * 0.3);
        const vh = sh * sc.open;
        c.save();
        c.globalAlpha = clamp(sc.open * 1.5, 0, 1) * 0.5;
        c.fillStyle = '#060A20'; c.fillRect(0, 0, g.w, g.h);
        c.globalAlpha = 1;
        c.beginPath(); c.rect(cx - sw / 2 - 20, cy - vh / 2, sw + 40, vh); c.clip();
        g.rrect(cx - sw / 2, cy - sh / 2, sw, sh, 8 * u, '#FFF3D9', '#C9A262', 3 * u);
        g.rrect(cx - sw / 2 + 8 * u, cy - sh / 2 + 8 * u, sw - 16 * u, sh - 16 * u, 6 * u, null, 'rgba(200,60,50,.35)', 2 * u);
        let yy = cy - sh / 2 + 34 * u;
        const nSong = B.songs.length;
        g.text((nSong > 1 ? '绕口令 ' + (B.si + 1) + '/' + nSong : '绕口令') + ' · ' + B.speed, cx, yy, { size: Math.round(20 * u), font: 'round', color: '#C8243A' });
        yy += 38 * u;
        for (const ln of lines) { g.text(ln, cx, yy + fs * 0.25, { size: fs, font: 'kai', weight: 700, color: '#3B2415' }); yy += fs * 1.5; }
        yy += 6 * u;
        for (const tl of tipLines) { g.text(tl, cx, yy, { size: Math.round(14 * u), font: 'round', color: '#8A6A45', maxW: inner }); yy += 20 * u; }
        // 底部按钮样提示
        const by = cy + sh / 2 - 46 * u;
        const msg = B.tts ? (B.speakingDemo ? (B.demoPart ? '🔊 示范开头… 点鼓面开始' : '🔊 正在示范… 点鼓面开始') : '点鼓面开始') : '先读一读 · 点鼓面开始';
        const mw = g.measure(msg, Math.round(17 * u), 'round') + 36 * u;
        const pk = 1 + 0.05 * Math.sin(T * 6);
        c.save(); c.translate(cx, by); c.scale(pk, pk);
        g.rrect(-mw / 2, -17 * u + 4 * u, mw, 34 * u, 17 * u, '#1E9440');
        g.rrect(-mw / 2, -17 * u, mw, 34 * u, 17 * u, '#3CCB5A', NAVY, 3 * u);
        g.text(msg, 0, 1, { size: Math.round(17 * u), font: 'round', color: '#FFFFFF', stroke: NAVY, strokeW: 3 });
        c.restore();
        if (!B.tts && B.demoWait < 90) {
          const k = clamp(B.demoT / B.demoWait, 0, 1);
          g.rrect(cx - sw * 0.3, by + 22 * u, sw * 0.6, 6 * u, 3 * u, 'rgba(60,40,20,.2)');
          g.rrect(cx - sw * 0.3, by + 22 * u, Math.max(6 * u, sw * 0.6 * k), 6 * u, 3 * u, '#FF8A3D');
        }
        c.restore();
        // 卷轴轴头
        for (let s = -1; s <= 1; s += 2) {
          const ry = cy + s * vh / 2;
          g.rrect(cx - sw / 2 - 16 * u, ry - 9 * u, sw + 32 * u, 18 * u, 9 * u, '#7A4A22', NAVY, 2.5 * u);
          g.rrect(cx - sw / 2 - 16 * u, ry - 9 * u, sw + 32 * u, 6 * u, 4 * u, 'rgba(255,255,255,.25)');
          c.fillStyle = '#F2B233';
          circle(c, cx - sw / 2 - 20 * u, ry, 8 * u); c.fill(); circle(c, cx + sw / 2 + 20 * u, ry, 8 * u); c.fill();
        }
      }
      function drawBanner(c, g, B, L) {
        if (!B.banner) return;
        const t = B.banner.t, k = t < 0.3 ? g.ease.outBack(t / 0.3) : 1;
        c.save(); c.translate(g.w / 2, L.noteY); c.scale(k, k);
        g.shadowText(B.banner.text, 0, 0, { size: Math.round(52 * L.u), font: 'round', color: '#FFE45C' });
        g.shadowText(B.banner.sub, 0, 46 * L.u, { size: Math.round(22 * L.u), font: 'round', color: '#FFFFFF' });
        c.restore();
      }

      /* 纯装饰动画：用真实时间在 draw 里推进（倒计时 / 结束动画期间也照走） */
      function tickFx(B, dt) {
        const d = B.drum;
        d.sq = Math.max(0, d.sq - dt * 7); d.sL = Math.max(0, d.sL - dt * 7); d.sR = Math.max(0, d.sR - dt * 7);
        B.jflash = Math.max(0, B.jflash - dt * 5);
        B.cheer = Math.max(0, B.cheer - dt * 1.4);
        const P = B.panda;
        P.jump = Math.max(0, P.jump - dt * 5); P.shk = Math.max(0, P.shk - dt * 2.5); P.sweat = Math.max(0, P.sweat - dt * 1.3);
        for (const r of B.ripples) r.t += dt;
        for (const p of B.pops) p.t += dt;
        for (const s of B.stamps) s.t += dt;
        if (B.phase === 'wait') B.boardIn = 1;
        else if (B.boardIn < 1) B.boardIn = Math.min(1, B.boardIn + dt / 0.42);
        if (B.boardOut) { B.boardOut.t += dt / 0.28; if (B.boardOut.t >= 1) B.boardOut = null; }
        if (B.banner) B.banner.t += dt;
        if (B.cnt) B.cnt.t += dt;
      }

      /* ================= spec ================= */
      const spec = {
        name: '绕口令节拍', icon: '🥁',
        maxLevel: 10, lives: 3, music: null, sky: 'night',
        rounds: 4,
        intro: '字跳进鼓圈时，一边读一边敲鼓！',
        controls: '点鼓面 / 空格键（F、J 也行）',
        init(g) {
          let list = g.items('twisters', 2).filter((t) => t && typeof t.text === 'string' && hanCount(t.text) > 0);
          const B = g.B = {
            songs: [], song: null, si: 0, phase: 'wait', songT: 0, stepK: -9, nextJ: 0, lastUpd: now(),
            drum: { sq: 0, side: 1, sL: 0, sR: 0 }, panda: { jump: 0, shk: 0, sweat: 0, hy: 0 },
            ripples: [], pops: [], flyers: [], stamps: [], spam: [], jflash: 0, cheer: 0, audN: 0, hold: 0, holdT: 0, endFx: false, fails: new Map(),
            scroll: null, banner: null, cnt: null, cntI: -99, boardCi: -1, boardIn: 1, boardOut: null, hint: true, hintHits: 0
          };
          levelParams(g, B);
          if (list.length > 1) {
            const tot = hanCount(list[0].text) + hanCount(list[1].text);
            const lim = g.level <= 2 ? 46 : g.level <= 5 ? 64 : 80;
            if (tot > lim) list = list.slice(0, 1);
          }
          B.songs = list.slice(0, 2).map((tw) => buildSong(tw, 10));
          B.song = B.songs[0] || null;
          g.rounds = Math.max(1, B.songs.reduce((s, x) => s + x.chunks.length, 0));
          layout(g);
          B.songT = -4 * B.spb;
          try { W.__hwBeat = g; } catch (e) { /* ignore */ }
        },
        play(g) {
          const B = g.B;
          if (!B.songs.length) { B.phase = 'empty'; g.after(1.5, () => g.lose()); return; }
          if (B.phase === 'wait') startIntro(g, B, 0);
        },
        update(g, dt) {
          const B = g.B; if (!B) return;
          const tNow = now(), gap = tNow - B.lastUpd;
          B.lastUpd = tNow;
          synth.follow();
          // 暂停 / 切到后台回来（或卡了 1 秒以上）：字停在原地，先数“3、2、1”再接着走（不然一继续就有字撞进圈，白白丢心）
          const back = B.wasPaused || gap > 1000;
          B.wasPaused = false;
          if (back && B.phase === 'song' && !B.hold && B.songT > -1.5 * B.spb && B.nextJ < B.song.notes.length) {
            const nx = B.song.notes[B.nextJ];
            if (nx.beat * B.spb - B.songT < 3 * B.spb) { B.hold = 3; B.holdT = 0; holdTick(g, B); }
          }
          if (B.hold > 0) {
            B.holdT += dt;
            if (B.holdT >= B.spb) { B.holdT -= B.spb; B.hold--; if (B.hold > 0) holdTick(g, B); }
            if (B.hold > 0) return;
          }
          if (B.phase === 'wait' && B.songs.length) startIntro(g, B, 0);
          if (B.phase === 'demo') {
            B.demoT += dt;
            if (!B.tts && B.demoT >= B.demoWait) B.demoDone = true;
            if (B.demoDone && (B.demoSkip || B.demoT >= 2.2) && !B.scroll.closing && B.scroll.open > 0.5) closeDemo(g, B);
            return;
          }
          if (B.phase !== 'song') return;
          B.songT += dt;
          const spb = B.spb, half = spb / 2, song = B.song;
          // 伴奏（提前 0.14 秒排进音频时钟）
          const running = synth.running();
          const endK = Math.round((song.lastBeat + 1) * 2);
          while ((B.stepK + 1) * half <= B.songT + 0.14) {
            const k = ++B.stepK;
            if (k > endK + 2) continue;
            const tk = k * half;
            if (tk < B.songT - 0.05) continue;
            const at = synth.time() + Math.max(0, tk - B.songT - synth.lat());
            if (running) { B.audN++; if (k === endK + 2) { synth.finale(at); B.finaleAt = B.si; } else if (k <= endK) synth.step(k, at, g.level); }
          }
          const bi = Math.floor(B.songT / spb);
          if (bi !== B.cntI) {
            B.cntI = bi;
            if (bi >= -4 && bi < 0) B.cnt = { text: bi === -4 ? '预备' : String(-bi), t: 0 };
            if (!running && bi >= -4 && bi <= song.lastBeat) g.sfx('tick');
          }
          // 错过判定
          const notes = song.notes;
          while (B.nextJ < notes.length) {
            const n = notes[B.nextJ];
            if (n.res) { B.nextJ++; continue; }
            if (B.songT - lag - n.beat * spb > B.goodW) {
              judge(g, n, 'miss', 0);
              B.nextJ++;
              if (g.state !== 'play' || g.B !== B) return;
            } else break;
          }
          if (B.nextJ >= notes.length && B.songT > (song.lastBeat + 2.2) * spb) songDone(g, B);
        },
        draw(g, c) {
          const B = g.B; if (!B || !B.L) return;
          if (g.state === 'pause') B.wasPaused = true;
          const L = B.L, T = now() / 1000;
          const fdt = B.lastDraw ? clamp(T - B.lastDraw, 0, 0.05) : 0;
          B.lastDraw = T;
          tickFx(B, fdt);
          // 节拍相位：唱歌时跟歌曲时钟；其它时候（卷轴 / 换歌 / 结束演出）按本关速度自己走，舞台不停
          if (B.phase === 'song' && g.state !== 'over') B.vb = B.songT / B.spb;
          else B.vb = (B.vb || 0) + fdt * B.bpm / 60;
          const vb = B.vb;
          if (B.endFx === 'win') {
            // 过关：熊猫跟着拍子蹦、两根鼓槌轮流敲、全场荧光棒
            B.panda.jump = Math.max(B.panda.jump, Math.pow(1 - frac(vb), 3));
            B.cheer = Math.max(B.cheer, 0.7);
            const bi = Math.floor(vb);
            if (bi !== B.danceI) { B.danceI = bi; const d = B.drum; d.sq = 1; d.side = -d.side; if (d.side < 0) d.sL = 1; else d.sR = 1; B.ripples.push({ t: 0 }); if (B.ripples.length > 6) B.ripples.shift(); }
          } else if (B.endFx === 'lose') B.panda.sweat = Math.max(B.panda.sweat, 0.8);
          drawSpots(c, g, B, L, vb, T);
          drawFloor(c, g, L);
          const sway = Math.sin(Math.PI * vb) * 0.14;
          drawLantern(c, g, L.lanX, L.lanY, L.lanSz, sway, '节', 0.7 + 0.3 * Math.pow(1 - frac(vb), 2));
          drawLantern(c, g, L.lanX2, L.lanY, L.lanSz, -sway, '拍', 0.7 + 0.3 * Math.pow(1 - frac(vb), 2));
          drawPanda(c, g, B, L, vb);
          drawDrum(c, g, B, L, vb, T);
          drawSticks(c, g, B, L);
          drawCrowd(c, g, B, L, vb);
          drawLane(c, g, B, L, vb, T);
          drawNotes(c, g, B, L);
          drawBoard(c, g, B, L);
          drawPops(c, g, B, L);
          drawCount(c, g, B, L);
          drawHint(c, g, B, L, T);
          drawFlyers(c, g, B, L);
          drawBanner(c, g, B, L);
          drawScroll(c, g, B, L, T);
          if (B.phase === 'empty') g.shadowText('题目准备中…', g.w / 2, g.h / 2, { size: 30 });
        },
        // 敲鼓走自己挂在画布上的 pointerdown（见 dom）：引擎只认第一根手指，两只手轮流敲时第二根手指会被吞掉
        down(g, p) { if (!cvEl && p.y >= g.hudTop) hit(g); },
        key(g, k) {
          if (k === 'space' || k === 'enter' || k === 'left' || k === 'right' || k === 'up' || k === 'down' || /^[fjdkFJDK]$/.test(k)) hit(g);
        },
        resize(g) { layout(g); },
        dom(g, layer) {
          unlockRoot = layer && layer.parentElement;
          if (unlockRoot) {
            unlockRoot.addEventListener('pointerdown', unlock, true);
            unlockRoot.addEventListener('click', unlock, true);
            unlockRoot.addEventListener('touchend', unlock, true);
            cvEl = unlockRoot.querySelector('canvas');
            if (cvEl) {
              onCvDown = function (e) {
                if (g.state !== 'play' || (e.pointerType === 'mouse' && e.button > 0)) return;
                const r = cvEl.getBoundingClientRect();
                if (e.clientY - r.top < g.hudTop) return;
                try { hit(g); } catch (err) { try { console.error('[beat] hit', err); } catch (x) { /* ignore */ } }
              };
              cvEl.addEventListener('pointerdown', onCvDown);
            }
          }
          W.addEventListener('keydown', unlock, true);
        },
        end() {
          if (cvEl && onCvDown) cvEl.removeEventListener('pointerdown', onCvDown);
          if (unlockRoot) {
            unlockRoot.removeEventListener('pointerdown', unlock, true);
            unlockRoot.removeEventListener('click', unlock, true);
            unlockRoot.removeEventListener('touchend', unlock, true);
          }
          W.removeEventListener('keydown', unlock, true);
          synth.close();
          try { if (W.__hwBeat) W.__hwBeat = null; } catch (e) { /* ignore */ }
        }
      };
      return HW.arcade.run(ctx, spec);
    }
  });
})();
