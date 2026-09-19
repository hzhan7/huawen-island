# 益智/消除类 GitHub 调研 · 对抗式核验

核验日期：2026-09-18　核验对象：`research/gh_puzzle.md` 的 23 个候选仓库，以及它给出的“华文融合创意”
核验方法：每个仓库都用 `gh api repos/OWNER/REPO` 查元数据，用 `gh api .../git/trees/<branch>?recursive=1` 查文件树，用 `curl raw.githubusercontent.com` 读 README 和关键源码，Demo 用 `curl -L` 取状态码，并检查页面引用的 JS 能否加载。题库数据量直接读 `content/*.json` 统计（只读）。

证据等级：
- **[实测]**：本次在本机跑出来的数字、状态码、源码行、node 实跑结果
- **[原文]**：README 或源码注释里的原话（这里是意译）
- **[推断]**：判断，包括“孩子喜不喜欢”。本分支**没有做过真人试玩**，所有“好玩”的说法都属于这一类

---

## 0. 结论先行

**数据核对**：23 个仓库全部存在，没有 archived 或 fork 的；星数、许可 spdx、最后推送时间与原笔记一致 [实测]。原笔记没有编造仓库。

**原笔记漏掉或写错、会影响决策的 8 处**：

1. **rembound 的两个仓库（泡泡龙、三消）许可有冲突**。LICENSE 文件是 MIT，但 `.js` 文件头仍然写着 GPL-3.0 或更高版本 [实测]。查 commit 历史：作者在 2021-07-26 用 commit `2e62806`（泡泡龙）和 `be7df47`（三消）“License update”，把 LICENSE 从 GPL-3 改成了 MIT，同时删掉了 README 里的 GPL 段落，**文件头没改** [实测]。改授权的是版权人本人，可以按 MIT 用；但复制代码时要把文件头改成 MIT 并注明这两个 commit。更稳妥的做法是照算法重写，核心函数只有几十行。
2. **xiaozhu188/pixi-game-match3 是 PixiJS 官方 Puzzling Potions 的改版，但没有注明上游**。两边 `src/match3/` 下的 15 个文件同名，JSDoc 注释逐字相同，Spine 素材同名（`dragon-skeleton`、`cauldron-skeleton`）[实测]。上游 `pixijs/open-games` 在 2023-02-06 提交了 Match3.ts，xiaozhu188 在 2023-08-06 才初始化仓库 [实测]。但它的 LICENSE 版权人写的是 “hairyf”，README 也没提 PixiJS [实测]，缺上游署名。**处理：剔除，换成上游 [pixijs/open-games](https://github.com/pixijs/open-games)**（MIT，453★）。这个仓库里还有一款泡泡龙 Bubbo Bubbo，两款的 demo 都能打开（200）[实测]。
3. **Binaryify/vue-tetris 是无许可证仓库 chvin/react-tetris 的 Vue 重写**（README 原文）。chvin/react-tetris 的 `/license` 接口返回 404 [实测]。原笔记一边说“react-tetris 没许可不能用”，一边推荐它的 Vue 重写版，自相矛盾。**剔除**，何况它能提供的也只是俄罗斯方块的通用界面布局。
4. **imshubhamsingh/15-puzzle 不是“原生 JS”**，用的是 React 16 alpha、styled-components 和 parcel [实测 package.json]。
5. **taniarascia/sokoban 只有 1 关**（`levelOneMap`），而且只有 `keydown`，**不支持触屏** [实测]。
6. **stephanecot/typing-of-the-dev 的 README 徽章写着“built with Claude Fable 5”**，仓库 2026-06-12 才创建，只有 1★ [实测]。题材是办公室 IT 梗（PROD 服务器、CIO、GDPR 表单）。原笔记写“每个字母一发子弹”，但仓库里没有子弹或弹道代码，打对字母只是爆火花粒子，这其实是 ZType 的做法 [实测 grep]。**只借鉴玩法。**
7. **jeantimex/klotski 的求解器不能给“拼成语推盘”当提示**。它的目标是“0 号块逃到 escapePoint”，并且按 5 种块型做哈希，同型块视为相同 [原文 README]。15 数码式的推盘每块身份不同，套不上。另外 **4×4 推盘只有 15 块加 1 个空格，放不下 4 个四字成语（需要 16 格）**。
8. **最要紧的是数据可行性**。原笔记的“部首消消乐（P2 首选）”和“P2 部首泡泡”都规定只用 `chars.部首`，同部首不足 3 字的不进棋盘。实测 **P2 的 30 个字里，没有任何一个部首有 3 个字以上**（最多 2 个：门、日、囗、辶）；P2 到 P4 累计 90 字也只有 6 个部首达到 3 字以上，共 23 字 [实测]。**按原规则，P2 一个部首都进不了棋盘，这两个 P2 玩法做不出来。**

**另外 4 处小修正** [实测]：
- 2048 的合并条件不止 `value * 2` 一处。`game_manager.js` 第 156 行的 `next.value === tile.value` 和第 260 行 `tileMatchesAvailable` 里的相等判断都要换掉。JS 合计约 23.5KB，含 polyfill。
- wordfind 不必改常量 `LETTERS`：`options.fillBlanks` 可以直接传一个函数，由它返回干扰字。我用 node 生成了 5×5 汉字网格，`solve()` 三个词都找到了。
- Crossword 生成器用 8 个二字词实跑：放进了 5 个，另外 3 个返回 `orientation:"none"`，要自己过滤掉。
- khivy/wordtris 的前端是 React（CRA）+ TypeScript，词库是英文的 Scrabble80K，服务端是 Java/Gradle + Redis + Postgres。

**本分支最值得做的 5 个**（第 3 节详述，每个都按改进后的规则）：

| 名次 | 玩法 | 谁 | 底座 | 为什么选它 |
|---|---|---|---|---|
| 1 | **拼音守岛**（ZType 式打字射击） | P4；P2 用“只打声母”版 | 自己用 HW.arcade 写，只借玩法 | 每按一个键都是“认字 → 拼读”，绕不过去；已有 11 个街机都没有“产出拼音”的玩法 |
| 2 | **声调泡泡龙** | P4 分声调；P2 分音节 | rembound 泡泡龙的吸附和连通算法（有条件复用），瞄准线参考 PixiJS Bubbo Bubbo | 每一发都是“带调拼音 → 字”的判断，打错就粘住，天花板往下压；P4 题库有现成的同音异调组 |
| 3 | **词语方块雨**（Puyo/Columns 式） | P4 | jakesgordon/javascript-tetris（可复用） | 往哪放就是在组词，乱放只会越堆越高 |
| 4 | **词语连连看** | P4 连组词对；P2 连字 ↔ 图 | gd4Ark/linkup 的路径算法（可复用） | 每一对都要做华文判断，路径规则保留了原版的空间推理 |
| 5 | **部件合体 2048** | P2、P4 | gabrielecirulli/2048（可复用） | 5 秒能学会、最像游戏；但合体是自动发生的，孩子不一定在动脑，语言密度最低，所以排第 5 |

候补：**听音找词**（bunkat/wordfind，P2 适用）。降级：部首消消乐（数据不足）、华容道/推盘拼成语、推箱子造字、拼字拼图、汉兜、填字、数独。

---

## 1. 逐仓核验表

★、许可、推送时间都是 2026-09-18 的 [实测] 数据。“可玩”指仓库里有能直接打开的 `index.html` 或 `*.html`，或者有线上构建产物且 JS 能加载。

| # | 仓库 | ★ | 许可 | 最后推送 | Demo [实测] | 可玩 | 原笔记问题 / 补充 | 处置 |
|---|---|---|---|---|---|---|---|---|
| 1 | https://github.com/rembound/Bubble-Shooter-HTML5 | 59 | MIT | 2023-10-17 | 文章页 200；iframe `bubble-shooter-iframe.html` 200；`bubble-shooter-example-min.js` 200 | 是 | **文件头是 GPL-3.0，LICENSE 是 MIT（2021 年改授权）**；函数名、只绑 `mousemove/mousedown`、单张 sprite，都和原笔记一致 | **可复用代码（附条件）** |
| 2 | https://github.com/rembound/Match-3-Game-HTML5 | 80 | MIT | 2023-01-13 | 文章页 200；`files/match3-example.js` 200 | 是 | 许可冲突同上（commit `be7df47`）；`findMoves` 和 `tilecolors` 都对得上 | 可复用代码（附条件），**推荐度降为中低** |
| 3 | https://github.com/gabrielecirulli/2048 | 13400 | MIT | 2024-10-24 | play2048.co 200；gabrielecirulli.github.io/2048/ 200 | 是 | JS 约 23.5KB；合并判断有两处要改；touch 和 MSPointer 滑动都有 | **可复用代码** |
| 4 | https://github.com/stephanecot/typing-of-the-dev | 1 | MIT | 2026-06-28 | 200，页面引用的 phaser 和 js 都是 200 | 是（只支持键盘） | 2026-06 新建；AI 生成；IT 办公室题材；排行榜要 Node sqlite 服务端；“每字母一发子弹”在仓库里找不到 | **只借鉴玩法** |
| 5 | https://github.com/gd4Ark/linkup | 85 | MIT | 2023-11-02 | 4ark.me/linkup 200；README 里的 gd4ark.github.io/linkup 也是 200 | 是 | JS 18.2KB；`event.js` 只响应点在 `IMG` 上的 click；14 张 `img/*.png` 来源不明，不要用 | **可复用代码**（路径算法） |
| 6 | https://github.com/jakesgordon/javascript-tetris | 733 | MIT | 2025-06-01 | jakesgordon.com/games/tetris/ 200 | 是 | 一致：只有 `keydown`，README 的 FUTURE 里写着 touch support；另外还有一个 `stats.js` | **可复用代码** |
| 7 | https://github.com/khivy/wordtris | 15 | MIT | 2022-12-09 | 200，main.js 200 | 是 | React（CRA）+ TS；英文 Scrabble 词库；排行榜服务端已停（原文） | 只借鉴玩法 |
| 8 | ~~https://github.com/xiaozhu188/pixi-game-match3~~ | 91 | MIT | 2024-10-08 | 200；“完整版” match3.zhuwenjin.top 连不上 | 是 | **是 PixiJS Puzzling Potions 的改版，缺上游署名** | **剔除 → 换成 #8′** |
| 8′ | https://github.com/pixijs/open-games （新增） | 453 | MIT | 2025-11-11 | pixijs.io/open-games/bubbo-bubbo 200、/puzzling-potions 200，入口 JS 200 | 是 | PixiJS v8 + gsap + Spine，要 vite 和 assetpack 构建；Bubbo Bubbo 用 `pointermove/pointertap` 瞄准，并算出墙面反弹交点 | **只借鉴玩法/动效** |
| 9 | https://github.com/jeantimex/klotski | 51 | MIT | 2026-07-10 | 200；jsDelivr `klotski.min.js` 200（5.6KB） | 是 | 40 个布局名一致（横刀立马、指挥若定……）；**求解器只适用于华容道，不适用于推盘** | 可复用代码，低 |
| 10 | https://github.com/flbulgarelli/headbreaker | 192 | ISC | 2025-05-11 | 200；jsDelivr `+esm` 200（33KB），konva 200 | 是 | 一致 | 可复用代码，低 |
| 11 | https://github.com/bunkat/wordfind | 198 | MIT | 2023-07-01 | 无（Pages 404） | 仓库里有 `index.html` | `fillBlanks` 可以传函数；node 实跑汉字网格通过；npm 上的同名包是别人的 | **可复用代码**，中（P2） |
| 12 | https://github.com/antfu/handle | 1439 | MIT | 2025-02-12 | 200，各 chunk 200 | 是 | 一致；依赖 `pinyin`；答案库 2023-02-28 起不再更新（原文） | 只借鉴玩法，低 |
| 13 | https://github.com/MichaelWehar/Crossword-Layout-Generator | 86 | MIT | 2025-04-21 | 200 | 是 | 中文实跑通过：8 个词放进 5 个，其余标为 `none` | 可复用代码，低 |
| 14 | https://github.com/taniarascia/sokoban | 91 | MIT | 2023-07-27 | 200，各模块 200 | 是 | **只有 1 关、不支持触屏** | 可复用代码，低 |
| 15 | ~~https://github.com/shunyue1320/sokoban~~ | 38 | MIT | 2026-06-01 | 无（404） | 仓库里有 `game.html` | 第 1 关是流传很广的经典布局，来源不明 [推断]；地图格式只是二维数组，没什么可借的 | **剔除** |
| 16 | https://github.com/fflow2023/BanGKlotski | 27 | MIT（仅代码） | 2026-05-16 | 200 | 是 | 一致：有 `touchstart`，BFS 放在 Web Worker 里；README 说由 Claude Opus 4.6 生成；角色图版权归 BUSHIROAD | 可复用代码（仅代码），低 |
| 17 | ~~https://github.com/Binaryify/vue-tetris~~ | 2774 | MIT | 2025-09-08 | 200 | 是 | **是无许可证的 chvin/react-tetris 的重写** | **剔除** |
| 18 | https://github.com/stdio2016/shapeclear-html | 14 | MIT | 2023-03-28 | 200 | 是 | 用的是旧版 Phaser 2.13.3；作者自己说“还没有完成”；支持手指操作（原文） | 只借鉴玩法（特殊块规则） |
| 19 | https://github.com/teaplz/UMTSolitaire | 0 | MIT | 2026-02-26 | 200，JS 200 | 是 | 一致 | 只借鉴玩法/算法 |
| 20 | https://github.com/knadh/wordpluck | 53 | MIT | 2023-05-23 | .app 200；API 登记的 .com 是 404 | 是（只支持键盘） | 2012 年的旧代码（原文） | 只借鉴玩法，低 |
| 21 | https://github.com/robatron/sudoku.js | 495 | MIT | 2025-12-17 | htmlpreview 200，但那只是外壳页，没法证明 demo 真能跑 | 仓库里有 `demo/` | 9×9 写死，一致 | 只借鉴思路，**不建议做** |
| 22 | https://github.com/AllanChain/chinese-wordle | 21 | BSD-3-Clause | 2023-05-03 | 200，JS 200 | 是 | 一致 | 只借鉴玩法 |
| 23 | https://github.com/imshubhamsingh/15-puzzle | 203 | MIT | 2024-02-26 | .app 200；.com 404 | 是 | **是 React，不是原生 JS** | 只借鉴玩法，低 |

另外搜了 Puyo 类，想给“词语方块雨”找更贴切的底座，结果都不合格 [实测]：
- icoxfog417/kemono_puyo（95★，MIT）是黑客松玩具，README 说放弃了操控功能。
- orangain/puyo-programming（6★）的 `www/` 目录走 SEGA 非商用许可，不是 MIT。
- WillFlame14/jspuyo 是 GPL-3.0。

所以词语方块雨仍然用 jakesgordon 的俄罗斯方块做骨架。

---

## 2. 挑战“华文融合创意”：判据与逐项裁决

### 判据（任何一个华文小游戏都要过这 5 关）
- **A 决策点**：每次得分都必须先做一次华文判断。只在奖励时读一下拼音不算。
- **B 防绕过**：不能靠颜色、同形配对（两个一样的字）或乱试过关。
- **C 瓶颈**：华文越好，分数越高；不能只比手速。
- **D 数据**：只用已核查的题库，题量要实测够用。
- **E 不重复**：和已有 11 个街机的技能或内容不重叠。

### 逐项裁决

| 原创意 | A | B | C | D [实测] | E | 裁决 |
|---|---|---|---|---|---|---|
| 同音泡泡龙：P4 声调 | ✓ | 同音组若用同色 → ✗ | ✓ | P4 有 15 个同调组（≥2 字）、12 个同音节组（≥3 字，不论声调） | ✓ | **保留，但颜色必须和读音无关** |
| 同音泡泡龙：P2 部首 | ✓ | ✓ | ✓ | **✗：P2 没有任何部首达到 3 字** | ✓ | **删除** |
| 同音泡泡龙：听音模式 | ✓ | ✓ | ✓ | ✓ | **✗：就是“气球射击”（pick，听词戳气球）换了皮** | **删除** |
| 部首消消乐 | 第 1–2 关同部首同色 → ✗ | 靠颜色 → ✗ | 三消的连锁多半是自动发生的 | **✗：P2 为 0；P2–P4 累计只有 6 组共 23 字** | ✓ | **降级，暂不做** |
| 汉字合体 2048：P2 叠字链 | **✗：两块一样就合，和数字 2048 完全相同，是纯换皮** | ✗ | ✗ | ✗：叠字链不在题库里 | ✓ | **删除** |
| 汉字合体 2048：P4 部件 | 半 ✓（合体是自动的，判断只发生在规划时） | 部分可以乱滑 | 中 | 每年级 build 只有 15 条，P2–P4 累计 45 条 | **和“偏旁钓鱼”共用 build 题库** | **保留，但要改规则**（第 3.5 节） |
| 拼音打字打僵尸 | ✓ 每个键都是 | ✓ | ✓ | P4 字池 159、P2 131；词 50/年级 | ✓ 唯一 | **保留，排第 1**；“僵尸”改成海怪 |
| 词语连连看：P2 字 ↔ 拼音 | ✓ | ✓ | 中 | ✓ | **✗：和“拼音翻翻乐”（词语配拼音）重复** | 改成字 ↔ 图 |
| 词语连连看：P4 组词对 | ✓ | 乱点要有代价 | ✓ | chars.words 86 个二字词 + words 27 个 | ✓ | **保留** |
| 词语连连看：反义词对 | ✓ | ✓ | ✓ | **✗：题库里没有反义词栏** | ✓ | 删除 |
| 词语方块雨 | ✓ 往哪放就是在组词 | ✓ 乱放必死 | ✓ | 二字词白名单每年级约 110–120 个 | 和“天降汉字”部分相似 | **保留**；删掉 P2 的“同字相邻就消” |
| 词语方块雨：部件块 氵+可 | ✓ | ✓ | ✓ | **✗：build 没有方位字段** | — | 暂不做 |
| 华容道拼成语：4×4 推盘 | 只在开局认一次成语，之后都是纯空间操作 | — | ✗：瓶颈是推盘技巧 | 4×4 放不下 4 个成语；求解器套不上 | ✓ | **降级** |
| 华容道故事关（人名块） | ✗：华文只在旁白里 | — | ✗ | — | — | 删除 |
| 推箱子造字 / 填句 | ✓ | ✓ | 中 | build 没有方位字段，关卡要手工做 | — | 降级 |
| 拼字拼图 | ✗：本质是视觉拼图 | — | ✗ | — | — | 降级 |
| 听音找词 | ✓ | ✓（有形近、同音干扰字） | ✓ | 词 50/年级；typo 的 bad/good 对 15/年级 | ✓ | **候补（P2）** |
| 汉兜 / 拼成语 Wordle | ✓ | ✓ | ✓ | ✓ | ✓ | 画面静态，只适合当每日彩蛋 |
| 填字 | ✓ | ✓ | ✓ | ✓ | ✓ | 画面静态，降级 |
| 四季数独 | **✗：4 个字只是符号，用不到华文** | — | — | — | — | 删除 |
| 部首数独 | ✓ | ✓ | ✓ | ✗：部首数据不足 | — | 删除 |

**数据陷阱** [实测]：把 `words.py` 按字拆开，会带进变调和轻声。例如 P4 字池里“一”被拆成 yì，“宜”（来自 便宜）被拆成轻声 yi。**所有比声调的玩法，单字拼音只能用 `chars.py`**，或者先把轻声和“一、不”过滤掉。无调输入（打字）不受影响。

---

## 3. 推荐做进华文小岛的 5 个玩法（改进后的规则）

共同原则 [推断]：
- 华文判断放在每一次操作的**决策点**上。
- 错了在游戏内受罚：粘住、堆高、扣时间、断连击，**不弹题卡**。
- 同一种判断一局出现几十次，每次只花 1–3 秒。
- 颜色、形状这些非语言线索只在教学关出现。
- `g.say` 只在连锁结束或特殊块触发时读，避免 TTS 排队。

### 3.1 拼音守岛（ZType 式打字射击）：P4 主玩，P2 玩声母版
- **底座**：用 HW.arcade 自己写，约 350 行 [推断]。玩法参考 typing-of-the-dev：打第一个字母锁定目标，打完整个词消灭它 [原文]。不搬它的 Phaser 代码：1.19MB，题材也不合适。
- **规则**：海怪、外星虫朝小岛逼近，身上写着汉字或二字词。打出无调拼音（ü 打 v）才能攻击，每打对一个字母，就有一道光束打在怪物身上。困难模式要加声调数字，因为同屏会故意放 惊 jīng 和 静 jìng。
- **防绕过**：屏幕上不显示拼音。打错一个字母，连击清零，这只怪加速；怪物登岛就扣心。
- **P2 版**：只打声母。iPad 上只画 6 个大号候选键，避免 8 岁孩子满键盘找字母。
- **数据** [实测]：单字取 `chars.py`（每年级 30 个）；二字、四字词取 `words.py`（P4 有 27 个二字词、23 个四字词）。多音字只能以词的形式出现。
- **为什么排第 1**：已有 11 个街机都是“认”和“选”，这是唯一要孩子**自己拼出**拼音的，而且每按一次键都在练。

### 3.2 声调泡泡龙：P4 分声调，P2 分音节
- **底座**：复用 rembound 的 `snapBubble` / `findCluster` / `findFloatingClusters` / `getNeighbors`（附 MIT 并改掉 GPL 文件头，或者照着重写）。瞄准虚线和借墙反弹预测参考 PixiJS Bubbo Bubbo 的 `AimSystem`（它计算墙面交点）。输入改成 `down/move/up`。
- **规则**：一关只用**一个音节的几个声调**。例如 P4 “jing 关”：惊、睛、精、晶读 jīng，静、境读 jìng；“shi 关”：失 shī、实 shí、释 shì；“qian 关”：千、谦 qiān，钱 qián，浅 qiǎn（全部是 P4 题库里的字 [实测]）。炮台上显示带调拼音 “jīng”，装弹时 TTS 读一遍。打中后，同一个读音连通 3 个以上就爆掉，挂在下面的泡泡整片掉落，掉落时飘出拼音。
- **防绕过**：**泡泡颜色随机，和读音无关**（原创意里同组同色，孩子会只看颜色）。打错的泡泡粘在原地；连续打偏，天花板下降一行。
- **P2 版**：不比声调，比音节。一关 3–4 个音节，例如 礼、里 lǐ，雨、语 yǔ，精、晶 jīng，奇、齐 qí（P2 题库有 9 个同调组 [实测]）。
- **删掉**：P2 部首模式（数据为 0）和听音模式（与气球射击重复）。

### 3.3 词语方块雨（Puyo/Columns 式）：P4
- **底座**：jakesgordon/javascript-tetris 的游戏循环、下落计时和碰撞检测，17.9KB，可复用。触屏要自己加：左右滑移动，点一下旋转，下拉加速。“落地后检测成词”的想法参考 wordtris，但它是英文加 React，只借玩法。
- **规则**：每次落下两格字块。落地后，相邻两字从左往右读或从上往下读，只要在二字词白名单里就爆掉；上面的块塌下来又成词，算连锁。
- **原创意的坑与修正**：
  1. 随机字块很少能和盘面成词，会越堆越高，必输 [推断]。生成器要**有偏置**：每个新块至少有一个字能和盘面上某个字组成白名单词。
  2. 原笔记给 P2 的“两个相同的字相邻就消”是同形配对，属于换皮，删掉。
  3. 部件块（氵 + 可）需要方位数据，build 没有，暂不做。
- **数据** [实测]：白名单 = `words` 里的二字词 + `chars.words` 里的二字词。P4 为 27 + 86，P2 为 37 + 87，去重前。
- **和“天降汉字”的区别**：天降汉字是听词后按顺序接字，考反应；方块雨是自己决定放哪，考组词规划。

### 3.4 词语连连看：P4 连组词对，P2 连字 ↔ 图
- **底座**：复用 gd4Ark/linkup 的 `directlyConnectable` / `onceCorner` / `twiceCorner` / `isConnectable` / `checkDeadlock` / `randomReset`。渲染和输入重写：原来的事件只响应点在 `<img>` 上，图片来源也不明。
- **规则**：两块能用不超过 2 个拐弯的线连通，并且两个字**组成白名单里的二字词**，才能消掉，同时 `g.say("春天")`。倒计时条一直在缩；死局自动洗牌，扣时间。高关消除后方块往下挤，让画面一直在动。
- **防绕过**：连错一对扣 3 秒并闪红，防止乱点。
- **P2 版**：不做“字 ↔ 拼音”，那是拼音翻翻乐的内容。改成“字 ↔ emoji”，只用有明确 emoji 的具体名词（猫 ↔ 🐱、鱼 ↔ 🐟），对照表要**人工核对**。
- **删掉**：反义词对（题库里没有这类数据）。

### 3.5 部件合体 2048：P2、P4
- **底座**：复用 gabrielecirulli/2048 的 `move()` 和 `keyboard_input_manager.js`（自带 touch）。合并判断要改两处：第 156 行和第 260 行 [实测]。
- **规则（改过的）**：
  - 棋盘上只生成**能找到搭档**的部件。按 build 的 base 家族出块：P4 有 艮 → 根、跟、银、狠，采 → 彩、菜、踩；P2 有 青 → 晴、请，包 → 饱、跑，巴 → 爬、爸 [实测]。
  - 部件 + 声旁相撞，查到 build 配方就合成这个字，并读出 `hint` 字段（晴天、请坐）。
  - 合出来的字**不再往上合**。停一步后，如果和相邻的合成字能组成白名单词，两块一起消掉；否则自动飞走得分，腾出空位。
- **删掉**：P2 叠字链（木 → 林 → 森）。两块一样就合，是纯换皮，数据也不在题库里。
- **先不做**：“滑动方向 = 部件方位”。build 没有方位字段，15 条里有半包围结构（问、返、房、爬），也有部件在右边的（放、静、彩），要人工补数据 [实测]。
- **为什么排最后**：合体由程序自动完成，8 岁孩子很可能乱滑 [推断]，语言密度低于前 4 个；而且和“偏旁钓鱼”共用同一批 build 题目。P4 可以用 P2–P4 累计的 45 条来缓解重复。

### 候补：听音找词（P2）
复用 bunkat/wordfind 的生成器。`fillBlanks` 传入一个函数，从同音字和 typo 形近字对里取干扰字，node 实跑已通过 [实测]。TTS 读一个词，孩子在网格里划出来；找到后字块飞走，上方的字块掉下来补位。画面偏静，排在 5 个之后。

---

## 4. 剔除和降级清单
- **剔除**：xiaozhu188/pixi-game-match3（缺上游署名，换成 pixijs/open-games）；Binaryify/vue-tetris（是无许可证仓库的重写）；shunyue1320/sokoban（没有 demo，关卡来源不明，格式也没价值）。
- **降级，暂不做**：部首消消乐（数据不足）；华容道和 4×4 推盘拼成语（放不下，求解器不适用，语言只在开局用一次）；推箱子造字（要方位数据和手工关卡）；拼字拼图（视觉拼图，用不到多少华文）；汉兜、填字（画面静态）；数独（四季数独用不到华文，部首数独数据不足）。

## 5. 复现命令
```bash
gh api repos/OWNER/REPO --jq '[.stargazers_count,.license.spdx_id,.pushed_at,.archived,.homepage]'
gh api "repos/OWNER/REPO/git/trees/<branch>?recursive=1" --jq '.tree[]|select(.type=="blob")|"\(.size)\t\(.path)"'
gh api "repos/rembound/Bubble-Shooter-HTML5/commits?path=LICENSE"          # 2021-07-26 License update
gh api repos/rembound/Bubble-Shooter-HTML5/commits/2e62806 --jq '.files[].filename'
gh api repos/chvin/react-tetris/license                                     # 404 = 无许可证
gh api "repos/pixijs/open-games/commits?path=puzzling-potions/src/match3/Match3.ts" --jq '.[-1].commit.author.date'
curl -sL -o /dev/null -w '%{http_code}' <demo-url>
```
