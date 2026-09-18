/* 20_games_a.js — E2 游戏模块 A：pick 顺风耳 · story 故事电台 · dictation 听写大挑战 · readaloud 朗读小明星 · twister 绕口令擂台 · talk 小小主持人
 * 只通过 SPEC §3 的 ctx 契约与核心交互；样式只用公共类 + g-<id>- 前缀类，颜色只用 token。 */
(function () {
  'use strict';
  var HW = window.HW;
  if (!HW || typeof HW.register !== 'function') { try { console.error('[games_a] HW core missing'); } catch (e) {} return; }

  /* ================= 通用工具 ================= */
  var HAN_RE = /[㐀-䶿一-鿿豈-﫿]/;
  function isHan(ch) { return HAN_RE.test(ch); }
  function chars(s) { return Array.from(String(s == null ? '' : s)); }
  function hanOnly(s) { return chars(s).filter(isHan); }
  function uniq(arr) { var seen = {}, out = []; arr.forEach(function (x) { if (!seen[x]) { seen[x] = 1; out.push(x); } }); return out; }
  function now() { try { return performance.now(); } catch (e) { return Date.now(); } }
  function randOf(arr) { return arr[Math.floor(Math.random() * arr.length)]; }
  function hashStr(s) { var h = 5381; s = String(s); for (var i = 0; i < s.length; i++) h = ((h * 33) ^ s.charCodeAt(i)) >>> 0; return h.toString(36); }
  function starStr(n) { n = Math.max(0, Math.min(3, n | 0)); return n ? '⭐'.repeat(n) : '☆'; }
  function avgStars(arr) { var v = arr.filter(function (x) { return typeof x === 'number'; }); if (!v.length) return 0; var s = 0; v.forEach(function (x) { s += x; }); return Math.max(0, Math.min(3, Math.round(s / v.length))); }
  function accStars(acc) { return acc >= 0.9 ? 3 : acc >= 0.75 ? 2 : acc >= 0.5 ? 1 : 0; }

  // 阿拉伯数字 → 汉字读法（ASR 常把“十四”转成“14”）
  var ZD = '零一二三四五六七八九';
  function intToZh(str) {
    if (str.length > 4 || (str.length > 1 && str[0] === '0')) return chars(str).map(function (d) { return ZD[+d]; }).join('');
    var n = +str; if (n < 10) return ZD[n];
    var s = '', len = str.length, zero = false;
    for (var i = 0; i < len; i++) {
      var d = +str[i], pos = len - 1 - i;
      if (d === 0) { zero = true; continue; }
      if (zero && s) s += '零';
      zero = false; s += ZD[d] + ['', '十', '百', '千'][pos];
    }
    if (n >= 10 && n < 20) s = s.replace(/^一十/, '十');
    return s;
  }
  function normHyp(text) { return hanOnly(String(text || '').replace(/\d+/g, intToZh)); }
  var EQV = { '两': '二' };
  function eqCh(a, b) { return a === b || (EQV[a] || a) === (EQV[b] || b); }
  // 最长公共子序列：返回 ref 每个字是否被读到
  function lcsMatch(ref, hyp) {
    var n = ref.length, m = hyp.length, res = new Array(n).fill(false);
    if (!n || !m) return res;
    var W = m + 1, dp = new Uint16Array((n + 1) * W), i, j;
    for (i = n - 1; i >= 0; i--) for (j = m - 1; j >= 0; j--)
      dp[i * W + j] = eqCh(ref[i], hyp[j]) ? dp[(i + 1) * W + j + 1] + 1 : Math.max(dp[(i + 1) * W + j], dp[i * W + j + 1]);
    i = 0; j = 0;
    while (i < n && j < m) {
      if (eqCh(ref[i], hyp[j]) && dp[i * W + j] === dp[(i + 1) * W + j + 1] + 1) { res[i] = true; i++; j++; }
      else if (dp[(i + 1) * W + j] >= dp[i * W + j + 1]) i++; else j++;
    }
    return res;
  }
  function compareRead(text, spoken) {
    var ref = hanOnly(text), m = lcsMatch(ref, normHyp(spoken)), ok = 0;
    m.forEach(function (x) { if (x) ok++; });
    var miss = [], cur = '';
    m.forEach(function (x, k) { if (!x) cur += ref[k]; else if (cur) { miss.push(cur); cur = ''; } });
    if (cur) miss.push(cur);
    return { matched: m, acc: ref.length ? ok / ref.length : 0, miss: miss, heard: normHyp(spoken).length };
  }
  function renderCompare(h, text, matched, extraClass) {
    var k = 0;
    return h('div', { class: 'hw-passage hw-kai' + (extraClass ? ' ' + extraClass : '') }, chars(text).map(function (c) {
      if (!isHan(c)) return c;
      var ok = matched[k++];
      return h('span', { class: ok ? 'hw-hl-ok' : 'hw-hl-miss' }, c);
    }));
  }
  // 分句：句末 。！？ 连同其后的右引号/括号一起归入本句；换行也断句
  var END_P = '。！？!?', CLOSE_P = '。！？!?”’」』）)…';
  function splitSentences(text) {
    var out = [], buf = '', cs = chars(text);
    for (var i = 0; i < cs.length; i++) {
      var c = cs[i];
      if (c === '\n' || c === '\r') { if (buf.trim()) out.push(buf.trim()); buf = ''; continue; }
      buf += c;
      if (END_P.indexOf(c) >= 0) {
        while (i + 1 < cs.length && CLOSE_P.indexOf(cs[i + 1]) >= 0) buf += cs[++i];
        if (buf.trim()) out.push(buf.trim()); buf = '';
      }
    }
    if (buf.trim()) out.push(buf.trim());
    return out;
  }
  // 在 text 里把 word 包成高亮
  function markIn(h, text, word, cls) {
    text = String(text || ''); if (!word || text.indexOf(word) < 0) return [text];
    var parts = text.split(word), out = [];
    parts.forEach(function (p, i) { if (p) out.push(p); if (i < parts.length - 1) out.push(h('mark', { class: cls }, word)); });
    return out;
  }
  function tok(el, name) { try { return getComputedStyle(el).getPropertyValue(name).trim(); } catch (e) { return ''; } }

  /* ---- ctx 小封装（都做了防御） ---- */
  // 没有中文语音时不发声（否则会用英文声音乱读）；听力游戏靠 needs:['tts'] 保证有声音，说话游戏降级为无示范
  function ttsOk(ctx) { try { return !!(ctx.tts && ctx.tts.ok); } catch (e) { return false; } }
  function speak(ctx, text, opts) {
    if (!text || !ttsOk(ctx)) return Promise.resolve();
    try { return Promise.resolve(ctx.tts.speak(String(text), opts || {})).catch(function () {}); }
    catch (e) { return Promise.resolve(); }
  }
  function ttsStop(ctx) { try { ctx.tts.stop(); } catch (e) {} }
  function asrOk(ctx) { try { var a = ctx.asr; if (!a) return false; return typeof a.ok === 'function' ? !!a.ok() : !!a.ok; } catch (e) { return false; } }
  function asrStop(ctx) { try { if (ctx.asr && ctx.asr.stop) ctx.asr.stop(); } catch (e) {} }
  function hasStroke(ctx, ch) { try { return !!(ctx.hanzi && ctx.hanzi.has(ch)); } catch (e) { return false; } }
  // 错题重练也走 ctx.pick：核心据此只给“真正出过的题”记重练答对（shuffle+slice 会把没出的题也算上）
  function getItems(ctx, arr, n, valid) {
    var ok = valid || function (x) { return !!x; };
    var pool = (ctx.review && ctx.review.length) ? ctx.review : (Array.isArray(arr) ? arr : []);
    return (ctx.pick(pool.filter(ok), n) || []).filter(ok);
  }
  // 录音参数：continuous 让孩子句间停顿时不被提前切断；maxMs 按字数给够时间（核心 ASR 支持这两个可选项）
  function asrOpts(hanCount, onInterim, capMs) {
    return { continuous: true, maxMs: Math.min(capMs || 90000, 15000 + hanCount * 700), onInterim: onInterim };
  }
  // 反馈框：核心 .hw-feedback 是横排 flex 且自带 ✓/✗，内容统一包进一个竖排容器，手机上不挤成一行
  function fbBox(h, kind, kids, center) {
    return h('div', { class: 'hw-feedback' + (kind ? ' ' + kind : '') },
      h('div', { class: 'hw-stack g-pick-fbin' + (center ? ' hw-center' : '') }, kids));
  }
  function shuffleOpts(ctx, c, a) {
    var idx = ctx.shuffle(c.map(function (_, i) { return i; }));
    return { options: idx.map(function (i) { return c[i]; }), answer: idx.indexOf(a) };
  }
  function validMcq(q) { return q && typeof q.q === 'string' && Array.isArray(q.c) && q.c.length >= 2 && q.a >= 0 && q.a < q.c.length; }
  function btn(ctx, label, cls, onClick, attrs) {
    var p = { class: 'hw-btn' + (cls ? ' ' + cls : ''), type: 'button', on: { click: function (e) { if (ctx.alive()) onClick(e); } } };
    if (attrs) Object.keys(attrs).forEach(function (k) { p[k] = attrs[k]; });
    return ctx.h('button', p, label);
  }
  function horn(ctx, getText, label, extraCls, onPlay) {
    if (!ttsOk(ctx)) return null;
    return ctx.h('button', { class: 'hw-icon-btn' + (extraCls ? ' ' + extraCls : ''), type: 'button', 'aria-label': label || '朗读', title: label || '朗读',
      on: { click: function () { if (!ctx.alive()) return; var t = typeof getText === 'function' ? getText() : getText; ttsStop(ctx); var p = speak(ctx, t); if (onPlay) onPlay(p); } } }, '🔊');
  }
  function emptyState(ctx) {
    var msg = (ctx.review && ctx.review.length) ? '这些错题的题目已经更新过了，可以回错题本把它们移除，再玩新题。' : '这个年级的题目还在准备中，换个游戏玩吧！';
    ctx.el.replaceChildren(ctx.h('div', { class: 'hw-card hw-center hw-stack' }, ctx.h('div', { class: 'hw-scene' }, '🧺'), ctx.h('div', { class: 'hw-muted' }, msg)));
  }
  function praise(ctx) {
    var nm = (ctx.profile && ctx.profile.name) || '';
    var p = randOf(['答对啦！', '真棒！', '太厉害了！', '好样的！', '完全正确！']);
    return (nm && Math.random() < 0.4) ? nm + '，' + p : p;
  }
  function scrollNear(el) { try { if (el && el.scrollIntoView) el.scrollIntoView({ block: 'nearest', behavior: 'smooth' }); } catch (e) {} }
  function selfRate(ctx, labels, onRate) {
    // labels: [[stars, emoji, text], ...]
    return ctx.h('div', { class: 'hw-stack' },
      ctx.h('div', { class: 'hw-muted hw-center' }, '给自己评一评（也可以请爸爸妈妈来评）：'),
      ctx.h('div', { class: 'g-readaloud-self' }, labels.map(function (L) {
        return btn(ctx, [ctx.h('span', { class: 'g-readaloud-emo', 'aria-hidden': 'true' }, L[1]), ' ' + L[2]], 'big', function () { ctx.sfx.tap(); onRate(L[0]); });
      })));
  }
  function burst(ctx, host) {
    var b = ctx.h('div', { class: 'g-twister-burst', 'aria-hidden': 'true' }, ['🎉', '⭐', '🏆', '✨', '🎊', '🌟'].map(function (e, i) { return ctx.h('span', { style: '--i:' + i }, e); }));
    host.appendChild(b);
    ctx.next(function () { if (b.parentNode) b.parentNode.removeChild(b); }, 1800);
  }

  /* ================= 样式（只用 token + g-<id>- 前缀） ================= */
  var CSS = [
    /* pick */
    '.g-pick-top{display:flex;align-items:center;justify-content:center;gap:14px;flex-wrap:wrap}',
    '.g-pick-ear{font-size:52px;line-height:1;display:inline-block;transform-origin:50% 80%}',
    '.g-pick-ear.is-on{animation:g-pick-wiggle .7s ease-in-out infinite}',
    '@keyframes g-pick-wiggle{0%,100%{transform:rotate(0) scale(1)}30%{transform:rotate(-12deg) scale(1.08)}70%{transform:rotate(12deg) scale(1.08)}}',
    '.hw-icon-btn.g-pick-horn{width:80px;height:80px;min-width:80px;font-size:38px}',
    '.g-pick-opts .hw-choice{font-family:var(--font-kai);font-size:30px;min-height:64px}',
    '.g-pick-mark,.g-dictation-mark,.g-talk-mark{background:transparent;color:var(--accent);font-weight:700;border-bottom:3px solid var(--accent)}',
    '.g-pick-ans{font-family:var(--font-kai);font-size:36px;color:var(--ink)}',
    '.g-pick-ctx{font-size:22px;line-height:1.8}',
    '.g-pick-fbin{flex:1;min-width:0;gap:10px}',
    '.g-pick-fbin.hw-center{align-items:center}',
    /* story：收音机 */
    '.g-story-radio{position:relative;margin:30px auto 6px;width:100%;max-width:440px;box-sizing:border-box;background:var(--paper);border:3px solid var(--ink);border-radius:26px;padding:16px;box-shadow:var(--shadow)}',
    '.g-story-antenna{position:absolute;top:-30px;right:54px;width:4px;height:36px;background:var(--ink);border-radius:2px;transform:rotate(28deg);transform-origin:bottom center}',
    '.g-story-antenna::after{content:"";position:absolute;top:-7px;left:-5px;width:14px;height:14px;border-radius:50%;background:var(--accent)}',
    '.g-story-body{display:flex;gap:12px;align-items:center}',
    '.g-story-grille{flex:0 0 84px;width:84px;height:84px;border-radius:50%;border:3px solid var(--line);background:radial-gradient(circle,var(--ink-soft) 2px,transparent 2.6px) 0 0/11px 11px}',
    '.g-story-radio.is-on .g-story-grille{animation:g-story-thump .5s ease-in-out infinite alternate}',
    '@keyframes g-story-thump{from{transform:scale(1)}to{transform:scale(1.05)}}',
    '.g-story-screen{flex:1;min-width:0;background:var(--bg);border:2px solid var(--line);border-radius:14px;padding:10px 12px;display:flex;flex-direction:column;gap:4px}',
    '.g-story-fm{font-family:var(--font-py);font-size:12px;letter-spacing:.08em;color:var(--ink-soft)}',
    '.g-story-title{font-family:var(--font-kai);font-size:21px;color:var(--ink);overflow-wrap:anywhere}',
    '.g-story-count{font-size:16px;font-weight:700;color:var(--listen)}',
    '.g-story-wave{display:flex;align-items:flex-end;gap:4px;height:28px}',
    '.g-story-wave span{width:6px;height:5px;border-radius:3px;background:var(--listen);transition:height .2s}',
    '.g-story-radio.is-on .g-story-wave span{animation:g-story-bounce .9s ease-in-out infinite}',
    '.g-story-wave span:nth-child(2){animation-delay:.15s!important}.g-story-wave span:nth-child(3){animation-delay:.3s!important}.g-story-wave span:nth-child(4){animation-delay:.05s!important}.g-story-wave span:nth-child(5){animation-delay:.25s!important}.g-story-wave span:nth-child(6){animation-delay:.4s!important}.g-story-wave span:nth-child(7){animation-delay:.1s!important}',
    '@keyframes g-story-bounce{0%,100%{height:5px}50%{height:28px}}',
    '.g-story-ctrls{justify-content:center;margin-top:12px}',
    '.g-story-rule{font-size:14px}',
    '.g-story-text{font-size:22px}',
    '.g-story-s{cursor:pointer;border-radius:6px}',
    '.g-story-hl{background:var(--paper);background:color-mix(in srgb,var(--gold) 38%,transparent);border-radius:6px;box-shadow:0 2px 0 var(--gold)}',
    '.g-story-s.is-on{outline:2px solid var(--listen);outline-offset:2px}',
    '.g-story-qno{display:inline-block;min-width:20px;height:20px;line-height:20px;margin:0 2px;border-radius:10px;text-align:center;font-family:var(--font-py);font-size:12px;font-weight:700;background:var(--accent);color:var(--paper);vertical-align:super}',
    /* dictation */
    '.g-dictation-slots{display:flex;gap:8px;justify-content:center;flex-wrap:wrap}',
    '.g-dictation-slot{width:58px;height:58px;box-sizing:border-box;display:flex;align-items:center;justify-content:center;font-family:var(--font-kai);font-size:40px;color:var(--ink)}',
    '.g-dictation-slot.is-cur{outline:3px solid var(--accent);outline-offset:2px}',
    '.g-dictation-slot.is-ok{color:var(--good)}',
    '.g-dictation-slot.is-bad{color:var(--bad)}',
    '.g-dictation-pad{margin:0 auto;touch-action:none}',
    '.g-dictation-word{font-family:var(--font-kai);font-size:52px;line-height:1.2;color:var(--ink)}',
    '.g-dictation-py{font-size:20px}',
    '.g-dictation-s{font-size:21px;line-height:1.8}',
    '.g-dictation-q{font-family:var(--font-kai);font-size:30px;letter-spacing:.1em}',
    '.g-dictation-opts .hw-choice{font-family:var(--font-kai);font-size:34px;min-height:64px}',
    /* readaloud */
    '.g-readaloud-text{font-family:var(--font-kai);font-size:25px}',
    '.g-readaloud-s{cursor:pointer;border-radius:6px;transition:background .2s}',
    '.g-readaloud-s:hover{background:color-mix(in srgb,var(--speak) 12%,transparent)}',
    '.g-readaloud-s:focus-visible{outline:2px solid var(--speak);outline-offset:2px}',
    '.g-readaloud-s.is-on{background:var(--paper);background:color-mix(in srgb,var(--speak) 28%,transparent)}',
    '.g-readaloud-hard{display:flex;flex-wrap:wrap;gap:8px;justify-content:center}',
    '.g-readaloud-card{display:inline-flex;flex-direction:column;align-items:center;justify-content:center;min-height:52px;min-width:64px;padding:4px 12px;border:2px dashed var(--speak);border-radius:12px;background:var(--paper);color:var(--ink);cursor:pointer;font:inherit}',
    '.g-readaloud-card .hw-py{font-size:14px}',
    '.g-readaloud-card b{font-family:var(--font-kai);font-size:22px;font-weight:400}',
    '.g-readaloud-self{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:10px}',
    '.g-readaloud-emo{font-size:26px;vertical-align:middle}',
    '.g-readaloud-live{min-height:28px;font-family:var(--font-kai);font-size:19px;color:var(--ink-soft)}',
    '.g-readaloud-rec{animation:g-readaloud-pulse 1s ease-in-out infinite}',
    '@keyframes g-readaloud-pulse{0%,100%{box-shadow:0 0 0 0 var(--bad)}50%{box-shadow:0 0 0 8px transparent}}',
    '.g-readaloud-acc{font-size:30px;font-weight:700;color:var(--speak);font-family:var(--font-py)}',
    /* twister */
    '.g-twister-text{font-family:var(--font-kai);font-size:28px;line-height:2.5;text-align:center;color:var(--ink)}',
    '.g-twister-text ruby{ruby-position:over;margin:0 1px}',
    '.g-twister-text rt{font-family:var(--font-py);font-size:13px;color:var(--ink-soft);letter-spacing:0}',
    '.g-twister-text.is-nopy rt{visibility:hidden}',
    '.g-twister-pyline{font-family:var(--font-py);font-size:15px;color:var(--ink-soft);text-align:center}',
    '.g-twister-timer{font-family:var(--font-py);font-size:56px;font-weight:700;font-variant-numeric:tabular-nums;text-align:center;color:var(--speak);line-height:1.1}',
    '.g-twister-best{text-align:center;font-size:16px;color:var(--ink-soft)}',
    '.g-twister-card{position:relative;overflow:hidden}',
    '.g-twister-burst{position:absolute;inset:0;pointer-events:none}',
    '.g-twister-burst span{position:absolute;left:calc(8% + var(--i) * 15%);bottom:-40px;font-size:34px;animation:g-twister-up 1.6s ease-out forwards;animation-delay:calc(var(--i) * .08s)}',
    '@keyframes g-twister-up{0%{transform:translateY(0) scale(.6);opacity:0}20%{opacity:1}100%{transform:translateY(-260px) scale(1.2) rotate(20deg);opacity:0}}',
    /* talk */
    '.g-talk-desc{font-size:19px;line-height:1.7}',
    '.g-talk-starters{display:flex;flex-direction:column;gap:8px}',
    '.g-talk-starter{display:flex;align-items:center;gap:8px;min-height:44px;padding:6px 12px;border-left:5px solid var(--speak);border-radius:8px;background:var(--bg);font-family:var(--font-kai);font-size:20px;color:var(--ink);cursor:pointer;text-align:left;border-top:0;border-right:0;border-bottom:0;font-weight:400}',
    '.g-talk-words{display:flex;flex-wrap:wrap;gap:8px}',
    '.g-talk-word{min-height:44px;padding:6px 14px;border-radius:22px;border:2px solid var(--gold);background:var(--paper);font-family:var(--font-kai);font-size:20px;color:var(--ink);cursor:pointer}',
    '.g-talk-cd{font-family:var(--font-py);font-size:52px;font-weight:700;font-variant-numeric:tabular-nums;text-align:center;color:var(--speak);line-height:1.1}',
    '.g-talk-cd.is-low{color:var(--bad)}',
    '.g-talk-live{min-height:32px;font-family:var(--font-kai);font-size:19px;line-height:1.7;color:var(--ink-soft)}',
    '.g-talk-follow{font-size:22px}',
    '.g-talk-ai ul{margin:4px 0;padding-left:1.3em}',
    '.g-talk-better{font-family:var(--font-kai);font-size:19px;line-height:1.8}',
    '@media (prefers-reduced-motion: reduce){.g-pick-ear.is-on,.g-story-radio.is-on .g-story-grille,.g-story-radio.is-on .g-story-wave span,.g-readaloud-rec,.g-twister-burst span{animation:none!important}.g-story-radio.is-on .g-story-wave span{height:16px}.g-twister-burst{display:none}}'
  ].join('\n');
  var cssDone = false;
  function injectCss() { if (cssDone) return; cssDone = true; try { HW.css(CSS); } catch (e) { cssDone = false; } }
  try { injectCss(); } catch (e) {}

  /* ================= 1. pick 顺风耳 ================= */
  function validPick(it) { return it && typeof it.say === 'string' && typeof it.ctx === 'string' && Array.isArray(it.c) && it.c.length >= 2 && it.a >= 0 && it.a < it.c.length; }

  HW.register({
    id: 'pick', skill: 'listen', name: '顺风耳', blurb: '听一听，选出正确的词', icon: '👂', needs: ['tts'],
    start: function (ctx) {
      injectCss();
      var h = ctx.h;
      var items = getItems(ctx, ctx.G.pick, 10, validPick);
      if (!items.length) { emptyState(ctx); return function () {}; }
      var total = items.length, i = 0, correct = 0, pid = 0;

      function show() {
        if (!ctx.alive()) return;
        ttsStop(ctx);
        ctx.setProgress(i, total);
        var it = items[i];
        var sh = shuffleOpts(ctx, it.c, it.a);
        var ear = h('span', { class: 'g-pick-ear', 'aria-hidden': 'true' }, '👂');
        function play(text) {
          var my = ++pid; ttsStop(ctx); ear.classList.add('is-on');
          return speak(ctx, text).then(function () { if (my === pid && ctx.alive()) ear.classList.remove('is-on'); });
        }
        var hornBtn = h('button', { class: 'hw-icon-btn g-pick-horn', type: 'button', 'aria-label': '再听一遍词语', title: '再听一遍',
          on: { click: function () { if (ctx.alive()) play(it.say); } } }, '🔊');
        var fb = h('div', { class: 'g-pick-fb', 'aria-live': 'polite' });
        var qNo = i, moved = false;
        var choices = ctx.mcq({ options: sh.options, answer: sh.answer, big: true, onAnswer: function (ok, idx) {
          if (!ctx.alive()) return;
          var chosen = sh.options[idx];
          if (ok) { correct++; ctx.score.right(it); }
          else ctx.score.wrong(it, it.say + ' ' + it.py + '，你选了：' + chosen);
          ctx.setProgress(i + 1, total);
          var last = i + 1 >= total;
          fb.replaceChildren(fbBox(h, ok ? 'good' : 'bad', [
            h('div', { class: 'hw-row', style: 'align-items:center' },
              h('span', { class: 'g-pick-ans' }, it.say), h('span', { class: 'hw-py' }, it.py || '')),
            h('div', {}, ok ? praise(ctx) : '你选了“' + chosen + '”，正确的是“' + it.say + '”。'),
            h('div', { class: 'hw-row', style: 'align-items:center;flex-wrap:nowrap' },
              horn(ctx, it.ctx, '读句子'),
              h('div', { class: 'g-pick-ctx hw-kai' }, markIn(h, it.ctx, it.say, 'g-pick-mark'))),
            btn(ctx, last ? '看成绩 🎉' : '下一题 ➜', 'primary big', function () {
              if (moved) return; moved = true;
              i++; if (i >= total) { ttsStop(ctx); ctx.finish({ correct: correct, total: total }); } else show();
            })
          ]));
          scrollNear(fb);
          // 答完自动读一遍句子；孩子已点“下一题”就别再读旧句子盖掉新题的词
          ctx.next(function () { if (qNo === i && !moved) play(it.ctx); }, 500);
        } });
        ctx.el.replaceChildren(h('div', { class: 'hw-stack g-pick' },
          h('div', { class: 'hw-card hw-center hw-stack' },
            h('div', { class: 'g-pick-top' }, ear, hornBtn, btn(ctx, '📖 听句子', 'ghost', function () { play(it.ctx); })),
            h('div', { class: 'hw-muted' }, '第 ' + (i + 1) + ' / ' + total + ' 题 · 选项读音都差不多，听听句子，想想句子里是哪个词')),
          h('div', { class: 'g-pick-opts' }, choices),
          fb));
        // 同音选项只靠词语本身分不出（如 只/支/枝），进题先读词语、再读句子；没答题前才自动接读句子
        var my0 = pid + 1;
        play(it.say).then(function () {
          if (my0 !== pid || !ctx.alive() || moved || choices.classList.contains('is-locked')) return;
          ctx.next(function () { if (my0 === pid && !moved && !choices.classList.contains('is-locked')) play(it.ctx); }, 450);
        });
      }
      show();
      return function () { pid++; ttsStop(ctx); };
    }
  });

  /* ================= 2. story 故事电台 ================= */
  function validStory(st) { return st && typeof st.text === 'string' && st.text.length > 0 && Array.isArray(st.qs) && st.qs.some(validMcq); }
  // 找出每一句与哪些题有关：正确选项原文、讲解里“”引用的原文
  function relevantSentences(sents, qs) {
    var hanS = sents.map(function (s) { return hanOnly(s).join(''); });
    var map = sents.map(function () { return []; });
    qs.forEach(function (q, qi) {
      var cands = [];
      var ans = hanOnly(q.c[q.a]).join(''); if (ans.length >= 2) cands.push(ans);
      String(q.e || '').replace(/“([^”]+)”/g, function (_, m) { var t = hanOnly(m).join(''); if (t.length >= 2) cands.push(t); return _; });
      var hit = false;
      cands.forEach(function (c) {
        if (hit) return;
        hanS.forEach(function (s, k) { if (s.indexOf(c) >= 0) { if (map[k].indexOf(qi + 1) < 0) map[k].push(qi + 1); hit = true; } });
      });
    });
    return map;
  }

  HW.register({
    id: 'story', skill: 'listen', name: '故事电台', blurb: '打开收音机，听故事答问题', icon: '📻', needs: ['tts'],
    start: function (ctx) {
      injectCss();
      var h = ctx.h;
      var st = getItems(ctx, ctx.G.stories, 1, validStory)[0];
      if (!st) { emptyState(ctx); return function () {}; }
      var sents = splitSentences(st.text);
      var qs = st.qs.filter(validMcq), total = qs.length;
      var S = { cur: 0, playing: false, heardAll: false, started: false, replays: 0, pid: 0, phase: 'listen' };
      var correct = 0, results = [];
      var canTTS = !!(ctx.tts && ctx.tts.ok);
      ctx.setProgress(0, total);

      var countEl = h('div', { class: 'g-story-count', 'aria-live': 'polite' }, '共 ' + sents.length + ' 句 · 准备收听');
      var wave = h('div', { class: 'g-story-wave', 'aria-hidden': 'true' }, [1, 2, 3, 4, 5, 6, 7].map(function () { return h('span', {}); }));
      var playBtn = btn(ctx, '▶ 开始收听', 'primary big', function () {
        if (S.playing) { pause(); return; }
        if (S.heardAll && S.cur === 0) { S.replays++; updateInfo(); } // 播完后再听 = 重听
        playFrom(S.cur);
      });
      var replayBtn = btn(ctx, '⟲ 从头再听', 'ghost', function () { S.replays++; updateInfo(); playFrom(0); });
      replayBtn.disabled = true;
      var radio = h('div', { class: 'g-story-radio' },
        h('div', { class: 'g-story-antenna', 'aria-hidden': 'true' }),
        h('div', { class: 'g-story-body' },
          h('div', { class: 'g-story-grille', 'aria-hidden': 'true' }),
          h('div', { class: 'g-story-screen' },
            h('div', { class: 'g-story-fm' }, 'FM 华文 · 故事电台'),
            h('div', { class: 'g-story-title' }, '《' + (st.title || '今日故事') + '》'),
            countEl, wave)),
        h('div', { class: 'hw-row g-story-ctrls' }, playBtn, replayBtn));
      var info = h('div', { class: 'hw-muted hw-center g-story-rule' });
      var goBtn = btn(ctx, '我听懂了，去答题 ➜', 'primary big', function () { startQuestions(); });
      goBtn.disabled = true;
      var area = h('div', { class: 'hw-stack' });
      function updateInfo() {
        info.textContent = '竖起耳朵听，故事文字最后才揭晓。一次听懂星星最多（免费重听 1 次）' + (S.replays ? ' · 已重听 ' + S.replays + ' 次' : '');
      }
      function updateBtns() {
        playBtn.textContent = S.playing ? '⏸ 暂停' : (S.started && S.cur > 0 ? '▶ 继续' : (S.heardAll ? '▶ 再听一遍' : '▶ 开始收听'));
        replayBtn.disabled = !S.started;
        goBtn.disabled = !S.heardAll;
      }
      function playFrom(start) {
        var my = ++S.pid; ttsStop(ctx);
        S.started = true; S.playing = true; radio.classList.add('is-on'); updateBtns();
        var k = start;
        (function step() {
          if (!ctx.alive() || my !== S.pid) return;
          if (k >= sents.length) {
            S.playing = false; S.cur = 0; S.heardAll = true; radio.classList.remove('is-on');
            countEl.textContent = '📻 播完啦！可以去答题了';
            updateBtns(); return;
          }
          S.cur = k; countEl.textContent = '第 ' + (k + 1) + ' / ' + sents.length + ' 句';
          speak(ctx, sents[k]).then(function () { if (!ctx.alive() || my !== S.pid) return; k++; ctx.next(step, 380); });
        })();
      }
      function pause() {
        S.pid++; ttsStop(ctx); S.playing = false; radio.classList.remove('is-on');
        countEl.textContent = '⏸ 停在第 ' + (S.cur + 1) + ' / ' + sents.length + ' 句'; updateBtns();
      }

      function startQuestions() {
        if (S.playing) pause();
        S.phase = 'q'; goBtn.style.display = 'none';
        showQ(0);
      }
      function showQ(qi) {
        if (!ctx.alive()) return;
        if (qi >= total) return reveal();
        var q = qs[qi], sh = shuffleOpts(ctx, q.c, q.a);
        var fb = h('div', { 'aria-live': 'polite' });
        var card = h('div', { class: 'hw-card hw-stack' },
          h('div', { class: 'hw-row', style: 'align-items:center' }, h('span', { class: 'hw-tag' }, '第 ' + (qi + 1) + ' / ' + total + ' 题'),
            horn(ctx, function () { if (S.playing) pause(); return q.q; }, '读题目')),
          h('div', { class: 'hw-q' }, q.q),
          ctx.mcq({ options: sh.options, answer: sh.answer, onAnswer: function (ok, idx) {
            if (!ctx.alive()) return;
            results[qi] = ok;
            if (ok) { correct++; ctx.score.right(st); }
            else ctx.score.wrong(st, '《' + st.title + '》' + q.q + ' 正确答案：' + q.c[q.a] + '；你选了：' + sh.options[idx]);
            ctx.setProgress(qi + 1, total);
            var moved = false;
            fb.replaceChildren(fbBox(h, ok ? 'good' : 'bad', [
              h('div', {}, (ok ? praise(ctx) : '正确答案是“' + q.c[q.a] + '”。') + (q.e ? ' ' + q.e : '')),
              h('div', {}, btn(ctx, qi + 1 < total ? '下一题 ➜' : '揭晓故事原文 📜', 'primary', function () { if (moved) return; moved = true; showQ(qi + 1); }))]));
            scrollNear(fb);
          } }),
          fb);
        area.replaceChildren(card);
        if (!S.playing) { ttsStop(ctx); speak(ctx, q.q); }
      }
      function reveal() {
        if (S.playing) pause();
        ttsStop(ctx);
        var rel = relevantSentences(sents, qs), hasRel = rel.some(function (r) { return r.length; });
        var rp = 0;
        var sentEls = sents.map(function (s, k) {
          var nums = rel[k];
          return h('span', { class: 'g-story-s' + (nums.length ? ' g-story-hl' : ''), role: 'button', tabindex: '0', title: '点一下听这一句',
            on: { click: function () { playOne(k); }, keydown: function (e) { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); playOne(k); } } } },
            s, nums.map(function (n) { return h('span', { class: 'g-story-qno', 'aria-label': '第' + n + '题' }, String(n)); }));
        });
        function playOne(k) { if (S.playing) pause(); var my = ++rp; ttsStop(ctx); sentEls.forEach(function (e, j) { e.classList.toggle('is-on', j === k); }); speak(ctx, sents[k]).then(function () { if (my === rp && ctx.alive()) sentEls[k].classList.remove('is-on'); }); }
        var r = total ? correct / total : 0;
        var stars = r >= 0.999 ? 3 : r >= 0.6 ? 2 : r > 0 ? 1 : 0;
        var penalty = S.replays >= 2 && stars > 1 ? 1 : 0;
        stars -= penalty;
        radio.classList.remove('is-on');
        area.replaceChildren(h('div', { class: 'hw-card hw-stack' },
          h('div', { class: 'hw-row', style: 'align-items:center' }, h('span', { class: 'hw-tag' }, '故事原文'), h('span', { class: 'hw-muted' }, hasRel ? '黄色句子里藏着答案，小圆圈是题号；点句子可以再听' : '点句子可以再听')),
          h('div', { class: 'hw-passage hw-kai g-story-text' }, sentEls),
          fbBox(h, stars >= 2 ? 'good' : 'bad', [
            h('div', {}, '答对 ' + correct + ' / ' + total + ' 题 · 重听 ' + S.replays + ' 次' + (penalty ? '（重听超过 1 次，少 1 颗星）' : '')),
            h('div', { class: 'hw-big' }, starStr(stars))]),
          btn(ctx, '领取星星 ⭐', 'primary big', function () { ttsStop(ctx); ctx.finish({ stars: stars }); })));
        scrollNear(area);
      }

      updateInfo(); updateBtns();
      var children = [radio, info];
      if (!canTTS) {
        children.push(h('div', { class: 'hw-feedback bad' }, '这台设备没有中文朗读声音。请爸爸妈妈读给你听，或者自己读一读下面的故事。'),
          h('div', { class: 'hw-passage hw-kai g-story-text' }, st.text));
        S.heardAll = true; S.started = true; updateBtns(); playBtn.disabled = true; replayBtn.disabled = true;
      }
      children.push(goBtn, area);
      ctx.el.replaceChildren(h('div', { class: 'hw-stack g-story' }, children));
      if (canTTS) playFrom(0);
      return function () { S.pid++; ttsStop(ctx); };
    }
  });

  /* ================= 3. dictation 听写大挑战 ================= */
  function validWord(w) { return w && typeof w.w === 'string' && hanOnly(w.w).length >= 1 && typeof w.s === 'string'; }
  // 拼音去声调（ü 记作 v），用于找同音字
  function toneless(py) { return String(py || '').normalize('NFD').replace(/u\u0308/g, 'v').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim(); }
  // 字 → 该字在题库里出现过的无调音节（多音字可能有多个）；只信任“音节数 == 汉字数”的条目
  function buildSylMap(wordList, charList) {
    var map = {};
    function add(c, y) { if (!c || !y) return; var a = map[c] || (map[c] = []); if (a.indexOf(y) < 0) a.push(y); }
    (wordList || []).forEach(function (w) {
      if (!w || typeof w.w !== 'string' || typeof w.py !== 'string') return;
      var cs = hanOnly(w.w), ys = w.py.trim().split(/\s+/);
      if (cs.length !== ys.length) return;
      cs.forEach(function (c, k) { add(c, toneless(ys[k])); });
    });
    (charList || []).forEach(function (c) { if (c && typeof c.c === 'string' && typeof c.py === 'string' && c.py.trim().indexOf(' ') < 0) add(c.c, toneless(c.py)); });
    return map;
  }
  var BACKUP_CHARS = chars('的一是不了人我在有他这中大来上个到说们为子和你地出道也时年得就那要下以生会自着去之过家学对可里后小么心多天而能好都然没日于起还发成事只作当想看文无开手十用主行方又如前所本见经头面公同三已老从动两长');

  HW.register({
    // 不声明 'hanzi'：核心会因此把整张卡锁死；本游戏自带降级（没有 HanziWriter/笔顺数据 → 听音选字/选词）
    id: 'dictation', skill: 'listen', name: '听写大挑战', blurb: '听词语，一笔一笔写出来', icon: '✍️', needs: ['tts'],
    start: function (ctx) {
      injectCss();
      var h = ctx.h;
      var n = ctx.gradeNum <= 3 ? 5 : 6;
      var words = getItems(ctx, ctx.G.words, n, validWord);
      if (!words.length) { emptyState(ctx); return function () {}; }
      var total = words.length, wi = 0, correct = 0, pid = 0, writer = null;
      var hwLib = typeof window.HanziWriter !== 'undefined' && !!window.HanziWriter;
      var poolChars = uniq([].concat.apply([], (ctx.G.words || []).concat(words).map(function (w) { return w && w.w ? hanOnly(w.w) : []; })));
      var sylMap = buildSylMap([].concat(ctx.G.words || [], words), ctx.G.chars || []);

      function dropWriter() { if (writer) { try { if (writer.cancelQuiz) writer.cancelQuiz(); } catch (e) {} } writer = null; }
      function playBoth(w) {
        var my = ++pid; ttsStop(ctx);
        speak(ctx, w.w).then(function () {
          if (!ctx.alive() || my !== pid) return;
          ctx.next(function () { if (my === pid) speak(ctx, w.s).then(function () { if (!ctx.alive() || my !== pid) return; ctx.next(function () { if (my === pid) speak(ctx, w.w); }, 500); }); }, 500);
        });
      }
      function playOne(t) { pid++; ttsStop(ctx); speak(ctx, t); }
      function colorOpts() {
        var o = {}, ink = tok(ctx.el, '--ink'), acc = tok(ctx.el, '--accent'), good = tok(ctx.el, '--good'), line = tok(ctx.el, '--line');
        if (ink) { o.strokeColor = ink; o.drawingColor = ink; }
        if (good) o.highlightColor = good;
        if (acc) o.highlightCompleteColor = acc;
        if (line) o.outlineColor = line;
        return o;
      }
      function padSize() { var w = (ctx.el && ctx.el.clientWidth) || 320; return Math.max(180, Math.min(280, w - 48)); }
      function finishGame() { dropWriter(); ttsStop(ctx); ctx.finish({ correct: correct, total: total }); }

      function header(w, extra) {
        return h('div', { class: 'hw-card hw-stack hw-center' },
          h('div', { class: 'hw-row', style: 'justify-content:center;align-items:center' },
            h('span', { class: 'hw-tag' }, '第 ' + (wi + 1) + ' / ' + total + ' 个词'),
            h('span', { class: 'hw-muted' }, '共 ' + hanOnly(w.w).length + ' 个字')),
          h('div', { class: 'hw-row', style: 'justify-content:center' },
            btn(ctx, '🔊 听词语', 'big', function () { playOne(w.w); }),
            btn(ctx, '📖 听例句', 'ghost big', function () { playOne(w.s); })),
          extra || null);
      }

      /* ---- 正常版：田字格逐字书写 ---- */
      function showWord() {
        dropWriter(); ttsStop(ctx);
        if (!ctx.alive()) return;
        if (wi >= total) return finishGame();
        ctx.setProgress(wi, total);
        var w = words[wi], cs = hanOnly(w.w);
        var mistakes = 0, failed = 0, ci = 0;
        var slots = cs.map(function (_, k) { return h('div', { class: 'hw-tianzige g-dictation-slot', 'aria-label': '第' + (k + 1) + '个字' }, ''); });
        var stage = h('div', { class: 'hw-stack' });
        ctx.el.replaceChildren(h('div', { class: 'hw-stack g-dictation' }, header(w, h('div', { class: 'g-dictation-slots' }, slots)), stage));

        function nextChar() {
          if (!ctx.alive()) return;
          dropWriter();
          slots.forEach(function (s, k) { s.classList.toggle('is-cur', k === ci); });
          if (ci >= cs.length) return wordDone();
          var ch = cs[ci];
          if (hasStroke(ctx, ch)) writeChar(ch); else chooseChar(ch);
        }
        function charDone(ch, ok) {
          slots[ci].textContent = ch;
          slots[ci].classList.add(ok ? 'is-ok' : 'is-bad');
          ci++;
          ctx.next(nextChar, 700);
        }
        function writeChar(ch) {
          var size = padSize(), pad = h('div', { class: 'g-dictation-pad', style: 'width:' + size + 'px;height:' + size + 'px' });
          var done = false, curStroke = 0, charMiss = 0;
          var hintBtn = btn(ctx, '💡 提示一笔', 'ghost', function () {
            if (done || !writer) return;
            mistakes++; charMiss++;
            try {
              if (typeof writer.highlightStroke === 'function') writer.highlightStroke(curStroke);
              else if (typeof writer.showOutline === 'function') { writer.showOutline(); ctx.next(function () { try { if (writer) writer.hideOutline(); } catch (e) {} }, 1200); }
            } catch (e) {}
          });
          var skipBtn = btn(ctx, '😅 不会写', 'ghost', function () {
            if (done) return; done = true; failed++;
            var wr = writer; writer = null;
            try { if (wr && wr.cancelQuiz) wr.cancelQuiz(); } catch (e) {}
            var moved = false;
            function go() { if (moved) return; moved = true; charDone(ch, false); }
            try { if (wr && wr.animateCharacter) wr.animateCharacter({ onComplete: function () { ctx.next(go, 600); } }); else go(); } catch (e) { go(); }
            ctx.next(go, 6000);
          });
          stage.replaceChildren(
            h('div', { class: 'hw-muted hw-center' }, '在田字格里写第 ' + (ci + 1) + ' 个字（同一笔错 3 次会出现提示）'),
            pad,
            h('div', { class: 'hw-row', style: 'justify-content:center' }, hintBtn, skipBtn));
          var opts = { width: size, height: size, padding: Math.round(size * 0.06), showOutline: false, showCharacter: false, highlightOnComplete: true };
          var co = colorOpts(); Object.keys(co).forEach(function (k) { opts[k] = co[k]; });
          var wr = null;
          try { wr = ctx.hanzi.create(pad, ch, opts); } catch (e) { wr = null; }
          if (!wr || typeof wr.quiz !== 'function') { return chooseChar(ch); }
          writer = wr;
          wr.quiz({
            showHintAfterMisses: 3,
            onMistake: function () { if (done) return; mistakes++; charMiss++; },
            onCorrectStroke: function (d) { if (d && typeof d.strokeNum === 'number') curStroke = d.strokeNum + 1; },
            onComplete: function () {
              if (done || !ctx.alive()) return; done = true;
              ctx.sfx.flip();
              charDone(ch, charMiss <= 2);
            }
          });
        }
        function chooseChar(ch) {
          var inWord = cs;
          // 干扰字优先用同音字（不计声调），听写才有区分度；句子已读过，语境能定出唯一答案
          var mine = sylMap[ch] || [];
          var free = poolChars.filter(function (c) { return c !== ch && inWord.indexOf(c) < 0; });
          var homo = ctx.shuffle(free.filter(function (c) { return (sylMap[c] || []).some(function (y) { return mine.indexOf(y) >= 0; }); }));
          var cand = homo.slice(0, 2);
          cand = cand.concat(ctx.shuffle(free.filter(function (c) { return cand.indexOf(c) < 0; })).slice(0, 3 - cand.length));
          if (cand.length < 3) cand = cand.concat(ctx.shuffle(BACKUP_CHARS.filter(function (c) { return c !== ch && inWord.indexOf(c) < 0 && cand.indexOf(c) < 0; })).slice(0, 3 - cand.length));
          var opts = ctx.shuffle([ch].concat(cand));
          var masked = cs.map(function (c, k) { return k < ci ? c : (k === ci ? '（　）' : '□'); }).join('');
          stage.replaceChildren(h('div', { class: 'hw-card hw-stack hw-center' },
            h('div', { class: 'hw-muted' }, hwLib ? '这个字的笔顺还没收录，改成选一选：' : '写字板没加载出来，这次改成选一选：'),
            h('div', { class: 'g-dictation-q' }, masked),
            h('div', { class: 'g-dictation-opts' }, ctx.mcq({ options: opts, answer: opts.indexOf(ch), big: true, onAnswer: function (ok) {
              if (!ctx.alive()) return;
              if (ok) ctx.sfx.good(); else { ctx.sfx.bad(); failed++; }
              ctx.next(function () { charDone(ch, ok); }, ok ? 300 : 900);
            } }))));
        }
        function wordDone() {
          dropWriter();
          var ok = failed === 0 && mistakes <= Math.max(3, cs.length * 2);
          if (ok) { correct++; ctx.score.right(w); }
          else ctx.score.wrong(w, w.w + ' ' + (w.py || '') + '：' + (failed ? failed + ' 个字没写出来' : '写错 ' + mistakes + ' 笔'));
          ctx.setProgress(wi + 1, total);
          var msg = ok ? (mistakes ? '写对啦！错了 ' + mistakes + ' 笔，下次更稳。' : '🌟 全部写对，满分！') : (failed ? '💪 有 ' + failed + ' 个字还不会，看看正确写法，记进错题本啦。' : '💪 写出来了，但错了 ' + mistakes + ' 笔，再练练。');
          var moved = false;
          stage.replaceChildren(fbBox(h, ok ? 'good' : 'bad', [
            h('div', { class: 'hw-py g-dictation-py' }, w.py || ''),
            h('div', { class: 'g-dictation-word' }, w.w),
            h('div', {}, msg),
            h('div', { class: 'hw-kai g-dictation-s' }, markIn(h, w.s, w.w, 'g-dictation-mark')),
            w.m ? h('div', { class: 'hw-muted' }, '意思：' + w.m) : null,
            btn(ctx, wi + 1 < total ? '下一个词 ➜' : '看成绩 🎉', 'primary big', function () { if (moved) return; moved = true; wi++; showWord(); })], true));
          scrollNear(stage);
          playOne(w.w);
        }
        playBoth(w);
        nextChar();
      }

      showWord();   // 没有 HanziWriter 或缺笔顺数据的字，会在 nextChar 里自动改成“选一选”
      return function () { pid++; dropWriter(); ttsStop(ctx); };
    }
  });

  /* ================= 4. readaloud 朗读小明星 ================= */
  function validRA(it) { return it && typeof it.text === 'string' && hanOnly(it.text).length > 0; }

  HW.register({
    // 说话类游戏不声明 'tts'：没有中文语音也能玩（隐藏示范，改请家长示范），否则“今日四件事”的“说”永远完成不了
    id: 'readaloud', skill: 'speak', name: '朗读小明星', blurb: '听示范，大声读出来', icon: '🎙️', needs: [],
    start: function (ctx) {
      injectCss();
      var h = ctx.h;
      var items = getItems(ctx, ctx.G.readaloud, 3, validRA);
      if (!items.length) { emptyState(ctx); return function () {}; }
      var total = items.length, idx = 0, starsArr = [], pid = 0, listening = false, recId = 0;

      function show() {
        pid++; recId++; ttsStop(ctx); if (listening) { asrStop(ctx); listening = false; }
        if (!ctx.alive()) return;
        if (idx >= total) { ctx.finish({ stars: avgStars(starsArr) }); return; }
        ctx.setProgress(idx, total);
        var it = items[idx], sents = splitSentences(it.text), hard = Array.isArray(it.hard) ? it.hard.filter(function (x) { return x && x.w; }) : [];
        var best = -1, bestRes = null, rated = false;
        var sentEls = sents.map(function (s, k) {
          return h('span', { class: 'g-readaloud-s', role: 'button', tabindex: '0', title: '点一下听这一句',
            on: { click: function () { playSent(k); }, keydown: function (e) { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); playSent(k); } } } }, s);
        });
        function mark(k) { sentEls.forEach(function (e, j) { e.classList.toggle('is-on', j === k); }); }
        function playSent(k) {
          if (listening) return;
          var my = ++pid; ttsStop(ctx); mark(k);
          speak(ctx, sents[k]).then(function () { if (my === pid && ctx.alive()) mark(-1); });
        }
        function playAll() {
          if (listening) return;
          var my = ++pid, k = 0; ttsStop(ctx);
          (function step() {
            if (!ctx.alive() || my !== pid) return;
            if (k >= sents.length) { mark(-1); return; }
            mark(k);
            speak(ctx, sents[k]).then(function () { if (!ctx.alive() || my !== pid) return; k++; ctx.next(step, 250); });
          })();
        }
        var hardRow = hard.length ? h('div', { class: 'hw-stack' },
          h('div', { class: 'hw-muted hw-center' }, ttsOk(ctx) ? '难读词小卡（点一点听发音）' : '难读词小卡（看拼音读准）'),
          h('div', { class: 'g-readaloud-hard' }, hard.map(function (x) {
            return h('button', { class: 'g-readaloud-card', type: 'button', 'aria-label': x.w + ' ' + (x.py || ''), on: { click: function () { if (!ctx.alive() || listening) return; pid++; ttsStop(ctx); speak(ctx, x.w); } } },
              h('span', { class: 'hw-py' }, x.py || ''), h('b', {}, x.w));
          }))) : null;
        var live = h('div', { class: 'g-readaloud-live hw-center', 'aria-live': 'polite' });
        var result = h('div', { class: 'hw-stack' });
        var useAsr = asrOk(ctx);
        var recBtn = btn(ctx, '🎤 我来读', 'primary big', toggleRec);
        var canTTS = ttsOk(ctx);
        var demoBtn = canTTS ? btn(ctx, '🔊 听示范', 'big', playAll) : null;
        // 改自评时作废正在进行的录音，免得识别结果晚到把自评面板盖掉
        var selfBtn = btn(ctx, '不用麦克风，自己评', 'ghost', function () { recId++; if (listening) { listening = false; asrStop(ctx); recBtn.classList.remove('g-readaloud-rec'); recBtn.textContent = '🎤 我来读'; live.textContent = ''; } showSelf(); });

        function doneItem(st, note) {
          if (rated) return; rated = true;
          starsArr[idx] = st;
          if (st >= 2) ctx.score.right(it); else ctx.score.wrong(it, note);
          idx++; show();
        }
        function hardNote() { return hard.length ? '（难读词：' + hard.map(function (x) { return x.w + ' ' + (x.py || ''); }).join('、') + '）' : ''; }
        function showSelf() {
          ttsStop(ctx);
          result.replaceChildren(h('div', { class: 'hw-card' }, selfRate(ctx, [[3, '🌟', '很流利'], [2, '🙂', '有几处卡住'], [1, '💪', '还要多练']], function (st) {
            ctx.sfx.good();
            doneItem(st, '《' + (it.title || '朗读') + '》自评：' + (st >= 2 ? '有几处卡住' : '还要多练') + hardNote());
          })));
          scrollNear(result);
        }
        function toggleRec() {
          if (listening) { asrStop(ctx); return; }
          if (!asrOk(ctx)) { ctx.toast('麦克风用不了，自己评一评吧'); showSelf(); return; }
          pid++; ttsStop(ctx); mark(-1);
          listening = true; var my = ++recId;
          recBtn.textContent = '⏹ 读完了'; recBtn.classList.add('g-readaloud-rec');
          live.textContent = '我在听，请大声读，读完点“读完了”……';
          var p;
          try { p = ctx.asr.listen(asrOpts(hanOnly(it.text).length, function (t) { if (ctx.alive() && listening && my === recId) live.textContent = t; })); } catch (e) { p = Promise.reject(e); }
          Promise.resolve(p).then(function (text) {
            if (my !== recId) return;
            listening = false; if (!ctx.alive() || rated) return;
            recBtn.classList.remove('g-readaloud-rec'); recBtn.textContent = '🎤 再读一次';
            grade(text || '');
          }, function (e) {
            if (my !== recId) return;
            listening = false; if (!ctx.alive() || rated) return;
            recBtn.classList.remove('g-readaloud-rec'); recBtn.textContent = '🎤 我来读';
            live.textContent = '';
            ctx.toast((e && typeof e.message === 'string' && /[\u4e00-\u9fff]/.test(e.message)) ? e.message : '麦克风没听到，换成自己评一评吧');
            showSelf();
          });
        }
        function grade(text) {
          var r = compareRead(it.text, text);
          if (r.heard < 2) { live.textContent = '没听清楚，靠近一点再读一次吧～'; return; }
          live.textContent = '';
          var st = accStars(r.acc);
          if (st > best) { best = st; bestRes = r; }
          var pct = Math.round(r.acc * 100);
          ctx.sfx[st >= 2 ? 'good' : 'bad']();
          result.replaceChildren(h('div', { class: 'hw-card hw-stack hw-center' },
            h('div', { class: 'g-readaloud-acc' }, '准确率 ' + pct + '%'),
            h('div', { class: 'hw-big' }, starStr(st)),
            h('div', { class: 'hw-muted' }, '绿色 = 读对了，红色 = 漏读或读错（识别也可能听错，仅供参考）'),
            renderCompare(h, it.text, r.matched, 'g-readaloud-text'),
            r.miss.length ? h('div', {}, '要多练：' + r.miss.slice(0, 6).join('、')) : h('div', {}, '一个字都没漏，你是朗读小明星！🌟'),
            h('div', { class: 'hw-row', style: 'justify-content:center' },
              btn(ctx, '🎤 再读一次', 'ghost', toggleRec),
              btn(ctx, idx + 1 < total ? '下一段 ➜' : '看成绩 🎉', 'primary big', function () {
                if (listening) { recId++; listening = false; asrStop(ctx); }
                var b = bestRes || r;
                doneItem(best, '《' + (it.title || '朗读') + '》准确率 ' + Math.round(b.acc * 100) + '%' + (b.miss.length ? '，要多练：' + b.miss.slice(0, 4).join('、') : '') + hardNote());
              }))));
          scrollNear(result);
        }

        ctx.el.replaceChildren(h('div', { class: 'hw-stack g-readaloud' },
          h('div', { class: 'hw-card hw-stack' },
            h('div', { class: 'hw-row', style: 'align-items:center' }, h('span', { class: 'hw-tag' }, '第 ' + (idx + 1) + ' / ' + total + ' 段'), h('b', { class: 'hw-kai', style: 'font-size:22px' }, it.title || '')),
            hardRow,
            h('div', { class: 'hw-passage g-readaloud-text' }, sentEls),
            h('div', { class: 'hw-muted hw-center' }, canTTS ? '点任意一句，听这一句的示范' : '这台设备没有中文朗读声音，可以请爸爸妈妈先读一遍给你听。'),
            it.tip ? h('div', { class: 'hw-feedback' }, '💡 ' + it.tip) : null),
          h('div', { class: 'hw-row', style: 'justify-content:center' }, demoBtn, useAsr ? recBtn : null),
          useAsr ? live : null,
          useAsr ? h('div', { class: 'hw-center' }, selfBtn) : null,
          result));
        if (!useAsr) {
          result.appendChild(h('div', { class: 'hw-muted hw-center' }, (canTTS ? '先听示范，' : '') + '大声读给爸爸妈妈听，然后评一评 👇'));
          showSelfInline();
        }
        function showSelfInline() {
          result.appendChild(h('div', { class: 'hw-card' }, selfRate(ctx, [[3, '🌟', '很流利'], [2, '🙂', '有几处卡住'], [1, '💪', '还要多练']], function (st) {
            ctx.sfx.good();
            doneItem(st, '《' + (it.title || '朗读') + '》自评：' + (st >= 2 ? '有几处卡住' : '还要多练') + hardNote());
          })));
        }
      }
      show();
      return function () { pid++; ttsStop(ctx); asrStop(ctx); };
    }
  });

  /* ================= 5. twister 绕口令擂台 ================= */
  function validTw(it) { return it && typeof it.text === 'string' && hanOnly(it.text).length > 0; }

  HW.register({
    id: 'twister', skill: 'speak', name: '绕口令擂台', blurb: '越说越快，挑战最快纪录', icon: '👅', needs: [],
    start: function (ctx) {
      injectCss();
      var h = ctx.h;
      var items = getItems(ctx, ctx.G.twisters, 2, validTw);
      if (!items.length) { emptyState(ctx); return function () {}; }
      var total = items.length, idx = 0, starsArr = [], pid = 0, running = false, listening = false, runId = 0;
      var pyPref = ctx.mem.get('showPy');
      var showPy = (pyPref === true || pyPref === false) ? pyPref : ctx.gradeNum <= 3;

      function show() {
        pid++; runId++; running = false; ttsStop(ctx); if (listening) { asrStop(ctx); listening = false; }
        if (!ctx.alive()) return;
        if (idx >= total) { ctx.finish({ stars: avgStars(starsArr) }); return; }
        ctx.setProgress(idx, total);
        var it = items[idx], hanCount = hanOnly(it.text).length;
        var key = 'best_' + hashStr(it.text);
        var best = +ctx.mem.get(key) || 0;
        var itemBest = -1, attempts = 0, done = false;

        // 逐字注音：音节数 == 汉字数才用 ruby，否则整行拼音放上面
        var syl = String(it.py || '').trim().split(/\s+/).filter(Boolean);
        var textEl;
        if (syl.length === hanCount) {
          var k = 0;
          textEl = h('div', { class: 'g-twister-text' }, chars(it.text).map(function (c) {
            return isHan(c) ? h('ruby', {}, c, h('rt', {}, syl[k++])) : c;
          }));
        } else {
          textEl = h('div', { class: 'hw-stack' }, h('div', { class: 'g-twister-pyline' }, it.py || ''), h('div', { class: 'g-twister-text' }, it.text));
        }
        function applyPy() { textEl.classList.toggle('is-nopy', !showPy); pyBtn.textContent = showPy ? '拼音：开' : '拼音：关'; pyBtn.setAttribute('aria-pressed', showPy ? 'true' : 'false'); }
        var pyBtn = btn(ctx, '拼音', 'ghost', function () { showPy = !showPy; ctx.mem.set('showPy', showPy); applyPy(); });
        function demo(rate, b) {
          if (running) return;
          var my = ++pid; ttsStop(ctx); speakers.forEach(function (x) { x.classList.remove('primary'); }); b.classList.add('primary');
          speak(ctx, it.text, { rate: rate }).then(function () { if (my === pid && ctx.alive()) b.classList.remove('primary'); });
        }
        var speakers = [];
        [['🐢 慢', 0.6], ['🚶 中', 0.9], ['🐇 快', 1.2]].forEach(function (d) {
          var b = btn(ctx, d[0], '', function () { demo(d[1], b); }, { 'aria-label': '示范：' + d[0].slice(2) });
          speakers.push(b);
        });

        var timerEl = h('div', { class: 'g-twister-timer', role: 'timer' }, '0.0');
        var bestEl = h('div', { class: 'g-twister-best' });
        function updBest() { bestEl.textContent = best ? '🏆 最佳纪录：' + best.toFixed(1) + ' 秒' : '还没有纪录，来创造第一个吧！'; }
        var live = h('div', { class: 'g-readaloud-live hw-center', 'aria-live': 'polite' });
        var goBtn = btn(ctx, '▶ 开始闯关', 'primary big', function () { if (running) stopRun(); else startRun(); });
        var result = h('div', { class: 'hw-stack' });
        var card = h('div', { class: 'hw-card hw-stack g-twister-card' },
          h('div', { class: 'hw-center hw-muted' }, '点“开始”后马上说，说完立刻点“停止”'),
          timerEl, bestEl, h('div', { class: 'hw-center' }, goBtn), live);
        var t0 = 0, spoken = '', asrP = null;

        function tick(my) {
          if (!ctx.alive() || !running || my !== runId) return;
          timerEl.textContent = ((now() - t0) / 1000).toFixed(1);
          ctx.next(function () { tick(my); }, 100);
        }
        function startRun() {
          pid++; ttsStop(ctx);
          running = true; spoken = ''; t0 = now(); var my = ++runId;
          goBtn.textContent = '⏹ 说完了，停止'; goBtn.classList.add('g-readaloud-rec');
          result.replaceChildren(); live.textContent = '';
          asrP = null;
          if (asrOk(ctx)) {
            listening = true;
            try { asrP = Promise.resolve(ctx.asr.listen(asrOpts(hanCount, function (t) { if (ctx.alive() && my === runId) live.textContent = t; }, 60000))); }
            catch (e) { asrP = Promise.reject(e); }
            asrP.then(function (t) { if (my === runId) { spoken = t || ''; listening = false; } }, function () { if (my === runId) listening = false; });
          }
          tick(my);
        }
        function stopRun() {
          if (!running) return;
          running = false; var my = runId;
          var sec = Math.round((now() - t0) / 100) / 10;
          timerEl.textContent = sec.toFixed(1);
          goBtn.textContent = '▶ 再来一遍'; goBtn.classList.remove('g-readaloud-rec');
          attempts++;
          var p = asrP;
          var judged = false;
          function j(t) { if (judged || !ctx.alive() || my !== runId || done) return; judged = true; judge(sec, t); }
          if (p) {
            asrStop(ctx);
            p.then(function (t) { return t; }, function () { return null; }).then(function (t) { j(typeof t === 'string' ? t : ''); });
            ctx.next(function () { j(''); }, 4000);   // 识别迟迟不返回 → 改自评
          } else j(null);
        }
        function judge(sec, text) {
          var r = text != null ? compareRead(it.text, text) : null;
          var useR = r && r.heard >= 2;
          var tooFast = sec < Math.max(1.5, hanCount * 0.1);
          var recordOk = !tooFast && (!useR || r.acc >= 0.6);
          var newRec = recordOk && (!best || sec < best);
          if (newRec) {
            best = sec; ctx.mem.set(key, sec); updBest();
            ctx.sfx.win(); ctx.toast('🏆 新纪录！' + sec.toFixed(1) + ' 秒'); burst(ctx, card);
          }
          var parts = [];
          parts.push(h('div', { class: 'hw-center' }, tooFast ? '⚡ 太快啦，是不是还没说完就停了？这次不算纪录。' :
            (newRec ? '🎉 打破纪录！用时 ' + sec.toFixed(1) + ' 秒' : '用时 ' + sec.toFixed(1) + ' 秒' + (best ? '，纪录是 ' + best.toFixed(1) + ' 秒，加油！' : ''))));
          if (useR) {
            var st = accStars(r.acc);
            if (st > itemBest) itemBest = st;
            if (!tooFast && r.acc < 0.6) parts.push(h('div', { class: 'hw-muted hw-center' }, '说得不够清楚，这次不算纪录哦。慢一点、字字清楚更重要！'));
            parts.push(h('div', { class: 'g-readaloud-acc hw-center' }, '准确率 ' + Math.round(r.acc * 100) + '% ' + starStr(st)));
            parts.push(renderCompare(h, it.text, r.matched, 'g-twister-text'));
            parts.push(nextRow());
            result.replaceChildren(h('div', { class: 'hw-card hw-stack' }, parts));
          } else {
            if (text != null) parts.push(h('div', { class: 'hw-muted hw-center' }, '麦克风没听清，自己评一评吧'));
            parts.push(selfRate(ctx, [[3, '😎', '字字清楚'], [2, '🙂', '有点打结'], [1, '😵', '舌头打架了']], function (st) {
              if (st > itemBest) itemBest = st;
              result.replaceChildren(h('div', { class: 'hw-card hw-stack' }, h('div', { class: 'hw-center hw-big' }, starStr(st)), nextRow()));
            }));
            result.replaceChildren(h('div', { class: 'hw-card hw-stack' }, parts));
          }
          scrollNear(result);
        }
        function nextRow() {
          return h('div', { class: 'hw-row', style: 'justify-content:center' },
            btn(ctx, '▶ 再来一遍', 'ghost', function () { startRun(); }),
            btn(ctx, idx + 1 < total ? '下一条 ➜' : '看成绩 🎉', 'primary big', function () {
              if (done) return; done = true;
              if (running) { running = false; } asrStop(ctx);
              var st = Math.max(0, itemBest);
              starsArr[idx] = st;
              if (st >= 2) ctx.score.right(it); else ctx.score.wrong(it, '绕口令“' + chars(it.text).slice(0, 12).join('') + '……”还要多练' + (it.tip ? '：' + it.tip : ''));
              idx++; show();
            }));
        }

        ctx.el.replaceChildren(h('div', { class: 'hw-stack g-twister' },
          h('div', { class: 'hw-card hw-stack' },
            h('div', { class: 'hw-row', style: 'align-items:center;justify-content:space-between' }, h('span', { class: 'hw-tag' }, '第 ' + (idx + 1) + ' / ' + total + ' 条'), pyBtn),
            textEl,
            it.tip ? h('div', { class: 'hw-feedback' }, '💡 ' + it.tip) : null,
            ttsOk(ctx) ? h('div', { class: 'hw-muted hw-center' }, '先听示范：') : h('div', { class: 'hw-muted hw-center' }, '先照着拼音慢慢读几遍，再挑战速度。'),
            ttsOk(ctx) ? h('div', { class: 'hw-row', style: 'justify-content:center' }, speakers) : null),
          card, result));
        applyPy(); updBest();
      }
      show();
      return function () { pid++; runId++; running = false; ttsStop(ctx); asrStop(ctx); };
    }
  });

  /* ================= 6. talk 小小主持人 ================= */
  function validTalk(it) { return it && typeof it.q === 'string' && it.q.length > 0; }
  var TALK_SECS = { 2: 30, 3: 45, 4: 60, 5: 75, 6: 90 };

  HW.register({
    id: 'talk', skill: 'speak', name: '小小主持人', blurb: '看图说一说，像口试一样练会话', icon: '🎤', needs: [],
    start: function (ctx) {
      injectCss();
      var h = ctx.h;
      var it = getItems(ctx, ctx.G.talk, 1, validTalk)[0];
      if (!it) { emptyState(ctx); return function () {}; }
      var secs = TALK_SECS[ctx.gradeNum] || 60;
      var follow = Array.isArray(it.follow) ? it.follow.filter(Boolean) : [];
      var starters = Array.isArray(it.starters) ? it.starters.filter(Boolean) : [];
      var goodWords = Array.isArray(it.words) ? it.words.filter(Boolean) : [];
      var pid = 0, talking = false, runId = 0, finalText = '', userTyped = false, aiOK = false, aiBusy = false, finished = false;
      var STEPS = 4;
      ctx.setProgress(0, STEPS);
      function say(t) { var my = ++pid; ttsStop(ctx); return speak(ctx, t).then(function () { return my === pid; }); }

      /* 第 1 步：看图听问题 */
      var sceneCard = h('div', { class: 'hw-card hw-stack hw-center' },
        h('div', { class: 'hw-row', style: 'justify-content:center' }, h('span', { class: 'hw-tag' }, '话题：' + (it.topic || '会话')), h('span', { class: 'hw-tag' }, '说 ' + secs + ' 秒')),
        it.scene ? h('div', { class: 'hw-scene', role: 'img', 'aria-label': it.desc || '场景图' }, it.scene) : null,
        it.desc ? h('div', { class: 'hw-row', style: 'align-items:center;justify-content:center;flex-wrap:nowrap' }, horn(ctx, it.desc, '读画面描述'), h('div', { class: 'g-talk-desc hw-kai' }, it.desc)) : null,
        h('div', { class: 'hw-row', style: 'align-items:center;justify-content:center;flex-wrap:nowrap' }, horn(ctx, it.q, '读问题'), h('div', { class: 'hw-q' }, '❓ ' + it.q)));

      /* 第 2 步：说话小帮手 */
      var helpCard = (starters.length || goodWords.length) ? h('div', { class: 'hw-card hw-stack' },
        h('b', {}, '🧰 说话小帮手'),
        starters.length ? h('div', { class: 'g-talk-starters' }, starters.map(function (s) {
          return h('button', { class: 'g-talk-starter', type: 'button', on: { click: function () { if (ctx.alive() && !talking) say(s.replace(/…+/g, '')); } } }, '🗨️ ' + s);
        })) : null,
        goodWords.length ? h('div', { class: 'hw-muted' }, ttsOk(ctx) ? '试着用上这些好词（点一点听读音）：' : '试着用上这些好词：') : null,
        goodWords.length ? h('div', { class: 'g-talk-words' }, goodWords.map(function (w) {
          return h('button', { class: 'g-talk-word', type: 'button', on: { click: function () { if (ctx.alive() && !talking) say(w); } } }, w);
        })) : null) : null;

      /* 第 3 步：倒计时说话 */
      var cdEl = h('div', { class: 'g-talk-cd', role: 'timer' }, String(secs));
      var meterFill = h('span', { style: 'width:100%' });
      var meter = h('div', { class: 'hw-meter', 'aria-hidden': 'true' }, meterFill);
      var live = h('div', { class: 'g-talk-live', 'aria-live': 'polite' });
      var ta = h('textarea', { class: 'hw-textarea', rows: '4', placeholder: '（可选）把你说的话打出来，AI 老师可以帮你点评', 'aria-label': '我的回答',
        on: { input: function () { userTyped = true; refreshAI(); } } });
      var talkBtn = btn(ctx, '🎤 开始说（' + secs + ' 秒）', 'primary big', function () { if (talking) stopTalk(); else startTalk(); });
      var talkCard = h('div', { class: 'hw-card hw-stack' },
        h('b', {}, '🎙️ 轮到你当主持人'),
        h('div', { class: 'hw-muted' }, asrOk(ctx) ? '点开始，对着麦克风大声说。说完可以提前结束。' : '点开始，对着爸爸妈妈大声说出你的回答。说完可以提前结束。'),
        cdEl, meter, h('div', { class: 'hw-center' }, talkBtn), live, ta);

      var followCard = h('div', { class: 'hw-card hw-stack', style: 'display:none' });
      var sampleCard = h('div', { class: 'hw-card hw-stack', style: 'display:none' });
      var aiCard = h('div', { class: 'hw-card hw-stack g-talk-ai', style: 'display:none' });
      var rateCard = h('div', { class: 'hw-card hw-stack', style: 'display:none' });

      function startTalk() {
        pid++; ttsStop(ctx);
        talking = true; var my = ++runId; var t0 = now();
        talkBtn.textContent = '⏹ 我说完了'; talkBtn.classList.add('g-readaloud-rec');
        cdEl.classList.remove('is-low');
        var restarts = 0;
        function listenOnce() {
          if (!asrOk(ctx) || !talking || my !== runId) return;
          var started = now(), p;
          var o = asrOpts(0, function (t) { if (ctx.alive() && my === runId) live.textContent = finalText + t; });
          o.maxMs = Math.max(5000, secs * 1000 - (now() - t0) + 1500);
          try { p = Promise.resolve(ctx.asr.listen(o)); }
          catch (e) { p = Promise.reject(e); }
          p.then(function (t) {
            if (!ctx.alive() || my !== runId) return;
            if (t) finalText += (finalText && !/[。！？，]$/.test(finalText) ? '，' : '') + t;
            live.textContent = finalText;
            if (!userTyped) { ta.value = finalText; refreshAI(); }
            // 静音自动断了但时间没到 → 接着听（最多 6 次）
            if (talking && restarts < 6 && now() - started > 1500) { restarts++; listenOnce(); }
          }, function () {
            if (!ctx.alive() || my !== runId) return;
            if (talking && !finalText) live.textContent = '（麦克风没打开也没关系，大声说出来就好）';
          });
        }
        listenOnce();
        (function tick() {
          if (!ctx.alive() || !talking || my !== runId) return;
          var left = Math.max(0, secs - (now() - t0) / 1000);
          cdEl.textContent = String(Math.ceil(left));
          cdEl.classList.toggle('is-low', left <= 10);
          meterFill.style.width = (left / secs * 100).toFixed(1) + '%';
          if (left <= 0) { ctx.sfx.flip(); stopTalk(); return; }
          ctx.next(tick, 200);
        })();
      }
      function stopTalk() {
        if (!talking) return;
        talking = false;
        asrStop(ctx);
        talkBtn.textContent = '🎤 再说一次'; talkBtn.classList.remove('g-readaloud-rec');
        cdEl.textContent = '👏'; meterFill.style.width = '0%';
        ctx.toast(randOf(['说得好！', '很勇敢！', '主持人就是你！']));
        if (followCard.style.display === 'none') showFollow();
      }

      /* 第 4 步：老师追问 */
      function showFollow() {
        ctx.setProgress(2, STEPS);
        if (!follow.length) { showSample(); return; }
        var fi = 0;
        var qEl = h('div', { class: 'hw-q g-talk-follow' });
        var nextF = btn(ctx, '下一个追问 ➜', 'ghost', function () { fi++; renderF(); });
        function renderF() {
          if (fi >= follow.length) { nextF.style.display = 'none'; showSample(); return; }
          qEl.textContent = '❓ ' + follow[fi];
          nextF.textContent = fi + 1 < follow.length ? '下一个追问 ➜' : '回答完了 ➜';
          if (!talking) say(follow[fi]);
        }
        followCard.replaceChildren(
          h('b', {}, '👩‍🏫 老师追问（想一想，大声回答）'),
          h('div', { class: 'hw-row', style: 'align-items:center;flex-wrap:nowrap' }, horn(ctx, function () { return follow[Math.min(fi, follow.length - 1)]; }, '再读一遍追问'), qEl),
          h('div', { class: 'hw-row' }, nextF));
        followCard.style.display = '';
        renderF();
        scrollNear(followCard);
      }

      /* 第 5 步：示范 + AI 点评 + 自评 */
      function showSample() {
        if (sampleCard.style.display !== 'none') return;
        ctx.setProgress(3, STEPS);
        var textBox = h('div', { class: 'hw-passage hw-kai', style: ttsOk(ctx) ? 'display:none' : '' }, markWords(it.sample || ''));
        var toggle = btn(ctx, '👀 看示范文字', 'ghost', function () { var hid = textBox.style.display === 'none'; textBox.style.display = hid ? '' : 'none'; toggle.textContent = hid ? '🙈 收起文字' : '👀 看示范文字'; });
        sampleCard.replaceChildren(
          h('b', {}, ttsOk(ctx) ? '⭐ 听听示范回答' : '⭐ 看看示范回答'),
          h('div', { class: 'hw-muted' }, '听听别人怎么说：先说观点，再说理由，最后举个例子。'),
          ttsOk(ctx) ? h('div', { class: 'hw-row', style: 'justify-content:center' }, btn(ctx, '🔊 听示范回答', 'big', function () { say(it.sample); }), toggle) : null,
          textBox);
        sampleCard.style.display = '';
        refreshAI();
        showRate();
        scrollNear(sampleCard);
      }
      function markWords(text) {
        var nodes = [String(text)];
        goodWords.forEach(function (w) {
          var out = [];
          nodes.forEach(function (n) { if (typeof n !== 'string') out.push(n); else markIn(h, n, w, 'g-talk-mark').forEach(function (x) { out.push(x); }); });
          nodes = out;
        });
        return nodes;
      }
      function curText() { return String(ta.value || '').trim(); }
      function refreshAI() {
        if (!ctx.alive()) return;
        var show = aiOK && curText().length >= 4 && sampleCard.style.display !== 'none';
        if (!show) { if (!aiBusy && !aiCard.firstChild) aiCard.style.display = 'none'; return; }
        if (aiCard.style.display === 'none') {
          aiCard.replaceChildren(btn(ctx, '🤖 请 AI 老师点评', 'primary', askAI));
          aiCard.style.display = '';
        }
      }
      function askAI() {
        if (aiBusy) return;
        var text = curText(); if (!text) { ctx.toast('先把你的回答打出来或说出来哦'); return; }
        aiBusy = true;
        var n = ctx.gradeNum;
        var task = '新加坡小学' + n + '年级（P' + n + '）华文口试“看录像会话”练习。话题：' + (it.topic || '') + '。画面：' + (it.desc || '') + '。问题：' + it.q +
          '。下面是孩子的回答（语音识别转写或孩子自己打字，可能有同音错字，请不要因此扣分）。请用' + n + '年级孩子能懂的简单中文点评：是否回答了问题、有没有理由和例子、用词和句子是否通顺，并给出一段更好的说法。';
        aiCard.replaceChildren(h('div', { class: 'hw-muted' }, '🤖 AI 老师正在认真听……'));
        var p;
        try { p = Promise.resolve(ctx.ai.review({ task: task, text: text })); } catch (e) { p = Promise.reject(e); }
        p.then(function (r) {
          aiBusy = false; if (!ctx.alive()) return;
          r = r || {};
          var st = Math.max(1, Math.min(3, (r.stars | 0) || 1));
          var tips = Array.isArray(r.tips) ? r.tips.filter(Boolean) : [];
          aiCard.replaceChildren(
            h('b', {}, '🤖 AI 老师点评 ' + starStr(st)),
            r.praise ? h('div', {}, '👍 ' + r.praise) : null,
            tips.length ? h('ul', {}, tips.map(function (t) { return h('li', {}, t); })) : null,
            r.better ? h('div', { class: 'hw-stack' }, h('div', { class: 'hw-row', style: 'align-items:center' }, h('span', { class: 'hw-muted' }, '可以这样说：'), horn(ctx, r.better, '读一读更好的说法')), h('div', { class: 'g-talk-better' }, r.better)) : null,
            btn(ctx, '🔄 改好了，再请老师看看', 'ghost', askAI));
          scrollNear(aiCard);
        }, function (e) {
          aiBusy = false; if (!ctx.alive()) return;
          // 核心给的 e.message 已是孩子能看懂的原因（没开启/太忙/需要登录……），直接显示
          var why = (e && typeof e.message === 'string' && /[\u4e00-\u9fff]/.test(e.message)) ? e.message : 'AI 老师暂时没空，等一会儿再试试。';
          aiCard.replaceChildren(h('div', { class: 'hw-muted' }, why), btn(ctx, '🤖 再请 AI 老师点评', 'primary', askAI));
          ctx.toast(why);
        });
      }
      function showRate() {
        rateCard.replaceChildren(
          h('b', {}, '🏅 最后，给今天的自己打星'),
          selfRate(ctx, [[3, '🌟', '说得又多又清楚'], [2, '🙂', '说了一些'], [1, '💪', '还不太会说']], function (st) {
            if (finished) return; finished = true;
            talking = false; runId++; asrStop(ctx); ttsStop(ctx);
            ctx.setProgress(STEPS, STEPS);
            if (st >= 2) ctx.score.right(it);
            else ctx.score.wrong(it, '话题“' + (it.topic || '') + '”还要多练' + (goodWords.length ? '，试着用上：' + goodWords.join('、') : ''));
            ctx.finish({ stars: st });
          }));
        rateCard.style.display = '';
      }

      ctx.el.replaceChildren(h('div', { class: 'hw-stack g-talk' }, sceneCard, helpCard, talkCard, followCard, sampleCard, aiCard, rateCard));
      try {
        Promise.resolve(ctx.ai && ctx.ai.ok ? ctx.ai.ok() : false).then(function (v) { aiOK = !!v; refreshAI(); }, function () { aiOK = false; });
      } catch (e) { aiOK = false; }
      // 进场先读画面再读问题（在点击调用栈里发第一声，iOS 才会出声）
      var my0 = ++pid;
      speak(ctx, it.desc ? it.desc : it.q).then(function () {
        if (!ctx.alive() || my0 !== pid || !it.desc) return;
        ctx.next(function () { if (my0 === pid && !talking) speak(ctx, it.q); }, 400);
      });
      ctx.setProgress(1, STEPS);
      return function () { pid++; runId++; talking = false; ttsStop(ctx); asrStop(ctx); };
    }
  });
})();
