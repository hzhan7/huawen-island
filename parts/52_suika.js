/* =====================================================================
 * 华文小岛 3.0 · 街机游戏：🫙 合成大汉字（id: suika · skill: write）
 * 规格：SPEC_V3.md；设计：research/GAME_SHORTLIST.md ①；引擎：parts/15_arcade.js（HW.arcade.run）。
 *
 * ── 代码来源与许可 ──
 *   · 手感参数（墙的摩擦 0.006 / 静摩擦 0.006 / 空气阻力 0 / 弹性 0.1、墙厚 64、丢下后 500ms 才能再丢；
 *     球的摩擦调大到 0.08 / 0.6，原因见 BALL 常量）、
 *     “碰撞开始 → 两个都标记 popped → 在中点生成合成物”的合并流程、mulberry32 随机数，
 *     移植自 moonfloof/suika-game（https://github.com/moonfloof/suika-game ，index.js）。
 *     许可：Unlicense（该仓库 LICENSE：“This license applies to index.js, index.html, and all files in the
 *     assets folder.” —— “This is free and unencumbered software released into the public domain.”）。
 *     Unlicense 不要求保留署名，这里照样注明来源；LICENSE 原文见仓库根目录 THIRD_PARTY_NOTICES.md。
 *     （原作的图片 / 音效一律没用：球、罐子、云朵都用 Canvas 重画，音效用引擎的 WebAudio 合成。）
 *   · 物理引擎：matter.js 0.20.0（https://github.com/liabru/matter-js ），MIT License，
 *     Copyright (c) Liam Brummitt and contributors。
 *     运行时从 cdnjs 加载（与 57_sling 共用 window.__hwMatterP，整页只加载一次），不内嵌、不复制它的源码；
 *     cdnjs 上的 matter.min.js 自带 “matter-js 0.20.0 by @liabru … License MIT” 版权头。MIT 全文见 THIRD_PARTY_NOTICES.md。
 *     不用 Matter.Render / MouseConstraint，物理在 update 里 Engine.update，画面在 draw 里自己画。
 *   · 玩法参考 kusazh/hanzi（https://github.com/kusazh/hanzi ，没有许可证 → 只借“部件一碰就成字”的玩法，
 *     没有复制它的任何代码、字典或字体）。
 *
 * ── 玩法 ──
 *   上方的小云朵举着一个“部件球”（氵、青、日……），孩子左右瞄准后丢进汉字罐。
 *   罐子里本来就有一些部件（海鸥会一直往里送）：丢下去的部件碰到能和它组成字的搭档（氵+青 → 清，按规范字形的
 *   一级拆分）就“啵”地合成金色字球，朗读“清，清水的清”，字球飞进上方的字卡架点亮这张卡。合成够本关的数量就过关。
 *   · 云朵给的部件，罐子里（够得着的表层）一般只有一个搭档；按权重挑：架子上的字卡 ×1、已换走的字卡 ×0.3、
 *     罐子里干扰部件的搭档 ×0.08（合出来的字不在架子上也算进度）。最新送来的两个球、堆得最高的球权重压低，很少被选成搭档；
 *     搭档没了（持续 0.6 秒）云朵会“换一个”，实在换不了才叫海鸥送搭档——同时再来一只（P3 起两只）海鸥送干扰部件，
 *     谁最后到随机（否则“丢到海鸥刚送来的球上”不识字也能中）。
 *     长得像的 口/囗、日/曰、未/末、礻/衤… 不同时出现；已经在罐子里的部件不再送第二个。
 *   · 丢下的部件只在“落地那一下”（第一次碰到东西后 0.25 秒内）能合；没碰上搭档当场变灰色石头（占地方、再也合不了）。
 *     云朵口袋里的部件有限（🎒 还剩 N 个）：乱丢的孩子先把部件用完或把罐子堆过红线 → 输；输了把没合成的字的配方（楷体）摆出来。
 *   · 连续合成攒“爆竹”🧨（丢下去炸掉一片石头）；刚合成的字有时会让云朵递来能和它组词的字（忠 → 心：“忠心”），
 *     碰上就“词语爆破”，还会震碎旁边的石头。两个一样的字（哥哥、星星）不爆破。
 *   · 叠字（木+木=林）= 换皮（色块也能配），不进合并表：只在 P2 第 1 关当教学卡，合成一次就换走，之后两个一样的部件不会合。
 *   · P2 更友好：字卡带拼音、每关 3 次💡提示、前两次有手指带着丢、口袋更宽裕、一次“救命泡泡”、海鸥送得慢。
 *   · 关卡越高：本关要合成的字越多（P2 10→19，P4 13→27）、海鸥送得越快、云朵等得越短（等太久会自己丢 = g.miss）、口袋越紧。
 *   · 朗读：“晴，晴天的晴”；多音字（漂 种 悄 炸 钉 地 空 …，见 POLY）单念可能念错，只念词“漂亮”。
 * ── 五关（2026-09-19 第二轮试玩挑刺实测：build/_v3_r_suika，真实 content/ext_recipes.json（P2–P6 均 fromRecipes），
 *    手机用 index.html 真视口 390×844（dist.html 没有 viewport，手机模拟会按 980 宽排版）+ 电脑 1280×800；
 *    真指针 / 真按键 + 4 倍速批量试玩 gen/sim.js，2 秒丢一个）──
 *   换皮 / 套路：配对关系就是汉字知识，颜色按部件散列与配对无关；叠字只在 P2 第 1 关教学。不识字的套路玩家：
 *         “专丢最新送来的球”P2/P4/P6 第 1 关 0/32 胜（命中 0.21–0.25）；“专丢最高的球”P2–P5 第 1 关 0/48 胜（0.26–0.35）。
 *   乱按：随机丢 P2/P3/P5/P6 第 1 关 0/40 胜（命中 0.23–0.31，2 秒一个 38–50 秒输）；狂点（0.7 秒一个）P2 0/8 胜、约 15 秒输。
 *         七成半丢得准的第 1 关 23/24 胜（P2、P4）；瞄准搭档丢的 P6 第 10 关 6/6 胜（0.89）；真指针 P2–P6 各一局全过。
 *   后果：丢错 = 罐子里多一块石头、口袋少一个部件、断连击（游戏内后果，不弹 ✗）；石头多了星星少，≥2 星才解锁下一关。
 *   错题本：合成是物理碰撞自动发生的 → 只记掌握，从不 g.wrong（上面所有局 wrong=0）。孩子自己丢的部件参与的合成 / 爆破
 *           才带 item（题库对象浅拷贝 + hz）；罐子里自己碰上的、云朵等太久自己丢的，只给进度不记掌握（g.right(null)）。
 *           手没跟上（云朵等太久自己丢）→ g.miss。星星按“变成石头的个数”算（spec.stars）。
 * ── 数据 ──
 *   配方：HW_DATA[年级].recipes（{a,b,ans,py,word}），不够 20 条再并入更低年级；再并入本年级 build
 *         （rad+base→ans，word=hint）。recipes 没生成时只用 build + 内置叠字 TEACH（兜底）。
 *   词语爆破：本年级及以下 words.w / chars.words / recipes.word / build.hint 里、两个字都在配方表里、两字不同的二字词。
 * ── 操作 ──
 *   触屏 / 鼠标：拖动（或悬停）瞄准，松手 / 点击丢下；点 💡 看提示；点字卡 = 听这个字（不丢球）。
 *   云朵等太久自己丢时，孩子手指还按着也不会在松手时再丢一个。
 *   键盘：← → 移动（A/D 微调），空格 / ↓ / 回车 丢下，↑ 或 H 提示。
 * 调试：window.__suika = { g, F, api, DATA }（api.auto('random'|'smart') 自动试玩、api.speed(n) 加速、api.info()）；
 *       window.__suikaTune = {lv, ...} 只给测试脚本调参用。
 * ===================================================================== */
(function () {
  'use strict';
  const W = window, D = document;
  const HW = W.HW;
  if (!HW || typeof HW.register !== 'function') return;

  const TAU = Math.PI * 2;
  const NAVY = '#1d2b53';
  const str = (v) => (v == null ? '' : String(v));
  const cps = (s) => Array.from(str(s));
  const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
  const lerp = (a, b, t) => a + (b - a) * t;
  const nowMs = () => (W.performance && performance.now ? performance.now() : Date.now());
  const oBack = (t) => { const s = 1.9, u = t - 1; return u * u * ((s + 1) * u + s) + 1; };
  const oCubic = (t) => { const u = 1 - t; return 1 - u * u * u; };
  const isHan = (ch) => {
    if (!ch) return false;
    const c = ch.codePointAt(0);
    return (c >= 0x2E80 && c <= 0x2FDF) || (c >= 0x31C0 && c <= 0x31EF) || (c >= 0x3400 && c <= 0x4DBF) ||
      (c >= 0x4E00 && c <= 0x9FFF) || (c >= 0xF900 && c <= 0xFAFF) || (c >= 0x20000 && c <= 0x3134F);
  };
  const pk = (a, b) => (a < b ? a + '' + b : b + '' + a);   // 无序配对键
  function hashStr(s) { let x = 7; for (const ch of str(s)) x = (Math.imul(x, 31) + ch.codePointAt(0)) >>> 0; return x; }

  /* moonfloof/suika-game：mulberry32（Unlicense） */
  function mulberry32(a) {
    return function () {
      let t = a += 0x6D2B79F5;
      t = Math.imul(t ^ t >>> 15, t | 1);
      t ^= t + Math.imul(t ^ t >>> 7, t | 61);
      return ((t ^ t >>> 14) >>> 0) / 4294967296;
    };
  }
  const rand = mulberry32((Date.now() ^ 0x5eed) >>> 0);
  const rnd = (a, b) => a + rand() * (b - a);
  const pickOne = (arr) => (arr && arr.length ? arr[Math.floor(rand() * arr.length)] : undefined);
  function shuffle(arr) { const a = Array.from(arr || []); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rand() * (i + 1)); const t = a[i]; a[i] = a[j]; a[j] = t; } return a; }

  /* ---------- matter.js 加载（SPEC_V3 §2；与 sling 共用 window.__hwMatterP；失败后允许重试） ---------- */
  const MATTER_URL = 'https://cdnjs.cloudflare.com/ajax/libs/matter-js/0.20.0/matter.min.js';
  function loadMatter() {
    if (W.Matter) return Promise.resolve(W.Matter);
    if (!W.__hwMatterP) {
      const p = new Promise((res, rej) => {
        const s = D.createElement('script');
        s.src = MATTER_URL;
        s.onload = () => (W.Matter ? res(W.Matter) : rej(new Error('matter.js 没有挂到 window')));
        s.onerror = () => { try { s.remove(); } catch (e) { /* ignore */ } rej(new Error('matter.js 加载失败')); };
        (D.head || D.documentElement).appendChild(s);
      });
      W.__hwMatterP = p;
      p.catch(() => { if (W.__hwMatterP === p) W.__hwMatterP = null; });
    }
    return W.__hwMatterP;
  }

  /* ---------- 物理常量（罐子内部的逻辑坐标；画面按比例缩放） ---------- */
  const JW = 540, JH = 660;        // 罐子内部宽高（逻辑单位，与原作 640 宽画布同一尺度）
  const RED = 125;                 // 红线 y（逻辑）
  const WALL = 64;                 // moonfloof：wallPad = 64
  const PHYS = { friction: 0.006, frictionStatic: 0.006, frictionAir: 0, restitution: 0.1 };   // moonfloof：friction（墙用这组）
  // 球：比原作“黏”一些（原作 0.006 会一路滚），落在哪儿基本就停在哪儿 → 合不合得上由孩子瞄准决定，
  // 乱丢时顺坡滚过去“蹭”上搭档的机会少很多（自动试玩实测：乱丢命中率 0.40 → 0.32，会玩的仍是 1.00）
  const BALL = { friction: 0.08, frictionStatic: 0.6, frictionAir: 0, restitution: 0.1 };
  const DROP_COOL = 0.5;           // moonfloof：丢下后 500ms 才出现下一个
  // 丢下去的部件只在“落地那一下”（第一次碰到东西后的 0.25 秒内）能合；没碰上搭档就当场变石头。
  // 否则球落地后顺着坡滚来滚去，总能蹭上搭档——实测乱丢（1.7 秒丢一个）命中率 0.52–0.83，P2 第 1 关乱丢都能过。
  const LAND_WIN = 0.25;
  const STEP_MS = 1000 / 60, STEP = STEP_MS / 1000;

  /* ---------- 叠字教学配方（只在第 1 关当教学用；都是规范字形的一级拆分） ---------- */
  const TEACH = [
    { a: '木', b: '木', ans: '林', py: 'lín', word: '树林', g: 2 },
    { a: '月', b: '月', ans: '朋', py: 'péng', word: '朋友', g: 2 },
    { a: '可', b: '可', ans: '哥', py: 'gē', word: '哥哥', g: 2 },
    { a: '夕', b: '夕', ans: '多', py: 'duō', word: '多少', g: 2 }
  ];

  /* ---------- 每个年级 × 关卡的参数（P2 明显更友好） ---------- */
  function P(gn, lv) {
    const t = (clamp(lv, 1, 10) - 1) / 9;
    const i = clamp(lv, 1, 10) - 1;
    // rounds = 本关要合成几个字；bag = 云朵口袋里一共几个部件（乱丢的孩子会先用完）；feed = 海鸥送部件的间隔（秒）
    if (gn <= 2) return {
      rPart: 43, K: [4, 4, 4, 5, 5, 5, 5, 6, 6, 6][i], partnerP: 1, rounds: 9 + lv, bagMul: 1.4, bagAdd: 3,   // 口袋 1.35/+2 → 1.4/+3：七成半丢得准的 P2 第 1 关原来 4 局只赢 2 局；+4 时乱丢 / 套路 12 局能蒙赢 1–2 局
      feed: lerp(6.5, 4.4, t), autoDrop: lerp(12, 8, t), charLife: 1.1, grace: 4, rescue: 1, hints: 3,
      wordP: 0.45, bombEvery: 3, bombR: 180, teach: lv === 1 ? 1 : 0, cardPy: true, popT: 5, decoys: 6, tutDrops: lv === 1 ? 2 : 0, rotN: 2
    };
    if (gn === 3) return {
      rPart: 43, K: [4, 5, 5, 5, 6, 6, 6, 7, 7, 7][i], partnerP: 1, rounds: 10 + Math.round(lv * 1.5), bagMul: lerp(1.45, 1.36, t), bagAdd: 2,
      feed: lerp(5.5, 3.8, t), autoDrop: lerp(10, 6, t), charLife: 3, grace: 3.5, rescue: 0, hints: 2,
      wordP: 0.55, bombEvery: 3, bombR: 160, teach: 0, cardPy: true, popT: 6, decoys: 7, tutDrops: lv === 1 ? 1 : 0, rotN: 2, heldDecoys: 2
    };
    return {
      rPart: gn === 4 ? 41 : 40, K: [5, 5, 6, 6, 6, 7, 7, 7, 8, 8][i], partnerP: 1,
      rounds: 11 + Math.round(lv * 1.6) + (gn >= 5 ? 2 : 0), bagMul: lerp(1.42, 1.32, t), bagAdd: 2,
      feed: lerp(5, 3, t), autoDrop: lerp(8, 4.5, t), charLife: 6, grace: 3, rescue: 0, hints: 1,
      wordP: 0.6, bombEvery: 3, bombR: 150, teach: 0, cardPy: false, popT: 7, decoys: 8, tutDrops: lv === 1 ? 1 : 0, rotN: 2, heldDecoys: 2
    };
  }

  /* ---------- 题库 → 配方表 / 词表 ---------- */
  function normRec(o, gk, extra) {
    if (!o || typeof o !== 'object') return null;
    const a = str(o.a).trim(), b = str(o.b).trim(), ans = str(o.ans).trim();
    if (cps(a).length !== 1 || cps(b).length !== 1 || cps(ans).length !== 1) return null;
    if (!isHan(a) || !isHan(b) || !isHan(ans) || a === ans || b === ans) return null;
    const word = str(o.word != null ? o.word : o.hint).trim();
    return Object.assign({ a, b, ans, py: str(o.py).trim(), word: word.indexOf(ans) >= 0 ? word : '', src: o, g: gk, teach: false }, extra || {});
  }
  function buildData(gn) {
    const ALL = (W.HW_DATA && typeof W.HW_DATA === 'object') ? W.HW_DATA : {};
    const GD = (k) => (ALL['p' + k] && typeof ALL['p' + k] === 'object' ? ALL['p' + k] : {});
    const arr = (v) => (Array.isArray(v) ? v : []);
    const pool = [], seen = new Set();
    let nRecipes = 0;
    function add(r) {
      if (!r) return null;
      const key = r.ans + '|' + pk(r.a, r.b);
      if (seen.has(key)) return null;
      seen.add(key); pool.push(r); return r;
    }
    function addRecipes(k) {
      arr(GD(k).recipes).forEach((o) => {
        if (add(normRec(o, k))) nRecipes++;
        arr(o && o.chains).forEach((c) => { if (add(normRec(c, k, { chain: true }))) nRecipes++; });
      });
    }
    addRecipes(gn);
    for (let k = gn - 1; k >= 2 && pool.length < 20; k--) addRecipes(k);
    arr(GD(gn).build).forEach((o) => add(normRec({ a: o && o.rad, b: o && o.base, ans: o && o.ans, py: o && o.py, word: o && o.hint }, gn, { src: o })));
    for (let k = gn - 1; k >= 2 && pool.length < 12; k--) arr(GD(k).build).forEach((o) => add(normRec({ a: o && o.rad, b: o && o.base, ans: o && o.ans, py: o && o.py, word: o && o.hint }, k, { src: o })));
    // 叠字（木+木=林）：“两个一样就合”本身就是换皮（色块也能配），所以叠字不进合并表，
    // 只在 P2 第 1 关当教学卡用（见 setupLevel / pairRec），这张卡合成一次就换走，之后两个一样的部件碰到一起不会合。
    // 题库里有叠字就用题库的；没有 recipes（兜底）时才用内置的 TEACH。
    const teach = pool.filter((r) => r.a === r.b);
    if (!teach.length && gn <= 2) {
      TEACH.forEach((o) => {
        if (o.g > gn) return;
        const r = normRec(o, o.g);
        if (!r || seen.has(r.ans + '|' + pk(r.a, r.b))) return;
        seen.add(r.ans + '|' + pk(r.a, r.b)); teach.push(r);
      });
    }
    for (let i = pool.length - 1; i >= 0; i--) if (pool[i].a === pool[i].b) pool.splice(i, 1);
    // 合并表：无序配对 → 配方数组（同一对部件能合成不同字时，优先本关正在出的）
    const table = new Map(), partners = new Map(), comps = new Set();
    const all = pool.concat(teach);
    pool.forEach((r) => {
      const key = pk(r.a, r.b);
      if (!table.has(key)) table.set(key, []);
      if (!table.get(key).some((x) => x.ans === r.ans)) table.get(key).push(r);
      comps.add(r.a); comps.add(r.b);
      const pa = partners.get(r.a) || []; pa.push({ other: r.b, rec: r }); partners.set(r.a, pa);
      if (r.a !== r.b) { const pb = partners.get(r.b) || []; pb.push({ other: r.a, rec: r }); partners.set(r.b, pb); }
    });
    const chainable = new Set();
    all.forEach((r) => { if (comps.has(r.ans)) chainable.add(r.ans); });
    // 词语爆破：本年级及以下的二字词（至少一个是合成出来的字）
    const words = new Map();
    const inBoard = new Set(); comps.forEach((c) => inBoard.add(c)); all.forEach((r) => inBoard.add(r.ans));
    function addW(w, item, py) {
      const cs = cps(str(w).trim());
      if (cs.length !== 2 || !isHan(cs[0]) || !isHan(cs[1])) return;
      if (cs[0] === cs[1]) return;   // 哥哥 / 星星：两个一样的字球碰一下就爆 = 换皮，不要
      if (!inBoard.has(cs[0]) || !inBoard.has(cs[1])) return;
      const key = pk(cs[0], cs[1]);
      if (!words.has(key)) words.set(key, { w: cs.join(''), item: item || null, py: py || '' });
    }
    for (let k = 2; k <= gn; k++) {
      const G = GD(k);
      arr(G.words).forEach((it) => { if (it && it.w) addW(it.w, it, it.py); });
      arr(G.chars).forEach((it) => arr(it && it.words).forEach((w) => addW(w)));
      arr(G.recipes).forEach((it) => addW(it && it.word));
      arr(G.build).forEach((it) => addW(it && it.hint));
    }
    teach.forEach((r) => addW(r.word));
    // 教学关优先用 P2 最常见的叠字（林 朋 哥 多），其余叠字靠后
    const pref = ['林', '朋', '哥', '多', '双', '从'];
    teach.sort((x, y) => (pref.indexOf(x.ans) < 0 ? 99 : pref.indexOf(x.ans)) - (pref.indexOf(y.ans) < 0 ? 99 : pref.indexOf(y.ans)));
    return { pool, teach, table, partners, chainable, words, nRecipes, fromRecipes: nRecipes > 0, all };
  }

  /* ---------- 长得几乎一样的部件：在小球上分不清，不能同时出现在罐子里（否则孩子认对了也会“丢错”） ---------- */
  const LOOKALIKE = [['口', '囗'], ['日', '曰'], ['土', '士'], ['己', '已', '巳'], ['未', '末'], ['人', '入'], ['刀', '力'], ['儿', '几'], ['戈', '弋'], ['礻', '衤'], ['仑', '仓']];
  const LA = new Map();
  LOOKALIKE.forEach((grp) => grp.forEach((c) => LA.set(c, grp)));
  const lookalike = (a, b) => a !== b && LA.has(a) && LA.get(a).indexOf(b) >= 0;

  /* ---------- 朗读：多音字单独念可能念错（漂 piāo / 种 zhòng / 悄 qiǎo / 炸 zhá / 钉 dìng …），
     这些字只念词（“漂亮”），不单念这个字；其余字念“晴，晴天的晴”。宁可多列，不可漏列。 ---------- */
  const POLY = new Set(Array.from('地好打把折挑提漂炮炸种空答给论说观裂通钉间鲜蚂悄奇冲凉作华跑期顿化红叶拾若瀑胜脱被浅调行长重还乐发分看为着得便少只教数背难假相更应当中朝传转量结落散没都和要几处系差担干供号卷圈累模宁强曲塞省似宿吐兴血载扎正钻喝划夹将角觉露蒙泡片铺薄藏曾参场称乘创大弹倒的度恶缝否服骨冠过汗荷横糊会济纪监见降脚解禁劲可拉了量淋绿抹磨弄排胖喷屏泊强切亲色扇上舍什盛石识属刷帖委尾吓巷削校压咽应与约晕择挣转撞仔朝奔背秤处传率露骑车'));
  function sayOf(R) {
    if (!R) return '';
    if (!R.word) return POLY.has(R.ans) ? '' : R.ans;
    return POLY.has(R.ans) ? R.word : R.ans + '，' + R.word + '的' + R.ans;
  }

  /* ---------- 球的配色（按部件散列；与“谁能和谁合”无关，换皮测试照样过） ---------- */
  const PAL = [
    ['#FFE0EA', '#FF8FB1', '#E0467A'], ['#FFE9CC', '#FFB25C', '#E07A12'], ['#FFF6C4', '#FFD84A', '#D9A400'],
    ['#DDF8D2', '#6FD68A', '#2E9E55'], ['#D6F2FF', '#5CC2F2', '#1F87C6'], ['#EDE2FF', '#B38CFF', '#7A4FE0'],
    ['#FFDCD2', '#FF8C6E', '#D5512F'], ['#D2FBF1', '#44D3B6', '#15A088'], ['#FFE3F7', '#F58BE0', '#C24BAE']
  ];
  const GOLD = ['#FFFBE0', '#FFD54A', '#E08A00'];
  const BOMB = ['#FFD2CC', '#FF5A4E', '#B81E14'];
  const STONE = ['#EEF0F3', '#A9B2BE', '#66707E'];

  function makeSpec(ctx) {
    const gn = clamp(Math.floor(+ctx.gradeNum || +(str(ctx.grade).slice(1)) || 3), 2, 6);
    const DATA = buildData(gn);
    let M = W.Matter || null;
    let mState = M ? 'ok' : 'loading', mWait = 0;
    let G0 = null, F = null, prm = P(gn, 1);
    const L = { w: 0, h: 0, top: 0, S: 1, k: 1 };
    const SP = new Map();      // 球的离屏精灵
    const GC = Object.create(null);   // 渐变缓存（layout 时清）
    let animT = 0, lastDraw = 0;

    function kickLoad() {
      if (W.Matter) { M = W.Matter; mState = 'ok'; return; }
      mState = 'loading'; mWait = 0;
      loadMatter().then((m) => {
        M = m; mState = 'ok';
        if (G0 && F && !F.world && ctx.alive && ctx.alive()) buildWorld(G0);
      }, () => { mState = 'fail'; });
    }
    kickLoad();

    /* ================= 坐标 ================= */
    const SX = (x) => L.ox + x * L.S;
    const SY = (y) => L.oy + y * L.S;
    const LX = (px) => (px - L.ox) / L.S;
    const radiusOf = (kind, tier) => kind === 'char' ? prm.rPart * (1.1 + 0.12 * Math.max(0, (tier || 1) - 1)) : kind === 'bomb' ? prm.rPart * 0.92 : prm.rPart;

    function layout(g) {
      const w = g.w, h = g.h, top = g.hudTop;
      L.w = w; L.h = h; L.top = top;
      const wide = w >= 700 && w >= h * 1.05;
      L.wide = wide;
      const k = clamp(Math.min(w / 390, h / 800), 0.78, 1.45);
      L.k = k;
      if (!wide) {
        L.rowY = top + 16 * k;   // 引擎的“连击×N”小牌挂在分数下面，字卡架让开它
        L.rowH = Math.round((prm.cardPy ? 62 : 54) * k);
        L.cloudH = Math.round(60 * k);
        L.tableH = Math.round(30 * k);
        const availW = w - 22, availH = h - (L.rowY + L.rowH) - L.cloudH - L.tableH - 2;
        L.S = Math.max(0.2, Math.min(availW / JW, availH / JH));
        L.jw = JW * L.S; L.jh = JH * L.S;
        const extra = Math.max(0, availH - L.jh);   // 高屏多出来的空间：四成放在云朵上方，六成留给下面的沙滩
        L.ox = (w - L.jw) / 2; L.oy = L.rowY + L.rowH + L.cloudH + extra * 0.4;
        const bs = Math.round(50 * k);
        // 左上角留给引擎的“朗读中”小喇叭；💡 在右边；“下一个”挂在云朵旁边
        L.hint = { x: w - 8 - bs, y: L.rowY + (L.rowH - bs) / 2, w: bs, h: bs };
        L.next = { cx: 0, cy: 0, r: Math.round(24 * k), follow: true };
        const sx0 = 8 + 36 * k;
        L.shelf = { x: sx0, y: L.rowY, w: L.hint.x - 8 - sx0, h: L.rowH, vertical: false };
      } else {
        L.cloudH = Math.round(72 * k); L.tableH = Math.round(34 * k);
        const availH = h - top - L.cloudH - L.tableH - 4 - 44 * k, availW = Math.min(w * 0.44, 640);   // 44k：海鸥从云朵上方飞过，别压到 HUD
        L.S = Math.max(0.2, Math.min(availW / JW, availH / JH));
        L.jw = JW * L.S; L.jh = JH * L.S;
        L.ox = (w - L.jw) / 2; L.oy = h - L.tableH - L.jh;
        const lcx = L.ox / 2, rcx = L.ox + L.jw + (w - L.ox - L.jw) / 2;
        L.lcx = lcx; L.rcx = rcx;
        const pw = Math.min(L.ox - 36, 280);
        L.pw = pw;
        L.next = { cx: lcx, cy: L.oy + 96 * k, r: 50 * k };
        L.hint = { x: lcx - 70 * k, y: L.next.cy + L.next.r + 46 * k, w: 140 * k, h: 58 * k };
        L.shelf = { x: rcx - pw / 2, y: L.oy + 26 * k, w: pw, h: L.jh * 0.8, vertical: true };
      }
      L.cloudY = L.oy - L.cloudH * 0.5;
      SP.clear();
      for (const key in GC) delete GC[key];
    }

    function lgrad(c, key, x0, y0, x1, y1, stops) {
      let gr = GC[key];
      if (!gr) { gr = c.createLinearGradient(x0, y0, x1, y1); for (let i = 0; i < stops.length; i += 2) gr.addColorStop(stops[i], stops[i + 1]); GC[key] = gr; }
      return gr;
    }

    /* ================= 状态 ================= */
    function newState(g) {
      return {
        g, eng: null, world: null, balls: [], q: [], boomQ: [], seq: 0, time: 0, acc: 0, speed: 1,
        aimX: JW * 0.28, held: null, next: null, cool: 0, heldPop: 1, autoT: 0, queued: false, aiming: false,
        lastDrop: null, teachRec: null, danger: 0, dTick: 0, rescue: prm.rescue, hints: prm.hints, hintOn: false, hintMsg: 0, bombQ: 0,
        active: [], cards: [], used: new Set(), made: Object.create(null), recent: [],
        bag: 0, bagMax: 0, outT: 0, feedT: 0, gulls: [], ending: false, pend: [],
        ghosts: [], labels: [], banners: [], flyers: [], puffs: [], tut: null, tutLeft: prm.tutDrops,
        stats: { drops: 0, merges: 0, shelf: 0, pops: 0, autoDrops: 0, bombs: 0, feeds: 0, maxDanger: 0, rescues: 0, randomMerges: 0, wasted: 0 },
        auto: null, autoWait: 0, autoGap: 0.55
      };
    }
    function teardown() {
      if (!F || !F.eng || !M) return;
      try { M.Events.off(F.eng); M.Composite.clear(F.world, false); M.Engine.clear(F.eng); } catch (e) { /* ignore */ }
      F.eng = null; F.world = null;
    }

    function buildWorld(g) {
      if (!M || !F || F.world) return;
      const E = M.Engine.create({ positionIterations: 8, velocityIterations: 6 });
      E.gravity.y = 1.15;
      F.eng = E; F.world = E.world;
      const wp = Object.assign({ isStatic: true, label: 'wall' }, PHYS);
      M.Composite.add(F.world, [
        M.Bodies.rectangle(-WALL / 2, WALL / 2, WALL, JH * 2 + WALL, wp),
        M.Bodies.rectangle(JW + WALL / 2, WALL / 2, WALL, JH * 2 + WALL, wp),
        M.Bodies.rectangle(JW / 2, JH + WALL / 2, JW + WALL * 2, WALL, wp)
      ]);
      M.Events.on(E, 'collisionStart', onPairs);
      M.Events.on(E, 'collisionActive', onPairs);
      setupLevel(g);
    }

    /* ---------- 本关配方：K 张字卡 ---------- */
    function pickRecipes(n) {
      const have = new Set(F.active.map((r) => r.ans));
      const compUse = Object.create(null);
      F.active.forEach((r) => { compUse[r.a] = (compUse[r.a] || 0) + 1; compUse[r.b] = (compUse[r.b] || 0) + 1; });
      let cand = DATA.pool.filter((r) => !have.has(r.ans) && !F.used.has(r.ans));
      if (cand.length < n) cand = DATA.pool.filter((r) => !have.has(r.ans));
      cand = shuffle(cand);
      const out = [];
      let doubles = F.active.filter((r) => r.a === r.b).length;
      for (const r of cand) {
        if (out.length >= n) break;
        if (have.has(r.ans)) continue;
        if (r.a === r.b && doubles >= 1) continue;          // 叠字（换皮嫌疑）每关最多 1 个
        if ((compUse[r.a] || 0) >= 2 || (compUse[r.b] || 0) >= 2) continue;   // 同一个部件别出现太多次
        out.push(r); have.add(r.ans);
        compUse[r.a] = (compUse[r.a] || 0) + 1; compUse[r.b] = (compUse[r.b] || 0) + 1;
        if (r.a === r.b) doubles++;
      }
      for (const r of cand) { if (out.length >= n) break; if (!have.has(r.ans)) { out.push(r); have.add(r.ans); } }
      return out;
    }
    function isActiveOrUsed(rec) { return F.active.indexOf(rec) >= 0 || F.used.has(rec.ans); }
    // 能不能合：一律查合并表；叠字（木+木）只有 P2 第 1 关的教学卡还在架子上时才合
    function dblRec(c) { const r = F && F.teachRec; return r && r.a === c && F.active.indexOf(r) >= 0 ? r : null; }
    function canPair(x, c) { return x === c ? !!dblRec(c) : DATA.table.has(pk(x, c)); }
    function partnersOf(c) { const l = DATA.partners.get(c) || []; const d = dblRec(c); return d ? l.concat([{ other: c, rec: d }]) : l; }
    function recipesOf(x, c) { if (x === c) { const d = dblRec(c); return d ? [d] : null; } return DATA.table.get(pk(x, c)) || null; }

    function setupLevel(g) {
      const teach = prm.teach ? shuffle(DATA.teach.slice(0, 4)).slice(0, prm.teach) : [];
      F.teachRec = teach[0] || null;
      F.active = teach.slice();
      F.active = F.active.concat(pickRecipes(Math.max(1, prm.K - teach.length)));
      F.cards = F.active.map((r) => ({ rec: r, made: 0, bump: 0, flip: 0, lit: 0 }));
      // 起手：罐底摆一些部件（彼此合不上），第一个举着的部件保证罐子里有它的搭档（教学关用手指指着它）
      const first = F.active[0];
      const starters = [], decoyN = [];
      const liveC = () => starters.concat(decoyN, [first.b]);
      const clash = (c) => liveC().some((x) => x === c || lookalike(x, c) || canPair(x, c)) || c === first.a || canPair(c, first.a) || lookalike(c, first.a);
      // 目标部件：每张字卡最多一边，彼此配不上，也不和第一个举着的部件配（它的搭档只有教学目标一个）
      for (const r of shuffle(F.active.slice(1))) {
        if (starters.length >= prm.popT - 1) break;
        const c = rand() < 0.5 ? r.a : r.b;
        if (!clash(c)) starters.push(c);
      }
      for (let k = 0; k < 60 && decoyN.length < prm.decoys; k++) {
        const r = pickOne(DATA.pool);
        if (!r || F.active.indexOf(r) >= 0) continue;
        const c = rand() < 0.5 ? r.a : r.b;
        if (!clash(c)) decoyN.push(c);
      }
      const r0 = prm.rPart, cols = Math.max(2, Math.floor((JW - 8) / (2 * r0 + 6)));
      const all = shuffle(starters.concat(decoyN));
      const isDecoy = new Set(decoyN);
      // 第一个部件的搭档放在最上面一层（一定够得着），但在这一层里随便哪个位置、球的先后编号也打乱：
      // 原来总是最后一个创建、放在最上层末尾 → “专丢最新 / 最高的球”每关第一下白送（教学关有手指带着丢，不受影响）
      const n = all.length + 1;
      const lastRow = Math.floor((n - 1) / cols) * cols;
      const tIdx = lastRow + Math.floor(rand() * (n - lastRow));
      all.splice(tIdx, 0, first.b);
      shuffle(all.map((c, i) => i)).forEach((i) => {
        const c = all[i];
        const row = Math.floor(i / cols), col = i % cols;
        const inRow = Math.min(cols, n - row * cols);
        const span = (JW - 2 * r0 - 12) / Math.max(1, cols - 1);
        const x0 = JW / 2 - (inRow - 1) * span / 2;
        const x = clamp(x0 + col * span + rnd(-8, 8) + (row % 2 ? r0 * 0.5 : 0), r0 + 4, JW - r0 - 4);
        const y = JH - r0 - 2 - row * r0 * 1.8;
        const b = mkBall('part', c, x, y, {});
        b.age = 2; b.landed = true;
        if (i !== tIdx && isDecoy.has(c)) b.decoy = true;
        if (i === tIdx) F.tutTarget = b;
      });
      F.bagMax = F.bag = Math.ceil(G0.rounds * prm.bagMul) + prm.bagAdd;
      F.bag--;
      F.held = { kind: 'part', comp: first.a };
      F.next = makePiece();
      F.aimX = JW * 0.2;
      F.heldPop = 1;   // 倒计时时就看得见第一个部件（heldPop 只在 play 里长，原来 0 → 倒计时 3 秒云朵下面空着）
      F.feedT = prm.feed * 0.8;
      if (F.tutLeft > 0) F.tut = { target: F.tutTarget, comp: first.a, t: 0 };
    }

    /* ================= 球 ================= */
    function mkBall(kind, comp, x, y, o) {
      o = o || {};
      const tier = o.tier || 1;
      const r = radiusOf(kind, tier);
      const body = M.Bodies.circle(x, y, r, Object.assign({}, BALL, prm.phys || {}, { restitution: kind === 'char' ? 0.22 : BALL.restitution, label: 'ball' }));
      const ci = hashStr(comp) % PAL.length;
      const b = {
        id: ++F.seq, kind, comp, r, tier, body, x, y, age: 0, landed: false, sq: 0, sqv: 0, pop: o.pop ? 0 : 1,
        dead: false, rec: o.rec || null, life: 0, lifeMax: 0, ci, ph: rand() * TAU, warn: 0, fuse: 0
      };
      body.__b = b;
      M.Composite.add(F.world, body);
      F.balls.push(b);
      return b;
    }
    function killBall(b) {
      if (b.dead) return;
      b.dead = true;
      try { M.Composite.remove(F.world, b.body); } catch (e) { /* ignore */ }
      if (F.tut && F.tut.target === b) F.tut.target = null;
    }
    function liveBalls() { return F.balls.filter((b) => !b.dead); }

    /* ================= 出球 ================= */
    // 云朵给孩子的部件：大约 85%–95% 是“罐子里已经有它的搭档”的部件（搭档可能不止一个，要自己找）；
    // 选下一个时，先把“手上那个”要用掉的搭档预留出来，免得两个部件抢同一个搭档。
    function reachable(b) {
      const hr = prm.rPart, x = b.body.position.x;
      const ly = landingY(x, hr);
      return ly + hr >= b.body.position.y - b.r - 6;
    }
    function bestPartner(comp, excl) {
      let best = null, bs = -1e9;
      for (const b of F.balls) {
        if (b.dead || b.junk || excl.has(b) || (b.kind !== 'part' && b.kind !== 'char')) continue;
        if (!canPair(b.comp, comp)) continue;
        // 提示 / 教学手指优先指向“架子上正在出的字卡”的搭档（能合的搭档不止一个时）
        const rl = recipesOf(b.comp, comp) || [];
        const sc = (reachable(b) ? 1000 : 0) + (rl.some((r) => F.active.indexOf(r) >= 0) ? 500 : 0) - (b.body.position.y - b.r);
        if (sc > bs) { bs = sc; best = b; }
      }
      return best;
    }
    function choosePart(strict) {
      const reserved = new Set();
      [F.held, F.next].forEach((pc) => { if (pc && pc.kind === 'part') { const b = bestPartner(pc.comp, reserved); if (b) reserved.add(b); } });
      // 只为架子上正在出的字卡配部件；已经换走的字卡只在实在没别的可配时才用
      // （否则会一直配“讶”这种已经合过两次的字：实测 P4 一关 13 次合成里 讶×5、浅×4，架上的字卡一张没亮）
      // 最新送来的两个球、堆得最高的那个球少当搭档（按“新旧排名”压权重，不按绝对时间：两次送货之间最新的那个会一直是最新的）
      const parts = F.balls.filter((b) => !b.dead && !b.junk && (b.kind === 'part' || b.kind === 'char'));
      const byNew = parts.slice().sort((a, b) => b.id - a.id);
      let topB = null;
      for (const b of parts) if (!topB || b.body.position.y < topB.body.position.y) topB = b;
      const rankW = (b) => (b === byNew[0] ? 0.15 : b === byNew[1] ? 0.5 : 1) * (b === topB ? 0.3 : 1);   // 最高的球 0.5→0.3：实测“专丢最高的球”P4 第 1 关 11/13
      // 三档一起算、按档打折：架子上的字卡 ×1；已经换走的字卡 ×0.3；本年级配方表里任何一条（罐子里的干扰部件也能配）×0.08
      // （2026-09-19 加速批量试玩调的：×0.2 时架上字卡只占合成的 3 成，×0.02 时“专丢最高的球”命中升到 0.4，×0.08 两头都行）。
      // 原来是“第 0 档有就只用第 0 档”：第 0 档常常只剩一个刚送来的球（权重压得再低也是唯一候选，照样被选中），
      // 实测“专丢最新 / 最高的球”P4 第 6 关命中 0.45–0.55，差一点就过关。并档以后，刚送来的球要和罐子里“老”球的搭档比权重。
      const collect = () => {
        const m = new Map();
        for (const b of F.balls) {
          if (b.dead || b.junk || reserved.has(b) || (b.kind !== 'part' && b.kind !== 'char')) continue;
          if (b.kind === 'char' && b.life < 2.5) continue;
          const list = partnersOf(b.comp);
          if (!list.length) continue;
          if (!reachable(b)) continue;   // 被压在下面够不着的不算
          // 刚送来的球（压在最上面、最显眼）尽量不当搭档：否则不识字也能靠“丢到最新 / 最高的那个球上”蒙对
          const w1 = clamp((b.age - 1) / 4, 0.1, 1) * rankW(b);
          for (const p of list) {
            const tm = F.active.indexOf(p.rec) >= 0 ? 1 : F.used.has(p.rec.ans) ? (prm.usedW != null ? prm.usedW : 0.3) : (prm.offW != null ? prm.offW : 0.08);
            m.set(p.other, (m.get(p.other) || 0) + w1 * tm);
          }
        }
        return m;
      };
      // 手上的部件罐子里总要有一个够得着的搭档：没有就会走“海鸥送搭档”，而海鸥专门送来的球太好猜（不识字也能丢中），
      // 所以宁可配一个干扰部件的搭档（合出来的字不在架子上，照样算进度），也尽量不让部件落空
      // 长得像的（口/囗…）要剔掉：罐子里有“口”时不给“囗”
      const need = collect();
      need.forEach((v, c) => { if (F.balls.some((b) => !b.dead && lookalike(b.comp, c))) need.delete(c); });
      // 在罐子里只有一个搭档的部件优先（要真的找到它；到处都能合的部件乱丢也能中）
      need.forEach((v, c) => {
        let n = 0;
        for (const b of F.balls) if (!b.dead && !b.junk && !reserved.has(b) && (b.kind === 'part' || b.kind === 'char') && canPair(b.comp, c) && reachable(b)) n++;
        if (n > 1) need.set(c, v / Math.pow(n, 3));
      });
      let comp = null;
      if (strict && !need.size) return null;
      if (need.size && rand() < prm.partnerP) {
        let tot = 0; need.forEach((v) => { tot += v; });
        let x = rand() * tot;
        for (const [c, v] of need) { x -= v; if (x <= 0) { comp = c; break; } }
      }
      if (!comp) {
        const comps = [];
        F.active.forEach((r) => { comps.push(r.a); if (r.b !== r.a) comps.push(r.b); });
        const cnt = Object.create(null);
        F.balls.forEach((b) => { if (!b.dead && b.kind === 'part') cnt[b.comp] = (cnt[b.comp] || 0) + 1; });
        const cand = comps.filter((c) => (cnt[c] || 0) < 3 && F.recent.slice(0, 2).indexOf(c) < 0);
        comp = pickOne(cand.length ? cand : comps) || (F.active[0] && F.active[0].a) || '木';
      }
      F.recent.unshift(comp); F.recent.length = Math.min(F.recent.length, 4);
      return comp;
    }
    function makePiece() {
      if (F.bombQ > 0) { F.bombQ--; return { kind: 'bomb', comp: '🧨' }; }
      if (F.bag > 0) { F.bag--; return { kind: 'part', comp: choosePart() }; }
      return null;
    }
    function piecesLeft() { return F.bag + (F.held && F.held.kind === 'part' ? 1 : 0) + (F.next && F.next.kind === 'part' ? 1 : 0); }
    function hasPartner(comp) {
      for (const b of F.balls) {
        if (b.dead || (b.kind !== 'part' && b.kind !== 'char')) continue;
        if (canPair(b.comp, comp)) return true;
      }
      return false;
    }
    function nextPiece() {
      F.held = F.next; F.next = null;
      if (!F.held) F.held = makePiece();
      F.next = makePiece();
      F.heldPop = 0; F.autoT = 0; F.hintOn = false;
      // 教学关：前几次都用手指指一下搭档（P2 两次，其余一次）
      if (F.tutLeft > 0 && F.held && F.held.kind === 'part') {
        const b = bestPartner(F.held.comp, new Set());
        if (b) F.tut = { target: b, comp: F.held.comp, t: 0 };
      }
    }

    /* ================= 海鸥送部件（罐子里总有新东西；孩子的部件要找它们配对） ================= */
    // 能不能把部件 c 放进罐子：不和罐子里 / 空中 / 云朵手上的任何部件配成对（否则一落地就自己合上了），且罐子里还没有一样的
    function feedable(c, live) {
      if (F.balls.some((b) => !b.dead && lookalike(b.comp, c))) return false;
      // 每个部件在罐子里最好只有一个搭档：c 的搭档 x 如果已经能在罐子里找到别的搭档，就不送 c（多搭档 = 乱丢也容易中）
      for (const p of partnersOf(c)) {
        if (live.some((b) => canPair(b.comp, p.other))) return false;
      }
      if (live.some((b) => b.comp === c || canPair(b.comp, c))) return false;
      if (F.gulls.some((gl) => gl.state === 'in' && (gl.comp === c || lookalike(gl.comp, c) || canPair(gl.comp, c)))) return false;
      if ([F.held, F.next].some((pc) => pc && pc.kind === 'part' && (pc.comp === c || lookalike(pc.comp, c) || canPair(pc.comp, c)))) return false;
      return true;
    }
    function weighted(cands) {
      if (!cands.length) return null;
      let tot = 0; cands.forEach((x) => { tot += x[1]; });
      let x = rand() * tot;
      for (const [c, v] of cands) { x -= v; if (x <= 0) return c; }
      return cands[0][0];
    }
    // 目标部件：本关字卡的一边（孩子手上的部件要找它们）
    function feedTarget(live) {
      const cands = [];
      F.active.forEach((r) => {
        const cd = F.cards.find((c) => c.rec === r);
        const w = cd && cd.made >= prm.rotN ? 0.3 : 1;
        (r.a === r.b ? [r.a] : [r.a, r.b]).forEach((c) => { if (feedable(c, live)) cands.push([c, w]); });
      });
      return weighted(cands);
    }
    // 干扰部件：本年级别的配方里的部件（长得和目标一样是球，只是这一关用不上；换了字卡以后可能就用上了）
    function feedDecoy(live) {
      const cands = [];
      for (const r of shuffle(DATA.pool)) {
        if (F.active.indexOf(r) >= 0 || F.used.has(r.ans)) continue;
        const c = rand() < 0.5 ? r.a : r.b;
        if (feedable(c, live)) cands.push([c, 1]);
        if (cands.length > 12) break;
      }
      return weighted(cands);
    }
    function boardCounts() {
      let nT = 0, nD = 0;
      for (const b of F.balls) { if (b.dead || b.kind !== 'part' || b.junk) continue; if (b.decoy) nD++; else nT++; }
      F.gulls.forEach((gl) => { if (gl.state === 'in') { if (gl.decoy) nD++; else nT++; } });
      return { nT, nD };
    }
    function launchGull(comp, decoy) {
      if (!comp) return false;
      const dir = rand() < 0.5 ? 1 : -1;
      const r = prm.rPart;
      // 落点：随便哪儿（别直接砸在孩子正瞄着的地方）。不挑“最低的一带”：乱丢的球也会滚进最低的坑，
      // 目标部件老待在坑里 = 乱丢也容易碰上
      let tx = rnd(r + 10, JW - r - 10);
      for (let k = 0; k < 6 && Math.abs(tx - F.aimX) < r * 1.6; k++) tx = rnd(r + 10, JW - r - 10);
      F.gulls.push({ comp, dir, x: dir > 0 ? -170 : JW + 170, tx, state: 'in', t: 0, decoy: !!decoy });
      return true;
    }
    // 手上的部件在罐子里找不到搭档了（搭档被别的球抢先用掉 / 被炸掉）→ 海鸥马上送一个来，保证“每个部件都有搭档”
    function hasReachablePartner(comp) {
      for (const b of F.balls) {
        if (b.dead || (b.kind !== 'part' && b.kind !== 'char')) continue;
        if (canPair(b.comp, comp) && reachable(b)) return true;
      }
      return false;
    }
    function heldOrphan() {
      if (!F.held || F.held.kind !== 'part') return false;
      if (F.held.wordFor && !F.held.wordFor.dead) return false;   // 这是“组词”部件：搭档就是那个字球
      return !hasReachablePartner(F.held.comp);
    }
    function launchHeldPartner() {
      const noLA = (p) => !F.balls.some((b) => !b.dead && lookalike(b.comp, p.other));
      const all = partnersOf(F.held.comp);
      let list = all.filter((p) => isActiveOrUsed(p.rec));
      if (!list.length) list = all.slice();
      if (!list.length) {   // 这个部件没有任何配方（组词部件的字球已经飞走了）→ 换一个有搭档的部件，别让游戏卡住
        F.held = { kind: 'part', comp: choosePart() };
        F.heldPop = 0; F.autoT = 0;
        return false;
      }
      if (list.some(noLA)) list = list.filter(noLA);
      const live = F.balls.filter((b) => !b.dead && (b.kind === 'part' || b.kind === 'char'));
      // 罐子里（哪怕被压在下面）已经有的部件不再送第二个：一个部件在罐子里有好几个搭档 = 乱丢也容易中
      const fresh = list.filter((p) => !live.some((b) => b.comp === p.other));
      if (fresh.length) list = fresh;
      const act = list.filter((p) => F.active.indexOf(p.rec) >= 0);
      const p = pickOne(act.length ? act : list);
      if (!p) return false;
      const dir = rand() < 0.5 ? 1 : -1, r = prm.rPart;
      const tx = rnd(r + 10, JW - r - 10);
      // 同时再来一只海鸥送一个干扰部件（从另一边飞来，谁先到随机）：
      // 否则“海鸥专门送来的那个就是搭档”，不识字也能丢中（实测“丢到最新的球上”命中率 0.72）
      const live2 = live.concat([{ comp: p.other }]);
      let dc = feedDecoy(live2);
      if (!dc) {   // 罐子太挤、严格条件下挑不出干扰部件：放宽到“和罐子里 / 手上的都配不上”就行
        const hn = [F.held, F.next].filter((pc) => pc && pc.kind === 'part').map((pc) => pc.comp);
        for (const rr of shuffle(DATA.pool)) {
          const c = rand() < 0.5 ? rr.a : rr.b;
          if (live2.some((b) => b.comp === c || lookalike(b.comp, c) || canPair(b.comp, c))) continue;
          if (hn.some((h) => h === c || lookalike(h, c) || canPair(h, c))) continue;
          dc = c; break;
        }
      }
      let dx = tx;
      for (let k = 0; k < 8 && Math.abs(dx - tx) < r * 2.2; k++) dx = rnd(r + 10, JW - r - 10);
      const lag = [rnd(0, 170), rnd(0, 170), rnd(60, 260)];
      F.gulls.push({ comp: p.other, dir, x: dir > 0 ? -170 - lag[0] : JW + 170 + lag[0], tx, state: 'in', t: 0, forHeld: true });
      const okD = (c, others) => c && others.every((o) => c !== o && !lookalike(c, o) && !canPair(c, o));
      if (okD(dc, [p.other])) F.gulls.push({ comp: dc, dir: -dir, x: -dir > 0 ? -170 - lag[1] : JW + 170 + lag[1], tx: dx, state: 'in', t: 0, decoy: true });
      // P3 起再多一只送干扰部件的海鸥（三只里谁最后到随机）：实测只有一只干扰时，“专丢最新送来的球”P4 第 1 关 5 局赢 1 局
      if ((prm.heldDecoys || 1) >= 2 && dc) {
        const hn = [F.held, F.next].filter((pc) => pc && pc.kind === 'part').map((pc) => pc.comp);
        const dc2 = feedDecoy(live2.concat([{ comp: dc }]));
        if (okD(dc2, [p.other, dc].concat(hn))) {
          let dx2 = rnd(r + 10, JW - r - 10);
          for (let k = 0; k < 8 && (Math.abs(dx2 - tx) < r * 2 || Math.abs(dx2 - dx) < r * 2); k++) dx2 = rnd(r + 10, JW - r - 10);
          const d2 = rand() < 0.5 ? 1 : -1;
          F.gulls.push({ comp: dc2, dir: d2, x: d2 > 0 ? -170 - lag[2] : JW + 170 + lag[2], tx: dx2, state: 'in', t: 0, decoy: true });
        }
      }
      return true;
    }
    function swapHeld(g) {
      if (!F.held || F.held.kind !== 'part' || (F.held.wordFor && !F.held.wordFor.dead)) return false;
      const old = F.held.comp;
      const c = choosePart(true);
      if (!c || c === old) return false;
      F.held = { kind: 'part', comp: c };
      F.heldPop = 0; F.autoT = 0; F.orphanT = 0; F.hintOn = false;
      const hr = radiusOf('part');
      g.float('换一个', SX(clamp(F.aimX, hr + 2, JW - hr - 2)), L.cloudY - 34 * L.k, { color: '#FFFFFF', size: 20 });   // 飘在云朵上方，别盖住新部件
      g.sfx('flip');
      return true;
    }
    function gullTick(g, sdt) {
      if (F.tut || F.ending) return;
      // 手上的部件没搭档了：先让云朵换一个罐子里有搭档的部件；实在换不了才叫海鸥送搭档
      // （海鸥专门送来的球就是搭档 = 不识字也知道往哪丢，所以尽量不走这条路）
      // 要“没搭档”持续 0.6 秒才换：刚合成的字球弹起来会暂时盖住搭档（reachable 判成够不着），
      // 原来当帧就换，实测 P2 第 1 关第一次合成后手上的部件马上“换一个”，孩子正瞄着的部件被换掉
      if (heldOrphan() && (F.orphanT || 0) >= 0.6 && !F.gulls.some((gl) => gl.state === 'in') && !swapHeld(g)) { if (launchHeldPartner()) g.sfx('whoosh'); }
      F.feedT -= sdt;
      // 罐子里保持：目标部件（每种最多 1 个）+ 一些干扰部件（太空的罐子乱丢也能碰上搭档）
      const bc = boardCounts();
      if ((bc.nT < 3 || bc.nD < prm.decoys) && F.feedT > 0.9) F.feedT = 0.9;
      if (F.feedT <= 0 && !F.gulls.some((gl) => gl.state === 'in')) {
        F.feedT = prm.feed * rnd(0.85, 1.15);
        const live = F.balls.filter((b) => !b.dead && (b.kind === 'part' || b.kind === 'char'));
        let ok = false;
        // 目标部件和干扰部件轮流送：“最新送来的那个”不一定有用
        F.feedFlip = !F.feedFlip;
        const tryT = () => bc.nT < prm.popT && launchGull(feedTarget(live), false);
        const tryD = () => bc.nD < prm.decoys && launchGull(feedDecoy(live), true);
        ok = F.feedFlip ? (tryD() || tryT()) : (tryT() || tryD());
        if (ok) g.sfx('whoosh');
      }
      for (let i = F.gulls.length - 1; i >= 0; i--) {
        const gl = F.gulls[i];
        gl.t += sdt;
        gl.x += gl.dir * 460 * sdt;
        if (gl.state === 'in' && (gl.dir > 0 ? gl.x >= gl.tx : gl.x <= gl.tx)) {
          gl.state = 'out';
          const ly = clamp((gullCargoY(gl) - L.oy) / L.S, -260, prm.rPart + 6);   // 从海鸥爪子下面真正“掉”进罐子
          const b = mkBall('part', gl.comp, gl.tx, ly, {});
          b.feed = true; b.decoy = !!gl.decoy; b.pop = 0.55;
          M.Body.setVelocity(b.body, { x: gl.dir * 1.2, y: 2 });
          F.stats.feeds++;
          g.sfx('bubble');
        }
        if (gl.state === 'out' && (gl.x < -220 || gl.x > JW + 220)) F.gulls.splice(i, 1);
      }
    }

    /* ================= 丢下 ================= */
    function drop(g, auto) {
      if (!F || !F.world || !F.held || g.state !== 'play') return false;
      const piece = F.held;
      const r = radiusOf(piece.kind);
      const x = clamp(F.aimX, r + 2, JW - r - 2);
      const b = mkBall(piece.kind, piece.comp, x, r + 6, {});
      if (piece.kind === 'part') b.dropPend = true;
      b.byKid = !auto;   // 孩子自己丢的（云朵等太久自己丢的不算）：只有它参与的合成 / 词语爆破才记“掌握”
      M.Body.setVelocity(b.body, { x: 0, y: 3 });
      M.Body.setAngularVelocity(b.body, rnd(-0.04, 0.04));
      F.lastDrop = { ball: b, t: 0, partner: piece.kind === 'part' && (hasPartner(piece.comp) || !!(piece.wordFor && !piece.wordFor.dead)), merged: false, judged: false, landT: 0 };
      F.pend.push(F.lastDrop);
      if (F.auto) {
        let np = 0; F.balls.forEach((o) => { if (!o.dead && o !== b && (o.kind === 'part' || o.kind === 'char') && canPair(o.comp, piece.comp)) np++; });
        (F.dlog = F.dlog || []).push(piece.comp + '@' + Math.round(x) + ' p' + np + ' n' + liveBalls().length);
      }
      F.held = null; F.cool = DROP_COOL; F.hintOn = false;
      F.stats.drops++;
      g.sfx(piece.kind === 'bomb' ? 'whoosh' : 'bubble');
      // 云朵等不及自己丢了：孩子这时手指可能还按着在瞄准——松手不能再把“下一个”（还没看清）也丢下去
      if (auto) { F.stats.autoDrops++; F.aiming = false; F.queued = false; g.miss(); }
      if (F.tut) { F.tutLeft--; F.tut = null; }
      return true;
    }
    function tryDrop(g) {
      if (!F) return;
      if (F.held) drop(g, false);
      else if (F.cool < 0.22) F.queued = true;   // 快好了：松手先记下，出球那一刻再丢
    }

    /* ================= 碰撞 → 合成 / 词语爆破 ================= */
    function onPairs(ev) {
      const ps = ev.pairs;
      for (let i = 0; i < ps.length; i++) {
        const A = ps[i].bodyA.__b, B = ps[i].bodyB.__b;
        if (A && !A.landed) land(A);
        if (B && !B.landed) land(B);
        if (!A || !B || A.dead || B.dead) continue;
        F.q.push(A, B);
      }
    }
    function land(b) {
      b.landed = true;
      b.landAt = F.time;
      const v = b.body.speed || 0;
      b.sqv += clamp(v * 0.9, 0, 9);
      if (b.kind === 'bomb') { b.fuse = 0.35; F.boomQ.push(b); }
    }
    // 刚丢下的部件：落地窗口过了还没合上 → 不再能合（马上就要变石头）
    const late = (b) => b.dropPend && b.landed && F.time - b.landAt > LAND_WIN;
    function recipeOf(A, B) {
      if ((A.kind !== 'part' && A.kind !== 'char') || (B.kind !== 'part' && B.kind !== 'char')) return null;
      if (late(A) || late(B)) return null;
      if (A.kind === 'char' && (A.age < 0.12 || A.dying)) return null;
      if (B.kind === 'char' && (B.age < 0.12 || B.dying)) return null;
      const list = recipesOf(A.comp, B.comp);
      if (!list || !list.length) return null;
      if (list.length === 1) return list[0];
      return list.find((r) => F.active.indexOf(r) >= 0) || list.find((r) => F.used.has(r.ans)) || list[0];
    }
    function wordOf(A, B) {
      if (A.kind !== 'char' && B.kind !== 'char') return null;
      if (late(A) || late(B)) return null;
      if ((A.kind !== 'part' && A.kind !== 'char') || (B.kind !== 'part' && B.kind !== 'char')) return null;
      if ((A.kind === 'char' && A.age < 0.2) || (B.kind === 'char' && B.age < 0.2)) return null;
      return DATA.words.get(pk(A.comp, B.comp)) || null;
    }
    function processQueue(g) {
      const q = F.q;
      for (let i = 0; i < q.length; i += 2) {
        if (g.state !== 'play') break;
        const A = q[i], B = q[i + 1];
        if (A.dead || B.dead) continue;
        const R = recipeOf(A, B);
        if (R) { merge(g, A, B, R); continue; }
        const Wd = wordOf(A, B);
        if (Wd) wordPop(g, A, B, Wd);
      }
      q.length = 0;
      for (let i = F.boomQ.length - 1; i >= 0; i--) {
        const b = F.boomQ[i];
        if (b.dead) { F.boomQ.splice(i, 1); continue; }
        b.fuse -= STEP;
        if (b.fuse <= 0) { F.boomQ.splice(i, 1); explode(g, b); }
      }
    }

    function copyItem(src, hz) { return Object.assign({}, src && typeof src === 'object' ? src : {}, { hz }); }

    function merge(g, A, B, R) {
      const ax = A.body.position.x, ay = A.body.position.y, bx = B.body.position.x, by = B.body.position.y;
      const vx = (A.body.velocity.x + B.body.velocity.x) / 2;
      const pe = F.pend.find((d) => d.ball === A || d.ball === B);
      const wasDrop = !!pe;
      killBall(A); killBall(B);
      const mx = (ax + bx) / 2, my = (ay + by) / 2;
      const tier = Math.max(A.kind === 'char' ? A.tier + 1 : 1, B.kind === 'char' ? B.tier + 1 : 1);
      const C = mkBall('char', R.ans, mx, my, { rec: R, tier, pop: true });
      C.byKid = !!(A.byKid || B.byKid);   // 孩子丢的部件合出来的字，再接着合（连锁）也算孩子的
      M.Body.setVelocity(C.body, { x: vx * 0.3, y: -4.5 });
      C.life = C.lifeMax = prm.charLife + (DATA.chainable.has(R.ans) ? 4 : 0);
      C.sqv = 6;
      F.ghosts.push({ comp: A.comp, kind: A.kind, ci: A.ci, r: A.r, x: ax, y: ay, tx: mx, ty: my, t: 0 });
      F.ghosts.push({ comp: B.comp, kind: B.kind, ci: B.ci, r: B.r, x: bx, y: by, tx: mx, ty: my, t: 0 });
      if (pe) pe.merged = true;
      else F.stats.randomMerges++;
      if (F.auto) (F.dlog = F.dlog || []).push('  => ' + A.comp + '+' + B.comp + '=' + R.ans + (wasDrop ? '' : ' (bump)'));
      F.stats.merges++;
      if (F.tut) F.tut = null;
      const sx = SX(mx), sy = SY(my);
      g.sfx('pop');
      F.labels.push({ ch: R.ans, py: R.py, word: R.word, x: sx, y: Math.max(SY(RED) + 16 * L.k, sy - C.r * L.S - 92 * L.k), t: 0 });
      markMade(g, R);
      wordChance(C);
      // 孩子丢的部件参与的合成才记掌握（item 带 hz）；罐子里自己碰上的（海鸥送的、被爆竹推过去的、云朵自己丢的）
      // 照样算进度和分数，但不给字卡记“掌握”（g.right(null)：核心只计分，不记这道题答对）
      g.right(A.byKid || B.byKid ? copyItem(R.src, R.ans) : null, sx, sy);
      if (tier >= 2) { g.addScore(15 * tier, sx, sy - 60 * L.k); g.flash('#FFF3B0'); g.sfx('power'); }
      if (g.state !== 'play') return;
      const st = sayOf(R);
      if (st) g.say(st, { caption: '' });
      if (g.combo > 0 && g.combo % prm.bombEvery === 0) earnBomb(g, sx, sy);
    }
    // 组词机会：刚合成的字如果能和某个部件 / 字组成词（忠→忠心），有时把“下一个”换成那个字，字球多停一会儿
    function wordChance(C) {
      if (!F.next || F.next.kind !== 'part' || rand() >= prm.wordP) return;
      const opts = [];
      DATA.words.forEach((wd) => {
        const cs = cps(wd.w);
        const i = cs.indexOf(C.comp);
        if (i < 0) return;
        const o = cs[1 - i];
        if (F.balls.some((b) => !b.dead && lookalike(b.comp, o))) return;
        if (F.held && F.held.kind === 'part' && (F.held.comp === o || canPair(F.held.comp, o))) return;
        opts.push(o);
      });
      const o = pickOne(opts);
      if (!o) return;
      F.next = { kind: 'part', comp: o, wordFor: C };   // 占用原来“下一个”的名额（不白送部件）
      C.life = C.lifeMax = Math.max(C.lifeMax, prm.charLife + 7);
    }
    // 输了：把这一关还没合成的字的配方留在结算面板上（“晴 = 日 + 青”），孩子看一眼就知道差在哪
    function revealList() {
      const miss = F.cards.filter((cd) => cd.made === 0).map((cd) => cd.rec);
      return (miss.length ? miss : F.active).slice(0, 3);
    }
    function revealText() {   // 不换行空格：一条配方不会被折成两行
      return revealList().map((r) => [r.ans, '=', r.a, '+', r.b].join('\u00a0')).join('　');
    }
    function markMade(g, R) {
      F.made[R.ans] = (F.made[R.ans] || 0) + 1;
      const cd = F.cards.find((c) => c.rec.ans === R.ans);
      if (!cd) return;
      F.stats.shelf++;
      cd.made++; cd.bump = 1;
      if ((cd.made >= prm.rotN || cd.rec === F.teachRec) && !cd.swapAt) cd.swapAt = F.time + 1.6;   // 叠字教学卡合成一次就换走
    }
    function rotateCards() {
      for (const cd of F.cards) {
        if (!cd.swapAt || F.time < cd.swapAt) continue;
        cd.swapAt = 0;
        const i = F.active.indexOf(cd.rec);
        const repl = pickRecipes(1)[0];
        if (!repl || i < 0) continue;
        F.used.add(cd.rec.ans);
        F.active[i] = repl;
        cd.rec = repl; cd.made = 0; cd.flip = 1; cd.bump = 0.6;
      }
    }
    function earnBomb(g, x, y) {
      F.bombQ++;
      F.stats.bombs++;
      F.banners.push({ big: '🧨 爆竹 +1', small: '连击奖励！', x: L.ox + L.jw / 2, y: SY(RED) + 40 * L.k, t: 0, life: 1.4, kind: 'bomb' });
      g.sfx('power');
      if (F.next && F.next.kind === 'part') { F.bombQ--; F.bag++; F.next = { kind: 'bomb', comp: '🧨' }; }   // 部件放回口袋，爆竹插队
    }
    function wordPop(g, A, B, Wd) {
      const ax = A.body.position.x, ay = A.body.position.y, bx = B.body.position.x, by = B.body.position.y;
      const pe = F.pend.find((d) => d.ball === A || d.ball === B);
      if (pe) pe.merged = true;
      killBall(A); killBall(B);
      const mx = (ax + bx) / 2, my = (ay + by) / 2, sx = SX(mx), sy = SY(my);
      F.stats.pops++;
      // 词语爆破的冲击波顺手震碎旁边的石头（丢错留下的）——会组词的孩子能把罐子清干净
      let n = 0;
      for (const o of F.balls) {
        if (o.dead || o.kind !== 'stone') continue;
        if (Math.hypot(o.body.position.x - mx, o.body.position.y - my) < 150 + o.r) { puff(o, STONE[1]); killBall(o); n++; }
      }
      let py = Wd.py || '';
      if (!py) { try { py = g.pinyinOf(Wd.w) || ''; } catch (e) { py = ''; } }
      if (py.indexOf('·') >= 0) py = '';
      F.banners.push({ big: Wd.w, small: py, x: clamp(sx, 110, g.w - 110), y: sy - 30 * L.k, t: 0, life: 1.9, kind: 'word' });
      g.burst(sx, sy, { kind: 'confetti', n: 36 });
      g.burst(sx, sy, { kind: 'star', n: 16 });
      g.ring(sx, sy, '#FF7AB6'); g.shake(7); g.flash('#FFF1C9');
      g.sfx('power');
      // 分数飘字放在“词语爆破”大牌子下面，别盖住词
      g.right(A.byKid || B.byKid ? copyItem(Wd.item, Wd.w) : null, sx, sy + 100 * L.k);
      g.addScore(30 + n * 5, sx, sy + 110 * L.k);
      if (g.state !== 'play') return;
      g.say(Wd.w, { caption: '' });
      if (g.combo > 0 && g.combo % prm.bombEvery === 0) earnBomb(g, sx, sy);
    }
    function explode(g, b) {
      const x = b.body.position.x, y = b.body.position.y;
      killBall(b);
      let n = 0;
      const R = prm.bombR;
      for (const o of F.balls) {
        if (o.dead) continue;
        const d = Math.hypot(o.body.position.x - x, o.body.position.y - y);
        if (d > R + o.r * 0.4) continue;
        if (o.kind === 'char') { ascend(g, o); continue; }
        puff(o, o.kind === 'stone' ? STONE[1] : PAL[o.ci][1]);
        killBall(o); n++;
      }
      // 爆炸冲击：把附近的球往外推一下
      for (const o of F.balls) {
        if (o.dead) continue;
        const dx = o.body.position.x - x, dy = o.body.position.y - y, d = Math.hypot(dx, dy) || 1;
        if (d < R * 1.8) M.Body.setVelocity(o.body, { x: o.body.velocity.x + dx / d * 6 * (1 - d / (R * 1.8)), y: o.body.velocity.y + dy / d * 6 * (1 - d / (R * 1.8)) - 2 });
      }
      const sx = SX(x), sy = SY(y);
      g.burst(sx, sy, { kind: 'spark', n: 34 });
      g.burst(sx, sy, { kind: 'dot', color: '#FF7043', n: 22 });
      g.burst(sx, sy, { kind: 'confetti', n: 16 });
      g.ring(sx, sy, '#FFB347', R * L.S * 1.1); g.shake(14); g.flash('#FFE7A0');
      g.sfx('crash');
      if (n) g.addScore(5 * n, sx, sy - 30 * L.k);
      F.banners.push({ big: '砰！', small: n ? '清掉 ' + n + ' 个' : '', x: clamp(sx, 80, g.w - 80), y: sy - 40 * L.k, t: 0, life: 1.1, kind: 'boom' });
    }
    function puff(o, col) {
      F.puffs.push({ x: o.body.position.x, y: o.body.position.y, r: o.r, t: 0, col });
      const g = F.g;
      g.burst(SX(o.body.position.x), SY(o.body.position.y), { kind: 'dot', color: col, n: 8 });
    }
    function ascend(g, b) {
      if (b.dead) return;
      const x0 = SX(b.body.position.x), y0 = SY(b.body.position.y);
      killBall(b);
      const i = F.cards.findIndex((c) => c.rec.ans === b.comp);
      const tp = i >= 0 ? cardCenter(i) : { x: g.w / 2, y: Math.max(20, g.hudTop - 24) };
      F.flyers.push({ ch: b.comp, x0, y0, r0: b.r * L.S, tx: tp.x, ty: tp.y, t: 0, dur: 0.6, card: i >= 0 ? F.cards[i] : null, rec: b.rec });
      g.sfx('whoosh');
    }
    // 丢错的部件（落下后没碰上搭档）→ 变成石头：留在罐子里占地方，再也合不了（只有爆竹 / 救命泡泡能清掉）
    function toStone(g, b) {
      b.kind = 'stone'; b.junk = true; b.dropPend = false;
      F.stats.wasted++;
      b.sqv += 5;
      const bx = SX(b.body.position.x), by = SY(b.body.position.y);
      g.burst(bx, by, { kind: 'dot', color: '#98A2AE', n: 10 });
      g.float('咚', bx, by - b.r * L.S, { color: '#E4ECF7', size: 26 });
      g.sfx('flip');
      if (!F.stoneTold) {
        F.stoneTold = true;
        F.banners.push({ big: '变成石头啦', small: '没碰到搭档的部件会变成石头', x: g.w / 2, y: SY(RED) + 46 * L.k, t: 0, life: 2.4, kind: 'stone' });
      }
    }
    function rescue(g) {
      F.rescue--; F.stats.rescues++;
      const tops = liveBalls().filter((b) => b.kind !== 'char').sort((a, b) => (a.body.position.y - a.r) - (b.body.position.y - b.r)).slice(0, 6);
      tops.forEach((b) => { F.puffs.push({ x: b.body.position.x, y: b.body.position.y, r: b.r, t: 0, col: '#9FE3FF', bubble: true }); killBall(b); });
      F.danger = 0;
      F.banners.push({ big: '救命泡泡！', small: '帮你清掉 ' + tops.length + ' 个，加油！', x: g.w / 2, y: SY(RED) + 40 * L.k, t: 0, life: 2.2, kind: 'rescue' });
      g.sfx('bubble'); g.sfx('power');
      g.burst(g.w / 2, SY(RED), { kind: 'water', n: 26 });
    }

    /* ================= 提示 ================= */
    function useHint(g) {
      if (!F || !F.held || F.held.kind !== 'part' || g.state !== 'play') return;
      if (F.hintOn) return;
      if (F.hints <= 0) { F.hintMsg = 1.4; F.hintText = '提示用完啦'; g.sfx('tick'); return; }
      if (!hasPartner(F.held.comp) && !(F.held.wordFor && !F.held.wordFor.dead)) { F.hintMsg = 1.8; F.hintText = '海鸥正在送它的搭档，等一下'; g.sfx('tick'); return; }
      F.hints--; F.hintOn = true; g.sfx('good');
    }

    /* ================= 自动试玩（调试 / 测试用） ================= */
    function landingY(x, hr) {
      let best = JH - hr;
      for (const b of F.balls) {
        if (b.dead) continue;
        const dx = Math.abs(b.body.position.x - x), rr = b.r + hr;
        if (dx >= rr) continue;
        const y = b.body.position.y - Math.sqrt(rr * rr - dx * dx);
        if (y < best) best = y;
      }
      return best;
    }
    function smartX() {
      const held = F.held;
      const hr = radiusOf(held.kind);
      if (held.kind === 'bomb') {
        let best = null;
        for (const b of F.balls) if (!b.dead && b.kind !== 'char' && (!best || b.body.position.y < best.body.position.y)) best = b;
        return best ? best.body.position.x : JW / 2;
      }
      if (held.wordFor && !held.wordFor.dead) return held.wordFor.body.position.x;
      let best = null, by = 1e9;
      for (const b of F.balls) {
        if (b.dead || (b.kind !== 'part' && b.kind !== 'char')) continue;
        if (!canPair(b.comp, held.comp)) continue;
        const top = b.body.position.y - b.r;
        const ly = landingY(b.body.position.x, hr);
        if (ly + hr < top - 4) continue;   // 被别的球挡住了
        if (top < by) { by = top; best = b; }
      }
      if (best) return best.body.position.x;
      let bx = JW / 2, low = -1;
      for (let x = hr + 4; x <= JW - hr - 4; x += 20) { const y = landingY(x, hr); if (y > low) { low = y; bx = x; } }
      return bx;
    }

    /* ================= 字卡位置 ================= */
    function cardGeom() {
      const n = Math.max(1, F ? F.cards.length : 4), k = L.k, sh = L.shelf;
      if (!sh) return { n, cw: 40, ch: 48, x0: 0, y0: 0, gap: 6, cols: n };
      if (!sh.vertical) {
        const gap = Math.max(3, 6 * k);
        const cw = Math.min(50 * k, (sh.w - gap * (n - 1)) / n);
        const ch = Math.min(sh.h - 6, cw * (prm.cardPy ? 1.3 : 1.12));
        const tot = cw * n + gap * (n - 1);
        return { n, cw, ch, gap, cols: n, x0: sh.x + (sh.w - tot) / 2, y0: sh.y + (sh.h - ch) / 2 };
      }
      const cols = 2, gap = 12 * k;
      const cw = Math.min(84 * k, (sh.w - gap) / 2), ch = cw * (prm.cardPy ? 1.18 : 1.05);
      return { n, cw, ch, gap, cols, x0: sh.x + (sh.w - (cw * 2 + gap)) / 2, y0: sh.y + 40 * k };
    }
    function cardAt(p) {
      if (!F || !F.cards.length) return -1;
      const cg = cardGeom();
      for (let i = 0; i < F.cards.length; i++) {
        const q = cardCenter(i);
        if (Math.abs(p.x - q.x) <= cg.cw / 2 + 3 && Math.abs(p.y - q.y) <= cg.ch / 2 + 3) return i;
      }
      return -1;
    }
    function cardCenter(i) {
      const cg = cardGeom();
      const col = i % cg.cols, row = Math.floor(i / cg.cols);
      return { x: cg.x0 + col * (cg.cw + cg.gap) + cg.cw / 2, y: cg.y0 + row * (cg.ch + cg.gap) + cg.ch / 2 };
    }

    /* ================= 精灵：球 ================= */
    function ballSprite(kind, ci, R) {
      R = Math.max(6, Math.round(R));
      const key = kind + '|' + ci + '|' + R;
      let sp = SP.get(key);
      if (sp) return sp;
      if (SP.size > 90) SP.clear();
      const dpr = Math.min(2, W.devicePixelRatio || 1);
      const pad = Math.ceil(R * 0.12) + 3, size = (R + pad) * 2;
      const cv = D.createElement('canvas');
      cv.width = Math.ceil(size * dpr); cv.height = Math.ceil(size * dpr);
      const x = cv.getContext('2d');
      x.scale(dpr, dpr); x.translate(size / 2, size / 2);
      const pal = kind === 'char' ? GOLD : kind === 'bomb' ? BOMB : kind === 'stone' ? STONE : PAL[ci];
      // 投影
      x.fillStyle = 'rgba(20,40,80,.18)';
      x.beginPath(); x.ellipse(0, R * 0.1, R * 1.0, R * 1.0, 0, 0, TAU); x.fill();
      // 本体
      const gr = x.createRadialGradient(-R * 0.35, -R * 0.42, R * 0.08, 0, 0, R * 1.02);
      gr.addColorStop(0, pal[0]); gr.addColorStop(0.62, pal[1]); gr.addColorStop(1, pal[2]);
      x.beginPath(); x.arc(0, 0, R, 0, TAU); x.fillStyle = gr; x.fill();
      // 果冻内圈（写字的地方更亮）
      const gi = x.createRadialGradient(0, R * 0.05, 0, 0, R * 0.05, R * 0.78);
      gi.addColorStop(0, 'rgba(255,255,255,.62)');
      gi.addColorStop(1, 'rgba(255,255,255,0)');
      x.fillStyle = gi; x.beginPath(); x.arc(0, 0, R * 0.8, 0, TAU); x.fill();
      if (kind === 'stone') {
        // 石头纹理只画在最外圈（顺着圆周的弧线），绝不画成像笔画的短线——否则会和字拼出假字（又 + 裂纹 ≈ “汉”）
        x.strokeStyle = 'rgba(70,80,95,.45)'; x.lineWidth = Math.max(1.5, R * 0.06); x.lineCap = 'round';
        [[0.3, 0.9], [1.6, 2.2], [2.9, 3.4], [4.2, 5.0]].forEach(([a0, a1]) => { x.beginPath(); x.arc(0, 0, R * 0.87, a0, a1); x.stroke(); });
      }
      if (kind === 'char') {
        x.strokeStyle = 'rgba(255,255,255,.9)'; x.lineWidth = Math.max(2, R * 0.06);
        x.beginPath(); x.arc(0, 0, R * 0.84, 0, TAU); x.stroke();
      }
      // 描边
      x.lineWidth = Math.max(2.2, R * 0.075);
      x.strokeStyle = kind === 'char' ? '#B35A00' : kind === 'stone' ? '#4A5361' : NAVY;
      x.beginPath(); x.arc(0, 0, R, 0, TAU); x.stroke();
      // 高光
      x.fillStyle = 'rgba(255,255,255,.8)';
      x.beginPath(); x.ellipse(-R * 0.4, -R * 0.52, R * 0.3, R * 0.15, -0.55, 0, TAU); x.fill();
      sp = { cv, size };
      SP.set(key, sp);
      return sp;
    }

    function drawBall(g, c, b, t) {
      const x = SX(b.body.position.x), y = SY(b.body.position.y);
      const R = b.r * L.S;
      const pop = b.pop < 1 ? oBack(b.pop) : 1;
      const wob = 1 + 0.018 * Math.sin(t * 3.1 + b.ph);
      const sq = clamp(b.sq, -0.28, 0.28);
      c.save();
      c.translate(x, y);
      c.scale(pop * wob * (1 + sq), pop * wob * (1 - sq));
      const sp = ballSprite(b.kind, b.ci, R);
      c.drawImage(sp.cv, -sp.size / 2, -sp.size / 2, sp.size, sp.size);
      // 滚动的小光点（跟着物理角度转，字保持正立）
      if (b.kind === 'part' || b.kind === 'char') {
        const a = b.body.angle;
        c.fillStyle = 'rgba(255,255,255,.3)';   // 只在最外圈，离字远一点（别被看成一个点画）
        c.beginPath(); c.arc(Math.cos(a) * R * 0.87, Math.sin(a) * R * 0.87, R * 0.06, 0, TAU); c.fill();
        c.beginPath(); c.arc(Math.cos(a + 2.4) * R * 0.88, Math.sin(a + 2.4) * R * 0.88, R * 0.045, 0, TAU); c.fill();
      }
      if (b.kind === 'stone') {
        g.text(b.comp, 0, R * 0.03, { font: 'kai', size: R * 1.1, color: 'rgba(55,64,78,.5)', weight: 700 });
      } else if (b.kind === 'part') {
        g.text(b.comp, 0, R * 0.03, { font: 'kai', size: R * 1.22, color: NAVY, weight: 700 });
      } else if (b.kind === 'char') {
        // 字往上提、拼音往下放、拼音加白边：原来声调符号（jìng 的 ˋ）压在字的最后一笔上，几乎看不见
        const hasPy = !!(b.rec && b.rec.py);
        g.text(b.comp, 0, hasPy ? -R * 0.17 : -R * 0.06, { font: 'kai', size: R * (hasPy ? 0.98 : 1.08), color: '#B3261E', weight: 700, stroke: '#FFFFFF', strokeW: Math.max(2, R * 0.08) });
        if (hasPy) g.text(b.rec.py, 0, R * 0.6, { font: 'py', size: Math.max(10, R * 0.3), color: '#7A3E00', weight: 700, stroke: '#FFFFFF', strokeW: Math.max(2, R * 0.07) });
        // 剩余时间环（能停久一点的字球才画）
        if (b.lifeMax > 2 && !b.dead) {
          const u = clamp(b.life / b.lifeMax, 0, 1);
          c.lineWidth = Math.max(2, R * 0.08); c.lineCap = 'round';
          c.strokeStyle = 'rgba(255,255,255,.85)';
          c.beginPath(); c.arc(0, 0, R + 4, -Math.PI / 2, -Math.PI / 2 + TAU * u); c.stroke();
        }
        // 闪光
        const s = 0.5 + 0.5 * Math.sin(t * 5 + b.ph);   // 金色小闪光挂在球的外圈上（离字远，不会被看成一个点画）
        c.fillStyle = 'rgba(255,228,92,' + (0.55 + 0.45 * s).toFixed(2) + ')';
        star(c, R * 0.78, -R * 0.78, R * 0.15 * (0.7 + 0.5 * s), t * 2 + b.ph);
      } else if (b.kind === 'bomb') {
        g.emoji('🧨', 0, 0, R * 1.3, { rot: -0.3 });
        const fx = R * 0.5, fy = -R * 0.85;
        c.fillStyle = (Math.floor(t * 12) % 2) ? '#FFE45C' : '#FF8A3D';
        star(c, fx, fy, R * 0.22, t * 9);
      }
      c.restore();
      // 提示：高亮搭档
      if (!b.ui && F.hintOn && F.held && (b.kind === 'part' || b.kind === 'char') && (canPair(b.comp, F.held.comp) || F.held.wordFor === b)) {
        const s = 0.5 + 0.5 * Math.sin(t * 7);
        c.lineWidth = 4 + 3 * s; c.strokeStyle = 'rgba(255,228,92,' + (0.6 + 0.4 * s).toFixed(2) + ')';
        c.beginPath(); c.arc(x, y, R + 6 + 4 * s, 0, TAU); c.stroke();
        g.emoji('👇', x, y - R - 26 * L.k - 8 * s, 34 * L.k);
      }
    }
    function star(c, x, y, r, rot) {
      c.save(); c.translate(x, y); c.rotate(rot || 0);
      c.beginPath();
      for (let i = 0; i < 8; i++) { const rr = i % 2 ? r * 0.36 : r; const a = i * Math.PI / 4; c.lineTo(Math.cos(a) * rr, Math.sin(a) * rr); }
      c.closePath(); c.fill(); c.restore();
    }

    /* ================= 场景 ================= */
    function drawScenery(g, c, t) {
      const w = g.w, h = g.h;
      const seaY = L.oy + L.jh * 0.46, sandY = L.oy + L.jh - 4 * L.k;
      c.fillStyle = lgrad(c, 'sea', 0, seaY, 0, sandY, [0, '#7FE0F0', 0.35, '#2FB7D9', 1, '#1784BE']);
      c.fillRect(0, seaY, w, sandY - seaY + 2);
      // 波浪
      c.strokeStyle = 'rgba(255,255,255,.7)'; c.lineWidth = 3 * L.k; c.lineCap = 'round';
      for (let row = 0; row < 3; row++) {
        const yy = seaY + 6 * L.k + row * (sandY - seaY) * 0.28;
        c.globalAlpha = 0.75 - row * 0.2;
        c.beginPath();
        for (let x = -20; x <= w + 20; x += 16) {
          const y = yy + Math.sin(x * 0.035 + t * (1.4 - row * 0.3) + row) * 3.2 * L.k;
          if (x === -20) c.moveTo(x, y); else c.lineTo(x, y);
        }
        c.stroke();
      }
      c.globalAlpha = 1;
      // 沙滩
      c.fillStyle = lgrad(c, 'sand', 0, sandY, 0, h, [0, '#FBE3A6', 1, '#EFC877']);
      c.beginPath(); c.moveTo(0, sandY + 8 * L.k);
      for (let x = 0; x <= w; x += 24) c.lineTo(x, sandY + Math.sin(x * 0.02) * 4 * L.k);
      c.lineTo(w, h); c.lineTo(0, h); c.closePath(); c.fill();
      // 两边的椰子树 / 小装饰（电脑横屏空间大）
      if (L.wide) {
        palm(c, L.ox * 0.22, sandY + 6, 1.15 * L.k, t, 0);
        palm(c, w - L.ox * 0.2, sandY + 6, 1.0 * L.k, t, 1.3);
        g.emoji('🐚', L.ox * 0.62, h - 14 * L.k, 26 * L.k);
        g.emoji('🦀', w - L.ox * 0.55 + Math.sin(t * 0.8) * 30 * L.k, h - 16 * L.k, 28 * L.k);
        g.emoji('⭐', L.ox * 0.4, h - 10 * L.k, 20 * L.k);
      } else {
        g.emoji('🐚', 18 * L.k, h - 9 * L.k, 18 * L.k);
        g.emoji('🦀', w - 22 * L.k + Math.sin(t * 0.9) * 6 * L.k, h - 10 * L.k, 20 * L.k);
      }
    }
    function palm(c, x, y, s, t, ph) {
      const sway = Math.sin(t * 1.1 + ph) * 0.05;
      c.save(); c.translate(x, y); c.scale(s, s); c.rotate(sway);
      c.strokeStyle = '#8B5A2B'; c.lineWidth = 12; c.lineCap = 'round';
      c.beginPath(); c.moveTo(0, 0); c.quadraticCurveTo(14, -90, -6, -190); c.stroke();
      c.strokeStyle = '#6E4420'; c.lineWidth = 2;
      for (let i = 1; i < 9; i++) { const yy = -i * 21; c.beginPath(); c.moveTo(-6 + i * 0.3, yy); c.lineTo(8 - i * 0.6, yy - 3); c.stroke(); }
      c.translate(-6, -190);
      const cols = ['#2FA35A', '#3BBF6A', '#27904E'];
      for (let i = 0; i < 6; i++) {
        const a = -Math.PI / 2 + (i - 2.5) * 0.55 + Math.sin(t * 1.6 + i + ph) * 0.06;
        c.save(); c.rotate(a);
        c.fillStyle = cols[i % 3]; c.strokeStyle = '#1D6B3A'; c.lineWidth = 2.5;
        c.beginPath(); c.moveTo(0, 0); c.quadraticCurveTo(50, -26, 96, 12); c.quadraticCurveTo(48, -2, 0, 0); c.fill(); c.stroke();
        c.restore();
      }
      c.fillStyle = '#6B4A2A';
      c.beginPath(); c.arc(-6, 6, 8, 0, TAU); c.arc(7, 8, 7, 0, TAU); c.fill();
      c.restore();
    }
    function jarPath(c, pad) {
      const x0 = L.ox - pad, y0 = L.oy - 6 * L.k, x1 = L.ox + L.jw + pad, y1 = L.oy + L.jh + pad, r = Math.min(34 * L.k, L.jw * 0.1);
      c.beginPath();
      c.moveTo(x0, y0);
      c.lineTo(x0, y1 - r); c.quadraticCurveTo(x0, y1, x0 + r, y1);
      c.lineTo(x1 - r, y1); c.quadraticCurveTo(x1, y1, x1, y1 - r);
      c.lineTo(x1, y0);
    }
    function drawJarBack(g, c) {
      const t = Math.max(5, 9 * L.k);
      // 木头台子
      const tx = L.ox - 26 * L.k, tw = L.jw + 52 * L.k, ty = L.oy + L.jh + t - 2, th = Math.max(10, L.tableH + 4);
      g.rrect(tx, ty, tw, th, 8 * L.k, '#C98A4B', NAVY, 3);
      c.fillStyle = 'rgba(255,255,255,.25)'; c.fillRect(tx + 8, ty + 4, tw - 16, 3);
      g.text('汉字罐', L.ox + L.jw / 2, ty + th / 2 + 1, { font: 'round', size: Math.min(th * 0.62, 18 * L.k), color: '#FFF3D6', maxW: tw * 0.5 });
      // 玻璃（半透明，背景看得见）
      jarPath(c, t); c.closePath();
      c.fillStyle = 'rgba(232,248,255,.62)'; c.fill();
      jarPath(c, 0); c.closePath();
      c.fillStyle = lgrad(c, 'jarin', 0, L.oy, 0, L.oy + L.jh, [0, 'rgba(255,255,255,.55)', 1, 'rgba(190,228,246,.55)']);
      c.fill();
    }
    function drawJarFront(g, c, t) {
      const tw = Math.max(5, 9 * L.k);
      // 高光条
      c.fillStyle = 'rgba(255,255,255,.28)';
      g.rrect(L.ox + 10 * L.k, L.oy + L.jh * 0.12, 9 * L.k, L.jh * 0.7, 5 * L.k, 'rgba(255,255,255,.26)');
      g.rrect(L.ox + 24 * L.k, L.oy + L.jh * 0.2, 4 * L.k, L.jh * 0.35, 2 * L.k, 'rgba(255,255,255,.2)');
      // 外框
      jarPath(c, tw); c.lineWidth = 3.5; c.strokeStyle = NAVY; c.lineJoin = 'round'; c.stroke();
      jarPath(c, 0); c.lineWidth = 2; c.strokeStyle = 'rgba(29,43,83,.35)'; c.stroke();
      // 罐口
      const lipH = 10 * L.k;
      g.rrect(L.ox - tw - 5 * L.k, L.oy - 6 * L.k - lipH, tw + 12 * L.k, lipH, 4 * L.k, '#DDF4FF', NAVY, 3);
      g.rrect(L.ox + L.jw - 7 * L.k, L.oy - 6 * L.k - lipH, tw + 12 * L.k, lipH, 4 * L.k, '#DDF4FF', NAVY, 3);
      // 红线
      const ry = SY(RED);
      const dz = F ? clamp(F.danger / prm.grace, 0, 1) : 0;
      const pulse = dz > 0 ? 0.5 + 0.5 * Math.sin(t * (10 + dz * 12)) : 0;
      c.save();
      c.setLineDash([10 * L.k, 8 * L.k]); c.lineDashOffset = -t * 20;
      c.lineWidth = 3 + dz * 3 + pulse * 2;
      c.strokeStyle = dz > 0 ? 'rgba(255,40,40,' + (0.6 + 0.4 * pulse).toFixed(2) + ')' : 'rgba(255,90,90,.55)';
      c.beginPath(); c.moveTo(L.ox + 4, ry); c.lineTo(L.ox + L.jw - 4, ry); c.stroke();
      c.restore();
      if (dz > 0) {
        c.fillStyle = 'rgba(255,40,40,' + (0.1 + 0.18 * pulse).toFixed(2) + ')';
        c.fillRect(L.ox, L.oy, L.jw, ry - L.oy);
        const left = Math.max(0, prm.grace - F.danger);
        g.shadowText('快满啦！' + left.toFixed(1), L.ox + L.jw / 2, ry + 26 * L.k, { size: 26 * L.k, color: '#FFE45C', stroke: '#B81E14' });
      }
    }

    /* ---------- 云朵投手 + 举着的球 + 瞄准线 ---------- */
    const cloudScale = () => clamp(1.0 * L.k * (L.wide ? 1.05 : 0.9), 0.7, 1.4);
    function drawDropper(g, c, t) {
      if (!F) return;
      const held = F.held;
      const hr = radiusOf(held ? held.kind : 'part');
      const ax = clamp(F.aimX, hr + 2, JW - hr - 2);
      const x = SX(ax);
      const cy = L.cloudY + Math.sin(t * 2.2) * 3 * L.k;
      const R = hr * L.S;
      const by = SY(hr + 6);
      if (held) {
        // 瞄准虚线 + 落点影子
        const ly = landingY(ax, hr);
        c.save();
        c.setLineDash([6 * L.k, 7 * L.k]); c.lineDashOffset = -t * 30;
        c.strokeStyle = 'rgba(255,255,255,.9)'; c.lineWidth = 2.5 * L.k;
        c.beginPath(); c.moveTo(x, by + R); c.lineTo(x, SY(ly)); c.stroke();
        c.setLineDash([5 * L.k, 5 * L.k]);
        c.strokeStyle = 'rgba(29,43,83,.45)'; c.lineWidth = 2;
        c.beginPath(); c.arc(x, SY(ly), R, 0, TAU); c.stroke();
        c.restore();
      }
      // 线
      c.strokeStyle = 'rgba(29,43,83,.6)'; c.lineWidth = 2;
      c.beginPath(); c.moveTo(x, cy + 10 * L.k); c.lineTo(x, by - R * 0.9); c.stroke();
      // 云
      const cs = cloudScale();
      g.cloud(x, cy, cs, 1);
      c.fillStyle = NAVY;
      const ex = 13 * cs, ey = cy + 2 * cs;
      const blink = (Math.floor(t * 10) % 37) === 0;
      if (blink) { c.fillRect(x - ex - 4, ey, 8, 2); c.fillRect(x + ex - 4, ey, 8, 2); }
      else { c.beginPath(); c.arc(x - ex, ey, 3.4 * cs, 0, TAU); c.arc(x + ex, ey, 3.4 * cs, 0, TAU); c.fill(); }
      c.fillStyle = 'rgba(255,120,150,.5)';
      c.beginPath(); c.arc(x - ex - 9 * cs, ey + 6 * cs, 4 * cs, 0, TAU); c.arc(x + ex + 9 * cs, ey + 6 * cs, 4 * cs, 0, TAU); c.fill();
      c.strokeStyle = NAVY; c.lineWidth = 2;
      c.beginPath(); c.arc(x, ey + 4 * cs, 5 * cs, 0.15 * Math.PI, 0.85 * Math.PI); c.stroke();
      if (!held) return;
      const p = F.heldPop < 1 ? oBack(F.heldPop) : 1;
      const fake = { ui: true, body: { position: { x: ax, y: hr + 6 }, angle: Math.sin(t * 2) * 0.2 }, r: hr, kind: held.kind, comp: held.comp, ci: hashStr(held.comp) % PAL.length, pop: 1, sq: 0, age: 0, ph: 0, lifeMax: 0 };
      c.save(); c.translate(x, by); c.scale(p, p); c.translate(-x, -by);
      drawBall(g, c, fake, t);
      c.restore();
      // 自动丢的倒计时环
      if (g.state === 'play' && !F.tut) {
        const u = clamp(F.autoT / prm.autoDrop, 0, 1);
        if (u > 0.35) {
          c.lineWidth = 4 * L.k; c.lineCap = 'round';
          c.strokeStyle = u > 0.75 ? '#FF5A5F' : '#FFB347';
          c.beginPath(); c.arc(x, by, R + 7 * L.k, -Math.PI / 2, -Math.PI / 2 + TAU * (1 - u)); c.stroke();
        }
      }
    }

    /* ---------- 海鸥（送部件） ---------- */
    function gullY(gl) { return L.cloudY - 58 * L.k + Math.sin(gl.t * 5) * 4 * L.k; }
    function gullCargoY(gl) { return gullY(gl) + 16 * L.k + prm.rPart * L.S * 0.78; }
    function drawGulls(g, c, t) {
      for (const gl of F.gulls) {
        const x = SX(gl.x), k = L.k;
        const y = gullY(gl);
        if (gl.state === 'in') {   // 爪子下面抓着一个小一号的部件（和云朵手上的区分开）
          const R = prm.rPart * L.S * 0.78;
          const fake = { ui: true, body: { position: { x: 0, y: 0 }, angle: Math.sin(gl.t * 6) * 0.25 }, r: R / L.S, kind: 'part', comp: gl.comp, ci: hashStr(gl.comp) % PAL.length, pop: 1, sq: 0, age: 0, ph: 2, lifeMax: 0 };
          const ox = L.ox, oy = L.oy;
          L.ox = x; L.oy = y + 16 * k + R;
          drawBall(g, c, fake, t);
          L.ox = ox; L.oy = oy;
        }
        gull(c, x, y, 1.05 * k, gl.dir, gl.t);
      }
    }
    function gull(c, x, y, s, dir, t) {
      c.save(); c.translate(x, y); c.scale(dir * s, s);
      const f = Math.sin(t * 16);
      c.lineJoin = 'round'; c.lineWidth = 2.5; c.strokeStyle = NAVY;
      // 远侧翅膀
      c.fillStyle = '#DCE6F2';
      c.beginPath(); c.moveTo(-4, -4); c.quadraticCurveTo(-10, -22 - 14 * f, -30, -26 - 18 * f); c.quadraticCurveTo(-16, -8, -4, -4); c.fill(); c.stroke();
      // 身体
      c.fillStyle = '#FFFFFF';
      c.beginPath(); c.ellipse(0, 0, 22, 11, 0, 0, TAU); c.fill(); c.stroke();
      // 尾巴
      c.beginPath(); c.moveTo(-20, -2); c.lineTo(-32, -8); c.lineTo(-30, 4); c.closePath(); c.fillStyle = '#C9D4E2'; c.fill(); c.stroke();
      // 头
      c.fillStyle = '#FFFFFF';
      c.beginPath(); c.arc(18, -8, 9, 0, TAU); c.fill(); c.stroke();
      c.fillStyle = '#FFB020';
      c.beginPath(); c.moveTo(25, -9); c.lineTo(36, -5); c.lineTo(25, -3); c.closePath(); c.fill(); c.stroke();
      c.fillStyle = NAVY; c.beginPath(); c.arc(20, -10, 2.2, 0, TAU); c.fill();
      // 近侧翅膀
      c.fillStyle = '#EEF3FA';
      c.beginPath(); c.moveTo(-2, -2); c.quadraticCurveTo(4, -24 - 16 * f, -18, -30 - 20 * f); c.quadraticCurveTo(-10, -8, -2, -2); c.fill(); c.stroke();
      // 脚（抓着线）
      c.strokeStyle = '#FF9A1F'; c.lineWidth = 2.5;
      c.beginPath(); c.moveTo(-2, 10); c.lineTo(-2, 16); c.moveTo(4, 10); c.lineTo(4, 16); c.stroke();
      c.restore();
    }

    /* ---------- 上方：提示按钮 / 字卡架 / 下一个 ---------- */
    function drawUI(g, c, t) {
      if (!F) return;
      const k = L.k;
      // 下一个
      const nb = L.next;
      // 手机：“下一个”和“还剩几个”挂在云朵两边；一边放不下就一起放到宽的那一边
      const hr0 = F.held ? radiusOf(F.held.kind) : prm.rPart;
      const cx0 = SX(clamp(F.aimX, hr0 + 2, JW - hr0 - 2));
      const half = 56 * cloudScale();
      const pillW = 56 * k;
      let pillX;
      if (nb.follow) {
        const nbOff = half + nb.r + 6, pillOff = half + pillW / 2 + 6;
        const roomR = L.w - cx0, roomL = cx0;
        const needNb = nbOff + nb.r + 4, needPill = pillOff + pillW / 2 + 4;
        if (roomR >= needNb && roomL >= needPill) { nb.cx = cx0 + nbOff; pillX = cx0 - pillOff; }
        else if (roomL >= needNb && roomR >= needPill) { nb.cx = cx0 - nbOff; pillX = cx0 + pillOff; }
        else if (roomR >= roomL) { nb.cx = cx0 + nbOff; pillX = nb.cx + nb.r + 8 + pillW / 2; }
        else { nb.cx = cx0 - nbOff; pillX = nb.cx - nb.r - 8 - pillW / 2; }
        nb.cy = L.cloudY + Math.sin(t * 2.2 + 0.6) * 3 * k;
      } else pillX = null;
      c.fillStyle = 'rgba(255,251,239,.95)'; c.strokeStyle = NAVY; c.lineWidth = 3;
      c.beginPath(); c.arc(nb.cx, nb.cy, nb.r, 0, TAU); c.fill(); c.stroke();
      if (F.next) {
        const rr = nb.r * 0.72;
        const nx = F.next;
        const fake = { ui: true, body: { position: { x: 0, y: 0 }, angle: 0 }, r: rr / L.S, kind: nx.kind, comp: nx.comp, ci: hashStr(nx.comp) % PAL.length, pop: 1, sq: 0, age: 0, ph: 1, lifeMax: 0 };
        const saveOx = L.ox, saveOy = L.oy;
        L.ox = nb.cx; L.oy = nb.cy + 2 * k;
        drawBall(g, c, fake, t);
        L.ox = saveOx; L.oy = saveOy;
      }
      g.text('下一个', nb.cx, nb.cy + nb.r + (L.wide ? 16 : 8) * k, { font: 'round', size: (L.wide ? 17 : 11) * k, color: NAVY, stroke: '#FFFFFF', strokeW: 3 });
      // 口袋里还剩几个部件（跟着云朵，放在“下一个”的另一边）
      {
        const left = piecesLeft();
        const px = pillX != null ? pillX : (cx0 - half - pillW / 2 - 6 < 0 ? cx0 + half + pillW / 2 + 6 : cx0 - half - pillW / 2 - 6);
        const py = L.cloudY + Math.sin(t * 2.2 + 1.2) * 3 * k;
        const low = left <= 3;
        const pulse = low ? 1 + 0.08 * Math.sin(t * 9) : 1;
        c.save(); c.translate(px, py); c.scale(pulse, pulse);
        g.rrect(-28 * k, -17 * k + 3, 56 * k, 34 * k, 17 * k, 'rgba(29,43,83,.35)');
        g.rrect(-28 * k, -17 * k, 56 * k, 34 * k, 17 * k, low ? '#FF6B6B' : '#FFFBEF', NAVY, 2.5);
        g.emoji('🎒', -12 * k, 0, 20 * k);
        g.text(String(left), 11 * k, 1, { font: 'num', size: 20 * k, color: low ? '#FFFFFF' : NAVY });
        c.restore();
        g.text('还剩', px, py - 25 * k, { font: 'round', size: 11 * k, color: NAVY, stroke: '#FFFFFF', strokeW: 3 });
      }
      // 提示按钮
      const hb = L.hint;
      const on = F.hints > 0 && F.held && F.held.kind === 'part';
      g.rrect(hb.x, hb.y + 4, hb.w, hb.h, 14 * k, on ? '#C98500' : '#7C8594');
      g.rrect(hb.x, hb.y, hb.w, hb.h, 14 * k, on ? '#FFD84A' : '#C4CAD3', NAVY, 3);
      if (L.wide) {
        g.emoji('💡', hb.x + 26 * k, hb.y + hb.h / 2, 30 * k);
        g.text('提示 ×' + F.hints, hb.x + hb.w / 2 + 16 * k, hb.y + hb.h / 2 + 1, { font: 'round', size: 20 * k, color: NAVY });
        let yy = hb.y + hb.h + 34 * k;
        if (F.bombQ > 0 || (F.next && F.next.kind === 'bomb') || (F.held && F.held.kind === 'bomb')) {
          const nB = F.bombQ + (F.next && F.next.kind === 'bomb' ? 1 : 0) + (F.held && F.held.kind === 'bomb' ? 1 : 0);
          g.emoji('🧨', L.lcx - 30 * k, yy, 30 * k);
          g.text('爆竹 ×' + nB, L.lcx + 16 * k, yy, { font: 'round', size: 19 * k, color: NAVY, stroke: '#FFFFFF', strokeW: 3 });
          yy += 40 * k;
        }
        if (L.h < 480) {
          // 手机横着拿：罐子是竖的，只剩一小条高度，球小得看不清 → 提醒竖过来（电脑窗口不会这么矮）
          const msg = '📱 竖着拿，字更大', fs = 15 * k, tw = g.measure(msg, fs, 'round') + 24 * k;
          const py = Math.max(L.top + 18 * k, L.next.cy - L.next.r - 34 * k);
          g.rrect(L.lcx - tw / 2, py - 15 * k, tw, 30 * k, 15 * k, 'rgba(29,43,83,.85)');
          g.text(msg, L.lcx, py + 1, { font: 'round', size: fs, color: '#FFFFFF' });
        } else {
          const lines = ['← → 移动', '空格 丢下', '↑ 提示'];
          lines.forEach((s, i) => g.text(s, L.lcx, yy + i * 26 * k, { font: 'round', size: 16 * k, color: 'rgba(29,43,83,.75)' }));
        }
      } else {
        g.emoji('💡', hb.x + hb.w / 2, hb.y + hb.h / 2 - 1, hb.w * 0.56);
        c.fillStyle = on ? '#FF5A5F' : '#7C8594';
        c.beginPath(); c.arc(hb.x + hb.w - 3, hb.y + 5, 10 * k, 0, TAU); c.fill();
        g.text(String(F.hints), hb.x + hb.w - 3, hb.y + 5.5, { font: 'num', size: 14 * k, color: '#FFFFFF' });
      }
      // 字卡架
      const cg = cardGeom();
      if (L.shelf.vertical) g.text('要合成的字', L.rcx, L.shelf.y + 12 * k, { font: 'round', size: 20 * k, color: NAVY, stroke: '#FFFFFF', strokeW: 4 });
      F.cards.forEach((cd, i) => {
        const p = cardCenter(i);
        const sc = 1 + 0.25 * Math.sin(Math.min(1, cd.bump) * Math.PI) * (cd.bump > 0 ? 1 : 0);
        const fl = cd.flip > 0 ? Math.abs(Math.cos(cd.flip * Math.PI)) : 1;
        const cw = cg.cw * sc * fl, ch = cg.ch * sc;
        const x = p.x - cw / 2, y = p.y - ch / 2;
        const made = cd.made > 0;
        if (cw < 3) return;
        g.rrect(x, y + 3, cw, ch, 9 * k, made ? '#C98500' : 'rgba(29,43,83,.35)');
        g.rrect(x, y, cw, ch, 9 * k, made ? '#FFE27A' : '#FFF8E6', NAVY, 2.5);
        // 有拼音的卡：字小一点、往上提，拼音用深一点的颜色——原来字的最后一笔压住了声调（péng、zǎo 看成 peng、zao）
        const fs = Math.min(cw * (prm.cardPy ? 0.7 : 0.78), ch * (prm.cardPy ? 0.5 : 0.72));
        const cyy = prm.cardPy ? y + ch * 0.37 : y + ch * 0.5;
        g.text(cd.rec.ans, p.x, cyy, { font: 'kai', size: fs, color: made ? '#B3261E' : '#8FA0BA', weight: 700, maxW: cw * 0.9 });
        if (prm.cardPy && cd.rec.py) g.text(cd.rec.py, p.x, y + ch * 0.83, { font: 'py', size: Math.max(9, Math.min(13 * k, cw * 0.26)), color: made ? '#7A3E00' : '#5B6B88', weight: 700, maxW: cw * 0.94 });
        if (cd.made > 0) {
          c.fillStyle = '#FF5A5F';
          const bx = x + cw - 4, byy = y + 4;
          c.beginPath(); c.arc(bx, byy, 9 * k, 0, TAU); c.fill();
          g.text(cd.made >= prm.rotN ? '✓' : '×' + cd.made, bx, byy + 0.5, { font: 'num', size: 11 * k, color: '#FFFFFF' });
        }
      });
      if (F.hintMsg > 0 && F.hintText) {
        const a = clamp(F.hintMsg / 0.3, 0, 1);
        const y = L.wide ? L.hint.y - 22 * k : L.rowY + L.rowH + 14 * k;
        const x = L.wide ? L.lcx : L.w / 2;
        const tw = g.measure(F.hintText, 15 * k, 'round') + 28 * k;
        c.globalAlpha = a;
        g.rrect(x - tw / 2, y - 15 * k, tw, 30 * k, 15 * k, 'rgba(29,43,83,.88)');
        g.text(F.hintText, x, y, { font: 'round', size: 15 * k, color: '#FFFFFF' });
        c.globalAlpha = 1;
      }
    }

    /* ---------- 教学手指 ---------- */
    function drawTutorial(g, c, t) {
      if (!F || !F.tut || !F.tut.target || F.tut.target.dead || !F.held || g.state !== 'play') return;   // 倒计时时别叠在说明上
      if (F.banners.some((bn) => bn.kind === 'goal')) return;   // 先让“合成 N 个字”说完
      const b = F.tut.target;
      drawBall(g, c, b, t);   // 目标球再画一遍盖在最上面：旁边的球压着它时，手指不会像是指着压在上面的那个
      const x = SX(b.body.position.x), y = SY(b.body.position.y), R = b.r * L.S;
      const s = 0.5 + 0.5 * Math.sin(t * 6);
      c.lineWidth = 4; c.strokeStyle = 'rgba(255,228,92,' + (0.55 + 0.45 * s).toFixed(2) + ')';
      c.beginPath(); c.arc(x, y, R + 6 + 5 * s, 0, TAU); c.stroke();
      g.emoji('👇', x, y - R - 30 * L.k - 10 * s, 44 * L.k);
      const msg = '把「' + F.held.comp + '」丢到「' + b.comp + '」上！';
      const fs = 19 * L.k;
      const tw = g.measure(msg, fs, 'round') + 30 * L.k;
      // 有“变成石头啦”之类的横幅时，气泡往下让一让（别叠在一起）
      const busy = F.banners.some((bn) => bn.kind === 'stone' || bn.kind === 'bomb' || bn.kind === 'rescue');
      const bx = clamp(L.ox + L.jw / 2, tw / 2 + 6, L.w - tw / 2 - 6), byy = SY(RED) + (busy ? 130 : 46) * L.k;
      g.rrect(bx - tw / 2, byy - 21 * L.k + 3, tw, 42 * L.k, 21 * L.k, 'rgba(29,43,83,.4)');
      g.rrect(bx - tw / 2, byy - 21 * L.k, tw, 42 * L.k, 21 * L.k, '#FFFBEF', NAVY, 3);
      g.text(msg, bx, byy + 1, { font: 'round', size: fs, color: NAVY });
    }

    /* ---------- 飘字 / 横幅 / 飞向字卡 ---------- */
    function drawFx(g, c) {
      for (const gh of F.ghosts) {
        const u = clamp(gh.t / 0.14, 0, 1);
        const x = SX(lerp(gh.x, gh.tx, oCubic(u))), y = SY(lerp(gh.y, gh.ty, oCubic(u)));
        const sc = 1 - 0.5 * u;
        c.globalAlpha = 1 - u * 0.8;
        const sp = ballSprite(gh.kind === 'char' ? 'char' : 'part', gh.ci, gh.r * L.S);
        c.drawImage(sp.cv, x - sp.size / 2 * sc, y - sp.size / 2 * sc, sp.size * sc, sp.size * sc);
        c.globalAlpha = 1;
      }
      for (const p of F.puffs) {
        const u = clamp(p.t / 0.45, 0, 1);
        const x = SX(p.x), y = SY(p.y) - (p.bubble ? u * 90 * L.k : 0), R = p.r * L.S * (1 + u * 0.6);
        c.globalAlpha = (1 - u) * 0.8;
        c.strokeStyle = p.col; c.lineWidth = 4;
        c.beginPath(); c.arc(x, y, R, 0, TAU); c.stroke();
        if (p.bubble) { c.fillStyle = 'rgba(200,240,255,.35)'; c.fill(); }
        c.globalAlpha = 1;
      }
      for (const fl of F.flyers) {
        const u = clamp(fl.t / fl.dur, 0, 1), e = oCubic(u);
        const x = lerp(fl.x0, fl.tx, e), y = lerp(fl.y0, fl.ty, e) - Math.sin(u * Math.PI) * 60 * L.k;
        const R = lerp(fl.r0, 16 * L.k, e);
        const sp = ballSprite('char', 0, fl.r0);
        const sc = R / fl.r0;
        c.drawImage(sp.cv, x - sp.size / 2 * sc, y - sp.size / 2 * sc, sp.size * sc, sp.size * sc);
        g.text(fl.ch, x, y - R * 0.08, { font: 'kai', size: R * 1.1, color: '#B3261E', weight: 700 });
      }
      for (const lb of F.labels) {
        const u = clamp(lb.t / 1.7, 0, 1);
        const a = u < 0.8 ? 1 : 1 - (u - 0.8) / 0.2;
        const y = lb.y - oCubic(Math.min(1, u * 1.6)) * 34 * L.k;
        const x = clamp(lb.x, 70 * L.k, L.w - 70 * L.k);
        const k = L.k;
        const txt = lb.word ? lb.word : '';
        const tw = Math.max(80 * k, g.measure(txt, 20 * k, 'kai') + 70 * k);
        c.globalAlpha = a;
        g.rrect(x - tw / 2, y - 22 * k, tw, 44 * k, 14 * k, 'rgba(255,251,239,.95)', '#B35A00', 3);
        g.text(lb.ch, x - tw / 2 + 24 * k, y - 1, { font: 'kai', size: 30 * k, color: '#B3261E', weight: 700 });
        if (lb.py) g.text(lb.py, x - tw / 2 + 24 * k, y - 26 * k, { font: 'py', size: 13 * k, color: '#7A3E00', weight: 700 });
        if (txt) g.text(txt, x + 18 * k, y + 1, { font: 'kai', size: 22 * k, color: NAVY, weight: 700, maxW: tw - 60 * k });
        c.globalAlpha = 1;
      }
      for (const bn of F.banners) {
        const u = clamp(bn.t / bn.life, 0, 1);
        const a = u < 0.75 ? 1 : 1 - (u - 0.75) / 0.25;
        const sIn = Math.min(1, bn.t / 0.25);
        const sc = oBack(sIn);
        const y = bn.y - u * 36 * L.k;
        const k = L.k;
        c.globalAlpha = a;
        c.save(); c.translate(bn.x, y); c.scale(sc, sc);
        if (bn.kind === 'word') {
          const fs = 50 * k, tw = g.measure(bn.big, fs, 'kai', 700) + 50 * k;
          g.rrect(-tw / 2, -40 * k + 4, tw, 90 * k, 22 * k, '#C2185B');
          g.rrect(-tw / 2, -40 * k, tw, 90 * k, 22 * k, '#FF7AB6', NAVY, 4);
          if (bn.small) g.text(bn.small, 0, -22 * k, { font: 'py', size: 17 * k, color: '#FFFFFF', weight: 700 });
          g.text(bn.big, 0, 14 * k, { font: 'kai', size: fs, color: '#FFFFFF', weight: 700, stroke: '#8E1045', strokeW: 5 });
          g.shadowText('词语爆破！', 0, -58 * k, { size: 22 * k, color: '#FFE45C' });
        } else {
          g.shadowText(bn.big, 0, 0, { size: (bn.kind === 'boom' ? 44 : 34) * k, color: bn.kind === 'rescue' ? '#9FE8FF' : '#FFE45C' });
          if (bn.small) g.shadowText(bn.small, 0, 34 * k, { size: 18 * k, color: '#FFFFFF' });
          if (bn.recipes && bn.recipes.length) {   // 输了：没合成的字的配方（楷体）
            const rh = 44 * k, rw = Math.min(L.w - 24, 330 * k);
            bn.recipes.forEach((r, i) => {
              const yy = 78 * k + i * (rh + 8 * k);
              g.rrect(-rw / 2, yy - rh / 2, rw, rh, 14 * k, 'rgba(255,251,239,.95)', NAVY, 2.5);
              g.text(r.ans + ' = ' + r.a + ' + ' + r.b, 0, yy + 1, { font: 'kai', size: 28 * k, color: NAVY, weight: 700, maxW: rw - 20 });
            });
          }
        }
        c.restore();
        c.globalAlpha = 1;
      }
    }

    function drawOverlayMsg(g, c, title, sub) {
      const k = L.k, w = Math.min(L.w - 30, 340 * k), h = 130 * k;
      const x = L.w / 2 - w / 2, y = L.oy + L.jh * 0.35;
      g.rrect(x, y + 5, w, h, 22 * k, 'rgba(29,43,83,.45)');
      g.rrect(x, y, w, h, 22 * k, '#FFFBEF', NAVY, 4);
      g.text(title, L.w / 2, y + 44 * k, { font: 'round', size: 26 * k, color: NAVY, maxW: w - 30 });
      if (sub) g.text(sub, L.w / 2, y + 88 * k, { font: 'round', size: 16 * k, color: '#5A6680', maxW: w - 30 });
    }

    /* ================= 每帧 ================= */
    function tick(g, dt) {
      const sdt = dt * F.speed;
      F.time += sdt;
      // 键盘瞄准
      const hr = F.held ? radiusOf(F.held.kind) : prm.rPart;
      if (g.held.left) F.aimX -= 640 * sdt;
      if (g.held.right) F.aimX += 640 * sdt;
      F.aimX = clamp(F.aimX, hr + 2, JW - hr - 2);
      // 出球 / 自动丢
      if (!F.held) {
        F.cool -= sdt;
        if (F.cool <= 0 && (F.next || F.bag > 0 || F.bombQ > 0)) { nextPiece(); if (F.queued && F.held) { F.queued = false; drop(g, false); } }
      } else {
        F.heldPop = Math.min(1, F.heldPop + sdt * 5);
        const orphan = heldOrphan();
        F.orphanT = orphan ? (F.orphanT || 0) + sdt : 0;
        if (!F.tut && (!orphan || F.orphanT > 6)) {   // 手上的部件还没有搭档（海鸥正在送）时先不催（最多等 6 秒）
          F.autoT += sdt;
          if (F.autoT >= prm.autoDrop) drop(g, true);
        }
      }
      if (F.auto && F.held && g.state === 'play' && (F.auto === 'random' || (!F.pend.length && (!heldOrphan() || F.orphanT > 6)))) {
        F.autoWait += sdt;
        if (F.autoWait >= F.autoGap) {
          F.autoWait = 0;
          F.aimX = F.auto === 'random' ? rnd(0, JW) : smartX();
          drop(g, false);
        }
      }
      // 物理（固定步长）
      F.acc += sdt;
      let n = 0;
      while (F.acc >= STEP && n < 16 && g.state === 'play') {
        M.Engine.update(F.eng, STEP_MS);
        F.acc -= STEP; n++;
        processQueue(g);
      }
      if (n >= 16) F.acc = 0;
      if (g.state !== 'play') return;
      // 每个球
      let over = false;
      for (const b of F.balls) {
        if (b.dead) continue;
        b.age += sdt;
        b.sqv += (-b.sq * 320 - b.sqv * 16) * sdt;
        b.sq += b.sqv * sdt;
        if (b.pop < 1) b.pop = Math.min(1, b.pop + sdt * 4.5);
        const p = b.body.position;
        if (p.y > JH + 300 || p.x < -200 || p.x > JW + 200) { killBall(b); continue; }
        if (b.kind === 'char') {
          const waiting = (F.held && F.held.wordFor === b) || (F.next && F.next.wordFor === b);
          b.life = waiting ? Math.max(b.life - sdt, 1.5) : b.life - sdt;   // 组词部件还在云朵上：字球先别飞走
          if (b.life <= 0) { ascend(g, b); continue; }
        }
        if (b.kind !== 'char' && b.age > 1.0 && p.y - b.r < RED) over = true;
      }
      let j = 0;
      for (let i = 0; i < F.balls.length; i++) if (!F.balls[i].dead) F.balls[j++] = F.balls[i];
      F.balls.length = j;
      // 红线
      if (over) {
        F.danger += sdt;
        F.dTick -= sdt;
        if (F.dTick <= 0) { F.dTick = 0.5; g.sfx('tick'); }
        F.stats.maxDanger = Math.max(F.stats.maxDanger, F.danger);
        if (F.danger >= prm.grace) {
          if (F.rescue > 0) rescue(g);
          else {
            F.lost = true; g.shake(12);
            F.banners.push({ big: '罐子满啦！', small: '', x: g.w / 2, y: SY(RED) + 50 * L.k, t: 0, life: 3.4, kind: 'boom', recipes: revealList() });
            g.lose({ reveal: revealText() }); return;
          }
        }
      } else { F.danger = Math.max(0, F.danger - sdt * 1.5); F.dTick = 0; }
      // 刚丢下的球有没有合上（场上明明有搭档却没丢过去 → 断连击，不记错题）
      for (let i = F.pend.length - 1; i >= 0; i--) {
        const ld = F.pend[i];
        ld.t += sdt;
        if (ld.merged || ld.ball.dead) ld.judged = true;
        else if (ld.ball.landed) {
          ld.landT = F.time - (ld.ball.landAt || F.time);
          if (ld.landT > LAND_WIN + 0.05) {
            ld.judged = true;
            if (ld.ball.kind === 'part') { if (F.auto) (F.dlog = F.dlog || []).push('  xx stone ' + ld.ball.comp + ' partnerNow=' + hasPartner(ld.ball.comp)); toStone(g, ld.ball); }
            if (ld.partner && g.combo > 0) g.combo = 0;
          }
        }
        if (ld.judged) F.pend.splice(i, 1);
      }
      gullTick(g, sdt);
      // 口袋里的部件用完了：等罐子静下来，还没合够就算输
      if (!F.held && !F.next && F.bag <= 0 && F.bombQ <= 0) {
        F.outT += sdt;
        F.ending = true;
        if (F.outT > 2.2 && g.done < g.rounds) {
          F.banners.push({ big: '部件用完啦！', small: '找准搭档再丢哦', x: g.w / 2, y: SY(RED) + 50 * L.k, t: 0, life: 3.4, kind: 'boom', recipes: revealList() });
          g.lose({ reveal: revealText() }); return;
        }
      }
      rotateCards();
      if (F.hintMsg > 0) F.hintMsg -= sdt;
    }
    function fxTick(dt) {
      const upd = (arr, life) => { for (let i = arr.length - 1; i >= 0; i--) { arr[i].t += dt; if (arr[i].t >= (arr[i].life || arr[i].dur || life)) arr.splice(i, 1); } };
      upd(F.ghosts, 0.16); upd(F.puffs, 0.45); upd(F.labels, 1.7); upd(F.banners, 1.5);
      for (let i = F.flyers.length - 1; i >= 0; i--) {
        const fl = F.flyers[i];
        fl.t += dt;
        if (fl.t >= fl.dur) {
          F.flyers.splice(i, 1);
          if (fl.card) { fl.card.lit = 1; fl.card.bump = Math.max(fl.card.bump, 0.9); }
          F.g.burst(fl.tx, fl.ty, { kind: 'star', n: 8 });
          F.g.sfx('star');
        }
      }
      for (const cd of F.cards) {
        if (cd.bump > 0) cd.bump = Math.max(0, cd.bump - dt * 2.4);
        if (cd.flip > 0) cd.flip = Math.max(0, cd.flip - dt * 2.2);
      }
    }

    const api = {
      auto(mode, gap) { if (F) { F.auto = mode || null; if (gap) F.autoGap = gap; } return mode; },
      speed(n) { if (F) F.speed = Math.max(0.25, Math.min(8, +n || 1)); return F && F.speed; },
      drop(x) { if (!F) return false; if (x != null) F.aimX = +x; return drop(F.g, false); },
      aim(x) { if (F) F.aimX = +x; },
      hint() { if (F) useHint(F.g); },
      target() {   // 测试用：手上部件的最佳搭档在屏幕上的位置（没有就 null）
        if (!F || !F.held) return null;
        const b = F.held.kind === 'part' ? ((F.held.wordFor && !F.held.wordFor.dead) ? F.held.wordFor : bestPartner(F.held.comp, new Set())) : null;
        const lx = b ? b.body.position.x : smartX();
        return { x: SX(lx), y: SY(b ? b.body.position.y : JH / 2), comp: b ? b.comp : null, held: F.held.comp };
      },
      jar() { return { x: L.ox, y: L.oy, w: L.jw, h: L.jh }; },
      aimScreen() { return F ? SX(F.aimX) : 0; },
      spawn(kind, comp, x, y) {   // 测试用：直接往罐子里放一个球（kind: part|char）
        if (!F || !F.world) return null;
        const list = kind === 'char' ? DATA.all.filter((r) => r.ans === comp) : [];
        const b = mkBall(kind, comp, +x || JW / 2, y != null ? +y : JH - prm.rPart - 4, { rec: list[0] || null });
        if (kind === 'char') { b.life = b.lifeMax = 8; b.age = 0.5; }
        return b.id;
      },
      words() { return Array.from(DATA.words.values()).map((x) => x.w); },
      hintRect() { return L.hint; },
      cards() { if (!F) return []; const cg = cardGeom(); return F.cards.map((cd, i) => Object.assign({ ch: cd.rec.ans, w: cg.cw, h: cg.ch }, cardCenter(i))); },
      info() {
        if (!F) return null;
        return {
          mState, level: F.g.level, state: F.g.state, done: F.g.done, rounds: F.g.rounds, score: F.g.score, combo: F.g.combo,
          held: F.held && F.held.comp, next: F.next && F.next.comp, balls: liveBalls().map((b) => b.kind[0] + b.comp).join(''),
          nBalls: liveBalls().length, danger: +F.danger.toFixed(2), active: F.active.map((r) => r.a + '+' + r.b + '=' + r.ans).join(' '),
          stats: F.stats, pool: DATA.pool.length, fromRecipes: DATA.fromRecipes, words: DATA.words.size, hints: F.hints, bombQ: F.bombQ, t: +F.time.toFixed(1)
        };
      },
      data() { return { pool: DATA.pool.map((r) => r.a + '+' + r.b + '=' + r.ans + '(' + r.py + ',' + r.word + ')'), words: Array.from(DATA.words.values()).map((x) => x.w), chainable: Array.from(DATA.chainable) }; }
    };

    return {
      maxLevel: 10, lives: 0, music: 'bright', sky: 'day',
      rounds: (lv) => P(gn, lv).rounds,
      // 星星看瞄得准不准：变成石头的部件越少越好（通关至少 1 星；≥2 星才解锁下一关）
      stars(g, win) {
        if (!F) return null;
        const waste = F.stats.wasted, r = Math.max(1, g.rounds);
        return !win ? (g.done >= r * 0.5 ? 1 : 0) : waste <= Math.floor(r * 0.15) ? 3 : waste <= Math.ceil(r * 0.5) ? 2 : 1;
      },
      endDelay: (g, win) => (win ? 0.7 : 2.4),   // 输的时候先让“部件用完啦 / 罐子满啦”和楷体配方（晴 = 日 + 青）多显示一会儿（结算面板的“正确答案”不是楷体）
      intro: '把部件丢到它的“搭档”身上，就合成汉字！丢错了会变成石头',
      controls: '拖动瞄准、松手丢下 · 键盘 ← → 移动、空格丢下、↑ 提示',
      init(g) {
        G0 = g;
        teardown();
        prm = P(gn, g.level);
        try {   // 调参（只给测试脚本用：__suikaTune = {lv: 模拟第几关, ...覆盖参数}）
          const TU = W.__suikaTune;
          if (TU && typeof TU === 'object') { if (TU.lv) { prm = P(gn, TU.lv); g.rounds = prm.rounds; } Object.assign(prm, TU); }
        } catch (e) { /* ignore */ }
        F = newState(g);
        layout(g);
        try { W.__suika = { g, get F() { return F; }, api, DATA }; } catch (e) { /* ignore */ }
        if (M) buildWorld(g);
      },
      play(g) {
        if (!F) return;
        const dbl = F.active.find((r) => r.a === r.b);
        F.banners.push({ big: '合成 ' + g.rounds + ' 个字！', small: g.level === 1 && dbl ? '一样的也能合：' + dbl.a + '+' + dbl.b + '=' + dbl.ans : '', x: L.ox + L.jw / 2, y: SY(RED) + 70 * L.k, t: 0, life: 2.2, kind: 'goal' });
      },
      update(g, dt) {
        if (!F) return;
        if (!F.world) {
          if (mState === 'loading') { mWait += dt; if (mWait > 14) mState = 'fail'; }
          return;
        }
        tick(g, dt);
        fxTick(dt * F.speed);
      },
      draw(g, c) {
        const nm = nowMs();
        const rdt = lastDraw ? Math.min(0.05, (nm - lastDraw) / 1000) : 0;
        lastDraw = nm; animT += rdt;
        if (L.w !== g.w || L.h !== g.h || L.top !== g.hudTop) layout(g);
        const t = animT;
        drawScenery(g, c, t);
        drawJarBack(g, c);
        if (F && F.world) {
          if (g.state === 'over') fxTick(rdt);
          for (const b of F.balls) if (!b.dead && b.kind === 'stone') drawBall(g, c, b, t);
          for (const b of F.balls) if (!b.dead && (b.kind === 'part' || b.kind === 'bomb')) drawBall(g, c, b, t);
          for (const b of F.balls) if (!b.dead && b.kind === 'char') drawBall(g, c, b, t);
          // 💡 提示：搭档再画一遍盖在最上面（光圈和 👇 不被旁边的球挡住）
          if (F.hintOn && F.held && F.held.kind === 'part') for (const b of F.balls) if (!b.dead && (b.kind === 'part' || b.kind === 'char') && (canPair(b.comp, F.held.comp) || F.held.wordFor === b)) drawBall(g, c, b, t);
        }
        drawJarFront(g, c, t);
        if (F && F.world) {
          drawDropper(g, c, t);
          drawGulls(g, c, t);
          drawUI(g, c, t);
          drawFx(g, c);
          drawTutorial(g, c, t);
        } else if (F) {
          if (mState === 'fail') drawOverlayMsg(g, c, '物理积木没搬来 😢', '请检查网络，点一下罐子再试');
          else {
            drawOverlayMsg(g, c, '加载中…', '正在搬运物理积木');
            const k = L.k, cx = L.w / 2, cy = L.oy + L.jh * 0.35 + 150 * k;
            for (let i = 0; i < 3; i++) { c.fillStyle = PAL[i * 3][1]; c.beginPath(); c.arc(cx + (i - 1) * 26 * k, cy + Math.sin(t * 6 + i) * 8 * k, 9 * k, 0, TAU); c.fill(); }
          }
        }
      },
      down(g, p) {
        if (!F) return;
        if (!F.world) { if (mState === 'fail') { kickLoad(); } return; }
        if (g.hitRect(p, L.hint.x - 4, L.hint.y - 4, L.hint.w + 8, L.hint.h + 8)) { useHint(g); F.aiming = false; return; }
        if (!L.next.follow && g.hitCircle(p, L.next.cx, L.next.cy, L.next.r + 4)) { F.aiming = false; return; }
        // 点字卡 = 听一听这个字（不丢球）：原来点到卡片也会在卡片下面丢一个球，孩子想听字却白白丢掉一个部件
        const ci = cardAt(p);
        if (ci >= 0) {
          F.aiming = false;
          const cd = F.cards[ci], st = sayOf(cd.rec) || cd.rec.word;
          if (st) g.say(st, { caption: '' });
          cd.bump = Math.max(cd.bump, 0.5);
          return;
        }
        F.aiming = true;
        F.aimX = LX(p.x);
      },
      move(g, p) {
        if (!F || !F.world) return;
        if ((p.down && F.aiming) || (!p.down && p.type === 'mouse')) F.aimX = LX(p.x);
      },
      up(g, p) {
        if (!F || !F.world || !F.aiming) return;
        F.aiming = false;
        if (p && typeof p.x === 'number') F.aimX = LX(p.x);
        tryDrop(g);
      },
      key(g, k) {
        if (!F || !F.world) return;
        if (k === 'space' || k === 'down' || k === 'enter') tryDrop(g);
        else if (k === 'up' || k === 'h' || k === 'H') useHint(g);
        else if (k === 'a' || k === 'A') F.aimX -= 40;
        else if (k === 'd' || k === 'D') F.aimX += 40;
      },
      resize(g) { layout(g); },
      end() { teardown(); if (W.__suika && W.__suika.api === api) { try { delete W.__suika; } catch (e) { W.__suika = undefined; } } }
    };
  }

  HW.register({
    id: 'suika', skill: 'write', kind: 'arcade', name: '合成大汉字', icon: '🫙',
    blurb: '把部件丢进罐子，碰到搭档就合成汉字',
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
