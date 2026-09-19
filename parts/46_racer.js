/* =====================================================================
 * 华文小岛 2.0 · 🏎️ 华文赛车（parts/46_racer.js）  skill: read · 题库栏目: quiz
 * 契约：SPEC_ARCADE.md §4-6；引擎：parts/15_arcade.js（HW.arcade.run）
 *
 * 玩法：伪 3D 赛道（自绘，带弯道、视差天际线、椰树/路灯/组屋/灯笼/路牌飞速后退），
 *   3–4 条车道（= 本题选项数）。顶部题目横幅 + “车道路牌”（选项按车道从左到右排好，
 *   颜色/编号与路上的门一一对应，当前车道的选项会亮起并填进题目的（　）里）。
 *   前方开来一排选项门：点车道 / 左右滑动 / ← → 换道，穿过正确的门 → 门牌劈成两半飞出去 + 氮气加速 + 金币雨；
 *   撞错门 → 门牌被撞飞、打滑转圈、扣心、画面上显示讲解 e，这道题过两题再考；最后一颗心撞错时先停车看完讲解再结束。
 *   ↑ / 上滑 / 🔥 按钮 = 加速（答对有极速奖励）。最后一道门后面是终点拱门。
 * 关卡：车速、读题时间、路障（3 关起）、慢车（5 关起）、门会换位置（7 关起）、白天→黄昏→夜晚。
 * 正确性：选项严格取自 item.c，打乱后以 op.idx 对照 item.a 判定；错题 note 写明正确答案。
 * ===================================================================== */
(function () {
  'use strict';
  const W = window;
  const HW = W.HW;
  if (!HW || typeof HW.register !== 'function') return;

  const TAU = Math.PI * 2;
  const NAVY = '#1d2b53';
  const CREAM = '#FFFBEF';
  const D0 = 3;       // 赛车在镜头前方的距离（世界单位）；这里缩放 = 1
  const DFAR = 66;    // 可见距离
  const FIN = 4;      // 终点线在最后一道门后面多远
  const OPT = [
    { c: '#FF5A5F', d: '#C8392B', l: '#FFE4E2' },
    { c: '#2F95F5', d: '#1766BF', l: '#DDEEFF' },
    { c: '#2EBD55', d: '#1B8C3C', l: '#DCF6E2' },
    { c: '#FFA41B', d: '#C96F00', l: '#FFF0D2' }
  ];
  const THEMES = {
    day: { sky: ['#2A9DF4', '#7CCBFF', '#D8F1FF'], orb: 'sun', grassA: '#7AD158', grassB: '#6BC24B', roadA: '#6E768A', roadB: '#666E82',
      line: 'rgba(255,255,255,.95)', kerb: '#FF5A5A', fog: '216,241,255', hillFar: '#A6D9C4', hill: '#84C98A', city: '#A9C4E2', cityWin: 'rgba(255,255,255,.6)', night: false, cloud: 1 },
    dusk: { sky: ['#4B3F9E', '#E7708F', '#FFC98A'], orb: 'sunset', grassA: '#6FAE52', grassB: '#63A148', roadA: '#636879', roadB: '#5C6172',
      line: 'rgba(255,246,232,.95)', kerb: '#FF5A5A', fog: '255,201,150', hillFar: '#B983A2', hill: '#7C906C', city: '#7F5F98', cityWin: 'rgba(255,226,150,.9)', night: false, cloud: 0.85 },
    night: { sky: ['#07102F', '#16255C', '#2F4585'], orb: 'moon', grassA: '#2C623A', grassB: '#275934', roadA: '#3A4054', roadB: '#343A4D',
      line: 'rgba(255,255,220,.95)', kerb: '#E84A5A', fog: '47,69,133', hillFar: '#1E2D5C', hill: '#183B37', city: '#141D46', cityWin: 'rgba(255,214,110,.95)', night: true, cloud: 0.35 }
  };
  const SIGNS = ['乌节路', '牛车水', '滨海湾', '圣淘沙', '小印度', '植物园', '东海岸', '樟宜', '裕廊', '宏茂桥'];
  const HDB_COL = ['#F4C95D', '#EE8F4B', '#6FB7E0', '#F28FAD', '#8FD19A', '#B99AE8'];
  const CAR_COL = [['#3AA0FF', '#1C6CC8'], ['#2EBD55', '#1B8C3C'], ['#B25CFF', '#7A2FC8'], ['#FFB020', '#C97A00']];
  const STAMPS = ['棒', '好', '对', '优'];
  const GREEN = { c: '#2EBD55', d: '#1B8C3C', l: '#DCF6E2' };

  const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
  const lerp = (a, b, t) => a + (b - a) * t;
  const smooth = (t) => (t <= 0 ? 0 : t >= 1 ? 1 : t * t * (3 - 2 * t));
  const nowMs = () => (W.performance && performance.now ? performance.now() : Date.now());
  const hasLatin = (s) => /[A-Za-zāáǎàēéěèīíǐìōóǒòūúǔùǖǘǚǜü]/.test(s);
  const laneC = (i, n) => -1 + (2 * i + 1) / n;
  function rng(seed) { let s = (seed >>> 0) || 1; return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; }; }
  function fonts() {
    const F = (HW.arcade && HW.arcade.fonts) || {};
    return {
      kai: F.kai || '"Kaiti SC","STKaiti","KaiTi","楷体","Noto Serif SC",serif',
      py: F.py || '"Helvetica Neue",Arial,"PingFang SC",system-ui,sans-serif',
      num: F.num || '"Baloo 2","Arial Rounded MT Bold","Helvetica Neue",Arial,system-ui,sans-serif',
      sans: F.sans || '"PingFang SC","Hiragino Sans GB","Microsoft YaHei","Noto Sans SC",system-ui,sans-serif'
    };
  }
  function cfgFor(lv) {
    return {
      v: 8.6 + lv * 0.95,                                   // 巡航速度（世界单位/秒）
      read: Math.max(4.2, 7.6 - lv * 0.38),                 // 读题基础秒数（另按字数加）
      cones: lv >= 3 ? Math.min(3, 1 + Math.floor((lv - 3) / 2)) : 0,
      traffic: lv >= 5 ? (lv >= 8 ? 2 : 1) : 0,
      swap: lv >= 9 ? 1 : lv >= 7 ? 0.6 : 0,                // 门换位置的概率
      curve: 0.0042 + lv * 0.0008,
      theme: lv <= 3 ? 'day' : lv <= 6 ? 'dusk' : 'night'
    };
  }
  function validItem(it) {
    return !!it && typeof it.q === 'string' && Array.isArray(it.c) && it.c.length >= 2 && it.c.length <= 4 &&
      Number.isInteger(it.a) && it.a >= 0 && it.a < it.c.length && it.c.every((x) => typeof x === 'string' && x.length);
  }

  /* ---------- 离屏小工具 ---------- */
  function mk(w, h, dpr) {
    const cv = document.createElement('canvas');
    cv.width = Math.max(1, Math.ceil(w * dpr)); cv.height = Math.max(1, Math.ceil(h * dpr));
    const x = cv.getContext('2d'); x.setTransform(dpr, 0, 0, dpr, 0, 0);
    return { cv, x, w, h };
  }
  function rr(x, X, Y, w, h, r) {
    r = Math.max(0, Math.min(r, w / 2, h / 2));
    x.beginPath(); x.moveTo(X + r, Y);
    x.arcTo(X + w, Y, X + w, Y + h, r); x.arcTo(X + w, Y + h, X, Y + h, r);
    x.arcTo(X, Y + h, X, Y, r); x.arcTo(X, Y, X + w, Y, r); x.closePath();
  }
  let GLOW = null;
  function glowSpr() {
    if (GLOW) return GLOW;
    const s = mk(128, 128, 1);
    const gr = s.x.createRadialGradient(64, 64, 0, 64, 64, 64);
    gr.addColorStop(0, 'rgba(255,240,170,.95)'); gr.addColorStop(0.3, 'rgba(255,214,110,.5)'); gr.addColorStop(1, 'rgba(255,200,90,0)');
    s.x.fillStyle = gr; s.x.fillRect(0, 0, 128, 128);
    GLOW = s; return s;
  }
  const SIGN = new Map();
  function signSpr(name) {
    let s = SIGN.get(name);
    if (s) return s;
    const F = fonts();
    s = mk(220, 84, 2);
    const x = s.x;
    rr(x, 3, 3, 214, 78, 12); x.fillStyle = '#1F8A4C'; x.fill(); x.lineWidth = 4; x.strokeStyle = '#FFFFFF'; x.stroke();
    rr(x, 1, 1, 218, 82, 14); x.lineWidth = 2; x.strokeStyle = NAVY; x.stroke();
    x.fillStyle = '#FFFFFF'; x.font = '700 38px ' + F.sans; x.textAlign = 'center'; x.textBaseline = 'middle';
    x.fillText(name, 92, 45, 150);
    x.beginPath(); x.moveTo(172, 28); x.lineTo(200, 42); x.lineTo(172, 56); x.closePath(); x.fill(); x.fillRect(152, 37, 22, 10);
    SIGN.set(name, s);
    return s;
  }
  const LABEL = new Map();
  function labelSpr(txt, bg) {
    const key = txt + '|' + bg;
    let s = LABEL.get(key);
    if (s) return s;
    const F = fonts();
    s = mk(200, 64, 2);
    const x = s.x;
    x.font = '700 44px ' + F.kai; x.textAlign = 'center'; x.textBaseline = 'middle'; x.lineJoin = 'round';
    x.lineWidth = 8; x.strokeStyle = NAVY; x.strokeText(txt, 100, 34);
    x.fillStyle = '#FFFFFF'; x.fillText(txt, 100, 34);
    LABEL.set(key, s);
    return s;
  }

  /* ================= 规格（每局新建） ================= */
  function makeSpec() {
    let S = null;
    const F = fonts();
    const L = { cx: 0, hy: 300, hyT: 300, yCar: 800, hw: 180, camX: 0, x0: 0, carSX: 0, carW: 70, carH: 60, U: 1, small: true,
      bx: 0, by: 0, bw: 0, bh: 0, fsQ: 22, fsO: 20, lhQ: 30, lhO: 26, mode: 'cols', tileY: 0, tileH: 0, colW: 0, gap: 8, boardH: 0, barY: 0,
      btnR: 30, btnX: 0, btnY: 0, spX: 0, spY: 0, touch: false, expl: null };
    const MAXB = 200;
    const BD = new Float64Array(MAXB), BX = new Float64Array(MAXB), BS = new Float64Array(MAXB), BY = new Float64Array(MAXB),
      BC = new Float64Array(MAXB), BW = new Float64Array(MAXB), BK = new Int32Array(MAXB);
    let NB = 0;
    const vis = [];
    const CAR = { k: 'me', d: D0 };
    const puffs = [];
    for (let i = 0; i < 70; i++) puffs.push({ on: false, x: 0, y: 0, vx: 0, vy: 0, r: 4, dr: 20, age: 0, life: 1, a: 0.35, dark: false });
    let puffI = 0;
    const slines = [];
    for (let i = 0; i < 30; i++) slines.push({ a: Math.random() * TAU, r: Math.random() * 400, sp: 900 + Math.random() * 700, len: 40 + Math.random() * 90 });
    const stars = [];
    for (let i = 0; i < 80; i++) stars.push({ x: Math.random(), y: Math.random(), r: 0.6 + Math.random() * 1.3, ph: Math.random() * TAU });
    const clouds = [];
    for (let i = 0; i < 6; i++) clouds.push({ x: Math.random(), y: Math.random(), s: 0.5 + Math.random() * 0.6, sp: 6 + Math.random() * 10 });
    const skyLant = [];
    for (let i = 0; i < 5; i++) skyLant.push({ x: (i + 0.5) / 5 + (Math.random() - 0.5) * 0.1, ph: Math.random(), sp: 0.04 + Math.random() * 0.03, s: 0.7 + Math.random() * 0.5 });
    let city = [], cityW = 1;
    let lastDraw = 0, skyKey = '', skyGrad = null, fogGrad = null;
    const gateCv = [];

    /* ---------- 赛道：弯道分段 ---------- */
    function genTrack(toZ) {
      while (S.trackEnd < toZ) {
        const first = !S.track.length;
        const straight = S.track.length % 2 === 0;
        const len = first ? 46 : straight ? 16 + S.rnd() * 26 : 28 + S.rnd() * 40;
        const c = straight ? 0 : (S.rnd() < 0.5 ? -1 : 1) * (0.55 + S.rnd() * 0.45) * S.C.curve;
        S.track.push({ z0: S.trackEnd, z1: S.trackEnd + len, c });
        S.trackEnd += len;
      }
      while (S.track.length > 2 && S.track[0].z1 < S.z - 4) S.track.shift();
    }
    function curveAt(z) {
      const T = S.track;
      for (let i = 0; i < T.length; i++) {
        const s = T[i];
        if (z < s.z1) {
          if (z < s.z0 || !s.c) return 0;
          return s.c * smooth(Math.min(1, (z - s.z0) / 9, (s.z1 - z) / 9));
        }
      }
      return 0;
    }
    function genScenery(toZ) {
      while (S.scenEnd < toZ) {
        S.scenEnd += 1.6 + S.rnd() * 1.3;
        const n = S.rnd() < 0.45 ? 2 : 1;
        const s0 = S.rnd() < 0.5 ? -1 : 1;
        for (let j = 0; j < n; j++) {
          const side = j ? -s0 : s0;
          const r = S.rnd();
          let k, x;
          if (r < 0.34) { k = 'palm'; x = side * (1.32 + S.rnd() * 0.45); }
          else if (r < 0.52) { k = 'lamp'; x = side * 1.2; }
          else if (r < 0.7) { k = 'hdb'; x = side * (2.35 + S.rnd() * 0.9); }
          else if (r < 0.8) { k = 'lantern'; x = side * 1.24; }
          else if (r < 0.87) { k = 'sign'; x = side * 1.34; }
          else { k = 'bush'; x = side * (1.22 + S.rnd() * 0.3); }
          S.scen.push({ k, z: S.scenEnd + j * 0.4, x, side, seed: (S.rnd() * 1e9) | 0, ph: S.rnd() * TAU, d: 0 });
        }
      }
      let i = 0;
      while (i < S.scen.length && S.scen[i].z < S.z + 0.5) i++;
      if (i) S.scen.splice(0, i);
    }

    /* ---------- 布局 ---------- */
    function genCity(g) {
      const U = L.U;
      city = []; cityW = g.w * 1.7 + 260 * U;
      let x = 0, mbs = false, tree = false;
      while (x < cityW) {
        const r = Math.random();
        if (!mbs && x > cityW * 0.15 && r < 0.12) { city.push({ t: 'mbs', x, w: 96 * U, h: 64 * U }); x += 110 * U; mbs = true; continue; }
        if (!tree && x > cityW * 0.5 && r < 0.2) { city.push({ t: 'tree', x, w: 80 * U, h: 46 * U }); x += 92 * U; tree = true; continue; }
        const bw = (16 + Math.random() * 28) * U, bh = (18 + Math.random() * 50) * U;
        const win = [];
        const cols = Math.max(1, Math.floor(bw / (8 * U))), rows = Math.max(1, Math.floor(bh / (10 * U)));
        for (let r2 = 0; r2 < rows; r2++) for (let q = 0; q < cols; q++) if (Math.random() < 0.5) win.push(4 * U + q * 8 * U, 5 * U + r2 * 10 * U);
        city.push({ t: 'b', x, w: bw, h: bh, win });
        x += bw + (1 + Math.random() * 6) * U;
      }
      if (!mbs) city.push({ t: 'mbs', x: cityW * 0.3, w: 96 * U, h: 64 * U });
    }
    /* 把当前车道的选项填进题目的（　）里预览：一个空填整个选项；两个空且选项是“因为……所以……”这类就拆开分别填 */
    const BLANK = '（　）';
    function fillParts(item, text) {
      const s = item.q, nb = s.split(BLANK).length - 1;
      if (!nb) return null;
      let parts;
      if (nb === 1) { if (text.length > 8) return null; parts = [text]; }
      else { parts = text.split(/…+|\.{3,}/).map((x) => x.trim()).filter(Boolean); if (parts.length !== nb) return null; }
      let out = '', rest = s;
      const ranges = [];
      for (let i = 0; i < nb; i++) {
        const at = rest.indexOf(BLANK);
        out += rest.slice(0, at) + '（';
        const a = out.length;
        out += parts[i];
        ranges.push([a, out.length]);
        out += '）';
        rest = rest.slice(at + BLANK.length);
      }
      return { str: out + rest, ranges };
    }
    function qText(q, op) { return op && op.fill ? op.fill.str : q.item.q; }
    function optFont(t) { return hasLatin(t) ? 'py' : 'kai'; }
    /* 均衡换行：中文按字平均分行（标点不放行首），缓存结果，每帧零分配 */
    const WRAPC = new Map();
    const NO_START = '，。！？、；：”’）》…—,.!?;:)';
    const BRK = '，。！？；：、”’）》…';
    function wrapBal(g, str, maxW, fs, font) {
      const key = str + '|' + Math.round(maxW) + '|' + fs + '|' + font;
      let out = WRAPC.get(key);
      if (out) return out;
      out = g.wrapText(str, maxW, fs, font);
      if (font !== 'py' && out.length > 1) {
        const ch = Array.from(str), n = ch.length;
        const fits = (a, b) => g.measure(ch.slice(a, b).join(''), fs, font) <= maxW + 0.5;
        for (let k = out.length; k <= out.length + 1; k++) {
          const res = [];
          let i = 0;
          for (let ln = 0; ln < k && i < n; ln++) {
            const left = k - ln;
            if (left === 1) { res.push(ch.slice(i).join('')); i = n; break; }
            const target = i + Math.ceil((n - i) / left);
            let jMax = i + 1;
            while (jMax < n && fits(i, jMax + 1)) jMax++;
            // 优先在标点后断行（不把词语拆开），离平均长度最近的那个
            let j = -1, best = 1e9;
            for (let q = Math.ceil(i + (target - i) * 0.55); q <= jMax && q < n; q++) {
              if (q > i && BRK.indexOf(ch[q - 1]) >= 0 && NO_START.indexOf(ch[q]) < 0) { const dd = Math.abs(q - target); if (dd < best) { best = dd; j = q; } }
            }
            if (j < 0) {
              j = Math.min(target, jMax);
              while (j < n && NO_START.indexOf(ch[j]) >= 0) j++;
              if (j - i > 1 && '“‘（《'.indexOf(ch[j - 1]) >= 0) j--;
            }
            res.push(ch.slice(i, j).join(''));
            i = j;
          }
          if (i >= n && res.length <= k && res.every((l) => g.measure(l, fs, font) <= maxW + 0.5)) { out = res; break; }
        }
      }
      if (WRAPC.size > 400) WRAPC.clear();
      WRAPC.set(key, out);
      return out;
    }
    function optSize(fs, t) { return hasLatin(t) ? Math.round(fs * 0.86) : fs; }
    /* 路牌里一行能放下的文字宽度（fitBoard 与 drawBoard 共用，保证量的和画的一致） */
    const colTextW = (w) => w - 16;
    const rowTextW = (w) => w - 100;
    /* 两行的车道路牌只接受“自然断行”：断在标点后（因为……/所以……）或拼音空格处（shēng/bìng），
       不把“干干净净”“植物园”这种词从中间劈开 */
    function naturalBreak(line) {
      const last = line.charAt(line.length - 1);
      return BRK.indexOf(last) >= 0 || /[\s…]$/.test(line) || hasLatin(line);
    }
    /* 竖排（每个选项一列）能用的最大字号：一行放下，或两行且自然断行；都不行返回 null（改用横排） */
    function colsFont(g, q, colW, fo, minF) {
      const room = colTextW(colW);
      for (let fz0 = fo; fz0 >= minF; fz0--) {
        let ok = true, ml = 1;
        for (const op of q.opts) {
          const f = optFont(op.text), fz = optSize(fz0, op.text);
          if (g.measure(op.text, fz, f) <= room) continue;
          const ls = wrapBal(g, op.text, room, fz, f);
          if (ls.length > 2 || !naturalBreak(ls[0]) || ls.some((l) => g.measure(l, fz, f) > room + 0.5)) { ok = false; break; }
          ml = 2;
        }
        if (ok) return { fz: fz0, ml };
      }
      return null;
    }
    function fitBoard(g) {
      const q = S && (S.q || S.pre);
      const h = g.h;
      if (!q) { L.bh = 0; L.boardH = 0; L.tileY = L.by; L.barY = L.by; L.hyT = Math.round(Math.max(L.by + 70, h * 0.34)); return; }
      const n = q.opts.length;
      const gap0 = L.small ? 7 : 12;
      // 题板底边不超过画面 55%（手机）/ 57%（电脑），给路面留地方：长句题（病句、成语用法）字号逐级缩小直到放得下
      const maxBottom = h * (L.small ? 0.55 : 0.57);
      const minCol = L.small ? 17 : 19;
      let best = null;
      for (let step = 0; step < 8; step++) {
        const fq = Math.max(16, L.fsQ0 - step * 2), fo = Math.max(16, L.fsO0 - step * 2);
        const qW = L.bw - 36;
        let ql = wrapBal(g, q.item.q, qW, fq, 'kai').length;
        for (const op of q.opts) ql = Math.max(ql, wrapBal(g, qText(q, op), qW, fq, 'kai').length);
        const lhQ = Math.round(fq * 1.38);
        const bh = ql * lhQ + (L.small ? 24 : 28);
        const colW = (L.bw - gap0 * (n - 1)) / n;
        const cf = colsFont(g, q, colW, fo, Math.min(minCol, fo));
        let mode, tileH, boardH, gap, fsO, lhO;
        if (cf) {
          // 一个选项一列：左右顺序 = 车道顺序，最直观。四字词语宁可字小一号也保持一行
          mode = 'cols'; gap = gap0; fsO = cf.fz; lhO = Math.round(fsO * 1.28);
          tileH = Math.max(58, cf.ml * lhO + 30); boardH = tileH;
        } else {
          // 句子类选项：一个选项一行（编号、颜色与路上的门对应）
          mode = 'rows'; gap = L.small ? 5 : 8; fsO = fo; lhO = Math.round(fo * 1.25);
          let rl = 1;
          for (const op of q.opts) rl = Math.max(rl, wrapBal(g, op.text, rowTextW(L.bw), optSize(fo, op.text), optFont(op.text)).length);
          tileH = Math.max(L.small ? 46 : 42, rl * lhO + 14); boardH = n * tileH + (n - 1) * gap;
        }
        const bottom = L.by + bh + 14 + boardH + 20;
        best = { fsQ: fq, fsO, lhQ, lhO, bh, mode, tileH, boardH, colW, gap, bottom };
        if (bottom <= maxBottom) break;
      }
      Object.assign(L, best);
      L.tileY = L.by + L.bh + 14;
      L.barY = L.tileY + L.boardH + 12;
      L.hyT = Math.round(Math.max(L.barY + (L.small ? 34 : 46), h * 0.3));
    }
    function layout(g, snap) {
      const w = g.w, h = g.h;
      L.small = w < 600;
      L.U = clamp(Math.min(w / 390, h / 700), 1, 1.5);
      try { L.touch = !!(W.matchMedia && W.matchMedia('(pointer: coarse)').matches) || ('ontouchstart' in W); } catch (e) { L.touch = false; }
      L.cx = w / 2;
      L.hw = w < 700 ? w * 0.47 : Math.min(w * 0.3, 420);
      L.pad = L.small ? 10 : 18;
      L.fsQ0 = clamp(Math.round(Math.min(w * 0.058, h * 0.036)), 20, 30);
      L.fsO0 = clamp(Math.round(Math.min(w * 0.055, h * 0.034)), 18, 27);
      L.bw = Math.min(w - L.pad * 2, 960);
      L.bx = Math.round((w - L.bw) / 2);
      L.by = Math.round(g.hudTop + 14);
      L.carW = clamp(L.hw * 2 / 4 * 0.8, 58, 128);
      L.carH = L.carW * 0.9;
      L.yCar = h - Math.max(20, h * 0.035);
      L.btnR = Math.round(clamp(29 * L.U, 29, 40));
      L.btnX = w - L.btnR - 14; L.btnY = h - L.btnR - 18;
      L.spX = L.btnR + 14; L.spY = L.btnY;
      fitBoard(g);
      if (snap) L.hy = L.hyT;
      genCity(g);
      skyKey = '';
    }

    /* ---------- 道路投影 ---------- */
    function computeRoad(g) {
      const hy = L.hy, yc = L.yCar, hw = L.hw;
      const dNear = Math.max(0.3, D0 * (yc - hy) / (g.h + 40 - hy));
      let x = 0, dx = 0, prev = 0;
      const step = (d) => { const l = d - prev; if (l <= 0) return; const cc = curveAt(S.z + prev + l * 0.5); x += dx * l + 0.5 * cc * l * l; dx += cc * l; prev = d; };
      step(dNear);
      BD[0] = dNear; BX[0] = x; BK[0] = Math.floor(S.z + dNear); NB = 1;
      for (let k = Math.floor(S.z + dNear) + 1; NB < MAXB; k++) {
        const d = k - S.z;
        if (d > DFAR) break;
        step(d);
        BD[NB] = d; BX[NB] = x; BK[NB] = k; NB++;
      }
      const xCar = xAtD(D0);
      L.x0 = xCar;
      L.camX = xCar + S.carX * 0.42;
      for (let i = 0; i < NB; i++) {
        const s = D0 / BD[i];
        BS[i] = s; BY[i] = hy + (yc - hy) * s; BW[i] = hw * s; BC[i] = L.cx + (BX[i] - L.camX) * hw * s;
      }
      L.carSX = L.cx + (xCar + S.carX - L.camX) * hw;
    }
    function xAtD(d) {
      if (NB < 2) return 0;
      if (d <= BD[1]) { const t = (d - BD[0]) / Math.max(1e-6, BD[1] - BD[0]); return BX[0] + (BX[1] - BX[0]) * t; }
      const f = d - BD[1];
      const i = 1 + Math.floor(f);
      if (i >= NB - 1) return BX[NB - 1] + (BX[NB - 1] - BX[NB - 2]) * (d - BD[NB - 1]);
      const t = f - (i - 1);
      return BX[i] + (BX[i + 1] - BX[i]) * t;
    }
    function laneSX(i) { return L.cx + (L.x0 + laneC(i, S.N) - L.camX) * L.hw; }

    /* ---------- 题目流程 ---------- */
    function prepQuestion(g) {
      if (S.qi >= S.queue.length) S.queue = S.queue.concat(g.shuffle(S.queue.slice(0, Math.max(1, S.qi))));
      const item = S.queue[S.qi++];
      const n = item.c.length;
      const order = g.shuffle(Array.from({ length: n }, (_, i) => i));
      const opts = order.map((idx, lane) => ({ k: 'gate', idx, text: String(item.c[idx]), col: lane, lane, lx: lane, pop: 0, spr: null, d: 0, fill: null }));
      opts.forEach((op) => { op.fill = fillParts(item, op.text); });
      return { item, opts, t: 0, T: 0, z: 0, dist: 1, prog: 0, res: null, out: 0, gone: false, swapAt: 0, swapped: false, tick: false, last: false };
    }
    function readTime(item) {
      let chars = 0;
      const all = item.q + item.c.join('');
      for (const ch of all) chars += /[㐀-鿿]/.test(ch) ? 1 : 0.35;
      return S.C.read + Math.min(5, chars * 0.05);
    }
    function setLanes(n) {
      n = clamp(n, 2, 4);
      if (n === S.N) return;
      const oldN = S.N;
      S.Nold = oldN; S.N = n; S.nMix = 0;
      S.lane = clamp(Math.round(S.lane * (n - 1) / Math.max(1, oldN - 1)), 0, n - 1);
    }
    function nextQuestion(g) {
      if (!S || g.state !== 'play') return;
      const q = S.pre || prepQuestion(g);
      S.pre = null;
      setLanes(q.opts.length);
      S.q = q;
      S.qn++;
      q.T = readTime(q.item);
      q.dist = S.cruise * q.T;
      q.z = S.z + D0 + q.dist;
      q.last = g.done === g.rounds - 1;
      q.swapAt = S.C.swap && Math.random() < S.C.swap && q.opts.length > 2 ? 0.34 + Math.random() * 0.16 : 0;
      S.turbo = false; S.turboUsed = false; S.stamp = null;
      fitBoard(g);
      makeGateSprites(g);
      S.banner.a = 0;
      g.tween(S.banner, { a: 1 }, 0.5, 'outBack');
      q.opts.forEach((op, i) => g.after(0.15 + i * 0.1, () => { g.tween(op, { pop: 1 }, 0.4, 'outBack'); g.sfx('pop'); }));
      g.sfx('whoosh');
      spawnStuff(g);
    }
    function spawnStuff(g) {
      const q = S.q, carZ = S.z + D0;
      const zMin = carZ + 10, zMax = q.z - Math.max(14, S.cruise * 2);
      const used = [];
      const free = (lane, z) => !used.some((u) => u.lane === lane && Math.abs(u.z - z) < 7);
      if (zMax - zMin > 8) {
        const trails = zMax - zMin > 34 ? 2 : 1;
        for (let t = 0; t < trails; t++) {
          const lane = g.randi(0, S.N - 1), z0 = lerp(zMin, zMax - 6, (t + Math.random() * 0.6) / trails);
          for (let i = 0; i < 5; i++) S.objs.push({ k: 'coin', z: z0 + i * 1.25, x: laneC(lane, S.N), lane, hit: false, ft: 0, d: 0 });
          used.push({ lane, z: z0 + 2.5 });
        }
        for (let i = 0; i < S.C.cones; i++) {
          for (let tries = 0; tries < 8; tries++) {
            const lane = g.randi(0, S.N - 1), z = g.rand(zMin + 4, zMax);
            if (!free(lane, z)) continue;
            S.objs.push({ k: 'cone', z, x: laneC(lane, S.N), lane, hit: false, ft: 0, d: 0 });
            used.push({ lane, z });
            break;
          }
        }
        for (let i = 0; i < S.C.traffic; i++) {
          const lane = g.randi(0, S.N - 1), vo = S.cruise * 0.38;
          const reach = Math.max(4, (q.z - carZ - S.cruise * 2.4) * (1 - 0.38));
          const z = carZ + g.rand(Math.min(12, reach * 0.5), reach);
          if (!free(lane, z)) continue;
          const cc = CAR_COL[g.randi(0, CAR_COL.length - 1)];
          S.objs.push({ k: 'car', z, x: laneC(lane, S.N), lane, v: vo, hit: false, ft: 0, col: cc[0], dark: cc[1], d: 0 });
          used.push({ lane, z });
        }
      }
    }
    function doSwap(g) {
      const q = S.q;
      q.swapped = true;
      const n = q.opts.length;
      let a = S.lane, b;
      if (Math.random() < 0.35) a = g.randi(0, n - 1);
      do { b = g.randi(0, n - 1); } while (b === a);
      const oa = q.opts.find((o) => o.lane === a), ob = q.opts.find((o) => o.lane === b);
      if (!oa || !ob) return;
      oa.lane = b; ob.lane = a;
      g.tween(oa, { lx: b }, 0.7, 'inOutQuad');
      g.tween(ob, { lx: a }, 0.7, 'inOutQuad');
      g.sfx('swing');
      g.float('门换位置啦！', L.cx, L.hy + (L.yCar - L.hy) * 0.28, { color: '#FFE45C', size: 26 });
    }
    function resolve(g) {
      const q = S.q;
      const op = q.opts.find((o) => o.lane === S.lane) || q.opts[0];
      const ok = op.idx === q.item.a;
      q.res = { op, ok };
      q.out = 0;
      S.turbo = false;   // 过了门加速键复位（答对的极速奖励看 turboUsed）
      g.tween(q, { out: 1 }, 0.38, 'outQuad', () => { q.gone = true; });
      const sx = L.carSX, sy = L.yCar - L.carH * 0.6;
      const gy = L.yCar - L.carH * 1.35;
      smashGate(g, op, ok);
      if (ok) {
        S.stamp = { t: 0, ch: STAMPS[(Math.random() * STAMPS.length) | 0] };
        g.burst(sx, gy, { kind: 'confetti', n: 36 });
        const turboBonus = S.turboUsed;
        g.right(q.item, sx, sy);
        S.boost = 1.5;
        g.sfx('power');
        for (let i = 0; i < 4; i++) g.burst(g.rand(g.w * 0.12, g.w * 0.88), L.hy + (L.yCar - L.hy) * g.rand(0.4, 0.6), { kind: 'coin', n: 6 });
        // 最后一题答对会自动通关（state 变 over），极速奖励照样加（引擎会同步存档与结算分数）
        if (turboBonus) { g.addScore(10); g.float('极速 +10', sx, sy - 70, { color: '#7FE3FF', size: 24 }); }
        if (g.state === 'play') g.after(1.05, () => nextQuestion(g));
      } else {
        const right = q.item.c[q.item.a];
        const note = q.item.q + ' 正确答案：' + right + '（你选了：' + op.text + '）';
        g.burst(sx, gy, { kind: 'dot', color: OPT[op.col].c, n: 18 });
        const final = g.maxLives > 0 && g.lives <= 1;
        if (final) {
          // 最后一颗心：先停车把讲解看完（点继续或讲解放完），再扣心结束——最后这道错题也要弄懂
          S.pendingWrong = { item: q.item, note };
          S.halt = true;
          g.float('✗', sx, sy - 24, { color: '#FF5A5F', size: 50 });
          g.shake(13); g.flash('#FF2E2E'); g.sfx('hit');
        } else {
          g.wrong(q.item, note, sx, sy);
          // 这道错题本关过两题再考一次（放到队尾的话 10 题通关前根本轮不到）
          S.queue.splice(Math.min(S.queue.length, S.qi + 2), 0, q.item);
        }
        g.sfx('crash');
        S.spin = 0;
        g.tween(S, { spin: TAU }, 0.95, 'outCubic');
        S.slow = 1.1;
        for (let i = 0; i < 16; i++) puff(sx + g.rand(-L.carW * 0.6, L.carW * 0.6), L.yCar - g.rand(0, L.carH * 0.4), g.rand(-160, 160), g.rand(-90, 20), g.rand(10, 18) * L.U, 0.9, 0.5, false);
        const e = String(q.item.e || '');
        S.explain = { ans: right, e, t: -0.35, dur: clamp(2.3 + e.length * 0.045, 2.6, 4.4) + (final ? 1 : 0), final };   // 先看 0.35 秒打滑再弹讲解
      }
    }
    function closeExplain(g) {
      if (!S.explain) return;
      S.explain = null;
      if (S.pendingWrong) {
        const pw = S.pendingWrong;
        S.pendingWrong = null;
        g.wrong(pw.item, pw.note, L.carSX, L.yCar - L.carH * 0.6);   // 心归零 → 引擎播放失败动画
      }
      if (g.state === 'play') { S.halt = false; g.after(0.2, () => nextQuestion(g)); }
    }
    /* ---------- 冲门碎片：答对 = 门牌从中间劈成两半飞出去、门柱往两边倒；答错 = 整块门牌被撞飞翻跟头 ---------- */
    const debris = [];
    const DCV = [document.createElement('canvas'), document.createElement('canvas')];
    let dcvI = 0;
    function smashGate(g, op, ok) {
      if (!op.spr || !op.spr.cv.width) return;
      // 门牌精灵画布下一题会重画，碎片要用自己的副本
      const cv = DCV[dcvI]; dcvI = (dcvI + 1) % DCV.length;
      cv.width = op.spr.cv.width; cv.height = op.spr.cv.height;
      const x2 = cv.getContext('2d'); x2.clearRect(0, 0, cv.width, cv.height); x2.drawImage(op.spr.cv, 0, 0);
      const lw = L.hw * 2 / S.N, gw = lw * 0.86, pw = Math.max(1.5, gw * 0.09), H = gw * 0.95;
      const gx = L.cx + (xAtD(D0) + laneC(op.lx, S.N) - L.camX) * L.hw, gyB = L.yCar;
      const ratio = (gw * 1.054) / op.spr.bw;
      const spW = op.spr.w * ratio, spH = op.spr.h * ratio;
      const cy = gyB - H - (op.spr.top + op.spr.bh * 0.62) * ratio + spH / 2;
      const U = L.U, col = OPT[op.col].c;
      op.smashed = true;
      debris.length = 0;
      for (let side = -1; side <= 1; side += 2) {
        debris.push({ cv: null, col, w: pw, h: H * 0.85, x: gx + side * (gw / 2 - pw / 2), y: gyB - H * 0.45, vx: side * g.rand(90, 160) * U, vy: -g.rand(120, 220) * U, r: 0, vr: side * g.rand(2, 3.5), t: 0, life: 0.95 });
      }
      if (ok) {
        for (let side = -1; side <= 1; side += 2) {
          debris.push({ cv, sx: side < 0 ? 0 : 0.5, sw: 0.5, w: spW / 2, h: spH, x: gx + side * spW / 4, y: cy, vx: side * g.rand(190, 280) * U, vy: -g.rand(280, 380) * U, r: 0, vr: side * g.rand(3, 5.5), t: 0, life: 1 });
        }
        g.ring(gx, cy, '#FFE45C');
        g.burst(gx, cy, { kind: 'star', n: 12 });
        g.shake(6);
      } else {
        debris.push({ cv, sx: 0, sw: 1, w: spW, h: spH, x: gx, y: cy, vx: g.rand(-70, 70) * U, vy: -g.rand(220, 280) * U, r: 0, vr: (Math.random() < 0.5 ? -1 : 1) * g.rand(4, 6), t: 0, life: 1.05 });
      }
    }
    function updDebris(dt) {
      if (!debris.length) return;
      let j = 0;
      for (let i = 0; i < debris.length; i++) {
        const p = debris[i];
        p.t += dt;
        if (p.t >= p.life) continue;
        p.vy += 1150 * L.U * dt; p.x += p.vx * dt; p.y += p.vy * dt; p.r += p.vr * dt;
        debris[j++] = p;
      }
      debris.length = j;
    }
    function drawDebris(g, c) {
      for (let i = 0; i < debris.length; i++) {
        const p = debris[i];
        c.save();
        c.globalAlpha = clamp((p.life - p.t) / 0.3, 0, 1);
        c.translate(p.x, p.y); c.rotate(p.r);
        if (p.cv) { const cw = p.cv.width, ch = p.cv.height; c.drawImage(p.cv, cw * p.sx, 0, cw * p.sw, ch, -p.w / 2, -p.h / 2, p.w, p.h); }
        else { rr(c, -p.w / 2, -p.h / 2, p.w, p.h, p.w * 0.5); c.fillStyle = p.col; c.fill(); c.lineWidth = Math.max(1, 2 * L.U); c.strokeStyle = NAVY; c.stroke(); }
        c.restore();
      }
    }
    function steer(g, lane) {
      if (!S || !S.N) return;
      lane = clamp(lane, 0, S.N - 1);
      if (lane === S.lane) { S.wob = Math.max(S.wob, 0.35); return; }
      S.lane = lane; S.moved = true;
      g.sfx('swing');
    }
    function turbo(g, on) {
      if (on === false) { S.turbo = false; return; }
      if (!S.q || S.q.res || S.turbo || g.state !== 'play') return;
      S.turbo = true; S.turboUsed = true;
      g.sfx('power');
      g.float('加速！', L.carSX, L.yCar - L.carH - 34, { color: '#FFB347', size: 26 });
    }

    /* ---------- 物件更新 / 碰撞 ---------- */
    function updateObjs(g, dt) {
      const carZ = S.z + D0, half = 1 / S.N;
      for (let i = 0; i < S.objs.length; i++) {
        const o = S.objs[i];
        if (o.k === 'car' && !o.hit) o.z += o.v * dt;
        if (o.hit) continue;
        if (o.z <= carZ && o.z > carZ - 1.5) {
          if (Math.abs(o.x - S.carX) < half * (o.k === 'coin' ? 1.0 : 0.8)) {
            o.hit = true;
            if (o.k === 'coin') {
              g.addScore(5);
              g.sfx('coin');
              g.burst(L.carSX, L.yCar - L.carH * 0.8, { kind: 'spark', n: 5, color: '#FFE45C' });
              o.fx = L.carSX; o.fy = L.yCar - L.carH * 0.8;
              g.tween(o, { ft: 1 }, 0.5, 'inQuad');
            } else {
              g.miss();
              g.sfx('crash');
              g.float(o.k === 'cone' ? '撞到路障！' : '撞到慢车！', L.carSX, L.yCar - L.carH - 30, { color: '#FFD0D0', size: 22 });
              g.burst(L.carSX, L.yCar - L.carH * 0.5, { kind: 'dot', color: o.k === 'cone' ? '#FF8A3D' : o.col, n: 14 });
              S.slow = Math.max(S.slow, 0.55); S.wob = 1;
              o.fx = 0; g.tween(o, { ft: 1 }, 0.6, 'outQuad');
            }
          }
        }
      }
      let j = 0;
      for (let i = 0; i < S.objs.length; i++) {
        const o = S.objs[i];
        const keep = o.hit ? o.ft < 1 : o.z > S.z + 0.4;
        if (keep) S.objs[j++] = o;
      }
      S.objs.length = j;
    }
    function puff(x, y, vx, vy, r, life, a, dark) {
      const p = puffs[puffI]; puffI = (puffI + 1) % puffs.length;
      p.on = true; p.x = x; p.y = y; p.vx = vx; p.vy = vy; p.r = r; p.dr = r * 2.2; p.age = 0; p.life = life; p.a = a; p.dark = dark;
    }
    function advance(g, dt) {
      S.z += S.v * dt;
      S.wheel += S.v * dt * 2.4;
      const dx = laneC(S.lane, S.N) - S.carX;
      S.carX += dx * Math.min(1, dt * 10);
      S.tilt += (clamp(dx * 0.42, -0.26, 0.26) - S.tilt) * Math.min(1, dt * 12);
      if (S.wob > 0) S.wob = Math.max(0, S.wob - dt * 1.7);
      if (S.nMix < 1) S.nMix = Math.min(1, S.nMix + dt * 2.2);
      if (S.stamp) S.stamp.t += dt;
      L.hy += (L.hyT - L.hy) * Math.min(1, dt * 5);
      const cv = curveAt(S.z + D0);
      S.bgX -= cv * S.v * dt * g.w * 1.3;
      S.lean += (clamp(-cv * 22, -0.12, 0.12) - S.lean) * Math.min(1, dt * 3);
      genTrack(S.z + DFAR + 90);
      genScenery(S.z + DFAR + 4);
      // 尾气 / 火焰烟
      S.puffT -= dt;
      const fast = S.boost > 0 || (S.turbo && S.q && !S.q.res);
      if (S.puffT <= 0 && L.carW) {
        S.puffT = fast ? 0.035 : S.v > 0.5 ? 0.09 : 0.16;
        for (let s = -1; s <= 1; s += 2) {
          puff(L.carSX + s * L.carW * 0.13, L.yCar - L.carH * 0.14, s * g.rand(10, 40) + S.tilt * 60, g.rand(40, 110), g.rand(3, 5) * L.U, fast ? 0.35 : 0.55, fast ? 0.28 : 0.3, !fast && S.theme.night === false);
        }
      }
      for (let i = 0; i < puffs.length; i++) {
        const p = puffs[i];
        if (!p.on) continue;
        p.age += dt;
        if (p.age >= p.life) { p.on = false; continue; }
        p.x += p.vx * dt; p.y += p.vy * dt; p.r += p.dr * dt; p.vx *= 0.96; p.vy *= 0.97;
      }
      const inten = S.boost > 0 ? 1 : fast ? 0.7 : 0;
      S.lineA += (inten - S.lineA) * Math.min(1, dt * 6);
      if (S.lineA > 0.02) {
        const maxR = Math.hypot(g.w, g.h);
        for (const l of slines) { l.r += l.sp * dt * (0.6 + S.lineA * 0.6); if (l.r > maxR) { l.r = 30 + Math.random() * 80; l.a = Math.random() * TAU; l.len = 40 + Math.random() * 110; } }
      }
    }

    /* ---------- 画：天空 / 远景 ---------- */
    function hills(c, w, y, amp, col, off, k, ph) {
      c.fillStyle = col;
      c.beginPath(); c.moveTo(-10, y + 40);
      for (let x = -10; x <= w + 20; x += 18) {
        const X = x - off;
        c.lineTo(x, y - amp * (0.55 + 0.45 * Math.sin(X * k + ph)) - amp * 0.3 * Math.sin(X * k * 2.3 + ph * 2));
      }
      c.lineTo(w + 20, y + 40); c.closePath(); c.fill();
    }
    function drawMBS(c, x, base, U, col) {
      c.fillStyle = col;
      for (let i = 0; i < 3; i++) {
        const bx = x + i * 30 * U;
        c.beginPath(); c.moveTo(bx, base); c.lineTo(bx + 3 * U, base - 56 * U); c.lineTo(bx + 17 * U, base - 56 * U); c.lineTo(bx + 20 * U, base); c.closePath(); c.fill();
      }
      c.beginPath(); c.moveTo(x - 8 * U, base - 56 * U); c.lineTo(x + 86 * U, base - 58 * U); c.lineTo(x + 94 * U, base - 63 * U); c.lineTo(x - 8 * U, base - 63 * U); c.closePath(); c.fill();
    }
    function drawTrees(c, x, base, U, col, t, night) {
      for (let i = 0; i < 3; i++) {
        const tx = x + i * 26 * U, th = (34 + (i % 2) * 12) * U, r = (11 + (i % 2) * 3) * U;
        c.fillStyle = col;
        c.beginPath(); c.moveTo(tx - 3 * U, base); c.lineTo(tx - r, base - th); c.lineTo(tx + r, base - th); c.lineTo(tx + 3 * U, base); c.closePath(); c.fill();
        c.beginPath(); c.ellipse(tx, base - th, r * 1.1, r * 0.35, 0, 0, TAU); c.fill();
        if (night) {
          c.fillStyle = ['rgba(255,110,200,.8)', 'rgba(120,220,255,.8)', 'rgba(180,120,255,.8)'][i];
          c.globalAlpha = 0.6 + 0.4 * Math.sin(t * 2 + i);
          c.beginPath(); c.ellipse(tx, base - th, r * 1.1, r * 0.35, 0, 0, TAU); c.fill();
          c.globalAlpha = 1;
        }
      }
    }
    function drawSky(g, c) {
      const T = S.theme, w = g.w, hy = L.hy, U = L.U, t = S.ct;
      const key = S.C.theme + '|' + Math.round(hy) + '|' + Math.round(L.yCar);
      if (key !== skyKey) {
        skyKey = key;
        skyGrad = c.createLinearGradient(0, 0, 0, hy);
        skyGrad.addColorStop(0, T.sky[0]); skyGrad.addColorStop(0.62, T.sky[1]); skyGrad.addColorStop(1, T.sky[2]);
        fogGrad = c.createLinearGradient(0, hy - 2, 0, hy + (L.yCar - hy) * 0.16);
        fogGrad.addColorStop(0, 'rgba(' + T.fog + ',.95)'); fogGrad.addColorStop(1, 'rgba(' + T.fog + ',0)');
      }
      c.fillStyle = skyGrad; c.fillRect(-20, -20, w + 40, hy + 22);
      if (T.night) {
        for (const s of stars) {
          c.globalAlpha = 0.45 + 0.55 * Math.abs(Math.sin(t * 1.3 + s.ph));
          c.fillStyle = '#FFFFFF';
          c.fillRect(s.x * w, s.y * (hy - 10), s.r * 1.4, s.r * 1.4);
        }
        c.globalAlpha = 1;
      }
      // 太阳 / 夕阳 / 月亮（贴近地平线，露在路牌下方）
      const ox = w * 0.8, oy = hy - (L.small ? 18 : 30) * U, orr = (L.small ? 20 : 26) * U;
      if (T.orb === 'moon') {
        c.globalAlpha = 0.5; c.drawImage(glowSpr().cv, ox - orr * 3, oy - orr * 3, orr * 6, orr * 6); c.globalAlpha = 1;
        c.fillStyle = '#FFF6D8'; c.beginPath(); c.arc(ox, oy, orr, 0, TAU); c.fill();
        c.fillStyle = 'rgba(200,190,160,.5)'; c.beginPath(); c.arc(ox - orr * 0.3, oy - orr * 0.2, orr * 0.22, 0, TAU); c.arc(ox + orr * 0.35, oy + orr * 0.3, orr * 0.16, 0, TAU); c.fill();
      } else {
        const big = T.orb === 'sunset' ? 1.5 : 1;
        c.globalAlpha = 0.75 + 0.25 * Math.sin(t * 1.5);
        c.drawImage(glowSpr().cv, ox - orr * 3.4 * big, oy - orr * 3.4 * big, orr * 6.8 * big, orr * 6.8 * big);
        c.globalAlpha = 1;
        c.fillStyle = T.orb === 'sunset' ? '#FF8A4C' : '#FFE14D';
        c.beginPath(); c.arc(ox, oy, orr * big, 0, TAU); c.fill();
        c.fillStyle = T.orb === 'sunset' ? '#FFB27A' : '#FFF6B8';
        c.beginPath(); c.arc(ox - orr * 0.25 * big, oy - orr * 0.25 * big, orr * 0.45 * big, 0, TAU); c.fill();
      }
      // 云（视差）
      const span = w + 300 * U;
      for (const cl of clouds) {
        let x = (cl.x * span + t * cl.sp + S.bgX * 0.12) % span; if (x < 0) x += span;
        const y = L.by + cl.y * Math.max(20, hy - L.by - 30 * U);
        g.cloud(x - 150 * U, y, cl.s * U * (L.small ? 0.9 : 1.2), T.cloud);
      }
      if (T.night) {
        for (const ln of skyLant) {
          const k = (ln.ph + t * ln.sp) % 1;
          const x = ln.x * w + Math.sin(t * 0.8 + ln.ph * 9) * 12;
          const y = hy - k * (hy - L.by) * 1.1;
          const s = ln.s * U * 9;
          c.globalAlpha = Math.min(1, (1 - k) * 2.5) * 0.85;
          c.drawImage(glowSpr().cv, x - s * 2.2, y - s * 2.2, s * 4.4, s * 4.4);
          c.fillStyle = '#FF9A3D'; rr(c, x - s * 0.55, y - s * 0.75, s * 1.1, s * 1.5, s * 0.35); c.fill();
          c.globalAlpha = 1;
        }
      }
      // 远山 + 城市天际线（滨海湾金沙、擎天树）+ 近山，全部随弯道视差
      hills(c, w, hy + 2, 30 * U, T.hillFar, S.bgX * 0.18, 0.011, 1.3);
      let o = (S.bgX * 0.34) % cityW; if (o < 0) o += cityW;
      for (const b of city) {
        let x = b.x + o; if (x > cityW - 120 * U) x -= cityW;
        x -= 120 * U;
        if (x > w || x + b.w < -10) continue;
        const base = hy + 2;
        if (b.t === 'mbs') drawMBS(c, x, base, U, T.city);
        else if (b.t === 'tree') drawTrees(c, x, base, U, T.hill, t, T.night);
        else {
          c.fillStyle = T.city; c.fillRect(x, base - b.h, b.w, b.h + 1);
          if (T.night || S.C.theme === 'dusk') {
            c.fillStyle = T.cityWin;
            const ws = 3.5 * U, hs = 4.5 * U;
            for (let i = 0; i < b.win.length; i += 2) c.fillRect(x + b.win[i], base - b.h + b.win[i + 1], ws, hs);
          }
        }
      }
      hills(c, w, hy + 3, 12 * U, T.hill, S.bgX * 0.5, 0.02, 0.4);
    }

    /* ---------- 画：路面 ---------- */
    function drawRoad(g, c) {
      const T = S.theme, w = g.w;
      c.fillStyle = T.grassA; c.fillRect(-20, L.hy, w + 40, g.h - L.hy + 30);
      c.fillStyle = T.grassB;
      for (let i = NB - 1; i >= 1; i--) if (BK[i - 1] & 1) c.fillRect(-20, BY[i], w + 40, BY[i - 1] - BY[i] + 0.6);
      // 路肩（白），再叠红色段
      const KB = 1.1;
      c.fillStyle = '#FFFFFF';
      for (let side = -1; side <= 1; side += 2) {
        c.beginPath();
        c.moveTo(BC[0] + side * BW[0] * KB, BY[0]);
        for (let i = 1; i < NB; i++) c.lineTo(BC[i] + side * BW[i] * KB, BY[i]);
        for (let i = NB - 1; i >= 0; i--) c.lineTo(BC[i] + side * BW[i], BY[i]);
        c.closePath(); c.fill();
      }
      c.fillStyle = T.kerb;
      c.beginPath();
      for (let i = NB - 1; i >= 1; i--) {
        if (!(BK[i - 1] & 1)) continue;
        for (let side = -1; side <= 1; side += 2) {
          c.moveTo(BC[i - 1] + side * BW[i - 1], BY[i - 1]); c.lineTo(BC[i] + side * BW[i], BY[i]);
          c.lineTo(BC[i] + side * BW[i] * KB, BY[i]); c.lineTo(BC[i - 1] + side * BW[i - 1] * KB, BY[i - 1]); c.closePath();
        }
      }
      c.fill();
      // 路面
      c.fillStyle = T.roadA;
      c.beginPath(); c.moveTo(BC[0] - BW[0], BY[0]);
      for (let i = 1; i < NB; i++) c.lineTo(BC[i] - BW[i], BY[i]);
      for (let i = NB - 1; i >= 0; i--) c.lineTo(BC[i] + BW[i], BY[i]);
      c.closePath(); c.fill();
      c.fillStyle = T.roadB;
      c.beginPath();
      for (let i = NB - 1; i >= 1; i--) {
        if (!(BK[i - 1] & 1)) continue;
        c.moveTo(BC[i - 1] - BW[i - 1], BY[i - 1]); c.lineTo(BC[i] - BW[i], BY[i]); c.lineTo(BC[i] + BW[i], BY[i]); c.lineTo(BC[i - 1] + BW[i - 1], BY[i - 1]); c.closePath();
      }
      c.fill();
      // 当前车道的淡光带（让孩子看清自己在哪条道）
      if (S.q && !S.q.res && g.state === 'play') {
        const col = (S.q.opts.find((o) => o.lane === S.lane) || {}).col;
        if (col != null) {
          const f0 = -1 + 2 * S.lane / S.N, f1 = -1 + 2 * (S.lane + 1) / S.N;
          c.globalAlpha = 0.16 + 0.06 * Math.sin(S.ct * 5);
          c.fillStyle = OPT[col].c;
          c.beginPath();
          c.moveTo(BC[0] + f0 * BW[0], BY[0]);
          for (let i = 1; i < NB; i++) c.lineTo(BC[i] + f0 * BW[i], BY[i]);
          for (let i = NB - 1; i >= 0; i--) c.lineTo(BC[i] + f1 * BW[i], BY[i]);
          c.closePath(); c.fill();
          c.globalAlpha = 1;
        }
      }
      // 车道虚线（换车道数时新旧交叉淡变）
      const lanesLines = (n, alpha) => {
        if (alpha <= 0.01 || n < 2) return;
        c.globalAlpha = alpha; c.fillStyle = T.line;
        c.beginPath();
        for (let i = NB - 1; i >= 1; i--) {
          if (!(BK[i - 1] & 1)) continue;
          for (let q = 1; q < n; q++) {
            const f = -1 + 2 * q / n, dA = BW[i - 1] * 0.028, dB = BW[i] * 0.028;
            const xa = BC[i - 1] + f * BW[i - 1], xb = BC[i] + f * BW[i];
            c.moveTo(xa - dA, BY[i - 1]); c.lineTo(xb - dB, BY[i]); c.lineTo(xb + dB, BY[i]); c.lineTo(xa + dA, BY[i - 1]); c.closePath();
          }
        }
        c.fill();
        c.globalAlpha = 1;
      };
      lanesLines(S.N, S.nMix);
      if (S.nMix < 1 && S.Nold !== S.N) lanesLines(S.Nold, 1 - S.nMix);
      // 起跑线 / 终点线（棋盘格），起跑线前面的路面上刷着“起点”
      const sd = S.startZ - S.z;
      if (sd > BD[0] && sd < DFAR) { checkerLine(c, sd); roadWord(c, '起点', sd + 1.25); }
      const fq = S.q;
      if (fq && fq.last && (!fq.res || fq.res.ok)) { const fd = fq.z + FIN - S.z; if (fd > BD[0] && fd < DFAR) checkerLine(c, fd - 0.2); }
      c.fillStyle = fogGrad; c.fillRect(-20, L.hy - 2, w + 40, (L.yCar - L.hy) * 0.16 + 2);
      // 夜晚车灯光束
      if (T.night && g.state !== 'intro') {
        c.save();
        c.globalCompositeOperation = 'lighter';
        const d1 = D0 + 9, s1 = D0 / d1, y1 = L.hy + (L.yCar - L.hy) * s1;
        const x1 = L.cx + (xAtD(d1) + S.carX - L.camX) * L.hw * s1;
        const gr = c.createLinearGradient(0, L.yCar - L.carH * 0.4, 0, y1);
        gr.addColorStop(0, 'rgba(255,240,170,.32)'); gr.addColorStop(1, 'rgba(255,240,170,0)');
        c.fillStyle = gr;
        c.beginPath();
        c.moveTo(L.carSX - L.carW * 0.35, L.yCar - L.carH * 0.4); c.lineTo(x1 - L.hw * s1 * 0.5, y1);
        c.lineTo(x1 + L.hw * s1 * 0.5, y1); c.lineTo(L.carSX + L.carW * 0.35, L.yCar - L.carH * 0.4); c.closePath(); c.fill();
        c.restore();
      }
    }

    function checkerLine(c, sd) {
      for (let r = 0; r < 2; r++) {
        const dA = Math.max(BD[0], sd + r * 0.22), dB = dA + 0.22;
        const sA = D0 / dA, sB = D0 / dB;
        const yA = L.hy + (L.yCar - L.hy) * sA, yB = L.hy + (L.yCar - L.hy) * sB;
        const cA = L.cx + (xAtD(dA) - L.camX) * L.hw * sA, cB = L.cx + (xAtD(dB) - L.camX) * L.hw * sB;
        const n = 10;
        for (let q = 0; q < n; q++) {
          c.fillStyle = (q + r) & 1 ? '#1d2233' : '#FFFFFF';
          const f0 = -1 + 2 * q / n, f1 = -1 + 2 * (q + 1) / n;
          c.beginPath(); c.moveTo(cA + f0 * L.hw * sA, yA); c.lineTo(cB + f0 * L.hw * sB, yB); c.lineTo(cB + f1 * L.hw * sB, yB); c.lineTo(cA + f1 * L.hw * sA, yA); c.closePath(); c.fill();
        }
      }
    }
    /* 刷在路面上的大字（透视压扁） */
    function roadWord(c, word, d) {
      if (d <= BD[0] || d >= DFAR) return;
      const s = D0 / d, y = L.hy + (L.yCar - L.hy) * s, x = L.cx + (xAtD(d) - L.camX) * L.hw * s;
      const size = Math.round(L.hw * s * 0.5);
      if (size < 6) return;
      c.save();
      c.translate(x, y); c.scale(1, 0.42);
      c.font = '800 ' + size + 'px ' + ((HW.arcade && HW.arcade.fonts && HW.arcade.fonts.round) || F.sans);
      c.textAlign = 'center'; c.textBaseline = 'middle';
      c.fillStyle = 'rgba(255,255,255,.88)';
      c.fillText(word, 0, 0);
      c.restore();
    }

    /* ---------- 画：路边物件 ---------- */
    function drawPalm(c, x, y, k, t, ph, side) {
      const hgt = 215 * k, lean = -side * 0.1;
      const tx = x + lean * hgt, ty = y - hgt;
      c.lineCap = 'round';
      c.strokeStyle = '#8A5A33'; c.lineWidth = Math.max(1, 13 * k);
      c.beginPath(); c.moveTo(x, y); c.quadraticCurveTo(x + lean * hgt * 0.15, y - hgt * 0.6, tx, ty); c.stroke();
      if (k > 0.25) {
        c.strokeStyle = '#6B4424'; c.lineWidth = Math.max(1, 3 * k);
        for (let i = 1; i < 6; i++) { const f = i / 6, px = lerp(x, tx, f * f * 0.3 + f * 0.7), py = lerp(y, ty, f); c.beginPath(); c.moveTo(px - 6 * k, py + 2 * k); c.lineTo(px + 6 * k, py - 2 * k); c.stroke(); }
      }
      const sway = Math.sin(t * 1.4 + ph) * 0.07;
      for (let i = 0; i < 7; i++) {
        const a = -Math.PI + 0.25 + i * 0.44 + sway + Math.sin(t * 2.2 + i + ph) * 0.03;
        const Lf = (i === 0 || i === 6 ? 74 : 90) * k;
        c.save(); c.translate(tx, ty); c.rotate(a);
        c.fillStyle = i % 2 ? '#1F9446' : '#2BAE56';
        c.beginPath(); c.moveTo(0, 0); c.quadraticCurveTo(Lf * 0.45, -16 * k, Lf, 19 * k); c.quadraticCurveTo(Lf * 0.5, 9 * k, 0, 0); c.fill();
        c.restore();
      }
      c.fillStyle = '#6B4423';
      c.beginPath(); c.arc(tx - 6 * k, ty + 7 * k, 6.5 * k, 0, TAU); c.arc(tx + 7 * k, ty + 8 * k, 6.5 * k, 0, TAU); c.fill();
    }
    function drawLamp(c, x, y, k, side, night) {
      const top = y - 185 * k, ax = x - side * 40 * k;
      c.strokeStyle = '#4A5268'; c.lineWidth = Math.max(1, 6 * k); c.lineCap = 'round';
      c.beginPath(); c.moveTo(x, y); c.lineTo(x, top); c.quadraticCurveTo(x, top - 12 * k, ax, top - 8 * k); c.stroke();
      c.fillStyle = '#39405A'; rr(c, ax - 12 * k, top - 12 * k, 24 * k, 9 * k, 4 * k); c.fill();
      c.fillStyle = night ? '#FFF3B0' : '#FFE58A';
      c.beginPath(); c.ellipse(ax, top - 2 * k, 9 * k, 4 * k, 0, 0, TAU); c.fill();
      if (night) { const s = 90 * k; c.globalAlpha = 0.8; c.drawImage(glowSpr().cv, ax - s, top - s, s * 2, s * 2); c.globalAlpha = 1; }
    }
    function drawHDB(c, x, y, k, seed, night) {
      const r = rng(seed);
      const bw = (150 + r() * 50) * k, bh = (230 + r() * 120) * k;
      const L0 = x - bw / 2, T0 = y - bh;
      const col = HDB_COL[(seed >>> 3) % HDB_COL.length];
      c.fillStyle = night ? '#28335E' : '#F6F1E6'; c.fillRect(L0, T0, bw, bh);
      c.fillStyle = night ? '#1C254A' : col;
      c.fillRect(L0, T0, bw * 0.16, bh); c.fillRect(L0 + bw * 0.84, T0, bw * 0.16, bh);
      c.fillRect(L0 - 3 * k, T0 - 10 * k, bw + 6 * k, 12 * k);
      if (bw > 26) {
        const rows = Math.min(12, Math.floor(bh / (22 * k))), cols = 4;
        const cw = bw * 0.68 / cols;
        for (let q = 0; q < rows; q++) {
          for (let p = 0; p < cols; p++) {
            const lit = ((seed >>> ((q * cols + p) % 24)) & 1) === 1;
            c.fillStyle = night ? (lit ? '#FFD76E' : '#3A4675') : (p % 2 ? '#9CC7E6' : '#B7D8EE');
            c.fillRect(L0 + bw * 0.16 + p * cw + cw * 0.18, T0 + 8 * k + q * 22 * k, cw * 0.64, 11 * k);
          }
        }
        c.fillStyle = night ? '#3A4675' : col;
        c.fillRect(L0 + bw * 0.16, T0 + 4 * k, bw * 0.68, 3 * k);
      }
      c.strokeStyle = 'rgba(29,43,83,.35)'; c.lineWidth = Math.max(1, 2 * k); c.strokeRect(L0, T0, bw, bh);
    }
    function drawLantern(c, x, y, k, t, ph, night) {
      const top = y - 150 * k;
      c.strokeStyle = '#8E2A1E'; c.lineWidth = Math.max(1, 5 * k); c.lineCap = 'round';
      c.beginPath(); c.moveTo(x, y); c.lineTo(x, top); c.moveTo(x - 34 * k, top); c.lineTo(x + 34 * k, top); c.stroke();
      for (let i = -1; i <= 1; i += 2) {
        const ax = x + i * 24 * k, sw = Math.sin(t * 2.4 + ph + i) * 0.18;
        c.save(); c.translate(ax, top); c.rotate(sw);
        c.strokeStyle = '#8E2A1E'; c.lineWidth = Math.max(0.6, 1.5 * k);
        c.beginPath(); c.moveTo(0, 0); c.lineTo(0, 10 * k); c.stroke();
        if (night) { const s = 42 * k; c.globalAlpha = 0.7; c.drawImage(glowSpr().cv, -s, 24 * k - s, s * 2, s * 2); c.globalAlpha = 1; }
        c.fillStyle = '#E8322E'; c.beginPath(); c.ellipse(0, 24 * k, 15 * k, 13 * k, 0, 0, TAU); c.fill();
        c.fillStyle = '#FFC93C'; c.fillRect(-8 * k, 9 * k, 16 * k, 4 * k); c.fillRect(-8 * k, 35 * k, 16 * k, 4 * k);
        c.strokeStyle = 'rgba(255,200,80,.7)'; c.lineWidth = Math.max(0.5, 1.2 * k);
        c.beginPath(); c.ellipse(0, 24 * k, 6 * k, 13 * k, 0, 0, TAU); c.stroke();
        c.strokeStyle = '#FFC93C'; c.beginPath(); c.moveTo(0, 39 * k); c.lineTo(0, 50 * k); c.stroke();
        c.restore();
      }
    }
    function drawSign(c, x, y, k, seed) {
      const spr = signSpr(SIGNS[(seed >>> 5) % SIGNS.length]);
      const sw = 118 * k, sh = sw * spr.h / spr.w, top = y - 150 * k;
      c.strokeStyle = '#6F7890'; c.lineWidth = Math.max(1, 5 * k);
      c.beginPath(); c.moveTo(x - sw * 0.3, y); c.lineTo(x - sw * 0.3, top + sh * 0.5); c.moveTo(x + sw * 0.3, y); c.lineTo(x + sw * 0.3, top + sh * 0.5); c.stroke();
      c.drawImage(spr.cv, x - sw / 2, top, sw, sh);
    }
    function drawBush(c, x, y, k, seed) {
      c.fillStyle = '#2E9A48';
      c.beginPath(); c.arc(x - 14 * k, y - 10 * k, 15 * k, 0, TAU); c.arc(x + 12 * k, y - 11 * k, 16 * k, 0, TAU); c.arc(x, y - 20 * k, 17 * k, 0, TAU); c.fill();
      c.fillStyle = '#44B45C';
      c.beginPath(); c.arc(x - 4 * k, y - 25 * k, 9 * k, 0, TAU); c.fill();
      c.fillStyle = ['#FF6B8B', '#FFD23F', '#FFFFFF'][seed % 3];
      c.beginPath(); c.arc(x - 12 * k, y - 18 * k, 3.2 * k, 0, TAU); c.arc(x + 10 * k, y - 22 * k, 3.2 * k, 0, TAU); c.arc(x + 2 * k, y - 10 * k, 3.2 * k, 0, TAU); c.fill();
    }
    function drawCone(c, x, y, h) {
      const w = h * 0.62;
      c.fillStyle = 'rgba(0,0,0,.25)'; c.beginPath(); c.ellipse(x, y, w * 0.7, w * 0.16, 0, 0, TAU); c.fill();
      c.fillStyle = '#2A2F3F'; rr(c, x - w * 0.62, y - h * 0.1, w * 1.24, h * 0.12, h * 0.04); c.fill();
      c.fillStyle = '#FF7A1C';
      c.beginPath(); c.moveTo(x - w * 0.46, y - h * 0.08); c.lineTo(x - w * 0.1, y - h); c.lineTo(x + w * 0.1, y - h); c.lineTo(x + w * 0.46, y - h * 0.08); c.closePath(); c.fill();
      c.fillStyle = '#FFFFFF';
      c.beginPath(); c.moveTo(x - w * 0.33, y - h * 0.38); c.lineTo(x - w * 0.23, y - h * 0.62); c.lineTo(x + w * 0.23, y - h * 0.62); c.lineTo(x + w * 0.33, y - h * 0.38); c.closePath(); c.fill();
      c.lineWidth = Math.max(1, h * 0.04); c.strokeStyle = NAVY;
      c.beginPath(); c.moveTo(x - w * 0.46, y - h * 0.08); c.lineTo(x - w * 0.1, y - h); c.lineTo(x + w * 0.1, y - h); c.lineTo(x + w * 0.46, y - h * 0.08); c.stroke();
    }
    function drawCoin(c, x, y, r, t) {
      const sx = Math.max(0.15, Math.abs(Math.cos(t)));
      c.save(); c.translate(x, y); c.scale(sx, 1);
      c.fillStyle = '#B57A12'; c.beginPath(); c.arc(0, r * 0.12, r, 0, TAU); c.fill();
      c.fillStyle = '#FFC928'; c.beginPath(); c.arc(0, 0, r, 0, TAU); c.fill();
      c.lineWidth = Math.max(1, r * 0.12); c.strokeStyle = '#9A5B0E'; c.stroke();
      c.fillStyle = '#FFE98A'; c.beginPath(); c.arc(-r * 0.3, -r * 0.3, r * 0.28, 0, TAU); c.fill();
      c.fillStyle = '#9A5B0E'; c.fillRect(-r * 0.24, -r * 0.24, r * 0.48, r * 0.48);   // 铜钱方孔
      c.restore();
    }
    /* 赛车（后视）：原点 = 车底中心 */
    function drawCar(c, x, y, W0, body, dark, o) {
      const H = W0 * 0.64, lw = Math.max(1.2, W0 * 0.035);
      c.save();
      c.translate(x, y);
      c.fillStyle = 'rgba(10,15,30,.3)';
      c.beginPath(); c.ellipse(0, -1, W0 * 0.58, W0 * 0.09, 0, 0, TAU); c.fill();
      c.translate(0, -H * 0.5 + (o.bob || 0));
      const rot = (o.tilt || 0) + (o.spin || 0);
      if (rot) c.rotate(rot);
      c.translate(0, H * 0.5);
      c.lineJoin = 'round';
      // 轮胎
      const tw = W0 * 0.21, th = H * 0.5;
      for (let s = -1; s <= 1; s += 2) {
        const tx = s > 0 ? W0 * 0.5 - tw : -W0 * 0.5;
        rr(c, tx, -th, tw, th, tw * 0.3); c.fillStyle = '#23252E'; c.fill(); c.lineWidth = lw; c.strokeStyle = NAVY; c.stroke();
        c.strokeStyle = '#4A4E5E'; c.lineWidth = Math.max(1, W0 * 0.02);
        const off = ((o.wheel || 0) % 1) * th / 3;
        c.beginPath();
        for (let i = 0; i < 3; i++) { const yy = -th + off + i * th / 3 + th * 0.08; if (yy < -th * 0.08) { c.moveTo(tx + tw * 0.2, yy); c.lineTo(tx + tw * 0.8, yy); } }
        c.stroke();
      }
      // 车身
      c.fillStyle = body;
      c.beginPath();
      c.moveTo(-W0 * 0.41, -H * 0.1); c.lineTo(-W0 * 0.36, -H * 0.64); c.quadraticCurveTo(0, -H * 0.72, W0 * 0.36, -H * 0.64); c.lineTo(W0 * 0.41, -H * 0.1); c.closePath();
      c.fill(); c.lineWidth = lw; c.strokeStyle = NAVY; c.stroke();
      c.fillStyle = 'rgba(255,255,255,.28)';
      c.beginPath(); c.moveTo(-W0 * 0.33, -H * 0.6); c.quadraticCurveTo(0, -H * 0.68, W0 * 0.33, -H * 0.6); c.lineTo(W0 * 0.34, -H * 0.5); c.quadraticCurveTo(0, -H * 0.56, -W0 * 0.34, -H * 0.5); c.closePath(); c.fill();
      c.fillStyle = '#FFFFFF'; c.fillRect(-W0 * 0.05, -H * 0.66, W0 * 0.1, H * 0.46);
      // 保险杠 + 尾灯 + 车牌
      rr(c, -W0 * 0.42, -H * 0.22, W0 * 0.84, H * 0.16, H * 0.06); c.fillStyle = dark; c.fill(); c.lineWidth = lw * 0.8; c.strokeStyle = NAVY; c.stroke();
      c.fillStyle = o.brake ? '#FF4040' : '#FFB3B3';
      rr(c, -W0 * 0.36, -H * 0.44, W0 * 0.15, H * 0.1, H * 0.04); c.fill();
      rr(c, W0 * 0.21, -H * 0.44, W0 * 0.15, H * 0.1, H * 0.04); c.fill();
      if (o.brake) { c.globalAlpha = 0.5; const s = W0 * 0.22; c.drawImage(glowSpr().cv, -W0 * 0.285 - s, -H * 0.39 - s, s * 2, s * 2); c.drawImage(glowSpr().cv, W0 * 0.285 - s, -H * 0.39 - s, s * 2, s * 2); c.globalAlpha = 1; }
      c.fillStyle = '#FFFFFF'; rr(c, -W0 * 0.11, -H * 0.36, W0 * 0.22, H * 0.11, H * 0.03); c.fill();
      // 排气管
      c.fillStyle = '#50556A';
      c.beginPath(); c.arc(-W0 * 0.13, -H * 0.13, W0 * 0.045, 0, TAU); c.arc(W0 * 0.13, -H * 0.13, W0 * 0.045, 0, TAU); c.fill();
      // 车手头盔 + 尾翼
      if (o.helmet) {
        const hr = W0 * 0.155;
        c.fillStyle = o.helmet; c.beginPath(); c.arc(0, -H * 0.84, hr, 0, TAU); c.fill(); c.lineWidth = lw; c.strokeStyle = NAVY; c.stroke();
        c.fillStyle = '#FF4D5E'; c.fillRect(-hr * 0.22, -H * 0.84 - hr, hr * 0.44, hr * 2);
        c.fillStyle = 'rgba(255,255,255,.55)'; c.beginPath(); c.ellipse(-hr * 0.4, -H * 0.84 - hr * 0.45, hr * 0.28, hr * 0.16, -0.5, 0, TAU); c.fill();
      }
      c.fillStyle = dark;
      c.fillRect(-W0 * 0.3, -H * 0.8, W0 * 0.05, H * 0.2); c.fillRect(W0 * 0.25, -H * 0.8, W0 * 0.05, H * 0.2);
      rr(c, -W0 * 0.49, -H * 0.86, W0 * 0.98, H * 0.12, H * 0.05); c.fill(); c.lineWidth = lw * 0.8; c.strokeStyle = NAVY; c.stroke();
      // 氮气火焰
      if (o.flame > 0.02) {
        for (let s = -1; s <= 1; s += 2) {
          const fl = W0 * (0.45 + 0.28 * Math.random()) * o.flame, fw = W0 * 0.085;
          const fx = s * W0 * 0.13, fy = -H * 0.13;
          c.fillStyle = 'rgba(80,170,255,.85)';
          c.beginPath(); c.moveTo(fx - fw * 1.3, fy); c.quadraticCurveTo(fx, fy + fl * 1.25, fx + fw * 1.3, fy); c.closePath(); c.fill();
          c.fillStyle = '#FF9A1C';
          c.beginPath(); c.moveTo(fx - fw, fy); c.quadraticCurveTo(fx, fy + fl, fx + fw, fy); c.closePath(); c.fill();
          c.fillStyle = '#FFF3A0';
          c.beginPath(); c.moveTo(fx - fw * 0.5, fy); c.quadraticCurveTo(fx, fy + fl * 0.55, fx + fw * 0.5, fy); c.closePath(); c.fill();
        }
      }
      c.restore();
    }
    function makeGateSprites(g) {
      const q = S.q;
      if (!q) return;
      const lw = L.hw * 2 / S.N, gw = lw * 0.86, pw = gw * 0.09;
      const bw = gw + pw * 0.6, bh = bw * 0.54, mr = bh * 0.3;
      const dpr = Math.min(3, (g.dpr || 1) * 1.35);
      q.opts.forEach((op, i) => {
        let s = gateCv[i];
        if (!s) s = gateCv[i] = { cv: document.createElement('canvas') };
        const top = mr + 2, SW = bw + 4, SH = top + bh + 2;
        s.cv.width = Math.ceil(SW * dpr); s.cv.height = Math.ceil(SH * dpr);
        const x = s.cv.getContext('2d');
        x.setTransform(dpr, 0, 0, dpr, 0, 0); x.clearRect(0, 0, SW, SH);
        const col = OPT[op.col];
        const lw2 = Math.max(2, bh * 0.08);
        rr(x, 2 + lw2 / 2, top + lw2 / 2, bw - lw2, bh - lw2, bh * 0.28); x.fillStyle = col.c; x.fill(); x.lineWidth = lw2; x.strokeStyle = NAVY; x.stroke();
        rr(x, 2 + lw2 * 1.6, top + lw2 * 1.5, bw - lw2 * 3.2, bh * 0.3, bh * 0.15); x.fillStyle = 'rgba(255,255,255,.3)'; x.fill();
        // 文字
        const txt = op.text, isPy = hasLatin(txt);
        const avail = bw - lw2 * 4 - mr * 0.6;
        let fs = bh * 0.6;
        x.font = '700 ' + fs + 'px ' + (isPy ? F.py : F.kai);
        const tw = x.measureText(txt).width;
        if (tw > avail) fs = fs * avail / tw;
        x.textAlign = 'center'; x.textBaseline = 'middle'; x.lineJoin = 'round';
        if (fs >= bh * 0.3) {
          x.font = '700 ' + fs + 'px ' + (isPy ? F.py : F.kai);
          x.lineWidth = Math.max(2, fs * 0.2); x.strokeStyle = NAVY; x.strokeText(txt, 2 + bw / 2 + mr * 0.3, top + bh * 0.54);
          x.fillStyle = '#FFFFFF'; x.fillText(txt, 2 + bw / 2 + mr * 0.3, top + bh * 0.54);
        } else {
          const big = String(op.col + 1);
          x.font = '800 ' + (bh * 0.7) + 'px ' + F.num;
          x.lineWidth = bh * 0.12; x.strokeStyle = NAVY; x.strokeText(big, 2 + bw / 2, top + bh * 0.56);
          x.fillStyle = '#FFFFFF'; x.fillText(big, 2 + bw / 2, top + bh * 0.56);
        }
        // 角上的编号章
        x.beginPath(); x.arc(2 + mr * 0.95, top + mr * 0.2, mr, 0, TAU); x.fillStyle = '#FFFFFF'; x.fill(); x.lineWidth = Math.max(1.5, lw2 * 0.8); x.strokeStyle = NAVY; x.stroke();
        x.font = '800 ' + (mr * 1.35) + 'px ' + F.num; x.fillStyle = col.d; x.fillText(String(op.col + 1), 2 + mr * 0.95, top + mr * 0.28);
        op.spr = { cv: s.cv, w: SW, h: SH, top, bw, bh };
      });
    }
    function drawGate(g, c, op, x, y, s, alpha, grow) {
      if (!op.spr) return;
      const lw = L.hw * 2 / S.N * s * grow, gw = lw * 0.86, pw = Math.max(1.5, gw * 0.09);
      const H = gw * 0.95;
      const col = OPT[op.col];
      const bob = Math.sin(S.ct * 3.2 + op.col * 1.7) * 1.5 * s;
      c.globalAlpha = alpha;
      c.lineWidth = Math.max(1, 2.4 * s * L.U); c.strokeStyle = NAVY;
      for (let side = -1; side <= 1; side += 2) {
        const px = side < 0 ? x - gw / 2 : x + gw / 2 - pw;
        rr(c, px, y - H + bob, pw, H - bob, pw * 0.5); c.fillStyle = col.c; c.fill(); c.stroke();
        c.fillStyle = 'rgba(255,255,255,.7)';
        for (let i = 1; i < 4; i++) c.fillRect(px + pw * 0.15, y - H + bob + (H - bob) * i / 4, pw * 0.7, Math.max(1, pw * 0.25));
      }
      const ratio = (gw * 1.054) / op.spr.bw;      // 门牌精灵按 s=1 预渲染，这里等比缩放
      const spW = op.spr.w * ratio, spH = op.spr.h * ratio;
      const topY = y - H + bob - (op.spr.top + op.spr.bh * 0.62) * ratio;
      c.drawImage(op.spr.cv, x - spW / 2, topY, spW, spH);
      c.globalAlpha = 1;
    }
    function drawGantry(g, c, x, y, s, kind) {
      const hw = L.hw * s;
      const post = hw * 1.18, H = hw * 1.02, bh = hw * 0.24, pw = Math.max(2, hw * 0.05);
      c.lineWidth = Math.max(1, 2.4 * s * L.U); c.strokeStyle = NAVY;
      c.fillStyle = kind === 'finish' ? '#F4F4F4' : '#D8DDE8';
      for (let side = -1; side <= 1; side += 2) { const px = x + side * post - pw / 2; rr(c, px, y - H, pw, H, pw * 0.4); c.fill(); c.stroke(); }
      const L0 = x - post - pw, bw = post * 2 + pw * 2, T0 = y - H - bh;
      if (kind === 'finish') {
        const n = 16, cw = bw / n;
        for (let r = 0; r < 2; r++) for (let q = 0; q < n; q++) { c.fillStyle = (q + r) & 1 ? '#1d2233' : '#FFFFFF'; c.fillRect(L0 + q * cw, T0 + r * bh / 2, cw + 0.5, bh / 2 + 0.5); }
        c.strokeRect(L0, T0, bw, bh);
        const spr = labelSpr('终点', 'f');
        const sw = bh * 3.1, sh = sw * spr.h / spr.w;
        c.fillStyle = '#FF5A5F'; rr(c, x - sw * 0.46, T0 - sh * 0.2, sw * 0.92, sh * 0.95, sh * 0.3); c.fill(); c.stroke();
        c.drawImage(spr.cv, x - sw / 2, T0 - sh * 0.24, sw, sh);
      } else {
        // 起点横梁上不写字：开场倒计时的说明文字正好盖在画面中间这一带（“起点”刷在路面上）
        const tb = T0 + bh * 0.35, hb = bh * 0.5;
        rr(c, L0, tb, bw, hb, hb * 0.4); c.fillStyle = '#FF5A5F'; c.fill(); c.stroke();
        c.fillStyle = 'rgba(255,255,255,.85)';
        for (let i = 1; i < 12; i += 2) c.fillRect(L0 + bw * i / 12, tb + hb * 0.3, bw / 12, hb * 0.4);
        // 起跑灯挂在两根柱子上（竖排 3 盏）：跟着 3·2·1 依次亮红灯，“开始！”时全变绿
        const it = S.introT, go = g.state !== 'intro' || it >= 1.86;
        const lw2 = bh * 1.1, lh2 = bh * 3.2;
        for (let side = -1; side <= 1; side += 2) {
          const px = x + side * post, by2 = tb + hb * 0.6;
          rr(c, px - lw2 / 2, by2, lw2, lh2, lw2 * 0.28); c.fillStyle = '#23252E'; c.fill(); c.stroke();
          for (let i = 0; i < 3; i++) {
            const ly = by2 + lh2 * (i + 0.5) / 3;
            const on = go || it >= i * 0.62;
            c.fillStyle = go ? '#3CFF6A' : on ? '#FF3B3B' : '#4A1E22';
            c.beginPath(); c.arc(px, ly, lw2 * 0.32, 0, TAU); c.fill();
            if (on) { const gs = lw2 * 1.1; c.globalAlpha = 0.55; c.drawImage(glowSpr().cv, px - gs, ly - gs, gs * 2, gs * 2); c.globalAlpha = 1; }
          }
        }
      }
    }
    function drawWorld(g, c) {
      vis.length = 0;
      const dMin = BD[0];
      for (const o of S.scen) { o.d = o.z - S.z; if (o.d > dMin * 0.92 && o.d < DFAR) vis.push(o); }
      for (const o of S.objs) { o.d = o.z - S.z; if (!o.hit && o.d > dMin * 0.92 && o.d < DFAR) vis.push(o); else if (o.hit && o.k !== 'coin' && o.d > dMin * 0.5) vis.push(o); }
      const q = S.q;
      if (q && !q.gone) {
        const dq = q.res ? D0 - q.out * (D0 - dMin) * 0.95 : q.z - S.z;
        if (dq > dMin * 0.92 && dq < DFAR + 6) for (const op of q.opts) { op.d = dq; vis.push(op); }
      }
      // 终点拱门在最后一道门后面：答对冲门后赛车还要从它下面开过去
      if (q && q.last && (!q.res || q.res.ok)) { S.finish.d = q.z + FIN - S.z; if (S.finish.d > dMin * 0.6 && S.finish.d < DFAR) vis.push(S.finish); }
      S.start.d = S.startZ - S.z + 0.3;
      if (S.start.d > dMin * 0.92 && S.start.d < DFAR) vis.push(S.start);
      CAR.d = D0; vis.push(CAR);
      vis.sort((a, b) => b.d - a.d);
      const T = S.theme, t = S.ct;
      for (let i = 0; i < vis.length; i++) {
        const o = vis[i];
        if (o === CAR) { drawMe(g, c); continue; }
        const d = o.d;
        if (d <= 0.05) continue;
        const s = D0 / d;
        const y = L.hy + (L.yCar - L.hy) * s;
        const xw = xAtD(d);
        let xo = o.x || 0;
        if (o.k === 'gate') xo = laneC(o.lx, S.N);
        const x = L.cx + (xw + xo - L.camX) * L.hw * s;
        const k = L.hw * s / 190;
        const m = 260 * k;
        if (x < -m || x > g.w + m) continue;
        const fade = clamp((DFAR - d) / 8, 0, 1);
        if (fade < 1) c.globalAlpha = fade;
        switch (o.k) {
          case 'palm': drawPalm(c, x, y, k, t, o.ph, o.side); break;
          case 'lamp': drawLamp(c, x, y, k, o.side, T.night); break;
          case 'hdb': drawHDB(c, x, y, k, o.seed, T.night); break;
          case 'lantern': drawLantern(c, x, y, k, t, o.ph, T.night); break;
          case 'sign': drawSign(c, x, y, k, o.seed); break;
          case 'bush': drawBush(c, x, y, k, o.seed); break;
          case 'coin': drawCoin(c, x, y - L.hw * s * 0.2, L.hw * s * 0.085, t * 5 + o.z); break;
          case 'cone': {
            if (o.hit) { c.save(); c.translate(x, y); c.rotate(o.ft * 5 * (o.lane % 2 ? 1 : -1)); c.translate(-x + o.ft * (o.lane % 2 ? 1 : -1) * 120, -y - o.ft * 140); c.globalAlpha = Math.max(0, 1 - o.ft); }
            drawCone(c, x, y, L.hw * s * 0.3);
            if (o.hit) c.restore();
            break;
          }
          case 'car': {
            const cw = L.hw * 2 / 4 * s * 0.62;
            drawCar(c, x, y, cw, o.col, o.dark, { bob: Math.sin(t * 20 + o.z) * 0.6 * s, wheel: o.z * 2, tilt: o.hit ? o.ft * 0.4 : 0, helmet: '#FFFFFF', brake: true });
            break;
          }
          case 'gate': {
            if (o.smashed) break;   // 已经被撞碎，由 drawDebris 画碎片
            let alpha = fade, grow = 1;
            if (q.res) {
              const isRight = o.idx === q.item.a, chosen = q.res.op === o;
              alpha = Math.max(0, 1 - q.out * (chosen ? 2.2 : 5));   // 没选的门立刻淡出，选中的门被冲开
              grow = chosen ? 1 + q.out * (isRight ? 0.9 : 0.4) : 1 - q.out * 0.5;
            }
            if (alpha > 0.01) drawGate(g, c, o, x, y, s, alpha, grow);
            break;
          }
          case 'start': drawGantry(g, c, x, y, s, 'start'); break;
          case 'finish': drawGantry(g, c, x, y, s, 'finish'); break;
          default: break;
        }
        c.globalAlpha = 1;
      }
    }
    function drawMe(g, c) {
      const idle = g.state === 'intro';
      const flame = S.boost > 0 ? 1 : (S.turbo && S.q && !S.q.res ? 0.75 : 0);
      const bob = idle ? Math.sin(S.ct * 42) * 0.9 : Math.sin(S.ct * 17) * 0.8 * Math.min(1, S.v / 8);
      const wob = S.wob > 0 ? Math.sin(S.ct * 32) * S.wob * 0.16 : 0;
      drawCar(c, L.carSX, L.yCar, L.carW, '#FF4D5E', '#C8243A', {
        tilt: S.tilt + S.lean + wob, spin: S.spin % TAU, bob, wheel: S.wheel, flame, brake: S.slow > 0 || idle, helmet: '#FFD23F'
      });
    }
    function drawPuffs(g, c) {
      for (let i = 0; i < puffs.length; i++) {
        const p = puffs[i];
        if (!p.on) continue;
        const k = p.age / p.life;
        c.globalAlpha = p.a * (1 - k);
        c.fillStyle = p.dark ? '#B9C2D6' : '#FFFFFF';
        c.beginPath(); c.arc(p.x, p.y, p.r, 0, TAU); c.fill();
      }
      c.globalAlpha = 1;
    }
    function drawSpeedLines(g, c) {
      if (S.lineA <= 0.02) return;
      c.strokeStyle = '#FFFFFF'; c.lineCap = 'round';
      const cx = L.cx, cy = L.hy;
      for (const l of slines) {
        const ca = Math.cos(l.a), sa = Math.sin(l.a);
        if (sa < -0.1) continue;
        c.globalAlpha = S.lineA * 0.55 * Math.min(1, l.r / 160);
        c.lineWidth = 2 + l.r / 260;
        c.beginPath(); c.moveTo(cx + ca * l.r, cy + sa * l.r); c.lineTo(cx + ca * (l.r + l.len), cy + sa * (l.r + l.len)); c.stroke();
      }
      c.globalAlpha = 1;
    }
    function drawCoinsFly(g, c) {
      const tx = g.w - 96 * L.U, ty = 26 * L.U;
      for (const o of S.objs) {
        if (o.k !== 'coin' || !o.hit || o.ft >= 1) continue;
        const f = o.ft;
        const x = lerp(o.fx, tx, f), y = lerp(o.fy, ty, f) - Math.sin(f * Math.PI) * 60;
        drawCoin(c, x, y, 12 * L.U * (1 - f * 0.4), S.ct * 12);
      }
    }

    /* ---------- 画：题目横幅 + 车道路牌 ---------- */
    function tileRect(lx) {
      if (L.mode === 'cols') return { x: L.bx + lx * (L.colW + L.gap), y: L.tileY, w: L.colW, h: L.tileH };
      return { x: L.bx, y: L.tileY + lx * (L.tileH + L.gap), w: L.bw, h: L.tileH };
    }
    function drawQLine(g, str, ranges, cx, y, fs, col) {
      const lines = wrapBal(g, str, L.bw - 36, fs, 'kai');
      let pos = 0;
      for (let li = 0; li < lines.length; li++) {
        const line = lines[li];
        let s0 = str.indexOf(line, pos); if (s0 < 0) s0 = pos;
        const s1 = s0 + line.length;
        pos = s1;
        const yy = y + li * L.lhQ;
        let hit = false;
        if (ranges) for (const r of ranges) if (r[0] < s1 && r[1] > s0) hit = true;
        if (!hit) { g.text(line, cx, yy, { size: fs, font: 'kai', color: NAVY }); continue; }
        let x = cx - g.measure(line, fs, 'kai') / 2, cur = s0;
        const seg = (a, b, hl) => {
          const sg = str.slice(a, b);
          if (!sg) return;
          const sw = g.measure(sg, fs, 'kai');
          if (hl) {
            g.rrect(x - 2, yy - fs * 0.66, sw + 4, fs * 1.32, fs * 0.25, col.l);
            g.rrect(x, yy + fs * 0.56, sw, Math.max(2, fs * 0.1), 2, col.c);
          }
          g.text(sg, x, yy, { size: fs, font: 'kai', color: hl ? col.d : NAVY, align: 'left' });
          x += sw;
        };
        for (const r of ranges) {
          const a = Math.max(r[0], s0), b = Math.min(r[1], s1);
          if (a >= b) continue;
          if (a > cur) seg(cur, a, false);
          seg(a, b, true);
          cur = b;
        }
        if (cur < s1) seg(cur, s1, false);
      }
    }
    function drawBoard(g, c) {
      const q = S.q;
      if (!q) return;
      const a = S.banner.a;
      const by = L.by - (1 - a) * (L.bh + L.by + 30);
      // 横幅
      g.rrect(L.bx, by + 5, L.bw, L.bh, 18, NAVY);
      g.rrect(L.bx, by, L.bw, L.bh, 18, CREAM, NAVY, 3);
      g.rrect(L.bx + 6, by + 6, L.bw - 12, L.bh - 12, 13, null, 'rgba(29,43,83,.14)', 1.5);
      const tag = String(q.item.t || '题目');
      const tfs = Math.round(clamp(13 * L.U, 13, 17));
      const tw = g.measure(tag, tfs, 'round') + 22;
      g.rrect(L.bx + 14, by - 11, tw, 22, 11, '#FF7A3D', NAVY, 2.5);
      g.text(tag, L.bx + 14 + tw / 2, by, { size: tfs, font: 'round', color: '#FFFFFF' });
      // 没撞门前：预览当前车道的选项；撞门后（不论对错）一律把正确答案填进（　）里，用绿色标出
      const cur = q.res ? (q.opts.find((o) => o.idx === q.item.a) || q.res.op) : q.opts.find((o) => o.lane === S.lane);
      const disp = qText(q, cur);
      const nl = wrapBal(g, disp, L.bw - 36, L.fsQ, 'kai').length;
      const ty = by + L.bh / 2 - (nl - 1) * L.lhQ / 2 + 1;
      drawQLine(g, disp, cur && cur.fill ? cur.fill.ranges : null, L.bx + L.bw / 2, ty, L.fsQ, q.res ? GREEN : OPT[cur ? cur.col : 0]);
      // 印章（答对）
      if (S.stamp && q.res && q.res.ok) {
        const st = S.stamp, k = st.t < 0.22 ? 2.2 - 1.2 * (st.t / 0.22) : 1;
        const sz = clamp(L.bh * 0.62, 34, 60) * k;
        const sx = L.bx + L.bw - sz * 0.75, sy = by + L.bh / 2;
        c.save(); c.translate(sx, sy); c.rotate(-0.2); c.globalAlpha = Math.min(1, st.t / 0.1);
        g.rrect(-sz / 2, -sz / 2, sz, sz, sz * 0.14, '#E0302A');
        g.rrect(-sz / 2 + sz * 0.08, -sz / 2 + sz * 0.08, sz * 0.84, sz * 0.84, sz * 0.1, null, 'rgba(255,255,255,.85)', Math.max(1.5, sz * 0.05));
        g.text(st.ch, 0, sz * 0.02, { size: Math.round(sz * 0.62), font: 'kai', color: '#FFFFFF', weight: 700 });
        c.restore();
      }
      // 车道路牌
      for (const op of q.opts) {
        const r = tileRect(op.lx);
        const p = op.pop;
        if (p <= 0.01) continue;
        const col = OPT[op.col];
        const isCur = !q.res && op.lane === S.lane;
        let fill = CREAM, alpha = 1, lift = 0;
        if (isCur) { fill = col.l; lift = 3; }
        if (q.res) {
          if (op.idx === q.item.a) fill = '#D9F7DF';
          else if (q.res.op === op) fill = '#FFD9D6';
          else alpha = 0.5;
        }
        c.save();
        c.globalAlpha = alpha;
        c.translate(r.x + r.w / 2, r.y + r.h / 2 - lift);
        c.scale(p, p);
        const x0 = -r.w / 2, y0 = -r.h / 2;
        if (isCur) { c.globalAlpha = 0.35 + 0.2 * Math.sin(S.ct * 6); g.rrect(x0 - 5, y0 - 5, r.w + 10, r.h + 10, 18, col.c); c.globalAlpha = alpha; }
        g.rrect(x0, y0 + 4 + lift, r.w, r.h, 14, NAVY);
        g.rrect(x0, y0, r.w, r.h, 14, fill, isCur ? NAVY : col.c, isCur ? 3.5 : 3);
        g.rrect(x0 + 4, y0 + 4, r.w - 8, Math.min(10, r.h * 0.2), 5, 'rgba(255,255,255,.55)');
        const f = optFont(op.text), fs = optSize(L.fsO, op.text);
        const br = clamp(L.fsO * 0.55, 10, 15);
        if (L.mode === 'cols') {
          g.rrect(x0 + r.w / 2 - br, y0 - br * 0.9, br * 2, br * 1.8, br * 0.9, col.c, NAVY, 2);
          g.text(String(op.col + 1), x0 + r.w / 2, y0 + 0.5, { size: Math.round(br * 1.25), font: 'num', color: '#FFFFFF' });
          const ls = wrapBal(g, op.text, colTextW(r.w), fs, f);
          const y1 = y0 + 6 + r.h / 2 - (ls.length - 1) * L.lhO / 2;
          for (let i = 0; i < ls.length; i++) g.text(ls[i], 0, y1 + i * L.lhO, { size: fs, font: f, color: NAVY });
        } else {
          g.rrect(x0 + 10, -br, br * 2, br * 2, br, col.c, NAVY, 2);
          g.text(String(op.col + 1), x0 + 10 + br, 0.5, { size: Math.round(br * 1.25), font: 'num', color: '#FFFFFF' });
          const ls = wrapBal(g, op.text, rowTextW(r.w), fs, f);
          const y1 = -(ls.length - 1) * L.lhO / 2 + 1;
          for (let i = 0; i < ls.length; i++) g.text(ls[i], x0 + 18 + br * 2, y1 + i * L.lhO, { size: fs, font: f, color: NAVY, align: 'left' });
        }
        if (q.res && (op.idx === q.item.a || q.res.op === op)) {
          const ok = op.idx === q.item.a;
          const mx = L.mode === 'cols' ? x0 + r.w - 12 : x0 + r.w - 24, my = L.mode === 'cols' ? y0 + 10 : 0;
          g.rrect(mx - 14, my - 14, 28, 28, 14, ok ? '#2EBD55' : '#FF5A5F', NAVY, 2);
          g.text(ok ? '✓' : '✗', mx, my + 1, { size: 18, font: 'round', color: '#FFFFFF' });
        }
        if (isCur) {
          const mw = clamp(L.fsO * 1.3, 24, 34);
          const mx = L.mode === 'cols' ? x0 + r.w - mw * 0.55 : x0 + r.w - mw * 0.75;
          const my = L.mode === 'cols' ? y0 + mw * 0.2 : mw * 0.3;
          drawCar(c, mx, my + Math.sin(S.ct * 8) * 2, mw, '#FF4D5E', '#C8243A', { helmet: '#FFD23F', wheel: S.wheel });
        }
        c.restore();
      }
      // 距离条：门还有多远
      if (!q.res && g.state === 'play') {
        const bw = Math.min(L.bw * 0.56, 320), bx = L.cx - bw / 2, yy = L.barY, bh = 8;
        g.rrect(bx, yy + 2, bw, bh, bh / 2, 'rgba(29,43,83,.55)');
        g.rrect(bx, yy, bw, bh, bh / 2, 'rgba(255,255,255,.55)', NAVY, 1.5);
        const f = q.prog;
        const warn = f > 0.8;
        if (f > 0.02) g.rrect(bx + 1.5, yy + 1.5, Math.max(bh - 3, (bw - 3) * f), bh - 3, (bh - 3) / 2, warn && Math.sin(S.ct * 16) > 0 ? '#FF5A5F' : '#FFC928');
        g.emoji('🏁', bx + bw + 12, yy + bh / 2 - 2, 20);
        drawCar(c, bx + (bw - 3) * f, yy + bh + 2, 22, '#FF4D5E', '#C8243A', { helmet: '#FFD23F' });
      }
    }
    function drawExplain(g, c) {
      const E = S.explain;
      if (!E || E.t <= 0) { L.expl = null; return; }
      const a = Math.min(1, E.t / 0.3), out = E.t > E.dur - 0.3 ? Math.max(0, (E.dur - E.t) / 0.3) : 1;
      const pw = Math.min(g.w - 28, 560);
      const fsA = Math.round(L.fsQ + 6), fsE = Math.round(clamp(L.fsQ - 1, 17, 26));
      const lines = E.e ? wrapBal(g, E.e, pw - 44, fsE, 'kai') : [];
      const hh = Math.round(34 * L.U);
      const ph = hh + 14 + fsA * 1.5 + lines.length * fsE * 1.5 + 40;
      const cy = clamp(L.hy + (L.yCar - L.hy) * 0.36, L.hy + ph / 2 + 8, g.h - ph / 2 - L.carH - 10);
      const px = (g.w - pw) / 2, py = cy - ph / 2;
      L.expl = { x: px, y: py, w: pw, h: ph };
      const k = g.ease.outBack(a);
      c.save();
      c.globalAlpha = out;
      c.translate(g.w / 2, cy); c.scale(k, k); c.translate(-g.w / 2, -cy);
      g.rrect(px, py + 6, pw, ph, 20, NAVY);
      g.rrect(px, py, pw, ph, 20, CREAM, NAVY, 3.5);
      g.rrect(px, py, pw, hh, 20, '#FF5A5F', NAVY, 3);
      g.rrect(px + 2, py + hh - 12, pw - 4, 10, 0, '#FF5A5F');
      g.text('撞错门啦！正确答案是', g.w / 2, py + hh / 2 + 1, { size: Math.round(17 * L.U), font: 'round', color: '#FFFFFF', stroke: NAVY, strokeW: 3 });
      const ay = py + hh + 10 + fsA * 0.75;
      g.text(E.ans, g.w / 2, ay, { size: fsA, font: hasLatin(E.ans) ? 'py' : 'kai', color: '#1B8C3C', maxW: pw - 40, weight: 700 });
      for (let i = 0; i < lines.length; i++) g.text(lines[i], g.w / 2, ay + fsA * 0.75 + 8 + fsE * 0.75 + i * fsE * 1.5, { size: fsE, font: 'kai', color: NAVY });
      const f = clamp(1 - E.t / E.dur, 0, 1);
      g.rrect(px + 18, py + ph - 20, (pw - 150) * f, 6, 3, 'rgba(255,90,95,.75)');
      if (E.t > 0.8) g.text('点一下继续 ▶', px + pw - 16, py + ph - 17, { size: 14, font: 'round', color: '#7A84A3', align: 'right' });
      c.restore();
    }
    function drawHint(g, c) {
      if (!S.q || S.q.res || S.moved || g.state !== 'play' || S.qn > 2) return;
      const t = S.ct, a = 0.55 + 0.45 * Math.sin(t * 6);
      const y = L.yCar - L.carH * 0.45;
      const dx = L.carW * 0.95 + Math.abs(Math.sin(t * 5)) * 8;
      g.text('◀', L.carSX - dx, y, { size: 34, color: '#FFFFFF', stroke: NAVY, strokeW: 4, alpha: a });
      g.text('▶', L.carSX + dx, y, { size: 34, color: '#FFFFFF', stroke: NAVY, strokeW: 4, alpha: a });
      const fx = L.carSX + Math.sin(t * 2.4) * L.carW * 1.1;
      g.emoji('👆', fx, L.yCar - 6, 44, { alpha: a });
      const msg = L.touch ? '左右滑动或点车道来换道' : '按 ← → 换车道';
      const fs = Math.round(16 * L.U);
      const tw = g.measure(msg, fs, 'round') + 26;
      const cy = L.yCar - L.carH - 30;
      g.rrect(L.carSX - tw / 2, cy - 16 + 3, tw, 32, 16, NAVY);
      g.rrect(L.carSX - tw / 2, cy - 16, tw, 32, 16, '#FFE45C', NAVY, 2.5);
      g.text(msg, L.carSX, cy + 1, { size: fs, font: 'round', color: NAVY });
    }
    function drawControls(g, c) {
      // 🔥 加速按钮
      const r = L.btnR, bx = L.btnX, by = L.btnY;
      const avail = !!(S.q && !S.q.res && !S.turbo && g.state === 'play');
      const hot = S.turbo || S.boost > 0;
      const k = avail ? 1 + 0.07 * Math.sin(S.ct * 7) : 1;
      c.save(); c.translate(bx, by); c.scale(k, k);
      c.fillStyle = NAVY; c.beginPath(); c.arc(0, 5, r, 0, TAU); c.fill();
      c.fillStyle = hot ? '#FF5A1C' : avail ? '#FF9F1C' : '#9AA3B8'; c.beginPath(); c.arc(0, 0, r, 0, TAU); c.fill();
      c.lineWidth = 3; c.strokeStyle = NAVY; c.stroke();
      c.fillStyle = 'rgba(255,255,255,.35)'; c.beginPath(); c.ellipse(0, -r * 0.45, r * 0.62, r * 0.3, 0, 0, TAU); c.fill();
      if (hot) { c.strokeStyle = '#FFE45C'; c.lineWidth = 3; c.beginPath(); c.arc(0, 0, r + 5, S.ct * 8, S.ct * 8 + 4); c.stroke(); }
      g.emoji('🔥', 0, -r * 0.16, r * 0.95);
      g.text('加速', 0, r * 0.56, { size: Math.round(r * 0.42), font: 'round', color: '#FFFFFF', stroke: NAVY, strokeW: 3 });
      c.restore();
      // 速度表
      const sr = r, sx = L.spX, sy = L.spY;
      c.fillStyle = NAVY; c.beginPath(); c.arc(sx, sy + 5, sr, 0, TAU); c.fill();
      c.fillStyle = 'rgba(20,30,64,.88)'; c.beginPath(); c.arc(sx, sy, sr, 0, TAU); c.fill();
      c.lineWidth = 3; c.strokeStyle = '#FFFFFF'; c.stroke();
      const a0 = Math.PI * 0.8, a1 = Math.PI * 2.2;
      c.lineWidth = 4; c.strokeStyle = 'rgba(255,255,255,.25)'; c.beginPath(); c.arc(sx, sy, sr * 0.74, a0, a1); c.stroke();
      const f = clamp(S.v / 40, 0, 1);
      c.strokeStyle = f > 0.7 ? '#FF5A5F' : f > 0.45 ? '#FFB020' : '#3CCB5A';
      c.beginPath(); c.arc(sx, sy, sr * 0.74, a0, a0 + (a1 - a0) * f); c.stroke();
      const na = a0 + (a1 - a0) * f;
      c.strokeStyle = '#FFE45C'; c.lineWidth = 2.5; c.beginPath(); c.moveTo(sx, sy); c.lineTo(sx + Math.cos(na) * sr * 0.62, sy + Math.sin(na) * sr * 0.62); c.stroke();
      g.text(String(Math.round(S.v * 9)), sx, sy + sr * 0.42, { size: Math.round(sr * 0.46), font: 'num', color: '#FFFFFF' });
    }

    /* ---------- 输入 ---------- */
    function tap(g, x, y) {
      if (S.explain) {
        const e = L.expl;
        if (S.explain.t > 0.8 && e && x >= e.x && x <= e.x + e.w && y >= e.y && y <= e.y + e.h) { closeExplain(g); return; }
      }
      if (Math.hypot(x - L.btnX, y - L.btnY) <= L.btnR * 1.2) { turbo(g); return; }
      const q = S.q;
      if (q && !q.res) {
        for (const op of q.opts) {
          const r = tileRect(op.lx);
          if (x >= r.x - 4 && x <= r.x + r.w + 4 && y >= r.y - 6 && y <= r.y + r.h + 6) { steer(g, op.lane); return; }
        }
      }
      if (y < L.by + L.bh && y > L.by - 12 && x > L.bx && x < L.bx + L.bw) return;   // 点到题目横幅：不动
      let lane;
      if (y > L.hy + 4) {
        const s = (y - L.hy) / (L.yCar - L.hy), d = D0 / Math.max(0.05, s);
        const xw = (x - L.cx) / (L.hw * s) + L.camX - xAtD(d);
        lane = Math.floor((xw + 1) / 2 * S.N);
      } else {
        let bd = 1e9; lane = S.lane;
        for (let i = 0; i < S.N; i++) { const dd = Math.abs(x - laneSX(i)); if (dd < bd) { bd = dd; lane = i; } }
      }
      steer(g, clamp(lane, 0, S.N - 1));
    }

    /* ================= spec ================= */
    const spec = {
      maxLevel: 10, lives: 3, rounds: 10, music: 'bright', sky: null,
      intro: '开车穿过写着正确答案的门！',
      controls: '点车道 / 左右滑动 / ← → 换道 · ↑ 加速',
      init(g) {
        const C = cfgFor(g.level);
        let list = (g.items('quiz', g.rounds + g.maxLives + 3) || []).filter(validItem);
        if (!list.length) list = ((g.G && g.G.quiz) || []).filter(validItem).slice(0, 12);
        g.rounds = Math.max(1, Math.min(g.rounds, list.length || 1));
        S = {
          C, theme: THEMES[C.theme], cruise: C.v, z: 0, v: 0, carX: 0, lane: 1, N: 4, Nold: 4, nMix: 1,
          tilt: 0, lean: 0, spin: 0, wob: 0, wheel: 0, boost: 0, slow: 0, turbo: false, turboUsed: false,
          track: [], trackEnd: 0, scen: [], scenEnd: 0, objs: [], rnd: rng((Math.random() * 1e9) | 0),
          queue: list.slice(), qi: 0, q: null, pre: null, qn: 0, explain: null, stamp: null, banner: { a: 0 },
          moved: false, introT: 0, ct: 0, bgX: 0, puffT: 0, lineA: 0, ptr: null,
          startZ: D0 + 0.55, start: { k: 'start', d: 0 }, finish: { k: 'finish', d: 0 }
        };
        if (list.length) {
          S.pre = prepQuestion(g);
          S.N = S.Nold = clamp(S.pre.opts.length, 2, 4);
          S.lane = Math.floor((S.N - 1) / 2);
        }
        S.carX = laneC(S.lane, S.N);
        genTrack(DFAR + 120);
        S.scenEnd = 1.5;
        genScenery(DFAR + 4);
        for (const p of puffs) p.on = false;
        debris.length = 0;
        layout(g, true);
        lastDraw = 0;
        try { W.__hwRacer = { g, get S() { return S; }, get L() { return L; }, steer: (i) => steer(g, i), turbo: () => turbo(g), tap: (x, y) => tap(g, x, y) }; } catch (e) { /* ignore */ }
      },
      play(g) {
        if (!S) return;
        g.sfx('whoosh');
        for (let i = 0; i < 12; i++) puff(L.carSX + g.rand(-L.carW * 0.55, L.carW * 0.55), L.yCar - g.rand(0, 8), g.rand(-120, 120), g.rand(-30, 40), g.rand(8, 14) * L.U, 0.8, 0.45, true);
        if (!S.queue.length) { g.win(); return; }
        g.after(0.55, () => nextQuestion(g));
      },
      update(g, dt) {
        if (!S) return;
        let vt = S.cruise;
        if (S.boost > 0) { S.boost -= dt; vt = S.cruise * 1.85; }
        else if (S.turbo && S.q && !S.q.res) vt = S.cruise * 2.1;
        if (S.slow > 0) { S.slow -= dt; vt = S.cruise * 0.28; }
        if (S.halt) vt = 0;   // 最后一颗心撞错：停车看讲解
        S.v += (vt - S.v) * Math.min(1, dt * (vt > S.v ? 2.2 : 3.5));
        advance(g, dt);
        updateObjs(g, dt);
        const q = S.q;
        if (q && !q.res) {
          q.t += dt;
          const left = q.z - (S.z + D0);
          q.prog = clamp(1 - left / q.dist, 0, 1);
          if (q.swapAt && !q.swapped && q.prog >= q.swapAt) doSwap(g);
          if (!q.tick && left < S.v * 1.2) { q.tick = true; g.sfx('tick'); }
          if (left <= 0) resolve(g);
        }
        if (S.explain) { S.explain.t += dt; if (S.explain.t >= S.explain.dur) closeExplain(g); }
      },
      draw(g, c) {
        if (!S) return;
        const t = nowMs();
        const rdt = lastDraw ? clamp((t - lastDraw) / 1000, 0, 0.05) : 0;
        lastDraw = t;
        S.ct += rdt;
        if (g.state === 'intro') { S.introT += rdt; S.v = 0; advance(g, rdt); }
        else if (g.state === 'over') {
          const won = g.lives > 0 && g.done >= g.rounds;
          S.v += ((won ? S.cruise * 1.2 : 0) - S.v) * Math.min(1, rdt * (won ? 2 : 1.5));
          if (S.boost > 0) S.boost -= rdt;
          if (S.slow > 0) S.slow -= rdt;
          advance(g, rdt);
        }
        updDebris(rdt);
        computeRoad(g);
        drawSky(g, c);
        drawRoad(g, c);
        drawWorld(g, c);
        drawDebris(g, c);
        drawPuffs(g, c);
        drawSpeedLines(g, c);
        drawHint(g, c);
        drawBoard(g, c);
        drawCoinsFly(g, c);
        drawExplain(g, c);
        drawControls(g, c);
      },
      down(g, p) { if (S) S.ptr = { x: p.x, y: p.y }; },
      up(g, p) {
        if (!S) return;
        const st = S.ptr; S.ptr = null;
        if (!st) return;
        const dx = p.x - st.x, dy = p.y - st.y, ax = Math.abs(dx), ay = Math.abs(dy);
        if (ax > 30 && ax > ay * 1.1) { steer(g, S.lane + (dx > 0 ? 1 : -1)); return; }
        if (ay > 40 && ay > ax) { if (dy < 0) turbo(g); else turbo(g, false); return; }
        tap(g, st.x, st.y);
      },
      key(g, k) {
        if (!S) return;
        if (k === 'left' || k === 'a' || k === 'A') steer(g, S.lane - 1);
        else if (k === 'right' || k === 'd' || k === 'D') steer(g, S.lane + 1);
        else if (k === 'up' || k === 'w' || k === 'W') turbo(g);
        else if (k === 'down' || k === 's' || k === 'S') turbo(g, false);
        else if (k === 'space' || k === 'enter') { if (S.explain && S.explain.t > 0.6) closeExplain(g); else if (k === 'space') turbo(g); }
        else if (/^[1-4]$/.test(k) && S.q && !S.q.res) { const op = S.q.opts.find((o) => o.col === +k - 1); if (op) steer(g, op.lane); }
      },
      resize(g) { if (!S) return; layout(g, true); makeGateSprites(g); },
      end() { try { if (W.__hwRacer) delete W.__hwRacer; } catch (e) { /* ignore */ } S = null; }
    };
    return spec;
  }

  HW.register({
    id: 'racer', skill: 'read', kind: 'arcade', name: '华文赛车', icon: '🏎️',
    blurb: '开车穿过写着正确答案的门', cols: ['quiz'],
    start(ctx) { return HW.arcade.run(ctx, makeSpec()); }
  });
})();
