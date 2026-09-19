/* =====================================================================
 * 华文小岛 2.0 · 街机游戏 🎈 气球射击（parts/41_balloon.js）
 * 听词语（pick.say；再听时第 2 遍读例句 ctx），小猫炮台发射飞镖，戳破写对的气球。
 * 正确答案严格取题库 c[a]：每个气球记住自己的选项下标 oi，oi === a 才算对（打乱顺序不影响）。
 * 画面：引擎 day 背景 + 远处小气球视差 + 会摇摆的飞艇（点它 / 🔊 / 空格 重听）+ 小猫炮台。
 * 关卡：越高越快、同屏气球越多（选项重复出现）、第 4 关起有风；第 2 关起有金星奖励气球，
 *       第 3 关起丢过心后可能飘来一只爱心气球（戳破回 1 颗心）。
 * ===================================================================== */
(function () {
  'use strict';
  const W = window;
  const HW = W.HW;
  if (!HW || typeof HW.register !== 'function') return;

  const NAVY = '#1d2b53';
  const TAU = Math.PI * 2;
  const COLORS = ['#FF4D5E', '#FF9F1C', '#F5C400', '#2FC25B', '#3AA0FF', '#9B6BFF', '#FF5FAE', '#12BFAE'];
  const PUNCT = '，。！？、：；”“‘’…—,.!?;:';
  const PRAISE = ['好耳朵！', '真厉害！', '太棒了！', '听对啦！', '神射手！'];
  const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
  const nowMs = () => (W.performance && performance.now ? performance.now() : Date.now());
  function rgb(h) { const n = parseInt(String(h).slice(1), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; }
  function mix(a, b, t) { const A = rgb(a), B = rgb(b); return 'rgb(' + A.map((v, i) => Math.round(v + (B[i] - v) * t)).join(',') + ')'; }
  const outBack = (t) => { const s = 1.70158, u = t - 1; return u * u * ((s + 1) * u + s) + 1; };
  function validItem(it) {
    return !!it && typeof it.say === 'string' && Array.isArray(it.c) && it.c.length >= 2 &&
      Number.isInteger(it.a) && it.a >= 0 && it.a < it.c.length && typeof it.c[it.a] === 'string';
  }
  /* 气球上的字：≤3 字一行；4 字 2+2；5–6 字 3+2 / 3+3；7 字 4+3 */
  function splitLines(str) {
    const a = Array.from(str), n = a.length;
    if (n <= 3) return [str];
    const k = n === 4 ? 2 : Math.ceil(n / 2);
    return [a.slice(0, k).join(''), a.slice(k).join('')];
  }
  function sizeK(n) { return n <= 2 ? 1 : n === 3 ? 1.14 : n === 4 ? 1.02 : n <= 6 ? 1.14 : 1.3; }

  function makeSpec(ctx) {
    const st = {
      g: null, L: { S: 1, w: 0, h: 0 }, list: [], qi: 0, wave: null,
      balls: [], darts: [], pops: [], strs: [], splats: [], amb: [], streaks: [], bunch: [], freed: [],
      clock: 0, last: 0, aim: -Math.PI / 2, aimTo: -Math.PI / 2, recoil: 0, fireCd: 0,
      cat: { face: '🐱', t: 0, y: 0, vy: 0, shake: 0 },
      sel: null, hover: null, kbd: false, reveal: null, bKey: '', bK: 0,
      wind: 0, windAmp: 0, windPh: 0, starT: 0, heartT: -1, heartUsed: false,
      hintOn: false, tipT: 0, btnPress: 0, btnPulse: 0, cruise: 60, empty: false, grad: new Map(), overDone: false,
      shots: 0
    };
    const ttsOk = () => { try { return !!(ctx.tts && ctx.tts.ok); } catch (e) { return false; } };

    /* ---------------- 布局 ---------------- */
    function lay(g) {
      const L = st.L;
      L.w = g.w; L.h = g.h;
      L.S = clamp(Math.min(g.w, (g.h - g.hudTop) * 0.8) / 390, 0.88, 1.45);
      const S = L.S;
      L.m = 10 * S;
      L.px = g.w / 2; L.py = g.h - 64 * S;          // 炮台转轴（圆顶中心）
      L.barrel = 66 * S;
      L.br = 30 * S; L.bx = 14 * S + L.br; L.by = g.h - 22 * S - L.br;   // 🔊 按钮
      L.bw = Math.min(g.w * 0.58, 250 * S); L.bh = L.bw * 0.27;
      L.blY = g.hudTop + L.bh / 2 + 8 * S;
      L.catX = L.px + 64 * S; L.catY = L.py + 20 * S;
      st.grad.clear();
    }
    function refit(b) {
      const S = st.L.S;
      if (b.kind === 'q') {
        const n = Array.from(b.text).length;
        b.rx = 47 * S * sizeK(n); b.ry = b.rx * 1.17;
        b.lines = splitLines(b.text);
        const maxc = Math.max.apply(null, b.lines.map((l) => Array.from(l).length));
        b.fs = Math.floor(Math.min(b.rx * 0.8, b.rx * (b.lines.length > 1 && maxc >= 3 ? 1.7 : 1.62) / maxc, b.lines.length > 1 ? b.ry * 0.6 : b.ry));
      } else { b.rx = 34 * S; b.ry = b.rx * 1.17; b.lines = null; b.fs = 0; }
    }
    function mkBall(kind, text, oi, ok, col) {
      const b = { kind, text, oi, ok, col, w: null, x: 0, y: 0, dx: 0, dy: 0, vy: 60, amp: 8, freq: 1.2, ph: Math.random() * TAU,
        wk: 0.7 + Math.random() * 0.5, px: 0, age: 0, ev: 0, rot: 0, vxv: 0, wob: 0, sc: 1, a: 1, state: 'up', locked: false, dead: false, rx: 40, ry: 47, lines: null, fs: 20 };
      refit(b);
      return b;
    }
    function gradFor(c, col, rx, ry) {
      const key = col + '|' + Math.round(rx);
      let gr = st.grad.get(key);
      if (!gr) {
        gr = c.createRadialGradient(-rx * 0.38, -ry * 0.45, rx * 0.08, -rx * 0.1, -ry * 0.1, ry * 1.25);
        gr.addColorStop(0, mix(col, '#FFFFFF', 0.62)); gr.addColorStop(0.42, col); gr.addColorStop(1, mix(col, '#000000', 0.32));
        st.grad.set(key, gr);
      }
      return gr;
    }

    /* ---------------- 出题（一波气球 = 一道题） ---------------- */
    function waveCount(g, maxLen) {
      const lv = g.level;
      let n = lv <= 2 ? 3 : lv <= 4 ? 4 : lv <= 6 ? 5 : lv <= 8 ? 6 : 7;
      if (maxLen >= 5) n = Math.min(n, 5);
      return n;
    }
    function spawnWave(g, it, prev) {
      if (g.state !== 'play') return;
      const L = st.L, S = L.S;
      const ans = it.c[it.a];
      const wv = { it, ans, state: 'open', listens: 0, tries: prev ? prev.tries + 1 : 0, t: 0, wrongs: prev ? prev.wrongs : 0 };
      st.wave = wv;
      // 选项：正确答案 + 干扰项（1–2 关只放 2 个干扰）；高关把选项重复放（多数重复干扰项，9 关起正确项也可能重复）
      const others = g.shuffle(it.c.map((s, i) => i).filter((i) => i !== it.a && typeof it.c[i] === 'string' && it.c[i] !== ans));
      const maxLen = Math.max.apply(null, it.c.map((s) => Array.from(String(s)).length));
      const n = waveCount(g, maxLen);
      const nd = Math.min(others.length, g.level <= 2 ? 2 : 3);
      const base = [it.a].concat(others.slice(0, nd));
      const idx = base.slice();
      while (idx.length < n) idx.push(idx.length === 6 && g.level >= 9 ? it.a : base[1 + Math.floor(Math.random() * Math.max(1, nd))] || it.a);
      const order = g.shuffle(idx);
      const cols = g.shuffle(COLORS);
      const balls = order.map((oi, i) => { const b = mkBall('q', it.c[oi], oi, oi === it.a, cols[i % cols.length]); b.w = wv; return b; });
      // 排队形：按屏宽分列，放不下就分几排从下面依次升上来（奇数排错开半格）
      const rxMax = Math.max.apply(null, balls.map((b) => b.rx));
      const lane = 2 * rxMax + 14 * S;
      const colsN = clamp(Math.floor((g.w - 2 * L.m) / lane), 2, balls.length);
      const laneW = (g.w - 2 * L.m) / colsN;
      const vy = st.cruise * g.rand(0.96, 1.04);
      let k = 0, row = 0;
      while (k < balls.length) {
        const cnt = Math.min(colsN, balls.length - k);
        const lanes = g.shuffle(Array.from({ length: colsN }, (_, i) => i)).slice(0, cnt);
        const shift = (row % 2 && cnt < colsN) ? laneW * 0.5 * (Math.random() < 0.5 ? -1 : 1) : 0;
        for (let j = 0; j < cnt; j++, k++) {
          const b = balls[k];
          const x = L.m + laneW * (lanes[j] + 0.5) + shift + g.rand(-laneW * 0.1, laneW * 0.1);
          b.x = clamp(x, L.m + b.rx + 4 * S, g.w - L.m - b.rx - 4 * S);
          b.y = g.h + b.ry * 1.15 + row * b.ry * 2.15 + g.rand(0, b.ry * (colsN >= balls.length ? 0.9 : 0.45));
          b.vy = vy * g.rand(0.97, 1.03);
          b.ev = 560 * S;   // 入场冲劲：约 1 秒内冲进画面，再慢慢飘
          b.amp = Math.min((6 + Math.min(10, g.level)) * S, Math.max(4 * S, (laneW - 2 * rxMax) / 2 + 3 * S)) * g.rand(0.7, 1.1);
          b.freq = g.rand(0.9, 1.5) + g.level * 0.05;
          b.dx = b.x; b.dy = b.y;
        }
        row++;
      }
      st.balls.push.apply(st.balls, balls);
      // 上一题的例句横幅还挂着：先让它收起（0.3 秒），新词等气球冒头、横幅收好再读，
      // 免得“旧例句 + 新读音”同时出现（无朗读时拼音横幅也会被旧例句挡住）
      const say = () => { if (g.state === 'play' && st.wave === wv && wv.state === 'open') { g.say(it.say, { caption: it.py || '' }); st.btnPulse = 1; } };
      if (st.reveal && st.reveal.t < st.reveal.life - 0.3) { st.reveal.life = st.reveal.t + 0.3; g.after(0.35, say); }
      else say();
      st.btnPulse = 1;
      if (prev) g.float('再放一轮！', g.w / 2, g.h * 0.48, { color: '#FFFFFF', size: 30 });
    }
    function nextWave(g) {
      if (g.state !== 'play') return;
      const it = st.list[st.qi];
      if (it) spawnWave(g, it, null);
    }
    function replay(g) {
      const wv = st.wave;
      if (!wv || g.state !== 'play') return;
      wv.listens++;
      st.btnPulse = 1; st.btnPress = 1;
      if (!ttsOk()) {
        // 没有朗读：例句已经挖空印在横幅上，字幕只放这个词的拼音（整句自动注音会有“· ·”缺字），
        // 横幅重新弹一下，让“再听”按钮看得见反馈
        g.say(wv.it.say, { caption: wv.it.py || '' });
        st.bK = 0;
        return;
      }
      const useCtx = wv.listens % 2 === 1 && typeof wv.it.ctx === 'string' && wv.it.ctx;
      if (useCtx) g.say(wv.it.ctx); else g.say(wv.it.say, { caption: wv.it.py || '' });
    }
    function spawnBonus(g, kind) {
      const L = st.L, S = L.S;
      const b = mkBall(kind, kind === 'star' ? '⭐' : '❤️', -1, false, kind === 'star' ? '#FFC21A' : '#FF5F8F');
      b.x = g.rand(L.m + b.rx + 30 * S, g.w - L.m - b.rx - 30 * S);
      b.y = g.h + b.ry * 1.4; b.dx = b.x; b.dy = b.y;
      b.vy = st.cruise * (kind === 'star' ? 1.85 : 1.35); b.ev = 300 * S;
      b.amp = 20 * S; b.freq = 2.3;
      st.balls.push(b);
    }

    /* ---------------- 射击 ---------------- */
    function pivotAim(tx, ty) {
      const a = Math.atan2(ty - st.L.py, tx - st.L.px);
      // 只朝上方（-170° … -10°）
      if (a > 0) return a > Math.PI / 2 ? -Math.PI + 0.17 : -0.17;
      return clamp(a, -Math.PI + 0.17, -0.17);
    }
    /* 已经有飞镖飞向本题的某个选项气球：先等它扎到（约 0.2 秒）再接受下一发，
       免得手快连点两只时，后点的（错的）先扎到而白扣一颗心 */
    function waveBusy(b) {
      if (!b || b.kind !== 'q' || !b.w) return false;
      for (const d of st.darts) if (!d.dead && d.tb && d.tb.kind === 'q' && d.tb.w === b.w && !d.tb.dead) return true;
      return false;
    }
    function fire(g, b, tx, ty) {
      const L = st.L, S = L.S;
      if (b) { tx = b.dx; ty = b.dy; }
      st.aimTo = pivotAim(tx, ty); st.aim = st.aimTo;
      const mx = L.px + Math.cos(st.aim) * (L.barrel + 6 * S), my = L.py + Math.sin(st.aim) * (L.barrel + 6 * S);
      st.darts.push({ x: mx, y: my, tb: b || null, tx, ty, sp: 2300 * S, ang: st.aim, life: 0, gold: g.combo >= 3, dead: false });
      if (b) b.locked = true;
      st.recoil = 1; st.shots++;
      g.burst(mx, my, { kind: 'spark', n: 7, color: g.combo >= 3 ? '#FFE45C' : '#FFFFFF' });
      g.sfx('swing');
    }
    function knot(b) { const S = st.L.S; return [b.dx - Math.sin(b.rot) * (b.ry + 7 * S), b.dy + Math.cos(b.rot) * (b.ry + 7 * S)]; }
    function pop(g, b, kind) {
      const S = st.L.S;
      b.state = 'popped'; b.dead = true; b.locked = false;
      if (st.sel === b) st.sel = null;
      const x = b.dx, y = b.dy;
      st.pops.push({ x, y, r: Math.max(b.rx, b.ry), col: b.col, t: 0, kind, rot: Math.random() * TAU });
      const [kx, ky] = knot(b);
      st.strs.push({ x: kx, y: ky, vx: g.rand(-40, 40) * S, vy: -60 * S, rot: 0, vr: g.rand(-2.5, 2.5), len: b.ry * 1.45, t: 0 });
      g.sfx('pop');
      if (kind === 'ink') {
        g.burst(x, y, { kind: 'ink', color: '#2A1E48', n: 30 });
        g.burst(x, y, { kind: 'dot', color: b.col, n: 10 });
        g.sfx('splash');
      } else if (kind === 'good') {
        g.burst(x, y, { kind: 'confetti', n: 34 });
        g.burst(x, y, { kind: 'dot', color: b.col, n: 14 });
      } else if (kind === 'bonus') {
        g.burst(x, y, { kind: 'star', n: 16, color: b.kind === 'heart' ? '#FF7FA8' : '#FFD23F' });
        g.burst(x, y, { kind: 'spark', n: 12 });
      } else g.burst(x, y, { kind: 'dot', color: b.col, n: 12 });
      // 冲击波推开旁边的气球
      for (const o of st.balls) {
        if (o === b || o.dead || o.state !== 'up') continue;
        const dx = o.dx - x, dy = o.dy - y, d = Math.hypot(dx, dy), R = Math.max(b.rx, b.ry) * 3.2;
        if (d < R) { o.px += Math.sign(dx || 1) * 170 * S * (1 - d / R); o.wob = 1; }
      }
    }
    function inkSplat(g, x, y, r) {
      const S = st.L.S;
      const mk = (cx, cy, rr) => {
        const blobs = [], drips = [];
        for (let i = 0; i < 9; i++) { const a = Math.random() * TAU, d = rr * g.rand(0.35, 0.95); blobs.push([Math.cos(a) * d, Math.sin(a) * d, rr * g.rand(0.18, 0.42)]); }
        for (let i = 0; i < 3; i++) drips.push([g.rand(-rr * 0.6, rr * 0.6), rr * g.rand(0.5, 1.4), rr * g.rand(0.08, 0.14)]);
        st.splats.push({ x: cx, y: cy, r: rr, t: 0, life: 1.9, blobs, drips, rot: Math.random() * TAU });
      };
      mk(x, y, r * 0.9);
      mk(clamp(x + g.rand(-1, 1) * r * 2.2, 40 * S, g.w - 40 * S), clamp(y + g.rand(-1, 1) * r * 1.6, g.hudTop + 40 * S, g.h - 80 * S), r * 0.5);
      mk(g.rand(0.15, 0.85) * g.w, g.rand(0.3, 0.7) * g.h, r * 0.38);
    }
    function catDo(face, jump, dur) {
      const S = st.L.S;
      st.cat.face = face; st.cat.t = dur || 1;
      if (jump) st.cat.vy = -jump * S; else st.cat.shake = 0.5;
    }
    function hit(g, d) {
      const b = d.tb;
      if (!b || b.dead) { g.burst(d.tx, d.ty, { kind: 'dot', color: '#FFFFFF', n: 8 }); return; }
      b.locked = false;
      if (b.kind === 'star') {
        pop(g, b, 'bonus'); g.sfx('star'); g.addScore(30, b.dx, b.dy - 30); g.ring(b.dx, b.dy, '#FFE45C');
        catDo('😸', 220, 0.7);
        return;
      }
      if (b.kind === 'heart') {
        pop(g, b, 'bonus'); g.sfx('power'); g.ring(b.dx, b.dy, '#FF7FA8');
        if (g.lives < g.maxLives) { g.lives++; g.float('+1 ❤️', b.dx, b.dy - 30, { color: '#FFB3C7', size: 32 }); }
        else g.addScore(30, b.dx, b.dy - 30);
        catDo('😻', 240, 0.8);
        return;
      }
      const wv = st.wave;
      if (b.state !== 'up' || !wv || b.w !== wv || wv.state !== 'open') { pop(g, b, 'soft'); return; }
      st.tipT = 0;   // 已经会玩了：开场玩法横幅不再回来
      if (b.ok) {
        wv.state = 'done';
        pop(g, b, 'good');
        for (const o of st.balls) if (o !== b && o.w === wv && o.state === 'up') { o.state = 'away'; o.vy = Math.max(o.vy, 120 * st.L.S); }
        const cx = typeof wv.it.ctx === 'string' ? wv.it.ctx : '';
        let hs = cx.indexOf(wv.ans), hl = Array.from(wv.ans).length;
        if (hs < 0) { hs = cx.indexOf(wv.it.say); hl = Array.from(wv.it.say).length; }
        st.reveal = cx ? { text: cx, hs: hs >= 0 ? Array.from(cx.slice(0, hs)).length : -1, hl: hs >= 0 ? hl : 0, t: 0, life: 2.2 }
          : { text: wv.ans, hs: 0, hl: Array.from(wv.ans).length, t: 0, life: 2.2 };
        catDo('😸', 300, 0.9);
        g.right(wv.it, b.dx, b.dy);
        if (g.combo >= 2 && Math.random() < 0.55) g.float(PRAISE[Math.floor(Math.random() * PRAISE.length)], clamp(b.dx, 80, g.w - 80), b.dy + 40 * st.L.S, { color: '#FFFFFF', size: 26 });
        st.qi++;
        if (g.state === 'play') g.after(1.25, () => nextWave(g));
      } else {
        wv.wrongs++;
        pop(g, b, 'ink');
        inkSplat(g, b.dx, b.dy, b.rx);
        catDo('🙀', 0, 0.9);
        g.wrong(wv.it, '正确是“' + wv.ans + '”（' + (wv.it.py || '') + '），你戳了“' + b.text + '”', b.dx, b.dy);
        if (g.state === 'play') {
          g.after(0.6, () => { if (g.state === 'play' && st.wave === wv && wv.state === 'open') replay(g); });
          if (g.level >= 3 && !st.heartUsed && st.heartT < 0 && g.lives > 0 && g.lives < g.maxLives) st.heartT = g.rand(3, 5.5);
        }
      }
    }

    /* ---------------- 选中（键盘 / 鼠标悬停）---------------- */
    function targetable(g, b) {
      return b && !b.dead && b.state === 'up' && !b.locked && b.dy < g.h - b.ry * 0.3 && b.dy > g.hudTop - b.ry * 0.2;
    }
    function pickAt(g, p) {
      const pad = 12 * st.L.S;
      for (let i = st.balls.length - 1; i >= 0; i--) {
        const b = st.balls[i];
        if (!targetable(g, b)) continue;
        const nx = (p.x - b.dx) / (b.rx + pad), ny = (p.y - b.dy) / (b.ry + pad);
        if (nx * nx + ny * ny <= 1) return b;
      }
      return null;
    }
    function moveSel(g, dir, silent) {
      const list = st.balls.filter((b) => targetable(g, b)).sort((a, b) => a.dx - b.dx);
      if (!list.length) { st.sel = null; return; }
      let i = list.indexOf(st.sel);
      if (i < 0) {
        let best = 0, bd = 1e9;
        const rx = st.sel ? st.sel.dx : st.L.px;
        list.forEach((b, j) => { const d = Math.abs(b.dx - rx) + (st.sel ? 0 : (g.h - b.dy) * 0.2); if (d < bd) { bd = d; best = j; } });
        i = best;
        if (dir && st.sel == null) dir = 0;
      } else i = (i + dir + list.length) % list.length;
      st.sel = list[i];
      st.aimTo = pivotAim(st.sel.dx, st.sel.dy);
      if (!silent) g.sfx('tick');
    }

    /* ---------------- 每帧动画（画面时钟：倒计时/结算时也在动） ---------------- */
    function anim(g, dt) {
      const L = st.L, S = L.S, t = st.clock;
      // 远处的小气球（视差）
      for (const a of st.amb) {
        a.y -= a.sp * S * dt;
        if (a.y < -30 * S) { a.y = g.h + 30 * S + Math.random() * 120 * S; a.x = Math.random(); }
      }
      // 风
      if (st.windAmp && (g.state === 'play' || g.state === 'intro')) st.wind = st.windAmp * S * (0.65 * Math.sin(t * 0.45 + st.windPh) + 0.35 * Math.sin(t * 1.3 + st.windPh * 2));
      for (const s of st.streaks) {
        s.x += (st.wind * 9 + (st.wind >= 0 ? 60 : -60) * S) * dt;
        if (s.x > g.w + s.len) { s.x = -s.len; s.y = g.hudTop + Math.random() * (g.h - g.hudTop) * 0.8; }
        if (s.x < -s.len * 2) { s.x = g.w + s.len; s.y = g.hudTop + Math.random() * (g.h - g.hudTop) * 0.8; }
      }
      // 气球：摇摆 + 旋转 + 结算时飞走
      for (const b of st.balls) {
        if (g.state === 'over' && b.state === 'up') { b.state = 'away'; }
        if (g.state === 'over' && b.state === 'away') { b.vy += 500 * S * dt; b.y -= b.vy * dt; b.a = Math.max(0, b.a - dt * 0.9); }
        const ph = t * b.freq + b.ph;
        const sw = Math.sin(ph) * b.amp, swv = Math.cos(ph) * b.amp * b.freq;
        b.dx = b.x + sw; b.dy = b.y + Math.sin(ph * 1.7) * 3 * S;
        const lo = L.m + b.rx * 0.8, hi = g.w - L.m - b.rx * 0.8;
        if (b.dx < lo) b.dx = lo; else if (b.dx > hi) b.dx = hi;
        const vx = swv + (b.state === 'up' ? st.wind * b.wk + b.px : 0);
        b.vxv = vx;
        b.rot += (clamp(vx * 0.0032, -0.2, 0.2) - b.rot) * Math.min(1, dt * 6);
        if (b.wob > 0) b.wob = Math.max(0, b.wob - dt * 2);
      }
      if (g.state === 'over') { st.darts.length = 0; if (!st.overDone) { st.overDone = true; const win = g.lives > 0 && g.done >= g.rounds; catDo(win ? '😸' : '😿', win ? 320 : 0, 99); } }
      if (g.state === 'over' && st.cat.face === '😸' && st.cat.y === 0 && st.cat.vy === 0) st.cat.vy = -300 * S;
      st.balls = st.balls.filter((b) => !(b.dead || (b.state === 'away' && (b.a <= 0 || b.y < -b.ry * 3))));
      // 开场那一串气球：play 开始时放飞
      for (const f of st.freed) { f.vy += 40 * S * dt; f.y -= f.vy * dt; f.x += Math.sin(t * 2 + f.ph) * 30 * S * dt; }
      st.freed = st.freed.filter((f) => f.y > -60 * S);
      // 特效
      for (const p of st.pops) p.t += dt;
      st.pops = st.pops.filter((p) => p.t < 0.3);
      for (const s of st.strs) { s.t += dt; s.vy += 900 * S * dt; s.x += s.vx * dt; s.y += s.vy * dt; s.rot += s.vr * dt; }
      st.strs = st.strs.filter((s) => s.t < 1 && s.y < g.h + 50);
      for (const s of st.splats) s.t += dt;
      st.splats = st.splats.filter((s) => s.t < s.life);
      // 小猫
      const cat = st.cat;
      if (cat.vy || cat.y < 0) { cat.vy += 1500 * S * dt; cat.y += cat.vy * dt; if (cat.y >= 0) { cat.y = 0; cat.vy = 0; } }
      if (cat.shake > 0) cat.shake = Math.max(0, cat.shake - dt);
      if (cat.t > 0) { cat.t -= dt; if (cat.t <= 0) cat.face = '🐱'; }
      // 炮台
      st.recoil = Math.max(0, st.recoil - dt * 5);
      if (st.kbd && st.sel && targetable(g, st.sel)) st.aimTo = pivotAim(st.sel.dx, st.sel.dy);
      st.aim += (st.aimTo - st.aim) * Math.min(1, dt * 12);
      st.btnPress = Math.max(0, st.btnPress - dt * 5);
      st.btnPulse = Math.max(0, st.btnPulse - dt * 0.8);
      if (st.reveal) { st.reveal.t += dt; if (st.reveal.t > st.reveal.life) st.reveal = null; }
      st.bK = Math.min(1, st.bK + dt * 5);
      if (st.kbd && g.state === 'play' && !targetable(g, st.sel)) { st.sel = null; moveSel(g, 0, true); }
      if (st.hover && !targetable(g, st.hover)) st.hover = null;
    }

    /* ---------------- 画 ---------------- */
    function eggPath(c, rx, ry) {
      c.beginPath();
      c.moveTo(0, -ry);
      c.bezierCurveTo(rx * 0.56, -ry, rx, -ry * 0.52, rx, -ry * 0.08);
      c.bezierCurveTo(rx, ry * 0.42, rx * 0.46, ry * 0.86, 0, ry);
      c.bezierCurveTo(-rx * 0.46, ry * 0.86, -rx, ry * 0.42, -rx, -ry * 0.08);
      c.bezierCurveTo(-rx, -ry * 0.52, -rx * 0.56, -ry, 0, -ry);
      c.closePath();
    }
    function drawBalloon(g, c, b) {
      const S = st.L.S, t = st.clock, rx = b.rx, ry = b.ry;
      if (b.a <= 0) return;
      c.globalAlpha = b.a;
      // 绳子（世界坐标，随摆动滞后）
      const [kx, ky] = knot(b);
      const len = ry * 1.45, ph = t * 3 + b.ph, lag = clamp(-b.vxv * 0.14, -34 * S, 34 * S);
      c.strokeStyle = 'rgba(29,43,83,.72)'; c.lineWidth = 2 * S; c.lineCap = 'round';
      c.beginPath(); c.moveTo(kx, ky);
      c.bezierCurveTo(kx + Math.sin(ph) * 7 * S + lag * 0.3, ky + len * 0.35, kx - Math.sin(ph + 1.3) * 7 * S + lag * 0.7, ky + len * 0.7, kx + Math.sin(ph + 2.2) * 5 * S + lag, ky + len);
      c.stroke();
      c.save();
      c.translate(b.dx, b.dy); c.rotate(b.rot);
      const q = b.wob * Math.sin(t * 24) * 0.09, br = 1 + 0.02 * Math.sin(t * 2.4 + b.ph);
      c.scale(b.sc * br * (1 + q), b.sc * br * (1 - q));
      const sel = (st.kbd && st.sel === b) || st.hover === b;
      if (sel) { eggPath(c, rx, ry); c.lineWidth = 10 * S; c.strokeStyle = 'rgba(255,255,255,.85)'; c.stroke(); }
      eggPath(c, rx, ry);
      c.fillStyle = gradFor(c, b.col, rx, ry); c.fill();
      c.lineWidth = 3 * S; c.strokeStyle = NAVY; c.lineJoin = 'round'; c.stroke();
      // 扎口
      c.beginPath(); c.moveTo(-6 * S, ry + 8 * S); c.lineTo(6 * S, ry + 8 * S); c.lineTo(0, ry - 1 * S); c.closePath();
      c.fillStyle = mix(b.col, '#000000', 0.25); c.fill(); c.lineWidth = 2.2 * S; c.stroke();
      // 高光
      c.fillStyle = 'rgba(255,255,255,.6)';
      c.beginPath(); c.ellipse(-rx * 0.46, -ry * 0.46, rx * 0.13, ry * 0.25, 0.55, 0, TAU); c.fill();
      c.beginPath(); c.arc(-rx * 0.2, -ry * 0.78, rx * 0.065, 0, TAU); c.fill();
      if (b.kind === 'q') {
        const n = b.lines.length, lh = b.fs * 1.08, y0 = -ry * 0.1 - (n - 1) * lh / 2;
        // 深色字 + 白色描边：字的内部空隙（日/目、厉/历 的差别就在这里）保持浅色，不被粗描边糊掉
        for (let i = 0; i < n; i++) g.text(b.lines[i], 0, y0 + i * lh, { size: b.fs, font: 'kai', weight: 700, color: NAVY, stroke: '#FFFFFF', strokeW: Math.max(2, b.fs * 0.11) });
      } else {
        g.emoji(b.text, 0, -ry * 0.08, rx * 1.05);
      }
      c.restore();
      c.globalAlpha = 1;
    }
    function drawBlimp(g, c) {
      const L = st.L, S = L.S, t = st.clock;
      const x = L.px + Math.sin(t * 0.33) * Math.min(40 * S, g.w * 0.07), y = L.blY + Math.sin(t * 1.4) * 3 * S;
      st.blimp = { x, y };
      const rw = L.bw / 2, rh = L.bh / 2;
      c.save(); c.translate(x, y); c.rotate(Math.sin(t * 0.9) * 0.025 + clamp(st.wind * 0.0012, -0.06, 0.06));
      c.lineJoin = 'round'; c.lineWidth = 2.6 * S; c.strokeStyle = NAVY;
      // 尾翼
      c.fillStyle = '#FFC928';
      c.beginPath(); c.moveTo(-rw * 0.7, -rh * 0.5); c.lineTo(-rw * 1.06, -rh * 1.25); c.lineTo(-rw * 1.12, -rh * 0.18); c.closePath(); c.fill(); c.stroke();
      c.beginPath(); c.moveTo(-rw * 0.7, rh * 0.5); c.lineTo(-rw * 1.06, rh * 1.25); c.lineTo(-rw * 1.12, rh * 0.18); c.closePath(); c.fill(); c.stroke();
      // 螺旋桨
      const pk = Math.abs(Math.sin(t * 26));
      c.fillStyle = 'rgba(255,255,255,.85)'; c.beginPath(); c.ellipse(-rw * 1.16, 0, 3 * S, 17 * S * pk + 2 * S, 0, 0, TAU); c.fill(); c.stroke();
      c.fillStyle = NAVY; c.beginPath(); c.arc(-rw * 1.1, 0, 4 * S, 0, TAU); c.fill();
      // 吊舱
      g.rrect(-rw * 0.26, rh * 0.8, rw * 0.52, rh * 0.62, 7 * S, '#FFFBEF', NAVY, 2.4 * S);
      for (let i = 0; i < 3; i++) g.rrect(-rw * 0.2 + i * rw * 0.15, rh * 0.93, rw * 0.1, rh * 0.3, 3 * S, '#8FD3FF');
      // 机身
      c.beginPath(); c.ellipse(0, 0, rw, rh, 0, 0, TAU);
      const gr = c.createLinearGradient(0, -rh, 0, rh); gr.addColorStop(0, '#FF8A8A'); gr.addColorStop(0.5, '#FF4D5E'); gr.addColorStop(1, '#D8283E');
      c.fillStyle = gr; c.fill();
      c.save(); c.clip();
      c.fillStyle = 'rgba(255,255,255,.92)';
      c.fillRect(-rw * 0.62, -rh, rw * 0.13, rh * 2); c.fillRect(rw * 0.5, -rh, rw * 0.13, rh * 2);
      c.fillStyle = 'rgba(255,255,255,.35)'; c.beginPath(); c.ellipse(-rw * 0.1, -rh * 0.5, rw * 0.7, rh * 0.22, 0, 0, TAU); c.fill();
      c.restore();
      c.beginPath(); c.ellipse(0, 0, rw, rh, 0, 0, TAU); c.lineWidth = 3 * S; c.stroke();
      // 屏幕：🔊 + 声波
      const pw = rw * 0.86, ph = rh * 1.12;
      g.rrect(-pw / 2 - rw * 0.02, -ph / 2, pw, ph, ph / 2, '#FFFBEF', NAVY, 2.4 * S);
      const ex = -pw / 2 + ph * 0.52 - rw * 0.02;
      g.emoji('🔊', ex, 0, ph * 0.78);
      if (g.speaking || st.btnPulse > 0.6) {
        c.strokeStyle = '#3AA0FF'; c.lineWidth = 2.6 * S; c.lineCap = 'round';
        for (let i = 0; i < 5; i++) {
          const hh = (0.25 + 0.75 * Math.abs(Math.sin(t * 9 + i * 1.1))) * ph * 0.34;
          const xx = ex + ph * 0.55 + i * pw * 0.1;
          c.beginPath(); c.moveTo(xx, -hh); c.lineTo(xx, hh); c.stroke();
        }
      } else {
        g.text('点我再听', ex + ph * 0.45, 1 * S, { size: Math.round(Math.min(15 * S, ph * 0.5)), font: 'round', color: NAVY, align: 'left', maxW: pw - ph * 1.05 });
      }
      c.restore();
    }
    /* 横幅：无朗读时显示拼音 + 挖空例句；答对后显示完整例句（答案高亮）；第一关开头显示玩法 */
    function layoutSent(g, chars, maxW, fs0) {
      let fs = fs0;
      const text = chars.join('');
      let lines = [[0, chars.length]];
      if (g.measure(text, fs, 'kai') > maxW && chars.length > 6) {
        const mid = chars.length / 2;
        let best = Math.ceil(mid), bd = 1e9;
        for (let i = 2; i < chars.length - 1; i++) if (PUNCT.indexOf(chars[i - 1]) >= 0 && Math.abs(i - mid) < bd) { bd = Math.abs(i - mid); best = i; }
        if (bd > chars.length * 0.3) best = Math.ceil(mid);
        lines = [[0, best], [best, chars.length]];
      }
      const wOf = (ln) => g.measure(chars.slice(ln[0], ln[1]).join(''), fs, 'kai');
      const mw = Math.max.apply(null, lines.map(wOf));
      if (mw > maxW) fs = Math.max(11, Math.floor(fs * maxW / mw));
      return { lines, fs, w: Math.min(maxW, Math.max.apply(null, lines.map(wOf))), h: lines.length * fs * 1.28 };
    }
    function drawSent(g, chars, lay0, cx, cy, hs, hl, blank) {
      const S = st.L.S, fs = lay0.fs, lh = fs * 1.28;
      lay0.lines.forEach((ln, li) => {
        const y = cy - (lay0.lines.length - 1) * lh / 2 + li * lh;
        const seg = chars.slice(ln[0], ln[1]);
        const ws = seg.map((ch) => g.measure(ch, fs, 'kai'));
        let x = cx - ws.reduce((a, b) => a + b, 0) / 2;
        seg.forEach((ch, j) => {
          const i = ln[0] + j, on = i >= hs && i < hs + hl;
          if (on) g.rrect(x - 1, y - fs * 0.58, ws[j] + 2, fs * 1.16, 4 * S, blank ? 'rgba(58,160,255,.18)' : '#FFE45C');
          g.text(ch, x + ws[j] / 2, y, { size: fs, font: 'kai', weight: on ? 700 : 400, color: on ? (blank ? '#3AA0FF' : '#E23B2E') : NAVY });
          x += ws[j];
        });
      });
    }
    function drawBanner(g, c) {
      const L = st.L, S = L.S, wv = st.wave;
      let mode = '', key = '';
      if (st.reveal) { mode = 'reveal'; key = 'r' + st.reveal.text; }
      else if (wv && wv.state === 'open' && !ttsOk()) { mode = 'py'; key = 'p' + wv.it.say; }
      else if (st.tipT > 0 && g.state === 'play') { mode = 'tip'; key = 'tip'; }
      if (key !== st.bKey) { st.bKey = key; st.bK = 0; }
      if (!mode) return;
      let k = outBack(st.bK);
      if (mode === 'reveal') k *= clamp((st.reveal.life - st.reveal.t) / 0.25, 0, 1);   // 收起动画
      const bl = st.blimp || { x: L.px, y: L.blY };
      const maxW = Math.min(g.w - 28 * S, 520 * S) - 28 * S;
      let lay1 = null, chars = null, hs = -1, hl = 0, blank = false, pyFs = 0, bh = 0, bw = 0;
      if (mode === 'reveal') {
        chars = Array.from(st.reveal.text); hs = st.reveal.hs; hl = st.reveal.hl;
        lay1 = layoutSent(g, chars, maxW, Math.round(22 * S));
        bw = lay1.w + 30 * S; bh = lay1.h + 16 * S;
      } else if (mode === 'py') {
        const it = wv.it;
        pyFs = Math.round(22 * S);
        const ctxs = typeof it.ctx === 'string' ? it.ctx : '';
        let h0 = ctxs.indexOf(wv.ans); if (h0 < 0) h0 = ctxs.indexOf(it.say);
        if (ctxs && h0 >= 0) {
          const pre = Array.from(ctxs.slice(0, h0)), mid = Array.from(wv.ans), post = Array.from(ctxs.slice(h0 + wv.ans.length));
          chars = pre.concat(mid.map(() => '＿'), post); hs = pre.length; hl = mid.length; blank = true;
          lay1 = layoutSent(g, chars, maxW, Math.round(17 * S));
        }
        const pw = Math.min(maxW, g.measure(it.py || '', pyFs, 'py'));
        bw = Math.max(pw, lay1 ? lay1.w : 0) + 30 * S; bh = pyFs * 1.35 + (lay1 ? lay1.h + 4 * S : 0) + 14 * S;
      } else {
        bw = Math.min(maxW, g.measure('听词语，戳破写对的气球！', Math.round(19 * S), 'round')) + 30 * S; bh = 19 * S * 1.4 + 14 * S;
      }
      const cx = clamp(bl.x, bw / 2 + 8 * S, g.w - bw / 2 - 8 * S), top = bl.y + L.bh / 2 + L.bh * 0.28 + 10 * S;
      c.save();
      c.translate(cx, top); c.rotate(Math.sin(st.clock * 1.8) * 0.02); c.scale(1, Math.max(0.05, k));
      // 两根吊绳
      c.strokeStyle = NAVY; c.lineWidth = 1.6 * S;
      c.beginPath(); c.moveTo(-bw * 0.3, 0); c.lineTo(bl.x - cx - L.bw * 0.08, -10 * S); c.moveTo(bw * 0.3, 0); c.lineTo(bl.x - cx + L.bw * 0.08, -10 * S); c.stroke();
      g.rrect(-bw / 2, 3 * S, bw, bh, 12 * S, 'rgba(29,43,83,.35)');
      g.rrect(-bw / 2, 0, bw, bh, 12 * S, mode === 'reveal' ? '#FFFBEF' : '#FFFFFF', NAVY, 2.6 * S);
      if (mode === 'reveal') drawSent(g, chars, lay1, 0, bh / 2, hs, hl, false);
      else if (mode === 'py') {
        g.text(wv.it.py || '', 0, 7 * S + pyFs * 0.68, { size: pyFs, font: 'py', color: '#E4572E', maxW });
        if (lay1) drawSent(g, chars, lay1, 0, 7 * S + pyFs * 1.35 + 2 * S + lay1.h / 2, hs, hl, true);
      } else g.text('听词语，戳破写对的气球！', 0, bh / 2, { size: Math.round(19 * S), font: 'round', color: NAVY, maxW });
      c.restore();
    }
    function drawTurret(g, c) {
      const L = st.L, S = L.S, px = L.px, py = L.py;
      c.lineJoin = 'round';
      // 沙地阴影
      c.fillStyle = 'rgba(140,90,20,.25)'; c.beginPath(); c.ellipse(px, py + 44 * S, 86 * S, 11 * S, 0, 0, TAU); c.fill();
      // 炮管
      c.save(); c.translate(px, py); c.rotate(st.aim + Math.PI / 2); c.translate(0, st.recoil * 13 * S);
      g.rrect(-13 * S, -L.barrel, 26 * S, L.barrel, 9 * S, '#FF7A3D', NAVY, 3.2 * S);
      g.rrect(-10.5 * S, -L.barrel * 0.62, 21 * S, 8 * S, 2 * S, '#FFD23F');
      g.rrect(-17 * S, -L.barrel - 8 * S, 34 * S, 15 * S, 6 * S, '#3AA0FF', NAVY, 3.2 * S);
      if (st.recoil < 0.35) {   // 装好的下一支飞镖
        c.fillStyle = '#E6EEF8'; c.strokeStyle = NAVY; c.lineWidth = 2 * S;
        c.beginPath(); c.moveTo(0, -L.barrel - 20 * S); c.lineTo(-6 * S, -L.barrel - 8 * S); c.lineTo(6 * S, -L.barrel - 8 * S); c.closePath(); c.fill(); c.stroke();
      }
      c.restore();
      // 底座
      g.rrect(px - 70 * S, py + 20 * S, 140 * S, 24 * S, 11 * S, '#C8792E', NAVY, 3.2 * S);
      c.strokeStyle = 'rgba(29,43,83,.35)'; c.lineWidth = 2 * S;
      c.beginPath(); for (let i = -2; i <= 2; i++) { c.moveTo(px + i * 26 * S, py + 23 * S); c.lineTo(px + i * 26 * S, py + 41 * S); } c.stroke();
      // 圆顶
      c.save(); c.translate(px, py + 22 * S); c.scale(1 + st.recoil * 0.05, 1 - st.recoil * 0.08);
      c.beginPath(); c.arc(0, 0, 44 * S, Math.PI, 0); c.closePath();
      const gr = c.createLinearGradient(0, -44 * S, 0, 0); gr.addColorStop(0, '#6CC3FF'); gr.addColorStop(1, '#1F78D1');
      c.fillStyle = gr; c.fill(); c.lineWidth = 3.4 * S; c.strokeStyle = NAVY; c.stroke();
      c.fillStyle = 'rgba(255,255,255,.4)'; c.beginPath(); c.ellipse(-14 * S, -30 * S, 14 * S, 6 * S, -0.4, 0, TAU); c.fill();
      // 气球徽章
      c.fillStyle = '#FF4D5E'; c.beginPath(); c.ellipse(0, -17 * S, 8 * S, 9.5 * S, 0, 0, TAU); c.fill(); c.lineWidth = 2 * S; c.stroke();
      c.restore();
      // 小猫炮手
      const cat = st.cat, sh = cat.shake > 0 ? Math.sin(st.clock * 60) * 4 * S * cat.shake * 2 : 0;
      const bob = cat.y === 0 ? Math.sin(st.clock * 3) * 1.5 * S : 0;
      const sq = cat.y === 0 && cat.vy === 0 ? 1 : 1 + clamp(-cat.vy / (1500 * S), -0.15, 0.15);
      c.save(); c.translate(L.catX + sh, L.catY + cat.y + bob); c.scale(1 / sq, sq);
      g.emoji(cat.face, 0, -22 * S, 50 * S, { rot: Math.sin(st.clock * 2) * 0.06 });
      c.restore();
    }
    function drawDart(g, c, d) {
      const S = st.L.S;
      c.save(); c.translate(d.x, d.y); c.rotate(d.ang);
      const tl = 60 * S;
      const gr = c.createLinearGradient(-tl, 0, 0, 0);
      gr.addColorStop(0, d.gold ? 'rgba(255,200,40,0)' : 'rgba(255,255,255,0)'); gr.addColorStop(1, d.gold ? 'rgba(255,170,30,.9)' : 'rgba(255,255,255,.85)');
      c.strokeStyle = gr; c.lineWidth = (d.gold ? 9 : 6) * S; c.lineCap = 'round';
      c.beginPath(); c.moveTo(-tl, 0); c.lineTo(-12 * S, 0); c.stroke();
      c.fillStyle = '#9A5B2A'; c.fillRect(-22 * S, -2 * S, 26 * S, 4 * S);
      c.fillStyle = d.gold ? '#FFC928' : '#FF4D5E'; c.strokeStyle = NAVY; c.lineWidth = 1.6 * S;
      c.beginPath(); c.moveTo(-14 * S, 0); c.lineTo(-24 * S, -8 * S); c.lineTo(-20 * S, 0); c.lineTo(-24 * S, 8 * S); c.closePath(); c.fill(); c.stroke();
      c.fillStyle = '#EEF4FB';
      c.beginPath(); c.moveTo(16 * S, 0); c.lineTo(3 * S, -5 * S); c.lineTo(3 * S, 5 * S); c.closePath(); c.fill(); c.stroke();
      c.restore();
    }
    function drawButton(g, c) {
      const L = st.L, S = L.S, x = L.bx, y = L.by, r = L.br, dn = st.btnPress * 3 * S;
      if (g.speaking || st.btnPulse > 0) {
        for (let i = 0; i < 2; i++) {
          const k = (st.clock * 1.2 + i * 0.5) % 1;
          c.globalAlpha = (1 - k) * 0.8; c.strokeStyle = '#FFFFFF'; c.lineWidth = 3 * S;
          c.beginPath(); c.arc(x, y, r + 4 * S + k * 22 * S, 0, TAU); c.stroke();
        }
        c.globalAlpha = 1;
      }
      c.fillStyle = NAVY; c.beginPath(); c.arc(x, y + 5 * S, r, 0, TAU); c.fill();
      c.fillStyle = '#FFC928'; c.beginPath(); c.arc(x, y + dn, r, 0, TAU); c.fill();
      c.lineWidth = 3 * S; c.strokeStyle = NAVY; c.stroke();
      c.fillStyle = 'rgba(255,255,255,.45)'; c.beginPath(); c.ellipse(x - r * 0.25, y + dn - r * 0.5, r * 0.45, r * 0.22, -0.3, 0, TAU); c.fill();
      g.emoji('🔊', x, y + dn, r * 1.1);
      g.text('再听', x, y + r + 12 * S, { size: Math.round(13 * S), font: 'round', color: '#FFFFFF', stroke: NAVY, strokeW: 3 * S });
    }
    function drawAmb(g, c) {
      const S = st.L.S;
      for (const a of st.amb) {
        const x = a.x * g.w + Math.sin(st.clock * 0.8 + a.ph) * 10 * S, y = a.y, r = a.r * S;
        c.globalAlpha = 0.5;
        c.strokeStyle = 'rgba(255,255,255,.8)'; c.lineWidth = 1 * S;
        c.beginPath(); c.moveTo(x, y + r * 1.15); c.quadraticCurveTo(x + Math.sin(st.clock * 2 + a.ph) * 4 * S, y + r * 2, x, y + r * 2.8); c.stroke();
        c.fillStyle = a.col; c.beginPath(); c.ellipse(x, y, r, r * 1.17, 0, 0, TAU); c.fill();
        c.fillStyle = 'rgba(255,255,255,.6)'; c.beginPath(); c.ellipse(x - r * 0.35, y - r * 0.4, r * 0.18, r * 0.3, 0.5, 0, TAU); c.fill();
      }
      c.globalAlpha = 1;
    }
    function drawBunch(g, c, list, tied) {
      const L = st.L, S = L.S, ax = L.px - 58 * S, ay = L.py + 22 * S;
      for (const f of list) {
        const x = tied ? ax + f.ox * S + Math.sin(st.clock * 1.6 + f.ph) * 5 * S : f.x, y = tied ? ay - f.oy * S + Math.sin(st.clock * 2.1 + f.ph) * 3 * S : f.y, r = f.r * S;
        c.strokeStyle = 'rgba(29,43,83,.7)'; c.lineWidth = 1.6 * S;
        c.beginPath(); c.moveTo(x, y + r * 1.15);
        if (tied) c.quadraticCurveTo((x + ax) / 2 + Math.sin(st.clock * 2 + f.ph) * 6 * S, (y + ay) / 2, ax, ay);
        else c.quadraticCurveTo(x + Math.sin(st.clock * 3 + f.ph) * 6 * S, y + r * 2, x - 2 * S, y + r * 3.2);
        c.stroke();
        c.fillStyle = f.col; c.beginPath(); c.ellipse(x, y, r, r * 1.17, 0, 0, TAU); c.fill();
        c.lineWidth = 2 * S; c.strokeStyle = NAVY; c.stroke();
        c.fillStyle = 'rgba(255,255,255,.6)'; c.beginPath(); c.ellipse(x - r * 0.38, y - r * 0.42, r * 0.17, r * 0.3, 0.5, 0, TAU); c.fill();
        if (!tied) f.x = x;
      }
      if (tied) { c.fillStyle = '#9A5B2A'; c.beginPath(); c.arc(ax, ay, 4 * S, 0, TAU); c.fill(); }
    }
    function drawPops(g, c) {
      const S = st.L.S;
      for (const p of st.pops) {
        const k = p.t / 0.3; if (k >= 1) continue;
        const r = p.r * (0.55 + k * 0.85);
        c.globalAlpha = 1 - k;
        c.beginPath();
        for (let i = 0; i < 24; i++) { const a = p.rot + i / 24 * TAU, rr = i % 2 ? r * 0.58 : r; if (i) c.lineTo(p.x + Math.cos(a) * rr, p.y + Math.sin(a) * rr); else c.moveTo(p.x + Math.cos(a) * rr, p.y + Math.sin(a) * rr); }
        c.closePath();
        c.fillStyle = p.kind === 'ink' ? '#3A2A5C' : p.kind === 'good' ? '#FFF6B0' : '#FFFFFF'; c.fill();
        c.lineWidth = 3 * S; c.strokeStyle = p.kind === 'ink' ? '#140C28' : p.col; c.stroke();
        g.text(p.kind === 'ink' ? '噗！' : '啪！', p.x, p.y, { size: Math.round(26 * S), font: 'round', color: p.kind === 'ink' ? '#C9B8FF' : '#FF4D5E', stroke: NAVY, strokeW: 4 * S, alpha: 1 - k });
      }
      c.globalAlpha = 1;
      for (const s of st.strs) {
        c.globalAlpha = Math.max(0, 1 - s.t);
        c.save(); c.translate(s.x, s.y); c.rotate(s.rot);
        c.strokeStyle = NAVY; c.lineWidth = 2 * S; c.lineCap = 'round';
        c.beginPath(); c.moveTo(0, 0); c.bezierCurveTo(8 * S, s.len * 0.3, -8 * S, s.len * 0.6, 3 * S, s.len); c.stroke();
        c.restore();
      }
      c.globalAlpha = 1;
    }
    function drawSplats(g, c) {
      for (const s of st.splats) {
        const k = s.t < 0.08 ? s.t / 0.08 : 1;
        const a = s.t > s.life - 0.7 ? Math.max(0, (s.life - s.t) / 0.7) : 1;
        c.globalAlpha = a * 0.92;
        c.save(); c.translate(s.x, s.y); c.scale(k, k);
        c.fillStyle = '#231A3D';
        c.beginPath(); c.arc(0, 0, s.r * 0.55, 0, TAU); c.fill();
        for (const b of s.blobs) { c.beginPath(); c.arc(b[0], b[1], b[2], 0, TAU); c.fill(); }
        for (const d of s.drips) { const L2 = d[1] * Math.min(1, s.t * 1.2); c.fillRect(d[0] - d[2] / 2, 0, d[2], L2); c.beginPath(); c.arc(d[0], L2, d[2] * 0.9, 0, TAU); c.fill(); }
        c.fillStyle = 'rgba(255,255,255,.18)'; c.beginPath(); c.ellipse(-s.r * 0.2, -s.r * 0.22, s.r * 0.22, s.r * 0.12, -0.5, 0, TAU); c.fill();
        c.restore();
      }
      c.globalAlpha = 1;
    }
    function drawStreaks(g, c) {
      const aw = Math.abs(st.wind);
      if (aw < 4) return;
      const S = st.L.S;
      c.strokeStyle = '#FFFFFF'; c.lineWidth = 2.4 * S; c.lineCap = 'round';
      c.globalAlpha = Math.min(0.6, aw / (45 * S));
      c.beginPath();
      for (const s of st.streaks) {
        const dir = st.wind >= 0 ? 1 : -1;
        c.moveTo(s.x, s.y);
        c.quadraticCurveTo(s.x + dir * s.len * 0.5, s.y - 6 * S, s.x + dir * s.len, s.y);
        c.moveTo(s.x + dir * s.len * 0.3, s.y + 9 * S);
        c.lineTo(s.x + dir * s.len * 0.75, s.y + 9 * S);
      }
      c.stroke();
      c.globalAlpha = 1;
    }
    function drawHint(g, c) {
      const S = st.L.S, wv = st.wave;
      if (!st.hintOn || !wv || wv.state !== 'open' || wv.t < 2.6) return;   // 先让孩子自己听、自己试，2.6 秒没动手再教
      const b = st.balls.find((o) => o.w === wv && o.ok && o.state === 'up' && o.dy < g.h * 0.64);
      if (!b) return;
      const blink = 0.55 + 0.45 * Math.sin(st.clock * 8);
      c.globalAlpha = blink; c.strokeStyle = '#FFE45C'; c.lineWidth = 5 * S;
      c.beginPath(); c.ellipse(b.dx, b.dy, b.rx + 12 * S + Math.sin(st.clock * 8) * 4 * S, b.ry + 12 * S + Math.sin(st.clock * 8) * 4 * S, 0, 0, TAU); c.stroke();
      c.globalAlpha = 1;
      const fy = b.dy + b.ry + 42 * S + Math.abs(Math.sin(st.clock * 5)) * 12 * S;
      g.emoji('👆', b.dx + 6 * S, fy, 50 * S);
      g.shadowText('戳它！', b.dx + 56 * S > g.w - 40 * S ? b.dx - 60 * S : b.dx + 60 * S, fy + 4 * S, { size: Math.round(22 * S), color: '#FFE45C' });
    }
    function drawReticle(g, c) {
      const b = st.sel;
      if (!st.kbd || !b || !targetable(g, b)) return;
      const S = st.L.S, r = Math.max(b.rx, b.ry) + 14 * S, t = st.clock;
      c.save(); c.translate(b.dx, b.dy); c.rotate(t * 1.5);
      c.strokeStyle = '#FFE45C'; c.lineWidth = 4 * S; c.setLineDash([14 * S, 10 * S]);
      c.beginPath(); c.arc(0, 0, r, 0, TAU); c.stroke(); c.setLineDash([]);
      c.fillStyle = '#FFE45C'; c.strokeStyle = NAVY; c.lineWidth = 2 * S;
      const pr = r + 8 * S + Math.sin(t * 8) * 3 * S;
      for (let i = 0; i < 4; i++) {
        const a = i * Math.PI / 2;
        c.save(); c.rotate(a); c.beginPath(); c.moveTo(pr - 14 * S, 0); c.lineTo(pr, -8 * S); c.lineTo(pr, 8 * S); c.closePath(); c.fill(); c.stroke(); c.restore();
      }
      c.restore();
    }

    /* ---------------- spec ---------------- */
    const spec = {
      maxLevel: 10, lives: 3, rounds: 8, music: 'bright', sky: 'day',
      intro: '听词语，戳破写对的气球！',
      controls: '点气球发射 · 🔊/空格 再听 · ←→ 选气球 回车发射',
      init(g) {
        st.g = g;
        try { W.__hwBalloon = st; } catch (e) { /* ignore */ }
        st.list = g.items('pick', g.rounds).filter(validItem);
        st.empty = !st.list.length;
        g.rounds = Math.max(1, Math.min(g.rounds, st.list.length || 1));
        st.qi = 0; st.wave = null; st.balls = []; st.darts = []; st.pops = []; st.strs = []; st.splats = [];
        st.reveal = null; st.sel = null; st.hover = null; st.kbd = false; st.recoil = 0; st.overDone = false; st.shots = 0;
        st.cat = { face: '🐱', t: 0, y: 0, vy: 0, shake: 0 };
        st.heartUsed = false; st.heartT = -1; st.starT = g.rand(7, 11);
        st.hintOn = g.level === 1 && !g.isReview; st.tipT = g.level === 1 ? 3.2 : 0;
        st.windAmp = g.level >= 4 ? (g.level - 3) * 7 : 0; st.windPh = g.rand(0, TAU); st.wind = 0;
        const gk = 1.08 - (clamp(+g.gradeNum || 3, 2, 6) - 2) * 0.04;
        lay(g);
        const T = (12.5 - (g.level - 1) * 0.8) * gk;
        st.cruise = (g.h - g.hudTop) / T;
        if (!st.amb.length) {
          for (let i = 0; i < 7; i++) st.amb.push({ x: Math.random(), y: Math.random() * g.h, sp: 16 + Math.random() * 22, r: 8 + Math.random() * 7, ph: Math.random() * TAU, col: COLORS[i % COLORS.length] });
          for (let i = 0; i < 9; i++) st.streaks.push({ x: Math.random() * g.w, y: g.hudTop + Math.random() * (g.h - g.hudTop) * 0.8, len: 60 + Math.random() * 90 });
        }
        st.bunch = [[-18, 70, 15], [4, 84, 16], [22, 66, 14], [-4, 104, 13], [-30, 96, 12]].map((a, i) => ({ ox: a[0], oy: a[1], r: a[2], ph: i * 1.3, col: COLORS[(i * 3) % COLORS.length], x: 0, y: 0, vy: 0 }));
        st.freed = [];
      },
      play(g) {
        const L = st.L, S = L.S;
        // 开场：绑在炮台边的一串气球被放飞
        st.freed = st.bunch.map((f) => ({ x: L.px - 58 * S + f.ox * S, y: L.py + 22 * S - f.oy * S, r: f.r, ph: f.ph, col: f.col, vy: (140 + Math.random() * 80) * S }));
        st.bunch = [];
        catDo('😺', 260, 0.8);
        if (st.empty) { g.float('题目准备中', g.w / 2, g.h / 2, { size: 30 }); g.after(1.6, () => g.lose()); return; }
        if (st.windAmp) { g.float('起风啦！🌬️', g.w / 2, g.h * 0.42, { color: '#D6ECFF', size: 34, life: 1.6 }); g.sfx('whoosh'); }
        nextWave(g);
      },
      update(g, dt) {
        const L = st.L, S = L.S;
        if (st.wave) st.wave.t += dt;
        if (st.tipT > 0) st.tipT = Math.max(0, st.tipT - dt);
        if (st.fireCd > 0) st.fireCd -= dt;
        for (const b of st.balls) {
          if (b.dead) continue;
          if (b.state === 'up') {
            b.age += dt;
            b.y -= (b.vy + b.ev * Math.exp(-2.4 * b.age)) * dt;
            b.x += (st.wind * b.wk + b.px) * dt;
            b.px *= Math.exp(-2.4 * dt);
            const lo = L.m + b.rx + 2 * S + b.amp, hi = g.w - L.m - b.rx - 2 * S - b.amp;
            if (b.x < lo) { b.x = lo; b.px = Math.abs(b.px) * 0.4; } else if (b.x > hi) { b.x = hi; b.px = -Math.abs(b.px) * 0.4; }
            if (!b.locked && b.dy < g.hudTop - b.ry * 0.15) { b.state = 'away'; b.vy = Math.max(b.vy, 90 * S); }
          } else if (b.state === 'away') {
            b.vy += 700 * S * dt; b.y -= b.vy * dt; b.a = Math.max(0, b.a - dt * 1.7);
          }
        }
        // 互相挤开（按画出来的位置做位置修正），免得字叠在一起
        const up = st.balls.filter((b) => b.state === 'up' && !b.dead);
        const kk = Math.min(1, dt * 14) * 0.5;
        for (let it = 0; it < 2; it++) for (let i = 0; i < up.length; i++) for (let j = i + 1; j < up.length; j++) {
          const a = up[i], b = up[j];
          const dx = b.dx - a.dx, dy = b.dy - a.dy, mx = (a.rx + b.rx) + 6 * S, my = (a.ry + b.ry) * 0.92;
          const d2 = (dx / mx) * (dx / mx) + (dy / my) * (dy / my);
          if (d2 < 1) {   // 椭圆重叠：主要横向推开，斜着挨着时也往上下分一点
            const sgn = dx === 0 ? (i % 2 ? 1 : -1) : Math.sign(dx);
            const pen = (1 - Math.sqrt(d2)) * kk;
            const ox = pen * mx, ady = Math.abs(dy);
            a.x -= sgn * ox; b.x += sgn * ox; a.dx -= sgn * ox; b.dx += sgn * ox;
            if (ady > my * 0.4) { const oy = pen * my * 0.35, sy = Math.sign(dy) || 1; a.y -= sy * oy; b.y += sy * oy; a.dy -= sy * oy; b.dy += sy * oy; }
            if (Math.sign(a.px) === sgn) a.px *= 0.8;
            if (Math.sign(b.px) === -sgn) b.px *= 0.8;
          }
        }
        // 飞镖
        for (const d of st.darts) {
          if (d.dead) continue;
          const T = d.tb;
          if (T && !T.dead) { d.tx = T.dx; d.ty = T.dy; }
          const dx = d.tx - d.x, dy = d.ty - d.y, dist = Math.hypot(dx, dy), step = d.sp * dt;
          d.ang = Math.atan2(dy, dx); d.life += dt;
          if (dist <= step + 6 * S) { d.x = d.tx; d.y = d.ty; d.dead = true; hit(g, d); if (g.state !== 'play') break; }
          else { d.x += dx / dist * step; d.y += dy / dist * step; }
          if (d.life > 1.5) { d.dead = true; if (T) T.locked = false; }
        }
        st.darts = st.darts.filter((d) => !d.dead);
        if (g.state !== 'play') return;
        // 正确气球全溜走 → miss，重放一轮
        const wv = st.wave;
        if (wv && wv.state === 'open' && wv.t > 0.5) {
          const alive = st.balls.some((b) => b.w === wv && b.ok && !b.dead && (b.state === 'up' || b.locked));
          if (!alive) {
            wv.state = 'lost';
            for (const o of st.balls) if (o.w === wv && o.state === 'up') { o.state = 'away'; o.vy = Math.max(o.vy, 140 * S); }
            const b = st.balls.find((o) => o.w === wv && o.ok);
            g.miss(b ? b.dx : g.w / 2, g.hudTop + 50 * S);
            catDo('😿', 0, 1);
            g.after(0.9, () => { if (g.state === 'play' && st.wave === wv) spawnWave(g, wv.it, wv); });
          }
        }
        // 奖励气球
        if (g.level >= 2 && wv && wv.state === 'open') { st.starT -= dt; if (st.starT <= 0) { spawnBonus(g, 'star'); st.starT = g.rand(9, 14); } }
        if (st.heartT >= 0) { st.heartT -= dt; if (st.heartT < 0) { st.heartUsed = true; if (g.lives < g.maxLives) spawnBonus(g, 'heart'); } }
      },
      draw(g, c) {
        const tn = nowMs();
        let rdt = st.last ? (tn - st.last) / 1000 : 0;
        st.last = tn;
        if (!(rdt > 0)) rdt = 0; else if (rdt > 0.05) rdt = 0.05;
        st.clock += rdt;
        anim(g, rdt);
        drawStreaks(g, c);
        drawAmb(g, c);
        drawBunch(g, c, st.freed, false);
        drawBlimp(g, c);
        drawBanner(g, c);
        drawSplats(g, c);   // 墨汁溅在天上、压在气球下面：只吓一跳，不挡住别的气球上的字
        for (const b of st.balls) drawBalloon(g, c, b);
        drawPops(g, c);
        for (const d of st.darts) drawDart(g, c, d);
        drawBunch(g, c, st.bunch, true);
        drawTurret(g, c);
        drawButton(g, c);
        drawHint(g, c);
        drawReticle(g, c);
      },
      down(g, p) {
        const L = st.L;
        if (Math.hypot(p.x - L.bx, p.y - L.by) <= L.br + 10 * L.S) { st.kbd = false; replay(g); g.ring(L.bx, L.by, '#FFFFFF', 60 * L.S); return; }
        st.kbd = false;
        const b = pickAt(g, p);
        if (b) { st.hintOn = false; if (!waveBusy(b)) fire(g, b); return; }
        const bl = st.blimp;
        if (bl) { const nx = (p.x - bl.x) / (L.bw / 2 + 12 * L.S), ny = (p.y - bl.y) / (L.bh / 2 + 14 * L.S); if (nx * nx + ny * ny <= 1) { replay(g); g.ring(bl.x, bl.y, '#FFFFFF', 70 * L.S); return; } }
        if (p.y < L.py - 20 * L.S && st.fireCd <= 0) { st.fireCd = 0.18; fire(g, null, p.x, p.y); }
      },
      move(g, p) {
        if (p.y < st.L.py - 10 * st.L.S) st.aimTo = pivotAim(p.x, p.y);
        if (!p.down && p.type === 'mouse') { st.hover = pickAt(g, p); st.kbd = false; }
      },
      key(g, k) {
        if (k === 'space') { replay(g); g.ring(st.L.bx, st.L.by, '#FFFFFF', 60 * st.L.S); return; }
        if (k === 'left' || k === 'right') { st.hintOn = false; const was = st.kbd; st.kbd = true; moveSel(g, was ? (k === 'left' ? -1 : 1) : 0); return; }
        if (k === 'enter' || k === 'up') {
          st.hintOn = false; st.kbd = true;
          if (!targetable(g, st.sel)) moveSel(g, 0);
          if (targetable(g, st.sel) && !waveBusy(st.sel)) { const b = st.sel; fire(g, b); moveSel(g, 0); }
        }
      },
      resize(g) {
        const L = st.L, ow = L.w || g.w, oh = L.h || g.h;
        lay(g);
        const kx = g.w / ow, ky = g.h / oh;
        for (const b of st.balls) { b.x *= kx; b.y *= ky; refit(b); }
        for (const a of st.amb) a.y *= ky;
        st.cruise *= ky;
      },
      end() {
        try { if (W.__hwBalloon === st) W.__hwBalloon = null; } catch (e) { /* ignore */ }
      }
    };
    return spec;
  }

  HW.register({
    id: 'balloon', skill: 'listen', kind: 'arcade', name: '气球射击', blurb: '听词语，戳破写对的气球', icon: '🎈',
    needs: ['tts'], cols: ['pick'],
    start(ctx) {
      if (!HW.arcade || typeof HW.arcade.run !== 'function') {
        try { ctx.el.textContent = '游戏引擎没有加载，先玩别的吧。'; } catch (e) { /* ignore */ }
        return function () {};
      }
      return HW.arcade.run(ctx, makeSpec(ctx));
    }
  });
})();
