/* =====================================================================
 * 华文小岛 3.0 · 元游戏（parts/12_meta.js）—— 让孩子每天想回来
 * 字卡图鉴 · 字宠 · 每日航线 · 灯塔连胜 · 钱包（设计见 research/GAME_SHORTLIST.md §3）
 * 挂在 HW 上：HW.meta（只读查询；测试用的 HW.meta._answer 只在 URL 带 #hwdebug 时才有），通过 HW._core.useMeta 把钩子交给核心。
 *
 * 设计底线（全部照办）：不涉及钱；没有隐藏概率（蛋自己选、宝箱内容提前写明）；宠物不死不病不施压（几天没来只是睡着）；
 *   兄妹不互偷；没有聊天；奖励看学得好不好（字卡等级 = 掌握程度，按日期间隔判定，同一天刷再多也不升级）；家长可设每日时长。
 *
 * ───────────── 给游戏作者 ─────────────
 * 1) ctx.score.right(item) / wrong(item) 时，核心从 item 取出“这一题考的汉字”记进字卡（profile.cards）：
 *      item.hz（字符串，推荐！如 "清" 或 "火车"；最多 8 个字）优先；
 *      否则按栏目：words.w、chars.c、jg.c、pick.say、build.ans、recipes.ans、typo.good、zuci.c、quiz 的正确选项（≤4 个汉字才算）；
 *      其余（故事、段落、句子排序、写话……）不计。wrong(item) 记在“正确答案的字”上（这个字需要复习）。
 *    所以：自己拼装的题目对象请带上 hz；手没跟上（g.miss）不要调 wrong。
 * 2) 航线会带着“重点字”开局：ctx.focus = ['晴','清',…]（丰收局 = 今天到期复习的字；今日游戏 = 今天的新字）。
 *    核心的 ctx.pick（也就是 g.items）已经自动把含这些字的题排在最前面；自己选题的游戏可以读 ctx.focus。
 * 3) 游戏不需要、也不应该直接改 profile 的元游戏字段。
 *
 * ───────────── 存档（跟着 profile 走 localStorage + db 云同步）─────────────
 *   cards[字] = {s 见过次数, r 答对次数, w 答错次数, d:[答对日（去重、升序、最多 8 个）], b 箱号 0–4, bl 升箱日期, x 最近答错日期, f 第一次见的日期, k 最近答对日期}
 *     卡级：灰 = 见过（s>0）；铜 = b≥1（答对 1 次）；银 = b≥2（隔天又答对）；金 = b=4（按第 1 / 3 / 7 天的间隔都答对：升箱要求与上次升箱隔 ≥1、≥2、≥4 天）
 *     “答对日”只认当天没答错过时的答对（答错后排除法蒙对的，今天不升级、明天再来）；同一天答对再多次也只算一个答对日。
 *     复习到期：灰卡第二天；铜 / 银卡按 1 / 2 / 4 天；金卡最后一次答对后 14 天；答错过的第二天。
 *     云端存档里 cards 写成紧凑数组（pack / normCard 两种写法都认）。
 *   pet = {f 部首家族, at 选蛋日期, t 选蛋时间戳, h 孵化日期, eg 暖蛋的饼干份数, fed 吃过的饼干份数, ate:{d, c:[今天吃过的饼干]}, v 最近来看它的日期, n 变成霓虹的日期}
 *     饼干：今天答对过的字每个一块 + 宝箱金饼干（算 3 份），每天最多 10 块；蛋每份 +3 度；宝宝吃满 20 份长成少年；少年 + 本年级这一家全部金卡 = 霓虹。
 *   voy = {d 日期, gr 年级, s:{h 丰收, n 新字, g 今日游戏, c 宝箱}, g 今日游戏 id, nw:[今天的新字], hv:[今天到期的字], rc:{'游戏:关卡': 今天第几局}}
 *     丰收 / 今日游戏站要拿到至少 1 颗星才算完成；同一关今天第 4 局起每局最多 1 朵小红花（错题重练不算）。
 *   purse = {设备id: [挣到的, 花掉的]}（每台设备各记各的，合并取各自最大值 → 两台设备同时挣也不会丢、不会翻倍）；wallet = 合计（只读）
 *   days = 完成航线的日期（沿用 profile.days，灯塔 / 每日章 / “日日新”等印章读它）
 * 合并（两台设备同步时，见 merge）：数值取最大、日期与集合取并集、航线同一天的打勾取并集；没有一项会因为同步而减少或翻倍。
 * ===================================================================== */
(function () {
  'use strict';
  const W = window, D = document;
  const HW = W.HW, C = HW && HW._core;
  if (!C || HW.meta) return;
  const h = C.h, clamp = C.clamp, num = C.num, isObj = C.isObj, has = C.has, clone = C.clone;

  /* ================= 日期 ================= */
  const pad2 = (n) => String(n).padStart(2, '0');
  const isDate = (s) => typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s);
  function dnum(s) { const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s || ''); return m ? Math.round(Date.UTC(+m[1], +m[2] - 1, +m[3]) / 864e5) : NaN; }
  function dstr(n) { const d = new Date(n * 864e5); return d.getUTCFullYear() + '-' + pad2(d.getUTCMonth() + 1) + '-' + pad2(d.getUTCDate()); }
  const addDays = (s, k) => dstr(dnum(s) + k);
  const diff = (a, b) => dnum(a) - dnum(b);
  const today = () => C.todayStr();
  const weekOf = (s) => Math.floor((dnum(s) + 3) / 7);          // 周一开始的一周
  function mdStr(s) { return isDate(s) ? Number(s.slice(5, 7)) + '月' + Number(s.slice(8, 10)) + '日' : ''; }
  function hashNum(s) { return parseInt(C.hash(String(s)), 36) || 0; }
  const str = (v) => (typeof v === 'string' ? v.trim() : '');

  /* ================= 汉字 ================= */
  const HZ = /[㐀-䶿一-鿿]/;
  const hzs = (s) => Array.from(String(s == null ? '' : s)).filter((c) => HZ.test(c));
  function uniq(a) { const o = []; a.forEach((x) => { if (o.indexOf(x) < 0) o.push(x); }); return o; }

  /* 题目对象 → 这一题考的汉字（规则见文件头） */
  function itemChars(it) {
    if (it == null) return [];
    if (typeof it === 'string') { const a = hzs(it); return a.length <= 4 ? uniq(a) : []; }
    if (typeof it !== 'object') return [];
    if (typeof it.hz === 'string' && it.hz) { const a = hzs(it.hz); return a.length <= 8 ? uniq(a) : []; }
    if (Array.isArray(it.hz)) { const a = hzs(it.hz.join('')); return a.length <= 8 ? uniq(a) : []; }
    if (typeof it.ans === 'string' && (typeof it.base === 'string' || (typeof it.a === 'string' && typeof it.b === 'string'))) return uniq(hzs(it.ans)).slice(0, 4);
    if (typeof it.bad === 'string' && typeof it.good === 'string') return uniq(hzs(it.good)).slice(0, 4);
    if (typeof it.say === 'string') { const a = hzs(it.say); return a.length <= 6 ? uniq(a) : []; }
    if (typeof it.c === 'string' && Array.isArray(it.ok)) return uniq(hzs(it.c)).slice(0, 2);
    if (typeof it.q === 'string' && Array.isArray(it.c) && Number.isInteger(it.a)) {
      if (typeof it.t !== 'string') return [];   // 只算知识闯关（quiz 有题型 t）；故事 / 阅读的问答不算
      const o = it.c[it.a];
      if (typeof o !== 'string') return [];
      const a = hzs(o);
      return a.length >= 1 && a.length <= 4 && a.length === Array.from(o.trim()).length ? uniq(a) : [];
    }
    if (typeof it.c === 'string' && Array.from(it.c).length === 1 && HZ.test(it.c)) return [it.c];   // chars / jg（jg 的 w 只是例词，不算）
    if (typeof it.w === 'string' && !Array.isArray(it.qs)) { const a = hzs(it.w); return a.length <= 6 ? uniq(a) : []; }
    return [];
  }
  function itemHas(it, chars) {
    const a = itemChars(it);
    for (let i = 0; i < a.length; i++) if (chars.indexOf(a[i]) >= 0) return true;
    return false;
  }

  /* ================= 部首家族 ================= */
  // 同一家族的不同写法并在一起（氵/水、亻/人、忄/心……）
  const FAMKEY = { '水': '氵', '氺': '氵', '人': '亻', '手': '扌', '忄': '心', '⺗': '心', '言': '讠', '訁': '讠', '钅': '金', '釒': '金', '食': '饣', '飠': '饣',
    '糸': '纟', '糹': '纟', '艸': '艹', '草': '艹', '灬': '火', '玉': '王', '衣': '衤', '示': '礻', '犬': '犭', '刂': '刀', '⺈': '刀', '牜': '牛', '竹': '⺮', '𥫗': '⺮', '辵': '辶', '⻌': '辶', '⻊': '足', '肉': '月', '⺼': '月' };
  const famKey = (r) => FAMKEY[r] || r;
  // 家族的“本字”（印章上写“水家族”而不是“氵家族”）
  const FAMWORD = { '氵': '水', '亻': '人', '扌': '手', '讠': '言', '饣': '食', '纟': '丝', '艹': '草', '⺮': '竹', '犭': '犬', '衤': '衣', '礻': '示', '辶': '走', '阝': '耳', '冫': '冰', '宀': '宝', '囗': '国', '疒': '病', '彳': '行', '攵': '文' };
  const famWord = (k) => FAMWORD[k] || k;
  // 部首名称：只写位置不会弄错的（口/日/木这类在左在下名字不同，只显示字本身，免得教错）
  const RADNAME = { '氵': '三点水', '亻': '单人旁', '扌': '提手旁', '讠': '言字旁', '钅': '金字旁', '饣': '食字旁', '纟': '绞丝旁', '艹': '草字头', '宀': '宝盖头',
    '辶': '走之', '阝': '耳刀旁', '刂': '立刀旁', '冫': '两点水', '犭': '反犬旁', '衤': '衣字旁', '礻': '示字旁', '灬': '四点底', '⺮': '竹字头', '彳': '双人旁',
    '疒': '病字旁', '广': '广字旁', '穴': '穴宝盖', '攵': '反文旁', '囗': '国字框', '门': '门字框', '忄': '竖心旁', '页': '页字边', '雨': '雨字头' };
  const KNOWN_RADS = '氵亻扌讠忄钅饣纟艹宀辶阝刂冫犭衤礻灬⺮彳疒广穴攵囗门口日月木火土王目足虫石禾米女贝车马鸟鱼山田页雨力巾尸户欠耳舟心水人手言金食草竹走衣示犬刀';
  // 字宠：每个家族一个造型（没有专属造型的家族用“字精灵”）
  const PETS = {
    '氵': { nm: '水龙', e: '🐉', c1: '#9FE3FF', c2: '#2E8FE8' }, '木': { nm: '树精', e: '🌳', c1: '#C8F59A', c2: '#3FA548', face: 1 },
    '火': { nm: '火狐', e: '🦊', c1: '#FFD29A', c2: '#F0621E' }, '日': { nm: '太阳鸟', e: '🐦', c1: '#FFF19A', c2: '#F2A516' },
    '口': { nm: '鹦鹉', e: '🦜', c1: '#B6F5C9', c2: '#E8452F' }, '亻': { nm: '小精灵', e: '🧚', c1: '#F3D2FF', c2: '#9A55E6' },
    '扌': { nm: '手手猴', e: '🐒', c1: '#F4D9B5', c2: '#A8672E' }, '艹': { nm: '花仙兔', e: '🐰', c1: '#D8F7B0', c2: '#6CC04A' },
    '讠': { nm: '信鸽', e: '🕊️', c1: '#E3ECFF', c2: '#6D8FD8' }, '女': { nm: '蝴蝶仙', e: '🦋', c1: '#FFD6EC', c2: '#E0569B' },
    '土': { nm: '土拨鼠', e: '🐹', c1: '#F6E0B8', c2: '#B7803E' }, '心': { nm: '心心熊', e: '🐻', c1: '#FFD0D6', c2: '#E4506A' },
    '辶': { nm: '飞毛马', e: '🐴', c1: '#FFE5C2', c2: '#C77A36' }, '目': { nm: '大眼鹰', e: '🦉', c1: '#E9DBC8', c2: '#8C6A43' },
    '月': { nm: '月亮兔', e: '🐇', c1: '#FFF4C8', c2: '#D6A92E' }, '纟': { nm: '丝丝蚕', e: '🐛', c1: '#E4FFB8', c2: '#7DB82E' },
    '宀': { nm: '小蜗牛', e: '🐌', c1: '#F7E3C8', c2: '#C9894A' }, '雨': { nm: '云朵羊', e: '🐑', c1: '#E6F2FF', c2: '#7FA7D6' },
    '虫': { nm: '瓢虫', e: '🐞', c1: '#FFD2CC', c2: '#D8352A' }, '金': { nm: '金甲龟', e: '🐢', c1: '#FFF0A8', c2: '#D9A300' },
    '山': { nm: '山羊', e: '🐐', c1: '#E2E8EF', c2: '#7D8FA6' }, '田': { nm: '田田牛', e: '🐮', c1: '#E9F7D9', c2: '#6F9E3A' },
    '足': { nm: '袋鼠', e: '🦘', c1: '#F9DEC0', c2: '#B8733A' }, '王': { nm: '玉角兽', e: '🦄', c1: '#F0E0FF', c2: '#A46BE0' },
    '禾': { nm: '稻草鸡', e: '🐔', c1: '#FFF1C2', c2: '#D9A437' }, '米': { nm: '米米鸡', e: '🐥', c1: '#FFF6C4', c2: '#F2B705' },
    '⺮': { nm: '竹熊猫', e: '🐼', c1: '#DDF5D2', c2: '#4E9F4A' }, '贝': { nm: '贝壳蟹', e: '🦀', c1: '#FFDCCB', c2: '#E0582E' },
    '犭': { nm: '小狗狗', e: '🐶', c1: '#F7E6D0', c2: '#B8834F' }, '饣': { nm: '馋馋猪', e: '🐷', c1: '#FFDDE6', c2: '#E77A9A' },
    '门': { nm: '看门狮', e: '🦁', c1: '#FFE8B0', c2: '#D48A1C' }, '囗': { nm: '圆圆鲸', e: '🐳', c1: '#CDEBFF', c2: '#2C7FC9' },
    '石': { nm: '石头刺猬', e: '🦔', c1: '#E4E0DA', c2: '#8A7B6A' }, '马': { nm: '小马驹', e: '🐎', c1: '#F4DEC6', c2: '#9C6436' },
    '鸟': { nm: '小黄鸟', e: '🐤', c1: '#FFF3B0', c2: '#E8B400' }, '鱼': { nm: '小丑鱼', e: '🐠', c1: '#FFE0C2', c2: '#F07A1E' },
    '刀': { nm: '剑鱼', e: '🐟', c1: '#D6ECFF', c2: '#4A86C8' }, '牛': { nm: '小牛牛', e: '🐂', c1: '#F3E2CC', c2: '#A06A3A' },
    '大': { nm: '大象', e: '🐘', c1: '#E2E6F0', c2: '#8390A8' }
  };
  const PET0 = { nm: '字精灵', e: '🐲', c1: '#D9F7E8', c2: '#2FB585' };
  const petOf = (k) => PETS[k] || PET0;
  const DEFAULT_FAMS = ['氵', '木', '火', '日', '口', '亻', '扌', '艹'];
  const GROW = 20;          // 宝宝吃满 20 份饼干长成少年（普通饼干 1 份、金饼干 3 份；每天最多 10 块 → 最快 2 天）
  const COOKIE_DAY = 10;    // 每天最多 10 块饼干（答对的字再多也一样）：宠物按天长大，不按玩了多久
  const EGG_PER = 3;        // 喂蛋：每份饼干 +3 度（每天最多约 +36 度）→ 蛋大约 2 天孵出来
  const GAPS = [1, 2, 4];   // 升箱间隔：铜→银 ≥1 天、→银+ ≥2 天（第 3 天）、→金 ≥4 天（第 7 天）
  const GOLD_GAP = 14;      // 金卡之后：14 天后再复习一次（Leitner 第 5 格）
  const CAPD = 8;           // 每张卡只留最近 8 个“答对日”（够重算卡级；文档大小可控）
  const LV = ['灰卡', '铜卡', '银卡', '金卡'];
  const LVC = ['gray', 'bronze', 'silver', 'gold'];
  const N_NEW = { p2: 4, p3: 5, p4: 5, p5: 6, p6: 6 };
  // 今日指定游戏：优先 B/C 型（华文决定规则 / 读懂才能造出来）
  const TODAY_PREF = ['suika', 'tonerun', 'slash', 'sling', 'stall', 'snake', 'monster', 'fishing', 'mole'];
  // 丰收局候选：题目对象里能直接读出“考哪个字”的街机
  const HARVEST_PREF = ['catcher', 'memory', 'balloon', 'fishing', 'slash', 'sling', 'tonerun', 'mole', 'monster'];
  const CHAR_COLS = ['words', 'chars', 'pick', 'build', 'typo', 'jg', 'recipes', 'zuci'];

  /* ================= 题库 → 每个年级的字表 / 拼音 / 组词 / 部首 ================= */
  const raw = (gr) => { const all = W.HW_DATA; return isObj(all) && isObj(all[gr]) ? all[gr] : {}; };
  const col = (g, c) => (Array.isArray(g[c]) ? g[c] : []);
  const cache = {};
  /* ext_bushou.json 实际格式：{p2:{bushou:[{c, bs 部首, fam 家族（“其他”= 不成家族）, gf? 规范归部不同时的另一个部首}], bushou_stats:[{fam, n, cs}]}}；
     也兼容 {c, bs} / {字: 部首} / 带 _stats 的写法 */
  const NOFAM = { '其他': 1, '其它': 1, '无': 1, '-': 1 };
  function parseBushou(g) {
    const rad = {}, fam = {}, gf = {}; let stats = null;
    const take = (it) => {
      if (!isObj(it)) return;
      if (has(it, '_stats')) { stats = it._stats; return; }
      const ch = str(it.c || it.ch || it.char || it.hz || it.zi || it.z);
      if (Array.from(ch).length !== 1) return;
      const bs = str(it.bs || it.bushou || it.rad || it.radical || it.b || it.r);
      const hasF = has(it, 'fam') || has(it, 'family');
      const f = hasF ? str(it.fam || it.family) : '';
      if (bs) rad[ch] = bs;
      if (hasF) fam[ch] = f && !NOFAM[f] ? famKey(f) : '';
      else if (bs) fam[ch] = famKey(bs);
      if (str(it.gf) && str(it.gf) !== bs) gf[ch] = str(it.gf);
    };
    const b = g.bushou;
    if (Array.isArray(b)) b.forEach(take);
    else if (isObj(b)) Object.keys(b).forEach((k) => {
      if (k === '_stats') stats = b[k];
      else if (typeof b[k] === 'string') take({ c: k, bs: b[k] });
      else if (isObj(b[k])) take(Object.assign({ c: k }, b[k]));
    });
    const st = g._stats || g.bushou_stats || g.bushouStats;
    if (!stats && st) stats = Array.isArray(st) && st.length === 1 && isObj(st[0]) && has(st[0], '_stats') ? st[0]._stats : st;
    const o = {};
    const add = (k, n) => { k = str(k); if (!k || NOFAM[k]) return; k = famKey(k); o[k] = (o[k] || 0) + Math.max(0, num(n)); };
    if (Array.isArray(stats)) stats.forEach((x) => {
      if (Array.isArray(x) && x.length >= 2) add(x[0], x[1]);
      else if (isObj(x)) add(x.fam || x.bs || x.k || x.key || x.bushou || x.rad || x.radical,
        x.n != null ? x.n : x.count != null ? x.count : Array.isArray(x.chars) ? x.chars.length : typeof x.cs === 'string' ? Array.from(x.cs).length : Array.isArray(x.c) ? x.c.length : 0);
    });
    else if (isObj(stats)) Object.keys(stats).forEach((k) => {
      const v = stats[k];
      add(k, typeof v === 'number' ? v : isObj(v) ? (v.n != null ? v.n : v.count != null ? v.count : Array.isArray(v.chars) ? v.chars.length : 0) : Array.isArray(v) ? v.length : 0);
    });
    return { rad, fam, gf, stats: o, has: Object.keys(rad).length > 0 };
  }
  function gdata(gr) {
    if (cache[gr]) return cache[gr];
    const g = raw(gr);
    const info = {}, order = [];
    const add = (ch) => { if (!info[ch]) { info[ch] = { py: '', words: [], sent: '', jg: '' }; order.push(ch); } return info[ch]; };
    const addWord = (ch, w) => { const o = info[ch]; w = str(w); if (o && w && w !== ch && w.indexOf(ch) >= 0 && o.words.indexOf(w) < 0 && o.words.length < 6) o.words.push(w); };
    col(g, 'jg').forEach((it) => {
      if (!isObj(it) || typeof it.c !== 'string' || Array.from(it.c).length !== 1 || !HZ.test(it.c)) return;
      const o = add(it.c);
      if (!o.py && str(it.py)) o.py = str(it.py);
      if (!it.skip && str(it.jg)) o.jg = str(it.jg);
      addWord(it.c, it.w);
    });
    col(g, 'chars').forEach((it) => {
      if (!isObj(it) || typeof it.c !== 'string' || !HZ.test(it.c)) return;
      const o = add(it.c);
      if (!o.py && str(it.py)) o.py = str(it.py);
      if (!o.jg && str(it.jg)) o.jg = str(it.jg);
      (Array.isArray(it.words) ? it.words : []).forEach((w) => addWord(it.c, w));
    });
    col(g, 'words').forEach((it) => {
      if (!isObj(it) || typeof it.w !== 'string') return;
      const cs = Array.from(it.w), py = String(it.py || '').trim().split(/\s+/);
      cs.forEach((ch, i) => {
        if (!HZ.test(ch)) return;
        const o = add(ch);
        if (!o.py && py.length === cs.length && ch !== '一' && ch !== '不') o.py = py[i];   // 一/不 在词里是变调，不拿来当单字读音
        addWord(ch, it.w);
        if (!o.sent && typeof it.s === 'string' && it.s.indexOf(ch) >= 0 && Array.from(it.s).length <= 40) o.sent = it.s;
      });
    });
    // 听音选词（pick.say）里的字也算本年级的字（部首表 ext_bushou.json 同样收了它们）
    col(g, 'pick').forEach((it) => {
      if (!isObj(it) || typeof it.say !== 'string') return;
      const cs = Array.from(it.say), py = String(it.py || '').trim().split(/\s+/);
      if (cs.length > 4) return;
      cs.forEach((ch, i) => {
        if (!HZ.test(ch)) return;
        const o = add(ch);
        if (!o.py && py.length === cs.length && ch !== '一' && ch !== '不') o.py = py[i];
        addWord(ch, it.say);
      });
    });
    // 只给已在字表里的字补组词（不扩大图鉴范围）
    col(g, 'zuci').forEach((it) => { if (isObj(it) && info[it.c] && Array.isArray(it.ok)) it.ok.forEach((x) => isObj(x) && addWord(it.c, x.w)); });
    col(g, 'recipes').forEach((it) => { if (isObj(it) && info[it.ans]) addWord(it.ans, it.word); });
    col(g, 'build').forEach((it) => { if (isObj(it) && info[it.ans]) addWord(it.ans, it.hint); });
    col(g, 'pick').forEach((it) => {
      if (!isObj(it) || typeof it.ctx !== 'string' || Array.from(it.ctx).length > 40) return;
      hzs(it.say).forEach((ch) => { if (info[ch] && !info[ch].sent) info[ch].sent = it.ctx; });
    });
    // 部首：ext_bushou.json（HW_DATA[年级].bushou）为准；缺的用 chars.bs、build.rad、recipes 的部件（只认常见部首写法）兜底
    const bz = parseBushou(g);
    const rad = Object.assign({}, bz.rad);
    col(g, 'chars').forEach((it) => { if (isObj(it) && typeof it.c === 'string' && str(it.bs) && !rad[it.c]) rad[it.c] = str(it.bs); });
    col(g, 'build').forEach((it) => { if (isObj(it) && str(it.ans) && str(it.rad) && !rad[it.ans] && KNOWN_RADS.indexOf(it.rad) >= 0) rad[it.ans] = str(it.rad); });
    col(g, 'recipes').forEach((it) => { if (isObj(it) && str(it.ans) && str(it.a) && !rad[it.ans] && KNOWN_RADS.indexOf(it.a) >= 0) rad[it.ans] = str(it.a); });
    const fam = {}, cnt = {};
    order.forEach((ch) => {
      const k = has(bz.fam, ch) ? bz.fam[ch] : (rad[ch] ? famKey(rad[ch]) : '');
      if (k) { fam[ch] = k; cnt[k] = (cnt[k] || 0) + 1; }
    });
    const famList = Object.keys(cnt).map((k) => ({ k, n: bz.stats[k] != null && bz.stats[k] >= cnt[k] ? bz.stats[k] : cnt[k], got: cnt[k], chars: order.filter((ch) => fam[ch] === k) }))
      .sort((a, b) => b.n - a.n || order.indexOf(a.chars[0]) - order.indexOf(b.chars[0]));
    return (cache[gr] = { gr, info, order, rad, fam, gf: bz.gf, famList, fromBushou: bz.has });
  }
  function charInfo(ch, gr) {
    const g0 = gdata(gr);
    if (g0.info[ch]) return g0.info[ch];
    for (const g of ['p2', 'p3', 'p4', 'p5', 'p6']) { const d = gdata(g); if (d.info[ch]) return d.info[ch]; }
    return { py: '', words: [], sent: '', jg: '' };
  }
  function radOf(ch, gr) {
    const g0 = gdata(gr);
    if (g0.rad[ch]) return g0.rad[ch];
    for (const g of ['p2', 'p3', 'p4', 'p5', 'p6']) { const d = gdata(g); if (d.rad[ch]) return d.rad[ch]; }
    return '';
  }
  function famOfChar(ch, gr) {
    const g0 = gdata(gr);
    if (has(g0.fam, ch)) return g0.fam[ch];
    for (const g of ['p2', 'p3', 'p4', 'p5', 'p6']) { const d = gdata(g); if (has(d.fam, ch)) return d.fam[ch]; }
    const r = radOf(ch, gr);
    return r && !g0.fromBushou ? famKey(r) : '';
  }
  function gfOf(ch, gr) {
    for (const g of [gr, 'p2', 'p3', 'p4', 'p5', 'p6']) { const d = gdata(g); if (d.gf && d.gf[ch]) return d.gf[ch]; }
    return '';
  }
  /* 部首的显示：“部首 冂（字典里也归“一”部）” */
  function radLabel(ch, gr) {
    const r = radOf(ch, gr);
    if (!r) return '';
    const gfr = gfOf(ch, gr);
    return r + (RADNAME[r] ? '（' + RADNAME[r] + '）' : '') + (gfr ? '，有的字典归“' + gfr + '”部' : '');
  }
  /* 读音短语：“晴，晴天的晴” */
  function sayOf(ch, gr) {
    const w = charInfo(ch, gr).words[0];
    return w ? ch + '，' + w + '的' + ch : ch;
  }
  /* 选蛋：本年级字数最多的 5–6 个家族（不够时用常见家族补） */
  function eggFams(gr) {
    const d = gdata(gr);
    const out = d.famList.filter((f) => f.got >= 2).slice(0, 6).map((f) => f.k);
    d.famList.forEach((f) => { if (out.length < 5 && out.indexOf(f.k) < 0 && f.got >= 1) out.push(f.k); });
    DEFAULT_FAMS.forEach((k) => { if (out.length < 5 && out.indexOf(k) < 0) out.push(k); });
    return out.slice(0, 6);
  }

  /* ================= 字卡 ================= */
  /* 云端存档用的紧凑写法（forDb 调 pack）：[s, r, w, b, bl, x, f, k, ...d]，日期写成“1970 年起的第几天”（0 = 空）。
     1000 张卡约 70KB，远低于 db 单文档 256KB 上限；normCard 两种写法都认。 */
  const dn = (s) => (isDate(s) ? dnum(s) : 0);
  const ds = (n) => (Number.isInteger(n) && n > 0 ? dstr(n) : '');
  function unpackCard(a) {
    return { s: a[0], r: a[1], w: a[2], b: a[3], bl: ds(a[4]), x: ds(a[5]), f: ds(a[6]), k: ds(a[7]), d: a.slice(8).map(ds) };
  }
  function packCard(c, tight) {
    const d = tight ? c.d.slice(-2) : c.d;
    return [c.s, c.r, c.w, c.b, dn(c.bl), dn(c.x), dn(c.f), dn(c.k)].concat(d.map(dn));
  }
  function pack(o, tight) {
    if (!isObj(o) || !isObj(o.cards)) return o;
    const cards = {};
    Object.keys(o.cards).forEach((ch) => { const c = o.cards[ch]; if (isObj(c) && Array.isArray(c.d)) cards[ch] = packCard(c, tight); });
    o.cards = cards;
    return o;
  }
  function normCard(c) {
    if (Array.isArray(c)) c = unpackCard(c.map((x) => Math.round(num(x))));
    c = isObj(c) ? c : {};
    const d = uniq((Array.isArray(c.d) ? c.d : []).filter(isDate)).sort().slice(-CAPD);
    const o = { s: Math.max(0, Math.round(num(c.s))), r: Math.max(0, Math.round(num(c.r))), w: Math.max(0, Math.round(num(c.w))), d,
      b: clamp(Math.round(num(c.b)), 0, 4), bl: isDate(c.bl) ? c.bl : '', x: isDate(c.x) ? c.x : '', f: isDate(c.f) ? c.f : '', k: isDate(c.k) ? c.k : '' };
    if (o.r < d.length) o.r = d.length;
    if (o.s < o.r + o.w) o.s = o.r + o.w;
    if (o.b && !o.bl) o.bl = d.length ? d[0] : '';
    if (!o.f && d.length) o.f = d[0];
    if (d.length && (!o.k || o.k < d[d.length - 1])) o.k = d[d.length - 1];
    const rp = replay(d);
    if (rp.b > o.b) { o.b = rp.b; o.bl = rp.bl; }
    if (!o.b && d.length) { o.b = 1; o.bl = d[0]; }
    return o;
  }
  function replay(d) {
    if (!d.length) return { b: 0, bl: '' };
    let b = 1, bl = d[0];
    for (let i = 1; i < d.length && b < 4; i++) if (diff(d[i], bl) >= GAPS[b - 1]) { b++; bl = d[i]; }
    return { b, bl };
  }
  /* -1 没收集 · 0 灰 · 1 铜 · 2 银 · 3 金 */
  function level(c) { if (!c) return -1; return c.b >= 4 ? 3 : c.b >= 2 ? 2 : c.b >= 1 ? 1 : c.s > 0 ? 0 : -1; }
  function dueOf(c) {
    if (!c) return '';
    let due;
    const last = c.d.length ? c.d[c.d.length - 1] : '';
    // 金卡：最后一次答对后 14 天再复习（bl 升到金卡后不再变，不能拿它算，否则金卡天天到期）
    if (c.b >= 4) due = addDays(last > c.bl ? last : c.bl, GOLD_GAP);
    else if (c.b >= 1 && c.bl) due = addDays(c.bl, GAPS[c.b - 1]);
    else if (c.s > 0 && c.f) due = addDays(c.f, 1);
    else return '';
    if (c.x && c.x >= last) { const xd = addDays(c.x, 1); if (xd < due) due = xd; }
    return due;
  }
  /* 今天答错过、又还没“干净地”答对（答错后排除法蒙对的不算）：今天不升级，明天再答对才升 */
  const tainted = (c, t) => !!(c && c.x === t && c.d.indexOf(t) < 0);
  function tipOf(c) {
    const lv = level(c), t = today();
    if (lv < 0) return '还没收集。在游戏里答对它，就能收进图鉴。';
    if (tainted(c, t)) return '今天答错过它，没关系！明天再答对，它就会升级。';
    if (lv === 0) return '见过它啦！在游戏里答对一次，就升成铜卡。';
    const due = dueOf(c), when = due <= t ? '今天' : (diff(due, t) === 1 ? '明天' : mdStr(due));
    if (c.b === 1) return '隔一天再答对一次，就升银卡（' + when + '就可以）。';
    if (c.b === 2) return '再隔 2 天答对一次（' + when + '），然后再隔 4 天答对，就是金卡！';
    if (c.b === 3) return '离金卡只差一步：' + when + '以后再答对一次！';
    return '金卡！按第 1、3、7 天的间隔都答对了，真正记住啦。' + when + '再来复习一次。';
  }
  function cardOf(p, ch) { return p.cards && p.cards[ch] ? p.cards[ch] : null; }

  /* ================= 钱包（每台设备各记各的，合并取最大，永远不会翻倍） ================= */
  let devId = C.LS.get('dev', null);
  if (typeof devId !== 'string' || !/^[a-z0-9]{4,16}$/.test(devId)) { devId = 'd' + Math.random().toString(36).slice(2, 9); C.LS.set('dev', devId); }
  const SYN = new WeakSet();   // 这台设备临时补出来的钱包（旧档案迁移）：合并时让位给真正记过账的
  function walletOf(p) {
    let e = 0, s = 0;
    Object.keys(p.purse || {}).forEach((k) => { const v = p.purse[k]; e += v[0]; s += v[1]; });
    return Math.max(0, e - s);
  }
  /* 钱包里记过的“挣到的”总数 = 真正的累计小红花；flowers（核心按 updatedAt 新者胜）不能比它少，否则钱包 > 累计 */
  function earnedOf(p) { let e = 0; Object.keys(p.purse || {}).forEach((k) => { e += p.purse[k][0]; }); return e; }
  function syncFlowers(p) { p.wallet = walletOf(p); const e = earnedOf(p); if (num(p.flowers) < e) p.flowers = e; }

  /* ================= 规范化 / 合并（核心在 normProfile 与同步时调用） ================= */
  function normPet(pt) {
    if (!isObj(pt) || !str(pt.f)) return null;
    const ate = isObj(pt.ate) && isDate(pt.ate.d) ? { d: pt.ate.d, c: uniq((Array.isArray(pt.ate.c) ? pt.ate.c : []).filter((x) => typeof x === 'string' && x)).slice(0, 60) } : { d: '', c: [] };
    return { f: str(pt.f), at: isDate(pt.at) ? pt.at : today(), t: Math.max(0, num(pt.t)), h: isDate(pt.h) ? pt.h : '',
      eg: Math.max(0, Math.round(num(pt.eg))), fed: Math.max(0, Math.round(num(pt.fed))), ate, v: isDate(pt.v) ? pt.v : '', n: isDate(pt.n) ? pt.n : '' };
  }
  function normVoy(v) {
    if (!isObj(v) || !isDate(v.d)) return null;
    const s = {};
    ['h', 'n', 'g', 'c'].forEach((k) => { if (isObj(v.s) && v.s[k]) s[k] = 1; });
    const chars = (a) => uniq((Array.isArray(a) ? a : []).filter((x) => typeof x === 'string' && HZ.test(x) && Array.from(x).length === 1)).slice(0, 12);
    // rc：今天每个“游戏:关卡”玩了几局（同一关反复刷，小红花递减）
    const rc = {};
    if (isObj(v.rc)) Object.keys(v.rc).slice(0, 60).forEach((k) => { const n = Math.round(num(v.rc[k])); if (n > 0 && k.length <= 40) rc[k] = Math.min(n, 999); });
    return { d: v.d, gr: str(v.gr), s, g: str(v.g), nw: chars(v.nw), hv: chars(v.hv), hg: str(v.hg), ni: clamp(Math.round(num(v.ni)), 0, 12), pf: str(v.pf), rc };
  }
  function norm(o, p) {
    const cards = {};
    if (isObj(p.cards)) Object.keys(p.cards).forEach((ch) => { if (Array.from(ch).length === 1 && HZ.test(ch)) cards[ch] = normCard(p.cards[ch]); });
    o.cards = cards;
    o.pet = normPet(p.pet);
    o.voy = normVoy(p.voy);
    const purse = {};
    let real = isObj(p.purse);
    if (real) Object.keys(p.purse).forEach((k) => {
      const v = p.purse[k];
      if (Array.isArray(v) && /^[\w-]{1,20}$/.test(k)) purse[k] = [Math.max(0, Math.round(num(v[0]))), Math.max(0, Math.round(num(v[1])))];
    });
    else if (o.flowers > 0) purse._0 = [o.flowers, 0];   // 旧档案：钱包从已有的小红花起步
    o.purse = purse;
    if (!real) SYN.add(purse);
    syncFlowers(o);
    o.days = uniq(o.days.filter(isDate)).sort().slice(-400);
  }
  function sig(p) { return JSON.stringify([p.cards, p.pet, p.voy, p.purse, p.days, p.pt, p.flowers]); }
  const wAte = (a) => a.slice(0, COOKIE_DAY).reduce((n, x) => n + (x === '★' ? 3 : 1), 0);
  /* 把 b 的元游戏进度并进 a（就地改 a）。规则：数值取最大，日期/集合取并集；同一天的航线打勾取并集 */
  function merge(a, b) {
    // 字卡
    Object.keys(b.cards || {}).forEach((ch) => {
      const y = b.cards[ch], x = a.cards[ch];
      if (!x) { a.cards[ch] = clone(y); return; }
      const d = uniq(x.d.concat(y.d)).sort().slice(-CAPD);
      const pickB = y.b > x.b || (y.b === x.b && y.bl && (!x.bl || y.bl < x.bl));
      const m = { s: Math.max(x.s, y.s), r: Math.max(x.r, y.r), w: Math.max(x.w, y.w), d, b: pickB ? y.b : x.b, bl: pickB ? y.bl : x.bl,
        x: x.x > y.x ? x.x : y.x, f: [x.f, y.f].filter(Boolean).sort()[0] || '', k: (x.k || '') > (y.k || '') ? x.k : (y.k || '') };
      const rp = replay(d);
      if (rp.b > m.b) { m.b = rp.b; m.bl = rp.bl; }
      a.cards[ch] = m;
    });
    // 字宠：只有一边有 → 用它；两边家族不同 → 先选的那颗蛋为准（不会凭空多一只）
    if (b.pet && !a.pet) a.pet = clone(b.pet);
    else if (a.pet && b.pet) {
      const x = a.pet, y = b.pet;
      if (x.f !== y.f) { if (y.t && (!x.t || y.t < x.t)) a.pet = clone(y); }
      else {
        const m = { f: x.f, at: x.at < y.at ? x.at : y.at, t: Math.min(x.t || y.t, y.t || x.t), h: [x.h, y.h].filter(Boolean).sort()[0] || '',
          eg: Math.max(x.eg, y.eg), fed: Math.max(x.fed, y.fed), ate: x.ate, v: x.v > y.v ? x.v : y.v, n: [x.n, y.n].filter(Boolean).sort()[0] || '' };
        if (x.ate.d === y.ate.d) {
          const u = uniq(x.ate.c.concat(y.ate.c)).slice(0, COOKIE_DAY);
          const extra = Math.max(0, wAte(u) - Math.max(wAte(x.ate.c), wAte(y.ate.c)));   // 两台设备各喂了不同的饼干：补上对方多喂的
          if (m.h) m.fed += extra; else m.eg += extra;
          m.ate = { d: x.ate.d, c: u };
        } else m.ate = x.ate.d > y.ate.d ? x.ate : clone(y.ate);
        a.pet = m;
      }
    }
    // 航线：日期新的为准；同一天打勾取并集
    if (b.voy && (!a.voy || b.voy.d > a.voy.d)) a.voy = clone(b.voy);
    else if (a.voy && b.voy && a.voy.d === b.voy.d) {
      Object.keys(b.voy.s).forEach((k) => { a.voy.s[k] = 1; });
      if (!a.voy.rc) a.voy.rc = {};
      Object.keys(b.voy.rc || {}).forEach((k) => { a.voy.rc[k] = Math.max(a.voy.rc[k] || 0, b.voy.rc[k]); });
      ['g', 'hg', 'gr'].forEach((k) => { if (!a.voy[k] && b.voy[k]) a.voy[k] = b.voy[k]; });
      a.voy.ni = Math.max(a.voy.ni || 0, b.voy.ni || 0);
      if (!a.voy.nw.length) a.voy.nw = b.voy.nw.slice();
      if (!a.voy.hv.length) a.voy.hv = b.voy.hv.slice();
    }
    // 钱包：每台设备的账各取最大
    if (b.purse) {
      if (SYN.has(a.purse) && !SYN.has(b.purse)) a.purse = clone(b.purse);
      else if (!(SYN.has(b.purse) && !SYN.has(a.purse))) Object.keys(b.purse).forEach((k) => {
        const x = a.purse[k], y = b.purse[k];
        a.purse[k] = x ? [Math.max(x[0], y[0]), Math.max(x[1], y[1])] : y.slice();
      });
    }
    // 累计小红花：两边取大，而且不少于钱包里记过的“挣到的”总数（两台设备同时挣，核心的 flowers 只留一边）
    a.flowers = Math.max(num(a.flowers), num(b.flowers));
    syncFlowers(a);
    // 完成航线的日子：并集
    a.days = uniq(a.days.concat(b.days || [])).filter(isDate).sort().slice(-400);
    // 今天玩了多久：同一天取最大
    if (b.pt && isDate(b.pt.d) && (!a.pt || !a.pt.d || b.pt.d > a.pt.d)) a.pt = { d: b.pt.d, s: b.pt.s };
    else if (b.pt && a.pt && a.pt.d === b.pt.d) a.pt.s = Math.max(a.pt.s, b.pt.s);
  }
  /* 本机预置档案并入云端同名档案：进度叠加（和核心的小红花一样是加法） */
  function absorb(o, l) {
    // 核心已经把本机预置档案的 flowers 加到云端档案上（加法）；钱包同样按设备逐项相加（本机的旧档案补出来的 _0 也要加，
    // 否则钱包会比累计少一截）。先拷贝：merge 会就地改 o.purse
    const purseO = clone(o.purse) || {}, purseL = clone(l.purse) || {}, fl = num(o.flowers);
    merge(o, l);
    o.purse = purseO;
    Object.keys(purseL).forEach((k) => {
      const x = o.purse[k], y = purseL[k];
      o.purse[k] = x ? [x[0] + y[0], x[1] + y[1]] : y.slice();
    });
    o.flowers = fl;
    syncFlowers(o);
  }
  function earn(p, n) {
    if (!p.purse || SYN.has(p.purse)) { const old = p.purse || {}; p.purse = clone(old) || {}; }
    const v = p.purse[devId] || (p.purse[devId] = [0, 0]);
    v[0] += n;
    syncFlowers(p);
  }

  /* ================= 答题 → 字卡 / 饼干 / 蛋的温度 ================= */
  function answer(p, item, ok, sess) {
    const chs = itemChars(item);
    if (!chs.length) return;
    const t = today();
    if (!p.cards) p.cards = {};
    const heat0 = p.pet && !p.pet.h ? heatOf(p) : 0;
    const m = sess && sess.meta;
    chs.forEach((ch) => {
      let c = p.cards[ch];
      const lv0 = level(c);
      if (!c) c = p.cards[ch] = { s: 0, r: 0, w: 0, d: [], b: 0, bl: '', x: '', f: '', k: '' };
      c.s++;
      if (!c.f) c.f = t;
      let first = false;
      if (ok) {
        c.r++;
        first = c.k !== t;
        c.k = t;
        // 同一天：只有“今天还没答错过”的答对才算一个答对日（答错后排除法蒙对的不升级，明天再来）；同一天刷再多也只算一次
        if (!tainted(c, t) && c.d.indexOf(t) < 0) {
          c.d.push(t); c.d.sort(); if (c.d.length > CAPD) c.d = c.d.slice(-CAPD);
          if (c.b === 0) { c.b = 1; c.bl = t; }
          else if (c.b < 4 && diff(t, c.bl) >= GAPS[c.b - 1]) { c.b++; c.bl = t; }
        }
      } else { c.w++; c.x = t; }
      const lv1 = level(c);
      if (m) {
        if (lv0 < 0 && m.fresh.indexOf(ch) < 0) m.fresh.push(ch);
        if (lv0 >= 0 && lv1 > lv0 && lv1 >= 1) { const u = m.ups.find((x) => x.ch === ch); if (u) u.lv = Math.max(u.lv, lv1); else m.ups.push({ ch, lv: lv1 }); }
        if (first && m.cookies.indexOf(ch) < 0) m.cookies.push(ch);
      }
    });
    if (p.pet && !p.pet.h) {
      const heat1 = heatOf(p);
      if (m) m.heat += Math.max(0, heat1 - heat0);
      if (heat1 >= 100) { p.pet.h = t; if (m) m.hatched = true; }
    }
    if (checkNeon(p) && m) m.neon = true;
    C.touch(p);
  }
  /* 霓虹：少年字宠 + 本年级这个家族的字全部金卡（至少 3 个字）→ 变成霓虹（只和掌握程度挂钩；得到后一直保留） */
  function famGold(p) {
    if (!p.pet) return [0, 0];
    const d = gdata(p.grade), fc = d.order.filter((ch) => d.fam[ch] === p.pet.f);
    return [fc.filter((ch) => level(cardOf(p, ch)) === 3).length, fc.length];
  }
  function checkNeon(p) {
    const pet = p.pet;
    if (!pet || !pet.h || pet.n || pet.fed < GROW) return false;
    const fg = famGold(p);
    if (fg[1] >= 3 && fg[0] === fg[1]) { pet.n = today(); return true; }
    return false;
  }
  function heatOf(p) {
    const pet = p.pet;
    if (!pet) return 0;
    if (pet.h) return 100;
    let tot = pet.eg * EGG_PER;
    Object.keys(p.cards || {}).forEach((ch) => {
      if (famOfChar(ch, p.grade) !== pet.f) return;
      const c = p.cards[ch];
      c.d.forEach((d) => { if (d >= pet.at) tot += 10; });
      if (c.b >= 4 && c.bl >= pet.at) tot += 25;
    });
    return Math.min(100, tot);
  }
  function stageOf(p) {
    if (!p.pet) return 'none';
    if (!p.pet.h) return 'egg';
    if (p.pet.n) return 'neon';
    return p.pet.fed >= GROW ? 'teen' : 'baby';
  }
  function petName(p) {
    const P = petOf(p.pet.f), st = stageOf(p);
    return st === 'egg' ? P.nm + '蛋' : st === 'neon' ? '霓虹' + P.nm : st === 'teen' ? '少年' + P.nm : P.nm + '宝宝';
  }
  const asleep = (p) => !!(p.pet && p.pet.v && diff(today(), p.pet.v) >= 2);
  /* 今天的饼干：今天答对过的字（每个字一块）+ 宝箱的金饼干；每天最多 COOKIE_DAY 块（先给字宠家族的字、再给等级低的字） */
  function cookiesToday(p) {
    const t = today();
    const eaten = p.pet && p.pet.ate && p.pet.ate.d === t ? p.pet.ate.c : [];
    const left = Math.max(0, COOKIE_DAY - eaten.length);
    if (!left) return [];
    const fam = p.pet ? p.pet.f : '';
    const list = Object.keys(p.cards || {}).filter((ch) => { const c = p.cards[ch]; return (c.k === t || c.d.indexOf(t) >= 0) && eaten.indexOf(ch) < 0; });
    const rank = (ch) => (fam && famOfChar(ch, p.grade) === fam ? 0 : 10) + Math.max(0, level(p.cards[ch]));
    list.sort((a, b) => rank(a) - rank(b));
    if (p.voy && p.voy.d === t && p.voy.s.c && eaten.indexOf('★') < 0) list.unshift('★');
    return list.slice(0, left);
  }

  /* ================= 每日航线 ================= */
  function gamesMap() { return C.games(); }
  function availableArcade(p) {
    const G = C.gradeData(p.grade), gs = gamesMap();
    return Object.keys(gs).filter((id) => C.isArcade(gs[id]) && C.availability(gs[id], G).ok);
  }
  function pickTodayGame(p, t) {
    const av = availableArcade(p);
    let c = TODAY_PREF.filter((id) => av.indexOf(id) >= 0);
    if (!c.length) c = av.filter((id) => id !== 'tug');
    if (!c.length) return '';
    return c[(dnum(t) + hashNum(p.id)) % c.length];
  }
  function dueChars(p, t) {
    const out = [];
    Object.keys(p.cards || {}).forEach((ch) => {
      const c = p.cards[ch], due = dueOf(c);
      if (due && due <= t && c.d.indexOf(t) < 0) out.push({ ch, due, b: c.b });
    });
    out.sort((a, b) => (a.b >= 4) - (b.b >= 4) || (a.due < b.due ? -1 : a.due > b.due ? 1 : 0) || a.b - b.b);
    return out.slice(0, 8).map((x) => x.ch);
  }
  function pickNew(p) {
    const d = gdata(p.grade), n = N_NEW[p.grade] || 5;
    const got = (ch) => p.cards[ch] && p.cards[ch].s > 0;
    let cand = d.order.filter((ch) => !got(ch));
    cand = cand.filter((ch) => C.hanzi.has(ch)).concat(cand.filter((ch) => !C.hanzi.has(ch)));   // 有笔顺数据的先出场（新字站要播笔顺）
    const fam = p.pet ? p.pet.f : '';
    const famC = fam ? cand.filter((ch) => d.fam[ch] === fam).slice(0, 2) : [];
    let out = cand.filter((ch) => famC.indexOf(ch) < 0).slice(0, n - famC.length).concat(famC);
    if (out.length < n) {   // 全都收集过了：复习几个等级最低的老朋友
      const old = d.order.filter((ch) => out.indexOf(ch) < 0).sort((a, b) => level(p.cards[a]) - level(p.cards[b]));
      out = out.concat(old.slice(0, n - out.length));
    }
    return out.sort((a, b) => d.order.indexOf(a) - d.order.indexOf(b));
  }
  /* 今天的航线（不存在就生成；换了年级且新字站还没做就重新挑新字） */
  function plan(p, save) {
    const t = today(), before = JSON.stringify(p.voy || null);
    let v = p.voy;
    if (!v || v.d !== t) v = p.voy = { d: t, gr: p.grade, s: {}, g: '', nw: [], hv: dueChars(p, t), hg: '', ni: 0, pf: p.pet ? p.pet.f : '' };
    // 换了年级 / 今天刚选了蛋（新字站还没开始）：重新挑新字，让蛋的家族字先出场
    const pf = p.pet ? p.pet.f : '';
    if (!v.nw.length || (!v.s.n && !v.ni && (v.gr !== p.grade || v.pf !== pf))) { v.nw = pickNew(p); v.gr = p.grade; v.pf = pf; v.ni = 0; if (!v.s.h) v.hv = dueChars(p, t); }
    const gs = gamesMap();
    if (!v.g || !gs[v.g]) v.g = pickTodayGame(p, t);
    if (!v.g) v.s.g = 1;   // 这个年级今天没有能玩的指定游戏：这一站休息，不挡宝箱
    if (save !== false && JSON.stringify(v) !== before) C.touch(p);
    return v;
  }
  function harvestGame(p, v) {
    const G = raw(p.grade), gs = gamesMap(), av = availableArcade(p);
    const chars = v.hv.length ? v.hv : [];
    let best = null, bestN = -1;
    const cand = HARVEST_PREF.filter((id) => av.indexOf(id) >= 0 && id !== v.g);
    if (!cand.length && av.indexOf(v.g) >= 0) cand.push(v.g);
    const rot = dnum(v.d) + hashNum(p.id);
    cand.forEach((id, i) => {
      const cols = (gs[id].cols || []).filter((c) => CHAR_COLS.indexOf(c) >= 0);
      if (!cols.length) return;
      const seen = new Set();
      cols.forEach((c) => col(G, c).forEach((it) => itemChars(it).forEach((ch) => { if (chars.indexOf(ch) >= 0) seen.add(ch); })));
      const score = seen.size * 100 + ((i + rot) % cand.length);
      if (score > bestN) { bestN = score; best = id; }
    });
    return best || (av.filter((id) => id !== 'tug')[0] || '');
  }
  const STATIONS = [
    { k: 'h', no: '①', nm: '丰收', ic: '🌾' },
    { k: 'n', no: '②', nm: '新字', ic: '✨' },
    { k: 'g', no: '③', nm: '今日游戏', ic: '🎮' },
    { k: 'c', no: '④', nm: '宝箱', ic: '🎁' }
  ];
  const doneN = (v) => STATIONS.filter((s) => v && v.s[s.k]).length;
  const chestReady = (v) => !!(v.s.h && v.s.n && v.s.g);

  /* ================= 灯塔：连胜 / 雾天卡 ================= */
  function tower(p) {
    const t = today();
    const days = uniq((p.days || []).filter((d) => isDate(d) && d <= t)).sort();
    const set = new Set(days);
    const res = { floors: days.length, lit: 0, fog: 1, fogUsed: new Set(), dimmed: new Set(), today: set.has(t), best: 0 };
    if (!days.length) return res;
    let fog = 0, wk = null, dimmedGap = false;
    for (let n = dnum(days[0]), end = dnum(t); n <= end; n++) {
      const d = dstr(n), w = weekOf(d);
      if (w !== wk) { wk = w; fog = Math.min(2, fog + 1); }        // 每周一自动送 1 张雾天卡，最多存 2 张
      if (set.has(d)) { res.lit++; dimmedGap = false; }
      else if (d < t) {
        if (fog > 0) { fog--; res.fogUsed.add(d); }
        else if (!dimmedGap) { res.lit = Math.max(0, res.lit - 1); dimmedGap = true; res.dimmed.add(d); }   // 断了只暗一层，不清零
      }
      res.best = Math.max(res.best, res.lit);
    }
    res.fog = fog;
    return res;
  }
  const MILESTONES = [3, 7, 30];

  /* ================= 小工具：弹层 / 烟花 / 画 ================= */
  let sheetCur = null, hzBag = [];
  function flushBag() { while (hzBag.length) { const f = hzBag.pop(); try { f(); } catch (e) { /* ignore */ } } }
  function closeSheet() {
    const s = sheetCur;
    if (!s) return;
    sheetCur = null;
    s.el.remove();
    flushBag();
    try { if (s.onClose) s.onClose(); } catch (e) { /* ignore */ }
    try { if (s.prev && s.prev.isConnected) s.prev.focus({ preventScroll: true }); } catch (e) { /* ignore */ }
  }
  function sheet(o) {
    closeSheet();
    const prev = D.activeElement;
    const bg = h('div', { class: 'hw-sheet-bg', id: 'hw-sheet' });
    const box = h('div', { class: 'hw-sheet ' + (o.cls || ''), role: 'dialog', 'aria-modal': 'true', 'aria-labelledby': 'hw-sheet-h' },
      h('button', { class: 'hw-sheet-x', type: 'button', id: 'hw-sheet-x', 'aria-label': '关闭', on: { click: closeSheet } }, '✕'),
      o.title ? h('h2', { class: 'hw-sheet-h', id: 'hw-sheet-h' }, o.title) : null,
      o.body);
    bg.appendChild(box);
    bg.addEventListener('click', (e) => { if (e.target === bg) closeSheet(); });
    C.root().appendChild(bg);
    sheetCur = { el: bg, box, prev, onClose: o.onClose, view: C.ui.view, pid: C.curId() };
    watchMain();
    const f = box.querySelector(o.focus || '.hw-btn.primary') || box.querySelector('button');
    try { if (f) f.focus({ preventScroll: true }); } catch (e) { /* ignore */ }
    return box;
  }
  /* 弹层属于打开它的那一页：换页 / 换人 / 进游戏时自动收起（同一页因为云同步重画则保留） */
  let mo = null;
  function watchMain() {
    if (mo || typeof MutationObserver === 'undefined' || !C.main()) return;
    mo = new MutationObserver(() => {
      if (sheetCur && (C.ui.view !== sheetCur.view || C.curId() !== sheetCur.pid)) closeSheet();
    });
    mo.observe(C.main(), { childList: true });
  }
  function fireworks(n) {
    const fx = C.fx();
    if (!fx || C.reduceMotion()) return;
    const cv = h('canvas');
    const g = cv.getContext && cv.getContext('2d');
    if (!g) return;
    fx.appendChild(cv);
    const dpr = Math.min(2, W.devicePixelRatio || 1), w = W.innerWidth, ht = W.innerHeight;
    cv.width = Math.round(w * dpr); cv.height = Math.round(ht * dpr); g.scale(dpr, dpr);
    const cols = ['#FFD23F', '#FF6B5A', '#6CC6FF', '#7BE36A', '#E6BDFF', '#FFFFFF'];
    const parts = [], shells = [];
    const N = Math.max(3, Math.min(7, n || 4));
    for (let i = 0; i < N; i++) shells.push({ x: w * (0.18 + 0.64 * Math.random()), y: ht, ty: ht * (0.16 + 0.3 * Math.random()), at: i * 380, c: cols[i % cols.length], done: false });
    const t0 = performance.now(), dur = 900 + N * 380 + 1500;
    function frame(tm) {
      const el = tm - t0;
      g.clearRect(0, 0, w, ht);
      shells.forEach((s) => {
        if (el < s.at || s.done) return;
        const k = Math.min(1, (el - s.at) / 700);
        const y = ht - (ht - s.ty) * (1 - Math.pow(1 - k, 3));
        g.fillStyle = '#FFF3C4'; g.beginPath(); g.arc(s.x, y, 3, 0, 6.283); g.fill();
        if (k >= 1) {
          s.done = true;
          for (let j = 0; j < 46; j++) { const a = j / 46 * 6.283, v = 2.2 + Math.random() * 2.6; parts.push({ x: s.x, y: s.ty, vx: Math.cos(a) * v, vy: Math.sin(a) * v, life: 1, c: Math.random() < 0.2 ? '#FFFFFF' : s.c }); }
        }
      });
      parts.forEach((q) => {
        if (q.life <= 0) return;
        q.x += q.vx; q.y += q.vy; q.vy += 0.045; q.vx *= 0.985; q.life -= 0.012;
        g.globalAlpha = Math.max(0, q.life); g.fillStyle = q.c;
        g.beginPath(); g.arc(q.x, q.y, 2.6, 0, 6.283); g.fill();
      });
      g.globalAlpha = 1;
      if (el < dur) requestAnimationFrame(frame); else cv.remove();
    }
    requestAnimationFrame(frame);
    try { C.sfx.win(); } catch (e) { /* ignore */ }
  }
  function speak(text) { try { return C.tts.speak(text, { rate: C.rateFor(C.curGradeNum()) }); } catch (e) { return Promise.resolve(); } }
  function chomp() {
    try {
      const A = W.AudioContext || W.webkitAudioContext;
      if (!HW.sound || !A) return;
      const ac = chomp.ac || (chomp.ac = new A());
      if (ac.state !== 'running' && ac.state !== 'closed' && ac.resume) ac.resume().catch(() => {});   // 含 iOS 的 'interrupted'
      [0, 0.12].forEach((at, i) => {
        const o = ac.createOscillator(), gn = ac.createGain(), t0 = ac.currentTime + at;
        o.type = 'triangle'; o.frequency.setValueAtTime(i ? 520 : 380, t0); o.frequency.exponentialRampToValueAtTime(i ? 760 : 220, t0 + 0.09);
        gn.gain.setValueAtTime(0.0001, t0); gn.gain.exponentialRampToValueAtTime(0.2, t0 + 0.01); gn.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.11);
        o.connect(gn); gn.connect(ac.destination); o.start(t0); o.stop(t0 + 0.13);
      });
    } catch (e) { /* ignore */ }
  }

  /* 字宠的样子：蛋 / 宝宝 / 少年（CSS + emoji；蛋上画家族部件剪影） */
  function eggEl(k, o) {
    o = o || {};
    const P = petOf(k);
    return h('span', { class: 'hw-egg' + (o.cls ? ' ' + o.cls : ''), style: '--e1:' + P.c1 + ';--e2:' + P.c2 + (o.size ? ';--es:' + o.size + 'px' : '') + (o.heat != null ? ';--heat:' + o.heat : ''), 'aria-hidden': 'true' },
      h('span', { class: 'hw-egg-rad' }, k),
      h('span', { class: 'hw-egg-spot s1' }), h('span', { class: 'hw-egg-spot s2' }), h('span', { class: 'hw-egg-spot s3' }),
      o.crack ? h('span', { class: 'hw-egg-crack' }) : null);
  }
  function petEl(p, o) {
    o = o || {};
    const st = stageOf(p);
    if (st === 'none') return null;
    if (st === 'egg') { const heat = heatOf(p); return eggEl(p.pet.f, { size: o.size, heat: heat / 100, cls: 'hw-petegg' + (heat >= 60 ? ' warm' : '') + (o.cls ? ' ' + o.cls : ''), crack: heat >= 80 }); }
    const P = petOf(p.pet.f);
    return h('span', { class: 'hw-pet ' + st + (asleep(p) && o.sleepy !== false ? ' is-asleep' : '') + (o.cls ? ' ' + o.cls : ''), style: '--e1:' + P.c1 + ';--e2:' + P.c2 + (o.size ? ';--ps:' + o.size + 'px' : ''), 'aria-hidden': 'true' },
      h('span', { class: 'hw-pet-glow' }),
      h('span', { class: 'hw-pet-body' }, h('span', { class: 'hw-pet-e' }, P.e), P.face ? h('span', { class: 'hw-pet-face' }, h('i'), h('i'), h('b')) : null),
      st === 'baby' ? h('span', { class: 'hw-pet-shell' }) : h('span', { class: 'hw-pet-medal' }, p.pet.f),
      h('span', { class: 'hw-pet-zz' }, 'z', h('small', null, 'z')));
  }
  /* 灯塔（SVG）：floors 层，其中 lit 层亮着；lamp = 今天已完成 */
  function towerSvg(floors, lit, lamp, cls) {
    const N = clamp(floors || 1, 1, 8);
    const litN = floors ? Math.round(N * clamp(lit / floors, 0, 1)) : 0;
    const top = 44, bot = 128, bh = (bot - top) / N;
    const xw = (y) => 16 + (y - top) / (bot - top) * 7;   // 半宽：上窄下宽
    let s = '<svg viewBox="0 0 80 140" class="hw-tw ' + (cls || '') + '" aria-hidden="true" focusable="false">';
    s += '<ellipse class="tw-rock" cx="40" cy="132" rx="30" ry="7"/>';
    if (lamp) s += '<g class="tw-beam"><path d="M40 30L100 12L100 48Z"/><path d="M40 30L-20 12L-20 48Z"/></g>';
    for (let i = 0; i < N; i++) {
      const y1 = bot - i * bh, y0 = y1 - bh, a = xw(y0), b = xw(y1);
      const on = i < litN && floors > 0;
      s += '<path class="tw-band ' + (on ? (i % 2 ? 'on b' : 'on a') : 'off') + '" d="M' + (40 - b).toFixed(1) + ' ' + y1.toFixed(1) + 'L' + (40 - a).toFixed(1) + ' ' + y0.toFixed(1) + 'H' + (40 + a).toFixed(1) + 'L' + (40 + b).toFixed(1) + ' ' + y1.toFixed(1) + 'Z"/>';
      if (bh >= 7) s += '<rect class="tw-win ' + (on ? 'on' : 'off') + '" x="37" y="' + (y0 + bh * 0.28).toFixed(1) + '" width="6" height="' + Math.min(9, bh * 0.44).toFixed(1) + '" rx="2"/>';
    }
    s += '<rect class="tw-deck" x="20" y="38" width="40" height="7" rx="2"/>';
    s += '<rect class="tw-glass' + (lamp ? ' on' : '') + '" x="29" y="22" width="22" height="16" rx="3"/>';
    s += '<path class="tw-roof" d="M26 23Q40 4 54 23Z"/><circle class="tw-roof" cx="40" cy="8" r="3"/>';
    return s + '</svg>';
  }
  function towerEl(floors, lit, lamp, cls) { const s = h('span', { class: 'hw-twwrap ' + (cls || ''), 'aria-hidden': 'true' }); s.innerHTML = towerSvg(floors, lit, lamp, cls); return s; }
  function lvBadge(lv) { return lv < 0 ? '未收集' : LV[lv]; }
  function zkEl(ch, lv, o) {
    o = o || {};
    return h(o.tag || 'span', Object.assign({ class: 'hw-zk lv' + lv + (o.cls ? ' ' + o.cls : ''), 'data-ch': ch }, o.attrs || {}),
      h('span', { class: 'hw-zk-hz' }, ch), o.label ? h('span', { class: 'hw-zk-l' }, o.label) : null);
  }

  /* ================= 首页：今日航线 + 灯塔 + 字宠 ================= */
  function stationSub(k, v, p) {
    const gs = gamesMap();
    if (k === 'h') return v.s.h ? '收好啦' : (v.hv.length ? v.hv.length + ' 个字成熟' : '热身一局');
    if (k === 'n') return v.s.n ? '收下啦' : v.nw.length + ' 个新字';
    if (k === 'g') return v.g && gs[v.g] ? gs[v.g].name : '今天休息';
    return v.s.c ? '打开啦' : '2🌺+金饼干';
  }
  function mapBoard(p) {
    const v = plan(p);
    const n = doneN(v);
    const cur = STATIONS.findIndex((s) => !v.s[s.k]);
    const gs = gamesMap();
    const route = h('ol', { class: 'hw-voy-route', style: '--cur:' + (cur < 0 ? 3 : cur) },
      STATIONS.map((s, i) => {
        const done = !!v.s[s.k];
        const lock = s.k === 'c' && !done && !chestReady(v);
        const ic = s.k === 'g' && v.g && gs[v.g] ? (gs[v.g].icon || '🎮') : s.ic;
        const sub = stationSub(s.k, v, p);
        return h('li', null, h('button', {
          type: 'button', class: 'hw-vst' + (done ? ' is-done' : '') + (i === cur ? ' is-cur' : '') + (lock ? ' is-lock' : ''), id: 'hw-vst-' + s.k, 'data-st': s.k,
          'aria-label': '第' + (i + 1) + '站 ' + s.nm + '，' + sub + (done ? '，已完成' : lock ? '，前三站完成后打开' : ''),
          on: { click: () => openStation(s.k) }
        },
          h('span', { class: 'hw-vst-orb', 'aria-hidden': 'true' }, h('span', { class: 'hw-vst-ic' }, ic), lock ? h('span', { class: 'hw-vst-lock' }, '🔒') : null),
          h('span', { class: 'hw-vst-n', 'aria-hidden': 'true' }, s.no + ' ' + (s.k === 'g' ? '游戏' : s.nm)),
          h('span', { class: 'hw-vst-s', 'aria-hidden': 'true' }, sub),
          done ? C.stampEl({ t: '完成', shape: 'round' }, { size: 36, tiny: true, rot: -14 }) : null));
      }),
      h('span', { class: 'hw-voy-boat', 'aria-hidden': 'true' }, '⛵'));
    const note = n === 4 ? '今天的航线完成啦！灯塔又亮了一层，明天见～'
      : n === 3 ? '宝箱可以打开啦！里面有 2 朵小红花、1 块金饼干和今天的航线章。'
        : '4 站大约 12–15 分钟，走完就能开宝箱！';
    const board = h('section', { class: 'hw-quest hw-voy', 'aria-labelledby': 'hw-voy-h', id: 'hw-voy' },
      h('div', { class: 'hw-quest-plate' }, h('h2', { id: 'hw-voy-h' }, '今日航线'), h('span', { class: 'n' }, n + '/4')),
      route,
      h('div', { class: 'hw-quest-bar', 'aria-hidden': 'true' }, h('span', { style: 'width:' + (n * 25) + '%' })),
      h('p', { class: 'hw-todaynote' }, note));
    if (!p.pet) askEgg(p);
    return h('div', { class: 'hw-voywrap' }, board, harborEl(p));
  }
  /* 第一次进来（这个档案还没有字宠）：请孩子自己选一颗蛋；每个档案只主动问一次，之后在港口的“字宠”卡里选 */
  function askEgg(p) {
    const asked = C.LS.get('eggAsk', {});
    if (isObj(asked) && asked[p.id]) return;
    setTimeout(() => {
      const q = C.curProf();
      if (q.id !== p.id || q.pet || C.ui.view !== 'map' || sheetCur) return;
      const a = C.LS.get('eggAsk', {}); const o = isObj(a) ? a : {};
      o[q.id] = 1; C.LS.set('eggAsk', o);
      const fams = eggFams(q.grade).slice(0, 3);
      sheet({ title: '你好，' + q.name + '！', cls: 'hw-vsheet', body: [
        h('div', { class: 'hw-askeggs', 'aria-hidden': 'true' }, fams.map((k) => eggEl(k, { size: 64, cls: 'hw-petegg' }))),
        h('p', { class: 'hw-vs-lead' }, '小岛上有几颗字宠蛋，等你来挑一颗！答对的字会让蛋变暖，孵出来以后还能喂它吃“字形饼干”。'),
        h('div', { class: 'hw-row hw-center' },
          h('button', { class: 'hw-btn primary big', type: 'button', id: 'hw-ask-egg', on: { click: () => { closeSheet(); C.leaveMap(); renderPet(); } } }, '去选蛋 🥚'),
          h('button', { class: 'hw-btn big', type: 'button', id: 'hw-ask-later', on: { click: closeSheet } }, '等会儿'))
      ] });
    }, 700);
  }
  /* 兄妹灯塔算哪些档案：最近 14 天玩过的（没人用的示例档案 / 测试档案不拖后腿）；不到 2 个就算全部 */
  function lastActive(q) {
    let la = '';
    const up = (d) => { if (isDate(d) && d > la) la = d; };
    up(q.days && q.days[q.days.length - 1]); up(q.pt && q.pt.d);
    const lg = q.log && q.log[q.log.length - 1];
    if (lg && num(lg.t) > 0) up(C.todayStr(new Date(num(lg.t))));
    return la;
  }
  function sibs() {
    const all = C.sortedProfiles(), t = today();
    const act = all.filter((q) => { const la = lastActive(q); return la && diff(t, la) <= 14; });
    return act.length >= 2 ? act : all;
  }
  function harborEl(p) {
    const tw = tower(p);
    const all = sibs();
    const t = today();
    const kids = [];
    kids.push(h('button', { type: 'button', class: 'hw-hb hw-hb-tower', id: 'hw-tower-me', 'aria-label': '我的灯塔：连胜 ' + tw.lit + ' 天，雾天卡 ' + tw.fog + ' 张', on: { click: () => towerSheet(p) } },
      towerEl(tw.floors, tw.lit, tw.today, 'mini'),
      h('span', { class: 'hw-hb-t', 'aria-hidden': 'true' }, h('b', null, '我的灯塔'), h('small', null, tw.floors ? '连胜 ' + tw.lit + ' 天' : '还没点亮'), h('small', { class: 'fog' }, '☁️ ', h('span', { class: 'hw-hb-long' }, '雾天卡 '), '×' + tw.fog))));
    if (all.length >= 2) {
      const allDone = all.every((q) => q.days.indexOf(t) >= 0);
      const together = togetherDays(all);
      kids.push(h('button', { type: 'button', class: 'hw-hb hw-hb-tower sib' + (allDone ? ' is-lit' : ''), id: 'hw-tower-sib', 'aria-label': '兄妹灯塔：' + (allDone ? '今天亮了' : '今天还没亮') + '，一起亮灯 ' + together + ' 天', on: { click: () => sibSheet() } },
        towerEl(Math.max(together, 1), together, allDone, 'mini sib'),
        h('span', { class: 'hw-hb-t', 'aria-hidden': 'true' }, h('b', null, '兄妹灯塔'),
          h('span', { class: 'hw-sibs' }, all.slice(0, 4).map((q) => h('span', { class: 'hw-sib' + (q.days.indexOf(t) >= 0 ? ' ok' : '') }, q.avatar))),
          h('small', null, allDone ? '今天亮啦！' : '都完成就亮'))));
    }
    const st = stageOf(p);
    const ck = st === 'none' ? 0 : cookiesToday(p).length;
    kids.push(h('button', { type: 'button', class: 'hw-hb hw-hb-pet', id: 'hw-pet-open', 'aria-label': st === 'none' ? '字宠：去选一颗蛋' : petName(p) + (ck ? '，有 ' + ck + ' 块饼干' : ''), on: { click: () => { C.leaveMap(); renderPet(); } } },
      h('span', { class: 'hw-hb-pet-art' }, st === 'none' ? h('span', { class: 'hw-egg-q', 'aria-hidden': 'true' }, eggEl('？', { size: 44 })) : petEl(p, { size: 50 })),
      h('span', { class: 'hw-hb-t', 'aria-hidden': 'true' }, h('b', null, st === 'none' ? '字宠' : petOf(p.pet.f).nm),
        h('small', null, st === 'none' ? '选一颗蛋' : st === 'egg' ? '蛋 ' + heatOf(p) + ' 度' : (asleep(p) ? '睡着了 💤' : ck ? '🍪 饼干 ×' + ck : '还没饼干'))),
      ck && st !== 'none' ? h('span', { class: 'badge', 'aria-hidden': 'true' }, String(ck)) : null));
    return h('div', { class: 'hw-harbor n' + kids.length }, kids);
  }
  function togetherDays(all) {
    if (!all.length) return 0;
    let set = new Set(all[0].days);
    all.slice(1).forEach((q) => { set = new Set(q.days.filter((d) => set.has(d))); });
    return set.size;
  }
  function pinPet(p) {
    const st = stageOf(p);
    if (st === 'none') return null;
    return h('span', { class: 'hw-pinpet' + (st === 'egg' ? ' egg' : ''), 'aria-hidden': 'true' }, petEl(p, { size: 34 }));
  }
  function hudCards(p) {
    const d = gdata(p.grade);
    const n = d.order.filter((ch) => level(cardOf(p, ch)) >= 0).length;
    return h('button', { class: 'hw-pill hw-cardpill', id: 'hw-cards-pill', type: 'button', title: '字卡图鉴', 'aria-label': '字卡图鉴，收集了 ' + n + ' 张，一共 ' + d.order.length + ' 张', on: { click: () => { C.leaveMap(); renderCards(); } } },
      h('span', { class: 'hw-cardic', 'aria-hidden': 'true' }, '字'), h('b', { 'aria-hidden': 'true' }, String(n)));
  }
  function cardLine(p) {
    const d = gdata(p.grade);
    return d.order.filter((ch) => level(cardOf(p, ch)) >= 0).length + ' / ' + d.order.length + ' 张';
  }

  /* ================= 航线各站 ================= */
  function openStation(k) {
    const p = C.curProf(), v = plan(p);
    const gs = gamesMap();
    C.sfx.tap();
    if (k === 'h') {
      const gid = harvestGame(p, v);
      const g = gid && gs[gid];
      sheet({ title: '① 丰收', cls: 'hw-vsheet', body: [
        v.hv.length
          ? h('p', { class: 'hw-vs-lead' }, '田里有 ' + v.hv.length + ' 个字成熟了！打一局“' + (g ? g.name : '街机') + '”，把它们收回来：')
          : h('p', { class: 'hw-vs-lead' }, '今天还没有要复习的字，苗还小呢。先打一局“' + (g ? g.name : '街机') + '”热热身吧！'),
        v.hv.length ? h('div', { class: 'hw-vs-chars' }, v.hv.map((ch) => zkEl(ch, level(cardOf(p, ch))))) : null,
        h('p', { class: 'hw-muted' }, v.s.h ? '这一站已经完成啦，想再玩一局也可以。' : '玩完一局（不管几颗星）就算完成这一站。'),
        g ? h('button', { class: 'hw-btn primary big', type: 'button', id: 'hw-vs-go', on: { click: () => { closeSheet(); v.hg = gid; C.touch(p); C.leaveMap(); C.startGame(gid, null, { voyage: 'h', focus: v.hv.slice() }); } } }, (g.icon || '') + ' 开始丰收局')
          : h('button', { class: 'hw-btn primary big', type: 'button', id: 'hw-vs-go', on: { click: () => { closeSheet(); v.s.h = 1; C.touch(p); C.keepPlace(C.renderMap); } } }, '这个年级暂时没有街机，直接收下 ✓')
      ] });
    } else if (k === 'n') {
      if (C.overLimit(p)) { C.showRest(); return; }
      C.leaveMap(); renderNewChars();
    } else if (k === 'g') {
      const g = v.g && gs[v.g];
      sheet({ title: '③ 今日游戏', cls: 'hw-vsheet', body: [
        g ? h('div', { class: 'hw-vs-game' }, h('span', { class: 'ic', 'aria-hidden': 'true' }, g.icon || '🎮'), h('div', null, h('b', null, g.name), h('p', null, g.blurb || ''))) : null,
        h('p', { class: 'hw-vs-lead' }, g ? '今天的指定游戏每天都换。今天的新字会先出现哦！' : '今天没有可以玩的指定游戏。'),
        h('p', { class: 'hw-muted' }, v.s.g ? '这一站已经完成啦，可以再挑战一次。' : '玩完一局就算完成这一站。'),
        g ? h('button', { class: 'hw-btn primary big', type: 'button', id: 'hw-vs-go', on: { click: () => { closeSheet(); C.leaveMap(); C.startGame(v.g, null, { voyage: 'g', focus: v.nw.slice() }); } } }, '开始 ▶') : null
      ] });
    } else if (k === 'c') chestSheet(p, v);
  }
  function chestItems() {
    return h('ul', { class: 'hw-chest-list' },
      h('li', null, h('span', { class: 'hw-coin', 'aria-hidden': 'true' }, C.flowerSvg(22)), '2 朵小红花（放进钱包）'),
      h('li', null, h('span', { class: 'hw-cookie gold mini', 'aria-hidden': 'true' }, '★'), '1 块金饼干（喂给字宠）'),
      h('li', null, C.dateSeal(today()), '今天的航线章 · 灯塔亮一层'));
  }
  function chestSheet(p, v) {
    if (v.s.c) {
      sheet({ title: '④ 宝箱', cls: 'hw-vsheet', body: [h('p', { class: 'hw-vs-lead' }, '今天的宝箱已经打开啦！明天还有新的宝箱。'), chestItems(),
        h('button', { class: 'hw-btn primary big', type: 'button', on: { click: closeSheet } }, '好的')] });
      return;
    }
    if (!chestReady(v)) {
      const left = STATIONS.slice(0, 3).filter((s) => !v.s[s.k]).map((s) => s.no + s.nm);
      sheet({ title: '④ 宝箱', cls: 'hw-vsheet', body: [
        h('div', { class: 'hw-chestbig is-locked', 'aria-hidden': 'true' }, h('span', { class: 'lid' }), h('span', { class: 'box' }), h('span', { class: 'lock' }, '🔒')),
        h('p', { class: 'hw-vs-lead' }, '宝箱里有什么？提前告诉你：'), chestItems(),
        h('p', { class: 'hw-muted' }, '还差：' + left.join('、') + '。完成前面三站就能打开。'),
        h('button', { class: 'hw-btn primary big', type: 'button', on: { click: closeSheet } }, '知道啦')] });
      return;
    }
    const box = sheet({ title: '④ 宝箱', cls: 'hw-vsheet', body: [
      h('div', { class: 'hw-chestbig', id: 'hw-chestbig', 'aria-hidden': 'true' }, h('span', { class: 'lid' }), h('span', { class: 'box' })),
      h('p', { class: 'hw-vs-lead' }, '三站都完成啦！宝箱里有：'), chestItems(),
      h('button', { class: 'hw-btn primary big', type: 'button', id: 'hw-chest-open', on: { click: () => doOpenChest(box) } }, '打开宝箱！')] });
  }
  function doOpenChest(box) {
    const p = C.curProf(), v = plan(p);
    if (v.s.c || !chestReady(v)) return;
    const t = today();
    const tw0 = tower(p);
    v.s.c = 1;
    if (p.days.indexOf(t) < 0) { p.days.push(t); p.days = uniq(p.days).sort().slice(-400); }
    C.earn(p, 2);
    const fresh = C.checkStamps(p);
    C.touch(p);
    const tw1 = tower(p);
    const ms = tw1.lit > tw0.lit && MILESTONES.indexOf(tw1.lit) >= 0 ? tw1.lit : 0;
    const big = box.querySelector('#hw-chestbig');
    if (big) big.classList.add('is-open');
    try { C.sfx.stamp(); } catch (e) { /* ignore */ }
    setTimeout(() => { try { C.sfx.win(); } catch (e) { /* ignore */ } }, 250);
    C.confetti();
    const body = [
      h('div', { class: 'hw-chestbig is-open', 'aria-hidden': 'true' }, h('span', { class: 'lid' }), h('span', { class: 'box' }),
        h('span', { class: 'pop p1 hw-coin' }, C.flowerSvg(24)), h('span', { class: 'pop p2 hw-coin' }, C.flowerSvg(24)), h('span', { class: 'pop p3 hw-cookie gold mini' }, '★')),
      h('p', { class: 'hw-vs-lead' }, '得到：2 朵小红花（钱包现在 ' + p.wallet + ' 朵）、1 块金饼干、今天的航线章！'),
      h('div', { class: 'hw-row hw-center' }, C.dateSeal(t), towerEl(tw1.floors, tw1.lit, true, 'mid'),
        h('p', { class: 'hw-chest-tw' }, '灯塔亮了一层！', h('br'), '连胜 ', h('b', null, String(tw1.lit)), ' 天')),
      ms ? h('p', { class: 'hw-milestone' }, '🎆 连胜 ' + ms + ' 天！放烟花！') : null,
      fresh.length ? h('div', { class: 'hw-newstamps' }, fresh.map((s) => h('div', { class: 'hw-newstamp' }, C.stampEl(s, { size: 70, fresh: true }), h('span', null, s.need)))) : null,
      h('div', { class: 'hw-row hw-center' },
        p.pet ? h('button', { class: 'hw-btn primary big', type: 'button', id: 'hw-chest-pet', on: { click: () => { closeSheet(); C.leaveMap(); renderPet(); } } }, '去喂字宠 🍪') : null,
        h('button', { class: 'hw-btn big', type: 'button', id: 'hw-chest-ok', on: { click: closeSheet } }, '好的'))
    ];
    sheet({ title: '宝箱打开啦！', cls: 'hw-vsheet', body, onClose: () => { if (C.ui.view === 'map') C.keepPlace(C.renderMap); } });
    if (ms) setTimeout(() => fireworks(ms >= 30 ? 7 : ms >= 7 ? 5 : 3), 500);
  }

  /* ================= ② 新字：出场动画 + 笔顺 + 组词 → 收下 ================= */
  let ncIdx = 0;
  function renderNewChars(idx) {
    closeSheet();
    const p = C.curProf(), v = plan(p);
    C.ui.view = 'newchars';
    flushBag();
    if (idx == null) idx = v.s.n ? 0 : Math.min(v.ni || 0, v.nw.length);
    ncIdx = idx;
    if (!v.nw.length) { C.page('新字', null, [h('div', { class: 'hw-card hw-empty' }, '这个年级的字都收集啦！')]); return; }
    if (idx >= v.nw.length) { finishNew(p, v); return; }
    const ch = v.nw[idx];
    const info = charInfo(ch, p.grade), rad = radOf(ch, p.grade);
    const tzg = h('div', { class: 'hw-nc-tzg', id: 'hw-nc-tzg' });
    const words = info.words.slice(0, 4);
    const card = h('section', { class: 'hw-nc-card' + (C.reduceMotion() ? ' no-anim' : ''), 'aria-labelledby': 'hw-nc-hz' },
      h('div', { class: 'hw-nc-spark', 'aria-hidden': 'true' }, [0, 1, 2, 3, 4, 5].map((i) => h('i', { style: '--i:' + i }))),
      h('div', { class: 'hw-nc-big', id: 'hw-nc-hz', 'aria-label': ch + (info.py ? '，' + info.py : '') }, ch),
      h('div', { class: 'hw-nc-py hw-py' }, info.py || ''),
      h('div', { class: 'hw-nc-meta' },
        rad ? h('span', { class: 'hw-tag' }, '部首 ' + radLabel(ch, p.grade)) : null,
        info.jg ? h('span', { class: 'hw-tag' }, info.jg + '结构') : null),
      h('div', { class: 'hw-nc-body' },
        tzg,
        h('div', { class: 'hw-nc-words' },
          words.length ? h('p', { class: 'hw-nc-wl' }, h('b', null, '组词'), words.map((w) => h('span', { class: 'hw-nc-w' }, hlChar(w, ch)))) : null,
          info.sent ? h('p', { class: 'hw-nc-sent' }, hlChar(info.sent, ch)) : null)));
    const dots = h('div', { class: 'hw-nc-dots', 'aria-label': '第 ' + (idx + 1) + ' 个，共 ' + v.nw.length + ' 个' }, v.nw.map((c, i) => h('i', { class: i < idx ? 'on' : i === idx ? 'cur' : '' })));
    const bar = h('div', { class: 'hw-nc-btns' },
      h('button', { class: 'hw-btn', type: 'button', id: 'hw-nc-say', on: { click: () => speak(sayOf(ch, p.grade)) } }, '🔊 听一听'),
      h('button', { class: 'hw-btn', type: 'button', id: 'hw-nc-stroke', on: { click: () => playStroke() } }, '✍️ 笔顺'),
      h('button', { class: 'hw-btn primary big', type: 'button', id: 'hw-nc-take', on: { click: take } }, '收下 ✓'));
    C.page('② 新字', (idx + 1) + ' / ' + v.nw.length, [dots, card, bar]);
    let writer = null;
    const mk = () => {
      if (!tzg.isConnected) return;
      writer = C.hanzi.create(tzg, ch, { width: 150, height: 150, showCharacter: C.reduceMotion(), showOutline: true, delayBetweenStrokes: 180 }, hzBag);
      if (!writer) { tzg.classList.add('hw-nc-nohz'); tzg.textContent = ch; }
    };
    function playStroke() { if (!writer) mk(); if (writer) { try { writer.animateCharacter(); } catch (e) { /* ignore */ } } }
    if (C.reduceMotion()) { mk(); speak(sayOf(ch, p.grade)); }
    else {
      setTimeout(() => { if (C.ui.view === 'newchars' && ncIdx === idx) speak(sayOf(ch, p.grade)); }, 900);
      setTimeout(() => { if (C.ui.view === 'newchars' && ncIdx === idx) playStroke(); }, 2600);
    }
    function take() {
      const q = C.curProf();
      const c = q.cards[ch] || (q.cards[ch] = { s: 0, r: 0, w: 0, d: [], b: 0, bl: '', x: '', f: '', k: '' });
      if (c.s < 1) c.s = 1;
      if (!c.f) c.f = today();
      const qv = plan(q, false);
      if (qv.d === v.d) qv.ni = Math.max(qv.ni || 0, idx + 1);
      C.touch(q);
      C.sfx.good();
      card.classList.add('is-taken');
      setTimeout(() => { if (C.ui.view === 'newchars') renderNewChars(idx + 1); }, C.reduceMotion() ? 0 : 520);
    }
  }
  function hlChar(text, ch) {
    return Array.from(text).map((c) => (c === ch ? h('b', { class: 'hw-hlc' }, c) : c));
  }
  function finishNew(p, v) {
    const first = !v.s.n;
    v.s.n = 1;
    C.touch(p);
    C.page('② 新字', '完成', [
      h('section', { class: 'hw-card hw-stack hw-center hw-nc-done' },
        h('h2', { class: 'hw-kai' }, '今天的新字都收下啦！'),
        h('div', { class: 'hw-vs-chars' }, v.nw.map((ch) => zkEl(ch, level(cardOf(p, ch))))),
        h('p', { class: 'hw-muted' }, '它们已经放进图鉴（灰卡）。在游戏里答对，就会升成铜卡；明天丰收局还会再见到它们。'),
        h('div', { class: 'hw-row hw-center' },
          h('button', { class: 'hw-btn primary big', type: 'button', id: 'hw-nc-back', on: { click: C.goMapTop } }, '继续航线 ⛵'),
          h('button', { class: 'hw-btn big', type: 'button', id: 'hw-nc-dex', on: { click: () => renderCards() } }, '看图鉴')))
    ]);
    if (first) { C.confetti(); try { C.sfx.stamp(); } catch (e) { /* ignore */ } }
  }

  /* ================= 字宠页：选蛋 / 孵蛋 / 喂食 ================= */
  let dragging = false, justChose = false;
  function renderPet() {
    closeSheet();
    const p = C.curProf();
    C.ui.view = 'pet';
    flushBag();
    if (!p.pet) { renderEggPick(p); return; }
    const st = stageOf(p);
    const P = petOf(p.pet.f);
    const sleeping = asleep(p);
    if (!sleeping && p.pet.v !== today()) { p.pet.v = today(); C.touch(p); }
    const d = gdata(p.grade);
    const famChars = d.order.filter((ch) => d.fam[ch] === p.pet.f);
    const gold = famChars.filter((ch) => level(cardOf(p, ch)) === 3).length;
    const heat = heatOf(p);
    const fresh = justChose && st === 'egg'; justChose = false;   // 刚选好蛋：蛋从天上落进窝里 + 自我介绍
    const pet = petEl(p, { size: 132, sleepy: sleeping, cls: 'big' });
    const target = h('button', { type: 'button', class: 'hw-petspot' + (sleeping ? ' is-asleep' : '') + (fresh ? ' is-new' : ''), id: 'hw-pet-target', 'aria-label': petName(p) + (sleeping ? '，睡着了，点一下叫醒它' : '，点一下摸摸它') }, pet,
      fresh ? h('span', { class: 'hw-petnest', 'aria-hidden': 'true' }, [0, 1, 2, 3, 4, 5].map((i) => h('i', { style: '--i:' + i }, '✦'))) : null,
      h('span', { class: 'hw-petbubble', id: 'hw-petbubble', 'aria-live': 'polite' }, fresh ? '我是' + p.name + '的' + P.nm + '蛋！' : sleeping ? '💤 呼噜呼噜……' : st === 'egg' ? '（蛋在轻轻晃动）' : (cookiesToday(p).length ? '闻到饼干的香味啦～' : '见到你真开心！')));
    target.addEventListener('click', () => {
      if (target.classList.contains('is-asleep')) { wake(p, target); return; }
      pat(target, st);
    });
    const growth = st === 'egg'
      ? h('div', { class: 'hw-thermo', role: 'img', 'aria-label': '蛋的温度 ' + heat + ' 度，满 100 度就孵出来' },
        h('span', { class: 'hw-thermo-ic', 'aria-hidden': 'true' }, '🌡️'),
        h('div', { class: 'hw-thermo-bar', 'aria-hidden': 'true' }, h('span', { style: 'width:' + heat + '%' })),
        h('b', { class: 'hw-thermo-v', 'aria-hidden': 'true' }, heat + '°'))
      : h('div', { class: 'hw-grow', role: 'img', 'aria-label': growText(p) },
        h('div', { class: 'hw-thermo-bar grow' + (st === 'teen' || st === 'neon' ? ' neon' : ''), 'aria-hidden': 'true' }, h('span', { style: 'width:' + growPct(p) + '%' })),
        h('small', { 'aria-hidden': 'true' }, growText(p)));
    const rules = st === 'egg'
      ? h('p', { class: 'hw-muted hw-petrule' }, '答对「' + p.pet.f + '」家族的字 +10 度（每个字每天一次）· 这一家出金卡 +25 度 · 喂一块饼干 +3 度。满 100 度就孵出来！')
      : h('p', { class: 'hw-muted hw-petrule' }, '每天答对的字会变成字形饼干（每天最多 ' + COOKIE_DAY + ' 块）。拖进' + P.nm + '的嘴里，它会念给你听。');
    const stage = h('section', { class: 'hw-petstage st-' + st, style: '--e1:' + P.c1 + ';--e2:' + P.c2 },
      h('div', { class: 'hw-petstage-sky', 'aria-hidden': 'true' }, h('span', { class: 'c1' }), h('span', { class: 'c2' })),
      h('div', { class: 'hw-petname' }, h('b', null, petName(p)), h('small', null, '「' + p.pet.f + '」家族')),
      target,
      h('div', { class: 'hw-petstage-ground', 'aria-hidden': 'true' }),
      growth, rules);
    const tray = cookieTray(p, target);
    const fam = h('section', { class: 'hw-card hw-stack hw-petfam', 'aria-labelledby': 'hw-pf-h' },
      h('h2', { class: 'hw-kai', id: 'hw-pf-h' }, '「' + p.pet.f + '」家族 · ' + famChars.length + ' 个字 · 金卡 ' + gold),
      famChars.length ? h('div', { class: 'hw-cardgrid' }, famChars.map((ch) => zkEl(ch, level(cardOf(p, ch)), { tag: 'button', attrs: { type: 'button', 'aria-label': ch + ' ' + lvBadge(level(cardOf(p, ch))), on: { click: () => cardBack(ch) } } })))
        : h('p', { class: 'hw-muted' }, '这个年级里这个家族的字不多，换个年级也能遇到它们。'));
    C.page('我的字宠', petName(p), [stage, tray, fam]);
  }
  /* 成长条：宝宝 → 少年 看饼干；少年 → 霓虹 看这个家族的金卡（学得好不好，不看吃了多少） */
  function growPct(p) {
    const st = stageOf(p);
    if (st === 'neon') return 100;
    if (st === 'teen') { const fg = famGold(p); return fg[1] ? Math.round(fg[0] / fg[1] * 100) : 0; }
    return Math.min(100, Math.round(p.pet.fed / GROW * 100));
  }
  function growText(p) {
    const st = stageOf(p), P = petOf(p.pet.f);
    if (st === 'neon') return '霓虹' + P.nm + '！「' + p.pet.f + '」家族的字全部金卡，真正记住啦';
    if (st === 'teen') { const fg = famGold(p); return fg[1] >= 3 ? '少年 → 霓虹：「' + p.pet.f + '」家族金卡 ' + fg[0] + '/' + fg[1] : '已经是少年' + P.nm + '啦！'; }
    return '宝宝 → 少年：还要 ' + Math.max(0, GROW - p.pet.fed) + ' 份饼干（金饼干算 3 份）';
  }
  function wake(p, target) {
    p.pet.v = today(); C.touch(p);
    target.classList.remove('is-asleep');
    const pe = target.querySelector('.hw-pet');
    if (pe) pe.classList.remove('is-asleep');
    target.classList.add('is-happy');
    const b = D.getElementById('hw-petbubble');
    if (b) b.textContent = '睡了一个好觉！早上好～';
    C.sfx.good();
    setTimeout(() => target.classList.remove('is-happy'), 900);
  }
  function pat(target, st) {
    target.classList.remove('is-happy'); void target.offsetWidth; target.classList.add('is-happy');
    hearts(target, 2);
    const b = D.getElementById('hw-petbubble');
    if (b) b.textContent = st === 'egg' ? '（蛋里好像有东西在动！）' : ['嘻嘻，好痒！', '最喜欢你啦！', '再给我一块饼干吧～'][Math.floor(Math.random() * 3)];
    C.sfx.tap();
  }
  function hearts(target, n) {
    if (C.reduceMotion()) return;
    for (let i = 0; i < n; i++) {
      const s = h('span', { class: 'hw-heart', style: '--x:' + Math.round(Math.random() * 60 - 30) + 'px;--d:' + (i * 0.15) + 's', 'aria-hidden': 'true' }, '💗');
      target.appendChild(s);
      setTimeout(() => s.remove(), 1300);
    }
  }
  function cookieTray(p, target) {
    const list = cookiesToday(p);
    const st = stageOf(p);
    const P = petOf(p.pet.f);
    const t = today();
    const full = !!(p.pet.ate && p.pet.ate.d === t && p.pet.ate.c.length >= COOKIE_DAY);
    const tray = h('section', { class: 'hw-card hw-stack hw-tray', 'aria-labelledby': 'hw-tray-h' },
      h('div', { class: 'hw-tray-h' }, h('h2', { class: 'hw-kai', id: 'hw-tray-h' }, '今天的字形饼干'), h('span', { class: 'hw-tag accent' }, list.length + ' 块')),
      list.length ? h('p', { class: 'hw-muted' }, st === 'egg' ? '把饼干拖到蛋上，给它暖一暖（+3 度）。点一下也行！' : '按住饼干，拖进' + P.nm + '的嘴里！（点一下也行）') : null,
      list.length ? h('div', { class: 'hw-cookies', id: 'hw-cookies' }, list.map((ch) => cookieBtn(p, ch, target)))
        : full ? h('div', { class: 'hw-empty hw-stack hw-center' }, h('p', null, (st === 'egg' ? '蛋今天暖暖的，' : P.nm + '今天吃饱饱啦！') + '明天答对的字又会变成新饼干。'))
          : h('div', { class: 'hw-empty hw-stack hw-center' }, h('p', null, '今天还没有饼干。去玩游戏，答对的字都会变成饼干！'),
            h('button', { class: 'hw-btn primary', type: 'button', id: 'hw-tray-go', on: { click: C.goMapTop } }, '去今日航线 ⛵')));
    return tray;
  }
  function cookieBtn(p, ch, target) {
    const gold = ch === '★';
    const label = gold ? '金饼干' : ch;
    const b = h('button', { type: 'button', class: 'hw-cookie' + (gold ? ' gold' : ''), 'data-ch': ch, 'aria-label': '饼干：' + label + '，喂给字宠' }, gold ? '★' : ch);
    let ghost = null, sx = 0, sy = 0, ox = 0, oy = 0, moved = false, pid = null, lastPtr = 0;
    const overPet = (x, y) => { const r = target.getBoundingClientRect(); return x > r.left - 16 && x < r.right + 16 && y > r.top - 16 && y < r.bottom + 16; };
    b.addEventListener('pointerdown', (e) => {
      if (dragging || b.disabled) return;
      if (e.button != null && e.button !== 0) return;
      e.preventDefault();
      dragging = true; lastPtr = Date.now(); moved = false; pid = e.pointerId;
      try { b.setPointerCapture(pid); } catch (x) { /* ignore */ }
      const r = b.getBoundingClientRect();
      sx = e.clientX; sy = e.clientY; ox = e.clientX - r.left; oy = e.clientY - r.top;
      ghost = b.cloneNode(true);
      ghost.removeAttribute('id');
      ghost.classList.add('hw-cookie-ghost');
      ghost.style.left = r.left + 'px'; ghost.style.top = r.top + 'px'; ghost.style.width = r.width + 'px'; ghost.style.height = r.height + 'px';
      C.root().appendChild(ghost);
      b.classList.add('is-lifted');
    });
    b.addEventListener('pointermove', (e) => {
      if (!ghost || e.pointerId !== pid) return;
      if (Math.abs(e.clientX - sx) + Math.abs(e.clientY - sy) > 6) moved = true;
      ghost.style.left = (e.clientX - ox) + 'px'; ghost.style.top = (e.clientY - oy) + 'px';
      target.classList.toggle('is-open', overPet(e.clientX, e.clientY));
    });
    const end = (e) => {
      if (!ghost || (e && e.pointerId !== pid)) return;
      const g = ghost; ghost = null; lastPtr = Date.now();
      target.classList.remove('is-open');
      const hit = e && e.type === 'pointerup' && overPet(e.clientX, e.clientY);
      if (hit || (!moved && e && e.type === 'pointerup')) feedFly(p, ch, b, g, target);
      else { g.classList.add('back'); const r = b.getBoundingClientRect(); g.style.left = r.left + 'px'; g.style.top = r.top + 'px'; setTimeout(() => { g.remove(); b.classList.remove('is-lifted'); dragging = false; }, 260); }
    };
    b.addEventListener('pointerup', end);
    b.addEventListener('pointercancel', end);
    b.addEventListener('click', (e) => {
      if (Date.now() - lastPtr < 800 || dragging) return;   // 指针（拖拽 / 点按）已经处理过；这里只接键盘的 Enter / 空格
      dragging = true;
      const r = b.getBoundingClientRect();
      const g = b.cloneNode(true); g.classList.add('hw-cookie-ghost');
      g.style.left = r.left + 'px'; g.style.top = r.top + 'px'; g.style.width = r.width + 'px'; g.style.height = r.height + 'px';
      C.root().appendChild(g);
      feedFly(p, ch, b, g, target);
    });
    return b;
  }
  function feedFly(p, ch, btn, ghost, target) {
    if (C.overLimit(p)) { ghost.remove(); dragging = false; C.showRest(); return; }
    const r = target.getBoundingClientRect();
    const tx = r.left + r.width / 2 - ghost.offsetWidth / 2, ty = r.top + r.height * 0.38 - ghost.offsetHeight / 2;
    target.classList.add('is-open');
    ghost.classList.add('fly');
    ghost.style.left = tx + 'px'; ghost.style.top = ty + 'px';
    btn.disabled = true; btn.classList.add('is-eaten');
    setTimeout(() => { ghost.remove(); eat(p, ch, btn, target); }, C.reduceMotion() ? 0 : 330);
  }
  function eat(p, ch, btn, target) {
    dragging = false;
    const q = C.curProf();
    if (!q.pet) return;
    const st0 = stageOf(q), t = today();
    if (!q.pet.ate || q.pet.ate.d !== t) q.pet.ate = { d: t, c: [] };
    if (q.pet.ate.c.indexOf(ch) >= 0 || q.pet.ate.c.length >= COOKIE_DAY) return;
    q.pet.ate.c.push(ch);
    const gold = ch === '★';
    if (!q.pet.h) {
      q.pet.eg += gold ? 3 : 1;
      if (heatOf(q) >= 100) q.pet.h = t;
    } else { q.pet.fed += gold ? 3 : 1; checkNeon(q); }
    q.pet.v = t;
    C.touch(q);
    const st1 = stageOf(q);
    chomp();
    target.classList.remove('is-open', 'is-eating'); void target.offsetWidth; target.classList.add('is-eating');
    hearts(target, gold ? 4 : 2);
    const say = gold ? (q.voy && q.voy.nw[0] ? sayOf(q.voy.nw[0], q.grade) : '') : sayOf(ch, q.grade);
    const b = D.getElementById('hw-petbubble');
    if (b) b.textContent = (st0 === 'egg' ? '（蛋暖暖的）' : '好吃！') + (say ? ' ' + say : '');
    speak((gold ? '金饼干！' : '') + say);
    if (btn && btn.parentNode) { btn.classList.add('gone'); setTimeout(() => { if (btn.isConnected) btn.remove(); updateAfterEat(q); }, 300); }
    if (st1 !== st0) {
      setTimeout(() => {
        C.confetti();
        C.burst(st1 === 'baby' ? '孵出来啦！' : st1 === 'neon' ? '变成霓虹啦！' : '长成少年啦！');
        try { C.sfx.win(); } catch (e) { /* ignore */ }
        setTimeout(() => { if (C.ui.view === 'pet') renderPet(); }, 1400);
      }, 700);
    } else setTimeout(() => { if (C.ui.view === 'pet' && !dragging) refreshPetBars(q); }, 350);
  }
  function updateAfterEat(p) {
    const box = D.getElementById('hw-cookies');
    if (box && !box.children.length) { if (C.ui.view === 'pet') setTimeout(() => { if (C.ui.view === 'pet' && !dragging) renderPet(); }, 1600); }
    const tag = D.querySelector('.hw-tray .hw-tag');
    if (tag) tag.textContent = cookiesToday(p).length + ' 块';
  }
  function refreshPetBars(p) {
    const st = stageOf(p);
    const bar = D.querySelector('.hw-petstage .hw-thermo-bar>span');
    if (bar) bar.style.width = (st === 'egg' ? heatOf(p) : growPct(p)) + '%';
    const v = D.querySelector('.hw-thermo-v');
    if (v) v.textContent = heatOf(p) + '°';
    const sm = D.querySelector('.hw-grow small');
    if (sm && st !== 'egg') sm.textContent = growText(p);
  }
  let eggSel = '';
  function renderEggPick(p) {
    const fams = eggFams(p.grade);
    const d = gdata(p.grade);
    if (fams.indexOf(eggSel) < 0) eggSel = '';
    const go = h('button', { class: 'hw-btn primary big', type: 'button', id: 'hw-egg-go', disabled: eggSel ? null : 'true', on: { click: () => choose() } }, eggSel ? '就选' + petOf(eggSel).nm + '蛋！' : '先点一颗蛋');
    const grid = h('div', { class: 'hw-eggs', role: 'radiogroup', 'aria-label': '选一颗字宠蛋' }, fams.map((k) => {
      const P = petOf(k), chars = d.order.filter((ch) => d.fam[ch] === k);
      return h('button', { type: 'button', role: 'radio', 'aria-checked': String(eggSel === k), class: 'hw-eggpick' + (eggSel === k ? ' is-sel' : ''), id: 'hw-egg-' + k, 'data-fam': k,
        // 就地更新（不整页重画）：整页重画会跳回顶部，手机上“就选××蛋！”按钮落在屏幕外，孩子以为没点上
        on: { click: () => {
          eggSel = k; C.sfx.tap();
          grid.querySelectorAll('.hw-eggpick').forEach((b) => { const on = b.dataset.fam === k; b.classList.toggle('is-sel', on); b.setAttribute('aria-checked', String(on)); });
          go.disabled = false; go.textContent = '就选' + petOf(k).nm + '蛋！';
          go.classList.remove('hw-pop'); void go.offsetWidth; go.classList.add('hw-pop');
          try { go.scrollIntoView({ block: 'nearest', behavior: C.reduceMotion() ? 'auto' : 'smooth' }); } catch (x) { /* ignore */ }
        } } },
        eggEl(k, { size: 84 }),
        h('b', null, P.nm + '蛋'),
        h('span', { class: 'hw-eggpick-f' }, '「' + k + '」家族 · ' + chars.length + ' 个字'),
        h('span', { class: 'hw-eggpick-c hw-kai' }, chars.slice(0, 5).join(' ') || '—'));
    }));
    C.ui.view = 'pet';
    C.page('选一颗字宠蛋', null, [
      h('section', { class: 'hw-card hw-stack' },
        h('p', { class: 'hw-vs-lead' }, '每颗蛋上画着一个部首。自己挑一颗！'),
        h('p', { class: 'hw-muted' }, '在游戏里答对这一家的字，蛋就会变暖；满 100 度就孵出来。孵出来以后，每天答对的字都会变成它的饼干。'),
        grid,
        h('div', { class: 'hw-row hw-center' }, go))
    ]);
    function choose() {
      if (!eggSel) return;
      const q = C.curProf();
      if (q.pet) { renderPet(); return; }
      q.pet = { f: eggSel, at: today(), t: C.now(), h: '', eg: 0, fed: 0, ate: { d: '', c: [] }, v: today(), n: '' };
      C.touch(q);
      C.sfx.stamp();
      const nm = petOf(eggSel).nm;
      eggSel = '';
      justChose = true;
      renderPet();
      C.confetti();
      speak(q.name + '的' + nm + '蛋，选好啦！');
    }
  }
  function restPet(p) {
    if (!p.pet) return null;
    return h('div', { class: 'hw-rest-pet' }, petEl(p, { size: 110, cls: 'is-asleep' }), h('span', { class: 'hw-rest-bed', 'aria-hidden': 'true' }));
  }

  /* ================= 图鉴 ================= */
  function viewPref(v) {
    if (v === undefined) { const s = C.LS.get('dexView', 'dex'); return s === 'stk' ? 'stk' : 'dex'; }
    C.LS.set('dexView', v); return v;
  }
  function groupsOf(p) {
    const d = gdata(p.grade);
    const out = d.famList.filter((f) => f.got >= 2).map((f) => ({ k: f.k, title: '「' + f.k + '」家族', chars: f.chars }));
    const inFam = new Set(); out.forEach((g) => g.chars.forEach((ch) => inFam.add(ch)));
    const rest = d.order.filter((ch) => !inFam.has(ch));
    if (rest.length) out.push({ k: '', title: out.length ? '其他部首' : '本年级的字', chars: rest });
    const extra = Object.keys(p.cards || {}).filter((ch) => !d.info[ch] && level(p.cards[ch]) >= 0);
    if (extra.length) out.push({ k: '', title: '其他年级收集的字', chars: extra.slice(0, 80), extra: true });
    return out;
  }
  function renderCards() {
    closeSheet();
    const p = C.curProf();
    C.ui.view = 'cards';
    flushBag();
    const d = gdata(p.grade);
    const view = viewPref();
    const cnt = [0, 0, 0, 0, 0];   // 未收集 灰 铜 银 金
    d.order.forEach((ch) => { cnt[level(cardOf(p, ch)) + 1]++; });
    const got = d.order.length - cnt[0];
    const pct = d.order.length ? Math.round(got / d.order.length * 100) : 0;
    const seg = h('div', { class: 'hw-seg', role: 'tablist', 'aria-label': '看法' },
      [['dex', '📖 图鉴'], ['stk', '🌟 贴纸本']].map((x) => h('button', { type: 'button', role: 'tab', id: 'hw-dexv-' + x[0], 'aria-selected': String(view === x[0]), class: view === x[0] ? 'is-on' : '',
        on: { click: () => { viewPref(x[0]); C.sfx.tap(); C.keepPlace(renderCards); } } }, x[1])));
    const summary = h('section', { class: 'hw-card hw-dexsum' },
      h('div', { class: 'hw-ring', style: '--pct:' + pct, role: 'img', 'aria-label': '完成 ' + pct + '%' }, h('b', null, pct + '%'), h('small', null, '完成')),
      h('div', { class: 'hw-dexsum-t' },
        h('p', { class: 'hw-dexsum-big' }, '全图鉴 ', h('b', null, String(got)), h('span', { class: 'tot' }, ' / ' + d.order.length)),
        h('div', { class: 'hw-rarity' },
          [[3, '金'], [2, '银'], [1, '铜'], [0, '灰']].map((x) => h('span', { class: 'hw-rar lv' + x[0] }, h('i', { 'aria-hidden': 'true' }), x[1] + ' ', h('b', null, String(cnt[x[0] + 1])))),
          h('span', { class: 'hw-rar lv-1' }, h('i', { 'aria-hidden': 'true' }), '未收集 ', h('b', null, String(cnt[0])))),
        h('p', { class: 'hw-muted' }, '稀有度 = 掌握程度：答对 1 次铜卡，隔天又答对银卡，按第 1、3、7 天都答对就是金卡。')));
    const groups = groupsOf(p);
    const body = view === 'stk' ? stickerBook(p, groups) : dexGroups(p, groups);
    C.page('字卡图鉴', p.grade.toUpperCase() + ' · ' + got + '/' + d.order.length, [seg, summary, body]);
  }
  function famStampOf(p, k) {
    if (!k) return null;
    const got = !!p.stamps['fam_' + k];
    return C.stampEl({ t: famWord(k) + '家族', shape: 'round' }, { size: 46, locked: !got, rot: -10 });
  }
  function dexGroups(p, groups) {
    return h('div', { class: 'hw-dex' }, groups.map((g) => {
      const lvs = g.chars.map((ch) => level(cardOf(p, ch)));
      const gold = lvs.filter((x) => x === 3).length, got = lvs.filter((x) => x >= 0).length;
      return h('section', { class: 'hw-card hw-fam', 'aria-label': g.title },
        h('div', { class: 'hw-fam-h' },
          g.k ? h('span', { class: 'hw-fam-rad', 'aria-hidden': 'true' }, g.k) : null,
          h('div', { class: 'hw-fam-t' }, h('h2', null, g.title), h('small', null, '收集 ' + got + '/' + g.chars.length + ' · 金卡 ' + gold + '/' + g.chars.length)),
          g.k && g.chars.length >= 3 ? famStampOf(p, g.k) : null),
        h('div', { class: 'hw-cardgrid' }, g.chars.map((ch, i) => zkEl(ch, lvs[i], { tag: 'button', attrs: { type: 'button', 'aria-label': ch + '，' + lvBadge(lvs[i]), on: { click: () => cardBack(ch) } } }))));
    }));
  }
  function stickerBook(p, groups) {
    return h('div', { class: 'hw-stkbook' }, groups.map((g) => {
      const lvs = g.chars.map((ch) => level(cardOf(p, ch)));
      return h('section', { class: 'hw-stkpage', 'aria-label': g.title },
        h('h2', { class: 'hw-stkpage-h' }, g.k ? h('span', { class: 'rad', 'aria-hidden': 'true' }, g.k) : null, g.title),
        h('div', { class: 'hw-stks' }, g.chars.map((ch, i) => {
          const rot = (hashNum(ch) % 17) - 8;
          return h('button', { type: 'button', class: 'hw-stk lv' + lvs[i], style: '--rot:' + rot + 'deg', 'data-ch': ch, 'aria-label': ch + '，' + lvBadge(lvs[i]), on: { click: () => cardBack(ch) } },
            h('span', { class: 'hw-stk-hz' }, ch), lvs[i] === 3 ? h('span', { class: 'hw-stk-star', 'aria-hidden': 'true' }, '★') : null);
        })));
    }));
  }
  function cardBack(ch) {
    const p = C.curProf();
    const c = cardOf(p, ch), lv = level(c);
    const info = charInfo(ch, p.grade), rad = radOf(ch, p.grade);
    const tzg = h('div', { class: 'hw-cb-tzg' });
    let writer = null;
    const mk = () => { if (!writer && tzg.isConnected) writer = C.hanzi.create(tzg, ch, { width: 170, height: 170, showCharacter: true, showOutline: true }, hzBag); return writer; };
    const body = h('div', { class: 'hw-cardback lv' + lv },
      h('div', { class: 'hw-cb-main' },
        tzg,
        h('div', { class: 'hw-cb-side' },
          h('div', { class: 'hw-cb-py hw-py' }, info.py || ''),
          rad ? h('p', null, h('b', null, '部首 '), radLabel(ch, p.grade)) : null,
          info.jg ? h('p', null, h('b', null, '结构 '), info.jg) : null,
          c ? h('p', { class: 'hw-cb-stat' }, '答对 ' + c.r + ' 次 · 答错 ' + c.w + ' 次') : null)),
      info.words.length ? h('p', { class: 'hw-cb-words' }, h('b', null, '组词 '), info.words.slice(0, 5).map((w) => h('span', { class: 'hw-nc-w' }, hlChar(w, ch)))) : null,
      info.sent ? h('p', { class: 'hw-cb-sent' }, h('b', null, '例句 '), hlChar(info.sent, ch)) : null,
      h('p', { class: 'hw-cb-tip' }, tipOf(c)),
      h('div', { class: 'hw-row hw-center' },
        h('button', { class: 'hw-btn', type: 'button', id: 'hw-cb-say', on: { click: () => speak(sayOf(ch, p.grade) + (info.sent ? '。' + info.sent : '')) } }, '🔊 朗读'),
        h('button', { class: 'hw-btn primary', type: 'button', id: 'hw-cb-stroke', on: { click: () => { const w = mk(); if (w) try { w.animateCharacter(); } catch (e) { /* ignore */ } } } }, '✍️ 笔顺')));
    sheet({ title: ch + ' · ' + lvBadge(lv), cls: 'hw-cbsheet', body, focus: '#hw-cb-say' });
    mk();
    if (!writer) { tzg.classList.add('hw-nc-nohz'); tzg.textContent = ch; }
  }

  /* ================= 灯塔弹层 ================= */
  function towerSheet(p) {
    const tw = tower(p), t = today();
    const cells = [];
    for (let i = 13; i >= 0; i--) {
      const d = addDays(t, -i), done = p.days.indexOf(d) >= 0;
      const cls = done ? 'ok' : tw.fogUsed.has(d) ? 'fog' : d === t ? 'now' : tw.dimmed.has(d) ? 'dim' : 'miss';
      cells.push(h('span', { class: 'hw-cal ' + cls, title: mdStr(d) }, h('small', null, String(Number(d.slice(8, 10)))), h('b', null, done ? '✓' : cls === 'fog' ? '☁️' : cls === 'now' ? '…' : cls === 'dim' ? '◐' : '·')));
    }
    sheet({ title: '我的灯塔', cls: 'hw-twsheet', body: [
      h('div', { class: 'hw-tw-hero' }, towerEl(tw.floors, tw.lit, tw.today, 'big'),
        h('div', null,
          h('p', { class: 'hw-tw-n' }, '连胜 ', h('b', null, String(tw.lit)), ' 天'),
          h('p', { class: 'hw-muted' }, '灯塔一共 ' + tw.floors + ' 层（每完成一天航线加一层）'),
          h('p', { class: 'hw-tw-fog' }, '☁️ 雾天卡 ×' + tw.fog))),
      h('div', { class: 'hw-cals', 'aria-label': '最近 14 天' }, cells),
      h('ul', { class: 'hw-tw-rules' },
        h('li', null, '每天完成今日航线，灯塔加一层、连胜 +1。'),
        h('li', null, '每周一自动送 1 张雾天卡（最多存 2 张）。哪天没来，雾天卡自动帮你挡住，连胜不断。'),
        h('li', null, '雾天卡用完又漏了一天？灯塔只暗一层，不会清零。')),
      h('div', { class: 'hw-ms' }, MILESTONES.map((m) => h('span', { class: 'hw-ms-i' + (tw.best >= m ? ' on' : '') }, '🎆 ' + m + ' 天'))),
      h('button', { class: 'hw-btn primary big', type: 'button', on: { click: closeSheet } }, '好的')
    ] });
  }
  function sibSheet() {
    const all = sibs(), t = today();
    const allDone = all.every((q) => q.days.indexOf(t) >= 0);
    const n = togetherDays(all);
    sheet({ title: '兄妹灯塔', cls: 'hw-twsheet', body: [
      h('div', { class: 'hw-tw-hero' }, towerEl(Math.max(n, 1), n, allDone, 'big sib'),
        h('div', null,
          h('p', { class: 'hw-tw-n' }, allDone ? '今天亮啦！' : '今天还没亮'),
          h('p', { class: 'hw-muted' }, '所有小朋友当天都完成航线，大灯塔才会亮。一起亮灯 ' + n + ' 天。'))),
      h('ul', { class: 'hw-sibl' }, all.map((q) => {
        const done = q.days.indexOf(t) >= 0;
        const k = q.voy && q.voy.d === t ? doneN(q.voy) : 0;
        return h('li', { class: done ? 'ok' : '' }, h('span', { class: 'av', 'aria-hidden': 'true' }, q.avatar), h('b', null, q.name),
          h('span', { class: 'st' }, done ? '✓ 今天完成了航线' : '还在航行中（' + k + '/4）'));
      })),
      h('p', { class: 'hw-muted' }, '兄妹灯塔只看“有没有完成”，不比谁快、谁多。'),
      h('button', { class: 'hw-btn primary big', type: 'button', on: { click: closeSheet } }, '好的')
    ] });
  }

  /* ================= 结算页 ================= */
  /* 航线站：拿到至少 1 颗星（答对三成以上）才算完成——一上来就输光心不算；星数不影响别的 */
  function onRound(p, sess, out) {
    const v = plan(p, false);
    const res = { marked: [], voyTouched: !!sess.voy, retry: '' };
    const okRound = num(out && out.stars) >= 1;
    const want = [];
    if (sess.voy === 'h' && !v.s.h) want.push('h');
    if (v.g && sess.game.id === v.g && !v.s.g && !sess.review) want.push('g');
    want.forEach((k) => { if (okRound) { v.s[k] = 1; res.marked.push(k); } else res.retry = k; });
    if (res.marked.length || res.retry) res.voyTouched = true;
    res.ready = chestReady(v) && !v.s.c;
    return res;
  }
  /* 同一关反复刷，小红花递减：同一个游戏的同一关，今天前 3 局照常，第 4 局起每局最多 1 朵（错题重练不算） */
  const REPEAT_FULL = 3;
  function roundFlowers(p, sess, out, stars) {
    if (!sess || sess.review || !stars) return stars;
    const v = plan(p, false);
    if (!v.rc) v.rc = {};
    const key = String(sess.game.id).slice(0, 30) + ':' + (out && out.level ? out.level : 0);
    const n = (v.rc[key] || 0) + 1;
    v.rc[key] = n;
    if (n <= REPEAT_FULL) return stars;
    const give = Math.min(stars, 1);
    if (out && give < stars) out.fewer = { n, give, stars };
    return give;
  }
  function resultBlock(p, sess, out) {
    const m = sess.meta || { ups: [], fresh: [], cookies: [], heat: 0 };
    const rows = [];
    const cardsRow = (k, txt, list) => h('div', { class: 'hw-rm-row' }, h('span', { class: 'hw-rm-k' }, k), h('span', { class: 'hw-rm-v' }, txt),
      h('span', { class: 'hw-rm-cards' }, list.slice(0, 10).map((ch) => { const lv = level(cardOf(p, ch)); return zkEl(ch, lv, { cls: 'mini', label: lv >= 1 ? LV[lv].slice(0, 1) : '' }); })));
    // 新收集的卡和升级的卡分开数（新卡不再算一次“升级”）
    if (m.fresh.length) rows.push(cardsRow('📖 新字卡', '收进图鉴 ' + m.fresh.length + ' 张', m.fresh));
    const ups = m.ups.slice().sort((a, b) => b.lv - a.lv);
    if (ups.length) rows.push(cardsRow('⬆️ 升级', ups.length + ' 张卡升级啦！', ups.map((u) => u.ch)));
    if (p.pet) {
      const st = stageOf(p);
      if (m.neon) rows.push(h('div', { class: 'hw-rm-row hot' }, h('span', { class: 'hw-rm-k' }, '🌈 字宠'), h('span', { class: 'hw-rm-v' }, '「' + p.pet.f + '」家族全部金卡，' + petOf(p.pet.f).nm + '变成霓虹啦！')));
      else if (m.hatched) rows.push(h('div', { class: 'hw-rm-row hot' }, h('span', { class: 'hw-rm-k' }, '🐣 字宠'), h('span', { class: 'hw-rm-v' }, petOf(p.pet.f).nm + '蛋孵出来啦！快去看看它')));
      else if (st === 'egg' && m.heat) rows.push(h('div', { class: 'hw-rm-row' }, h('span', { class: 'hw-rm-k' }, '🥚 字宠蛋'), h('span', { class: 'hw-rm-v' }, '暖了 ' + m.heat + ' 度，现在 ' + heatOf(p) + ' 度')));
      else if (st !== 'egg' && m.cookies.length) rows.push(h('div', { class: 'hw-rm-row' }, h('span', { class: 'hw-rm-k' }, '🍪 饼干'), h('span', { class: 'hw-rm-v' }, '+' + m.cookies.length + ' 块，去喂' + petOf(p.pet.f).nm + '吧')));
    } else if (m.cookies.length) rows.push(h('div', { class: 'hw-rm-row' }, h('span', { class: 'hw-rm-k' }, '🥚 字宠'), h('span', { class: 'hw-rm-v' }, '选一颗蛋，答对的字就能喂它')));
    const r = out.meta;
    if (r && (r.marked.length || r.voyTouched)) {
      const names = r.marked.map((k) => { const s = STATIONS.find((x) => x.k === k); return s.no + ' ' + s.nm + ' ✓'; });
      const rs = r.retry && !names.length ? STATIONS.find((x) => x.k === r.retry) : null;
      rows.push(h('div', { class: 'hw-rm-row voy' }, h('span', { class: 'hw-rm-k' }, '⛵ 航线'),
        h('span', { class: 'hw-rm-v' }, (names.length ? names.join('  ') : rs ? rs.no + ' ' + rs.nm + '：拿到 1 颗星就算完成，再来一局吧！' : '这一站之前已经完成啦') + (r.ready ? ' · 宝箱可以打开啦！' : ''))));
    }
    if (out.fewer) rows.push(h('div', { class: 'hw-rm-row' }, h('span', { class: 'hw-rm-k' }, '🌺 小红花'),
      h('span', { class: 'hw-rm-v' }, '这一关今天玩到第 ' + out.fewer.n + ' 局啦，这局奖 ' + out.fewer.give + ' 朵。试试下一关或别的游戏，能拿满星星的小红花！')));
    if (!rows.length) return null;
    return h('div', { class: 'hw-rmeta' }, rows);
  }

  /* ================= 家族印章 ================= */
  function stamps(p) {
    const d = gdata(p.grade);
    const out = d.famList.filter((f) => f.got >= 3).slice(0, 12).map((f) => ({
      id: 'fam_' + f.k, t: famWord(f.k) + '家族', shape: 'round',
      need: '「' + f.k + '」家族 ' + f.chars.length + ' 个字全部金卡',
      prog: (q) => [f.chars.filter((ch) => level(cardOf(q, ch)) === 3).length, f.chars.length],
      test: (q) => f.chars.length >= 3 && f.chars.every((ch) => level(cardOf(q, ch)) === 3)
    }));
    // 换过年级：以前得到的家族印章照样留在印章册里（印章数和总数对得上）
    const ids = new Set(out.map((s) => s.id));
    Object.keys(p.stamps || {}).forEach((id) => {
      if (id.indexOf('fam_') !== 0 || ids.has(id) || !p.stamps[id]) return;
      const k = id.slice(4);
      out.push({ id, t: famWord(k) + '家族', shape: 'round', need: '「' + k + '」家族全部金卡（在别的年级得到）', test: () => true });
    });
    return out;
  }

  /* ================= 核心钩子 ================= */
  function refresh(view) {
    if (sheetCur) return;
    if (view === 'cards') C.keepPlace(renderCards);
    else if (view === 'pet' && !dragging) C.keepPlace(renderPet);
  }
  function onKey(e) {
    if (e.key === 'Escape' && sheetCur) { closeSheet(); e.preventDefault(); return true; }
    return false;
  }
  // 离开图鉴 / 新字 / 字宠页时收掉弹层与笔顺监听
  D.addEventListener('click', (e) => { const b = e.target && e.target.closest && e.target.closest('#hw-back'); if (b) { closeSheet(); flushBag(); } }, true);

  HW.meta = {
    itemChars, level: (ch, p) => level(cardOf(p || C.curProf(), ch)), cards: (p) => (p || C.curProf()).cards,
    plan: (p) => plan(p || C.curProf()), tower: (p) => { const t = tower(p || C.curProf()); return { floors: t.floors, lit: t.lit, fog: t.fog, today: t.today, fogUsed: Array.from(t.fogUsed), dimmed: Array.from(t.dimmed) }; },
    heat: (p) => heatOf(p || C.curProf()), stage: (p) => stageOf(p || C.curProf()), cookies: (p) => cookiesToday(p || C.curProf()),
    due: (p) => dueChars(p || C.curProf(), today()), families: (gr) => gdata(gr || C.curProf().grade).famList.map((f) => ({ k: f.k, n: f.n, chars: f.chars.join('') })),
    eggs: (gr) => eggFams(gr || C.curProf().grade), wallet: (p) => (p || C.curProf()).wallet,
    openStation, renderCards, renderPet, renderNewChars, closeSheet, merge, sig, pack, due1: (ch, p) => dueOf(cardOf(p || C.curProf(), ch)),
    sibs: () => sibs().map((q) => q.id)
  };
  // 只供测试：不开游戏直接记一次答题（ok = true 答对 / false 答错）。只有 URL 带 #hwdebug 时才挂出来（见 10_core.js 的 DEBUG）
  if (C.debug) HW.meta._answer = (item, ok, p) => answer(p || C.curProf(), item, ok !== false, null);
  C.useMeta({
    norm, merge, absorb, sig, earn, answer, itemHas, onRound, roundFlowers, pack, resultBlock, stamps, refresh, onKey,
    mapBoard, pinPet, hudCards, cardLine, restPet, renderCards: () => renderCards()
  });
})();
