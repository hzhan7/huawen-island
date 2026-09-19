/* =====================================================================
 * 华文小岛 3.0 · 🍜 华文小吃店（parts/54_stall.js）  skill: read · 数据栏目: menu（新；缺失时用内置兜底菜单）
 * 设计依据：research/GAME_SHORTLIST.md ③；契约：SPEC_V3.md、SPEC_ARCADE.md §3；引擎：parts/15_arcade.js（HW.arcade.run）
 * 玩法来源：Papa's 系列 / DigitalCyberSoft/pizzashop 的“订单先生成结构化 spec → 渲染成句子 → 按 spec 判分”的思路。
 *   pizzashop 没有许可证：只借玩法，本文件没有复制它的任何代码或素材（美术 = Canvas + emoji，音效 = 引擎 WebAudio 合成）。
 *
 * 玩法：新加坡小贩中心的小吃摊。顾客排队走到柜台，气泡里写着（P2/P3 还会读出来）点单；
 *   孩子点下面的食材格子（只有图，没有字），食材飞上托盘；点托盘上的食物可以拿掉；按“上菜”。
 *   顾客按订单 spec 逐项比对：对了 → 开心跳起来、吃掉、金币飞进小费罐；
 *   错了 → 托盘被推回来、顾客生气喊出哪里不对（气泡里那一句标红）、扣一颗心，可以改好再上；
 *   等太久 → 顾客气呼呼走掉（g.miss，不记错题），走掉 3 位这一关就失败。
 * 华文就是规则（C 型）：数量 + 量词（两串、三片；一串葡萄 ≠ 一颗葡萄）、不要、颜色、最上面/中间/最下面、先……再……；
 *   P4 起：除了……每种都……、一半……另一半……、如果有……就……没有的话……、中途改单。
 * 错题本：只有递出去的菜和订单不符才 g.wrong(订单, 说明)；超时只 g.miss；空托盘上菜不算。
 * ===================================================================== */
(function () {
  'use strict';
  const W = window;
  const HW = W.HW;
  if (!HW || typeof HW.register !== 'function') return;

  const TAU = Math.PI * 2;
  const NAVY = '#1d2b53';
  const CREAM = '#FFFBEF';
  const CN = ['零', '一', '两', '三', '四', '五', '六', '七', '八', '九', '十'];
  const COL = { p: NAVY, n: NAVY, q: '#D9480F', neg: '#E03131', g: '#6741D9', c: '#0B7285' };
  const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
  const lerp = (a, b, t) => a + (b - a) * t;
  const rnd = (a, b) => a + Math.random() * (b - a);
  const ri = (a, b) => Math.floor(a + Math.random() * (b - a + 1));
  const pick = (a) => a[Math.floor(Math.random() * a.length)];
  function shuffle(arr) { const a = arr.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); const t = a[i]; a[i] = a[j]; a[j] = t; } return a; }
  const isHan = (ch) => /[㐀-鿿]/.test(ch);
  const nowS = () => (W.performance && performance.now ? performance.now() : Date.now()) / 1000;
  const outBack = (t) => { const s = 1.70158, u = t - 1; return u * u * ((s + 1) * u + s) + 1; };

  /* ================= 内置菜单（兜底 + 特殊玩法） =================
     k: dish 主食（盘/碗，一次一份） food 可数小吃 extra 配料 drink 饮料 form 同名不同量词 scoop 冰淇淋球 satay 沙爹（分肉类）
     sib：同一样东西的另一种样子（量词不同）；d：自绘图形；b：角标 emoji；sh：短名 */
  const BI = [
    { id: 'b:jifan', n: '鸡饭', m: '盘', k: 'dish', e: '🍗', base: ['🍚', '🍗'] },
    { id: 'b:mian', n: '面', m: '碗', k: 'dish', e: '🍜' },
    { id: 'b:gali', n: '咖喱饭', m: '盘', k: 'dish', e: '🍛' },
    { id: 'b:zhou', n: '粥', m: '碗', k: 'dish', e: '🥣' },
    { id: 'b:shadie', n: '沙爹', m: '串', k: 'food', e: '🍢' },
    { id: 'b:jiaozi', n: '饺子', m: '个', k: 'food', e: '🥟' },
    { id: 'b:yumi', n: '玉米', m: '根', k: 'food', e: '🌽' },
    { id: 'b:jidan', n: '鸡蛋', m: '个', k: 'food', e: '🥚' },
    { id: 'b:hebaodan', n: '荷包蛋', m: '个', k: 'extra', e: '🍳' },
    { id: 'b:huanggua', n: '黄瓜', m: '片', k: 'extra', e: '🥒' },
    { id: 'b:xia', n: '虾', m: '只', k: 'extra', e: '🦐' },
    { id: 'b:shengcai', n: '生菜', m: '片', k: 'extra', e: '🥬' },
    { id: 'b:lajiao', n: '辣椒酱', m: '勺', k: 'extra', e: '🌶️' },
    { id: 'b:naicha', n: '奶茶', m: '杯', k: 'drink', e: '🧋' },
    { id: 'b:kafei', n: '咖啡', m: '杯', k: 'drink', e: '☕' },
    { id: 'b:niunai', n: '牛奶', m: '杯', k: 'drink', e: '🥛' },
    { id: 'b:cha', n: '茶', m: '杯', k: 'drink', e: '🍵' },
    { id: 'b:yezi', n: '椰子', m: '个', k: 'drink', e: '🥥' },
    { id: 'b:putao1', n: '葡萄', m: '串', k: 'form', e: '🍇', sib: 'b:putao2' },
    { id: 'b:putao2', n: '葡萄', m: '颗', k: 'form', d: 'grape', sib: 'b:putao1' },
    { id: 'b:xiangjiao1', n: '香蕉', m: '根', k: 'form', e: '🍌', sib: 'b:xiangjiao2' },
    { id: 'b:xiangjiao2', n: '香蕉', m: '串', k: 'form', d: 'bananas', sib: 'b:xiangjiao1' },
    { id: 'b:xigua1', n: '西瓜', m: '块', k: 'form', e: '🍉', sib: 'b:xigua2' },
    { id: 'b:xigua2', n: '西瓜', m: '个', k: 'form', d: 'melon', sib: 'b:xigua1' },
    { id: 'b:dangao1', n: '蛋糕', m: '块', k: 'form', e: '🍰', sib: 'b:dangao2' },
    { id: 'b:dangao2', n: '蛋糕', m: '个', k: 'form', e: '🎂', sib: 'b:dangao1' },
    { id: 'b:red', n: '红色', m: '球', k: 'scoop', d: 'scoop', c: '#F2505A' },
    { id: 'b:white', n: '白色', m: '球', k: 'scoop', d: 'scoop', c: '#FFF8EC' },
    { id: 'b:green', n: '绿色', m: '球', k: 'scoop', d: 'scoop', c: '#63C656' },
    { id: 'b:yellow', n: '黄色', m: '球', k: 'scoop', d: 'scoop', c: '#FFD43B' },
    { id: 'b:brown', n: '咖啡色', m: '球', k: 'scoop', d: 'scoop', c: '#8D5A34' },
    { id: 'b:purple', n: '紫色', m: '球', k: 'scoop', d: 'scoop', c: '#A274DB' },
    { id: 'b:black', n: '黑色', m: '球', k: 'scoop', d: 'scoop', c: '#34343C' },
    { id: 'b:sd_ji', n: '鸡肉沙爹', m: '串', k: 'satay', e: '🍢', b: '🐔', sh: '鸡肉' },
    { id: 'b:sd_niu', n: '牛肉沙爹', m: '串', k: 'satay', e: '🍢', b: '🐮', sh: '牛肉' },
    { id: 'b:sd_yang', n: '羊肉沙爹', m: '串', k: 'satay', e: '🍢', b: '🐑', sh: '羊肉' }
  ];
  const BI_EXTRA = ['b:hebaodan', 'b:huanggua', 'b:xia', 'b:shengcai', 'b:lajiao'];
  const SCOOP_LO = ['b:red', 'b:white', 'b:green', 'b:yellow', 'b:brown'];
  const SCOOP_HI = ['b:red', 'b:white', 'b:green', 'b:yellow', 'b:black', 'b:brown', 'b:purple'];
  const FORM_PAIRS = [['b:putao1', 'b:putao2'], ['b:xiangjiao1', 'b:xiangjiao2'], ['b:xigua1', 'b:xigua2'], ['b:dangao1', 'b:dangao2']];
  const SATAY = ['b:sd_ji', 'b:sd_niu', 'b:sd_yang'];
  const CUPS = ['b:naicha', 'b:kafei', 'b:niunai', 'b:cha'];

  /* 运行时定义表：id → def（内置 + 题库 menu + 错题重练带回来的 defs） */
  const DEFS = Object.create(null);
  BI.forEach((d) => { DEFS[d.id] = d; });
  const DEF = (id) => DEFS[id] || { id, n: '？', m: '个', k: 'food', e: '❓' };
  const HANS = /^[㐀-鿿]{1,6}$/;
  const MW1 = /^[㐀-鿿]$/;
  const kindByMw = (m) => ('杯瓶罐'.indexOf(m) >= 0 ? 'drink' : '盘碗份客'.indexOf(m) >= 0 ? 'dish' : 'food');
  // 题库有 kind（meal/drink/dessert/snack）就按它分：只有 kind=drink 才算“饮料”（冰淇淋按杯卖，但不是饮料）；
  // 其余按量词：盘/碗/份/碟 = 主食（可以加料），别的 = 单点的小吃
  const kindOf = (m) => (m.kind === 'drink' ? 'drink' : m.kind ? ('盘碗份客碟'.indexOf(m.mw) >= 0 ? 'dish' : 'food') : kindByMw(m.mw));
  // 几何色块（🔴⚪🟩⬛💧…）当食物图认不出来：题库里拿色块代替的几样加料，按名字换成自己画的图；其余一律不用
  const SHAPE = /[■-◿⬛⬜⭕⚪⚫\u{1F534}-\u{1F53D}\u{1F7E0}-\u{1F7EB}\u{1F4A7}]/u;
  const goodEmoji = (e) => typeof e === 'string' && e.length >= 1 && e.length <= 8 && !/[㐀-鿿A-Za-z0-9]/.test(e) && !SHAPE.test(e);
  const DRAWN = { 红豆: 'beans', 果冻: 'jelly', 豆腐: 'tofu', 仙草: 'grass' };
  const JUICE_C = { '🍎': '#F2C14E', '🍉': '#FF5C73', '🥭': '#FFB224', '🍊': '#FF922B', '🍍': '#FFD43B', '🍇': '#9C36B5' };
  const artOf = (x) => (goodEmoji(x.emoji) ? { e: x.emoji } : DRAWN[x.name] && typeof x.emoji === 'string' && SHAPE.test(x.emoji) ? { d: DRAWN[x.name], e: x.emoji } : null);

  /* 读题库 menu（SPEC_V3 §3：((HW_DATA||{})[grade]||{}).menu）。格式不对的项一律跳过，不猜。
     exOf：每道主食自己的加料（点单只点这些）；allEx：本年级出现过的全部加料（当干扰格子，不拿超纲的内置食材） */
  function readMenu(grade) {
    const out = { dish: [], food: [], drink: [], exOf: Object.create(null), allEx: [], colors: null, data: false };
    let menu = null, words = null;
    try { const G = (W.HW_DATA || {})[grade] || {}; menu = G.menu; words = G.menuwords; } catch (e) { menu = null; }
    const seen = new Set();
    const exDef = (x, owner) => {
      if (!x || !HANS.test(x.name || '') || !MW1.test(x.mw || '') || x.name === owner) return null;
      const art = artOf(x);
      if (!art) return null;
      const xid = 'm:x:' + x.name + '|' + x.mw;
      if (!DEFS[xid]) DEFS[xid] = Object.assign({ id: xid, n: x.name, m: x.mw, k: 'extra' }, art, x.name === '炼奶' && x.mw === '勺' ? { d: 'spoon', c: '#FFF1CC' } : null);   // 🥛 像一杯饮料：画成一勺炼奶
      if (out.allEx.indexOf(xid) < 0) out.allEx.push(xid);
      return xid;
    };
    if (Array.isArray(menu)) {
      for (const m of menu) {
        if (!m || typeof m !== 'object' || !HANS.test(m.name || '') || !MW1.test(m.mw || '') || !goodEmoji(m.emoji)) continue;
        const key = m.name + '|' + m.mw;
        if (seen.has(key)) continue;
        seen.add(key);
        const id = 'm:' + key;
        const k = kindOf(m);
        // 盘装主食画“盘子上摆几样”：只有每样配料都有像样的 emoji 才这样画，缺了（色块被滤掉）就只画菜本身，免得菜头粿只剩一个鸡蛋
        const raw = Array.isArray(m.base) ? m.base.map((b) => b && b.emoji) : [];
        const good = raw.filter(goodEmoji);
        const base = good.length >= 2 && good.length === raw.length ? good.slice(0, 3) : [];
        DEFS[id] = { id, n: m.name, m: m.mw, k, e: m.emoji, base: base.length ? base : null };
        // 果汁的 emoji 是水果本身（🍎🍉），画成“一杯果汁 + 水果角标”，免得和“苹果”“西瓜”混
        if (k === 'drink' && /汁$/.test(m.name) && JUICE_C[m.emoji]) { DEFS[id].d = 'juice'; DEFS[id].c = JUICE_C[m.emoji]; }
        // 甘蔗水的 🧃 在苹果设备上是“印着苹果的果汁盒”，和苹果汁（P5 起）同一天出现会分不清：画成一杯淡绿的水 + 一截甘蔗
        if (k === 'drink' && /^甘蔗/.test(m.name)) { DEFS[id].d = 'cane'; DEFS[id].c = '#CFE38A'; }
        // 🥟 是饺子不是包子：豆沙包 / 肉包画成白白的包子（豆沙包点个红点）；两样画面同一个键，不会同一天出现
        if (k !== 'dish' && /包$/.test(m.name) && m.emoji === '🥟') { DEFS[id].d = 'bun'; if (/豆沙/.test(m.name)) DEFS[id].dot = 1; }
        // 题库给奶茶的 🥤 是红色汽水杯，孩子听到“奶茶”认不出它：画成一杯奶茶色的饮料（和 🧋 珍珠奶茶一眼分得开）
        if (k === 'drink' && m.name === '奶茶' && m.emoji === '🥤') { DEFS[id].d = 'milktea'; DEFS[id].c = '#D4A373'; }
        out[k].push(id);
        out.data = true;
        const ex = [];
        (Array.isArray(m.extra) ? m.extra : []).forEach((x) => { const xid = exDef(x, m.name); if (xid && ex.indexOf(xid) < 0) ex.push(xid); });
        if (k === 'dish') out.exOf[id] = ex;
      }
    }
    // menuwords 里出现的颜色词：只用于收窄冰淇淋颜色（和内置颜色取交集，够 4 种才用）
    try {
      if (words) {
        const s = JSON.stringify(words);
        const cs = BI.filter((d) => d.k === 'scoop' && s.indexOf(d.n) >= 0).map((d) => d.id);
        if (cs.length >= 4) out.colors = cs;
      }
    } catch (e) { /* ignore */ }
    return out;
  }

  /* ================= 关卡表 =================
     th：今天卖什么；tpl：订单模板；nMax：数量上限；pat：[基础耐心秒, 每字加秒] */
  const LV_LO = [null,   // P2 / P3：短单、自动朗读、少格子
    { th: 'count', nb: 4, rounds: 4, tpl: ['single'], nMax: 3 },
    { th: 'hawker', dishes: 2, ex: 3, dr: 0, rounds: 5, tpl: ['h1'], nMax: 3 },
    { th: 'hawker', dishes: 2, ex: 3, dr: 1, rounds: 5, tpl: ['h1', 'h1d'], nMax: 3 },
    { th: 'hawker', dishes: 2, ex: 3, dr: 1, rounds: 5, tpl: ['hn', 'hn', 'h1d'], nMax: 3 },
    { th: 'ice', cols: 4, rounds: 6, tpl: ['iceSame', 'ice2pos', 'ice2seq'] },
    { th: 'form', pairs: 3, rounds: 6, tpl: ['form1', 'form1', 'form2'], nMax: 3 },
    { th: 'hawker', dishes: 2, ex: 3, dr: 2, rounds: 6, tpl: ['hn', 'h2', 'hnd'], nMax: 3 },
    { th: 'ice', cols: 5, rounds: 6, tpl: ['ice2pos', 'ice3pos', 'ice3seq'] },
    { th: 'form', pairs: 4, rounds: 6, tpl: ['form2', 'form2', 'form1'], nMax: 4 },
    { th: 'hawker', dishes: 2, ex: 4, dr: 2, rounds: 7, tpl: ['hn2', 'h2d', 'hnd'], nMax: 3 }
  ];
  const LV_HI = [null,   // P4+：长单、自己读、8 格
    { th: 'hawker', dishes: 2, ex: 4, dr: 2, rounds: 6, tpl: ['h2d', 'h2'], nMax: 5 },
    { th: 'hawker', dishes: 2, ex: 4, dr: 2, rounds: 6, tpl: ['hn2', 'hnd'], nMax: 5 },
    { th: 'hawker', dishes: 1, ex: 3, dr: 4, cups: true, rounds: 6, tpl: ['except'], nMax: 4 },
    { th: 'satay', rounds: 6, tpl: ['halfSatay', 'halfSatay', 'halfDrink'], nMax: 4 },
    { th: 'ice', cols: 5, rounds: 6, tpl: ['ice3shuffle', 'ice3seq', 'iceExcept', 'iceTwoSame', 'ice3mid'] },
    { th: 'hawker', dishes: 2, ex: 4, dr: 2, rounds: 6, tpl: ['cond'], nMax: 4 },
    { th: 'hawker', dishes: 2, ex: 4, dr: 2, rounds: 7, tpl: ['change'], nMax: 4 },
    { th: 'form', pairs: 4, rounds: 7, tpl: ['form2', 'form3'], nMax: 5 },
    { th: 'hawker', dishes: 2, ex: 3, dr: 3, cups: true, rounds: 8, tpl: ['hn2', 'cond', 'change', 'except', 'halfDrink'], nMax: 4 },
    { th: 'hawker', dishes: 2, ex: 3, dr: 3, cups: true, rounds: 8, tpl: ['cond', 'change', 'except', 'halfDrink', 'hn2'], nMax: 5 }
  ];
  const PAT_LO = [0, 46, 46, 45, 44, 44, 42, 41, 40, 38, 36];
  const PAT_HI = [0, 34, 33, 32, 32, 30, 30, 29, 27, 25, 22];   // P4 高关要有时间压力（再加每字 0.8–0.9 秒）
  const THEME_NAME = { count: '今天开张啦！', hawker: '今天卖饭和面！', ice: '今天卖冰淇淋！', form: '今天卖水果和蛋糕！', satay: '今天卖沙爹！' };
  const THEME_ICON = { count: '🥟', hawker: '🍜', ice: '🍦', form: '🍉', satay: '🍢' };

  /* ================= 今天的格子（bins） =================
     同一天的格子必须“一眼分得清”：按画面（emoji / 自绘图形 / 主食的盘碗+配菜）去重。 */
  function vkey(id) {
    const D = DEF(id);
    if (D.k === 'dish') return 'D:' + (D.m === '碗' ? D.e : (D.base || [D.e]).join(''));
    if (D.d) return 'd:' + D.d + (D.c || '');
    return 'e:' + D.e + (D.b || '');
  }
  // 每个订单模板需要一道菜自己有几样加料（加 + 不要）
  const NEED_EX = { h1: 1, h1d: 1, h2: 2, h2d: 2, hn: 2, hnd: 2, hn2: 3, cond: 2, change: 2, except: 1 };
  function makeBins(cfg, pool, hi) {
    const used = new Set();
    const pickN = (cands, n, out) => {
      out = out || [];
      for (const id of shuffle(cands)) {
        if (out.length >= n) break;
        if (out.indexOf(id) >= 0) continue;
        const v = vkey(id);
        if (used.has(v)) continue;
        used.add(v); out.push(id);
      }
      return out;
    };
    if (cfg.th === 'ice') {
      let cs = hi ? SCOOP_HI : SCOOP_LO;
      if (pool.colors) cs = pool.colors;            // 只用本年级词表里有的颜色
      const easy = cs.filter((c) => c === 'b:red' || c === 'b:white' || c === 'b:green' || c === 'b:yellow');
      const src = cfg.cols <= 4 && easy.length >= 4 ? easy : cs;
      return shuffle(src).slice(0, Math.min(cfg.cols, src.length));
    }
    if (cfg.th === 'form') {
      const out = [];
      shuffle(FORM_PAIRS).slice(0, cfg.pairs).forEach((p) => { if (Math.random() < 0.5) out.push(p[0], p[1]); else out.push(p[1], p[0]); });
      return out;
    }
    // 杯装饮料（“饮料除了……”“一半是……”要用）：题库里 kind=drink 且按杯卖的优先，不够 3 样才用内置
    const dataCups = pool.drink.filter((id) => DEF(id).m === '杯');
    const cupSrc = (n) => (dataCups.length >= Math.max(3, n) ? dataCups : CUPS);
    if (cfg.th === 'satay') return SATAY.concat(['b:huanggua'], pickN(cupSrc(3), 3));
    if (cfg.th === 'count') {
      const out = [];
      pickN(pool.food, 2, out);
      pickN(pool.dish.length ? pool.dish : ['b:mian', 'b:jifan'], out.length + 1, out);
      pickN(pool.drink.length ? pool.drink : ['b:niunai', 'b:naicha'], out.length + 1, out);
      if (pool.data) pickN(pool.food.concat(pool.dish, pool.drink), cfg.nb, out);
      pickN(['b:shadie', 'b:jiaozi', 'b:yumi', 'b:jidan'], cfg.nb, out);
      return shuffle(out).slice(0, cfg.nb);
    }
    // hawker：主食 + 它们自己的加料 + 干扰加料 + 饮料。题库有菜就只用题库（内置的菜名可能超纲）
    const need = Math.max(1, ...cfg.tpl.map((t) => NEED_EX[t] || 0));
    const dataDish = pool.dish.filter((d) => (pool.exOf[d] || []).length >= Math.min(2, need));
    const useData = dataDish.length > 0;
    // 要“加一样、不要两样”（hn2）就得有一道菜自己带 3 样加料：先挑一道这样的菜，否则 hn2 永远出不来
    const rich = useData && need >= 3 ? dataDish.filter((d) => (pool.exOf[d] || []).length >= need) : [];
    const dishes = pickN(useData ? dataDish : ['b:jifan', 'b:mian', 'b:gali', 'b:zhou'], cfg.dishes, rich.length ? pickN(rich, 1) : []);
    const exs = [];
    if (useData) {
      // 每道菜先放够自己的加料（要“加一样、不要一样”就得有两样），再用本年级别的菜的加料当干扰
      const own = need >= 2 ? 2 : cfg.ex >= cfg.dishes * 2 ? 2 : 1;
      const per = dishes.map((d) => shuffle(pool.exOf[d] || []));
      for (let r = 0; r < own; r++) for (const lst of per) if (lst[r]) pickN([lst[r]], exs.length + 1, exs);
      if (need >= 3) { const lst = per.find((l) => l.length >= 3); if (lst) pickN([lst[2]], exs.length + 1, exs); }
      pickN(pool.allEx, cfg.ex, exs);
    }
    if (!useData || !exs.length) pickN(BI_EXTRA, cfg.ex, exs);
    let drinks = [];
    if (cfg.dr > 0) {
      if (cfg.cups) drinks = pickN(cupSrc(cfg.dr), cfg.dr);
      else drinks = pickN(pool.drink.length ? pool.drink : CUPS.concat(['b:yezi']), cfg.dr);
    }
    return dishes.concat(exs, drinks);
  }

  /* ================= 订单 =================
     订单对象（也就是交给 g.right / g.wrong、存进错题本的 item）：
       { g:'stall', t: 全句, segs: [[文字, 类别, [相关 id]]…], want: {id: 数量}, seq: [从下到上的冰淇淋球] | null,
         no: [说了“不要”的 id], stock: [卖完了的格子], chg: {segs, want, seq, no} | null, bins: [...], defs: {...}, hz: '掌握的字' }
     类别：p 普通 q 数量+量词 n 名称 neg 不要 g 语法词（除了/一半/如果/先/最上面…）
     生成后不再修改（错题本按 JSON 认题）。 */
  function Ord() { return { segs: [], want: Object.create(null), seq: null, no: [], stock: [], chg: null }; }
  const P = (o, s) => { o.segs.push([s, 'p', []]); };
  const Q = (o, n, m, ids) => { o.segs.push([CN[n] + m, 'q', ids]); };
  const Nm = (o, s, ids) => { o.segs.push([s, 'n', ids]); };
  const Gw = (o, s, ids, k) => { o.segs.push([s, k || 'g', ids || []]); };
  const add = (w, id, n) => { w[id] = (w[id] || 0) + n; };
  const segText = (segs) => segs.map((s) => s[0]).join('');
  function hiWord(o, vip) { const r = Math.random(); P(o, vip || r < 0.45 ? '老板，' : r < 0.62 ? '你好，' : ''); }

  function makeGen(cfg, bins, hi) {
    const nMax = cfg.nMax || 3;
    const of = (k) => bins.filter((id) => DEF(id).k === k);
    const dishes = of('dish'), extras = of('extra'), drinks = of('drink');
    const cups = drinks.filter((id) => DEF(id).m === '杯');
    // 题库里的主食只配它自己的配料（鱼圆面不会点玉米）；内置主食配通用配料
    const exFor = (d, pool) => {
      const own = (pool && pool.exOf[d]) || null;
      return own ? extras.filter((e) => own.indexOf(e) >= 0) : extras;
    };
    const cnt = (lo) => ri(lo || 1, nMax);
    // 一份、一棵、一碟、一勺是“一整份”：一碗面里加五棵青菜、五份花生不像话，最多三；按个/片/块/只/条数的才到 nMax
    const cntOf = (id) => ('份棵碟勺'.indexOf(DEF(id).m) >= 0 ? ri(1, Math.min(3, nMax)) : cnt());
    // 最近两位顾客点的主食 / 单品（含单点的饮料）：下一位尽量换一样（P2 第 1 关 4 格 4 单，不能三单都是椰子）
    const recentMain = [];
    const pickMain = (arr) => {
      let c = arr.filter((x) => recentMain.indexOf(x) < 0);
      if (!c.length) c = arr.filter((x) => x !== recentMain[recentMain.length - 1]);
      return pick(c.length ? c : arr);
    };

    // 只在“自己的加料够用”的菜里挑（否则上一位点了 A、这回只剩 B 而 B 的加料不够，会一路退回最简单的单点）
    const dishesWith = (n, pool) => dishes.filter((d) => exFor(d, pool).length >= n);
    function hawker(o, opt, pool, vip) {
      const okD = dishesWith(opt.ex + opt.neg, pool);
      if (!okD.length) return false;
      const d = pickMain(okD), exs = shuffle(exFor(d, pool));
      const D = DEF(d);
      hiWord(o, vip); P(o, '我要'); Q(o, 1, D.m, [d]); Nm(o, D.n, [d]); add(o.want, d, 1);
      const adds = exs.slice(0, opt.ex), negs = exs.slice(opt.ex, opt.ex + opt.neg);
      const addPart = () => {
        if (!adds.length) return;
        P(o, '，加');
        adds.forEach((e, i) => { if (i) P(o, '和'); const n = cntOf(e); const E = DEF(e); Q(o, n, E.m, [e]); Nm(o, E.n, [e]); add(o.want, e, n); });
      };
      const negPart = () => negs.forEach((e, i) => { P(o, i ? '，也' : '，'); Gw(o, '不要', [e], 'neg'); Nm(o, DEF(e).n, [e]); o.no.push(e); });
      if (negs.length && adds.length && Math.random() < 0.35) { negPart(); addPart(); } else { addPart(); negPart(); }
      if (opt.drink && drinks.length) {
        const dr = pick(drinks), R = DEF(dr), n = hi ? ri(1, 3) : 1;
        P(o, '，还要'); Q(o, n, R.m, [dr]); Nm(o, R.n, [dr]); add(o.want, dr, n);
      }
      P(o, '。');
      return true;
    }
    function scoopClause(o, word, c, i) { Gw(o, word, ['@' + i]); P(o, '是'); Nm(o, DEF(c).n, ['@' + i]); P(o, '的'); }
    function iceHead(o, vip) { hiWord(o, vip); P(o, '我要一个冰淇淋'); }

    const T = {
      single(o, pool, vip) {
        const cand = bins.filter((id) => { const k = DEF(id).k; return k === 'dish' || k === 'food' || k === 'drink' || k === 'form'; });
        if (!cand.length) return false;
        const id = pickMain(cand), D = DEF(id);
        const n = D.k === 'dish' ? 1 : D.k === 'drink' ? ri(1, 2) : cnt();
        hiWord(o, vip); P(o, '我要'); Q(o, n, D.m, [id]); Nm(o, D.n, [id]); P(o, '。'); add(o.want, id, n);
        return true;
      },
      h1: (o, p, v) => hawker(o, { ex: 1, neg: 0 }, p, v),
      h1d: (o, p, v) => hawker(o, { ex: 1, neg: 0, drink: 1 }, p, v),
      h2: (o, p, v) => hawker(o, { ex: 2, neg: 0 }, p, v),
      h2d: (o, p, v) => hawker(o, { ex: 2, neg: 0, drink: 1 }, p, v),
      hn: (o, p, v) => hawker(o, { ex: 1, neg: 1 }, p, v),
      hnd: (o, p, v) => hawker(o, { ex: 1, neg: 1, drink: 1 }, p, v),
      hn2: (o, p, v) => hawker(o, hi ? { ex: 1, neg: 2 } : { ex: 2, neg: 1 }, p, v),
      except(o, pool, vip) {
        if (cups.length < 3) return false;
        const x = pick(cups);
        const okD = dishesWith(1, pool), d0 = okD.length ? pick(okD) : null, ex0 = d0 ? exFor(d0, pool) : [];
        if (d0 && ex0.length && Math.random() < 0.7) {
          const d = d0, D = DEF(d), e = pick(ex0), E = DEF(e), n = cntOf(e);
          hiWord(o, vip); P(o, '我要'); Q(o, 1, D.m, [d]); Nm(o, D.n, [d]); P(o, '，加'); Q(o, n, E.m, [e]); Nm(o, E.n, [e]); P(o, '。');
          add(o.want, d, 1); add(o.want, e, n);
        } else hiWord(o, vip);
        P(o, '饮料'); Gw(o, '除了', cups); Nm(o, DEF(x).n, [x]); P(o, '，'); Gw(o, '每种都要', cups); Q(o, 1, '杯', cups); P(o, '。');
        cups.forEach((c) => { if (c !== x) add(o.want, c, 1); });
        return true;
      },
      halfSatay(o, pool, vip) {
        const ts = shuffle(bins.filter((id) => DEF(id).k === 'satay'));
        if (ts.length < 2) return false;
        const a = ts[0], b = ts[1], N = pick(hi ? [4, 6, 8, 10] : [2, 4, 6]);
        hiWord(o, vip); P(o, '我要'); Q(o, N, '串', [a, b]); Nm(o, '沙爹', [a, b]); P(o, '，');
        Gw(o, '一半', [a]); P(o, '是'); Nm(o, DEF(a).sh, [a]); P(o, '的，'); Gw(o, '另一半', [b]); P(o, '是'); Nm(o, DEF(b).sh, [b]); P(o, '的');
        add(o.want, a, N / 2); add(o.want, b, N / 2);
        const cu = bins.indexOf('b:huanggua') >= 0 && Math.random() < 0.45;
        if (cu) { const n = cnt(); P(o, '，再加'); Q(o, n, '片', ['b:huanggua']); Nm(o, '黄瓜', ['b:huanggua']); add(o.want, 'b:huanggua', n); }
        else if (cups.length && Math.random() < 0.5) { const c = pick(cups), n = ri(1, 2); P(o, '，还要'); Q(o, n, '杯', [c]); Nm(o, DEF(c).n, [c]); add(o.want, c, n); }
        P(o, '。');
        return true;
      },
      halfDrink(o, pool, vip) {
        if (cups.length < 2) return false;
        const cs = shuffle(cups), a = cs[0], b = cs[1], N = pick([4, 6]);   // 两杯说“一半……另一半……”不自然：至少四杯
        if (dishes.length && Math.random() < 0.5) {
          const d = pick(dishes), D = DEF(d);
          hiWord(o, vip); P(o, '我要'); Q(o, 1, D.m, [d]); Nm(o, D.n, [d]); P(o, '，还要'); add(o.want, d, 1);
        } else { hiWord(o, vip); P(o, '我们要'); }
        Q(o, N, '杯', [a, b]); Nm(o, '饮料', [a, b]); P(o, '：');
        Gw(o, '一半', [a]); P(o, '是'); Nm(o, DEF(a).n, [a]); P(o, '，'); Gw(o, '另一半', [b]); P(o, '是'); Nm(o, DEF(b).n, [b]); P(o, '。');
        add(o.want, a, N / 2); add(o.want, b, N / 2);
        return true;
      },
      cond(o, pool, vip) {
        const okD = dishesWith(2, pool);
        if (!okD.length) return false;
        const d = pickMain(okD), D = DEF(d), exs = shuffle(exFor(d, pool));
        const x = exs[0], y = exs[1], X = DEF(x), Y = DEF(y), n = cntOf(x), m = cntOf(y);
        hiWord(o, vip); P(o, '我要'); Q(o, 1, D.m, [d]); Nm(o, D.n, [d]); P(o, '。'); add(o.want, d, 1);
        Gw(o, '如果有', [x, y]); Nm(o, X.n, [x, y]); P(o, '，就加'); Q(o, n, X.m, [x]); P(o, '；');
        Gw(o, '没有的话', [x, y]); P(o, '，就加'); Q(o, m, Y.m, [y]); Nm(o, Y.n, [y]); P(o, '。');
        if (Math.random() < 0.5) { o.stock.push(x); add(o.want, y, m); } else add(o.want, x, n);
        // 另一个无关的格子也可能卖完（免得“卖完了”本身成了提示）
        const decoy = bins.filter((id) => id !== x && id !== y && id !== d && DEF(id).k !== 'dish');
        if (decoy.length && Math.random() < 0.6) o.stock.push(pick(decoy));
        return true;
      },
      change(o, pool, vip) {
        if (!hawker(o, { ex: 2, neg: 0, drink: Math.random() < 0.5 ? 1 : 0 }, pool, vip)) return false;
        const w2 = Object.assign(Object.create(null), o.want);
        const inOrder = Object.keys(o.want);
        const d = inOrder.find((id) => DEF(id).k === 'dish');
        const added = inOrder.filter((id) => DEF(id).k === 'extra');
        const dr = inOrder.find((id) => DEF(id).k === 'drink');
        const free = exFor(d, pool).filter((e) => !o.want[e]);
        const opts = ['rm', 'recount'];
        if (free.length) opts.push('add');
        if (dr && drinks.filter((x) => x !== dr && DEF(x).m === DEF(dr).m).length) opts.push('swap');
        const c = { segs: [], want: w2, seq: null, no: [] };
        const cs = (s, k, ids) => { c.segs.push([s, k, ids || []]); };
        const kind = pick(opts);
        if (kind === 'rm') {
          const e = pick(added);
          cs('哎呀，我改一下：', 'c'); cs(DEF(e).n, 'n', [e]); cs('不要了', 'neg', [e]); cs('。', 'c');
          delete w2[e]; c.no.push(e);
        } else if (kind === 'recount') {
          const e = pick(added), E = DEF(e); let n = cntOf(e);
          if (n === o.want[e]) n = n >= 2 ? n - 1 : n + 1;
          cs('哎呀，', 'c'); cs(E.n, 'n', [e]); cs('改成', 'c', [e]); cs(CN[n] + E.m, 'q', [e]); cs('吧。', 'c');
          w2[e] = n;
        } else if (kind === 'add') {
          const e = pick(free), E = DEF(e), n = cntOf(e);
          cs('哎呀，', 'c'); cs('再加', 'c', [e]); cs(CN[n] + E.m, 'q', [e]); cs(E.n, 'n', [e]); cs('吧。', 'c');
          w2[e] = n;
        } else {
          const d2 = pick(drinks.filter((x) => x !== dr && DEF(x).m === DEF(dr).m));
          cs('哎呀，', 'c'); cs(DEF(dr).n, 'n', [dr, d2]); cs('换成', 'c', [dr, d2]); cs(DEF(d2).n, 'n', [dr, d2]); cs('吧。', 'c');
          w2[d2] = o.want[dr]; delete w2[dr]; c.no.push(dr);
        }
        o.chg = c;
        return true;
      },
      iceSame(o, pool, vip) {
        const c = pick(bins), n = ri(2, 3);
        iceHead(o, vip); P(o, '，要'); Q(o, n, '球', [c]); Nm(o, DEF(c).n, [c]); P(o, '的。'); add(o.want, c, n);
        return true;
      },
      ice2pos(o, pool, vip) {
        const cs = shuffle(bins).slice(0, 2);
        iceHead(o, vip); P(o, '：'); scoopClause(o, '下面', cs[0], 0); P(o, '，'); scoopClause(o, '上面', cs[1], 1); P(o, '。');
        o.seq = cs; cs.forEach((c) => add(o.want, c, 1));
        return true;
      },
      ice2seq(o, pool, vip) {
        const cs = shuffle(bins).slice(0, 2);
        iceHead(o, vip); P(o, '：'); Gw(o, '先放', ['@0']); Nm(o, DEF(cs[0]).n, ['@0']); P(o, '的，'); Gw(o, '再放', ['@1']); Nm(o, DEF(cs[1]).n, ['@1']); P(o, '的。');
        o.seq = cs; cs.forEach((c) => add(o.want, c, 1));
        return true;
      },
      ice3pos(o, pool, vip) {
        if (bins.length < 3) return false;
        const cs = shuffle(bins).slice(0, 3);
        iceHead(o, vip); P(o, '：'); scoopClause(o, '最下面', cs[0], 0); P(o, '，'); scoopClause(o, '中间', cs[1], 1); P(o, '，'); scoopClause(o, '最上面', cs[2], 2); P(o, '。');
        o.seq = cs; cs.forEach((c) => add(o.want, c, 1));
        return true;
      },
      ice3seq(o, pool, vip) {
        if (bins.length < 3) return false;
        const cs = shuffle(bins).slice(0, 3);
        iceHead(o, vip); P(o, '：');
        Gw(o, '先放', ['@0']); Nm(o, DEF(cs[0]).n, ['@0']); P(o, '的，'); Gw(o, '再放', ['@1']); Nm(o, DEF(cs[1]).n, ['@1']); P(o, '的，');
        Gw(o, '最后放', ['@2']); Nm(o, DEF(cs[2]).n, ['@2']); P(o, '的。');
        o.seq = cs; cs.forEach((c) => add(o.want, c, 1));
        return true;
      },
      ice3shuffle(o, pool, vip) {
        if (bins.length < 3) return false;
        const cs = shuffle(bins).slice(0, 3), words = ['最下面', '中间', '最上面'];
        iceHead(o, vip); P(o, '，'); Q(o, 3, '球', ['@0', '@1', '@2']); P(o, '：');
        shuffle([0, 1, 2]).forEach((i, j) => { if (j) P(o, '，'); scoopClause(o, words[i], cs[i], i); });
        P(o, '。');
        o.seq = cs; cs.forEach((c) => add(o.want, c, 1));
        return true;
      },
      iceTwoSame(o, pool, vip) {
        const cs = shuffle(bins).slice(0, 2);
        iceHead(o, vip); P(o, '，'); Q(o, 3, '球', ['@0', '@1', '@2']); P(o, '：'); scoopClause(o, '最上面', cs[0], 2); P(o, '，');
        Gw(o, '下面两球', ['@0', '@1']); P(o, '都是'); Nm(o, DEF(cs[1]).n, ['@0', '@1']); P(o, '的。');
        o.seq = [cs[1], cs[1], cs[0]]; add(o.want, cs[1], 2); add(o.want, cs[0], 1);
        return true;
      },
      ice3mid(o, pool, vip) {
        const cs = shuffle(bins).slice(0, 2);
        iceHead(o, vip); P(o, '，'); Q(o, 3, '球', ['@0', '@1', '@2']); P(o, '：'); scoopClause(o, '中间', cs[0], 1); P(o, '，');
        Gw(o, '最上面和最下面', ['@0', '@2']); P(o, '都是'); Nm(o, DEF(cs[1]).n, ['@0', '@2']); P(o, '的。');
        o.seq = [cs[1], cs[0], cs[1]]; add(o.want, cs[1], 2); add(o.want, cs[0], 1);
        return true;
      },
      iceExcept(o, pool, vip) {
        if (bins.length < 4) return false;
        const x = pick(bins);
        iceHead(o, vip); P(o, '：'); Gw(o, '除了', bins); Nm(o, DEF(x).n, [x]); P(o, '的，'); Gw(o, '每种颜色都要', bins); Q(o, 1, '球', bins); P(o, '。');
        bins.forEach((c) => { if (c !== x) add(o.want, c, 1); });
        return true;
      },
      form1(o, pool, vip) {
        const id = pick(bins), D = DEF(id), n = D.m === '个' ? ri(1, 2) : cnt();
        hiWord(o, vip); P(o, '我要'); Q(o, n, D.m, [id]); Nm(o, D.n, [id]); P(o, '。'); add(o.want, id, n);
        return true;
      },
      form2: (o, p, v) => T.formN(o, 2, v),
      form3: (o, p, v) => T.formN(o, 3, v),
      formN(o, k, vip) {
        const names = [], ids = [];
        for (const id of shuffle(bins)) { const D = DEF(id); if (names.indexOf(D.n) < 0) { names.push(D.n); ids.push(id); } if (ids.length >= k) break; }
        if (ids.length < k) return false;
        hiWord(o, vip); P(o, '我要');
        ids.forEach((id, i) => {
          if (i) P(o, i === ids.length - 1 ? '和' : '、');
          const D = DEF(id), n = D.m === '个' ? ri(1, 2) : cnt();
          Q(o, n, D.m, [id]); Nm(o, D.n, [id]); add(o.want, id, n);
        });
        P(o, '。');
        return true;
      }
    };
    const recent = [];
    return function gen(pool, vip) {
      const order = shuffle(cfg.tpl);
      let keep = null;
      for (let tries = 0; tries < 16; tries++) {
        const name = order[tries % order.length];
        const o = Ord();
        if (!(T[name] && T[name](o, pool, vip))) continue;
        o.tpl = name;
        const txt = segText(o.segs).replace(/^(老板|你好)，/, '');   // 只差一句招呼也算重复
        keep = keep || o;
        if (recent.indexOf(txt) >= 0 && tries < 15) continue;   // 同一天不出一模一样的单
        recent.push(txt); if (recent.length > 8) recent.shift();
        const main = Object.keys(o.want).find((id) => { const k = DEF(id).k; return k === 'dish' || k === 'food' || k === 'form' || (name === 'single' && k === 'drink'); });
        if (main) { recentMain.push(main); if (recentMain.length > 2) recentMain.shift(); }
        return o;
      }
      if (keep) return keep;
      const o = Ord(); T.single(o, pool, vip); o.tpl = 'single';
      return o;
    };
  }

  /* 把生成器的结果封成不可变的订单 item（带 defs 供错题重练复现） */
  function sealOrder(o, bins) {
    const defs = {};
    const keep = (id) => { const D = DEF(id); const d = { n: D.n, m: D.m, k: D.k }; ['e', 'd', 'c', 'b', 'sh', 'sib', 'base', 'dot'].forEach((f) => { if (D[f] != null) d[f] = D[f]; }); defs[id] = d; };
    bins.forEach(keep);
    // hz 最多 8 个字（元游戏只认 ≤8 个字的 hz，长订单整单会被忽略）：先量词，再菜名，最后数字 / 语法词
    const pri = [[], [], []];
    const eat = (segs) => segs.forEach((s) => {
      if (s[1] === 'p' || s[1] === 'c') return;
      const cs = Array.from(s[0]).filter(isHan);
      if (s[1] === 'q') { pri[0].push(...cs.slice(1)); pri[2].push(cs[0]); } else if (s[1] === 'n') pri[1].push(...cs); else pri[2].push(...cs);
    });
    eat(o.segs); if (o.chg) eat(o.chg.segs);
    const hz = Array.from(new Set(pri[0].concat(pri[1], pri[2]).filter(Boolean))).slice(0, 8);
    const item = { g: 'stall', t: segText(o.segs) + (o.chg ? segText(o.chg.segs) : ''), segs: o.segs, want: Object.assign({}, o.want) };
    if (o.seq) item.seq = o.seq.slice();
    if (o.no.length) item.no = o.no.slice();
    if (o.stock.length) item.stock = o.stock.slice();
    if (o.chg) item.chg = { segs: o.chg.segs, want: Object.assign({}, o.chg.want), no: o.chg.no.slice() };
    item.bins = bins.slice();
    item.defs = defs;
    item.hz = Array.from(hz).join('');
    return item;
  }
  function validItem(it) {
    return !!it && it.g === 'stall' && Array.isArray(it.segs) && it.segs.length && it.want && typeof it.want === 'object' &&
      Array.isArray(it.bins) && it.bins.length >= 2 && it.defs && typeof it.defs === 'object' && it.bins.every((b) => it.defs[b]);
  }
  function adoptDefs(it) {
    for (const id in it.defs) if (!DEFS[id]) { const d = it.defs[id]; DEFS[id] = Object.assign({ id }, d); }
  }

  /* ================= 判分 ================= */
  function judge(want, seq, toks) {
    const got = Object.create(null), sc = [];
    for (const t of toks) { got[t.id] = (got[t.id] || 0) + 1; if (DEF(t.id).k === 'scoop') sc.push(t.id); }
    const probs = [];
    const ids = new Set(Object.keys(want).concat(Object.keys(got)));
    ids.forEach((id) => { const a = want[id] || 0, b = got[id] || 0; if (a !== b) probs.push({ id, want: a, got: b }); });
    let seqBad = -1;
    if (!probs.length && seq) for (let i = 0; i < seq.length; i++) if (sc[i] !== seq[i]) { seqBad = i; break; }
    return { ok: !probs.length && seqBad < 0, probs, seqBad, got };
  }
  /* 乱放（不是读错，是没读）：扣心照扣（g.hurt），但不进错题本——错题本只收真正读错的单。
     三种一眼就能认出来的：①同一样狂点，托盘远远超过点的份数；②点的东西一样都没对上，还放了三样以上订单里根本没提到的（只错一两样可能是真认错了字：猪肉/鸡肉）；
     ③点单刚出来 1.5 秒内就上菜、一半都没对上（没读就猜）；④被退回来的那一盘一样都没改，又原样端上去（狂按“上菜”）。其余的错（量词图选错、“不要”的放了、数目不对、冰淇淋顺序错……）都是华文错。 */
  function relatedIds(it, no) {
    const rel = new Set();
    const addId = (id) => { if (!id || id[0] === '@') return; rel.add(id); const s = DEF(id).sib; if (s) rel.add(s); };
    const segIds = (segs) => (segs || []).forEach((s) => (s[2] || []).forEach(addId));
    segIds(it.segs); Object.keys(it.want || {}).forEach(addId); (it.seq || []).forEach(addId); (it.no || []).forEach(addId);
    if (it.chg) { segIds(it.chg.segs); Object.keys(it.chg.want || {}).forEach(addId); (it.chg.no || []).forEach(addId); }
    (no || []).forEach(addId);
    return rel;
  }
  function junkTray(it, want, no, toks, tw) {
    const rel = relatedIds(it, no), got = Object.create(null);
    toks.forEach((t) => { got[t.id] = (got[t.id] || 0) + 1; });
    let wantN = 0, matched = 0;
    for (const id in want) { wantN += want[id]; matched += Math.min(want[id], got[id] || 0); }
    const unrelated = Object.keys(got).filter((id) => !rel.has(id)).length;
    if (toks.length >= wantN * 2 + 3) return true;
    // 一样都没对上，还放了好几样订单里没提到的（只点一样东西的单：放两样不相干的就算乱放）
    if (matched === 0 && unrelated >= Math.min(3, Object.keys(want).length + 1)) return true;
    // 没读完就上菜：读一个字至少要 0.12 秒（长单 24 个字 ≈ 3 秒，最少 1.5 秒、最多 4 秒），这么快还一大半不对 = 没读就猜
    const chars = segText(it.segs || []).replace(/[，。；：、！？\s]/g, '').length;
    if (tw < clamp(chars * 0.12, 1.5, 4) && matched * 2 < wantN) return true;
    return false;
  }
  function posName(i, n) { return n === 2 ? ['下面', '上面'][i] : i === 0 ? '最下面' : i === n - 1 ? '最上面' : '中间'; }
  /* 顾客的抱怨（孩子看得懂的一句话）+ 要标红的 id */
  function complaint(res, want, seq, no) {
    if (res.seqBad >= 0) {
      const i = res.seqBad;
      return { s: posName(i, seq.length) + '要' + DEF(seq[i]).n + '的！', ids: ['@' + i] };
    }
    const pr = res.probs.slice().sort((a, b) => rank(a) - rank(b))[0];
    function rank(p) { return p.want === 0 ? (no.indexOf(p.id) >= 0 ? 0 : 1) : p.got === 0 ? 2 : 3; }
    const D = DEF(pr.id);
    let s;
    if (pr.want === 0) {
      const sib = D.sib && want[D.sib] ? DEF(D.sib) : null;
      if (sib) s = '我要的是' + CN[Math.min(10, want[D.sib])] + sib.m + sib.n + '！';
      else if (no.indexOf(pr.id) >= 0) s = '我说了不要' + D.n + '！';
      else s = D.k === 'scoop' ? '我没有要' + D.n + '的呀！' : '我没有要' + D.n + '呀！';
    } else if (pr.got === 0) s = D.k === 'scoop' ? D.n + '的那' + CN[Math.min(10, pr.want)] + '球呢？' : '我的' + D.n + '呢？';
    else if (pr.got < pr.want) s = (D.k === 'scoop' ? D.n + '的' : D.n) + '少了！要' + CN[Math.min(10, pr.want)] + D.m + '。';
    else s = (D.k === 'scoop' ? D.n + '的' : D.n) + '太多了！只要' + CN[Math.min(10, pr.want)] + D.m + '。';
    const ids = [pr.id];
    if (D.sib) ids.push(D.sib);
    return { s, ids };
  }
  /* 结算面板上的“正确答案”：这一单应该做成什么 */
  function answerText(want, seq) {
    if (seq && seq.length) return '冰淇淋从下到上：' + seq.map((c) => DEF(c).n).join('、');
    return Object.keys(want).filter((id) => want[id] > 0).map((id) => { const D = DEF(id); return CN[Math.min(10, want[id])] + D.m + (D.k === 'scoop' ? D.n + '的' : D.n); }).join('、');
  }
  /* 错题本说明：按名称归组（同名不同量词写在一起） */
  function diagnose(res, want, seq, no) {
    if (res.seqBad >= 0) return '冰淇淋从下到上应该是：' + seq.map((c) => DEF(c).n.replace('色', '')).join('、');
    const byName = new Map();
    res.probs.forEach((p) => { const D = DEF(p.id); const k = D.k === 'scoop' ? D.n + '的' : D.n; if (!byName.has(k)) byName.set(k, []); byName.get(k).push(p.id); });
    const out = [];
    byName.forEach((ids, name) => {
      const all = new Set(ids); ids.forEach((id) => { const s = DEF(id).sib; if (s) all.add(s); });
      const w = [], g = [];
      all.forEach((id) => { const D = DEF(id); if (want[id]) w.push(CN[Math.min(10, want[id])] + D.m); if (res.got[id]) g.push(CN[Math.min(10, res.got[id])] + D.m); });
      const said = ids.some((id) => (no || []).indexOf(id) >= 0);
      out.push(name + '：' + (w.length ? '要' + w.join('和') : said ? '说了不要' : '没有点') + '，' + (g.length ? '你放了' + g.join('和') : '你没放'));
    });
    return out.slice(0, 3).join('；');
  }

  /* ================= 绘图小件 ================= */
  function rr(c, x, y, w, h, r) {
    r = Math.max(0, Math.min(r, w / 2, h / 2));
    c.beginPath(); c.moveTo(x + r, y);
    c.arcTo(x + w, y, x + w, y + h, r); c.arcTo(x + w, y + h, x, y + h, r);
    c.arcTo(x, y + h, x, y, r); c.arcTo(x, y, x + w, y, r); c.closePath();
  }
  function shade(hex, f) {   // f<0 变暗，f>0 变亮
    const n = parseInt(hex.slice(1), 16);
    let r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
    if (f < 0) { r *= 1 + f; g *= 1 + f; b *= 1 + f; } else { r += (255 - r) * f; g += (255 - g) * f; b += (255 - b) * f; }
    return 'rgb(' + Math.round(r) + ',' + Math.round(g) + ',' + Math.round(b) + ')';
  }
  function drawScoop(c, x, y, r, col) {
    c.fillStyle = shade(col, -0.18);
    c.beginPath(); c.arc(x, y + r * 0.12, r, 0, TAU); c.fill();
    c.fillStyle = col;
    c.beginPath(); c.arc(x, y, r, 0, TAU); c.fill();
    // 下沿的奶油波浪
    for (let i = -2; i <= 2; i++) { c.beginPath(); c.arc(x + i * r * 0.42, y + r * 0.72, r * 0.26, 0, TAU); c.fill(); }
    c.lineWidth = Math.max(1.5, r * 0.09); c.strokeStyle = 'rgba(29,43,83,.55)';
    c.beginPath(); c.arc(x, y, r, Math.PI * 0.95, Math.PI * 2.05); c.stroke();
    c.fillStyle = 'rgba(255,255,255,.6)';
    c.beginPath(); c.ellipse(x - r * 0.38, y - r * 0.4, r * 0.24, r * 0.14, -0.6, 0, TAU); c.fill();
  }
  function drawCone(c, x, y, w, h) {   // (x,y) = 蛋筒顶边中点
    c.fillStyle = '#E3A45A';
    c.beginPath(); c.moveTo(x - w / 2, y); c.lineTo(x + w / 2, y); c.lineTo(x, y + h); c.closePath(); c.fill();
    c.save(); c.clip();
    c.strokeStyle = 'rgba(150,90,30,.55)'; c.lineWidth = Math.max(1, w * 0.05);
    for (let i = -4; i <= 4; i++) {
      c.beginPath(); c.moveTo(x + i * w * 0.22, y); c.lineTo(x + i * w * 0.22 + h * 0.6, y + h); c.stroke();
      c.beginPath(); c.moveTo(x + i * w * 0.22, y); c.lineTo(x + i * w * 0.22 - h * 0.6, y + h); c.stroke();
    }
    c.restore();
    c.lineWidth = Math.max(1.5, w * 0.05); c.strokeStyle = NAVY;
    c.beginPath(); c.moveTo(x - w / 2, y); c.lineTo(x + w / 2, y); c.lineTo(x, y + h); c.closePath(); c.stroke();
  }
  function drawGrape(c, x, y, s) {
    const r = s * 0.3;
    c.strokeStyle = '#7A4B1E'; c.lineWidth = Math.max(1.5, s * 0.05); c.lineCap = 'round';
    c.beginPath(); c.moveTo(x, y - r * 0.9); c.quadraticCurveTo(x + r * 0.2, y - r * 1.5, x + r * 0.5, y - r * 1.6); c.stroke();
    c.fillStyle = '#5FB84C'; c.beginPath(); c.ellipse(x + r * 0.62, y - r * 1.45, r * 0.42, r * 0.2, -0.5, 0, TAU); c.fill();
    const gr = c.createRadialGradient(x - r * 0.35, y - r * 0.35, r * 0.1, x, y, r);
    gr.addColorStop(0, '#C79BFF'); gr.addColorStop(1, '#6A2BB8');
    c.fillStyle = gr; c.beginPath(); c.arc(x, y, r, 0, TAU); c.fill();
    c.lineWidth = Math.max(1.2, s * 0.035); c.strokeStyle = 'rgba(29,43,83,.6)'; c.stroke();
    c.fillStyle = 'rgba(255,255,255,.75)'; c.beginPath(); c.ellipse(x - r * 0.35, y - r * 0.38, r * 0.22, r * 0.13, -0.6, 0, TAU); c.fill();
  }
  function drawMelon(c, x, y, s) {
    const rx = s * 0.44, ry = s * 0.36;
    c.fillStyle = '#2F8F3F'; c.beginPath(); c.ellipse(x, y, rx, ry, 0, 0, TAU); c.fill();
    c.save(); c.beginPath(); c.ellipse(x, y, rx, ry, 0, 0, TAU); c.clip();
    c.strokeStyle = '#1B5E27'; c.lineWidth = s * 0.07;
    for (let i = -2; i <= 2; i++) {
      c.beginPath();
      for (let t = -1; t <= 1.001; t += 0.25) { const px = x + i * rx * 0.42 + Math.sin(t * 6 + i) * s * 0.03, py = y + t * ry; if (t === -1) c.moveTo(px, py); else c.lineTo(px, py); }
      c.stroke();
    }
    c.restore();
    c.lineWidth = Math.max(1.5, s * 0.04); c.strokeStyle = NAVY; c.beginPath(); c.ellipse(x, y, rx, ry, 0, 0, TAU); c.stroke();
    c.fillStyle = 'rgba(255,255,255,.35)'; c.beginPath(); c.ellipse(x - rx * 0.4, y - ry * 0.45, rx * 0.25, ry * 0.14, -0.4, 0, TAU); c.fill();
    c.strokeStyle = '#6B4A1E'; c.lineWidth = s * 0.05; c.lineCap = 'round';
    c.beginPath(); c.moveTo(x, y - ry); c.lineTo(x + s * 0.05, y - ry - s * 0.08); c.stroke();
  }
  function drawBananas(c, x, y, s) {   // 一串香蕉：四根没剥皮的香蕉挂在同一个蒂上
    const sx = x - s * 0.02, sy = y - s * 0.3;
    const tips = [[-0.38, 0.16], [-0.16, 0.32], [0.1, 0.34], [0.34, 0.2]];
    c.lineCap = 'round';
    for (let pass = 0; pass < 3; pass++) for (const [tx, ty] of tips) {
      const ex = x + tx * s, ey = y + ty * s;
      const cx = (sx + ex) / 2 + (tx < 0 ? -1 : 1) * s * 0.2, cy = (sy + ey) / 2 + s * 0.04;
      c.beginPath(); c.moveTo(sx, sy + s * 0.04); c.quadraticCurveTo(cx, cy, ex, ey);
      c.strokeStyle = pass === 0 ? '#1d2b53' : pass === 1 ? '#FFD43B' : 'rgba(255,255,255,.5)';
      c.lineWidth = s * (pass === 0 ? 0.2 : pass === 1 ? 0.14 : 0.035);
      c.stroke();
      if (pass === 2) { c.fillStyle = '#5C3D12'; c.beginPath(); c.arc(ex, ey, s * 0.035, 0, TAU); c.fill(); }
    }
    c.fillStyle = '#6B8E23'; rr(c, sx - s * 0.05, sy - s * 0.1, s * 0.1, s * 0.16, s * 0.03); c.fill();
    c.lineWidth = Math.max(1, s * 0.025); c.strokeStyle = '#1d2b53'; c.stroke();
  }
  /* 题库里用色块代替的加料：红豆 / 果冻 / 豆腐 / 仙草，自己画 */
  function drawBeans(c, x, y, s) {   // 一小撮红豆
    const P = [[-0.2, 0.12], [0, 0.16], [0.2, 0.12], [-0.1, 0], [0.1, 0], [0, -0.12], [-0.3, 0.02], [0.3, 0.02]];
    c.fillStyle = 'rgba(29,43,83,.18)'; c.beginPath(); c.ellipse(x, y + s * 0.26, s * 0.4, s * 0.09, 0, 0, TAU); c.fill();
    for (const [px, py] of P) {
      const bx = x + px * s, by = y + py * s + s * 0.04;
      c.fillStyle = '#8E1B2E'; c.beginPath(); c.ellipse(bx, by, s * 0.12, s * 0.085, 0.4, 0, TAU); c.fill();
      c.lineWidth = Math.max(1, s * 0.02); c.strokeStyle = '#4A0E18'; c.stroke();
      c.fillStyle = 'rgba(255,255,255,.55)'; c.beginPath(); c.ellipse(bx - s * 0.04, by - s * 0.03, s * 0.035, s * 0.018, 0.4, 0, TAU); c.fill();
    }
  }
  function drawCube(c, x, y, s, front, top, side, alpha) {   // 斜 45° 看的小方块
    const w = s * 0.5, h = s * 0.42, d = s * 0.16;
    const x0 = x - w / 2 - d / 2, y0 = y - h / 2 + d / 2;
    c.save(); c.globalAlpha *= alpha || 1;
    c.fillStyle = front; c.fillRect(x0, y0, w, h);
    c.fillStyle = top; c.beginPath(); c.moveTo(x0, y0); c.lineTo(x0 + d, y0 - d); c.lineTo(x0 + w + d, y0 - d); c.lineTo(x0 + w, y0); c.closePath(); c.fill();
    c.fillStyle = side; c.beginPath(); c.moveTo(x0 + w, y0); c.lineTo(x0 + w + d, y0 - d); c.lineTo(x0 + w + d, y0 + h - d); c.lineTo(x0 + w, y0 + h); c.closePath(); c.fill();
    c.restore();
    c.lineWidth = Math.max(1.2, s * 0.03); c.strokeStyle = NAVY; c.lineJoin = 'round';
    c.beginPath(); c.moveTo(x0, y0); c.lineTo(x0 + d, y0 - d); c.lineTo(x0 + w + d, y0 - d); c.lineTo(x0 + w + d, y0 + h - d); c.lineTo(x0 + w, y0 + h); c.lineTo(x0, y0 + h); c.closePath(); c.stroke();
    c.beginPath(); c.moveTo(x0, y0); c.lineTo(x0 + w, y0); c.lineTo(x0 + w + d, y0 - d); c.moveTo(x0 + w, y0); c.lineTo(x0 + w, y0 + h); c.stroke();
    c.fillStyle = 'rgba(255,255,255,.5)'; c.fillRect(x0 + w * 0.12, y0 + h * 0.14, w * 0.14, h * 0.5);
  }
  function drawJuice(g, c, D, x, y, s) {   // 果汁：一杯颜色 + 右下角水果
    const tw = s * 0.52, bw = s * 0.4, h = s * 0.66, top = y - h * 0.5;
    c.strokeStyle = '#E03131'; c.lineWidth = s * 0.05; c.lineCap = 'round';
    c.beginPath(); c.moveTo(x + s * 0.06, top + h * 0.3); c.lineTo(x + s * 0.2, top - s * 0.14); c.stroke();
    c.fillStyle = D.c || '#FFA94D';
    c.beginPath(); c.moveTo(x - tw / 2 + s * 0.03, top + h * 0.18); c.lineTo(x + tw / 2 - s * 0.03, top + h * 0.18); c.lineTo(x + bw / 2, top + h); c.lineTo(x - bw / 2, top + h); c.closePath(); c.fill();
    c.fillStyle = 'rgba(255,255,255,.35)';
    c.beginPath(); c.moveTo(x - tw / 2, top); c.lineTo(x + tw / 2, top); c.lineTo(x + tw / 2 - s * 0.02, top + h * 0.18); c.lineTo(x - tw / 2 + s * 0.02, top + h * 0.18); c.closePath(); c.fill();
    c.lineWidth = Math.max(1.5, s * 0.035); c.strokeStyle = NAVY; c.lineJoin = 'round';
    c.beginPath(); c.moveTo(x - tw / 2, top); c.lineTo(x + tw / 2, top); c.lineTo(x + bw / 2, top + h); c.lineTo(x - bw / 2, top + h); c.closePath(); c.stroke();
    c.fillStyle = 'rgba(255,255,255,.55)'; c.fillRect(x - tw * 0.32, top + h * 0.28, s * 0.05, h * 0.5);
    if (D.d === 'cane') drawCaneStalk(c, x + s * 0.27, y + s * 0.12, s * 0.5);
    else if (D.d === 'milktea') { c.fillStyle = 'rgba(255,255,255,.75)'; for (const [ix, iy] of [[-0.08, 0.02], [0.07, -0.04]]) { c.save(); c.translate(x + s * ix, top + h * 0.4 + s * iy); c.rotate(0.3); rr(c, -s * 0.06, -s * 0.06, s * 0.12, s * 0.12, s * 0.025); c.fill(); c.restore(); } }   // 两块冰
    else if (D.e) g.emoji(D.e, x + s * 0.26, y + s * 0.2, s * 0.36);
  }
  function drawBun(c, x, y, s, dot) {   // 包子：白白的馒头顶上捏褶
    const w = s * 0.46, h = s * 0.36, by = y + s * 0.2;
    c.fillStyle = 'rgba(29,43,83,.18)'; c.beginPath(); c.ellipse(x, by + s * 0.03, w * 1.05, s * 0.07, 0, 0, TAU); c.fill();
    c.beginPath(); c.moveTo(x - w, by); c.bezierCurveTo(x - w, by - h * 1.25, x - w * 0.25, by - h * 1.45, x, by - h * 1.4); c.bezierCurveTo(x + w * 0.25, by - h * 1.45, x + w, by - h * 1.25, x + w, by); c.closePath();
    const gr = c.createLinearGradient(0, by - h * 1.4, 0, by); gr.addColorStop(0, '#FFFFFF'); gr.addColorStop(1, '#F1E4CC');
    c.fillStyle = gr; c.fill(); c.lineWidth = Math.max(1.5, s * 0.035); c.strokeStyle = NAVY; c.stroke();
    c.strokeStyle = 'rgba(150,120,80,.7)'; c.lineWidth = Math.max(1, s * 0.022); c.lineCap = 'round';
    for (let i = -2; i <= 2; i++) { c.beginPath(); c.moveTo(x + i * w * 0.07, by - h * 1.36); c.quadraticCurveTo(x + i * w * 0.22, by - h * 1.1, x + i * w * 0.34, by - h * 0.86); c.stroke(); }
    if (dot) { c.fillStyle = '#E03131'; c.beginPath(); c.arc(x, by - h * 1.3, s * 0.045, 0, TAU); c.fill(); }
    c.fillStyle = 'rgba(255,255,255,.8)'; c.beginPath(); c.ellipse(x - w * 0.5, by - h * 0.75, w * 0.14, h * 0.2, -0.5, 0, TAU); c.fill();
  }
  function drawSpoon(c, x, y, s, col) {   // 一勺（炼奶）：汤匙斜放，勺里满满一勺
    s *= 1.3;
    c.save(); c.translate(x + s * 0.05, y); c.rotate(-0.55);
    c.lineCap = 'round';
    c.strokeStyle = NAVY; c.lineWidth = s * 0.13; c.beginPath(); c.moveTo(s * 0.1, 0); c.lineTo(s * 0.5, 0); c.stroke();
    c.strokeStyle = '#C9D2DC'; c.lineWidth = s * 0.08; c.beginPath(); c.moveTo(s * 0.1, 0); c.lineTo(s * 0.5, 0); c.stroke();
    c.fillStyle = '#C9D2DC'; c.beginPath(); c.ellipse(-s * 0.1, 0, s * 0.26, s * 0.18, 0, 0, TAU); c.fill();
    c.lineWidth = Math.max(1.5, s * 0.035); c.strokeStyle = NAVY; c.stroke();
    c.fillStyle = col; c.beginPath(); c.ellipse(-s * 0.1, -s * 0.01, s * 0.2, s * 0.13, 0, 0, TAU); c.fill();
    c.fillStyle = 'rgba(255,255,255,.8)'; c.beginPath(); c.ellipse(-s * 0.16, -s * 0.05, s * 0.07, s * 0.035, 0, 0, TAU); c.fill();
    c.restore();
  }
  function drawCaneStalk(c, x, y, s) {   // 一截斜放的甘蔗（竹节 + 两片叶子）
    c.save(); c.translate(x, y); c.rotate(0.35);
    const w = s * 0.22, h = s * 0.95;
    c.fillStyle = '#6BA539'; c.beginPath(); c.ellipse(-w * 0.2, -h / 2, w * 0.35, s * 0.2, -0.6, 0, TAU); c.fill();
    c.beginPath(); c.ellipse(w * 0.35, -h / 2 - s * 0.02, w * 0.3, s * 0.17, 0.7, 0, TAU); c.fill();
    rr(c, -w / 2, -h / 2, w, h, w * 0.4); c.fillStyle = '#9CC54A'; c.fill();
    c.lineWidth = Math.max(1.2, s * 0.05); c.strokeStyle = NAVY; c.stroke();
    c.strokeStyle = '#4F7A1E'; c.lineWidth = Math.max(1, s * 0.045);
    for (const f of [-0.18, 0.14]) { c.beginPath(); c.moveTo(-w / 2, f * h); c.lineTo(w / 2, f * h); c.stroke(); }
    c.fillStyle = 'rgba(255,255,255,.45)'; c.fillRect(-w * 0.28, -h * 0.4, w * 0.18, h * 0.7);
    c.restore();
  }
  const BOWLISH = /[🍜🍲🥣🍧🍨🍮🍛🍝]/u;
  /* 主食：盘子 / 碗 + 食物 */
  function drawDish(g, c, D, x, y, s) {
    const bowl = D.m === '碗';
    if (bowl) {
      const w = s * 0.92, h = s * 0.42, top = y + s * 0.02;
      c.fillStyle = '#E8F1FB';
      c.beginPath(); c.moveTo(x - w / 2, top); c.quadraticCurveTo(x - w * 0.46, top + h, x, top + h); c.quadraticCurveTo(x + w * 0.46, top + h, x + w / 2, top); c.closePath(); c.fill();
      c.lineWidth = Math.max(1.5, s * 0.035); c.strokeStyle = NAVY; c.stroke();
      c.strokeStyle = '#3A86FF'; c.lineWidth = s * 0.035; c.beginPath(); c.moveTo(x - w * 0.4, top + h * 0.35); c.quadraticCurveTo(x, top + h * 0.62, x + w * 0.4, top + h * 0.35); c.stroke();
      // 碗里的 emoji 本身不是一碗东西（虾面 = 🦐）：先画碗面，再把它摆在上面当浇头，免得和加料“虾”长得一样
      const inBowl = BOWLISH.test(D.e) ? null : (D.base || []).find((e) => BOWLISH.test(e)) || (/面|粉/.test(D.n) ? '🍜' : null);
      if (inBowl === '🥣') {   // 🥣 本身就是一只碗（水饺汤的配料“汤”）：不画“碗里套碗”，画一碗清汤，水饺浮在汤面上
        c.fillStyle = '#F6DFA8'; c.beginPath(); c.ellipse(x, top + s * 0.01, w * 0.46, s * 0.1, 0, 0, TAU); c.fill();
        c.lineWidth = Math.max(1.2, s * 0.025); c.strokeStyle = NAVY; c.stroke();
        g.emoji(D.e, x - s * 0.15, y - s * 0.08, s * 0.4); g.emoji(D.e, x + s * 0.15, y - s * 0.11, s * 0.4);
      } else if (inBowl) { g.emoji(inBowl, x, y - s * 0.1, s * 0.6); g.emoji(D.e, x + s * 0.2, y - s * 0.3, s * 0.36); }
      else g.emoji(D.e, x, y - s * 0.12, s * 0.62);
    } else {
      c.fillStyle = 'rgba(29,43,83,.25)'; c.beginPath(); c.ellipse(x, y + s * 0.2, s * 0.5, s * 0.19, 0, 0, TAU); c.fill();
      c.fillStyle = '#FFFFFF'; c.beginPath(); c.ellipse(x, y + s * 0.15, s * 0.5, s * 0.19, 0, 0, TAU); c.fill();
      c.lineWidth = Math.max(1.5, s * 0.03); c.strokeStyle = NAVY; c.stroke();
      c.strokeStyle = '#8EC5FF'; c.lineWidth = s * 0.03; c.beginPath(); c.ellipse(x, y + s * 0.15, s * 0.4, s * 0.13, 0, 0, TAU); c.stroke();
      const base = D.base && D.base.length ? D.base : [D.e];
      if (base.length === 1) g.emoji(base[0], x, y - s * 0.04, s * 0.6);
      else base.forEach((e, i) => g.emoji(e, x + (i - (base.length - 1) / 2) * s * 0.3, y - s * 0.02 - (i % 2) * s * 0.06, s * 0.46));
    }
  }
  /* 任意一样东西（格子里、托盘上共用） */
  function drawThing(g, c, id, x, y, s, a) {
    const D = DEF(id);
    if (a != null && a < 1) { c.save(); c.globalAlpha *= Math.max(0, a); }
    if (D.d === 'scoop') drawScoop(c, x, y, s * 0.36, D.c || '#FFFFFF');
    else if (D.d === 'grape') drawGrape(c, x, y + s * 0.08, s);
    else if (D.d === 'melon') drawMelon(c, x, y, s);
    else if (D.d === 'bananas') drawBananas(c, x, y, s);
    else if (D.d === 'beans') drawBeans(c, x, y, s);
    else if (D.d === 'jelly') drawCube(c, x, y + s * 0.04, s, '#63D471', '#A6F0AE', '#3FAE50', 0.9);
    else if (D.d === 'tofu') drawCube(c, x, y + s * 0.04, s, '#FFFBEF', '#FFFFFF', '#E9DFC6');
    else if (D.d === 'grass') drawCube(c, x, y + s * 0.04, s, '#3B2A22', '#5C463A', '#231812');
    else if (D.d === 'juice' || D.d === 'cane' || D.d === 'milktea') drawJuice(g, c, D, x, y, s);
    else if (D.d === 'spoon') drawSpoon(c, x, y, s, D.c || '#FFF1CC');
    else if (D.d === 'bun') drawBun(c, x, y, s, D.dot);
    else if (D.k === 'dish') drawDish(g, c, D, x, y, s);
    else g.emoji(D.e || '❓', x, y, s * 0.78);
    if (D.b) {
      const br = s * 0.2, bx = x + s * 0.3, by = y + s * 0.26;
      c.fillStyle = '#FFFFFF'; c.beginPath(); c.arc(bx, by, br, 0, TAU); c.fill();
      c.lineWidth = Math.max(1.2, s * 0.03); c.strokeStyle = NAVY; c.stroke();
      g.emoji(D.b, bx, by, br * 1.5);
    }
    if (a != null && a < 1) c.restore();
  }

  /* 顾客：画出来的身体 + emoji 头 */
  const L_CS = { v: 1 };   // 顾客缩放（横屏放大），由 layout 写入
  const FACES = ['🐼', '🐯', '🐵', '🐨', '🐸', '🦁', '🐷', '🐰', '🐱', '🐶', '🦊', '🐻', '🐧', '🐮', '👧', '👦', '👵', '👴', '👩', '👨', '🧕', '👳'];
  const SHIRTS = ['#FF6B6B', '#4DABF7', '#51CF66', '#FFA94D', '#B197FC', '#F783AC', '#20C997', '#FCC419', '#748FFC'];
  function drawCust(g, c, cu, k, t) {
    const s = cu.sc * k * (L_CS.v || 1);
    const walking = cu.st === 'in' || cu.st === 'out' || cu.mv > 0.5;
    const bob = walking ? -Math.abs(Math.sin(cu.ph)) * 6 * s : Math.sin(t * 2.2 + cu.seed) * 2.6 * s;
    const shx = cu.shk > 0 ? Math.sin(t * 55) * cu.shk * 5 * s : 0;
    const x = cu.x + shx, y = cu.y + bob - cu.jy * s;
    const tw = 68 * s, th = 62 * s;
    // 手臂
    const armL = walking ? Math.sin(cu.ph) * 0.6 : cu.st === 'yum' ? -2.5 + Math.sin(t * 14) * 0.25 : cu.st === 'mad' ? -1.2 + Math.sin(t * 22) * 0.35 : cu.hand > 0 ? -2.7 : 0.18;
    const armR = walking ? -Math.sin(cu.ph) * 0.6 : cu.st === 'yum' ? 2.5 - Math.sin(t * 14) * 0.25 : cu.st === 'mad' ? 1.2 - Math.sin(t * 22 + 1) * 0.35 : -0.18;
    const arm = (sx, ang) => {
      c.save(); c.translate(sx, y - th + 16 * s); c.rotate(ang);
      c.lineCap = 'round'; c.strokeStyle = NAVY; c.lineWidth = 17 * s; c.beginPath(); c.moveTo(0, 0); c.lineTo(0, 36 * s); c.stroke();
      c.strokeStyle = cu.shirt; c.lineWidth = 11 * s; c.beginPath(); c.moveTo(0, 0); c.lineTo(0, 34 * s); c.stroke();
      c.fillStyle = '#FFD9B8'; c.beginPath(); c.arc(0, 38 * s, 7 * s, 0, TAU); c.fill(); c.lineWidth = 2 * s; c.strokeStyle = NAVY; c.stroke();
      c.restore();
    };
    arm(x - tw / 2 + 6 * s, armL);
    arm(x + tw / 2 - 6 * s, armR);
    // 身体
    rr(c, x - tw / 2, y - th, tw, th + 40 * s, 24 * s);
    c.fillStyle = cu.shirt; c.fill(); c.lineWidth = 3 * s; c.strokeStyle = NAVY; c.stroke();
    c.fillStyle = 'rgba(255,255,255,.28)'; rr(c, x - tw / 2 + 7 * s, y - th + 6 * s, tw * 0.3, th * 0.5, 10 * s); c.fill();
    c.fillStyle = '#FFFFFF'; c.beginPath(); c.moveTo(x - 12 * s, y - th); c.lineTo(x, y - th + 13 * s); c.lineTo(x + 12 * s, y - th); c.closePath(); c.fill();
    // 头
    const hy = y - th - 24 * s;
    g.emoji(cu.face, x, hy, 66 * s, cu.st === 'out' && cu.dir < 0 ? { flip: true } : undefined);
    if (cu.vip) g.emoji('👑', x + 2 * s, hy - 38 * s + Math.sin(t * 3) * 2 * s, 30 * s, { rot: 0.12 });
    // 心情
    const mood = cu.st === 'mad' || cu.madT > 0 ? '💢' : cu.st === 'yum' ? '😋' : cu.hand > 0 ? '❗' : cu.st === 'wait' && cu.pmax > 0 && cu.pat / cu.pmax < 0.3 ? '💦' : '';
    if (mood) g.emoji(mood, x + 30 * s, hy - 26 * s + Math.sin(t * 6) * 2 * s, 26 * s);
  }

  /* ================= 游戏规格（每局新建） ================= */
  function makeSpec(ctx) {
    const gnum = ctx.gradeNum || 3;
    const HI = gnum >= 4;
    const LVS = HI ? LV_HI : LV_LO;
    const AUTO_SAY = !HI;             // P2/P3：顾客点单自动读出来
    let S = null;
    const L = { k: 1, land: false };
    const BG = { cv: null, fg: null, key: '' };

    /* ---------- 布局 ---------- */
    function layout(g) {
      const w = g.w, h = g.h, top = g.hudTop;
      const land = w >= 600 && w > h * 1.15;   // 手机横屏（667×375 等）也用横排：竖排版在矮屏上气泡会盖住托盘
      const k = land ? clamp(Math.min(w / 1150, h / 760), 0.75, 1.3) : clamp(Math.min(w / 390, h / 780), 0.72, 1.35);
      L.k = k; L.land = land; L.w = w; L.h = h; L.top = top;
      const pad = 12 * k, gap = 10 * k;
      const nb = S ? S.bins.length : 6;
      let cols = land ? (nb <= 8 ? nb : Math.ceil(nb / 2)) : nb <= 4 ? 2 : nb <= 6 ? 3 : nb <= 8 ? 4 : 5;
      let rows = Math.ceil(nb / cols);
      const btnH = 64 * k;
      let bs;
      const trayH = (land ? 130 : 116) * k;
      const sceneMin = (land ? 250 : 236) * k;
      if (land) {
        const btnZone = 290 * k;
        const wOf = (cc) => (w - pad * 2 - btnZone - gap - gap * (cc - 1)) / cc;
        bs = Math.min(wOf(cols), 118 * k);
        const maxBH = h - top - (pad + 16 * k + 18 * k + trayH + sceneMin);
        // 手机横屏（很矮很宽）：两排放不下就排成一排，格子反而更大（844×390 上 9 格：两排 42px → 一排 60px）
        if (rows > 1 && rows * 56 * k + (rows - 1) * gap > maxBH && wOf(nb) > 56 * k) { cols = nb; rows = 1; bs = Math.min(wOf(nb), 84 * k); }
        else if (rows * bs + (rows - 1) * gap > maxBH) bs = Math.max(56 * k, (maxBH - (rows - 1) * gap) / rows);
        const bw = cols * bs + (cols - 1) * gap;
        L.binsX = pad + Math.max(0, (w - pad * 2 - btnZone - gap - bw) / 2);
        L.binsY = h - pad - (rows * bs + (rows - 1) * gap);
        const bx = w - pad - btnZone;
        const bh = Math.min(bs, 96 * k), by = h - pad - (rows * bs + (rows - 1) * gap) / 2 - bh / 2;
        L.trash = { x: bx, y: by, w: 88 * k, h: bh };
        L.serve = { x: bx + 88 * k + gap, y: by, w: btnZone - 88 * k - gap, h: bh };
      } else {
        bs = Math.min((w - pad * 2 - gap * (cols - 1)) / cols, (nb <= 4 ? 116 : 110) * k);
        const maxBH = h - top - (pad + btnH + 12 * k + 16 * k + 18 * k + trayH + sceneMin);
        if (rows * bs + (rows - 1) * gap > maxBH) bs = Math.max(54 * k, (maxBH - (rows - 1) * gap) / rows);
        const btnY = h - pad - btnH;
        L.trash = { x: pad, y: btnY, w: 96 * k, h: btnH };
        L.serve = { x: pad + 96 * k + gap, y: btnY, w: w - pad * 2 - 96 * k - gap, h: btnH };
        const bw = cols * bs + (cols - 1) * gap;
        L.binsX = (w - bw) / 2;
        L.binsY = btnY - 12 * k - (rows * bs + (rows - 1) * gap);
      }
      L.bs = bs; L.cols = cols; L.rows = rows; L.gap = gap; L.pad = pad;
      L.wsTop = L.binsY - 16 * k;
      L.trayB = L.wsTop - 18 * k;
      const trayW = land ? Math.min(640 * k, w * 0.6) : w - pad * 2 - 74 * k;
      L.tray = { x: land ? w * 0.44 - trayW / 2 : pad, y: L.trayB - trayH, w: trayW, h: trayH };
      L.jar = { x: L.tray.x + trayW + (land ? 30 : 12) * k, y: L.tray.y + trayH * 0.2, w: 56 * k, h: trayH * 0.72 };
      L.cTop = L.tray.y + trayH * 0.32;
      L.custX = land ? w * 0.66 : w * 0.27;
      L.custY = L.cTop + 8 * k;
      L.qX = land ? [w * 0.8, w * 0.92] : [w * 0.63, w * 0.86];
      L.qY = L.cTop - 16 * k;
      L.cs = land ? clamp((L.cTop - top) / 320, 1, 1.75) : 1;   // 横屏场景高：顾客画大一些
      L.headTop = L.custY - (62 + 24 + 36) * k * L.cs;
      L.headY = L.custY - (62 + 24) * k * L.cs;
      L_CS.v = L.cs;
      L.fs = (HI ? 24 : 30) * k * (land ? 1.1 : 1);
      if (S) {
        S.bins.forEach((b, i) => {
          const r = Math.floor(i / cols), q = i % cols;
          const rowN = Math.min(cols, S.bins.length - r * cols);
          const rowX = L.binsX + ((cols - rowN) * (bs + gap)) / 2;
          b.x = rowX + q * (bs + gap); b.y = L.binsY + r * (bs + gap); b.w = bs; b.h = bs;
        });
        if (S.cur) S.cur.bl = null;
      }
      paintBg(g);
    }

    /* ---------- 背景（缓存成两张离屏画布：后景 + 柜台前景） ---------- */
    function mkCv(w, h, dpr) {
      const cv = document.createElement('canvas');
      cv.width = Math.max(1, Math.round(w * dpr)); cv.height = Math.max(1, Math.round(h * dpr));
      const x = cv.getContext('2d'); x.setTransform(dpr, 0, 0, dpr, 0, 0);
      return { cv, x };
    }
    function paintBg(g) {
      const w = g.w, h = g.h, dpr = g.dpr || 1, k = L.k;
      const key = [w, h, dpr, S ? S.bins.length : 0, L.land].join('|');
      if (BG.key === key) return;
      BG.key = key;
      if (BG.cv) { BG.cv.width = 0; BG.cv.height = 0; }
      if (BG.fg) { BG.fg.width = 0; BG.fg.height = 0; }
      const b = mkCv(w, h, dpr), x = b.x;
      const cTop = L.cTop;
      // 墙
      let gr = x.createLinearGradient(0, 0, 0, cTop);
      gr.addColorStop(0, '#FFE8C2'); gr.addColorStop(1, '#FFD49A');
      x.fillStyle = gr; x.fillRect(0, 0, w, cTop + 4);
      // 屋顶横梁
      x.fillStyle = '#2F6F57'; x.fillRect(0, 0, w, L.top + 20 * k);
      x.fillStyle = '#3D8A6C'; for (let i = 0; i < w; i += 46 * k) x.fillRect(i, 0, 22 * k, L.top + 20 * k);
      x.fillStyle = 'rgba(0,0,0,.18)'; x.fillRect(0, L.top + 20 * k, w, 5 * k);
      // 远处的一排小摊
      const sy0 = L.top + 34 * k, sy1 = cTop - 64 * k;
      const stallCols = ['#E63946', '#2A9D8F', '#F4A261', '#457B9D', '#E76F51', '#6A4C93'];
      const sw = (land2() ? 150 : 104) * k;
      S.farStalls = [];
      L.fanBot = sy1;
      if (sy1 - sy0 > 40 * k) {
        for (let i = 0, sx = -20 * k; sx < w + 20 * k; i++, sx += sw + 10 * k) {
          const col = stallCols[i % stallCols.length];
          const sh = Math.min(sy1 - sy0, (L.land ? 230 : 120) * k);
          const y0 = sy1 - sh;
          L.fanBot = y0;
          x.fillStyle = 'rgba(120,70,20,.12)'; x.fillRect(sx + 4 * k, y0 + 4 * k, sw, sh);
          x.fillStyle = '#FFF4E0'; x.fillRect(sx, y0 + 22 * k, sw, sh - 22 * k);
          x.fillStyle = col; rr(x, sx - 3 * k, y0, sw + 6 * k, 26 * k, 5 * k); x.fill();
          x.fillStyle = 'rgba(255,255,255,.85)'; rr(x, sx + sw * 0.18, y0 + 5 * k, sw * 0.64, 16 * k, 4 * k); x.fill();
          x.fillStyle = shade(col, -0.2); x.fillRect(sx, sy1 - 22 * k, sw, 22 * k);
          x.fillStyle = 'rgba(0,0,0,.08)'; x.fillRect(sx + 8 * k, y0 + 34 * k, sw - 16 * k, sh - 64 * k);
          S.farStalls.push({ x: sx + sw / 2, y: y0 + 13 * k, iy: y0 + 22 * k + (sh - 44 * k) / 2, s: Math.min(24 * k, (sh - 40 * k) * 0.6), big: Math.max(0, Math.min(70 * k, (sh - 70 * k) * 0.55)), i });
        }
      }
      // 地砖
      const fy = Math.max(sy1, L.top + 40 * k);
      L.walkFeet = fy + (cTop - fy) * 0.62;   // 背景食客脚下的位置（地砖中间）
      x.fillStyle = '#E9C9A0'; x.fillRect(0, fy, w, cTop - fy + 4);
      x.fillStyle = '#DDB88A';
      const ts = 30 * k;
      for (let yy = fy, r = 0; yy < cTop; yy += ts * 0.6, r++) for (let xx = (r % 2) * ts; xx < w; xx += ts * 2) x.fillRect(xx, yy, ts, ts * 0.6);
      // 远处的桌子
      for (let i = 0; i < 3; i++) {
        const tx = w * (0.18 + i * 0.32), ty = fy + (cTop - fy) * 0.35;
        x.fillStyle = 'rgba(29,43,83,.12)'; x.beginPath(); x.ellipse(tx, ty + 18 * k, 34 * k, 8 * k, 0, 0, TAU); x.fill();
        x.fillStyle = '#9AA7B8'; x.fillRect(tx - 3 * k, ty, 6 * k, 18 * k);
        x.fillStyle = '#C7D0DC'; x.beginPath(); x.ellipse(tx, ty, 30 * k, 8 * k, 0, 0, TAU); x.fill();
      }
      BG.cv = b.cv;

      // ---- 前景：柜台 + 工作台 + 格子底座 + 雨棚 ----
      const f = mkCv(w, h, dpr), y = f.x;
      // 柜台台面
      gr = y.createLinearGradient(0, cTop, 0, L.trayB + 8 * k);
      gr.addColorStop(0, '#EEF3F8'); gr.addColorStop(1, '#B9C6D3');
      y.fillStyle = gr; y.fillRect(0, cTop, w, L.trayB + 8 * k - cTop);
      y.fillStyle = 'rgba(255,255,255,.8)'; y.fillRect(0, cTop, w, 3 * k);
      y.fillStyle = NAVY; y.fillRect(0, cTop - 2 * k, w, 2 * k);
      // 柜台正面（红底白边）
      y.fillStyle = '#D6453D'; y.fillRect(0, L.trayB + 8 * k, w, L.wsTop - L.trayB - 8 * k);
      y.fillStyle = '#FFFFFF'; for (let i = 0; i < w; i += 28 * k) { y.beginPath(); y.arc(i + 14 * k, L.trayB + 8 * k, 7 * k, 0, Math.PI); y.fill(); }
      // 工作台
      gr = y.createLinearGradient(0, L.wsTop, 0, h);
      gr.addColorStop(0, '#6B7A8F'); gr.addColorStop(1, '#4A566A');
      y.fillStyle = gr; y.fillRect(0, L.wsTop, w, h - L.wsTop);
      y.fillStyle = 'rgba(255,255,255,.12)'; y.fillRect(0, L.wsTop, w, 4 * k);
      y.fillStyle = 'rgba(0,0,0,.25)'; y.fillRect(0, L.wsTop + 4 * k, w, 3 * k);
      // 格子底座（不锈钢方盆）
      if (S) S.bins.forEach((bn) => {
        y.fillStyle = 'rgba(0,0,0,.3)'; rr(y, bn.x, bn.y + 5 * k, bn.w, bn.h, 16 * k); y.fill();
        const g2 = y.createLinearGradient(0, bn.y, 0, bn.y + bn.h);
        g2.addColorStop(0, '#F4F7FA'); g2.addColorStop(1, '#C5CFDA');
        y.fillStyle = g2; rr(y, bn.x, bn.y, bn.w, bn.h, 16 * k); y.fill();
        y.lineWidth = 3 * k; y.strokeStyle = NAVY; y.stroke();
        y.fillStyle = 'rgba(29,43,83,.08)'; rr(y, bn.x + 8 * k, bn.y + 8 * k, bn.w - 16 * k, bn.h - 16 * k, 11 * k); y.fill();
      });
      // 雨棚（红白条纹 + 花边），挂在 HUD 下面
      const ay = L.top + 18 * k, ah = 22 * k, st = 34 * k;
      for (let i = 0, xx = 0; xx < w; i++, xx += st) {
        y.fillStyle = i % 2 ? '#FFFFFF' : '#E8403A';
        y.fillRect(xx, ay, st, ah);
        y.beginPath(); y.arc(xx + st / 2, ay + ah, st / 2, 0, Math.PI); y.fill();
      }
      y.fillStyle = 'rgba(0,0,0,.12)'; y.fillRect(0, ay + ah - 3 * k, w, 3 * k);
      // 左右柱子
      y.fillStyle = '#C0392B'; y.fillRect(0, ay, 8 * k, cTop - ay); y.fillRect(w - 8 * k, ay, 8 * k, cTop - ay);
      BG.fg = f.cv;
    }
    function land2() { return L.land; }

    /* ---------- 顾客与订单 ---------- */
    function newCust(g, i) {
      const k = L.k;
      const used = [S.cur].concat(S.queue).filter(Boolean).map((q) => q.face);
      const free = FACES.filter((f) => used.indexOf(f) < 0);
      return { face: pick(free.length ? free : FACES), shirt: pick(SHIRTS), x: g.w + (70 + i * 70) * k, y: L.qY, tx: g.w + 70 * k, ty: L.qY, sc: 0.78, tsc: 0.78,
        st: 'q', t: 0, ph: 0, seed: Math.random() * 6, jy: 0, shk: 0, mv: 0, hand: 0, madT: 0, dir: -1, vip: false,
        item: null, want: null, seq: null, no: [], pat: 0, pmax: 0, tw: 0, wrongN: 0, readWrong: 0, bub: 0, bl: null, chgDone: false, resaid: false, lastBad: null };
    }
    function need(g) { return Math.max(0, g.rounds - g.done); }
    function refill(g) {
      const want = Math.min(3, need(g));
      while ((S.cur ? 1 : 0) + S.queue.length < want) S.queue.push(newCust(g, S.queue.length));
      S.queue.forEach((q, i) => { q.tx = L.qX[Math.min(i, L.qX.length - 1)] + (i >= L.qX.length ? 40 * L.k : 0); q.ty = L.qY; q.tsc = 0.78; });
    }
    function advance(g) {
      if (S.cur || !S.queue.length || need(g) <= 0 || g.state === 'over') return;
      const cu = S.queue.shift();
      S.cur = cu;
      cu.st = 'in'; cu.tx = L.custX; cu.ty = L.custY; cu.tsc = 1;
      cu.vip = !S.rev && need(g) === 1 && g.rounds >= 4;
      let item = null;
      while (S.rev && S.rev.length && !item) { const it = S.rev.shift(); if (validItem(it)) item = it; }
      if (item) adoptDefs(item);
      else { const o = S.gen(S.pool, cu.vip); cu.tpl = o.tpl; item = sealOrder(o, S.dayBins); }
      cu.item = item;
      cu.want = Object.assign(Object.create(null), item.want);
      cu.seq = item.seq ? item.seq.slice() : null;
      cu.no = (item.no || []).slice();
      const base = (HI ? PAT_HI : PAT_LO)[clamp(g.level, 1, 10)];
      const chars = (item.t || '').replace(/[，。；：、！？\s]/g, '').length;
      cu.pmax = (base + chars * (HI ? (g.level >= 8 ? 0.8 : 0.9) : 1.3)) * (cu.vip ? 0.9 : 1);
      cu.pat = cu.pmax;
      setBins(g, item.bins);
      refill(g);
    }
    function setBins(g, ids) {
      const same = S.bins.length === ids.length && S.bins.every((b, i) => b.id === ids[i]);
      if (!same) {
        S.bins = ids.map((id, i) => ({ id, x: 0, y: 0, w: 0, h: 0, press: 0, shk: 0, pop: 0, delay: i * 0.06, sold: false }));
        layout(g);
      }
    }
    function setStock(list) { S.bins.forEach((b) => { b.sold = !!(list && list.indexOf(b.id) >= 0); }); }
    function orderText(cu) {
      let s = segText(cu.item.segs);
      if (cu.chgDone && cu.item.chg) s += segText(cu.item.chg.segs);
      return s;
    }
    // 没有中文朗读时不显示引擎的拼音字幕：点单就在气泡里，而自动注音会猜错调（甘蔗）、查不到的字成“·”，长句还会缩成一行小字
    // g.ttsOK = 有中文朗读且没坏（连续两次“空播”后为 false）：坏了就收起喇叭；朗读失败时也不要引擎补的拼音字幕
    const ttsOk = (g) => { try { return g && 'ttsOK' in g ? !!g.ttsOK : !!(ctx.tts && ctx.tts.ok); } catch (e) { return false; } };
    const say = (g, text) => (ttsOk(g) ? g.say(text, { caption: false }) : null);
    function sayOrder(g, only) {
      const cu = S.cur;
      if (!cu || !cu.item || (cu.st !== 'ask' && cu.st !== 'wait')) return;
      if (g.state !== 'play') { S.pendingSay = true; return; }
      say(g, only || orderText(cu));
    }
    function arrive(g, cu) {
      cu.st = 'ask'; cu.t = 0; cu.bub = 0; cu.bl = null;
      g.tween(cu, { bub: 1 }, 0.38, 'outBack');
      g.sfx('bubble');
      if (cu.vip) { g.sfx('power'); S.labels.push({ s: '美食家来啦！', x: cu.x, y: L.headTop - 10 * L.k, t: 0, big: true }); }
      setStock(cu.item.stock);
      if (AUTO_SAY) sayOrder(g);
    }
    function applyChange(g, cu) {
      const c = cu.item.chg;
      cu.chgDone = true; cu.chgT = S.t;
      cu.want = Object.assign(Object.create(null), c.want);
      cu.no = cu.no.concat(c.no || []);
      cu.hand = 1.8; cu.bl = null;
      cu.pat = Math.min(cu.pmax, cu.pat + 8);
      S.chgFlash = 1;
      g.sfx('bubble'); g.sfx('tick');
      S.labels.push({ s: '改单啦！', x: cu.x, y: L.headTop - 6 * L.k, t: 0, big: true });
      if (AUTO_SAY) sayOrder(g, segText(c.segs));
    }
    function leave(g, cu) {
      cu.st = 'out'; cu.dir = -1; cu.tx = -140 * L.k; cu.tsc = 1;
      S.gone.push(cu);
      if (S.cur === cu) S.cur = null;
      S.bad.t = 0; S.shout.t = Math.min(S.shout.t, 0.6); S.glow = null; S.serveQ = false;
      setStock(null);
      refill(g);
      g.after(0.25, () => advance(g));
    }
    function walkout(g) {
      const cu = S.cur;
      if (!cu) return;
      cu.st = 'mad'; cu.t = 0; cu.shk = 1;
      S.walk++;
      g.miss(cu.x, L.headTop);
      S.shout = { s: '等太久啦！我不吃了！', t: 2.2 };
      dumpTray(g);
      if (S.rev) S.rev.push(cu.item);
      if (S.walk >= 3) { const rv = answerText(cu.want, cu.seq); g.after(0.9, () => g.lose({ reveal: rv })); }
    }

    /* ---------- 托盘 ---------- */
    const onTray = () => S.toks.filter((t) => t.st === 'on' || t.st === 'fly');
    // 落到托盘上飘的名字：只写名称，不写量词（“一串”“一颗”写出来，量词关就变成对字形了——量词得自己读懂）
    function labelOf(id) { return DEF(id).n; }
    function tapBin(g, i) {
      const b = S.bins[i];
      if (!b || b.pop < 0.9) return;
      S.idle = 0;
      if (b.sold) { b.shk = 1; g.sfx('tick'); S.labels.push({ s: '卖完了！', x: b.x + b.w / 2, y: b.y + 6 * L.k, t: 0 }); return; }
      if (S.serving) return;
      if (onTray().length >= 24) { S.labels.push({ s: '托盘放满了', x: b.x + b.w / 2, y: b.y, t: 0 }); g.sfx('tick'); return; }
      // 蛋筒最多叠 6 球（订单最多 4 球）：再叠就伸到顾客脸上了
      if (DEF(b.id).k === 'scoop' && onTray().filter((t) => DEF(t.id).k === 'scoop').length >= 6) { b.shk = 1; S.labels.push({ s: '放不下了', x: b.x + b.w / 2, y: b.y, t: 0 }); g.sfx('tick'); return; }
      b.press = 1; S.tapped = true;
      g.sfx('pop');
      const x = b.x + b.w / 2, y = b.y + b.h / 2;
      S.toks.push({ id: b.id, x, y, x0: x, y0: y, tx: x, ty: y, t: 0, st: 'fly', s: L.bs * 0.62, s0: L.bs * 0.62, sc: 1, land: 0 });
    }
    function sendOut(t) { t.st = 'out'; t.t = 0; t.x0 = t.x; t.y0 = t.y; t.tx = L.trash.x + L.trash.w / 2; t.ty = L.trash.y + L.trash.h / 2; }
    function removeOne(g, id) {
      if (S.serving) return;
      const list = S.toks.filter((t) => t.id === id && (t.st === 'on' || t.st === 'fly'));
      const t = list[list.length - 1];
      if (!t) return;
      sendOut(t); g.sfx('flip'); S.idle = 0; S.serveQ = false;
    }
    function undo(g) {
      if (S.serving) return;
      S.serveQ = false;
      const on = onTray();
      if (on.length) { sendOut(on[on.length - 1]); g.sfx('flip'); }
    }
    function clearTray(g) {
      if (S.serving) return;
      S.serveQ = false;
      const on = onTray();
      if (!on.length) return;
      on.forEach(sendOut); S.trashP = 1; g.sfx('whoosh'); S.idle = 0;
    }
    function dumpTray(g) { onTray().forEach(sendOut); }
    function serve(g) {
      const cu = S.cur;
      S.idle = 0;
      if (S.serving) return;
      if (!cu || (cu.st !== 'wait' && cu.st !== 'ask')) { S.labels.push({ s: '客人还没来', x: L.serve.x + L.serve.w / 2, y: L.serve.y - 10 * L.k, t: 0 }); return; }
      if (cu.chgDone && S.t - (cu.chgT || 0) < 1) { S.labels.push({ s: '等等，客人改单了！', x: L.serve.x + L.serve.w / 2, y: L.serve.y - 10 * L.k, t: 0 }); g.sfx('tick'); return; }
      const on = onTray();
      if (!on.length) { S.trayShk = 1; g.sfx('tick'); S.labels.push({ s: '托盘是空的！', x: L.tray.x + L.tray.w / 2, y: L.tray.y, t: 0 }); return; }
      // 改单的客人：手快的孩子在改单之前就上菜，也要先听到“哎呀，我改一下”（改单关每一单都真的要读改单那一句）
      if (cu.item.chg && !cu.chgDone) { applyChange(g, cu); S.labels.push({ s: '等等，客人改单了！', x: L.serve.x + L.serve.w / 2, y: L.serve.y - 10 * L.k, t: 0 }); return; }
      if (on.some((t) => t.st === 'fly')) { S.serveQ = true; return; }   // 还在飞：落到托盘上就自动上菜（不吞掉这一下）
      S.serveQ = false;
      S.serving = { t: 0, judged: false, back: '' };
      S.serveP = 1;
      g.sfx('swing');
    }
    function judgeNow(g) {
      const cu = S.cur;
      const on = onTray();
      if (!cu || !on.length) { S.serving.back = 'return'; return; }
      const res = judge(cu.want, cu.seq, on);
      const hx = cu.x, hy = L.headY + 10 * L.k;
      if (res.ok) {
        S.serving.back = 'clear';
        cu.st = 'yum'; cu.t = 0;
        g.tween(cu, { jy: 26 }, 0.18, 'outQuad', () => g.tween(cu, { jy: 0 }, 0.32, 'outBounce'));
        on.forEach((t, i) => { t.st = 'eat'; t.t = -i * 0.05; t.x0 = t.x; t.y0 = t.y; t.tx = hx; t.ty = hy; });
        const frac = clamp(cu.pat / cu.pmax, 0, 1);
        const tip = Math.max(2, Math.round((5 + 15 * frac) * (cu.vip ? 2 : 1) / (1 + cu.wrongN)));
        g.right(cu.item, hx, hy - 20 * L.k);
        g.addScore(tip, hx + 50 * L.k, hy - 40 * L.k);
        for (let i = 0; i < Math.min(8, 2 + Math.round(tip / 4)); i++) S.coinFly.push({ x: hx, y: hy, x0: hx + rnd(-20, 20) * L.k, y0: hy + rnd(-10, 10) * L.k, t: -i * 0.07, d: 0.55 });
        for (let i = 0; i < 6; i++) S.parts.push({ e: '❤️', x: hx + rnd(-30, 30) * L.k, y: hy - 40 * L.k, vx: rnd(-40, 40) * L.k, vy: rnd(-120, -60) * L.k, t: 0, life: 1.1, s: rnd(16, 24) * L.k });
        g.sfx('good');
        g.after(0.35, () => g.sfx('chomp'));
        S.praise = { s: pick(cu.vip ? ['五星好评！', '太好吃了！'] : ['好吃！', '谢谢老板！', '一模一样！', '太棒了！']), t: 1.6 };
        if (S.tut) { S.tut = false; try { ctx.mem.set('tut', 1); } catch (e) { /* ignore */ } }
        g.after(1.35, () => { if (S.cur === cu) leave(g, cu); });
      } else {
        S.serving.back = 'return';
        const cp = complaint(res, cu.want, cu.seq, cu.no);
        const sig = on.filter((t) => DEF(t.id).k === 'scoop').map((t) => t.id).join(',') + '|' + on.filter((t) => DEF(t.id).k !== 'scoop').map((t) => t.id).sort().join(',');
        const junk = sig === cu.lastBad || junkTray(cu.item, cu.want, cu.no, on, cu.tw);
        cu.lastBad = sig;
        const note = ('点单：' + orderText(cu) + '｜' + diagnose(res, cu.want, cu.seq, cu.no)).slice(0, 238);
        cu.wrongN++; cu.madT = 1.8; cu.shk = 1;
        const shout = junk ? '别乱放呀！' + cp.s : cp.s;
        S.shout = { s: shout, t: 3.4 };
        const badIds = new Set(cp.ids);
        res.probs.forEach((pr) => { badIds.add(pr.id); const sb = DEF(pr.id).sib; if (sb) badIds.add(sb); });
        S.bad = { ids: badIds, t: 5 };
        for (let i = 0; i < 5; i++) S.parts.push({ steam: true, x: hx + rnd(-26, 26) * L.k, y: hy - 50 * L.k, vx: rnd(-20, 20) * L.k, vy: rnd(-90, -50) * L.k, t: 0, life: 0.9, s: rnd(8, 14) * L.k });
        cu.pat = Math.min(cu.pmax, cu.pat + 6);
        if (!junk) cu.readWrong++;
        if (!HI && cu.readWrong >= 2) S.glow = new Set(Object.keys(cu.want));   // P2/P3 真读错两次才亮提示（乱放换不来提示）
        // 这一下扣完最后一颗心：结算面板上写出这一单该怎么做、客人哪句话没读懂
        const last = g.lives <= 1;
        const endO = last ? { reveal: answerText(cu.want, cu.seq) + '（客人说：' + cp.s + '）' } : undefined;
        if (junk) { S.junk++; g.hurt(hx, hy, false, endO); }   // 乱放：扣心、降星（见 spec.stars），不进错题本
        else g.wrong(cu.item, note, hx, hy, endO);
        if (AUTO_SAY && g.state === 'play') g.after(0.5, () => say(g, shout), { playOnly: true });
      }
    }
    /* 托盘上的东西排好位置：冰淇淋放在蛋筒上，其余按种类分组、每组最多一排 5 个 */
    function trayLayout() {
      const T = L.tray, k = L.k, off = S.trayOff;
      const ix = T.x + 16 * k, iy = T.y + 10 * k + off, iw = T.w - 32 * k, ih = T.h - 24 * k;
      const on = onTray();
      const sc = [], groups = [], gm = Object.create(null);
      for (const t of on) {
        if (DEF(t.id).k === 'scoop') { sc.push(t); continue; }
        if (!gm[t.id]) { gm[t.id] = { id: t.id, toks: [] }; groups.push(gm[t.id]); }
        gm[t.id].toks.push(t);
      }
      let x0 = ix;
      S.cone = null;
      if (sc.length) {
        // 冰淇淋日托盘上只有蛋筒：放在显眼处（横屏放右边避开气泡；竖屏放右边，别挡住柜台前顾客的脸），球画大
        const alone = groups.length === 0;
        const r = (alone ? Math.min(30 * k, ih * 0.36) : Math.min(21 * k, ih * 0.3)) * Math.min(1, 3.4 / Math.max(3.4, sc.length));   // 球多了就缩小，别叠出画面
        const cx = alone ? (L.land ? ix + iw - 80 * k : ix + iw * 0.72) : ix + 30 * k, coneTop = iy + ih * (alone ? 0.36 : 0.46);
        sc.forEach((t, i) => { t.tx = cx; t.ty = coneTop - r * 0.35 - i * r * 1.25; t.s = r / 0.36; });
        S.cone = { x: cx, y: coneTop, r, n: sc.length, hit: { x: cx - r * 1.6, y: coneTop - r * 1.25 * sc.length - r, w: r * 3.2, h: r * 1.25 * sc.length + r + ih * 0.6 } };
        if (!alone) x0 += 72 * k;
      }
      const big = (id) => DEF(id).k === 'dish' ? 1.28 : 1;
      const gw = (gp, s) => { const s1 = s * big(gp.id), per = Math.min(gp.toks.length, 5); return s1 + s1 * 0.56 * (per - 1); };
      const rowsOf = (gp) => Math.ceil(gp.toks.length / 5);
      const room = ix + iw - x0, gapX = 12 * k, gapY = 4 * k;
      const lineW = (arr, s) => arr.reduce((a, gp) => a + gw(gp, s), 0) + Math.max(0, arr.length - 1) * gapX;
      const lineH = (arr, s) => arr.reduce((a, gp) => Math.max(a, s * big(gp.id) * (1 + 0.5 * (rowsOf(gp) - 1))), 0);
      // 一排放不下就分成两排（孩子把每样都点了三下，托盘也不会溢出到小费罐上）
      const split = (s) => {
        const all = lineW(groups, s);
        if (all <= room || groups.length < 2) return [groups];
        const a = [], b = []; let wa = 0;
        for (const gp of groups) { if (wa < all / 2 && a.length < groups.length - 1) { a.push(gp); wa += gw(gp, s) + gapX; } else b.push(gp); }
        return [a, b];
      };
      let s = Math.min(ih * 0.8, (L.land ? 72 : 58) * k), lines;   // 横屏托盘很宽：东西画大一点
      for (;;) {
        lines = split(s);
        const hh = lines.reduce((a, ln) => a + lineH(ln, s), 0) + (lines.length - 1) * gapY;
        if ((lines.every((ln) => lineW(ln, s) <= room) && hh <= ih + 6 * k) || s <= 12 * k) break;
        s *= 0.93;
      }
      const hs = lines.map((ln) => lineH(ln, s));
      let top = iy + ih / 2 - (hs.reduce((a, b) => a + b, 0) + (lines.length - 1) * gapY) / 2;
      lines.forEach((ln, li) => {
        const cy = top + hs[li] / 2;
        let x = x0 + Math.max(0, (room - lineW(ln, s)) / 2);
        for (const gp of ln) {
          const s1 = s * big(gp.id), rows = rowsOf(gp), w = gw(gp, s);
          gp.toks.forEach((t, j) => { t.tx = x + s1 / 2 + (j % 5) * s1 * 0.56; t.ty = cy + (Math.floor(j / 5) - (rows - 1) / 2) * s1 * 0.5; t.s = s1; });
          gp.rect = { x: x - 4 * k, y: cy - s1 * (0.5 + 0.25 * (rows - 1)) - 6 * k, w: w + 8 * k, h: s1 * (1 + 0.5 * (rows - 1)) + 12 * k };
          gp.s = s1;
          x += w + gapX;
        }
        top += hs[li] + gapY;
      });
      S.groups = groups;
    }

    /* ---------- 每帧：动画（live=false 时只走动画，不走耐心等逻辑） ---------- */
    function moveCust(cu, dt) {
      const k = L.k, dx = cu.tx - cu.x;
      const sp = (cu.st === 'out' ? 300 : 250) * k;
      if (Math.abs(dx) > 1) {
        const step = Math.sign(dx) * Math.min(Math.abs(dx), sp * dt);
        cu.x += step; cu.ph += Math.abs(step) * 0.075 / k; cu.mv = 1; cu.dir = Math.sign(dx);
      } else { cu.x = cu.tx; cu.mv = 0; }
      cu.y += (cu.ty - cu.y) * Math.min(1, dt * 6);
      cu.sc += (cu.tsc - cu.sc) * Math.min(1, dt * 5);
      if (cu.shk > 0) cu.shk = Math.max(0, cu.shk - dt * 1.6);
      if (cu.hand > 0) cu.hand = Math.max(0, cu.hand - dt);
      if (cu.madT > 0) cu.madT = Math.max(0, cu.madT - dt);
    }
    const HOLD = ['🍜', '🧋', '🍢', '🍧', '🥥', '', '', ''];
    function tickWalkers(g, dt) {
      const k = L.k, s0 = L.land ? 0.5 : 0.42, max = L.land ? 4 : 3;
      S.walkT -= dt;
      if (S.walkT <= 0 && S.walkers.length < max && L.walkFeet) {
        S.walkT = rnd(1.4, 3.2);
        const dir = Math.random() < 0.5 ? 1 : -1, sc = s0 * rnd(0.9, 1.05);
        const x = dir > 0 ? -60 * k : g.w + 60 * k;
        const y = L.walkFeet - 40 * k * sc * L.cs;   // drawCust 的 y 往下还有 40·s 的身体
        S.walkers.push({ face: pick(FACES), shirt: pick(SHIRTS), x, y, tx: x, ty: y, sc, tsc: sc, st: 'out', t: 0, ph: rnd(0, 6), seed: rnd(0, 6), jy: 0, shk: 0, mv: 1, hand: 0, madT: 0, dir, vip: false, pat: 0, pmax: 0, sp: rnd(45, 75) * k, hold: pick(HOLD) });
      }
      for (let i = S.walkers.length - 1; i >= 0; i--) {
        const w = S.walkers[i];
        w.x += w.dir * w.sp * dt; w.ph += w.sp * dt * 0.075 / k;
        if (w.x < -90 * k || w.x > g.w + 90 * k) S.walkers.splice(i, 1);
      }
    }
    function tick(g, dt, live) {
      const k = L.k;
      S.t += dt;
      for (const q of S.queue) moveCust(q, dt);
      for (let i = S.gone.length - 1; i >= 0; i--) { const cu = S.gone[i]; moveCust(cu, dt); if (cu.x < -120 * k) S.gone.splice(i, 1); }
      const cu = S.cur;
      if (cu) {
        moveCust(cu, dt);
        cu.t += dt;
        if (cu.st === 'in' && cu.mv === 0 && Math.abs(cu.x - L.custX) < 2) arrive(g, cu);
        else if (cu.st === 'ask' && cu.t > 0.4) { cu.st = 'wait'; cu.tw = 0; }
        else if (cu.st === 'mad' && cu.t > 1.0) leave(g, cu);
        if (live && cu.st === 'wait') {
          cu.tw += dt;
          if (!g.speaking && !S.serving) cu.pat -= dt;
          if (cu.item.chg && !cu.chgDone && !S.serving && ((onTray().length >= 1 && cu.tw > 4) || cu.pat / cu.pmax < 0.55)) applyChange(g, cu);
          if (AUTO_SAY && !cu.resaid && S.idle > 14 && !g.speaking) { cu.resaid = true; sayOrder(g); }
          if (cu.pat <= 0) walkout(g);
        }
      }
      if (live) S.idle += dt;
      // 格子
      for (const b of S.bins) {
        if (b.delay > 0) b.delay -= dt; else if (b.pop < 1) b.pop = Math.min(1, b.pop + dt * 4);
        if (b.press > 0) b.press = Math.max(0, b.press - dt * 5);
        if (b.shk > 0) b.shk = Math.max(0, b.shk - dt * 2.5);
      }
      if (S.serveP > 0) S.serveP = Math.max(0, S.serveP - dt * 5);
      if (S.trashP > 0) S.trashP = Math.max(0, S.trashP - dt * 5);
      if (S.spkP > 0) S.spkP = Math.max(0, S.spkP - dt * 4);
      if (S.trayShk > 0) S.trayShk = Math.max(0, S.trayShk - dt * 3);
      if (S.chgFlash > 0) S.chgFlash = Math.max(0, S.chgFlash - dt * 0.7);
      if (S.bad.t > 0) S.bad.t -= dt;
      if (S.shout.t > 0) S.shout.t -= dt;
      if (S.praise.t > 0) S.praise.t -= dt;
      if (S.banner.t > 0 && live) S.banner.t -= S.toks.length ? dt * 4 : dt;
      // 上菜动画
      const lift = 34 * k;
      if (S.serving) {
        const sv = S.serving;
        sv.t += dt;
        if (!sv.judged) {
          S.trayOff = -lift * Math.min(1, sv.t / 0.2);
          if (sv.t >= 0.2) { sv.judged = true; sv.t2 = 0; if (live) judgeNow(g); else sv.back = 'return'; }
        } else {
          sv.t2 += dt;
          if (sv.back === 'return') {
            const p = Math.min(1, sv.t2 / 0.45);
            S.trayOff = -lift * (1 - g.ease.outBounce(p));
            if (p >= 1) { S.serving = null; S.trayOff = 0; }
          } else {
            const p = Math.min(1, sv.t2 / 0.5);
            S.trayOff = -lift * (1 - p);
            if (p >= 1) { S.serving = null; S.trayOff = 0; }
          }
        }
      }
      // 托盘上的东西
      trayLayout();
      for (let i = S.toks.length - 1; i >= 0; i--) {
        const t = S.toks[i];
        if (t.st === 'fly') {
          t.t += dt / 0.3;
          const p = Math.min(1, t.t), e = 1 - (1 - p) * (1 - p);
          const cx = (t.x0 + t.tx) / 2, cy = Math.min(t.y0, t.ty) - 70 * k;
          t.x = (1 - e) * (1 - e) * t.x0 + 2 * (1 - e) * e * cx + e * e * t.tx;
          t.y = (1 - e) * (1 - e) * t.y0 + 2 * (1 - e) * e * cy + e * e * t.ty;
          t.sc = lerp(t.s0 / Math.max(1, t.s), 1, e);
          if (p >= 1) {
            t.st = 'on'; t.land = 1;
            const lb = labelOf(t.id);
            if (!S.labels.some((l) => l.s === lb && l.t < 0.45)) S.labels.push({ s: lb, x: t.x, y: t.y - t.s * 0.55, t: 0 });
            for (let j = 0; j < 4; j++) S.parts.push({ dot: '#FFFFFF', x: t.x, y: t.y + t.s * 0.3, vx: rnd(-80, 80) * k, vy: rnd(-60, -10) * k, t: 0, life: 0.35, s: rnd(2, 4) * k });
          }
        } else if (t.st === 'on') {
          t.x += (t.tx - t.x) * Math.min(1, dt * 14); t.y += (t.ty - t.y) * Math.min(1, dt * 14); t.sc = 1;
          if (t.land > 0) t.land = Math.max(0, t.land - dt * 4);
        } else if (t.st === 'out' || t.st === 'eat') {
          t.t += dt / (t.st === 'eat' ? 0.4 : 0.35);
          if (t.t < 0) continue;
          const p = Math.min(1, t.t), e = p * p;
          t.x = lerp(t.x0, t.tx, e); t.y = lerp(t.y0, t.ty, e) - Math.sin(p * Math.PI) * 30 * k;
          t.sc = 1 - p * 0.75;
          if (p >= 1) S.toks.splice(i, 1);
        }
      }
      if (S.serveQ && live && !S.serving && !S.toks.some((t) => t.st === 'fly')) { S.serveQ = false; serve(g); }
      // 背景里来来往往的食客（让小贩中心一直是活的）
      tickWalkers(g, dt);
      // 金币飞进小费罐
      for (let i = S.coinFly.length - 1; i >= 0; i--) {
        const c = S.coinFly[i];
        c.t += dt;
        if (c.t < 0) continue;
        if (c.t >= c.d) { S.coinFly.splice(i, 1); S.coins++; S.jarW = 1; g.sfx('coin'); }
      }
      if (S.jarW > 0) S.jarW = Math.max(0, S.jarW - dt * 3);
      for (let i = S.parts.length - 1; i >= 0; i--) {
        const p = S.parts[i];
        p.t += dt; p.x += p.vx * dt; p.y += p.vy * dt; p.vy += (p.steam ? -20 : p.dot ? 300 : 40) * dt * k;
        if (p.t >= p.life) S.parts.splice(i, 1);
      }
      if (S.parts.length > 80) S.parts.splice(0, S.parts.length - 80);
      for (let i = S.labels.length - 1; i >= 0; i--) { const l = S.labels[i]; l.t += dt; if (l.t > 1.1) S.labels.splice(i, 1); }
    }

    /* ---------- 点单气泡 ---------- */
    const NO_START = '，。！？、；：”’）》…';
    function flow(g, segs, maxW, fs) {
      const lh = fs * 1.42, runs = [];
      let x = 0, line = 0, chgLine = -1;
      for (let si = 0; si < segs.length; si++) {
        const sg = segs[si];
        if (sg.br && x > 0) { x = 0; line++; }
        if (sg.chg && chgLine < 0) chgLine = line;
        // 词语（名称 / 数量 / 语法词）不拆开折行：放不下就整个换到下一行
        if (sg.k !== 'p' && sg.k !== 'c' && x > 0 && sg.s.length <= 8) {
          let sw = 0;
          const nx = segs[si + 1];
          const whole = sg.s + (sg.k === 'q' && nx && nx.k === 'n' && !nx.br ? nx.s : '');   // “两杯”和“奶茶”也尽量在同一行
          for (const ch of whole) sw += g.measure(ch, fs, 'kai');
          if (x + sw > maxW && sw <= maxW) { x = 0; line++; }
        }
        let run = null;
        for (const ch of sg.s) {
          const cw = g.measure(ch, fs, 'kai');
          if (x + cw > maxW && x > 0 && NO_START.indexOf(ch) < 0) { x = 0; line++; run = null; }
          if (!run) { run = { s: '', x, line, k: sg.k, ids: sg.ids, chg: sg.chg, w: 0 }; runs.push(run); }
          run.s += ch; run.w += cw; x += cw;
        }
      }
      return { runs, lines: line + 1, lh, fs, h: (line + 1) * lh, chgLine };
    }
    function bubbleLayout(g, cu) {
      const k = L.k;
      const segs = cu.item.segs.map((s) => ({ s: s[0], k: s[1], ids: s[2] || [], chg: false }));
      if (cu.chgDone && cu.item.chg) cu.item.chg.segs.forEach((s, i) => segs.push({ s: s[0], k: s[1], ids: s[2] || [], chg: true, br: i === 0 }));
      const bx = L.land ? Math.max(L.pad + 20 * k, L.custX - 70 * k * L.cs - 720 * k) : L.pad, bw = L.land ? Math.min(L.custX - 70 * k * L.cs - bx, 720 * k) : g.w - L.pad * 2;
      const padX = 18 * k, padY = 12 * k, strip = 18 * k;
      const maxW = bw - padX * 2 - 26 * k;
      const minY = L.top + 28 * k, maxBot = L.land ? L.cTop - 40 * k : L.headTop - 16 * k;
      let fs = L.fs, lay;
      for (;;) { lay = flow(g, segs, maxW, fs); if (lay.h + padY * 2 + strip <= maxBot - minY || fs <= 15 * k) break; fs -= 1.5 * k; }
      const bh = lay.h + padY * 2 + strip;
      const by = L.land ? clamp(L.headY - bh / 2, minY, Math.max(minY, maxBot - bh)) : Math.max(minY, maxBot - bh);
      const sr = 22 * k;
      cu.bl = { x: bx, y: by, w: bw, h: bh, padX, padY, lay, spk: { x: Math.min(bx + bw - 8 * k, g.w - sr - 6 * k), y: by + 6 * k, r: sr } };
      return cu.bl;
    }
    function drawBubble(g, c) {
      const cu = S.cur;
      if (!cu || !cu.item || cu.bub <= 0.01 || (cu.st !== 'ask' && cu.st !== 'wait' && cu.st !== 'yum')) { S.spk = null; S.bubR = null; return; }
      const k = L.k, B = cu.bl || bubbleLayout(g, cu), lay = B.lay;
      const hx = cu.x, hy = L.headTop + 6 * k;
      const tailX = clamp(hx, B.x + 30 * k, B.x + B.w - 30 * k);
      c.save();
      const sc = clamp(cu.bub, 0, 1.2);
      const ax = L.land ? B.x + B.w : tailX, ay = L.land ? clamp(L.headY, B.y, B.y + B.h) : B.y + B.h;
      c.translate(ax, ay); c.scale(sc, sc); c.translate(-ax, -ay);
      // 尾巴 + 身体
      const side = L.land;   // 横屏：尾巴从气泡右边指向顾客的脸
      const ty = clamp(L.headY, B.y + 22 * k, B.y + B.h - 22 * k), px = hx - 34 * k * L.cs, py = L.headY;
      const tail = (inset) => {
        c.beginPath();
        if (side) { c.moveTo(B.x + B.w - 6 * k, ty - 16 * k + inset); c.lineTo(B.x + B.w - 6 * k, ty + 16 * k - inset); c.lineTo(px - inset * 1.5, py); }
        else { c.moveTo(tailX - 16 * k + inset, B.y + B.h - 4 * k - inset * 0.4); c.lineTo(tailX + 16 * k - inset, B.y + B.h - 4 * k - inset * 0.4); c.lineTo(hx, hy + 3 * k - inset * 1.2); }
        c.closePath(); c.fill();
      };
      c.fillStyle = NAVY; tail(0);
      rr(c, B.x, B.y + 5 * k, B.w, B.h, 20 * k); c.fillStyle = 'rgba(29,43,83,.35)'; c.fill();
      rr(c, B.x, B.y, B.w, B.h, 20 * k); c.fillStyle = CREAM; c.fill(); c.lineWidth = 3.5 * k; c.strokeStyle = NAVY; c.stroke();
      c.fillStyle = CREAM; tail(5 * k);
      const ox = B.x + B.padX, oy = B.y + B.padY;
      // 改单那几行：橙色底
      if (lay.chgLine >= 0) {
        const yy = oy + lay.chgLine * lay.lh - 3 * k;
        rr(c, B.x + 8 * k, yy, B.w - 16 * k, (lay.lines - lay.chgLine) * lay.lh + 6 * k, 12 * k);
        c.fillStyle = S.chgFlash > 0 && Math.sin(S.t * 18) > 0 ? '#FFD8A8' : '#FFF0D9'; c.fill();
      }
      // 标红（上错菜时，违反的那一句）
      const badOn = S.bad.t > 0;
      for (const r of lay.runs) {
        const bad = badOn && r.ids.some((id) => S.bad.ids.has(id));
        if (bad) { c.globalAlpha = 0.35 + 0.25 * Math.sin(S.t * 8); rr(c, ox + r.x - 2 * k, oy + r.line * lay.lh + 2 * k, r.w + 4 * k, lay.lh - 4 * k, 6 * k); c.fillStyle = '#FF6B6B'; c.fill(); c.globalAlpha = 1; }
      }
      for (const r of lay.runs) {
        const col = r.chg && (r.k === 'p' || r.k === 'c') ? COL.c : COL[r.k] || NAVY;
        g.text(r.s, ox + r.x, oy + r.line * lay.lh + lay.lh / 2, { size: Math.round(lay.fs), font: 'kai', color: col, align: 'left' });
        if (r.k === 'q' || r.k === 'neg' || r.k === 'g') { c.fillStyle = col; c.globalAlpha = 0.5; c.fillRect(ox + r.x, oy + r.line * lay.lh + lay.lh * 0.86, r.w, Math.max(1.5, 2 * k)); c.globalAlpha = 1; }
      }
      // 耐心条
      const fr = cu.pmax > 0 ? clamp(cu.pat / cu.pmax, 0, 1) : 1;
      const sx = B.x + B.padX, sy = B.y + B.h - 14 * k, sw = B.w - B.padX * 2, sh = 8 * k;
      rr(c, sx, sy, sw, sh, sh / 2); c.fillStyle = 'rgba(29,43,83,.15)'; c.fill();
      if (fr > 0.01) {
        const col = fr > 0.55 ? '#40C057' : fr > 0.28 ? '#FAB005' : (Math.sin(S.t * 12) > 0 ? '#FA5252' : '#FF8787');
        rr(c, sx, sy, sw * fr, sh, sh / 2); c.fillStyle = col; c.fill();
      }
      c.restore();
      // 喇叭按钮（没有中文朗读就不画，免得点了没反应）
      S.bubR = B;
      if (!ttsOk(g)) { S.spk = null; return; }
      const sp = B.spk, pr = 1 + 0.15 * (S.spkP || 0) + (g.speaking ? 0.06 * Math.sin(S.t * 10) : 0);
      c.fillStyle = NAVY; c.beginPath(); c.arc(sp.x, sp.y + 3 * k, sp.r * pr, 0, TAU); c.fill();
      c.fillStyle = '#FFE066'; c.beginPath(); c.arc(sp.x, sp.y, sp.r * pr, 0, TAU); c.fill();
      c.lineWidth = 3 * k; c.strokeStyle = NAVY; c.stroke();
      g.emoji('🔊', sp.x, sp.y, sp.r * 1.15);
      S.spk = sp;
    }
    function drawShout(g, c) {
      const k = L.k, cu = S.cur;
      const sh = S.shout.t > 0 ? S.shout : S.praise.t > 0 ? S.praise : null;
      if (!sh || !(cu || S.gone.length)) return;
      const who = cu || S.gone[S.gone.length - 1];
      const good = sh === S.praise;
      const a = clamp(Math.min(sh.t / 0.25, 1), 0, 1);
      const fs = Math.round(21 * k);
      const x0 = who.x + 46 * k * L.cs, maxW = Math.max(120 * k, g.w - L.pad - x0 - 24 * k);
      const lines = g.wrapText(sh.s, maxW, fs, 'kai');
      const tw = Math.max(...lines.map((l) => g.measure(l, fs, 'kai')));
      const bw = tw + 24 * k, bh = lines.length * fs * 1.35 + 16 * k;
      const bx = Math.min(x0, g.w - L.pad - bw), by = L.headTop - 4 * k;
      c.globalAlpha = a;
      rr(c, bx, by + 4 * k, bw, bh, 14 * k); c.fillStyle = 'rgba(29,43,83,.35)'; c.fill();
      rr(c, bx, by, bw, bh, 14 * k); c.fillStyle = good ? '#EBFBEE' : '#FFF5F5'; c.fill(); c.lineWidth = 3 * k; c.strokeStyle = good ? '#2B8A3E' : '#E03131'; c.stroke();
      lines.forEach((l, i) => g.text(l, bx + 12 * k, by + 8 * k + fs * 0.68 + i * fs * 1.35, { size: fs, font: 'kai', color: good ? '#2B8A3E' : '#C92A2A', align: 'left' }));
      c.globalAlpha = 1;
    }

    /* ---------- 场景 ---------- */
    const FAR_ICON = ['🍜', '🍢', '🥥', '🍧', '🍚', '🦐', '🧋', '🥟'];
    function drawScene(g, c) {
      const k = L.k, t = S.t;
      if (BG.cv) c.drawImage(BG.cv, 0, 0, g.w, g.h);
      // 远处小摊的招牌 + 热气
      for (const f of S.farStalls || []) {
        g.emoji(FAR_ICON[f.i % FAR_ICON.length], f.x, f.y, 14 * k);
        if (f.big > 20 * k) g.emoji(FAR_ICON[f.i % FAR_ICON.length], f.x, f.iy + 6 * k, f.big, { alpha: 0.5 });
        if (f.i % 2 === 0) for (let j = 0; j < 3; j++) {
          const ph = (t * 0.45 + j / 3 + f.i * 0.37) % 1;
          c.globalAlpha = (1 - ph) * 0.5; c.fillStyle = '#FFFFFF';
          c.beginPath(); c.arc(f.x + Math.sin(ph * 6 + j) * 6 * k, f.iy - ph * 40 * k, (5 + ph * 8) * k, 0, TAU); c.fill();
        }
      }
      c.globalAlpha = 1;
      // 天花板吊扇（新加坡小贩中心的标志；横屏墙上空出来的地方才画），一直在转
      const fTop = L.top + 40 * k;
      if (L.fanBot - fTop >= 90 * k) {
        const hy = fTop + (L.fanBot - fTop) * 0.5, R = Math.min(78 * k, g.w * 0.07);
        for (const fx of [g.w * 0.2, g.w * 0.8]) {
          c.strokeStyle = '#4A5568'; c.lineWidth = 4 * k; c.lineCap = 'round';
          c.beginPath(); c.moveTo(fx, fTop); c.lineTo(fx, hy); c.stroke();
          for (let i = 0; i < 3; i++) {
            const a = t * 5 + i * TAU / 3, ex = fx + Math.cos(a) * R, ey = hy + Math.sin(a) * R * 0.26;
            c.strokeStyle = 'rgba(29,43,83,.35)'; c.lineWidth = 13 * k; c.beginPath(); c.moveTo(fx, hy + 3 * k); c.lineTo(ex, ey + 3 * k); c.stroke();
            c.strokeStyle = '#7B8794'; c.lineWidth = 11 * k; c.beginPath(); c.moveTo(fx, hy); c.lineTo(ex, ey); c.stroke();
          }
          c.fillStyle = '#2D3748'; c.beginPath(); c.ellipse(fx, hy, 11 * k, 7 * k, 0, 0, TAU); c.fill();
          c.fillStyle = '#A0AEC0'; c.beginPath(); c.ellipse(fx, hy - 2 * k, 6 * k, 3 * k, 0, 0, TAU); c.fill();
        }
      }
      // 背景食客（小一号、在排队的顾客后面）
      for (const w of S.walkers) {
        drawCust(g, c, w, k, t);
        if (w.hold) g.emoji(w.hold, w.x + w.dir * 30 * k * w.sc * L.cs, w.y - 30 * k * w.sc * L.cs + Math.sin(w.ph) * 2 * k, 30 * k * w.sc * L.cs);
      }
      // 顾客
      for (let i = S.queue.length - 1; i >= 0; i--) drawCust(g, c, S.queue[i], k, t);
      for (const cu of S.gone) drawCust(g, c, cu, k, t);
      if (S.cur) drawCust(g, c, S.cur, k, t);
      if (BG.fg) c.drawImage(BG.fg, 0, 0, g.w, g.h);
      // 灯笼（挂在雨棚下）
      const ay = L.top + 58 * k;
      const nL = L.land ? 5 : 3;
      for (let i = 0; i < nL; i++) {
        const lx = g.w * (i + 0.5) / nL + (L.land ? 0 : (i === 1 ? 0 : 0)), sw = Math.sin(t * 1.6 + i * 1.3) * 0.12;
        if (!L.land && i === 1) continue;
        c.save(); c.translate(lx, ay - 16 * k); c.rotate(sw);
        c.strokeStyle = NAVY; c.lineWidth = 2 * k; c.beginPath(); c.moveTo(0, 0); c.lineTo(0, 10 * k); c.stroke();
        c.fillStyle = '#E8403A'; c.beginPath(); c.ellipse(0, 22 * k, 13 * k, 12 * k, 0, 0, TAU); c.fill();
        c.lineWidth = 2 * k; c.strokeStyle = NAVY; c.stroke();
        c.fillStyle = '#FFD43B'; c.fillRect(-6 * k, 9 * k, 12 * k, 3 * k); c.fillRect(-6 * k, 32 * k, 12 * k, 3 * k);
        c.strokeStyle = '#FFD43B'; c.beginPath(); c.moveTo(0, 35 * k); c.lineTo(0, 44 * k); c.stroke();
        c.restore();
      }
      // 招牌
      const sw2 = 150 * k, sx = g.w / 2 - sw2 / 2, sy = L.top + 2 * k;
      rr(c, sx, sy + 3 * k, sw2, 32 * k, 10 * k); c.fillStyle = NAVY; c.fill();
      rr(c, sx, sy, sw2, 32 * k, 10 * k); c.fillStyle = '#C92A2A'; c.fill(); c.lineWidth = 2.5 * k; c.strokeStyle = '#FFD43B'; c.stroke();
      g.text(THEME_ICON[S.cfg.th] + ' 华文小吃店', g.w / 2, sy + 17 * k, { size: Math.round(18 * k), font: 'round', color: '#FFE066', maxW: sw2 - 12 * k });
      // 走掉的客人
      if (S.walk > 0) for (let i = 0; i < 3; i++) g.emoji(i < S.walk ? '😤' : '🙂', L.pad + 14 * k + i * 26 * k, L.top + 70 * k, 22 * k, { alpha: i < S.walk ? 1 : 0.35 });
    }
    function drawTray(g, c) {
      const k = L.k, T = L.tray, off = S.trayOff + (S.trayShk > 0 ? Math.sin(S.t * 50) * 4 * k * S.trayShk : 0);
      const x = T.x, y = T.y + off, w = T.w, h = T.h;
      rr(c, x, y + 6 * k, w, h, 18 * k); c.fillStyle = 'rgba(29,43,83,.35)'; c.fill();
      rr(c, x, y, w, h, 18 * k); c.fillStyle = '#B7793F'; c.fill(); c.lineWidth = 3 * k; c.strokeStyle = NAVY; c.stroke();
      rr(c, x + 9 * k, y + 8 * k, w - 18 * k, h - 18 * k, 12 * k); c.fillStyle = '#D9A066'; c.fill();
      c.strokeStyle = 'rgba(140,80,30,.25)'; c.lineWidth = 2 * k;
      for (let i = 1; i < 4; i++) { c.beginPath(); c.moveTo(x + 14 * k, y + 8 * k + (h - 18 * k) * i / 4); c.lineTo(x + w - 14 * k, y + 8 * k + (h - 18 * k) * i / 4); c.stroke(); }
      if (S.cone) drawCone(c, S.cone.x, S.cone.y + off - S.trayOff, S.cone.r * 1.9, S.cone.r * 2.4);
      // 空托盘提示：点下面的格子
      if (!onTray().length && S.cur && S.cur.st === 'wait' && S.banner.t <= 0) g.text('👇 点下面的食材', x + w / 2, y + h / 2 - 4 * k, { size: Math.round(19 * k), font: 'kai', color: 'rgba(90,50,20,.55)' });
      // 分组计数
      for (const gp of S.groups || []) {
        const n = gp.toks.length;
        if (n < 2) continue;
        const bx = gp.rect.x + gp.rect.w - 6 * k, by = gp.rect.y + 8 * k;
        c.fillStyle = NAVY; c.beginPath(); c.arc(bx, by + 2 * k, 13 * k, 0, TAU); c.fill();
        c.fillStyle = '#FF922B'; c.beginPath(); c.arc(bx, by, 13 * k, 0, TAU); c.fill();
        g.text('×' + n, bx, by + 1 * k, { size: Math.round(14 * k), font: 'num', color: '#FFFFFF' });
      }
      // 小费罐
      const J = L.jar, jw = 1 + 0.08 * Math.sin(S.jarW * 20) * S.jarW;
      c.save(); c.translate(J.x + J.w / 2, J.y + J.h); c.scale(jw, 1 / jw); c.translate(-(J.x + J.w / 2), -(J.y + J.h));
      rr(c, J.x, J.y, J.w, J.h, 12 * k); c.fillStyle = 'rgba(210,240,255,.55)'; c.fill(); c.lineWidth = 3 * k; c.strokeStyle = NAVY; c.stroke();
      const fillH = Math.min(1, S.coins / 30) * (J.h - 12 * k);
      if (fillH > 0) { rr(c, J.x + 5 * k, J.y + J.h - 6 * k - fillH, J.w - 10 * k, fillH, 7 * k); c.fillStyle = '#FFC928'; c.fill(); c.fillStyle = 'rgba(255,255,255,.4)'; c.fillRect(J.x + 9 * k, J.y + J.h - 6 * k - fillH, 5 * k, fillH); }
      rr(c, J.x - 3 * k, J.y - 6 * k, J.w + 6 * k, 10 * k, 4 * k); c.fillStyle = '#E8590C'; c.fill(); c.lineWidth = 2 * k; c.stroke();
      c.fillStyle = 'rgba(255,255,255,.55)'; c.fillRect(J.x + J.w - 12 * k, J.y + 8 * k, 4 * k, J.h * 0.5);
      c.restore();
      g.text('小费', J.x + J.w / 2, J.y + J.h * 0.42, { size: Math.round(16 * k), font: 'kai', color: NAVY });
    }
    function drawToks(g, c, flying) {
      for (const t of S.toks) {
        if ((t.st === 'fly' || t.st === 'out' || t.st === 'eat') !== flying) continue;
        if (t.t < 0) continue;
        const sq = t.land > 0 ? 1 + 0.25 * Math.sin(t.land * Math.PI) : 1;
        c.save(); c.translate(t.x, t.y); c.scale(sq, 2 - sq);
        drawThing(g, c, t.id, 0, 0, t.s * t.sc);
        c.restore();
      }
    }
    function drawBins(g, c) {
      const k = L.k;
      S.bins.forEach((b, i) => {
        if (b.pop <= 0) return;
        const cx = b.x + b.w / 2, cy = b.y + b.h / 2;
        const sc = outBack(b.pop) * (1 - 0.12 * b.press);
        const shx = b.shk > 0 ? Math.sin(S.t * 60) * 6 * k * b.shk : 0;
        c.save(); c.translate(cx + shx, cy); c.scale(sc, sc);
        const glow = (S.glow && S.glow.has(b.id)) || (S.tutBin === b.id);
        if (glow) { c.lineWidth = 6 * k; c.strokeStyle = 'rgba(255,212,59,' + (0.55 + 0.45 * Math.sin(S.t * 8)) + ')'; rr(c, -b.w / 2 - 5 * k, -b.h / 2 - 5 * k, b.w + 10 * k, b.h + 10 * k, 20 * k); c.stroke(); }
        drawThing(g, c, b.id, 0, 2 * k + Math.sin(S.t * 2 + i) * 1.2 * k, b.w * 0.62);
        // 热腾腾：主食格子一直冒热气（等单的时候画面也是活的）
        if (DEF(b.id).k === 'dish' && !b.sold) {
          c.fillStyle = '#FFFFFF';
          for (let j = 0; j < 3; j++) {
            const ph = (S.t * 0.55 + j / 3 + i * 0.21) % 1;
            c.globalAlpha = (1 - ph) * 0.6 * Math.min(1, ph * 5);
            c.beginPath(); c.arc(Math.sin(ph * 5 + j * 2) * 6 * k, -b.h * 0.12 - ph * b.h * 0.38, (3 + ph * 7) * k, 0, TAU); c.fill();
          }
          c.globalAlpha = 1;
        }
        if (b.sold) {
          c.fillStyle = 'rgba(80,90,110,.55)'; rr(c, -b.w / 2, -b.h / 2, b.w, b.h, 16 * k); c.fill();
          c.save(); c.rotate(-0.25);
          rr(c, -b.w * 0.44, -14 * k, b.w * 0.88, 28 * k, 6 * k); c.fillStyle = '#FFF5F5'; c.fill(); c.lineWidth = 3 * k; c.strokeStyle = '#E03131'; c.stroke();
          g.text('卖完了', 0, 1 * k, { size: Math.round(Math.min(19 * k, b.w * 0.2)), font: 'kai', color: '#E03131', maxW: b.w * 0.8 });
          c.restore();
        }
        if (L.land && i < 10) {   // 键盘 1–9，第 10 格是 0
          c.fillStyle = 'rgba(29,43,83,.75)'; c.beginPath(); c.arc(-b.w / 2 + 14 * k, -b.h / 2 + 14 * k, 10 * k, 0, TAU); c.fill();
          g.text(String((i + 1) % 10), -b.w / 2 + 14 * k, -b.h / 2 + 14.5 * k, { size: Math.round(13 * k), font: 'num', color: '#FFFFFF' });
        }
        c.restore();
      });
    }
    function btn3d(g, c, r, col, dcol, label, press, dis) {
      const k = L.k, dy = press * 5 * k;
      c.globalAlpha = dis ? 0.55 : 1;
      rr(c, r.x, r.y + 6 * k, r.w, r.h - 6 * k, 18 * k); c.fillStyle = NAVY; c.fill();
      rr(c, r.x, r.y + dy, r.w, r.h - 6 * k, 18 * k); c.fillStyle = dis ? '#ADB5BD' : col; c.fill(); c.lineWidth = 3.5 * k; c.strokeStyle = NAVY; c.stroke();
      rr(c, r.x + 6 * k, r.y + dy + 4 * k, r.w - 12 * k, (r.h - 6 * k) * 0.4, 12 * k); c.fillStyle = 'rgba(255,255,255,.3)'; c.fill();
      rr(c, r.x, r.y + dy + (r.h - 6 * k) - 8 * k, r.w, 8 * k, 6 * k); c.fillStyle = dis ? 'rgba(0,0,0,.1)' : dcol; c.globalAlpha *= 0.6; c.fill(); c.globalAlpha = dis ? 0.55 : 1;
      g.text(label, r.x + r.w / 2, r.y + dy + (r.h - 6 * k) / 2, { size: Math.round(Math.min(26 * k, r.h * 0.42)), font: 'round', color: '#FFFFFF', stroke: NAVY, strokeW: 4 * k, maxW: r.w - 16 * k });
      c.globalAlpha = 1;
    }
    function drawButtons(g, c) {
      const cu = S.cur, n = onTray().length;
      const ready = !!cu && (cu.st === 'wait' || cu.st === 'ask') && n > 0 && !S.serving;
      const pulse = ready ? 1 + 0.03 * Math.sin(S.t * 6) : 1;
      const r = L.serve;
      c.save(); c.translate(r.x + r.w / 2, r.y + r.h / 2); c.scale(pulse, pulse); c.translate(-(r.x + r.w / 2), -(r.y + r.h / 2));
      btn3d(g, c, r, '#37B24D', '#2B8A3E', '🔔 上菜！', S.serveP, !ready);
      c.restore();
      btn3d(g, c, L.trash, '#FF8787', '#E03131', '🗑️', S.trashP, n === 0);
    }
    function drawFx(g, c) {
      const k = L.k;
      for (const p of S.parts) {
        const a = 1 - p.t / p.life;
        if (p.e) g.emoji(p.e, p.x, p.y, p.s, { alpha: a });
        else { c.globalAlpha = a * (p.steam ? 0.7 : 1); c.fillStyle = p.steam ? '#FFFFFF' : p.dot; c.beginPath(); c.arc(p.x, p.y, p.s * (p.steam ? 1 + p.t : 1), 0, TAU); c.fill(); c.globalAlpha = 1; }
      }
      const J = L.jar;
      for (const cf of S.coinFly) {
        if (cf.t < 0) continue;
        const p = cf.t / cf.d, e = p * p * (3 - 2 * p);
        const tx = J.x + J.w / 2, ty = J.y + 10 * k;
        const x = lerp(cf.x0, tx, e), y = lerp(cf.y0, ty, e) - Math.sin(p * Math.PI) * 80 * k;
        c.fillStyle = '#9A5B0E'; c.beginPath(); c.arc(x, y + 1.5 * k, 10 * k, 0, TAU); c.fill();
        c.fillStyle = '#FFD43B'; c.beginPath(); c.ellipse(x, y, 10 * k * Math.abs(Math.cos(cf.t * 12)) + 2 * k, 10 * k, 0, 0, TAU); c.fill();
      }
      for (const l of S.labels) {
        const p = l.t / 1.1, a = p > 0.7 ? (1 - p) / 0.3 : 1;
        g.text(l.s, l.x, l.y - p * 34 * k, { size: Math.round((l.big ? 26 : 19) * k), font: 'kai', color: l.big ? '#FFE066' : '#FFFFFF', stroke: NAVY, strokeW: 4 * k, alpha: a });
      }
    }
    function drawBanner(g, c) {
      const k = L.k;
      if (S.banner.t > 0) {
        const t = S.banner.t, a = clamp(t / 0.4, 0, 1), s = t > 2.0 ? outBack(clamp((2.4 - t) / 0.4, 0, 1)) : 1;
        const cy = L.tray.y + L.tray.h / 2, cx = L.tray.x + L.tray.w / 2;
        c.save(); c.globalAlpha = a; c.translate(cx, cy); c.scale(s, s);
        const bw = Math.min(300 * k, L.tray.w - 16 * k);
        rr(c, -bw / 2, -32 * k, bw, 64 * k, 22 * k); c.fillStyle = 'rgba(29,43,83,.88)'; c.fill();
        g.text(THEME_ICON[S.cfg.th] + ' ' + S.banner.s, 0, 0, { size: Math.round(28 * k), font: 'kai', color: '#FFE066', maxW: bw - 24 * k });   // 横幅里有菜名：用楷体（快乐体会把字形写歪）
        c.restore();
      }
      // 第一次玩：手指教学
      if (S.tut && S.cur && S.cur.st === 'wait' && g.state === 'play') {
        let tx, ty, txt;
        // 手指一直指着还差的那一样，点够了份数才指“上菜”（“两条薄饼”点了一条就指上菜，会把孩子领去做错）；多放了就指垃圾桶
        const res = judge(S.cur.want, S.cur.seq, onTray());
        const lack = res.probs.find((p) => p.got < p.want);
        S.tutBin = null;
        if (res.ok) { if (S.idle > 1.2) { tx = L.serve.x + L.serve.w * 0.88; ty = L.serve.y + L.serve.h * 0.45; txt = '做好了就上菜'; } }
        else if (lack && !res.probs.some((p) => p.got > p.want)) {
          const b = S.bins.find((x) => x.id === lack.id);
          S.tutBin = lack.id;
          if (b) { tx = b.x + b.w * 0.72; ty = b.y + b.h * 0.66; txt = ''; }   // “点下面的食材”托盘上已经写着，手指就够了
        } else if (S.idle > 1.2) { tx = L.trash.x + L.trash.w * 0.6; ty = L.trash.y + L.trash.h * 0.45; txt = '放错了就倒掉'; }
        if (tx != null) {
          // 手指画在目标里面（不伸到下一排格子或“上菜”键上，免得和按钮上的字叠在一起）；字写在柜台红边上
          const bob = Math.abs(Math.sin(S.t * 5)) * 10 * k;
          g.emoji('👆', tx, ty + bob, 44 * k);
          if (txt) g.text(txt, clamp(tx, 80 * k, g.w - 80 * k), (L.trayB + L.wsTop) / 2 + 2 * k, { size: Math.round(18 * k), font: 'kai', color: '#FFFFFF', stroke: NAVY, strokeW: 4 * k });
        }
      } else S.tutBin = null;
    }

    /* ---------- 输入 ---------- */
    function hitR(p, r) { return !!r && p.x >= r.x && p.x <= r.x + r.w && p.y >= r.y && p.y <= r.y + r.h; }
    function whatAt(p) {
      if (S.spk && Math.hypot(p.x - S.spk.x, p.y - S.spk.y) <= S.spk.r + 8 * L.k) return ['spk'];
      if (hitR(p, L.serve)) return ['serve'];
      if (hitR(p, L.trash)) return ['trash'];
      for (let i = 0; i < S.bins.length; i++) { const b = S.bins[i]; if (hitR(p, { x: b.x - 4, y: b.y - 4, w: b.w + 8, h: b.h + 8 })) return ['bin', i]; }
      if (S.cone && S.cone.n && hitR(p, S.cone.hit)) return ['cone'];
      for (const gp of S.groups || []) if (hitR(p, gp.rect)) return ['grp', gp.id];
      if (S.bubR && S.spk && hitR(p, S.bubR)) return ['spk'];
      return null;
    }

    const spec = {
      name: '华文小吃店', icon: '🍜',
      maxLevel: 10, lives: 3, music: 'bright', sky: 'day',
      rounds: (lv) => (LVS[clamp(lv, 1, 10)] || LVS[1]).rounds,
      // 星级 = 做对的单 / (做对 + 读错 + 乱放)：乱放不进错题本，但不能白送三星
      stars(g, win) { if (!S || !S.junk || !win) return null; const r = g.done / (g.done + g.wrongs + S.junk); return r >= 0.9 ? 3 : r >= 0.6 ? 2 : r >= 0.3 ? 1 : 0; },
      intro: HI ? '读懂顾客的点单，做出一模一样的菜！小心“不要”“除了”“一半”和改单！' : '听顾客点单，做出一模一样的菜！',
      controls: '点食材放上托盘 · 点托盘上的食物拿掉 · 做好按“上菜” · 键盘：数字键选食材 / Enter 上菜 / 空格重听 / ⌫ 拿掉',
      init(g) {
        g.sky = null;
        const cfg = LVS[clamp(g.level, 1, 10)] || LVS[1];
        const pool = readMenu(ctx.grade);
        let tut = false;
        try { tut = g.level === 1 && !ctx.mem.get('tut') && !g.isReview; } catch (e) { tut = false; }
        S = {
          cfg, pool, bins: [], dayBins: [], gen: null, rev: null, t: 0,
          cur: null, queue: [], gone: [], walk: 0, junk: 0,
          toks: [], groups: [], cone: null, trayOff: 0, trayShk: 0, serving: null, coins: 0, coinFly: [], jarW: 0, parts: [], labels: [],
          shout: { s: '', t: 0 }, praise: { s: '', t: 0 }, bad: { ids: new Set(), t: 0 }, banner: { s: THEME_NAME[cfg.th] || '', t: 2.4 },
          idle: 0, tut, tutBin: null, glow: null, chgFlash: 0, serveP: 0, trashP: 0, spkP: 0, spk: null, bubR: null, pendingSay: false,
          lastDraw: 0, farStalls: [], serveQ: false, walkers: [], walkT: 0.6
        };
        if (g.isReview) {
          const list = g.items('stall', 20).filter(validItem);
          if (list.length) { S.rev = list.slice(); g.rounds = Math.max(1, Math.min(g.rounds, list.length)); S.banner.s = '错题重练'; }
        }
        S.dayBins = makeBins(cfg, pool, HI);
        if (cfg.th === 'hawker' && !S.rev) {   // “今天卖鱼圆面和豆花！”：开张横幅就用今天的菜名（红豆冰不是“饭和面”）
          const ds = S.dayBins.filter((id) => DEF(id).k === 'dish').map((id) => DEF(id).n);
          if (ds.length) S.banner.s = '今天卖' + ds.join('和') + '！';
        }
        S.gen = makeGen(cfg, S.dayBins, HI);
        S.bins = S.dayBins.map((id, i) => ({ id, x: 0, y: 0, w: 0, h: 0, press: 0, shk: 0, pop: 0, delay: 0.3 + i * 0.07, sold: false }));
        BG.key = '';
        layout(g);
        refill(g);
        advance(g);
        W.__stall = { g, get S() { return S; }, snap: () => snap(g) };
      },
      play(g) {
        if (S && S.pendingSay) { S.pendingSay = false; sayOrder(g); }
      },
      update(g, dt) { if (S) tick(g, dt, true); },
      draw(g, c) {
        if (!S) return;
        const tn = nowS();
        const dt = S.lastDraw ? clamp(tn - S.lastDraw, 0, 0.05) : 0;
        S.lastDraw = tn;
        if (g.state !== 'play') tick(g, dt, false);
        drawScene(g, c);
        drawTray(g, c);
        drawToks(g, c, false);
        drawBins(g, c);
        drawButtons(g, c);
        drawBubble(g, c);
        drawShout(g, c);
        drawToks(g, c, true);
        drawFx(g, c);
        drawBanner(g, c);
      },
      down(g, p) {
        if (!S || g.state !== 'play') return;
        const w = whatAt(p);
        if (!w) return;
        if (w[0] === 'spk') { S.spkP = 1; S.idle = 0; sayOrder(g); }
        else if (w[0] === 'serve') serve(g);
        else if (w[0] === 'trash') clearTray(g);
        else if (w[0] === 'bin') tapBin(g, w[1]);
        else if (w[0] === 'cone') { const sc = onTray().filter((t) => DEF(t.id).k === 'scoop'); if (sc.length) removeOne(g, sc[sc.length - 1].id); }
        else if (w[0] === 'grp') removeOne(g, w[1]);
      },
      move(g, p) {
        if (!S || p.type !== 'mouse') return;
        try { g.c.canvas.style.cursor = whatAt(p) ? 'pointer' : ''; } catch (e) { /* ignore */ }
      },
      key(g, key) {
        if (!S || g.state !== 'play') return;
        if (/^[0-9]$/.test(key)) tapBin(g, key === '0' ? 9 : Number(key) - 1);
        else if (key === 'enter') serve(g);
        else if (key === 'space') { S.spkP = 1; sayOrder(g); }
        else if (key === 'Backspace') undo(g);
        else if (key === 'Delete' || key === 'x' || key === 'X') clearTray(g);
      },
      resize(g) { if (S) { BG.key = ''; layout(g); refill(g); S.walkers.length = 0; if (S.cur && S.cur.st !== 'out') { S.cur.tx = L.custX; S.cur.ty = L.custY; } } },
      end(g) {
        try { if (g && g.c) g.c.canvas.style.cursor = ''; } catch (e) { /* ignore */ }
        if (BG.cv) { BG.cv.width = 0; BG.cv.height = 0; BG.cv = null; }
        if (BG.fg) { BG.fg.width = 0; BG.fg.height = 0; BG.fg = null; }
        if (W.__stall && W.__stall.g === g) W.__stall = null;
        S = null;
      }
    };
    /* 调试 / 自动试玩用（只读快照） */
    function snap(g) {
      const cu = S && S.cur;
      const ctr = (r) => (r ? { x: Math.round(r.x + r.w / 2), y: Math.round(r.y + r.h / 2) } : null);
      return {
        state: g.state, level: g.level, done: g.done, rounds: g.rounds, lives: g.lives, score: g.score, walk: S ? S.walk : 0,
        cust: cu ? { st: cu.st, pat: Math.round(cu.pat * 10) / 10, pmax: Math.round(cu.pmax), vip: cu.vip, text: orderText(cu), want: Object.assign({}, cu.want), seq: cu.seq, chg: !!(cu.item && cu.item.chg), chgDone: cu.chgDone, tpl: cu.tpl || 'review', hz: cu.item && cu.item.hz } : null,
        bins: S ? S.bins.map((b) => ({ id: b.id, n: DEF(b.id).n, m: DEF(b.id).m, sold: b.sold, x: Math.round(b.x + b.w / 2), y: Math.round(b.y + b.h / 2) })) : [],
        tray: S ? onTray().map((t) => t.id) : [], serving: !!(S && S.serving),
        serve: ctr(L.serve), trash: ctr(L.trash), spk: S && S.spk ? { x: Math.round(S.spk.x), y: Math.round(S.spk.y) } : null
      };
    }
    return spec;
  }

  HW.register({
    id: 'stall', skill: 'read', kind: 'arcade', name: '华文小吃店', icon: '🍜',
    blurb: '读懂顾客点单，做出一模一样的菜', reviewN: 8,
    start(ctx) {
      if (!HW.arcade || typeof HW.arcade.run !== 'function') {
        try { ctx.el.textContent = '游戏引擎没有加载，先玩别的吧。'; } catch (e) { /* ignore */ }
        return function () {};
      }
      return HW.arcade.run(ctx, makeSpec(ctx));
    }
  });
})();
