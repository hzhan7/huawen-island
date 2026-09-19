/* =====================================================================
 * 华文小岛 2.0 · 街机游戏 11：👾 写字打怪兽（id: monster · skill: write · 题库栏目: chars；第 6 关起混入 words 听写）
 * 规格：SPEC_ARCADE.md §4 第 11 条。引擎：parts/15_arcade.js（HW.arcade.run）。
 *
 * 玩法：
 *   战场（竖屏在上、横屏在左）：左边一座中式城楼（熊猫炮手 + 大炮），右边“字怪兽”一跳一跳地逼近，
 *   头顶血条 = 这个字的笔画数，肚子上印着要写的字（听写关印“？”）。
 *   写字板（竖屏在下、横屏在右）：HanziWriter 田字格（quiz 模式，用 spec.dom 叠在画布上）。
 *   写对一笔 → 大炮发射火球，击中怪兽掉 1 格血（闪白、击退、飘“-1”）；连续写对，火球 橙 → 蓝 → 紫 升级。
 *   写错一笔 → 怪兽“吼！”地往前跳一大步。写完整个字 → 怪兽鼓胀爆炸成星星彩纸，字化成金色“战利品”飞起；
 *   下一只更大，每关最后一只是戴王冠的怪兽大王。怪兽冲到城楼 → 撞城扣 1 心（记错题本），被弹回去晕一会儿，
 *   田字格同时亮出这一笔的提示。第 2 关起偶尔飘过孔明灯，点一下 +5 分（奖励，不影响写字）。
 * 关卡：1–2 描红（有轮廓，错 1 次提示）；3–5 照着写（字卡给范字，没有轮廓，错 2 次提示）；
 *   6–10 听写（只朗读 + 拼音，不显示字，错 3 次提示；混入 words 词语：一个词的每个字各是一只怪兽）。
 *   越往后怪兽走得越快、写错跳得越远，天色 白天 → 黄昏 → 夜晚。每关 5 个字。年级越高怪兽越快（GRADE_K）。
 *   怪兽走进最后 30% 的路：城楼边红光闪、熊猫头上冒“！”、每一跳“嗒”一声。
 * 正确答案：就是 chars.c / words.w 里的字本身；笔顺判定交给 HanziWriter + 内嵌 HW_STROKES，无笔顺数据的字不出题。
 * 错题本：怪兽撞城 → 一定扣心；听写关、或这个字写错过笔 / 看过提示 → g.wrong(题目, 说明)，
 *   描红 / 照写一笔没错只是手慢 → g.wrong(null)（扣心不记错题本）；非描红关一个字写错 ≥3 笔 → ctx.score.wrong（只记错题本，不扣心）。
 * 排版：竖屏 战场在上 / 写字板在下；横屏 战场在左 / 写字板在右；矮横屏（手机横放）字卡一列放在田字格左边，
 *   并按“屏幕上看得见的高度”排版（引擎画布下限 480 高，手机横放时下半截在屏幕外）。
 * 操作：手指 / 鼠标在田字格里按笔顺写；点字卡 🔊 或 空格/回车 重听；点 💡 或按 H 看下一笔提示；点孔明灯拿奖励。
 * 调试：window.__monster = 当前 g（g.M 为本关状态），供 tools/shot.js 的 steps 读取。
 * ===================================================================== */
(function () {
  'use strict';
  const W = window, D = document;
  const HW = W.HW;
  if (!HW || typeof HW.register !== 'function') return;

  const TAU = Math.PI * 2;
  const NAVY = '#1d2b53';
  const SVGNS = 'http://www.w3.org/2000/svg';
  const str = (v) => (v == null ? '' : String(v));
  const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
  const lerp = (a, b, t) => a + (b - a) * t;
  const rand = (a, b) => a + Math.random() * (b - a);
  const isHan = (ch) => /[㐀-鿿豈-﫿]/.test(ch);
  const nowMs = () => (W.performance && performance.now ? performance.now() : Date.now());
  const outBack = (t) => { const s = 1.7, u = t - 1; return u * u * ((s + 1) * u + s) + 1; };
  function outBounce(t) {
    const n = 7.5625, d = 2.75;
    if (t < 1 / d) return n * t * t;
    if (t < 2 / d) { t -= 1.5 / d; return n * t * t + 0.75; }
    if (t < 2.5 / d) { t -= 2.25 / d; return n * t * t + 0.9375; }
    t -= 2.625 / d; return n * t * t + 0.984375;
  }
  function strokeData(ch) {
    try {
      const d = W.HW_STROKES && W.HW_STROKES[ch];
      return d && Array.isArray(d.strokes) && d.strokes.length && Array.isArray(d.medians) ? d : null;
    } catch (e) { return null; }
  }

  /* ---------- 关卡参数（下标 = 关卡 - 1） ---------- */
  const LV = {
    mode:  ['trace', 'trace', 'copy', 'copy', 'copy', 'dict', 'dict', 'dict', 'dict', 'dict'],
    // 走完全程秒数 = base + per × 笔画数。按“孩子每笔 2–3 秒”估：正常写，怪兽会走到半路才被打爆（看得见它在逼近）；
    // 每笔磨蹭 5 秒以上 / 连着写错，就会撞城。
    base:  [16, 14, 15, 13, 11, 17, 15, 13, 11, 9],
    per:   [4.6, 4.2, 4.4, 3.9, 3.5, 4.5, 4.0, 3.5, 3.1, 2.8],
    leap:  [0.07, 0.08, 0.08, 0.09, 0.1, 0.09, 0.1, 0.11, 0.12, 0.13],     // 写错一笔：怪兽往前跳多远（全程 = 1）
    knock: [0.016, 0.015, 0.015, 0.014, 0.013, 0.014, 0.013, 0.012, 0.011, 0.01], // 写对一笔：火球把怪兽打退多远
    words: [0, 0, 0, 0, 0, 1, 1, 1, 2, 2]                                 // 听写关混入几个 words 词语
  };
  // 年级系数（乘在“走完全程秒数”上）：同一关，高年级孩子写得快，怪兽也要走得快，否则 P6 第 5 关怪兽走不到半路就被打爆，毫无压力。
  // 试玩实测（每笔约 1.8 秒、10% 写错）：P6 第 5 关 原来怪兽最近只到 0.56（全程 = 1）→ 乘 0.78 后约 0.3–0.45，看得见它在逼近。
  const GRADE_K = { 2: 1, 3: 0.94, 4: 0.88, 5: 0.83, 6: 0.78 };
  const HINT_MISS = { trace: 1, copy: 2, dict: 3 };
  const IDLE_HINT = { trace: 6, copy: 8, dict: 11 };           // 发呆几秒后手指提示下一笔
  const MODE_TAG = { trace: ['描红', '#3CCB5A', '#1E9440'], copy: ['照着写', '#3AA0FF', '#1C6CC8'], dict: ['听写', '#A45CFF', '#6A2FC8'] };
  function P(lv) { const i = clamp((lv | 0) - 1, 0, 9); const o = {}; for (const k in LV) o[k] = LV[k][i]; return o; }

  /* ---------- 怪兽造型 ---------- */
  const MON = [
    { body: '#6BD66F', dark: '#2F9E4F', belly: '#D6F8C6', horns: 0, eyes: 2 },                       // 绿泡泡
    { body: '#A77BFF', dark: '#6A3FD1', belly: '#E8DCFF', horns: 1, eyes: 1 },                       // 独眼紫
    { body: '#FF7A59', dark: '#C9442A', belly: '#FFE1CC', horns: 2, eyes: 2, fang: true },           // 红角怪
    { body: '#57C7EF', dark: '#1F8FC2', belly: '#DAF5FF', horns: 0, eyes: 2, ghost: true },          // 蓝幽灵
    { body: '#FF8CC6', dark: '#D24D93', belly: '#FFE4F1', horns: 2, eyes: 2, fluff: true }           // 粉毛球
  ];
  const BOSS = { body: '#7C5CFF', dark: '#4A2FB8', belly: '#FFEBAE', horns: 2, eyes: 2, fang: true, spikes: true, crown: true };

  /* ---------- 天色（1–3 白天 / 4–6 黄昏 / 7–10 夜晚） ---------- */
  const THEME = {
    day: { sky: ['#37A9F4', '#86D3FF', '#DAF4FF'], far: '#A9D3EE', farWin: null, hill1: '#95D98A', hill2: '#62C166', grass: '#6CC45A',
      grass2: '#4FA746', soil: '#8FCB6B', path: '#EFCF93', path2: '#D8B06E', tuft: '#3F9C40', cloudA: 1, wall: ['#F2E0BA', '#D4B581'] },
    dusk: { sky: ['#5667C8', '#EE8CA2', '#FFD68E'], far: '#B98AA8', farWin: 'rgba(255,226,150,.85)', hill1: '#86AF74', hill2: '#5A9255', grass: '#5FA851',
      grass2: '#478F42', soil: '#76A85A', path: '#E2B87D', path2: '#C49B60', tuft: '#3A7E39', cloudA: 0.9, wall: ['#F0D6AE', '#CDA474'] },
    night: { sky: ['#0A1440', '#1A2966', '#37508F'], far: '#233066', farWin: 'rgba(255,214,110,.9)', hill1: '#25525A', hill2: '#1B4247', grass: '#2F6B48',
      grass2: '#255A3D', soil: '#2C5A40', path: '#9A8560', path2: '#7B6A46', tuft: '#1F5236', cloudA: 0.3, wall: ['#C9B38A', '#98815B'] }
  };
  const themeOf = (lv) => (lv <= 3 ? 'day' : lv <= 6 ? 'dusk' : 'night');
  const FIRE = [
    { core: '#FFF6C2', mid: '#FFA41F', glow: 'rgba(255,130,30,', spark: '#FFD23F' },
    { core: '#EAFBFF', mid: '#3FB8FF', glow: 'rgba(40,150,255,', spark: '#A6E6FF' },
    { core: '#FFEAFF', mid: '#C06BFF', glow: 'rgba(175,80,255,', spark: '#F4B8FF' }
  ];

  /* ---------- 小绘图工具 ---------- */
  function ell(c, x, y, rx, ry, fill, stroke, lw, rot) {
    c.beginPath(); c.ellipse(x, y, Math.max(0.1, rx), Math.max(0.1, ry), rot || 0, 0, TAU);
    if (fill) { c.fillStyle = fill; c.fill(); }
    if (stroke) { c.lineWidth = lw || 2; c.strokeStyle = stroke; c.stroke(); }
  }
  function lcg(seed) { let s = (seed >>> 0) || 1; return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; }; }

  /* ---------- 样式（类名 g-monster- 开头） ---------- */
  let cssDone = false;
  function injectCss() {
    if (cssDone || typeof HW.css !== 'function') return;
    cssDone = true;
    HW.css(`
.g-monster-host{position:absolute;left:0;top:0;width:100%;height:100%;pointer-events:none!important;overflow:hidden}
.g-monster-box{position:absolute!important;margin:0!important;pointer-events:auto!important;touch-action:none;cursor:crosshair;
  --paper:#FFFDF3;--grid:#EE9A90;background-color:#FFFDF3!important;border-color:#E2574A!important;border-radius:3px;
  -webkit-user-select:none;user-select:none;-webkit-touch-callout:none}
.g-monster-box.is-in{animation:g-monster-pop .5s cubic-bezier(.2,1.6,.4,1) both}
/* 写错时田字格只轻轻晃（原来 ±10px + 转 2°）：HanziWriter 按 getBoundingClientRect 换算笔迹坐标，晃太大时紧接着写的下一笔会被判歪 */
.g-monster-box.is-bad{animation:g-monster-wig .3s ease-out}
.g-monster-trail{position:absolute;display:none;pointer-events:none;overflow:visible}
.g-monster-trail path{fill:none;stroke:#FFB020;stroke-linecap:round;stroke-linejoin:round;opacity:.9;
  stroke-dasharray:100;stroke-dashoffset:100;animation:g-monster-dash 1.7s ease-in-out infinite}
.g-monster-trail circle{fill:#FF5A5F;stroke:#fff;animation:g-monster-dot .85s ease-in-out infinite alternate}
.g-monster-finger{position:absolute;left:0;top:0;display:none;font-size:44px;line-height:1;pointer-events:none;will-change:transform,opacity;
  filter:drop-shadow(0 3px 0 rgba(29,43,83,.35))}
@keyframes g-monster-pop{0%{transform:scale(.3) rotate(-10deg);opacity:0}100%{transform:none;opacity:1}}
@keyframes g-monster-wig{0%,100%{transform:none}18%{transform:translateX(-5px)}38%{transform:translateX(4px)}58%{transform:translateX(-2px)}78%{transform:translateX(1px)}}
@keyframes g-monster-dash{0%{stroke-dashoffset:100}70%,100%{stroke-dashoffset:0}}
@keyframes g-monster-dot{from{opacity:.55}to{opacity:1}}
@media (prefers-reduced-motion: reduce){.g-monster-box.is-in,.g-monster-box.is-bad{animation:none}}
`);
  }

  HW.register({
    id: 'monster', skill: 'write', kind: 'arcade', name: '写字打怪兽', icon: '👾',
    blurb: '一笔一笔写对汉字，城堡发射火球打怪兽', needs: ['hanzi'], cols: ['chars'],
    start(ctx) {
      if (!HW.arcade || typeof HW.arcade.run !== 'function') {
        try { ctx.el.textContent = '游戏引擎没有加载成功，请刷新页面再试。'; } catch (e) { /* ignore */ }
        return;
      }
      injectCss();
      let M = null;                                  // 本关状态（每关 init 新建）
      let host = null, box = null, writer = null;    // DOM：叠层容器 / 田字格 / HanziWriter
      let trail = null, trailPath = null, trailDot = null, finger = null, layerEl = null;
      const hasHz = (ch) => { try { return !!(ctx.hanzi && ctx.hanzi.has(ch)); } catch (e) { return false; } };
      const ttsOk = () => { try { return !!(ctx.tts && ctx.tts.ok); } catch (e) { return false; } };
      const padOf = (inner) => Math.round(inner * 0.075);

      /* ================= 出题 ================= */
      function validChar(it) {
        if (!it || typeof it.c !== 'string') return false;
        const cs = Array.from(it.c.trim());
        return cs.length === 1 && isHan(cs[0]) && hasHz(cs[0]) && !!strokeData(cs[0]);
      }
      function validWord(it) {
        if (!it || typeof it.w !== 'string') return false;
        const cs = Array.from(it.w.trim()), py = str(it.py).trim().split(/\s+/);
        return cs.length >= 2 && cs.length <= 4 && py.length === cs.length && cs.every((ch) => isHan(ch) && hasHz(ch) && !!strokeData(ch));
      }
      function charTarget(it, mode) {
        const ch = Array.from(it.c.trim())[0];
        const words = (Array.isArray(it.words) ? it.words : []).map(str).filter((w) => w && w.indexOf(ch) >= 0);
        return { ch, item: it, kind: 'char', mode, py: str(it.py).trim(), n: strokeData(ch).strokes.length, words };
      }
      function wordTargets(it) {
        const cs = Array.from(it.w.trim()), py = str(it.py).trim().split(/\s+/);
        return cs.map((ch, i) => ({ ch, item: it, kind: 'word', mode: 'dict', py: py[i], wi: i, wn: cs.length, word: cs, wpy: py, n: strokeData(ch).strokes.length }));
      }
      function pickFrom(arr, n) {
        if (!arr.length || n <= 0) return [];
        try { const r = ctx.pick(arr, n); if (Array.isArray(r)) return r; } catch (e) { /* ignore */ }
        return (M ? M.g : null) ? M.g.shuffle(arr).slice(0, n) : arr.slice(0, n);
      }
      function buildTargets(g) {
        const p = P(g.level), N = 5;
        let groups = [];
        if (g.isReview) {
          // 错题重练：只用错题（chars 按本关写法；words 一律听写）；一轮最多 8 个字
          const rc = g.hasReview('chars') ? g.items('chars').filter(validChar) : [];
          const rw = g.hasReview('words') ? g.items('words').filter(validWord) : [];
          let budget = 8;
          for (const it of rc) { if (budget <= 0) break; groups.push([charTarget(it, p.mode)]); budget--; }
          for (const it of rw) { const t = wordTargets(it); if (t.length > budget) continue; groups.push(t); budget -= t.length; }
        }
        if (!groups.length) {
          let budget = N;
          const G = g.G || {};
          if (p.words > 0 && Array.isArray(G.words)) {
            const ok = G.words.filter(validWord);
            let pool = ok.filter((w) => Array.from(w.w.trim()).length === 2);
            if (pool.length < p.words) pool = ok.filter((w) => Array.from(w.w.trim()).length <= 3);
            for (const it of pickFrom(pool, p.words)) {
              const t = wordTargets(it);
              if (t.length > budget - 1) continue;          // 至少留一个单字
              groups.push(t); budget -= t.length;
            }
          }
          const chars = pickFrom((G.chars || []).filter(validChar), budget);
          for (const it of chars) groups.push([charTarget(it, p.mode)]);
        }
        if (groups.length > 1) {
          // 笔画少的先上、多的压轴：怪兽一只比一只大、血一只比一只厚（最后一只是怪兽大王）。
          // 不再强行把单字排第一：听写关常常只有 1 个单字，原来它是 15 画的“蕴”时，第一只小怪兽血最厚、压轴的大王反而只有 8 画。
          const avg = (gr) => gr.reduce((a, t) => a + t.n, 0) / gr.length;
          groups = g.shuffle(groups).sort((a, b) => avg(a) - avg(b));
        }
        const out = [];
        for (const gr of groups) for (const t of gr) out.push(Object.assign(t, { si: 0, mist: 0, hints: 0, complete: false }));
        return out;
      }

      /* ================= 布局 ================= */
      function layout(g) {
        const w = g.w, h = visibleH(g), top = g.hudTop;
        const port = w < 640 || w < h * 1.05;
        // 矮横屏（手机横过来）：字卡 / 拼音 / 💡 放到田字格左边一列，田字格才能大（上下叠放时只剩 130px 写不了字）
        const side = !port && h - top < 440;
        const L = { port, side, w, h, top, gh: g.h, ih: W.innerHeight || 0 };
        if (port) {
          const avail = h - top;
          const tab = w >= 600;                         // 竖屏平板：战场高一点、怪兽大一点（写字板本来就宽，田字格不缺地方）
          const sceneH = clamp(Math.round(avail * (tab ? 0.4 : 0.38)), 150, tab ? 400 : 320);
          L.sceneR = w; L.sceneB = top + sceneH;
          L.groundY = Math.round(L.sceneB - clamp(sceneH * 0.13, 20, 40));
          const bx = 8, by = L.sceneB + 8, bw = w - 16, bh = h - by - 10;
          L.board = { x: bx, y: by, w: bw, h: bh };
          L.hh = clamp(Math.round(bh * 0.2), 62, 88);
          const gs = Math.floor(Math.min(bw - 30, bh - L.hh - 26, 420));
          L.grid = { s: gs, x: Math.round(bx + (bw - gs) / 2), y: Math.round(by + L.hh + 4 + (bh - L.hh - 16 - gs) / 2) };
          L.R0 = clamp(sceneH * 0.15, 26, tab ? 60 : 50);
          L.s = clamp(Math.min(w / 390, sceneH / 280), 0.75, 1.4);
        } else if (side) {
          const by = top + 4, bh = h - by - 10;
          const gs = Math.floor(clamp(bh - 44, 140, 420));
          const colW = Math.round(clamp(gs * 0.5, 104, 150));
          const bw = colW + gs + 42;
          const bx = w - bw - 10;
          L.board = { x: bx, y: by, w: bw, h: bh };
          L.sceneR = bx - 4; L.sceneB = g.h;
          const sh = h - top;
          L.groundY = Math.round(top + sh * clamp(0.78 - (L.sceneR / sh - 1) * 0.08, 0.7, 0.8));
          L.hh = 0; L.colW = colW;
          L.grid = { s: gs, x: Math.round(bx + colW + 22), y: Math.round(by + (bh - gs) / 2 - 4) };
          L.R0 = clamp(Math.min((L.groundY - top) * 0.2, L.sceneR * 0.09), 30, 60);
          L.s = clamp(Math.min(L.sceneR / 560, (L.groundY - top) / 300), 0.75, 1.2);
        } else {
          const bw = Math.round(clamp(w * 0.38, 340, 500));
          const bx = w - bw - 14, by = top + 6, bh = h - by - 14;
          L.board = { x: bx, y: by, w: bw, h: bh };
          L.sceneR = bx - 4; L.sceneB = g.h;
          const sh = h - top;
          L.groundY = Math.round(top + sh * clamp(0.78 - (L.sceneR / sh - 1) * 0.08, 0.7, 0.8));
          L.hh = clamp(Math.round(bh * 0.17), 80, 106);
          const gs = Math.floor(Math.min(bw - 48, bh - L.hh - 34, 470));
          L.grid = { s: gs, x: Math.round(bx + (bw - gs) / 2), y: Math.round(by + L.hh + 6 + (bh - L.hh - 20 - gs) / 2) };
          // 横屏战场又高又宽：怪兽和城楼都画大一点，别缩在角落
          L.R0 = clamp(Math.min((L.groundY - top) * 0.14, L.sceneR * 0.1), 40, 88);
          L.s = clamp(Math.min(L.sceneR / 640, (L.groundY - top) / 470), 0.9, 1.7);
        }
        // 城楼（高度不能顶到 HUD）
        let cw = L.port ? clamp(L.sceneR * 0.28, 96, 150) : clamp(L.sceneR * 0.27, side ? 110 : 150, 290);
        const base = L.groundY + (L.port ? 4 : 8);
        const maxH = base - top - 46 * L.s;
        if (cw * 1.1 > maxH) cw = Math.max(70, maxH / 1.1);
        L.castle = { x: L.port ? 6 : 20, w: cw, h: cw * 1.1, base };
        const u = cw / 140, wy = base - cw * 1.1 * 0.5;
        const ang = -0.24, px = L.castle.x + cw * 0.9, py = wy - 6 * u;
        L.cannon = { x: px, y: py, ang, u, mx: px + Math.cos(ang) * 33 * u, my: py + Math.sin(ang) * 33 * u };
        L.xCastle = L.castle.x + cw + L.R0 * 0.75;
        L.xStart = L.sceneR - L.R0 * 1.35 - 8;
        L.hy = Math.round(L.groundY - (L.groundY - top) * (L.port ? 0.36 : 0.36));   // 远景地平线
        // 写字板页眉：左 字卡（点一下重听）· 中 拼音/组词 · 右 💡
        const b = L.board;
        if (side) {
          // 左列：字卡在上，拼音、组词（一行一个）在中间，💡 在最下面
          const cs = Math.round(clamp(L.colW - 40, 56, 90));
          L.card = { x: b.x + 12, y: b.y + 16, s: cs };
          const br = 24;
          L.btnHint = { x: b.x + 12 + (L.colW - 12) / 2, y: b.y + b.h - br - 12, r: br };
          L.txtX = b.x + 14; L.txtR = b.x + L.colW + 4;
          L.pfs = Math.round(clamp(L.colW * 0.2, 18, 26)); L.wfs = Math.round(clamp(L.colW * 0.17, 16, 22));
          L.pyY = L.card.y + cs + 8 + L.pfs * 0.6;
          L.wY = L.pyY + L.pfs * 0.6 + 6 + L.wfs * 0.6;
          L.wMax = L.btnHint.y - br - 4 - L.wfs * 0.5;
        } else {
          const cs = L.hh - 20;
          L.card = { x: b.x + 14, y: b.y + 11, s: cs };
          const br = L.port ? 24 : 27;
          L.btnHint = { x: b.x + b.w - 14 - br, y: b.y + L.hh / 2 + 1, r: br };
          L.txtX = L.card.x + cs + 12; L.txtR = L.btnHint.x - br - 10;
        }
        // 远景楼群（按宽度生成一次，resize 时重算；用固定种子免得跳变）
        const rnd = lcg(M ? M.seed : 7);
        L.city = [];
        let x = -6;
        const cityR = L.sceneR * 0.42;
        while (x < cityR) {
          const bw2 = (22 + rnd() * 22) * L.s, bh2 = (34 + rnd() * 50) * L.s;
          const win = [];
          const cols = Math.max(1, Math.floor(bw2 / (8 * L.s))), rows = Math.max(1, Math.floor(bh2 / (9 * L.s)));
          for (let r = 0; r < rows; r++) for (let q = 0; q < cols; q++) if (rnd() < 0.5) win.push([3 * L.s + q * 8 * L.s, 5 * L.s + r * 9 * L.s, rnd() < 0.2 ? rnd() * TAU : -1]);
          L.city.push({ x, w: bw2, h: bh2, win });
          x += bw2 + (3 + rnd() * 8) * L.s;
        }
        L.tufts = [];
        for (let i = 0; i < 16; i++) L.tufts.push({ x: rnd() * L.sceneR, y: rnd(), ph: rnd() * TAU, s: 0.7 + rnd() * 0.6 });
        L.flowers = [];
        for (let i = 0; i < 7; i++) L.flowers.push({ x: L.xCastle + rnd() * (L.sceneR - L.xCastle), y: rnd(), c: ['#FF6B8B', '#FFD23F', '#FFFFFF', '#B388FF'][i % 4], ph: rnd() * TAU });
        // 横屏：路下面还有一大片草地 → 前景（割草条纹 + 底边摇摆的灌木 + 路牌），不让画面下半截空着
        L.bushes = []; L.fg = null;
        if (!port) {
          const fgTop = L.groundY + 22 * L.s, fgH = h - fgTop;
          if (fgH > 70) {
            L.fg = { top: fgTop, h: fgH };
            const xs = [0.03, 0.3, 0.58, 0.86];
            for (let i = 0; i < xs.length; i++) {
              L.bushes.push({ x: xs[i] * L.sceneR + (rnd() - 0.5) * 24 * L.s, r: (26 + rnd() * 14) * L.s * clamp(fgH / 170, 0.7, 1.25),
                ph: rnd() * TAU, dots: i % 2 ? '#FF6B8B' : '#FFE45C' });
            }
            L.sign = { x: L.xCastle + (L.sceneR - L.xCastle) * 0.22, y: fgTop + fgH * 0.34 };
          }
        }
        // 天上的风筝（新加坡滨海堤坝放风筝）：竖屏 1 只，横屏 2 只
        L.kites = [];
        const KC = [['#FF4D6A', '#FFD23F'], ['#3AA0FF', '#FFFFFF']];
        const nk = L.port ? 1 : 2;
        for (let i = 0; i < nk; i++) {
          L.kites.push({ fx: L.port ? 0.44 : [0.34, 0.6][i], fy: L.port ? 0.46 : [0.3, 0.5][i],
            s: (L.port ? 0.85 : [1.05, 0.8][i]) * L.s, c: KC[i], ph: rnd() * TAU });
        }
        return L;
      }
      function relayout(g) {
        if (!M) return;
        M.L = layout(g); M.gr = Object.create(null);
        placeDom();
      }
      function grad(c, key, x0, y0, x1, y1, stops) {
        let gd = M.gr[key];
        if (!gd) { gd = c.createLinearGradient(x0, y0, x1, y1); for (let i = 0; i < stops.length; i += 2) gd.addColorStop(stops[i], stops[i + 1]); M.gr[key] = gd; }
        return gd;
      }

      /* ================= DOM：田字格 + 手指提示 ================= */
      function buildDom(layer) {
        host = D.createElement('div');
        host.className = 'g-monster-host';
        host.style.pointerEvents = 'none';
        trail = D.createElementNS(SVGNS, 'svg'); trail.setAttribute('class', 'g-monster-trail'); trail.setAttribute('aria-hidden', 'true');
        trailPath = D.createElementNS(SVGNS, 'path'); trailPath.setAttribute('pathLength', '100');
        trailDot = D.createElementNS(SVGNS, 'circle');
        trail.append(trailPath, trailDot);
        finger = D.createElement('div'); finger.className = 'g-monster-finger'; finger.textContent = '👆'; finger.setAttribute('aria-hidden', 'true');
        host.append(trail, finger);
        layer.appendChild(host);
        layerEl = layer;
      }
      /* 画布里真正看得见的高度：引擎把画布高度下限定为 480，手机横屏（844×390，去掉顶栏只剩约 340）时画布下半截在屏幕外，
         画布又是 touch-action:none 划不动页面 → 田字格下半截根本写不到。所以按“看得见的高度”排版。 */
      function visibleH(g) {
        let v = g.h;
        try {
          const ref = (layerEl && layerEl.parentNode) || layerEl;
          const ih = W.innerHeight || 0;
          if (ref && ih > 0) {
            const top = ref.getBoundingClientRect().top + (W.scrollY || W.pageYOffset || 0);
            v = Math.min(g.h, Math.max(300, Math.floor(ih - top)));
          }
        } catch (e) { v = g.h; }
        return v;
      }
      function killWriter() {
        if (writer) {
          try { writer.cancelQuiz(); } catch (e) { /* ignore */ }
          try { if (typeof writer.pauseAnimation === 'function') writer.pauseAnimation(); } catch (e) { /* ignore */ }
        }
        writer = null;
        if (box) { try { box.remove(); } catch (e) { /* ignore */ } }
        box = null;
      }
      function placeDom() {
        if (!M || !M.L) return;
        const Gd = M.L.grid, inner = Gd.s - 4;
        if (box) {
          box.style.left = Gd.x + 'px'; box.style.top = Gd.y + 'px';
          if (writer && inner !== M.inner) {
            M.inner = inner; M.pad = padOf(inner);
            box.style.width = box.style.height = (inner + 4) + 'px';
            try { writer.updateDimensions({ width: inner, height: inner, padding: M.pad }); } catch (e) { /* ignore */ }
          }
        }
        if (M.hint) showHint(M.hint.k, M.hint.center);
      }
      function mountWriter(tgt) {
        killWriter();
        if (!host || !tgt || !M) return false;
        const Gd = M.L.grid, inner = Gd.s - 4;
        M.inner = inner; M.pad = padOf(inner);
        const b = D.createElement('div');
        b.className = 'g-monster-box';
        b.style.left = Gd.x + 'px'; b.style.top = Gd.y + 'px';
        b.setAttribute('aria-label', '田字格：在这里写字');
        host.insertBefore(b, host.firstChild);            // 在手指提示层下面
        let w = null;
        try {
          w = ctx.hanzi.create(b, tgt.ch, {
            width: inner, height: inner, padding: M.pad,
            showOutline: tgt.mode === 'trace', showCharacter: false,
            strokeColor: NAVY, radicalColor: '#C8392B', outlineColor: '#DCCDB2',
            drawingColor: '#2F7BFF', highlightColor: '#FFA21F', highlightCompleteColor: '#FFC928',
            drawingWidth: Math.max(6, Math.round(inner / 24)),
            strokeAnimationSpeed: 1.3, delayBetweenStrokes: 120
          });
        } catch (e) { w = null; }
        if (!w) { try { b.remove(); } catch (e) { /* ignore */ } return false; }
        box = b; writer = w;
        const onTouch = () => { if (M) { M.touched = true; M.idle = 0; hideHint(); } };
        b.addEventListener('pointerdown', onTouch, true);
        b.addEventListener('mousedown', onTouch, true);
        b.addEventListener('touchstart', onTouch, { capture: true, passive: true });
        b.classList.add('is-in');
        return true;
      }
      function wiggle() {
        if (!box) return;
        box.classList.remove('is-in', 'is-bad');
        void box.offsetWidth;
        box.classList.add('is-bad');
      }
      /* 手指沿着第 k 笔的中线滑动（center=true：只在格子中间点点，听写关开局用，不泄露笔画） */
      function showHint(k, center) {
        if (!M || !M.tgt || !trail) return;
        const Gd = M.L.grid, inner = M.inner || Gd.s - 4, pad = M.pad || padOf(inner);
        let pts;
        if (center) pts = [{ x: inner * 0.5, y: inner * 0.45 }, { x: inner * 0.52, y: inner * 0.55 }];
        else {
          const sd = strokeData(M.tgt.ch);
          const md = sd && sd.medians && sd.medians[k];
          if (!md || md.length < 2) return;
          const sc = (inner - 2 * pad) / 1024;
          pts = md.map((p) => ({ x: pad + p[0] * sc, y: inner - pad - 124 * sc - p[1] * sc }));
        }
        const cum = [0];
        for (let i = 1; i < pts.length; i++) cum.push(cum[i - 1] + Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y));
        M.hint = { k, center: !!center, pts, cum, len: cum[cum.length - 1] || 1, t: 0 };
        trail.style.left = (Gd.x + 2) + 'px'; trail.style.top = (Gd.y + 2) + 'px';
        trail.style.width = inner + 'px'; trail.style.height = inner + 'px';
        trail.setAttribute('viewBox', '0 0 ' + inner + ' ' + inner);
        if (center) { trailPath.setAttribute('d', ''); trailDot.setAttribute('r', '0'); }
        else {
          trailPath.setAttribute('d', 'M' + pts.map((p) => p.x.toFixed(1) + ' ' + p.y.toFixed(1)).join(' L'));
          trailPath.style.strokeWidth = Math.max(8, inner / 13) + 'px';
          trailDot.setAttribute('cx', pts[0].x.toFixed(1)); trailDot.setAttribute('cy', pts[0].y.toFixed(1));
          trailDot.setAttribute('r', String(Math.max(7, inner / 24)));
          trailDot.style.strokeWidth = '3px';
        }
        trail.style.display = 'block';
        finger.style.fontSize = Math.round(clamp(inner * 0.16, 34, 58)) + 'px';
        finger.style.display = 'block';
      }
      function hideHint() {
        if (M) M.hint = null;
        if (trail) trail.style.display = 'none';
        if (finger) finger.style.display = 'none';
      }
      function syncFinger() {
        const H = M.hint;
        if (!H || !finger) return;
        const Gd = M.L.grid;
        let x, y, a = 1;
        if (H.center) {
          const k = Math.abs(Math.sin(H.t * 4));
          x = H.pts[0].x; y = H.pts[0].y + k * 14;
          a = 0.65 + 0.35 * k;
        } else {
          const period = 1.7, u = (H.t % period) / period;
          const p = clamp(u / 0.7, 0, 1), d = p * H.len;
          let i = 1;
          while (i < H.cum.length - 1 && H.cum[i] < d) i++;
          const seg = H.cum[i] - H.cum[i - 1] || 1, f = clamp((d - H.cum[i - 1]) / seg, 0, 1);
          x = lerp(H.pts[i - 1].x, H.pts[i].x, f); y = lerp(H.pts[i - 1].y, H.pts[i].y, f);
          a = u < 0.08 ? u / 0.08 : u > 0.85 ? Math.max(0, 1 - (u - 0.85) / 0.15) : 1;
          a *= 0.75 + 0.25 * Math.sin(H.t * 18);              // 一闪一闪
        }
        const fs = parseFloat(finger.style.fontSize) || 44;
        finger.style.transform = 'translate(' + (Gd.x + 2 + x - fs * 0.42).toFixed(1) + 'px,' + (Gd.y + 2 + y - fs * 0.06).toFixed(1) + 'px)';
        finger.style.opacity = a.toFixed(2);
      }

      /* ================= 朗读 ================= */
      function sayTarget(g, tgt, manual) {
        if (!tgt || !M) return;
        const it = tgt.item, tok = ++M.sayTok;
        M.sayPulse = 1.2;
        if (tgt.kind === 'word') {
          const w = str(it.w).trim(), s = str(it.s).trim();
          const p = g.say(w, { caption: str(it.py) });
          // 例句只在词语的第一个字、或孩子自己点“重听”时读（写第二个字时再把整句读一遍太啰嗦）。
          // 令牌：朗读被新的朗读打断时旧 Promise 也会 resolve——没有令牌的话，连点重听会变成“读例句”把词语本身盖掉。
          if (s && ttsOk() && (manual || !tgt.wi)) p.then(() => { if (M && M.sayTok === tok && M.tgt === tgt && g.state === 'play') g.say(s, { caption: '' }); });
        } else if (tgt.mode === 'dict') {
          const ws = tgt.words.slice(0, 2);
          g.say(ws.length ? ws.join('，') : tgt.ch, { caption: tgt.py });
        } else g.say(tgt.words[0] || tgt.ch, { caption: tgt.py });
      }

      /* ================= 怪兽 ================= */
      function makeMonster(g, tgt, idx, preview) {
        const boss = idx === M.targets.length - 1 && M.targets.length >= 3;
        const ty = boss ? BOSS : MON[(idx + g.level * 2) % MON.length];
        const p = P(g.level);
        return {
          tgt, ty, boss, k: boss ? 1.28 : 0.84 + 0.07 * Math.min(idx, 4),
          hp: tgt.n, hpMax: tgt.n, hpShow: tgt.n,
          d: 1, dx: 1, lx: 0, lift: 0, sq: 0, flash: 0, hurt: 0, roar: 0, leapT: 0, dizzy: 0, poke: 0,
          state: preview ? 'idle' : 'enter', enterT: 0, landed: !!preview, walkDelay: preview ? 1.3 : 0.9,
          ph: 0, atkT: 0, atkHit: false, dieT: 0, blink: rand(1, 3.5), blinkT: 0, seed: Math.random() * 10,
          speed: 1 / ((p.base + p.per * tgt.n) * (GRADE_K[g.gradeNum] || 1)), cx: 0, cy: 0, R: 0
        };
      }
      function beginTarget(g, i, first) {
        const tgt = M.targets[i];
        if (!tgt) return;
        M.ti = i; M.tgt = tgt; M.idle = 0; M.hintCool = 0;
        hideHint();
        if (!first || !writer) {
          if (!mountWriter(tgt)) {                    // 建不了田字格（极少见）：这个字跳过
            M.targets.splice(i, 1);
            g.rounds = Math.max(1, M.targets.length);
            if (g.done >= g.rounds) g.win(); else if (i < M.targets.length) beginTarget(g, i, false);
            return;
          }
          M.mon = makeMonster(g, tgt, i, false);
        } else {
          M.mon.state = 'walk'; M.mon.roar = 0.9;
          g.sfx('chomp');
        }
        if (M.mon.boss) { M.banner = { t: 0, text: '怪兽大王来啦！' }; g.sfx('power'); }
        startQuiz(g, tgt);
        g.after(first ? 0.25 : 0.75, () => { if (M && M.tgt === tgt && g.state === 'play') sayTarget(g, tgt); });
        if (i === 0 && !M.touched) g.after(first ? 0.6 : 1.0, () => { if (M && M.tgt === tgt && !M.touched && !M.hint) showHint(0, tgt.mode === 'dict'); });
      }
      function startQuiz(g, tgt) {
        if (!writer) return;
        const tok = ++M.qtok;
        try {
          const r = writer.quiz({
            showHintAfterMisses: HINT_MISS[tgt.mode] || 2,
            markStrokeCorrectAfterMisses: 5,
            leniency: g.gradeNum <= 3 ? 1.15 : 1.05,
            highlightOnComplete: true,
            onCorrectStroke: (d) => { if (M && tok === M.qtok) onStroke(g, tgt, d); },
            onMistake: (d) => { if (M && tok === M.qtok) onMistake(g, tgt, d); },
            onComplete: (s) => { if (M && tok === M.qtok) onComplete(g, tgt, s); }
          });
          if (r && typeof r.catch === 'function') r.catch(() => {});
        } catch (e) { /* ignore */ }
      }

      /* ---------- HanziWriter 回调 ---------- */
      function onStroke(g, tgt, d) {
        if (g.state !== 'play' || tgt !== M.tgt) return;
        M.touched = true; M.idle = 0; hideHint();
        tgt.si = Math.max(tgt.si, (d && d.strokeNum != null ? d.strokeNum : tgt.si) + 1);
        M.streak++;
        M.flashGood = 1;
        g.addScore(2);
        fire(g);
        if (M.streak === 4 || M.streak === 8) { g.float(M.streak === 4 ? '火力升级！' : '超级火球！', M.L.cannon.x, M.L.cannon.y - 50 * M.L.s, { color: M.streak === 4 ? '#A6E6FF' : '#F4B8FF', size: 26 }); g.sfx('combo'); }
      }
      function onMistake(g, tgt) {
        if (g.state !== 'play' || tgt !== M.tgt) return;
        M.touched = true; M.idle = 0; hideHint();
        tgt.mist++;
        M.streak = 0;
        M.flashBad = 1;
        wiggle();
        g.sfx('bad');
        const m = M.mon;
        if (m && (m.state === 'walk' || m.state === 'idle' || m.state === 'dizzy') && !tgt.complete) {
          m.state = 'walk'; m.dizzy = 0; m.walkDelay = 0;
          m.d = Math.max(0, m.d - P(g.level).leap);
          m.leapT = 0.45; m.roar = 1; m.sq = -0.6;
          // ✗ 飘在血条上方（放在身上会压住血条）
          const xs = Math.round(clamp(m.R * 0.8, 30, 48));
          g.float('✗', m.cx + m.R * 0.2, Math.max(M.L.top + xs * 0.6, (m.hpY || m.cy - m.R * 1.7) - xs * 0.55), { color: '#FF4D4D', size: xs });
          g.after(0.08, () => g.sfx('jump'));
          g.after(0.42, () => { if (M && M.mon === m) { g.burst(m.cx, M.L.groundY, { kind: 'dot', color: '#E7D2A8', n: 8 }); g.shake(4); } });
        }
      }
      function onComplete(g, tgt, s) {
        if (!M || tgt !== M.tgt || g.state !== 'play') return;
        tgt.complete = true;
        if (s && Number.isFinite(s.totalMistakes)) tgt.mist = Math.max(tgt.mist, s.totalMistakes);
        tgt.si = tgt.n;
        maybeKill(g);
      }

      /* ---------- 火球 ---------- */
      function fire(g) {
        const L = M.L, m = M.mon;
        const tier = M.streak >= 8 ? 2 : M.streak >= 4 ? 1 : 0;
        M.balls.push({ x0: L.cannon.mx, y0: L.cannon.my, x: L.cannon.mx, y: L.cannon.my, t: 0, dur: 0.34 + (m ? Math.abs(m.cx - L.cannon.mx) : 200) / 2400, tier, mon: m, tr: [], tx: m ? m.cx : L.xStart, ty: m ? m.cy : L.groundY - 40 });
        M.recoil = 1;
        g.sfx('whoosh');
        g.burst(L.cannon.mx, L.cannon.my, { kind: 'spark', n: 8, color: FIRE[tier].spark });
        g.burst(L.cannon.mx, L.cannon.my, { kind: 'dot', n: 5, color: 'rgba(230,230,240,.9)' });
      }
      function ballTick(g, dt) {
        const arr = M.balls;
        for (let i = arr.length - 1; i >= 0; i--) {
          const b = arr[i];
          b.t += dt;
          const m = b.mon;
          if (m && m.state !== 'gone') { b.tx = m.cx; b.ty = m.cy; }
          const u = clamp(b.t / b.dur, 0, 1);
          const dist = Math.hypot(b.tx - b.x0, b.ty - b.y0);
          const cx = (b.x0 + b.tx) / 2, cy = Math.min(b.y0, b.ty) - clamp(dist * 0.28, 30, 150);
          const a = 1 - u;
          b.x = a * a * b.x0 + 2 * a * u * cx + u * u * b.tx;
          b.y = a * a * b.y0 + 2 * a * u * cy + u * u * b.ty;
          b.tr.push(b.x, b.y);
          if (b.tr.length > 24) b.tr.splice(0, 2);
          b.sp = (b.sp || 0) + dt;
          if (b.sp > 0.04) { b.sp = 0; g.burst(b.x, b.y, { kind: 'dot', n: 1, color: FIRE[b.tier].spark }); }   // 掉落的火星
          if (u >= 1) { arr.splice(i, 1); impact(g, b); }
        }
      }
      function impact(g, b) {
        const m = b.mon, F = FIRE[b.tier];
        g.burst(b.x, b.y, { kind: 'spark', n: 12 + b.tier * 4, color: F.spark });
        g.burst(b.x, b.y, { kind: 'star', n: 4 + b.tier * 3, color: b.tier ? F.spark : undefined });
        g.ring(b.x, b.y, F.mid, (m ? m.R : 40) * (1.2 + b.tier * 0.3));
        if (!m || m !== M.mon || m.state === 'gone' || m.state === 'die') return;
        m.hp = Math.max(0, m.hp - 1);
        m.flash = 1; m.hurt = 0.32; m.sq = 0.7;
        if (m.state === 'walk' || m.state === 'idle' || m.state === 'dizzy') m.d = Math.min(1, m.d + P(g.level).knock * (1 + b.tier * 0.3));
        // 最后一击不飘“-1”：马上就要爆炸，金色战利品字从这里蹦出来，别叠在一起
        if (!(m.hp === 0 && m.tgt.complete)) g.float('-1', m.cx + rand(-12, 12), m.cy - m.R * 0.9, { color: '#FFFFFF', size: Math.round(24 + b.tier * 4) });
        g.shake(3 + b.tier * 2);
        g.sfx(b.tier === 2 ? 'beat' : 'pop');
        maybeKill(g);
      }
      function maybeKill(g) {
        const m = M.mon, tgt = M.tgt;
        if (!m || !tgt || !tgt.complete || m.tgt !== tgt) return;
        if (m.state === 'die' || m.state === 'gone') return;
        if (M.balls.some((b) => b.mon === m)) return;       // 最后一发火球还在路上：等它打中再爆
        m.hp = 0;
        m.state = 'die'; m.dieT = 0;
        g.sfx('power');
        g.after(0.45, () => explode(g, m));
      }
      function explode(g, m) {
        if (!M || M.mon !== m) return;
        const tgt = m.tgt, x = m.cx, y = m.cy, R = m.R;
        m.state = 'gone';
        g.burst(x, y, { kind: 'confetti', n: 34 });
        g.burst(x, y, { kind: 'star', n: 20 });
        g.burst(x, y, { kind: 'dot', n: 16, color: m.ty.body });
        g.ring(x, y, '#FFFFFF', R * 2.4);
        g.shake(m.boss ? 16 : 10);
        if (m.boss) g.flash('#FFF6C0');
        g.sfx('crash');
        if (tgt.mode !== 'trace' && tgt.mist >= 3) {   // 写错太多笔：进错题本（不扣心）
          try { ctx.score.wrong(tgt.item, noteMist(tgt)); } catch (e) { /* ignore */ }
        }
        const perfect = tgt.mist === 0 && tgt.hints === 0;
        const wordDone = tgt.kind === 'word' && tgt.wi === tgt.wn - 1;
        M.trophies.push({ text: wordDone ? tgt.word.join('') : tgt.ch, py: wordDone ? tgt.wpy.join(' ') : tgt.py, x, y: y - R * 0.95, R, t: 0 });
        if (wordDone && ttsOk()) g.after(0.5, () => { if (M) g.say(tgt.word.join(''), { caption: '' }); });
        // 分数飘字放在怪兽脚下（上面留给金色战利品字）；“完美”奖励并进同一个飘字
        const cmb = g.combo + 1, pts = 10 * (cmb >= 10 ? 4 : cmb >= 6 ? 3 : cmb >= 3 ? 2 : 1);
        const fxm = perfect ? 92 : 50;                 // 飘字别被屏幕 / 写字板边缘切掉
        g.right(tgt.item, clamp(x, fxm, M.L.sceneR - fxm), M.L.groundY + 26, perfect ? '完美 +' + (pts + 10) : undefined);
        if (perfect) g.addScore(10);
        if (g.state === 'play') g.after(0.95, () => { if (M && g.state === 'play') beginTarget(g, M.ti + 1, false); });
      }
      function noteMist(tgt) {
        if (tgt.kind === 'word') return '听写「' + tgt.word.join('') + '」' + tgt.wpy.join(' ') + '：「' + tgt.ch + '」写错了 ' + tgt.mist + ' 笔，共 ' + tgt.n + ' 画，要记住笔顺';
        return '「' + tgt.ch + '」' + tgt.py + '，共 ' + tgt.n + ' 画：写错了 ' + tgt.mist + ' 笔，要记住笔顺';
      }
      function noteCastle(tgt) {
        if (tgt.kind === 'word') return '听写「' + tgt.word.join('') + '」' + tgt.wpy.join(' ') + '：写「' + tgt.ch + '」（' + tgt.n + ' 画）时怪兽冲进了城堡';
        return '「' + tgt.ch + '」' + tgt.py + '，共 ' + tgt.n + ' 画：没写完怪兽就冲进了城堡，要记住笔顺';
      }

      /* ---------- 撞城 ---------- */
      function castleHit(g, m) {
        const L = M.L, C = L.castle, tgt = m.tgt;
        M.castleHit = 1;
        g.burst(C.x + C.w * 0.85, C.base - C.h * 0.3, { kind: 'dot', color: '#C9A36B', n: 18 });
        g.burst(C.x + C.w * 0.85, C.base - C.h * 0.3, { kind: 'dot', color: '#7A5A3A', n: 10 });
        // 扣心一定扣；但只有“真的不会”才记错题本：听写关（想不起来）、或这个字已经写错过笔 / 看过提示。
        // 描红 / 照写一笔没错、只是手慢被追上 → 只扣心，不把会写的字塞进错题本（g.wrong(null) = 扣心不点名）
        const knows = tgt.mode !== 'dict' && tgt.mist === 0 && tgt.hints === 0;
        g.wrong(knows ? null : tgt.item, noteCastle(tgt), C.x + C.w * 0.8, C.base - C.h * 0.6);
        if (g.state !== 'play') { m.state = 'laugh'; return; }
        // 帮一把：亮出当前这一笔
        if (writer && !tgt.complete) {
          try { writer.highlightStroke(Math.min(tgt.si, tgt.n - 1)); } catch (e) { /* ignore */ }
          showHint(Math.min(tgt.si, tgt.n - 1), false);
          if (tgt.mode !== 'trace') {
            const w = writer;
            try { w.showOutline(); } catch (e) { /* ignore */ }
            g.after(2.4, () => { if (writer === w && M && M.tgt && M.tgt.mode !== 'trace') { try { w.hideOutline(); } catch (e) { /* ignore */ } } });
          }
        }
      }

      /* ---------- 孔明灯奖励 ---------- */
      function popLantern(g, ln) {
        const i = M.lanterns.indexOf(ln);
        if (i >= 0) M.lanterns.splice(i, 1);
        g.burst(ln.x, ln.y, { kind: 'coin', n: 8 });
        g.burst(ln.x, ln.y, { kind: 'spark', n: 10, color: '#FFE45C' });
        g.ring(ln.x, ln.y, '#FFE45C', 50);
        g.addScore(5, ln.x, ln.y - 20);
        g.sfx('coin');
      }

      /* ================= 每帧逻辑 ================= */
      function animTick(g, dt) {
        M.flashGood = Math.max(0, M.flashGood - dt * 2.5);
        M.flashBad = Math.max(0, M.flashBad - dt * 2.2);
        M.recoil = Math.max(0, M.recoil - dt * 4);
        M.castleHit = Math.max(0, M.castleHit - dt * 1.6);
        M.hintCool = Math.max(0, M.hintCool - dt);
        M.sayPulse = Math.max(0, M.sayPulse - dt);
        {  // 危险程度：怪兽走进最后 30% 的路 → 城楼边红光闪、熊猫头上冒“！”
          const mm = M.mon, tg = M.tgt;
          const want = mm && tg && mm.tgt === tg && !tg.complete && (mm.state === 'walk' || mm.state === 'attack') ? clamp((0.3 - mm.dx) / 0.3, 0, 1) : 0;
          M.danger += (want - M.danger) * Math.min(1, dt * 5);
        }
        M.press.card = Math.max(0, M.press.card - dt * 5); M.press.hint = Math.max(0, M.press.hint - dt * 5);
        if (M.banner) { M.banner.t += dt; if (M.banner.t > 1.8) M.banner = null; }
        if (M.hint) M.hint.t += dt;
        trophyTick(g, dt);
        for (const ln of M.lanterns) { ln.t += dt; ln.y += ln.vy * dt; ln.x += Math.sin(ln.t * 1.2 + ln.ph) * 10 * dt; }
        for (let i = M.lanterns.length - 1; i >= 0; i--) if (M.lanterns[i].y < -40) M.lanterns.splice(i, 1);
        ballTick(g, dt);
        const m = M.mon;
        if (!m) return;
        m.flash = Math.max(0, m.flash - dt * 5);
        m.hurt = Math.max(0, m.hurt - dt);
        m.roar = Math.max(0, m.roar - dt);
        m.poke = Math.max(0, m.poke - dt * 3);
        m.sq += (0 - m.sq) * Math.min(1, dt * 9);
        m.hpShow += (m.hp - m.hpShow) * Math.min(1, dt * 3);
        m.blinkT -= dt; if (m.blinkT < -0.14) { m.blinkT = rand(1.8, 4); }
        const L = M.L;
        let lift = 0;
        if (m.state === 'enter') {
          m.enterT += dt;
          const p = clamp(m.enterT / 0.8, 0, 1);
          lift = (1 - outBounce(p)) * (L.groundY - L.top + m.k * L.R0 * 2);
          if (!m.landed && p > 0.37) {
            m.landed = true; m.sq = 0.9;
            g.burst(m.cx, L.groundY, { kind: 'dot', color: '#E7D2A8', n: 14 });
            g.shake(m.boss ? 12 : 6); g.sfx('beat');
          }
          if (p >= 1) { m.state = 'walk'; m.roar = 0.7; }
        } else if (m.state === 'walk' && m.walkDelay <= 0) {
          lift = m.ph < 0.5 ? Math.sin(m.ph / 0.5 * Math.PI) * L.R0 * 0.22 : 0;
        } else if (m.state === 'attack') {
          m.atkT += dt;
          const a = m.atkT;
          if (a < 0.22) { m.lx = -Math.pow(a / 0.22, 2) * m.R * 0.9; lift = Math.sin(a / 0.22 * Math.PI) * m.R * 0.3; }
          else {
            if (!m.atkHit) { m.atkHit = true; m.sq = 1; castleHit(g, m); if (m.state === 'laugh') { m.lx = 0; m.d = 0; m.dx = 0; return; } m.d = 0.55; }
            const b = clamp((a - 0.22) / 0.55, 0, 1);
            m.lx = -(1 - b) * m.R * 0.9;
            lift = Math.sin(b * Math.PI) * m.R * 1.2;
            if (b >= 1) { m.state = 'dizzy'; m.dizzy = 1.3; m.lx = 0; m.sq = 0.8; g.burst(m.cx, L.groundY, { kind: 'dot', color: '#E7D2A8', n: 10 }); }
          }
        } else if (m.state === 'dizzy') {
          m.dizzy -= dt;
          if (m.dizzy <= 0) { m.state = 'walk'; m.walkDelay = 0.2; }
        } else if (m.state === 'die') {
          m.dieT += dt;
        } else if (m.state === 'laugh') {
          lift = Math.abs(Math.sin(M.clock * 7)) * m.R * 0.25;
        }
        if (m.leapT > 0) {
          m.leapT = Math.max(0, m.leapT - dt);
          const q = 1 - m.leapT / 0.45;
          lift = Math.max(lift, Math.sin(q * Math.PI) * L.R0 * 1.1);
          if (m.leapT === 0) m.sq = 0.8;
        }
        m.lift = lift;
        m.dx += (m.d - m.dx) * Math.min(1, dt * (m.state === 'attack' ? 20 : 7));
      }
      function logicTick(g, dt) {
        const m = M.mon, tgt = M.tgt, L = M.L;
        if (m && tgt && m.tgt === tgt) {
          if (m.state === 'walk') {
            if (m.walkDelay > 0) m.walkDelay -= dt;
            else if (!tgt.complete) {
              const period = m.boss ? 1.3 : 1.0;
              const prev = m.ph;
              m.ph = (m.ph + dt / period) % 1;
              if (m.ph < 0.5) m.d -= m.speed * dt * 2 * period / period;
              if (prev < 0.5 && m.ph >= 0.5) {           // 一跳落地：扬尘
                m.sq = 0.5;
                g.burst(m.cx, L.groundY, { kind: 'dot', color: '#E7D2A8', n: m.boss ? 7 : 4 });
                if (m.boss) g.shake(2.5);
                if (m.d < 0.3) g.sfx('tick');            // 快到城下了：每一跳“嗒”一声催一催
              }
              if (m.d <= 0 && m.leapT <= 0) { m.d = 0; m.state = 'attack'; m.atkT = 0; m.atkHit = false; m.roar = 0.8; g.sfx('swing'); }
            }
          } else if (m.state === 'idle') m.state = 'walk';
          // 发呆太久：手指提示下一笔
          if (!tgt.complete && m.state !== 'die' && m.state !== 'gone') {
            M.idle += dt;
            if (!M.hint && M.idle > (IDLE_HINT[tgt.mode] || 8)) showHint(Math.min(tgt.si, tgt.n - 1), false);
          }
        }
        // 孔明灯（第 2 关起）
        if (g.level >= 2) {
          M.lanNext -= dt;
          if (M.lanNext <= 0 && M.lanterns.length < 2) {
            M.lanNext = rand(9, 15);
            const x0 = L.xCastle + 20, x1 = L.sceneR - 30;
            if (x1 > x0) M.lanterns.push({ x: rand(x0, x1), y: L.groundY - 10, vy: -rand(20, 30) * L.s, t: 0, ph: rand(0, TAU), r: 17 * L.s });
          }
        }
      }

      /* ================= 画：场景 ================= */
      function drawScene(g, c, T) {
        const L = M.L, th = THEME[M.theme], gy = L.groundY, s = L.s, sw = L.sceneR;
        const night = M.theme === 'night';
        const bottom = L.port ? L.sceneB : g.h;
        c.fillStyle = grad(c, 'sky', 0, 0, 0, gy, [0, th.sky[0], 0.55, th.sky[1], 1, th.sky[2]]);
        c.fillRect(-20, -20, g.w + 40, gy + 20);
        // 太阳 / 月亮 / 星星
        if (night) {
          for (const st of M.stars) {
            const a = 0.45 + 0.55 * Math.abs(Math.sin(T * st.sp + st.ph));
            c.globalAlpha = a; c.fillStyle = '#FFFFFF';
            const x = st.x * g.w, y = L.top * 0.3 + st.y * (L.hy - L.top * 0.3);
            c.fillRect(x - st.r / 2, y - st.r / 2, st.r, st.r);
          }
          c.globalAlpha = 1;
          const mx = sw * 0.8, my = L.top + 36 * s, mr = 23 * s;
          // 圆月（带光晕和环形山）：用天空色盖出月牙会在光晕里留下一块深色圆斑，所以画满月
          c.globalAlpha = 0.18 + 0.05 * Math.sin(T * 1.3); ell(c, mx, my, mr * 2.3, mr * 2.3, '#FFF6C8');
          c.globalAlpha = 0.22; ell(c, mx, my, mr * 1.5, mr * 1.5, '#FFF6C8'); c.globalAlpha = 1;
          ell(c, mx, my, mr, mr, '#FFF3B8', '#E9CF7A', 2);
          ell(c, mx - mr * 0.35, my - mr * 0.25, mr * 0.22, mr * 0.2, '#F1DD92');
          ell(c, mx + mr * 0.3, my + mr * 0.3, mr * 0.3, mr * 0.26, '#F1DD92');
          ell(c, mx + mr * 0.4, my - mr * 0.38, mr * 0.12, mr * 0.11, '#F1DD92');
        } else {
          const dusk = M.theme === 'dusk';
          const sx = sw * (dusk ? 0.72 : 0.8), sy = dusk ? L.hy - 8 * s : L.top + 36 * s, r = (dusk ? 30 : 22) * s;
          c.save(); c.translate(sx, sy);
          c.globalAlpha = 0.35 + 0.1 * Math.sin(T * 1.5);
          ell(c, 0, 0, r * 2.3, r * 2.3, dusk ? '#FFD08A' : '#FFF6B0');
          c.globalAlpha = 0.55; c.rotate(T * 0.15); c.fillStyle = dusk ? '#FFC06A' : '#FFF3A0';
          for (let i = 0; i < 10; i++) { c.rotate(TAU / 10); c.beginPath(); c.moveTo(r * 1.15, -r * 0.18); c.lineTo(r * (1.7 + 0.15 * Math.sin(T * 2 + i)), 0); c.lineTo(r * 1.15, r * 0.18); c.closePath(); c.fill(); }
          c.globalAlpha = 1; c.rotate(-T * 0.15);
          ell(c, 0, 0, r, r, dusk ? '#FF9E5A' : '#FFE14D', dusk ? '#F07A3A' : '#FFB41F', 3);
          c.restore();
        }
        // 云
        const span = g.w + 240 * s;
        for (const cl of M.clouds) {
          let x = (cl.x * span + T * cl.v * s) % span; if (x < 0) x += span;
          g.cloud(x - 120 * s, L.top + 8 * s + cl.y * Math.max(20, L.hy - L.top - 50 * s), cl.s * s, th.cloudA * cl.a);
        }
        // 飞鸟 / 夜里的萤火虫在后面画
        if (!night) {
          c.strokeStyle = 'rgba(40,55,90,.65)'; c.lineWidth = 2 * s; c.lineCap = 'round';
          for (let i = 0; i < 3; i++) {
            const sp2 = g.w + 100, x = ((i * 0.41 * sp2 + T * (22 + i * 6)) % sp2) - 50;
            const y = L.top + (26 + i * 18) * s + Math.sin(T * 0.9 + i) * 6;
            const f = Math.sin(T * 8 + i * 2) * 4 * s, k = (6 - i) * s;
            c.beginPath(); c.moveTo(x - k * 1.4, y - f * 0.4); c.quadraticCurveTo(x - k * 0.6, y - k * 0.7 - f, x, y);
            c.quadraticCurveTo(x + k * 0.6, y - k * 0.7 - f, x + k * 1.4, y - f * 0.4); c.stroke();
          }
        }
        for (const kt of L.kites) drawKite(g, c, kt, T, night);
        drawSkyline(g, c, T, th);
        // 远山 + 近山
        hill(c, L.hy + 8 * s, 18 * s, th.hill1, 0.013 / s, 1.3, sw, gy);
        hill(c, gy - 18 * s, 14 * s, th.hill2, 0.02 / s, 4.1, sw, gy);
        palm(c, sw * 0.46, gy - 20 * s, 64 * s, 0.1, T, 1);
        palm(c, sw * 0.66, gy - 16 * s, 50 * s, -0.12, T, 2.4);
        // 地面 + 小路
        c.fillStyle = th.grass; c.fillRect(-20, gy - 16 * s, g.w + 40, bottom - gy + 16 * s + 20);
        c.fillStyle = th.grass2; c.fillRect(-20, gy + 18 * s, g.w + 40, bottom - gy);
        c.fillStyle = th.path;
        const pth = 12 * s;
        c.beginPath(); c.moveTo(L.castle.x + L.castle.w * 0.35, gy + pth); c.lineTo(sw + 20, gy + pth); c.lineTo(sw + 20, gy - pth * 0.6); c.lineTo(L.castle.x + L.castle.w * 0.35, gy - pth * 0.6); c.closePath(); c.fill();
        c.fillStyle = th.path2;
        for (let x = L.castle.x + L.castle.w * 0.6; x < sw; x += 46 * s) ell(c, x + 13 * s, gy + pth * 0.2, 5 * s, 2.4 * s, th.path2);
        // 草丛 + 小花
        c.strokeStyle = th.tuft; c.lineWidth = 2.4 * s; c.lineCap = 'round';
        for (const tf of L.tufts) {
          const x = tf.x, y = gy + 20 * s + tf.y * Math.max(4, bottom - gy - 26 * s), k = 8 * s * tf.s, sway = Math.sin(T * 2.2 + tf.ph) * 3 * s;
          c.beginPath();
          c.moveTo(x - k * 0.5, y); c.quadraticCurveTo(x - k * 0.5, y - k * 0.6, x - k * 0.9 + sway, y - k);
          c.moveTo(x, y); c.quadraticCurveTo(x, y - k * 0.8, x + sway, y - k * 1.3);
          c.moveTo(x + k * 0.5, y); c.quadraticCurveTo(x + k * 0.5, y - k * 0.6, x + k * 0.9 + sway, y - k);
          c.stroke();
        }
        for (const fl of L.flowers) {
          const x = fl.x, y = gy - 16 * s + fl.y * 6 * s + Math.sin(T * 2 + fl.ph) * 1.5;
          for (let i = 0; i < 5; i++) ell(c, x + Math.cos(i * TAU / 5 + T * 0.5) * 3.2 * s, y + Math.sin(i * TAU / 5 + T * 0.5) * 3.2 * s, 2.4 * s, 2.4 * s, fl.c);
          ell(c, x, y, 1.8 * s, 1.8 * s, '#FFB020');
        }
        // 竖屏：写字板背后铺一片草地
        if (L.port) {
          c.fillStyle = th.soil; c.fillRect(-10, L.sceneB, g.w + 20, g.h - L.sceneB + 10);
          c.fillStyle = 'rgba(255,255,255,.08)';
          for (let i = 0; i < 12; i++) ell(c, (i * 97 + 30) % g.w, L.sceneB + 20 + ((i * 53) % Math.max(10, g.h - L.sceneB - 20)), 16, 5, 'rgba(255,255,255,.1)');
        }
        // 萤火虫（夜）/ 蝴蝶（白天、黄昏）
        for (const bg of M.bugs) {
          const x = (bg.x * sw + Math.sin(T * bg.sp + bg.ph) * 40 * s + T * 8) % sw;
          const y = lerp(L.hy, gy - 10 * s, bg.y) + Math.sin(T * bg.sp * 1.7 + bg.ph) * 12 * s;
          if (night) {
            const a = 0.4 + 0.6 * Math.abs(Math.sin(T * 2.5 + bg.ph));
            c.globalAlpha = a * 0.35; ell(c, x, y, 7 * s, 7 * s, '#FFF27A');
            c.globalAlpha = a; ell(c, x, y, 2.2 * s, 2.2 * s, '#FFFBC0'); c.globalAlpha = 1;
          } else {
            const f = Math.abs(Math.sin(T * 14 + bg.ph));
            ell(c, x - 3.2 * s * f, y, 3.4 * s * f + 0.5, 2.8 * s, bg.c);
            ell(c, x + 3.2 * s * f, y, 3.4 * s * f + 0.5, 2.8 * s, bg.c);
            ell(c, x, y, 0.9 * s, 2.6 * s, NAVY);
          }
        }
      }
      function drawKite(g, c, kt, T, night) {
        const L = M.L, s = kt.s, ph = kt.ph;
        const skyH = Math.max(40, L.hy - L.top);
        const x = kt.fx * L.sceneR + Math.sin(T * 0.55 + ph) * 18 * s;
        const y = L.top + kt.fy * skyH + Math.sin(T * 0.9 + ph * 1.7) * 9 * s;
        const rot = Math.sin(T * 1.2 + ph) * 0.2;
        const w2 = 20 * s, h1 = 16 * s, h2 = 32 * s;
        c.save();
        c.globalAlpha = night ? 0.55 : 1;
        c.lineCap = 'round'; c.lineJoin = 'round';
        // 风筝线：从风筝往下垂向城楼方向，越往下越淡
        c.strokeStyle = 'rgba(29,43,83,.35)'; c.lineWidth = 1.2;
        const ey = L.hy + 30 * s, ex = x - (ey - y) * 0.45;          // 线头藏到远山后面
        c.beginPath(); c.moveTo(x, y + 4 * s);
        c.quadraticCurveTo(lerp(x, ex, 0.3) + Math.sin(T * 0.7 + ph) * 6 * s, lerp(y, ey, 0.6), ex, ey); c.stroke();
        // 尾巴：一条摆动的线 + 三个蝴蝶结
        const bx = x - Math.sin(rot) * h2, by = y + Math.cos(rot) * h2;
        c.strokeStyle = NAVY; c.lineWidth = 1.6;
        c.beginPath(); c.moveTo(bx, by);
        const tail = [];
        for (let i = 1; i <= 12; i++) {
          const ty = by + i * 5.5 * s, tx = bx + Math.sin(T * 4 + ph - i * 0.55) * (2 + i * 0.7) * s;
          c.lineTo(tx, ty); tail.push(tx, ty);
        }
        c.stroke();
        for (let i = 3; i < 12; i += 4) {
          const tx = tail[i * 2], ty = tail[i * 2 + 1], cc = kt.c[(i >> 2) % 2];
          c.fillStyle = cc;
          c.beginPath(); c.moveTo(tx, ty); c.lineTo(tx - 6 * s, ty - 4 * s); c.lineTo(tx - 6 * s, ty + 4 * s); c.closePath(); c.fill();
          c.beginPath(); c.moveTo(tx, ty); c.lineTo(tx + 6 * s, ty - 4 * s); c.lineTo(tx + 6 * s, ty + 4 * s); c.closePath(); c.fill();
        }
        // 菱形身体（四块两色）
        c.translate(x, y); c.rotate(rot);
        const P = [[0, -h1], [w2, 0], [0, h2], [-w2, 0]];
        for (let i = 0; i < 4; i++) {
          const a = P[i], b = P[(i + 1) % 4];
          c.fillStyle = kt.c[i % 2];
          c.beginPath(); c.moveTo(0, 0); c.lineTo(a[0], a[1]); c.lineTo(b[0], b[1]); c.closePath(); c.fill();
        }
        c.beginPath(); for (let i = 0; i < 4; i++) { if (i) c.lineTo(P[i][0], P[i][1]); else c.moveTo(P[i][0], P[i][1]); } c.closePath();
        c.strokeStyle = NAVY; c.lineWidth = 2.2; c.stroke();
        c.lineWidth = 1.4; c.beginPath(); c.moveTo(0, -h1); c.lineTo(0, h2); c.moveTo(-w2, 0); c.lineTo(w2, 0); c.stroke();
        c.restore();
      }
      function hill(c, y, amp, col, k, ph, w, gy) {
        c.fillStyle = col;
        c.beginPath(); c.moveTo(-10, gy + 10);
        for (let x = -10; x <= w + 30; x += 18) c.lineTo(x, y - amp * (0.55 + 0.45 * Math.sin(x * k + ph)) - amp * 0.35 * Math.sin(x * k * 2.3 + ph * 2));
        c.lineTo(w + 30, gy + 10); c.closePath(); c.fill();
      }
      function palm(c, x, y, hgt, lean, T, ph) {
        const s = hgt / 200, tx = x + lean * hgt, ty = y - hgt;
        c.lineCap = 'round'; c.strokeStyle = '#8A5A33'; c.lineWidth = 14 * s;
        c.beginPath(); c.moveTo(x, y); c.quadraticCurveTo(x + lean * hgt * 0.15, y - hgt * 0.6, tx, ty); c.stroke();
        const sway = Math.sin(T * 1.3 + ph) * 0.07;
        for (let i = 0; i < 7; i++) {
          const a = -Math.PI + 0.25 + i * 0.44 + sway + Math.sin(T * 2 + i + ph) * 0.03, L2 = (i === 0 || i === 6 ? 78 : 92) * s;
          c.save(); c.translate(tx, ty); c.rotate(a);
          c.fillStyle = i % 2 ? '#1F9446' : '#28A852';
          c.beginPath(); c.moveTo(0, 0); c.quadraticCurveTo(L2 * 0.45, -17 * s, L2, 20 * s); c.quadraticCurveTo(L2 * 0.5, 9 * s, 0, 0); c.fill();
          c.restore();
        }
        ell(c, tx - 5 * s, ty + 7 * s, 7 * s, 7 * s, '#6B4423'); ell(c, tx + 6 * s, ty + 8 * s, 7 * s, 7 * s, '#6B4423');
      }
      /* 横屏前景：割草条纹（越近越宽）+ 木路牌“第 N 关” + 底边摇摆的灌木丛 */
      function drawFore(g, c, T) {
        const L = M.L, F = L.fg;
        if (!F) return;
        const s = L.s, night = M.theme === 'night';
        c.fillStyle = night ? 'rgba(255,255,255,.035)' : 'rgba(255,255,255,.07)';
        let y = F.top;
        for (let i = 0; y < g.h && i < 40; i++) {
          const hh = (12 + i * 8) * s;
          if (i % 2 === 0) c.fillRect(-20, y, L.sceneR + 20, hh);
          y += hh;
        }
        const S = L.sign;
        if (S) {
          const bw = 104 * s, bh = 40 * s, rot = Math.sin(T * 1.4) * 0.035;
          c.save(); c.translate(S.x, S.y);
          c.globalAlpha = 0.22; ell(c, 0, 58 * s, 26 * s, 6 * s, '#101c44'); c.globalAlpha = 1;
          g.rrect(-5 * s, 0, 10 * s, 58 * s, 3 * s, '#8A5A33', NAVY, 2.5);
          c.rotate(rot);
          g.rrect(-bw / 2, -bh / 2 + 4 * s, bw, bh, 9 * s, NAVY);
          g.rrect(-bw / 2, -bh / 2, bw, bh, 9 * s, night ? '#A8733F' : '#C98A4B', NAVY, 3);
          c.strokeStyle = 'rgba(90,50,20,.35)'; c.lineWidth = 2 * s;
          c.beginPath(); c.moveTo(-bw / 2 + 8 * s, -bh * 0.12); c.lineTo(bw / 2 - 8 * s, -bh * 0.12); c.moveTo(-bw / 2 + 8 * s, bh * 0.22); c.lineTo(bw / 2 - 8 * s, bh * 0.22); c.stroke();
          g.text('第 ' + g.level + ' 关', 0, 1, { size: Math.round(21 * s), font: 'round', color: '#FFF3C4', stroke: NAVY, strokeW: 3.5 });
          ell(c, -bw / 2 + 7 * s, -bh / 2 + 7 * s, 2.4 * s, 2.4 * s, '#FFE45C'); ell(c, bw / 2 - 7 * s, -bh / 2 + 7 * s, 2.4 * s, 2.4 * s, '#FFE45C');
          c.restore();
        }
        const base = night ? '#1E5A3A' : '#2E9A4C', hi = night ? '#2F7A4E' : '#4CC066', lw = 3;
        for (const b of L.bushes) {
          const r = b.r, sway = Math.sin(T * 1.5 + b.ph) * 0.07;
          c.save(); c.translate(b.x, L.h + r * 0.05); c.transform(1, 0, sway, 1, 0, 0);
          const B = [[-r * 0.95, -r * 0.3, r * 0.68], [-r * 0.35, -r * 0.62, r * 0.8], [r * 0.38, -r * 0.7, r * 0.85], [r * 1.02, -r * 0.3, r * 0.7], [0, -r * 0.05, r * 0.95]];
          for (const q of B) ell(c, q[0], q[1], q[2] + lw, q[2] + lw, NAVY);
          for (const q of B) ell(c, q[0], q[1], q[2], q[2], base);
          for (const q of B) ell(c, q[0] - q[2] * 0.2, q[1] - q[2] * 0.28, q[2] * 0.62, q[2] * 0.5, hi);
          for (let i = 0; i < 5; i++) {
            const a = -2.6 + i * 0.52, rr = r * (0.55 + (i % 2) * 0.28);
            const bob = Math.sin(T * 3 + b.ph + i) * 1.2 * s;
            ell(c, Math.cos(a) * rr, -r * 0.35 + Math.sin(a) * rr * 0.75 + bob, 4.2 * s, 4.2 * s, b.dots, NAVY, 1.6);
          }
          c.restore();
        }
      }
      /* 远景：组屋 · 滨海湾金沙 · 擎天大树 */
      function drawSkyline(g, c, T, th) {
        const L = M.L, s = L.s, base = L.hy + 10 * s, sw = L.sceneR;
        c.fillStyle = th.far;
        for (const b of L.city) c.fillRect(b.x, base - b.h, b.w, b.h + 2);
        if (th.farWin) {
          c.fillStyle = th.farWin;
          const ws = 3.4 * s, hs = 4.2 * s;
          for (const b of L.city) for (const wv of b.win) { if (wv[2] >= 0 && Math.sin(T * 0.7 + wv[2]) < -0.3) continue; c.fillRect(b.x + wv[0], base - b.h + wv[1], ws, hs); }
        }
        // 滨海湾金沙
        const mx = sw * 0.5, k = s * 0.95;
        c.fillStyle = th.far;
        for (let i = 0; i < 3; i++) { const bx = mx + i * 20 * k; c.beginPath(); c.moveTo(bx, base); c.lineTo(bx + 3 * k, base - 58 * k); c.lineTo(bx + 12 * k, base - 58 * k); c.lineTo(bx + 14 * k, base); c.closePath(); c.fill(); }
        c.beginPath(); c.moveTo(mx - 6 * k, base - 58 * k); c.lineTo(mx + 62 * k, base - 60 * k); c.lineTo(mx + 68 * k, base - 64 * k); c.lineTo(mx - 6 * k, base - 64 * k); c.closePath(); c.fill();
        // 擎天大树
        for (let i = 0; i < 3; i++) {
          const tx = sw * (0.74 + i * 0.075), hh = (38 + (i % 2) * 14) * k;
          c.beginPath(); c.moveTo(tx - 4 * k, base); c.lineTo(tx - 1.5 * k, base - hh); c.lineTo(tx + 1.5 * k, base - hh); c.lineTo(tx + 4 * k, base); c.closePath(); c.fill();
          c.beginPath(); c.moveTo(tx - 14 * k, base - hh - 6 * k); c.quadraticCurveTo(tx, base - hh + 6 * k, tx + 14 * k, base - hh - 6 * k); c.lineTo(tx - 14 * k, base - hh - 6 * k); c.fill();
          if (th.farWin) { c.globalAlpha = 0.5 + 0.5 * Math.sin(T * 2 + i); ell(c, tx, base - hh - 5 * k, 12 * k, 2 * k, ['#FF7AD9', '#7AE0FF', '#B8FF7A'][i]); c.globalAlpha = 1; c.fillStyle = th.far; }
        }
      }

      /* ================= 画：城楼 ================= */
      function roof(c, cx, by, hw, rh, u, col) {
        c.beginPath();
        c.moveTo(cx - hw - 10 * u, by - rh * 0.6);
        c.quadraticCurveTo(cx - hw * 0.7, by + 3 * u, cx - hw * 0.3, by);
        c.lineTo(cx + hw * 0.3, by);
        c.quadraticCurveTo(cx + hw * 0.7, by + 3 * u, cx + hw + 10 * u, by - rh * 0.6);
        c.quadraticCurveTo(cx + hw * 0.62, by - rh * 0.5, cx + hw * 0.42, by - rh);
        c.lineTo(cx - hw * 0.42, by - rh);
        c.quadraticCurveTo(cx - hw * 0.62, by - rh * 0.5, cx - hw - 10 * u, by - rh * 0.6);
        c.closePath();
        c.fillStyle = col; c.fill();
        c.save(); c.clip();
        c.strokeStyle = 'rgba(0,0,0,.18)'; c.lineWidth = 2 * u;
        for (let x = cx - hw - 10 * u; x < cx + hw + 10 * u; x += 7 * u) { c.beginPath(); c.moveTo(x, by + 4 * u); c.lineTo(x + (x - cx) * 0.18, by - rh); c.stroke(); }
        c.restore();
        c.lineWidth = 3 * u; c.strokeStyle = NAVY; c.stroke();
        c.fillStyle = '#FFC928';
        c.fillRect(cx - hw * 0.46, by - rh - 3 * u, hw * 0.92, 5 * u);
        c.strokeRect(cx - hw * 0.46, by - rh - 3 * u, hw * 0.92, 5 * u);
      }
      function drawCastle(g, c, T) {
        const L = M.L, C = L.castle, x0 = C.x, base = C.base, cw = C.w, ch = C.h, u = cw / 140;
        const night = M.theme === 'night', th = THEME[M.theme];
        c.save();
        if (M.castleHit > 0) c.translate(Math.sin(T * 70) * 6 * M.castleHit, 0);
        c.lineJoin = 'round'; c.lineCap = 'round';
        const wallH = ch * 0.5, wy = base - wallH;
        const cx = x0 + cw / 2;
        // 城楼（柱子 + 墙）
        const px0 = x0 + cw * 0.16, px1 = x0 + cw * 0.84, ph = ch * 0.19, py = wy - ph;
        c.fillStyle = '#FFE8C4'; c.fillRect(px0, py, px1 - px0, ph);
        c.fillStyle = night ? '#FFD36B' : '#6B3F26';
        for (let i = 0; i < 3; i++) { const wx = px0 + (px1 - px0) * (0.2 + i * 0.3) - 7 * u; c.fillRect(wx, py + ph * 0.3, 14 * u, ph * 0.5); }
        c.fillStyle = '#D8342A';
        for (let i = 0; i < 4; i++) { const x = px0 + (px1 - px0) * i / 3 - 4 * u; c.fillRect(x, py, 8 * u, ph); c.strokeStyle = NAVY; c.lineWidth = 2 * u; c.strokeRect(x, py, 8 * u, ph); }
        // 上层小楼
        const p2w = cw * 0.4, p2h = ch * 0.12, p2y = py - 16 * u - p2h;
        c.fillStyle = '#FFE8C4'; c.fillRect(cx - p2w / 2, p2y, p2w, p2h + 4 * u);
        c.fillStyle = '#D8342A';
        c.fillRect(cx - p2w / 2, p2y, 7 * u, p2h + 4 * u); c.fillRect(cx + p2w / 2 - 7 * u, p2y, 7 * u, p2h + 4 * u);
        // 旗子
        const fx = cx, fy = p2y - 14 * u;
        c.strokeStyle = NAVY; c.lineWidth = 3 * u; c.beginPath(); c.moveTo(fx, fy); c.lineTo(fx, fy - 40 * u); c.stroke();
        c.fillStyle = '#E8392E'; c.beginPath(); c.moveTo(fx, fy - 40 * u);
        for (let i = 0; i <= 6; i++) { const xx = fx + i * 6 * u; c.lineTo(xx, fy - 40 * u + Math.sin(T * 7 - i * 0.8) * 2.5 * u * (i / 6)); }
        for (let i = 6; i >= 0; i--) { const xx = fx + i * 6 * u; c.lineTo(xx, fy - 18 * u + Math.sin(T * 7 - i * 0.8) * 2.5 * u * (i / 6)); }
        c.closePath(); c.fill(); c.lineWidth = 2 * u; c.stroke();
        g.text('字', fx + 18 * u, fy - 29 * u + Math.sin(T * 7 - 2.4) * 1.5 * u, { size: Math.round(14 * u), font: 'kai', color: '#FFE45C' });
        roof(c, cx, p2y + 3 * u, p2w * 0.72, 16 * u, u, night ? '#23735C' : '#2F9B76');
        roof(c, cx, py + 3 * u, (px1 - px0) * 0.62, 18 * u, u, night ? '#23735C' : '#2F9B76');
        // 灯笼（挂在下檐两角）
        for (let i = 0; i < 2; i++) {
          const lx = i ? px1 + 2 * u : px0 - 2 * u, ly = py + 6 * u;
          const rot = Math.sin(T * 2.2 + i * 1.7) * 0.16;
          c.save(); c.translate(lx, ly); c.rotate(rot);
          if (night) { c.globalAlpha = 0.35 + 0.1 * Math.sin(T * 3 + i); ell(c, 0, 16 * u, 22 * u, 22 * u, '#FFB347'); c.globalAlpha = 1; }
          c.strokeStyle = NAVY; c.lineWidth = 1.6 * u; c.beginPath(); c.moveTo(0, 0); c.lineTo(0, 8 * u); c.stroke();
          ell(c, 0, 16 * u, 9 * u, 8 * u, '#E8392E', NAVY, 2 * u);
          c.fillStyle = '#FFC928'; c.fillRect(-5 * u, 7 * u, 10 * u, 3 * u); c.fillRect(-5 * u, 22.5 * u, 10 * u, 3 * u);
          c.strokeStyle = '#FFC928'; c.lineWidth = 1.5 * u; c.beginPath(); c.moveTo(0, 25 * u); c.lineTo(0, 31 * u); c.stroke();
          c.restore();
        }
        // 熊猫炮手（在城垛后面）
        const bob = Math.sin(T * 3) * 2 * u - M.recoil * 3 * u;
        g.emoji('🐼', x0 + cw * 0.72, wy - 13 * u + bob, 30 * u * (1 + M.recoil * 0.12));
        // 城墙
        c.beginPath();
        c.moveTo(x0 - 4 * u, base); c.lineTo(x0 + 3 * u, wy); c.lineTo(x0 + cw - 3 * u, wy); c.lineTo(x0 + cw + 4 * u, base); c.closePath();
        c.fillStyle = grad(c, 'wall', 0, wy, 0, base, [0, th.wall[0], 1, th.wall[1]]); c.fill();
        c.save(); c.clip();
        c.strokeStyle = 'rgba(120,85,40,.3)'; c.lineWidth = 1.6 * u;
        const rows = 5, rh = wallH / rows;
        for (let r = 1; r <= rows; r++) {
          const y = wy + r * rh;
          c.beginPath(); c.moveTo(x0 - 6 * u, y); c.lineTo(x0 + cw + 6 * u, y); c.stroke();
          const off = (r % 2) * 14 * u;
          for (let x = x0 + off; x < x0 + cw; x += 28 * u) { c.beginPath(); c.moveTo(x, y - rh); c.lineTo(x, y); c.stroke(); }
        }
        // 裂缝（掉心越多越破）
        const cracks = Math.max(0, g.maxLives - g.lives);
        c.strokeStyle = 'rgba(40,25,15,.75)'; c.lineWidth = 2.2 * u;
        if (cracks >= 1) { c.beginPath(); c.moveTo(x0 + cw * 0.78, wy); c.lineTo(x0 + cw * 0.72, wy + wallH * 0.2); c.lineTo(x0 + cw * 0.8, wy + wallH * 0.35); c.lineTo(x0 + cw * 0.74, wy + wallH * 0.55); c.stroke(); }
        if (cracks >= 2) { c.beginPath(); c.moveTo(x0 + cw * 0.14, wy + wallH * 0.1); c.lineTo(x0 + cw * 0.22, wy + wallH * 0.3); c.lineTo(x0 + cw * 0.15, wy + wallH * 0.45); c.stroke(); }
        if (M.castleHit > 0) { c.globalAlpha = M.castleHit * 0.45; c.fillStyle = '#FF3B3B'; c.fillRect(x0 - 10 * u, wy - 10 * u, cw + 20 * u, wallH + 20 * u); c.globalAlpha = 1; }
        c.restore();
        c.lineWidth = 3 * u; c.strokeStyle = NAVY;
        c.beginPath(); c.moveTo(x0 - 4 * u, base); c.lineTo(x0 + 3 * u, wy); c.lineTo(x0 + cw - 3 * u, wy); c.lineTo(x0 + cw + 4 * u, base); c.stroke();
        // 城垛
        const n = 7, mw = cw / (n * 2 - 1);
        for (let i = 0; i < n; i++) {
          const mx = x0 + 3 * u + i * 2 * mw * ((cw - 6 * u) / cw);
          c.fillStyle = th.wall[0]; c.fillRect(mx, wy - 9 * u, mw, 9 * u + 1);
          c.lineWidth = 2.4 * u; c.strokeStyle = NAVY; c.strokeRect(mx, wy - 9 * u, mw, 9 * u);
        }
        // 城门
        const gw = cw * 0.3, gh = wallH * 0.64;
        c.beginPath(); c.moveTo(cx - gw / 2, base); c.lineTo(cx - gw / 2, base - gh + gw / 2); c.arc(cx, base - gh + gw / 2, gw / 2, Math.PI, 0); c.lineTo(cx + gw / 2, base); c.closePath();
        c.fillStyle = '#7A4526'; c.fill(); c.lineWidth = 3 * u; c.strokeStyle = NAVY; c.stroke();
        c.strokeStyle = 'rgba(0,0,0,.35)'; c.lineWidth = 2 * u; c.beginPath(); c.moveTo(cx, base - gh + 6 * u); c.lineTo(cx, base); c.stroke();
        c.fillStyle = '#FFC928';
        for (let r = 0; r < 3; r++) for (let q = -1; q <= 1; q += 2) ell(c, cx + q * gw * 0.26, base - gh * 0.62 + r * gh * 0.22, 2 * u, 2 * u, '#FFC928');
        // 大炮
        const K = L.cannon;
        c.save(); c.translate(K.x, K.y); c.rotate(K.ang); c.translate(-M.recoil * 9 * u, 0);
        g.rrect(-12 * u, -8 * u, 44 * u, 16 * u, 7 * u, '#3D4260', NAVY, 2.6 * u);
        g.rrect(22 * u, -10 * u, 12 * u, 20 * u, 4 * u, '#565C82', NAVY, 2.4 * u);
        c.fillStyle = '#FFC928'; c.fillRect(4 * u, -8 * u, 4 * u, 16 * u);
        c.fillStyle = 'rgba(255,255,255,.35)'; c.fillRect(-6 * u, -5 * u, 30 * u, 3 * u);
        if (M.recoil > 0.5) { c.globalAlpha = (M.recoil - 0.5) * 2; ell(c, 40 * u, 0, 12 * u, 9 * u, FIRE[M.streak >= 8 ? 2 : M.streak >= 4 ? 1 : 0].mid); c.globalAlpha = 1; }
        c.restore();
        ell(c, K.x - 4 * u, K.y + 6 * u, 8 * u, 8 * u, '#8A5A33', NAVY, 2.4 * u);
        ell(c, K.x - 4 * u, K.y + 6 * u, 2.5 * u, 2.5 * u, NAVY);
        // 冒烟（只剩 1 颗心）
        if (g.maxLives > 1 && g.lives === 1) {
          for (let i = 0; i < 4; i++) {
            const k2 = ((T * 0.5 + i / 4) % 1);
            c.globalAlpha = (1 - k2) * 0.45;
            ell(c, x0 + cw * 0.3 + Math.sin(T + i) * 6 * u, py - k2 * 60 * u, (6 + k2 * 14) * u, (6 + k2 * 14) * u, '#8B8FA3');
          }
          c.globalAlpha = 1;
        }
        c.restore();
      }

      /* ================= 画：怪兽 ================= */
      function bodyPath(c, ty, rx, ry, by, T, seed) {
        c.beginPath();
        if (ty.fluff) {
          const n = 26;
          for (let i = 0; i <= n; i++) {
            const a = i / n * TAU, k = i % 2 ? 0.97 : 1.1 + 0.03 * Math.sin(T * 6 + i);
            const x = Math.cos(a) * rx * k, y = by + Math.sin(a) * ry * k;
            if (i) c.lineTo(x, y); else c.moveTo(x, y);
          }
          c.closePath();
        } else if (ty.ghost) {
          c.ellipse(0, by, rx, ry, 0, Math.PI, 0);
          c.lineTo(rx, by + ry * 0.72);
          const nw = 4, step = 2 * rx / nw;
          for (let i = 0; i < nw; i++) {
            const x1 = rx - (i + 0.5) * step, x2 = rx - (i + 1) * step;
            c.quadraticCurveTo(x1, by + ry * (1.12 + 0.12 * Math.sin(T * 7 + i * 1.3 + seed)), x2, by + ry * 0.74);
          }
          c.closePath();
        } else c.ellipse(0, by, rx, ry, 0, 0, TAU);
      }
      function drawMonster(g, c, m, T) {
        if (!m || m.state === 'gone') return;
        const L = M.L, ty = m.ty, R = L.R0 * m.k;
        // 起点按这只怪兽自己的大小算：怪兽大王（×1.28）在竖屏 390 宽时右臂和背刺原来会伸出屏幕右边
        const xs = Math.max(L.xCastle + R, Math.min(L.xStart, L.sceneR - R * 1.45 - 6));
        const x = lerp(L.xCastle, xs, clamp(m.dx, -0.1, 1.2)) + m.lx, gy = L.groundY, lift = m.lift;
        m.cx = x; m.cy = gy - lift - R * 0.95; m.R = R;
        if (m.state === 'enter' && lift > L.groundY) return;
        c.save();
        c.lineJoin = 'round'; c.lineCap = 'round';
        const shw = clamp(1 - lift / (R * 4), 0.3, 1);
        c.globalAlpha = 0.25 * shw; ell(c, x, gy + R * 0.05, R * 0.95 * shw, R * 0.2 * shw, '#101c44'); c.globalAlpha = 1;
        const br = Math.sin(T * 3.2 + m.seed);
        let sx = 1 + m.sq * 0.2 - br * 0.02, sy = 1 - m.sq * 0.18 + br * 0.035;
        if (m.leapT > 0) { sy += 0.12; sx -= 0.06; }
        let jx = 0;
        if (m.state === 'die') { const p = clamp(m.dieT / 0.45, 0, 1); sx *= 1 + p * 0.4; sy *= 1 + p * 0.4; jx = Math.sin(T * 90) * 4 * p; }
        if (m.poke > 0) jx += Math.sin(m.poke * 20) * 4;
        c.translate(x + jx, gy - lift);
        if (ty.ghost) c.translate(0, -R * 0.14 + Math.sin(T * 2.6 + m.seed) * R * 0.06);
        c.scale(sx, sy);
        const by = -R * 0.95, rx = R, ry = R * 0.9, lw = Math.max(2.4, R * 0.075);
        // 脚
        if (!ty.ghost) {
          const st = m.state === 'walk' && m.walkDelay <= 0 ? Math.sin(m.ph * TAU) : 0;
          ell(c, -R * 0.42, -R * 0.1 - Math.max(0, st) * R * 0.14, R * 0.27, R * 0.17, ty.dark, NAVY, lw);
          ell(c, R * 0.42, -R * 0.1 - Math.max(0, -st) * R * 0.14, R * 0.27, R * 0.17, ty.dark, NAVY, lw);
        }
        // 手臂
        const up = m.roar > 0 || m.state === 'laugh' ? 1 : 0, swg = Math.sin(T * 5 + m.seed) * 0.25;
        for (let sd = -1; sd <= 1; sd += 2) {
          c.save(); c.translate(sd * R * 0.88, by + R * 0.12); c.rotate(sd * (0.55 + swg * sd) - up * sd * 1.5);
          ell(c, sd * R * 0.2, 0, R * 0.3, R * 0.16, ty.body, NAVY, lw);
          c.restore();
        }
        // 背刺
        if (ty.spikes) {
          c.fillStyle = '#FFD84D'; c.strokeStyle = NAVY; c.lineWidth = lw;
          for (let i = 0; i < 4; i++) {
            const a = -1.25 + i * 0.42, bx = Math.cos(a) * rx * 0.96, byy = by + Math.sin(a) * ry * 0.96;
            const nx = Math.cos(a), ny = Math.sin(a);
            c.beginPath(); c.moveTo(bx - ny * R * 0.13, byy + nx * R * 0.13); c.lineTo(bx + nx * R * 0.3, byy + ny * R * 0.3); c.lineTo(bx + ny * R * 0.13, byy - nx * R * 0.13); c.closePath(); c.fill(); c.stroke();
          }
        }
        // 角
        const horn = (hx, hy, dir, hs) => {
          c.beginPath(); c.moveTo(hx - R * 0.12 * hs, hy + R * 0.05);
          c.quadraticCurveTo(hx - R * 0.08 * hs + dir * R * 0.05, hy - R * 0.3 * hs, hx + dir * R * 0.2 * hs, hy - R * 0.45 * hs);
          c.quadraticCurveTo(hx + R * 0.02 + dir * R * 0.1 * hs, hy - R * 0.18 * hs, hx + R * 0.12 * hs, hy + R * 0.05);
          c.closePath(); c.fillStyle = '#FFF1C9'; c.fill(); c.lineWidth = lw; c.strokeStyle = NAVY; c.stroke();
        };
        if (ty.horns === 2) { horn(-R * 0.48, by - ry * 0.72, -1, 1); horn(R * 0.48, by - ry * 0.72, 1, 1); }
        else if (ty.horns === 1) horn(0, by - ry * 0.95, 0.4, 1.15);
        // 身体
        const gd = c.createRadialGradient(-R * 0.35, by - R * 0.45, R * 0.1, 0, by, R * 1.25);
        gd.addColorStop(0, '#FFFFFF'); gd.addColorStop(0.18, ty.body); gd.addColorStop(1, ty.dark);
        bodyPath(c, ty, rx, ry, by, T, m.seed);
        c.fillStyle = gd; c.fill(); c.lineWidth = lw; c.strokeStyle = NAVY; c.stroke();
        // 肚皮 + 字徽章（听写关印“？”）
        ell(c, 0, by + ry * 0.4, rx * 0.62, ry * 0.5, ty.belly);
        const badR = R * 0.3, bdy = by + ry * 0.56;
        ell(c, 0, bdy, badR, badR, '#FFFFFF', NAVY, lw * 0.7);
        if (m.tgt.mode === 'dict') g.text('？', 0, bdy, { size: Math.round(R * 0.42), font: 'round', color: '#8A4DE8' });
        else g.text(m.tgt.ch, 0, bdy + R * 0.01, { size: Math.round(R * 0.44), font: 'kai', color: NAVY });
        // 脸
        const fxc = -R * 0.12, ey = by - ry * 0.3;
        const eyes = ty.eyes === 1 ? [[fxc, R * 0.3]] : [[fxc - R * 0.3, R * 0.2], [fxc + R * 0.3, R * 0.2]];
        let lkx = -1, lky = 0.15;
        const ball = M.balls.find((b) => b.mon === m);
        if (ball) { const dx = ball.x - (x + fxc), dy = ball.y - (gy - lift + ey), dd = Math.hypot(dx, dy) || 1; lkx = dx / dd; lky = dy / dd; }
        const blink = m.blinkT < 0 ? 0.12 : 1;
        for (const e of eyes) {
          const ex = e[0], er = e[1];
          if (m.state === 'die') {
            c.strokeStyle = NAVY; c.lineWidth = lw;
            c.beginPath(); c.moveTo(ex - er * 0.6, ey - er * 0.6); c.lineTo(ex + er * 0.6, ey + er * 0.6); c.moveTo(ex + er * 0.6, ey - er * 0.6); c.lineTo(ex - er * 0.6, ey + er * 0.6); c.stroke();
          } else if (m.hurt > 0) {
            c.strokeStyle = NAVY; c.lineWidth = lw;
            const sd = ex < fxc ? 1 : -1;
            c.beginPath(); c.moveTo(ex - sd * er * 0.6, ey - er * 0.5); c.lineTo(ex + sd * er * 0.5, ey); c.lineTo(ex - sd * er * 0.6, ey + er * 0.5); c.stroke();
          } else if (m.state === 'dizzy') {
            c.strokeStyle = NAVY; c.lineWidth = lw * 0.8;
            c.beginPath();
            for (let a = 0; a < 10; a += 0.4) { const rr = er * a / 10, aa = a + T * 8; const px2 = ex + Math.cos(aa) * rr, py2 = ey + Math.sin(aa) * rr; if (a) c.lineTo(px2, py2); else c.moveTo(px2, py2); }
            c.stroke();
          } else if (m.state === 'laugh') {
            c.strokeStyle = NAVY; c.lineWidth = lw;
            c.beginPath(); c.arc(ex, ey + er * 0.3, er * 0.6, Math.PI * 1.15, Math.PI * 1.85); c.stroke();
          } else {
            ell(c, ex, ey, er, er * 1.15 * blink, '#FFFFFF', NAVY, lw * 0.8);
            if (blink > 0.5) {
              ell(c, ex + lkx * er * 0.38, ey + lky * er * 0.35, er * 0.5, er * 0.55, NAVY);
              ell(c, ex + lkx * er * 0.38 - er * 0.18, ey + lky * er * 0.35 - er * 0.2, er * 0.16, er * 0.16, '#FFFFFF');
            }
          }
        }
        // 眉毛（生气）
        if (m.state !== 'laugh' && m.state !== 'die') {
          const ang = m.roar > 0 ? 1.25 : 1;
          c.strokeStyle = NAVY; c.lineWidth = lw * 1.2;
          c.beginPath();
          if (eyes.length === 1) {
            const e = eyes[0];
            c.moveTo(e[0] - e[1] * 1.05, ey - e[1] * 1.45); c.lineTo(e[0], ey - e[1] * (1.45 - 0.35 * ang)); c.lineTo(e[0] + e[1] * 1.05, ey - e[1] * 1.45);
          } else {
            for (const e of eyes) {
              const sd = e[0] < fxc ? 1 : -1;
              c.moveTo(e[0] - sd * e[1] * 1.05, ey - e[1] * 1.7); c.lineTo(e[0] + sd * e[1] * 0.8, ey - e[1] * (1.7 - 0.5 * ang));
            }
          }
          c.stroke();
        }
        // 嘴
        const my = by + ry * 0.12;
        if (m.roar > 0 || m.state === 'attack' || m.state === 'laugh') {
          ell(c, fxc, my + R * 0.06, R * 0.27, R * 0.16, '#8E1B2E', NAVY, lw * 0.8);
          ell(c, fxc, my + R * 0.14, R * 0.13, R * 0.06, '#FF7A90');
          c.fillStyle = '#FFFFFF';
          for (let i = -1; i <= 1; i++) { c.beginPath(); c.moveTo(fxc + i * R * 0.12 - R * 0.05, my - R * 0.07); c.lineTo(fxc + i * R * 0.12 + R * 0.05, my - R * 0.07); c.lineTo(fxc + i * R * 0.12, my + R * 0.03); c.closePath(); c.fill(); }
        } else if (m.hurt > 0 || m.state === 'die' || m.state === 'dizzy') {
          ell(c, fxc, my + R * 0.04, R * 0.09, R * 0.075, '#8E1B2E', NAVY, lw * 0.6);
        } else {
          c.strokeStyle = NAVY; c.lineWidth = lw;
          c.beginPath(); c.moveTo(fxc - R * 0.24, my); c.quadraticCurveTo(fxc, my + R * 0.16, fxc + R * 0.24, my); c.stroke();
          if (ty.fang) {
            c.fillStyle = '#FFFFFF';
            for (let sd = -1; sd <= 1; sd += 2) { c.beginPath(); c.moveTo(fxc + sd * R * 0.15 - R * 0.045, my + R * 0.04); c.lineTo(fxc + sd * R * 0.15 + R * 0.045, my + R * 0.04); c.lineTo(fxc + sd * R * 0.15, my + R * 0.14); c.closePath(); c.fill(); c.lineWidth = lw * 0.5; c.stroke(); }
          }
        }
        // 王冠
        if (ty.crown) {
          const cy0 = by - ry * 0.86, cwd = R * 0.7, chh = R * 0.36;
          c.beginPath(); c.moveTo(-cwd / 2, cy0); c.lineTo(-cwd / 2, cy0 - chh); c.lineTo(-cwd / 4, cy0 - chh * 0.55); c.lineTo(0, cy0 - chh * 1.1); c.lineTo(cwd / 4, cy0 - chh * 0.55); c.lineTo(cwd / 2, cy0 - chh); c.lineTo(cwd / 2, cy0); c.closePath();
          c.fillStyle = '#FFD23F'; c.fill(); c.lineWidth = lw; c.strokeStyle = NAVY; c.stroke();
          ell(c, 0, cy0 - chh * 0.35, R * 0.06, R * 0.06, '#E8392E');
        }
        // 受击闪白
        if (m.flash > 0 || (m.state === 'die' && Math.sin(T * 40) > 0)) {
          c.globalAlpha = m.state === 'die' ? 0.8 : m.flash * 0.85;
          bodyPath(c, ty, rx, ry, by, T, m.seed); c.fillStyle = '#FFFFFF'; c.fill();
          c.globalAlpha = 1;
        }
        c.restore();
        // 晕眩星星
        if (m.state === 'dizzy') {
          for (let i = 0; i < 3; i++) {
            const a = T * 5 + i * TAU / 3;
            g.emoji('⭐', m.cx + Math.cos(a) * R * 0.7, m.cy - R * 1.15 + Math.sin(a) * R * 0.2, R * 0.32);
          }
        }
        // “吼！”
        if (m.roar > 0 && m.state !== 'die') {
          const bx = m.cx - R * 1.25, byy = m.cy - R * 1.05, k = clamp(m.roar * 4, 0, 1);
          c.save(); c.translate(bx, byy); c.scale(k, k); c.rotate(-0.12);
          g.rrect(-R * 0.5, -R * 0.26, R, R * 0.52, R * 0.2, '#FFFFFF', NAVY, 2.5);
          g.text('吼！', 0, 0, { size: Math.round(R * 0.34), font: 'round', color: '#E8392E' });
          c.restore();
        }
        if (m.state === 'laugh') g.text('哈哈！', m.cx, m.cy - R * 1.9, { size: Math.round(R * 0.45), font: 'round', color: '#FFFFFF', stroke: NAVY, strokeW: 4 });
        if (m.state !== 'die') drawHp(g, c, m);
      }
      function drawHp(g, c, m) {
        const R = m.R, n = m.hpMax;
        const bw = clamp(R * 2, 64, 150), bh = Math.round(clamp(R * 0.2, 10, 15));
        const topY = m.cy - R * 0.9 - R * (m.ty.crown ? 0.72 : m.ty.horns ? 0.62 : 0.3) - 8;
        const bx = m.cx - bw / 2 + bh * 0.6, by = topY - bh;
        m.hpY = by;
        g.rrect(bx, by + 3, bw, bh, bh / 2, NAVY);
        g.rrect(bx, by, bw, bh, bh / 2, '#402A55', NAVY, 2);
        const inW = bw - 4;
        const gw = inW * clamp(m.hpShow / n, 0, 1), fw = inW * clamp(m.hp / n, 0, 1);
        if (gw > 1) g.rrect(bx + 2, by + 2, Math.max(bh - 4, gw), bh - 4, (bh - 4) / 2, '#FFFFFF');
        if (fw > 1) {
          g.rrect(bx + 2, by + 2, Math.max(bh - 4, fw), bh - 4, (bh - 4) / 2, m.boss ? '#FF3D7F' : '#FF5A5F');
          g.rrect(bx + 2, by + 2, Math.max(bh - 4, fw), (bh - 4) * 0.45, (bh - 4) * 0.22, 'rgba(255,255,255,.45)');
        }
        if (n > 1 && n <= 16) {
          c.strokeStyle = 'rgba(29,43,83,.55)'; c.lineWidth = 1.5;
          c.beginPath();
          for (let i = 1; i < n; i++) { const xx = bx + 2 + inW * i / n; c.moveTo(xx, by + 3); c.lineTo(xx, by + bh - 3); }
          c.stroke();
        }
        const r = bh * 0.95;
        g.rrect(bx - r * 1.2, by + bh / 2 - r + 2, r * 2, r * 2, r, NAVY);
        g.rrect(bx - r * 1.2, by + bh / 2 - r, r * 2, r * 2, r, '#FF5A5F', NAVY, 2);
        g.text(String(m.hp), bx - r * 0.2, by + bh / 2 + 1, { size: Math.round(r * 1.25), font: 'num', color: '#FFFFFF' });
      }

      /* 危险提示：城楼那一侧泛红光 + 熊猫头上一个跳动的“！”（怪兽走进最后 30% 的路才出现） */
      function drawDanger(g, c, T) {
        const k = M.danger;
        if (k < 0.02) return;
        const L = M.L, C = L.castle, u = C.w / 140;
        const pulse = 0.6 + 0.4 * Math.sin(T * 9);
        const x1 = C.x + C.w * 1.6, yb = L.port ? L.sceneB : L.h;
        const gd = c.createLinearGradient(0, 0, x1, 0);
        gd.addColorStop(0, 'rgba(255,40,50,' + (0.34 * k * pulse).toFixed(3) + ')'); gd.addColorStop(1, 'rgba(255,40,50,0)');
        c.fillStyle = gd; c.fillRect(0, L.top, x1, yb - L.top);
        const r = Math.max(12, 15 * u) * (0.85 + 0.15 * k), bx = C.x + C.w * 0.72, by = C.base - C.h * 0.5 - 30 * u - r - Math.abs(Math.sin(T * 7)) * 6 * u;
        c.save(); c.globalAlpha = Math.min(1, k * 1.6);
        ell(c, bx, by + 2.5, r, r, NAVY);
        ell(c, bx, by, r, r, '#FF3B3B', NAVY, 2.5);
        g.text('!', bx, by + 1, { size: Math.round(r * 1.5), font: 'num', color: '#FFFFFF' });
        c.restore();
      }

      /* ================= 画：火球 / 战利品 / 孔明灯 / 横幅 ================= */
      function drawBalls(g, c) {
        const T = M.clock;
        for (const b of M.balls) {
          const F = FIRE[b.tier], r = (10 + b.tier * 3) * M.L.s;
          const tr = b.tr, n = tr.length / 2;
          for (let i = 0; i < n; i++) {                 // 发光拖尾
            const k = (i + 1) / n;
            c.fillStyle = F.glow + (0.06 + k * 0.3).toFixed(2) + ')';
            c.beginPath(); c.arc(tr[i * 2], tr[i * 2 + 1], r * (0.3 + k * 0.95), 0, TAU); c.fill();
          }
          let ang = 0;
          if (n >= 3) ang = Math.atan2(b.y - tr[(n - 3) * 2 + 1], b.x - tr[(n - 3) * 2]);
          c.save(); c.translate(b.x, b.y); c.rotate(ang);
          c.fillStyle = F.glow + '0.3)'; c.beginPath(); c.arc(0, 0, r * 2.3, 0, TAU); c.fill();
          // 火舌（朝飞行反方向，一跳一跳）
          const fl = r * (2.7 + 0.5 * Math.sin(T * 38 + b.t * 25)), wob = Math.sin(T * 31 + b.t * 17) * r * 0.35;
          c.fillStyle = F.mid;
          c.beginPath(); c.moveTo(r * 0.3, -r * 1.02); c.quadraticCurveTo(-fl * 0.45, -r * 1.1, -fl, wob); c.quadraticCurveTo(-fl * 0.45, r * 1.1, r * 0.3, r * 1.02); c.closePath(); c.fill();
          c.fillStyle = F.spark;
          c.beginPath(); c.moveTo(r * 0.2, -r * 0.6); c.quadraticCurveTo(-fl * 0.3, -r * 0.6, -fl * 0.62, wob * 0.6); c.quadraticCurveTo(-fl * 0.3, r * 0.6, r * 0.2, r * 0.6); c.closePath(); c.fill();
          ell(c, 0, 0, r, r, F.mid);
          ell(c, r * 0.12, -r * 0.1, r * 0.64, r * 0.64, F.core);
          c.restore();
          if (b.tier === 2) g.emoji('✨', b.x, b.y - r * 1.7, r * 1.6);
        }
      }
      /* 战利品：字从怪兽身上蹦出来（金字 + 拼音），停一下，然后划一道弧线飞进顶部进度条 */
      const TROPHY_FLY = 0.8, TROPHY_END = 1.35;
      function trophyTick(g, dt) {
        for (let i = M.trophies.length - 1; i >= 0; i--) {
          const tp = M.trophies[i];
          tp.t += dt;
          if (!tp.hit && tp.t >= TROPHY_END - 0.05) {
            tp.hit = true;
            const tx = g.w / 2, ty = Math.max(18, g.hudTop * 0.48);
            g.burst(tx, ty, { kind: 'star', n: 6 });
            g.ring(tx, ty, '#FFE45C', 46);
            g.sfx('coin');
          }
          if (tp.t > TROPHY_END) M.trophies.splice(i, 1);
        }
      }
      function drawTrophies(g) {
        const L = M.L, c = g.c;
        for (const tp of M.trophies) {
          const t = tp.t;
          const fs = Math.round(clamp(L.R0 * 1.25, 40, 76) * (tp.text.length > 1 ? 0.8 : 1));
          const x0 = clamp(tp.x, fs * tp.text.length * 0.55 + 6, L.sceneR - fs * tp.text.length * 0.55 - 6);
          // 升到血条那么高（怪兽脚下的“+分”飘字往上飘，别和战利品字、拼音叠在一起）
          const y0 = Math.max(L.top + fs * 0.7, tp.y - 32 * L.s - tp.R * 0.6);
          let x, y, k, a = 1, showPy = true;
          if (t < TROPHY_FLY) {
            k = t < 0.4 ? outBack(t / 0.4) : 1 + 0.04 * Math.sin((t - 0.4) * 14);
            const r = Math.min(1, t / 0.3);
            x = x0; y = lerp(tp.y, y0, 1 - (1 - r) * (1 - r));
          } else {
            const u = clamp((t - TROPHY_FLY) / (TROPHY_END - TROPHY_FLY), 0, 1), e = u * u;
            const tx = g.w / 2, ty = Math.max(18, g.hudTop * 0.48);
            const cx = lerp(x0, tx, 0.35), cy = Math.min(y0, ty) - 40 * L.s;
            const q = 1 - e;
            x = q * q * x0 + 2 * q * e * cx + e * e * tx;
            y = q * q * y0 + 2 * q * e * cy + e * e * ty;
            k = 1 - 0.72 * e; a = 1 - 0.25 * e; showPy = u < 0.25;
          }
          c.save(); c.translate(x, y); c.scale(k, k); c.rotate(t >= TROPHY_FLY ? (t - TROPHY_FLY) * 3 : 0);
          c.globalAlpha = a * 0.5; ell(c, 0, 0, fs * (0.5 + tp.text.length * 0.45), fs * 0.75, '#FFF6B0'); c.globalAlpha = 1;
          g.text(tp.text, 0, 0, { size: fs, font: 'kai', color: '#FFD23F', stroke: NAVY, strokeW: Math.max(3, fs * 0.08), shadow: true, alpha: a });
          if (showPy) g.text(tp.py, 0, fs * 0.72, { size: Math.round(fs * 0.34), font: 'py', color: '#FFFFFF', stroke: NAVY, strokeW: 3, alpha: a });
          c.restore();
        }
      }
      function drawLanterns(g, c, T) {
        for (const ln of M.lanterns) {
          const r = ln.r, x = ln.x, y = ln.y, fl = 0.8 + 0.2 * Math.sin(T * 9 + ln.ph);
          c.globalAlpha = 0.3 * fl; ell(c, x, y, r * 2, r * 2, '#FFC870'); c.globalAlpha = 1;
          c.beginPath(); c.moveTo(x - r * 0.9, y - r); c.lineTo(x + r * 0.9, y - r); c.lineTo(x + r * 0.65, y + r); c.lineTo(x - r * 0.65, y + r); c.closePath();
          c.fillStyle = '#FF6A3D'; c.fill(); c.lineWidth = 2.2; c.strokeStyle = NAVY; c.stroke();
          c.globalAlpha = 0.7 * fl; ell(c, x, y + r * 0.3, r * 0.45, r * 0.5, '#FFE45C'); c.globalAlpha = 1;
          g.text('福', x, y - r * 0.2, { size: Math.round(r * 0.9), font: 'kai', color: '#FFE45C' });
        }
      }
      function drawBanner(g) {
        const B = M.banner;
        if (!B) return;
        const L = M.L, t = B.t;
        const k = t < 0.35 ? outBack(t / 0.35) : 1, a = t > 1.4 ? Math.max(0, 1 - (t - 1.4) / 0.4) : 1;
        const cx = L.sceneR / 2, cy = L.top + (L.groundY - L.top) * 0.42;
        const fs = Math.round(clamp(L.sceneR * 0.075, 24, 44));
        g.c.save(); g.c.globalAlpha = a; g.c.translate(cx, cy); g.c.scale(k, k); g.c.rotate(-0.04);
        const bw = g.measure(B.text, fs, 'round') + fs * 2.4, bh = fs * 1.7;
        g.rrect(-bw / 2, -bh / 2 + 5, bw, bh, bh / 2, NAVY);
        g.rrect(-bw / 2, -bh / 2, bw, bh, bh / 2, '#FF4D6A', NAVY, 4);
        g.emoji('👑', -bw / 2 + fs * 0.75, 0, fs);
        g.text(B.text, fs * 0.45, 1, { size: fs, font: 'round', color: '#FFFFFF', stroke: NAVY, strokeW: 4 });
        g.c.restore();
      }

      /* ================= 画：写字板 ================= */
      function btn3d(g, c, x, y, r, fill, pressed, emoji, glow) {
        const dy = pressed * 3;
        if (glow > 0) { c.globalAlpha = glow * 0.5; ell(c, x, y, r * (1.25 + 0.15 * Math.sin(M.clock * 8)), r * (1.25 + 0.15 * Math.sin(M.clock * 8)), '#FFE45C'); c.globalAlpha = 1; }
        ell(c, x, y + 4, r, r, NAVY);
        ell(c, x, y + dy, r, r, fill, NAVY, 3);
        ell(c, x, y + dy - r * 0.42, r * 0.6, r * 0.28, 'rgba(255,255,255,.35)');
        g.emoji(emoji, x, y + dy, r * 1.05);
      }
      function rich(g, parts, x, y, size, font, maxW) {
        let tw = 0;
        for (const p of parts) tw += g.measure(p[0], size, font);
        let k = 1;
        if (maxW && tw > maxW) k = maxW / tw;
        const fs = Math.max(10, Math.floor(size * k));
        let cx = x;
        for (const p of parts) {
          g.text(p[0], cx, y, { size: fs, font, color: p[1], align: 'left' });
          cx += g.measure(p[0], fs, font);
        }
        return cx - x;
      }
      function drawBoard(g, c, T) {
        const L = M.L, b = L.board, tgt = M.tgt || M.targets[0];
        // 面板
        g.rrect(b.x, b.y + 6, b.w, b.h, 22, NAVY);
        c.fillStyle = grad(c, 'board', 0, b.y, 0, b.y + b.h, [0, '#FFF8E4', 1, '#FFE6B4']);
        g.rrect(b.x, b.y, b.w, b.h, 22, c.fillStyle, NAVY, 4);
        c.setLineDash([6, 7]); c.strokeStyle = 'rgba(29,43,83,.18)'; c.lineWidth = 2;
        c.beginPath();
        if (L.side) { c.moveTo(b.x + L.colW + 8, b.y + 16); c.lineTo(b.x + L.colW + 8, b.y + b.h - 16); }
        else { c.moveTo(b.x + 16, b.y + L.hh); c.lineTo(b.x + b.w - 16, b.y + L.hh); }
        c.stroke(); c.setLineDash([]);
        if (!tgt) {
          g.text('这一关没有能写的字', b.x + b.w / 2, b.y + b.h / 2, { size: 22, font: 'round', color: NAVY });
          return;
        }
        // 模式标签
        const tag = MODE_TAG[tgt.mode] || MODE_TAG.copy;
        const tfs = Math.round(clamp(L.side ? 15 : L.hh * 0.2, 14, 19)), tw = g.measure(tag[0], tfs, 'round') + 22;
        g.rrect(b.x + 18, b.y - tfs * 0.9 + 3, tw, tfs * 1.6, tfs * 0.8, tag[2]);
        g.rrect(b.x + 18, b.y - tfs * 0.9, tw, tfs * 1.6, tfs * 0.8, tag[1], NAVY, 2.5);
        g.text(tag[0], b.x + 18 + tw / 2, b.y - tfs * 0.1, { size: tfs, font: 'round', color: '#FFFFFF', stroke: NAVY, strokeW: 3 });
        // 字卡（点一下重听）
        const cd = L.card, pr = M.press.card * 3;
        const speaking = g.speaking || M.sayPulse > 0;
        g.rrect(cd.x, cd.y + 4, cd.s, cd.s, 12, NAVY);
        if (tgt.mode === 'dict') {
          g.rrect(cd.x, cd.y + pr, cd.s, cd.s, 12, '#EFE2FF', NAVY, 3);
          const wv = speaking ? 1 + 0.12 * Math.sin(T * 12) : 1 + 0.05 * Math.sin(T * 3);
          g.emoji('🔊', cd.x + cd.s / 2, cd.y + pr + cd.s * 0.44, cd.s * 0.5 * wv);
          g.text('点我听', cd.x + cd.s / 2, cd.y + pr + cd.s * 0.84, { size: Math.round(cd.s * 0.18), font: 'round', color: '#6A2FC8' });
          if (speaking) {
            c.strokeStyle = '#A45CFF'; c.lineWidth = 3; c.lineCap = 'round';
            for (let i = 0; i < 2; i++) { const kk = (T * 1.6 + i * 0.5) % 1; c.globalAlpha = 1 - kk; c.beginPath(); c.arc(cd.x + cd.s / 2, cd.y + cd.s * 0.44, cd.s * (0.36 + kk * 0.3), -0.6, 0.6); c.stroke(); } c.globalAlpha = 1;
          }
        } else {
          g.rrect(cd.x, cd.y + pr, cd.s, cd.s, 12, '#FFFFFF', NAVY, 3);
          c.setLineDash([4, 4]); c.strokeStyle = 'rgba(226,87,74,.45)'; c.lineWidth = 1.5;
          c.beginPath(); c.moveTo(cd.x + 6, cd.y + pr + cd.s / 2); c.lineTo(cd.x + cd.s - 6, cd.y + pr + cd.s / 2);
          c.moveTo(cd.x + cd.s / 2, cd.y + pr + 6); c.lineTo(cd.x + cd.s / 2, cd.y + pr + cd.s - 6); c.stroke(); c.setLineDash([]);
          g.text(tgt.ch, cd.x + cd.s / 2, cd.y + pr + cd.s * 0.52, { size: Math.round(cd.s * 0.74), font: 'kai', color: NAVY });
          g.emoji('🔊', cd.x + cd.s - 4, cd.y + pr + 6, Math.max(16, cd.s * 0.3) * (speaking ? 1 + 0.12 * Math.sin(T * 12) : 1));
        }
        // 拼音 + 组词 / 听写槽
        const tx = L.txtX, tr = L.txtR, tW = Math.max(40, tr - tx);
        const y1 = L.side ? L.pyY : b.y + L.hh * 0.34, y2 = L.side ? L.wY + 4 : b.y + L.hh * 0.72;
        const pfs = L.side ? L.pfs : Math.round(clamp(L.hh * 0.3, 20, 30)), wfs = L.side ? L.wfs : Math.round(clamp(L.hh * 0.26, 16, 26));
        if (tgt.kind === 'word') {
          const parts = [];
          tgt.wpy.forEach((sy, i) => { parts.push([sy, i === tgt.wi ? '#E8392E' : i < tgt.wi ? '#2E9B5A' : '#6B7699']); if (i < tgt.wn - 1) parts.push([' ', NAVY]); });
          rich(g, parts, tx, y1, pfs, 'py', tW);
          const gap = 6, sz = Math.round(Math.min(L.side ? 34 : clamp(L.hh * 0.36, 26, 38), (tW - gap * (tgt.wn - 1)) / tgt.wn));
          for (let i = 0; i < tgt.wn; i++) {
            const sx = tx + i * (sz + gap), sy = y2 - sz / 2;
            const curr = i === tgt.wi, done = i < tgt.wi || (curr && tgt.complete);
            const bump = curr && !done ? 1 + 0.06 * Math.sin(T * 6) : 1;
            c.save(); c.translate(sx + sz / 2, y2); c.scale(bump, bump);
            g.rrect(-sz / 2, -sz / 2, sz, sz, 6, done ? '#FFFFFF' : curr ? '#FFF1B8' : '#F3E9D2', curr ? '#E8392E' : NAVY, curr ? 3 : 2);
            if (done) g.text(tgt.word[i], 0, 1, { size: Math.round(sz * 0.72), font: 'kai', color: NAVY });
            else if (curr) g.text('？', 0, 1, { size: Math.round(sz * 0.6), font: 'round', color: '#E8392E' });
            c.restore();
            if (sx + sz > tr) break;
          }
        } else {
          rich(g, [[tgt.py, tgt.mode === 'dict' ? '#6A2FC8' : '#1C6CC8']], tx, y1, pfs, 'py', tW);
          const wordParts = (w) => Array.from(w).map((chh) => (chh === tgt.ch ? [tgt.mode === 'dict' ? '□' : chh, tgt.mode === 'dict' ? '#8A4DE8' : '#E8392E'] : [chh, NAVY]));
          if (L.side) {
            // 左列窄：一行一个词，放到 💡 上面为止
            const lh = wfs * 1.3;
            let k = 0;
            for (const w of tgt.words) { const yy = y2 + k * lh; if (yy > L.wMax) break; rich(g, wordParts(w), tx, yy, wfs, 'kai', tW); k++; }
            if (!k) g.text(tgt.n + ' 画', tx, y2, { size: wfs, font: 'round', color: '#6B7699', align: 'left' });
          } else {
            // 组词多、词又长（P6“大名鼎鼎 鼎力相助 三足鼎立”）时整行会被压到 14px：宁可少放一个词，也不让字小于 18px
            let ws = tgt.words.slice(0, L.port ? 3 : 4);
            const minF = Math.min(wfs, 18);
            while (ws.length > 1 && g.measure(ws.join('　'), wfs, 'kai') * minF / wfs > tW) ws = ws.slice(0, -1);
            const parts = [];
            ws.forEach((w, wi) => { parts.push(...wordParts(w)); if (wi < ws.length - 1) parts.push(['　', NAVY]); });
            if (parts.length) rich(g, parts, tx, y2, wfs, 'kai', tW);
            else g.text(tgt.n + ' 画', tx, y2, { size: wfs, font: 'round', color: '#6B7699', align: 'left' });
          }
        }
        // 💡
        const bh2 = L.btnHint;
        btn3d(g, c, bh2.x, bh2.y, bh2.r, M.hintCool > 0 ? '#E9DFC4' : '#FFD84D', M.press.hint, '💡', 0);
        // 田字格外框（写对闪金、写错闪红）
        const Gd = L.grid, fp = Math.round(clamp(Gd.s * 0.035, 8, 14));
        const fx = Gd.x - fp, fy = Gd.y - fp, fw = Gd.s + fp * 2;
        if (M.flashGood > 0) { c.globalAlpha = M.flashGood * 0.7; g.rrect(fx - 8, fy - 8, fw + 16, fw + 16, 22, '#FFE45C'); c.globalAlpha = 1; }
        if (M.flashBad > 0) { c.globalAlpha = M.flashBad * 0.7; g.rrect(fx - 8, fy - 8, fw + 16, fw + 16, 22, '#FF5A5F'); c.globalAlpha = 1; }
        if (M.hint || (g.state === 'play' && M.tgt && !M.touched)) { c.globalAlpha = 0.35 + 0.25 * Math.sin(T * 5); g.rrect(fx - 6, fy - 6, fw + 12, fw + 12, 20, '#FFFFFF'); c.globalAlpha = 1; }
        g.rrect(fx, fy + 5, fw, fw, 16, NAVY);
        c.fillStyle = grad(c, 'frame', 0, fy, 0, fy + fw, [0, '#F2C27E', 1, '#D9964E']);
        g.rrect(fx, fy, fw, fw, 16, c.fillStyle, NAVY, 3);
        // 第几笔
        const done = tgt.complete ? tgt.n : Math.min(tgt.si, tgt.n);
        const lab = tgt.complete ? '写好啦！' : '第 ' + Math.min(done + 1, tgt.n) + ' / ' + tgt.n + ' 笔';
        const lfs = Math.round(clamp(Gd.s * 0.05, 13, 18)), lw2 = g.measure(lab, lfs, 'round') + 22;
        const ly = fy + fw + 2;
        g.rrect(Gd.x + Gd.s / 2 - lw2 / 2, ly - lfs * 0.8 + 3, lw2, lfs * 1.6, lfs * 0.8, NAVY);
        g.rrect(Gd.x + Gd.s / 2 - lw2 / 2, ly - lfs * 0.8, lw2, lfs * 1.6, lfs * 0.8, tgt.complete ? '#3CCB5A' : '#FFFBEF', NAVY, 2.5);
        g.text(lab, Gd.x + Gd.s / 2, ly + 1, { size: lfs, font: 'round', color: tgt.complete ? '#FFFFFF' : NAVY });
        // 连写火力（田字格右下角，和“第几笔”同一条线；放右上角会压住竖屏的 💡 按钮）
        if (M.streak >= 3 && !tgt.complete) {
          const F = FIRE[M.streak >= 8 ? 2 : M.streak >= 4 ? 1 : 0];
          const st = '🔥连写×' + M.streak, sfs = Math.round(clamp(Gd.s * 0.045, 12, 17)), sw2 = g.measure(st, sfs, 'round') + 18;
          const sx = fx + fw - sw2 - 2, sy = ly;
          c.save(); c.translate(sx + sw2 / 2, sy); c.rotate(0.06); const kk = 1 + 0.05 * Math.sin(T * 10); c.scale(kk, kk);
          g.rrect(-sw2 / 2, -sfs * 0.8, sw2, sfs * 1.6, sfs * 0.8, F.mid, NAVY, 2.5);
          g.text(st, 0, 1, { size: sfs, font: 'round', color: '#FFFFFF', stroke: NAVY, strokeW: 3 });
          c.restore();
        }
      }

      /* ================= 按键 / 点击 ================= */
      function replay(g) {
        if (!M || !M.tgt) return;
        M.press.card = 1;
        g.sfx('tick');
        sayTarget(g, M.tgt, true);
      }
      function hintNow(g) {
        const tgt = M && M.tgt;
        if (!tgt || tgt.complete || !writer) return;
        M.press.hint = 1;
        if (M.hintCool > 0) return;
        M.hintCool = 1.5;
        tgt.hints++;
        const k = Math.min(tgt.si, tgt.n - 1);
        try { writer.highlightStroke(k); } catch (e) { /* ignore */ }
        showHint(k, false);
        g.sfx('bubble');
      }

      /* ================= spec ================= */
      const spec = {
        maxLevel: 10, lives: 3, rounds: 5, music: 'drum', sky: 'day',
        intro: '按笔顺写字，每写对一笔，城堡就发射火球打怪兽！',
        controls: '在田字格里写字 · 点字卡或空格重听 · 💡 看提示',
        init(g) {
          g.sky = null;                 // 选关界面用引擎的白天背景；开打后整幅画面由本游戏自己画
          killWriter(); hideHint();
          const theme = themeOf(g.level);
          M = {
            g, seed: (Math.random() * 1e9) | 0, theme, L: null, gr: Object.create(null),
            targets: [], ti: -1, tgt: null, mon: null, balls: [], trophies: [], lanterns: [], lanNext: rand(5, 8),
            streak: 0, flashGood: 0, flashBad: 0, recoil: 0, castleHit: 0, idle: 0, touched: false, hint: null, hintCool: 0,
            sayPulse: 0, sayTok: 0, over: false, danger: 0, press: { card: 0, hint: 0 }, banner: null, clock: 0, lastDraw: 0, qtok: 0, inner: 0, pad: 0,
            clouds: [], stars: [], bugs: []
          };
          for (let i = 0; i < 6; i++) M.clouds.push({ x: Math.random(), y: Math.random(), s: rand(0.5, 1.05), v: rand(6, 16), a: rand(0.75, 1) });
          for (let i = 0; i < 70; i++) M.stars.push({ x: Math.random(), y: Math.random(), r: rand(1, 2.6), ph: rand(0, TAU), sp: rand(0.8, 2.6) });
          for (let i = 0; i < 5; i++) M.bugs.push({ x: Math.random(), y: rand(0.2, 0.9), ph: rand(0, TAU), sp: rand(0.5, 1.2), c: ['#FF8AC8', '#FFD23F', '#8AD8FF', '#FFFFFF', '#B388FF'][i] });
          g.M = M;
          try { W.__monster = g; } catch (e) { /* ignore */ }
          M.targets = buildTargets(g);
          g.rounds = Math.max(1, M.targets.length);
          M.L = layout(g);
          g.music(g.level <= 3 ? 'bright' : 'drum');
          if (M.targets.length) {
            const t0 = M.targets[0];
            if (mountWriter(t0)) { M.tgt = t0; M.ti = 0; M.mon = makeMonster(g, t0, 0, true); }
          }
        },
        play(g) {
          if (!M) return;
          if (!M.targets.length || !M.mon) { M.empty = true; return; }
          beginTarget(g, 0, true);
        },
        update(g, dt) {
          if (!M) return;
          animTick(g, dt);
          logicTick(g, dt);
        },
        draw(g, c) {
          if (!M) return;
          const t = nowMs();
          const dt = M.lastDraw ? clamp((t - M.lastDraw) / 1000, 0, 0.05) : 0;
          M.lastDraw = t;
          if (g.state !== 'pause') M.clock += dt;
          if (g.state === 'over' && !M.over) {
            // 本关结束（通关 / 心没了）：田字格立刻停止判笔——否则结算面板盖上来之前的半秒里孩子还在写，
            // 写完会让已经在“哈哈”大笑的怪兽又爆炸一次、还往错题本里记账
            M.over = true; M.qtok++; hideHint();
            if (writer) { try { writer.cancelQuiz(); } catch (e) { /* ignore */ } }
          }
          if (g.state === 'over' || g.state === 'intro') animTick(g, dt);
          if (!M.L || M.L.w !== g.w || M.L.gh !== g.h || M.L.top !== g.hudTop || M.L.ih !== (W.innerHeight || 0)) relayout(g);
          const T = M.clock;
          drawScene(g, c, T);
          drawFore(g, c, T);
          drawLanterns(g, c, T);
          drawCastle(g, c, T);
          drawMonster(g, c, M.mon, T);
          drawDanger(g, c, T);
          drawBalls(g, c);
          drawTrophies(g);
          drawBoard(g, c, T);
          drawBanner(g);
          syncFinger();
        },
        down(g, p) {
          if (!M) return;
          const L = M.L;
          if (g.hitRect(p, L.card.x - 6, L.card.y - 6, L.card.s + 12, L.card.s + 12)) { replay(g); return; }
          if (g.hitCircle(p, L.btnHint.x, L.btnHint.y, L.btnHint.r + 8)) { hintNow(g); return; }
          for (const ln of M.lanterns) if (g.hitCircle(p, ln.x, ln.y, ln.r * 1.7)) { popLantern(g, ln); return; }
          const m = M.mon;
          if (m && m.state !== 'gone' && g.hitCircle(p, m.cx, m.cy, m.R * 1.1)) { m.poke = 1; m.roar = Math.max(m.roar, 0.35); g.sfx('bubble'); }
        },
        key(g, k) {
          if (k === 'space' || k === 'enter') replay(g);
          else if (k === 'h' || k === 'H') hintNow(g);
        },
        resize(g) { relayout(g); },
        dom(g, layer) { buildDom(layer); },
        end() {
          killWriter(); hideHint();
          try { if (host) host.remove(); } catch (e) { /* ignore */ }
          host = null; M = null;
          try { if (W.__monster) W.__monster = null; } catch (e) { /* ignore */ }
        }
      };
      return HW.arcade.run(ctx, spec);
    }
  });
})();
