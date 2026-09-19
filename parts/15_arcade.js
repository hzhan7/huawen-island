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
 *   intro / controls   选关界面与 3·2·1 下方的说明；字符串或 function(level, g) → 字符串（每次倒计时都重新取，可按关换提示）
 *   music:'bright'|'calm'|'drum'|null   每关开始（含重玩）都回到这首；中途 g.music(...) 换的曲不会带到下一关
 *   sky:'day'|'sea'|'night'|'space'|'road'|'grass'|null（null = 游戏在 draw 里自己画满背景）
 *   init(g)      每关开始（含重玩）在 3·2·1 之前调用；g.level/g.rounds/g.lives 已重置。之后 draw 才会被调用。
 *   play(g)      【扩展，可选】倒计时结束、state 变成 'play' 的那一刻调用。适合第一次 g.say。
 *   update(g,dt) 只在 state==='play' 时调用，dt 秒（≤0.05）
 *   overUpdate(g,dt) 【扩展，可选】本关结束后（state==='over'，结算动画 / 结算面板期间）每帧调用：最后一击的物理、
 *                飞行动画接着走（update 此时不再调用；g.right / g.wrong 等在 over 里本来就无效）
 *   draw(g,c,dt) init 之后每帧调用（intro 倒计时 / play / pause / over 都会画），c 已按 DPR 缩放，
 *                坐标 = CSS 像素 0..g.w × 0..g.h；画在引擎背景之上、粒子/HUD 之下。
 *                dt = 本帧秒数（暂停时 0）；倒计时 / 结算动画期间 update 不调用，装饰动画请用 dt 或 g.vt 推进（别自己 performance.now）
 *   preview(g,c,dt) 【扩展，可选】选关界面（init 之前）画自己的场景；不给就画 sky（null 时画 'day'）。此时 init 还没跑过，别读关卡状态
 *   down/move/up(g,p)  p = {x, y, id, down, type}。默认多点触控只认第一根手指；spec.multiTouch:true = 每根手指都交给游戏（按 p.id 区分）
 *                鼠标悬停移动也会调用 move（此时 p.down=false）；触摸只在按住时有 move。
 *   key(g,k)     'left'|'right'|'up'|'down'|'space'|'enter'|其它原始 e.key（如 'a'、'1'）；按住自动连发不会重复调用。
 *                持续按住的方向请读 g.held.left / g.held.right ...（扩展）
 *                Esc / P 由引擎用来暂停，不会传给游戏。
 *   resize(g)    画布尺寸变化后（g.w/g.h/g.hudTop 已更新）
 *   dom(g,layer) 可选：layer 是盖在画布上的绝对定位 div（默认 pointer-events:none，它的直接子元素可点）。
 *                在选关界面出现前调用一次；选关界面期间 layer 隐藏。
 *   pause(g) / resume(g)  【扩展，可选】暂停面板出现 / 点“继续”后调用（停麦克风、自己的音乐时钟重新数拍等）
 *   over(g, win) 【扩展，可选】本关结束（win/lose 进入 'over'）的那一刻调用一次（停 HanziWriter 判笔、麦克风等）
 *   end(g)       游戏结束 / 退出 / 页面离开时调用一次（停麦克风、HanziWriter 等）
 *   其它可选项（都有默认值）：
 *     autoWin:false        g.right 做满 rounds 也不自动通关，游戏放完收尾动画后自己 g.win()
 *     endDelay:秒 | function(g, win)   结束后多久才盖上结算面板（默认 0.5，上限 6）；期间 draw / tween / after 照走
 *     stars:function(g, win) → 0–3     自己定星（默认按 done/(done+wrongs)）；通关至少 1 星、失败至多 1 星
 *     comboAt:[x,y] | {x,y} | function(g) | false   “连击×N！”大字的位置（默认 (g.w/2, g.hudTop+70)；false = 不飘）
 *     captionY:数值 | 'top'|'center'|'bottom' | function(g)   无 TTS 拼音字幕条的位置（默认 HUD 正下方）
 *     captionTones:false   g.say 自动生成的拼音字幕不带声调（声调就是答案的游戏用；单次调用也可 {tones:false}）
 *     palms:false          sky:'day' 不画左下 / 右下两棵前景大椰树（游戏在底部角落放角色 / 弹弓时）；也可随时改 g.palms
 *     countdownAt:'top'|'center'|'bottom' | function(g)        3·2·1 与说明的位置（默认居中）
 *     speakIcon:false      朗读时不在 HUD 里显示小喇叭（游戏自己有 🔊 按钮时）
 *     playOnly:true        本游戏所有 g.after / g.tween 默认 {playOnly:true}
 *     multiTouch:true      见 down/move/up
 *     name / icon          选关面板的名字 / 图标（默认用 HW.register 时的 name / icon）
 *
 * ───────────── g（游戏实例）─────────────
 * 尺寸/时间：g.w g.h（CSS 像素） g.hudTop（HUD 占用高度；HUD 的一切——红心、进度、分数、连击、朗读小喇叭——都画在它上面，
 *   游戏内容画在它下面不会被盖） g.dpr
 *   g.t（本关 play 秒数；暂停/倒计时不走） g.vt（画面时钟：选关 / 倒计时 / play / 结算都走，暂停停） g.dt（本帧秒数）
 *   g.countdown（倒计时：3 / 2 / 1 / 0=“开始！”，其它时候 -1） g.cdT（倒计时已过秒数，0–2.5）
 *   g.level g.maxLevel g.state（'intro'|'play'|'pause'|'over'）
 *   g.ctx g.G（= ctx.G 本年级题库） g.grade（'p3'） g.gradeNum（3） g.isReview（错题重练中：不解锁、不写星级 / 最高分）
 *   g.meta = {id, name, icon, skill}（注册信息）
 *   画布高 = 视口剩余高度（最少 240；手机横拿时约 330），请按 g.h 排版，别假设 ≥ 480
 * 计分：g.score g.lives g.maxLives g.combo g.maxCombo g.done g.rounds（可在 init 里改） g.wrongs g.misses g.hurts
 *   g.right(item, x, y, label?, o?)  +10×连击倍率（连击≥3 ×2，≥6 ×3，≥10 ×4）、粒子、飘字、音效、ctx.score.right(item)、g.done++；
 *                                g.done >= g.rounds 时自动 g.win()。item 请传题库里的原对象（错题本按它点名）。
 *                                label === '' / false = 不飘分数字；o = {combo:false（不加连击、不飘连击字）, comboFloat:false,
 *                                comboAt, pts（本次得分）, labelAt:[x,y], labelSize, labelFont（飘字字体，同 g.text 的 font，
 *                                默认 'round'；带调拼音用 'py'）, fx:false, win:false（本次不自动通关）, endDelay}
 *   g.wrong(item, note, x, y, o?) 扣 1 心、断连击、抖屏、红 ✗、音效、ctx.score.wrong(item, note)；心归零自动 g.lose()
 *                                item 传 null = 扣心 + 计 wrongs（降星）但不进错题本；o = {holdEnd:true（0 心也先不结束，
 *                                讲解完自己 g.lose()）, reveal, mark:false（不飘红 ✗、不喷红点：游戏已画了自己的后果——
 *                                刀被弹开、托盘弹回）, shake（抖屏像素，默认 13；0 = 不抖）, flash:false（不闪红屏）, sfx:false}
 *   g.hurt(x, y, label?, o?)     非答题伤害（炸弹、撞墙）：扣 1 心、断连击、抖屏、心碎动画、0 心自动 lose；不进错题本、不计 wrongs
 *                                o = {holdEnd, reveal, labelFont, shake, flash:false, sfx:false}
 *   g.heal(x?, y?, label?, o?)   加 1 心（满了返回 false；o.grow 可超上限到 8）+ 心跳光环动画
 *   g.hit(x, y, o?|pts)          中间步骤命中：连击+1、倍率加分（o.pts 基础分）、粒子、飘字、连击大字；不加 done、不调 ctx.score.right
 *   g.miss(x, y, label?, o?)     只断连击 + 小抖动（“让它跑掉了”），不扣心不记错题；label 默认“溜走啦”，可传自己的字
 *                                （“快画声调！”“打偏啦”），'' / false 不飘字；不给 x,y 也不飘字；o={sfx:false, shake, labelFont}
 *   g.breakCombo()               悄悄断连击（无声、无字、不抖）
 *   g.addScore(n, x, y)  g.win(o?)  g.lose(o?)   —— win/lose 只在 play 中生效、只生效一次；o = {delay, reveal}
 *                                （reveal = 结算面板上显示的“正确答案”，用楷体字族显示——里面是题目汉字）。
 *                                结束后 endDelay（默认 0.5）秒盖上结算面板，再 2.7 / 2.1 秒（面板出现 0.6 秒后点一下 / Enter 可跳过）
 *                                → ctx.finish 恰好一次：{correct, total, stars, level, score, win, maxCombo, review}（后几项为扩展）
 *                                结束动画期间 g.addScore 仍有效（存档 hi / 结算面板会跟着更新），g.right/g.wrong 无效
 *   暂停面板“退出”/ 选关界面 Esc = 回地图，不调 ctx.finish（和核心顶栏“退出”一样不记这一轮）
 *   核心顶栏“← 退出”点第一下（“再点一次退出”）时游戏自动暂停
 *   通关且 ≥2 星解锁下一关；ctx.mem 键 'arc' = {lv:已解锁最高关, best:{关号:星}, hi:最高分,
 *                                last:{lv, score, stars, win, unlocked}}（last 为扩展，结算页可读）；错题重练（g.isReview）不写
 * 特效：g.burst(x,y,{color,n,kind:'star'|'coin'|'dot'|'ink'|'water'|'confetti'|'spark', world})  g.confetti()
 *   g.float(text,x,y,{color,size,life,world,font})（按文字宽度夹在画布内；同一段字 0.25 秒内同处再飘会合并，同屏最多 3 条）
 *          font 同 g.text（默认 'round'；带调拼音 ǎǐǒǔ 用 'py'，汉字题目用 'kai'）
 *   g.shake(px)  g.flash(color)  g.ring(x,y,color,r?,{world})
 *   g.cam = {x, y}：游戏镜头偏移。带 {world:true} 的粒子 / 飘字 / 圈用世界坐标（= 屏幕坐标 + cam），画时减去 g.cam，跟着世界滚动
 * 动画（用游戏时钟：暂停 / 倒计时期间不走；结束动画期间照走；重玩 / 退出自动取消）：
 *   g.tween(obj,{prop:to},sec,ease?,onDone?,o?) → {cancel()}   ease 可以是函数或名字 'outBack'
 *   g.after(sec, fn, o?) → {cancel()}     g.ease.{linear,inQuad,outQuad,inOutQuad,outCubic,outBack,outBounce,outElastic}
 *   o = {playOnly:true}：本关一结束（进入 over）就自动取消——“答对后 0.8 秒出下一题”这类回调用它，就不会在结算动画里触发
 * 绘图（都画在当前画布 g.c 上；文字 / emoji 自动离屏缓存）：
 *   g.text(str,x,y,{size=24,color='#fff',font:'kai'|'round'|'num'|'sans'|'py',weight,align='center',
 *          baseline='middle',stroke,strokeW,maxW,alpha,shadow,scale})  → 实际绘制宽度；maxW 时自动缩小放下
 *          scale：按 size 缓存一张精灵、绘制时缩放（透视缩放的文字每帧字号都变时，size 固定、改 scale，别冲掉缓存）
 *          题目里的汉字一律 font:'kai'（楷体缺失时统一落到宋体：本机 Songti / 宋体；本机都没有时（iPad）用页面加载的 Noto Serif SC）。描边 = 向外扩 strokeW；kai 默认只扩 0.07×字号（不糊字内空隙）
 *          'round' = Baloo 2 + ZCOOL KuaiLe；'num' = Baloo 2 数字。
 *   g.shadowText(str,x,y,opts)（粗描边 + 投影的游戏标题字）  g.measure(str,size,font,weight) → 宽度
 *   g.emoji(ch,x,y,size,{rot,alpha,flip})  g.rrect(x,y,w,h,r,fill,stroke,lw)  g.cloud(x,y,s,alpha)（s=1 约 120px 宽）
 *   g.wrapText(str,maxW,size,font) → 行数组（中文逐字断行、行首不放标点）
 *   g.cursor(css)：画布鼠标指针（'none' 用自己画的锤子等）；暂停 / 结束 / 退出自动还原
 * 声音：g.sfx(name) name ∈ pop coin jump splash hit whoosh power tick bubble crash swing chomp flip match beat good bad win lose
 *          （另有 go star heart combo）；跟随全局声音开关。
 *   g.say(text,{rate,caption,captionY,captionT,quiet,tones}) → Promise<{spoken, interrupted, silent, noTTS, ms}>：调 ctx.tts.speak 并压低音乐；
 *          没有中文朗读时立即 resolve，显示拼音字幕条（长句折行，停 1.5–4.5 秒；不显示汉字答案）。
 *          caption:'文字' 自定义字幕；caption:'' / false 或 quiet:true = 不显示字幕；captionY 见 spec.captionY；
 *          tones:false = 自动字幕去掉声调（hǎo → hao，ü 保留；声调就是答案时用；默认跟 spec.captionTones）。
 *          有朗读却 0.3 秒内就结束（没开口的“空播”）→ 补字幕、silent:true；连续两次 → g.ttsBroken=true。
 *          被暂停 / 新 g.say / g.stopSay 打断 → interrupted:true。g.speaking = 正在朗读；g.ttsOK = 有中文朗读且没坏
 *   g.stopSay()  停掉朗读
 *   g.music(on)  true/false 开关；'bright'|'calm'|'drum' 换曲；{style, bpm, on} 换曲并改速
 *   g.audioTime() 引擎 AudioContext 的当前时刻；g.beatInfo() → {on, bpm, beat, eighth, now, gridT, step, barT}（和背景音乐对拍）
 *   g.tone(t, f0, f1, dur, vol, type, o?) 在音频时刻 t（null = 马上）排一个音（f0→f1 滑音）；o = {path:[[0,f],[0.45,f2],[1,f3]]
 *          （按 dur 的比例走折线音高，如三声先降后升；给了 path 就不看 f1）, lin:true（线性滑音，默认指数）, attack, hold, lp, detune}
 *   g.note(n, dur, {type, vol, at})：n<24 = 五声音阶第 n 级，否则 MIDI
 *   g.audioOut() → {ac, out} | null：引擎的 AudioContext 和音效总线（out 跟随全局声音开关、带压缩器）。自己合成的音接到 out 上，
 *          别另建 AudioContext（iPad 一页能开的有限）。另有 HW.arcade.soundOn()（全局声音开关）、HW.arcade.audioOut()
 *   g.mic({threshold, gain}) → {state, level, peak, voiced, start()→Promise<bool>, stop()}：引擎持有；开着时背景音乐自动停；
 *          退出自动关；本页被拒绝一次后不再弹窗（state='denied'）
 * 工具：g.rand(a,b) g.randi(a,b)（含两端） g.pick(arr) g.shuffle(arr)（返回新数组） g.clamp(v,a,b) g.lerp(a,b,t)
 *   g.dist(ax,ay,bx,by) g.hitCircle(p,x,y,r) g.hitRect(p,x,y,w,h)（x,y 为左上角）
 *   g.items(col, n, o?) 重练模式（ctx.review 非空）且错题里有该栏目的题 → 只用错题（可能少于 n！请
 *                     g.rounds = Math.min(g.rounds, list.length)）；否则 ctx.pick(ctx.G[col], n)
 *                     （ctx.G 里没有这个栏目时退回 HW_DATA[年级][col]，如 3.0 新栏目 jg / zuci / recipes / menu）
 *                     重练时该栏目没有错题：默认退回题库新题；o = {strict:true} 则返回 []（多栏目游戏用它）
 *   g.hasReview(col)  【扩展】错题里该栏目有几道（不在重练 = 0）
 *   g.charPool()      本年级汉字 → 无调拼音（ü 写作 v）映射对象，如 {'晴':'qing'}
 *   g.similarChars(ch, n=3, exclude?)  造干扰字：按“像不像”排序——读音（同音 > 近音：平翘舌 / n-l / f-h / 前后鼻音 > 同韵母 > 同声母）
 *                     + 字形（共享部件，青/佥这类稀有部件分高，氵口木这类常见部首分低）；候选只来自本年级 charPool。
 *                     不含 ch 与 exclude（字符串或数组）。exclude 传整个词（如 '公园'）时，换字后成了题库里另一个词的候选也会排除
 *   g.pinyinOf(text, o?) → 带调拼音：整段是题库里的词 / 绕口令的一段 → 课本注音；否则最长词优先（课本 / 组词 / 菜单的整词注音；
 *                     字表 chars.words、jg.w、recipes.word 这类没整词注音的词，其中本课那个字按本课读音：因为 = yīn wèi），单字取题库里最常见读音，
 *                     题库没有的字查内置常用字表（GB2312 一级字 + 题库用字），并做“一 / 不”变调；都查不到才给 '·'。
 *                     o = {tones:false} 去掉声调。题目自带 py 时请直接传 {caption: py}
 * 背景（扩展）：g.sky 可随时改（换场景）；g.bgSpeed 背景滚动倍率（默认 1；只影响 space/road 的滚动与 sea 的小鱼，
 *   0 = 路面 / 星空停住；云、浪等环境动画照常）；g.palms（默认 spec.palms !== false）= day 的两棵前景大椰树
 *   g.horizon：当前背景的地平线/水面 y（sea = 水面；road = 路的消失线；space = g.h）
 *   road 背景的透视工具：g.road = {hy, by, cx, hwTop, hwBot, lanes, span}；g.roadLanes = 车道数（默认 3，可改）
 *     g.roadPos(lane, t, out?) → out = {x, y, s}：lane 可为小数（0 = 最左车道），t 0（远处）→1（画面底边），s = 缩放（1 = 最近）
 *     t 线性增长 = 在路上匀速靠近（近大远小、越近越快）；要和路面条纹同速：t += g.roadSpeed / g.road.span * dt
 *     （g.roadSpeed = 7 × g.bgSpeed，只读）
 * HUD（引擎画，全在 g.hudTop 以上）：左上红心（心多 / 屏窄时自动变成“❤×N”）、中上关卡号 + 进度条（朗读时关卡号换成小喇叭）、
 *   右上分数（连击≥3 时分数牌左端变成“🔥×N”火焰段）、最右暂停按钮（也可 Esc / P）。
 *   选关界面默认关卡：ctx.levelHint（核心结算页“下一关”）> 上一局 > 已解锁最高关。
 * 调试 / 测试：HW.arcade.current = {id, g, spec, state, phase, startLevel(lv)（跳过选关直接开任意关）, unlockAll(), skipCountdown()}
 *   （退出后为 null）；HW.arcade.gameMeta(id) → 注册信息；HW.arcade.stats() → {live, music, particles(≤300), frameMs, cache…}；
 *   退出后应为 live:0、music:false。
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
.arc-host{max-width:none!important;padding:0!important;margin:0!important;gap:0!important;display:block!important;min-height:0!important}
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
.arc-ov{position:absolute;inset:0;z-index:5;display:flex;flex-direction:column;align-items:center;justify-content:flex-start;gap:12px;
  padding:16px;text-align:center;color:${NAVY};font-family:var(--arc-f);overflow:auto;overscroll-behavior:contain;touch-action:pan-y}
.arc-ov::before,.arc-ov::after{content:"";flex:1 1 0;min-height:0}
.arc-ov.at-top::before,.arc-ov.at-bottom::after{flex:0 0 0}
.arc-ov.at-top::after,.arc-ov.at-bottom::before{flex:3 1 0}
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
.arc-cd-c{font:600 15px/1.3 var(--arc-f);color:#fff;text-shadow:0 2px 0 ${NAVY},1px 1px 0 ${NAVY},-1px -1px 0 ${NAVY};
  max-width:min(92%,440px);padding:5px 14px 6px;border-radius:14px;background:rgba(20,32,70,.62);-webkit-backdrop-filter:blur(2px);backdrop-filter:blur(2px)}
.arc-end-rev{max-width:min(92%,420px);padding:8px 18px 10px;border-radius:18px;background:#FFFBEF;border:3.5px solid ${NAVY};box-shadow:0 5px 0 ${NAVY};
  font:400 20px/1.35 var(--arc-f);color:${NAVY};animation:arc-rise .5s .2s ease-out both}
.arc-end-rev b{display:block;font:400 14px/1.2 var(--arc-f);color:#C8392B;margin-bottom:2px}
.arc-end-rev-t{font-family:${FONTS.kai};font-weight:400;font-size:1.15em;line-height:1.4}
.arc-rot{font:600 14px/1.3 var(--arc-f);color:#5a6690}
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
.arc-root.is-short .arc-ov{padding:8px 12px;gap:8px}
.arc-root.is-short .arc-icon{display:none}
.arc-root.is-short .arc-panel{margin-top:30px;padding:34px 14px 12px;gap:7px}
.arc-root.is-short .arc-ribbon{font-size:24px;padding:6px 20px 8px;top:-26px}
.arc-root.is-short .arc-blurb{font-size:15px;line-height:1.3}
.arc-root.is-short .arc-lv-n b{font-size:44px}
.arc-root.is-short .arc-stars{font-size:22px}
.arc-root.is-short .arc-dot{width:32px;height:32px;font-size:15px}
.arc-root.is-short .arc-dots{gap:6px}
.arc-root.is-short .arc-lvrow{gap:10px}
.arc-root.is-short .arc-ctrl{font-size:13px;line-height:1.25}
.arc-root.is-short .arc-btn{min-height:46px;font-size:21px;padding:6px 20px 10px}
.arc-root.is-short .arc-btn.round{width:46px;height:46px;min-height:0;padding:0 0 3px}
.arc-root.is-short .arc-btn.go{min-height:52px;min-width:170px;font-size:26px;padding:6px 28px 10px}
.arc-root.is-short .arc-pause .arc-panel{gap:8px;padding-top:38px}
.arc-root.is-short .arc-cd-n{font-size:96px}
.arc-root.is-short .arc-cd-t{font-size:16px;padding:6px 14px 8px}
.arc-root.is-short .arc-end-t{font-size:40px}
.arc-root.is-short .arc-end-stars{font-size:42px}
.arc-root.is-short .arc-end-sc{font-size:22px;padding:6px 16px 8px}
.arc-root.is-short .arc-end-rev{font-size:17px;padding:6px 14px 8px}
.arc-root.is-tiny .arc-blurb,.arc-root.is-tiny .arc-ctrl,.arc-root.is-tiny .arc-hi,.arc-root.is-tiny .arc-cd-c{display:none}
.arc-root.is-tiny .arc-lv-n b{font-size:36px}
.arc-root.is-tiny .arc-panel{padding-top:30px;gap:5px}
`);
  }

  /* ================= 声音：WebAudio 合成（全页一个 AudioContext，跨局复用） ================= */
  const AU = { ac: null, master: null, sfxBus: null, musBus: null, noise: null, style: null, bpm: 0, on: false, next: 0, step: 0, bar: 0, beat0: 0, duck: 0, muted: false, micHold: 0, lastSfx: Object.create(null) };
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
      if (Array.isArray(o.path) && o.path.length) {   // 折线音高：[[比例 0–1, 频率], …]（g.tone 的 o.path）
        for (const pt of o.path) {
          if (!Array.isArray(pt)) continue;
          const fr = clamp(+pt[0] || 0, 0, 1), f = Math.max(20, +pt[1] || f0);
          if (fr <= 0) osc.frequency.setValueAtTime(f, t0);
          else if (o.lin) osc.frequency.linearRampToValueAtTime(f, t0 + dur * fr);
          else osc.frequency.exponentialRampToValueAtTime(f, t0 + dur * fr);
        }
      } else if (f1 && f1 !== f0) {
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

  /* 引擎的 AudioContext + 音效总线（游戏自己合成声音时接到 out 上，跟随全局声音开关；别另建 AudioContext） */
  function audioOut() {
    const ac = audio();
    return ac && AU.sfxBus ? { ac, out: AU.sfxBus } : null;
  }

  /* ---- 麦克风（g.mic）：全页记一次“被拒绝”，之后不再弹权限窗；开着时背景音乐自动停（扬声器里的音乐会被当成说话声） ---- */
  const MIC = { denied: false, none: false };
  function makeMic(o, hooks) {
    o = o || {};
    const m = { state: 'idle', level: 0, peak: 0, raw: 0, voiced: false, threshold: o.threshold > 0 ? +o.threshold : 0.08, start: null, stop: null };
    let st = null, src = null, an = null, buf = null, hang = 0, asking = null, held = false;
    const gain = o.gain > 0 ? +o.gain : 6;
    function release() {
      try { if (src) src.disconnect(); } catch (e) { /* ignore */ }
      try { if (st) st.getTracks().forEach((t) => t.stop()); } catch (e) { /* ignore */ }
      st = null; src = null; an = null; buf = null;
      m.level = 0; m.peak = 0; m.raw = 0; m.voiced = false;
      if (held) { held = false; hooks.off(); }
    }
    m.start = function () {
      if (m.state === 'on') return Promise.resolve(true);
      if (asking) return asking;
      if (hooks.dead()) return Promise.resolve(false);
      const md = W.navigator && W.navigator.mediaDevices;
      if (!md || typeof md.getUserMedia !== 'function') { m.state = 'none'; MIC.none = true; return Promise.resolve(false); }
      if (MIC.denied) { m.state = 'denied'; return Promise.resolve(false); }
      m.state = 'asking';
      asking = md.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true } }).then((stream) => {
        asking = null;
        const ac = audio();
        if (m.state !== 'asking' || hooks.dead() || !ac) { try { stream.getTracks().forEach((t) => t.stop()); } catch (e) { /* ignore */ } if (m.state === 'asking') m.state = ac ? 'off' : 'none'; return false; }
        try {
          st = stream; src = ac.createMediaStreamSource(stream); an = ac.createAnalyser(); an.fftSize = 1024; an.smoothingTimeConstant = 0;
          src.connect(an); buf = new Float32Array(an.fftSize);
        } catch (e) { release(); m.state = 'none'; return false; }
        m.state = 'on'; held = true; hooks.on();
        return true;
      }, (e) => {
        asking = null;
        const nm = e && e.name;
        if (nm === 'NotAllowedError' || nm === 'SecurityError' || nm === 'PermissionDeniedError') { MIC.denied = true; m.state = 'denied'; } else m.state = 'none';
        return false;
      });
      return asking;
    };
    m.stop = function () { if (m.state === 'on' || m.state === 'asking') m.state = 'off'; release(); };
    m.tick = function (dt) {
      if (m.state !== 'on' || !an) return;
      let sum = 0;
      try {
        if (an.getFloatTimeDomainData) { an.getFloatTimeDomainData(buf); for (let i = 0; i < buf.length; i++) sum += buf[i] * buf[i]; }
        else { const b = new Uint8Array(an.fftSize); an.getByteTimeDomainData(b); for (let i = 0; i < b.length; i++) { const v = (b[i] - 128) / 128; sum += v * v; } }
      } catch (e) { return; }
      const rms = Math.sqrt(sum / (buf ? buf.length : 1024));
      m.raw = rms;
      const lv = clamp(rms * gain, 0, 1);
      m.level = lv > m.level ? lv : m.level + (lv - m.level) * Math.min(1, dt * 10);
      m.peak = Math.max(lv, m.peak - dt * 0.8);
      if (lv >= m.threshold) { m.voiced = true; hang = 0.18; } else if ((hang -= dt) <= 0) m.voiced = false;
    };
    return m;
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
  function musicStart(style, bpm) {
    const s = SONGS[style] ? style : 'bright';
    if (AU.micHold) { AU.style = s; AU.bpm = bpm > 0 ? clamp(+bpm, 40, 220) : 0; return; }   // 麦克风开着：别让扬声器里的音乐被当成说话声
    const ac = audio(); if (!ac) return;
    AU.style = s; AU.on = true; AU.bpm = bpm > 0 ? clamp(+bpm, 40, 220) : 0;
    AU.next = ac.currentTime + 0.08; AU.step = 0; AU.bar = 0; AU.beat0 = AU.next;
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
    const spb = 60 / (AU.bpm || song.bpm) / 2;        // 八分音符
    if (AU.next < ac.currentTime - 0.3) AU.next = ac.currentTime + 0.05;   // 卡顿/切后台回来：别补一堆音
    while (AU.next < ac.currentTime + 0.2) {
      schedStep(song, AU.step, AU.bar, AU.next, spb);
      AU.step++;
      if (AU.step >= 8) { AU.step = 0; AU.bar = (AU.bar + 1) % song.mel.length; }
      AU.next += spb;
      if (AU.step === 0) AU.beat0 = AU.next;   // 下一小节的起点（g.beatInfo 用）
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
  /* kai：Mac / iPad 上的“Kaiti SC”是按需下载字体，没下载时 Chrome / Safari 的画布用不了，STKaiti 新系统已删。
     楷体全都缺时明确落到宋体（Songti SC / 宋体 / Noto Serif），不交给浏览器随机挑，各设备观感一致（SPEC 允许楷体或宋体字形） */
  const FONTS = {
    kai: '"Kaiti SC","STKaiti","KaiTi","楷体","BiauKai","Songti SC","STSong","SimSun","Noto Serif SC","Noto Serif CJK SC","Source Han Serif SC",serif',
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
    try {   // 网络字体还没到：先用回退字体画，字体到了把这张缓存作废重画（sans 只有本机字体，不用查）
      // kai：本机有楷体 / 宋体（Mac、Windows）就用本机的，不必等网络；都没有（iPad 等没下载过中文字体的设备）时
      // 靠页面头里从 Google Fonts 加载的 Noto Serif SC（按需分片），这里主动要这几个字的分片，到了就重画，保证是宋体不是黑体
      const web = font === 'kai' ? !kaiLocal() : font !== 'sans';
      if (web && D.fonts && D.fonts.check && !D.fonts.check(f, str)) D.fonts.load(f, str).then(() => { spriteDel(TXT, key, 'txt'); }, () => {});
    } catch (e) { /* ignore */ }
    return sp;
  }
  /* 本机有没有楷体 / 宋体（FONTS.kai 里 Noto Serif SC 之前的那些）：拉丁字母在这些字体里是比例宽度，
     和 monospace / sans-serif 回退量出来的宽度不同 → 有；全都一样 → 没有。只算一次 */
  let KAI_LOCAL = null;
  function kaiLocal() {
    if (KAI_LOCAL !== null) return KAI_LOCAL;
    KAI_LOCAL = true;
    try {
      const t = 'mmmwwwlliIW永天', wOf = (fam) => { scratch.font = '32px ' + fam; return scratch.measureText(t).width; };
      const m = wOf('monospace'), s = wOf('sans-serif');
      KAI_LOCAL = ['Kaiti SC', 'STKaiti', 'KaiTi', '楷体', 'BiauKai', 'Songti SC', 'STSong', 'SimSun']
        .some((n) => wOf('"' + n + '",monospace') !== m || wOf('"' + n + '",sans-serif') !== s);
    } catch (e) { KAI_LOCAL = true; }
    return KAI_LOCAL;
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
    // 描边是“向外扩 strokeW”（lineWidth = 2×strokeW，填充盖住内侧一半）。楷体笔画细、字内空隙小，
    // 默认 0.12×字号会把 日/目、己/已 的空隙糊掉 → 楷体默认只扩 0.07×字号
    const sw = stroke ? (o.strokeW != null ? o.strokeW : font === 'kai' ? Math.max(1.5, size * 0.07) : Math.max(2, size * 0.12)) : 0;
    const sp = textSprite(str, size, o.color || '#fff', font, weight, stroke, sw, !!o.shadow);
    let s = o.scale > 0 ? +o.scale : 1;   // scale：按 size 缓存一张精灵、画的时候再缩放（透视文字每帧字号都变时用，别冲掉缓存）
    if (o.maxW && sp.tw * s > o.maxW) s = o.maxW / sp.tw;
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
    for (let i = 0; i < NP; i++) P.push({ on: false, k: 0, x: 0, y: 0, vx: 0, vy: 0, gy: 0, dr: 1, age: 0, life: 1, sz: 4, col: '#fff', rot: 0, vr: 0, sp: null, ph: 0, wd: 0 });
    for (let i = 0; i < NF; i++) F.push({ on: false, text: '', x: 0, y: 0, age: 0, life: 1, col: '#fff', size: 26, wd: 0, font: 'round' });
    for (let i = 0; i < NR; i++) R.push({ on: false, x: 0, y: 0, age: 0, life: 0.5, col: '#fff', r0: 10, r1: 90, wd: 0 });
    let pi = 0, fi = 0, ri = 0;
    const KIND = { star: 1, coin: 2, dot: 3, ink: 4, water: 5, confetti: 6, spark: 7 };
    // camX / camY：游戏镜头偏移（g.cam）。带 {world:true} 生成的粒子 / 圈 / 飘字用世界坐标，画的时候减去镜头，跟着世界走
    const fx = { count: 0, shake: 0, flashA: 0, flashCol: '#fff', ox: 0, oy: 0, camX: 0, camY: 0 };
    function slot() { const p = P[pi]; pi = (pi + 1) % NP; return p; }
    fx.burst = function (x, y, o) {
      o = o || {};
      const k = KIND[o.kind] || 1;
      let n = o.n != null ? o.n : (k === 2 ? 10 : k === 6 ? 30 : k === 7 ? 12 : 16);
      n = clamp(Math.round(n), 0, 120);
      const col = o.color, wd = o.world ? 1 : 0;
      for (let i = 0; i < n; i++) {
        const p = slot();
        const a = Math.random() * TAU;
        p.on = true; p.k = k; p.x = x; p.y = y; p.age = 0; p.rot = Math.random() * TAU; p.ph = Math.random() * TAU; p.sp = null; p.wd = wd;
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
        p.rot = Math.random() * TAU; p.vr = rand(-9, 9); p.ph = Math.random() * TAU; p.col = CONF_COLORS[i % CONF_COLORS.length]; p.sp = null; p.wd = 0;
      }
    };
    /* 飘字：同一段文字 0.25 秒内、30px 内再飘 = 重启那一条（孩子狂点时不会叠成一团黑）；同一段文字同屏最多 3 条 */
    fx.float = function (text, x, y, o) {
      o = o || {};
      text = String(text == null ? '' : text);
      if (!text) return;
      const wd = o.world ? 1 : 0;
      let f = null, same = 0, oldest = null;
      for (let i = 0; i < NF; i++) {
        const q = F[i];
        if (!q.on || q.text !== text || q.wd !== wd) continue;
        if (q.age < 0.25 && Math.abs(q.x - x) < 30 && Math.abs(q.y + q.age * 48 - y) < 30) { f = q; break; }
        same++;
        if (!oldest || q.age > oldest.age) oldest = q;
      }
      if (!f && same >= 3) f = oldest;
      if (!f) { f = F[fi]; fi = (fi + 1) % NF; }
      f.on = true; f.text = text; f.x = x; f.y = y; f.age = 0; f.life = o.life || 1.05; f.wd = wd;
      f.col = o.color || '#FFFFFF'; f.size = Math.round(o.size || 30);
      f.font = FONTS[o.font] ? o.font : 'round';   // 带调拼音用 'py'（圆体 Baloo 2 的 ǎǐǒǔ 会回退到别的字体），题目汉字用 'kai'
    };
    fx.ring = function (x, y, col, r1, world) {
      const r = R[ri]; ri = (ri + 1) % NR;
      r.on = true; r.x = x; r.y = y; r.age = 0; r.life = 0.55; r.col = col || '#FFFFFF'; r.r0 = 8; r.r1 = r1 || 95; r.wd = world ? 1 : 0;
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
      const cx0 = fx.camX, cy0 = fx.camY;
      for (let i = 0; i < NR; i++) {
        const r = R[i]; if (!r.on) continue;
        const t = r.age / r.life, e = 1 - (1 - t) * (1 - t);
        c.globalAlpha = 1 - t;
        c.lineWidth = Math.max(1, 10 * (1 - t));
        c.strokeStyle = r.col;
        c.beginPath(); c.arc(r.x - (r.wd ? cx0 : 0), r.y - (r.wd ? cy0 : 0), r.r0 + (r.r1 - r.r0) * e, 0, TAU); c.stroke();
      }
      c.globalAlpha = 1;
      for (let i = 0; i < NP; i++) {
        const p = P[i]; if (!p.on) continue;
        const t = p.age / p.life;
        const a = t > 0.7 ? (1 - t) / 0.3 : 1;
        c.globalAlpha = a;
        const k = p.k;
        const px = p.wd ? p.x - cx0 : p.x, py = p.wd ? p.y - cy0 : p.y;
        if (k === 1 || k === 2) {
          const s = p.sz * (k === 1 ? (t < 0.15 ? 0.5 + t / 0.3 : 1 - t * 0.35) : 1) / p.sp.w;
          const sx = k === 2 ? Math.cos(p.rot) : 1;
          const cr = k === 2 ? 1 : Math.cos(p.rot), sr = k === 2 ? 0 : Math.sin(p.rot);
          c.setTransform(dpr * cr * s * sx, dpr * sr * s * sx, -dpr * sr * s, dpr * cr * s, dpr * (px + ox), dpr * (py + oy));
          c.drawImage(p.sp.cv, -p.sp.w / 2, -p.sp.w / 2, p.sp.w, p.sp.w);
        } else if (k === 6) {
          const cr = Math.cos(p.rot), sr = Math.sin(p.rot), sq = Math.abs(Math.sin(p.age * 7 + p.ph));
          c.setTransform(dpr * cr, dpr * sr, -dpr * sr * sq, dpr * cr * sq, dpr * (px + ox), dpr * (py + oy));
          c.fillStyle = p.col; c.fillRect(-p.sz / 2, -p.sz * 0.3, p.sz, p.sz * 0.6);
        } else {
          c.setTransform(dpr, 0, 0, dpr, dpr * ox, dpr * oy);
          c.fillStyle = p.col;
          if (k === 7) {
            c.lineWidth = p.sz; c.strokeStyle = p.col; c.lineCap = 'round';
            c.beginPath(); c.moveTo(px, py); c.lineTo(px - p.vx * 0.035, py - p.vy * 0.035); c.stroke();
          } else {
            const r = k === 4 ? p.sz * (0.7 + t * 0.6) : p.sz * (1 - t * 0.4);
            c.beginPath(); c.arc(px, py, r, 0, TAU); c.fill();
            if (k === 5) { c.fillStyle = 'rgba(255,255,255,.8)'; c.beginPath(); c.arc(px - r * 0.3, py - r * 0.3, r * 0.35, 0, TAU); c.fill(); }
          }
        }
      }
      c.globalAlpha = 1;
      c.setTransform(dpr, 0, 0, dpr, dpr * ox, dpr * oy);
    };
    /* 飘字按文字宽度夹在画布内（贴边弹出、1.25 倍放大时也不被切掉）；w/h = 画布 CSS 尺寸 */
    fx.drawFloats = function (c, w, h) {
      for (let i = 0; i < NF; i++) {
        const f = F[i]; if (!f.on) continue;
        const t = f.age / f.life;
        const sc = t < 0.12 ? 0.55 + t / 0.12 * 0.7 : t < 0.24 ? 1.25 - (t - 0.12) / 0.12 * 0.25 : 1;
        const a = t > 0.65 ? (1 - t) / 0.35 : 1;
        const sz = Math.round(f.size * sc / 2) * 2;
        let x = f.wd ? f.x - fx.camX : f.x, y = f.wd ? f.y - fx.camY : f.y;
        const sw = f.font === 'kai' ? Math.max(2, sz * 0.09) : Math.max(3, sz * 0.14);   // 楷体笔画细，描边别糊掉字内空隙
        if (w > 0) { const hw = measure(f.text, sz, f.font) / 2 + sw + 6; x = hw * 2 >= w ? w / 2 : clamp(x, hw, w - hw); }
        if (h > 0) y = clamp(y, sz * 0.7, h - sz * 0.5);
        drawText(c, f.text, x, y, { size: sz, color: f.col, font: f.font, stroke: NAVY, strokeW: sw, shadow: true, alpha: a });
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
    const S = { w: 0, h: 0, hud: 0, s: 1, gr: Object.create(null), roadD: 0, lastT: -1, horizon: 0, lanes: 3, palms: true,
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
      if (S.palms !== false) {   // 前景两棵大椰树（g.palms = false 不画：游戏在底部角落放弹弓 / 角色时）
        const ph = Math.min(h * 0.26, 230);
        palm(c, -8 * s, h + 6, ph, 0.22, t, 0);
        palm(c, w + 10 * s, h + 10, ph * 0.8, -0.24, t, 3);
      }
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
  /* 去掉声调符号（hǎo → hao），ü 保留（lǜ → lü）：给“声调就是答案”的游戏做无调字幕 */
  function stripTones(py) {
    return String(py == null ? '' : py).normalize('NFD').replace(/[\u0304\u0301\u030c\u0300]/g, '').normalize('NFC');
  }
  function splitPy(s) {
    for (const i of INITIALS) if (s.length > i.length && s.indexOf(i) === 0) return [i, s.slice(i.length)];
    return ['', s];
  }
  /* 题库里带拼音的条目 → 每个字各读音的出现次数、词表（汉字串 → 音节）、长句（>6 字，如绕口令整句） */
  const newAcc = () => ({ cnt: Object.create(null), words: Object.create(null), long: [], maxLen: 1, hint: Object.create(null), hintMax: 1 });
  /* ext = true：第二遍，只收 3.0 新栏目的整词注音与“词里一个字的本课读音”，不计入单字读音次数（单字最常见读音保持只由
     原来的课本栏目决定，免得新栏目里的 银行 / 休息 把“行”“息”的默认读音带偏）；课本栏目先收，同一个词以课本注音为准 */
  function collect(G, acc, ext) {
    const add = (text, py, noCount) => {
      if (typeof text !== 'string' || typeof py !== 'string') return;
      const chs = Array.from(text.trim()).filter(isHan), syl = py.trim().split(/\s+/).filter(Boolean);
      if (!chs.length || chs.length !== syl.length) return;
      const key = chs.join('');
      if (!(key in acc.words)) {
        acc.words[key] = syl.join(' ');
        if (chs.length > 6) acc.long.push({ key, syl }); else if (chs.length > acc.maxLen) acc.maxLen = chs.length;
      }
      if (noCount) return;
      chs.forEach((ch, i) => { const c = acc.cnt[ch] || (acc.cnt[ch] = Object.create(null)); c[syl[i]] = (c[syl[i]] || 0) + 1; });
    };
    const arr = (k) => (G && Array.isArray(G[k]) ? G[k] : []);
    if (ext) { collectExt(arr, add, acc); return; }
    arr('chars').forEach((x) => x && add(x.c, x.py));
    arr('words').forEach((x) => x && add(x.w, x.py));
    arr('pick').forEach((x) => x && add(x.say, x.py));
    arr('build').forEach((x) => x && add(x.ans, x.py));
    arr('readaloud').forEach((x) => x && Array.isArray(x.hard) && x.hard.forEach((hd) => hd && add(hd.w, hd.py)));
    arr('twisters').forEach((x) => x && add(x.text, x.py));
  }
  function collectExt(arr, add, acc) {
    // 3.0 新栏目里带整词注音的：组词 ok、菜单（菜名 / 配料）、菜单用词（只进词表，不计单字次数）
    arr('zuci').forEach((x) => x && Array.isArray(x.ok) && x.ok.forEach((o) => o && add(o.w, o.py, true)));
    arr('menu').forEach((x) => {
      if (!x) return;
      add(x.name, x.py, true);
      ['base', 'extra'].forEach((k) => { if (Array.isArray(x[k])) x[k].forEach((b) => b && add(b.name, b.py, true)); });
    });
    arr('menuwords').forEach((x) => x && add(x.w, x.py, true));
    // 没有整词注音、但知道其中一个字本课读音的词：字表 {c, py, words:[…]}、jg {c, py, w}、recipes {ans, py, word}。
    // 多音字按本课读音（因为 / 为了 的“为”= wèi，闹钟的“闹”= nào），不再取全题库最常见的读音（wéi、轻声 nao）
    const hint = (w, c, py) => {
      if (typeof w !== 'string' || typeof c !== 'string' || typeof py !== 'string') return;
      const chs = Array.from(w.trim()), sy = py.trim().split(/\s+/);
      if (chs.length < 2 || !chs.every(isHan) || sy.length !== 1 || !sy[0]) return;
      const i = chs.indexOf(c);
      if (i < 0 || chs.indexOf(c, i + 1) >= 0) return;
      const key = chs.join(''), h = acc.hint[key] || (acc.hint[key] = []);
      if (h[i] == null) h[i] = sy[0];
      if (chs.length > acc.hintMax) acc.hintMax = chs.length;
    };
    arr('chars').forEach((x) => x && Array.isArray(x.words) && x.words.forEach((w) => hint(w, x.c, x.py)));
    arr('jg').forEach((x) => x && hint(x.w, x.c, x.py));
    arr('recipes').forEach((x) => x && hint(x.word, x.ans, x.py));
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
    return { tone, bare, words: acc.words, long: acc.long, maxLen: acc.maxLen, hint: acc.hint, hintMax: acc.hintMax };
  }
  function buildPool(G) { const a = newAcc(); collect(G, a); collect(G, a, true); return finishPool(a); }
  /* 朗读字幕用：全部年级合在一起（比本年级 charPool 覆盖更全） */
  let PY_ALL = null;
  function pyAll() {
    if (PY_ALL) return PY_ALL;
    const a = newAcc();
    const all = W.HW_DATA && typeof W.HW_DATA === 'object' ? W.HW_DATA : {};
    Object.keys(all).forEach((gr) => collect(all[gr], a));
    Object.keys(all).forEach((gr) => collect(all[gr], a, true));
    PY_ALL = finishPool(a);
    return PY_ALL;
  }
  /* 兜底数据（build/_kf/gen_tables.py 生成，一次性内嵌）：
     PY_TABLE：GB2312 一级字 + 题库全部用字的带调读音（题库句子里按 pypinyin 分词后的上下文最常见读音），“音节+汉字们”连写；
               只在题库自带注音查不到时用，免得无 TTS 字幕满屏 '·'
     CP_TABLE：题库全部用字的一级部件（hanzi_chaizi），“字+部件们”，逗号分隔；g.similarChars 用它找形近字 */
  const PY_TABLE = 'a啊ba吧biàn便卞变辨辩辫遍bié别biān编边鞭biāo彪标灬膘biē憋鳖biě瘪biǎn扁贬biǎo表bo卜bà坝爸罢耙霸bài拜稗败bàn伴办半扮拌瓣绊bàng傍棒磅蚌谤镑bào报抱暴爆豹鲍bá拔跋bái白báo薄雹bèi倍备惫焙狈背被贝辈钡bèn笨bèng泵蹦迸béng甭bì壁币庇弊必敝毕毖毙璧痹碧臂蓖蔽避闭陛bìn摈bìng并病bí鼻bó伯勃博帛搏渤箔脖膊舶铂驳bù不埠布怖步簿部bā八叭巴扒捌疤笆芭bān扳搬斑班般颁bāng帮梆邦bāo勹包胞苞褒bēi卑悲杯碑bēn奔bēng崩绷běi北běn本苯bī逼bīn宾彬斌滨濒缤bīng兵冫冰bō剥拨播波玻癶菠钵bǎ把靶bǎi佰摆柏百bǎn板版bǎng榜绑膀bǎo保堡宝饱bǐ匕彼比笔鄙bǐng丙柄炳秉饼bǔ哺捕补chuàn串chuàng创chuán传椽船chuáng幢床chuí垂捶椎锤chuò绰辶chuāi揣chuān川穿chuāng疮窗chuī吹炊chuō戳chuǎn喘chuǎng闯chà岔差诧chàn颤chàng倡唱怅畅chá察搽查碴茬茶chái柴豺chán婵缠蝉谗馋cháng偿嫦尝常肠cháo嘲巢朝潮chè彻掣撤澈chèn衬趁chèng秤chén尘忱晨沉臣辰陈chéng乘呈城惩成承橙澄程诚chì彳斥炽翅赤chí弛持池迟驰chòu臭chóng崇虫chóu仇惆愁畴稠筹绸踌酬chù处搐畜矗触chú厨橱滁躇锄除雏chún唇淳纯醇chā叉插chāi拆chān搀chāng昌猖chāo抄超钞chē车chēn郴chēng撑称chě扯chěng逞骋chī吃哧痴chōng充冲憧chōu抽chū出初chūn春椿chǎn产铲阐chǎng厂场敞chǎo吵炒chǐ侈尺耻齿chǒng宠chǒu丑瞅chǔ储杵楚础chǔn蠢cuàn窜篡cuì悴淬瘁粹翠脆cuò挫措错cuān蹿cuī催崔摧cuō搓撮磋cuǐ璀cài菜蔡càn掺灿璨cái才材裁财cán惭残蚕cáng藏cáo曹槽cè侧册厕测策cèng蹭céng层曾cì伺刺次赐cí慈瓷磁茨词辞雌còu凑cóng丛从cù促簇醋cùn寸cún存cā擦cāi猜cān参餐cāng仓沧舱苍cāo操糙cī疵cōng匆囱聪葱cū粗cūn村cǎi彩睬踩采cǎn惨cǎo艹草cǐ此de的diàn佃垫奠店惦殿淀电靛diào吊掉调钓dié叠碟蝶谍迭diān掂滇甸颠diāo凋刁叼碉雕diē爹跌diū丢diǎn典点碘duàn断段缎锻duì兑对队duò剁堕惰舵跺duó夺duān端duī堆duō哆多掇duǎn短duǒ垛朵躲dà大dài代带待怠戴殆袋贷dàn但弹惮旦氮淡蛋诞dàng档荡dào到悼盗稻道dá答达dèng凳瞪邓dé得德dì地帝弟第缔蒂递dìng定订锭dí嫡敌涤狄笛翟迪dòng侗冻动恫栋洞dòu斗痘豆逗dù妒度杜渡镀dùn囤炖盾遁钝顿dú毒犊独读dā搭瘩dāi呆dān丹单担耽郸dāng当dāo刀刂dēng噔灯登蹬děng等dī低堤滴dīng丁叮盯钉dōng东冬咚dōu兜都dū督dūn吨墩敦蹲dǎ打dǎi傣歹逮dǎn掸胆dǎng党挡dǎo倒导岛捣祷蹈dǐ底抵dǐng顶鼎dǒng懂董dǒu抖蚪陡dǔ堵睹肚赌fà珐fàn泛犯范贩饭fàng放fá乏伐筏罚阀fán凡樊烦矾繁钒fáng妨房肪防fèi吠废沸肺费fèn份奋忿愤粪fèng凤奉缝féi肥fén坟汾焚féng冯逢fù付傅副咐复妇富父缚腹覆讣负赋赴阜阝附fú伏佛俘幅弗扶拂服氟浮涪畐福符袱辐fā发fān帆番翻藩fāng匚坊方芳fēi啡菲非飞fēn分吩氛纷芬酚fēng丰封峰枫烽疯蜂锋风fěi匪翡诽fěn粉fěng讽fū夫孵敷肤fǎ法fǎn反返fǎng仿纺访fǒu否缶fǔ俯府抚斧甫腐腑辅釜guà挂褂guài夬怪guàn冠惯灌罐贯guàng逛guì刽柜桂炔贵跪guò过guó国guā刮瓜guāi乖guān关官棺观guāng光guī傀圭归瑰硅规闺龟guō郭锅guǎ剐寡guǎi拐guǎn管馆guǎng广guǐ晷癸诡轨鬼guǒ果粿裹gài概溉盖钙gàn赣gào告gá噶gè个各铬gèng更gé格阁隔革gòng共贡gòu垢够构购gù固故雇顾gùn棍gā嘎gāi该gān干杆柑甘竿肝gāng冈刚杠纲缸肛钢gāo皋篙糕羔膏高gē割咯哥戈搁歌疙胳鸽gēn根跟gēng庚羹耕gě葛gěi给gěn艮gěng埂梗耿gōng供公功宫工弓恭攻躬龚gōu勾沟钩gū估咕姑孤沽箍菇辜gǎi改gǎn感敢秆赶gǎng岗港gǎo搞稿镐gǒng巩拱汞gǒu狗苟gǔ古股蛊谷骨鼓gǔn丨滚辊huà划化画话huài坏huàn唤奂宦幻患换涣焕痪豢huàng晃huá华滑猾huái徊怀槐淮踝huán桓环huáng凰惶煌皇磺簧蝗黄huì会卉惠慧晦汇烩秽绘讳诲贿huí回蛔huò惑或祸获货霍huó活huā哗花huān欢huāng慌荒huī徽恢挥晖灰辉huō豁huǎn缓huǎng幌恍谎huǐ悔毁huǒ伙火hài亥害氦骇hàn悍憾捍撼旱汉汗焊翰hào号浩耗há蛤hái孩还骸hán函含寒涵邯韩háng杭航háo嚎壕毫豪貉hè褐贺赫鹤hèn恨hé何合和核河涸盒禾荷菏阂hén痕héng恒横衡hòu候厚后hóng宏弘洪红虹鸿hóu侯喉猴hù互户护沪hùn混hú壶弧湖狐瑚糊胡葫蝴hún浑魂hā哈hān憨酣hāng夯hē呵喝hēi嘿黑hēng亨哼hěn很狠hōng烘轰hū乎呼忽hūn婚昏荤hǎi海hǎn喊罕hǎo好郝hǒng哄hǒu吼hǔ唬浒虎jià价嫁架稼驾jiàn件健剑建毽涧渐溅箭舰荐见贱践鉴键饯jiàng匠酱降jiào叫教窖轿较酵jiá荚颊jiè介借届戒界疥芥诫jié劫截捷杰洁睫竭结节jiù厩咎就救旧疚臼舅jiā佳加嘉夹家枷茄jiān兼坚奸尖戋歼煎监笺缄肩艰间jiāng僵姜将江浆疆jiāo交娇椒浇焦礁胶蕉郊骄jiē接揭皆秸街阶jiě姐解jiū揪究纠jiǎ假甲贾钾jiǎn俭减剪拣捡柬检硷碱简茧jiǎng奖桨蒋讲jiǎo侥剿搅狡矫绞缴脚角铰饺jiǒng炯窘迥jiǔ久九灸玖酒韭juàn倦眷绢jué倔决嚼抉掘攫爵绝觉诀juān娟捐鹃juē撅juǎn卷jì伎冀剂妓季寂寄忌悸技既济祭纪继绩蓟计记迹际jìn劲晋浸烬近进靳jìng净境径敬痉竞竟镜靖静jí即及吉嫉急极棘汲疾籍级脊藉辑集jù俱具剧句巨惧拒据炬聚距踞锯jùn俊峻浚竣郡骏jú局桔橘菊jī击叽圾基姬机激畸积稽箕缉肌讥饥鸡jīn今巾斤津禁筋襟金钅jīng京兢惊晶睛粳精经茎荆鲸jū居拘狙疽鞠驹jūn军君均菌钧jǐ几己挤jǐn仅尽紧谨锦jǐng井憬景警颈jǔ举咀沮矩kuà挎胯跨kuài侩块快筷脍kuàng况旷眶矿kuáng狂kuì愧溃馈kuí奎葵魁kuò廓扩括阔kuā夸kuān宽kuāng匡框筐kuī亏岿盔窥kuǎ垮kuǎn款kuǐ跬kàn看kàng亢抗炕kào靠káng扛kè克刻客课ké咳壳kòng控kòu寇扣kù库裤酷kùn困kā咖喀kāi开揩kān刊勘堪kāng康慷糠kē柯棵磕科苛蝌颗kēng吭坑kě可坷渴kěn啃垦恳肯kōng空kōu抠kū哭枯窟kūn坤昆kǎ卡kǎi凯慨楷kǎn坎槛砍kǎo拷烤考kǒng孔恐kǒu口kǔ苦kǔn捆le了liàn恋炼练链liàng亮晾谅辆量liào廖撂料镣lián帘廉怜涟联莲连镰liáng凉梁粮粱良liáo僚嘹寥燎疗聊辽liè列劣烈猎裂liù六liú刘榴流浏琉留瘤硫馏liāo撩liū溜liǎ俩liǎn敛脸liǎng两liǔ柳luàn乱luán孪峦挛滦luò洛络落骆luó箩罗萝螺逻锣骡luǎn卵luǒ裸là腊蜡辣lài赖làn滥烂làng浪lào涝烙酪lái来莱lán兰婪拦栏澜篮蓝谰阑láng廊榔狼琅郎láo劳牢lè乐叻lèi泪类累léi擂镭雷léng棱楞lì丽例俐傈利力励历厉吏栗沥痢砺砾立粒荔莉隶lìn吝蔺赁lìng令另lí厘喱梨漓犁狸璃离篱黎lín临林淋琳磷邻霖鳞líng伶凌灵玲羚菱铃陵零龄lòu漏陋lóng咙窿笼聋龙lóu娄楼lù录戮漉潞碌禄赂路陆露鹭鹿麓lùn论lú卢庐炉芦颅lún仑伦沦纶轮lüè掠略lā啦垃拉lāo捞lē肋lēi勒lěi儡垒磊蕾lěng冷lī哩līn拎lōng隆lūn抡lǎ喇lǎn懒揽缆览lǎng朗lǎo佬姥潦老lǐ李理礼里鲤lǐn凛lǐng岭领lǒng垄拢陇lǒu搂篓lǔ卤掳虏鲁lǘ驴lǚ侣吕屡履旅缕铝lǜ律氯滤率绿虑ma吗嘛me么men们miàn面miào妙庙mián宀棉眠绵miáo描瞄苗miè灭蔑miù谬miǎn免冕勉娩缅腼miǎo渺秒藐mà骂mài卖脉迈麦màn慢曼漫蔓mào冒帽茂貌贸má麻mán埋瞒蛮谩馒máng忙氓盲芒茫máo毛矛茅锚mèi妹媚寐昧mèn闷mèng孟梦méi媒枚梅没煤玫眉酶霉mén门méng檬盟萌蒙mì密幂泌秘糸蜜觅谧mìng命mí弥糜谜迷醚靡mín民míng名明螟铭鸣mò墨寞抹末沫漠莫陌默mó摩摹模磨膜蘑魔móu牟缪谋mù募墓幕慕暮木牧目睦穆mā妈māo猫měi每美镁měng猛锰mī眯mō摸mǎ玛码蚂马mǎi买mǎn满mǎng莽mǎo卯铆mǐ米mǐn悯抿敏皿闽mǒu某mǔ亩姆拇母牡ne呢niàn念niàng酿niào尿nián年niáng娘niè啮孽涅聂镊镍niú牛niān拈蔫niē捏niǎn捻撵碾辗niǎo鸟niǔ扭纽钮nuò懦糯诺nuó挪nuǎn暖nà呐娜纳那钠nài奈耐nào淖闹ná拿nán南楠男难náng囊náo挠nè疒nèi内nèn嫩néng能nì匿溺腻逆nìng泞ní倪尼泥霓nín您níng凝宁柠狞nòng弄nóng农浓脓nù怒nú奴nüè疟虐něi馁nī妮nǎ哪nǎi乃奶氖nǎo恼脑nǐ你拟nǐng拧nǔ努nǚ女piàn片骗piào漂票piáo瓢piān偏篇piāo飘piē撇瞥piě丿pà帕怕pài派湃pàn判叛畔盼pàng胖pào泡炮pá爬琶pái徘排牌pán盘磐蹒páng庞旁螃páo刨咆袍pèi佩沛配pèng碰péi培裴赔陪pén盆péng彭朋棚硼篷膨蓬鹏pì僻屁譬辟pìn聘pí啤毗琵疲皮脾pín贫频píng凭坪屏平瓶苹萍评pò破粕迫魄pó婆pù曝瀑铺pú仆脯莆菩葡蒲pā啪趴pāi拍pān攀潘pāng乓pāo抛pēi呸胚pēn喷pēng怦抨澎烹砰pěng捧pī劈噼坯批披砒霹pīn拼pīng乒pō坡泊泼pōu剖pū扑攵pǎng耪pǎo跑pǐ匹痞pǐn品pǒ颇pǔ圃埔普朴浦谱qià恰洽qiàn堑嵌欠歉qiào俏峭撬窍翘鞘qián乾前潜钱钳黔qiáng墙强蔷qiáo乔侨憔桥瞧qiè切怯窃锲qióng琼穷穹qiú囚求泅球酋qiā掐qiān仟千扦牵签谦迁钎铅qiāng呛枪羌腔锵qiāo悄敲橇跷锹qiě且qiū丘秋邱qiǎn凵浅谴遣qiǎng抢qiǎo巧quàn券劝quán全拳权泉痊醛颧què却榷确雀鹊qué瘸quān圈quē缺quǎn犬犭qì器契弃气汽泣砌讫迄qìn沁qìng庆qí其奇崎旗棋歧淇琪畦祁祈脐骑齐qín勤擒琴禽秦芹qíng情擎晴氰qù去趣qú渠qún群裙qī七凄妻戚期柒栖欺沏漆qīn亲侵钦qīng倾卿氢清蜻轻青qū区屈蛆趋躯驱qǐ乞企启岂杞起qǐn寝qǐng请顷qǔ取娶曲龋ruì瑞锐ruò弱若ruǎn软阮ruǐ蕊ràng让rào绕rán然燃ráng瓤ráo饶rè热rèn仞任刃妊纫认韧rén人亻仁壬réng仍rì日ròu肉róng容戎榕溶熔绒茸荣蓉融róu揉柔rù入褥rùn润闰rú儒如孺茹蠕rēng扔rě惹rěn忍rǎn冉染rǎng嚷壤攘rǎo扰rǒng冗rǔ乳汝辱shang裳shi匙shou扌shui氵shuài帅shuì睡税shuí谁shuò朔烁硕shuā刷shuāi摔衰shuān拴栓shuāng双霜shuō说shuǎ耍shuǎi甩shuǎng爽shuǐ水shà厦shài晒shàn善扇擅汕缮膳赡shàng上尚shào哨绍邵shá啥sháo勺芍韶shè射慑摄涉社设赦shèn慎渗甚肾shèng剩圣盛胜shé舌蛇shén什神shéng绳shì世事仕侍势嗜噬士室市式恃拭是柿氏示礻视誓试轼适逝释饰shí十实拾时石蚀识食饣shòu兽受售寿授瘦shù墅庶恕戍数术束树漱竖述shùn瞬舜顺shú孰熟赎shā刹杀沙煞砂纱莎鲨shāi筛shān删山彡杉煽珊苫衫跚shāng伤商墒shāo捎梢烧稍shē奢赊shēn伸呻娠深申砷绅身shēng升声牲生甥shě舍shěn婶审沈shěng省shī失尸师施湿狮虱诗shōu收shū书叔抒枢梳殊淑疏舒蔬输shǎ傻shǎn闪陕shǎng晌赏shǎo少shǐ使史始屎矢驶shǒu守手首shǔ属暑曙署薯蜀黍鼠shǔn吮si思suàn算蒜suì岁碎祟穗遂隧suí绥隋随suān酸suī虽suō唆梭缩蓑suǐ髓suǒ所琐索锁sà萨sài赛sàn散sàng丧sè涩瑟色sì似嗣四寺巳肆饲sòng宋讼诵送颂sòu嗽sù僳塑宿溯粟素肃诉速sú俗sā撒sāi塞腮鳃sān三叁sāng桑sāo搔骚sēn森sēng僧sī丝司嘶撕斯私纟sōng松sōu搜艘sū苏酥sūn孙sǎ洒sǎn伞sǎng嗓sǎo嫂扫sǐ死sǒng怂耸sǒu擞sǔn损笋tiào眺跳tián填恬甜田tiáo条迢tiān天添tiāo挑tiē帖贴tiě铁tiǎn腆舔tuán团tuì蜕褪退tuí颓tuò唾拓tuó陀驮驼鸵tuān湍tuī推tuō托拖脱tuǐ腿tuǒ妥椭tà挞踏蹋tài太态汰泰酞tàn叹探炭碳tàng烫趟tào套tái台抬苔tán坛檀潭痰谈谭táng唐堂塘搪棠糖膛táo桃淘萄逃陶tè忑特téng疼腾藤誊tì剃嚏屉惕替涕tí啼提蹄题tíng亭停庭廷蜓tòng痛tòu透tóng同彤桐瞳童酮铜tóu头投tù兔tú图屠徒涂途tún屯臀tā他塌她它tāi胎tān坍摊滩瘫贪tāng汤tāo掏涛滔绦tī剔梯踢锑tīng厅听汀烃tōng通tōu偷tū凸秃突tūn吞tǎ塔獭tǎn坦忐毯袒tǎng倘淌躺tǎo讨tǐ体tǐng挺艇tǒng捅桶筒统tǔ吐土wa哇wà袜wài外wàn万腕wàng妄忘旺望wá娃wán丸完烷玩顽wáng亡王wèi为位卫味喂尉慰未渭猬畏胃蔚谓魏wèn问wèng瓮wéi唯囗围惟桅潍维违韦wén文纹蚊闻wò卧握斡沃wù务勿坞悟戊晤物误雾wú吴吾无梧毋芜wā挖洼蛙wāi歪wān弯湾豌wāng汪wēi危威巍微萎wēn温瘟wēng嗡翁wěi伟伪委尾纬苇wěn吻稳紊wō挝涡窝蜗wū乌呜屋巫污诬钨wǎ瓦wǎn婉宛惋挽晚皖碗wǎng往枉网wǒ我wǔ五伍侮午捂武舞鹉xin忄xià下吓夏xiàn县宪献现线羡腺限陷馅xiàng像向巷橡象项xiào啸孝效校笑肖xiá侠匣峡暇狭辖霞xián咸嫌弦涎舷衔贤闲xiáng祥翔详xiáo淆xiè卸屑懈械泄泻燮蟹谢xié协挟携斜胁谐邪鞋xióng熊雄xiù嗅秀绣袖锈xiā瞎虾xiān仙先掀纤锨鲜xiāng乡厢湘相箱襄镶香xiāo哮嚣宵消硝萧销霄xiē些楔歇蝎xiě写血xiōng兄凶匈汹胸xiū休修羞xiǎn显险xiǎng享响想xiǎo小晓xiǔ朽xuàn炫眩绚xuán悬旋玄xué学穴xuān喧宣轩xuē削薛靴xuě雪xuǎn癣选xì戏矽系细隙xìn信衅xìng兴姓幸性杏xí习媳席檄袭xíng刑型形行邢xù叙婿序恤旭絮绪续蓄酗xùn殉汛训讯迅逊驯xú徐xún寻巡循旬荀询xī吸嘻夕希息悉惜昔晰析汐溪烯熄熙熹牺犀硒稀膝西锡xīn心忻新欣芯薪辛锌xīng惺星猩腥xū吁嘘墟戌虚需须xūn勋熏xǐ喜洗铣xǐng醒xǔ栩许ya呀yi宜yuàn怨愿苑院yuán元原员园圆垣援源猿缘袁辕yuè岳悦月粤越跃阅yuān冤渊鸳yuē曰约yuǎn远yà亚讶轧yàn厌咽唁堰宴彦晏焰燕砚艳谚雁验yàng恙样漾yào耀药要钥yá崖涯牙芽蚜衙yán严岩延檐沿炎盐研蜒言讠阎颜yáng佯扬杨洋疡羊阳yáo姚尧摇瑶窑谣遥yè业叶夜曳液腋页yé爷耶yì义亦亿屹异役忆意抑易毅溢疫益绎翌翼肄臆艺裔议译诣谊逸邑yìn印yìng映硬yí仪咦夷姨彝怡沂疑移胰遗颐yín吟寅淫银yíng盈荧莹萤营蝇赢迎yòng用yòu佑又右幼柚诱釉yóu尤油游犹由邮铀yù喻域寓峪御愈欲浴狱玉聿育芋裕誉豫遇郁预驭鹬yùn孕熨蕴运酝韵yú于余俞娱愉愚榆渔渝盂竽舆虞逾隅鱼yún云匀耘郧yā丫压押鸦鸭yān淹烟焉阉yāng央殃秧鸯yāo妖腰邀yē噎掖椰yě也冶野yī一伊依医壹揖衣衤铱yīn因姻殷茵荫阴音yīng婴应樱缨英鹦鹰yō哟yōng佣庸拥痈臃雍yōu优幽忧悠yū淤迂yūn晕yǎ哑雅yǎn奄掩演眼衍yǎng仰养氧痒yǎo咬舀yǐ乙以倚已椅矣蚁yǐn尹廴引隐饮yǐng影颖yǒng勇咏恿永泳涌甬蛹踊yǒu友有酉yǔ与予宇屿禹羽语雨yǔn允陨zhe着zhuàn撰篆赚zhuàng壮撞状zhuì坠缀赘zhuó卓啄浊灼茁酌zhuā抓zhuāi拽zhuān专砖zhuāng妆庄桩装zhuī追锥zhuō拙捉桌zhuǎn转zhà乍柞栅榨炸诈zhài债寨zhàn占战栈湛站绽蘸zhàng丈仗帐杖涨瘴胀账障zhào兆召照罩肇赵zhá札铡闸zhái宅zhè浙蔗这zhèn振镇阵震zhèng政正症证郑zhé哲折蛰辙zhì制峙帜志挚掷智治滞炙痔秩稚窒置至致豸质zhí侄值执植殖直职zhòng仲众重zhòu咒宙昼皱骤zhóu轴zhù住助柱注祝筑著蛀贮铸驻zhú烛竹竺逐zhā喳扎渣zhāi摘斋zhān毡沾瞻粘詹zhāng张彰樟漳章zhāo招昭zhē遮zhēn侦帧斟珍甄真砧臻贞针zhēng争征怔挣狰睁筝蒸zhě者锗zhěn枕疹诊zhěng拯整zhī之吱支枝汁知织肢脂芝蜘zhōng中忠盅终衷钟zhōu周州洲粥舟诌zhū朱株猪珠蛛诛诸zhūn谆zhǎ眨zhǎi窄zhǎn展崭斩盏zhǎng掌长zhǎo找沼爪zhǐ只址夂指旨止纸趾zhǒng种肿踵zhǒu帚肘zhǔ丶主嘱拄煮瞩zhǔn准zi子zuì最罪醉zuò作做坐座zuó昨琢zuān钻zuǎn纂zuǐ嘴zuǒ佐左zài再在载zàn暂赞zàng葬zào喿噪灶燥皂躁造zá杂砸zán咱záo凿zèng赠zé则择泽责zéi贼zì字渍自zòng粽纵zòu奏揍zú卒族足zā匝帀zāi哉栽灾zāng脏赃zāo糟遭zēng增憎zěn怎zī兹咨姿孜淄滋资zōng宗棕综踪鬃zōu邹zū租zūn尊遵zǎ咋zǎi宰zǎn攒zǎo早枣澡藻蚤zǐ仔滓籽紫zǒng总zǒu走zǔ祖组诅阻ài爱碍艾隘àn岸按暗案胺àng盎ào傲奥懊澳ái癌皑áng昂áo敖熬翱è厄恶扼遏鄂饿èr二贰é俄娥峨蛾讹额鹅ér儿而ó哦ā阿āi哀哎唉埃挨ān安氨鞍āng肮āo凹ēn恩ěr尔洱耳饵ōu欧殴沤鸥ǎi矮蔼ǎn俺ǎo袄ǒu偶呕藕';
  const CP_TABLE = '万勹,丈乂,三二,下卜,专二龴,且月,世廿,业丷,丛从,东小,丢去,两冂人,严亚,丧土丷□,个人,中口,串口,临口,丹冂,主王,丽冂,举兴二,久入,么厶,义乂,乌勹,乍丅二,乎丷,乏之,乐木,乒丘,乓丘,乖千北,乘禾北,也卩,习刁,买头,乱舌,予龴,争刀聿,事口聿,于二,亏丂,云二厶,互彑,五二,井二,亚业,些此二,亡匸,交亠父,产立,享亠口子,京亠口小,亮亠口冖儿,亲立木,人乀,亿人,什人十,仅人又,仆人卜,仇人九,今人,介人,仍人乃,从人,仑人匕,仓人卩,仔人子,他人也,仗人丈,付人寸,仙人山,仞人刃,代人弋,令人卩,以□人,仪人义,们人门,仰人卬,件人牛,价人介,任人壬,份人分,仿人方,企人止,伍人五,伏人犬,休人木,众人,优人尤,会人云,伞人丷十,伟人韦,传人专,伤人力,伦人仑,伯人白,伴人半,伸人申,似人以,但人旦,位人立,低人氐,住人主,体人本,何人可,余人于八,佛人弗,作人乍,你人尔,佩人几帀,佳人圭,使人吏,侄人至,例人列,依人衣,侧人则,侯人矢,便人更,俗人谷,保人呆,俞人月刀,信人言,俭人佥,修攸彡,俱人具,倍人咅,倒人到,倔人屈,候人矢,倚人奇,借人昔,倡人昌,倦人卷,值人直,倾人顷,假人叚,偏人扁,做人故,停人亭,健人建,偷人俞,傅人甫寸,傍人旁,储人诸,傲人敖,像人象,僧人曽,元二儿,兄口儿,充亠允,兆儿丷八,先土儿,光小兀,克十兄,免刀口儿,兑丷兄,兔刀口儿,兜匚白儿,入乁,全人王,八乁,公八厶,六亠八,共井八,关丷天,兴丷六,兵丘八,其甘八,具目八,典曲八,养羊介,兽丷田口,内冂人,冈冂乂,再冂十,冒冃目,冕冃勉,写冖与,军冖车,农冖,冠冖元寸,冬夕冰,冰水,冲冫中,决冰夬,况冰兄,冷冰令,冻冰东,净冰争,准冰隹,凉冰京,凌冰夌,减冰咸,凑冰奏,凝冰疑,凡几,凤几又,凰几皇,凳登几,凶凵乂,出山凵,击二山,凿丵凵,刃刀,分八刀,切七刀,刑开刀,划戈刀,列歹刀,刘文刀,则贝刀,刚冈刀,创仓刀,初衣刀,删册刀,利禾刀,别另刀,刮舌刀,到至刀,制二巾刀,刷尸巾刀,刹杀刀,刺朿刀,刻亥刀,前丷肉刀,剑佥刀,剥录刀,剩乘刀,剪前刀,副畐刀,割害刀,劝又力,办力八,功工力,加力口,务夕力,动云力,助且力,努奴力,励厉力,劲圣力,劳草冖力,势埶力勢,勃孛力,勇甬力,勉免力,勤堇力,勺勹,勾勹厶,匀勹冰,包勹己,化人匕,北丬匕,匙是匕,匠匚斤,匡匚王,匹匸儿,区匸乂,医匚矢,千十,升千,午干,半丷十,华化十,协十办,单丷甲,卖十买,南十冂丫二,博十尃,占卜口,卡上卜,卧臣卜,卫卩,印卬,危厃卩,即艮卩,却去卩,卷夫八卩,厅厂丁,历厂力,厉厂万,压厂圡,厌厂犬,厘厂里,厚厂日子,原厂白小,厢厂相廂,厨厂豆寸,去土厶,参厶大彡,及乃乀,友又,双又,反厂又,发犮,叔上小又,取耳又,受爪冖又,变亦又,叙余又,叠叒冝,古十口,句勹口,另口力,只口八,叫口丩,叮口丁,可口,台厶口,史口乂,右口,叶口十,号口丂,司口,叹口又,叻口力,叼口刁,叽口几,吃口乞,各夂口,合人口,吉士口,吊口巾,同冂口,名夕口,后厂口,吐口土,向冂口,吓口下,吕口,吗口马,君尹口,吞天口,吟口今,否不口,吧口巴,含今口,听口斤,启户口,吴口天,吵口少,吸口及,吹口欠,吻口勿,呀口牙,呆口木,告牛口,员口贝,呛口仓,呢口尼,周冂土口,味口未,呼口乎,命人叩,和禾口,咏口永,咐口付,咕口古,咖口加,咚口冬,咦口夷,咬口交,咯口各,咸戊口,哀衣口,品口,哇口圭,哈口合,响向口,哑口亚,哗口华,哥可,哧口赤,哨口肖,哪口那,哭口犬,哼口享,唇口辰,唐广肀口,唤口奂,唬口虎,售隹口,唱口昌,啃口肯,啄口豖,商亠丷冂儿口,啊口阿,啡口非,啦口拉,啪口拍,喂口畏,善羊丷口,喉口侯,喊口咸,喘口耑,喜士口丷,喝口曷,喧口宣,喱口厘,喳口查,喷口贲,喻口俞,喿口木,嗓口桑,嗡口翁,嘘口虚,嘱口属,嘴口觜,嘹口尞,噔口登,器口大,噪口喿,噼口辟,嚷口襄,囗冂,四囗儿,回囗口,因囗大,团囗才,园囗元,困囗木,围囗韦,固囗古,国囗玉,图囗冬,圃囗甫,圆囗员,圈囗卷,土十,圣又土,在人土,地土也,场土弓,圾土及,址土止,均土匀,坎土欠,坏土不,坐人土,坑土亢,块土夬,坚又土,坡土皮,垂二土,垃土立,型刑土,垫执土,埋土里,城土成,培土咅,基其土,堂尚土,堆土隹,堡保土,堤土是,堵土者,塌土日羽,塑朔土,塘土唐,塞宀井大土,填土真,境土竟,墙土啬,增土曾,墨黑土,壁辟土,士十,壮丬士,声士尸,壳士冗,壶士冖业,夂乀,处夕卜,备夂田,复日夕,外夕卜,多夕,夜亠人夕,够句多,大人,天大,太大,夫大,夬大,失夫,头大,夸大亏,夹丷大,夺大寸,奂刀冂大,奇大可,奉手乀十,奋大田,奏手乀夭,契丰刀大,奔大卉,奖丬夕大,套大镸,奢大者,奥冂米大,奴女又,奶女乃,她女也,好女子,如女口,妈女马,妖女夭,妙女少,妥爪女,妹女未,妻聿女,始女台,姐女且,姑女古,姓女生,委禾女,姨女夷,姬女匸口,威戊女,娟女肙,娥女我,婆波女,婴贝女,婵女单,媚女眉,嫦女常,子了,孔子,字宀子,存人子,孙子小,孟子皿,季禾子,孤子瓜,学小冖子,孩子亥,宀冖,宁宀丁,它宀匕,宅宀乇,守宀寸,安宀女,宋宀木,完宀元,官宀㠯,定宀疋,宜宀且,宝宀玉,实宀头,宠宀龙,客宀各,宣宀亘,室宀至,害宀丰口,家宀豕,容宀谷,宽宀草见,寂宀叔,寄宀奇,密宀必山,寒宀井大冰,寝宀丬彐冖又,察宀祭,对又寸,寺土寸,寻彐寸,导巳寸,封土寸,射身寸,将爿肉寸將,尊酋寸,小八,少小,尔刀小,尖小大,尚小冂口,尝小冖云,尤尢,尧□兀,就京尤,尺尸乀,尽尺冰,尾尸毛,局尸口,屁尸比,层尸云,居尸古,屈尸出,屋尸至,屏尸并,展尸龷,属尸禹,屠尸者,屡尸娄,履尸復,屯凵,山凵,岁山夕,岂山己,岛勹山,岳丘山,岸山厈,峨山我,峰山夆,崭山斩,巍山魏,州川,工二,左工,巧工丂,巨匚,差羊工,巴巳,巷共己,巾冂,帀巾,市亠巾,布巾,帆巾凡,师帀,希乂布,帘穴巾,帜巾只,带卅冖巾,席广廿巾,帮邦巾,常尚巾,帽巾冒,幅巾畐,幕莫巾,干十,平干丷,年丰,并丷开,幸土丷干,幽山幺,庄广土,庆广大,床广木,序广予,庐广户,库广车,应广小,底广氐,店广占,府广付,废广发,度广廿又,座广坐,庭广廷,康广隶,廉广兼,廊广郎,延廴止,建廴聿,开廾,异已廾,弃亠厶廾,弄王廾,式弋工,引弓,弟丷弔,张弓长,弦弓玄,弯亦弓,弱弓冰,弹弓单,强弓虽,归彐,当小彐,录彐水,形开彡,彤丹彡,彩采彡,彰章彡,影景彡,彳人,彻彳切,彼彳皮,往彳主,径彳圣,待彳寺,很彳艮,律彳聿,徒彳走,得彳日寸,微彳山兀攴,德彳十网心,徽彳山糸攴,必心,忆心,忍刃心,忐上心,忑下心,志士心,忘亡心,忙心亡,忠中心,忧心尤,快心夬,念今心,忽勿心,怀心不,态太心,怅心长,怎乍心,怒奴心,怕心白,思田心,怠台心,怡心台,急刍心,怦心平,性心生,怨夗心,怪心圣,总丷口心,恋亦心,恍心光,恐巩心,恒心亘,恙羊心,恢心灰,恨心艮,恩因心,恭共心,息自心,恰心合,恶亚心,悄心肖,悉采心,悔心每,悟心吾,患串心,悦心兑,您你心,悬县心,悲非心,悴心卒,情心青,惆心周,惊心京,惑或心,惕心易,惜心昔,惭心斩,惯心贯,惰心左肉,想相心,愁秋心,愉心俞,意音心,愚禺心,感咸心,愤心贲,愧心鬼,愿原心,慈茲心,慌心荒,慎心真,慕莫心,慢心曼,慧彗心,慨心既,慰尉心,慷心康,憔心焦,憧心童,憬心景,憾心感,懂心董,懈心解,懊心奥,懒心赖,戋戈,戏又戈,成戊,我手戈,戒廾戈,或口戈,战占戈,戚厂上小戈,截十戈隹,戳翟戈,戴十戈異,户尸,房戶方,所戶斤,扁戶冊,扇戶羽,手二,扎手,扑手卜,打手丁,扔手乃,托手乇,扛手工,扣手口,扫手彐,扬手弓,扭手丑,扯手止,扰手尤,扶手夫,批手比,找手戈,承氶三,技手支,抄手少,把手巴,抑手卬,抓手爪,投手殳,抖手斗,折手斤,抢手仓,护手户,报手卩又,抬手台,抱手包,抵手氐,抹手末,押手甲,担手旦,拆手斥,拇手母,拉手立,拌手半,拍手白,拐手另,拒手巨,拔手犮,拖手也,招手召,拜手,拟手以,拢手龙,拣手东,拥手用,拧手宁,拨手发,择手又二,括手舌,拳丷夫手,拴手全,拼手并,拾手合,拿合手,持手寺,挂手圭,指手旨,按手安,挎手夸,挑手兆,挖手穵,挞手达,挠手尧,挡手当,挣手争,挤手齐,挥手军,挨手矣,挪手那,挫手坐,振手辰,挺手廷,挽手免,捂手吾,捆手困,捉手足,捏手圼,捐手肙,捕手甫,捞手劳,损手员,捡手佥,换手奂,捧手奉,据手居,捷手疌,授手受,掉手卓,掌尚口手,排手非,探手罙,接手妾,控手空,推手隹,掩手奄,措手昔,揉手柔,描手苗,提手是,插手臿,握手屋,援手爰,搂手娄,搏手尃,搓手差,搬手般,搭手荅,摆手罢,摇手爪缶,摊手难,摔手率,摘手啇,摩麻手,摸手莫,撇手敝,撑手掌,撕手斯,撞手童,撤手育攵,撬手毳,播手番,撮手最,擅手亶,操手品木,擦手察,攀棥大手,攘手襄,支十又,攵乂,收丩攴,改己攴,攻工攴,放方攴,政正攴,故古攴,效交攴,敌舌攴,敏每攴,救求攴,教孝攴,敢丅耳攴,散井月攴,敬茍攴,数娄攴,敲高攴,整敕正,敷旉攴,文亠乂,斋文而,斑王文,斗十,料米斗,斜余斗,斟甚斗,斤厂丅,斧父斤,断米斤,斯其斤,新亲斤,方亠勹,施方也,旁亠丷冖方,旅方氏,旋方疋,族方矢,旗方其,无尢,既艮旡,日口,旦日,旧日,旨匕日,早日十,旱日干,时日寸,旷日广,昌日曰,明日月,易日勿,昔井日,星生日,映日央,春手乀日,昧日未,昨日乍,是日疋,显日业,晃日光,晋亚日,晏日安,晒日西,晓日尧,晖日军,晚日免,晨日辰,普並日,景日京,晰日析,晴日青,晶日,晷日咎,智知日,暂斩日,暖日爰,暗日音,暴日共水,曲囗卄,更日人,曹卄曰日,曼曰目又,曾丷口曰,替夫曰,最曰取,月冂,有月,朋月,服月卩又,朗良月,望亡月王,朝十日月,期其月,木十人,未木,末木,本木,术木,朱未,朴木卜,朵几木,机木几,杂九木,杆木干,李木子,村木寸,杜木土,杞木己,束木口,条夕木,来米,杨木弓,杯木不,杰木火,杵木午,松木公,板木反,极木及,构木勾,枕木冘,林木,枚木攴,果日木,枝木支,枣朿冰,枪木仓,枯木古,架加木,某甘木,柑木甘,染水九木,柚木由,柜木巨,查木旦,柱木主,柳木卯,柴此木,柿木市,标木示,栏木兰,树木又寸,校木交,栩木羽,株木朱,样木羊,核木亥,根木艮,格木各,栽十戈木,桃木兆,案安木,桌木卜日,桥木乔,桨丬夕木,桩木庄,桶木甬,梁水刅木,梅木每,梆木邦,梦木夕,梨利木,梯木弟,梳木亠厶川,检木佥,棉木帛,棋木其,棒木奉,棚木朋,森木,棱木夌,棵木果,椅木奇,植木直,椒木叔,椰木耶,楔木契,楚林疋,楠木南,楼木娄,概木既,榕木容,榜木旁,榴木留,模木莫,横木黄,橘木矞,橡木象,檐木詹,欠刀人,次冫欠,欢又欠,欣斤欠,欲谷欠,欺其欠,款士示欠,歇曷欠,歉兼欠,歌哥欠,止上,正止,此止匕,步止小,武弋止,歪不正,歹夕,死歹匕,殖歹直,段丰殳,毁臼工殳,母二,每母,毒丰毋,比匕,毕比十,毛匕,毫亠口冂毛,毯毛炎,毽毛建,气乞,氛气分,氧气羊,水乀,永水,汁水十,求水,汇水匚,汉水又,汗水干,江水工,池水也,污水亏,汤水弓,汪水王,汽水氣,沙水少,沟水勾,没水殳,沮水且,河水可,油水由,治水台,沿水八口,泄水世,泊水白,法水去,泡水包,波水皮,泥水尼,注水主,泪水目,泰手乀水,泳水永,泼水发,洁水吉,洋水羊,洒水西,洗水先,洛水各,洞水同,津水聿,洪水共,洲水州,活水舌,派水厂氏,流水亠厶川,浅水戋,浆丬夕水,浇水尧,浏水文刀,浑水军,浒水许,浓水农脓,浩水告,浪水良,浮水孚,海水每,涂水余,消水肖,涣水奂,润水闰,涨水张,涩水刃止,涯水厓,液水夜,淇水其,淋水林,淘水匋,淡水炎,淮水隹,深水罙,淳水享,混水昆,淹水奄,添水忝,清水青,渊水米,渐水斩,渔水鱼,渡水度,温水昷,港水巷,渴水曷,游水斿,湖水胡,湛水甚,湾水弯,湿水显,溃水贵,溅水贱,源水原,溜水留,溢水益,溪水奚,滑水骨,滔水舀,滚水衮,满水草两,滤水虑,滥水监,滨水宾,滩水难,滴水啇,漂水票,漉水鹿,漏水屚,演水寅,漠水莫,漫水曼,潜水替,潮水朝,澈水育攵,澜水阑,澡水品木,激水敫,瀑水暴,火丷人,灯火丁,灰厂火,灵彐火,灸久火,灿火山,炉火户,炎火,炒火少,炖火屯,炙肉火,炫火玄,炭山灰,炮火包,炯火冋,炸火乍,点占火,炼火东,烁火乐,烂火兰,烈列火,烛火虫,烟火因,烤火考,烦火页,烧火尧,烫汤火,热执火,焉正勹火,焕火奂,焚林火,然肉犬火,煎前火,煤火某,照日召火,煮者火,熄火息,熊能火,熙巸火,熟孰火,熨尉火,熬敖火,熹喜火,燃火然,燥火品木,燮火言又,爆火暴,爪厂乀,爬爪巴,爱爪冖友,父八乂,爷父卩,爸父巴,爹父多,片丄,版片反,牌片卑,牙丅,牛十,牢宀牛,物牛勿,牵大冖牛,特牛寺,犬大,状丬犬,犹犬尤,狂犬王,狐犬瓜,狗犬句,狠犬艮,独犬虫,狮犬师,狸犬里,狼犬良,猎犬昔,猛犬孟,猪犬者,猫犬苗,猬犬胃,献南犬,猴犬侯,率玄冰十,玉王,王土,玩玉元,环玉不,现玉见,玲玉令,玻玉皮,珊玉冊,珍玉人彡,珠玉朱,班王刂,球玉求,理玉里,琪玉其,琴玉今,瑚玉胡,璀玉崔,璃玉离,璧辟玉,璨玉粲,瓜爪,瓣辛瓜,瓶并瓦,甘廿,甚甘匹,甜舌甘,生牛,甥生男,用月,甩月,甫用,甬龴用,田囗十,由囗十,电日,男田力,画由凵,畅申弓,界田介,畐口田,畔田半,留卯田,略田各,番釆田,疏疋亠厶川,疑匕矢龴疋,疒厂冫,疗病了,疲病皮,疼病冬,疾病矢,病丙,痒病羊,痛病甬,瘁病卒,瘦病叟,瘸病加肉,登癶豆,白日,百白,皂白七,的白勺,皆比白,皮又,皱刍皮,皿冊,盆分皿,盈乃又皿,益丷八皿,盏戋皿,盐土卜皿,盒合皿,盖草羊皿,盗次皿,盘舟皿,盛成皿,目囗二,盯目丁,直十目,相木目,盼目分,盾厂十目,省少目,眉尸目,看手目,真十目八,眨目乏,眯目米,眶目匡,眷丷夫目,眼目艮,着羊目,睛目青,睡目垂,睫目疌,瞩目属,瞪目登,瞬目舜,瞻目詹,矗直,矛予,知矢口,矩矢巨,短矢豆,矮矢委,石口,矿石广,码石马,砍石欠,研石开,砖石专,砰石平,破石皮,砸石匝,砺石厉,硬石更,确石角,碉石周,碌石录,碍石日寸,碎石卒,碑石卑,碗石宛,碟石枼,碰石並,碳石炭,磊石,磕石盍,磨麻石,示二小,礼示,社示土,祝示兄,神示申,祥示羊,票西示,祭夗示,祸示呙,禁林示,福示畐,离隹離,禾木,秀禾乃,私禾厶,秋禾火,种禾中,科禾斗,秒禾少,秘禾必,租禾且,秤禾平,秦手乀禾,积禾只,称禾尔,移禾多,程禾呈,稍禾肖,稠禾周,稳禾急,稻禾舀,稼禾家,穴宀八,究穴九,穷穴力,穹穴弓,空穴工,穿穴牙,突穴犬,窄穴乍,窗穴囱,窜穴串,窝穴呙,窟穴屈,窿穴隆,立亠丷,竖刂又立,站立占,竞立兄,竟立日儿,章立早,童立里,端立耑,竺竹二,竽竹于,竿竹干,笆竹巴,笑竹夭,笔竹毛,笛竹由,第竹弔,笼竹龙,等竹寺,筋竹肉力,筐竹匡,筑竹巩,答竹合,策竹朿,筝竹争,筷竹快,筹竹寿,签竹佥,简竹间,算竹目廾,管竹官,箭竹前,箱竹相,篇竹扁,篮竹监,篱竹离,簇竹族,米丷木,类米大,粉米分,粒米立,粗米且,粮米良,粽米宗,精米青,粿米果,糊米胡,糕米羔,糖米唐,糙米造,糟米曹,糯米需,糸幺小,系幺小,紊文丝,素丰丝,紧又丝,紫此丝,累田糸,繁每攴丝,纠丝丩,红丝工,约丝勺,级丝及,纪丝己,纯丝屯,纷丝分,纸丝氏,纹丝文,线丝戋,练丝东,组丝且,细丝田,织丝只,终丝冬,绊丝半,绍丝召,绎丝又二,经丝圣,绑丝邦,结丝吉,绕丝尧,给丝合,络丝各,绝丝色,绞丝交,统丝充,继丝米,绩丝责,绪丝者,续丝卖,绳丝黾,维丝隹,绸丝周,绽丝定,绿丝录,缓丝爰,编丝扁,缘丝彖,缝丝逢,缠丝广里,缤丝宾,缩丝宿,缪丝翏,缶二山,缸缶工,缺缶夬,罐缶雚,网冂乂,罗网夕,罚网言刀,罪网非,置网直,羊丷三,美羊大,羞羊丑,羡羊次,群君羊,羹羔美,羽习,翁公羽,翅支羽,翘尧羽,翠羽卒,翡非羽,翰十日人羽,翻番羽,翼羽異,耀光翟,老土匕,考土丂,者土日,而冂,耍而女,耐而寸,耻耳止,耽耳冘,聊耳卯,聋龙耳,职耳只,联耳关,聚耳又乑,聪耳总,聿彐二,肃聿八,肉冂人,肖小肉,肚肉土,股肉殳,肤肉夫,肥肉巴,肩戶肉,肪肉方,肮月亢,肯止肉,育亠厶肉,胆肉旦,背北肉,胎肉台,胖肉半,胜肉生,胞肉包,胡古月,胸肉匈,能厶肉匕,脂肉旨,脆肉危,脍肉会,脏肉庄,脑肉亠乂凵,脖肉孛,脚肉却,脱肉兑,脸肉佥,脾肉卑,腆肉典,腐府肉,腼肉面,腾肉丷夫马,腿肉退,膀肉旁,膝肉桼,臣巨,自目,臭自犬,至厶土,致至攴,舀爪臼,舅臼男,舌千口,舍人舌,舒舍予,舞卌舛,舟冂,航舟亢,般舟殳,船舟八口,艘舟叟,良艮,艰又艮,色刀巴,艳丰色,艺草,节竹卩,芋草于,芒草亡,芝草之,花草化,芽草牙,苍草仓,苏草办,苗草田,苟草句,若草右,苦草古,英草央,苹草平,茂草戊,范草氾,茅草矛,茧草虫,茫草水亡,茬草在,茶草人小,茸草耳,荀草旬,荆井刀,草早,荒草巟,荡草汤,荣草冖木,药草约,荷草何,莫草日大,莱草来,莲草连,获草犬,莹艹冖玉,菇草姑,菜草采,菠草波,菩草咅,萄草匋,萝草罗,萤艹冖虫,营艹冖吕,萨草阜产,落草洛,著草者,葛草曷,葡草匍,董草重,葱草怱,蒸草烝,蓄草畜,蓉草容,蓝草监,蓬草逢,蔓草曼,蔗草庶,蔚草尉,蔬草疏,蔺草门隹,蔼草谒,蔽草敝,蕉草焦,蕴草缊,薄草水甫寸,薪草新,藏草臧,蘑草磨,虎儿,虑虎心,虚虎业,虫口厶,虹虫工,虽口虫,虾虫下,蚁虫义,蚂虫马,蚌虫丰,蚕天虫,蚪虫斗,蛇虫它,蛋疋虫,蛙虫圭,蛛虫朱,蜀罒勹虫,蜂虫夆,蜓虫廷,蜗虫呙,蜘虫知,蜜宀必虫,蜻虫青,蝇虫黾,蝉虫单,蝌虫科,蝴虫胡,蝶虫枼,螃虫旁,融鬲虫,螺虫累,蟹解虫,血皿,行彳亍,衍行水,街行圭,衡行刀田大,衣,补衣卜,表丰,袋代衣,袖衣由,被衣皮,裂列衣,装壮衣,裤衣库,裹衣果,褐衣曷,西口儿,要西女,覆西復,见冂,观又见,规夫见,视示见,览见,觉小冖见,解角刀牛,触角虫,言二口,誉兴言,誓折言,警敬言,讠二口訁,计言十,认言人,讨言寸,让言上,训言川,讯言卂,记言己,讲言井,讶言牙,许言午,讹言化,论言仑,讽言风,设言殳,访言方,证言正,评言平,识言只,诉言斥,词言司,译言又二,试言式,诗言寺,诚言成,话言舌,该言亥,语言吾,误言吴,说言兑,诵言甬,请言青,诸言者,诺言若,读言卖,课言果,谁言隹,调言周,谅言京,谈言炎,谊言宜,谐言皆,谓言胃,谜言迷,谢言射,谦言兼,谧言必皿,谨言堇,谬言翏,谱言普,豆口丷,象刀口豕,豫予象,貌豸白儿,贝冂人,负刀贝,财贝才,责丰贝,贤又贝,败贝攴,账贝长,货化贝,质厂十贝,贩贝反,贫分贝,购贝勾,贯母贝,贴贝占,贵中贝,费弗贝,贺加贝,资次贝,赏尚贝,赔贝咅,赚贝兼,赛宀井大贝,赞先贝,赠贝曾,赢亡口月贝凡,赤土八,走十疋,赵走乂,赶走干,起走己,趁走人彡,超走召,越走戉,趟走尚,趣走取,足口卜人,趴足八,跃足夭,跋足犮,跌足失,跑足包,跚足册,跟足艮,跨足夸,跬足圭,路足各,跳足兆,践足戋,跷足尧,跺足朵,踏足沓,踝足果,踢足易,踩足采,踵足重,蹈足舀,蹒足草两,蹦足崩,蹬足登,躁足品木,身且,躬身弓,躲身朵,躺身尚,车十,轩车干,转车专,轮车仑,软车欠,轰车又,轻车圣,轼车式,载十戈车,较车交,辆车两,辈非车,输车俞,辛立十,辞舌辛,辟尸口辛,辣辛束,辨辛,辩辛言,辫辛丝,辰厂衣,辱辰寸,边辵力,辽辵了,达辵大,迁辵千,过辵寸,迎辵卬,运辵云,近辵斤,返辵反,还辵不,这辵文,进辵井,远辵袁,违辵韦,连辵车,迟辵尺,迥辵冋,迪辵由,迫辵白,述辵术,迷辵米,迹辵亦,追辵戶,退辵艮,送辵关,适辵舌,逃辵兆,选辵先,透辵秀,逐辵豕,递辵弟,途辵余,逗辵豆,通辵甬,逛辵狂,造辵告,逢辵夆,逸辵免,逼辵畐,遇辵禺,遍辵扁,道辵首,遗辵贵,遥辵爪缶,遭辵曹,遮辵庶,遵辵尊,避辵辟,邀辵敫,那月邑,邦丰邑,邻令邑,郊交邑,郑关邑,部咅邑,郭享邑,都者邑,酌酉勺,配酉己,酒水酉,酝酉云,酥酉禾,酬酉州,酱丬夕酉,酸酉夋,酿酉良,醒酉星,采爪木,释采又二,里甲二,重里,野里予,量日里,金人王丷,釜父金,钅人王丷釒,针金十,钉金丁,钝金屯,钞金少,钟金中,钢金冈,钥金月,钩金勾,钮金丑,钱金戋,钻金占,铁金失,铃金令,铅金几口,铜金同,铲金产,银金艮,铺金甫,销金肖,锄金助,锅金呙,锈金秀,锋金夆,错金昔,锣金罗,锤金垂,锥金隹,键金建,锲金契,锵金将,锻金段,镇金真,镊金聂,镜金竟,闪门人,闭门才,问门口,闯门马,闲门木,间门日,闹门市,闻门耳,阁门各,阔门活,队阜人,防阜方,阳阜日,阴阜月,阵阜车,阻阜且,阿阜可,附阜付,际阜示,陆阜击,陈阜东,陋阜丙,陌阜百,降阜夅,限阜艮,院阜完,除阜余,险阜佥,陪阜咅,陶阜匋,陷阜臽,隆阜夂生,随阜迶,隐阜急,隔阜鬲,隙阜小日,难又隹,雀少隹,集隹木,雨冂,雪雨彐,零雨令,雷雨田,雾雨务,需雨而,震雨辰,霉雨母,霞雨叚,露雨路,霸雨革月,青丰月,静青争,非三,靠告非,面囬,革廿口十,鞋革圭,鞠革匊,韦二,韩十日韦,音立日,韵音匀,页贝,顶丁页,项工页,顺川页,须彡页,顽元页,顾厄页,顿屯页,颁分页,领令页,颇皮页,颈圣页,颊夹页,频步页,颗果页,题是页,颜彦页,额客页,颠真页,风几乂,飘票风,飞丷,食人良,餐歹又食,饣人良飠,饭食反,饮食欠,饱食包,饺食交,饼饣并,饿食我,馅食臽,馆食官,馋食免冫,馒食曼,首丷目,香禾日,驳马爻,驴马户,驶马史,驼马它,骄马乔,骆马各,验马佥,骏马夋,骑马奇,骗马扁,骤马聚,高亠口冂,鬼田儿厶,魄白鬼,魏委鬼,魔麻鬼,鱼刀田,鲜鱼羊,鲤鱼里,鲨沙鱼,鸟勹,鸡又鸟,鸣口鸟,鸭甲鸟,鸽合鸟,鹅我鸟,鹉武鸟,鹦婴鸟,鹬矞鸟,鹭路鸟,鹰广人隹鸟,鹿广比,麦丰夕,麻广林,黄艹田八,黑口丷土火,默黑犬,鼎目爿片,鼓十豆支,鼠臼乀,鼻自田廾,齐文,龄齿令,龙尤,龟刀电';
  let PY_FB = null, CP = null;
  function pyFallback() {
    if (PY_FB) return PY_FB;
    PY_FB = Object.create(null);
    const re = /([^\u3400-\u9fff]+)([\u3400-\u9fff]+)/g;
    let m;
    while ((m = re.exec(PY_TABLE))) { const sy = m[1]; for (const ch of m[2]) if (!(ch in PY_FB)) PY_FB[ch] = sy; }
    return PY_FB;
  }
  /* WORD_FIX：题库没有整词注音、按“单字取最常见读音”会读错的多音字词（引擎修复员逐条核对后内嵌；题库有注音时仍以题库为准）。
     “词:拼音”，逗号分隔 */
  const WORD_FIX_TABLE = '馒头:mán tou';
  let WF = null;
  function wordFix() {
    if (WF) return WF;
    WF = Object.create(null);
    WORD_FIX_TABLE.split(',').forEach((e) => {
      const m = /^([\u3400-\u9fff]+):(.+)$/.exec(e.trim());
      if (m && Array.from(m[1]).length === m[2].trim().split(/\s+/).length) WF[m[1]] = m[2].trim();
    });
    return WF;
  }
  /* 部件表 → {of: 字→部件数组, w: 部件→权重}。权重按“多少字含这个部件”算：青、佥这类声旁很稀有 → 高；氵口木这类常见部首 → 低 */
  function comps() {
    if (CP) return CP;
    const of = Object.create(null), f = Object.create(null);
    CP_TABLE.split(',').forEach((e) => { const a = Array.from(e); if (a.length < 2) return; of[a[0]] = a.slice(1); a.slice(1).forEach((c) => { f[c] = (f[c] || 0) + 1; }); });
    const N = Math.max(1, Object.keys(of).length), w = Object.create(null);
    // 两三笔的小部件（丷 冖 亠 八 十 …）出现得少、权重会虚高，但几乎不决定字形 → 封顶 0.4
    const TRIV = '丷冖亠八十厂冂卜丁人入儿几刀力又乂匕冫亅勹匚卩厶廾彡夂夊丬亻彳刂阝';
    for (const c in f) w[c] = TRIV.indexOf(c) >= 0 ? 0.3 : clamp((Math.log2(N / f[c]) - 3.5) / 2, 0.2, 2.5);
    CP = { of, w, N };
    return CP;
  }
  /* 两个字的字形相近分：共享部件的权重之和；一个字本身是另一个的部件（青 / 清）也算 */
  function shapeScore(ch, cs, k) {
    const T = comps(), ks = T.of[k];
    let sc = 0;
    if (cs && ks) for (let i = 0; i < cs.length; i++) if (ks.indexOf(cs[i]) >= 0) sc += T.w[cs[i]] || 0.2;
    if (ks && ks.indexOf(ch) >= 0) sc += T.w[ch] || 1.5;
    if (cs && cs.indexOf(k) >= 0) sc += T.w[k] || 1.5;
    return sc;
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
      const maxN = Math.max(P.maxLen, A.maxLen, A.hintMax || 1);
      // 单字：全部年级题库注音里最常见的读音 → 常用字表 → 实在没有才 '·'（本年级样本太少，易取到轻声）。
      // 词：课本整词注音（本年级 → 全部年级）→ WORD_FIX → “只知道其中一个字本课读音”的词（A.hint），都按最长优先
      const single = (ch) => A.tone[ch] || pyFallback()[ch] || '·';
      for (let j = 0; j < hanIdx.length;) {
        let hit = 0;
        for (let n = Math.min(maxN, hanIdx.length - j); n >= 2 && !hit; n--) {   // 长词优先；同样长时课本整词注音优先于“只知道一个字”的词
          if (hanIdx[j + n - 1] - hanIdx[j] !== n - 1) continue;   // 中间隔着标点就不算一个词
          let w = '';
          for (let q = 0; q < n; q++) w += chs[hanIdx[j + q]];
          const py = P.words[w] || A.words[w] || wordFix()[w];
          const ss = py ? py.split(' ') : null;
          if (ss && ss.length === n) {
            for (let q = 0; q < n; q++) { syl[hanIdx[j + q]] = ss[q]; fixed[hanIdx[j + q]] = true; }
            hit = n;
            continue;
          }
          const hv = A.hint && A.hint[w];
          if (!hv) continue;
          for (let q = 0; q < n; q++) {
            const i = hanIdx[j + q];
            if (hv[q] != null) { syl[i] = hv[q]; fixed[i] = true; } else syl[i] = single(chs[i]);
          }
          hit = n;
        }
        if (hit) { j += hit; continue; }
        syl[hanIdx[j]] = single(chs[hanIdx[j]]);
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
  /* 干扰字：按“像不像”打分排序——读音分（同音 4 > 近音：平翘舌 / n-l / f-h / 前后鼻音 2 > 同韵母 0.8 > 同声母 0.5）
     + 字形分（共享部件：青、佥这类稀有声旁 ≈2.3，常见部首 ≈0.3–1，见 shapeScore）；同分随机。
     这样同音字不够时先补形近字（栩→翔、验→险），不会再补出 栩→圃、傲→道 这种一眼就能排除的字；最后才是本年级其它字。
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
    const py = bare[ch] || A.bare[ch] || toneless(pyFallback()[ch] || '');
    const [ini, fin] = py ? splitPy(py) : ['', ''];
    const cs = comps().of[ch] || null;
    const cand = [];
    for (const k in bare) {
      if (ex.has(k)) continue;
      let snd = 0;
      if (py) {
        const q = bare[k];
        if (q === py) snd = 4;
        else {
          const [i2, f2] = splitPy(q);
          if ((f2 === fin && ini && NEAR_I[ini] === i2) || (i2 === ini && NEAR_F[fin] === f2)) snd = 2;
          else if (f2 === fin) snd = 0.8;
          else if (ini && i2 === ini) snd = 0.5;
        }
      }
      if (ctxWords.length && ctxWords.some((w) => { const w2 = w.split(ch).join(k); return w2 !== w && (w2 in A.words || w2 in P.words); })) continue;
      cand.push({ k, sc: snd + shapeScore(ch, cs, k), r: Math.random() });
    }
    cand.sort((a, b) => (b.sc - a.sc) || (a.r - b.r));
    const out = [];
    for (let i = 0; i < cand.length && out.length < n; i++) out.push(cand[i].k);
    return out;
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
      // 3.0 新栏目（ext_*.json）：jg {c, jg, py, w}、zuci {c, py, ok:[…], bad:[…]}、recipes {a, b, ans, py, word}、
      // bushou {c, bs, fam}、menu {id, name, mw, kind, …}。游戏交来的浅拷贝多一个 hz 也认得
      case 'jg': return typeof it.c === 'string' && typeof it.jg === 'string' && !Array.isArray(it.words) && !Array.isArray(it.ok);
      case 'zuci': return typeof it.c === 'string' && Array.isArray(it.ok);
      case 'recipes': return typeof it.ans === 'string' && typeof it.a === 'string' && typeof it.b === 'string';
      case 'bushou': return typeof it.c === 'string' && typeof it.bs === 'string' && typeof it.fam === 'string' && !Array.isArray(it.words);
      case 'menu': return typeof it.name === 'string' && typeof it.mw === 'string' && typeof it.kind === 'string';
      default: return true;
    }
  }
  const starsFor = (r) => (r >= 0.9 ? 3 : r >= 0.6 ? 2 : r >= 0.3 ? 1 : 0);
  /* 游戏注册信息（名字 / 图标 / 技能）：核心的 HW.games 不带 icon，这里包一层 HW.register 把注册时的 def 记下来。
     本文件在各游戏文件之前加载，所以所有 HW.register 都会经过这里；核心自己的逻辑不受影响 */
  const META = Object.create(null);
  (function wrapRegister() {
    const orig = HW.register;
    if (typeof orig !== 'function' || orig.__arcMeta) return;
    const wrapped = function (def) {
      try { if (def && typeof def === 'object' && def.id != null) META[String(def.id)] = { id: String(def.id), name: def.name || '', icon: def.icon || '', skill: def.skill || '', blurb: def.blurb || '', kind: def.kind || '' }; } catch (e) { /* ignore */ }
      return orig.apply(this, arguments);
    };
    wrapped.__arcMeta = true;
    try { HW.register = wrapped; } catch (e) { /* ignore */ }
  })();
  const LIVE = new Set();   // 正在运行的游戏实例（HW.arcade.stats 用；正常情况下最多 1 个）
  const SKILL_ICON = { listen: '🎧', speak: '🎤', read: '📖', write: '✏️' };

  /* ================= HW.arcade.run ================= */
  function run(ctx, spec) {
    spec = spec || {};
    injectCss();
    const meta = (() => {
      const m = META[ctx.gameId];
      let core = {};
      try { core = (HW.games || []).find((x) => x && x.id === ctx.gameId) || {}; } catch (e) { core = {}; }
      return Object.assign({}, core, m || {});
    })();
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
    const END_SKIP_T = 0.6;   // 结算面板出现后多少秒起，点一下 / Enter 才能跳过结算动画（面板在结束后 endDelay 秒出现，默认 0.5）
    const MIN_H = 240;        // 画布最小高度（再矮就只能让页面滚动了）
    let shownScore = 0, shownProg = 0, scoreBump = 0, comboBump = 0, capT = 0, capText = '', speaking = 0, sayWave = 0;
    let musicOn = !!spec.music, musicStyle = spec.music || 'bright', musicBpm = 0;
    let activeId = null, pool = null;
    const multi = !!spec.multiTouch, ptrs = new Set();   // spec.multiTouch：每根手指都交给 down/move/up（p.id 区分）
    let endDelay = 0.5, revealText = null, capDur = 1.5, capY = null, wantCursor = '', mic = null;
    let sayGen = 0, pauseN = 0, stopN = 0, silentN = 0;
    const heartUp = [];   // 加心动画计时（g.heal）
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
      sky: spec.sky === undefined ? 'day' : spec.sky, bgSpeed: 1, horizon: 0, roadLanes: 3, roadSpeed: 7, road: sky.road, palms: spec.palms !== false,
      held: { left: false, right: false, up: false, down: false, space: false, enter: false },
      speaking: false, c: c2, ease: EASE, frameMs: 0,
      vt: 0, dt: 0, countdown: -1, cdT: 0, cam: { x: 0, y: 0 }, ttsBroken: false, comboAt: null, captionY: null,
      meta: { id: ctx.gameId || '', name: gameName, icon: '', skill: meta.skill || '' }
    };
    g.meta.icon = gameIcon;
    Object.defineProperty(g, 'ttsOK', { enumerable: true, get() { let ok = false; try { ok = !!(ctx.tts && ctx.tts.ok); } catch (e) { ok = false; } return ok && !g.ttsBroken; } });
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
    /* o.playOnly（或 spec.playOnly:true 设为默认）：本关结束（win/lose 进入 over）时自动取消，不在结算动画里触发 */
    const poOf = (o) => (o && o.playOnly != null ? !!o.playOnly : !!spec.playOnly);
    function after(sec, fn, o) {
      const tm = { t: Math.max(0, +sec || 0), fn, dead: false, po: poOf(o), cancel() { this.dead = true; } };
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
    function tween(obj, props, sec, ease, onDone, o) {
      if (onDone && typeof onDone === 'object' && o === undefined) { o = onDone; onDone = null; }
      const tw = { obj, k: [], a: [], b: [], t: 0, d: Math.max(0.0001, +sec || 0), e: typeof ease === 'function' ? ease : (EASE[ease] || EASE.outQuad), done: typeof onDone === 'function' ? onDone : null, dead: false, po: poOf(o), cancel() { this.dead = true; } };
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
    function killPlayOnly() {
      timers.forEach((t) => { if (t.po) t.dead = true; });
      tweens.forEach((t) => { if (t.po) t.dead = true; });
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
      // 错题重练：只练错题，不算闯关——不解锁、不写本关星级 / 最高分 / last（结算页也就不会出现“已解锁”“新纪录”）
      if (g.isReview) return { unlocked: 0, newHi: false, prevHi: memGet().hi, review: true };
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
      if (endScoreNode) endScoreNode.textContent = String(g.score);
      if (endInfo.review) return;
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
      const s = clamp(Math.min(g.w / 390, g.h / 540), 0.8, 1.25);   // 矮屏（手机横拿）HUD 跟着缩，别吃掉太多高度
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
      const bleed = vw < 640 || (vh < 500 && vw > vh);   // 手机竖屏 / 手机横屏：满宽贴边
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
      // 高 = 视口剩余高度（最少 MIN_H）。原来最少 480：手机横拿（844×390，顶栏下只剩约 338）时画布下半截在屏幕外，
      // 画布又是 touch-action:none 滑不动 → 底部的角色 / 按钮既看不到也点不到。现在贴合可见高度，游戏按 g.h 排版
      const h = Math.max(MIN_H, Math.floor(vh - top - (bleed ? 0 : 10)));
      root.style.height = h + 'px';
      root.classList.toggle('is-short', h < 470);
      root.classList.toggle('is-tiny', h < 300);
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
    /* spec.intro / spec.controls 可以是字符串，也可以是 function(level, g) → 字符串（按关卡换玩法提示）；每次倒计时都重新取 */
    function textOf(v, lv) {
      if (typeof v === 'function') { try { v = v.call(spec, lv, g); } catch (e) { v = ''; } }
      return v == null || v === false ? '' : String(v);
    }
    /* 触屏设备（手机 / 没接键盘鼠标的 iPad）不提键盘：“键盘 …”“空格重听”“← →”这些对孩子是多余的字，只留手指的玩法 */
    function ctrlOf(lv) {
      const s0 = textOf(spec.controls, lv);
      let touchOnly = false;
      try { touchOnly = !!(W.matchMedia && W.matchMedia('(pointer:coarse)').matches && !W.matchMedia('(any-pointer:fine)').matches); } catch (e) { touchOnly = false; }
      if (!touchOnly || !s0) return s0;
      const KEY = /键盘|空格|方向键|数字键|Enter|回车|[←→↑↓⌫]|QWER|ASDF|YUIO|HJKL|(?:^|\s)[A-Z](?:\s|$)/;
      const t = s0.replace(/[（(][^）)]*(?:空格|键|[A-Z])[^）)]*[）)]/g, '').replace(/或空格/g, '').replace(/\/空格\s*/g, ' ').replace(/\s+\/\s+空格\s+/g, ' ');
      const segs = t.split(/\s*·\s*/).map((seg) => seg.split(/\s+\/\s+/).filter((x) => x && !KEY.test(x)).join(' / ')).filter(Boolean);
      return segs.length ? segs.join(' · ') : s0;
    }
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
      const blurb = el('p', 'arc-blurb', textOf(spec.intro, selLv));
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
      { const short = g.h < 470;   // 矮屏（手机横拿）：32px 圆点排成一行，省出一行高度
        const per = short ? Math.min(maxLevel, 10) : maxLevel <= 6 ? maxLevel : Math.min(8, Math.ceil(maxLevel / 2));   // 手机上 40px 圆点：10 关排成 5×2
        dots.style.maxWidth = short ? (per * 32 + (per - 1) * 6) + 'px' : (per * 40 + (per - 1) * 8) + 'px'; }
      const dotBtns = [];
      for (let i = 1; i <= maxLevel; i++) {
        const d = el('button', 'arc-dot', i); d.type = 'button';
        d.addEventListener('click', () => { if (i <= m.lv) { selLv = i; refresh(); playSfx('tick'); } });
        dots.appendChild(d); dotBtns.push(d);
      }
      const go = btn('go', '开始！', () => begin(selLv), '开始第几关');
      p.append(icon, blurb, row, dots, go);
      const ctrl = el('p', 'arc-ctrl', '');
      if (spec.controls) { ctrl.textContent = '🎮 ' + ctrlOf(selLv); p.appendChild(ctrl); }
      if (m.hi > 0) p.appendChild(el('p', 'arc-hi', '🏆 最高分 ' + m.hi));
      // 手机横拿：画面矮，提示竖过来（不挡操作，横着也能玩）
      let coarse = false;
      try { coarse = !!(W.matchMedia && W.matchMedia('(pointer:coarse)').matches); } catch (e) { coarse = false; }
      if (coarse && g.h < 430 && g.w > g.h * 1.4) p.appendChild(el('p', 'arc-rot', '📱 把手机竖过来玩，画面更大'));
      function refresh() {
        num.textContent = selLv; g.level = selLv;
        if (typeof spec.intro === 'function') blurb.textContent = textOf(spec.intro, selLv);
        if (typeof spec.controls === 'function') ctrl.textContent = '🎮 ' + ctrlOf(selLv);
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
      setState('intro'); phase = 'count'; cdT = 0; cdStep = -1; g.countdown = 3; g.cdT = 0;
      layer.classList.remove('is-off'); pbtn.hidden = true;
      const box = el('div', null);
      // width:100%：说明框的 max-width 百分比要相对整个遮罩算，否则会被挤成很窄、提前折行
      box.style.cssText = 'display:flex;flex-direction:column;align-items:center;gap:14px;width:100%';
      const short = g.h < 470;
      const numBox = el('div', null); numBox.style.cssText = 'height:' + (short ? '104px' : 'clamp(120px,36vw,180px)') + ';display:grid;place-items:center';
      box.appendChild(numBox);
      const it = textOf(spec.intro, g.level), ct = ctrlOf(g.level);
      if (it) box.appendChild(el('div', 'arc-cd-t', it));
      if (ct) box.appendChild(el('div', 'arc-cd-c', ct));
      const wrap = el('div', 'arc-cd'); wrap.style.cssText = 'display:contents';
      wrap.appendChild(box);
      setOv(wrap, false);
      ov.classList.add('arc-cd');
      // spec.countdownAt：'top' | 'center'（默认）| 'bottom'，或 function(g) → 其一。倒计时和说明别压住游戏画在画面中间的东西
      let at = spec.countdownAt;
      if (typeof at === 'function') { try { at = at.call(spec, g); } catch (e) { at = null; } }
      if (at === 'top' || at === 'bottom') ov.classList.add('at-' + at);
      showCountdown.num = numBox;
      if (musicOn) musicStart(musicStyle, musicBpm);
      say('第 ' + g.level + ' 关，准备');
    }
    function countTick(dt) {
      cdT += dt; g.cdT = cdT;
      const step = cdT < 0.62 ? 0 : cdT < 1.24 ? 1 : cdT < 1.86 ? 2 : cdT < 2.5 ? 3 : 4;
      if (step === cdStep) return;
      cdStep = step;
      g.countdown = step < 3 ? 3 - step : step === 3 ? 0 : -1;   // 3 → 2 → 1 → 0（“开始！”）→ -1（进入 play）
      if (step === 4) { beginPlay(); return; }
      const n = showCountdown.num;
      if (!n) return;
      const d = el('div', 'arc-cd-n' + (step === 3 ? ' go' : ''), step === 3 ? '开始！' : String(3 - step));
      n.replaceChildren(d);
      playSfx(step === 3 ? 'go' : 'tick');
    }
    function beginPlay() {
      setOv(null);
      setState('play'); phase = 'play'; g.countdown = -1;
      pbtn.hidden = false;
      cursorApply();
      try { cv.focus({ preventScroll: true }); } catch (e) { /* ignore */ }
      say('开始');
      call(spec.play);
    }
    function pause() {
      if (state !== 'play' || dead || errored) return;   // 出错面板上不能再叠暂停面板（继续会失效）
      setState('pause');
      musicStop();
      pauseN++;   // 让正在进行的 g.say 知道自己是被暂停打断的（resolve 值带 interrupted:true）
      try { ctx.tts.stop(); } catch (e) { /* ignore */ }
      for (const k in g.held) g.held[k] = false;
      activeId = null; ptrs.clear();
      pbtn.hidden = true;
      cursorApply();
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
      call(spec.pause);   // 【扩展】spec.pause(g)：停麦克风 / 自己的音乐时钟等
    }
    function resume() {
      if (state !== 'pause' || dead || errored) return;
      setOv(null);
      setState('play');
      pbtn.hidden = false;
      audio();
      if (musicOn) musicStart(musicStyle, musicBpm);
      lastTs = 0;
      try { cv.focus({ preventScroll: true }); } catch (e) { /* ignore */ }
      say('继续');
      cursorApply();
      call(spec.resume);   // 【扩展】spec.resume(g)：比如节奏游戏重新数拍
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
      if (revealText) {   // g.lose({reveal}) / g.win({reveal})：把正确答案留在结算面板上
        const rv = el('div', 'arc-end-rev');
        rv.append(el('b', null, '正确答案'), el('span', 'arc-end-rev-t', revealText));   // 答案里是题目汉字 → 楷体（SPEC：题目汉字一律楷体）
        box.appendChild(rv);
      }
      const sc = el('div', 'arc-end-sc');
      endScoreNode = document.createTextNode(String(g.score));
      sc.append(el('span', null, '得分'), endScoreNode);
      box.appendChild(sc);
      box.appendChild(el('div', 'arc-cd-c', '答对 ' + result.correct + ' / ' + result.total + (g.maxCombo >= 3 ? ' · 最多连击 ' + g.maxCombo : '')));
      if (endInfo.review) box.appendChild(el('div', 'arc-cd-c', '错题重练 · 不计关卡进度'));
      else if (endInfo.newHi) box.appendChild(el('div', 'arc-end-new', '新纪录！'));
      else if (endInfo.unlocked) box.appendChild(el('div', 'arc-end-new', '解锁第 ' + endInfo.unlocked + ' 关！'));
      box.appendChild(el('div', 'arc-end-skip', '点一下继续'));
      const wrap = el('div', null); wrap.style.cssText = 'display:contents';
      wrap.appendChild(box);
      setOv(wrap, true);
      ov.style.cursor = 'pointer';
      // 孩子常常还在狂点：结算面板出现后 0.6 秒内的点击不算“跳过”，免得庆祝画面一闪而过
      ov.onclick = () => { if (overT >= endDelay + END_SKIP_T) finishNow(result); };
      ov.tabIndex = -1;
      try { ov.focus({ preventScroll: true }); } catch (e) { /* ignore */ }
      say((win ? '过关，' + result.stars + ' 颗星' : '失败了') + '，得分 ' + g.score);
    }
    function curResult(win) {
      const correct = g.done;
      const total = win ? g.done + g.wrongs : Math.max(g.rounds, g.done + g.wrongs);
      let stars = total ? starsFor(correct / total) : (win ? 3 : 0);
      // 【扩展】spec.stars(g, win) → 0–3：游戏自己定星（比如只有部分失误走 g.wrong 的游戏按自己的准确率算）
      if (typeof spec.stars === 'function') {
        let v = null;
        try { v = spec.stars.call(spec, g, !!win); } catch (e) { v = null; }
        if (v != null && v !== '' && Number.isFinite(+v)) stars = clamp(Math.round(+v), 0, 3);
      }
      stars = win ? Math.max(1, stars) : Math.min(1, stars);
      return { correct, total: Math.max(total, correct), stars, win: !!win };
    }
    /* o = {delay, reveal}：delay = 结束后多少秒才盖上结算面板（默认 spec.endDelay，再默认 0.5；上限 6），
       期间 update 不再调用，但 draw、g.tween / g.after（没标 playOnly 的）照走 → 游戏可以放自己的收尾动画；
       reveal = 结算面板上显示的“正确答案”（比如失败时把没接住的词补给孩子看） */
    function endLevel(win, o) {
      if (ended || state !== 'play' || dead || errored) return;
      o = o && typeof o === 'object' ? o : {};
      ended = true;
      setState('over'); overT = 0; endShown = false; starPops = 0;
      let d = o.delay;
      if (d == null) d = typeof spec.endDelay === 'function' ? (() => { try { return spec.endDelay.call(spec, g, !!win); } catch (e) { return null; } })() : spec.endDelay;
      endDelay = d != null && d !== '' && Number.isFinite(+d) ? clamp(+d, 0, 6) : 0.5;
      revealText = o.reveal != null && o.reveal !== '' && o.reveal !== false ? String(o.reveal) : null;
      pbtn.hidden = true; activeId = null; ptrs.clear();
      for (const k in g.held) g.held[k] = false;
      musicStop();
      killPlayOnly();
      cursorApply();
      result = curResult(win);
      endInfo = memSave(win, result.stars);
      if (win) { playSfx('win'); fx.confetti(g.w); fx.flashCol = '#FFF6C0'; fx.flashA = 0.45; }
      else { playSfx('lose'); fx.shake = Math.max(fx.shake, 8); }
      call(spec.over, !!win);   // 【扩展】spec.over(g, win)：本关结束的那一刻调用一次（停 HanziWriter 判笔、麦克风等）
    }
    function overTick(dt) {
      overT += dt;
      if (!endShown && overT >= endDelay) showEnd();
      if (result && result.win && endShown) {
        const due = overT >= endDelay + 0.35 + starPops * 0.3 && starPops < result.stars;
        if (due) { starPops++; playSfx('star'); }
      }
      if (overT >= endDelay + (result && result.win ? 2.7 : 2.1) + (revealText ? 1.5 : 0)) finishNow(result);
    }
    function finishNow(r) {
      if (finished || dead) return;
      finished = true;
      // correct/total/stars 是 SPEC 契约；level/score/win 供核心结算页显示“第 N 关 · 得分”；maxCombo = 本局最高连击（引擎口径，
      // 含 g.hit 的中间命中）、review = 错题重练（核心不认识的字段会忽略）
      const out = { correct: r.correct, total: r.total, stars: r.stars, level: g.level, score: g.score, win: !!r.win, maxCombo: g.maxCombo, review: g.isReview };
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
      g.sky = spec.sky === undefined ? 'day' : spec.sky; g.bgSpeed = 1; g.roadLanes = 3; g.palms = spec.palms !== false;
      shownScore = 0; shownProg = 0; scoreBump = 0; comboBump = 0; capT = 0;
      heartFx.length = 0; heartUp.length = 0; for (let i = 0; i < g.maxLives; i++) { heartFx.push(-1); heartUp.push(-1); }
      ended = false; finished = false; result = null; endInfo = null; endScoreNode = null;
      endDelay = 0.5; revealText = null; activeId = null; ptrs.clear();
      g.cam.x = 0; g.cam.y = 0; g.comboAt = null; g.captionY = null; g.countdown = -1; g.cdT = 0;
      wantCursor = ''; cursorApply();
      // 曲风 / 开关回到 spec.music：上一局中途 g.music('bright') 换过曲，重玩 / 下一关倒计时不该还是那首
      musicStyle = spec.music || 'bright'; musicOn = !!spec.music; musicBpm = 0;
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
      for (let i = 0; i < heartUp.length; i++) if (heartUp[i] >= 0) { heartUp[i] += dt; if (heartUp[i] > 0.7) heartUp[i] = -1; }
      if (capT > 0) capT = Math.max(0, capT - dt);
      sayWave += dt;
      hudDt = dt;
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
    /* HUD 全部画在 HUD 那一行里（y < g.hudTop），游戏贴着 g.hudTop 摆的内容不会再被盖住：
       左 = 红心；中 = 关卡号 + 进度条（朗读时关卡号换成跳动的小喇叭）；右 = [🔥×N 连击段 | 🪙 分数] + 暂停钮 */
    let hudDt = 0, pwS = 0;
    function drawHud(c) {
      const s = H.s, cy = H.cy, pad = H.pad;
      const scoreStr = String(Math.round(shownScore));
      const fs = Math.round(22 * s);
      const tw = digitsWidth(scoreStr, fs);
      const comboOn = g.combo >= 3;
      const cfs = Math.round(16 * s);
      const ctxt = comboOn ? '×' + g.combo : '';
      const segW = comboOn ? 24 * s + measure(ctxt, cfs, 'num') + 12 * s : 30 * s;   // 左端：连击段（火焰 + ×N）或金币
      const pwT = Math.max(70 * s, segW + tw + 16 * s);
      pwS = pwS > 0 ? pwS + (pwT - pwS) * Math.min(1, hudDt * 14 || 1) : pwT;
      if (Math.abs(pwS - pwT) < 0.5) pwS = pwT;
      const pw = pwS, ph = 32 * s;
      const sx = H.pauseX - H.pauseR - 8 * s - pw, sy = cy - ph / 2;
      // 左：红心。心多 / 屏窄 / 分数长时进度条会被挤没 → 改成“一颗心 ×N”的紧凑样式
      let x = pad + 14 * s;
      // 紧凑判断按“没有连击段”的分数牌宽度算，免得连击一来一去红心样式跟着来回切
      const sxBase = H.pauseX - H.pauseR - 8 * s - Math.max(70 * s, 46 * s + tw);
      const compact = g.maxLives > 1 && (sxBase - 10 * s) - (pad + g.maxLives * 29 * s) < 110 * s;
      if (g.maxLives > 0 && compact) {
        let sz = 25 * s, hfMax = -1, huMax = -1;
        for (let i = 0; i < heartFx.length; i++) if (heartFx[i] > hfMax) hfMax = heartFx[i];
        for (let i = 0; i < heartUp.length; i++) if (heartUp[i] > huMax) huMax = heartUp[i];
        if (g.lives === 1) sz *= 1 + 0.14 * Math.max(0, Math.sin(bt * 9));
        if (hfMax >= 0) sz *= 1 + 0.25 * Math.sin(Math.min(1, hfMax / 0.4) * Math.PI);
        if (huMax >= 0) sz *= 1 + 0.35 * Math.sin(Math.min(1, huMax / 0.5) * Math.PI);
        drawHeart(c, x, cy, sz, g.lives > 0, s);
        const w2 = drawText(c, '×' + g.lives, x + 15 * s, cy + 1.5 * s, { size: Math.round(19 * s), font: 'num', color: '#FFFFFF', stroke: NAVY, strokeW: 3 * s, align: 'left' });
        x += 15 * s + w2;
      } else if (g.maxLives > 0) {
        for (let i = 0; i < g.maxLives; i++) {
          const full = i < g.lives;
          let sz = 25 * s;
          if (full && g.lives === 1) sz *= 1 + 0.14 * Math.max(0, Math.sin(bt * 9));
          const hu = heartUp[i];
          if (full && hu != null && hu >= 0) sz *= 1 + 0.4 * Math.sin(Math.min(1, hu / 0.5) * Math.PI);
          drawHeart(c, x, cy, sz, full, s);
          const hf = heartFx[i];
          if (hf != null && hf >= 0) {
            const k = hf / 0.8;
            c.globalAlpha = 1 - k;
            heartPath(c, x, cy - k * 16 * s, sz * (1 + k * 1.2)); c.fillStyle = '#FF5A6E'; c.fill();
            c.globalAlpha = 1;
          }
          if (hu != null && hu >= 0) {   // 加心：一圈粉色光环
            const k = hu / 0.7;
            c.globalAlpha = 1 - k; c.lineWidth = 3 * s; c.strokeStyle = '#FF9AB0';
            c.beginPath(); c.arc(x, cy, 10 * s + k * 18 * s, 0, TAU); c.stroke(); c.globalAlpha = 1;
          }
          x += 29 * s;
        }
        x -= 14 * s;
      } else x = pad;
      // 右：暂停钮 + 分数牌（连击时左端换成火焰段）
      const pr = H.pauseR, px0 = H.pauseX;
      c.fillStyle = NAVY; c.beginPath(); c.arc(px0, cy + 4 * s, pr, 0, TAU); c.fill();
      c.fillStyle = '#3AA0FF'; c.beginPath(); c.arc(px0, cy, pr, 0, TAU); c.fill();
      c.lineWidth = 3 * s; c.strokeStyle = NAVY; c.stroke();
      c.fillStyle = 'rgba(255,255,255,.35)'; c.beginPath(); c.ellipse(px0, cy - pr * 0.45, pr * 0.62, pr * 0.3, 0, 0, TAU); c.fill();
      c.fillStyle = '#FFFFFF';
      rrect(c, px0 - 7 * s, cy - 8 * s, 5 * s, 16 * s, 1.5 * s, '#FFFFFF');
      rrect(c, px0 + 2 * s, cy - 8 * s, 5 * s, 16 * s, 1.5 * s, '#FFFFFF');
      rrect(c, sx, sy + 3 * s, pw, ph, ph / 2, NAVY);
      if (comboOn) {
        const col = g.combo >= 10 ? '#A64DFF' : g.combo >= 6 ? '#FF3D3D' : '#FF8A1C';
        rrect(c, sx, sy, pw, ph, ph / 2, col);
        const ins = 2.6 * s, cx0 = sx + segW - 2 * s;
        rrect(c, cx0, sy + ins, sx + pw - ins - cx0, ph - ins * 2, (ph - ins * 2) / 2, '#FFFBEF');
        rrect(c, sx, sy, pw, ph, ph / 2, null, NAVY, 2.6 * s);
        const k = 1 + comboBump * 0.3;
        c.save(); c.translate(sx + segW / 2, cy); c.scale(k, k);
        drawEmoji(c, '🔥', -segW / 2 + 13 * s, -1 * s + Math.sin(bt * 20) * 0.8 * s, 19 * s * (1 + 0.1 * Math.sin(bt * 14)));
        drawText(c, ctxt, -segW / 2 + 23 * s, 1.5 * s, { size: cfs, font: 'num', color: '#FFFFFF', stroke: NAVY, strokeW: 3 * s, align: 'left' });
        c.restore();
      } else {
        rrect(c, sx, sy, pw, ph, ph / 2, '#FFFBEF', NAVY, 2.6 * s);
        const coin = coinSprite(), cs = 28 * s * (1 + scoreBump * 0.25);
        c.drawImage(coin.cv, sx + 15 * s - cs / 2, cy - cs / 2, cs, cs);
      }
      drawDigits(c, scoreStr, sx + pw - 12 * s, cy + 1.5 * s, fs, NAVY, 1 + scoreBump * 0.18);
      // 中：关卡号 + 进度条；朗读中关卡号换成小喇叭（spec.speakIcon:false 可关掉）
      const talk = g.speaking && spec.speakIcon !== false;
      let bl = x + 10 * s, br = sx - 10 * s;
      const maxBar = 320 * s;
      if (br - bl > maxBar) { const mid = Math.max(g.w / 2, bl + maxBar / 2); bl = Math.min(mid, br - maxBar / 2) - maxBar / 2; br = bl + maxBar; }
      const r = 17 * s;
      if (br - bl > 70 * s) {
        const bcx = bl + r;
        const tl = bcx + r - 4 * s, tw2 = br - tl, th = 18 * s;
        rrect(c, tl, cy - th / 2 + 3 * s, tw2, th, th / 2, NAVY);
        rrect(c, tl, cy - th / 2, tw2, th, th / 2, 'rgba(20,32,70,.55)', NAVY, 2.4 * s);
        const fw = Math.max(0, (tw2 - 6 * s) * shownProg);
        if (fw > 2) {
          rrect(c, tl + 3 * s, cy - th / 2 + 3 * s, Math.max(th - 6 * s, fw), th - 6 * s, (th - 6 * s) / 2, '#FFC928');
          rrect(c, tl + 3 * s, cy - th / 2 + 3 * s, Math.max(th - 6 * s, fw), (th - 6 * s) * 0.45, (th - 6 * s) * 0.22, 'rgba(255,255,255,.55)');
        }
        drawText(c, Math.min(g.done, g.rounds) + '/' + g.rounds, tl + tw2 / 2 + 6 * s, cy + 1 * s, { size: Math.round(13 * s), font: 'num', color: '#FFFFFF', stroke: NAVY, strokeW: 3 * s });
        if (talk) drawSpeaker(c, bcx, cy, r, s);
        else {
          c.fillStyle = NAVY; c.beginPath(); c.arc(bcx, cy + 3 * s, r, 0, TAU); c.fill();
          c.fillStyle = '#FF7A3D'; c.beginPath(); c.arc(bcx, cy, r, 0, TAU); c.fill();
          c.lineWidth = 2.6 * s; c.strokeStyle = NAVY; c.stroke();
          drawText(c, String(g.level), bcx, cy + 1.5 * s, { size: Math.round(19 * s), font: 'num', color: '#FFFFFF', stroke: NAVY, strokeW: 3 * s });
        }
      } else if (talk && br - bl > 2 * r) drawSpeaker(c, bl + r, cy, r, s);
    }
    /* 朗读中：蓝色小喇叭 + 往右扩散的声波（在 HUD 行内） */
    function drawSpeaker(c, x, y, r, s) {
      c.fillStyle = NAVY; c.beginPath(); c.arc(x, y + 3 * s, r, 0, TAU); c.fill();
      c.fillStyle = '#3AA0FF'; c.beginPath(); c.arc(x, y, r * (1 + 0.06 * Math.sin(sayWave * 12)), 0, TAU); c.fill();
      c.lineWidth = 2.6 * s; c.strokeStyle = NAVY; c.stroke();
      drawEmoji(c, '🔊', x, y + 0.5 * s, 19 * s);
      c.strokeStyle = '#FFFFFF'; c.lineWidth = 2.5 * s; c.lineCap = 'round';
      for (let i = 0; i < 2; i++) {
        const k = (sayWave * 1.6 + i * 0.5) % 1;
        c.globalAlpha = 1 - k;
        c.beginPath(); c.arc(x, y, r + 2 * s + k * 10 * s, -0.7, 0.7); c.stroke();
      }
      c.globalAlpha = 1;
    }
    /* 无 TTS 字幕条：长句自动折行（最多 3 行）；位置 = g.say 的 {captionY} > g.captionY > spec.captionY（数值或 function(g)）
       > 默认 HUD 正下方。取值可以是 y 数值，或 'top' | 'center' | 'bottom' */
    function captionTop(bh) {
      let v = capY != null ? capY : g.captionY != null ? g.captionY : spec.captionY;
      if (typeof v === 'function') { try { v = v.call(spec, g); } catch (e) { v = null; } }
      if (v === 'bottom') return g.h - bh - 14 * H.s;
      if (v === 'center' || v === 'middle') return (g.h - bh) / 2;
      if (typeof v === 'number' && Number.isFinite(v)) return clamp(v, 0, Math.max(0, g.h - bh));
      return g.hudTop + 4 * H.s;
    }
    function drawCaption(c) {
      if (capT <= 0 || !capText) return;
      const s = H.s, a = Math.min(1, capT / 0.25, (capDur - capT) / 0.15 + 0.2);
      const maxW = Math.min(g.w - 24 * s, 760 * s), inner = maxW - 60 * s;
      let fs = Math.round(20 * s), lines = wrapText(capText, inner, fs, 'py');
      if (lines.length > 2) { fs = Math.round(17 * s); lines = wrapText(capText, inner, fs, 'py'); }
      if (lines.length > 3) { lines = lines.slice(0, 3); lines[2] = lines[2] + ' …'; }
      let tw = 0;
      for (let i = 0; i < lines.length; i++) tw = Math.max(tw, measure(lines[i], fs, 'py'));
      tw = Math.min(tw, inner);
      const lh = Math.round(fs * 1.28);
      const bw = tw + 60 * s, bh = Math.max(42 * s, lines.length * lh + 16 * s), bx = g.w / 2 - bw / 2, by = captionTop(bh);
      const rr = Math.min(bh / 2, 21 * s);
      c.globalAlpha = clamp(a, 0, 1);
      rrect(c, bx, by + 3 * s, bw, bh, rr, NAVY);
      rrect(c, bx, by, bw, bh, rr, 'rgba(29,43,83,.92)', '#FFFFFF', 2.5 * s);
      drawEmoji(c, '🔊', bx + 22 * s, by + (lines.length > 1 ? 21 * s : bh / 2), 20 * s);
      const y0 = by + bh / 2 - (lines.length - 1) * lh / 2 + 1;
      for (let i = 0; i < lines.length; i++) drawText(c, lines[i], bx + 38 * s, y0 + i * lh, { size: fs, font: 'py', color: '#FFFFFF', align: 'left', maxW: bw - 52 * s });
      c.globalAlpha = 1;
    }

    /* ---------- 渲染 / 主循环 ---------- */
    function render(dt) {
      const c = c2, dpr = g.dpr;
      dt = dt || 0;
      c.setTransform(1, 0, 0, 1, 0, 0);
      c.globalAlpha = 1; c.globalCompositeOperation = 'source-over';
      const preview = !inited && typeof spec.preview === 'function';
      const skyName = inited || preview ? g.sky : (g.sky || 'day');
      if (!skyName) c.clearRect(0, 0, cv.width, cv.height);
      const ox = fx.ox, oy = fx.oy;
      c.setTransform(dpr, 0, 0, dpr, dpr * ox, dpr * oy);
      sky.lanes = Math.max(1, Math.floor(+g.roadLanes) || 3);
      sky.palms = g.palms !== false;
      sky.road.lanes = sky.lanes;
      g.roadSpeed = 7 * (+g.bgSpeed || 0);
      if (skyName) sky.draw(c, skyName, bt, +g.bgSpeed || 0);
      g.horizon = sky.horizonOf(skyName || '');
      if ((inited || preview) && !errored) {
        c.save();
        call(inited ? spec.draw : spec.preview, c, dt);   // draw(g, c, dt)：dt = 本帧秒数（暂停时 0），配合 g.vt 做倒计时 / 结算期间的动画
        c.restore();
        c.setTransform(dpr, 0, 0, dpr, dpr * ox, dpr * oy);
        c.globalAlpha = 1; c.globalCompositeOperation = 'source-over';
      }
      fx.camX = +(g.cam && g.cam.x) || 0; fx.camY = +(g.cam && g.cam.y) || 0;
      fx.drawWorld(c, dpr, ox, oy);
      c.setTransform(dpr, 0, 0, dpr, 0, 0);
      fx.drawFloats(c, g.w, g.h);
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
      if (errored || state === 'pause') { g.dt = 0; if (dirty) { safe(() => render(0)); dirty = false; } return; }
      const t0 = now();
      bt += dt;
      g.vt = bt; g.dt = dt;   // g.vt：画面时钟（选关 / 倒计时 / play / 结算都走，暂停停）
      if (mic) mic.tick(dt);
      if (state === 'play') {
        g.t += dt;
        runTimers(dt); if (dead) return;
        runTweens(dt); if (dead) return;
        if (state === 'play') call(spec.update, dt);
        if (dead) return;
      } else if (state === 'over') {
        runTimers(dt); if (dead) return;
        runTweens(dt); if (dead) return;
        if (typeof spec.overUpdate === 'function') { call(spec.overUpdate, dt); if (dead) return; }   // 【扩展】最后一击的物理 / 动画接着走
        overTick(dt); if (dead) return;
      } else if (phase === 'count') countTick(dt);
      fx.update(dt);
      hudTick(dt);
      safe(() => render(dt));
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
      if (e.pointerType === 'mouse' && e.button > 0) return;
      if (multi) ptrs.add(e.pointerId);                                      // spec.multiTouch：每根手指都要
      else {
        if (activeId !== null && e.pointerId !== activeId) return;           // 第二根手指：忽略
        activeId = e.pointerId;
      }
      try { cv.setPointerCapture(e.pointerId); } catch (x) { /* ignore */ }
      call(spec.down, ptr(e, true));
    }
    function onMove(e) {
      if (dead || state !== 'play' || errored) return;
      if (multi) {
        if (ptrs.has(e.pointerId)) call(spec.move, ptr(e, true));
        else if (e.pointerType === 'mouse' && !ptrs.size) call(spec.move, ptr(e, false));
        return;
      }
      if (activeId !== null) { if (e.pointerId === activeId) call(spec.move, ptr(e, true)); }
      else if (e.pointerType === 'mouse') call(spec.move, ptr(e, false));
    }
    function onUp(e) {
      if (multi) {
        if (!ptrs.delete(e.pointerId)) return;
      } else {
        if (e.pointerId !== activeId) return;
        activeId = null;
      }
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
        if (overT >= endDelay + END_SKIP_T) finishNow(result);
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
    /* 核心顶栏“← 退出”第一下只是“再点一次退出”：这时游戏先暂停（小球别在孩子犹豫时溜走），第二下核心直接结束会话；
       不点第二下 → 暂停面板里点“继续”接着玩。核心的监听先注册，所以这里看得到它刚加上的 is-armed */
    let exitBtn = null;
    function onExitBtn() { if (!dead && ctx.alive() && state === 'play' && exitBtn && exitBtn.classList.contains('is-armed')) pause(); }
    try {
      const host = ctx.el && ctx.el.parentElement;
      exitBtn = (host && host.querySelector('#hw-exit')) || D.getElementById('hw-exit');
      if (exitBtn) exitBtn.addEventListener('click', onExitBtn);
    } catch (e) { exitBtn = null; }
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
      try { if (exitBtn) exitBtn.removeEventListener('click', onExitBtn); } catch (e) { /* ignore */ }
      try { if (mic) mic.stop(); } catch (e) { /* ignore */ }
      try { cv.style.cursor = ''; } catch (e) { /* ignore */ }
      if (HW.arcade && HW.arcade.current && HW.arcade.current.g === g) HW.arcade.current = null;
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
    const multFor = (cb) => (cb >= 10 ? 4 : cb >= 6 ? 3 : cb >= 3 ? 2 : 1);
    const optsOf = (o) => (o && typeof o === 'object' ? o : {});
    const hasLabel = (v) => v !== false && v !== '';   // null / undefined = 用默认字；'' / false = 不飘
    /* “连击×N！”大字的位置：本次调用的 {comboAt} > g.comboAt > spec.comboAt（[x,y] / {x,y} / function(g) / false = 不飘）
       > 默认 (g.w/2, g.hudTop+70) */
    function comboPos(o) {
      let v = o.comboAt !== undefined ? o.comboAt : g.comboAt != null ? g.comboAt : spec.comboAt;
      if (typeof v === 'function') { try { v = v.call(spec, g); } catch (e) { v = null; } }
      if (v === false) return null;
      if (Array.isArray(v) && v.length >= 2 && Number.isFinite(+v[0]) && Number.isFinite(+v[1])) return [+v[0], +v[1]];
      if (v && typeof v === 'object' && Number.isFinite(+v.x) && Number.isFinite(+v.y)) return [+v.x, +v.y];
      return [g.w / 2, g.hudTop + 70];
    }
    function comboMilestone(o) {
      if (!(g.combo === 3 || (g.combo >= 5 && g.combo % 5 === 0))) return;
      playSfx('combo');
      if (o.comboFloat === false) return;
      const at = comboPos(o);
      if (at) fx.float('连击×' + g.combo + '！', at[0], at[1], { color: g.combo >= 10 ? '#E3B3FF' : '#FFB347', size: 38, life: 1.3 });
    }
    /* g.right(item, x, y, label?, o?)  o = {combo:false（不加连击、不飘连击字）, comboFloat:false, comboAt,
         pts（覆盖本次得分）, labelAt:[x,y], labelSize, labelFont, fx:false, win:false（做满题数也不自动通关，之后自己 g.win()）, endDelay}
       label === '' / false = 不飘分数字 */
    g.right = function (item, x, y, label, o) {
      if (state !== 'play' || ended || dead) return;
      o = optsOf(o);
      const [X, Y] = XY(x, y);
      const useCombo = o.combo !== false;
      if (useCombo) { g.combo++; if (g.combo > g.maxCombo) g.maxCombo = g.combo; comboBump = 1; }
      const mult = multFor(g.combo), pts = o.pts != null && Number.isFinite(+o.pts) ? Math.round(+o.pts) : 10 * mult;
      g.score = Math.max(0, g.score + pts); scoreBump = 1;
      if (o.fx !== false) {
        fx.burst(X, Y, { kind: 'star', n: 14 }); fx.burst(X, Y, { kind: 'coin', n: 5 + mult * 2 }); fx.burst(X, Y, { kind: 'spark', n: 10 });
        fx.ring(X, Y, '#FFE45C');
      }
      if (hasLabel(label)) {
        const la = Array.isArray(o.labelAt) ? o.labelAt : [X, Y - 34];
        fx.float(label != null ? label : '+' + pts, la[0], la[1], { color: '#FFE45C', size: o.labelSize || 32, font: o.labelFont });
      }
      if (useCombo) comboMilestone(o);
      playSfx('coin');
      try { if (arguments.length) ctx.score.right(item); else ctx.score.right(); } catch (e) { /* ignore */ }
      g.done++;
      if (g.done >= g.rounds && o.win !== false && spec.autoWin !== false) endLevel(true, o.endDelay != null ? { delay: o.endDelay } : null);
    };
    /* g.wrong(item, note, x, y, o?)  o = {holdEnd:true：扣到 0 心也先不结束（先给孩子看讲解），之后自己 g.lose()；reveal;
         mark:false 不飘红 ✗、不喷红点（游戏已经画了自己的后果：刀被弹开、托盘弹回、踏板碎）; shake（像素，默认 13，0 = 不抖）;
         flash:false 不闪红屏; sfx:false 不放“撞”声（扣心的心碎声照常）}
       item 传 null / undefined = 扣心、计入 wrongs（降星），但不进错题本 */
    const shakeOf = (o, d) => (o.shake != null && Number.isFinite(+o.shake) ? Math.max(0, +o.shake) : d);
    g.wrong = function (item, note, x, y, o) {
      if (state !== 'play' || ended || dead) return;
      o = optsOf(o);
      const [X, Y] = XY(x, y);
      g.combo = 0; g.wrongs++;
      if (o.mark !== false) {
        fx.float('✗', X, Y - 24, { color: '#FF5A5F', size: 50 });
        fx.burst(X, Y, { kind: 'dot', color: '#FF5A5F', n: 14 });
      }
      const sk = shakeOf(o, 13);
      if (sk > 0) g.shake(sk);
      if (o.flash !== false) { fx.flashCol = '#FF2E2E'; fx.flashA = Math.max(fx.flashA, 0.32); }
      if (o.sfx !== false) playSfx(typeof o.sfx === 'string' ? o.sfx : 'hit');
      try { ctx.score.wrong(item, note); } catch (e) { /* ignore */ }
      loseHeart(o);
    };
    function loseHeart(o) {
      if (g.maxLives <= 0) return;
      g.lives = Math.max(0, g.lives - 1);
      if (heartFx.length > g.lives) heartFx[g.lives] = 0;
      if (heartUp.length > g.lives) heartUp[g.lives] = -1;
      playSfx('heart');
      if (g.lives <= 0 && !o.holdEnd) endLevel(false, o.reveal != null ? { reveal: o.reveal } : null);
    }
    /* g.hurt(x, y, label?, o?)：非答题伤害（炸弹、撞墙、怪兽撞城）——扣 1 心、断连击、抖屏、心碎动画、心归零自动 lose；
       不调 ctx.score.wrong、不计 wrongs（不降星、不进错题本）。o = {holdEnd, reveal, shake, flash:false, sfx:false} 同 g.wrong；labelFont */
    g.hurt = function (x, y, label, o) {
      if (state !== 'play' || ended || dead) return;
      o = optsOf(o);
      const [X, Y] = XY(x, y);
      g.combo = 0; g.hurts = (g.hurts || 0) + 1;
      if (hasLabel(label) && label != null) fx.float(String(label), X, Y - 24, { color: '#FF8A8A', size: 32, font: o.labelFont });
      fx.burst(X, Y, { kind: 'dot', color: '#FF5A6E', n: 12 });
      const sk = shakeOf(o, 11);
      if (sk > 0) g.shake(sk);
      if (o.flash !== false) { fx.flashCol = '#FF2E2E'; fx.flashA = Math.max(fx.flashA, 0.26); }
      if (o.sfx !== false) playSfx(typeof o.sfx === 'string' ? o.sfx : 'hit');
      loseHeart(o);
    };
    /* g.heal(x?, y?, label?, o?)：加 1 心（满了返回 false；o.grow:true 允许超过上限，最多 8）、心跳 + 光环动画 */
    g.heal = function (x, y, label, o) {
      if (state !== 'play' || ended || dead) return false;
      o = optsOf(o);
      if (g.lives >= g.maxLives) {
        if (!o.grow || g.maxLives <= 0 || g.maxLives >= 8) return false;
        g.maxLives++; heartFx.push(-1); heartUp.push(-1);
      }
      g.lives++;
      heartUp[g.lives - 1] = 0; heartFx[g.lives - 1] = -1;
      if (x != null && y != null) {
        fx.burst(x, y, { kind: 'star', color: '#FF6B8B', n: 10 });
        if (hasLabel(label)) fx.float(label != null ? String(label) : '+1 ❤', x, y - 30, { color: '#FF9AB0', size: 28, font: o.labelFont });
      }
      playSfx('heart'); playSfx('good');
      return true;
    };
    /* g.hit(x, y, o?)：中间步骤命中（一道题分几步完成的游戏）——连击 +1、按倍率加分（o.pts 基础分，默认 10）、粒子、飘字、
       连击大字；不加 done、不调 ctx.score.right。o = {pts, label, labelFont, combo:false, comboFloat:false, comboAt, fx:false, sfx}；
       也可 g.hit(x, y, 5) 只给基础分。返回本次得分 */
    g.hit = function (x, y, o) {
      if (state !== 'play' || ended || dead) return 0;
      o = typeof o === 'number' ? { pts: o } : optsOf(o);
      const [X, Y] = XY(x, y);
      const useCombo = o.combo !== false;
      if (useCombo) { g.combo++; if (g.combo > g.maxCombo) g.maxCombo = g.combo; comboBump = 1; }
      const base = o.pts != null && Number.isFinite(+o.pts) ? +o.pts : 10, pts = Math.round(base * multFor(g.combo));
      g.score = Math.max(0, g.score + pts); scoreBump = 1;
      if (o.fx !== false) { fx.burst(X, Y, { kind: 'star', n: 8 }); fx.burst(X, Y, { kind: 'spark', n: 8 }); }
      const lab = o.label != null ? o.label : '+' + pts;
      if (hasLabel(lab)) fx.float(String(lab), X, Y - 30, { color: '#FFE45C', size: 26, font: o.labelFont });
      if (useCombo) comboMilestone(o);
      if (o.sfx !== false) playSfx(typeof o.sfx === 'string' ? o.sfx : 'coin');
      return pts;
    };
    /* g.miss(x, y, label?, o?)：只断连击 + 小抖动（“让它跑掉了”），不扣心不记错题。label 默认“溜走啦”，可传自己的字（“快画声调！”），
       '' / false 不飘字；o = {sfx:false, shake:0, labelFont} */
    g.miss = function (x, y, label, o) {
      if (state !== 'play' || ended || dead) return;
      o = optsOf(o);
      g.combo = 0; g.misses++;
      const sk = shakeOf(o, 5);   // shake:0 = 不抖（g.shake(0) 会按默认 8 抖，所以这里判掉）
      if (sk > 0) g.shake(sk);
      if (x != null && y != null && hasLabel(label)) fx.float(label != null ? String(label) : '溜走啦', clamp(x, 50, g.w - 50), clamp(y, g.hudTop + 40, g.h - 30), { color: '#D6ECFF', size: 24, font: o.labelFont });
      if (o.sfx !== false) playSfx(typeof o.sfx === 'string' ? o.sfx : 'whoosh');
    };
    /* g.breakCombo()：悄悄断连击（翻错牌这类不算错也不算溜走的情况），没有声音、字、抖动 */
    g.breakCombo = function () { if (state === 'play' && !ended && !dead) g.combo = 0; };
    g.addScore = function (n, x, y) {
      n = Math.round(+n || 0);
      if (!n || dead || finished) return;
      g.score = Math.max(0, g.score + n); scoreBump = 1;
      if (x != null && y != null) fx.float((n > 0 ? '+' : '') + n, x, y, { color: n > 0 ? '#FFE45C' : '#FF6B6B', size: 28 });   // 扣分用红字，别像奖励
      if (ended) patchEndScore();   // 常见写法：最后一题 g.right() 自动通关后再 g.addScore(奖励)——存档与结算要跟上
    };
    /* g.win(o?) / g.lose(o?)：o = {delay: 结束后几秒才盖上结算面板（默认 spec.endDelay / 0.5）, reveal: 面板上显示的正确答案} */
    g.win = function (o) { endLevel(true, o); };
    g.lose = function (o) { endLevel(false, o); };
    g.burst = function (x, y, o) { fx.burst(x, y, o); };
    g.confetti = function () { fx.confetti(g.w); };
    g.float = function (text, x, y, o) { fx.float(text, x, y, o); };
    g.shake = function (px) { const v = (+px || 8) * (reduceMotion() ? 0.35 : 1); if (v > fx.shake) fx.shake = Math.min(40, v); };
    g.flash = function (color) { fx.flashCol = color || '#FFFFFF'; fx.flashA = reduceMotion() ? 0.2 : 0.5; };
    g.ring = function (x, y, color, r, o) { fx.ring(x, y, color, r, !!(o && o.world)); };
    g.tween = tween;
    g.after = after;
    g.text = (str, x, y, o) => drawText(g.c, str, x, y, o);
    const SO = {};
    g.shadowText = function (str, x, y, o) {
      o = o || {};
      SO.size = o.size || 24; SO.color = o.color || '#FFFFFF'; SO.font = o.font || 'round'; SO.weight = o.weight;
      SO.align = o.align; SO.baseline = o.baseline; SO.maxW = o.maxW; SO.alpha = o.alpha; SO.scale = o.scale;
      SO.stroke = o.stroke || NAVY; SO.strokeW = o.strokeW != null ? o.strokeW : SO.font === 'kai' ? Math.max(2, SO.size * 0.09) : Math.max(3, SO.size * 0.16); SO.shadow = o.shadow !== false;
      return drawText(g.c, str, x, y, SO);
    };
    g.measure = (str, size, font, weight) => measure(str, size || 24, FONTS[font] ? font : 'round', weight);
    g.emoji = (ch, x, y, size, o) => drawEmoji(g.c, ch, x, y, size, o);
    g.rrect = (x, y, w, h, r, fill, stroke, lw) => rrect(g.c, x, y, w, h, r, fill, stroke, lw);
    g.cloud = (x, y, s, a) => drawCloud(g.c, x, y, s, a);
    g.wrapText = (str, maxW, size, font, weight) => wrapText(str, maxW, size || 24, FONTS[font] ? font : 'round', weight);
    g.sfx = (name) => { if (!dead) playSfx(name); };
    /* 画布上的鼠标指针（如锤子游戏画自己的锤子：g.cursor('none')）；暂停 / 结束 / 退出时引擎自动还原，继续时再套上 */
    function cursorApply() { try { cv.style.cursor = state === 'play' && !dead && wantCursor ? wantCursor : ''; } catch (e) { /* ignore */ } }
    g.cursor = function (css) { wantCursor = css == null || css === false || css === 'auto' ? '' : String(css); cursorApply(); };
    /* ---- 朗读 ---- */
    const hanCount = (t) => { let n = 0; for (const ch of t) if (isHan(ch)) n++; return n; };
    function showCaption(s, o) {
      if (o.caption === false || o.caption === '' || o.quiet) return false;
      // 自动字幕：拼音行里的中文标点换成半角（全角逗号在拼音字体里是一大块空白）
      const noTone = o.tones === false || (o.tones == null && spec.captionTones === false);   // 声调游戏：自动字幕别把答案亮出来
      const t = o.caption != null ? String(o.caption) : g.pinyinOf(s, noTone ? { tones: false } : null).replace(/[，、]/g, ',').replace(/。/g, '.').replace(/！/g, '!').replace(/？/g, '?').replace(/[：；]/g, (m) => (m === '：' ? ':' : ';')).replace(/[“”]/g, '"').replace(/[‘’]/g, "'");
      if (!t) return false;
      capText = t; capY = o.captionY != null ? o.captionY : null;
      capDur = o.captionT > 0 ? clamp(+o.captionT, 0.5, 10) : clamp(1.5 + t.length * 0.035, 1.5, 4.5);   // 长句多停一会儿
      capT = capDur;
      return true;
    }
    /* g.say(text, {rate, caption, captionY, captionT, quiet}) → Promise<{spoken, interrupted, silent, noTTS, ms}>
       没有中文朗读：立即 resolve，显示拼音字幕（caption 自定义；caption:'' / false 或 quiet:true = 不显示）。
       有朗读但 0.3 秒内就结束、又没被打断（Chrome 未激活报 not-allowed 等“空播”）：补显示字幕，resolve 带 silent:true；
       连续两次空播 → g.ttsBroken = true（g.ttsOK 随之为 false），之后照样先试着读、读不出来就字幕。
       被暂停 / 新的 g.say / g.stopSay 打断：interrupted:true（逐句朗读的游戏据此重读那一句） */
    g.say = function (text, o) {
      o = o || {};
      const s = String(text == null ? '' : text).trim();
      if (dead || !s || !ctx.alive()) return Promise.resolve({ spoken: false, interrupted: false, silent: false, noTTS: false, ms: 0 });
      let ok = false;
      try { ok = !!(ctx.tts && ctx.tts.ok); } catch (e) { ok = false; }
      if (!ok) {
        showCaption(s, o);
        return Promise.resolve({ spoken: false, interrupted: false, silent: false, noTTS: true, ms: 0 });
      }
      const my = ++sayGen, p0 = pauseN, s0 = stopN, t0 = now();
      speaking++; g.speaking = true; musicDuck(true);
      let settled = false;
      const fin = () => {
        if (settled) return null;
        settled = true;
        speaking = Math.max(0, speaking - 1); if (!speaking) { g.speaking = false; if (!dead) musicDuck(false); }
        const ms = Math.round(now() - t0);
        const interrupted = dead || my !== sayGen || pauseN !== p0 || stopN !== s0;
        let silent = false;
        if (!interrupted && hanCount(s) >= 3 && ms < 300) {
          silent = true; silentN++;
          if (silentN >= 2) g.ttsBroken = true;
          if (!dead) showCaption(s, o);
        } else if (!interrupted && ms >= 300) { silentN = 0; g.ttsBroken = false; }
        return { spoken: !interrupted && !silent, interrupted, silent, noTTS: false, ms };
      };
      let p;
      try { p = ctx.tts.speak(s, o.rate ? { rate: o.rate } : undefined); } catch (e) { p = null; }
      if (!p || typeof p.then !== 'function') return Promise.resolve(fin());
      return p.then(fin, fin);
    };
    /* g.stopSay()：停掉朗读（正在进行的 g.say 以 interrupted:true 结束） */
    g.stopSay = function () { stopN++; try { ctx.tts.stop(); } catch (e) { /* ignore */ } };
    /* g.music(on)：true / false 开关；'bright'|'calm'|'drum' 换曲；{style, bpm, on} 换曲并改速（bpm 40–220） */
    g.music = function (on) {
      if (on && typeof on === 'object') {
        if (SONGS[on.style]) musicStyle = on.style;
        if (on.bpm !== undefined) musicBpm = on.bpm > 0 ? clamp(+on.bpm, 40, 220) : 0;
        musicOn = on.on !== false;
      } else if (typeof on === 'string') { if (SONGS[on]) musicStyle = on; musicOn = true; }
      else musicOn = !!on;
      if (dead) return;
      if (musicOn && (state === 'play' || phase === 'count')) musicStart(musicStyle, musicBpm); else musicStop();
    };
    /* ---- 音频时钟（节奏游戏在引擎的 AudioContext 上排音，和背景音乐同一个钟） ---- */
    g.audioTime = () => (AU.ac ? AU.ac.currentTime : 0);
    /* g.beatInfo() → {on, bpm, beat（四分音符秒数）, eighth, now, gridT（now 之前最近的八分音符时刻）, step（该时刻是小节里第几个八分 0–7）,
       barT（该小节起点）}：背景音乐没开时 on=false，数值按当前曲风 / bpm 推算 */
    g.beatInfo = function () {
      const ac = AU.ac, song = SONGS[AU.style] || SONGS[musicStyle] || SONGS.bright;
      const bpm = AU.bpm || musicBpm || song.bpm, eighth = 60 / bpm / 2, nowT = ac ? ac.currentTime : 0;
      let gridT = nowT, step = 0;
      if (AU.on && ac) {
        const back = Math.max(0, Math.ceil((AU.next - nowT) / eighth - 1e-9));
        gridT = AU.next - back * eighth; step = ((AU.step - back) % 8 + 8) % 8;
      }
      return { on: !!(AU.on && ac && ac.state === 'running'), bpm, beat: eighth * 2, eighth, now: nowT, gridT, step, barT: gridT - step * eighth };
    };
    /* g.tone(t, f0, f1, dur, vol, type, o?)：在音频时刻 t（null = 马上）排一个音（f0→f1 滑音），跟随声音开关。
       o = {path:[[比例 0–1, 频率], …]（折线音高，给了就不看 f1）, lin:true（线性滑音）, attack, hold, lp, detune} */
    g.tone = function (t, f0, f1, dur, vol, type, o) {
      if (dead || !soundOn()) return;
      const ac = audio(); if (!ac || ac.state !== 'running') return;
      let to;
      if (o && typeof o === 'object') {
        to = {};
        if (Array.isArray(o.path)) to.path = o.path;
        if (o.lin) to.lin = true;
        if (o.attack != null && Number.isFinite(+o.attack)) to.attack = clamp(+o.attack, 0.001, 1);
        if (o.hold != null && +o.hold > 0) to.hold = clamp(+o.hold, 0, 4);
        if (o.lp != null && +o.lp > 0) { to.lp = clamp(+o.lp, 40, 20000); if (+o.q > 0) to.q = +o.q; }
        if (o.detune != null && Number.isFinite(+o.detune)) to.detune = +o.detune;
      }
      const d = clamp(+dur || 0.2, 0.02, 4);
      if (to && to.hold != null) to.hold = Math.min(to.hold, Math.max(0, d - (to.attack != null ? to.attack : 0.006) - 0.02));   // 保持段别越过音尾
      tone(t == null ? ac.currentTime + 0.005 : Math.max(ac.currentTime, +t), +f0 || 440, +f1 || +f0 || 440, d, clamp(vol == null ? 0.16 : +vol, 0, 0.6), type || 'triangle', null, to);
    };
    /* g.audioOut() → {ac, out} | null：引擎的 AudioContext 与音效总线（out 跟随全局声音开关）；自己合成的音接到 out 上 */
    g.audioOut = () => (dead ? null : audioOut());
    /* g.note(n, dur=0.22, o={type,vol,at})：n < 24 = 五声音阶的第 n 级（0 = C5，5 = 高八度 C6 …）；n ≥ 24 = MIDI 音高 */
    g.note = function (n, dur, o) {
      o = optsOf(o);
      n = +n || 0;
      const f = mtof(n < 24 ? deg(Math.round(n), 72) : n);
      g.tone(o.at, f, f, dur || 0.22, o.vol == null ? 0.16 : o.vol, o.type || 'triangle');
    };
    /* g.mic(o={threshold:0.08, gain:6}) → {state:'idle'|'asking'|'on'|'denied'|'none'|'off', level 0–1, peak, voiced, start()→Promise<bool>, stop()}
       同一局只有一个；开着时背景音乐自动停，stop / 退出后恢复；页面里被拒绝过一次就不再弹权限窗（state='denied'） */
    g.mic = function (o) {
      if (mic) return mic;
      mic = makeMic(o, {
        dead: () => dead,
        on: () => { AU.micHold++; musicStop(); },
        off: () => { AU.micHold = Math.max(0, AU.micHold - 1); if (!dead && musicOn && !AU.micHold && (state === 'play' || phase === 'count')) musicStart(musicStyle, musicBpm); }
      });
      return mic;
    };
    /* 栏目数据：ctx.G 优先；ctx.G 没有这个栏目（核心只拷它认识的栏目进 ctx.G）时退回 HW_DATA[年级][col]（3.0 新栏目） */
    function colData(col) {
      if (ctx.G && Array.isArray(ctx.G[col])) return ctx.G[col];
      try {
        const gd = W.HW_DATA && W.HW_DATA[ctx.grade];
        if (gd && Array.isArray(gd[col])) return gd[col];
      } catch (e) { /* ignore */ }
      return [];
    }
    g.items = function (col, n, o) {
      const rv = ctx.review;
      if (rv && rv.length) {
        const m = rv.filter((it) => colOf(col, it));
        if (m.length) { const s = shuffle(m); return n == null ? s : s.slice(0, Math.max(0, Math.floor(+n) || 0)); }
        if (o && (o.strict || o.reviewOnly)) return [];   // 【扩展】重练时这个栏目没有错题：返回空，不退回题库新题
      }
      const src = colData(col);
      try { return ctx.pick(src, n); } catch (e) { return shuffle(src).slice(0, n == null ? src.length : n); }
    };
    g.rand = rand; g.randi = randi; g.pick = pickOne; g.shuffle = shuffle; g.clamp = clamp; g.lerp = lerp; g.dist = dist;
    g.hitCircle = (p, x, y, r) => !!p && (p.x - x) * (p.x - x) + (p.y - y) * (p.y - y) <= r * r;
    g.hitRect = (p, x, y, w, h) => !!p && p.x >= x && p.x <= x + w && p.y >= y && p.y <= y + h;
    /* 扩展：错题里有几道该栏目的题（不在重练 = 0）。多栏目游戏（如 rocket、monster）重练时只出 hasReview>0 的栏目 */
    g.hasReview = function (col) {
      const rv = ctx.review;
      return rv && rv.length ? rv.filter((it) => colOf(col, it)).length : 0;
    };
    function getPool() { if (!pool) pool = buildPool(ctx.G || {}); return pool; }
    g.charPool = () => getPool().bare;
    g.similarChars = (ch, n, exclude) => similarOf(getPool(), pyAll(), ch, n, exclude);
    g.pinyinOf = (text, o) => { const py = pinyinText(text, getPool(), pyAll()); return o && o.tones === false ? stripTones(py) : py; };
    g.roadPos = (lane, t, out) => sky.roadPos(lane, t, out);

    /* ---------- 调试 / 测试句柄：HW.arcade.current（退出后为 null）---------- */
    HW.arcade.current = {
      id: ctx.gameId || '', g, spec,
      get state() { return state; }, get phase() { return phase; },
      /* 跳过选关、直接开第 lv 关（不看解锁）；测试高关卡用 */
      startLevel(lv) { if (dead || errored) return false; audio(); setOv(null); startLevel(lv); return true; },
      /* 把存档的已解锁关卡设成最高（选关界面随后可选任意关） */
      unlockAll() { const m = memGet(); m.lv = maxLevel; try { ctx.mem.set('arc', m); } catch (e) { return false; } if (phase === 'select') showSelect(); return true; },
      skipCountdown() { if (phase === 'count' && !dead) { cdT = 2.5; countTick(0); return true; } return false; }
    };

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
    version: '2.2.0',
    run,
    ease: EASE,
    fonts: FONTS,
    sfx: (name) => playSfx(name),
    unlockAudio: () => { audio(); },
    soundOn: () => soundOn(),                             // 全局声音开关（与引擎音效同一来源）
    audioOut: () => audioOut(),                           // {ac, out} | null：引擎的 AudioContext 与音效总线
    current: null,                                        // 正在运行的游戏：{id, g, spec, state, phase, startLevel(lv), unlockAll(), skipCountdown()}
    gameMeta: (id) => (META[id] ? Object.assign({}, META[id]) : null),   // 注册时的 {id, name, icon, skill, blurb, kind}
    micState: () => ({ denied: MIC.denied, none: MIC.none }),
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
