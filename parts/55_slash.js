/* =====================================================================
 * 华文小岛 3.0 · 🥷 切字忍者（parts/55_slash.js）  skill: write
 * 题库栏目：jg（字的结构，优先）→ 没有 jg 时退回 chars 里自带的 jg 字段
 * 契约：SPEC_V3.md、research/GAME_SHORTLIST.md ④；引擎：parts/15_arcade.js（HW.arcade.run）
 *
 * 玩法来源：借鉴 MilllerTime/menja（GPL-3.0）的“抛块—划屏切碎”玩法和几个手感参数
 *   （累计切碎 10 块开放慢动作；之后出现坚固块、摇晃块；指针太慢不算切中）。
 *   按许可只借玩法：本文件没有复制 menja 的任何代码、图片或音频，全部在 HW.arcade 上重写；
 *   画面用 Canvas 自绘（字形用内嵌笔顺数据 HW_STROKES 画），音效用引擎的 WebAudio 合成。
 *
 * 玩法：字块从下面抛上来，按“字的结构”下刀——
 *   左右 / 左中右 → 竖着切（字沿部件裂成左右两半，用 radStrokes 把部首笔画和其余笔画分开）；
 *   上下 / 上中下 → 横着切；独体字 → 是炸弹，别切（切到就炸）；
 *   半包围 / 全包围 → 画个圈圈住（P3 起第 2 关开放；圈住后里面的部件从框里弹出来）。
 *   所有字块长得一模一样（颜色随机），只有读懂字的结构才知道怎么下刀——换成色块就没法玩。
 * 判定（错题本不被污染）：
 *   - 只有“够快、完整划过字块、方向清楚（横平竖直）”的一刀才判对错；太慢 / 斜刀 / 擦边 / 点一下都不判；
 *   - 一刀（同一笔里朝同一方向的一趟，折返算新的一刀）划过好几个字块时：有切对的，其余切错的只算“顺带”——不记错题本；
 *     顺带弹刀 = g.miss + 扣 10 分，顺带碰炸弹 = 照样爆炸扣心（g.hurt：不进错题本、不降星）；全错只记第一个；
 *   - 出题按刀法均衡（竖切 / 横切 / 画圈 各一份），“一直竖着切”混不过去；
 *   - 这一笔还碰到过别的字块（擦边 / 太慢 / 斜 / 弯没判，或前一趟切对了）→ 分不清瞄的是谁（常见：瞄旁边的字、刀路擦过炸弹）：
 *     切错照样扣心，但用 g.hurt，不进错题本、不降星；只有这一笔碰到的字块全判“切错”才记错题（记第一个）；
 *   - 画圈：圈里有包围结构的字就算圈对（顺带圈进来的不算）；只圈进一个非包围字 = 圈错（进错题本）；
 *     圈进好几个非包围字 = 分不清想圈谁 → 绳断、扣心（g.hurt）；有画圈的关，刀路在字块里拐弯 > 0.6 弧度 = 圈边扫过，不当“切”；
 *   - 可切的字掉出屏幕：g.miss；独体字没碰它：+5“忍住了”（它飞着时孩子出过刀才给；错题重练时算答对）；
 *   - 切对：g.right(item)，item = {c, jg, hz}（hz = 这个字）；切错方向 / 切炸弹 / 圈错：g.wrong(item, note)。
 * 后果：方向错 → 刀被弹开（火花、字块被撞歪弹起，可以再补一刀）；炸弹 → 爆炸 + 刀晕 0.9 秒；圈错 → 绳子崩断。
 * P2：只有竖切 / 横切 / 别切；慢动作常开；同屏最多 2 个；5 颗心；底部一直有“结构→刀法”图例；
 *   判错后字块上画出正确刀法；时间宽松。
 * P3+：加左中右 / 上中下；第 2 关起画圈；第 4 关起铁甲字（12 画以上，先切掉铁甲再切字）；第 6 关起字块摇晃；
 *   累计切对 10 个字充满慢动作能量（点 ⏳ 或 Enter）。
 * 键盘：↑↓ / W S 竖切 · ←→ / A D 横切 · 空格 画圈 · X 换目标 · Enter / Z 慢动作（瞄准框自动对准最早飞出的字）。
 * 调试：window.__hwSlash = {g, S, api}（测试脚本读状态用；api.spawn(字) 只给截图测试放指定字块）。
 * ===================================================================== */
(function () {
  'use strict';
  const W = window, D = document;
  const HW = W.HW;
  if (!HW || typeof HW.register !== 'function') return;

  const TAU = Math.PI * 2;
  const NAVY = '#1d2b53';
  const INK = '#211b36';
  const GK = 0.74;   // 字形占字块边长的比例
  const ACT = { '左右': 'v', '左中右': 'v', '上下': 'h', '上中下': 'h', '独体': 'x', '半包围': 'o', '全包围': 'o' };
  const HOW = { v: '竖着切', h: '横着切', x: '别切', o: '画个圈圈住' };
  const CUTN = { v: '竖着切', h: '横着切', o: '画圈' };
  const JGN = (jg) => (jg === '独体' ? '独体字' : jg + '结构');
  /* 结构归类在不同教材里有分歧的字：一律不出题（华文内容拿不准就删） */
  const DISPUTED = new Set(Array.from('里鱼果黑重面页见北非乘爽巫坐噩夹承兼兆我办以气巨可句司习勿贝且旦丽严凸凹州兜鬼象免危' +
    '亮壳喜高害赛塞量充参鼠鼎假凝抑懈慨'));   // 第二行：上下/上中下、左右/左中右、独体/上下 各教材归法不一（2026-09-18 核 jg 栏目时补；
                                             // 慨：和 jg 栏目标了 skip 的「概」同构（忄/木 + 既），左中右 / 左右 两说，2026-09-19 试玩审查补）
  const GRADES = ['p2', 'p3', 'p4', 'p5', 'p6'];
  const TCOL = [
    { c: '#FF6B6B', d: '#B8322B' }, { c: '#4DA3FF', d: '#1D63B8' }, { c: '#34BF68', d: '#1B8243' },
    { c: '#FFB02E', d: '#C0730A' }, { c: '#B07BFF', d: '#7040C0' }, { c: '#FF7FB5', d: '#C24A80' }
  ];
  const BLADES = [
    { name: '竹剑', glow: 'rgba(110,255,150,.42)', core: '#F2FFF2', tip: '#B8FFC8' },
    { name: '金毛笔', glow: 'rgba(255,205,90,.48)', core: '#FFFBEA', tip: '#FFE08A' },
    { name: '激光刀', glow: 'rgba(90,225,255,.55)', core: '#F0FFFF', tip: '#9FF0FF' }
  ];
  const CATW = { v: 1, h: 1, o: 0.8 };   // 三种刀法出现的权重（画圈的字少，稍微少出一点）
  const PRAISE = ['好刀法！', '漂亮！', '干净利落！', '太帅了！', '一刀两断！', '好眼力！'];

  const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
  const lerp = (a, b, t) => a + (b - a) * t;
  const rand = (a, b) => a + Math.random() * (b - a);
  const randi = (a, b) => Math.floor(a + Math.random() * (b - a + 1));
  const nowMs = () => (W.performance && performance.now ? performance.now() : Date.now());
  const isHan = (ch) => /[㐀-鿿豈-﫿]/.test(ch);
  const easeOut = (t) => 1 - (1 - t) * (1 - t);
  function buzz(ms) { try { if (W.navigator && typeof W.navigator.vibrate === 'function') W.navigator.vibrate(ms); } catch (e) { /* ignore */ } }   // 手机震一下（iOS 不支持就算了）
  function shuffle(a) { const b = a.slice(); for (let i = b.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); const t = b[i]; b[i] = b[j]; b[j] = t; } return b; }
  function rr(x, px, py, w, h, r) {
    r = Math.max(0, Math.min(r, w / 2, h / 2));
    x.beginPath(); x.moveTo(px + r, py); x.arcTo(px + w, py, px + w, py + h, r); x.arcTo(px + w, py + h, px, py + h, r);
    x.arcTo(px, py + h, px, py, r); x.arcTo(px, py, px + w, py, r); x.closePath();
  }
  function mulberry(seed) { let s = seed >>> 0; return () => { s = (s + 0x6D2B79F5) >>> 0; let t = s; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }

  /* ================= 题目：结构表 ================= */
  function mkItem(c, jg) { return { c: c, jg: jg, hz: c }; }   // 自建对象，字段顺序固定 → 错题本 key 稳定
  function okItem(c, jg) { return typeof c === 'string' && Array.from(c).length === 1 && isHan(c) && !!ACT[jg] && !DISPUTED.has(c); }
  /** 本年级可出的字：jg 栏目优先；与 chars.jg 标注冲突、标了 skip、品字形、有争议的一律不要 */
  function gradePool(G, gradeKey) {
    G = G || {};
    const chJg = new Map();
    (Array.isArray(G.chars) ? G.chars : []).forEach((x) => { if (x && typeof x.c === 'string' && typeof x.jg === 'string') chJg.set(x.c.trim(), x.jg.trim()); });
    // ctx.G 只带核心认识的栏目；新栏目 jg 直接从 HW_DATA 读（SPEC_V3 §3）
    const raw = ((W.HW_DATA || {})[gradeKey] || {}).jg;
    const jg = Array.isArray(raw) ? raw : (Array.isArray(G.jg) ? G.jg : []);
    const src = jg.length ? jg : Array.from(chJg, ([c, j]) => ({ c, jg: j }));
    const out = new Map(), bad = new Set();
    src.forEach((x) => {
      if (!x || typeof x !== 'object') return;
      const c = typeof x.c === 'string' ? x.c.trim() : '', j = typeof x.jg === 'string' ? x.jg.trim() : '';
      if (!c) return;
      if (x.skip || !okItem(c, j)) { bad.add(c); return; }
      if (chJg.has(c) && chJg.get(c) !== j) { bad.add(c); return; }
      if (out.has(c) && out.get(c).jg !== j) { bad.add(c); return; }
      if (!out.has(c)) out.set(c, mkItem(c, j));
    });
    bad.forEach((c) => out.delete(c));
    return Array.from(out.values());
  }
  /** 字 → 组词。先用 jg 栏目里给这个字配的词（数据组逐字核过：词里含这个字、py 是这个字在词里的读音）：
   *  这个词在本年级及以下的 words 栏目里 → 用课本整词拼音；不在 → 只标这个字的读音（不自己拼整词拼音，免得多音字读错）。
   *  jg 没给词时退回：words 栏目（本年级优先，再往低年级找，带课本拼音）→ chars 栏目自带的 words。 */
  function wordIndex(gradeKey) {
    const all = W.HW_DATA && typeof W.HW_DATA === 'object' ? W.HW_DATA : {};
    const gi = Math.max(0, GRADES.indexOf(gradeKey));
    const order = [GRADES[gi]].concat(GRADES.slice(0, gi).reverse());
    const idx = new Map();
    const wpy = new Map();
    order.forEach((gk) => {
      const G = all[gk] || {};
      (Array.isArray(G.words) ? G.words : []).forEach((x) => {
        if (!x || typeof x.w !== 'string' || typeof x.py !== 'string') return;
        const w = x.w.trim(), py = x.py.trim();
        if (!wpy.has(w) && Array.from(w).length === py.split(/\s+/).length) wpy.set(w, py);
      });
    });
    const jg = (all[GRADES[gi]] || {}).jg;
    (Array.isArray(jg) ? jg : []).forEach((x) => {
      if (!x || x.skip || typeof x.c !== 'string' || typeof x.w !== 'string') return;
      const c = x.c.trim(), w = x.w.trim(), chs = Array.from(w);
      if (idx.has(c) || chs.length < 2 || chs.indexOf(c) < 0 || !chs.every(isHan)) return;
      const cpy = typeof x.py === 'string' ? x.py.trim() : '';
      const py = wpy.get(w) || '';
      if (py && cpy && py.split(/\s+/)[chs.indexOf(c)] !== cpy) return;   // 课本整词拼音和 jg 标的字音对不上：这个词不用
      idx.set(c, { w, py, cpy, gk: 'jg' });   // gk:'jg'：下面按年级找词时不会被“更短的词”顶掉
    });
    order.forEach((gk) => {
      const G = all[gk] || {};
      (Array.isArray(G.words) ? G.words : []).forEach((x) => {
        if (!x || typeof x.w !== 'string' || typeof x.py !== 'string') return;
        const w = x.w.trim(), chs = Array.from(w), sy = x.py.trim().split(/\s+/);
        if (chs.length < 2 || chs.length !== sy.length || !chs.every(isHan)) return;
        chs.forEach((ch, i) => {
          const cur = idx.get(ch);
          if (!cur || (cur.gk === gk && Array.from(cur.w).length > chs.length)) idx.set(ch, { w, py: x.py.trim(), cpy: sy[i], gk });
        });
      });
    });
    order.forEach((gk) => {
      const G = all[gk] || {};
      (Array.isArray(G.chars) ? G.chars : []).forEach((x) => {
        if (!x || typeof x.c !== 'string') return;
        const c = x.c.trim();
        if (idx.has(c)) return;
        const w = (Array.isArray(x.words) ? x.words : []).find((s) => typeof s === 'string' && s.indexOf(c) >= 0 && Array.from(s).length >= 2);
        idx.set(c, { w: w || '', py: '', cpy: typeof x.py === 'string' ? x.py.trim() : '', gk });
      });
    });
    return idx;
  }

  /* ================= 字形（makemeahanzi 格式：1024 方格，y 朝上，基线 900） ================= */
  const GLYPH = new Map();
  function medBox(m) {
    if (!Array.isArray(m)) return null;
    let x1 = 1e9, y1 = 1e9, x2 = -1e9, y2 = -1e9;
    m.forEach((p) => { if (Array.isArray(p) && p.length >= 2) { x1 = Math.min(x1, p[0]); x2 = Math.max(x2, p[0]); y1 = Math.min(y1, p[1]); y2 = Math.max(y2, p[1]); } });
    return x1 <= x2 ? { x1, y1, x2, y2 } : null;
  }
  function glyphOf(ch) {
    if (GLYPH.has(ch)) return GLYPH.get(ch);
    let gd = null;
    try {
      const d = W.HW_STROKES && W.HW_STROKES[ch];
      if (d && Array.isArray(d.strokes) && d.strokes.length && typeof W.Path2D === 'function') {
        const paths = d.strokes.map((s) => new W.Path2D(String(s)));
        const bbs = d.strokes.map((s, i) => medBox(d.medians && d.medians[i]));
        const rad = new Set((Array.isArray(d.radStrokes) ? d.radStrokes : []).filter((i) => Number.isInteger(i) && i >= 0 && i < paths.length));
        gd = { paths, bbs, rad, n: paths.length, plan: {} };
      }
    } catch (e) { gd = null; }
    GLYPH.set(ch, gd);
    return gd;
  }
  function unionBox(gd, idx) {
    let b = null;
    idx.forEach((i) => { const q = gd.bbs[i]; if (!q) return; if (!b) b = { x1: q.x1, y1: q.y1, x2: q.x2, y2: q.y2 }; else { b.x1 = Math.min(b.x1, q.x1); b.y1 = Math.min(b.y1, q.y1); b.x2 = Math.max(b.x2, q.x2); b.y2 = Math.max(b.y2, q.y2); } });
    return b;
  }
  /** 怎么把字分成两块：部首笔画一组、其余一组；两组真的左右 / 上下分开（或一框一芯）才用，否则退回“沿中线切” */
  function planOf(gd, act) {
    if (!gd) return null;
    if (gd.plan[act] !== undefined) return gd.plan[act];
    let p = null;
    const A = [], B = [];
    for (let i = 0; i < gd.n; i++) (gd.rad.has(i) ? A : B).push(i);
    const ba = A.length && B.length ? unionBox(gd, A) : null, bb = ba ? unionBox(gd, B) : null;
    if (ba && bb) {
      const w = (b) => b.x2 - b.x1, h = (b) => b.y2 - b.y1;
      if (act === 'v') {
        const [L, R, gl, gr] = ba.x1 + ba.x2 <= bb.x1 + bb.x2 ? [ba, bb, A, B] : [bb, ba, B, A];
        const ov = Math.min(L.x2, R.x2) - Math.max(L.x1, R.x1);
        if (ov <= 0.25 * Math.min(w(L), w(R)) + 10) p = { axis: 'x', first: gl, second: gr, cut: (L.x2 + R.x1) / 2 };
      } else if (act === 'h') {
        const [T, Bt, gt, gb] = ba.y1 + ba.y2 >= bb.y1 + bb.y2 ? [ba, bb, A, B] : [bb, ba, B, A];
        const ov = Math.min(T.y2, Bt.y2) - Math.max(T.y1, Bt.y1);
        if (ov <= 0.25 * Math.min(h(T), h(Bt)) + 10) p = { axis: 'y', first: gt, second: gb, cut: (T.y1 + Bt.y2) / 2 };
      } else if (act === 'o') {
        const area = (b) => Math.max(1, w(b)) * Math.max(1, h(b));
        const [O, I, go, gi] = area(ba) >= area(bb) ? [ba, bb, A, B] : [bb, ba, B, A];
        const ix = Math.max(0, Math.min(O.x2, I.x2) - Math.max(O.x1, I.x1)), iy = Math.max(0, Math.min(O.y2, I.y2) - Math.max(O.y1, I.y1));
        if (ix * iy >= 0.7 * area(I)) p = { axis: 'o', outer: go, inner: gi };
      }
    }
    gd.plan[act] = p;
    return p;
  }

  /* ================= 字块外观（离屏缓存） ================= */
  const BODY = new Map();
  function paintBody(x, s, col, armor) {
    const hs = s / 2, r = s * 0.18, dep = s * 0.065;
    x.fillStyle = 'rgba(25,8,45,.32)'; rr(x, -hs + s * 0.04, -hs + s * 0.1, s, s, r); x.fill();
    x.fillStyle = armor ? '#59657A' : col.d; rr(x, -hs, -hs + dep, s, s, r); x.fill();
    const gr = x.createLinearGradient(0, -hs, 0, hs);
    if (armor) { gr.addColorStop(0, '#FBFCFF'); gr.addColorStop(1, '#DCE3EE'); } else { gr.addColorStop(0, '#FFFDF4'); gr.addColorStop(1, '#F6E2BA'); }
    x.fillStyle = gr; rr(x, -hs, -hs, s, s, r); x.fill();
    const fi = s * 0.06;
    if (armor) {
      const mg = x.createLinearGradient(-hs, -hs, hs, hs); mg.addColorStop(0, '#EEF2F8'); mg.addColorStop(0.45, '#9AA6B8'); mg.addColorStop(0.55, '#C9D2DF'); mg.addColorStop(1, '#6D788C');
      x.lineWidth = s * 0.11; x.strokeStyle = mg; rr(x, -hs + fi, -hs + fi, s - fi * 2, s - fi * 2, r * 0.7); x.stroke();
      [[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach(([a, b]) => {
        const cx = a * (hs - fi * 1.05), cy = b * (hs - fi * 1.05);
        x.fillStyle = '#4B5568'; x.beginPath(); x.arc(cx, cy, s * 0.045, 0, TAU); x.fill();
        x.fillStyle = '#E9EEF6'; x.beginPath(); x.arc(cx - s * 0.012, cy - s * 0.012, s * 0.017, 0, TAU); x.fill();
      });
    } else {
      x.lineWidth = s * 0.07; x.strokeStyle = col.c; rr(x, -hs + fi, -hs + fi, s - fi * 2, s - fi * 2, r * 0.7); x.stroke();
    }
    x.save();
    x.setLineDash([s * 0.05, s * 0.045]); x.lineWidth = Math.max(1, s * 0.012); x.strokeStyle = 'rgba(214,72,72,.26)';
    const e = hs - s * 0.12;
    x.beginPath(); x.moveTo(-e, 0); x.lineTo(e, 0); x.moveTo(0, -e); x.lineTo(0, e); x.stroke();
    x.restore();
    x.lineWidth = Math.max(2, s * 0.03); x.strokeStyle = NAVY; rr(x, -hs, -hs, s, s + dep, r); x.stroke();
    x.fillStyle = 'rgba(255,255,255,.6)';
    x.beginPath(); x.ellipse(-hs + s * 0.26, -hs + s * 0.13, s * 0.14, s * 0.04, -0.15, 0, TAU); x.fill();
  }
  function bodySprite(s, ci, armor, dpr) {
    const key = ci + '|' + armor + '|' + Math.round(s) + '|' + dpr;
    let sp = BODY.get(key);
    if (sp) return sp;
    const size = Math.ceil(s * 1.3);
    const cv = D.createElement('canvas');
    cv.width = Math.max(1, Math.round(size * dpr)); cv.height = cv.width;
    const x = cv.getContext('2d');
    x.setTransform(dpr, 0, 0, dpr, 0, 0); x.translate(size / 2, size / 2);
    paintBody(x, s, TCOL[ci] || TCOL[0], armor);
    sp = { cv, size };
    BODY.set(key, sp);
    if (BODY.size > 48) { const k0 = BODY.keys().next().value; const o = BODY.get(k0); try { o.cv.width = 0; } catch (e) { /* ignore */ } BODY.delete(k0); }
    return sp;
  }

  /* ================= 关卡参数 ================= */
  function cfgFor(lv, p2) {
    const L = lv - 1;
    if (p2) return { tup: 1.45 - 0.02 * L, ts: 0.62 + 0.012 * L, maxOn: lv <= 2 ? 1 : 2, wave: lv <= 2 ? 1 : 2, gap: 1.15 - 0.03 * L, bomb: 0.2 + 0.012 * L, circle: false, three: false, armor: false, wob: 0 };
    return { tup: 1.42 - 0.04 * L, ts: 1, maxOn: lv <= 2 ? 2 : lv <= 5 ? 3 : 4, wave: lv <= 2 ? 1 : lv <= 6 ? 2 : 3, gap: 1.2 - 0.05 * L, bomb: 0.24 + 0.012 * L, circle: lv >= 2, three: true, armor: lv >= 4, wob: lv >= 6 ? 0.18 + 0.02 * (lv - 6) : 0 };
  }
  const roundsFor = (lv, p2) => (p2 ? 10 + Math.floor((lv - 1) * 0.6) : 14 + Math.floor((lv - 1) * 1.3));

  /* ================= 游戏 ================= */
  function makeSpec(ctx) {
    const P2 = (+ctx.gradeNum || 3) <= 2;
    let g = null;
    let S = {};
    let POOL = null, WORDS = null;
    const V = { bg: null, bgKey: '', last: 0, t: 0, petals: [], clouds: [] };

    /* ---------- 布局 ---------- */
    function layoutCalc() {
      const w = g.w, h = g.h;
      S.LH = clamp(Math.round(h * 0.066), 44, 58);
      S.size = Math.round(clamp(Math.min(w, h) * 0.235, 80, 124) * (P2 ? 1.1 : 1));
      S.R = S.size * 0.64;
      S.top = g.hudTop + 36;
      S.bottom = h - S.LH - 6;
      const band = Math.min(w, 1080);
      S.left = (w - band) / 2 + 10; S.right = S.left + band - 20;
      S.k = clamp((S.bottom - S.top) / 620, 0.7, 1.4);
      S.vmin = (P2 ? 200 : 280) * clamp(S.size / 100, 0.85, 1.25);
      S.sc = clamp(S.size / 100, 0.8, 1.3);
      (S.tiles || []).forEach((t) => { t.s = S.size; t.R = S.R; });
    }

    /* ---------- 出题 ---------- */
    function allowed(it) {
      const a = ACT[it.jg];
      if (!a) return false;
      if (P2) return it.jg === '左右' || it.jg === '上下' || it.jg === '独体';
      if (a === 'o') return !!S.cfg.circle;
      return true;
    }
    function nextItem(exclude, noBomb) {
      if (S.review) {
        for (let i = 0; i < S.rq.length; i++) {
          const it = S.rq[i];
          if (S.rqDone.has(it.c) || exclude.has(it.c)) continue;
          S.rq.splice(i, 1); S.rq.push(it);
          return it;
        }
        return null;
      }
      if (!noBomb && S.bombs.length && S.bombRun < 2 && Math.random() < S.cfg.bomb) {
        const cand = S.bombs.filter((b) => !exclude.has(b.c));
        if (cand.length) { S.bombRun++; return cand[Math.floor(Math.random() * cand.length)]; }
      }
      S.bombRun = 0;
      // 先按刀法抽类别（竖切 / 横切 / 画圈 各占一份），再从该类的牌堆里抽字：
      // 题库里左右结构最多，按字数抽的话“一直竖着切”就能混过去——均衡以后只会一种刀法的必输
      const cats = Object.keys(S.decks).filter((k) => S.byCat[k].length);
      if (!cats.length) return null;
      let pool = cats.filter((k) => !(k === S.lastCat && S.catRun >= 2));
      if (!pool.length) pool = cats;
      let tot = 0;
      pool.forEach((k) => { tot += CATW[k] || 1; });
      let r = Math.random() * tot, cat = pool[pool.length - 1];
      for (const k of pool) { r -= CATW[k] || 1; if (r <= 0) { cat = k; break; } }
      const order = [cat].concat(cats.filter((k) => k !== cat));
      for (const k of order) {
        for (let tries = 0; tries < 2; tries++) {
          let dk = S.decks[k];
          if (!dk.length) { dk = S.decks[k] = shuffle(S.byCat[k]); if (dk.length > 1 && dk[dk.length - 1].c === S.lastC) dk.unshift(dk.pop()); }
          for (let i = dk.length - 1; i >= 0; i--) {
            if (exclude.has(dk[i].c)) continue;
            const it = dk.splice(i, 1)[0];
            S.lastC = it.c;
            S.catRun = k === S.lastCat ? S.catRun + 1 : 1; S.lastCat = k;
            return it;
          }
          S.decks[k] = [];
        }
      }
      return null;
    }
    function flyingCount() { let n = 0; for (const t of S.tiles) if (t.state === 'fly') n++; return n; }
    /** 占着“同屏名额”的字块：已经在往下掉的炸弹不算——不然孩子只能干等炸弹落地（P2 第 1 关一半时间在等） */
    function busyCount() { let n = 0; for (const t of S.tiles) if (t.state === 'fly' && !(t.act === 'x' && t.vy > 0)) n++; return n; }
    function spawnWave() {
      // 同屏上限：竖屏手机窄，按宽度最多放得下几个就几个；前两关（上限 ≤ 2）可以多一个“正在落下的炸弹”，高关不再加
      const cap = Math.max(1, Math.min(S.cfg.maxOn, Math.floor((S.right - S.left) / (S.size * 1.1))));
      const room = Math.min(cap - busyCount(), cap + (cap <= 2 ? 1 : 0) - flyingCount()) - S.pending.length;
      if (room <= 0) return;
      let n = 1;
      if (S.cfg.wave > 1 && Math.random() < 0.55) n = randi(2, S.cfg.wave);
      n = Math.min(n, room);
      const ex = new Set();
      S.tiles.forEach((t) => { if (t.state === 'fly') ex.add(t.c); });
      S.pending.forEach((p) => ex.add(p.it.c));
      let bombs = 0;
      for (let i = 0; i < n; i++) {
        const it = nextItem(ex, n > 1 && bombs >= n - 1);
        if (!it) break;
        if (ACT[it.jg] === 'x') bombs++;
        ex.add(it.c);
        S.pending.push({ it, at: S.clock + i * 0.22 });
      }
      if (S.pending.length) g.sfx('whoosh');
    }
    function launch(it) {
      const s = S.size, act = ACT[it.jg];
      // 起飞点尽量离开正在飞的字块（抽 6 个位置取离得最远的）：炸弹别总贴着要切的字，刀路误碰炸弹少一些
      let x0 = rand(S.left + s * 0.7, S.right - s * 0.7);
      const fly = S.tiles.filter((t) => t.state === 'fly');
      if (fly.length) {
        let bd = -1;
        for (let k = 0; k < 6 && bd < s * 1.6; k++) {
          const cx = k ? rand(S.left + s * 0.7, S.right - s * 0.7) : x0;
          let d = 1e9;
          for (const t of fly) d = Math.min(d, Math.abs(t.x - cx));
          if (d > bd) { bd = d; x0 = cx; }
        }
      }
      const y0 = g.h + s * 0.75;
      let apex = rand(S.top + s * 0.55, S.top + (S.bottom - S.top) * 0.4);
      if (S.bannerT > 0.5 && S.banner) {   // 关卡横幅（刀法说明）还挂着：字块别飞上去把说明挡住
        const by = S.top + 30 + (S.bottom - S.top) * 0.1 + (S.banner.sub ? 46 : 30);
        apex = Math.max(apex, Math.min(by + s * 0.62, S.bottom - s * 0.8));
      }
      const tup = S.cfg.tup * rand(0.92, 1.08);
      const hgt = Math.max(80, y0 - apex);
      const G = 2 * hgt / (tup * tup);
      const vy = -G * tup;
      const T = tup + Math.sqrt(2 * (y0 + s - apex) / G);
      const span = S.right - S.left;
      const xL = clamp(x0 + rand(-0.35, 0.35) * span, S.left + s * 0.5, S.right - s * 0.5);
      const gd = glyphOf(it.c);
      const armor = S.cfg.armor && gd && gd.n >= 12 && Math.random() < 0.75 ? 1 : 0;
      S.tiles.push({
        id: ++S.uid, it, c: it.c, jg: it.jg, act, gd, x: x0, y: y0, vx: (xL - x0) / T, vy, G, s, R: S.R,
        rot0: rand(-0.05, 0.05), rot: 0, age: 0, ph: rand(0, TAU), wf: rand(1.6, 2.4), wa: S.cfg.wob ? S.cfg.wob * rand(0.85, 1.1) : 0.04,
        ci: randi(0, TCOL.length - 1), armor, state: 'fly', born: nowMs(), touched: false, wrongOnce: false, cool: 0, jolt: 0, hintT: 0, hist: []
      });
    }

    /* ---------- 判定 ---------- */
    /** “一刀” = 同一笔里朝同一个方向的一趟（来回折返就是新的一刀）；最长 0.8 秒 */
    function judgeGroup() {
      const t = nowMs(), st = S.stroke, run = st ? st.run : -1;
      if (S.grp && (t - S.grp.t0 > 800 || S.grp.s !== st || S.grp.run !== run)) closeGroup(S.grp);
      if (!S.grp) S.grp = { t0: t, s: st, run, rights: 0, wrongs: [], closed: false };
      return S.grp;
    }
    function closeGroup(grp) {
      if (!grp || grp.closed) return;
      grp.closed = true;
      if (S.grp === grp) S.grp = null;
      if (!grp.wrongs.length) return;
      if (!grp.rights) {
        const w = grp.wrongs[0];
        // 这一笔还碰到过别的字块（擦边 / 太慢 / 斜刀 / 弯刀没判，或者之前那一趟切对了）：分不清孩子瞄的是哪个
        // （常见：瞄准旁边的字，刀路顺带擦过炸弹）→ 照样有后果、扣心，但不进错题本、不降星。
        // 只有这一笔碰到的字块全都判了“切错”，才算真的判断错，记第一个。
        const wid = new Set(grp.wrongs.map((q) => q.id));
        let other = false;
        if (w.s && w.s.st) w.s.st.forEach((v, id) => { if (!wid.has(id)) other = true; });
        if (w.s && w.s.near) w.s.near.forEach((id) => { if (!wid.has(id)) other = true; });   // 刀路擦着别的字过去（瞄的可能是它）
        if (other || (w.s && w.s.rej > 0)) hurt(w.x, w.y);
        else g.wrong(w.it, w.note, w.x, w.y);
        grp.wrongs.slice(1).forEach(collateral);
      } else grp.wrongs.forEach(collateral);
    }
    /** 游戏后果（扣心、断连击），但不是华文判断错：不进错题本、不计 wrongs（不降星）。引擎没有 g.hurt 时退回 g.wrong(null) */
    function hurt(x, y) {
      if (typeof g.hurt === 'function') g.hurt(x, y, '');
      else g.wrong(null, '', x, y);
    }
    /** 一刀划过好几个字块时“顺带”划到的：分不清孩子是不是判断错了 → 不记错题本，只有游戏后果。
     *  顺带碰到炸弹照样炸、照样扣心（水果忍者的老规矩：刀路上别有炸弹）；顺带弹刀只扣分。 */
    function collateral(w) {
      if (w.bomb) { hurt(w.x, w.y); return; }
      g.miss();
      g.addScore(-10, clamp(w.x, 50, g.w - 50), w.y - 30);
    }
    function noteFor(tl, cut) {
      if (tl.act === 'x') return cut === 'o' ? '「' + tl.c + '」是独体字，不是包围结构，别去圈它' : '「' + tl.c + '」是独体字，不能切';
      return '「' + tl.c + '」是' + JGN(tl.jg) + '，要' + HOW[tl.act] + '，不能' + CUTN[cut];
    }
    /** direct = 键盘 / 画圈（肯定是有意的，不进“一刀多字”分组） */
    function resolve(tl, cut, geo, direct) {
      if (tl.state !== 'fly') return;
      tl.touched = true;
      if (tl.act === 'x') { explode(tl, cut, geo, direct); return; }
      if (cut === tl.act) {
        if (tl.armor > 0) { breakArmor(tl, geo); if (!direct) judgeGroup().rights++; return; }   // 砍铁甲也是一刀对的刀法：同一刀顺带碰到的不进错题本
        if (cut === 'o') capture(tl); else slice(tl, cut, geo);
        if (!direct) { const grp = judgeGroup(); grp.rights++; if (grp.rights === 2) doubleCut(tl); }
        return;
      }
      deflect(tl, cut, geo, direct);
    }
    function onRight(tl) {
      const x = tl.x, y = tl.y;
      if (S.review) S.rqDone.add(tl.c);
      S.cutsTotal++;
      if (!P2) S.energy = Math.min(1, S.energy + 0.1);
      g.right(tl.it, x, y, undefined, { labelAt: [x, y + 4] });   // +分数飘在字块中间（碎片往两边飞，中间是空的），上面留给词条
      if (g.combo > 0 && g.combo % 5 === 0) { S.bulletT = 0.75; g.flash('#DDF3FF'); }
      else if (Math.random() < 0.3) g.float(PRAISE[randi(0, PRAISE.length - 1)], clamp(x, 70, g.w - 70), y + tl.s * 0.75, { color: '#FFFFFF', size: 22 });
      const e = WORDS.get(tl.c) || { w: '', py: '', cpy: '' };
      const L = { ch: tl.c, jg: tl.jg, w: e.w, py: e.py || '', cpy: e.py ? '' : e.cpy, x: 0, y: 0, age: 0, life: 1.7 };
      placeLabel(L, x, y, tl.s);   // 词条摆在字块上方（太靠顶就放下方）：不压在碎片和墨点上，拼音看得清
      if (S.bannerT > 0.45) S.bannerT = 0.45;   // 开切了：关卡横幅赶紧淡出，别和词条叠在一起
      S.labels.push(L);
      // 朗读整词（单读一个多音字容易读错）；没有中文朗读时的字幕：有课本整词拼音就给整词，没有就只标这个字的读音
      if (e.w && !g.speaking) g.say(e.w, { caption: e.py ? e.w + '  ' + e.py : e.cpy ? e.w + '  ' + tl.c + ' ' + e.cpy : e.w });
      S.hitStop = 0.05;
    }
    /** 词条摆位：按真实宽高找一个不和别的词条重叠的位置（原位 → 上 → 下 → 更远）；都挤不下就让旧词条提前淡出 */
    const LAB_UP = 58, LAB_DN = 40, LAB_DRIFT = 34;
    function labelBox(L) {
      if (L.bw) return L.bw;
      const tag = g.measure(L.jg + ' ✓', 15, 'round') + 16;
      let bw = tag;
      if (L.w) {
        bw = Math.max(bw, g.measure(L.w, 30, 'kai', 700) + 12);
        const py = L.py || (L.cpy ? L.ch + ' ' + L.cpy : '');
        if (py) bw = Math.max(bw, g.measure(py, 16, 'py') + 10);
      } else bw = Math.max(bw, 44);
      L.bw = bw;
      return bw;
    }
    function placeLabel(L, x0, ty, ts) {
      const bw = labelBox(L), yMin = S.top + LAB_UP + LAB_DRIFT + 4, yMax = g.h - S.LH - LAB_DN - 4;
      L.x = clamp(x0, bw / 2 + 6, g.w - bw / 2 - 6);
      const live = S.labels.filter((o) => o.age < o.life * 0.85);
      const clash = (y) => live.filter((o) => Math.abs(o.x - L.x) < (labelBox(o) + bw) / 2 + 6 &&
        y - LAB_UP - LAB_DRIFT < o.y + LAB_DN && o.y - LAB_UP - LAB_DRIFT < y + LAB_DN);
      const step = LAB_UP + LAB_DN + LAB_DRIFT + 6;
      const above = ty - ts * 0.55 - LAB_DN, below = ty + ts * 0.6 + LAB_UP;   // 字块正上方 / 正下方
      const cand = [above, below, above - step, below + step, above - 2 * step, below + 2 * step].filter((y) => y >= yMin && y <= yMax);
      // 也别盖住还在飞的字块（孩子要看清下一个字）：先找既不压词条、也不压字块的位置，找不到再只躲词条
      const onTile = (y) => S.tiles.some((t) => t.state === 'fly' && Math.abs(t.x - L.x) < bw / 2 + t.R * 0.8 &&
        t.y + t.R * 0.8 > y - LAB_UP - LAB_DRIFT && t.y - t.R * 0.8 < y + LAB_DN);
      for (const y of cand) if (!clash(y).length && !onTile(y)) { L.y = y; return; }
      for (const y of cand) if (!clash(y).length) { L.y = y; return; }
      L.y = cand.length ? cand[0] : clamp(above, yMin, yMax);
      clash(L.y).forEach((o) => { o.age = Math.max(o.age, o.life * 0.8); });   // 实在挤：旧的让位
    }
    function slice(tl, cut, geo) {
      tl.state = 'dead';
      spawnSlicePieces(tl, cut);
      const cr = Math.cos(tl.rot), sr = Math.sin(tl.rot);
      const L = tl.s * 0.85;
      const ux = cut === 'v' ? -sr : cr, uy = cut === 'v' ? cr : sr;
      S.slashes.push({ x1: tl.x - ux * L, y1: tl.y - uy * L, x2: tl.x + ux * L, y2: tl.y + uy * L, age: 0, life: 0.2, col: '#FFFFFF' });
      g.burst(tl.x, tl.y, { kind: 'ink', color: '#3B2F6B', n: 4 });
      g.burst(tl.x, tl.y, { kind: 'dot', color: (TCOL[tl.ci] || TCOL[0]).c, n: 12 });
      g.sfx('chomp');
      onRight(tl);
    }
    function capture(tl) {
      tl.state = 'dead';
      spawnCapturePieces(tl);
      g.burst(tl.x, tl.y, { kind: 'star', color: '#FFE45C', n: 10 });
      g.sfx('power');
      onRight(tl);
    }
    function doubleCut(tl) {
      g.addScore(20);
      g.float('一刀两字！+20', clamp(tl.x, 90, g.w - 90), tl.y - tl.s, { color: '#8FF0FF', size: 30 });
      S.bulletT = Math.max(S.bulletT, 0.6);
    }
    function breakArmor(tl, geo) {
      tl.armor = 0; tl.cool = 0.18; tl.jolt = 0.25;
      tl.vy = Math.min(tl.vy, 0) - 150 * S.k;
      g.burst(tl.x, tl.y, { kind: 'dot', color: '#BFC9D8', n: 18 });
      g.burst(geo ? geo.x : tl.x, geo ? geo.y : tl.y, { kind: 'spark', color: '#FFFFFF', n: 14 });
      g.ring(tl.x, tl.y, '#DCE6F5', tl.s * 0.9);
      g.sfx('crash');
      g.addScore(5);
      g.float('铁甲碎了！再来一刀', clamp(tl.x, 110, g.w - 110), tl.y - tl.s * 0.9, { color: '#DCE6F5', size: 22 });
      if (!P2) S.energy = Math.min(1, S.energy + 0.05);
    }
    function deflect(tl, cut, geo, direct) {
      tl.wrongOnce = true; tl.cool = P2 ? 0.7 : 0.45; tl.jolt = 0.4;   // 弹开后短暂“刀枪不入”：来回乱划不会在同一个字上连扣好几颗心，也给孩子时间看提示
      tl.hintT = P2 ? 1.8 : 1.2;
      S.legHi = tl.act; S.legHiT = 1.6;
      const gx = geo ? geo.x : tl.x, gy = geo ? geo.y : tl.y;
      if (cut === 'o') {
        S.ropes.push(ropeFrom(geo && geo.poly, tl, false));
      } else {
        const dx = geo ? geo.dx : 0, dy = geo ? geo.dy : 0, dl = Math.hypot(dx, dy) || 1;
        tl.vx += (dx / dl) * 140 * S.k;
        tl.vy = Math.min(tl.vy, 0) - 170 * S.k;
        S.trailRed = 0.3;
        g.burst(gx, gy, { kind: 'spark', color: '#FFF1A8', n: 18 });
        g.ring(gx, gy, '#FFD6D6', tl.s * 0.55);
        g.float('铛！', clamp(gx, 40, g.w - 40), gy - 20, { color: '#FFF1A8', size: 30 });
      }
      g.sfx('swing'); buzz(25);
      const w = { id: tl.id, it: tl.it, note: noteFor(tl, cut), x: tl.x, y: tl.y, bomb: false, s: geo && geo.s };
      if (direct) { if (S.grp) closeGroup(S.grp); g.wrong(w.it, w.note, w.x, w.y); }
      else judgeGroup().wrongs.push(w);
    }
    function explode(tl, cut, geo, direct) {
      tl.state = 'dead';
      spawnBombPieces(tl);
      S.booms.push({ x: tl.x, y: tl.y, age: 0, life: 0.6 });
      g.burst(tl.x, tl.y, { kind: 'dot', color: '#FF8A1F', n: 28 });
      g.burst(tl.x, tl.y, { kind: 'ink', color: '#2A2140', n: 12 });
      g.burst(tl.x, tl.y, { kind: 'spark', color: '#FFE27A', n: 22 });
      g.ring(tl.x, tl.y, '#FF7A1A', tl.s * 1.5);
      g.shake(P2 ? 10 : 16); g.flash('#FFB36B');
      buzz(P2 ? 40 : 70);
      g.sfx('crash');
      if (cut === 'o') S.ropes.push(ropeFrom(geo && geo.poly, tl, false));
      g.float('独体字！别切', clamp(tl.x, 90, g.w - 90), tl.y - tl.s * 0.8, { color: '#FFB0A0', size: 26 });
      S.stunT = 0.9;
      S.legHi = 'x'; S.legHiT = 1.6;
      const w = { id: tl.id, it: tl.it, note: noteFor(tl, cut), x: tl.x, y: tl.y, bomb: true, s: geo && geo.s };
      if (direct) { if (S.grp) closeGroup(S.grp); g.wrong(w.it, w.note, w.x, w.y); }
      else judgeGroup().wrongs.push(w);
    }
    function onEscape(t) {
      const y = g.h - S.LH - 46;
      if (t.act === 'x') {
        if (t.touched) return;
        if (S.review) { S.rqDone.add(t.c); g.right(t.it, clamp(t.x, 60, g.w - 60), y, '忍住了！'); return; }
        if (!(S.lastStroke > t.born)) return;   // 它飞着的时候根本没出过刀：不给“忍住了”（光站着不动不该刷分）
        g.addScore(5);
        g.float('忍住了 +5', clamp(t.x, 70, g.w - 70), y, { color: '#A6F5BC', size: 22 });
        return;
      }
      if (!t.wrongOnce) g.miss(clamp(t.x, 50, g.w - 50), y);
    }

    /* ---------- 碎片 ---------- */
    function pieceBase(tl) {
      return { gd: tl.gd, ch: tl.c, s: tl.s, ci: tl.ci, armor: 0, x: tl.x, y: tl.y, rot: tl.rot, vr: 0, vx: tl.vx * 0.35, vy: tl.vy * 0.3, G: clamp(tl.G, 600, 2400),
        body: true, clip: null, sclip: false, idx: null, glow: false, sc: 1, sc1: 1, age: 0, life: 1.5, ink: INK };
    }
    function spawnSlicePieces(tl, cut) {
      const plan = planOf(tl.gd, cut);
      const k = tl.s * GK / 1024, big = tl.s * 2;
      let cutL = 0;
      if (plan) cutL = cut === 'v' ? (plan.cut - 512) * k : (388 - plan.cut) * k;
      cutL = clamp(cutL, -tl.s * 0.3, tl.s * 0.3);
      const cr = Math.cos(tl.rot), sr = Math.sin(tl.rot);
      const nx = cut === 'v' ? cr : -sr, ny = cut === 'v' ? sr : cr;   // 从第一块指向第二块（世界坐标）
      const spd = (150 + Math.random() * 60) * S.k;
      const A = pieceBase(tl), B = pieceBase(tl);
      A.clip = cut === 'v' ? { x0: -big, y0: -big, x1: cutL, y1: big } : { x0: -big, y0: -big, x1: big, y1: cutL };
      B.clip = cut === 'v' ? { x0: cutL, y0: -big, x1: big, y1: big } : { x0: -big, y0: cutL, x1: big, y1: big };
      if (plan) { A.idx = plan.first; B.idx = plan.second; } else { A.sclip = true; B.sclip = true; }
      A.vx -= nx * spd; A.vy -= ny * spd + 90 * S.k; B.vx += nx * spd; B.vy += ny * spd - 90 * S.k;
      A.x -= nx * 3; A.y -= ny * 3; B.x += nx * 3; B.y += ny * 3;
      A.vr = -rand(1.5, 2.6); B.vr = rand(1.5, 2.6);
      S.pieces.push(A, B);
    }
    function spawnCapturePieces(tl) {
      const plan = planOf(tl.gd, 'o');
      const O = pieceBase(tl);
      O.vy = Math.min(O.vy, 0) + 40; O.vr = rand(-0.8, 0.8);
      if (plan) {
        O.idx = plan.outer;
        const I = pieceBase(tl);
        I.body = false; I.idx = plan.inner; I.glow = true; I.ink = '#3B1E00';
        I.vx = 0; I.vy = -(240 * S.k + 60); I.G = 260; I.sc = 1; I.sc1 = 1.4; I.life = 1.25; I.vr = 0;
        S.pieces.push(O, I);
      } else {
        O.glow = true;
        S.pieces.push(O);
      }
    }
    function spawnBombPieces(tl) {
      const big = tl.s * 2;
      [[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach(([a, b]) => {
        const P = pieceBase(tl);
        P.clip = { x0: a < 0 ? -big : 0, y0: b < 0 ? -big : 0, x1: a < 0 ? 0 : big, y1: b < 0 ? 0 : big };
        P.sclip = true; P.ink = '#3A2A2A';
        P.vx = a * rand(260, 380) * S.k; P.vy = b * rand(160, 260) * S.k - 220 * S.k; P.vr = a * rand(3, 6); P.life = 1.2;
        S.pieces.push(P);
      });
    }
    function ropeFrom(poly, tl, ok) {
      let pts;
      if (poly && poly.length > 4) {
        const step = Math.max(1, Math.floor(poly.length / 36));
        pts = [];
        for (let i = 0; i < poly.length; i += step) pts.push({ x: poly[i].x, y: poly[i].y });
      } else {
        pts = [];
        const r = tl.R * 1.25;
        for (let i = 0; i <= 28; i++) { const a = i / 28 * TAU; pts.push({ x: tl.x + Math.cos(a) * r, y: tl.y + Math.sin(a) * r }); }
      }
      return { pts, cx: tl.x, cy: tl.y, age: 0, life: ok ? 0.5 : 0.7, ok };
    }

    /* ---------- 划屏 ---------- */
    function strokeStart(p) {
      const t = nowMs();
      if (S.grp) closeGroup(S.grp);
      const s = { pts: [{ x: p.x, y: p.y, t }], st: new Map(), near: new Set(), loopFrom: 0, len: 0, turn: 0, lastAng: null, turnHist: [], t0: t, moved: false, rej: 0, run: 0, rx: 0, ry: 0 };
      S.stroke = s;
      S.lastStroke = t;
      S.trail.push({ x: p.x, y: p.y, t, brk: true });
      if (S.stunT > 0) return;
      for (const tl of S.tiles) {
        if (tl.state !== 'fly' || tl.cool > 0) continue;
        const dx = p.x - tl.x, dy = p.y - tl.y;
        if (dx * dx + dy * dy < tl.R * tl.R * 2.25) s.near.add(tl.id);
        if (dx * dx + dy * dy < tl.R * tl.R) s.st.set(tl.id, { inside: true, ex: p.x, ey: p.y, et: t, path: 0, startIn: true, done: false, turn0: 0 });
      }
    }
    function strokeMove(p) {
      const s = S.stroke;
      if (!s) return;
      const t = nowMs();
      const a = s.pts[s.pts.length - 1];
      const dx = p.x - a.x, dy = p.y - a.y, d = Math.hypot(dx, dy);
      if (d < 2) return;
      const b = { x: p.x, y: p.y, t };
      if (!s.moved) { s.moved = true; s.st.forEach((st) => { if (st.startIn) st.et = Math.max(st.et, t - 17); }); }
      s.pts.push(b);
      if (s.pts.length > 420) { s.pts.splice(0, 120); s.loopFrom = Math.max(0, s.loopFrom - 120); }
      s.len += d;
      if (d > 3) {
        const ang = Math.atan2(dy, dx);
        if (s.lastAng != null) {
          let da = ang - s.lastAng;
          while (da > Math.PI) da -= TAU;
          while (da < -Math.PI) da += TAU;
          s.turn += da; s.turnHist.push({ t, da });
        }
        s.lastAng = ang;
      }
      while (s.turnHist.length && t - s.turnHist[0].t > 350) s.turnHist.shift();
      // 折返（和这一趟的方向夹角 > 约 100°）= 新的一刀：之前那一刀的对错先结算
      const rl = Math.hypot(s.rx, s.ry);
      if (rl > 24 && (dx * s.rx + dy * s.ry) / (d * rl) < -0.2) { s.run++; s.rx = 0; s.ry = 0; if (S.grp) closeGroup(S.grp); }
      s.rx += dx; s.ry += dy;
      S.trail.push(b);
      if (S.stunT > 0) return;
      const spd = d / Math.max(1, t - a.t) * 1000;
      if (spd > S.vmin * 1.3 && t - S.swishT > 170) { g.sfx('swing'); S.swishT = t; }
      segTiles(a, b, s);
      if (S.cfg.circle) {
        let tq = 0;
        for (const q of s.turnHist) tq += Math.abs(q.da);
        if (tq > 2.4) S.lassoT = 0.3;
        loopCheck(s);
      }
    }
    function strokeEnd() {
      const s = S.stroke;
      if (!s) return;
      // 一刀划到屏幕边上才松手：还“在字块里”的也按松手点结算（擦边 / 太短照样不判）
      if (S.stunT <= 0 && s.moved) {
        const b = s.pts[s.pts.length - 1];
        for (const tl of S.tiles) {
          const st = s.st.get(tl.id);
          if (tl.state === 'fly' && st && st.inside && !st.done && tl.cool <= 0) exitTile(tl, st, b.x, b.y, b.t, s);
        }
      }
      if (S.stunT <= 0 && S.cfg.circle && !s.looped && s.pts.length >= 12) {
        const a = s.pts[0], b = s.pts[s.pts.length - 1];
        if (Math.abs(s.turn) >= 4.6 && Math.hypot(a.x - b.x, a.y - b.y) < S.size * 1.1 && s.len >= S.size * 1.8) tryLoop(s, 0, s.pts.length - 1);
      }
      S.stroke = null;   // 放到最后：松手时结算的字块还算在这一刀里
      if (S.grp) closeGroup(S.grp);
      if (s.len < 12 && nowMs() - s.t0 < 400 && nowMs() - S.tapHintT > 2500) {
        const p = s.pts[0];
        const hit = S.tiles.find((tl) => tl.state === 'fly' && Math.hypot(p.x - tl.x, p.y - tl.y) < tl.R);
        if (hit) { S.tapHintT = nowMs(); g.float('要快快划过去哦！', clamp(p.x, 100, g.w - 100), p.y - 40, { color: '#FFFFFF', size: 22 }); }
      }
    }
    /** 线段 a→b 与每个字块（圆）求交：记录进入点，穿出时判定这一刀 */
    function segTiles(a, b, s) {
      const dx = b.x - a.x, dy = b.y - a.y, A = dx * dx + dy * dy;
      if (A < 1e-6) return;
      const seg = Math.sqrt(A);
      for (const tl of S.tiles) {
        if (tl.state !== 'fly') continue;
        if (!s.near.has(tl.id)) {   // 刀路离字块中心不到 1.5R：这一笔可能是冲它去的（判错题时用来认“瞄的是谁”）
          const u = clamp(((tl.x - a.x) * dx + (tl.y - a.y) * dy) / A, 0, 1);
          if (Math.hypot(a.x + dx * u - tl.x, a.y + dy * u - tl.y) < tl.R * 1.5) s.near.add(tl.id);
        }
        if (tl.cool > 0) continue;
        let st = s.st.get(tl.id);
        if (st && st.done) continue;
        const fx = a.x - tl.x, fy = a.y - tl.y, R = tl.R;
        const B = 2 * (fx * dx + fy * dy), C = fx * fx + fy * fy - R * R;
        const disc = B * B - 4 * A * C;
        const sq = disc >= 0 ? Math.sqrt(disc) : 0;
        const u1 = disc >= 0 ? (-B - sq) / (2 * A) : 2, u2 = disc >= 0 ? (-B + sq) / (2 * A) : -1;
        if (st && st.inside) {
          if (disc >= 0 && u2 >= 0 && u2 <= 1) { st.path += seg * u2; exitTile(tl, st, a.x + dx * u2, a.y + dy * u2, a.t + (b.t - a.t) * u2, s); }
          else st.path += seg;
          continue;
        }
        if (C < 0) {   // 字块飞到了手指下面：从这里算起
          st = { inside: true, ex: a.x, ey: a.y, et: a.t, path: 0, startIn: true, done: false, turn0: s.turn };
          s.st.set(tl.id, st);
          if (disc >= 0 && u2 >= 0 && u2 <= 1) { st.path = seg * u2; exitTile(tl, st, a.x + dx * u2, a.y + dy * u2, a.t + (b.t - a.t) * u2, s); }
          else st.path = seg;
          continue;
        }
        if (disc < 0 || u1 < 0 || u1 > 1) continue;
        st = { inside: true, ex: a.x + dx * u1, ey: a.y + dy * u1, et: a.t + (b.t - a.t) * u1, path: 0, startIn: false, done: false, turn0: s.turn };
        s.st.set(tl.id, st);
        if (u2 <= 1) { st.path = seg * (u2 - u1); exitTile(tl, st, a.x + dx * u2, a.y + dy * u2, a.t + (b.t - a.t) * u2, s); }
        else st.path = seg * (1 - u1);
      }
    }
    function exitTile(tl, st, x, y, t, s) {
      st.inside = false;
      const cx = x - st.ex, cy = y - st.ey, L = Math.hypot(cx, cy), R = tl.R;
      if (st.startIn) {
        if (L < 0.8 * R) return;   // 起点在字块里、划出去太短：不判（可以重新进来）
        const dist = Math.abs((tl.x - st.ex) * cy - (tl.y - st.ey) * cx) / Math.max(1, L);
        if (dist > 0.6 * R) return;
      } else if (L < 1.1 * R) return;   // 擦边
      if (st.path > 0 && L / st.path < 0.8) { st.done = true; s.rej++; return; }   // 弯弯曲曲划过去（画圈时顺带碰到）：不判
      // 有画圈的关：穿过字块的这一段刀路拐了 > 0.6 弧度 = 在画圈的弧线上（字块在动，圈边常会扫进字块），不当成“切”
      if (S.cfg.circle && Math.abs(s.turn - (st.turn0 || 0)) > 0.6) { st.done = true; s.rej++; return; }
      st.done = true;
      const dt = t - st.et;
      const spd = dt > 3 ? L / dt * 1000 : 1e9;
      if (spd < S.vmin) { s.rej++; hint('快一点，嗖地划过去！', tl); return; }
      const ang = Math.atan2(cy, cx) - tl.rot;
      const sv = Math.abs(Math.sin(ang));
      const dir = sv >= (P2 ? 0.8 : 0.85) ? 'v' : sv <= (P2 ? 0.6 : 0.52) ? 'h' : '';
      if (!dir) {
        s.rej++;
        hint('刀要横平竖直！', tl);
        g.burst(x, y, { kind: 'spark', color: '#FFFFFF', n: 6 });
        return;
      }
      resolve(tl, dir, { x: (st.ex + x) / 2, y: (st.ey + y) / 2, dx: cx, dy: cy, s }, false);
    }
    function hint(text, tl) {
      const t = nowMs();
      if (t - S.hintT < 1200) return;
      S.hintT = t;
      g.float(text, clamp(tl.x, 110, g.w - 110), tl.y - tl.s * 0.85, { color: '#FFFFFF', size: 22 });
    }
    /* ---------- 画圈 ---------- */
    function loopCheck(s) {
      const pts = s.pts, n = pts.length - 1;
      if (n - s.loopFrom < 10) return;
      const p = pts[n], closeR = S.size * 0.55;
      let acc = 0;
      for (let j = n - 1; j > s.loopFrom; j--) {
        acc += Math.hypot(pts[j + 1].x - pts[j].x, pts[j + 1].y - pts[j].y);
        if (n - j < 10 || acc < S.size * 1.6) continue;
        if (Math.hypot(pts[j].x - p.x, pts[j].y - p.y) < closeR) {
          if (tryLoop(s, j, n)) { s.loopFrom = n; s.looped = true; }
          return;
        }
      }
    }
    function polyTurn(poly) {
      let sum = 0, last = null;
      for (let i = 1; i < poly.length; i++) {
        const dx = poly[i].x - poly[i - 1].x, dy = poly[i].y - poly[i - 1].y;
        if (dx * dx + dy * dy < 9) continue;
        const a = Math.atan2(dy, dx);
        if (last != null) { let da = a - last; while (da > Math.PI) da -= TAU; while (da < -Math.PI) da += TAU; sum += da; }
        last = a;
      }
      return Math.abs(sum);
    }
    function inPoly(poly, x, y) {
      let ins = false;
      for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
        const a = poly[i], b = poly[j];
        if ((a.y > y) !== (b.y > y) && x < (b.x - a.x) * (y - a.y) / (b.y - a.y || 1e-9) + a.x) ins = !ins;
      }
      return ins;
    }
    function posAt(tl, t) {
      let best = null, bd = 1e9;
      for (const h of tl.hist) { const d = Math.abs(h.t - t); if (d < bd) { bd = d; best = h; } }
      return best || tl;
    }
    function tryLoop(s, j, n) {
      const poly = s.pts.slice(j, n + 1);
      let x1 = 1e9, y1 = 1e9, x2 = -1e9, y2 = -1e9, mx = 0, my = 0;
      poly.forEach((q) => { x1 = Math.min(x1, q.x); x2 = Math.max(x2, q.x); y1 = Math.min(y1, q.y); y2 = Math.max(y2, q.y); mx += q.x; my += q.y; });
      mx /= poly.length; my /= poly.length;
      const bw = x2 - x1, bh = y2 - y1;
      if (Math.min(bw, bh) < S.size * 0.5 || Math.max(bw, bh) > S.size * 3.4) return false;
      if (polyTurn(poly) < 4.4) return false;
      const inside = [];
      for (const tl of S.tiles) {
        if (tl.state !== 'fly' || tl.cool > 0) continue;
        const p0 = posAt(tl, poly[0].t);
        if (!inPoly(poly, tl.x, tl.y) && !inPoly(poly, p0.x, p0.y)) continue;
        inside.push({ tl, d: Math.hypot(tl.x - mx, tl.y - my) });
      }
      if (!inside.length) return false;
      inside.sort((p, q) => p.d - q.d);
      if (S.grp) closeGroup(S.grp);
      // 圈里有包围结构的字：圈住它（旁边顺带圈进来的不算）；
      // 圈里只有一个字、又不是包围结构：圈错了（进错题本）；
      // 圈进好几个字、都不是包围结构：分不清想圈哪个 → 绳子崩断、扣心，不进错题本
      const hitO = inside.find((q) => q.tl.act === 'o');
      if (hitO) {
        S.ropes.push(ropeFrom(poly, hitO.tl, true));
        resolve(hitO.tl, 'o', { x: hitO.tl.x, y: hitO.tl.y, poly }, true);
      } else if (inside.length === 1) {
        resolve(inside[0].tl, 'o', { x: inside[0].tl.x, y: inside[0].tl.y, poly }, true);
      } else {
        const t0 = inside[0].tl;
        S.ropes.push(ropeFrom(poly, t0, false));
        inside.forEach((q) => { q.tl.cool = 0.3; q.tl.jolt = 0.4; });
        g.sfx('swing'); buzz(25);
        g.float('一次只圈一个字！', clamp(t0.x, 100, g.w - 100), t0.y - t0.s * 0.9, { color: '#FFFFFF', size: 22 });
        hurt(t0.x, t0.y);
      }
      return true;
    }

    /* ---------- 键盘 ---------- */
    function visible(t) { return t.state === 'fly' && t.y < S.bottom + t.s * 0.2 && t.y > g.hudTop; }
    function currentTarget() {
      let t = S.tiles.find((x) => x.id === S.targetId && visible(x));
      if (!t) {
        let best = null;
        for (const x of S.tiles) if (visible(x) && (!best || x.id < best.id)) best = x;
        t = best; S.targetId = t ? t.id : 0;
      }
      return t;
    }
    function switchTarget() {
      const vis = S.tiles.filter(visible).sort((a, b) => a.id - b.id);
      if (!vis.length) return;
      const i = vis.findIndex((x) => x.id === S.targetId);
      S.targetId = vis[(i + 1) % vis.length].id;
      S.kb = true; g.sfx('tick');
    }
    function kbCut(dir) {
      S.kb = true;
      if (S.stunT > 0) return;
      const tl = currentTarget();
      if (!tl || tl.cool > 0) return;
      const cr = Math.cos(tl.rot), sr = Math.sin(tl.rot);
      const ux = dir === 'v' ? -sr : cr, uy = dir === 'v' ? cr : sr, L = tl.R * 1.35;
      S.slashes.push({ x1: tl.x - ux * L, y1: tl.y - uy * L, x2: tl.x + ux * L, y2: tl.y + uy * L, age: 0, life: 0.18, col: BLADES[S.bladeI].tip });
      g.sfx('swing');
      resolve(tl, dir, { x: tl.x, y: tl.y, dx: ux, dy: uy }, true);
    }
    function kbCircle() {
      S.kb = true;
      if (S.stunT > 0) return;
      const tl = currentTarget();
      if (!tl || tl.cool > 0) return;
      if (tl.act === 'o') S.ropes.push(ropeFrom(null, tl, true));
      resolve(tl, 'o', { x: tl.x, y: tl.y }, true);
    }
    function slowBtn() { const r = 28 * S.sc; return { x: g.w - 14 - r, y: g.h - S.LH - 16 - r, r }; }
    function trySlow() {
      if (P2 || S.energy < 1 || S.slowT > 0) return false;
      S.energy = 0; S.slowT = 4.5; S.slowTick = 0;
      g.sfx('power'); g.flash('#CFEFFF');
      g.float('慢动作！', g.w / 2, g.hudTop + 90, { color: '#9FE8FF', size: 36 });
      return true;
    }

    /* ---------- 更新 ---------- */
    function stepTiles(sdt, dt, judge) {
      const tnow = nowMs();
      for (const t of S.tiles) {
        if (t.state !== 'fly') continue;
        t.vy += t.G * sdt; t.x += t.vx * sdt; t.y += t.vy * sdt;
        t.age += sdt;
        t.rot = t.rot0 + Math.sin(t.age * t.wf + t.ph) * t.wa;
        if (t.cool > 0) t.cool -= dt;
        if (t.jolt > 0) t.jolt -= dt;
        if (t.hintT > 0) t.hintT -= dt;
        if (t.x < S.left + t.s * 0.45 && t.vx < 0) t.vx = -t.vx * 0.6;
        if (t.x > S.right - t.s * 0.45 && t.vx > 0) t.vx = -t.vx * 0.6;
        t.hist.push({ t: tnow, x: t.x, y: t.y });
        if (t.hist.length > 40) t.hist.shift();
        if (t.vy > 0 && t.y - t.s > g.h) { t.state = 'gone'; if (judge) onEscape(t); }
      }
      if (S.tiles.some((t) => t.state !== 'fly')) S.tiles = S.tiles.filter((t) => t.state === 'fly');
    }
    function update(dt) {
      if (S.empty) return;
      S.bulletT = Math.max(0, S.bulletT - dt); S.stunT = Math.max(0, S.stunT - dt); S.trailRed = Math.max(0, S.trailRed - dt);
      S.lassoT = Math.max(0, S.lassoT - dt); S.bannerT = Math.max(0, S.bannerT - dt); S.legHiT = Math.max(0, S.legHiT - dt);
      if (S.slowT > 0) {
        S.slowT -= dt; S.slowTick -= dt;
        if (S.slowTick <= 0) { S.slowTick = 0.5; g.sfx('tick'); }
      }
      let tgt = S.cfg.ts;
      if (S.slowT > 0) tgt *= 0.42;
      if (S.bulletT > 0) tgt *= 0.5;
      if (S.lassoT > 0) tgt *= 0.6;
      tgt = Math.max(0.2, tgt);
      S.ts += (tgt - S.ts) * Math.min(1, dt * 9);
      let sdt = dt * S.ts;
      if (S.hitStop > 0) { S.hitStop -= dt; sdt *= 0.1; }
      S.clock += sdt;
      if (S.grp && (nowMs() - S.grp.t0 > 800 || S.grp.s !== S.stroke)) closeGroup(S.grp);
      if (g.state !== 'play') return;
      S.timeLeft -= dt;
      const sec = Math.ceil(S.timeLeft);
      if (sec <= 10 && sec !== S.lastSec) { S.lastSec = sec; if (sec > 0) g.sfx('tick'); }
      if (S.timeLeft <= 0) {
        S.timeLeft = 0;
        g.float('时间到！', g.w / 2, g.h * 0.42, { color: '#FFE45C', size: 44 });
        g.lose();
        return;
      }
      for (let i = S.pending.length - 1; i >= 0; i--) if (S.clock >= S.pending[i].at) { launch(S.pending[i].it); S.pending.splice(i, 1); }
      S.spawnT -= sdt;
      if (!busyCount() && !S.pending.length && S.spawnT > 0.35) S.spawnT = 0.35;
      if (S.spawnT <= 0) { spawnWave(); S.spawnT = S.cfg.gap * rand(0.85, 1.15); }
      stepTiles(sdt, dt, true);
    }

    /* ---------- 背景 ---------- */
    function ridge(x, w, base, amp, col, f, ph) {
      x.fillStyle = col; x.beginPath(); x.moveTo(0, base + 2);
      for (let i = 0; i <= 64; i++) {
        const u = i / 64, xx = u * w;
        const y = base - amp * (0.55 + 0.3 * Math.sin(u * f * 3.1 + ph) + 0.22 * Math.sin(u * f * 7.3 + ph * 2) + 0.35 * Math.pow(Math.abs(Math.sin(u * f * 1.7 + ph)), 6));
        x.lineTo(xx, y);
      }
      x.lineTo(w, base + 2); x.closePath(); x.fill();
    }
    function skyline(x, w, hz, m) {
      x.fillStyle = '#3A2462';
      // 滨海湾金沙：三座塔 + 空中花园
      const bx = w * 0.14, tw = m * 0.034, th = m * 0.19, gap = m * 0.052;
      for (let i = 0; i < 3; i++) { const tx = bx + i * gap; x.beginPath(); x.moveTo(tx, hz); x.lineTo(tx + tw * 0.15, hz - th); x.lineTo(tx + tw, hz - th); x.lineTo(tx + tw * 1.1, hz); x.closePath(); x.fill(); }
      rr(x, bx - m * 0.02, hz - th - m * 0.016, gap * 2 + tw + m * 0.06, m * 0.018, m * 0.009); x.fill();
      // 擎天树
      [[0.34, 0.12], [0.39, 0.16], [0.43, 0.1]].forEach(([u, hh]) => {
        const cx = w * u, top = hz - m * hh;
        x.beginPath(); x.moveTo(cx - m * 0.008, hz); x.lineTo(cx - m * 0.004, top); x.lineTo(cx + m * 0.004, top); x.lineTo(cx + m * 0.008, hz); x.fill();
        x.beginPath(); x.moveTo(cx - m * 0.045, top - m * 0.012); x.quadraticCurveTo(cx, top + m * 0.03, cx + m * 0.045, top - m * 0.012); x.lineTo(cx, top + m * 0.008); x.closePath(); x.fill();
      });
      // 宝塔
      const px = w * 0.86, pw = m * 0.07;
      let y = hz;
      for (let i = 0; i < 5; i++) {
        const k = 1 - i * 0.14, bw2 = pw * k, bh = m * 0.028;
        x.fillRect(px - bw2 * 0.35, y - bh, bw2 * 0.7, bh);
        y -= bh;
        x.beginPath(); x.moveTo(px - bw2 * 0.62, y + m * 0.004); x.quadraticCurveTo(px - bw2 * 0.3, y - m * 0.004, px, y - m * 0.018);
        x.quadraticCurveTo(px + bw2 * 0.3, y - m * 0.004, px + bw2 * 0.62, y + m * 0.004); x.closePath(); x.fill();
        y -= m * 0.01;
      }
      x.fillRect(px - m * 0.003, y - m * 0.04, m * 0.006, m * 0.04);
    }
    function paintBg(w, h, dpr) {
      const cv = D.createElement('canvas');
      cv.width = Math.max(1, Math.round(w * dpr)); cv.height = Math.max(1, Math.round(h * dpr));
      const x = cv.getContext('2d');
      x.setTransform(dpr, 0, 0, dpr, 0, 0);
      const hz = Math.round(h * 0.72), m = Math.min(w, h);
      let gr = x.createLinearGradient(0, 0, 0, hz);
      gr.addColorStop(0, '#2A1C66'); gr.addColorStop(0.38, '#71409A'); gr.addColorStop(0.74, '#E6727F'); gr.addColorStop(1, '#FFC47E');
      x.fillStyle = gr; x.fillRect(0, 0, w, hz + 1);
      const rng = mulberry(11);
      x.fillStyle = '#FFF6D8';
      for (let i = 0; i < 48; i++) { x.globalAlpha = 0.2 + rng() * 0.6; x.beginPath(); x.arc(rng() * w, rng() * hz * 0.42, 0.6 + rng() * 1.3, 0, TAU); x.fill(); }
      x.globalAlpha = 1;
      const sr = m * 0.15, sx = w * 0.7, sy = hz - m * 0.07;
      const rg = x.createRadialGradient(sx, sy, sr * 0.4, sx, sy, sr * 3.2);
      rg.addColorStop(0, 'rgba(255,220,150,.55)'); rg.addColorStop(1, 'rgba(255,170,130,0)');
      x.fillStyle = rg; x.fillRect(0, 0, w, hz);
      gr = x.createLinearGradient(0, sy - sr, 0, sy + sr); gr.addColorStop(0, '#FFF4BC'); gr.addColorStop(1, '#FF8D5C');
      x.save(); x.beginPath(); x.arc(sx, sy, sr, 0, TAU); x.clip();
      x.fillStyle = gr; x.fillRect(sx - sr, sy - sr, sr * 2, sr * 2);
      x.fillStyle = 'rgba(230,114,127,.85)';
      for (let i = 0; i < 4; i++) x.fillRect(sx - sr, sy + sr * (0.1 + i * 0.22), sr * 2, sr * (0.04 + i * 0.028));
      x.restore();
      ridge(x, w, hz, m * 0.17, '#83509A', 2.3, 0.4);
      ridge(x, w, hz, m * 0.1, '#5E3880', 4.1, 1.9);
      skyline(x, w, hz, m);
      // 栏杆
      const rh = m * 0.05;
      x.fillStyle = '#7E1F1B'; x.fillRect(0, hz - rh, w, m * 0.012); x.fillRect(0, hz - rh * 0.45, w, m * 0.01);
      x.fillStyle = '#B8342E';
      for (let px = 6; px < w; px += Math.max(40, w / 12)) x.fillRect(px, hz - rh - m * 0.008, m * 0.014, rh + m * 0.008);
      // 木地板
      gr = x.createLinearGradient(0, hz, 0, h); gr.addColorStop(0, '#B07445'); gr.addColorStop(1, '#6A3B20');
      x.fillStyle = gr; x.fillRect(0, hz, w, h - hz);
      x.strokeStyle = 'rgba(60,28,12,.35)'; x.lineWidth = 2;
      for (let i = -8; i <= 8; i++) { const xb = w / 2 + i * w * 0.14, xt = w / 2 + i * w * 0.14 * 0.4; x.beginPath(); x.moveTo(xt, hz); x.lineTo(xb, h); x.stroke(); }
      x.strokeStyle = 'rgba(255,225,180,.13)';
      [0.12, 0.3, 0.55, 0.85].forEach((u) => { const y = hz + (h - hz) * u; x.beginPath(); x.moveTo(0, y); x.lineTo(w, y); x.stroke(); });
      x.fillStyle = 'rgba(255,230,190,.45)'; x.fillRect(0, hz, w, 2);
      return cv;
    }
    function drawBamboo(c, x0, base, top, t, ph, sgn) {
      const sw = Math.max(9, Math.min(g.w, g.h) * 0.028);
      const ang = Math.sin(t * 0.8 + ph) * 0.025;
      c.save(); c.translate(x0, base); c.rotate(ang);
      const H = base - top;
      const gr = c.createLinearGradient(-sw / 2, 0, sw / 2, 0); gr.addColorStop(0, '#2E8A45'); gr.addColorStop(0.45, '#6BD27E'); gr.addColorStop(1, '#23703A');
      c.fillStyle = gr; c.fillRect(-sw / 2, -H, sw, H);
      c.fillStyle = '#1E5E31';
      const seg = Math.max(60, H / 7);
      for (let y = seg; y < H; y += seg) c.fillRect(-sw / 2 - 1, -y, sw + 2, 3);
      c.fillStyle = '#3FAE5A';
      for (let k = 0; k < 3; k++) {
        const ly = -H * (0.3 + k * 0.22);
        for (let j = 0; j < 3; j++) {
          c.save(); c.translate(sgn * sw * 0.4, ly); c.rotate(sgn * (0.5 + j * 0.35) + Math.sin(t * 1.3 + ph + j) * 0.08);
          c.beginPath(); c.ellipse(sgn * sw * 1.6, 0, sw * 1.7, sw * 0.32, 0, 0, TAU); c.fill(); c.restore();
        }
      }
      c.restore();
    }
    function drawLantern(c, ax, ay, len, t, ph) {
      const m = Math.min(g.w, g.h), a = Math.sin(t * 1.2 + ph) * 0.12;
      const lx = ax + Math.sin(a) * len, ly = ay + Math.cos(a) * len;
      const bw = m * 0.07, bh = m * 0.085;
      c.strokeStyle = 'rgba(40,20,20,.7)'; c.lineWidth = 1.5; c.beginPath(); c.moveTo(ax, ay); c.lineTo(lx, ly - bh / 2); c.stroke();
      const rg = c.createRadialGradient(lx, ly, 2, lx, ly, bw * 1.6);
      rg.addColorStop(0, 'rgba(255,190,90,.45)'); rg.addColorStop(1, 'rgba(255,120,60,0)');
      c.fillStyle = rg; c.beginPath(); c.arc(lx, ly, bw * 1.6, 0, TAU); c.fill();
      c.save(); c.translate(lx, ly); c.rotate(a);
      const gr = c.createLinearGradient(-bw / 2, 0, bw / 2, 0); gr.addColorStop(0, '#B81D1D'); gr.addColorStop(0.5, '#FF4A3A'); gr.addColorStop(1, '#A01818');
      c.fillStyle = gr; c.beginPath(); c.ellipse(0, 0, bw / 2, bh / 2, 0, 0, TAU); c.fill();
      c.strokeStyle = 'rgba(120,10,10,.55)'; c.lineWidth = 1;
      for (let i = -1; i <= 1; i++) { c.beginPath(); c.ellipse(0, 0, bw / 2 * Math.abs(i * 0.55) + 0.5, bh / 2, 0, 0, TAU); c.stroke(); }
      c.fillStyle = '#F5C542'; c.fillRect(-bw * 0.28, -bh / 2 - 4, bw * 0.56, 6); c.fillRect(-bw * 0.28, bh / 2 - 2, bw * 0.56, 6);
      c.strokeStyle = '#F5C542'; c.lineWidth = 2;
      for (let i = -1; i <= 1; i++) { c.beginPath(); c.moveTo(i * 3, bh / 2 + 4); c.lineTo(i * 4 + Math.sin(t * 2 + i) * 2, bh / 2 + 4 + bh * 0.35); c.stroke(); }
      c.restore();
    }
    function drawBg(c, vt) {
      const key = g.w + 'x' + g.h + '@' + g.dpr;
      if (V.bgKey !== key || !V.bg) { if (V.bg) { try { V.bg.width = 0; } catch (e) { /* ignore */ } } V.bg = paintBg(g.w, g.h, g.dpr); V.bgKey = key; }
      c.drawImage(V.bg, 0, 0, g.w, g.h);
      if (!V.clouds.length) for (let i = 0; i < 3; i++) V.clouds.push({ u: Math.random(), y: rand(0.16, 0.42), s: rand(0.55, 0.95), v: rand(0.006, 0.012) });
      V.clouds.forEach((cl) => { const x = ((cl.u + vt * cl.v) % 1.2) * (g.w + 240) - 180; g.cloud(x, g.h * cl.y, cl.s, 0.28); });
      const hz = g.h * 0.72;
      drawLantern(c, Math.max(g.w * 0.3, 124), g.hudTop - 20, Math.min(g.w, g.h) * 0.12, vt, 0);
      drawLantern(c, g.w * 0.84, g.hudTop - 20, Math.min(g.w, g.h) * 0.11, vt, 1.7);
      drawBamboo(c, Math.max(8, g.w * 0.02), g.h, g.h * 0.05, vt, 0, 1);
      drawBamboo(c, Math.max(22, g.w * 0.052), g.h, g.h * 0.2, vt, 1.1, 1);
      drawBamboo(c, g.w - Math.max(8, g.w * 0.02), g.h, g.h * 0.08, vt, 2.1, -1);
      drawBamboo(c, g.w - Math.max(22, g.w * 0.052), g.h, g.h * 0.24, vt, 0.6, -1);
      if (!V.petals.length) for (let i = 0; i < 16; i++) V.petals.push({ u: Math.random(), v: Math.random(), sp: rand(0.03, 0.07), ph: rand(0, TAU), s: rand(3, 6), col: i % 3 ? '#FFB8D2' : '#FFE2EC' });
      V.petals.forEach((p) => {
        const x = ((p.u + vt * p.sp * 0.7) % 1) * (g.w + 40) - 20 + Math.sin(vt * 1.5 + p.ph) * 14;
        const y = ((p.v + vt * p.sp) % 1) * (hz + 40) - 20;
        c.save(); c.translate(x, y); c.rotate(vt * 2 + p.ph); c.fillStyle = p.col; c.globalAlpha = 0.85;
        c.beginPath(); c.ellipse(0, 0, p.s, p.s * 0.55, 0, 0, TAU); c.fill(); c.restore();
      });
      c.globalAlpha = 1;
    }

    /* ---------- 画字块 / 碎片 ---------- */
    function drawGlyph(c, gd, ch, s, idx, color) {
      if (gd) {
        const k = s * GK / 1024;
        c.save(); c.scale(k, -k); c.translate(-512, -388);
        c.fillStyle = color || INK;
        if (idx) { for (const i of idx) c.fill(gd.paths[i]); } else { for (const p of gd.paths) c.fill(p); }
        c.restore();
      } else g.text(ch, 0, s * 0.02, { size: Math.round(s * 0.7), font: 'kai', color: color || INK, weight: 700 });
    }
    function drawBody(c, s, ci, armor) {
      const sp = bodySprite(s, ci, armor, g.dpr);
      c.drawImage(sp.cv, -sp.size / 2, -sp.size / 2, sp.size, sp.size);
    }
    function drawTile(c, t) {
      const jx = t.jolt > 0 ? Math.sin(t.jolt * 60) * 6 * t.jolt / 0.4 : 0;
      c.save();
      c.translate(t.x + jx, t.y); c.rotate(t.rot);
      drawBody(c, t.s, t.ci, t.armor);
      drawGlyph(c, t.gd, t.c, t.s, null, null);
      if (t.hintT > 0) drawHint(c, t);
      c.restore();
      if (t.hintT > 0) {
        const a = Math.min(1, t.hintT / 0.3);
        const txt = JGN(t.jg) + ' → ' + HOW[t.act];
        const tw = g.measure(txt, 17, 'round') + 22;
        const y = t.y - t.s * 0.95, x = clamp(t.x, tw / 2 + 6, g.w - tw / 2 - 6);
        c.globalAlpha = a;
        g.rrect(x - tw / 2, y - 15, tw, 30, 15, 'rgba(20,90,50,.92)', '#FFFFFF', 2);
        g.text(txt, x, y + 1, { size: 17, font: 'round', color: '#FFFFFF' });
        c.globalAlpha = 1;
      }
    }
    function drawHint(c, t) {
      const s = t.s, a = Math.min(1, t.hintT / 0.3);
      c.save(); c.globalAlpha = a;
      c.strokeStyle = '#2EE06A'; c.lineWidth = Math.max(4, s * 0.06); c.lineCap = 'round';
      c.setLineDash([s * 0.1, s * 0.07]); c.lineDashOffset = -nowMs() / 20;
      c.beginPath();
      if (t.act === 'v') { c.moveTo(0, -s * 0.72); c.lineTo(0, s * 0.72); }
      else if (t.act === 'h') { c.moveTo(-s * 0.72, 0); c.lineTo(s * 0.72, 0); }
      else if (t.act === 'o') c.arc(0, 0, s * 0.78, 0, TAU);
      c.stroke(); c.setLineDash([]);
      if (t.act === 'x') g.emoji('💣', s * 0.42, -s * 0.42, s * 0.36);
      c.restore();
    }
    function drawPiece(c, p) {
      const a = p.age > p.life - 0.4 ? Math.max(0, (p.life - p.age) / 0.4) : 1;
      if (a <= 0) return;
      c.save();
      c.globalAlpha = a;
      c.translate(p.x, p.y); c.rotate(p.rot);
      const sc = lerp(p.sc, p.sc1, easeOut(Math.min(1, p.age / 0.5)));
      if (sc !== 1) c.scale(sc, sc);
      if (p.glow) {
        const rg = c.createRadialGradient(0, 0, 2, 0, 0, p.s * 0.7);
        rg.addColorStop(0, 'rgba(255,245,170,.95)'); rg.addColorStop(1, 'rgba(255,220,90,0)');
        c.fillStyle = rg; c.beginPath(); c.arc(0, 0, p.s * 0.7, 0, TAU); c.fill();
      }
      if (p.body) {
        c.save();
        if (p.clip) { c.beginPath(); c.rect(p.clip.x0, p.clip.y0, p.clip.x1 - p.clip.x0, p.clip.y1 - p.clip.y0); c.clip(); }
        drawBody(c, p.s, p.ci, 0);
        c.restore();
      }
      c.save();
      if (p.clip && p.sclip) { c.beginPath(); c.rect(p.clip.x0, p.clip.y0, p.clip.x1 - p.clip.x0, p.clip.y1 - p.clip.y0); c.clip(); }
      drawGlyph(c, p.gd, p.ch, p.s, p.idx, p.ink);
      c.restore();
      c.restore();
    }
    function drawRope(c, r) {
      const t = r.age / r.life;
      c.save();
      c.lineCap = 'round'; c.lineJoin = 'round';
      if (r.ok) {
        const k = easeOut(Math.min(1, t * 1.6)) * 0.38;
        c.globalAlpha = t > 0.7 ? (1 - t) / 0.3 : 1;
        c.beginPath();
        r.pts.forEach((q, i) => { const x = lerp(q.x, r.cx, k), y = lerp(q.y, r.cy, k); if (i) c.lineTo(x, y); else c.moveTo(x, y); });
        c.closePath();
        c.strokeStyle = NAVY; c.lineWidth = 9; c.stroke();
        c.strokeStyle = '#FFD35C'; c.lineWidth = 5; c.stroke();
      } else {
        c.globalAlpha = Math.max(0, 1 - t);
        const n = r.pts.length, half = Math.floor(n / 2), drop = t * t * 90;
        [[0, half], [half, n]].forEach(([i0, i1], k) => {
          c.beginPath();
          for (let i = i0; i < i1; i++) { const q = r.pts[i]; const x = q.x + (k ? 1 : -1) * t * 30, y = q.y + drop; if (i === i0) c.moveTo(x, y); else c.lineTo(x, y); }
          c.strokeStyle = NAVY; c.lineWidth = 8; c.stroke();
          c.strokeStyle = '#FF7A7A'; c.lineWidth = 4; c.stroke();
        });
      }
      c.restore();
    }
    function drawTrail(c) {
      const now = nowMs(), tr = S.trail;
      while (tr.length && now - tr[0].t > 130) tr.shift();
      if (tr.length < 2) return;
      const bl = BLADES[S.bladeI], red = S.trailRed > 0, gray = S.stunT > 0;
      c.save(); c.lineCap = 'round'; c.lineJoin = 'round';
      for (let pass = 0; pass < 2; pass++) {
        c.strokeStyle = pass === 0 ? (red ? 'rgba(255,70,70,.55)' : gray ? 'rgba(160,160,180,.35)' : bl.glow) : (red ? '#FFD4D4' : gray ? '#D5D5DE' : bl.core);
        for (let i = 1; i < tr.length; i++) {
          const a = tr[i - 1], b = tr[i];
          if (b.brk) continue;
          const k = i / (tr.length - 1), age = (now - b.t) / 130;
          const wd = (pass === 0 ? 18 : 6) * S.sc * (0.25 + 0.75 * k) * (1 - age * 0.8);
          if (wd <= 0.4) continue;
          c.lineWidth = wd; c.beginPath(); c.moveTo(a.x, a.y); c.lineTo(b.x, b.y); c.stroke();
        }
      }
      c.restore();
    }
    function drawSlashes(c, vdt) {
      for (const sl of S.slashes) {
        sl.age += vdt;
        const t = sl.age / sl.life;
        if (t >= 1) continue;
        c.save(); c.globalAlpha = 1 - t; c.lineCap = 'round';
        c.strokeStyle = 'rgba(255,255,255,.45)'; c.lineWidth = 16 * S.sc * (1 - t);
        c.beginPath(); c.moveTo(sl.x1, sl.y1); c.lineTo(sl.x2, sl.y2); c.stroke();
        c.strokeStyle = sl.col; c.lineWidth = 5 * S.sc;
        c.beginPath(); c.moveTo(sl.x1, sl.y1); c.lineTo(sl.x2, sl.y2); c.stroke();
        c.restore();
      }
      S.slashes = S.slashes.filter((sl) => sl.age < sl.life);
    }
    function drawLabels(c, vdt) {
      for (const L of S.labels) {
        L.age += vdt;
        const t = L.age / L.life;
        if (t >= 1) continue;
        const a = t > 0.7 ? (1 - t) / 0.3 : Math.min(1, t / 0.08);
        const y = L.y - easeOut(Math.min(1, t * 1.4)) * 34;
        c.globalAlpha = a;
        const tag = L.jg + ' ✓';
        const tw = g.measure(tag, 15, 'round') + 16;
        g.rrect(L.x - tw / 2, y - 44, tw, 24, 12, 'rgba(34,160,90,.92)', '#FFFFFF', 1.5);
        g.text(tag, L.x, y - 32, { size: 15, font: 'round', color: '#FFFFFF' });
        if (L.w) {
          g.text(L.w, L.x, y - 2, { size: 30, font: 'kai', color: '#FFFFFF', stroke: NAVY, strokeW: 5, weight: 700 });
          const py = L.py || L.cpy;
          if (py) g.text(L.py ? py : L.ch + ' ' + py, L.x, y + 27, { size: 16, font: 'py', color: '#FFF3B0', stroke: NAVY, strokeW: 3.5 });
        } else g.text(L.ch, L.x, y - 2, { size: 34, font: 'kai', color: '#FFFFFF', stroke: NAVY, strokeW: 5, weight: 700 });
        c.globalAlpha = 1;
      }
      S.labels = S.labels.filter((L) => L.age < L.life);
    }
    function drawStructIcon(c, a, x, y, sz) {
      const hs = sz / 2;
      c.save();
      c.fillStyle = '#FFF6E0'; rr(c, x - hs, y - hs, sz, sz, sz * 0.2); c.fill();
      c.strokeStyle = NAVY; c.lineWidth = 1.5; c.stroke();
      c.lineCap = 'round';
      if (a === 'v' || a === 'h') {
        c.fillStyle = 'rgba(29,43,83,.22)';
        if (a === 'v') { c.fillRect(x - hs + 3, y - hs + 3, hs - 5, sz - 6); c.fillRect(x + 2, y - hs + 3, hs - 5, sz - 6); }
        else { c.fillRect(x - hs + 3, y - hs + 3, sz - 6, hs - 5); c.fillRect(x - hs + 3, y + 2, sz - 6, hs - 5); }
        c.strokeStyle = '#FF3B3B'; c.lineWidth = 2.6; c.beginPath();
        if (a === 'v') { c.moveTo(x, y - hs - 5); c.lineTo(x, y + hs + 5); } else { c.moveTo(x - hs - 5, y); c.lineTo(x + hs + 5, y); }
        c.stroke();
      } else if (a === 'x') {
        c.fillStyle = 'rgba(29,43,83,.22)'; c.fillRect(x - hs + 3, y - hs + 3, sz - 6, sz - 6);
        g.emoji('💣', x + hs * 0.55, y - hs * 0.5, sz * 0.62);
      } else {
        c.strokeStyle = 'rgba(29,43,83,.6)'; c.lineWidth = 2;
        c.beginPath(); c.moveTo(x + hs - 3, y - hs + 4); c.lineTo(x - hs + 4, y - hs + 4); c.lineTo(x - hs + 4, y + hs - 4); c.lineTo(x + hs - 3, y + hs - 4); c.stroke();
        c.fillStyle = 'rgba(29,43,83,.22)'; c.fillRect(x - hs * 0.35, y - hs * 0.4, hs * 1.05, hs * 0.8);
        c.strokeStyle = '#FFC93C'; c.lineWidth = 2.4; c.setLineDash([3, 2.5]);
        c.beginPath(); c.arc(x, y, hs * 1.32, 0, TAU); c.stroke(); c.setLineDash([]);
      }
      c.restore();
    }
    function legendItems() {
      const it = [{ a: 'v', t: '左右', h: '竖切' }, { a: 'h', t: '上下', h: '横切' }, { a: 'x', t: '独体', h: '别切' }];
      if (S.cfg.circle) it.push({ a: 'o', t: '包围', h: '画圈' });
      return it;
    }
    function drawLegend(c) {
      const LH = S.LH, y0 = g.h - LH;
      c.fillStyle = 'rgba(22,12,46,.66)';
      rr(c, 0, y0, g.w, LH + 12, 14); c.fill();
      c.fillStyle = 'rgba(255,255,255,.18)'; c.fillRect(0, y0, g.w, 1.5);
      const items = legendItems(), n = items.length;
      const band = Math.min(g.w - 8, 680), x0 = (g.w - band) / 2, cw = band / n;
      const isz = Math.round(clamp(LH * 0.46, 20, 26));
      items.forEach((m, i) => {
        const cx = x0 + cw * (i + 0.5), cy = y0 + LH / 2;
        if (S.legHi === m.a && S.legHiT > 0) {
          const pa = 0.55 + 0.45 * Math.sin(nowMs() / 90);
          c.globalAlpha = pa; g.rrect(cx - cw / 2 + 4, y0 + 4, cw - 8, LH - 8, 10, 'rgba(46,224,106,.35)', '#2EE06A', 2); c.globalAlpha = 1;
        }
        const ix = cx - cw * 0.2;
        drawStructIcon(c, m.a, ix, cy, isz);
        g.text(m.t, ix + isz * 0.8, cy - 9, { size: 15, font: 'round', color: '#FFFFFF', align: 'left' });
        g.text(m.h, ix + isz * 0.8, cy + 10, { size: 14, font: 'round', color: '#FFE45C', align: 'left' });
      });
    }
    function drawTimer(c) {
      const sec = Math.max(0, Math.ceil(S.timeLeft));
      const low = sec <= 10 && g.state === 'play';
      const h = 30, w = 76, x = Math.round(g.w / 2 - w / 2), y = g.hudTop + 2;   // 居中：左边是引擎的“朗读中”小喇叭，右边是连击徽章
      const pulse = low ? 1 + 0.08 * Math.sin(nowMs() / 80) : 1;
      c.save(); c.translate(x + w / 2, y + h / 2); c.scale(pulse, pulse); c.translate(-(x + w / 2), -(y + h / 2));
      g.rrect(x, y, w, h, 15, low ? 'rgba(210,40,60,.9)' : 'rgba(22,12,46,.6)', 'rgba(255,255,255,.4)', 1.5);
      g.emoji('⏱️', x + 17, y + h / 2, 18);
      g.text(String(sec), x + 50, y + h / 2 + 1, { size: 20, font: 'num', color: '#FFFFFF' });
      c.restore();
    }
    function drawSlowBtn(c) {
      if (P2) return;
      const b = slowBtn(), ready = S.energy >= 1 && S.slowT <= 0;
      const pulse = ready ? 1 + 0.07 * Math.sin(nowMs() / 110) : 1;
      c.save(); c.translate(b.x, b.y); c.scale(pulse, pulse);
      c.fillStyle = ready ? '#3FB6FF' : 'rgba(22,12,46,.6)';
      c.beginPath(); c.arc(0, 0, b.r, 0, TAU); c.fill();
      c.lineWidth = 2; c.strokeStyle = 'rgba(255,255,255,.6)'; c.stroke();
      const prog = S.slowT > 0 ? S.slowT / 4.5 : S.energy;
      c.strokeStyle = S.slowT > 0 ? '#FFE45C' : '#9FE8FF'; c.lineWidth = 5; c.lineCap = 'round';
      c.beginPath(); c.arc(0, 0, b.r - 4, -Math.PI / 2, -Math.PI / 2 + TAU * prog); c.stroke();
      c.globalAlpha = ready || S.slowT > 0 ? 1 : 0.55;
      g.emoji('⏳', 0, 0, b.r * 1.05);
      c.restore();
      if (ready) g.text('慢动作', b.x, b.y - b.r - 12, { size: 15, font: 'round', color: '#9FE8FF', stroke: NAVY, strokeW: 3 });
    }
    function drawBanner(c) {
      if (!(S.bannerT > 0) || !S.banner) return;
      const t = S.bannerT, a = t > 3.0 ? (3.4 - t) / 0.4 : t < 0.5 ? t / 0.5 : 1;
      const y = S.top + 30 + (S.bottom - S.top) * 0.1;
      const bw = Math.min(g.w - 24, 540), bh = S.banner.sub ? 92 : 60;
      c.globalAlpha = a;
      g.rrect(g.w / 2 - bw / 2, y - bh / 2, bw, bh, 18, 'rgba(22,12,46,.78)', 'rgba(255,228,92,.8)', 2.5);
      g.shadowText(S.banner.title, g.w / 2, y - (S.banner.sub ? 16 : 0), { size: 30, color: '#FFE45C', maxW: bw - 30 });
      if (S.banner.sub) g.text(S.banner.sub, g.w / 2, y + 22, { size: 17, font: 'round', color: '#FFFFFF', maxW: bw - 24 });
      c.globalAlpha = 1;
    }
    function drawReticle(c, t) {
      const r = t.R * 1.15, rot = nowMs() / 400;
      c.save(); c.translate(t.x, t.y);
      c.strokeStyle = '#FFE45C'; c.lineWidth = 3; c.setLineDash([10, 8]); c.lineDashOffset = -rot * 20;
      c.beginPath(); c.arc(0, 0, r, 0, TAU); c.stroke(); c.setLineDash([]);
      for (let i = 0; i < 4; i++) { const a = i * Math.PI / 2 + rot; c.beginPath(); c.moveTo(Math.cos(a) * (r + 3), Math.sin(a) * (r + 3)); c.lineTo(Math.cos(a) * (r + 12), Math.sin(a) * (r + 12)); c.stroke(); }
      c.restore();
    }

    /* ---------- spec ---------- */
    const spec = {
      maxLevel: 10,
      lives: P2 ? 5 : 3,
      rounds: (lv) => roundsFor(lv, P2),
      music: 'drum',
      sky: null,
      comboAt: (gg) => [gg.w / 2, gg.hudTop + 112],   // “连击×N”飘在计时牌下面，别叠在计时牌上
      intro: P2 ? '看清字的结构再下刀！左右结构竖着切，上下结构横着切，独体字是炸弹——别切！'
        : '看结构下刀！左右竖切、上下横切、独体字是炸弹别切；第 2 关起包围结构要画圈！',
      controls: P2 ? '手指 / 鼠标快快划过字块 · 键盘 ↑↓ 竖切 ←→ 横切 · X 换目标'
        : '划过字块下刀 · 键盘 ↑↓ 竖切 ←→ 横切 空格画圈 X 换目标 Enter 慢动作',
      init(gg) {
        g = gg;
        if (!POOL) POOL = gradePool(g.G, g.grade || ctx.grade);
        if (!WORDS) WORDS = wordIndex(g.grade);
        const lv = g.level;
        S = {
          cfg: Object.assign({}, cfgFor(lv, P2)), tiles: [], pieces: [], ropes: [], labels: [], trail: [], slashes: [], booms: [], pending: [],
          stroke: null, grp: null, uid: 0, clock: 0, byCat: { v: [], h: [], o: [] }, decks: {}, lastCat: '', catRun: 0, ts: P2 ? cfgFor(lv, P2).ts : 1, spawnT: 0.8, bombRun: 0, deck: [], lastC: '',
          energy: 0, slowT: 0, slowTick: 0, bulletT: 0, stunT: 0, lassoT: 0, hitStop: 0, trailRed: 0, legHi: '', legHiT: 0,
          hintT: 0, tapHintT: 0, swishT: 0, bannerT: 0, banner: null, lastSec: 99, kb: false, targetId: 0, cutsTotal: 0,
          review: null, rq: [], rqDone: new Set(), empty: false,
          bladeI: lv <= 3 ? 0 : lv <= 6 ? 1 : 2
        };
        layoutCalc();
        if (g.isReview) {
          const seen = new Set();
          const rv = (g.items('jg', 40) || []).map((x) => (x && okItem(x.c, x.jg) ? mkItem(x.c, x.jg) : null)).filter((x) => x && !seen.has(x.c) && seen.add(x.c));
          if (rv.length) {
            S.review = rv.slice(0, 10);
            S.rq = S.review.slice();
            if (S.review.some((x) => ACT[x.jg] === 'o')) S.cfg.circle = true;
            S.cfg.maxOn = Math.min(S.cfg.maxOn, 2); S.cfg.wave = 1;
            g.rounds = S.review.length;
          }
        }
        if (!S.review) {
          const items = POOL.filter(allowed);
          S.cuts = items.filter((x) => ACT[x.jg] !== 'x');
          S.bombs = items.filter((x) => ACT[x.jg] === 'x');
          S.byCat = { v: [], h: [], o: [] };
          S.cuts.forEach((x) => S.byCat[ACT[x.jg]].push(x));
          S.decks = {};
          Object.keys(S.byCat).forEach((k) => { if (S.byCat[k].length) S.decks[k] = []; });
          if (!S.cuts.length) { S.empty = true; g.rounds = 1; }
        } else { S.cuts = []; S.bombs = []; }
        S.timeMax = S.review ? 40 + g.rounds * 8 : P2 ? 30 + g.rounds * 9 : Math.round(20 + g.rounds * 5.5);
        S.timeLeft = S.timeMax;
        const B = BLADES[S.bladeI];
        if (S.review) S.banner = { title: '错题重练', sub: '把上次切错的字再切一遍' };
        else if (P2) S.banner = lv === 1 ? { title: '看结构下刀！', sub: '左右竖切 · 上下横切 · 独体别切' } : { title: '第 ' + lv + ' 关', sub: lv === 3 ? '字块一次飞两个啦！' : '左右竖切 · 上下横切 · 独体别切' };
        else if (lv === 1) S.banner = { title: '切字忍者上场！', sub: '左右竖切 · 上下横切 · 独体别切' };
        else if (lv === 2) S.banner = { title: '新招式：画圈！', sub: '半包围、全包围结构 → 画个圈圈住' };
        else if (lv === 4) S.banner = { title: '铁甲字来了！', sub: '笔画多的字包着铁甲：先切掉铁甲，再切字 · 新刀：' + B.name };
        else if (lv === 6) S.banner = { title: '字块会摇晃！', sub: '跟着字自己的方向下刀' };
        else if (lv === 7) S.banner = { title: '新刀：' + B.name, sub: '字越飞越快，看准结构再出手' };
        else S.banner = { title: '第 ' + lv + ' 关', sub: '连斩 5 个字触发子弹时间' };
        try { W.__hwSlash = { g, S, P2, api: { rect: () => g.c.canvas.getBoundingClientRect(), target: () => currentTarget(), pool: () => POOL.slice(), word: (c) => WORDS.get(c) || null, spawn: (c) => { const it = POOL.find((x) => x.c === c); if (it) launch(it); return !!it; } } }; } catch (e) { /* ignore */ }
      },
      play() {
        S.bannerT = 3.4;
        S.spawnT = 1.1;
        if (P2 && g.level <= 2 && !S.review) g.say('左右结构竖着切，上下结构横着切，独体字不能切。');
        else if (!P2 && g.level === 2 && !S.review) g.say('包围结构，画个圈把它圈住。');
      },
      update(gg, dt) { update(dt); },
      draw(gg, c) {
        const t = nowMs();
        const vdt = V.last ? Math.min(0.05, (t - V.last) / 1000) : 0;
        V.last = t; V.t += vdt;
        drawBg(c, V.t);
        if (S.empty) {
          g.rrect(g.w / 2 - 150, g.h * 0.4 - 40, 300, 80, 18, 'rgba(22,12,46,.8)', '#FFE45C', 2);
          g.text('这个年级的字还在准备中', g.w / 2, g.h * 0.4, { size: 20, font: 'round', color: '#FFFFFF' });
          return;
        }
        if (g.state === 'over') stepTiles(vdt * S.ts, vdt, false);
        const pdt = vdt * (g.state === 'play' ? S.ts : 1);
        for (const p of S.pieces) { p.age += vdt; p.vy += p.G * pdt; p.x += p.vx * pdt; p.y += p.vy * pdt; p.rot += p.vr * pdt; }
        S.pieces = S.pieces.filter((p) => p.age < p.life && p.y < g.h + p.s * 1.5);
        drawBanner(c);
        for (const t2 of S.tiles) drawTile(c, t2);
        for (const p of S.pieces) drawPiece(c, p);
        for (const r of S.ropes) { r.age += vdt; if (r.age < r.life) drawRope(c, r); }
        S.ropes = S.ropes.filter((r) => r.age < r.life);
        for (const b of S.booms) {
          b.age += vdt;
          const k = b.age / b.life;
          if (k < 1) g.emoji('💥', b.x, b.y, S.size * (0.9 + k * 1.1), { alpha: 1 - k });
        }
        S.booms = S.booms.filter((b) => b.age < b.life);
        drawSlashes(c, vdt);
        drawTrail(c);
        if (S.kb && g.state === 'play') { const tg = currentTarget(); if (tg) drawReticle(c, tg); }
        drawLabels(c, vdt);
        if (S.slowT > 0 || S.bulletT > 0) {
          const rg = c.createRadialGradient(g.w / 2, g.h / 2, Math.min(g.w, g.h) * 0.3, g.w / 2, g.h / 2, Math.max(g.w, g.h) * 0.75);
          rg.addColorStop(0, 'rgba(80,170,255,0)'); rg.addColorStop(1, S.slowT > 0 ? 'rgba(80,170,255,.32)' : 'rgba(255,255,255,.22)');
          c.fillStyle = rg; c.fillRect(0, 0, g.w, g.h);
        }
        if (S.stunT > 0 && g.state === 'play') {
          const p = S.trail.length ? S.trail[S.trail.length - 1] : { x: g.w / 2, y: g.h / 2 };
          g.text('💫 刀晕了', clamp(p.x, 70, g.w - 70), clamp(p.y - 50, g.hudTop + 60, g.h - 80), { size: 20, font: 'round', color: '#FFFFFF', stroke: NAVY, strokeW: 4 });
        }
        drawLegend(c);
        drawTimer(c);
        drawSlowBtn(c);
      },
      down(gg, p) {
        if (S.empty) return;
        if (!P2) {
          const b = slowBtn();
          if (Math.hypot(p.x - b.x, p.y - b.y) < b.r + 10) { trySlow(); return; }
        }
        strokeStart(p);
      },
      move(gg, p) { if (p.down) strokeMove(p); },
      up() { strokeEnd(); },
      key(gg, k) {
        if (S.empty) return;
        S.lastStroke = nowMs();
        if (k === 'up' || k === 'down' || k === 'w' || k === 'W' || k === 's' || k === 'S') kbCut('v');
        else if (k === 'left' || k === 'right' || k === 'a' || k === 'A' || k === 'd' || k === 'D') kbCut('h');
        else if (k === 'space' || k === 'o' || k === 'O') { if (S.cfg.circle) kbCircle(); }
        else if (k === 'x' || k === 'X') switchTarget();
        else if (k === 'enter' || k === 'z' || k === 'Z') trySlow();
      },
      resize() { layoutCalc(); },
      end() { try { if (W.__hwSlash && W.__hwSlash.g === g) W.__hwSlash = null; } catch (e) { /* ignore */ } }
    };
    return spec;
  }

  HW.register({
    id: 'slash', skill: 'write', kind: 'arcade', name: '切字忍者', icon: '🥷',
    blurb: '看字的结构下刀：左右竖切、上下横切、独体别切',
    cols: ['chars'], data: ['chars'], reviewN: 10,
    start(ctx) {
      if (!HW.arcade || typeof HW.arcade.run !== 'function') {
        try { ctx.el.appendChild(ctx.h('div', { class: 'hw-card hw-center' }, '游戏引擎没有加载，先玩别的吧。')); } catch (e) { /* ignore */ }
        return undefined;
      }
      return HW.arcade.run(ctx, makeSpec(ctx));
    }
  });
})();
