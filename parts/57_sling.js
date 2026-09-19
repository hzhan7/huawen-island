/* =====================================================================
 * 华文小岛 3.0 · 🐦 组词弹弓（“愤怒的字”）（parts/57_sling.js）  skill: read
 * 契约：SPEC_V3.md（五关）+ SPEC_ARCADE.md §3；引擎：HW.arcade.run（parts/15_arcade.js）
 * 设计：research/GAME_SHORTLIST.md ⑥
 *
 * 玩法：弹弓上的小鸟肚子上写着一个中心字（如“火”）。右边有 3–4 座小堡垒，每座顶上的字怪举着一个字。
 *   拖动（或 ↑↓ 角度、←→ 力度、空格）把鸟弹出去：
 *   · 鸟第一下直接撞到的字怪能和中心字组成词（火＋车＝火车）→ 横幅“火车！”+ 朗读，堡垒炸飞、字怪变星星；
 *   · 组不成词 → 钢盾把鸟弹回来、扣 1 心，这个字怪戴上钢盔（错题本记一次）；
 *   · 什么也没打中 / 先撞到木块（擦边除外）再碰到字怪 / 发射时弹道根本没朝它去（气球字怪飘进弹道）/
 *     它挡在一只能组词的字怪前面 / 手抖擦边（见 judgedWrong）→ 鸟软软弹开，只算手没跟上（g.miss），不记错题。
 *     软弹开对字、错字一模一样（不亮钢盾），不能靠“不扣心的试探”看出答案。P2 / P3 前几关有黄色瞄准框：
 *     看着框套在错字上（停够 0.25 秒）松手，就算选了它。
 *   · 一甩就放（拉弓不到 0.3 秒 / 瞄准框刚落上去就松手）撞上错字：钢盾照弹、照样扣心降星（乱按会很快输），
 *     但 g.wrong(null) 不进错题本——狂点乱甩不是华文判断。
 *   每一波要把能组词的字都找出来（多个正确目标，不是单选）；小鸟整关共用，用完还有字怪没打 → 本关失败，
 *   结算面板给出这一波还没找到的词（心没了也一样）。
 *   打掉的堡垒连岛一起碎掉，不再挡后面的弹道。倒塌的积木 / 字怪有隐形围栏挡着，滚不到弹弓脚下；
 *   字怪被压住、没有任何干净弹道时挂上气球飘到打得到的地方（对字错字都救，不泄露答案），保证每关都打得完。
 * 关卡：每关 3 波，每波 2 个能组词的字 + 2 个错字（P3 起 6 关起横屏一波 3 个词）；P2 弹道全程预览 + 瞄准框 + 吸附、
 *   鸟多、拼音、点字朗读、教学小手；P3 起预览逐关变短、吸附变弱；气球字怪（上下飘）P2 6 关起、其它 4 关起；
 *   4 关起混石块、7 关起有冰块；8 关起夜景。竖屏最多 4 座（两列隔层浮空岛，部分换成不动的气球，保证每只都有好几条
 *   干净弹道），横屏最多 5 座。
 * 朗读：中心字（多音字读成“乐，欢乐的乐”）、打中的词；点字怪听读音（P2/P3，多音字不单读）。
 * 数据：优先 HW_DATA[grade].zuci（{c, ok:[{x,w}], bad:[...]}）；没有时用本文件内置的小兜底表（人工核对过）。
 *   运行时再做一道保险：bad 里的字若和中心字在题库任何词里相邻出现（火＋红 → “火红”），就不拿来当错字。
 *   交给 g.right / g.wrong 的 item 是规范化后的同一个对象（加了 hz = 中心字），错题本 key 前后一致。
 *   错题重练：记分用错题本里存的原 item（key 不变才能销账），但能不能组词按现在的题库判（见 freshReview）。
 *
 * 物理：matter-js 0.20.0（cdnjs 运行时加载，只加载一次；不用 Matter.Render / MouseConstraint，
 *   物理在 update 里 Engine.update，绘制全部自己画）。
 * 移植说明：发射/重装流程与手感参数改写自 matter-js 官方示例 examples/slingshot.js ——
 *   鸟（rock）density 0.004、“放手 → 鸟飞出 → 新鸟重新挂上皮兜”的流程、出膛限速（原 45 px/步，
 *   这里按屏幕尺寸换算成 vmax）。原示例用 MouseConstraint + 弹性 Constraint 拉鸟，这里按 SPEC_V3
 *   改成自己算拉开向量直接给初速度（弹道预览才能和实际飞行一致）；皮兜回弹是自写的阻尼振动动画。
 *   来源：https://github.com/liabru/matter-js/blob/master/examples/slingshot.js
 *   美术、音效全部重画 / WebAudio 合成，不用原仓库任何素材。matter.js 本体运行时从 cdnjs 加载，不内嵌。
 *   原示例所在仓库 liabru/matter-js 的 LICENSE（The MIT License，照录；另见仓库根目录 THIRD_PARTY_NOTICES.md）：
 *     Copyright (c) Liam Brummitt and contributors.
 *     Permission is hereby granted, free of charge, to any person obtaining a copy of this software and
 *     associated documentation files (the "Software"), to deal in the Software without restriction, including
 *     without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 *     copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the
 *     following conditions:
 *     The above copyright notice and this permission notice shall be included in all copies or substantial
 *     portions of the Software.
 *     THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT
 *     LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO
 *     EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER
 *     IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR
 *     THE USE OR OTHER DEALINGS IN THE SOFTWARE.
 * ===================================================================== */
(function () {
  'use strict';
  const W = window;
  const HW = W.HW;
  if (!HW || typeof HW.register !== 'function') return;

  const TAU = Math.PI * 2;
  const NAVY = '#1d2b53';
  const CREAM = '#FFFBEF';
  const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
  const lerp = (a, b, t) => a + (b - a) * t;
  const rnd = (a, b) => a + Math.random() * (b - a);
  const HZ1 = /^[㐀-鿿豈-﫿]$/;
  const isHz = (s) => typeof s === 'string' && HZ1.test(s);
  const str = (v) => (v == null ? '' : String(v));
  const oBack = (t) => { const s = 1.7, u = t - 1; return u * u * ((s + 1) * u + s) + 1; };
  const oCubic = (t) => { const u = 1 - t; return 1 - u * u * u; };
  function oBounce(t) {
    const n = 7.5625, d = 2.75;
    if (t < 1 / d) return n * t * t;
    if (t < 2 / d) { t -= 1.5 / d; return n * t * t + 0.75; }
    if (t < 2.5 / d) { t -= 2.25 / d; return n * t * t + 0.9375; }
    t -= 2.625 / d; return n * t * t + 0.984375;
  }

  /* ================= matter.js 加载（与 suika 共用 window.__hwMatterP，整页只加载一次） ================= */
  const MATTER_URL = 'https://cdnjs.cloudflare.com/ajax/libs/matter-js/0.20.0/matter.min.js';
  function loadMatter() {
    if (W.Matter && W.Matter.Engine) return Promise.resolve(W.Matter);
    if (!W.__hwMatterP) {
      W.__hwMatterP = new Promise((res, rej) => {
        const s = document.createElement('script');
        s.src = MATTER_URL; s.async = true; s.crossOrigin = 'anonymous';
        s.onload = () => (W.Matter ? res(W.Matter) : rej(new Error('matter missing')));
        s.onerror = () => rej(new Error('matter load failed'));
        (document.head || document.documentElement).appendChild(s);
      });
      W.__hwMatterP.catch(() => { W.__hwMatterP = null; });   // 失败后允许重试
    }
    return W.__hwMatterP;
  }

  /* ================= 兜底题（zuci 没生成时用；每条人工核对：ok 是真词，bad 前后都组不成词，字都在该年级字表内） =================
   * 格式：中心字:词,词,词:错字们 */
  const FALLBACK = {
    p2: ['火:火车,火山,火红:耳问鹿妈秋', '花:花园,开花,雪花:问跑耳铅胖', '心:小心,开心,心情:伞蚁铅鹿跑', '车:汽车,车站,火车:耳笑秋蚁问',
      '雨:下雨,雨伞,雨水:笔狮胖猫铅', '门:门口,开门,大门:鹿笑伞蚁胖', '树:大树,树叶,树林:耳笑问饼跑', '飞:飞机,起飞,飞快:妈床牛问铅'],
    p3: ['鱼:金鱼,小鱼,鱼尾:笔床伞医班', '雪:雪花,下雪,雪白:医班问腿笔', '书:书包,图书,书房:鸭腿暖猫雨', '跳:跳舞,跳高,心跳:书鸭雪暖医',
      '猫:小猫,熊猫,花猫:书雪医暖班', '包:书包,面包,包子:鸭雪腿跳困', '冬:冬天,冬瓜,寒冬:猫腿鸭书医', '脚:手脚,脚印,脚步:书雪暖班医'],
    p4: ['衣:衣服,雨衣,衣柜:鹅懒钱聚登', '钱:零钱,钱包,价钱:鹅飘懒晶厨', '鞋:鞋子,球鞋,拖鞋:鹅晶聚感趣', '病:生病,病人,看病:鹅飘晶鞋趣',
      '闹:热闹,闹钟,吵闹:鹅鞋晶衣浅', '圆:圆形,团圆,圆满:鹅懒鞋厨趣', '厨:厨房,厨师,下厨:鹅晶懒飘趣', '感:感谢,感动,感觉:鹅鞋晶厨钱'],
    p5: ['鼓:打鼓,鼓励,鼓掌:鼠瓦餐罐貌', '餐:早餐,餐厅,野餐:鼠瓦旗鼓辩', '旗:国旗,旗帜,红旗:鼠瓦餐罐辩', '警:警察,警告,报警:鼠瓦餐罐貌',
      '遇:遇到,相遇,机遇:鼠瓦餐罐旗', '圈:圆圈,圈子,转圈:鼠瓦餐鼓貌'],
    p6: ['燃:燃烧,点燃,燃料:凳徽廊圃誓', '典:字典,典故,经典:凳廊圃燃遮', '壁:墙壁,隔壁,壁画:凳徽圃誓燃', '廊:走廊,画廊,长廊:凳徽誓燃圃',
      '默:沉默,默写,幽默:凳廊圃徽燃', '遥:遥远,遥控,遥望:凳徽圃誓燃']
  };
  const GRADES = ['p2', 'p3', 'p4', 'p5', 'p6'];
  /* 常见多音字：单字朗读时 TTS 可能读成别的音（乐 lè/yuè、长 cháng/zhǎng……）。
   * 中心字是多音字 → 读“乐，欢乐的乐”（词取本关没当靶子的组词，不泄露答案）；字怪上的多音字点了不读、无朗读时也不给拼音字幕。 */
  const POLY = new Set(Array.from('乐长行重发还得地着了和调教便数种觉为空背转相少都结露薄曲散省答担当倒弹朝称藏参传奇强更将角卷量难圈属提血应与载钻冲处假尽卡落没切扇舍挑鲜要正只作系降单恶会蒙亲'));
  function parseFallback(grade) {
    const out = [];
    const gi = Math.max(0, GRADES.indexOf(grade));
    // 本年级的兜底不够时，借低一级的（低年级的字高年级都认识）
    for (let k = gi; k >= 0 && out.length < 6; k--) {
      (FALLBACK[GRADES[k]] || []).forEach((line) => {
        const [c, ws, bs] = line.split(':');
        out.push({ c, ok: ws.split(',').map((w) => ({ x: w.replace(c, ''), w })), bad: Array.from(bs) });
      });
    }
    return out;
  }

  /* ---------- 题库里已知的词（各年级 words / chars.words / zuci.ok 与所有句子），用于排除“碰巧能组词”的错字 ---------- */
  let KNOWN = null, KNOWN_SRC = null, PYMAP = null;
  function textsOf(v, out) {
    if (typeof v === 'string') { if (v.length > 1) out.push(v); return; }
    if (Array.isArray(v)) { for (const x of v) textsOf(x, out); return; }
    if (v && typeof v === 'object') for (const k in v) { if (k !== 'py' && k !== 'bad') textsOf(v[k], out); }
  }
  function known() {
    const all = W.HW_DATA;
    if (KNOWN && KNOWN_SRC === all) return KNOWN;
    KNOWN_SRC = all; PYMAP = new Map();
    const txt = [];
    if (all && typeof all === 'object') {
      for (const g of GRADES) {
        const G = all[g];
        if (!G || typeof G !== 'object') continue;
        for (const col in G) {
          if (col === 'zuci' || !Array.isArray(G[col])) continue;
          textsOf(G[col], txt);
        }
        (Array.isArray(G.words) ? G.words : []).forEach((it) => { if (it && typeof it.w === 'string' && typeof it.py === 'string' && !PYMAP.has(it.w)) PYMAP.set(it.w, it.py); });
        (Array.isArray(G.chars) ? G.chars : []).forEach((it) => { if (it && isHz(it.c) && typeof it.py === 'string' && !PYMAP.has(it.c)) PYMAP.set(it.c, it.py); });
        (Array.isArray(G.zuci) ? G.zuci : []).forEach((e) => { if (e && Array.isArray(e.ok)) e.ok.forEach((o) => { if (o && typeof o.w === 'string') txt.push(o.w); }); });
      }
    }
    KNOWN = txt.join('|');
    return KNOWN;
  }
  const adjacentInKnown = (a, b) => { const K = known(); return K.indexOf(a + b) >= 0 || K.indexOf(b + a) >= 0; };
  const pyOf = (s) => { known(); return (PYMAP && PYMAP.get(s)) || ''; };

  /** 把一条 zuci（或兜底）规范化；不合格返回 null。返回的对象就是交给错题本的 item（带 hz）。 */
  function normEntry(e) {
    if (!e || typeof e !== 'object' || !isHz(e.c) || !Array.isArray(e.ok) || !Array.isArray(e.bad)) return null;
    const c = e.c, okX = new Set();
    const ok = [];
    for (const o of e.ok) {
      if (!o || !isHz(o.x) || typeof o.w !== 'string' || o.x === c || okX.has(o.x)) continue;
      const w = o.w.trim();
      if (!(w === c + o.x || w === o.x + c)) continue;       // 只收“中心字 + 这个字”直接相连的两字词
      okX.add(o.x); ok.push({ x: o.x, w, py: typeof o.py === 'string' ? o.py.trim() : '' });   // py：zuci 自带、人工核对过的整词拼音
    }
    const bad = [];
    for (const b of e.bad) {
      if (!isHz(b) || b === c || okX.has(b) || bad.indexOf(b) >= 0) continue;
      if (adjacentInKnown(c, b)) continue;                  // 保险：题库里出现过“c b”或“b c”相连 → 可能是词，不用
      bad.push(b);
    }
    if (ok.length < 2 || bad.length < 1) return null;
    const out = Object.assign({}, e);
    out.hz = typeof e.hz === 'string' && e.hz ? e.hz : c;
    out._ok = ok; out._bad = bad;                            // 下划线字段不进错题本（见 itemOf）
    return out;
  }
  /** 交给 ctx.score 的对象：去掉运行时字段，保证每次 JSON 一样 */
  function itemOf(n) {
    if (n._item) return n._item;
    const it = {};
    for (const k in n) if (k.charAt(0) !== '_') it[k] = n[k];
    Object.defineProperty(n, '_item', { value: it, enumerable: false });
    return it;
  }
  function entriesFor(grade) {
    const all = W.HW_DATA || {};
    const G = all[grade] || {};
    const raw = Array.isArray(G.zuci) ? G.zuci : [];
    let list = raw.map(normEntry).filter(Boolean);
    let src = 'zuci';
    if (list.length < 3) { list = parseFallback(grade).map(normEntry).filter(Boolean); src = 'fallback'; }
    return { list, src };
  }

  /* ================= 关卡参数 ================= */
  function cfgFor(lv, gn) {
    const young = gn <= 2, mid = gn === 3;
    // 每波至少 2 个错字：只有 1 个错字时，不认字、随手挑一个打的孩子（换皮测试）P2 第 1 关实测 7 成能过关；
    // 2 个错字时约 1 成。整关固定 3 波（6–9 个词，60–100 秒），不再有 12 个词、两分多钟的长关。
    const c = {
      waves: 3,
      ok: 2,
      bad: 2,
      spare: young ? (lv <= 5 ? 4 : 3) : mid ? 3 : lv <= 8 ? 3 : 2,
      preview: young ? 1 : mid ? clamp(0.85 - lv * 0.04, 0.45, 0.85) : clamp(0.62 - lv * 0.045, 0.2, 0.62),
      mark: young || (mid && lv <= 4),                           // 预览打到哪个字怪就给它加瞄准框
      assist: young ? 1.0 : mid ? 0.45 : lv <= 2 ? 0.15 : 0,     // 吸附半径（单位 u）
      islands: young ? lv >= 2 : true,
      fly: young ? lv >= 6 : lv >= 4,                             // 气球字怪（上下飘）
      bob: young ? 0.35 : clamp(0.35 + (lv - 4) * 0.06, 0.35, 0.75),
      kinds: lv <= 2 ? ['crate', 'pi'] : lv <= 5 ? ['crate', 'pi', 'tower'] : ['pi', 'tower', 'tower', 'crate'],
      mat: lv <= 3 ? ['wood'] : lv <= 6 ? ['wood', 'wood', 'stone'] : ['wood', 'stone', 'ice'],
      night: lv >= 8,
      big: young ? 1.08 : 1
    };
    if (!young && lv >= 6) c.ok = 3;   // 高关：一波要找 3 个词（竖屏最多 4 座，先保证 2 个错字，词就只放 2 个）
    return c;
  }

  /* ================= 画图小工具（离屏缓存的积木纹理） ================= */
  const MON_COL = [
    { b: '#7BD66B', d: '#3E9B45', l: '#B9F0A8' }, { b: '#B08CFF', d: '#7351C9', l: '#DCCBFF' },
    { b: '#FFB23F', d: '#D07A12', l: '#FFE0A6' }, { b: '#FF8FB1', d: '#D0527A', l: '#FFD0DE' },
    { b: '#5CC8FF', d: '#2B8BC7', l: '#BFE9FF' }
  ];
  const MAT = {
    wood: { f: '#E9B26B', d: '#A8692F', g: '#C98A48', hl: 'rgba(255,240,200,.55)', dens: 0.0014, fr: 0.9 },
    stone: { f: '#B9C3D0', d: '#6F7B8C', g: '#97A3B3', hl: 'rgba(255,255,255,.5)', dens: 0.0026, fr: 0.95 },
    ice: { f: 'rgba(196,238,255,.9)', d: '#5FB4DC', g: 'rgba(255,255,255,.8)', hl: 'rgba(255,255,255,.85)', dens: 0.0011, fr: 0.6 }
  };
  function rrPath(c, x, y, w, h, r) {
    r = Math.max(0, Math.min(r, w / 2, h / 2));
    c.beginPath(); c.moveTo(x + r, y);
    c.arcTo(x + w, y, x + w, y + h, r); c.arcTo(x + w, y + h, x, y + h, r);
    c.arcTo(x, y + h, x, y, r); c.arcTo(x, y, x + w, y, r); c.closePath();
  }

  /* ================= 规格 ================= */
  function makeSpec(ctx) {
    const C1 = 0x0001, C_WALL = 0x0002, C_BLOCK = 0x0004, C_BIRD = 0x0008, C_MON = 0x0010, C_DEB = 0x0020;
    const S = {
      M: null, ready: false, err: false, loading: false, eng: null, world: null,
      gn: 3, cfg: null, src: 'zuci', entries: [],
      u: 30, land: false, top: 120, banH: 64, gY: 700, ax: 60, ay: 600, maxPull: 90, vmax: 1200, G: 1000,
      waves: [], wi: 0, wave: null, forts: [], mons: [], islands: [], debris: [], ground: null, walls: [],
      bird: null, birdsLeft: 0, phase: 'load', phaseT: 0, stepN: 0, acc: 0, tt: 0, lastDraw: 0,
      aim: { on: false, abs: false, x0: 0, y0: 0, ox: 0, oy: 0, moved: false, tapMon: null, tick: 0, tapBan: false, tMove: 0 },
      kAim: { show: false, ang: 0.75, pow: 0.72, t0: 0 },
      markPrev: null, markSince: 0,
      band: { t: 9, x: 0, y: 0 }, hop: null, wordBan: null, msg: null, clouds: [], sparkle: [],
      preview: [], scratch: [], previewN: 0, usedW: new Set(), planScore: 0, markMon: null, levelReady: false, pendingLevel: false, reloadAt: 0, resolveAt: 0,
      bonusDone: false, bonusN: 0, sayQ: 0, shots: 0, idleT: 0, banPing: 0, planMs: 0
    };
    for (let i = 0; i < 220; i++) { S.preview.push({ x: 0, y: 0 }); S.scratch.push({ x: 0, y: 0 }); }
    let G0 = null;   // g（引擎实例）

    /* ---------- 几何 ---------- */
    function geom(g) {
      const w = g.w, h = g.h;
      S.land = w > h * 1.05;
      S.banH = Math.round(clamp(h * 0.082, 56, 80));
      S.top = g.hudTop + S.banH + 10;
      const big = S.cfg ? S.cfg.big : 1;
      S.u = clamp(Math.min(w * (S.land ? 0.05 : 0.085), (h - S.top) * (S.land ? 0.064 : 0.058)), 24, 42) * big;
      S.gY = h - Math.round(clamp(h * 0.085, 48, 74));
      S.ax = S.land ? clamp(w * 0.13, 120, 200) : clamp(w * 0.18, S.u * 2.1, 96);
      S.ay = S.gY - S.u * 2.55;
      S.maxPull = S.u * (S.land ? 3.1 : 2.7);
      S.G = 1.3 * Math.max(w * (S.land ? 0.8 : 0.9), S.gY - S.top);
      // 出膛最大速度：能把鸟打到可放堡垒区域的最远角（右上）还有余量（原示例“限速 45”在这里按屏幕换算）
      const far = farCorner();
      const dx = far.x - S.ax, dy = S.ay - far.y;
      S.vmax = Math.sqrt(S.G * (dy + Math.hypot(dx, dy))) * 1.18;
    }
    function farCorner() { return { x: S.land ? g0().w - S.u * 1.6 : g0().w - S.u * 1.4, y: S.top + S.u * 1.2 }; }
    const g0 = () => G0;

    /* ---------- 数据 → 波次 ---------- */
    /** 错题重练的一条：记分仍用错题本里存的原对象（key 不变，打对了才能销账）；
     *  但“哪些字能组词 / 哪些不能”一律按现在的题库判（数据组之后修正过 ok / bad 的话，不再按旧的错判）。 */
    function freshReview(r) {
      const n = normEntry(r);
      if (!n) return null;
      const order = [g0() && g0().grade].concat(GRADES);
      for (const gr of order) {
        const G = gr && (W.HW_DATA || {})[gr];
        const raw = G && Array.isArray(G.zuci) ? G.zuci : [];
        const hit = raw.find((e) => e && e.c === n.c);
        const f = hit && normEntry(hit);
        if (f) { n._ok = f._ok; n._bad = f._bad; break; }
      }
      return n;
    }
    function planLevel(g) {
      const cfg = S.cfg;
      let list = [];
      if (g.isReview && Array.isArray(ctx.review)) list = ctx.review.map(freshReview).filter(Boolean);
      const reviewing = list.length > 0;
      if (!reviewing) list = S.entries;
      const nW = reviewing ? Math.min(list.length, 4) : Math.min(cfg.waves, list.length);
      let chosen;
      if (reviewing) chosen = g.shuffle(list).slice(0, nW);
      else {
        let picked = null;
        try { picked = ctx.pick(list.map(itemOf), nW); } catch (e) { picked = null; }
        chosen = Array.isArray(picked) && picked.length ? picked.map((it) => list.find((n) => itemOf(n) === it)).filter(Boolean) : g.shuffle(list).slice(0, nW);
        if (!chosen.length) chosen = g.shuffle(list).slice(0, nW);
      }
      const cap = S.land ? 5 : 4;   // 竖屏最多放 4 座（两列隔层），横屏 5 座
      const used = new Set();   // 同一关里不重复出同一个词（“火＋车”和“车＋火”都是“火车”）
      S.usedW = used;
      S.waves = chosen.map((n) => {
        const badN = Math.max(1, Math.min(cfg.bad, n._bad.length, cap - 2)), okN = Math.min(cfg.ok, n._ok.length, cap - badN);
        const sh = g.shuffle(n._ok);
        const ok = sh.filter((o) => !used.has(o.w)).concat(sh.filter((o) => used.has(o.w))).slice(0, okN);
        ok.forEach((o) => used.add(o.w));
        return { n, ok, bad: g.shuffle(n._bad).slice(0, badN), found: [], hits: 0 };
      });
      g.rounds = Math.max(1, S.waves.reduce((a, wv) => a + wv.ok.length, 0));
      S.birdsLeft = g.rounds + cfg.spare;
      S.wi = 0;
    }

    /* ---------- 物理世界 ---------- */
    function newWorld() {
      const M = S.M;
      if (S.eng) { try { M.Composite.clear(S.eng.world, false); M.Engine.clear(S.eng); } catch (e) { /* ignore */ } }
      S.eng = M.Engine.create({ enableSleeping: true, positionIterations: 10, velocityIterations: 8 });
      S.world = S.eng.world;
      S.eng.gravity.y = 1; S.eng.gravity.scale = S.G / 1e6;
      M.Events.on(S.eng, 'collisionStart', onCollide);
      S.forts = []; S.mons = []; S.islands = []; S.debris = []; S.bird = null; S.walls = [];
      const g = G0;
      S.ground = M.Bodies.rectangle(g.w / 2, S.gY + 150, g.w + 400, 300, { isStatic: true, friction: 1, collisionFilter: { category: C1, mask: 0xffff }, label: 'ground' });
      const wl = M.Bodies.rectangle(-60, g.h / 2, 120, g.h * 3, { isStatic: true, collisionFilter: { category: C_WALL, mask: C_BLOCK | C_MON }, label: 'wall' });
      const wr = M.Bodies.rectangle(g.w + 60, g.h / 2, 120, g.h * 3, { isStatic: true, collisionFilter: { category: C_WALL, mask: C_BLOCK | C_MON }, label: 'wall' });
      // 隐形围栏（只挡积木和掉下来的字怪，不挡鸟）：倒塌的堡垒 / 字怪不会滚到弹弓脚下——
      // 实测 P6 第 9 关竖屏：字怪连塔一起倒、滚到弹弓底下，任何弹道都打不到，这一关就卡死了
      const fx = zoneMinX() - 1.9 * S.u;
      const wf = M.Bodies.rectangle(fx - 60, g.h / 2, 120, g.h * 3, { isStatic: true, friction: 0.4, collisionFilter: { category: C_WALL, mask: C_BLOCK | C_MON }, label: 'wall' });
      S.walls = [wl, wr, wf];
      M.Composite.add(S.world, [S.ground, wl, wr, wf]);
      S.stepN = 0; S.acc = 0;
    }
    function onCollide(ev) {
      const b = S.bird;
      const pairs = ev.pairs;
      for (let i = 0; i < pairs.length; i++) {
        const p = pairs[i];
        const A = p.bodyA.parent || p.bodyA, B = p.bodyB.parent || p.bodyB;
        if (b && b.body && (A === b.body || B === b.body)) {
          if (!b.touched) { b.touched = true; b.touchStep = S.stepN; b.touchT = b.t; b.touchSpeed = b.speed; }
          const o = A === b.body ? B : A;
          if (o.label === 'block' && b.speed > 6) { G0.sfx('tick'); spark(b.body.position.x, b.body.position.y, 4); }
        }
      }
    }
    function spark(x, y, n) { G0.burst(x, y, { kind: 'dot', color: '#FFE9B0', n: n || 6 }); }

    /* ---------- 堡垒布局 ---------- */
    function towerSpec(kind) {
      const u = S.u;
      if (kind === 'crate') return { w: 1.25 * u, h: 1.15 * u, parts: [{ dx: 0, y0: 0, w: 1.15 * u, h: 1.15 * u }], perch: 0 };
      if (kind === 'pi') {
        const pw = 0.34 * u, ph = 1.35 * u, lw = 2.25 * u, lh = 0.32 * u;
        return { w: lw, h: ph + lh, parts: [{ dx: -0.8 * u, y0: 0, w: pw, h: ph }, { dx: 0.8 * u, y0: 0, w: pw, h: ph }, { dx: 0, y0: ph, w: lw, h: lh }], perch: 2 };
      }
      // tower：Π 上再放一个箱子
      const pw = 0.34 * u, ph = 1.25 * u, lw = 2.25 * u, lh = 0.3 * u, cw = 0.95 * u;
      return { w: lw, h: ph + lh + cw, parts: [{ dx: -0.8 * u, y0: 0, w: pw, h: ph }, { dx: 0.8 * u, y0: 0, w: pw, h: ph }, { dx: 0, y0: ph, w: lw, h: lh }, { dx: 0, y0: ph + lh, w: cw, h: cw }], perch: 3 };
    }
    function monR() { return S.u * 0.98; }
    /** 生成一波的布局草案：slots → 每座堡垒的岛、积木矩形、字怪位置；只算几何，不建刚体 */
    function draftLayout(g, n) {
      const u = S.u, w = g.w, pH = S.gY - S.top;
      const cols = [], levels = [0];
      let xMin, xMax;
      if (S.land) {
        xMin = zoneMinX(); xMax = w - 1.9 * u;
        const nc = clamp(Math.floor((xMax - xMin) / (3.1 * u)) + 1, 3, 5);
        for (let i = 0; i < nc; i++) cols.push(lerp(xMin, xMax, i / (nc - 1)));
        if (S.cfg.islands) levels.push(0.36, 0.64);
      } else {
        xMin = zoneMinX(); xMax = w - 1.55 * u;
        cols.push(xMin + (xMax - xMin) * 0.1, xMax);
        levels.push(0.27, 0.5, 0.73);   // 竖屏窄：必须叠浮空岛（同一列隔层放）
      }
      const slots = [];
      cols.forEach((x, ci) => levels.forEach((f, li) => slots.push({ ci, li, x: x + rnd(-0.25, 0.25) * u, f })));
      const pick = g.shuffle(slots);
      const out = [];
      const usedCol = new Map();
      const r = monR();
      for (const sl of pick) {
        if (out.length >= n) break;
        // 同一列只能隔层放（竖直留足空间，堡垒不会顶到上面的岛）
        const arr = usedCol.get(sl.ci) || [];
        if (arr.some((li) => Math.abs(li - sl.li) < 2)) continue;
        const f = makeFort(g, sl, r, pH);
        if (!f) continue;
        arr.push(sl.li); usedCol.set(sl.ci, arr);
        out.push(f);
      }
      return out.length >= n ? out : null;
    }
    /** 堡垒区最左一列的 x（竖屏 / 横屏各自的规则；隐形围栏、救援落点都按它算） */
    function zoneMinX() { const u = S.u, w = G0.w; return S.land ? Math.max(S.ax + 5.2 * u, w * 0.38) : Math.max(S.ax + 3.4 * u, w * 0.44); }
    function makeFort(g, sl, r, pH) {
      const u = S.u, onGround = sl.f === 0;
      const baseY = onGround ? S.gY : Math.round(S.gY - sl.f * pH);
      const room = baseY - (S.top + 0.2 * u);   // 底座以上能放多高（塔 + 字怪含眼睛 ≈ 2.35r）
      // 气球字怪：本关开了“飘”就上下飘；竖屏窄、4 座时浮空岛互相挡弹道，没开“飘”也用几乎不动的气球代替一部分浮空岛
      const flyP = S.cfg.fly ? 0.4 : (S.land ? 0 : 0.45);
      if (!onGround && flyP > 0 && Math.random() < flyP && room > 4.9 * r) {
        return { fly: true, still: !S.cfg.fly, x: sl.x, baseY, island: null, blocks: [], mx: sl.x, my: baseY - r * 0.6, perch: -1, kind: 'fly' };
      }
      let T = null, kind = '';
      for (const k of g.shuffle(S.cfg.kinds).concat(['crate'])) { const t = towerSpec(k); if (t.h + 2.35 * r <= room) { T = t; kind = k; break; } }
      if (!T) return null;
      const island = onGround ? null : { x: sl.x, y: baseY + 0.25 * u, w: Math.max(T.w + 0.6 * u, 2.1 * u), h: 0.5 * u };
      const blocks = T.parts.map((p) => ({ x: sl.x + p.dx, y: baseY - p.y0 - p.h / 2, w: p.w, h: p.h }));
      const top = blocks[T.perch];
      return { fly: false, x: sl.x, baseY, island, blocks, kind, perch: T.perch, mx: top.x, my: top.y - top.h / 2 - r * 0.9 };
    }
    /** 从弹弓打到 (tx,ty) 的干净弹道：返回 {ang, v} 或 null。obst = {rects, mons}（不含目标自己） */
    function cleanShots(tx, ty, tr, obst, list) {
      const G = S.G, ax = S.ax, ay = S.ay, rb = birdR();
      const dx = tx - ax, dyUp = ay - ty;
      if (dx <= S.u) return 0;
      let n = 0;
      for (let deg = -12; deg <= 82; deg += 3) {
        const th = deg * Math.PI / 180, ct = Math.cos(th);
        const den = 2 * ct * ct * (dx * Math.tan(th) - dyUp);
        if (den <= 0) continue;
        const v = Math.sqrt(G * dx * dx / den);
        if (!(v < S.vmax * 0.93)) continue;
        if (pathOk(v * ct, -v * Math.sin(th), tx, ty, tr, obst, rb)) { n++; if (list) list.push({ deg, v }); }
      }
      return n;
    }
    function pathOk(vx, vy, tx, ty, tr, obst, rb) {
      let x = S.ax, y = S.ay;
      const dt = 1 / 100, G = S.G;
      for (let i = 0; i < 600; i++) {
        vy += G * dt; x += vx * dt; y += vy * dt;
        const ddx = x - tx, ddy = y - ty;
        if (ddx * ddx + ddy * ddy <= (rb + tr * 0.85) * (rb + tr * 0.85)) return true;
        if (y + rb > S.gY || x > G0.w + rb || x < -rb) return false;
        for (const R of obst.rects) {
          const cx = clamp(x, R.x - R.w / 2, R.x + R.w / 2), cy = clamp(y, R.y - R.h / 2, R.y + R.h / 2);
          const ex = x - cx, ey = y - cy;
          if (ex * ex + ey * ey < rb * rb * 1.2) return false;   // 比鸟半径再多留一点：擦边也算挡住
        }
        for (const m of obst.mons) {
          const ex = x - m.x, ey = y - m.y, rr = rb + m.r * 1.3;
          if (ex * ex + ey * ey < rr * rr) return false;
        }
      }
      return false;
    }
    function birdR() { return S.u * 0.7; }
    // 手抖判定（见 judgedWrong）：拉出来的弹道离错字中心 > SHAKY_Q 个碰撞半径（擦边），
    // 同时离某只能组词的字怪 < NEAR_Q 个碰撞半径（险险擦过）→ 算手没跟上。
    // 实测（±8° / ±12% 力度的“手抖”试玩）：瞄对字却擦到错字的都落在 qm 0.8–1.2、邻居 0.3–1.4；认真瞄错字的 qm 多在 0.7 以下。
    const SHAKY_Q = 0.7, NEAR_Q = 1.5;
    function planWave(g, wave) {
      const n = wave.ok.length + wave.bad.length;
      const r = monR();
      // 每个字怪都要有好几条干净弹道（3° 一格数）：只有 1 条的布局物理一沉降就可能一条都不剩（竖屏 4 座实测 20% 打不到）
      let best = null, bestScore = -1;
      const t0 = (W.performance && performance.now) ? performance.now() : Date.now();
      for (let tries = 0; tries < 400; tries++) {
        if (tries > 60 && ((W.performance && performance.now) ? performance.now() : Date.now()) - t0 > 40) break;   // 慢机器：最多 ~40ms
        const L = draftLayout(g, n);
        if (!L) continue;
        const rects = [];
        L.forEach((f) => { if (f.island) rects.push(f.island); f.blocks.forEach((b) => rects.push(b)); });
        let minN = 99;
        for (let i = 0; i < L.length; i++) {
          const mons = [];
          L.forEach((f, j) => { if (j !== i) mons.push({ x: f.mx, y: f.my, r }); });
          const k = cleanShots(L[i].mx, L[i].my, r, { rects, mons });
          if (k < minN) minN = k;
          if (minN <= bestScore) break;   // 已经不可能比现有最好的强
        }
        if (minN > bestScore) { bestScore = minN; best = L; }
        if (minN >= 4) break;
      }
      S.planScore = bestScore;
      if (best && bestScore >= 2) return best;
      return fallbackLayout(g, n);
    }
    /** 兜底布局（极小屏 / 实在排不开）：全部做成气球字怪，错开高度排在右半边 */
    function fallbackLayout(g, n) {
      const u = S.u, r = monR();
      const xMin = Math.max(S.ax + 3.2 * u, g.w * 0.42), xMax = g.w - 1.4 * u;
      const yTop = S.top + 3.6 * r, yBot = S.gY - 1.6 * r;
      const out = [];
      for (let i = 0; i < n; i++) {
        const x = n > 1 ? lerp(xMin, xMax, i / (n - 1)) : (xMin + xMax) / 2;
        const y = i % 2 ? lerp(yTop, yBot, 0.25) : lerp(yTop, yBot, 0.8);
        out.push({ fly: true, x, baseY: y, island: null, blocks: [], mx: x, my: y, perch: -1, kind: 'fly' });
      }
      return out;
    }

    /* ---------- 建一波的刚体 ---------- */
    function buildWave(g, wave, drop) {
      const M = S.M;
      const t0 = (W.performance && performance.now) ? performance.now() : 0;
      const L = planWave(g, wave);
      S.planMs = ((W.performance && performance.now) ? performance.now() : 0) - t0;
      if (!L) return false;
      const chars = g.shuffle(wave.ok.map((o) => ({ x: o.x, ok: true, w: o.w, py: o.py })).concat(wave.bad.map((b) => ({ x: b, ok: false }))));
      const pal = g.shuffle(MON_COL);
      const r = monR();
      S.forts = []; S.mons = []; S.islands = [];
      L.forEach((f, i) => {
        const mat = g.pick(S.cfg.mat);
        const fort = { i, fly: f.fly, island: null, blocks: [], alive: true, drop: drop ? 0 : 1, dropDelay: i * 0.12, leave: 0 };
        if (f.island) {
          const I = f.island;
          const body = M.Bodies.rectangle(I.x, I.y, I.w, I.h, { isStatic: true, friction: 1, collisionFilter: { category: C1, mask: 0xffff }, label: 'island' });
          body.plugin = { w: I.w, h: I.h, seed: Math.random() * 1000 };
          fort.island = body;
          S.islands.push(body);
        }
        f.blocks.forEach((b, k) => {
          const m = M.Bodies.rectangle(b.x, b.y, b.w, b.h, {
            density: MAT[mat].dens, friction: MAT[mat].fr, frictionStatic: 1, restitution: 0.05, label: 'block',
            collisionFilter: { category: C_BLOCK, mask: C1 | C_WALL | C_BLOCK | C_BIRD | C_MON }, sleepThreshold: 40
          });
          m.plugin = { w: b.w, h: b.h, mat, fort, seed: Math.random() * 100, perch: k === f.perch };
          fort.blocks.push(m);
        });
        const ch = chars[i];
        const mon = {
          fort, ch: ch.x, ok: ch.ok, w: ch.w || '', wpy: ch.py || '', r, x: f.mx, y: f.my, fly: f.fly, ax: f.mx, ay: f.my,
          perch: f.fly ? null : fort.blocks[f.perch], off: 0, body: null, alive: true, armored: false,
          col: pal[i % pal.length], ph: Math.random() * TAU, blink: rnd(1, 4), hitT: 0, laughT: 0,
          shieldT: 0, shieldAng: 0, noteT: 0, pop: drop ? 0 : 1, bobA: f.fly ? (f.still ? 0.08 : S.cfg.bob) * S.u : 0, bobSp: rnd(1.6, 2.2)
        };
        if (mon.perch) mon.off = mon.perch.plugin.h / 2 + r * 0.9;
        fort.mon = mon;
        S.forts.push(fort); S.mons.push(mon);
      });
      if (!drop) addWaveBodies();
      return true;
    }
    function addWaveBodies() {
      const M = S.M, add = [];
      S.forts.forEach((f) => { f.live = true; if (f.island && !f.island._in) { f.island._in = true; add.push(f.island); } f.blocks.forEach((b) => { if (!b._in) { b._in = true; add.push(b); } }); });
      if (add.length) M.Composite.add(S.world, add);
    }
    function clearWaveBodies() {
      const M = S.M;
      S.forts.forEach((f) => {
        if (f.island && f.island._in) { M.Composite.remove(S.world, f.island); f.island._in = false; }
        f.blocks.forEach((b) => { if (b._in) { M.Composite.remove(S.world, b); b._in = false; } });
      });
      S.mons.forEach((m) => { if (m.body) { M.Composite.remove(S.world, m.body); m.body = null; } });
      S.debris.forEach((b) => { if (b._in) { M.Composite.remove(S.world, b); b._in = false; } });
      S.debris = [];
    }

    /* ---------- 流程 ---------- */
    function setupLevel(g) {
      if (!S.ready) { S.pendingLevel = true; return; }
      S.pendingLevel = false;
      geom(g);
      newWorld();
      S.wave = S.waves[0] || null;
      S.wi = 0;
      if (S.wave) buildWave(g, S.wave, false);
      S.phase = 'wait';   // play() 之后进入 ready
      S.levelReady = true;
      S.bird = null;
      S.hop = null;
      S.kAim.show = false;
      if (g.state === 'play') startWave(g, true);
    }
    function startWave(g, first) {
      S.phase = 'ready';
      loadBird(g, first);
      if (S.wave) { S.sayQ++; sayCenter(g, S.wave.n); }
    }
    /** 读中心字（横幅上已经有字和拼音，不再叠字幕）；多音字带一个本关没当靶子的词 */
    function sayCenter(g, n) {
      const c = n.c;
      let txt = c;
      if (POLY.has(c)) {
        const spare = n._ok.map((o) => o.w).filter((w) => !S.usedW.has(w));
        if (spare.length) txt = c + '，' + spare[0] + '的' + c;
      }
      return g.say(txt, { caption: '' });
    }
    /** 点字怪听读音（P2/P3）：多音字不单读 */
    function sayMon(g, m) {
      m.hitT = 0.25;
      if (POLY.has(m.ch)) return;
      g.say(m.ch, { caption: pyOf(m.ch) });
    }
    function loadBird(g, instant) {
      if (S.birdsLeft <= 0) return;
      S.hop = instant ? null : { t: 0, dur: 0.42 };
      S.phase = instant ? 'ready' : 'reload';
      if (!instant) g.sfx('jump');
      S.kAim.show = false;
    }
    function waveCleared(g) {
      const wv = S.wave;
      S.phase = 'clear'; S.phaseT = 0;
      g.sfx('match');
      S.msg = { text: '全找到啦！', sub: wv.found.join(' · '), t: 0, dur: 1.8, col: '#FFE45C' };
      g.after(1.1, () => {
        // 剩下的错字字怪跳走，岛和堡垒往下沉
        S.mons.forEach((m) => { if (m.alive) { m.leaving = 0.001; } });
        S.forts.forEach((f) => { f.leave = 0.001; });
      });
      g.after(1.9, () => {
        clearWaveBodies();
        S.wi++;
        S.wave = S.waves[S.wi] || null;
        if (!S.wave) return;
        buildWave(g, S.wave, true);
        S.phase = 'enter'; S.phaseT = 0;
        g.sfx('whoosh');
        g.after(1.0, () => { addWaveBodies(); startWave(g, false); });
      });
    }
    function afterShot(g) {
      // 一只鸟的结果处理完：波次清空 / 装下一只 / 鸟用完
      if (g.state !== 'play') return;
      const wv = S.wave;
      if (wv && wv.found.length >= wv.ok.length) { waveCleared(g); return; }
      if (S.birdsLeft > 0) { loadBird(g, false); return; }
      S.phase = 'out';
      S.msg = { text: '小鸟用完啦！', sub: '还有字没找到', t: 0, dur: 2, col: '#FFB3B3' };
      S.mons.forEach((m) => { if (m.alive && m.ok) m.laughT = 2; });
      const rv = revealText();
      g.after(1.3, () => g.lose(rv ? { reveal: rv } : undefined));
    }

    /* ---------- 卡死救援：字怪被压住 / 掉进死角、没有任何干净弹道 → 挂上气球飘到打得到的地方 ---------- */
    // 对字和错字一样救（只救对字的话，飘起来就等于告诉孩子答案）。每只字怪停稳后查一次，位置不变不重查。
    function obstaclesExcept(m) {
      const rects = [];
      S.forts.forEach((f) => {
        if (f.island && f.island._in) rects.push({ x: f.island.position.x, y: f.island.position.y, w: f.island.plugin.w, h: f.island.plugin.h });
        f.blocks.forEach((b) => { if (b._in) rects.push({ x: b.position.x, y: b.position.y, w: b.bounds.max.x - b.bounds.min.x, h: b.bounds.max.y - b.bounds.min.y }); });
      });
      const mons = S.mons.filter((o) => o !== m && o.alive).map((o) => ({ x: o.fly ? o.ax : o.x, y: o.fly ? o.ay : o.y, r: o.r }));
      return { rects, mons };
    }
    function rescueStuck(g, dt) {
      S.rescT = (S.rescT || 0) + dt;
      if (S.rescT < 0.5) return;
      S.rescT = 0;
      for (const m of S.mons) {
        if (!m.alive || m.armored || !m.fort || !m.fort.live || m.fort.drop < 1 || m.leaving > 0) continue;
        const x = m.fly ? m.ax : m.x, y = m.fly ? m.ay : m.y;
        // 还在动（刚倒、在滚）就先不查
        const mv = Math.hypot(x - (m.lastX == null ? x : m.lastX), y - (m.lastY == null ? y : m.lastY));
        m.lastX = x; m.lastY = y;
        if (mv > 1.5) { m.chkX = null; continue; }
        if (m.chkX != null && Math.hypot(x - m.chkX, y - m.chkY) < 3) continue;
        m.chkX = x; m.chkY = y;
        if (cleanShots(x, y, m.r, obstaclesExcept(m)) > 0) continue;
        floatUp(g, m);
        return;   // 一次救一只（下一轮再查别的）
      }
    }
    function floatUp(g, m) {
      const u = S.u, r = m.r, obst = obstaclesExcept(m);
      const now = () => ((W.performance && performance.now) ? performance.now() : Date.now());
      const t0 = now();
      // 其它字怪（连它们头上的气球）占的竖条：落点和自己的气球都不能碰上
      const others = S.mons.filter((o) => o !== m && o.alive).map((o) => { const x = o.fly ? o.ax : o.x, y = o.fly ? o.ay : o.y; return { o, x, y, top: y - (o.fly ? 3.5 : 1.2) * o.r, bot: y + o.r }; });
      // 两轮落点：A 在堡垒区里、连气球都不挨着别人、至少 2 条干净弹道；
      // B（竖屏窄、字怪挤时 A 可能一个都没有）放宽到弹弓和堡垒区之间、只要身体不挨着、1 条弹道就行
      const yA = S.top + 3.6 * r, yB = S.gY - 1.6 * r;
      const A = [], B = [];
      for (let x = zoneMinX(); x <= g.w - 1.4 * u; x += 0.7 * u) for (let y = yA; y <= yB; y += 0.7 * u) {
        if (others.some((q) => Math.abs(q.x - x) < r * 2.4 && y - 3.5 * r < q.bot + r * 0.3 && y + r > q.top - r * 0.3)) continue;
        if (obst.rects.some((R) => Math.abs(x - R.x) < R.w / 2 + r * 1.1 && Math.abs(y - R.y) < R.h / 2 + r * 1.1 + r * 1.9)) continue;   // 连上方的气球一起不碰积木
        A.push({ x, y, need: 2, d: Math.hypot(x - m.x, y - (m.y - 2.5 * u)) });
      }
      for (let x = S.ax + 2.6 * u; x <= g.w - 1.4 * u; x += 0.7 * u) for (let y = yA; y <= yB; y += 0.7 * u) {
        if (others.some((q) => Math.hypot(q.x - x, q.y - y) < r * 2.3)) continue;
        if (obst.rects.some((R) => Math.abs(x - R.x) < R.w / 2 + r * 1.1 && Math.abs(y - R.y) < R.h / 2 + r * 1.1)) continue;
        if (A.some((c) => c.x === x && c.y === y)) continue;
        B.push({ x, y, need: 1, d: Math.hypot(x - m.x, y - (m.y - 2.5 * u)) });
      }
      A.sort((a, b) => a.d - b.d); B.sort((a, b) => a.d - b.d);
      const cand = A.concat(B);
      // 其它还没戴钢盔的字怪：原来打得到的，放下这只以后也得打得到（不能救一只、堵一只）
      const need = others.filter((q) => !q.o.armored && q.o.fort && q.o.fort.live);
      const mx0 = m.fly ? m.ax : m.x, my0 = m.fly ? m.ay : m.y;
      const needObst = need.map((q) => { const ob = obstaclesExcept(q.o); ob.mons = ob.mons.filter((mm) => !(Math.abs(mm.x - mx0) < 1 && Math.abs(mm.y - my0) < 1)); return ob; });
      const before = need.map((q, i) => cleanShots(q.x, q.y, q.o.r, needObst[i]) > 0);
      let spot = null, k = m.rescSkip || 0;   // 接着这只字怪上次没找完的地方（按字怪记，换关 / 换别的字怪不串）
      for (; k < cand.length; k++) {
        if (now() - t0 > 30) break;   // 慢机器也不卡：这次没找到，0.5 秒后接着找后面的落点
        const c = cand[k];
        if (cleanShots(c.x, c.y, r, obst) < c.need) continue;
        const me = { x: c.x, y: c.y, r };
        if (need.some((q, i) => before[i] && cleanShots(q.x, q.y, q.o.r, { rects: needObst[i].rects, mons: needObst[i].mons.concat([me]) }) === 0)) continue;
        spot = c; break;
      }
      if (!spot) {
        m.chkX = null;
        if (k < cand.length) { m.rescSkip = k; return; }   // 时间到了，下次接着找
        m.rescSkip = 0;
        clearAround(g, m);   // 全试完也没有落点：把压着它的积木炸开
        return;
      }
      m.rescSkip = 0;
      if (m.body) { try { S.M.Composite.remove(S.world, m.body); } catch (e) { /* ignore */ } m.body = null; }
      m.perch = null; m.fly = true; m.still = true; m.bobA = 0.08 * u;
      m.resc = { x0: m.x, y0: m.y, t: 0 };
      m.ax = spot.x; m.ay = spot.y; m.chkX = spot.x; m.chkY = spot.y;
      m.noteT = 1.4; m.noteBad = false; m.note = '我飘起来啦';
      S.rescN = (S.rescN || 0) + 1;
      S.rescMs = Math.round(now() - t0);
      g.sfx('bubble');
      g.burst(m.x, m.y, { kind: 'dot', color: '#FFFFFF', n: 10 });
    }
    /** 最后一招：把压在卡死字怪周围的积木变成碎片飞走（别的字怪脚下的那块不动） */
    function clearAround(g, m) {
      const M = S.M, perches = new Set(S.mons.filter((o) => o !== m && o.alive && o.perch).map((o) => o.perch));
      let n = 0;
      S.forts.forEach((f) => {
        f.blocks = f.blocks.filter((b) => {
          if (!b._in || perches.has(b) || Math.hypot(b.position.x - m.x, b.position.y - m.y) > m.r * 3.5) return true;
          M.Sleeping.set(b, false);
          if (b.isStatic) M.Body.setStatic(b, false);
          b.collisionFilter = { category: C_DEB, mask: 0, group: 0 };
          M.Body.setVelocity(b, { x: rnd(-3, 3), y: -rnd(5, 8) * S.u / 30 });
          M.Body.setAngularVelocity(b, rnd(-0.3, 0.3));
          b.plugin.die = 0.001; S.debris.push(b); n++;
          return false;
        });
      });
      if (n) { g.sfx('crash'); g.burst(m.x, m.y, { kind: 'dot', color: '#FFFFFF', n: 14 }); S.rescN = (S.rescN || 0) + 1; }
    }

    /* ---------- 发射 ---------- */
    function launchVec(ox, oy) {
      // 拉开向量 (ox,oy)（相对弹弓）→ 速度 px/s
      const d = Math.hypot(ox, oy);
      const k = clamp(d / S.maxPull, 0, 1);
      let dx = -ox / (d || 1), dy = -oy / (d || 1);
      if (dx < 0.12) { dx = 0.12; const n = Math.hypot(dx, dy); dx /= n; dy /= n; }
      const sp = k * S.vmax;
      return { vx: dx * sp, vy: dy * sp, k };
    }
    function simPreview(vx, vy, frac, out) {
      // 预览点（与 pathOk 同一套积分）。返回 {n, mon}：mon = 预览弹道第一个碰到的字怪（仅当没先撞到别的）
      let x = S.ax, y = S.ay;
      const dt = 1 / 60, G = S.G, rb = birdR();
      let n = 0, hit = null;
      const maxT = 3.2 * frac;
      const rects = S.forts.flatMap((f) => (f.island ? [f.island] : []).concat(f.blocks));
      for (let t = 0; t < maxT && n < out.length; t += dt) {
        vy += G * dt; x += vx * dt; y += vy * dt;
        out[n].x = x; out[n].y = y; n++;
        if (y + rb > S.gY || x > G0.w + rb) break;
        let stop = false;
        for (const m of S.mons) {
          if (!m.alive) continue;
          const ex = x - m.x, ey = y - m.y, rr = rb + m.r;
          if (ex * ex + ey * ey <= rr * rr) { hit = m; stop = true; break; }
        }
        if (stop) break;
        for (const b of rects) {
          if (!b._in) continue;
          if (pointInBody(b, x, y, rb)) { stop = true; break; }
        }
        if (stop) break;
      }
      return { n, mon: hit };
    }
    function pointInBody(b, x, y, pad) {
      const bb = b.bounds;
      return x > bb.min.x - pad && x < bb.max.x + pad && y > bb.min.y - pad && y < bb.max.y + pad;
    }
    /** 吸附（P2/P3）：弹道离某个字怪很近 → 同角度微调速度，让它正中。
     *  优先吸到“这条弹道本来就会先撞到”的那只（和瞄准框一致），不会把擦边的弹道拽到旁边另一只身上。
     *  预览（虚线 + 瞄准框）也用吸附后的速度画：看到的就是打出去的。 */
    function assistVec(vx, vy) {
      const as = S.cfg.assist * S.u;
      if (!(as > 0)) return { vx, vy };
      const sp = Math.hypot(vx, vy), th = Math.atan2(-vy, vx);
      if (sp < 1) return { vx, vy };
      let bestM = null, bestD = 1e9;
      const first = simPreview(vx, vy, 1, S.scratch).mon;
      if (first) { if (!first.armored) { bestM = first; bestD = closest(vx, vy, first.x, first.y); } }
      else {
        for (const m of S.mons) {
          if (!m.alive || m.armored) continue;
          const d = closest(vx, vy, m.x, m.y);
          if (d < bestD) { bestD = d; bestM = m; }
        }
      }
      if (bestM && bestD < birdR() + bestM.r + as) {
        const dx = bestM.x - S.ax, dyUp = S.ay - bestM.y, ct = Math.cos(th);
        const den = 2 * ct * ct * (dx * Math.tan(th) - dyUp);
        if (den > 0) {
          const v2 = Math.sqrt(S.G * dx * dx / den);
          if (Math.abs(v2 - sp) / sp < 0.16 && v2 < S.vmax * 1.05) return { vx: v2 * ct, vy: -v2 * Math.sin(th) };
        }
      }
      return { vx, vy };
    }
    function fire(g, ox, oy, byKey) {
      if (S.phase !== 'ready' || S.birdsLeft <= 0) return;
      const M = S.M;
      const raw = launchVec(ox, oy);
      if (raw.k < 0.12) return;
      let { vx, vy } = assistVec(raw.vx, raw.vy);
      // 松手时瞄准框（P2 / P3 前几关）套在谁身上：孩子看着框松手 = 他选了这个字
      const markMon = S.cfg.mark ? simPreview(vx, vy, S.cfg.preview, S.scratch).mon : null;
      // 瞄了多久：拉弓（或键盘亮出瞄准线）到松手的秒数；瞄准框在这只字怪身上停了多久。
      // 一甩就放（乱按 / 狂点）撞上错字只扣心、不进错题本（见 judgedWrong 的 'flick'）
      const hold = byKey ? S.tt - S.kAim.t0 : S.tt - S.aim.tMove;
      const markHold = markMon && markMon === S.markPrev ? S.tt - S.markSince : 0;
      const rb = birdR();
      const body = M.Bodies.circle(S.ax, S.ay, rb, {
        density: 0.004, restitution: 0.42, friction: 0.5, frictionAir: 0, label: 'bird',
        collisionFilter: { category: C_BIRD, mask: C1 | C_BLOCK }
      });
      M.Composite.add(S.world, body);
      M.Body.setVelocity(body, { x: vx / 60, y: vy / 60 });
      S.bird = { body, r: rb, touched: false, touchStep: -1, touchT: 0, touchSpeed: 0, spent: false, t: 0, rest: 0, trail: [], lastTrail: 0, px: S.ax, py: S.ay, speed: 0, done: false, badT: 0, resolved: false };
      // 发射那一刻的“瞄准意图”：预测弹道离每个字怪最近多远（判断后来撞上的是不是本来想打的）；
      // rawD = 吸附之前（孩子手上真正拉出来的）弹道离每只多远
      S.bird.aimD = new Map(); S.bird.aimT = new Map(); S.bird.rawD = new Map(); S.bird.mark = markMon;
      S.bird.hold = hold; S.bird.markHold = markHold;
      for (const m of S.mons) {
        if (!m.alive) continue;
        const q = closestDT(vx, vy, m.x, m.y); S.bird.aimD.set(m, q.d); S.bird.aimT.set(m, q.t);
        S.bird.rawD.set(m, closest(raw.vx, raw.vy, m.x, m.y));
      }
      S.birdsLeft--;
      S.shots++; S.idleT = 0;
      S.phase = 'fly';
      S.band.t = 0; S.band.x = -ox; S.band.y = -oy;
      S.kAim.show = false;
      g.sfx('whoosh');
      S.markMon = null; S.markPrev = null;
    }
    function closest(vx, vy, tx, ty) { return closestDT(vx, vy, tx, ty).d; }
    /** 不考虑碰撞的弹道离 (tx,ty) 最近多远（d）、在第几秒（t） */
    function closestDT(vx, vy, tx, ty) {
      let x = S.ax, y = S.ay, best = 1e9, bt = 0;
      const dt = 1 / 120, G = S.G;
      for (let i = 0; i < 700; i++) {
        vy += G * dt; x += vx * dt; y += vy * dt;
        const d = Math.hypot(x - tx, y - ty);
        if (d < best) { best = d; bt = i * dt; }
        if (y > S.gY || x > G0.w + 40) break;
      }
      return { d: best, t: bt };
    }

    /* ---------- 物理步进 + 判定 ---------- */
    const STEP = 1000 / 120;
    function stepWorld(g, dt) {
      if (!S.eng) return;
      S.acc += dt * 1000;
      let n = 0;
      while (S.acc >= STEP && n < 8) {
        S.acc -= STEP; n++;
        const b = S.bird;
        if (b && b.body) { b.px = b.body.position.x; b.py = b.body.position.y; b.speed = b.body.speed; }
        S.stepN++;
        S.M.Engine.update(S.eng, STEP);
        followMonsters(g);
        if (b && b.body && !b.resolved && g.state === 'play') checkBird(g, b);
      }
      if (S.acc > STEP * 4) S.acc = 0;
    }
    function followMonsters(g) {
      const M = S.M;
      for (const m of S.mons) {
        if (!m.alive || !m.fort.live) continue;   // 还在从天上掉下来的这一波：刚体还没放进世界
        if (m.fly) {
          const bob = Math.sin(S.tt * m.bobSp + m.ph) * m.bobA;
          m.x = m.ax + Math.sin(S.tt * 0.7 + m.ph) * m.bobA * 0.25; m.y = m.ay + bob;
          if (m.resc && m.resc.t < 1) { const k = oCubic(clamp(m.resc.t, 0, 1)); m.x = lerp(m.resc.x0, m.x, k); m.y = lerp(m.resc.y0, m.y, k); }
          continue;
        }
        if (m.body) { m.x = m.body.position.x; m.y = m.body.position.y; continue; }
        const p = m.perch;
        if (!p) continue;
        const a = p.angle;
        m.x = p.position.x + Math.sin(a) * m.off;
        m.y = p.position.y - Math.cos(a) * m.off;
        // 木块歪得太厉害 → 字怪掉下来（变成自己的小圆球，站着不转）
        if (Math.abs(Math.atan2(Math.sin(a), Math.cos(a))) > 0.95 || !p._in) {
          const body = M.Bodies.circle(m.x, m.y, m.r * 0.92, {
            density: 0.002, friction: 0.9, restitution: 0.2, label: 'mon', inertia: Infinity,
            collisionFilter: { category: C_MON, mask: C1 | C_WALL | C_BLOCK }
          });
          M.Body.setVelocity(body, { x: p.velocity.x * 0.8, y: p.velocity.y * 0.8 });
          M.Composite.add(S.world, body);
          m.body = body; m.perch = null;
          m.hitT = 0.6;
        }
      }
    }
    function checkBird(g, b) {
      const body = b.body, x = body.position.x, y = body.position.y;
      b.speed = body.speed;
      // 1) 扫掠判定：这一步从 (px,py) 到 (x,y) 的线段碰到哪个字怪
      if (!b.spent) {
        let hit = null, bestT = 2;
        for (const m of S.mons) {
          if (!m.alive) continue;
          const t = segHit(b.px, b.py, x, y, m.x, m.y, b.r + m.r * 1.02);
          if (t >= 0 && t < bestT) { bestT = t; hit = m; }
        }
        if (hit) {
          // 直接打中：没碰过别的；或者只是擦了一下边（0.3 秒内、速度还剩七成以上）
          const direct = !b.touched || b.touchStep === S.stepN || (b.t - b.touchT < 0.3 && body.speed >= 0.7 * b.touchSpeed);
          hitMonster(g, b, hit, direct);
          if (b.resolved) return;
        }
      }
      // 2) 出界 / 停下 / 超时
      b.t += STEP / 1000;
      const out = x > g.w + b.r * 2 || x < -b.r * 3 || y > g.h + b.r * 2;
      if (body.speed < 0.35) b.rest += STEP / 1000; else b.rest = 0;
      if (b.spent) b.badT += STEP / 1000;
      if (out || b.rest > 0.45 || b.t > 7 || (b.spent && b.badT > 1.6)) endFlight(g, b, out);
    }
    function segHit(x0, y0, x1, y1, cx, cy, R) {
      const dx = x1 - x0, dy = y1 - y0, fx = x0 - cx, fy = y0 - cy;
      const a = dx * dx + dy * dy;
      if (fx * fx + fy * fy <= R * R) return 0;
      if (a < 1e-9) return -1;
      const bq = 2 * (fx * dx + fy * dy), cq = fx * fx + fy * fy - R * R;
      const disc = bq * bq - 4 * a * cq;
      if (disc < 0) return -1;
      const t = (-bq - Math.sqrt(disc)) / (2 * a);
      return t >= 0 && t <= 1 ? t : -1;
    }
    function hitMonster(g, b, m, direct) {
      const M = S.M, wv = S.wave;
      const item = itemOf(wv.n);
      const c = wv.n.c;
      if (m.ok && direct) {
        // ✔ 组成词：堡垒炸开
        b.resolved = true;
        m.alive = false;
        wv.found.push(m.w); wv.hits++;
        const wx = m.x, wy = m.y;
        removeBird(g, true);
        explodeFort(g, m);
        g.shake(10);
        g.sfx('crash');
        g.burst(wx, wy, { kind: 'confetti', n: 26 });
        g.ring(wx, wy, '#FFFFFF', m.r * 3);
        S.wordBan = { w: m.w, py: m.wpy || pyOf(m.w), t: 0, x: wx, y: wy, c };
        // 先读词再记分：最后一个词打中会立刻结束本关，结束后也要把这个词读出来
        S.sayQ++; g.say(m.w, { caption: '' });
        // 飘字不写汉字（引擎飘字是圆体）；词用楷体大横幅显示。bonusN 先算好：最后一个词会在 g.right 里结束本关（endDelay 要用）
        S.bonusN = S.birdsLeft;
        g.right(item, wx, wy);
        if (g.state !== 'play') onWin(g);
        S.phase = 'resolve';
        g.after(1.05, () => afterShot(g));
        return;
      }
      // 没打成：错字（第一下直接撞到、确实瞄的是它 = 华文判断错）→ 钢盾弹回、扣心、戴钢盔、记错题；
      // 其余（先撞了别的 / 手抖擦到 / 被它挡住 / 气球飘进弹道 / 能组词但没直接打中）→ 软软弹开、只算手没跟上（g.miss）。
      // 软弹开时对字和错字的样子完全一样：不能靠“没扣心的试探”看出哪个字是对的（换皮测试）。
      b.spent = true; b.touched = true;
      // judged：true = 认真瞄了错字（华文判断错）；'flick' = 一甩就放撞上错字（乱按：照样钢盾 + 扣心，但不进错题本）；false = 手没跟上
      const judged = !m.ok && direct && !m.armored ? judgedWrong(b, m) : false;
      const vx = b.body.velocity.x, vy = b.body.velocity.y;
      let nx = b.body.position.x - m.x, ny = b.body.position.y - m.y;
      const nl = Math.hypot(nx, ny) || 1; nx /= nl; ny /= nl;
      const dot = vx * nx + vy * ny;
      const k = STEP / (1000 / 60);   // velocity 是“每步位移”；setVelocity 要“每 16.7ms”
      let rvx = (vx - 2 * dot * nx) * 0.7 / k, rvy = (vy - 2 * dot * ny) * 0.7 / k;
      if (rvx > -2) rvx = -2 - Math.random() * 2;
      M.Body.setPosition(b.body, { x: m.x + nx * (b.r + m.r + 2), y: m.y + ny * (b.r + m.r + 2) });
      if (!judged && !m.armored) {
        M.Body.setVelocity(b.body, { x: rvx * 0.55, y: rvy * 0.55 - 2 });
        m.hitT = 0.4; m.noteT = 1.5; m.noteBad = false;
        m.note = !direct ? '要直接打中！' : b.whyMiss || '打偏啦';
        g.sfx('bubble');
        g.miss();
        return;
      }
      M.Body.setVelocity(b.body, { x: rvx, y: rvy - 3 });
      M.Body.setAngularVelocity(b.body, -0.35);
      m.shieldT = 0.9; m.shieldAng = Math.atan2(-ny, -nx) + Math.PI; m.laughT = 1.4; m.hitT = 0.3;
      g.sfx('hit');
      g.burst(m.x + nx * m.r, m.y + ny * m.r, { kind: 'spark', n: 14 });
      if (!judged) {   // 已经戴钢盔的错字又被打到：钢盾照弹（它是错字，大家已经知道了），不再扣心、不再记错题
        m.noteT = 1.4; m.noteBad = true; m.note = '它已经戴钢盔啦';
        g.miss();
        return;
      }
      m.armored = true; m.noteT = 1.8; m.noteBad = true; m.note = '组不成词';
      wv.wrongs = (wv.wrongs || 0) + 1;
      const okList = wv.n._ok.map((o) => o.w).join('、');
      const note = '“' + c + '”和“' + m.ch + '”组不成词。' + (okList ? '可以组：' + okList : '');
      // 乱甩：扣心、降星照旧（乱按会很快输），item 传 null → 不进错题本
      g.wrong(judged === 'flick' ? null : item, note, m.x, m.y - m.r, { reveal: revealText() });
    }
    /** 直接撞到错字 m 时，算不算“华文判断错”。返回 true（记错题 + 扣心）/ 'flick'（一甩就放：扣心但不记错题）/
     *  false（手没跟上：软弹开、g.miss）。不算的原因写进 b.whyMiss。 */
    const AIM_HOLD = 0.3, MARK_HOLD = 0.25;   // 秒：拉弓不到 0.3 秒就松手 / 瞄准框停在它身上不到 0.25 秒 = 没在认真选
    function judgedWrong(b, m) {
      b.whyMiss = '';
      // 1) P2 / P3 前几关有瞄准框：松手时框就套在这个字上（而且停了一会儿）= 孩子看着它选的
      if (S.cfg.mark && b.mark === m) return b.markHold >= MARK_HOLD && b.hold >= AIM_HOLD ? true : 'flick';
      // 2) 发射时弹道根本没朝它去（气球字怪飘进了弹道、被木块弹过来……）
      const ad = b.aimD && b.aimD.has(m) ? b.aimD.get(m) : 0;
      if (ad > b.r + m.r + m.bobA + S.u * 0.35) { b.whyMiss = '打偏啦'; return false; }
      // 3) 它只是挡在半路：弹道更正地穿过它后面一只能组词的字怪 → 孩子瞄的是后面那只
      if (b.aimT) {
        const tm = b.aimT.get(m) || 0;
        for (const [o, d] of b.aimD) {
          if (o === m || !o.alive || o.armored || !o.ok) continue;
          if ((b.aimT.get(o) || 0) > tm && d < ad * 0.8 && d <= (b.r + o.r) * 0.55) { b.whyMiss = '被它挡住啦'; return false; }
        }
      }
      // 4) 手抖擦到：孩子拉出来的（吸附前）弹道只是擦过这个错字，却从旁边一只能组词的字怪身边险险擦过 → 多半瞄的是那只
      if (b.rawD) {
        const qm = (b.rawD.has(m) ? b.rawD.get(m) : 0) / (b.r + m.r);
        if (qm > SHAKY_Q) {
          for (const [o, d] of b.rawD) {
            if (o === m || !o.alive || o.armored || !o.ok) continue;
            if (d / (b.r + o.r) < NEAR_Q) { b.whyMiss = '差一点！'; return false; }
          }
        }
      }
      return b.hold >= AIM_HOLD ? true : 'flick';
    }
    /** 结算面板上的“正确答案”：这一波还没找到的词 */
    function revealText() {
      const wv = S.wave;
      if (!wv) return null;
      const rest = wv.ok.filter((o) => wv.found.indexOf(o.w) < 0).map((o) => o.w);
      return rest.length ? '“' + wv.n.c + '”还能组：' + rest.join('、') : null;
    }
    function onWin(g) {
      if (S.bonusDone) return;
      S.bonusDone = true;
      const n = S.birdsLeft;
      for (let i = 0; i < n; i++) {
        g.after(0.35 + i * 0.28, () => {
          const x = clamp(S.ax + S.u * (1.4 + (i % 3) * 0.9), 40, g.w - 40), y = S.gY - S.u * (0.4 + (i % 2) * 0.5);
          g.addScore(20, x, y - S.u);
          g.burst(x, y, { kind: 'star', n: 8 });
          g.sfx('coin');
        });
      }
      S.birdsLeft = 0;
    }
    function endFlight(g, b, out) {
      if (b.resolved) return;
      b.resolved = true;
      const x = clamp(b.body.position.x, 40, g.w - 40), y = clamp(b.body.position.y, S.top + 20, S.gY - 10);
      if (!b.spent) g.miss(x, y - 20);     // 什么字怪也没打中
      removeBird(g, !out);
      S.phase = 'resolve';
      g.after(0.45, () => afterShot(g));
    }
    function removeBird(g, poof) {
      const b = S.bird;
      if (!b) return;
      if (b.body) {
        if (poof) g.burst(b.body.position.x, b.body.position.y, { kind: 'dot', color: '#FFFFFF', n: 10 });
        try { S.M.Composite.remove(S.world, b.body); } catch (e) { /* ignore */ }
        b.body = null;
      }
      S.bird = null;
    }
    function explodeFort(g, m) {
      const M = S.M, f = m.fort;
      f.alive = false;
      const cx = m.x, cy = m.y;
      f.blocks.forEach((b) => {
        if (!b._in) return;
        M.Sleeping.set(b, false);
        b.collisionFilter = { category: C_DEB, mask: 0, group: 0 };
        const dx = b.position.x - cx, dy = b.position.y - cy, d = Math.hypot(dx, dy) || 1;
        const sp = rnd(7, 12) * S.u / 30;
        M.Body.setVelocity(b, { x: dx / d * sp + rnd(-2, 2), y: dy / d * sp - rnd(6, 10) * S.u / 30 });
        M.Body.setAngularVelocity(b, rnd(-0.4, 0.4));
        b.plugin.die = 0.001;
        S.debris.push(b);
        g.burst(b.position.x, b.position.y, { kind: 'dot', color: MAT[b.plugin.mat].d, n: 5 });
      });
      f.blocks = [];
      if (f.island && f.island._in) { M.Composite.remove(S.world, f.island); f.island._in = false; f.islandFall = 0.001; }   // 岛也碎掉，不再挡路
      if (m.body) { M.Composite.remove(S.world, m.body); m.body = null; }
      m.popT = 0.001;
      g.burst(cx, cy, { kind: 'star', n: 18 });
    }

    /* ---------- 输入 ---------- */
    function canAim() { return S.ready && S.levelReady && S.phase === 'ready' && G0 && G0.state === 'play'; }
    function monAt(p) {
      for (const m of S.mons) if (m.alive && Math.hypot(p.x - m.x, p.y - m.y) < m.r * 1.15) return m;
      return null;
    }
    function inBanner(p, g) { return p.y > g.hudTop && p.y < g.hudTop + S.banH + 6; }

    /* ---------- 绘制 ---------- */
    function drawGround(c, g) {
      const w = g.w, gy = S.gY, night = S.cfg && S.cfg.night;
      const u = S.u;
      // 草地 + 土层
      const gr = c.createLinearGradient(0, gy, 0, g.h);
      gr.addColorStop(0, night ? '#2F6E3E' : '#6CCB5F'); gr.addColorStop(0.18, night ? '#28603A' : '#54B04A');
      gr.addColorStop(0.2, night ? '#5A4030' : '#B7824A'); gr.addColorStop(1, night ? '#3E2B20' : '#8E5E32');
      c.fillStyle = gr;
      c.beginPath(); c.moveTo(-10, g.h + 10); c.lineTo(-10, gy);
      for (let x = -10; x <= w + 20; x += 20) c.lineTo(x, gy + Math.sin(x * 0.05) * 1.5);
      c.lineTo(w + 20, g.h + 10); c.closePath(); c.fill();
      c.strokeStyle = night ? '#1E4A2A' : '#3E9B45'; c.lineWidth = 3;
      c.beginPath(); c.moveTo(-10, gy);
      for (let x = -10; x <= w + 20; x += 20) c.lineTo(x, gy + Math.sin(x * 0.05) * 1.5);
      c.stroke();
      // 草尖
      c.fillStyle = night ? '#3E8A4E' : '#8BE070';
      for (let x = 6; x < w; x += 26) {
        const s = Math.sin(S.tt * 2 + x) * 1.5;
        c.beginPath(); c.moveTo(x - 5, gy + 2); c.lineTo(x + s, gy - 7); c.lineTo(x + 5, gy + 2); c.closePath(); c.fill();
      }
      // 小石子
      c.fillStyle = night ? 'rgba(255,255,255,.08)' : 'rgba(255,255,255,.18)';
      for (let i = 0; i < 14; i++) {
        const x = ((i * 97) % 100) / 100 * w, y = gy + 0.3 * u + ((i * 37) % 10) / 10 * (g.h - gy - 0.4 * u);
        c.beginPath(); c.ellipse(x, y, 4 + (i % 3), 2.5, 0, 0, TAU); c.fill();
      }
    }
    function drawIsland(c, b, alpha, dy) {
      const P = b.plugin, x = b.position.x, y = b.position.y + (dy || 0), w = P.w, h = P.h;
      const night = S.cfg && S.cfg.night;
      c.save();
      c.globalAlpha = alpha;
      // 岩石底（倒三角）
      c.fillStyle = night ? '#6B4B36' : '#B98A5A';
      c.beginPath(); c.moveTo(x - w / 2 + 4, y); c.lineTo(x + w / 2 - 4, y);
      c.quadraticCurveTo(x + w * 0.3, y + h * 1.4, x + w * 0.06, y + h * 2.3);
      c.quadraticCurveTo(x - w * 0.04, y + h * 2.6, x - w * 0.12, y + h * 2.1);
      c.quadraticCurveTo(x - w * 0.36, y + h * 1.3, x - w / 2 + 4, y); c.closePath(); c.fill();
      c.lineWidth = 3; c.strokeStyle = NAVY; c.stroke();
      c.fillStyle = night ? '#553A2A' : '#9A6C40';
      c.beginPath(); c.moveTo(x - w * 0.1, y + h * 0.6); c.quadraticCurveTo(x + w * 0.05, y + h * 1.6, x + w * 0.03, y + h * 2.1); c.lineTo(x - w * 0.06, y + h * 1.9); c.closePath(); c.fill();
      // 草皮
      rrPath(c, x - w / 2, y - h / 2, w, h, h * 0.45);
      c.fillStyle = night ? '#3C8A4C' : '#6CCB5F'; c.fill();
      c.lineWidth = 3; c.strokeStyle = NAVY; c.stroke();
      c.fillStyle = night ? 'rgba(255,255,255,.12)' : 'rgba(255,255,255,.35)';
      rrPath(c, x - w / 2 + 6, y - h / 2 + 3, w - 12, h * 0.28, h * 0.14); c.fill();
      // 垂下的藤
      c.strokeStyle = night ? '#2F6E3E' : '#3E9B45'; c.lineWidth = 2.5; c.lineCap = 'round';
      const sd = P.seed;
      for (let i = 0; i < 3; i++) {
        const vx = x - w * 0.3 + i * w * 0.3 + ((sd * (i + 1)) % 7) - 3, len = h * (0.8 + ((sd * (i + 3)) % 10) / 10);
        c.beginPath(); c.moveTo(vx, y + h / 2); c.quadraticCurveTo(vx + Math.sin(S.tt * 1.5 + i + sd) * 4, y + h / 2 + len * 0.6, vx + 2, y + h / 2 + len); c.stroke();
      }
      c.restore();
    }
    function drawBlock(c, b, alpha, dy) {
      const P = b.plugin, T = MAT[P.mat];
      const w = P.w, h = P.h;
      c.save();
      c.globalAlpha = alpha;
      c.translate(b.position.x, b.position.y + (dy || 0)); c.rotate(b.angle);
      rrPath(c, -w / 2, -h / 2, w, h, Math.min(5, w * 0.18, h * 0.18));
      c.fillStyle = T.f; c.fill();
      c.lineWidth = 2.5; c.strokeStyle = NAVY; c.stroke();
      // 纹理
      c.strokeStyle = T.g; c.lineWidth = 1.6; c.lineCap = 'round';
      if (P.mat === 'wood') {
        const horiz = w > h;
        const n = Math.max(1, Math.floor((horiz ? h : w) / 9));
        for (let i = 1; i <= n; i++) {
          const k = i / (n + 1) - 0.5;
          c.beginPath();
          if (horiz) { c.moveTo(-w / 2 + 5, k * h); c.lineTo(w / 2 - 5, k * h + ((P.seed + i) % 3) - 1); }
          else { c.moveTo(k * w, -h / 2 + 5); c.lineTo(k * w + ((P.seed + i) % 3) - 1, h / 2 - 5); }
          c.stroke();
        }
        if (w > 20 && h > 20) { c.strokeStyle = T.d; c.lineWidth = 2; c.beginPath(); c.moveTo(-w / 2 + 5, -h / 2 + 5); c.lineTo(w / 2 - 5, h / 2 - 5); c.moveTo(w / 2 - 5, -h / 2 + 5); c.lineTo(-w / 2 + 5, h / 2 - 5); c.stroke(); }
      } else if (P.mat === 'stone') {
        c.beginPath(); c.moveTo(-w * 0.2, -h / 2 + 3); c.lineTo(-w * 0.05, -h * 0.05); c.lineTo(-w * 0.18, h * 0.3); c.stroke();
        c.fillStyle = 'rgba(255,255,255,.25)'; c.beginPath(); c.arc(w * 0.18, -h * 0.15, Math.min(w, h) * 0.12, 0, TAU); c.fill();
      } else {
        c.strokeStyle = T.hl; c.lineWidth = 2.5; c.beginPath(); c.moveTo(-w / 2 + 5, h / 2 - 6); c.lineTo(-w / 2 + Math.min(w, h) * 0.5, -h / 2 + 5); c.stroke();
      }
      c.fillStyle = T.hl; rrPath(c, -w / 2 + 3, -h / 2 + 2, w - 6, Math.min(4, h * 0.2), 2); c.fill();
      c.restore();
    }
    function drawMonster(c, g, m, dy) {
      if (!m.alive && !(m.popT > 0)) return;
      const r = m.r;
      let x = m.x, y = m.y + (dy || 0);
      if (m.leaving > 0) { y -= m.leaving * m.leaving * 900; x += m.leaving * 160; }
      const pop = m.pop < 1 ? oBack(clamp(m.pop, 0, 1)) : 1;
      if (m.popT > 0) return;                   // 被打中：已经炸成星星
      const t = S.tt;
      const sq = Math.sin(t * 3.2 + m.ph) * 0.045 + (m.hitT > 0 ? Math.sin(m.hitT * 40) * 0.08 : 0);
      c.save();
      c.translate(x, y);
      c.scale(pop * (1 + sq), pop * (1 - sq));
      // 气球
      if (m.fly) {
        const bx = -r * 0.1, by = -r * 2.6;
        c.strokeStyle = 'rgba(29,43,83,.7)'; c.lineWidth = 1.6;
        c.beginPath(); c.moveTo(0, -r * 0.9); c.quadraticCurveTo(bx + Math.sin(t * 2 + m.ph) * 5, -r * 1.6, bx, by + r * 0.8); c.stroke();
        c.fillStyle = m.col.b; c.beginPath(); c.ellipse(bx, by, r * 0.72, r * 0.86, 0, 0, TAU); c.fill();
        c.lineWidth = 2.5; c.strokeStyle = NAVY; c.stroke();
        c.fillStyle = 'rgba(255,255,255,.55)'; c.beginPath(); c.ellipse(bx - r * 0.25, by - r * 0.3, r * 0.14, r * 0.26, -0.4, 0, TAU); c.fill();
        c.fillStyle = m.col.d; c.beginPath(); c.moveTo(bx - 5, by + r * 0.84); c.lineTo(bx + 5, by + r * 0.84); c.lineTo(bx, by + r * 0.95); c.closePath(); c.fill();
      }
      const col = m.armored ? { b: '#A7B1BE', d: '#6E7887', l: '#D5DCE4' } : m.col;
      // 脚
      c.fillStyle = col.d;
      c.beginPath(); c.ellipse(-r * 0.42, r * 0.9, r * 0.26, r * 0.14, 0, 0, TAU); c.ellipse(r * 0.42, r * 0.9, r * 0.26, r * 0.14, 0, 0, TAU); c.fill();
      // 身体
      const gr = c.createRadialGradient(-r * 0.35, -r * 0.4, r * 0.2, 0, 0, r * 1.05);
      gr.addColorStop(0, col.l); gr.addColorStop(0.55, col.b); gr.addColorStop(1, col.d);
      c.fillStyle = gr;
      c.beginPath(); c.arc(0, 0, r, 0, TAU); c.fill();
      c.lineWidth = 3; c.strokeStyle = NAVY; c.stroke();
      // 眼睛（在头顶鼓包上），看着小鸟
      let lx = S.ax, ly = S.ay;
      if (S.bird && S.bird.body) { lx = S.bird.body.position.x; ly = S.bird.body.position.y; }
      const la = Math.atan2(ly - y, lx - x);
      const blink = ((t + m.blink) % 4.2) < 0.12;
      for (const sx of [-1, 1]) {
        const ex = sx * r * 0.4, ey = -r * 0.86, er = r * 0.27;
        c.fillStyle = col.b; c.beginPath(); c.arc(ex, ey + er * 0.2, er * 1.12, 0, TAU); c.fill(); c.lineWidth = 2.5; c.strokeStyle = NAVY; c.stroke();
        c.fillStyle = '#FFFFFF'; c.beginPath(); c.arc(ex, ey, er * (blink ? 0.2 : 0.86), 0, TAU); c.fill();
        if (!blink) { c.fillStyle = NAVY; c.beginPath(); c.arc(ex + Math.cos(la) * er * 0.35, ey + Math.sin(la) * er * 0.35, er * 0.42, 0, TAU); c.fill(); }
      }
      // 钢盔
      if (m.armored) {
        c.fillStyle = '#8C97A6'; c.beginPath(); c.arc(0, -r * 0.62, r * 0.78, Math.PI * 1.05, Math.PI * 1.95); c.closePath(); c.fill();
        c.lineWidth = 2.5; c.strokeStyle = NAVY; c.stroke();
        c.fillStyle = '#C9D1DB'; c.beginPath(); c.arc(-r * 0.25, -r * 1.05, r * 0.1, 0, TAU); c.fill();
      }
      // 肚子上的字牌
      const br = r * 0.66;
      c.fillStyle = '#FFFFFF'; c.beginPath(); c.arc(0, r * 0.1, br, 0, TAU); c.fill();
      c.lineWidth = 2.5; c.strokeStyle = m.armored ? '#6E7887' : col.d; c.stroke();
      g.text(m.ch, 0, r * 0.12, { size: Math.round(br * 1.45), font: 'kai', weight: 700, color: m.armored ? '#6E7887' : NAVY });
      // 嘴（笑）
      if (m.laughT > 0) {
        c.fillStyle = '#7A1F2B'; c.beginPath(); c.ellipse(0, r * 0.82, r * 0.22, r * 0.12 + Math.abs(Math.sin(t * 18)) * r * 0.06, 0, 0, TAU); c.fill();
      }
      c.restore();
      // 钢盾（撞上的一瞬间）
      if (m.shieldT > 0) {
        const a = clamp(m.shieldT / 0.3, 0, 1);
        const sx = x + Math.cos(m.shieldAng) * r * 1.15, sy = y + Math.sin(m.shieldAng) * r * 1.15;
        c.save(); c.globalAlpha = a; c.translate(sx, sy); c.rotate(m.shieldAng + Math.PI / 2);
        const s = r * (1.05 + (0.9 - m.shieldT) * 0.4);
        c.beginPath(); c.moveTo(-s * 0.7, -s * 0.5); c.quadraticCurveTo(0, -s * 0.75, s * 0.7, -s * 0.5); c.lineTo(s * 0.6, s * 0.05); c.quadraticCurveTo(0, s * 0.8, -s * 0.6, s * 0.05); c.closePath();
        const sg = c.createLinearGradient(-s, 0, s, 0); sg.addColorStop(0, '#E8EEF5'); sg.addColorStop(0.5, '#AAB6C4'); sg.addColorStop(1, '#7D8898');
        c.fillStyle = sg; c.fill(); c.lineWidth = 3; c.strokeStyle = NAVY; c.stroke();
        c.fillStyle = '#FFFFFF'; c.beginPath(); c.arc(-s * 0.3, -s * 0.28, s * 0.07, 0, TAU); c.arc(s * 0.3, -s * 0.28, s * 0.07, 0, TAU); c.fill();
        c.restore();
      }
      // 小字提示（组不成词 / 要直接打中）
      if (m.noteT > 0 && m.note) {
        const a = clamp(m.noteT / 0.3, 0, 1);
        const fs = Math.round(clamp(S.u * 0.52, 14, 20));
        const tw = g.measure(m.note, fs, 'round') + 18;
        const nx = clamp(x, tw / 2 + 6, g.w - tw / 2 - 6), ny = Math.max(S.top + fs, y - r * 2.75 - (m.fly ? r * 1.9 : 0));
        c.save(); c.globalAlpha = a;
        g.rrect(nx - tw / 2, ny - fs * 0.8, tw, fs * 1.6, fs * 0.8, m.noteBad ? '#FFE1E1' : '#FFF6D6', NAVY, 2);
        g.text(m.note, nx, ny + 1, { size: fs, font: 'round', color: m.noteBad ? '#C62828' : '#8A5A00' });
        c.restore();
      }
    }
    function drawBird(c, g, x, y, r, rot, ch, o) {
      o = o || {};
      c.save();
      c.translate(x, y);
      if (o.flip) c.scale(-1, 1);
      c.rotate(rot || 0);
      const sq = o.sq || 0;
      c.scale(1 + sq, 1 - sq);
      // 尾巴
      c.fillStyle = NAVY;
      for (let i = -1; i <= 1; i++) { c.beginPath(); c.ellipse(-r * 1.0, i * r * 0.22, r * 0.34, r * 0.11, i * 0.35, 0, TAU); c.fill(); }
      // 身体
      const gr = c.createRadialGradient(-r * 0.3, -r * 0.35, r * 0.15, 0, 0, r);
      gr.addColorStop(0, '#FF9A8C'); gr.addColorStop(0.6, '#F25C54'); gr.addColorStop(1, '#C23A3A');
      c.fillStyle = gr; c.beginPath(); c.arc(0, 0, r, 0, TAU); c.fill();
      c.lineWidth = 2.5; c.strokeStyle = NAVY; c.stroke();
      // 头顶羽毛
      c.fillStyle = '#C23A3A';
      c.beginPath(); c.ellipse(-r * 0.1, -r * 1.02, r * 0.14, r * 0.3, -0.3, 0, TAU); c.ellipse(r * 0.12, -r * 0.98, r * 0.12, r * 0.26, 0.3, 0, TAU); c.fill();
      // 肚皮字牌
      if (ch) {
        const br = r * 0.6;
        c.fillStyle = '#FFF3E6'; c.beginPath(); c.arc(-r * 0.08, r * 0.2, br, 0, TAU); c.fill();
        c.lineWidth = 2; c.strokeStyle = '#C23A3A'; c.stroke();
        // 肚子上的字始终正着、不跟着身体压扁（先撤掉压扁，再撤掉旋转 / 翻转；飞行中也是端正的楷体）
        c.save(); c.translate(-r * 0.08, r * 0.22); c.scale(1 / (1 + sq), 1 / (1 - sq)); c.rotate(-(rot || 0)); if (o.flip) c.scale(-1, 1);
        g.text(ch, 0, 0, { size: Math.round(br * 1.45), font: 'kai', weight: 700, color: NAVY });
        c.restore();
      }
      // 眼睛 + 眉毛
      const ex = r * 0.34, ey = -r * 0.36;
      c.fillStyle = '#FFFFFF'; c.beginPath(); c.arc(ex, ey, r * 0.26, 0, TAU); c.fill(); c.lineWidth = 2; c.strokeStyle = NAVY; c.stroke();
      c.fillStyle = NAVY; c.beginPath(); c.arc(ex + r * 0.08, ey + r * 0.02, r * 0.12, 0, TAU); c.fill();
      c.strokeStyle = NAVY; c.lineWidth = Math.max(2.5, r * 0.13); c.lineCap = 'round';
      c.beginPath(); c.moveTo(ex - r * 0.28, ey - r * 0.36); c.lineTo(ex + r * 0.26, ey - r * 0.2); c.stroke();
      // 嘴
      c.fillStyle = '#FFB020';
      c.beginPath(); c.moveTo(r * 0.72, -r * 0.18); c.lineTo(r * 1.22, -r * 0.02); c.lineTo(r * 0.72, r * 0.14); c.closePath(); c.fill();
      c.lineWidth = 2; c.strokeStyle = NAVY; c.stroke();
      c.restore();
    }
    function drawSling(c, g, part) {
      const u = S.u, x = S.ax, y = S.ay;
      if (part === 'back') {
        // 木叉（Y 形）
        c.save();
        c.lineCap = 'round'; c.lineJoin = 'round';
        c.strokeStyle = NAVY; c.lineWidth = u * 0.5;
        c.beginPath(); c.moveTo(x, S.gY + 2); c.lineTo(x, y + u * 0.9); c.moveTo(x, y + u * 1.0); c.lineTo(x - u * 0.55, y - u * 0.15); c.moveTo(x, y + u * 1.0); c.lineTo(x + u * 0.5, y - u * 0.2); c.stroke();
        c.strokeStyle = '#A8692F'; c.lineWidth = u * 0.34;
        c.beginPath(); c.moveTo(x, S.gY + 2); c.lineTo(x, y + u * 0.9); c.moveTo(x, y + u * 1.0); c.lineTo(x - u * 0.55, y - u * 0.15); c.moveTo(x, y + u * 1.0); c.lineTo(x + u * 0.5, y - u * 0.2); c.stroke();
        c.strokeStyle = '#D69A5A'; c.lineWidth = u * 0.1;
        c.beginPath(); c.moveTo(x - u * 0.06, S.gY - 4); c.lineTo(x - u * 0.06, y + u * 1.0); c.stroke();
        c.restore();
      }
    }
    function pouchPos() {
      // 皮兜位置：瞄准时 = 拉开处；发射后弹簧回弹（stiffness 0.05 / damping 0.01 的阻尼振动近似）
      if (S.aim.on && S.aim.moved) return { x: S.ax + S.aim.ox, y: S.ay + S.aim.oy };
      if (S.kAim.show) { const o = keyOff(); return { x: S.ax + o.x, y: S.ay + o.y }; }
      const t = S.band.t;
      if (t < 1.2) {
        const w0 = 26, zeta = 0.12, e = Math.exp(-zeta * w0 * t) * Math.cos(w0 * t * 0.99);
        return { x: S.ax + S.band.x * -e * 0.35, y: S.ay + S.band.y * -e * 0.35 };
      }
      return { x: S.ax, y: S.ay };
    }
    function showKeyAim() { if (!S.kAim.show) { S.kAim.show = true; S.kAim.t0 = S.tt; } }
    function keyOff() {
      const a = S.kAim.ang, d = S.kAim.pow * S.maxPull;
      return { x: -Math.cos(a) * d, y: Math.sin(a) * d };
    }
    function drawBands(c, part, px, py) {
      const u = S.u;
      const lx = S.ax - u * 0.55, ly = S.ay - u * 0.15, rx = S.ax + u * 0.5, ry = S.ay - u * 0.2;
      c.save(); c.lineCap = 'round';
      c.strokeStyle = '#5A2A1A'; c.lineWidth = Math.max(4, u * 0.2);
      const br = birdR();
      // 皮兜在鸟身后（左侧），两根皮筋分别从两个叉尖连到皮兜
      const dx = px - S.ax, dy = py - S.ay, d = Math.hypot(dx, dy);
      const nx = d > 4 ? dx / d : -1, ny = d > 4 ? dy / d : 0;
      const qx = px + nx * br * 0.55, qy = py + ny * br * 0.55;
      c.beginPath();
      if (part === 'back') {
        c.moveTo(rx, ry); c.lineTo(qx, qy); c.stroke();
        c.save(); c.translate(qx, qy); c.rotate(Math.atan2(ny, nx));
        c.fillStyle = '#5A2A1A'; rrPath(c, -u * 0.16, -br * 0.8, u * 0.34, br * 1.6, u * 0.14); c.fill();
        c.restore();
      } else { c.moveTo(lx, ly); c.lineTo(qx, qy); c.stroke(); }
      c.restore();
    }
    function drawBanner(c, g) {
      const wv = S.wave;
      const u = S.u, y0 = g.hudTop + 2, h = S.banH, w = g.w;
      const pad = 10, bw = Math.min(w - pad * 2, 720), bx = (w - bw) / 2;
      c.save();
      g.rrect(bx, y0 + 4, bw, h, 18, 'rgba(29,43,83,.35)');
      g.rrect(bx, y0, bw, h, 18, CREAM, NAVY, 3);
      if (!wv) { c.restore(); return; }
      const cc = wv.n.c;
      // 中心字（鸟的颜色；点一下朗读）
      const ping = S.banPing > 0 ? Math.sin(S.banPing * 12) * 0.08 : 0;
      const cr = h * 0.4, cx = bx + 12 + cr, cy = y0 + h / 2;
      c.save(); c.translate(cx, cy); c.scale(1 + ping, 1 + ping);
      c.fillStyle = '#F25C54'; c.beginPath(); c.arc(0, 0, cr, 0, TAU); c.fill(); c.lineWidth = 3; c.strokeStyle = NAVY; c.stroke();
      c.fillStyle = '#FFF3E6'; c.beginPath(); c.arc(0, 0, cr * 0.8, 0, TAU); c.fill();
      g.text(cc, 0, 1, { size: Math.round(cr * 1.2), font: 'kai', weight: 700, color: NAVY });
      c.restore();
      let ttsOk = false;
      try { ttsOk = !!(ctx.tts && ctx.tts.ok); } catch (e) { ttsOk = false; }
      if (ttsOk) g.emoji('🔊', cx + cr * 0.78, cy + cr * 0.72, Math.round(cr * 0.62));
      // 第一行：拼音（P2/P3，题库里有注音才显示）＋ ？；第二行：说明
      const tx = cx + cr + 12;
      const fs = Math.round(clamp(h * 0.34, 17, 26));
      const py = S.gn <= 3 ? (typeof wv.n.py === 'string' && wv.n.py ? wv.n.py : pyOf(cc)) : '';   // zuci 自带本条的读音（多音字以它为准）
      const l1 = S.land ? cy : cy - fs * 0.45;
      let x1 = tx;
      if (py) { x1 += g.text(py, x1, l1, { size: Math.round(fs * 0.86), font: 'py', color: '#C23A3A', weight: 700, align: 'left' }) + 10; }
      x1 += g.text('＋ ？', x1, l1, { size: fs, font: 'round', color: NAVY, align: 'left' }) + 12;
      if (S.land) {   // 引号里的中心字用楷体（题目里的汉字一律楷体）
        const ts = Math.round(fs * 0.72), tc = { size: ts, font: 'round', color: '#5B6B8C', align: 'left' };
        x1 += g.text('打中能和“', x1, cy, tc);
        x1 += g.text(cc, x1 + 1, cy - ts * 0.1, { size: Math.round(ts * 1.15), font: 'kai', weight: 700, color: NAVY, align: 'left' }) + 2;
        x1 += g.text('”组成词的字', x1, cy, tc) + 14;
      } else g.text('能组成词的字', tx, cy + fs * 0.62, { size: Math.round(fs * 0.62), font: 'round', color: '#5B6B8C', align: 'left' });
      // 这一波要找几个（○ 没找到 / ● 找到）：紧跟在“＋ ？”后面（右上角留给引擎的连击牌）
      const right = bx + bw - 12;
      const nOk = wv.ok.length, nf = wv.found.length;
      const dr = clamp(h * 0.12, 6, 9);
      for (let i = 0; i < nOk; i++) {
        const dx = x1 + dr + i * (dr * 2 + 5);
        c.beginPath(); c.arc(dx, l1, dr, 0, TAU);
        c.fillStyle = i < nf ? '#FFB020' : '#FFFFFF'; c.fill(); c.lineWidth = 2; c.strokeStyle = NAVY; c.stroke();
      }
      x1 += nOk * (dr * 2 + 5) + 8;
      if (nf) {
        const fw = Math.round(clamp(h * 0.3, 14, 22));
        let xx = right;
        for (let i = nf - 1; i >= 0; i--) {
          const wd = wv.found[i];
          const tw = g.measure(wd, fw, 'kai', 700) + 14;
          if (xx - tw < (S.land ? x1 : tx + 92)) break;
          g.rrect(xx - tw, y0 + h - fw - 14, tw, fw + 8, 8, '#DCF6E2', '#1B8C3C', 2);
          g.text(wd, xx - tw / 2, y0 + h - fw / 2 - 10, { size: fw, font: 'kai', weight: 700, color: '#1B6B30' });
          xx -= tw + 6;
        }
      } else {
        g.text('还有 ' + nOk + ' 个', right, y0 + h - 18, { size: Math.round(clamp(h * 0.24, 12, 17)), font: 'round', color: '#8A96AE', align: 'right' });
      }
      c.restore();
    }
    function drawQueue(c, g) {
      const n = S.birdsLeft - ((S.phase === 'ready' || S.phase === 'reload' || S.phase === 'wait') && S.birdsLeft > 0 ? 1 : 0);
      const u = S.u, r = u * 0.42;
      const show = Math.min(n, 3);
      for (let i = 0; i < show; i++) {
        const x = S.ax - u * 1.25 - i * r * 2.1, y = S.gY - r + Math.abs(Math.sin(S.tt * 3 + i)) * -4;
        if (x < r) break;
        drawBird(c, g, x, y, r, 0, '', {});
      }
      // 数量牌
      const tx = S.ax + u * 0.9, ty = S.gY + u * 0.7;
      const fs = Math.round(clamp(u * 0.56, 14, 22));
      const label = '🐦×' + Math.max(0, S.birdsLeft);
      const tw = g.measure(label, fs, 'num') + 18;
      g.rrect(tx - 6, ty - fs * 0.75, tw, fs * 1.5, fs * 0.75, 'rgba(29,43,83,.78)', '#FFFFFF', 2);
      g.text(label, tx - 6 + tw / 2, ty + 1, { size: fs, font: 'num', color: S.birdsLeft <= 1 ? '#FFB3B3' : '#FFFFFF' });
    }
    function drawPreview(c, g) {
      let o = null;
      if (S.aim.on && S.aim.moved) o = { x: S.aim.ox, y: S.aim.oy };
      else if (S.kAim.show) o = keyOff();
      if (!o || S.phase !== 'ready') { S.markMon = null; S.markPrev = null; return; }
      const v = launchVec(o.x, o.y);
      if (v.k < 0.12) { S.markMon = null; S.markPrev = null; return; }
      const va = assistVec(v.vx, v.vy);   // 预览画吸附后的弹道：看到的就是打出去的
      const res = simPreview(va.vx, va.vy, S.cfg.preview, S.preview);
      S.markMon = S.cfg.mark ? res.mon : null;
      if (S.markMon !== S.markPrev) { S.markPrev = S.markMon; S.markSince = S.tt; }   // 瞄准框换了人：重新计时
      const n = res.n;
      const yMin = g.hudTop + S.banH + 8;
      for (let i = 2; i < n; i += 3) {
        const p = S.preview[i];
        if (p.y < yMin) continue;   // 飞到横幅 / HUD 后面的点不画
        const a = S.cfg.preview >= 1 ? 1 : clamp(1 - i / n, 0.15, 1);
        const rr = Math.max(2.5, S.u * 0.13 * (1 - i / (n + 40)));
        c.globalAlpha = a;
        c.fillStyle = '#FFFFFF'; c.beginPath(); c.arc(p.x, p.y, rr + 1.6, 0, TAU); c.fill();
        c.fillStyle = NAVY; c.beginPath(); c.arc(p.x, p.y, rr * 0.55, 0, TAU); c.fill();
      }
      c.globalAlpha = 1;
      if (S.markMon) {
        const m = S.markMon, rr = m.r * 1.35 + Math.sin(S.tt * 8) * 2;
        c.save(); c.strokeStyle = '#FFE45C'; c.lineWidth = 4; c.setLineDash([8, 6]); c.lineDashOffset = -S.tt * 30;
        c.beginPath(); c.arc(m.x, m.y, rr, 0, TAU); c.stroke(); c.restore();
      }
      // 力度条
      const bw = S.u * 2.2, bh = 8, bx = S.ax - bw / 2, by = S.gY + S.u * 0.2;
      g.rrect(bx, by, bw, bh, 4, 'rgba(29,43,83,.55)');
      g.rrect(bx, by, bw * v.k, bh, 4, v.k > 0.85 ? '#FF7043' : '#FFD23F');
    }
    function drawWordBanner(c, g) {
      const B = S.wordBan;
      if (!B) return;
      const t = B.t;
      if (t > 1.45) { S.wordBan = null; return; }
      const k = t < 0.35 ? oBack(t / 0.35) : 1;
      const a = t > 1.1 ? 1 - (t - 1.1) / 0.35 : 1;
      const fs = Math.round(clamp(S.u * 1.6, 44, 72));
      const cy = S.top + (S.gY - S.top) * 0.16 + fs * 0.4;
      c.save(); c.globalAlpha = clamp(a, 0, 1);
      c.translate(g.w / 2, cy); c.scale(k, k); c.rotate(Math.sin(t * 6) * 0.03);
      const tw = g.measure(B.w, fs, 'kai', 700) + fs * 0.9;
      g.rrect(-tw / 2, -fs * 0.72 + 5, tw, fs * 1.44, fs * 0.4, 'rgba(29,43,83,.4)');
      g.rrect(-tw / 2, -fs * 0.72, tw, fs * 1.44, fs * 0.4, '#FFE45C', NAVY, 4);
      g.text(B.w, 0, 3, { size: fs, font: 'kai', weight: 700, color: NAVY });
      if (B.py) g.text(B.py, 0, -fs * 0.72 - 14, { size: Math.round(fs * 0.34), font: 'py', color: '#FFFFFF', stroke: NAVY, strokeW: 4, weight: 700 });
      c.restore();
    }
    function drawMsg(c, g) {
      const m = S.msg;
      if (!m) return;
      if (m.t > m.dur) { S.msg = null; return; }
      const a = m.t < 0.2 ? m.t / 0.2 : m.t > m.dur - 0.3 ? (m.dur - m.t) / 0.3 : 1;
      const k = m.t < 0.3 ? oBack(m.t / 0.3) : 1;
      const cy = S.top + (S.gY - S.top) * 0.45;
      c.save(); c.globalAlpha = clamp(a, 0, 1); c.translate(g.w / 2, cy); c.scale(k, k);
      g.shadowText(m.text, 0, 0, { size: Math.round(clamp(S.u * 1.3, 32, 56)), color: m.col });
      if (m.sub) g.text(m.sub, 0, S.u * 1.25, { size: Math.round(clamp(S.u * 0.8, 20, 34)), font: 'kai', weight: 700, color: '#FFFFFF', stroke: NAVY, strokeW: 5 });
      c.restore();
    }
    function drawLoading(c, g) {
      const cx = g.w / 2, cy = g.h * 0.5;
      g.rrect(cx - 150, cy - 70, 300, 140, 22, CREAM, NAVY, 3);
      if (S.err) {
        g.text('弹弓零件没运到 😢', cx, cy - 22, { size: 22, font: 'round', color: NAVY });
        g.text('检查一下网络，点这里再试一次', cx, cy + 18, { size: 16, font: 'round', color: '#5B6B8C' });
      } else {
        g.text('弹弓零件运来中…', cx, cy - 18, { size: 22, font: 'round', color: NAVY });
        for (let i = 0; i < 3; i++) {
          const a = S.tt * 5 + i * 0.9;
          c.fillStyle = ['#F25C54', '#FFB020', '#2EBD55'][i];
          c.beginPath(); c.arc(cx - 26 + i * 26, cy + 26 - Math.abs(Math.sin(a)) * 12, 8, 0, TAU); c.fill();
        }
      }
    }
    function drawHint(c, g) {
      // 教学小手：这一关还没打过（1–2 关）或者发呆 7 秒 → 从鸟身上往左下拖的示范
      if (S.phase !== 'ready' || S.aim.on || S.kAim.show || g.state !== 'play') return;
      const need = (g.level <= 2 && S.shots === 0 && S.idleT > 0.8) || S.idleT > 7;
      if (!need) return;
      const u = S.u, k = (S.idleT * 0.8) % 1;
      const e = k < 0.7 ? oCubic(k / 0.7) : 1;
      const hx = S.ax + lerp(0, -1.9 * u, e), hy = S.ay + lerp(0, 1.2 * u, e);
      const a = k > 0.85 ? (1 - k) / 0.15 : 1;
      c.save(); c.globalAlpha = clamp(a, 0, 1);
      c.strokeStyle = 'rgba(255,255,255,.9)'; c.lineWidth = 3; c.setLineDash([6, 6]);
      c.beginPath(); c.moveTo(S.ax, S.ay); c.lineTo(hx, hy); c.stroke(); c.setLineDash([]);
      g.emoji('👆', hx + u * 0.3, hy + u * 0.55, Math.round(u * 1.2), { rot: -0.4 });
      c.restore();
      // 说明牌放在弹弓正上方、两行窄牌：不伸进右边的堡垒区，不挡字怪身上的字
      const fs = Math.round(clamp(u * 0.5, 14, 19));
      const L = ['按住往后拉，', '松手发射！'];
      const tw = Math.max(g.measure(L[0], fs, 'round'), g.measure(L[1], fs, 'round')) + 24;
      const bh = fs * 2.5 + 12;
      const bx = clamp(S.ax - tw * 0.4, 6, Math.max(6, zoneMinX() - monR() - tw - 6));
      const by = Math.max(S.top + 4, S.ay - u * 1.7 - bh);
      g.rrect(bx, by, tw, bh, 14, 'rgba(29,43,83,.85)', '#FFFFFF', 2);
      g.text(L[0], bx + tw / 2, by + 6 + fs * 0.7, { size: fs, font: 'round', color: '#FFFFFF' });
      g.text(L[1], bx + tw / 2, by + 6 + fs * 1.95, { size: fs, font: 'round', color: '#FFE45C' });
    }
    function drawTopArrow(c, g, x, y) {
      // 鸟飞出屏幕上方：顶部小箭头
      const ay = g.hudTop + S.banH + 18;
      if (y > ay - 10) return;
      c.fillStyle = '#F25C54'; c.strokeStyle = NAVY; c.lineWidth = 2;
      c.beginPath(); c.moveTo(x, ay - 12); c.lineTo(x + 10, ay + 4); c.lineTo(x - 10, ay + 4); c.closePath(); c.fill(); c.stroke();
    }

    /* ---------- 每帧动画（不依赖物理） ---------- */
    function anim(g, dt) {
      S.tt += dt;
      S.band.t += dt;
      if (S.wordBan) S.wordBan.t += dt;
      if (S.msg) S.msg.t += dt;
      if (S.banPing > 0) S.banPing -= dt;
      if (S.hop) { S.hop.t += dt; if (S.hop.t >= S.hop.dur) { S.hop = null; if (S.phase === 'reload') S.phase = 'ready'; } }
      S.phaseT += dt;
      if (S.phase === 'ready' && !S.aim.on && !S.kAim.show) S.idleT += dt; else S.idleT = 0;
      for (const m of S.mons) {
        if (m.pop < 1 && (!m.fort || m.fort.drop >= 1)) m.pop = Math.min(1, m.pop + dt * 2.6);
        if (m.hitT > 0) m.hitT -= dt;
        if (m.laughT > 0) m.laughT -= dt;
        if (m.shieldT > 0) m.shieldT -= dt;
        if (m.noteT > 0) m.noteT -= dt;
        if (m.popT > 0) m.popT += dt;
        if (m.leaving > 0) m.leaving += dt;
        if (m.resc && m.resc.t < 1) m.resc.t += dt / 0.8;
      }
      for (const f of S.forts) {
        if (f.drop < 1) { if (f.dropDelay > 0) f.dropDelay -= dt; else f.drop = Math.min(1, f.drop + dt * 1.6); if (f.drop >= 1) g.sfx('pop'); }
        if (f.leave > 0) f.leave += dt;
        if (f.islandFall > 0) f.islandFall += dt;
      }
      // 碎片：飞一会儿就淡出、移走
      for (let i = S.debris.length - 1; i >= 0; i--) {
        const b = S.debris[i];
        b.plugin.die += dt;
        if (b.plugin.die > 1.4 || b.position.y > g.h + 200) {
          if (b._in) { try { S.M.Composite.remove(S.world, b); } catch (e) { /* ignore */ } b._in = false; }
          S.debris.splice(i, 1);
        }
      }
      // 鸟尾迹
      const b = S.bird;
      if (b && b.body) {
        b.lastTrail += dt;
        if (b.lastTrail > 0.035) { b.lastTrail = 0; b.trail.push({ x: b.body.position.x, y: b.body.position.y, t: 0 }); if (b.trail.length > 26) b.trail.shift(); }
      }
    }

    /* ================= spec ================= */
    const spec = {
      maxLevel: 10, lives: 3, rounds: 6, music: 'bright', sky: 'day',
      palms: false,       // day 背景左下 / 右下的前景大椰树会和弹弓、排队的小鸟叠在一起（引擎 2.2 起可关）
      speakIcon: false,   // 横幅上的中心字自带 🔊（点它朗读）；引擎的“朗读中”小喇叭会压在它上面
      // 最后一个词打中后，让炸开的横幅和“剩下的鸟变金币”演完再盖结算面板；鸟用完 / 心没了也先看清钢盾弹回
      endDelay: (g, win) => (win ? clamp(1.1 + S.bonusN * 0.28, 1.1, 3) : 1.1),
      intro: '拉弹弓！打中能和鸟肚子上的字组成词的字怪',
      controls: '拖动发射 · ↑↓ 角度 ←→ 力度 · 空格发射',
      init(g) {
        G0 = g;
        S.gn = g.gradeNum || (parseInt(String(g.grade || 'p3').slice(1), 10) || 3);
        const E = entriesFor(g.grade || 'p3');
        S.entries = E.list; S.src = E.src;
        S.cfg = cfgFor(g.level, S.gn);
        g.sky = S.cfg.night ? 'night' : 'day';
        S.msg = null; S.wordBan = null; S.bonusDone = false; S.bonusN = 0; S.levelReady = false; S.phase = 'load'; S.shots = 0; S.idleT = 0;
        S.aim.on = false; S.kAim.show = false; S.hop = null; S.band.t = 9;
        geom(g);
        planLevel(g);
        S.wave = S.waves[0] || null;   // 物理还没下载好时，横幅也先显示中心字
        if (S.ready) setupLevel(g);
        else {
          S.pendingLevel = true;
          ensureMatter(g);
        }
        W.__sling = { S, g, spec, solve, mons: () => S.mons.filter((m) => m.alive).map((m) => ({ ch: m.ch, ok: m.ok, x: m.x, y: m.y, r: m.r, armored: m.armored, fly: m.fly })) };
      },
      play(g) {
        if (S.levelReady && S.phase === 'wait') startWave(g, true);
      },
      pause() {
        // 拉着弓按了暂停：暂停时松手收不到 up，继续后弓会一直拉着 → 暂停就把这次拉弓取消
        S.aim.on = false; S.aim.moved = false; S.aim.tapBan = false; S.markMon = null; S.markPrev = null;
      },
      update(g, dt) {
        anim(g, dt);
        if (!S.ready || !S.levelReady) return;
        // 键盘瞄准（按住连续调）
        if (S.phase === 'ready' && !S.aim.on) {
          const H = g.held;
          let ch = false;
          if (H.up) { S.kAim.ang = clamp(S.kAim.ang + dt * 0.9, -0.2, 1.45); ch = true; }
          if (H.down) { S.kAim.ang = clamp(S.kAim.ang - dt * 0.9, -0.2, 1.45); ch = true; }
          if (H.right) { S.kAim.pow = clamp(S.kAim.pow + dt * 0.55, 0.15, 1); ch = true; }
          if (H.left) { S.kAim.pow = clamp(S.kAim.pow - dt * 0.55, 0.15, 1); ch = true; }
          if (ch) showKeyAim();
        }
        stepWorld(g, dt);
        if (S.phase === 'ready' || S.phase === 'reload') rescueStuck(g, dt);
      },
      draw(g, c) {
        const now = (W.performance && performance.now) ? performance.now() : Date.now();
        const dtd = S.lastDraw ? clamp((now - S.lastDraw) / 1000, 0, 0.05) : 0;
        S.lastDraw = now;
        if (g.state === 'over' && S.ready && S.levelReady) { anim(g, dtd); stepWorld(g, dtd); }
        else if (g.state === 'intro') S.tt += dtd;
        drawGround(c, g);
        if (!S.ready) { drawSling(c, g, 'back'); drawLoading(c, g); drawBanner(c, g); return; }
        const u = S.u;
        // 岛 + 积木 + 字怪（新一波从天上掉下来）
        for (const f of S.forts) {
          const dy = f.drop < 1 ? -(1 - oBounce(clamp(f.drop, 0, 1))) * (g.h * 0.9) : 0;
          const la = f.leave > 0 ? clamp(1 - f.leave / 0.7, 0, 1) : 1;
          const ly = f.leave > 0 ? f.leave * f.leave * 300 : 0;
          if (f.island && f.islandFall > 0) { if (f.islandFall < 0.9) drawIsland(c, f.island, la * clamp(1 - f.islandFall / 0.9, 0, 1), dy + ly + f.islandFall * f.islandFall * 500); }
          else if (f.island) drawIsland(c, f.island, la, dy + ly);
        }
        for (const f of S.forts) {
          const dy = f.drop < 1 ? -(1 - oBounce(clamp(f.drop, 0, 1))) * (g.h * 0.9) : 0;
          const la = f.leave > 0 ? clamp(1 - f.leave / 0.7, 0, 1) : 1;
          const ly = f.leave > 0 ? f.leave * f.leave * 300 : 0;
          for (const b of f.blocks) drawBlock(c, b, la, dy + ly);
        }
        for (const b of S.debris) drawBlock(c, b, clamp(1 - b.plugin.die / 1.4, 0, 1), 0);
        for (const f of S.forts) {
          const m = f.mon;
          if (!m) continue;
          const dy = f.drop < 1 ? -(1 - oBounce(clamp(f.drop, 0, 1))) * (g.h * 0.9) : 0;
          if (f.leave > 0 && !(m.leaving > 0) && m.alive) { c.save(); c.globalAlpha = clamp(1 - f.leave / 0.7, 0, 1); drawMonster(c, g, m, dy + f.leave * f.leave * 300); c.restore(); }
          else drawMonster(c, g, m, dy);
        }
        // 弹弓 + 鸟
        drawSling(c, g, 'back');
        drawQueue(c, g);
        const wv = S.wave, ch = wv ? wv.n.c : '';
        const P = pouchPos();
        const showBirdInSling = S.levelReady && (S.phase === 'ready' || S.phase === 'reload' || S.phase === 'wait') && S.birdsLeft > 0;
        drawBands(c, 'back', P.x, P.y);
        // 前面那根皮筋也画在鸟身后：拉弓时皮筋不再横穿鸟肚子上的中心字（字是这一关最要紧的信息）
        drawBands(c, 'front', P.x, P.y);
        if (showBirdInSling) {
          let bx = P.x, by = P.y, rot = 0, sq = 0;
          if (S.hop) {
            const k = clamp(S.hop.t / S.hop.dur, 0, 1);
            const sx = S.ax - u * 1.25, sy = S.gY - u * 0.42;
            bx = lerp(sx, S.ax, k); by = lerp(sy, S.ay, k) - Math.sin(k * Math.PI) * u * 2; rot = -k * TAU;
          } else if (S.aim.on && S.aim.moved) { rot = Math.atan2(-S.aim.oy, -S.aim.ox) * 0.3; sq = -clamp(Math.hypot(S.aim.ox, S.aim.oy) / S.maxPull, 0, 1) * 0.12; }
          else { sq = Math.sin(S.tt * 4) * 0.03; }
          drawBird(c, g, bx, by, birdR(), rot, ch, { sq });
        }
        const b = S.bird;
        if (b && b.body) {
          for (const p of b.trail) { c.fillStyle = 'rgba(255,255,255,.75)'; c.beginPath(); c.arc(p.x, p.y, 3.2, 0, TAU); c.fill(); }
          const bp = b.body.position;
          const sp = Math.hypot(b.body.velocity.x, b.body.velocity.y);
          let rot = b.touched ? b.body.angle : Math.atan2(b.body.velocity.y, b.body.velocity.x);
          const flip = !b.touched && b.body.velocity.x < 0;
          if (flip) rot = Math.PI - rot;
          drawBird(c, g, bp.x, bp.y, b.r, rot, ch, { sq: clamp(sp / 60, 0, 0.12), flip });
          drawTopArrow(c, g, bp.x, bp.y);
        }
        drawPreview(c, g);
        drawHint(c, g);
        drawBanner(c, g);
        drawWordBanner(c, g);
        drawMsg(c, g);
      },
      down(g, p) {
        if (!S.ready) { if (S.err) retryMatter(g); return; }
        if (inBanner(p, g) && S.wave) { S.aim.tapBan = true; return; }
        if (!canAim()) {
          const m = monAt(p);
          if (m && S.gn <= 3) sayMon(g, m);
          return;
        }
        const nearBird = Math.hypot(p.x - S.ax, p.y - S.ay) < S.u * 1.9;
        S.aim.on = true; S.aim.abs = nearBird; S.aim.moved = false; S.aim.tick = 0;
        S.aim.x0 = nearBird ? S.ax : p.x; S.aim.y0 = nearBird ? S.ay : p.y;
        S.aim.ox = 0; S.aim.oy = 0;
        S.aim.tapMon = monAt(p);
        S.kAim.show = false;
      },
      move(g, p) {
        if (!S.aim.on || !p.down) return;
        let ox = p.x - S.aim.x0, oy = p.y - S.aim.y0;
        const d = Math.hypot(ox, oy);
        if (d > S.maxPull) { ox *= S.maxPull / d; oy *= S.maxPull / d; }
        if (!S.aim.moved && d > 8) { S.aim.moved = true; S.aim.tMove = S.tt; g.sfx('swing'); }
        S.aim.ox = ox; S.aim.oy = oy;
        const tick = Math.floor(Math.min(d, S.maxPull) / S.maxPull * 4);
        if (tick > S.aim.tick) { g.sfx('tick'); }
        S.aim.tick = tick;
      },
      up(g, p) {
        if (S.aim.tapBan) {
          S.aim.tapBan = false;
          if (S.wave && inBanner(p, g)) { sayCenter(g, S.wave.n); S.banPing = 0.5; }
          return;
        }
        if (!S.aim.on) return;
        S.aim.on = false;
        if (!S.aim.moved) {
          const m = S.aim.tapMon;
          if (m && m.alive && S.gn <= 3) sayMon(g, m);
          return;
        }
        const ox = S.aim.ox, oy = S.aim.oy;
        S.aim.moved = false;
        if (Math.hypot(ox, oy) < S.u * 0.55) return;   // 拉得太短 = 取消
        fire(g, ox, oy);
      },
      key(g, k) {
        if (!canAim()) return;
        if (k === 'space' || k === 'enter') {
          if (!S.kAim.show) { showKeyAim(); return; }   // 第一次按：先亮出瞄准线
          const o = keyOff();
          fire(g, o.x, o.y, true);
        } else if (k === 'up' || k === 'down' || k === 'left' || k === 'right') showKeyAim();
      },
      resize(g) {
        if (!S.ready || !S.levelReady || !S.wave) { geom(g); return; }
        // 屏幕尺寸变了：按新尺寸重建这一波（已打掉的字不再出现；飞行中的鸟退回）
        const wv = S.wave;
        const flying = !!(S.bird && S.bird.body && !S.bird.resolved);
        const armored = new Set(S.mons.filter((m) => m.armored).map((m) => m.ch));
        const found = new Set(wv.found);
        geom(g);
        newWorld();
        const keepOk = wv.ok, keepBad = wv.bad;
        wv.ok = keepOk.filter((o) => !found.has(o.w));
        buildWave(g, wv, false);
        wv.ok = keepOk; wv.bad = keepBad;
        S.mons.forEach((m) => { if (armored.has(m.ch)) m.armored = true; });
        if (flying) S.birdsLeft++;
        S.bird = null;
        if (g.state === 'play' && ['fly', 'resolve', 'reload', 'ready'].indexOf(S.phase) >= 0) { S.phase = 'ready'; S.hop = null; }
      },
      end() {
        try { if (S.eng) { S.M.Composite.clear(S.eng.world, false); S.M.Engine.clear(S.eng); } } catch (e) { /* ignore */ }
        S.eng = null; S.world = null;
        if (W.__sling && W.__sling.S === S) W.__sling = null;
      }
    };

    function ensureMatter(g) {
      if (S.loading || S.ready) return;
      S.loading = true; S.err = false;
      loadMatter().then((M) => {
        S.loading = false;
        if (!ctx.alive()) return;
        S.M = M; S.ready = true;
        if (S.pendingLevel && G0) setupLevel(G0);
      }, () => { S.loading = false; S.err = true; });
    }
    function retryMatter(g) { if (S.err && !S.loading) { S.err = false; ensureMatter(g); } }

    /** 测试用：给第 i 个活着的字怪算一条干净弹道 → 拖动向量（相对拖动，ox/oy 为拉开方向） */
    function solve(i) {
      const alive = S.mons.filter((m) => m.alive);
      const m = alive[i];
      if (!m) return null;
      const rects = [];
      S.forts.forEach((f) => { if (f.island && f.island._in) rects.push(f.island.plugin && { x: f.island.position.x, y: f.island.position.y, w: f.island.plugin.w, h: f.island.plugin.h }); f.blocks.forEach((b) => rects.push({ x: b.position.x, y: b.position.y, w: b.bounds.max.x - b.bounds.min.x, h: b.bounds.max.y - b.bounds.min.y })); });
      const mons = alive.filter((x) => x !== m).map((x) => ({ x: x.x, y: x.y, r: x.r }));
      const list = [];
      cleanShots(m.x, m.y, m.r, { rects, mons }, list);
      if (!list.length) return null;
      const s = list[Math.floor(list.length / 2)];
      const th = s.deg * Math.PI / 180, k = s.v / S.vmax, d = k * S.maxPull;
      return { ox: -Math.cos(th) * d, oy: Math.sin(th) * d, ch: m.ch, ok: m.ok, n: list.length };
    }

    // 进游戏就开始下载 matter.js（选关界面期间下好）
    ensureMatter(null);
    return spec;
  }

  HW.register({
    id: 'sling', skill: 'read', kind: 'arcade', name: '组词弹弓', icon: '🐦',
    blurb: '拉弹弓，打中能组成词的字',
    needs: [], cols: ['chars'], data: ['chars'], reviewN: 4,
    start(ctx) {
      if (!HW.arcade || typeof HW.arcade.run !== 'function') {
        try { ctx.el.textContent = '游戏引擎没有加载，先玩别的吧。'; } catch (e) { /* ignore */ }
        return function () {};
      }
      return HW.arcade.run(ctx, makeSpec(ctx));
    }
  });
})();
