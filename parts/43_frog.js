/* =====================================================================
 * 43_frog.js · 🐸 青蛙过河（listen · stories）—— SPEC_ARCADE.md §4 第 3 条
 *
 * 一关 = 一篇故事：
 *   ① 电台：河岸上一台会跳动的收音机逐句朗读故事（不显示原文；没有中文朗读时逐句打字幕），
 *      戴耳机的青蛙跟着节拍摇头，飞来的小虫可以点一下让青蛙吐舌头吃掉（+5）。
 *   ② 过河：每道题一条河道，3–4 片荷叶载着选项来回漂（两排反向漂 / 高关忽快忽慢 / 6 关起会下潜），
 *      题目横幅在顶部（🔊 重读）；点荷叶 → 青蛙抛物线跳（挤压拉伸）→ 对：稳稳落地、荷叶靠到河中间开花、
 *      镜头上移到下一条河道；错：荷叶翻沉、扑通落水、游回去、扣心。答完跳上对岸荷花宝座 = 通关。
 * 关卡递进：1–3 白天 / 4–6 黄昏 / 7–10 夜晚（灯笼、萤火虫）；漂速逐关加快，3 关起分两排反向漂，
 *   4 关起水流忽快忽慢，5 关起来回漂变成“匀速折返”，6 关起荷叶会不时下潜（冒泡预警）。
 * 正确性：选项 = q.c 打乱后的下标映射，pad.ok 只由 idx === q.a 决定；错题 note 写明正确答案 q.c[q.a]。
 * ===================================================================== */
(function () {
  'use strict';
  const W = window;
  const HW = W.HW;
  if (!HW || typeof HW.register !== 'function') return;

  const TAU = Math.PI * 2;
  const NAVY = '#1d2b53';
  const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
  const lerp = (a, b, t) => a + (b - a) * t;
  const fr = (n) => { const x = Math.sin(n * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); };
  const clock = () => ((W.performance && performance.now) ? performance.now() : Date.now()) / 1000;
  const HAN = /[㐀-鿿]/;
  const HEARD = new Set();          // 本页面里已经完整听过的故事（年级 + 标题）：再遇到时可以直接“过河去”

  /* ---------------- 题库校验 / 断句 ---------------- */
  function validQ(q) {
    return !!q && typeof q.q === 'string' && !!q.q.trim() && Array.isArray(q.c) && q.c.length >= 2 &&
      q.c.every((x) => typeof x === 'string' && !!x.trim()) && Number.isInteger(q.a) && q.a >= 0 && q.a < q.c.length;
  }
  function validStory(st) { return !!st && typeof st.text === 'string' && HAN.test(st.text) && Array.isArray(st.qs) && st.qs.some(validQ); }
  function splitSents(text) {
    const parts = String(text).replace(/\s+/g, '').replace(/([。！？!?；;…]+[”’」』）)]*)/g, '$1').split('');
    const out = [];
    parts.forEach((p) => {
      if (!p) return;
      if (!HAN.test(p)) { if (out.length) out[out.length - 1] += p; return; }
      out.push(p);
    });
    return out;
  }

  /* ---------------- 配色：1–3 白天 / 4–6 黄昏 / 7–10 夜晚 ---------------- */
  const PAL = {
    day: { id: 'day', sky: ['#2FA8F5', '#BDEBFF'], w: ['#62DCE8', '#27B0D5', '#1683B8'], rip: '#FFFFFF', glint: '#FFFFFF',
      grass: ['#8FDD66', '#58B545'], sand: '#FFE3A0', sand2: '#F2C46C', far: ['#9FE27C', '#62BE4E'], hill: '#7CC9A0',
      city: 'rgba(110,140,185,.75)', reed: '#3F9B3A', fg: 'rgba(20,105,55,.92)', fg2: 'rgba(40,150,70,.92)' },
    dusk: { id: 'dusk', sky: ['#FF8466', '#FFD69A'], w: ['#F3AE8B', '#6AAEC6', '#2F6795'], rip: '#FFE6CC', glint: '#FFD98A',
      grass: ['#B7CC5C', '#7A9C3E'], sand: '#F8D49A', sand2: '#E0AB60', far: ['#AAD46C', '#72AA4B'], hill: '#B58AA6',
      city: 'rgba(105,65,100,.75)', reed: '#4E8B33', fg: 'rgba(40,75,35,.92)', fg2: 'rgba(70,110,45,.92)' },
    night: { id: 'night', sky: ['#0A1238', '#2D3C7E'], w: ['#2E619C', '#1C3F76', '#0E2250'], rip: '#AFC8FF', glint: '#FFF3C4',
      grass: ['#41915D', '#276343'], sand: '#C8B98C', sand2: '#9C8C62', far: ['#428F5E', '#2A6846'], hill: '#27366A',
      city: '#141B45', reed: '#2E6E3A', fg: 'rgba(6,28,22,.94)', fg2: 'rgba(14,50,34,.94)' }
  };
  const palFor = (lv) => (lv <= 3 ? PAL.day : lv <= 6 ? PAL.dusk : PAL.night);
  const laneSpeed = (g) => (22 + 7.5 * (g.level - 1)) * clamp(g.w / 390, 1, 1.7);

  /* ---------------- 小画笔 ---------------- */
  function ell(c, x, y, rx, ry, fill, stroke, lw, rot) {
    c.beginPath(); c.ellipse(x, y, Math.max(0.1, rx), Math.max(0.1, ry), rot || 0, 0, TAU);
    if (fill) { c.fillStyle = fill; c.fill(); }
    if (stroke) { c.lineWidth = lw || 2; c.strokeStyle = stroke; c.stroke(); }
  }
  function sparkle(c, x, y, k, col) {
    c.fillStyle = col;
    c.beginPath(); c.moveTo(x, y - k); c.lineTo(x + k * 0.28, y); c.lineTo(x, y + k); c.lineTo(x - k * 0.28, y); c.closePath(); c.fill();
    c.beginPath(); c.moveTo(x - k, y); c.lineTo(x, y + k * 0.28); c.lineTo(x + k, y); c.lineTo(x, y - k * 0.28); c.closePath(); c.fill();
  }
  function petal(c, len, wid) {
    c.beginPath(); c.moveTo(0, 0);
    c.quadraticCurveTo(wid, -len * 0.5, 0, -len);
    c.quadraticCurveTo(-wid, -len * 0.5, 0, 0);
    c.closePath();
  }
  /* 荷叶路径：“胶囊形”叶面 + 顶边一个 V 形缺口（w ≥ h） */
  function padPath(c, w, h, flip) {
    const r = h / 2, x0 = -w / 2 + r, x1 = w / 2 - r;
    const n0 = flip * w * 0.1, n1 = flip * w * 0.21, nx = flip * w * 0.05;
    const a = Math.min(n0, n1), b = Math.max(n0, n1);
    c.beginPath();
    c.moveTo(b, -h / 2);
    c.lineTo(Math.max(b, x1), -h / 2);
    c.arc(x1, 0, r, -Math.PI / 2, Math.PI / 2);
    c.lineTo(x0, h / 2);
    c.arc(x0, 0, r, Math.PI / 2, Math.PI * 1.5);
    c.lineTo(Math.min(a, x1), -h / 2);
    c.lineTo(nx, -h * 0.04);
    c.closePath();
  }

  /* 青蛙：(x,y) = 脚底中心；S = 身宽基准；o 见下 */
  function drawFrog(c, x, y, S, o) {
    o = o || {};
    const k = S / 100;
    c.save();
    c.translate(x, y);
    if (o.rot) c.rotate(o.rot);
    c.scale(o.sx || 1, o.sy || 1);
    if (o.alpha != null && o.alpha < 1) c.globalAlpha *= Math.max(0, o.alpha);
    const body = o.body || '#62CC4E', dark = o.dark || '#3E9E36';
    const L = clamp(o.legs || 0, 0, 1);
    c.lineJoin = 'round'; c.lineCap = 'round';
    // 后腿
    if (L > 0.08) {
      for (const sd of [-1, 1]) {
        c.strokeStyle = NAVY; c.lineWidth = 17 * k;
        c.beginPath(); c.moveTo(sd * 26 * k, -30 * k); c.quadraticCurveTo(sd * 46 * k, -12 * k + 10 * k * L, sd * (30 + 8 * L) * k, 30 * k * L); c.stroke();
        c.strokeStyle = dark; c.lineWidth = 12 * k;
        c.beginPath(); c.moveTo(sd * 26 * k, -30 * k); c.quadraticCurveTo(sd * 46 * k, -12 * k + 10 * k * L, sd * (30 + 8 * L) * k, 30 * k * L); c.stroke();
        ell(c, sd * (32 + 8 * L) * k, 33 * k * L, 13 * k, 6 * k, '#58C24A', NAVY, 2.5 * k);
      }
    } else {
      for (const sd of [-1, 1]) {
        ell(c, sd * 46 * k, -4 * k, 15 * k, 6 * k, '#58C24A', NAVY, 2.6 * k);
        ell(c, sd * 35 * k, -19 * k, 19 * k, 14 * k, dark, NAVY, 3 * k, sd * 0.35);
      }
    }
    // 身体
    ell(c, 0, -40 * k, 45 * k, 38 * k, body, NAVY, 3.6 * k);
    ell(c, -14 * k, -58 * k, 16 * k, 8 * k, 'rgba(255,255,255,.28)', null, 0, -0.4);
    ell(c, 0, -27 * k, 28 * k, 19 * k, '#E2F8B0');
    // 前脚
    for (const sd of [-1, 1]) ell(c, sd * 18 * k, -5 * k, 10 * k, 6.5 * k, '#6FD65A', NAVY, 2.4 * k);
    // 眼睛
    const lx = (o.lookX || 0) * 4 * k, ly = (o.lookY || 0) * 3 * k;
    const bl = clamp(o.blink || 0, 0, 1);
    for (const sd of [-1, 1]) {
      const ex = sd * 23 * k, ey = -72 * k;
      ell(c, ex, ey, 18 * k, 17 * k, body, NAVY, 3.4 * k);
      ell(c, ex, ey - 1 * k, 12.5 * k, 12.5 * k, '#FFFFFF');
      if (o.dizzy) {
        c.strokeStyle = NAVY; c.lineWidth = 2.6 * k;
        c.beginPath(); c.moveTo(ex - 6 * k, ey - 7 * k); c.lineTo(ex + 6 * k, ey + 5 * k); c.moveTo(ex + 6 * k, ey - 7 * k); c.lineTo(ex - 6 * k, ey + 5 * k); c.stroke();
      } else if (o.happy) {
        c.strokeStyle = NAVY; c.lineWidth = 3.2 * k;
        c.beginPath(); c.arc(ex, ey + 2 * k, 7 * k, Math.PI * 1.1, Math.PI * 1.9); c.stroke();
      } else {
        ell(c, ex + lx, ey + ly, 6.5 * k, 7 * k, NAVY);
        ell(c, ex + lx - 2.4 * k, ey + ly - 2.8 * k, 2.4 * k, 2.4 * k, '#FFFFFF');
        if (bl > 0.02) {
          c.save(); c.beginPath(); c.arc(ex, ey - 1 * k, 13 * k, 0, TAU); c.clip();
          c.fillStyle = body; c.fillRect(ex - 14 * k, ey - 15 * k, 28 * k, 28 * k * bl);
          c.restore();
        }
      }
    }
    // 脸蛋 + 嘴
    ell(c, -31 * k, -48 * k, 7 * k, 4.5 * k, 'rgba(255,120,150,.55)');
    ell(c, 31 * k, -48 * k, 7 * k, 4.5 * k, 'rgba(255,120,150,.55)');
    const mo = clamp(o.mouth || 0, 0, 1);
    if (mo > 0.05) {
      ell(c, 0, -45 * k, 12 * k, 9 * k * mo + 1.5 * k, '#9C1C45', NAVY, 2.6 * k);
      ell(c, 0, -42 * k + 3 * k * mo, 7 * k, 3.5 * k * mo, '#FF7FA3');
    } else {
      c.strokeStyle = NAVY; c.lineWidth = 3 * k;
      c.beginPath();
      if (o.sad) c.arc(0, -38 * k, 11 * k, Math.PI * 1.2, Math.PI * 1.8);
      else c.arc(0, -55 * k, 15 * k, Math.PI * 0.22, Math.PI * 0.78);
      c.stroke();
    }
    // 耳机
    const ph = clamp(o.phones || 0, 0, 1);
    if (ph > 0.02) {
      c.globalAlpha *= ph;
      c.strokeStyle = NAVY; c.lineWidth = 9 * k;
      c.beginPath(); c.arc(0, -70 * k, 41 * k, Math.PI * 1.08, Math.PI * 1.92); c.stroke();
      c.strokeStyle = '#FF5A5F'; c.lineWidth = 5.5 * k;
      c.beginPath(); c.arc(0, -70 * k, 41 * k, Math.PI * 1.08, Math.PI * 1.92); c.stroke();
      for (const sd of [-1, 1]) {
        c.save(); c.translate(sd * 41 * k, -64 * k);
        c.beginPath(); c.ellipse(0, 0, 9 * k, 14 * k, 0, 0, TAU); c.fillStyle = '#FFC928'; c.fill(); c.lineWidth = 3 * k; c.strokeStyle = NAVY; c.stroke();
        c.beginPath(); c.ellipse(-sd * 2 * k, -4 * k, 3 * k, 4.5 * k, 0, 0, TAU); c.fillStyle = 'rgba(255,255,255,.6)'; c.fill();
        c.restore();
      }
    }
    // 王冠（到岸）
    if (o.crown) {
      c.save(); c.translate(0, -104 * k); c.rotate(-0.12);
      c.fillStyle = '#FFC928'; c.strokeStyle = NAVY; c.lineWidth = 2.6 * k;
      c.beginPath(); c.moveTo(-15 * k, 6 * k); c.lineTo(-17 * k, -10 * k); c.lineTo(-8 * k, -2 * k); c.lineTo(0, -14 * k); c.lineTo(8 * k, -2 * k); c.lineTo(17 * k, -10 * k); c.lineTo(15 * k, 6 * k); c.closePath();
      c.fill(); c.stroke();
      ell(c, 0, -2 * k, 3 * k, 3 * k, '#FF4D7A');
      c.restore();
    }
    c.restore();
  }

  /* ================= 规格 ================= */
  function touchOnly() {
    try { return !!(W.matchMedia && W.matchMedia('(hover: none) and (pointer: coarse)').matches); } catch (e) { return false; }
  }
  function makeSpec() {
    return {
      maxLevel: 10, lives: 3, rounds: 3, music: 'calm', sky: null,
      intro: '先听电台讲故事，再跳上写着正确答案的荷叶过河！',
      // 手机/平板上别写一串键盘键位（孩子看不懂，还占两行）
      controls: touchOnly() ? '点荷叶跳过去 · 听故事时点飞虫加分' : '点荷叶或按 1–4 跳 · ←→ 选、空格跳 · R 重听题目',
      init(g) { initLevel(g); },
      play(g) { startRadio(g); },
      update(g, dt) { update(g, dt); },
      draw(g, c) { draw(g, c); },
      down(g, p) { onDown(g, p); },
      move(g, p) { onMove(g, p); },
      key(g, k) { onKey(g, k); },
      resize(g) { if (g.F && !g.F.empty) { layout(g); moveLanes(g, 0); } },
      end(g) {
        try { g.ctx.tts.stop(); } catch (e) { /* ignore */ }
        try { if (g.c && g.c.canvas) g.c.canvas.style.cursor = ''; } catch (e) { /* ignore */ }
        if (W.__hwFrog === g) W.__hwFrog = null;
      }
    };
  }

  /* ================= 初始化 ================= */
  function ttsUsable(g) {
    let ok = false;
    try { ok = !!(g.ctx.tts && g.ctx.tts.ok); } catch (e) { ok = false; }
    if (!ok) return false;
    try { if (W.speechSynthesis && W.speechSynthesis.getVoices && W.speechSynthesis.getVoices().length === 0) return false; } catch (e) { /* ignore */ }
    return true;
  }
  function initLevel(g) {
    let st = (g.items('stories', 1) || [])[0];
    if (!validStory(st)) st = ((g.G && g.G.stories) || []).find(validStory) || null;
    const F = g.F = {
      st, empty: !st, T: 0, pal: palFor(g.level), cam: { y: 0 }, phase: 'radio', qi: 0, busy: true,
      lanes: [], qs: [], sents: [], title: '', L: null, sel: null, hover: null, hint: null, hintGo: 0,
      flies: [], flyT: 1.6, notes: [], noteT: 0, fish: [], fishT: 2.5, tongue: null,
      bug: { n: 0, streak: 0, spawnN: 0, bump: 0 }, tip: null, capRect: null,
      radio: { k: -1, pid: 0, on: false, heard: false, u: 0, cap: null, goK: 0, step: null, key: '' },
      frog: { mode: 'sit', at: { kind: 'radio' }, sx: 1, sy: 1, phones: 1, blinkT: 2, blink: 0, J: null, S: null, P: null, fall: 0, mouth: 0, party: false, sad: false },
      ban: { qi: -1, k: 0 }, throne: { bloom: 0 }, tts: ttsUsable(g), press: null
    };
    W.__hwFrog = g;
    if (F.empty) { g.rounds = 1; F.L = { s: 1 }; return; }
    F.title = String(st.title || '今日故事');
    F.radio.key = (g.grade || '') + '|' + F.title;
    F.qs = st.qs.filter(validQ);
    g.rounds = F.qs.length;
    F.sents = splitSents(st.text);
    F.lanes = F.qs.map((q, i) => {
      const order = g.shuffle(q.c.map((_, j) => j));
      return {
        i, q, state: 'wait', T: g.rand(0, 30), rows: [],
        ph: [g.rand(TAU), g.rand(TAU)], dir: (g.level >= 2 && i % 2) ? [-1, 1] : [1, -1],
        pads: order.map((idx) => ({
          text: q.c[idx], ok: idx === q.a, idx, lane: i, num: 0, lines: [], w: 100, h: 60, slot: 0, row: 0,
          x: g.w / 2, y: 0, ph: g.rand(TAU), flip: Math.random() < 0.5 ? 1 : -1, push: 0, pop: 0, sink: 0, tilt: 0,
          bad: false, gone: false, dock: null, bloom: 0, targeted: false, dip: 0, warn: 0,
          dipP: g.rand(5.5, 8), dipPh: g.rand(0, 8)
        }))
      };
    });
    layout(g);
    moveLanes(g, 0);
    F.cam.y = camTarget(g);
  }

  /* ================= 布局（g.w/g.h 变化即重算） ================= */
  function sizePads(g, fs) {
    const F = g.F, L = F.L, s = L.s, w = g.w;
    L.padFs = fs; L.padLh = Math.round(fs * 1.24);
    const gapX = 14 * s;
    const maxTW = w < 640 ? Math.max(80, (w - gapX * 3) / 2 - 34 * s) : Math.min(230 * L.us, (w - gapX * 5) / 4 - 34 * s);
    let maxBand = 0;
    F.lanes.forEach((lane) => {
      let maxH = 0, minW = 1e9;
      lane.pads.forEach((p) => {
        p.lines = g.wrapText(p.text, maxTW, fs, 'kai', 700).slice(0, 4);
        if (p.lines.length > 1) {        // 均衡换行：别让最后一行只剩一个字
          const full = g.measure(p.text, fs, 'kai', 700), k = p.lines.length;
          for (let f = 1.02; f < 1.4; f += 0.06) {
            const bal = g.wrapText(p.text, Math.min(maxTW, full / k * f + fs * 0.6), fs, 'kai', 700);
            if (bal.length === k) { p.lines = bal; break; }
          }
        }
        let tw = 0;
        p.lines.forEach((ln) => { tw = Math.max(tw, g.measure(ln, fs, 'kai', 700)); });
        p.tw = tw;
        p.h = p.lines.length * L.padLh + 26 * s;
        p.w = Math.max(tw + 38 * s, p.h * 1.3, 92 * s);
        maxH = Math.max(maxH, p.h); minW = Math.min(minW, p.w);
      });
      const n = lane.pads.length;
      const tot = lane.pads.reduce((a, p) => a + p.w, 0) + gapX * (n + 1);
      const two = n >= 2 && (tot > w || (g.level >= 3 && n >= 3));
      const rows = two ? [lane.pads.filter((_, j) => j % 2 === 0), lane.pads.filter((_, j) => j % 2 === 1)] : [lane.pads.slice()];
      const rowSep = maxH + 12 * s;
      lane.rows = rows.map((pads, r) => {
        const gw = pads.reduce((a, p) => a + p.w, 0) + gapX * (pads.length - 1);
        let x = -gw / 2;
        pads.forEach((p) => { p.slot = x + p.w / 2; p.row = r; x += p.w + gapX; });
        const mw = pads.reduce((a, p) => Math.min(a, p.w), 1e9);
        // 漂动幅度：1–2 关荷叶始终整片留在屏幕里；3 关起叶边可以探出屏幕（更难点），
        // 但**字永远不出屏**——孩子要读得到整句选项（P6 长选项漂到边上被切成半句 = 没法作答）
        const base = (w - gw) / 2 - 6 * s;
        let textL = 1e9, textR = -1e9;
        pads.forEach((p) => { textL = Math.min(textL, p.slot - p.tw / 2); textR = Math.max(textR, p.slot + p.tw / 2); });
        const ampText = Math.min(w / 2 + textL, w / 2 - textR) - 8;
        const want = g.level <= 2 ? base : g.level <= 4 ? base + mw * 0.14 : base + 6 * s + mw * (pads.length === 1 ? 0.2 : 0.28);
        const floor = g.level <= 2 ? 16 * s : g.level <= 4 ? 24 * s : 26 * s;
        const amp = Math.max(Math.min(floor, Math.max(8 * s, ampText)), Math.min(want, ampText));
        return { pads, gw, amp, yOff: two ? (r ? rowSep / 2 : -rowSep / 2) : 0, cx: w / 2 };
      });
      let num = 1;
      lane.rows.forEach((row) => row.pads.forEach((p) => { p.num = num++; }));
      lane.band = two ? rowSep + maxH : maxH;
      lane.maxH = maxH;
      maxBand = Math.max(maxBand, lane.band);
    });
    L.maxBand = maxBand;
    L.gap = Math.max(160 * s, maxBand + 60 * s);
    return 1.5 * maxBand + 130 * s <= g.h - L.top;
  }
  function layout(g) {
    const F = g.F, w = g.w, h = g.h;
    const L = F.L = {};
    L.s = clamp(Math.min(w, h * 0.75) / 390, 0.9, 1.45);
    L.hs = clamp(w / 390, 0.9, 1.25);
    L.us = clamp(w / 390, 0.95, 1.25);
    const s = L.s;
    L.fs = Math.round(64 * s);                    // 青蛙尺寸
    // 题目横幅（左边留出引擎“朗读中”小喇叭的位置）
    L.banFs = Math.round(21 * L.us);
    const left = Math.round(46 * L.hs);
    L.banW = Math.min(w - left - 10 * L.hs, 800);
    L.banX = Math.max(left, (w - L.banW) / 2);
    L.banY = g.hudTop + 14 * L.hs;
    L.spkR = Math.round(22 * L.us);
    L.banTextW = L.banW - 24 * L.us - (F.tts ? L.spkR * 2 + 14 * L.us : 0);
    let maxLines = 1;
    F.qs.forEach((q) => { maxLines = Math.max(maxLines, Math.min(3, g.wrapText(q.q, L.banTextW, L.banFs, 'kai', 700).length)); });
    L.banH = Math.max(58 * L.us, maxLines * L.banFs * 1.3 + 26 * L.us);
    L.top = L.banY + L.banH + 6 * s;
    // 荷叶：字太大放不下就逐级缩小
    let fs = Math.round(21 * L.us);
    while (!sizePads(g, fs) && fs > 15) fs--;
    // 镜头焦点：当前河道中心在屏幕上的 y；上一个落脚点在它下面 gap 处
    L.focusY = Math.max(L.top + 14 * s + L.maxBand / 2, Math.min(h - 100 * s - L.gap, L.top + (h - L.top) * 0.5));
    if (L.focusY + L.gap > h - 70 * s) L.focusY = Math.max(L.top + 8 * s + L.maxBand / 2, h - 70 * s - L.gap);
    // 世界坐标（y 向下；起点河岸水线 = 0）
    const gap = L.gap, n = F.lanes.length;
    L.startY = gap * 0.38;
    L.laneY = (i) => -gap * (0.62 + i);
    L.farShoreY = L.laneY(n - 1) - gap * 0.62;
    L.throneY = L.farShoreY - gap * 0.5;
    L.farTopY = L.farShoreY - gap * 1.3;
    // 电台场景（屏幕坐标 → 世界坐标 = 屏幕 + camR）
    L.shoreS = g.hudTop + (h - g.hudTop) * 0.3;
    L.camR = -L.shoreS;
    L.goW = Math.min(w * 0.62, 280 * L.us); L.goH = 64 * L.us;
    L.goX = w / 2 + (w < 520 ? 22 * s : 0); L.goY = h - 20 * s - L.goH / 2;
    L.rpR = 29 * L.us; L.rpX = L.goX - L.goW / 2 - 16 * s - L.rpR; L.rpY = L.goY;
    L.ribY = L.shoreS + 40 * s;
    const rTop = L.ribY + 26 * s, rBot = L.goY - L.goH / 2 - 30 * s;
    L.RW = Math.max(170, Math.min(w * 0.72, 420 * L.us, (rBot - rTop) / 1.5 / 0.6));
    L.RH = L.RW * 0.6;
    L.radioSX = w / 2 - (w < 520 ? L.RW * 0.08 : 0);
    L.radioSY = rTop + L.RH * 0.5 + L.RH / 2 + Math.max(0, (rBot - rTop) - L.RH * 1.5) * 0.35;
    L.frogRSX = Math.min(w - L.fs * 0.62, L.radioSX + L.RW * 0.42);
    L.frogRSY = L.radioSY + L.RH / 2 + 12 * s;
    L.camT = L.throneY - (g.hudTop + (h - g.hudTop) * 0.56);
    F.gw = null;
  }
  function camTarget(g) {
    const F = g.F, L = F.L;
    if (F.phase === 'radio') return L.camR;
    if (F.phase === 'toThrone' || F.phase === 'done') return L.camT;
    const qi = clamp(F.camQi || 0, 0, F.lanes.length - 1);
    let y = L.laneY(qi) - L.focusY;
    // 答错后的“提示”框挂在题目横幅下面，会压住上排选项 → 镜头下移，把这条河道让出来；
    // 但最多只移到“河道最下沿 + 青蛙脚下的落脚点”都还在屏幕里（小屏手机 360×640 会不够）——
    // 不够的部分由提示框自己收起成小“提示”签来让路（见 update 里的 T.over / T.open）
    const T = F.tip, lane = F.lanes[qi];
    if (T && T.qi === qi && F.phase === 'river' && lane && lane.rows.length) {
      const tb = tipBox(g);
      let top = 1e9, bot = -1e9;
      lane.rows.forEach((r) => { top = Math.min(top, r.yOff); bot = Math.max(bot, r.yOff); });
      const need = tb.y + tb.h + 12 * L.s - (L.focusY + top - lane.maxH / 2 - 4 * L.s);
      const room = Math.min(g.h - 10 * L.s - (L.focusY + bot + lane.maxH / 2), g.h - 8 * L.s - (L.focusY + L.gap + 14 * L.s));
      const sh = need > 0 ? Math.max(0, Math.min(need, room)) : 0;
      T.over = need - sh;                  // > 0：展开时仍会盖住上排荷叶
      y -= sh;
    }
    return y;
  }
  function tipBox(g) {
    const F = g.F, L = F.L, us = L.us, T = F.tip;
    const fs = Math.round(17 * us), lh = Math.round(fs * 1.34);
    const lines = T ? g.wrapText(T.text, L.banW - 66 * us, fs, 'kai', 700).slice(0, 3) : [];
    const chipW = Math.round(g.measure('提示 ▾', Math.round(15 * us), 'round') + 62 * us), chipH = Math.round(34 * us);
    return { x: L.banX, y: L.top + 10 * us, w: L.banW, h: lines.length * lh + 22 * us, fs, lh, lines, chipW, chipH };
  }
  /* 提示框 / 收起的提示签：当前（按 T.open 插值）的矩形 */
  function tipRect(g) {
    const T = g.F.tip, tb = tipBox(g), o = T ? clamp(T.open, 0, 1) : 1;
    return { x: tb.x, y: tb.y, w: lerp(tb.chipW, tb.w, o), h: lerp(tb.chipH, tb.h, o), tb, o };
  }

  /* ================= 位置 ================= */
  function padPos(g, p) { return { x: p.x, y: p.y + Math.min(p.h * 0.2, 14 * g.F.L.s) }; }
  function platPos(g, at) {
    const F = g.F, L = F.L;
    if (!at) return { x: g.w / 2, y: L.startY };
    if (at.kind === 'radio') return { x: L.frogRSX, y: L.frogRSY + L.camR };
    if (at.kind === 'pad') return padPos(g, at.pad);
    if (at.kind === 'throne') return { x: g.w / 2, y: L.throneY - 8 * L.s };
    return { x: g.w / 2, y: L.startY };
  }
  function swimTarget(g, at) {
    const L = g.F.L;
    if (at.kind === 'pad') { const p = at.pad; return { x: p.x, y: p.y + p.h / 2 + 16 * L.s }; }
    return { x: g.w / 2, y: 10 * L.s };
  }
  function frogPos(g) {
    const F = g.F, fg = F.frog;
    if ((fg.mode === 'jump' || fg.mode === 'hop') && fg.J) {
      const J = fg.J, t = platPos(g, J.to), k = J.k;
      const gx = lerp(J.fx, t.x, k), gy = lerp(J.fy, t.y, k);
      return { x: gx, y: gy - J.hgt * 4 * k * (1 - k), air: Math.sin(Math.PI * clamp(k, 0, 1)), gx, gy };
    }
    if (fg.mode === 'swim' && fg.S) {
      const S = fg.S, t = swimTarget(g, S.to);
      return { x: lerp(S.fx, t.x, S.k) + Math.sin(S.k * TAU * 2) * 5 * F.L.s, y: lerp(S.fy, t.y, S.k), air: 0 };
    }
    if (fg.mode === 'fall' && fg.P) return { x: fg.P.x, y: fg.P.y, air: 0 };
    const p = platPos(g, fg.at);
    return { x: p.x, y: p.y, air: 0 };
  }
  function prevPlat(g) {
    const F = g.F;
    if (F.qi <= 0) return { kind: 'bank' };
    const lane = F.lanes[F.qi - 1];
    const p = lane && lane.pads.find((x) => x.dock);
    return p ? { kind: 'pad', pad: p } : { kind: 'bank' };
  }
  function tappable(g, p) {
    const F = g.F, lane = F.lanes[p.lane];
    return !!lane && lane.state === 'active' && !p.gone && !p.bad && !p.dock && p.pop > 0.6 && p.dip < 0.45 && p.x > 6 && p.x < g.w - 6;
  }

  /* ================= 每帧更新 ================= */
  function moveLanes(g, dt) {
    const F = g.F, L = F.L, lv = g.level, s = L.s;
    const v = laneSpeed(g);
    F.lanes.forEach((lane, i) => {
      let m = 1;
      if (lv >= 4) m = 1 + 0.45 * Math.sin(F.T * 0.9 + i * 1.7);
      lane.T += dt * m;
      const baseY = L.laneY(i);
      lane.rows.forEach((row, r) => {
        const om = v / Math.max(20, row.amp);
        const ph = lane.ph[r] + lane.T * om * lane.dir[r];
        let u = Math.sin(ph);
        if (lv >= 5) u = (Math.asin(u) * 2 / Math.PI) * 0.72 + u * 0.28;
        row.cx = g.w / 2 + row.amp * u;
        row.pads.forEach((p) => {
          const bob = Math.sin(F.T * 1.7 + p.ph) * 3 * s;
          if (p.dock) {
            p.x = lerp(p.dock.x0, g.w / 2, p.dock.u);
            p.y = lerp(p.dock.y0, baseY, p.dock.u) + bob * 0.4 + p.push;
            p.dip = 0; p.warn = 0;
            return;
          }
          p.x = row.cx + p.slot;
          p.y = baseY + row.yOff + bob + p.push;
          if (lv >= 6 && lane.state === 'active' && !p.targeted && !p.bad) {
            const P = p.dipP, uu = ((lane.T + p.dipPh) % P + P) % P, d0 = P - 1.4;
            p.warn = (uu > P - 2.2 && uu < d0) ? 1 : 0;
            p.dip = uu >= d0 ? Math.sin(Math.PI * (uu - d0) / 1.4) : 0;
          } else {
            p.warn = 0; p.dip = Math.max(0, p.dip - dt * 3);
          }
        });
      });
    });
  }
  function update(g, dt) {
    const F = g.F;
    if (!F || F.empty) return;
    const L = F.L, s = L.s, fg = F.frog;
    F.T += dt;
    const tgt = camTarget(g);
    F.cam.y += (tgt - F.cam.y) * Math.min(1, dt * 3.4);
    moveLanes(g, dt);
    // 眨眼
    fg.blinkT -= dt;
    if (fg.blinkT <= 0) { fg.blinkT = g.rand(2.2, 4.5); fg.blink = 1; }
    if (fg.blink > 0) fg.blink = Math.max(0, fg.blink - dt * 7);
    const R = F.radio;
    if (F.phase === 'radio') {
      if (R.cap) {
        R.cap.t += dt;
        R.cap.n = Math.min(R.cap.len, R.cap.t * 15);
        if (R.cap.t >= R.cap.dur) capNext(g);
      }
      // 音符
      if (R.on) {
        F.noteT -= dt;
        if (F.noteT <= 0) {
          F.noteT = 0.42;
          const geo = radioGeom(g);
          F.notes.push({ x: geo.x - geo.W * 0.25 + g.rand(-10, 10) * s, y: geo.y - geo.H * 0.3, vx: g.rand(-38, -8) * s, vy: g.rand(-70, -50) * s, t: 0, life: 2.2, ch: g.pick(['♪', '♫', '♩', '♬']), col: g.pick(['#FFE45C', '#FF8FB1', '#8FE3FF', '#FFFFFF', '#B8FF8A']) });
          if (F.notes.length > 14) F.notes.shift();
        }
      }
      // 飞虫：边听故事边抓虫（播放中每 2–3 秒飞来一只，手机最多同时 2 只、宽屏 3 只；偶尔是金色萤火虫）
      F.flyT -= dt;
      let live = 0;
      F.flies.forEach((f) => { if (!f.eaten && !f.leave) live++; });
      if (F.flyT <= 0 && R.on && live < (g.w >= 640 ? 3 : 2)) {
        F.flyT = g.rand(1.8, 3.0);
        spawnFly(g);
      }
    }
    for (let i = F.notes.length - 1; i >= 0; i--) {
      const n = F.notes[i]; n.t += dt; n.x += (n.vx + Math.sin(n.t * 5) * 30 * s) * dt; n.y += n.vy * dt;
      if (n.t >= n.life) F.notes.splice(i, 1);
    }
    for (let i = F.flies.length - 1; i >= 0; i--) {
      const f = F.flies[i];
      f.t += dt;
      if (f.eaten) { if (f.t > 0.4) F.flies.splice(i, 1); continue; }
      const tx = clamp(f.cx + Math.cos(f.t * 1.05 + f.ph) * 74 * s + Math.sin(f.t * 2.6) * 14 * s, 24 * s, g.w - 24 * s);
      const ty = f.cy + Math.sin(f.t * 1.55 + f.ph) * 36 * s;
      if (f.t > f.life || F.phase !== 'radio') {
        if (!f.leave && F.phase === 'radio') F.bug.streak = 0;          // 让它飞走了：连吃中断（不扣分）
        if (!f.leave) f.vx = (f.x < g.w / 2 ? -1 : 1) * 260 * s;
        f.leave += dt; f.x += f.vx * dt; f.y -= 110 * s * dt;
        if (f.leave > 2) F.flies.splice(i, 1);
      } else { const k = Math.min(1, dt * (f.t < 1 ? 2.5 : 5)); f.x += (tx - f.x) * k; f.y += (ty - f.y) * k; }
    }
    // 跳鱼
    F.fishT -= dt;
    if (F.fishT <= 0) {
      F.fishT = g.rand(3.2, 6);
      const cam = F.cam.y, y0 = Math.max(L.farShoreY + 20 * s, cam + L.top + (F.tip ? 120 : 20) * s), y1 = Math.min(-30 * s, cam + g.h - 30 * s);
      if (y1 > y0 + 40 * s && !(F.phase === 'radio' && R.cap)) {      // 字幕框在上面时不让水花盖住字
        const dir = Math.random() < 0.5 ? 1 : -1;
        const fx = g.rand(g.w * 0.12, g.w * 0.88);
        F.fish.push({ x: fx, y: g.rand(y0, y1), dir, d: 70 * s * dir, H: g.rand(46, 70) * s, t: 0, dur: 0.95, sp: false });
        g.burst(fx, F.fish[F.fish.length - 1].y - cam, { kind: 'water', n: 6 });
      }
    }
    for (let i = F.fish.length - 1; i >= 0; i--) {
      const f = F.fish[i]; f.t += dt;
      if (!f.sp && f.t >= f.dur) { f.sp = true; g.burst(f.x + f.d, f.y - F.cam.y, { kind: 'water', n: 8 }); g.ring(f.x + f.d, f.y - F.cam.y, 'rgba(255,255,255,.8)', 34 * s); }
      if (f.t > f.dur + 0.1) F.fish.splice(i, 1);
    }
    if (fg.party && fg.mode === 'sit') fg.mouth = 0.6;
    // 小屏：提示框展开时会压住选项 → 青蛙游回来、可以再跳之后 3 秒自动收成“提示”小签（点一下再展开）
    const T = F.tip;
    if (T && F.phase === 'river' && T.qi === F.qi && !F.busy && T.over > 4 && T.open > 0.99 && !T.tw) {
      T.t += dt;
      if (T.t > 3.2) { T.tw = g.tween(T, { open: 0 }, 0.35, 'inOutQuad', () => { T.tw = null; }); }
    }
  }

  /* ================= 电台 ================= */
  function startRadio(g) {
    const F = g.F;
    if (!F || F.empty) return;
    g.music('calm');
    // 声音列表是异步加载的：选关时还没有、倒计时后有了（或反过来）→ 开播前再确认一次
    const tts = ttsUsable(g);
    if (tts !== F.tts) { F.tts = tts; layout(g); moveLanes(g, 0); F.cam.y = camTarget(g); }
    const R = F.radio;
    // 这个故事刚才已经完整听过（重玩本关 / 错题重练抽到同一篇）：一开始就给“过河去！”，想再听也可以接着听
    if (HEARD.has(R.key)) { R.heard = true; R.goK = 0; g.tween(R, { goK: 1 }, 0.55, 'outBack'); }
    radioPlay(g, 0);
  }
  function sentPulse(g) {
    const F = g.F, s = F.L.s, geo = radioGeom(g);
    const x = geo.x - geo.W * 0.24, y = geo.y - F.cam.y + geo.H * 0.05;
    g.ring(x, y, 'rgba(255,255,255,.85)', geo.W * 0.55);
    for (let i = 0; i < 3; i++) {
      F.notes.push({ x: x + g.rand(-20, 20) * s, y: geo.y - geo.H * 0.3, vx: g.rand(-60, 30) * s, vy: g.rand(-110, -70) * s, t: 0, life: 1.8, ch: g.pick(['♪', '♫', '♬']), col: g.pick(['#FFE45C', '#FF8FB1', '#8FE3FF', '#B8FF8A']) });
    }
    while (F.notes.length > 18) F.notes.shift();
    const fg = F.frog;
    if (fg.mode === 'sit') { fg.sx = 1.12; fg.sy = 0.9; g.tween(fg, { sx: 1, sy: 1 }, 0.45, 'outElastic'); }
  }
  function spawnFly(g) {
    const F = g.F, L = F.L, s = L.s, B = F.bug;
    B.spawnN++;
    const gold = B.spawnN >= 3 && !B.lastGold && Math.random() < 0.18;
    B.lastGold = gold;
    // 活动区（屏幕坐标）：标题牌下面 ~ 底部按钮上面；存世界坐标 = 屏幕 + 镜头
    const top = L.ribY + 40 * s, bot = L.goY - L.goH / 2 - 30 * s;
    const cy = (bot - top > 80 * s ? g.rand(top + 36 * s, bot - 36 * s) : (top + bot) / 2) + F.cam.y;
    const cx = g.rand(80 * s, g.w - 80 * s);
    const side = Math.random() < 0.5 ? -1 : 1;
    F.flies.push({ cx, cy, t: 0, life: g.rand(5, 6.5) + (gold ? -1 : 0), ph: g.rand(TAU), x: side < 0 ? -40 : g.w + 40, y: cy - 40 * s, leave: 0, vx: 0, gold, eaten: false });
    g.sfx('whoosh');
  }
  function radioPlay(g, from) {
    const F = g.F, R = F.radio;
    const my = ++R.pid;
    try { g.ctx.tts.stop(); } catch (e) { /* ignore */ }
    R.on = true; R.k = from; R.cap = null;
    g.sfx('flip');
    const step = () => {
      if (my !== R.pid || g.F !== F || F.phase !== 'radio') return;
      if (R.k >= F.sents.length) { R.on = false; R.k = F.sents.length; radioDone(g); return; }
      sentPulse(g);
      if (F.tts) {
        const k = R.k, t0 = clock(), len = Array.from(F.sents[k]).length;
        g.say(F.sents[k], { caption: '' }).then(() => {
          if (my !== R.pid || g.F !== F) return;
          const intr = g.state === 'pause';
          // 朗读“秒完”（有 zh 声音但引擎其实没出声：iOS 没解锁 / 声音包坏了）：先重读一次，
          // 连着两次都秒完就改成逐句字幕——否则整篇故事几秒钟“播完”，孩子一个字也没听到就要答题
          const quick = !intr && clock() - t0 < Math.min(0.8, 0.06 * len + 0.2);
          if (quick) {
            R.fast = (R.fast || 0) + 1;
            if (R.fast >= 2) { R.fast = 0; F.tts = false; layout(g); moveLanes(g, 0); }
            g.after(0.25, () => { if (my === R.pid && F.phase === 'radio') step(); });
            return;
          }
          R.fast = 0;
          g.after(intr ? 0.15 : 0.4, () => { if (my !== R.pid || F.phase !== 'radio') return; if (!intr) R.k = k + 1; step(); });
        });
      } else {
        const len = Array.from(F.sents[R.k]).length;
        R.cap = { k: R.k, t: 0, n: 0, len, dur: 1.4 + len * clamp(0.3 - g.gradeNum * 0.02, 0.17, 0.28) };
      }
    };
    R.step = step;
    if (F.tts && from === 0) {
      g.say('今天的故事：' + F.title + '。', { caption: '' }).then(() => {
        if (my !== R.pid || g.F !== F) return;
        g.after(0.35, () => { if (my === R.pid) step(); });
      });
    } else step();
  }
  function capNext(g) {
    const R = g.F.radio;
    if (!R.cap) return;
    R.k = R.cap.k + 1; R.cap = null;
    if (R.step) R.step();
  }
  function radioDone(g) {
    const F = g.F, R = F.radio;
    const first = !R.heard;
    R.heard = true;
    HEARD.add(R.key);
    if (first) { R.goK = 0; g.tween(R, { goK: 1 }, 0.55, 'outBack'); F.hintGo = F.T + 1.4; }
    g.sfx('match');
  }
  function goRiver(g) {
    const F = g.F, R = F.radio, fg = F.frog, s = F.L.s;
    if (F.phase !== 'radio' || !R.heard) return;
    R.pid++; R.on = false; R.cap = null;
    try { g.ctx.tts.stop(); } catch (e) { /* ignore */ }
    F.phase = 'toRiver'; F.busy = true; F.hintGo = 0;
    g.sfx('whoosh'); g.sfx('pop');
    g.music('bright');
    g.tween(R, { u: 1 }, 0.85, 'inOutQuad');
    const hp = frogScreen(g);
    g.burst(hp.x, hp.y - F.L.fs * 0.9, { kind: 'star', n: 8, color: '#FFC928' });
    g.tween(fg, { phones: 0 }, 0.25, 'inQuad');
    const from = frogPos(g);
    fg.J = { fx: from.x, fy: from.y, to: { kind: 'bank' }, k: 0, hgt: 70 * s };
    fg.mode = 'jump';
    g.sfx('jump');
    g.tween(fg.J, { k: 1 }, 0.7, 'linear', () => { landSimple(g, { kind: 'bank' }); });
    g.after(0.8, () => { startLane(g, 0); });
  }

  /* ================= 过河 ================= */
  function startLane(g, i) {
    const F = g.F, lane = F.lanes[i];
    if (!lane) return;
    F.phase = 'river'; F.qi = i; F.camQi = i; F.tip = null;
    lane.state = 'active';
    lane.pads.forEach((p, j) => { p.pop = 0; g.after(0.12 + j * 0.1, () => { g.tween(p, { pop: 1 }, 0.45, 'outBack'); g.sfx('bubble'); }); });
    F.ban.qi = i; F.ban.k = 0;
    g.tween(F.ban, { k: 1 }, 0.55, 'outBack');
    F.sel = null; F.hover = null;
    g.after(0.3 + lane.pads.length * 0.1, () => {
      if (F.phase !== 'river' || F.qi !== i) return;
      F.busy = false;
      if (i === 0) F.hint = { t0: F.T };
    });
    sayQ(g);
  }
  function sayQ(g) {
    const F = g.F, q = F.qs[F.qi];
    if (!q || !F.tts) return;
    g.say(q.q, { caption: '' });
  }
  function frogScreen(g) { const p = frogPos(g); return { x: p.x, y: p.y - g.F.cam.y }; }
  function jumpToPad(g, pad) {
    const F = g.F, fg = F.frog, L = F.L;
    if (F.busy || F.phase !== 'river' || !tappable(g, pad)) return;
    F.busy = true; F.hint = null; F.sel = null;
    pad.targeted = true;
    try { g.ctx.tts.stop(); } catch (e) { /* ignore */ }
    const from = frogPos(g);
    const pp = padPos(g, pad);
    const dist = Math.hypot(pp.x - from.x, pp.y - from.y);
    const dur = clamp(0.44 + dist / 1500, 0.46, 0.72);
    fg.J = { fx: from.x, fy: from.y, to: { kind: 'pad', pad }, k: 0, hgt: Math.min(L.gap * 0.5, 36 * L.s + dist * 0.28) };
    fg.mode = 'jump';
    fg.sx = 1.25; fg.sy = 0.75;
    g.tween(fg, { sx: 0.84, sy: 1.22 }, dur * 0.45, 'outQuad');
    g.sfx('jump');
    const sp = { x: from.x, y: from.y - F.cam.y };
    g.burst(sp.x, sp.y, { kind: 'dot', color: 'rgba(255,255,255,.9)', n: 8 });
    g.tween(fg.J, { k: 1 }, dur, 'linear', () => land(g, pad));
  }
  function squash(g) {
    const fg = g.F.frog;
    fg.sx = 1.36; fg.sy = 0.64;
    g.tween(fg, { sx: 1, sy: 1 }, 0.6, 'outElastic');
  }
  function landSimple(g, at) {
    const fg = g.F.frog;
    fg.mode = 'sit'; fg.at = at; fg.J = null;
    squash(g);
    g.sfx('pop');
  }
  function land(g, pad) {
    const F = g.F, fg = F.frog, s = F.L.s;
    fg.mode = 'sit'; fg.at = { kind: 'pad', pad }; fg.J = null;
    squash(g);
    pad.push = 10 * s;
    g.tween(pad, { push: 0 }, 0.7, 'outElastic');
    const sp = { x: pad.x, y: pad.y - F.cam.y };
    g.ring(sp.x, sp.y, 'rgba(255,255,255,.9)', pad.w * 0.7);
    g.burst(sp.x, sp.y + pad.h * 0.3, { kind: 'water', n: 10 });
    g.sfx('bubble');
    if (pad.ok) onCorrect(g, pad, sp); else onWrong(g, pad, sp);
  }
  function onCorrect(g, pad, sp) {
    const F = g.F, s = F.L.s, lane = F.lanes[pad.lane];
    lane.state = 'done'; F.tip = null;
    pad.dock = { x0: pad.x, y0: pad.y - pad.push, u: 0 };
    g.tween(pad.dock, { u: 1 }, 0.85, 'inOutQuad');
    g.tween(pad, { bloom: 1 }, 0.7, 'outBack');
    lane.pads.forEach((o) => {
      if (o === pad || o.gone) return;
      g.tween(o, { sink: 1 }, 0.75, 'inQuad', () => { o.gone = true; });
      g.burst(o.x, o.y - F.cam.y, { kind: 'water', n: 5 });
    });
    F.frog.mouth = 1; g.tween(F.frog, { mouth: 0 }, 0.8, 'inQuad');
    const first = !lane.pads.some((o) => o.bad);           // 这一题没有落过水 = 一次跳对（+10 奖励）
    const last = F.qi + 1 >= F.qs.length;
    // 飘字只出一个总分：以前“一次跳对！+10”和引擎的“+10/+20”叠在一起，像加了两次
    g.float(first ? (last ? '一次跳对！+10' : '一次跳对！') : g.pick(['答对啦！', '真棒！', '好耳朵！', '稳稳的！']), clamp(sp.x, 105 * s, g.w - 105 * s), sp.y - 86 * s, { color: first ? '#FFE45C' : '#B6FF8A', size: 30 });
    if (first) g.addScore(10);
    F.qi++;
    if (!last) {
      const c1 = g.combo + 1, mult = c1 >= 10 ? 4 : c1 >= 6 ? 3 : c1 >= 3 ? 2 : 1;   // 与引擎 g.right 的连击倍率一致
      g.right(F.st, sp.x, sp.y - 24 * s, '+' + (10 * mult + (first ? 10 : 0)));
      g.after(1.0, () => { if (g.state === 'play') startLane(g, F.qi); });
    } else {
      g.burst(sp.x, sp.y, { kind: 'star', n: 16 });
      g.ring(sp.x, sp.y, '#FFE45C', 110 * s);
      g.sfx('good');
      F.phase = 'toThrone'; F.ban.qi = -1;
      g.after(1.05, () => jumpThrone(g));
    }
  }
  function jumpThrone(g) {
    const F = g.F, fg = F.frog, s = F.L.s;
    if (g.state !== 'play') return;
    const from = frogPos(g);
    fg.J = { fx: from.x, fy: from.y, to: { kind: 'throne' }, k: 0, hgt: F.L.gap * 0.75 };
    fg.mode = 'jump';
    fg.sx = 1.25; fg.sy = 0.75; g.tween(fg, { sx: 0.84, sy: 1.25 }, 0.4, 'outQuad');
    g.sfx('jump'); g.sfx('whoosh');
    g.tween(fg.J, { k: 1 }, 0.9, 'linear', () => {
      fg.mode = 'sit'; fg.at = { kind: 'throne' }; fg.J = null;
      squash(g);
      F.phase = 'done'; fg.party = true;
      g.tween(F.throne, { bloom: 1 }, 0.9, 'outElastic');
      const p = frogScreen(g);
      g.burst(p.x, p.y - 30 * s, { kind: 'star', n: 24, color: '#FFD23F' });
      g.burst(p.x, p.y - 30 * s, { kind: 'confetti', n: 40 });
      g.ring(p.x, p.y - 20 * s, '#FFE45C', 160 * s);
      g.flash('#FFF6C0');
      g.sfx('power');
      g.float('到对岸啦！', clamp(p.x, 110 * s, g.w - 110 * s), p.y - 140 * s, { color: '#FFE45C', size: 42, life: 1.8 });
      // 先让青蛙戴着王冠在荷花宝座上蹦跶一会儿（烟花 + 花瓣雨），再记最后一题 → 引擎结算
      // （以前落地同一帧就 g.right 通关，0.5 秒后结算遮罩盖上来，孩子根本看不到“到对岸”的庆祝）
      for (let i = 0; i < 3; i++) {
        g.after(0.28 + i * 0.3, () => {
          const fx = g.w * (0.22 + 0.28 * i) + g.rand(-20, 20) * s, fy = g.hudTop + g.rand(40, 120) * s;
          g.burst(fx, fy, { kind: i === 1 ? 'star' : 'confetti', n: 22, color: ['#FF6FA8', '#FFE45C', '#8FE3FF'][i] });
          g.ring(fx, fy, ['#FF6FA8', '#FFE45C', '#8FE3FF'][i], 70 * s);
          g.sfx('pop');
        });
      }
      g.after(1.25, () => { if (g.state === 'play') g.right(F.st, p.x, p.y - 60 * s); });
    });
  }
  function onWrong(g, pad, sp) {
    const F = g.F, fg = F.frog;
    pad.bad = true;
    const q = F.qs[pad.lane];
    fg.sad = true;
    g.tween(pad, { tilt: 1 }, 0.32, 'inQuad');
    g.after(0.3, () => {
      const P = frogPos(g);
      fg.mode = 'fall'; fg.P = { x: P.x, y: P.y }; fg.fall = 0;
      g.tween(fg, { fall: 1 }, 0.22, 'inQuad', () => splash(g, pad, q));
    });
  }
  function splash(g, pad, q) {
    const F = g.F, fg = F.frog, s = F.L.s;
    const sp = { x: fg.P.x, y: fg.P.y - F.cam.y };
    g.sfx('splash');
    g.burst(sp.x, sp.y, { kind: 'water', n: 30 });
    g.ring(sp.x, sp.y, '#E6FBFF', 100 * s);
    // “扑通！”放到水花侧面（引擎的红 ✗ 在正上方往上飘，别叠在一起）
    const dx = sp.x < g.w / 2 ? 1 : -1;
    g.float('扑通！', clamp(sp.x + dx * 96 * s, 60 * s, g.w - 60 * s), sp.y + 6 * s, { color: '#BFF3FF', size: 28 });
    g.tween(pad, { sink: 1 }, 0.9, 'inQuad', () => { pad.gone = true; });
    const to = prevPlat(g);
    fg.mode = 'swim'; fg.S = { fx: fg.P.x, fy: fg.P.y, k: 0, to };
    const ex = (typeof q.e === 'string' && q.e.trim()) ? q.e.trim() : '';
    const note = '《' + F.title + '》' + q.q + ' 正确答案：' + q.c[q.a] + '；你选了：' + pad.text + (ex ? '（' + ex + '）' : '');
    g.wrong(F.st, note, sp.x, sp.y - 30 * s);
    if (g.state !== 'play') return;          // 心没了：引擎进入失败结算，青蛙留在水里
    // 电台小提示：把题库里的讲解 e（故事原句）亮出来，游回去后读一遍，再跳一次
    F.tip = { text: ex || '再想想：故事里是怎么说的？', say: !!ex, said: false, qi: pad.lane, k: 0, open: 1, t: 0, over: 0 };
    g.tween(F.tip, { k: 1 }, 0.45, 'outBack');
    g.tween(fg.S, { k: 1 }, 1.15, 'inOutQuad', () => hopBack(g, to));
  }
  function hopBack(g, to) {
    const F = g.F, fg = F.frog, s = F.L.s;
    const from = frogPos(g);
    fg.J = { fx: from.x, fy: from.y, to, k: 0, hgt: 40 * s };
    fg.mode = 'hop'; fg.S = null;
    g.sfx('jump');
    g.tween(fg.J, { k: 1 }, 0.38, 'linear', () => {
      fg.mode = 'sit'; fg.at = to; fg.J = null; fg.sad = false;
      squash(g);
      const p = frogScreen(g);
      g.burst(p.x, p.y - F.L.fs * 0.5, { kind: 'water', n: 12 });
      if (F.phase === 'river') {
        F.busy = false;
        const T = F.tip;
        if (T && T.say && !T.said && F.tts && T.qi === F.qi) { T.said = true; g.say(T.text, { caption: '' }); }
      }
    });
  }

  /* ================= 输入 ================= */
  function hitPad(g, p) {
    const F = g.F, lane = F.lanes[F.qi];
    if (!lane) return null;
    const cam = F.cam.y, s = F.L.s;
    let best = null, bd = 1e9;
    lane.pads.forEach((pd) => {
      if (!tappable(g, pd)) return;
      const dx = Math.abs(p.x - pd.x), dy = Math.abs(p.y - (pd.y - cam));
      if (dx <= pd.w / 2 + 8 * s && dy <= pd.h / 2 + 10 * s) { const d = dx + dy; if (d < bd) { bd = d; best = pd; } }
    });
    return best;
  }
  function hitSunk(g, p) {
    const F = g.F, lane = F.lanes[F.qi], cam = F.cam.y;
    if (!lane || lane.state !== 'active') return false;
    return lane.pads.some((pd) => !pd.gone && !pd.bad && !pd.dock && !tappable(g, pd) &&
      Math.abs(p.x - pd.x) <= pd.w / 2 + 8 && Math.abs(p.y - (pd.y - cam)) <= pd.h / 2 + 10);
  }
  function hitFuture(g, p) {
    const F = g.F, cam = F.cam.y;
    return F.lanes.some((lane) => lane.state === 'wait' && lane.pads.some((pd) => !pd.gone && Math.abs(p.x - pd.x) <= pd.w / 2 && Math.abs(p.y - (pd.y - cam)) <= pd.h / 2));
  }
  function hitSpk(g, p) {
    const F = g.F, L = F.L;
    if (!F.tts || F.ban.qi < 0) return false;
    const bx = L.banX + L.banW - L.spkR - 10 * L.us, by = banYNow(g) + L.banH / 2;
    return g.hitCircle(p, bx, by, L.spkR + 8);
  }
  function banYNow(g) { const F = g.F, L = F.L; return L.banY - (1 - F.ban.k) * (L.banH + L.banY + 10); }
  function onDown(g, p) {
    const F = g.F;
    if (!F || F.empty) return;
    const L = F.L, s = L.s, R = F.radio;
    if (F.phase === 'radio') {
      // 飞虫
      let hitF = null, hd = 1e9;
      for (const f of F.flies) {
        if (f.eaten || f.leave > 0) continue;
        const d = Math.hypot(p.x - f.x, p.y - (f.y - F.cam.y));
        if (d <= 40 * s && d < hd) { hd = d; hitF = f; }
      }
      if (hitF) { eatFly(g, hitF); return; }
      if (R.heard) {
        if (g.hitRect(p, L.goX - L.goW / 2, L.goY - L.goH / 2, L.goW, L.goH + 8)) { F.press = 'go'; g.after(0.08, () => { F.press = null; goRiver(g); }); return; }
        if (g.hitCircle(p, L.rpX, L.rpY, L.rpR + 8)) { F.press = 'rp'; g.after(0.1, () => { F.press = null; }); if (!R.on) radioPlay(g, 0); return; }
      }
      // 字幕：只有点字幕框或收音机才翻下一句（抓飞虫点空了不会把句子跳过去）
      const cr = F.capRect, geo = radioGeom(g);
      const onCap = !!cr && g.hitRect(p, cr.x, cr.y, cr.w, cr.h);
      const onRadio = g.hitRect(p, geo.x - geo.W / 2, geo.y - F.cam.y - geo.H / 2, geo.W, geo.H);
      if (R.cap && (onCap || onRadio)) {
        if (R.cap.n < R.cap.len - 0.5) R.cap.t = Math.max(R.cap.t, R.cap.len / 15 + 0.01);
        else capNext(g);
        g.sfx('tick');
      }
      return;
    }
    if (F.phase === 'river') {
      const T = F.tip;
      if (T && T.qi === F.qi && T.k > 0.5 && !T.tw) {
        const r = tipRect(g);
        if (g.hitRect(p, r.x, r.y - 10 * L.us, r.w, r.h + 10 * L.us)) {
          if (T.open < 0.5) { T.t = 0; T.tw = g.tween(T, { open: 1 }, 0.3, 'outBack', () => { T.tw = null; }); g.sfx('flip'); return; }
          if (T.over > 4) { T.tw = g.tween(T, { open: 0 }, 0.3, 'inOutQuad', () => { T.tw = null; }); g.sfx('flip'); return; }
        }
      }
      if (hitSpk(g, p)) { sayQ(g); g.sfx('tick'); F.spkBump = 1; g.tween(F, { spkBump: 0 }, 0.4, 'outQuad'); return; }
      if (F.busy) return;
      const pad = hitPad(g, p);
      if (pad) jumpToPad(g, pad);
      else if (hitSunk(g, p)) {
        // 点到正在下潜 / 还没冒出来的荷叶：告诉孩子“等一下”，别让他以为点不动（卡住了）
        if (!F.sunkT || F.T - F.sunkT > 0.9) { F.sunkT = F.T; g.float('等它浮上来！', clamp(p.x, 80 * s, g.w - 80 * s), p.y - 30 * s, { color: '#DDF6FF', size: 22 }); g.sfx('bubble'); }
      } else if (hitFuture(g, p)) {
        if (!F.futT || F.T - F.futT > 1.2) { F.futT = F.T; g.float('先跳近处这一排！', p.x, p.y - 30 * s, { color: '#FFFFFF', size: 22 }); g.sfx('tick'); }
      } else { const fp = frogScreen(g); if (g.hitCircle(p, fp.x, fp.y - L.fs * 0.45, L.fs * 0.6)) { F.frog.sx = 1.2; F.frog.sy = 0.8; g.tween(F.frog, { sx: 1, sy: 1 }, 0.4, 'outElastic'); g.sfx('bubble'); } }
    }
  }
  function onMove(g, p) {
    const F = g.F;
    if (!F || F.empty) return;
    let hov = null, cur = '';
    if (F.phase === 'river' && !F.busy) { hov = hitPad(g, p); if (hov || hitSpk(g, p)) cur = 'pointer'; }
    else if (F.phase === 'radio' && F.radio.heard) {
      const L = F.L;
      if (g.hitRect(p, L.goX - L.goW / 2, L.goY - L.goH / 2, L.goW, L.goH) || g.hitCircle(p, L.rpX, L.rpY, L.rpR)) cur = 'pointer';
    }
    F.hover = hov;
    try { g.c.canvas.style.cursor = cur; } catch (e) { /* ignore */ }
  }
  function eatFly(g, f) {
    const F = g.F, s = F.L.s, B = F.bug, fg = F.frog;
    f.eaten = true; f.t = 0;
    B.n++; B.streak++;
    B.bump = 1; g.tween(B, { bump: 0 }, 0.5, 'outQuad');
    const fp = frogPos(g);
    F.tongue = { k: 0, x: f.x, y: f.y, fx: fp.x, fy: fp.y };
    fg.mouth = 1;
    g.tween(F.tongue, { k: 1 }, 0.09, 'outQuad', () => {
      g.tween(F.tongue, { k: 0 }, 0.14, 'inQuad', () => {
        F.tongue = null; g.tween(fg, { mouth: 0 }, 0.25);
        if (fg.mode === 'sit') { fg.sx = 1.22; fg.sy = 0.82; g.tween(fg, { sx: 1, sy: 1 }, 0.5, 'outElastic'); }
      });
    });
    g.sfx('chomp');
    if (f.gold) g.sfx('coin');
    const sx = f.x, sy = f.y - F.cam.y;
    g.burst(sx, sy, { kind: f.gold ? 'star' : 'dot', color: '#FFE45C', n: f.gold ? 14 : 9 });
    // 连吃越多越值钱：5 → 6 → 7 … 最多 10；金萤火虫 15（答题才是大头：答对 10×连击倍率，一次跳对再 +10）
    const pts = f.gold ? 15 : 5 + Math.min(B.streak - 1, 5);
    g.addScore(pts, sx, sy - 20 * s);
    const lbl = f.gold ? '金萤火虫！' : B.streak >= 2 ? '连吃×' + B.streak + '！' : g.pick(['好吃！', '啊呜！', '吧唧！']);
    g.float(lbl, clamp(sx, 70 * s, g.w - 70 * s), sy - 54 * s, { color: f.gold ? '#FFE45C' : B.streak >= 3 ? '#FFB547' : '#FFD0E0', size: B.streak >= 3 || f.gold ? 26 : 22 });
    if (f.gold || B.streak % 3 === 0) g.ring(sx, sy, f.gold ? '#FFE45C' : '#FFB547', 60 * s);
  }
  function onKey(g, k) {
    const F = g.F;
    if (!F || F.empty) return;
    const R = F.radio;
    if (F.phase === 'radio') {
      if (k === 'space' || k === 'enter' || k === 'up') {
        if (R.heard) goRiver(g);
        else if (R.cap) { if (R.cap.n < R.cap.len - 0.5) R.cap.t = Math.max(R.cap.t, R.cap.len / 15 + 0.01); else capNext(g); }
      } else if ((k === 'r' || k === 'R') && R.heard && !R.on) radioPlay(g, 0);
      return;
    }
    if (F.phase !== 'river') return;
    if (k === 'r' || k === 'R') { sayQ(g); return; }
    if (F.busy) return;
    const lane = F.lanes[F.qi];
    if (!lane) return;
    const ps = lane.pads.filter((p) => tappable(g, p));
    if (/^[1-9]$/.test(k)) {
      const pad = lane.pads.find((p) => p.num === +k);
      if (pad && tappable(g, pad)) jumpToPad(g, pad);
      else if (pad) g.sfx('tick');
      return;
    }
    if (!ps.length) return;
    if (k === 'left' || k === 'right' || k === 'down') {
      const byX = ps.slice().sort((a, b) => a.x - b.x);
      let i = F.sel ? byX.indexOf(F.sel) : -1;
      if (i < 0) i = k === 'left' ? byX.length - 1 : 0;
      else i = (i + (k === 'left' ? -1 : 1) + byX.length) % byX.length;
      F.sel = byX[i]; F.hint = null;
      g.sfx('tick');
    } else if (k === 'space' || k === 'enter' || k === 'up') {
      if (F.sel && tappable(g, F.sel)) jumpToPad(g, F.sel);
      else { F.sel = ps.slice().sort((a, b) => a.x - b.x)[0]; g.sfx('tick'); }
    }
  }

  /* ================= 绘制 ================= */
  function draw(g, c) {
    const F = g.F;
    if (!F) return;
    const rt = clock();
    if (F.empty) {
      c.fillStyle = '#27B0D5'; c.fillRect(-40, -40, g.w + 80, g.h + 80);
      g.shadowText('这个年级的故事还在准备中～', g.w / 2, g.h / 2, { size: 26, font: 'round', maxW: g.w - 40 });
      return;
    }
    drawWater(g, c, rt);
    drawFarBank(g, c, rt);
    drawRiverDecor(g, c, rt);
    drawStartBank(g, c, rt);
    drawForeground(g, c, rt);
    drawBugs(g, c, rt);
    drawFish(g, c, rt);
    drawLanes(g, c, rt);
    drawRadio(g, c, rt);
    drawFrogAll(g, c, rt);
    drawAir(g, c, rt);
    drawUI(g, c, rt);
  }

  function drawWater(g, c, rt) {
    const F = g.F, L = F.L, P = F.pal, w = g.w, h = g.h, s = L.s, cam = F.cam.y;
    if (!F.gw) { const gr = c.createLinearGradient(0, 0, 0, h); gr.addColorStop(0, P.w[0]); gr.addColorStop(0.55, P.w[1]); gr.addColorStop(1, P.w[2]); F.gw = gr; }
    c.fillStyle = F.gw; c.fillRect(-40, -40, w + 80, h + 80);
    const y0 = Math.max(-20, L.farShoreY - cam), y1 = Math.min(h + 20, -cam + 10);
    if (y1 <= y0) return;
    // 光斑带（水下的亮纹，随时间缓慢移动）
    c.save();
    c.globalAlpha = P.id === 'night' ? 0.08 : 0.13;
    c.fillStyle = '#FFFFFF';
    for (let i = 0; i < 5; i++) {
      const x = ((i * 0.23 + rt * 0.012) % 1.2 - 0.1) * w;
      c.beginPath(); c.moveTo(x, y0); c.lineTo(x + 50 * s, y0); c.lineTo(x + 140 * s, y1); c.lineTo(x + 70 * s, y1); c.closePath(); c.fill();
    }
    c.restore();
    // 水纹（往右流）
    const RS = 34 * s;
    const r0 = Math.floor((y0 + cam) / RS), r1 = Math.ceil((y1 + cam) / RS);
    c.lineWidth = 2.2 * s; c.lineCap = 'round'; c.strokeStyle = P.rip;
    for (let r = r0; r <= r1; r++) {
      const y = r * RS - cam + Math.sin(rt * 0.8 + r) * 2 * s;
      if (y < y0 || y > y1) continue;
      const per = (86 + fr(r) * 40) * s, off = (rt * (14 + fr(r * 1.3) * 18) * s + fr(r * 2.7) * per) % per;
      c.globalAlpha = 0.18 + 0.22 * fr(r * 2.1);
      c.beginPath();
      for (let x = -per + off; x < w + per; x += per) {
        c.moveTo(x, y); c.quadraticCurveTo(x + 11 * s, y - 4.5 * s, x + 22 * s, y); c.quadraticCurveTo(x + 33 * s, y + 4.5 * s, x + 44 * s, y);
      }
      c.stroke();
      const a = Math.sin(rt * 2.3 + r * 1.9);
      if (a > 0.35) { c.globalAlpha = a; sparkle(c, fr(r * 9.1) * w, y - 6 * s, 4.5 * a * s, P.glint); }
    }
    c.globalAlpha = 1;
    // 夜晚：月亮倒影
    if (P.id === 'night') {
      // 月光在水面上碎成一串晃动的亮片（与天上的月亮同一个 x）
      c.lineCap = 'round';
      for (let i = 0; i < 9; i++) {
        const yy = y0 + ((i * 61 + rt * 10) % Math.max(60, y1 - y0));
        const ww = (10 + 26 * Math.abs(Math.sin(rt * 1.3 + i * 2.1))) * s;
        const xx = w * 0.2 + Math.sin(rt * 0.9 + i * 1.7) * 14 * s;
        c.globalAlpha = 0.14 + 0.16 * Math.abs(Math.sin(rt * 2 + i));
        c.strokeStyle = '#FFF0BE'; c.lineWidth = 3 * s;
        c.beginPath(); c.moveTo(xx - ww / 2, yy); c.lineTo(xx + ww / 2, yy); c.stroke();
      }
      c.globalAlpha = 1;
    }
  }

  function drawRiverDecor(g, c, rt) {
    const F = g.F, L = F.L, P = F.pal, w = g.w, h = g.h, s = L.s, cam = F.cam.y;
    const y0 = Math.max(L.top - 40, L.farShoreY - cam + 30 * s), y1 = Math.min(h + 40, -cam - 20 * s);
    if (y1 <= y0) return;
    const DS = 150 * s;
    const r0 = Math.floor((y0 + cam) / DS) - 1, r1 = Math.ceil((y1 + cam) / DS) + 1;
    for (let r = r0; r <= r1; r++) {
      for (let side = 0; side < 2; side++) {
        const seed = r * 2 + side;
        const y = r * DS + fr(seed * 3.1) * DS * 0.6 - cam;
        if (y < y0 - 30 || y > y1 + 30) continue;
        const x = side ? w - (14 + fr(seed * 5.3) * 26) * s : (14 + fr(seed * 5.3) * 26) * s;
        const tp = fr(seed * 7.7);
        if (tp < 0.5) {             // 小睡莲丛
          for (let j = 0; j < 3; j++) {
            const px = x + (j - 1) * 20 * s * (side ? -1 : 1) + fr(seed + j) * 8 * s, py = y + (j % 2) * 16 * s + Math.sin(rt * 1.2 + seed + j) * 2 * s;
            const rr = (11 + fr(seed * 3 + j) * 8) * s;
            c.save(); c.translate(px, py); c.rotate(fr(seed * 11 + j) * TAU);
            c.beginPath(); c.moveTo(0, 0); c.arc(0, 0, rr, 0.35, TAU - 0.1); c.closePath();
            c.fillStyle = j % 2 ? '#3FA84A' : '#56BF55'; c.fill();
            c.lineWidth = 1.6 * s; c.strokeStyle = 'rgba(20,70,40,.5)'; c.stroke();
            c.restore();
          }
          if (fr(seed * 13.1) < 0.6) drawLotus(c, x + (side ? -8 : 8) * s, y - 4 * s, 13 * s, rt + seed, fr(seed * 17) < 0.5 ? '#FF8FB8' : '#FFFFFF');
        } else if (tp < 0.8) {      // 芦苇
          c.lineCap = 'round';
          for (let j = 0; j < 4; j++) {
            const bx = x + (j - 1.5) * 7 * s, sw = Math.sin(rt * 1.4 + seed + j * 0.7) * 5 * s, hh = (38 + fr(seed * 4 + j) * 26) * s;
            c.strokeStyle = P.reed; c.lineWidth = 3 * s;
            c.beginPath(); c.moveTo(bx, y + 8 * s); c.quadraticCurveTo(bx, y - hh * 0.5, bx + sw, y - hh); c.stroke();
            if (j % 2 === 0) { c.strokeStyle = '#8A5A33'; c.lineWidth = 6 * s; c.beginPath(); c.moveTo(bx + sw * 0.9, y - hh + 2 * s); c.lineTo(bx + sw, y - hh - 12 * s); c.stroke(); }
          }
          ell(c, x, y + 8 * s, 18 * s, 4 * s, 'rgba(255,255,255,.25)');
        } else {                    // 石头
          ell(c, x, y + 6 * s, 24 * s, 7 * s, 'rgba(0,30,60,.18)');
          ell(c, x, y, 20 * s, 13 * s, '#9AA7B5', NAVY, 2 * s);
          ell(c, x - 5 * s, y - 5 * s, 9 * s, 4 * s, 'rgba(255,255,255,.45)');
          ell(c, x + 8 * s, y - 8 * s, 8 * s, 4 * s, '#6FBF5A');
        }
      }
    }
  }
  function drawLotus(c, x, y, R, t, col) {
    c.save(); c.translate(x, y);
    const sw = Math.sin(t * 1.3) * 0.05;
    c.rotate(sw);
    c.lineWidth = Math.max(1, R * 0.08); c.strokeStyle = 'rgba(160,40,90,.55)';
    const cols = col === '#FFFFFF' ? ['#FFFFFF', '#FFE6F0'] : ['#FFB6D3', '#FF6FA8'];
    for (let i = -2; i <= 2; i++) {
      c.save(); c.rotate(i * 0.42); petal(c, R * (i === 0 ? 1.25 : 1.05), R * 0.42);
      c.fillStyle = i % 2 ? cols[1] : cols[0]; c.fill(); c.stroke(); c.restore();
    }
    ell(c, 0, -R * 0.2, R * 0.22, R * 0.16, '#FFD23F');
    c.restore();
  }

  function drawStartBank(g, c, rt) {
    const F = g.F, L = F.L, P = F.pal, w = g.w, h = g.h, s = L.s, cam = F.cam.y;
    const sy = -cam;
    if (sy > h + 20) return;
    const wave = (x) => Math.sin(x * 0.03 + rt * 1.5) * 3.5 * s + Math.sin(x * 0.07 - rt) * 1.5 * s;
    c.fillStyle = P.sand;
    c.beginPath(); c.moveTo(-40, h + 60);
    for (let x = -40; x <= w + 40; x += 16) c.lineTo(x, sy + wave(x));
    c.lineTo(w + 40, h + 60); c.closePath(); c.fill();
    const gy = sy + 18 * s;
    const gr = c.createLinearGradient(0, gy, 0, gy + 320 * s);
    gr.addColorStop(0, P.grass[0]); gr.addColorStop(1, P.grass[1]);
    c.fillStyle = gr;
    c.beginPath(); c.moveTo(-40, h + 60);
    for (let x = -40; x <= w + 40; x += 20) c.lineTo(x, gy + Math.sin(x * 0.05) * 4 * s);
    c.lineTo(w + 40, h + 60); c.closePath(); c.fill();
    c.strokeStyle = 'rgba(40,110,40,.45)'; c.lineWidth = 3 * s;
    c.beginPath();
    for (let x = -40; x <= w + 40; x += 20) { const yy = gy + Math.sin(x * 0.05) * 4 * s; if (x === -40) c.moveTo(x, yy); else c.lineTo(x, yy); }
    c.stroke();
    // 浪花线
    c.strokeStyle = 'rgba(255,255,255,.95)'; c.lineWidth = 4 * s; c.lineCap = 'round';
    c.beginPath();
    for (let x = -40; x <= w + 40; x += 16) { const yy = sy + wave(x) - 1; if (x === -40) c.moveTo(x, yy); else c.lineTo(x, yy); }
    c.stroke();
    // 草丛 + 小花
    for (let i = 0; i < 26; i++) {
      const x = fr(i * 3.3) * w, y = gy + 20 * s + fr(i * 7.1) * 620 * s;
      if (y < 0 || y > h + 20) continue;
      const sc = s * (0.8 + fr(i * 1.7) * 0.5), sw = Math.sin(rt * 2 + i) * 3 * sc;
      if (i % 3 === 0) {
        c.strokeStyle = '#3F9B3A'; c.lineWidth = 2 * sc;
        c.beginPath(); c.moveTo(x, y); c.lineTo(x + sw, y - 12 * sc); c.stroke();
        c.fillStyle = ['#FF6B8B', '#FFD23F', '#FFFFFF', '#B388FF'][i % 4];
        for (let j = 0; j < 5; j++) { const a = j * TAU / 5; c.beginPath(); c.arc(x + sw + Math.cos(a) * 4 * sc, y - 12 * sc + Math.sin(a) * 4 * sc, 3.2 * sc, 0, TAU); c.fill(); }
        c.fillStyle = '#FFB300'; c.beginPath(); c.arc(x + sw, y - 12 * sc, 2.4 * sc, 0, TAU); c.fill();
      } else {
        c.strokeStyle = P.id === 'night' ? '#2F7A45' : '#3F9B3A'; c.lineWidth = 2.4 * sc; c.lineCap = 'round';
        c.beginPath();
        c.moveTo(x - 4 * sc, y); c.quadraticCurveTo(x - 6 * sc, y - 8 * sc, x - 9 * sc + sw, y - 13 * sc);
        c.moveTo(x, y); c.quadraticCurveTo(x, y - 10 * sc, x + sw, y - 17 * sc);
        c.moveTo(x + 4 * sc, y); c.quadraticCurveTo(x + 6 * sc, y - 8 * sc, x + 9 * sc + sw, y - 12 * sc);
        c.stroke();
      }
    }
    // 芦苇（两侧水边）
    for (let side = 0; side < 2; side++) {
      const bx0 = side ? w - 22 * s : 22 * s;
      for (let j = 0; j < 5; j++) {
        const bx = bx0 + (j - 2) * 8 * s, hh = (60 + fr(j + side * 9) * 40) * s, sw = Math.sin(rt * 1.3 + j + side) * 6 * s;
        c.strokeStyle = P.reed; c.lineWidth = 3.4 * s;
        c.beginPath(); c.moveTo(bx, sy + 16 * s); c.quadraticCurveTo(bx, sy - hh * 0.4, bx + sw, sy - hh * 0.8); c.stroke();
        if (j % 2 === 1) { c.strokeStyle = '#8A5A33'; c.lineWidth = 7 * s; c.beginPath(); c.moveTo(bx + sw * 0.95, sy - hh * 0.8); c.lineTo(bx + sw, sy - hh * 0.8 - 16 * s); c.stroke(); }
      }
    }
    // 起点木牌
    const px = w - 64 * s, py = L.startY - cam + 26 * s;
    if (py > -60 && py < h + 60) {
      c.fillStyle = '#7A4A26'; c.fillRect(px - 3 * s, py - 44 * s, 6 * s, 48 * s);
      g.rrect(px - 30 * s, py - 62 * s, 60 * s, 28 * s, 6 * s, '#C98B4F', NAVY, 2.5 * s);
      g.text('起点', px, py - 48 * s, { size: Math.round(16 * s), font: 'kai', weight: 700, color: '#FFFBEF', stroke: '#7A4A26', strokeW: 2 });
    }
  }

  function drawFarBank(g, c, rt) {
    const F = g.F, L = F.L, P = F.pal, w = g.w, h = g.h, s = L.s, cam = F.cam.y;
    const fy = L.farShoreY - cam;
    if (fy < -20) return;
    const ty = L.farTopY - cam;
    // 天空（视差：太阳/月亮与云比岸慢）
    if (ty > -10) {
      const gr = c.createLinearGradient(0, Math.min(0, ty - 400 * s), 0, ty);
      gr.addColorStop(0, P.sky[0]); gr.addColorStop(1, P.sky[1]);
      c.fillStyle = gr; c.fillRect(-40, -40, w + 80, ty + 44);
      const hud = g.hudTop, par = hud + Math.max(0, ty - hud) * 0.5;
      if (P.id === 'night') {
        c.fillStyle = '#FFFFFF';
        for (let i = 0; i < 40; i++) { const a = 0.4 + 0.6 * Math.abs(Math.sin(rt * (0.8 + fr(i) * 2) + i)); c.globalAlpha = a; const x = fr(i * 3.7) * w, y = ty - 20 * s - fr(i * 5.1) * 420 * s; if (y > -5) { c.beginPath(); c.arc(x, y, (0.8 + fr(i * 2.3) * 1.4) * s, 0, TAU); c.fill(); } }
        c.globalAlpha = 1;
        const mx = w * 0.2, my = par - 30 * s;
        const mg = c.createRadialGradient(mx, my, 0, mx, my, 90 * s); mg.addColorStop(0, 'rgba(255,245,200,.5)'); mg.addColorStop(1, 'rgba(255,245,200,0)');
        c.fillStyle = mg; c.beginPath(); c.arc(mx, my, 90 * s, 0, TAU); c.fill();
        ell(c, mx, my, 26 * s, 26 * s, '#FFF4CF');
        ell(c, mx - 8 * s, my - 5 * s, 5 * s, 5 * s, 'rgba(220,200,150,.6)');
        ell(c, mx + 9 * s, my + 7 * s, 4 * s, 4 * s, 'rgba(220,200,150,.6)');
      } else {
        const sx = w * 0.8, syy = P.id === 'dusk' ? ty - 30 * s : par - 40 * s, r = (P.id === 'dusk' ? 40 : 28) * s;
        const sg = c.createRadialGradient(sx, syy, 0, sx, syy, r * 3.2); sg.addColorStop(0, 'rgba(255,248,190,.85)'); sg.addColorStop(1, 'rgba(255,230,120,0)');
        c.fillStyle = sg; c.beginPath(); c.arc(sx, syy, r * 3.2, 0, TAU); c.fill();
        ell(c, sx, syy, r, r, P.id === 'dusk' ? '#FF9D4A' : '#FFE14D', 'rgba(255,160,20,.6)', 3);
      }
      for (let i = 0; i < 4; i++) {
        const span = w + 260 * s, x = ((fr(i * 4.4) * span + rt * (8 + i * 4) * s) % span) - 130 * s;
        g.cloud(x, hud + Math.max(0, ty - hud) * (0.14 + i * 0.17) + 10 * s, (0.7 + fr(i) * 0.5) * s, P.id === 'night' ? 0.18 : 0.9);
      }
      // 远方：组屋 + 金沙 + 擎天树剪影
      c.fillStyle = P.city;
      for (let i = 0; i < 12; i++) {
        const bw = (26 + fr(i * 2.2) * 26) * s, bh = (40 + fr(i * 3.9) * 60) * s, bx = fr(i * 1.13) * w * 1.1 - 20 * s;
        c.fillRect(bx, ty - bh + 4 * s, bw, bh);
        if (P.id === 'night') {
          c.fillStyle = 'rgba(255,214,107,.8)';
          for (let q = 0; q < 6; q++) { if (fr(i * 7 + q) < 0.5) c.fillRect(bx + 4 * s + (q % 2) * 10 * s, ty - bh + 10 * s + Math.floor(q / 2) * 12 * s, 4 * s, 5 * s); }
          c.fillStyle = P.city;
        }
      }
      const mbx = w * 0.56, mbb = ty + 4 * s, ms = 0.8 * s;
      for (let i = 0; i < 3; i++) { const bx = mbx + i * 22 * ms; c.beginPath(); c.moveTo(bx, mbb); c.lineTo(bx + 3 * ms, mbb - 70 * ms); c.lineTo(bx + 13 * ms, mbb - 70 * ms); c.lineTo(bx + 15 * ms, mbb); c.closePath(); c.fill(); }
      c.beginPath(); c.moveTo(mbx - 6 * ms, mbb - 70 * ms); c.lineTo(mbx + 66 * ms, mbb - 72 * ms); c.lineTo(mbx + 72 * ms, mbb - 77 * ms); c.lineTo(mbx - 6 * ms, mbb - 77 * ms); c.closePath(); c.fill();
      c.fillStyle = P.hill;
      c.beginPath(); c.moveTo(-40, ty + 30 * s);
      for (let x = -40; x <= w + 40; x += 20) c.lineTo(x, ty - 10 * s - Math.sin(x * 0.012 + 1) * 12 * s);
      c.lineTo(w + 40, ty + 30 * s); c.closePath(); c.fill();
    }
    // 对岸草地
    const gr2 = c.createLinearGradient(0, ty, 0, fy);
    gr2.addColorStop(0, P.far[0]); gr2.addColorStop(1, P.far[1]);
    c.fillStyle = gr2;
    c.beginPath(); c.moveTo(-40, ty - 10 * s);
    for (let x = -40; x <= w + 40; x += 20) c.lineTo(x, ty - 6 * s + Math.sin(x * 0.03) * 5 * s);
    c.lineTo(w + 40, fy + 6 * s); c.lineTo(-40, fy + 6 * s); c.closePath(); c.fill();
    // 沙边 + 浪花
    c.fillStyle = P.sand;
    c.beginPath(); c.moveTo(-40, fy - 14 * s);
    for (let x = -40; x <= w + 40; x += 16) c.lineTo(x, fy - 14 * s + Math.sin(x * 0.04) * 3 * s);
    for (let x = w + 40; x >= -40; x -= 16) c.lineTo(x, fy + Math.sin(x * 0.03 - rt * 1.5) * 3.5 * s);
    c.closePath(); c.fill();
    c.strokeStyle = 'rgba(255,255,255,.95)'; c.lineWidth = 4 * s; c.lineCap = 'round';
    c.beginPath();
    for (let x = -40; x <= w + 40; x += 16) { const yy = fy + Math.sin(x * 0.03 - rt * 1.5) * 3.5 * s; if (x === -40) c.moveTo(x, yy); else c.lineTo(x, yy); }
    c.stroke();
    // 擎天树（左）+ 亭子（右）
    const night = P.id === 'night';
    const bsY = L.farShoreY - L.gap * 0.72 - cam;
    drawSupertree(c, w * 0.1, bsY + 30 * s, 130 * s, rt, night);
    if (w > 480) drawSupertree(c, w * 0.2, bsY + 10 * s, 100 * s, rt + 1, night);
    drawPavilion(c, w * (w < 500 ? 0.84 : 0.82), bsY + 20 * s, 72 * s, rt, night);
    // 荷花宝座
    drawThrone(g, c, w / 2, L.throneY - cam, 64 * s, F.throne.bloom, rt);
  }
  function drawSupertree(c, x, base, H, rt, night) {
    c.save();
    c.fillStyle = night ? '#6A4FA0' : '#7E63B0';
    c.beginPath(); c.moveTo(x - H * 0.07, base); c.lineTo(x - H * 0.035, base - H * 0.74); c.lineTo(x + H * 0.035, base - H * 0.74); c.lineTo(x + H * 0.07, base); c.closePath(); c.fill();
    c.strokeStyle = night ? 'rgba(255,120,220,.55)' : 'rgba(80,160,80,.6)'; c.lineWidth = H * 0.015;
    for (let i = 0; i < 5; i++) { c.beginPath(); c.moveTo(x - H * 0.06 + i * H * 0.03, base); c.lineTo(x - H * 0.03 + i * H * 0.015, base - H * 0.74); c.stroke(); }
    c.fillStyle = night ? '#8B5BD6' : '#9A74D0';
    c.beginPath(); c.moveTo(x - H * 0.035, base - H * 0.72); c.quadraticCurveTo(x - H * 0.2, base - H * 0.86, x - H * 0.3, base - H);
    c.lineTo(x + H * 0.3, base - H); c.quadraticCurveTo(x + H * 0.2, base - H * 0.86, x + H * 0.035, base - H * 0.72); c.closePath(); c.fill();
    ell(c, x, base - H, H * 0.3, H * 0.05, night ? '#B98CFF' : '#B99BE8', NAVY, 1.5);
    for (let i = 0; i < 9; i++) {
      const a = i / 8, lx = x - H * 0.28 + a * H * 0.56, ly = base - H + Math.sin(a * Math.PI) * H * 0.02;
      const on = Math.sin(rt * 3 + i * 1.3) > 0;
      ell(c, lx, ly, H * 0.018, H * 0.018, on ? (night ? '#FFE45C' : '#FFFFFF') : (night ? '#FF6FD0' : '#E6D6FF'));
    }
    c.restore();
  }
  function drawPavilion(c, x, base, S, rt, night) {
    c.save();
    ell(c, x, base + 4, S * 1.05, S * 0.12, 'rgba(0,0,0,.15)');
    c.fillStyle = '#E3D3AE'; c.fillRect(x - S * 0.95, base - S * 0.12, S * 1.9, S * 0.14);
    c.lineWidth = 2; c.strokeStyle = NAVY; c.strokeRect(x - S * 0.95, base - S * 0.12, S * 1.9, S * 0.14);
    for (let i = 0; i < 4; i++) {
      const px = x - S * 0.72 + i * S * 0.48;
      c.fillStyle = '#D8352F'; c.fillRect(px - S * 0.05, base - S * 0.95, S * 0.1, S * 0.84);
      c.strokeRect(px - S * 0.05, base - S * 0.95, S * 0.1, S * 0.84);
    }
    c.strokeStyle = '#8A2A22'; c.lineWidth = S * 0.04;
    c.beginPath(); c.moveTo(x - S * 0.72, base - S * 0.36); c.lineTo(x + S * 0.72, base - S * 0.36); c.stroke();
    // 屋顶（飞檐）
    c.fillStyle = night ? '#1F4F57' : '#2E7B72';
    c.beginPath();
    c.moveTo(x - S * 1.25, base - S * 1.02);
    c.quadraticCurveTo(x - S * 1.0, base - S * 0.96, x - S * 0.85, base - S * 1.08);
    c.quadraticCurveTo(x - S * 0.4, base - S * 1.35, x, base - S * 1.62);
    c.quadraticCurveTo(x + S * 0.4, base - S * 1.35, x + S * 0.85, base - S * 1.08);
    c.quadraticCurveTo(x + S * 1.0, base - S * 0.96, x + S * 1.25, base - S * 1.02);
    c.lineTo(x + S * 0.9, base - S * 0.92); c.lineTo(x - S * 0.9, base - S * 0.92); c.closePath();
    c.fill(); c.lineWidth = 2.5; c.strokeStyle = NAVY; c.stroke();
    c.strokeStyle = 'rgba(255,255,255,.3)'; c.lineWidth = 2;
    for (let i = -3; i <= 3; i++) { c.beginPath(); c.moveTo(x + i * S * 0.12, base - S * 1.5 + Math.abs(i) * S * 0.08); c.lineTo(x + i * S * 0.24, base - S * 0.96); c.stroke(); }
    ell(c, x, base - S * 1.68, S * 0.08, S * 0.08, '#FFC928', NAVY, 2);
    // 灯笼
    for (const sd of [-1, 1]) {
      const ax = x + sd * S * 0.82, ay = base - S * 0.94;
      const sw = Math.sin(rt * 1.8 + sd) * 0.18;
      c.save(); c.translate(ax, ay); c.rotate(sw);
      c.strokeStyle = NAVY; c.lineWidth = 1.5; c.beginPath(); c.moveTo(0, 0); c.lineTo(0, S * 0.22); c.stroke();
      if (night) { const lg = c.createRadialGradient(0, S * 0.36, 0, 0, S * 0.36, S * 0.5); lg.addColorStop(0, 'rgba(255,190,90,.6)'); lg.addColorStop(1, 'rgba(255,160,60,0)'); c.fillStyle = lg; c.beginPath(); c.arc(0, S * 0.36, S * 0.5, 0, TAU); c.fill(); }
      ell(c, 0, S * 0.36, S * 0.15, S * 0.13, '#E8352B', NAVY, 2);
      c.fillStyle = '#FFC928'; c.fillRect(-S * 0.07, S * 0.21, S * 0.14, S * 0.04); c.fillRect(-S * 0.07, S * 0.47, S * 0.14, S * 0.04);
      c.strokeStyle = '#FFC928'; c.lineWidth = 1.5; c.beginPath(); c.moveTo(0, S * 0.51); c.lineTo(0, S * 0.62); c.stroke();
      c.restore();
    }
    c.restore();
  }
  function drawThrone(g, c, x, y, S, bloom, rt) {
    const s = g.F.L.s;
    c.save(); c.translate(x, y);
    // 光芒
    c.save();
    c.rotate(rt * 0.25);
    c.globalAlpha = 0.35 + 0.15 * Math.sin(rt * 2) + bloom * 0.25;
    c.fillStyle = '#FFE78A';
    for (let i = 0; i < 12; i++) { c.rotate(TAU / 12); c.beginPath(); c.moveTo(-S * 0.12, -S * 0.2); c.lineTo(0, -S * (2.0 + bloom * 0.6)); c.lineTo(S * 0.12, -S * 0.2); c.closePath(); c.fill(); }
    c.restore();
    // 大荷叶
    ell(c, 0, S * 0.18, S * 1.5, S * 0.46, 'rgba(0,40,40,.25)');
    ell(c, 0, S * 0.1, S * 1.42, S * 0.42, '#4DB54A', '#2E7D32', 3 * s);
    ell(c, -S * 0.3, S * 0.02, S * 0.5, S * 0.12, 'rgba(255,255,255,.2)');
    // 花瓣（后排 → 前排）
    const open = 0.55 + bloom * 0.45;
    c.lineWidth = 2.2 * s; c.strokeStyle = '#C2185B';
    const back = [-1.25, -0.75, -0.25, 0.25, 0.75, 1.25];
    back.forEach((a, i) => {
      c.save(); c.translate(0, -S * 0.05); c.rotate(a * open);
      petal(c, S * 1.05, S * 0.36);
      const pg = c.createLinearGradient(0, 0, 0, -S); pg.addColorStop(0, '#FF6FA8'); pg.addColorStop(1, i % 2 ? '#FFD3E6' : '#FFC0DA');
      c.fillStyle = pg; c.fill(); c.stroke(); c.restore();
    });
    [-1.9, -1.35, 1.35, 1.9].forEach((a) => {
      c.save(); c.translate(0, S * 0.05); c.rotate(a * (0.8 + bloom * 0.2));
      petal(c, S * 0.9, S * 0.34);
      c.fillStyle = '#FF8FBF'; c.fill(); c.stroke(); c.restore();
    });
    ell(c, 0, -S * 0.02, S * 0.42, S * 0.16, '#FFD23F', '#C98A00', 2 * s);
    for (let i = 0; i < 7; i++) ell(c, (i - 3) * S * 0.1, -S * 0.04 + Math.abs(i - 3) * S * 0.015, S * 0.03, S * 0.03, '#B37400');
    c.restore();
    // “终点”小旗
    const fx = x - S * 1.25, fy = y - S * 0.1;
    c.strokeStyle = '#7A4A26'; c.lineWidth = 3 * s; c.beginPath(); c.moveTo(fx, fy + S * 0.3); c.lineTo(fx, fy - S * 1.1); c.stroke();
    const wv = Math.sin(rt * 5) * 4 * s;
    c.fillStyle = '#FF4D5E'; c.beginPath(); c.moveTo(fx, fy - S * 1.1); c.quadraticCurveTo(fx - S * 0.5, fy - S * 1.0 + wv, fx - S * 0.9, fy - S * 0.95); c.lineTo(fx, fy - S * 0.7); c.closePath(); c.fill();
    c.lineWidth = 2; c.strokeStyle = NAVY; c.stroke();
    g.text('终点', fx - S * 0.38, fy - S * 0.9, { size: Math.round(13 * s), font: 'kai', weight: 700, color: '#FFFFFF' });
  }

  function drawLanes(g, c, rt) {
    const F = g.F, cam = F.cam.y, h = g.h;
    // 从远到近画（先画上面的河道）
    for (let i = F.lanes.length - 1; i >= 0; i--) {
      const lane = F.lanes[i];
      lane.pads.forEach((p) => {
        if (p.gone) return;
        const y = p.y - cam;
        if (y < -p.h - 40 || y > h + p.h + 40) return;
        drawPad(g, c, p, p.x, y, rt, lane);
      });
    }
  }
  function drawPad(g, c, p, x, y, rt, lane) {
    const F = g.F, L = F.L, s = L.s;
    const sink = p.sink, dip = p.dip;
    const reveal = lane.state !== 'wait';
    // 水面涟漪
    const rk = (rt * 0.7 + p.ph) % 1;
    c.globalAlpha = (1 - rk) * 0.35 * (1 - sink);
    ell(c, x, y + p.h * 0.12, p.w * (0.55 + rk * 0.25), p.h * (0.55 + rk * 0.2), null, '#FFFFFF', 2 * s);
    c.globalAlpha = 1;
    if (p.warn) {
      for (let i = 0; i < 4; i++) {
        const k = (rt * 1.6 + i / 4) % 1;
        c.globalAlpha = 1 - k;
        ell(c, x + (fr(i + p.ph) - 0.5) * p.w * 0.8, y + p.h * 0.4 - k * 30 * s, 4 * s, 4 * s, null, '#FFFFFF', 2 * s);
      }
      c.globalAlpha = 1;
    }
    c.save();
    c.translate(x, y);
    if (p.tilt) c.rotate(p.tilt * 0.4 * p.flip);
    const sc = (1 - 0.35 * sink) * (1 - 0.18 * dip) * (lane.state === 'wait' ? 0.96 : 1);
    c.scale(sc, sc * (1 - 0.3 * dip));
    c.globalAlpha *= (1 - sink) * (1 - 0.55 * dip);
    const w = p.w, hh = p.h;
    // 阴影
    c.save(); c.translate(0, 6 * s); padPath(c, w, hh, p.flip); c.fillStyle = 'rgba(0,40,70,.25)'; c.fill(); c.restore();
    padPath(c, w, hh, p.flip);
    const bad = p.bad;
    const gr = c.createRadialGradient(0, 0, hh * 0.2, 0, 0, w * 0.6);
    if (bad) { gr.addColorStop(0, '#B7A77A'); gr.addColorStop(1, '#7C6A45'); }
    else if (p.dock) { gr.addColorStop(0, '#C7F58F'); gr.addColorStop(1, '#55BF4A'); }
    else { gr.addColorStop(0, '#B6F08F'); gr.addColorStop(0.7, '#6FD05C'); gr.addColorStop(1, '#4DB54A'); }
    c.fillStyle = gr; c.fill();
    const sel = (F.sel === p || F.hover === p) && tappable(g, p);
    c.lineWidth = 3 * s; c.strokeStyle = bad ? '#5E4A2A' : '#2E7D32'; c.stroke();
    // 叶脉
    c.strokeStyle = 'rgba(255,255,255,.28)'; c.lineWidth = 1.6 * s;
    c.beginPath();
    const nx = p.flip * w * 0.05, ny = -hh * 0.04;
    for (let i = 0; i < 7; i++) {
      const a = Math.PI * 0.15 + i * Math.PI * 0.12;
      c.moveTo(nx, ny); c.lineTo(nx + Math.cos(a) * (w / 2 - 8 * s), ny + Math.sin(a) * (hh / 2 - 6 * s));
    }
    c.stroke();
    if (bad) {
      c.strokeStyle = '#3B2A12'; c.lineWidth = 2.5 * s;
      c.beginPath(); c.moveTo(-w * 0.15, -hh * 0.4); c.lineTo(-w * 0.02, -hh * 0.05); c.lineTo(-w * 0.12, hh * 0.1); c.lineTo(w * 0.05, hh * 0.42); c.stroke();
    }
    if (sel) {
      const a = 0.6 + 0.4 * Math.sin(rt * 8);
      padPath(c, w + 10 * s, hh + 10 * s, p.flip);
      c.lineWidth = 5 * s; c.strokeStyle = 'rgba(255,228,92,' + a.toFixed(2) + ')'; c.stroke();
    }
    // 文字
    if (reveal && !p.dock) {
      const pk = clamp(p.pop, 0, 1.3);
      if (pk > 0.02) {
        c.save(); c.scale(pk, pk);
        const n = p.lines.length, lh = L.padLh;
        for (let i = 0; i < n; i++) {
          g.text(p.lines[i], 0, (i - (n - 1) / 2) * lh + 1, { size: L.padFs, font: 'kai', weight: 700, color: bad ? '#4A3A1E' : NAVY, stroke: 'rgba(255,255,255,.9)', strokeW: 3 });
        }
        c.restore();
        // 号码牌（键盘 1–4）
        if (!bad && lane.state === 'active') {
          const bx = -w / 2 + 13 * s, by = -hh / 2 + 9 * s;
          ell(c, bx, by, 11 * s, 11 * s, '#FFC928', NAVY, 2.2 * s);
          g.text(String(p.num), bx, by + 1, { size: Math.round(14 * s), font: 'num', color: NAVY });
        }
      }
    } else if (!reveal) {
      ell(c, -w * 0.18, hh * 0.1, 5 * s, 3 * s, 'rgba(255,255,255,.35)');
    }
    // 靠岸开花
    if (p.dock && p.bloom > 0.01) {
      c.save(); c.translate(w / 2 - 16 * s, -hh * 0.18); c.scale(p.bloom, p.bloom);
      drawLotus(c, 0, 0, 16 * s, rt + p.ph, '#FF8FB8');
      c.restore();
      c.save(); c.translate(-w / 2 + 18 * s, -hh * 0.1); c.scale(p.bloom, p.bloom);
      ell(c, 0, 0, 12 * s, 12 * s, '#3CCB5A', NAVY, 2 * s);
      c.strokeStyle = '#FFFFFF'; c.lineWidth = 3 * s; c.lineCap = 'round';
      c.beginPath(); c.moveTo(-5 * s, 0); c.lineTo(-1 * s, 4 * s); c.lineTo(6 * s, -4 * s); c.stroke();
      c.restore();
    }
    c.restore();
    if (sel) {
      const by = y - p.h / 2 - 16 * s + Math.sin(rt * 7) * 4 * s;
      c.fillStyle = '#FFE45C'; c.strokeStyle = NAVY; c.lineWidth = 2.5 * s;
      c.beginPath(); c.moveTo(x - 11 * s, by - 10 * s); c.lineTo(x + 11 * s, by - 10 * s); c.lineTo(x, by + 4 * s); c.closePath(); c.fill(); c.stroke();
    }
  }

  function radioGeom(g) {
    const F = g.F, L = F.L, R = F.radio, u = R.u;
    const sc = lerp(1, 0.32, u);
    return {
      x: lerp(L.radioSX, 60 * L.s + L.RW * 0.16, u),
      y: lerp(L.radioSY + L.camR, L.startY - 6 * L.s, u),
      W: L.RW * sc, H: L.RH * sc, sc
    };
  }
  function drawRadio(g, c, rt) {
    const F = g.F, L = F.L, R = F.radio, s = L.s;
    const geo = radioGeom(g);
    const x = geo.x, y = geo.y - F.cam.y, RW = geo.W, RH = geo.H;
    if (y - RH > g.h + 40 || y + RH < -40) return;
    const on = R.on && F.phase === 'radio';
    const beat = on ? Math.pow(Math.max(0, Math.sin(rt * TAU * 1.8)), 3) : 0;
    const k = geo.sc * s;
    // 声波
    if (on) {
      c.lineCap = 'round';
      for (let i = 0; i < 3; i++) {
        const t = (rt * 0.8 + i / 3) % 1;
        c.globalAlpha = (1 - t) * 0.85;
        c.strokeStyle = '#FFFFFF'; c.lineWidth = 5 * k * (1 - t * 0.5);
        const r = RH * 0.36 + t * RW * 0.55;
        c.beginPath(); c.arc(x - RW * 0.25, y, r, Math.PI * 0.72, Math.PI * 1.32); c.stroke();
        c.beginPath(); c.arc(x + RW * 0.2, y - RH * 0.1, r * 0.9, -Math.PI * 0.42, -Math.PI * 0.12); c.stroke();
      }
      c.globalAlpha = 1;
    }
    c.save();
    c.translate(x, y + RH / 2);
    c.scale(1 + beat * 0.035, 1 - beat * 0.05);
    c.translate(0, -RH / 2);
    ell(c, 0, RH * 0.54, RW * 0.52, RH * 0.09, 'rgba(0,0,0,.22)');
    // 天线
    const aa = -0.62 + Math.sin(rt * 3) * (on ? 0.1 : 0.03);
    const ax = RW * 0.32, ay = -RH * 0.46, al = RH * 0.72;
    c.strokeStyle = NAVY; c.lineWidth = 6 * k; c.lineCap = 'round';
    c.beginPath(); c.moveTo(ax, ay); c.lineTo(ax + Math.sin(-aa) * al * -1, ay - Math.cos(aa) * al); c.stroke();
    c.strokeStyle = '#C9D3E0'; c.lineWidth = 3 * k;
    c.beginPath(); c.moveTo(ax, ay); c.lineTo(ax + Math.sin(-aa) * al * -1, ay - Math.cos(aa) * al); c.stroke();
    const tipOn = on && Math.sin(rt * 10) > 0;
    ell(c, ax + Math.sin(-aa) * al * -1, ay - Math.cos(aa) * al, 7 * k, 7 * k, tipOn ? '#FF4D5E' : '#FFC928', NAVY, 2.5 * k);
    // 提手
    c.strokeStyle = NAVY; c.lineWidth = 10 * k;
    c.beginPath(); c.moveTo(-RW * 0.3, -RH * 0.48); c.quadraticCurveTo(-RW * 0.05, -RH * 0.95, RW * 0.2, -RH * 0.48); c.stroke();
    c.strokeStyle = '#8A5A33'; c.lineWidth = 6 * k;
    c.beginPath(); c.moveTo(-RW * 0.3, -RH * 0.48); c.quadraticCurveTo(-RW * 0.05, -RH * 0.95, RW * 0.2, -RH * 0.48); c.stroke();
    // 机身
    const bg = c.createLinearGradient(0, -RH / 2, 0, RH / 2); bg.addColorStop(0, '#FF8B6B'); bg.addColorStop(1, '#E24E36');
    g.rrect(-RW / 2, -RH / 2, RW, RH, RH * 0.18, bg, NAVY, 4.5 * k);
    g.rrect(-RW / 2 + 8 * k, -RH / 2 + 7 * k, RW - 16 * k, RH * 0.12, RH * 0.06, 'rgba(255,255,255,.28)');
    // 喇叭
    const gx = -RW * 0.24, gy = RH * 0.05, gr0 = RH * 0.31 * (1 + beat * 0.08);
    ell(c, gx, gy, gr0 + 5 * k, gr0 + 5 * k, '#C23B28');
    ell(c, gx, gy, gr0, gr0, '#FFF1D6', NAVY, 3 * k);
    c.fillStyle = '#C9563E';
    for (let ring = 1; ring <= 3; ring++) {
      const rr = gr0 * ring / 3.6, n = ring * 6;
      for (let j = 0; j < n; j++) { const a = j * TAU / n + ring; c.beginPath(); c.arc(gx + Math.cos(a) * rr, gy + Math.sin(a) * rr, gr0 * 0.07, 0, TAU); c.fill(); }
    }
    ell(c, gx, gy, gr0 * 0.16, gr0 * 0.16, '#C9563E');
    // 屏幕
    const sx0 = RW * 0.0, sy0 = -RH * 0.34, sw = RW * 0.44, sh = RH * 0.42;
    g.rrect(sx0, sy0, sw, sh, 8 * k, '#12323F', NAVY, 3 * k);
    const nb = 8, bw = sw * 0.8 / nb;
    for (let i = 0; i < nb; i++) {
      const hgt = on ? (0.25 + 0.75 * Math.abs(Math.sin(rt * (5 + i * 0.7) + i * 1.3))) : 0.12;
      const bh = sh * 0.5 * hgt;
      c.fillStyle = i < 5 ? '#6BFF9A' : i < 7 ? '#FFE45C' : '#FF6B6B';
      c.fillRect(sx0 + sw * 0.1 + i * bw + bw * 0.15, sy0 + sh - 6 * k - bh, bw * 0.7, bh);
    }
    if (geo.sc > 0.6) {
      const n = F.sents.length, kk = clamp(R.k + (R.heard && !R.on ? 0 : 1), 0, n);
      const lbl = R.heard && !R.on ? '播完啦' : on ? (kk + ' / ' + n + ' 句') : 'FM 华文';
      g.text(lbl, sx0 + sw / 2, sy0 + sh * 0.22, { size: Math.round(clamp(sh * 0.2, 11, 19)), font: 'round', color: '#9CFFC0', maxW: sw - 10 * k });
    }
    // 旋钮
    for (let i = 0; i < 2; i++) {
      const kx = sx0 + sw * (0.25 + i * 0.5), ky = RH * 0.28, kr = RH * 0.085;
      ell(c, kx, ky, kr, kr, '#FFD23F', NAVY, 2.5 * k);
      const a = rt * (on ? 1.5 : 0.2) * (i ? -1 : 1);
      c.strokeStyle = NAVY; c.lineWidth = 2.5 * k; c.beginPath(); c.moveTo(kx, ky); c.lineTo(kx + Math.cos(a) * kr * 0.8, ky + Math.sin(a) * kr * 0.8); c.stroke();
    }
    // 进度条（第几句）
    if (geo.sc > 0.6) {
      const n = Math.max(1, F.sents.length), pk = clamp((R.heard && !R.on) ? 1 : (R.k + (R.cap ? R.cap.n / Math.max(1, R.cap.len) : 0)) / n, 0, 1);
      const px0 = -RW * 0.44, pw = RW * 0.88, py = RH * 0.43;
      g.rrect(px0, py - 4 * k, pw, 8 * k, 4 * k, 'rgba(60,15,10,.45)');
      if (pk > 0.01) g.rrect(px0, py - 4 * k, pw * pk, 8 * k, 4 * k, '#FFE45C');
    }
    // 脚
    g.rrect(-RW * 0.4, RH / 2 - 2 * k, RW * 0.12, 8 * k, 3 * k, NAVY);
    g.rrect(RW * 0.28, RH / 2 - 2 * k, RW * 0.12, 8 * k, 3 * k, NAVY);
    c.restore();
    // 音符
    F.notes.forEach((n) => {
      const a = n.t < 0.2 ? n.t / 0.2 : n.t > n.life - 0.5 ? (n.life - n.t) / 0.5 : 1;
      g.text(n.ch, n.x, n.y - F.cam.y, { size: Math.round(26 * s), font: 'sans', color: n.col, stroke: NAVY, strokeW: 3, alpha: clamp(a, 0, 1) });
    });
    // 标题牌
    if (R.u < 0.99) {
      const a = 1 - R.u;
      const tx = L.radioSX, ty = L.ribY + L.camR - F.cam.y;
      const fsz = Math.round(22 * L.us);
      const tw = Math.min(g.w - 30 * s, g.measure('《' + F.title + '》', fsz, 'kai', 700) + 70 * s);
      c.globalAlpha = a;
      g.rrect(tx - tw / 2, ty - 22 * s + 4 * s, tw, 44 * s, 22 * s, NAVY);
      g.rrect(tx - tw / 2, ty - 22 * s, tw, 44 * s, 22 * s, '#FFB547', NAVY, 3 * s);
      g.emoji('📻', tx - tw / 2 + 24 * s, ty, 24 * s);
      g.text('《' + F.title + '》', tx + 12 * s, ty + 1, { size: fsz, font: 'kai', weight: 700, color: '#FFFFFF', stroke: NAVY, strokeW: 3.5, maxW: tw - 64 * s });
      c.globalAlpha = 1;
    }
  }

  function drawFish(g, c, rt) {
    const F = g.F, s = F.L.s, cam = F.cam.y;
    F.fish.forEach((f) => {
      const k = clamp(f.t / f.dur, 0, 1);
      const x = f.x + f.d * k, y = f.y - cam - f.H * 4 * k * (1 - k);
      const ang = Math.atan2(-f.H * 4 * (1 - 2 * k), f.d) ;
      g.emoji('🐟', x, y, 30 * s, { rot: f.dir > 0 ? ang : ang + Math.PI, flip: f.dir > 0 });
    });
  }

  function drawFrogAll(g, c, rt) {
    const F = g.F, L = F.L, fg = F.frog, s = L.s, cam = F.cam.y;
    const pos = frogPos(g);
    const x = pos.x, y = pos.y - cam;
    const S = L.fs;
    const R = F.radio;
    const on = R.on && F.phase === 'radio';
    const beat = on ? Math.pow(Math.max(0, Math.sin(rt * TAU * 1.8)), 3) : 0;
    let sx = fg.sx, sy = fg.sy, rot = 0, legs = 0, mouth = fg.mouth;
    const o = { phones: fg.phones, blink: fg.blink, sad: fg.sad, lookX: 0, lookY: -0.4 };
    if (fg.mode === 'jump' || fg.mode === 'hop') {
      legs = pos.air;
      // 空中影子
      const gy = pos.gy - cam;
      ell(c, pos.gx, gy + 2 * s, S * 0.42 * (1 - pos.air * 0.4), S * 0.12 * (1 - pos.air * 0.4), 'rgba(0,30,50,' + (0.3 - pos.air * 0.15).toFixed(2) + ')');
      if (fg.J && fg.J.k > 0.55) { sx = lerp(0.84, 1.1, (fg.J.k - 0.55) / 0.45); sy = lerp(1.22, 0.9, (fg.J.k - 0.55) / 0.45); }
      const scl = 1 + pos.air * 0.28;
      sx *= scl; sy *= scl;
      mouth = Math.max(mouth, 0.35);
    } else if (fg.mode === 'swim' || fg.mode === 'fall') {
      const fall = fg.mode === 'fall' ? fg.fall : 1;
      c.save();
      // 水花圈
      const rk = (rt * 1.3) % 1;
      c.globalAlpha = (1 - rk) * 0.7;
      ell(c, x, y, S * (0.5 + rk * 0.5), S * (0.15 + rk * 0.12), null, '#FFFFFF', 2.5 * s);
      c.globalAlpha = 1;
      const wl = y - S * 0.25 * fall;       // 水面线
      c.beginPath(); c.rect(x - S * 2, y - S * 3, S * 4, S * 3 - S * 0.25 * fall + 2 * s); c.clip();
      const bob = Math.sin(rt * 5) * 2 * s;
      drawFrog(c, x, y + S * 0.55 * fall + bob, S, { sad: true, blink: fg.blink, lookY: 0.5, rot: fg.mode === 'fall' ? fg.fall * 0.5 : Math.sin(rt * 4) * 0.08, dizzy: g.state === 'over' });
      c.restore();
      ell(c, x, wl + 2 * s, S * 0.62, S * 0.1, 'rgba(255,255,255,.55)');
      if (fg.mode === 'swim') {
        c.strokeStyle = '#FFFFFF'; c.lineWidth = 2.5 * s; c.lineCap = 'round';
        for (const sd of [-1, 1]) { const a = Math.sin(rt * 9 + (sd > 0 ? 0 : Math.PI)) * 0.5; c.beginPath(); c.arc(x + sd * S * 0.5, wl + 2 * s, S * 0.2, Math.PI + a, Math.PI * 1.6 + a); c.stroke(); }
      }
      return;
    } else {
      // 坐着
      ell(c, x, y + 1 * s, S * 0.5, S * 0.13, 'rgba(0,30,50,.28)');
      if (on) { sy *= 1 - beat * 0.08; sx *= 1 + beat * 0.05; rot = Math.sin(rt * TAU * 0.9) * 0.08; o.happy = true; }
      if (F.phase === 'radio') {
        // 有飞虫靠近：睁眼盯着它看
        let best = null, bd = 260 * s;
        F.flies.forEach((f) => { if (f.eaten || f.leave) return; const d = Math.hypot(f.x - x, f.y - cam - y); if (d < bd) { bd = d; best = f; } });
        if (best) { o.happy = false; o.lookX = clamp((best.x - x) / (90 * s), -1, 1); o.lookY = clamp((best.y - cam - (y - S * 0.7)) / (90 * s), -1, 1); }
      }
      if (fg.party) { const j = Math.abs(Math.sin(rt * 6)); o.happy = true; o.crown = true; drawFrog(c, x, y - j * 16 * s, S, Object.assign(o, { sx: sx * (1 - j * 0.05), sy: sy * (1 + j * 0.08), legs: j * 0.7, mouth: 0.7 })); return; }
      if (F.hint && F.phase === 'river') { o.lookY = -0.9; }
    }
    // 舌头
    if (F.tongue) {
      const T = F.tongue, mx = x, my = y - S * 0.44;
      const tx = lerp(mx, T.x, T.k), ty = lerp(my, T.y - cam, T.k);
      c.strokeStyle = NAVY; c.lineWidth = 9 * s; c.lineCap = 'round';
      c.beginPath(); c.moveTo(mx, my); c.lineTo(tx, ty); c.stroke();
      c.strokeStyle = '#FF7FA3'; c.lineWidth = 6 * s;
      c.beginPath(); c.moveTo(mx, my); c.lineTo(tx, ty); c.stroke();
      ell(c, tx, ty, 6 * s, 6 * s, '#FF7FA3', NAVY, 2 * s);
    }
    drawFrog(c, x, y, S, Object.assign(o, { sx, sy, rot, legs, mouth }));
  }

  function drawAir(g, c, rt) {
    const F = g.F, s = F.L.s, cam = F.cam.y, w = g.w, h = g.h, P = F.pal;
    // 飞虫
    F.flies.forEach((f) => {
      if (f.eaten) return;
      const x = f.x, y = f.y - cam, k = s * 1.35;
      const fl = Math.abs(Math.sin(rt * 40 + f.ph));
      if (f.gold) {
        const gl = c.createRadialGradient(x, y, 0, x, y, 30 * k);
        gl.addColorStop(0, 'rgba(255,236,120,.85)'); gl.addColorStop(1, 'rgba(255,220,80,0)');
        c.fillStyle = gl; c.beginPath(); c.arc(x, y, 30 * k, 0, TAU); c.fill();
      } else if (!f.leave) {
        // 白色小光圈一闪一闪：草地上也一眼看得见“这里有东西可以点”
        const pk = (rt * 1.4 + f.ph) % 1;
        c.globalAlpha = (1 - pk) * 0.6;
        ell(c, x, y, (10 + pk * 16) * k, (10 + pk * 16) * k, null, '#FFFFFF', 2.2 * s);
        c.globalAlpha = 1;
      }
      c.globalAlpha = 0.8;
      ell(c, x - 5 * k, y - 5 * k, 8 * k, (4.5 * fl + 1) * k, '#E8F6FF', NAVY, 1.4, -0.5);
      ell(c, x + 5 * k, y - 5 * k, 8 * k, (4.5 * fl + 1) * k, '#E8F6FF', NAVY, 1.4, 0.5);
      c.globalAlpha = 1;
      ell(c, x, y, 6.5 * k, 5.5 * k, f.gold ? '#FFC928' : '#2A2A3A', NAVY, 1.5);
      if (f.gold) { c.strokeStyle = NAVY; c.lineWidth = 1.4 * k; c.beginPath(); c.moveTo(x - 1.5 * k, y - 5 * k); c.lineTo(x - 1.5 * k, y + 5 * k); c.moveTo(x + 2 * k, y - 5 * k); c.lineTo(x + 2 * k, y + 5 * k); c.stroke(); }
      ell(c, x + 3.5 * k, y - 2 * k, 2.2 * k, 2.2 * k, '#FF5A5F');
    });
  }
  function drawBugs(g, c, rt) {
    const F = g.F, s = F.L.s, w = g.w, h = g.h, P = F.pal;
    // 蜻蜓（白天/黄昏）或萤火虫（夜晚）——画在荷叶下面，不挡字
    if (P.id === 'night') {
      for (let i = 0; i < 16; i++) {
        const x = (fr(i * 3.1) * w + Math.sin(rt * 0.4 + i) * 40 * s + w) % w;
        const y = F.L.top + fr(i * 5.7) * (h - F.L.top) + Math.sin(rt * 0.7 + i * 2) * 30 * s;
        const a = 0.35 + 0.65 * Math.max(0, Math.sin(rt * 2.2 + i * 1.7));
        c.globalAlpha = a * 0.5; ell(c, x, y, 7 * s, 7 * s, '#FFF6A0');
        c.globalAlpha = a; ell(c, x, y, 2.4 * s, 2.4 * s, '#FFFFE0');
      }
      c.globalAlpha = 1;
    } else {
      for (let i = 0; i < 2; i++) {
        const x = w * 0.5 + Math.sin(rt * 0.23 + i * 3) * w * 0.44;
        const y = F.L.top + (h - F.L.top) * (0.3 + 0.4 * (0.5 + 0.5 * Math.sin(rt * 0.37 + i * 2)));
        const dx = Math.cos(rt * 0.23 + i * 3), fl = Math.abs(Math.sin(rt * 30 + i));
        c.save(); c.translate(x, y); c.scale(dx >= 0 ? 1 : -1, 1);
        c.globalAlpha = 0.75;
        ell(c, -2 * s, -6 * s, 12 * s, 3.2 * s * (0.4 + fl), '#DFF6FF', 'rgba(29,43,83,.5)', 1, -0.35);
        ell(c, -2 * s, 5 * s, 12 * s, 3.2 * s * (0.4 + fl), '#DFF6FF', 'rgba(29,43,83,.5)', 1, 0.35);
        c.globalAlpha = 1;
        c.strokeStyle = i ? '#FF6B3D' : '#2F8FE8'; c.lineWidth = 3.5 * s; c.lineCap = 'round';
        c.beginPath(); c.moveTo(-16 * s, 0); c.lineTo(8 * s, 0); c.stroke();
        ell(c, 10 * s, 0, 4 * s, 4 * s, i ? '#FF6B3D' : '#2F8FE8', NAVY, 1.2);
        c.restore();
      }
    }
  }

  function drawForeground(g, c, rt) {
    const F = g.F, s = F.L.s, cam = F.cam.y, w = g.w, h = g.h, P = F.pal;
    const PER = 520 * s, par = cam * 1.35;
    const k0 = Math.floor((par - 200 * s) / PER), k1 = Math.ceil((par + h + 200 * s) / PER);
    for (let k = k0; k <= k1; k++) {
      for (let side = 0; side < 2; side++) {
        const y = k * PER + (side ? PER * 0.5 : 0) + fr(k * 2 + side) * 100 * s - par;
        if (y < F.L.top - 60 * s || y > h + 120 * s) continue;
        const x = side ? w + 12 * s : -12 * s, dir = side ? -1 : 1;
        const sw = Math.sin(rt * 1.1 + k + side) * 0.05;
        c.save(); c.translate(x, y); c.scale(dir, 1); c.rotate(-0.5 + sw);
        for (let j = 0; j < 3; j++) {
          c.save(); c.rotate(j * 0.42 - 0.2);
          const L = (70 + j * 14) * s;
          c.fillStyle = j % 2 ? P.fg2 : P.fg;
          c.beginPath(); c.moveTo(0, 0); c.quadraticCurveTo(L * 0.5, -16 * s, L, 4 * s); c.quadraticCurveTo(L * 0.5, 10 * s, 0, 0); c.fill();
          c.restore();
        }
        c.restore();
      }
    }
  }

  function draw3DBtn(g, c, x, y, bw, bh, label, top, bot, pressed, fs, pulse) {
    const s = g.F.L.s;
    const d = pressed ? 2 : 6 * s;
    c.save(); c.translate(x, y); if (pulse) c.scale(pulse, pulse);
    g.rrect(-bw / 2, -bh / 2 + 6 * s, bw, bh, bh * 0.36, NAVY);
    const gr = c.createLinearGradient(0, -bh / 2, 0, bh / 2); gr.addColorStop(0, top); gr.addColorStop(1, bot);
    g.rrect(-bw / 2, -bh / 2 + (6 * s - d), bw, bh, bh * 0.36, gr, NAVY, 3.5 * s);
    g.rrect(-bw / 2 + 8 * s, -bh / 2 + (6 * s - d) + 5 * s, bw - 16 * s, bh * 0.3, bh * 0.15, 'rgba(255,255,255,.35)');
    g.text(label, 0, (6 * s - d) + 1, { size: fs, font: 'round', color: '#FFFFFF', stroke: NAVY, strokeW: 4, shadow: true, maxW: bw - 24 * s });
    c.restore();
  }

  function drawUI(g, c, rt) {
    const F = g.F, L = F.L, s = L.s, R = F.radio, w = g.w, h = g.h, us = L.us;
    // —— 电台阶段 ——
    F.capRect = null;
    if (F.phase === 'radio' || (F.phase === 'toRiver' && R.u < 0.6)) {
      const a = F.phase === 'radio' ? 1 : 1 - R.u / 0.6;
      c.globalAlpha = a;
      // 抓虫计数牌（左下，按钮上方）
      const B = F.bug;
      if (B.n > 0 || B.spawnN > 0) {
        const pfs = Math.round(18 * us), txt = '×' + B.n;
        const pw = g.measure(txt, pfs, 'num') + 50 * s, ph = 34 * s;
        const px = 14 * s, py = L.goY - L.goH / 2 - 20 * s - ph;
        const bump = 1 + B.bump * 0.25;
        c.save(); c.translate(px + pw / 2, py + ph / 2); c.scale(bump, bump);
        g.rrect(-pw / 2, -ph / 2 + 3 * s, pw, ph, ph / 2, 'rgba(29,43,83,.5)');
        g.rrect(-pw / 2, -ph / 2, pw, ph, ph / 2, '#FFFBEF', NAVY, 2.5 * s);
        const ix = -pw / 2 + 19 * s, fl = Math.abs(Math.sin(rt * 30));
        ell(c, ix - 4 * s, -5 * s, 6 * s, (3 * fl + 1) * s, '#E8F6FF', NAVY, 1.2, -0.5);
        ell(c, ix + 4 * s, -5 * s, 6 * s, (3 * fl + 1) * s, '#E8F6FF', NAVY, 1.2, 0.5);
        ell(c, ix, 0, 6 * s, 5 * s, '#2A2A3A');
        ell(c, ix + 3 * s, -2 * s, 1.8 * s, 1.8 * s, '#FF5A5F');
        g.text(txt, ix + 14 * s, 1, { size: pfs, font: 'num', color: NAVY, align: 'left' });
        c.restore();
        if (B.streak >= 2) g.text('连吃 ' + B.streak, px + pw + 8 * s, py + ph / 2, { size: Math.round(15 * us), font: 'round', color: '#FFE45C', stroke: NAVY, strokeW: 3, align: 'left' });
      }
      // 第一只飞虫：小手指一指（教会“这个可以点”）
      if (F.phase === 'radio' && B.n === 0) {
        const f0 = F.flies.find((f) => !f.eaten && !f.leave && f.t > 0.8);
        if (f0) g.emoji('👆', f0.x + 16 * s, f0.y - F.cam.y + 40 * s + Math.sin(rt * 8) * 5 * s, 40 * s, { rot: -0.35 });
      }
      if (R.cap && F.phase === 'radio') {
        const fs = Math.round(22 * us);
        const bw = Math.min(w - 28 * s, 640), bx = (w - bw) / 2;
        const lines = g.wrapText(F.sents[R.cap.k] || '', bw - 36 * s, fs, 'kai', 700);
        const bh = lines.length * fs * 1.4 + 30 * s + 18 * s;
        const by = g.hudTop + 10 * s;
        F.capRect = { x: bx, y: by, w: bw, h: bh + 16 * s };
        g.rrect(bx, by + 5 * s, bw, bh, 18 * s, 'rgba(29,43,83,.45)');
        g.rrect(bx, by, bw, bh, 18 * s, '#FFFBEF', NAVY, 3 * s);
        const geo = radioGeom(g);
        c.fillStyle = '#FFFBEF'; c.strokeStyle = NAVY; c.lineWidth = 3 * s;
        const tx = clamp(geo.x - geo.W * 0.1, bx + 30 * s, bx + bw - 30 * s);
        c.beginPath(); c.moveTo(tx - 12 * s, by + bh - 2); c.lineTo(tx, by + bh + 16 * s); c.lineTo(tx + 12 * s, by + bh - 2); c.fill(); c.stroke();
        c.fillRect(tx - 10 * s, by + bh - 4 * s, 20 * s, 5 * s);
        let left = R.cap.n;
        lines.forEach((ln, i) => {
          const arr = Array.from(ln);
          const show = arr.slice(0, Math.max(0, Math.min(arr.length, Math.floor(left)))).join('');
          left -= arr.length;
          if (show) g.text(show, bx + 18 * s, by + 18 * s + fs * 0.7 + i * fs * 1.4, { size: fs, font: 'kai', weight: 700, color: NAVY, align: 'left' });
        });
        if (R.cap.n >= R.cap.len - 0.5) g.text('点一下 · 下一句 ▶', bx + bw - 14 * s, by + bh - 14 * s, { size: Math.round(13 * us), font: 'round', color: '#7A86A8', align: 'right', alpha: 0.6 + 0.4 * Math.sin(rt * 5) });
      }
      if (R.heard && R.goK > 0.01) {
        const pk = R.goK * (1 + 0.04 * Math.sin(rt * 5));
        draw3DBtn(g, c, L.goX, L.goY, L.goW, L.goH, '过河去！', '#5BE07A', '#27A548', F.press === 'go', Math.round(30 * us), pk);
        // 重听
        c.save(); c.translate(L.rpX, L.rpY); c.scale(R.goK, R.goK);
        const d = F.press === 'rp' ? 2 : 5 * s;
        ell(c, 0, 5 * s, L.rpR, L.rpR, NAVY);
        ell(c, 0, 5 * s - d, L.rpR, L.rpR, R.on ? '#8FB8E8' : '#3AA0FF', NAVY, 3 * s);
        g.emoji(R.on ? '📻' : '🔁', 0, 5 * s - d - 5 * s, L.rpR * 0.9);
        g.text(R.on ? '播放中' : '再听', 0, 5 * s - d + L.rpR * 0.55, { size: Math.round(12 * us), font: 'round', color: '#FFFFFF', stroke: NAVY, strokeW: 2.5 });
        c.restore();
        if (F.hintGo && F.T > F.hintGo && F.phase === 'radio') {
          const fb = Math.sin(rt * 7) * 8 * s;
          g.emoji('👆', L.goX + L.goW * 0.3, L.goY + L.goH * 0.62 + fb, 46 * s, { rot: -0.3 });
        }
      } else if (!R.heard && F.phase === 'radio' && g.state === 'play' && !R.cap) {
        const ty = L.goY;
        const flyNow = F.flies.some((f) => !f.eaten && !f.leave);
        const tip = !R.on ? '准备收听…'
          : (flyNow && (F.bug.n === 0 || Math.floor(F.T / 4) % 2 === 1)) ? '边听边点小飞虫，让青蛙吃掉！'
            : '竖起耳朵听故事… 听完就过河！';
        g.rrect(w / 2 - Math.min(w * 0.44, 190 * us), ty - 20 * s, Math.min(w * 0.88, 380 * us), 40 * s, 20 * s, 'rgba(29,43,83,.55)');
        g.text(tip, w / 2, ty, { size: Math.round(17 * us), font: 'round', color: '#FFFFFF', maxW: Math.min(w * 0.84, 360 * us) });
      }
      c.globalAlpha = 1;
    }
    // —— 题目横幅 ——
    if (F.ban.qi >= 0 && (F.phase === 'river' || F.phase === 'toThrone')) {
      const q = F.qs[F.ban.qi];
      const by = banYNow(g), bx = L.banX, bw = L.banW, bh = L.banH;
      g.rrect(bx, by + 5 * s, bw, bh, 16 * us, 'rgba(29,43,83,.55)');
      g.rrect(bx, by, bw, bh, 16 * us, '#FFFBEF', NAVY, 3 * us);
      c.strokeStyle = 'rgba(29,43,83,.14)'; c.lineWidth = 2; c.setLineDash([6, 5]);
      c.strokeRect(bx + 6 * us, by + 6 * us, bw - 12 * us, bh - 12 * us); c.setLineDash([]);
      // 题号
      const tag = '第 ' + (F.ban.qi + 1) + ' 题', tfs = Math.round(13 * us);
      const tw = g.measure(tag, tfs, 'round') + 18 * us;
      g.rrect(bx + 12 * us, by - 11 * us, tw, 22 * us, 11 * us, '#FF6B5B', NAVY, 2.2 * us);
      g.text(tag, bx + 12 * us + tw / 2, by + 1 * us, { size: tfs, font: 'round', color: '#FFFFFF' });
      const lines = g.wrapText(q.q, L.banTextW, L.banFs, 'kai', 700).slice(0, 3);
      const lh = L.banFs * 1.3;
      lines.forEach((ln, i) => {
        g.text(ln, bx + 14 * us, by + bh / 2 + (i - (lines.length - 1) / 2) * lh + 1, { size: L.banFs, font: 'kai', weight: 700, color: NAVY, align: 'left', maxW: L.banTextW });
      });
      if (F.tts) {
        const sx = bx + bw - L.spkR - 10 * us, sy = by + bh / 2;
        const pk = 1 + (F.spkBump || 0) * 0.2 + (g.speaking ? 0.06 * Math.sin(rt * 10) : 0);
        c.save(); c.translate(sx, sy); c.scale(pk, pk);
        ell(c, 0, 3 * us, L.spkR, L.spkR, NAVY);
        ell(c, 0, 0, L.spkR, L.spkR, '#3AA0FF', NAVY, 2.6 * us);
        g.emoji('🔊', 0, 0, L.spkR * 1.05);
        c.restore();
      }
    }
    // —— 答错后的电台小提示（题库讲解 e）——
    const T = F.tip;
    if (T && F.phase === 'river' && T.qi === F.qi && T.k > 0.01) {
      const R2 = tipRect(g), tb = R2.tb, o = R2.o, bx = R2.x, bw = R2.w, bh = R2.h, by = R2.y;
      const fs = tb.fs, lines = tb.lines, lh = tb.lh;
      const k = clamp(T.k, 0, 1.2);
      c.save();
      c.globalAlpha = clamp(T.k, 0, 1);
      c.translate(bx + bw / 2, by); c.scale(0.85 + 0.15 * k, 0.85 + 0.15 * k); c.translate(-(bx + bw / 2), -by);
      g.rrect(bx, by + 4 * us, bw, bh, Math.min(14 * us, bh / 2), 'rgba(29,43,83,.45)');
      g.rrect(bx, by, bw, bh, Math.min(14 * us, bh / 2), '#EFFFE6', '#2E7D32', 2.6 * us);
      if (o > 0.55) {
        const a0 = c.globalAlpha; c.globalAlpha = a0 * clamp((o - 0.55) / 0.45, 0, 1);
        g.emoji('📻', bx + 25 * us, by + bh / 2, 26 * us);
        lines.forEach((ln, i) => {
          g.text(ln, bx + 48 * us, by + 11 * us + lh * (i + 0.5), { size: fs, font: 'kai', weight: 700, color: '#1B4D2A', align: 'left', maxW: bw - 60 * us });
        });
        if (T.over > 4) {           // 右上角小签“收起”：点提示框任意处都能收起，这里只是告诉孩子可以点
          const cl = '收起 ▴', cfs = Math.round(12 * us), cw = g.measure(cl, cfs, 'round') + 16 * us;
          g.rrect(bx + bw - 12 * us - cw, by - 10 * us, cw, 20 * us, 10 * us, '#FFFFFF', '#2E7D32', 2 * us);
          g.text(cl, bx + bw - 12 * us - cw / 2, by + 1, { size: cfs, font: 'round', color: '#2E7D32' });
        }
        c.globalAlpha = a0;
      } else if (o < 0.3) {
        g.emoji('📻', bx + 20 * us, by + bh / 2, 20 * us);
        g.text('提示 ▾', bx + 36 * us, by + bh / 2 + 1, { size: Math.round(15 * us), font: 'round', color: '#1B4D2A', align: 'left' });
      }
      if (o > 0.3) {
        const tg = '提示', tfs = Math.round(13 * us), tw = g.measure(tg, tfs, 'round') + 18 * us;
        g.rrect(bx + 12 * us, by - 10 * us, tw, 20 * us, 10 * us, '#3CCB5A', NAVY, 2 * us);
        g.text(tg, bx + 12 * us + tw / 2, by + 1, { size: tfs, font: 'round', color: '#FFFFFF' });
      }
      c.restore();
    }
    // —— 第一题手指提示 ——
    if (F.hint && F.phase === 'river' && !F.busy) {
      const lane = F.lanes[F.qi];
      const ps = lane ? lane.pads.filter((p) => tappable(g, p)) : [];
      if (ps.length) {
        const i = Math.floor((F.T - F.hint.t0) / 1.25) % ps.length;
        const p = ps.slice().sort((a, b) => a.x - b.x)[i];
        const ph = ((F.T - F.hint.t0) % 1.25) / 1.25;
        const tap = ph < 0.5 ? Math.sin(ph / 0.5 * Math.PI) : 0;
        const fx = p.x + 8 * s, fy = p.y - F.cam.y + p.h * 0.28 + 24 * s + tap * 10 * s;
        if (ph > 0.25 && ph < 0.45) { c.globalAlpha = 1 - (ph - 0.25) / 0.2; ell(c, p.x, p.y - F.cam.y, 20 * s + (ph - 0.25) * 120 * s, 20 * s + (ph - 0.25) * 120 * s, null, '#FFFFFF', 3 * s); c.globalAlpha = 1; }
        g.emoji('👆', fx, fy, 48 * s, { alpha: 0.75 + 0.25 * Math.sin(rt * 8) });
        const fp = frogScreen(g);
        const tip = '点荷叶，跳过去！';
        const tfs = Math.round(17 * us), tw = g.measure(tip, tfs, 'round') + 26 * s;
        const bx = clamp(fp.x - tw / 2, 8, w - tw - 8), by = fp.y + 12 * s;
        if (by + 34 * s < h) {
          g.rrect(bx, by, tw, 34 * s, 17 * s, 'rgba(29,43,83,.78)');
          g.text(tip, bx + tw / 2, by + 17 * s, { size: tfs, font: 'round', color: '#FFFFFF' });
        }
      }
    }
  }

  /* ================= 注册 ================= */
  HW.register({
    id: 'frog', skill: 'listen', kind: 'arcade', name: '青蛙过河', blurb: '听故事，跳上写对的荷叶过河', icon: '🐸',
    needs: ['tts'], cols: ['stories'], data: ['stories'],
    start(ctx) {
      if (!HW.arcade || typeof HW.arcade.run !== 'function') {
        try { ctx.toast('游戏引擎没有加载'); } catch (e) { /* ignore */ }
        return function () {};
      }
      W.__hwFrogCtx = ctx;              // 试玩脚本用（读关卡存档）
      return HW.arcade.run(ctx, makeSpec());
    }
  });
})();
