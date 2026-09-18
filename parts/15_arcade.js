/* =====================================================================
 * 华文小岛 2.0 · 街机引擎 HW.arcade（parts/15_arcade.js）
 * 契约见 SPEC_ARCADE.md §3。本文件不依赖任何库；挂在已存在的 window.HW 上。
 *
 * ───────────── 给游戏作者：最短可用示例 ─────────────
 *   HW.register({ id:'balloon', skill:'listen', kind:'arcade', name:'气球射击', icon:'🎈',
 *     blurb:'听词语，戳破写对的气球', needs:['tts'], cols:['pick'],
 *     start(ctx){ return HW.arcade.run(ctx, {
 *       maxLevel:10, lives:3, rounds:8, music:'bright', sky:'day',
 *       intro:'听词语，戳破写对的气球！', controls:'点气球 / 空格重听',
 *       init(g){ g.list = g.items('pick', g.rounds); g.rounds = Math.min(g.rounds, g.list.length); ... },
 *       play(g){ g.say(g.list[0].say); },        // 可选（本引擎扩展）：3·2·1 结束、进入 play 时调用，每关一次
 *       update(g, dt){ ... }, draw(g, c){ ... },
 *       down(g, p){ if (g.hitCircle(p, b.x, b.y, 40)) g.right(item, b.x, b.y); },
 *       key(g, k){ if (k === 'space') g.say(...); },
 *     }); } });
 *
 * ───────────── spec（run 的第二个参数）─────────────
 *   maxLevel(10) lives(3，0=不显示红心也不会因错误失败) rounds(8 或 function(level))
 *   intro / controls（选关界面与 3·2·1 下方的说明） music:'bright'|'calm'|'drum'|null
 *   sky:'day'|'sea'|'night'|'space'|'road'|'grass'|null（null = 游戏在 draw 里自己画满背景）
 *   init(g)      每关开始（含重玩）在 3·2·1 之前调用；g.level/g.rounds/g.lives 已重置。之后 draw 才会被调用。
 *   play(g)      【扩展，可选】倒计时结束、state 变成 'play' 的那一刻调用。适合第一次 g.say。
 *   update(g,dt) 只在 state==='play' 时调用，dt 秒（≤0.05）
 *   draw(g,c)    init 之后每帧调用（intro 倒计时 / play / pause / over 都会画），c 已按 DPR 缩放，
 *                坐标 = CSS 像素 0..g.w × 0..g.h；画在引擎背景之上、粒子/HUD 之下。
 *   down/move/up(g,p)  p = {x, y, id, down, type}。多点触控只认第一根手指。
 *                鼠标悬停移动也会调用 move（此时 p.down=false）；触摸只在按住时有 move。
 *   key(g,k)     'left'|'right'|'up'|'down'|'space'|'enter'|其它原始 e.key（如 'a'、'1'）；按住自动连发不会重复调用。
 *                持续按住的方向请读 g.held.left / g.held.right ...（扩展）
 *                Esc / P 由引擎用来暂停，不会传给游戏。
 *   resize(g)    画布尺寸变化后（g.w/g.h/g.hudTop 已更新）
 *   dom(g,layer) 可选：layer 是盖在画布上的绝对定位 div（默认 pointer-events:none，它的直接子元素可点）。
 *                在选关界面出现前调用一次；选关界面期间 layer 隐藏。
 *   end(g)       游戏结束 / 退出 / 页面离开时调用一次（停麦克风、HanziWriter 等）
 *
 * ───────────── g（游戏实例）─────────────
 * 尺寸/时间：g.w g.h（CSS 像素） g.hudTop（HUD 占用高度，自己的内容画在其下） g.dpr
 *   g.t（本关 play 秒数；暂停/倒计时不走） g.level g.maxLevel g.state（'intro'|'play'|'pause'|'over'）
 *   g.ctx g.G（= ctx.G 本年级题库） g.grade（'p3'） g.gradeNum（3） g.isReview（错题重练中）
 * 计分：g.score g.lives g.maxLives g.combo g.maxCombo g.done g.rounds（可在 init 里改） g.wrongs g.misses
 *   g.right(item, x, y, label?)  +10×连击倍率（连击≥3 ×2，≥6 ×3，≥10 ×4）、粒子、飘字、音效、ctx.score.right(item)、g.done++；
 *                                g.done >= g.rounds 时自动 g.win()。item 请传题库里的原对象（错题本按它点名）。
 *   g.wrong(item, note, x, y)    扣 1 心、断连击、抖屏、红 ✗、音效、ctx.score.wrong(item, note)；心归零自动 g.lose()
 *   g.miss(x, y)                 只断连击 + 小抖动（“让它跑掉了”），不扣心不记错题
 *   g.addScore(n, x, y)  g.win()  g.lose()   —— win/lose 只在 play 中生效、只生效一次；
 *                                结束动画 2.6–3.2 秒（1.1 秒后点一下 / Enter 可跳过）→ ctx.finish 恰好一次：
 *                                {correct, total, stars, level, score, win}（后三项为扩展，核心结算页读）
 *                                结束动画期间 g.addScore 仍有效（存档 hi / 结算面板会跟着更新），g.right/g.wrong 无效
 *   暂停面板“退出”/ 选关界面 Esc = 回地图，不调 ctx.finish（和核心顶栏“退出”一样不记这一轮）
 *   通关且 ≥2 星解锁下一关；ctx.mem 键 'arc' = {lv:已解锁最高关, best:{关号:星}, hi:最高分,
 *                                last:{lv, score, stars, win, unlocked}}（last 为扩展，结算页可读）
 * 特效：g.burst(x,y,{color,n,kind:'star'|'coin'|'dot'|'ink'|'water'|'confetti'|'spark'})  g.confetti()
 *   g.float(text,x,y,{color,size})  g.shake(px)  g.flash(color)  g.ring(x,y,color)
 * 动画（用游戏时钟：暂停 / 倒计时期间不走；结束动画期间照走；重玩 / 退出自动取消）：
 *   g.tween(obj,{prop:to},sec,ease?,onDone?) → {cancel()}   ease 可以是函数或名字 'outBack'
 *   g.after(sec, fn) → {cancel()}     g.ease.{linear,inQuad,outQuad,inOutQuad,outCubic,outBack,outBounce,outElastic}
 * 绘图（都画在当前画布 g.c 上；文字 / emoji 自动离屏缓存）：
 *   g.text(str,x,y,{size=24,color='#fff',font:'kai'|'round'|'num'|'sans'|'py',weight,align='center',
 *          baseline='middle',stroke,strokeW,maxW,alpha,shadow})  → 实际绘制宽度；maxW 时自动缩小放下
 *          题目里的汉字一律 font:'kai'。'round' = Baloo 2 + ZCOOL KuaiLe；'num' = Baloo 2 数字。
 *   g.shadowText(str,x,y,opts)（粗描边 + 投影的游戏标题字）  g.measure(str,size,font,weight) → 宽度
 *   g.emoji(ch,x,y,size,{rot,alpha,flip})  g.rrect(x,y,w,h,r,fill,stroke,lw)  g.cloud(x,y,s,alpha)（s=1 约 120px 宽）
 *   g.wrapText(str,maxW,size,font) → 行数组（中文逐字断行、行首不放标点）
 * 声音：g.sfx(name) name ∈ pop coin jump splash hit whoosh power tick bubble crash swing chomp flip match beat good bad win lose
 *          （另有 go star heart combo）；跟随全局声音开关。
 *   g.say(text,{rate,caption}) → Promise：调 ctx.tts.speak 并压低音乐；没有中文朗读时立即 resolve，
 *          在画面上方显示 1.5 秒拼音字幕（不显示汉字答案；caption 可自定义）。g.speaking = 正在朗读。
 *   g.music(on)  true/false 开关；也可传 'bright'|'calm'|'drum' 换曲
 * 工具：g.rand(a,b) g.randi(a,b)（含两端） g.pick(arr) g.shuffle(arr)（返回新数组） g.clamp(v,a,b) g.lerp(a,b,t)
 *   g.dist(ax,ay,bx,by) g.hitCircle(p,x,y,r) g.hitRect(p,x,y,w,h)（x,y 为左上角）
 *   g.items(col, n)   重练模式（ctx.review 非空）且错题里有该栏目的题 → 只用错题（可能少于 n！请
 *                     g.rounds = Math.min(g.rounds, list.length)）；否则 ctx.pick(ctx.G[col], n)
 *                     注意：重练时该栏目没有错题会退回题库新题——多栏目游戏请先看 g.hasReview(col)
 *   g.hasReview(col)  【扩展】错题里该栏目有几道（不在重练 = 0）
 *   g.charPool()      本年级汉字 → 无调拼音（ü 写作 v）映射对象，如 {'晴':'qing'}
 *   g.similarChars(ch, n=3, exclude?)  造干扰字（只按读音，不懂字形）：同音 → 近音（平翘舌 / n-l / f-h / 前后鼻音）
 *                     → 同韵母 → 同声母 → 本年级其它字；不含 ch 与 exclude（字符串或数组）。
 *                     exclude 传整个词（如 '公园'）时，换字后成了题库里另一个词的候选也会排除
 *   g.pinyinOf(text) → 带调拼音：整段是题库里的词 / 绕口令的一段 → 课本注音；否则最长词优先，单字取最常见读音，
 *                     并做“一 / 不”变调；查不到或定不了调的字给 '·'。题目自带 py 时请直接传 {caption: py}
 * 背景（扩展）：g.sky 可随时改（换场景）；g.bgSpeed 背景滚动倍率（默认 1；只影响 space/road 的滚动与 sea 的小鱼，
 *   0 = 路面 / 星空停住；云、浪等环境动画照常）
 *   g.horizon：当前背景的地平线/水面 y（sea = 水面；road = 路的消失线；space = g.h）
 *   road 背景的透视工具：g.road = {hy, by, cx, hwTop, hwBot, lanes, span}；g.roadLanes = 车道数（默认 3，可改）
 *     g.roadPos(lane, t, out?) → out = {x, y, s}：lane 可为小数（0 = 最左车道），t 0（远处）→1（画面底边），s = 缩放（1 = 最近）
 *     t 线性增长 = 在路上匀速靠近（近大远小、越近越快）；要和路面条纹同速：t += g.roadSpeed / g.road.span * dt
 *     （g.roadSpeed = 7 × g.bgSpeed，只读）
 * HUD（引擎画）：左上红心（心多 / 屏窄时自动变成“❤×N”）、中上关卡号 + 进度条、右上分数 + 连击火焰、
 *   最右暂停按钮（也可 Esc / P）。选关界面默认关卡：ctx.levelHint（核心结算页“下一关”）> 上一局 > 已解锁最高关。
 * 调试：HW.arcade.stats() → {live, music, particles(≤300), frameMs, cache…}；退出后应为 live:0、music:false。
 * ===================================================================== */
(function () {
  'use strict';
  const W = window, D = document;
  const HW = W.HW;
  if (!HW || typeof HW !== 'object') { try { console.warn('[HW.arcade] window.HW 不存在，街机引擎未加载'); } catch (e) { /* ignore */ } return; }

  /* ================= 小工具 ================= */
  const TAU = Math.PI * 2;
  const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
  const lerp = (a, b, t) => a + (b - a) * t;
  const rand = (a, b) => (b === undefined ? (a === undefined ? Math.random() : Math.random() * a) : a + Math.random() * (b - a));
  const randi = (a, b) => Math.floor(a + Math.random() * (b - a + 1));
  const pickOne = (arr) => (arr && arr.length ? arr[Math.floor(Math.random() * arr.length)] : undefined);
  function shuffle(arr) {
    const a = Array.from(arr || []);
    for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); const t = a[i]; a[i] = a[j]; a[j] = t; }
    return a;
  }
  const dist = (ax, ay, bx, by) => Math.hypot(bx - ax, by - ay);
  const isHan = (ch) => /[\u3400-\u9fff\uf900-\ufaff]/.test(ch);
  const now = () => (W.performance && performance.now ? performance.now() : Date.now());
  function reduceMotion() { try { return !!(W.matchMedia && W.matchMedia('(prefers-reduced-motion: reduce)').matches); } catch (e) { return false; } }
  function el(tag, cls, text) {
    const e = D.createElement(tag);
    if (cls) e.className = cls;
    if (text != null) e.textContent = String(text);
    return e;
  }
  function btn(cls, text, onClick, label) {
    const b = el('button', 'arc-btn ' + (cls || ''), text);
    b.type = 'button';
    if (label) b.setAttribute('aria-label', label);
    if (onClick) b.addEventListener('click', (e) => { e.preventDefault(); onClick(e); });
    return b;
  }

  const EASE = {
    linear: (t) => t,
    inQuad: (t) => t * t,
    outQuad: (t) => t * (2 - t),
    inOutQuad: (t) => (t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t),
    outCubic: (t) => { const u = t - 1; return u * u * u + 1; },
    outBack: (t) => { const s = 1.70158, u = t - 1; return u * u * ((s + 1) * u + s) + 1; },
    outBounce: (t) => {
      const n = 7.5625, d = 2.75;
      if (t < 1 / d) return n * t * t;
      if (t < 2 / d) { t -= 1.5 / d; return n * t * t + 0.75; }
      if (t < 2.5 / d) { t -= 2.25 / d; return n * t * t + 0.9375; }
      t -= 2.625 / d; return n * t * t + 0.984375;
    },
    outElastic: (t) => (t === 0 || t === 1 ? t : Math.pow(2, -10 * t) * Math.sin((t * 10 - 0.75) * (TAU / 3)) + 1)
  };

  /* 全局声音开关（核心 settings.sound 私有：优先用核心将来暴露的接口，其次读核心写入的 localStorage） */
  let soundCache = true, soundAt = -1e9;
  function soundOn() {
    const t = now();
    if (t - soundAt < 300) return soundCache;
    soundAt = t;
    let v = true;
    try {
      if (typeof HW.soundOn === 'function') v = !!HW.soundOn();
      else if (typeof HW.sound === 'boolean') v = HW.sound;
      else if (HW.settings && typeof HW.settings.sound === 'boolean') v = HW.settings.sound;
      else {
        const s = W.localStorage.getItem('hw.v1.settings');
        if (s) { const o = JSON.parse(s); if (o && o.sound === false) v = false; }
      }
    } catch (e) { v = true; }
    soundCache = v;
    return v;
  }

  /* ================= 样式（类名一律 arc- 开头） ================= */
  const NAVY = '#1d2b53';
  let cssDone = false;
  function injectCss() {
    if (cssDone || typeof HW.css !== 'function') return;
    cssDone = true;
    HW.css('@import url("https://fonts.googleapis.com/css2?family=Baloo+2:wght@600;700;800&family=ZCOOL+KuaiLe&display=swap");');
    const out = '0 3px 0 ' + NAVY + ',2px 2px 0 ' + NAVY + ',-2px 2px 0 ' + NAVY + ',2px -2px 0 ' + NAVY + ',-2px -2px 0 ' + NAVY +
      ',3px 0 0 ' + NAVY + ',-3px 0 0 ' + NAVY + ',0 -3px 0 ' + NAVY;
    HW.css(`
.arc-host{max-width:none!important;padding:0!important;margin:0!important;gap:0!important;display:block!important}
.hw-shell:has(> .arc-host){padding-bottom:0!important}
.arc-root{position:relative;width:100%;height:560px;overflow:hidden;border-radius:18px;background:#7fd3ff;
  touch-action:none;-webkit-user-select:none;user-select:none;-webkit-touch-callout:none;isolation:isolate;
  box-shadow:0 5px 0 rgba(20,40,80,.28);contain:layout paint;--arc-f:"ZCOOL KuaiLe","Baloo 2","PingFang SC","Microsoft YaHei",system-ui,sans-serif;
  --arc-n:"Baloo 2","Arial Rounded MT Bold","Helvetica Neue",Arial,system-ui,sans-serif}
.arc-root.is-bleed{border-radius:0;box-shadow:none}
.arc-cv{position:absolute;left:0;top:0;display:block;touch-action:none;outline:none}
.arc-dom{position:absolute;inset:0;z-index:2;pointer-events:none}
.arc-dom>*{pointer-events:auto}
.arc-dom.is-off{visibility:hidden}
.arc-pbtn{position:absolute;z-index:3;top:0;right:0;width:52px;height:52px;border:0;padding:0;margin:0;background:transparent;border-radius:50%;cursor:pointer;color:transparent;font-size:1px}
.arc-pbtn:focus-visible{outline:4px solid #FFE45C;outline-offset:-4px}
.arc-pbtn[hidden]{display:none}
.arc-ov{position:absolute;inset:0;z-index:5;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:12px;
  padding:16px;text-align:center;color:${NAVY};font-family:var(--arc-f);overflow:auto}
.arc-ov[hidden]{display:none!important}
.arc-ov.dim{background:radial-gradient(ellipse at 50% 40%,rgba(20,40,90,.35),rgba(8,18,48,.72));-webkit-backdrop-filter:blur(2px);backdrop-filter:blur(2px)}
.arc-panel{position:relative;width:min(100%,420px);margin-top:26px;padding:46px 20px 20px;border:4px solid ${NAVY};border-radius:30px;
  background:linear-gradient(180deg,#FFFBEF 0%,#FFEFC7 100%);box-shadow:0 8px 0 ${NAVY},0 20px 34px rgba(0,0,0,.28);
  display:flex;flex-direction:column;align-items:center;gap:12px}
.arc-panel::before{content:"";position:absolute;inset:7px;border:2px dashed rgba(29,43,83,.18);border-radius:22px;pointer-events:none}
.arc-ribbon{position:absolute;left:50%;top:-30px;transform:translateX(-50%);min-width:62%;max-width:calc(100% + 24px);padding:8px 26px 10px;
  background:linear-gradient(180deg,#FF9A5A,#FF6A3D);border:4px solid ${NAVY};border-radius:18px;box-shadow:0 5px 0 ${NAVY};
  color:#fff;font:400 clamp(24px,7vw,32px)/1.1 var(--arc-f);letter-spacing:.06em;white-space:nowrap;text-shadow:${out}}
.arc-ribbon small{display:inline-block;margin-left:8px;padding:1px 8px;border-radius:999px;background:#FFE45C;color:${NAVY};font-size:14px;letter-spacing:0;text-shadow:none;vertical-align:middle;border:2px solid ${NAVY}}
.arc-icon{font-size:64px;line-height:1;filter:drop-shadow(0 6px 0 rgba(29,43,83,.18));animation:arc-bob 1.6s ease-in-out infinite}
.arc-blurb{font-size:19px;line-height:1.35;max-width:22em}
.arc-lvrow{display:flex;align-items:center;justify-content:center;gap:14px;width:100%}
.arc-lv{min-width:132px;display:flex;flex-direction:column;align-items:center;gap:2px}
.arc-lv-n{display:flex;align-items:baseline;gap:6px;font-size:22px}
.arc-lv-n b{font:800 64px/0.95 var(--arc-n);color:#FF7A3D;text-shadow:${out},0 6px 0 rgba(0,0,0,.18);min-width:1.2em}
.arc-stars{display:flex;gap:4px;font-size:30px;line-height:1}
.arc-star{color:#D9CFB5;-webkit-text-stroke:2px ${NAVY};text-shadow:0 3px 0 rgba(29,43,83,.25)}
.arc-star.on{color:#FFC928}
.arc-dots{display:flex;flex-wrap:wrap;justify-content:center;gap:8px;max-width:100%;margin:0 auto}
.arc-dot{width:40px;height:40px;border-radius:50%;border:3px solid ${NAVY};background:#E9DFC4;color:${NAVY};
  font:800 18px/1 var(--arc-n);display:grid;place-items:center;padding:0 0 1px;cursor:pointer;box-shadow:0 3px 0 ${NAVY};
  -webkit-tap-highlight-color:transparent;touch-action:manipulation}
.arc-dot.won{background:#FFD84D}
.arc-dot.open{background:#fff}
.arc-dot.cur{background:#FF7A3D;color:#fff;transform:scale(1.12)}
.arc-dot.lock{font-size:15px}
.arc-dot[disabled]{cursor:default;opacity:.55;box-shadow:none}
.arc-ctrl{font:600 15px/1.35 var(--arc-f);color:#5a6690}
.arc-hi{font:700 16px/1 var(--arc-n);color:${NAVY};display:flex;gap:6px;align-items:center}
.arc-btn{--c:#FFB020;--d:#D07A00;position:relative;display:inline-flex;align-items:center;justify-content:center;gap:10px;
  min-width:56px;min-height:56px;padding:8px 24px 12px;border:3.5px solid ${NAVY};border-radius:20px;
  background:linear-gradient(180deg,rgba(255,255,255,.42) 0,rgba(255,255,255,0) 48%),var(--c);color:#fff;
  font:400 25px/1 var(--arc-f);letter-spacing:.04em;text-shadow:0 2px 0 rgba(0,0,0,.28),${out.split(',').slice(0, 5).join(',')};
  box-shadow:inset 0 -6px 0 var(--d),inset 0 3px 0 rgba(255,255,255,.5),0 6px 0 ${NAVY},0 10px 16px rgba(0,0,0,.22);
  cursor:pointer;-webkit-tap-highlight-color:transparent;transition:transform .07s ease,box-shadow .07s ease;touch-action:manipulation}
.arc-btn:active,.arc-btn.is-down{transform:translateY(5px);box-shadow:inset 0 -3px 0 var(--d),inset 0 3px 0 rgba(255,255,255,.5),0 1px 0 ${NAVY},0 3px 6px rgba(0,0,0,.2)}
.arc-btn:focus-visible{outline:4px solid #FFE45C;outline-offset:4px}
.arc-btn[disabled]{filter:grayscale(.9) opacity(.45);cursor:default;transform:none}
.arc-btn.go{--c:#3CCB5A;--d:#1E9440;font-size:34px;min-height:74px;min-width:220px;padding:10px 40px 16px;border-radius:26px;animation:arc-pulse 1.4s ease-in-out infinite}
.arc-btn.blue{--c:#3AA0FF;--d:#1C6CC8}
.arc-btn.red{--c:#FF6B5B;--d:#C8392B}
.arc-btn.wide{width:min(100%,280px)}
.arc-btn.round{width:58px;height:58px;min-width:0;padding:0 0 4px;border-radius:50%;font:800 26px/1 var(--arc-n)}
.arc-cd{pointer-events:none}
.arc-cd-n{font:800 clamp(110px,34vw,170px)/1 var(--arc-n);color:#FFE45C;text-shadow:0 6px 0 ${NAVY},4px 4px 0 ${NAVY},-4px 4px 0 ${NAVY},4px -4px 0 ${NAVY},-4px -4px 0 ${NAVY},5px 0 0 ${NAVY},-5px 0 0 ${NAVY},0 -5px 0 ${NAVY},0 14px 0 rgba(0,0,0,.2);
  animation:arc-cd .62s cubic-bezier(.2,1.6,.4,1) both}
.arc-cd-n.go{font:400 clamp(72px,22vw,120px)/1 var(--arc-f);color:#fff;animation:arc-go .7s cubic-bezier(.2,1.6,.4,1) both}
.arc-cd-t{max-width:min(92%,440px);padding:10px 20px 12px;border-radius:20px;background:rgba(255,251,239,.94);border:3.5px solid ${NAVY};box-shadow:0 5px 0 ${NAVY};font-size:20px;line-height:1.35;animation:arc-rise .4s ease-out both}
.arc-cd-c{font:600 15px/1.3 var(--arc-f);color:#fff;text-shadow:0 2px 0 ${NAVY},1px 1px 0 ${NAVY},-1px -1px 0 ${NAVY}}
.arc-end-t{font:400 clamp(46px,14vw,78px)/1.05 var(--arc-f);color:#FFE45C;letter-spacing:.06em;text-shadow:${out.replace(/2px/g, '4px').replace(/3px/g, '5px')},0 10px 0 rgba(0,0,0,.22);animation:arc-drop .8s cubic-bezier(.2,1.5,.4,1) both}
.arc-end-t.lose{color:#9FD4FF}
.arc-end-stars{display:flex;gap:10px;font-size:clamp(54px,15vw,76px);line-height:1}
.arc-end-stars .arc-star{-webkit-text-stroke:3px ${NAVY};opacity:0;animation:arc-star .5s cubic-bezier(.2,1.8,.4,1) forwards}
.arc-end-sc{padding:8px 22px 10px;border-radius:999px;background:#FFFBEF;border:3.5px solid ${NAVY};box-shadow:0 5px 0 ${NAVY};font:800 28px/1 var(--arc-n);display:flex;gap:8px;align-items:center;animation:arc-rise .5s .3s ease-out both}
.arc-end-sc span{font:400 19px/1 var(--arc-f)}
.arc-end-new{font:400 22px/1 var(--arc-f);color:#fff;background:#FF4D7A;border:3px solid ${NAVY};border-radius:14px;padding:6px 14px 8px;box-shadow:0 4px 0 ${NAVY};transform:rotate(-4deg);animation:arc-star .5s 1s both}
.arc-end-skip{font:600 14px/1 var(--arc-f);color:#fff;opacity:.85;text-shadow:0 2px 0 ${NAVY}}
.arc-pause .arc-panel{gap:14px;padding-top:50px;width:min(100%,340px)}
.arc-live{position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0);white-space:nowrap}
@keyframes arc-bob{0%,100%{transform:translateY(0) rotate(-4deg)}50%{transform:translateY(-10px) rotate(4deg)}}
@keyframes arc-pulse{0%,100%{transform:scale(1)}50%{transform:scale(1.05)}}
@keyframes arc-cd{0%{transform:scale(2.4) rotate(-12deg);opacity:0}60%{opacity:1}100%{transform:scale(1) rotate(0);opacity:1}}
@keyframes arc-go{0%{transform:scale(.2) rotate(8deg);opacity:0}100%{transform:scale(1) rotate(-3deg);opacity:1}}
@keyframes arc-rise{0%{transform:translateY(24px);opacity:0}100%{transform:none;opacity:1}}
@keyframes arc-drop{0%{transform:translateY(-120px) scale(.6);opacity:0}100%{transform:none;opacity:1}}
@keyframes arc-star{0%{transform:scale(0) rotate(-40deg);opacity:0}100%{transform:scale(1) rotate(0);opacity:1}}
@media (prefers-reduced-motion: reduce){.arc-icon,.arc-btn.go{animation:none}}
@media (max-width:420px){.arc-panel{padding:42px 14px 16px;gap:10px}.arc-icon{font-size:54px}.arc-blurb{font-size:17px}.arc-btn.go{min-width:200px;font-size:30px;min-height:66px}}
@media (max-height:620px){.arc-icon{display:none}.arc-panel{gap:8px}}
`);
  }

  /* ================= 声音：WebAudio 合成（全页一个 AudioContext，跨局复用） ================= */
  const AU = { ac: null, master: null, sfxBus: null, musBus: null, noise: null, style: null, on: false, next: 0, step: 0, bar: 0, duck: 0, muted: false, lastSfx: Object.create(null) };
  function audio() {
    if (AU.ac) {
      // 'suspended'（未解锁）与 iOS 的 'interrupted'（切后台 / 来电后）都要 resume；'closed' 不管
      const st = AU.ac.state;
      if (st !== 'running' && st !== 'closed' && AU.ac.resume) { try { AU.ac.resume().catch(() => {}); } catch (e) { /* ignore */ } }
      return AU.ac;
    }
    const C = W.AudioContext || W.webkitAudioContext;
    if (!C) return null;
    try {
      const ac = new C();
      AU.ac = ac;
      AU.master = ac.createGain(); AU.master.gain.value = soundOn() ? 0.9 : 0;
      const comp = ac.createDynamicsCompressor();
      comp.threshold.value = -14; comp.knee.value = 12; comp.ratio.value = 4; comp.attack.value = 0.004; comp.release.value = 0.2;
      AU.master.connect(comp); comp.connect(ac.destination);
      AU.sfxBus = ac.createGain(); AU.sfxBus.gain.value = 0.62; AU.sfxBus.connect(AU.master);
      AU.musBus = ac.createGain(); AU.musBus.gain.value = 0; AU.musBus.connect(AU.master);
      const len = Math.floor(ac.sampleRate * 1.2);
      const buf = ac.createBuffer(1, len, ac.sampleRate), d = buf.getChannelData(0);
      for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
      AU.noise = buf;
      AU.muted = !soundOn();
      if (ac.state === 'suspended' && ac.resume) ac.resume().catch(() => {});
      return ac;
    } catch (e) { return null; }
  }
  const mtof = (m) => 440 * Math.pow(2, (m - 69) / 12);
  /* 一个振荡器音：f0→f1 滑音，attack/decay 包络 */
  function tone(t0, f0, f1, dur, vol, type, dest, o) {
    const ac = AU.ac; if (!ac) return;
    o = o || {};
    try {
      const osc = ac.createOscillator(), gn = ac.createGain();
      osc.type = type || 'sine';
      osc.frequency.setValueAtTime(Math.max(20, f0), t0);
      if (f1 && f1 !== f0) {
        if (o.lin) osc.frequency.linearRampToValueAtTime(Math.max(20, f1), t0 + dur * (o.glide || 1));
        else osc.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t0 + dur * (o.glide || 1));
      }
      if (o.detune) osc.detune.setValueAtTime(o.detune, t0);
      const a = o.attack == null ? 0.006 : o.attack;
      gn.gain.setValueAtTime(0.0001, t0);
      gn.gain.exponentialRampToValueAtTime(Math.max(0.0002, vol), t0 + a);
      if (o.hold) gn.gain.setValueAtTime(Math.max(0.0002, vol), t0 + a + o.hold);
      gn.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
      let node = osc;
      if (o.lp) { const f = ac.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = o.lp; f.Q.value = o.q || 0.7; osc.connect(f); node = f; }
      node.connect(gn); gn.connect(dest || AU.sfxBus);
      osc.start(t0); osc.stop(t0 + dur + 0.05);
    } catch (e) { /* ignore */ }
  }
  /* 噪声：带通/低通/高通滤波，频率 f0→f1 扫动 */
  function noise(t0, dur, vol, ftype, f0, f1, q, dest, attack) {
    const ac = AU.ac; if (!ac || !AU.noise) return;
    try {
      const src = ac.createBufferSource(); src.buffer = AU.noise;
      const f = ac.createBiquadFilter(); f.type = ftype || 'lowpass'; f.Q.value = q || 0.8;
      f.frequency.setValueAtTime(Math.max(30, f0 || 1000), t0);
      if (f1 && f1 !== f0) f.frequency.exponentialRampToValueAtTime(Math.max(30, f1), t0 + dur);
      const gn = ac.createGain();
      const a = attack || 0.004;
      gn.gain.setValueAtTime(0.0001, t0);
      gn.gain.exponentialRampToValueAtTime(Math.max(0.0002, vol), t0 + a);
      gn.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
      src.connect(f); f.connect(gn); gn.connect(dest || AU.sfxBus);
      src.start(t0, Math.random() * 0.5); src.stop(t0 + dur + 0.05);
    } catch (e) { /* ignore */ }
  }
  const SFX = {
    pop(t) { tone(t, 1100, 240, 0.09, 0.5, 'sine'); tone(t, 2600, 1400, 0.03, 0.12, 'triangle'); noise(t, 0.05, 0.25, 'highpass', 2500, 5000, 0.7); },
    coin(t) { tone(t, 988, 988, 0.08, 0.2, 'square', null, { lp: 5000 }); tone(t + 0.07, 1319, 1319, 0.34, 0.2, 'square', null, { lp: 5000, hold: 0.05 }); },
    jump(t) { tone(t, 260, 820, 0.2, 0.3, 'square', null, { lp: 2400, glide: 0.8 }); },
    splash(t) { noise(t, 0.5, 0.55, 'bandpass', 2600, 380, 0.9); noise(t + 0.03, 0.3, 0.25, 'highpass', 3000, 6000, 0.6); tone(t, 180, 60, 0.18, 0.35, 'sine'); },
    hit(t) { tone(t, 190, 55, 0.18, 0.7, 'sine'); noise(t, 0.09, 0.35, 'lowpass', 2200, 300, 1); },
    whoosh(t) { noise(t, 0.36, 0.5, 'bandpass', 380, 2600, 2.2, null, 0.12); },
    power(t) {
      tone(t, 220, 880, 0.42, 0.18, 'sawtooth', null, { lp: 2600, glide: 0.9 });
      [523, 659, 784, 1047].forEach((f, i) => tone(t + 0.08 + i * 0.06, f, f, 0.22, 0.12, 'triangle'));
    },
    tick(t) { tone(t, 1800, 1500, 0.035, 0.22, 'square', null, { lp: 6000 }); },
    bubble(t) { tone(t, 420, 1250, 0.08, 0.32, 'sine'); tone(t + 0.07, 620, 1600, 0.06, 0.18, 'sine'); },
    crash(t) { noise(t, 0.7, 0.8, 'lowpass', 3200, 200, 0.7); noise(t, 0.25, 0.4, 'highpass', 1800, 900, 0.5); tone(t, 110, 40, 0.4, 0.6, 'sine'); },
    swing(t) { noise(t, 0.2, 0.55, 'bandpass', 600, 3400, 3, null, 0.05); },
    chomp(t) { tone(t, 230, 120, 0.07, 0.4, 'square', null, { lp: 1400 }); tone(t + 0.1, 210, 100, 0.08, 0.35, 'square', null, { lp: 1200 }); },
    flip(t) { tone(t, 520, 1100, 0.09, 0.22, 'triangle'); noise(t, 0.04, 0.16, 'highpass', 3000, 3000, 0.7); },
    match(t) { tone(t, 1047, 1047, 0.18, 0.18, 'triangle'); tone(t + 0.09, 1568, 1568, 0.32, 0.18, 'triangle'); tone(t + 0.09, 2093, 2093, 0.3, 0.06, 'sine'); },
    beat(t) { tone(t, 150, 42, 0.26, 0.9, 'sine', null, { glide: 0.6 }); noise(t, 0.03, 0.2, 'highpass', 4000, 4000, 0.7); },
    good(t) { [1047, 1319, 1568].forEach((f, i) => tone(t + i * 0.055, f, f, 0.2, 0.15, 'triangle')); },
    bad(t) { tone(t, 230, 170, 0.28, 0.16, 'sawtooth', null, { lp: 900 }); tone(t, 236, 175, 0.28, 0.16, 'square', null, { lp: 700 }); },
    win(t) {
      [523, 659, 784, 1047, 1319, 1568].forEach((f, i) => tone(t + i * 0.085, f, f, 0.22, 0.15, 'square', null, { lp: 4200 }));
      [1047, 1319, 1568, 2093].forEach((f) => tone(t + 0.55, f, f, 0.9, 0.09, 'triangle', null, { hold: 0.2 }));
    },
    lose(t) {
      [392, 370, 349].forEach((f, i) => tone(t + i * 0.26, f, f * 0.98, 0.26, 0.17, 'sawtooth', null, { lp: 1400 }));
      tone(t + 0.78, 330, 262, 0.7, 0.17, 'sawtooth', null, { lp: 1200, glide: 1 });
    },
    go(t) { [784, 988, 1175].forEach((f) => tone(t, f, f, 0.45, 0.12, 'square', null, { lp: 3600, hold: 0.1 })); noise(t, 0.3, 0.2, 'highpass', 5000, 8000, 0.5); },
    star(t) { tone(t, 1568, 2093, 0.16, 0.2, 'triangle'); tone(t + 0.05, 2637, 2637, 0.2, 0.08, 'sine'); },
    heart(t) { tone(t, 520, 260, 0.22, 0.25, 'triangle'); noise(t, 0.15, 0.2, 'bandpass', 1500, 500, 1); },
    combo(t) { tone(t, 880, 1760, 0.12, 0.14, 'square', null, { lp: 4000 }); tone(t + 0.08, 1318, 2637, 0.14, 0.1, 'square', null, { lp: 4000 }); }
  };
  function playSfx(name) {
    if (!soundOn()) return;
    const f = SFX[name];
    if (!f) return;
    const ac = audio(); if (!ac || ac.state !== 'running') return;
    const t = ac.currentTime;
    if (AU.lastSfx[name] && t - AU.lastSfx[name] < 0.03) return;   // 同一帧重复触发只响一次
    AU.lastSfx[name] = t;
    f(t + 0.005);
  }

  /* ---- 背景音乐：五声音阶循环（宫商角徵羽 = C D E G A），轻声，跟随静音 ---- */
  const PENTA = [0, 2, 4, 7, 9];
  const deg = (d, base) => base + Math.floor(d / 5) * 12 + PENTA[((d % 5) + 5) % 5];
  const SONGS = {
    bright: {
      bpm: 128, base: 72, bass: [48, 45, 41, 43],
      mel: [[2, -1, 4, 5, 4, -1, 2, 0], [1, -1, 2, 4, 2, -1, -1, -1], [0, -1, 2, 3, 4, 5, 4, 2], [1, -1, 0, 1, 2, -1, -1, -1],
        [5, -1, 4, 5, 7, -1, 5, 4], [3, -1, 2, 3, 4, -1, -1, -1], [2, 3, 4, 2, 1, -1, 0, 1], [0, -1, -1, -1, 2, -1, 0, -1]],
      drums: 'bright'
    },
    calm: {
      bpm: 84, base: 72, bass: [48, 45, 43, 45],
      mel: [[4, -1, -1, 2, 3, -1, -1, -1], [2, -1, 1, -1, 0, -1, -1, -1], [1, -1, -1, 2, 4, -1, -1, 3], [2, -1, -1, -1, -1, -1, -1, -1],
        [5, -1, -1, 4, 3, -1, 4, -1], [2, -1, -1, -1, 1, -1, -1, -1], [0, -1, 1, -1, 2, -1, 4, -1], [2, -1, -1, -1, -1, -1, -1, -1]],
      drums: null
    },
    drum: {
      bpm: 112, base: 74, bass: [50, 50, 45, 48],
      mel: [[0, -1, -1, 2, -1, -1, 3, -1], [4, -1, 3, -1, 2, -1, -1, -1], [2, -1, -1, 3, -1, -1, 5, -1], [4, -1, -1, -1, -1, -1, -1, -1],
        [5, -1, -1, 4, -1, -1, 3, -1], [2, -1, 3, -1, 4, -1, -1, -1], [3, -1, 2, -1, 1, -1, 0, -1], [0, -1, -1, -1, -1, -1, -1, -1]],
      drums: 'taiko'
    }
  };
  function musicStart(style) {
    const s = SONGS[style] ? style : 'bright';
    const ac = audio(); if (!ac) return;
    AU.style = s; AU.on = true;
    AU.next = ac.currentTime + 0.08; AU.step = 0; AU.bar = 0;
    try {
      const gn = AU.musBus.gain; gn.cancelScheduledValues(ac.currentTime);
      gn.setValueAtTime(gn.value, ac.currentTime); gn.linearRampToValueAtTime(AU.duck ? 0.07 : 0.3, ac.currentTime + 0.4);
    } catch (e) { /* ignore */ }
  }
  function musicStop() {
    AU.on = false;
    const ac = AU.ac; if (!ac) return;
    try {
      const gn = AU.musBus.gain; gn.cancelScheduledValues(ac.currentTime);
      gn.setValueAtTime(gn.value, ac.currentTime); gn.linearRampToValueAtTime(0, ac.currentTime + 0.25);
    } catch (e) { /* ignore */ }
  }
  function musicDuck(on) {
    AU.duck = on ? 1 : 0;
    const ac = AU.ac; if (!ac || !AU.on) return;
    try {
      const gn = AU.musBus.gain; gn.cancelScheduledValues(ac.currentTime);
      gn.setValueAtTime(gn.value, ac.currentTime); gn.linearRampToValueAtTime(on ? 0.07 : 0.3, ac.currentTime + (on ? 0.15 : 0.6));
    } catch (e) { /* ignore */ }
  }
  /* 每帧调用：跟随静音开关；提前 0.2 秒排音符 */
  function audioTick() {
    const ac = AU.ac; if (!ac) return;
    const mute = !soundOn();
    if (mute !== AU.muted) {
      AU.muted = mute;
      try { AU.master.gain.cancelScheduledValues(ac.currentTime); AU.master.gain.setTargetAtTime(mute ? 0 : 0.9, ac.currentTime, 0.05); } catch (e) { /* ignore */ }
    }
    if (!AU.on || ac.state !== 'running') return;
    const song = SONGS[AU.style];
    const spb = 60 / song.bpm / 2;        // 八分音符
    if (AU.next < ac.currentTime - 0.3) AU.next = ac.currentTime + 0.05;   // 卡顿/切后台回来：别补一堆音
    while (AU.next < ac.currentTime + 0.2) {
      schedStep(song, AU.step, AU.bar, AU.next, spb);
      AU.step++;
      if (AU.step >= 8) { AU.step = 0; AU.bar = (AU.bar + 1) % song.mel.length; }
      AU.next += spb;
    }
  }
  function schedStep(song, st, bar, t, spb) {
    const mb = AU.musBus;
    const d = song.mel[bar][st];
    const style = AU.style;
    if (d >= 0) {
      const f = mtof(deg(d, song.base));
      if (style === 'calm') { tone(t, f, f, spb * 3.2, 0.13, 'sine', mb, { attack: 0.03 }); tone(t, f * 2, f * 2, spb * 1.5, 0.025, 'sine', mb); }
      else if (style === 'drum') { tone(t, f, f * 1.003, spb * 2.4, 0.11, 'triangle', mb, { attack: 0.02, lp: 2400 }); tone(t, f * 2, f * 2, spb * 0.6, 0.03, 'sine', mb); }
      else { tone(t, f, f, spb * 1.4, 0.075, 'square', mb, { lp: 2200 }); tone(t, f * 2, f * 2, spb * 0.5, 0.025, 'triangle', mb); }
    }
    const root = song.bass[Math.floor(bar / 2) % song.bass.length];
    if (style === 'calm') {
      if (st === 0) { tone(t, mtof(root), mtof(root), spb * 7.5, 0.1, 'triangle', mb, { attack: 0.2 }); tone(t, mtof(root + 7), mtof(root + 7), spb * 7.5, 0.05, 'sine', mb, { attack: 0.3 }); }
      if (st === 4) tone(t, mtof(root + 12), mtof(root + 12), spb * 3, 0.04, 'sine', mb, { attack: 0.05 });
    } else if (style === 'drum') {
      if (st === 0 || st === 3 || st === 4 || st === 6) tone(t, st === 0 ? 120 : 150, 48, 0.3, st === 0 ? 0.55 : 0.35, 'sine', mb, { glide: 0.7 });
      if (st === 2 || st === 6) tone(t, 1250, 1100, 0.05, 0.1, 'square', mb, { lp: 3000 });
      if (st === 0 || st === 4) tone(t, mtof(root - 12), mtof(root - 12), spb * 3, 0.12, 'triangle', mb);
    } else {
      if (st % 2 === 0) tone(t, mtof(root - 12), mtof(root - 12), spb * 0.9, 0.16, 'triangle', mb);
      if (st === 0 || st === 4) tone(t, 140, 45, 0.18, 0.4, 'sine', mb);
      if (st === 2 || st === 6) noise(t, 0.09, 0.08, 'bandpass', 1800, 1200, 0.8, mb);
      if (st % 2 === 1) noise(t, 0.035, 0.05, 'highpass', 7000, 7000, 0.7, mb);
    }
  }

  /* ================= 绘图：字体、文字 / emoji 离屏缓存、形状 ================= */
  const FONTS = {
    kai: '"Kaiti SC","STKaiti","KaiTi","楷体","Noto Serif SC",serif',
    round: '"Baloo 2","ZCOOL KuaiLe","Arial Rounded MT Bold","PingFang SC","Microsoft YaHei",system-ui,sans-serif',
    num: '"Baloo 2","Arial Rounded MT Bold","Helvetica Neue",Arial,system-ui,sans-serif',
    sans: '"PingFang SC","Hiragino Sans GB","Microsoft YaHei","Noto Sans SC",system-ui,sans-serif',
    py: '"Helvetica Neue","Arial","PingFang SC","Microsoft YaHei",system-ui,sans-serif'
  };
  const DEFW = { kai: 400, round: 700, num: 800, sans: 700, py: 700 };
  const EMOJI_FONT = '"Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji","Segoe UI Symbol",sans-serif';
  let DPR = 1;
  const TXT = new Map(), EMO = new Map(), MEAS = new Map(), WRAP = new Map(), SPR = new Map();
  const scratch = D.createElement('canvas').getContext('2d');
  const fontStr = (size, font, weight) => (weight || DEFW[font] || 700) + ' ' + size + 'px ' + (FONTS[font] || FONTS.round);
  function mkCanvas(w, h) {
    const cv = D.createElement('canvas');
    cv.width = Math.max(1, Math.ceil(w * DPR)); cv.height = Math.max(1, Math.ceil(h * DPR));
    const x = cv.getContext('2d'); x.setTransform(DPR, 0, 0, DPR, 0, 0);
    return { cv, x };
  }
  function trim(map, max) {
    if (map.size <= max) return;
    let n = map.size - Math.floor(max * 0.7);
    for (const k of map.keys()) { if (n-- <= 0) break; map.delete(k); }
  }
  /* 精灵缓存（文字 / emoji）：按张数 + 像素总量双上限淘汰最早的；淘汰时把画布宽高置 0，
     iPad Safari 的画布内存有总上限且回收很慢，不这样做玩久了会整块画布变黑 */
  const PX = { txt: 0, emo: 0 };
  const pxOf = (sp) => sp.cv.width * sp.cv.height;
  function release(sp) { try { sp.cv.width = 0; sp.cv.height = 0; } catch (e) { /* ignore */ } }
  function spriteDel(map, key, which) {
    const sp = map.get(key);
    if (!sp) return;
    map.delete(key); PX[which] -= pxOf(sp); release(sp);
  }
  function spriteClear(map, which) { map.forEach(release); map.clear(); PX[which] = 0; }
  function spriteAdd(map, key, sp, which, maxN, maxPx) {
    map.set(key, sp); PX[which] += pxOf(sp);
    if (map.size <= maxN && PX[which] <= maxPx) return;
    for (const k of map.keys()) {
      if (k === key || (map.size <= maxN * 0.7 && PX[which] <= maxPx * 0.7)) break;
      spriteDel(map, k, which);
    }
  }
  function setDpr(d) {
    if (d === DPR) return;
    DPR = d; spriteClear(TXT, 'txt'); spriteClear(EMO, 'emo'); SPR.clear();
  }
  function clearTextCaches() { spriteClear(TXT, 'txt'); MEAS.clear(); WRAP.clear(); }
  function measure(str, size, font, weight) {
    str = String(str == null ? '' : str);
    const f = fontStr(size || 24, font || 'round', weight);
    const key = f + '\u0001' + str;
    let v = MEAS.get(key);
    if (v === undefined) { scratch.font = f; v = scratch.measureText(str).width; MEAS.set(key, v); trim(MEAS, 3000); }
    return v;
  }
  function textSprite(str, size, color, font, weight, stroke, sw, shadow) {
    const key = str + '\u0001' + size + '|' + color + '|' + font + '|' + weight + '|' + (stroke || '') + '|' + sw + '|' + (shadow ? 1 : 0);
    let sp = TXT.get(key);
    if (sp) return sp;
    const f = fontStr(size, font, weight);
    scratch.font = f;
    const tw = Math.ceil(scratch.measureText(str).width);
    const sh = shadow ? Math.max(2, Math.round(size * 0.09)) : 0;
    const pad = Math.ceil((stroke ? sw : 0) + 3);
    const lh = Math.ceil(size * 1.36);
    const cw = tw + pad * 2, ch = lh + pad * 2 + sh;
    const { cv, x } = mkCanvas(cw, ch);
    x.font = f; x.textAlign = 'center'; x.textBaseline = 'middle'; x.lineJoin = 'round'; x.miterLimit = 2;
    const cx = cw / 2, cy = pad + lh / 2 + size * 0.03;
    if (sh) {
      x.fillStyle = 'rgba(10,20,50,.35)'; x.strokeStyle = 'rgba(10,20,50,.35)';
      if (stroke && sw > 0) { x.lineWidth = sw * 2; x.strokeText(str, cx, cy + sh); }
      x.fillText(str, cx, cy + sh);
    }
    if (stroke && sw > 0) { x.lineWidth = sw * 2; x.strokeStyle = stroke; x.strokeText(str, cx, cy); }
    x.fillStyle = color; x.fillText(str, cx, cy);
    sp = { cv, w: cw, h: ch, tw, pad, lh, sh };
    spriteAdd(TXT, key, sp, 'txt', 700, 8e6);   // 约 32MB
    try {   // 网络字体还没到：先用回退字体画，字体到了把这张缓存作废重画
      if (font !== 'kai' && font !== 'sans' && D.fonts && D.fonts.check && !D.fonts.check(f, str)) D.fonts.load(f, str).then(() => { spriteDel(TXT, key, 'txt'); }, () => {});
    } catch (e) { /* ignore */ }
    return sp;
  }
  /* 文字：返回实际绘制宽度 */
  function drawText(c, str, x, y, o) {
    str = String(str == null ? '' : str);
    if (!str) return 0;
    o = o || {};
    const size = Math.max(4, Math.round(o.size || 24));
    const font = FONTS[o.font] ? o.font : 'round';
    const weight = o.weight || DEFW[font];
    const stroke = o.stroke || '';
    const sw = stroke ? (o.strokeW != null ? o.strokeW : Math.max(2, size * 0.12)) : 0;
    const sp = textSprite(str, size, o.color || '#fff', font, weight, stroke, sw, !!o.shadow);
    let s = 1;
    if (o.maxW && sp.tw > o.maxW) s = o.maxW / sp.tw;
    const dw = sp.w * s, dh = sp.h * s;
    const al = o.align || 'center', bl = o.baseline || 'middle';
    let dx = al === 'left' ? x - sp.pad * s : al === 'right' ? x - dw + sp.pad * s : x - dw / 2;
    let cy = bl === 'top' ? y + size * s * 0.5 : bl === 'bottom' ? y - size * s * 0.5 : bl === 'alphabetic' ? y - size * s * 0.36 : y;
    const dy = cy - (sp.pad + sp.lh / 2) * s;
    if (o.alpha != null && o.alpha < 1) {
      const a0 = c.globalAlpha; c.globalAlpha = a0 * Math.max(0, o.alpha);
      c.drawImage(sp.cv, dx, dy, dw, dh); c.globalAlpha = a0;
    } else c.drawImage(sp.cv, dx, dy, dw, dh);
    return sp.tw * s;
  }
  /* 滚动中的分数每帧都是新字符串：逐位用单个数字的缓存精灵拼，避免每帧新建一张文字画布（右对齐，返回宽度） */
  function digitsWidth(str, size) {
    let w = 0;
    for (let i = 0; i < str.length; i++) w += measure(str[i], size, 'num');
    return w;
  }
  function drawDigits(c, str, xRight, y, size, color, k) {
    size = Math.max(4, Math.round(size)); k = k || 1;   // 精灵按 size 缓存，k = 额外缩放（分数跳动），不另建精灵
    let x = xRight;
    for (let i = str.length - 1; i >= 0; i--) {
      const ch = str[i], adv = measure(ch, size, 'num') * k;
      const sp = textSprite(ch, size, color, 'num', DEFW.num, '', 0, false);
      c.drawImage(sp.cv, x - adv / 2 - sp.w * k / 2, y - (sp.pad + sp.lh / 2) * k, sp.w * k, sp.h * k);
      x -= adv;
    }
    return xRight - x;
  }
  function emojiSprite(ch, b) {
    const key = ch + '|' + b;
    let sp = EMO.get(key);
    if (sp) return sp;
    const sz = Math.ceil(b * 1.3);
    const { cv, x } = mkCanvas(sz, sz);
    x.font = b + 'px ' + EMOJI_FONT; x.textAlign = 'center'; x.textBaseline = 'middle';
    x.fillText(ch, sz / 2, sz / 2 + b * 0.06);
    sp = { cv, w: sz };
    spriteAdd(EMO, key, sp, 'emo', 400, 8e6);
    return sp;
  }
  function drawEmoji(c, ch, x, y, size, o) {
    ch = String(ch == null ? '' : ch);
    if (!ch || !(size > 0)) return;
    const b = size <= 22 ? 24 : size <= 44 ? 48 : size <= 90 ? 96 : size <= 170 ? 176 : 256;
    const sp = emojiSprite(ch, b);
    const dw = sp.w * size / b;
    if (o && (o.rot || o.flip || (o.alpha != null && o.alpha < 1))) {
      c.save();
      c.translate(x, y);
      if (o.rot) c.rotate(o.rot);
      if (o.flip) c.scale(-1, 1);
      if (o.alpha != null) c.globalAlpha *= Math.max(0, o.alpha);
      c.drawImage(sp.cv, -dw / 2, -dw / 2, dw, dw);
      c.restore();
    } else c.drawImage(sp.cv, x - dw / 2, y - dw / 2, dw, dw);
  }
  function rrPath(c, x, y, w, h, r) {
    r = Math.max(0, Math.min(r || 0, w / 2, h / 2));
    c.beginPath();
    c.moveTo(x + r, y);
    c.arcTo(x + w, y, x + w, y + h, r);
    c.arcTo(x + w, y + h, x, y + h, r);
    c.arcTo(x, y + h, x, y, r);
    c.arcTo(x, y, x + w, y, r);
    c.closePath();
  }
  function rrect(c, x, y, w, h, r, fill, stroke, lw) {
    rrPath(c, x, y, w, h, r);
    if (fill) { c.fillStyle = fill; c.fill(); }
    if (stroke) { c.lineWidth = lw || 2; c.strokeStyle = stroke; c.stroke(); }
  }
  const NO_START = '，。！？、；：”’）》」』…—,.!?;:)';
  function wrapText(str, maxW, size, font, weight) {
    str = String(str == null ? '' : str);
    const key = str + '\u0001' + maxW + '|' + size + '|' + font + '|' + (weight || '');
    let out = WRAP.get(key);
    if (out) return out;
    out = [];
    const paras = str.split('\n');
    for (const para of paras) {
      const toks = para.match(/[A-Za-z0-9\u00C0-\u024F\u0300-\u036f'’-]+|\s+|./gu) || [];
      let line = '';
      for (const tk of toks) {
        const cand = line + tk;
        if (line && measure(cand.trimEnd(), size, font, weight) > maxW) {
          if (NO_START.indexOf(tk[0]) >= 0) { line = cand; continue; }   // 标点不放行首
          out.push(line.trimEnd());
          line = /^\s+$/.test(tk) ? '' : tk;
        } else line = cand;
      }
      out.push(line.trimEnd());
    }
    WRAP.set(key, out); trim(WRAP, 400);
    return out;
  }
  /* ---- 预渲染精灵：星星（按颜色）、金币、云 ---- */
  function starPath(x, cx, cy, R, r) {
    x.beginPath();
    for (let i = 0; i < 10; i++) {
      const a = -Math.PI / 2 + i * Math.PI / 5, rr = i % 2 ? r : R;
      if (i) x.lineTo(cx + Math.cos(a) * rr, cy + Math.sin(a) * rr); else x.moveTo(cx + Math.cos(a) * rr, cy + Math.sin(a) * rr);
    }
    x.closePath();
  }
  function starSprite(color) {
    const key = 'star|' + color;
    let sp = SPR.get(key);
    if (sp) return sp;
    const { cv, x } = mkCanvas(48, 48);
    starPath(x, 24, 25, 20, 9); x.lineJoin = 'round';
    x.fillStyle = color; x.fill(); x.lineWidth = 3; x.strokeStyle = NAVY; x.stroke();
    x.fillStyle = 'rgba(255,255,255,.55)'; x.beginPath(); x.ellipse(19, 17, 4, 2.4, -0.6, 0, TAU); x.fill();
    sp = { cv, w: 48 }; SPR.set(key, sp);
    return sp;
  }
  function coinSprite() {
    let sp = SPR.get('coin');
    if (sp) return sp;
    const { cv, x } = mkCanvas(40, 40);
    const gr = x.createLinearGradient(0, 4, 0, 36); gr.addColorStop(0, '#FFE872'); gr.addColorStop(1, '#F4A21C');
    x.beginPath(); x.arc(20, 20, 16, 0, TAU); x.fillStyle = gr; x.fill(); x.lineWidth = 2.5; x.strokeStyle = '#9A5B0E'; x.stroke();
    x.beginPath(); x.arc(20, 20, 10.5, 0, TAU); x.lineWidth = 2; x.strokeStyle = 'rgba(154,91,14,.55)'; x.stroke();
    x.fillStyle = 'rgba(255,255,255,.7)'; x.beginPath(); x.ellipse(14, 13, 4, 2.2, -0.7, 0, TAU); x.fill();
    sp = { cv, w: 40 }; SPR.set('coin', sp);
    return sp;
  }
  function cloudSprite() {
    let sp = SPR.get('cloud');
    if (sp) return sp;
    const { cv, x } = mkCanvas(240, 130);
    const gr = x.createLinearGradient(0, 20, 0, 120); gr.addColorStop(0, '#FFFFFF'); gr.addColorStop(0.62, '#FFFFFF'); gr.addColorStop(1, '#D3EBFF');
    x.fillStyle = gr;
    const blobs = [[64, 78, 36], [112, 56, 48], [164, 70, 40], [200, 90, 28], [36, 96, 24], [140, 96, 30], [90, 96, 30]];
    x.beginPath();
    for (const b of blobs) { x.moveTo(b[0] + b[2], b[1]); x.arc(b[0], b[1], b[2], 0, TAU); }
    x.fill();
    rrect(x, 30, 84, 190, 38, 19, gr);
    x.fillStyle = 'rgba(255,255,255,.9)';
    x.beginPath(); x.arc(100, 44, 16, 0, TAU); x.fill();
    sp = { cv, w: 240, h: 130 }; SPR.set('cloud', sp);
    return sp;
  }
  function drawCloud(c, x, y, s, alpha) {
    const sp = cloudSprite();
    const w = 120 * (s || 1), h = w * sp.h / sp.w;
    if (alpha != null && alpha < 1) { const a0 = c.globalAlpha; c.globalAlpha = a0 * alpha; c.drawImage(sp.cv, x - w / 2, y - h / 2, w, h); c.globalAlpha = a0; }
    else c.drawImage(sp.cv, x - w / 2, y - h / 2, w, h);
  }
  /* 心形路径（中心 x,y，宽约 s） */
  function heartPath(c, x, y, s) {
    const k = s / 2;
    c.beginPath();
    c.moveTo(x, y + k * 0.95);
    c.bezierCurveTo(x - k * 1.25, y + k * 0.1, x - k * 1.05, y - k * 1.05, x, y - k * 0.42);
    c.bezierCurveTo(x + k * 1.05, y - k * 1.05, x + k * 1.25, y + k * 0.1, x, y + k * 0.95);
    c.closePath();
  }

  /* ================= 粒子 / 飘字 / 冲击波圈（对象池，每帧零分配） ================= */
  const CONF_COLORS = ['#FF5A5F', '#FFC928', '#3CCB5A', '#3AA0FF', '#B25CFF', '#FF8A3D', '#FFFFFF'];
  function makeFx() {
    const NP = 300, NF = 40, NR = 16;
    const P = [], F = [], R = [];
    for (let i = 0; i < NP; i++) P.push({ on: false, k: 0, x: 0, y: 0, vx: 0, vy: 0, gy: 0, dr: 1, age: 0, life: 1, sz: 4, col: '#fff', rot: 0, vr: 0, sp: null, ph: 0 });
    for (let i = 0; i < NF; i++) F.push({ on: false, text: '', x: 0, y: 0, age: 0, life: 1, col: '#fff', size: 26 });
    for (let i = 0; i < NR; i++) R.push({ on: false, x: 0, y: 0, age: 0, life: 0.5, col: '#fff', r0: 10, r1: 90 });
    let pi = 0, fi = 0, ri = 0;
    const KIND = { star: 1, coin: 2, dot: 3, ink: 4, water: 5, confetti: 6, spark: 7 };
    const fx = { count: 0, shake: 0, flashA: 0, flashCol: '#fff', ox: 0, oy: 0 };
    function slot() { const p = P[pi]; pi = (pi + 1) % NP; return p; }
    fx.burst = function (x, y, o) {
      o = o || {};
      const k = KIND[o.kind] || 1;
      let n = o.n != null ? o.n : (k === 2 ? 10 : k === 6 ? 30 : k === 7 ? 12 : 16);
      n = clamp(Math.round(n), 0, 120);
      const col = o.color;
      for (let i = 0; i < n; i++) {
        const p = slot();
        const a = Math.random() * TAU;
        p.on = true; p.k = k; p.x = x; p.y = y; p.age = 0; p.rot = Math.random() * TAU; p.ph = Math.random() * TAU; p.sp = null;
        if (k === 1) { const v = rand(160, 440); p.vx = Math.cos(a) * v; p.vy = Math.sin(a) * v - 120; p.gy = 620; p.dr = 2.2; p.life = rand(0.6, 1.05); p.sz = rand(12, 24); p.vr = rand(-8, 8); p.col = col || '#FFD23F'; p.sp = starSprite(p.col); }
        else if (k === 2) { p.vx = rand(-220, 220); p.vy = rand(-620, -320); p.gy = 1250; p.dr = 0.6; p.life = rand(0.8, 1.2); p.sz = rand(16, 24); p.vr = rand(8, 16); p.col = '#FFC928'; p.sp = coinSprite(); }
        else if (k === 3) { const v = rand(90, 330); p.vx = Math.cos(a) * v; p.vy = Math.sin(a) * v; p.gy = 380; p.dr = 2.5; p.life = rand(0.45, 0.8); p.sz = rand(3, 7); p.vr = 0; p.col = col || '#FFFFFF'; }
        else if (k === 4) { const v = rand(60, 300); p.vx = Math.cos(a) * v; p.vy = Math.sin(a) * v - 40; p.gy = 260; p.dr = 4; p.life = rand(0.7, 1.1); p.sz = rand(6, 17); p.vr = 0; p.col = col || '#2A2140'; }
        else if (k === 5) { p.vx = rand(-200, 200); p.vy = rand(-560, -240); p.gy = 1200; p.dr = 0.8; p.life = rand(0.6, 0.95); p.sz = rand(3, 8); p.vr = 0; p.col = col || '#8FE3FF'; }
        else if (k === 6) { p.vx = rand(-260, 260); p.vy = rand(-520, -120); p.gy = 380; p.dr = 1.6; p.life = rand(1.6, 2.6); p.sz = rand(6, 11); p.vr = rand(-10, 10); p.col = col || CONF_COLORS[i % CONF_COLORS.length]; }
        else { const v = rand(300, 700); p.vx = Math.cos(a) * v; p.vy = Math.sin(a) * v; p.gy = 0; p.dr = 5; p.life = rand(0.18, 0.35); p.sz = rand(2, 4); p.vr = 0; p.col = col || '#FFF6B0'; }
      }
    };
    fx.confetti = function (w) {
      for (let i = 0; i < 110; i++) {
        const p = slot();
        p.on = true; p.k = 6; p.age = 0; p.x = Math.random() * w; p.y = rand(-120, -10);
        p.vx = rand(-60, 60); p.vy = rand(60, 260); p.gy = 160; p.dr = 0.8; p.life = rand(2.6, 4); p.sz = rand(7, 12);
        p.rot = Math.random() * TAU; p.vr = rand(-9, 9); p.ph = Math.random() * TAU; p.col = CONF_COLORS[i % CONF_COLORS.length]; p.sp = null;
      }
    };
    fx.float = function (text, x, y, o) {
      o = o || {};
      const f = F[fi]; fi = (fi + 1) % NF;
      f.on = true; f.text = String(text); f.x = x; f.y = y; f.age = 0; f.life = o.life || 1.05;
      f.col = o.color || '#FFFFFF'; f.size = Math.round(o.size || 30);
    };
    fx.ring = function (x, y, col, r1) {
      const r = R[ri]; ri = (ri + 1) % NR;
      r.on = true; r.x = x; r.y = y; r.age = 0; r.life = 0.55; r.col = col || '#FFFFFF'; r.r0 = 8; r.r1 = r1 || 95;
    };
    fx.clear = function () {
      for (const p of P) p.on = false;
      for (const f of F) f.on = false;
      for (const r of R) r.on = false;
      fx.shake = 0; fx.flashA = 0; fx.count = 0;
    };
    fx.update = function (dt) {
      let n = 0;
      for (let i = 0; i < NP; i++) {
        const p = P[i];
        if (!p.on) continue;
        p.age += dt;
        if (p.age >= p.life) { p.on = false; continue; }
        n++;
        const d = Math.exp(-p.dr * dt);
        p.vx *= d; p.vy = p.vy * d + p.gy * dt;
        if (p.k === 6) p.vx += Math.sin(p.age * 5 + p.ph) * 240 * dt;
        p.x += p.vx * dt; p.y += p.vy * dt; p.rot += p.vr * dt;
      }
      fx.count = n;
      for (let i = 0; i < NF; i++) { const f = F[i]; if (!f.on) continue; f.age += dt; f.y -= 48 * dt; if (f.age >= f.life) f.on = false; }
      for (let i = 0; i < NR; i++) { const r = R[i]; if (!r.on) continue; r.age += dt; if (r.age >= r.life) r.on = false; }
      if (fx.shake > 0) { fx.shake = Math.max(0, fx.shake - dt * (18 + fx.shake * 7)); fx.ox = (Math.random() * 2 - 1) * fx.shake; fx.oy = (Math.random() * 2 - 1) * fx.shake; }
      else { fx.ox = 0; fx.oy = 0; }
      if (fx.flashA > 0) fx.flashA = Math.max(0, fx.flashA - dt * 2.2);
    };
    /* 画粒子与圈（在世界坐标，含抖屏偏移）；dpr 为画布缩放 */
    fx.drawWorld = function (c, dpr, ox, oy) {
      for (let i = 0; i < NR; i++) {
        const r = R[i]; if (!r.on) continue;
        const t = r.age / r.life, e = 1 - (1 - t) * (1 - t);
        c.globalAlpha = 1 - t;
        c.lineWidth = Math.max(1, 10 * (1 - t));
        c.strokeStyle = r.col;
        c.beginPath(); c.arc(r.x, r.y, r.r0 + (r.r1 - r.r0) * e, 0, TAU); c.stroke();
      }
      c.globalAlpha = 1;
      for (let i = 0; i < NP; i++) {
        const p = P[i]; if (!p.on) continue;
        const t = p.age / p.life;
        const a = t > 0.7 ? (1 - t) / 0.3 : 1;
        c.globalAlpha = a;
        const k = p.k;
        if (k === 1 || k === 2) {
          const s = p.sz * (k === 1 ? (t < 0.15 ? 0.5 + t / 0.3 : 1 - t * 0.35) : 1) / p.sp.w;
          const sx = k === 2 ? Math.cos(p.rot) : 1;
          const cr = k === 2 ? 1 : Math.cos(p.rot), sr = k === 2 ? 0 : Math.sin(p.rot);
          c.setTransform(dpr * cr * s * sx, dpr * sr * s * sx, -dpr * sr * s, dpr * cr * s, dpr * (p.x + ox), dpr * (p.y + oy));
          c.drawImage(p.sp.cv, -p.sp.w / 2, -p.sp.w / 2, p.sp.w, p.sp.w);
        } else if (k === 6) {
          const cr = Math.cos(p.rot), sr = Math.sin(p.rot), sq = Math.abs(Math.sin(p.age * 7 + p.ph));
          c.setTransform(dpr * cr, dpr * sr, -dpr * sr * sq, dpr * cr * sq, dpr * (p.x + ox), dpr * (p.y + oy));
          c.fillStyle = p.col; c.fillRect(-p.sz / 2, -p.sz * 0.3, p.sz, p.sz * 0.6);
        } else {
          c.setTransform(dpr, 0, 0, dpr, dpr * ox, dpr * oy);
          c.fillStyle = p.col;
          if (k === 7) {
            c.lineWidth = p.sz; c.strokeStyle = p.col; c.lineCap = 'round';
            c.beginPath(); c.moveTo(p.x, p.y); c.lineTo(p.x - p.vx * 0.035, p.y - p.vy * 0.035); c.stroke();
          } else {
            const r = k === 4 ? p.sz * (0.7 + t * 0.6) : p.sz * (1 - t * 0.4);
            c.beginPath(); c.arc(p.x, p.y, r, 0, TAU); c.fill();
            if (k === 5) { c.fillStyle = 'rgba(255,255,255,.8)'; c.beginPath(); c.arc(p.x - r * 0.3, p.y - r * 0.3, r * 0.35, 0, TAU); c.fill(); }
          }
        }
      }
      c.globalAlpha = 1;
      c.setTransform(dpr, 0, 0, dpr, dpr * ox, dpr * oy);
    };
    fx.drawFloats = function (c) {
      for (let i = 0; i < NF; i++) {
        const f = F[i]; if (!f.on) continue;
        const t = f.age / f.life;
        const sc = t < 0.12 ? 0.55 + t / 0.12 * 0.7 : t < 0.24 ? 1.25 - (t - 0.12) / 0.12 * 0.25 : 1;
        const a = t > 0.65 ? (1 - t) / 0.35 : 1;
        const sz = Math.round(f.size * sc / 2) * 2;
        drawText(c, f.text, f.x, f.y, { size: sz, color: f.col, font: 'round', stroke: NAVY, strokeW: Math.max(3, sz * 0.14), shadow: true, alpha: a });
      }
    };
    fx.drawFlash = function (c, w, h) {
      if (fx.flashA <= 0) return;
      c.globalAlpha = Math.min(0.6, fx.flashA);
      c.fillStyle = fx.flashCol; c.fillRect(0, 0, w, h);
      c.globalAlpha = 1;
    };
    return fx;
  }

  /* ================= 背景：day / sea / night / space / road / grass（都会动） ================= */
  function makeSky() {
    const S = { w: 0, h: 0, hud: 0, s: 1, gr: Object.create(null), roadD: 0, lastT: -1, horizon: 0, lanes: 3,
      road: { hy: 0, by: 0, cx: 0, hwTop: 0, hwBot: 0, lanes: 3 } };
    const R = (n, f) => { const a = []; for (let i = 0; i < n; i++) a.push(f(i)); return a; };
    const stars = R(130, (i) => ({ x: Math.random(), y: Math.random(), r: rand(0.6, 1.9), ph: rand(TAU), sp: rand(0.8, 3), big: i % 17 === 0 }));
    const spaceStars = R(120, (i) => ({ x: Math.random(), y: Math.random(), l: i < 55 ? 0 : i < 95 ? 1 : 2, ph: rand(TAU) }));
    const clouds = R(9, (i) => ({ x: Math.random(), y: Math.random(), l: i < 3 ? 0 : i < 6 ? 1 : 2, s: 0, ph: rand(TAU) }));
    clouds.forEach((c) => { c.s = c.l === 0 ? rand(0.45, 0.6) : c.l === 1 ? rand(0.7, 0.9) : rand(1.0, 1.25); });
    const bubbles = R(26, () => ({ x: Math.random(), ph: Math.random(), sp: rand(30, 70), r: rand(2, 6), wob: rand(TAU) }));
    const tufts = R(34, () => ({ x: Math.random(), y: Math.random(), ph: rand(TAU) }));
    const flowers = R(14, (i) => ({ x: Math.random(), y: rand(0.15, 1), ph: rand(TAU), c: ['#FF6B8B', '#FFD23F', '#FFFFFF', '#B388FF', '#FF9F43'][i % 5] }));
    const sparks = R(16, () => ({ x: Math.random(), y: Math.random(), ph: rand(TAU) }));
    const fishes = R(5, (i) => ({ y: rand(0.35, 0.8), sp: rand(18, 40) * (i % 2 ? 1 : -1), ph: Math.random(), s: rand(0.7, 1.2) }));
    const weeds = R(9, (i) => ({ x: (i + rand(0.1, 0.9)) / 9, h: rand(0.5, 1), ph: rand(TAU), c: i % 3 === 0 ? '#2FA36B' : i % 3 === 1 ? '#3BBF7A' : '#1E8C5A' }));
    const lanterns = R(5, (i) => ({ x: (i + 0.5) / 5 + rand(-0.06, 0.06), ph: Math.random(), sp: rand(10, 18), s: rand(0.7, 1.15) }));
    let city = [], cityW = 0;

    function layout(w, h, hud) {
      S.w = w; S.h = h; S.hud = hud; S.s = clamp(Math.min(w, h * 0.75) / 390, 0.85, 1.6);
      S.gr = Object.create(null);
      // 城市天际线（夜景 / 公路共用），按宽度生成一次
      city = []; cityW = w;
      let x = -10;
      while (x < w + 10) {
        const bw = rand(26, 54) * S.s, bh = rand(40, 120) * S.s;
        const b = { x, w: bw, h: bh, win: [] };
        const cols = Math.max(1, Math.floor(bw / (9 * S.s))), rows = Math.max(1, Math.floor(bh / (11 * S.s)));
        for (let r = 0; r < rows; r++) for (let q = 0; q < cols; q++) if (Math.random() < 0.55) b.win.push({ x: 4 * S.s + q * 9 * S.s, y: 6 * S.s + r * 11 * S.s, ph: Math.random() < 0.18 ? rand(TAU) : -1 });
        city.push(b);
        x += bw + rand(2, 10) * S.s;
      }
      const ph = hud + (h - hud) * 0.26;
      const hwBot = w < 700 ? w * 0.5 : Math.min(w * 0.36, 440);
      Object.assign(S.road, { hy: ph, by: h, cx: w / 2, hwBot, hwTop: hwBot * 0.07, lanes: S.lanes, span: ZOBJ - ZN });
    }
    function lin(c, key, y0, y1, stops) {
      let g = S.gr[key];
      if (!g) { g = c.createLinearGradient(0, y0, 0, y1); for (let i = 0; i < stops.length; i += 2) g.addColorStop(stops[i], stops[i + 1]); S.gr[key] = g; }
      return g;
    }
    function rad(c, key, r, stops) {
      let g = S.gr[key];
      if (!g) { g = c.createRadialGradient(0, 0, 0, 0, 0, r); for (let i = 0; i < stops.length; i += 2) g.addColorStop(stops[i], stops[i + 1]); S.gr[key] = g; }
      return g;
    }
    function sun(c, x, y, r, t) {
      c.save(); c.translate(x, y);
      c.globalAlpha = 0.8 + 0.2 * Math.sin(t * 1.4);
      c.fillStyle = rad(c, 'sunglow' + r, r * 3.4, [0, 'rgba(255,248,190,.85)', 0.35, 'rgba(255,236,140,.35)', 1, 'rgba(255,230,120,0)']);
      c.beginPath(); c.arc(0, 0, r * 3.4, 0, TAU); c.fill();
      c.globalAlpha = 0.5;
      c.rotate(t * 0.12);
      c.fillStyle = '#FFF3A8';
      for (let i = 0; i < 12; i++) {
        c.rotate(TAU / 12);
        const L = r * (1.75 + 0.18 * Math.sin(t * 2.2 + i * 1.7));
        c.beginPath(); c.moveTo(r * 1.12, -r * 0.16); c.lineTo(L, 0); c.lineTo(r * 1.12, r * 0.16); c.closePath(); c.fill();
      }
      c.globalAlpha = 1;
      c.fillStyle = rad(c, 'sundisc' + r, r, [0, '#FFF9C4', 0.55, '#FFE14D', 1, '#FFB41F']);
      c.beginPath(); c.arc(0, 0, r, 0, TAU); c.fill();
      c.lineWidth = 3; c.strokeStyle = 'rgba(255,160,20,.55)'; c.stroke();
      c.restore();
    }
    function cloudLayer(c, t, y0, y1, spd) {
      const w = S.w, m = 160 * S.s, span = w + m * 2;
      for (let i = 0; i < clouds.length; i++) {
        const cl = clouds[i];
        const v = (cl.l === 0 ? 5 : cl.l === 1 ? 11 : 19) * (spd == null ? 1 : spd);
        let x = (cl.x * span + t * v) % span; if (x < 0) x += span;
        drawCloud(c, x - m, y0 + cl.y * (y1 - y0) + Math.sin(t * 0.4 + cl.ph) * 3, cl.s * S.s, cl.l === 0 ? 0.65 : cl.l === 1 ? 0.85 : 0.97);
      }
    }
    function gulls(c, t, y0) {
      c.strokeStyle = 'rgba(40,60,90,.7)'; c.lineWidth = 2.2 * S.s; c.lineCap = 'round';
      for (let i = 0; i < 3; i++) {
        const span = S.w + 120, x = ((i * 0.37 * span + t * (26 + i * 7)) % span) - 60;
        const y = y0 + i * 22 * S.s + Math.sin(t * 0.8 + i) * 8;
        const f = Math.sin(t * 7 + i * 2) * 5 * S.s, k = (7 - i) * S.s;
        c.beginPath(); c.moveTo(x - k * 1.4, y - f * 0.4); c.quadraticCurveTo(x - k * 0.6, y - k * 0.7 - f, x, y);
        c.quadraticCurveTo(x + k * 0.6, y - k * 0.7 - f, x + k * 1.4, y - f * 0.4); c.stroke();
      }
    }
    function palm(c, x, y, hgt, lean, t, ph) {
      const s = hgt / 200;
      const tx = x + lean * hgt, ty = y - hgt;
      c.lineCap = 'round';
      c.strokeStyle = '#8A5A33'; c.lineWidth = 15 * s;
      c.beginPath(); c.moveTo(x, y); c.quadraticCurveTo(x + lean * hgt * 0.15, y - hgt * 0.6, tx, ty); c.stroke();
      c.setLineDash([3 * s, 8 * s]); c.strokeStyle = '#6B4424'; c.lineWidth = 15 * s; c.lineCap = 'butt';
      c.beginPath(); c.moveTo(x, y); c.quadraticCurveTo(x + lean * hgt * 0.15, y - hgt * 0.6, tx, ty); c.stroke();
      c.setLineDash([]); c.lineCap = 'round';
      const sway = Math.sin(t * 1.3 + ph) * 0.06;
      for (let i = 0; i < 7; i++) {
        const a = -Math.PI + 0.25 + i * 0.44 + sway + Math.sin(t * 2 + i + ph) * 0.03;
        const L = (i === 0 || i === 6 ? 78 : 92) * s;
        c.save(); c.translate(tx, ty); c.rotate(a);
        c.fillStyle = i % 2 ? '#1F9446' : '#28A852';
        c.beginPath(); c.moveTo(0, 0); c.quadraticCurveTo(L * 0.45, -17 * s, L, 20 * s); c.quadraticCurveTo(L * 0.5, 9 * s, 0, 0); c.fill();
        c.strokeStyle = 'rgba(160,240,150,.55)'; c.lineWidth = 2 * s;
        c.beginPath(); c.moveTo(4 * s, 0); c.quadraticCurveTo(L * 0.45, -8 * s, L * 0.92, 17 * s); c.stroke();
        c.restore();
      }
      c.fillStyle = '#6B4423';
      c.beginPath(); c.arc(tx - 6 * s, ty + 7 * s, 7 * s, 0, TAU); c.arc(tx + 7 * s, ty + 8 * s, 7 * s, 0, TAU); c.fill();
    }
    function mbs(c, x, base, s, col) {   // 滨海湾金沙：三座塔 + 空中花园
      c.fillStyle = col;
      for (let i = 0; i < 3; i++) {
        const bx = x + i * 22 * s;
        c.beginPath(); c.moveTo(bx, base); c.lineTo(bx + 3 * s, base - 62 * s); c.lineTo(bx + 13 * s, base - 62 * s); c.lineTo(bx + 15 * s, base); c.closePath(); c.fill();
      }
      c.beginPath(); c.moveTo(x - 6 * s, base - 62 * s); c.lineTo(x + 66 * s, base - 64 * s); c.lineTo(x + 72 * s, base - 68 * s); c.lineTo(x - 6 * s, base - 68 * s); c.closePath(); c.fill();
    }
    function skyline(c, base, col, winCol, t, alpha) {
      c.globalAlpha = alpha == null ? 1 : alpha;
      c.fillStyle = col;
      for (const b of city) c.fillRect(b.x, base - b.h, b.w, b.h + 1);
      if (winCol) {
        c.fillStyle = winCol;
        const ws = 4 * S.s, hs = 5 * S.s;
        for (const b of city) {
          for (const wv of b.win) {
            if (wv.ph >= 0 && Math.sin(t * 0.6 + wv.ph) < -0.2) continue;
            c.fillRect(b.x + wv.x, base - b.h + wv.y, ws, hs);
          }
        }
      }
      c.globalAlpha = 1;
    }
    function hills(c, y, amp, col, t, k, ph) {
      const w = S.w;
      c.fillStyle = col;
      c.beginPath(); c.moveTo(0, S.h + 2);
      for (let x = 0; x <= w + 20; x += 20) c.lineTo(x, y - amp * (0.55 + 0.45 * Math.sin(x * k + ph)) - amp * 0.3 * Math.sin(x * k * 2.3 + ph * 2));
      c.lineTo(w, S.h + 2); c.closePath(); c.fill();
    }

    /* ---------- day：晴天热带岛 ---------- */
    function day(c, t) {
      const w = S.w, h = S.h, s = S.s;
      const seaY = h * 0.8, sandY = h - Math.max(38, h * 0.075);
      c.fillStyle = lin(c, 'daysky', 0, seaY, [0, '#2FA8F5', 0.45, '#6ECBFF', 0.85, '#BDEBFF', 1, '#E6F9FF']);
      c.fillRect(-30, -30, w + 60, seaY + 31);
      sun(c, w * 0.82, S.hud + 48 * s, 30 * s, t);
      cloudLayer(c, t, S.hud + 10 * s, seaY - 110 * s);
      gulls(c, t, S.hud + 90 * s);
      c.fillStyle = lin(c, 'daysea', seaY, h, [0, '#63DCE8', 0.4, '#27BCD6', 1, '#1491C2']);
      c.fillRect(-30, seaY, w + 60, h - seaY + 30);
      // 远处小岛 + 帆船
      c.fillStyle = '#58B86E';
      c.beginPath(); c.ellipse(w * 0.2, seaY + 2, w * 0.17, 22 * s, 0, Math.PI, TAU); c.fill();
      c.fillStyle = '#47A35C'; c.beginPath(); c.ellipse(w * 0.26, seaY + 2, w * 0.08, 14 * s, 0, Math.PI, TAU); c.fill();
      palm(c, w * 0.14, seaY - 12 * s, 34 * s, 0.12, t, 1); palm(c, w * 0.22, seaY - 16 * s, 42 * s, -0.1, t, 2);
      const bx = ((t * 9) % (w + 120)) - 60, by = seaY + 10 * s + Math.sin(t * 2) * 2;
      c.fillStyle = '#E8533F'; c.beginPath(); c.moveTo(bx - 16 * s, by); c.lineTo(bx + 16 * s, by); c.lineTo(bx + 11 * s, by + 7 * s); c.lineTo(bx - 11 * s, by + 7 * s); c.closePath(); c.fill();
      c.fillStyle = '#FFFFFF'; c.beginPath(); c.moveTo(bx, by - 2); c.lineTo(bx, by - 30 * s); c.lineTo(bx + 15 * s, by - 3); c.closePath(); c.fill();
      c.fillStyle = '#FFD23F'; c.beginPath(); c.moveTo(bx - 2, by - 3); c.lineTo(bx - 2, by - 24 * s); c.lineTo(bx - 13 * s, by - 3); c.closePath(); c.fill();
      // 海面闪光 + 浪线
      for (const sp of sparks) {
        const a = Math.sin(t * 2.5 + sp.ph); if (a < 0.2) continue;
        const x = sp.x * w, y = seaY + 8 + sp.y * (sandY - seaY - 14), k = 3.5 * a * s;
        c.globalAlpha = a; c.fillStyle = '#FFFFFF';
        c.beginPath(); c.moveTo(x, y - k); c.lineTo(x + k * 0.35, y); c.lineTo(x, y + k); c.lineTo(x - k * 0.35, y); c.closePath(); c.fill();
        c.beginPath(); c.moveTo(x - k, y); c.lineTo(x, y + k * 0.3); c.lineTo(x + k, y); c.lineTo(x, y - k * 0.3); c.closePath(); c.fill();
      }
      c.globalAlpha = 0.45; c.strokeStyle = '#FFFFFF'; c.lineWidth = 2;
      for (let i = 0; i < 3; i++) {
        const yy = seaY + (sandY - seaY) * (0.28 + i * 0.25);
        const off = (t * (18 + i * 8)) % 90;
        c.beginPath();
        for (let x = -90 + off; x < w + 90; x += 90) { c.moveTo(x, yy); c.quadraticCurveTo(x + 11, yy - 4, x + 22, yy); }
        c.stroke();
      }
      c.globalAlpha = 1;
      // 沙滩 + 浪花
      const wave = (x) => sandY + Math.sin(x * 0.028 + t * 1.6) * 4 * s + Math.sin(x * 0.06 - t * 1.1) * 2;
      c.fillStyle = lin(c, 'daysand', sandY - 8, h, [0, '#FFE7A6', 1, '#F3C66E']);
      c.beginPath(); c.moveTo(-30, h + 30);
      for (let x = -30; x <= w + 30; x += 15) c.lineTo(x, wave(x));
      c.lineTo(w + 30, h + 30); c.closePath(); c.fill();
      c.strokeStyle = 'rgba(255,255,255,.9)'; c.lineWidth = 4 * s; c.lineCap = 'round';
      c.beginPath();
      for (let x = -30; x <= w + 30; x += 15) { const y = wave(x) - 1; if (x === -30) c.moveTo(x, y); else c.lineTo(x, y); }
      c.stroke();
      const ph = Math.min(h * 0.26, 230);
      palm(c, -8 * s, h + 6, ph, 0.22, t, 0);
      palm(c, w + 10 * s, h + 10, ph * 0.8, -0.24, t, 3);
      S.horizon = seaY;
    }
    /* ---------- sea：海面 + 水下 ---------- */
    function sea(c, t, spd) {
      const w = S.w, h = S.h, s = S.s;
      const sy = Math.round(S.hud + (h - S.hud) * 0.2);
      c.fillStyle = lin(c, 'seasky', 0, sy, [0, '#3DB4FA', 1, '#C6EEFF']);
      c.fillRect(-30, -30, w + 60, sy + 32);
      sun(c, w * 0.18, S.hud + 40 * s, 24 * s, t);
      cloudLayer(c, t, S.hud + 4 * s, sy - 40 * s);
      c.fillStyle = '#5DB870'; c.beginPath(); c.ellipse(w * 0.78, sy + 1, w * 0.14, 14 * s, 0, Math.PI, TAU); c.fill();
      mbs(c, w * 0.7, sy, 0.45 * s, 'rgba(120,150,190,.8)');
      c.fillStyle = lin(c, 'seawater', sy, h, [0, '#3FD6DA', 0.25, '#1FA9D2', 0.7, '#1466A8', 1, '#0D4579']);
      c.fillRect(-30, sy, w + 60, h - sy + 30);
      // 光柱
      c.save(); c.globalCompositeOperation = 'lighter';
      c.fillStyle = lin(c, 'searay', sy, h * 0.85, [0, 'rgba(255,255,255,.16)', 1, 'rgba(255,255,255,0)']);
      for (let i = 0; i < 5; i++) {
        const x = w * (0.1 + i * 0.21) + Math.sin(t * 0.3 + i * 1.3) * 30 * s, ww = (26 + (i % 3) * 16) * s;
        c.globalAlpha = 0.55 + 0.45 * Math.sin(t * 0.7 + i * 2);
        c.beginPath(); c.moveTo(x, sy); c.lineTo(x + ww, sy); c.lineTo(x + ww + 120 * s, h * 0.85); c.lineTo(x + 70 * s, h * 0.85); c.closePath(); c.fill();
      }
      c.restore();
      // 远处小鱼剪影
      c.fillStyle = 'rgba(10,50,100,.28)';
      for (const f of fishes) {
        const span = w + 160, dir = f.sp > 0 ? 1 : -1;
        let x = (f.ph * span + t * f.sp * (spd || 1)) % span; if (x < 0) x += span; x -= 80;
        const y = sy + (h - sy) * f.y + Math.sin(t * 1.5 + f.ph * 9) * 6, k = 14 * f.s * s;
        c.beginPath(); c.ellipse(x, y, k, k * 0.45, 0, 0, TAU); c.fill();
        c.beginPath(); c.moveTo(x - dir * k * 0.8, y); c.lineTo(x - dir * k * 1.6, y - k * 0.5 + Math.sin(t * 8 + f.ph) * 2); c.lineTo(x - dir * k * 1.6, y + k * 0.5); c.closePath(); c.fill();
      }
      // 气泡
      c.strokeStyle = 'rgba(255,255,255,.55)'; c.lineWidth = 1.5;
      const bh = h - sy;
      for (const b of bubbles) {
        const y = h - ((b.ph * bh + t * b.sp) % bh);
        const x = b.x * w + Math.sin(t * 2 + b.wob) * 6;
        c.beginPath(); c.arc(x, y, b.r * s, 0, TAU); c.stroke();
      }
      // 海底：沙 + 水草 + 珊瑚
      const fy = h - 26 * s;
      c.fillStyle = '#E9CD85';
      c.beginPath(); c.moveTo(-30, h + 30);
      for (let x = -30; x <= w + 30; x += 30) c.lineTo(x, fy + Math.sin(x * 0.02) * 6 * s);
      c.lineTo(w + 30, h + 30); c.closePath(); c.fill();
      c.lineCap = 'round';
      for (const wd of weeds) {
        const x = wd.x * w, hh = (60 + 70 * wd.h) * s, sw = Math.sin(t * 1.4 + wd.ph) * 14 * s;
        c.strokeStyle = wd.c; c.lineWidth = 7 * s;
        c.beginPath(); c.moveTo(x, fy + 6); c.quadraticCurveTo(x - sw, fy - hh * 0.5, x + sw, fy - hh); c.stroke();
      }
      c.fillStyle = '#FF7F6B';
      for (let i = 0; i < 2; i++) {
        const x = i ? w - 40 * s : 44 * s, y = fy + 4;
        for (let j = 0; j < 4; j++) { c.beginPath(); c.arc(x + (j - 1.5) * 11 * s, y - (j % 2 ? 18 : 10) * s, 8 * s, 0, TAU); c.fill(); }
      }
      // 水面波浪（两层）
      c.fillStyle = 'rgba(160,240,240,.9)';
      c.beginPath(); c.moveTo(-30, sy + 14);
      for (let x = -30; x <= w + 30; x += 12) c.lineTo(x, sy + Math.sin(x * 0.035 + t * 1.8) * 4 * s - 1);
      c.lineTo(w + 30, sy + 14); c.closePath(); c.fill();
      c.fillStyle = '#3FD6DA';
      c.beginPath(); c.moveTo(-30, sy + 18);
      for (let x = -30; x <= w + 30; x += 12) c.lineTo(x, sy + 5 + Math.sin(x * 0.045 - t * 2.3) * 3.5 * s);
      c.lineTo(w + 30, sy + 18); c.closePath(); c.fill();
      c.strokeStyle = 'rgba(255,255,255,.85)'; c.lineWidth = 2.5;
      c.beginPath();
      for (let x = -30; x <= w + 30; x += 12) { const y = sy + Math.sin(x * 0.035 + t * 1.8) * 4 * s - 1; if (x === -30) c.moveTo(x, y); else c.lineTo(x, y); }
      c.stroke();
      S.horizon = sy;
    }
    /* ---------- night：夜晚的岛（星星、月亮、孔明灯、城市灯火） ---------- */
    function night(c, t) {
      const w = S.w, h = S.h, s = S.s, base = h * 0.86;
      c.fillStyle = lin(c, 'nsky', 0, base, [0, '#070E30', 0.5, '#142159', 0.85, '#2C3B7D', 1, '#4A4E93']);
      c.fillRect(-30, -30, w + 60, base + 32);
      for (const st of stars) {
        const a = 0.35 + 0.65 * (0.5 + 0.5 * Math.sin(t * st.sp + st.ph));
        const x = st.x * w, y = st.y * base * 0.9, rr = st.r * S.s * 1.3;
        c.globalAlpha = a; c.fillStyle = '#FFFFFF';
        if (st.big) {
          const k = 5 * s * a;
          c.beginPath(); c.moveTo(x, y - k); c.lineTo(x + k * 0.25, y); c.lineTo(x, y + k); c.lineTo(x - k * 0.25, y); c.closePath(); c.fill();
          c.beginPath(); c.moveTo(x - k, y); c.lineTo(x, y + k * 0.25); c.lineTo(x + k, y); c.lineTo(x, y - k * 0.25); c.closePath(); c.fill();
        } else { c.beginPath(); c.arc(x, y, rr / 2, 0, TAU); c.fill(); }
      }
      c.globalAlpha = 1;
      // 流星
      const ps = (t % 7.5) / 0.9;
      if (ps < 1) {
        const x0 = w * 0.15 + (Math.floor(t / 7.5) % 3) * w * 0.25, y0 = S.hud + 20 * s, L = 170 * s;
        const hx = x0 + ps * L * 1.4, hy = y0 + ps * L * 0.55;
        c.lineCap = 'round';
        for (let i = 0; i < 6; i++) {
          c.globalAlpha = (1 - i / 6) * (1 - ps * 0.6); c.strokeStyle = '#FFFFFF'; c.lineWidth = (3 - i * 0.4) * s;
          c.beginPath(); c.moveTo(hx - i * 14 * s, hy - i * 5.5 * s); c.lineTo(hx - (i + 1) * 14 * s, hy - (i + 1) * 5.5 * s); c.stroke();
        }
        c.globalAlpha = 1;
      }
      // 月亮
      const mx = w * 0.2, my = S.hud + 56 * s, mr = 28 * s;
      c.save(); c.translate(mx, my);
      c.fillStyle = rad(c, 'moonglow', mr * 3.2, [0, 'rgba(255,245,200,.5)', 0.4, 'rgba(255,235,170,.14)', 1, 'rgba(255,235,170,0)']);
      c.beginPath(); c.arc(0, 0, mr * 3.2, 0, TAU); c.fill();
      c.fillStyle = '#FFF4CF'; c.beginPath(); c.arc(0, 0, mr, 0, TAU); c.fill();
      c.fillStyle = 'rgba(220,200,150,.55)';
      c.beginPath(); c.arc(-mr * 0.35, -mr * 0.2, mr * 0.2, 0, TAU); c.fill();
      c.beginPath(); c.arc(mr * 0.3, mr * 0.28, mr * 0.14, 0, TAU); c.fill();
      c.beginPath(); c.arc(mr * 0.1, -mr * 0.45, mr * 0.09, 0, TAU); c.fill();
      c.restore();
      c.globalAlpha = 0.13;
      cloudLayer(c, t * 0.6, S.hud + 70 * s, base - 200 * s);
      c.globalAlpha = 1;
      // 孔明灯
      const H = base + 80;
      for (const L of lanterns) {
        const y = base + 40 - ((L.ph * H + t * L.sp) % H);
        const x = L.x * w + Math.sin(t * 0.5 + L.ph * 7) * 16 * s, k = 11 * L.s * s;
        c.save(); c.translate(x, y);
        c.fillStyle = rad(c, 'langlow', 40, [0, 'rgba(255,190,90,.55)', 1, 'rgba(255,160,60,0)']);
        c.scale(k / 11, k / 11); c.beginPath(); c.arc(0, 2, 40, 0, TAU); c.fill();
        c.fillStyle = '#E8552B';
        c.beginPath(); c.moveTo(-8, 12); c.bezierCurveTo(-13, 2, -12, -12, 0, -13); c.bezierCurveTo(12, -12, 13, 2, 8, 12); c.closePath(); c.fill();
        c.fillStyle = '#FFB347';
        c.beginPath(); c.moveTo(-5, 11); c.bezierCurveTo(-8, 2, -7, -9, 0, -10); c.bezierCurveTo(7, -9, 8, 2, 5, 11); c.closePath(); c.fill();
        c.fillStyle = '#FFF1B8'; c.beginPath(); c.ellipse(0, 8, 2.6, 3.6 + Math.sin(t * 9 + L.ph * 20) * 0.8, 0, 0, TAU); c.fill();
        c.fillStyle = '#7A2A12'; c.fillRect(-6, 11, 12, 2.5);
        c.restore();
      }
      // 城市天际线 + 金沙
      skyline(c, base, '#18204E', '#FFD66B', t);
      mbs(c, w * 0.62, base, 1.1 * s, '#141B45');
      c.fillStyle = lin(c, 'nwater', base, h, [0, '#1C2A66', 1, '#0B1438']);
      c.fillRect(-30, base, w + 60, h - base + 30);
      c.globalAlpha = 0.35; c.fillStyle = '#FFD66B';
      for (let i = 0; i < city.length; i += 2) {
        const b = city[i]; if (!b.win.length) continue;
        const yy = base + 6 + ((i * 7) % 20), ww = b.w * 0.6 * (0.6 + 0.4 * Math.sin(t * 2 + i));
        c.fillRect(b.x + b.w * 0.2, yy, ww, 2);
      }
      c.globalAlpha = 1;
      S.horizon = base;
    }
    /* ---------- space：星空飞行（星星向下流 = 向上飞） ---------- */
    function space(c, t, spd) {
      const w = S.w, h = S.h, s = S.s;
      c.fillStyle = lin(c, 'spbg', 0, h, [0, '#04021A', 0.5, '#140A3C', 1, '#24104F']);
      c.fillRect(-30, -30, w + 60, h + 60);
      c.save(); c.globalCompositeOperation = 'lighter';
      c.translate(w * 0.25 + Math.sin(t * 0.05) * 30, h * 0.35);
      c.fillStyle = rad(c, 'neb1', 220 * s, [0, 'rgba(160,70,220,.32)', 1, 'rgba(160,70,220,0)']);
      c.beginPath(); c.arc(0, 0, 220 * s, 0, TAU); c.fill();
      c.restore();
      c.save(); c.globalCompositeOperation = 'lighter';
      c.translate(w * 0.8 + Math.cos(t * 0.04) * 30, h * 0.7);
      c.fillStyle = rad(c, 'neb2', 200 * s, [0, 'rgba(40,200,190,.22)', 1, 'rgba(40,200,190,0)']);
      c.beginPath(); c.arc(0, 0, 200 * s, 0, TAU); c.fill();
      c.restore();
      const sp = spd == null ? 1 : spd;
      c.fillStyle = '#FFFFFF'; c.strokeStyle = '#FFFFFF'; c.lineCap = 'round';
      for (const st of spaceStars) {
        const v = st.l === 0 ? 14 : st.l === 1 ? 40 : 95;
        let y = (st.y * h + S.spaceD * v) % (h + 10); if (y < 0) y += h + 10;
        const x = st.x * w, r = (st.l === 0 ? 1.1 : st.l === 1 ? 1.8 : 2.6) * S.s;
        c.globalAlpha = st.l === 0 ? 0.45 + 0.4 * Math.sin(t * 2 + st.ph) : 0.95;
        const streak = sp > 1.6 ? v * (sp - 1.4) * 0.045 * S.s : 0;
        if (streak > r * 1.5) { c.lineWidth = r; c.beginPath(); c.moveTo(x, y); c.lineTo(x, y - streak); c.stroke(); }
        else if (st.l === 2 && (st.ph > 5.2)) {
          const k = r * 2.4 * (0.75 + 0.25 * Math.sin(t * 3 + st.ph));
          c.beginPath(); c.moveTo(x, y - k); c.lineTo(x + k * 0.22, y); c.lineTo(x, y + k); c.lineTo(x - k * 0.22, y); c.closePath(); c.fill();
          c.beginPath(); c.moveTo(x - k, y); c.lineTo(x, y + k * 0.22); c.lineTo(x + k, y); c.lineTo(x, y - k * 0.22); c.closePath(); c.fill();
        } else { c.beginPath(); c.arc(x, y, r / 2, 0, TAU); c.fill(); }
      }
      c.globalAlpha = 1;
      // 带环行星
      const PY = h + 360;
      let py = (0.3 * PY + S.spaceD * 8) % PY; py -= 180;
      const px = w * 0.8, pr = 44 * s;
      c.save(); c.translate(px, py); c.rotate(-0.35);
      c.strokeStyle = 'rgba(255,224,163,.85)'; c.lineWidth = 6 * s;
      c.beginPath(); c.ellipse(0, 0, pr * 1.9, pr * 0.5, 0, Math.PI, TAU); c.stroke();
      c.fillStyle = rad(c, 'planet', pr * 1.4, [0, '#FFC08A', 0.6, '#F0785A', 1, '#A83E4A']);
      c.translate(-pr * 0.3, -pr * 0.3); c.beginPath(); c.arc(pr * 0.3, pr * 0.3, pr, 0, TAU); c.fill(); c.translate(pr * 0.3, pr * 0.3);
      c.strokeStyle = 'rgba(255,255,255,.18)'; c.lineWidth = 5 * s;
      c.beginPath(); c.ellipse(0, -pr * 0.3, pr * 0.95, pr * 0.16, 0, 0, TAU); c.stroke();
      c.strokeStyle = 'rgba(255,224,163,.95)'; c.lineWidth = 6 * s;
      c.beginPath(); c.ellipse(0, 0, pr * 1.9, pr * 0.5, 0, 0, Math.PI); c.stroke();
      c.restore();
      // 小月球
      let my = (0.75 * PY + S.spaceD * 20) % PY; my -= 180;
      const mx = w * 0.14, mr = 20 * s;
      c.fillStyle = '#C9CCE0'; c.beginPath(); c.arc(mx, my, mr, 0, TAU); c.fill();
      c.fillStyle = '#A5A9C4';
      c.beginPath(); c.arc(mx - mr * 0.3, my - mr * 0.2, mr * 0.25, 0, TAU); c.arc(mx + mr * 0.35, my + mr * 0.3, mr * 0.18, 0, TAU); c.fill();
      S.horizon = h;
    }
    /* ---------- road：伪 3D 公路（条纹、路边椰树 / 路灯飞速后退） ---------- */
    const ZN = 3, ZF = 60, ZOBJ = ZN / 0.07;
    function proj(z) { return S.road.hy + (S.road.by - S.road.hy) * (ZN / z); }
    function road(c, t, spd) {
      const w = S.w, h = S.h, s = S.s, rd = S.road;
      const hy = rd.hy, cx = rd.cx, hw0 = rd.hwBot;
      rd.lanes = S.lanes;
      c.fillStyle = lin(c, 'rsky', 0, hy, [0, '#35AEF7', 0.7, '#9FDCFF', 1, '#DDF4FF']);
      c.fillRect(-30, -30, w + 60, hy + 31);
      sun(c, w * 0.8, S.hud + 38 * s, 22 * s, t);
      cloudLayer(c, t, S.hud + 4 * s, hy - 60 * s, 0.6);
      hills(c, hy + 2, 26 * s, '#8FD19A', t, 0.012, 1);
      skyline(c, hy + 2, '#A9C6E4', 'rgba(255,255,255,.55)', t, 0.9);
      mbs(c, w * 0.12, hy + 2, 0.6 * s, '#9DB9DA');
      const d = S.roadD, L = 1.15;
      const j0 = Math.floor(d / L) - 1;
      for (let j = j0; ; j++) {
        let zA = ZN + j * L - d, zB = zA + L;
        if (zA > ZF) break;
        if (zB <= ZN * 0.35) continue;
        if (zA < ZN * 0.35) zA = ZN * 0.35;
        const yA = proj(zA), yB = proj(zB);
        const hA = hw0 * ZN / zA, hB = hw0 * ZN / zB;
        const odd = (j & 1) === 1;
        c.fillStyle = odd ? '#78CF55' : '#6AC24A';
        c.fillRect(-30, yB, w + 60, yA - yB + 1);
        c.fillStyle = odd ? '#6E768A' : '#697184';
        c.beginPath(); c.moveTo(cx - hA, yA); c.lineTo(cx - hB, yB); c.lineTo(cx + hB, yB); c.lineTo(cx + hA, yA); c.closePath(); c.fill();
        const kA = hA * 0.08, kB = hB * 0.08;
        c.fillStyle = odd ? '#FF5A5A' : '#FFFFFF';
        c.beginPath(); c.moveTo(cx - hA - kA, yA); c.lineTo(cx - hB - kB, yB); c.lineTo(cx - hB, yB); c.lineTo(cx - hA, yA); c.closePath(); c.fill();
        c.beginPath(); c.moveTo(cx + hA, yA); c.lineTo(cx + hB, yB); c.lineTo(cx + hB + kB, yB); c.lineTo(cx + hA + kA, yA); c.closePath(); c.fill();
        if (odd) {
          c.fillStyle = 'rgba(255,255,255,.92)';
          for (let q = 1; q < rd.lanes; q++) {
            const f = -1 + 2 * q / rd.lanes, dA = hA * 0.025, dB = hB * 0.025;
            c.beginPath(); c.moveTo(cx + f * hA - dA, yA); c.lineTo(cx + f * hB - dB, yB); c.lineTo(cx + f * hB + dB, yB); c.lineTo(cx + f * hA + dA, yA); c.closePath(); c.fill();
          }
        }
      }
      // 地平线雾
      c.fillStyle = lin(c, 'rfog', hy, hy + 34 * s, [0, 'rgba(221,244,255,.95)', 1, 'rgba(221,244,255,0)']);
      c.fillRect(-30, hy, w + 60, 34 * s);
      // 路边物件：椰树 / 路灯，远→近
      const G = 3.4;
      const k1 = Math.floor((d + ZF) / G), k0 = Math.floor(d / G);
      for (let k = k1; k >= k0; k--) {
        const z = ZN + k * G - d + 1.5;
        if (z < ZN * 0.42 || z > ZF * 0.75) continue;
        const y = proj(z), sc = ZN / z, hh = hw0 * sc;
        const side = (k & 1) ? 1 : -1;
        const x = cx + side * (hh * 1.22 + 26 * sc * s);
        if ((k % 4) < 2) palm(c, x, y, 230 * sc * s, -side * 0.12, t, k);
        else {
          c.strokeStyle = '#4A5268'; c.lineWidth = Math.max(1, 6 * sc * s); c.lineCap = 'round';
          const top = y - 170 * sc * s;
          c.beginPath(); c.moveTo(x, y); c.lineTo(x, top); c.lineTo(x - side * 34 * sc * s, top); c.stroke();
          c.fillStyle = '#FFE58A'; c.beginPath(); c.arc(x - side * 34 * sc * s, top + 5 * sc * s, 7 * sc * s, 0, TAU); c.fill();
        }
      }
      S.horizon = hy;
    }
    function roadPos(lane, t, out) {
      const rd = S.road;
      const z = ZOBJ + (ZN - ZOBJ) * clamp(t, 0, 1.25);
      const zz = Math.max(ZN * 0.4, z);
      const sc = ZN / zz, hh = rd.hwBot * sc;
      const f = -1 + (2 * lane + 1) / rd.lanes;
      out = out || {};
      out.x = rd.cx + f * hh; out.y = proj(zz); out.s = sc;
      return out;
    }
    /* ---------- grass：草地（远山、草丛摇摆、小花、蝴蝶） ---------- */
    function grass(c, t) {
      const w = S.w, h = S.h, s = S.s;
      const hz = Math.round(S.hud + (h - S.hud) * 0.2);
      c.fillStyle = lin(c, 'gsky', 0, hz, [0, '#3DB2F7', 0.8, '#A8E2FF', 1, '#DDF5FF']);
      c.fillRect(-30, -30, w + 60, hz + 32);
      sun(c, w * 0.84, S.hud + 34 * s, 22 * s, t);
      cloudLayer(c, t, S.hud, hz - 50 * s);
      hills(c, hz + 4, 34 * s, '#A6DDA5', t, 0.009, 0.5);
      for (let i = 0; i < 6; i++) {
        const tx = w * (0.08 + i * 0.17) + Math.sin(i * 7.3) * 20 * s, ty = hz + 4 - (14 + (i % 3) * 5) * s, k = (7 + (i % 2) * 3) * s;
        c.fillStyle = '#6FA86A'; c.fillRect(tx - 1.5 * s, ty, 3 * s, 10 * s);
        c.fillStyle = i % 2 ? '#5FAF5E' : '#72BF6A'; c.beginPath(); c.arc(tx, ty - k * 0.4, k, 0, TAU); c.fill();
      }
      hills(c, hz + 14, 22 * s, '#7DCB6E', t, 0.014, 2.1);
      c.fillStyle = lin(c, 'gfield', hz + 10, h, [0, '#8EE06A', 0.5, '#6CCB52', 1, '#4DAF42']);
      c.fillRect(-30, hz + 10, w + 60, h - hz + 22);
      c.fillStyle = 'rgba(255,255,255,.06)';
      for (let i = 0; i < 6; i++) { const y = hz + 20 + (h - hz) * (i / 6) * (i / 6); c.fillRect(-30, y, w + 60, 6 + i * 4); }
      const fh = h - hz;
      c.strokeStyle = '#3F9B3A'; c.lineCap = 'round';
      for (const tf of tufts) {
        const y = hz + 18 + tf.y * (fh - 24), sc = (0.55 + tf.y * 0.8) * s, x = tf.x * w;
        const sw = Math.sin(t * 2 + tf.ph) * 3 * sc;
        c.lineWidth = 2.6 * sc;
        c.beginPath();
        c.moveTo(x - 4 * sc, y); c.quadraticCurveTo(x - 6 * sc, y - 8 * sc, x - 9 * sc + sw, y - 13 * sc);
        c.moveTo(x, y); c.quadraticCurveTo(x, y - 10 * sc, x + sw, y - 17 * sc);
        c.moveTo(x + 4 * sc, y); c.quadraticCurveTo(x + 6 * sc, y - 8 * sc, x + 9 * sc + sw, y - 12 * sc);
        c.stroke();
      }
      for (const f of flowers) {
        const y = hz + 18 + f.y * (fh - 30), sc = (0.6 + f.y * 0.7) * s, x = f.x * w;
        const b = Math.sin(t * 2.2 + f.ph) * 2 * sc;
        c.strokeStyle = '#3F9B3A'; c.lineWidth = 2 * sc;
        c.beginPath(); c.moveTo(x, y); c.lineTo(x + b, y - 12 * sc); c.stroke();
        c.fillStyle = f.c;
        for (let i = 0; i < 5; i++) { const a = i * TAU / 5 + t * 0.2; c.beginPath(); c.arc(x + b + Math.cos(a) * 4 * sc, y - 12 * sc + Math.sin(a) * 4 * sc, 3.2 * sc, 0, TAU); c.fill(); }
        c.fillStyle = '#FFB300'; c.beginPath(); c.arc(x + b, y - 12 * sc, 2.4 * sc, 0, TAU); c.fill();
      }
      for (let i = 0; i < 4; i++) {
        const side = i % 2 ? w + 16 * s : -16 * s, by0 = hz + 24 * s + (i < 2 ? 0 : (h - hz) * 0.55), k = (30 + (i % 3) * 8) * s;
        c.fillStyle = '#3E9E3C';
        c.beginPath(); c.arc(side, by0 + k * 0.3, k, 0, TAU); c.arc(side + (i % 2 ? -k * 0.8 : k * 0.8), by0 + k * 0.55, k * 0.7, 0, TAU); c.fill();
        c.fillStyle = '#56B84E';
        c.beginPath(); c.arc(side + (i % 2 ? -k * 0.2 : k * 0.2), by0 + k * 0.1, k * 0.72, 0, TAU); c.fill();
        c.fillStyle = '#FF6B8B'; c.beginPath(); c.arc(side + (i % 2 ? -k * 0.5 : k * 0.5), by0 + k * 0.05, 3 * s, 0, TAU); c.fill();
      }
      for (let i = 0; i < 2; i++) {
        const bx = w * 0.5 + Math.sin(t * 0.37 + i * 3) * w * 0.38, by = hz + 50 * s + Math.sin(t * 0.9 + i * 2) * 40 * s + i * 60 * s;
        const fl = Math.abs(Math.sin(t * 13 + i)), k = 9 * s;
        c.fillStyle = i ? '#FF8FB1' : '#FFD23F';
        c.beginPath(); c.ellipse(bx - k * 0.6 * fl, by, k * fl, k * 0.8, 0, 0, TAU); c.ellipse(bx + k * 0.6 * fl, by, k * fl, k * 0.8, 0, 0, TAU); c.fill();
        c.fillStyle = NAVY; c.fillRect(bx - 1, by - k * 0.6, 2, k * 1.2);
      }
      S.horizon = hz;
    }
    S.layout = layout;
    S.roadPos = roadPos;
    S.spaceD = 0;
    S.draw = function (c, name, t, spd) {
      const dt = S.lastT < 0 ? 0 : clamp(t - S.lastT, 0, 0.1); S.lastT = t;
      const sp = spd == null ? 1 : spd;
      S.roadD += dt * 7 * sp; S.spaceD += dt * sp;
      if (name === 'day') day(c, t);
      else if (name === 'sea') sea(c, t, sp);
      else if (name === 'night') night(c, t);
      else if (name === 'space') space(c, t, sp);
      else if (name === 'road') road(c, t, sp);
      else if (name === 'grass') grass(c, t);
      else S.horizon = S.h;
    };
    S.horizonOf = function (name) {
      const h = S.h, hud = S.hud;
      if (name === 'day') return h * 0.8;
      if (name === 'sea') return Math.round(hud + (h - hud) * 0.2);
      if (name === 'night') return h * 0.86;
      if (name === 'road') return S.road.hy;
      if (name === 'grass') return Math.round(hud + (h - hud) * 0.2);
      return h;
    };
    return S;
  }

  /* ================= 拼音工具：charPool / similarChars / 无 TTS 字幕 ================= */
  const INITIALS = ['zh', 'ch', 'sh', 'b', 'p', 'm', 'f', 'd', 't', 'n', 'l', 'g', 'k', 'h', 'j', 'q', 'x', 'r', 'z', 'c', 's', 'y', 'w'];
  function toneless(py) {
    return String(py || '').toLowerCase().replace(/[ǖǘǚǜü]/g, 'v').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z]/g, '');
  }
  function splitPy(s) {
    for (const i of INITIALS) if (s.length > i.length && s.indexOf(i) === 0) return [i, s.slice(i.length)];
    return ['', s];
  }
  /* 题库里带拼音的条目 → 每个字各读音的出现次数、词表（汉字串 → 音节）、长句（>6 字，如绕口令整句） */
  const newAcc = () => ({ cnt: Object.create(null), words: Object.create(null), long: [], maxLen: 1 });
  function collect(G, acc) {
    const add = (text, py) => {
      if (typeof text !== 'string' || typeof py !== 'string') return;
      const chs = Array.from(text.trim()).filter(isHan), syl = py.trim().split(/\s+/).filter(Boolean);
      if (!chs.length || chs.length !== syl.length) return;
      const key = chs.join('');
      if (!(key in acc.words)) {
        acc.words[key] = syl.join(' ');
        if (chs.length > 6) acc.long.push({ key, syl }); else if (chs.length > acc.maxLen) acc.maxLen = chs.length;
      }
      chs.forEach((ch, i) => { const c = acc.cnt[ch] || (acc.cnt[ch] = Object.create(null)); c[syl[i]] = (c[syl[i]] || 0) + 1; });
    };
    const arr = (k) => (G && Array.isArray(G[k]) ? G[k] : []);
    arr('chars').forEach((x) => x && add(x.c, x.py));
    arr('words').forEach((x) => x && add(x.w, x.py));
    arr('pick').forEach((x) => x && add(x.say, x.py));
    arr('build').forEach((x) => x && add(x.ans, x.py));
    arr('readaloud').forEach((x) => x && Array.isArray(x.hard) && x.hard.forEach((hd) => hd && add(hd.w, hd.py)));
    arr('twisters').forEach((x) => x && add(x.text, x.py));
  }
  /* 单字读音取题库里最常见的那个（多音字：着 zhe 比 zháo 常见、个 gè 比 ge 常见），不是“第一次见到的” */
  function finishPool(acc) {
    const tone = Object.create(null), bare = Object.create(null);
    for (const ch in acc.cnt) {
      const c = acc.cnt[ch];
      let best = '', bn = 0;
      for (const sy in c) if (c[sy] > bn) { best = sy; bn = c[sy]; }
      tone[ch] = best; bare[ch] = toneless(best);
    }
    return { tone, bare, words: acc.words, long: acc.long, maxLen: acc.maxLen };
  }
  function buildPool(G) { const a = newAcc(); collect(G, a); return finishPool(a); }
  /* 朗读字幕用：全部年级合在一起（比本年级 charPool 覆盖更全） */
  let PY_ALL = null;
  function pyAll() {
    if (PY_ALL) return PY_ALL;
    const a = newAcc();
    const all = W.HW_DATA && typeof W.HW_DATA === 'object' ? W.HW_DATA : {};
    Object.keys(all).forEach((gr) => collect(all[gr], a));
    PY_ALL = finishPool(a);
    return PY_ALL;
  }
  function toneNum(sy) {   // 1–4 声；没有调号 = 5（轻声）
    const m = String(sy).normalize('NFD').match(/[\u0304\u0301\u030c\u0300]/);
    return !m ? 5 : m[0] === '\u0304' ? 1 : m[0] === '\u0301' ? 2 : m[0] === '\u030c' ? 3 : 4;
  }
  const DIGITS = '零〇一二三四五六七八九十';
  let DE_SET = null;   // 核心给 TTS 用的“状语地读 de”三字窗口（HW_TTS_DE），字幕也照用
  function deSet() {
    if (!DE_SET) { DE_SET = Object.create(null); try { (W.HW_TTS_DE || []).forEach((k) => { DE_SET[k] = 1; }); } catch (e) { /* ignore */ } }
    return DE_SET;
  }
  /* 文本 → 带调拼音：①整段汉字是题库里的词/整句的一段（绕口令拆句）→ 直接用课本注音；
     ②否则逐位置最长词优先；③剩下的单字取最常见读音，并做“一/不”变调与状语“地”；查不到的字给 '·' */
  function pinyinText(text, P, A) {
    const s = String(text == null ? '' : text).trim();
    if (!s) return '';
    const chs = Array.from(s), hanIdx = [];
    for (let i = 0; i < chs.length; i++) if (isHan(chs[i])) hanIdx.push(i);
    const syl = new Array(chs.length).fill(null), fixed = new Array(chs.length).fill(false);
    const hanSeq = hanIdx.map((i) => chs[i]).join('');
    let whole = hanSeq ? (P.words[hanSeq] || A.words[hanSeq] || null) : null;
    if (!whole && hanIdx.length >= 4) {   // 4 字以上才去整句里找，免得两三个字碰巧撞上别的语境
      for (const L of [P.long, A.long]) {
        for (const e of L) { const at = e.key.indexOf(hanSeq); if (at >= 0) { whole = e.syl.slice(at, at + hanIdx.length).join(' '); break; } }
        if (whole) break;
      }
    }
    if (whole) {
      const ss = whole.split(' ');
      hanIdx.forEach((i, j) => { syl[i] = ss[j] || '·'; fixed[i] = true; });
    } else {
      const maxN = Math.max(P.maxLen, A.maxLen);
      for (let j = 0; j < hanIdx.length;) {
        let hit = 0;
        for (let n = Math.min(maxN, hanIdx.length - j); n >= 2 && !hit; n--) {
          if (hanIdx[j + n - 1] - hanIdx[j] !== n - 1) continue;   // 中间隔着标点就不算一个词
          let w = '';
          for (let q = 0; q < n; q++) w += chs[hanIdx[j + q]];
          const py = P.words[w] || A.words[w];
          if (!py) continue;
          const ss = py.split(' ');
          if (ss.length !== n) continue;
          for (let q = 0; q < n; q++) { syl[hanIdx[j + q]] = ss[q]; fixed[hanIdx[j + q]] = true; }
          hit = n;
        }
        if (hit) { j += hit; continue; }
        const ch = chs[hanIdx[j]];
        syl[hanIdx[j]] = A.tone[ch] || '·';   // 单字按全部年级统计的最常见读音（本年级样本太少，易取到轻声）
        j++;
      }
      for (let j = 0; j < hanIdx.length; j++) {
        const i = hanIdx[j], ch = chs[i];
        if (fixed[i]) continue;
        const ni = j + 1 < hanIdx.length && hanIdx[j + 1] === i + 1 ? i + 1 : -1;
        const nx = ni >= 0 ? syl[ni] : null, nt = nx && nx !== '·' ? toneNum(nx) : 0;
        // 后一个字读音不明时变调也定不了：宁可给 '·' 也不给错调
        if (ch === '不') syl[i] = !nx ? 'bù' : nt ? (nt === 4 ? 'bú' : 'bù') : '·';
        else if (ch === '一') {
          const prev = i > 0 ? chs[i - 1] : '';
          if (ni < 0 || DIGITS.indexOf(chs[ni]) >= 0 || (prev && DIGITS.indexOf(prev) >= 0) || prev === '第') syl[i] = 'yī';
          else syl[i] = nt ? (nt === 4 || nt === 5 ? 'yí' : 'yì') : '·';
        } else if (ch === '地' && deSet()[(chs[i - 1] || '') + '地' + (chs[i + 1] || '')]) syl[i] = 'de';
      }
    }
    const out = [];
    for (let i = 0; i < chs.length; i++) {
      const ch = chs[i];
      if (syl[i] != null) out.push(syl[i]);
      else if (/\s/.test(ch)) continue;
      else if (out.length && !/[A-Za-z0-9]/.test(ch)) out[out.length - 1] += ch;
      else out.push(ch);
    }
    return out.join(' ');
  }
  /* 干扰字：同音 → 近音（平翘舌 / n-l / f-h / 前后鼻音）→ 同韵母 → 同声母 → 本年级其它字。
     exclude 里若给了包含 ch 的词（如 '公园'），换字后成了题库里另一个词（'公元'）的候选也会被排除——它不算“错字” */
  const NEAR_I = { z: 'zh', zh: 'z', c: 'ch', ch: 'c', s: 'sh', sh: 's', n: 'l', l: 'n', f: 'h', h: 'f', r: 'l' };
  const NEAR_F = { in: 'ing', ing: 'in', en: 'eng', eng: 'en', an: 'ang', ang: 'an', ian: 'iang', iang: 'ian', uan: 'uang', uang: 'uan' };
  function similarOf(P, A, ch, n, exclude) {
    n = n == null ? 3 : Math.max(0, Math.floor(+n) || 0);
    if (!n) return [];
    ch = String(ch == null ? '' : ch);
    const exList = Array.isArray(exclude) ? exclude.map(String) : [String(exclude == null ? '' : exclude)];
    const ex = new Set(Array.from(exList.join('')));
    ex.add(ch);
    const ctxWords = exList.filter((w) => Array.from(w).length >= 2 && w.indexOf(ch) >= 0);
    const bare = P.bare;
    const py = bare[ch] || A.bare[ch] || '';
    const [ini, fin] = py ? splitPy(py) : ['', ''];
    const tiers = [[], [], [], [], [], []];
    for (const k in bare) {
      if (ex.has(k)) continue;
      let t = 5;
      if (py) {
        const q = bare[k];
        if (q === py) t = 0;
        else {
          const [i2, f2] = splitPy(q);
          if ((f2 === fin && ini && NEAR_I[ini] === i2) || (i2 === ini && NEAR_F[fin] === f2)) t = 1;
          else if (f2 === fin) t = 2;
          else if (ini && i2 === ini) t = 3;
          else t = 4;
        }
      }
      if (ctxWords.length && ctxWords.some((w) => { const w2 = w.split(ch).join(k); return w2 !== w && (w2 in A.words || w2 in P.words); })) continue;
      tiers[t].push(k);
    }
    let out = [];
    for (const tr of tiers) { if (out.length >= n) break; out = out.concat(shuffle(tr)); }
    return out.slice(0, n);
  }
  /* 错题重练时按栏目识别题目对象 */
  function colOf(col, it) {
    if (!it || typeof it !== 'object') return false;
    switch (col) {
      case 'words': return typeof it.w === 'string';
      case 'chars': return typeof it.c === 'string' && (it.jg != null || it.bs != null || Array.isArray(it.words));
      case 'quiz': return typeof it.q === 'string' && Array.isArray(it.c);
      case 'pick': return typeof it.say === 'string';
      case 'stories': return Array.isArray(it.qs) && typeof it.text === 'string' && !it.qs.some((q) => q && q.k != null);
      case 'passages': return Array.isArray(it.qs) && typeof it.text === 'string' && it.qs.some((q) => q && q.k != null);
      case 'readaloud': return typeof it.text === 'string' && typeof it.title === 'string' && !Array.isArray(it.qs);
      case 'twisters': return typeof it.text === 'string' && typeof it.py === 'string' && it.title == null;
      case 'talk': return typeof it.topic === 'string';
      case 'order': return Array.isArray(it.tiles);
      case 'build': return typeof it.base === 'string';
      case 'typo': return typeof it.bad === 'string';
      case 'compose': return typeof it.prompt === 'string';
      default: return true;
    }
  }
  const starsFor = (r) => (r >= 0.9 ? 3 : r >= 0.6 ? 2 : r >= 0.3 ? 1 : 0);
  const LIVE = new Set();   // 正在运行的游戏实例（HW.arcade.stats 用；正常情况下最多 1 个）
  const SKILL_ICON = { listen: '🎧', speak: '🎤', read: '📖', write: '✏️' };

  /* ================= HW.arcade.run ================= */
  function run(ctx, spec) {
    spec = spec || {};
    injectCss();
    const meta = (() => { try { return (HW.games || []).find((x) => x && x.id === ctx.gameId) || {}; } catch (e) { return {}; } })();
    const gameName = spec.name || meta.name || '';
    let gameIcon = spec.icon || meta.icon || '';
    if (!gameIcon) {   // HW.games 不带 icon：从核心顶栏（2.0 街机顶栏 .hw-arcname / 1.0 练习顶栏 .hw-playname）读注册时的 icon
      try {
        const host = ctx.el.parentElement;
        const n = host && host.querySelector('.hw-arcname [aria-hidden="true"], .hw-playname [aria-hidden="true"]');
        if (n && n.textContent.trim()) gameIcon = n.textContent.trim();
      } catch (e) { /* ignore */ }
    }
    if (!gameIcon) gameIcon = SKILL_ICON[meta.skill] || '🎮';
    const maxLevel = Math.max(1, Math.floor(+spec.maxLevel || 10));

    /* ---------- 状态 ---------- */
    let state = 'intro', phase = 'select', inited = false, ended = false, finished = false, dead = false, errored = false, endCalled = false;
    let raf = 0, lastTs = 0, bt = 0, needLayout = true, dirty = true, frameN = 0, lastTop = 0;
    let timers = [], tweens = [];
    let cdT = 0, cdStep = -1, overT = 0, endShown = false, result = null, endInfo = null, starPops = 0;
    let endScoreNode = null;
    const END_SKIP_T = 1.1;   // 结束后多少秒起，点一下 / Enter 才能跳过结算动画（面板 0.5 秒出现）
    let shownScore = 0, shownProg = 0, scoreBump = 0, comboBump = 0, capT = 0, capText = '', speaking = 0, sayWave = 0;
    let musicOn = !!spec.music, musicStyle = spec.music || 'bright';
    let activeId = null, pool = null;
    const heartFx = [];
    const H = { s: 1, pad: 8, rowY: 8, rowH: 40, cy: 28, pauseR: 20, pauseX: 0 };
    const fx = makeFx();
    const sky = makeSky();
    const osTimers = new Set();

    /* ---------- DOM ---------- */
    const root = el('div', 'arc-root');
    root.setAttribute('data-arc', ctx.gameId || '');
    const cv = el('canvas', 'arc-cv');
    cv.tabIndex = 0; cv.setAttribute('role', 'img'); cv.setAttribute('aria-label', (gameName || '游戏') + ' 画面');
    const layer = el('div', 'arc-dom is-off');
    const pbtn = el('button', 'arc-pbtn', '暂停');
    pbtn.type = 'button'; pbtn.setAttribute('aria-label', '暂停'); pbtn.hidden = true;
    const ov = el('div', 'arc-ov'); ov.hidden = true;
    const live = el('div', 'arc-live'); live.setAttribute('aria-live', 'polite');
    root.append(cv, layer, pbtn, ov, live);
    try { ctx.el.classList.add('arc-host'); ctx.el.replaceChildren(root); } catch (e) { ctx.el.appendChild(root); }
    const c2 = cv.getContext('2d', { alpha: true });

    /* ---------- g ---------- */
    const g = {
      w: 0, h: 0, dpr: 1, hudTop: 58, t: 0, level: 1, maxLevel, state: 'intro', ctx, G: ctx.G || {}, grade: ctx.grade, gradeNum: ctx.gradeNum,
      isReview: !!(ctx.review && ctx.review.length),
      score: 0, lives: 0, maxLives: 0, combo: 0, maxCombo: 0, done: 0, rounds: 1, wrongs: 0, misses: 0,
      sky: spec.sky === undefined ? 'day' : spec.sky, bgSpeed: 1, horizon: 0, roadLanes: 3, roadSpeed: 7, road: sky.road,
      held: { left: false, right: false, up: false, down: false, space: false, enter: false },
      speaking: false, c: c2, ease: EASE, frameMs: 0
    };
    const setState = (s) => { state = s; g.state = s; };
    const inst = { id: ctx.gameId || '', g, fx };
    LIVE.add(inst);
    const roundsFor = (lv) => { const r = typeof spec.rounds === 'function' ? spec.rounds(lv) : spec.rounds; const n = Math.floor(+r); return n > 0 ? n : 8; };

    function call(fn, a, b) {
      if (typeof fn !== 'function' || dead || errored) return !errored;
      try { fn.call(spec, g, a, b); return true; } catch (e) { fail(e); return false; }
    }
    function safe(fn) { try { fn(); } catch (e) { fail(e); } }
    function fail(e) {
      if (errored || dead) return;
      errored = true;
      try { console.error('[HW.arcade] 游戏 ' + (ctx.gameId || '') + ' 出错：', e); } catch (x) { /* ignore */ }
      musicStop();
      try { ctx.tts.stop(); } catch (x) { /* ignore */ }
      showError();
      dirty = true;
    }
    function say(text) { live.textContent = ''; live.textContent = String(text); }

    /* ---------- 定时 / 补间（游戏时钟） ---------- */
    function after(sec, fn) {
      const tm = { t: Math.max(0, +sec || 0), fn, dead: false, cancel() { this.dead = true; } };
      if (typeof fn === 'function' && !dead) timers.push(tm); else tm.dead = true;
      return tm;
    }
    function runTimers(dt) {
      const arr = timers, n = arr.length;
      if (!n) return;
      for (let i = 0; i < n; i++) {
        const tm = arr[i];
        if (tm.dead) continue;
        tm.t -= dt;
        if (tm.t <= 0) { tm.dead = true; call(tm.fn); if (dead || arr !== timers) return; }
      }
      let j = 0;
      for (let i = 0; i < arr.length; i++) if (!arr[i].dead) arr[j++] = arr[i];
      arr.length = j;
    }
    function tween(obj, props, sec, ease, onDone) {
      const tw = { obj, k: [], a: [], b: [], t: 0, d: Math.max(0.0001, +sec || 0), e: typeof ease === 'function' ? ease : (EASE[ease] || EASE.outQuad), done: onDone, dead: false, cancel() { this.dead = true; } };
      if (obj && props) for (const k in props) { const v = +props[k]; if (Number.isFinite(v)) { tw.k.push(k); tw.a.push(+obj[k] || 0); tw.b.push(v); } }
      if (dead || !obj) tw.dead = true; else tweens.push(tw);
      return tw;
    }
    function runTweens(dt) {
      const arr = tweens, n = arr.length;
      if (!n) return;
      for (let i = 0; i < n; i++) {
        const tw = arr[i];
        if (tw.dead) continue;
        tw.t += dt;
        const p = tw.t >= tw.d ? 1 : tw.t / tw.d, e = tw.e(p);
        for (let q = 0; q < tw.k.length; q++) tw.obj[tw.k[q]] = tw.a[q] + (tw.b[q] - tw.a[q]) * e;
        if (p >= 1) { tw.dead = true; if (tw.done) { call(tw.done); if (dead || arr !== tweens) return; } }
      }
      let j = 0;
      for (let i = 0; i < arr.length; i++) if (!arr[i].dead) arr[j++] = arr[i];
      arr.length = j;
    }
    function clearLevel() {
      timers.forEach((t) => { t.dead = true; }); tweens.forEach((t) => { t.dead = true; });
      timers = []; tweens = [];
      fx.clear();
    }
    function osTimeout(fn, ms) { const id = setTimeout(() => { osTimers.delete(id); if (!dead) fn(); }, ms); osTimers.add(id); return id; }

    /* ---------- 存档 ---------- */
    function memGet() {
      let m = null;
      try { m = ctx.mem.get('arc'); } catch (e) { m = null; }
      if (!m || typeof m !== 'object') m = {};
      return {
        lv: clamp(Math.floor(+m.lv || 1), 1, maxLevel),
        best: m.best && typeof m.best === 'object' && !Array.isArray(m.best) ? m.best : {},
        hi: Math.max(0, Math.floor(+m.hi || 0)),
        last: m.last && typeof m.last === 'object' ? m.last : null
      };
    }
    function memSave(win, stars) {
      const m = memGet(), prevHi = m.hi;
      let unlocked = 0;
      if (win) {
        const k = String(g.level);
        m.best[k] = Math.max(+m.best[k] || 0, stars);
        if (stars >= 2 && g.level < maxLevel && m.lv < g.level + 1) { m.lv = g.level + 1; unlocked = m.lv; }
      }
      const newHi = g.score > prevHi && g.score > 0;
      if (newHi) m.hi = g.score;
      m.last = { lv: g.level, score: g.score, stars, win: !!win, unlocked };
      try { ctx.mem.set('arc', m); } catch (e) { /* ignore */ }
      return { unlocked, newHi, prevHi };
    }
    /* 结束后（结算动画期间）又加了分：只更新存档里的 hi / last.score 与结算面板上的分数 */
    function patchEndScore() {
      if (!endInfo) return;
      const m = memGet();
      if (g.score > m.hi) { m.hi = g.score; endInfo.newHi = g.score > endInfo.prevHi; }
      if (m.last && m.last.lv === g.level) m.last.score = g.score;
      try { ctx.mem.set('arc', m); } catch (e) { /* ignore */ }
      if (endScoreNode) endScoreNode.textContent = String(g.score);
    }
    function defaultLevel(m) {
      const L = m.last;
      if (L && L.lv) {
        if (L.win && L.stars >= 2 && L.lv + 1 <= m.lv) return L.lv + 1;
        return clamp(Math.floor(+L.lv) || 1, 1, m.lv);
      }
      return m.lv;
    }

    /* ---------- 布局 ---------- */
    function hudLayout() {
      const s = clamp(g.w / 390, 0.9, 1.25);
      H.s = s; H.pad = 8 * s; H.rowY = 8 * s; H.rowH = 40 * s; H.cy = H.rowY + H.rowH / 2;
      H.pauseR = 20 * s; H.pauseX = g.w - H.pad - H.pauseR;
      g.hudTop = Math.round(H.rowY + H.rowH + 10 * s);
      pbtn.style.left = Math.round(H.pauseX - 26) + 'px';
      pbtn.style.top = Math.round(H.cy - 26) + 'px';
      pbtn.style.right = 'auto';
    }
    function docTop() { return root.getBoundingClientRect().top + (W.scrollY || W.pageYOffset || 0); }
    function layout() {
      needLayout = false;
      const vw = D.documentElement.clientWidth || W.innerWidth || 390;
      const vh = W.innerHeight || 700;
      const bleed = vw < 640;
      root.classList.toggle('is-bleed', bleed);
      let w;
      if (bleed) {
        root.style.marginLeft = '0px';
        const hr = ctx.el.getBoundingClientRect();
        root.style.marginLeft = (-Math.round(hr.left)) + 'px';
        w = vw;
      } else {
        root.style.marginLeft = '0px';
        w = Math.round(ctx.el.clientWidth || ctx.el.getBoundingClientRect().width || vw);
      }
      w = Math.max(280, w);
      root.style.width = w + 'px';
      const top = docTop();
      lastTop = top;
      const h = Math.max(480, Math.floor(vh - top - (bleed ? 0 : 10)));
      root.style.height = h + 'px';
      const dpr = Math.min(2, Math.max(1, W.devicePixelRatio || 1));
      if (w === g.w && h === g.h && dpr === g.dpr) return;
      setDpr(dpr);
      g.w = w; g.h = h; g.dpr = dpr;
      cv.width = Math.round(w * dpr); cv.height = Math.round(h * dpr);
      cv.style.width = w + 'px'; cv.style.height = h + 'px';
      hudLayout();
      sky.layout(w, h, g.hudTop);
      g.horizon = sky.horizonOf(g.sky || 'day');
      if (inited) call(spec.resize);
      dirty = true;
    }

    /* ---------- 覆盖层（DOM，真按钮） ---------- */
    function setOv(node, dim) {
      ov.replaceChildren();
      ov.className = 'arc-ov' + (dim ? ' dim' : '');
      if (node) { ov.appendChild(node); ov.hidden = false; } else ov.hidden = true;
    }
    function panel(title, tag) {
      const p = el('div', 'arc-panel');
      const r = el('div', 'arc-ribbon', title);
      if (tag) r.appendChild(el('small', null, tag));
      p.appendChild(r);
      return p;
    }
    function starsRow(n, cls) {
      const row = el('div', cls || 'arc-stars');
      row.setAttribute('role', 'img'); row.setAttribute('aria-label', n + ' 颗星');
      for (let i = 0; i < 3; i++) row.appendChild(el('span', 'arc-star' + (i < n ? ' on' : ''), '★'));
      return row;
    }
    let selLv = 1, hintUsed = false;
    function showSelect() {
      setState('intro'); phase = 'select';
      layer.classList.add('is-off'); pbtn.hidden = true;
      const m = memGet();
      selLv = defaultLevel(m);
      // 核心结算页“下一关 / 再玩一次”带来的建议关卡（ctx.levelHint，只在本局第一次选关时用；不能超过已解锁）
      const hint = Math.floor(+ctx.levelHint || 0);
      if (hint >= 1 && !hintUsed) { hintUsed = true; selLv = clamp(hint, 1, m.lv); }
      g.level = selLv;
      const p = panel(gameName || '开始游戏', g.isReview ? '错题重练' : '');
      const icon = el('div', 'arc-icon', gameIcon); icon.setAttribute('aria-hidden', 'true');
      const blurb = el('p', 'arc-blurb', spec.intro || '');
      const prev = btn('round blue', '◀\uFE0E', () => pickLv(-1), '上一关');
      const next = btn('round blue', '▶\uFE0E', () => pickLv(1), '下一关');
      const lv = el('div', 'arc-lv');
      const ln = el('div', 'arc-lv-n');
      const num = el('b', null, selLv);
      ln.append(el('span', null, '第'), num, el('span', null, '关'));
      let st = starsRow(0);
      lv.append(ln, st);
      const row = el('div', 'arc-lvrow'); row.append(prev, lv, next);
      const dots = el('div', 'arc-dots');
      { const per = maxLevel <= 6 ? maxLevel : Math.min(8, Math.ceil(maxLevel / 2));   // 手机上 40px 圆点：10 关排成 5×2
        dots.style.maxWidth = (per * 40 + (per - 1) * 8) + 'px'; }
      const dotBtns = [];
      for (let i = 1; i <= maxLevel; i++) {
        const d = el('button', 'arc-dot', i); d.type = 'button';
        d.addEventListener('click', () => { if (i <= m.lv) { selLv = i; refresh(); playSfx('tick'); } });
        dots.appendChild(d); dotBtns.push(d);
      }
      const go = btn('go', '开始！', () => begin(selLv), '开始第几关');
      p.append(icon, blurb, row, dots, go);
      if (spec.controls) p.appendChild(el('p', 'arc-ctrl', '🎮 ' + spec.controls));
      if (m.hi > 0) p.appendChild(el('p', 'arc-hi', '🏆 最高分 ' + m.hi));
      function refresh() {
        num.textContent = selLv; g.level = selLv;
        const ns = starsRow(+m.best[selLv] || 0); st.replaceWith(ns); st = ns;
        prev.disabled = selLv <= 1; next.disabled = selLv >= m.lv;
        dotBtns.forEach((d, i) => {
          const n = i + 1;
          d.className = 'arc-dot' + (n === selLv ? ' cur' : (+m.best[n] || 0) > 0 ? ' won' : n <= m.lv ? ' open' : ' lock');
          d.disabled = n > m.lv;
          d.setAttribute('aria-label', '第' + n + '关' + (n > m.lv ? '（还没解锁）' : ''));
          d.textContent = n > m.lv ? '🔒' : n;
        });
        go.setAttribute('aria-label', '开始第 ' + selLv + ' 关');
      }
      function pickLv(d) { const n = clamp(selLv + d, 1, m.lv); if (n !== selLv) { selLv = n; refresh(); playSfx('tick'); } }
      showSelect.pick = pickLv;
      refresh();
      setOv(p, false);
      try { go.focus({ preventScroll: true }); } catch (e) { /* ignore */ }
      dirty = true;
    }
    function begin(lv) {
      if (dead || phase !== 'select') return;
      audio();
      playSfx('pop');
      startLevel(lv);
    }
    function showCountdown() {
      setState('intro'); phase = 'count'; cdT = 0; cdStep = -1;
      layer.classList.remove('is-off'); pbtn.hidden = true;
      const box = el('div', null);
      // width:100%：说明框的 max-width 百分比要相对整个遮罩算，否则会被挤成很窄、提前折行
      box.style.cssText = 'display:flex;flex-direction:column;align-items:center;gap:14px;width:100%';
      const numBox = el('div', null); numBox.style.cssText = 'height:clamp(120px,36vw,180px);display:grid;place-items:center';
      box.appendChild(numBox);
      if (spec.intro) box.appendChild(el('div', 'arc-cd-t', spec.intro));
      if (spec.controls) box.appendChild(el('div', 'arc-cd-c', spec.controls));
      const wrap = el('div', 'arc-cd'); wrap.style.cssText = 'display:contents';
      wrap.appendChild(box);
      setOv(wrap, false);
      ov.classList.add('arc-cd');
      showCountdown.num = numBox;
      if (musicOn) musicStart(musicStyle);
      say('第 ' + g.level + ' 关，准备');
    }
    function countTick(dt) {
      cdT += dt;
      const step = cdT < 0.62 ? 0 : cdT < 1.24 ? 1 : cdT < 1.86 ? 2 : cdT < 2.5 ? 3 : 4;
      if (step === cdStep) return;
      cdStep = step;
      if (step === 4) { beginPlay(); return; }
      const n = showCountdown.num;
      if (!n) return;
      const d = el('div', 'arc-cd-n' + (step === 3 ? ' go' : ''), step === 3 ? '开始！' : String(3 - step));
      n.replaceChildren(d);
      playSfx(step === 3 ? 'go' : 'tick');
    }
    function beginPlay() {
      setOv(null);
      setState('play'); phase = 'play';
      pbtn.hidden = false;
      try { cv.focus({ preventScroll: true }); } catch (e) { /* ignore */ }
      say('开始');
      call(spec.play);
    }
    function pause() {
      if (state !== 'play' || dead || errored) return;   // 出错面板上不能再叠暂停面板（继续会失效）
      setState('pause');
      musicStop();
      try { ctx.tts.stop(); } catch (e) { /* ignore */ }
      for (const k in g.held) g.held[k] = false;
      activeId = null;
      pbtn.hidden = true;
      const p = panel('暂停一下');
      p.appendChild(el('div', 'arc-lv-n', '第 ' + g.level + ' 关 · ' + g.done + '/' + g.rounds));
      const b1 = btn('go wide', '▶\uFE0E 继续', resume);
      const b2 = btn('blue wide', '↻ 重玩本关', () => { setOv(null); playSfx('pop'); startLevel(g.level); });
      const b3 = btn('red wide', '✕ 退出', exitGame);
      b1.style.animation = 'none';
      p.append(b1, b2, b3);
      const wrap = el('div', 'arc-pause'); wrap.style.cssText = 'display:contents';
      wrap.appendChild(p);
      setOv(wrap, true);
      try { b1.focus({ preventScroll: true }); } catch (e) { /* ignore */ }
      say('暂停');
      dirty = true;
    }
    function resume() {
      if (state !== 'pause' || dead || errored) return;
      setOv(null);
      setState('play');
      pbtn.hidden = false;
      audio();
      if (musicOn) musicStart(musicStyle);
      lastTs = 0;
      try { cv.focus({ preventScroll: true }); } catch (e) { /* ignore */ }
      say('继续');
    }
    function exitGame() {
      if (dead) return;
      try {
        if (typeof HW.goMap === 'function') { HW.goMap(); return; }
        if (typeof HW.exit === 'function') { HW.exit(); return; }
      } catch (e) { /* ignore */ }
      const b = D.getElementById('hw-exit');
      if (b) { b.click(); if (ctx.alive() && !dead) b.click(); }
      if (ctx.alive() && !dead) finishNow(result || curResult(false));
    }
    function showError() {
      pbtn.hidden = true;
      const p = panel('哎呀');
      p.appendChild(el('p', 'arc-blurb', '这个游戏出了点小问题，先回去玩别的吧。'));
      p.appendChild(btn('red wide', '✕ 退出', exitGame));
      setOv(p, true);
    }
    function showEnd() {
      endShown = true;
      const win = result.win;
      const box = el('div', null);
      box.style.cssText = 'display:flex;flex-direction:column;align-items:center;gap:14px;width:100%';
      box.appendChild(el('div', 'arc-end-t' + (win ? '' : ' lose'), win ? '过关啦！' : '再试一次！'));
      if (win) {
        const row = el('div', 'arc-end-stars');
        for (let i = 0; i < 3; i++) {
          const s = el('span', 'arc-star' + (i < result.stars ? ' on' : ''), '★');
          s.style.animationDelay = (0.35 + i * 0.3) + 's';
          row.appendChild(s);
        }
        row.setAttribute('role', 'img'); row.setAttribute('aria-label', result.stars + ' 颗星');
        box.appendChild(row);
      } else {
        const hb = el('div', 'arc-end-stars'); hb.textContent = '💔'; hb.style.animation = 'arc-bob 1.2s ease-in-out infinite';
        box.appendChild(hb);
      }
      const sc = el('div', 'arc-end-sc');
      endScoreNode = document.createTextNode(String(g.score));
      sc.append(el('span', null, '得分'), endScoreNode);
      box.appendChild(sc);
      box.appendChild(el('div', 'arc-cd-c', '答对 ' + result.correct + ' / ' + result.total + (g.maxCombo >= 3 ? ' · 最多连击 ' + g.maxCombo : '')));
      if (endInfo.newHi) box.appendChild(el('div', 'arc-end-new', '新纪录！'));
      else if (endInfo.unlocked) box.appendChild(el('div', 'arc-end-new', '解锁第 ' + endInfo.unlocked + ' 关！'));
      box.appendChild(el('div', 'arc-end-skip', '点一下继续'));
      const wrap = el('div', null); wrap.style.cssText = 'display:contents';
      wrap.appendChild(box);
      setOv(wrap, true);
      ov.style.cursor = 'pointer';
      // 孩子常常还在狂点：结算面板出现后 0.6 秒内的点击不算“跳过”，免得庆祝画面一闪而过
      ov.onclick = () => { if (overT >= END_SKIP_T) finishNow(result); };
      ov.tabIndex = -1;
      try { ov.focus({ preventScroll: true }); } catch (e) { /* ignore */ }
      say((win ? '过关，' + result.stars + ' 颗星' : '失败了') + '，得分 ' + g.score);
    }
    function curResult(win) {
      const correct = g.done;
      const total = win ? g.done + g.wrongs : Math.max(g.rounds, g.done + g.wrongs);
      let stars = total ? starsFor(correct / total) : (win ? 3 : 0);
      stars = win ? Math.max(1, stars) : Math.min(1, stars);
      return { correct, total: Math.max(total, correct), stars, win: !!win };
    }
    function endLevel(win) {
      if (ended || state !== 'play' || dead || errored) return;
      ended = true;
      setState('over'); overT = 0; endShown = false; starPops = 0;
      pbtn.hidden = true; activeId = null;
      for (const k in g.held) g.held[k] = false;
      musicStop();
      result = curResult(win);
      endInfo = memSave(win, result.stars);
      if (win) { playSfx('win'); fx.confetti(g.w); fx.flashCol = '#FFF6C0'; fx.flashA = 0.45; }
      else { playSfx('lose'); fx.shake = Math.max(fx.shake, 8); }
    }
    function overTick(dt) {
      overT += dt;
      if (!endShown && overT >= 0.5) showEnd();
      if (result && result.win && endShown) {
        const due = overT >= 0.85 + starPops * 0.3 && starPops < result.stars;
        if (due) { starPops++; playSfx('star'); }
      }
      if (overT >= (result && result.win ? 3.2 : 2.6)) finishNow(result);
    }
    function finishNow(r) {
      if (finished || dead) return;
      finished = true;
      // correct/total/stars 是 SPEC 契约；level/score/win 供核心结算页显示“第 N 关 · 得分”（核心不认识的字段会忽略）
      const out = { correct: r.correct, total: r.total, stars: r.stars, level: g.level, score: g.score, win: !!r.win };
      try { ctx.finish(out); } catch (e) { try { console.error('[HW.arcade] finish', e); } catch (x) { /* ignore */ } }
      if (!ctx.alive()) destroy();
    }
    function startLevel(lv) {
      if (dead) return;
      clearLevel();
      g.level = clamp(Math.floor(+lv) || 1, 1, maxLevel);
      g.t = 0; g.score = 0; g.combo = 0; g.maxCombo = 0; g.done = 0; g.wrongs = 0; g.misses = 0;
      g.maxLives = Math.max(0, spec.lives == null ? 3 : Math.floor(+spec.lives) || 0); g.lives = g.maxLives;
      g.rounds = roundsFor(g.level);
      g.sky = spec.sky === undefined ? 'day' : spec.sky; g.bgSpeed = 1; g.roadLanes = 3;
      shownScore = 0; shownProg = 0; scoreBump = 0; comboBump = 0; capT = 0;
      heartFx.length = 0; for (let i = 0; i < g.maxLives; i++) heartFx.push(-1);
      ended = false; finished = false; result = null; endInfo = null; endScoreNode = null;
      ov.onclick = null; ov.style.cursor = '';
      for (const k in g.held) g.held[k] = false;
      inited = false;
      if (!call(spec.init)) return;
      inited = true;
      if (!(g.rounds > 0)) g.rounds = 1;
      g.horizon = sky.horizonOf(g.sky || 'day');
      showCountdown();
    }

    /* ---------- HUD（画在画布上） ---------- */
    function hudTick(dt) {
      const d = g.score - shownScore;
      if (d !== 0) shownScore = Math.abs(d) < 1 ? g.score : shownScore + d * Math.min(1, dt * 9) + Math.sign(d) * dt * 20;
      if ((d > 0 && shownScore > g.score) || (d < 0 && shownScore < g.score)) shownScore = g.score;
      const pr = g.rounds > 0 ? clamp(g.done / g.rounds, 0, 1) : 0;
      shownProg += (pr - shownProg) * Math.min(1, dt * 7);
      if (scoreBump > 0) scoreBump = Math.max(0, scoreBump - dt * 4);
      if (comboBump > 0) comboBump = Math.max(0, comboBump - dt * 3.5);
      for (let i = 0; i < heartFx.length; i++) if (heartFx[i] >= 0) { heartFx[i] += dt; if (heartFx[i] > 0.8) heartFx[i] = -1; }
      if (capT > 0) capT = Math.max(0, capT - dt);
      sayWave += dt;
    }
    function drawHeart(c, x, y, sz, full, s) {
      heartPath(c, x, y + 2 * s, sz); c.fillStyle = 'rgba(15,25,60,.45)'; c.fill();
      heartPath(c, x, y, sz);
      if (full) {
        c.fillStyle = '#F2344E'; c.fill();
        c.lineWidth = 2.6 * s; c.strokeStyle = NAVY; c.stroke();
        c.fillStyle = 'rgba(255,255,255,.75)'; c.beginPath(); c.ellipse(x - sz * 0.2, y - sz * 0.14, sz * 0.12, sz * 0.08, -0.6, 0, TAU); c.fill();
      } else {
        c.fillStyle = 'rgba(20,32,70,.5)'; c.fill();
        c.lineWidth = 2.2 * s; c.strokeStyle = 'rgba(255,255,255,.55)'; c.stroke();
      }
    }
    function drawHud(c) {
      const s = H.s, cy = H.cy, pad = H.pad;
      // 先算右侧分数牌的位置（中间进度条要让位）
      const scoreStr = String(Math.round(shownScore));
      const fs = Math.round(22 * s);
      const tw = digitsWidth(scoreStr, fs);
      const pw = Math.max(70 * s, tw + 46 * s), ph = 32 * s;
      const sx = H.pauseX - H.pauseR - 8 * s - pw, sy = cy - ph / 2;
      // 左：红心。心多 / 屏窄 / 分数长时进度条会被挤没 → 改成“一颗心 ×N”的紧凑样式
      let x = pad + 14 * s;
      const compact = g.maxLives > 1 && (sx - 10 * s) - (pad + g.maxLives * 29 * s) < 110 * s;
      if (g.maxLives > 0 && compact) {
        let sz = 25 * s, hfMax = -1;
        for (let i = 0; i < heartFx.length; i++) if (heartFx[i] > hfMax) hfMax = heartFx[i];
        if (g.lives === 1) sz *= 1 + 0.14 * Math.max(0, Math.sin(bt * 9));
        if (hfMax >= 0) sz *= 1 + 0.25 * Math.sin(Math.min(1, hfMax / 0.4) * Math.PI);
        drawHeart(c, x, cy, sz, g.lives > 0, s);
        const w2 = drawText(c, '×' + g.lives, x + 15 * s, cy + 1.5 * s, { size: Math.round(19 * s), font: 'num', color: '#FFFFFF', stroke: NAVY, strokeW: 3 * s, align: 'left' });
        x += 15 * s + w2;
      } else if (g.maxLives > 0) {
        for (let i = 0; i < g.maxLives; i++) {
          const full = i < g.lives;
          let sz = 25 * s;
          if (full && g.lives === 1) sz *= 1 + 0.14 * Math.max(0, Math.sin(bt * 9));
          drawHeart(c, x, cy, sz, full, s);
          const hf = heartFx[i];
          if (hf != null && hf >= 0) {
            const k = hf / 0.8;
            c.globalAlpha = 1 - k;
            heartPath(c, x, cy - k * 16 * s, sz * (1 + k * 1.2)); c.fillStyle = '#FF5A6E'; c.fill();
            c.globalAlpha = 1;
          }
          x += 29 * s;
        }
        x -= 14 * s;
      } else x = pad;
      // 右：暂停钮 + 分数
      const pr = H.pauseR, px0 = H.pauseX;
      c.fillStyle = NAVY; c.beginPath(); c.arc(px0, cy + 4 * s, pr, 0, TAU); c.fill();
      c.fillStyle = '#3AA0FF'; c.beginPath(); c.arc(px0, cy, pr, 0, TAU); c.fill();
      c.lineWidth = 3 * s; c.strokeStyle = NAVY; c.stroke();
      c.fillStyle = 'rgba(255,255,255,.35)'; c.beginPath(); c.ellipse(px0, cy - pr * 0.45, pr * 0.62, pr * 0.3, 0, 0, TAU); c.fill();
      c.fillStyle = '#FFFFFF';
      rrect(c, px0 - 7 * s, cy - 8 * s, 5 * s, 16 * s, 1.5 * s, '#FFFFFF');
      rrect(c, px0 + 2 * s, cy - 8 * s, 5 * s, 16 * s, 1.5 * s, '#FFFFFF');
      rrect(c, sx, sy + 3 * s, pw, ph, ph / 2, NAVY);
      rrect(c, sx, sy, pw, ph, ph / 2, '#FFFBEF', NAVY, 2.6 * s);
      const coin = coinSprite(), cs = 28 * s * (1 + scoreBump * 0.25);
      c.drawImage(coin.cv, sx + 15 * s - cs / 2, cy - cs / 2, cs, cs);
      drawDigits(c, scoreStr, sx + pw - 12 * s, cy + 1.5 * s, fs, NAVY, 1 + scoreBump * 0.18);
      // 连击火焰
      if (g.combo >= 3) {
        const col = g.combo >= 10 ? '#A64DFF' : g.combo >= 6 ? '#FF3D3D' : '#FF8A1C';
        const txt = '连击×' + g.combo;
        const cf = Math.round(15 * s);
        const cw = measure(txt, cf, 'round') + 34 * s, chh = 24 * s;
        const bx = sx + pw - cw, by = sy + ph + 5 * s;
        const k = 1 + comboBump * 0.3;
        c.save(); c.translate(bx + cw / 2, by + chh / 2); c.scale(k, k);
        rrect(c, -cw / 2, -chh / 2 + 2 * s, cw, chh, chh / 2, NAVY);
        rrect(c, -cw / 2, -chh / 2, cw, chh, chh / 2, col, NAVY, 2.2 * s);
        drawEmoji(c, '🔥', -cw / 2 + 12 * s, -2 * s + Math.sin(bt * 20) * 0.8 * s, 20 * s * (1 + 0.1 * Math.sin(bt * 14)));
        drawText(c, txt, 7 * s, 1 * s, { size: cf, font: 'round', color: '#FFFFFF', stroke: NAVY, strokeW: 3 * s });
        c.restore();
      }
      // 中：关卡号 + 进度条
      let bl = x + 10 * s, br = sx - 10 * s;
      const maxBar = 320 * s;
      if (br - bl > maxBar) { const mid = Math.max(g.w / 2, bl + maxBar / 2); bl = Math.min(mid, br - maxBar / 2) - maxBar / 2; br = bl + maxBar; }
      if (br - bl > 70 * s) {
        const r = 17 * s, bcx = bl + r;
        const tl = bcx + r - 4 * s, tw2 = br - tl, th = 18 * s;
        rrect(c, tl, cy - th / 2 + 3 * s, tw2, th, th / 2, NAVY);
        rrect(c, tl, cy - th / 2, tw2, th, th / 2, 'rgba(20,32,70,.55)', NAVY, 2.4 * s);
        const fw = Math.max(0, (tw2 - 6 * s) * shownProg);
        if (fw > 2) {
          rrect(c, tl + 3 * s, cy - th / 2 + 3 * s, Math.max(th - 6 * s, fw), th - 6 * s, (th - 6 * s) / 2, '#FFC928');
          rrect(c, tl + 3 * s, cy - th / 2 + 3 * s, Math.max(th - 6 * s, fw), (th - 6 * s) * 0.45, (th - 6 * s) * 0.22, 'rgba(255,255,255,.55)');
        }
        drawText(c, Math.min(g.done, g.rounds) + '/' + g.rounds, tl + tw2 / 2 + 6 * s, cy + 1 * s, { size: Math.round(13 * s), font: 'num', color: '#FFFFFF', stroke: NAVY, strokeW: 3 * s });
        c.fillStyle = NAVY; c.beginPath(); c.arc(bcx, cy + 3 * s, r, 0, TAU); c.fill();
        c.fillStyle = '#FF7A3D'; c.beginPath(); c.arc(bcx, cy, r, 0, TAU); c.fill();
        c.lineWidth = 2.6 * s; c.strokeStyle = NAVY; c.stroke();
        drawText(c, String(g.level), bcx, cy + 1.5 * s, { size: Math.round(19 * s), font: 'num', color: '#FFFFFF', stroke: NAVY, strokeW: 3 * s });
      }
      // 朗读中：小喇叭声波
      if (g.speaking) {
        const hx = pad + 16 * s, hy = g.hudTop + 16 * s;
        rrect(c, hx - 15 * s, hy - 15 * s, 30 * s, 30 * s, 15 * s, 'rgba(255,251,239,.92)', NAVY, 2 * s);
        drawEmoji(c, '🔊', hx, hy, 18 * s);
        c.strokeStyle = '#FFFFFF'; c.lineWidth = 2.5 * s; c.lineCap = 'round';
        for (let i = 0; i < 2; i++) {
          const k = (sayWave * 1.6 + i * 0.5) % 1;
          c.globalAlpha = 1 - k;
          c.beginPath(); c.arc(hx, hy, 17 * s + k * 14 * s, -0.7, 0.7); c.stroke();
        }
        c.globalAlpha = 1;
      }
    }
    function drawCaption(c) {
      if (capT <= 0 || !capText) return;
      const s = H.s, a = Math.min(1, capT / 0.25, (1.5 - capT) / 0.15 + 0.2);
      const fs = Math.round(20 * s);
      const maxW = g.w - 40 * s;
      const tw = Math.min(maxW - 50 * s, measure(capText, fs, 'py'));
      const bw = tw + 60 * s, bh = 42 * s, bx = g.w / 2 - bw / 2, by = g.hudTop + 4 * s;
      c.globalAlpha = clamp(a, 0, 1);
      rrect(c, bx, by + 3 * s, bw, bh, bh / 2, NAVY);
      rrect(c, bx, by, bw, bh, bh / 2, 'rgba(29,43,83,.92)', '#FFFFFF', 2.5 * s);
      drawEmoji(c, '🔊', bx + 22 * s, by + bh / 2, 20 * s);
      drawText(c, capText, bx + 38 * s, by + bh / 2 + 1, { size: fs, font: 'py', color: '#FFFFFF', align: 'left', maxW: bw - 52 * s });
      c.globalAlpha = 1;
    }

    /* ---------- 渲染 / 主循环 ---------- */
    function render() {
      const c = c2, dpr = g.dpr;
      c.setTransform(1, 0, 0, 1, 0, 0);
      c.globalAlpha = 1; c.globalCompositeOperation = 'source-over';
      const skyName = inited ? g.sky : (g.sky || 'day');
      if (!skyName) c.clearRect(0, 0, cv.width, cv.height);
      const ox = fx.ox, oy = fx.oy;
      c.setTransform(dpr, 0, 0, dpr, dpr * ox, dpr * oy);
      sky.lanes = Math.max(1, Math.floor(+g.roadLanes) || 3);
      sky.road.lanes = sky.lanes;
      g.roadSpeed = 7 * (+g.bgSpeed || 0);
      if (skyName) sky.draw(c, skyName, bt, +g.bgSpeed || 0);
      g.horizon = sky.horizonOf(skyName || '');
      if (inited && !errored) {
        c.save();
        call(spec.draw, c);
        c.restore();
        c.setTransform(dpr, 0, 0, dpr, dpr * ox, dpr * oy);
        c.globalAlpha = 1; c.globalCompositeOperation = 'source-over';
      }
      fx.drawWorld(c, dpr, ox, oy);
      c.setTransform(dpr, 0, 0, dpr, 0, 0);
      fx.drawFloats(c);
      if (inited) drawHud(c);
      drawCaption(c);
      fx.drawFlash(c, g.w, g.h);
    }
    function frame(ts) {
      raf = 0;
      if (dead) return;
      if (!ctx.alive()) { destroy(); return; }
      raf = requestAnimationFrame(frame);
      let dt = lastTs ? (ts - lastTs) / 1000 : 0;
      lastTs = ts;
      if (!(dt > 0)) dt = 0; else if (dt > 0.05) dt = 0.05;
      frameN++;
      if (needLayout || (frameN % 30 === 0 && Math.abs(docTop() - lastTop) > 1)) layout();
      audioTick();
      if (errored || state === 'pause') { if (dirty) { safe(render); dirty = false; } return; }
      const t0 = now();
      bt += dt;
      if (state === 'play') {
        g.t += dt;
        runTimers(dt); if (dead) return;
        runTweens(dt); if (dead) return;
        if (state === 'play') call(spec.update, dt);
        if (dead) return;
      } else if (state === 'over') {
        runTimers(dt); if (dead) return;
        runTweens(dt); if (dead) return;
        overTick(dt); if (dead) return;
      } else if (phase === 'count') countTick(dt);
      fx.update(dt);
      hudTick(dt);
      safe(render);
      dirty = false;
      g.frameMs = g.frameMs * 0.95 + (now() - t0) * 0.05;   // 调试用：每帧 update+draw 平均毫秒
    }

    /* ---------- 输入 ---------- */
    function ptr(e, down) {
      const r = cv.getBoundingClientRect();
      return { x: e.clientX - r.left, y: e.clientY - r.top, id: e.pointerId, down, type: e.pointerType || 'mouse' };
    }
    function onDown(e) {
      if (dead) return;
      if (AU.ac && AU.ac.state !== 'running') audio();
      if (e.cancelable) e.preventDefault();
      if (state !== 'play' || errored) return;
      if (activeId !== null && e.pointerId !== activeId) return;           // 第二根手指：忽略
      if (e.pointerType === 'mouse' && e.button > 0) return;
      activeId = e.pointerId;
      try { cv.setPointerCapture(e.pointerId); } catch (x) { /* ignore */ }
      call(spec.down, ptr(e, true));
    }
    function onMove(e) {
      if (dead || state !== 'play' || errored) return;
      if (activeId !== null) { if (e.pointerId === activeId) call(spec.move, ptr(e, true)); }
      else if (e.pointerType === 'mouse') call(spec.move, ptr(e, false));
    }
    function onUp(e) {
      if (e.pointerId !== activeId) return;
      activeId = null;
      if (dead || state !== 'play' || errored) return;
      call(spec.up, ptr(e, false));
    }
    const KEYMAP = { ArrowLeft: 'left', ArrowRight: 'right', ArrowUp: 'up', ArrowDown: 'down', ' ': 'space', Spacebar: 'space', Enter: 'enter', Left: 'left', Right: 'right', Up: 'up', Down: 'down' };
    function typing(t) { return !!(t && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName || ''))); }
    function onKey(e) {
      if (dead || e.ctrlKey || e.metaKey || e.altKey) return;
      if (typing(e.target)) return;
      if (!root.isConnected) return;
      const k = KEYMAP[e.key] || e.key;
      const esc = e.key === 'Escape' || e.key === 'Esc';
      const pk = e.key === 'p' || e.key === 'P';
      if (errored) { if (esc) { e.preventDefault(); e.stopPropagation(); exitGame(); } return; }
      if (state === 'play') {
        if (esc || pk) { e.preventDefault(); e.stopPropagation(); pause(); return; }
        if (KEYMAP[e.key]) e.preventDefault();
        if (k in g.held) g.held[k] = true;
        if (!e.repeat) call(spec.key, k);
      } else if (state === 'pause') {
        if (esc || pk) { e.preventDefault(); e.stopPropagation(); resume(); }
      } else if (phase === 'select') {
        if (esc) { e.preventDefault(); e.stopPropagation(); exitGame(); return; }   // 核心对街机不处理 Esc：选关界面 Esc = 退出
        if (k === 'left' || k === 'right') { e.preventDefault(); if (showSelect.pick) showSelect.pick(k === 'left' ? -1 : 1); }
        else if ((k === 'enter' || k === 'space') && !(e.target && e.target.closest && e.target.closest('button'))) { e.preventDefault(); begin(selLv); }
      } else if (state === 'over' && endShown && (k === 'enter' || k === 'space' || esc)) {
        e.preventDefault(); if (esc) e.stopPropagation();
        if (overT >= END_SKIP_T) finishNow(result);
      } else if (phase === 'count' && (KEYMAP[e.key])) e.preventDefault();
    }
    function onKeyUp(e) { const k = KEYMAP[e.key] || e.key; if (k in g.held) g.held[k] = false; }
    function onVis() { if (D.hidden && state === 'play') pause(); }
    function onResize() { needLayout = true; }
    function onOrient() { needLayout = true; osTimeout(() => { needLayout = true; }, 350); }
    function onFonts() { clearTextCaches(); dirty = true; }
    cv.addEventListener('pointerdown', onDown);
    cv.addEventListener('pointermove', onMove);
    cv.addEventListener('pointerup', onUp);
    cv.addEventListener('pointercancel', onUp);
    cv.addEventListener('contextmenu', (e) => e.preventDefault());
    pbtn.addEventListener('click', (e) => { e.preventDefault(); pause(); });
    W.addEventListener('keydown', onKey, true);
    W.addEventListener('keyup', onKeyUp, true);
    D.addEventListener('visibilitychange', onVis);
    W.addEventListener('pagehide', onVis);
    W.addEventListener('resize', onResize);
    W.addEventListener('orientationchange', onOrient);
    let ro = null;
    try { if (W.ResizeObserver) { ro = new ResizeObserver(onResize); ro.observe(ctx.el); } } catch (e) { ro = null; }
    try { if (D.fonts && D.fonts.addEventListener) D.fonts.addEventListener('loadingdone', onFonts); } catch (e) { /* ignore */ }
    try {
      if (D.fonts && D.fonts.load) {
        Promise.all([D.fonts.load('800 32px "Baloo 2"', '0123456789'), D.fonts.load('32px "ZCOOL KuaiLe"', '开始连击第关过啦再试一次')]).then(() => { if (!dead) onFonts(); }, () => {});
      }
    } catch (e) { /* ignore */ }

    function destroy() {
      if (dead) return;
      dead = true;
      LIVE.delete(inst);
      if (raf) cancelAnimationFrame(raf);
      raf = 0;
      cv.removeEventListener('pointerdown', onDown);
      cv.removeEventListener('pointermove', onMove);
      cv.removeEventListener('pointerup', onUp);
      cv.removeEventListener('pointercancel', onUp);
      W.removeEventListener('keydown', onKey, true);
      W.removeEventListener('keyup', onKeyUp, true);
      D.removeEventListener('visibilitychange', onVis);
      W.removeEventListener('pagehide', onVis);
      W.removeEventListener('resize', onResize);
      W.removeEventListener('orientationchange', onOrient);
      try { if (ro) ro.disconnect(); } catch (e) { /* ignore */ }
      try { if (D.fonts && D.fonts.removeEventListener) D.fonts.removeEventListener('loadingdone', onFonts); } catch (e) { /* ignore */ }
      osTimers.forEach((id) => clearTimeout(id)); osTimers.clear();
      musicStop(); musicDuck(false);
      try { ctx.tts.stop(); } catch (e) { /* ignore */ }
      timers.forEach((t) => { t.dead = true; }); tweens.forEach((t) => { t.dead = true; });
      timers = []; tweens = [];
      fx.clear();
      ov.onclick = null;
      if (!endCalled) { endCalled = true; if (typeof spec.end === 'function') { try { spec.end.call(spec, g); } catch (e) { try { console.error('[HW.arcade] end', e); } catch (x) { /* ignore */ } } } }
      setState('over');
      try { cv.width = 1; cv.height = 1; } catch (e) { /* ignore */ }
    }

    /* ---------- g 的方法 ---------- */
    const XY = (x, y) => [x == null ? g.w / 2 : x, y == null ? g.h / 2 : y];
    g.right = function (item, x, y, label) {
      if (state !== 'play' || ended || dead) return;
      const [X, Y] = XY(x, y);
      g.combo++; if (g.combo > g.maxCombo) g.maxCombo = g.combo;
      const mult = g.combo >= 10 ? 4 : g.combo >= 6 ? 3 : g.combo >= 3 ? 2 : 1, pts = 10 * mult;
      g.score += pts; scoreBump = 1; comboBump = 1;
      fx.burst(X, Y, { kind: 'star', n: 14 }); fx.burst(X, Y, { kind: 'coin', n: 5 + mult * 2 }); fx.burst(X, Y, { kind: 'spark', n: 10 });
      fx.ring(X, Y, '#FFE45C');
      fx.float(label != null ? label : '+' + pts, X, Y - 34, { color: '#FFE45C', size: 32 });
      if (g.combo === 3 || (g.combo >= 5 && g.combo % 5 === 0)) { fx.float('连击×' + g.combo + '！', g.w / 2, g.hudTop + 70, { color: g.combo >= 10 ? '#E3B3FF' : '#FFB347', size: 38, life: 1.3 }); playSfx('combo'); }
      playSfx('coin');
      try { if (arguments.length) ctx.score.right(item); else ctx.score.right(); } catch (e) { /* ignore */ }
      g.done++;
      if (g.done >= g.rounds) endLevel(true);
    };
    g.wrong = function (item, note, x, y) {
      if (state !== 'play' || ended || dead) return;
      const [X, Y] = XY(x, y);
      g.combo = 0; g.wrongs++;
      fx.float('✗', X, Y - 24, { color: '#FF5A5F', size: 50 });
      fx.burst(X, Y, { kind: 'dot', color: '#FF5A5F', n: 14 });
      g.shake(13); fx.flashCol = '#FF2E2E'; fx.flashA = Math.max(fx.flashA, 0.32);
      playSfx('hit');
      try { ctx.score.wrong(item, note); } catch (e) { /* ignore */ }
      if (g.maxLives > 0) {
        g.lives = Math.max(0, g.lives - 1);
        if (heartFx.length > g.lives) heartFx[g.lives] = 0;
        playSfx('heart');
        if (g.lives <= 0) endLevel(false);
      }
    };
    g.miss = function (x, y) {
      if (state !== 'play' || ended || dead) return;
      g.combo = 0; g.misses++;
      g.shake(5);
      if (x != null && y != null) fx.float('溜走啦', clamp(x, 50, g.w - 50), clamp(y, g.hudTop + 40, g.h - 30), { color: '#D6ECFF', size: 24 });
      playSfx('whoosh');
    };
    g.addScore = function (n, x, y) {
      n = Math.round(+n || 0);
      if (!n || dead || finished) return;
      g.score = Math.max(0, g.score + n); scoreBump = 1;
      if (x != null && y != null) fx.float((n > 0 ? '+' : '') + n, x, y, { color: '#FFE45C', size: 28 });
      if (ended) patchEndScore();   // 常见写法：最后一题 g.right() 自动通关后再 g.addScore(奖励)——存档与结算要跟上
    };
    g.win = function () { endLevel(true); };
    g.lose = function () { endLevel(false); };
    g.burst = function (x, y, o) { fx.burst(x, y, o); };
    g.confetti = function () { fx.confetti(g.w); };
    g.float = function (text, x, y, o) { fx.float(text, x, y, o); };
    g.shake = function (px) { const v = (+px || 8) * (reduceMotion() ? 0.35 : 1); if (v > fx.shake) fx.shake = Math.min(40, v); };
    g.flash = function (color) { fx.flashCol = color || '#FFFFFF'; fx.flashA = reduceMotion() ? 0.2 : 0.5; };
    g.ring = function (x, y, color, r) { fx.ring(x, y, color, r); };
    g.tween = tween;
    g.after = after;
    g.text = (str, x, y, o) => drawText(g.c, str, x, y, o);
    const SO = {};
    g.shadowText = function (str, x, y, o) {
      o = o || {};
      SO.size = o.size || 24; SO.color = o.color || '#FFFFFF'; SO.font = o.font || 'round'; SO.weight = o.weight;
      SO.align = o.align; SO.baseline = o.baseline; SO.maxW = o.maxW; SO.alpha = o.alpha;
      SO.stroke = o.stroke || NAVY; SO.strokeW = o.strokeW != null ? o.strokeW : Math.max(3, SO.size * 0.16); SO.shadow = o.shadow !== false;
      return drawText(g.c, str, x, y, SO);
    };
    g.measure = (str, size, font, weight) => measure(str, size || 24, FONTS[font] ? font : 'round', weight);
    g.emoji = (ch, x, y, size, o) => drawEmoji(g.c, ch, x, y, size, o);
    g.rrect = (x, y, w, h, r, fill, stroke, lw) => rrect(g.c, x, y, w, h, r, fill, stroke, lw);
    g.cloud = (x, y, s, a) => drawCloud(g.c, x, y, s, a);
    g.wrapText = (str, maxW, size, font, weight) => wrapText(str, maxW, size || 24, FONTS[font] ? font : 'round', weight);
    g.sfx = (name) => { if (!dead) playSfx(name); };
    g.say = function (text, o) {
      o = o || {};
      const s = String(text == null ? '' : text).trim();
      if (dead || !s || !ctx.alive()) return Promise.resolve();
      let ok = false;
      try { ok = !!(ctx.tts && ctx.tts.ok); } catch (e) { ok = false; }
      if (!ok) {
        capText = o.caption != null ? String(o.caption) : g.pinyinOf(s);
        capT = 1.5;
        return Promise.resolve();
      }
      speaking++; g.speaking = true; musicDuck(true);
      const done = () => { speaking = Math.max(0, speaking - 1); if (!speaking) { g.speaking = false; if (!dead) musicDuck(false); } };
      let p;
      try { p = ctx.tts.speak(s, o.rate ? { rate: o.rate } : undefined); } catch (e) { p = null; }
      if (!p || typeof p.then !== 'function') { done(); return Promise.resolve(); }
      return p.then(done, done);
    };
    g.music = function (on) {
      if (typeof on === 'string') { if (SONGS[on]) musicStyle = on; musicOn = true; }
      else musicOn = !!on;
      if (dead) return;
      if (musicOn && (state === 'play' || phase === 'count')) musicStart(musicStyle); else musicStop();
    };
    g.rand = rand; g.randi = randi; g.pick = pickOne; g.shuffle = shuffle; g.clamp = clamp; g.lerp = lerp; g.dist = dist;
    g.hitCircle = (p, x, y, r) => !!p && (p.x - x) * (p.x - x) + (p.y - y) * (p.y - y) <= r * r;
    g.hitRect = (p, x, y, w, h) => !!p && p.x >= x && p.x <= x + w && p.y >= y && p.y <= y + h;
    g.items = function (col, n) {
      const rv = ctx.review;
      if (rv && rv.length) {
        const m = rv.filter((it) => colOf(col, it));
        if (m.length) { const s = shuffle(m); return n == null ? s : s.slice(0, Math.max(0, Math.floor(+n) || 0)); }
      }
      const src = (ctx.G && Array.isArray(ctx.G[col])) ? ctx.G[col] : [];
      try { return ctx.pick(src, n); } catch (e) { return shuffle(src).slice(0, n == null ? src.length : n); }
    };
    /* 扩展：错题里有几道该栏目的题（不在重练 = 0）。多栏目游戏（如 rocket、monster）重练时只出 hasReview>0 的栏目 */
    g.hasReview = function (col) {
      const rv = ctx.review;
      return rv && rv.length ? rv.filter((it) => colOf(col, it)).length : 0;
    };
    function getPool() { if (!pool) pool = buildPool(ctx.G || {}); return pool; }
    g.charPool = () => getPool().bare;
    g.similarChars = (ch, n, exclude) => similarOf(getPool(), pyAll(), ch, n, exclude);
    g.pinyinOf = (text) => pinyinText(text, getPool(), pyAll());
    g.roadPos = (lane, t, out) => sky.roadPos(lane, t, out);

    /* ---------- 启动 ---------- */
    audio();
    layout();
    if (typeof spec.dom === 'function') { try { spec.dom.call(spec, g, layer); } catch (e) { fail(e); } }
    if (!errored) showSelect();
    raf = requestAnimationFrame(frame);
    if (!ctx.alive()) destroy();
    return function cleanup() { destroy(); };
  }

  HW.arcade = {
    version: '2.0.0',
    run,
    ease: EASE,
    fonts: FONTS,
    sfx: (name) => playSfx(name),
    unlockAudio: () => { audio(); },
    /* 调试 / 测试用（只读快照）：退出后应为 live:0、music:false；particles ≤ 300 */
    stats() {
      let particles = 0, frameMs = 0;
      const games = [];
      LIVE.forEach((i) => { particles += i.fx.count; frameMs = i.g.frameMs; games.push(i.id + ':' + i.g.state); });
      return {
        live: LIVE.size, games, music: !!AU.on, musicStyle: AU.style, ducked: !!AU.duck, audio: AU.ac ? AU.ac.state : 'none',
        particles, particleMax: 300, frameMs: Math.round(frameMs * 100) / 100,
        cache: { text: TXT.size, emoji: EMO.size, measure: MEAS.size, wrap: WRAP.size, textPx: PX.txt, emojiPx: PX.emo }
      };
    }
  };
})();
