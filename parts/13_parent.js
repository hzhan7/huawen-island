/* 13_parent.js — 家长工具，挂在「档案」页底部（核心 HW._core.addProfilesExtra）
 *
 * 1. 💾 存档
 *    · 自动存档：核心每次进度变化都立刻写 localStorage（10_core saveLocal）；这里显示“最近一次自动保存”，
 *      玩完一局回到地图时角落闪一下“💾 进度已自动保存”，存不上时核心会提醒家长。
 *    · 存档点（IndexedDB，打不开时退回 localStorage 只留几个）：
 *        每日自动 —— 每天第一次打开时存一个（= 当天开始玩之前的样子），留最近 7 天；
 *        手动 —— 家长/孩子随时存，可起名，留最近 10 个；
 *        恢复前备份 —— 每次恢复/导入之前自动存一份现在的，留 3 个（恢复错了还能再恢复回来）。
 *    · 导出 / 导入存档文件：浏览器清数据、Safari 7 天规则、换 iPad、网页版↔单机版之间搬进度，都只能靠文件。
 *    恢复、导入要过家长验证；恢复 = 写回 localStorage 后刷新页面（各模块重新读，最稳）。
 *    恢复出来的档案 updatedAt 调成“现在”：claude.ai 版的云端合并、其他设备都把它当最新，不会被旧云端盖回去。
 *
 * 2. 🔊 声音检查：当场响一声、读一句，逐项告诉家长哪一环不通、怎么修（iPad 上声音问题没法远程复现，靠它现场诊断）。
 */
(function (W, D) {
  'use strict';
  const HW = W.HW;
  if (!HW || !HW._core) return;
  const C = HW._core, h = C.h;

  /* ================= 存档内容 ================= */
  const PFX = 'hw.v1.';
  // 不进存档：设备自己的东西（设备号、麦克风被拒记录）、测试用、今天问没问过“谁来玩”、存档功能自己的记录
  const SKIP = new Set(['dev', 'asrNo', 'debugDayOffset', 'pickDay', 'snaps', 'snapDay', 'lastExport']);
  const KEEP = { day: 7, manual: 10, pre: 3 };
  const KEEP_LS = { day: 2, manual: 2, pre: 1 };   // 退回 localStorage 时（5MB 上限，要给进度本身留地方）

  // fresh = false：调用方刚存过（saveLocal 的钩子里），不要再存一次 —— 否则“存 → 钩子 → 存档点 → 存”会绕成死循环
  function collect(fresh) {
    if (fresh !== false) { try { C.saveLocal(); } catch (e) { /* ignore */ } }
    const data = {};
    try {
      const ls = W.localStorage;
      for (let i = 0; i < ls.length; i++) {
        const k = ls.key(i);
        if (!k || k.indexOf(PFX) !== 0) continue;
        const kk = k.slice(PFX.length);
        if (!SKIP.has(kk)) data[kk] = ls.getItem(k);
      }
    } catch (e) { /* ignore */ }
    return data;
  }
  function summarize(data) {
    let prof = {};
    try { prof = JSON.parse(data.profiles || '{}') || {}; } catch (e) { prof = {}; }
    return Object.keys(prof).map((id) => prof[id]).filter((p) => p && typeof p === 'object')
      .sort((a, b) => (+a.createdAt || 0) - (+b.createdAt || 0))
      .map((p) => ({
        n: String(p.name || '小朋友').slice(0, 12), a: String(p.avatar || '🙂').slice(0, 4), g: String(p.grade || '').toUpperCase(),
        f: Math.max(0, Math.round(+p.flowers || 0)),
        c: p.cards && typeof p.cards === 'object' && !Array.isArray(p.cards) ? Object.keys(p.cards).length : 0
      }));
  }
  const hasProgress = (sum) => sum.some((x) => x.f > 0 || x.c > 0);
  function makeSnap(kind, label, fresh) {
    const data = collect(fresh);
    return {
      app: 'huawen-island', v: 1,
      id: kind + '-' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
      kind, at: Date.now(), day: C.todayStr(), label: String(label || '').slice(0, 20),
      sum: summarize(data), data
    };
  }
  function parseSave(text) {
    let o;
    try { o = JSON.parse(String(text || '').trim()); } catch (e) { return null; }
    if (!o || o.app !== 'huawen-island' || !o.data || typeof o.data !== 'object' || typeof o.data.profiles !== 'string') return null;
    try { const p = JSON.parse(o.data.profiles); if (!p || typeof p !== 'object' || Array.isArray(p)) return null; } catch (e) { return null; }
    o.sum = summarize(o.data);
    o.at = +o.at || 0;
    return o;
  }

  /* ================= 存档点仓库：IndexedDB，打不开就退回 localStorage ================= */
  const DBN = 'huawen-island-saves', ST = 'snaps';
  let dbP = null, mode = '';
  function openDb() {
    if (dbP) return dbP;
    dbP = new Promise((res, rej) => {
      let r;
      try { r = W.indexedDB.open(DBN, 1); } catch (e) { rej(e); return; }
      const to = setTimeout(() => rej(new Error('idb timeout')), 4000);
      r.onupgradeneeded = () => { try { r.result.createObjectStore(ST, { keyPath: 'id' }); } catch (e) { /* ignore */ } };
      r.onsuccess = () => { clearTimeout(to); mode = 'idb'; res(r.result); };
      r.onerror = () => { clearTimeout(to); rej(r.error || new Error('idb')); };
      r.onblocked = () => { clearTimeout(to); rej(new Error('idb blocked')); };
    }).catch((e) => { mode = 'ls'; throw e; });
    return dbP;
  }
  function req(db, rw, fn) {
    return new Promise((res, rej) => {
      const t = db.transaction(ST, rw ? 'readwrite' : 'readonly');
      const r = fn(t.objectStore(ST));
      t.oncomplete = () => res(r && 'result' in r ? r.result : undefined);
      t.onerror = () => rej(t.error || new Error('tx'));
      t.onabort = () => rej(t.error || new Error('tx abort'));
    });
  }
  const lsList = () => { const a = C.LS.get('snaps', []); return Array.isArray(a) ? a : []; };
  const Store = {
    all() {
      return openDb().then((db) => req(db, false, (s) => s.getAll()), () => lsList())
        .then((a) => (Array.isArray(a) ? a : []).sort((x, y) => y.at - x.at));
    },
    put(snap) {
      return openDb().then((db) => req(db, true, (s) => s.put(snap)), () => {
        const a = lsList().filter((x) => x.id !== snap.id); a.push(snap);
        if (!C.LS.set('snaps', a)) throw new Error('存储空间不够');
      }).then(() => prune(snap.kind));
    },
    del(id) {
      return openDb().then((db) => req(db, true, (s) => s.delete(id)), () => { C.LS.set('snaps', lsList().filter((x) => x.id !== id)); });
    }
  };
  function prune(kind) {
    const keep = (mode === 'ls' ? KEEP_LS : KEEP)[kind] || 5;
    return Store.all().then((a) => {
      const old = a.filter((x) => x.kind === kind).slice(keep);
      return old.reduce((p, x) => p.then(() => Store.del(x.id)), Promise.resolve());
    });
  }

  /* ================= 每日存档点 ================= */
  let dayBusy = false, dayTried = 0;
  function dailyPoint() {
    const t = C.todayStr();
    if (dayBusy || C.LS.get('snapDay', '') === t) return;
    if (Date.now() - dayTried < 30000) return;       // 还没进度时别每存一次就翻一遍 localStorage
    dayTried = Date.now();
    const s = makeSnap('day', '', false);
    if (!hasProgress(s.sum)) return;                 // 还什么都没玩过：不存
    dayBusy = true;
    Store.put(s).then(() => { C.LS.set('snapDay', t); }, () => {}).then(() => { dayBusy = false; });
  }

  /* ================= 导出 / 导入 ================= */
  const pad = (n) => String(n).padStart(2, '0');
  function fileName(at) {
    const d = new Date(at || Date.now());
    return '华文小岛存档_' + d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()) + '_' + pad(d.getHours()) + pad(d.getMinutes()) + '.json';
  }
  function exportText(snap) {
    const o = { app: snap.app, v: snap.v, id: snap.id, kind: snap.kind, at: snap.at, day: snap.day, label: snap.label, sum: snap.sum, data: snap.data };
    return JSON.stringify(o);
  }
  /* 触屏设备（iPad）优先走分享面板：能“存储到文件”、AirDrop 给爸妈手机；电脑直接下载。
     注意：navigator.share 必须在点击的同一拍里调用，所以这里前面不能有 await */
  function exportSnap(snap) {
    const text = exportText(snap), name = fileName(snap.at);
    let blob;
    try { blob = new Blob([text], { type: 'application/json' }); } catch (e) { return Promise.resolve('fail'); }
    const coarse = !!(W.matchMedia && W.matchMedia('(pointer: coarse)').matches);
    const nav = W.navigator;
    if (coarse && nav.canShare && nav.share && W.File) {
      try {
        const f = new File([blob], name, { type: 'application/json' });
        if (nav.canShare({ files: [f] })) {
          return nav.share({ files: [f], title: '华文小岛存档' }).then(() => { markExported(); return 'shared'; },
            (e) => (e && e.name === 'AbortError' ? 'cancel' : download(blob, name)));
        }
      } catch (e) { /* 退回下载 */ }
    }
    return Promise.resolve(download(blob, name));
  }
  function download(blob, name) {
    try {
      const url = URL.createObjectURL(blob);
      const a = h('a', { href: url, download: name, style: 'display:none' });
      D.body.appendChild(a); a.click();
      setTimeout(() => { try { URL.revokeObjectURL(url); a.remove(); } catch (e) { /* ignore */ } }, 8000);
      markExported();
      return 'download';
    } catch (e) { return 'fail'; }
  }
  function markExported() { C.LS.set('lastExport', Date.now()); }

  /* ================= 恢复 ================= */
  function snapTitle(s) {
    const d = new Date(s.at || 0);
    const when = (d.getMonth() + 1) + '月' + d.getDate() + '日 ' + pad(d.getHours()) + ':' + pad(d.getMinutes());
    const what = s.kind === 'day' ? '每日自动存档' : s.kind === 'pre' ? '恢复前的备份' : s.kind === 'file' ? '存档文件' : (s.label || '手动存档点');
    return when + ' · ' + what;
  }
  const sumText = (sum) => (sum && sum.length ? sum.map((x) => x.a + x.n + ' 🌸' + x.f + (x.c ? ' · 字卡 ' + x.c : '')).join('　') : '（没有档案）');
  function restore(snap) {
    return C.parentGate('把进度换成「' + snapTitle(snap) + '」：' + sumText(snap.sum) + '。现在的进度会先自动备份成一个存档点，换错了还能换回来。').then((ok) => {
      if (!ok) return;
      const pre = makeSnap('pre', '');
      const backup = hasProgress(pre.sum) ? Store.put(pre).catch(() => {}) : Promise.resolve();
      return backup.then(() => apply(snap.data, snapTitle(snap)));
    });
  }
  function apply(data, label) {
    let prof = {};
    try { prof = JSON.parse(data.profiles || '{}') || {}; } catch (e) { prof = {}; }
    const t = Date.now() + 1000;
    Object.keys(prof).forEach((id) => { if (prof[id] && typeof prof[id] === 'object') prof[id].updatedAt = t; });
    const out = Object.assign({}, data, { profiles: JSON.stringify(prof) });
    try { C.tts.stop(); } catch (e) { /* ignore */ }
    C.freeze();
    try {
      const ls = W.localStorage;
      Object.keys(out).forEach((k) => { if (!SKIP.has(k) && typeof out[k] === 'string') ls.setItem(PFX + k, out[k]); });
      ls.removeItem(PFX + 'pickDay');          // 恢复后重新问“谁来玩？”
      ls.setItem(PFX + 'snapDay', JSON.stringify(C.todayStr()));   // 今天的每日存档点不要拿恢复出来的进度去覆盖
    } catch (e) {
      C.toast('写不进浏览器存储，恢复没成功。');
      return;
    }
    try { W.sessionStorage.setItem('hw.restored', label); } catch (e) { /* ignore */ }
    W.location.reload();
    setTimeout(() => C.toast('已写好存档，请手动刷新一下页面。'), 2500);
  }

  /* ================= 自动保存提示 ================= */
  let chipWait = false, chipPoll = 0;
  function flashChip() {
    const r = C.root(); if (!r) return;
    let el = D.getElementById('hw-savechip');
    if (!el) { el = h('div', { class: 'hw-savechip', id: 'hw-savechip', role: 'status', 'aria-live': 'polite' }); r.appendChild(el); }
    el.textContent = '💾 进度已自动保存';
    el.classList.remove('is-on'); void el.offsetWidth; el.classList.add('is-on');
    clearTimeout(flashChip.t); flashChip.t = setTimeout(() => el.classList.remove('is-on'), 2200);
  }
  C.onSave((ok) => {
    if (!ok) return;
    if (C.LS.get('snapDay', '') !== C.todayStr()) setTimeout(dailyPoint, 0);
    // 玩的时候不打扰：一局里存过，等回到地图 / 结算页再闪一下
    if (C.ui.view === 'game') {
      if (!chipWait) {
        chipWait = true;
        clearInterval(chipPoll);
        chipPoll = setInterval(() => {
          if (C.ui.view === 'game') return;
          clearInterval(chipPoll); chipWait = false;
          if (C.ui.view === 'map' || C.ui.view === 'result') flashChip();
        }, 800);
      }
    }
  });
  C.onBoot(() => {
    setTimeout(dailyPoint, 2500);
    let msg = '';
    try { msg = W.sessionStorage.getItem('hw.restored') || ''; W.sessionStorage.removeItem('hw.restored'); } catch (e) { msg = ''; }
    if (msg) setTimeout(() => C.toast('✓ 已恢复到「' + msg + '」'), 600);
  });

  /* ================= 档案页：存档卡片 ================= */
  function agoText(t) {
    if (!t) return '';
    const s = Math.max(0, Math.round((Date.now() - t) / 1000));
    if (s < 60) return '刚刚';
    if (s < 3600) return Math.floor(s / 60) + ' 分钟前';
    if (s < 86400) return Math.floor(s / 3600) + ' 小时前';
    return Math.floor(s / 86400) + ' 天前';
  }
  function savesCard() {
    const info = C.saveInfo();
    const autoLine = info.fail && info.fail >= info.ok
      ? h('p', { class: 'hw-save-auto is-bad' }, '⚠️ 最近一次自动保存失败了（浏览器存储满了或不让存）。请马上点「导出存档文件」留一份。')
      : h('p', { class: 'hw-save-auto' }, '✓ 自动存档开着：每玩一步都会马上存进这台设备的浏览器' + (info.ok ? '（最近一次：' + agoText(info.ok) + '）' : '') + '。');
    const lastEx = +C.LS.get('lastExport', 0) || 0;
    const exDays = lastEx ? (Date.now() - lastEx) / 864e5 : Infinity;
    const exLine = h('p', { class: 'hw-muted hw-save-ex' + (exDays > 7 ? ' is-warn' : '') },
      lastEx ? '上次导出存档文件：' + agoText(lastEx) + '。' : '还没导出过存档文件。',
      exDays > 7 ? '建议每周导出一次：浏览器清理数据、换设备的时候，只有导出的文件能把进度找回来。' : '');

    const name = h('input', { class: 'hw-input hw-snapname', id: 'hw-snap-name', type: 'text', maxlength: '20', placeholder: '给存档点起个名（可不填）', autocomplete: 'off' });
    const list = h('ul', { class: 'hw-snaps', id: 'hw-snaps' }, h('li', { class: 'hw-muted' }, '读取存档点……'));
    const saveBtn = h('button', { class: 'hw-btn primary', type: 'button', id: 'hw-snap-save' }, '📌 存一个存档点');
    saveBtn.addEventListener('click', () => {
      const s = makeSnap('manual', name.value.trim());
      if (!hasProgress(s.sum)) { C.toast('还没有进度可以存，先去玩一局吧'); return; }
      saveBtn.disabled = true;
      Store.put(s).then(() => { C.toast('📌 存好了：' + snapTitle(s)); name.value = ''; fill(); },
        (e) => C.toast('没存上：' + ((e && e.message) || '存储出错'))).then(() => { saveBtn.disabled = false; });
    });
    const exBtn = h('button', { class: 'hw-btn', type: 'button', id: 'hw-snap-export' }, '📤 导出存档文件');
    exBtn.addEventListener('click', () => {
      exportSnap(makeSnap('file', '')).then((r) => {
        if (r === 'download') C.toast('已下载存档文件（在“下载”文件夹里）');
        else if (r === 'shared') C.toast('✓ 已导出');
        else if (r === 'fail') { C.toast('这里下载不了，改用下面“用文字复制”'); const dt = D.getElementById('hw-save-text'); if (dt) dt.open = true; }
        if (r === 'download' || r === 'shared') { const n = D.getElementById('hw-saves'); if (n) n.replaceWith(savesCard()); }
      });
    });
    const file = h('input', { type: 'file', id: 'hw-snap-file', class: 'hw-vh', 'aria-label': '选择存档文件' });
    const imBtn = h('button', { class: 'hw-btn', type: 'button', id: 'hw-snap-import' }, '📥 用存档文件恢复');
    imBtn.addEventListener('click', () => { file.value = ''; file.click(); });
    file.addEventListener('change', () => {
      const f = file.files && file.files[0];
      if (!f) return;
      if (f.size > 20 * 1024 * 1024) { C.toast('这个文件太大了，不像是华文小岛的存档'); return; }
      f.text().then((t) => importText(t, f.name), () => C.toast('读不了这个文件'));
    });

    // 下载 / 选文件不方便时（比如嵌在别的页面里）：用文字复制、粘贴
    const ta = h('textarea', { class: 'hw-input hw-save-ta', id: 'hw-save-ta', rows: '3', placeholder: '把存档文字粘贴到这里', spellcheck: 'false', autocomplete: 'off' });
    const cpBtn = h('button', { class: 'hw-btn', type: 'button', id: 'hw-save-copy' }, '复制现在的存档文字');
    cpBtn.addEventListener('click', () => {
      const text = exportText(makeSnap('file', ''));
      const done = () => { markExported(); C.toast('已复制，粘贴到备忘录 / 微信收藏里保存'); };
      const fallback = () => { ta.value = text; ta.select(); try { D.execCommand('copy'); done(); } catch (e) { C.toast('请手动全选复制框里的文字'); } };
      try { W.navigator.clipboard.writeText(text).then(done, fallback); } catch (e) { fallback(); }
    });
    const pasteBtn = h('button', { class: 'hw-btn', type: 'button', id: 'hw-save-paste' }, '用这段文字恢复');
    pasteBtn.addEventListener('click', () => importText(ta.value, '粘贴的存档'));

    const card = h('section', { class: 'hw-card hw-saves', id: 'hw-saves', 'aria-labelledby': 'hw-saves-h' },
      h('h2', { class: 'hw-saves-h', id: 'hw-saves-h' }, '💾 存档'),
      autoLine,
      h('div', { class: 'hw-row hw-snaprow' }, name, saveBtn),
      h('div', { class: 'hw-row' }, exBtn, imBtn, file),
      exLine,
      h('h3', { class: 'hw-saves-sub' }, '存档点'),
      list,
      h('details', { class: 'hw-save-text', id: 'hw-save-text' },
        h('summary', null, '下载、选文件不方便？用文字复制'),
        h('div', { class: 'hw-stack' }, h('div', { class: 'hw-row' }, cpBtn), ta, h('div', { class: 'hw-row' }, pasteBtn))),
      h('div', { class: 'hw-muted hw-save-tip' },
        h('p', null, '存档点只存在这台设备的这个浏览器里；换设备、清浏览器数据要靠导出的文件。'),
        h('p', null, 'iPad / iPhone 的 Safari 有个规定：7 天没打开这个网页，会自动清掉它存的进度 —— 隔几天玩一次就没事，放长假前记得导出。'),
        h('p', null, '网页版、单机版、claude.ai 版的进度互不相通，想搬过去也是先导出、再到那边「用存档文件恢复」。')));

    function fill() {
      Store.all().then((a) => {
        if (!list.isConnected && !card.isConnected) return;
        list.replaceChildren();
        if (!a.length) { list.appendChild(h('li', { class: 'hw-muted' }, '还没有存档点。每天第一次打开会自动存一个；也可以点上面的「存一个存档点」。')); return; }
        a.forEach((s) => list.appendChild(snapRow(s)));
        if (mode === 'ls') list.appendChild(h('li', { class: 'hw-muted' }, '（这个浏览器不支持大容量存储，只保留最近几个存档点）'));
      }, () => { list.replaceChildren(h('li', { class: 'hw-muted' }, '存档点读不出来（浏览器不让用存储）。')); });
    }
    function snapRow(s) {
      const icon = s.kind === 'day' ? '🌅' : s.kind === 'pre' ? '↩️' : '📌';
      const rs = h('button', { class: 'hw-btn', type: 'button' }, '恢复');
      rs.addEventListener('click', () => restore(s));
      const ex = h('button', { class: 'hw-btn ghost', type: 'button' }, '导出');
      ex.addEventListener('click', () => { exportSnap(s).then((r) => { if (r === 'download') C.toast('已下载存档文件'); }); });
      let del = null;
      if (s.kind === 'manual') {
        del = h('button', { class: 'hw-btn ghost hw-danger', type: 'button' }, '删除');
        del.addEventListener('click', () => {
          if (!del.classList.contains('is-armed')) { del.classList.add('is-armed'); del.textContent = '确定删除？'; setTimeout(() => { if (del.isConnected) { del.classList.remove('is-armed'); del.textContent = '删除'; } }, 4000); return; }
          Store.del(s.id).then(fill, fill);
        });
      }
      return h('li', { class: 'hw-snap' },
        h('span', { class: 'hw-snap-ic', 'aria-hidden': 'true' }, icon),
        h('div', { class: 'hw-snap-t' }, h('div', { class: 'hw-snap-n' }, snapTitle(s)), h('div', { class: 'hw-muted hw-snap-s' }, sumText(s.sum))),
        h('div', { class: 'hw-row hw-snap-b' }, rs, ex, del));
    }
    function importText(text, from) {
      const o = parseSave(text);
      if (!o) { C.toast('这不是华文小岛的存档（或者内容不完整）'); return; }
      o.kind = 'file';
      if (!o.label) o.label = String(from || '').slice(0, 20);
      restore(o);
    }
    setTimeout(fill, 0);
    return card;
  }

  /* ================= 档案页：声音检查 ================= */
  function soundCard() {
    const out = h('ul', { class: 'hw-sndres', id: 'hw-sndres', 'aria-live': 'polite' });
    const btn = h('button', { class: 'hw-btn primary', type: 'button', id: 'hw-snd-check' }, '▶ 开始检查');
    btn.addEventListener('click', () => runCheck(out, btn));
    return h('section', { class: 'hw-card hw-sndchk', id: 'hw-sndchk', 'aria-labelledby': 'hw-snd-h' },
      h('h2', { class: 'hw-saves-h', id: 'hw-snd-h' }, '🔊 声音检查'),
      h('p', { class: 'hw-muted' }, '听不到声音的时候点一下：会先“叮”一声，再读一句“你好，欢迎来到华文小岛”，然后告诉你哪一步不通。'),
      h('div', { class: 'hw-row' }, btn), out);
  }
  function row(out, ok, title, tip) {
    out.appendChild(h('li', { class: 'hw-sndrow ' + (ok === true ? 'is-ok' : ok === false ? 'is-bad' : 'is-info') },
      h('span', { class: 'hw-sndrow-ic', 'aria-hidden': 'true' }, ok === true ? '✅' : ok === false ? '❌' : 'ℹ️'),
      h('div', null, h('div', { class: 'hw-sndrow-t' }, title), tip ? h('div', { class: 'hw-muted hw-sndrow-d' }, tip) : null)));
  }
  // 整个检查都在这次点击里同步开始（iOS 只在点击的同一拍里放行声音）
  function runCheck(out, btn) {
    out.replaceChildren();
    btn.disabled = true;
    const soundOn = !!C.settings().sound;
    C.aud.wake(true);
    try { C.tts.unlock(); } catch (e) { /* ignore */ }
    try { C.sfx.unlock(); C.sfx.good(); } catch (e) { /* ignore */ }
    const t0 = Date.now();
    let tp;
    try { tp = C.tts.speak('你好，欢迎来到华文小岛。', { rate: 0.9 }); } catch (e) { tp = Promise.resolve({ started: false }); }
    const ua = String(W.navigator.userAgent || '');
    const ios = /iPad|iPhone|iPod/.test(ua) || (/Macintosh/.test(ua) && (W.navigator.maxTouchPoints || 0) > 1);

    setTimeout(() => {
      // 1. 音效
      const st = C.sfx.state();
      if (!soundOn) row(out, false, '音效：开关是关着的', '点地图右上角的 🔈 把音效打开（朗读不受这个开关影响）。');
      else if (st === 'running') row(out, true, '音效：正常', '刚才应该听到“叮”的一声。');
      else row(out, false, '音效：被系统暂停了（' + st + '）', '再点一次「开始检查」；还不行就把浏览器彻底关掉（从后台划掉）再打开。');
      // 2. 静音模式
      const ty = C.aud.sessionType();
      if (ty === 'playback') row(out, true, '静音模式：已处理', ios ? 'iPad / iPhone 开着静音时也照常出声。' : '这台设备开着静音时也照常出声。');
      else if (ty) row(out, null, '静音模式：正在用麦克风（' + ty + '）', '用完麦克风会自动切回来。');
      else if (ios) row(out, null, '静音模式：这个系统版本管不了', 'iPad 如果开着静音（控制中心里的 🔔 图标），网页会没声，请关掉静音；或者把 iPad 升级到 iPadOS 17 以上。');
      // 3. 朗读
      const ts = C.tts.status();
      if (ts === 'none') { row(out, false, '朗读：这个浏览器不支持', '请换 Safari（iPad）或 Chrome（电脑）。'); finish(); return; }
      if (ts === 'nozh') {
        row(out, false, '朗读：这台设备没有普通话声音', ios ? '设置 → 辅助功能 → 朗读内容 → 声音 → 中文（中国大陆）→ 下载「婷婷」，然后回来刷新页面。'
          : '系统设置里下载中文（普通话）语音，然后刷新页面。');
        finish(); return;
      }
      Promise.resolve(tp).then((r) => {
        const ms = Date.now() - t0;
        const vn = C.tts.voiceName() || '系统默认', vl = C.tts.voiceLang();
        if (r && r.started) row(out, true, '朗读：正常', '用的是「' + vn + '」' + (vl ? '（' + vl + '）' : '') + '，读了 ' + (ms / 1000).toFixed(1) + ' 秒。');
        else {
          row(out, false, '朗读：没读出来', (ios ? '先把浏览器从后台彻底关掉再打开；还不行就到 设置 → 辅助功能 → 朗读内容 → 声音 → 中文，把「' + vn + '」删掉重新下载。'
            : '换一个浏览器试试（电脑上 Chrome 和 Safari 都行）。') + '游戏里读不出来时会改显示字幕，不会卡住。');
        }
        finish();
      }, () => { row(out, false, '朗读：出错了', '再点一次检查。'); finish(); });
    }, 700);

    function finish() {
      const cs = C.aud.contexts();
      row(out, null, '全都 ✅ 还是听不到？', '看看音量是不是调到最小、是不是连着蓝牙耳机或音箱。' +
        (cs.length ? '（技术信息：音频通道 ' + cs.length + ' 个，' + cs.map((c) => c.state).join(' / ') + '）' : ''));
      btn.disabled = false;
    }
  }

  C.addProfilesExtra(savesCard);
  C.addProfilesExtra(soundCard);

  HW.css(`
.hw-saves,.hw-sndchk{display:flex;flex-direction:column;gap:12px;margin-top:18px}
.hw-saves-h{font:400 24px/1.2 var(--font-display);letter-spacing:.04em;margin:0}
.hw-saves-sub{font-size:17px;margin:6px 0 0}
.hw-save-auto{margin:0;padding:10px 12px;border-radius:12px;background:var(--good-bg);color:var(--good);font-weight:700}
.hw-save-auto.is-bad{background:var(--bad-bg);color:var(--bad)}
.hw-save-ex{margin:0}.hw-save-ex.is-warn{color:var(--speak);font-weight:700}
.hw-snaprow .hw-snapname{flex:1 1 220px;min-width:0}
.hw-snaps{list-style:none;margin:0;padding:0;display:flex;flex-direction:column;gap:8px}
.hw-snap{display:flex;flex-wrap:wrap;align-items:center;gap:8px 12px;padding:10px 12px;border:2px solid var(--line);border-radius:12px;background:var(--paper-2)}
.hw-snap-ic{font-size:22px;line-height:1}
.hw-snap-t{flex:1 1 200px;min-width:0}
.hw-snap-n{font-weight:800}
.hw-snap-s{font-size:14px;overflow-wrap:anywhere}
.hw-snap-b{gap:6px}.hw-snap-b .hw-btn{min-height:40px;padding:4px 14px}
.hw-danger.is-armed{color:#fff!important;background:var(--bad);text-decoration:none;border-radius:10px}
.hw-save-text summary{cursor:pointer;color:var(--ink-soft);font-weight:700;padding:4px 0}
.hw-save-ta{width:100%;min-height:84px;font:13px/1.4 ui-monospace,Menlo,monospace;resize:vertical}
.hw-save-tip{font-size:14px;margin:0;display:flex;flex-direction:column;gap:6px}.hw-save-tip p{margin:0}
.hw-vh{position:absolute!important;width:1px;height:1px;opacity:0;pointer-events:none;overflow:hidden}
.hw-sndres{list-style:none;margin:0;padding:0;display:flex;flex-direction:column;gap:8px}
.hw-sndrow{display:flex;gap:10px;align-items:flex-start;padding:10px 12px;border-radius:12px;background:var(--paper-2);border:2px solid var(--line)}
.hw-sndrow.is-ok{border-color:var(--good)}.hw-sndrow.is-bad{border-color:var(--bad);background:var(--bad-bg)}
.hw-sndrow-ic{font-size:20px;line-height:1.2}
.hw-sndrow-t{font-weight:800}.hw-sndrow-d{font-size:14px;overflow-wrap:anywhere}
.hw-savechip{position:fixed;left:12px;bottom:calc(12px + env(safe-area-inset-bottom,0px));z-index:40;padding:8px 14px;border-radius:999px;
  background:var(--paper);color:var(--good);border:2.5px solid var(--good);font-weight:800;font-size:15px;box-shadow:var(--shadow);
  opacity:0;transform:translateY(12px);transition:opacity .25s,transform .25s;pointer-events:none}
.hw-savechip.is-on{opacity:1;transform:none}
@media (prefers-reduced-motion:reduce){.hw-savechip{transition:none}}
`);
}(window, document));
