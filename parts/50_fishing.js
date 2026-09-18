/* =====================================================================
 * 华文小岛 2.0 · 街机游戏 10：🎣 偏旁钓鱼（id: fishing · skill: write · 题库栏目: build）
 * 规格：SPEC_ARCADE.md §4 第 10 条。引擎：parts/15_arcade.js（HW.arcade.run）。
 *
 * 玩法：
 *   海面上一条小船，船上的小猫举着木牌，牌上是 base 字，旁边一个“＋？”空格；
 *   天上的想法泡泡里是 hint 词语，缺的那个字挖成空格、上面标着拼音（ans 的 py）。
 *   海里的鱼（不同颜色、大小，摆尾游动、吐泡泡）身上的白圆牌写着偏旁（题库 opts）。
 *   点鱼 → 小船滑过去、鱼钩带着钓线沉下去钩住：
 *     正确（鱼身上的偏旁 === build.rad）→ 收线拉上来 → 鱼跃出水面，偏旁飞进“？”格 →
 *       和 base 合体（按字的结构挤在一起）→ 变成 ans（放大发光），泡泡里的空格填上 ans，朗读 hint；
 *     错误 → 鱼拼命挣扎、挣脱溅水逃走（扣心；错题本记正确组合与孩子钓的偏旁）；
 *     钓到旧靴子 👢 → g.miss（只断连击）；鱼钩碰到水母 → 被电一下、收回（只断连击）。
 *   关卡越高：鱼游得越快、干扰鱼越多（重复的错偏旁 + 题库里别的偏旁）、靴子/水母越多、
 *   第 7 关起鱼群会突然掉头；场景 白天(1–4) → 黄昏(5–7) → 夜晚(8–10)。每关 8 题。
 * 操作：点/触鱼；键盘 ←→ 移动小船，空格/↓/回车 垂直下钩（钩子碰到哪条鱼就钓哪条），↑ 收钩。
 *   点泡泡可以再听一次词语（有中文朗读时）。
 * 正确答案只取题库字段：rad（判定）、base/ans/py/hint（显示），opts 为本题选项。
 * 调试：window.__fish = 当前 g（g.F 为本关状态），供 tools/shot.js / play.js 读取。
 * ===================================================================== */
(function () {
  'use strict';
  const W = window;
  const HW = W.HW;
  if (!HW || typeof HW.register !== 'function') return;

  const TAU = Math.PI * 2;
  const NAVY = '#1d2b53';
  const str = (v) => (v == null ? '' : String(v));
  const chars = (s) => Array.from(str(s));
  const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
  const lerp = (a, b, t) => a + (b - a) * t;
  const rnd = (a, b) => a + Math.random() * (b - a);
  const sgn = (v) => (v < 0 ? -1 : 1);
  const nowS = () => ((W.performance && performance.now) ? performance.now() : Date.now()) / 1000;
  const oCubic = (t) => { const u = 1 - t; return 1 - u * u * u; };
  const oBack = (t) => { const s = 1.9, u = t - 1; return u * u * ((s + 1) * u + s) + 1; };
  const oElastic = (t) => (t <= 0 ? 0 : t >= 1 ? 1 : Math.pow(2, -10 * t) * Math.sin((t * 10 - 0.75) * (TAU / 3)) + 1);
  function shuffle(a) { a = a.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); const t = a[i]; a[i] = a[j]; a[j] = t; } return a; }

  /* ---------- 关卡参数（下标 = 关卡 - 1） ---------- */
  const LV = {
    cross: [10.5, 9.6, 8.8, 8.0, 7.2, 6.5, 5.9, 5.3, 4.8, 4.3],   // 鱼横穿屏幕要几秒（越小越快）
    decoy: [0, 0, 1, 1, 1, 2, 2, 2, 2, 3],   // 题库里别的偏旁做的干扰鱼
    dupW:  [0, 0, 0, 0, 1, 1, 1, 2, 2, 2],   // 重复出现的错选项鱼
    boots: [0, 1, 1, 1, 1, 1, 2, 2, 2, 2],   // 旧靴子
    jelly: [0, 0, 0, 1, 1, 1, 2, 2, 2, 3],   // 水母（碰到鱼钩会电人）
    bob:   [0.07, 0.08, 0.09, 0.1, 0.11, 0.12, 0.13, 0.14, 0.15, 0.16],   // 上下游动幅度（× 泳道高）
    turn:  [0, 0, 0, 0, 0, 0, 7.5, 6.5, 5.5, 4.8]   // 鱼群突然掉头的周期（秒；0 = 不掉头）
  };
  const lvv = (arr, lv) => arr[clamp(lv, 1, arr.length) - 1];

  /* ---------- 场景配色：白天 / 黄昏 / 夜晚 ---------- */
  const PAL = {
    day: { id: 'day', sky: [0, '#35AEF6', 0.62, '#8ED8FF', 1, '#DDF5FF'], far: 'rgba(96,140,196,.5)', win: null, isle: '#5DB870', isle2: '#47A35C',
      w: [0, '#74E2EC', 0.16, '#2BB3D8', 0.55, '#1375B1', 1, '#0A4380'], ray: 0.16, sand: '#EFD08A', sand2: '#D8B268', cloud: 0.95, orb: 'sun', gull: true, glow: false },
    dusk: { id: 'dusk', sky: [0, '#4F5CC0', 0.5, '#FF8E74', 1, '#FFD69C'], far: 'rgba(118,66,112,.58)', win: 'rgba(255,224,150,.85)', isle: '#6E8B55', isle2: '#597246',
      w: [0, '#F4B690', 0.12, '#58A2BF', 0.55, '#1E5B8C', 1, '#0C2F5C'], ray: 0.11, sand: '#E4C185', sand2: '#C49A5A', cloud: 0.85, orb: 'set', gull: true, glow: false },
    night: { id: 'night', sky: [0, '#060C2C', 0.6, '#17226A', 1, '#35437F'], far: 'rgba(14,20,56,.96)', win: 'rgba(255,214,120,.95)', isle: '#16312F', isle2: '#10262A',
      w: [0, '#2F5F9C', 0.14, '#1A417A', 0.55, '#0C2556', 1, '#040E2C'], ray: 0.05, sand: '#8C7A5A', sand2: '#6B5C44', cloud: 0.28, orb: 'moon', gull: false, glow: true }
  };
  const palOf = (lv) => (lv <= 4 ? 'day' : lv <= 7 ? 'dusk' : 'night');

  /* ---------- 鱼的配色 ---------- */
  const FISHPAL = [
    { top: '#FFB45E', body: '#FF8A2B', belly: '#FFE2BC', fin: '#F0661A', stripe: true },
    { top: '#6AA6FF', body: '#2F7DF6', belly: '#B3D2FF', fin: '#FFD23F' },
    { top: '#FFE775', body: '#FFC928', belly: '#FFF7CF', fin: '#FF9A1C' },
    { top: '#FFA2C8', body: '#FF6FA8', belly: '#FFDCEA', fin: '#E24A86' },
    { top: '#79E6A8', body: '#2FBF6E', belly: '#CCF8DF', fin: '#1C9A57' },
    { top: '#C4A8FF', body: '#9B6BFF', belly: '#E7DCFF', fin: '#7646DE' },
    { top: '#FF9396', body: '#FF5A5F', belly: '#FFD3D4', fin: '#D6383F' }
  ];

  /* ---------- 合体时偏旁放在哪儿（只影响 0.3 秒的合体过场；最终显示的是真正的 ans 字） ---------- */
  const POS_BY_ANS = {
    '星': 'T', '爸': 'T', '菜': 'T', '房': 'T', '放': 'R', '期': 'R', '彩': 'R', '静': 'R', '顿': 'R', '飘': 'R',
    '问': 'I', '围': 'O', '返': 'W', '避': 'W', '违': 'W', '爬': 'W', '壁': 'B', '烈': 'B', '裂': 'B'
  };
  const POS_BY_RAD = { '辶': 'W', '廴': 'W', '艹': 'T', '宀': 'T', '雨': 'T', '竹': 'T', '灬': 'B', '攵': 'R', '页': 'R', '刂': 'R', '彡': 'R', '欠': 'R', '囗': 'O' };
  const posOf = (it) => POS_BY_ANS[str(it.ans)] || POS_BY_RAD[str(it.rad)] || 'L';
  /* 同一部首的不同写法：干扰鱼不能是正确偏旁的变体（衣/衤、火/灬……），免得“也算对” */
  const VAR = [['衣', '衤'], ['心', '忄'], ['水', '氵'], ['手', '扌'], ['人', '亻'], ['火', '灬'], ['刀', '刂'], ['犬', '犭'], ['言', '讠'],
    ['食', '饣'], ['金', '钅'], ['糸', '纟'], ['足', '⻊'], ['示', '礻'], ['玉', '王'], ['竹', '⺮'], ['艸', '艹'], ['肉', '月'], ['辵', '辶'],
    ['攴', '攵'], ['网', '罒'], ['冰', '冫'], ['邑', '阝'], ['阜', '阝']];
  const sameRad = (a, b) => a === b || VAR.some((p) => p.indexOf(a) >= 0 && p.indexOf(b) >= 0);
  const FALLBACK = ['口', '木', '氵', '扌', '亻', '女', '土', '日', '月', '火', '目', '米', '纟', '讠', '艹', '宀', '辶', '足', '钅', '饣', '忄', '石', '虫', '禾', '王'];

  /* ---------- 小船本地坐标（× k；原点 = 船在水线处的中心，y 向下） ---------- */
  const CAT_X = -6, DECK = -12, SIGN_Y = -118, SIGN = 58, PLUS_X = 36, BOX_X = 71, BOX = 44;
  const ROD_BASE_X = -44, ROD_BASE_Y = -14, ROD_TIP_X = -92, ROD_TIP_Y = -84;

  function makeSpec(ctx) {
    const L = { k: 1 };
    let F = null;
    let GC = Object.create(null);
    const M = { x: 0, y: 0 }, Q1 = { x: 0, y: 0 }, Q2 = { x: 0, y: 0 }, Q3 = { x: 0, y: 0 };
    const ttsOK = () => { try { return !!(ctx.tts && ctx.tts.ok); } catch (e) { return false; } };

    function lgrad(c, key, x0, y0, x1, y1, stops) {
      let gr = GC[key];
      if (!gr) { gr = c.createLinearGradient(x0, y0, x1, y1); for (let i = 0; i < stops.length; i += 2) gr.addColorStop(stops[i], stops[i + 1]); GC[key] = gr; }
      return gr;
    }
    function rgrad(c, key, r, stops) {
      let gr = GC[key];
      if (!gr) { gr = c.createRadialGradient(0, 0, 0, 0, 0, r); for (let i = 0; i < stops.length; i += 2) gr.addColorStop(stops[i], stops[i + 1]); GC[key] = gr; }
      return gr;
    }
    function rrPath(c, x, y, w, h, r) {
      r = Math.max(0, Math.min(r, w / 2, h / 2));
      c.moveTo(x + r, y);
      c.arcTo(x + w, y, x + w, y + h, r); c.arcTo(x + w, y + h, x, y + h, r);
      c.arcTo(x, y + h, x, y, r); c.arcTo(x, y, x + w, y, r);
      c.closePath();
    }

    /* ================= 布局 ================= */
    function layout(g) {
      const w = g.w, h = g.h;
      const k = clamp(Math.min(w / 390, h / 760), 0.7, 1.3);
      L.k = k;
      L.bubH = Math.round(80 * k);
      L.bubY = Math.round(g.hudTop + 4 * k);
      L.sy = Math.round(L.bubY + L.bubH + 158 * k);
      L.floor = Math.round(h - 34 * k);
      L.fTop = L.sy + 48 * k;
      L.fBot = L.floor - 26 * k;
      const avail = L.fBot - L.fTop;
      L.nl = clamp(Math.floor(avail / (80 * k)), 3, 7);
      L.lh = avail / L.nl;
      L.m = 84 * k;
      L.span = w + 2 * L.m;
      L.bMin = 100 * k; L.bMax = Math.max(L.bMin + 1, w - 96 * k);
      L.hookV = 1150 * k; L.reelV = 620 * k; L.grav = 1500 * k;
      GC = Object.create(null);
      if (F) {
        F.fish.forEach((f) => { f.grad = null; });
        makeCity(g);
      }
    }
    function makeLanes(g) {
      const n = L.nl, base = L.span / lvv(LV.cross, g.level);
      const d0 = Math.random() < 0.5 ? 1 : -1;
      const lanes = [];
      for (let i = 0; i < n; i++) lanes.push({ i, y: L.fTop + L.lh * (i + 0.5), dir: i % 2 ? -d0 : d0, jit: rnd(0.86, 1.14), v: 0 });
      lanes.forEach((ln) => { ln.v = base * ln.jit; });
      return lanes;
    }
    function relane(g) {
      if (!F) return;
      if (F.lanes.length !== L.nl) {
        const old = F.lanes;
        F.lanes = makeLanes(g);
        F.lanes.forEach((ln, i) => { if (old[i]) { ln.dir = old[i].dir; ln.jit = old[i].jit; } });
        F.fish.forEach((f) => { f.lane = f.lane % L.nl; });
      }
      const base = L.span / lvv(LV.cross, g.level);
      F.lanes.forEach((ln, i) => { ln.y = L.fTop + L.lh * (i + 0.5); ln.v = base * ln.jit; });
      F.boots.forEach((b) => { b.baseY = clamp(b.baseY, L.fTop, L.fBot); });
      F.jellies.forEach((j) => { j.cy = (L.fTop + L.fBot) / 2; j.amp = Math.max(0, (L.fBot - L.fTop) / 2 - j.r); j.r = 24 * L.k; });
      F.boat.x = clamp(F.boat.x, L.bMin, L.bMax);
    }
    function makeCity(g) {
      const w = g.w, k = L.k, city = [];
      let x = w * 0.42;
      while (x < w + 20) {
        const bw = rnd(18, 34) * k, bh = rnd(22, 70) * k;
        const b = { x, w: bw, h: bh, win: [] };
        const cols = Math.max(1, Math.floor(bw / (7 * k))), rows = Math.max(1, Math.floor(bh / (9 * k)));
        for (let r = 0; r < rows; r++) for (let q = 0; q < cols; q++) if (Math.random() < 0.5) b.win.push(3 * k + q * 7 * k, 5 * k + r * 9 * k);
        city.push(b);
        x += bw + rnd(3, 12) * k;
      }
      F.city = city;
    }

    /* ================= 水面 / 船 ================= */
    function waveY(x) {
      const k = L.k, t = F ? F.t : 0;
      return L.sy + Math.sin(x * 0.021 / k + t * 1.7) * 4 * k + Math.sin(x * 0.053 / k - t * 2.3) * 2.2 * k;
    }
    function pose() {
      const B = F.boat, k = L.k;
      B.by = waveY(B.x);
      const sl = (waveY(B.x + 30 * k) - waveY(B.x - 30 * k)) / (60 * k);
      B.ang = Math.atan(sl) * 0.8 + B.rock - clamp(B.vx / k * 0.0005, -0.1, 0.1);
      B.cs = Math.cos(B.ang); B.sn = Math.sin(B.ang);
    }
    function toW(lx, ly, o) { const B = F.boat; o.x = B.x + lx * B.cs - ly * B.sn; o.y = B.by + lx * B.sn + ly * B.cs; return o; }
    function toL(wx, wy, o) { const B = F.boat, dx = wx - B.x, dy = wy - B.by; o.x = dx * B.cs + dy * B.sn; o.y = -dx * B.sn + dy * B.cs; return o; }
    const signW = (o) => toW(CAT_X * L.k, SIGN_Y * L.k - F.cat.jump, o);
    const boxW = (o) => toW(BOX_X * L.k, SIGN_Y * L.k - F.cat.jump, o);

    /* ================= 鱼 ================= */
    const fishLen = (f) => 108 * L.k * f.s;
    const fishHt = (f) => 60 * L.k * f.s;
    function mouthOf(f, o) {
      const len = fishLen(f);
      o.x = f.x + f.face * len * 0.47; o.y = f.y + fishHt(f) * 0.06;
      return o;
    }
    function badgeOf(f, o) {
      const len = fishLen(f), lx = -len * 0.07 * f.face, ly = 1 * L.k;
      const cs = Math.cos(f.rot), sn = Math.sin(f.rot);
      o.x = f.x + lx * cs - ly * sn; o.y = f.y + lx * sn + ly * cs;
      return o;
    }
    function onScreen(f, g) { const hl = fishLen(f) * 0.3; return f.x > -hl && f.x < g.w + hl; }
    function catchable(f) { return f.st === 'swim' || f.st === 'enter'; }
    /* 点击 / 鱼钩碰到的鱼：椭圆内（pad 放宽），取归一化距离最小的那条 */
    function fishAt(g, x, y, pad) {
      let best = null, bd = 1e9;
      for (const f of F.fish) {
        if (!catchable(f) || !onScreen(f, g)) continue;
        const rx = fishLen(f) * 0.5 + pad, ry = fishHt(f) * 0.5 + pad;
        const d = ((x - f.x) / rx) * ((x - f.x) / rx) + ((y - f.y) / ry) * ((y - f.y) / ry);
        if (d <= 1 && d < bd) { bd = d; best = f; }
      }
      return best;
    }
    function bootAt(g, x, y, pad) {
      for (const b of F.boots) if (b.st === 'swim' && Math.hypot(x - b.x, y - b.y) < 26 * L.k + pad) return b;
      return null;
    }
    function jellyAt(x, y, pad) {
      for (const j of F.jellies) if (Math.hypot(x - j.x, y - j.y) < j.r + pad) return j;
      return null;
    }
    function newFish(lab, lane, pi) {
      return { lab, lane, pi, s: rnd(0.93, 1.07), bx: 0, off: 0, off0: 0, et: 0, ed: 1, st: 'enter', dir: 1, face: 1, x: -999, y: 0,
        rot: 0, vx: 0, vy: 0, spin: 0, ph: rnd(0, TAU), bobPh: rnd(0, TAU), bobF: rnd(1.3, 2.1), agit: 0, grad: null,
        bubT: rnd(0.5, 2.5), labGone: false, fv: 0, escT: 0, decoy: false };
    }
    function pickDecoys(g, opts, rad, base, n) {
      if (n <= 0) return [];
      const pool = new Set();
      const B = g.G && Array.isArray(g.G.build) ? g.G.build : [];
      B.forEach((b) => { if (b && Array.isArray(b.opts)) b.opts.forEach((o) => pool.add(str(o))); });
      FALLBACK.forEach((o) => pool.add(o));
      const cands = Array.from(pool).filter((o) => o && chars(o).length === 1 && opts.indexOf(o) < 0 && o !== base && !sameRad(o, rad));
      return shuffle(cands).slice(0, n);
    }
    function spawnSchool(g) {
      const it = F.item, opts = it.opts.map(str);
      const wrong = opts.filter((o) => o !== F.rad);
      const labs = opts.map((o) => ({ lab: o, decoy: false }));
      const nd = lvv(LV.dupW, g.level);
      const wr = shuffle(wrong);
      for (let j = 0; j < nd && wr.length; j++) labs.push({ lab: wr[j % wr.length], decoy: false });
      pickDecoys(g, opts, F.rad, F.base, lvv(LV.decoy, g.level)).forEach((d) => labs.push({ lab: d, decoy: true }));
      const list = shuffle(labs);
      const n = F.lanes.length;
      const order = shuffle(F.lanes.map((ln, i) => i));
      const per = F.lanes.map(() => []);
      list.forEach((o, j) => per[order[j % n]].push(o));
      const pals = shuffle(FISHPAL.map((p, i) => i));
      let pk = 0;
      per.forEach((arr, li) => {
        const ln = F.lanes[li], m = arr.length;
        const ph = rnd(-0.15, 0.15);
        arr.forEach((o, j) => {
          const f = newFish(o.lab, li, pals[pk++ % pals.length]);
          f.decoy = o.decoy;
          f.bx = clamp(((j + 0.5 + ph) / m), 0.08, 0.92) * g.w;
          const startX = ln.dir > 0 ? -L.m - j * 50 * L.k : g.w + L.m + j * 50 * L.k;
          f.off0 = f.off = startX - f.bx; f.et = 0; f.ed = 1.0 + j * 0.14 + rnd(0, 0.25);
          f.dir = ln.dir; f.face = ln.dir; f.x = startX; f.y = ln.y;
          F.fish.push(f);
        });
      });
    }
    function flee(g, f) {
      f.st = 'flee';
      f.dir = f.x < g.w / 2 ? -1 : 1;
      f.fv = Math.max(420 * L.k, L.span / 1.4);
      f.agit = 1;
    }

    /* ================= 题目流程 ================= */
    function startQuestion(g, i) {
      const it = F.list[i];
      F.qi = i; F.item = it;
      F.base = str(it.base); F.rad = str(it.rad); F.ans = str(it.ans); F.py = str(it.py);
      F.hint = str(it.hint) || F.ans;
      F.hintCh = chars(F.hint);
      if (F.hintCh.indexOf(F.ans) < 0) F.hintCh = [F.ans];   // 数据兜底：hint 里没有 ans → 只显示拼音 + 空格
      F.pos = posOf(it);
      F.qT = 0; F.idleT = 0; F.tapped = false; F.solved = false; F.reveal = 0; F.bubPop = 0;
      const S = F.sign;
      S.mode = 'q'; S.slot = ''; S.slotPop = 1; S.mt = 0; S.pop = 1; S.shake = 0;
      spawnSchool(g);
    }
    function nextQuestion(g) {
      if (!F || g.state !== 'play') return;
      const ni = F.qi + 1;
      if (ni >= F.list.length) return;
      for (const f of F.fish) if (catchable(f)) flee(g, f);
      const S = F.sign;
      S.fold = 1; S.foldV = -1;   // 木牌翻面：先收窄 → 换题 → 再弹开
      g.sfx('flip');
      addT(0.16, () => { startQuestion(g, ni); S.foldV = 1; });
    }

    /* ================= 鱼钩 ================= */
    function setH(st) { F.hook.st = st; F.hook.t = 0; }
    function cast(g, fish, boot, px, py) {
      const H = F.hook, k = L.k;
      H.fish = fish || null; H.boot = boot || null; H.tx = px; H.ty = py; H.said = false;
      setH('cast');
      const tx = fish ? fish.x + fish.face * fishLen(fish) * 0.3 : boot ? boot.x : px;
      F.boat.tx = clamp(tx - ROD_TIP_X * k, L.bMin, L.bMax);
      F.tapped = true;
      F.cat.mood = 'focus'; F.cat.moodT = 9;
      g.sfx('swing');
    }
    function bite(g, f) {
      const H = F.hook, k = L.k;
      H.fish = null; H.carry = f;
      f.st = 'hooked'; f.agit = 1; f.hk = 0;
      g.sfx('chomp'); g.shake(3);
      puffs(H.x, H.y, 6);
      const ok = !F.solved && !f.decoy && f.lab === F.rad;
      if (ok) {
        F.solved = true;
        setH('reel');
        F.cat.mood = 'focus'; F.cat.moodT = 3;
      } else {
        setH('fight');
        F.cat.mood = 'worry'; F.cat.moodT = 3;
      }
      F.bendKick = 1;
      F.boat.rockV += 0.9 * sgn(H.x - F.boat.x);
      void k;
    }
    function hang(f, H, dt) {
      f.hk = Math.min(1, (f.hk || 0) + dt * 6);
      const len = fishLen(f);
      f.x = H.x; f.y = H.y + len * 0.47 * f.hk + (1 - f.hk) * 0;
      f.rot = -f.dir * Math.PI / 2 * f.hk + Math.sin(F.t * 26) * 0.18 * f.agit;
      f.face = f.dir;
    }
    function leap(g) {
      const H = F.hook, f = H.carry, k = L.k;
      H.carry = null; setH('return');
      if (!f) return;
      const sy = waveY(f.x);
      f.st = 'leap';
      boxW(Q3);
      f.vy = -Math.sqrt(2 * L.grav * Math.max(70 * k, sy - (Q3.y + 34 * k)));
      f.vx = clamp((Q3.x - f.x) * 0.55, -260 * k, 260 * k);
      f.spin = (Math.random() < 0.5 ? -1 : 1) * rnd(4, 6);
      g.burst(f.x, sy, { kind: 'water', n: 24 });
      g.ring(f.x, sy, '#FFFFFF', 60 * k);
      g.sfx('splash');
      puffs(f.x, sy + 12 * k, 8);
      F.boat.rockV -= 0.6 * sgn(f.x - F.boat.x);
    }
    function detachLabel(g, f) {
      f.labGone = true;
      badgeOf(f, Q1);
      F.fly = { ch: f.lab, x0: Q1.x, y0: Q1.y, x: Q1.x, y: Q1.y, t: 0, d: 0.42, s: f.s, sp: 0 };
      g.sfx('whoosh');
    }
    function landLabel(g) {
      const fl = F.fly; F.fly = null;
      const S = F.sign;
      S.slot = fl.ch; S.slotPop = 0;
      boxW(Q1);
      g.burst(Q1.x, Q1.y, { kind: 'dot', color: '#FFE45C', n: 12 });
      g.sfx('pop');
      addT(0.26, () => { S.mode = 'merge'; S.mt = 0; g.sfx('bubble'); });
    }
    function poof(g) {
      const S = F.sign, k = L.k;
      S.mode = 'ans'; S.pop = 0; S.slot = '';
      signW(Q1);
      g.ring(Q1.x, Q1.y, '#FFFFFF', 120 * k);
      g.sfx('power');
      F.reveal = 0.0001;
      F.cat.mood = 'happy'; F.cat.moodT = 1.6; F.cat.jv = 300 * k; F.cat.squash = 0.8;
      const quick = F.qT < 4 && !F.qWrong;
      g.right(F.item, Q1.x, Q1.y);   // 最后一题会自动过关（state → 'over'）
      if (quick && g.state === 'play') g.float('一次就中！', Q1.x, Q1.y - 70 * k, { color: '#8CF5FF', size: 24 });
      if (ttsOK()) g.say(F.hint);
      if (g.state === 'play') addT(1.5, () => nextQuestion(g));
    }
    function snap(g) {
      const H = F.hook, f = H.carry, k = L.k;
      H.carry = null; setH('return');
      if (!f) return;
      const sy = waveY(f.x);
      f.st = 'escape'; f.escT = 0;
      f.vy = f.y < sy + 50 * k ? -320 * k : -60 * k;
      f.vx = (f.x < g.w / 2 ? -1 : 1) * rnd(160, 240) * k;
      f.spin = (Math.random() < 0.5 ? -1 : 1) * 8;
      g.burst(f.x, Math.min(f.y, sy), { kind: 'water', n: 18 });
      g.sfx('splash');
      puffs(f.x, f.y, 10);
      F.qWrong = true;
      const note = F.base + '＋' + F.rad + '＝' + F.ans + '（' + F.hint + '，' + F.py + '）；你钓了：' + f.lab;
      g.wrong(F.item, note, f.x, Math.max(f.y - 20 * k, sy - 40 * k));
      F.cat.mood = 'shock'; F.cat.moodT = 1.1;
      F.sign.shake = 0.55;
      F.boat.rockV += 1.4 * (Math.random() < 0.5 ? -1 : 1);
    }
    function hookBoot(g, b) {
      const H = F.hook;
      H.boot = null; H.fish = null; H.carry = b;
      b.st = 'hooked';
      setH('haul');
      g.sfx('chomp');
      puffs(H.x, H.y, 5);
    }
    function zap(g, j) {
      const H = F.hook, k = L.k;
      H.fish = null; H.boot = null;
      setH('zap');
      j.zapT = 0.7;
      g.burst(H.x, H.y, { kind: 'spark', color: '#FFF36B', n: 20 });
      g.burst(H.x, H.y, { kind: 'star', color: '#FFF36B', n: 6 });
      g.flash('#FFF7A0'); g.shake(6);
      g.miss();
      g.sfx('bad');
      g.float('⚡ 被水母电到啦', clamp(H.x, 90 * k, g.w - 90 * k), H.y - 34 * k, { color: '#FFF36B', size: 24 });
      F.cat.mood = 'zap'; F.cat.moodT = 0.9;
    }

    /* ================= 泡泡粒子（自己的小对象池） ================= */
    function puffs(x, y, n) {
      const k = L.k;
      for (let i = 0; i < n; i++) {
        const b = F.bubs[F.bi]; F.bi = (F.bi + 1) % F.bubs.length;
        b.on = true; b.x = x + rnd(-10, 10) * k; b.y = y + rnd(-6, 6) * k; b.r = rnd(2.5, 6.5) * k;
        b.vy = rnd(50, 110) * k; b.ph = rnd(0, TAU); b.age = 0; b.life = rnd(1.2, 2.6);
      }
    }

    /* ================= 计时器（本关内；过关动画期间也走） ================= */
    function addT(sec, fn) { F.timers.push({ t: sec, fn, done: false }); }
    function runT(dt) {
      const a = F.timers;
      if (!a.length) return;
      const n = a.length;
      for (let i = 0; i < n; i++) { const tm = a[i]; if (tm.done) continue; tm.t -= dt; if (tm.t <= 0) { tm.done = true; tm.fn(); if (F.timers !== a) return; } }
      F.timers = a.filter((tm) => !tm.done);
    }

    /* ================= 每帧推进 ================= */
    function step(g, dt, logic) {
      if (!F) return;
      F.t += dt;
      const k = L.k, H = F.hook, B = F.boat, t = F.t;
      if (logic) {
        F.qT += dt;
        if (H.st === 'idle' && !F.solved) F.idleT += dt; else F.idleT = 0;
        if (F.turnP > 0) {
          F.turnT -= dt;
          if (F.turnT <= 0) {
            F.turnT = F.turnP * rnd(0.8, 1.2);
            const ln = F.lanes[Math.floor(Math.random() * F.lanes.length)];
            ln.dir *= -1;
            for (const f of F.fish) if (f.lane === ln.i && f.st === 'swim') { f.agit = 1; puffs(f.x, f.y, 3); }
          }
        }
      }
      runT(dt);
      if (!F) return;

      /* 船：点鱼时滑过去（弹簧）；键盘 ←→ 直接开 */
      const kbDir = (g.held.left ? -1 : 0) + (g.held.right ? 1 : 0);
      if (logic && kbDir && (H.st === 'idle' || H.st === 'return')) {
        B.tx = null;
        B.vx = lerp(B.vx, kbDir * 380 * k, Math.min(1, dt * 10));
        B.x += B.vx * dt;
      } else if (B.tx != null) {
        const a = (B.tx - B.x) * 32 - B.vx * 10;
        B.vx += a * dt; B.x += B.vx * dt;
        if (Math.abs(B.tx - B.x) < 0.8 && Math.abs(B.vx) < 6) { B.tx = null; }
      } else {
        B.vx *= Math.exp(-7 * dt); B.x += B.vx * dt;
      }
      if (B.x < L.bMin) { B.x = L.bMin; B.vx = 0; } else if (B.x > L.bMax) { B.x = L.bMax; B.vx = 0; }
      B.rockV += (-B.rock * 38 - B.rockV * 4.2) * dt; B.rock += B.rockV * dt * 0.1;
      pose();
      toW(ROD_TIP_X * k, ROD_TIP_Y * k, F.tip0);

      /* 猫 */
      const C = F.cat;
      C.moodT -= dt;
      if (C.moodT <= 0 && C.mood !== 'idle') { C.mood = (H.st === 'cast') ? 'focus' : 'idle'; C.moodT = 0; }
      C.jv -= 1900 * k * dt; C.jump += C.jv * dt;
      if (C.jump <= 0) { C.jump = 0; if (C.jv < 0) { if (C.jv < -140 * k) C.squash = 0.86; C.jv = 0; } }
      C.squash += (1 - C.squash) * Math.min(1, dt * 9);
      C.blinkT -= dt;
      if (C.blinkT <= 0) { C.blink = 0.13; C.blinkT = rnd(2.2, 4.5); }
      if (C.blink > 0) C.blink -= dt;

      /* 鱼钩 */
      stepHook(g, dt);
      if (!F) return;

      /* 鱼竿弯曲 + 牌子 */
      const want = H.st === 'reel' ? 1 : H.st === 'fight' ? 1.25 + Math.sin(t * 30) * 0.25 : H.st === 'haul' ? 0.6 : H.st === 'dangle' ? 0.75 : H.st === 'cast' ? 0.12 : 0;
      F.bend += (want - F.bend) * Math.min(1, dt * 10);
      F.bendKick = Math.max(0, F.bendKick - dt * 3);
      const S = F.sign;
      if (S.shake > 0) S.shake = Math.max(0, S.shake - dt);
      if (S.slotPop < 1) S.slotPop = Math.min(1, S.slotPop + dt / 0.35);
      if (S.mode === 'merge') { S.mt += dt / 0.28; if (S.mt >= 1) { S.mt = 1; poof(g); } }
      if (S.pop < 1) S.pop = Math.min(1, S.pop + dt / 0.6);
      if (S.foldV) {
        S.fold += S.foldV * dt / 0.16;
        if (S.fold <= 0) { S.fold = 0; if (S.foldV < 0) S.foldV = 0; }
        if (S.fold >= 1) { S.fold = 1; S.foldV = 0; }
      }
      if (F.reveal > 0 && F.reveal < 1) F.reveal = Math.min(1, F.reveal + dt / 0.45);
      if (F.bubPop < 1) F.bubPop = Math.min(1, F.bubPop + dt / 0.5);

      /* 偏旁飞向“？”格 */
      if (F.fly) {
        const fl = F.fly;
        fl.t += dt;
        const p = Math.min(1, fl.t / fl.d), e = oCubic(p);
        boxW(Q1);
        fl.x = lerp(fl.x0, Q1.x, e); fl.y = lerp(fl.y0, Q1.y, e) - Math.sin(p * Math.PI) * 46 * k;
        fl.sp -= dt;
        if (fl.sp <= 0) { fl.sp = 0.03; g.burst(fl.x, fl.y, { kind: 'spark', color: '#FFF6B0', n: 2 }); }
        if (p >= 1) landLabel(g);
      }

      stepFish(g, dt);
      stepBoots(g, dt);
      stepJellies(g, dt);

      /* 泡泡 */
      for (const b of F.bubs) {
        if (!b.on) continue;
        b.age += dt;
        b.y -= b.vy * dt; b.x += Math.sin(b.age * 5 + b.ph) * 16 * k * dt;
        if (b.age >= b.life || b.y < waveY(b.x) + 2) b.on = false;
      }
      F.ambT -= dt;
      if (F.ambT <= 0) {
        F.ambT = rnd(0.25, 0.6);
        const wd = F.weeds[Math.floor(Math.random() * F.weeds.length)];
        puffs(wd.x * g.w, L.floor - rnd(10, 40) * k, 1);
      }
      /* 海底：螃蟹、宝箱 */
      const cr = F.crab;
      cr.x += cr.dir * 26 * k * dt;
      if (cr.x < g.w * 0.08) { cr.x = g.w * 0.08; cr.dir = 1; } else if (cr.x > g.w * 0.55) { cr.x = g.w * 0.55; cr.dir = -1; }
      const ch = F.chest;
      ch.t += dt;
      if (ch.t > 7) { ch.t = 0; }
      if (ch.t > 5.6 && ch.t < 5.6 + dt * 1.5) puffs(ch.x * g.w, L.floor - 18 * k, 7);
    }

    function stepHook(g, dt) {
      const H = F.hook, k = L.k, tip = F.tip0;
      const idleX = tip.x, idleY = waveY(tip.x) + 26 * k;
      H.t += dt;
      switch (H.st) {
        case 'idle':
          H.x = idleX + Math.sin(F.t * 1.8) * 2 * k; H.y = idleY + Math.sin(F.t * 2.4) * 2 * k;
          break;
        case 'cast': {
          let tx = H.tx, ty = H.ty;
          if (H.fish) {
            const f = H.fish;
            if (!catchable(f)) { H.fish = null; setH('return'); break; }
            mouthOf(f, M); tx = M.x; ty = M.y;
          } else if (H.boot) {
            const b = H.boot;
            if (b.st !== 'swim') { H.boot = null; setH('return'); break; }
            tx = b.x; ty = b.y - 8 * k;
          }
          const above = H.y < waveY(H.x);
          const dx = tx - H.x, dy = ty - H.y, d = Math.hypot(dx, dy), s = L.hookV * dt;
          let arrived = false;
          if (d <= s + 1) { H.x = tx; H.y = ty; arrived = true; } else { H.x += dx / d * s; H.y += dy / d * s; }
          if (above && H.y >= waveY(H.x)) { puffs(H.x, waveY(H.x) + 6 * k, 5); g.burst(H.x, waveY(H.x), { kind: 'water', n: 5 }); g.sfx('bubble'); }
          if (H.y > L.sy) {
            const j = jellyAt(H.x, H.y, 4 * k);
            if (j) { zap(g, j); break; }
          }
          if (!H.fish && !H.boot && H.y > L.sy) {
            const f = fishAt(g, H.x, H.y, 2 * k);
            if (f) { bite(g, f); break; }
            const b = bootAt(g, H.x, H.y, 0);
            if (b) { hookBoot(g, b); break; }
          }
          if (arrived) {
            if (H.fish) bite(g, H.fish);
            else if (H.boot) hookBoot(g, H.boot);
            else setH('return');
          }
          if (H.t > 3) setH('return');
          break;
        }
        case 'reel': {
          const f = H.carry, ty = waveY(H.x) + 2 * k;
          H.x = lerp(H.x, tip.x, Math.min(1, dt * 2.5));
          H.y = Math.max(ty, H.y - L.reelV * dt);
          F.tickT -= dt;
          if (F.tickT <= 0) { F.tickT = 0.085; g.sfx('tick'); }
          if (f) hang(f, H, dt);
          if (H.y <= ty + 0.5) leap(g);
          break;
        }
        case 'fight': {
          const f = H.carry, ty = waveY(H.x) + 14 * k;
          H.x += Math.sin(H.t * 28) * 150 * k * dt;
          H.y = Math.max(ty, H.y - L.reelV * 0.5 * dt);
          F.tickT -= dt;
          if (F.tickT <= 0) { F.tickT = 0.14; g.sfx('tick'); puffs(H.x, H.y + 20 * k, 1); }
          if (f) { hang(f, H, dt); f.agit = 1; }
          if ((H.y <= ty + 0.5 && H.t > 0.35) || H.t > 1.2) snap(g);
          break;
        }
        case 'haul': {
          const b = H.carry, ty = waveY(H.x) - 2 * k;
          H.x = lerp(H.x, tip.x, Math.min(1, dt * 2.5));
          H.y = Math.max(ty, H.y - L.reelV * dt);
          if (b) { b.x = H.x; b.y = H.y + 22 * k; b.rot = Math.sin(H.t * 9) * 0.2; }
          if (H.y <= ty + 0.5) { setH('dangle'); g.burst(H.x, waveY(H.x), { kind: 'water', n: 12 }); g.sfx('splash'); }
          break;
        }
        case 'dangle': {
          const b = H.carry, ty = tip.y + 46 * k;
          H.y = lerp(H.y, ty, Math.min(1, dt * 7)); H.x = lerp(H.x, tip.x, Math.min(1, dt * 5));
          if (b) { b.x = H.x + Math.sin(H.t * 8) * 5 * k; b.y = H.y + 24 * k; b.rot = Math.sin(H.t * 8) * 0.35; }
          if (H.t > 0.3 && !H.said) {
            H.said = true;
            g.miss();
            g.sfx('bad');
            g.float('👢 旧靴子！', clamp(H.x, 90 * k, g.w - 90 * k), H.y - 10 * k, { color: '#FFE9B0', size: 26 });
            F.cat.mood = 'meh'; F.cat.moodT = 1.2;
          }
          if (H.t > 0.85) {
            if (b) { b.st = 'fling'; b.vx = (b.x < g.w / 2 ? -1 : 1) * 330 * k; b.vy = -420 * k; b.spin = 9 * sgn(b.vx); }
            H.carry = null; setH('return'); g.sfx('whoosh');
          }
          break;
        }
        case 'zap':
          if (H.t > 0.5) setH('return');
          break;
        case 'return': {
          const dx = idleX - H.x, dy = idleY - H.y, d = Math.hypot(dx, dy), s = 1500 * k * dt;
          if (d <= s + 1) setH('idle'); else { H.x += dx / d * s; H.y += dy / d * s; }
          break;
        }
        default: setH('idle');
      }
    }

    function stepFish(g, dt) {
      const k = L.k, w = g.w, t = F.t, bobA = lvv(LV.bob, g.level) * L.lh;
      let dead = 0;
      for (const f of F.fish) {
        const ln = F.lanes[f.lane] || F.lanes[0];
        f.agit = Math.max(0, f.agit - dt * 1.6);
        f.ph += dt * (7 + f.agit * 18 + (f.st === 'flee' ? 10 : 0));
        switch (f.st) {
          case 'enter':
          case 'swim': {
            f.dir = ln.dir;
            f.bx += ln.dir * ln.v * dt;
            if (f.st === 'enter') {
              f.et += dt;
              const p = Math.min(1, f.et / f.ed);
              f.off = f.off0 * (1 - oCubic(p));
              if (p >= 1) { f.st = 'swim'; f.off = 0; }
            } else {
              if (f.bx > w + L.m) f.bx -= L.span; else if (f.bx < -L.m) f.bx += L.span;
            }
            f.x = f.bx + f.off;
            f.y = ln.y + Math.sin(t * f.bobF + f.bobPh) * bobA;
            f.face += (f.dir - f.face) * Math.min(1, dt * 7);
            f.rot *= Math.exp(-8 * dt);
            f.bubT -= dt;
            if (f.bubT <= 0) { f.bubT = rnd(1.4, 3.2); mouthOf(f, M); puffs(M.x, M.y - 4 * k, Math.random() < 0.5 ? 1 : 2); }
            break;
          }
          case 'hooked': break;   // 位置由鱼钩带着走（hang）
          case 'leap': {
            f.vy += L.grav * dt; f.x += f.vx * dt; f.y += f.vy * dt; f.rot += f.spin * dt;
            if (!f.labGone && f.vy > -70 * k) detachLabel(g, f);
            if (f.vy > 0 && f.y > waveY(f.x) + 4 * k) {
              g.burst(f.x, waveY(f.x), { kind: 'water', n: 12 }); puffs(f.x, f.y + 10 * k, 6);
              flee(g, f); f.vy = 160 * k;
            }
            break;
          }
          case 'escape': {
            f.escT += dt;
            const sy = waveY(f.x);
            if (f.y < sy) { f.vy += L.grav * dt; } else { f.vy *= Math.exp(-5 * dt); f.vy += 120 * k * dt; }
            f.x += f.vx * dt; f.y += f.vy * dt; f.rot += f.spin * dt; f.spin *= Math.exp(-2 * dt);
            if (f.escT > 0.45 && f.y > sy + 6 * k) { flee(g, f); f.vy = 60 * k; }
            break;
          }
          case 'flee': {
            f.x += f.dir * f.fv * dt;
            if (f.vy) { f.y += f.vy * dt; f.vy *= Math.exp(-3 * dt); }
            if (f.y < L.fTop) f.y += (L.fTop - f.y) * Math.min(1, dt * 3);
            f.face += (f.dir - f.face) * Math.min(1, dt * 9);
            f.rot *= Math.exp(-7 * dt);
            if (f.x < -L.m * 1.5 || f.x > w + L.m * 1.5) { f.st = 'dead'; }
            break;
          }
          default: break;
        }
        if (f.st === 'dead') dead++;
      }
      if (dead) F.fish = F.fish.filter((f) => f.st !== 'dead');
    }
    function stepBoots(g, dt) {
      const k = L.k, w = g.w, t = F.t;
      for (const b of F.boots) {
        if (b.st === 'swim') {
          b.x += b.dir * b.v * dt;
          if (b.x > w + L.m) b.x -= L.span; else if (b.x < -L.m) b.x += L.span;
          b.y = b.baseY + Math.sin(t * 0.7 + b.ph) * 16 * k;
          b.rot = Math.sin(t * 1.3 + b.ph) * 0.28;
        } else if (b.st === 'fling') {
          b.vy += L.grav * dt; b.x += b.vx * dt; b.y += b.vy * dt; b.rot += b.spin * dt;
          if (b.y > g.h + 60 * k || b.x < -120 * k || b.x > w + 120 * k) { b.st = 'gone'; b.respawn = rnd(3, 6); }
        } else if (b.st === 'gone') {
          b.respawn -= dt;
          if (b.respawn <= 0) {
            b.st = 'swim'; b.dir = Math.random() < 0.5 ? -1 : 1;
            b.x = b.dir > 0 ? -L.m * 0.9 : w + L.m * 0.9;
            b.baseY = rnd(L.fTop + 20 * k, L.fBot - 20 * k);
          }
        }
      }
    }
    function stepJellies(g, dt) {
      const k = L.k, w = g.w, t = F.t;
      for (const j of F.jellies) {
        j.x += j.vx * dt;
        if (j.x > w + 40 * k) j.x = -40 * k; else if (j.x < -40 * k) j.x = w + 40 * k;
        j.y = j.cy + Math.sin(t * j.f + j.ph) * j.amp;
        j.pulse += dt * 4;
        if (j.zapT > 0) j.zapT -= dt;
        if (j.boing > 0) j.boing = Math.max(0, j.boing - dt * 2.5);
      }
    }

    /* ================= 绘制 ================= */
    function drawSky(g, c) {
      const P = F.P, w = g.w, k = L.k, t = F.t, sy = L.sy;
      c.fillStyle = lgrad(c, 'sky', 0, 0, 0, sy, P.sky);
      c.fillRect(-20, -20, w + 40, sy + 30);
      // 星星（夜）
      if (P.orb === 'moon') {
        c.fillStyle = '#FFFFFF';
        for (const s of F.stars) {
          const a = 0.35 + 0.65 * (0.5 + 0.5 * Math.sin(t * s.sp + s.ph));
          c.globalAlpha = a;
          c.beginPath(); c.arc(s.x * w, g.hudTop * 0.3 + s.y * (sy - 20 * k), s.r * k, 0, TAU); c.fill();
        }
        c.globalAlpha = 1;
      }
      // 太阳 / 夕阳 / 月亮
      if (P.orb === 'sun') {
        const x = w * 0.86, y = L.bubY + 36 * k, r = 22 * k;
        c.save(); c.translate(x, y);
        c.fillStyle = rgrad(c, 'sunglow', r * 3.2, [0, 'rgba(255,248,190,.9)', 0.4, 'rgba(255,236,140,.35)', 1, 'rgba(255,230,120,0)']);
        c.beginPath(); c.arc(0, 0, r * 3.2, 0, TAU); c.fill();
        c.rotate(t * 0.15);
        c.fillStyle = 'rgba(255,243,168,.6)';
        for (let i = 0; i < 10; i++) {
          c.rotate(TAU / 10);
          const Lr = r * (1.7 + 0.2 * Math.sin(t * 2.2 + i * 1.7));
          c.beginPath(); c.moveTo(r * 1.1, -r * 0.18); c.lineTo(Lr, 0); c.lineTo(r * 1.1, r * 0.18); c.closePath(); c.fill();
        }
        c.fillStyle = rgrad(c, 'sundisc', r, [0, '#FFF9C4', 0.6, '#FFE14D', 1, '#FFB21F']);
        c.beginPath(); c.arc(0, 0, r, 0, TAU); c.fill();
        c.lineWidth = 2.5 * k; c.strokeStyle = 'rgba(230,140,20,.6)'; c.stroke();
        c.restore();
      } else if (P.orb === 'set') {
        const x = w * 0.74, y = sy - 4 * k, r = 36 * k;
        c.save(); c.translate(x, y);
        c.fillStyle = rgrad(c, 'setglow', r * 3.6, [0, 'rgba(255,214,140,.85)', 0.45, 'rgba(255,150,110,.3)', 1, 'rgba(255,120,100,0)']);
        c.beginPath(); c.arc(0, 0, r * 3.6, 0, TAU); c.fill();
        c.fillStyle = rgrad(c, 'setdisc', r, [0, '#FFF2B0', 0.55, '#FFB347', 1, '#FF7A45']);
        c.beginPath(); c.arc(0, 0, r, 0, TAU); c.fill();
        c.restore();
      } else {
        const x = w * 0.86, y = L.bubY + 34 * k, r = 20 * k;
        c.save(); c.translate(x, y);
        c.fillStyle = rgrad(c, 'moonglow', r * 3.4, [0, 'rgba(255,250,220,.55)', 0.4, 'rgba(200,210,255,.18)', 1, 'rgba(200,210,255,0)']);
        c.beginPath(); c.arc(0, 0, r * 3.4, 0, TAU); c.fill();
        c.fillStyle = '#FFF6D8'; c.beginPath(); c.arc(0, 0, r, 0, TAU); c.fill();
        c.fillStyle = 'rgba(210,196,150,.55)';
        c.beginPath(); c.arc(-r * 0.3, -r * 0.2, r * 0.22, 0, TAU); c.fill();
        c.beginPath(); c.arc(r * 0.35, r * 0.25, r * 0.16, 0, TAU); c.fill();
        c.beginPath(); c.arc(r * 0.05, r * 0.5, r * 0.1, 0, TAU); c.fill();
        c.restore();
      }
      // 云
      const span = w + 240 * k;
      for (const cl of F.clouds) {
        let x = (cl.x * span + t * cl.v * k) % span; if (x < 0) x += span;
        g.cloud(x - 120 * k, g.hudTop * 0.5 + cl.y * (sy - g.hudTop * 0.5 - 50 * k), cl.s * k, P.cloud * cl.a);
      }
      // 海鸥（白天/黄昏）或孔明灯（夜）
      if (P.gull) {
        c.strokeStyle = 'rgba(40,60,90,.75)'; c.lineWidth = 2.2 * k; c.lineCap = 'round';
        for (let i = 0; i < 3; i++) {
          const sp = w + 120, x = ((i * 0.41 * sp + t * (30 + i * 8)) % sp) - 60;
          const y = L.bubY + L.bubH + 20 * k + i * 18 * k + Math.sin(t * 0.8 + i) * 7 * k;
          const fl = Math.sin(t * 7 + i * 2) * 5 * k, kk = (8 - i) * k;
          c.beginPath(); c.moveTo(x - kk * 1.4, y - fl * 0.4); c.quadraticCurveTo(x - kk * 0.6, y - kk * 0.7 - fl, x, y);
          c.quadraticCurveTo(x + kk * 0.6, y - kk * 0.7 - fl, x + kk * 1.4, y - fl * 0.4); c.stroke();
        }
      } else {
        for (const ln of F.lanterns) {
          const hh = sy - g.hudTop;
          const y = sy - 10 * k - ((ln.p * hh + t * ln.v * k) % hh);
          const x = ln.x * w + Math.sin(t * 0.6 + ln.ph) * 10 * k, s = ln.s * k;
          c.save(); c.translate(x, y);
          c.fillStyle = rgrad(c, 'lglow', 22, [0, 'rgba(255,200,90,.55)', 1, 'rgba(255,180,80,0)']);
          c.scale(s, s); c.beginPath(); c.arc(0, 0, 22, 0, TAU); c.fill();
          c.fillStyle = '#FF9A3C'; c.beginPath(); c.moveTo(-6, -8); c.lineTo(6, -8); c.lineTo(8, 7); c.lineTo(-8, 7); c.closePath(); c.fill();
          c.fillStyle = '#FFE08A'; c.fillRect(-3, 2, 6, 5);
          c.restore();
        }
      }
      // 远处：小岛 + 城市（滨海湾金沙、摩天轮）
      c.fillStyle = P.isle;
      c.beginPath(); c.ellipse(w * 0.14, sy + 2, w * 0.16, 20 * k, 0, Math.PI, TAU); c.fill();
      c.fillStyle = P.isle2;
      c.beginPath(); c.ellipse(w * 0.22, sy + 2, w * 0.08, 12 * k, 0, Math.PI, TAU); c.fill();
      palm(c, w * 0.1, sy - 14 * k, 40 * k, 0.12, t, 1, P);
      palm(c, w * 0.17, sy - 16 * k, 30 * k, -0.15, t, 2, P);
      c.fillStyle = P.far;
      for (const b of F.city) c.fillRect(b.x, sy - b.h, b.w, b.h + 2);
      // 摩天轮（慢慢转）
      const fx = w * 0.56, fr = 26 * k, fy = sy - fr - 8 * k;
      c.strokeStyle = P.far; c.lineWidth = 2.2 * k;
      c.beginPath(); c.arc(fx, fy, fr, 0, TAU); c.stroke();
      c.beginPath();
      for (let i = 0; i < 8; i++) { const a = t * 0.2 + i * TAU / 8; c.moveTo(fx, fy); c.lineTo(fx + Math.cos(a) * fr, fy + Math.sin(a) * fr); }
      c.moveTo(fx - 10 * k, sy); c.lineTo(fx, fy); c.lineTo(fx + 10 * k, sy);
      c.stroke();
      // 金沙三塔 + 船形顶
      const mx = w * 0.7, s = 0.62 * k;
      for (let i = 0; i < 3; i++) {
        const bx = mx + i * 22 * s;
        c.beginPath(); c.moveTo(bx, sy); c.lineTo(bx + 3 * s, sy - 64 * s); c.lineTo(bx + 13 * s, sy - 64 * s); c.lineTo(bx + 15 * s, sy); c.closePath(); c.fill();
      }
      c.beginPath(); c.moveTo(mx - 7 * s, sy - 64 * s); c.lineTo(mx + 67 * s, sy - 66 * s); c.lineTo(mx + 74 * s, sy - 71 * s); c.lineTo(mx - 7 * s, sy - 71 * s); c.closePath(); c.fill();
      if (P.win) {
        c.fillStyle = P.win;
        const ws = 2.6 * k;
        for (const b of F.city) for (let i = 0; i < b.win.length; i += 2) c.fillRect(b.x + b.win[i], sy - b.h + b.win[i + 1], ws, ws * 1.3);
      }
    }
    function palm(c, x, y, hgt, lean, t, ph, P) {
      const s = hgt / 100;
      const tx = x + lean * hgt, ty = y - hgt;
      c.lineCap = 'round';
      c.strokeStyle = P.id === 'night' ? '#2A2A30' : '#8A5A33'; c.lineWidth = 6 * s;
      c.beginPath(); c.moveTo(x, y); c.quadraticCurveTo(x + lean * hgt * 0.2, y - hgt * 0.6, tx, ty); c.stroke();
      const sw = Math.sin(t * 1.3 + ph) * 0.07;
      c.fillStyle = P.id === 'night' ? '#173A2E' : '#2A9D4E';
      for (let i = 0; i < 6; i++) {
        const a = -Math.PI + 0.3 + i * 0.52 + sw;
        c.save(); c.translate(tx, ty); c.rotate(a);
        c.beginPath(); c.moveTo(0, 0); c.quadraticCurveTo(22 * s, -9 * s, 44 * s, 10 * s); c.quadraticCurveTo(22 * s, 4 * s, 0, 0); c.fill();
        c.restore();
      }
    }
    function drawWater(g, c) {
      const P = F.P, w = g.w, h = g.h, k = L.k, t = F.t;
      // 水体（上沿 = 波浪）
      c.beginPath(); c.moveTo(-10, h + 10);
      for (let x = -10; x <= w + 12; x += 12) c.lineTo(x, waveY(x));
      c.lineTo(w + 12, h + 10); c.closePath();
      c.fillStyle = lgrad(c, 'water', 0, L.sy - 6 * k, 0, h, P.w);
      c.fill();
      // 太阳/月亮倒影
      const ox = P.orb === 'set' ? w * 0.74 : w * 0.86;
      c.fillStyle = P.orb === 'moon' ? 'rgba(255,246,216,.55)' : 'rgba(255,245,200,.7)';
      for (let i = 0; i < 7; i++) {
        const yy = L.sy + 8 * k + i * 9 * k, ww = (26 - i * 2.4) * k * (0.7 + 0.3 * Math.sin(t * 3 + i * 1.7));
        c.globalAlpha = 0.85 - i * 0.1;
        c.fillRect(ox - ww / 2 + Math.sin(t * 2 + i) * 4 * k, yy, ww, 2.4 * k);
      }
      c.globalAlpha = 1;
      // 光柱
      if (P.ray > 0) {
        c.save(); c.globalCompositeOperation = 'lighter';
        c.fillStyle = lgrad(c, 'ray', 0, L.sy, 0, h * 0.9, [0, 'rgba(255,255,255,' + P.ray + ')', 1, 'rgba(255,255,255,0)']);
        for (let i = 0; i < 5; i++) {
          const x = w * (0.08 + i * 0.22) + Math.sin(t * 0.3 + i * 1.3) * 26 * k, ww = (22 + (i % 3) * 14) * k;
          c.globalAlpha = 0.55 + 0.45 * Math.sin(t * 0.7 + i * 2);
          c.beginPath(); c.moveTo(x, L.sy); c.lineTo(x + ww, L.sy); c.lineTo(x + ww + 110 * k, h * 0.9); c.lineTo(x + 60 * k, h * 0.9); c.closePath(); c.fill();
        }
        c.restore();
      }
      // 夜光浮游生物
      if (P.glow) {
        c.fillStyle = '#8FF3FF';
        for (const p of F.plank) {
          const a = 0.5 + 0.5 * Math.sin(t * p.sp + p.ph);
          c.globalAlpha = a * 0.8;
          const x = (p.x * w + Math.sin(t * 0.4 + p.ph) * 12 * k), y = L.sy + 20 * k + p.y * (L.floor - L.sy - 20 * k);
          c.beginPath(); c.arc(x, y, p.r * k, 0, TAU); c.fill();
        }
        c.globalAlpha = 1;
      }
      // 远处的鱼影（视差：比真鱼慢）
      c.fillStyle = P.id === 'night' ? 'rgba(120,180,255,.13)' : 'rgba(8,40,90,.2)';
      for (const ff of F.farFish) {
        const sp = w + 160 * k;
        let x = (ff.p * sp + t * ff.v * k) % sp; if (x < 0) x += sp; x -= 80 * k;
        const y = L.fTop + ff.y * (L.fBot - L.fTop) + Math.sin(t * 1.3 + ff.ph) * 6 * k, kk = 12 * ff.s * k, d = sgn(ff.v);
        c.beginPath(); c.ellipse(x, y, kk, kk * 0.45, 0, 0, TAU); c.fill();
        c.beginPath(); c.moveTo(x - d * kk * 0.8, y); c.lineTo(x - d * kk * 1.6, y - kk * 0.5 + Math.sin(t * 8 + ff.ph) * 2); c.lineTo(x - d * kk * 1.6, y + kk * 0.5); c.closePath(); c.fill();
      }
    }
    function drawSeabed(g, c) {
      const P = F.P, w = g.w, h = g.h, k = L.k, t = F.t, fy = L.floor;
      // 水草
      c.lineCap = 'round';
      for (const wd of F.weeds) {
        const x = wd.x * w, hh = (46 + 70 * wd.h) * k, sw = Math.sin(t * 1.4 + wd.ph) * 13 * k;
        c.strokeStyle = P.id === 'night' ? '#1D5B4A' : wd.c; c.lineWidth = 7 * k;
        c.beginPath(); c.moveTo(x, fy + 8 * k); c.quadraticCurveTo(x - sw, fy - hh * 0.5, x + sw * 1.2, fy - hh); c.stroke();
        c.lineWidth = 4.5 * k;
        c.beginPath(); c.moveTo(x + 6 * k, fy + 8 * k); c.quadraticCurveTo(x + 6 * k + sw * 0.8, fy - hh * 0.35, x + 6 * k - sw * 0.6, fy - hh * 0.62); c.stroke();
      }
      // 沙
      c.fillStyle = P.sand;
      c.beginPath(); c.moveTo(-10, h + 10);
      for (let x = -10; x <= w + 20; x += 20) c.lineTo(x, fy + Math.sin(x * 0.02 / k) * 5 * k + Math.sin(x * 0.051 / k) * 2 * k);
      c.lineTo(w + 20, h + 10); c.closePath(); c.fill();
      c.fillStyle = P.sand2;
      for (let i = 0; i < 9; i++) { const x = ((i * 0.117 + 0.03) % 1) * w; c.beginPath(); c.ellipse(x, fy + 16 * k, 7 * k, 2.2 * k, 0, 0, TAU); c.fill(); }
      // 珊瑚
      const cor = P.id === 'night' ? ['#8E4C7A', '#A65F5F'] : ['#FF7F6B', '#FF5E8A'];
      for (let q = 0; q < 2; q++) {
        const x = q ? w - 38 * k : 36 * k;
        c.fillStyle = cor[q];
        c.strokeStyle = cor[q]; c.lineWidth = 7 * k; c.lineCap = 'round';
        c.beginPath();
        c.moveTo(x, fy + 4 * k); c.lineTo(x, fy - 26 * k);
        c.moveTo(x, fy - 10 * k); c.lineTo(x - 14 * k, fy - 30 * k);
        c.moveTo(x, fy - 14 * k); c.lineTo(x + 13 * k, fy - 36 * k);
        c.moveTo(x + 7 * k, fy - 24 * k); c.lineTo(x + 20 * k, fy - 22 * k);
        c.stroke();
        for (const [dx, dy] of [[0, -26], [-14, -30], [13, -36], [20, -22]]) { c.beginPath(); c.arc(x + dx * k, fy + dy * k, 5 * k, 0, TAU); c.fill(); }
      }
      // 海星 + 贝壳
      const sx = w * 0.64, sy2 = fy + 10 * k;
      c.save(); c.translate(sx, sy2); c.rotate(0.3 + Math.sin(t * 0.5) * 0.05);
      c.fillStyle = P.id === 'night' ? '#B0663C' : '#FF9F43'; c.strokeStyle = NAVY; c.lineWidth = 1.8 * k;
      c.beginPath();
      for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + i * Math.PI / 5, r = (i % 2 ? 5 : 13) * k; if (i) c.lineTo(Math.cos(a) * r, Math.sin(a) * r); else c.moveTo(Math.cos(a) * r, Math.sin(a) * r); }
      c.closePath(); c.fill(); c.stroke();
      c.restore();
      g.emoji('🐚', w * 0.3, fy + 12 * k, 22 * k);
      // 宝箱（隔一会儿开盖冒泡）
      const ch = F.chest, cx = ch.x * w, cy = fy + 2 * k;
      const open = ch.t > 5.3 && ch.t < 6.9 ? Math.sin(Math.min(1, (ch.t - 5.3) / 0.25) * Math.PI / 2) * (ch.t > 6.6 ? (6.9 - ch.t) / 0.3 : 1) : 0;
      c.save(); c.translate(cx, cy);
      c.fillStyle = '#8A5A33'; c.strokeStyle = NAVY; c.lineWidth = 2.2 * k;
      c.beginPath(); rrPath(c, -22 * k, -20 * k, 44 * k, 22 * k, 3 * k); c.fill(); c.stroke();
      c.fillStyle = '#F4B63C'; c.fillRect(-22 * k, -13 * k, 44 * k, 4 * k); c.fillRect(-3 * k, -20 * k, 6 * k, 20 * k);
      if (open > 0.05) {
        c.fillStyle = 'rgba(255,230,120,' + (0.7 * open) + ')';
        c.beginPath(); c.ellipse(0, -21 * k, 18 * k, 6 * k, 0, 0, TAU); c.fill();
      }
      c.save(); c.translate(-22 * k, -20 * k); c.rotate(-open * 0.9);
      c.fillStyle = '#9C6A3D'; c.beginPath(); rrPath(c, 0, -10 * k, 44 * k, 10 * k, 4 * k); c.fill(); c.stroke();
      c.fillStyle = '#F4B63C'; c.fillRect(19 * k, -10 * k, 6 * k, 10 * k);
      c.restore();
      c.restore();
      // 螃蟹
      const cr = F.crab;
      g.emoji('🦀', cr.x, fy + 6 * k - Math.abs(Math.sin(t * 9)) * 2 * k, 30 * k, { rot: Math.sin(t * 9) * 0.08 });
    }
    function drawBubbles(g, c) {
      const k = L.k;
      c.strokeStyle = 'rgba(255,255,255,.75)'; c.lineWidth = 1.4 * k;
      c.beginPath();
      for (const b of F.bubs) { if (!b.on) continue; c.moveTo(b.x + b.r, b.y); c.arc(b.x, b.y, b.r, 0, TAU); }
      c.stroke();
      c.fillStyle = 'rgba(255,255,255,.8)';
      c.beginPath();
      for (const b of F.bubs) { if (!b.on || b.r < 3 * k) continue; const r = b.r * 0.3; c.moveTo(b.x - b.r * 0.35 + r, b.y - b.r * 0.35); c.arc(b.x - b.r * 0.35, b.y - b.r * 0.35, r, 0, TAU); }
      c.fill();
    }
    function drawFish(g, c, f) {
      const k = L.k * f.s, len = fishLen(f), hh = fishHt(f), pal = FISHPAL[f.pi % FISHPAL.length];
      const face = Math.abs(f.face) < 0.06 ? 0.06 * sgn(f.face) : f.face;
      c.save();
      c.translate(f.x, f.y);
      if (f.rot) c.rotate(f.rot);
      c.scale(face, 1);
      if (F.P.glow) {
        c.fillStyle = 'rgba(140,230,255,.13)';
        c.beginPath(); c.ellipse(0, 0, len * 0.66, hh * 0.82, 0, 0, TAU); c.fill();
      }
      const wag = Math.sin(f.ph) * (0.26 + f.agit * 0.28);
      c.lineJoin = 'round';
      // 尾巴
      c.save(); c.translate(-len * 0.4, 0); c.rotate(wag);
      c.beginPath(); c.moveTo(5 * k, 0);
      c.quadraticCurveTo(-len * 0.12, -hh * 0.2, -len * 0.25, -hh * 0.5);
      c.quadraticCurveTo(-len * 0.17, 0, -len * 0.25, hh * 0.5);
      c.quadraticCurveTo(-len * 0.12, hh * 0.2, 5 * k, 0); c.closePath();
      c.fillStyle = pal.fin; c.fill(); c.lineWidth = 2.4 * k; c.strokeStyle = NAVY; c.stroke();
      c.restore();
      // 背鳍 + 腹鳍
      c.beginPath(); c.moveTo(-len * 0.22, -hh * 0.36); c.quadraticCurveTo(-len * 0.05, -hh * (0.95 + 0.05 * Math.sin(f.ph * 0.5)), len * 0.16, -hh * 0.4); c.closePath();
      c.fillStyle = pal.fin; c.fill(); c.lineWidth = 2.2 * k; c.strokeStyle = NAVY; c.stroke();
      c.beginPath(); c.moveTo(-len * 0.12, hh * 0.38); c.quadraticCurveTo(-len * 0.02, hh * 0.72, len * 0.08, hh * 0.4); c.closePath();
      c.fill(); c.stroke();
      // 身体
      c.beginPath(); c.ellipse(0, 0, len * 0.5, hh * 0.5, 0, 0, TAU);
      if (!f.grad) f.grad = (() => { const gr = c.createLinearGradient(0, -hh * 0.5, 0, hh * 0.5); gr.addColorStop(0, pal.top); gr.addColorStop(0.45, pal.body); gr.addColorStop(1, pal.belly); return gr; })();
      c.fillStyle = f.grad; c.fill();
      if (pal.stripe) {
        c.save(); c.clip();
        c.fillStyle = '#FFFFFF'; c.strokeStyle = NAVY; c.lineWidth = 1.6 * k;
        c.beginPath(); c.ellipse(len * 0.2, 0, 6 * k, hh * 0.6, 0, 0, TAU); c.fill(); c.stroke();
        c.beginPath(); c.ellipse(-len * 0.22, 0, 7 * k, hh * 0.6, 0, 0, TAU); c.fill(); c.stroke();
        c.restore();
        c.beginPath(); c.ellipse(0, 0, len * 0.5, hh * 0.5, 0, 0, TAU);
      }
      c.lineWidth = 2.6 * k; c.strokeStyle = NAVY; c.stroke();
      c.fillStyle = 'rgba(255,255,255,.35)';
      c.beginPath(); c.ellipse(len * 0.05, -hh * 0.26, len * 0.3, hh * 0.1, 0, 0, TAU); c.fill();
      // 鳃 + 胸鳍（扑腾）
      c.strokeStyle = 'rgba(29,43,83,.55)'; c.lineWidth = 2 * k;
      c.beginPath(); c.arc(len * 0.18, 0, hh * 0.28, -0.9, 0.9); c.stroke();
      c.save(); c.translate(len * 0.08, hh * 0.12); c.rotate(0.5 + Math.sin(f.ph * 0.9) * 0.35);
      c.beginPath(); c.ellipse(-7 * k, 0, 9 * k, 4.5 * k, 0, 0, TAU); c.fillStyle = pal.fin; c.fill(); c.lineWidth = 1.6 * k; c.strokeStyle = NAVY; c.stroke();
      c.restore();
      // 眼睛
      const ex = len * 0.3, ey = -hh * 0.1;
      c.beginPath(); c.arc(ex, ey, 8.5 * k, 0, TAU); c.fillStyle = '#FFFFFF'; c.fill(); c.lineWidth = 2 * k; c.strokeStyle = NAVY; c.stroke();
      const scared = f.st === 'hooked' || f.st === 'escape' || f.st === 'leap';
      c.beginPath(); c.arc(ex + (scared ? 0 : 2 * k), ey + (scared ? 0 : 0.5 * k), scared ? 2.6 * k : 4.6 * k, 0, TAU); c.fillStyle = NAVY; c.fill();
      c.beginPath(); c.arc(ex + 3.4 * k, ey - 2.6 * k, 1.7 * k, 0, TAU); c.fillStyle = '#FFFFFF'; c.fill();
      // 嘴
      c.strokeStyle = NAVY; c.lineWidth = 2 * k;
      if (scared) { c.beginPath(); c.ellipse(len * 0.46, hh * 0.08, 3 * k, 4 * k, 0, 0, TAU); c.fillStyle = '#B8324B'; c.fill(); c.stroke(); }
      else { c.beginPath(); c.arc(len * 0.43, hh * 0.1, 4 * k, -0.2, 1.3); c.stroke(); }
      c.restore();
      // 偏旁牌（不镜像、不旋转）
      if (!f.labGone && f.st !== 'flee') {
        badgeOf(f, M);
        drawBadge(g, c, f.lab, M.x, M.y, f.s, pal.body);
      }
    }
    function drawBadge(g, c, ch, x, y, s, ring) {
      const k = L.k * s, r = 22 * k;
      c.beginPath(); c.arc(x, y + 2.5 * k, r, 0, TAU); c.fillStyle = 'rgba(29,43,83,.35)'; c.fill();
      c.beginPath(); c.arc(x, y, r, 0, TAU); c.fillStyle = '#FFFFFF'; c.fill();
      c.lineWidth = 2.6 * k; c.strokeStyle = NAVY; c.stroke();
      if (ring) { c.beginPath(); c.arc(x, y, r - 4 * k, 0, TAU); c.lineWidth = 1.8 * k; c.strokeStyle = ring; c.stroke(); }
      g.text(ch, x, y + 1 * k, { size: Math.round(32 * k), font: 'kai', weight: 700, color: NAVY });
    }
    function drawBoot(g, c, b) {
      const k = L.k;
      c.save(); c.translate(b.x, b.y);
      if (b.st === 'swim') {
        c.strokeStyle = F.P.id === 'night' ? '#2B6B55' : '#3BAA6A'; c.lineWidth = 3 * k; c.lineCap = 'round';
        c.beginPath(); c.moveTo(-6 * k, -20 * k); c.quadraticCurveTo(-18 * k, -34 * k + Math.sin(F.t * 3 + b.ph) * 4 * k, -10 * k, -46 * k); c.stroke();
      }
      c.restore();
      g.emoji('👢', b.x, b.y, 52 * k, { rot: b.rot });
    }
    function drawJelly(g, c, j) {
      const k = L.k, r = j.r, t = F.t, pu = Math.sin(j.pulse), zap = j.zapT > 0;
      const bo = 1 + j.boing * Math.sin(j.boing * 30) * 0.2;
      c.save(); c.translate(j.x, j.y); c.scale(bo, 2 - bo);
      // 触手
      c.lineCap = 'round'; c.lineWidth = 3 * k;
      c.strokeStyle = zap ? '#FFF36B' : 'rgba(255,170,220,.85)';
      for (let i = 0; i < 4; i++) {
        const x0 = (-r * 0.6 + i * r * 0.4);
        c.beginPath(); c.moveTo(x0, 2 * k);
        for (let s = 1; s <= 4; s++) c.lineTo(x0 + Math.sin(t * 5 + i + s * 1.3) * 4 * k, 2 * k + s * r * 0.34 * (1 - pu * 0.12));
        c.stroke();
      }
      // 伞盖
      const rx = r * (1 + pu * 0.07), ry = r * (0.85 - pu * 0.08);
      c.beginPath(); c.ellipse(0, 0, rx, ry, 0, Math.PI, TAU);
      c.quadraticCurveTo(rx * 0.5, ry * 0.3, 0, ry * 0.12); c.quadraticCurveTo(-rx * 0.5, ry * 0.3, -rx, 0);
      c.closePath();
      c.fillStyle = zap ? '#FFF7A0' : (F.P.glow ? 'rgba(255,150,230,.9)' : 'rgba(255,140,210,.88)'); c.fill();
      c.lineWidth = 2.2 * k; c.strokeStyle = zap ? '#FFB800' : NAVY; c.stroke();
      c.fillStyle = 'rgba(255,255,255,.45)';
      c.beginPath(); c.ellipse(-rx * 0.35, -ry * 0.55, rx * 0.22, ry * 0.14, -0.5, 0, TAU); c.fill();
      // 小脸
      c.fillStyle = NAVY;
      c.beginPath(); c.arc(-r * 0.28, -r * 0.2, 2.4 * k, 0, TAU); c.arc(r * 0.28, -r * 0.2, 2.4 * k, 0, TAU); c.fill();
      c.strokeStyle = NAVY; c.lineWidth = 1.6 * k;
      c.beginPath(); c.arc(0, -r * 0.1, 3 * k, 0.2, Math.PI - 0.2); c.stroke();
      if (zap) {
        c.strokeStyle = '#FFF36B'; c.lineWidth = 2.4 * k;
        for (let i = 0; i < 5; i++) {
          const a = i * TAU / 5 + t * 6;
          c.beginPath(); c.moveTo(Math.cos(a) * r * 1.1, Math.sin(a) * r * 1.1);
          c.lineTo(Math.cos(a + 0.2) * r * 1.4, Math.sin(a + 0.2) * r * 1.4); c.lineTo(Math.cos(a) * r * 1.7, Math.sin(a) * r * 1.7); c.stroke();
        }
      }
      c.restore();
    }
    function drawLineAndHook(g, c) {
      const H = F.hook, k = L.k, t = F.t;
      const tip = F.tip;
      c.lineCap = 'round'; c.lineJoin = 'round';
      const taut = H.st === 'reel' || H.st === 'fight' || H.st === 'haul' || H.st === 'dangle';
      const zapping = H.st === 'zap';
      c.strokeStyle = zapping ? (Math.sin(t * 60) > 0 ? '#FFF36B' : '#FFFFFF') : H.st === 'fight' ? '#FFD0D0' : 'rgba(255,255,255,.9)';
      c.lineWidth = (zapping ? 2.4 : 1.6) * k;
      if (H.st === 'idle') {
        const bx = tip.x, by = waveY(bx) - 2 * k;
        c.beginPath(); c.moveTo(tip.x, tip.y); c.quadraticCurveTo(tip.x - 6 * k, (tip.y + by) / 2, bx, by); c.stroke();
        c.beginPath(); c.moveTo(bx, by); c.lineTo(H.x, H.y); c.stroke();
        // 浮漂
        c.beginPath(); c.arc(bx, by, 6 * k, Math.PI, TAU); c.fillStyle = '#FF4B4B'; c.fill();
        c.beginPath(); c.arc(bx, by, 6 * k, 0, Math.PI); c.fillStyle = '#FFFFFF'; c.fill();
        c.beginPath(); c.arc(bx, by, 6 * k, 0, TAU); c.lineWidth = 1.6 * k; c.strokeStyle = NAVY; c.stroke();
        c.beginPath(); c.moveTo(bx, by - 6 * k); c.lineTo(bx, by - 11 * k); c.stroke();
      } else if (zapping) {
        c.beginPath(); c.moveTo(tip.x, tip.y);
        const n = 10;
        for (let i = 1; i <= n; i++) { const p = i / n; c.lineTo(lerp(tip.x, H.x, p) + (i < n ? rnd(-5, 5) * k : 0), lerp(tip.y, H.y, p)); }
        c.stroke();
      } else {
        const mx = (tip.x + H.x) / 2, my = (tip.y + H.y) / 2;
        const sag = taut ? 0 : Math.min(40 * k, Math.hypot(H.x - tip.x, H.y - tip.y) * 0.12);
        c.beginPath(); c.moveTo(tip.x, tip.y); c.quadraticCurveTo(mx - sag * 0.4, my + sag, H.x, H.y); c.stroke();
      }
      // 鱼钩 + 蚯蚓
      c.save(); c.translate(H.x, H.y);
      c.strokeStyle = NAVY; c.lineWidth = 3.8 * k;
      c.beginPath(); c.moveTo(0, -6 * k); c.lineTo(0, 6 * k); c.arc(-5 * k, 6 * k, 5 * k, 0, Math.PI); c.lineTo(-10 * k, 2 * k); c.stroke();
      c.strokeStyle = '#D5DEEA'; c.lineWidth = 2 * k;
      c.beginPath(); c.moveTo(0, -6 * k); c.lineTo(0, 6 * k); c.arc(-5 * k, 6 * k, 5 * k, 0, Math.PI); c.lineTo(-10 * k, 2 * k); c.stroke();
      if (!H.carry) {
        c.strokeStyle = '#FF7FA0'; c.lineWidth = 4 * k;
        c.beginPath(); c.moveTo(-8 * k, 4 * k);
        for (let i = 1; i <= 4; i++) c.lineTo(-8 * k - i * 3 * k, 4 * k + Math.sin(t * 9 + i) * 3 * k + i * 2 * k);
        c.stroke();
      }
      c.restore();
    }
    function drawRod(g, c) {
      const k = L.k, B = F.boat;
      toL(F.tip.x, F.tip.y, Q2);   // 已弯曲的竿尖（本地坐标）
      const bx = ROD_BASE_X * k, by = ROD_BASE_Y * k;
      c.lineCap = 'round';
      c.strokeStyle = NAVY; c.lineWidth = 6.5 * k;
      c.beginPath(); c.moveTo(bx, by); c.quadraticCurveTo(bx - 14 * k, by - 50 * k, Q2.x, Q2.y); c.stroke();
      c.strokeStyle = '#7A4A26'; c.lineWidth = 3.6 * k;
      c.beginPath(); c.moveTo(bx, by); c.quadraticCurveTo(bx - 14 * k, by - 50 * k, Q2.x, Q2.y); c.stroke();
      c.strokeStyle = '#E8533F'; c.lineWidth = 5 * k;
      c.beginPath(); c.moveTo(bx, by); c.lineTo(bx - 4 * k, by - 16 * k); c.stroke();
      // 绕线轮（收线时转）
      const rx = bx + 4 * k, ry = by - 10 * k;
      c.beginPath(); c.arc(rx, ry, 6 * k, 0, TAU); c.fillStyle = '#C9D3E0'; c.fill(); c.lineWidth = 1.8 * k; c.strokeStyle = NAVY; c.stroke();
      const ra = F.reelA;
      c.beginPath(); c.moveTo(rx, ry); c.lineTo(rx + Math.cos(ra) * 8 * k, ry + Math.sin(ra) * 8 * k); c.lineWidth = 2.2 * k; c.stroke();
      void B;
    }
    function drawBoatGroup(g, c) {
      const k = L.k, B = F.boat, C = F.cat, S = F.sign, t = F.t;
      c.save();
      c.translate(B.x, B.by); c.rotate(B.ang);
      drawRod(g, c);
      // 猫：尾巴 + 身体（在船舷后面）
      const cx = CAT_X * k, cy = DECK * k - C.jump;
      c.save(); c.translate(cx, cy);
      c.lineCap = 'round';
      const tw = Math.sin(t * 3) * 6 * k;
      c.strokeStyle = NAVY; c.lineWidth = 10 * k;
      c.beginPath(); c.moveTo(14 * k, -8 * k); c.quadraticCurveTo(36 * k, -8 * k, 31 * k + tw, -34 * k); c.stroke();
      c.strokeStyle = '#FFA94D'; c.lineWidth = 6 * k; c.stroke();
      c.scale(1 / C.squash, C.squash);
      c.beginPath(); c.ellipse(0, -20 * k, 21 * k, 21 * k, 0, 0, TAU);
      c.fillStyle = '#FFA94D'; c.fill(); c.lineWidth = 2.6 * k; c.strokeStyle = NAVY; c.stroke();
      c.beginPath(); c.ellipse(0, -16 * k, 11 * k, 13 * k, 0, 0, TAU); c.fillStyle = '#FFF1DC'; c.fill();
      c.restore();
      // 船身
      c.beginPath();
      c.moveTo(-66 * k, -16 * k); c.lineTo(66 * k, -16 * k);
      c.quadraticCurveTo(62 * k, 12 * k, 42 * k, 17 * k); c.lineTo(-44 * k, 17 * k);
      c.quadraticCurveTo(-62 * k, 12 * k, -66 * k, -16 * k); c.closePath();
      c.fillStyle = lgrad(c, 'hull', 0, -16 * k, 0, 17 * k, [0, '#FF6B55', 1, '#C23B2A']); c.fill();
      c.save(); c.clip();
      c.fillStyle = '#FFFFFF'; c.fillRect(-70 * k, -5 * k, 140 * k, 5 * k);
      c.fillStyle = 'rgba(0,0,0,.12)'; c.fillRect(-70 * k, 9 * k, 140 * k, 10 * k);
      c.restore();
      c.lineWidth = 3 * k; c.strokeStyle = NAVY; c.stroke();
      c.beginPath(); rrPath(c, -69 * k, -20 * k, 138 * k, 7 * k, 3.5 * k);
      c.fillStyle = '#A0672F'; c.fill(); c.lineWidth = 2.4 * k; c.strokeStyle = NAVY; c.stroke();
      g.text('华文号', 14 * k, 6.5 * k, { size: Math.round(10 * k), font: 'round', color: '#FFFFFF', stroke: NAVY, strokeW: 2 * k });
      // 船头灯笼
      const lx = 52 * k, sw = Math.sin(t * 2.2) * 0.15 + B.rock * 1.5;
      c.strokeStyle = '#7A4A26'; c.lineWidth = 3 * k;
      c.beginPath(); c.moveTo(lx, -18 * k); c.lineTo(lx, -54 * k); c.lineTo(lx + 10 * k, -54 * k); c.stroke();
      c.save(); c.translate(lx + 10 * k, -54 * k); c.rotate(sw);
      if (F.P.id !== 'day') { c.fillStyle = rgrad(c, 'lanternglow', 30 * k, [0, 'rgba(255,190,90,.6)', 1, 'rgba(255,160,60,0)']); c.beginPath(); c.arc(0, 14 * k, 30 * k, 0, TAU); c.fill(); }
      c.strokeStyle = NAVY; c.lineWidth = 1.5 * k;
      c.beginPath(); c.moveTo(0, 0); c.lineTo(0, 5 * k); c.stroke();
      c.beginPath(); c.ellipse(0, 14 * k, 8 * k, 9.5 * k, 0, 0, TAU); c.fillStyle = '#E8332A'; c.fill(); c.stroke();
      c.fillStyle = '#FFC928'; c.fillRect(-4.5 * k, 3.5 * k, 9 * k, 2.5 * k); c.fillRect(-4.5 * k, 22.5 * k, 9 * k, 2.5 * k);
      c.strokeStyle = '#FFC928'; c.beginPath(); c.moveTo(0, 25 * k); c.lineTo(0, 31 * k); c.stroke();
      c.restore();
      // 猫：手臂、头、牌子、爪子
      const sgy = SIGN_Y * k - C.jump, sgx = CAT_X * k;
      const armY = sgy + SIGN * k / 2 - 1 * k;
      c.lineCap = 'round';
      for (const sd of [-1, 1]) {
        c.strokeStyle = NAVY; c.lineWidth = 9 * k;
        c.beginPath(); c.moveTo(cx + sd * 14 * k, cy - 34 * k); c.quadraticCurveTo(cx + sd * 26 * k, cy - 60 * k, sgx + sd * 19 * k, armY); c.stroke();
        c.strokeStyle = '#FFA94D'; c.lineWidth = 5.6 * k; c.stroke();
      }
      drawCatHead(g, c, cx, cy - 50 * k);
      drawSign(g, c, sgx, sgy);
      for (const sd of [-1, 1]) {
        c.beginPath(); c.arc(sgx + sd * 19 * k, armY, 5.6 * k, 0, TAU); c.fillStyle = '#FFA94D'; c.fill(); c.lineWidth = 2 * k; c.strokeStyle = NAVY; c.stroke();
      }
      c.restore();
    }
    function drawCatHead(g, c, x, y) {
      const k = L.k, C = F.cat, t = F.t, H = F.hook;
      c.save(); c.translate(x, y);
      if (C.mood === 'zap') c.translate(rnd(-1.5, 1.5) * k, rnd(-1.5, 1.5) * k);
      // 耳朵
      for (const sd of [-1, 1]) {
        c.beginPath(); c.moveTo(sd * 17 * k, -8 * k); c.lineTo(sd * 6 * k, -16 * k); c.lineTo(sd * 16 * k, -29 * k); c.closePath();
        c.fillStyle = '#FFB35C'; c.fill(); c.lineWidth = 2.4 * k; c.strokeStyle = NAVY; c.stroke();
        c.beginPath(); c.moveTo(sd * 14.5 * k, -12 * k); c.lineTo(sd * 9.5 * k, -16 * k); c.lineTo(sd * 14.5 * k, -23 * k); c.closePath();
        c.fillStyle = '#FF9EB5'; c.fill();
      }
      c.beginPath(); c.ellipse(0, 0, 20 * k, 18.5 * k, 0, 0, TAU);
      c.fillStyle = C.mood === 'zap' ? '#FFE27A' : '#FFB35C'; c.fill(); c.lineWidth = 2.6 * k; c.strokeStyle = NAVY; c.stroke();
      c.strokeStyle = '#E0852C'; c.lineWidth = 2.4 * k; c.lineCap = 'round';
      c.beginPath(); c.moveTo(-5 * k, -17 * k); c.lineTo(-4 * k, -11 * k); c.moveTo(0, -18.5 * k); c.lineTo(0, -12 * k); c.moveTo(5 * k, -17 * k); c.lineTo(4 * k, -11 * k); c.stroke();
      // 脸颊
      c.fillStyle = 'rgba(255,110,140,.4)';
      c.beginPath(); c.ellipse(-12 * k, 5 * k, 4.5 * k, 3 * k, 0, 0, TAU); c.ellipse(12 * k, 5 * k, 4.5 * k, 3 * k, 0, 0, TAU); c.fill();
      // 眼睛
      let lx = 0, ly = 0;
      if (H.st !== 'idle') { const dx = H.x - F.boat.x, dy = H.y - F.boat.by; const d = Math.hypot(dx, dy) || 1; lx = dx / d * 1.6 * k; ly = dy / d * 1.6 * k; }
      c.strokeStyle = NAVY; c.fillStyle = NAVY; c.lineWidth = 2.4 * k;
      const m = C.mood;
      for (const sd of [-1, 1]) {
        const ex = sd * 7.5 * k, ey = -2 * k;
        if (m === 'happy') { c.beginPath(); c.arc(ex, ey + 1.5 * k, 4 * k, Math.PI + 0.3, TAU - 0.3); c.stroke(); }
        else if (m === 'meh') { c.beginPath(); c.moveTo(ex - 4 * k, ey); c.lineTo(ex + 4 * k, ey); c.stroke(); }
        else if (m === 'zap') { c.beginPath(); c.moveTo(ex - 3.5 * k, ey - 3.5 * k); c.lineTo(ex + 3.5 * k, ey + 3.5 * k); c.moveTo(ex + 3.5 * k, ey - 3.5 * k); c.lineTo(ex - 3.5 * k, ey + 3.5 * k); c.stroke(); }
        else if (m === 'shock' || m === 'worry') {
          c.beginPath(); c.arc(ex, ey, 5 * k, 0, TAU); c.fillStyle = '#FFFFFF'; c.fill(); c.stroke();
          c.beginPath(); c.arc(ex + lx, ey + ly, 2 * k, 0, TAU); c.fillStyle = NAVY; c.fill();
        } else if (C.blink > 0) { c.beginPath(); c.moveTo(ex - 3.5 * k, ey + 0.5 * k); c.lineTo(ex + 3.5 * k, ey + 0.5 * k); c.stroke(); }
        else {
          c.beginPath(); c.ellipse(ex + lx, ey + ly, 3.3 * k, 4.3 * k, 0, 0, TAU); c.fillStyle = NAVY; c.fill();
          c.beginPath(); c.arc(ex + lx + 1.2 * k, ey + ly - 1.6 * k, 1.3 * k, 0, TAU); c.fillStyle = '#FFFFFF'; c.fill();
        }
      }
      // 鼻子 + 嘴 + 胡子
      c.fillStyle = '#FF6F91';
      c.beginPath(); c.moveTo(-2.6 * k, 3.5 * k); c.lineTo(2.6 * k, 3.5 * k); c.lineTo(0, 6 * k); c.closePath(); c.fill();
      c.strokeStyle = NAVY; c.lineWidth = 1.8 * k;
      if (m === 'happy') { c.beginPath(); c.moveTo(-4.5 * k, 7.5 * k); c.quadraticCurveTo(0, 15 * k, 4.5 * k, 7.5 * k); c.closePath(); c.fillStyle = '#E8455E'; c.fill(); c.stroke(); }
      else if (m === 'shock' || m === 'zap') { c.beginPath(); c.ellipse(0, 10 * k, 2.6 * k, 3.4 * k, 0, 0, TAU); c.fillStyle = '#7A2130'; c.fill(); c.stroke(); }
      else { c.beginPath(); c.arc(-2.3 * k, 6.5 * k, 2.3 * k, 0.1, Math.PI - 0.3); c.arc(2.3 * k, 6.5 * k, 2.3 * k, 0.3, Math.PI - 0.1); c.stroke(); }
      c.strokeStyle = 'rgba(29,43,83,.7)'; c.lineWidth = 1.2 * k;
      c.beginPath();
      for (const sd of [-1, 1]) { c.moveTo(sd * 10 * k, 5 * k); c.lineTo(sd * 22 * k, 3 * k); c.moveTo(sd * 10 * k, 7.5 * k); c.lineTo(sd * 22 * k, 8.5 * k); }
      c.stroke();
      if (m === 'shock' || m === 'worry') {   // 汗珠
        c.fillStyle = '#7FD3FF'; c.strokeStyle = NAVY; c.lineWidth = 1.4 * k;
        const dy = (t * 20) % 8;
        c.beginPath(); c.moveTo(21 * k, -12 * k + dy); c.quadraticCurveTo(26 * k, -4 * k + dy, 21 * k, -2 * k + dy); c.quadraticCurveTo(16 * k, -4 * k + dy, 21 * k, -12 * k + dy); c.fill(); c.stroke();
      }
      c.restore();
    }
    function drawSign(g, c, x, y) {
      const k = L.k, S = F.sign, t = F.t, sz = SIGN * k;
      const shake = S.shake > 0 ? Math.sin(t * 50) * 0.12 * (S.shake / 0.55) : 0;
      const pop = S.mode === 'ans' ? 1 + 0.5 * (1 - oElastic(S.pop)) : 1;
      // “＋ ？”（跟着牌子，但不跟着翻面）
      if (S.mode !== 'ans' && S.fold > 0.5) {
        g.text('＋', x + (PLUS_X - CAT_X) * k, y + 1 * k, { size: Math.round(26 * k), font: 'round', color: '#FFFFFF', stroke: NAVY, strokeW: 4 * k });
        const bx = x + (BOX_X - CAT_X) * k, bs = BOX * k;
        const idleP = F.idleT > 6 ? 0.08 * Math.max(0, Math.sin(t * 8)) : 0;
        const pul = S.slot ? 1 + 0.35 * (1 - oBack(S.slotPop)) : 1 + 0.06 * Math.sin(t * 5) + idleP;
        c.save(); c.translate(bx, y); c.scale(pul, pul);
        if (S.mode !== 'merge') {
          c.beginPath(); rrPath(c, -bs / 2, -bs / 2 + 3 * k, bs, bs, 9 * k); c.fillStyle = 'rgba(29,43,83,.35)'; c.fill();
          c.beginPath(); rrPath(c, -bs / 2, -bs / 2, bs, bs, 9 * k);
          c.fillStyle = S.slot ? '#FFFFFF' : 'rgba(255,255,255,.82)'; c.fill();
          c.setLineDash(S.slot ? [] : [5 * k, 4 * k]); c.lineWidth = 2.6 * k; c.strokeStyle = S.slot ? NAVY : '#3AA0FF'; c.stroke(); c.setLineDash([]);
          if (S.slot) g.text(S.slot, 0, 1 * k, { size: Math.round(32 * k), font: 'kai', weight: 700, color: '#E8533F' });
          else g.text('？', 0, 1 * k, { size: Math.round(28 * k), font: 'round', color: '#3AA0FF' });
        }
        c.restore();
      }
      c.save(); c.translate(x, y); c.rotate(shake); c.scale(Math.max(0.02, S.fold) * pop, pop);
      // 过关光芒
      if (S.mode === 'ans') {
        c.save(); c.rotate(t * 0.8);
        c.fillStyle = 'rgba(255,230,110,.55)';
        for (let i = 0; i < 12; i++) { c.rotate(TAU / 12); c.beginPath(); c.moveTo(-5 * k, -sz * 0.5); c.lineTo(0, -sz * 1.05); c.lineTo(5 * k, -sz * 0.5); c.closePath(); c.fill(); }
        c.restore();
      }
      c.beginPath(); rrPath(c, -sz / 2, -sz / 2 + 4 * k, sz, sz, 9 * k); c.fillStyle = 'rgba(29,43,83,.9)'; c.fill();
      c.beginPath(); rrPath(c, -sz / 2, -sz / 2, sz, sz, 9 * k);
      c.fillStyle = lgrad(c, 'board', 0, -sz / 2, 0, sz / 2, [0, '#FFE2A6', 1, '#EFB463']); c.fill();
      c.lineWidth = 3 * k; c.strokeStyle = NAVY; c.stroke();
      c.beginPath(); rrPath(c, -sz / 2 + 5 * k, -sz / 2 + 5 * k, sz - 10 * k, sz - 10 * k, 6 * k); c.lineWidth = 1.6 * k; c.strokeStyle = 'rgba(160,98,45,.45)'; c.stroke();
      c.fillStyle = '#8A5A33';
      c.beginPath(); c.arc(-sz / 2 + 8 * k, -sz / 2 + 8 * k, 2 * k, 0, TAU); c.arc(sz / 2 - 8 * k, -sz / 2 + 8 * k, 2 * k, 0, TAU); c.fill();
      const fs = Math.round(44 * k), col = '#5A2E0E';
      if (S.mode === 'ans') {
        g.text(F.ans, 0, 1 * k, { size: fs, font: 'kai', weight: 700, color: '#C8321F' });
      } else if (S.mode === 'merge') {
        const e = oCubic(S.mt);
        const P = F.pos, r0x = (BOX_X - CAT_X) * k;
        let rx = 0, ry = 0, rsx = 0.5, rsy = 1, bx2 = 0.16, by2 = 0, bsx = 0.6, bsy = 1;
        if (P === 'L') { rx = -0.26; } else if (P === 'R') { rx = 0.26; bx2 = -0.16; }
        else if (P === 'T') { ry = -0.26; rsx = 1; rsy = 0.5; bx2 = 0; by2 = 0.14; bsx = 1; bsy = 0.6; }
        else if (P === 'B') { ry = 0.26; rsx = 1; rsy = 0.5; bx2 = 0; by2 = -0.14; bsx = 1; bsy = 0.6; }
        else if (P === 'W') { rx = -0.1; ry = 0.06; rsx = 0.95; rsy = 0.95; bx2 = 0.12; by2 = -0.1; bsx = 0.6; bsy = 0.6; }
        else if (P === 'O') { rsx = 1; rsy = 1; bx2 = 0; bsx = 0.5; bsy = 0.5; }
        else if (P === 'I') { ry = 0.1; rsx = 0.45; rsy = 0.45; bx2 = 0; bsx = 1; bsy = 1; }
        c.save(); c.translate(lerp(0, bx2 * sz, e), lerp(0, by2 * sz, e)); c.scale(lerp(1, bsx, e), lerp(1, bsy, e));
        g.text(F.base, 0, 1 * k, { size: fs, font: 'kai', weight: 700, color: col });
        c.restore();
        c.save(); c.translate(lerp(r0x, rx * sz, e), lerp(0, ry * sz, e)); c.scale(lerp(0.75, rsx, e), lerp(0.75, rsy, e));
        g.text(F.rad, 0, 1 * k, { size: fs, font: 'kai', weight: 700, color: '#E8533F' });
        c.restore();
      } else {
        g.text(F.base, 0, 1 * k, { size: fs, font: 'kai', weight: 700, color: col });
      }
      c.restore();
    }
    function drawBubble(g, c) {
      const k = L.k, t = F.t, n = F.hintCh.length;
      const fs = Math.round(40 * k), pfs = Math.round(17 * k), cw = fs * 1.12;
      const tts = ttsOK();
      const bw = Math.max(150 * k, n * cw + 52 * k + (tts ? 20 * k : 0)), bh = L.bubH;
      const bx = clamp(g.w / 2 - bw / 2, 8 * k, g.w - bw - 8 * k), by = L.bubY;
      F.bubRect = { x: bx, y: by, w: bw, h: bh };
      const pop = 0.8 + 0.2 * oBack(F.bubPop);
      const ccx = bx + bw / 2, ccy = by + bh / 2;
      // 想法泡泡的小尾巴：连到小猫的牌子
      signW(Q1);
      const ex = Q1.x + 30 * L.k, ey = Q1.y - SIGN * k / 2 - 2 * k;
      const sx0 = clamp(ex, bx + 24 * k, bx + bw - 24 * k), sy0 = by + bh;
      c.lineWidth = 2.4 * k; c.strokeStyle = NAVY; c.fillStyle = '#FFFFFF';
      for (let i = 0; i < 3; i++) {
        const p = 0.3 + i * 0.28, r = (7 - i * 2) * k;
        const x = lerp(sx0, ex, p), y = lerp(sy0, ey, p) + 4 * k;
        if (y > sy0 + r) { c.beginPath(); c.arc(x, y, r, 0, TAU); c.fill(); c.stroke(); }
      }
      c.save(); c.translate(ccx, ccy + Math.sin(t * 1.6) * 1.5 * k); c.scale(pop, pop); c.translate(-ccx, -ccy);
      const bumps = Math.max(2, Math.floor(bw / (48 * k)));
      const path = () => {
        c.beginPath(); rrPath(c, bx, by, bw, bh, bh * 0.42);
        for (let i = 0; i < bumps; i++) {
          const x = bx + bh * 0.4 + (bw - bh * 0.8) * (i + 0.5) / bumps;
          c.moveTo(x + 17 * k, by + 9 * k); c.arc(x, by + 9 * k, 17 * k, 0, TAU);
        }
      };
      c.save(); c.translate(0, 4 * k); path(); c.fillStyle = 'rgba(29,43,83,.3)'; c.fill(); c.restore();
      path(); c.lineWidth = 6 * k; c.strokeStyle = NAVY; c.stroke(); c.fillStyle = '#FFFFFF'; c.fill();
      // 字：缺的字挖空（上面标拼音）
      const x0 = bx + 26 * k, yC = by + bh * 0.63, yP = by + bh * 0.22;
      const rv = F.reveal > 0 ? oBack(Math.min(1, F.reveal)) : 0;
      for (let i = 0; i < n; i++) {
        const ch = F.hintCh[i], x = x0 + cw * (i + 0.5);
        if (ch === F.ans) {
          g.text(F.py, x, yP, { size: pfs, font: 'py', color: '#E8533F', maxW: cw * 1.25 });
          if (rv > 0) {
            c.save(); c.translate(x, yC); c.scale(rv, rv);
            g.text(F.ans, 0, 0, { size: fs, font: 'kai', weight: 700, color: '#E8533F' });
            c.restore();
          } else {
            const s = cw * 0.84, wob = F.idleT > 6 ? Math.sin(t * 9) * 0.05 : 0;
            c.save(); c.translate(x, yC); c.rotate(wob);
            c.beginPath(); rrPath(c, -s / 2, -s / 2, s, s, 6 * k);
            c.fillStyle = '#EAF6FF'; c.fill();
            c.setLineDash([5 * k, 4 * k]); c.lineWidth = 2.2 * k; c.strokeStyle = '#3AA0FF'; c.stroke(); c.setLineDash([]);
            c.restore();
          }
        } else {
          g.text(ch, x, yC, { size: fs, font: 'kai', weight: 700, color: NAVY });
        }
      }
      if (tts) g.emoji('🔊', bx + bw - 22 * k, by + 20 * k, 18 * k, { alpha: g.speaking ? 1 : 0.75 });
      c.restore();
    }
    function drawFront(g, c) {
      const w = g.w, k = L.k;
      c.globalAlpha = 0.4;
      c.beginPath(); c.moveTo(-10, waveY(-10));
      for (let x = -10; x <= w + 12; x += 12) c.lineTo(x, waveY(x));
      for (let x = w + 12; x >= -10; x -= 24) c.lineTo(x, waveY(x) + 16 * k);
      c.closePath(); c.fillStyle = F.P.w[1]; c.fill();
      c.globalAlpha = 1;
      c.strokeStyle = 'rgba(255,255,255,.85)'; c.lineWidth = 2.6 * k;
      c.beginPath();
      for (let x = -10; x <= w + 12; x += 12) { const y = waveY(x) - 0.5; if (x === -10) c.moveTo(x, y); else c.lineTo(x, y); }
      c.stroke();
    }
    function drawAim(g, c) {
      const k = L.k, H = F.hook, t = F.t;
      if (F.kb && H.st === 'idle' && !F.solved && g.state === 'play') {
        const x = F.tip.x;
        c.setLineDash([6 * k, 7 * k]); c.lineDashOffset = -t * 30;
        c.strokeStyle = 'rgba(255,255,255,.55)'; c.lineWidth = 2 * k;
        c.beginPath(); c.moveTo(x, waveY(x) + 10 * k); c.lineTo(x, L.fBot); c.stroke();
        c.setLineDash([]); c.lineDashOffset = 0;
        for (const f of F.fish) {
          if (!catchable(f)) continue;
          if (Math.abs(f.x - x) < fishLen(f) * 0.5) ring(c, f.x, f.y, fishLen(f) * 0.58, '#FFE45C', t);
        }
      }
      const hv = F.hover;
      if (hv && H.st === 'idle' && !F.solved && (hv.st === 'swim' || hv.st === 'enter')) ring(c, hv.x, hv.y, hv.lab ? fishLen(hv) * 0.58 : 34 * k, '#FFFFFF', t);
    }
    function ring(c, x, y, r, col, t) {
      c.save();
      c.globalAlpha = 0.55 + 0.3 * Math.sin(t * 8);
      c.setLineDash([8 * L.k, 6 * L.k]); c.lineDashOffset = -t * 40;
      c.lineWidth = 3 * L.k; c.strokeStyle = col;
      c.beginPath(); c.ellipse(x, y, r, r * 0.62, 0, 0, TAU); c.stroke();
      c.restore();
    }
    function drawFly(g, c) {
      const fl = F.fly;
      if (!fl) return;
      const p = Math.min(1, fl.t / fl.d), s = fl.s * (1 + 0.3 * Math.sin(p * Math.PI));
      c.save(); c.translate(fl.x, fl.y); c.rotate(Math.sin(p * Math.PI) * 0.4);
      c.fillStyle = 'rgba(255,240,150,.45)'; c.beginPath(); c.arc(0, 0, 34 * L.k * s, 0, TAU); c.fill();
      c.restore();
      drawBadge(g, c, fl.ch, fl.x, fl.y, s, '#FFC928');
    }
    function drawFinger(g, c) {
      if (g.state !== 'play' || F.solved || F.tapped || F.hook.st !== 'idle') return;
      const k = L.k, t = F.t;
      const tutorial = g.level === 1 && F.qi === 0 && F.qT > 0.8;
      if (!tutorial) return;
      let tgt = null;
      for (const f of F.fish) if (f.st === 'swim' && f.lab === F.rad && !f.decoy && f.x > 40 * k && f.x < g.w - 40 * k) { tgt = f; break; }
      if (!tgt) return;
      ring(c, tgt.x, tgt.y, fishLen(tgt) * 0.62, '#FFE45C', t);
      const bob = Math.abs(Math.sin(t * 5)) * 12 * k;
      const fx = tgt.x + 6 * k, fy = tgt.y + fishHt(tgt) * 0.5 + 26 * k + bob;
      g.emoji('👆', fx, fy, 44 * k, { alpha: 0.7 + 0.3 * Math.sin(t * 10) });
      g.text('点它！', fx + 44 * k, fy + 6 * k, { size: Math.round(18 * k), font: 'round', color: '#FFFFFF', stroke: NAVY, strokeW: 4 * k });
    }

    /* ================= spec ================= */
    const spec = {
      name: '偏旁钓鱼', icon: '🎣',
      maxLevel: 10, lives: 3, rounds: 8, music: 'bright', sky: 'sea',
      intro: '钓起对的偏旁鱼，和小猫牌子上的字拼出泡泡里的字！',
      controls: '点鱼下钩 · 键盘 ←→ 移船、空格下钩',
      init(g) {
        g.sky = null;   // 场景全部自己画（选关界面仍用引擎的 sea 背景）
        const valid = (b) => !!b && !!str(b.base) && !!str(b.rad) && !!str(b.ans) && Array.isArray(b.opts) &&
          b.opts.length >= 2 && b.opts.map(str).indexOf(str(b.rad)) >= 0;
        let list = g.items('build', g.rounds).filter(valid);
        if (!list.length) list = (Array.isArray(g.G.build) ? g.G.build : []).filter(valid).slice(0, g.rounds);
        g.rounds = Math.max(1, Math.min(g.rounds, list.length || 1));
        const pal = palOf(g.level);
        F = {
          list, qi: 0, item: null, t: 0, qT: 0, idleT: 0, lastDraw: 0, timers: [],
          P: PAL[pal], lanes: [], fish: [], boots: [], jellies: [],
          boat: { x: g.w * 0.5, vx: 0, tx: null, rock: 0, rockV: 0, by: 0, ang: 0, cs: 1, sn: 0 },
          hook: { st: 'idle', t: 0, x: 0, y: 0, fish: null, boot: null, carry: null, tx: 0, ty: 0, said: false },
          cat: { mood: 'idle', moodT: 0, jump: 0, jv: 0, squash: 1, blinkT: 2, blink: 0 },
          sign: { mode: 'q', slot: '', slotPop: 1, mt: 0, pop: 1, shake: 0, fold: 1, foldV: 0 },
          tip0: { x: 0, y: 0 }, tip: { x: 0, y: 0 }, bend: 0, bendKick: 0, reelA: 0, tickT: 0,
          fly: null, reveal: 0, bubPop: 1, bubRect: null, hover: null, kb: false, solved: false, tapped: false, qWrong: false,
          turnP: lvv(LV.turn, g.level), turnT: lvv(LV.turn, g.level),
          bubs: [], bi: 0, ambT: 0,
          clouds: [], stars: [], lanterns: [], farFish: [], weeds: [], plank: [], city: [],
          crab: { x: g.w * 0.3, dir: 1 }, chest: { x: 0.84, t: rnd(0, 4) }
        };
        for (let i = 0; i < 90; i++) F.bubs.push({ on: false, x: 0, y: 0, r: 0, vy: 0, ph: 0, age: 0, life: 1 });
        for (let i = 0; i < 5; i++) F.clouds.push({ x: Math.random(), y: rnd(0.05, 0.75), s: rnd(0.45, 0.85), v: rnd(5, 14), a: rnd(0.7, 1) });
        for (let i = 0; i < 60; i++) F.stars.push({ x: Math.random(), y: Math.random(), r: rnd(0.6, 1.8), ph: rnd(0, TAU), sp: rnd(1, 3) });
        for (let i = 0; i < 4; i++) F.lanterns.push({ x: (i + 0.5) / 4 + rnd(-0.08, 0.08), p: Math.random(), v: rnd(6, 11), s: rnd(0.7, 1.1), ph: rnd(0, TAU) });
        for (let i = 0; i < 5; i++) F.farFish.push({ p: Math.random(), y: rnd(0.1, 0.9), v: rnd(10, 22) * (i % 2 ? 1 : -1), s: rnd(0.7, 1.2), ph: rnd(0, TAU) });
        for (let i = 0; i < 8; i++) F.weeds.push({ x: (i + rnd(0.15, 0.85)) / 8, h: rnd(0.4, 1), ph: rnd(0, TAU), c: ['#2FA36B', '#3BBF7A', '#1E8C5A'][i % 3] });
        for (let i = 0; i < 36; i++) F.plank.push({ x: Math.random(), y: Math.random(), r: rnd(0.8, 2), ph: rnd(0, TAU), sp: rnd(1, 3) });
        g.F = F;
        W.__fish = g;
        layout(g);
        makeCity(g);
        F.lanes = makeLanes(g);
        F.boat.x = clamp(g.w * 0.5, L.bMin, L.bMax);
        for (let i = 0; i < lvv(LV.boots, g.level); i++) {
          F.boots.push({ st: 'swim', x: rnd(0.1, 0.9) * g.w, y: 0, baseY: rnd(L.fTop + 20 * L.k, L.fBot - 20 * L.k), dir: Math.random() < 0.5 ? -1 : 1, v: rnd(18, 30) * L.k, rot: 0, ph: rnd(0, TAU), vx: 0, vy: 0, spin: 0, respawn: 0 });
        }
        for (let i = 0; i < lvv(LV.jelly, g.level); i++) {
          const r = 24 * L.k;
          F.jellies.push({ x: ((i + 0.5) / Math.max(1, lvv(LV.jelly, g.level))) * g.w + rnd(-30, 30), y: 0, r, cy: (L.fTop + L.fBot) / 2, amp: Math.max(0, (L.fBot - L.fTop) / 2 - r),
            f: rnd(0.32, 0.5), ph: rnd(0, TAU), vx: rnd(10, 22) * L.k * (Math.random() < 0.5 ? -1 : 1), pulse: rnd(0, TAU), zapT: 0, boing: 0, st: 'swim' });
        }
        pose();
        toW(ROD_TIP_X * L.k, ROD_TIP_Y * L.k, F.tip0);
        F.tip.x = F.tip0.x; F.tip.y = F.tip0.y;
        F.hook.x = F.tip0.x; F.hook.y = waveY(F.tip0.x) + 26 * L.k;
        if (list.length) startQuestion(g, 0);
        else { F.item = null; F.base = '？'; F.rad = ''; F.ans = ''; F.py = ''; F.hint = ''; F.hintCh = []; F.pos = 'L'; }
        step(g, 0.001, false);
      },
      play(g) { if (F) { F.qT = 0; F.idleT = 0; } },
      update(g, dt) { step(g, dt, true); },
      draw(g, c) {
        if (!F) return;
        const tn = nowS();
        const dt = F.lastDraw ? clamp(tn - F.lastDraw, 0, 0.05) : 0;
        F.lastDraw = tn;
        if (g.state === 'intro' || g.state === 'over') step(g, dt, false);
        /* 竿尖（带弯曲）：朝鱼钩方向被拉弯 */
        const H = F.hook, k = L.k;
        const bend = F.bend + F.bendKick * 0.6;
        const dx = H.x - F.tip0.x, dy = H.y - F.tip0.y, d = Math.hypot(dx, dy) || 1;
        F.tip.x = F.tip0.x + dx / d * 18 * k * bend; F.tip.y = F.tip0.y + dy / d * 18 * k * bend + 6 * k * bend;
        if (H.st === 'reel' || H.st === 'fight' || H.st === 'haul') F.reelA += 0.5; else if (H.st === 'cast') F.reelA -= 0.3;
        drawSky(g, c);
        drawWater(g, c);
        drawSeabed(g, c);
        drawBubbles(g, c);
        for (const j of F.jellies) drawJelly(g, c, j);
        for (const b of F.boots) if (b.st === 'swim') drawBoot(g, c, b);
        for (const f of F.fish) if (f.st !== 'leap' && f.st !== 'hooked') drawFish(g, c, f);
        drawAim(g, c);
        drawLineAndHook(g, c);
        for (const f of F.fish) if (f.st === 'hooked') drawFish(g, c, f);
        for (const b of F.boots) if (b.st === 'hooked') drawBoot(g, c, b);
        drawBubble(g, c);
        drawBoatGroup(g, c);
        drawFront(g, c);
        for (const f of F.fish) if (f.st === 'leap') drawFish(g, c, f);
        for (const b of F.boots) if (b.st === 'fling') drawBoot(g, c, b);
        drawFly(g, c);
        drawFinger(g, c);
      },
      down(g, p) {
        if (!F || g.state !== 'play') return;
        const k = L.k, H = F.hook;
        F.kb = false;
        const br = F.bubRect;
        if (br && p.x >= br.x && p.x <= br.x + br.w && p.y >= br.y && p.y <= br.y + br.h) {
          if (ttsOK() && !g.speaking) g.say(F.hint);
          return;
        }
        if (F.solved || !F.item) return;
        if (H.st !== 'idle' && H.st !== 'return') return;
        if (p.y < L.sy - 6 * k) return;
        const f = fishAt(g, p.x, p.y, 16 * k);
        if (f) { cast(g, f, null, 0, 0); return; }
        const b = bootAt(g, p.x, p.y, 12 * k);
        if (b) { cast(g, null, b, 0, 0); return; }
        const j = jellyAt(p.x, p.y, 8 * k);
        if (j) { j.boing = 1; g.sfx('bubble'); return; }
        if (p.y > L.sy + 10 * k) cast(g, null, null, p.x, Math.min(p.y, L.fBot + 10 * k));
      },
      move(g, p) {
        if (!F || g.state !== 'play') return;
        if (p.down || p.type !== 'mouse') { F.hover = null; return; }
        const k = L.k;
        const h = fishAt(g, p.x, p.y, 16 * k) || bootAt(g, p.x, p.y, 12 * k);
        if (h !== F.hover) {
          F.hover = h;
          try { g.c.canvas.style.cursor = h ? 'pointer' : ''; } catch (e) { /* ignore */ }
        }
      },
      key(g, key) {
        if (!F || g.state !== 'play') return;
        const H = F.hook;
        if (key === 'left' || key === 'right') { F.kb = true; return; }
        if (key === 'space' || key === 'down' || key === 'enter') {
          F.kb = true;
          if (F.solved || !F.item) return;
          if (H.st !== 'idle' && H.st !== 'return') return;
          cast(g, null, null, F.tip0.x, L.fBot + 12 * L.k);
          F.boat.tx = null;
        } else if (key === 'up') {
          if (H.st === 'cast') { H.fish = null; H.boot = null; setH('return'); }
        }
      },
      resize(g) { layout(g); relane(g); },
      end() { if (W.__fish && W.__fish.F === F) W.__fish = null; F = null; }
    };
    return spec;
  }

  HW.register({
    id: 'fishing', skill: 'write', kind: 'arcade', name: '偏旁钓鱼', blurb: '钓起偏旁鱼，拼出新汉字', icon: '🎣',
    needs: [], cols: ['build'], data: ['build'],
    start(ctx) {
      if (!HW.arcade || typeof HW.arcade.run !== 'function') {
        try { ctx.el.textContent = '游戏引擎没有加载，先玩别的吧。'; } catch (e) { /* ignore */ }
        return function () {};
      }
      return HW.arcade.run(ctx, makeSpec(ctx));
    }
  });
})();
