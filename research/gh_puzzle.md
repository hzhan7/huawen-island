# GitHub 调研 · 益智/消除类 → 华文小岛 2.0 可借鉴清单

调研日期：2026-09-18　负责分支：益智/消除类（三消、2048、俄罗斯方块、泡泡龙、推箱子、连连看/麻将、拼图、找不同、Wordle/找词/填字、打字、数独、华容道）

## 证据等级（每条结论后面都标了）
- **[实测]**：2026-09-18 在本机用 `gh api repos/OWNER/REPO`、`gh api .../git/trees`、`curl raw.githubusercontent.com` 读到的数字、文件和代码，或者 `curl -L` 拿到的 HTTP 状态。**Demo 标“200”只说明页面打得开，我没有逐个试玩。**
- **[原文]**：仓库 README 或代码注释里的原话，这里是意译。
- **[推断]**：我的判断，包括孩子喜不喜欢、要改多少、是否合规。
- 星数、许可、最后推送时间都是 2026-09-18 的快照（`final_meta.tsv` 在 scratchpad，数值已抄进本文）。许可一栏用的是 GitHub API 返回的 `license.spdx_id`。

---

## 0. 结论先行：推荐先做这 6 个

已有的 11 个街机游戏（气球、接字篮、青蛙、火箭、节拍、赛车、贪吃蛇、翻牌、打地鼠、钓鱼、写字打怪兽）里，没有“消除 / 合成 / 堆叠”这一大类。这一类恰恰是小学生在平板上玩得最多的休闲游戏类型 [推断]，所以下面 6 个优先补上。每个都是**把华文规则写进“能不能消 / 能不能合”的判定函数里**，而不是另外弹一张题卡。

| 优先 | 华文版玩法 | 主要借鉴仓库（许可） | 适合谁 | 华文规则长在哪里 |
|---|---|---|---|---|
| 1 | **同音泡泡龙** | [rembound/Bubble-Shooter-HTML5](https://github.com/rembound/Bubble-Shooter-HTML5)（MIT） | 两人都适合，按难度分 | 发射的泡泡写着“qíng”，只有读 qíng 的字（晴、情）会连锁爆开；打到“请 qǐng”“清 qīng”就粘在那里，成了障碍 |
| 2 | **部首消消乐** | [rembound/Match-3-Game-HTML5](https://github.com/rembound/Match-3-Game-HTML5)（MIT），动效参考 [xiaozhu188/pixi-game-match3](https://github.com/xiaozhu188/pixi-game-match3)（MIT） | 最适合 P2 女孩 | 三个**同部首**的字连成一线就消，不必是同一个字 |
| 3 | **汉字合体 2048** | [gabrielecirulli/2048](https://github.com/gabrielecirulli/2048)（MIT） | 两人都适合 | 木 + 木 = 林，林 + 木 = 森；女 + 子 = 好。滑动相撞时，查表能合成一个真字才合体 |
| 4 | **拼音打字打僵尸** | [stephanecot/typing-of-the-dev](https://github.com/stephanecot/typing-of-the-dev)（MIT，只借机制） | P4 男孩 | 僵尸头上是汉字，要打出它的拼音才能开枪；困难模式还要打声调数字 |
| 5 | **词语连连看** | [gd4Ark/linkup](https://github.com/gd4Ark/linkup)（MIT） | 两人都适合 | 连线不超过 2 个拐弯才算一对：P2 连“字 ↔ 拼音”或“字 ↔ 图”，P4 连“能组成词语的两个字”或“反义词” |
| 6 | **词语方块雨** | [jakesgordon/javascript-tetris](https://github.com/jakesgordon/javascript-tetris)（MIT），机制参考 [khivy/wordtris](https://github.com/khivy/wordtris)（MIT） | P4 男孩 | 两格一组的字块往下掉，横着读或竖着读能组成听写词就爆掉，上面的块塌下来还能连锁 |

第二梯队（画面偏静，要额外加计时、掉落等动态元素才像游戏）：华容道拼成语、推箱子造字、拼字拼图、听音找词、词语填字、汉兜猜词、汉字数独、形近字找不同。详见第 2 节。

---

## 1. 总表（入选 27 个，另有 8 个因许可或来源问题只学玩法、不用代码，见第 3 节）

| # | 类型 | 仓库 | ★ | 许可 | 最后推送 | 技术与依赖 [实测] | 在线 Demo [实测] | 结论 |
|---|---|---|---|---|---|---|---|---|
| 1 | 三消 | https://github.com/rembound/Match-3-Game-HTML5 | 80 | MIT | 2023-01-13 | 纯 Canvas，单文件 `match3-example.js` 30.7KB；方块是颜色矩形，不用图片；只绑了 `mousedown` | 文章页 rembound.com（200，页内有 `#demo` 锚点） | ★主推底座 |
| 2 | 三消 | https://github.com/xiaozhu188/pixi-game-match3 | 91 | MIT | 2024-10-08 | PixiJS + Spine 骨骼动画 + assetpack 图集，需要构建 | https://xiaozhu188.github.io/pixi-game-match3/（200） | 动效与特效参考 |
| 3 | 三消 | https://github.com/stdio2016/shapeclear-html | 14 | MIT | 2023-03-28 | Phaser + SVG 素材 | https://stdio2016.github.io/shapeclear-html（200） | 特殊块规则参考 |
| 4 | 2048 | https://github.com/gabrielecirulli/2048 | 13400 | MIT | 2024-10-24 | DOM + CSS 动画，JS 约 20KB；`keyboard_input_manager.js` 自带 touch 滑动 | https://play2048.co（200）、https://gabrielecirulli.github.io/2048/（200） | ★主推 |
| 5 | 俄罗斯方块 | https://github.com/jakesgordon/javascript-tetris | 733 | MIT | 2025-06-01 | 单个 `index.html` 17.9KB + texture.jpg；只支持键盘 | https://jakesgordon.com/games/tetris/（200） | ★循环与计时骨架 |
| 6 | 俄罗斯方块 | https://github.com/khivy/wordtris | 15 | MIT | 2022-12-09 | TypeScript，另有排行榜服务端（已停） | https://khivy.github.io/wordtris/（200） | 字块机制参考 |
| 7 | 俄罗斯方块 | https://github.com/Binaryify/vue-tetris | 2774 | MIT | 2025-09-08 | Vue + Vuex，需要构建 | https://binaryify.github.io/vue-tetris/（200） | 视觉参考 |
| 8 | 俄罗斯方块 | https://github.com/AbhishekCode/word-tetris | 34 | Apache-2.0 | 2018-08-01 | Create React App | https://abhishekcode.github.io/word-tetris/（200） | 备选机制（点选成词） |
| 9 | 泡泡龙 | https://github.com/rembound/Bubble-Shooter-HTML5 | 59 | MIT | 2023-10-17 | 纯 Canvas，单文件 35.3KB；用了一张 `bubble-sprites.png`；只绑了鼠标 | 文章页 rembound.com（200，页内 `#demo`） | ★主推底座 |
| 10 | 泡泡龙 | https://github.com/ourcade/coronavirus-pop-phaser | 24 | MIT | 2023-01-07 | Phaser 3 + TypeScript 模板 | ourcade.co 模板页（200） | 结构参考 |
| 11 | 推箱子 | https://github.com/taniarascia/sokoban | 91 | MIT | 2023-07-27 | Canvas，ES module，JS 共约 10KB；键盘方向键和 WASD | https://taniarascia.github.io/sokoban/index.html（200） | 小而清楚的底座 |
| 12 | 推箱子 | https://github.com/shunyue1320/sokoban | 38 | MIT | 2026-06-01 | `game.html` 8.6KB + `mapdata100.js` 57.7KB（100 关） | 无（GitHub Pages 404） | 关卡格式参考 |
| 13 | 连连看 | https://github.com/gd4Ark/linkup | 85 | MIT | 2023-11-02 | 原生 JS 约 20KB（`game.js` 9.4KB），有 0/1/2 拐点判定、死局检测和重排；用 click 事件，触屏可用 | https://4ark.me/linkup（200） | ★主推底座 |
| 14 | 连连看 | https://github.com/yanhaijing/linklink | 37 | MIT | 2018-01-24 | 原生 JS | http://yanhaijing.github.io/linklink/new.html（200） | 备选 |
| 15 | 麻将消除 | https://github.com/teaplz/UMTSolitaire | 0 | MIT | 2026-02-26 | React + Vite；用 Unicode 麻将字形，不用图片；有“Two-Corner”连连看规则和保证可解的洗牌 | https://teaplz.github.io/UMTSolitaire/（200） | 算法参考（星数为 0） |
| 16 | 拼图 | https://github.com/flbulgarelli/headbreaker | 192 | ISC | 2025-05-11 | 零依赖，可选 Konva 渲染。npm 包 3.0.0 在 jsDelivr 上只有 CommonJS 源码 `src/*.js`，没有浏览器 bundle，要用 `cdn.jsdelivr.net/npm/headbreaker@3.0.0/+esm`（200，33KB）；`konva/konva.min.js` 200 | https://flbulgarelli.github.io/headbreaker/（200） | 通过 jsDelivr +esm 或内联引入 |
| 17 | 华容道 | https://github.com/jeantimex/klotski | 51 | MIT | 2026-07-10 | 求解器 `dist/klotski.min.js` 5.7KB；`src/hrd-games.json` 里有 40 个中文命名的经典布局（横刀立马、指挥若定……） | https://jeantimex.github.io/klotski/（200） | ★求解器与关卡 |
| 18 | 华容道 | https://github.com/fflow2023/BanGKlotski | 27 | MIT（仅代码） | 2026-05-16 | 单个 `index.html` 32KB；README 说支持触摸拖拽和 BFS 提示 | https://fflow2023.github.io/BanGKlotski/（200） | 只借代码；素材版权归 BUSHIROAD [原文] |
| 19 | 滑块拼图 | https://github.com/imshubhamsingh/15-puzzle | 203 | MIT | 2024-02-26 | 原生 JS | https://15puzzle.netlify.app（200；API 里的 .com 旧地址是 404） | 备选 |
| 20 | Wordle | https://github.com/antfu/handle | 1439 | MIT | 2025-02-12 | Vue3 + Vite + `pinyin` npm；自带成语库 | https://handle.antfu.me（200） | ★拼音反馈逻辑 |
| 21 | Wordle | https://github.com/AllanChain/chinese-wordle | 21 | BSD-3-Clause | 2023-05-03 | Vue；按声母、韵母给颜色提示 [原文] | https://allanchain.github.io/chinese-wordle/（200） | 规则参考 |
| 22 | 找词 | https://github.com/bunkat/wordfind | 198 | MIT | 2023-07-01 | `wordfind.js` 19KB 不依赖 jQuery；`wordfindgame.js` 9.5KB 依赖 jQuery 并带触摸；填空字母写死在常量 `LETTERS` | 无官方 Demo（bunkat.github.io 404） | 生成器可直接用 |
| 23 | 填字 | https://github.com/MichaelWehar/Crossword-Layout-Generator | 86 | MIT | 2025-04-21 | 原生 JS，输入词表，输出交叉布局 | http://michaelwehar.com/crosswords（200） | 生成器可直接用 |
| 24 | 打字 | https://github.com/stephanecot/typing-of-the-dev | 1 | MIT | 2026-06-28 | Phaser 3.87 放在本地；README 说完全离线、音效程序生成；只支持键盘；`GameScene.js` 86KB | https://stephanecot.github.io/typing-of-the-dev/（200） | ★机制参考（星数低，但最对题） |
| 25 | 打字 | https://github.com/knadh/wordpluck | 53 | MIT | 2023-05-23 | CreateJS（旧版，55KB）+ `main.js` 12KB | https://wordpluck.netlify.app（200；.com 旧地址 404） | 备选 |
| 26 | 数独 | https://github.com/robatron/sudoku.js | 495 | MIT | 2025-12-17 | 27KB，生成器加求解器；9×9 写死（`DIGITS="123456789"`、`ROWS="ABCDEFGHI"`） | htmlpreview 上的 demo（200） | 只借思路，4×4 和 6×6 要自己写 |
| 27 | 找不同 | https://github.com/joe-brothers/differ | 3 | MIT | 2026-07-23 | TypeScript | https://differ.joe-brothers.com/（200） | 太弱，建议自己做 |

---

## 2. 分类型详解

每个类型分五块写：仓库事实、为什么好玩 [推断]、华文怎样写进机制、适合谁、改编可行性。改编一律指**借用算法与机制，重写成 `HW.arcade` 的 spec**（init、update、draw、down/move/up、key），而不是把整个仓库嵌进页面。这样才能单文件、共用 HUD 和生命连击、共用 `g.say` 与 `g.items`。

### 2.1 三消 → 「部首消消乐」

**仓库事实**
- rembound/Match-3-Game-HTML5：MIT，80★，单文件 30.7KB [实测]。函数名 [实测] 包括 `findClusters` / `findMoves` / `resolveClusters` / `removeClusters` / `shiftTiles` / `canSwap` / `swap`，其中 `findMoves` 可以直接拿来做“提示”，也能判断死局。方块颜色写在 `tilecolors` 数组里，没有用图片 [实测]；输入只有 `mousedown` / `mousemove` / `mouseup` [实测]。
- xiaozhu188/pixi-game-match3：MIT，91★，PixiJS + Spine 动画，有 3 篇掘金技术长文（链接在 README 里）[原文]。适合参考消除特效、下落回弹和结算动画的做法，不适合直接移植，因为依赖构建和图集。
- stdio2016/shapeclear-html：MIT。README 写明 4 连出条纹块，T/L 形出包装块，5 连出电击器，两个道具交换还有组合效果 [原文]。可以照这套设计特殊块。

**为什么好玩 [推断]**：交换一下就连锁掉落、连锁爆开，这种“看运气”的瞬间奖励对 8 岁孩子很有吸引力；Candy Crush 类是小学生最熟悉的手机游戏之一。10 岁孩子会去追求 4 连、5 连做出特殊块，有策略空间。

**华文融进机制**
- 棋盘上每块写一个字，字从 `chars` 题库里取。**消除判定是“部首相同”，不是“同一个字”**：河、湖、海、洗排成一线就消。孩子必须读字形去看部首，操作本身就是在练部首。
- 第 1–2 关：同部首的块同色（氵蓝水滴、木绿叶、口黄、扌橙、火红），靠颜色帮一把。第 3 关起颜色去掉，全部换成木纹块，只能看字形。
- P4 的规则切换：第 5 关起改成“同韵母”或“同声调”三连（块上不显示拼音，消掉时才飘出拼音加声调色），练的是读音。
- 特殊块：4 连生成“拼音炸弹”，清掉一整行并把这一行的字依次读出来；5 连生成“部首彩虹”，点一下清掉全盘同部首的字。
- 关卡目标照 Candy Crush 的做法：“20 步内收集 8 个 氵 字”，步数用完算失败，对应 `lives`/`rounds`。收集到的字飞进上方的字篮；结算时每个字配一个 `chars.组词` 词语，并用 `g.say` 读出。
- 数据：部首直接用 `chars` 题库的“部首”字段，**不要自己推断部首**。本年级同部首的字不足 3 个时，那个部首不进棋盘。

**适合谁**：P2 女孩首选（色彩鲜艳，失败代价低）；P4 男孩走韵母、声调规则那条线。

**改编可行性 [推断]**：高。核心逻辑可以照搬 rembound，鼠标事件换成 `down/move/up`，绘制换成圆角块加楷体字，下落和消除动画用 `g.tween` 与 `g.burst`，不需要任何图片。代码量估计 400–600 行。

### 2.2 2048 → 「汉字合体 2048」

**仓库事实**：gabrielecirulli/2048，MIT，13,400★，是 2048 的原版 [实测]。逻辑分在 `game_manager.js`（7.6KB，移动与合并）、`grid.js`、`tile.js` 里，渲染在 `html_actuator.js`（DOM + CSS transform 动画）；输入在 `keyboard_input_manager.js`，已经支持 touchstart/touchmove/touchend 和 MSPointer 滑动 [实测]。

**为什么好玩 [推断]**：一步一滑，规则 5 秒学会；棋盘越来越满，紧张感自然就有了；看到合成出新东西的那一下有“升级”的快感。

**华文融进机制**：把 `tile.value * 2` 的合并条件换成 `recipe(a, b)`，也就是查一张合体表。
- **P2 模式：叠字链**，同样两块相撞升级，最接近原版 2048。木→林→森，人→从→众，口→吕→品，日→昌→晶，火→炎。每条链只有 3 级，胜利条件改成“合出 N 个三叠字”，不是凑到 2048。合体时新字放大发光，`g.say("林，树林")`。
- **P4 模式：会意、形声合体**。部件块在棋盘上滑，**只有能组成真字的两块相撞才合体**：女 + 子 → 好，日 + 月 → 明，氵 + 可 → 河。配方从 `build` 题库（base + 偏旁 → ans）生成，用的是**已经核查过的数据**。合出来的字如果和相邻格的字能组成 `words` 里的词语，就触发“词语连锁”：两块一起发光消失，腾出空间。
- 每走一步生成一个新部件块，棋盘满且无法合体就结束，对应 `g.lose()`。
- 数据风险：叠字链这张表（约 6 条）必须人工整理、人工核对，**不要让 agent 自己编**，“沝”“叒”这类罕见字不要放进去。会意合体一律只用 `build` 题库里已有的组合。

**适合谁**：两人都适合，P2 用叠字链，P4 用合体配方。

**改编可行性 [推断]**：高。合并逻辑集中在 `move()` 里，改动小；滑动输入可以直接借。渲染建议改成 Canvas，统一到 `HW.arcade`，也可以保留 DOM 叠在 `spec.dom` 的 layer 上。估计 300 行左右。

### 2.3 俄罗斯方块 → 「词语方块雨」

**仓库事实**
- jakesgordon/javascript-tetris：MIT，733★，单个 `index.html` 17.9KB [实测]，适合借游戏循环、下落计时和碰撞检测。只有 `keydown` [实测]，README 的 FUTURE 里写着 touch support 还没做 [原文]。
- khivy/wordtris：MIT，“Tetris with words”，README 说手机上能玩 [原文]。
- AbhishekCode/word-tetris：Apache-2.0，字母下落后由玩家**点选**拼成的词来得分 [原文]，是另一种设计。
- Binaryify/vue-tetris：MIT，2,774★，可以参考视觉效果 [实测]。星数更高的 chvin/react-tetris（8,732★）**没有许可证**，不能用，见第 3 节。

**为什么好玩 [推断]**：俄罗斯方块对 10 岁男孩几乎是普适的；速度一关比一关快，加上连锁爆破，挑战性和爽快感都够。

**华文融进机制**（Puyo / Columns 式的两格字块）
- 每次落下一个“两格字块”（竖着或横着，可以旋转），每格一个字。落地后，**横着从左往右读、或竖着从上往下读，只要相邻两字组成 `words` 听写词或 `chars.组词` 里的词语**，这两格就爆开，上方的块塌下来，塌下来又组成新词就算连锁（combo ×2、×3）。
- 下一块预览显示“春 / 天”这样的组合，孩子要想“春”放在哪个字旁边能成词，本质是在练组词。
- 高关卡加入“部件块”：氵落到“可”的左边合成“河”（数据来自 `build` 题库），合成后再参与组词。
- 可选的听写模式：屏幕上方 TTS 读一个词，这个词拼出来才算大爆炸，给 3 倍分。
- 数据：需要一张“合法二字词”白名单（words 加 chars.组词，去重）。棋盘上碰巧拼出的其他真词，只要在白名单里就算奖励，这样不会误伤。

**适合谁**：P4 男孩。P2 可以用降速版，规则改成“两个相同的字相邻就消”。

**改编可行性 [推断]**：中等。循环和碰撞借 jakesgordon 的，成词检测每次落地扫一遍四邻就够；触屏要自己加左右滑、点击旋转、下拉加速。估计 400–500 行。

### 2.4 泡泡龙 → 「同音泡泡龙」

**仓库事实**：rembound/Bubble-Shooter-HTML5，MIT，59★，单文件 35.3KB [实测]。函数 [实测] 包括 `shootBubble` / `snapBubble`（吸附到六边形网格）/ `findCluster` / `findFloatingClusters`（悬空的泡泡掉落）/ `getNeighbors` / `checkGameOver`。只加载了一张 `bubble-sprites.png` [实测]，改成 Canvas 画渐变圆很容易。输入只有鼠标 [实测]。另有 ourcade/coronavirus-pop-phaser（MIT，Phaser 3 模板）可以参考工程结构。

**为什么好玩 [推断]**：瞄准、借墙反弹、一炮打下一大片悬空泡泡，这种“雪崩”画面是泡泡龙最爽的时刻；男孩喜欢练反弹角度，女孩喜欢彩色泡泡。

**华文融进机制**：把“同颜色”换成下面几种规则，泡泡的颜色只做装饰，或在低关当辅助。
- **P2：部首泡泡**。炮台装的是“氵”泡泡，落点周围连通的、含 氵 的字泡泡达到 3 个以上就爆；打偏了就粘在那里，成为障碍。
- **P4：同音同调泡泡**。炮台显示“qíng”，只有读 qíng 的字（晴、情）会被引爆；旁边故意放“请 qǐng”“清 qīng”“青 qīng”做陷阱，**声调不对就不爆**，专门练同音异调。
- **听音模式**（用 `pick` 题库）：炮台是一个 🔊，TTS 读一个词，要打中写着这个词的泡泡；打对了，整串连通的同类泡泡一起爆。
- 悬空掉落照原版：打掉“根”，挂在下面的字全掉下来，每个字 +分，并飘出拼音。
- 打偏 N 次，天花板下降一行，碰到底线就扣一颗心。
- 数据：`chars` 题库有带调拼音，同音干扰字可以用 `g.charPool()`，但它是无调的，**要带调的话需要再做一个带调拼音索引**。

**适合谁**：两人都适合（P2 部首、P4 声调）。

**改编可行性 [推断]**：高。rembound 的网格吸附和连通检测是最难的部分，可以直接借；瞄准改成拖拽（`down/move/up`）加一条虚线轨迹预览。估计 400–500 行。

### 2.5 连连看 / 麻将消除 / 羊了个羊 → 「词语连连看」

**仓库事实**
- gd4Ark/linkup：MIT，85★，原生 JS 约 20KB [实测]。`game.js` 的方法 [实测] 包括 `directlyConnectable` / `onceCorner` / `twiceCorner` / `isConnectable`（0、1、2 个拐点）、`checkDeadlock`（死局检测）、`randomReset`（重排），连连看的全部核心都在。方块用 `<img>` 显示，改成文字就行。
- yanhaijing/linklink：MIT，备选。
- teaplz/UMTSolitaire：MIT，只有 0★，但 README 说它有“Two-Corner”模式（就是连连看规则），也有“保证可解”的洗牌，并且用 Unicode 字形而不是图片 [原文]，可以参考生成算法。
- 羊了个羊（叠层瓦片，7 格托盘，三个一样就消）：最火的 liyupi/yulegeyu（1,830★）**没有许可证**，StreakingMan/solvable-sheep-game（409★）是 **GPL-3.0**，两个都只学玩法，见第 3 节。

**为什么好玩 [推断]**：满屏的块一对一对地清空，进度看得见；倒计时条一直在缩短，自带紧迫感；连得快还有连击，男孩女孩都能上手。

**华文融进机制**（“能不能连”由两块内容决定，路径规则保持原样）
- **P2：字 ↔ 拼音 / 字 ↔ 图**（猫 ↔ māo，猫 ↔ 🐱）。一对连通时画一道闪电线，同时 `g.say("猫")`。
- **P4：组词对**，“春”和“天”能组成 `words` 里的词就能连；也可以是反义词对（大 ↔ 小）。只要组成的词在白名单里就算对，所以不需要保证每个字只有一个搭档。
- 关卡加“重力”（高关消除后方块向左或向下挤），这是 QQ 连连看的经典做法，让画面一直在动 [推断]。
- 倒计时条对应 `lives`，卡住时（死局检测）自动洗牌、扣一点时间；灯泡提示用 `isConnectable` 全盘扫一遍。
- 和已有的“拼音翻翻乐”（翻牌记忆）不一样：连连看的牌一直是亮着的，考的是找搭档加路径判断，有空间推理，不是靠记忆。
- **羊了个羊变体**（第二版可以做）：托盘里凑齐 3 张就消。P2 规则是 3 张相同的字；P4 规则是 3 张同部首，或者 3 张按顺序组成一个三字词。

**适合谁**：两人都适合。

**改编可行性 [推断]**：高。路径算法可以直接借，而且只有几十行；绘制改成 Canvas 块。估计 350 行。

### 2.6 打字 → 「拼音打字打僵尸」（ZType / Typing of the Dead 式）

**仓库事实**
- stephanecot/typing-of-the-dev：MIT，只有 1★，但它就是 Typing of the Dead 的致敬作：僵尸 bug 朝 PROD 服务器前进，打出它们身上的词就能消灭；README 说 100% 离线、没有 npm 依赖、Phaser 放在本地、音效是程序生成的 [原文]。结构 [实测] 是 `GameScene.js` 86KB、`audio.js` 18.7KB、`data/words.js` 41.7KB（按敌人类别分词库）。只支持键盘 [原文]。
- knadh/wordpluck：MIT，53★，CreateJS 做的打字游戏 [实测]，可做备选。
- 不能用的：layyback/zType 虽然标了 MIT，但代码是 Impact 引擎的 baked 构建，类名就叫 `ZType = ig.Game.extend`，引用了原版 media，疑似直接搬运原作 ZType，见第 3 节。

**为什么好玩 [推断]**：敌人一步步逼近、敲一个键就飞出一发子弹，爽快感和紧迫感都很强；对 10 岁男孩尤其有吸引力，还可以比最高分。

**华文融进机制**
- 僵尸或怪兽头上显示一个汉字（楷体），**要打出它的拼音（不带调，ü 打 v）才能开火**。打第一个字母就锁定目标，每打对一个字母飞出一发子弹，打完整个拼音目标爆炸，照原版机制。
- 困难模式：拼音后面加声调数字（qing2），用来区分晴 / 请 / 清。
- Boss 是二字词语，要打完两个字的拼音；血条就是字母数。
- 听写模式：怪兽身上只显示 🔊，TTS 读出来，孩子凭听觉打拼音。
- 打错一个字母：连击清零，目标加速半秒。
- iPad 上画一个大号的屏幕字母键盘（用 `spec.dom` 的 layer 或 Canvas 按键），外接键盘时直接接收 `key`。
- 数据：`chars` 和 `words` 题库里的拼音，去掉声调、ü→v 之后就是输入串，需要一个小工具函数。

**适合谁**：P4 男孩。P2 可以做一个只打声母的简化版，或者直接跳过。

**改编可行性 [推断]**：中等偏高。核心循环（刷怪、锁定、逐字母射击、逼近）不复杂，用 `HW.arcade` 重写约 350 行，不移植 Phaser 代码。和已有的“写字打怪兽”不冲突：那个练手写笔顺，这个练拼音输入。

### 2.7 华容道 / 滑块 → 「华容道拼成语」

**仓库事实**
- jeantimex/klotski：MIT，51★ [实测]。求解器 `dist/klotski.min.js` 只有 5.7KB，`src/hrd-games.json` 有 **40 个中文命名的经典布局**，前两个是“横刀立马”“指挥若定” [实测]。README 给的是 unpkg 地址 [原文]；`https://cdn.jsdelivr.net/npm/klotski/dist/klotski.min.js` 实测也是 200，符合 CDN 白名单。
- fflow2023/BanGKlotski：代码 MIT，单个 `index.html` 32KB，README 说支持触摸拖拽，“提示”按钮会用 BFS 走出最优的下一步 [原文]。但角色素材版权归 BUSHIROAD [原文]，**只能借代码**。
- imshubhamsingh/15-puzzle：MIT，203★，是经典的 15 数字推盘。

**为什么好玩 [推断]**：华容道本身就是“曹操败走华容道”的三国故事，P4 男孩对三国人物接受度高；拖动方块是很直接的触觉操作。

**华文融进机制**
- **拼成语推盘**（P4）：4×4 推盘，每块一个字，打乱后要推回去，使**每一行读出来都是一个成语或四字词**。因为答案是语言结构而不是 1–15 的数字，孩子必须先认出是哪个成语，才知道每个字该去哪里。
- **拼句推盘**（P2）：3×3 推盘，每行一个三字词，或者整盘就是一句短句（用 `order` 题库的词块）。
- **华容道原版加字**：曹操块写“曹操”，关羽、张飞、赵云这些竖块写人名；开局用 TTS 讲一小段华容道故事（旁白），通关时读出这个布局的名字（“横刀立马”）。适合当“故事关”。
- 动起来的办法：步数和计时，方块滑动带回弹；卡住时“军师锦囊”提示，用 jeantimex 的求解器算出下一步并高亮。
- 可解性：乱序不要随机生成，从已完成状态随机走 N 步反推回去，保证可解；步数 N 就是难度。

**适合谁**：P4 男孩为主；P2 做 3×3。

**改编可行性 [推断]**：高。推盘逻辑很简单，求解器可以直接用。缺点是画面偏静，要靠计时和回弹动效补。

### 2.8 推箱子 → 「推箱子造字 / 填句」

**仓库事实**
- taniarascia/sokoban：MIT，91★，Canvas，ES module，JS 共约 10KB [实测]，代码很干净；支持方向键和 WASD [实测]。
- shunyue1320/sokoban：MIT，100 关（`js/mapdata100.js` 57.7KB）[实测]。**这 100 关是不是经典 Sokoban 关卡的转录，没核实**；关卡设计的版权归属不清楚，建议只参考数据格式，不要照搬关卡 [推断]。

**为什么好玩 [推断]**：推箱子是“想一步、走一步”的解谜，适合喜欢动脑的孩子；但节奏偏慢，要加角色动画和合成特效。

**华文融进机制**
- **造字箱**（`build` 题库）：箱子上写部件，把“氵”箱推到“可”箱左边，两个箱子合成一个发光的“河”箱，`g.say("河")`；再把“河”箱推进出口。推错位置（比如把 氵 推到右边）不会合成，箱子会轻轻抖一下。
- **填句箱**（`words` 例句、`order` 题库）：地板上印着“我们去 __ 边玩”，几个箱子分别写“海”“每”“梅”，要把正确的那个推进空格。推进错箱子：地板变红抖动，箱子被弹出来。
- 关卡一定要手工设计，并保证可解，从 5×5 小地图开始，每关只用 1–2 次合成。

**适合谁**：P4 男孩。P2 用很小的地图也可以。

**改编可行性 [推断]**：中等。代码简单，**难在关卡设计**：语言约束加推箱约束都要可解，建议人工出 6–10 关，没有必要做生成器。

### 2.9 拼图 → 「拼字拼图」

**仓库事实**：flbulgarelli/headbreaker，ISC，192★ [实测]。README 说是纯 JS、零依赖，Konva 渲染后端可以换掉 [原文]。README 的快速示例用的是 `flbulgarelli.github.io/headbreaker/js/headbreaker.js`（224KB）[实测]，这个域名不在允许列表里。jsDelivr 上的 npm 3.0.0 包只有 CommonJS 的 `src/*.js`，没有现成的浏览器 bundle [实测]，所以有两个办法：用 `https://cdn.jsdelivr.net/npm/headbreaker@3.0.0/+esm`（实测 200，33KB，ESM 格式，要用 `<script type="module">`），或者把 bundle 内联进页面（ISC 允许，要保留版权声明）。konva 可以从 `cdn.jsdelivr.net/npm/konva/konva.min.js` 取 [实测 200]。

**为什么好玩 [推断]**：拼图对 8 岁女孩吸引力高、挫败感低；拼块“咔哒”吸附的声音和手感是满足感的来源。

**华文融进机制**
- **拼一个大字**：Canvas 画一个楷体大字（加田字格和配图），切成 4–9 块带凹凸的拼图；拼好后叠上 HanziWriter 播一遍笔顺动画，再读出这个字和它的一个组词。孩子在拼的过程中会反复观察字的各个部分。
- **结构拼图**（用 `chars.结构` 字段）：左右结构的字切成左右两块，上下结构的切成上下两块，孩子要知道“氵”在左、“可”在右才拼得上。
- 动起来的办法：拼块从“传送带”上一块块送进来，计时给星级；拼完整幅图画动起来（比如熊猫眨眼）。

**适合谁**：P2 女孩。

**改编可行性 [推断]**：中高。可以直接从 jsDelivr 引入 headbreaker，但它自带渲染和事件循环，和 `HW.arcade` 的单 Canvas 结构要协调（可以放在 `spec.dom` 的 layer 里）。画面偏静，排在第二梯队。

### 2.10 Wordle → 「汉兜：猜听写词」

**仓库事实**
- antfu/handle（汉兜）：MIT，1,439★ [实测]，汉字版 Wordle，猜四字成语，每个字按汉字、声母、韵母、声调分别给颜色反馈。依赖 `pinyin` npm [实测]。README 说答案库 2023 年 2 月之后不再更新 [原文]。
- AllanChain/chinese-wordle（拼成语）：BSD-3，按声母和韵母猜成语，有“声母韵母组合正确”的双下划线提示 [原文]。

**为什么好玩 [推断]**：像侦探推理；但画面是静态的，对 8 岁孩子吸引力有限。

**华文融进机制**：把答案换成孩子自己的二字、三字听写词（`words`），每次猜测按“字对”“声母对”“韵母对”“声调对”分层上色，逼孩子**把拼音拆成声母、韵母、声调三部分来想**，这是 P4 的拼音分析能力。要像游戏，可以加一个“拼音侦探”角色：每猜一次，翻牌动画加机器人逼近，5 次以内猜中就抓到怪盗。

**适合谁**：P4 男孩，适合做每日一题。

**改编可行性 [推断]**：逻辑简单，可以参考 handle 的比较函数。它不是街机，放第二梯队或者做成每日小彩蛋。

### 2.11 找词（Word search）→ 「听音找词」

**仓库事实**：bunkat/wordfind，MIT，198★ [实测]。`wordfind.js` 19KB 不依赖 jQuery [实测]；填空用常量 `LETTERS = 'abcdefghijklmnoprstuvwy'` [实测]，把它换成汉字干扰池就能生成汉字网格（中文字符都在 BMP 区，`split('')` 可以正常切开 [推断]）；`wordfindgame.js` 依赖 jQuery，带触摸拖选 [实测]。**注意**：npm 上叫 `wordfind` 的包是另一个作者（Jochem Stoel，ISC，0.0.1）写的，不是 bunkat 这个 [实测，读 jsDelivr 上的 package.json]，所以不能用 CDN 取，要把 19KB 的 `wordfind.js` 内联，并保留 MIT 声明。

**为什么好玩 [推断]**：像寻宝，手指一划就连成一串，找到时整串发光。

**华文融进机制**
- TTS 读一个 `words` 词（不显示文字），孩子在字网格里横着或竖着划出来（P4 加斜向）。练的是听音加认字。
- **干扰字用形近字或同音字填**（己、已、巳；晴、睛、清），这样不是扫一眼就能找到，要真的认准字。
- 动起来的办法：找到的词字块飞走，上方的字块掉下来补位，网格一直在变；倒计时加连击。

**适合谁**：P2 女孩（听音认字），P4 用斜向加形近干扰。

**改编可行性 [推断]**：高。生成器可以直接用，拖选和绘制用 `HW.arcade` 重写。

### 2.12 填字 → 「词语填字」

**仓库事实**：MichaelWehar/Crossword-Layout-Generator，MIT，86★ [实测]。输入一组答案（可附提示），输出每个答案的 startx、starty 和横竖方向 [原文]。对二字、四字词同样适用（按字符长度算 [推断]）。haoza/egret-crossword 是“成语大挑战”，但**没有许可证**，并且基于 Egret，只能参考玩法。

**华文融进机制**：从 `words` 里选 5–8 个有共用字的词语或成语，自动生成交叉布局，挖掉一部分格子；提示用 TTS 或 `words` 的例句（把目标词挖空），下方给字块让孩子拖进去。

**适合谁**：P4 男孩。**改编可行性 [推断]**：高，但画面静态，放第二梯队。

### 2.13 数独 → 「汉字数独」

**仓库事实**：robatron/sudoku.js，MIT，495★ [实测]，9×9 写死（`DIGITS="123456789"`、`ROWS="ABCDEFGHI"`）[实测]。孩子用的 4×4、6×6 要自己写生成器：拉丁方加行列置换，约 50 行 [推断]。界面可以参考 huaminghuangtw/Web-Sudoku-Puzzle-Game（MIT，26★，demo 200）[实测]。

**华文融进机制**：4×4“四季数独”，每行每列每宫都要有春、夏、秋、冬各一个；进阶版是“部首数独”，格子里是字，规则是每行每列要包含 氵、木、口、火 四个部首各一次，孩子得先认出每个字的部首才能放。

**适合谁**：P2（4×4）。**改编可行性 [推断]**：容易，但是静态，优先级最低。

### 2.14 找不同 → 「形近字找不同」

**仓库事实**：没有像样的仓库。宽松许可里最好的是 joe-brothers/differ（MIT，3★，TS）[实测]；nickangtc/spot-the-difference（9★）没有许可证 [实测]。**建议自己做**，机制很简单。

**华文融进机制**：左右两块 6×6 字盘，字在轻轻上下浮动；有 1–3 格是形近字替换（己 / 已、未 / 末、人 / 入、土 / 士、大 / 太 / 犬），限时点出来。形近字对直接用 `typo` 题库里的 bad / good 对（已核查），不另编。

**适合谁**：两人都适合。**注意**：和已有的“打地鼠找错字”都在练错别字，优先级放低，可以当奖励关。

---

## 3. 许可或来源有问题：只学玩法，不要拿代码

| 仓库 | ★ | 问题 [实测，另注明的除外] | 可以怎么用 |
|---|---|---|---|
| https://github.com/chvin/react-tetris | 8732 | API 返回 license 为空，**没有许可证**，默认保留全部权利 | 只看玩法 |
| https://github.com/liyupi/yulegeyu | 1830 | 没有许可证（羊了个羊纯前端版） | 只看玩法 |
| https://github.com/StreakingMan/solvable-sheep-game | 409 | GPL-3.0；照抄的话整站都要按 GPL 发布 | 看“保证可解”的思路 |
| https://github.com/Hextris/hextris | 2437 | API 显示 NOASSERTION，LICENSE 文件正文是 GNU GPL v3 | 只看玩法 |
| https://github.com/layyback/zType | 3 | 标了 MIT，但代码是 Impact 引擎的 baked 构建，`ZType = ig.Game.extend`，引用原版 media 路径 → **疑似搬运商业原作 ZType，MIT 声明不可信** [推断] | 不用 |
| https://github.com/goshgarhasanov/marble-shooter | 0 | 没有许可证。README 说所有图形、音效、音乐都在运行时合成，零素材文件 [原文]，技术路线和我们的约束完全一致，祖玛玩法也很“会动” | 只读它的 `docs/TECHNICAL.md` 学思路 |
| https://github.com/yyx990803/vue-wordle | 600 | 没有许可证 | 不用 |
| https://github.com/berkerol/typer | 38 | GPL-3.0（塔防式打字） | 只看玩法 |

另外，AndroidWithRossyn/Android-zumbla（祖玛，Apache-2.0）的 assets 里有 1.2MB 的 `phaser.js`、300KB 的 `game.js` 和成套图集 [实测]，看起来像是把一款商业 HTML5 游戏套进安卓壳 [推断]，不建议碰。

---

## 4. 对 `HW.arcade` 的共性改编要点 [推断]

1. **规则函数化**：每个消除类游戏的核心只有一个判定函数，`match(a, b)` 或 `group([...])`，返回能不能消 / 能不能合。同部首、同音同调、字↔拼音、能组词、能合体，都由题库字段生成。换年级、换难度只是换规则，引擎不变。
2. **零图片**：原仓库里的图片（泡泡精灵、连连看 img、三消图集）全部换成 Canvas 圆角块或渐变圆加楷体字，可以沿用 SPEC_ARCADE §2 的视觉方向（热带岛、粗描边、3D 按钮）。这样也满足“运行时不 fetch 外部资源”的约束。
3. **输入统一**：rembound 的两个游戏和 jakesgordon 的俄罗斯方块都只有鼠标或键盘 [实测]，改编时一律接 `down/move/up/key`。2048 的滑动手势要重写成 `down/up` 之间的位移判定。
4. **会动**：静态解谜（推箱子、华容道、数独、填字、Wordle）必须加至少一种持续运动（倒计时条、逼近的敌人、下落补位、浮动字块），否则会重蹈 1.0 的覆辙（见 SPEC_ARCADE §0）。
5. **朗读时机**：消除时可以 `g.say` 读字，但三消、连锁的消除频率很高，建议只在“连锁结束”或“特殊块触发”时读，避免 TTS 排队刷屏。
6. **许可声明**：从 MIT / ISC / BSD / Apache 仓库复制了代码的，要把原版权声明放进项目的 `licenses/`。只借思路、自己重写的不需要，但建议注明“玩法参考”。
7. **数据只用已核查的题库**：部首用 `chars.部首`，合体用 `build`，形近字用 `typo`，词语白名单用 `words` 加 `chars.组词`。唯一需要新增的人工数据是 2048 的叠字链（约 6 条）和带调同音字索引，**两者都要主线程人工核对**。

---

## 5. 搜索记录（可复现）

用的命令是 `gh search repos "<关键词>" --sort stars --limit 20 [--language=...]`。search API 每分钟 30 次，而且和并行的其他分支共用额度，所以我写了一个自动等待额度重置的脚本分批跑。

- 英文：`match3 game javascript`、`match three game html5 canvas`、`bejeweled clone javascript`、`match3`、`bejeweled`、`topic:match-3`、`topic:match3-game`、`2048 game --language=JavaScript`、`topic:2048-game`、`tetris --language=JavaScript`、`tetris canvas html5`、`topic:tetris-game --language=JavaScript`、`bubble shooter --language=JavaScript`、`bubble shooter html5`、`topic:bubble-shooter`、`zuma --language=JavaScript`、`marble shooter`、`sokoban --language=JavaScript`、`sokoban html5 game`、`topic:sokoban-game`、`mahjong solitaire --language=JavaScript`、`onet connect game javascript`、`shisen-sho`、`lianliankan`、`jigsaw puzzle --language=JavaScript`、`sliding puzzle --language=JavaScript`、`klotski`、`klotski javascript`、`spot the difference game`、`spot difference --language=JavaScript`、`wordle clone --language=JavaScript`、`wordle --language=TypeScript`、`word search puzzle --language=JavaScript`、`topic:word-search`、`crossword --language=JavaScript`、`boggle --language=JavaScript`、`word connect game`、`wordscapes`、`wordtris`、`word tetris`、`typing game --language=JavaScript`、`typing game zombie`、`topic:typing-game`、`ztype`、`typing defense`、`sudoku --language=JavaScript`、`topic:sudoku-game --language=JavaScript`、`topic:memory-game --language=JavaScript`、`hanzi-writer`、`chinese characters game`、`hanzi game`、`pinyin game`、`chinese learning game kids`、`kids educational game html5`、`phaser puzzle game`、`html5 puzzle games collection`、`tile match triple`、`2048 chinese`
- 中文：`消消乐`、`连连看 --language=JavaScript`、`华容道`、`推箱子 --language=JavaScript`、`俄罗斯方块 --language=JavaScript`、`泡泡龙`、`打字游戏`、`成语 游戏`、`汉字 游戏`、`拼音 游戏`、`成语接龙`、`汉字 wordle`、`成语 填字`、`汉字 拼图`、`汉字 消除`、`识字 游戏`、`羊了个羊`
- 值得记下的空结果和噪音 [实测]：
  - 多词英文查询要求所有词都命中，`match3 game javascript`、`bejeweled clone javascript`、`onet connect game javascript`、`klotski javascript`、`chinese learning game kids`、`kids educational game html5`、`html5 puzzle games collection` 都是 0 条。
  - `汉字 消除` 0 条。
  - 纯中文短词（华容道、泡泡龙、打字游戏、消消乐）排在前面的是和游戏无关的高星仓库（书单、政治宣传库等），要靠加 `--language` 或换英文词过滤。
  - 专门做“儿童识字、拼音”的网页游戏仓库基本都是 0–3★、没有许可证，没有能直接借的底座。
- 结论：**“华文 + 益智”的现成仓库几乎没有**，要走“成熟的通用游戏机制仓库 + 我们自己的华文判定规则”这条路。
