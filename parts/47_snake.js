/* =====================================================================
 * 华文小岛 2.0 · 🐍 贪吃蛇排句子（parts/47_snake.js）
 * 契约：SPEC_ARCADE.md §4 第 7 条；引擎：HW.arcade（parts/15_arcade.js）
 *
 * 玩法：格子草坪上散落着“词语果子”（气泡里写词块）。小蛇要按句子顺序一口一口吃，
 *   吃对的词块飞进顶部“句子条”、变成挂在蛇身上的果子（蛇身变长）；吃错 → 扣心、
 *   词块弹开换位置；撞墙 / 撞榴莲 / 撞螃蟹 / 咬到自己 → 扣心，小蛇停下等你换方向。
 *   每句开始小蛇先停着让孩子看清词块，按方向（滑动 / 屏幕方向键 / ←↑→↓ / WASD / 点哪走哪）出发。
 * 关卡：1–2 关边墙可穿越；3 关起出现榴莲障碍；7 关起有横着走的螃蟹；越高关蛇越快。每关 5 句。
 * 题目：只用非 para 题（不够再用 para：句子块显示成 ①②③ 编号 + 上方编号对照表）。
 *   合法顺序 = tiles 原顺序 + alts；按“文字”比对，所以重复词块、多种合法语序都算对。
 * ===================================================================== */
(function () {
  'use strict';
  const W = window, D = document;
  const HW = W.HW;
  if (!HW || typeof HW.register !== 'function') return;

  const NAVY = '#1d2b53';
  const FRUITS = [
    ['🍎', '#FFE1DE', '#FF5A5F'], ['🍊', '#FFE9D2', '#FF9A3C'], ['🍇', '#EFE3FF', '#9B5CFF'], ['🍓', '#FFE2EA', '#FF4F7B'],
    ['🥭', '#FFF1C6', '#FFB21E'], ['🍉', '#E2F8DD', '#3CCB5A'], ['🍑', '#FFE8DC', '#FF8A65'], ['🍋', '#FFF7C4', '#F5CF1C'],
    ['🍒', '#FFE1DE', '#E53950'], ['🍐', '#EEF8D3', '#9CCB3A'], ['🥝', '#E7F5D5', '#6CB33F'], ['🍍', '#FFF3C0', '#F2B61B']
  ];
  const CIRC = ['①', '②', '③', '④', '⑤', '⑥', '⑦', '⑧', '⑨', '⑩'];
  const DV = { left: [-1, 0], right: [1, 0], up: [0, -1], down: [0, 1] };
  const OPP = { left: 'right', right: 'left', up: 'down', down: 'up' };
  const DIRS = ['up', 'left', 'down', 'right'];
  const KEYDIR = { left: 'left', right: 'right', up: 'up', down: 'down', a: 'left', A: 'left', d: 'right', D: 'right', w: 'up', W: 'up', s: 'down', S: 'down' };
  const PRAISE = ['真棒！', '句子通顺！', '排得好！', '太厉害了！', '好句子！'];
  const CRASH = { wall: '撞到篱笆啦！', durian: '哎哟！榴莲好扎！', crab: '被螃蟹夹到啦！', self: '咬到自己啦！' };
  const PUNCT = '，。！？、；：”’）》…—,.!?;:';
  const KW = 700;   // 楷体加粗一点，气泡里更清楚
  const PARTY_T = 2.5;   // 整句完成 → 下一句出现的最短秒数（期间朗读 + 大横幅 + 蛇跳舞）；长句按字数 / 朗读时长延长
  const PARTY_MIN = 1.3; // 过了这么久，按方向 / 点一下就能直接进下一句

  const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
  const lerp = (a, b, t) => a + (b - a) * t;
  const mod = (a, n) => ((a % n) + n) % n;
  const str = (x) => (typeof x === 'string' ? x : x == null ? '' : String(x));
  const isItem = (o) => !!o && Array.isArray(o.tiles) && o.tiles.length >= 2 && o.tiles.length <= 10 && o.tiles.every((t) => str(t).length > 0);
  function outBack(t) { const c1 = 1.70158, c3 = c1 + 1; return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2); }
  function outCubic(t) { return 1 - Math.pow(1 - t, 3); }

  /** 所有合法顺序：tiles 原顺序 + 格式正确的 alts */
  function ordersOf(o) {
    const n = o.tiles.length;
    const base = [];
    for (let i = 0; i < n; i++) base.push(i);
    const out = [base];
    (Array.isArray(o.alts) ? o.alts : []).forEach((a) => {
      if (Array.isArray(a) && a.length === n && a.slice().sort((x, y) => x - y).every((v, k) => v === k)) out.push(a.slice());
    });
    return out;
  }
  /** 关卡参数：速度（格/秒）、穿墙、榴莲数、螃蟹数 */
  function cfgFor(lv) {
    return {
      speed: 2.9 + (lv - 1) * 0.42,
      wrap: lv <= 2,
      durians: lv <= 2 ? 0 : Math.min(6, lv - 2),
      crabs: lv >= 9 ? 2 : lv >= 7 ? 1 : 0,
      crabStep: Math.max(0.42, 0.78 - (lv - 7) * 0.09),
      hints: lv <= 2
    };
  }

  function makeSpec() {
    const S = { vt: 0, lastNow: 0 };
    const L = { cols: 0, rows: 0 };
    let g = null;

    /* ================= 题目 ================= */
    function pickItems(n) {
      let out = [];
      // 重练：只在错题里真有“排句子”题时用错题（g.items 在没有该栏目错题时会退回整个题库，连 para 长段也混进来）
      const rvN = typeof g.hasReview === 'function' ? g.hasReview('order') : (g.isReview ? 1 : 0);
      if (g.isReview && rvN > 0) out = (g.items('order', n) || []).filter(isItem);
      if (!out.length) {
        const all = (Array.isArray(g.G.order) ? g.G.order : []).filter(isItem);
        const np = all.filter((o) => o.mode !== 'para'), pa = all.filter((o) => o.mode === 'para');
        out = np.length ? g.ctx.pick(np, n) : [];
        if (out.length < n && pa.length) out = out.concat(g.ctx.pick(pa, n - out.length));
      }
      // 由易到难：块少、字少的先来；para 放最后
      const cost = (o) => (o.mode === 'para' ? 1000 : 0) + o.tiles.length * 20 + str(o.ans).length;
      return out.slice(0, n).sort((a, b) => cost(a) - cost(b));
    }
    function makeQ(it) {
      const para = it.mode === 'para';
      const tiles = it.tiles.map((t, k) => ({ t: str(t), k }));
      const orders = ordersOf(it);
      const canon = orders[0].map((k) => tiles[k].t).join('');
      const ansFull = str(it.ans) || canon;
      const suffix = ansFull.indexOf(canon) === 0 ? ansFull.slice(canon.length) : '';
      let labels = null;
      if (para) {
        const good = orders[0].map((_, i) => CIRC[i]).join('');
        for (let tries = 0; tries < 12; tries++) {
          labels = g.shuffle(tiles.map((_, i) => CIRC[i]));
          if (orders[0].map((k) => labels[k]).join('') !== good) break;   // 编号顺序别刚好就是答案
        }
      }
      return { it, para, tiles, orders, cands: orders.slice(), eaten: [], landed: 0, suffix, ansFull, labels, done: false, wrongs: 0, doneT: 0 };
    }
    const disp = (k) => (S.Q.para ? S.Q.labels[k] : S.Q.tiles[k].t);
    function allowed(k) {
      const Q = S.Q, pos = Q.eaten.length;
      if (pos >= Q.tiles.length) return false;
      return Q.cands.some((ord) => Q.tiles[ord[pos]].t === Q.tiles[k].t);
    }
    function expected() {
      const Q = S.Q, pos = Q.eaten.length, seen = [];
      Q.cands.forEach((ord) => { const t = Q.tiles[ord[pos]].t; if (seen.indexOf(t) < 0) seen.push(t); });
      return seen;
    }
    function sentenceNow() { return S.Q.eaten.map((k) => S.Q.tiles[k].t).join('') + (S.Q.eaten.length === S.Q.tiles.length ? S.Q.suffix : ''); }

    /* ================= 布局 ================= */
    function chipLayout(texts, bf, maxW) {
      const padX = Math.round(bf * 0.3), gap = Math.round(bf * 0.2), ch = Math.round(bf * 1.52), lg = Math.round(bf * 0.3);
      const chips = [];
      let x = 0, line = 0;
      for (const t of texts) {
        const w = Math.min(maxW, t === '?' ? Math.round(bf * 1.9) : Math.ceil(g.measure(t, bf, 'kai', KW)) + padX * 2);
        if (x > 0 && x + w > maxW) { x = 0; line++; }
        chips.push({ x, y: line * (ch + lg), w, h: ch, t, line });
        x += w + gap;
      }
      // 每行居中
      for (let l = 0; l <= line; l++) {
        const row = chips.filter((c) => c.line === l);
        if (!row.length) continue;
        const rw = row[row.length - 1].x + row[row.length - 1].w;
        const off = Math.max(0, (maxW - rw) / 2);
        row.forEach((c) => { c.x += off; });
      }
      return { chips, lines: line + 1, ch, lg };
    }
    function fullTexts(it) {
      if (it.mode === 'para') return it.tiles.map((_, i) => CIRC[i]);
      const orders = ordersOf(it), tl = it.tiles.map(str);
      const canon = orders[0].map((k) => tl[k]).join('');
      const suf = str(it.ans).indexOf(canon) === 0 ? str(it.ans).slice(canon.length) : '';
      const out = orders[0].map((k) => tl[k]);
      out[out.length - 1] += suf;
      return out;
    }
    function legendH(it, w) {
      if (!it || it.mode !== 'para') return 0;
      const lf = L.lf, lh = Math.round(lf * 1.42);
      let n = 0;
      it.tiles.forEach((t) => { n += Math.max(1, g.wrapText(str(t), w - lf * 2.2, lf, 'kai').length); });
      return n * lh + Math.round(lf * 0.9);
    }
    /** 画布在屏幕里实际露出来的高度（引擎画布最少 480 高：横拿手机时下半截在屏幕外，又因 touch-action:none 滑不上来） */
    function visH() {
      try {
        const cv = g.c && g.c.canvas;
        if (!cv || !cv.getBoundingClientRect) return g.h;
        const r = cv.getBoundingClientRect(), vh = W.innerHeight || g.h;
        return clamp(Math.floor(vh - r.top), 120, g.h);
      } catch (e) { return g.h; }
    }
    function layout(fix) {
      L.visH = visH();
      const land = g.w > g.h * 1.05;
      L.land = land;
      const u = land ? clamp(g.h / 800, 0.8, 1.35) : clamp(g.w / 390, 0.85, 1.4);
      L.u = u;
      const side = Math.round(10 * u);
      L.dpW = land ? Math.round(220 * u) : 0;
      L.dpH = land ? 0 : Math.round(148 * u);
      const areaL = side, areaR = g.w - side - L.dpW, areaW = areaR - areaL;
      // 句子条
      L.bf = land ? clamp(Math.round(g.h * 0.036), 20, 30) : clamp(Math.round(g.w * 0.05), 16, 24);
      L.lf = land ? clamp(Math.round(g.h * 0.024), 15, 21) : clamp(Math.round(g.w * 0.04), 14, 18);
      L.barPad = Math.round(L.bf * 0.42);
      L.barW = Math.min(areaW, Math.round(1000 * u));
      L.barX = Math.round(areaL + (areaW - L.barW) / 2);
      // 引擎的“连击×N”火焰牌画在 hudTop 下方约 17px、朗读小喇叭画在 hudTop 左下：句子条让开一点，别被它们压住
      L.barY = g.hudTop + Math.round(12 * clamp(g.w / 390, 0.9, 1.25));
      L.iconW = Math.round(L.bf * 1.6);
      const inner = L.barW - L.barPad * 2 - L.iconW;   // 左边留一个小图标位
      L.barInner = inner;
      // 句子条高度：非编号题按整份题单里最长的一句定（换题时句子条不跳）；编号题（para）的块只是 ①②③，一行就够
      const curPara = !!(S.Q && S.Q.para);
      const sizing = curPara ? [S.Q.it] : (S.list || []).filter((it) => it.mode !== 'para');
      if (!curPara && S.Q && sizing.indexOf(S.Q.it) < 0) sizing.push(S.Q.it);
      const needLines = (bf) => {
        let n = 1;
        sizing.forEach((it) => { n = Math.max(n, chipLayout(fullTexts(it), bf, inner).lines, chipLayout(it.tiles.map(() => '?'), bf, inner).lines); });
        return n;
      };
      let lines = needLines(L.bf);
      while (lines > 2 && L.bf > 15) { L.bf--; lines = needLines(L.bf); }   // 长句子：字小一号，句子条最多两行
      lines = Math.min(lines, 3);
      const ch = Math.round(L.bf * 1.52), lg = Math.round(L.bf * 0.3);
      L.barH = L.barPad * 2 + lines * ch + (lines - 1) * lg;
      // para 编号对照表：只按“当前这道题”量高度（以前按整份题单最长的一篇量，手机上棋盘被挤成一小块）；
      // 对照表太高时字小一号，至少给棋盘留一半地方
      L.legW = L.barW;
      L.legY = L.barY + L.barH + Math.round(6 * u);
      L.legH = 0;
      L.fr = clamp(Math.round((land ? g.h / 800 * 16 : g.w / 390 * 10)), 8, 20);
      const bBot = land ? g.h - side : g.h - L.dpH;
      if (curPara) {
        const room = bBot - L.legY - Math.round(8 * u);
        L.legH = legendH(S.Q.it, L.legW);
        while (L.legH > room * 0.5 && L.lf > 13) { L.lf--; L.legH = legendH(S.Q.it, L.legW); }
      }
      // 棋盘
      const bTop = L.barY + L.barH + Math.round(8 * u) + (L.legH ? L.legH + Math.round(8 * u) : 0);
      const aw = areaW - L.fr * 2, ah = bBot - bTop - L.fr * 2 - 6;
      if (fix || !L.cols) {
        if (land) {
          const cs = clamp(Math.floor(ah / 13), 30, 54);
          L.rows = clamp(Math.floor(ah / cs), 8, 15);
          L.cols = clamp(Math.floor(aw / cs), 10, 18);   // 太宽的棋盘词块稀、跑得闷
        } else {
          L.cols = clamp(Math.floor(aw / 34), 9, 13);
          const cs = Math.floor(aw / L.cols);
          L.rows = clamp(Math.floor(ah / cs), 8, 20);
        }
      }
      L.cell = Math.max(12, Math.floor(Math.min(aw / L.cols, ah / L.rows)));
      L.bw = L.cols * L.cell; L.bh = L.rows * L.cell;
      L.bx = Math.round(areaL + (areaW - L.bw) / 2);
      L.by = Math.round(bTop + L.fr + Math.max(0, ah - L.bh) * (land ? 0.5 : 0.3));
      // 方向键（倒 T 形）
      const bw = Math.round((land ? 72 : 66) * u), bh = Math.round((land ? 62 : 54) * u), gp = Math.round(8 * u);
      let cx, cy;
      if (land) { cx = g.w - side - L.dpW / 2; cy = clamp(L.by + L.bh * 0.62, L.by + bh * 2, Math.min(g.h - side - bh, (L.visH || g.h) - side - bh / 2 - 6)); }
      else { cx = g.w / 2; cy = g.h - side - bh / 2 - Math.round(6 * u); }
      L.btn = {
        up: { x: cx - bw / 2, y: cy - bh / 2 - gp - bh, w: bw, h: bh },
        left: { x: cx - bw / 2 - gp - bw, y: cy - bh / 2, w: bw, h: bh },
        down: { x: cx - bw / 2, y: cy - bh / 2, w: bw, h: bh },
        right: { x: cx + bw / 2 + gp, y: cy - bh / 2, w: bw, h: bh }
      };
      L.padCx = cx; L.padBot = cy + bh / 2;
    }

    /* ================= 格子查询 ================= */
    const cellEq = (p, x, y) => mod(p.x, L.cols) === x && mod(p.y, L.rows) === y;
    function blockAt(x, y) {
      for (const b of S.blocks) if (b.alive && x >= b.x && x < b.x + b.kx && y >= b.y && y < b.y + b.ky) return b;
      return null;
    }
    const durianAt = (x, y) => S.durians.some((d) => d.x === x && d.y === y);
    const crabAt = (x, y) => S.crabs.some((c) => c.x === x && c.y === y);
    const bonusAt = (x, y) => S.bonus.find((b) => b.x === x && b.y === y) || null;
    function bodyAt(x, y, from, skipTail) {
      const n = S.seg.length - (skipTail ? 1 : 0);
      for (let i = from; i < n; i++) if (cellEq(S.seg[i], x, y)) return true;
      return false;
    }
    /** 头要走进 (nx,ny)（未取模）时会撞到什么：'' = 能走 */
    function blockedAt(nx, ny) {
      if (!S.cf.wrap && (nx < 0 || ny < 0 || nx >= L.cols || ny >= L.rows)) return 'wall';
      const x = mod(nx, L.cols), y = mod(ny, L.rows);
      if (durianAt(x, y)) return 'durian';
      if (crabAt(x, y)) return 'crab';
      if (bodyAt(x, y, 1, S.grow === 0)) return 'self';
      return '';
    }
    function occGrid(skip) {
      const C = L.cols, R = L.rows, hard = new Uint8Array(C * R), near = new Uint8Array(C * R);
      const mark = (a, x, y) => { if (x >= 0 && y >= 0 && x < C && y < R) a[y * C + x] = 1; };
      const ring = (x, y) => { for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) mark(near, x + dx, y + dy); };
      S.durians.forEach((d) => { mark(hard, d.x, d.y); ring(d.x, d.y); });
      S.crabs.forEach((c) => { mark(hard, c.x, c.y); mark(near, c.x - 1, c.y); mark(near, c.x + 1, c.y); });
      S.bonus.forEach((b) => mark(hard, b.x, b.y));
      S.seg.forEach((p) => mark(hard, mod(p.x, C), mod(p.y, R)));
      S.blocks.forEach((b) => {
        if (!b.alive || b === skip) return;
        for (let y = b.y; y < b.y + b.ky; y++) for (let x = b.x; x < b.x + b.kx; x++) { mark(hard, x, y); ring(x, y); }
      });
      // 蛇头周围 + 前方 5 格留空，别让词块一出现就撞到嘴里
      if (S.seg.length) {
        const h = S.seg[0], hx = mod(h.x, C), hy = mod(h.y, R);
        for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) mark(near, hx + dx, hy + dy);
        const [ddx, ddy] = DV[S.dir] || [1, 0];
        for (let k = 1; k <= 5; k++) {
          let x = hx + ddx * k, y = hy + ddy * k;
          if (S.cf.wrap) { x = mod(x, C); y = mod(y, R); }
          mark(near, x, y); mark(near, x + ddy, y + ddx); mark(near, x - ddy, y - ddx);
        }
      }
      return { hard, near };
    }
    function findSpot(kx, ky, skip, extra) {
      const C = L.cols, R = L.rows;
      if (kx > C || ky > R) return null;
      const { hard, near } = occGrid(skip);
      const ok = (x, y, useNear) => {
        for (let yy = y; yy < y + ky; yy++) for (let xx = x; xx < x + kx; xx++) {
          const i = yy * C + xx;
          if (hard[i] || (useNear && near[i])) return false;
        }
        return !extra || extra(x, y);
      };
      for (const useNear of [true, false]) {
        for (let t = 0; t < 260; t++) {
          const x = g.randi(0, C - kx), y = g.randi(0, R - ky);
          if (ok(x, y, useNear)) return { x, y };
        }
      }
      for (let y = 0; y <= R - ky; y++) for (let x = 0; x <= C - kx; x++) if (ok(x, y, false)) return { x, y };
      return null;
    }
    /** 从蛇头出发能到达的格子（词块 / 榴莲 / 螃蟹 / 蛇身都当墙） */
    function reach() {
      const C = L.cols, R = L.rows, seen = new Uint8Array(C * R), wall = new Uint8Array(C * R);
      S.durians.forEach((d) => { wall[d.y * C + d.x] = 1; });
      S.crabs.forEach((c) => { wall[c.y * C + c.x] = 1; });
      S.seg.forEach((p, i) => { if (i) wall[mod(p.y, R) * C + mod(p.x, C)] = 1; });
      S.blocks.forEach((b) => { if (b.alive) for (let y = b.y; y < b.y + b.ky; y++) for (let x = b.x; x < b.x + b.kx; x++) wall[y * C + x] = 1; });
      const h = S.seg[0], q = [mod(h.y, R) * C + mod(h.x, C)];
      seen[q[0]] = 1;
      while (q.length) {
        const i = q.shift(), x = i % C, y = (i - x) / C;
        for (const d of DIRS) {
          let nx = x + DV[d][0], ny = y + DV[d][1];
          if (S.cf.wrap) { nx = mod(nx, C); ny = mod(ny, R); } else if (nx < 0 || ny < 0 || nx >= C || ny >= R) continue;
          const j = ny * C + nx;
          if (seen[j] || wall[j]) continue;
          seen[j] = 1; q.push(j);
        }
      }
      return seen;
    }
    function reachable(b, seen) {
      const C = L.cols, R = L.rows;
      for (let y = b.y; y < b.y + b.ky; y++) for (let x = b.x; x < b.x + b.kx; x++) {
        for (const d of DIRS) {
          let nx = x + DV[d][0], ny = y + DV[d][1];
          if (S.cf.wrap) { nx = mod(nx, C); ny = mod(ny, R); } else if (nx < 0 || ny < 0 || nx >= C || ny >= R) continue;
          if (seen[ny * C + nx]) return true;
        }
      }
      return false;
    }
    function ensureReachable() {
      for (let round = 0; round < 6; round++) {
        const seen = reach();
        const bad = S.blocks.filter((b) => b.alive && !reachable(b, seen));
        if (!bad.length) return;
        bad.forEach((b) => { const sp = findSpot(b.kx, b.ky, b); if (sp) { b.x = sp.x; b.y = sp.y; } });
      }
    }

    /* ================= 像素坐标 ================= */
    const cx = (x) => L.bx + (x + 0.5) * L.cell;
    const cy = (y) => L.by + (y + 0.5) * L.cell;
    function headPx() {
      const p = S.pts && S.pts.length ? S.pts[0] : null;
      if (p) return { x: L.bx + mod(p.x - L.bx, L.bw), y: L.by + mod(p.y - L.by, L.bh) };
      const h = S.seg[0];
      return { x: cx(mod(h.x, L.cols)), y: cy(mod(h.y, L.rows)) };
    }
    function blockPx(b) { return { x: L.bx + (b.x + b.kx / 2) * L.cell, y: L.by + (b.y + b.ky / 2) * L.cell }; }

    /* ================= 词块 ================= */
    function sizeBlock(b) {
      const cs = L.cell, text = b.text;
      if (S.Q.para) { b.kx = 2; b.ky = 1; b.fsr = 0.64; b.lines = [text]; return; }
      const maxK = Math.max(3, Math.floor(L.cols * 0.56));
      const fruitW = cs * 0.92, padR = cs * 0.34;
      for (let fsr = 0.56; fsr >= 0.4; fsr -= 0.04) {
        const fs = Math.round(cs * fsr);
        const tw = g.measure(text, fs, 'kai', KW);
        let kx = Math.ceil((tw + fruitW + padR) / cs);
        if (kx <= maxK) { b.kx = Math.max(2, kx); b.ky = 1; b.fsr = fsr; b.lines = [text]; return; }
        const chs = Array.from(text);
        if (chs.length >= 4) {
          let m = Math.ceil(chs.length / 2);
          while (m < chs.length - 1 && PUNCT.indexOf(chs[m]) >= 0) m++;
          const l1 = chs.slice(0, m).join(''), l2 = chs.slice(m).join('');
          const tw2 = Math.max(g.measure(l1, fs, 'kai', KW), g.measure(l2, fs, 'kai', KW));
          kx = Math.ceil((tw2 + fruitW + padR) / cs);
          if (kx <= maxK) { b.kx = Math.max(2, kx); b.ky = 2; b.fsr = fsr; b.lines = [l1, l2]; return; }
        }
      }
      b.kx = maxK; b.ky = 2; b.fsr = 0.4;
      const chs = Array.from(text), m = Math.ceil(chs.length / 2);
      b.lines = [chs.slice(0, m).join(''), chs.slice(m).join('')];
    }
    function startQuestion() {
      const it = S.list[S.qi];
      S.Q = makeQ(it);
      // 每题重算格子：编号题（para）要在棋盘上方放对照表，行数会变 → 小蛇、榴莲、螃蟹按新格子重新摆
      S.blocks = []; S.flyers = []; S.landT = []; S.bonus = [];
      const c0 = L.cols, r0 = L.rows;
      layout(true);
      if (L.cols !== c0 || L.rows !== r0) {
        spawnSnake(); placeDurians(); placeCrabs();
        S.pts = null; S.bc = null;
      }
      const ks = g.shuffle(S.Q.tiles.map((t) => t.k));
      const f0 = g.randi(0, FRUITS.length - 1);
      ks.forEach((k, i) => {
        const fr = FRUITS[(f0 + i) % FRUITS.length];
        const b = { k, text: disp(k), fruit: fr[0], tint: fr[1], col: fr[2], x: 0, y: 0, kx: 1, ky: 1, alive: true, born: S.vt + 0.12 + i * 0.09, ph: g.rand(0, 6.28), hint: 0, fly: null, dying: null };
        sizeBlock(b);
        const sp = findSpot(b.kx, b.ky, b);
        if (sp) { b.x = sp.x; b.y = sp.y; S.blocks.push(b); }
        else { b.kx = Math.min(b.kx, L.cols); b.ky = 1; const s2 = findSpot(b.kx, 1, b); if (s2) { b.x = s2.x; b.y = s2.y; } S.blocks.push(b); }
      });
      ensureReachable();
      if (S.qi > 0 && Math.random() < 0.55) {
        const heart = g.lives < g.maxLives && g.level >= 3 && Math.random() < 0.45;
        const sp = findSpot(1, 1, null);
        if (sp) S.bonus.push({ x: sp.x, y: sp.y, kind: heart ? 'heart' : 'star', born: S.vt + 0.6 });
      }
      toWait(false);
      S.hint1 = S.qi === 0;
      S.qT = S.vt;
      S.popSfx = 0;
      S.idle = 0; S.banner = null;
      if (S.qi > 0) g.sfx('whoosh');
    }

    /* ================= 蛇 ================= */
    function spawnSnake() {
      const r = Math.floor(L.rows / 2), x0 = Math.min(3, L.cols - 3);
      S.seg = [{ x: x0, y: r }, { x: x0 - 1, y: r }, { x: x0 - 2, y: r }];
      S.prev = S.seg.map((p) => ({ x: p.x, y: p.y }));
      S.dir = 'right'; S.queue = []; S.grow = 0; S.moveT = 0; S.tags = [];
    }
    function freeze() { S.prev = S.seg.map((p) => ({ x: p.x, y: p.y })); S.moveT = 0; }
    function speed() { return S.cf.speed + S.speedUp; }
    function validDirs() {
      const out = [];
      for (const d of DIRS) {
        const h = S.seg[0], nx = h.x + DV[d][0], ny = h.y + DV[d][1];
        if (S.seg[1] && cellEq(S.seg[1], mod(nx, L.cols), mod(ny, L.rows))) continue;
        if (!blockedAt(nx, ny)) out.push(d);
      }
      return out;
    }
    function toWait(afterCrash) {
      S.mode = 'wait'; S.waitCrash = !!afterCrash; S.queue = []; S.waitT = S.vt;
      freeze();
      if (!validDirs().length) respawn();
    }
    /** 被困住（四面都走不通）：换个空地方，身体缩回 3 节 */
    function respawn() {
      const C = L.cols, R = L.rows;
      const fits = (x, y) => {
        for (let k = -2; k <= 2; k++) { const xx = x + k; if (xx < 0 || xx >= C || blockAt(xx, y) || durianAt(xx, y) || crabAt(xx, y)) return false; }
        return true;
      };
      const old = headPx();
      let best = null;
      for (let t = 0; t < 400 && !best; t++) { const x = g.randi(2, C - 3), y = g.randi(0, R - 1); if (fits(x, y)) best = { x, y }; }
      if (!best) return;
      S.seg = [{ x: best.x, y: best.y }, { x: best.x - 1, y: best.y }, { x: best.x - 2, y: best.y }];
      S.dir = 'right'; S.grow = 0; S.tags = S.tags.slice(0, 1);
      freeze();
      g.burst(old.x, old.y, { kind: 'dot', color: '#FFFFFF', n: 12 });
      g.float('换个地方！', cx(best.x), cy(best.y) - L.cell, { color: '#FFFFFF', size: Math.round(22 * L.u) });
    }
    /** 横竖屏切换：沿用旧的行列数会让棋盘变成细长一条、格子很小 → 按新方向重算行列，
     *  所有东西重新摆放；小蛇回到起点、身体按原长度重新长出来，停下来等孩子重新出发。 */
    function regrid() {
      const len = S.seg.length, tags = S.tags.slice(), mode = S.mode;
      layout(true);
      spawnSnake();
      S.tags = tags; S.grow = Math.max(0, len - 3);
      placeDurians();
      placeCrabs();
      S.blocks.forEach((b) => {
        if (!b.alive) return;
        b.fly = null; b.x = -99; b.y = -99;   // 先挪开，免得和自己的旧位置冲突
      });
      S.blocks.forEach((b) => {
        if (!b.alive) return;
        sizeBlock(b);
        const sp = findSpot(b.kx, b.ky, b) || findSpot(Math.min(b.kx, L.cols), 1, b);
        if (sp) { b.x = sp.x; b.y = sp.y; } else { b.x = 0; b.y = 0; }
      });
      S.blocks = S.blocks.filter((b) => b.alive);
      S.bonus = S.bonus.map((bo) => { const sp = findSpot(1, 1, null); return sp ? { x: sp.x, y: sp.y, kind: bo.kind, born: bo.born } : null; }).filter(Boolean);
      ensureReachable();
      S.pts = null; S.flyers = []; S.banner = null;
      if (S.Q) S.Q.landed = S.Q.eaten.length;
      if (mode === 'move' || mode === 'stun' || mode === 'wait') toWait(false);
    }
    function pressDir(d) {
      if (!d || S.empty || g.state !== 'play') return;
      S.pressT[d] = S.vt;
      if (S.mode === 'party') {   // 庆祝够久了：按一下直接下一句
        if (S.party && !S.party.ended && S.vt - S.party.t0 >= PARTY_MIN) endParty(true);
        return;
      }
      if (S.mode === 'wait') {
        const h = S.seg[0], nx = h.x + DV[d][0], ny = h.y + DV[d][1];
        const neck = S.seg[1] && cellEq(S.seg[1], mod(nx, L.cols), mod(ny, L.rows));
        const why = neck ? 'self' : blockedAt(nx, ny);
        if (why) { bonk(d); return; }
        S.dir = d; S.mode = 'move'; S.moveT = 0; S.hint1 = false; S.waitCrash = false; S.queue = [];
        g.sfx('jump');
        advance();
        return;
      }
      if (S.mode === 'move') {
        const last = S.queue.length ? S.queue[S.queue.length - 1] : S.dir;
        if (d === last || d === OPP[last]) return;
        if (S.queue.length < 2) S.queue.push(d);
      }
    }
    function bonk(d) {
      S.bonk = { t0: S.vt, d };
      g.sfx('tick'); g.shake(3);
    }
    function advance() {
      if (S.queue.length) {
        const d = S.queue.shift();
        if (d !== OPP[S.dir] && d !== S.dir) {
          S.dir = d;
          const p = headPx();
          g.burst(p.x, p.y, { kind: 'dot', color: '#7CCB4A', n: 4 });
        }
      }
      const h = S.seg[0], nx = h.x + DV[S.dir][0], ny = h.y + DV[S.dir][1];
      const why = blockedAt(nx, ny);
      if (why) { crash(why); return false; }
      const old = S.seg.map((p) => ({ x: p.x, y: p.y }));
      S.seg.unshift({ x: nx, y: ny });
      if (S.grow > 0) { S.grow--; old.push({ x: old[old.length - 1].x, y: old[old.length - 1].y }); } else S.seg.pop();
      S.prev = old;
      if (g.combo >= 5) {   // 连击中：蛇尾拖一串小火花
        const tl = old[old.length - 1];
        g.burst(cx(mod(tl.x, L.cols)), cy(mod(tl.y, L.rows)), { kind: 'spark', n: g.combo >= 10 ? 3 : 2, color: g.combo >= 10 ? '#E3B3FF' : '#FFE45C' });
      }
      if (S.cf.wrap) {   // 穿墙：整条蛇（含上一帧位置）一起平移，保持身体连续
        const sx = Math.floor(S.seg[0].x / L.cols) * L.cols, sy = Math.floor(S.seg[0].y / L.rows) * L.rows;
        if (sx || sy) [S.seg, S.prev].forEach((arr) => arr.forEach((p) => { p.x -= sx; p.y -= sy; }));
      }
      return true;
    }
    function arrive() {
      const h = S.seg[0], x = mod(h.x, L.cols), y = mod(h.y, L.rows);
      const bo = bonusAt(x, y);
      if (bo) collect(bo);
      const b = blockAt(x, y);
      if (b) { if (allowed(b.k)) eatRight(b); else eatWrong(b); }
    }
    function crash(why) {
      freeze();
      S.mode = 'stun'; S.stunT = S.vt; S.bump = { t0: S.vt, d: S.dir }; S.queue = [];
      const p = headPx();
      g.sfx('crash');
      // 引擎的红 ✗ 画在头上方 0–50px：文字再往上挪，太靠顶就放到头下面，免得两个叠成一团看不清
      let fy = p.y - L.cell * 0.9 - 50;
      if (fy < L.by + 12) fy = p.y + L.cell * 1.1 + 12;
      g.float(CRASH[why] || '哎呀！', clamp(p.x, 100 * L.u, g.w - 100 * L.u), clamp(fy, g.hudTop + 30, g.h - 40), { color: '#FFFFFF', size: Math.round(24 * L.u) });
      g.burst(p.x, p.y, { kind: 'star', n: 8 });
      g.wrong(undefined, CRASH[why] || '撞到了', p.x, p.y);   // 扣心、抖屏；不记进错题本（不是题目错误）
      if (g.state === 'play') g.after(0.9, () => { if (S.mode === 'stun') toWait(true); });
    }
    function collect(bo) {
      S.bonus.splice(S.bonus.indexOf(bo), 1);
      const x = cx(bo.x), y = cy(bo.y);
      g.sfx('power'); g.ring(x, y, '#FFFFFF');
      if (bo.kind === 'heart' && g.lives < g.maxLives) {
        g.lives++;
        g.burst(x, y, { kind: 'dot', color: '#FF5A6E', n: 14 });
        g.float('+❤', x, y - L.cell, { color: '#FF8FA3', size: Math.round(30 * L.u) });
      } else {
        g.burst(x, y, { kind: 'star', n: 14 });
        g.addScore(15, x, y - L.cell);
      }
    }
    function eatRight(b) {
      const Q = S.Q, pos = Q.eaten.length, t = Q.tiles[b.k].t;
      Q.cands = Q.cands.filter((ord) => Q.tiles[ord[pos]].t === t);
      Q.eaten.push(b.k);
      b.alive = false; b.dying = S.vt;
      S.grow += 2;
      S.idle = 0;
      S.tags.push({ fruit: b.fruit, col: b.col, born: S.vt });
      S.gulpT = S.vt;
      S.blocks.forEach((o) => { o.hint = 0; });
      const p = blockPx(b), hp = headPx();
      g.combo++; if (g.combo > g.maxCombo) g.maxCombo = g.combo;
      const mult = g.combo >= 10 ? 4 : g.combo >= 6 ? 3 : g.combo >= 3 ? 2 : 1;
      g.addScore(5 * mult, hp.x, hp.y - L.cell * 0.9);
      if (g.combo === 3 || g.combo === 6 || g.combo === 10 || (g.combo > 10 && g.combo % 5 === 0)) {
        // 飘在句子条和棋盘的交界处：别盖住棋盘中间正要挑选的词块
        g.float('连击×' + g.combo + '！', g.w / 2, L.barY + L.barH + Math.round(6 * L.u), { color: g.combo >= 10 ? '#E3B3FF' : '#FFB347', size: Math.round(32 * L.u) });
        g.sfx('combo');
      }
      g.sfx('chomp');
      g.burst(hp.x, hp.y, { kind: 'dot', color: b.col, n: 12 });
      g.burst(hp.x, hp.y, { kind: 'star', n: 6 });
      g.ring(hp.x, hp.y, '#FFE45C');
      const tg = chipTarget(pos);
      S.flyers.push({ text: disp(b.k), x0: p.x, y0: p.y, x1: tg.x, y1: tg.y, t0: S.vt, dur: 0.5, pos, col: b.tint });
      if (Q.eaten.length === Q.tiles.length) complete();
    }
    function eatWrong(b) {
      const Q = S.Q, pos = Q.eaten.length;
      const got = Q.tiles[b.k].t, exp = expected();
      const note = '正确：' + Q.ansFull + '（第 ' + (pos + 1) + (Q.para ? ' 句' : ' 块') + '应是“' + exp.join('”或“') + '”，你吃了“' + got + '”）';
      Q.wrongs++;
      const hp = headPx();
      g.burst(hp.x, hp.y, { kind: 'ink', n: 16 });
      g.sfx('bad');
      S.hurtT = S.vt; S.barShake = S.vt;
      g.wrong(Q.it, note, hp.x, hp.y);
      if (g.state !== 'play') return;
      const from = blockPx(b);
      b.alive = false;
      const sp = findSpot(b.kx, b.ky, b);
      b.alive = true;
      if (sp) { b.x = sp.x; b.y = sp.y; }
      ensureReachable();   // 弹到的新位置别被蛇身 / 榴莲围死
      b.fly = { t0: S.vt, dur: 0.6, fx: from.x, fy: from.y };
      if (S.cf.hints || Q.wrongs >= 2) S.blocks.forEach((o) => { if (o.alive && allowed(o.k)) o.hint = S.vt + 4; });
    }
    function complete() {
      const Q = S.Q;
      Q.done = true; Q.doneT = S.vt + 0.5;
      freeze();
      S.mode = 'party'; S.partyT = S.vt;
      const text = sentenceNow();
      const bx = L.barX + L.barW / 2, by = L.barY + L.barH / 2;
      S.speedUp += 0.12;
      S.idle = 0;
      // 整句大横幅：句子条会被引擎的“连击×N / 真棒”飘字盖住，棋盘中央再亮一次整句（边读边看）。
      // 以前固定 2.5 秒就收走：P6 二十多字的长句只露 1 秒多，孩子来不及读，朗读也被下一句打断。
      // 现在：横幅一直亮到朗读读完（没朗读时按字数给时间，最长 6.5 秒）；1.3 秒后按方向 / 点一下可直接跳到下一句。
      // 最后一句：先把整句读完 / 看完，再算分过关（g.right 会立刻触发引擎的“过关啦”，朗读会被结算页掐断）
      const last = g.done + 1 >= g.rounds;
      const P = S.party = { t0: S.vt, ended: false, said: !!Q.para, timeUp: false, last, item: Q.it, lx: bx, ly: by + L.barH * 0.7 };
      S.banner = Q.para
        ? { text: Q.eaten.map((k) => Q.labels[k]).join(' → '), font: 'round', t0: S.vt + 0.3, pill: '✅ 顺序排对了' }
        : { text, font: 'kai', t0: S.vt + 0.3, pill: '🔊 大声读一读' };
      if (!last) g.right(Q.it, bx, by + L.barH * 0.7, g.pick(PRAISE));
      else { g.float(g.pick(PRAISE), bx, by + L.barH * 0.7 - 34, { color: '#FFE45C', size: 32 }); g.sfx('coin'); }
      // 编号题整段太长（一两百字），不读，免得读到下一题还没完
      if (!Q.para) g.say(text, { caption: '' }).then(() => { if (S.party !== P || P.ended) return; P.said = true; if (P.timeUp) endParty(false); });
      g.after(0.5, () => {
        g.sfx('match');
        g.burst(bx, by, { kind: 'confetti', n: 30 });
        g.burst(bx, by, { kind: 'star', n: 12 });
      });
      g.after(0.75, shrink);
      if (g.state === 'play') {
        const hold = Q.para ? PARTY_T : clamp(1.2 + Array.from(text).length * 0.14, PARTY_T, 6.5);
        g.after(hold, () => { if (S.party !== P || P.ended) return; P.timeUp = true; if (P.said || !g.speaking) endParty(false); });
        g.after(hold + 9, () => { if (S.party === P && !P.ended) endParty(true); });   // 朗读卡住的兜底
      }
    }
    /** 结束整句庆祝：横幅飞回句子条 → 下一句 */
    function endParty(stopTts) {
      const P = S.party;
      if (!P || P.ended) return;
      P.ended = true;
      if (stopTts && g.speaking) { try { g.ctx.tts.stop(); } catch (e) { /* ignore */ } }
      if (S.banner) S.banner.outT = S.vt;
      g.after(0.4, () => {
        if (S.party !== P) return;
        S.party = null;
        if (P.last) { g.right(P.item, P.lx, P.ly, '过关！'); return; }
        S.qi++; if (S.qi < S.list.length) startQuestion();
      });
    }
    function shrink() {
      if (S.seg.length > 3) {
        const i = S.seg.length - 1, p = S.pts && S.pts[i];
        S.seg.pop(); if (S.prev.length > S.seg.length) S.prev.length = S.seg.length;
        if (p) {
          const tg = S.tags.find((t, j) => 2 + 2 * j === i);
          g.burst(L.bx + mod(p.x - L.bx, L.bw), L.by + mod(p.y - L.by, L.bh), { kind: tg ? 'dot' : 'star', color: tg ? tg.col : undefined, n: tg ? 8 : 3 });
        }
        if (!(S.popSfx++ % 3)) g.sfx('pop');
        g.after(0.055, shrink);
      } else { S.tags = []; S.grow = 0; }
    }

    /* ================= 螃蟹 ================= */
    function placeCrabs() {
      S.crabs = [];
      for (let i = 0; i < S.cf.crabs; i++) {
        const hr = mod(S.seg[0].y, L.rows);
        const sp = findSpot(1, 1, null, (x, y) => Math.abs(y - hr) >= 2 && y > 0 && y < L.rows - 1 && !S.crabs.some((c) => c.y === y));
        if (sp) S.crabs.push({ x: sp.x, y: sp.y, px: sp.x, py: sp.y, dx: Math.random() < 0.5 ? -1 : 1, t: 0 });
      }
    }
    function crabBlocked(cr, x, y) {
      if (x < 0 || x >= L.cols) return true;
      if (durianAt(x, y) || blockAt(x, y) || bonusAt(x, y)) return true;
      if (S.crabs.some((o) => o !== cr && o.x === x && o.y === y)) return true;
      return bodyAt(x, y, 1, false);
    }
    function crabTick(dt) {
      const step = S.cf.crabStep;
      for (const cr of S.crabs) {
        cr.t += dt;
        if (cr.t < step) continue;
        cr.t -= step; cr.px = cr.x; cr.py = cr.y;
        let nx = cr.x + cr.dx;
        if (crabBlocked(cr, nx, cr.y)) { cr.dx = -cr.dx; nx = cr.x + cr.dx; if (crabBlocked(cr, nx, cr.y)) nx = cr.x; }
        if (nx !== cr.x && cellEq(S.seg[0], nx, cr.y)) { cr.dx = -cr.dx; if (S.mode === 'move') crash('crab'); return; }
        cr.x = nx;
      }
    }
    function placeDurians() {
      S.durians = [];
      for (let i = 0; i < S.cf.durians; i++) {
        const hr = mod(S.seg[0].y, L.rows);
        const sp = findSpot(1, 1, null, (x, y) => x > 0 && y > 0 && x < L.cols - 1 && y < L.rows - 1 && y !== hr &&
          !S.durians.some((d) => Math.max(Math.abs(d.x - x), Math.abs(d.y - y)) < 3));
        if (sp) S.durians.push({ x: sp.x, y: sp.y, ph: g.rand(0, 6.28) });
      }
    }

    /* ================= 句子条 ================= */
    function barTexts(filled) {
      const Q = S.Q, n = Q.tiles.length, out = [];
      for (let i = 0; i < n; i++) out.push(i < filled ? disp(Q.eaten[i]) : '?');
      if (Q.done && filled >= n && !Q.para && Q.suffix) out[n - 1] += Q.suffix;
      return out;
    }
    function chipTarget(pos) {
      const lay = chipLayout(barTexts(pos + 1), L.bf, L.barInner);
      const c = lay.chips[pos];
      const ox = L.barX + L.barPad + L.iconW, oy = L.barY + L.barPad + ((L.barH - L.barPad * 2) - (lay.lines * lay.ch + (lay.lines - 1) * lay.lg)) / 2;
      return { x: ox + c.x + c.w / 2, y: oy + c.y + c.h / 2 };
    }

    /* ================= 绘制 ================= */
    function boardCache() {
      const dpr = g.dpr || 1;
      const key = [L.bw, L.bh, L.cell, L.fr, dpr, S.cf.wrap ? 1 : 0].join('|');
      if (S.bc && S.bc.key === key) return S.bc;
      const pad = L.fr + 10, Wd = L.bw + pad * 2, Hd = L.bh + pad * 2;
      const cv = D.createElement('canvas');
      cv.width = Math.ceil(Wd * dpr); cv.height = Math.ceil(Hd * dpr);
      const x = cv.getContext('2d');
      x.setTransform(dpr, 0, 0, dpr, 0, 0);
      const fr = L.fr, R = Math.round(L.cell * 0.5);
      const rr = (X, Y, w, h, r) => { x.beginPath(); x.moveTo(X + r, Y); x.arcTo(X + w, Y, X + w, Y + h, r); x.arcTo(X + w, Y + h, X, Y + h, r); x.arcTo(X, Y + h, X, Y, r); x.arcTo(X, Y, X + w, Y, r); x.closePath(); };
      // 投影 + 外框
      rr(pad - fr, pad - fr + 6, L.bw + fr * 2, L.bh + fr * 2, R + fr); x.fillStyle = 'rgba(29,43,83,.45)'; x.fill();
      rr(pad - fr, pad - fr, L.bw + fr * 2, L.bh + fr * 2, R + fr);
      if (S.cf.wrap) {
        const gr = x.createLinearGradient(0, pad - fr, 0, pad + L.bh + fr); gr.addColorStop(0, '#7FD8F7'); gr.addColorStop(1, '#3FB2E6');
        x.fillStyle = gr; x.fill();
      } else {
        const gr = x.createLinearGradient(0, pad - fr, 0, pad + L.bh + fr); gr.addColorStop(0, '#3FA548'); gr.addColorStop(1, '#2C8A3B');
        x.fillStyle = gr; x.fill();
      }
      x.lineWidth = 3; x.strokeStyle = NAVY; x.stroke();
      if (!S.cf.wrap) {   // 篱笆：一圈圆圆的小灌木
        const per = [];
        const stepL = fr * 1.25;
        const addLine = (x0, y0, x1, y1) => { const len = Math.hypot(x1 - x0, y1 - y0), n = Math.max(2, Math.round(len / stepL)); for (let i = 0; i < n; i++) per.push([lerp(x0, x1, i / n), lerp(y0, y1, i / n)]); };
        const a = pad - fr / 2, b = pad + L.bw + fr / 2, c0 = pad - fr / 2, d0 = pad + L.bh + fr / 2;
        addLine(a + R, c0, b - R, c0); addLine(b, c0 + R, b, d0 - R); addLine(b - R, d0, a + R, d0); addLine(a, d0 - R, a, c0 + R);
        per.forEach(([px, py], i) => {
          x.fillStyle = i % 2 ? '#4DB851' : '#56C25A';
          x.beginPath(); x.arc(px, py, fr * 0.62, 0, Math.PI * 2); x.fill();
          x.fillStyle = 'rgba(255,255,255,.28)'; x.beginPath(); x.arc(px - fr * 0.18, py - fr * 0.2, fr * 0.22, 0, Math.PI * 2); x.fill();
          if (i % 7 === 3) { x.fillStyle = '#FF6B8B'; x.beginPath(); x.arc(px + fr * 0.2, py + fr * 0.1, fr * 0.17, 0, Math.PI * 2); x.fill(); }
        });
      }
      // 草坪棋盘格
      x.save();
      rr(pad, pad, L.bw, L.bh, R * 0.6); x.clip();
      for (let yy = 0; yy < L.rows; yy++) for (let xx = 0; xx < L.cols; xx++) {
        x.fillStyle = (xx + yy) % 2 ? '#A3D656' : '#B2E061';
        x.fillRect(pad + xx * L.cell, pad + yy * L.cell, L.cell + 0.5, L.cell + 0.5);
      }
      // 小草叶点缀
      x.strokeStyle = 'rgba(60,140,50,.35)'; x.lineWidth = Math.max(1.2, L.cell * 0.05); x.lineCap = 'round';
      for (let i = 0; i < L.cols * L.rows; i += 7) {
        const xx = (i * 37) % L.cols, yy = Math.floor(i / L.cols) % L.rows;
        const px = pad + (xx + 0.3 + ((i * 13) % 5) / 12) * L.cell, py = pad + (yy + 0.75) * L.cell, k = L.cell * 0.16;
        x.beginPath(); x.moveTo(px, py); x.lineTo(px - k * 0.5, py - k); x.moveTo(px, py); x.lineTo(px + k * 0.1, py - k * 1.3); x.moveTo(px, py); x.lineTo(px + k * 0.6, py - k * 0.9); x.stroke();
      }
      const sh = x.createLinearGradient(0, pad, 0, pad + L.cell * 0.5); sh.addColorStop(0, 'rgba(29,43,83,.22)'); sh.addColorStop(1, 'rgba(29,43,83,0)');
      x.fillStyle = sh; x.fillRect(pad, pad, L.bw, L.cell * 0.5);
      x.restore();
      rr(pad, pad, L.bw, L.bh, R * 0.6); x.lineWidth = 2.5; x.strokeStyle = NAVY; x.stroke();
      S.bc = { key, cv, pad, w: Wd, h: Hd };
      return S.bc;
    }
    function drawBoard(c) {
      const bc = boardCache();
      c.drawImage(bc.cv, L.bx - bc.pad, L.by - bc.pad, bc.w, bc.h);
      if (S.cf.wrap) {   // 穿墙关：边框是流动的小河
        const fr = L.fr, R = Math.round(L.cell * 0.5) + fr / 2;
        c.save();
        c.setLineDash([L.cell * 0.34, L.cell * 0.3]); c.lineDashOffset = -S.vt * 26;
        c.strokeStyle = 'rgba(255,255,255,.8)'; c.lineWidth = Math.max(2, fr * 0.24); c.lineCap = 'round';
        g.rrect(L.bx - fr / 2, L.by - fr / 2, L.bw + fr, L.bh + fr, R, null, 'rgba(255,255,255,.8)', Math.max(2, fr * 0.24));
        c.restore();
      }
    }
    function drawDurian(c, x, y, r, t, ph) {
      c.save();
      c.translate(x, y + Math.sin(t * 2 + ph) * r * 0.04);
      c.rotate(Math.sin(t * 1.3 + ph) * 0.06);
      c.fillStyle = 'rgba(29,43,83,.3)'; c.beginPath(); c.ellipse(0, r * 0.95, r * 0.9, r * 0.25, 0, 0, Math.PI * 2); c.fill();
      c.beginPath();
      const n = 14;
      for (let i = 0; i < n * 2; i++) {
        const a = (i / (n * 2)) * Math.PI * 2, rr = i % 2 ? r * 0.82 : r * 1.08;
        const px = Math.cos(a) * rr, py = Math.sin(a) * rr * 0.92;
        if (i) c.lineTo(px, py); else c.moveTo(px, py);
      }
      c.closePath();
      const gr = c.createRadialGradient(-r * 0.3, -r * 0.35, r * 0.1, 0, 0, r * 1.1);
      gr.addColorStop(0, '#E3EE7A'); gr.addColorStop(0.6, '#A9C63F'); gr.addColorStop(1, '#6E9A2C');
      c.fillStyle = gr; c.fill();
      c.lineWidth = 2.2; c.strokeStyle = NAVY; c.lineJoin = 'round'; c.stroke();
      c.fillStyle = 'rgba(80,110,30,.55)';
      for (let i = 0; i < 7; i++) {
        const a = i * 2.3 + 0.4, d = r * (0.25 + (i % 3) * 0.17), px = Math.cos(a) * d, py = Math.sin(a) * d;
        c.beginPath(); c.moveTo(px, py - r * 0.12); c.lineTo(px + r * 0.09, py + r * 0.07); c.lineTo(px - r * 0.09, py + r * 0.07); c.closePath(); c.fill();
      }
      c.fillStyle = '#8A5A2B'; c.strokeStyle = NAVY; c.lineWidth = 1.6;
      c.beginPath(); c.rect(-r * 0.09, -r * 1.22, r * 0.18, r * 0.32); c.fill(); c.stroke();
      c.restore();
    }
    function drawBlock(c, b) {
      const cs = L.cell, w = b.kx * cs, h = b.ky * cs;
      let x = L.bx + b.x * cs + w / 2, y = L.by + b.y * cs + h / 2, sc = 1, rot = 0;
      const age = S.vt - b.born;
      if (age < 0) return;
      if (age < 0.4) sc = outBack(age / 0.4);
      if (b.fly) {
        const t = (S.vt - b.fly.t0) / b.fly.dur;
        if (t >= 1) b.fly = null;
        else {
          const e = outCubic(t);
          x = lerp(b.fly.fx, x, e); y = lerp(b.fly.fy, y, e) - Math.sin(Math.PI * t) * cs * 2.2;
          rot = (1 - e) * Math.PI * 2 * (b.k % 2 ? 1 : -1); sc *= 0.8 + 0.2 * e;
        }
      }
      if (b.dying != null) {
        const t = (S.vt - b.dying) / 0.26;
        if (t >= 1) return;
        const hp = headPx();
        x = lerp(x, hp.x, t); y = lerp(y, hp.y, t); sc *= 1 - t;
      }
      const bob = Math.sin(S.vt * 2.6 + b.ph) * cs * 0.05;
      c.save();
      c.translate(x, y + bob);
      if (rot) c.rotate(rot);
      if (sc !== 1) c.scale(sc, sc);
      const ins = cs * 0.07, bw = w - ins * 2, bh = h - ins * 2, r = Math.min(bh / 2, cs * 0.44);
      if (b.hint > S.vt && b.alive) {
        const k = 0.5 + 0.5 * Math.sin(S.vt * 9);
        g.rrect(-bw / 2 - 5 - k * 4, -bh / 2 - 5 - k * 4, bw + 10 + k * 8, bh + 10 + k * 8, r + 8, 'rgba(255,228,92,' + (0.35 + 0.35 * k) + ')');
      }
      g.rrect(-bw / 2, -bh / 2 + 4, bw, bh, r, 'rgba(29,43,83,.38)');
      g.rrect(-bw / 2, -bh / 2, bw, bh, r, b.tint, NAVY, 2.6);
      g.rrect(-bw / 2 + 5, -bh / 2 + 3, bw - 10, Math.min(bh * 0.34, cs * 0.3), r * 0.6, 'rgba(255,255,255,.6)');
      const fx = -bw / 2 + cs * 0.4;
      g.emoji(b.fruit, fx, -cs * 0.02, cs * 0.72, { rot: Math.sin(S.vt * 3 + b.ph) * 0.16 });
      const fs = Math.max(11, Math.round(cs * b.fsr));
      const tl = fx + cs * 0.4, tr = bw / 2 - cs * 0.14, tcx = (tl + tr) / 2, tmax = tr - tl;
      const lh = fs * 1.18;
      b.lines.forEach((ln, i) => {
        g.text(ln, tcx, (i - (b.lines.length - 1) / 2) * lh + fs * 0.04, { size: fs, font: S.Q.para ? 'round' : 'kai', weight: S.Q.para ? 800 : KW, color: NAVY, maxW: tmax });
      });
      c.restore();
      if (b.hint > S.vt && b.alive && !b.fly) {   // 最上一行的果子：手指放到下面往上指，别伸出棋盘压到句子条
        if (b.y > 0) g.emoji('👇', x, y - h / 2 - cs * 0.45 + Math.sin(S.vt * 8) * cs * 0.12, cs * 0.7);
        else g.emoji('👆', x, y + h / 2 + cs * 0.45 - Math.sin(S.vt * 8) * cs * 0.12, cs * 0.7);
      }
    }
    /** 蛇身关键点（像素，未取模的连续坐标） */
    function snakePts() {
      const n = S.seg.length, cs = L.cell, p = S.mode === 'move' ? clamp(S.moveT, 0, 1) : 0;
      const pts = S.pts && S.pts.length === n ? S.pts : (S.pts = S.seg.map(() => ({ x: 0, y: 0 })));
      const wig = S.mode === 'party' ? 0.16 : S.mode === 'wait' ? 0.07 : S.mode === 'move' ? 0.05 : 0;
      for (let i = 0; i < n; i++) {
        const a = S.prev[i] || S.seg[i], b = S.seg[i];
        let gx = lerp(a.x, b.x, p), gy = lerp(a.y, b.y, p);
        if (wig && i > 0) {
          const q = S.seg[Math.max(0, i - 1)], r = S.seg[Math.min(n - 1, i + 1)];
          let tx = q.x - r.x, ty = q.y - r.y; const len = Math.hypot(tx, ty) || 1; tx /= len; ty /= len;
          const k = Math.sin(S.vt * (S.mode === 'party' ? 12 : 5) - i * 0.9) * wig * Math.min(1, i / 2);
          gx += -ty * k; gy += tx * k;
        }
        pts[i].x = L.bx + (gx + 0.5) * cs; pts[i].y = L.by + (gy + 0.5) * cs;
      }
      if (S.bump) {   // 撞墙回弹
        const t = (S.vt - S.bump.t0) / 0.3;
        if (t < 1) { const k = Math.sin(Math.PI * t) * cs * 0.3; pts[0].x += DV[S.bump.d][0] * k; pts[0].y += DV[S.bump.d][1] * k; } else S.bump = null;
      }
      return pts;
    }
    function drawSnakeAt(c, pts, ox, oy) {
      const n = pts.length, cs = L.cell;
      const hurt = S.hurtT != null && S.vt - S.hurtT < 0.6 && Math.floor((S.vt - S.hurtT) * 12) % 2 === 0;
      const stun = S.mode === 'stun';
      const party = S.mode === 'party' && S.vt - S.partyT < 2;
      const hue = party ? (S.vt * 240) % 360 : 0;
      const main = hurt ? '#FF6B6B' : party ? 'hsl(' + hue + ',85%,58%)' : '#4C8DF6';
      const light = hurt ? '#FFB3B3' : party ? 'hsl(' + hue + ',90%,76%)' : '#9CC6FF';
      // 身体粗细：脖子粗、尾巴细；吃到东西后一个“鼓包”顺着身体往后走
      const gulp = S.gulpT != null ? (S.vt - S.gulpT) * 14 : -99;
      const wAt = (i) => cs * (0.8 - 0.34 * Math.pow(i / Math.max(1, n - 1), 1.3)) * (1 + 0.28 * Math.max(0, 1 - Math.abs(i - gulp) / 1.3));
      c.lineCap = 'round'; c.lineJoin = 'round';
      const pass = (col, extra, dy, scale) => {
        c.strokeStyle = col;
        for (let i = n - 1; i >= 1; i--) {
          c.lineWidth = wAt(i) * scale + extra;
          c.beginPath(); c.moveTo(pts[i].x + ox, pts[i].y + oy + dy); c.lineTo(pts[i - 1].x + ox, pts[i - 1].y + oy + dy); c.stroke();
        }
      };
      pass(NAVY, 5, 2.5, 1);     // 投影 + 描边
      pass(NAVY, 5, 0, 1);
      pass(main, 0, 0, 1);
      pass(light, 0, -cs * 0.12, 0.34);
      // 斑点
      c.fillStyle = hurt ? '#FFE0E0' : '#FFD84D';
      for (let i = 1; i < n; i += 2) { const r = wAt(i) * 0.14; c.beginPath(); c.arc(pts[i].x + ox, pts[i].y + oy + cs * 0.06, r, 0, Math.PI * 2); c.fill(); }
      // 挂在身上的果子（吃到的词块）
      S.tags.forEach((tg, j) => {
        const i = 2 + 2 * j; if (i >= n) return;
        const a = Math.min(1, (S.vt - tg.born) / 0.3);
        g.emoji(tg.fruit, pts[i].x + ox, pts[i].y + oy - cs * 0.04, cs * 0.58 * (0.6 + 0.4 * outBack(a)), { rot: Math.sin(S.vt * 4 + j) * 0.2 });
      });
      // 头
      const hx = pts[0].x + ox, hy = pts[0].y + oy;
      let ang = Math.atan2(pts[0].y - pts[1].y, pts[0].x - pts[1].x);
      if (!(Math.abs(pts[0].y - pts[1].y) + Math.abs(pts[0].x - pts[1].x) > 0.5)) ang = Math.atan2(DV[S.dir][1], DV[S.dir][0]);
      const hr = cs * 0.52 * (S.gulpT != null && S.vt - S.gulpT < 0.18 ? 1 + 0.18 * Math.sin(Math.PI * (S.vt - S.gulpT) / 0.18) : 1);
      c.save(); c.translate(hx, hy); c.rotate(ang);
      c.fillStyle = NAVY; c.beginPath(); c.ellipse(0, 2.5, hr * 1.02 + 2.5, hr * 0.9 + 2.5, 0, 0, Math.PI * 2); c.fill();
      c.fillStyle = main; c.beginPath(); c.ellipse(0, 0, hr * 1.02, hr * 0.9, 0, 0, Math.PI * 2); c.fill();
      c.lineWidth = 2.5; c.strokeStyle = NAVY; c.stroke();
      c.fillStyle = 'rgba(255,255,255,.3)'; c.beginPath(); c.ellipse(-hr * 0.1, -hr * 0.45, hr * 0.5, hr * 0.2, 0, 0, Math.PI * 2); c.fill();
      // 嘴：前面是词块就张嘴
      const h0 = S.seg[0], ax = mod(h0.x + DV[S.dir][0], L.cols), ay = mod(h0.y + DV[S.dir][1], L.rows);
      const open = S.mode === 'move' && !!blockAt(ax, ay);
      S.mouth = lerp(S.mouth || 0, open ? 1 : 0, 0.25);
      if (S.mouth > 0.05) {
        c.fillStyle = '#7A1F3D'; c.beginPath(); c.ellipse(hr * 0.72, 0, hr * 0.32 * S.mouth, hr * 0.42 * S.mouth, 0, 0, Math.PI * 2); c.fill();
        c.fillStyle = '#FF7A9A'; c.beginPath(); c.ellipse(hr * 0.78, hr * 0.12 * S.mouth, hr * 0.16 * S.mouth, hr * 0.14 * S.mouth, 0, 0, Math.PI * 2); c.fill();
      } else if (S.mode === 'move' && (S.vt % 2.1) < 0.28) {   // 吐信子
        const k = Math.sin(((S.vt % 2.1) / 0.28) * Math.PI);
        c.strokeStyle = '#E8344E'; c.lineWidth = Math.max(1.8, cs * 0.06); c.lineCap = 'round';
        c.beginPath(); c.moveTo(hr * 0.9, 0); c.lineTo(hr * (0.9 + 0.55 * k), 0);
        c.lineTo(hr * (1.05 + 0.6 * k), -hr * 0.16 * k); c.moveTo(hr * (0.9 + 0.55 * k), 0); c.lineTo(hr * (1.05 + 0.6 * k), hr * 0.16 * k); c.stroke();
      }
      // 腮红
      c.fillStyle = 'rgba(255,120,150,.45)';
      c.beginPath(); c.arc(hr * 0.1, -hr * 0.62, hr * 0.16, 0, Math.PI * 2); c.arc(hr * 0.1, hr * 0.62, hr * 0.16, 0, Math.PI * 2); c.fill();
      // 眼睛
      const blink = !stun && (S.vt % 3.3) < 0.12;
      [-1, 1].forEach((sd) => {
        const ex = hr * 0.32, ey = sd * hr * 0.38;
        if (stun) {
          c.strokeStyle = NAVY; c.lineWidth = 2.4; const k = hr * 0.16;
          c.beginPath(); c.moveTo(ex - k, ey - k); c.lineTo(ex + k, ey + k); c.moveTo(ex + k, ey - k); c.lineTo(ex - k, ey + k); c.stroke();
        } else if (blink) {
          c.strokeStyle = NAVY; c.lineWidth = 2.4; c.beginPath(); c.moveTo(ex, ey - hr * 0.2); c.lineTo(ex, ey + hr * 0.2); c.stroke();
        } else {
          c.fillStyle = '#FFFFFF'; c.beginPath(); c.arc(ex, ey, hr * 0.27, 0, Math.PI * 2); c.fill();
          c.lineWidth = 2; c.strokeStyle = NAVY; c.stroke();
          c.fillStyle = NAVY; c.beginPath(); c.arc(ex + hr * 0.08, ey, hr * 0.14, 0, Math.PI * 2); c.fill();
          c.fillStyle = '#FFFFFF'; c.beginPath(); c.arc(ex + hr * 0.12, ey - hr * 0.06, hr * 0.05, 0, Math.PI * 2); c.fill();
        }
      });
      c.restore();
      if (stun) {   // 晕乎乎的小星星
        for (let i = 0; i < 3; i++) {
          const a = S.vt * 5 + i * 2.09;
          g.emoji('⭐', hx + Math.cos(a) * cs * 0.6, hy - cs * 0.55 + Math.sin(a) * cs * 0.22, cs * 0.34);
        }
      }
    }
    function drawSnake(c) {
      const pts = snakePts();
      if (!S.cf.wrap) { drawSnakeAt(c, pts, 0, 0); return; }
      let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
      pts.forEach((p) => { x0 = Math.min(x0, p.x); x1 = Math.max(x1, p.x); y0 = Math.min(y0, p.y); y1 = Math.max(y1, p.y); });
      const m = L.cell;
      c.save();
      c.beginPath(); c.rect(L.bx, L.by, L.bw, L.bh); c.clip();
      for (const oy of [-L.bh, 0, L.bh]) for (const ox of [-L.bw, 0, L.bw]) {
        if (x1 + ox < L.bx - m || x0 + ox > L.bx + L.bw + m || y1 + oy < L.by - m || y0 + oy > L.by + L.bh + m) continue;
        drawSnakeAt(c, pts, ox, oy);
      }
      c.restore();
    }
    function drawBar(c) {
      const Q = S.Q, bf = L.bf;
      let shx = 0;
      if (S.barShake != null && S.vt - S.barShake < 0.4) shx = Math.sin((S.vt - S.barShake) * 70) * 7 * (1 - (S.vt - S.barShake) / 0.4);
      const X = L.barX + shx, Y = L.barY, Wd = L.barW, Hd = L.barH;
      const done = Q.done && Q.landed >= Q.tiles.length;
      if (done) {
        const k = 0.5 + 0.5 * Math.sin(S.vt * 8);
        g.rrect(X - 5 - k * 3, Y - 5 - k * 3, Wd + 10 + k * 6, Hd + 10 + k * 6, 22, 'rgba(255,214,64,' + (0.45 + 0.3 * k) + ')');
      }
      g.rrect(X, Y + 5, Wd, Hd, 18, NAVY);
      g.rrect(X, Y, Wd, Hd, 18, done ? '#E6FAD8' : '#FFFBEF', NAVY, 3);
      g.rrect(X + 6, Y + 4, Wd - 12, Math.min(14, Hd * 0.25), 10, 'rgba(255,255,255,.7)');
      // 左边小图标
      const ix = X + L.barPad + bf * 0.7;
      g.emoji(done ? '✅' : Q.para ? '📜' : '📝', ix, Y + Hd / 2, bf * 1.15, { rot: Math.sin(S.vt * 2) * 0.08 });
      const texts = barTexts(Q.landed);
      const lay = chipLayout(texts, bf, L.barInner);
      const ox = X + L.barPad + L.iconW, oy = Y + L.barPad + ((Hd - L.barPad * 2) - (lay.lines * lay.ch + (lay.lines - 1) * lay.lg)) / 2;
      const next = Q.landed;
      lay.chips.forEach((ch, i) => {
        const x = ox + ch.x, y = oy + ch.y;
        if (ch.t === '?') {
          const pulse = i === next && !Q.done ? 1 + 0.07 * Math.sin(S.vt * 7) : 1;
          c.save(); c.translate(x + ch.w / 2, y + ch.h / 2); c.scale(pulse, pulse);
          c.save(); c.setLineDash([5, 4]);
          g.rrect(-ch.w / 2, -ch.h / 2, ch.w, ch.h, 10, i === next ? 'rgba(255,201,40,.28)' : 'rgba(29,43,83,.06)', i === next ? '#E09A00' : 'rgba(29,43,83,.45)', 2);
          c.restore();
          g.text(i === next && Q.para ? '第' + (i + 1) : '?', 0, 1, { size: Math.round(bf * (i === next && Q.para ? 0.62 : 0.9)), font: 'round', weight: 800, color: i === next ? '#C07A00' : 'rgba(29,43,83,.4)' });
          c.restore();
          return;
        }
        const lt = S.landT[i];
        let sc = 1;
        if (lt != null && S.vt - lt < 0.35) sc = 1 + 0.25 * Math.sin(Math.PI * (S.vt - lt) / 0.35);
        c.save(); c.translate(x + ch.w / 2, y + ch.h / 2); c.scale(sc, sc);
        g.rrect(-ch.w / 2, -ch.h / 2 + 3, ch.w, ch.h, 10, 'rgba(29,43,83,.5)');
        g.rrect(-ch.w / 2, -ch.h / 2, ch.w, ch.h, 10, done ? '#9BE37A' : '#FFE08A', NAVY, 2.2);
        g.text(ch.t, 0, 1, { size: bf, font: Q.para ? 'round' : 'kai', weight: Q.para ? 800 : KW, color: NAVY, maxW: ch.w - 6 });
        c.restore();
      });
    }
    /** 整句完成的大横幅：弹出 → 停留（朗读 / 孩子自己读）→ 缩小飞回句子条 */
    function drawBanner(c) {
      const B = S.banner;
      if (!B || !B.text || !S.Q) return;
      const t = S.vt - B.t0;
      if (t < 0) return;
      const OUT = 0.4;
      if (B.outT != null && S.vt - B.outT >= OUT) { S.banner = null; return; }
      const font = B.font || 'kai';
      if (!B.lay || B.lay.cell !== L.cell || B.lay.bw !== L.bw) {
        const maxW = Math.min(L.bw - L.cell * 0.5, Math.round(600 * L.u));
        let fs = clamp(Math.round(L.cell * 0.82), 20, 40), lines = [];
        for (;;) {
          lines = g.wrapText(B.text, maxW - fs * 1.2, fs, font);
          if (lines.length <= 3 || fs <= 15) break;
          fs -= 2;
        }
        let tw = 0;
        lines.forEach((ln) => { tw = Math.max(tw, g.measure(ln, fs, font, KW)); });
        const lh = Math.round(fs * 1.34), pill = Math.round(clamp(fs * 0.62, 14, 20));
        const w = Math.min(maxW, Math.max(tw + fs * 1.2, pill * 9)), h = lines.length * lh + Math.round(fs * 0.9) + pill;
        B.lay = { cell: L.cell, bw: L.bw, fs, lines, lh, pill, w, h };
      }
      const Y = B.lay;
      let sc = t < 0.38 ? outBack(t / 0.38) : 1, a = 1;
      let x = L.bx + L.bw / 2, y = L.by + L.bh * 0.42;
      if (B.outT != null) {   // 缩小飞回句子条
        const k = outCubic(clamp((S.vt - B.outT) / OUT, 0, 1));
        x = lerp(x, L.barX + L.barW / 2, k); y = lerp(y, L.barY + L.barH / 2, k);
        sc = 1 - 0.65 * k; a = 1 - k;
      }
      c.save();
      c.globalAlpha = a;
      c.translate(x, y); c.rotate(Math.sin(t * 3.2) * 0.02); c.scale(sc, sc);
      const w = Y.w, h = Y.h, r = Math.round(Y.fs * 0.6);
      // 光芒
      const k = 0.5 + 0.5 * Math.sin(S.vt * 7);
      g.rrect(-w / 2 - 8 - k * 5, -h / 2 - 8 - k * 5, w + 16 + k * 10, h + 16 + k * 10, r + 10, 'rgba(255,228,92,' + (0.4 + 0.3 * k) + ')');
      g.rrect(-w / 2, -h / 2 + 6, w, h, r, NAVY);
      g.rrect(-w / 2, -h / 2, w, h, r, '#FFFBEF', NAVY, 3);
      g.rrect(-w / 2 + 8, -h / 2 + 5, w - 16, Math.min(16, h * 0.18), 10, 'rgba(255,255,255,.8)');
      // 顶上的绿色小牌子
      const pf = Y.pill, pt = B.pill || '🔊 大声读一读', pw = g.measure(pt, pf, 'round') + pf * 1.6, ph = pf * 1.75;
      g.rrect(-pw / 2, -h / 2 - ph * 0.55 + 3, pw, ph, ph / 2, NAVY);
      g.rrect(-pw / 2, -h / 2 - ph * 0.55, pw, ph, ph / 2, '#45C35E', NAVY, 2.5);
      g.text(pt, 0, -h / 2 - ph * 0.55 + ph / 2 + 1, { size: pf, font: 'round', color: '#FFFFFF', stroke: NAVY, strokeW: 3 });
      const top = -h / 2 + pf * 0.55 + Y.lh / 2 + Y.fs * 0.2;
      Y.lines.forEach((ln, i) => g.text(ln, 0, top + i * Y.lh, { size: Y.fs, font, weight: KW, color: NAVY, maxW: w - Y.fs * 0.8 }));
      g.emoji('⭐', -w / 2 + 4, -h / 2 + 4, Y.fs * 1.05, { rot: Math.sin(S.vt * 4) * 0.4 });
      g.emoji('⭐', w / 2 - 4, h / 2 - 4, Y.fs * 0.9, { rot: -Math.sin(S.vt * 4) * 0.4 });
      // 可以跳过了：底下一行小字提示
      const P = S.party;
      if (P && !P.ended && B.outT == null && S.vt - P.t0 >= PARTY_MIN && g.state === 'play') {
        const hf = Math.round(clamp(15 * L.u, 14, 19)), ht = S.touch ? '点一下，下一句 ▶' : '按方向键，下一句 ▶';
        const hw = g.measure(ht, hf, 'round') + hf * 1.6, hh = hf * 1.8, hy = h / 2 + hh * 0.5 + 12;
        const ka = Math.min(1, (S.vt - P.t0 - PARTY_MIN) / 0.3) * (0.75 + 0.25 * Math.sin(S.vt * 6));
        c.globalAlpha = a * ka;
        g.rrect(-hw / 2, hy - hh / 2, hw, hh, hh / 2, 'rgba(29,43,83,.82)');
        g.text(ht, 0, hy + 1, { size: hf, font: 'round', color: '#FFFFFF' });
      }
      c.restore();
    }
    /* ---------- 草坪上飞的小蝴蝶（纯装饰，画在词块下面，永远不挡字） ---------- */
    function drawFlies(c, dt) {
      if (!S.flies) {
        S.flies = [0, 1].map((i) => ({ x: g.rand(0.1, 0.9), y: g.rand(0.1, 0.9), a: g.rand(0, 6.28), ph: g.rand(0, 6.28), ch: i ? '🦋' : '🐝', s: i ? 0.62 : 0.5 }));
      }
      const W0 = Math.max(1, L.bw), H0 = Math.max(1, L.bh);
      S.flies.forEach((f, i) => {
        f.a += (Math.sin(S.vt * 0.7 + f.ph) * 1.1 + Math.sin(S.vt * 1.9 + i) * 0.5) * dt;
        const v = L.cell * (i ? 0.9 : 1.4);   // 像素/秒
        f.x += Math.cos(f.a) * v * dt / W0;
        f.y += Math.sin(f.a) * v * dt / H0;
        if (f.x < 0.04 || f.x > 0.96) { f.a = Math.PI - f.a; f.x = clamp(f.x, 0.04, 0.96); }
        if (f.y < 0.04 || f.y > 0.96) { f.a = -f.a; f.y = clamp(f.y, 0.04, 0.96); }
        const px = L.bx + f.x * W0, py = L.by + f.y * H0 + Math.sin(S.vt * 5 + f.ph) * L.cell * 0.12;
        const flap = i ? 0.45 + 0.55 * Math.abs(Math.sin(S.vt * 11 + f.ph)) : 1;
        c.save(); c.translate(px, py);
        c.fillStyle = 'rgba(29,43,83,.12)'; c.beginPath(); c.ellipse(0, L.cell * 0.45, L.cell * 0.18, L.cell * 0.07, 0, 0, Math.PI * 2); c.fill();
        c.scale(flap, 1);
        g.emoji(f.ch, 0, 0, L.cell * f.s, { flip: Math.cos(f.a) < 0, rot: Math.sin(S.vt * 9 + f.ph) * 0.12, alpha: 0.95 });
        c.restore();
      });
    }
    function drawLegend() {
      const Q = S.Q;
      if (!Q.para || !L.legH) return;
      const X = L.barX, Y = L.legY, Wd = L.legW, lf = L.lf, lh = Math.round(lf * 1.42);
      g.rrect(X, Y + 3, Wd, L.legH, 14, 'rgba(29,43,83,.35)');
      g.rrect(X, Y, Wd, L.legH, 14, 'rgba(255,251,239,.96)', NAVY, 2);
      let y = Y + lf * 0.45 + lh / 2;
      // 排完后按正确顺序重排：孩子能把整段按顺序再读一遍
      const order = Q.done && Q.eaten.length === Q.tiles.length ? Q.eaten.slice()
        : Q.tiles.map((t) => t.k).sort((a, b) => CIRC.indexOf(Q.labels[a]) - CIRC.indexOf(Q.labels[b]));
      order.forEach((k) => {
        const eaten = Q.eaten.indexOf(k) >= 0;
        const lines = g.wrapText(Q.tiles[k].t, Wd - lf * 2.2, lf, 'kai');
        g.text(Q.labels[k], X + lf * 0.95, y, { size: lf + 2, font: 'round', weight: 800, color: eaten ? '#3AA35A' : '#E0572B' });
        lines.forEach((ln, i) => g.text(ln, X + lf * 1.8, y + i * lh, { size: lf, font: 'kai', color: NAVY, align: 'left', alpha: eaten && !Q.done ? 0.4 : 1 }));
        if (eaten) g.text('✓', X + Wd - lf * 0.9, y, { size: lf + 4, font: 'round', weight: 800, color: '#3AA35A' });
        y += Math.max(1, lines.length) * lh;
      });
    }
    function drawPad(c) {
      const vd = S.mode === 'wait' && S.waitCrash ? validDirs() : null;
      for (const d of DIRS) {
        const b = L.btn[d];
        const pressed = S.pressT[d] != null && S.vt - S.pressT[d] < 0.13;
        const hint = (S.hint1 && S.mode === 'wait' && d === S.dir) || (vd && vd.indexOf(d) >= 0);
        const dy = pressed ? 4 : 0, sh = 5 * L.u;
        if (hint) {
          const k = 0.5 + 0.5 * Math.sin(S.vt * 8);
          g.rrect(b.x - 4 - k * 4, b.y - 4 - k * 4, b.w + 8 + k * 8, b.h + 8 + k * 8, 18, 'rgba(255,228,92,' + (0.4 + 0.4 * k) + ')');
        }
        if (!pressed) g.rrect(b.x, b.y + sh, b.w, b.h, 16, NAVY);
        g.rrect(b.x, b.y + dy, b.w, b.h, 16, hint ? '#FFE45C' : '#FFFFFF', NAVY, 3);
        g.rrect(b.x + 5, b.y + dy + 4, b.w - 10, b.h * 0.3, 10, 'rgba(255,255,255,.75)');
        const cxp = b.x + b.w / 2, cyp = b.y + dy + b.h / 2, a = Math.atan2(DV[d][1], DV[d][0]), k = Math.min(b.w, b.h) * 0.26;
        c.save(); c.translate(cxp, cyp); c.rotate(a);
        c.fillStyle = '#3AA0FF'; c.strokeStyle = NAVY; c.lineWidth = 2.5; c.lineJoin = 'round';
        c.beginPath(); c.moveTo(k, 0); c.lineTo(-k * 0.7, -k * 0.95); c.lineTo(-k * 0.7, k * 0.95); c.closePath(); c.fill(); c.stroke();
        c.restore();
      }
      if (L.land && !S.touch) {   // iPad 横屏没有键盘：不提示键盘
        const fs = Math.round(15 * L.u), t = '键盘 ← ↑ → ↓ 或 W A S D', tw = g.measure(t, fs, 'sans') + 24 * L.u, th = fs * 1.9;
        g.rrect(L.padCx - tw / 2, L.padBot + 16 * L.u, tw, th, th / 2, 'rgba(29,43,83,.78)');
        g.text(t, L.padCx, L.padBot + 16 * L.u + th / 2 + 1, { size: fs, font: 'sans', color: '#FFFFFF' });
      }
    }
    /** 蛇头说话的气泡：在头的上 / 下方找一个最不挡词块的位置 */
    function drawBubble(text, x, y) {
      const fs = Math.round(17 * L.u);
      const tw = g.measure(text, fs, 'round') + 26 * L.u, th = fs * 1.9;
      let best = null;
      // 撞墙后要露出头四周的绿色箭头：那四格重罚
      const keep = S.waitCrash ? DIRS.map((d) => ({ x: x + DV[d][0] * L.cell - L.cell / 2, y: y + DV[d][1] * L.cell - L.cell / 2 })) : [];
      for (const gap of [0.72, 1.55]) for (const above of [true, false]) {
        for (const sh of [0, -0.3, 0.3, -0.6, 0.6]) {
          const bx0 = clamp(x - tw / 2 + sh * tw, L.bx + 4, L.bx + L.bw - tw - 4);
          const by0 = above ? y - L.cell * gap - th : y + L.cell * gap;
          if (by0 < L.by + 2 || by0 + th > L.by + L.bh - 2) continue;
          let ov = Math.abs(sh) * 30 + (above ? 0 : 5) + (gap > 1 ? 40 : 0);
          keep.forEach((r) => {
            const ix = Math.min(bx0 + tw, r.x + L.cell) - Math.max(bx0, r.x), iy = Math.min(by0 + th, r.y + L.cell) - Math.max(by0, r.y);
            if (ix > 0 && iy > 0) ov += ix * iy * 4;
          });
          S.blocks.forEach((b) => {
            if (!b.alive) return;
            const rx = L.bx + b.x * L.cell, ry = L.by + b.y * L.cell, rw = b.kx * L.cell, rh = b.ky * L.cell;
            const ix = Math.min(bx0 + tw, rx + rw) - Math.max(bx0, rx), iy = Math.min(by0 + th, ry + rh) - Math.max(by0, ry);
            if (ix > 0 && iy > 0) ov += ix * iy;
          });
          if (!best || ov < best.ov) best = { bx: bx0, by: by0, above, ov, gap };
        }
      }
      if (!best) return;
      const bxp = best.bx, byp = best.by, above = best.above;
      const bob = Math.sin(S.vt * 4) * 2;
      g.rrect(bxp, byp + 3 + bob, tw, th, th / 2, 'rgba(29,43,83,.5)');
      g.rrect(bxp, byp + bob, tw, th, th / 2, '#FFFFFF', NAVY, 2.5);
      const c = g.c, tx = clamp(x, bxp + th / 2, bxp + tw - th / 2);
      c.fillStyle = '#FFFFFF'; c.strokeStyle = NAVY; c.lineWidth = 2.5;
      const tl = best.gap > 1 ? L.cell * 0.9 : 9;
      c.beginPath();
      if (above) { c.moveTo(tx - 7, byp + th - 1 + bob); c.lineTo(tx, byp + th + tl + bob); c.lineTo(tx + 7, byp + th - 1 + bob); }
      else { c.moveTo(tx - 7, byp + 1 + bob); c.lineTo(tx, byp - tl + bob); c.lineTo(tx + 7, byp + 1 + bob); }
      c.fill(); c.stroke();
      g.text(text, bxp + tw / 2, byp + th / 2 + bob + 1, { size: fs, font: 'round', color: NAVY });
    }
    function drawHints(c) {
      if (S.mode !== 'wait' || g.state === 'over') return;
      const hp = headPx();
      let msg;
      if (S.waitCrash) msg = '换个方向走！';
      else if (S.hint1) msg = S.touch ? '滑一滑，出发！' : L.land ? '按方向键出发！' : '点箭头出发！';
      else msg = '看好顺序，出发！';
      drawBubble(msg, hp.x, hp.y);
      if (S.hint1) {   // 闪烁的手指：沿着蛇头朝向滑动
        const t = (S.vt % 1.3) / 1.3, [dx, dy] = DV[S.dir];
        const fx = hp.x + dx * L.cell * (0.6 + 2.2 * outCubic(Math.min(1, t * 1.3))), fy = hp.y + dy * L.cell * (0.6 + 2.2 * outCubic(Math.min(1, t * 1.3))) + L.cell * 0.55;
        const a = t < 0.8 ? 1 : (1 - t) / 0.2;
        if (Math.floor(S.vt * 4) % 2 === 0 || t < 0.8) g.emoji('👆', fx, fy, L.cell * 1.05, { alpha: a });
      }
      if (S.waitCrash) {   // 能走的方向：绿色小箭头
        const k = 0.5 + 0.5 * Math.sin(S.vt * 8);
        validDirs().forEach((d) => {
          const [dx, dy] = DV[d], ax = hp.x + dx * L.cell * (0.95 + 0.12 * k), ay = hp.y + dy * L.cell * (0.95 + 0.12 * k), s = L.cell * 0.26;
          c.save(); c.translate(ax, ay); c.rotate(Math.atan2(dy, dx));
          c.fillStyle = '#45D16B'; c.strokeStyle = NAVY; c.lineWidth = 2; c.lineJoin = 'round';
          c.beginPath(); c.moveTo(s, 0); c.lineTo(-s * 0.7, -s * 0.9); c.lineTo(-s * 0.7, s * 0.9); c.closePath(); c.fill(); c.stroke();
          c.restore();
        });
      }
      if (S.bonk && S.vt - S.bonk.t0 < 0.5) {
        const [dx, dy] = DV[S.bonk.d];
        g.text('✖', hp.x + dx * L.cell, hp.y + dy * L.cell, { size: Math.round(L.cell * 0.7), font: 'round', weight: 800, color: '#FF4B55', stroke: '#FFFFFF', strokeW: 3, alpha: 1 - (S.vt - S.bonk.t0) / 0.5 });
      }
    }
    function drawFlyers(c) {
      const Q = S.Q;
      for (let i = S.flyers.length - 1; i >= 0; i--) {
        const f = S.flyers[i];
        const t = (S.vt - f.t0) / f.dur;
        if (t >= 1) {
          S.flyers.splice(i, 1);
          if (Q && Q.eaten[f.pos] != null) {
            Q.landed = Math.max(Q.landed, f.pos + 1);
            S.landT[f.pos] = S.vt;
            g.burst(f.x1, f.y1, { kind: 'spark', n: 8 });
            g.sfx('pop');
          }
          continue;
        }
        const e = outCubic(Math.max(0, t));
        const x = lerp(f.x0, f.x1, e), y = lerp(f.y0, f.y1, e) - Math.sin(Math.PI * e) * L.cell * 1.6;
        const fs = Math.round(lerp(L.cell * 0.56, L.bf, e));
        const tw = g.measure(f.text, fs, Q && Q.para ? 'round' : 'kai', KW) + fs * 0.7, th = fs * 1.5;
        c.save(); c.translate(x, y); c.rotate(Math.sin(e * Math.PI) * 0.25);
        g.rrect(-tw / 2, -th / 2 + 3, tw, th, 10, 'rgba(29,43,83,.45)');
        g.rrect(-tw / 2, -th / 2, tw, th, 10, '#FFE08A', NAVY, 2.2);
        g.text(f.text, 0, 1, { size: fs, font: Q && Q.para ? 'round' : 'kai', weight: KW, color: NAVY });
        c.restore();
      }
    }

    /* ================= spec ================= */
    const spec = {
      maxLevel: 10, lives: 3, rounds: 5, music: 'bright', sky: 'grass',
      intro: '按顺序吃词语果子，排成一句通顺的话！',
      controls: '滑动 / 方向键 ←↑→↓ / 点哪走哪',
      init(gg) {
        g = gg;
        S.cf = cfgFor(g.level);
        S.list = pickItems(5);
        S.empty = !S.list.length;
        g.rounds = Math.max(1, Math.min(5, S.list.length));
        S.qi = 0; S.Q = null; S.speedUp = 0; S.pressT = {}; S.sw = null; S.bc = null;
        S.blocks = []; S.bonus = []; S.durians = []; S.crabs = []; S.flyers = []; S.landT = []; S.tags = [];
        S.hurtT = null; S.barShake = null; S.bump = null; S.bonk = null; S.pts = null; S.mouth = 0;
        S.banner = null; S.party = null; S.idle = 0; S.idleTold = false; S.flies = null;
        if (S.touch == null) { try { S.touch = !!(W.matchMedia && W.matchMedia('(pointer: coarse)').matches); } catch (e) { S.touch = false; } }
        S.mode = 'wait';
        layout(true);
        spawnSnake();
        if (S.empty) return;
        placeDurians();
        placeCrabs();
        startQuestion();
        try { W.__hwSnake = { g, S, L, api: { startQuestion, pressDir, validDirs, blockAt, allowed, toWait } }; } catch (e) { /* ignore */ }
      },
      play() {
        if (S.empty) return;
        if (S.cf.wrap) g.float('这两关可以穿过边框哦！', g.w / 2, L.by + L.bh * 0.25, { color: '#FFFFFF', size: Math.round(22 * L.u) });
        else if (g.level === 3) g.float('小心扎人的榴莲！', g.w / 2, L.by + L.bh * 0.25, { color: '#FFFFFF', size: Math.round(24 * L.u) });
        else if (g.level === 7) g.float('螃蟹来捣乱啦！', g.w / 2, L.by + L.bh * 0.25, { color: '#FFFFFF', size: Math.round(24 * L.u) });
      },
      update(gg, dt) {
        if (S.empty) return;
        // 卡住没进展：前两关 6 秒、3–4 关 12 秒后让该吃的果子发光（5 关起靠自己）
        if ((S.mode === 'wait' || S.mode === 'move') && S.Q && !S.Q.done) {
          S.idle += dt;
          const th = g.level <= 2 ? 6 : g.level <= 4 ? 12 : 0;
          if (th && S.idle >= th) {
            S.idle = th - 7;
            let any = null;
            S.blocks.forEach((o) => { if (o.alive && !o.fly && allowed(o.k)) { o.hint = S.vt + 4; any = any || o; } });
            if (any) {
              g.sfx('bubble');
              if (!S.idleTold) {
                S.idleTold = true;
                const p = blockPx(any);
                g.float('吃发光的果子！', clamp(p.x, 110 * L.u, g.w - 110 * L.u), clamp(p.y - L.cell * 1.6, L.by + 20, L.by + L.bh - 20), { color: '#FFE45C', size: Math.round(22 * L.u) });
              }
            }
          }
        }
        if (S.mode === 'move') {
          S.moveT += dt * speed();
          let guard = 0;
          while (S.moveT >= 1 && S.mode === 'move' && g.state === 'play' && guard++ < 4) {
            S.moveT -= 1;
            arrive();
            if (S.mode === 'move' && g.state === 'play') advance();
          }
          if (S.mode === 'move' && g.state === 'play') crabTick(dt);
        }
      },
      draw(gg, c) {
        const now = (W.performance && performance.now) ? performance.now() : Date.now();
        const dv = S.lastNow ? clamp((now - S.lastNow) / 1000, 0, 0.05) : 0;
        S.vt += dv;
        S.lastNow = now;
        if (!L.cell) return;
        drawBoard(c);
        if (S.empty) {
          g.shadowText('这个年级还没有排句子的题目', g.w / 2, L.by + L.bh / 2, { size: Math.round(22 * L.u) });
          return;
        }
        drawFlies(c, dv);
        S.durians.forEach((d) => drawDurian(c, cx(d.x), cy(d.y), L.cell * 0.4, S.vt, d.ph));
        S.bonus.forEach((b) => {
          const a = S.vt - b.born; if (a < 0) return;
          const sc = a < 0.4 ? outBack(a / 0.4) : 1, x = cx(b.x), y = cy(b.y);
          if (b.kind === 'heart') g.emoji('❤️', x, y, L.cell * 0.8 * sc * (1 + 0.1 * Math.sin(S.vt * 8)));
          else { g.emoji('⭐', x, y + Math.sin(S.vt * 4) * L.cell * 0.06, L.cell * 0.85 * sc, { rot: Math.sin(S.vt * 3) * 0.3 }); }
        });
        S.blocks.forEach((b) => { if (!b.fly) drawBlock(c, b); });
        const step = S.cf.crabStep;
        S.crabs.forEach((cr) => {
          const t = clamp(cr.t / step, 0, 1), x = lerp(cx(cr.px), cx(cr.x), t), y = cy(cr.y) + Math.abs(Math.sin(S.vt * 9)) * -L.cell * 0.08;
          g.emoji('🦀', x, y, L.cell * 0.86, { rot: Math.sin(S.vt * 10) * 0.12 });
        });
        drawSnake(c);
        S.blocks.forEach((b) => { if (b.fly) drawBlock(c, b); });
        S.blocks = S.blocks.filter((b) => b.alive || (b.dying != null && S.vt - b.dying < 0.26));
        drawBar(c);
        drawLegend();
        drawPad(c);
        drawHints(c);
        drawBanner(c);
        drawFlyers(c);
        if (L.land && S.touch && L.visH < g.h - 40 && L.visH < 430) {   // 横拿手机：下半截看不到 → 提示竖过来
          const fs = Math.round(clamp(g.w / 60, 15, 20)), t = '📱 下面看不到？把手机竖过来玩！';
          const tw = g.measure(t, fs, 'round') + fs * 1.6, th = fs * 1.9, ty = Math.max(g.hudTop + 4, L.visH - th - 10);
          const k = 0.85 + 0.15 * Math.sin(S.vt * 4);
          g.rrect(g.w / 2 - tw / 2, ty + 3, tw, th, th / 2, NAVY);
          g.rrect(g.w / 2 - tw / 2, ty, tw, th, th / 2, 'rgba(255,214,64,' + k + ')', NAVY, 2.5);
          g.text(t, g.w / 2, ty + th / 2 + 1, { size: fs, font: 'round', color: NAVY });
        }
      },
      down(gg, p) {
        if (p && p.type) S.touch = p.type !== 'mouse';
        if (S.empty) return;
        for (const d of DIRS) {
          const b = L.btn[d], m = 6;
          if (p.x >= b.x - m && p.x <= b.x + b.w + m && p.y >= b.y - m && p.y <= b.y + b.h + m) { S.sw = null; pressDir(d); return; }
        }
        S.sw = { x: p.x, y: p.y, x0: p.x, y0: p.y, used: false };
      },
      move(gg, p) {
        const sw = S.sw;
        if (!sw || !p.down) return;
        const dx = p.x - sw.x, dy = p.y - sw.y, th = 22 * L.u;
        if (Math.abs(dx) < th && Math.abs(dy) < th) return;
        const d = Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'right' : 'left') : (dy > 0 ? 'down' : 'up');
        sw.x = p.x; sw.y = p.y; sw.used = true;
        pressDir(d);
      },
      up(gg, p) {
        const sw = S.sw; S.sw = null;
        if (!sw || sw.used || S.empty) return;
        if (Math.hypot(p.x - sw.x0, p.y - sw.y0) > 22 * L.u) return;
        // 点哪走哪：朝点击位置转向
        const hp = headPx(), dx = p.x - hp.x, dy = p.y - hp.y;
        if (Math.abs(dx) < L.cell * 0.5 && Math.abs(dy) < L.cell * 0.5) return;
        const horiz = Math.abs(dx) > Math.abs(dy);
        let d = horiz ? (dx > 0 ? 'right' : 'left') : (dy > 0 ? 'down' : 'up');
        const cur = S.mode === 'move' ? (S.queue.length ? S.queue[S.queue.length - 1] : S.dir) : null;
        if (cur && (d === cur || d === OPP[cur])) {
          const alt = horiz ? (dy > 0 ? 'down' : 'up') : (dx > 0 ? 'right' : 'left');
          if (Math.abs(horiz ? dy : dx) > L.cell * 0.4) d = alt; else return;
        }
        pressDir(d);
      },
      key(gg, k) {
        if (S.empty) return;
        if (KEYDIR[k]) { S.touch = false; pressDir(KEYDIR[k]); return; }
        if ((k === 'space' || k === 'enter') && (S.mode === 'wait' || S.mode === 'party')) pressDir(S.dir);
      },
      resize() {
        if (!g || !L.cols) return;
        const land = g.w > g.h * 1.05;
        if (land !== L.land && !S.empty && S.Q && S.seg && S.seg.length) regrid();   // 横竖屏切换：重排格子
        else layout(false);
        S.bc = null;
      },
      end() { try { if (W.__hwSnake && W.__hwSnake.g === g) W.__hwSnake = null; } catch (e) { /* ignore */ } }
    };
    return spec;
  }

  HW.register({
    id: 'snake', skill: 'read', kind: 'arcade', name: '贪吃蛇排句子', icon: '🐍',
    blurb: '按顺序吃词语果子，排成通顺的句子',
    cols: ['order'], data: ['order'], reviewN: 5,
    start(ctx) {
      if (!HW.arcade || typeof HW.arcade.run !== 'function') {
        try { ctx.el.appendChild(ctx.h('div', { class: 'hw-card hw-center' }, '游戏引擎没有加载，先玩别的吧。')); } catch (e) { /* ignore */ }
        return undefined;
      }
      return HW.arcade.run(ctx, makeSpec());
    }
  });
})();
