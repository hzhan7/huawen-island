/* =====================================================================
 * 华文小岛 2.0 · 街机游戏 9：🔨 打地鼠找错字（id: mole · skill: write · 题库栏目: typo）
 * 规格：SPEC_ARCADE.md §4 第 9 条。引擎：parts/15_arcade.js（HW.arcade.run）。
 *
 * 玩法：
 *   上方木牌挂着一句“有错字的句子”（楷体），下方草地上 6/9 个地洞，地鼠举着字牌冒出又缩回。
 *   ① 找错字：地鼠举的是句子里的字（含错字 bad）→ 敲“举着错字”的地鼠 → 木牌上错字被红圈圈住；
 *   ② 改正：地鼠举 opts 里的字 → 敲举着正确字 good 的地鼠 → 字飞上木牌，错字掉下来、正确字盖章。
 *   敲错扣心（错题本记：错的是哪个字、应改成什么、你敲了什么）；正确的地鼠溜走 = 断连击。
 *   金地鼠 ⭐ 加分；💣 炸弹别敲（扣分断连击，不扣心）。
 *   关卡越高：地洞 6→9、同时冒出越多、停留越短、出现炸弹与“假动作”地鼠；背景 白天→篱笆→黄昏灯笼。
 * 操作：点/触地鼠；键盘 1–9 敲对应地洞，或 方向键选洞 + 空格/回车敲。
 * 正确答案只取题库字段：第一步 = typo.bad（s[i]），第二步 = typo.good；干扰字第一步取 s 里的其它汉字，第二步取 opts。
 * 调试：window.__mole = 当前 g（g.M 为本关状态），供 tools/shot.js 的 steps 读取。
 * ===================================================================== */
(function () {
  'use strict';
  const W = window;
  const HW = W.HW;
  if (!HW || typeof HW.register !== 'function') return;

  const TAU = Math.PI * 2;
  const NAVY = '#1d2b53';
  const isHan = (ch) => /[㐀-鿿豈-﫿]/.test(ch);
  const str = (v) => (v == null ? '' : String(v));
  const PUNCT = /[，。！？、；：“”‘’（）《》〈〉【】…—·,.!?;:()"'\s]/;
  const OPEN = /[“‘（《〈【(]/;                           // 开引号 / 开括号：只能放行首，不能留在行尾
  const noStart = (ch) => PUNCT.test(ch) && !OPEN.test(ch);   // 不能放在行首的标点
  // 讲解条换行：引擎 wrapText 只管“行首不放句号逗号”，开引号会孤零零挂在行尾（实测“…上面是“久”的“ / 灸”是针灸”），挪到下一行行首
  function fixOpenQuotes(lines) {
    const out = lines.slice();
    for (let i = 0; i + 1 < out.length; i++) {
      while (out[i].length > 1 && OPEN.test(out[i].slice(-1))) { out[i + 1] = out[i].slice(-1) + out[i + 1]; out[i] = out[i].slice(0, -1); }
    }
    return out;
  }
  const outBack = (t) => { const s = 1.9, u = t - 1; return u * u * ((s + 1) * u + s) + 1; };
  const inQuad = (t) => t * t;

  /* ---------- 关卡参数（下标 = 关卡 - 1） ---------- */
  const LV = {
    holes: [6, 6, 6, 9, 9, 9, 9, 9, 9, 9],
    maxUp: [3, 3, 3, 3, 4, 4, 4, 5, 5, 5],          // 同时冒出的地鼠上限
    upT:   [2.3, 2.1, 1.95, 1.85, 1.7, 1.55, 1.45, 1.32, 1.2, 1.08],   // 探出头停留秒数
    riseT: [0.30, 0.28, 0.26, 0.24, 0.22, 0.2, 0.19, 0.18, 0.17, 0.16],
    gap:   [0.6, 0.55, 0.5, 0.46, 0.42, 0.38, 0.34, 0.3, 0.27, 0.24], // 冒出间隔
    readT: [5, 4.5, 4, 3.5, 3, 3, 2.5, 2.5, 2, 2],  // 每步开头的读题时间：这段时间里正确地鼠溜走不算“溜走”
    every: [2, 2, 2, 3, 3, 3, 3, 3, 3, 3],          // 最多连续几只干扰地鼠后必出正确地鼠
    maxT:  [1, 1, 1, 1, 1, 1, 2, 2, 2, 2],          // 同屏正确地鼠上限
    gold:  [0, 0.06, 0.06, 0.06, 0.06, 0.07, 0.07, 0.08, 0.08, 0.08],
    bomb:  [0, 0, 0, 0.07, 0.08, 0.09, 0.1, 0.11, 0.12, 0.13],
    feint: [0, 0, 0, 0, 0, 0.15, 0.18, 0.2, 0.22, 0.25]   // 干扰地鼠只探半个头就缩回（假动作）
  };
  function param(lv) { const i = Math.max(0, Math.min(9, (lv | 0) - 1)); const o = {}; for (const k in LV) o[k] = LV[k][i]; return o; }

  function valid(t) {
    if (!t || typeof t.s !== 'string' || !Number.isInteger(t.i) || t.i < 0) return false;
    const cs = Array.from(t.s), bad = str(t.bad), good = str(t.good);
    return cs[t.i] === bad && isHan(bad) && !!good && good !== bad &&
      Array.isArray(t.opts) && t.opts.map(str).indexOf(good) >= 0;
  }

  /* ---------- 小绘图工具 ---------- */
  function ell(c, x, y, rx, ry, fill) { c.beginPath(); c.ellipse(x, y, Math.max(0.1, rx), Math.max(0.1, ry), 0, 0, TAU); c.fillStyle = fill; c.fill(); }
  function starShape(c, x, y, R, r, rot) {
    c.beginPath();
    for (let i = 0; i < 10; i++) {
      const a = rot - Math.PI / 2 + i * Math.PI / 5, rr = i % 2 ? r : R;
      if (i) c.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr); else c.moveTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr);
    }
    c.closePath();
  }

  let LEX = null;                 // 题库词表（全年级 words.w 与 chars.words，2–4 字）：只用来避免把词拆到两行
  function lexicon() {
    if (LEX) return LEX;
    LEX = new Set();
    try {
      const all = W.HW_DATA && typeof W.HW_DATA === 'object' ? W.HW_DATA : {};
      const add = (x) => { x = str(x); const k = Array.from(x).length; if (k >= 2 && k <= 4) LEX.add(x); };
      for (const gr in all) {
        const G = all[gr] || {};
        (Array.isArray(G.words) ? G.words : []).forEach((w) => add(w && w.w));
        (Array.isArray(G.chars) ? G.chars : []).forEach((c) => (c && Array.isArray(c.words) ? c.words : []).forEach(add));
      }
    } catch (e) { /* ignore */ }
    return LEX;
  }

  HW.register({
    id: 'mole', skill: 'write', kind: 'arcade', name: '打地鼠找错字', icon: '🔨',
    blurb: '敲举着错字的地鼠，再敲出正确的字', cols: ['typo'],
    reviewN: 6,                 // 错题重练：一轮最多出 6 题
    start(ctx) {
      if (!HW.arcade || typeof HW.arcade.run !== 'function') {
        try { ctx.el.textContent = '游戏引擎没有加载成功，请刷新页面再试。'; } catch (e) { /* ignore */ }
        return;
      }
      let M = null;          // 本关状态（每关 init 新建）

      /* ================= 布局 ================= */
      function layoutSign(g) {
        const w = g.w, u = M.u;
        const sw = Math.min(w - 18 * u, 880);
        const frame = 9 * u, padX = 14 * u, padY = 10 * u;
        const innerW = sw - frame * 2 - padX * 2;
        const N = Math.max(5, M.maxN);
        let lines = 1, fs = Math.min(46 * u, innerW / (N + 0.6));
        if (fs < 30) { lines = 2; fs = Math.min(42 * u, innerW / (Math.ceil(N / 2) + 0.8)); }
        if (fs < 25) { lines = 3; fs = Math.min(30 * u, innerW / (Math.ceil(N / 3) + 0.8)); }   // 窄屏长句（P6 23 字 @360px）宁可 3 行也别小于 25px
        // 矮屏（横屏手机 667×375 / 740×360：画布只露出 ~320px）：两行木牌 + 说明条就占满了，地洞被挤到屏幕外
        // （实测 P6 667×375 只露出字牌和地鼠脑袋）。矮屏一律一行，字小一点（≥18px）也要把地洞留在屏幕里
        const avail = visibleH(g) - g.hudTop;
        if (lines > 1 && avail < 420) {
          const f1 = Math.min(46 * u, innerW / (N + 0.3));
          if (f1 >= 18) { lines = 1; fs = f1; }
        }
        fs = Math.max(16, Math.floor(fs));
        const lh = Math.round(fs * 1.3);
        const sh = frame * 2 + padY * 2 + lh * lines;
        M.sg = { x: (w - sw) / 2, y: g.hudTop + 8 * u, w: sw, h: sh, frame, padX, padY, fs, lh, lines,
          perLine: Math.ceil(N / lines), innerW, pivotY: g.hudTop - 40 * u };
        M.stripY = M.sg.y + sh + 8 * u;
        M.pillH = Math.round(40 * u);
        // 讲解条会长到 2–3 行（P5/P6 讲解 20–31 字，手机上要换行）：按本关最长的讲解预留高度，
        // 否则讲解条盖住第一排地鼠的字牌（实测 390 宽 P5“情不自禁”那条盖掉半个“进”）
        const tfs = Math.round(17 * u), tmax = Math.min(w - 30 * u, 700) - 50 * u;
        let tl = 1;
        for (const t of (M.list || [])) {
          const e = str(t && t.e);
          if (e) tl = Math.max(tl, Math.min(3, g.wrapText(e, tmax, tfs, 'kai').length));
        }
        M.stripH = Math.round(Math.max(M.pillH, tl * tfs * 1.3 + 14 * u));
      }
      // 画布真正露在屏幕里的高度：引擎把画布高度夹在 ≥480，横屏手机（844×390）只露出 ~338px，
      // 画布又是 touch-action:none 划不动页面 → 下排地鼠既看不到也敲不到。地洞只摆在看得见的范围里。
      function visibleH(g) {
        try {
          const cv = g.c && g.c.canvas;
          if (!cv || !cv.getBoundingClientRect) return g.h;
          const top = cv.getBoundingClientRect().top + (W.scrollY || W.pageYOffset || 0);
          const vh = (W.visualViewport && W.visualViewport.height) || W.innerHeight || g.h;
          const v = Math.floor(vh - top);
          return v >= 260 && v < g.h ? v : g.h;
        } catch (e) { return g.h; }
      }
      function layoutField(g) {
        const w = g.w, h = visibleH(g), u = M.u;
        M.visH = h;
        const fT = M.stripY + M.stripH + 10 * u, fB = h - 6 * u;
        const FH = Math.max(110, fB - fT);
        const fw = Math.min(w - 8 * u, 1120);
        const n = M.P.holes;
        // 候选排法；横屏矮屏幕时一排摆开（地鼠更大，数字 1–9 也正好对应键盘一排）
        const cands = n === 6 ? [[3, 3], [2, 2, 2], [6]] : [[3, 3, 3], [4, 5], [9]];
        let best = null;
        for (const rows of cands) {
          const R = rows.length, kMax = Math.max.apply(null, rows);
          const d0 = R > 1 ? 0.88 : 1;
          const sW = fw / kMax / 132;
          const sH = FH / (148 * d0 + (R - 1) * 116 + 38);
          const s = Math.min(1.6, sW, sH);
          if (!best || s > best.s + 0.02) best = { rows, s, d0 };
        }
        const rows = best.rows, R = rows.length, s = best.s, d0 = best.d0, kMax = Math.max.apply(null, rows);
        let gap = R > 1 ? (FH - (148 * d0 + 38) * s) / (R - 1) : 0;
        gap = Math.min(gap, 185 * s);
        const used = 148 * d0 * s + gap * (R - 1) + 38 * s;
        const y0 = fT + Math.max(0, (FH - used) * 0.45) + 148 * d0 * s;
        const spacing = Math.min(fw / kMax, 330 * s);
        const holes = [];
        rows.forEach((k, r) => {
          const d = R > 1 ? 0.88 + 0.12 * r / (R - 1) : 1;
          const hy = y0 + r * gap;
          for (let j = 0; j < k; j++) {
            const hx = w / 2 + (j - (k - 1) / 2) * spacing;
            holes.push({ x: hx, y: hy, s: s * d, row: r, idx: holes.length });
          }
        });
        // 保留洞里的地鼠
        const old = M.holes || [];
        holes.forEach((hh, i) => { const o = old[i]; hh.m = o ? o.m : null; hh.cool = o ? o.cool : 0; });
        M.holes = holes; M.rows = rows; M.fieldTop = fT; M.ms = s;
      }
      function layoutAll(g) {
        M.u = Math.max(0.85, Math.min(1.35, Math.min(g.w / 390, g.h / 700)));
        layoutSign(g);
        layoutField(g);
        if (M.item) setSentence(g);
      }
      // 分行：先按行数均分，断点优先落在标点后面（“很近，/走路…”而不是“…很近，走/路…”），行首不放标点；
      // 尽量别把词拆开（实测 P2“小明再图书 / 馆里看书。”）：M.brkPen[k] = 在第 k 个字前断行的额外代价
      function splitLines(cs, per) {
        const n = cs.length, L = Math.max(1, Math.ceil(n / per));
        if (L <= 1) return [cs.map((_, i) => i)];
        const pen = M.brkPen || [];
        const brk = [0], cap = per + 3;          // 一行最多比均分多 3 字（多出来的由 setSentence 缩字号兜住）
        for (let j = 1; j < L; j++) {
          const prev = brk[brk.length - 1], left = L - j + 1;
          const t = prev + Math.round((n - prev) / left);
          let best = -1, bd = 1e9;
          for (let k = Math.max(prev + 1, t - 4); k <= Math.min(n - 1, t + 4); k++) {
            if (noStart(cs[k]) || OPEN.test(cs[k - 1]) || k - prev > cap || n - k > cap * (left - 1)) continue;
            const after = noStart(cs[k - 1]) || OPEN.test(cs[k]);
            const d = after ? Math.abs(k - t) * 0.5 - 1 : Math.abs(k - t) + 4 + (pen[k] || 0);   // 标点后断最优先（“跑完步，/ 我们坐在…”）
            if (d < bd) { bd = d; best = k; }
          }
          if (best < 0) { best = Math.max(prev + 1, t); while (best < n - 1 && (noStart(cs[best]) || OPEN.test(cs[best - 1]))) best++; }
          brk.push(best);
        }
        brk.push(n);
        const out = [];
        for (let j = 0; j + 1 < brk.length; j++) { const a = []; for (let i = brk[j]; i < brk[j + 1]; i++) a.push(i); if (a.length) out.push(a); }
        return out;
      }
      // 断在词中间的代价：题库词表（words.w / chars.words，全年级）里的词、叠字（轻轻 / 干干净净）、粘着前字的“的了们子…”
      function breakPenalty(sent, fixedSent) {
        const lex = lexicon(), n = sent.length, pen = new Array(n + 1).fill(0);
        for (const S of [sent, fixedSent]) {
          for (let a = 0; a < n - 1; a++) {
            for (let len = 4; len >= 2; len--) {
              if (a + len > n) continue;
              if (lex.has(S.slice(a, a + len).join(''))) { for (let k = a + 1; k < a + len; k++) pen[k] = Math.max(pen[k], 6); break; }
            }
          }
        }
        for (let k = 1; k < n; k++) {
          if (sent[k] === sent[k - 1] && isHan(sent[k])) pen[k] = Math.max(pen[k], 5);
          if (/[的地得了着过们子吗呢吧么]/.test(sent[k])) pen[k] = Math.max(pen[k], 3);
          // 词表外的词（咖啡、可以…）靠虚词找边界：在“的了们里…”之后、“在和把被都就很要会…”之前断，多半是词与词之间
          // （实测“…在咖 / 啡店里…”“…清澈地可 / 以看见…”）
          if (!pen[k] && (/[的地了着过们里上下后时]/.test(sent[k - 1]) || /[在和与跟把被从向对给让是就都也还又很真要能会可]/.test(sent[k]))) pen[k] = -3;
        }
        return pen;
      }
      function setSentence(g) {
        const sg = M.sg, cs = M.chars, n = cs.length, u = M.u;
        const room = sg.innerW + 4 * u;                    // 左右各留出木牌内边距（贴着木框太挤）
        const roomH = sg.h - sg.frame * 2 - 4 * u;
        // 这一句用几行：木牌按本关最长的句子定高；短句少排一行时字号仍 ≥28px 或不小于 9 成，就少排一行
        // （实测 P2 10 个字的句子被拆成两行，还把“图书馆”拆开了）
        const maxL = Math.max(1, sg.lines);
        let pick = null;
        for (let L = 1; L <= maxL; L++) {
          const lines = splitLines(cs, Math.ceil(n / L));
          const longest = Math.max.apply(null, lines.map((l) => l.length));
          const fs = Math.floor(Math.min(46 * u, roomH / (lines.length * 1.24), room / (longest * 1.02)));
          const cand = { lines, fs };
          if (!pick || (fs > pick.fs / 0.9 && pick.fs < 28)) pick = cand;   // 少一行能有 ≥28px 就少排一行：短句一行读起来最顺
        }
        const lines = pick.lines;
        M.fsQ = Math.max(14, pick.fs);
        const cw = M.fsQ * 1.02;
        let lh = Math.round(M.fsQ * 1.3);
        if (lines.length * lh > roomH) lh = roomH / lines.length;
        M.lhQ = lh;
        const top = sg.y + sg.h / 2 - lines.length * lh / 2;
        M.cells = [];
        M.cellW = cw;
        lines.forEach((ln, li) => {
          let x = g.w / 2 - ln.length * cw / 2 + cw / 2;
          ln.forEach((i) => { M.cells[i] = { x, y: top + li * lh + lh / 2 + M.fsQ * 0.02, li }; x += cw; });
        });
      }

      /* ================= 题目流程 ================= */
      function startQuestion(g, qi) {
        const it = M.list[qi];
        M.qi = qi; M.item = it; M.advancing = false; M.waitNext = false;
        M.chars = Array.from(it.s);
        M.bad = str(it.bad); M.good = str(it.good); M.bi = it.i;
        const fixedS = M.chars.slice(); fixedS[M.bi] = M.good;
        M.brkPen = breakPenalty(M.chars, fixedS);
        // 第一步干扰字：句子里其它汉字（去掉所有与错字相同的字）
        const d1 = [], seen = new Set([M.bad]);
        M.chars.forEach((ch, i) => { if (isHan(ch) && !seen.has(ch)) { seen.add(ch); d1.push({ ch, near: Math.abs(i - M.bi) <= 4 }); } });
        M.dec1 = d1.length ? d1 : g.similarChars(M.bad, 4, [M.good]).map((ch) => ({ ch, near: true }));
        // 第二步干扰字：opts 里除正确字以外的（含错字本身）
        let d2 = [];
        it.opts.map(str).forEach((ch) => { if (ch && ch !== M.good && d2.indexOf(ch) < 0) d2.push(ch); });
        if (!d2.length) d2 = [M.bad].concat(g.similarChars(M.good, 2, [M.good, M.bad]));
        M.dec2 = d2;
        setSentence(g);
        M.found = false; M.circ = 0; M.strike = 0; M.fixed = false; M.fall = null; M.stamp = 0; M.fly = null;
        M.escapes = 0; M.wrongQ = 0; M.wrongPh = 0;
        // 教学题（第 1–2 关第 1 题）：手指等正确地鼠探出来一会儿才指（先给孩子自己找的机会）
        M.tut = qi === 0 && g.level <= 2 && !g.isReview;
        M.hint = false;
        M.firstT = M.tut;
        M.ph = 0;
      }
      function beginPhase(g, ph) {
        M.ph = ph; M.phT = 0; M.sinceT = 0; M.wrongPh = 0; M.hint = false;
        M.spawnT = 0.12;
        M.stripPop = 1; g.tween(M, { stripPop: 0 }, 0.5, 'outQuad');
        if (M.tip && M.tip.kind === 'warn') M.tip = null;     // 上一步的“再找找”别挡住新一步的说明条
        M.firstT = M.tut;
        g.sfx(ph === 1 ? 'whoosh' : 'flip');
        // 教学题（第 1–2 关第 1 题）：有中文朗读就用声音说一遍玩法（P2 孩子不一定读得懂说明条）；
        // 没有朗读时不调 g.say——引擎的拼音字幕条会盖住木牌上的句子
        if (M.tut) {
          let ok = false;
          try { ok = !!(g.ctx && g.ctx.tts && g.ctx.tts.ok); } catch (e) { ok = false; }
          if (ok) g.say(ph === 1 ? '找一找，哪个字写错了？敲举着它的地鼠！' : '再敲出正确的字！');
        }
      }
      function nextQuestion(g) {
        if (g.state !== 'play') return;
        if (M.nextTm) { M.nextTm.cancel(); M.nextTm = null; }
        M.waitNext = false;
        if (M.lastQ || g.done >= g.rounds) {          // 最后一题的讲解看完了 → 过关
          M.lastQ = false;
          if (M.tip) { M.tip.t = 9; M.tip.d = 10; }  // 讲解条留着陪到结算面板出来（否则露出“② 敲出正确的字！”）
          g.win();
          return;
        }
        const qi = M.qi + 1;
        if (qi >= M.list.length || M.advancing) return;
        M.advancing = true;
        hideAll(g);
        g.sfx('whoosh');
        g.tween(M.drop, { y: -(M.sg.y + M.sg.h + 60) }, 0.3, 'inQuad', () => {
          if (g.state !== 'play') return;
          startQuestion(g, qi);
          M.drop.y = -(M.sg.y + M.sg.h + 60);
          g.tween(M.drop, { y: 0 }, 0.7, 'outBounce');
          g.after(0.42, () => { M.sw.v += 0.5; g.sfx('beat'); });
          g.after(0.55, () => beginPhase(g, 1));
        });
      }
      function hideAll(g, keep) {
        for (const h of M.holes) {
          const m = h.m;
          if (!m || m === keep || m.st === 'hit' || m.st === 'laugh' || m.st === 'happy') continue;
          m.silent = true; toHide(m, 0.14);
        }
      }
      function toHide(m, d) { m.st = 'hide'; m.t = 0; m.hideT = d || 0.2; m.pe0 = m.pe; }

      /* ================= 生成地鼠 ================= */
      function countUp(fn) { let n = 0; for (const h of M.holes) if (h.m && fn(h.m)) n++; return n; }
      function spawnTick(g, dt) {
        if (M.ph !== 1 && M.ph !== 2) return;
        M.spawnT -= dt;
        if (M.spawnT > 0) return;
        M.spawnT = M.P.gap * g.rand(0.7, 1.3);
        if (countUp((m) => !m.silent) >= M.P.maxUp) return;
        let free = M.holes.filter((h) => !h.m && h.cool <= 0 && h !== M.lastHole);
        if (!free.length) free = M.holes.filter((h) => !h.m && h.cool <= 0);
        if (!free.length) return;
        const hole = g.pick(free);
        M.lastHole = hole;
        const P = M.P, r = Math.random();
        let kind = 'ch';
        if (!M.firstT && P.bomb && r < P.bomb && countUp((m) => m.kind === 'bomb') < (g.level >= 8 ? 2 : 1)) kind = 'bomb';
        else if (!M.firstT && P.gold && r < P.bomb + P.gold && countUp((m) => m.kind === 'gold') < 1) kind = 'gold';
        let ch = '', target = false, feint = false;
        if (kind === 'ch') {
          const want = M.ph === 1 ? M.bad : M.good;
          const tUp = countUp((m) => m.target && !m.silent);
          target = (M.firstT || M.sinceT >= P.every || Math.random() < 0.4) && tUp < P.maxT;
          M.firstT = false;
          if (target) { ch = want; M.sinceT = 0; }
          else {
            M.sinceT++;
            const upChs = new Set(); for (const h of M.holes) if (h.m) upChs.add(h.m.ch);
            let pool = M.ph === 1 ? M.dec1.filter((d) => !upChs.has(d.ch)) : M.dec2.filter((d) => !upChs.has(d));
            if (!pool.length) pool = M.ph === 1 ? M.dec1 : M.dec2;
            if (M.ph === 1) {
              const near = pool.filter((d) => d.near);
              ch = (near.length && Math.random() < 0.55 ? g.pick(near) : g.pick(pool)).ch;
            } else ch = g.pick(pool);
            feint = Math.random() < P.feint;
          }
        }
        const up = P.upT * g.rand(0.85, 1.15) * (kind === 'bomb' ? 1.25 : kind === 'gold' ? 0.8 : 1);
        hole.m = { kind, ch, target, feint, ph: M.ph, st: 'rise', t: 0, pe: 0, pe0: 0, upT: up, riseT: P.riseT, hideT: 0.2,
          sx: 1, sy: 1, shx: 0, blink: g.rand(0.8, 3), silent: false, born: M.clk, fuse: 0, id: ++M.mid,
          warn: kind === 'bomb' && (M.bombsShown = (M.bombsShown || 0) + 1) <= 2 };   // 本关头两颗炸弹头上写“别敲！”
        g.burst(hole.x, hole.y, { kind: 'dot', color: '#A0703F', n: 6 });
        g.sfx('pop');
      }

      /* ================= 更新 ================= */
      function updateMoles(g, dt) {
        for (const h of M.holes) {
          if (h.cool > 0) h.cool -= dt;
          const m = h.m;
          if (!m) continue;
          m.t += dt;
          m.blink -= dt; if (m.blink < -0.13) m.blink = g.rand(1.2, 3.8);
          const topPe = m.kind === 'peek' ? 0.62 : m.feint ? 0.55 : 1;
          if (m.st === 'rise') {
            const k = Math.min(1, m.t / m.riseT);
            m.pe = outBack(k) * topPe;
            if (k >= 1) { m.st = 'up'; m.t = 0; if (m.feint) m.upT = 0.3; }
          } else if (m.st === 'up') {
            m.pe = m.kind === 'cheer' ? 1 + Math.abs(Math.sin(m.t * 9 + m.id)) * 0.16 : topPe + Math.sin(m.t * 6.5) * 0.035;
            if (m.t >= m.upT) toHide(m, 0.2);
          } else if (m.st === 'hide') {
            const k = Math.min(1, m.t / m.hideT);
            m.pe = m.pe0 * (1 - inQuad(k));
            m.sx += (1 - m.sx) * Math.min(1, dt * 12); m.sy += (1 - m.sy) * Math.min(1, dt * 12); m.shx *= 0.8;
            if (k >= 1) {
              h.m = null; h.cool = 0.25;
              if (m.target && !m.whacked && !m.silent && m.ph === M.ph && g.state === 'play') {
                if (M.phT > M.P.readT) { g.miss(h.x, h.y - 100 * h.s); M.escapes++; }
                if (M.escapes >= 3 || M.phT > M.P.readT * 3.2) M.hint = true;
              }
            }
          } else if (m.st === 'hit') {
            const k = m.t;
            if (k < 0.08) { m.sx = 1 + 0.35 * (k / 0.08); m.sy = 1 - 0.38 * (k / 0.08); }
            else { const q = Math.min(1, (k - 0.08) / 0.4); const sp = Math.exp(-5 * q) * Math.cos(q * 14); m.sx = 1 + 0.35 * sp; m.sy = 1 - 0.38 * sp; }
            m.pe = Math.max(0.55, m.pe - dt * 0.35);
            if (m.t > 0.62) toHide(m, 0.18);
          } else if (m.st === 'laugh') {
            m.shx = Math.sin(m.t * 40) * 3.5 * h.s;
            m.pe = 1 + Math.abs(Math.sin(m.t * 13)) * 0.08;
            if (m.t > 0.8) toHide(m, 0.2);
          } else if (m.st === 'happy') {
            m.pe = 1 + Math.sin(Math.min(1, m.t / 0.4) * Math.PI) * 0.25;
            if (m.t > 0.45) toHide(m, 0.18);
          }
          if (m.kind === 'bomb' && m.pe > 0.3 && (m.st === 'up' || m.st === 'rise')) {
            m.fuse -= dt;
            if (m.fuse <= 0) { m.fuse = 0.07; const Y = h.y - m.pe * 80 * h.s; g.burst(h.x + 20 * h.s, Y - 6 * h.s, { kind: 'spark', n: 2, color: '#FFD23F' }); }
          }
        }
      }

      /* ================= 敲 ================= */
      function moleTopY(h, m) { return h.y - m.pe * 80 * h.s; }
      function inBox(x, y, h, m) {
        const s = h.s, Y = moleTopY(h, m);
        const top = m.kind === 'bomb' ? Y - 10 * s : Y - 70 * s;
        return x >= h.x - 44 * s && x <= h.x + 44 * s && y >= top && y <= h.y + 26 * s;
      }
      // 已经敲过的地鼠（晕倒缩回 / 坏笑缩回 / 金地鼠缩回）不能再敲：实测孩子对着刚敲对的地鼠 0.63 秒后补一锤，
      // 它正在缩回、没被 hideAll 静音 → 被当成“敲错”扣心，还把答对的题记进错题本（金地鼠则能重复 +30）
      function hittable(m) { return m && !m.silent && !m.whacked && m.pe > 0.33 && (m.st === 'rise' || m.st === 'up' || m.st === 'hide'); }
      function swing(g, x, y, touch) {
        const H = M.ham;
        H.x = x; H.y = y; H.alpha = 1; H.touch = !!touch; H.fade = 0.5;
        H.flip = x > g.w - 125 * M.ms;
        if (H.tw) H.tw.cancel();
        if (H.tw2) H.tw2.cancel();
        H.a = 1.05;
        // 触屏：敲下去停在原地淡出（抬回去会挡住木牌）；鼠标：抬回举锤姿势继续跟随
        H.tw = g.tween(H, { a: -0.12 }, 0.07, 'inQuad', () => { H.tw2 = g.tween(H, { a: touch ? 0.18 : 0.72 }, touch ? 0.16 : 0.28, 'outBack'); });
        g.sfx('swing');
      }
      function whackAt(g, x, y, touch) {
        if (g.state !== 'play') return;
        swing(g, x, y, touch);
        for (let i = M.holes.length - 1; i >= 0; i--) {
          const h = M.holes[i];
          if (hittable(h.m) && inBox(x, y, h, h.m)) { onHit(g, h, h.m, x, y); return; }
        }
        if (skipWait(g)) return;
        const sg = M.sg;
        if (y < M.stripY + M.stripH && x > sg.x - 10 && x < sg.x + sg.w + 10) {   // 敲到木牌：木牌晃一晃（不在木牌上撒土）
          M.sw.v += (x < g.w / 2 ? -1 : 1) * 0.55;
          g.sfx('tick');
          return;
        }
        ground(g, x, y);
      }
      function whackHole(g, idx) {
        if (g.state !== 'play') return;
        const h = M.holes[idx];
        if (!h) return;
        M.sel = idx; M.kbd = true; M.kbdT = 4;
        const m = h.m;
        const up = m && hittable(m);
        const x = h.x, y = up ? (m.kind === 'bomb' ? moleTopY(h, m) + 30 * h.s : moleTopY(h, m) - 36 * h.s) : h.y;
        swing(g, x, y, true);            // 键盘敲完也像触屏一样落锤后淡出：举着的锤子会一直悬在第一排上方、挡住木牌上的句子
        if (up) onHit(g, h, m, x, y); else ground(g, x, h.y);
      }
      function ground(g, x, y) {
        g.burst(x, y, { kind: 'dot', color: '#B98352', n: 8 });
        g.ring(x, y, 'rgba(255,255,255,.7)', 34 * M.ms);
        g.sfx('tick');
      }
      function onHit(g, h, m, x, y) {
        const s = h.s, Y = moleTopY(h, m);
        m.whacked = true;
        if (m.kind === 'bomb') {
          h.m = null; h.cool = 0.5;
          const by = Y + 30 * s;
          g.burst(h.x, by, { kind: 'ink', color: '#2A2140', n: 22 });
          g.burst(h.x, by, { kind: 'spark', color: '#FFB300', n: 20 });
          g.burst(h.x, by, { kind: 'dot', color: '#FF7A1C', n: 16 });
          g.ring(h.x, by, '#FF8A1C', 130 * s);
          g.shake(18); g.flash('#FFF3C4'); g.sfx('crash');
          g.combo = 0;
          g.float('💥', h.x, by - 20 * s, { size: 56 });
          g.addScore(-20);                                   // 引擎飘字是金色（像奖励），扣分自己飘红字
          g.float('-20', h.x + 36 * s, by - 44 * s, { color: '#FF5A5F', size: 30 });
          if (!M.tip || M.tip.kind !== 'e') tip('那是炸弹！别敲，扣 20 分', 'warn', 1.8);
          return;
        }
        if (m.kind === 'gold') {
          m.st = 'happy'; m.t = 0;
          g.burst(h.x, Y - 30 * s, { kind: 'coin', n: 14 });
          g.burst(h.x, Y - 30 * s, { kind: 'star', color: '#FFE45C', n: 12 });
          g.ring(h.x, Y - 30 * s, '#FFE45C', 110 * s);
          g.sfx('power');
          g.addScore(30, h.x, Y - 40 * s);
          return;
        }
        const it = M.item;
        if (M.ph !== 1 && M.ph !== 2) {                     // 两步之间（红圈 / 飞字 / 讲解）：只是敲了一下，不算对错
          m.whacked = false; ground(g, x, y); return;
        }
        if (M.ph === 1 && m.ch === M.bad) {                 // ① 找到错字
          m.st = 'hit'; m.t = 0;
          M.ph = 0; M.found = true; M.hint = false;
          if (M.tip && M.tip.kind === 'warn') M.tip = null;
          hideAll(g, m);
          g.combo++; if (g.combo > g.maxCombo) g.maxCombo = g.combo;
          comboCheer(g);
          const mult = g.combo >= 10 ? 4 : g.combo >= 6 ? 3 : g.combo >= 3 ? 2 : 1;
          const fast = M.clk - m.born < 0.9 + m.riseT;
          g.burst(h.x, Y - 30 * s, { kind: 'star', n: 16 });
          g.burst(h.x, Y - 30 * s, { kind: 'spark', n: 10 });
          g.ring(h.x, Y - 30 * s, '#FFE45C', 110 * s);
          g.shake(6); g.sfx('good');
          // 飘字放在字牌上方 / 地鼠肚子上，别盖住字牌上的字，也别盖住木牌上的句子
          g.addScore(10 * mult + (fast ? 5 : 0));
          g.float('+' + (10 * mult + (fast ? 5 : 0)), h.x, Y - 84 * s, { color: '#FFE45C', size: 30 });
          g.float(fast ? '⚡快手！' : '找到啦！', h.x, Y + 50 * s, { color: fast ? '#FFFFFF' : '#FFB347', size: 26 });
          M.sw.v += 0.9;
          g.tween(M, { circ: 1 }, 0.4, 'outQuad');
          g.after(0.85, () => { if (g.state === 'play') { g.tween(M, { strike: 1 }, 0.25, 'outQuad'); beginPhase(g, 2); } });
          return;
        }
        if (M.ph === 2 && m.ch === M.good) {                // ② 改对
          m.st = 'hit'; m.t = 0;
          M.ph = 0; M.hint = false;
          hideAll(g, m);
          const fast = M.clk - m.born < 0.9 + m.riseT;
          cheer(g, h);
          g.burst(h.x, Y - 30 * s, { kind: 'star', n: 12 });
          g.burst(h.x, Y - 30 * s, { kind: 'spark', n: 10 });
          g.ring(h.x, Y - 30 * s, '#7CF29B', 110 * s);
          g.shake(6); g.sfx('good');
          if (M.tip && M.tip.kind === 'warn') M.tip = null;
          if (fast) { g.addScore(5); g.float('⚡快手！', h.x, Y + 50 * s, { color: '#FFFFFF', size: 26 }); }
          const cell = M.cells[M.bi];
          M.fly = { ch: M.good, x0: h.x, y0: Y - 37 * s, s0: s, x1: cell.x, y1: cell.y, t: 0 };
          m.flown = true;                                   // 字飞走了，牌子变空
          // 字飞到木牌上、盖章之后才 g.right：最后一题 right 会立刻结算，这样孩子能看完“改对”的动画
          g.tween(M.fly, { t: 1 }, 0.5, 'inOutQuad', () => {
            M.fixed = true; M.fly = null;
            // 金币从敲中的地鼠身上迸出（放在木牌下沿会盖住讲解条）。
            // 引擎把“连击×N！”飘字固定画在 g.hudTop+70——正好压在木牌的句子上（实测盖住刚改好的字）；
            // 调用期间把 hudTop 临时指到草地顶部，让它飘在草地上方（g.right 里只有这一处读 hudTop，调用完马上还原）
            const ht = g.hudTop;
            g.hudTop = Math.round(M.fieldTop - 30 * M.u);
            // 最后一题：g.right 会立刻通关，0.5 秒后结算面板就把讲解条糊掉了——最后一题的讲解孩子从来看不到。
            // 调用期间把 rounds 临时 +1（同步还原，HUD 看不到），金币/连击照常；等讲解读完（或点一下）再 g.win()
            const last = g.done + 1 >= g.rounds;
            const r0 = g.rounds;
            if (last) g.rounds = r0 + 1;
            try { g.right(it, h.x, Y - 40 * s); } finally { g.hudTop = ht; g.rounds = r0; }
            M.fall = { x: cell.x, y: cell.y, vy: -320, vx: g.rand(-90, 90), rot: 0, vr: g.rand(-7, 7), a: 1, sc: 1 };
            M.stamp = 0; g.tween(M, { stamp: 1 }, 0.45, 'outBack');
            g.burst(cell.x, cell.y + M.drop.y, { kind: 'star', color: '#7CF29B', n: 14 });
            g.ring(cell.x, cell.y + M.drop.y, '#7CF29B', 70 * M.u);
            g.sfx('match');
            M.sw.v -= 0.7;
            // 讲解 e 是学习的关键一刻：按字数给够阅读时间（14 字 ≈2.9s，31 字 ≈5s）；1.2 秒后点一下 / 空格可以直接下一题
            const eLen = Array.from(str(it.e)).length;
            const dur = Math.max(2.6, Math.min(5.2, 1.2 + eLen * 0.12));
            if (eLen) tip(str(it.e), 'e', dur);
            if (g.state === 'play') {
              M.waitNext = true; M.waitT = 0; M.lastQ = last;
              const hold = last ? (eLen ? Math.max(1.8, dur - 0.9) : 1.2) : (eLen ? Math.max(1.7, dur - 0.7) : 1.7);
              M.nextTm = g.after(hold, () => { M.nextTm = null; nextQuestion(g); });
            }
          });
          return;
        }
        // 敲错
        m.st = 'laugh'; m.t = 0;
        if (M.clk - M.hurtAt < 1.1) {
          // 连敲保护：刚扣过心 1.1 秒内再敲错，只做鬼脸不再扣心（实测乱点一下，0.7 秒就把 3 颗心全扣光直接失败）
          g.combo = 0;
          g.burst(h.x, Y - 30 * s, { kind: 'ink', color: '#3A2A5A', n: 8 });
          g.float('哈哈', h.x + 40 * s, Y - 60 * s, { color: '#FFD6E0', size: 24 });
          g.shake(4); g.sfx('bad');
          if (!M.tip || M.tip.kind !== 'e') tip('慢一点！先读木牌上的句子，再敲', 'warn', 2);
          return;
        }
        M.hurtAt = M.clk;
        M.wrongQ++;
        const note = M.ph === 1
          ? '“' + it.s + '”里错的是「' + M.bad + '」，应改为「' + M.good + '」；你敲了「' + m.ch + '」'
          : '“' + it.s + '”：「' + M.bad + '」应改为「' + M.good + '」；你敲了「' + m.ch + '」';
        g.wrong(it, note, h.x, Y - 30 * s);
        g.burst(h.x, Y - 30 * s, { kind: 'ink', color: '#3A2A5A', n: 10 });
        g.float('哈哈', h.x + 40 * s, Y - 60 * s, { color: '#FFD6E0', size: 24 });
        M.sw.v += 0.6;
        // 提示分级：第 1–2 关敲错一次就指路；第 3 关起要错两次（或正确地鼠溜走 3 次）才给手指，高关才有挑战
        M.wrongPh++;
        if (M.wrongPh >= (g.level <= 2 ? 1 : 2)) M.hint = true;
        if (M.ph === 1) tip('「' + m.ch + '」没有写错，再找找！', 'warn', 2.2);
        else if (m.ch === M.bad) tip('「' + M.bad + '」就是错字呀！换一个字', 'warn', 2.2);
        else { const e = str(it.e) || ('应该用「' + M.good + '」'); tip(e, 'e', Math.max(2.8, Math.min(5, 1.2 + Array.from(e).length * 0.12))); }
      }
      function comboCheer(g) {       // 第①步也算连击：3 连、每 5 连给一次大字喝彩（g.right 只在偶数连击时被调用，自己补上）
        const c = g.combo;
        if (c === 3 || (c >= 5 && c % 5 === 0)) {
          g.float('连击×' + c + '！', g.w / 2, M.fieldTop + 40 * M.u, { color: c >= 10 ? '#E3B3FF' : '#FFB347', size: 38, life: 1.3 });   // 画在草地上方，别压住木牌上的句子
          g.sfx('combo');
        }
      }
      function skipWait(g) {          // 改对后的讲解时间：点一下 / 空格直接下一题
        if (!M.waitNext || M.waitT < 1.2 || g.state !== 'play') return false;
        if (M.tip) M.tip.t = Math.min(M.tip.t, 0.35);
        nextQuestion(g);
        return true;
      }
      function cheer(g, except) {         // 改对后：旁边两只地鼠跳出来欢呼（不能敲，只是热闹）
        const free = g.shuffle(M.holes.filter((h) => h !== except && (!h.m || h.m.silent)));
        free.slice(0, Math.min(3, M.holes.length > 6 ? 3 : 2)).forEach((h, i) => {
          g.after(0.12 + i * 0.12, () => {
            if (h.m && !h.m.silent) return;
            h.m = { kind: 'cheer', ch: '', target: false, feint: false, ph: 0, st: 'rise', t: 0, pe: 0, pe0: 0, upT: 1.0, riseT: 0.22, hideT: 0.2,
              sx: 1, sy: 1, shx: 0, blink: 9, silent: true, born: M.clk, fuse: 0, id: ++M.mid };
            g.burst(h.x, h.y, { kind: 'dot', color: '#A0703F', n: 6 });
            g.burst(h.x, h.y - 90 * h.s, { kind: 'confetti', n: 12 });
          });
        });
      }
      function tip(text, kind, sec) { M.tip = { text, kind, t: sec, d: sec }; }

      /* ---------- 开场 / 结束时画面也要动（引擎只在 play 时调 update，这里用真实时间自己推） ---------- */
      function sceneTick(g, dt) {
        M.clk += dt;
        M.sw.v += (-38 * M.sw.a - 2.6 * M.sw.v) * dt;
        M.sw.a = Math.max(-0.12, Math.min(0.12, M.sw.a + M.sw.v * dt));
        if (M.fall) { const F = M.fall; F.vy += 1300 * dt; F.y += F.vy * dt; F.x += F.vx * dt; F.rot += F.vr * dt; F.a -= dt * 1.6; F.sc += dt * 0.8; if (F.a <= 0) M.fall = null; }
        if (M.tip) { M.tip.t -= dt; if (M.tip.t <= 0) M.tip = null; }
        updateMoles(g, dt);
      }
      function newMole(kind, extra) {
        return Object.assign({ kind, ch: '', target: false, feint: false, ph: 0, st: 'rise', t: 0, pe: 0, pe0: 0, upT: 1, riseT: 0.24, hideT: 0.2,
          sx: 1, sy: 1, shx: 0, blink: 1 + Math.random() * 2, silent: true, born: M.clk, fuse: 0, id: ++M.mid }, extra || {});
      }
      function introTick(g, dt) {       // 3·2·1 倒计时：地鼠从洞里探头东张西望
        sceneTick(g, dt);
        M.peekT = (M.peekT == null ? 0.25 : M.peekT) - dt;
        if (M.peekT > 0) return;
        M.peekT = 0.3 + Math.random() * 0.45;
        if (M.holes.filter((h) => h.m).length >= 2) return;
        const free = M.holes.filter((h) => !h.m);
        if (!free.length) return;
        const h = free[Math.floor(Math.random() * free.length)];
        h.m = newMole('peek', { upT: 0.6 + Math.random() * 0.7 });
        g.burst(h.x, h.y, { kind: 'dot', color: '#A0703F', n: 5 });
      }
      function idlePeek(g, dt) {        // 看讲解的这几秒：地鼠偶尔探头张望（不能敲，点一下 = 下一题），画面别停住
        M.peekT = (M.peekT == null ? 0.2 : M.peekT) - dt;
        if (M.peekT > 0) return;
        M.peekT = 0.55 + Math.random() * 0.6;
        if (M.holes.some((h) => h.m)) return;
        const h = M.holes[Math.floor(Math.random() * M.holes.length)];
        h.m = newMole('peek', { upT: 0.7 + Math.random() * 0.5 });
        g.burst(h.x, h.y, { kind: 'dot', color: '#A0703F', n: 4 });
      }
      function overTick(g, dt) {        // 过关：所有地鼠一波接一波跳出来欢呼；失败：地鼠探头做鬼脸
        if (!M.endFx) {
          M.endFx = true;
          const win = g.lives > 0 && g.done >= g.rounds;
          const order = M.holes.slice().sort((a, b) => a.x - b.x || a.y - b.y);
          order.forEach((h, i) => {
            g.after(0.05 + i * 0.07, () => {
              h.m = newMole('cheer', { upT: 99, riseT: 0.2, tease: !win });
              g.burst(h.x, h.y, { kind: 'dot', color: '#A0703F', n: 6 });
              if (win) g.burst(h.x, h.y - 100 * h.s, { kind: 'confetti', n: 10 });
            });
          });
          M.hint = false; M.tut = false;
        }
        sceneTick(g, dt);
      }

      /* ================= 画 ================= */
      function drawDecorBack(g, c) {
        const u = M.u, t = M.clk, hz = g.horizon;
        if (M.decor >= 1) {         // 篱笆
          const y = hz + 8 * u, ph = 30 * u;
          c.fillStyle = '#E9D3A6';
          c.fillRect(0, y + 8 * u, g.w, 5 * u); c.fillRect(0, y + 20 * u, g.w, 5 * u);
          for (let x = 6 * u; x < g.w; x += 22 * u) {
            c.fillStyle = '#F6E3BA';
            c.beginPath(); c.moveTo(x, y + ph); c.lineTo(x, y + 4 * u); c.lineTo(x + 6 * u, y - 2 * u); c.lineTo(x + 12 * u, y + 4 * u); c.lineTo(x + 12 * u, y + ph); c.closePath(); c.fill();
            c.strokeStyle = 'rgba(120,80,40,.45)'; c.lineWidth = 1.5 * u; c.stroke();
          }
        }
        if (M.decor >= 1) {         // 两侧向日葵（跟着风摇）
          const baseY = Math.min(g.h - 20 * u, M.fieldTop + 70 * u);
          [[16 * u, 1], [g.w - 16 * u, -1]].forEach(([x, dir], i) => {
            const sway = Math.sin(t * 1.6 + i * 2) * 0.12;
            c.save(); c.translate(x, baseY + 90 * u); c.rotate(sway * dir);
            c.strokeStyle = '#3F9B3A'; c.lineWidth = 5 * u; c.beginPath(); c.moveTo(0, 0); c.lineTo(0, -90 * u); c.stroke();
            ell(c, 8 * dir * u, -40 * u, 10 * u, 5 * u, '#4DAF42');
            c.translate(0, -96 * u); c.rotate(Math.sin(t * 2.2 + i) * 0.15);
            for (let k = 0; k < 12; k++) { c.save(); c.rotate(k * TAU / 12); ell(c, 0, -15 * u, 5 * u, 10 * u, '#FFC928'); c.restore(); }
            ell(c, 0, 0, 10 * u, 10 * u, '#7A4A22'); ell(c, -3 * u, -3 * u, 3 * u, 3 * u, 'rgba(255,255,255,.25)');
            c.restore();
          });
        }
        if (M.decor >= 2) {         // 黄昏
          const gr = c.createLinearGradient(0, 0, 0, g.h);
          const hz = Math.max(0.1, Math.min(0.8, (g.horizon / g.h) || 0.3));
          gr.addColorStop(0, 'rgba(255,96,40,.46)'); gr.addColorStop(Math.max(0.05, hz * 0.9), 'rgba(255,150,70,.30)');
          gr.addColorStop(Math.min(0.95, hz + 0.05), 'rgba(255,170,90,.14)'); gr.addColorStop(1, 'rgba(110,50,140,.16)');
          c.fillStyle = gr; c.fillRect(-20, -20, g.w + 40, g.h + 40);
        }
      }
      function drawFireflies(g, c) {
        if (M.decor < 2) return;
        const t = M.clk;
        for (let i = 0; i < 14; i++) {
          const x = ((i * 97.3 + t * (12 + i % 5 * 4)) % (g.w + 40)) - 20;
          const y = M.fieldTop + ((i * 53.1) % Math.max(60, g.h - M.fieldTop)) + Math.sin(t * 1.3 + i) * 18;
          const a = 0.35 + 0.65 * Math.abs(Math.sin(t * 2.4 + i * 1.7));
          c.globalAlpha = a * 0.35; ell(c, x, y, 7, 7, '#FFF59A');
          c.globalAlpha = a; ell(c, x, y, 2.4, 2.4, '#FFFBD0');
        }
        c.globalAlpha = 1;
      }
      function drawMoundBack(c, h) {
        const s = h.s, rx = 46 * s, ry = 15 * s, x = h.x, y = h.y;
        ell(c, x, y + ry * 0.9, rx * 1.5, ry * 1.5, 'rgba(40,80,20,.22)');
        ell(c, x, y + ry * 0.2, rx * 1.36, ry * 1.95, '#8E5D33');
        ell(c, x, y - ry * 0.25, rx * 1.24, ry * 1.45, '#B07A48');
        ell(c, x - rx * 0.5, y - ry * 0.9, rx * 0.35, ry * 0.25, 'rgba(255,230,190,.25)');
        ell(c, x, y, rx, ry, '#24150B');
        ell(c, x, y + ry * 0.25, rx * 0.86, ry * 0.62, '#120A05');
      }
      function drawMoundFront(c, h, sel) {
        const s = h.s, rx = 46 * s, ry = 15 * s, x = h.x, y = h.y;
        c.beginPath();
        c.ellipse(x, y + ry * 0.2, rx * 1.36, ry * 1.95, 0, 0.12, Math.PI - 0.12);
        c.ellipse(x, y, rx, ry, 0, Math.PI - 0.05, 0.05, true);
        c.closePath();
        c.fillStyle = '#9A6538'; c.fill();
        c.strokeStyle = '#C8915C'; c.lineWidth = 3 * s; c.lineCap = 'round';
        c.beginPath(); c.ellipse(x, y, rx, ry, 0, 0.25, Math.PI - 0.25); c.stroke();
        // 小草
        c.strokeStyle = '#3F9B3A'; c.lineWidth = 2.4 * s;
        const sw = Math.sin(M.clk * 2.5 + h.idx) * 2 * s;
        for (const sd of [-1, 1]) {
          const bx = x + sd * rx * 1.25, by = y + ry * 1.3;
          c.beginPath();
          c.moveTo(bx, by); c.quadraticCurveTo(bx - 2 * s, by - 8 * s, bx - 5 * s + sw, by - 14 * s);
          c.moveTo(bx + 3 * s, by); c.quadraticCurveTo(bx + 4 * s, by - 9 * s, bx + 7 * s + sw, by - 16 * s);
          c.stroke();
        }
        if (sel) {
          c.save();
          c.setLineDash([8 * s, 6 * s]); c.lineDashOffset = -M.clk * 30;
          c.strokeStyle = '#FFE45C'; c.lineWidth = 4 * s;
          c.beginPath(); c.ellipse(x, y + ry * 0.2, rx * 1.5, ry * 2.3, 0, 0, TAU); c.stroke();
          c.restore();
        }
      }
      function drawKeyBadge(g, c, h) {
        const s = h.s, x = h.x + 46 * s * 1.18, y = h.y + 15 * s * 1.9;
        // 数字角标画在最上层；但前排地鼠的字牌正好盖在这里时把角标调淡，别挡住字牌上的字（实测“3”压住“屋”的左半边）
        let a = 1;
        for (const o of M.holes) {
          const m = o.m;
          if (o === h || !m || m.pe < 0.2 || m.kind === 'cheer' || m.kind === 'peek') continue;
          const os = o.s, top = o.y - m.pe * 80 * os - 67 * os, bot = o.y - m.pe * 80 * os - 4 * os;
          if (x + 10 * s > o.x - 37 * os && x - 10 * s < o.x + 37 * os && y + 9 * s > top && y - 9 * s < bot) { a = 0.18; break; }
        }
        c.save(); c.globalAlpha = a;
        g.rrect(x - 12 * s, y - 11 * s + 2 * s, 24 * s, 22 * s, 7 * s, 'rgba(29,43,83,.55)');
        g.rrect(x - 12 * s, y - 11 * s, 24 * s, 22 * s, 7 * s, 'rgba(255,251,239,.92)', NAVY, 2 * s);
        g.text(String(h.idx + 1), x, y + 1, { size: Math.round(15 * s), font: 'num', color: NAVY });
        c.restore();
      }
      function drawPlacard(g, c, m, s, fs) {
        const pw = 72 * s, ph = 60 * s, px = -pw / 2, py = -66 * s;
        // 木棍
        c.fillStyle = '#8A5A2B';
        c.fillRect(-22 * s - 2.5 * s, py + ph - 4 * s, 5 * s, 16 * s);
        c.fillRect(22 * s - 2.5 * s, py + ph - 4 * s, 5 * s, 16 * s);
        const gold = m.kind === 'gold';
        g.rrect(px, py + 3 * s, pw, ph, 9 * s, 'rgba(60,30,10,.35)');
        g.rrect(px, py, pw, ph, 9 * s, gold ? '#FFE27A' : '#FCE9C2', gold ? '#A8700E' : '#7A4A22', 3.2 * s);
        g.rrect(px + 5 * s, py + 5 * s, pw - 10 * s, ph * 0.3, 6 * s, 'rgba(255,255,255,.35)');
        c.fillStyle = '#9C9C9C';
        c.beginPath(); c.arc(px + 7 * s, py + 7 * s, 2.2 * s, 0, TAU); c.arc(px + pw - 7 * s, py + 7 * s, 2.2 * s, 0, TAU); c.fill();
        if (gold) g.emoji('⭐', 0, py + ph / 2, 40 * s, { rot: Math.sin(M.clk * 6) * 0.2 });
        else if (!m.flown) g.text(m.ch, 0, py + ph / 2 + 1 * s, { size: fs, font: 'kai', color: '#2B1608', weight: 700 });
      }
      function drawMoleBody(g, c, m, s, h) {
        const gold = m.kind === 'gold';
        const body = gold ? '#E8A92A' : '#8D5B3A', dark = gold ? '#7A5208' : '#3E2412', belly = gold ? '#FFE9A8' : '#E9C39A';
        const lw = 3 * s;
        const joy = m.kind === 'cheer';
        if (joy) {                             // 欢呼的手臂（画在身体后面）
          for (const sd of [-1, 1]) {
            const px = sd * (38 + Math.sin(M.clk * 16 + sd) * 4) * s, py = (-6 + Math.sin(M.clk * 16 + sd * 1.5) * 7) * s;
            c.lineCap = 'round';
            c.strokeStyle = dark; c.lineWidth = 13 * s; c.beginPath(); c.moveTo(sd * 22 * s, 50 * s); c.quadraticCurveTo(sd * 42 * s, 34 * s, px, py); c.stroke();
            c.strokeStyle = body; c.lineWidth = 8 * s; c.beginPath(); c.moveTo(sd * 22 * s, 50 * s); c.quadraticCurveTo(sd * 42 * s, 34 * s, px, py); c.stroke();
          }
        }
        // 身体
        c.beginPath();
        c.moveTo(-31 * s, 120 * s); c.lineTo(-31 * s, 31 * s);
        c.arc(0, 31 * s, 31 * s, Math.PI, 0);
        c.lineTo(31 * s, 120 * s); c.closePath();
        c.fillStyle = body; c.fill(); c.lineWidth = lw; c.strokeStyle = dark; c.stroke();
        ell(c, -12 * s, 14 * s, 10 * s, 6 * s, 'rgba(255,255,255,.18)');
        ell(c, 0, 70 * s, 21 * s, 28 * s, belly);
        // 耳朵
        ell(c, -26 * s, 8 * s, 6 * s, 5 * s, dark); ell(c, 26 * s, 8 * s, 6 * s, 5 * s, dark);
        // 脸
        const H = M.ham;
        let lx = 0, ly = 0;
        if (m.kind === 'peek') { lx = Math.sin(M.clk * 2.3 + m.id * 1.9) * 2.6 * s; ly = Math.cos(M.clk * 1.7 + m.id) * 1.2 * s; }   // 开场偷看：眼珠东张西望
        else if (H.alpha > 0.1) { const dx = H.x - h.x, dy = H.y - (h.y - m.pe * 80 * s); const d = Math.hypot(dx, dy) || 1; lx = dx / d * 2.6 * s; ly = dy / d * 2.2 * s; }
        const ey = 25 * s;
        if (joy && !m.tease) {                 // 欢呼：弯眼 + 张嘴笑
          c.strokeStyle = dark; c.lineWidth = 3.2 * s; c.lineCap = 'round';
          for (const sd of [-1, 1]) { c.beginPath(); c.arc(sd * 11 * s, ey + 3 * s, 6 * s, Math.PI * 1.15, Math.PI * 1.85); c.stroke(); }
          c.beginPath(); c.moveTo(-10 * s, 44 * s); c.quadraticCurveTo(0, 60 * s, 10 * s, 44 * s); c.closePath();
          c.fillStyle = '#5A1E1E'; c.fill();
        } else if (m.st === 'hit') {                  // 晕：X 眼 + 圆嘴 + 头顶转星星
          c.strokeStyle = dark; c.lineWidth = 3 * s; c.lineCap = 'round';
          for (const sd of [-1, 1]) {
            const ex = sd * 11 * s;
            c.beginPath(); c.moveTo(ex - 5 * s, ey - 5 * s); c.lineTo(ex + 5 * s, ey + 5 * s); c.moveTo(ex + 5 * s, ey - 5 * s); c.lineTo(ex - 5 * s, ey + 5 * s); c.stroke();
          }
          ell(c, 0, 48 * s, 6 * s, 7 * s, '#5A1E1E');
          for (let k = 0; k < 3; k++) {
            const a = M.clk * 7 + k * TAU / 3;
            starShape(c, Math.cos(a) * 30 * s, -4 * s + Math.sin(a) * 9 * s, 7 * s, 3 * s, a);
            c.fillStyle = '#FFE45C'; c.fill(); c.lineWidth = 1.5 * s; c.strokeStyle = '#B8860B'; c.stroke();
          }
        } else if (m.st === 'laugh' || m.tease) {   // 坏笑：^^ 眼 + 大嘴吐舌
          c.strokeStyle = dark; c.lineWidth = 3.2 * s; c.lineCap = 'round';
          for (const sd of [-1, 1]) { c.beginPath(); c.arc(sd * 11 * s, ey + 3 * s, 6 * s, Math.PI * 1.15, Math.PI * 1.85); c.stroke(); }
          c.beginPath(); c.moveTo(-12 * s, 42 * s); c.quadraticCurveTo(0, 64 * s, 12 * s, 42 * s); c.closePath();
          c.fillStyle = '#5A1E1E'; c.fill();
          ell(c, 3 * s, 52 * s, 5 * s, 4 * s, '#FF6F91');
        } else {
          const blink = m.blink < 0;
          for (const sd of [-1, 1]) {
            const ex = sd * 11 * s;
            if (blink) { c.strokeStyle = dark; c.lineWidth = 3 * s; c.lineCap = 'round'; c.beginPath(); c.moveTo(ex - 6 * s, ey); c.lineTo(ex + 6 * s, ey); c.stroke(); }
            else {
              ell(c, ex, ey, 8 * s, 9 * s, '#FFFFFF');
              c.lineWidth = 2 * s; c.strokeStyle = dark; c.beginPath(); c.ellipse(ex, ey, 8 * s, 9 * s, 0, 0, TAU); c.stroke();
              ell(c, ex + lx, ey + ly, 4.3 * s, 4.8 * s, '#1A0F08');
              ell(c, ex + lx - 1.4 * s, ey + ly - 1.8 * s, 1.5 * s, 1.5 * s, '#FFFFFF');
            }
          }
          if (m.st === 'happy') { c.strokeStyle = dark; c.lineWidth = 3 * s; c.beginPath(); c.arc(0, 46 * s, 8 * s, 0.15, Math.PI - 0.15); c.stroke(); }
          else {
            c.fillStyle = '#FFFFFF'; c.fillRect(-5 * s, 44 * s, 10 * s, 8 * s);
            c.strokeStyle = dark; c.lineWidth = 1.6 * s; c.strokeRect(-5 * s, 44 * s, 10 * s, 8 * s);
            c.beginPath(); c.moveTo(0, 44 * s); c.lineTo(0, 52 * s); c.stroke();
          }
        }
        ell(c, -21 * s, 40 * s, 6 * s, 4 * s, 'rgba(255,110,140,.45)'); ell(c, 21 * s, 40 * s, 6 * s, 4 * s, 'rgba(255,110,140,.45)');
        ell(c, 0, 38 * s, 8.5 * s, 6.5 * s, '#FF7C95');
        c.lineWidth = 2 * s; c.strokeStyle = dark; c.beginPath(); c.ellipse(0, 38 * s, 8.5 * s, 6.5 * s, 0, 0, TAU); c.stroke();
        ell(c, -2.5 * s, 36 * s, 2.6 * s, 1.8 * s, 'rgba(255,255,255,.7)');
        c.strokeStyle = 'rgba(62,36,18,.7)'; c.lineWidth = 1.4 * s;
        c.beginPath();
        for (const sd of [-1, 1]) { c.moveTo(sd * 12 * s, 40 * s); c.lineTo(sd * 27 * s, 36 * s); c.moveTo(sd * 12 * s, 43 * s); c.lineTo(sd * 27 * s, 45 * s); }
        c.stroke();
        if (gold) g.emoji('👑', 0, -8 * s, 26 * s);
        // 爪子（举着牌子；欢呼时举高挥动）
        for (const sd of [-1, 1]) {
          const px = joy ? sd * (38 + Math.sin(M.clk * 16 + sd) * 4) * s : sd * 23 * s;
          const py = joy ? (-6 + Math.sin(M.clk * 16 + sd * 1.5) * 7) * s : 4 * s;
          ell(c, px, py, 8 * s, 7 * s, gold ? '#F2BE4A' : '#A26C45');
          c.lineWidth = 2 * s; c.strokeStyle = dark; c.beginPath(); c.ellipse(px, py, 8 * s, 7 * s, 0, 0, TAU); c.stroke();
        }
      }
      function drawMole(g, c, h) {
        const m = h.m, s = h.s;
        if (!m || m.pe <= 0.001) return;
        const up = m.pe * 80 * s;
        c.save();
        c.beginPath(); c.rect(h.x - 120 * s, h.y - 320 * s, 240 * s, 320 * s + 15 * s * 0.4); c.clip();
        c.translate(h.x + m.shx, h.y);
        c.scale(m.sx, m.sy);
        c.translate(0, -up);
        if (m.kind === 'bomb') {
          const pul = 1 + Math.sin(M.clk * 12) * 0.05;
          c.globalAlpha = 0.35 + 0.25 * Math.sin(M.clk * 12);
          ell(c, 0, 36 * s, 44 * s * pul, 44 * s * pul, '#FF4A3D');
          c.globalAlpha = 1;
          g.emoji('💣', 0, 36 * s, 80 * s, { rot: Math.sin(M.clk * 5) * 0.12 });
          if (m.warn) g.text('别敲！', 0, -14 * s + Math.sin(M.clk * 8) * 2 * s, { size: Math.round(19 * s), font: 'round', color: '#FFFFFF', stroke: '#B3261E', strokeW: 3.5 * s });
        } else {
          const fs = Math.round(44 * s);
          if (m.kind === 'cheer' || m.kind === 'peek') { drawMoleBody(g, c, m, s, h); c.restore(); return; }
          const sway = m.st === 'laugh' ? Math.sin(M.clk * 22) * 0.16
            : (m.st === 'up' || m.st === 'rise') ? Math.sin(M.clk * 3.4 + m.id * 1.7) * 0.075 : 0;
          c.save(); c.translate(0, 6 * s); c.rotate(sway); c.translate(0, -6 * s);
          drawPlacard(g, c, m, s, fs);
          c.restore();
          drawMoleBody(g, c, m, s, h);
        }
        c.restore();
      }
      function drawHint(g, c) {
        if ((!M.hint && !M.tut) || (M.ph !== 1 && M.ph !== 2)) return;
        let best = null;
        for (const h of M.holes) {
          const m = h.m;
          if (!m || !m.target || m.silent || m.pe <= 0.6 || m.st === 'hide') continue;
          if (!M.hint && !(m.st === 'up' && m.t > 0.8)) continue;       // 教学题：先让孩子自己看 0.8 秒
          best = h; break;
        }
        if (!best) return;
        const s = best.s, Y = moleTopY(best, best.m);
        const bob = Math.sin(M.clk * 9) * 7 * s;
        const a = 0.55 + 0.45 * Math.abs(Math.sin(M.clk * 5));
        c.save();
        c.globalAlpha = a;
        c.lineWidth = 4 * s; c.strokeStyle = '#FFE45C';
        const r = 48 * s + Math.sin(M.clk * 8) * 4 * s;
        c.beginPath(); c.arc(best.x, Y - 36 * s, r, 0, TAU); c.stroke();
        c.restore();
        const right = best.x < g.w / 2;                 // 手指放在牌子外侧，别挡住后排地鼠
        const fx = best.x + (right ? 1 : -1) * (68 * s + Math.abs(bob));
        g.emoji(right ? '👈' : '👉', fx, Y - 36 * s, 46 * s, { alpha: a });
      }
      function drawHammer(g, c) {
        const H = M.ham;
        if (H.alpha <= 0.02) return;
        const s = Math.max(0.8, Math.min(1.35, M.ms)) * 1.05;
        const L = 92 * s, hw = 32 * s, hl = 62 * s;
        const fire = g.combo >= 5;
        const fl = H.flip ? -1 : 1;
        // 举锤姿势的锤头在光标上方 ~130px：鼠标停在第一排地鼠上 / 键盘敲完第一排，锤子正好悬在木牌的句子上（实测 1280 宽盖住“家”）。
        // 锤头进到木牌/说明条范围就变半透明，句子始终看得清
        const hx0 = H.x + fl * (L - L * Math.cos(H.a)), hy0 = H.y - hl / 2 - L * Math.sin(H.a);
        const signB = M.stripY + M.stripH + 4 * M.u;
        const over = hy0 - hl / 2 < signB && hx0 > M.sg.x - hw && hx0 < M.sg.x + M.sg.w + hw;
        c.save();
        c.globalAlpha = H.alpha * (over ? 0.32 : 1);
        c.translate(H.x + fl * L, H.y - hl / 2);
        c.scale(fl, 1);
        c.rotate(H.a);
        // 手柄
        g.rrect(-L, -5.5 * s, L + 14 * s, 11 * s, 5.5 * s, '#D89A5B', '#5A3514', 2.6 * s);
        g.rrect(-6 * s, -7 * s, 22 * s, 14 * s, 6 * s, '#2FA0E8', '#123A5A', 2.4 * s);
        // 锤头
        const hx = -L - hw / 2, hy = -hl / 2;
        if (fire) { c.globalAlpha = H.alpha * (0.35 + 0.2 * Math.sin(M.clk * 20)); ell(c, -L, 0, hw * 1.3, hl * 0.75, '#FFB300'); c.globalAlpha = H.alpha; }
        g.rrect(hx, hy + 4 * s, hw, hl, 10 * s, 'rgba(60,10,10,.35)');
        g.rrect(hx, hy, hw, hl, 10 * s, fire ? '#FFB020' : '#E8453C', fire ? '#7A4A00' : '#5A1A12', 3 * s);
        g.rrect(hx - 2.5 * s, hy + 7 * s, hw + 5 * s, 8 * s, 3 * s, '#FFD35A', '#7A4A00', 1.8 * s);
        g.rrect(hx - 2.5 * s, hy + hl - 15 * s, hw + 5 * s, 8 * s, 3 * s, '#FFD35A', '#7A4A00', 1.8 * s);
        g.rrect(hx + 6 * s, hy + 18 * s, 6 * s, hl - 36 * s, 3 * s, 'rgba(255,255,255,.45)');
        c.restore();
      }
      function drawSign(g, c) {
        const sg = M.sg, u = M.u, t = M.clk;
        const px = g.w / 2, py = sg.pivotY;
        c.save();
        c.translate(px, py + M.drop.y);
        c.rotate(M.sw.a);
        c.translate(-px, -py);
        // 绳子
        const ax = [sg.x + Math.min(60 * u, sg.w * 0.18), sg.x + sg.w - Math.min(60 * u, sg.w * 0.18)];
        for (const x of ax) {
          c.strokeStyle = '#7A5230'; c.lineWidth = 5 * u; c.lineCap = 'round';
          c.beginPath(); c.moveTo(x, py - 60 * u); c.lineTo(x, sg.y + 6 * u); c.stroke();
          c.strokeStyle = '#C79A62'; c.lineWidth = 2.4 * u; c.setLineDash([5 * u, 5 * u]);
          c.beginPath(); c.moveTo(x, py - 60 * u); c.lineTo(x, sg.y + 6 * u); c.stroke();
          c.setLineDash([]);
        }
        // 木牌
        g.rrect(sg.x, sg.y + 7 * u, sg.w, sg.h, 16 * u, 'rgba(20,40,20,.25)');
        g.rrect(sg.x, sg.y, sg.w, sg.h, 16 * u, '#9A6034', '#4A2A12', 3 * u);
        const f = sg.frame;
        const gr = c.createLinearGradient(0, sg.y + f, 0, sg.y + sg.h - f);
        gr.addColorStop(0, '#FFF4D6'); gr.addColorStop(1, '#F5DCA6');
        g.rrect(sg.x + f, sg.y + f, sg.w - 2 * f, sg.h - 2 * f, 10 * u, gr, 'rgba(90,50,20,.5)', 1.6 * u);
        c.strokeStyle = 'rgba(190,140,70,.18)'; c.lineWidth = 2 * u;
        for (let i = 1; i <= 3; i++) {
          const y = sg.y + f + (sg.h - 2 * f) * i / 4;
          c.beginPath(); c.moveTo(sg.x + f + 10 * u, y); c.bezierCurveTo(sg.x + sg.w * 0.3, y - 5 * u, sg.x + sg.w * 0.6, y + 5 * u, sg.x + sg.w - f - 10 * u, y); c.stroke();
        }
        for (const x of ax) { ell(c, x, sg.y + 6 * u, 5 * u, 5 * u, '#C9C9C9'); c.lineWidth = 1.5 * u; c.strokeStyle = '#555'; c.stroke(); }
        // 灯笼（第 7 关起）
        if (M.decor >= 2) {
          for (const [i, x] of [[0, sg.x + 10 * u], [1, sg.x + sg.w - 10 * u]]) {
            const sw = Math.sin(t * 2 + i * 1.3) * 0.18;
            c.save(); c.translate(x, sg.y + sg.h - 6 * u); c.rotate(sw);
            c.strokeStyle = '#5A3514'; c.lineWidth = 2 * u; c.beginPath(); c.moveTo(0, 0); c.lineTo(0, 12 * u); c.stroke();
            c.globalAlpha = 0.35 + 0.15 * Math.sin(t * 3 + i); ell(c, 0, 28 * u, 24 * u, 24 * u, '#FFB347'); c.globalAlpha = 1;
            ell(c, 0, 28 * u, 15 * u, 13 * u, '#E3261F');
            c.strokeStyle = '#FFD35A'; c.lineWidth = 1.5 * u; c.beginPath(); c.ellipse(0, 28 * u, 7 * u, 13 * u, 0, 0, TAU); c.stroke();
            g.rrect(-7 * u, 13 * u, 14 * u, 4 * u, 1.5 * u, '#FFD35A'); g.rrect(-7 * u, 39 * u, 14 * u, 4 * u, 1.5 * u, '#FFD35A');
            c.strokeStyle = '#FFD35A'; c.beginPath(); c.moveTo(0, 43 * u); c.lineTo(0, 52 * u); c.stroke();
            c.restore();
          }
        }
        // 句子
        if (M.item) {
          const cs = M.chars, fs = M.fsQ || sg.fs;
          const bc = M.cells[M.bi];
          if (bc && M.ph === 1 && M.hint && M.wrongQ + M.escapes > 0) {      // 提示：错字所在格轻轻发亮
            c.globalAlpha = 0.3 + 0.25 * Math.sin(t * 6);
            ell(c, bc.x, bc.y, M.cellW * 0.62, (M.lhQ || sg.lh) * 0.5, '#FFE45C'); c.globalAlpha = 1;
          }
          for (let i = 0; i < cs.length; i++) {
            const cl = M.cells[i];
            if (!cl) continue;
            if (i === M.bi && (M.found || M.fixed)) continue;
            g.text(cs[i], cl.x, cl.y, { size: fs, font: 'kai', color: PUNCT.test(cs[i]) ? '#6B4A2A' : '#2B1608', weight: 700 });
          }
          if (bc) {
            if (M.found && !M.fixed) {
              const wob = M.ph === 2 ? Math.sin(t * 10) * 0.06 : 0;
              c.save(); c.translate(bc.x, bc.y); c.rotate(wob);
              g.text(M.bad, 0, 0, { size: fs, font: 'kai', color: '#D62828', weight: 700 });
              c.restore();
            }
            if (M.found && !M.fixed && M.circ > 0) {
              c.strokeStyle = '#E02424'; c.lineWidth = 3.5 * u; c.lineCap = 'round';
              c.beginPath(); c.ellipse(bc.x, bc.y, M.cellW * 0.62, (M.lhQ || sg.lh) * 0.5, -0.2, -Math.PI / 2, -Math.PI / 2 + TAU * M.circ); c.stroke();
            }
            if (M.found && !M.fixed && M.strike > 0) {
              const r = fs * 0.45;
              c.strokeStyle = '#E02424'; c.lineWidth = 4 * u;
              c.beginPath(); c.moveTo(bc.x - r, bc.y + r * 0.8); c.lineTo(bc.x - r + 2 * r * M.strike, bc.y + r * 0.8 - 1.6 * r * M.strike); c.stroke();
            }
            if (M.ph === 2 && !M.fixed) {          // “?” 气泡
              if (!bc.li) {                         // 错字在第一行：气泡顶在它头上（上面是木牌边框，不挡字）
                const by = bc.y - (M.lhQ || sg.lh) * 0.5 - 16 * u + Math.sin(t * 5) * 3 * u;
                const bx = Math.min(sg.x + sg.w - 20 * u, Math.max(sg.x + 20 * u, bc.x));
                g.rrect(bx - 15 * u, by - 14 * u, 30 * u, 28 * u, 10 * u, '#FFFFFF', '#E02424', 2.5 * u);
                g.text('?', bx, by + 1 * u, { size: Math.round(20 * u), font: 'num', color: '#E02424' });
              } else {                              // 在第二、三行：上面是别的字，改成右上角的小角标（实测大气泡盖住“题”“班”“绩终”）
                const r = Math.max(8 * u, fs * 0.21), bx = bc.x + M.cellW * 0.5, by = bc.y - fs * 0.44 + Math.sin(t * 5) * 1.5 * u;
                ell(c, bx, by, r, r, '#FFFFFF'); c.lineWidth = 2 * u; c.strokeStyle = '#E02424'; c.beginPath(); c.arc(bx, by, r, 0, TAU); c.stroke();
                g.text('?', bx, by + 0.5 * u, { size: Math.round(r * 1.45), font: 'num', color: '#E02424' });
              }
            }
            if (M.fixed) {
              const k = M.stamp;
              c.save(); c.translate(bc.x, bc.y); const sc = 2.2 - 1.2 * k; c.scale(sc, sc);
              c.globalAlpha = Math.min(1, k * 2.5);
              ell(c, 0, 0, fs * 0.58, fs * 0.58, 'rgba(124,242,155,.35)');
              g.text(M.good, 0, 0, { size: fs, font: 'kai', color: '#138A36', weight: 700 });
              c.restore();
              c.globalAlpha = 1;
            }
          }
        }
        c.restore();
        // 掉下来的错字（世界坐标）
        if (M.fall && M.fall.a > 0) {
          const F = M.fall;
          c.save(); c.globalAlpha = Math.max(0, Math.min(1, F.a)); c.translate(F.x, F.y + M.drop.y); c.rotate(F.rot); c.scale(F.sc, F.sc);
          g.text(M.bad, 0, 0, { size: M.fsQ || sg.fs, font: 'kai', color: '#D62828', weight: 700 });
          c.strokeStyle = '#E02424'; c.lineWidth = 4 * u; const r = (M.fsQ || sg.fs) * 0.45;
          c.beginPath(); c.moveTo(-r, r * 0.8); c.lineTo(r, -r * 0.8); c.stroke();
          c.restore();
        }
      }
      function drawStrip(g, c) {
        const u = M.u, y = M.stripY, hgt = M.pillH, cx = g.w / 2;
        const T = M.tip;
        if (T && T.t > 0) {
          const a = Math.min(1, T.t / 0.25, (T.d - T.t) / 0.15 + 0.3);
          const fs = Math.round(17 * u);
          const maxW = Math.min(g.w - 30 * u, 700);
          const lines = fixOpenQuotes(g.wrapText(T.text, maxW - 50 * u, fs, 'kai'));
          const shown = lines.slice(0, 3);
          const lw = Math.max.apply(null, shown.map((l) => g.measure(l, fs, 'kai')));
          const bw = Math.min(maxW, lw + 62 * u), bh = Math.max(hgt, shown.length * fs * 1.3 + 14 * u);
          c.save(); c.globalAlpha = Math.max(0, Math.min(1, a));
          const warn = T.kind === 'warn';
          g.rrect(cx - bw / 2, y + 4 * u, bw, bh, 14 * u, NAVY);
          g.rrect(cx - bw / 2, y, bw, bh, 14 * u, warn ? '#FFE3E3' : '#FFFBEF', NAVY, 2.6 * u);
          g.emoji(warn ? '🙈' : '💡', cx - bw / 2 + 22 * u, y + bh / 2, 22 * u);
          shown.forEach((l, i) => g.text(l, cx - bw / 2 + 40 * u, y + bh / 2 + (i - (shown.length - 1) / 2) * fs * 1.3 + 1, { size: fs, font: 'kai', color: warn ? '#B3261E' : NAVY, weight: 700, align: 'left', maxW: bw - 52 * u }));
          c.restore();
          if (M.waitNext && M.waitT >= 1.2 && T.kind === 'e') {    // 能跳过就说出来：孩子不知道“点一下”可以直接下一题
            const k = Math.min(1, (M.waitT - 1.2) / 0.3);
            c.save(); c.globalAlpha = k * (0.75 + 0.25 * Math.sin(M.clk * 5));
            const nx = M.lastQ ? '过关' : '下一题';
            g.text(g.w >= 700 ? '点一下 / 空格：' + nx + ' ▶' : '点一下：' + nx + ' ▶', cx + bw / 2 - 8 * u, y + bh + 15 * u + Math.sin(M.clk * 5) * 2 * u,
              { size: Math.round(15 * u), font: 'round', color: '#FFFFFF', stroke: NAVY, strokeW: 3 * u, align: 'right' });
            c.restore();
          }
          return;
        }
        const ph = M.ph === 0 ? M.lastPh : M.ph;
        if (!ph || g.state === 'over') return;
        const txt = ph === 1 ? '敲举着错字的地鼠！' : '敲出正确的字！';
        const tag = ph === 1 ? '①' : '②';
        const fs = Math.round(20 * u);
        const tw = g.measure(txt, fs, 'round');
        const bw = tw + 84 * u, bh = hgt;
        const k = 1 + M.stripPop * 0.25 * Math.sin(M.stripPop * Math.PI);
        c.save(); c.translate(cx, y + bh / 2); c.scale(k, k);
        const col = ph === 1 ? '#FF7A3D' : '#27B864';
        g.rrect(-bw / 2, -bh / 2 + 4 * u, bw, bh, bh / 2, NAVY);
        g.rrect(-bw / 2, -bh / 2, bw, bh, bh / 2, col, NAVY, 2.8 * u);
        g.rrect(-bw / 2 + 6 * u, -bh / 2 + 4 * u, bw - 12 * u, bh * 0.36, bh * 0.18, 'rgba(255,255,255,.28)');
        g.emoji('🔨', -bw / 2 + 24 * u, 0, 24 * u, { rot: Math.sin(M.clk * 6) * 0.3 });
        g.text(tag + ' ' + txt, 12 * u, 1 * u, { size: fs, font: 'round', color: '#FFFFFF', stroke: NAVY, strokeW: 2.4 * u });
        c.restore();
      }
      function drawFly(g, c) {
        const F = M.fly;
        if (!F) return;
        const t = F.t, cell = M.cells[M.bi];
        const x1 = cell ? cell.x : F.x1, y1 = cell ? cell.y : F.y1;     // 飞行中转屏 / 改窗口大小：终点跟着木牌上的新位置走
        const x = F.x0 + (x1 - F.x0) * t;
        const y = F.y0 + (y1 + M.drop.y - F.y0) * t - Math.sin(t * Math.PI) * 120 * M.u;
        const sc = 1 + Math.sin(t * Math.PI) * 0.5;
        c.save(); c.translate(x, y); c.rotate(t * TAU); c.scale(sc, sc);
        ell(c, 0, 0, 30 * M.u, 30 * M.u, 'rgba(255,240,150,.55)');
        g.text(F.ch, 0, 0, { size: M.fsQ || M.sg.fs, font: 'kai', color: '#138A36', weight: 700 });
        c.restore();
      }

      /* ================= spec ================= */
      const spec = {
        name: '打地鼠找错字', icon: '🔨',     // 引擎从 HW.games 拿不到 icon，这里显式给
        maxLevel: 10, lives: 3, rounds: 6, music: 'bright', sky: 'grass',
        intro: '敲举着错字的地鼠，再敲出正确的字！',
        controls: '点地鼠 · 数字键 1–9 · 方向键+空格',
        init(g) {
          let list = (g.items('typo', 6) || []).filter(valid);
          if (list.length < 6 && !g.isReview) {
            const more = (g.G.typo || []).filter((t) => valid(t) && list.indexOf(t) < 0);
            list = list.concat(g.shuffle(more));
          }
          list = list.slice(0, 6);
          g.rounds = Math.max(1, Math.min(6, list.length));
          M = {
            list, P: param(g.level), qi: 0, item: null, ph: 0, lastPh: 1, phT: 0, clk: 0, mid: 0,
            maxN: Math.max(5, ...list.map((t) => Array.from(t.s).length)),
            holes: null, drop: { y: 0 }, sw: { a: 0, v: 0 }, ham: { x: g.w / 2, y: g.h * 0.7, a: 0.72, alpha: 0, flip: false, touch: false, fade: 0 },
            tip: null, stripPop: 0, spawnT: 0, sinceT: 0, sel: 0, kbd: false, kbdT: 0, hurtAt: -9,
            decor: g.level <= 3 ? 0 : g.level <= 6 ? 1 : 2, empty: !list.length
          };
          g.M = M;
          W.__mole = g;
          layoutAll(g);
          if (list.length) startQuestion(g, 0);
        },
        play(g) {
          if (M.empty) return;
          try { if (g.c && g.c.canvas && W.matchMedia && W.matchMedia('(hover:hover) and (pointer:fine)').matches) g.c.canvas.style.cursor = 'none'; } catch (e) { /* ignore */ }
          M.sw.v += 0.4;
          for (const h of M.holes) if (h.m && h.m.kind === 'peek') toHide(h.m, 0.12);   // 开场偷看的地鼠缩回去
          beginPhase(g, 1);
        },
        update(g, dt) {
          M.clk += dt;
          if (M.ph) { M.phT += dt; M.lastPh = M.ph; }
          // 木牌摆动：弹簧 + 微风
          M.sw.v += (-38 * M.sw.a - 2.6 * M.sw.v) * dt;
          M.sw.a += M.sw.v * dt;
          M.sw.a = Math.max(-0.12, Math.min(0.12, M.sw.a));
          if (M.fall) { const F = M.fall; F.vy += 1300 * dt; F.y += F.vy * dt; F.x += F.vx * dt; F.rot += F.vr * dt; F.a -= dt * 1.6; F.sc += dt * 0.8; if (F.a <= 0) M.fall = null; }
          if (M.tip) { M.tip.t -= dt; if (M.tip.t <= 0) M.tip = null; }
          const H = M.ham;
          if (H.touch && H.alpha > 0) { H.fade -= dt; if (H.fade < 0.25) H.alpha = Math.max(0, H.fade / 0.25); }
          if (M.kbdT > 0) M.kbdT -= dt;
          if (M.waitNext) { M.waitT += dt; if (M.waitT > 1.1) idlePeek(g, dt); }
          spawnTick(g, dt);
          updateMoles(g, dt);
        },
        draw(g, c) {
          if (!M) return;
          const tn = (W.performance && performance.now ? performance.now() : Date.now()) / 1000;
          const rdt = M.rt ? Math.max(0, Math.min(0.05, tn - M.rt)) : 0;
          M.rt = tn;
          if (!M.empty && M.holes) {
            if (g.state === 'intro') introTick(g, rdt);
            else if (g.state === 'over') overTick(g, rdt);
          }
          const breeze = Math.sin((M.clk || 0) * 1.3) * 0.012;
          const saveA = M.sw.a; M.sw.a += breeze;
          drawDecorBack(g, c);
          const showKeys = g.w >= 700 || M.kbd;
          for (const h of M.holes) {
            drawMoundBack(c, h);
            drawMole(g, c, h);
            drawMoundFront(c, h, M.kbd && M.kbdT > 0 && M.sel === h.idx);
          }
          if (showKeys) for (const h of M.holes) drawKeyBadge(g, c, h);   // 单独一遍画在最上面：前排地鼠的字牌不会盖住后排洞的数字
          drawFireflies(g, c);
          drawSign(g, c);
          drawStrip(g, c);
          drawHint(g, c);
          drawFly(g, c);
          drawHammer(g, c);
          if (M.empty) g.shadowText('题目准备中', g.w / 2, g.h / 2, { size: 32 });
          M.sw.a = saveA;
        },
        down(g, p) {
          if (M.empty) return;
          const touch = p.type !== 'mouse';
          if (!touch) M.kbd = false;
          whackAt(g, p.x, p.y, touch);
        },
        move(g, p) {
          if (p.type === 'mouse') { const H = M.ham; H.x = p.x; H.y = p.y; H.alpha = 1; H.touch = false; H.flip = p.x > g.w - 125 * M.ms; }
        },
        key(g, k) {
          if (M.empty) return;
          if (/^[1-9]$/.test(k)) { const i = +k - 1; if (i < M.holes.length) whackHole(g, i); return; }
          if (k === 'space' || k === 'enter') { if (!skipWait(g)) whackHole(g, M.sel); return; }
          const dir = { left: [-1, 0], right: [1, 0], up: [0, -1], down: [0, 1] }[k];
          if (!dir) return;
          const cur = M.holes[M.sel] || M.holes[0];
          let best = null, bd = 1e9;
          for (const h of M.holes) {
            if (h === cur) continue;
            const dx = h.x - cur.x, dy = h.y - cur.y;
            const along = dx * dir[0] + dy * dir[1];
            if (along <= 4) continue;
            const off = Math.abs(dx * dir[1]) + Math.abs(dy * dir[0]);
            const d = along + off * 2.2;
            if (d < bd) { bd = d; best = h; }
          }
          if (best) M.sel = best.idx;
          M.kbd = true; M.kbdT = 4;
          const h = M.holes[M.sel];
          const H = M.ham; H.x = h.x; H.y = h.y - 40 * h.s; H.alpha = 1; H.touch = false; H.flip = h.x > g.w - 125 * M.ms;
          g.sfx('tick');
        },
        resize(g) { if (M) layoutAll(g); },
        end(g) {
          try { if (g.c && g.c.canvas) g.c.canvas.style.cursor = ''; } catch (e) { /* ignore */ }
          if (W.__mole === g) W.__mole = null;
        }
      };
      return HW.arcade.run(ctx, spec);
    }
  });
})();
