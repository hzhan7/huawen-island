# 华文小岛 2.0 · 街机版规格书（在 SPEC.md 之上追加，冲突时以本文件为准）

ROOT = `/Users/hainan/Projects/huawen-island`（git 仓库，**不要 commit/push**，主线程统一提交）。

## 0. 为什么重做
用户（孩子家长）看了 1.0 的反馈原话：“一点都没有‘游戏’，要会动的游戏一样的东西”。1.0 是“题卡 + 按钮”，本质是答题 App。2.0 的每个游戏必须是**真正的动作小游戏**：画面持续在动（requestAnimationFrame 60fps）、有角色/物体运动、有物理或节奏、有生命值/连击/分数/关卡、越玩越快、打中有爆炸粒子和音效、失误有抖屏。**判断标准：静音、不看题目文字，只看画面 3 秒，也能认出这是个游戏。**
题库（content/*.json，SPEC.md §2 的 schema）已核查完毕，**原样复用、不许改**。

## 1. 文件与分工（禁改清单：除“归你”的文件外全部只读）
| 文件 | 负责 |
|---|---|
| `parts/15_arcade.js` | K：街机引擎 `HW.arcade`（Canvas 游戏框架） |
| `parts/10_core.js`、`parts/00_head.html` | WD：首页“游戏岛地图”、结算页、整体视觉改版（保留全部现有逻辑与 ctx 契约） |
| `parts/41_balloon.js` … `parts/51_monster.js` | 各游戏 agent 各写一个文件（见 §4） |
| `parts/20_games_a.js`、`parts/30_games_b.js` | 1.0 练习游戏，只读（WD 只在地图里把它们归到“练习本”） |
| `build/build.py` | 只读；已支持 `--out --report --pages-out`。**parts 下所有 `*.js` 由主线程加进 JS_PARTS**，你不用改 |
| `tools/shot.js` | 试玩截图工具（只读，用法见 §6） |

## 2. 视觉方向（WD 与所有游戏共同遵守）
**“热带华文岛”手机休闲游戏风**：明亮饱和但不刺眼的卡通世界——天空蓝、海水青绿、沙滩暖黄、椰树绿、珊瑚橙、气球红；粗描边、厚实的 3D 按钮（底部 4–6px 深色投影，按下下沉）、圆润大字；数字用 Google Fonts “Baloo 2”（回退 Arial Rounded MT Bold, system-ui），中文标题 “ZCOOL KuaiLe”，**题目里的汉字一律楷体栈** `"Kaiti SC","STKaiti","KaiTi","楷体","Noto Serif SC",serif`（教写字必须楷体/宋体字形）。新加坡元素点缀（鱼尾狮、组屋、椰树、滨海湾、榴莲），中国元素点缀（灯笼、祥云、印章）。
画布游戏**不跟随暗色模式**（每个游戏自己画完整背景，是一个自洽的世界）；DOM 页面（地图、结算）按 SPEC.md §4 的 token 三段写法支持暗色：暗色 = **夜晚的岛**（深蓝夜空、星星、灯笼暖光），不是简单反色。
不要：满屏 emoji 当图标墙、紫蓝渐变、千篇一律白卡片+阴影。emoji 可以当游戏里的角色/道具精灵（🐸🎈🐍🚀🐟），但要配上画出来的场景（天空渐变、云、波浪、道路、草地、粒子），不能只是 emoji 在白底上飘。

## 3. 街机引擎 HW.arcade（K 实现；游戏只通过它和 ctx 交互）
```js
HW.register({ id:'balloon', skill:'listen', kind:'arcade', name:'气球射击', blurb:'听词语，戳破写对的气球', icon:'🎈',
  needs:['tts'], cols:['pick'],          // cols：依赖的题库栏目（地图据此判断“题目准备中”）
  start(ctx){ return HW.arcade.run(ctx, spec); } });   // run 返回 cleanup 函数
```
`spec`：
```js
{
  maxLevel: 10,                  // 关卡数；g.level 从 1 起
  lives: 3,                      // 生命（红心）；0 = 不显示
  rounds: 8,                     // 本关要完成的题数（HUD 进度），或 function(level)
  intro: '听词语，戳破写对的气球！', // 开场 3·2·1 倒计时下方的一句玩法说明
  controls: '点气球 / 空格重听',  // 开场小字提示
  music: 'bright',               // 'bright' | 'calm' | 'drum' | null —— 五声音阶合成背景音乐
  sky: 'day',                    // 引擎画的默认背景：'day'|'sea'|'night'|'space'|'road'|'grass'|null（null=游戏自己全画）
  init(g) {},                    // 每关开始（含重玩）调用：建立本关状态
  update(g, dt) {},              // dt 秒（已夹紧 ≤ 0.05）；state==='play' 时才调用
  draw(g, c) {},                 // 每帧；c 已按 DPR 缩放，坐标 = CSS 像素 (0..g.w, 0..g.h)；在引擎背景之上、HUD/粒子之下
  down(g, p) {}, move(g, p) {}, up(g, p) {},   // 指针（鼠标/触摸统一），p={x,y,id}
  key(g, k) {},                  // 'left'|'right'|'up'|'down'|'space'|'enter'|其它原始 key
  resize(g) {},                  // 画布尺寸变化后（g.w/g.h 已更新）
  dom(g, layer) {},              // 可选：需要 DOM 叠加层时（如 HanziWriter 田字格），layer 是覆盖在画布上的绝对定位 div
  end(g) {}                      // 游戏结束/退出时清理（停麦克风等）
}
```
`g`（游戏实例）：
- 尺寸/时间：`g.w g.h`（CSS 像素）、`g.t`（本关已玩秒数）、`g.level`、`g.maxLevel`、`g.state`（'intro'|'play'|'pause'|'over'）、`g.ctx`（SPEC.md 的 ctx）、`g.G`（=ctx.grade 题库）、`g.gradeNum`
- 计分：`g.score g.lives g.combo g.done g.rounds`
  - `g.right(item, x, y, label?)`：+分（10×连击倍率）、连击+1、在 (x,y) 爆金币/星星粒子并飘字（label 或 “+20”）、音效、`ctx.score.right(item)`、`g.done++`；`g.done>=g.rounds` 时自动 `g.win()`
  - `g.wrong(item, note, x, y)`：扣 1 心（有心时）、连击清零、抖屏、红色 ✗ 飘字、音效、`ctx.score.wrong(item, note)`；心归零自动 `g.lose()`
  - `g.miss(x, y)`：只断连击+小抖动，不扣心、不记错题（用于“让它跑掉了”）
  - `g.addScore(n, x, y)`、`g.win()`、`g.lose()`：结束本关 → 引擎播放通关/失败动画（~1.5s）→ `ctx.finish({correct, total})`；通关且 ≥2 星解锁下一关（存 `ctx.mem` 键 `'arc'` = `{lv: 已解锁最高关, best: {关号: 星}, hi: 最高分}`）
- 特效：`g.burst(x,y,{color,n,kind:'star'|'coin'|'dot'|'ink'|'water'})`、`g.confetti()`、`g.float(text,x,y,{color,size})`、`g.shake(px)`、`g.flash(color)`、`g.ring(x,y,color)`（冲击波圈）
- 动画：`g.tween(obj, {prop: to}, sec, ease?, onDone?)`、`g.after(sec, fn)`（本关内安全定时，退出/重玩自动取消）、`g.ease.{linear,outQuad,inOutQuad,outBack,outBounce,outElastic}`
- 绘图：`g.text(str, x, y, {size, color, font:'kai'|'round'|'num', weight, align, baseline, stroke, strokeW, maxW})`（maxW 时自动缩小字号以放下）、`g.emoji(ch, x, y, size, {rot, alpha, flip})`（离屏缓存）、`g.rrect(x,y,w,h,r,fill,stroke,lw)`、`g.cloud(x,y,s,alpha)`、`g.shadowText(...)`；`g.wrapText(str, maxW, size, font)` → 行数组
- 声音：`g.sfx(name)`：'pop' 'coin' 'jump' 'splash' 'hit' 'whoosh' 'power' 'tick' 'bubble' 'crash' 'swing' 'chomp' 'flip' 'match' 'beat' 'good' 'bad' 'win' 'lose'（WebAudio 合成；ctx.sfx 静音开关同样生效）；`g.say(text, {rate})` → Promise（调 ctx.tts.speak，并暂时压低背景音乐）；`g.music(on)`
- 工具：`g.rand(a,b) g.randi(a,b) g.pick(arr) g.shuffle(arr) g.clamp g.lerp g.dist(ax,ay,bx,by) g.hitCircle(p,x,y,r) g.hitRect(p,x,y,w,h)`；`g.items(col, n)`：从题库栏目取 n 题（ctx.review 非空时只用错题；否则 ctx.pick）；`g.charPool()`：本年级所有汉字 → 拼音（无调）映射，用于造同音/形近干扰字
- HUD（引擎画，游戏不用管）：左上红心、中上进度条（done/rounds）+ 关卡号、右上分数（滚动增长）+ 连击火焰（≥3 连击出现“连击×N”并变色）；右上角暂停按钮（暂停遮罩：继续 / 重玩本关 / 退出）；游戏可以用 `g.hudTop` 得到 HUD 占用高度，自己的内容画在其下。
- 开场：选关界面（“第 N 关”大字、◀ ▶ 在已解锁关卡间切换、最佳星数、“开始”大按钮）→ 3·2·1·开始！动画 → play。**第一次点“开始”即为用户手势**，引擎在此时解锁 WebAudio 与 TTS。
- 画布：填满 ctx.el 可用区（宽 = 容器宽，高 = 视口剩余高度，最少 480），DPR ≤ 2，`touch-action:none`，窗口变化即 resize；页面隐藏时自动暂停；ctx.alive() 为 false 后彻底停循环、解绑事件、停音乐、停 TTS。
- 性能：iPad/手机 60fps；每帧不 new 大对象；emoji 与文字精灵离屏缓存；粒子上限 300。
- 无 TTS 时 `g.say` 立即 resolve，引擎在画面上方显示 1.5 秒字幕条（把要读的内容以拼音显示，不显示汉字答案——游戏可传 `{caption}` 自定义）。

## 4. 11 个游戏（id / 文件 / 技能 / 题库栏目 / 核心玩法）
每个游戏都要：关卡越高越快/越多干扰；有连击；打中有粒子+音效；失误有反馈；手机竖屏（390×844）和电脑横屏（1280×800）都好玩；键盘可玩（电脑）；ctx.review 时用错题（`g.items`）。
1. **balloon 🎈 气球射击**（`41_balloon.js`，listen，pick）：朗读 say（开局 + 🔊 按钮 + 空格重听；第 2 遍读 ctx 例句）。彩色气球（渐变+高光+飘动的绳子，左右摇摆）从底部升起，每个气球上写一个选项（楷体大字）；点中正确气球 → 爆炸成彩纸+金币；点错 → 气球喷墨汁炸开、扣心；正确气球飞出顶部 → miss 并重新放一轮。关卡越高：上升越快、同屏气球越多（选项重复出现）、有风。每关 8 题。
2. **catcher 🧺 天降汉字**（`42_catcher.js`，listen，words）：朗读词语 w（可重听，第 2 遍读例句 s）。汉字从天上掉下（带降落伞/或旋转的小云朵），包括这个词的每个字 + 同音/近音/形近干扰字（`g.charPool()`）；拖动（或 ←→）底部的篮子（可以是背着篮子的小熊猫）按顺序接住词语的字，接到的字飞进上方的田字格槽位；接错扣心；需要的字掉出屏幕会重新掉。越高关越快、干扰越多、偶尔有炸弹 💣（接到扣心）和星星 ⭐（接到加分）。每关 6 个词。
3. **frog 🐸 青蛙过河**（`43_frog.js`，listen，stories）：先是“电台”场景（画一台会跳动的收音机、声波动画、第 k/n 句），TTS 逐句读故事（不显示原文）；然后过河：每道题是一条河道，3–4 片荷叶载着选项左右漂流（选项长就用小字换行），题目横幅在顶部（可点 🔊 朗读）；点荷叶 → 青蛙抛物线跳跃（挤压拉伸动画）；答对稳稳落地进入下一条河道（镜头上移）；答错落水扑通、水花、游回岸边、扣心。答完到达对岸荷花宝座 → 通关。每关 1 篇故事（3–4 题），关卡越高漂得越快。
4. **rocket 🚀 声音火箭**（`44_rocket.js`，speak，readaloud + twisters）：把朗读段拆成短句。上半屏：火箭从发射台升空、穿过云层/飞机/卫星/月亮（视差滚动）。下半屏：卡拉OK字幕——一颗跳跳球按年级语速逐字跳过汉字（跳到的字变亮）。**有麦克风时**（`navigator.mediaDevices.getUserMedia` 成功；失败/拒绝立即降级，不重复弹窗）：音量驱动火箭推力（说话时喷火上升，安静下坠），读完一句燃料结算；**无麦克风时**：“节拍模式”——孩子边大声读边在跳跳球落到每个字时点“🔥”按钮（或空格），按准→推力。可先听示范（g.say）。每关 4 句，关卡越高语速越快。退出必须停掉麦克风轨道。
5. **beat 🥁 绕口令节拍**（`45_beat.js`，speak，twisters）：音乐节奏游戏。绕口令的字（上方小字拼音）从右往左滚到左侧“鼓面”判定圈，伴随合成鼓点节拍；孩子边读边在字到达判定圈时点击鼓面（或空格）→ Perfect / Good / Miss 判定（大字弹出+光圈），连击越高鼓面越炫。开局可听示范（g.say 按本关语速）。关卡 = 速度（慢→中→快→超快）。每关 1–2 条绕口令。
6. **racer 🏎️ 华文赛车**（`46_racer.js`，read，quiz）：伪 3D 或俯视赛道，3–4 条车道，路边有椰树、组屋、路灯飞速后退（视差）；顶部题目横幅；前方开来一排“选项门”（每道门写一个选项）；点车道/左右滑动/←→ 换道；穿过正确门 → 氮气加速火焰+金币雨；撞错门 → 打滑转圈、扣心，并在屏幕上显示讲解 e 两秒。关卡越高车速越快、门来得越快。每关 10 题。
7. **snake 🐍 贪吃蛇排句子**（`47_snake.js`，read，order；只用非 para 题，不足再用 para 并把句子块缩成“①②③”编号显示）：网格地图，词块散落为可吃的“果子”（气泡里写词块）；蛇头按顺序吃词块，吃到的块依次接在顶部“句子条”里并挂在蛇身上；吃错 → 扣心、词块弹开换位置；撞墙/撞自己 → 扣心并复位（1–2 关墙可穿越）。控制：滑动、屏幕方向键、←↑→↓。越高关蛇越快。每关 5 句。
8. **memory 🃏 拼音翻翻乐**（`48_memory.js`，read，words）：翻牌记忆配对（词语牌 ↔ 拼音牌），3D 翻转动画（scaleX 翻面）、开局 2 秒偷看、配对成功两张牌飞向收集区并爆星星、配错翻回并轻抖；计时+连击；关卡越高牌越多（6→12 对）、偷看越短。每关 1 盘。同一盘不能有同拼音的词。
9. **mole 🔨 打地鼠找错字**（`49_mole.js`，write，typo）：上方木牌显示有错字的句子 s；下方 6–9 个地洞，地鼠举着字牌冒出又缩回（弹性动画）：第一阶段举的是句子里的字（含错字 bad），要敲“举着错字”的地鼠；第二阶段地鼠举 opts 里的字，要敲正确的 good → 木牌上错字被红笔划掉、换成正确字的动画。锤子挥动动画、敲中星星乱飞、敲错扣心。越高关地鼠出没越快、同时冒出越多。每关 6 题。
10. **fishing 🎣 偏旁钓鱼**（`50_fishing.js`，write，build）：海面小船上的小猫举着“base”字；海里的鱼（不同颜色大小、摆尾游动、气泡）身上写着偏旁 opts；点鱼 → 鱼钩带着钓线沉下去钩住拉上来；正确 → 偏旁飞到 base 旁合成 ans（放大发光）并显示 hint 词与拼音；错误 → 鱼挣脱溅水、扣心；偶尔钓到旧靴子（miss）。越高关鱼游得越快、干扰鱼越多。每关 8 题。
11. **monster 👾 写字打怪兽**（`51_monster.js`，write，chars；第 6 关起混入 words 听写：只朗读不显示字）：上半屏画布：左边城堡、右边怪兽一步步逼近（血条 = 该字笔画数）；下半屏用 `spec.dom` 叠 HanziWriter 田字格（`ctx.hanzi.create` 的 quiz 模式；1–2 关显示描红轮廓，3–5 关不显示轮廓但错 2 次给提示，6 关起听写）；每写对一笔 → 城堡发射火球击中怪兽（掉血、受击闪白）；写错一笔 → 怪兽前进一步；写完 → 怪兽爆炸成星星、下一只更大；怪兽到城堡 → 扣心。每关 5 个字。无笔顺数据的字跳过。

## 5. 地图与核心改版（WD）
- 首页 = **会动的游戏岛地图**：四座岛（听·灯塔岛 / 说·舞台岛 / 读·书树岛 / 写·毛笔山岛），天空云朵飘、海浪起伏、小船/海鸥动画（CSS/SVG 动画，尊重 prefers-reduced-motion）；每座岛上是该技能的街机游戏关卡按钮（大圆形 3D 按钮：图标 + 名字 + “第 N 关”徽章 + 最佳星；读 `profile.mem[gid].arc`），当前档案的头像在岛上跳动。每座岛下方有收起的“📒 练习本”，放 1.0 的练习游戏（kind 缺省/'practice' 的都算练习）。
- 顶部 HUD：头像+名字（点开换人）、年级 P2–P6 切换、小红花数（金币样式）、印章数、声音开关。“今日四件事”做成任务板（听说读写四个图标，完成盖章）。错题本/印章册/学习记录/档案入口保留，改成游戏风格的按钮。
- 进入 arcade 游戏时：顶栏只保留“← 退出”和游戏名（进度/连击由画布 HUD 负责），游戏区域占满剩余高度；练习游戏保持原顶栏。
- 结算页游戏化：星星逐个弹出、小红花金币数字滚动、彩带；arcade 游戏额外显示“第 N 关 · 得分 · 最高分 · 下一关已解锁”（读 mem）。“再来一轮”对 arcade = 进入选关界面并默认选下一关（若已解锁）。
- 保留：所有存储/同步/错题本/印章/TTS/ASR/AI/HanziWriter 逻辑、ctx 契约、`HW.start/HW.setGrade`、卡片 id `hw-g-<id>`。HW.register 接受 `kind` 与 `cols`（availability 按 cols 判断题库是否为空；无 cols 时沿用旧逻辑）。
- 1.0 的“作业本/田字格/印章”物件感可以保留在练习本和印章册里，但首页主视觉换成游戏岛。

## 6. 测试（每个 agent 必做，用真浏览器看效果）
构建到自己的目录，避免与他人冲突：
```
cd ROOT && .venv/bin/python build/build.py --out build/_t_<你的id>/dist.html --report build/_t_<你的id>/report.txt --pages-out build/_t_<你的id>/index.html
node tools/shot.js --page build/_t_<你的id>/index.html --game <id> --grade p3 --size 390x844 --wait 2500 --out build/_t_<你的id>/m1.png --steps steps.json
```
（`--size 1280x800` 看电脑横屏；`--dark` 看暗色；steps 里可 `{"eval":"..."}` 读游戏内部状态、`{"tap":[x,y]}` 点击、`{"key":"ArrowLeft"}`、`{"shot":"x.png"}` 连拍。）
截图用 Read 工具**亲眼看**：画面是否在动（连拍 3 张对比）、字是否清楚、手机上按钮是否够大、有无遮挡溢出；**用 steps 真正玩通一关**（通关与失败两条路径都要走到结算），控制台必须 0 错误。
注意：build.py 目前只打包 JS_PARTS 里列出的 parts；主线程已把它改成自动包含 `parts/*.js`（按文件名排序）。
