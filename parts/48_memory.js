/* =====================================================================
 * 🃏 拼音翻翻乐（parts/48_memory.js · read · 题库栏目 words）
 * 翻牌记忆配对：词语牌 ↔ 拼音牌。开局牌从宝箱里飞出 → 偷看几秒 → 全部盖上 → 翻两张配对。
 * 配对成功：两张牌弹起、爆星星、朗读词语、飞回宝箱；配错：抖一抖翻回去。
 * 惩罚规则（对 7 岁孩子公平）：第二张翻的是“自己翻过、明知不对”的牌 → 扣心 + 记错题；
 *   纯探索翻错只断连击（它的朋友你见过时熊猫会提醒）。
 * 关卡：6→12 对、偷看 2.8s→1s、限时；第 5 关起小猴子会来“调包”两张盖着的牌（看得见的交换动画）。
 * 道具：👓 透视眼镜（每关 1–2 次，所有盖着的牌亮 1 秒）。
 * 键盘：方向键移动光标、空格 / 回车翻牌、E 透视。
 * ===================================================================== */
(function () {
  'use strict';
  const W = window;
  if (!W.HW || typeof W.HW.register !== 'function') return;
  const HW = W.HW;

  const NAVY = '#1d2b53';
  const PAIRS = [6, 6, 7, 8, 8, 9, 10, 10, 11, 12];
  const TAU = Math.PI * 2;
  const nowS = () => (W.performance && performance.now ? performance.now() : Date.now()) / 1000;
  const bare = (py) => String(py || '').toLowerCase().replace(/[ǖǘǚǜü]/g, 'v').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z]/g, '');
  const clampN = (v, a, b) => (v < a ? a : v > b ? b : v);
  const pairsFor = (lv) => PAIRS[clampN(lv - 1, 0, PAIRS.length - 1)];
  // 偷看时长：2.8 → 1 秒；P2/P3 小朋友读拼音慢，多给 0.6 / 0.3 秒
  const peekFor = (lv, gn) => Math.max(1.0, 2.8 - 0.2 * (lv - 1)) + Math.max(0, 4 - (gn || 3)) * 0.3;
  function timeFor(lv, pairs, gradeNum) {
    const per = clampN(12 - 0.5 * (lv - 1) + (6 - (gradeNum || 3)) * 0.8, 7, 16);
    return Math.round(pairs * per + 10);
  }
  const monkeyGap = (lv) => (lv < 5 ? 0 : Math.max(8, 18 - (lv - 4) * 1.6));
  const glassesFor = (lv) => (lv <= 3 ? 2 : 1);

  /* 选词：同一盘不能有同拼音（去调）的词，也不能有同形的词 */
  function chooseWords(g, n) {
    const out = [], seenPy = new Set(), seenW = new Set();
    const ok = (it) => it && typeof it.w === 'string' && typeof it.py === 'string' && it.w.trim() && it.py.trim();
    const tryAdd = (it) => {
      if (!ok(it) || out.length >= n) return;
      const k = bare(it.py), w = it.w.trim();
      if (!k || seenPy.has(k) || seenW.has(w)) return;
      seenPy.add(k); seenW.add(w); out.push(it);
    };
    const inReview = !!(g.hasReview && g.hasReview('words') > 0);
    // 错题重练：交来的错题（核心最多给 10 个）全部上桌，别因为第 1 关只有 6 对就漏练几个
    if (inReview) n = 12;   // tryAdd 读的就是这个 n
    const first = g.items('words', n) || [];
    first.forEach(tryAdd);
    g.reviewN = inReview ? out.length : 0;
    // 错题只有 1–3 个时一盘只剩 2–6 张牌，根本不像翻牌游戏——用本年级其它词补到至少 5 对（错题一定都在盘上）
    if (inReview) n = Math.max(out.length, 5);
    if (out.length < n) g.shuffle((g.G && g.G.words) || []).forEach(tryAdd);
    return out;
  }

  /* 牌面文字排版（按牌的尺寸算好，layout 时缓存） */
  function setupFace(g, cd) {
    const w = cd.w, h = cd.h;
    if (cd.kind === 'w') {
      const chs = Array.from(cd.item.w.trim());
      const n = chs.length;
      const one = Math.min(h * 0.36, (w * 0.84) / n);
      if (n >= 4) {
        const half = Math.ceil(n / 2);
        const two = Math.min((w * 0.82) / half, h * 0.3);
        if (two > one * 1.12) { cd.lines = [chs.slice(0, half).join(''), chs.slice(half).join('')]; cd.fs = Math.round(two); return; }
      }
      cd.lines = [chs.join('')]; cd.fs = Math.round(one);
    } else {
      const syl = cd.item.py.trim().split(/\s+/);
      let fs = Math.round(clampN(Math.min(w * 0.2, h * 0.2), 12, 30));
      const maxW = w * 0.9;
      const w1 = g.measure(syl.join(' '), fs, 'py');
      if (w1 <= maxW || syl.length < 2) { cd.lines = [syl.join(' ')]; cd.fs = w1 <= maxW ? fs : Math.max(11, Math.floor(fs * maxW / w1)); return; }
      // 放不下一行：比较“一行缩小”和“拆两行”哪个字更大（四字成语的拼音拆两行通常大得多）
      const fs1 = Math.floor(fs * maxW / w1);
      // 三音节 ABB 词（liàng jīng jīng 亮晶晶）按 A | BB 断，其它三音节（zì xíng chē）按 AB | C 断
      const half = syl.length === 3 && bare(syl[1]) === bare(syl[2]) ? 1 : Math.ceil(syl.length / 2);
      const l1 = syl.slice(0, half).join(' '), l2 = syl.slice(half).join(' ');
      const wid = Math.max(g.measure(l1, fs, 'py'), g.measure(l2, fs, 'py'));
      const fs2 = Math.min(wid > maxW ? Math.floor(fs * maxW / wid) : fs, Math.floor(h * 0.27));
      // 2–3 个音节的词（shāng liang / pàng hū hū）拆成两行像两个词——只有一行太小才拆；成语（4 音节）照常 2+2
      const minOne = syl.length === 2 ? 14 : syl.length === 3 ? 16 : 1e9;
      const split = fs1 < minOne && fs2 > fs1 * 1.06;
      if (split) { cd.lines = [l1, l2]; cd.fs = Math.max(11, fs2); }
      else { cd.lines = [syl.join(' ')]; cd.fs = Math.max(11, fs1); }
    }
  }

  /* 网格：在 BW×BH 里放 n 张牌，求最大牌面（宽高比 0.72–1.0） */
  function bestGrid(n, BW, BH, gap) {
    let best = null;
    for (let cols = 1; cols <= n; cols++) {
      const rows = Math.ceil(n / cols);
      const cw = (BW - gap * (cols - 1)) / cols, ch = (BH - gap * (rows - 1)) / rows;
      if (cw <= 10 || ch <= 10) continue;
      let w = cw, h = ch;
      if (w / h > 1.0) w = h * 1.0;
      else if (w / h < 0.72) h = w / 0.72;
      w = Math.min(w, 150); h = Math.min(h, 170);
      const empty = cols * rows - n;
      const score = w * h * (1 - empty * 0.02);
      if (!best || score > best.score) best = { cols, rows, w, h, score };
    }
    return best;
  }

  /* ---------------- 布局 ---------------- */
  function layout(g) {
    const L = g.L || (g.L = {});
    const w = g.w, h = g.h;
    const s = clampN(Math.min(w, h * 0.62) / 390, 0.9, 1.5);
    L.s = s;
    L.pad = Math.round(10 * s);
    L.timerY = g.hudTop + Math.round(24 * s);
    L.trayH = Math.round(clampN(h * 0.13, 94 * s, 120 * s));
    L.trayY = h - L.trayH;
    const top = g.hudTop + Math.round(42 * s);
    const bot = L.trayY - Math.round(6 * s);
    const maxBW = Math.min(w - L.pad * 2, 1000);
    const gap = Math.round(clampN(Math.min(w, h) * 0.018, 6, 14));
    const n = g.cards.length || 12;
    const gr = bestGrid(n, maxBW - gap * 2, bot - top - gap * 2, gap);
    L.gap = gap; L.cols = gr.cols; L.rows = gr.rows;
    L.cw = Math.floor(gr.w); L.ch = Math.floor(gr.h);
    const gw = L.cols * L.cw + (L.cols - 1) * gap, gh = L.rows * L.ch + (L.rows - 1) * gap;
    L.gx = Math.round((w - gw) / 2); L.gy = Math.round(top + (bot - top - gh) / 2);
    L.panel = { x: L.gx - gap - 4, y: L.gy - gap - 4, w: gw + gap * 2 + 8, h: gh + gap * 2 + 8 };
    // 托盘：左熊猫、中眼镜、右宝箱
    const ty = L.trayY + L.trayH * 0.42;
    L.panda = { x: Math.max(42 * s, Math.min(w * 0.14, 150)), y: ty + 2 * s, size: Math.round(54 * s) };
    L.chest = { x: w - Math.max(52 * s, Math.min(w * 0.14, 150)), y: ty + 6 * s, s: s };
    const gr0 = Math.round(29 * s);
    L.glass = { x: w >= 600 ? w / 2 : L.chest.x - 88 * s, y: ty + 2 * s, r: gr0 };
    L.bubL = L.panda.x + L.panda.size * 0.55;
    L.bubR = L.glass.x - gr0 - 10 * s;
    // 牌槽（最后一行居中）
    L.slots = [];
    for (let i = 0; i < n; i++) {
      const r = Math.floor(i / L.cols), cIdx = i % L.cols;
      const inRow = r === L.rows - 1 ? n - r * L.cols : L.cols;
      const rowW = inRow * L.cw + (inRow - 1) * gap;
      const x0 = (w - rowW) / 2;
      L.slots.push({ x: x0 + cIdx * (L.cw + gap) + L.cw / 2, y: L.gy + r * (L.ch + gap) + L.ch / 2, r, c: cIdx });
    }
    // 牌背渐变（按牌尺寸缓存一次）
    const c = g.c;
    const gb = c.createLinearGradient(0, -L.ch / 2, 0, L.ch / 2);
    gb.addColorStop(0, '#FF9A5C'); gb.addColorStop(0.55, '#FF6B5B'); gb.addColorStop(1, '#E84A6A');
    L.backGrad = gb;
    const gw1 = c.createLinearGradient(0, -L.ch / 2, 0, L.ch / 2);
    gw1.addColorStop(0, '#FFFDF3'); gw1.addColorStop(1, '#FFEFC4');
    L.wordGrad = gw1;
    const gp = c.createLinearGradient(0, -L.ch / 2, 0, L.ch / 2);
    gp.addColorStop(0, '#F4FCFF'); gp.addColorStop(1, '#CDEEFF');
    L.pyGrad = gp;
    const sh = c.createLinearGradient(-L.cw, 0, L.cw, 0);
    sh.addColorStop(0, 'rgba(255,255,255,0)'); sh.addColorStop(0.45, 'rgba(255,255,255,0)');
    sh.addColorStop(0.5, 'rgba(255,255,255,.55)'); sh.addColorStop(0.55, 'rgba(255,255,255,0)'); sh.addColorStop(1, 'rgba(255,255,255,0)');
    L.shine = sh;
    // 每张牌：尺寸、牌面排版、落位
    g.cards.forEach((cd) => {
      cd.w = L.cw; cd.h = L.ch;
      setupFace(g, cd);
      const sl = L.slots[cd.slot];
      cd.tx = sl.x; cd.ty = sl.y;
      if (!cd.mv && cd.placed) { cd.x = cd.tx; cd.y = cd.ty; }
      if (cd.mv && cd.mv.slot) { cd.mv.x1 = cd.tx; cd.mv.y1 = cd.ty; }
      if (cd.mv && cd.mv.chest) { cd.mv.x1 = L.chest.x; cd.mv.y1 = L.chest.y - 10 * s; }
    });
  }

  /* ---------------- 运动：弧线飞行（用引擎 tween，结束动画期间也照走） ---------------- */
  function moveCard(g, cd, x1, y1, dur, o) {
    o = o || {};
    if (cd.mvTw) cd.mvTw.cancel();
    const mv = { k: 0, x0: cd.x, y0: cd.y, x1, y1, arc: o.arc || 0, r0: cd.rot || 0, r1: o.rot1 || 0, s0: cd.sc, s1: o.s1 == null ? 1 : o.s1, slot: !!o.slot, chest: !!o.chest, perp: !!o.perp,
      lo: o.perp ? (cd.w || 60) / 2 + 4 : -1e9, hi: o.perp ? g.w - (cd.w || 60) / 2 - 4 : 1e9 };
    cd.mv = mv;
    cd.mvTw = g.tween(mv, { k: 1 }, dur, o.ease || 'outCubic', () => {
      cd.mv = null; cd.mvTw = null;
      cd.x = mv.x1; cd.y = mv.y1; cd.rot = mv.r1; cd.sc = mv.s1;
      if (o.onDone) o.onDone();
    });
  }
  function resolveMv(cd) {
    const m = cd.mv;
    if (!m) return;
    const k = m.k;
    const off = m.arc * Math.sin(Math.PI * clampN(k, 0, 1));
    cd.x = m.x0 + (m.x1 - m.x0) * k;
    cd.y = m.y0 + (m.y1 - m.y0) * k;
    if (m.perp) {   // 垂直于运动方向的弧：两张牌对调时绕着彼此转半圈
      const dx = m.x1 - m.x0, dy = m.y1 - m.y0, len = Math.hypot(dx, dy) || 1;
      cd.x += (dy / len) * off; cd.y -= (dx / len) * off;
      cd.x = clampN(cd.x, m.lo, Math.max(m.lo, m.hi));   // 靠边的牌绕圈时别被甩出屏幕
    } else cd.y -= off;
    cd.rot = m.r0 + (m.r1 - m.r0) * k;
    cd.sc = m.s0 + (m.s1 - m.s0) * k;
  }
  /* 翻牌：cd.up 是逻辑朝向（立即生效），cd.flip 是动画值 0（背）→1（面） */
  function setFlip(g, cd, v, dur, delay) {
    cd.up = v >= 0.5;
    const go = () => {
      if (cd.flTw) cd.flTw.cancel();
      cd.flTw = g.tween(cd, { flip: v }, dur || 0.28, 'outBack');
    };
    if (delay) { if (cd.flDl) cd.flDl.cancel(); cd.flDl = g.after(delay, go); } else go();
  }

  function rrPath(c, x, y, w, h, r) {
    r = Math.max(0, Math.min(r, w / 2, h / 2));
    c.beginPath();
    c.moveTo(x + r, y);
    c.arcTo(x + w, y, x + w, y + h, r);
    c.arcTo(x + w, y + h, x, y + h, r);
    c.arcTo(x, y + h, x, y, r);
    c.arcTo(x, y, x + w, y, r);
    c.closePath();
  }

  /* ---------------- 画一张牌 ---------------- */
  function drawCard(g, c, cd, t, L) {
    const f = cd.flip;
    const cosv = Math.cos(f * Math.PI);
    const sx = Math.max(0.03, Math.abs(cosv));
    const face = cosv < 0;
    const lift = Math.sin(clampN(f, 0, 1) * Math.PI);
    const idle = cd.placed && !cd.mv ? 1 : 0;
    const s = L.s;
    const bob = idle * Math.sin(t * 2.1 + cd.ph) * 2.2 * s;
    const sway = idle * Math.sin(t * 1.4 + cd.ph * 1.7) * 0.018;
    const shx = cd.shake > 0 ? Math.sin(t * 55) * 8 * cd.shake * s : 0;
    const sc = cd.sc * (1 + 0.1 * lift + 0.06 * cd.hover + 0.16 * cd.pop);
    const w = cd.w, h = cd.h, r = Math.min(w, h) * 0.14;
    c.save();
    c.translate(cd.x + shx, cd.y + bob - lift * 8 * s - cd.hover * 4 * s);
    c.rotate(cd.rot + sway + (cd.shake > 0 ? Math.sin(t * 40) * 0.05 * cd.shake : 0));
    c.scale(sx * sc, sc);
    if (cd.alpha < 1) c.globalAlpha = cd.alpha;
    g.rrect(-w / 2, -h / 2 + (5 + lift * 7) * s, w, h, r, 'rgba(20,30,70,.28)');
    if (cd.glow > 0.01) {
      const a0 = c.globalAlpha;
      c.globalAlpha = a0 * cd.glow * (0.75 + 0.25 * Math.sin(t * 16));
      g.rrect(-w / 2 - 7 * s, -h / 2 - 7 * s, w + 14 * s, h + 14 * s, r + 7 * s, '#FFE45C');
      c.globalAlpha = a0;
    }
    if (!face) {
      g.rrect(-w / 2, -h / 2, w, h, r, L.backGrad, NAVY, 3 * s);
      g.rrect(-w / 2 + 6 * s, -h / 2 + 6 * s, w - 12 * s, h - 12 * s, r * 0.7, null, 'rgba(255,255,255,.7)', 2 * s);
      // 四角小菱形
      c.fillStyle = 'rgba(255,240,200,.85)';
      const dx = w / 2 - 14 * s, dy = h / 2 - 14 * s, k = 4 * s;
      for (let i = 0; i < 4; i++) {
        const px = i % 2 ? dx : -dx, py = i < 2 ? -dy : dy;
        c.beginPath(); c.moveTo(px, py - k); c.lineTo(px + k, py); c.lineTo(px, py + k); c.lineTo(px - k, py); c.closePath(); c.fill();
      }
      const mr = Math.min(w, h) * 0.25;
      c.beginPath(); c.arc(0, 3 * s, mr, 0, TAU); c.fillStyle = 'rgba(29,43,83,.55)'; c.fill();
      c.beginPath(); c.arc(0, 0, mr, 0, TAU); c.fillStyle = '#FFD84D'; c.fill();
      c.lineWidth = 2.6 * s; c.strokeStyle = NAVY; c.stroke();
      c.beginPath(); c.ellipse(-mr * 0.35, -mr * 0.4, mr * 0.3, mr * 0.16, -0.6, 0, TAU); c.fillStyle = 'rgba(255,255,255,.6)'; c.fill();
      g.text('?', 0, mr * 0.06, { size: Math.round(mr * 1.3), font: 'num', color: NAVY });
      // 周期性闪光扫过
      const ph = (t * 0.45 + cd.ph * 0.37) % 2.6;
      if (ph < 1) {
        c.save();
        rrPath(c, -w / 2, -h / 2, w, h, r); c.clip();
        c.transform(1, 0, -0.45, 1, -w * 0.9 + ph * w * 2.1, 0);
        c.fillStyle = L.shine; c.fillRect(-w, -h, w * 2, h * 2);
        c.restore();
      }
    } else {
      const isW = cd.kind === 'w';
      g.rrect(-w / 2, -h / 2, w, h, r, isW ? L.wordGrad : L.pyGrad, NAVY, 3 * s);
      // 田字格虚线（词语牌） / 四线格（拼音牌）
      c.save();
      c.lineWidth = 1.2 * s; c.setLineDash([4 * s, 4 * s]);
      c.strokeStyle = isW ? 'rgba(232,69,60,.28)' : 'rgba(47,143,224,.3)';
      const n = cd.lines.length, lh = cd.fs * (isW ? 1.12 : 1.3);
      const y0 = -(n - 1) * lh / 2 + h * 0.04;
      c.beginPath();
      if (isW) { c.moveTo(-w / 2 + 8 * s, 0); c.lineTo(w / 2 - 8 * s, 0); c.moveTo(0, -h / 2 + 8 * s); c.lineTo(0, h / 2 - 8 * s); }
      else {
        // 拼音四线格的中间一格：每行拼音的 x 高度上下各一条虚线（小写字母坐在格子里，声调和 l/j/g 伸出去）
        for (let i = 0; i < n; i++) {
          const yy = y0 + i * lh;
          for (const q of [-0.19, 0.31]) { c.moveTo(-w / 2 + 7 * s, yy + q * cd.fs); c.lineTo(w / 2 - 7 * s, yy + q * cd.fs); }
        }
      }
      c.stroke();
      c.restore();
      const tg = Math.max(9, Math.round(Math.min(w, h) * 0.12));
      c.beginPath(); c.arc(-w / 2 + tg * 1.15, -h / 2 + tg * 1.15, tg * 0.8, 0, TAU);
      c.fillStyle = isW ? '#E8453C' : '#2F8FE0'; c.fill();
      g.text(isW ? '词' : '拼', -w / 2 + tg * 1.15, -h / 2 + tg * 1.2, { size: tg, font: 'round', color: '#FFFFFF' });
      for (let i = 0; i < n; i++) {
        if (isW) g.text(cd.lines[i], 0, y0 + i * lh, { size: cd.fs, font: 'kai', color: NAVY, maxW: w * 0.9 });
        else g.text(cd.lines[i], 0, y0 + i * lh, { size: cd.fs, font: 'py', color: '#16498F', maxW: w * 0.9 });
      }
    }
    if (cd.red > 0.01) {
      const a0 = c.globalAlpha; c.globalAlpha = a0 * cd.red * 0.42;
      g.rrect(-w / 2, -h / 2, w, h, r, '#FF3B3B');
      c.globalAlpha = a0;
    }
    c.restore();
  }

  /* ---------------- 宝箱 ---------------- */
  function drawChest(g, c, L, t) {
    const ch = L.chest, s = ch.s;
    const since = t - (g.chestHitT || -9);
    const bump = since < 0.45 ? Math.sin(since / 0.45 * Math.PI) * (1 - since / 0.45) : 0;
    const bw = 80 * s, bh = 48 * s, op0 = clampN(g.chestOpen || 0, 0, 1.2);
    // 倒计时里宝箱一阵一阵地抖：牌在里面等着飞出来
    const rph = t % 1.1, rattle = g.stage === 'ready' && rph < 0.45 ? Math.sin(t * 38) * 0.08 : 0;
    const hop = rattle ? Math.sin(rph / 0.45 * Math.PI) * 7 * s : 0;
    const op = rattle ? Math.max(op0, 0.35 * Math.sin(rph / 0.45 * Math.PI)) : op0;
    c.save();
    c.translate(ch.x, ch.y + 18 * s - hop);
    if (rattle) c.rotate(rattle);
    c.scale(1 + bump * 0.16, 1 - bump * 0.12);
    c.translate(0, -18 * s);
    c.fillStyle = 'rgba(20,30,70,.25)'; c.beginPath(); c.ellipse(0, bh * 0.52, bw * 0.62, 9 * s, 0, 0, TAU); c.fill();
    if (op > 0.05) {
      c.save(); c.globalAlpha = Math.min(1, op) * (0.7 + 0.3 * Math.sin(t * 8));
      c.fillStyle = '#FFF3A0'; c.beginPath(); c.ellipse(0, -bh * 0.2, bw * 0.56, 26 * s * op, 0, Math.PI, TAU); c.fill();
      c.restore();
    }
    // 箱体
    g.rrect(-bw / 2, -bh * 0.2, bw, bh * 0.68, 8 * s, '#B8692E', NAVY, 3 * s);
    c.fillStyle = 'rgba(90,40,10,.35)';
    c.fillRect(-bw / 2 + 4 * s, bh * 0.12, bw - 8 * s, 2.5 * s);
    for (const bx of [-bw * 0.32, bw * 0.32]) g.rrect(bx - 5 * s, -bh * 0.2, 10 * s, bh * 0.68, 2 * s, '#FFC928', NAVY, 2 * s);
    // 盖子（绕后沿转开）
    c.save();
    c.translate(0, -bh * 0.2 - op * 20 * s);
    c.rotate(-op * 0.12);
    c.scale(1, 1 - 0.35 * Math.min(1, op));
    g.rrect(-bw / 2 - 2 * s, -bh * 0.36, bw + 4 * s, bh * 0.38, 12 * s, '#C97A38', NAVY, 3 * s);
    for (const bx of [-bw * 0.32, bw * 0.32]) g.rrect(bx - 5 * s, -bh * 0.36, 10 * s, bh * 0.38, 2 * s, '#FFC928', NAVY, 2 * s);
    c.restore();
    g.rrect(-8 * s, -bh * 0.26, 16 * s, 19 * s, 4 * s, '#FFD84D', NAVY, 2.5 * s);
    c.fillStyle = NAVY; c.beginPath(); c.arc(0, -bh * 0.26 + 8 * s, 2.6 * s, 0, TAU); c.fill();
    c.restore();
    // 计数徽章
    const txt = Math.floor((g.chestN || 0) / 2) + '/' + (g.rounds || 0);
    const fs = Math.round(15 * s), tw = g.measure(txt, fs, 'num') + 34 * s, bx = ch.x - tw / 2, by = ch.y - bh * 0.2 - 50 * s;
    g.rrect(bx, by + 3 * s, tw, 24 * s, 12 * s, NAVY);
    g.rrect(bx, by, tw, 24 * s, 12 * s, '#FFFBEF', NAVY, 2.4 * s);
    g.emoji('🃏', bx + 13 * s, by + 12 * s, 16 * s);
    g.text(txt, bx + tw - 9 * s, by + 13 * s, { size: fs, font: 'num', color: NAVY, align: 'right' });
  }

  /* ---------------- 熊猫 + 气泡 ---------------- */
  function drawPanda(g, c, L, t) {
    const p = L.panda, s = L.s;
    const hs = t - g.pd.hopT, ss = t - g.pd.sadT;
    let y = p.y - Math.abs(Math.sin(t * 2.6)) * 3 * s, rot = Math.sin(t * 1.3) * 0.06, sqx = 1, sqy = 1;
    if ((g.feverK || 0) > 0.3 && !(hs >= 0 && hs < 0.7)) {   // 连击中：熊猫跟着蹦迪
      y = p.y - Math.abs(Math.sin(t * 7)) * 12 * s * g.feverK;
      rot = Math.sin(t * 7) * 0.18 * g.feverK;
    }
    if (hs >= 0 && hs < 0.7) {
      const k = hs / 0.7;
      y -= Math.sin(k * Math.PI) * 34 * s;
      rot += Math.sin(k * TAU) * 0.25;
      if (k < 0.15) { sqx = 1.15 - k; sqy = 0.85 + k; }
    } else if (ss >= 0 && ss < 0.8) {
      const k = 1 - ss / 0.8;
      rot += Math.sin(ss * 22) * 0.22 * k;
      sqx = 1 + 0.06 * k; sqy = 1 - 0.06 * k;
    }
    c.save();
    c.fillStyle = 'rgba(20,30,70,.22)'; c.beginPath(); c.ellipse(p.x, p.y + p.size * 0.42, p.size * 0.42, 7 * s, 0, 0, TAU); c.fill();
    c.translate(p.x, y + p.size * 0.4); c.rotate(rot); c.scale(sqx, sqy);
    g.emoji('🐼', 0, -p.size * 0.4, p.size);
    if (ss >= 0 && ss < 0.8) g.emoji('💦', p.size * 0.38, -p.size * 0.8, 20 * s);
    if (hs >= 0 && hs < 0.9) g.emoji('✨', -p.size * 0.45, -p.size * 0.85, 20 * s);
    c.restore();
    // 气泡
    const b = g.bub;
    if (!b) return;
    const age = t - b.t0;
    if (age > b.dur) { g.bub = null; return; }
    const pop = age < 0.25 ? g.ease.outBack(age / 0.25) : 1;
    const a = age > b.dur - 0.3 ? (b.dur - age) / 0.3 : 1;
    const fs = Math.round(16 * s);
    const maxW = Math.max(60 * s, L.bubR - L.bubL - 22 * s);
    const tw = Math.min(maxW, g.measure(b.text, fs, 'round'));
    const bw = tw + 22 * s, bh = 34 * s;
    const bx = L.bubL + 8 * s, by = p.y - bh * 0.95;
    c.save();
    c.globalAlpha = clampN(a, 0, 1);
    c.translate(bx, by + bh / 2); c.scale(pop, pop); c.translate(-bx, -(by + bh / 2));
    g.rrect(bx, by + 3 * s, bw, bh, bh / 2, 'rgba(29,43,83,.5)');
    c.beginPath(); c.moveTo(bx + 4 * s, by + bh * 0.55); c.lineTo(bx - 9 * s, by + bh * 0.95); c.lineTo(bx + 16 * s, by + bh * 0.8); c.closePath();
    c.fillStyle = '#FFFFFF'; c.fill(); c.lineWidth = 2.4 * s; c.strokeStyle = NAVY; c.stroke();
    g.rrect(bx, by, bw, bh, bh / 2, '#FFFFFF', NAVY, 2.4 * s);
    c.beginPath(); c.moveTo(bx + 5 * s, by + bh * 0.52); c.lineTo(bx + 16 * s, by + bh * 0.72); c.lineTo(bx + 18 * s, by + bh * 0.4); c.closePath(); c.fillStyle = '#FFFFFF'; c.fill();
    g.text(b.text, bx + bw / 2, by + bh / 2 + 1, { size: fs, font: 'round', color: NAVY, maxW: tw });
    c.restore();
  }
  function bubble(g, text, dur) { g.bub = { text: String(text), t0: nowS(), dur: dur || 2.2 }; }

  /* ---------------- 透视眼镜按钮 ---------------- */
  function drawGlasses(g, c, L, t) {
    const b = L.glass, s = L.s, r = b.r;
    const on = g.stage === 'play' && g.glasses > 0 && !(g.lock > 0) && !g.monk;
    const ps = t - (g.glT || -9);
    const press = ps < 0.25 ? Math.sin(ps / 0.25 * Math.PI) : 0;
    const y = b.y + press * 4 * s;
    c.save();
    if (!on) c.globalAlpha = 0.5;
    c.fillStyle = NAVY; c.beginPath(); c.arc(b.x, b.y + 5 * s, r, 0, TAU); c.fill();
    c.fillStyle = on ? '#8B5CF6' : '#9AA3BF'; c.beginPath(); c.arc(b.x, y, r, 0, TAU); c.fill();
    c.lineWidth = 3 * s; c.strokeStyle = NAVY; c.stroke();
    c.fillStyle = 'rgba(255,255,255,.35)'; c.beginPath(); c.ellipse(b.x, y - r * 0.45, r * 0.62, r * 0.28, 0, 0, TAU); c.fill();
    g.emoji('👓', b.x, y + 1 * s, r * 1.15, on ? { rot: Math.sin(t * 3) * 0.08 } : null);
    c.restore();
    // 次数徽章
    const bx = b.x + r * 0.75, by = b.y - r * 0.72, br = 11 * s;
    c.fillStyle = g.glasses > 0 ? '#FF4D6D' : '#9AA3BF'; c.beginPath(); c.arc(bx, by, br, 0, TAU); c.fill();
    c.lineWidth = 2.2 * s; c.strokeStyle = NAVY; c.stroke();
    g.text(String(g.glasses), bx, by + 1 * s, { size: Math.round(14 * s), font: 'num', color: '#FFFFFF' });
    g.text('透视', b.x, b.y + r + 11 * s, { size: Math.round(13 * s), font: 'round', color: '#FFFFFF', stroke: NAVY, strokeW: 3 * s });
    // 可用时偶尔闪一下，提示它能点
    if (on && g.stage === 'play' && g.idleT > 4) {
      const k = (t * 0.8) % 1;
      c.globalAlpha = 1 - k; c.lineWidth = 3 * s; c.strokeStyle = '#FFFFFF';
      c.beginPath(); c.arc(b.x, b.y, r + k * 16 * s, 0, TAU); c.stroke(); c.globalAlpha = 1;
    }
  }

  /* ---------------- 计时条 / 偷看条 ---------------- */
  function drawTimer(g, c, L, t) {
    const s = L.s, y = L.timerY;
    if (g.stage === 'deal' || g.stage === 'peek') {
      const txt = g.stage === 'deal' ? '发牌啦……' : '记住它们的位置！';
      const fs = Math.round(19 * s);
      const tw = g.measure(txt, fs, 'round') + 60 * s;
      const bw = Math.min(g.w - L.pad * 2, Math.max(tw, 220 * s)), bh = 34 * s, bx = g.w / 2 - bw / 2, by = y - bh / 2 + 2 * s;
      const pulse = 1 + Math.sin(t * 8) * 0.03;
      c.save(); c.translate(g.w / 2, y); c.scale(pulse, pulse); c.translate(-g.w / 2, -y);
      g.rrect(bx, by + 3 * s, bw, bh, bh / 2, NAVY);
      g.rrect(bx, by, bw, bh, bh / 2, '#FFE45C', NAVY, 2.6 * s);
      if (g.stage === 'peek' && g.peekMax > 0) {
        const k = clampN(g.peekLeft / g.peekMax, 0, 1);
        c.save(); rrPath(c, bx, by, bw, bh, bh / 2); c.clip();
        c.fillStyle = 'rgba(255,150,40,.55)'; c.fillRect(bx, by, bw * k, bh);
        c.restore();
      }
      g.emoji('👀', bx + 22 * s, by + bh / 2, 22 * s, { rot: Math.sin(t * 6) * 0.15 });
      g.text(txt, g.w / 2 + 12 * s, by + bh / 2 + 1, { size: fs, font: 'round', color: NAVY, maxW: bw - 56 * s });
      c.restore();
      return;
    }
    const x0 = L.pad + 34 * s, x1 = g.w - L.pad - 6 * s, hh = 16 * s, w = x1 - x0;
    const frac = clampN(g.timeLeft / (g.timeMax || 1), 0, 1);
    const low = frac < 0.25 && g.stage === 'play';
    g.rrect(x0, y - hh / 2 + 3 * s, w, hh, hh / 2, NAVY);
    g.rrect(x0, y - hh / 2, w, hh, hh / 2, 'rgba(20,32,70,.55)', NAVY, 2.4 * s);
    const fw = Math.max(0, (w - 6 * s) * frac);
    if (fw > 1) {
      const col = frac > 0.5 ? '#3CCB5A' : frac > 0.25 ? '#FFC928' : (Math.sin(t * 14) > 0 ? '#FF5A5F' : '#FF8A8A');
      g.rrect(x0 + 3 * s, y - hh / 2 + 3 * s, Math.max(hh - 6 * s, fw), hh - 6 * s, (hh - 6 * s) / 2, col);
      g.rrect(x0 + 3 * s, y - hh / 2 + 3 * s, Math.max(hh - 6 * s, fw), (hh - 6 * s) * 0.45, (hh - 6 * s) * 0.22, 'rgba(255,255,255,.5)');
    }
    g.text(Math.ceil(g.timeLeft) + ' 秒', x1 - 8 * s, y + 1 * s, { size: Math.round(13 * s), font: 'num', color: '#FFFFFF', stroke: NAVY, strokeW: 3 * s, align: 'right' });
    const ck = low ? 1 + 0.15 * Math.abs(Math.sin(t * 10)) : 1;
    g.emoji('⏰', L.pad + 15 * s, y, 26 * s * ck, { rot: low ? Math.sin(t * 30) * 0.3 : Math.sin(t * 2) * 0.08 });
  }

  /* ---------------- 配对成功横幅 ---------------- */
  function drawBanner(g, c, L, t) {
    const b = g.banner;
    if (!b) return;
    const age = t - b.t0, dur = b.dur || 1.35;
    if (age > dur) { g.banner = null; return; }
    const s = L.s;
    const pop = age < 0.3 ? g.ease.outBack(age / 0.3) : 1;
    const a = age > dur - 0.3 ? (dur - age) / 0.3 : 1;
    const cx = g.w / 2, cy = L.panel.y + L.panel.h * 0.5;
    const fw = Math.round(clampN(46 * s, 34, 64)), fp = Math.round(clampN(22 * s, 16, 30));
    const tw = Math.max(g.measure(b.w, fw, 'kai'), g.measure(b.py, fp, 'py'));
    const bw = Math.min(g.w - 30 * s, tw + 70 * s), bh = fw * 1.25 + fp * 1.5 + 18 * s;
    c.save();
    c.globalAlpha = clampN(a, 0, 1);
    c.translate(cx, cy); c.scale(pop, pop); c.rotate(Math.sin(age * 9) * 0.02 * (1 - Math.min(1, age)));
    g.rrect(-bw / 2, -bh / 2 + 6 * s, bw, bh, 24 * s, 'rgba(29,43,83,.55)');
    g.rrect(-bw / 2, -bh / 2, bw, bh, 24 * s, b.bad ? '#FFF4F1' : '#FFFBEF', NAVY, 3.5 * s);
    g.rrect(-bw / 2 + 6 * s, -bh / 2 + 6 * s, bw - 12 * s, bh - 12 * s, 18 * s, null, b.bad ? '#FF7A70' : '#FFC928', 2.5 * s);
    g.text(b.py, 0, -bh / 2 + 14 * s + fp * 0.65, { size: fp, font: 'py', color: '#16498F', maxW: bw - 40 * s });
    g.text(b.w, 0, bh / 2 - 12 * s - fw * 0.62, { size: fw, font: 'kai', color: NAVY, maxW: bw - 40 * s });
    if (b.bad) {
      // 真答错时：告诉孩子正确的一对（“记一记”小标签），不是庆祝的星星
      const tf = Math.round(clampN(15 * s, 13, 20)), tl = g.measure('记一记', tf, 'round') + 22 * s, th = tf + 12 * s;
      g.rrect(-tl / 2, -bh / 2 - th * 0.55, tl, th, th / 2, '#E8453C', NAVY, 2.4 * s);
      g.text('记一记', 0, -bh / 2 - th * 0.55 + th / 2 + 1, { size: tf, font: 'round', color: '#FFFFFF' });
    } else {
      g.emoji('⭐', -bw / 2 + 4 * s, -bh / 2 + 4 * s, 30 * s, { rot: age * 3 });
      g.emoji('⭐', bw / 2 - 4 * s, -bh / 2 + 4 * s, 26 * s, { rot: -age * 3 });
    }
    c.restore();
  }
  /* 横幅盖在牌桌正中：孩子一点屏幕就让它快速淡出（点击照常穿透去翻牌），别挡着找牌 */
  function hurryBanner(g) {
    const b = g.banner;
    if (!b) return;
    const dur = b.dur || 1.35, age = nowS() - b.t0;
    if (age > 0.25 && age < dur - 0.18) b.t0 = nowS() - (dur - 0.18);
  }

  /* ---------------- 主绘制 ---------------- */
  function drawAll(g, c) {
    const L = g.L;
    if (!L || !g.cards) return;
    const t = nowS(), s = L.s;
    // 牌桌：半透明白板 + 竹席纹
    const P = L.panel;
    g.rrect(P.x, P.y + 5 * s, P.w, P.h, 22 * s, 'rgba(20,40,90,.16)');
    g.rrect(P.x, P.y, P.w, P.h, 22 * s, 'rgba(255,250,235,.28)', 'rgba(255,255,255,.75)', 3 * s);
    // 连击 ≥3：牌桌边框变成流动的彩虹灯带（越连越亮），断连就慢慢熄灭
    const fever = (g.stage === 'play' || g.stage === 'clear') && g.combo >= 3 ? Math.min(1, 0.55 + g.combo * 0.08) : 0;
    g.feverK = (g.feverK || 0) + (fever - (g.feverK || 0)) * 0.08;
    if (g.feverK > 0.02) {
      c.save();
      c.globalAlpha = g.feverK * (0.7 + 0.3 * Math.sin(t * 7));
      rrPath(c, P.x - 4 * s, P.y - 4 * s, P.w + 8 * s, P.h + 8 * s, 25 * s);
      c.lineWidth = 9 * s; c.strokeStyle = 'hsl(' + ((345 + 55 * (0.5 + 0.5 * Math.sin(t * 5))) % 360 | 0) + ',100%,58%)'; c.stroke();
      c.setLineDash([16 * s, 14 * s]); c.lineDashOffset = -t * 90 * s;
      c.lineWidth = 3.5 * s; c.strokeStyle = '#FFFFFF'; c.stroke();
      c.restore();
    }
    if (g.stage === 'play' && g.timeLeft < 10) {   // 快没时间：牌桌边框红光一闪一闪
      c.save(); c.globalAlpha = 0.45 + 0.4 * Math.sin(t * 10);
      g.rrect(P.x - 3 * s, P.y - 3 * s, P.w + 6 * s, P.h + 6 * s, 24 * s, null, '#FF3B3B', 7 * s);
      c.restore();
    }
    // 已收走的牌位：虚线框
    c.save();
    c.setLineDash([6 * s, 6 * s]); c.lineWidth = 2 * s; c.strokeStyle = 'rgba(255,255,255,.6)';
    for (const cd of g.cards) {
      if (!cd.gone && !cd.matched) continue;
      const sl = L.slots[cd.slot];
      rrPath(c, sl.x - L.cw / 2 + 4 * s, sl.y - L.ch / 2 + 4 * s, L.cw - 8 * s, L.ch - 8 * s, 12 * s); c.stroke();
    }
    c.restore();
    // 牌：先画平放的，再画抬起 / 飞行中的
    for (const cd of g.cards) {
      cd.hover += ((g.hov === cd && g.stage === 'play' && !cd.up ? 1 : 0) - cd.hover) * 0.25;
      resolveMv(cd);
    }
    const lifted = g.liftBuf || (g.liftBuf = []);
    lifted.length = 0;
    for (const cd of g.cards) {
      if (cd.inChest || cd.gone) continue;
      if (cd.mv || cd.pop > 0.01 || cd.flip > 0.02 || cd.glow > 0.01) { lifted.push(cd); continue; }
      drawCard(g, c, cd, t, L);
    }
    for (const cd of lifted) if (!cd.mv) drawCard(g, c, cd, t, L);
    for (const cd of lifted) {
      if (!cd.mv) continue;
      // 飞回宝箱的牌拖一条金色星尘尾巴
      if (cd.mv.chest && t - (cd.trT || 0) > 0.03) { cd.trT = t; g.burst(cd.x, cd.y, { kind: 'dot', color: cd.kind === 'w' ? '#FFE45C' : '#9FE3FF', n: 2 }); }
      drawCard(g, c, cd, t, L);
    }
    // 键盘光标
    if (g.kbd && g.stage === 'play') {
      const sl = L.slots[g.kcur];
      if (sl) {
        const k = 0.5 + 0.5 * Math.sin(t * 7), e = (4 + k * 4) * s;
        rrPath(c, sl.x - L.cw / 2 - e, sl.y - L.ch / 2 - e, L.cw + e * 2, L.ch + e * 2, 16 * s);
        c.lineWidth = 9 * s; c.strokeStyle = NAVY; c.stroke();
        c.lineWidth = 5 * s; c.strokeStyle = '#FFE45C'; c.stroke();
        g.emoji('👇', sl.x, sl.y - L.ch / 2 - e - 16 * s - k * 6 * s, 30 * s);
      }
    }
    // 手指提示
    if (g.hintOn && g.stage === 'play') {
      let hc = g.hintCard;
      if (!hc || hc.up || hc.matched || hc.gone) {
        hc = null;
        let best = 1e9;
        for (const cd of g.cards) {
          if (cd.up || cd.matched || cd.gone || !cd.placed) continue;
          const d = Math.abs(cd.x - g.w / 2) + Math.abs(cd.y - (L.panel.y + L.panel.h / 2)) * 0.8;
          if (d < best) { best = d; hc = cd; }
        }
        g.hintCard = hc;
      }
      if (hc) {
        const k = (t * 1.2) % 1;
        c.globalAlpha = 1 - k; c.lineWidth = 4 * s; c.strokeStyle = '#FFFFFF';
        c.beginPath(); c.arc(hc.x, hc.y, 20 * s + k * Math.min(hc.w, hc.h) * 0.5, 0, TAU); c.stroke();
        c.globalAlpha = 0.65 + 0.35 * Math.sin(t * 9);
        const fy = hc.y + hc.h * 0.28 + Math.abs(Math.sin(t * 4)) * 12 * s;
        g.emoji('👆', hc.x + hc.w * 0.12, fy, Math.max(46 * s, Math.min(hc.w, hc.h) * 0.55), { rot: -0.2 });
        c.globalAlpha = 1;
      }
    }
    // 小猴子
    const m = g.monk;
    if (m) {
      const hop = Math.abs(Math.sin(t * 12)) * 10 * s;
      c.fillStyle = 'rgba(20,30,70,.22)'; c.beginPath(); c.ellipse(m.x, m.y + 30 * s, 20 * s, 6 * s, 0, 0, TAU); c.fill();
      g.emoji('🐒', m.x, m.y - hop, Math.max(54 * s, Math.min(L.cw, L.ch) * 0.6), { rot: Math.sin(t * 10) * 0.2, flip: m.flip });
    }
    drawBanner(g, c, L, t);
    drawTimer(g, c, L, t);
    drawPanda(g, c, L, t);
    drawGlasses(g, c, L, t);
    drawChest(g, c, L, t);
  }

  /* ---------------- 游戏逻辑 ---------------- */
  function newCard(it, wi, kind) {
    return { item: it, wi, kind, slot: 0, x: 0, y: 0, tx: 0, ty: 0, w: 60, h: 80, rot: 0, sc: 1, flip: 0, up: false,
      placed: false, inChest: true, gone: false, matched: false, known: false, swapping: false,
      mv: null, mvTw: null, flTw: null, flDl: null, shake: 0, red: 0, glow: 0, pop: 0, hover: 0, alpha: 1,
      ph: Math.random() * TAU, lines: [''], fs: 20 };
  }
  const PRAISE = ['配对成功！', '好眼力！', '记得真牢！', '太棒啦！', '厉害厉害！', '就是它！'];

  function noteFor(a, b) {
    const A = a.item, B = b.item;
    if (a.kind === 'w' && b.kind === 'p') return '“' + A.w + '”的拼音是 ' + A.py + '，你配成了 ' + B.py;
    if (a.kind === 'p' && b.kind === 'w') return A.py + ' 是“' + A.w + '”，你配成了“' + B.w + '”';
    if (a.kind === 'w') return '“' + A.w + '”要配拼音牌 ' + A.py + '，你翻成了词语牌“' + B.w + '”';
    return A.py + ' 要配词语牌“' + A.w + '”，你翻成了拼音牌 ' + B.py;
  }

  function deal(g) {
    const L = g.L, s = L.s;
    g.stage = 'deal';
    g.tween(g, { chestOpen: 1 }, 0.3, 'outBack');
    g.sfx('whoosh');
    bubble(g, '发牌啦！看好它们～', 2);
    const order = g.cards.slice().sort((a, b) => a.slot - b.slot);
    const st = Math.min(0.07, 1.3 / order.length);
    order.forEach((cd, i) => g.after(0.25 + i * st, () => {
      cd.inChest = false;
      cd.x = L.chest.x; cd.y = L.chest.y - 14 * s; cd.sc = 0.2; cd.rot = g.rand(-2.5, 2.5);
      moveCard(g, cd, cd.tx, cd.ty, 0.55, { arc: g.rand(50, 110) * s, s1: 1, rot1: 0, ease: 'outBack', slot: true,
        onDone: () => { cd.placed = true; g.burst(cd.x, cd.y + cd.h * 0.45, { kind: 'dot', color: '#FFFFFF', n: 4 }); } });
      g.sfx('flip');
    }));
    g.after(0.25 + order.length * st + 0.6, () => { g.tween(g, { chestOpen: 0 }, 0.25); startPeek(g); });
  }

  function startPeek(g) {
    const L = g.L;
    g.stage = 'peek';
    g.peekMax = peekFor(g.level, g.gradeNum); g.peekLeft = g.peekMax + 0.35;
    const wave = (cd) => ((L.slots[cd.slot].c + L.slots[cd.slot].r) * 0.04);
    g.cards.forEach((cd) => setFlip(g, cd, 1, 0.3, wave(cd) + 0.001));
    g.sfx('flip');
    bubble(g, '记住位置！马上盖住啦', g.peekMax + 0.6);
    g.after(0.35 + g.peekMax, () => {
      g.cards.forEach((cd) => setFlip(g, cd, 0, 0.3, wave(cd) + 0.001));
      g.sfx('whoosh');
      g.after(0.55, () => {
        g.stage = 'play';
        g.idleT = 0;
        g.hintOn = g.level === 1 && !g.tapsEver;
        bubble(g, '翻两张：词语配拼音！', 2.6);
      });
    });
  }

  function cardAt(g, p) {
    for (let i = g.cards.length - 1; i >= 0; i--) {
      const cd = g.cards[i];
      if (cd.gone || cd.inChest) continue;
      if (g.hitRect(p, cd.x - cd.w / 2 - 2, cd.y - cd.h / 2 - 2, cd.w + 4, cd.h + 4)) return cd;
    }
    return null;
  }
  const cardInSlot = (g, i) => g.cards.find((cd) => cd.slot === i && !cd.gone && !cd.matched) || null;
  /* 键盘：从槽 i 往 k 方向走一格（行尾换行），返回新槽号（走不动 = 原值） */
  function stepSlot(g, i, k) {
    const L = g.L, n = g.cards.length, cur = L.slots[i] || L.slots[0];
    let r = cur.r, cc = cur.c;
    if (k === 'left') cc--; else if (k === 'right') cc++; else if (k === 'up') r--; else r++;
    r = clampN(r, 0, L.rows - 1);
    const inRow = r === L.rows - 1 ? n - r * L.cols : L.cols;
    if (cc < 0) { if (r > 0 && k === 'left') { r--; cc = L.cols - 1; } else cc = 0; }
    else if (cc > inRow - 1) { if (k === 'right' && r < L.rows - 1) { r++; cc = 0; } else cc = inRow - 1; }
    const rowIn = r === L.rows - 1 ? n - r * L.cols : L.cols;
    return clampN(r * L.cols + Math.min(cc, rowIn - 1), 0, n - 1);
  }
  /* 光标停在已收走的空位上 → 挪到离它最近、还在桌上的牌 */
  function kbdFix(g) {
    if (!g.L || cardInSlot(g, g.kcur)) return;
    const L = g.L, s0 = L.slots[g.kcur] || L.slots[0];
    let best = -1, bd = 1e9;
    for (const cd of g.cards) {
      if (cd.matched || cd.gone) continue;
      const sl = L.slots[cd.slot];
      const d = Math.hypot(sl.x - s0.x, (sl.y - s0.y) * 1.2);
      if (d < bd) { bd = d; best = cd.slot; }
    }
    if (best >= 0) g.kcur = best;
  }

  function tapCard(g, cd) {
    if (g.stage !== 'play' || g.state !== 'play' || g.lock > 0 || !cd) return false;
    if (cd.matched || cd.gone || !cd.placed || cd.mv || cd.swapping || cd.up) return false;
    g.idleT = 0; g.hintOn = false; g.tapsEver = (g.tapsEver || 0) + 1;
    if (g.open.length >= 2) { resolvePending(g); if (g.stage !== 'play' || g.state !== 'play') return false; }
    setFlip(g, cd, 1, 0.26);
    g.sfx('flip');
    g.open.push(cd);
    if (g.open.length === 2) evaluate(g, g.open[0], g.open[1]);
    else if ((g.tipN || 0) < 3) { g.tipN = (g.tipN || 0) + 1; bubble(g, cd.kind === 'w' ? '再找它的拼音牌！' : '再找它的词语牌！', 2); }
    return true;
  }

  function evaluate(g, a, b) {
    if (a.wi === b.wi && a.kind !== b.kind) {
      a.matched = b.matched = true;
      g.open = [];
      g.matchedN++;
      // 最后一对：立刻停表、停猴子、停输入（否则 0.27 秒的翻牌动画里时间可能恰好走完 → 全配完却判“时间到”）
      if (g.matchedN >= g.rounds) { g.stage = 'clear'; g.hintOn = false; }
      g.after(0.27, () => doMatch(g, a, b));
      return;
    }
    const knewB = b.known;
    const pa = g.cards.find((x) => x !== a && x.wi === a.wi);
    const knewPartner = !!(pa && pa.known && !pa.matched);
    a.known = true; b.known = true;
    const pend = { a, b, fed: false, knewB, knewPartner, fb: null, tm: null };
    g.pend = pend;
    pend.fb = g.after(0.26, () => feedback(g, pend));
    pend.tm = g.after(1.05, () => { if (g.pend === pend) resolvePending(g); });
  }

  function feedback(g, p) {
    if (p.fed) return;
    p.fed = true;
    const a = p.a, b = p.b;
    [a, b].forEach((cd) => { cd.shake = 1; cd.red = 1; g.tween(cd, { shake: 0, red: 0 }, 0.6, 'outQuad'); });
    const mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2;
    g.pd.sadT = nowS();
    if (p.knewB) {
      // 屏幕上也告诉孩子正确的一对（错题本里的 note 同样写明）
      g.banner = { w: a.item.w, py: a.item.py, t0: nowS(), dur: 2.1, bad: true };
      if (g.grace > 0) {
        // 前 3 关第一次“翻过的牌又翻错”只警告不扣心：先让孩子知道这条规则，下次才真扣
        g.grace--;
        g.combo = 0;
        g.sfx('bad'); g.shake(6);
        g.float('⚠ 小心', b.x, b.y - b.h * 0.3, { color: '#FFE45C', size: 34 });   // 飘在“翻过的那张”上
        bubble(g, '这张翻过哦！下次要扣心啦', 2.4);
        g.say(a.item.w, { caption: a.item.py });
        return;
      }
      g.wrong(a.item, noteFor(a, b), mx, my);
      bubble(g, '这张翻过呀，再想想～', 2);
      if (g.state === 'play') g.say(a.item.w, { caption: a.item.py });
      if (g.state === 'over') {
        // 心没了：别让 1.05 秒后的“翻回去”定时器把这对错牌又盖上（结束画面要能看到答案）
        g.stage = 'over';
        if (p.tm) p.tm.cancel();
        if (g.pend === p) g.pend = null;
        g.open = [];
        revealAll(g, 0.2);
      }
    } else {
      g.combo = 0;
      g.sfx('bad');
      g.shake(3);
      bubble(g, p.knewPartner ? '它的朋友你翻过哦！' : '不是一对，记住它们～', 2);
    }
  }

  function resolvePending(g) {
    const p = g.pend;
    g.pend = null;
    if (p) {
      if (p.fb) p.fb.cancel();
      if (p.tm) p.tm.cancel();
      if (!p.fed) feedback(g, p);
      if (g.stage === 'over') return;   // 这一下扣光了心：牌保持翻开
      if (!p.a.matched) setFlip(g, p.a, 0, 0.24);
      if (!p.b.matched) setFlip(g, p.b, 0, 0.24);
    }
    g.open = g.open.filter((cd) => !p || (cd !== p.a && cd !== p.b));
  }

  function doMatch(g, a, b) {
    const L = g.L, s = L.s;
    g.sfx('match');
    [a, b].forEach((cd) => {
      cd.glow = 1; cd.pop = 0;
      g.tween(cd, { pop: 1 }, 0.16, 'outQuad', () => g.tween(cd, { pop: 0 }, 0.35, 'outBack'));
      g.burst(cd.x, cd.y, { kind: 'star', n: 9 });
      g.ring(cd.x, cd.y, '#FFE45C', Math.max(cd.w, cd.h) * 0.9);
    });
    const mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2;
    const it = a.item;
    g.banner = { w: it.w, py: it.py, t0: nowS() };
    g.pd.hopT = nowS();
    bubble(g, g.pick(PRAISE), 1.6);
    g.say(it.w, { caption: it.py });
    if (g.matchedN >= g.rounds && g.timeLeft > 0) {
      const bonus = Math.ceil(g.timeLeft) * 2;
      g.addScore(bonus);
      g.float('⏱ 时间奖励 +' + bonus, g.w / 2, L.panel.y + L.panel.h * 0.3, { color: '#9CFFB0', size: 30, life: 1.8 });
    }
    g.right(it, mx, my);
    if (g.state === 'over') g.stage = 'over';
    if (g.kbd) kbdFix(g);   // 键盘光标别停在刚收走的空位上
    g.after(0.5, () => flyToChest(g, a));
    g.after(0.6, () => flyToChest(g, b));
  }

  function flyToChest(g, cd) {
    const L = g.L, s = L.s;
    g.flyN = (g.flyN || 0) + 1;
    g.tween(g, { chestOpen: 1 }, 0.2, 'outBack');
    g.tween(cd, { glow: 0 }, 0.5);
    moveCard(g, cd, L.chest.x, L.chest.y - 10 * s, 0.6, { arc: 130 * s, s1: 0.16, rot1: g.rand(-3, 3), ease: 'inOutQuad', chest: true,
      onDone: () => {
        cd.gone = true; g.chestN++; g.chestHitT = nowS(); g.flyN--;
        g.sfx('coin');
        g.burst(L.chest.x, L.chest.y - 24 * s, { kind: 'coin', n: 6 });
        g.burst(L.chest.x, L.chest.y - 24 * s, { kind: 'spark', n: 8 });
        g.after(0.35, () => { if (!g.flyN) g.tween(g, { chestOpen: 0 }, 0.25); });
      } });
  }

  function useGlasses(g) {
    if (g.stage !== 'play' || g.state !== 'play' || g.glasses <= 0 || g.lock > 0 || g.monk) return false;
    if (g.pend) { resolvePending(g); if (g.stage !== 'play' || g.state !== 'play') return false; }
    g.glasses--; g.lock = 1.6; g.glT = nowS(); g.idleT = 0; g.hintOn = false;
    g.sfx('power'); g.flash('#D6F4FF');
    const list = g.cards.filter((cd) => !cd.matched && !cd.gone && !cd.up && cd.placed && !cd.mv);
    list.forEach((cd, i) => setFlip(g, cd, 1, 0.25, 0.001 + 0.02 * i));
    g.after(1.25, () => list.forEach((cd, i) => { if (!cd.matched && g.open.indexOf(cd) < 0) setFlip(g, cd, 0, 0.25, 0.001 + 0.015 * i); }));
    bubble(g, '👓 透视！快记住！', 1.6);
    return true;
  }

  function startMonkey(g) {
    const cand = g.cards.filter((cd) => cd.placed && !cd.matched && !cd.gone && !cd.up && !cd.mv && !cd.swapping && g.open.indexOf(cd) < 0);
    if (cand.length < 3) return false;
    const sh = g.shuffle(cand), A = sh[0], B = sh[1];
    const L = g.L, s = L.s;
    A.swapping = B.swapping = true; A.known = false; B.known = false;
    const fromLeft = A.x < g.w / 2;
    const m = { x: fromLeft ? -50 * s : g.w + 50 * s, y: A.y - A.h * 0.2, flip: !fromLeft };
    g.monk = m;
    g.sfx('whoosh');
    bubble(g, '小猴子来调包啦！盯住！', 2.4);
    g.tween(m, { x: A.x, y: A.y - A.h * 0.35 }, 0.6, 'outQuad', () => {
      g.sfx('swing');
      const sa = A.slot; A.slot = B.slot; B.slot = sa;
      [A, B].forEach((cd) => { cd.tx = L.slots[cd.slot].x; cd.ty = L.slots[cd.slot].y; cd.placed = false; });
      const done = (cd) => () => { cd.placed = true; cd.swapping = false; };
      moveCard(g, A, A.tx, A.ty, 0.8, { arc: 60 * s, perp: true, ease: 'inOutQuad', slot: true, rot1: 0, onDone: done(A) });
      moveCard(g, B, B.tx, B.ty, 0.8, { arc: 60 * s, perp: true, ease: 'inOutQuad', slot: true, rot1: 0, onDone: done(B) });
      m.flip = A.tx < m.x;
      g.tween(m, { x: A.tx, y: A.ty - A.h * 0.35 }, 0.8, 'inOutQuad', () => {
        g.float('🐒 调包！', m.x, m.y - 20 * s, { color: '#FFB347', size: 28 });
        g.sfx('pop');
        const out = m.x < g.w / 2 ? -60 * s : g.w + 60 * s;
        m.flip = out < m.x;
        g.tween(m, { x: out, y: m.y - 40 * s }, 0.55, 'inQuad', () => { g.monk = null; g.monkeyT = monkeyGap(g.level); });
      });
    });
    return true;
  }

  /* 点到小猴子正在调包的牌：翻不了，但要告诉孩子为什么（不然以为坏了） */
  function monkeyBusy(g) {
    if (nowS() - (g.busyT || 0) < 1.2) return;
    g.busyT = nowS();
    g.sfx('tick');
    bubble(g, '等小猴子换完再翻！', 1.4);
  }

  function timeUp(g) {
    g.stage = 'over';
    const L = g.L;
    // 时间到不算答错：取消待处理的翻错（不扣心、不记错题），只把牌翻回去
    const p = g.pend;
    g.pend = null; g.open = [];
    if (p) { if (p.fb) p.fb.cancel(); if (p.tm) p.tm.cancel(); }
    g.hintOn = false; g.kbd = false;
    g.sfx('bad'); g.shake(6);
    g.float('⏰ 时间到！', g.w / 2, L.panel.y + L.panel.h * 0.45, { color: '#FFE45C', size: 46, life: 2.2 });
    bubble(g, '看，它们原来在这儿！', 2.4);
    g.pd.sadT = nowS();
    // 先把没配上的牌一波翻开让孩子看清答案，再进结束画面（结束遮罩一出来画面就糊了）
    revealAll(g, 0.15);
    g.after(1.5, () => g.lose());
  }
  /* 结束时把没配上的牌全部翻开，让孩子看到答案 */
  function revealAll(g, delay) {
    g.cards.forEach((cd, i) => { if (!cd.matched && !cd.gone) setFlip(g, cd, 1, 0.3, delay + 0.03 * i); });
  }

  /* ---------------- spec ---------------- */
  function makeSpec() {
    return {
      maxLevel: 10, lives: 3, music: 'bright', sky: 'day',
      rounds: (lv) => pairsFor(lv),
      intro: '翻开两张牌，把词语和它的拼音配成一对！',
      controls: '点牌翻开 · 方向键+空格 · 👓 透视（E）',
      init(g) {
        const words = chooseWords(g, pairsFor(g.level));
        g.words = words;
        g.rounds = Math.max(1, words.length);
        g.cards = [];
        words.forEach((it, i) => { g.cards.push(newCard(it, i, 'w')); g.cards.push(newCard(it, i, 'p')); });
        const order = g.shuffle(g.cards.map((_, i) => i));
        g.cards.forEach((cd, i) => { cd.slot = order[i]; });
        g.stage = 'ready';
        g.open = []; g.pend = null; g.lock = 0; g.matchedN = 0;
        g.timeMax = timeFor(g.level, g.rounds, g.gradeNum); g.timeLeft = g.timeMax; g.lastTick = -1;
        g.peekMax = peekFor(g.level, g.gradeNum); g.peekLeft = g.peekMax;
        g.glasses = glassesFor(g.level); g.glT = -9;
        g.chestOpen = 0; g.chestHitT = -9; g.chestN = 0; g.flyN = 0;
        g.monkeyT = monkeyGap(g.level) ? 9 : 0; g.monk = null;
        g.hintOn = false; g.hintCard = null; g.idleT = 0; g.hov = null;
        g.grace = g.level <= 3 ? 1 : 0;
        g.kbd = false; g.kcur = 0;
        g.pd = { hopT: -9, sadT: -9 };
        g.bub = null; g.banner = null; g.feverK = 0; g.earlyT = 0;
        g.L = null;
        layout(g);
        bubble(g, g.level >= 5 ? '小心调皮的小猴子！' : '准备好了吗？', 3);
        W.__hwMemory = g;
      },
      play(g) { deal(g); },
      update(g, dt) {
        if (g.lock > 0) g.lock = Math.max(0, g.lock - dt);
        if (g.stage === 'peek') g.peekLeft = Math.max(0, g.peekLeft - dt);
        if (g.stage !== 'play') return;
        g.timeLeft -= dt;
        const sec = Math.ceil(g.timeLeft);
        if (g.timeLeft < 5.5 && sec !== g.lastTick && sec > 0) { g.lastTick = sec; g.sfx('tick'); }
        if (g.timeLeft <= 0) { g.timeLeft = 0; timeUp(g); return; }
        g.idleT += dt;
        if (!g.hintOn && g.idleT > 7 && g.open.length === 0) g.hintOn = true;
        if (g.monkeyT > 0 && !g.monk && !(g.lock > 0)) {
          g.monkeyT -= dt;
          if (g.monkeyT <= 0 && !startMonkey(g)) g.monkeyT = 2;
        }
      },
      draw(g, c) { drawAll(g, c); },
      down(g, p) {
        if (!g.L) return;
        g.kbd = false;
        if (g.stage === 'play') hurryBanner(g);
        const b = g.L.glass;
        if (g.hitCircle(p, b.x, b.y, b.r * 1.3)) { if (!useGlasses(g) && g.glasses <= 0) bubble(g, '透视用完啦～', 1.4); return; }
        const pd = g.L.panda;
        if (g.hitCircle(p, pd.x, pd.y, pd.size * 0.6)) { g.pd.hopT = nowS(); g.sfx('jump'); bubble(g, g.pick(['加油！', '你能行！', '词语配拼音哦～']), 1.4); return; }
        const cd = cardAt(g, p);
        if (!cd) return;
        if (g.stage === 'peek' || g.stage === 'deal') {
          // 偷看 / 发牌时点牌：不翻，但要有反应（不然孩子以为坏了）
          if (nowS() - (g.earlyT || 0) > 1.2) { g.earlyT = nowS(); bubble(g, g.stage === 'peek' ? '先记住位置，马上就能翻！' : '牌还在发哦～', 1.6); }
          if (!cd.mv) { cd.shake = 0.5; g.tween(cd, { shake: 0 }, 0.35, 'outQuad'); }
          return;
        }
        if (tapCard(g, cd)) g.kcur = cd.slot;
        else if (g.stage === 'play' && cd.up && !cd.matched && g.open.length === 1) { cd.shake = 0.4; g.tween(cd, { shake: 0 }, 0.3, 'outQuad'); }
        else if (g.stage === 'play' && cd.swapping) monkeyBusy(g);
      },
      move(g, p) {
        if (!g.L) return;
        const cd = cardAt(g, p);
        g.hov = cd && !cd.up && !cd.matched ? cd : null;
        const b = g.L.glass;
        const hand = !!g.hov || g.hitCircle(p, b.x, b.y, b.r * 1.3);
        try { g.c.canvas.style.cursor = hand ? 'pointer' : ''; } catch (e) { /* ignore */ }
      },
      key(g, k) {
        if (!g.L) return;
        const n = g.cards.length;
        if (k === 'left' || k === 'right' || k === 'up' || k === 'down') {
          if (!g.kbd) { g.kbd = true; kbdFix(g); return; }
          if (k === 'up' || k === 'down') {
            // 上下：去那个方向最近一行里、横向离得最近的牌（正下方那张已经收走时也能走过去，不会卡住）
            const L = g.L, cur0 = L.slots[g.kcur] || L.slots[0];
            let best = -1, bd = 1e9;
            for (const cd of g.cards) {
              if (cd.matched || cd.gone) continue;
              const sl = L.slots[cd.slot], dr = sl.r - cur0.r;
              if (k === 'down' ? dr <= 0 : dr >= 0) continue;
              const d = Math.abs(dr) * 1e4 + Math.abs(sl.x - cur0.x);
              if (d < bd) { bd = d; best = cd.slot; }
            }
            if (best >= 0) { g.kcur = best; g.sfx('tick'); }
            return;
          }
          // 左右：跳过已经收走的空位，一直往这个方向找（行尾接下一行），找到还在桌上的牌才停
          let cur = g.kcur;
          for (let i = 0; i < n; i++) {
            const nx = stepSlot(g, cur, k);
            if (nx === cur) break;
            cur = nx;
            if (cardInSlot(g, cur)) { g.kcur = cur; g.sfx('tick'); return; }
          }
          return;
        }
        if (k === 'space' || k === 'enter') {
          // 第一次按键只亮出光标（不然不知道翻的是哪张）；光标停在空位上时先跳到最近的牌
          if (!g.kbd) { g.kbd = true; kbdFix(g); if (g.stage === 'play') bubble(g, '方向键选牌，空格翻开！', 2); return; }
          if (!cardInSlot(g, g.kcur)) { kbdFix(g); return; }
          const kc = cardInSlot(g, g.kcur);
          if (tapCard(g, kc)) hurryBanner(g);
          else if (g.stage === 'play' && kc.swapping) monkeyBusy(g);
          return;
        }
        if (k === 'e' || k === 'E' || k === 'g' || k === 'G') useGlasses(g);
      },
      resize(g) { if (g.cards) layout(g); },
      end(g) { g.monk = null; g.pend = null; if (W.__hwMemory === g) W.__hwMemory = null; }
    };
  }

  HW.register({
    id: 'memory', skill: 'read', kind: 'arcade', name: '拼音翻翻乐', icon: '🃏',
    blurb: '翻牌配对：词语配拼音', cols: ['words'],
    start(ctx) { return HW.arcade.run(ctx, makeSpec()); }
  });
})();
