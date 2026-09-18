/* =====================================================================
 * 华文小岛 2.0 · 🚀 声音火箭（parts/44_rocket.js）  skill: speak · 题库：readaloud + twisters
 *
 * 玩法：朗读段 / 绕口令拆成短句，下半屏是卡拉OK字幕，一颗跳跳球按年级语速逐字跳（跳到的字变亮）。
 *   有麦克风（getUserMedia 成功）：声音大小 = 火箭推力，说话喷火上升、安静下坠，读完一句结算燃料；
 *   没有麦克风（失败/拒绝立即降级，本页不再重复请求）：“节拍模式”——边大声读边在球落到字上时点 🔥（或空格），
 *   点准 → 字变成燃料球飞进火箭 → 推力。
 *   每句结算：燃料过线 → 火箭冲过一个里程碑（云层 → 飞机 → 卫星 → 目的地）；不够 → 熄火掉回来、扣一颗心、再读一次。
 *   每关 4 句；每 3 关一次“绕口令关”（显示题库拼音）；关卡越高：语速越快、句子越长、及格线越高、提示越少。
 * 只用 HW.arcade.run（parts/15_arcade.js）与 ctx；题目文字严格来自题库字段（text / py / hard / title）。
 * ===================================================================== */
(function () {
  'use strict';
  const W = window;
  const HW = W.HW;
  if (!HW || typeof HW.register !== 'function') return;

  const NAVY = '#1d2b53';
  const TAU = Math.PI * 2;
  const END_P = '。！？!?';
  const MID_P = '，、；：,;:…—';
  const CLOSE_P = '”’」』）)》';
  const OPEN_P = '“‘「『（(《';
  const NO_START = '，。！？、；：”’」』）)》…—,.!?;:';
  const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
  const lerp = (a, b, t) => a + (b - a) * t;
  const smooth = (t) => { t = clamp(t, 0, 1); return t * t * (3 - 2 * t); };
  const outBack = (t) => { const s = 1.70158, u = t - 1; return u * u * ((s + 1) * u + s) + 1; };
  const isHan = (ch) => /[㐀-鿿豈-﫿]/.test(ch);
  const rnd = (a, b) => a + Math.random() * (b - a);
  const nowMs = () => (W.performance && performance.now ? performance.now() : Date.now());
  let MIC_DENIED = false;   // 本页会话里请求失败/被拒过一次，就不再请求（不重复弹窗）

  const DEST = [
    { name: '月亮', key: 'moon' }, { name: '火星', key: 'mars' }, { name: '土星', key: 'saturn' }, { name: '木星', key: 'jupiter' }
  ];
  const destFor = (lv) => DEST[lv >= 10 ? 3 : lv >= 7 ? 2 : lv >= 4 ? 1 : 0];
  const STAGE_TXT = ['冲出云层！', '飞过飞机！', '越过卫星！'];
  const STAGE_ICON = ['☁️', '✈️', '🛰️'];

  /* ================= 题目 → 短句 ================= */
  function validRA(it) { return !!it && typeof it.text === 'string' && Array.from(it.text).some(isHan); }
  function validTW(it) { return !!it && typeof it.text === 'string' && typeof it.py === 'string' && Array.from(it.text).some(isHan); }
  function isRA(it) { return !!it && typeof it.text === 'string' && typeof it.title === 'string' && !Array.isArray(it.qs); }
  function isTW(it) { return !!it && typeof it.text === 'string' && typeof it.py === 'string' && it.title == null; }

  /* 字表：每个字带 py（绕口令用题库 py 逐字对应；朗读只给 hard 难读词注音），数不对就不注音 */
  function charList(text, pyStr, hard) {
    const cs = Array.from(String(text || '').replace(/[\s　]+/g, ''));
    const list = cs.map((ch) => ({ ch, han: isHan(ch), py: '', hard: false }));
    const hans = list.filter((c) => c.han);
    if (pyStr) {
      const syl = String(pyStr).trim().split(/\s+/).filter(Boolean);
      if (syl.length === hans.length) hans.forEach((c, i) => { c.py = syl[i]; });
    }
    if (Array.isArray(hard)) {
      for (const hd of hard) {
        if (!hd || typeof hd.w !== 'string' || typeof hd.py !== 'string') continue;
        const wc = Array.from(hd.w), syl = hd.py.trim().split(/\s+/).filter(Boolean);
        if (!wc.length || !wc.every(isHan) || syl.length !== wc.length) continue;
        for (let i = 0; i + wc.length <= list.length; i++) {
          let ok = true;
          for (let j = 0; j < wc.length; j++) if (list[i + j].ch !== wc[j]) { ok = false; break; }
          if (!ok) continue;
          for (let j = 0; j < wc.length; j++) { const c = list[i + j]; if (!c.py) { c.py = syl[j]; c.hard = true; } }
          i += wc.length - 1;
        }
      }
    }
    return list;
  }
  function hanIn(list, a, b) { let n = 0; for (let i = a; i < b; i++) if (list[i].han) n++; return n; }
  /* 分句到“小句”：逗号、句号等处断开，句末标点后的右引号归前句 */
  function clauseRanges(list) {
    const out = [];
    let a = 0;
    const PUN = END_P + MID_P + CLOSE_P;
    for (let i = 0; i < list.length; i++) {
      const ch = list[i].ch;
      if (END_P.includes(ch) || MID_P.includes(ch)) {
        let j = i;
        while (j + 1 < list.length && PUN.includes(list[j + 1].ch)) j++;
        let end = false;
        for (let k = i; k <= j; k++) if (END_P.includes(list[k].ch)) end = true;
        out.push({ a, b: j + 1, end });
        a = j + 1; i = j;
      }
    }
    if (a < list.length) out.push({ a, b: list.length, end: true });
    return out;
  }
  /* 小句合并成 minL..maxL 个汉字的短句；超长小句按字数均分 */
  function phraseRanges(list, minL, maxL) {
    const cl = [];
    for (const r of clauseRanges(list)) {
      const n = hanIn(list, r.a, r.b);
      if (n === 0) { if (cl.length) cl[cl.length - 1].b = r.b; continue; }
      if (n <= maxL + 2) { cl.push(r); continue; }
      const k = Math.ceil(n / maxL), per = Math.ceil(n / k);
      let cnt = 0, a = r.a, made = 0;
      for (let i = r.a; i < r.b; i++) {
        if (list[i].han) cnt++;
        if (cnt === per && made < k - 1) { cl.push({ a, b: i + 1, end: false }); a = i + 1; cnt = 0; made++; }
      }
      cl.push({ a, b: r.b, end: r.end });
    }
    const out = [];
    let cur = null;
    for (const r of cl) {
      const m = hanIn(list, r.a, r.b);
      if (!cur) { cur = { a: r.a, b: r.b, end: r.end, n: m }; continue; }
      if (cur.n < minL && cur.n + m <= maxL && (!cur.end || cur.n < 4)) { cur.b = r.b; cur.end = r.end; cur.n += m; }
      else { out.push(cur); cur = { a: r.a, b: r.b, end: r.end, n: m }; }
    }
    if (cur) {
      const last = out[out.length - 1];
      if (last && cur.n < Math.min(4, minL) && last.n + cur.n <= maxL + 3) { last.b = cur.b; last.n += cur.n; last.end = cur.end; } else out.push(cur);
    }
    return out;
  }
  function makePhrase(list, r, item, src, title) {
    const chars = [];
    for (let i = r.a; i < r.b; i++) chars.push(Object.assign({}, list[i], { i: i - r.a }));
    const hans = chars.filter((c) => c.han);
    return { item, src, title, text: chars.map((c) => c.ch).join(''), chars, hans, nHan: hans.length, hasPy: chars.some((c) => !!c.py), cell: 40, lineH: 60, br: 7, spring: { x: 0, landY: 0 }, lastT: 0 };
  }
  /* 断行：优先在标点后断，其次各行均匀；行首不放标点 */
  function smartLines(chars, cols) {
    const lines = [], n = chars.length, BRK = '，。！？、；：”’）》…—';
    let i = 0;
    while (i < n) {
      const rem = n - i;
      if (rem <= cols) { lines.push(chars.slice(i)); break; }
      const nl = Math.ceil(rem / cols);
      let take = Math.ceil(rem / nl);
      for (let k = Math.min(cols, rem - 1); k >= Math.max(2, Math.ceil(cols * 0.45)); k--) {
        // 标点处断行，但不能因此多出一行
        if (BRK.includes(chars[i + k - 1].ch) && !NO_START.includes(chars[i + k].ch) && rem - k <= (nl - 1) * cols) { take = k; break; }
      }
      while (i + take < n && NO_START.includes(chars[i + take].ch)) take++;
      lines.push(chars.slice(i, i + take)); i += take;
    }
    return lines;
  }
  function breakLines(chars, cols) {
    const lines = [];
    let cur = [];
    for (const c of chars) {
      if (cur.length >= cols && !NO_START.includes(c.ch)) { lines.push(cur); cur = []; }
      cur.push(c);
    }
    if (cur.length) lines.push(cur);
    for (let i = 0; i < lines.length - 1; i++) {   // 行尾不留开引号
      const ln = lines[i], last = ln[ln.length - 1];
      if (ln.length > 1 && OPEN_P.includes(last.ch)) lines[i + 1].unshift(ln.pop());
    }
    return lines;
  }

  /* ================= 麦克风（音量 → 推力） ================= */
  function micStart(P) {
    if (P.mic) return;
    const m = P.mic = { state: 'off', stream: null, ac: null, an: null, buf: null, lvl: 0, floor: 0.012, thr: 0.03, voiced: false };
    if (MIC_DENIED) { m.state = 'denied'; return; }
    const md = W.navigator && W.navigator.mediaDevices;
    const AC = W.AudioContext || W.webkitAudioContext;
    if (!md || typeof md.getUserMedia !== 'function' || !AC) { m.state = 'denied'; return; }
    try { m.ac = new AC(); } catch (e) { m.ac = null; m.state = 'denied'; return; }
    m.state = 'asking';
    let p;
    try { p = md.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } }); } catch (e) { p = Promise.reject(e); }
    Promise.resolve(p).then((stream) => {
      if (P.dead || !m.ac) { stopTracks(stream); return; }
      m.stream = stream;
      const src = m.ac.createMediaStreamSource(stream);
      const an = m.ac.createAnalyser();
      an.fftSize = 1024; an.smoothingTimeConstant = 0.1;
      src.connect(an);
      const z = m.ac.createGain(); z.gain.value = 0; an.connect(z); z.connect(m.ac.destination);   // Safari：分析器要接到 destination 才会跑
      m.an = an; m.buf = new Uint8Array(an.fftSize);
      try { if (m.ac.state === 'suspended' && m.ac.resume) m.ac.resume().catch(() => {}); } catch (e) { /* ignore */ }
      m.state = 'on';
    }).catch(() => {
      MIC_DENIED = true; m.state = 'denied';
      try { if (m.ac && m.ac.close) m.ac.close().catch(() => {}); } catch (e) { /* ignore */ }
      m.ac = null;
    });
  }
  function stopTracks(stream) { try { stream.getTracks().forEach((t) => { try { t.stop(); } catch (e) { /* ignore */ } }); } catch (e) { /* ignore */ } }
  function micStop(P) {
    const m = P.mic;
    if (!m) return;
    if (m.stream) stopTracks(m.stream);
    m.stream = null; m.an = null;
    try { if (m.ac && m.ac.close) m.ac.close().catch(() => {}); } catch (e) { /* ignore */ }
    m.ac = null;
    if (m.state === 'on' || m.state === 'asking') m.state = 'off';
  }
  function micResume(P) { const m = P.mic; try { if (m && m.ac && m.ac.state === 'suspended' && m.ac.resume) m.ac.resume().catch(() => {}); } catch (e) { /* ignore */ } }
  function micRead(m, dt, calibrate) {
    if (!m || m.state !== 'on' || !m.an) return 0;
    m.an.getByteTimeDomainData(m.buf);
    let s = 0, n = 0;
    for (let i = 0; i < m.buf.length; i += 2) { const v = (m.buf[i] - 128) / 128; s += v * v; n++; }
    const rms = Math.sqrt(s / Math.max(1, n));
    m.lvl = Math.max(rms, m.lvl * Math.exp(-dt * 7));
    // 噪声底：往下追得快、往上爬得慢（说话的字间空隙会把它拉回去；持续的环境噪声几秒后被当成底噪）
    const k = Math.min(1, dt * (rms < m.floor ? 4 : calibrate ? 0.25 : 0.12));
    m.floor += (rms - m.floor) * k;
    m.thr = clamp(m.floor * 2.6 + 0.012, 0.02, 0.3);
    m.voiced = m.lvl > m.thr;
    return m.lvl;
  }

  /* ================= 天空配色 / 星球 ================= */
  const SKY = [[-0.25, 214, 243, 255], [0, 162, 223, 255], [0.15, 88, 182, 247], [0.35, 48, 120, 220], [0.55, 27, 48, 130], [0.75, 13, 17, 62], [1, 7, 5, 32], [1.4, 3, 2, 18]];
  function skyCol(f) {
    let a = SKY[0], b = SKY[SKY.length - 1];
    if (f <= a[0]) b = a;
    else if (f < b[0]) { for (let i = 1; i < SKY.length; i++) if (f <= SKY[i][0]) { a = SKY[i - 1]; b = SKY[i]; break; } }
    else a = b;
    const t = b[0] === a[0] ? 0 : (f - a[0]) / (b[0] - a[0]);
    return 'rgb(' + Math.round(lerp(a[1], b[1], t)) + ',' + Math.round(lerp(a[2], b[2], t)) + ',' + Math.round(lerp(a[3], b[3], t)) + ')';
  }
  const PLANET = {
    moon: ['#FFFDF0', '#EFE8CC', '#BDB393'], mars: ['#FFC29A', '#EC6A3C', '#A33A1F'],
    saturn: ['#FFF0C4', '#EBC277', '#B98A47'], jupiter: ['#FFEBD2', '#E8A970', '#A9653A']
  };
  function drawPlanet(c, key, x, y, r, t, lw) {
    const col = PLANET[key] || PLANET.moon;
    c.save();
    if (r > 30) {
      const gl = c.createRadialGradient(x, y, r * 0.9, x, y, r * 1.45);
      gl.addColorStop(0, 'rgba(255,250,220,.38)'); gl.addColorStop(1, 'rgba(255,250,220,0)');
      c.fillStyle = gl; c.beginPath(); c.arc(x, y, r * 1.45, 0, TAU); c.fill();
    }
    if (key === 'saturn') {   // 后半个环
      c.strokeStyle = 'rgba(246,220,160,.9)'; c.lineWidth = r * 0.16;
      c.beginPath(); c.ellipse(x, y, r * 1.85, r * 0.42, -0.25, Math.PI, TAU); c.stroke();
    }
    const gr = c.createRadialGradient(x - r * 0.35, y - r * 0.35, r * 0.1, x, y, r);
    gr.addColorStop(0, col[0]); gr.addColorStop(0.55, col[1]); gr.addColorStop(1, col[2]);
    c.fillStyle = gr; c.beginPath(); c.arc(x, y, r, 0, TAU); c.fill();
    c.save();
    c.beginPath(); c.arc(x, y, r, 0, TAU); c.clip();
    const spin = (t * 0.035) % 1;
    if (key === 'moon' || key === 'mars') {
      const cr = key === 'moon' ? 'rgba(150,140,110,.35)' : 'rgba(120,30,10,.28)';
      c.fillStyle = cr;
      const cz = [[0.1, -0.3, 0.2], [0.55, 0.25, 0.16], [0.3, 0.55, 0.11], [0.8, -0.45, 0.12], [0.02, 0.35, 0.09], [0.68, 0.02, 0.07]];
      for (const q of cz) {
        let u = (q[0] + spin) % 1; const xx = x + (u * 2 - 1) * r * 1.25, yy = y + q[1] * r;
        c.beginPath(); c.arc(xx, yy, q[2] * r, 0, TAU); c.fill();
      }
      if (key === 'mars') { c.fillStyle = 'rgba(255,255,255,.85)'; c.beginPath(); c.ellipse(x, y - r * 0.93, r * 0.38, r * 0.14, 0, 0, TAU); c.fill(); }
    } else {
      const bands = key === 'saturn' ? [[-0.5, 0.1, 'rgba(160,110,50,.25)'], [-0.1, 0.12, 'rgba(255,255,255,.25)'], [0.3, 0.14, 'rgba(160,110,50,.28)']]
        : [[-0.6, 0.12, 'rgba(150,80,40,.3)'], [-0.25, 0.1, 'rgba(255,255,255,.3)'], [0.1, 0.16, 'rgba(160,80,40,.32)'], [0.5, 0.1, 'rgba(255,255,255,.25)']];
      for (const b of bands) { c.fillStyle = b[2]; c.fillRect(x - r, y + b[0] * r, r * 2, b[1] * r); }
      if (key === 'jupiter') {
        const u = (0.3 + spin) % 1;
        c.fillStyle = 'rgba(200,70,40,.7)'; c.beginPath(); c.ellipse(x + (u * 2 - 1) * r * 1.2, y + 0.24 * r, r * 0.2, r * 0.11, 0, 0, TAU); c.fill();
      }
    }
    c.fillStyle = 'rgba(255,255,255,.35)'; c.beginPath(); c.ellipse(x - r * 0.42, y - r * 0.45, r * 0.3, r * 0.17, -0.6, 0, TAU); c.fill();
    c.restore();
    c.lineWidth = lw || Math.max(1.5, r * 0.03); c.strokeStyle = NAVY; c.beginPath(); c.arc(x, y, r, 0, TAU); c.stroke();
    if (key === 'saturn') {   // 前半个环
      c.strokeStyle = 'rgba(250,228,170,.95)'; c.lineWidth = r * 0.16;
      c.beginPath(); c.ellipse(x, y, r * 1.85, r * 0.42, -0.25, 0, Math.PI); c.stroke();
    }
    c.restore();
  }

  /* ================= 火箭 ================= */
  /* 以喷口底部 (x, yb) 为锚点，H = 高度；flame 0..1 */
  function drawRocket(g, c, x, yb, H, rot, flame, avatar, t) {
    const cy = yb - H * 0.4;
    c.save();
    c.translate(x, cy); c.rotate(rot);
    const lw = Math.max(2, H * 0.022);
    c.lineJoin = 'round'; c.lineCap = 'round';
    // 火焰
    if (flame > 0.02) {
      const L = H * (0.14 + 0.66 * flame) * (1 + 0.13 * Math.sin(t * 41) + 0.08 * Math.sin(t * 23 + 1));
      const y0 = H * 0.38, hw = H * 0.13;
      const gl = c.createRadialGradient(0, y0 + L * 0.35, 0, 0, y0 + L * 0.35, L * 0.95);
      gl.addColorStop(0, 'rgba(255,200,80,' + (0.45 * flame + 0.1) + ')'); gl.addColorStop(1, 'rgba(255,140,40,0)');
      c.fillStyle = gl; c.beginPath(); c.arc(0, y0 + L * 0.35, L * 0.95, 0, TAU); c.fill();
      const lay = [[1, '#FF5A36'], [0.72, '#FFB020'], [0.42, '#FFF6C2']];
      for (const q of lay) {
        const k = q[0], wv = Math.sin(t * 30 + k * 5) * H * 0.012;
        c.fillStyle = q[1];
        c.beginPath();
        c.moveTo(-hw * k, y0);
        c.bezierCurveTo(-hw * k * 1.25, y0 + L * k * 0.45, -hw * k * 0.35 + wv, y0 + L * k * 0.8, wv, y0 + L * k);
        c.bezierCurveTo(hw * k * 0.35 + wv, y0 + L * k * 0.8, hw * k * 1.25, y0 + L * k * 0.45, hw * k, y0);
        c.closePath(); c.fill();
      }
    }
    // 尾翼
    c.fillStyle = '#F2544B'; c.strokeStyle = NAVY; c.lineWidth = lw;
    for (const sd of [-1, 1]) {
      c.beginPath();
      c.moveTo(sd * H * 0.19, H * 0.02);
      c.quadraticCurveTo(sd * H * 0.45, H * 0.15, sd * H * 0.42, H * 0.4);
      c.lineTo(sd * H * 0.16, H * 0.3);
      c.closePath(); c.fill(); c.stroke();
    }
    // 喷口
    c.fillStyle = '#5A6378';
    c.beginPath(); c.moveTo(-H * 0.11, H * 0.29); c.lineTo(H * 0.11, H * 0.29); c.lineTo(H * 0.145, H * 0.4); c.lineTo(-H * 0.145, H * 0.4); c.closePath(); c.fill(); c.stroke();
    // 机身
    const body = () => {
      c.beginPath();
      c.moveTo(0, -H * 0.5);
      c.bezierCurveTo(H * 0.25, -H * 0.43, H * 0.235, -H * 0.14, H * 0.215, H * 0.06);
      c.lineTo(H * 0.18, H * 0.3); c.lineTo(-H * 0.18, H * 0.3); c.lineTo(-H * 0.215, H * 0.06);
      c.bezierCurveTo(-H * 0.235, -H * 0.14, -H * 0.25, -H * 0.43, 0, -H * 0.5);
      c.closePath();
    };
    const bg = c.createLinearGradient(-H * 0.24, 0, H * 0.24, 0);
    bg.addColorStop(0, '#DDE3F2'); bg.addColorStop(0.35, '#FFFFFF'); bg.addColorStop(1, '#B9C3DD');
    body(); c.fillStyle = bg; c.fill();
    c.save(); body(); c.clip();
    c.fillStyle = '#F2544B'; c.fillRect(-H * 0.3, -H * 0.55, H * 0.6, H * 0.3);
    c.fillStyle = '#FFFFFF'; c.globalAlpha = 0.35; c.fillRect(-H * 0.09, -H * 0.5, H * 0.05, H * 0.24); c.globalAlpha = 1;
    c.fillStyle = '#F2544B'; c.fillRect(-H * 0.3, H * 0.13, H * 0.6, H * 0.055);
    c.fillStyle = '#FFD23F'; c.fillRect(-H * 0.3, H * 0.185, H * 0.6, H * 0.02);
    c.restore();
    body(); c.strokeStyle = NAVY; c.lineWidth = lw; c.stroke();
    c.beginPath(); c.moveTo(-H * 0.2, -H * 0.25); c.quadraticCurveTo(0, -H * 0.22, H * 0.2, -H * 0.25); c.stroke();
    // 中间尾翼
    c.fillStyle = '#C8392B';
    c.beginPath(); c.moveTo(-H * 0.03, H * 0.17); c.lineTo(H * 0.03, H * 0.17); c.lineTo(H * 0.03, H * 0.4); c.lineTo(-H * 0.03, H * 0.4); c.closePath(); c.fill(); c.stroke();
    // 舷窗 + 小乘客（档案头像）
    const wy = -H * 0.06, wr = H * 0.115;
    c.fillStyle = '#FFC928'; c.beginPath(); c.arc(0, wy, wr * 1.22, 0, TAU); c.fill(); c.stroke();
    const gg = c.createRadialGradient(-wr * 0.3, wy - wr * 0.3, 1, 0, wy, wr);
    gg.addColorStop(0, '#E4F6FF'); gg.addColorStop(1, '#6CC4F5');
    c.fillStyle = gg; c.beginPath(); c.arc(0, wy, wr, 0, TAU); c.fill();
    g.emoji(avatar, 0, wy + wr * 0.08, wr * 1.55);
    c.fillStyle = 'rgba(255,255,255,.6)'; c.beginPath(); c.ellipse(-wr * 0.38, wy - wr * 0.42, wr * 0.32, wr * 0.16, -0.6, 0, TAU); c.fill();
    c.lineWidth = lw * 0.9; c.strokeStyle = NAVY; c.beginPath(); c.arc(0, wy, wr, 0, TAU); c.stroke();
    c.restore();
  }

  /* ================= 注册 ================= */
  HW.register({
    id: 'rocket', skill: 'speak', kind: 'arcade', name: '声音火箭', icon: '🚀',
    blurb: '跟着跳跳球大声读，把火箭送上月球', needs: [], cols: ['readaloud', 'twisters'], reviewN: 3,
    start(ctx) { return HW.arcade.run(ctx, makeSpec(ctx)); }
  });

  function makeSpec(ctx) {
    const P = { mic: null, dead: false, musicOff: false, stars: null };
    const ttsOk = () => { try { return !!(ctx.tts && ctx.tts.ok); } catch (e) { return false; } };
    const avatar = (ctx.profile && ctx.profile.avatar) || '🐼';
    P.stars = [];
    for (let i = 0; i < 110; i++) P.stars.push({ x: Math.random(), y: Math.random(), z: rnd(0.3, 1), r: rnd(0.6, 2.1), ph: rnd(0, TAU), big: i % 13 === 0 });
    P.sparks = [];
    for (let i = 0; i < 16; i++) P.sparks.push({ x: Math.random(), y: Math.random(), ph: rnd(0, TAU), sp: rnd(6, 16) });
    P.lines = [];
    for (let i = 0; i < 18; i++) P.lines.push({ x: Math.random(), y: Math.random(), sp: rnd(0.6, 1.4), l: rnd(0.5, 1) });

    /* ---------- 布局 ---------- */
    function layout(g) {
      const R = g.rk, w = g.w, h = g.h;
      const wide = w >= 700 && w > h * 0.95;
      const s = clamp(Math.min(w / 390, h / 760), 0.9, 1.35);
      const top = g.hudTop;
      const splitY = Math.round(wide ? top + (h - top) * 0.56 : top + (h - top) * 0.47);
      const area = splitY - top;
      const L = { wide, s, splitY, area };
      L.rh = clamp(area * 0.4, 84, 176);
      L.rx = w / 2;
      L.padY = top + area * 0.86;
      L.flyY = top + area * 0.77;
      L.STAGE = Math.max(640, area * 2.1);
      const m = 12 * s;
      L.headY = splitY + 9 * s; L.headH = 28 * s;
      if (wide) {
        L.fireR = 52 * s; L.fireX = w - m - 16 * s - L.fireR; L.fireY = splitY + (h - splitY) * 0.56;
        L.tankW = 22 * s; L.tankH = L.fireR * 2 + 6 * s; L.tankX = L.fireX - L.fireR - 30 * s - L.tankW; L.tankY = L.fireY - L.tankH / 2;
        L.spkR = 32 * s; L.spkX = m + 14 * s + L.spkR; L.spkY = L.fireY;
        L.sx0 = L.spkX + L.spkR + 22 * s; L.sx1 = L.tankX - 22 * s;
        L.sy0 = L.headY + L.headH + 8 * s; L.sy1 = h - m - 4 * s;
        L.maxCell = 64 * s;
      } else {
        L.fireR = 44 * s; L.fireX = w / 2; L.fireY = h - m - 8 * s - L.fireR;
        L.spkR = 29 * s; L.spkX = Math.max(m + L.spkR + 10 * s, w * 0.2); L.spkY = L.fireY + 4 * s;
        L.tankW = 20 * s; L.tankH = L.fireR * 1.9; L.tankX = Math.min(w - m - 26 * s - L.tankW, w * 0.8 - L.tankW / 2); L.tankY = L.fireY - L.tankH / 2 + 4 * s;
        L.sx0 = m; L.sx1 = w - m;
        L.sy0 = L.headY + L.headH + 7 * s; L.sy1 = L.fireY - L.fireR - 14 * s;
        L.maxCell = 46 * s;
      }
      // 远景天际线（按宽度生成一次）
      L.city = [];
      let x = -10;
      while (x < w + 10) { const bw = rnd(18, 40) * s, bh = rnd(16, 52) * s; L.city.push({ x, w: bw, h: bh, win: Math.random() < 0.7 }); x += bw + rnd(2, 8) * s; }
      R.L = L;
      if (R.cur) placePhrase(g, R.cur);
    }
    function placePhrase(g, ph) {
      const L = g.rk.L, s = L.s;
      const W0 = L.sx1 - L.sx0 - 24 * s, H0 = L.sy1 - L.sy0 - 10 * s;
      let cell = L.maxCell, lines = null, lineH = 0;
      const n = ph.chars.length;
      const one = Math.min(L.maxCell, Math.floor(W0 / n));   // 一行放得下且字够大 → 单行（卡拉OK 最好读）
      if (one >= (L.wide ? 40 : 34) * s && one * (ph.hasPy ? 2.0 : 1.55) <= H0) {
        cell = one; lineH = cell * (ph.hasPy ? 2.0 : 1.55); lines = [ph.chars.slice()];
      } else {
        let best = null;
        for (; cell >= 18; cell -= 2) {
          const lh = cell * (ph.hasPy ? 2.0 : 1.55);
          const cols = Math.max(3, Math.floor(W0 / cell));
          const ls = smartLines(ph.chars, cols);
          if (ls.length * lh <= H0 && ls.every((l) => l.length * cell <= W0 + cell * 1.1)) {
            if (!best || ls.length < best.lines.length) best = { cell, lh, lines: ls };   // 字号小一点能少一行就少一行
            if (cell < best.cell * 0.86 || ls.length === 1) break;
          }
        }
        if (best) { cell = best.cell; lineH = best.lh; lines = best.lines; }
        else { cell = 18; lineH = cell * (ph.hasPy ? 2.0 : 1.55); lines = smartLines(ph.chars, Math.max(3, Math.floor(W0 / cell))); }
      }
      const totalH = lines.length * lineH;
      let y = L.sy0 + 5 * s + Math.max(0, (H0 - totalH) / 2);
      const br = clamp(cell * 0.16, 5, 10);
      lines.forEach((ln, li) => {
        const lw = ln.length * cell;
        let x = (L.sx0 + L.sx1) / 2 - lw / 2 + cell / 2;
        for (const c of ln) {
          c.x = x; c.line = li;
          if (ph.hasPy) { c.pyY = y + cell * 0.57; c.y = y + cell * 1.3; c.landY = y + cell * 0.35 - br; }
          else { c.pyY = y + cell * 0.3; c.y = y + cell * 0.9; c.landY = y + cell * 0.4 - br; }
          x += cell;
        }
        y += lineH;
      });
      ph.cell = cell; ph.lineH = lineH; ph.br = br;
      const f = ph.hans[0];
      if (f) {
        let sx = f.x - cell * 0.95;
        if (sx < L.sx0 + br + 6) sx = f.x;
        ph.spring = { x: sx, landY: f.landY };
      }
    }
    function timePhrase(R, ph) {
      let cur = R.ci;
      for (const c of ph.chars) {
        if (c.han) { c.t = cur; cur += R.beat; ph.lastT = c.t; }
        else { c.t = -1; if (END_P.includes(c.ch)) cur += R.beat * 0.7; else if (MID_P.includes(c.ch)) cur += R.beat * 0.45; }
      }
      ph.t0 = ph.hans.length ? ph.hans[0].t : R.ci;
    }
    function resetChars(ph) { for (const c of ph.chars) { c.st = 0; c.lit = false; c.pop = 0; c.vf = 0; c.vv = 0; c.q = 0; } }

    /* ---------- 关卡题目 ---------- */
    function buildLevel(g) {
      const R = g.rk, lv = g.level;
      const gn = clamp(Math.floor(+g.gradeNum || 3), 2, 6);
      let minL = [6, 7, 8, 9, 10][gn - 2] + Math.floor((lv - 1) / 4);
      let maxL = [12, 14, 15, 16, 18][gn - 2] + Math.floor((lv - 1) / 3);
      if (!R.L.wide) maxL = Math.min(maxL, 16);
      minL = Math.min(minL, maxL - 3);
      let raPool, twPool;
      if (g.isReview) {
        const rv = Array.isArray(ctx.review) ? ctx.review : [];
        raPool = rv.filter((it) => isRA(it) && validRA(it)); twPool = rv.filter((it) => isTW(it) && validTW(it));
      } else {
        raPool = (g.G.readaloud || []).filter(validRA); twPool = (g.G.twisters || []).filter(validTW);
      }
      let src = lv % 3 === 0 ? 'tw' : 'ra';
      if (src === 'tw' && !twPool.length) src = 'ra';
      if (src === 'ra' && !raPool.length) src = 'tw';
      const want = 4;
      const phrases = [];
      if ((src === 'ra' && raPool.length) || (src === 'tw' && twPool.length)) {
        const col = src === 'tw' ? 'twisters' : 'readaloud';
        const items = (g.items(col, src === 'tw' ? 3 : 2) || []).filter(src === 'tw' ? validTW : validRA);
        for (let k = 0; k < items.length && phrases.length < want; k++) {
          const it = items[k];
          const list = charList(it.text, src === 'tw' ? it.py : null, src === 'ra' ? it.hard : null);
          const rs = phraseRanges(list, minL, maxL).filter((r) => hanIn(list, r.a, r.b) > 0);
          let start = 0;
          if (src === 'ra' && k === 0 && rs.length > want) {
            const cands = [0];
            for (let i = 1; i + want <= rs.length; i++) if (rs[i - 1].end) cands.push(i);
            start = cands[Math.floor(Math.random() * cands.length)];
          }
          for (let i = start; i < rs.length && phrases.length < want; i++) phrases.push(makePhrase(list, rs[i], it, src, src === 'tw' ? '绕口令' : (it.title || '朗读')));
        }
      }
      R.phrases = phrases; R.src = src;
      g.rounds = Math.max(1, Math.min(want, phrases.length));
      const cps = [1.6, 1.8, 2.0, 2.2, 2.4][gn - 2] * (1 + 0.075 * (lv - 1)) * (src === 'tw' ? 1.06 : 1);
      R.cps = cps; R.beat = 1 / cps;
      R.ci = clamp(R.beat, 0.42, 0.7);
      R.perfW = Math.min(0.11, R.beat * 0.3);
      R.goodW = Math.min(0.22, R.beat * 0.46);
      R.pass = Math.min(0.7, 0.5 + 0.025 * (lv - 1));
      R.autoDemo = lv <= 2;
      R.rings = lv <= 6;
      R.dest = destFor(lv);
    }
    function genWorld(g) {
      const R = g.rk, lv = g.level;
      const cl = [];
      for (let i = 0; i < 12; i++) cl.push({ u: rnd(0.76, 0.92), x: (i + rnd(0, 0.7)) / 12, s: rnd(1.1, 1.8), d: rnd(0.9, 1.3), a: 0.96, v: rnd(4, 10) });
      for (let i = 0; i < 16; i++) cl.push({ u: rnd(0.16, 1.6), x: Math.random(), s: rnd(0.45, 1.1), d: rnd(0.5, 1.05), a: 0.8, v: rnd(6, 18) });
      for (let i = 0; i < 6; i++) cl.push({ u: rnd(1.7, 2.3), x: Math.random(), s: rnd(0.8, 1.4), d: 0.6, a: 0.3, v: rnd(2, 5) });
      cl.sort((a, b) => a.d - b.d);
      R.clouds = cl;
      R.birds = [];
      for (let i = 0; i < 5; i++) R.birds.push({ u: rnd(0.1, 0.55), x: Math.random(), v: rnd(22, 40) * (i % 2 ? 1 : -1), ph: rnd(0, TAU) });
      R.sats = [{ u: 2.3, x: 0.22, v: 12, r: 0 }, { u: 2.62, x: 0.72, v: -9, r: 1 }, { u: 2.92, x: 0.45, v: 7, r: 2 }];
      R.ufo = lv >= 4;
      R.metRate = clamp(3.2 - lv * 0.2, 0.9, 3);
    }

    /* ---------- 状态机 ---------- */
    function newState() {
      return {
        L: null, phrases: [], idx: 0, cur: null, src: 'ra', ph: 'intro', phT: 0, cT: 0, rt: 0, rtEnd: 0,
        fuel: 0, hits: 0, streak: 0, lastHitRt: -9, lastVoice: -9, totalHits: 0,
        stage: 0, climb: 0, climbT: 0, alt: 0, cam: 0, fly: 'read', flame: 0, kick: 0, thrust: 0, sputter: 0, boostV: 0,
        launched: false, armA: 0, flag: false, clock: 0, lastNow: 0, lastY0: null,
        puffs: [], meteors: [], metT: 2, orbs: [], banners: [],
        cardIn: 1, cardDur: 1, cardOut: 0, cardShake: 0, btnPress: 0, spkPress: 0, demoing: false, demoTok: 0, readyWait: 1,
        started: false, micOn: false, fuelFull: false, readFlash: 0, tipDone: false, ball: { x: 0, y: 0, sq: 1 }
      };
    }
    function setPhrase(g, i) {
      const R = g.rk;
      R.cur = R.phrases[i] || null;
      if (!R.cur) return;
      placePhrase(g, R.cur);
      timePhrase(R, R.cur);
      resetChars(R.cur);
    }
    function banner(g, text, o) {
      const R = g.rk;
      o = o || {};
      R.banners.push({ text, t: 0, dur: o.dur || 1.5, col: o.col || '#FFE45C', size: o.size || 34, dy: o.dy || 0 });
      if (R.banners.length > 3) R.banners.shift();
    }
    function startFlow(g) {
      const R = g.rk;
      if (!R || R.started) return;
      R.started = true;
      if (!R.phrases.length) { banner(g, '题目还在准备中', { col: '#FFFFFF', dur: 3 }); g.after(2.2, () => g.lose()); return; }
      banner(g, '🎯 目标：' + R.dest.name + '！', { dur: 1.8 });
      if (R.src === 'tw') banner(g, '👅 绕口令关', { dur: 1.8, col: '#FFB3D9', size: 26, dy: -44 });
      readyPhrase(g, false, true);
    }
    function readyPhrase(g, retry, noAnim) {
      const R = g.rk;
      if (g.state !== 'play') return;
      if (!retry && !noAnim) setPhrase(g, R.idx);
      if (!R.cur) return;
      resetChars(R.cur);
      R.ph = 'ready'; R.phT = 0; R.cT = 0; R.rt = 0; R.rtEnd = 0; R.fuel = 0; R.hits = 0; R.streak = 0;
      R.lastHitRt = -9; R.lastVoice = -9; R.cardOut = 0; R.fuelFull = false; R.readFlash = 0;
      R.cardDur = 0.5 + R.cur.chars.length * 0.03;
      if (noAnim) R.cardIn = 1;
      else { R.cardIn = 0; g.tween(R, { cardIn: 1 }, R.cardDur, 'linear'); }
      R.readyWait = retry ? 0.9 : (R.idx === 0 ? 1.5 : 1.0);
      R.demoing = false; R.demoTok++;
      if (R.autoDemo && !retry && ttsOk()) playDemo(g);
    }
    function playDemo(g) {
      const R = g.rk;
      if (!R.cur || !ttsOk()) return;
      R.demoTok++;
      const tok = R.demoTok;
      R.demoing = true; R.spkPress = 1;
      g.say(R.cur.text).then(() => {
        if (tok !== R.demoTok || g.rk !== R) return;
        R.demoing = false;
        R.phT = Math.max(0, R.readyWait - 0.7);
      });
    }
    function stopDemo(g) {
      const R = g.rk;
      if (!R.demoing) return;
      R.demoTok++; R.demoing = false;
      try { ctx.tts.stop(); } catch (e) { /* ignore */ }
    }
    function startCount(g) {
      const R = g.rk;
      stopDemo(g);
      R.ph = 'count'; R.cT = 0;
      g.sfx('tick');
    }
    function startRun(g) {
      const R = g.rk;
      R.ph = 'run'; R.rt = 0;
    }
    function fire(g) {
      const R = g.rk;
      if (!R || !R.cur || g.state !== 'play') return;
      R.btnPress = 1;
      if (R.ph === 'ready') { startCount(g); return; }
      if (R.ph !== 'run') return;
      const ph = R.cur, rt = R.rt;
      let best = null, bd = 1e9;
      for (const c of ph.hans) {
        if (c.st) continue;
        const d = Math.abs(rt - c.t);
        if (d < bd) { bd = d; best = c; }
        if (c.t > rt + R.goodW) break;
      }
      if (best && bd <= R.goodW) judge(g, best, bd <= R.perfW ? 1 : 2, 'tap');
      else misfire(g);
    }
    function judge(g, c, kind, via) {
      const R = g.rk, ph = R.cur, L = R.L, s = L.s;
      c.st = kind; c.pop = 1; c.lit = true;
      const q = kind === 1 ? 1 : via === 'mic' ? 0.85 : 0.7;
      c.q = q;
      const was = R.fuel;
      R.fuel = clamp(R.fuel + q / ph.nHan, 0, 1);
      R.hits++; R.streak++; R.totalHits++;
      R.lastHitRt = R.rt;
      g.addScore(kind === 1 ? 5 : 3);
      const py = c.y - ph.cell * (ph.hasPy ? 1.2 : 0.85);
      if (kind === 1) {
        g.sfx('coin');
        g.float('完美', c.x, py, { color: '#FFE45C', size: 19 * s, life: 0.7 });
        g.burst(c.x, c.y, { kind: 'star', n: 5, color: '#FFD23F' });
      } else {
        g.sfx('bubble');
        g.float(via === 'mic' ? '读到' : '好', c.x, py, { color: '#B8F5A0', size: 17 * s, life: 0.6 });
        g.burst(c.x, c.y, { kind: 'spark', n: 6, color: '#FFE9A0' });
      }
      if (R.streak >= 5 && R.streak % 5 === 0) { g.float('🔥×' + R.streak, L.fireX, L.fireY - L.fireR - 18 * s, { color: '#FFB347', size: 24 * s }); g.sfx('combo'); }
      if (was < R.pass && R.fuel >= R.pass && !R.fuelFull) {
        R.fuelFull = true;
        g.float('燃料够啦！', L.tankX + L.tankW / 2, L.tankY - 14 * s, { color: '#7CFF8A', size: 18 * s, life: 1 });
        g.ring(L.tankX + L.tankW / 2, L.tankY + L.tankH / 2, '#7CFF8A', 60 * s);
      }
      R.orbs.push({ x0: c.x, y0: c.y, t: 0, dur: 0.42, q: via === 'mic' ? q * 0.5 : q, x: c.x, y: c.y });
      if (R.orbs.length > 30) R.orbs.shift();
      if (R.totalHits >= 3) R.tipDone = true;
    }
    function misfire(g) {
      const R = g.rk, L = R.L, s = L.s, ph = R.cur;
      R.fuel = clamp(R.fuel - 0.4 / ph.nHan, 0, 1);
      R.streak = 0;
      g.sfx('chomp');
      const b = R.ball;
      g.float(R.rt < ph.t0 - R.goodW ? '还没到' : '没对准', b.x, b.y - 26 * s, { color: '#D6E2FF', size: 16 * s, life: 0.6 });
      R.puffs.push({ x: L.fireX + rnd(-10, 10), y: L.fireY - L.fireR * 0.6, vx: rnd(-30, 30), vy: -rnd(40, 80), r: 8 * s, gr: 30 * s, age: 0, life: 0.6, col: 180, screen: true });
    }
    function miss(g, c) {
      const R = g.rk;
      c.st = 3; c.lit = true;
      R.streak = 0;
      g.burst(c.x, c.y, { kind: 'dot', color: '#8A98C8', n: 4 });
    }
    function endPhrase(g) {
      const R = g.rk, ph = R.cur;
      R.rtEnd = R.rt;
      for (const c of ph.hans) if (!c.st) miss(g, c);
      if (R.fuel >= R.pass - 1e-6) success(g); else fail(g);
    }
    function rocketPos(g, out) {
      const R = g.rk, L = R.L;
      const yb = Ymap(R, R.alt, 1);
      out.x = L.rx + (R.alt > 0.004 ? Math.sin(R.clock * 1.1) * 3 * L.s : 0);
      out.yb = yb; out.cy = yb - L.rh * 0.4;
      return out;
    }
    const RP = { x: 0, yb: 0, cy: 0 };
    function success(g) {
      const R = g.rk, ph = R.cur, L = R.L;
      R.ph = 'result'; R.fly = 'boost'; R.orbs.length = 0;
      const last = g.done + 1 >= g.rounds;
      const label = R.fuel >= 0.92 ? '完美发射！' : R.fuel >= 0.75 ? '漂亮！' : '发射成功！';
      R.stampT = 0; R.stampPct = Math.round(R.fuel * 100); R.stampLabel = label;
      g.sfx('power'); g.after(0.18, () => g.sfx('whoosh'));
      g.shake(5);
      R.boostV = 1;
      R.cardOut = 0; g.tween(R, { cardOut: 1 }, 0.7, 'linear');
      const to = R.stage + 1;
      rocketPos(g, RP);
      if (!last) g.right(ph.item, RP.x, RP.cy - L.rh * 0.2, label);
      else g.float(label, RP.x, RP.cy - L.rh * 0.45, { color: '#FFE45C', size: 32 * L.s });
      g.after(last ? 0.75 : 0.45, () => {
        if (to <= 3) { banner(g, STAGE_TXT[to - 1], { dur: 1.2 }); g.sfx('star'); }
      });
      g.tween(R, { alt: to }, last ? 1.6 : 1.2, 'inOutQuad', () => {
        R.stage = to; R.alt = to; R.climb = 0; R.climbT = 0; R.fly = 'read';
        if (last) {
          R.flag = true; R.ph = 'done';
          banner(g, '到达' + R.dest.name + '！', { dur: 2.5, size: 40 });
          rocketPos(g, RP);
          g.burst(RP.x, RP.cy - L.rh * 0.55, { kind: 'star', n: 24 });
          g.right(ph.item, RP.x, RP.cy - L.rh * 0.2, '🚩 登陆！');
        } else { R.idx++; readyPhrase(g, false); }
      });
    }
    function noteFor(R, ph) {
      const han = ph.hans;
      let py = '';
      if (ph.src === 'tw' && han.every((c) => c.py)) py = '（' + han.map((c) => c.py).join(' ') + '）';
      const hard = [];
      if (ph.src === 'ra' && ph.item && Array.isArray(ph.item.hard)) {
        for (const hd of ph.item.hard) if (hd && typeof hd.w === 'string' && typeof hd.py === 'string' && ph.text.indexOf(hd.w) >= 0) hard.push(hd.w + ' ' + hd.py);
      }
      const who = ph.src === 'tw' ? '绕口令' : '朗读《' + ph.title + '》';
      const how = R.micOn ? '声音没跟上跳跳球' : '没跟上节拍';
      return who + '：“' + ph.text + '”' + py + (hard.length ? '；难读词：' + hard.join('，') : '') + ' —— ' + how + '（跟上 ' + R.hits + '/' + ph.nHan + ' 个字），要大声跟读一遍';
    }
    function fail(g) {
      const R = g.rk, ph = R.cur, L = R.L;
      R.ph = 'result'; R.fly = 'fall'; R.orbs.length = 0;
      R.sputter = 1.3; R.cardShake = 1;
      rocketPos(g, RP);
      g.sfx('crash');
      for (let i = 0; i < 14; i++) R.puffs.push({ x: RP.x + rnd(-L.rh * 0.2, L.rh * 0.2), y: RP.yb - rnd(0, L.rh * 0.3), vx: rnd(-90, 90), vy: rnd(-60, 40), r: rnd(8, 16) * L.s, gr: rnd(30, 60) * L.s, age: 0, life: rnd(0.9, 1.5), col: 110 });
      banner(g, '熄火啦！再读一次', { col: '#9FD4FF', dur: 1.3 });
      g.wrong(ph.item, noteFor(R, ph), RP.x, RP.cy);
      if (g.state === 'play') {
        g.tween(R, { alt: R.stage }, 0.9, 'outBounce', () => { R.fly = 'read'; R.climb = 0; R.climbT = 0; });
        g.after(1.5, () => readyPhrase(g, true));
      } else {
        g.tween(R, { alt: 0 }, 2.2, 'inQuad');
      }
    }

    /* ---------- 相机映射 ---------- */
    function Ymap(R, a, d) {
      const L = R.L;
      const shift = smooth(R.cam * 5) * (L.padY - L.flyY);
      return L.padY - shift - (a - R.cam) * L.STAGE * (d == null ? 1 : d);
    }

    /* ---------- 视觉时钟（每帧真实时间，倒计时/结算动画期间也走） ---------- */
    function visTick(g, dt) {
      const R = g.rk, L = R.L, S = L.STAGE;
      R.clock += dt;
      // 相机跟随（有延迟，推进时火箭会在屏幕上冲高一点）
      const k = Math.min(1, dt * (R.fly === 'boost' ? 2.4 : 3.4));
      R.cam += (R.alt - R.cam) * k;
      const maxUp = Math.max(L.area * 0.05, L.flyY - L.rh - (g.hudTop + L.area * 0.4)) / S, maxDn = (L.splitY - L.flyY + L.rh * 0.1) / S;
      if (R.alt - R.cam > maxUp) R.cam = R.alt - maxUp;
      if (R.cam - R.alt > maxDn) R.cam = R.alt + maxDn;
      const y0 = Ymap(R, 0, 1);
      const dCam = R.lastY0 == null ? 0 : y0 - R.lastY0;
      R.lastY0 = y0;
      // 火焰
      const onPad = R.stage === 0 && R.alt < 0.004;
      let ft;
      if (R.fly === 'boost') ft = 1;
      else if (R.fly === 'fall') ft = R.sputter > 0 && Math.random() < 0.25 ? 0.4 : 0;
      else if (onPad) ft = R.kick * 0.9;
      else if (R.ph === 'run') ft = Math.max(0.3, R.kick, R.micOn ? R.thrust : 0);
      else if (R.ph === 'done') ft = 0.35;
      else ft = 0.3;
      if (g.state === 'over' && R.ph !== 'done' && R.fly !== 'boost') ft = R.fly === 'fall' ? ft : 0;
      R.flame += (ft - R.flame) * Math.min(1, dt * 12);
      R.kick = Math.max(0, R.kick - dt * 2.2);
      R.sputter = Math.max(0, R.sputter - dt);
      R.boostV = R.fly === 'boost' ? Math.min(1, R.boostV + dt * 3) : Math.max(0, R.boostV - dt * 1.6);
      R.btnPress = Math.max(0, R.btnPress - dt * 7);
      R.spkPress = Math.max(0, R.spkPress - dt * 5);
      R.cardShake = Math.max(0, R.cardShake - dt * 1.4);
      R.readFlash = Math.max(0, R.readFlash - dt);
      R.stampT = (R.stampT || 0) + dt;
      if (R.cur) for (const c of R.cur.chars) if (c.pop > 0) c.pop = Math.max(0, c.pop - dt * 3.2);
      // 起飞
      if (!R.launched && R.alt > 0.006) {
        R.launched = true;
        banner(g, '点火！升空！', { dur: 1.1, col: '#FFB347' });
        g.sfx('whoosh');
        g.tween(R, { armA: 1 }, 0.8, 'outBack');
        for (let i = 0; i < 16; i++) R.puffs.push({ x: L.rx + rnd(-L.rh * 0.6, L.rh * 0.6), y: y0 - rnd(0, 14), vx: rnd(-160, 160), vy: rnd(-40, 10), r: rnd(10, 18) * L.s, gr: rnd(40, 70) * L.s, age: 0, life: rnd(1, 1.8), col: 235 });
      }
      // 烟
      rocketPos(g, RP);
      if (R.flame > 0.05) {
        const n = dt * (14 + 46 * R.flame);
        R.puffAcc = (R.puffAcc || 0) + n;
        while (R.puffAcc >= 1) {
          R.puffAcc -= 1;
          const fl = L.rh * (0.14 + 0.66 * R.flame);
          R.puffs.push({ x: RP.x + rnd(-6, 6) * L.s, y: RP.yb + fl * rnd(0.55, 0.9), vx: rnd(-50, 50), vy: rnd(30, 90), r: rnd(5, 9) * L.s * (0.6 + R.flame * 0.6), gr: rnd(26, 46) * L.s, age: 0, life: rnd(0.7, 1.2), col: 240 });
        }
      } else if (onPad && g.state !== 'over') {
        R.steamT = (R.steamT || 0) - dt;
        if (R.steamT <= 0) {
          R.steamT = rnd(0.12, 0.3);
          const sd = Math.random() < 0.5 ? -1 : 1;
          R.puffs.push({ x: L.rx + sd * L.rh * rnd(0.35, 0.55), y: y0 - 4, vx: sd * rnd(20, 60), vy: -rnd(20, 50), r: rnd(5, 9) * L.s, gr: rnd(14, 26) * L.s, age: 0, life: rnd(0.8, 1.4), col: 250 });
        }
      }
      for (let i = R.puffs.length - 1; i >= 0; i--) {
        const p = R.puffs[i];
        p.age += dt;
        if (p.age >= p.life) { R.puffs.splice(i, 1); continue; }
        p.x += p.vx * dt; p.y += p.vy * dt + (p.screen ? 0 : dCam);
        p.vx *= Math.exp(-dt * 1.5); p.vy *= Math.exp(-dt * 1.2);
        p.r += p.gr * dt;
      }
      if (R.puffs.length > 140) R.puffs.splice(0, R.puffs.length - 140);
      // 流星
      const f = R.cam / 4;
      if (f > 0.42) {
        R.metT -= dt;
        if (R.metT <= 0) {
          R.metT = rnd(0.6, 1.4) * R.metRate;
          R.meteors.push({ x: rnd(g.w * 0.3, g.w * 1.05), y: rnd(g.hudTop - 20, L.splitY * 0.45), vx: -rnd(280, 460), vy: rnd(150, 260), age: 0, life: rnd(0.8, 1.3) });
        }
      }
      for (let i = R.meteors.length - 1; i >= 0; i--) {
        const m = R.meteors[i];
        m.age += dt; m.x += m.vx * dt; m.y += m.vy * dt + dCam * 0.3;
        if (m.age > m.life) R.meteors.splice(i, 1);
      }
      for (let i = R.banners.length - 1; i >= 0; i--) { const b = R.banners[i]; b.t += dt; if (b.t > b.dur) R.banners.splice(i, 1); }
    }

    /* ---------- 画：世界（上半屏） ---------- */
    function drawWorld(g, c) {
      const R = g.rk, L = R.L, w = g.w, wh = L.splitY, S = L.STAGE, s = L.s, t = R.clock;
      const f = R.cam / 4;
      c.save();
      c.beginPath(); c.rect(-20, -20, w + 40, wh + 40); c.clip();
      const gr = c.createLinearGradient(0, 0, 0, wh);
      gr.addColorStop(0, skyCol(f + 0.13)); gr.addColorStop(1, skyCol(f - 0.07));
      c.fillStyle = gr; c.fillRect(-20, -20, w + 40, wh + 40);
      // 太阳
      const sunA = 1 - smooth((R.cam - 0.7) / 0.9);
      if (sunA > 0.01) {
        const sx = w * 0.84, sy = g.hudTop + 46 * s + R.cam * S * 0.04, sr = 26 * s;
        c.globalAlpha = sunA;
        const sg = c.createRadialGradient(sx, sy, 0, sx, sy, sr * 3);
        sg.addColorStop(0, 'rgba(255,248,190,.9)'); sg.addColorStop(0.4, 'rgba(255,236,140,.3)'); sg.addColorStop(1, 'rgba(255,230,120,0)');
        c.fillStyle = sg; c.beginPath(); c.arc(sx, sy, sr * 3, 0, TAU); c.fill();
        c.save(); c.translate(sx, sy); c.rotate(t * 0.15); c.fillStyle = 'rgba(255,243,168,.6)';
        for (let i = 0; i < 10; i++) { c.rotate(TAU / 10); c.beginPath(); c.moveTo(sr * 1.1, -sr * 0.15); c.lineTo(sr * (1.7 + 0.15 * Math.sin(t * 2 + i)), 0); c.lineTo(sr * 1.1, sr * 0.15); c.closePath(); c.fill(); }
        c.restore();
        c.fillStyle = '#FFE14D'; c.beginPath(); c.arc(sx, sy, sr, 0, TAU); c.fill();
        c.lineWidth = 3; c.strokeStyle = 'rgba(255,160,20,.6)'; c.stroke();
        c.globalAlpha = 1;
      }
      // 星星
      const stA = smooth((f - 0.34) / 0.24);
      if (stA > 0.01) {
        c.fillStyle = '#FFFFFF';
        for (const st of P.stars) {
          const x = st.x * w;
          let y = (st.y * wh + R.cam * S * 0.05 * st.z) % wh;
          const a = stA * (0.45 + 0.55 * (0.5 + 0.5 * Math.sin(t * 2.4 * st.z + st.ph)));
          c.globalAlpha = a;
          if (st.big) {
            const k = 4.5 * s * (0.7 + 0.3 * Math.sin(t * 3 + st.ph));
            c.beginPath(); c.moveTo(x, y - k); c.lineTo(x + k * 0.25, y); c.lineTo(x, y + k); c.lineTo(x - k * 0.25, y); c.closePath(); c.fill();
            c.beginPath(); c.moveTo(x - k, y); c.lineTo(x, y + k * 0.25); c.lineTo(x + k, y); c.lineTo(x, y - k * 0.25); c.closePath(); c.fill();
          } else { c.beginPath(); c.arc(x, y, st.r * 0.5 * s, 0, TAU); c.fill(); }
        }
        c.globalAlpha = 1;
      }
      // 流星
      if (R.meteors.length) {
        c.lineCap = 'round';
        for (const m of R.meteors) {
          const a = Math.min(1, m.age * 5) * (1 - m.age / m.life);
          for (let i = 0; i < 5; i++) {
            c.globalAlpha = a * (1 - i / 5); c.strokeStyle = i ? '#BFE3FF' : '#FFFFFF'; c.lineWidth = (3 - i * 0.45) * s;
            c.beginPath(); c.moveTo(m.x - m.vx * 0.022 * i, m.y - m.vy * 0.022 * i); c.lineTo(m.x - m.vx * 0.022 * (i + 1), m.y - m.vy * 0.022 * (i + 1)); c.stroke();
          }
        }
        c.globalAlpha = 1;
      }
      // 地球边缘（离开大气层时从底下露出来又远去）
      const ev = Math.sin(clamp((R.cam - 1.5) / 2.2, 0, 1) * Math.PI);
      if (ev > 0.01) {
        const er = w * 1.6, etop = wh + 10 - ev * (wh - g.hudTop) * 0.2;
        const eg = c.createRadialGradient(w / 2, etop + er, er * 0.9, w / 2, etop + er, er * 1.06);
        eg.addColorStop(0, '#2E8FE0'); eg.addColorStop(0.93, '#63C7FF'); eg.addColorStop(0.945, 'rgba(160,230,255,.7)'); eg.addColorStop(1, 'rgba(160,230,255,0)');
        c.fillStyle = eg; c.beginPath(); c.arc(w / 2, etop + er, er * 1.06, 0, TAU); c.fill();
        c.fillStyle = 'rgba(80,190,110,.7)';
        c.beginPath(); c.ellipse(w * 0.3 + Math.sin(t * 0.05) * 20, etop + 16 * s, 60 * s, 9 * s, 0, 0, TAU); c.fill();
        c.beginPath(); c.ellipse(w * 0.75, etop + 22 * s, 40 * s, 7 * s, 0, 0, TAU); c.fill();
      }
      // 远处的云
      const span = w + 280 * s, mrg = 140 * s;
      for (const cl of R.clouds) {
        if (cl.d >= 1.05) continue;
        drawCloud(g, R, cl, span, mrg, t);
      }
      // 小鸟
      c.strokeStyle = 'rgba(40,60,90,.75)'; c.lineWidth = 2.2 * s; c.lineCap = 'round';
      for (const b of R.birds) {
        const y = Ymap(R, b.u, 0.8) + Math.sin(t * 0.9 + b.ph) * 8;
        if (y < -20 || y > wh + 20) continue;
        const sp = w + 80; let x = (b.x * sp + t * b.v) % sp; if (x < 0) x += sp; x -= 40;
        const fl = Math.sin(t * 8 + b.ph) * 5 * s, k = 7 * s;
        c.beginPath(); c.moveTo(x - k * 1.4, y - fl * 0.4); c.quadraticCurveTo(x - k * 0.6, y - k * 0.7 - fl, x, y);
        c.quadraticCurveTo(x + k * 0.6, y - k * 0.7 - fl, x + k * 1.4, y - fl * 0.4); c.stroke();
      }
      // 热气球
      {
        const y = Ymap(R, 1.18, 0.85) + Math.sin(t * 1.1) * 6 * s;
        if (y > -80 && y < wh + 80) drawBalloon(c, w * 0.2 + Math.sin(t * 0.4) * 18 * s, y, 26 * s, t);
      }
      // 飞机
      {
        const y = Ymap(R, 1.52, 1) + Math.sin(t * 1.3) * 4;
        if (y > -60 && y < wh + 60) {
          const sp = w + 360 * s; const x = ((t * 70 * s + w * 0.3) % sp) - 180 * s;
          c.strokeStyle = 'rgba(255,255,255,.75)'; c.lineWidth = 4 * s; c.lineCap = 'round';
          c.beginPath(); c.moveTo(x - 30 * s, y + 4 * s); c.lineTo(x - 170 * s, y + 6 * s); c.stroke();
          g.emoji('✈️', x, y, 50 * s, { rot: Math.PI / 4 });
        }
      }
      // 卫星 / 飞碟
      for (const st of R.sats) {
        const y = Ymap(R, st.u, 0.9);
        if (y < -60 || y > wh + 60) continue;
        const sp = w + 160; let x = (st.x * sp + t * st.v * s) % sp; if (x < 0) x += sp; x -= 80;
        g.emoji('🛰️', x, y, 46 * s, { rot: Math.sin(t * 0.6 + st.r) * 0.4 });
        if (Math.sin(t * 5 + st.r * 2) > 0.3) { c.fillStyle = '#FF4D4D'; c.beginPath(); c.arc(x + 14 * s, y - 16 * s, 3 * s, 0, TAU); c.fill(); }
      }
      if (R.ufo) {
        const y = Ymap(R, 3.3, 0.8) + Math.sin(t * 2) * 8 * s;
        if (y > -60 && y < wh + 60) {
          const x = w * 0.72 + Math.sin(t * 0.7) * w * 0.15;
          c.fillStyle = 'rgba(160,255,200,.18)'; c.beginPath(); c.moveTo(x - 10 * s, y + 8 * s); c.lineTo(x + 10 * s, y + 8 * s); c.lineTo(x + 34 * s, y + 70 * s); c.lineTo(x - 34 * s, y + 70 * s); c.closePath(); c.fill();
          g.emoji('🛸', x, y, 48 * s, { rot: Math.sin(t * 3) * 0.12 });
        }
      }
      // 目的地星球：接近时从上方降下来
      {
        const pr = Math.min(w * 0.36, (wh - g.hudTop) * 0.46);
        const noseY = L.flyY - L.rh;
        const k = smooth((R.cam - 2.55) / 1.45);
        if (k > 0) {
          const pcy = lerp(-pr * 1.3, noseY - pr * 1.04, k);
          drawPlanet(c, R.dest.key, w / 2 + (1 - k) * w * 0.12, pcy, pr, t, 3 * s);
          if (R.flag) {
            const fx = w / 2 + pr * 0.32, fy = pcy + Math.sqrt(Math.max(0, pr * pr - (pr * 0.32) * (pr * 0.32)));
            g.emoji('🚩', fx + 10 * s, fy - 20 * s, 40 * s, { rot: Math.sin(t * 3) * 0.08 });
          }
        }
      }
      // 地面（发射台）
      drawGround(g, c, R, t);
      // 烟
      for (const p of R.puffs) {
        if (p.screen) continue;
        drawPuff(c, p);
      }
      // 火箭
      rocketPos(g, RP);
      let rot = R.alt > 0.004 ? Math.sin(R.clock * 1.3) * 0.035 : 0;
      if (R.fly === 'fall') rot += Math.sin(R.clock * 30) * 0.06 * Math.max(R.sputter, 0.3);
      const jig = R.fly === 'boost' ? Math.sin(R.clock * 60) * 1.5 * s : 0;
      drawRocket(g, c, RP.x + jig, RP.yb, L.rh, rot, R.flame, avatar, R.clock);
      // 近处的云（挡在火箭前面）
      for (const cl of R.clouds) {
        if (cl.d < 1.05) continue;
        drawCloud(g, R, cl, span, mrg, t);
      }
      // 速度线
      if (R.boostV > 0.03) {
        c.strokeStyle = '#FFFFFF'; c.lineCap = 'round';
        for (const ln of P.lines) {
          const len = (60 + 110 * ln.l) * s * R.boostV;
          const y = ((ln.y * (wh + 200) + t * 1500 * ln.sp) % (wh + 200)) - 100;
          c.globalAlpha = 0.45 * R.boostV; c.lineWidth = (1.5 + ln.l * 2) * s;
          c.beginPath(); c.moveTo(ln.x * w, y); c.lineTo(ln.x * w, y - len); c.stroke();
        }
        c.globalAlpha = 1;
      }
      // 横幅
      for (const b of R.banners) {
        const u = b.t / b.dur;
        const sc = b.t < 0.3 ? outBack(b.t / 0.3) : 1;
        const a = u > 0.8 ? (1 - u) / 0.2 : 1;
        const by = g.hudTop + (wh - g.hudTop) * 0.3 + b.dy * s - (u > 0.8 ? (u - 0.8) * 60 : 0);
        c.save(); c.translate(w / 2, by); c.scale(sc, sc);
        g.shadowText(b.text, 0, 0, { size: Math.round(b.size * s), color: b.col, alpha: a, maxW: w - 40 });
        c.restore();
      }
      c.restore();
      drawMeter(g, c);
    }
    function drawCloud(g, R, cl, span, mrg, t) {
      const y = Ymap(R, cl.u, cl.d);
      if (y < -120 || y > R.L.splitY + 90) return;
      let x = (cl.x * span + t * cl.v) % span; if (x < 0) x += span;
      g.cloud(x - mrg, y, cl.s * R.L.s, cl.a);
    }
    function drawPuff(c, p) {
      const k = p.age / p.life;
      const a = (k < 0.15 ? k / 0.15 : 1 - (k - 0.15) / 0.85) * 0.85;
      if (a <= 0) return;
      const v = p.col;
      c.globalAlpha = a;
      c.fillStyle = 'rgb(' + v + ',' + v + ',' + Math.min(255, v + 12) + ')';
      c.beginPath(); c.arc(p.x, p.y, p.r, 0, TAU); c.fill();
      c.globalAlpha = a * 0.5; c.fillStyle = '#FFFFFF';
      c.beginPath(); c.arc(p.x - p.r * 0.3, p.y - p.r * 0.3, p.r * 0.45, 0, TAU); c.fill();
      c.globalAlpha = 1;
    }
    function drawBalloon(c, x, y, r, t) {
      c.save(); c.translate(x, y); c.rotate(Math.sin(t * 0.9) * 0.06);
      c.strokeStyle = 'rgba(90,60,40,.8)'; c.lineWidth = 1.5;
      c.beginPath(); c.moveTo(-r * 0.5, r * 0.7); c.lineTo(-r * 0.25, r * 1.35); c.moveTo(r * 0.5, r * 0.7); c.lineTo(r * 0.25, r * 1.35); c.stroke();
      c.fillStyle = '#A0632F'; c.fillRect(-r * 0.28, r * 1.3, r * 0.56, r * 0.4);
      const cols = ['#FF5A5F', '#FFC928', '#3CCB5A', '#3AA0FF'];
      for (let i = 0; i < 4; i++) {
        c.fillStyle = cols[i];
        c.beginPath();
        c.ellipse(0, 0, r * (1 - i * 0.24), r * 1.1, 0, 0, TAU);
        c.fill();
      }
      c.strokeStyle = NAVY; c.lineWidth = 2; c.beginPath(); c.ellipse(0, 0, r, r * 1.1, 0, 0, TAU); c.stroke();
      c.fillStyle = 'rgba(255,255,255,.45)'; c.beginPath(); c.ellipse(-r * 0.4, -r * 0.45, r * 0.22, r * 0.34, -0.4, 0, TAU); c.fill();
      c.restore();
    }
    function drawGround(g, c, R, t) {
      const L = R.L, w = g.w, s = L.s, wh = L.splitY;
      const gy = Ymap(R, 0, 1);
      if (gy > wh + 260) return;
      const hz = gy - 40 * s + (gy - L.padY) * -0.5;   // 海平线：视差 0.5
      // 天际线（新加坡：组屋 + 摩天观景轮 + 金沙）
      if (hz < wh + 10) {
        c.fillStyle = '#9CC2E6';
        for (const b of L.city) c.fillRect(b.x, hz - b.h, b.w, b.h + 2);
        c.fillStyle = 'rgba(255,255,255,.55)';
        for (const b of L.city) if (b.win) for (let yy = hz - b.h + 5 * s; yy < hz - 4 * s; yy += 8 * s) c.fillRect(b.x + 3 * s, yy, b.w - 6 * s, 2 * s);
        // 金沙
        const mx = w * 0.7, ms = 0.75 * s;
        c.fillStyle = '#86AFD8';
        for (let i = 0; i < 3; i++) { const bx = mx + i * 22 * ms; c.beginPath(); c.moveTo(bx, hz); c.lineTo(bx + 3 * ms, hz - 64 * ms); c.lineTo(bx + 13 * ms, hz - 64 * ms); c.lineTo(bx + 15 * ms, hz); c.closePath(); c.fill(); }
        c.beginPath(); c.moveTo(mx - 8 * ms, hz - 64 * ms); c.lineTo(mx + 68 * ms, hz - 66 * ms); c.lineTo(mx + 74 * ms, hz - 71 * ms); c.lineTo(mx - 8 * ms, hz - 71 * ms); c.closePath(); c.fill();
        // 摩天观景轮（会转）
        const fx = w * 0.2, fyc = hz - 38 * s, fr = 30 * s;
        c.strokeStyle = '#86AFD8'; c.lineWidth = 3 * s;
        c.beginPath(); c.arc(fx, fyc, fr, 0, TAU); c.stroke();
        c.lineWidth = 1.2 * s;
        for (let i = 0; i < 8; i++) { const a = t * 0.25 + i * TAU / 8; c.beginPath(); c.moveTo(fx, fyc); c.lineTo(fx + Math.cos(a) * fr, fyc + Math.sin(a) * fr); c.stroke(); }
        c.lineWidth = 3 * s; c.beginPath(); c.moveTo(fx - 12 * s, hz); c.lineTo(fx, fyc); c.lineTo(fx + 12 * s, hz); c.stroke();
        // 海
        const sg = c.createLinearGradient(0, hz, 0, hz + 90 * s);
        sg.addColorStop(0, '#6BDDEB'); sg.addColorStop(1, '#2AA7D0');
        c.fillStyle = sg; c.fillRect(-20, hz, w + 40, Math.max(0, wh + 300 - hz));
        c.globalAlpha = 0.55; c.strokeStyle = '#FFFFFF'; c.lineWidth = 2 * s; c.lineCap = 'round';
        for (let i = 0; i < 3; i++) {
          const yy = hz + (8 + i * 11) * s, off = (t * (16 + i * 9)) % (70 * s);
          c.beginPath();
          for (let x = -70 * s + off; x < w + 70; x += 70 * s) { c.moveTo(x, yy); c.quadraticCurveTo(x + 10 * s, yy - 4 * s, x + 20 * s, yy); }
          c.stroke();
        }
        c.globalAlpha = 1;
      }
      // 小岛 + 发射台
      c.fillStyle = '#F3D38A';
      c.beginPath(); c.moveTo(-20, gy + 16 * s); c.quadraticCurveTo(w / 2, gy - 18 * s, w + 20, gy + 16 * s); c.lineTo(w + 20, wh + 300); c.lineTo(-20, wh + 300); c.closePath(); c.fill();
      c.fillStyle = '#6CCB52';
      c.beginPath(); c.moveTo(-20, gy + 24 * s); c.quadraticCurveTo(w / 2, gy - 8 * s, w + 20, gy + 24 * s); c.lineTo(w + 20, wh + 300); c.lineTo(-20, wh + 300); c.closePath(); c.fill();
      const px = L.rx, pw = L.rh * 1.05;
      g.rrect(px - pw / 2, gy - 3 * s, pw, 14 * s, 5 * s, '#7B8499', NAVY, 2.5 * s);
      c.save(); c.beginPath(); c.rect(px - pw / 2 + 3 * s, gy + 5 * s, pw - 6 * s, 4 * s); c.clip();
      c.fillStyle = '#FFD23F'; c.fillRect(px - pw / 2, gy + 5 * s, pw, 4 * s);
      c.fillStyle = NAVY; for (let x = px - pw / 2; x < px + pw / 2; x += 10 * s) { c.beginPath(); c.moveTo(x, gy + 9 * s); c.lineTo(x + 4 * s, gy + 5 * s); c.lineTo(x + 8 * s, gy + 5 * s); c.lineTo(x + 4 * s, gy + 9 * s); c.closePath(); c.fill(); }
      c.restore();
      // 发射塔
      const tx = px - L.rh * 0.62, th = L.rh * 1.08, tw = 16 * s;
      c.strokeStyle = '#E8533F'; c.lineWidth = 3.2 * s; c.lineCap = 'round';
      c.beginPath(); c.moveTo(tx - tw / 2, gy); c.lineTo(tx - tw / 2, gy - th); c.moveTo(tx + tw / 2, gy); c.lineTo(tx + tw / 2, gy - th); c.stroke();
      c.lineWidth = 1.8 * s;
      c.beginPath();
      for (let yy = gy; yy > gy - th + 4; yy -= 14 * s) { c.moveTo(tx - tw / 2, yy); c.lineTo(tx + tw / 2, yy - 14 * s); c.moveTo(tx + tw / 2, yy); c.lineTo(tx - tw / 2, yy - 14 * s); }
      c.stroke();
      // 摆臂：起飞后甩开
      c.save(); c.translate(tx + tw / 2, gy - th * 0.62); c.rotate(-R.armA * 1.2);
      c.strokeStyle = '#E8533F'; c.lineWidth = 4 * s; c.beginPath(); c.moveTo(0, 0); c.lineTo(L.rh * 0.36, 0); c.stroke();
      c.restore();
      // 塔顶小国旗（红白，会飘）
      const fx0 = tx, fy0 = gy - th - 2 * s;
      c.strokeStyle = NAVY; c.lineWidth = 2 * s; c.beginPath(); c.moveTo(fx0, fy0); c.lineTo(fx0, fy0 - 26 * s); c.stroke();
      const wv = Math.sin(t * 5) * 2 * s;
      c.fillStyle = '#EF3340'; c.beginPath(); c.moveTo(fx0, fy0 - 26 * s); c.quadraticCurveTo(fx0 + 10 * s, fy0 - 28 * s + wv, fx0 + 20 * s, fy0 - 26 * s); c.lineTo(fx0 + 20 * s, fy0 - 20 * s); c.quadraticCurveTo(fx0 + 10 * s, fy0 - 22 * s + wv, fx0, fy0 - 20 * s); c.closePath(); c.fill();
      c.fillStyle = '#FFFFFF'; c.beginPath(); c.moveTo(fx0, fy0 - 20 * s); c.quadraticCurveTo(fx0 + 10 * s, fy0 - 22 * s + wv, fx0 + 20 * s, fy0 - 20 * s); c.lineTo(fx0 + 20 * s, fy0 - 14 * s); c.quadraticCurveTo(fx0 + 10 * s, fy0 - 16 * s + wv, fx0, fy0 - 14 * s); c.closePath(); c.fill();
      if (Math.sin(t * 4) > 0) { c.fillStyle = '#FF3B3B'; c.beginPath(); c.arc(tx, gy - th, 3.5 * s, 0, TAU); c.fill(); }
      // 椰树
      g.emoji('🌴', w * 0.08, gy - 16 * s, 66 * s, { rot: Math.sin(t * 1.2) * 0.04 });
      g.emoji('🌴', w * 0.92, gy - 10 * s, 58 * s, { rot: Math.sin(t * 1.2 + 2) * 0.04, flip: true });
      if (w > 600) { g.emoji('🌴', w * 0.28, gy - 6 * s, 50 * s); g.emoji('🌺', w * 0.8, gy + 2 * s, 26 * s); }
    }
    function drawMeter(g, c) {
      const R = g.rk, L = R.L, s = L.s;
      const x = 22 * s, y0 = g.hudTop + 52 * s, y1 = L.splitY - 22 * s;
      if (y1 - y0 < 90) return;
      g.rrect(x - 6 * s, y0 - 4 * s, 12 * s, y1 - y0 + 8 * s, 6 * s, 'rgba(20,32,70,.4)', 'rgba(255,255,255,.75)', 2 * s);
      const fr = clamp(R.cam / 4, 0, 1);
      g.rrect(x - 3 * s, y1 - (y1 - y0) * fr, 6 * s, (y1 - y0) * fr + 2 * s, 3 * s, '#FFC928');
      for (let k = 1; k <= 4; k++) {
        const y = y1 - (y1 - y0) * k / 4;
        const passed = R.stage >= k;
        c.fillStyle = passed ? '#FFE45C' : 'rgba(255,251,239,.92)';
        c.beginPath(); c.arc(x, y, 13 * s, 0, TAU); c.fill();
        c.lineWidth = 2 * s; c.strokeStyle = NAVY; c.stroke();
        if (k < 4) g.emoji(STAGE_ICON[k - 1], x, y, 17 * s);
        else drawPlanet(c, R.dest.key, x, y, 8 * s, R.clock, 1.2);
      }
      g.text(R.dest.name, x + 17 * s, y0 - 1 * s, { size: Math.round(12 * s), font: 'round', color: '#FFFFFF', align: 'left', stroke: NAVY, strokeW: 3 });
      const ry = y1 - (y1 - y0) * fr;
      g.emoji('🚀', x, ry, 20 * s, { rot: -Math.PI / 4 });
    }

    /* ---------- 画：控制台（下半屏） ---------- */
    function drawPanel(g, c) {
      const R = g.rk, L = R.L, s = L.s, w = g.w, h = g.h, y0 = L.splitY, t = R.clock;
      // 控制台
      g.rrect(-6, y0 + 3 * s, w + 12, h - y0 + 40, 26 * s, 'rgba(15,25,60,.35)');
      g.rrect(-6, y0 - 2 * s, w + 12, h - y0 + 40, 26 * s, '#FFF3D6', NAVY, 4 * s);
      c.save();
      c.setLineDash([6 * s, 6 * s]); c.lineWidth = 2 * s; c.strokeStyle = 'rgba(29,43,83,.16)';
      c.beginPath(); c.moveTo(22 * s, y0 + 5 * s); c.lineTo(w - 22 * s, y0 + 5 * s); c.stroke();
      c.restore();
      // 头部：来源 + 句子进度 / 模式
      const ph = R.cur;
      const hy = L.headY + L.headH / 2;
      if (ph) {
        const title = (ph.src === 'tw' ? '👅 ' : '📖 ') + (ph.src === 'tw' ? '绕口令' : '《' + ph.title + '》');
        const tw0 = Math.min(g.measure(title, Math.round(15 * s), 'round') + 22 * s, w * (L.wide ? 0.35 : 0.46));
        g.rrect(12 * s, L.headY, tw0, L.headH, L.headH / 2, '#FFFFFF', NAVY, 2.2 * s);
        g.text(title, 12 * s + tw0 / 2, hy + 1, { size: Math.round(15 * s), font: 'round', color: NAVY, maxW: tw0 - 16 * s });
        // 句子进度点
        const n = g.rounds;
        let dx = 12 * s + tw0 + 16 * s;
        for (let i = 0; i < n; i++) {
          const done = i < g.done || (R.ph === 'done'), cur = i === R.idx && !done;
          const r = (cur ? 8 : 6.5) * s * (cur ? 1 + 0.12 * Math.sin(t * 6) : 1);
          c.fillStyle = done ? '#FFC928' : cur ? '#FF7A3D' : '#E3D7B8';
          c.beginPath(); c.arc(dx, hy, r, 0, TAU); c.fill();
          c.lineWidth = 2 * s; c.strokeStyle = NAVY; c.stroke();
          dx += 21 * s;
        }
        const m = P.mic;
        const mode = R.micOn ? '🎤 大声读' : (m && m.state === 'asking') ? '🎤 等麦克风…' : '👆 节拍模式';
        const mw = g.measure(mode, Math.round(14 * s), 'round') + 20 * s;
        if (dx + mw < w - 8 * s) {
          g.rrect(w - 12 * s - mw, L.headY + 1, mw, L.headH - 2, (L.headH - 2) / 2, R.micOn ? '#3CCB5A' : '#3AA0FF', NAVY, 2 * s);
          g.text(mode, w - 12 * s - mw / 2, hy + 1, { size: Math.round(14 * s), font: 'round', color: '#FFFFFF', stroke: NAVY, strokeW: 2.5 });
        }
      }
      // 卡拉OK屏
      const sx0 = L.sx0, sy0 = L.sy0, sw = L.sx1 - L.sx0, sh = L.sy1 - L.sy0;
      g.rrect(sx0, sy0 + 4 * s, sw, sh, 18 * s, 'rgba(15,25,60,.35)');
      const scr = c.createLinearGradient(0, sy0, 0, sy0 + sh);
      scr.addColorStop(0, '#26386F'); scr.addColorStop(1, '#16214C');
      g.rrect(sx0, sy0, sw, sh, 18 * s, scr, NAVY, 3.5 * s);
      c.save();
      c.beginPath(); c.rect(sx0 + 3, sy0 + 3, sw - 6, sh - 6); c.clip();
      for (const sp of P.sparks) {
        const x = sx0 + sp.x * sw, y = sy0 + sh - ((sp.y * sh + t * sp.sp) % sh);
        c.globalAlpha = 0.25 + 0.25 * Math.sin(t * 2 + sp.ph); c.fillStyle = '#9FB8FF';
        c.beginPath(); c.arc(x, y, 1.6 * s, 0, TAU); c.fill();
      }
      c.globalAlpha = 1;
      if (ph) drawChars(g, c, R, ph);
      c.restore();
      // 按钮
      drawSpeaker(g, c, R);
      drawTank(g, c, R);
      drawFire(g, c, R);
    }
    function drawChars(g, c, R, ph) {
      const L = R.L, s = L.s, cell = ph.cell, t = R.clock;
      const run = R.ph === 'run', rt = run ? R.rt : R.ph === 'result' || R.ph === 'done' ? R.rtEnd : -1;
      const csz = Math.round(cell * 0.84), psz = Math.round(cell * 0.33);
      // 接近圈：提示下一个字
      let next = null;
      if (run) for (const q of ph.hans) if (!q.st) { next = q; break; }
      const eIn = R.cardIn * R.cardDur;
      for (const ch of ph.chars) {
        let a = clamp((eIn - ch.i * 0.03) / 0.3, 0, 1);
        if (a <= 0) continue;
        const sc0 = outBack(a);
        const out = R.cardOut > 0 ? clamp((R.cardOut * 0.7 - ch.i * 0.015) / 0.35, 0, 1) : 0;
        const ox = R.cardShake > 0 ? Math.sin(t * 55 + ch.i) * 5 * s * R.cardShake : 0;
        const oy = -out * cell * 1.6;
        const alpha = 1 - out;
        if (alpha <= 0) continue;
        const x = ch.x + ox, y = ch.y + oy;
        const lit = ch.han && (ch.lit || (rt >= 0 && rt >= ch.t));
        const hit = ch.st === 1 || ch.st === 2, missd = ch.st === 3;
        if (hit) {
          c.globalAlpha = alpha * (0.35 + 0.25 * ch.pop);
          c.fillStyle = ch.st === 1 ? '#FFB020' : '#FFD86B';
          c.beginPath(); c.arc(x, y, cell * (0.55 + 0.15 * ch.pop), 0, TAU); c.fill();
          c.globalAlpha = 1;
        }
        if (ch === next && R.rings) {
          const lead = Math.max(0.55, R.beat * 1.6), dtn = ch.t - rt;
          if (dtn > 0 && dtn < lead) {
            const k = dtn / lead;
            c.globalAlpha = (1 - k) * 0.9; c.strokeStyle = '#FFE45C'; c.lineWidth = 3 * s;
            c.beginPath(); c.arc(x, y, cell * 0.5 + k * cell * 1.1, 0, TAU); c.stroke();
            c.globalAlpha = 1;
          }
        }
        let col = '#C4CEEE';
        if (!ch.han) col = '#8E9BC9';
        else if (hit) col = '#FFE14D';
        else if (missd) col = '#6E7CAB';
        else if (lit) col = '#FFFFFF';
        const sc = sc0 * (1 + ch.pop * 0.32);
        c.save(); c.translate(x, y); if (sc !== 1) c.scale(sc, sc);
        g.text(ch.ch, 0, 0, { size: csz, font: 'kai', color: col, alpha, stroke: hit ? '#8A4B00' : null, strokeW: hit ? Math.max(1.5, csz * 0.05) : 0 });
        c.restore();
        if (missd && ch.han) { c.globalAlpha = alpha; c.fillStyle = '#FF6B6B'; c.beginPath(); c.arc(x, y + cell * 0.55, 2.4 * s, 0, TAU); c.fill(); c.globalAlpha = 1; }
        if (ch.py && ph.hasPy) {
          const pc = hit ? '#FFE9A0' : ch.hard ? '#FF9EC4' : lit ? '#E0E8FF' : '#9FB0E8';
          g.text(ch.py, x, ch.pyY + oy, { size: psz, font: 'py', color: pc, alpha: alpha * sc0, maxW: cell * 0.98 });
          if (ch.hard) { c.globalAlpha = alpha * 0.8; c.fillStyle = '#FF9EC4'; c.fillRect(x - cell * 0.4, y + cell * 0.5, cell * 0.8, 2 * s); c.globalAlpha = 1; }
        }
      }
      // 跳跳球
      if (R.cardOut < 0.5 && R.cardIn > 0.3) {
        ballPos(R, ph, R.ball);
        const b = R.ball, br = ph.br;
        c.globalAlpha = 0.35; c.fillStyle = '#000';
        c.beginPath(); c.ellipse(b.gx, b.gy, br * (1.1 - b.h * 0.5), br * 0.35, 0, 0, TAU); c.fill();
        c.globalAlpha = 1;
        c.save(); c.translate(b.x, b.y); c.scale(1 / b.sq, b.sq);
        const bg = c.createRadialGradient(-br * 0.35, -br * 0.35, 1, 0, 0, br);
        bg.addColorStop(0, '#FFD7C2'); bg.addColorStop(0.45, '#FF6B4A'); bg.addColorStop(1, '#D8321C');
        c.fillStyle = bg; c.beginPath(); c.arc(0, 0, br, 0, TAU); c.fill();
        c.lineWidth = 2; c.strokeStyle = NAVY; c.stroke();
        c.fillStyle = 'rgba(255,255,255,.8)'; c.beginPath(); c.arc(-br * 0.35, -br * 0.38, br * 0.26, 0, TAU); c.fill();
        c.restore();
      }
      // 屏幕顶上的状态行
      const mx = (L.sx0 + L.sx1) / 2, my = L.sy0 + 13 * s;
      if (R.ph === 'ready' && R.demoing) g.text('🔊 先听示范…', mx, my, { size: Math.round(14 * s), font: 'round', color: '#BFD0FF', alpha: 0.7 + 0.3 * Math.sin(t * 5) });
      else if (showTip(g, R) && (R.ph === 'ready' || R.ph === 'run') && !(run && R.rt < ph.t0 + 0.45)) {
        const tip = R.micOn ? '🎤 大声读，火箭就会飞！' : '👆 球落到字上，就点🔥！';
        g.text(tip, mx, my + 1, { size: Math.round(15 * s), font: 'round', color: '#FFE45C', alpha: 0.75 + 0.25 * Math.sin(t * 6) });
      }
      else if (R.ph === 'ready' && g.state === 'play') g.text('准备好了就点🔥', mx, my, { size: Math.round(13 * s), font: 'round', color: '#8FA3DD' });
      else if (R.ph === 'count') g.text('预备——', mx, my, { size: Math.round(15 * s), font: 'round', color: '#FFE45C' });
      else if (run && R.rt < ph.t0 + 0.45) g.text('读！', mx, my, { size: Math.round(17 * s), font: 'round', color: '#7CFF8A' });
      // 结算印章：燃料百分比
      if ((R.ph === 'result' && R.fly === 'boost') || R.ph === 'done') {
        const k = clamp(R.stampT / 0.35, 0, 1), sc = outBack(k);
        const cy = (L.sy0 + L.sy1) / 2;
        c.save(); c.translate(mx, cy - 8 * s); c.scale(sc, sc); c.rotate(-0.05);
        g.text('燃料 ' + R.stampPct + '%', 0, -14 * s, { size: Math.round(40 * s), font: 'round', color: '#FFE14D', stroke: NAVY, strokeW: 5, shadow: true });
        g.text(R.stampLabel || '', 0, 30 * s, { size: Math.round(22 * s), font: 'round', color: '#FFFFFF', stroke: NAVY, strokeW: 4 });
        c.restore();
      }
      // 结算字样
      if (R.ph === 'result' && R.fly === 'fall' && R.cardShake > 0.1) {
        g.shadowText('再读一次！', (L.sx0 + L.sx1) / 2, L.sy1 - 22 * s, { size: Math.round(22 * s), color: '#9FD4FF' });
      }
    }
    function ballPos(R, ph, out) {
      const cell = ph.cell, sp = ph.spring, t = R.clock;
      let x = sp.x, y = sp.landY, sq = 1, hgt = 0;
      if (R.ph === 'ready' || R.ph === 'intro') {
        const k = Math.abs(Math.sin(t * 3.2));
        hgt = k * 0.35; y = sp.landY - k * cell * 0.3; sq = k < 0.15 ? 0.82 : 1;
      } else if (R.ph === 'count') {
        const k = (R.cT % R.ci) / R.ci;
        hgt = 4 * k * (1 - k); y = sp.landY - hgt * cell * 0.6; sq = k < 0.08 || k > 0.92 ? 0.78 : 1;
      } else {
        const rt = R.ph === 'run' ? R.rt : R.rtEnd;
        let ax = sp.x, ay = sp.landY, ta = 0, b = null;
        for (const c of ph.hans) { if (rt < c.t) { b = c; break; } ax = c.x; ay = c.landY; ta = c.t; }
        if (!b) { x = ax; y = ay; }
        else {
          const u = clamp((rt - ta) / Math.max(0.05, b.t - ta), 0, 1);
          const H = clamp(Math.hypot(b.x - ax, b.landY - ay) * 0.35 + cell * 0.3, cell * 0.4, cell * 1.05);
          const Hc = Math.min(H, Math.max(4, Math.min(ay, b.landY) - (R.L.sy0 + ph.br + 3)));
          x = lerp(ax, b.x, u); y = lerp(ay, b.landY, u) - 4 * Hc * u * (1 - u);
          hgt = 4 * u * (1 - u);
          sq = u < 0.07 || u > 0.93 ? 0.8 : 1;
        }
      }
      out.x = x; out.y = y; out.sq = sq; out.h = clamp(hgt, 0, 1);
      out.gx = x; out.gy = (y + hgt * cell * 0.6) + ph.br * 0.9;
      if (R.ph === 'run' || R.ph === 'result' || R.ph === 'done') out.gy = y + ph.br * 0.9 + hgt * cell * 0.5;
      return out;
    }
    function drawFire(g, c, R) {
      const L = R.L, s = L.s, r = L.fireR, x = L.fireX, t = R.clock;
      const press = R.btnPress;
      const y = L.fireY + press * 5 * s;
      const active = R.ph === 'run' || R.ph === 'ready' || R.ph === 'count';
      // 节拍提示圈：下一个字快到了
      if (R.ph === 'run' && R.cur) {
        let next = null;
        for (const q of R.cur.hans) if (!q.st) { next = q; break; }
        if (next) {
          const lead = Math.max(0.5, R.beat * 1.4), d = next.t - R.rt;
          if (d > 0 && d < lead) {
            const k = d / lead;
            c.globalAlpha = 1 - k; c.strokeStyle = '#FFB020'; c.lineWidth = 4 * s;
            c.beginPath(); c.arc(x, L.fireY, r + 6 * s + k * r * 0.9, 0, TAU); c.stroke(); c.globalAlpha = 1;
          }
        }
      }
      if (R.micOn && R.ph === 'run') {
        const m = P.mic, v = m ? clamp((m.lvl - m.thr) / (m.thr * 2.5), 0, 1) : 0;
        c.globalAlpha = 0.35 + 0.4 * v; c.fillStyle = '#7CFF8A';
        c.beginPath(); c.arc(x, L.fireY, r + 4 * s + v * 18 * s, 0, TAU); c.fill(); c.globalAlpha = 1;
      }
      c.fillStyle = NAVY; c.beginPath(); c.arc(x, L.fireY + 6 * s, r, 0, TAU); c.fill();
      const gr = c.createRadialGradient(x - r * 0.3, y - r * 0.4, r * 0.1, x, y, r);
      gr.addColorStop(0, active ? '#FFC06A' : '#C9CDD8'); gr.addColorStop(0.55, active ? '#FF7A3D' : '#A5ABBA'); gr.addColorStop(1, active ? '#E8432A' : '#8990A3');
      c.fillStyle = gr; c.beginPath(); c.arc(x, y, r, 0, TAU); c.fill();
      c.lineWidth = 3.5 * s; c.strokeStyle = NAVY; c.stroke();
      c.fillStyle = 'rgba(255,255,255,.38)'; c.beginPath(); c.ellipse(x, y - r * 0.5, r * 0.62, r * 0.28, 0, 0, TAU); c.fill();
      const pulse = R.ph === 'ready' ? 1 + 0.06 * Math.sin(t * 6) : 1;
      g.emoji(R.micOn ? '🎤' : '🔥', x, y - 2 * s, r * 1.05 * pulse * (1 - press * 0.12));
      // 连击数
      if (R.streak >= 3 && R.ph === 'run') {
        const txt = '×' + R.streak;
        g.text(txt, x + r * 0.78, y - r * 0.78, { size: Math.round(18 * s), font: 'num', color: '#FFE45C', stroke: NAVY, strokeW: 3.5 });
      }
    }
    function drawSpeaker(g, c, R) {
      if (!ttsOk()) return;
      const L = R.L, s = L.s, r = L.spkR, x = L.spkX, t = R.clock;
      const on = R.ph === 'ready';
      const y = L.spkY + R.spkPress * 4 * s;
      c.fillStyle = NAVY; c.beginPath(); c.arc(x, L.spkY + 5 * s, r, 0, TAU); c.fill();
      c.fillStyle = on ? '#3AA0FF' : '#9AA6C2'; c.beginPath(); c.arc(x, y, r, 0, TAU); c.fill();
      c.lineWidth = 3 * s; c.strokeStyle = NAVY; c.stroke();
      c.fillStyle = 'rgba(255,255,255,.35)'; c.beginPath(); c.ellipse(x, y - r * 0.48, r * 0.6, r * 0.26, 0, 0, TAU); c.fill();
      g.emoji('🔊', x, y, r * 1.0, { alpha: on ? 1 : 0.6 });
      if (R.demoing) {
        c.strokeStyle = '#3AA0FF'; c.lineWidth = 3 * s; c.lineCap = 'round';
        for (let i = 0; i < 2; i++) {
          const k = (t * 1.5 + i * 0.5) % 1;
          c.globalAlpha = 1 - k; c.beginPath(); c.arc(x, y, r + 4 * s + k * 16 * s, -0.8, 0.8); c.stroke();
        }
        c.globalAlpha = 1;
      }
      g.text('听示范', x, L.spkY + r + 12 * s, { size: Math.round(12 * s), font: 'round', color: NAVY, alpha: on ? 1 : 0.5 });
    }
    function drawTank(g, c, R) {
      const L = R.L, s = L.s, x = L.tankX, y = L.tankY, tw = L.tankW, th = L.tankH, t = R.clock;
      g.rrect(x, y + 4 * s, tw, th, tw / 2, 'rgba(15,25,60,.35)');
      g.rrect(x, y, tw, th, tw / 2, '#E9E2CF', NAVY, 3 * s);
      const f = clamp(R.fuel, 0, 1);
      const ok = f >= R.pass;
      if (f > 0.01) {
        const fh = (th - 6 * s) * f;
        c.save(); c.beginPath(); c.rect(x + 3 * s, y + th - 3 * s - fh, tw - 6 * s, fh); c.clip();
        g.rrect(x + 3 * s, y + 3 * s, tw - 6 * s, th - 6 * s, (tw - 6 * s) / 2, ok ? '#46D163' : '#FF9F1C');
        c.fillStyle = 'rgba(255,255,255,.5)';
        for (let i = 0; i < 3; i++) { const by = y + th - ((t * 30 + i * 23) % Math.max(10, fh)); c.beginPath(); c.arc(x + tw * (0.35 + i * 0.15), by, 1.8 * s, 0, TAU); c.fill(); }
        c.restore();
      }
      const py = y + th - 3 * s - (th - 6 * s) * R.pass;
      c.strokeStyle = '#FFFFFF'; c.lineWidth = 2.5 * s; c.beginPath(); c.moveTo(x - 4 * s, py); c.lineTo(x + tw + 4 * s, py); c.stroke();
      c.strokeStyle = NAVY; c.lineWidth = 1.2 * s; c.beginPath(); c.moveTo(x - 4 * s, py); c.lineTo(x + tw + 4 * s, py); c.stroke();
      g.emoji('🏁', x + tw + 10 * s, py - 6 * s, 14 * s);
      g.text('燃料', x + tw / 2, y + th + 12 * s, { size: Math.round(12 * s), font: 'round', color: NAVY });
    }
    function drawOrbs(g, c) {
      const R = g.rk;
      if (!R.orbs.length) return;
      for (const o of R.orbs) {
        for (let i = 3; i >= 0; i--) {
          const k = clamp(o.t / o.dur - i * 0.06, 0, 1);
          const p = orbAt(g, o, k);
          c.globalAlpha = i ? 0.25 * (4 - i) / 4 : 1;
          c.fillStyle = i ? '#FFD23F' : '#FFF6C0';
          c.beginPath(); c.arc(p.x, p.y, (i ? 7 - i : 7) * R.L.s, 0, TAU); c.fill();
        }
        const p = orbAt(g, o, clamp(o.t / o.dur, 0, 1));
        c.globalAlpha = 0.5; c.fillStyle = '#FFB020'; c.beginPath(); c.arc(p.x, p.y, 12 * R.L.s, 0, TAU); c.fill();
        c.globalAlpha = 1;
      }
    }
    const OP = { x: 0, y: 0 };
    function orbAt(g, o, k) {
      const R = g.rk;
      rocketPos(g, RP);
      const tx = RP.x, ty = RP.cy + R.L.rh * 0.1;
      const cx = (o.x0 + tx) / 2 + (o.x0 < tx ? -1 : 1) * 40 * R.L.s, cy = Math.min(o.y0, ty) - 60 * R.L.s;
      const u = 1 - k;
      OP.x = u * u * o.x0 + 2 * u * k * cx + k * k * tx;
      OP.y = u * u * o.y0 + 2 * u * k * cy + k * k * ty;
      return OP;
    }
    function showTip(g, R) { return !R.tipDone && R.idx === 0 && g.state === 'play' && R.fly === 'read' && (R.ph === 'ready' || R.ph === 'count' || R.ph === 'run'); }
    function drawHints(g, c) {
      const R = g.rk, L = R.L, s = L.s, t = R.clock;
      if (!showTip(g, R) || R.micOn) return;
      // 第一句：一闪一闪的手指点着 🔥
      const blink = 0.45 + 0.55 * Math.abs(Math.sin(t * 5));
      const bob = Math.abs(Math.sin(t * 5)) * 10 * s;
      g.emoji('👆', L.fireX + L.fireR * 0.62, L.fireY + L.fireR * 0.62 + bob, 46 * s, { alpha: blink, rot: -0.35 });
    }

    /* ---------- spec ---------- */
    return {
      maxLevel: 10, lives: 3, rounds: 4, music: 'calm', sky: null,
      intro: '跟着跳跳球大声读，把火箭送上月球！',
      controls: '球落到字上就点🔥（空格也行）· 有麦克风就大声读',
      init(g) {
        micStart(P);            // 第一次在“开始”按钮的点击里请求麦克风（失败立即降级为节拍模式）
        g.rk = newState();
        W.__hwRocket = g;       // 试玩脚本读状态用
        layout(g);
        buildLevel(g);
        genWorld(g);
        if (g.rk.phrases.length) { g.rk.idx = 0; setPhrase(g, 0); }
      },
      play(g) { startFlow(g); },
      update(g, dt) {
        const R = g.rk;
        if (!R) return;
        if (!R.started) startFlow(g);
        const m = P.mic;
        micRead(m, dt, R.ph !== 'run');
        const micOn = !!(m && m.state === 'on');
        if (micOn && !P.musicOff) { P.musicOff = true; g.music(false); }   // 开麦时关背景音乐，免得被当成说话声
        if (R.ph === 'ready' || R.ph === 'count' || R.ph === 'intro') R.micOn = micOn;
        if (!R.cur) return;
        if (R.ph === 'ready') {
          if (!R.demoing) R.phT += dt;
          if (R.phT >= R.readyWait) startCount(g);
        } else if (R.ph === 'count') {
          const prev = R.cT;
          R.cT += dt;
          if (prev < R.ci && R.cT >= R.ci) g.sfx('tick');
          if (R.cT >= R.ci * 2) startRun(g);
        } else if (R.ph === 'run') {
          R.rt += dt;
          const ph = R.cur, mw = R.beat * 0.45, win = R.micOn ? Math.max(R.goodW, mw) : R.goodW;
          for (const c of ph.hans) {
            if (c.st) continue;
            if (c.t - R.rt > win) break;
            if (R.micOn && Math.abs(R.rt - c.t) <= mw) { c.vf += dt; if (m && m.voiced) c.vv += dt; }
            if (!c.lit && R.rt >= c.t) { c.lit = true; c.pop = Math.max(c.pop, 0.55); }
            if (R.rt > c.t + win) {
              if (R.micOn && c.vf > 0 && c.vv / c.vf >= 0.3) judge(g, c, 2, 'mic');
              else miss(g, c);
            }
          }
          if (R.rt > ph.lastT + win + 0.3) { endPhrase(g); return; }
        }
        // 句中爬升：点中 / 出声 → 升；安静 → 慢慢往下掉
        if (R.fly === 'read') {
          if (R.ph === 'run') {
            const ph = R.cur, per = 0.55 / (ph.nHan * R.beat);
            R.thrust = 0;
            if (R.micOn && m) {
              const v = clamp((m.lvl - m.thr) / (m.thr * 2.5), 0, 1);
              R.thrust = v;
              if (v > 0.05) { R.climbT = Math.min(0.62, R.climbT + v * per * 1.1 * dt); R.lastVoice = R.rt; }
            }
            const lastAct = Math.max(R.lastHitRt, R.micOn ? R.lastVoice : -9);
            if (R.rt > ph.t0 && R.rt - lastAct > R.beat * 1.3) R.climbT = Math.max(0, R.climbT - per * 0.7 * dt);
          }
          R.climb += (R.climbT - R.climb) * Math.min(1, dt * 4);
          R.alt = R.stage + R.climb;
        }
        // 燃料球
        for (let i = R.orbs.length - 1; i >= 0; i--) {
          const o = R.orbs[i];
          o.t += dt;
          if (o.t >= o.dur) {
            R.orbs.splice(i, 1);
            if (R.fly === 'read' && R.ph === 'run') {
              const ph = R.cur;
              R.climbT = Math.min(0.62, R.climbT + o.q * 0.55 / ph.nHan * 1.2);
              R.kick = 1;
              rocketPos(g, RP);
              g.burst(RP.x, RP.yb + 6, { kind: 'spark', n: 5, color: '#FFB020' });
            }
          }
        }
      },
      draw(g, c) {
        const R = g.rk;
        if (!R || !R.L) return;
        const tn = nowMs();
        let dt = R.lastNow ? (tn - R.lastNow) / 1000 : 0;
        R.lastNow = tn;
        dt = g.state === 'pause' ? 0 : clamp(dt, 0, 0.05);
        visTick(g, dt);
        drawWorld(g, c);
        drawPanel(g, c);
        drawOrbs(g, c);
        for (const p of R.puffs) if (p.screen) drawPuff(c, p);
        drawHints(g, c);
      },
      down(g, p) {
        const R = g.rk;
        if (!R || !R.L) return;
        micResume(P);
        const L = R.L;
        if (ttsOk() && g.hitCircle(p, L.spkX, L.spkY, L.spkR + 10 * L.s)) {
          R.spkPress = 1;
          if (R.ph === 'ready') playDemo(g); else g.sfx('tick');
          return;
        }
        if (p.y < g.hudTop) return;
        fire(g);
      },
      key(g, k) {
        if (k === 'space' || k === 'up') fire(g);
        else if (k === 'enter') { const R = g.rk; if (R && R.ph === 'ready') playDemo(g); }
      },
      resize(g) { if (g.rk) layout(g); },
      end(g) {
        P.dead = true;
        micStop(P);
        if (W.__hwRocket === g) W.__hwRocket = null;
      }
    };
  }
})();
