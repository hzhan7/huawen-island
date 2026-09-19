/* =====================================================================
 * 华文小岛 2.0 · 街机游戏 🧺 天降汉字（id = catcher，skill = listen，题库栏目 words）
 * 玩法：听词语（🔊 / 空格重听，第 2 遍读例句并显示挖空句）→ 汉字挂着降落伞、坐着小云朵从天上掉下来，
 *       左右移动头顶篮子的小熊猫，按顺序接住这个词的每个字（接到的字飞进上方田字格）。
 *       接到同音 / 近音干扰字 → 扣心；接到词里其他字但顺序不对 → 弹出去（不扣心）；
 *       需要的字掉到地上 → “溜走啦”并重新掉。
 * 关卡：越高越快、同屏越多、干扰越多；3 关起有炸弹 💣（接到扣心）/ 星星 ⭐（加分），4 关起爱心 💖（回血），
 *       6 关起夜晚 + 风，8 关起字会左右飘；6 关起不再显示拼音（纯听力）。
 * 依赖：HW.arcade（parts/15_arcade.js，SPEC_ARCADE.md §3）。
 * ===================================================================== */
(function () {
  'use strict';
  const W = window;
  const HW = W.HW;
  if (!HW || typeof HW.register !== 'function') return;

  const NAVY = '#1d2b53';
  const TAU = Math.PI * 2;
  const CHUTES = [['#FF5A5F', '#FFFFFF'], ['#3AA0FF', '#FFFFFF'], ['#FFC928', '#FF8A3D'], ['#3CCB5A', '#FFFFFF'],
    ['#B25CFF', '#FFE1F7'], ['#FF8A3D', '#FFF3B0'], ['#1FC7C1', '#FFFFFF'], ['#FF6FA8', '#FFFFFF']];
  const PRAISE = ['太棒了！', '好耳朵！', '接得准！', '真厉害！', '了不起！', '顺风耳！'];
  const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
  const lerp = (a, b, t) => a + (b - a) * t;
  const rnd = (a, b) => a + Math.random() * (b - a);
  const isHan = (ch) => /[㐀-鿿豈-﫿]/.test(ch);
  const nowMs = () => (W.performance && performance.now ? performance.now() : Date.now());

  /* 每关参数：k = 0（第 1 关）→ 1（第 10 关） */
  function params(lv) {
    const k = (clamp(lv, 1, 10) - 1) / 9;
    return {
      // 试玩修订：原 3.9s 起步 + 词与词之间 2 秒以上空屏，P2 第 1 关一个两字词要等 7–8 秒，孩子会走神
      fall: 3.3 - 1.5 * k,                          // 从出现到落进篮子的秒数（第 1 关 3.3s → 第 10 关 1.8s）
      gap: 1.15 - 0.55 * k,                         // 随机出字间隔
      maxOn: Math.min(8, 3 + Math.floor(lv / 2)),   // 同屏上限：1 关 3 → 2 关 4 → … → 10 关 8
      decoy: 0.4 + 0.28 * k,                        // 随机出字里干扰字的比例
      bomb: lv >= 3 ? 0.07 + 0.012 * (lv - 3) : 0,
      star: lv >= 3 ? 0.06 : 0.03,
      heart: lv >= 4 ? 0.035 : 0,
      wind: lv >= 6 ? 24 + 9 * (lv - 6) : 0,
      zig: lv >= 8 ? 0.4 : 0,
      glow: lv <= 2,                                // 1–2 关：要接的字发金光
      py: lv <= 5,                                  // 1–5 关显示拼音
      basket: 1 - 0.016 * (clamp(lv, 1, 10) - 1)
    };
  }

  /* g.similarChars 是引擎扩展：缺失时用 charPool 自己造同音 / 同声母或韵母的干扰字 */
  const INI = ['zh', 'ch', 'sh', 'b', 'p', 'm', 'f', 'd', 't', 'n', 'l', 'g', 'k', 'h', 'j', 'q', 'x', 'r', 'z', 'c', 's', 'y', 'w'];
  function splitPy(s) { for (const i of INI) if (s.length > i.length && s.indexOf(i) === 0) return [i, s.slice(i.length)]; return ['', s]; }
  function similar(g, ch, n, exclude) {
    if (typeof g.similarChars === 'function') { try { return g.similarChars(ch, n, exclude); } catch (e) { /* fall through */ } }
    let P = {};
    try { P = (typeof g.charPool === 'function' && g.charPool()) || {}; } catch (e) { P = {}; }
    const ex = new Set(Array.from(String(exclude || ''))); ex.add(ch);
    const py = P[ch]; const [i0, f0] = py ? splitPy(py) : ['', ''];
    const a = [], b = [], c = [];
    for (const k in P) {
      if (ex.has(k) || !isHan(k)) continue;
      if (py && P[k] === py) a.push(k);
      else if (py) { const [i1, f1] = splitPy(P[k]); if ((i0 && i1 === i0) || f1 === f0) b.push(k); else c.push(k); }
      else c.push(k);
    }
    const sh = (arr) => (typeof g.shuffle === 'function' ? g.shuffle(arr) : arr.sort(() => Math.random() - 0.5));
    return sh(a).concat(sh(b), sh(c)).slice(0, n);
  }

  function makeSpec(ctx) {
    const S = { items: [], grad: {} };

    /* ---------------- 布局 ---------------- */
    function layout(g) {
      const w = g.w, h = g.h, top = g.hudTop || 58;
      // 试玩修订：横竖屏切换时旧坐标直接夹进新出字带，右半边的字全挤到右边缘叠成一摞（要的字被压在底下看不见）。
      // 现在按比例把天上的字、篮子一起搬到新布局里，下落时间不变。
      const old = S.bandW && S.rimY > S.top ? { L: S.bandL, W: S.bandW, top: S.top, rim: S.rimY, gy: S.groundY } : null;
      const s = clamp(Math.min(w / 390, (h - top) / 580), 0.8, 1.35);
      S.s = s;
      S.bandW = Math.min(w - 20, Math.max(340 * s, Math.min(w, (h - top) * 1.15)));
      S.bandL = (w - S.bandW) / 2; S.bandR = S.bandL + S.bandW;
      S.sandY = h - Math.max(38, h * 0.075);
      S.groundY = S.sandY + Math.min(22 * s, (h - S.sandY) * 0.5);
      S.tileR = Math.round(29 * s);
      S.bw = 132 * s * (S.P ? S.P.basket : 1);
      S.rimY = S.groundY - 148 * s;
      S.grad = {}; S.hb = null;
      layoutBoard(g);
      if (old) remap(old);
      S.bx = clamp(S.bx == null ? w / 2 : S.bx, S.bandL + S.bw / 2, S.bandR - S.bw / 2);
      if (S.tx != null) S.tx = clamp(S.tx, S.bandL + S.bw / 2, S.bandR - S.bw / 2);
      if (!S.streaks) {
        S.streaks = []; for (let i = 0; i < 9; i++) S.streaks.push({ x: Math.random(), y: Math.random(), len: rnd(40, 110), ph: rnd(0, TAU) });
        S.leaves = []; for (let i = 0; i < 4; i++) S.leaves.push({ x: Math.random(), y: Math.random(), ph: rnd(0, TAU), r: rnd(0, TAU) });
      }
    }
    function remap(o) {
      const fx = (x) => S.bandL + (x - o.L) / o.W * S.bandW;
      const span0 = Math.max(1, o.rim - o.top), span1 = Math.max(1, S.rimY - S.top), ky = span1 / span0;
      const fy = (y) => S.top + (y - o.top) * ky;
      if (S.bx != null) S.bx = fx(S.bx);
      if (S.tx != null) S.tx = fx(S.tx);
      for (const it of S.items || []) {
        it.x = fx(it.x);
        if (it.mode === 'fall') { it.bx = fx(it.bx); it.y = fy(it.y); it.vy *= ky; }
        else if (it.mode === 'land') it.y = S.groundY - S.tileR * 0.5;
        else if (it.mode === 'fly') { it.sx = fx(it.sx); it.sy = fy(it.sy); }
        else it.y = fy(it.y);
      }
    }
    function layoutBoard(g) {
      const s = S.s, n = Math.max(1, (S.chars && S.chars.length) || 2);
      const top = g.hudTop + 4 * s;
      const spk = 52 * s, gapSB = 10 * s, padX = 12 * s, gap = 8 * s;
      const maxW = g.w - 24;
      let slot = Math.min(72 * s, (maxW - spk - gapSB - 2 * padX - (n - 1) * gap) / n);
      slot = Math.max(38, slot);
      const pyH = 22 * s, padT = 8 * s, padB = 10 * s;
      const bw = 2 * padX + n * slot + (n - 1) * gap;
      const bh = padT + pyH + slot + padB;
      const gx = (g.w - (spk + gapSB + bw)) / 2;
      S.board = { x: gx + spk + gapSB, y: top, w: bw, h: bh };
      S.spk = { x: gx + spk / 2, y: top + bh / 2 + 2 * s, r: spk / 2 };
      // 窄屏四字词时喇叭贴到左边缘，会和引擎“朗读中”小喇叭徽章（HUD 下方左上角）叠在一起：往下让一让
      if (S.spk.x - S.spk.r < 60) S.spk.y = Math.min(top + bh - S.spk.r, Math.max(S.spk.y, g.hudTop + 40 + S.spk.r));
      S.slots = [];
      for (let i = 0; i < n; i++) S.slots.push({ x: S.board.x + padX + slot / 2 + i * (slot + gap), y: top + padT + pyH + slot / 2, size: slot, pyY: top + padT + pyH / 2 });
      S.top = top + bh + 8 * s;
    }

    /* ---------------- 词语 ---------------- */
    function buildDecoys(g, chars) {
      const word = chars.join('');
      const per = chars.map((ch) => similar(g, ch, 6, word).filter((x) => word.indexOf(x) < 0));
      const all = [];
      per.forEach((arr) => arr.forEach((x) => { if (all.indexOf(x) < 0) all.push(x); }));
      if (all.length < 4) {
        let P = {};
        try { P = g.charPool() || {}; } catch (e) { P = {}; }
        const extra = (g.shuffle ? g.shuffle(Object.keys(P)) : Object.keys(P)).filter((x) => isHan(x) && word.indexOf(x) < 0 && all.indexOf(x) < 0);
        while (all.length < 6 && extra.length) all.push(extra.pop());
        if (!all.length) all.push('日', '月', '山', '水', '口', '木');
      }
      return { per, all };
    }
    function startWord(g, i) {
      S.wordIdx = i;
      S.item = S.list[i];
      S.chars = Array.from(S.item.w).filter(isHan);
      const py = String(S.item.py || '').trim().split(/\s+/).filter(Boolean);
      S.py = py.length === S.chars.length ? py : [];
      S.idx = 0;
      S.fill = S.chars.map(() => false);
      S.pop = S.chars.map(() => 0);
      S.sayN = 0; S.hintT = 0; S.doneT = -1; S.slotHint = 0; S.needWait = false; S.needT = 0.4; S.fixT = 0; S.fixK = -1;
      S.spawnT = 1.0;
      S.decoy = buildDecoys(g, S.chars);
      S.easy = g.level === 1 && i === 0;
      layoutBoard(g);
      if (S.started) {
        S.busy = true;
        S.boardIn = 0;
        g.tween(S, { boardIn: 1 }, 0.45, 'outBack');
        g.sfx('whoosh');
        // 词牌一落定就读词并立刻放下第一个字 + 一个陪跑字：天上不留空（原先要再等 0.4+0.3 秒才出第一个字）
        g.after(0.3, () => { S.busy = false; S.needT = 0; S.spawnT = 0.45; speakWord(g); });
      } else { S.busy = true; S.boardIn = 1; }
    }
    function speakWord(g) {
      if (!S.item) return;
      S.spkBump = 1;
      g.say(S.item.w, { caption: S.item.py || '' });
    }
    function replay(g) {
      if (!S.item || g.state !== 'play') return;
      S.sayN++;
      S.spkBump = 1;
      g.sfx('tick');
      if (S.sayN % 2 === 1 && S.item.s) { S.hintT = 5; g.say(S.item.s); }
      else g.say(S.item.w, { caption: S.item.py || '' });
    }
    function begin(g) {
      if (S.started) return;
      S.started = true;
      S.busy = false;
      S.needT = S.easy ? 0.35 : 0.2; S.spawnT = S.easy ? 1.2 : 0.7;
      speakWord(g);
    }
    function showPinyin() {
      let tts = false;
      try { tts = !!(ctx.tts && ctx.tts.ok); } catch (e) { tts = false; }
      return S.P.py || !tts;
    }

    /* ---------------- 出字 ---------------- */
    /* 选出字的 x：①和“差不多同时落到篮口”的东西横向拉开一个篮子宽（否则要的字和干扰字/炸弹贴着一起掉，
       怎么接都会连带接错——试玩时 P2 第 1 关叠词就因此连扣 3 心）；②和刚出发的字别挤在一起（好认） */
    function pickX(g, eta) {
      const m = S.tileR * 1.35 + 4;
      const lo = S.bandL + m, hi = S.bandR - m;
      const catchY = S.rimY - S.tileR * 0.2;
      const sep = S.bw * 0.5 + S.tileR * 1.5, near = S.tileR * 3.2;
      let best = rnd(lo, hi), bestSc = -1e9;
      for (let i = 0; i < 14; i++) {
        const x = rnd(lo, hi);
        let sc = 1e9;
        for (const o of S.items) {
          if (o.mode !== 'fall' || o.passed) continue;
          const dx = Math.abs(o.bx - x);
          const dT = Math.abs((catchY - o.y) / Math.max(1, o.vy) - eta);
          let want = 0;
          if (dT < 0.9) want = sep * (dT < 0.45 ? 1 : 1 - (dT - 0.45) / 0.9);
          if (o.y < spawnTop(g) + 170 * S.s) want = Math.max(want, near);
          sc = Math.min(sc, dx - want);
        }
        if (sc > bestSc) { bestSc = sc; best = x; }
        if (sc >= 0) break;
      }
      return best;
    }
    function spawn(g, kind, ch) {
      const s = S.s;
      const y = spawnTop(g) + 30 * s;
      const dist = Math.max(120, S.rimY - y);
      let vy = dist / S.P.fall * rnd(0.9, 1.12);
      if (S.easy) vy *= 0.85;
      if (kind === 'bomb') vy *= 1.22;
      else if (kind === 'star') vy *= 1.08;
      else if (kind === 'heart') vy *= 0.85;
      const ride = kind === 'ch' && Math.random() < 0.28 ? 'cloud' : 'chute';
      if (ride === 'cloud') vy *= 1.06;
      const x = pickX(g, (S.rimY - S.tileR * 0.2 - y) / vy);
      const it = {
        kind, ch: ch || '', x, bx: x, y, vy, vx: 0, age: 0, ph: rnd(0, TAU), mode: 'fall', sc: 0, t: 0,
        chute: Math.floor(Math.random() * CHUTES.length), ride,
        zig: kind === 'ch' && Math.random() < S.P.zig ? 36 * s : 0, rot: 0, vr: 0, spin: Math.random() < 0.5 ? -1 : 1,
        passed: false, bad: false, fp: 0, k: -1, sx: 0, sy: 0
      };
      S.items.push(it);
      g.tween(it, { sc: 1 }, 0.38, 'outBack');
      g.burst(x, y - 10 * s, { kind: 'dot', color: '#FFFFFF', n: 7 });
      return it;
    }
    function spawnRandom(g) {
      const P = S.P;
      let r = Math.random();
      if (!S.easy) {
        if (r < P.bomb) return spawn(g, 'bomb');
        r -= P.bomb;
        if (r < P.star) return spawn(g, 'star');
        r -= P.star;
        if (g.lives < g.maxLives && r < P.heart) return spawn(g, 'heart');
      }
      const need = S.chars[S.idx];
      if (Math.random() < (S.easy ? 0.3 : P.decoy)) {
        const near = S.decoy.per[S.idx] || [];
        const src = near.length && Math.random() < 0.65 ? near : S.decoy.all;
        if (src.length) return spawn(g, 'ch', src[Math.floor(Math.random() * src.length)]);
      }
      const rem = S.chars.slice(S.idx);
      let copies = 0;
      for (const o of S.items) if (o.mode === 'fall' && !o.passed && o.kind === 'ch' && o.ch === need) copies++;
      const ch = (rem.length === 1 || (Math.random() < 0.45 && copies < 2)) ? need : rem[1 + Math.floor(Math.random() * (rem.length - 1))];
      return spawn(g, 'ch', ch);
    }

    /* ---------------- 接住 ---------------- */
    function caught(g, it) {
      S.sqT = 0;
      if (it.kind === 'bomb') return boom(g, it);
      if (it.kind === 'star') {
        it.mode = 'dead';
        g.addScore(30, it.x, S.rimY - 50 * S.s);
        g.burst(it.x, S.rimY - 10 * S.s, { kind: 'star', n: 16, color: '#FFD23F' });
        g.ring(it.x, S.rimY - 10 * S.s, '#FFE45C', 90 * S.s);
        g.sfx('star');
        S.face = 'happy'; S.faceT = 0.8;
        return;
      }
      if (it.kind === 'heart') {
        it.mode = 'dead';
        if (g.lives < g.maxLives) { g.lives++; g.float('回血！', it.x, S.rimY - 50 * S.s, { color: '#FF8FB1', size: 30 }); }
        else g.addScore(20, it.x, S.rimY - 50 * S.s);
        g.burst(it.x, S.rimY - 10 * S.s, { kind: 'dot', color: '#FF6FA8', n: 16 });
        g.ring(it.x, S.rimY - 10 * S.s, '#FF8FB1', 90 * S.s);
        g.sfx('power');
        S.face = 'happy'; S.faceT = 0.8;
        return;
      }
      if (S.busy || S.idx >= S.chars.length) { tumble(g, it, 0); return; }
      const need = S.chars[S.idx];
      if (it.ch === need) return good(g, it);
      if (S.chars.indexOf(it.ch) >= 0) {   // 词里的字，但顺序不对：弹出去，不扣心
        tumble(g, it, 0);
        S.slotHint = 1.2;
        g.sfx('jump');
        // 试玩修订：原来一律提示“先接第 N 个字”。可“实事求是”接第 4 个字时接到“事”（第 2 个字，早接过了），
        // 这不是顺序问题——提示改成“接过啦”，免得孩子以为“事”还要再接一次
        const later = S.chars.indexOf(it.ch, S.idx + 1) >= 0;
        if (!(S.orderT > 0)) { g.float(later ? '先接第' + (S.idx + 1) + '个字！' : '“' + it.ch + '”接过啦！', clamp(it.x, 90, g.w - 90), S.rimY - 60 * S.s, { color: '#FFE45C', size: 26 }); S.orderT = 1.6; }
        return;
      }
      bad(g, it, need);
    }
    function good(g, it) {
      const s = S.s, k = S.idx;
      S.idx++;
      it.mode = 'fly'; it.k = k; it.fp = 0;
      it.sx = it.x; it.sy = S.rimY - 8 * s;
      g.sfx('pop');
      g.burst(it.sx, it.sy, { kind: 'star', n: 9 });
      g.ring(it.sx, it.sy, '#FFE45C', 70 * s);
      g.addScore(5, it.sx, it.sy - 44 * s);
      S.face = 'happy'; S.faceT = 0.8; S.glowT = 0.5; S.hopT = 0;
      if (S.idx >= S.chars.length) S.busy = true;
      else {
        S.needWait = true; S.needT = 0.15;
        // 这个字后面不再需要了（如“高高兴兴”两个“高”都接到了）：天上剩下的同一个字“噗”地化成金币，免得孩子接着追
        if (S.chars.indexOf(it.ch, S.idx) < 0) {
          let n = 0;
          for (const o of S.items) {
            if (o === it || o.mode !== 'fall' || o.passed || o.kind !== 'ch' || o.ch !== it.ch) continue;
            o.mode = 'pop'; o.t = 0;
            const x = o.x, y = o.y;
            g.after(0.05 * n++, () => { g.burst(x, y, { kind: 'coin', n: 3 }); g.burst(x, y, { kind: 'dot', color: '#FFFFFF', n: 5 }); g.sfx('bubble'); });
          }
        }
      }
      g.after(0.12, () => g.sfx('whoosh'));
      g.tween(it, { fp: 1 }, 0.6, 'inOutQuad', () => arrive(g, it));
    }
    function arrive(g, it) {
      it.mode = 'dead';
      const k = it.k, sl = S.slots[k];
      if (!sl || !S.fill || k >= S.fill.length) return;
      S.fill[k] = true;
      S.pop[k] = 0;
      g.tween(S.pop, { [k]: 1 }, 0.42, 'outBack');
      g.sfx('match');
      g.burst(sl.x, sl.y, { kind: 'star', n: 10 });
      g.burst(sl.x, sl.y, { kind: 'spark', n: 10 });
      g.ring(sl.x, sl.y, '#FFFFFF', 56 * S.s);
      S.boardBump = 1;
      if (S.fill.every(Boolean) && g.state === 'play') wordDone(g);   // 输了之后才落进格子的字：不再夸“太棒了”
    }
    function wordDone(g) {
      const B = S.board, s = S.s;
      S.doneT = 0; S.busy = true; S.hintT = 0;
      g.right(S.item, B.x + B.w / 2, B.y + B.h * 0.6);
      g.float(PRAISE[Math.floor(Math.random() * PRAISE.length)], g.w / 2, S.top + 70 * s, { color: '#FFFFFF', size: 36 });
      // 清屏奖励：天上剩下的字“啵”地一下全变成金币撒下来（打击感 + 词与词之间不冷场）
      let k = 0;
      for (const it of S.items) {
        if (it.mode !== 'fall') continue;
        it.mode = 'pop'; it.t = 0;
        const x = it.x, y = it.y;
        g.after(0.06 * k++, () => { g.burst(x, y, { kind: 'coin', n: 4 }); g.burst(x, y, { kind: 'dot', color: '#FFFFFF', n: 5 }); g.sfx('bubble'); });
      }
      if (!k) g.sfx('bubble');
      S.hopT = 0;
      const nxt = S.wordIdx + 1;
      if (nxt < S.list.length) g.after(1.05, () => { if (g.state === 'play') startWord(g, nxt); });
    }
    function bad(g, it, need) {
      const s = S.s;
      tumble(g, it, 1);
      it.bad = true;
      g.burst(it.x, S.rimY - 10 * s, { kind: 'ink', n: 16 });
      S.face = 'dizzy'; S.faceT = 1.1;
      const w = S.item.w, py = S.item.py ? '（' + S.item.py + '）' : '';
      const note = w + py + '：第' + (S.idx + 1) + '个字是“' + need + '”，接成了“' + it.ch + '”';
      // 红笔订正：当前格子里浮出正确的字（和它的拼音）1.8 秒——接错了要马上看到对的是哪个（珍 ≠ 身）
      S.fixK = S.idx; S.fixT = 1.8;
      g.wrong(S.item, note, it.x, S.rimY - 30 * s);
    }
    function boom(g, it) {
      const s = S.s, x = it.x, y = S.rimY - 12 * s;
      it.mode = 'dead';
      g.burst(x, y, { kind: 'dot', color: '#FF8A3D', n: 22 });
      g.burst(x, y, { kind: 'dot', color: '#FFD23F', n: 12 });
      g.burst(x, y, { kind: 'spark', n: 18 });
      g.burst(x, y, { kind: 'ink', color: '#3B3B4F', n: 8 });
      g.ring(x, y, '#FF8A3D', 140 * s); g.ring(x, y, '#FFE45C', 80 * s);
      g.shake(20); g.flash('#FFB070'); g.sfx('crash');
      g.float('轰！', x, y - 50 * s, { color: '#FF8A3D', size: 46 });
      S.face = 'dizzy'; S.faceT = 1.4; S.soot = 1;
      g.combo = 0;   // 引擎没有“只扣心不记错题”的接口：手动扣心（见 kit_issues）
      if (g.maxLives > 0) {
        g.lives = Math.max(0, g.lives - 1);
        g.sfx('heart');
        if (g.lives <= 0) g.lose();
      }
    }
    function tumble(g, it, hard) {
      const s = S.s;
      it.mode = 'tumble'; it.t = 0; it.passed = true;
      it.y = Math.min(it.y, S.rimY - S.tileR * 0.3);
      const dir = it.x < S.bx ? -1 : 1;
      it.vx = dir * rnd(110, 190) * s * (hard ? 1.2 : 1);
      it.vy = -rnd(360, 460) * s;
      it.vr = dir * rnd(5, 9);
    }
    /* 弹飞 / 落地 / 清屏气泡：只是动画，不判定（结束动画期间也由 overDrift 继续推进，免得字卡定格在篮口） */
    function stepLoose(g, it, dt) {
      if (it.mode === 'tumble') {
        it.t += dt;
        it.vy += 1300 * S.s * dt;
        it.x += it.vx * dt; it.y += it.vy * dt;
        it.rot = (it.rot || 0) + it.vr * dt;
        if (it.y > g.h + 80 || it.t > 1.8) it.mode = 'dead';
      } else if (it.mode === 'land' || it.mode === 'pop') {
        it.t += dt;
        if (it.t > 0.35) it.mode = 'dead';
      }
    }
    /* 结束仪式（引擎 over 状态只调 draw）：过关 = 小熊猫举着篮子蹦跳欢呼；失败 = 头晕，天上的字全被吹散 */
    function overDrift(g, dt) {
      if (!S.overInit) {
        S.overInit = true;
        S.won = g.done >= g.rounds && g.lives > 0;
        S.face = S.won ? 'happy' : 'dizzy'; S.faceT = 99;
        // 没过关：词语牌上把没接到的字用红笔补出来，再读一遍这个词——输了也知道正确答案是什么
        if (!S.won && S.item && S.fill && !S.fill.every(Boolean)) {
          S.reveal = true; S.fixT = 0;
          const w = S.item.w;
          g.after(0.7, () => { try { g.say(w, { caption: S.item && S.item.py || '' }); } catch (e) { /* ignore */ } });
        }
        S.tx = null; S.bv = 0; S.run = 0;
        for (const it of S.items) {
          if (it.mode !== 'fall') continue;
          if (S.won) { it.mode = 'pop'; it.t = 0; } else { tumble(g, it, 1); it.vy *= 0.6; }
        }
      }
      for (const it of S.items) stepLoose(g, it, dt);
    }
    function land(g, it) {
      const s = S.s;
      it.mode = 'land'; it.t = 0;
      it.y = S.groundY - S.tileR * 0.5;
      const night = g.sky === 'night';
      g.burst(it.x, S.groundY - 6 * s, { kind: 'dot', color: night ? '#B08A66' : '#F3C66E', n: 9 });
      if (it.kind === 'bomb') { g.burst(it.x, S.groundY - 10 * s, { kind: 'dot', color: '#FF8A3D', n: 10 }); g.shake(4); g.sfx('hit'); return; }
      // 试玩修订：天上常同时掉着两三个“要的字”，孩子正去接另一个，这个落地就喊“溜走啦”并断连击，不公平。
      // 只有最后一个要的字也掉了（天上再没有它）才算溜走。
      if (it.kind === 'ch' && !S.busy && it.ch === S.chars[S.idx]) {
        let more = false;
        for (const o of S.items) if (o !== it && o.mode === 'fall' && !o.passed && o.kind === 'ch' && o.ch === it.ch) { more = true; break; }
        if (!more) g.miss(it.x, S.groundY - 70 * s);
      }
    }

    /* ---------------- 小熊猫 + 篮子移动 ---------------- */
    function moveBasket(g, dt) {
      const s = S.s, held = g.held || {};
      const dir = (held.left ? -1 : 0) + (held.right ? 1 : 0);
      const vmax = 760 * s;
      if (dir) {
        S.tx = null; S.moved = true;
        if (Math.sign(S.bv) !== dir) S.bv *= 0.5;
        S.bv = clamp(S.bv + dir * 5200 * s * dt, -vmax, vmax);
      } else if (S.tx != null) {
        const want = clamp((S.tx - S.bx) * 13, -1600 * s, 1600 * s);
        S.bv += (want - S.bv) * Math.min(1, dt * 22);
        if (Math.abs(S.tx - S.bx) < 0.8 && !S.drag) S.tx = null;
      } else S.bv *= Math.exp(-dt * 26);   // 试玩修订：原 14 松键后还要滑出半个篮子（键盘接字总是冲过头），改成利落刹车
      const lo = S.bandL + S.bw / 2, hi = S.bandR - S.bw / 2;
      const nx = clamp(S.bx + S.bv * dt, lo, hi);
      if ((nx === lo && S.bv < 0) || (nx === hi && S.bv > 0)) S.bv = 0;
      S.bx = nx;
      S.tilt += (clamp(S.bv / (900 * s), -1, 1) * 0.2 - S.tilt) * Math.min(1, dt * 10);
      S.leg += Math.abs(S.bv) * dt * 0.05;
      S.run += (clamp(Math.abs(S.bv) / (260 * s), 0, 1) - S.run) * Math.min(1, dt * 10);
    }
    function setTarget(p) {
      S.tx = clamp(p.x, S.bandL + S.bw / 2, S.bandR - S.bw / 2);
      S.moved = true;
    }

    function swayX(it) {
      let x = 0;
      if (it.kind === 'ch' && it.ride === 'chute') x += Math.sin(it.age * 1.7 + it.ph) * 9 * S.s;
      else if (it.kind === 'heart') x += Math.sin(it.age * 2.2 + it.ph) * 14 * S.s;
      if (it.zig) x += Math.sin(it.age * 2.3 + it.ph) * it.zig;
      return x;
    }
    function flyPos(it, out) {
      const sl = S.slots[it.k] || S.slots[0];
      const e = it.fp;
      out.x = lerp(it.sx, sl.x, e);
      out.y = lerp(it.sy, sl.y, e) - Math.sin(e * Math.PI) * 130 * S.s;
      out.k = lerp(1, sl.size * 0.95 / (S.tileR * 2), e);
      return out;
    }
    const FP = { x: 0, y: 0, k: 1 };
    const ENTRY = 0.9;   // 开场跑进场的秒数

    /* ---------------- 画：物件 ---------------- */
    function glowGrad(c, key, r, stops) {
      let gr = S.grad[key];
      if (!gr) { gr = c.createRadialGradient(0, 0, 0, 0, 0, r); for (let i = 0; i < stops.length; i += 2) gr.addColorStop(stops[i], stops[i + 1]); S.grad[key] = gr; }
      return gr;
    }
    function canopyPath(c, R, cy, s) {
      c.beginPath();
      c.moveTo(-R, cy);
      c.bezierCurveTo(-R, cy - R * 1.02, R, cy - R * 1.02, R, cy);
      const seg = 2 * R / 4;
      for (let i = 0; i < 4; i++) c.quadraticCurveTo(R - seg * (i + 0.5), cy + 7 * s, R - seg * (i + 1), cy);
      c.closePath();
    }
    function drawTile(g, c, it, need) {
      const s = S.s, r = S.tileR;
      const bad = it.bad;
      g.rrect(-r, -r + 4 * s, 2 * r, 2 * r, r * 0.32, 'rgba(29,43,83,.35)');
      g.rrect(-r, -r, 2 * r, 2 * r, r * 0.32, bad ? '#DADCE6' : need && S.P.glow ? '#FFF6C8' : '#FFFBEF', NAVY, 3 * s);
      c.save();
      c.setLineDash([3 * s, 3 * s]); c.strokeStyle = 'rgba(224,70,60,.3)'; c.lineWidth = 1.2 * s;
      c.beginPath(); c.moveTo(-r + 5 * s, 0); c.lineTo(r - 5 * s, 0); c.moveTo(0, -r + 5 * s); c.lineTo(0, r - 5 * s); c.stroke();
      c.restore();
      g.text(it.ch, 0, 1.5 * s, { size: Math.round(r * 1.45), font: 'kai', color: bad ? '#8A8FA6' : NAVY, weight: 700 });
      if (bad) {
        c.strokeStyle = '#FF3B3B'; c.lineWidth = 5 * s; c.lineCap = 'round';
        c.beginPath(); c.moveTo(-r * 0.6, -r * 0.6); c.lineTo(r * 0.6, r * 0.6); c.moveTo(r * 0.6, -r * 0.6); c.lineTo(-r * 0.6, r * 0.6); c.stroke();
      }
    }
    function drawChar(g, c, it, clk) {
      const s = S.s, r = S.tileR;
      const need = !S.busy && it.ch === S.chars[S.idx] && it.mode === 'fall' && !it.passed;
      const glow = need && S.P.glow;
      const ang = it.ride === 'chute' ? Math.cos(it.age * 1.7 + it.ph) * 0.14 - S.wind / (500 * s) : Math.sin(it.age * 3 + it.ph) * 0.08;
      c.save();
      c.translate(it.x, it.y);
      c.rotate(ang);
      c.scale(it.sc, it.sc);
      if (it.mode === 'land' || it.mode === 'pop') { const k = it.t / 0.35; c.globalAlpha *= Math.max(0, 1 - k); if (it.mode === 'pop') c.scale(1 + k * 0.5, 1 + k * 0.5); else c.scale(1 + k * 0.3, 1 - k * 0.45); }
      if (glow) {
        const pulse = 0.5 + 0.5 * Math.sin(clk * 6);
        c.globalAlpha *= 0.6 + 0.4 * pulse;
        c.fillStyle = glowGrad(c, 'glow', r * 2.3, [0, 'rgba(255,236,120,.95)', 0.45, 'rgba(255,214,60,.5)', 1, 'rgba(255,200,40,0)']);
        c.beginPath(); c.arc(0, 0, r * 2.3, 0, TAU); c.fill();
        c.globalAlpha = it.sc > 0 ? 1 : 0;
        c.save(); c.rotate(clk * 2); c.setLineDash([7 * s, 6 * s]); c.strokeStyle = '#FFE45C'; c.lineWidth = 3.5 * s;
        c.beginPath(); c.arc(0, 0, r * 1.5, 0, TAU); c.stroke(); c.restore();
      }
      if (it.ride === 'chute' && it.mode !== 'land') {
        const R = r * 1.32, cy = -r - 30 * s, col = CHUTES[it.chute];
        c.strokeStyle = 'rgba(29,43,83,.75)'; c.lineWidth = 1.6 * s;
        c.beginPath();
        c.moveTo(-R * 0.96, cy); c.lineTo(-r * 0.55, -r);
        c.moveTo(-R * 0.34, cy + 3 * s); c.lineTo(-r * 0.18, -r);
        c.moveTo(R * 0.34, cy + 3 * s); c.lineTo(r * 0.18, -r);
        c.moveTo(R * 0.96, cy); c.lineTo(r * 0.55, -r);
        c.stroke();
        canopyPath(c, R, cy, s);
        c.fillStyle = col[0]; c.fill();
        c.save(); c.clip();
        c.fillStyle = col[1];
        c.beginPath(); c.ellipse(0, cy, R * 0.24, R * 1.2, 0, 0, TAU); c.fill();
        c.fillStyle = col[1]; c.globalAlpha *= 0.55;
        c.beginPath(); c.ellipse(-R * 0.72, cy, R * 0.12, R * 1.2, 0.35, 0, TAU); c.ellipse(R * 0.72, cy, R * 0.12, R * 1.2, -0.35, 0, TAU); c.fill();
        c.restore();
        canopyPath(c, R, cy, s);
        c.strokeStyle = NAVY; c.lineWidth = 2.6 * s; c.lineJoin = 'round'; c.stroke();
        c.fillStyle = 'rgba(255,255,255,.55)';
        c.beginPath(); c.ellipse(-R * 0.42, cy - R * 0.52, R * 0.2, R * 0.09, -0.55, 0, TAU); c.fill();
        if (need && S.easy) {
          const by = cy - R * 0.95 - 16 * s + Math.sin(clk * 7) * 4 * s;
          g.text('接我！', 0, by, { size: Math.round(19 * s), font: 'round', color: '#FFE45C', stroke: NAVY, strokeW: 4 * s });
        }
      } else if (it.ride === 'cloud') {
        drawRideCloud(c, r, s, it.age * 2.4 + it.ph);
      }
      drawTile(g, c, it, need);
      c.restore();
    }
    /* 小云朵坐骑：描边卡通云，左右摇、底下有两道“呼呼”的风线 */
    function drawRideCloud(c, r, s, ph) {
      const y = r * 0.95, k = r / 29;
      c.save();
      c.translate(0, y);
      c.rotate(Math.sin(ph) * 0.12);
      const blob = () => {
        c.beginPath();
        c.arc(-26 * k, 4 * k, 14 * k, Math.PI * 0.5, Math.PI * 1.5);
        c.arc(-12 * k, -8 * k, 15 * k, Math.PI, Math.PI * 1.85);
        c.arc(10 * k, -10 * k, 17 * k, Math.PI * 1.1, Math.PI * 1.95);
        c.arc(28 * k, 4 * k, 13 * k, Math.PI * 1.5, Math.PI * 0.5);
        c.closePath();
      };
      blob();
      c.fillStyle = '#FFFFFF'; c.fill();
      c.save(); c.clip();
      c.fillStyle = '#CFE8FF'; c.fillRect(-45 * k, 7 * k, 90 * k, 14 * k);
      c.restore();
      blob(); c.lineWidth = 2.6 * s; c.strokeStyle = NAVY; c.lineJoin = 'round'; c.stroke();
      c.strokeStyle = 'rgba(255,255,255,.85)'; c.lineWidth = 2.4 * s; c.lineCap = 'round';
      const w = Math.sin(ph * 2) * 3 * k;
      c.beginPath(); c.moveTo(-18 * k, 25 * k); c.lineTo(-6 * k + w, 25 * k); c.moveTo(4 * k, 30 * k); c.lineTo(18 * k - w, 30 * k); c.stroke();
      c.restore();
    }
    function drawThing(g, c, it, clk) {
      const s = S.s, r = S.tileR;
      c.save();
      c.translate(it.x, it.y);
      c.scale(it.sc, it.sc);
      if (it.mode === 'land' || it.mode === 'pop') { const k = it.t / 0.35; c.globalAlpha *= Math.max(0, 1 - k); c.scale(1 + k * 0.5, 1 + k * 0.5); }
      const pulse = 0.5 + 0.5 * Math.sin(clk * 8 + it.ph);
      if (it.kind === 'bomb') {
        c.strokeStyle = 'rgba(255,60,60,' + (0.35 + 0.4 * pulse).toFixed(3) + ')'; c.lineWidth = 3.5 * s;
        c.beginPath(); c.arc(0, 0, r * 1.28 + pulse * 3 * s, 0, TAU); c.stroke();
        c.rotate(it.rot);
        g.emoji('💣', 0, 0, r * 2.2);
        c.fillStyle = glowGrad(c, 'fuse', 12 * s, [0, 'rgba(255,255,200,1)', 0.4, 'rgba(255,190,40,.9)', 1, 'rgba(255,120,20,0)']);
        c.translate(r * 0.62, -r * 0.7);
        c.scale(0.7 + pulse * 0.6, 0.7 + pulse * 0.6);
        c.beginPath(); c.arc(0, 0, 12 * s, 0, TAU); c.fill();
      } else if (it.kind === 'star') {
        c.fillStyle = glowGrad(c, 'starglow', r * 1.9, [0, 'rgba(255,245,160,.9)', 1, 'rgba(255,230,90,0)']);
        c.globalAlpha *= 0.7 + 0.3 * pulse;
        c.beginPath(); c.arc(0, 0, r * 1.9, 0, TAU); c.fill();
        c.globalAlpha = 1;
        g.emoji('⭐', 0, 0, r * 2 * (1 + 0.08 * pulse), { rot: Math.sin(it.age * 3) * 0.4 });
      } else {
        c.fillStyle = glowGrad(c, 'heartglow', r * 1.8, [0, 'rgba(255,170,210,.85)', 1, 'rgba(255,120,180,0)']);
        c.beginPath(); c.arc(0, 0, r * 1.8, 0, TAU); c.fill();
        g.emoji('💖', 0, 0, r * 1.9 * (1 + 0.1 * pulse), { rot: Math.sin(it.age * 2.2 + it.ph) * 0.2 });
      }
      c.restore();
    }
    function drawFly(g, c, it) {
      const p = flyPos(it, FP);
      c.save();
      c.translate(p.x, p.y);
      c.rotate(it.fp * TAU);
      c.scale(p.k, p.k);
      drawTile(g, c, it, false);
      c.restore();
    }

    /* ---------------- 画：小熊猫（小熊猫 = red panda）+ 篮子 ---------------- */
    function limb(c, x0, y0, cx, cy, x1, y1, w) {
      c.beginPath(); c.moveTo(x0, y0); c.quadraticCurveTo(cx, cy, x1, y1);
      c.lineWidth = w + 5; c.strokeStyle = NAVY; c.stroke();
      c.lineWidth = w; c.strokeStyle = '#4A2616'; c.stroke();
    }
    function drawPanda(g, c, clk) {
      const s = S.s, y = S.groundY;
      // 开场仪式：3·2·1 一开始，小熊猫举着篮子从左边跑进场，站定后跟着拍子蹦
      let ex = 0, runIn = 0;
      if (g.state === 'intro' && clk < ENTRY) { const k = clk / ENTRY; ex = -(S.bx + 90 * s) * Math.pow(1 - k, 3); runIn = 1 - 0.7 * k; }
      const x = S.bx + ex;
      const run = Math.max(S.run, runIn), legA = (runIn ? Math.sin(clk * 19) : Math.sin(S.leg)) * 0.75 * run;
      let hop = S.hopT < 0.34 ? -Math.sin(S.hopT / 0.34 * Math.PI) * 12 : 0;
      if (g.state === 'intro') hop = runIn ? -Math.abs(Math.sin(clk * 19)) * 5 : -Math.abs(Math.sin(clk * Math.PI / 0.62)) * 9;   // 3·2·1 跟着拍子蹦
      else if (g.state === 'over' && S.won) hop = -Math.abs(Math.sin(clk * 6.5)) * 20;    // 过关：蹦蹦跳跳欢呼
      const bob = (run > 0.1 ? -Math.abs(Math.sin(S.leg)) * 4 * run : Math.sin(clk * 3) * 1.5) + hop;
      const face = S.faceT > 0 ? S.face : 'idle';
      // 影子
      c.fillStyle = 'rgba(20,40,60,.22)';
      c.beginPath(); c.ellipse(x, y + 3 * s, 50 * s * (1 - 0.06 * run), 9 * s, 0, 0, TAU); c.fill();
      c.save();
      c.translate(x, y);
      c.scale(s, s);
      c.rotate(S.tilt * 0.6 + runIn * 0.16);
      c.translate(0, bob);
      c.lineCap = 'round'; c.lineJoin = 'round';
      // 尾巴（一圈一圈的环纹，摇来摇去）
      const wag = Math.sin(clk * 3.4) * 0.28 - S.tilt * 1.4;
      c.save();
      c.translate(14, -30);
      c.rotate(-0.55 + wag);
      for (let i = 6; i >= 0; i--) {
        const u = i / 6, tx = 8 + u * 46, ty = -u * u * 30, rr = 11.5 - u * 2.2;
        c.beginPath(); c.arc(tx, ty, rr, 0, TAU);
        c.fillStyle = i % 2 ? '#7A3417' : '#D9652A'; c.fill();
        c.lineWidth = 2.6; c.strokeStyle = NAVY; c.stroke();
      }
      c.restore();
      // 腿
      c.save(); c.translate(-11, -24); c.rotate(legA); limb(c, 0, 0, 0, 12, 0, 22, 11); c.restore();
      c.save(); c.translate(11, -24); c.rotate(-legA); limb(c, 0, 0, 0, 12, 0, 22, 11); c.restore();
      // 身体
      c.beginPath(); c.ellipse(0, -40, 24, 23, 0, 0, TAU);
      c.fillStyle = '#E26D2E'; c.fill(); c.lineWidth = 3; c.strokeStyle = NAVY; c.stroke();
      c.beginPath(); c.ellipse(0, -33, 13, 12, 0, 0, TAU); c.fillStyle = '#7A3517'; c.fill();
      // 手臂举着篮子
      const bwL = 132 * (S.P ? S.P.basket : 1);
      const hx = bwL * 0.36;
      limb(c, -18, -54, -hx - 4, -70, -hx, -104, 10);
      limb(c, 18, -54, hx + 4, -70, hx, -104, 10);
      // 头
      for (const sx of [-1, 1]) {
        c.beginPath(); c.arc(sx * 23, -97, 11, 0, TAU);
        c.fillStyle = '#E26D2E'; c.fill(); c.lineWidth = 3; c.strokeStyle = NAVY; c.stroke();
        c.beginPath(); c.arc(sx * 23, -96, 6, 0, TAU); c.fillStyle = '#FFFFFF'; c.fill();
      }
      c.beginPath(); c.ellipse(0, -78, 31, 25, 0, 0, TAU);
      c.fillStyle = '#E26D2E'; c.fill(); c.lineWidth = 3; c.strokeStyle = NAVY; c.stroke();
      c.fillStyle = '#FFFFFF';
      c.beginPath(); c.ellipse(0, -69, 15, 10, 0, 0, TAU); c.fill();
      c.beginPath(); c.ellipse(-20, -71, 8, 7, 0, 0, TAU); c.ellipse(20, -71, 8, 7, 0, 0, TAU); c.fill();
      c.beginPath(); c.ellipse(-11, -90, 5, 3.4, 0, 0, TAU); c.ellipse(11, -90, 5, 3.4, 0, 0, TAU); c.fill();
      // 泪痕（小熊猫的特征）
      c.strokeStyle = '#8E3A14'; c.lineWidth = 3;
      c.beginPath(); c.moveTo(-12, -78); c.lineTo(-15, -67); c.moveTo(12, -78); c.lineTo(15, -67); c.stroke();
      // 眼睛
      const blink = (clk % 3.3) < 0.12;
      for (const sx of [-1, 1]) {
        const ex = sx * 11, ey = -81;
        if (face === 'happy') {
          c.lineWidth = 3.2; c.strokeStyle = NAVY;
          c.beginPath(); c.arc(ex, ey + 2, 5, Math.PI + 0.35, TAU - 0.35); c.stroke();
        } else if (face === 'dizzy') {
          c.lineWidth = 2.6; c.strokeStyle = NAVY;
          c.beginPath();
          for (let a = 0; a < 4 * Math.PI; a += 0.4) { const rr = 0.6 + a * 0.4, px = ex + Math.cos(a + clk * 8) * rr, py = ey + Math.sin(a + clk * 8) * rr; if (a === 0) c.moveTo(px, py); else c.lineTo(px, py); }
          c.stroke();
        } else if (blink) {
          c.lineWidth = 3; c.strokeStyle = NAVY; c.beginPath(); c.moveTo(ex - 4.5, ey); c.lineTo(ex + 4.5, ey); c.stroke();
        } else {
          c.fillStyle = NAVY; c.beginPath(); c.ellipse(ex, ey, 4.6, 5.4, 0, 0, TAU); c.fill();
          c.fillStyle = '#FFFFFF'; c.beginPath(); c.arc(ex + 1.6, ey - 2, 1.7, 0, TAU); c.fill();
        }
      }
      // 鼻子 + 嘴
      c.fillStyle = NAVY; c.beginPath(); c.ellipse(0, -73, 4.2, 3, 0, 0, TAU); c.fill();
      c.lineWidth = 2.4; c.strokeStyle = NAVY;
      if (face === 'happy') {
        c.beginPath(); c.moveTo(-6, -67); c.quadraticCurveTo(0, -57, 6, -67); c.closePath();
        c.fillStyle = '#FF6B7A'; c.fill(); c.stroke();
      } else if (face === 'dizzy') {
        c.beginPath(); c.moveTo(-6, -64); c.quadraticCurveTo(-3, -67, 0, -64); c.quadraticCurveTo(3, -61, 6, -64); c.stroke();
      } else {
        c.beginPath(); c.moveTo(-5, -67); c.quadraticCurveTo(-2.5, -64, 0, -67); c.quadraticCurveTo(2.5, -64, 5, -67); c.stroke();
      }
      c.fillStyle = 'rgba(255,110,130,.45)';
      c.beginPath(); c.ellipse(-22, -65, 5, 3, 0, 0, TAU); c.ellipse(22, -65, 5, 3, 0, 0, TAU); c.fill();
      // 被炸：脸上黑灰 + 头毛炸起
      if (S.soot > 0.02) {
        c.globalAlpha = Math.min(1, S.soot * 1.4);
        c.fillStyle = 'rgba(40,40,52,.55)';
        c.beginPath(); c.arc(-16, -86, 7, 0, TAU); c.arc(18, -76, 6, 0, TAU); c.arc(4, -95, 5, 0, TAU); c.arc(-24, -62, 4, 0, TAU); c.fill();
        c.strokeStyle = '#3B3B4F'; c.lineWidth = 2.4;
        c.beginPath(); for (let i = -2; i <= 2; i++) { c.moveTo(i * 7, -101); c.lineTo(i * 9 + Math.sin(clk * 20 + i) * 2, -111); } c.stroke();
        c.globalAlpha = 1;
      }
      // 篮子（弹性挤压）
      const q = S.sqT < 0.9 ? Math.exp(-S.sqT * 7) * Math.cos(S.sqT * 26) : 0;
      c.save();
      c.translate(0, -106);
      c.rotate(-S.tilt * 0.9 + Math.sin(clk * 2.2) * 0.02);
      c.scale(1 + 0.12 * q, 1 - 0.14 * q);
      drawBasket(c, bwL, clk);
      c.restore();
      // 头晕的小星星
      if (face === 'dizzy') {
        for (let i = 0; i < 3; i++) {
          const a = clk * 5 + i * TAU / 3;
          g.emoji('⭐', Math.cos(a) * 36, -84 + Math.sin(a) * 9, 13);
        }
      }
      c.restore();
    }
    function drawBasket(c, bw, clk) {
      // 原点 = 篮底中心；篮口在 y = -42
      const hTop = -42, bb = bw * 0.72;
      if (S.glowT > 0) {
        c.globalAlpha = Math.min(1, S.glowT * 2);
        c.fillStyle = glowGrad(c, 'bglow', 90, [0, 'rgba(255,240,140,.95)', 1, 'rgba(255,220,80,0)']);
        c.beginPath(); c.arc(0, hTop - 6, 90, 0, TAU); c.fill();
        c.globalAlpha = 1;
      }
      c.fillStyle = '#5E3515';
      c.beginPath(); c.ellipse(0, hTop, bw / 2 - 3, 9, 0, 0, TAU); c.fill();
      const body = () => {
        c.beginPath();
        c.moveTo(-bw / 2, hTop);
        c.lineTo(bw / 2, hTop);
        c.lineTo(bb / 2, -6);
        c.quadraticCurveTo(bb / 2, 0, bb / 2 - 8, 0);
        c.lineTo(-bb / 2 + 8, 0);
        c.quadraticCurveTo(-bb / 2, 0, -bb / 2, -6);
        c.closePath();
      };
      body();
      let gr = S.grad.basket;
      if (!gr) { gr = c.createLinearGradient(0, hTop, 0, 0); gr.addColorStop(0, '#F2B66C'); gr.addColorStop(1, '#BF7431'); S.grad.basket = gr; }
      c.fillStyle = gr; c.fill();
      c.save(); c.clip();
      c.strokeStyle = 'rgba(122,62,20,.75)'; c.lineWidth = 2.4;
      c.beginPath(); for (let yy = hTop + 11; yy < 0; yy += 10) { c.moveTo(-bw / 2, yy); c.lineTo(bw / 2, yy); } c.stroke();
      c.strokeStyle = 'rgba(255,232,180,.6)'; c.lineWidth = 3.2;
      c.beginPath();
      let row = 0;
      for (let yy = hTop + 2; yy < 0; yy += 10, row++) for (let xx = -bw / 2 + (row % 2 ? 6 : 0); xx < bw / 2; xx += 12) { c.moveTo(xx, yy + 2.5); c.lineTo(xx, yy + 7); }
      c.stroke();
      c.restore();
      body(); c.lineWidth = 3; c.strokeStyle = NAVY; c.stroke();
      // 篮口
      c.beginPath();
      const rx = -bw / 2 - 5, rw = bw + 10, ry = hTop - 6, rh = 11, rr = 5.5;
      c.moveTo(rx + rr, ry); c.arcTo(rx + rw, ry, rx + rw, ry + rh, rr); c.arcTo(rx + rw, ry + rh, rx, ry + rh, rr); c.arcTo(rx, ry + rh, rx, ry, rr); c.arcTo(rx, ry, rx + rw, ry, rr); c.closePath();
      c.fillStyle = '#D98B3E'; c.fill(); c.lineWidth = 3; c.strokeStyle = NAVY; c.stroke();
      c.strokeStyle = 'rgba(255,240,200,.75)'; c.lineWidth = 2;
      c.beginPath(); c.moveTo(rx + 8, ry + 3.5); c.lineTo(rx + rw - 8, ry + 3.5); c.stroke();
      // 手（抓在篮子两侧）
      c.fillStyle = '#4A2616'; c.strokeStyle = NAVY; c.lineWidth = 2.5;
      c.beginPath(); c.arc(-bw * 0.36, -2, 7, 0, TAU); c.fill(); c.stroke();
      c.beginPath(); c.arc(bw * 0.36, -2, 7, 0, TAU); c.fill(); c.stroke();
    }

    /* ---------------- 画：词语牌（喇叭 + 田字格） ---------------- */
    function drawBoard(g, c, clk) {
      const s = S.s, B = S.board;
      if (!B || !S.slots) return;
      // 喇叭按钮
      const sp = S.spk, bump = S.spkBump || 0;
      const pr = sp.r * (1 + 0.1 * bump) * (g.speaking ? 1 + 0.05 * Math.sin(clk * 12) : 1);
      c.fillStyle = NAVY; c.beginPath(); c.arc(sp.x, sp.y + 4 * s, pr, 0, TAU); c.fill();
      c.fillStyle = g.speaking ? '#FF8A3D' : '#3AA0FF'; c.beginPath(); c.arc(sp.x, sp.y, pr, 0, TAU); c.fill();
      c.lineWidth = 3 * s; c.strokeStyle = NAVY; c.stroke();
      c.fillStyle = 'rgba(255,255,255,.35)'; c.beginPath(); c.ellipse(sp.x, sp.y - pr * 0.45, pr * 0.6, pr * 0.28, 0, 0, TAU); c.fill();
      g.emoji('🔊', sp.x, sp.y + 1 * s, pr * 1.05);
      if (!S.heard && g.state === 'play') {   // 还没点过：一圈一圈的提示波纹
        const k = (clk * 0.9) % 1;
        c.globalAlpha = (1 - k) * 0.8; c.strokeStyle = '#FFFFFF'; c.lineWidth = 3 * s;
        c.beginPath(); c.arc(sp.x, sp.y, pr + k * 16 * s, 0, TAU); c.stroke(); c.globalAlpha = 1;
      }
      // 词语牌
      const cx = B.x + B.w / 2;
      const inK = clamp(S.boardIn == null ? 1 : S.boardIn, 0, 1.3);
      const bb = (S.boardBump || 0);
      c.save();
      c.translate(cx, B.y);
      c.rotate(Math.sin(clk * 1.3) * 0.012);
      const sc = inK * (1 + 0.05 * bb * Math.sin(bb * 9));
      c.scale(sc, sc);
      c.translate(-cx, -B.y);
      g.rrect(B.x, B.y + 5 * s, B.w, B.h, 16 * s, NAVY);
      const done = S.doneT >= 0;
      g.rrect(B.x, B.y, B.w, B.h, 16 * s, done ? '#FFF1B8' : '#FFF6DC', NAVY, 3.5 * s);
      for (let i = 0; i < S.slots.length; i++) {
        const sl = S.slots[i], half = sl.size / 2;
        const cur = !done && !S.reveal && i === S.idx && !S.fill[i];
        let ox = 0;
        if (cur && S.slotHint > 0) ox = Math.sin(clk * 40) * 3 * s * Math.min(1, S.slotHint);
        const x0 = sl.x - half + ox, y0 = sl.y - half;
        if (cur) {
          const pulse = 0.5 + 0.5 * Math.sin(clk * 5);
          g.rrect(x0 - 4 * s, y0 - 4 * s, sl.size + 8 * s, sl.size + 8 * s, 10 * s, 'rgba(255,200,40,' + (0.25 + 0.35 * pulse).toFixed(3) + ')');
        }
        g.rrect(x0, y0, sl.size, sl.size, 6 * s, done ? '#FFFBE6' : cur ? '#FFF7D1' : '#FFFFFF', cur ? '#FF9F1C' : '#E0463C', (cur ? 3.6 : 2.4) * s);
        c.save();
        c.setLineDash([4 * s, 4 * s]); c.strokeStyle = 'rgba(224,70,60,.4)'; c.lineWidth = 1.4 * s;
        c.beginPath(); c.moveTo(x0 + 3 * s, sl.y); c.lineTo(x0 + sl.size - 3 * s, sl.y); c.moveTo(sl.x + ox, y0 + 3 * s); c.lineTo(sl.x + ox, y0 + sl.size - 3 * s);
        c.moveTo(x0 + 4 * s, y0 + 4 * s); c.lineTo(x0 + sl.size - 4 * s, y0 + sl.size - 4 * s); c.moveTo(x0 + sl.size - 4 * s, y0 + 4 * s); c.lineTo(x0 + 4 * s, y0 + sl.size - 4 * s);
        c.globalAlpha = 0.55; c.stroke();
        c.restore();
        // 拼音
        // 6 关起纯听力不给拼音；接到的字 / 整词完成后再揭晓拼音（写对了顺便把音认一遍）
        const fixing = !S.fill[i] && S.fixT > 0 && i === S.fixK;
        if ((showPinyin() || S.fill[i] || done || S.reveal || fixing) && S.py[i]) g.text(S.py[i], sl.x, sl.pyY, { size: Math.round(17 * s), font: 'py', color: cur ? '#E0463C' : NAVY, maxW: sl.size + 6 * s });
        else g.text('?', sl.x, sl.pyY, { size: Math.round(17 * s), font: 'num', color: 'rgba(29,43,83,.45)' });
        if (S.fill[i]) {
          const k = S.pop[i] || 0;
          c.save(); c.translate(sl.x, sl.y); c.scale(k, k);
          if (done) {
            c.fillStyle = glowGrad(c, 'slotglow' + Math.round(sl.size), sl.size * 0.7, [0, 'rgba(255,230,120,.9)', 1, 'rgba(255,220,80,0)']);
            c.globalAlpha = 0.5 + 0.5 * Math.sin(clk * 8 + i);
            c.beginPath(); c.arc(0, 0, sl.size * 0.7, 0, TAU); c.fill(); c.globalAlpha = 1;
          }
          g.text(S.chars[i], 0, 1.5 * s, { size: Math.round(sl.size * 0.8), font: 'kai', color: done ? '#C0392B' : NAVY, weight: 700 });
          c.restore();
        } else if (S.reveal || fixing) {
          // 订正：浅红底 + 红色楷体（输了 = 补全整词；接错 = 当前格闪 1.8 秒）
          const a = S.reveal ? 1 : Math.min(1, S.fixT / 0.3, (1.8 - S.fixT) / 0.15);
          c.globalAlpha = clamp(a, 0, 1);
          g.rrect(sl.x - half + 3 * s, y0 + 3 * s, sl.size - 6 * s, sl.size - 6 * s, 5 * s, 'rgba(255,90,80,.16)');
          const k = S.reveal ? 1 : 1 + 0.06 * Math.sin(clk * 12);
          g.text(S.chars[i], sl.x + ox, sl.y + 1.5 * s, { size: Math.round(sl.size * 0.8 * k), font: 'kai', color: '#E0463C', weight: 700 });
          c.globalAlpha = 1;
        } else if (cur) {
          const a = 0.5 + 0.5 * Math.sin(clk * 5);
          g.text('?', sl.x, sl.y + 2 * s, { size: Math.round(sl.size * 0.5), font: 'num', color: 'rgba(255,159,28,' + (0.35 + 0.4 * a).toFixed(3) + ')' });
        }
      }
      c.restore();
    }
    /* 例句挖空条的位置（缓存）。试玩修订：原先画在字卡“后面”，可新字正好从它下面冒出来、降落伞盖住的恰恰是挖空处，
       句子根本读不全。现在条子画在字卡上面，显示期间新字改从条子下沿出发（下落时间不变），两不相挡。 */
    function hintBox(g) {
      if (!S.item || !S.item.s || !S.board) return null;
      const key = S.item.w + '|' + S.item.s + '|' + g.w + '|' + S.s + '|' + S.board.y + '|' + S.board.h;
      if (S.hb && S.hb.key === key) return S.hb;
      const s = S.s, B = S.board;
      const blank = '＿'.repeat(S.chars.length);
      const txt = String(S.item.s).split(S.item.w).join(blank);
      let fs = Math.round(20 * s);
      const maxW = Math.min(g.w - 40 * s, 560 * s);
      let lines = g.wrapText(txt, maxW, fs, 'kai');
      if (lines.length > 2) { fs = Math.round(17 * s); lines = g.wrapText(txt, maxW, fs, 'kai'); }
      let tw = 0; for (const ln of lines) tw = Math.max(tw, g.measure(ln, fs, 'kai'));
      const lh = fs * 1.35, bw = Math.min(g.w - 16, tw + 32 * s), bh = lines.length * lh + 16 * s;
      S.hb = { key, lines, fs, lh, x: g.w / 2 - bw / 2, y: B.y + B.h + 12 * s, w: bw, h: bh };
      return S.hb;
    }
    function spawnTop(g) {
      if (S.hintT > 0.4) { const hb = hintBox(g); if (hb) return Math.max(S.top, hb.y + hb.h - 4 * S.s); }
      return S.top;
    }
    function drawHint(g, c) {
      if (!(S.hintT > 0)) return;
      const hb = hintBox(g);
      if (!hb) return;
      const s = S.s, B = S.board;
      const a = Math.min(1, S.hintT / 0.3, (5 - S.hintT) / 0.2);
      const bx = hb.x, by = hb.y, bw = hb.w, bh = hb.h;
      c.globalAlpha = clamp(a, 0, 1) * 0.94;
      g.rrect(bx, by, bw, bh, 14 * s, 'rgba(29,43,83,.82)', 'rgba(255,255,255,.85)', 2.5 * s);
      c.fillStyle = 'rgba(29,43,83,.82)';
      c.beginPath(); c.moveTo(B.x + B.w / 2 - 10 * s, by + 1); c.lineTo(B.x + B.w / 2, by - 10 * s); c.lineTo(B.x + B.w / 2 + 10 * s, by + 1); c.closePath(); c.fill();
      for (let i = 0; i < hb.lines.length; i++) g.text(hb.lines[i], g.w / 2, by + 8 * s + hb.lh * (i + 0.5), { size: hb.fs, font: 'kai', color: '#FFFFFF', weight: 700, maxW: bw - 20 * s });
      c.globalAlpha = 1;
    }

    /* ---------------- 画：场景点缀 ---------------- */
    function drawGround(g, c, clk) {
      if (g.sky === 'day' && g.level >= 4) {   // 4–5 关：傍晚的暖色天光
        let gr = S.grad.dusk;
        if (!gr) { gr = c.createLinearGradient(0, 0, 0, g.h); gr.addColorStop(0, 'rgba(120,70,190,.30)'); gr.addColorStop(0.42, 'rgba(255,110,120,.24)'); gr.addColorStop(0.72, 'rgba(255,165,70,.34)'); gr.addColorStop(1, 'rgba(255,190,120,.10)'); S.grad.dusk = gr; }   // 晚霞：上紫下橙（原来整片橙红压在蓝天上发灰）
        c.fillStyle = gr; c.fillRect(-30, -30, g.w + 60, g.h + 60);
      }
      if (g.sky !== 'night') return;
      const s = S.s, y0 = S.sandY, w = g.w, h = g.h;
      let gr = S.grad.pier;
      if (!gr) { gr = c.createLinearGradient(0, y0, 0, h); gr.addColorStop(0, '#7A5033'); gr.addColorStop(1, '#4C301D'); S.grad.pier = gr; }
      c.fillStyle = gr; c.fillRect(-30, y0, w + 60, h - y0 + 30);
      c.fillStyle = '#A0714A'; c.fillRect(-30, y0, w + 60, 5 * s);
      c.strokeStyle = 'rgba(30,16,8,.45)'; c.lineWidth = 2;
      c.beginPath();
      for (let yy = y0 + 14 * s; yy < h; yy += 13 * s) { c.moveTo(-30, yy); c.lineTo(w + 30, yy); }
      c.stroke();
      // 码头的灯柱
      const gap = Math.max(150, 170 * s);
      for (let x = gap / 2; x < w; x += gap) {
        c.strokeStyle = '#2E1C10'; c.lineWidth = 5 * s;
        c.beginPath(); c.moveTo(x, y0 + 2); c.lineTo(x, y0 - 48 * s); c.stroke();
        const fl = 0.8 + 0.2 * Math.sin(clk * 7 + x);
        c.save(); c.translate(x, y0 - 54 * s);
        c.fillStyle = glowGrad(c, 'lamp', 34 * s, [0, 'rgba(255,200,110,.75)', 1, 'rgba(255,170,60,0)']);
        c.globalAlpha = fl; c.beginPath(); c.arc(0, 0, 34 * s, 0, TAU); c.fill(); c.globalAlpha = 1;
        c.fillStyle = '#E8452B'; c.beginPath(); c.ellipse(0, 0, 9 * s, 11 * s, 0, 0, TAU); c.fill();
        c.strokeStyle = NAVY; c.lineWidth = 2 * s; c.stroke();
        c.fillStyle = '#FFD66B'; c.fillRect(-6 * s, -12 * s, 12 * s, 3 * s); c.fillRect(-6 * s, 9 * s, 12 * s, 3 * s);
        c.restore();
      }
    }
    function drawWind(g, c, cdt) {
      if (!S.wind) return;
      const s = S.s, w = g.w, top = S.top, span = S.rimY - top;
      const a = Math.min(0.55, Math.abs(S.wind) / (70 * s));
      const dir = S.wind > 0 ? 1 : -1;
      c.strokeStyle = 'rgba(255,255,255,' + a.toFixed(3) + ')'; c.lineWidth = 2.2 * s; c.lineCap = 'round';
      c.beginPath();
      for (const st of S.streaks) {
        st.x += S.wind * cdt * 7 / w;
        if (st.x > 1.15) st.x -= 1.3; else if (st.x < -0.15) st.x += 1.3;
        const x = st.x * w, y = top + st.y * span, L = st.len * s;
        c.moveTo(x, y); c.quadraticCurveTo(x - dir * L * 0.5, y - 5 * s, x - dir * L, y + Math.sin(st.ph) * 3 * s);
      }
      c.stroke();
      for (const lf of S.leaves) {
        lf.x += S.wind * cdt * 5 / w; lf.r += cdt * 4 * dir;
        if (lf.x > 1.1) { lf.x -= 1.2; lf.y = Math.random(); } else if (lf.x < -0.1) { lf.x += 1.2; lf.y = Math.random(); }
        g.emoji('🍃', lf.x * w, top + lf.y * span + Math.sin(lf.r) * 10 * s, 22 * s, { rot: lf.r, alpha: Math.min(1, a * 2) });
      }
      // 风向旗（鲤鱼旗）
      const fx = g.w - 34 * s, fy = S.top + 26 * s;
      c.strokeStyle = NAVY; c.lineWidth = 3 * s;
      c.beginPath(); c.moveTo(fx, fy - 20 * s); c.lineTo(fx, fy + 30 * s); c.stroke();
      g.emoji('🎏', fx + dir * 18 * s, fy - 8 * s + Math.sin(S.clk * 6) * 2 * s, 34 * s, { flip: dir < 0, rot: Math.sin(S.clk * 5) * 0.08 });
    }
    /* 关卡提示：新花样出现的那一关，3·2·1 下面的说明换成这一关的新规则（引擎每次倒计时都会重读 spec.intro）
       ——第一次遇到炸弹 / 爱心 / 没拼音不会懵。试过画在画布上，电脑屏上会和倒计时大字叠在一起，改用引擎的说明框。 */
    const INTRO = '听词语，按顺序接住它的字！';
    function levelTip(g) {
      const lv = g.level;
      if (lv === 3) return '💣 别接！⭐ 接住加分！';
      if (lv === 4) return '新花样：接住 💖 能回血！';
      if (lv === 6) return showPinyin() ? '🌙 天黑了，还起风了！' : '🌙 拼音藏起来了，用耳朵听！';
      if (lv === 8) return '🍃 字会左右飘，看准再接！';
      if (lv === 2 || lv === 5 || lv === 7 || lv >= 9) return '⚡ 字掉得更快啦，按顺序接！';
      return '';
    }
    function drawFinger(g, c, clk) {
      if (S.moved || !(g.state === 'play' || g.state === 'intro')) return;
      const s = S.s;
      const x = S.bx + Math.sin(clk * 2.4) * 80 * s, y = S.groundY - 18 * s;
      const phone = g.w < 640;
      g.text(phone ? '← 按住拖动小熊猫 →' : '← → 键 或 拖动小熊猫', S.bx, S.rimY - 44 * s, { size: Math.round(19 * s), font: 'round', color: '#FFFFFF', stroke: NAVY, strokeW: 4 * s, maxW: g.w - 30 });
      c.globalAlpha = 0.6 + 0.4 * Math.abs(Math.sin(clk * 2.4));
      g.emoji('👆', x, y, 46 * s, { rot: -0.2 });
      c.globalAlpha = 1;
    }

    /* ---------------- spec ---------------- */
    const spec = {
      maxLevel: 10, lives: 3, rounds: 6, music: 'bright', sky: 'day', name: '天降汉字', icon: '🧺',
      intro: '听词语，按顺序接住它的字！',   // 每关 init 会按 levelTip 换成这一关的新规则
      controls: '拖动小熊猫 / ← → 移动 / 空格重听',
      init(g) {
        S.P = params(g.level);
        g.sky = g.level >= 6 ? 'night' : 'day';
        spec.intro = levelTip(g) || INTRO;
        let list = (g.items('words', 6) || []).filter((it) => it && typeof it.w === 'string' && Array.from(it.w).filter(isHan).length >= 1 && Array.from(it.w).filter(isHan).length <= 6);
        if (g.level <= 2) list = list.slice().sort((a, b) => Array.from(a.w).length - Array.from(b.w).length);
        S.list = list;
        g.rounds = Math.max(1, Math.min(g.rounds || 6, list.length || 1));
        S.items = [];
        S.started = false; S.busy = true;
        S.bx = null; S.tx = null; S.bv = 0; S.tilt = 0; S.leg = 0; S.run = 0; S.drag = false;
        S.face = 'idle'; S.faceT = 0; S.soot = 0; S.sqT = 9; S.hopT = 9; S.glowT = 0; S.nextT = 0.2;
        S.wind = 0; S.windPh = Math.random() * 10;
        S.moved = g.level > 2; S.heard = false; S.orderT = 0; S.boardBump = 0; S.spkBump = 0;
        S.clk = 0; S.lastMs = 0; S.overInit = false; S.won = false; S.dustT = 0; S.reveal = false; S.fixT = 0; S.fixK = -1;
        S.chars = list.length ? Array.from(list[0].w).filter(isHan) : ['字'];
        layout(g);
        if (list.length) startWord(g, 0);
        else { S.item = null; S.chars = []; S.fill = []; S.slots = []; }
        try { W.__hwCatcher = { g, S, spec }; } catch (e) { /* ignore */ }
      },
      play(g) { begin(g); if (!S.list.length) g.win(); },
      update(g, dt) {
        if (!S.started) begin(g);
        if (!S.item) return;
        const s = S.s, P = S.P;
        moveBasket(g, dt);
        if (S.run > 0.55) {   // 跑起来脚下扬沙（手感：一看就知道在“跑”）
          S.dustT -= dt;
          if (S.dustT <= 0) { S.dustT = 0.09; g.burst(S.bx - Math.sign(S.bv) * 24 * s, S.groundY - 4 * s, { kind: 'dot', color: g.sky === 'night' ? '#B08A66' : '#F3D9A0', n: 2 }); }
        }
        if (P.wind) {
          S.windPh += dt;
          S.wind = P.wind * s * Math.sin(S.windPh * 0.42) * (0.65 + 0.35 * Math.sin(S.windPh * 1.3));
        }
        if (S.orderT > 0) S.orderT -= dt;
        if (S.slotHint > 0) S.slotHint = Math.max(0, S.slotHint - dt);
        if (S.hintT > 0) S.hintT = Math.max(0, S.hintT - dt);
        if (S.fixT > 0) S.fixT = Math.max(0, S.fixT - dt);
        if (S.doneT >= 0) S.doneT += dt;
        // 出字：要接的字始终保证天上有一个
        if (!S.busy) {
          const need = S.chars[S.idx], nx = S.chars[S.idx + 1];
          let needIn = 0, nxIn = 0, falling = 0, needLow = 0;
          for (const it of S.items) {
            if (it.mode !== 'fall' || it.passed) continue;
            falling++;
            if (it.kind !== 'ch') continue;
            if (it.ch === need) { needIn++; needLow = Math.max(needLow, (it.y - S.top) / Math.max(1, S.rimY - S.top)); }
            else if (it.ch === nx) nxIn++;
          }
          // 流水线：要接的字落到三分之一，就让下一个字也出发（接完一个马上有下一个可接）
          if (nx && nx !== need && needIn > 0 && nxIn === 0 && needLow > (S.easy ? 0.5 : 0.3)) {
            S.nextT -= dt;
            if (S.nextT <= 0) { spawn(g, 'ch', nx); S.nextT = 0.9; falling++; }
          } else S.nextT = Math.min(S.nextT == null ? 0.2 : S.nextT, 0.2);
          if (needIn === 0) {
            if (!S.needWait) { S.needWait = true; S.needT = Math.min(S.needT, 0.55); }
            S.needT -= dt;
            if (S.needT <= 0) { spawn(g, 'ch', need); S.needWait = false; S.needT = 0.55; falling++; }
          } else S.needWait = false;
          S.spawnT -= dt;
          if (S.spawnT <= 0) {
            const cap = S.easy ? 3 : P.maxOn;
            if (falling < cap) spawnRandom(g);
            S.spawnT = P.gap * rnd(0.75, 1.25) * (S.easy ? 1.5 : 1);
          }
        }
        // 物件
        const catchY = S.rimY - S.tileR * 0.2;
        const half = S.bw / 2;
        for (let i = 0; i < S.items.length; i++) {
          const it = S.items[i];
          if (it.mode === 'fall') {
            it.age += dt;
            const y0 = it.y;
            it.y += it.vy * dt;
            if (S.wind) it.bx += S.wind * dt * (it.kind === 'ch' ? (it.ride === 'chute' ? 1 : 0.7) : 0.45);
            const m = S.tileR * 1.1;
            if (it.bx < S.bandL + m) it.bx = S.bandL + m; else if (it.bx > S.bandR - m) it.bx = S.bandR - m;
            // 摇摆 / 8 关起的左右飘之后也夹在带内：被风吹到边上的字仍然接得到（否则会“怎么也够不着”）
            it.x = clamp(it.bx + swayX(it), S.bandL + m, S.bandR - m);
            if (it.kind === 'bomb') {
              it.rot += dt * 1.8 * it.spin;
              it.t += dt;
              if (it.t > 0.07) { it.t = 0; const a = it.rot; g.burst(it.x + Math.cos(a) * S.tileR * 0.62 + Math.sin(a) * S.tileR * 0.7, it.y + Math.sin(a) * S.tileR * 0.62 - Math.cos(a) * S.tileR * 0.7, { kind: 'spark', n: 1, color: '#FFD23F' }); }
            }
            if (!it.passed) {
              if (it.y >= catchY) {
                const dx = it.x - S.bx;
                if (Math.abs(dx) <= half * 0.94) { caught(g, it); if (g.state !== 'play') return; continue; }
                if (y0 < catchY && Math.abs(dx) <= half + S.tileR * 0.7) { tumble(g, it, 0); g.sfx('jump'); continue; }
                if (it.y > catchY + S.tileR * 0.9) it.passed = true;
              }
            } else if (it.y >= S.groundY - S.tileR * 0.5) land(g, it);
          } else if (it.mode === 'tumble' || it.mode === 'land' || it.mode === 'pop') {
            stepLoose(g, it, dt);
          } else if (it.mode === 'fly') {
            if (Math.random() < 0.6) { flyPos(it, FP); g.burst(FP.x, FP.y, { kind: 'spark', n: 1, color: '#FFF6B0' }); }
          }
        }
        let j = 0;
        for (let i = 0; i < S.items.length; i++) if (S.items[i].mode !== 'dead') S.items[j++] = S.items[i];
        S.items.length = j;
      },
      draw(g, c) {
        const t = nowMs();
        const cdt = S.lastMs ? clamp((t - S.lastMs) / 1000, 0, 0.05) : 0;
        S.lastMs = t;
        if (g.state === 'play' || g.state === 'intro' || g.state === 'over') S.clk += cdt;
        const clk = S.clk;
        if (S.faceT > 0) S.faceT = Math.max(0, S.faceT - cdt);
        if (S.soot > 0) S.soot = Math.max(0, S.soot - cdt * 0.3);
        if (S.sqT < 9) S.sqT += cdt;
        if (S.hopT < 9) S.hopT += cdt;
        if (S.glowT > 0) S.glowT = Math.max(0, S.glowT - cdt);
        if (S.boardBump > 0) S.boardBump = Math.max(0, S.boardBump - cdt * 2.2);
        if (S.spkBump > 0) S.spkBump = Math.max(0, S.spkBump - cdt * 3);
        if (!S.slots) return;
        if (g.state === 'over') overDrift(g, cdt);
        drawGround(g, c, clk);
        drawWind(g, c, cdt);
        for (const it of S.items) {
          if (it.mode !== 'fall' && it.mode !== 'land') continue;
          if (it.kind === 'ch') drawChar(g, c, it, clk); else drawThing(g, c, it, clk);
        }
        drawPanda(g, c, clk);
        for (const it of S.items) {
          if (it.mode !== 'tumble' && it.mode !== 'pop') continue;
          if (it.kind !== 'ch') { if (it.mode === 'pop') drawThing(g, c, it, clk); continue; }
          if (it.mode === 'pop') { drawChar(g, c, it, clk); continue; }
          c.save();
          c.globalAlpha = it.t > 0.9 ? Math.max(0, 1 - (it.t - 0.9) / 0.6) : 1;
          c.translate(it.x, it.y); c.rotate(it.rot || 0);
          drawTile(g, c, it, false);
          c.restore();
        }
        drawHint(g, c);   // 例句挖空条盖在字卡上面（显示期间新字从条子下沿出发，见 spawnTop）
        drawBoard(g, c, clk);
        for (const it of S.items) if (it.mode === 'fly') drawFly(g, c, it);
        drawFinger(g, c, clk);
      },
      down(g, p) {
        if (S.spk && g.hitCircle(p, S.spk.x, S.spk.y, S.spk.r + 10)) { S.heard = true; replay(g); return; }
        S.drag = true;
        setTarget(p);
      },
      move(g, p) {
        if (p.down || p.type === 'mouse') setTarget(p);
      },
      up(g) { S.drag = false; },
      key(g, k) {
        if (k === 'space' || k === 'enter') { S.heard = true; replay(g); }
        else if (k === 'left' || k === 'right') S.moved = true;
      },
      resize(g) { layout(g); },
      end() { try { if (W.__hwCatcher && W.__hwCatcher.S === S) delete W.__hwCatcher; } catch (e) { /* ignore */ } }
    };
    return spec;
  }

  HW.register({
    id: 'catcher', skill: 'listen', kind: 'arcade', name: '天降汉字', blurb: '听词语，按顺序接住掉下来的字', icon: '🧺',
    needs: ['tts'], cols: ['words'], data: ['words'],
    start(ctx) {
      if (!HW.arcade || typeof HW.arcade.run !== 'function') {
        try { ctx.el.textContent = '游戏引擎没有加载，先玩别的游戏吧。'; } catch (e) { /* ignore */ }
        return undefined;
      }
      return HW.arcade.run(ctx, makeSpec(ctx));
    }
  });
})();
