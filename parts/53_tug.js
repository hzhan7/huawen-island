/* =====================================================================
 * 华文小岛 3.0 · 街机游戏 🪢 兄妹拔河抢字（parts/53_tug.js）
 *
 * 玩法：歌留多（かるた）抢牌 + 拔河。朗读一个词（或“晴天的晴”这样用词定字），两边的字卡里都有它，
 *   谁先拍中写对的那张，绳子就往谁那边拉；拍错 → 手被锁住（P2 1.1 秒 / P3 1.3 秒 / P4+ 1.5 秒），
 *   脚下一滑，绳子被对面拉走一格。绳子中间的红标过了自己这边的线 = 对面的宠物掉进小河 = 赢。
 * 模式：🦀 挑战岛主（一个人，三局两胜；岛主的出手时间 = 孩子最近的抢卡用时 × 关卡系数，按正确率再调快调慢，
 *         前几关另有保底时间，P2 第 1 关至少 3 秒；拍错一次岛主就趁机冲近一截 → 乱拍几下卡就被抢走）
 *         一局里连抢 3 张以后“大力拉”（一次两格），每局重新数。
 *       👫 兄妹对战（同屏两人，三局两胜；各按自己的年级出卡：低年级卡少、干扰远；低两个年级以上的一方每次拉两格）。
 *         同一台设备上有别的孩子档案时，对面那一半写他 / 她的名字、默认用他 / 她的年级（只读本地档案，不写别人的档案）。
 *   题目一轮从低年级题库出、一轮从高年级题库出（两边的卡组里都有答案）。拍错过 / 没抢到的题隔一题再出一次（只回来 1 次）。
 *   单字题的干扰字不用多音字（含“一 / 不”变调），读音拿不准的一律不上卡。
 * 华文就是规则：卡上只有汉字、不注拼音；听到的是词（pick 先读词再读例句 ctx，所以“公园/公元”靠语境分）
 *   或“晴天的晴”（干扰字是同音不同调、近音、同声旁的字——换进词里读音不同，只有一张对得上）。
 *   把汉字换成色块就无从下手（换皮测试）；乱拍 = 一次次被锁 + 绳子一次次被拉走（乱按测试）。
 * 错题本：只有“听了、拍错字卡”才 g.wrong(题, 说明)，且同一题一局只记一次；被对手 / 岛主抢先 = g.miss（手慢）；
 *   抢跑（开念 0.5 秒内拍任何卡，拍中也不算；或词还没念完、开念 0.7–1.1 秒内拍了错卡）、或这一题在锁住时还在狂拍 = 乱按，
 *   只罚游戏（锁手、绳子被拉走一格、岛主冲过来、断连击；抢跑拍到的卡不作废，乱拍拿不到排除法），用 g.wrong(null) 不进错题本；
 *   抢跑或锁着连拍过以后记成“在乱按”，直到下一次听完、一次抢对才解除，期间拍错不进错题本、碰巧拍中也只 g.right(undefined)；
 *   高关字卡换位置后 0.8 秒内拍错（拍到的或正确的那张刚换过位置）= 手没跟上卡片，也不进错题本；
 *   第二个孩子（对手）的操作不记进当前档案；高于本档案年级的题拍错只算分不进错题本。
 *   每次 g.right / g.wrong 传的题 = 题库原对象的浅拷贝 + hz（本题掌握的字或词），同一题两次调用内容一致，
 *   所以错题本的 key 前后对得上（重练时 g.items 取回的题已带 hz，原样再拷贝一次，key 不变）。
 * 输入：引擎的 spec.down 只认第一根手指，两人同屏必须同时按 → 本游戏在画布上自己挂 pointerdown（每根手指各算各的）。
 *   键盘：左边 / 一个人 Q W E R · A S D F（一个人时也可按 1–8），右边 Y U I O · H J K L；空格 / 回车 = 再听一遍。
 * 借鉴：pinkrec6/kanjiGame（仓库没有许可证 → 只借玩法：pointerdown 双人同时按、点错锁 1.5 秒、先到者得分；
 *   没有复制任何代码或素材）。画面全部 Canvas 自绘 + emoji 精灵，音效用引擎的 WebAudio 合成。
 * 暂停：引擎会掐断朗读 → 继续时重念这一题，岛主从头想。第一次玩：前两题字卡上方写“听到哪个词，就拍哪张卡！”（不指答案）。
 * 调试：window.__hwTug = { st, tap(side, correct), cardXY(side, correct), sample(lv, n, side) }（无头测试用；sample 只读）。
 * ===================================================================== */
(function () {
  'use strict';
  const W = window, D = document;
  const HW = W.HW;
  if (!HW || typeof HW.register !== 'function') return;

  const NAVY = '#1d2b53';
  const TAU = Math.PI * 2;
  const GRADES = ['p2', 'p3', 'p4', 'p5', 'p6'];
  const TEAM = {
    A: { c: '#2F8FFF', d: '#1A5FB8', l: '#DCEEFF', m0: '#FFF8E0', m1: '#F0DCA6' },
    B: { c: '#FF5C8A', d: '#BF2F5B', l: '#FFE1EA', m0: '#FFF3EA', m1: '#F3D0B6' },
    AI: { c: '#FF8A1C', d: '#B35400', l: '#FFE6C8', m0: '#FFF3EA', m1: '#F3D0B6' }
  };
  const PETS = ['🐰', '🐼', '🐯', '🦊', '🐨', '🐶', '🐱'];
  const KEYS_A = ['qwer', 'asdf', 'zxcv'];
  const KEYS_B = ['yuio', 'hjkl', 'nm,.'];
  const DIG = '12345678';
  const PRAISE = ['抢到啦！', '好耳朵！', '手真快！', '嘿哟！', '拉过来！'];
  /* 多音字 / 读音易混的字：不出“X 的 X”单字题（TTS 读孤立的最后一个字可能读错），拿不准就不出 */
  const POLY = new Set(Array.from('长行重还了着地得的和好为发乐便教觉数少种中间当相空调背结只干转传朝分更差冲处答倒都恶给号横会几假将降角卷看落没难泡喷强曲散扇省盛似宿随弹挑吐应与载扎正挣仔作薄奔称大担奇系率露模参待藏曾乘属提鲜血要一不什么划哄漂片兴度覆供量色舍石识缩弄把车夹壳哪呢啊吧尽铺期切亲圈任塞扫上场禁尽泊剥折钉磨冠恐片数晃'));
  /* 关卡：win 胜利线格数；ai 岛主出手系数（×孩子的平均用时）；fum 岛主手滑概率；mot 卡片晃动；
     near 近似干扰比例（高年级一侧至少 0.5）；charQ 单字题比例；shuf 卡片会换位置 */
  const LV = [null,
    { win: 4, ai: 1.75, fum: 0.22, mot: 0, near: 0, charQ: 0, shuf: 0 },
    { win: 4, ai: 1.55, fum: 0.17, mot: 0, near: 0.25, charQ: 0.15, shuf: 0 },
    { win: 5, ai: 1.4, fum: 0.14, mot: 1, near: 0.4, charQ: 0.3, shuf: 0 },
    { win: 5, ai: 1.28, fum: 0.11, mot: 1, near: 0.5, charQ: 0.35, shuf: 0 },
    { win: 5, ai: 1.12, fum: 0.09, mot: 2, near: 0.65, charQ: 0.4, shuf: 0 },
    { win: 5, ai: 1.0, fum: 0.07, mot: 2, near: 0.8, charQ: 0.4, shuf: 1 },
    { win: 6, ai: 0.9, fum: 0.05, mot: 3, near: 0.9, charQ: 0.45, shuf: 1 },
    { win: 6, ai: 0.82, fum: 0.04, mot: 3, near: 1, charQ: 0.5, shuf: 1 }   // 高关：岛主出手（再加 0.3 秒钳子飞过去）≈ 孩子平时的用时，要比平时快才抢得到
  ];
  const MAXLV = LV.length - 1;
  /* pick 题先读词再读例句：低关让岛主多等一会儿（给孩子听例句分“一只 / 一支”），高关只听词就要抢 */
  const WAITB = [0, 1.1, 1.0, 0.9, 0.8, 0.65, 0.55, 0.45, 0.35];

  /* ================= 小工具 ================= */
  const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
  const lerp = (a, b, t) => a + (b - a) * t;
  const isHan = (ch) => /[㐀-鿿豈-﫿]/.test(ch);
  const arr = (x) => (Array.isArray(x) ? x : []);
  const chs = (s) => Array.from(String(s == null ? '' : s));
  const nfc = (s) => String(s == null ? '' : s).normalize('NFC').trim().toLowerCase();
  const nowMs = () => (W.performance && performance.now ? performance.now() : Date.now());
  function shuffle(a0) {
    const a = Array.from(a0 || []);
    for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); const t = a[i]; a[i] = a[j]; a[j] = t; }
    return a;
  }
  function toneless(py) {
    return String(py || '').toLowerCase().replace(/[ǖǘǚǜü]/g, 'v').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z]/g, '');
  }
  function toneOf(sy) {
    const m = String(sy).normalize('NFD').match(/[̄́̌̀]/);
    return m ? '̄́̌̀'.indexOf(m[0]) + 1 : 5;
  }
  const INITIALS = ['zh', 'ch', 'sh', 'b', 'p', 'm', 'f', 'd', 't', 'n', 'l', 'g', 'k', 'h', 'j', 'q', 'x', 'r', 'z', 'c', 's', 'y', 'w'];
  function splitPy(s) {
    for (const i of INITIALS) if (s.length > i.length && s.indexOf(i) === 0) return [i, s.slice(i.length)];
    return ['', s];
  }
  const NEAR_I = { z: 'zh', zh: 'z', c: 'ch', ch: 'c', s: 'sh', sh: 's', n: 'l', l: 'n', f: 'h', h: 'f' };
  const NEAR_F = { in: 'ing', ing: 'in', en: 'eng', eng: 'en', an: 'ang', ang: 'an', ian: 'iang', iang: 'ian' };
  function rr(c, x, y, w, h, r) {
    r = Math.max(0, Math.min(r || 0, w / 2, h / 2));
    c.beginPath();
    c.moveTo(x + r, y);
    c.arcTo(x + w, y, x + w, y + h, r); c.arcTo(x + w, y + h, x, y + h, r);
    c.arcTo(x, y + h, x, y, r); c.arcTo(x, y, x + w, y, r);
    c.closePath();
  }

  /* ================= 题库读音表（全部年级；只认带拼音的条目） ================= */
  let RD = null, ALLW = null, WPY = null, FAM = null;
  function allData() { const d = W.HW_DATA; return d && typeof d === 'object' ? d : {}; }
  function readings() {
    if (RD) return RD;
    RD = new Map(); ALLW = new Set(); WPY = new Map(); FAM = new Map();
    const add = (text, py) => {
      if (typeof text !== 'string') return;
      const t = text.trim(), a = chs(t);
      if (a.length >= 2 && a.every(isHan)) ALLW.add(t);
      if (typeof py !== 'string') return;
      const cs = a.filter(isHan), sy = py.trim().split(/\s+/).filter(Boolean);
      if (!cs.length || cs.length !== sy.length) return;
      if (cs.length === a.length && a.length >= 2 && !WPY.has(t)) WPY.set(t, sy.join(' '));
      cs.forEach((ch, i) => {
        let r = RD.get(ch);
        if (!r) { r = { tf: new Set(), tl: new Set(), tones: new Set() }; RD.set(ch, r); }
        const s = nfc(sy[i]); r.tf.add(s); r.tl.add(toneless(s));
        const tn = toneOf(s); if (tn < 5) r.tones.add(tn);
      });
    };
    const all = allData();
    for (const gr in all) {
      const G = all[gr] || {};
      arr(G.chars).forEach((x) => { if (x) { add(x.c, x.py); arr(x.words).forEach((w) => add(w, null)); } });
      arr(G.words).forEach((x) => x && add(x.w, x.py));
      arr(G.pick).forEach((x) => { if (x) { add(x.say, x.py); arr(x.c).forEach((w) => add(w, null)); } });
      arr(G.build).forEach((x) => {
        if (!x) return;
        add(x.ans, x.py); add(x.hint, null);
        if (typeof x.base === 'string' && typeof x.ans === 'string') {   // 同声旁家族（形近）：青 → 晴 请 清 …
          let f = FAM.get(x.base); if (!f) { f = new Set([x.base]); FAM.set(x.base, f); }
          f.add(x.ans.trim());
        }
      });
      arr(G.readaloud).forEach((x) => x && arr(x.hard).forEach((h) => h && add(h.w, h.py)));
    }
    return RD;
  }
  function isPoly(ch) {
    if (POLY.has(ch)) return true;
    const r = readings().get(ch);
    return !r || r.tl.size > 1 || r.tones.size > 1;
  }
  /* 词的无调拼音：每个字只有一种读法才算得出来；算不出 → null */
  function deriveTl(t) {
    const rd = readings(), out = [];
    for (const ch of chs(t)) { const r = rd.get(ch); if (!r || r.tl.size !== 1) return null; out.push(r.tl.values().next().value); }
    return out;
  }
  /* 候选词会不会和目标同音（无调）：长度一样且每个字都“可能”读成目标那个音节。读音不明的字当作可能同音（保守） */
  function maybeHomophone(tgt, t, syl) {
    const a = chs(t);
    if (!tgt || a.length !== tgt.length) return false;
    const rd = readings();
    for (let i = 0; i < a.length; i++) {
      if (syl && syl[i]) { if (syl[i] !== tgt[i]) return false; continue; }
      const r = rd.get(a[i]);
      if (r && !r.tl.has(tgt[i])) return false;
    }
    return true;
  }
  /* 每个年级“能用的字词”：该年级及以下各年级的 words / pick / chars */
  const POOL = Object.create(null);
  function gIdx(gr) { const i = GRADES.indexOf(gr); return i < 0 ? 1 : i; }
  function pool(gr) {
    if (POOL[gr]) return POOL[gr];
    const rd = readings();
    const words = new Map(), cs = new Set();
    const addW = (t0, py) => {
      if (typeof t0 !== 'string') return;
      const t = t0.trim(), a = chs(t);
      if (a.length < 2 || a.length > 5 || !a.every(isHan)) return;
      const syl0 = typeof py === 'string' ? py.trim().split(/\s+/).map(toneless) : null;
      const syl = syl0 && syl0.length === a.length ? syl0 : null;
      const cur = words.get(t);
      if (cur) { if (!cur.syl && syl) cur.syl = syl; return; }
      words.set(t, { t, n: a.length, syl });
      a.forEach((ch) => { if (rd.has(ch)) cs.add(ch); });
    };
    const all = allData();
    for (let i = 0; i <= gIdx(gr); i++) {
      const G = all[GRADES[i]] || {};
      arr(G.words).forEach((x) => x && addW(x.w, x.py));
      arr(G.pick).forEach((x) => x && addW(x.say, x.py));
      arr(G.chars).forEach((x) => {
        if (!x) return;
        if (typeof x.c === 'string' && rd.has(x.c.trim())) cs.add(x.c.trim());
        arr(x.words).forEach((w) => addW(w, null));
      });
    }
    POOL[gr] = { words: Array.from(words.values()), chars: Array.from(cs), wmap: words };
    return POOL[gr];
  }

  /* ================= 出题 ================= */
  function qPick(it, gr) {
    if (!it || typeof it.say !== 'string' || typeof it.py !== 'string') return null;
    const ans = it.say.trim(), a = chs(ans), syl = it.py.trim().split(/\s+/);
    if (!a.length || !a.every(isHan) || syl.length !== a.length) return null;
    const cx = typeof it.ctx === 'string' && it.ctx.indexOf(ans) >= 0 ? it.ctx.trim() : '';
    let near = arr(it.c).map((x) => (typeof x === 'string' ? x.trim() : '')).filter((x) => x && x !== ans && chs(x).every(isHan));
    if (!cx) { const tl0 = syl.map(toneless); near = near.filter((x) => !maybeHomophone(tl0, x, null)); }   // 没有例句可听：同音的选项分不出来，不上卡
    const say = cx ? ans + '。' + cx : ans;
    return { col: 'pick', item: it, gr, kind: 'w', ans, tl: syl.map(toneless), py: it.py.trim(), say1: say, say2: say, cap: it.py.trim(), near, wait: cx ? 1 : 0 };
  }
  function qWords(it, gr) {
    if (!it || typeof it.w !== 'string' || typeof it.py !== 'string') return null;
    const ans = it.w.trim(), a = chs(ans), syl = it.py.trim().split(/\s+/);
    if (!a.length || !a.every(isHan) || syl.length !== a.length) return null;
    const s = typeof it.s === 'string' && it.s.indexOf(ans) >= 0 ? it.s.trim() : '';
    return { col: 'words', item: it, gr, kind: 'w', ans, tl: syl.map(toneless), py: it.py.trim(), say1: ans, say2: s ? ans + '。' + s : ans, cap: it.py.trim(), near: [], wait: 0 };
  }
  function qCharWord(it, gr, w) {
    const ans = String(w || '').trim(), a = chs(ans);
    if (a.length < 2 || a.length > 4 || !a.every(isHan)) return null;
    readings();
    const tl = deriveTl(ans);
    if (!tl) return null;
    const py = WPY.get(ans) || '';
    return { col: 'chars', item: it, gr, kind: 'w', ans, tl, py, say1: ans, say2: ans, cap: py, near: [], wait: 0 };   // 没有课本注音 → 字幕交给引擎 g.pinyinOf（带调，拿不准给 ·）
  }
  function qChar(it, gr) {
    if (!it || typeof it.c !== 'string' || typeof it.py !== 'string') return null;
    const ch = it.c.trim();
    if (chs(ch).length !== 1 || !isHan(ch) || isPoly(ch)) return null;
    const tf = nfc(it.py);
    if (!tf || /\s/.test(tf)) return null;
    const r = readings().get(ch);
    if (!r || !r.tf.has(tf)) return null;
    const ws = arr(it.words).filter((w) => typeof w === 'string' && chs(w).length >= 2 && chs(w).length <= 3 && w.indexOf(ch) >= 0 && chs(w).every(isHan));
    if (!ws.length) return null;
    const cw = ws[0].trim();
    const wp = WPY.get(cw);
    return { col: 'chars', item: it, gr, kind: 'c', ans: ch, tf, tl: [toneless(tf)], ctxW: cw, py: it.py.trim(), say1: cw + '的' + ch, say2: cw + '的' + ch, cap: (wp ? wp + ' de ' : '') + it.py.trim(), near: [], wait: 0.4 };
  }
  function qOfChars(it, gr, charShare) {
    const ws = shuffle(arr(it && it.words));
    const wordQ = () => { for (const w of ws) { const q = qCharWord(it, gr, w); if (q) return q; } return null; };
    if (Math.random() < charShare) return qChar(it, gr) || wordQ();
    return wordQ();
  }
  /* 错题重练：按记录里的 hz 还原当时那道题 */
  function qFromRec(col, it, gr) {
    if (col === 'pick') return qPick(it, gr);
    if (col === 'words') return qWords(it, gr);
    if (col === 'chars' && it) {
      const hz = typeof it.hz === 'string' ? it.hz : '';
      if (hz && hz !== it.c && arr(it.words).indexOf(hz) >= 0) return qCharWord(it, gr, hz);
      return qChar(it, gr) || qOfChars(it, gr, 0);
    }
    return null;
  }

  /* ================= 配卡（干扰项） ================= */
  function takeInto(out, list, k, seen) {
    for (const t of list) { if (k <= 0) break; if (seen.has(t)) continue; seen.add(t); out.push(t); k--; }
  }
  function wordHand(q, gr, need, nearK, midK, hard) {
    const P = pool(gr), ans = q.ans, aa = chs(ans), aset = new Set(aa);
    const seen = new Set([ans]);
    const near = shuffle(q.near);
    const mid = [], far = [];
    for (const w of shuffle(P.words)) {
      if (seen.has(w.t) || w.t.indexOf(ans) >= 0 || ans.indexOf(w.t) >= 0) continue;
      if (maybeHomophone(q.tl, w.t, w.syl)) continue;   // 同音词不能当干扰（听不出区别）
      if (chs(w.t).some((ch) => aset.has(ch))) mid.push(w.t); else far.push(w.t);
    }
    const byLen = (list) => list.sort((x, y) => Math.abs(chs(x).length - aa.length) - Math.abs(chs(y).length - aa.length));
    byLen(mid); byLen(far);
    return fillHand(near, mid, far, need, nearK, midK, hard, seen);
  }
  /* 先按比例取近似 / 半像，其余用远的；hard（P3 以上）时近似不够就用半像的补，免得高关全是一眼能排除的卡 */
  function fillHand(near, mid, far, need, nearK, midK, hard, seen) {
    const out = [];
    takeInto(out, near, nearK, seen);
    takeInto(out, mid, midK + (hard ? nearK - out.length : 0), seen);
    takeInto(out, far, need - out.length, seen);
    takeInto(out, mid, need - out.length, seen);
    takeInto(out, near, need - out.length, seen);
    return out;
  }
  function charHand(q, gr, need, nearK, midK, hard) {
    const P = pool(gr), rd = readings(), ch = q.ans, tf = q.tf, tl = q.tl[0];
    const [ini, fin] = splitPy(tl);
    const near = [], mid = [], far = [], fam = [];
    const safe = (d) => {
      if (!d || d === ch || q.ctxW.indexOf(d) >= 0 || !isHan(d)) return false;
      if (isPoly(d)) return false;                                // 多音字（含“一/不”变调）读音拿不准 → 不当干扰卡
      const r = rd.get(d);
      if (!r || r.tf.has(tf)) return false;                       // 读音一模一样：“公园的园”也能听成“公元的元” → 不要
      if (ALLW.has(q.ctxW.split(ch).join(d))) return false;      // 换进词里还是个词 → 不要
      return true;
    };
    for (const [, f] of FAM) if (f.has(ch)) for (const d of f) if (safe(d) && P.chars.indexOf(d) >= 0) fam.push(d);
    for (const d of shuffle(P.chars)) {
      if (!safe(d)) continue;
      const r = rd.get(d);
      let tier = 3;
      for (const s of r.tl) {
        if (s === tl) { tier = 0; break; }
        const [i2, f2] = splitPy(s);
        if ((f2 === fin && ini && NEAR_I[ini] === i2) || (i2 === ini && NEAR_F[fin] === f2)) tier = Math.min(tier, 1);
        else if (f2 === fin || (ini && i2 === ini)) tier = Math.min(tier, 2);
      }
      (tier <= 1 ? near : tier === 2 ? mid : far).push(d);
    }
    const seen = new Set([ch]);
    const near2 = shuffle(fam).slice(0, 2).concat(near);   // 同声旁的形近字（最多 2 个）排在最前
    return fillHand(near2, mid, far, need, nearK, midK, hard, seen);
  }
  function nCards(gn, lv) { return gn <= 2 ? (lv <= 4 ? 4 : 6) : gn === 3 ? (lv <= 2 ? 4 : 6) : (lv <= 2 ? 6 : 8); }
  function mixFor(gn, lv, need) {
    const L = LV[lv];
    const nearF = gn <= 2 ? (lv >= 3 ? L.near * 0.5 : 0) : gn === 3 ? L.near * 0.8 : Math.max(0.5, L.near);
    const midF = gn <= 2 ? (lv >= 2 ? 0.34 : 0) : 0.5;
    const nearK = Math.round(need * nearF);
    return { nearK, midK: Math.round((need - nearK) * midF) };
  }

  /* 同一台设备上的其他孩子（兄妹对战时给对面那一半写上名字、默认用他 / 她的年级）。
     核心没有列档案的接口，这里只读本地档案；读不到 / 格式不对 → 空数组，对面就叫“对手”。只读，不写别人的档案 */
  function otherKids(me) {
    try {
      const raw = W.localStorage && W.localStorage.getItem('hw.v1.profiles');
      const all = raw ? JSON.parse(raw) : null;
      if (!all || typeof all !== 'object') return [];
      const out = [];
      for (const k in all) {
        const p = all[k];
        if (!p || typeof p.name !== 'string' || !p.name.trim() || GRADES.indexOf(p.grade) < 0) continue;
        if (me && p.name === me.name && (p.avatar || '') === (me.avatar || '')) continue;
        out.push({ name: p.name.trim().slice(0, 8), gr: p.grade, pet: typeof p.avatar === 'string' && p.avatar ? p.avatar.slice(0, 8) : '🐰' });
      }
      return out.slice(0, 4);
    } catch (e) { return []; }
  }

  /* ================= 游戏 ================= */
  function makeSpec(ctx) {
    const st = {
      g: null, chosen: false, mode: 'solo', rg: 'p2', lv: 1, win: 5,
      phase: 'wait', pt: 0, rt: 0, t: 0, vt: 0, lastNow: 0,
      L: { S: 1, hh: 40 }, A: null, B: null, humans: [],
      pos: 0, show: 0, vel: 0, creep: 0, dustT: 0, recorded: new Set(),
      qs: [], qi: 0, qn: 0, maxQ: 18, q: null, sets: { A: 0, B: 0 }, setNo: 1,
      flyers: [], claws: [], fl: [], big: null, finaleWin: null, shufT: 0, splashT: 0,
      ema: 0, hist: [], aiStreak: 0, kbd: false, fine: false, hover: null,
      lobby: null, lobbySel: 0, clouds: [], dots: [], cv: null, onPtr: null, kids: [], rival: null, seen: false, tipN: 0
    };
    const TMP = { x: 0, y: 0 }, TMP2 = { x: 0, y: 0 };
    try { st.fine = !!(W.matchMedia && W.matchMedia('(hover: hover) and (pointer: fine)').matches); } catch (e) { st.fine = false; }
    const hostGn = Number(String(ctx.grade || 'p3').slice(1)) || 3;
    st.rg = 'p' + clamp(hostGn >= 4 ? hostGn - 2 : hostGn + 2, 2, 6);
    st.kids = otherKids(ctx.profile);
    if (st.kids.length === 1) { st.rival = st.kids[0]; st.rg = st.rival.gr; }   // 家里就两个孩子：对面默认就是他 / 她
    try {
      const m = ctx.mem.get('tug');
      if (m && typeof m === 'object') {
        if (GRADES.indexOf(m.rg) >= 0) st.rg = m.rg;
        if (m.m === 'duel') st.lobbySel = 1;
        if (typeof m.rv === 'string') st.rival = st.kids.find((k) => k.name === m.rv) || null;
        if (m.seen) st.seen = true;
      }
    } catch (e) { /* ignore */ }

    /* ---------- 布局 ---------- */
    function setRect(sd, x, y, w, h, rot) {
      if (!sd) return;
      const R = sd.R;
      R.x = x; R.y = y; R.w = w; R.h = h; R.cx = x + w / 2; R.cy = y + h / 2; R.rot = rot;
    }
    function lay(g) {
      const L = st.L, top = g.hudTop, H = g.h - top, Wd = g.w;
      L.S = clamp(Math.min(Wd / 390, H / 700), 0.85, 1.6);
      const S = L.S;
      L.wide = Wd >= H * 1.05;
      L.vert = st.mode === 'duel' && !L.wide;
      L.hh = Math.round(42 * S);
      const pad = 10 * S;
      if (!L.vert) {
        const sh = Math.round(clamp(H * (L.wide ? 0.4 : 0.36), 170, 360));
        L.sceneT = top; L.sceneB = top + sh;
        L.seaY = top + sh * 0.3; L.sandY = top + sh * 0.42;
        L.cx = Wd / 2; L.cy = L.sandY + (L.sceneB - L.sandY) * 0.34;
        L.len = Wd; L.thick = sh;
        L.petR = clamp(Math.min(sh * 0.17, Wd * 0.07), 22, 54);
        const py0 = L.sceneB + pad * 0.7, ph = g.h - py0 - pad;
        if (st.mode === 'duel') {
          const pw = (Wd - pad * 3) / 2;
          setRect(st.A, pad, py0, pw, ph, 0); setRect(st.B, pad * 2 + pw, py0, pw, ph, 0);
        } else {
          const pw = Math.min(Wd - pad * 2, 780 * S);
          setRect(st.A, (Wd - pw) / 2, py0, pw, ph, 0);
        }
        L.rbr = 25 * S; L.rbx = L.cx; L.rby = L.sceneT + 32 * S;
      } else {
        const bh = Math.round(clamp(H * 0.4, 220, 470)), ph = (H - bh) / 2;
        setRect(st.B, pad, top + pad * 0.4, Wd - pad * 2, ph - pad * 0.8, Math.PI);
        L.sceneT = top + ph; L.sceneB = top + ph + bh;
        L.cx = Wd / 2; L.cy = top + ph + bh / 2;
        setRect(st.A, pad, top + ph + bh + pad * 0.4, Wd - pad * 2, ph - pad * 0.8, 0);
        L.len = bh; L.thick = Wd;
        L.petR = clamp(bh * 0.085, 18, 40);
        L.rbr = 24 * S; L.rbx = 16 * S + L.rbr; L.rby = L.cy;
      }
      const half = L.len / 2;
      if (L.vert) {
        /* 面对面竖版：沙滩带只有屏高的 40%。开局两只宠物都要站在河岸上（不能一开局就泡在水里），
           输的一方最后被拽过河中线；赢的一方退到沙滩边上 */
        L.D = (half - L.petR * 1.05) / 2;
        L.step = L.D * 1.1 / st.win;
        L.poolHW = clamp((L.D - L.petR) * 0.55, L.petR * 0.45, L.petR * 1.2);
      } else {
        const maxReach = half - L.petR * 2.2;   // 横版：宠物 + 脚边的篮子 + 张数牌都要留在屏幕里
        L.D = maxReach * 0.46;
        L.step = (maxReach - L.D) / st.win;
        L.poolHW = Math.max(L.petR * 0.85, L.D - L.step * st.win * 0.72 - L.petR * 0.3);
      }
      const c = g.c;
      const gr = (x0, y0, x1, y1, stops) => { const q = c.createLinearGradient(x0, y0, x1, y1); for (let i = 0; i < stops.length; i += 2) q.addColorStop(stops[i], stops[i + 1]); return q; };
      L.gSky = gr(0, 0, 0, L.seaY || 1, [0, '#3DB2F7', 0.75, '#9FDDFF', 1, '#D9F3FF']);
      L.gSea = gr(0, L.seaY || 0, 0, (L.sandY || 1) + 1, [0, '#1FB5C9', 1, '#57D7D2']);
      L.gSand = gr(0, L.sandY || 0, 0, L.sceneB, [0, '#FFE9A8', 1, '#F4CC74']);
      L.gSandV = gr(0, L.sceneT, 0, L.sceneB, [0, '#F4CC74', 0.5, '#FFE9A8', 1, '#F4CC74']);
      L.gDeck = gr(0, L.vert ? 0 : L.sceneB, 0, g.h, [0, '#C98B4F', 1, '#A86A35']);
      L.gWater = L.vert ? gr(0, L.cy - L.poolHW, 0, L.cy + L.poolHW, [0, '#2AA7D6', 0.5, '#5FD0F0', 1, '#2AA7D6'])
        : gr(L.cx - L.poolHW, 0, L.cx + L.poolHW, 0, [0, '#2AA7D6', 0.5, '#62D3F2', 1, '#2AA7D6']);
      for (const sd of st.humans) {
        sd.matGrad = gr(0, -sd.R.h / 2, 0, sd.R.h / 2, [0, sd.team.m0, 1, sd.team.m1]);
        placeCards(sd, true);
      }
    }
    function gridFor(n, w, h, S) {
      const gap = (10 + (LV[st.lv] ? LV[st.lv].mot : 0) * 5) * S;   // 卡片会晃的关卡留宽一点缝，晃起来不重叠
      let best = null;
      for (let cols = 2; cols <= 4; cols++) {
        if (cols > n) break;
        const rows = Math.ceil(n / cols);
        let cw = (w - gap * (cols + 1)) / cols, ch = (h - gap * (rows + 1)) / rows;
        if (cw < 20 || ch < 20) continue;
        cw = Math.min(cw, ch * 1.8, 240 * S);
        ch = Math.min(ch, cw * 1.0);
        const m = Math.min(cw, ch * 1.3);
        if (!best || m > best.m + 0.5) best = { cols, rows, cw, ch, gap, m };
      }
      if (!best) best = { cols: 2, rows: Math.ceil(n / 2), cw: Math.max(20, (w - gap * 3) / 2), ch: Math.max(20, (h - gap) / Math.ceil(n / 2) - gap), gap, m: 0 };
      best.n = n;
      return best;
    }
    function placeCards(sd, snap) {
      const S = st.L.S, R = sd.R, hh = st.L.hh;
      const n = sd.cards.length;
      if (!n || !R.w) return;
      const areaT = -R.h / 2 + hh, areaB = R.h / 2 - 6 * S, areaH = areaB - areaT;
      const G = gridFor(n, R.w - 8 * S, areaH, S);
      const gw = G.cols * G.cw + (G.cols - 1) * G.gap, gh = G.rows * G.ch + (G.rows - 1) * G.gap;
      G.x0 = -gw / 2; G.y0 = areaT + (areaH - gh) / 2;
      G.ax = -R.w / 2 + 6 * S; G.ay = areaT; G.aw = R.w - 12 * S; G.ah = areaH;
      sd.grid = G;
      for (const cd of sd.cards) {
        cd.w = G.cw; cd.h = G.ch; fitCard(cd);
        slotKey(sd, cd);
        if (snap) {
          if (cd.mv) { try { cd.mv.cancel(); } catch (e) { /* ignore */ } cd.mv = null; cd.hop = 0; if (cd.a > 0) { cd.sc = 1; cd.rot = 0; } }
          const p = slotXY(sd, cd.si); cd.x = p[0]; cd.y = p[1];
        }
      }
    }
    function slotXY(sd, si) {
      const G = sd.grid;
      const row = Math.floor(si / G.cols), col = si % G.cols;
      const cnt = Math.min(G.cols, G.n - row * G.cols);
      const off = (G.cols - cnt) * (G.cw + G.gap) / 2;
      return [G.x0 + off + col * (G.cw + G.gap) + G.cw / 2, G.y0 + row * (G.ch + G.gap) + G.ch / 2];
    }
    function slotKey(sd, cd) {
      const G = sd.grid, row = Math.floor(cd.si / G.cols), col = cd.si % G.cols;
      const rowKeys = sd.keys[row] || '';
      cd.key = rowKeys[col] || '';
      if (st.mode === 'solo' && !cd.key) cd.key = DIG[cd.si] || '';
    }
    function keySlot(sd, ch) {
      const G = sd.grid;
      if (!G) return -1;
      for (let r = 0; r < G.rows; r++) {
        const i = (sd.keys[r] || '').indexOf(ch);
        if (i >= 0 && i < G.cols) { const si = r * G.cols + i; return si < G.n ? si : -1; }
      }
      if (st.mode === 'solo' && sd.who === 'host') { const i = DIG.indexOf(ch); if (i >= 0 && i < G.n) return i; }
      return -1;
    }
    function fitCard(cd) {
      const a = chs(cd.t), n = Math.max(1, a.length);
      const iw = cd.w * 0.8, ih = cd.h * 0.74;
      const fs1 = Math.min(ih * 0.86, iw / n);
      let lines = [cd.t], fs = fs1;
      if (n >= 4) {
        const k = Math.ceil(n / 2), fs2 = Math.min(ih * 0.47, iw / k);
        if (fs2 > fs1 * 1.15) { lines = [a.slice(0, k).join(''), a.slice(k).join('')]; fs = fs2; }
      }
      cd.lines = lines; cd.fs = Math.max(12, Math.min(110, Math.floor(fs)));
    }
    function toLocal(sd, x, y, out) {
      const R = sd.R, dx = x - R.cx, dy = y - R.cy;
      if (R.rot) { out.x = -dx; out.y = -dy; } else { out.x = dx; out.y = dy; }
      return out;
    }
    function toGlobal(sd, lx, ly, out) {
      const R = sd.R;
      if (R.rot) { out.x = R.cx - lx; out.y = R.cy - ly; } else { out.x = R.cx + lx; out.y = R.cy + ly; }
      return out;
    }
    function sceneXY(u, v, out) {
      const L = st.L;
      if (L.vert) { out.x = L.cx + v; out.y = L.cy - u; } else { out.x = L.cx + u; out.y = L.cy + v; }
      return out;
    }
    function markU() { return (st.show + st.creep) * st.L.step; }   // creep：抢卡时绳子被岛主一点点拽过去（只是画面，不算格数）
    function petU(sd) { return markU() + (sd.id === 'A' ? -st.L.D : st.L.D); }
    function basketXY(sd, out) {
      const L = st.L, sg = sd.id === 'A' ? -1 : 1;
      if (L.vert) return sceneXY(petU(sd), 0, out);
      return sceneXY(petU(sd) + sg * L.petR * 1.0, L.petR * 0.75, out);
    }

    /* ---------- 对局 ---------- */
    function mkSide(id, who, gr, name, pet) {
      const gn = Number(String(gr).slice(1)) || 3;
      return {
        id, who, gr, gn, name, pet, team: who === 'ai' ? TEAM.AI : TEAM[id],
        R: { x: 0, y: 0, w: 0, h: 0, cx: 0, cy: 0, rot: 0 }, grid: null, cards: [], matGrad: null,
        lock: 0, lockDur: gn <= 2 ? 1.1 : gn === 3 ? 1.3 : 1.5, pull: 1, got: 0, wq: 0, mash: false, mashy: false, lockTaps: 0, streak: 0,
        pullT: 0, stumble: 0, dizzy: 0, bump: 0, lockShake: 0, fall: 0, jump: 0,
        keys: who === 'guest' ? KEYS_B : KEYS_A, banner: null,
        t: 0, at: 5, fumbled: false, warned: false
      };
    }
    function setupMatch(g, mode) {
      st.mode = mode;
      const hostName = (ctx.profile && ctx.profile.name) || '我';
      const hostPet = (ctx.profile && ctx.profile.avatar) || '🐯';
      st.A = mkSide('A', 'host', g.grade || 'p3', hostName, hostPet);
      if (mode === 'duel') {
        const rv = st.rival, rvPet = rv && rv.pet !== hostPet ? rv.pet : PETS.find((p) => p !== hostPet) || '🐰';
        st.B = mkSide('B', 'guest', st.rg, rv ? rv.name : '对手', rvPet);
        if (st.B.gn - st.A.gn >= 2) st.A.pull = 2; else if (st.A.gn - st.B.gn >= 2) st.B.pull = 2;
        st.humans = [st.A, st.B];
      } else {
        st.B = mkSide('B', 'ai', g.grade || 'p3', '岛主', '🦀');
        st.humans = [st.A];
      }
      st.lv = clamp(g.level, 1, MAXLV); st.win = LV[st.lv].win + (mode === 'duel' ? 1 : 0);   // 三局两胜，每局约 25–60 秒，一整场 1–2 分钟
      st.maxQ = 12; st.sets.A = 0; st.sets.B = 0; st.setNo = 1;
      st.pos = 0; st.show = 0; st.vel = 0; st.creep = 0; st.qn = 0; st.q = null; st.qi = 0;
      st.flyers.length = 0; st.claws.length = 0; st.fl.length = 0; st.big = null; st.finaleWin = null;
      st.hist.length = 0; st.aiStreak = 0;
      st.qs = buildQueue(g);
      lay(g);
      syncRounds(g, false);
    }
    function hostQs(g) {
      const gr = g.grade || 'p3', out = [], charShare = LV[st.lv].charQ;
      let cols = ['pick', 'words', 'chars'];
      const review = g.isReview && cols.some((c) => g.hasReview(c) > 0);
      if (review) cols = cols.filter((c) => g.hasReview(c) > 0);
      for (const col of cols) {
        const items = g.items(col, review ? null : 8);
        for (const it of items) {
          const q = review ? qFromRec(col, it, gr) : col === 'pick' ? qPick(it, gr) : col === 'words' ? qWords(it, gr) : qOfChars(it, gr, charShare);
          if (q) out.push(q);
        }
      }
      if (!review) return shuffle(out);
      // 错题重练：错题先出（没抢到会再回来），出完用本年级新题把绳子拔完，不会一道题反复念
      const seen = new Set(out.map((q) => q.ans));
      return shuffle(out).concat(bankQs(gr).filter((q) => !seen.has(q.ans)));
    }
    function bankQs(gr) {
      const G = allData()[gr] || {}, out = [], charShare = LV[st.lv].charQ;
      shuffle(arr(G.pick)).slice(0, 8).forEach((it) => { const q = qPick(it, gr); if (q) out.push(q); });
      shuffle(arr(G.words)).slice(0, 8).forEach((it) => { const q = qWords(it, gr); if (q) out.push(q); });
      shuffle(arr(G.chars)).slice(0, 8).forEach((it) => { const q = qOfChars(it, gr, charShare); if (q) out.push(q); });
      return shuffle(out);
    }
    function buildQueue(g) {
      const hq = hostQs(g);
      if (st.mode !== 'duel' || st.B.gr === st.A.gr) return hq;
      const gq = bankQs(st.B.gr);
      if (!gq.length) return hq;
      const low = st.A.gn <= st.B.gn ? hq : gq, high = low === hq ? gq : hq;
      const out = [];
      for (let i = 0; i < Math.max(low.length, high.length); i++) { if (low[i]) out.push(low[i]); if (high[i]) out.push(high[i]); }
      return out;
    }
    function takeQ() {
      if (!st.qs.length) return null;
      if (st.qi >= st.qs.length) { const last = st.q && st.q.ans; st.qs = shuffle(Array.from(new Set(st.qs))); st.qi = 0; if (st.qs.length > 1 && st.qs[0].ans === last) st.qs.push(st.qs.shift()); }
      return st.qs[st.qi++];
    }
    /* HUD 进度条 = 我还要抢几张才赢：rounds = 已抢 + 剩下要拉的次数（extra：马上要记一次 right，先多留 1 格，免得引擎自动过关） */
    function syncRounds(g, extra) {
      if (!st.A) return;
      const pa = Math.max(1, st.A.pull), dist = st.win + st.pos;
      const rem = Math.max(1, Math.ceil(Math.max(0, dist) / pa));
      g.rounds = g.done + rem + (extra ? 1 : 0);
    }
    function pullOf(sd) {
      let p = sd.pull;
      if (sd.who === 'host' && st.mode === 'solo' && sd.streak >= 3) p += 1;   // 一个人玩：这一局里连抢 3 张以后“大力拉”（每局重新数，第二局不会两题就结束）
      return p;
    }
    function moveRope(g, d) {
      st.pos = clamp(st.pos + d, -st.win, st.win);
      if (!st.finaleWin) {
        if (st.pos <= -st.win) startFinale(g, 'A');
        else if (st.pos >= st.win) startFinale(g, 'B');
      }
    }

    function beginReady(g) {
      st.phase = 'ready'; st.pt = 0;
      showBig('预备——', '#FFFFFF', 0.75);
      g.sfx('tick');
      g.after(0.75, () => { if (g.state !== 'play' || st.phase !== 'ready') return; showBig('拔！', '#FFE45C', 0.7); g.sfx('go'); });
      g.after(1.3, () => { if (g.state === 'play' && st.phase === 'ready') nextQ(g); });
    }
    function showBig(text, color, life, sub) { st.big = { text, color: color || '#FFE45C', t: 0, life: life || 1.1, sub: sub || '' }; }

    function nextQ(g) {
      if (g.state !== 'play' || st.phase === 'finale') return;
      if (st.qn >= st.maxQ) {   // 题出完了：谁那边占优谁赢；平手 → 决胜题
        if (st.pos < 0) { startFinale(g, 'A'); return; }
        if (st.pos > 0) { startFinale(g, 'B'); return; }
        showBig('决胜题！', '#FFE45C', 1.1);
      }
      st.qn++;
      const q0 = takeQ();
      if (!q0) { showBig('题目准备中', '#FFFFFF', 2); g.after(1.5, () => g.lose()); st.phase = 'wait'; return; }
      const q = Object.assign({}, q0, { auto: false, replays: 0, src: q0, again: false });
      q.rec = Object.assign({}, q0.item, { hz: q0.ans });
      // 最早“听得到”的时刻：朗读从发牌后开始，目标词念完才算听到（单字题“晴天的晴”要念到最后一个字）
      q.hear = 0.35 + 0.18 * (q.kind === 'c' ? chs(q.ctxW).length + 2 : Math.min(3, chs(q.ans).length));
      st.q = q;
      for (const sd of st.humans) dealHand(g, sd, q);
      st.phase = 'deal'; st.pt = 0; st.shufT = 0;
      g.sfx('whoosh');
      g.after(0.62, () => startRace(g));
    }
    function dealHand(g, sd, q) {
      const S = st.L.S;
      const n = nCards(sd.gn, st.lv), need = n - 1, mx = mixFor(sd.gn, st.lv, need);
      const hard = sd.gn >= 3;
      const others = q.kind === 'c' ? charHand(q, sd.gr, need, mx.nearK, mx.midK, hard) : wordHand(q, sd.gr, need, mx.nearK, mx.midK, hard);
      const texts = shuffle([q.ans].concat(others));
      sd.cards = texts.map((t, i) => ({
        t, ok: t === q.ans, si: i, x: 0, y: 0, w: 60, h: 60, sc: 0.2, a: 0, rot: (Math.random() - 0.5) * 0.8,
        st: 'in', ph: Math.random() * TAU, shake: 0, glow: 0, hint: 0, reveal: 0, lines: [t], fs: 20, key: '', hov: 0, hop: 0, mv: null
      }));
      placeCards(sd, false);
      sd.wq = 0; sd.mash = false; sd.lockTaps = 0; sd.banner = null;
      if (sd.lock > 0.35) sd.lock = 0.35;
      const R = sd.R;
      sd.cards.forEach((cd, i) => {
        const p0 = slotXY(sd, cd.si);
        cd.x = p0[0] * 0.15; cd.y = -R.h / 2 - 24 * S;
        g.after(i * 0.045, () => {
          if (cd.st !== 'in' && cd.st !== 'idle') return;
          cd.a = 1;
          const p = slotXY(sd, cd.si);   // 发牌途中转屏 / 改窗口：飞向新的位置
          cd.mv = g.tween(cd, { x: p[0], y: p[1], sc: 1, rot: (Math.random() - 0.5) * 0.05 }, 0.42, 'outBack', () => { cd.mv = null; });
        });
      });
    }
    function startRace(g) {
      if (g.state !== 'play' || st.phase !== 'deal') return;
      st.phase = 'race'; st.pt = 0; st.rt = 0;
      for (const sd of st.humans) for (const cd of sd.cards) { if (cd.st === 'in') cd.st = 'idle'; cd.a = 1; }
      if (st.mode === 'solo') { const B = st.B; B.t = 0; B.at = aiTime(st.q); B.fumbled = false; B.warned = false; }
      sayQ(g, false);
    }
    function sayQ(g, again) {
      const q = st.q;
      if (!q) return;
      if (again) q.replays++;
      g.say(again ? q.say2 : q.say1, q.cap ? { caption: q.cap } : undefined);
    }
    function replay(g) {
      if (!st.q || (st.phase !== 'race' && st.phase !== 'deal')) return;
      sayQ(g, true);
      g.ring(st.L.rbx, st.L.rby, '#FFFFFF', 50 * st.L.S);
      g.sfx('pop');
    }
    /* 岛主出手时间：孩子最近“一次就抢对”的平均用时 × 关卡系数；孩子手慢、连着被岛主抢走（没拍错，只是慢）时放慢。
       拍错不会让岛主放慢（不然乱拍 / 瞎蒙的孩子反而越打越轻松）；正在乱按时岛主还会趁乱快一点 */
    function aiTime(q) {
      const L = LV[st.lv], A = st.A;
      const base0 = { 2: 3.4, 3: 3.0, 4: 2.6, 5: 2.4, 6: 2.2 }[A.gn] || 3;
      const base = st.ema > 0 ? st.ema : base0;
      let k = L.ai;
      const h = st.hist.slice(-6);
      if (h.length >= 3 && h.reduce((s, x) => s + x, 0) / h.length > 0.85) k *= 0.93;
      if (st.aiStreak >= 2) k *= 1 + 0.12 * Math.min(3, st.aiStreak - 1);
      if (A.mashy) k *= 0.85;
      const t = base * k * (0.87 + Math.random() * 0.26) + (q.wait ? WAITB[st.lv] || 0.4 : 0) + (q.kind === 'c' ? 0.35 : 0);
      const floor = (A.gn <= 2 ? 2.1 : 1.35) + ([0, 1.0, 0.7, 0.4, 0.2][st.lv] || 0);   // 前几关岛主有保底慢速：P2 第 1 关至少 3.1 秒
      return clamp(t, floor, 11);
    }

    /* ---------- 抢卡 ---------- */
    function grab(g, sd, cd) {
      if (st.phase !== 'race' || cd.st !== 'idle') return;
      if (sd.lock > 0) { lockedTap(g, sd); return; }
      if (st.rt < 0.5 || (!cd.ok && st.rt < st.q.hear)) { falseStart(g, sd, cd); return; }
      if (cd.ok) humanTake(g, sd, cd); else wrongGrab(g, sd, cd);
    }
    /* 抢跑：刚开念（0.5 秒内，声音还没出来）就拍，拍中了也不算；或者词还没念完就拍了错卡。这不是在听，是在蒙：
       罚在游戏里（锁手、滑一跤、绳子被拉走一格、岛主冲过来），但卡片不作废（乱拍的人拿不到“排除法”），不进错题本 */
    function falseStart(g, sd, cd) {
      cd.shake = 1;
      sd.lock = sd.lockDur; sd.dizzy = sd.lockDur; sd.stumble = 0.6;
      sd.mash = true; sd.mashy = true; sd.streak = 0;
      const P = toGlobal(sd, cd.x, cd.y, { x: 0, y: 0 });
      if (sd.who === 'host') { st.hist.push(0); g.wrong(null, '抢跑', P.x, P.y); }
      else { g.sfx('bad'); g.shake(7); g.burst(P.x, P.y, { kind: 'dot', color: '#FF5A5F', n: 14 }); }
      panelFloat(sd, '还没念完！', cd.x, cd.y + cd.h * 0.1, '#FF6B6B', 26);
      moveRope(g, sd.id === 'A' ? 1 : -1);
      aiRush(g, sd);
      syncRounds(g, false);
    }
    /* 岛主趁你滑倒冲过来：乱拍几下卡就被抢走 */
    function aiRush(g, sd) {
      if (st.mode !== 'solo' || sd.who !== 'host' || st.phase !== 'race') return;
      const B = st.B;
      B.t += Math.min(1.6, B.at * 0.28);
      const p = sceneXY(petU(B), -st.L.petR * 1.6, TMP2);
      g.float('岛主冲过来了！', p.x, p.y, { color: '#FFB347', size: 20 });
    }
    /* 锁住了还在拍 = 乱按：这一题再拍错也不进错题本；同一题锁着拍了 2 下以上 → 记成“在乱按”，直到下一次听完再一次抢对 */
    function lockedTap(g, sd) { sd.lockShake = 1; sd.mash = true; if (++sd.lockTaps >= 2) sd.mashy = true; g.sfx('tick'); }
    function otherOf(sd) { return sd === st.A ? st.B : st.A; }
    function panelFloat(sd, text, x, y, col, size) { st.fl.push({ sd, text, x, y, t: 0, col: col || '#FFE45C', size: size || 30 }); if (st.fl.length > 16) st.fl.shift(); }
    function revealAll(winner, tag) {
      const q = st.q;
      for (const s of st.humans) {
        const c2 = s.cards.find((c) => c.ok && c.st !== 'taken');
        if (c2) { c2.st = 'reveal'; c2.reveal = 1; }
        const mine = s === winner;
        s.banner = {
          t: 0, good: mine, none: !winner,
          tag: mine ? g_pick(PRAISE) : !winner ? '都没抢到' : winner.who === 'ai' ? '被岛主抢走' : '慢了一步',
          word: q.ans, py: q.py, ctxW: q.kind === 'c' ? q.ctxW : ''
        };
        if (tag && mine) s.banner.tag = tag;
      }
    }
    function g_pick(a) { return a[Math.floor(Math.random() * a.length)]; }
    function humanTake(g, sd, cd) {
      const q = st.q, rt = st.pt;
      st.phase = 'resolve'; st.pt = 0;
      cd.st = 'taken';
      const P = toGlobal(sd, cd.x + drift(cd, 0), cd.y + drift(cd, 1), { x: 0, y: 0 });
      addFlyer(sd, cd, P.x, P.y, sd);
      const pull = pullOf(sd), other = otherOf(sd);
      other.streak = 0;
      const clean = !sd.wq && !sd.mash;   // 这一题没抢跑、没拍错、没在锁住时乱拍：听了、一次就抢对
      if (clean) sd.mashy = false;        // 不是在乱按了
      const credit = !sd.mash && !sd.mashy;   // 乱拍中碰巧拍中：照样拉绳子，但不给错题本记“答对”（g.right(undefined)）
      sd.streak = sd.wq ? 1 : sd.streak + 1;
      sd.got++; sd.pullT = 0.6; other.stumble = 0.55;
      revealAll(sd, pull > 1 && sd.who === 'host' && st.mode === 'solo' ? '大力拉！' : null);
      moveRope(g, sd.id === 'A' ? -pull : pull);
      if (sd.who === 'host') {
        if (clean) st.ema = st.ema ? st.ema * 0.65 + rt * 0.35 : rt;   // 只按“一次就抢对”的用时估孩子的速度（拍错后被锁的时间不算）
        st.hist.push(1); st.aiStreak = 0;
        syncRounds(g, true);
        g.right(credit ? q.rec : undefined, P.x, P.y, pull > 1 ? '拉 ×' + pull + '！' : null);
        syncRounds(g, false);
      } else {
        if (!st.A.wq) g.miss();
        g.sfx('good');
        g.burst(P.x, P.y, { kind: 'star', n: 14 }); g.burst(P.x, P.y, { kind: 'spark', n: 8 });
        g.ring(P.x, P.y, sd.team.c);
        syncRounds(g, false);
      }
      if (sd.who !== 'host') panelFloat(sd, pull > 1 ? '拉 ×' + pull + '！' : '拉！', cd.x, cd.y - cd.h * 0.2, '#FFE45C', 34);
      ropeFx(g, sd);
      if (st.phase !== 'finale') g.after(1.2, () => sweepOut(g));
    }
    function ropeFx(g, sd) {
      const L = st.L, sg = sd.id === 'A' ? -1 : 1;
      g.sfx('power'); g.shake(5);
      const p = sceneXY(petU(sd) + sg * 4, L.petR * 0.9, TMP2);
      g.burst(p.x, p.y, { kind: 'dot', color: '#E8C27A', n: 10 });
    }
    function wrongGrab(g, sd, cd) {
      const q = st.q;
      cd.st = 'bad'; cd.shake = 1;
      sd.lock = sd.lockDur; sd.dizzy = sd.lockDur; sd.stumble = 0.6;
      const P = toGlobal(sd, cd.x, cd.y, { x: 0, y: 0 });
      const first = !sd.wq;
      sd.wq++;
      sd.streak = 0;
      if (sd.who === 'host') {
        st.hist.push(0);
        if (first) {
          /* 进错题本的只有真正的华文判断错误：听完了才拍、这一题没有乱拍过、不高于本档案年级、这一局还没记过这题 */
          const key = JSON.stringify(q.rec);
          // 高关字卡会换位置：刚换过位置的两张卡（拍到的或正确的那张）0.8 秒内拍错 = 手没跟上卡片，不算华文错
          const okCd = sd.cards.find((c) => c.ok), swapped = (c) => c && c.swapT != null && st.rt - c.swapT < 0.8;
          const real = !sd.mash && !sd.mashy && !swapped(cd) && !swapped(okCd) && gIdx(q.gr) <= gIdx(st.A.gr) && !st.recorded.has(key);
          if (real) st.recorded.add(key);
          const note = '听到“' + (q.kind === 'c' ? q.say1 : q.ans) + '”，抢成了“' + cd.t + '”';
          g.wrong(real ? q.rec : null, note, P.x, P.y);
        } else { g.sfx('hit'); g.shake(8); g.burst(P.x, P.y, { kind: 'dot', color: '#FF5A5F', n: 10 }); }
      } else {
        g.sfx('bad'); g.shake(7);
        g.burst(P.x, P.y, { kind: 'dot', color: '#FF5A5F', n: 14 });
      }
      panelFloat(sd, sd.who === 'host' ? '滑了一跤！' : '✗ 滑了一跤', cd.x, cd.y + cd.h * 0.1, '#FF6B6B', 26);
      q.again = true;
      if (sd.wq >= 2 && sd.gn <= 3) { const ok = sd.cards.find((c) => c.ok && c.st === 'idle'); if (ok) ok.hint = 1; }
      moveRope(g, sd.id === 'A' ? 1 : -1);   // 脚下一滑：绳子被对面拉走一格
      aiRush(g, sd);
      syncRounds(g, false);
    }
    function nobody(g) {
      if (st.phase !== 'race') return;
      st.phase = 'resolve'; st.pt = 0;
      st.q.again = true;
      for (const s of st.humans) s.streak = 0;
      revealAll(null);
      if (!st.A.wq) g.miss();
      g.sfx('whoosh');
      g.after(1.4, () => sweepOut(g));
    }
    /* 拍错过 / 没抢到的题，隔一题再出一次（每题只回来 1 次）：听错的词马上再听一遍 */
    function requeue() {
      const q = st.q, q0 = q && q.src;
      if (!q || !q.again || !q0 || (q0.rq || 0) >= 1) return;   // 只回来一次：不会 A B A B A B 地来回念同两道题
      q0.rq = (q0.rq || 0) + 1;
      st.qs.splice(Math.min(st.qs.length, st.qi + 1), 0, q0);
    }
    function sweepOut(g) {
      if (g.state !== 'play' || st.phase !== 'resolve') return;
      requeue();
      if (st.tipN > 0) st.tipN--;
      for (const s of st.humans) for (const cd of s.cards) if (cd.st !== 'taken') g.tween(cd, { sc: 0.3, a: 0 }, 0.22, 'inQuad');
      st.phase = 'sweep';
      g.after(0.24, () => { if (st.phase === 'sweep') nextQ(g); });
    }

    /* ---------- 岛主 ---------- */
    function aiTick(g, dt) {
      const B = st.B;
      if (B.lock > 0 || st.claws.length) return;
      B.t += dt;
      if (!B.warned && B.t > B.at - 0.7) { B.warned = true; g.sfx('tick'); }
      if (B.t >= B.at) aiGrab(g);
    }
    function aiGrab(g) {
      const B = st.B, L = LV[st.lv];
      if (!B.fumbled && Math.random() < L.fum) {   // 岛主手滑：自己被锁住，绳子往孩子这边滑一格
        B.fumbled = true; B.lock = 1.4; B.dizzy = 1.4; B.stumble = 0.6;
        B.t = 0; B.at = Math.max(1.2, B.at * 0.55); B.warned = false;
        const p = sceneXY(petU(B), -st.L.petR * 1.6, TMP2);
        g.float('岛主手滑啦！', p.x, p.y, { color: '#FFE45C', size: 24 });
        g.sfx('bad');
        moveRope(g, -1); syncRounds(g, false);
        return;
      }
      const cd = st.A.cards.find((c) => c.ok && c.st === 'idle');
      if (!cd) { B.t = 0; B.at = 1.5; return; }
      const h = sceneXY(petU(B) - st.L.petR * 0.7, 0, { x: 0, y: 0 });
      st.claws.push({ x0: h.x, y0: h.y, cd, k: 0, ph: 'out', got: false });
      g.sfx('swing');
    }
    function aiTake(g, cl) {
      const rt = st.pt;
      st.phase = 'resolve'; st.pt = 0;
      cl.got = true; cl.cd.st = 'taken';
      const B = st.B;
      B.got++; B.pullT = 0.6; st.A.stumble = 0.55; st.A.streak = 0;
      if (!st.A.wq && !st.A.mash) {   // 孩子没拍错、没抢跑乱拍、只是比岛主慢：下次岛主放慢一点；拍错 / 乱拍过的题不算“慢”
        st.ema = st.ema ? st.ema * 0.7 + (rt + 0.8) * 0.3 : rt + 0.8;
        st.aiStreak++;
      }
      st.q.again = true;
      revealAll(B);
      moveRope(g, 1);
      if (!st.A.wq) g.miss();
      syncRounds(g, false);
      g.sfx('chomp');
      ropeFx(g, B);
      const p = sceneXY(petU(B), -st.L.petR * 1.6, TMP2);
      g.float('岛主抢到了！', p.x, p.y, { color: '#FFB347', size: 22 });
      if (st.phase !== 'finale') g.after(1.2, () => sweepOut(g));
    }

    /* ---------- 结束 ---------- */
    function startFinale(g, wid) {
      st.finaleWin = wid; st.phase = 'finale'; st.pt = 0;
      const win = wid === 'A' ? st.A : st.B, lose = wid === 'A' ? st.B : st.A;
      const setEnd = ++st.sets[wid] < 2;   // 三局两胜（一个人对岛主、兄妹对战都是）：这一局结束、比赛还没完
      st.fl.length = 0;
      const yank = Math.abs(st.pos) < st.win;   // 题目用完、按领先判胜：最后一把把绳子拽到线上再落水
      st.pos = wid === 'A' ? -st.win : st.win;
      for (const s of st.humans) {   // 收桌：锁、飘字、没抢的卡都撤掉，只留大字和小河里的水花
        s.lock = 0; s.dizzy = 0;
        for (const cd of s.cards) if (cd.st !== 'taken') g.tween(cd, { sc: 0.3, a: 0 }, 0.3, 'inQuad');
      }
      win.jump = 1;
      const who = win.who === 'host' ? (st.mode === 'duel' ? win.name : '你') : win.who === 'ai' ? '岛主' : win.name;
      const name = setEnd ? '第' + '一二三'[st.setNo - 1] + '局 · ' + who + '赢！' : who + (win.who === 'ai' ? '赢了！' : '赢啦！');
      const nA = st.mode === 'duel' ? st.A.name : '你', nB = st.mode === 'duel' ? st.B.name : '岛主';
      showBig(name, win.who === 'host' ? '#FFE45C' : '#BFE3FF', 99, setEnd ? (st.L.vert ? ['比分 ' + st.sets.A + ' : ' + st.sets.B, '比分 ' + st.sets.B + ' : ' + st.sets.A] : nA + ' ' + st.sets.A + ' : ' + st.sets.B + ' ' + nB) : '');
      if (yank) { win.pullT = 0.8; lose.stumble = 0.8; g.sfx('power'); g.shake(6); }
      g.after(yank ? 0.6 : 0.35, () => {
        g.tween(lose, { fall: 1 }, 0.5, 'inQuad', () => {
          const p = sceneXY(petU(lose) * 0.1, st.L.vert ? 0 : st.L.petR * 0.6, TMP2);
          g.burst(p.x, p.y, { kind: 'water', n: 34 }); g.burst(p.x, p.y, { kind: 'water', n: 20 });
          g.ring(p.x, p.y, '#BFEFFF', 80 * st.L.S);
          g.sfx('splash'); g.shake(10);
        });
      });
      if (setEnd) { g.after(yank ? 2.5 : 2.25, () => nextSet(g, win, lose)); return; }
      g.after(yank ? 2.05 : 1.8, () => {
        if (g.state !== 'play') return;
        if (wid === 'A') { g.rounds = Math.max(1, g.done); g.win(); } else g.lose();
      });
    }

    function nextSet(g, win, lose) {
      if (g.state !== 'play' || st.phase !== 'finale') return;
      st.setNo++; st.qn = 0; st.big = null;
      for (const s of st.humans) s.streak = 0;   // 大力拉每局重新数
      for (const s of st.humans) s.banner = null;   // 头条换回名牌 + 局分星星
      win.jump = 0;
      lose.jump = 1;   // 从小河里跳上岸
      g.tween(lose, { fall: 0 }, 0.45, 'outQuad', () => { lose.jump = 0; });
      st.pos = 0; st.finaleWin = null;
      g.sfx('whoosh');
      syncRounds(g, false);
      g.after(0.5, () => {
        if (g.state !== 'play' || st.phase !== 'finale') return;
        showBig('第' + '一二三'[st.setNo - 1] + '局', '#FFFFFF', 0.9, st.sets.A === 1 && st.sets.B === 1 ? '决胜局！' : '');
        g.after(0.9, () => { if (g.state === 'play' && st.phase === 'finale') beginReady(g); });
      });
    }

    /* ---------- 飞行的卡、岛主的钳子 ---------- */
    function addFlyer(sd, cd, x, y, to) {
      st.flyers.push({ t: cd.t, lines: cd.lines, fs: cd.fs, w: cd.w, h: cd.h, x0: x, y0: y, k: 0, dur: 0.6, rot0: sd.R.rot || 0, to });
    }
    function drift(cd, axis) {
      const m = LV[st.lv] ? LV[st.lv].mot : 0;
      if (!m || cd.st === 'in') return 0;
      const S = st.L.S;
      return axis ? Math.cos(st.vt * (0.9 + m * 0.25) + cd.ph * 1.3) * m * 2.2 * S : Math.sin(st.vt * (0.8 + m * 0.3) + cd.ph) * m * 2.2 * S;
    }
    function cardAt(sd, lx, ly) {
      for (let i = sd.cards.length - 1; i >= 0; i--) {
        const cd = sd.cards[i];
        if (cd.st !== 'idle' && cd.st !== 'bad') continue;
        const x = cd.x + drift(cd, 0), y = cd.y + drift(cd, 1);
        if (lx >= x - cd.w / 2 && lx <= x + cd.w / 2 && ly >= y - cd.h / 2 && ly <= y + cd.h / 2) return cd;
      }
      return null;
    }
    function shuffleCards(g) {
      let moved = false;
      for (const sd of st.humans) {
        const idle = sd.cards.filter((c) => c.st === 'idle' || c.st === 'bad');
        if (idle.length < 2) continue;
        const two = shuffle(idle).slice(0, 2), a = two[0], b = two[1];
        const t = a.si; a.si = b.si; b.si = t;
        slotKey(sd, a); slotKey(sd, b);
        const pa = slotXY(sd, a.si), pb = slotXY(sd, b.si);
        a.hop = 1; b.hop = 1; a.swapT = b.swapT = st.rt;
        for (const [cd, pp] of [[a, pa], [b, pb]]) {
          if (cd.mv) { try { cd.mv.cancel(); } catch (e) { /* ignore */ } }
          cd.mv = g.tween(cd, { x: pp[0], y: pp[1], hop: 0 }, 0.5, 'inOutQuad', () => { cd.mv = null; });
        }
        moved = true;
      }
      if (moved) g.sfx('flip');
    }

    /* ---------- 输入：自己的多指 pointerdown ---------- */
    function tapAt(g, x, y) {
      if (!st.A || st.phase === 'lobby' || st.phase === 'wait') return;
      const L = st.L;
      if ((st.phase === 'race' || st.phase === 'deal') && Math.hypot(x - L.rbx, y - L.rby) <= L.rbr + 10 * L.S) { replay(g); return; }
      for (const sd of st.humans) {
        const R = sd.R;
        if (x < R.x || x > R.x + R.w || y < R.y || y > R.y + R.h) continue;
        if (st.phase !== 'race') return;
        const lp = toLocal(sd, x, y, TMP);
        if (sd.lock > 0) { if (cardAt(sd, lp.x, lp.y)) lockedTap(g, sd); return; }
        const cd = cardAt(sd, lp.x, lp.y);
        if (cd) grab(g, sd, cd);
        return;
      }
    }
    function onPtr(e) {
      const g = st.g;
      if (!g || g.state !== 'play' || !st.cv) return;
      if (e.pointerType === 'mouse' && e.button > 0) return;
      const r = st.cv.getBoundingClientRect();
      if (e.pointerType !== 'mouse') st.kbd = false;
      try { tapAt(g, e.clientX - r.left, e.clientY - r.top); } catch (err) { try { console.error('[tug]', err); } catch (x) { /* ignore */ } }
    }

    /* ---------- 选对手（DOM 叠加层，只在第一局开打前出现） ---------- */
    function buildLobby(layer) {
      const box = D.createElement('div');
      box.style.cssText = 'position:absolute;inset:0;display:none;flex-direction:column;align-items:center;justify-content:center;padding:12px;overflow:auto;' +
        'background:radial-gradient(ellipse at 50% 45%,rgba(20,40,90,.25),rgba(8,18,48,.62));color:' + NAVY + ';font-family:"ZCOOL KuaiLe","Baloo 2","PingFang SC","Microsoft YaHei",system-ui,sans-serif';
      const p = D.createElement('div');
      p.className = 'arc-panel';
      p.style.cssText = 'width:min(100%,430px);gap:10px;margin-top:30px';
      const rib = D.createElement('div'); rib.className = 'arc-ribbon'; rib.textContent = '和谁拔河？';
      const mk = (cls, txt, fn) => {
        const b = D.createElement('button'); b.type = 'button'; b.className = 'arc-btn ' + cls; b.textContent = txt;
        b.addEventListener('click', (e) => { e.preventDefault(); fn(); });
        return b;
      };
      const small = (txt) => { const s = D.createElement('p'); s.textContent = txt; s.style.cssText = 'margin:0;font:600 15px/1.35 inherit;color:#5a6690;max-width:22em;text-align:center'; return s; };
      const b1 = mk('go', '🦀 挑战岛主', () => choose('solo'));
      b1.style.cssText = 'width:min(100%,300px);animation:none';
      const b2 = mk('blue', '👫 兄妹对战', () => choose('duel'));
      b2.style.cssText = 'width:min(100%,300px);min-height:66px;font-size:30px';
      const row = D.createElement('div');
      row.style.cssText = 'display:flex;flex-wrap:wrap;gap:8px;justify-content:center;align-items:center';
      const chipCss = 'min-width:52px;height:46px;padding:0 10px 2px;border-radius:14px;border:3px solid ' + NAVY + ';background:#fff;color:' + NAVY +
        ';font:800 19px/1 "Baloo 2","ZCOOL KuaiLe","Arial Rounded MT Bold",system-ui;box-shadow:0 3px 0 ' + NAVY + ';cursor:pointer;touch-action:manipulation';
      let kidRow = null, kidBtns = [];
      if (st.kids.length) {
        kidRow = D.createElement('div');
        kidRow.style.cssText = 'display:flex;flex-wrap:wrap;gap:8px;justify-content:center;align-items:center';
        const kl = D.createElement('span'); kl.textContent = '和谁比：'; kl.style.cssText = 'font-size:17px';
        kidRow.appendChild(kl);
        kidBtns = st.kids.map((k) => {
          const b = D.createElement('button'); b.type = 'button'; b.textContent = k.pet + ' ' + k.name;
          b.setAttribute('aria-label', '对手 ' + k.name);
          b.style.cssText = chipCss;
          b.addEventListener('click', (e) => {
            e.preventDefault();
            st.rival = st.rival === k ? null : k;   // 再点一下 = 不写名字
            if (st.rival) st.rg = k.gr;
            st.lobbySel = 1; refreshLobby();
            try { HW.arcade.sfx('tick'); } catch (x) { /* ignore */ }
          });
          kidRow.appendChild(b);
          return b;
        });
      }
      const lab = D.createElement('span'); lab.textContent = '对手几年级：'; lab.style.cssText = 'font-size:17px';
      row.appendChild(lab);
      const chips = GRADES.map((gr) => {
        const b = D.createElement('button'); b.type = 'button'; b.textContent = gr.toUpperCase();
        b.setAttribute('aria-label', '对手 ' + gr.toUpperCase());
        b.style.cssText = chipCss;
        b.addEventListener('click', (e) => { e.preventDefault(); st.rg = gr; st.lobbySel = 1; refreshLobby(); try { HW.arcade.sfx('tick'); } catch (x) { /* ignore */ } });
        row.appendChild(b);
        return b;
      });
      const how = small('');
      p.append(rib, b1, small('一个人玩：听到哪个词，就比岛主先抢到它！'), b2);
      if (kidRow) p.append(kidRow);
      p.append(row, how);
      box.appendChild(p);
      layer.appendChild(box);
      st.lobby = { box, b1, b2, chips, kidBtns, how };
      refreshLobby();
    }
    function refreshLobby() {
      const lb = st.lobby;
      if (!lb) return;
      lb.chips.forEach((b, i) => {
        const on = GRADES[i] === st.rg;
        b.style.background = on ? '#FFD84D' : '#fff';
        b.style.transform = on ? 'translateY(-2px) scale(1.06)' : 'none';
        b.setAttribute('aria-pressed', String(on));
      });
      lb.kidBtns.forEach((b, i) => {
        const on = st.rival === st.kids[i];
        b.style.background = on ? '#FFD84D' : '#fff';
        b.style.transform = on ? 'translateY(-2px) scale(1.06)' : 'none';
        b.setAttribute('aria-pressed', String(on));
      });
      const g = st.g, wide = !!g && g.w >= (g.h - (g.hudTop || 0)) * 1.05;
      const rn = st.rival ? st.rival.name : '对手', me = (ctx.profile && ctx.profile.name) || '你';
      lb.how.textContent = wide ? '两个人并排坐着同时抢：左边一半是' + me + '的，右边一半是' + rn + '的。各按自己的年级出卡。'
        : '两个人面对面同时抢：下面一半是' + me + '的，上面倒过来的一半是' + rn + '的。各按自己的年级出卡。';
      lb.b1.style.outline = st.kbd && st.lobbySel === 0 ? '4px solid #FFE45C' : 'none';
      lb.b2.style.outline = st.kbd && st.lobbySel === 1 ? '4px solid #FFE45C' : 'none';
      lb.b1.style.outlineOffset = lb.b2.style.outlineOffset = '4px';
    }
    function showLobby(on) {
      if (!st.lobby) return;
      st.lobby.box.style.display = on ? 'flex' : 'none';
      if (on) refreshLobby();
    }
    function choose(mode) {
      const g = st.g;
      if (!g || st.phase !== 'lobby' || g.state !== 'play') return;
      showLobby(false);
      st.chosen = true;
      st.tipN = st.seen ? 0 : 2;   // 第一次玩：前两题在字卡上方写一句怎么玩（不指答案）
      st.seen = true;
      try { ctx.mem.set('tug', { m: mode, rg: st.rg, rv: st.rival ? st.rival.name : '', seen: 1 }); } catch (e) { /* ignore */ }
      setupMatch(g, mode);
      beginReady(g);
    }
    function lobbyKey(k) {
      if (k === '1') { choose('solo'); return; }
      if (k === '2') { choose('duel'); return; }
      if (k === 'up' || k === 'down') st.lobbySel = st.lobbySel ? 0 : 1;
      else if (k === 'left' || k === 'right') {
        if (st.lobbySel === 1) { const i = clamp(GRADES.indexOf(st.rg) + (k === 'left' ? -1 : 1), 0, GRADES.length - 1); st.rg = GRADES[i]; }
        else st.lobbySel = 1;
      } else if (k === 'enter' || k === 'space') { choose(st.lobbySel ? 'duel' : 'solo'); return; }
      refreshLobby();
    }

    /* ================= 绘制 ================= */
    function drawBackdrop(g, c) {
      const L = st.L, S = L.S, vt = st.vt, Wd = g.w;
      if (!L.vert) {
        c.fillStyle = L.gSky; c.fillRect(0, 0, Wd, L.seaY + 2);
        // 太阳
        const sx = Wd - 70 * S, sy = L.sceneT + (L.seaY - L.sceneT) * 0.45, sr = 20 * S;
        c.save(); c.translate(sx, sy); c.rotate(vt * 0.25);
        c.fillStyle = 'rgba(255,236,120,.55)';
        for (let i = 0; i < 10; i++) { c.rotate(TAU / 10); c.beginPath(); c.moveTo(sr * 1.25, -4 * S); c.lineTo(sr * 1.9, 0); c.lineTo(sr * 1.25, 4 * S); c.fill(); }
        c.restore();
        c.beginPath(); c.arc(sx, sy, sr, 0, TAU); c.fillStyle = '#FFE46B'; c.fill(); c.lineWidth = 3 * S; c.strokeStyle = '#F2B200'; c.stroke();
        for (const cl of st.clouds) {
          const span = Wd + 260 * S, x = ((cl.x * span + vt * cl.v * S) % span) - 130 * S;
          g.cloud(x, L.sceneT + (L.seaY - L.sceneT) * cl.y, cl.s * S, 0.95);
        }
        // 海
        c.fillStyle = L.gSea; c.fillRect(0, L.seaY, Wd, L.sandY - L.seaY + 2);
        c.strokeStyle = 'rgba(255,255,255,.55)'; c.lineWidth = 2 * S; c.lineCap = 'round';
        for (let i = 0; i < 7; i++) {
          const y = L.seaY + (L.sandY - L.seaY) * (0.25 + (i % 3) * 0.25), x = ((i * 0.17 + vt * 0.02 * (1 + i % 2)) % 1) * Wd;
          c.beginPath(); c.moveTo(x, y); c.lineTo(x + 18 * S, y); c.stroke();
        }
        // 海浪边
        c.fillStyle = 'rgba(255,255,255,.85)';
        c.beginPath(); c.moveTo(0, L.sandY + 3 * S);
        for (let x = 0; x <= Wd + 20; x += 20 * S) c.lineTo(x, L.sandY + Math.sin(x * 0.05 + vt * 2) * 2.5 * S);
        c.lineTo(Wd, L.sandY + 6 * S); c.lineTo(0, L.sandY + 6 * S); c.closePath(); c.fill();
        // 沙滩
        c.fillStyle = L.gSand; c.fillRect(0, L.sandY + 5 * S, Wd, L.sceneB - L.sandY - 5 * S);
        c.fillStyle = 'rgba(190,140,60,.35)';
        for (const d of st.dots) { c.beginPath(); c.arc(d.x * Wd, L.sandY + 10 * S + d.y * (L.sceneB - L.sandY - 14 * S), d.r * S, 0, TAU); c.fill(); }
        // 椰树
        const ps = clamp(L.thick * 0.42, 60, 140);
        g.emoji('🌴', ps * 0.42, L.sandY - ps * 0.12, ps, { rot: Math.sin(vt * 0.8) * 0.04 });
        g.emoji('🌴', Wd - ps * 0.42, L.sandY - ps * 0.12, ps, { rot: -Math.sin(vt * 0.8 + 1) * 0.04, flip: true });
        // 小河：从海里一直流到前面
        const hw = L.poolHW, x0 = L.cx - hw, top = L.sandY - 2 * S, bot = L.sceneB;
        c.beginPath();
        c.moveTo(x0, top);
        for (let y = top; y <= bot; y += 8 * S) c.lineTo(x0 + Math.sin(y * 0.06 + vt * 1.5) * 3 * S - (y - top) * 0.06, y);
        for (let y = bot; y >= top; y -= 8 * S) c.lineTo(L.cx + hw + Math.sin(y * 0.06 + vt * 1.5 + 2) * 3 * S + (y - top) * 0.06, y);
        c.closePath(); c.fillStyle = L.gWater; c.fill();
        c.lineWidth = 3 * S; c.strokeStyle = 'rgba(255,255,255,.7)'; c.stroke();
        c.strokeStyle = 'rgba(255,255,255,.6)'; c.lineWidth = 2 * S;
        for (let i = 0; i < 6; i++) {
          const y = top + ((i / 6 + vt * 0.18) % 1) * (bot - top), x = L.cx + Math.sin(i * 2.1) * hw * 0.5;
          c.beginPath(); c.moveTo(x, y); c.lineTo(x, y + 9 * S); c.stroke();
        }
        g.emoji('🦆', L.cx + Math.sin(vt * 0.7) * hw * 0.35, L.cy + (L.sceneB - L.cy) * 0.55 + Math.sin(vt * 2.2) * 2 * S, clamp(hw * 0.7, 18, 34) , { rot: Math.sin(vt * 2.2) * 0.1 });
        // 下面的木栈道
        c.fillStyle = L.gDeck; c.fillRect(0, L.sceneB, Wd, g.h - L.sceneB);
        c.fillStyle = 'rgba(80,40,10,.25)'; c.fillRect(0, L.sceneB, Wd, 4 * S);
        c.strokeStyle = 'rgba(90,50,20,.28)'; c.lineWidth = 2 * S;
        for (let y = L.sceneB + 30 * S; y < g.h; y += 30 * S) { c.beginPath(); c.moveTo(0, y); c.lineTo(Wd, y); c.stroke(); }
      } else {
        c.fillStyle = L.gDeck; c.fillRect(0, 0, Wd, g.h);
        c.strokeStyle = 'rgba(90,50,20,.28)'; c.lineWidth = 2 * S;
        for (let x = 30 * S; x < Wd; x += 36 * S) { c.beginPath(); c.moveTo(x, 0); c.lineTo(x, g.h); c.stroke(); }
        c.fillStyle = L.gSandV; c.fillRect(0, L.sceneT, Wd, L.sceneB - L.sceneT);
        c.fillStyle = 'rgba(190,140,60,.35)';
        for (const d of st.dots) { c.beginPath(); c.arc(d.x * Wd, L.sceneT + d.y * (L.sceneB - L.sceneT), d.r * S, 0, TAU); c.fill(); }
        const hw = L.poolHW;
        c.beginPath(); c.moveTo(0, L.cy - hw);
        for (let x = 0; x <= Wd + 8; x += 8 * S) c.lineTo(x, L.cy - hw + Math.sin(x * 0.06 + vt * 1.5) * 2.5 * S);
        for (let x = Wd; x >= -8; x -= 8 * S) c.lineTo(x, L.cy + hw + Math.sin(x * 0.06 + vt * 1.5 + 2) * 2.5 * S);
        c.closePath(); c.fillStyle = L.gWater; c.fill();
        c.lineWidth = 2.5 * S; c.strokeStyle = 'rgba(255,255,255,.7)'; c.stroke();
        c.strokeStyle = 'rgba(255,255,255,.6)'; c.lineWidth = 2 * S;
        for (let i = 0; i < 6; i++) { const x = ((i / 6 + vt * 0.12) % 1) * Wd, y = L.cy + Math.sin(i * 2.3) * hw * 0.45; c.beginPath(); c.moveTo(x, y); c.lineTo(x + 10 * S, y); c.stroke(); }
        g.emoji('🦆', Wd * 0.78 + Math.sin(vt * 0.7) * 20 * S, L.cy + Math.sin(vt * 2.2) * 2 * S, clamp(hw * 1.3, 18, 30));
        c.fillStyle = 'rgba(80,40,10,.3)'; c.fillRect(0, L.sceneT - 3 * S, Wd, 3 * S); c.fillRect(0, L.sceneB, Wd, 3 * S);
      }
    }
    function drawActors(g, c) {
      const L = st.L, S = L.S, R = L.petR, vt = st.vt;
      const jit = st.phase === 'race' ? Math.sin(vt * 7.3) * 0.09 + Math.sin(vt * 12.1) * 0.05 : 0;
      const mU = (st.show + st.creep + jit) * L.step;
      c.save();
      c.translate(L.cx, L.cy);
      if (L.vert) c.rotate(-Math.PI / 2);
      // 胜利线 + 小旗
      const vTop = L.vert ? -L.thick / 2 + 4 * S : -R * 1.25, vBot = L.vert ? L.thick / 2 - 4 * S : L.sceneB - L.cy - 6 * S;
      for (const sg of [-1, 1]) {
        const u = sg * st.win * L.step, team = sg < 0 ? st.A.team : st.B.team;
        c.save(); c.setLineDash([7 * S, 6 * S]); c.lineWidth = 3 * S; c.strokeStyle = 'rgba(255,255,255,.9)';
        c.beginPath(); c.moveTo(u, vTop); c.lineTo(u, vBot); c.stroke(); c.restore();
        if (!L.vert) {
          c.fillStyle = NAVY; c.fillRect(u - 1.5 * S, vTop - 24 * S, 3 * S, 26 * S);
          c.beginPath(); c.moveTo(u, vTop - 24 * S); c.lineTo(u - sg * 20 * S, vTop - 18 * S + Math.sin(vt * 5 + sg) * 2 * S); c.lineTo(u, vTop - 11 * S); c.closePath();
          c.fillStyle = team.c; c.fill(); c.lineWidth = 2 * S; c.strokeStyle = NAVY; c.stroke();
        }
      }
      // 绳子
      const uA = mU - L.D, uB = mU + L.D;
      const hA = uA + R * 0.5, hB = uB - R * 0.5, sag = 3 * S + Math.abs(Math.sin(vt * 3)) * 1.5 * S;
      c.lineCap = 'round';
      c.beginPath(); c.moveTo(hA, 0); c.quadraticCurveTo((hA + hB) / 2, sag, hB, 0);
      c.lineWidth = 10 * S; c.strokeStyle = '#6B3F17'; c.stroke();
      c.lineWidth = 6.5 * S; c.strokeStyle = '#E0AE62'; c.stroke();
      c.save(); c.setLineDash([5 * S, 6 * S]); c.lineDashOffset = -mU; c.lineWidth = 6.5 * S; c.strokeStyle = '#B97E36'; c.stroke(); c.restore();
      // 中间的红标
      const my = sag * 0.95;
      c.save(); c.translate(mU, my);
      c.rotate(Math.sin(vt * 6) * 0.12);
      c.beginPath(); c.moveTo(0, 0); c.lineTo(-8 * S, 22 * S); c.lineTo(0, 17 * S); c.lineTo(8 * S, 22 * S); c.closePath();
      c.fillStyle = '#FF3B3B'; c.fill(); c.lineWidth = 2 * S; c.strokeStyle = NAVY; c.stroke();
      c.beginPath(); c.arc(0, 0, 6 * S, 0, TAU); c.fillStyle = '#FF3B3B'; c.fill(); c.stroke();
      c.restore();
      drawPet(g, c, st.A, uA, -1);
      drawPet(g, c, st.B, uB, 1);
      c.restore();
    }
    function drawPet(g, c, P, u, sg) {
      const L = st.L, S = L.S, R = L.petR, vt = st.vt;
      const strain = st.phase === 'race' || st.phase === 'deal' ? 1 : 0.4;
      let lean = 0.14 * strain + Math.sin(vt * 6.5 + (sg > 0 ? 1.3 : 0)) * 0.07 * strain + P.pullT * 0.55 - P.stumble * 0.5;
      let du = -sg * P.pullT * R * 0.25 + sg * P.stumble * R * 0.18;
      let dv = -R * 0.28;
      if (P.jump > 0) dv -= Math.abs(Math.sin(st.vt * 9)) * R * 0.55;
      const inPool = Math.abs(P.fall > 0 ? u * (1 - 0.9 * P.fall) : u) < L.poolHW + R * 0.1;
      if (inPool && !L.vert) dv += R * 0.25;
      if (P.fall > 0) { du += -(u + du) * P.fall * 0.9; dv += P.fall * R * (L.vert ? 0.2 : 0.95); lean -= P.fall * 1.6; }   // 输的一方被拽进小河正中间
      c.save();
      c.translate(u + du, 0);
      if (!L.vert) {
        // 篮子（抢到的卡叠在里面）
        const bx = sg * R * 1.0, by = R * 0.75;
        const bb = 1 + P.bump * 0.25;
        const nC = Math.min(6, P.got);
        for (let i = 0; i < nC; i++) {
          g.rrect(bx - R * 0.32 + (i % 2) * 4 * S, by - R * 0.55 - i * 4 * S, R * 0.64, R * 0.5, 4 * S, '#FFF9EC', '#E0453A', 1.6 * S);
        }
        g.emoji('🧺', bx, by, R * 1.15 * bb);
        if (P.got) {
          const bw = 30 * S, gx = L.cx + u + du, byy = by - R * 1.05 - Math.min(6, P.got) * 4 * S;
          const bxx = clamp(bx + sg * R * 0.35 - bw / 2, 4 * S - gx, g.w - gx - bw - 4 * S);   // 被拉到屏幕边上时牌子也不出界
          g.rrect(bxx, byy, bw, 20 * S, 10 * S, P.team.c, NAVY, 2 * S);
          g.text('×' + P.got, bxx + bw / 2, byy + 10.5 * S, { size: Math.round(13 * S), font: 'num', color: '#fff' });
        }
        // 影子
        c.fillStyle = inPool ? 'rgba(255,255,255,.55)' : 'rgba(120,80,20,.28)';
        c.beginPath(); c.ellipse(0, R * 0.95, R * 0.85, R * 0.2, 0, 0, TAU); c.fill();
      }
      c.translate(0, dv);
      if (L.vert) c.rotate(sg < 0 ? Math.PI / 2 : -Math.PI / 2);
      else c.rotate(sg * lean);
      // 连击火焰
      if (P.who === 'host' && st.mode === 'solo' && P.streak >= 3 && P.fall <= 0) g.emoji('🔥', 0, -R * 0.35, R * 2.4, { alpha: 0.55 + 0.2 * Math.sin(vt * 10) });
      const face = P.who === 'ai' ? '🦀' : P.pet;
      const sq = 1 + Math.sin(vt * 8 + sg) * 0.05 * strain;
      g.emoji(face, 0, 0, R * 2 * sq, { flip: sg > 0 && !L.vert && P.who !== 'ai' });
      if (P.who === 'ai') g.emoji('👑', 0, -R * 0.95, R * 0.9, { rot: Math.sin(vt * 3) * 0.12 });
      // 爪子抓着绳子
      const hx = L.vert ? 0 : -sg * R * 0.62, hy = L.vert ? -R * 0.9 : R * 0.3;
      c.fillStyle = P.team.l; c.strokeStyle = NAVY; c.lineWidth = 2 * S;
      c.beginPath(); c.arc(hx, hy, R * 0.2, 0, TAU); c.fill(); c.stroke();
      c.beginPath(); c.arc(hx + (L.vert ? R * 0.3 : -sg * R * 0.3), hy + (L.vert ? 0 : R * 0.08), R * 0.18, 0, TAU); c.fill(); c.stroke();
      // 头晕 / 汗
      if (P.dizzy > 0 || P.lock > 0) {
        for (let i = 0; i < 3; i++) { const a = vt * 5 + i * TAU / 3; g.emoji('⭐', Math.cos(a) * R * 0.8, -R * 0.95 + Math.sin(a) * R * 0.25, R * 0.45); }
      } else if (P.stumble > 0.1 || (st.phase === 'race' && Math.abs(u) < L.poolHW + R)) g.emoji('💦', sg * R * 0.85, -R * 0.75, R * 0.6, { flip: sg < 0 });
      c.restore();
      // 名牌
      if (!L.vert && P.fall <= 0) {
        const tag = P.who === 'ai' ? '岛主' : P.name + ' ' + P.gr.toUpperCase();
        const x = u + du, y = -R * (P.who === 'ai' ? 2.05 : 1.72) + dv * 0.3;
        const tw = Math.min(140 * S, g.measure(tag, 14 * S, 'round') + 16 * S);
        g.rrect(x - tw / 2, y - 11 * S + 2 * S, tw, 22 * S, 11 * S, NAVY);
        g.rrect(x - tw / 2, y - 11 * S, tw, 22 * S, 11 * S, P.team.c, NAVY, 2 * S);
        g.text(tag, x, y + 0.5 * S, { size: 14 * S, font: 'round', color: '#fff', maxW: tw - 10 * S });
      }
      // 岛主在想：一圈倒计时
      if (P.who === 'ai' && st.phase === 'race' && P.lock <= 0) {
        const k = clamp(P.t / Math.max(0.1, P.at), 0, 1), x = u + du, y = dv;
        c.beginPath(); c.arc(x, y, R * 1.3, -Math.PI / 2, -Math.PI / 2 + TAU * k);
        c.lineWidth = 5 * S; c.strokeStyle = k > 0.8 ? '#FF3B3B' : '#FFB020'; c.stroke();
        if (k > 0.8) g.emoji('❗', x - R * 0.9, y - R * 1.2, R * 0.7, { rot: Math.sin(vt * 30) * 0.2 });
      }
    }
    function paintCard(g, c, cd, w, h, S, state) {
      const r = Math.min(w, h) * 0.12;
      const bad = state === 'bad';
      g.rrect(-w / 2, -h / 2, w, h, r, bad ? '#DAD5CC' : '#FFFAEE', NAVY, 3 * S);
      g.rrect(-w / 2 + 6 * S, -h / 2 + 6 * S, w - 12 * S, h - 12 * S, r * 0.6, null, bad ? '#A8A197' : '#E0453A', 2.2 * S);
      const lines = cd.lines || [cd.t], fs = cd.fs || 20, lh = fs * 1.08;
      const col = bad ? '#8C877E' : NAVY;
      for (let i = 0; i < lines.length; i++) g.text(lines[i], 0, (i - (lines.length - 1) / 2) * lh + fs * 0.02, { size: fs, font: 'kai', color: col, weight: 700 });
      if (bad) {
        c.strokeStyle = 'rgba(200,50,40,.8)'; c.lineWidth = 3 * S; c.lineCap = 'round';
        c.beginPath(); c.moveTo(-w * 0.28, -h * 0.3); c.lineTo(-w * 0.05, -h * 0.02); c.lineTo(-w * 0.15, h * 0.1); c.lineTo(w * 0.1, h * 0.32); c.stroke();
      }
    }
    function drawCard(g, c, sd, cd) {
      if (cd.a <= 0.01 || cd.st === 'taken') return;
      const S = st.L.S, vt = st.vt;
      let x = cd.x + drift(cd, 0), y = cd.y + drift(cd, 1);
      const w = cd.w, h = cd.h;
      let rot = cd.rot;
      if (cd.shake > 0) x += Math.sin(vt * 60) * 7 * S * cd.shake;
      if (cd.hint > 0 && cd.st === 'idle') rot += Math.sin(vt * 13) * 0.07;
      const lift = cd.hov * 4 * S + cd.hop * 12 * S;
      c.save();
      c.translate(x, y - lift);
      c.rotate(rot);
      c.scale(cd.sc, cd.sc);
      const a0 = c.globalAlpha;
      c.globalAlpha = a0 * cd.a;
      const r = Math.min(w, h) * 0.12;
      g.rrect(-w / 2, -h / 2 + (5 + lift * 0.3) * S, w, h, r, 'rgba(60,35,10,.3)');
      if (cd.reveal > 0 || (cd.hint > 0 && cd.st === 'idle')) {
        const pul = 0.65 + 0.35 * Math.sin(vt * 12);
        c.globalAlpha = a0 * cd.a * pul;
        g.rrect(-w / 2 - 7 * S, -h / 2 - 7 * S, w + 14 * S, h + 14 * S, r + 7 * S, cd.reveal > 0 ? '#4CE07A' : '#FFE45C');
        c.globalAlpha = a0 * cd.a;
      }
      paintCard(g, c, cd, w, h, S, cd.st);
      if ((st.kbd || st.fine) && cd.key && cd.st === 'idle' && !sd.R.rot) {   // 键盘键帽：电脑上一眼看出按哪个键
        const kw = 22 * S, kx = w / 2 - kw - 7 * S, ky = h / 2 - kw - 7 * S;
        g.rrect(kx, ky + 2 * S, kw, kw, 6 * S, 'rgba(29,43,83,.35)');
        g.rrect(kx, ky, kw, kw, 6 * S, '#FFFFFF', 'rgba(29,43,83,.55)', 1.5 * S);
        g.text(cd.key.toUpperCase(), kx + kw / 2, ky + kw / 2 + 1 * S, { size: Math.round(14 * S), font: 'num', color: NAVY });
      }
      c.globalAlpha = a0;
      c.restore();
    }
    function drawPanel(g, c, sd) {
      const R = sd.R, S = st.L.S, hh = st.L.hh, vt = st.vt;
      if (!R.w) return;
      const w = R.w, h = R.h;
      c.save();
      c.translate(R.cx, R.cy);
      if (R.rot) c.rotate(R.rot);
      g.rrect(-w / 2, -h / 2 + 6 * S, w, h, 20 * S, 'rgba(60,30,5,.35)');
      g.rrect(-w / 2, -h / 2, w, h, 20 * S, sd.matGrad || sd.team.m0, sd.team.d, 4 * S);
      c.save(); rr(c, -w / 2 + 4 * S, -h / 2 + 4 * S, w - 8 * S, h - 8 * S, 16 * S); c.clip();
      c.strokeStyle = 'rgba(150,110,40,.13)'; c.lineWidth = 3 * S;
      for (let y = -h / 2 + 14 * S; y < h / 2; y += 14 * S) { c.beginPath(); c.moveTo(-w / 2, y); c.lineTo(w / 2, y); c.stroke(); }
      c.fillStyle = sd.team.c; c.globalAlpha = 0.9; c.fillRect(-w / 2, -h / 2, w, hh - 4 * S); c.globalAlpha = 1;
      c.restore();
      drawHeader(g, c, sd);
      for (const cd of sd.cards) drawCard(g, c, sd, cd);
      if (sd.lock > 0 && sd.grid) {
        const G = sd.grid, k = sd.lock / sd.lockDur, fade = clamp(sd.lock / 0.15, 0, 1);
        const a0 = c.globalAlpha;
        c.globalAlpha = a0 * fade;
        g.rrect(G.ax, G.ay, G.aw, G.ah, 16 * S, 'rgba(29,43,83,.34)');
        const cy = G.ay + G.ah / 2, rad = clamp(Math.min(G.aw, G.ah) * 0.15, 22 * S, 60 * S);
        const sx = sd.lockShake > 0 ? Math.sin(vt * 50) * 6 * S * sd.lockShake : 0;
        c.beginPath(); c.arc(0, cy, rad * 1.2, 0, TAU); c.fillStyle = 'rgba(255,251,239,.9)'; c.fill(); c.lineWidth = 3 * S; c.strokeStyle = NAVY; c.stroke();
        c.beginPath(); c.arc(0, cy, rad * 1.2, -Math.PI / 2, -Math.PI / 2 + TAU * k); c.lineWidth = 7 * S; c.strokeStyle = '#FF6B5B'; c.stroke();
        g.emoji('🔒', sx, cy, rad * 1.25);
        const ls = Math.round(17 * S), lw = g.measure('抓错啦，等一下', ls, 'round') + 26 * S;
        // 字卡区矮（手机横拿 / 并排两人的小屏）：说明条放到锁的右边，不掉出字卡区
        const side = G.ay + G.ah - (cy + rad * 1.2) < 38 * S && G.aw / 2 > rad * 1.2 + lw + 16 * S;
        const lx = side ? rad * 1.2 + 10 * S + lw / 2 : 0, ly = side ? cy : cy + rad * 1.2 + 20 * S;
        g.rrect(lx - lw / 2, ly - 15 * S, lw, 30 * S, 15 * S, NAVY, '#FFFFFF', 2 * S);
        g.text('抓错啦，等一下', lx, ly + 0.5 * S, { size: ls, font: 'round', color: '#FFE45C' });
        c.globalAlpha = a0;
      }
      for (const f of st.fl) {
        if (f.sd !== sd) continue;
        const a = 1 - f.t / 0.95;
        if (a <= 0) continue;
        g.text(f.text, f.x, f.y - f.t * 46 * S, { size: Math.round(f.size * S), font: 'round', color: f.col, stroke: NAVY, strokeW: 4 * S, alpha: a });
      }
      c.restore();
    }
    function drawHeader(g, c, sd) {
      const R = sd.R, S = st.L.S, hh = st.L.hh;
      const w = R.w, h = R.h, y = -h / 2 + (hh - 4 * S) / 2 + 1 * S, x0 = -w / 2 + 12 * S;
      const bn = sd.banner;
      if (bn) {
        const tagS = Math.round(15 * S);
        const tw = g.measure(bn.tag, tagS, 'round') + 18 * S;
        g.rrect(x0, y - 13 * S, tw, 26 * S, 13 * S, bn.good ? '#3CCB5A' : bn.none ? '#8A96B8' : '#FF8A5B', NAVY, 2.2 * S);
        g.text(bn.tag, x0 + tw / 2, y + 0.5 * S, { size: tagS, font: 'round', color: '#fff', stroke: NAVY, strokeW: 2.5 * S });
        let x = x0 + tw + 10 * S;
        const room = w / 2 - 10 * S;
        x += g.text(bn.word, x, y + 1 * S, { size: Math.round(25 * S), font: 'kai', color: '#FFFFFF', stroke: NAVY, strokeW: 3.5 * S, align: 'left', weight: 700, maxW: Math.max(40 * S, room - x) }) + 8 * S;
        const sub = (bn.py || '') + (bn.ctxW ? (bn.py ? ' · ' : '') + bn.ctxW : '');
        if (sub && room - x > 30 * S) g.text(sub, x, y + 1.5 * S, { size: Math.round(15 * S), font: 'py', color: '#FFFFFF', stroke: NAVY, strokeW: 3 * S, align: 'left', maxW: room - x });
        return;
      }
      if (st.tipN > 0 && (st.phase === 'deal' || st.phase === 'race')) {   // 第一次玩的提示：只说怎么玩，不指哪张
        const k = 1 + 0.05 * Math.sin(st.vt * 6);
        g.text('👂 听到哪个词，就拍哪张卡！', 0, y + 1 * S, { size: Math.round(18 * S * k), font: 'round', color: '#FFE45C', stroke: NAVY, strokeW: 3.5 * S, maxW: w - 24 * S });
        return;
      }
      g.emoji(sd.pet, x0 + 13 * S, y, 27 * S);
      let x = x0 + 32 * S;
      x += g.text(sd.name, x, y + 1 * S, { size: Math.round(17 * S), font: 'round', color: '#FFFFFF', stroke: NAVY, strokeW: 3 * S, align: 'left', maxW: 110 * S }) + 8 * S;
      const gt = sd.gr.toUpperCase();
      g.rrect(x, y - 11 * S, 36 * S, 22 * S, 11 * S, '#FFFBEF', NAVY, 2 * S);
      g.text(gt, x + 18 * S, y + 0.5 * S, { size: Math.round(13 * S), font: 'num', color: NAVY });
      x += 44 * S;
      if (sd.pull > 1) {
        g.rrect(x, y - 11 * S, 60 * S, 22 * S, 11 * S, '#FFD84D', NAVY, 2 * S);
        g.text('拉力×' + sd.pull, x + 30 * S, y + 0.5 * S, { size: Math.round(13 * S), font: 'round', color: NAVY });
      }
      const rx = w / 2 - 14 * S;
      g.text('×' + sd.got, rx, y + 1 * S, { size: Math.round(19 * S), font: 'num', color: '#FFFFFF', stroke: NAVY, strokeW: 3 * S, align: 'right' });
      const ex = rx - 34 * S - (sd.got >= 10 ? 10 * S : 0);
      g.emoji('🃏', ex, y, 22 * S);
      {   // 三局两胜：赢一局点亮一颗星
        for (let i = 0; i < 2; i++) {
          const cx = ex - 30 * S - (1 - i) * 24 * S, on = st.sets[sd.id] > i;
          c.beginPath(); c.arc(cx, y, 10 * S, 0, TAU); c.fillStyle = on ? '#FFD84D' : 'rgba(255,255,255,.35)'; c.fill();
          c.lineWidth = 2 * S; c.strokeStyle = NAVY; c.stroke();
          if (on) g.emoji('⭐', cx, y, 15 * S);
        }
      }
    }
    function drawFlyers(g, c) {
      const S = st.L.S;
      for (const f of st.flyers) {
        const k = clamp(f.k, 0, 1), e = 1 - (1 - k) * (1 - k);
        const tg = basketXY(f.to, TMP2);
        const cx = (f.x0 + tg.x) / 2, cy = Math.min(f.y0, tg.y) - 90 * S;
        const x = (1 - e) * (1 - e) * f.x0 + 2 * (1 - e) * e * cx + e * e * tg.x;
        const y = (1 - e) * (1 - e) * f.y0 + 2 * (1 - e) * e * cy + e * e * tg.y;
        const sc = lerp(1.15, 0.28, e);
        c.save(); c.translate(x, y); c.rotate(lerp(f.rot0, 0, e) + e * TAU * 0.5); c.scale(sc, sc);
        paintCard(g, c, f, f.w, f.h, S, 'idle');
        c.restore();
      }
      for (const cl of st.claws) {
        const cd = cl.cd, P = toGlobal(st.A, cd.x, cd.y, TMP2);
        const k = clamp(cl.k, 0, 1), e = 1 - (1 - k) * (1 - k);
        const tx = lerp(cl.x0, P.x, e), ty = lerp(cl.y0, P.y, e);
        c.lineCap = 'round';
        c.strokeStyle = NAVY; c.lineWidth = 12 * S; c.beginPath(); c.moveTo(cl.x0, cl.y0); c.lineTo(tx, ty); c.stroke();
        c.strokeStyle = '#FF6A3D'; c.lineWidth = 7 * S; c.stroke();
        if (cl.got) { c.save(); c.translate(tx, ty); c.scale(0.55, 0.55); paintCard(g, c, cd, cd.w, cd.h, S, 'idle'); c.restore(); }
        const ang = Math.atan2(ty - cl.y0, tx - cl.x0), op = cl.got ? 0.15 : 0.55;
        c.save(); c.translate(tx, ty); c.rotate(ang);
        c.fillStyle = '#FF6A3D'; c.strokeStyle = NAVY; c.lineWidth = 2.5 * S;
        for (const sgn of [-1, 1]) { c.beginPath(); c.ellipse(8 * S, sgn * 8 * S * (1 + op), 14 * S, 6 * S, sgn * op, 0, TAU); c.fill(); c.stroke(); }
        c.restore();
      }
    }
    function drawReplay(g, c) {
      if (!st.q || (st.phase !== 'race' && st.phase !== 'deal')) return;
      const L = st.L, S = L.S, x = L.rbx, y = L.rby, r = L.rbr;
      const k = g.speaking ? 1 + 0.08 * Math.sin(st.vt * 12) : 1;
      c.beginPath(); c.arc(x, y + 4 * S, r, 0, TAU); c.fillStyle = NAVY; c.fill();
      c.beginPath(); c.arc(x, y, r * k, 0, TAU); c.fillStyle = '#FFFBEF'; c.fill(); c.lineWidth = 3 * S; c.strokeStyle = NAVY; c.stroke();
      g.emoji('🔊', x, y, r * 1.1);
      if (!L.vert) g.text('再听', x, y + r + 12 * S, { size: Math.round(13 * S), font: 'round', color: '#FFFFFF', stroke: NAVY, strokeW: 3 * S });
    }
    function drawBig(g, c) {
      const b = st.big;
      if (!b) return;
      const L = st.L, S = L.S;
      const k = clamp(b.t / 0.25, 0, 1), pop = 1 + (1 - k) * 0.6 * Math.sin(k * Math.PI);
      const a = b.life > 50 ? 1 : clamp((b.life - b.t) / 0.25, 0, 1);
      if (a <= 0) return;
      const size = Math.round(clamp(g.w * 0.1, 34, 70) * (L.vert ? 0.8 : 1));
      const spots = [];
      if (!L.vert) spots.push([g.w / 2, st.A.R.y + st.A.R.h * 0.46, 0]);   // 画在字卡区上方（引擎的连击飘字在天上，不打架）
      else { spots.push([g.w / 2, st.A.R.cy, 0]); spots.push([g.w / 2, st.B.R.cy, Math.PI]); }
      const bw = g.measure(b.text, size, 'round') + size * 0.9, bh = size * 1.45;
      for (const sp of spots) {
        c.save(); c.translate(sp[0], sp[1]); c.rotate(sp[2]); c.scale(pop * k, pop * k);
        const a0 = c.globalAlpha; c.globalAlpha = a0 * a * 0.55;
        g.rrect(-bw / 2, -bh / 2, bw, bh, bh / 2, NAVY);
        c.globalAlpha = a0;
        g.shadowText(b.text, 0, 0, { size, font: 'round', color: b.color, strokeW: Math.max(4, size * 0.14), alpha: a });
        const sub = Array.isArray(b.sub) ? b.sub[sp[2] ? 1 : 0] : b.sub;   // 面对面时各自看“我 : 对方”
        if (sub) {
          const ss = Math.round(size * 0.5), sw = g.measure(sub, ss, 'round') + ss * 1.4;
          g.rrect(-sw / 2, bh / 2 + 4 * S, sw, ss * 1.6, ss * 0.8, '#FFFBEF', NAVY, 2.5 * S);
          g.text(sub, 0, bh / 2 + 4 * S + ss * 0.82, { size: ss, font: 'round', color: NAVY, alpha: a });
        }
        c.restore();
      }
    }

    /* ================= spec ================= */
    const spec = {
      maxLevel: MAXLV, lives: 0, rounds: 5, music: 'drum', sky: null,
      intro: '听到哪个词，就抢写对的那张字卡！抢到一张，绳子就往你这边拉一格。',
      controls: '点字卡（两个人可以同时按）· 键盘 QWER/ASDF 与 YUIO/HJKL · 空格再听',
      init(g) {
        st.g = g;
        if (!st.clouds.length) {
          for (let i = 0; i < 4; i++) st.clouds.push({ x: Math.random(), y: 0.2 + Math.random() * 0.45, s: 0.55 + Math.random() * 0.45, v: 8 + Math.random() * 10 });
          for (let i = 0; i < 46; i++) st.dots.push({ x: Math.random(), y: Math.random(), r: 1 + Math.random() * 1.6 });
        }
        setupMatch(g, st.chosen ? st.mode : (st.lobbySel ? 'duel' : 'solo'));
        st.phase = 'wait';
        showLobby(false);
        try { W.__hwTug = { st, tap: dbgTap, cardXY: dbgCardXY, sample: dbgSample }; } catch (e) { /* ignore */ }
      },
      play(g) {
        if (st.chosen) beginReady(g);
        else { st.phase = 'lobby'; showLobby(true); }
      },
      update(g, dt) {
        st.t += dt; st.pt += dt;
        if (st.phase === 'race') st.rt += dt;
        // 绳子：弹簧跟随目标位置
        st.vel += ((st.pos - st.show) * 95 - st.vel * 13) * dt;
        st.show += st.vel * dt;
        // 抢卡时的“拉锯”：一个人玩时岛主越想越近，绳子就被一点点拽过去（你一抢到就猛地拉回来）；两人时来回较劲
        let ct = 0;
        if (st.phase === 'race' && st.B) {
          if (st.mode === 'solo') { const k = st.B.lock > 0 ? 0 : clamp(st.B.t / Math.max(0.1, st.B.at), 0, 1); ct = 0.55 * k * k - (st.B.lock > 0 ? 0.25 : 0); }
          else ct = Math.sin(st.rt * 1.7) * 0.2;
        }
        st.creep += (ct - st.creep) * Math.min(1, dt * 7);
        // 脚下扬沙：两边在较劲
        st.dustT += dt;
        if (st.dustT > 0.42 && !st.L.vert && st.phase === 'race') {
          st.dustT = 0;
          for (const sd of [st.A, st.B]) {
            const sg = sd.id === 'A' ? -1 : 1, p = sceneXY(petU(sd) + sg * st.L.petR * 0.35, st.L.petR * 0.95, TMP2);
            g.burst(p.x, p.y, { kind: 'dot', color: '#E3BE78', n: 3 });
          }
        }
        for (const sd of [st.A, st.B]) {
          if (!sd) continue;
          const was = sd.lock;
          sd.lock = Math.max(0, sd.lock - dt);
          if (was > 0 && sd.lock === 0 && sd.who !== 'ai' && st.phase === 'race') g.sfx('pop');
          sd.pullT = Math.max(0, sd.pullT - dt); sd.stumble = Math.max(0, sd.stumble - dt);
          sd.dizzy = Math.max(0, sd.dizzy - dt); sd.bump = Math.max(0, sd.bump - dt * 3); sd.lockShake = Math.max(0, sd.lockShake - dt * 4);
          if (sd.banner) sd.banner.t += dt;
        }
        for (const sd of st.humans) for (const cd of sd.cards) {
          if (cd.shake > 0) cd.shake = Math.max(0, cd.shake - dt * 2.2);
          const hv = st.hover && st.hover.cd === cd && cd.st === 'idle' ? 1 : 0;
          cd.hov += (hv - cd.hov) * Math.min(1, dt * 14);
        }
        for (let i = st.flyers.length - 1; i >= 0; i--) {
          const f = st.flyers[i];
          f.k += dt / f.dur;
          if (f.k >= 1) { st.flyers.splice(i, 1); f.to.bump = 1; g.sfx('pop'); }
        }
        for (let i = st.claws.length - 1; i >= 0; i--) {
          const cl = st.claws[i];
          if (cl.ph === 'out') {
            cl.k += dt / 0.3;
            if (cl.k >= 1) {
              cl.k = 1; cl.ph = 'back';
              if (st.phase === 'race' && cl.cd.st === 'idle') aiTake(g, cl);
              else if (st.phase === 'resolve' || st.phase === 'race') { const p = sceneXY(petU(st.B), -st.L.petR * 1.6, TMP2); g.float('哎呀，慢了！', p.x, p.y, { color: '#D6ECFF', size: 22 }); }   // 这一局已经结束（孩子自己拍错把绳子送过线）就不说“慢了”
            }
          } else {
            cl.k -= dt / 0.4;
            if (cl.k <= 0) { st.claws.splice(i, 1); if (cl.got) { st.B.bump = 1; g.sfx('pop'); } }
          }
        }
        for (let i = st.fl.length - 1; i >= 0; i--) { st.fl[i].t += dt; if (st.fl[i].t > 0.95) st.fl.splice(i, 1); }
        if (st.big) { st.big.t += dt; if (st.big.t > st.big.life) st.big = null; }
        if (st.phase === 'race') {
          if (!st.q.auto && st.pt > 4.8 && st.humans.some((s) => s.gn <= 3) && !g.speaking) { st.q.auto = true; sayQ(g, true); }
          if (st.mode === 'solo') aiTick(g, dt);
          else if (st.pt > 14) nobody(g);
          if (LV[st.lv].shuf && st.phase === 'race') { st.shufT += dt; if (st.shufT > 3.3) { st.shufT = 0; shuffleCards(g); } }
        }
        // 快被拉进小河：脚下溅水
        st.splashT += dt;
        if (st.splashT > 0.35 && !st.L.vert && (st.phase === 'race' || st.phase === 'resolve')) {
          st.splashT = 0;
          for (const sd of [st.A, st.B]) {
            const u = petU(sd);
            if (Math.abs(u) < st.L.poolHW + st.L.petR * 0.3) { const p = sceneXY(u, st.L.petR * 0.9, TMP2); g.burst(p.x, p.y, { kind: 'water', n: 4 }); }
          }
        }
      },
      draw(g, c) {
        const now = nowMs();
        let dt = st.lastNow ? (now - st.lastNow) / 1000 : 0;
        st.lastNow = now;
        if (!(dt > 0)) dt = 0; else if (dt > 0.05) dt = 0.05;
        st.vt += dt;
        if (!st.A || !st.L.gSky) return;
        drawBackdrop(g, c);
        drawActors(g, c);
        for (const sd of st.humans) drawPanel(g, c, sd);
        drawFlyers(g, c);
        drawReplay(g, c);
        drawBig(g, c);
      },
      move(g, p) {
        if (p.type !== 'mouse' || p.down) return;
        st.hover = null;
        if (st.phase !== 'race') return;
        for (const sd of st.humans) {
          const R = sd.R;
          if (p.x < R.x || p.x > R.x + R.w || p.y < R.y || p.y > R.y + R.h) continue;
          const lp = toLocal(sd, p.x, p.y, TMP), cd = cardAt(sd, lp.x, lp.y);
          if (cd) st.hover = { cd };
        }
      },
      key(g, k) {
        st.kbd = true;
        if (st.phase === 'lobby') { lobbyKey(k); return; }
        if (k === 'space' || k === 'enter') { replay(g); return; }
        if (typeof k !== 'string' || k.length !== 1) return;
        const ch = k.toLowerCase();
        for (const sd of st.humans) {
          const si = keySlot(sd, ch);
          if (si < 0) continue;
          if (st.phase !== 'race') return;
          if (sd.lock > 0) { lockedTap(g, sd); return; }
          const cd = sd.cards.find((x) => x.si === si && x.st === 'idle');
          if (cd) grab(g, sd, cd);
          return;
        }
      },
      resize(g) { if (st.A) lay(g); if (st.phase === 'lobby') refreshLobby(); },
      /* 暂停时引擎把朗读掐断了：继续后重新念这一题，岛主也从头想（不然孩子回来就被抢走，还没听到词） */
      resume(g) {
        st.lastNow = 0;
        if (st.phase !== 'race' || !st.q) return;
        st.rt = 0; st.pt = 0; st.q.auto = false; st.shufT = 0;
        for (const sd of st.humans) for (const cd of sd.cards) cd.swapT = null;
        if (st.mode === 'solo' && st.B && !st.claws.length) { st.B.t = 0; st.B.warned = false; }
        sayQ(g, false);
      },
      dom(g, layer) {
        st.g = g;
        try {
          st.cv = g.c && g.c.canvas;
          st.onPtr = onPtr;
          if (st.cv) st.cv.addEventListener('pointerdown', st.onPtr);
        } catch (e) { /* ignore */ }
        buildLobby(layer);
      },
      end() {
        try { if (st.cv && st.onPtr) st.cv.removeEventListener('pointerdown', st.onPtr); } catch (e) { /* ignore */ }
        try { if (W.__hwTug && W.__hwTug.st === st) W.__hwTug = null; } catch (e) { /* ignore */ }
      }
    };

    /* ---------- 无头测试用：按真实坐标派发 pointerdown ---------- */
    function dbgCardXY(side, correct) {
      const sd = side === 'B' ? st.B : st.A;
      if (!sd || !sd.cards) return null;
      const cd = sd.cards.find((c) => c.st === 'idle' && !!c.ok === !!correct);
      if (!cd) return null;
      const p = toGlobal(sd, cd.x + drift(cd, 0), cd.y + drift(cd, 1), { x: 0, y: 0 });
      return [Math.round(p.x), Math.round(p.y)];
    }
    function dbgSample(lv, n, side) {   // 只读：按某关抽 n 道题 + 配卡，看干扰项（不改对局状态）
      const sd = side === 'B' ? st.B : st.A, keep = st.lv, out = [];
      st.lv = clamp(lv || 1, 1, MAXLV);
      try {
        const qs = shuffle(side === 'B' ? bankQs(sd.gr) : hostQs(st.g)).slice(0, n || 10);
        for (const q of qs) {
          const k = nCards(sd.gn, st.lv), mx = mixFor(sd.gn, st.lv, k - 1);
          const hand = q.kind === 'c' ? charHand(q, sd.gr, k - 1, mx.nearK, mx.midK, sd.gn >= 3) : wordHand(q, sd.gr, k - 1, mx.nearK, mx.midK, sd.gn >= 3);
          out.push(q.col + '|' + q.say1.slice(0, 14) + ' → ' + q.ans + ' ｜ ' + hand.join(' '));
        }
      } finally { st.lv = keep; }
      return out;
    }
    function dbgTap(side, correct, pid) {
      const xy = dbgCardXY(side, correct);
      if (!xy || !st.cv) return null;
      const r = st.cv.getBoundingClientRect();
      const ev = new PointerEvent('pointerdown', { clientX: r.left + xy[0], clientY: r.top + xy[1], pointerId: pid || (side === 'B' ? 7 : 3), pointerType: 'touch', isPrimary: side !== 'B', bubbles: true, cancelable: true });
      st.cv.dispatchEvent(ev);
      return xy;
    }
    return spec;
  }

  HW.register({
    id: 'tug', skill: 'listen', kind: 'arcade', name: '兄妹拔河', icon: '🪢',
    blurb: '听音抢字卡，把绳子拉过来（可两人同屏）',
    needs: ['tts'], cols: ['pick', 'words', 'chars'],
    start(ctx) {
      if (!HW.arcade || typeof HW.arcade.run !== 'function') {
        try { ctx.el.textContent = '游戏引擎没有加载，先玩别的吧。'; } catch (e) { /* ignore */ }
        return function () {};
      }
      return HW.arcade.run(ctx, makeSpec(ctx));
    }
  });
})();
