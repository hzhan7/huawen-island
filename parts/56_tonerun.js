/* =====================================================================
 * 华文小岛 3.0 · 🐲 声调跑酷（parts/56_tonerun.js）  skill: listen · 题库栏目: words（+ chars）
 * 契约：SPEC_V3.md（五关）+ SPEC_ARCADE.md §3；引擎：parts/15_arcade.js（HW.arcade.run）
 * 设计依据：research/GAME_SHORTLIST.md ⑤“声调铺路跑酷”
 *
 * 玩法：小龙沿着海上栈桥自动往前跑，栈桥断开的缺口上方飘着一个字（整个词显示在顶部横幅里，会自动朗读）。
 *   孩子在屏幕上任意位置“画出”这个字的声调，铺出一段桥：
 *     一声 画横 ˉ → 平桥；二声 画 ↗ ˊ → 上坡跳台（小龙飞起来）；三声 画 ∨ ˇ → 凹槽吊桥（荡下去再弹起）；
 *     四声 画 ↘ ˋ → 弹簧滑梯（加速冲下去）。
 *   铺对：桥变金色、小龙顺着桥形跑过去（过桥那一刻 g.right，带 hz = 这个字）。
 *   铺错：桥按孩子画的形状铺出来，但有裂缝——小龙一踩就塌、掉进海里（g.wrong 扣心），海豚把它顶上对岸，
 *         卡片上亮出正确读音，这个字过几个词后“再来一次”（排在已经铺出来的词后面）。
 *   还没画就跑到缺口：小龙在崖边刹车晃悠等你（g.miss：只断连击，不扣心，不记错题）。
 *   画出来的形状认不出（太小 / 太弯 / 角度含糊 / ∧ 形）→ 提示“再画一次”，什么都不记。
 *   点一下屏幕 / 空格 / 横幅上的喇叭 = 再听一遍。电脑可按 1 2 3 4；底部可切换“按钮模式”（无障碍兜底）。
 *
 * 五关（SPEC_V3 §1）：
 *   ① 换皮：所有缺口长得一样，屏幕上没有任何答案线索（桥的形状由孩子画出来）；把字换成色块就无从下笔。
 *   ② 乱按：随手一划 3/4 概率是错的 → 桥塌扣心（P3–P6 三颗心 / P2 五颗心），乱按约 15 秒就输（评审实测 P4）。
 *   ③ 决策点：唯一的操作就是“画一个声调 / 按一个数字”，每一次都是对一个字的声调判断。
 *   ④ 后果：桥塌、落水、海豚救援、这个字回炉重考、连击清零；不是弹 ✗。
 *   ⑤ 错题本：只有“形状认得出、但声调错了”才 g.wrong（note 写明字、正确读音、画成了几声）；
 *      来不及画 → g.miss；形状认不出 → 不计；hz = 本次这个字。错题重练只考记下来的那个字（词里其余的字铺成石板）。
 *      手势只看形状不看方向（按笔顺从上往下画“/”也是二声）；竖直线、∧、绕圈、太小都判“再画一次”，绝不猜。
 *
 * 数据：words 按字拆音节（整词做上下文，多音字按词的注音）+ chars 单字。不考的音节（显示成已铺好的石板，读音直接给出）：
 *   轻声、“一 / 不”（课本标变调）、三声连读的前字、“三声 + 轻声”的前字（口语会变调，听和标对不上）。
 *   单字题再去掉多音字（内置常用多音字表 + 全题库里出现过两种读音的字）。P3 起词里的多音字盖“多音字”小印章。
 * P2 更友好：卡片与横幅显示不带调拼音、5 颗心、更慢、接近没铺的缺口自动慢动作、每个词都自动朗读、
 *   底部声调图例一直在演示怎么画、粉色小龙、前几关以单字和两字词为主。
 * P4 起：只显示汉字（画完才亮出拼音），更快，第 6 关起四字词语连铺；P5–P6 第 6 关起不再自动朗读（点一下 / 空格可以听）。
 * 关卡：1–3 白天 → 4–6 黄昏 → 7–10 夜晚（灯笼亮起）；速度、每关字数、词长逐关上升。
 *
 * ───────── 代码来源与许可 ─────────
 * 跑酷手感（重力、起跳初速随速度增加、每秒约 1% 的匀加速、按速度拉开间距再随机放宽、
 * 距离表每 100 米闪烁三次并响提示音、云的视差速度 0.2、跑步 12 帧/秒、待机眨眼）的参数与算法移植自
 *   wayou/t-rex-runner  https://github.com/wayou/t-rex-runner  （index.js，BSD-3-Clause）
 * 下面照录两份版权声明与许可文本（BSD 要求保留；全文与来源链接另见仓库根目录 THIRD_PARTY_NOTICES.md）。
 *
 * 【A】原 index.js 文件头（照录）：
 *   Copyright (c) 2014 The Chromium Authors. All rights reserved.
 *   Use of this source code is governed by a BSD-style license that can be
 *   found in the LICENSE file.
 *   extract from chromium source code by @liuwayong
 *   其中“the LICENSE file”是 Chromium 的 LICENSE（BSD 3-Clause，2014 年版本，
 *   https://github.com/chromium/chromium/blob/40.0.2214.115/LICENSE ，照录）：
 *   Copyright 2014 The Chromium Authors. All rights reserved.
 *   Redistribution and use in source and binary forms, with or without modification, are permitted provided
 *   that the following conditions are met:
 *      * Redistributions of source code must retain the above copyright notice, this list of conditions and
 *        the following disclaimer.
 *      * Redistributions in binary form must reproduce the above copyright notice, this list of conditions
 *        and the following disclaimer in the documentation and/or other materials provided with the
 *        distribution.
 *      * Neither the name of Google Inc. nor the names of its contributors may be used to endorse or promote
 *        products derived from this software without specific prior written permission.
 *   THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS "AS IS" AND ANY EXPRESS OR IMPLIED
 *   WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A
 *   PARTICULAR PURPOSE ARE DISCLAIMED. IN NO EVENT SHALL THE COPYRIGHT OWNER OR CONTRIBUTORS BE LIABLE FOR ANY
 *   DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR CONSEQUENTIAL DAMAGES (INCLUDING, BUT NOT LIMITED TO,
 *   PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES; LOSS OF USE, DATA, OR PROFITS; OR BUSINESS INTERRUPTION)
 *   HOWEVER CAUSED AND ON ANY THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY, OR TORT (INCLUDING
 *   NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE OF THIS SOFTWARE, EVEN IF ADVISED OF THE
 *   POSSIBILITY OF SUCH DAMAGE.
 *
 * 【B】wayou/t-rex-runner 仓库 LICENSE（BSD 3-Clause License，照录）：
 *   Copyright (c) 2022, 牛さん
 *   All rights reserved.
 *   Redistribution and use in source and binary forms, with or without modification, are permitted provided
 *   that the following conditions are met:
 *   1. Redistributions of source code must retain the above copyright notice, this list of conditions and
 *      the following disclaimer.
 *   2. Redistributions in binary form must reproduce the above copyright notice, this list of conditions and
 *      the following disclaimer in the documentation and/or other materials provided with the distribution.
 *   3. Neither the name of the copyright holder nor the names of its contributors may be used to endorse or
 *      promote products derived from this software without specific prior written permission.
 *   THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS "AS IS" AND ANY EXPRESS OR IMPLIED
 *   WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A
 *   PARTICULAR PURPOSE ARE DISCLAIMED. IN NO EVENT SHALL THE COPYRIGHT HOLDER OR CONTRIBUTORS BE LIABLE FOR ANY
 *   DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR CONSEQUENTIAL DAMAGES (INCLUDING, BUT NOT LIMITED TO,
 *   PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES; LOSS OF USE, DATA, OR PROFITS; OR BUSINESS INTERRUPTION)
 *   HOWEVER CAUSED AND ON ANY THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY, OR TORT (INCLUDING
 *   NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE OF THIS SOFTWARE, EVEN IF ADVISED OF THE
 *   POSSIBILITY OF SUCH DAMAGE.
 * 原仓库的精灵图与 base64 音效一律没用：画面全部 Canvas 自绘，声音 = 引擎合成音效 + 本文件的 WebAudio“声调哨音”。
 * ===================================================================== */
(function () {
  'use strict';
  const W = window;
  const HW = W.HW;
  if (!HW || typeof HW.register !== 'function') return;

  const TAU = Math.PI * 2, NAVY = '#1d2b53';
  const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
  const lerp = (a, b, t) => a + (b - a) * t;
  const nowMs = () => (W.performance && performance.now ? performance.now() : Date.now());
  const isHan = (ch) => /[㐀-鿿豈-﫿]/.test(ch);
  function hash(n) { let x = (n | 0) * 374761393 + 668265263; x = (x ^ (x >>> 13)) * 1274126177; return ((x ^ (x >>> 16)) >>> 0) / 4294967296; }

  /* ---------- 移植自 t-rex-runner 的手感参数（原作以 60fps 的“像素/帧”为单位，这里换成“单位/秒”） ---------- */
  const TREX = {
    GRAVITY: 0.6 * 3600,        // Trex.config.GRAVITY = 0.6 px/帧²
    JUMP_V: 10 * 60,            // Trex.config.INIITAL_JUMP_VELOCITY = -10 px/帧（startJump 里再减 speed/10）
    ACCEL: 0.001 / 6 * 60,      // Runner.config.ACCELERATION / SPEED：每秒提速约 1%
    DIST_COEF: 0.025,           // DistanceMeter.config.COEFFICIENT：像素 → 米
    ACH_DIST: 100,              // ACHIEVEMENT_DISTANCE：每 100 米
    FLASH_S: 0.25, FLASH_N: 3,  // FLASH_DURATION 250ms × FLASH_ITERATIONS 3
    CLOUD_SPEED: 0.2,           // BG_CLOUD_SPEED：云的视差
    MAX_GAP_COEF: 1.5,          // Obstacle.MAX_GAP_COEFFICIENT：间距在最小值上随机放宽（这里只取其中 30%，孩子要可预期）
    RUN_FPS: 12,                // Trex.animFrames.RUNNING：1000/12 ms 一帧
    BLINK_S: 1 / 3              // WAITING：1000/3 ms 眨一次
  };
  /* ---------- 世界尺寸（单位；画的时候乘 L.k） ---------- */
  const GW = 118;          // 缺口宽
  const EDGE = 14;         // 刹车停在缺口前多远
  const WATER_U = 50;      // 海面在栈桥面下方多远
  const CARD_U = 150;      // 字卡悬在栈桥面上方多高
  const H2 = 44, D3 = 36, H4 = 46;   // 二声跳台高、三声凹槽深、四声滑梯高
  const ACC = 560, DEC = 900;        // 起步加速度 / 刹车减速度（单位/秒²）

  /* ---------- 声调 ---------- */
  const MARK = ['', 'ˉ', 'ˊ', 'ˇ', 'ˋ'];
  const TNAME = ['', '一声', '二声', '三声', '四声'];
  const TCOL = ['#98A2B6', '#F0484E', '#F7931E', '#1FAE5B', '#2F7FF0'];
  const TLIGHT = ['#E9ECF2', '#FFE1E1', '#FFEBCF', '#D6F5E3', '#DCE9FF'];
  const TDARK = ['#5C667A', '#B3262B', '#B8610A', '#127A3D', '#1A55B0'];
  const SHAPE = [null, [[-1, 0], [1, 0]], [[-0.85, 0.72], [0.85, -0.72]], [[-0.92, -0.66], [0, 0.72], [0.92, -0.66]], [[-0.85, -0.72], [0.85, 0.72]]];
  const TONE_OF = { '̄': 1, '́': 2, '̌': 3, '̀': 4 };
  function toneOf(sy) { const n = String(sy || '').normalize('NFD'); for (let i = 0; i < n.length; i++) { const t = TONE_OF[n[i]]; if (t) return t; } return 5; }
  function bareOf(sy) { return String(sy || '').normalize('NFD').replace(/[̄́̌̀]/g, '').normalize('NFC'); }
  const SANDHI = '一不';
  /* 常用多音字（单字题一律不出；词里的照词的注音考）。宁可多列，不可漏列。 */
  const POLY = new Set(Array.from('长乐为行重还好了着得地的都发教数少只种中看空相便朝调分背传更系结冲处当倒差称藏曾奇强省似散兴应转正觉角量难假间将几要卷占薄塞血率片圈属和会干场哪给恶扇模露盛缝折担弹钻宿尽降泊仔劲冠济解禁横划晃夹奔创答度号华累蒙宁铺曲丧扫色刹舍石识说挑吐鲜削压咽与晕载择扎涨作参供合漂屏切亲任什提同吓乘单大没喝撒旋挣否哄堡瓦'));
  let DPOLY = null;
  /* 全题库（所有年级）里出现过两种带调读音的字 → 也算多音字 */
  function dataPoly() {
    if (DPOLY) return DPOLY;
    const rd = Object.create(null);
    const add = (text, py) => {
      if (typeof text !== 'string' || typeof py !== 'string') return;
      const chs = Array.from(text).filter(isHan), sy = py.trim().split(/\s+/).filter(Boolean);
      if (!chs.length || chs.length !== sy.length) return;
      chs.forEach((ch, i) => {
        const s = sy[i].toLowerCase();
        if (toneOf(s) === 5 || SANDHI.indexOf(ch) >= 0) return;
        (rd[ch] || (rd[ch] = new Set())).add(s);
      });
    };
    try {
      const all = W.HW_DATA && typeof W.HW_DATA === 'object' ? W.HW_DATA : {};
      Object.keys(all).forEach((gr) => {
        const G = all[gr] || {};
        const arr = (k) => (Array.isArray(G[k]) ? G[k] : []);
        arr('words').forEach((x) => x && add(x.w, x.py));
        arr('chars').forEach((x) => x && add(x.c, x.py));
        arr('pick').forEach((x) => x && add(x.say, x.py));
        arr('build').forEach((x) => x && add(x.ans, x.py));
        arr('twisters').forEach((x) => x && add(x.text, x.py));
        arr('readaloud').forEach((x) => x && Array.isArray(x.hard) && x.hard.forEach((h) => h && add(h.w, h.py)));
      });
    } catch (e) { /* ignore */ }
    DPOLY = new Set();
    for (const ch in rd) if (rd[ch].size > 1) DPOLY.add(ch);
    return DPOLY;
  }
  const isPoly = (ch) => POLY.has(ch) || dataPoly().has(ch);

  /* 题目 → “单元”（一个词或一个字）：逐字的读音、要不要考 */
  function unitOf(it, col) {
    if (!it || typeof it !== 'object') return null;
    const text = String((col === 'words' ? it.w : it.c) || '').trim();
    const py = String(it.py || '').trim();
    const chs = Array.from(text), sy = py ? py.split(/\s+/) : [];
    if (!chs.length || chs.length > 4 || chs.length !== sy.length || !chs.every(isHan)) return null;
    if (sy.some((s) => !/^[a-z̀-ͯ]+$/.test(s.toLowerCase().normalize('NFD')))) return null;
    const tones = sy.map(toneOf);
    const syl = chs.map((ch, i) => {
      const t = tones[i];
      let ask = t >= 1 && t <= 4 && SANDHI.indexOf(ch) < 0;
      if (ask && t === 3 && i + 1 < chs.length && (tones[i + 1] === 3 || tones[i + 1] === 5)) ask = false;
      // 叠字：后一个字不考（常读轻声或变调，词典各版注音不一：星星、干干净净）；ABB 的两个 B 都不考（金灿灿、沉甸甸、绿油油）
      if (ask && i > 0 && chs[i - 1] === ch) ask = false;
      if (ask && chs.length === 3 && i === 1 && chs[2] === ch) ask = false;
      if (ask && chs.length === 1 && isPoly(ch)) ask = false;
      return { ch, py: sy[i], bare: bareOf(sy[i]), tone: t, ask, poly: chs.length > 1 && isPoly(ch) };
    });
    const askN = syl.filter((s) => s.ask).length;
    if (!askN) return null;
    return { it, col, text, syl, askN, retry: false };
  }

  /* 手势识别：只看形状（不管从哪头画起）；含糊的一律“再画一次”，绝不猜 */
  function classify(pts) {
    const n = pts.length;
    if (n < 2) return { tap: true };
    let len = 0, minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity, iLo = 0, iHi = 0;
    const cum = [0];
    for (let i = 0; i < n; i++) {
      const p = pts[i];
      if (i) { len += Math.hypot(p.x - pts[i - 1].x, p.y - pts[i - 1].y); cum.push(len); }
      if (p.x < minX) minX = p.x; if (p.x > maxX) maxX = p.x;
      if (p.y < minY) { minY = p.y; iHi = i; }
      if (p.y > maxY) { maxY = p.y; iLo = i; }
    }
    const dur = pts[n - 1].t - pts[0].t;
    const w = maxX - minX, h = maxY - minY, size = Math.max(w, h);
    if (len < 16 && dur < 450) return { tap: true };
    if (size < 26) return { bad: 'small' };
    const s = pts[0], e = pts[n - 1];
    const fLo = len ? cum[iLo] / len : 0, fHi = len ? cum[iHi] / len : 0;
    const dropL = maxY - s.y, dropR = maxY - e.y;       // 最低点比起点 / 终点低多少
    const riseL = s.y - minY, riseR = e.y - minY;       // 最高点比起点 / 终点高多少
    // 三声：∨ / U / ✓（最低点在中间，两边都明显高）
    const D0 = Math.hypot(e.x - s.x, e.y - s.y);
    if (fLo > 0.1 && fLo < 0.92 && Math.min(dropL, dropR) > 0.18 * size && Math.max(dropL, dropR) > 0.28 * size && w > 0.22 * size && D0 > 0.25 * size && len < 2.9 * size) return { tone: 3 };
    // ∧：不是声调
    if (fHi > 0.12 && fHi < 0.88 && Math.min(riseL, riseR) > 0.25 * size) return { bad: 'shape' };
    const dx = e.x - s.x, dy = e.y - s.y, D = Math.hypot(dx, dy);
    if (D < 0.62 * size) return { bad: 'shape' };        // 绕圈 / 乱涂
    let dev = 0;
    for (let i = 0; i < n; i++) { const p = pts[i]; const d = Math.abs((p.x - s.x) * dy - (p.y - s.y) * dx) / D; if (d > dev) dev = d; }
    if (dev > 0.24 * D) return { bad: 'curve' };           // 太弯（又不是 ∨）
    // 只看线的形状、不看从哪头画起：孩子按汉字笔顺习惯从上往下画“/”（像写撇）也是二声 ˊ，不能按方向判成四声
    let a = Math.atan2(-dy, dx) * 180 / Math.PI;            // y 向上为正
    if (a > 90) a -= 180; else if (a < -90) a += 180;
    if (Math.abs(a) > 84) return { bad: 'angle' };          // 几乎笔直竖线“|”：不是声调符号，看不出是 ˊ 还是 ˋ
    if (Math.abs(a) <= 17) return { tone: 1 };
    if (a >= 25) return { tone: 2 };
    if (a <= -25) return { tone: 4 };
    return { bad: 'angle' };
  }

  /* 桥形：u ∈ [0,1] → 相对栈桥面的高度（单位，负 = 往上） */
  function pathY(t, u) {
    u = clamp(u, 0, 1);
    if (t === 2) return -H2 * u;
    if (t === 3) { const v = 1 - Math.abs(2 * u - 1); return D3 * Math.sin(v * Math.PI / 2); }
    if (t === 4) return u < 0.16 ? -H4 * (u / 0.16) : -H4 * (1 - (u - 0.16) / 0.84);
    return 0;
  }
  function slopeAt(t, u) { return (pathY(t, u + 0.02) - pathY(t, u - 0.02)) / (0.04 * GW); }

  const THEMES = {
    day: { sky: ['#2E9CF0', '#7FCDFF', '#D6F2FF'], sea: ['#7ED9EC', '#35AAD6', '#1A77AE', '#0F578F'], city: '#A9C9E8', win: 'rgba(255,255,255,.45)',
      orb: 'sun', cloud: 1, star: 0, deck: '#DDA15E', top: '#F6C986', side: '#A8683A', post: '#8A5530', glow: 0, gull: '#FFFFFF' },
    dusk: { sky: ['#4B47A6', '#E97E95', '#FFC98C'], sea: ['#F2AE92', '#9B84BA', '#51609F', '#2E3D79'], city: '#8F6C9F', win: 'rgba(255,226,150,.85)',
      orb: 'sunset', cloud: 0.85, star: 0.25, deck: '#CF8F55', top: '#EDB67C', side: '#955A33', post: '#7A4A2A', glow: 0.45, gull: '#FFE9D6' },
    night: { sky: ['#07102F', '#16255C', '#2F4585'], sea: ['#2F5E9E', '#1E4482', '#11295C', '#0A1B40'], city: '#1B2758', win: 'rgba(255,214,110,.95)',
      orb: 'moon', cloud: 0.32, star: 1, deck: '#9C6B45', top: '#C08A5C', side: '#6E4527', post: '#5A381F', glow: 1, gull: '#BFD0FF' }
  };
  const PAL_BOY = { body: '#5BCB6A', dark: '#2E9B48', belly: '#DDF8CC', spike: '#FFD84A', cheek: 'rgba(255,120,120,.55)' };
  const PAL_GIRL = { body: '#FF9ACB', dark: '#E0609E', belly: '#FFE6F2', spike: '#B98CFF', cheek: 'rgba(255,90,140,.55)' };
  const PRAISE = ['铺好啦！', '真准！', '好耳朵！', '对啦！', '漂亮！'];

  /* ---------- 声音开关：与引擎同一来源 ---------- */
  let sndC = true, sndAt = -1e9;
  function soundOn() {
    const t = nowMs();
    if (t - sndAt < 300) return sndC;
    sndAt = t;
    let v = true;
    try {
      if (typeof HW.soundOn === 'function') v = !!HW.soundOn();
      else if (typeof HW.sound === 'boolean') v = HW.sound;
      else if (HW.settings && typeof HW.settings.sound === 'boolean') v = HW.settings.sound;
      else { const s = W.localStorage.getItem('hw.v1.settings'); if (s) { const o = JSON.parse(s); if (o && o.sound === false) v = false; } }
    } catch (e) { v = true; }
    sndC = v;
    return v;
  }

  function makeSpec(ctx) {
    const gn = clamp(Math.floor(+ctx.gradeNum) || 3, 2, 6);
    const P2 = gn <= 2;
    const PAL = P2 ? PAL_GIRL : PAL_BOY;
    let g = null;
    let S = {};
    const L = {};
    const AU = { ac: null, master: null };
    let pref = { btn: false, seen: 0 };
    try { const m = ctx.mem.get('tr'); if (m && typeof m === 'object') pref = { btn: !!m.btn, seen: Math.floor(+m.seen || 0) }; } catch (e) { /* ignore */ }
    const savePref = () => { try { ctx.mem.set('tr', pref); } catch (e) { /* ignore */ } };

    /* ================= 关卡参数 ================= */
    function cfgFor(lv) {
      const k = lv - 1;
      const t = gn <= 2 ? [190, 10, 3.1, 0.13] : gn === 3 ? [205, 12, 2.8, 0.12] : gn === 4 ? [220, 14, 2.5, 0.11] : [235, 15, 2.3, 0.1];
      return {
        v0: t[0] + t[1] * k, T: t[2] - t[3] * k,
        showPy: gn <= 2 || (gn === 3 && lv <= 5),
        autoSay: gn <= 4 || lv <= 5,   // 听力游戏：P2–P4 每个词都朗读；P5–P6 第 6 关起只在点一下时读（考看字知调）
        theme: lv <= 3 ? 'day' : lv <= 6 ? 'dusk' : 'night',
        legendDemo: P2 || lv <= 3
      };
    }
    const roundsFor = (lv) => (P2 ? 11 + lv : 12 + lv);   // 每关要铺的字数：一关约 40–60 秒（一口气跑完一段栈桥）
    const ttsOk = () => { try { return !!(ctx.tts && ctx.tts.ok); } catch (e) { return false; } };

    /* ================= 出题 ================= */
    function pickUnits(target) {
      const lv = g.level;
      const out = [];
      if (g.isReview) {
        ['words', 'chars'].forEach((col) => {
          if (g.hasReview(col) > 0) (g.items(col) || []).forEach((it) => { const u = reviewUnit(it, col); if (u) out.push(u); });
        });
        if (out.length) return g.shuffle(out);
      }
      const G = g.G || {};
      const maxLen = P2 ? (lv <= 3 ? 2 : lv <= 6 ? 3 : 4) : (lv <= 2 ? 2 : lv <= 4 ? 3 : 4);
      const share = lv <= 2 ? 0.45 : lv <= 5 ? 0.25 : 0.1;
      const cItems = [], cUnits = [];
      (Array.isArray(G.chars) ? G.chars : []).forEach((it) => { const u = unitOf(it, 'chars'); if (u) { cItems.push(it); cUnits.push(u); } });
      const wItems = [], wMap = new Map();
      (Array.isArray(G.words) ? G.words : []).forEach((it) => { const u = unitOf(it, 'words'); if (u && u.syl.length <= maxLen) { wItems.push(it); wMap.set(it, u); } });
      if (wItems.length < 4) (Array.isArray(G.words) ? G.words : []).forEach((it) => { if (wMap.has(it)) return; const u = unitOf(it, 'words'); if (u) { wItems.push(it); wMap.set(it, u); } });
      let need = target;
      const nC = Math.min(cUnits.length, Math.round(target * share));
      if (nC > 0) (ctx.pick(cItems, nC) || []).forEach((it) => { const u = cUnits[cItems.indexOf(it)]; if (u) { out.push(u); need -= u.askN; } });
      if (need > 0 && wItems.length) {
        let avg = 0; wItems.forEach((it) => { avg += wMap.get(it).askN; }); avg /= wItems.length;
        const n = Math.min(wItems.length, Math.ceil(need / Math.max(1, avg)) + 1);
        const picked = (ctx.pick(wItems, n) || []).slice();
        if (gn >= 4 && lv >= 6) picked.sort((a, b) => wMap.get(b).syl.length - wMap.get(a).syl.length);
        for (const it of picked) { if (need <= 0) break; const u = wMap.get(it); if (u) { out.push(u); need -= u.askN; } }
      }
      if (need > 0) for (const u of cUnits) { if (need <= 0) break; if (out.indexOf(u) < 0) { out.push(u); need -= u.askN; } }
      const sh = g.shuffle(out);
      // 第一个放最容易的（字数最少）
      let bi = 0; sh.forEach((u, i) => { if (u.syl.length < sh[bi].syl.length) bi = i; });
      if (bi) { const u = sh.splice(bi, 1)[0]; sh.unshift(u); }
      return sh;
    }

    /* 错题本里的题带着 hz（当时画错的那个字）：重练只考这个字，词里其余的字铺成石板（读音照给） */
    function reviewUnit(it, col) {
      const u = unitOf(it, col);
      if (!u) return null;
      const hz = it && typeof it.hz === 'string' ? it.hz : '';
      if (!hz || Array.from(hz).length !== 1 || !u.syl.some((s) => s.ask && s.ch === hz)) return u;
      const syl = u.syl.map((s) => Object.assign({}, s, { ask: s.ask && s.ch === hz }));
      return Object.assign({}, u, { syl, askN: syl.filter((s) => s.ask).length });
    }

    /* ================= 布局 ================= */
    function layout() {
      const w = g.w, h = g.h;
      const land = w > h * 1.1;
      L.land = land;
      L.k = clamp(Math.min(w / (land ? 480 : 410), h / (land ? 760 : 700)), 0.78, 1.35);
      L.ui = clamp(w / 390, 0.9, 1.25);
      L.RX = Math.round(clamp(w * (land ? 0.2 : 0.17), 58, 300));
      L.bannerY = g.hudTop + 2;
      L.box = Math.round(46 * L.ui);
      L.pyH = Math.round(20 * L.ui);
      L.bannerH = L.pyH + L.box + Math.round(16 * L.ui);
      L.legH = Math.round((pref.btn ? 74 : 56) * L.ui);
      L.legY = h - L.legH - Math.round(10 * L.ui);
      L.G = Math.round(Math.max(L.bannerY + L.bannerH + 215 * L.k, h * (land ? 0.6 : 0.56)));
      L.G = Math.round(Math.min(L.G, L.legY - 118 * L.k));
      L.water = L.G + WATER_U * L.k;
      L.horizon = Math.round(L.G - 82 * L.k);
      L.cs = Math.round(clamp(62 * L.k, 50, 80));
      L.rs = L.k * 1.08;
      L.grad = null; L.skyCv = null;
      layoutLegend();
    }
    function layoutLegend() {
      const w = g.w;
      const lw = Math.min(w - 16, 600), x0 = (w - lw) / 2, gap = Math.round(8 * L.ui);
      const cw = (lw - gap * 3) / 4;
      L.cells = [1, 2, 3, 4].map((t, i) => ({ t, x: x0 + i * (cw + gap), y: L.legY, w: cw, h: L.legH }));
      const tw = Math.round(96 * L.ui), th = Math.round(30 * L.ui);
      L.toggle = { x: x0 + lw - tw, y: L.legY - th - Math.round(8 * L.ui), w: tw, h: th };
    }
    const X = (wx) => L.RX + (wx - S.cam) * L.k;
    const Y = (wy) => L.G + wy * L.k;

    /* ================= 赛道 ================= */
    function platLen(f) {
      // t-rex Obstacle.getGap：最小间距随速度增长（这里 = 速度 × 每字用时），再在 1 ~ 1+(1.5-1)×30% 之间随机放宽
      const base = Math.max(175, S.v * S.cfg.T - GW);
      return base * f * (1 + Math.random() * (TREX.MAX_GAP_COEF - 1) * 0.3);
    }
    function addCoins(a, b) {
      const room = b - a;
      if (room < 250 || Math.random() < 0.3) return;
      const n = clamp(Math.floor((room - 150) / 55), 2, 5), mid = (a + b) / 2, arc = Math.random() < 0.5;
      for (let i = 0; i < n; i++) {
        const f = n > 1 ? i / (n - 1) : 0.5;
        S.coins.push({ x: mid + (f - 0.5) * (n - 1) * 44, y: -30 - (arc ? Math.sin(f * Math.PI) * 26 : 0), got: false, t: Math.random() * 6 });
      }
    }
    function placeUnit(u) {
      const first = !S.units.length;
      let x = S.worldEnd;
      if (!first) x += platLen(1.25) + 30;
      addCoins(first ? 220 : S.worldEnd, x);
      const rec = { u, idx: S.units.length, gaps: [], wrong: [], drawn: 0, said: false };
      for (let i = 0; i < u.syl.length; i++) {
        const s = u.syl[i];
        if (i > 0) { const nx = x + platLen(0.9); addCoins(x, nx); x = nx; }
        const gp = { i: S.gaps.length, x0: x, x1: x + GW, rec, si: i, syl: s, st: s.ask ? 'open' : 'stone', drawn: 0, bt: s.ask ? -1 : 1,
          counted: false, missed: false, launched: false, early: false, shake: 0, pop: 0, note: '', drawnAt: 0 };
        S.gaps.push(gp); rec.gaps.push(gp);
        x += GW;
      }
      S.worldEnd = x;
      S.units.push(rec);
    }
    function runnerUnit() { const gp = S.gaps[S.gi]; return gp ? gp.rec.idx : S.units.length; }
    function placeAhead() {
      let guard = 0;
      while (S.queue.length && guard++ < 12) {
        const ahead = S.units.length - runnerUnit();
        if (ahead >= 3 && S.worldEnd > S.r.x + L.viewU * 2.2 + 300) break;
        placeUnit(S.queue.shift());
      }
    }
    function findCursor() {
      let i = Math.max(0, S.cscan);
      while (i < S.gaps.length && S.gaps[i].st !== 'open') i++;
      S.cscan = i;
      S.cursor = i < S.gaps.length ? i : -1;
    }
    const allowed = (gp) => !!gp && gp.rec.idx <= runnerUnit() + 1;
    function activeRec() {
      const gp = S.cursor >= 0 ? S.gaps[S.cursor] : null;
      if (gp) return gp.rec;
      const gr = S.gaps[S.gi];
      return gr ? gr.rec : S.units[S.units.length - 1] || null;
    }
    function checkActive() {
      const rec = activeRec();
      if (rec && rec !== S.active) {
        S.active = rec; S.bannerPop = 1;
        if (!rec.said && S.cfg.autoSay && g.state === 'play') sayRec(rec);
      }
    }
    function sayRec(rec) {
      if (!rec) return;
      rec.said = true;
      if (!ttsOk()) return;   // 没有中文朗读就不读（引擎的无声字幕会带声调，等于泄题）
      try { g.say(rec.u.text); } catch (e) { /* ignore */ }
    }
    const itemOf = (gp) => Object.assign({}, gp.rec.u.it, { hz: gp.syl.ch });

    /* ================= 画声调 → 铺桥 ================= */
    function applyTone(t, px, py) {
      if (g.state !== 'play' || S.empty) return;
      const gp = S.cursor >= 0 ? S.gaps[S.cursor] : null;
      if (!gp) { hint('前面没有缺口啦', px, py); return; }
      if (!allowed(gp)) { hint('先跑过去再画！', px, py); return; }
      const ok = t === gp.syl.tone;
      gp.drawn = t; gp.st = ok ? 'ok' : 'bad'; gp.bt = 0; gp.drawnAt = S.t;
      gp.early = ok && (gp.x0 - S.r.x) / Math.max(60, S.v) > 1.25;
      gp.pop = 1;
      const rec = gp.rec; rec.drawn++;
      const sx = X((gp.x0 + gp.x1) / 2), sy = Y(-CARD_U);
      S.marks.push({ x0: px, y0: py, gp, t: 0, tone: t, ok });
      toneWhistle(t);
      if (ok) {
        g.sfx('good');
        addFloat(g.pick(PRAISE), clamp(sx, 60, g.w - 60), clamp(sy - L.cs * 1.3, g.hudTop + L.bannerH + 20, g.h), '#FFE45C', 26, 'round');
      } else {
        g.sfx('bad');
        gp.shake = 1;
        rec.wrong.push(gp.si);
        const s = gp.syl;
        gp.note = rec.u.text + '：“' + s.ch + '”读 ' + s.py + '（' + TNAME[s.tone] + ' ' + MARK[s.tone] + '），画成了' + TNAME[t] + ' ' + MARK[t];
        addFloat('✗ ' + TNAME[t], clamp(sx, 60, g.w - 60), clamp(sy - L.cs * 1.3, g.hudTop + L.bannerH + 20, g.h), '#FF8A8A', 24, 'round');
        if (ttsOk()) g.after(0.35, () => { try { g.say(rec.u.text); } catch (e) { /* ignore */ } });
      }
      S.bannerPop = 0.6;
      findCursor();
      if (rec.drawn >= rec.u.askN && rec.wrong.length) queueRetry(rec);
      checkActive();
    }
    function queueRetry(rec) {
      const ws = new Set(rec.wrong), u = rec.u;
      const nu = { it: u.it, col: u.col, text: u.text, syl: u.syl.map((s, i) => Object.assign({}, s, { ask: ws.has(i) })), askN: ws.size, retry: true };
      S.queue.splice(Math.min(1, S.queue.length), 0, nu);
    }
    function hint(text, x, y) {
      if (S.t - S.hintT < 0.5) return;
      S.hintT = S.t;
      addFloat(text, clamp(x == null ? g.w / 2 : x, 80, g.w - 80), clamp(y == null ? g.h * 0.6 : y, g.hudTop + 40, g.h - 40), '#FFFFFF', 22, 'round');
      g.sfx('tick');
    }

    /* ================= 小龙 ================= */
    function breakBridge(gp) {
      gp.st = 'broke';
      const t = gp.drawn;
      for (let i = 0; i < 6; i++) {
        const u = (i + 0.5) / 6;
        S.debris.push({ x: gp.x0 + u * GW, y: pathY(t, u), vx: (Math.random() - 0.5) * 120 + S.r.spd * 0.2, vy: -80 - Math.random() * 160,
          rot: Math.atan(slopeAt(t, u)), vr: (Math.random() - 0.5) * 9, w: GW / 6 + 4, age: 0 });
      }
      g.sfx('crash'); g.shake(8);
      const r = S.r;
      r.mode = 'fall'; r.vy = -140; r.spd *= 0.35; r.why = 'bad'; r.fg = gp;
    }
    function launch(gp, vyWanted) {
      const r = S.r, nx = S.gaps[gp.i + 1];
      const room = (nx ? nx.x0 : Infinity) - gp.x1 - 70;
      const h0 = -r.y;   // 起跳时离栈桥面的高度
      let V = vyWanted;
      const spd = Math.max(60, r.spd);
      const tF = (V + Math.sqrt(V * V + 2 * TREX.GRAVITY * Math.max(0, h0))) / TREX.GRAVITY;
      if (spd * tF > room) { const tm = Math.max(0.12, room / spd); V = Math.max(0, (0.5 * TREX.GRAVITY * tm * tm - h0) / tm); }
      r.mode = 'air'; r.vy = -V;
    }
    function gapAtX(x) {
      for (let i = Math.max(0, S.gi - 1); i < Math.min(S.gaps.length, S.gi + 3); i++) { const gp = S.gaps[i]; if (x >= gp.x0 && x <= gp.x1) return gp; }
      return null;
    }
    function groundAt(x) {
      for (let i = Math.max(0, S.gi - 1); i < Math.min(S.gaps.length, S.gi + 3); i++) {
        const gp = S.gaps[i];
        if (x >= gp.x0 && x <= gp.x1) {
          if (gp.st === 'ok') return pathY(gp.drawn, (x - gp.x0) / GW);
          if (gp.st === 'stone') return 0;
          return null;
        }
      }
      return 0;
    }
    function dust(n, big) {
      const r = S.r;
      for (let i = 0; i < n; i++) {
        if (S.parts.length > 90) S.parts.shift();
        S.parts.push({ k: 'dust', x: r.x - 8 + Math.random() * 6, y: r.y - 2, vx: -40 - Math.random() * 50, vy: -20 - Math.random() * (big ? 90 : 30), age: 0, life: 0.45 + Math.random() * 0.25, r: (big ? 7 : 4) + Math.random() * 4 });
      }
    }
    function updRunner(dt) {
      const r = S.r;
      r.anim += dt;
      if (r.sq > 0) r.sq = Math.max(0, r.sq - dt * 4.5);
      r.blinkT -= dt; if (r.blinkT < -0.14) r.blinkT = 1.6 + Math.random() * 2.4;
      if (r.mode === 'run') {
        const gp = S.gaps[S.gi];
        let target = S.v * (1 + r.boost);
        r.boost = Math.max(0, r.boost - dt * 0.7);
        let dist = Infinity;
        if (gp && gp.st === 'open') {
          dist = gp.x0 - EDGE - r.x;
          if (P2 && dist < S.v * 1.1) target = Math.min(target, S.v * 0.5);        // P2：快到没铺的缺口时慢动作
          target = Math.min(target, Math.sqrt(2 * DEC * Math.max(0, dist)));
        }
        if (r.spd < target) r.spd = Math.min(target, r.spd + ACC * dt); else r.spd = target;
        let nx = r.x + r.spd * dt;
        if (gp && gp.st === 'open' && nx > gp.x0 - EDGE) nx = Math.max(r.x, gp.x0 - EDGE);
        S.dist += (nx - r.x) * TREX.DIST_COEF;
        r.x = nx;
        // 等在崖边
        if (gp && gp.st === 'open' && dist < 2 && r.spd < 10) {
          r.wait += dt;
          if (!gp.missed) {
            gp.missed = true;
            g.miss();
            addFloat('快画声调！', X(r.x) + 30 * L.k, Y(-80), '#FFE45C', 24, 'round');
          }
          if (r.wait > 6 && S.cfg.autoSay && !r.nagged) { r.nagged = true; sayRec(gp.rec); }
        } else { r.wait = 0; r.nagged = false; }
        // 在桥上
        if (gp && r.x >= gp.x0 && r.x <= gp.x1) {
          const u = (r.x - gp.x0) / GW;
          if (gp.st === 'bad') { r.y = pathY(gp.drawn, u); r.tilt = Math.atan(slopeAt(gp.drawn, u)) * 0.8; if (u > 0.3) breakBridge(gp); }
          else if (gp.st === 'ok' || gp.st === 'stone') {
            const t = gp.st === 'stone' ? 0 : gp.drawn;
            r.y = pathY(t, u); r.tilt = Math.atan(slopeAt(t, u)) * 0.85;
            if (t === 4 && u > 0.16) r.boost = Math.max(r.boost, 0.45);
            if (!gp.launched && u >= 0.985 && gp.st === 'ok' && (t === 2 || t === 3)) {
              gp.launched = true;
              if (t === 2) { launch(gp, TREX.JUMP_V + r.spd / 10); g.sfx('jump'); dust(4, true); }
              else { launch(gp, 330); g.sfx('bubble'); }
            }
            if (t === 4 && u > 0.16 && u < 0.3 && !gp.launched) { gp.launched = true; g.sfx('whoosh'); }
          }
        } else {
          r.y = 0; r.tilt *= Math.max(0, 1 - dt * 10);
        }
        if (r.mode === 'run') {
          r.dustT -= dt * (r.spd / 200);
          if (r.dustT <= 0 && r.spd > 40 && r.y === 0) { r.dustT = 0.13; dust(1, false); }
        }
      } else if (r.mode === 'air') {
        r.vy += TREX.GRAVITY * dt; r.y += r.vy * dt;
        const nx = r.x + r.spd * dt; S.dist += (nx - r.x) * TREX.DIST_COEF; r.x = nx;
        r.tilt = lerp(r.tilt, clamp(r.vy / 1400, -0.35, 0.4), Math.min(1, dt * 8));
        const gy = groundAt(r.x);
        if (gy !== null && r.vy > 0 && r.y >= gy) { r.y = gy; r.vy = 0; r.mode = 'run'; r.sq = 1; dust(5, true); }
        else if (gy === null && r.y > 4) { r.mode = 'fall'; r.why = 'slip'; r.fg = gapAtX(r.x); }
      } else if (r.mode === 'fall') {
        r.vy += TREX.GRAVITY * 0.7 * dt; r.y += r.vy * dt;
        r.spd *= Math.max(0, 1 - dt * 1.5); r.x += r.spd * dt;
        if (r.fg) r.x = clamp(r.x, r.fg.x0 + 12, r.fg.x1 - 12);
        r.tilt += dt * 3;
        if (r.y >= WATER_U + 4) splash();
      } else if (r.mode === 'sink') {
        r.t += dt;
        r.y = WATER_U + 10 + Math.sin(r.t * 7) * 3; r.tilt = Math.sin(r.t * 5) * 0.15;
        if (Math.random() < dt * 8) S.parts.push({ k: 'bub', x: r.x + (Math.random() - 0.5) * 30, y: WATER_U + 8, vx: 0, vy: -40 - Math.random() * 30, age: 0, life: 0.6, r: 3 + Math.random() * 3 });
        if (r.t > 0.8) { r.mode = 'toss'; r.t = 0; r.tx0 = r.x; r.tx1 = r.why === 'bad' && r.fg ? r.fg.x1 + 70 : (r.fg ? r.fg.x0 - EDGE : r.x); g.sfx('splash'); }
      } else if (r.mode === 'toss') {
        r.t += dt / 0.9;
        const p = Math.min(1, r.t);
        r.x = lerp(r.tx0, r.tx1, p);
        r.y = lerp(WATER_U, 0, p) - Math.sin(p * Math.PI) * 135;
        r.tilt = -0.5 + p * 0.5;
        if (p >= 1) { r.mode = 'run'; r.y = 0; r.tilt = 0; r.spd = 0; r.sq = 1; dust(6, true); g.sfx('pop'); }
      }
      S.cam = r.x;
    }
    function splash() {
      const r = S.r;
      r.mode = 'sink'; r.t = 0; r.y = WATER_U + 6;
      const sx = X(r.x), sy = Y(WATER_U);
      g.burst(sx, sy, { kind: 'water', n: 26 });
      g.sfx('splash');
      if (r.why === 'bad' && r.fg) {
        g.wrong(itemOf(r.fg), r.fg.note, sx, sy - 40);
        r.fg.counted = true;
      } else g.miss();
    }
    function crossings() {
      const r = S.r;
      while (S.gi < S.gaps.length) {
        const gp = S.gaps[S.gi];
        if (!(r.mode === 'run' && r.x > gp.x1 + 4)) break;
        S.gi++;
        const rec = gp.rec;
        if (gp.st === 'ok' && !gp.counted) {
          gp.counted = true;
          const sx = X(gp.x1), sy = Y(-60);
          g.right(itemOf(gp), sx, sy);
          addFloat(gp.syl.py, sx, sy - 70 * L.k, TCOL[gp.syl.tone], 28, 'py');
          if (g.state !== 'play') return;
          if (gp.early) g.addScore(5, sx + 30, sy - 20);
          if (g.combo >= 5 && g.combo % 5 === 0) g.sfx('power');
        }
        if (rec.gaps[rec.gaps.length - 1] === gp) {
          const allOk = rec.gaps.every((q) => q.st === 'ok' || q.st === 'stone');
          if (allOk && !rec.u.retry && rec.u.askN >= 2) {
            g.addScore(10, g.w / 2, L.bannerY + L.bannerH + 26);
            addFloat('整词全对！', g.w / 2, L.bannerY + L.bannerH + 60, '#FFE45C', 30, 'round');
            g.burst(g.w / 2, L.bannerY + L.bannerH / 2, { kind: 'confetti', n: 26 });
            g.sfx('match');
          }
        }
      }
    }
    function collectCoins() {
      const r = S.r, rx = r.x + 8, ry = r.y - 26;
      for (let i = 0; i < S.coins.length; i++) {
        const c = S.coins[i];
        if (c.got) continue;
        if (c.x < r.x - 400) { S.coins.splice(i, 1); i--; continue; }
        if (Math.abs(c.x - rx) < 24 && Math.abs(c.y - ry) < 40) {
          c.got = true;
          g.addScore(g.combo >= 5 ? 2 : 1);
          g.burst(X(c.x), Y(c.y), { kind: 'spark', n: 6, color: '#FFE45C' });
          if (S.t - S.coinT > 0.07) { S.coinT = S.t; g.sfx('coin'); }
        }
      }
    }
    function updParts(dt) {
      for (let i = S.parts.length - 1; i >= 0; i--) {
        const p = S.parts[i];
        p.age += dt;
        if (p.age >= p.life) { S.parts.splice(i, 1); continue; }
        p.x += p.vx * dt; p.y += p.vy * dt;
        if (p.k === 'dust') { p.vx *= 1 - dt * 3; p.vy *= 1 - dt * 3; }
      }
      for (let i = S.debris.length - 1; i >= 0; i--) {
        const d = S.debris[i];
        d.age += dt; d.vy += TREX.GRAVITY * 0.55 * dt; d.x += d.vx * dt; d.y += d.vy * dt; d.rot += d.vr * dt;
        if (d.y > WATER_U && !d.sp) { d.sp = true; g.burst(X(d.x), Y(WATER_U), { kind: 'water', n: 5 }); }
        if (d.age > 2.2) S.debris.splice(i, 1);
      }
      for (let i = S.marks.length - 1; i >= 0; i--) {
        const m = S.marks[i];
        m.t += dt / 0.32;
        if (m.t >= 1) {
          S.marks.splice(i, 1);
          m.gp.bt = 0.001;
          const sx = X((m.gp.x0 + m.gp.x1) / 2);
          if (sx < g.w + 40) { g.burst(sx, Y(0), { kind: 'spark', n: 10, color: m.ok ? '#FFE45C' : '#FFB0B0' }); g.ring(sx, Y(0), m.ok ? '#FFE45C' : '#FF8A8A'); }
          g.sfx('pop');
        }
      }
      for (const gp of S.gaps) {
        if (gp.bt > 0 && gp.bt < 1) gp.bt = Math.min(1, gp.bt + dt / 0.35);
        if (gp.pop > 0) gp.pop = Math.max(0, gp.pop - dt * 2.5);
        if (gp.shake > 0) gp.shake = Math.max(0, gp.shake - dt * 1.6);
      }
      for (let i = S.floats.length - 1; i >= 0; i--) { const f = S.floats[i]; f.age += dt; f.y -= 42 * dt; if (f.age > f.life) S.floats.splice(i, 1); }
      if (S.trail) { S.trail.t += dt; if (S.trail.t > 0.4) S.trail = null; }
      if (S.bannerPop > 0) S.bannerPop = Math.max(0, S.bannerPop - dt * 2.2);
    }
    function addFloat(text, x, y, col, size, font) {
      if (S.floats.length > 14) S.floats.shift();
      S.floats.push({ text: String(text), x, y, col, size: Math.round(size * clamp(L.ui, 0.9, 1.2)), font: font || 'round', age: 0, life: 1.1 });
    }
    function distanceMeter(dt) {
      const A = S.ach;
      const m = Math.floor(S.dist);
      if (!A.on && m >= A.next) { A.on = true; A.t = 0; A.n = 0; A.next = (Math.floor(m / TREX.ACH_DIST) + 1) * TREX.ACH_DIST; g.sfx('star'); }
      if (A.on) {   // 原作：FLASH_DURATION 暗、再 FLASH_DURATION 亮，闪 FLASH_ITERATIONS 次
        A.t += dt;
        if (A.t > TREX.FLASH_S * 2) { A.t = 0; A.n++; }
        if (A.n > TREX.FLASH_N) A.on = false;
      }
    }

    /* ================= 声调哨音（WebAudio，本文件自带；跟随全局声音开关） ================= */
    function auEnsure() {
      if (AU.dead) return null;
      if (AU.ac) { if (AU.ac.state === 'suspended' && AU.ac.resume) { try { AU.ac.resume().catch(() => {}); } catch (e) { /* ignore */ } } return AU.ac; }
      const C = W.AudioContext || W.webkitAudioContext;
      if (!C) return null;
      try {
        const ac = new C();
        AU.master = ac.createGain(); AU.master.gain.value = 0.9; AU.master.connect(ac.destination);
        AU.ac = ac;
        if (ac.state === 'suspended' && ac.resume) ac.resume().catch(() => {});
      } catch (e) { AU.ac = null; }
      return AU.ac;
    }
    function toneWhistle(t) {
      if (!soundOn()) return;
      const ac = auEnsure();
      if (!ac || ac.state !== 'running') return;
      try {
        const t0 = ac.currentTime + 0.01, d = t === 3 ? 0.42 : 0.34;
        const o = ac.createOscillator(), o2 = ac.createOscillator(), gn = ac.createGain(), g2 = ac.createGain();
        o.type = 'triangle'; o2.type = 'sine';
        const pts = t === 1 ? [[0, 660], [1, 660]] : t === 2 ? [[0, 400], [1, 720]] : t === 3 ? [[0, 480], [0.45, 330], [1, 580]] : [[0, 780], [1, 340]];
        pts.forEach(([tt, hz], i) => {
          if (!i) { o.frequency.setValueAtTime(hz, t0); o2.frequency.setValueAtTime(hz * 2, t0); }
          else { o.frequency.linearRampToValueAtTime(hz, t0 + tt * d); o2.frequency.linearRampToValueAtTime(hz * 2, t0 + tt * d); }
        });
        gn.gain.setValueAtTime(0.0001, t0);
        gn.gain.exponentialRampToValueAtTime(0.2, t0 + 0.02);
        gn.gain.setValueAtTime(0.2, t0 + d * 0.7);
        gn.gain.exponentialRampToValueAtTime(0.0001, t0 + d);
        g2.gain.value = 0.25;
        o.connect(gn); o2.connect(g2); g2.connect(gn); gn.connect(AU.master);
        o.start(t0); o2.start(t0); o.stop(t0 + d + 0.05); o2.stop(t0 + d + 0.05);
      } catch (e) { /* ignore */ }
    }

    /* ================= 绘制：背景 ================= */
    function grads(c) {
      if (L.grad && L.gradTheme === S.theme) return L.grad;
      const T = THEMES[S.theme];
      const sky = c.createLinearGradient(0, 0, 0, L.horizon);
      sky.addColorStop(0, T.sky[0]); sky.addColorStop(0.62, T.sky[1]); sky.addColorStop(1, T.sky[2]);
      const sea = c.createLinearGradient(0, L.horizon, 0, g.h);
      sea.addColorStop(0, T.sea[0]); sea.addColorStop(0.18, T.sea[1]); sea.addColorStop(0.55, T.sea[2]); sea.addColorStop(1, T.sea[3]);
      L.grad = { sky, sea }; L.gradTheme = S.theme;
      return L.grad;
    }
    function skylineCanvas() {
      if (L.skyCv && L.skyTheme === S.theme) return L.skyCv;
      const T = THEMES[S.theme], k = L.k, dpr = Math.min(2, g.dpr || 1);
      const tw = Math.round(1200 * k), th = Math.round(150 * k);
      const cv = document.createElement('canvas');
      cv.width = Math.round(tw * dpr); cv.height = Math.round(th * dpr);
      const x = cv.getContext('2d');
      x.scale(dpr, dpr);
      x.fillStyle = T.city;
      const base = th;
      let px = 0, n = 0;
      const win = (bx, by, bw, bh) => { if (!T.win) return; x.fillStyle = T.win; for (let yy = by + 6 * k; yy < base - 6 * k; yy += 9 * k) for (let xx = bx + 4 * k; xx < bx + bw - 5 * k; xx += 8 * k) if (hash(n++ + xx * 7 + yy) > (S.theme === 'day' ? 0.55 : 0.4)) x.fillRect(xx, yy, 3.2 * k, 4 * k); x.fillStyle = T.city; };
      while (px < tw) {
        const r = hash(px * 13 + 7);
        if (px > tw * 0.3 && px < tw * 0.3 + 10 * k) {
          // 滨海湾金沙：三座塔 + 空中花园
          for (let i = 0; i < 3; i++) { x.fillRect(px + i * 34 * k, base - 108 * k, 20 * k, 108 * k); win(px + i * 34 * k, base - 108 * k, 20 * k, 108 * k); }
          x.beginPath(); x.moveTo(px - 8 * k, base - 112 * k); x.lineTo(px + 96 * k, base - 116 * k); x.lineTo(px + 92 * k, base - 106 * k); x.lineTo(px - 6 * k, base - 104 * k); x.fill();
          px += 120 * k; continue;
        }
        if (px > tw * 0.62 && px < tw * 0.62 + 10 * k) {
          // 宝塔（中国元素）
          const cx = px + 30 * k;
          for (let i = 0; i < 5; i++) { const ww = (46 - i * 7) * k, yy = base - (i + 1) * 20 * k; x.fillRect(cx - ww / 2 + 5 * k, yy, ww - 10 * k, 20 * k); x.beginPath(); x.moveTo(cx - ww / 2 - 4 * k, yy + 4 * k); x.lineTo(cx, yy - 7 * k); x.lineTo(cx + ww / 2 + 4 * k, yy + 4 * k); x.fill(); }
          x.fillRect(cx - 1.5 * k, base - 122 * k, 3 * k, 16 * k);
          px += 70 * k; continue;
        }
        if (r < 0.18) {
          // 擎天树
          const cx = px + 20 * k, hh = (60 + hash(px) * 40) * k;
          x.fillRect(cx - 3 * k, base - hh, 6 * k, hh);
          x.beginPath(); x.moveTo(cx - 22 * k, base - hh - 10 * k); x.lineTo(cx + 22 * k, base - hh - 10 * k); x.lineTo(cx + 4 * k, base - hh + 8 * k); x.lineTo(cx - 4 * k, base - hh + 8 * k); x.fill();
          px += 46 * k; continue;
        }
        // 组屋
        const bw = (44 + r * 40) * k, bh = (46 + hash(px + 3) * 70) * k;
        x.fillRect(px, base - bh, bw, bh); win(px, base - bh, bw, bh);
        px += bw + (4 + hash(px + 9) * 16) * k;
      }
      L.skyCv = { cv, w: tw, h: th }; L.skyTheme = S.theme;
      return L.skyCv;
    }
    function drawBack(c) {
      const T = THEMES[S.theme], w = g.w, k = L.k, gr = grads(c), tt = S.bg;
      c.fillStyle = gr.sky; c.fillRect(0, 0, w, L.horizon + 2);
      // 星星
      if (T.star > 0) {
        for (let i = 0; i < 46; i++) {
          const sx = hash(i * 3 + 1) * w, sy = hash(i * 5 + 2) * L.horizon * 0.85;
          c.globalAlpha = T.star * (0.45 + 0.55 * Math.abs(Math.sin(tt * (0.8 + hash(i) * 1.6) + i)));
          c.fillStyle = '#FFFBE0'; c.fillRect(sx, sy, 2.2, 2.2);
        }
        c.globalAlpha = 1;
      }
      // 太阳 / 月亮
      const ox = w * 0.8, oy = T.orb === 'sunset' ? L.horizon - 30 * k : L.horizon * 0.34 + 10;
      if (T.orb === 'moon') {
        c.fillStyle = 'rgba(255,250,210,.18)'; c.beginPath(); c.arc(ox, oy, 46 * k, 0, TAU); c.fill();
        c.fillStyle = '#FFF6CC'; c.beginPath(); c.arc(ox, oy, 26 * k, 0, TAU); c.fill();
        c.fillStyle = 'rgba(200,190,140,.45)'; c.beginPath(); c.arc(ox - 8 * k, oy - 5 * k, 5 * k, 0, TAU); c.arc(ox + 7 * k, oy + 8 * k, 4 * k, 0, TAU); c.fill();
      } else {
        const R = (T.orb === 'sunset' ? 44 : 30) * k;
        c.fillStyle = T.orb === 'sunset' ? 'rgba(255,200,120,.28)' : 'rgba(255,255,220,.35)';
        c.beginPath(); c.arc(ox, oy, R * (1.7 + Math.sin(tt * 1.5) * 0.08), 0, TAU); c.fill();
        c.fillStyle = T.orb === 'sunset' ? '#FF9A4D' : '#FFE14D'; c.beginPath(); c.arc(ox, oy, R, 0, TAU); c.fill();
      }
      // 云（t-rex BG_CLOUD_SPEED = 0.2 的视差）
      const span = w + 400;
      for (let i = 0; i < 6; i++) {
        const cx = ((hash(i * 11) * span - (S.cam * L.k * TREX.CLOUD_SPEED + tt * 6) * (0.6 + hash(i + 40) * 0.6)) % span + span) % span - 200;
        const cy = g.hudTop + L.bannerH + 20 + hash(i * 17) * Math.max(40, L.horizon - g.hudTop - L.bannerH - 90);
        g.cloud(cx, cy, (0.55 + hash(i * 23) * 0.5) * k, 0.9 * T.cloud);
      }
      // 海鸥
      for (let i = 0; i < 3; i++) {
        const gx = ((w + 200) - ((tt * (40 + i * 12) + i * 300) % (w + 400))), gy = L.horizon * (0.35 + i * 0.13) + Math.sin(tt * 2 + i) * 8;
        const fl = Math.sin(tt * 9 + i * 2) * 5 * k;
        c.strokeStyle = T.gull; c.lineWidth = 2.4; c.lineCap = 'round';
        c.beginPath(); c.moveTo(gx - 9 * k, gy - fl); c.quadraticCurveTo(gx - 4 * k, gy - 5 * k, gx, gy); c.quadraticCurveTo(gx + 4 * k, gy - 5 * k, gx + 9 * k, gy - fl); c.stroke();
      }
      // 远处城市天际线（视差 0.06）
      const sk = skylineCanvas();
      const off = ((S.cam * L.k * 0.06) % sk.w + sk.w) % sk.w;
      for (let x = -off; x < w; x += sk.w) c.drawImage(sk.cv, x, L.horizon - sk.h + 2, sk.w, sk.h);
      // 海
      c.fillStyle = gr.sea; c.fillRect(0, L.horizon, w, g.h - L.horizon);
      c.fillStyle = 'rgba(255,255,255,.55)'; c.fillRect(0, L.horizon, w, 2);
      // 远处的船
      for (let i = 0; i < 2; i++) {
        const bx = (((hash(i * 7 + 3) * (w + 300)) - (S.cam * L.k * 0.12) - tt * 8) % (w + 300) + (w + 300)) % (w + 300) - 150;
        g.emoji(i ? '⛵' : '🚢', bx, L.horizon + 4 * k - 12 * k * (i ? 1 : 0.9), (i ? 26 : 30) * k, { flip: !i });
      }
      // 海面波纹
      c.strokeStyle = 'rgba(255,255,255,.35)'; c.lineWidth = 2; c.lineCap = 'round';
      for (let i = 0; i < 14; i++) {
        const wy = L.horizon + 12 + hash(i * 9) * (L.G - L.horizon - 16);
        const wx = (((hash(i * 13) * (w + 100)) - S.cam * L.k * (0.2 + (wy - L.horizon) / 400)) % (w + 100) + (w + 100)) % (w + 100) - 50;
        c.beginPath(); c.moveTo(wx, wy); c.lineTo(wx + (14 + hash(i) * 20) * k, wy); c.stroke();
      }
    }

    /* ================= 绘制：栈桥与桥 ================= */
    function platforms(fn) {
      const vl = S.cam - L.RX / L.k - 60, vr = S.cam + (g.w - L.RX) / L.k + 60;
      let a = -1e9;
      for (let i = 0; i <= S.gaps.length; i++) {
        const gp = S.gaps[i];
        const b = gp ? gp.x0 : 1e9;
        if (b > vl && a < vr) fn(Math.max(a, vl), Math.min(b, vr), a > vl, b < vr);
        if (!gp) break;
        a = gp.x1;
        if (a > vr) break;
      }
    }
    function drawDeck(c) {
      const T = THEMES[S.theme], k = L.k;
      const dh = 18 * k;
      // 栈桥柱（先画，海面盖住下半截）
      c.lineWidth = 2;
      platforms((a, b, capA, capB) => {
        c.fillStyle = T.post; c.strokeStyle = NAVY;
        const s0 = Math.ceil(a / 110) * 110;
        for (let x = s0; x < b; x += 110) { const sx = X(x); c.fillRect(sx - 5 * k, L.G + dh - 2, 10 * k, 78 * k); c.strokeRect(sx - 5 * k, L.G + dh - 2, 10 * k, 78 * k); }
        if (capA) { const sx = X(a) + 7 * k; c.fillRect(sx - 7 * k, L.G, 14 * k, 88 * k); c.strokeRect(sx - 7 * k, L.G, 14 * k, 88 * k); }
        if (capB) { const sx = X(b) - 7 * k; c.fillRect(sx - 7 * k, L.G, 14 * k, 88 * k); c.strokeRect(sx - 7 * k, L.G, 14 * k, 88 * k); }
      });
      platforms((a, b, capA, capB) => {
        const x0 = X(a), x1 = X(b);
        c.fillStyle = T.side; c.fillRect(x0, L.G + 6 * k, x1 - x0, dh - 6 * k);
        c.fillStyle = T.deck; c.fillRect(x0, L.G, x1 - x0, 9 * k);
        c.fillStyle = T.top; c.fillRect(x0, L.G, x1 - x0, 3.5 * k);
        // 木板缝
        c.fillStyle = 'rgba(60,30,10,.28)';
        const s0 = Math.ceil(a / 32) * 32;
        for (let x = s0; x < b; x += 32) c.fillRect(X(x), L.G + 1, 1.6, dh - 2);
        c.strokeStyle = NAVY; c.lineWidth = 2.6;
        c.beginPath();
        c.moveTo(x0 - (capA ? 0 : 2), L.G); c.lineTo(x1 + (capB ? 0 : 2), L.G);
        c.moveTo(x0 - (capA ? 0 : 2), L.G + dh); c.lineTo(x1 + (capB ? 0 : 2), L.G + dh);
        if (capA) { c.moveTo(x0, L.G); c.lineTo(x0, L.G + dh); }
        if (capB) { c.moveTo(x1, L.G); c.lineTo(x1, L.G + dh); }
        c.stroke();
        // 栈桥上的装饰：灯笼杆 / 椰树盆栽 / 木箱
        const d0 = Math.ceil((a + 60) / 520) * 520;
        for (let x = d0; x < b - 60; x += 520) {
          const r = hash(Math.round(x / 520) * 31 + 5);
          if (x < 150) continue;
          const sx = X(x);
          if (r < 0.45) drawLantern(c, sx, L.G, k, x);
          else if (r < 0.7) g.emoji('🌴', sx, L.G - 30 * k, 52 * k);
          else if (r < 0.85) { c.fillStyle = '#C98B4E'; c.fillRect(sx - 12 * k, L.G - 22 * k, 24 * k, 22 * k); c.strokeStyle = NAVY; c.lineWidth = 2; c.strokeRect(sx - 12 * k, L.G - 22 * k, 24 * k, 22 * k); c.beginPath(); c.moveTo(sx - 12 * k, L.G - 22 * k); c.lineTo(sx + 12 * k, L.G); c.stroke(); }
          else g.emoji('🦀', sx + Math.sin(S.bg * 1.5 + x) * 10 * k, L.G - 10 * k, 22 * k);
        }
      });
    }
    function drawLantern(c, sx, gy, k, seed) {
      const T = THEMES[S.theme];
      c.fillStyle = '#5A381F'; c.fillRect(sx - 2 * k, gy - 74 * k, 4 * k, 74 * k);
      c.fillRect(sx - 2 * k, gy - 74 * k, 18 * k, 3 * k);
      const sw = Math.sin(S.bg * 2 + seed) * 0.18;
      c.save(); c.translate(sx + 14 * k, gy - 71 * k); c.rotate(sw);
      if (T.glow > 0) {
        const gl = c.createRadialGradient(0, 17 * k, 2, 0, 17 * k, 34 * k);
        gl.addColorStop(0, 'rgba(255,200,110,' + (0.6 * T.glow) + ')'); gl.addColorStop(1, 'rgba(255,160,60,0)');
        c.fillStyle = gl; c.beginPath(); c.arc(0, 17 * k, 34 * k, 0, TAU); c.fill();
      }
      c.strokeStyle = '#5A381F'; c.lineWidth = 1.5; c.beginPath(); c.moveTo(0, 0); c.lineTo(0, 6 * k); c.stroke();
      c.fillStyle = '#E8392E'; c.strokeStyle = NAVY; c.lineWidth = 2;
      c.beginPath(); c.ellipse(0, 17 * k, 10 * k, 12 * k, 0, 0, TAU); c.fill(); c.stroke();
      c.fillStyle = '#FFC928'; c.fillRect(-6 * k, 5 * k, 12 * k, 3 * k); c.fillRect(-6 * k, 26 * k, 12 * k, 3 * k);
      c.strokeStyle = 'rgba(255,200,120,.7)'; c.lineWidth = 1.2; c.beginPath(); c.moveTo(0, 7 * k); c.lineTo(0, 26 * k); c.stroke();
      c.restore();
    }
    function bridgePts(t, frac, out) {
      const n = 14;
      out.length = 0;
      for (let i = 0; i <= n; i++) { const u = (i / n) * frac; out.push(u); }
      return out;
    }
    const UBUF = [];
    function drawBridges(c) {
      const k = L.k, vl = S.cam - L.RX / L.k - GW - 40, vr = S.cam + (g.w - L.RX) / L.k + 40;
      for (let i = Math.max(0, S.gi - 3); i < S.gaps.length; i++) {
        const gp = S.gaps[i];
        if (gp.x1 < vl) continue;
        if (gp.x0 > vr) break;
        const x0 = X(gp.x0), x1 = X(gp.x1);
        if (gp.st === 'open') {
          // 所有没铺的缺口长得一样：一条虚线 = “这里要铺桥”（不带任何声调线索）
          c.strokeStyle = 'rgba(255,255,255,.75)'; c.lineWidth = 3; c.setLineDash([7, 8]);
          c.beginPath(); c.moveTo(x0 + 6, L.G + 2); c.lineTo(x1 - 6, L.G + 2); c.stroke(); c.setLineDash([]);
          continue;
        }
        if (gp.st === 'broke' || gp.bt < 0) continue;
        const t = gp.st === 'stone' ? 0 : gp.drawn;
        const frac = gp.st === 'stone' ? 1 : clamp(gp.bt, 0, 1);
        if (frac <= 0.001) continue;
        const bad = gp.st === 'bad';
        const wob = bad ? Math.sin(S.bg * 18) * 1.5 * (0.5 + gp.shake) : 0;
        bridgePts(t, frac, UBUF);
        c.save();
        c.translate(0, wob);
        c.lineJoin = 'round'; c.lineCap = 'round';
        // 支撑
        if (!bad || true) {
          c.strokeStyle = gp.st === 'stone' ? '#7C8597' : (bad ? '#7A4B45' : '#7A4A26'); c.lineWidth = 3.2 * k;
          if (t === 2 || t === 4) {
            for (let q = 1; q <= 3; q++) { const u = q / 4; if (u > frac) break; const px = x0 + u * (x1 - x0), py = Y(pathY(t, u)); c.beginPath(); c.moveTo(px, py + 6 * k); c.lineTo(px, L.water + 20 * k); c.stroke(); }
          }
          if (t === 3) {   // 吊桥绳
            c.strokeStyle = '#8A5530'; c.lineWidth = 2; c.beginPath(); c.moveTo(x0 + 2, L.G - 26 * k);
            c.quadraticCurveTo((x0 + x1) / 2, L.G + (D3 - 20) * k, x1 - 2, L.G - 26 * k); c.stroke();
            c.fillStyle = '#8A5530'; c.fillRect(x0, L.G - 30 * k, 4 * k, 30 * k); c.fillRect(x1 - 4 * k, L.G - 30 * k, 4 * k, 30 * k);
          }
        }
        // 桥面：深色描边 + 木色 + 声调色条
        const col = gp.st === 'stone' ? '#AEB6C6' : bad ? '#C9877A' : '#E2AE6A';
        const band = gp.st === 'stone' ? '#8E97A9' : bad ? '#B35A50' : TCOL[t];
        const lw = 13 * k;
        c.beginPath();
        for (let q = 0; q < UBUF.length; q++) { const u = UBUF[q], px = x0 + u * (x1 - x0), py = Y(pathY(t, u)) + lw / 2 - 1; if (q) c.lineTo(px, py); else c.moveTo(px, py); }
        c.strokeStyle = NAVY; c.lineWidth = lw + 5; c.stroke();
        c.strokeStyle = col; c.lineWidth = lw; c.stroke();
        c.beginPath();
        for (let q = 0; q < UBUF.length; q++) { const u = UBUF[q], px = x0 + u * (x1 - x0), py = Y(pathY(t, u)) + 2.5 * k; if (q) c.lineTo(px, py); else c.moveTo(px, py); }
        c.strokeStyle = band; c.lineWidth = 4.5 * k; c.stroke();
        // 木板缝 / 裂缝
        c.strokeStyle = bad ? '#3A1712' : 'rgba(60,30,10,.35)'; c.lineWidth = bad ? 2.2 : 1.4;
        for (let q = 1; q < 6; q++) {
          const u = q / 6; if (u > frac) break;
          const px = x0 + u * (x1 - x0), py = Y(pathY(t, u));
          c.beginPath();
          if (bad && q % 2) { c.moveTo(px - 3, py); c.lineTo(px + 3, py + lw * 0.4); c.lineTo(px - 2, py + lw * 0.75); c.lineTo(px + 2, py + lw + 1); }
          else { c.moveTo(px, py + 1); c.lineTo(px, py + lw - 1); }
          c.stroke();
        }
        // 四声的弹簧
        if (t === 4 && frac > 0.2) {
          c.strokeStyle = '#4B5B7A'; c.lineWidth = 2.4; c.beginPath();
          const bx = x0 + 6 * k;
          for (let q = 0; q <= 6; q++) { const yy = L.G - q * (H4 * k / 6), xx = bx + (q % 2 ? 7 * k : -1 * k); if (q) c.lineTo(xx, yy); else c.moveTo(xx, yy); }
          c.stroke();
        }
        // 刚铺好：闪光
        if (gp.st === 'ok' && gp.bt < 1) { c.globalAlpha = 1 - gp.bt; c.strokeStyle = '#FFF6B0'; c.lineWidth = lw + 12; c.beginPath(); for (let q = 0; q < UBUF.length; q++) { const u = UBUF[q], px = x0 + u * (x1 - x0), py = Y(pathY(t, u)) + lw / 2; if (q) c.lineTo(px, py); else c.moveTo(px, py); } c.stroke(); c.globalAlpha = 1; }
        c.restore();
      }
    }
    function drawFinish(c) {
      if (S.queue.length || !S.gaps.length) return;
      const last = S.gaps[S.gaps.length - 1];
      const fx = X(last.x1 + 190), k = L.k;
      if (fx < -60 || fx > g.w + 80) return;
      const top = L.G - 110 * k;
      c.fillStyle = '#FFFFFF'; c.strokeStyle = NAVY; c.lineWidth = 2.5;
      c.fillRect(fx - 50 * k, top, 7 * k, 110 * k); c.strokeRect(fx - 50 * k, top, 7 * k, 110 * k);
      c.fillRect(fx + 43 * k, top, 7 * k, 110 * k); c.strokeRect(fx + 43 * k, top, 7 * k, 110 * k);
      const bw = 100 * k, bh = 26 * k;
      for (let i = 0; i < 10; i++) for (let j = 0; j < 2; j++) { c.fillStyle = (i + j) % 2 ? '#1d2b53' : '#FFFFFF'; c.fillRect(fx - bw / 2 + i * bw / 10, top - bh + j * bh / 2, bw / 10, bh / 2); }
      c.strokeRect(fx - bw / 2, top - bh, bw, bh);
      g.shadowText('终点', fx, top - bh - 16 * k, { size: Math.round(20 * k), color: '#FFE45C' });
    }
    function drawCoins(c) {
      const k = L.k, vl = S.cam - L.RX / L.k - 30, vr = S.cam + (g.w - L.RX) / L.k + 30;
      for (const co of S.coins) {
        if (co.got || co.x < vl || co.x > vr) continue;
        const sx = X(co.x), sy = Y(co.y + Math.sin(S.bg * 3 + co.t) * 3), sw = Math.abs(Math.cos(S.bg * 3.2 + co.t)) * 0.8 + 0.2;
        const r = 9 * k;
        c.fillStyle = '#C98A00'; c.beginPath(); c.ellipse(sx, sy + 1.5, r * sw, r, 0, 0, TAU); c.fill();
        c.fillStyle = '#FFD23F'; c.beginPath(); c.ellipse(sx, sy, r * sw, r, 0, 0, TAU); c.fill();
        c.strokeStyle = NAVY; c.lineWidth = 1.8; c.stroke();
        c.fillStyle = '#FFF1A8'; c.beginPath(); c.ellipse(sx - r * 0.25 * sw, sy - r * 0.25, r * 0.3 * sw, r * 0.35, 0, 0, TAU); c.fill();
      }
    }
    /* ================= 字卡 ================= */
    function drawCards(c) {
      const vl = S.cam - L.RX / L.k - GW, vr = S.cam + (g.w - L.RX) / L.k + GW;
      const cur = S.cursor >= 0 ? S.gaps[S.cursor] : null;
      for (let i = Math.max(0, S.gi - 2); i < S.gaps.length; i++) {
        const gp = S.gaps[i];
        if (gp.x1 < vl) continue;
        if (gp.x0 > vr) break;
        drawCard(c, gp, gp === cur);
      }
    }
    function drawCard(c, gp, isCur) {
      const k = L.k, cs = L.cs, s = gp.syl;
      const cx = X((gp.x0 + gp.x1) / 2) + (gp.shake > 0 ? Math.sin(S.bg * 60) * 6 * gp.shake : 0);
      const cy = Y(-CARD_U) + Math.sin(S.bg * 2.2 + gp.i) * 4 * k;
      const st = gp.st;
      const done = st !== 'open';
      const bad = st === 'bad' || st === 'broke';
      const pyTone = done;   // 画过 / 石板：显示带调拼音
      const showPy = S.cfg.showPy || pyTone;
      const pyTxt = pyTone ? s.py : s.bare;
      const ww = cs, hh = cs * (showPy ? 1.3 : 1);
      const pop = 1 + gp.pop * 0.25 + (isCur ? Math.sin(S.bg * 6) * 0.04 : 0);
      c.save();
      c.translate(cx, cy); c.scale(pop, pop);
      // 挂绳：卡片到缺口中间（让孩子知道这张卡属于哪个缺口）
      c.strokeStyle = 'rgba(255,255,255,.7)'; c.lineWidth = 2; c.setLineDash([3, 5]);
      c.beginPath(); c.moveTo(0, hh / 2); c.lineTo(0, (L.G - cy) / pop - 6); c.stroke(); c.setLineDash([]);
      if (isCur) g.rrect(-ww / 2 - 8, -hh / 2 - 8, ww + 16, hh + 16, 16, 'rgba(255,228,92,' + (0.35 + Math.sin(S.bg * 6) * 0.15) + ')');
      const fill = st === 'stone' ? '#EEF1F6' : st === 'ok' ? '#FFF4C8' : bad ? '#FFE3E0' : '#FFFFFF';
      const edge = st === 'ok' ? '#E0A800' : bad ? '#E0484E' : isCur ? '#FFB020' : NAVY;
      g.rrect(-ww / 2, -hh / 2 + 4, ww, hh, 12, 'rgba(15,25,60,.35)');
      g.rrect(-ww / 2, -hh / 2, ww, hh, 12, fill, edge, isCur || done ? 3.5 : 2.6);
      const chY = showPy ? hh / 2 - ww / 2 : 0;
      if (showPy) {
        const pc = st === 'stone' ? '#6B7488' : done ? TDARK[s.tone] : '#44506A';   // 画错也亮出正确读音，用“正确声调”的颜色（四种颜色 = 四个声调，不能混）
        g.text(pyTxt, 0, -hh / 2 + ww * 0.19, { size: Math.round(ww * 0.25), font: 'py', color: pc, maxW: ww - 8 });
      }
      g.text(s.ch, 0, chY + ww * 0.02, { size: Math.round(ww * 0.66), font: 'kai', color: st === 'stone' ? '#6B7488' : '#1d2b53', weight: 700 });
      // 画过的：右上角声调章
      if (done && st !== 'stone') {
        const bx = ww / 2 - 2, by = -hh / 2 + 2, br = ww * 0.2;
        c.fillStyle = bad ? '#E8453C' : '#FFB800'; c.beginPath(); c.arc(bx, by, br, 0, TAU); c.fill();
        c.strokeStyle = '#FFFFFF'; c.lineWidth = 2.5; c.stroke();
        c.strokeStyle = '#FFFFFF'; c.lineWidth = 3.2; c.lineCap = 'round'; c.beginPath();
        if (bad) { const q = br * 0.42; c.moveTo(bx - q, by - q); c.lineTo(bx + q, by + q); c.moveTo(bx + q, by - q); c.lineTo(bx - q, by + q); }
        else { c.moveTo(bx - br * 0.45, by + br * 0.02); c.lineTo(bx - br * 0.1, by + br * 0.38); c.lineTo(bx + br * 0.5, by - br * 0.35); }
        c.stroke();
      }
      if (st === 'stone') g.text('✓', ww / 2 - 4, -hh / 2 + 4, { size: Math.round(ww * 0.28), color: '#8E97A9', font: 'round' });
      if (s.poly && gn >= 3 && st !== 'stone') {
        g.rrect(-ww / 2 - 6, -hh / 2 - 10, ww * 0.62, ww * 0.26, 5, '#E8392E');
        g.text('多音字', -ww / 2 - 6 + ww * 0.31, -hh / 2 - 10 + ww * 0.13, { size: Math.round(ww * 0.16), color: '#FFFFFF', font: 'sans' });
      }
      if (gp.rec.u.retry && st === 'open') g.text('↻', -ww / 2 + 2, -hh / 2 + 2, { size: Math.round(ww * 0.3), color: '#FF7A30', font: 'round' });
      c.restore();
      // 当前目标：弹跳箭头
      if (isCur) {
        const ay = cy - hh / 2 * pop - 18 - Math.abs(Math.sin(S.bg * 5)) * 8;
        c.fillStyle = '#FFE45C'; c.strokeStyle = NAVY; c.lineWidth = 2.5;
        c.beginPath(); c.moveTo(cx - 11, ay - 10); c.lineTo(cx + 11, ay - 10); c.lineTo(cx, ay + 4); c.closePath(); c.fill(); c.stroke();
      }
    }
    function drawMark(c, t, x, y, s, col, lw) {
      const sh = SHAPE[t]; if (!sh) return;
      c.strokeStyle = col; c.lineWidth = lw; c.lineCap = 'round'; c.lineJoin = 'round';
      c.beginPath();
      sh.forEach((p, i) => { const px = x + p[0] * s, py = y + p[1] * s; if (i) c.lineTo(px, py); else c.moveTo(px, py); });
      c.stroke();
    }

    /* ================= 小龙 ================= */
    function drawDragon(c) {
      const r = S.r, s = L.rs;
      const x = X(r.x), y = Y(r.y);
      const over = g.state === 'over';
      const tt = over || g.state !== 'play' ? nowMs() / 1000 : r.anim;
      let hop = 0;
      if (over && S.endWin) hop = -Math.abs(Math.sin(tt * 7)) * 22 * s;
      const running = !over && r.mode === 'run' && r.spd > 20;
      const waiting = !over && r.mode === 'run' && r.wait > 0;
      const fever = g.combo >= 5 && !over;
      c.save();
      c.translate(x, y + hop);
      if (waiting) c.rotate(Math.sin(tt * 9) * 0.14);
      else c.rotate(r.tilt || 0);
      const sq = r.sq || 0;
      c.scale(s * (1 + 0.18 * sq), s * (1 - 0.2 * sq));
      if (fever) {   // 连击 ≥5：全身冒金光 + 身后火焰
        const gl = c.createRadialGradient(0, -26, 4, 0, -26, 44 + Math.sin(tt * 20) * 3);
        gl.addColorStop(0, 'rgba(255,230,120,.55)'); gl.addColorStop(1, 'rgba(255,170,40,0)');
        c.fillStyle = gl; c.beginPath(); c.arc(0, -26, 46, 0, TAU); c.fill();
        for (let i = 0; i < 4; i++) { c.fillStyle = ['#FF5A36', '#FF9A2E', '#FFD23F', '#FFF1A8'][i]; c.beginPath(); c.ellipse(-30 - i * 3, -24, 20 - i * 4 + Math.sin(tt * 30 + i) * 3, 9 - i * 2, 0, 0, TAU); c.fill(); }
      }
      const ph = running ? tt * TAU * (TREX.RUN_FPS / 5) : 0;   // 原作跑步两帧 12 帧/秒 → 连续摆腿
      const lwd = 2.6 / s;
      c.lineJoin = 'round'; c.lineCap = 'round';
      c.strokeStyle = NAVY; c.lineWidth = lwd;
      // 尾巴
      const wag = Math.sin(tt * (running ? 14 : 3)) * 3;
      c.fillStyle = PAL.body;
      c.beginPath(); c.moveTo(-8, -28); c.quadraticCurveTo(-28, -30, -40, -36 + wag); c.quadraticCurveTo(-30, -18, -8, -12); c.closePath(); c.fill(); c.stroke();
      // 后腿
      const leg = (hx, a, col) => {
        const fx = hx + Math.sin(a) * 9, fy = -Math.max(0, Math.cos(a)) * 5;
        c.strokeStyle = NAVY; c.lineWidth = 9; c.beginPath(); c.moveTo(hx, -12); c.lineTo(fx, fy - 3); c.stroke();
        c.strokeStyle = col; c.lineWidth = 9 - lwd * 2; c.beginPath(); c.moveTo(hx, -12); c.lineTo(fx, fy - 3); c.stroke();
        c.fillStyle = col; c.strokeStyle = NAVY; c.lineWidth = lwd; c.beginPath(); c.ellipse(fx + 3, fy - 2, 6, 3.6, 0, 0, TAU); c.fill(); c.stroke();
      };
      const air = !over && (r.mode === 'air' || r.mode === 'fall' || r.mode === 'toss');
      leg(-6, air ? -0.6 : ph + Math.PI, PAL.dark);
      // 背刺
      c.fillStyle = PAL.spike; c.strokeStyle = NAVY; c.lineWidth = lwd;
      [[-12, -33], [-4, -38], [4, -40]].forEach(([sx, sy]) => { c.beginPath(); c.moveTo(sx - 4, sy + 3); c.lineTo(sx, sy - 6); c.lineTo(sx + 4, sy + 3); c.closePath(); c.fill(); c.stroke(); });
      // 身体
      c.fillStyle = PAL.body; c.beginPath(); c.ellipse(0, -23, 17, 15, 0, 0, TAU); c.fill(); c.stroke();
      c.fillStyle = PAL.belly; c.beginPath(); c.ellipse(5, -19, 10, 10, 0, 0, TAU); c.fill();
      // 前腿
      leg(6, air ? 0.7 : ph, PAL.body);
      // 小手
      c.strokeStyle = NAVY; c.lineWidth = 6; c.beginPath(); c.moveTo(9, -24); c.lineTo(waiting ? 18 + Math.sin(tt * 18) * 4 : 16, waiting ? -34 : -19); c.stroke();
      c.strokeStyle = PAL.body; c.lineWidth = 6 - lwd * 2; c.beginPath(); c.moveTo(9, -24); c.lineTo(waiting ? 18 + Math.sin(tt * 18) * 4 : 16, waiting ? -34 : -19); c.stroke();
      // 头
      c.strokeStyle = NAVY; c.lineWidth = lwd;
      c.fillStyle = PAL.spike;
      c.beginPath(); c.moveTo(6, -48); c.lineTo(8, -58); c.lineTo(12, -49); c.closePath(); c.fill(); c.stroke();
      c.beginPath(); c.moveTo(13, -50); c.lineTo(17, -59); c.lineTo(19, -49); c.closePath(); c.fill(); c.stroke();
      c.fillStyle = PAL.body;
      c.beginPath(); c.arc(12, -39, 13, 0, TAU); c.fill(); c.stroke();
      c.beginPath(); c.ellipse(23, -35, 10, 7.5, 0, 0, TAU); c.fill(); c.stroke();
      c.fillStyle = PAL.body; c.beginPath(); c.arc(12, -39, 12 - lwd / 2, -0.2, 1.2); c.fill();
      // 围巾（红色，身后飘）
      const fl = Math.sin(tt * 16) * 3;
      c.fillStyle = '#E8392E'; c.strokeStyle = NAVY; c.lineWidth = lwd;
      c.beginPath(); c.moveTo(1, -31); c.quadraticCurveTo(-12, -34 + fl, -22, -30 + fl * 1.4); c.lineTo(-19, -24 + fl); c.quadraticCurveTo(-10, -27, 1, -25); c.closePath(); c.fill(); c.stroke();
      c.beginPath(); c.ellipse(4, -28, 10, 4, -0.15, 0, TAU); c.fill(); c.stroke();
      // 眼睛
      const blink = !over && r.blinkT < 0;
      if (blink) { c.strokeStyle = NAVY; c.lineWidth = 2.2 / s * 1.2; c.beginPath(); c.moveTo(12, -42); c.lineTo(20, -42); c.stroke(); }
      else if (!over && r.mode === 'sink') { c.strokeStyle = NAVY; c.lineWidth = 2; c.beginPath(); c.moveTo(12, -46); c.lineTo(19, -40); c.moveTo(19, -46); c.lineTo(12, -40); c.stroke(); }
      else {
        c.fillStyle = '#FFFFFF'; c.beginPath(); c.ellipse(16, -43, 5.5, 6.2, 0, 0, TAU); c.fill(); c.strokeStyle = NAVY; c.lineWidth = lwd * 0.8; c.stroke();
        c.fillStyle = NAVY; c.beginPath(); c.arc(17.6, -42.5, 3.1, 0, TAU); c.fill();
        c.fillStyle = '#FFFFFF'; c.beginPath(); c.arc(18.6, -44, 1.2, 0, TAU); c.fill();
      }
      c.fillStyle = PAL.cheek; c.beginPath(); c.arc(12, -33, 3.2, 0, TAU); c.fill();
      c.fillStyle = NAVY; c.beginPath(); c.arc(29, -37, 1.3, 0, TAU); c.fill();
      c.strokeStyle = NAVY; c.lineWidth = lwd * 0.8; c.beginPath();
      if (waiting || (!over && (r.mode === 'fall' || r.mode === 'sink'))) c.arc(24, -29, 3, Math.PI * 1.15, Math.PI * 1.85);
      else c.arc(24, -33, 4, Math.PI * 0.2, Math.PI * 0.85);
      c.stroke();
      c.restore();
      if (waiting) g.shadowText('！', x + 26 * s, y - 70 * s + Math.sin(tt * 10) * 3, { size: Math.round(30 * clamp(s, 0.8, 1.2)), color: '#FFE45C' });
      // 海豚救援
      if (!over && r.mode === 'toss' && r.t < 0.75) {
        const p = r.t / 0.75;
        g.emoji('🐬', x - 6 * s, y + 20 * s + Math.sin(p * Math.PI) * 6, 50 * s, { rot: -0.6 + p * 0.9, flip: true });
      }
    }
    function drawParts(c) {
      const k = L.k;
      for (const p of S.parts) {
        const a = 1 - p.age / p.life;
        if (p.k === 'dust') { c.fillStyle = 'rgba(255,245,225,' + (0.7 * a) + ')'; c.beginPath(); c.arc(X(p.x), Y(p.y), p.r * k * (1.4 - a * 0.4), 0, TAU); c.fill(); }
        else { c.strokeStyle = 'rgba(255,255,255,' + a + ')'; c.lineWidth = 1.5; c.beginPath(); c.arc(X(p.x), Y(p.y), p.r * k, 0, TAU); c.stroke(); }
      }
      for (const d of S.debris) {
        c.save(); c.translate(X(d.x), Y(d.y)); c.rotate(d.rot);
        c.fillStyle = '#C9877A'; c.strokeStyle = NAVY; c.lineWidth = 2;
        c.fillRect(-d.w * k / 2, -6 * k, d.w * k, 12 * k); c.strokeRect(-d.w * k / 2, -6 * k, d.w * k, 12 * k);
        c.restore();
      }
    }
    function drawFrontWater(c) {
      const T = THEMES[S.theme], w = g.w, wy = L.water, tt = S.bg;
      c.fillStyle = T.sea[1];
      c.globalAlpha = 0.55;
      c.beginPath(); c.moveTo(0, g.h);
      for (let x = 0; x <= w + 20; x += 20) c.lineTo(x, wy + Math.sin(x * 0.03 + tt * 2.4 + S.cam * L.k * 0.03) * 4);
      c.lineTo(w, g.h); c.closePath(); c.fill();
      c.globalAlpha = 1;
      c.strokeStyle = 'rgba(255,255,255,.7)'; c.lineWidth = 2.5;
      c.beginPath();
      for (let x = 0; x <= w + 20; x += 20) { const yy = wy + Math.sin(x * 0.03 + tt * 2.4 + S.cam * L.k * 0.03) * 4; if (x) c.lineTo(x, yy); else c.moveTo(x, yy); }
      c.stroke();
      // 水下的小鱼影子
      c.fillStyle = 'rgba(10,40,90,.25)';
      for (let i = 0; i < 4; i++) {
        const fx = ((hash(i * 5) * (w + 200) + tt * (20 + i * 9) - S.cam * L.k * 0.5) % (w + 200) + (w + 200)) % (w + 200) - 100;
        const fy = wy + 40 + hash(i * 3) * Math.max(20, L.legY - wy - 90);
        c.beginPath(); c.ellipse(fx, fy, 14, 5, 0, 0, TAU); c.fill();
        c.beginPath(); c.moveTo(fx - 12, fy); c.lineTo(fx - 22, fy - 6); c.lineTo(fx - 22, fy + 6); c.fill();
      }
    }

    /* ================= 界面：横幅 / 距离 / 图例 / 手势 ================= */
    function drawBanner(c) {
      const rec = S.active;
      if (!rec) return;
      const u = rec.u, n = u.syl.length, box = L.box, gap = Math.round(8 * L.ui);
      const spk = ttsOk();
      const innerW = n * box + (n - 1) * gap;
      const bw = Math.min(g.w - 16, innerW + Math.round(40 * L.ui) + (spk ? box : 0));
      const bx = (g.w - bw) / 2, by = L.bannerY, bh = L.bannerH;
      const pop = 1 + S.bannerPop * 0.06;
      c.save();
      c.translate(g.w / 2, by + bh / 2); c.scale(pop, pop); c.translate(-g.w / 2, -(by + bh / 2));
      g.rrect(bx, by + 4, bw, bh, 18, 'rgba(15,25,60,.35)');
      g.rrect(bx, by, bw, bh, 18, 'rgba(255,251,239,.96)', NAVY, 3);
      if (u.retry) {
        g.rrect(bx + 10, by - 12, Math.round(84 * L.ui), Math.round(22 * L.ui), 11, '#FF7A30', NAVY, 2);
        g.text('↻ 再来一次', bx + 10 + Math.round(42 * L.ui), by - 12 + Math.round(11 * L.ui), { size: Math.round(13 * L.ui), color: '#FFFFFF', font: 'round' });
      }
      const x0 = bx + (bw - innerW - (spk ? box * 0.9 : 0)) / 2;
      const cur = S.cursor >= 0 ? S.gaps[S.cursor] : null;
      for (let i = 0; i < n; i++) {
        const s = u.syl[i], gp = rec.gaps[i];
        const x = x0 + i * (box + gap), y = by + L.pyH + Math.round(8 * L.ui);
        const st = gp ? gp.st : (s.ask ? 'open' : 'stone');
        const isCur = gp && gp === cur;
        const bad = st === 'bad' || st === 'broke';
        const fill = st === 'stone' ? '#E6EAF1' : st === 'ok' ? TLIGHT[s.tone] : bad ? '#FFE0DE' : isCur ? '#FFF3B0' : '#FFFFFF';
        const edge = isCur ? '#FF9F1C' : st === 'ok' ? TCOL[s.tone] : bad ? '#E0484E' : '#9AA6BF';
        g.rrect(x, y, box, box, 10, fill, edge, isCur ? 3.5 : 2.2);
        // 田字格虚线
        c.strokeStyle = 'rgba(200,80,80,.25)'; c.lineWidth = 1; c.setLineDash([3, 3]);
        c.beginPath(); c.moveTo(x + box / 2, y + 3); c.lineTo(x + box / 2, y + box - 3); c.moveTo(x + 3, y + box / 2); c.lineTo(x + box - 3, y + box / 2); c.stroke(); c.setLineDash([]);
        g.text(s.ch, x + box / 2, y + box / 2 + 1, { size: Math.round(box * 0.72), font: 'kai', color: st === 'stone' ? '#6B7488' : NAVY, weight: 700 });
        const drawnOrStone = st !== 'open';
        let py = '', pc = '#44506A';
        if (drawnOrStone) { py = s.py; pc = st === 'stone' ? '#6B7488' : TDARK[s.tone]; }
        else if (S.cfg.showPy) py = s.bare;
        else py = '?';
        g.text(py, x + box / 2, by + Math.round(6 * L.ui) + L.pyH / 2 + 2, { size: Math.round(L.pyH * 0.85), font: 'py', color: pc, maxW: box + gap - 2 });
        if (isCur) {
          const ay = y + box + 3 + Math.abs(Math.sin(S.bg * 5)) * 3;
          c.fillStyle = '#FF9F1C'; c.beginPath(); c.moveTo(x + box / 2 - 7, ay + 7); c.lineTo(x + box / 2 + 7, ay + 7); c.lineTo(x + box / 2, ay); c.closePath(); c.fill();
        }
      }
      if (spk) {
        const sx = bx + bw - box * 0.62 - 6, sy = by + bh / 2 + 2, sr = box * 0.38;
        L.spk = { x: sx, y: sy, r: sr + 8 };
        c.fillStyle = g.speaking ? '#FFE45C' : '#4FB3FF'; c.beginPath(); c.arc(sx, sy, sr, 0, TAU); c.fill();
        c.strokeStyle = NAVY; c.lineWidth = 2.5; c.stroke();
        g.emoji('🔊', sx, sy, sr * 1.15);
      } else L.spk = null;
      c.restore();
    }
    function drawMeter(c) {
      const A = S.ach;
      if (A.on && A.t < TREX.FLASH_S) return;   // 闪烁的“暗”半拍
      const m = Math.floor(S.dist);
      const x = g.w - 12, y = L.bannerY + L.bannerH + Math.round(22 * L.ui);
      g.text(m + ' 米', x, y, { size: Math.round(17 * L.ui), font: 'round', color: A.on ? '#FFE45C' : '#FFFFFF', align: 'right', stroke: NAVY, strokeW: 3.5 });
    }
    function drawLegend(c) {
      const btn = pref.btn, tt = S.bg;
      // 画板提示区（任何地方都能画，这里只是给孩子一个“在这儿画”的地方）
      if (!btn) {
        const py0 = L.water + 26 * L.k, ph = L.toggle.y - 10 - py0;
        if (ph > 70) {
          g.rrect(12, py0, g.w - 24, ph, 22, S.stroke.on ? 'rgba(255,255,255,.14)' : 'rgba(255,255,255,.07)');
          c.strokeStyle = 'rgba(255,255,255,.4)'; c.lineWidth = 2; c.setLineDash([10, 9]);
          c.stroke(); c.setLineDash([]);
          if (!S.stroke.on) {
            const intro = S.t < 8 && g.level === 1 && pref.seen <= 3 && g.state === 'play';
            g.text(intro ? '✍️ 在这里画声调符号，给缺口铺桥' : '✍️ 在这里画声调', g.w / 2, py0 + ph / 2, { size: Math.round((intro ? 17 : 18) * L.ui), font: 'round', color: '#FFFFFF', alpha: intro ? 0.95 : 0.45, stroke: intro ? NAVY : '', strokeW: 4, maxW: g.w - 50 });
          }
        }
      }
      const alpha = btn ? 1 : (gn >= 4 && g.level > 3 ? 0.78 : 0.92);
      c.globalAlpha = alpha;
      for (const cell of L.cells) {
        const t = cell.t, x = cell.x, y = cell.y, w = cell.w, h = cell.h;
        const pressed = S.pressT > 0 && S.pressTone === t;
        if (btn) {
          g.rrect(x, y + (pressed ? 4 : 6), w, h - 4, 14, TDARK[t]);
          g.rrect(x, y + (pressed ? 4 : 0), w, h - 6, 14, TCOL[t], NAVY, 2.5);
        } else g.rrect(x, y, w, h, 12, 'rgba(255,255,255,.82)', TCOL[t], 2.5);
        const oy = btn && pressed ? 4 : 0;
        const ms = Math.min(w * (btn ? 0.17 : 0.2), h * 0.28);
        const mx = x + w * (btn ? 0.27 : 0.3), my = y + h * 0.45 + oy;
        drawMark(c, t, mx, my, ms, btn ? '#FFFFFF' : TCOL[t], btn ? 6 : 5);
        // 演示描画的小光点（不对应任何一道题，只教怎么画）
        const tapped = !btn && S.legendTap && S.legendTap.t === t && S.bg - S.legendTap.at < 1.6;
        if ((S.cfg.legendDemo || tapped) && !btn) {
          const sh = SHAPE[t], segs = sh.length - 1;
          const p = ((tt * 0.7 + t * 0.25) % 1.3) / 1.0;
          if (p <= 1) {
            const f = p * segs, si = Math.min(segs - 1, Math.floor(f)), q = f - si;
            const px = mx + lerp(sh[si][0], sh[si + 1][0], q) * ms, py = my + lerp(sh[si][1], sh[si + 1][1], q) * ms;
            c.fillStyle = '#FFFFFF'; c.beginPath(); c.arc(px, py, tapped ? 8 : 5, 0, TAU); c.fill(); c.strokeStyle = TDARK[t]; c.lineWidth = 2; c.stroke();
          }
        }
        g.text(TNAME[t], x + w * 0.7, y + h * 0.38 + oy, { size: Math.round(Math.min(16 * L.ui, w * 0.2)), font: 'round', color: btn ? '#FFFFFF' : TDARK[t] });
        g.text(String(t), x + w * 0.7, y + h * 0.72 + oy, { size: Math.round(12 * L.ui), font: 'num', color: btn ? 'rgba(255,255,255,.85)' : 'rgba(29,43,83,.55)' });
      }
      c.globalAlpha = 1;
      const tg = L.toggle;
      g.rrect(tg.x, tg.y, tg.w, tg.h, tg.h / 2, 'rgba(29,43,83,.7)', 'rgba(255,255,255,.8)', 1.5);
      g.text(btn ? '✍️ 改用手画' : '🔘 改用按钮', tg.x + tg.w / 2, tg.y + tg.h / 2 + 1, { size: Math.round(12.5 * L.ui), font: 'round', color: '#FFFFFF' });
    }
    function drawTrail(c) {
      const st = S.stroke;
      const draw = (pts, col, a, lw) => {
        if (pts.length < 2) return;
        c.globalAlpha = a; c.lineJoin = 'round'; c.lineCap = 'round';
        c.beginPath(); pts.forEach((p, i) => { if (i) c.lineTo(p.x, p.y); else c.moveTo(p.x, p.y); });
        c.strokeStyle = 'rgba(29,43,83,.55)'; c.lineWidth = lw + 6; c.stroke();
        c.strokeStyle = col; c.lineWidth = lw; c.stroke();
        c.globalAlpha = 1;
      };
      if (st.on) draw(st.pts, '#FFF6B0', 1, 9);
      if (S.trail) draw(S.trail.pts, S.trail.col, 1 - S.trail.t / 0.4, 9);
      for (const m of S.marks) {
        const e = m.t * m.t * (3 - 2 * m.t);
        const gp = m.gp;
        const tx = clamp(X((gp.x0 + gp.x1) / 2), -40, g.w + 40), ty = Y(0);
        const x = lerp(m.x0, tx, e), y = lerp(m.y0, ty, e) - Math.sin(e * Math.PI) * 60;
        const sc = 1 + Math.sin(e * Math.PI) * 0.4;
        c.fillStyle = m.ok ? 'rgba(255,240,150,.35)' : 'rgba(255,150,150,.35)'; c.beginPath(); c.arc(x, y, 26 * sc, 0, TAU); c.fill();
        drawMark(c, m.tone, x, y, 18 * sc, NAVY, 10);
        drawMark(c, m.tone, x, y, 18 * sc, TCOL[m.tone], 6);
      }
    }
    function drawFloats(c) {
      for (const f of S.floats) {
        const t = f.age / f.life;
        const a = t > 0.7 ? (1 - t) / 0.3 : 1;
        const sc = t < 0.12 ? 0.6 + t / 0.12 * 0.5 : t < 0.24 ? 1.1 - (t - 0.12) / 0.12 * 0.1 : 1;
        c.save(); c.translate(f.x, f.y); c.scale(sc, sc);
        g.text(f.text, 0, 0, { size: f.size, font: f.font, color: f.col, stroke: NAVY, strokeW: Math.max(3, f.size * 0.15), alpha: a, shadow: true });
        c.restore();
      }
    }

    /* ================= 输入 ================= */
    function hitToggle(p) { const t = L.toggle; return t && p.x >= t.x - 6 && p.x <= t.x + t.w + 6 && p.y >= t.y - 8 && p.y <= t.y + t.h + 6; }
    function hitCell(p) { for (const cl of L.cells) if (p.x >= cl.x && p.x <= cl.x + cl.w && p.y >= cl.y - 4 && p.y <= cl.y + cl.h + 4) return cl; return null; }
    function strokeEnd(p) {
      const st = S.stroke;
      if (!st.on) return;
      st.on = false;
      const pts = st.pts;
      if (p && pts.length && (Math.abs(p.x - pts[pts.length - 1].x) > 1 || Math.abs(p.y - pts[pts.length - 1].y) > 1)) pts.push({ x: p.x, y: p.y, t: nowMs() });
      const res = classify(pts);
      const last = pts[pts.length - 1] || { x: g.w / 2, y: g.h / 2 };
      if (res.tap) {
        if (L.spk && Math.hypot(last.x - L.spk.x, last.y - L.spk.y) <= L.spk.r) { sayRec(S.active); return; }
        const cl = !pref.btn && hitCell(last);
        if (cl) {   // 图例长得像按钮，孩子会去点：告诉他要“画”，并让这一格的演示光点放大、响一声这个声调的哨音
          S.legendTap = { t: cl.t, at: S.bg };
          toneWhistle(cl.t);
          S.hintT = -9; hint('用手指画 ' + MARK[cl.t] + '，不是点哦', cl.x + cl.w / 2, cl.y - 34);
          return;
        }
        if (ttsOk()) sayRec(S.active);
        else if (!S.noTtsHint) { S.noTtsHint = true; hint('画声调符号来铺桥（ˉ ˊ ˇ ˋ）', last.x, last.y - 30); }
        return;
      }
      if (res.bad) {
        S.trail = { pts: pts.slice(), t: 0, col: '#C8CED9' };
        hint(res.bad === 'small' ? '画大一点！' : '看不出是几声，再画一次', last.x, last.y - 30);
        return;
      }
      S.trail = { pts: pts.slice(), t: 0, col: TCOL[res.tone] };
      addFloat(MARK[res.tone] + ' ' + TNAME[res.tone], clamp(last.x, 60, g.w - 60), clamp(last.y - 40, g.hudTop + 30, g.h - 30), TCOL[res.tone], 24, 'round');
      applyTone(res.tone, last.x, last.y);
    }

    /* ================= 引擎回调 ================= */
    const api = { applyTone, classify, unitOf, pathY, cursorGap: () => (S.cursor >= 0 ? S.gaps[S.cursor] : null), activeRec: () => S.active };
    const spec = {
      maxLevel: 10,
      lives: P2 ? 5 : 3,
      rounds: roundsFor,
      music: 'bright',
      sky: null,
      name: '声调跑酷', icon: '🐲',
      intro: P2 ? '看字画声调，帮小龙铺桥过海！画错了桥会塌哦' : '看字画声调铺桥：画对小龙飞过去，画错桥就塌！',
      controls: '在屏幕上画声调（看底部图例）· 键盘 1 2 3 4 · 点一下 / 空格 听读音',
      init(gg) {
        g = gg;
        const lv = g.level;
        S = {
          cfg: cfgFor(lv), theme: cfgFor(lv).theme, t: 0, bg: 0, cam: 0, v: 0, v0: 0,
          queue: [], units: [], gaps: [], cursor: -1, cscan: 0, gi: 0, worldEnd: 0, active: null, bannerPop: 0,
          coins: [], parts: [], debris: [], marks: [], floats: [], trail: null, stroke: { on: false, pts: [] },
          r: { x: 0, y: 0, vy: 0, spd: 0, mode: 'idle', anim: 0, sq: 0, tilt: 0, blinkT: 1, wait: 0, dustT: 0, boost: 0, t: 0, why: '', fg: null, nagged: false },
          dist: 0, ach: { on: false, t: 0, n: 0, next: TREX.ACH_DIST }, hintT: -9, coinT: -9, pressT: 0, pressTone: 0, noTtsHint: false, empty: false, endWin: false
        };
        S.v0 = S.cfg.v0; S.v = S.v0; S.vMax = S.v0 * 1.3;
        layout();
        L.viewU = (g.w - L.RX) / L.k;
        const target = roundsFor(lv);
        S.queue = pickUnits(target);
        let sum = 0; S.queue.forEach((u) => { sum += u.askN; });
        if (!sum) { S.empty = true; g.rounds = 1; return; }
        g.rounds = sum;
        S.worldEnd = Math.max(S.v0 * (S.cfg.T + 1.3), L.viewU * 0.75);
        placeAhead();
        findCursor();
        S.active = activeRec();
        try { W.__hwTonerun = { g, S, L, api }; } catch (e) { /* ignore */ }
      },
      play() {
        if (S.empty) return;
        S.r.mode = 'run';
        if (S.cfg.autoSay && S.active) sayRec(S.active);
        if (g.level === 1 && pref.seen < 3) { pref.seen++; savePref(); }
      },
      update(gg, dt) {
        if (S.empty) return;
        S.t += dt; S.bg += dt;
        S.v = Math.min(S.vMax, S.v + S.v0 * TREX.ACCEL * dt);   // t-rex：匀加速直到上限
        L.viewU = (g.w - L.RX) / L.k;
        placeAhead();
        if (S.cursor < 0 || (S.gaps[S.cursor] && S.gaps[S.cursor].st !== 'open')) findCursor();
        checkActive();
        updRunner(dt);
        if (g.state !== 'play') return;
        crossings();
        if (g.state !== 'play') return;
        collectCoins();
        updParts(dt);
        distanceMeter(dt);
        if (S.pressT > 0) S.pressT -= dt;
      },
      draw(gg, c) {
        if (g.state !== 'play') { if (S.stroke && S.stroke.on) { S.stroke.on = false; S.stroke.pts = []; } S.bg += 1 / 60; if (g.state === 'over' && S.endWin === false && g.done >= g.rounds) S.endWin = true; }
        drawBack(c);
        if (S.empty) { g.shadowText('题目准备中', g.w / 2, g.h / 2, { size: 30, color: '#FFFFFF' }); return; }
        drawMeter(c);   // 先画：横屏矮屏时右上角的字卡会盖住它，而不是它压住字
        drawDeck(c);
        drawBridges(c);
        drawFinish(c);
        drawCoins(c);
        drawCards(c);
        drawParts(c);
        drawDragon(c);
        drawFrontWater(c);
        drawBanner(c);
        drawLegend(c);
        drawTrail(c);
        drawFloats(c);
      },
      down(gg, p) {
        auEnsure();
        if (S.empty) return;
        if (hitToggle(p)) { pref.btn = !pref.btn; savePref(); layout(); g.sfx('flip'); return; }
        if (pref.btn) { const cl = hitCell(p); if (cl) { S.pressT = 0.15; S.pressTone = cl.t; applyTone(cl.t, cl.x + cl.w / 2, cl.y); return; } }
        S.stroke.on = true; S.stroke.pts = [{ x: p.x, y: p.y, t: nowMs() }];
      },
      move(gg, p) {
        const st = S.stroke;
        if (!st.on || !p.down) return;
        const l = st.pts[st.pts.length - 1];
        if (Math.abs(p.x - l.x) + Math.abs(p.y - l.y) < 3) return;
        if (st.pts.length > 400) st.pts.splice(1, 1);
        st.pts.push({ x: p.x, y: p.y, t: nowMs() });
      },
      up(gg, p) { strokeEnd(p); },
      key(gg, k) {
        auEnsure();
        if (S.empty) return;
        if (k === '1' || k === '2' || k === '3' || k === '4') {
          const t = +k;
          S.pressT = 0.15; S.pressTone = t;
          const cl = L.cells[t - 1];
          applyTone(t, cl.x + cl.w / 2, cl.y);
        } else if (k === 'space' || k === 'enter') sayRec(S.active);
      },
      resize() { layout(); L.viewU = (g.w - L.RX) / L.k; },
      end() {
        AU.dead = true;
        try { if (AU.ac && AU.ac.close) AU.ac.close().catch(() => {}); } catch (e) { /* ignore */ }
        AU.ac = null;
        try { if (W.__hwTonerun && W.__hwTonerun.g === g) W.__hwTonerun = null; } catch (e) { /* ignore */ }
      }
    };
    return spec;
  }

  HW.register({
    id: 'tonerun', skill: 'listen', kind: 'arcade', name: '声调跑酷', icon: '🐲',
    blurb: '画出声调给小龙铺桥，画错桥会塌',
    cols: ['words'], data: ['words', 'chars'], reviewN: 8,
    start(ctx) {
      if (!HW.arcade || typeof HW.arcade.run !== 'function') {
        try { ctx.el.appendChild(ctx.h('div', { class: 'hw-card hw-center' }, '游戏引擎没有加载，先玩别的吧。')); } catch (e) { /* ignore */ }
        return undefined;
      }
      return HW.arcade.run(ctx, makeSpec(ctx));
    }
  });
})();
