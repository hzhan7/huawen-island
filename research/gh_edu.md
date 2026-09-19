# GitHub 调研 · 教育 / 语言 / 中文类（gh_edu）

- 调研日期：2026-09-18
- 分支：教育 / 语言 / 中文类（汉字、拼音、中文学习游戏；英文拼写与单词游戏；儿童教育游戏合集；打字游戏；闪卡与间隔重复的游戏化）
- 证据标记
  - **【实测】**：本次用 `gh api repos/OWNER/REPO` 拉到的星数、许可、最近 push 日期；或者用 `curl` 实测 demo 返回 HTTP 200。星数和日期都是 2026-09-18 的快照。
  - **【原文】**：仓库 README 或源码里的原话，这里是转述。
  - **【推断】**：我根据原文做出的设计推断和工作量估计，没有实测。
- 检索方法：`gh search repos` 按 stars 排序，跑了约 80 组中英日关键词（hanzi / pinyin / 汉字 游戏 / 识字 / 成语 / 飞花令 / chinese wordle / spelling bee / typing game / ztype / word tetris / kana game / kanji game / gcompris / phonics …），另跑了 topic 检索（`--topic=educational-game / typing-game / kids-game / word-game / chinese-characters / hanzi / pinyin / spaced-repetition / flashcards / typing-tutor / educational-games`）。入选的候选再用 `gh api` 读元数据和 README，关键项目还读了源码树和核心文件。Search API 限速 30 次/分钟，脚本会自动退避。

---

## 0. 一句话结论

**【实测】GitHub 上面向儿童的中文识字游戏几乎都是 0–20★ 的个人作品或课设。** 星数高的中文项目集中在两类：
- 工具库：hanzi-writer 4978★、pinyin-pro 4717★、cnchar 3095★
- 面向成人的猜词游戏：汉兜 handle 1439★

所以想找“会动、好玩”的机制，要去英文、日文和儿童教育合集里借，再用中文工具库和我们自己的题库落地。借的方式是**让华文知识变成操作本身**：
- 知识当“方向盘”：拼音决定飞到哪一列
- 知识当“子弹”：打对一个声母就发一颗炮弹
- 知识当“合成配方”：氵和青合成清

最值得做的 12 个新玩法如下。它们与已有的 11 个街机玩法基本不重复，排序综合了好玩程度、可行性和不重复度：

| # | 新玩法（暂名） | 主要借鉴仓库 | 用哪个题库 | 最适合 |
|---|---|---|---|---|
| 1 | 拼音星际战机（打字射击） | theajack/type、Horsetoast/TypingNinja、RealKai42/qwerty-learner | words、chars | P4 男孩（键盘） |
| 2 | 抢字卡·兄妹对战（同屏） | pinkrec6/kanjiGame | words、pick、chars | 两人一起 |
| 3 | 落字归位（操控下落的字进对的格） | osteele/kana-game | chars、pick、typo | 都适合（分档） |
| 4 | 蜂巢组字 / 组词 | ConorSheehan1/spelling-bee | build、chars.组词 | 都适合 |
| 5 | 汉兜小侦探（拼音 Wordle） | antfu/handle、AllanChain/chinese-wordle | words | P4 男孩 |
| 6 | 部件俄罗斯方块 | AbhishekCode/word-tetris | build | P4 男孩 |
| 7 | 词语消消乐（带重力和连锁） | lapsea/hanzi-match-game | words、chars.组词 | 都适合 |
| 8 | 一笔变字魔法 | kkjusdoit/hanzi-stroke-games | chars、HanziWriter 笔画数据 | P4 男孩 |
| 9 | 跨游戏冰淇淋塔收集 + FSRS 出题调度 | sheleoni/icecream-kana-game、open-spaced-repetition/ts-fsrs | 全部 | P2 女孩（收集） |
| 10 | 捣蛋狗干扰 + 三星评分（通用机制层） | vgwb/Antura | 全部 | 都适合 |
| 11 | 飞花令·词语炸弹接力 | xinyzhang9/flyflower | words、chars.组词 | 两人一起 |
| 12 | 同屏你画我猜 | jrainlau/draw-something | words、talk | P2 女孩画、P4 猜（或反过来） |

另有两个“基础设施”级仓库（不是游戏，但决定能不能离线做）：
- theajack/cnchar：部首、组词、成语、笔画数据，都在 jsdelivr 上
- dhjz/hanzi-study：示范了怎样把 HanziWriter 笔画数据内嵌成 JS 文件，避免运行时 fetch

---

## 1. 入选仓库总表

星数、许可、最近 push 均为【实测】`gh api`。“demo”一列只要写了 200，就是 curl 实测返回过 HTTP 200，但只说明页面能打开，不说明能玩。

| 仓库 | ★ | 许可 | 最近 push | demo | 类型 | 代码能否直接拿 |
|---|---|---|---|---|---|---|
| https://github.com/antfu/handle | 1439 | MIT | 2025-02-12 | https://handle.antfu.me （200） | 汉字 Wordle | 能（注明出处） |
| https://github.com/AllanChain/chinese-wordle | 21 | BSD-3-Clause | 2023-05-03 | https://allanchain.github.io/chinese-wordle/ （200） | 声母韵母 Wordle | 能（保留版权声明） |
| https://github.com/theajack/type | 99 | MIT | 2023-05-28 | https://theajack.github.io/type/ （200） | 拼音打字射击 | 能 |
| https://github.com/Horsetoast/TypingNinja | 10 | MIT | 2022-12-07 | https://horsetoast.github.io/TypingNinja/ （200） | 下落汉字、打拼音加声调 | 能 |
| https://github.com/RealKai42/qwerty-learner | 23168 | GPL-3.0 | 2026-09-08 | https://qwerty.kaiyi.cool/ （200） | 听音打字背单词 | **只学机制**（GPL） |
| https://github.com/osteele/kana-game | 2 | 无许可文件 | 2026-08-09 | https://kana-game.underconstruction.fun （200） | 操控下落字符归位 | **只学机制** |
| https://github.com/AbhishekCode/word-tetris | 34 | Apache-2.0 | 2018-08-01 | https://abhishekcode.github.io/word-tetris/ （200） | 字母俄罗斯方块 | 能 |
| https://github.com/ConorSheehan1/spelling-bee | 86 | MIT | 2026-05-12 | https://spelling-bee-free.pages.dev （200） | 蜂巢拼词 | 能 |
| https://github.com/pinkrec6/kanjiGame | 0 | 无许可文件 | 2026-07-07 | 无 | 汉字歌留多（かるた）＋双人对战＋熟语棋盘 | **只学机制** |
| https://github.com/lapsea/hanzi-match-game | 16 | 无许可文件 | 2026-08-20 | https://hanzi-match.pages.dev/ （200） | 汉字词语对对碰 | **只学机制** |
| https://github.com/kkjusdoit/hanzi-stroke-games | 1 | 无许可文件 | 2026-07-21 | 无 | 加一笔、减一笔、换一笔成字 | **只学机制** |
| https://github.com/vgwb/Antura | 123 | BSD-2（README 原文；API 显示 NOASSERTION）；美术素材 CC-BY-4.0 | 2026-09-15 | https://antura.org （200） | 儿童识字小游戏合集（Unity） | 机制可学；素材可用但须署名 |
| https://github.com/gcompris/GCompris-qt | 262 | AGPL-3.0（README 原文；API 未识别） | 2026-09-18 | https://gcompris.net （200） | 2–10 岁教育活动合集（Qt/QML） | **只学机制**（AGPL） |
| https://github.com/sheleoni/icecream-kana-game | 1 | 无许可文件 | 2023-12-29 | https://icecream.sheleoni.com/ （200） | 连对积水→解锁冰淇淋球 | **只学机制** |
| https://github.com/open-spaced-repetition/ts-fsrs | 792 | MIT | 2026-09-18 | https://open-spaced-repetition.github.io/ts-fsrs/ （200） | FSRS 间隔重复算法 | 能（jsdelivr 有 UMD） |
| https://github.com/xinyzhang9/flyflower | 12 | GPL-3.0 | 2017-03-17 | https://xinyzhang9.github.io/flyflower/ （200） | 飞花令 | **只学机制**（GPL） |
| https://github.com/jrainlau/draw-something | 269 | MIT | 2017-02-09 | 无（需要 node WebSocket 服务） | 你画我猜 | 能（但架构要改成同屏） |
| https://github.com/theajack/cnchar | 3095 | MIT | 2026-08-02 | https://theajack.github.io/cnchar （200） | 汉字数据/工具库（非游戏） | 能（jsdelivr） |
| https://github.com/dhjz/hanzi-study | 225 | MIT | 2026-09-10 | https://dhjz.github.io/hanzi-study/ （200） | 幼儿识字闯关（偏题卡） | 能（离线数据方案可抄） |

许可提醒：
- **无许可文件等于默认保留全部版权**，只能学玩法，不能拷代码。
- GPL 和 AGPL 的代码一旦拷进来，整个站就得按同一协议开源。站点不打算这样做，所以同样只学机制。
- 玩法规则本身不受著作权保护，这是一般常识，不构成法律意见。

---

## 2. 分类型详述

每个仓库都按同一个结构写：基本数据、原玩法、为什么孩子会喜欢、华文知识怎么融进机制、适合谁、改编可行性。

### A. 猜词推理类（Wordle 变体）

#### A1. antfu/handle 汉兜 —— https://github.com/antfu/handle
- **基本数据【实测】**：1439★、MIT、最近 push 2025-02-12，demo 可访问。技术栈是 Vue 3 + Vite + UnoCSS，依赖里有 `pinyin`、`seedrandom`、`canvas-confetti`。
- **原玩法【原文】**：猜一个四字成语。每猜一次，每个字的字形、声母、韵母、声调分别上色，提示对不对、在不在。成语库在 `src/data/idioms.txt`，多音成语在 `polyphones.json`。README 写明 MIT 开放，注明原仓库和作者后欢迎 fork。
- **为什么好玩【推断】**：这是推理加“差一点就猜中”的快感。每天一题、有连胜记录、还能截图晒成绩，特别适合**爱较劲的 10 岁男孩**。原版的四字成语对 P4 太难，必须降级。
- **华文知识融进机制【推断】**：
  - **P4 版“词语侦探”**：答案取自 `words` 听写词（两到三字）。孩子每输入一个合法词语，每个字下面的拼音拆成**声母 / 韵母 / 声调**三块，分别上色：绿色表示位置对，黄色表示词里有但位置不对，灰色表示没有。想赢就得主动拆拼音，这正是听写要练的能力。
  - 猜中后朗读该词和 `words.例句`，并用 HanziWriter 播放一次笔顺。
  - **P2 版“单字侦探”**：只猜一个字，提示给图片或 emoji 加上声调色块，候选字从 `chars` 取 6 个，点选不用打字。
  - 兄妹玩法：生成“挑战链接”（原版就有分享链接），哥哥出题、妹妹来猜。
- **适合**：P4 男孩为主，P2 女孩玩简化版。
- **改编可行性【推断】**：
  - 核心判定在 `src/logic/utils.ts`（4.8KB），包括 `parseChar`、`parseWord` 和 `testAnswer`，大约 50 行，可以直接移植成原生 JS。
  - 拼音拆分已经在题库里（words 带拼音），不需要外部库；要自动拆字也可以用 jsdelivr 上的 pinyin-pro。
  - 没有图片素材，纯 DOM 或 Canvas 就能做。估计 250–350 行。
- **注意**：gh_puzzle.md 也收了这个仓库，本文只从“语言知识融进机制”这个角度写。

#### A2. AllanChain/chinese-wordle 拼成语 —— https://github.com/AllanChain/chinese-wordle
- **基本数据【实测】**：21★、BSD-3-Clause、最近 push 2023-05-03，Vue 实现，demo 可访问。
- **原玩法【原文】**：根据声母和韵母猜成语。颜色规则和 Wordle 一样，韵母组合猜对会加绿色双下划线，另有“声母韵母都被猜到过就提示声调”之类的渐进提示，并分难度档。
- **可借鉴的点【推断】**：它比汉兜多了一个**渐进提示条**。小孩猜不出来就容易放弃，这种提示正好能兜底。难度档就是控制“提示给多少、多早给”，可以直接对应 P2 / P4 两档。它还说明 zhi、ji 里的 i 按同一个韵母处理，这类拼音规则的边界情况值得参考。
- **适合**：P4 男孩。
- **改编可行性**：机制与 A1 合并做成一个游戏，把“提示条”当作难度开关。BSD-3 许可允许拷代码，但要保留版权声明。

### B. 打字射击 / 下落打字类（ZType 类）

#### B1. theajack/type 汉字打字游戏 —— https://github.com/theajack/type
- **基本数据【实测】**：99★、MIT、最近 push 2023-05-28，demo 可访问。作者就是 cnchar 的作者，游戏基于 cnchar 和 cnchar-poly。源码很小：`src/object/enemy.js` 14.5KB、`player.js` 5KB、`bullet.js` 3.6KB、`game.js` 5KB。
- **原玩法【原文 / 源码】**：
  - 汉字词语作为敌人从上方飞向玩家的飞船。
  - 敌人的血量等于这个词的拼音字母数：`this.hp = this.pinyin.length`。
  - 每打对一个字母，飞船就向它发射一颗子弹，已经打出的拼音显示在敌人下方。
  - 玩家有 3 次“清屏护盾”（`protect = 3`），敌人会越来越快。
  - 手机上会自动显示屏幕键盘（`J.isMobile()` 时显示 `#keyboard`）。
- **为什么好玩【推断】**：每按一个键就有一声“砰”和一颗飞出去的子弹，反馈极快；敌人压过来的紧张感，加上一次性清屏的爽感，**10 岁男孩几乎一定喜欢**。和已有的“气球射击”（点击式）不一样，这里的武器就是拼音本身。
- **华文知识融进机制【推断】**：
  - 敌舰上写 `words` 的听写词，**只显示汉字、不显示拼音**，逼孩子自己回忆拼音。打错键时飞船抖一下、子弹打空，同时在敌舰上短暂闪出正确的下一个字母作为提示。
  - **声调必须打**：拼音打完后敌舰还剩一层“声调护盾”，要按 1–4（或屏幕上的 ˉ ˊ ˇ ˋ 四个按钮）才能击毁。这把原版忽略声调的缺陷，改成了专练声调的一道关。TypingNinja 本来就要求输入 `ai4` 这种带数字的拼音，见 B2。
  - Boss 关：Boss 身上是 `words.例句` 里的整句话，逐个词击破。
  - P2 版“声调炮台”：敌舰只写一个单字（`chars`），底部只有四个声调按钮加一个“轻声”按钮，按对就发射。完全不需要键盘，iPad 上也好玩。
- **适合**：P4 男孩（电脑键盘最佳）；声调炮台版适合 P2 女孩。
- **改编可行性【推断】**：
  - 原代码依赖 jetterjs 和 webpack，建议用 Canvas 重写。逻辑简单（敌人列表、子弹列表、当前锁定目标），估计 400 行左右。
  - 拼音直接用题库自带的，不需要 cnchar。
  - 音效可以用 WebAudio 合成。

#### B2. Horsetoast/TypingNinja —— https://github.com/Horsetoast/TypingNinja
- **基本数据【实测】**：10★、MIT、最近 push 2022-12-07，demo 可访问。依赖 pixi.js ^4.6.2、animejs、lodash。
- **原玩法【原文 / 源码】**：汉字词语从屏幕上方落下，词库是 `app/wordsList.js`，按 HSK 等级分级，每条形如 `{tr:'愛', si:'爱', pin:['ai4']}`。玩家输入带声调数字的拼音让它爆炸，有爆炸序列帧；词落到底就扣命。默认显示繁体，TODO 里写着“支持简体”。
- **可借鉴的点【推断】**：
  1. **拼音加声调数字**这套输入协议已经验证可行，可以直接套用。
  2. 爆炸序列帧和 anime.js 缓动带来的“打击感”。
  3. `lifespan` 加分级词库的难度曲线。
- **适合**：P4 男孩。
- **改编可行性**：与 B1 合并成一个游戏。B1 的机制更完整（子弹、护盾、屏幕键盘），B2 贡献声调协议和打击感。爆炸效果可以用 Canvas 粒子重画，不用拿它的精灵图。

#### B3. RealKai42/qwerty-learner —— https://github.com/RealKai42/qwerty-learner
- **基本数据【实测】**：23168★、**GPL-3.0**、最近 push 2026-09-08，demo 可访问。
- **原玩法【原文】**：把背单词和键盘肌肉记忆结合起来，边显示音标边发音。**只要打错，整个单词就得重打**，这是为了避免形成错误的肌肉记忆。一章练完后会问要不要进入**默写模式**，并实时显示速度和正确率。
- **可借鉴的点【推断】**：它不算街机游戏，但有两条规则值得并进 B1：
  1. 听写模式：只朗读、不显示汉字，孩子打出拼音来击落一艘“隐形敌舰”（它只显示一个问号，被打中一个字母就显形一部分）。
  2. 一章结束后的默写关：把本关打过的词再过一遍，敌舰隐形、速度降低。
- **适合**：P4 男孩。
- **改编可行性**：GPL，**只学规则，不拷代码**。

### C. 操控下落物 / 方块类

#### C1. osteele/kana-game “Fall for Kana” —— https://github.com/osteele/kana-game
- **基本数据【实测】**：2★、**无许可文件**、最近 push 2026-08-09，demo 可访问，TypeScript 加 Bun。
- **原玩法【原文】**：
  - 假名从上方落下，底部有若干列，每列标一个罗马音。玩家用左右键（手机上点列）**引导这个假名落进正确的列**，再点一次同一列就直接落地。
  - 干扰项是**长得像的字**。
  - 有自适应练习：优先出没见过和经常错的字。有“混淆实验室”（Confusion Lab）专门追踪容易混的字对，错了的字会延迟重考。
  - 有 Learn、Flow、Sprint、Review、Confusion Lab、Type 六种模式，每轮 10 题，结束时总结正确率、反应时间、连对和掌握度。
- **为什么好玩【推断】**：是俄罗斯方块那种“操控下落物”的手感，比点选题多了一层空间操作和时间压力，但压力可调（下落速度）。**8 岁女孩也能玩**，因为只要点一下列就行。
- **华文知识融进机制【推断】**，和已有的“接字篮”的区别是：接字篮是移动篮子去接，这里是**操控字本身往哪一格落**，而且每一格都是一个易混的知识点。
  - **P2 档“声调四车道”**：落下的是 `chars` 里的一个字，底部 4 列是 ˉ ˊ ˇ ˋ。落对了，字化作星星进格；落错了，字碎掉，并朗读正确读音。
  - **P4 档“同音字归家”**：底部 3–4 列写的是同音或近音字的**部首**（例如“氵 / 忄 / 日 / 讠”）。落下的是一个词语，其中一个字被挖空，比如“心_”、“_天”、“_问”。孩子要判断空里该用哪个偏旁的“青”字（清 / 情 / 晴 / 请）。题目可以从 `typo` 错别字句和 `build` 数据里生成。
  - **混淆实验室**：自动记录孩子最常混的字对（己 / 已、买 / 卖、拨 /拔……），下一局优先出这些。
- **适合**：两个孩子都适合，按档位区分。
- **改编可行性【推断】**：机制简单，一个下落物、N 列、左右移动、判定，估计 300–350 行 Canvas。**不能拷代码（无许可）**，自己写。混淆对数据需要人工整理一份，大约 50 对，或者从 `typo` 栏目里提取。

#### C2. AbhishekCode/word-tetris —— https://github.com/AbhishekCode/word-tetris
- **基本数据【实测】**：34★、Apache-2.0、最近 push 2018-08-01，demo 可访问，React 16 PWA。核心文件是 `src/containers/Game.js`（15.8KB），另有 `config/GenerateLetter.js` 和 `wordCheck.js`。
- **原玩法【原文】**：像俄罗斯方块，但落下的是字母块。玩家把字母排成英文单词，凑出合法单词后点击字母就能得分并消除。
- **华文知识融进机制【推断】“部件方块”**：
  - 落下的是**部件块**，比如 氵、木、青、每、亻、主。玩家左右移动决定落在哪一列。
  - 当横向相邻的两块能合成 `build` 题库里的一个字（氵 + 青 = 清，木 + 每 = 梅），这两块就发光。点一下即合成：两块合并成一个大“清”字，朗读“qīng，清水的清”，然后消掉并得分。
  - 连续合成触发连击；堆到顶就游戏结束。
  - 进阶：上下相邻也能合成，对应上下结构，例如 艹 + 化 = 花。这样 `chars.结构` 字段（左右 / 上下）就直接变成了**方向规则**。
- **为什么好玩【推断】**：俄罗斯方块的“堆高压力”加上“找配方”的发现感。已有的“钓鱼组偏旁”是一次一题；这里是满屏部件自由组合，同一个“青”配不同偏旁会得到不同的字，孩子能**自己发现同一族的字**。
- **适合**：P4 男孩。P2 可以玩慢速版，并且只放 2–3 种部件。
- **改编可行性【推断】**：
  - Apache-2.0，可以参考代码；但它是 React 加 DOM 实现，建议 Canvas 重写，估计 350–450 行。
  - 部件拆分数据要确认：`build` 栏目已有“偏旁 + 部件 = 字”的数据就够用。不够的话，可以在构建期用 howl-anderson/hanzi_chaizi（https://github.com/howl-anderson/hanzi_chaizi ，【实测】429★、Apache-2.0）离线生成一份拆字表再内嵌。

### D. 蜂巢拼字 / 字卡对战类

#### D1. ConorSheehan1/spelling-bee —— https://github.com/ConorSheehan1/spelling-bee
- **基本数据【实测】**：86★、MIT、最近 push 2026-05-12，demo 可访问，Vue 3、Element Plus、Pinia。蜂巢组件在 `src/components/Hive.vue`（6KB），状态在 `src/store.ts`（8.6KB）。
- **原玩法【原文】**：纽约时报 Spelling Bee 的开源版。7 个字母排成六边形蜂巢，中心字母必须用上，每天一题，用蜂巢里的字母拼出尽量多的单词；有进度等级和烟花动画，还能查看昨日答案。
- **为什么好玩【推断】**：没有时间压力，是“开放寻宝”，能找多少算多少。进度条会从“新手”一路升到“天才”。**P2 女孩喜欢可爱的蜜蜂和蜂蜜主题，P4 男孩喜欢冲等级。**
- **华文知识融进机制【推断】**，两个版本：
  - **“蜂巢组字”**（`build`、`chars.部首`）：中心格放一个偏旁，比如“氵”，外圈 6 格放部件（青、工、每、少、先、可）。孩子点中心加一个外圈部件，能合成真字（清、江、海、沙、洗、河）就飞出一只小蜜蜂把字搬进蜂蜜罐并朗读。凑不出真字就嗡的一声弹回。“全部用上”对应原版的 pangram 大奖。
  - **“蜂巢组词”**（`chars.组词`、`words`）：中心格放一个字，比如“花”，外圈放 6 个字（开、朵、园、红、种、雪）。孩子点字拼成含“花”的二字词：开花、花朵、花园、红花、种花、雪花。
  - 等级名换成蜂巢主题，例如“小工蜂 → 采蜜蜂 → 蜂后”。每天一个新蜂巢，兄妹共用同一个蜂巢比谁找得多。
- **适合**：都适合。P2 用组词版，外圈字带拼音；P4 用组字版加限时挑战。
- **改编可行性【推断】**：
  - 蜂巢布局是 7 个六边形的坐标，判定就是查表。估计 250 行。MIT 许可允许参考 `Hive.vue` 的布局。
  - 合法组合表**必须限定在孩子的题库里，外加一份人工审过的常用词表**，避免冷僻字或不当词。可以在构建期用 cnchar-words 或 pwxcoo/chinese-xinhua（https://github.com/pwxcoo/chinese-xinhua ，【实测】11682★、MIT）过滤后内嵌。

#### D2. pinkrec6/kanjiGame “かんじのもり” —— https://github.com/pinkrec6/kanjiGame
- **基本数据【实测】**：0★、**无许可文件**、最近 push 2026-07-07，没有 demo。原生 HTML、CSS、JS，PWA 可离线。README 是日文。
- **原玩法【原文】**：收录日本小学 1–3 年级的 440 个配当汉字，给 6 岁左右的孩子玩，设计上就是亲子共玩。模式有：
  - **かるた**：看读札“がっこう 🏫”，在“学□”的 □ 里点入正确的汉字卡，一局 10 题。
  - **かるた たいせん（双人）**：同一套札在屏幕左右各显示一份，**谁先点对谁拿札，先拿 5 张的人赢**。
  - **ことばづくり**：看“はなび 🎆”，按顺序选“花”和“火”组成词。
  - **かんじパズル**：2–4 人对战，把手里的汉字牌放上 7×7 棋盘，纵横连成二字熟语，按字数得分；实在组不出可以换牌并跳过。
  - **かんじずかん**：答对的汉字攒星星做收集图鉴，点一下会朗读。
- **为什么值得学**：这是本次找到的**唯一一个明确为“兄弟姐妹、亲子同屏对战”设计的汉字游戏**，而我们家正好有两个孩子。
- **华文知识融进机制【推断】“抢字卡·兄妹对战”**：
  - iPad 横放，上下（或左右）各一半屏，上半屏旋转 180°，两个孩子面对面坐。
  - 系统用 TTS 朗读一个词，比如“qíng tiān，晴天”，并显示“□天 ☀️”。两边同时出现 6 张字卡（晴、情、请、清……）。**谁先拍中对的卡谁得分，拍错就冻结 1 秒。**
  - **让分机制**：P2 那一侧的卡片带拼音，干扰项少（4 张）；P4 那一侧不带拼音，干扰项多（8 张），全是同音字。这样两个人势均力敌。
  - 题目来自 `pick`（听音辨词）、`words` 和 `chars.组词`。
  - 进阶模式“汉字拼盘”只给 P4：用 7×7 棋盘加字牌，纵横连成二字词语得分，相当于 Scrabble 精简版。
- **适合**：两个孩子一起玩（核心卖点），P4 也可以和电脑对战。
- **改编可行性【推断】**：
  - 核心是分屏加计时加判定，没有物理运动，估计 300 行。要加“会动”的元素：拍中时卡片飞向己方得分区，拍错时卡片抖动冻结。
  - 需要处理 iPad 多点触控，两人同时按：用 pointer events 按 pointerId 区分，要实测。
  - **无许可，只学规则。**

### E. 字块消除类

#### E1. lapsea/hanzi-match-game 汉字对对碰 —— https://github.com/lapsea/hanzi-match-game
- **基本数据【实测】**：16★、**无许可文件**、最近 push 2026-08-20，demo 可访问，React、TypeScript、Vite。
- **原玩法【原文】**：面向小学低年级（6–9 岁）。6×6 棋盘上放 36 个汉字，按顺序点两个格子，能组成词语（苹 + 果）就消除；顺序反了会提示“换个顺序试试～”。共 3 级 15 关，主题有动物、食物、四季等，关卡数据在 `levels.json`，也支持上传自定义字库 txt，每行一个词。
- **为什么值得学**：它证明了“词语连连看”适合 6–9 岁，而且支持上传自定义词表，和我们 `words` 按周更新的听写词正好契合。**但原版是静态棋盘，更像谜题而不是街机**，要改。
- **华文知识融进机制【推断】“词语消消乐（重力版）”**：改成三消（Bejeweled）式，相邻两格按正确顺序组成 `words` 或 `chars.组词` 里的词就消除。**上方的字块会掉落补位**，补位后如果又凑出新词，自动连锁消除（连击倍率 ×2、×3 并放烟花）。限定步数或时间，每关要清掉目标词（“本关要消掉：晴天、清水、请客”）。已有的“翻牌配对”靠记忆，这一个靠扫视和预判连锁。
- **适合**：都适合。P2 用 4×4 棋盘、字带拼音；P4 用 6×6 棋盘，并加入同音干扰字。
- **改编可行性【推断】**：三消的重力、连锁逻辑是经典实现，估计 400 行。**无许可，自己写。**需要保证开局至少有一个可消的词（生成后校验，不行就重排）。

### F. 笔画 / 部件变形类

#### F1. kkjusdoit/hanzi-stroke-games —— https://github.com/kkjusdoit/hanzi-stroke-games
- **基本数据【实测】**：1★、**无许可文件**、最近 push 2026-07-21，没有 demo。原生 HTML、CSS、JS，只有 37KB。
- **原玩法【原文】**：基于真实汉字 SVG 笔画数据的 8 种玩法：加一笔成字、减一笔成字、换一笔成字、补全汉字、字中找字、按笔顺猜字、相似字辨认、笔画拼字。数据来自 Chinese-Character-Stroke-Sequence-Dataset，上游整合了 Make Me a Hanzi，只打包了精简子集。README 原文提醒：数据要遵守上游项目的授权和署名。
- **华文知识融进机制【推断】“一笔变字魔法”**：
  - 屏幕上有一个“字精灵”，比如“日”，会变身。孩子手里的魔法棒有 3 种笔画（一、丨、丿）。**把一笔拖到字上的正确位置**，它就变身成新字（日 + 一 = 旦 / 目，日 + 丨 = 田 / 甲 / 申 / 由）。变身时有闪光和朗读，并记进“变身图鉴”。
  - “减一笔”模式：字精灵被怪兽咬走了一笔，要选出它原来是哪个字。
  - “按笔顺猜字”：笔画一笔一笔显现，越早猜中分越高，用倒计时加分数递减来制造紧张感。
  - 这和“写字打怪兽”互补：那边练手写，这边练**字形结构的敏感度**。
- **适合**：P4 男孩；“按笔顺猜字”P2 也能玩。
- **改编可行性【推断】**：
  - 站点已经内嵌了 HanziWriter 笔画数据，它的上游也是 Make Me a Hanzi，每个字有 `strokes` 和 `medians`。用它就能渲染“前 N 笔”和“多一笔”，不需要新数据源，但要沿用已有数据的署名。
  - “加一笔成字”的配对表（日 → 田、由、甲、申、目、旦）要人工整理，或者在构建期比较两字笔画序列的包含关系自动生成，再人工审核。
  - **无许可，只学玩法。**估计 350 行。

### G. 儿童语言游戏合集（机制库，照着它的清单挑）

#### G1. vgwb/Antura —— https://github.com/vgwb/Antura
- **基本数据【实测】**：123★、许可 API 显示 NOASSERTION；README 原文写代码是 BSD 2-clause，美术和音频素材是 CC-BY-4.0。最近 push 2026-09-15。Unity 6 项目，不是网页，没法直接跑。
- **来源背景【原文】**：多次获奖的开源识字与语言学习游戏“Learn with Antura”，前身是 EduApp4Syria 项目，支持阿拉伯语、英语、法语、波兰语等。
- **小游戏清单【原文，来自 `docs/en/content/language-minigames/index.md`】**：
  - Letters 类：ColorTickle（在字母轮廓里涂色）、DancingDots（给字母放点和音调符号）、Egg（孵蛋认字母，有按顺序的变体）、HideAndSeek（在躲藏的干扰项里找目标字母）、Maze（在限时赛道上沿正确笔画方向描字母）、SickLetters（去掉“生病”的错误点）、TakeMeHome（按发音部位把字母送回家）、ThrowBalls（投球击中目标字母）
  - Words 类：Balloons、FastCrowd（快速抓目标，**难度越高，捣蛋狗 Antura 来捣乱越频繁**）、MakeFriends（找两个词共有的音，让它们“交朋友”）、MissingLetter、MixedLetters（重排并旋转字母）、Tobogan（在单词里认字母来盖塔）
  - Images 类：Scanner（传送带上的“活字母”，拖扫描仪做词图对应；难度越高，**传送带越快、字母还会背过身去**）
  - 另有 ReadingGame 和 Assessments
- **最值得借的三个机制【推断】**：
  1. **“捣蛋狗”通用干扰层**：任何游戏里都可以随机冲出一只小狗，把字卡叼走或打乱，孩子点它、吓它就会跑掉。这给每局加了不可预测的笑点。**8 岁女孩会把它当宠物，10 岁男孩会把它当 Boss。**做成一个通用组件，挂进已有的 11 个游戏也行。
  2. **三星评分**：每个小游戏统一 1–3 星，复玩的动机就有了。
  3. **Scanner 传送带**：传送带上排着“活的汉字小人”，会眨眼、背身。屏幕上方给一张 `talk` 看图会话里的图片，比如“下雨”，孩子拖扫描仪扫中对应的词（“下雨”，而不是“下雪”）。速度越来越快，汉字小人还会转身只露背影（先看拼音后看字）。已有的 11 个玩法里没有“传送带扫描”。
  - 另外，**MakeFriends 可以改成“同音交朋友”**：两个字角色各举一个词，比如“晴天”和“心情”，孩子找出它们共有的读音 qíng，它们就牵手成为朋友。这个练的是**同音字辨析**。
- **适合**：都适合，属于机制层。
- **改编可行性**：Unity C# 代码不能搬，**只学机制**。素材如果要用，必须按 CC-BY-4.0 署名，而且要从 Unity 工程里导出，成本高，不建议。

#### G2. gcompris/GCompris-qt —— https://github.com/gcompris/GCompris-qt （KDE 官方仓库的镜像，正本在 https://invent.kde.org/education/gcompris ）
- **基本数据【实测】**：262★、最近 push 2026-09-18。GitHub API 识别不出许可，README 原文写整体 AGPL v3、内部代码 GPL v3+。Qt Quick / QML，面向 2–10 岁，超过 100 个活动。README 还原文声明**不接受 AI 生成的代码贡献**。
- **语言类活动【原文，来自各活动的 `ActivityInfo.qml`】**：
  - gletters（字母下落，在落地前打出来）
  - wordsgame（单词下落，打出来）
  - alphabet-sequence（开直升机按字母表顺序接云朵）
  - missing-letter、letter-in-word、hangman
  - readingh（在限时内读一列词，判断某个词在不在里面）
  - imagename（把图片拖到对应的名字上）
  - ordering_sentences
- **可借鉴的点【推断】**：
  - **readingh “闪读”**：快速扫读是 `passages` 阅读理解的前置能力，已有 11 个玩法都没覆盖。可以做成“词语流星雨”：一串词从右往左高速飞过，飞完后问“刚才有没有‘蝴蝶’？”，速度逐关加快。P4 适合。
  - **alphabet-sequence** 对应的是“按顺序接云朵”，但已有的“贪吃蛇排句”已经覆盖了“按顺序收集”，**不重复做**。
  - 活动目录本身可以当作检查清单，核对站点是否覆盖了听、说、读、写、字形、字音、字义。
- **适合**：参考用。
- **改编可行性**：AGPL，**只学机制，不拷代码**。

### H. 收集 / 间隔重复（跨游戏的“长线动机”）

#### H1. sheleoni/icecream-kana-game —— https://github.com/sheleoni/icecream-kana-game
- **基本数据【实测】**：1★、**无许可文件**、最近 push 2023-12-29，demo 可访问，Next.js 加登录功能。前身是 https://github.com/sheleoni/hiragana-icecream 。
- **原玩法【原文】**：选出假名的读音。**同一个字连续答对，六边形里的“水位”就上涨**，水满之后点一下，就能解锁一个新的冰淇淋球叠在甜筒上。可以筛选要练哪些字，成绩可以存档。
- **为什么好玩【推断】**：这是最小可用的“掌握度可视化加收集”。**8 岁女孩对“叠冰淇淋塔、集贴纸”这类收集奖励的兴趣，远高于分数。**
- **华文知识融进机制【推断】“冰淇淋塔”跨游戏元层**：
  - `chars` 里的每一个字都有自己的“水位格”。**这个字在任何一个街机游戏里被正确使用**，都会给它加水：被打中、被合成、被归位都算。
  - 某个字连续 3 次对，水满，就能解锁一个口味球，口味跟部首挂钩：氵字是蓝色汽水味，木字是抹茶味。
  - 甜筒越叠越高，首页一直展示“我的冰淇淋塔”。P4 男孩版可以换皮成“火箭燃料舱”或“宝可梦式图鉴”。
- **改编可行性【推断】**：纯数据层加一个展示页，估计 150–200 行。**无许可，只学机制。**

#### H2. open-spaced-repetition/ts-fsrs —— https://github.com/open-spaced-repetition/ts-fsrs
- **基本数据【实测】**：792★、MIT、最近 push 2026-09-18。jsdelivr 上的 `ts-fsrs@5.4.2` 有 `/dist/index.umd.js`，【实测】72KB，符合外部脚本只能来自 jsdelivr 的约束。
- **原玩法【原文】**：FSRS v6 间隔重复调度器，`createEmptyCard()` 建卡，`scheduler.next(card, now, Rating.Good)` 按评分给出下次复习时间。
- **怎么用在游戏里【推断】**：它不是游戏，而是**出题引擎**。
  - 每个街机游戏开局从题库抽词时，优先抽 FSRS 判定为“到期”的字和词，再掺入少量新词。
  - 游戏内的表现自动折算成评分，孩子**永远不会看到“复习卡片”**：一次就击中算 Good，反应很快算 Easy，打错后才中算 Hard，漏掉或被撞算 Again。
  - 这样“玩得开心”和“记得牢”就连起来了，也回应了 1.0 的问题：复习不必做成题卡。
  - 状态需要持久化。站点已有存储和同步逻辑，SPEC_ARCADE 提到过保留存储与同步。
- **改编可行性【推断】**：引入一个 UMD 文件，在出题函数里加一层调度，估计 80–120 行。注意 FSRS 是按天调度的；两个孩子要分开存卡。

### I. 双人 / 社交类

#### I1. xinyzhang9/flyflower 飞花令 —— https://github.com/xinyzhang9/flyflower
- **基本数据【实测】**：12★、**GPL-3.0**、最近 push 2017-03-17，demo 可访问，RxJS 加 SQLite 转 JSON。
- **原玩法【原文】**：两人轮流说出含有指定字（如“花”）的诗句，谁先接不上谁输；可以随时翻阅全诗，关键字高亮。
- **华文知识融进机制【推断】“词语炸弹接力”**：
  - 把诗句降级成**词语**：系统给一个字（“天”），两个孩子轮流在 10 秒内说出或点出含“天”的词（晴天、天空、今天、天气……），说过的不能重复。
  - 屏幕中央有一颗**引线越烧越短的炸弹**，答对就把炸弹“扔”给对方，引线重置，但会逐轮缩短。炸弹在谁手里爆炸，谁输这一轮，爆炸只喷出彩色纸屑。
  - 合法词表用 `chars.组词` 加 `words`，再加一份人工审过的扩展词表。
  - P2 可以点选：从 4 个候选里挑出含“天”的真词，干扰项是“天”加一个乱字。P4 必须自己打拼音或说出来。语音输入可以用站点已有的 ASR，SPEC_ARCADE 提到过 ASR，但 iPad Safari 上的识别率要实测。
  - P4 进阶版是成语接龙，可以用 cnchar-idiom，或 crazywhalecc/idiom-database（https://github.com/crazywhalecc/idiom-database ，【实测】163★、MIT）。
- **适合**：两个孩子一起玩，也可以单人对电脑。
- **改编可行性**：GPL，**只学规则**。估计 250 行，主要工作量在词表审核。

#### I2. jrainlau/draw-something 你画我猜 —— https://github.com/jrainlau/draw-something
- **基本数据【实测】**：269★、MIT、最近 push 2017-02-09。Vue 加 WebSocket（node 的 ws 库），README 本身是一篇实现教程。
- **原玩法【原文】**：一台 WebSocket 服务器、两个客户端，一边画一边猜，画布内容实时同步到猜的一方，猜的一方输入关键词判定对错。
- **华文知识融进机制【推断】“同屏你画我猜”**：
  - 不要服务器，改成**同一台 iPad 轮流玩**（pass-and-play）。画的人从 `words` 或 `talk` 里抽一个词，比如“西瓜”，只有画的人能看到。
  - 画 60 秒后交给另一个孩子猜。P2 从 6 个候选词里点选；P4 必须打拼音或手写，手写可以接 HanziWriter 的 quiz 模式。
  - 猜中后**两人都得分**，是合作不是对抗，能避免兄妹吵架。猜中后朗读这个词和它的例句。
  - 附加规则：画的人不能写字，发现写字就扣分，靠画面检测太难，交给对方举报。
- **适合**：P2 女孩画、P4 男孩猜，或反过来。
- **改编可行性【推断】**：MIT，不过它最有价值的部分（WebSocket 同步）同屏版正好不需要。同屏版就是 Canvas 画板加计时加候选词，估计 200 行。

### J. 基础设施（不是游戏，但决定能不能离线做）

#### J1. theajack/cnchar —— https://github.com/theajack/cnchar
- **基本数据【实测】**：3095★、MIT、最近 push 2026-08-02。jsdelivr 上的 `cnchar@3.2.6` 与各插件版本一致【实测 resolved】：
  - `cnchar.min.js` 77KB
  - `cnchar-radical` 34KB
  - `cnchar-words` 151KB
  - `cnchar-idiom`、`cnchar-poly`、`cnchar-random` 也都有
- **功能【原文】**：拼音、笔画数、笔顺、**偏旁部首查询**、**成语查询**（可按字、拼音、笔画数查）、组词、歇后语、随机生成拼音和词语，另有 cnchar-draw 绘制笔画和 cnchar-voice 语音。README 的“应用例子”里列了汉字打字游戏（即 B1）、打字弹钢琴（theajack/piano）和成语接龙。
- **用途【推断】**：
  - 优先用在**构建期**：用 cnchar 算出“含某部首的字表”“含某字的词表”，筛到孩子的程度后，直接内嵌成 JSON。
  - 运行时引入也可以，因为 jsdelivr 在白名单里；但体积大，词库也未必适合儿童，不建议。
  - **注意【实测源码】**：cnchar-draw 内置了一份 HanziWriter，文件是 `src/cnchar/plugin/draw/hanzi-writer.js`。默认的数据加载器会用 `XMLHttpRequest` 去 GET `getResourceBase() + 字 + '.json'`，也就是**运行时联网取字形数据**，违反“运行时不能 fetch”的约束。虽然可以用 `charDataLoader` 选项覆盖，但没有必要，继续用站点现有的内嵌 HanziWriter 数据就好。

#### J2. dhjz/hanzi-study —— https://github.com/dhjz/hanzi-study
- **基本数据【实测】**：225★、MIT、最近 push 2026-09-10，demo 可访问。Vue global build 加 hanzi-writer，全离线，含 130 个 mp3 和 69 个 webp。
- **原玩法【原文 / 源码】**：适合 3–6 岁，按关卡闯关。`gameType` 有 listen、fill、stroke、draw 四种；家长连点标题 10 次可以改关卡进度；2025-08 起收录 1200 多个汉字；另有古诗和 100 以内加减法。
- **可借鉴的点【实测源码】**：
  - 它把 HanziWriter 的笔画数据整体内嵌成 `js/lib/dataWriter.js`（884KB，内容是 `window.writerData = {"一": {"strokes": [...]}}`），并**用动态 `<script>` 按需加载第二个数据包** `dataWriter1.js`（2MB）。这正是“运行时不能 fetch”约束下的可行方案。
  - 家长连点标题 10 次的隐藏入口，也适合我们放家长设置。
- **不要学的**：它的核心玩法本质上还是“题卡加关卡解锁”，这正是 1.0 被家长批评的形态。**只借数据方案，不借玩法。**

---

## 3. 看过但没入选（及原因）

| 仓库 | 实测数据 | 不选的原因 |
|---|---|---|
| https://github.com/steveruizok/kdtype | 87★、MIT | 儿童打字游戏，但玩法只是“一个词一个词地打，打完放庆祝动画”，没有运动和压力，和 1.0 的问题一样 |
| https://github.com/knadh/wordpluck | 53★、MIT | 字母做成泡泡下落、打字摘取，机制被 B1、B2 覆盖；demo `wordpluck.netlify.com` 实测返回 404 |
| https://github.com/layyback/zType | 3★、MIT | 源码结构（`lib/game/entities/…`，Impact 引擎式）疑似转载原版 ZType，MIT 声明的来源可疑，许可风险大（【推断】） |
| https://github.com/sanidhyy/duolingo-clone | 655★、MIT | Next.js 加数据库加登录，太重；其中的红心、XP、每日任务这类元机制已被 H 类覆盖 |
| https://github.com/alyssaxuu/carden | 487★、MIT | 带积分和等级的闪卡，但它是 Chrome 扩展加 PHP/MySQL，不是游戏 |
| https://github.com/Yidadaa/shuangpin | 538★、MIT | 双拼练习，对 8–10 岁用处不大 |
| https://github.com/david-fong/capswalk | 12★、PolyForm Noncommercial | 在网格上按读音打字移动，概念有趣，但作者自称“还没想好游戏是什么”，许可也有限制 |
| https://github.com/timmalich/edukiz | 13★、MIT | 离线 Vue 小游戏（记忆翻牌、拖字母），和已有玩法重复 |
| https://github.com/wangzifan396-wzf/mini-browser-games | 52★、MIT | 124 个单 HTML 零依赖小游戏，是很好的**工程参考**（单文件架构和存档码），但不属于语言类，留给街机分支 |
| https://github.com/RikaKagurasaka/urime-plus | 21★、无许可 | 类 Wordle 猜汉字，README 只有一行，已被 A1、A2 覆盖 |
| https://github.com/s5s5/phonics | 8★、MIT | 英文自然拼读海报加配对，配对部分和“翻牌配对”重复 |
| https://github.com/parsimonhi/animCJK | 462★、Arphic 加 LGPL | 汉字笔顺动画数据，站点已经有 HanziWriter，不需要 |

---

## 4. 给主线的落地建议【推断】

1. **优先做 3 个**，都有明确的“知识即操作”设计，且和已有 11 个玩法不重复：
   - 拼音星际战机（B）：P4 的主力游戏。
   - 抢字卡·兄妹对战（D2）：两人同屏，家长点名要的“像游戏”的那种热闹。
   - 落字归位（C1）：两档都能玩，自带易混字追踪。
2. **两层通用机制**应该挂到所有游戏上，而不是做成单独的游戏：
   - FSRS 出题调度（H2）：玩得越多，出题越准。
   - 冰淇淋塔收集，加上捣蛋狗干扰和三星评分（H1 + G1）：给 P2 长线动机。
3. **数据准备**要在构建期一次性完成，然后内嵌：
   - 部件拆字表（build 加 hanzi_chaizi）
   - 含某字的儿童词表（chars.组词 加 cnchar-words，人工审核）
   - 易混字对（从 typo 提取，加人工补充约 50 对）
   - 加一笔配对表（用 HanziWriter 笔画序列比较，再人工审核）
4. **许可纪律**：
   - 无许可、GPL、AGPL 的仓库（kana-game、kanjiGame、hanzi-match-game、hanzi-stroke-games、icecream-kana-game、qwerty-learner、flyflower、GCompris）**只看 README 和玩法，不拷代码**。
   - MIT、BSD、Apache 的仓库如果拷了代码片段，要在 `licenses/` 里补上对应声明。
