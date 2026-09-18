/* ==========================================================================
 * 30_games_b.js · E3 · 读/写 八个游戏
 * quiz 知识闯关 · match 拼音连连看 · order 句子排排队 · passage 阅读小侦探
 * stroke 笔顺描红 · build 偏旁魔术 · typo 错字侦探 · compose 小作家
 * 只依赖 SPEC §3 的 HW.register / HW.css / ctx 契约。
 * ========================================================================== */
(function () {
  'use strict';
  var HW = window.HW;
  if (!HW || typeof HW.register !== 'function') {
    try { console.error('[华文小岛] HW 核心未加载，30_games_b.js 跳过'); } catch (e) { /* noop */ }
    return;
  }

  /* ---------------- 公用小工具（纯 JS，不涉及样式类） ---------------- */
  const TYPE_ORDER = ['拼音', '声调', '部首', '笔画', '笔顺', '量词', '近义词', '反义词', '词语搭配', '叠词', '多音字',
    '形近字', '同音字', '成语', '关联词', '标点', '修辞', '病句', '歇后语', '古诗', '俗语', '地区词'];
  const PUNCT_RE = /[\s，。！？：；、“”‘’《》〈〉（）【】…—·,.!?:;'"()[\]　]/;
  const ZI_RE = /[㐀-鿿豈-﫿、-〿！-～“”‘’…—·]/;
  const isPunct = ch => PUNCT_RE.test(ch);
  const toChars = s => Array.from(s == null ? '' : String(s));
  const range = n => Array.from({ length: n }, (_, i) => i);
  const str = v => (v == null ? '' : String(v));
  const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
  const normPy = p => str(p).trim().toLowerCase().replace(/\s+/g, ' ');
  const countZi = s => toChars(s).filter(c => ZI_RE.test(c)).length;
  const stripPunct = s => toChars(s).filter(c => !isPunct(c)).join('');

  function css(text) {
    try { if (typeof HW.css === 'function') HW.css(text); } catch (e) { try { console.warn('[E3] HW.css', e); } catch (e2) { /* noop */ } }
  }
  function sfx(ctx, name) { try { if (ctx.sfx && typeof ctx.sfx[name] === 'function') ctx.sfx[name](); } catch (e) { /* noop */ } }
  function toast(ctx, msg) { try { if (typeof ctx.toast === 'function') ctx.toast(msg); } catch (e) { /* noop */ } }
  function avatar(ctx) { return str(ctx.profile && ctx.profile.avatar) || '🧒'; }
  function kidName(ctx) { return str(ctx.profile && ctx.profile.name); }
  function praise(ctx) {
    const n = kidName(ctx);
    const list = ['答对了！', '太棒了！', '好样的！', '真聪明！', '完全正确！'];
    if (n) list.push(n + '，真厉害！', n + '，太棒了！');
    return list[Math.floor(Math.random() * list.length)];
  }
  function validMCQ(q) {
    return !!q && Array.isArray(q.c) && q.c.length >= 2 && Number.isInteger(q.a) && q.a >= 0 && q.a < q.c.length;
  }
  /** 打乱选项并换算正确答案下标 */
  function shuffledMCQ(ctx, c, a) {
    const ord = ctx.shuffle(range(c.length));
    return { options: ord.map(i => str(c[i])), answer: ord.indexOf(a) };
  }
  function isReview(ctx) { return Array.isArray(ctx.review); }
  /** 错题重练取题：也必须走 ctx.pick —— 核心据此知道本轮真正出过哪些题，
   *  只给出过且没再错的题记“答对一次”；若只 shuffle，没出场的错题也会被记账、被误删。 */
  function pickReview(ctx, valid, n) {
    const arr = ctx.review.filter(valid);
    return arr.length ? ctx.pick(arr, n) : [];
  }
  /** 取题：错题重练时只用 ctx.review；否则 ctx.pick（优先没见过的） */
  function takeItems(ctx, key, n, valid) {
    if (isReview(ctx)) return pickReview(ctx, valid, n);
    const arr = (ctx.G && Array.isArray(ctx.G[key]) ? ctx.G[key] : []).filter(valid);
    return arr.length ? ctx.pick(arr, n) : [];
  }
  function showEmpty(ctx, msg) {
    const h = ctx.h;
    ctx.el.appendChild(h('div', { class: 'hw-card hw-center hw-stack' },
      h('div', { class: 'hw-scene' }, '📭'),
      h('p', { class: 'hw-q' }, msg || (isReview(ctx) ? '错题本里没有这个游戏的题目啦！' : '这个年级的题目还在准备中，换个游戏玩玩吧！'))));
  }
  function feedback(ctx, ok, title, detail) {
    const h = ctx.h;
    return h('div', { class: 'hw-feedback ' + (ok ? 'good' : 'bad'), role: 'status' },
      h('strong', {}, title), detail ? h('div', {}, detail) : null);
  }
  function reduceMotion() {
    try { return !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches); } catch (e) { return false; }
  }
  function nextBtn(ctx, label, fn) {
    const h = ctx.h;
    const b = h('button', {
      class: 'hw-btn primary big', type: 'button',
      on: { click: () => { if (b.disabled) return; b.disabled = true; fn(); } }
    }, label);
    // 手机上答完题，反馈和“下一题”常在屏幕外：滚到能看见再聚焦
    ctx.next(() => {
      try { b.scrollIntoView({ block: 'nearest', behavior: reduceMotion() ? 'auto' : 'smooth' }); } catch (e) { /* noop */ }
      try { b.focus({ preventScroll: true }); } catch (e) { /* noop */ }
    }, 60);
    return b;
  }
  /** 换题时回到页首（顶栏是 sticky 的，scrollIntoView 到 el 会被顶栏挡住一截，所以直接滚窗口） */
  function toTop(ctx) {
    try {
      const r = ctx.el.getBoundingClientRect();
      if (r.top < 0) window.scrollTo({ top: 0, behavior: reduceMotion() ? 'auto' : 'smooth' });
    } catch (e) { /* noop */ }
  }
  function starText(n) { n = clamp(n | 0, 0, 3); return '⭐'.repeat(n) + '☆'.repeat(3 - n); }

  /** 把 CSS token（可能是 oklch / light-dark 等任何写法）换算成 HanziWriter 能解析的 rgba() */
  function tokenColor(host, name, fallback) {
    let probe = null;
    try {
      probe = document.createElement('span');
      probe.style.color = 'var(' + name + ')';
      probe.style.display = 'none';
      (host || document.body).appendChild(probe);
      const cs = getComputedStyle(probe).color;
      const cv = document.createElement('canvas');
      cv.width = cv.height = 1;
      const g = cv.getContext && cv.getContext('2d');
      if (!g || !cs) return fallback;
      g.fillStyle = '#010203';
      g.fillStyle = cs;
      if (String(g.fillStyle).toLowerCase() === '#010203') return fallback;
      g.clearRect(0, 0, 1, 1);
      g.fillRect(0, 0, 1, 1);
      const d = g.getImageData(0, 0, 1, 1).data;
      if (!d || d[3] === 0) return fallback;
      return 'rgba(' + d[0] + ',' + d[1] + ',' + d[2] + ',' + (Math.round(d[3] / 255 * 100) / 100) + ')';
    } catch (e) {
      return fallback;
    } finally {
      try { if (probe && probe.parentNode) probe.parentNode.removeChild(probe); } catch (e) { /* noop */ }
    }
  }

  /** 每个游戏共用的动画/布局样式，前缀各自独立（g-<id>-） */
  function baseCss(id) {
    const p = 'g-' + id + '-';
    return `
.${p}root{max-width:980px;margin:0 auto}
.${p}pop{animation:${p}pop .45s ease-out both}
@keyframes ${p}pop{0%{transform:scale(.6);opacity:0}70%{transform:scale(1.08);opacity:1}100%{transform:scale(1);opacity:1}}
.${p}shake{animation:${p}shake .42s ease-in-out}
@keyframes ${p}shake{0%,100%{transform:translateX(0)}20%,60%{transform:translateX(-7px)}40%,80%{transform:translateX(7px)}}
.${p}head{display:flex;align-items:center;justify-content:space-between;gap:8px;flex-wrap:wrap}
.${p}meta{display:flex;align-items:center;justify-content:space-between;gap:8px;flex-wrap:wrap}
@media (prefers-reduced-motion:reduce){.${p}root *{animation:none!important;transition:none!important}}
`;
  }

  /* ======================================================================
   * 1. quiz 知识闯关（read）
   * ==================================================================== */
  css(baseCss('quiz') + `
.g-quiz-hero{display:flex;align-items:center;gap:12px}
.g-quiz-hero-av{font-size:46px;line-height:1}
.g-quiz-title{font-family:var(--font-display);font-size:22px;color:var(--ink)}
.g-quiz-pills{display:flex;flex-wrap:wrap;gap:8px}
.g-quiz-pill{min-height:44px;padding:0 14px;border-radius:999px;border:2px solid var(--read);background:var(--paper);color:var(--ink);font:inherit;font-size:16px;cursor:pointer;display:inline-flex;align-items:center;gap:6px}
.g-quiz-pill:hover{background:color-mix(in srgb,var(--read) 12%,var(--paper))}
.g-quiz-pill:focus-visible{outline:3px solid var(--gold);outline-offset:2px}
.g-quiz-pill.all{background:var(--read);color:var(--paper);font-weight:700}
.g-quiz-pill-n{font-size:12px;opacity:.75}
.g-quiz-track{position:relative;display:grid;gap:3px;padding-top:34px}
.g-quiz-cell{position:relative;aspect-ratio:1/1;min-width:0;display:flex;align-items:center;justify-content:center;border:1.5px solid var(--accent);border-radius:2px;background:var(--paper);color:var(--ink-soft);font-family:var(--font-py);font-size:clamp(10px,2.8vw,15px);overflow:hidden}
.g-quiz-cell::before,.g-quiz-cell::after{content:"";position:absolute;background:var(--accent);opacity:.22;pointer-events:none}
.g-quiz-cell::before{left:0;right:0;top:50%;height:1px}
.g-quiz-cell::after{top:0;bottom:0;left:50%;width:1px}
.g-quiz-cell.is-now{box-shadow:0 0 0 3px var(--gold);z-index:1}
.g-quiz-cell.ok{color:var(--good);font-size:clamp(12px,3.6vw,20px)}
.g-quiz-cell.no{color:var(--bad);font-weight:700}
.g-quiz-cell.flag{border-style:dashed;font-size:clamp(12px,3.6vw,20px)}
.g-quiz-runner{position:absolute;top:0;left:0;font-size:clamp(20px,6vw,28px);line-height:1;transform:translateX(-50%);transition:left .55s cubic-bezier(.3,1.3,.5,1)}
.g-quiz-runner.hop{animation:g-quiz-hop .55s ease-out}
@keyframes g-quiz-hop{0%,100%{margin-top:0}40%{margin-top:-10px}}
.g-quiz-combo{font-weight:700;color:var(--accent)}
.g-quiz-q{font-size:clamp(19px,4.8vw,24px);line-height:1.7}
`);

  HW.register({
    id: 'quiz', skill: 'read', name: '知识闯关', blurb: '拼音、成语、关联词……一路闯到终点', icon: '🏃',
    start(ctx) {
      const h = ctx.h, N = 10;
      const MIN_TYPE = 4;        // 题型题数太少就不单独开跑道（否则 1 题一轮 = 3 朵小红花，孩子会刷），这些题仍在“全部”里
      const valid = q => validMCQ(q) && !!str(q.q);
      const root = h('div', { class: 'g-quiz-root hw-stack' });
      ctx.el.appendChild(root);

      if (isReview(ctx)) {
        const list = pickReview(ctx, valid, N);
        if (!list.length) return showEmpty(ctx);
        run(list, '错题重练');
      } else {
        const all = (ctx.G.quiz || []).filter(valid);
        if (!all.length) return showEmpty(ctx);
        chooser(all);
      }

      function chooser(all) {
        root.textContent = '';
        ctx.setProgress(0, N);
        const tOf = q => str(q.t) || '其他';
        const counts = {};
        all.forEach(q => { counts[tOf(q)] = (counts[tOf(q)] || 0) + 1; });
        const types = TYPE_ORDER.filter(t => counts[t] >= MIN_TYPE)
          .concat(Object.keys(counts).filter(t => TYPE_ORDER.indexOf(t) < 0 && counts[t] >= MIN_TYPE));
        const pill = (label, n, list, extra) => h('button', {
          class: 'g-quiz-pill' + (extra || ''), type: 'button',
          on: { click: () => { sfx(ctx, 'tap'); run(ctx.pick(list, N), label); } }
        }, label, h('span', { class: 'g-quiz-pill-n' }, String(n)));
        root.appendChild(h('div', { class: 'hw-card hw-stack' },
          h('div', { class: 'g-quiz-hero' },
            h('span', { class: 'g-quiz-hero-av', 'aria-hidden': 'true' }, avatar(ctx)),
            h('div', {},
              h('div', { class: 'g-quiz-title' }, '选一条跑道，开始闯关！'),
              h('div', { class: 'hw-muted' }, '每轮 ' + N + ' 题，答一题前进一格，冲到 🏁 终点！'))),
          h('div', { class: 'g-quiz-pills' },
            pill('全部', all.length, all, ' all'),
            types.map(t => pill(t, counts[t], all.filter(q => tOf(q) === t))))));
      }

      function run(list, label) {
        const total = list.length;
        let i = 0, correct = 0, combo = 0;
        root.textContent = '';
        const cellsN = total + 1;
        const cells = range(total).map(k => h('div', { class: 'g-quiz-cell' }, String(k + 1)));
        const flag = h('div', { class: 'g-quiz-cell flag' }, '🏁');
        const runner = h('div', { class: 'g-quiz-runner', 'aria-hidden': 'true' }, avatar(ctx));
        const track = h('div', { class: 'g-quiz-track', style: 'grid-template-columns:repeat(' + cellsN + ',minmax(0,1fr))' },
          cells, flag, runner);
        const comboEl = h('span', { class: 'g-quiz-combo', 'aria-live': 'polite' });
        const stage = h('div', { class: 'hw-stack' });
        root.appendChild(h('div', { class: 'g-quiz-head' }, h('span', { class: 'hw-tag' }, label), comboEl));
        root.appendChild(track);
        root.appendChild(stage);

        function moveRunner(pos) {
          runner.style.left = ((pos + 0.5) / cellsN * 100).toFixed(3) + '%';
          runner.classList.remove('hop');
          void runner.offsetWidth;
          runner.classList.add('hop');
        }

        function show() {
          toTop(ctx);
          ctx.setProgress(i, total);
          cells.forEach((c, k) => c.classList.toggle('is-now', k === i));
          moveRunner(i);
          const q = list[i];
          const m = shuffledMCQ(ctx, q.c, q.a);
          const fb = h('div', { class: 'hw-stack' });
          const choices = ctx.mcq({
            options: m.options, answer: m.answer,
            onAnswer: (ok, idx) => {
              if (ok) {
                correct++; combo++;
                ctx.score.right(q);
                cells[i].classList.add('ok'); cells[i].textContent = '🌸';
              } else {
                combo = 0;
                ctx.score.wrong(q, '【' + str(q.t) + '】' + str(q.q) + '　正确：' + str(q.c[q.a]) + '；你选了：' + str(m.options[idx]));
                cells[i].classList.add('no'); cells[i].textContent = '✗';
              }
              comboEl.textContent = combo >= 2 ? '🔥 连击 ×' + combo : '';
              fb.appendChild(feedback(ctx, ok, ok ? praise(ctx) : '正确答案：' + str(q.c[q.a]), q.e ? str(q.e) : null));
              fb.appendChild(nextBtn(ctx, i + 1 < total ? '下一题 →' : '冲向终点 🏁', () => {
                i++;
                if (i < total) show(); else end();
              }));
            }
          });
          stage.textContent = '';
          stage.appendChild(h('div', { class: 'hw-card hw-stack' },
            h('div', { class: 'g-quiz-meta' },
              h('span', { class: 'hw-tag' }, str(q.t) || '知识'),
              h('span', { class: 'hw-muted' }, '第 ' + (i + 1) + ' / ' + total + ' 题')),
            h('div', { class: 'hw-q g-quiz-q' }, str(q.q)),
            choices, fb));
        }

        function end() {
          ctx.setProgress(total, total);
          cells.forEach(c => c.classList.remove('is-now'));
          moveRunner(total);
          stage.textContent = '';
          stage.appendChild(h('div', { class: 'hw-card hw-center hw-stack g-quiz-pop' },
            h('div', { class: 'hw-scene' }, '🏁'),
            h('p', { class: 'hw-q' }, '冲到终点！答对 ' + correct + ' / ' + total + ' 题')));
          sfx(ctx, 'win');
          ctx.next(() => ctx.finish({ correct, total }), 1100);
        }

        show();
      }
    }
  });

  /* ======================================================================
   * 2. match 拼音连连看（read）
   * ==================================================================== */
  css(baseCss('match') + `
.g-match-stats{display:inline-flex;gap:14px;font-family:var(--font-py);color:var(--ink-soft);font-size:15px}
.g-match-tip{margin:0}
.g-match-board{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr);gap:10px}
.g-match-col{display:flex;flex-direction:column;gap:10px}
.g-match-card{min-height:52px;padding:6px 8px;border:2px solid var(--line);border-radius:var(--radius);background:var(--paper);color:var(--ink);box-shadow:var(--shadow);cursor:pointer;word-break:break-word;transition:transform .15s,opacity .35s,border-color .15s,background .15s,visibility 0s .35s}
.g-match-card.w{font-family:var(--font-kai);font-size:clamp(20px,5.6vw,28px);letter-spacing:.06em}
.g-match-card.p{font-family:var(--font-py);font-size:clamp(15px,4.2vw,20px)}
.g-match-card:focus-visible{outline:3px solid var(--gold);outline-offset:2px}
.g-match-card.sel{border-color:var(--read);background:color-mix(in srgb,var(--read) 15%,var(--paper));transform:translateY(-2px) scale(1.02)}
.g-match-card.ok{border-color:var(--good);background:color-mix(in srgb,var(--good) 20%,var(--paper))}
.g-match-card.gone{opacity:0;transform:scale(.6);visibility:hidden;pointer-events:none}
.g-match-card:disabled{cursor:default}
.g-match-stars{font-size:30px;letter-spacing:4px}
`);

  HW.register({
    id: 'match', skill: 'read', name: '拼音连连看', blurb: '给词语找到它的拼音好朋友', icon: '🔗',
    start(ctx) {
      const h = ctx.h;
      const per = clamp((ctx.gradeNum | 0) + 3, 5, 8);           // P2 5 对 … P5/P6 8 对
      const PAR = { 2: 7, 3: 6, 4: 5.5, 5: 5, 6: 5 };             // 每对的“标准用时”（秒）
      const valid = w => !!w && !!str(w.w).trim() && !!str(w.py).trim();
      const uniq = list => {
        const sw = new Set(), sp = new Set();
        return list.filter(x => {
          const p = normPy(x.py), w = str(x.w);
          if (sw.has(w) || sp.has(p)) return false;             // 同拼音的两个词不能同盘，否则答案不唯一
          sw.add(w); sp.add(p); return true;
        });
      };
      let words;
      if (isReview(ctx)) {
        words = uniq(pickReview(ctx, valid, per * 2)).slice(0, per * 2);
      } else {
        const all = (ctx.G.words || []).filter(valid);
        words = uniq(all.length ? ctx.pick(all, per * 2) : []);
        if (words.length < per * 2) words = uniq(words.concat(ctx.shuffle(all))).slice(0, per * 2);
      }
      if (!words.length) return showEmpty(ctx);

      const boards = words.length > per
        ? [words.slice(0, Math.ceil(words.length / 2)), words.slice(Math.ceil(words.length / 2))]
        : [words];
      const totalPairs = words.length;
      // 错题重练常常只有 1–3 个词：一盘只剩 1 对就没得选了。补几张“干扰拼音”卡（不计分、不进错题本），
      // 干扰卡取本年级词库里拼音不同的词，只出拼音、不出词语，所以仍然“只练错题本里的题”。
      const DECOY_TO = 4;
      function decoysFor(list) {
        if (!isReview(ctx) || list.length >= DECOY_TO) return [];
        const used = new Set(words.map(x => normPy(x.py)));
        const pool = ctx.shuffle((ctx.G.words || []).filter(valid)).filter(x => {
          const p = normPy(x.py);
          if (used.has(p)) return false;
          used.add(p); return true;
        });
        return pool.slice(0, Math.max(2, DECOY_TO - list.length)).map(x => str(x.py));
      }
      let matched = 0, errors = 0, elapsedMs = 0, t0 = 0, tickGen = 0, running = false;
      const wrongOnce = new Set();

      const root = h('div', { class: 'g-match-root hw-stack' });
      ctx.el.appendChild(root);
      const boardLbl = h('span', { class: 'hw-tag' }, '');
      const timeEl = h('span', {}, '⏱ 0 秒');
      const errEl = h('span', {}, '❌ 0');
      root.appendChild(h('div', { class: 'g-match-head' }, boardLbl, h('span', { class: 'g-match-stats', 'aria-live': 'off' }, timeEl, errEl)));
      root.appendChild(h('p', { class: 'hw-muted g-match-tip' }, '先点一个词语，再点它的拼音（反过来也可以）。'));
      const area = h('div', {});
      root.appendChild(area);
      ctx.setProgress(0, totalPairs);

      const nowMs = () => elapsedMs + (running ? Date.now() - t0 : 0);
      function startTimer() {
        running = true; t0 = Date.now();
        const gen = ++tickGen;
        const tick = () => {
          if (!running || gen !== tickGen) return;
          timeEl.textContent = '⏱ ' + Math.floor(nowMs() / 1000) + ' 秒';
          ctx.next(tick, 1000);
        };
        tick();
      }
      function stopTimer() {
        if (running) { elapsedMs += Date.now() - t0; running = false; }
        tickGen++;
      }

      function playBoard(bi) {
        const list = boards[bi];
        boardLbl.textContent = boards.length > 1 ? '第 ' + (bi + 1) + ' / ' + boards.length + ' 盘' : '连连看';
        area.textContent = '';
        let left = list.length, sel = null;
        const wCards = [], pCards = [];
        const pys = list.map(x => str(x.py)).concat(decoysFor(list));
        const mk = (kind, idx) => {
          const b = h('button', {
            class: 'g-match-card ' + kind, type: 'button',
            on: { click: () => tap(kind, idx, b) }
          }, kind === 'w' ? str(list[idx].w) : pys[idx]);
          (kind === 'w' ? wCards : pCards)[idx] = b;
          return b;
        };
        const colW = h('div', { class: 'g-match-col' }, ctx.shuffle(range(list.length)).map(k => mk('w', k)));
        const colP = h('div', { class: 'g-match-col' }, ctx.shuffle(range(pys.length)).map(k => mk('p', k)));
        area.appendChild(h('div', { class: 'g-match-board' }, colW, colP));
        startTimer();

        function tap(kind, idx, b) {
          if (b.disabled || b.classList.contains('ok')) return;
          if (!sel) { sel = { kind, idx, b }; b.classList.add('sel'); sfx(ctx, 'tap'); return; }
          if (sel.b === b) { b.classList.remove('sel'); sel = null; return; }
          if (sel.kind === kind) {
            sel.b.classList.remove('sel');
            sel = { kind, idx, b }; b.classList.add('sel'); sfx(ctx, 'tap');
            return;
          }
          const wi = kind === 'w' ? idx : sel.idx;
          const pi = kind === 'p' ? idx : sel.idx;
          sel.b.classList.remove('sel');
          sel = null;
          const wb = wCards[wi], pb = pCards[pi];
          if (normPy(list[wi].py) === normPy(pys[pi])) {
            matched++; left--;
            [wb, pb].forEach(x => { x.classList.add('ok'); x.disabled = true; });
            ctx.score.right(list[wi]);
            ctx.setProgress(matched, totalPairs);
            ctx.next(() => { wb.classList.add('gone'); pb.classList.add('gone'); }, 380);
            if (left === 0) { stopTimer(); ctx.next(() => boardDone(bi), 800); }
          } else {
            errors++;
            errEl.textContent = '❌ ' + errors;
            [wb, pb].forEach(x => { x.classList.remove('g-match-shake'); void x.offsetWidth; x.classList.add('g-match-shake'); });
            ctx.next(() => { wb.classList.remove('g-match-shake'); pb.classList.remove('g-match-shake'); }, 450);
            const w = list[wi];
            if (!wrongOnce.has(w)) {
              wrongOnce.add(w);
              ctx.score.wrong(w, str(w.w) + ' 读 ' + str(w.py) + '；你连成了 ' + pys[pi]);
            } else {
              sfx(ctx, 'bad');
            }
          }
        }
      }

      function boardDone(bi) {
        if (bi + 1 < boards.length) {
          area.textContent = '';
          area.appendChild(h('div', { class: 'hw-card hw-center hw-stack g-match-pop' },
            h('div', { class: 'hw-scene' }, '🎉'),
            h('p', { class: 'hw-q' }, '第 ' + (bi + 1) + ' 盘完成！准备下一盘……')));
          sfx(ctx, 'flip');
          ctx.next(() => playBoard(bi + 1), 1200);
        } else {
          end();
        }
      }

      function end() {
        stopTimer();
        const secs = Math.max(1, Math.round(elapsedMs / 1000));
        const rate = errors / totalPairs;
        let stars = rate <= 0.1 ? 3 : rate <= 0.3 ? 2 : 1;
        const par = totalPairs * (PAR[ctx.gradeNum] || 6);
        if (secs > par * 1.5) stars = Math.max(1, stars - 1);
        ctx.setProgress(totalPairs, totalPairs);
        area.textContent = '';
        area.appendChild(h('div', { class: 'hw-card hw-center hw-stack g-match-pop' },
          h('div', { class: 'hw-scene' }, '🔗'),
          h('p', { class: 'hw-q' }, '全部配对成功！用时 ' + secs + ' 秒，' + (errors ? '配错 ' + errors + ' 次' : '一次没配错')),
          h('div', { class: 'g-match-stars', 'aria-label': stars + ' 星' }, starText(stars))));
        sfx(ctx, 'win');
        ctx.next(() => ctx.finish({ stars }), 1400);
      }

      playBoard(0);
      return () => { running = false; tickGen++; };
    }
  });

  /* ======================================================================
   * 3. order 句子排排队（read）
   * ==================================================================== */
  css(baseCss('order') + `
.g-order-slots{min-height:64px;border:2px dashed var(--line);border-radius:var(--radius);padding:10px;align-items:center}
.g-order-ph{font-size:15px}
.g-order-lbl{font-size:14px;color:var(--ink-soft);margin:0}
.g-order-para .g-order-pool,.g-order-para .g-order-slots{display:flex;flex-direction:column;align-items:stretch}
.g-order-para .hw-tile{text-align:left;justify-content:flex-start;line-height:1.6;white-space:normal;font-size:17px}
.g-order-good{box-shadow:0 0 0 3px var(--good)}
.g-order-num{display:inline-flex;align-items:center;justify-content:center;flex:none;width:24px;height:24px;margin-right:8px;border-radius:50%;background:var(--read);color:var(--paper);font-family:var(--font-py);font-size:13px;vertical-align:middle}
.g-order-ans{font-family:var(--font-kai);font-size:clamp(18px,4.6vw,22px);line-height:1.8}
.g-order-ctrl{display:flex;gap:10px;flex-wrap:wrap}
`);

  HW.register({
    id: 'order', skill: 'read', name: '句子排排队', blurb: '把打乱的词块排成通顺的句子', icon: '🧩',
    start(ctx) {
      const h = ctx.h, N = 6;
      const valid = o => !!o && Array.isArray(o.tiles) && o.tiles.length >= 2 && o.tiles.every(t => str(t).length > 0);
      const list = takeItems(ctx, 'order', N, valid);
      if (!list.length) return showEmpty(ctx);
      const total = list.length;
      let qi = 0, correct = 0;
      const root = h('div', { class: 'g-order-root hw-stack' });
      ctx.el.appendChild(root);

      /** 所有合法顺序（tiles 原顺序 + alts 里格式正确的） */
      function orders(o) {
        const n = o.tiles.length;
        const out = [range(n)];
        (Array.isArray(o.alts) ? o.alts : []).forEach(a => {
          if (Array.isArray(a) && a.length === n && a.slice().sort((x, y) => x - y).every((v, k) => v === k)) out.push(a);
        });
        return out;
      }

      function show() {
        toTop(ctx);
        ctx.setProgress(qi, total);
        const o = list[qi];
        const para = o.mode === 'para';
        const n = o.tiles.length;
        const valids = orders(o);
        const validStr = valids.map(ord => ord.map(k => str(o.tiles[k])).join(''));
        const ansFull = str(o.ans) || validStr[0];
        const suffix = ansFull.indexOf(validStr[0]) === 0 ? ansFull.slice(validStr[0].length) : '';
        const tiles = o.tiles.map((t, k) => ({ t: str(t), k }));
        let mix = ctx.shuffle(tiles);
        for (let k = 0; k < 10 && validStr.indexOf(mix.map(x => x.t).join('')) >= 0; k++) mix = ctx.shuffle(tiles);
        let placed = [], tries = 0, locked = false;

        root.textContent = '';
        root.classList.toggle('g-order-para', para);
        const pool = h('div', { class: 'hw-tiles g-order-pool' });
        const slots = h('div', { class: 'hw-slots g-order-slots', 'aria-label': '答题区' });
        const checkBtn = h('button', { class: 'hw-btn primary', type: 'button', on: { click: check } }, '检查 ✔');
        const clearBtn = h('button', {
          class: 'hw-btn ghost', type: 'button',
          on: { click: () => { if (locked) return; placed = []; draw(); } }
        }, '↺ 重来');
        const fb = h('div', { class: 'hw-stack' });

        function draw(okPrefix) {
          pool.textContent = ''; slots.textContent = '';
          mix.forEach(tile => {
            const on = placed.indexOf(tile) >= 0;
            const b = h('button', {
              class: 'hw-tile' + (on ? ' is-placed' : ''), type: 'button',
              on: { click: () => { if (locked || placed.indexOf(tile) >= 0) return; sfx(ctx, 'tap'); placed.push(tile); draw(); } }
            }, tile.t);
            if (on) { b.disabled = true; b.setAttribute('aria-hidden', 'true'); }
            pool.appendChild(b);
          });
          if (!placed.length) {
            slots.appendChild(h('span', { class: 'g-order-ph hw-muted' }, para ? '点下面的句子，按顺序排成一段话' : '点下面的词块，排成一句话'));
          }
          placed.forEach((tile, pos) => {
            const good = okPrefix != null && pos < okPrefix;
            const b = h('button', {
              class: 'hw-tile' + (good ? ' g-order-good' : ''), type: 'button',
              on: { click: () => { if (locked) return; sfx(ctx, 'tap'); placed = placed.filter(x => x !== tile); draw(); } }
            }, para ? [h('span', { class: 'g-order-num' }, String(pos + 1)), tile.t] : tile.t);
            if (locked) b.disabled = true;
            slots.appendChild(b);
          });
          checkBtn.disabled = locked || placed.length !== n;
          clearBtn.disabled = locked || !placed.length;
        }

        function check() {
          if (locked || placed.length !== n) return;
          const text = placed.map(x => x.t).join('');
          fb.textContent = '';
          if (validStr.indexOf(text) >= 0) {
            locked = true; correct++;
            ctx.score.right(tries ? undefined : o);   // 改了一次才对：计分算对，但不给错题本记“答对”
            draw(n);
            fb.appendChild(feedback(ctx, true, tries ? '改对了！' : praise(ctx), h('div', { class: 'g-order-ans' }, text + suffix)));
            fb.appendChild(nextBtn(ctx, qi + 1 < total ? '下一题 →' : '看成绩 ⭐', goNext));
          } else if (tries === 0) {
            tries = 1;
            sfx(ctx, 'bad');
            let best = 0;
            valids.forEach(ord => {
              let L = 0;
              while (L < n && placed[L].t === str(o.tiles[ord[L]])) L++;
              best = Math.max(best, L);
            });
            draw(best);
            slots.classList.remove('g-order-shake'); void slots.offsetWidth; slots.classList.add('g-order-shake');
            fb.appendChild(feedback(ctx, false, '差一点！再试一次',
              best > 0 ? '前面 ' + best + ' 块是对的（绿框），点后面的块退回去再排排看。' : '第一块就不太对哦，想想应该从哪里开始。'));
          } else {
            locked = true;
            ctx.score.wrong(o, '正确：' + ansFull + '；你排成：' + text);
            draw();
            fb.appendChild(feedback(ctx, false, '看看正确的顺序：', h('div', { class: 'g-order-ans' }, ansFull)));
            fb.appendChild(nextBtn(ctx, qi + 1 < total ? '下一题 →' : '看成绩 ⭐', goNext));
          }
        }

        root.appendChild(h('div', { class: 'g-order-meta' },
          h('span', { class: 'hw-tag' }, para ? '排成一段话' : '排成一句话'),
          h('span', { class: 'hw-muted' }, '第 ' + (qi + 1) + ' / ' + total + ' 题')));
        root.appendChild(h('div', { class: 'hw-card hw-stack' },
          h('p', { class: 'g-order-lbl' }, '我的答案（点它可以退回）'),
          slots,
          h('p', { class: 'g-order-lbl' }, para ? '句子池' : '词块池'),
          pool,
          h('div', { class: 'g-order-ctrl' }, checkBtn, clearBtn),
          fb));
        draw();
      }

      function goNext() {
        qi++;
        if (qi < total) show();
        else { ctx.setProgress(total, total); ctx.finish({ correct, total }); }
      }

      show();
    }
  });

  /* ======================================================================
   * 4. passage 阅读小侦探（read）
   * ==================================================================== */
  css(baseCss('passage') + `
.g-passage-wrap{display:grid;gap:14px;align-items:start}
@media (min-width:760px){
  .g-passage-wrap{grid-template-columns:minmax(0,1.1fr) minmax(0,1fr)}
  .g-passage-text{position:sticky;top:8px;max-height:calc(100vh - 24px);overflow:auto}
}
.g-passage-th{display:flex;justify-content:space-between;align-items:center;gap:8px;flex-wrap:wrap}
.g-passage-title{margin:0;font-family:var(--font-kai);font-size:clamp(20px,5vw,24px);color:var(--ink)}
.g-passage-body p{margin:.35em 0;text-indent:2em}
.g-passage-body[hidden]{display:none!important}
.g-passage-mission{margin:0;color:var(--ink-soft)}
.g-passage-q{font-size:clamp(18px,4.6vw,21px);line-height:1.7}
`);

  HW.register({
    id: 'passage', skill: 'read', name: '阅读小侦探', blurb: '读短文、找线索、答问题', icon: '🕵️',
    start(ctx) {
      const h = ctx.h;
      const valid = p => !!p && !!str(p.text).trim() && Array.isArray(p.qs) && p.qs.some(validMCQ);
      let list;
      if (isReview(ctx)) {
        const seen = new Set();
        list = pickReview(ctx, p => {
          if (!valid(p)) return false;
          const key = str(p.title) + '|' + str(p.text).slice(0, 40);
          if (seen.has(key)) return false;
          seen.add(key); return true;
        }, 2);
      } else {
        list = takeItems(ctx, 'passages', 1, valid);
      }
      if (!list.length) return showEmpty(ctx);
      const total = list.reduce((s, p) => s + p.qs.filter(validMCQ).length, 0);
      let done = 0, correct = 0, pi = 0;
      const root = h('div', { class: 'g-passage-root hw-stack' });
      ctx.el.appendChild(root);

      function showPassage() {
        toTop(ctx);
        const p = list[pi];
        const qs = p.qs.filter(validMCQ);
        let qi = 0;
        root.textContent = '';
        const paras = str(p.text).split(/\n+/).map(s => s.trim()).filter(Boolean);
        const body = h('div', { class: 'hw-passage g-passage-body' }, paras.map(s => h('p', {}, s)));
        const toggle = h('button', {
          class: 'hw-btn ghost', type: 'button', 'aria-expanded': 'true',
          on: {
            click: () => {
              const hide = !body.hidden;
              body.hidden = hide;
              toggle.textContent = hide ? '📖 展开正文' : '📕 收起正文';
              toggle.setAttribute('aria-expanded', hide ? 'false' : 'true');
            }
          }
        }, '📕 收起正文');
        const textCard = h('div', { class: 'hw-card hw-stack g-passage-text' },
          h('div', { class: 'g-passage-th' }, h('h3', { class: 'g-passage-title' }, str(p.title) || '短文'), toggle),
          body);
        const qArea = h('div', { class: 'hw-stack' });
        root.appendChild(h('p', { class: 'g-passage-mission' },
          '🕵️ 侦探任务：读懂短文，破解 ' + qs.length + ' 个问题' + (list.length > 1 ? '（第 ' + (pi + 1) + ' / ' + list.length + ' 篇）' : '')));
        root.appendChild(h('div', { class: 'g-passage-wrap' }, textCard, qArea));

        function showQ() {
          ctx.setProgress(done, total);
          const q = qs[qi];
          const m = shuffledMCQ(ctx, q.c, q.a);
          const fb = h('div', { class: 'hw-stack' });
          const choices = ctx.mcq({
            options: m.options, answer: m.answer,
            onAnswer: (ok, idx) => {
              done++;
              if (ok) { correct++; ctx.score.right(p); }
              else ctx.score.wrong(p, '《' + str(p.title) + '》' + str(q.q) + '　正确：' + str(q.c[q.a]) + '；你选了：' + str(m.options[idx]));
              ctx.setProgress(done, total);
              fb.appendChild(feedback(ctx, ok, ok ? '找到线索了！' : '正确答案：' + str(q.c[q.a]), q.e ? str(q.e) : null));
              const last = qi + 1 >= qs.length;
              const more = pi + 1 < list.length;
              fb.appendChild(nextBtn(ctx, !last ? '下一题 →' : (more ? '下一篇 →' : '看成绩 ⭐'), () => {
                if (!last) { qi++; showQ(); }
                else if (more) { pi++; showPassage(); }
                else ctx.finish({ correct, total });
              }));
            }
          });
          qArea.textContent = '';
          qArea.appendChild(h('div', { class: 'hw-card hw-stack' },
            h('div', { class: 'g-passage-meta' },
              h('span', { class: 'hw-tag' }, str(q.k) || '阅读'),
              h('span', { class: 'hw-muted' }, '第 ' + (qi + 1) + ' / ' + qs.length + ' 题')),
            h('div', { class: 'hw-q g-passage-q' }, str(q.q)),
            choices, fb));
        }
        showQ();
      }

      showPassage();
    }
  });

  /* ======================================================================
   * 5. stroke 笔顺描红（write）
   * ==================================================================== */
  css(baseCss('stroke') + `
.g-stroke-steps{display:flex;gap:6px;flex-wrap:wrap}
.g-stroke-step{padding:4px 10px;border-radius:999px;border:1.5px solid var(--line);color:var(--ink-soft);font-size:14px;white-space:nowrap}
.g-stroke-step.on{border-color:var(--write);color:var(--write);font-weight:700;background:color-mix(in srgb,var(--write) 10%,var(--paper))}
.g-stroke-step.done{border-color:var(--good);color:var(--good)}
.g-stroke-main{display:flex;flex-wrap:wrap;gap:16px;justify-content:center;align-items:flex-start}
.g-stroke-left{display:flex;flex-direction:column;align-items:center;gap:10px;flex:0 1 auto;min-width:0}
.g-stroke-boxwrap{display:flex;justify-content:center}
.g-stroke-box{flex:none;touch-action:none;-webkit-user-select:none;user-select:none;-webkit-touch-callout:none}
.g-stroke-tip{margin:0;min-height:1.5em;color:var(--ink-soft);text-align:center}
.g-stroke-ctrl{display:flex;flex-wrap:wrap;gap:10px;justify-content:center;align-items:center}
.g-stroke-info{flex:1 1 220px;max-width:360px}
.g-stroke-big{font-family:var(--font-kai);font-size:64px;line-height:1.15;text-align:center;color:var(--ink)}
.g-stroke-dl{display:grid;grid-template-columns:auto 1fr;gap:6px 14px;margin:8px 0}
.g-stroke-dl dt{color:var(--ink-soft)}
.g-stroke-dl dd{margin:0;font-weight:600}
.g-stroke-kai{font-family:var(--font-kai);font-size:20px}
.g-stroke-words{display:flex;flex-wrap:wrap;gap:8px;align-items:center}
.g-stroke-word{font-family:var(--font-kai);font-size:20px;padding:2px 8px;border-radius:6px;background:color-mix(in srgb,var(--write) 10%,var(--paper))}
.g-stroke-mist{font-weight:700;color:var(--bad);min-width:4.5em;text-align:center}
`);

  HW.register({
    id: 'stroke', skill: 'write', name: '笔顺描红', blurb: '看笔顺、描一描、再默写', icon: '✍️', needs: ['hanzi'],
    start(ctx) {
      const h = ctx.h;
      const N = (ctx.gradeNum | 0) <= 3 ? 4 : 5;
      const has = ch => { try { return !!(ctx.hanzi && ctx.hanzi.has(ch)); } catch (e) { return false; } };
      const strokeCount = ch => {
        try {
          const d = window.HW_STROKES && window.HW_STROKES[ch];
          return d && Array.isArray(d.strokes) ? d.strokes.length : 0;
        } catch (e) { return 0; }
      };
      const valid = c => !!c && typeof c.c === 'string' && toChars(c.c).length === 1 && has(c.c);
      const srcLen = isReview(ctx) ? ctx.review.length : (ctx.G.chars || []).length;
      const list = takeItems(ctx, 'chars', N, valid);
      if (!list.length) return showEmpty(ctx, srcLen ? '笔顺数据暂时没有加载成功，换个游戏玩玩吧！' : null);

      const size = clamp(Math.floor((ctx.el.clientWidth || 320) - 40), 200, 300);
      const col = {
        ink: tokenColor(ctx.el, '--ink', '#333333'),
        line: tokenColor(ctx.el, '--line', '#d9d9d9'),
        accent: tokenColor(ctx.el, '--accent', '#d8342a'),
        gold: tokenColor(ctx.el, '--gold', '#e5a50a'),
        write: tokenColor(ctx.el, '--write', '#3b6fd6')
      };
      let ci = 0, writer = null, charToken = 0, totalMist = 0, doneN = 0;
      const root = h('div', { class: 'g-stroke-root hw-stack' });
      ctx.el.appendChild(root);

      function killWriter() {
        if (!writer) return;
        try { writer.cancelQuiz(); } catch (e) { /* noop */ }
        try { if (typeof writer.pauseAnimation === 'function') writer.pauseAnimation(); } catch (e) { /* noop */ }
        writer = null;
      }
      function makeWriter(box, ch, extra) {
        killWriter();
        let w = null;
        try {
          w = ctx.hanzi.create(box, ch, Object.assign({
            width: size, height: size, padding: Math.round(size * 0.06),
            showCharacter: false, showOutline: true,
            strokeColor: col.ink, radicalColor: col.accent, outlineColor: col.line,
            highlightColor: col.gold, drawingColor: col.write,
            drawingWidth: Math.max(4, Math.round(size / 36)),
            strokeAnimationSpeed: (ctx.gradeNum | 0) <= 3 ? 0.9 : 1.1,
            delayBetweenStrokes: 320,
            showHintAfterMisses: 2,
            markStrokeCorrectAfterMisses: 5
          }, extra || {}));
        } catch (e) {
          try { console.warn('[stroke] HanziWriter 创建失败', e); } catch (e2) { /* noop */ }
          w = null;
        }
        writer = w || null;
        return writer;
      }
      const safe = fn => { try { const r = fn(); if (r && typeof r.catch === 'function') r.catch(() => {}); } catch (e) { /* noop */ } };
      const mask = (w, ch) => toChars(w).map(c => (c === ch ? '□' : c)).join('');

      function showChar() {
        toTop(ctx);
        const token = ++charToken;
        const item = list[ci];
        const ch = item.c;
        const n = strokeCount(ch);
        let step = 0;
        ctx.setProgress(ci, list.length);
        root.textContent = '';
        const stepEls = ['① 看笔顺', '② 描红', '③ 默写'].map(t => h('span', { class: 'g-stroke-step' }, t));
        const boxWrap = h('div', { class: 'g-stroke-boxwrap' });
        const info = h('div', { class: 'hw-card g-stroke-info' });
        const tip = h('p', { class: 'g-stroke-tip', 'aria-live': 'polite' });
        const ctrl = h('div', { class: 'g-stroke-ctrl' });
        const fb = h('div', { class: 'hw-stack' });
        root.appendChild(h('div', { class: 'g-stroke-head' },
          h('span', { class: 'hw-tag' }, '第 ' + (ci + 1) + ' / ' + list.length + ' 个字'),
          h('div', { class: 'g-stroke-steps' }, stepEls)));
        root.appendChild(h('div', { class: 'g-stroke-main' },
          h('div', { class: 'g-stroke-left' }, boxWrap, tip, ctrl), info));
        root.appendChild(fb);

        const live = () => token === charToken && ctx.alive();
        function newBox() {
          boxWrap.textContent = '';
          const b = h('div', { class: 'g-stroke-box', style: 'width:' + size + 'px;height:' + size + 'px' });
          boxWrap.appendChild(b);
          return b;
        }
        function renderInfo(hideChar) {
          info.textContent = '';
          const words = (Array.isArray(item.words) ? item.words : []).map(w => (hideChar ? mask(str(w), ch) : str(w)));
          const rows = [['拼音', h('span', { class: 'hw-py' }, str(item.py))]];
          if (!hideChar) rows.push(['部首', h('span', { class: 'g-stroke-kai' }, str(item.bs) || '—')]);
          rows.push(['结构', str(item.jg) || '—'], ['笔画', n ? n + ' 画' : '—']);
          info.appendChild(h('div', { class: 'g-stroke-big', 'aria-hidden': hideChar ? 'true' : 'false' }, hideChar ? '？' : ch));
          info.appendChild(h('dl', { class: 'g-stroke-dl' }, rows.flatMap(r => [h('dt', {}, r[0]), h('dd', {}, r[1])])));
          if (words.length) {
            info.appendChild(h('div', { class: 'g-stroke-words' },
              h('span', { class: 'hw-muted' }, '组词'),
              words.map(w => h('span', { class: 'g-stroke-word' }, w))));
          }
        }
        function setStep(s) {
          step = s;
          stepEls.forEach((e, k) => { e.classList.toggle('on', k === s - 1); e.classList.toggle('done', k < s - 1); });
          ctrl.textContent = '';
          fb.textContent = '';
        }
        const btn = (label, cls, fn) => h('button', { class: 'hw-btn ' + cls, type: 'button', on: { click: fn } }, label);

        function step1() {
          if (!live()) return;
          setStep(1);
          renderInfo(false);
          tip.textContent = '看清楚「' + ch + '」的笔顺' + (n ? '，一共 ' + n + ' 画。' : '。');
          const w = makeWriter(newBox(), ch, { showOutline: true });
          if (!w) return skipChar(token);
          const play = () => safe(() => w.animateCharacter());
          play();
          ctrl.appendChild(btn('▶ 再看一遍', 'ghost', () => { sfx(ctx, 'tap'); play(); }));
          ctrl.appendChild(btn('看会了，去描红 →', 'primary', step2));
        }

        function step2() {
          if (!live() || step >= 2) return;
          setStep(2);
          renderInfo(false);
          tip.textContent = '照着浅色的字描一描，注意笔顺哦。';
          const w = makeWriter(newBox(), ch, { showOutline: true });
          if (!w) return skipChar(token);
          const go = () => safe(() => w.quiz({
            showHintAfterMisses: 1,
            onComplete: () => {
              if (!live() || step !== 2) return;
              sfx(ctx, 'good');
              tip.textContent = '描得真好！接下来不看字，自己默写。';
              ctx.next(step3, 1100);
            }
          }));
          go();
          ctrl.appendChild(btn('↺ 重描', 'ghost', () => { if (step === 2) go(); }));
          ctrl.appendChild(btn('跳到默写 →', 'ghost', step3));
        }

        function step3() {
          if (!live() || step >= 3) return;
          setStep(3);
          renderInfo(true);
          tip.textContent = '不看字，自己默写出来！（同一笔错 2 次会有提示）';
          const w = makeWriter(newBox(), ch, { showOutline: false });
          if (!w) return skipChar(token);
          let mist = 0, finished = false;
          const mistEl = h('span', { class: 'g-stroke-mist', 'aria-live': 'polite' }, '错 0 笔');
          safe(() => w.quiz({
            showHintAfterMisses: 2,
            onMistake: () => {
              if (!live() || finished) return;
              mist++;
              mistEl.textContent = '错 ' + mist + ' 笔';
            },
            onComplete: sum => {
              if (!live() || finished) return;
              finished = true;
              const m = sum && Number.isFinite(sum.totalMistakes) ? sum.totalMistakes : mist;
              judge(m, false);
            }
          }));
          ctrl.appendChild(mistEl);
          ctrl.appendChild(btn('我不会，看答案', 'ghost', () => {
            if (finished || !live()) return;
            finished = true;
            killWriter();
            judge(null, true);
          }));
        }

        function judge(m, gaveUp) {
          if (!live()) return;
          step = 4;
          stepEls.forEach(e => { e.classList.remove('on'); e.classList.add('done'); });
          ctrl.textContent = '';
          renderInfo(false);
          const penalty = gaveUp ? Math.max(3, n || 3) : m;
          totalMist += penalty;
          doneN++;
          const ok = !gaveUp && m <= 1;
          if (ok) ctx.score.right(item);
          else {
            ctx.score.wrong(item, gaveUp
              ? ch + '（' + str(item.py) + '）默写时没写出来，共 ' + (n || '?') + ' 画，再看看笔顺'
              : ch + '（' + str(item.py) + '）默写时错了 ' + m + ' 笔，共 ' + (n || '?') + ' 画，要记住笔顺');
          }
          if (gaveUp) {
            const w = makeWriter(newBox(), ch, { showOutline: true });
            if (w) safe(() => w.animateCharacter());
          }
          tip.textContent = '';
          fb.appendChild(feedback(ctx, ok,
            gaveUp ? '看好「' + ch + '」的笔顺，下次一定行！'
              : m === 0 ? '一笔不错，满分！' : ok ? '只错了 1 笔，很棒！' : '错了 ' + m + ' 笔，再多练练。',
            null));
          const last = ci + 1 >= list.length;
          fb.appendChild(nextBtn(ctx, last ? '看成绩 ⭐' : '下一个字 →', () => {
            if (last) end(); else { ci++; showChar(); }
          }));
        }

        step1();
      }

      function skipChar(token) {
        if (token !== charToken || !ctx.alive()) return;
        toast(ctx, '「' + list[ci].c + '」的笔顺数据缺失，先跳过');
        if (ci + 1 < list.length) { ci++; showChar(); } else end();
      }

      function end() {
        killWriter();
        charToken++;
        ctx.setProgress(list.length, list.length);
        if (!doneN) {
          root.textContent = '';
          showEmpty(ctx, '笔顺数据暂时没有加载成功，换个游戏玩玩吧！');
          return;
        }
        const avg = totalMist / doneN;
        const stars = avg <= 0.5 ? 3 : avg <= 2 ? 2 : 1;
        ctx.finish({ stars });
      }

      showChar();
      return () => { charToken++; killWriter(); };
    }
  });

  /* ======================================================================
   * 6. build 偏旁魔术（write）
   * ==================================================================== */
  css(baseCss('build') + `
.g-build-stage{display:flex;flex-direction:column;align-items:center;gap:14px}
.g-build-eq{display:flex;align-items:center;justify-content:center;gap:clamp(4px,2vw,12px)}
.g-build-ch{position:relative;width:clamp(58px,17vw,84px);height:clamp(58px,17vw,84px);display:flex;align-items:center;justify-content:center;font-family:var(--font-kai);font-size:clamp(38px,11vw,56px);border:2px solid var(--accent);border-radius:6px;background:var(--paper);color:var(--ink)}
.g-build-slot{border-style:dashed;color:var(--ink-soft)}
.g-build-res{border-color:var(--write);color:var(--ink-soft)}
.g-build-op{font-size:clamp(22px,6vw,32px);color:var(--ink-soft)}
.g-build-in{animation:g-build-in .5s cubic-bezier(.3,1.4,.5,1) both;color:var(--accent);border-style:solid}
@keyframes g-build-in{0%{transform:translateY(40px) scale(.5);opacity:0}100%{transform:none;opacity:1}}
.g-build-badpick{color:var(--bad);border-color:var(--bad);border-style:solid}
.g-build-magic{animation:g-build-magic .7s ease-out both;color:var(--good);border-color:var(--good);box-shadow:0 0 0 4px color-mix(in srgb,var(--gold) 45%,transparent)}
@keyframes g-build-magic{0%{transform:scale(.3) rotate(-25deg);opacity:0}60%{transform:scale(1.2) rotate(6deg);opacity:1}100%{transform:none;opacity:1}}
.g-build-magic::after{content:"✨";position:absolute;top:-14px;right:-12px;font-size:22px}
.g-build-hint{display:flex;justify-content:center;align-items:flex-end;gap:4px;font-family:var(--font-kai);font-size:clamp(26px,7vw,34px);color:var(--ink)}
.g-build-hc{display:inline-flex;flex-direction:column;align-items:center}
.g-build-py{font-family:var(--font-py);font-size:15px;min-height:1.35em;color:var(--write)}
.g-build-box{display:inline-flex;align-items:center;justify-content:center;width:1.3em;height:1.3em;border:2px dashed var(--accent);border-radius:4px}
.g-build-hc.on .g-build-box{border-style:solid;border-color:var(--good);color:var(--good)}
.g-build-ask{margin:0;text-align:center}
`);

  HW.register({
    id: 'build', skill: 'write', name: '偏旁魔术', blurb: '加上偏旁，变出一个新字', icon: '🪄',
    start(ctx) {
      const h = ctx.h, N = 8;
      const valid = b => !!b && !!str(b.base) && !!str(b.rad) && !!str(b.ans) && Array.isArray(b.opts) &&
        b.opts.length >= 2 && b.opts.map(String).indexOf(String(b.rad)) >= 0;
      const list = takeItems(ctx, 'build', N, valid);
      if (!list.length) return showEmpty(ctx);
      const total = list.length;
      let qi = 0, correct = 0;
      const root = h('div', { class: 'g-build-root hw-stack' });
      ctx.el.appendChild(root);

      function show() {
        toTop(ctx);
        ctx.setProgress(qi, total);
        const b = list[qi];
        const base = str(b.base), rad = str(b.rad), ans = str(b.ans), py = str(b.py);
        const hint = str(b.hint) || ans;
        root.textContent = '';
        const slot = h('div', { class: 'g-build-ch g-build-slot', 'aria-label': '偏旁空位' }, '？');
        const result = h('div', { class: 'g-build-ch g-build-res', 'aria-label': '新字' }, '？');
        const eq = h('div', { class: 'g-build-eq' },
          h('div', { class: 'g-build-ch' }, base),
          h('span', { class: 'g-build-op' }, '＋'), slot,
          h('span', { class: 'g-build-op' }, '＝'), result);
        const hintEl = h('div', { class: 'g-build-hint' });
        const drawHint = reveal => {
          hintEl.textContent = '';
          const cs = toChars(hint);
          if (cs.indexOf(ans) < 0) {       // 数据异常兜底：hint 里没有 ans，就只给拼音
            hintEl.appendChild(h('span', { class: 'g-build-hc' + (reveal ? ' on' : '') },
              h('span', { class: 'g-build-py' }, py), h('span', { class: 'g-build-box' }, reveal ? ans : '　')));
            return;
          }
          cs.forEach(c => {
            if (c === ans) {
              hintEl.appendChild(h('span', { class: 'g-build-hc' + (reveal ? ' on' : '') },
                h('span', { class: 'g-build-py' }, py), h('span', { class: 'g-build-box' }, reveal ? c : '　')));
            } else {
              hintEl.appendChild(h('span', { class: 'g-build-hc' }, h('span', { class: 'g-build-py' }, ' '), h('span', {}, c)));
            }
          });
        };
        drawHint(false);
        const fb = h('div', { class: 'hw-stack' });
        const opts = ctx.shuffle(b.opts.map(String));
        const choices = ctx.mcq({
          options: opts, answer: opts.indexOf(rad), big: true,
          onAnswer: (ok, idx) => {
            const chosen = opts[idx];
            const reveal = () => {
              slot.textContent = rad;
              slot.classList.remove('g-build-badpick', 'g-build-shake');
              slot.classList.add('g-build-in');
              result.textContent = ans;
              result.classList.add('g-build-magic');
              drawHint(true);
            };
            if (ok) {
              correct++;
              ctx.score.right(b);
              reveal();
              fb.appendChild(feedback(ctx, true, '✨ 变！' + base + ' ＋ ' + rad + ' ＝ ' + ans, hint + '（' + py + '）'));
            } else {
              ctx.score.wrong(b, base + ' ＋ ' + rad + ' ＝ ' + ans + '（' + hint + '，' + py + '）；你选了：' + chosen);
              slot.textContent = chosen;
              slot.classList.add('g-build-badpick', 'g-build-shake');
              ctx.next(reveal, 750);
              fb.appendChild(feedback(ctx, false, '魔法失灵了！应该加「' + rad + '」', base + ' ＋ ' + rad + ' ＝ ' + ans + '，' + hint + '（' + py + '）'));
            }
            fb.appendChild(nextBtn(ctx, qi + 1 < total ? '下一题 →' : '看成绩 ⭐', () => {
              qi++;
              if (qi < total) show();
              else { ctx.setProgress(total, total); ctx.finish({ correct, total }); }
            }));
          }
        });
        root.appendChild(h('div', { class: 'g-build-meta' },
          h('span', { class: 'hw-tag' }, '🪄 偏旁魔术'),
          h('span', { class: 'hw-muted' }, '第 ' + (qi + 1) + ' / ' + total + ' 题')));
        root.appendChild(h('div', { class: 'hw-card hw-stack' },
          h('div', { class: 'g-build-stage' }, eq, hintEl,
            h('p', { class: 'hw-q g-build-ask' }, '给「' + base + '」加上哪个偏旁，能变出上面词语里缺的字？')),
          choices, fb));
      }

      show();
    }
  });

  /* ======================================================================
   * 7. typo 错字侦探（write）
   * ==================================================================== */
  css(baseCss('typo') + `
.g-typo-step{margin:0;font-weight:700;color:var(--ink)}
.g-typo-sent{display:flex;flex-wrap:wrap;gap:4px;align-items:flex-end}
.g-typo-cell{position:relative;width:44px;height:44px;min-width:44px;padding:0;display:inline-flex;align-items:center;justify-content:center;font-family:var(--font-kai);font-size:26px;line-height:1;border:1.5px solid color-mix(in srgb,var(--accent) 45%,var(--paper));border-radius:3px;background:var(--paper);color:var(--ink);cursor:pointer;transition:transform .15s}
.g-typo-cell:hover:not(:disabled){background:color-mix(in srgb,var(--gold) 20%,var(--paper));transform:scale(1.08)}
.g-typo-cell:disabled{cursor:default;opacity:1}
.g-typo-cell:focus-visible{outline:3px solid var(--gold);outline-offset:1px}
.g-typo-punct{display:inline-flex;align-items:flex-end;justify-content:center;width:20px;height:44px;font-family:var(--font-kai);font-size:24px;color:var(--ink-soft)}
.g-typo-found{border-color:var(--accent);border-radius:50%;box-shadow:0 0 0 3px var(--accent);color:var(--accent);font-weight:700;z-index:1}
.g-typo-reveal{animation:g-typo-pulse .9s ease-in-out 2}
@keyframes g-typo-pulse{50%{transform:scale(1.2)}}
.g-typo-miss{color:var(--bad);text-decoration:line-through}
.g-typo-fixed{border-color:var(--good);box-shadow:0 0 0 3px var(--good);color:var(--good)}
.g-typo-fixed::after{content:attr(data-bad);position:absolute;top:-10px;right:-8px;font-size:13px;color:var(--bad);text-decoration:line-through;background:var(--paper);border-radius:4px;padding:0 2px}
`);

  HW.register({
    id: 'typo', skill: 'write', name: '错字侦探', blurb: '拿起放大镜，揪出错别字', icon: '🔍',
    start(ctx) {
      const h = ctx.h, N = 8;
      // 错字必须是能点的字（标点不渲染成按钮，否则第一步永远点不到）；good ≠ bad
      const valid = t => !!t && typeof t.s === 'string' && Number.isInteger(t.i) && t.i >= 0 &&
        toChars(t.s)[t.i] === str(t.bad) && !isPunct(str(t.bad)) && !!str(t.good) && str(t.good) !== str(t.bad) &&
        Array.isArray(t.opts) && t.opts.map(String).indexOf(str(t.good)) >= 0;
      const list = takeItems(ctx, 'typo', N, valid);
      if (!list.length) return showEmpty(ctx);
      const total = list.length;
      let qi = 0, correct = 0;
      const root = h('div', { class: 'g-typo-root hw-stack' });
      ctx.el.appendChild(root);

      function show() {
        toTop(ctx);
        ctx.setProgress(qi, total);
        const t = list[qi];
        const cs = toChars(t.s);
        const bad = str(t.bad), good = str(t.good);
        let stage1 = null;                    // null 未点；true 点对；false 点错
        const cells = [];
        root.textContent = '';
        const stepTip = h('p', { class: 'g-typo-step' }, '🔍 第一步：句子里藏着一个错别字，点出它！');
        const sent = h('div', { class: 'g-typo-sent', role: 'group', 'aria-label': '句子' }, cs.map((c, k) => {
          if (isPunct(c)) return h('span', { class: 'g-typo-punct', 'aria-hidden': 'true' }, c);
          const b = h('button', {
            class: 'g-typo-cell', type: 'button', 'aria-label': '第 ' + (k + 1) + ' 个字：' + c,
            on: { click: () => tapCell(k) }
          }, c);
          cells[k] = b;
          return b;
        }));
        const msg = h('div', { class: 'hw-stack' });
        const area2 = h('div', { class: 'hw-stack' });
        const fb = h('div', { class: 'hw-stack' });

        function tapCell(k) {
          if (stage1 !== null) return;
          cells.forEach(b => { if (b) b.disabled = true; });
          if (k === t.i) {
            stage1 = true;
            cells[k].classList.add('g-typo-found');
            sfx(ctx, 'good');
            msg.appendChild(feedback(ctx, true, '找到了！就是这个「' + bad + '」。', null));
          } else {
            stage1 = false;
            cells[k].classList.add('g-typo-miss');
            if (cells[t.i]) cells[t.i].classList.add('g-typo-found', 'g-typo-reveal');
            ctx.score.wrong(t, '“' + str(t.s) + '”里错的是「' + bad + '」，应改为「' + good + '」；你点了「' + cs[k] + '」');
            msg.appendChild(feedback(ctx, false, '不是「' + cs[k] + '」哦，错字藏在红圈里：「' + bad + '」', null));
          }
          step2();
        }

        function step2() {
          stepTip.textContent = '✏️ 第二步：把「' + bad + '」改成哪个字？';
          const opts = ctx.shuffle(t.opts.map(String));
          const choices = ctx.mcq({
            options: opts, answer: opts.indexOf(good), big: true,
            onAnswer: (ok, idx) => {
              if (stage1) {
                if (ok) { correct++; ctx.score.right(t); }
                else ctx.score.wrong(t, '“' + str(t.s) + '”：「' + bad + '」应改为「' + good + '」；你改成了「' + opts[idx] + '」');
              } else {
                sfx(ctx, ok ? 'good' : 'bad');
              }
              const cell = cells[t.i];
              if (cell) {
                cell.textContent = good;
                cell.setAttribute('data-bad', bad);
                cell.classList.remove('g-typo-found', 'g-typo-reveal');
                cell.classList.add('g-typo-fixed');
              }
              const title = ok && stage1 ? '🎉 侦破成功！' + praise(ctx)
                : ok ? '第二步改对了！下次先把错字找准。' : '应该改成「' + good + '」';
              fb.appendChild(feedback(ctx, ok && stage1, title, t.e ? str(t.e) : null));
              fb.appendChild(nextBtn(ctx, qi + 1 < total ? '下一题 →' : '看成绩 ⭐', () => {
                qi++;
                if (qi < total) show();
                else { ctx.setProgress(total, total); ctx.finish({ correct, total }); }
              }));
            }
          });
          area2.appendChild(choices);
        }

        root.appendChild(h('div', { class: 'g-typo-meta' },
          h('span', { class: 'hw-tag' }, '🔍 错字侦探'),
          h('span', { class: 'hw-muted' }, '第 ' + (qi + 1) + ' / ' + total + ' 题')));
        root.appendChild(h('div', { class: 'hw-card hw-stack' }, stepTip, sent, msg, area2, fb));
      }

      show();
    }
  });

  /* ======================================================================
   * 8. compose 小作家（write）
   * ==================================================================== */
  css(baseCss('compose') + `
.g-compose-top{display:flex;align-items:center;gap:8px;flex-wrap:wrap}
.g-compose-prompt{font-size:clamp(19px,4.8vw,24px);line-height:1.6;margin:0}
.g-compose-desc{margin:0;color:var(--ink-soft)}
.g-compose-stat{display:flex;align-items:center;gap:10px;flex-wrap:wrap;font-size:15px}
.g-compose-stat .hw-meter{flex:1 1 140px}
.g-compose-ok{color:var(--good);font-weight:700}
.g-compose-no{color:var(--ink-soft)}
.g-compose-sub{margin:0;font-weight:700;color:var(--ink)}
.g-compose-checks{display:flex;flex-direction:column;gap:2px}
.g-compose-check{display:flex;align-items:center;gap:10px;min-height:44px;cursor:pointer}
.g-compose-cb{width:22px;height:22px;flex:none;accent-color:var(--good)}
.g-compose-eg summary{cursor:pointer;min-height:44px;display:flex;align-items:center;color:var(--write);font-weight:600}
.g-compose-eg p{font-family:var(--font-kai);font-size:19px;line-height:1.9;margin:.3em 0}
.g-compose-stars{font-size:26px;letter-spacing:4px}
.g-compose-tips{margin:0;padding-left:1.4em;line-height:1.8}
.g-compose-better{border-left:4px solid var(--good);padding-left:10px;font-family:var(--font-kai);font-size:18px;line-height:1.9}
.g-compose-ctrl{display:flex;gap:10px;flex-wrap:wrap}
.g-compose-root [hidden]{display:none!important}
`);

  function patternFrags(p) {
    return str(p).split(/……|…|\.{3}|⋯⋯|⋯/).map(stripPunct).filter(Boolean);
  }
  /** 按“……”切分后各片段都出现（重复片段要出现足够次数）即算用上；null = 无句式要求。
   *  长片段先数、数完挖掉，避免“还有的”里的“有的”被重复计数（有的……有的……还有的……）。 */
  function patternUsed(text, p) {
    const frags = patternFrags(p);
    if (!frags.length) return null;
    let plain = stripPunct(text);
    const need = {};
    frags.forEach(f => { need[f] = (need[f] || 0) + 1; });
    return Object.keys(need).sort((a, b) => b.length - a.length).every(f => {
      const parts = plain.split(f);
      plain = parts.join('\u0001');
      return parts.length - 1 >= need[f];
    });
  }
  /** 是否基本照抄了例句/例文（去标点后包含一整条 ≥8 字的例句） */
  function copiedExample(text, egs) {
    const plain = stripPunct(text);
    return egs.some(e => { const q = stripPunct(e); return q.length >= 8 && plain.indexOf(q) >= 0; });
  }

  HW.register({
    id: 'compose', skill: 'write', name: '小作家', blurb: '造句、看图写话，当个小作家', icon: '📝',
    start(ctx) {
      const h = ctx.h;
      const valid = c => !!c && !!str(c.prompt);
      const item = takeItems(ctx, 'compose', 1, valid)[0];
      if (!item) return showEmpty(ctx);
      const kind = str(item.kind) || '造句';
      const min = Math.max(1, Number(item.min) || 10);
      const pattern = str(item.pattern);
      const checks = (Array.isArray(item.check) ? item.check : []).map(str).filter(Boolean);
      const egs = (Array.isArray(item.eg) ? item.eg : []).map(str).filter(Boolean);
      let aiOk = false, aiStars = null, aiText = null, aiBusy = false, aiCalls = 0;
      let warnedShort = false, warnedTicks = false, done = false;
      const AI_MAX = 3;
      ctx.setProgress(0, 1);

      const root = h('div', { class: 'g-compose-root hw-stack' });
      ctx.el.appendChild(root);

      const ta = h('textarea', {
        class: 'hw-textarea', rows: (ctx.gradeNum | 0) >= 5 ? '8' : '5', maxlength: '800', spellcheck: 'false',
        'aria-label': '写作区', placeholder: kind === '造句' ? '在这里写你的句子……' : '在这里写……（可以用拼音输入法）',
        on: { input: refresh }
      });
      const countEl = h('span', {});
      const meterFill = h('span', {});
      const meter = h('div', { class: 'hw-meter', 'aria-hidden': 'true' }, meterFill);
      const patEl = h('span', {});
      const boxes = checks.map(c => {
        const cb = h('input', { type: 'checkbox', class: 'g-compose-cb', on: { change: refresh } });
        return { cb, el: h('label', { class: 'g-compose-check' }, cb, h('span', {}, c)) };
      });
      // .hw-btn 有 display:inline-flex，会盖过 UA 的 [hidden]；00_head 已有全局 [hidden] 规则，本游戏 CSS 里再兜一层
      const aiBtn = h('button', { class: 'hw-btn', type: 'button', on: { click: askAI } }, '🤖 请 AI 老师点评');
      aiBtn.hidden = true;
      const aiBox = h('div', { class: 'hw-stack', 'aria-live': 'polite' });
      const doneBtn = h('button', { class: 'hw-btn primary big', type: 'button', on: { click: submit } }, '写好了，交作业 ✔');
      const endBox = h('div', { class: 'hw-stack' });
      const ctrl = h('div', { class: 'g-compose-ctrl' }, aiBtn, doneBtn);

      root.appendChild(h('div', { class: 'hw-card hw-stack' },
        h('div', { class: 'g-compose-top' },
          h('span', { class: 'hw-tag' }, kind),
          h('span', { class: 'hw-muted' }, '至少 ' + min + ' 字')),
        h('p', { class: 'hw-q g-compose-prompt' }, str(item.prompt)),
        str(item.scene) ? h('div', { class: 'hw-scene', role: 'img', 'aria-label': str(item.desc) || '图' }, str(item.scene)) : null,
        str(item.desc) ? h('p', { class: 'g-compose-desc' }, '🖼️ ' + str(item.desc)) : null));
      root.appendChild(h('div', { class: 'hw-card hw-stack' },
        ta,
        h('div', { class: 'g-compose-stat' }, countEl, meter),
        pattern ? h('div', { class: 'g-compose-stat' }, patEl) : null));
      let checkCard = null;
      if (boxes.length) {
        checkCard = h('div', { class: 'hw-card hw-stack' },
          h('p', { class: 'g-compose-sub' }, '✅ 写完自己检查一下，做到了就打勾：'),
          h('div', { class: 'g-compose-checks' }, boxes.map(b => b.el)));
        root.appendChild(checkCard);
      }
      let egBox = null;
      if (egs.length) {
        egBox = h('details', { class: 'hw-card g-compose-eg' },
          h('summary', {}, kind === '造句' || kind === '仿写' ? '💡 看看例句（要用自己的话写哦）' : '💡 看看例文（要用自己的话写哦）'),
          egs.map(e => h('p', {}, e)));
        root.appendChild(egBox);
      }
      root.appendChild(aiBox);
      root.appendChild(ctrl);
      root.appendChild(endBox);

      function checkAi() {
        try {
          Promise.resolve(ctx.ai && typeof ctx.ai.ok === 'function' ? ctx.ai.ok() : false)
            .then(v => { aiOk = !!v; if (ctx.alive()) refresh(); })
            .catch(() => { aiOk = false; if (ctx.alive()) refresh(); });
        } catch (e) { aiOk = false; }
      }
      checkAi();

      function refresh() {
        if (!ctx.alive()) return;
        const text = ta.value || '';
        const n = countZi(text);
        countEl.textContent = '已写 ' + n + ' / 至少 ' + min + ' 字';
        countEl.className = n >= min ? 'g-compose-ok' : 'g-compose-no';
        meterFill.style.width = Math.min(100, Math.round(n / min * 100)) + '%';
        if (pattern) {
          const used = patternUsed(text, pattern);
          patEl.textContent = (used ? '✅ 用上了“' : '⬜ 还没用上“') + pattern + '”';
          patEl.className = used ? 'g-compose-ok' : 'g-compose-no';
        }
        aiBtn.hidden = done || !(aiOk && text.trim() && aiCalls < AI_MAX);
        aiBtn.disabled = aiBusy;
        doneBtn.hidden = done;
        doneBtn.disabled = done || n < 1;
      }

      function askAI() {
        const text = (ta.value || '').trim();
        if (done || aiBusy || !text || !aiOk || aiCalls >= AI_MAX) return;
        aiBusy = true; aiCalls++;
        refresh();
        aiBox.textContent = '';
        aiBox.appendChild(h('div', { class: 'hw-card hw-muted' }, '🤖 AI 老师正在认真看你写的……'));
        // 核心已给 AI 定好身份、年级和回复格式，这里只说清“练习要求”
        const task = [
          'P' + ctx.gradeNum + '「' + kind + '」练习。题目：' + str(item.prompt),
          str(item.desc) ? '画面：' + str(item.desc) : '',
          pattern ? '要用上：' + pattern : '',
          '至少 ' + min + ' 字',
          checks.length ? '自检要点：' + checks.join('；') : ''
        ].filter(Boolean).join('\n');
        let p;
        try { p = Promise.resolve(ctx.ai.review({ task, text })); } catch (e) { p = Promise.reject(e); }
        p.then(res => {
          if (!ctx.alive()) return;
          aiBusy = false;
          const s = Math.round(Number(res && res.stars));
          if (Number.isFinite(s)) { aiStars = clamp(s, 1, 3); aiText = text; }
          const tips = Array.isArray(res && res.tips) ? res.tips.map(str).filter(Boolean) : [];
          const better = str(res && res.better);
          aiBox.textContent = '';
          aiBox.appendChild(h('div', { class: 'hw-card hw-stack' },
            h('div', { class: 'g-compose-stars', 'aria-label': 'AI 老师给了 ' + (aiStars || 0) + ' 星' }, aiStars ? starText(aiStars) : '🤖'),
            str(res && res.praise) ? h('p', {}, '👍 ' + str(res.praise)) : null,
            tips.length ? h('ul', { class: 'g-compose-tips' }, tips.map(x => h('li', {}, x))) : null,
            better ? h('div', { class: 'hw-stack' }, h('span', { class: 'hw-muted' }, '老师帮你改一改：'), h('div', { class: 'g-compose-better' }, better)) : null,
            h('span', { class: 'hw-muted' }, aiCalls < AI_MAX ? '改一改再请老师看看也可以哦。改过以后，交作业时按你的自检来打星。' : '')));
          sfx(ctx, 'good');
          refresh();
        }).catch(e => {
          if (!ctx.alive()) return;
          aiBusy = false;
          const m = str(e && e.message);
          aiBox.textContent = '';
          aiBox.appendChild(h('div', { class: 'hw-feedback bad' },
            /[\u4e00-\u9fff]/.test(m) ? m : 'AI 老师暂时没空，用上面的自检清单给自己打分吧！'));
          checkAi();              // 没开权限之类的错误会让 ok() 变 false，按钮随之隐藏
          refresh();
        });
      }

      function selfStars(text) {
        const n = countZi(text);
        const ticked = boxes.filter(b => b.cb.checked).length;
        let s = boxes.length ? Math.round(ticked / boxes.length * 3) : (n >= min ? 3 : 2);
        if (n < min) s = Math.min(s, n * 2 < min ? 1 : 2);        // 字数不够：最多 2 星；不到一半：最多 1 星
        if (pattern && patternUsed(text, pattern) === false) s = Math.min(s, 2);
        return clamp(s, 0, 3);
      }

      function submit() {
        if (done || !ctx.alive()) return;
        const text = ta.value || '';
        const n = countZi(text);
        if (n < 1) return;
        if (n < min && !warnedShort) {
          warnedShort = true;
          toast(ctx, '还差 ' + (min - n) + ' 字哦！再写写，或者再点一次直接交。');
          return;
        }
        const useAi = aiStars != null && aiText === text.trim();   // 点评后又改过，就不再沿用那次的星
        if (!useAi && boxes.length && !boxes.some(b => b.cb.checked) && !warnedTicks) {
          warnedTicks = true;
          toast(ctx, '先对照自检清单，做到的打个勾，再交作业！');
          try { if (checkCard) checkCard.scrollIntoView({ block: 'center', behavior: reduceMotion() ? 'auto' : 'smooth' }); } catch (e) { /* noop */ }
          try { boxes[0].cb.focus({ preventScroll: true }); } catch (e) { /* noop */ }
          return;
        }
        done = true;
        ta.readOnly = true;
        boxes.forEach(b => { b.cb.disabled = true; });
        refresh();
        const copied = copiedExample(text, egs);
        let stars = useAi ? aiStars : selfStars(text);
        if (copied) stars = Math.min(stars, 1);
        if (stars >= 2) ctx.score.right(item);
        else ctx.score.wrong(item, '「' + kind + '」' + str(item.prompt) + '：这次得了 ' + stars + ' 星，再写一次试试');
        ctx.setProgress(1, 1);
        const msg = copied ? '和例句一模一样啦，下次用自己的话写！'
          : stars >= 3 ? '写得真棒，交作业成功！' : stars === 2 ? '写得不错，交作业成功！' : '交作业啦，下次写得更完整一点！';
        endBox.appendChild(h('div', { class: 'hw-card hw-stack g-compose-pop' },
          h('div', { class: 'g-compose-stars', 'aria-label': stars + ' 星' }, starText(stars)),
          feedback(ctx, stars >= 2 && !copied, msg, useAi ? '（按 AI 老师的点评打星）' : (boxes.length ? '（按你的自检打星）' : null)),
          egs.length ? h('div', { class: 'hw-stack' },
            h('span', { class: 'hw-muted' }, kind === '造句' || kind === '仿写' ? '和例句比一比：' : '和例文比一比：'),
            egs.map(e => h('div', { class: 'g-compose-better' }, e))) : null,
          nextBtn(ctx, '看成绩 ⭐', () => ctx.finish({ stars }))));
        if (egBox) egBox.hidden = true;
        sfx(ctx, stars >= 2 ? 'good' : 'flip');       // 结算页还会放 win，这里别重复
      }

      refresh();
    }
  });
})();
