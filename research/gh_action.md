# GitHub 调研 · 动作/街机类（华文小岛 2.0）

> 调研日期 2026-09-18 · 负责分支：动作/街机（跑酷、Flappy、跳台、切水果、过马路、射击、GD 节奏跑、弹弓、塔防/PvZ、slither、打砖块、吃豆人）
> 证据等级标注：**【实测】**= 本次用 `gh api repos/…`、`gh api …/git/trees`、`curl` 亲自读到的数；**【原文】**= 仓库 README / 源码 / 网页原话（附链接）；**【推断】**= 我的判断，未经孩子试玩验证。
> 星数、许可、最近 push、仓库体积全部是 2026-09-18 `gh api repos/OWNER/REPO` 的读数【实测】。demo 状态码是同日 `curl -L` 的结果【实测】。

---

## 0. 先说结论（给主线程/家长的 6 句话）

1. **最值得借来的是“机制循环”，不是整仓代码。** 我们已经有 `HW.arcade` 引擎（`init/update/draw/down/move/up/key`、粒子、合成音效、HUD、TTS，见 `SPEC_ARCADE.md §3`）。入选仓库的核心循环（重力+跳、管道生成、切割判定、车道碰撞、迷宫寻路、塔的索敌）大多只有 100–400 行，**照着搬进 spec 的 update/draw 比把整个仓库塞进单页更省事**，还顺带绕开了外部资源和许可问题【推断】。
2. **最适合“单页 + 不能 fetch”约束的，是纯 Canvas 矢量绘制、零图片/零音频文件的仓库**：`oldj/html5-tower-defense`（README 原文“没有用到图片，游戏中的所有物品都是使用 HTML5 画出来的”）、`mumuy/pacman`、`jackrugile/radius-raid-js13k`（音效用 jsfxr 合成）、`bibhuticoder/snake.io`（“All the graphics … are vector drawings”）、`GeekBoySupreme/crossy-road`（three.js 几何体拼的体素风，无贴图）、`MilllerTime/menja`（8kB）。
3. **许可有坑，实测到 5 个**（§14 详列）：`ishaanSh06/BlockNinja` 标 BSD-3，但源码里 `highScoreKey = '__menja__highScore'`，就是 Caleb Miller 的 Menja（GitHub 版 GPL-3.0）；`rembound/Bubble-Shooter-HTML5` 仓库 LICENSE 是 MIT，JS 文件头却写 GPL-3；`evilgaoshu/PvZ` 标 Apache-2.0，但 README 自述“集成了官方高清 BGM”；`G43riko/PlantsVsZombies` 代码 MIT，图片是原作美术；`layyback/zType` 标 MIT，看起来是商业游戏 ZType 的拷贝【推断】。**没有 LICENSE 的仓库**（`ChineseDron/fruit-ninja` 426★、`kubowania/Doodle-Jump` 101★、`straker/endless-runner-html5-game`、`knagaitsev/slither.io-clone` 265★）只能看思路，不能抄代码。
4. **触摸支持参差不齐**【实测：对主 JS/HTML 文件 grep `touchstart|pointerdown|touchend`】：t-rex、floppybird、doodle-jump、Menja、spaceinvaders、javascript-breakout 有触摸；Boxy-Run、crossy-road、mumuy/pacman、radius-raid、PolyDash、snake.io **只有键盘或鼠标**。好在引擎的 `down/move/up` 已经把鼠标和触摸统一了，移植时顺手补上即可。
5. **融合原则 = “内在整合”（intrinsic integration）**：让华文判断成为“每一秒都在做的那个动作”本身，而不是暂停去答题。Habgood & Ainsworth（2011，J. Learning Sciences 20(2):169–206）用数学游戏 *Zombie Division* 给 7–11 岁儿童做对照：内在整合版在限时条件下学得更多，自由时间里愿意玩的时长约是外挂题版的 7 倍【原文：[ERIC EJ922627](https://eric.ed.gov/?id=EJ922627)、[T&F](https://www.tandfonline.com/doi/abs/10.1080/10508406.2010.508029)】。反面例子：`Dprogers10/HanziCommander`（0★）射击打汉字，但“没子弹了要先打出拼音才能装弹”，本质还是弹题卡【原文 README】。
6. **与已有 11 个玩法的重叠**：racer（选项门换道）≈ Subway Surfers 的“选道”，snake 已有，balloon/catcher 已覆盖“点/接正确项”。所以本分支**优先推荐全新手感**的：Flappy（点按节奏）、Doodle Jump（左右倾斜+踩台）、切水果（划动）、过马路（躲车流）、太空射击/泡泡龙（瞄准）、GD 节奏跑（踩拍跳）、弹弓（拉弓物理）、塔防/植物大战僵尸（布阵策略）、吃豆人（迷宫追逃）、打砖块（反弹）。

---

## 1. 总览表

| # | 类型 | 首选仓库（完整 URL 见各节） | ★ | 许可 | 技术 | 华文怎么“长进机制里”（一句话） | 适合 | 改编难度 |
|---|------|----------------------------|---|------|------|-------------------------------|------|---------|
| 1 | 无尽跑酷 2D | wayou/t-rex-runner | 2186 | BSD-3 | 纯 Canvas，自带触摸 | 跑动中跳起吃“字金币”按顺序拼出听写词，踩到形近字仙人掌就摔跤 | 都适合（P2 慢速） | 中 |
| 1b | 三车道 3D 跑酷 | wanfungchui/Boxy-Run | 30 | Apache-2.0 | three.js | 车道 = 声调：听到字音，在字撞到你之前换到对应声调的车道 | P4 男孩 | 中 |
| 2 | Flappy | nebez/floppybird | 600 | Apache-2.0 | DOM div + jQuery（本地文件） | 每根管子有 2–3 个缺口，缺口上写字，只能从“读 qíng 的字”那个缺口钻过去 | 都适合 | 低 |
| 2b | Flappy | omariosouto/flappy-bird-devsoutinho | 238 | MIT | 纯 Canvas + 1 张精灵图 | 同上（Canvas 版，更好嫁接到 HW.arcade） | 都适合 | 低 |
| 3 | Doodle Jump | takosenpai2687/doodle-jump | 6 | MIT | p5.js（cdnjs 有） | 只有写着目标部首字的踏板是实的，其余一踩就碎（仓库自带“易碎踏板”） | P2 女孩最爱 | 低–中 |
| 3b | 马里奥式平台 | jakesgordon/javascript-tiny-platformer | 193 | MIT | 纯 Canvas，12KB | 顶问号砖：错别字句子铺成一排砖，顶出错字、吃掉掉下来的正确字 | P4 男孩 | 中 |
| 4 | 切水果 | MilllerTime/menja | 54 | GitHub GPL-3.0 / CodePen 版 MIT | 纯 Canvas 伪 3D，8kB | 按结构下刀：左右结构竖着划、上下结构横着划，字被劈成两半（明→日｜月） | 都适合 | 中 |
| 5 | 过马路 | GeekBoySupreme/crossy-road | 30 | MIT | three.js r99（cdnjs），无贴图 | 车流里散落“字宝石”，跳着收集给中心字组词（火→车/山/红），撞车或吃错字扣心 | P2 女孩 | 中 |
| 5b | 过马路 | TheCodingRocket/ChickenHop | 18 | MIT | three.js，支持手机 | 同上，手机手感更好 | P2 女孩 | 中 |
| 6 | 太空射击 | dwmkerr/spaceinvaders | 213 | MIT | 纯 Canvas，单文件 24KB | 敌阵每个外星人举一个字，听音只打读音对的那个；打错它就俯冲 | P4 男孩 | 低 |
| 6b | 双摇杆弹幕 | jackrugile/radius-raid-js13k | 273 | MIT | 纯 Canvas + jsfxr 合成音 | 量词枪：数字键切换“本/只/条/张”子弹，名词怪只吃对的量词 | P4 男孩 | 中 |
| 6c | 泡泡龙 | rembound/Bubble-Shooter-HTML5 | 59 | 仓库 MIT / 文件头 GPL-3（冲突） | 纯 Canvas | 同部首的字泡泡凑 3 个就消（湖/河/清一串爆掉） | P2 女孩 | 低–中 |
| 7 | GD 节奏跑 | ishaanSh06/PolyDash | 6 | BSD-3 | 纯 Canvas，80KB | 地形就是声调曲线：一声平路、二声上坡、三声坑、四声下坡，TTS 念到哪个音节就要跳/滑对 | P4 男孩 | 中–高 |
| 8 | 弹弓物理 | liabru/matter-js（examples/slingshot.js） | 18418 | MIT | matter.js（cdnjs 有） | 积木塔上每块写一个词，句子挖空“我们要___每一分钟”，打飞写着“珍惜”的那块 | P4 男孩 | 低 |
| 9 | 塔防 | oldj/html5-tower-defense | 386 | MIT | 纯 Canvas，无图片，自带中文版 | 怪物头顶拼音，塔是字，塔只打读音对得上的怪 | P4 男孩 | 中 |
| 9b | 植物大战僵尸式 | （无合格 JS 仓库，见 §9）| – | – | 用 oldj/LittleJS 自建 | 僵尸举“大”，在它那条路种“小”（反义词）才挡得住 | P4 男孩 | 中–高 |
| 10 | slither.io | bibhuticoder/snake.io | 48 | MIT | 纯 Canvas 矢量 + AI 蛇 | 只吃符合当前规则的发光字豆（如“氵旁”），吃错身体缩短；AI 蛇来抢 | 都适合 | 中 |
| 11 | 打砖块 | end3r/Gamedev-Canvas-workshop（MDN 教程） | 436 | 代码 CC0 | 纯 Canvas，10 课共约 5KB | 砖块掉出“字胶囊”，挡板只接能组成听写词的字，接错挡板变短 | 都适合 | 低 |
| 11b | 打砖块 | KilledByAPixel/LittleJS（examples/breakout） | 4181 | MIT | LittleJS（jsdelivr 有） | 同上 | 都适合 | 低 |
| 12 | 吃豆人 | mumuy/pacman | 1643 | MIT | 纯 Canvas，自带小引擎，12 关 | 能量豆写着“qīng”，吃了以后只有读 qīng 的鬼能吃，吃错鬼就被抓 | 都适合 | 中 |
| 12b | 吃豆人 | platzhersh/pacman-canvas | 352 | CC0（代码） | Canvas + 音效文件 | 同上 | 都适合 | 中 |

**引擎（可选，都在允许的 CDN 上，URL 同日 `curl` 返回 200）**：LittleJS 1.18.29（`cdn.jsdelivr.net/npm/littlejsengine@1.18.29/dist/littlejs.min.js`，190KB）、KAPLAY 3001.0.19（`cdn.jsdelivr.net/npm/kaplay@3001.0.19/dist/kaplay.js`，189KB）、Phaser 3.80.1（cdnjs，1.18MB）、matter-js 0.20.0（cdnjs，83KB）、three.js r99 / r128（cdnjs，551KB / 603KB）、p5.js 1.9.4（cdnjs，1.03MB）。注意 cdnjs 上 three.js 最新版 0.186.0 的入口是 `three.tsl.js`（ES module），老仓库用的全局 `THREE` 请锁 r128 或更早【实测】。

---

## 2. 设计通则（所有玩法共用）

- **线索一直在场**：目标用 HUD 顶部“目标牌”（例：`找读 qíng 的字` / `组词：火__`）+ TTS 播报（`g.say`）双通道；P2 女孩默认开 TTS、显示拼音；P4 男孩可以关拼音拿“盲玩加分”。
- **答错就是物理后果，不弹窗**：撞管子、踏板碎掉、被鬼抓、挡板变短。讲解 `e` 只在结算页或死亡回放里出现 2 秒（racer 已有这个做法）。
- **干扰项来源**：`g.charPool()`（同音/近音/形近）+ `quiz` 里 `同音字/形近字/多音字/声调/部首` 各类的 `c` 选项。
- **难度曲线**：关卡越高 → 速度越快、同屏干扰越多、线索越少（拼音 → 只有 TTS → 只有释义）。
- **两个孩子的偏好是推断**：P2 女孩（约 8 岁）→ 可爱角色、收集装扮、宽容（不秒死、有“护盾”）；P4 男孩（约 10 岁）→ 速度、连击、Boss、分数排行、物理破坏。以下“适合谁”都属【推断】，要靠实际试玩校正。

---

## 3. 无尽跑酷（Temple Run / Subway Surfers / 恐龙快跑）

### 3.1 wayou/t-rex-runner — https://github.com/wayou/t-rex-runner
- 数据【实测】：2186★ · BSD-3-Clause · 最近 push 2024-07-28 · demo https://chromedino.com （200）· 核心 `index.js` 90KB、精灵图 `offline-sprite-1x.png` 2.5KB。
- 来历【原文】：“the t-rex runner game extracted from chromium”；LICENSE 写 BSD-3（Copyright 2022 牛さん），底层代码来自 Chromium（同为 BSD 风格）。
- 触摸/键盘【实测】：主文件里 touch 相关 14 处、按键相关 23 处——手机点一下就跳，现成。
- 为什么好玩：一个按键就能玩，越跑越快、夜间模式切换、打破纪录的“再来一次”冲动；8 岁也能上手【推断】。
- **华文融入（机制本身）**：
  - **“字金币”接龙**（words）：TTS 说“珍惜”，空中飘着一串字金币（珍、惜 + `charPool` 的形近/同音干扰字 真、借、昔）。必须**按顺序**跳起来吃到“珍”再吃“惜”，吃完词语飞进顶部田字格；吃到干扰字 = 恐龙被绊一下、扣心。地面仙人掌仍要跳过，所以“跳不跳、何时跳”同时由躲障碍和选字决定。
  - **P2 版**：金币上标拼音，速度 0.7 倍，吃错只减速不扣心。
  - **P4 版**：不标拼音、只播例句 `s`（把目标词挖空），靠听懂句子去找字。
- 改编可行性：精灵图很小，可以换成我们的吉祥物（重画 1 张图，转成 data URI）；90KB 是 Chromium 为兼容性写的，真正要的“地面滚动 + 障碍生成 + 跳跃物理”约 200 行可以重写进 `HW.arcade`【推断】。依赖：无。

### 3.2 wanfungchui/Boxy-Run — https://github.com/wanfungchui/Boxy-Run
- 数据【实测】：30★ · Apache-2.0 · 2024-03-20 · demo https://wanfungchui.github.io/Boxy-Run/ （200）· `js/game.js` 22.7KB + 本地 three.min.js（旧版，全局 `THREE`）。
- 【原文】“A Three.js survival game inspired by ‘Temple Run’, developed for educational purposes … jump and shuffle to avoid the trees.” 画面全是 three.js 几何体（方块人、方块树），没有贴图。
- 控制【实测】：只有键盘（←/→ 换道、↑ 跳），需要补滑动手势。
- 为什么好玩：第三人称 3D 纵深，“树冲过来我左闪右闪”的临场感，很像 Subway Surfers【推断】。
- **华文融入 — “声调车道”**：地面画 4 条车道，车道上刷着 ˉ ˊ ˇ ˋ。前方飞来一个个“字方块”（`chars`/`words` 里的字），TTS 读出字音；孩子要在字方块撞到自己之前**换到这个字声调的车道**，接住它（金币+连击）；站错道 = 被方块撞飞。多音字关卡（quiz 类“多音字”）：先播例句，按句中读音选道。
  - 这跟已有的 racer（选项门）不同：racer 考“选哪个答案”，这里考“听辨声调”，而且是连续流。
  - P2 版：只有 2 条道（“平”一、二声 vs “仄”三、四声），或者道上直接写拼音。
- 改编可行性：代码不长；three.js 从 cdnjs 锁 r99/r128；要补触摸滑动、换成我们的配色和角色。three.js 约 0.55MB，离 16MB 很远。

### 3.3（备选）juwalbose/ThreeJSEndlessRunner3D — https://github.com/juwalbose/ThreeJSEndlessRunner3D
- 【实测】26★ · MIT · 2020-06-19 · `src/endlessroller.js` 13KB + three.min.js。滚球在弧形地面上的 3 车道跑酷，是 Boxy-Run 之外另一个很短的 three.js 基底；用途同 3.2。

---

## 4. Flappy Bird 类

### 4.1 nebez/floppybird — https://github.com/nebez/floppybird
- 数据【实测】：600★ · Apache-2.0 · 2026-02-17 · demo https://nebezb.com/floppybird/ （200，另有 `?easy` 简单模式）· `js/main.js` 12KB（42 处 `$(` jQuery 调用），依赖本地 `jquery.min.js`、`jquery.transit.min.js`、`buzz.min.js`（音频）；图片都是几百字节的小 PNG，音效 ogg。`index.html` 还挂了一个外部统计脚本（`yummy.nebez.dev/script.js`），移植时删掉。
- 【原文】README：“good ol' div's for all the objects”“scales perfectly on almost any screen, both mobile and desktop”；README 的 Clones 列表里就有人拿它做过教数学的 “flappy-math-saga”——“内容套进 Flappy”有先例。
- 触摸【实测】：main.js 里有触摸处理。
- 为什么好玩：一个按键 + 很难 + 马上重来，高分炫耀；对 10 岁男孩尤其“上头”【推断】；`?easy` 模式说明它本身就能调成适合 8 岁的难度。
- **华文融入 — “缺口选字”**（就是任务书里说的那种）：
  - 每根管柱开 **2–3 个缺口**，缺口两侧的管子上写字；顶部目标牌/TTS 给出线索，**只有正确那个缺口是真的通道**，其余缺口是“玻璃墙”（撞上就碎、扣心）。
  - 线索类型可轮换，全部来自现有题库：读音 → 字（`chars.py`，“找读 qíng 的字”，缺口 晴/情/请）；词 → 缺字（`words.w` 挖掉一个字，“珍__”，缺口 惜/借/昔）；`quiz` 的 同音字/形近字/声调/部首 类直接用 `c` 做缺口、`a` 做正确缺口。
  - 关卡：P2 = 2 个缺口 + 缺口间距大 + 慢；P4 = 3 个缺口 + 形近字 + 管子上下移动。
- 改编可行性：DOM 实现（div + CSS 动画），嫁接到 HW.arcade 的 Canvas 需要重写渲染，但物理只有“重力 + 点一下给向上速度 + 管柱左移”几十行；图片很小，可以直接内嵌或用 Canvas 画。**难度低**。

### 4.2 omariosouto/flappy-bird-devsoutinho — https://github.com/omariosouto/flappy-bird-devsoutinho
- 数据【实测】：238★ · MIT · 2024-03-06 · `jogo.js` 9.3KB + `sprites.png` 13.7KB；有配套的葡萄牙语从零教学视频播放列表（homepage 是 YouTube）。
- 纯 Canvas，结构是“场景对象 + update/draw”，和 HW.arcade 的 spec 形状几乎一样，是**最容易直接改写**的 Flappy 基底【推断】。输入只有 `window.addEventListener('click', …)`【实测】——手机点按也会触发 click，能玩，但换成引擎的 `down` 响应更快。
- 华文融入：同 4.1。

---

## 5. 跳跃平台（Doodle Jump / 马里奥）

### 5.1 takosenpai2687/doodle-jump — https://github.com/takosenpai2687/doodle-jump
- 数据【实测】：6★（星少但新）· MIT · 2026-05-26 · demo https://takosenpai2687.github.io/doodle-jump/ （200）· `js/index.js` 18KB + `platform.js` 4KB，依赖 p5.js（cdnjs 有）。素材：`doodler_left/right.png`、`spring.png`、`hole.png`，音效 5 个。
- 【原文】README：“2026.01.14 … fixed iOS device support”；“Touch screen left part or right part to move”；有弹簧、黑洞、易碎踏板（素材名 `fragile.mp3`、`blackhole.mp3`）。
- 为什么好玩：往上跳没有尽头、左右穿屏、弹簧一下飞很高——低门槛、高爽感，8 岁女孩也能玩很久【推断】。
- **华文融入 — “只有对的字能踩”**：
  - 顶部目标牌：“踩所有 **氵** 旁的字”（`chars.bs`）/ “踩读 **第三声** 的字”/ “按顺序踩出 **火车**”。
  - 踏板上写字；**写着对的字的踏板是实的**（踩上弹起、字发光、+分），**错的字 = 仓库现成的“易碎踏板”**，一踩就碎、往下掉。所以每一跳都要先看字再决定往哪边偏——知识就在跳跃落点里。
  - 弹簧 = 连续踩对 5 个奖励；黑洞 = 错别字黑洞（`typo.bad`），碰到就被吸走。
  - P4 版：成语接龙塔——`quiz` 成语类的四个字分散在不同高度，必须按顺序踩上去才算一层。
- 改编可行性：代码短；3 张角色图要换成我们的角色（或用 emoji 精灵 `g.emoji`）；p5.js 1MB 不必引入，物理照抄进 HW.arcade 即可【推断】。**难度低–中**。

### 5.2 jakesgordon/javascript-tiny-platformer — https://github.com/jakesgordon/javascript-tiny-platformer
- 数据【实测】：193★ · MIT · 2025-06-01 · demo https://jakesgordon.com/games/tiny-platformer/ （200）· `platformer.js` 12KB，关卡是 Tiled 导出的 `level.json`，全仓 43KB。
- 【原文】“A very minimal javascript platform game … run around some rectangle platforms, collecting rectangular gold and avoiding rectangular monsters.” 作者另有两篇讲解文章（加怪物、加宝藏）。
- 为什么好玩：马里奥式“跑、跳、踩怪、顶砖”，男孩最熟悉的手感【推断】。
- **华文融入 — “顶错字”**（typo）：
  - 关卡的一段是一排“问号砖”，按顺序拼成 `typo.s` 这句话；孩子要在跑动中**跳起来用头顶那个错字砖**（`typo.bad`），砖里弹出 `typo.opts` 的几个字金币往下掉，再**吃掉正确的那个**（`typo.good`），砖变成金色的正确字。顶错砖 = 砖里钻出一只小怪。
  - 踩怪：每只小怪背着一个字，只能踩“和旗子上的字同部首”的怪，踩错会被弹开。
- 改编可行性：12KB，Canvas；关卡可以程序生成（一排砖 = 一句话）而不用 Tiled；触摸要加屏幕左右键+跳键（LittleJS 自带虚拟手柄，见 5.3）。**难度中**。

### 5.3 KilledByAPixel/LittleJS（examples/platformer）— https://github.com/KilledByAPixel/LittleJS
- 数据【实测】：4181★ · MIT · 2026-09-15（活跃）· 例子在线 https://killedbyapixel.github.io/LittleJS/examples/platformer/ （200）· platformer 例子的 JS 共约 45KB，另有 breakout、puzzle、particles 等例子。
- 【原文】README：“Comprehensive input handling for mouse, keyboard, gamepad, and touch”“Customizable on screen gamepad designed for mobile devices”“Use ZzFX sound generator to play sounds without asset files”。
- 作用：如果某个玩法要做成真正的横版平台（带瓦片地图、粒子、屏幕虚拟手柄），用 LittleJS 比手写省事；它的**合成音效（ZzFX）和虚拟手柄**正好满足“不能加载外部音频 + 要 iPad 触摸”。

### 5.4（备选）starzonmyarmz/js13k-2018 “ONOFF” — https://github.com/starzonmyarmz/js13k-2018
- 【实测】210★ · MIT · 2021-10-08 · demo https://js13kgames.com/entries/onoff 。【原文 awesome-jsgames 描述】25 个手工关卡、在两个“维度”之间切换躲尖刺。可借“开/关”机制：**按一个键在“一声/四声”两套平台之间切换**，只有和 TTS 读的字同声调的平台会出现。

---

## 6. 切水果（Fruit Ninja）

### 6.1 MilllerTime/menja（Caleb Miller）— https://github.com/MilllerTime/menja
- 数据【实测】：54★ · GitHub 仓库 **GPL-3.0** · 2026-06-23 · 源码 `src/js/*.js` 合计约 53KB（未压缩），无图片无音频。官方在线版 https://menja.cmiller.tech/ （200）。
- 【原文】作者主页称其为 “an 8kB game by Caleb Miller”；CodePen 原帖 https://codepen.io/MillerTime/pen/BexBbE （curl 返回 403，疑为反爬，不代表下线）。CodePen 规定“public Pens are MIT licensed”【原文：[CodePen Licensing](https://blog.codepen.io/documentation/licensing/)】，所以同一份代码**从 CodePen 取用可按 MIT**，从 GitHub 取用按 GPL-3.0【推断，用前打开 CodePen 全页源码确认 license 注释】。
- 源码里现成的机制【实测 globalConfig.js】：连击后慢动作（`slowmoThreshold = 10`）、需要多刀的“坚固方块”（`strongThreshold = 25`）、旋转方块（`spinnerThreshold`）、指针速度过低不算切（`minPointerSpeed = 60`），指针/触摸都支持（interaction.js 里 6 处触摸相关）。
- 为什么好玩：划屏幕的爽快感 + 方块碎裂粒子 + 慢动作，是 iPad 上最自然的手势；8 岁和 10 岁都爱【推断】。
- **华文融入 — “按结构下刀”**（用 `chars.jg`）：
  - 飞起来的不是方块而是**字块**。顶部目标牌写规则，每 20 秒换一次：“切 **左右结构** 的字”→ 必须**竖着划**，字沿中缝裂成左右两半（明 → 日｜月 飞开，两半上显示部件）；“切 **上下结构**”→ **横着划**（岩 → 山／石）。划错方向 = 刀被弹开；切到不符合规则的字 = 它变成炸弹炸开、扣心。
  - 规则也可以换成：同部首（`bs`）、同声调、反义词对（`quiz` 反义词：同时一刀划过“大”和“小”才算，一刀多字 = 连击）。
  - P2 版：只考部首（带颜色提示），慢动作常开。P4 版：结构+声调混合，坚固字块（笔画多的字）要两刀。
- 改编可行性：伪 3D 方块渲染要换成“字块”（Canvas 写字 + 切开时用 clip 画两半），这是主要工作量；其余切割判定/粒子可以复用。**难度中**。

### 6.2（仅参考，别用代码）
- `ishaanSh06/BlockNinja` https://github.com/ishaanSh06/BlockNinja —【实测】21★，标 BSD-3，但 `index.js` 里 `highScoreKey = '__menja__highScore'`，就是 Menja 的拷贝；许可来源不清，**不用**。
- `ChineseDron/fruit-ninja` https://github.com/ChineseDron/fruit-ninja —【实测】426★、**无 LICENSE**、2012 年停更；中文社区经典 HTML5 水果忍者，只看刀光轨迹的写法。

---

## 7. 过马路（Crossy Road）

### 7.1 GeekBoySupreme/crossy-road — https://github.com/GeekBoySupreme/crossy-road
- 数据【实测】：30★ · MIT · 2020-08-16 · 全仓 7 个文件：`script.js` 19.5KB + `index.html` + `style.css`；three.js r99 从 **cdnjs** 引（`cdnjs.cloudflare.com/ajax/libs/three.js/99/three.min.js`，同日 200）；小鸡、汽车、树全用 three.js 方块拼，**零贴图**。另引用了 fontawesome kit（外部脚本，需删掉）。
- demo：README 写的 https://crossy-road.glitch.me/ 同日返回 **410（已下线）**【实测】。
- 控制【实测】：只有键盘（`keydown`），需补“点一下前进、滑动左右”。
- 为什么好玩：体素小鸡超萌、一格一格跳、车流紧张刺激，对 8 岁女孩吸引力很高【推断】。
- **华文融入 — “组词过马路”**（用 `chars.words`）：
  - 起点草地上立着一个中心字（`chars.c`，如“火”）；每条车道/河道上散落“字宝石”（车、山、红 + `charPool` 干扰字）。孩子一边躲车一边**跳上宝石**：能跟“火”组成词的宝石 → 宝石飞进身后的“词语背包”并读出“火车！”；干扰宝石 = 碎裂、扣心。集齐 3 个词 = 前方出现旗子（通关检查点）。
  - 河道：木头上写着字，**只有能组词的木头是木头，其余是假装成木头的鳄鱼**（踩上去就沉）。
  - P4 版：中心字换成成语的前两个字，宝石是后两个字的候选。
- 改编可行性：代码短、无素材，是**最适合单页的 3D 基底**；工作量在“字宝石”（用 Canvas 贴图写字做 `THREE.CanvasTexture`）和触摸。**难度中**。

### 7.2 TheCodingRocket/ChickenHop — https://github.com/TheCodingRocket/ChickenHop
- 数据【实测】：18★ · MIT · **2026-08-08**（活跃）· demo https://chickenhop.netlify.app （200）· `index.js` 74KB，three.js 本地文件，另有音效 mp3/wav、字体 ttf、splash 图。
- 【原文】README：“You could also play it on Mobile!”、“Please don't sue me”“Pay a visit to the original creator”——说明它是在别人作品上改的，**原作者与授权链不清**【推断】，参考手机手感即可，代码优先用 7.1。

### 7.3（不推荐）EvanBacon/Expo-Crossy-Road — https://github.com/EvanBacon/Expo-Crossy-Road
- 【实测】1153★ · MIT · 2026-03-26 · 仓库 25MB。完成度最高，但是 Expo/React Native + TypeScript 构建链，**塞不进单个 HTML**；只适合看美术和手感。

---

## 8. 射击 / 弹幕

### 8.1 dwmkerr/spaceinvaders — https://github.com/dwmkerr/spaceinvaders
- 数据【实测】：213★ · MIT · **2026-09-10** · demo https://dwmkerr.github.io/spaceinvaders/ （200）· `js/spaceinvaders.js` 24KB 单文件，另有 4 个 wav。
- 【原文】“No jQuery or any other third party libraries, just raw JavaScript … deliberately kept all one file”。
- 为什么好玩：经典“敌阵压下来、我左右移动开火”，节奏越来越快，男孩喜欢【推断】。
- **华文融入 — “听音打字阵”**：
  - 敌阵每个外星人举一个字（同音/形近字一大片，如 情 晴 清 请 青 睛）。TTS 读“晴天的晴”，**只有打中“晴”才爆**；打中错的字 → 它不死，反而脱队俯冲过来（威胁变大）。
  - P4 版“病句/错别字飞船”：敌阵排成 `typo.s` 一整句话，先打掉错字飞船，它碎掉后掉下 `typo.opts` 的几个字胶囊，飞船去接正确字填回句子。
- 触摸【实测 index.html/源码】：已支持“滑动移动、点按开火”（`touchstart/touchmove/touchend`）。
- 改编可行性：结构清晰（状态机 + 实体数组），四个 wav 换成引擎合成音 `g.sfx`。**难度低**。

### 8.2 jackrugile/radius-raid-js13k — https://github.com/jackrugile/radius-raid-js13k
- 数据【实测】：273★ · MIT · 2024-04-23 · 入口 https://js13kgames.com/entries/radius-raid （200）· 全部 JS 约 105KB（未压缩），发布包只有 13,278 字节；**零图片，音效用 jsfxr 合成**。
- 【原文】“13 enemy types, 5 powerups, parallax backgrounds, retro sound effects”；控制是 WASD 移动 + 鼠标瞄准（**没有触摸**【实测】）。
- 为什么好玩：满屏敌人 + 升级道具 + 爆炸粒子，典型的“男孩停不下来”型【推断】。
- **华文融入 — “量词枪”**：
  - 敌人是名词（书、鱼、河、纸……），你的枪有 4 种子弹：**本 / 条 / 只 / 张**（数字键 1–4 或屏幕按钮切换）。子弹量词对上名词（“一**本**书”）→ 敌人爆掉并读出“一本书”；对不上 → 子弹被弹开，敌人加速。
  - 同一框架可换成：近义词枪（`quiz` 近义词）、关联词枪（“因为…所以”，敌人头上是前半句）。
  - 需要**新增一份小数据表**（量词↔名词，约 60 对），现有 `quiz` 量词类只有 11 题【实测 content 统计】。
- 改编可行性：代码较大但模块清楚（hero/enemy/bullet/powerup 分文件）；要补触摸（虚拟摇杆），P2 不适合（瞄准+移动双操作偏难）【推断】。**难度中**。

### 8.3 rembound/Bubble-Shooter-HTML5 — https://github.com/rembound/Bubble-Shooter-HTML5
- 数据【实测】：59★ · 仓库 LICENSE = **MIT**，但 `bubble-shooter-example.js` 文件头写 **GPL-3.0**（冲突）· 2023-10-17 · JS 35KB + `bubble-sprites.png` 20KB；配套教程文章 http://rembound.com/articles/bubble-shooter-game-tutorial-with-html5-and-javascript 。
- 为什么好玩：泡泡龙（瞄准-反弹-三消），节奏慢、不会秒死，**特别适合 8 岁女孩**【推断】。
- **华文融入 — “同部首三消”**：泡泡上是字，发射台上的泡泡也是字；**射出去的字和相连的同部首字凑满 3 个就一起爆**（河、湖、清 → 都是氵）。连锁掉落时读出一串字。进阶规则：同韵母（ang 家族）、同声调。
- 改编可行性：因许可冲突，**按 GPL-3.0 看待**，或只照教程文章的思路重写（网格六边形坐标 + 洪水填充找相连）；重写量约 300 行【推断】。

### 8.4（P4 键盘向）knadh/wordpluck — https://github.com/knadh/wordpluck
- 【实测】53★ · MIT · 2023-05-23 · `js/main.js` 12KB + 老版 CreateJS。【原文】“A browser based typing game”。README 写的 demo https://wordpluck.netlify.com 同日 **404**【实测】。
- 华文融入：词语从天上掉，**键盘打出拼音（不带调）就把它摘下来**——给 P4 男孩练拼音输入（和考试形式是否挂钩没有核实）。P2 不适合（打字慢）【推断】。

### 8.5（参考）victorqribeiro/invaderz — https://github.com/victorqribeiro/invaderz
- 【实测】711★ · MIT · demo https://victorribeiro.com/invaderz （200）。【原文】“Space invaders, but the invaders evolve with genetic algorithm”——敌人会“学”你的打法，可借来做 Boss 关。

---

## 9. 塔防 / 植物大战僵尸

### 9.1 oldj/html5-tower-defense — https://github.com/oldj/html5-tower-defense
- 数据【实测】：386★ · MIT · 2019-03-15 · 在线 https://oldj.net/static/html5-tower-defense/td.html （200）· 发布包 `build/td-pkg-zh-min.js` 51KB，源码分文件（塔配置、怪配置、关卡、事件、语言包）。
- 【原文】README（中文作者）：“完全使用 HTML5 / JavaScript / CSS 实现”“这一个版本没有用到图片，游戏中的所有物品都是使用 HTML5 画出来的”；内置作弊命令方便测试；**自带中/英语言包**（`td-lang.js`）。塔种类【实测 td-cfg-buildings.js】：墙、炮、激光枪等，带升级规则。
- 为什么好玩：布阵 + 升级 + 看怪被消灭，策略感强，适合 10 岁男孩【推断】。
- **华文融入 — “字塔认音”**：
  - 怪物头顶举拼音（`chars.py`）沿路走；你放的塔**本身是一个汉字**（从本关字库里选）。**塔只会攻击读音和自己对得上的怪**（塔“晴”只打 qíng 怪），所以放哪个字、放在哪条路边就是识字决策。
  - 升级 = 给塔“组词”：塔“火”升级要选对一个组词（火车），升级后射程变大。
  - 金钱来源 = 打掉怪的数量，错放的塔就是浪费钱（自然惩罚）。
- 改编可行性：零图片 + 已有中文界面，是**最容易出“成品感”的塔防**；主要改“塔的索敌条件”（加一行读音匹配）和塔的绘制（画字）。**难度中**。

### 9.2 tddyco/canvas-td — https://github.com/tddyco/canvas-td
- 【实测】41★ · MIT · 2019-02-10 · 在线 https://canvas-td.teddy.io （200）· 全仓 74KB，塔/地图用极小 PNG。一个更短小的纯 Canvas 塔防基底，四种塔（激光、导弹、迫击炮、电击），可作 9.1 的替代。

### 9.3 植物大战僵尸式“车道防守”——GitHub 上**没有找到可直接用的合格 JS 仓库**【实测】
- `evilgaoshu/PvZ` https://github.com/evilgaoshu/PvZ —【实测】2★ · Apache-2.0 · Phaser 3 + Vite + TS，仓库 14MB；【原文】README 自述“集成了官方高清 BGM 和 15+ 种经典音效”→ **素材有版权风险，不用**，只看它的数据驱动关卡（YAML）思路。
- `G43riko/PlantsVsZombies` https://github.com/G43riko/PlantsVsZombies —【实测】8★ · MIT · 2014；代码只有 `plants.js` 5.5KB，但 `images/` 里是 PvZ 原作 HD 美术 → 只能参考 5KB 逻辑。
- **建议**：用 9.1 的代码或 LittleJS 自建一个 5 路车道防守（它的规则比迷宫塔防简单）：
  - **“反义词防线”**：僵尸举着“大/快/高兴”，从右往左走；左边手里有一排“字卡种子”，在它那条路上种**反义词**（小/慢/难过）才能挡住并打退它；种近义词会被它吃掉。“阳光”= 连续答对的奖励。数据：`quiz` 反义词 12 题 + 近义词 20 题【实测】，不够时需补一张反/近义词表。
  - P2 版：“认字防线”——僵尸举字，种同一个字的植物就能挡（纯识字匹配）。

---

## 10. Geometry Dash 类节奏跑酷

### 10.1 ishaanSh06/PolyDash — https://github.com/ishaanSh06/PolyDash
- 数据【实测】：6★ · BSD-3-Clause · 2024-11-03 · demo https://ishaanSh06.github.io/PolyDash/ （200）· `impossible-game.js` 80KB，Canvas 画霓虹几何体。
- 问题【实测 index.html】：背景图和背景音乐都从 **Dropbox 外链**加载（`www.dropbox.com/s/…?raw=1`）→ 单页不能 fetch，必须换成 Canvas 画背景 + 我们的五声音阶合成音乐；只有键盘控制。GitHub 上 GD 类的 JS 仓库都很小（`gh search repos "geometry dash clone"` 最高才 6★）【实测】，所以这一类**更现实的做法是在 3.1 的跑酷循环上加“固定拍速 + 关卡由数据生成”**。
- 为什么好玩：音乐踩点跳、死了秒重来、进度百分比，男孩会一遍遍刷【推断】。
- **华文融入 — “声调地形”**（最“长在机制里”的一个）：
  - 关卡由一句朗读句/绕口令（`readaloud` / `twisters.py`）生成：**每个音节是一格地形，一声 = 平台，二声 = 上坡，三声 = 先下后上的坑，四声 = 下坡**。TTS 按拍子念出这句话，小方块自动往前冲，孩子要在“三声坑”前起跳、在上坡时按住加速——**听到的声调曲线就是脚下的地形**。
  - 读得熟的孩子会预判地形（因为知道下一个字几声），读不熟就会摔——正好把“声调”练进身体节奏里。
  - 与已有的 beat（绕口令节拍：点鼓面判定）不同：beat 练“字的节奏”，这里练“字的声调”。
- 改编可行性：地形生成器 + 跳跃判定是新写的（约 300 行）；音乐用引擎现成的合成。**难度中–高**。

---

## 11. 弹弓物理（Angry Birds）

### 11.1 liabru/matter-js · examples/slingshot.js — https://github.com/liabru/matter-js/blob/master/examples/slingshot.js
- 数据【实测】：18418★ · MIT · 2024-08-17 · 在线 https://brm.io/matter-js/demo/#slingshot （200）· 示例本身约 100 行；matter.min.js 0.20.0 在 cdnjs（83KB，200）。
- 【实测 源码】弹弓就是一个 `Constraint`（弹性约束）连着石头，拖动由 `MouseConstraint` 负责，松手后超过锚点就换新石头；两座 `Composites.pyramid` 积木塔。
- 为什么好玩：拉弓 → 飞 → 积木塔轰然倒塌，物理破坏的快感，10 岁男孩最爱；8 岁女孩也喜欢“推倒”【推断】。
- **华文融入 — “打飞缺的那个词”**：
  - 屏幕上方挂一句挖空的例句（`words.s` 把 `w` 挖掉：“时间很宝贵，我们要___每一分钟”）。右边积木塔上**每块积木写一个词**（珍惜 + 干扰词 珍贵/爱惜/可惜）。**把写着正确词的积木打出屏幕/打落地面**才算过关，积木落地时整句读一遍；把错的词打下来 = 那块积木弹回句子里显示红叉、扣一只“鸟”。
  - 进阶：成语/歇后语/俗语补全（`quiz` 成语 30、歇后语 6、俗语 13 题【实测】）——积木上是下半句。
- 改编可行性：示例已经是完整手感，改动 = 积木上画字（在 `afterRender` 里按刚体位置和角度写字）+ 胜负判定 + 触摸（MouseConstraint 本身支持触摸事件，属【推断】，需真机测）。**难度低**，是本分支性价比最高的一个。
- 参考：`HunorMarton/gorillas` https://github.com/HunorMarton/gorillas （【实测】18★、**无 LICENSE**）是经典“猩猩扔香蕉”抛物线对战的教程代码，可借“两人轮流拉角度”的对战想法，不抄代码。

---

## 12. 贪吃蛇 / slither.io

### 12.1 bibhuticoder/snake.io — https://github.com/bibhuticoder/snake.io
- 数据【实测】：48★ · MIT · 2017-09-07 · demo https://bibhuticoder.github.io/snake.io （200）· JS 共约 22KB（Game/Snake/SnakeAI/Food/util）。
- 【原文】“made in JS entirely from scratch. All the graphics as seen on the demo are vector drawings”；3 层 canvas（蛇/食物/背景）；玩家跟随鼠标（**无触摸**【实测】，需把 mousemove 换成 pointermove）。有 AI 蛇（`snakeai.js`）。
- 为什么好玩：自由转向、越吃越长、和 AI 蛇抢地盘/绕圈围杀——比格子贪吃蛇刺激得多【推断】。
- **华文融入 — “只吃对的豆”**：地图上是发光的字豆。顶部规则每 30 秒换一次：“吃 **木** 字旁”“吃 **第二声**”“吃能和‘**花**’组词的字”。吃对 → 身体变长、那节身体上印着这个字（整条蛇就是你的“字串”）；吃错 → 身体掉一截、掉下的字豆被 AI 蛇抢走。AI 蛇也按规则吃，快的孩子能“抢在 AI 之前”。
  - 已有的 47_snake 是“按顺序吃词块排句子”的格子蛇；这个是自由移动 + 对手 + 规则识别，玩法不重叠。
- 改编可行性：代码小、纯矢量；主要工作 = 字豆绘制 + 触摸 + 规则 HUD。**难度中**。
- 参考：`knagaitsev/slither.io-clone` https://github.com/knagaitsev/slither.io-clone （【实测】265★、**无 LICENSE**，Phaser 2 教程）只看思路。

---

## 13. 打砖块（Breakout）

### 13.1 end3r/Gamedev-Canvas-workshop（MDN 2D Breakout 教程）— https://github.com/end3r/Gamedev-Canvas-workshop
- 数据【实测】：436★ · GitHub 显示 NOASSERTION；LICENSE 原文：文档 CC-BY-SA 2.5，**“Any copyright to code samples and snippets is dedicated to the Public Domain (CC0)”** · demo https://breakout.enclavegames.com （200）· 10 课，最终 `lesson10.html` 仅 5.3KB。
- 为什么好玩：反弹、砖块碎裂、道具掉落，简单又解压；P2/P4 都能玩【推断】。
- **华文融入 — “接字胶囊”**（因为球的落点很难精确控制，所以把判断放在“接不接”上）：
  - TTS 读听写词（`words.w`），砖块被打碎时掉出“字胶囊”（本词的字 + 干扰字）。**挡板只接能拼出本词的字**（按顺序）→ 字飞进田字格；**接到错字 → 挡板变短**；接到正确字 → 挡板变长/分裂出多球。于是孩子一边保球、一边挑字接，手眼 + 识字同时在线。
  - P4 版“瞄准砖块”（Ballz / Swipe Brick Breaker 式）：每回合拖动瞄准线一次射出一串球，砖块上是字、带血量；只有**同音字砖**打了才掉血、打错的砖反而 +1 血。GitHub 上 JS 版 Swipe Brick Breaker（`minseok128/2020-SwipeBrickBreaker-JS` 23★、`pyjun01/swipe-brick-breaker` 13★）**都没有 LICENSE**【实测】，只借玩法。
- 改编可行性：代码最短、CC0 最省心。**难度低**。

### 13.2 KilledByAPixel/LittleJS · examples/breakout — https://github.com/KilledByAPixel/LittleJS/tree/main/examples/breakout
- 【实测】MIT · `game.js` 5.5KB + `gameObjects.js` 4.9KB + 一张 6KB `tiles.png` · 在线 https://killedbyapixel.github.io/LittleJS/examples/breakout/ （200）。带粒子和 ZzFX 音效，比 MDN 版更“有游戏感”，触摸由引擎处理【原文 README】。

### 13.3 jakesgordon/javascript-breakout — https://github.com/jakesgordon/javascript-breakout
- 【实测】78★ · GitHub 显示 NOASSERTION，但 LICENSE 文件正文是 **MIT**（Copyright 2011–2016 Jake Gordon）· demo https://jakesgordon.com/games/breakout/ （200）· `breakout.js` 23KB + `levels.js` 7.5KB（关卡用字符串画砖阵），**有触摸**【实测】。关卡字符串格式可以直接用来**把砖阵排成一个大汉字的形状**（P2 女孩会喜欢“把‘春’字打碎”）。

---

## 14. 吃豆人（Pac-Man）

### 14.1 mumuy/pacman — https://github.com/mumuy/pacman
- 数据【实测】：1643★ · MIT · 2026-05-07 · demo https://passer-by.com/pacman/ （200）· `static/script/game.js` 16KB（作者自写的小型游戏引擎）+ `index.js` 43KB（地图、NPC、关卡），只有一个像素字体文件，**无图片**。
- 【原文】README：地图绘制、玩家控制、“NPC根据玩家坐标实时自动寻径”、能量豆、“多关卡(共12关)”；版权段写“本游戏由 passer-by.com 制作，请尊重作者，引用请注明来源”——MIT 下保留署名即可。
- 控制【实测】：只有键盘（`keyCode`），需补滑动。
- 为什么好玩：追与被追的紧张感、吃能量豆反杀的爽快，两个孩子都懂规则【推断】。
- **华文融入 — “能量豆写着拼音”**：
  - 4 只鬼身上各举一个字（同音/形近一组，如 清/情/晴/请）。迷宫四角的**能量豆上写一个拼音**（qīng）。吃下能量豆后，**只有举着读 qīng 的字的那只鬼变蓝可以吃**，其余三只照样能抓你——吃错鬼就等于撞鬼。
  - 豆子路线版（P2）：迷宫里的水果按顺序写着词语的字，按顺序吃到“西、瓜”才出现下一对。
- 改编可行性：寻路和地图都现成，改动集中在“鬼的可吃判定”和字的绘制。**难度中**。

### 14.2 platzhersh/pacman-canvas — https://github.com/platzhersh/pacman-canvas
- 【实测】352★ · CC0-1.0 · 2026-02-28 · 在线 http://pacman.platzh1rsch.ch （200）。【原文】README：作者正迁移到 TS/React 新仓库、本仓库“most probably not further update”；音效来自 soundfxcenter.com / soundfxnow.com —— **CC0 只覆盖代码，音效别搬**，用引擎合成音替代。

### 14.3（参考）daleharvey/pacman — https://github.com/daleharvey/pacman
- 【实测】731★ · WTFPL（几乎无限制）· 2023-10-11 · 421KB。经典 HTML5 实现，可作 14.1 的对照。

---

## 15. 许可与风险清单（全部【实测】）

| 仓库 | 标注许可 | 实际情况 | 建议 |
|------|---------|---------|------|
| ishaanSh06/BlockNinja | BSD-3 | 源码 `highScoreKey='__menja__highScore'`，是 Menja 拷贝 | 不用；改用 Menja（CodePen MIT） |
| MilllerTime/menja | GPL-3.0 | 同作者 CodePen 公开帖按 CodePen 规则为 MIT | 从 CodePen 取码或按 GPL 发布 |
| rembound/Bubble-Shooter-HTML5 | MIT（LICENSE） | JS 文件头 GPL-3.0 | 按 GPL 看待或照教程重写 |
| evilgaoshu/PvZ | Apache-2.0 | README 自述集成官方 BGM/音效 | 素材不用 |
| G43riko/PlantsVsZombies | MIT | images/ 为原作美术 | 只看 5KB 逻辑 |
| platzhersh/pacman-canvas | CC0 | 音效来自第三方音效站 | 音效不用 |
| layyback/zType | MIT | 结构与商业游戏 ZType 一致（推断） | 不用 |
| TheCodingRocket/ChickenHop | MIT | README 称改自他人作品、原作者未写明 | 只参考 |
| ishaanSh06/PolyDash | BSD-3 | 背景图/音乐是 Dropbox 外链 | 素材全换 |
| end3r/Gamedev-Canvas-workshop | NOASSERTION | LICENSE 写代码 CC0 | 可放心用 |
| jakesgordon/javascript-breakout | NOASSERTION | LICENSE 正文 MIT | 可用 |
| ChineseDron/fruit-ninja、kubowania/Doodle-Jump、straker/endless-runner-html5-game、knagaitsev/slither.io-clone、HunorMarton/gorillas、minseok128 / pyjun01 swipe-brick-breaker、Dprogers10/HanziCommander | 无 LICENSE | 默认保留所有权利 | 只看思路 |

Demo 下线【实测】：`crossy-road.glitch.me` 410、`wordpluck.netlify.com` 404；`codepen.io/MillerTime/pen/BexBbE` 403（疑反爬）。

---

## 16. 推荐落地顺序（本分支意见，【推断】）

1. **弹弓打词**（matter-js slingshot，约 100 行起步，MIT，cdnjs 有 matter.js）——性价比最高，P4 男孩立刻能玩。
2. **Flappy 缺口选字**（omariosouto / floppybird）——物理几十行，全年级题库都能套，两个孩子都能玩（P2 用 easy 参数）。
3. **Doodle Jump 踩对的字**（takosenpai2687，易碎踏板现成）——P2 女孩主力。
4. **切字（按结构下刀）**（Menja CodePen 版）——iPad 手势最自然，把“字的结构”练成手上动作。
5. **吃豆人能量豆拼音**（mumuy/pacman，寻路现成、零图片）或 **塔防字塔认音**（oldj，零图片、自带中文界面）——给 P4 男孩做“长线策略”型。
之后再做：过马路组词（three.js）、声调车道跑酷、声调地形 GD、slither 规则吃豆、泡泡龙同部首三消、量词枪。

---

## 17. 方法与原始数据

- 搜索【实测】：`gh search repos … --sort stars`，关键词共约 60 组，包括 flappy bird / endless runner / subway surfers / temple run / doodle jump / platformer / mario / fruit ninja / menja / crossy road / space invaders / galaga / space shooter / shoot em up / bullet hell / bubble shooter / typing game / ztype / geometry dash / impossible game / rhythm game / angry birds / slingshot / tower defense / plants vs zombies / snake game / slither.io / agar.io / breakout / arkanoid / brick breaker / swipe brick breaker / pacman / phaser game / js13k / kids game / chinese learning game / hanzi game / vocabulary game，多数加 `--language=JavaScript` 或 `TypeScript`；另读了 `proyecto26/awesome-jsgames`（974★，CC0）的 README 找线索。
- 每个入选仓库：`gh api repos/OWNER/REPO`（星数/许可/push/主页/体积）、`gh api repos/OWNER/REPO/git/trees/HEAD?recursive=1`（文件结构与大小）、`gh api …/readme`、`gh api …/license`，对主 JS 文件 grep 触摸/键盘/外链。
- CDN 可用性：`api.cdnjs.com/libraries/<lib>`、`data.jsdelivr.com/v1/package/npm/<pkg>`，再对具体 URL `curl` 看状态码。
- 学习科学来源：Habgood, M. P. J., & Ainsworth, S. E. (2011). *Motivating children to learn effectively: Exploring the value of intrinsic integration in educational games.* Journal of the Learning Sciences, 20(2), 169–206. https://eric.ed.gov/?id=EJ922627 · https://www.tandfonline.com/doi/abs/10.1080/10508406.2010.508029
- CodePen 许可：https://blog.codepen.io/documentation/licensing/ ；Menja 作者页：https://menja.cmiller.tech/
