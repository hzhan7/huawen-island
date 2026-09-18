/* 华文小岛 · 核心引擎 HW（E1）
 * 契约见 SPEC §3/§4。纯原生 JS（ES2020），无 import。
 * 暴露 window.HW = { register, css, boot, h, shuffle, toast, tts, sfx, asr, ai, hanzi, ... }
 */
(function () {
  'use strict';
  var W = window, D = document;
  if (W.HW && W.HW.__core) return;

  /* ================= 小工具 ================= */
  var now = function () { return Date.now(); };
  function uid() { return 'k' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7); }
  function clamp(n, a, b) { return Math.max(a, Math.min(b, n)); }
  function num(v, d) { v = Number(v); return Number.isFinite(v) ? v : (d == null ? 0 : d); }
  function isObj(v) { return !!v && typeof v === 'object' && !Array.isArray(v); }
  function has(o, k) { return Object.prototype.hasOwnProperty.call(o, k); }
  function clone(v) { try { return v === undefined ? undefined : JSON.parse(JSON.stringify(v)); } catch (e) { return null; } }
  function sleep(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }
  function mkErr(code, msg) { var e = new Error(msg); e.code = code; return e; }
  function pad2(n) { return String(n).padStart(2, '0'); }
  function todayStr(d) { d = d || new Date(); return d.getFullYear() + '-' + pad2(d.getMonth() + 1) + '-' + pad2(d.getDate()); }
  function hash(str) {
    var x = 0x811c9dc5;
    for (var i = 0; i < str.length; i++) { x ^= str.charCodeAt(i); x = Math.imul(x, 0x01000193); }
    return (x >>> 0).toString(36) + str.length.toString(36);
  }
  function keyOf(item) {
    if (item == null) return '';
    if (typeof item !== 'object') return hash(String(item));
    var s; try { s = JSON.stringify(item); } catch (e) { s = String(item); }
    return hash(s || '');
  }
  function shuffle(arr) {
    var a = Array.from(arr || []);
    for (var i = a.length - 1; i > 0; i--) { var j = Math.floor(Math.random() * (i + 1)); var t = a[i]; a[i] = a[j]; a[j] = t; }
    return a;
  }
  function byteLen(s) {
    try { return new TextEncoder().encode(s).length; } catch (e) { return s.length * 3; }
  }
  function reduceMotion() {
    try { return W.matchMedia && W.matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (e) { return false; }
  }
  function tokens() {
    var cs = getComputedStyle(D.documentElement);
    var g = function (n, d) { var v = cs.getPropertyValue(n); return (v && v.trim()) || d; };
    return {
      ink: g('--ink', '#1E2B22'), paper: g('--paper', '#F7FAF1'), accent: g('--accent', '#D23B24'),
      gold: g('--gold', '#E2A00C'), listen: g('--listen', '#2A62AA'), speak: g('--speak', '#BF5A10'),
      read: g('--read', '#0E7766'), write: g('--write', '#8A3A9E'), flower: g('--flower', '#E3402B'),
      hzOutline: g('--hz-outline', '#D2DCCB'), good: g('--good', '#1F7A38')
    };
  }

  /* ctx.h：建元素 */
  function append(el, c) {
    if (c == null || c === false || c === true) return;
    if (Array.isArray(c)) { for (var i = 0; i < c.length; i++) append(el, c[i]); return; }
    if (typeof Node !== 'undefined' && c instanceof Node) el.appendChild(c);
    else el.appendChild(D.createTextNode(String(c)));
  }
  function h(tag, props) {
    var el = D.createElement(tag);
    var kids = Array.prototype.slice.call(arguments, 2);
    var pendingValue;
    if (props != null && (typeof props !== 'object' || Array.isArray(props) || (typeof Node !== 'undefined' && props instanceof Node))) {
      kids.unshift(props); props = null;
    }
    if (props) {
      for (var k in props) {
        if (!has(props, k)) continue;
        var v = props[k];
        if (v == null || v === false) continue;
        if (k === 'class' || k === 'className') el.className = Array.isArray(v) ? v.filter(Boolean).join(' ') : String(v);
        else if (k === 'style') {
          if (typeof v === 'string') el.style.cssText = v;
          else if (isObj(v)) for (var s in v) { if (s.indexOf('--') === 0) el.style.setProperty(s, v[s]); else el.style[s] = v[s]; }
        } else if (k === 'on') {
          if (isObj(v)) for (var ev in v) if (typeof v[ev] === 'function') el.addEventListener(ev, v[ev]);
        } else if (k === 'value') {
          pendingValue = v;
          if (tag !== 'textarea' && tag !== 'select' && typeof v !== 'object') el.setAttribute('value', String(v));
        } else el.setAttribute(k, v === true ? '' : String(v));
      }
    }
    append(el, kids);
    if (pendingValue !== undefined) { try { el.value = pendingValue; } catch (e) { /* ignore */ } }
    return el;
  }
  var SVGNS = 'http://www.w3.org/2000/svg';
  function svgEl(tag, attrs) {
    var el = D.createElementNS(SVGNS, tag);
    for (var k in attrs) el.setAttribute(k, attrs[k]);
    return el;
  }
  function flowerSvg(size) {
    size = size || 22;
    var svg = svgEl('svg', { viewBox: '0 0 40 40', width: size, height: size, class: 'hw-flower', 'aria-hidden': 'true', focusable: 'false' });
    for (var i = 0; i < 5; i++) {
      var a = (i * 72 - 90) * Math.PI / 180;
      svg.appendChild(svgEl('circle', { cx: (20 + Math.cos(a) * 10).toFixed(2), cy: (20 + Math.sin(a) * 10).toFixed(2), r: '8.6', class: 'p' }));
    }
    svg.appendChild(svgEl('circle', { cx: '20', cy: '20', r: '6.4', class: 'c' }));
    return svg;
  }
  function starSvg(on) {
    var svg = svgEl('svg', { viewBox: '0 0 24 24', class: 'hw-star' + (on ? ' on' : ''), 'aria-hidden': 'true', focusable: 'false' });
    svg.appendChild(svgEl('path', { d: 'M12 2.6l2.9 5.9 6.5.9-4.7 4.6 1.1 6.5L12 17.4l-5.8 3.1 1.1-6.5L2.6 9.4l6.5-.9z', 'stroke-linejoin': 'round' }));
    return svg;
  }

  /* ================= localStorage（全部 try/catch） ================= */
  var LS = {
    get: function (k, d) {
      try { var v = W.localStorage.getItem('hw.v1.' + k); return v == null ? d : JSON.parse(v); } catch (e) { return d; }
    },
    set: function (k, v) {
      try { W.localStorage.setItem('hw.v1.' + k, JSON.stringify(v)); return true; } catch (e) { return false; }
    }
  };

  /* ================= 常量 ================= */
  var SKILLS = [
    { id: 'listen', ch: '听', name: '听力', desc: '听清楚，听明白' },
    { id: 'speak', ch: '说', name: '说话', desc: '大声说，说完整' },
    { id: 'read', ch: '读', name: '阅读', desc: '读得懂，想得到' },
    { id: 'write', ch: '写', name: '书写', desc: '写对字，写好话' }
  ];
  var SKILL_IDS = SKILLS.map(function (s) { return s.id; });
  var SKILL_NAME = { listen: '听力', speak: '说话', read: '阅读', write: '书写' };
  var GRADES = ['p2', 'p3', 'p4', 'p5', 'p6'];
  var CN_NUM = { 2: '二', 3: '三', 4: '四', 5: '五', 6: '六' };
  var GRADE_NOTE = {
    p2: 'P2 重点：叠词 · 量词 · 反义词 · 标点',
    p3: 'P3 重点：四字词语 · 关联词 · 形近字 · 同音字',
    p4: 'P4 重点：成语 · 多音字 · 比喻拟人 · 词语搭配',
    p5: 'P5 重点：成语惯用语 · 病句 · 排比夸张 · 设问反问',
    p6: 'P6 重点：成语典故 · 歇后语 · 古诗名句 · 概括主旨'
  };
  var COLS = ['words', 'chars', 'quiz', 'pick', 'stories', 'readaloud', 'twisters', 'talk', 'order', 'passages', 'build', 'typo', 'compose'];
  var GAME_DATA = {
    pick: ['pick'], story: ['stories'], dictation: ['words'], readaloud: ['readaloud'], twister: ['twisters'], talk: ['talk'],
    quiz: ['quiz'], match: ['words'], order: ['order'], passage: ['passages'], stroke: ['chars'], build: ['build'], typo: ['typo'], compose: ['compose'],
    // 2.0 街机游戏（游戏注册时给了 cols 就以 cols 为准，这里只是兜底）
    balloon: ['pick'], catcher: ['words'], frog: ['stories'], rocket: ['readaloud'], beat: ['twisters'],
    racer: ['quiz'], snake: ['order'], memory: ['words'], mole: ['typo'], fishing: ['build'], monster: ['chars']
  };
  var ARCADE_ORDER = ['balloon', 'catcher', 'frog', 'rocket', 'beat', 'racer', 'snake', 'memory', 'mole', 'fishing', 'monster'];
  var GAME_ORDER = ARCADE_ORDER.concat(['pick', 'story', 'dictation', 'readaloud', 'twister', 'talk', 'quiz', 'match', 'order', 'passage', 'stroke', 'build', 'typo', 'compose']);
  var AVATARS = ['🐯', '🐰', '🐼', '🦁', '🐨', '🐧', '🦊', '🐱', '🐶', '🐸', '🦄', '🐬', '🐢', '🦉'];
  var RATE = { 2: 0.8, 3: 0.84, 4: 0.88, 5: 0.91, 6: 0.95 };
  var WRONG_MAX = 120, SEEN_MAX = 120, LOG_MAX = 80, REVIEW_MAX = 10;
  // 错题重练每轮交给游戏的题数 = 该游戏一轮最多出的题数（与 20/30 游戏里的 slice 上限一致或更小；游戏可用 def.reviewN 覆盖）
  var REVIEW_N = { pick: 10, story: 1, dictation: 5, readaloud: 3, twister: 2, talk: 1, quiz: 10, match: 10, order: 6, passage: 2, stroke: 4, build: 8, typo: 8, compose: 1,
    balloon: 8, catcher: 6, frog: 1, rocket: 4, beat: 2, racer: 10, snake: 5, memory: 10, mole: 6, fishing: 8, monster: 5 };

  /* 印章：约 24 枚（CSS 画的红色方章/圆章） */
  function F(id, t, n, shape) {
    return { id: id, t: t, shape: shape, need: '累计 ' + n + ' 朵小红花', prog: function (p) { return [p.flowers, n]; }, test: function (p) { return p.flowers >= n; } };
  }
  function SK(id, t, skill) {
    return { id: id, t: t, shape: 'square', need: SKILL_NAME[skill] + '游戏玩满 6 轮', prog: function (p) { return [p.skills[skill].rounds, 6]; }, test: function (p) { return p.skills[skill].rounds >= 6; } };
  }
  var STAMPS = [
    F('hao', '好', 3, 'round'), F('bang', '棒', 8, 'square'), F('you', '优', 15, 'round'), F('jiayou', '加油', 25, 'square'),
    F('haoyang', '好样的', 40, 'round'), F('congming', '真聪明', 60, 'round'), F('liaobuqi', '了不起', 85, 'round'),
    F('merlion', '鱼尾狮', 110, 'round'), F('panda', '熊猫', 140, 'square'), F('durian', '榴莲', 175, 'square'),
    F('mooncake', '月饼', 215, 'square'), F('rambutan', '红毛丹', 260, 'round'), F('xueba', '学霸', 320, 'square'),
    F('zhuangyuan', '状元', 400, 'square'),
    SK('tingli', '听力王', 'listen'), SK('jinsang', '金嗓子', 'speak'), SK('shuchong', '小书虫', 'read'), SK('shenbi', '神笔', 'write'),
    { id: 'ririxin', t: '日日新', shape: 'round', need: '第一次完成今日四件事', prog: function (p) { return [p.days.length, 1]; }, test: function (p) { return p.days.length >= 1; } },
    { id: 'qinxue', t: '勤学', shape: 'square', need: '有 3 天完成今日四件事', prog: function (p) { return [p.days.length, 3]; }, test: function (p) { return p.days.length >= 3; } },
    { id: 'chizhi', t: '持之以恒', shape: 'square', need: '有 7 天完成今日四件事', prog: function (p) { return [p.days.length, 7]; }, test: function (p) { return p.days.length >= 7; } },
    { id: 'manfen', t: '满分', shape: 'round', need: '有一轮拿到三颗星', test: function (p) { return Object.keys(p.games).some(function (k) { return p.games[k].best >= 3; }); } },
    { id: 'liandui', t: '连对王', shape: 'round', need: '一轮里连续答对 10 题', prog: function (p) { return [p.maxCombo, 10]; }, test: function (p) { return p.maxCombo >= 10; } },
    { id: 'kexing', t: '错题克星', shape: 'square', need: '从错题本里消灭 5 道题', prog: function (p) { return [p.cleared, 5]; }, test: function (p) { return p.cleared >= 5; } },
    {
      id: 'yangyang', t: '样样行', shape: 'round', need: '每个游戏都玩过一轮',
      prog: function (p) { var ids = Object.keys(games); return [ids.filter(function (id) { return p.games[id] && p.games[id].rounds > 0; }).length, ids.length]; },
      test: function (p) { var ids = Object.keys(games); return ids.length >= 8 && ids.every(function (id) { return p.games[id] && p.games[id].rounds > 0; }); }
    }
  ];

  /* ================= 状态 ================= */
  var games = {}, gameSeq = [];
  var profiles = {}, curId = null, tomb = {}, settings = { sound: true };  // tomb：已删除档案 id → 删除时间
  var root = null, main = null, toastEl = null, fxEl = null, booted = false;
  var ui = { view: 'map', mapScroll: 0, editing: null };
  var S = null, sessSeq = 0;

  /* ================= 档案 ================= */
  function normProfile(p) {
    p = isObj(p) ? p : {};
    var o = {
      id: String(p.id || uid()),
      name: String(p.name || '小朋友').slice(0, 12),
      avatar: String(p.avatar || '🐣').slice(0, 8),
      grade: GRADES.indexOf(p.grade) >= 0 ? p.grade : 'p3',
      flowers: Math.max(0, num(p.flowers)),
      stamps: isObj(p.stamps) ? p.stamps : {},
      skills: {}, games: {},
      daily: isObj(p.daily) ? { date: String(p.daily.date || ''), done: isObj(p.daily.done) ? p.daily.done : {} } : { date: '', done: {} },
      days: Array.isArray(p.days) ? p.days.filter(function (d) { return typeof d === 'string'; }) : [],
      wrong: Array.isArray(p.wrong) ? p.wrong.filter(function (w) { return isObj(w) && w.k && w.g; }) : [],
      seen: {}, mem: isObj(p.mem) ? p.mem : {},
      log: Array.isArray(p.log) ? p.log.filter(isObj).slice(-LOG_MAX) : [],
      maxCombo: num(p.maxCombo), cleared: num(p.cleared),
      createdAt: num(p.createdAt) || now(),
      updatedAt: num(p.updatedAt)
    };
    SKILL_IDS.forEach(function (s) {
      var v = isObj(p.skills) && isObj(p.skills[s]) ? p.skills[s] : {};
      o.skills[s] = { rounds: num(v.rounds), stars: num(v.stars) };
    });
    if (isObj(p.games)) for (var g in p.games) {
      var gv = p.games[g];
      if (isObj(gv)) o.games[g] = { rounds: num(gv.rounds), stars: num(gv.stars), best: clamp(num(gv.best), 0, 3), last: String(gv.last || '') };
    }
    if (isObj(p.seen)) for (var sg in p.seen) if (Array.isArray(p.seen[sg])) o.seen[sg] = p.seen[sg].filter(function (x) { return typeof x === 'string'; }).slice(-SEEN_MAX);
    o.wrong.forEach(function (w) { w.c = num(w.c, 1); w.ok = num(w.ok); w.t = num(w.t); w.gr = String(w.gr || o.grade); w.n = String(w.n || ''); });
    // seed：本机预置、还没和云端对过账的示例档案。云端已有同 id 档案时，云端为底、本机进度叠加上去（不许覆盖云端）
    if (p.seed === true) o.seed = true;
    return o;
  }
  function seedProfiles() {
    return [
      normProfile({ id: 'dabao', name: '大宝', avatar: '🐯', grade: 'p5', createdAt: 1, updatedAt: 0, seed: true }),
      normProfile({ id: 'xiaobao', name: '小宝', avatar: '🐰', grade: 'p3', createdAt: 2, updatedAt: 0, seed: true })
    ];
  }
  function hasProgress(p) {
    return p.flowers > 0 || p.log.length > 0 || p.wrong.length > 0 || p.days.length > 0 || Object.keys(p.stamps).length > 0 ||
      SKILL_IDS.some(function (s) { return p.skills[s].rounds > 0; });
  }
  /* 本机未对账的预置档案 l 并入云端档案 r：云端为底（名字/头像/年级以云端为准），本机玩出的进度叠加 */
  function absorbSeed(r, l) {
    if (!hasProgress(l)) return r;
    var o = r;
    o.flowers += l.flowers;
    SKILL_IDS.forEach(function (s) { o.skills[s].rounds += l.skills[s].rounds; o.skills[s].stars += l.skills[s].stars; });
    Object.keys(l.games).forEach(function (g) {
      var a = o.games[g], b = l.games[g];
      if (!a) o.games[g] = clone(b);
      else { a.rounds += b.rounds; a.stars += b.stars; a.best = Math.max(a.best, b.best); if (b.last > a.last) a.last = b.last; }
    });
    Object.keys(l.stamps).forEach(function (s) { if (!o.stamps[s] || String(l.stamps[s]) < String(o.stamps[s])) o.stamps[s] = l.stamps[s]; });
    var ds = {}; o.days.concat(l.days).forEach(function (d) { ds[d] = 1; });
    o.days = Object.keys(ds).sort().slice(-400);
    if (l.daily.date && l.daily.date === o.daily.date) Object.keys(l.daily.done).forEach(function (s) { if (l.daily.done[s]) o.daily.done[s] = true; });
    else if (l.daily.date > o.daily.date) o.daily = clone(l.daily);
    l.wrong.forEach(function (w) { if (!o.wrong.some(function (x) { return x.k === w.k && x.g === w.g; })) o.wrong.push(clone(w)); });
    if (o.wrong.length > WRONG_MAX) { o.wrong.sort(function (a, b) { return a.t - b.t; }); o.wrong.splice(0, o.wrong.length - WRONG_MAX); }
    o.log = o.log.concat(l.log).sort(function (a, b) { return num(a.t) - num(b.t); }).slice(-LOG_MAX);
    o.maxCombo = Math.max(o.maxCombo, l.maxCombo);
    o.cleared += l.cleared;
    Object.keys(l.mem).forEach(function (g) { if (!has(o.mem, g)) o.mem[g] = clone(l.mem[g]); });
    Object.keys(l.seen).forEach(function (g) { if (!o.seen[g]) o.seen[g] = l.seen[g].slice(); });
    checkStamps(o);
    o.updatedAt = Math.max(now(), num(o.updatedAt) + 1);
    return o;
  }
  function sortedProfiles() {
    return Object.keys(profiles).map(function (k) { return profiles[k]; }).sort(function (a, b) { return a.createdAt - b.createdAt; });
  }
  function ensureProfiles() {
    if (!Object.keys(profiles).length) {
      seedProfiles().forEach(function (p) { if (!has(tomb, p.id)) profiles[p.id] = p; });
      if (!Object.keys(profiles).length) { var p = normProfile({ name: '小朋友', avatar: '🐼', grade: 'p3' }); profiles[p.id] = p; }
    }
    if (!curId || !profiles[curId]) curId = sortedProfiles()[0].id;
  }
  function curProf() { ensureProfiles(); return profiles[curId]; }
  function profOf(sess) { return profiles[sess.pid] || null; }
  function loadLocal() {
    var saved = LS.get('profiles', null);
    if (isObj(saved)) for (var id in saved) { var p = normProfile(saved[id]); p.id = id; profiles[id] = p; }
    var del = LS.get('tomb', {});
    tomb = {};
    if (isObj(del)) for (var t in del) tomb[t] = num(del[t]);
    var st = LS.get('settings', null);
    if (isObj(st)) settings.sound = st.sound !== false;
    curId = LS.get('cur', null);
    ensureProfiles();
  }
  function saveLocal() {
    LS.set('profiles', profiles);
    LS.set('cur', curId);
  }
  function touch(p) {
    if (!p) return;
    p.updatedAt = Math.max(now(), num(p.updatedAt) + 1);
    saveLocal();
    markDirty(p.id);
  }
  function ensureDaily(p) {
    var t = todayStr();
    if (p.daily.date !== t) p.daily = { date: t, done: {} };
    return p.daily;
  }
  function createProfile(o) {
    var p = normProfile({ id: uid(), name: o.name, avatar: o.avatar, grade: o.grade, createdAt: now(), updatedAt: now() });
    profiles[p.id] = p;
    touch(p);
    return p;
  }
  function switchProfile(id) {
    if (!profiles[id]) return;
    curId = id; saveLocal();
  }
  function deleteProfile(id) {
    if (sortedProfiles().length <= 1) { toast('至少要留一个档案'); return false; }
    delete profiles[id];
    tomb[id] = now();
    LS.set('tomb', tomb);
    if (curId === id) curId = sortedProfiles()[0].id;
    saveLocal();
    markDirty(id);
    return true;
  }

  /* ================= 云端存档：claude.use("db") ================= */
  var capCache = {};
  function useCap(name) {
    if (capCache[name]) return capCache[name];
    var p;
    try {
      var c = W.claude;
      if (c && typeof c.use === 'function') {
        p = Promise.race([
          Promise.resolve().then(function () { return c.use(name); }).catch(function () { return null; }),
          sleep(12000).then(function () { return null; })
        ]);
      } else p = Promise.resolve(null);
    } catch (e) { p = Promise.resolve(null); }
    capCache[name] = p;
    return p;
  }
  var db = null, dbFirstDone = false, dbReadOnly = false, dbState = 'local', dbResubN = 0, quotaWarned = false;
  var dirty = new Set(), remoteTimer = null, retryTimer = null, writing = {};
  var DB_CODES = ['invalid_argument', 'resource_exhausted', 'quota_exceeded', 'unavailable', 'revoked', 'not_granted', 'capability_disabled', 'capability_removed', 'transform_error'];
  function setDbState(s) {
    dbState = s;
    var el = D.getElementById('hw-sync');
    if (el) el.textContent = syncText();
  }
  function syncText() {
    return {
      local: '进度保存在这台设备上',
      syncing: '正在连接云端存档……',
      synced: '进度已存到云端，换设备也能接着玩',
      readonly: '只能查看云端存档，新进度保存在这台设备上',
      error: '云端存档暂时连不上，进度先保存在这台设备上'
    }[dbState] || '';
  }
  function markDirty(id) { dirty.add(id); scheduleRemote(); }
  // 写入节流：停手 1.5 秒合并成一次写；连续操作时最迟 8 秒也要写一次（纯防抖会被不停的点击一直往后推）
  var dirtySince = 0;
  function scheduleRemote(ms) {
    if (!db || dbReadOnly || !dbFirstDone) return;
    if (!dirtySince) dirtySince = now();
    var wait = Math.min(ms == null ? 1500 : ms, Math.max(0, dirtySince + 8000 - now()));
    clearTimeout(remoteTimer);
    remoteTimer = setTimeout(flushRemote, wait);
  }
  function flushRemote() {
    if (!db || dbReadOnly || !dbFirstDone) return;
    clearTimeout(remoteTimer);
    dirtySince = 0;
    var ids = Array.from(dirty); dirty.clear();
    ids.forEach(writeDoc);
  }
  function forDb(p) {
    var o = clone(p) || {};
    delete o.seed;
    var s = JSON.stringify(o);
    if (byteLen(s) > 200000) { o.log = (o.log || []).slice(-20); o.seen = {}; s = JSON.stringify(o); }
    while (byteLen(s) > 200000 && o.wrong && o.wrong.length) {
      o.wrong.sort(function (a, b) { return a.t - b.t; });
      o.wrong.splice(0, Math.ceil(o.wrong.length / 4));
      s = JSON.stringify(o);
    }
    return o;
  }
  function withRetry(fn) {
    return Promise.resolve().then(fn).catch(function (e) {
      if (e && e.code === 'unavailable') return sleep(300 + Math.random() * 900).then(fn);
      throw e;
    });
  }
  function writeDoc(id) {
    var w = writing[id] || (writing[id] = { busy: false, again: false });
    if (w.busy) { w.again = true; return; }
    if (!db || dbReadOnly) return;
    w.busy = true;
    var job;
    // 每次（含重试）都取“此刻”的档案：重试等待期间云端快照可能已换掉 profiles[id]，不能推旧对象回去
    var body = function () {
      var p = profiles[id];
      if (p) return forDb(p);
      if (has(tomb, id)) return { id: id, deleted: true, updatedAt: tomb[id] || now() };
      return null;
    };
    try {
      var ref = db.doc('profiles/' + id);
      job = body() ? withRetry(function () { var b = body(); return b ? ref.set(b) : null; }) : Promise.resolve();
    } catch (e) { job = Promise.reject(e); }
    job.then(function () { if (dbState !== 'synced') setDbState('synced'); })
      .catch(function (e) {
        onDbError(e, true);
        // 暂时性失败（unavailable / resource_exhausted / 未知码）：这份档案重新记脏，30 秒后再推一次；别的码重试也不会成功
        var c = e && e.code;
        if (db && !dbReadOnly && (c === 'unavailable' || c === 'resource_exhausted' || (typeof c === 'string' && DB_CODES.indexOf(c) < 0))) {
          dirty.add(id);
          if (!retryTimer) retryTimer = setTimeout(function () { retryTimer = null; scheduleRemote(0); }, 30000);
        }
      })
      .then(function () {
        w.busy = false;
        if (w.again) { w.again = false; writeDoc(id); }
      });
  }
  function onDbError(e, isWrite) {
    var code = e && e.code;
    try { console.warn('[HW] db', code, e && e.message); } catch (x) { /* ignore */ }
    if (code === 'invalid_argument' && isWrite) { dbReadOnly = true; setDbState('readonly'); }
    else if (code === 'quota_exceeded') {
      if (!quotaWarned) { quotaWarned = true; toast('云端存档满了，进度先存在这台设备上'); }
    } else if (code === 'revoked' || code === 'not_granted' || code === 'capability_disabled' || code === 'capability_removed') {
      db = null; setDbState('local');
    } else setDbState('error');
  }
  function connectDb() {
    useCap('db').then(function (d) {
      if (!d || typeof d.collection !== 'function') { setDbState('local'); return; }
      db = d; setDbState('syncing'); subscribeDb();
    }).catch(function () { setDbState('local'); });
  }
  function subscribeDb() {
    if (!db) return;
    try {
      db.collection('profiles').onSnapshot(function (snap) {
        dbResubN = 0;
        try { onSnap(snap); } catch (e) { try { console.error('[HW] db snapshot', e); } catch (x) { /* ignore */ } }
      }, function (err) {
        // 只有“桥断了”的 unavailable 需要重新订阅：退避重试 3 次（5s / 30s / 120s）
        if (err && err.code === 'unavailable' && dbResubN < 3) {
          var wait = [5000, 30000, 120000][dbResubN++];
          setDbState('error');
          setTimeout(function () { if (db) subscribeDb(); }, wait);
        } else onDbError(err, false);
      });
    } catch (e) { onDbError(e, false); }
  }
  function onSnap(snap) {
    var changed = false;
    var definitive = !(snap.metadata && snap.metadata.fromCache);
    var remoteIds = new Set();
    (snap.docs || []).forEach(function (d) {
      if (!d || !d.exists) return;
      remoteIds.add(d.id);
      var raw = d.data();
      if (!isObj(raw)) return;
      if (raw.deleted) {
        // 墓碑（别的设备删了这个档案）：本机更新更晚则保留并回推，否则跟着删；本机没对过账的预置档案一律让位给墓碑
        var lp = profiles[d.id];
        if (lp && !lp.seed && lp.updatedAt > num(raw.updatedAt)) { if (!dbFirstDone && definitive) dirty.add(d.id); return; }
        if (lp && S && S.alive && S.pid === d.id) return;
        if (!has(tomb, d.id)) { tomb[d.id] = num(raw.updatedAt) || now(); LS.set('tomb', tomb); }
        if (lp) { delete profiles[d.id]; changed = true; }
        return;
      }
      if (has(tomb, d.id)) {
        if (num(raw.updatedAt) > tomb[d.id]) { delete tomb[d.id]; LS.set('tomb', tomb); }
        else { if (!dbFirstDone && definitive) dirty.add(d.id); return; }
      }
      var r = normProfile(clone(raw)); r.id = d.id; delete r.seed;
      var l = profiles[d.id];
      if (l && l.seed) {
        // 首次对账：本机预置档案绝不覆盖云端同名档案（哪怕本机先玩了几轮、updatedAt 更新）——云端为底，本机进度叠加。
        // 只在权威快照上合并：缓存快照里的云端档案可能是旧的，拿它当底会把别的设备刚写的进度盖掉
        if (!definitive) return;
        var merged = absorbSeed(r, l);
        profiles[d.id] = merged; changed = true;
        if (merged.updatedAt !== num(raw.updatedAt)) dirty.add(d.id);
      } else if (!l || r.updatedAt > l.updatedAt) { profiles[d.id] = r; changed = true; }
      else if (!dbFirstDone && definitive && l.updatedAt > r.updatedAt) dirty.add(d.id);
    });
    if (!dbFirstDone && definitive) {
      // 首次权威快照后，本机预置档案就算“对过账”了：云端没有的照常推上去，之后按 updatedAt 正常合并
      Object.keys(profiles).forEach(function (id) {
        if (profiles[id].seed) { delete profiles[id].seed; changed = true; }
      });
    }
    if (dbFirstDone) {
      var chs = [];
      try { chs = snap.docChanges ? snap.docChanges() : []; } catch (e) { chs = []; }
      chs.forEach(function (ch) {
        var id = ch && ch.doc && ch.doc.id;
        if (ch.type === 'removed' && id && profiles[id] && !remoteIds.has(id) && !(S && S.alive && S.pid === id)) {
          delete profiles[id]; changed = true;
        }
      });
    } else if (definitive) {
      Object.keys(profiles).forEach(function (id) { if (!remoteIds.has(id)) dirty.add(id); });
      Object.keys(tomb).forEach(function (id) { if (!remoteIds.has(id)) dirty.add(id); });
      dbFirstDone = true;
    }
    if (changed) { ensureProfiles(); saveLocal(); refreshAfterRemote(); }
    if (dbFirstDone) {
      // 快照能到就说明连上了（包括重新订阅成功）；只有还在等写入重试时才保留“连不上”
      if (!dbReadOnly && !retryTimer) setDbState('synced');
      if (dirty.size) scheduleRemote(400);
    }
  }
  function refreshAfterRemote() {
    if (!booted) return;
    if (ui.view === 'map') keepPlace(renderMap);
    else if (ui.view === 'stamps') keepPlace(renderStamps);
    else if (ui.view === 'records') keepPlace(renderRecords);
    else if (ui.view === 'wrong') keepPlace(renderWrong);
    else if (ui.view === 'profiles' && !ui.editing) keepPlace(function () { renderProfiles(); });
  }
  function keepPlace(fn) {
    var y = W.scrollY || 0;
    var ae = D.activeElement, fid = ae && ae.id;
    fn();
    try { W.scrollTo(0, y); } catch (e) { /* ignore */ }
    if (fid) { var el = D.getElementById(fid); if (el && el.focus) try { el.focus({ preventScroll: true }); } catch (e) { /* ignore */ } }
  }

  /* ================= 朗读 TTS ================= */
  var TTS = (function () {
    var synth = null;
    try { synth = W.speechSynthesis || null; } catch (e) { synth = null; }
    var Utter = W.SpeechSynthesisUtterance;
    var voice = null, noZh = false, gen = 0, pending = null, unlocked = false, listeners = [];
    var keep = [];
    function scoreVoice(v) {
      var lang = String(v.lang || '').toLowerCase().replace(/_/g, '-');
      var name = String(v.name || '');
      // 粤语声音读出来是广东话，拿来练普通话拼音等于教错 → 一律不用（宁可显示“没有中文朗读声音”的提示）
      if (/^zh-hk|^zh-mo|^yue/.test(lang) || /cantonese|粤|粵|sinji|善怡|hiugaai|hiumaan|wanlung|香港/i.test(name)) return 0;
      var s;
      if (/^zh-cn|^cmn/.test(lang)) s = 100;
      else if (/^zh-sg/.test(lang)) s = 95;
      else if (/^zh-hans/.test(lang)) s = 90;
      else if (lang === 'zh') s = 70;
      else if (/^zh-tw|^zh-hant/.test(lang)) s = 30;       // 台湾普通话：个别字读音不同，只在没有大陆普通话时兜底
      else if (/普通话|中文|mandarin|chinese/i.test(name)) s = 40;
      else return 0;
      if (/tingting|婷婷|xiaoxiao|晓晓|xiaoyi|晓伊|yunxi|云希|yunjian|huihui|kangkang|yaoyao|lili|shasha|普通话/i.test(name)) s += 20;
      if (/premium|enhanced|natural|neural|增强|高品质/i.test(name)) s += 8;
      if (/台灣|台湾|taiwan|meijia|美佳/i.test(name)) s -= 20;
      if (v.localService) s += 2;
      return Math.max(1, s);
    }
    function refresh() {
      if (!synth) return;
      var vs = [];
      try { vs = synth.getVoices() || []; } catch (e) { vs = []; }
      if (!vs.length) return;
      var best = null, bs = 0;
      for (var i = 0; i < vs.length; i++) { var sc = scoreVoice(vs[i]); if (sc > bs) { bs = sc; best = vs[i]; } }
      voice = best; noZh = !best;
      listeners.forEach(function (f) { try { f(); } catch (e) { /* ignore */ } });
    }
    function init() {
      if (!synth) return;
      refresh();
      try {
        if (synth.addEventListener) synth.addEventListener('voiceschanged', refresh);
        else synth.onvoiceschanged = refresh;
      } catch (e) { try { synth.onvoiceschanged = refresh; } catch (x) { /* ignore */ } }
      setTimeout(refresh, 700); setTimeout(refresh, 2500);
    }
    /* 长文本按句切段：Chrome（尤其 Google 在线声音）单条朗读超过约 15 秒会被静默掐断、onend 也不来。
       每段 <= MAX 字（P2 语速 0.8 时约 8 秒）：先按句号类切，超长句再按逗号类切，仍超长的硬切。 */
    function splitText(text) {
      var MAX = 30;
      var sents = String(text).replace(/\s+/g, ' ').trim().replace(/([。！？；!?;…]+[”’」』）)]*)/g, '$1\u0001').split('\u0001');
      var pieces = [];
      sents.forEach(function (p) {
        p = p.trim(); if (!p) return;
        if (p.length <= MAX) { pieces.push(p); return; }
        var segs = p.replace(/([，、,：:])/g, '$1\u0001').split('\u0001'), c2 = '';
        segs.forEach(function (x) {
          if (!x) return;
          while (x.length > MAX) { if (c2) { pieces.push(c2); c2 = ''; } pieces.push(x.slice(0, MAX)); x = x.slice(MAX); }
          if (c2 && (c2 + x).length > MAX) { pieces.push(c2); c2 = x; } else c2 += x;
        });
        if (c2) pieces.push(c2);
      });
      var out = [], cur = '';
      pieces.forEach(function (p) {
        if (!/[\u3400-\u9fff\w]/.test(p)) { if (cur) cur += p; else if (out.length) out[out.length - 1] += p; return; }
        if (cur && (cur + p).length > MAX) { out.push(cur); cur = p; } else cur += p;
      });
      if (cur) out.push(cur);
      return out;
    }
    function halt(cancelSynth) {
      gen++;
      var p = pending; pending = null;
      if (p) p.finish();
      if (cancelSynth && synth) { try { synth.cancel(); } catch (e) { /* ignore */ } }
    }
    function stop() { halt(true); }
    // 婷婷等语音把状语后的“地”读成 dì：build 时算好读 de 的三字窗口（window.HW_TTS_DE），朗读前换成“的”，屏幕文字不变
    var deSet = null;
    function fixDe(s) {
      if (s.indexOf('地') < 0) return s;
      if (!deSet) { deSet = {}; (W.HW_TTS_DE || []).forEach(function (k) { deSet[k] = 1; }); }
      var a = Array.from(s);
      for (var j = 0; j < a.length; j++) {
        if (a[j] === '地' && deSet[(a[j - 1] || '') + '地' + (a[j + 1] || '')]) a[j] = '的';
      }
      return a.join('');
    }
    function speak(text, opts) {
      opts = opts || {};
      var busy = !!pending;
      halt(busy);
      text = fixDe(String(text == null ? '' : text).trim());
      // 没有中文声音（noZh，含只有粤语声音）= 不支持：立即 resolve，不许用英文声音乱读中文（SPEC §3 tts.speak）
      if (!synth || !Utter || noZh || !text) return Promise.resolve();
      var my = gen;
      var rate = clamp(num(opts.rate, 0.9), 0.5, 1.6);
      var list = splitText(text);
      return new Promise(function (resolve) {
        var settled = false;
        var me = { finish: function () { if (settled) return; settled = true; resolve(); } };
        pending = me;
        var end = function () { if (pending === me) pending = null; me.finish(); };
        var i = 0;
        var sayNext = function () {
          if (my !== gen || i >= list.length) return end();
          var t = list[i++];
          var u;
          try { u = new Utter(t); } catch (e) { return end(); }
          u.lang = String((voice && voice.lang) || 'zh-CN').replace(/_/g, '-');
          if (voice) u.voice = voice;
          u.rate = rate; u.pitch = num(opts.pitch, 1) || 1; u.volume = 1;
          keep.push(u); if (keep.length > 24) keep.shift();
          var done = false, started = false, wd = 0, sg = 0;
          var next = function () { if (done) return; done = true; clearTimeout(wd); clearTimeout(sg); sayNext(); };
          u.onstart = function () { started = true; };
          u.onend = next; u.onerror = next;
          wd = setTimeout(next, t.length * 450 / rate + 3000);
          // 4 秒还没开口、引擎也不在忙（iOS 未解锁 / 引擎卡死）：整段放弃并 resolve，别让游戏干等几十秒
          sg = setTimeout(function () {
            if (done || started) return;
            var busyNow = false;
            try { busyNow = !!(synth.speaking || synth.pending); } catch (e) { busyNow = false; }
            if (!busyNow) { done = true; clearTimeout(wd); try { synth.cancel(); } catch (e) { /* ignore */ } end(); }
          }, 4000);
          try { if (synth.paused) synth.resume(); synth.speak(u); } catch (e) { next(); }
        };
        if (busy) setTimeout(sayNext, 80); else sayNext();
      });
    }
    function unlock() {
      if (unlocked || !synth || !Utter) return;
      unlocked = true;
      if (!pending) {
        try { var u = new Utter(' '); u.volume = 0; u.lang = 'zh-CN'; synth.speak(u); } catch (e) { /* ignore */ }
      }
      setTimeout(refresh, 300);
    }
    return {
      get ok() { return !!synth && !!Utter && !noZh; },
      get supported() { return !!synth && !!Utter; },
      status: function () { return (!synth || !Utter) ? 'none' : (noZh ? 'nozh' : 'ok'); },
      voiceName: function () { return voice ? voice.name : ''; },
      speak: speak, stop: stop, init: init, unlock: unlock,
      onChange: function (f) { listeners.push(f); }
    };
  })();
  function rateFor(gn) { return RATE[gn] || 0.9; }
  function curGradeNum() { return Number(String(curProf().grade).slice(1)) || 3; }

  /* ================= 音效 WebAudio ================= */
  var SFX = (function () {
    var ctx = null;
    function ac() {
      if (!settings.sound) return null;
      try {
        if (!ctx) { var C = W.AudioContext || W.webkitAudioContext; if (!C) return null; ctx = new C(); }
        if (ctx.state === 'suspended' && ctx.resume) ctx.resume().catch(function () {});
        return ctx;
      } catch (e) { return null; }
    }
    function tone(f, at, dur, o) {
      var c = ac(); if (!c) return;
      o = o || {};
      try {
        var t0 = c.currentTime + at;
        var osc = c.createOscillator(), g = c.createGain();
        osc.type = o.type || 'sine';
        osc.frequency.setValueAtTime(f, t0);
        if (o.to) osc.frequency.exponentialRampToValueAtTime(o.to, t0 + dur);
        var v = o.vol == null ? 0.18 : o.vol;
        g.gain.setValueAtTime(0.0001, t0);
        g.gain.exponentialRampToValueAtTime(v, t0 + 0.012);
        g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
        osc.connect(g); g.connect(c.destination);
        osc.start(t0); osc.stop(t0 + dur + 0.03);
      } catch (e) { /* ignore */ }
    }
    function noise(at, dur, vol) {
      var c = ac(); if (!c) return;
      try {
        var len = Math.max(1, Math.floor(c.sampleRate * dur));
        var buf = c.createBuffer(1, len, c.sampleRate), d = buf.getChannelData(0);
        for (var i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
        var src = c.createBufferSource(); src.buffer = buf;
        var f = c.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 1100;
        var g = c.createGain(); g.gain.value = vol;
        src.connect(f); f.connect(g); g.connect(c.destination);
        src.start(c.currentTime + at);
      } catch (e) { /* ignore */ }
    }
    return {
      good: function () { tone(660, 0, 0.12, { type: 'triangle', vol: 0.2 }); tone(990, 0.09, 0.2, { type: 'triangle', vol: 0.2 }); },
      bad: function () { tone(240, 0, 0.2, { type: 'square', vol: 0.06, to: 150 }); tone(170, 0.12, 0.24, { type: 'square', vol: 0.05, to: 110 }); },
      tap: function () { tone(1100, 0, 0.05, { vol: 0.08 }); },
      win: function () {
        [523, 659, 784, 1047].forEach(function (f, i) { tone(f, i * 0.11, 0.24, { type: 'triangle', vol: 0.17 }); });
        tone(1319, 0.46, 0.55, { vol: 0.1 });
      },
      flip: function () { tone(420, 0, 0.14, { vol: 0.1, to: 900 }); },
      stamp: function () { tone(150, 0, 0.18, { vol: 0.35, to: 55 }); noise(0, 0.09, 0.14); },
      star: function (i) { var f = [784, 988, 1175][i] || 1175; tone(f, 0, 0.16, { type: 'triangle', vol: 0.18 }); tone(f * 1.5, 0.08, 0.26, { type: 'sine', vol: 0.1 }); },
      combo: function (n) { var b = 700 + Math.min(n, 12) * 40; tone(b, 0, 0.08, { type: 'triangle', vol: 0.14 }); tone(b * 1.5, 0.07, 0.16, { type: 'triangle', vol: 0.14 }); },
      unlock: function () { ac(); }
    };
  })();

  /* ================= 语音识别 ASR ================= */
  var ASR = (function () {
    var SR = W.SpeechRecognition || W.webkitSpeechRecognition;
    var denied = false, cur = null;
    function init() {
      var t = num(LS.get('asrNo', 0));
      if (t && now() - t < 3 * 864e5) denied = true;
      var policyBlocked = false;
      try {
        var fp = D.permissionsPolicy || D.featurePolicy;
        if (fp && typeof fp.allowsFeature === 'function' && !fp.allowsFeature('microphone')) { denied = true; policyBlocked = true; }
      } catch (e) { /* ignore */ }
      try {
        if (navigator.permissions && navigator.permissions.query) {
          navigator.permissions.query({ name: 'microphone' }).then(function (s) {
            if (!s) return;
            var apply = function () {
              if (s.state === 'denied') denied = true;
              else if (s.state === 'granted' && !policyBlocked) { denied = false; LS.set('asrNo', 0); }   // 家长后来打开了麦克风：别再按 3 天前的“被拒”记忆降级
            };
            apply();
            try { s.onchange = apply; } catch (e) { /* ignore */ }
          }).catch(function () {});
        }
      } catch (e) { /* ignore */ }
    }
    function markDenied() { denied = true; LS.set('asrNo', now()); }
    // 部分 Safari/iOS 在 stop() 之后不发 onend：不能干等 maxMs+2 秒的兜底（continuous 时可达 90 秒），
    // 停下后最多再等 2 秒收尾（留给最后一段 final 结果），到点用已听到的文字 resolve。done() 本身幂等。
    function stop() {
      var c = cur;
      if (!c) return;
      try { c.rec.stop(); } catch (e) { c.done(); return; }
      setTimeout(function () { c.done(); }, 2000);
    }
    /* listen(opts) 契约（20_games_a 的 readaloud / twister / talk 依赖，勿当“没用的参数”删掉）：
       opts.onInterim(text)  识别中途回调（已定稿 + 临时文字）
       opts.continuous       true = 句间停顿不自动结束，一直听到 stop() 或 maxMs
       opts.maxMs            最长录音毫秒数，缺省 15000；到点自动 stop，再过 2 秒仍无 onend 则强制 resolve */
    function listen(opts) {
      opts = opts || {};
      if (!SR || denied) return Promise.reject(mkErr('unavailable', '这台设备现在不能用麦克风'));
      if (cur) { try { cur.rec.abort(); } catch (e) { /* ignore */ } cur.done(); }
      TTS.stop();
      return new Promise(function (resolve, reject) {
        var rec;
        try { rec = new SR(); } catch (e) { markDenied(); reject(mkErr('unavailable', '这台设备现在不能用麦克风')); return; }
        rec.lang = 'zh-CN'; rec.interimResults = true; rec.continuous = !!opts.continuous; rec.maxAlternatives = 1;
        var finalText = '', interim = '', settled = false, err = null, t1 = 0, t2 = 0;
        var me = {
          rec: rec,
          done: function () {
            if (settled) return; settled = true;
            clearTimeout(t1); clearTimeout(t2);
            if (cur === me) cur = null;
            if (err) reject(err); else resolve((finalText + interim).trim());
          }
        };
        rec.onresult = function (ev) {
          interim = '';
          for (var i = ev.resultIndex; i < ev.results.length; i++) {
            var r = ev.results[i];
            if (r.isFinal) finalText += r[0].transcript; else interim += r[0].transcript;
          }
          if (typeof opts.onInterim === 'function') { try { opts.onInterim((finalText + interim).trim()); } catch (e) { /* ignore */ } }
        };
        rec.onerror = function (ev) {
          var c = ev && ev.error;
          if (c === 'not-allowed' || c === 'service-not-allowed') { markDenied(); err = mkErr('not-allowed', '麦克风没有打开，可以改用自己评星'); }
          else if (c === 'no-speech' || c === 'aborted') { /* 当作没说话：返回已有文字 */ }
          else if (c === 'audio-capture') err = mkErr('audio-capture', '没有找到麦克风');
          else if (c === 'network') err = mkErr('network', '语音识别需要联网');
          else err = mkErr(c || 'error', '没听清楚，再试一次');
        };
        rec.onend = function () { me.done(); };
        var maxMs = num(opts.maxMs, 15000) || 15000;
        t1 = setTimeout(function () { try { rec.stop(); } catch (e) { /* ignore */ } }, maxMs);
        t2 = setTimeout(function () { me.done(); }, maxMs + 2000);
        cur = me;
        try { rec.start(); } catch (e) { err = mkErr('start', '麦克风启动失败'); me.done(); }
      });
    }
    return {
      get ok() { return !!SR && !denied; },
      listen: listen, stop: stop, init: init
    };
  })();

  /* ================= AI 老师点评：claude.use("sample") ================= */
  var aiOff = false;
  var AI_PERM = ['not_granted', 'sampling_disabled', 'not_declared', 'capability_disabled', 'capability_removed'];
  function aiMessage(code) {
    if (AI_PERM.indexOf(code) >= 0) return 'AI 老师没有开启（需要大人同意使用 Claude），可以请爸爸妈妈看看。';
    return {
      rate_limited: 'AI 老师有点忙，等一会儿再试。',
      session_expired: '需要重新登录 Claude，才能请 AI 老师。',
      refused: 'AI 老师这次没法点评，换一段内容试试。',
      invalid_json: 'AI 老师的回答没写好，再点一次试试。',
      empty_completion: 'AI 老师没有写出点评，再点一次试试。',
      prompt_too_large: '内容太长了，删短一点再请 AI 老师看。',
      cancelled: '已经取消了。'
    }[code] || '网络开小差了，再试一次。';
  }
  function aiPrompt(task, text, gn) {
    return [
      '你是一位温柔、有耐心的新加坡小学华文老师，正在点评一名小学' + (CN_NUM[gn] || '') + '年级（P' + gn + '）学生的华文练习。这个孩子有中国华文底子，请按 P' + gn + ' 偏上的标准来看，但说话要温柔、多鼓励。',
      '',
      '【练习要求】' + (task || '自由表达'),
      '【学生的作答】' + text,
      '',
      '请只回复一个 JSON 对象，不要写任何其他文字。格式示例：',
      '{"stars": 2, "praise": "……", "tips": ["……", "……"], "better": "……"}',
      '字段说明：',
      '- stars：1 到 3 的整数。3 = 完成得很好；2 = 基本完成，还有可以改进的地方；1 = 离题、太短或错误较多。',
      '- praise：一句具体的表扬，说出好在哪里，不超过 40 个字。',
      '- tips：最多 3 条改进建议，每条具体、能照着做（例如哪个字写错了、哪里可以用上一个好词），每条不超过 30 个字；没有就给空数组。',
      '- better：保留孩子原来的意思，改写成更好的示范，符合 P' + gn + ' 水平，不要太长。',
      '要求：全部用简体中文，直接对孩子说话（用“你”），不要出现英文。如果作答是语音识别转写的文字，同音错字可能是识别造成的，不要因此批评孩子。'
    ].join('\n');
  }
  function parseJsonLoose(t) {
    t = String(t || '');
    try { return JSON.parse(t); } catch (e) { /* fallthrough */ }
    var a = t.indexOf('{'), b = t.lastIndexOf('}');
    if (a >= 0 && b > a) { try { return JSON.parse(t.slice(a, b + 1)); } catch (e) { /* ignore */ } }
    throw mkErr('invalid_json', aiMessage('invalid_json'));
  }
  function normReview(r) {
    if (!isObj(r)) throw mkErr('invalid_json', aiMessage('invalid_json'));
    var tips = Array.isArray(r.tips) ? r.tips : (r.tips ? [r.tips] : []);
    return {
      stars: clamp(Math.round(num(r.stars, 2)) || 2, 1, 3),
      praise: String(r.praise || '你认真完成了练习，真不错！').slice(0, 160),
      tips: tips.map(function (x) { return String(x || '').trim(); }).filter(Boolean).slice(0, 3).map(function (x) { return x.slice(0, 120); }),
      better: String(r.better || '').slice(0, 800)
    };
  }
  var AI = {
    ok: function () {
      return useCap('sample').then(function (s) { return !!s && typeof s === 'function' && !aiOff; }, function () { return false; });
    },
    review: function (a, gn) {
      a = a || {};
      var text = String(a.text == null ? '' : a.text).trim();
      var task = String(a.task == null ? '' : a.task).trim();
      gn = gn || curGradeNum();
      if (!text) return Promise.reject(mkErr('empty', '先写一点内容，再请 AI 老师点评。'));
      return useCap('sample').then(function (s) {
        if (!s || typeof s !== 'function' || aiOff) { var off = mkErr('unavailable', 'AI 老师现在不在，可以请爸爸妈妈看看。'); off.off = true; throw off; }
        var prompt = aiPrompt(task.slice(0, 600), text.slice(0, 1500), gn);
        var call = typeof s.json === 'function'
          ? s.json(prompt, { modelTier: 'quick' })
          : Promise.resolve(s(prompt, { modelTier: 'quick' })).then(function (res) { return parseJsonLoose(res && res.text); });
        return Promise.resolve(call).then(normReview, function (e) {
          var code = (e && e.code) || 'upstream_error';
          var err = mkErr(code, aiMessage(code));
          // 永久不可用（家长没同意 / 账号没开 / 能力被撤）：本页不再调用；err.off=true 供游戏把“请 AI 老师点评”按钮藏起来
          if (AI_PERM.indexOf(code) >= 0) { aiOff = true; err.off = true; }
          throw err;
        });
      });
    }
  };

  /* ================= 汉字书写 HanziWriter ================= */
  function strokes() { return (W.HW_STROKES && typeof W.HW_STROKES === 'object') ? W.HW_STROKES : {}; }
  var Hanzi = {
    ready: function () { return typeof W.HanziWriter !== 'undefined' && !!W.HanziWriter && Object.keys(strokes()).length > 0; },
    has: function (ch) { return typeof W.HanziWriter !== 'undefined' && !!W.HanziWriter && !!ch && has(strokes(), ch); },
    create: function (el, ch, opts, bag) {
      if (!el || !Hanzi.has(ch)) return null;
      opts = Object.assign({}, opts || {});
      el.classList.add('hw-tianzige', 'hw-hz');
      var inner = num(opts.width) || num(opts.height);
      var outer;
      if (inner) outer = inner + 4;
      else {
        var r = el.getBoundingClientRect ? el.getBoundingClientRect() : { width: 0 };
        outer = Math.floor(r.width) || 0;
        if (!outer) outer = Math.min(280, Math.max(160, (D.documentElement.clientWidth || 360) - 80));
        inner = outer - 4;
      }
      inner = Math.max(60, Math.round(inner));
      outer = inner + 4;
      el.style.width = outer + 'px'; el.style.height = outer + 'px';
      var tk = tokens();
      var o = Object.assign({
        padding: Math.round(inner * 0.06),
        showOutline: true, showCharacter: true,
        strokeColor: tk.ink, outlineColor: tk.hzOutline, highlightColor: tk.listen,
        drawingColor: tk.accent, drawingWidth: Math.max(4, Math.round(inner / 40)),
        strokeAnimationSpeed: 1, delayBetweenStrokes: 280,
        onLoadCharDataError: function (e) { try { console.warn('[HW] hanzi data', e); } catch (x) { /* ignore */ } }
      }, opts, {
        width: inner, height: inner,
        // 页面网络被 CSP 拦截，只读内嵌的 HW_STROKES。hanzi-writer 3.7.3：回调 onLoad 与“返回数据”二选一即可，
        // 这里只走回调（不再同时 return，免得同一份数据 resolve 两次）
        charDataLoader: function (c, onLoad, onErr) {
          var d = strokes()[c];
          if (d) { if (typeof onLoad === 'function') onLoad(d); return undefined; }
          if (typeof onErr === 'function') onErr(new Error('no stroke data: ' + c));
          return undefined;
        }
      });
      // hanzi-writer 3.7.3 每个 writer 都在构造时往 document 挂 mouseup/touchend（RenderTargetBase.addPointerEndListener），
      // 且从不移除 → 闭包拽着整个 writer 和它那张已脱离页面的 SVG。这里在 create 的同步窗口里记下这些监听，
      // 交给 bag（本局会话的清理袋），游戏结束时统一摘掉；游戏侧无需任何改动。
      var got = [], hadOwn = has(D, 'addEventListener'), origAdd = D.addEventListener;
      if (bag) {
        try {
          D.addEventListener = function (type, fn, lo) {
            if (type === 'mouseup' || type === 'touchend') got.push([type, fn, lo]);
            return origAdd.call(D, type, fn, lo);
          };
        } catch (e) { /* 不可写就算了：只是少一层清理 */ }
      }
      var w = null;
      try { w = W.HanziWriter.create(el, ch, o); } catch (e) { try { console.warn('[HW] hanzi', e); } catch (x) { /* ignore */ } w = null; }
      finally {
        if (bag) { try { if (hadOwn) D.addEventListener = origAdd; else delete D.addEventListener; } catch (e) { /* ignore */ } }
      }
      if (bag && got.length) bag.push(function () { got.forEach(function (a) { try { D.removeEventListener(a[0], a[1], a[2]); } catch (e) { /* ignore */ } }); });
      return w;
    }
  };

  /* ================= 轻提示 / 特效 ================= */
  var toastTimer = 0;
  function toast(msg) {
    if (!toastEl) return;
    toastEl.textContent = String(msg == null ? '' : msg);
    toastEl.classList.add('is-on');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { toastEl.classList.remove('is-on'); }, 2400);
  }
  function burst(text) {
    if (!fxEl) return;
    if (reduceMotion()) { toast(text); return; }
    var b = h('div', { class: 'hw-burst' }, text);
    fxEl.appendChild(b);
    setTimeout(function () { b.remove(); }, 950);
  }
  function confetti() {
    if (!fxEl || reduceMotion()) return;
    var c = h('canvas');
    var g = c.getContext && c.getContext('2d');
    if (!g) return;
    fxEl.appendChild(c);
    var dpr = Math.min(2, W.devicePixelRatio || 1), w = W.innerWidth, ht = W.innerHeight;
    c.width = Math.round(w * dpr); c.height = Math.round(ht * dpr); g.scale(dpr, dpr);
    var tk = tokens();
    var colors = [tk.accent, tk.gold, tk.listen, tk.read, tk.speak, tk.write, tk.flower];
    var N = clamp(Math.round(w / 6), 50, 150);
    var parts = [];
    for (var i = 0; i < N; i++) {
      parts.push({
        x: Math.random() * w, y: -20 - Math.random() * ht * 0.5, vx: (Math.random() - 0.5) * 2.4, vy: 1.5 + Math.random() * 3,
        r: Math.random() * Math.PI, vr: (Math.random() - 0.5) * 0.25, w: 6 + Math.random() * 6, hh: 8 + Math.random() * 10,
        col: colors[i % colors.length], flower: Math.random() < 0.16
      });
    }
    var t0 = performance.now(), dur = 2600;
    function frame(t) {
      var el = t - t0;
      g.clearRect(0, 0, w, ht);
      var a = el > dur - 700 ? Math.max(0, (dur - el) / 700) : 1;
      g.globalAlpha = a;
      parts.forEach(function (p) {
        p.x += p.vx; p.y += p.vy; p.vy += 0.03; p.r += p.vr;
        g.save(); g.translate(p.x, p.y); g.rotate(p.r); g.fillStyle = p.col;
        if (p.flower) {
          for (var k = 0; k < 5; k++) { var an = k * 1.2566; g.beginPath(); g.arc(Math.cos(an) * 4, Math.sin(an) * 4, 3.6, 0, 6.2832); g.fill(); }
          g.fillStyle = tk.gold; g.beginPath(); g.arc(0, 0, 2.6, 0, 6.2832); g.fill();
        } else g.fillRect(-p.w / 2, -p.hh / 2, p.w, Math.max(2, p.hh * Math.abs(Math.cos(p.r * 2))));
        g.restore();
      });
      if (el < dur) requestAnimationFrame(frame); else c.remove();
    }
    requestAnimationFrame(frame);
  }

  /* ================= 印章 / 小红花 元件 ================= */
  function stampEl(s, o) {
    o = o || {};
    var t = String(s.t || '');
    var n = clamp(Array.from(t).length, 1, 4);
    var shape = s.shape || (n === 3 ? 'round' : 'square');
    var rot = o.rot != null ? o.rot : ((parseInt(hash(t), 36) % 15) - 7);
    var cls = ['hw-stamp', shape, o.locked ? 'is-locked' : '', o.fresh ? 'is-fresh' : '', o.tiny ? 'tiny' : ''].filter(Boolean).join(' ');
    return h('span', { class: cls, style: '--s:' + (o.size || 72) + 'px;--rot:' + rot + 'deg', role: 'img', 'aria-label': t + '印章' + (o.locked ? '（还没得到）' : '') },
      h('span', { class: 'hw-stamp-t n' + n, 'aria-hidden': 'true' }, t));
  }
  function dateSeal(d) {
    var m = Number(String(d).slice(5, 7)), dd = Number(String(d).slice(8, 10));
    return h('span', { class: 'hw-dateseal', role: 'img', 'aria-label': m + '月' + dd + '日 四件事完成' },
      h('small', null, '完成'), h('b', null, m + '·' + dd));
  }
  function needText(s, p) {
    if (typeof s.prog === 'function') {
      var pr = s.prog(p);
      return s.need + '（' + Math.min(pr[0], pr[1]) + '/' + pr[1] + '）';
    }
    return s.need;
  }
  function checkStamps(p) {
    var fresh = [];
    STAMPS.forEach(function (s) {
      if (p.stamps[s.id]) return;
      var ok = false;
      try { ok = !!s.test(p); } catch (e) { ok = false; }
      if (ok) { p.stamps[s.id] = todayStr(); fresh.push(s); }
    });
    return fresh;
  }
  function fmtDate(d) {
    var m = Number(String(d).slice(5, 7)), dd = Number(String(d).slice(8, 10));
    return (m && dd) ? (m + '月' + dd + '日') : '';
  }
  function fmtTime(t) {
    var d = new Date(t);
    return (d.getMonth() + 1) + '/' + d.getDate() + ' ' + pad2(d.getHours()) + ':' + pad2(d.getMinutes());
  }
  function stars3(n) { n = clamp(num(n), 0, 3); return '★★★'.slice(0, n) + '☆☆☆'.slice(0, 3 - n); }

  /* ================= 游戏注册 / 题库 ================= */
  function register(def) {
    if (!def || typeof def !== 'object' || !def.id || typeof def.start !== 'function') { try { console.warn('[HW] register: bad game', def); } catch (e) { /* ignore */ } return; }
    if (SKILL_IDS.indexOf(def.skill) < 0) { try { console.warn('[HW] register: bad skill', def.id, def.skill); } catch (e) { /* ignore */ } return; }
    var id = String(def.id);
    if (!games[id]) gameSeq.push(id);
    var cols = Array.isArray(def.cols) ? def.cols.filter(function (c) { return typeof c === 'string' && c; }) : (typeof def.cols === 'string' ? [def.cols] : null);
    games[id] = Object.assign({}, def, {
      id: id, needs: Array.isArray(def.needs) ? def.needs.slice() : [],
      kind: def.kind === 'arcade' ? 'arcade' : 'practice',   // kind 缺省 / 'practice' = 1.0 练习游戏（收进练习本）
      cols: cols && cols.length ? cols : null
    });
    if (booted && ui.view === 'map') keepPlace(renderMap);
  }
  function css(text) {
    if (!text) return null;
    var st = D.createElement('style');
    st.setAttribute('data-hw', 'game');
    st.textContent = String(text);
    (D.head || D.documentElement).appendChild(st);
    return st;
  }
  function orderedGames() {
    var ids = GAME_ORDER.filter(function (id) { return games[id]; });
    gameSeq.forEach(function (id) { if (ids.indexOf(id) < 0 && games[id]) ids.push(id); });
    return ids.map(function (id) { return games[id]; });
  }
  function gameName(id) { return games[id] ? games[id].name : id; }
  function gradeData(grade) {
    var all = W.HW_DATA;
    var src = (isObj(all) && isObj(all[grade])) ? all[grade] : {};
    var o = {};
    COLS.forEach(function (c) { o[c] = Array.isArray(src[c]) ? src[c].slice() : []; });
    return o;
  }
  function isArcade(g) { return !!g && g.kind === 'arcade'; }
  function availability(g, G) {
    // 有 cols 按 cols 判断题库是否为空；没有 cols 沿用旧逻辑（g.data → GAME_DATA）
    var cols = g.cols ? g.cols : (g.data ? [].concat(g.data) : (GAME_DATA[g.id] || []));
    for (var i = 0; i < cols.length; i++) if (!(G[cols[i]] && G[cols[i]].length)) return { ok: false, why: '题目准备中' };
    var needs = g.needs || [];
    if (needs.indexOf('tts') >= 0 && !TTS.ok) return { ok: false, why: TTS.supported ? '需要中文朗读声音' : '这个浏览器不能朗读' };
    if (needs.indexOf('hanzi') >= 0 && !Hanzi.ready()) return { ok: false, why: '笔顺数据没有加载' };
    return { ok: true };
  }

  /* ================= 游戏会话 ================= */
  function starsFor(r) { return r >= 0.9 ? 3 : r >= 0.6 ? 2 : r >= 0.3 ? 1 : 0; }

  function mcq(o, sess) {
    o = o || {};
    var opts = Array.isArray(o.options) ? o.options : [];
    var ans = Number(o.answer);
    var wrap = h('div', { class: 'hw-choices' + (o.big ? ' big' : ''), role: 'group' });
    var locked = false;
    opts.forEach(function (opt, i) {
      var isNode = typeof Node !== 'undefined' && opt instanceof Node;
      var b = h('button', { type: 'button', class: 'hw-choice', 'data-i': i }, isNode ? opt : String(opt == null ? '' : opt));
      b.addEventListener('click', function () {
        if (locked || (sess && !sess.alive)) return;
        locked = true;
        wrap.classList.add('is-locked');
        var ok = i === ans;
        Array.prototype.forEach.call(wrap.children, function (c, j) {
          if (j === i) c.classList.add(ok ? 'is-right' : 'is-wrong');
          else if (j === ans) c.classList.add('is-right');
          else c.classList.add('is-dim');
          c.setAttribute('aria-disabled', 'true');
        });
        if (typeof o.onAnswer === 'function') { try { o.onAnswer(ok, i); } catch (e) { reportGameError(sess, e); } }
      });
      wrap.appendChild(b);
    });
    return wrap;
  }

  function comboFx(sess) {
    var el = sess.comboEl;
    if (!el) return;
    if (sess.combo >= 3) {
      el.textContent = '连对 ×' + sess.combo;
      el.classList.add('is-on');
      el.classList.remove('is-pop'); void el.offsetWidth; el.classList.add('is-pop');
      var c = sess.combo;
      if (c === 3 || c === 5 || c === 8 || c === 10 || c === 15 || (c > 15 && c % 5 === 0)) {
        burst(c >= 10 ? '连对 ' + c + ' 题！了不起' : '连对 ' + c + ' 题！');
        SFX.combo(c);
      }
    } else el.classList.remove('is-on');
  }

  function addWrong(sess, item, note) {
    var p = profOf(sess);
    if (!p) return;
    var k = keyOf(item);
    sess.wrongKeys.add(k);
    var it = clone(item);
    if (it != null) { try { if (JSON.stringify(it).length > 9000) it = null; } catch (e) { it = null; } }
    var n = String(note == null ? '' : note).slice(0, 240);
    var gid = sess.game.id;
    var e = null;
    for (var i = 0; i < p.wrong.length; i++) if (p.wrong[i].k === k && p.wrong[i].g === gid) { e = p.wrong[i]; break; }
    if (e) {
      e.c = num(e.c, 1) + 1; e.ok = 0; e.t = now(); e.gr = sess.grade;
      if (n) e.n = n;
      if (it != null) e.it = it;
    } else {
      p.wrong.push({ k: k, g: gid, gr: sess.grade, n: n, it: it, c: 1, ok: 0, t: now() });
    }
    if (p.wrong.length > WRONG_MAX) {
      p.wrong.sort(function (a, b) { return a.t - b.t; });
      p.wrong.splice(0, p.wrong.length - WRONG_MAX);
    }
    touch(p);
  }

  function makeCtx(g, sess) {
    var p = profOf(sess) || curProf();
    var gradeNum = Number(sess.grade.slice(1)) || 3;
    var gid = g.id;
    var ctx = {
      el: sess.el,
      grade: sess.grade,
      gradeNum: gradeNum,
      G: gradeData(sess.grade),
      review: sess.review ? sess.review.slice() : null,
      gameId: gid,
      h: h,
      shuffle: shuffle,
      pick: function (arr, n) {
        var list = Array.isArray(arr) ? arr.filter(function (x) { return x != null; }) : [];
        if (!list.length) return [];
        n = n == null ? list.length : Math.max(0, Math.floor(num(n)));
        if (!n) return [];
        sess.picked = true;
        var pr = profOf(sess);
        var seen = (pr && Array.isArray(pr.seen[gid])) ? pr.seen[gid] : [];
        var pos = new Map();
        seen.forEach(function (k, i) { pos.set(k, i); });
        var ranked = shuffle(list).map(function (it) { var k = keyOf(it); return { it: it, k: k, r: pos.has(k) ? pos.get(k) : -1 }; });
        ranked.sort(function (a, b) { return a.r - b.r; });
        var out = ranked.slice(0, Math.min(n, ranked.length));
        out.forEach(function (x) { sess.presented.add(x.k); });
        if (pr) {
          var ks = new Set(out.map(function (x) { return x.k; }));
          var ns = seen.filter(function (k) { return !ks.has(k); });
          ks.forEach(function (k) { ns.push(k); });
          pr.seen[gid] = ns.slice(-SEEN_MAX);
          touch(pr);
        }
        return shuffle(out.map(function (x) { return x.it; }));
      },
      setProgress: function (done, total) {
        done = Math.max(0, num(done)); total = Math.max(0, num(total));
        var pct = total ? clamp(done / total * 100, 0, 100) : 0;
        if (sess.meterFill) sess.meterFill.style.width = pct.toFixed(1) + '%';
        if (sess.meter) sess.meter.setAttribute('aria-valuenow', String(Math.round(pct)));
        if (sess.countEl) sess.countEl.textContent = total ? (Math.min(done, total) + '/' + total) : '';
      },
      next: function (fn, ms) {
        if (!sess.alive || typeof fn !== 'function') return 0;
        var t = setTimeout(function () {
          sess.timers.delete(t);
          if (!sess.alive) return;
          try { fn(); } catch (e) { reportGameError(sess, e); }
        }, ms == null ? 900 : Math.max(0, num(ms)));
        sess.timers.add(t);
        return t;
      },
      alive: function () { return sess.alive; },
      tts: {
        get ok() { return TTS.ok; },
        speak: function (text, o) {
          if (!sess.alive) return Promise.resolve();
          return TTS.speak(text, Object.assign({ rate: rateFor(gradeNum) }, o || {}));
        },
        stop: function () { TTS.stop(); }
      },
      sfx: {
        good: function () { SFX.good(); }, bad: function () { SFX.bad(); }, tap: function () { SFX.tap(); },
        win: function () { SFX.win(); }, flip: function () { SFX.flip(); },
        get on() { return !!settings.sound; }   // 音效开关（街机引擎的合成音效/音乐也要看它）
      },
      kind: g.kind,
      levelHint: sess.levelHint || null,       // 街机：结算页“下一关/再玩一次”带来的建议关卡（选关界面默认选它）
      asr: {
        get ok() { return ASR.ok; },
        listen: function (o) { if (!sess.alive) return Promise.resolve(''); return ASR.listen(o); },
        stop: function () { ASR.stop(); }
      },
      ai: {
        ok: function () { return AI.ok(); },
        review: function (a) { return AI.review(a, gradeNum); }
      },
      hanzi: {
        has: function (ch) { return Hanzi.has(ch); },
        // 本局建的 writer 挂在 document 上的监听记进 sess.hzBag，endSession 统一摘掉（防每轮 15–20 个 writer 越积越多）
        create: function (el, ch, o) {
          var w = Hanzi.create(el, ch, o, sess.hzBag);
          if (!sess.alive) flushHzBag(sess);
          return w;
        }
      },
      mcq: function (o) { return mcq(o, sess); },
      score: {
        /* right(item?)：item = 这道题的题目对象（与 ctx.G / ctx.review 里的对象同一个，别改造后再传）。
           只要游戏调用 right 时带了参数（哪怕是 undefined），本局就按“点名”记错题本：只有 right(item) 点名、且本轮没再
           wrong(item) 的题才算答对一次（普通轮、重练轮都一样）；right(undefined) = 算分但不给错题本记答对。
           从不带参数调用 right() 的游戏才退回“ctx.pick 出过的题”兜底（见 recordRound）。 */
        right: function (item) {
          if (!sess.alive) return;
          if (arguments.length > 0) sess.itemAware = true;
          sess.correct++; sess.combo++;
          if (sess.combo > sess.maxCombo) sess.maxCombo = sess.combo;
          if (item != null) sess.rightKeys.add(keyOf(item));
          if (!sess.arcade) { SFX.good(); comboFx(sess); }
        },
        wrong: function (item, note) {
          if (!sess.alive) return;
          sess.wrongN++; sess.combo = 0;
          if (!sess.arcade) { SFX.bad(); comboFx(sess); }
          if (item != null) addWrong(sess, item, note);
        },
        stats: function () { return { correct: sess.correct, wrong: sess.wrongN, combo: sess.combo, maxCombo: sess.maxCombo }; }
      },
      finish: function (result) { finishSession(sess, result); },
      toast: toast,
      mem: {
        get: function (key) {
          var pr = profOf(sess), m = pr && pr.mem[gid];
          if (!isObj(m) || !has(m, String(key))) return undefined;
          return clone(m[String(key)]);
        },
        set: function (key, value) {
          var pr = profOf(sess);
          if (!pr) return false;
          var s;
          try { s = JSON.stringify(value); } catch (e) { return false; }
          var m = isObj(pr.mem[gid]) ? pr.mem[gid] : (pr.mem[gid] = {});
          key = String(key);
          if (s === undefined) { delete m[key]; touch(pr); return true; }
          if (s.length > 4000) { try { console.warn('[HW] mem.set: value too large', key); } catch (e) { /* ignore */ } return false; }
          if (!has(m, key) && Object.keys(m).length >= 40) return false;
          m[key] = JSON.parse(s);
          touch(pr);
          return true;
        }
      },
      profile: Object.freeze({ name: p.name, avatar: p.avatar })
    };
    return ctx;
  }

  function startGame(id, reviewEntries, opt) {
    var g = games[id];
    if (!g) return;
    if (S && S.alive) endSession(S);
    if (ui.view === 'map') ui.mapScroll = W.scrollY || 0;
    var p = curProf();
    var review = null;
    if (reviewEntries && reviewEntries.length) review = reviewEntries.filter(function (e) { return e.it != null; });
    if (review && !review.length) review = null;
    var arcade = isArcade(g);
    var el = h('div', { class: arcade ? 'hw-arcbody' : 'hw-playbody', id: 'hw-play' });
    var fill = h('span');
    var meter = h('div', { class: 'hw-meter hw-playmeter', role: 'progressbar', 'aria-label': '进度', 'aria-valuemin': '0', 'aria-valuemax': '100', 'aria-valuenow': '0' }, fill);
    var countEl = h('span', { class: 'hw-playcount' });
    var comboEl = h('span', { class: 'hw-combo', 'aria-live': 'polite' });
    var exitBtn = h('button', { class: 'hw-btn ghost hw-exit', id: 'hw-exit', type: 'button' }, EXIT_LABEL);
    var bar = arcade
      ? h('div', { class: 'hw-arcbar', 'data-s': g.skill },
          exitBtn,
          h('div', { class: 'hw-arcname' }, h('span', { 'aria-hidden': 'true' }, g.icon || ''), h('span', null, g.name), review ? h('span', { class: 'hw-tag' }, '错题重练') : null))
      : h('div', { class: 'hw-playbar', style: '--zc:var(--' + g.skill + ')' },
      exitBtn,
      h('div', { class: 'hw-playname' }, h('span', { 'aria-hidden': 'true' }, g.icon || ''), h('span', null, g.name), review ? h('span', { class: 'hw-tag accent' }, '错题重练') : null),
      meter, countEl, comboEl);
    var sess = {
      id: ++sessSeq, game: g, pid: p.id, grade: p.grade, el: el,
      meter: arcade ? null : meter, meterFill: arcade ? null : fill, countEl: arcade ? null : countEl, comboEl: arcade ? null : comboEl,
      arcade: arcade, arc0: arcade ? (function (a) { return a.raw ? a : null; })(arcOf(p, g.id)) : null,
      levelHint: opt && Number(opt.level) >= 1 ? Math.floor(Number(opt.level)) : null,
      alive: true, timers: new Set(), cleanup: null, correct: 0, wrongN: 0, combo: 0, maxCombo: 0,
      presented: new Set(), picked: false, rightKeys: new Set(), wrongKeys: new Set(), itemAware: false, hzBag: [],
      review: review ? review.map(function (e) { return clone(e.it); }) : null,
      reviewKeys: review ? new Set(review.map(function (e) { return e.k; })) : null,
      t0: now()
    };
    S = sess;
    ui.view = 'game';
    setView(arcade ? 'arcade' : 'game');
    exitBtn.addEventListener('click', function () { requestExit(sess, exitBtn); });
    main.replaceChildren(arcade ? h('div', { class: 'hw-arcshell hw-play' }, bar, el) : h('div', { class: 'hw-shell hw-play' }, bar, el));
    try { W.scrollTo(0, 0); } catch (e) { /* ignore */ }
    var ctx = makeCtx(g, sess);
    var r;
    try { r = g.start(ctx); } catch (e) { reportGameError(sess, e); return; }
    if (typeof r === 'function') {
      if (sess.alive) sess.cleanup = r; else { try { r(); } catch (e) { /* ignore */ } }
    } else if (r && typeof r.then === 'function') {
      r.then(function (fn) {
        if (typeof fn !== 'function') return;
        if (sess.alive) sess.cleanup = fn; else { try { fn(); } catch (e) { /* ignore */ } }
      }, function (e) { reportGameError(sess, e); });
    }
  }
  function reviewCap(g) {
    var n = Math.floor(num(g && g.reviewN, 0));
    if (n >= 1) return Math.min(n, REVIEW_MAX);
    return REVIEW_N[g.id] || REVIEW_MAX;
  }
  function startReview(id) {
    var p = curProf();
    var g = games[id];
    if (!g) { toast('这个游戏现在打不开'); return; }
    // 只把游戏一轮真会出的题数交给它：游戏会 slice(0, n)，多给的题没出现却会被记“答对一次”
    var list = p.wrong.filter(function (w) { return w.g === id && w.it != null; }).sort(function (a, b) { return b.t - a.t; }).slice(0, reviewCap(g));
    if (!list.length) { toast('这个游戏没有可以重练的题'); return; }
    var needs = g.needs || [];
    if (needs.indexOf('tts') >= 0 && !TTS.ok) { toast('需要中文朗读声音才能重练'); return; }
    if (needs.indexOf('hanzi') >= 0 && !Hanzi.ready()) { toast('笔顺数据没有加载'); return; }
    startGame(id, list);
  }
  function endSession(sess) {
    if (!sess.alive) return;
    sess.alive = false;
    sess.timers.forEach(function (t) { clearTimeout(t); });
    sess.timers.clear();
    TTS.stop(); ASR.stop();
    var fn = sess.cleanup; sess.cleanup = null;
    if (typeof fn === 'function') { try { fn(); } catch (e) { try { console.error(e); } catch (x) { /* ignore */ } } }
    flushHzBag(sess);
  }
  function flushHzBag(sess) {
    var bag = sess.hzBag || [];
    while (bag.length) { var f = bag.pop(); try { f(); } catch (e) { /* ignore */ } }
  }
  var EXIT_LABEL = '← 退出';
  function requestExit(sess, btn) {
    if (!sess.alive) { goMap(); return; }
    if (sess.correct + sess.wrongN === 0 || btn.classList.contains('is-armed')) { endSession(sess); goMap(); return; }
    btn.classList.add('is-armed');
    btn.textContent = '再点一次退出';
    setTimeout(function () { if (btn.isConnected) { btn.classList.remove('is-armed'); btn.textContent = EXIT_LABEL; } }, 2600);
  }
  function reportGameError(sess, e) {
    try { console.error('[HW] game error', sess && sess.game && sess.game.id, e); } catch (x) { /* ignore */ }
    if (!sess || !sess.alive) return;
    endSession(sess);
    sess.el.replaceChildren(h('div', { class: 'hw-card hw-stack hw-center hw-error' },
      h('p', { class: 'hw-q' }, '这个游戏出了点小问题。'),
      h('p', { class: 'hw-muted' }, '先玩别的游戏吧，这一轮不会扣分。'),
      h('button', { class: 'hw-btn primary', type: 'button', id: 'hw-err-home', on: { click: goMap } }, '回到地图')));
    if (sess.arcade) sess.el.style.height = 'auto';
  }

  function recordRound(sess, result) {
    var p = profOf(sess);
    var g = sess.game;
    var stars = null, correct = null, total = null;
    if (isObj(result)) {
      if (result.stars != null && Number.isFinite(Number(result.stars))) stars = clamp(Math.round(Number(result.stars)), 0, 3);
      if (Number.isFinite(Number(result.correct)) && Number.isFinite(Number(result.total)) && result.total != null && result.correct != null) {
        correct = Math.max(0, Math.round(Number(result.correct)));
        total = Math.max(0, Math.round(Number(result.total)));
        if (correct > total) total = correct;
      }
    }
    if (correct == null && sess.correct + sess.wrongN > 0) { correct = sess.correct; total = sess.correct + sess.wrongN; }
    if (stars == null) stars = total ? starsFor(correct / total) : 1;
    var out = { stars: stars, correct: correct, total: total, maxCombo: sess.maxCombo, newStamps: [], dayBonus: false, cleared: 0, daily: null, level: null, score: null, win: null };
    if (isObj(result)) {
      var lvR = num(result.level != null ? result.level : result.lv, 0);
      if (lvR >= 1) out.level = Math.floor(lvR);
      if (result.score != null && Number.isFinite(Number(result.score))) out.score = Math.max(0, Math.round(Number(result.score)));
      if (typeof result.win === 'boolean') out.win = result.win;
    }
    if (!p) return out;
    var today = todayStr();
    var daily = ensureDaily(p);
    var wasAll = SKILL_IDS.every(function (s) { return daily.done[s]; });
    p.flowers += stars;
    var sk = p.skills[g.skill]; sk.rounds += 1; sk.stars += stars;
    var gs = p.games[g.id] || (p.games[g.id] = { rounds: 0, stars: 0, best: 0, last: '' });
    gs.rounds += 1; gs.stars += stars; gs.best = Math.max(gs.best, stars); gs.last = today;
    daily.done[g.skill] = true;
    if (!wasAll && SKILL_IDS.every(function (s) { return daily.done[s]; })) {
      if (p.days.indexOf(today) < 0) p.days.push(today);
      p.days = p.days.slice(-400);
      p.flowers += 2;
      out.dayBonus = true;
    }
    if (sess.maxCombo > p.maxCombo) p.maxCombo = sess.maxCombo;
    p.log.push({ t: now(), g: g.id, gr: sess.grade, s: stars, c: correct, n: total, rv: sess.review ? 1 : 0 });
    if (p.log.length > LOG_MAX) p.log = p.log.slice(-LOG_MAX);
    // 错题本记账（本轮 wrong(item) 过的题一律不记，见下方循环）：
    // 1) 游戏按点名计分（right 带过参数）：只认 right(item) 点名的题 +1——被游戏过滤掉没出的题、改了一次才对的题都不算；
    // 2) 老式游戏 right() 从不带题：重练时退回“ctx.pick 出过的题”+1；
    //    连 ctx.pick 都没走，就不知道哪些题真出过——只有整轮零错、答对数不少于交给它的题数时才给这些题记一次。
    var credit = new Set();
    sess.rightKeys.forEach(function (k) { credit.add(k); });
    if (sess.review && !sess.itemAware) {
      if (sess.picked) sess.reviewKeys.forEach(function (k) { if (sess.presented.has(k)) credit.add(k); });
      else if (sess.wrongN === 0 && sess.correct >= sess.reviewKeys.size) sess.reviewKeys.forEach(function (k) { credit.add(k); });
    }
    if (credit.size) {
      var keepList = [];
      p.wrong.forEach(function (w) {
        if (w.g === g.id && credit.has(w.k) && !sess.wrongKeys.has(w.k)) {
          w.ok = num(w.ok) + 1;
          if (w.ok >= 2) { out.cleared++; return; }
        }
        keepList.push(w);
      });
      p.wrong = keepList;
      p.cleared += out.cleared;
    }
    out.newStamps = checkStamps(p);
    out.daily = { done: Object.assign({}, daily.done) };
    touch(p);
    return out;
  }
  function finishSession(sess, result) {
    if (!sess.alive) return;
    endSession(sess);
    var out = recordRound(sess, result);
    renderResult(sess, out);
  }

  /* ================= 视图：结算页（游戏化） ================= */
  function rollNum(el, from, to, delay, dur) {
    from = Math.round(num(from)); to = Math.round(num(to));
    el.textContent = String(reduceMotion() ? to : from);
    if (reduceMotion() || from === to) { el.textContent = String(to); return; }
    setTimeout(function () {
      var t0 = 0;
      function step(t) {
        if (!el.isConnected) return;
        if (!t0) t0 = t;
        var k = clamp((t - t0) / dur, 0, 1), e = 1 - Math.pow(1 - k, 3);
        el.textContent = String(Math.round(from + (to - from) * e));
        if (k < 1) requestAnimationFrame(step);
      }
      requestAnimationFrame(step);
    }, delay);
  }
  function renderResult(sess, out) {
    ui.view = 'result';
    setView('result');
    var p = profOf(sess) || curProf();
    var g = sess.game;
    var arc = !!sess.arcade;
    var titles = ['再接再厉', '有进步！', '真不错！', '太棒了！'];
    var cheer = ['别灰心，再来一次！', '有进步，继续加油！', '真不错！', '太棒了！'][out.stars];
    var stars = h('div', { class: 'hw-bigstars', role: 'img', 'aria-label': '得到 ' + out.stars + ' 颗星' }, [0, 1, 2].map(function (i) {
      var on = i < out.stars;
      return h('span', { class: 'hw-bstar' + (on ? ' on' : ''), style: '--d:' + (0.35 + i * 0.35).toFixed(2) + 's' },
        starSvg(false), on ? h('span', { class: 'on-l' }, starSvg(true)) : null);
    }));
    // 街机：第 N 关 · 得分 · 最高分 · 解锁（读 result 与 profile.mem[gid].arc 的前后对比）
    var arcBlock = null, unlockEl = null, nextLv = null, lost = false;
    if (arc) {
      var a0 = sess.arc0, a1 = arcOf(p, g.id);
      // 引擎每局结束会重写 mem.arc（新对象）并带 last = {lv, score, stars, win, unlocked}；对象没换 = 本局没存档，last 是旧的不能用
      var fresh = !!a1.raw && (!a0 || a1.raw !== a0.raw);
      var last = fresh && isObj(a1.raw.last) ? a1.raw.last : null;
      var lv0 = a0 ? a0.lv : 1, hi0 = a0 ? a0.hi : 0;
      var unlocked = last && num(last.unlocked) >= 2 ? Math.floor(num(last.unlocked)) : (fresh && a1.lv > lv0 ? a1.lv : 0);
      var level = out.level || (last && num(last.lv) >= 1 ? Math.floor(num(last.lv)) : (unlocked ? unlocked - 1 : null));
      var newHi = a1.hi > hi0 && a1.hi > 0;
      var score = out.score != null ? out.score : (last && last.score != null && Number.isFinite(Number(last.score)) ? Math.max(0, Math.round(Number(last.score))) : (newHi ? a1.hi : null));
      lost = out.win === false || (!!last && last.win === false);
      var hi = Math.max(a1.hi, score || 0);
      nextLv = unlocked || level || null;
      var tile = function (k, v, extra) { return h('div', { class: 'hw-rstat' }, h('span', { class: 'k' }, k), v, extra || null); };
      var scoreV = h('span', { class: 'v' }, '0');
      var hiV = h('span', { class: 'v' }, String(hi0 && newHi ? hi0 : hi));
      arcBlock = h('div', { class: 'hw-rstats' },
        tile('关卡', h('span', { class: 'v' }, level ? '第' + level + '关' : '–')),
        tile('得分', score != null ? scoreV : h('span', { class: 'v' }, '–')),
        tile('最高分', hiV, newHi ? h('span', { class: 'rec' }, '新纪录') : null));
      if (score != null) rollNum(scoreV, 0, score, 700, 900);
      if (newHi && hi0) rollNum(hiV, hi0, hi, 1500, 600);
      if (unlocked) unlockEl = h('p', { class: 'hw-unlock' }, h('span', { class: 'ic', 'aria-hidden': 'true' }, '🔓'), '第 ' + unlocked + ' 关已解锁！');
    }
    var gained = out.stars + (out.dayBonus ? 2 : 0);
    var totEl = h('b', { class: 'tot' }, String(p.flowers));
    var coinRow = out.stars
      ? h('div', { class: 'hw-coinrow', role: 'img', 'aria-label': '得到 ' + out.stars + ' 朵小红花，一共 ' + p.flowers + ' 朵' },
          h('span', { class: 'hw-coin', 'aria-hidden': 'true' }, flowerSvg(26)),
          h('span', { class: 'plus', 'aria-hidden': 'true' }, '+' + out.stars),
          h('span', { 'aria-hidden': 'true' }, '小红花 共'), totEl, h('span', { 'aria-hidden': 'true' }, '朵'))
      : h('p', { class: 'hw-muted' }, '这一轮没有拿到小红花，下一轮一定行！');
    if (out.stars) rollNum(totEl, p.flowers - gained, p.flowers, 1250, 800);
    var dailyLine = null;
    if (out.dayBonus) {
      dailyLine = h('div', { class: 'hw-result-bonus hw-row hw-center' }, dateSeal(todayStr()), h('span', null, '今日四件事全部完成！再奖 2 朵小红花。'));
    } else if (out.daily) {
      var doneS = SKILLS.filter(function (s) { return out.daily.done[s.id]; }).map(function (s) { return s.ch; });
      var left = SKILLS.filter(function (s) { return !out.daily.done[s.id]; }).map(function (s) { return s.ch; });
      if (left.length) dailyLine = h('p', { class: 'hw-muted' }, '今日四件事：' + doneS.join('、') + ' 已完成，还差 ' + left.join('、') + '。');
    }
    var againText = sess.review ? '再练错题' : (arc ? (unlockEl ? '下一关 ▶' : (lost ? '再试一次' : '再玩一次')) : '再来一轮');
    var again = h('button', { class: 'hw-btn primary big', type: 'button', id: 'hw-again' }, againText);
    again.addEventListener('click', function () {
      if (sess.review) {
        var pr = curProf();
        if (pr.wrong.some(function (w) { return w.g === g.id && w.it != null; })) { startReview(g.id); return; }
      }
      startGame(g.id, null, arc ? { level: nextLv } : null);
    });
    var card = h('section', { class: 'hw-result', 'aria-labelledby': 'hw-result-h' },
      h('div', { class: 'hw-ribbon' + (out.stars && !lost ? '' : ' lose') }, h('h2', { id: 'hw-result-h' }, lost ? '差一点点！' : titles[out.stars])),
      h('p', { class: 'hw-result-k' }, (g.icon ? g.icon + ' ' : '') + g.name + ' · ' + sess.grade.toUpperCase() + (sess.review ? ' · 错题重练' : '')),
      h('p', { class: 'hw-result-who' }, p.name + '，' + cheer),
      stars,
      arcBlock,
      unlockEl,
      out.total != null ? h('p', { class: 'hw-result-line' }, '答对 ' + out.correct + ' / ' + out.total + (out.maxCombo >= 3 ? ' · 最多连对 ' + out.maxCombo + ' 题' : '')) : null,
      coinRow,
      dailyLine,
      out.cleared ? h('p', { class: 'hw-result-line' }, '错题本里消灭了 ' + out.cleared + ' 道题！') : null,
      out.newStamps.length ? h('div', { class: 'hw-stack hw-center' },
        h('h3', { class: 'hw-kai' }, '得到新印章！'),
        h('div', { class: 'hw-newstamps' }, out.newStamps.map(function (s) {
          return h('div', { class: 'hw-newstamp' }, stampEl(s, { size: 84, fresh: true }), h('span', null, s.need));
        }))) : null,
      h('div', { class: 'hw-result-btns' }, again,
        h('button', { class: 'hw-btn big', type: 'button', id: 'hw-home', on: { click: goMap } }, '回到地图')));
    main.replaceChildren(h('div', { class: 'hw-resview' }, card));
    try { W.scrollTo(0, 0); } catch (e) { /* ignore */ }
    try { again.focus({ preventScroll: true }); } catch (e) { /* ignore */ }
    var mine = sess;
    [0, 1, 2].forEach(function (i) {
      if (i >= out.stars) return;
      setTimeout(function () { if (ui.view === 'result' && card.isConnected) SFX.star(i); }, (0.35 + i * 0.35) * 1000 + 120);
    });
    setTimeout(function () {
      if (!card.isConnected || S !== mine) return;
      if (out.stars >= 1) SFX.win(); else SFX.flip();
      if (out.stars >= 2 || out.dayBonus || unlockEl) confetti();
    }, out.stars ? 1250 : 300);
    if (out.newStamps.length || out.dayBonus) setTimeout(function () { if (card.isConnected) SFX.stamp(); }, 1700);
  }

  /* ================= 岛上的画（装饰用 SVG，aria-hidden；颜色全走 CSS token） ================= */
  var ART = {
    lighthouse: '<svg viewBox="0 0 120 150"><g class="a-beam"><path class="k-beam nk" d="M60 34L126 12L126 56Z"/></g>' +
      '<ellipse class="k-rock" cx="60" cy="140" rx="38" ry="9"/><path class="k-rock" d="M30 140Q34 126 46 128H74Q86 126 90 140Z"/>' +
      '<path class="k-tower" d="M44 136L50 52H70L76 136Z"/><path class="k-stripe" d="M45.4 116H74.6L73.2 96H46.8Z"/><path class="k-stripe" d="M48.3 76H71.7L70.8 63H49.2Z"/>' +
      '<rect class="k-door" x="55" y="120" width="10" height="16" rx="5"/><rect class="k-edge" x="44" y="46" width="32" height="7" rx="2"/>' +
      '<rect class="k-glass" x="51" y="27" width="18" height="19" rx="2"/><path class="k-line" d="M60 27V46"/>' +
      '<path class="k-roof" d="M46 28Q60 8 74 28Z"/><circle class="k-roof" cx="60" cy="12" r="3.5"/></svg>',
    stage: '<svg viewBox="0 0 130 150"><rect class="k-backdrop" x="16" y="40" width="98" height="80" rx="3"/>' +
      '<path class="k-spot nk a-spotL" d="M40 46L26 118H62Z"/><path class="k-spot nk a-spotR" d="M90 46L68 118H104Z"/>' +
      '<path class="k-curtain" d="M16 40H44Q36 80 42 120H16Z"/><path class="k-curtain" d="M114 40H86Q94 80 88 120H114Z"/>' +
      '<path class="k-curtain2" d="M12 32H118V44Q111.4 52 104.75 44Q98.1 52 91.5 44Q84.9 52 78.25 44Q71.6 52 65 44Q58.4 52 51.75 44Q45.1 52 38.5 44Q31.9 52 25.25 44Q18.6 52 12 44Z"/>' +
      '<path class="k-wood" d="M4 118H126L120 134H10Z"/><rect class="k-wood2" x="10" y="134" width="110" height="10" rx="2"/>' +
      '<path class="k-line" d="M65 118V90"/><rect class="k-edge" x="58" y="115" width="14" height="4" rx="2"/><circle class="k-mic" cx="65" cy="84" r="7"/>' +
      '<circle class="k-glass" cx="40" cy="47" r="5"/><circle class="k-glass" cx="90" cy="47" r="5"/><text class="k-note a-note" x="96" y="30">♪</text><text class="k-note a-note n2" x="20" y="34">♫</text></svg>',
    booktree: '<svg viewBox="0 0 130 150"><path class="k-trunk" d="M56 146C58 124 56 106 48 94L56 90C62 100 64 96 70 84L78 88C72 100 70 120 74 146Z"/>' +
      '<circle class="k-leaf2" cx="36" cy="64" r="26"/><circle class="k-leaf2" cx="94" cy="62" r="26"/><circle class="k-leaf1" cx="64" cy="46" r="34"/>' +
      '<circle class="k-leaf1" cx="40" cy="46" r="18"/><circle class="k-leaf1" cx="90" cy="44" r="18"/>' +
      '<g transform="translate(34 70) rotate(-14)"><rect class="k-b1" x="-7" y="-9" width="14" height="18" rx="2"/><path class="k-line" d="M-3 -9V9"/></g>' +
      '<g transform="translate(94 70) rotate(12)"><rect class="k-b2" x="-7" y="-9" width="14" height="18" rx="2"/><path class="k-line" d="M-3 -9V9"/></g>' +
      '<g transform="translate(64 66) rotate(4)"><rect class="k-b3" x="-7" y="-9" width="14" height="18" rx="2"/><path class="k-line" d="M-3 -9V9"/></g>' +
      '<path class="k-page" d="M48 22Q56 16 64 22Q72 16 80 22V36Q72 30 64 36Q56 30 48 36Z"/><path class="k-line" d="M64 22V36"/>' +
      '<g class="a-page"><rect class="k-page" x="96" y="22" width="10" height="12" rx="1"/></g></svg>',
    brushmount: '<svg viewBox="0 0 140 150"><path class="k-m2" d="M2 146L40 62L60 90L86 36L138 146Z"/><path class="k-snow" d="M86 36L75 58L82 55L88 63L94 54L99 58Z"/>' +
      '<path class="k-m1" d="M8 146Q36 98 68 112Q100 98 132 146Z"/>' +
      '<g transform="rotate(-8 39 118)"><rect class="k-seal" x="28" y="106" width="22" height="22" rx="3"/><text class="k-sealt" x="39" y="123" text-anchor="middle">写</text></g>' +
      '<g transform="rotate(22 112 96)"><rect class="k-bamboo" x="106" y="14" width="11" height="80" rx="4"/><path class="k-line" d="M106 40H117M106 66H117"/>' +
      '<rect class="k-edge" x="104" y="92" width="15" height="8" rx="2"/><path class="k-bristle" d="M104 100Q104 124 111.5 138Q119 124 119 100Z"/></g>' +
      '<g class="a-cloud"><path class="k-cloud" d="M40 40Q40 30 50 32Q54 24 62 30Q70 28 70 36Q76 38 72 44H42Q36 44 40 40Z"/></g></svg>',
    palm: '<svg viewBox="0 0 80 110"><path class="k-trunk" d="M36 108C34 82 38 58 47 34L54 36C47 60 44 84 47 108Z"/>' +
      '<path class="k-line" d="M36 96H46M37 82H46M39 68H48M42 54H50"/><g class="a-sway">' +
      '<path class="k-leaf2" d="M51 33C36 18 15 20 3 34C17 28 34 30 51 37Z"/><path class="k-leaf2" d="M51 33C64 28 77 38 79 53C70 43 60 39 52 37Z"/>' +
      '<path class="k-leaf1" d="M51 33C58 14 75 11 80 21C70 19 61 25 52 37Z"/><path class="k-leaf1" d="M51 33C40 27 26 37 22 53C32 41 42 37 52 37Z"/>' +
      '<path class="k-leaf1" d="M51 33C46 18 50 6 60 2C56 12 56 22 53 35Z"/><circle class="k-coco" cx="47" cy="39" r="4.5"/><circle class="k-coco" cx="55" cy="40" r="4.5"/></g></svg>',
    junk: '<svg viewBox="0 0 90 72"><path class="k-line" d="M44 50V6"/><path class="k-sail" d="M46 8C62 12 70 24 72 46H46Z"/><path class="k-line" d="M46 18H62M46 27H67M46 36H70"/>' +
      '<path class="k-sail2" d="M42 14C30 18 24 30 22 46H42Z"/><path class="k-line" d="M42 24H30M42 34H25"/><path class="k-flag" d="M44 5L56 8L44 12Z"/>' +
      '<path class="k-hull" d="M2 46Q8 48 16 50H76Q84 48 88 44L80 64H14Z"/><path class="k-line" d="M12 56H82"/></svg>',
    fish: '<svg viewBox="0 0 44 30"><path class="k-fin" d="M8 15L0 5V25Z"/><ellipse class="k-fish" cx="24" cy="15" rx="16" ry="10"/><path class="k-fin" d="M22 6Q26 0 32 6Z"/><circle class="k-eye" cx="32" cy="12" r="2.2"/></svg>',
    gull: '<svg viewBox="0 0 40 22"><path d="M2 14Q11 2 20 14Q29 2 38 14"/></svg>',
    skyline: '<svg viewBox="0 0 400 84" preserveAspectRatio="xMidYMax meet">' +
      '<rect class="k-sil" x="8" y="34" width="30" height="50"/><path class="k-win" d="M13 42H34M13 50H34M13 58H34M13 66H34M13 74H34"/>' +
      '<rect class="k-sil2" x="42" y="46" width="26" height="38"/><path class="k-win" d="M46 54H64M46 62H64M46 70H64"/>' +
      '<rect class="k-sil" x="72" y="26" width="28" height="58"/><path class="k-win" d="M77 34H96M77 42H96M77 50H96M77 58H96M77 66H96M77 74H96"/>' +
      '<path class="k-sil2" d="M114 84V66H110L118 60H112L122 52H116L125 44L134 52H128L138 60H132L140 66H136V84Z"/>' +
      '<g class="a-wheel"><circle class="k-silring" cx="170" cy="44" r="24"/><path class="k-silring" d="M170 20V68M146 44H194M153 27L187 61M187 27L153 61"/></g>' +
      '<path class="k-sil" d="M160 84L170 44L180 84Z"/>' +
      '<path class="k-sil" d="M232 84L234 34H246L248 84Z"/><path class="k-sil" d="M258 84L260 34H272L274 84Z"/><path class="k-sil" d="M284 84L286 34H298L300 84Z"/>' +
      '<path class="k-sil2" d="M226 30L312 28L322 32L226 35Z"/><path class="k-win" d="M240 42V80M266 42V80M292 42V80"/>' +
      '<path class="k-sil2" d="M338 84L341 56L330 48H356L345 56L348 84Z"/><path class="k-sil" d="M362 84L365 46L352 36H384L371 46L374 84Z"/>' +
      '<path class="k-sil2" d="M388 84L390 60L381 54H401L394 60L396 84Z"/><rect class="k-sil" x="0" y="80" width="400" height="4"/></svg>'
  };
  function artEl(name, cls, style) {
    var s = h('span', { class: 'hw-art ' + (cls || ''), 'aria-hidden': 'true', style: style || null });
    s.innerHTML = ART[name] || '';
    return s;
  }

  /* ================= 视图：首页游戏岛地图 ================= */
  function setView(v) { try { D.documentElement.setAttribute('data-hw-view', v); } catch (e) { /* ignore */ } }
  function goMap() {
    if (S && S.alive) endSession(S);
    var back = ui.view !== 'map';
    ui.view = 'map'; ui.editing = null;
    renderMap();
    try { W.scrollTo(0, back ? (ui.mapScroll || 0) : 0); } catch (e) { /* ignore */ }
  }
  function leaveMap() { if (ui.view === 'map') ui.mapScroll = W.scrollY || 0; }
  function setGrade(gr) {
    var p = curProf();
    if (p.grade === gr) return;
    p.grade = gr; touch(p);
    SFX.tap();
    keepPlace(renderMap);
    var b = D.getElementById('hw-grade-' + gr);
    if (b) try { b.focus({ preventScroll: true }); } catch (e) { /* ignore */ }
  }
  function toggleSound() {
    settings.sound = !settings.sound;
    LS.set('settings', settings);
    if (settings.sound) SFX.tap();
    var b = D.getElementById('hw-sound');
    if (b) {
      b.textContent = settings.sound ? '🔊' : '🔈';
      b.setAttribute('aria-label', settings.sound ? '关掉音效' : '打开音效');
      b.setAttribute('title', settings.sound ? '关掉音效' : '打开音效');
    }
  }
  function scrollToZone(id) {
    var z = D.getElementById('hw-zone-' + id);
    if (!z) return;
    try { z.scrollIntoView({ behavior: reduceMotion() ? 'auto' : 'smooth', block: 'start' }); } catch (e) { z.scrollIntoView(); }
    var c = z.querySelector('.hw-lv:not([aria-disabled]), .hw-gcard:not([aria-disabled])');
    if (c) try { c.focus({ preventScroll: true }); } catch (e) { /* ignore */ }
  }
  var ISLE = {
    listen: { name: '灯塔岛', mark: 'lighthouse' },
    speak: { name: '舞台岛', mark: 'stage' },
    read: { name: '书树岛', mark: 'booktree' },
    write: { name: '毛笔山岛', mark: 'brushmount' }
  };
  var SHORT_WHY = { '题目准备中': '准备中', '需要中文朗读声音': '要朗读声音', '这个浏览器不能朗读': '不能朗读', '笔顺数据没有加载': '缺笔顺' };
  function stampCount(p) { return STAMPS.filter(function (s) { return p.stamps[s.id]; }).length; }
  function hudEl(p) {
    var got = stampCount(p);
    return h('header', { class: 'hw-hud' },
      h('button', { class: 'hw-me', id: 'hw-who', type: 'button', 'aria-label': '现在是' + p.name + '，点这里换人或改名', on: { click: function () { leaveMap(); renderProfiles(); } } },
        h('span', { class: 'hw-me-av', 'aria-hidden': 'true' }, p.avatar),
        h('span', { class: 'hw-me-nm', 'aria-hidden': 'true' }, h('b', null, p.name), h('small', null, '换人 / 改名'))),
      h('span', { class: 'hw-pill', id: 'hw-coins', role: 'img', title: '小红花', 'aria-label': '小红花 ' + p.flowers + ' 朵' },
        h('span', { class: 'hw-coin', 'aria-hidden': 'true' }, flowerSvg(19)), h('b', { 'aria-hidden': 'true' }, String(p.flowers))),
      h('button', { class: 'hw-pill', id: 'hw-seals', type: 'button', title: '印章册', 'aria-label': '印章 ' + got + ' 枚，打开印章册', on: { click: function () { leaveMap(); renderStamps(); } } },
        stampEl({ t: '印', shape: 'square' }, { size: 26, tiny: true, rot: -8 }), h('b', { 'aria-hidden': 'true' }, String(got))),
      h('button', { class: 'hw-hudbtn', id: 'hw-sound', type: 'button', title: settings.sound ? '关掉音效' : '打开音效', 'aria-label': settings.sound ? '关掉音效' : '打开音效', on: { click: toggleSound } }, settings.sound ? '🔊' : '🔈'));
  }
  function skyEl() {
    var clouds = [[14, 0.62, 70, -8, '30vw'], [52, 0.9, 54, -30, '62vw'], [30, 0.5, 84, -52, '8vw'], [66, 0.7, 64, -44, '78vw']];
    var gulls = [[26, 22, -3, '40vw'], [38, 30, -16, '70vw'], [18, 26, -11, '18vw']];
    var lans = [[8, 4, 0], [26, 14, -0.8], [74, 14, -0.4], [92, 4, -1.2]];
    return h('div', { class: 'hw-sky', 'aria-hidden': 'true' },
      h('div', { class: 'hw-starfield' }),
      [[8, 22, 0], [24, 58, -0.8], [62, 18, -1.5], [80, 50, -0.4], [44, 40, -1.9]].map(function (t) {
        return h('span', { class: 'hw-twinkle', style: 'left:' + t[0] + '%;top:' + t[1] + '%;animation-delay:' + t[2] + 's' });
      }),
      h('span', { class: 'hw-sun' }), h('span', { class: 'hw-moon' }),
      clouds.map(function (c) {
        return h('span', { class: 'hw-cloud', style: 'top:' + c[0] + '%;--dur:' + c[2] + 's;--d:' + c[3] + 's;--rx:' + c[4] + ';transform-origin:0 0;scale:' + c[1] });
      }),
      gulls.map(function (g) {
        return h('span', { class: 'hw-gull', style: 'top:' + g[0] + '%;--dur:' + g[1] + 's;--d:' + g[2] + 's;--rx:' + g[3] }, artEl('gull', '', 'display:contents'));
      }),
      h('div', { class: 'hw-lanterns' }, lans.map(function (l) {
        return h('span', { class: 'hw-lan', style: '--x:' + l[0] + '%;--y:' + l[1] + 'px;--d:' + l[2] + 's' });
      })));
  }
  function heroEl(p) {
    return h('div', { class: 'hw-hero' },
      skyEl(),
      h('h1', { class: 'hw-logo', 'aria-label': '华文小岛' }, Array.from('华文小岛').map(function (ch, i) { return h('span', { style: '--i:' + i, 'aria-hidden': 'true' }, ch); })),
      h('div', null, h('p', { class: 'hw-tagline' }, '听 · 说 · 读 · 写 大冒险')),
      h('div', { class: 'hw-hero-row' },
        h('div', { class: 'hw-grades', role: 'radiogroup', 'aria-label': '年级' },
          GRADES.map(function (gr) {
            return h('button', { type: 'button', role: 'radio', class: 'hw-gradebtn', id: 'hw-grade-' + gr, 'aria-checked': String(gr === p.grade), on: { click: function () { setGrade(gr); } } }, gr.toUpperCase());
          })),
        h('p', { class: 'hw-gradenote' }, GRADE_NOTE[p.grade])),
      artEl('skyline', 'hw-skyline'),
      h('div', { class: 'hw-shore', 'aria-hidden': 'true' }));
  }
  function questEl(p) {
    var d = ensureDaily(p).done;
    var n = SKILLS.filter(function (s) { return d[s.id]; }).length;
    return h('section', { class: 'hw-quest', 'aria-labelledby': 'hw-today-h' },
      h('div', { class: 'hw-quest-plate' }, h('h2', { id: 'hw-today-h' }, '今日四件事'), h('span', { class: 'n' }, n + '/4')),
      h('div', { class: 'hw-quest-row' },
        SKILLS.map(function (s) {
          return h('button', { type: 'button', class: 'hw-qslot' + (d[s.id] ? ' is-done' : ''), 'data-s': s.id, id: 'hw-today-' + s.id, 'aria-label': s.name + (d[s.id] ? '，今天已完成' : '，今天还没玩') + '，去' + ISLE[s.id].name, on: { click: function () { scrollToZone(s.id); } } },
            h('span', { class: 'hw-qslot-ch', 'aria-hidden': 'true' }, s.ch),
            h('span', { class: 'hw-qslot-l', 'aria-hidden': 'true' }, s.name),
            d[s.id] ? stampEl({ t: '完成', shape: 'round' }, { size: 38, tiny: true, rot: -14 }) : null);
        }),
        h('span', { class: 'hw-chest' + (n === 3 ? ' is-near' : ''), 'aria-hidden': 'true' }, n === 4 ? dateSeal(todayStr()) : '🎁')),
      h('div', { class: 'hw-quest-bar', 'aria-hidden': 'true' }, h('span', { style: 'width:' + (n * 25) + '%' })),
      h('p', { class: 'hw-todaynote' }, n === 4 ? '四件事都做完了，章已经盖好！明天再来。' : '听说读写各玩一轮，就能盖章，再奖 2 朵小红花！'));
  }
  function hintEl() {
    var st = TTS.status();
    if (st === 'ok') return null;
    var msg = st === 'none'
      ? '这个浏览器不能朗读中文，听力游戏暂时玩不了。可以换用 Safari 或 Chrome。'
      : '这台设备还没有中文朗读声音，听力游戏会受影响。iPhone / iPad：设置 → 辅助功能 → 朗读内容 → 声音 → 中文（普通话）。';
    return h('p', { class: 'hw-hint', id: 'hw-tts-hint', role: 'note' }, msg);
  }
  /* arcade 游戏的关卡进度：引擎存在 profile.mem[gid].arc = {lv, best:{关号:星}, hi} */
  function arcOf(p, gid) {
    var m = p && isObj(p.mem[gid]) ? p.mem[gid].arc : null;
    if (!isObj(m)) return { lv: 1, best: 0, hi: 0, played: false, raw: null };
    var best = 0, nb = 0;
    if (isObj(m.best)) for (var k in m.best) { nb++; best = Math.max(best, clamp(Math.round(num(m.best[k])), 0, 3)); }
    var hi = Math.max(0, Math.round(num(m.hi)));
    return { lv: Math.max(1, Math.floor(num(m.lv, 1))), best: best, hi: hi, played: nb > 0 || hi > 0, raw: m };
  }
  function recommend(p, G) {
    var d = ensureDaily(p).done;
    var order = SKILLS.filter(function (s) { return !d[s.id]; }).concat(SKILLS.filter(function (s) { return d[s.id]; }));
    for (var i = 0; i < order.length; i++) {
      var sid = order[i].id;
      var c = orderedGames().filter(function (g) { return g.skill === sid && isArcade(g) && availability(g, G).ok; });
      if (!c.length) continue;
      var r = function (g) { return p.games[g.id] ? p.games[g.id].rounds : 0; };
      c.sort(function (a, b) { return r(a) - r(b); });
      return c[0].id;
    }
    return null;
  }
  function lvStars(n) {
    return h('span', { class: 'hw-lv-stars', 'aria-hidden': 'true' }, [0, 1, 2].map(function (i) {
      var s = starSvg(i < n); s.setAttribute('class', i < n ? 'on' : ''); return s;
    }));
  }
  function levelBtn(g, p, G, isNext, idx) {
    var av = availability(g, G);
    var a = arcOf(p, g.id);
    var gs = p.games[g.id];
    var played = a.played || !!(gs && gs.rounds);
    var best = Math.max(a.best, a.played ? 0 : (gs ? gs.best : 0));
    var wn = p.wrong.filter(function (w) { return w.g === g.id; }).length;
    var label = g.name + (av.ok ? '，第 ' + a.lv + ' 关' + (best ? '，最好 ' + best + ' 颗星' : '') + (a.hi ? '，最高分 ' + a.hi : '') + (played ? '' : '，新游戏') : '，' + av.why) + (wn ? '，错题 ' + wn + ' 道' : '');
    return h('button', {
      type: 'button', class: 'hw-lv' + (av.ok ? '' : ' is-off') + (isNext ? ' is-next' : ''), id: 'hw-g-' + g.id, 'data-s': g.skill,
      'aria-disabled': av.ok ? null : 'true', 'aria-label': label, title: g.blurb || g.name, style: '--d:' + (-idx * 0.7) + 's',
      on: { click: function () { if (!av.ok) { toast(g.name + '：' + av.why); return; } SFX.tap(); startGame(g.id); } }
    },
      lvStars(best),
      h('span', { class: 'hw-lv-orb', 'aria-hidden': 'true' }, h('span', { class: 'hw-lv-ic' }, av.ok ? (g.icon || '🎮') : '🔒')),
      h('span', { class: 'hw-lv-lv', 'aria-hidden': 'true' }, av.ok ? '第' + a.lv + '关' : (SHORT_WHY[av.why] || av.why)),
      h('span', { class: 'hw-lv-nm', 'aria-hidden': 'true' }, g.name),
      av.ok && !played ? h('span', { class: 'hw-lv-new', 'aria-hidden': 'true' }, '新！') : null,
      wn ? h('span', { class: 'hw-lv-wn', 'aria-hidden': 'true', title: '错题' }, String(wn)) : null,
      isNext ? h('span', { class: 'hw-pin', 'aria-hidden': 'true' }, p.avatar) : null);
  }
  function gameCard(g, p, G) {
    var av = availability(g, G);
    var gs = p.games[g.id];
    var wn = p.wrong.filter(function (w) { return w.g === g.id; }).length;
    var meta = [];
    if (!av.ok) meta.push(h('span', null, av.why));
    else if (!gs || !gs.rounds) meta.push(h('span', { class: 'new' }, '新'));
    else {
      meta.push(h('span', { class: 'hw-mini-stars', 'aria-label': '最好 ' + gs.best + ' 颗星' }, stars3(gs.best)));
      meta.push(h('span', null, '玩过 ' + gs.rounds + ' 轮'));
    }
    if (wn) meta.push(h('span', null, '错题 ' + wn));
    return h('button', {
      type: 'button', class: 'hw-gcard', id: 'hw-g-' + g.id, style: '--zc:var(--' + g.skill + ')',
      'aria-disabled': av.ok ? null : 'true',
      on: { click: function () { if (!av.ok) { toast(g.name + '：' + av.why); return; } SFX.tap(); startGame(g.id); } }
    },
      h('span', { class: 'hw-gcard-ic', 'aria-hidden': 'true' }, g.icon || ''),
      h('span', { class: 'hw-gcard-n' }, g.name),
      h('span', { class: 'hw-gcard-b' }, g.blurb || ''),
      h('span', { class: 'hw-gcard-m' }, meta));
  }
  function bookPref(sid, v) {
    var o = LS.get('pbook', {});
    if (!isObj(o)) o = {};
    if (v === undefined) return o[sid];
    o[sid] = !!v; LS.set('pbook', o);
    return o[sid];
  }
  function isleEl(s, i, p, G, rec) {
    var all = orderedGames().filter(function (g) { return g.skill === s.id; });
    var arcs = all.filter(isArcade), prac = all.filter(function (g) { return !isArcade(g); });
    var st = p.skills[s.id];
    var info = ISLE[s.id];
    var book = null;
    if (prac.length) {
      var played = prac.reduce(function (a, g) { return a + (p.games[g.id] ? p.games[g.id].rounds : 0); }, 0);
      book = h('details', { class: 'hw-pbook', id: 'hw-pbook-' + s.id },
        h('summary', null,
          h('span', { class: 'hw-pbook-ic', 'aria-hidden': 'true' }, '📒'),
          h('span', { class: 'hw-pbook-t' }, '练习本'),
          h('small', null, prac.length + ' 个练习' + (played ? ' · 玩过 ' + played + ' 轮' : ''))),
        h('div', { class: 'hw-pbook-body' }, h('div', { class: 'hw-gcards' }, prac.map(function (g) { return gameCard(g, p, G); }))));
      var pref = bookPref(s.id);
      if (pref === true || (pref === undefined && !arcs.length)) book.open = true;
      book.addEventListener('toggle', function () { bookPref(s.id, book.open); });
    }
    return h('section', { class: 'hw-isle hw-isle-' + s.id, id: 'hw-zone-' + s.id, style: '--zc:var(--' + s.id + ')', 'aria-labelledby': 'hw-zh-' + s.id },
      h('header', { class: 'hw-isle-head' },
        h('span', { class: 'hw-isle-ch', 'aria-hidden': 'true' }, s.ch),
        h('div', { class: 'hw-isle-t' }, h('h2', { id: 'hw-zh-' + s.id }, info.name), h('p', null, s.name + ' · ' + s.desc)),
        h('span', { class: 'hw-zonestat' }, st.rounds ? st.rounds + ' 轮 · 平均 ' + (st.stars / st.rounds).toFixed(1) + ' 星' : '还没开始')),
      h('div', { class: 'hw-land' },
        h('div', { class: 'hw-ground', 'aria-hidden': 'true' }),
        artEl(info.mark, 'hw-mark'),
        artEl('palm', 'hw-palm'),
        arcs.length ? h('div', { class: 'hw-lvs' }, arcs.map(function (g, k) { return levelBtn(g, p, G, rec === g.id, k + i); }))
          : h('p', { class: 'hw-land-empty' }, '小游戏正在建造中……先翻开下面的练习本吧！')),
      book);
  }
  function seaDecor() {
    var out = [];
    [[23, 46, -6, '30vw', ''], [52, 58, -30, '60vw', ' rev'], [79, 40, -20, '20vw', '']].forEach(function (b) {
      out.push(h('span', { class: 'hw-boat' + b[4], style: 'top:' + b[0] + '%;--dur:' + b[1] + 's;--d:' + b[2] + 's;--rx:' + b[3], 'aria-hidden': 'true' }, artEl('junk')));
    });
    [[6, 36, 0], [84, 64, -2.6], [10, 88, -4]].forEach(function (f) {
      out.push(h('span', { class: 'hw-fish', style: 'left:' + f[0] + '%;top:' + f[1] + '%;--d:' + f[2] + 's', 'aria-hidden': 'true' }, artEl('fish')));
    });
    [[4, 12, 0], [92, 20, -0.7], [48, 34, -1.4], [8, 62, -0.3], [94, 46, -1.1], [50, 70, -1.8], [90, 90, -0.5], [30, 96, -1.2]].forEach(function (k) {
      out.push(h('span', { class: 'hw-spk', style: 'left:' + k[0] + '%;top:' + k[1] + '%;--d:' + k[2] + 's', 'aria-hidden': 'true' }));
    });
    return out;
  }
  function dockEl(p) {
    var got = stampCount(p);
    var rounds = SKILL_IDS.reduce(function (a, s) { return a + p.skills[s].rounds; }, 0);
    function btn(id, title, sub, ic, fn, badge) {
      return h('button', { type: 'button', class: 'hw-dockbtn', id: id, 'aria-label': title + '，' + sub, on: { click: function () { leaveMap(); fn(); } } },
        h('span', { class: 'ic ' + ic[0], 'aria-hidden': 'true' }, ic[1]),
        h('span', { 'aria-hidden': 'true' }, title),
        badge ? h('span', { class: 'badge', 'aria-hidden': 'true' }, badge > 99 ? '99+' : String(badge)) : null);
    }
    return h('nav', { class: 'hw-dock', 'aria-label': '我的本子' },
      btn('hw-open-wrong', '错题本', p.wrong.length ? p.wrong.length + ' 道待重练' : '还没有错题', ['ic-wrong', '错'], renderWrong, p.wrong.length),
      btn('hw-open-stamps', '印章册', got + ' / ' + STAMPS.length + ' 枚', ['ic-seal', stampEl({ t: '印', shape: 'square' }, { size: 28, tiny: true, rot: -8 })], renderStamps),
      btn('hw-open-records', '学习记录', rounds ? '一共 ' + rounds + ' 轮' : '还没有记录', ['ic-chart', [h('i'), h('i'), h('i')]], renderRecords),
      btn('hw-open-profiles', '档案', Object.keys(profiles).length + ' 个小朋友', ['ic-me', p.avatar], function () { renderProfiles(); }));
  }
  function renderMap() {
    ui.view = 'map';
    setView('map');
    var p = curProf();
    var G = gradeData(p.grade);
    var rec = recommend(p, G);
    // --t：装饰动画按“墙上时钟”对齐相位，重画地图（云端同步、换年级）时云和船不会跳回起点
    main.replaceChildren(h('div', { class: 'hw-world hw-mapview', style: '--t:' + (-(now() % 3600000) / 1000).toFixed(2) + 's' },
      hudEl(p),
      heroEl(p),
      questEl(p),
      hintEl(),
      h('div', { class: 'hw-sea' },
        seaDecor(),
        h('div', { class: 'hw-isles' }, SKILLS.map(function (s, i) { return isleEl(s, i, p, G, rec); }))),
      h('p', { class: 'hw-foot', id: 'hw-sync' }, syncText()),
      dockEl(p)));
  }

  /* ================= 视图：子页面 ================= */
  function page(title, sub, content) {
    setView('page');
    main.replaceChildren(h('div', { class: 'hw-shell' }, h('div', { class: 'hw-page' },
      h('div', { class: 'hw-pagehead' },
        h('button', { class: 'hw-btn', type: 'button', id: 'hw-back', on: { click: goMap } }, '‹ 地图'),
        h('h1', null, title),
        sub ? h('span', { class: 'hw-tag accent' }, sub) : null),
      content)));
    try { W.scrollTo(0, 0); } catch (e) { /* ignore */ }
  }
  function dots(n) {
    n = clamp(num(n), 0, 2);
    return h('span', { class: 'hw-dots', role: 'img', 'aria-label': '重练答对 ' + n + '/2 次' }, h('i', { class: n >= 1 ? 'on' : '' }), h('i', { class: n >= 2 ? 'on' : '' }));
  }
  function renderWrong() {
    ui.view = 'wrong';
    var p = curProf();
    var groups = {};
    p.wrong.forEach(function (w) { (groups[w.g] = groups[w.g] || []).push(w); });
    var ids = orderedGames().map(function (g) { return g.id; }).filter(function (id) { return groups[id]; });
    Object.keys(groups).forEach(function (id) { if (ids.indexOf(id) < 0) ids.push(id); });
    var content = [h('p', { class: 'hw-muted' }, '答错的题会记在这里。点“重练”再做一遍，重练时答对 2 次，题目就会自动移出错题本。')];
    if (!ids.length) content.push(h('div', { class: 'hw-card hw-empty' }, '错题本是空的，真厉害！'));
    ids.forEach(function (id) {
      var g = games[id];
      var list = groups[id].slice().sort(function (a, b) { return b.t - a.t; });
      var canReview = !!g && list.some(function (w) { return w.it != null; });
      content.push(h('section', { class: 'hw-card hw-wgroup', 'aria-labelledby': 'hw-wg-' + id },
        h('div', { class: 'hw-wgroup-h' },
          h('h2', { id: 'hw-wg-' + id }, g ? h('span', { 'aria-hidden': 'true' }, g.icon || '') : null, g ? g.name : id, h('span', { class: 'hw-tag' }, list.length + ' 道')),
          canReview ? h('button', { class: 'hw-btn primary', type: 'button', id: 'hw-review-' + id, on: { click: function () { startReview(id); } } }, '重练') : null),
        h('ul', { class: 'hw-wlist' }, list.slice(0, 60).map(function (w) {
          return h('li', { class: 'hw-witem' },
            h('span', { class: 'hw-witem-t' }, w.n || '（没有说明）'),
            h('span', { class: 'hw-witem-m' }, dots(w.ok), ' ' + String(w.gr || '').toUpperCase() + ' · ' + fmtTime(w.t)),
            h('button', { class: 'hw-x', type: 'button', title: '从错题本移除', 'aria-label': '从错题本移除：' + (w.n || ''), on: { click: function () { removeWrong(w); } } }, '✕'));
        }))));
    });
    page('错题本', p.wrong.length + ' 道', content);
  }
  function removeWrong(w) {
    var p = curProf();
    p.wrong = p.wrong.filter(function (x) { return !(x.k === w.k && x.g === w.g); });
    touch(p);
    keepPlace(renderWrong);
    toast('已移出错题本');
  }
  function renderStamps() {
    ui.view = 'stamps';
    var p = curProf();
    var got = STAMPS.filter(function (s) { return p.stamps[s.id]; }).length;
    page('印章册', got + ' / ' + STAMPS.length, [
      h('section', { class: 'hw-card hw-stack', 'aria-labelledby': 'hw-st-h' },
        h('h2', { class: 'hw-kai', id: 'hw-st-h' }, '奖励印章'),
        h('p', { class: 'hw-muted' }, '现在有 ' + p.flowers + ' 朵小红花。灰色的印章还没得到，看看下面怎么拿到它。'),
        h('div', { class: 'hw-stampgrid' }, STAMPS.map(function (s) {
          var d = p.stamps[s.id];
          return h('div', { class: 'hw-stampcell' }, stampEl(s, { size: 76, locked: !d }), h('b', null, s.t), h('span', null, d ? fmtDate(d) + '得到' : needText(s, p)));
        }))),
      h('section', { class: 'hw-card hw-stack', 'aria-labelledby': 'hw-day-h' },
        h('h2', { class: 'hw-kai', id: 'hw-day-h' }, '每日章'),
        h('p', { class: 'hw-muted' }, '听、说、读、写四件事都完成的日子，一共 ' + p.days.length + ' 天。'),
        p.days.length ? h('div', { class: 'hw-days' }, p.days.slice(-30).reverse().map(dateSeal))
          : h('p', { class: 'hw-empty' }, '还没有每日章，今天就来盖第一个吧！'))
    ]);
  }
  function th(t, cls) { return h('th', { class: cls || null, scope: 'col' }, t); }
  function renderRecords() {
    ui.view = 'records';
    var p = curProf();
    var total = SKILL_IDS.reduce(function (a, s) { return a + p.skills[s].rounds; }, 0);
    var bars = SKILLS.map(function (s) {
      var st = p.skills[s.id], avg = st.rounds ? st.stars / st.rounds : 0;
      return h('div', { class: 'hw-skillbar', style: '--zc:var(--' + s.id + ')' },
        h('h3', null, s.ch + ' · ' + s.name),
        h('div', { class: 'hw-meter', role: 'img', 'aria-label': '平均 ' + avg.toFixed(1) + ' 颗星' }, h('span', { style: 'width:' + (avg / 3 * 100).toFixed(0) + '%' })),
        h('span', { class: 'v' }, st.rounds ? st.rounds + ' 轮 · 平均 ' + avg.toFixed(1) + ' 星' : '还没玩过'));
    });
    var rows = orderedGames().map(function (g) {
      var gs = p.games[g.id];
      return h('tr', null,
        h('td', null, (g.icon ? g.icon + ' ' : '') + g.name),
        h('td', null, SKILL_NAME[g.skill]),
        h('td', { class: 'num' }, String(gs ? gs.rounds : 0)),
        h('td', { class: 'num' }, gs && gs.rounds ? (gs.stars / gs.rounds).toFixed(1) : '–'),
        h('td', { class: 'num hw-mini-stars' }, gs && gs.rounds ? stars3(gs.best) : '–'),
        h('td', { class: 'num' }, isArcade(g) ? (function (a) { return a.played ? '第' + a.lv + '关 · ' + a.hi + '分' : '–'; })(arcOf(p, g.id)) : ''));
    });
    var logs = p.log.slice(-20).reverse().map(function (l) {
      return h('tr', null,
        h('td', null, fmtTime(l.t)),
        h('td', null, gameName(l.g) + (l.rv ? '（重练）' : '')),
        h('td', null, String(l.gr || '').toUpperCase()),
        h('td', { class: 'num' }, l.n != null ? l.c + '/' + l.n : '–'),
        h('td', { class: 'num hw-mini-stars' }, stars3(l.s)));
    });
    page('学习记录', p.name, [
      h('section', { class: 'hw-card hw-stack', 'aria-labelledby': 'hw-rc-h' },
        h('h2', { class: 'hw-kai', id: 'hw-rc-h' }, '听说读写'),
        h('p', { class: 'hw-muted' }, '一共玩了 ' + total + ' 轮，得到 ' + p.flowers + ' 朵小红花，完成四件事 ' + p.days.length + ' 天。'),
        h('div', { class: 'hw-skillbars' }, bars)),
      h('section', { class: 'hw-card hw-stack', 'aria-labelledby': 'hw-rg-h' },
        h('h2', { class: 'hw-kai', id: 'hw-rg-h' }, '每个游戏'),
        rows.length ? h('div', { class: 'hw-table-wrap' }, h('table', { class: 'hw-table' },
          h('thead', null, h('tr', null, th('游戏'), th('技能'), th('轮数', 'num'), th('平均星', 'num'), th('最好', 'num'), th('关卡 · 最高分', 'num'))),
          h('tbody', null, rows))) : h('p', { class: 'hw-empty' }, '游戏还没准备好。')),
      h('section', { class: 'hw-card hw-stack', 'aria-labelledby': 'hw-rl-h' },
        h('h2', { class: 'hw-kai', id: 'hw-rl-h' }, '最近 20 轮'),
        logs.length ? h('div', { class: 'hw-table-wrap' }, h('table', { class: 'hw-table' },
          h('thead', null, h('tr', null, th('时间'), th('游戏'), th('年级'), th('答对', 'num'), th('星', 'num'))),
          h('tbody', null, logs))) : h('p', { class: 'hw-empty' }, '还没有记录，去地图上挑一个游戏吧！'))
    ]);
  }
  function renderProfiles(editId) {
    ui.view = 'profiles';
    ui.editing = editId || null;
    var list = sortedProfiles();
    var adding = editId === '__new';
    page('谁在练习？', null, [
      h('div', { class: 'hw-profiles' },
        list.map(function (p) { return editId === p.id ? profileForm(p) : profileCard(p); }),
        adding ? profileForm(null) : null),
      adding ? null : h('div', { class: 'hw-row' }, h('button', { class: 'hw-btn', type: 'button', id: 'hw-add-profile', on: { click: function () { renderProfiles('__new'); } } }, '＋ 新增小朋友')),
      h('p', { class: 'hw-muted' }, '每个小朋友的小红花、印章、错题本都分开记。')
    ]);
    if (editId) { var nm = D.getElementById('hw-pf-name'); if (nm) try { nm.focus(); } catch (e) { /* ignore */ } }
  }
  function profileCard(p) {
    var cur = p.id === curId;
    return h('div', { class: 'hw-card hw-pcard' + (cur ? ' is-cur' : '') },
      h('div', { class: 'hw-pcard-top' },
        h('span', { class: 'hw-pcard-av', 'aria-hidden': 'true' }, p.avatar),
        h('div', null, h('div', { class: 'hw-pcard-n' }, p.name), h('div', { class: 'hw-muted' }, p.grade.toUpperCase() + ' · ' + p.flowers + ' 朵小红花'))),
      h('div', { class: 'hw-row' },
        cur ? h('span', { class: 'hw-tag accent' }, '正在练习')
          : h('button', { class: 'hw-btn primary', type: 'button', id: 'hw-use-' + p.id, on: { click: function () { switchProfile(p.id); SFX.tap(); goMapTop(); } } }, '就是我'),
        h('button', { class: 'hw-btn', type: 'button', id: 'hw-edit-' + p.id, on: { click: function () { renderProfiles(p.id); } } }, '修改'),
        cur ? h('button', { class: 'hw-btn ghost', type: 'button', id: 'hw-go-' + p.id, on: { click: goMapTop } }, '去玩') : null));
  }
  function goMapTop() { ui.mapScroll = 0; goMap(); }
  function profileForm(p) {
    var isNew = !p;
    var base = p || { name: '', avatar: AVATARS[Math.floor(Math.random() * AVATARS.length)], grade: 'p3' };
    var avatar = base.avatar;
    var name = h('input', { class: 'hw-input', id: 'hw-pf-name', type: 'text', maxlength: '12', value: base.name, placeholder: '名字，比如：大宝', autocomplete: 'off' });
    var grade = h('select', { class: 'hw-select', id: 'hw-pf-grade', value: base.grade },
      GRADES.map(function (g) { return h('option', { value: g }, g.toUpperCase() + '（小学' + CN_NUM[Number(g.slice(1))] + '年级）'); }));
    var avList = AVATARS.indexOf(avatar) >= 0 ? AVATARS : [avatar].concat(AVATARS);
    var avs = h('div', { class: 'hw-avatars', role: 'radiogroup', 'aria-label': '选一个头像' }, avList.map(function (a, i) {
      var id = 'hw-pf-av-' + i;
      var inp = h('input', { type: 'radio', name: 'hw-pf-av', id: id, value: a });
      if (a === avatar) inp.checked = true;
      inp.addEventListener('change', function () { avatar = a; });
      return [inp, h('label', { for: id, title: a }, a)];
    }));
    var delBtn = null;
    if (!isNew) {
      delBtn = h('button', { class: 'hw-btn ghost hw-danger', type: 'button', id: 'hw-pf-del' }, '删除这个档案');
      if (sortedProfiles().length <= 1) delBtn.disabled = true;
      delBtn.addEventListener('click', function () {
        if (!delBtn.classList.contains('is-armed')) {
          delBtn.classList.add('is-armed');
          delBtn.textContent = '确定删除？' + p.name + '的进度会一起删掉';
          return;
        }
        if (deleteProfile(p.id)) { toast('已删除'); renderProfiles(); }
      });
    }
    function save() {
      var nm = name.value.trim().slice(0, 12) || '小朋友';
      var gr = GRADES.indexOf(grade.value) >= 0 ? grade.value : 'p3';
      if (isNew) {
        var np = createProfile({ name: nm, avatar: avatar, grade: gr });
        switchProfile(np.id);
        toast('欢迎 ' + nm + '！');
      } else {
        var cur = profiles[p.id];
        if (cur) { cur.name = nm; cur.avatar = avatar; cur.grade = gr; touch(cur); }
        toast('保存好了');
      }
      renderProfiles();
    }
    return h('form', { class: 'hw-card hw-pcard hw-stack', id: isNew ? 'hw-pf-new' : 'hw-pf-form', on: { submit: function (e) { e.preventDefault(); save(); } } },
      h('div', { class: 'hw-field' }, h('label', { for: 'hw-pf-name' }, '名字'), name),
      h('div', { class: 'hw-field' }, h('span', { class: 'lbl' }, '头像'), avs),
      h('div', { class: 'hw-field' }, h('label', { for: 'hw-pf-grade' }, '年级'), grade),
      h('div', { class: 'hw-row' },
        h('button', { class: 'hw-btn primary', type: 'submit', id: 'hw-pf-save' }, '保存'),
        h('button', { class: 'hw-btn', type: 'button', id: 'hw-pf-cancel', on: { click: function () { renderProfiles(); } } }, '取消'),
        delBtn));
  }

  /* ================= 全局事件 / 启动 ================= */
  function onKey(e) {
    if (e.defaultPrevented || e.ctrlKey || e.metaKey || e.altKey) return;
    var t = e.target;
    var typing = t && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName || ''));
    if (ui.view === 'game' && S && S.alive) {
      if (e.key === 'Escape') { if (S.arcade) return; var b = D.getElementById('hw-exit'); if (b) requestExit(S, b); return; }
      if (typing) return;
      var k = String(e.key || '').toLowerCase(), idx = -1;
      if (/^[1-6]$/.test(k)) idx = Number(k) - 1;
      else if (/^[a-f]$/.test(k)) idx = k.charCodeAt(0) - 97;
      if (idx < 0) return;
      var set = S.el.querySelector('.hw-choices:not(.is-locked)');
      if (!set) return;
      var btn = set.children[idx];
      if (btn) { e.preventDefault(); try { btn.focus({ preventScroll: true }); } catch (x) { /* ignore */ } btn.click(); }
    } else if (e.key === 'Escape' && !typing && ['wrong', 'stamps', 'records', 'profiles', 'result'].indexOf(ui.view) >= 0) {
      goMap();
    }
  }
  function bindGlobal() {
    // iOS/Safari 只认“激活类”事件（touchend / click / keydown / mouse 的 pointerdown）里的首次发声；
    // 触摸的 pointerdown 不算激活，若在那里用掉一次性的 TTS 解锁，之后就再也解不开 → TTS 只挂在激活事件上
    var unlock = function () { TTS.unlock(); SFX.unlock(); };
    D.addEventListener('pointerdown', function (e) { if (e && e.pointerType === 'mouse') unlock(); else SFX.unlock(); }, { capture: true, passive: true });
    D.addEventListener('touchend', unlock, { capture: true, passive: true });
    D.addEventListener('click', unlock, true);
    D.addEventListener('keydown', unlock, true);
    D.addEventListener('keydown', onKey);
    D.addEventListener('visibilitychange', function () { if (D.hidden) { TTS.stop(); flushRemote(); } });
    W.addEventListener('pagehide', function () { flushRemote(); });
    var lastTts = TTS.status();
    TTS.onChange(function () {
      var st = TTS.status();
      if (st === lastTts) return;
      lastTts = st;
      if (booted && ui.view === 'map') keepPlace(renderMap);
    });
  }
  function boot() {
    if (booted) return;
    booted = true;
    root = D.getElementById('app');
    if (!root) { root = h('div', { id: 'app' }); D.body.appendChild(root); }
    main = h('main', { class: 'hw-main', id: 'hw-main' });
    toastEl = h('div', { class: 'hw-toast', role: 'status', 'aria-live': 'polite' });
    fxEl = h('div', { class: 'hw-fx', 'aria-hidden': 'true' });
    root.replaceChildren(main, toastEl, fxEl);
    loadLocal();
    ASR.init();
    TTS.init();
    bindGlobal();
    renderMap();
    connectDb();
    useCap('sample');
  }

  /* ================= 对外 ================= */
  W.HW = {
    __core: true,
    version: '2.0.0',
    register: register,
    css: css,
    boot: boot,
    h: h,
    shuffle: shuffle,
    toast: toast,
    keyOf: keyOf,
    tts: {
      get ok() { return TTS.ok; },
      speak: function (text, o) { return TTS.speak(text, Object.assign({ rate: rateFor(curGradeNum()) }, o || {})); },
      stop: function () { TTS.stop(); }
    },
    sfx: SFX,
    asr: { get ok() { return ASR.ok; }, listen: function (o) { return ASR.listen(o); }, stop: function () { ASR.stop(); } },
    ai: { ok: function () { return AI.ok(); }, review: function (a) { return AI.review(a, curGradeNum()); } },
    hanzi: { has: function (ch) { return Hanzi.has(ch); }, create: function (el, ch, o) { return Hanzi.create(el, ch, o); } },
    flower: flowerSvg,
    stamp: function (t, o) { return stampEl({ t: t, shape: (o && o.shape) || null }, o); },
    start: function (id) { if (booted) startGame(id); },
    setGrade: function (gr) { if (booted && /^p[2-6]$/.test(gr)) setGrade(gr); },
    get sound() { return !!settings.sound; },
    get games() { return orderedGames().map(function (g) { return { id: g.id, skill: g.skill, name: g.name, kind: g.kind }; }); },
    get stamps() { return STAMPS.map(function (s) { return { id: s.id, t: s.t, need: s.need }; }); }
  };
})();
