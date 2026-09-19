# gh_edu 核验报告：教育、语言、中文类（对抗式核验）

- 核验日期：2026-09-18。星数和日期都是当天的快照。
- 核验对象：`research/gh_edu.md` 里的 19 个候选仓库，另附 6 个辅助数据仓库。
- 证据标签
  - **【实测】**：本次亲手做过的核查，包括：
    - `gh api repos/OWNER/REPO`、`/license`、`/pages`、`/readme` 和 `git/trees`，以及 `contents` 源码 grep
    - 用 `curl -L` 查首页和主 JS/CSS 资源的状态码与字节数
    - 用浏览器面板实开了 3 个 demo（theajack/type、kanjiGame、kana-game）
  - **【来源原文】**：README 或源码里的原话（这里是转述），每条都注明文件。
  - **【推断】**：我自己的判断，没有实测。
- 对照的站点现状【实测，只读】：
  - `SPEC_ARCADE.md`、`parts/15_arcade.js`、`parts/10_core.js`、`content/*.json`。
  - 每个年级 words 50、chars 30、build 15、typo 15、pick 20 条。
  - 引擎已有：三星和最佳星数（`ctx.mem 'arc'`）、徽章（如“满分”）、`g.charPool()`（ü 写作 v）、`g.similarChars()`（只按读音，不懂字形）、`ctx.pick` 优先出没见过的题、`ctx.review` 错题重练。
  - 另有 `vendor/package/` 共 9580 个字的 HanziWriter 数据，构建期内嵌。
  - 没有任何双人模式（grep “双人/versus” 无结果）。

---

## 0. 结论先行

1. **19 个候选全部真实存在，都没有归档（archived=false），也都不是 fork。星数和 push 日期与原笔记基本一致**：qwerty-learner 从 23168 变成 23169，其余不变。没有发现编造的仓库。
2. **删 2 个**，原因都是“不合格”，不是编造：
   - `xinyzhang9/flyflower` 根本不是游戏，是查诗词的工具。
   - `jrainlau/draw-something` 没有 demo，必须跑 node WebSocket 服务，本质是一篇教程。
3. **换 1 个**：`sheleoni/icecream-kana-game` 没有许可文件，但同作者的前身 `sheleoni/hiragana-icecream` 是 **MIT**，机制相同，代码可以直接参考。
4. **纠正 11 处事实错误**，最重要的几处：
   - kanjiGame **有 demo**（原笔记写“无”）。
   - kana-game 的 README 自称 MIT，但**仓库里没有 LICENSE 文件**，按“无许可”处理。
   - theajack/type 自带的词表里有“小老婆、不要脸、贱骨头、糖尿病”这类词，**词表绝对不能用**。
   - hanzi-stroke-games 本身就是**4 选 1 题卡**，“魔法感”是笔记自己加的。
   - Antura 的“三星评分”**站点引擎里已经有了**，不算新机制。
   - hanzi-study 的离线数据方案**站点已经实现了**（vendor 9580 字加构建期内嵌），借鉴价值归零。
5. **按家长的标准（“会动的、像游戏一样”，SPEC_ARCADE 的“静音、不看字，只看 3 秒画面也能认出是游戏”）重排之后**，本分支真正值得做的是 5 个：
   1. **拼音星际战机**（theajack/type 加 TypingNinja 的调参）
   2. **兄妹拔河抢字**（kanjiGame 的对战机制）
   3. **部件方块**（word-tetris）
   4. **形旁/声调分拣落字**（kana-game，但必须和已有的“赛车选道”拉开差异）
   5. **词语三消**（hanzi-match-game 的重力改造）
6. **降级为低或只做元层**：蜂巢、汉兜 Wordle、飞花令炸弹、闪读、FSRS。原因是这几个都是静态谜题，或者太容易变成“答题后放动画”，也就是题卡换皮。

---

## 1. 核验总表

| # | 仓库 | ★【实测】 | 许可【实测】 | 最近 push | demo【实测】 | 真能在浏览器玩？ | 代码处置 | 推荐度 |
|---|---|---|---|---|---|---|---|---|
| 1 | https://github.com/theajack/type | 99 | MIT（有 LICENSE） | 2023-05-28 | https://theajack.github.io/type/ 200；浏览器实开能玩 | 是 | 可复用代码（**词表除外**） | 强推 |
| 2 | https://github.com/pinkrec6/kanjiGame | 0 | 无（`/license` 404） | 2026-07-07 | https://pinkrec6.github.io/kanjiGame/ 200，Pages 状态 built，实开了对战界面 | 是 | 只借鉴玩法 | 强推 |
| 3 | https://github.com/osteele/kana-game | 2 | 无 LICENSE 文件（README 自称 MIT，`/license` 404） | 2026-08-09 | https://kana-game.underconstruction.fun 200，实开 Flow 模式 | 是 | 只借鉴玩法 | 推荐（须区分赛车） |
| 4 | https://github.com/AbhishekCode/word-tetris | 34 | Apache-2.0 | 2018-08-01 | https://abhishekcode.github.io/word-tetris/ 200，主 JS 3.7MB 200 | 是 | 可复用代码（附 Apache 声明） | 推荐 |
| 5 | https://github.com/lapsea/hanzi-match-game | 16 | 无（404） | 2026-08-20 | https://hanzi-match.pages.dev/ 200，资源 200 | 是（静态） | 只借鉴玩法 | 中 |
| 6 | https://github.com/Horsetoast/TypingNinja | 10 | MIT | 2022-12-07 | https://horsetoast.github.io/TypingNinja/ 200，资源 200 | 是 | 可复用代码 | 中（并入 #1） |
| 7 | https://github.com/sheleoni/hiragana-icecream （**替换** icecream-kana-game） | 1 | **MIT** | 2023-12-23 | https://hiragana-icecream.sheleoni.com/ 200 | 是（本体是题卡） | 可复用代码 | 中（元层，P2） |
| 8 | https://github.com/vgwb/Antura | 123 | API 显示 NOASSERTION；LICENSE.md：代码 BSD-2，素材 CC-BY-4.0 | 2026-09-18 | https://antura.org 200（是文档站，不能玩） | 否（Unity 6） | 只借鉴玩法（C# 搬不动） | 中低 |
| 9 | https://github.com/kkjusdoit/hanzi-stroke-games | 1 | 无（404） | 2026-07-21 | 无（Pages 404） | 本地静态可跑；形态是 4 选 1 题卡 | 只借鉴玩法 | 中低 |
| 10 | https://github.com/ConorSheehan1/spelling-bee | 86 | MIT | 2026-05-12 | https://spelling-bee-free.pages.dev 200 | 是（静态谜题） | 可复用代码 | 低 |
| 11 | https://github.com/antfu/handle | 1439 | MIT | 2025-02-12 | https://handle.antfu.me 200 | 是（静态谜题） | 可复用代码（注明出处） | 低 |
| 12 | https://github.com/AllanChain/chinese-wordle | 21 | BSD-3-Clause | 2023-05-03 | https://allanchain.github.io/chinese-wordle/ 200 | 是（静态谜题） | 可复用代码（保留声明） | 低（并入 #11） |
| 13 | https://github.com/gcompris/GCompris-qt | 262 | API 无（404）；README 写 AGPL v3 | 2026-09-18 | https://gcompris.net 200（官网，要安装） | 否（Qt） | 只借鉴玩法 | 低 |
| 14 | https://github.com/RealKai42/qwerty-learner | 23169 | GPL-3.0 | 2026-09-08 | https://qwerty.kaiyi.cool/ 200 | 不是游戏 | 只借鉴规则 | 低 |
| 15 | https://github.com/open-spaced-repetition/ts-fsrs | 792 | MIT | 2026-09-18 | https://open-spaced-repetition.github.io/ts-fsrs/ 200 | 库 | 可复用代码 | 低 |
| 16 | https://github.com/theajack/cnchar | 3095 | MIT | 2026-08-02 | https://theajack.github.io/cnchar 200 | 库 | 构建期可用 | 开发用 |
| 17 | https://github.com/dhjz/hanzi-study | 225 | MIT | 2026-09-10 | https://dhjz.github.io/hanzi-study/ 200（跳转到 199311.xyz） | 是（题卡） | 可复用，但站点已不需要 | 低 |
| 删 | https://github.com/xinyzhang9/flyflower | 12 | GPL-3.0 | 2017-03-17 | 200 | **不是游戏** | — | 删除 |
| 删 | https://github.com/jrainlau/draw-something | 269 | MIT | 2017-02-09 | 无（Pages 404） | **否**（要 node ws 服务） | — | 删除 |
| 换 | https://github.com/sheleoni/icecream-kana-game | 1 | 无（404） | 2023-12-29 | https://icecream.sheleoni.com/ 200 | 是 | 被 #7 替换 | — |

辅助数据仓库【实测 gh api】：

| 仓库 | ★ | 许可 | 最近 push |
|---|---|---|---|
| https://github.com/howl-anderson/hanzi_chaizi | 429 | Apache-2.0 | 2025-12-29 |
| https://github.com/pwxcoo/chinese-xinhua | 11683 | MIT | 2023-12-26 |
| https://github.com/crazywhalecc/idiom-database | 163 | MIT | 2021-02-10 |
| https://github.com/chanind/hanzi-writer-data | 750 | API 显示无；README 写 Arphic Public License（站点 `licenses/` 已有 ARPHICPL） | 2024-04-05 |
| https://github.com/skishore/makemeahanzi | 2678 | NOASSERTION | 2026-03-08 |

jsdelivr 实测：
- `ts-fsrs@5.4.2/dist/index.umd.js`：72,009 B，全局名 `FSRS`
- `cnchar@3.2.6/cnchar.min.js`：77,247 B
- `cnchar-radical@3.2.6`：34,020 B
- `cnchar-words@3.2.6`：150,903 B

以上都返回 200。

---

## 2. 逐条纠错

原笔记里的说法先列在前面，箭头后面是核验结果和证据。

1. **theajack/type 的“词语敌舰”** → 部分正确。
   - 【来源原文 `src/object/enemy.js`】敌人按体型分 4 类：小飞机是单字（一串 129 个字），另外三类依次是二字词、三字词、四字成语（大飞船）。
   - 拼音用的是 `words.spell('low')`，即**无调小写**；血量 `this.hp = this.pinyin.length`；护盾是 `player.js` 里的 `protect = 3`；手机键盘由 `J.isMobile()` 控制，这几处都核实了。
   - **新发现【实测源码】**：内置词表夹着“小老婆”“不要脸”“贱骨头”“糖尿病”“卷铺盖”等**不适合儿童**的词，**一个词都不能复用**。
   - 【实测浏览器】demo 能跑，敌舰带着“踏实、温暖、优美、独树一帜”等词飞向玩家。在窄视口里不输入的话，大约 5 秒就“游戏失败”，对 8–10 岁太快。
   - 其他：demo 的 JS 来自 `cdn.jsdelivr.net/gh/…`（不是 /npm/ 路径），还带 cnzz 统计；敌舰是 PNG 精灵图，要用得先转 data URI，或者用 Canvas 重画。
2. **kanjiGame“没有 demo”** → **错**。
   - 【实测】`gh api repos/pinkrec6/kanjiGame/pages` 返回 `https://pinkrec6.github.io/kanjiGame/ built`，页面 200，所有 js/css 也是 200。浏览器里实开了“かるた たいせん”：左右两块面板（ひだりのひと / みぎのひと），共用一张读札（“?ども こども”），每边 4 张汉字卡。
   - 【来源原文 `js/app.js`】点错后 `lockout` 为 **1500ms**；输入全部用 `pointerdown`，天然支持两人同时按；先拿 5 张的赢。
   - GitHub 仓库描述写的是“小1・小2 の漢字 240 字”，但 README 和页面都写“小1〜小3 440 字”，描述是旧的。
   - “兄弟姐妹”这个说法不准，原文是“親子で遊べる”和“ふたり用”。
3. **kana-game 的许可“无许可文件”** → 结论对，但原笔记漏了一个关键矛盾。
   - README 末尾写着“available under the MIT License (LICENSE)”，可是仓库文件树里**没有 LICENSE**，`/license` 返回 404。
   - 保守处理：只借鉴玩法。要复用代码，先给作者开 issue，请他补 LICENSE。
   - 技术栈也要更正：不只是“TypeScript + Bun”，而是 React 19 + Vite + Tailwind + Zustand（package.json），Bun 只用来跑脚本。
   - 【实测浏览器】Flow 模式底部是 **5 列**（a/u/o/n/e），另有计时、对错计数、1/10 进度。
4. **TypingNinja“输入 ai4 让它爆炸，打击感强”** → 要补两点。
   - 【来源原文 `app/classes/Game.js`、`Word.js`】输入方式是**文本框加回车**，不是逐键反馈。匹配时**汉字本身也算对**（`string === this.data['si']`），用中文输入法可以绕过拼音。带调拼音必须完全一致，轻声写 5（例如 `ba4ba5`）。
   - 真正值得拿的是 `app/config.js` 里的难度参数。waiguoren 档：出词间隔 5000→1500ms，存活 22→15s，每关 25 词，6 条命。
   - 精灵图 `mc.png` 有 920KB。
5. **hanzi-stroke-games “37KB”、“汉字变身带来魔法感”（标成【原文】）** → 两处都要更正。
   - 37KB 是 GitHub 的 `size` 字段（git 压缩后的体积）。实际文件是 `app.js` 18.9KB 加 `hanzi-data.js` 60KB，一共约 91KB。
   - 【来源原文 `app.js`】8 种模式**每种只有 6 道写死的 4 选 1 题**，例如 `{ base:"木", answer:"本", choices:["本","仗","叭","央"] }`。这正是 1.0 被批评的题卡形态。“魔法感”和“拖一笔变字”都是笔记自己的【推断】，不是原作的内容。
6. **Antura 的“三星评分统一复玩动机”** → 机制描述对，但**不是新东西**。
   - 【实测】站点引擎的 `g.win()` 已经有星数，`ctx.mem 'arc'` 记最佳星数，`10_core.js` 还有“满分”徽章。
   - 【来源原文 `LICENSE.md`】代码 BSD-2-Clause，内容 CC-BY-4.0。
   - 【来源原文 `docs/en/content/language-minigames/*.md`】核实了几条：FastCrowd 难度越高“More frequent Antura appearances”；Scanner 的“Belt speed increases”和“Living letters face away”；MakeFriends 是“Recognize a common letter sound”。
7. **GCompris“API 未识别”** → 更准确地说，`/license` 返回 **404**，不是 NOASSERTION。README 原文写 AGPL v3，内部代码 GPL v3+，并且“does not accept any contribution made using AI”。readingh、gletters、wordsgame、alphabet-sequence 四个活动的 `ActivityInfo.qml` 描述都核实了。
8. **icecream-kana-game 只能学机制** → 可以升级。同作者的前身 `sheleoni/hiragana-icecream` 是 **MIT**（`/license` 返回 MIT），用 React + Vite、没有登录，文件有 `Game.jsx`、`iceCreamStackData.js`、`isOnStreak.js`，可以直接参考代码。
9. **flyflower “两人轮流说诗句，谁接不上谁输”（标成【原文】）** → **误读**。
   - 【实测 demo 源码】页面 meta 原文是“可以查阅收藏诗词名句”。界面只有一个输入框和搜索、收藏、历史三个按钮，输入一个字，返回一句随机诗句。没有轮次，没有判定，也没有双人。
   - “两人轮流”只是 README 对**传统飞花令**的介绍。这个仓库不是游戏，**删除**。“词语炸弹接力”这个创意本身不依赖它（见 §4）。
10. **draw-something 保留，并标“能（但架构要改成同屏）”** → **删除**。
    - 没有 Pages（404），README 要求 `node ws-server.js`，实际上是一篇 WebSocket 教程。改成同屏版之后，它唯一有价值的部分（同步）也用不上了，剩下的“画板加计时”不需要任何仓库。
    - 另外，华文知识只出现在“猜”的那一端，画的一方完全不用华文（见 §4）。
11. **hanzi-study “离线数据方案可抄”** → 源码属实，价值已经归零。
    - 【来源原文】`js/utils.js` 用 `createElement('script')` 加载 `dataWriter.js`（884,036 B），配合 `charDataLoader`；`js/index.js:62` 按需加载 `dataWriter1.js`（2,058,100 B）。
    - 但【实测】站点早就有 `vendor/package/`（9580 个字的 JSON），由 `build.py --vendor-dir` 在构建期只内嵌用得到的字，比它的方案更省。
12. 其余核实无误：
    - handle：`src/logic/utils.ts` 4801 B，导出 parseChar、parseWord、testAnswer；README 原文“答案库至 2023 年 2 月 28 日为止将不再更新”。
    - chinese-wordle：双下划线、渐进提示、zhi 和 ji 的 i 按同一个韵母处理。
    - spelling-bee：Hive.vue 6063 B，store.ts 8593 B，等级从 Beginner 到 Genius，有昨日答案。
    - word-tetris：Game.js 15840 B，**横排竖排都判定，反向拼出的单词也算**，停手后自动校验。
    - hanzi-match-game：6×6 共 36 字，3 级 15 关，“换个顺序试试～”。
    - qwerty-learner：打错整词重打，章节结束后可以默写。
    - ts-fsrs：FSRS v6，`createEmptyCard`、`fsrs().next(card, now, Rating.Good)`。
    - cnchar-draw：`hanzi-writer.js` 第 2515 行附近用 `XMLHttpRequest` 取 `getResourceBase()+字+'.json'`。

---

## 3. 对“华文融合创意”的对抗式挑战

### 3.1 判据

我用 4 个判据，前两个来自 SPEC_ARCADE 和家长原话：

- **A. 静音 3 秒测试**：关掉声音、不看题目文字，只看画面 3 秒，能不能认出这是游戏？
- **B. 乱按测试**：孩子不动脑、随便乱按，会不会很快输？不会的话，华文知识就不是必需的。
- **C. 知识粒度**：每个操作本身是不是一个知识单位（一个字母、一个声调、一个部件）？还是整轮只有一道选择题，答完放一段动画，也就是“知识当门票”式的题卡换皮？
- **D. 有没有捷径**：能不能不用目标能力也赢？比如卡片上带拼音就只需对拼音、开着输入法就能直接打汉字、看颜色规律就能猜。

### 3.2 逐个评估

| 原创意 | A 会动 | B 防乱按 | C 知识即操作 | D 捷径漏洞 | 判定 | 更好的融合方式 |
|---|---|---|---|---|---|---|
| 拼音星际战机 | 通过 | 通过（打错字母不发子弹） | **强**：每个字母就是一颗子弹 | ①TypingNinja 那套“汉字也算对”要删掉；②原版不打声调，笔记加的声调护盾能补上这个漏洞；③P2 的“声调炮台”只有 4 个按钮，本质是 4 选 1，**会变成题卡换皮** | 保留并改良 | 见 §4-1。P2 改成“声母、韵母、声调”三段拼装炮，练的是真正的拼读 |
| 抢字卡·兄妹对战 | 勉强（原作是静态卡片） | 通过（源码里点错锁 1.5 秒） | 中：每轮一次识字判断，但两人抢和计时让它成了真游戏（歌留多本来就是游戏） | **P2 那侧卡片带拼音是捷径**：只要对拼音就能赢，完全绕过识字 | 保留并改良 | 见 §4-2。拿掉拼音，用“干扰项的难度”和“拔河让分”来平衡 |
| 落字归位 | 通过 | 通过 | 强：分类本身就是知识（声调、形旁的意义） | 小 | 保留，但**和已有的“赛车选道”机制几乎一样**（都是移进正确车道） | 见 §4-4。车道固定成整关不变的类别，连续分拣，练的是“自动化”，而不是每题换一组选项 |
| 部件方块 | 通过 | **不通过**（原作乱点相邻格不受惩罚） | 强：部件加位置就是字形结构知识 | 半包围、全包围结构（问=门+口）没法用“相邻”表达 | 保留并改良 | 见 §4-3。点错就把两块变成石块（俄罗斯方块式垃圾行），只做左右和上下结构 |
| 词语消消乐 | 通过（有重力和连锁） | 中 | 中 | **连锁是随机的**：不懂词也能靠运气连消拿分 | 保留，中 | 星级只算玩家主动组成的词，连锁只给金币；无效交换扣步数 |
| 蜂巢组字/组词 | **不通过**（静态谜题） | **不通过**：外圈只有 6 格，全点一遍就能拿到所有答案 | 中 | 穷举 | 降级 | 见 §4-6 |
| 汉兜 Wordle | **不通过**（静态） | 通过 | 强（拆声母、韵母、声调） | iPad 上要输入整词，就得开中文输入法，门槛高；词库每级只有 50 个，太小 | 降级（低） | 只给 P4 当周末彩蛋，用候选键盘点字，不要求打字 |
| 一笔变字魔法 | 中（拖笔画有动画） | 中 | 强（字形敏感度） | 原作就是 4 选 1 题卡 | 中低 | 可以改成“拖一笔到正确位置”的物理操作，但“加一笔”配对表要人工整理，而且和“写字打怪兽”都在写这一侧，重叠 |
| 捣蛋狗干扰层 | 通过 | 不相关 | **不相关**：只加笑点，不加华文 | — | 中低，可选 | 小狗叼走的是“字卡”，孩子要把字送回句子里的正确位置才算赶走它，这样干扰本身也变成一道字词操作 |
| 冰淇淋塔收集 | 不适用（元层） | 不适用 | 不相关（只是动机） | — | 中（P2） | 用 hiragana-icecream（MIT）的“连对 3 次水位满”规则，挂在“每个字”上；站点已经有徽章系统，扩展就行 |
| FSRS 出题调度 | 不适用 | 不适用 | 不适用 | “一次击中算 Good”这种折算噪声很大（4 选 1 猜对也算击中） | **降级（低）** | 每个年级只有约 80 个字和词，`ctx.pick`（优先出没见过的）加 `ctx.review`（错题）已经覆盖了。真要做就用 30 行的 Leitner 五格箱，不必引入 72KB 的 FSRS |
| 飞花令·词语炸弹 | 通过（引线、爆炸） | P2 点选版不通过 | P2 点选版就是 4 选 1 题卡；P4 口说版依赖 ASR，iPad Safari 识别率没实测 | — | 降级（低），且**没有仓库支撑** | 只做 P4 口说版，并且先实测 ASR |
| 同屏你画我猜 | 中 | — | **画的一方不用华文** | — | 删除 | — |
| 词语流星雨（readingh 闪读） | 通过 | — | **不通过**：飞完再问“刚才有没有 X”，是标准的“动画加事后问答” | — | 降级 | 改成“飞过的时候就点中目标词”（边扫边打），知识要用在运动过程中，而不是运动结束后 |

一句话总结：**好的融合是“知识是操作本身”，比如一个字母一颗子弹、一个部件一次合成、一个类别一条车道；坏的融合是“知识是门票”，即先答题、再播动画。** 原笔记的 12 个创意里，大约三分之一属于后一种，或者带明显的捷径。

---

## 4. 本分支最值得做进华文小岛的 5 个（改良版）

### 4-1 拼音星际战机（P4 主力；P2 用拼装炮版）【推断】
- **借鉴**：theajack/type（MIT，结构可以参考，**词表一个也不用**）和 TypingNinja（MIT，拿它的难度参数）。
- **核心循环**：
  - 敌舰只写汉字，来自 words 和 chars。
  - 打出拼音首字母就**锁定**首字母相同的那艘（ZType 式）。孩子得先扫一遍屏幕，判断哪个字是这个声母开头。
  - 之后每打对一个字母发一颗子弹，**打完字母还要按 1–4（轻声按 5）破声调护盾**。
  - 声调打错时，护盾把子弹反弹回来。这是游戏世界里的后果，不是弹一个“✗”。
- **同音双胞胎关（P4）**：同一波里同时出现“晴 qíng”和“请 qǐng”，拼音字母完全相同，只能靠声调决定哪一艘爆炸。这样一来，**不懂声调就赢不了**。
- **P2 拼装炮（iPad）**：屏幕键盘换成三段选择器：声母、韵母、声调。整体认读音节（zhi chi shi ri zi ci si yi wu yu 等）作为整块放在韵母区，**不拆开**。chinese-wordle 那种“zhi 的 i 等于 ji 的 i”的规则不要抄，它和小学拼音教学不一致。
- **防捷径**：
  - 输入只认 a–z 加数字，**不接受汉字**，这样输入法就用不上。
  - ü 用 v 输入，和引擎 `charPool()` 的约定一致。
  - 打错字母时只重打这个音节，不重打整个词，因为 qwerty-learner 的“整词重打”对 8–10 岁太严。
- **难度**：从 TypingNinja 的 waiguoren 档起步（出词间隔 5s→1.5s，存活 22s→15s）。theajack 原版对孩子太快，实测窄屏约 5 秒就撞机。
- **和已有游戏的重叠**：“写字打怪兽”也是“输入对一单位就发一炮，敌人逼近”，循环很像，但练的技能不同（笔顺对拼音）。要拉开区别：打怪兽是同屏一只，这里是同屏多目标，要选目标。

### 4-2 兄妹拔河抢字（两人同屏，站点第一个双人游戏）【推断】
- **借鉴**：kanjiGame（无许可，只借鉴玩法）。源码核实过的几条规则直接用：`pointerdown` 支持多点触控，点错锁 1.5 秒，先到 5 分的赢。
- **改良**：
  1. 中间加一根**拔河绳**。每拍对一次，绳子往自己这边拉一格，字卡飞进自己的篮子。这样就有持续的运动，能通过静音 3 秒测试。
  2. **拿掉 P2 卡片上的拼音**，因为它是捷径。改用两种方式让分：
     - 干扰项的难度：P2 那侧 4 张，干扰字读音和字形都远；P4 那侧 8 张，干扰字是同音字，用 `similarChars` 生成。
     - 拔河本身：P2 拍对一次拉两格。
  3. 出题来源轮换：一轮从 P2 题库出，一轮从 P4 题库出，两人都能练到自己年级的内容。
  4. iPad 横放时，一方的面板旋转 180°，两人面对面坐。**必须在真 iPad Safari 上实测两人同时按**。
- **题库**：pick、words、chars.words。

### 4-3 部件方块（P4；P2 用慢速、少部件版）【推断】
- **借鉴**：word-tetris（Apache-2.0，可以参考代码，附声明），在 HW.arcade 上用 Canvas 重写。
- **数据正好对得上**：站点的 build 数据是按**声旁家族**组织的【实测】：
  - P2：青+日=晴、青+讠=请、包+饣=饱、包+足=跑
  - P4：采+彡=彩、采+艹=菜、采+足=踩、艮+木=根、艮+钅=银
  
  掉下来的是声旁块和形旁块。**位置本身就是考点**：“彡”要在“采”的右边才是“彩”，“足”要在左边才是“踩”，“艹”要在上面才是“菜”。word-tetris 本来就分横排和竖排判定，正好对应左右结构和上下结构。
- **防乱按**：点两块不能合成字（或者位置不对）时，这两块就**变成石块**，堆高压力随之增加。这是俄罗斯方块本来就有的惩罚。
- **限制**：只做左右和上下结构。半包围、全包围（问=门+口）不做。每个年级 build 只有 15 条，太少，要在构建期用 chars（bs、jg 字段）加 hanzi_chaizi（Apache-2.0）扩充，然后人工审核。

### 4-4 形旁/声调分拣落字（两档）【推断】
- **借鉴**：kana-game（没有 LICENSE，只借鉴玩法）。它的混淆追踪和“错题延迟重考”规则值得学。
- **必须和“赛车选道”拉开差异**：赛车是每题换一组选项门。这里的车道**整关固定为 4 个类别**，字连续不断地落下，孩子一直在做同一种分类，练的是自动化。
  - P2：4 条声调车道，字用本调，避开“一”“不”这类变调字。
  - P4：4 条形旁车道，车道上画意义图标（氵画水滴、日画太阳、忄画心、讠画对话气泡）。落下来的是挖空的词，比如“心_”“_天”“_问”。孩子要靠**意义**判断偏旁，这正是形声字“形旁表义”的知识点。
- **易混字对**从 typo 和 build 里提取，出错多的优先重出。

### 4-5 词语三消（两档，中）【推断】
- **借鉴**：hanzi-match-game（无许可，只借鉴玩法），把它的静态棋盘改成重力三消。
- **规则**：
  - 相邻两格按正确顺序（左到右，或上到下）组成 words 或 chars.words 里的词就消除，上方的字块掉下来补位。
  - **星级只算玩家主动组成的词**，自动连锁只给金币，防止孩子靠运气拿分。
  - 无效交换扣一步。
  - 开局必须保证至少有一个可以消的词，生成后校验，不行就重排。

### 只做元层、不单独做成游戏的
- **冰淇淋塔**（hiragana-icecream，MIT）：每个字有自己的水位，任何游戏里连对 3 次就解锁一个口味球，给 P2 当长线动机。接进已有的徽章和 `ctx.mem`，不要另起一套存储。
- **捣蛋狗**（Antura 机制）：按 §3.2 的改法，把干扰做成字词操作，否则只是噪声。

---

## 5. 工程注意【推断，依据前面的实测】

- **词表纪律**：第三方词表（theajack/type、cnchar-words、chinese-xinhua、handle 的成语库）**都不是给儿童审过的**。theajack 的词表里已经确认有不当词。所有玩法只能用站点自己的 content，或者构建期人工审核过的扩展表。
- **许可纪律**：
  - 可以参考代码：theajack/type、TypingNinja、word-tetris（Apache，附 NOTICE）、hiragana-icecream、spelling-bee、handle（注明出处）、chinese-wordle（保留 BSD 声明）、ts-fsrs、cnchar。
  - 只借鉴玩法：kanjiGame、kana-game、hanzi-match-game、hanzi-stroke-games、icecream-kana-game、GCompris（AGPL）、qwerty-learner（GPL）。
  - Antura 的代码虽然是 BSD，但它是 Unity C#，实际上搬不过来。
  - 笔画数据沿用站点已有的 Arphic PL 署名。
- **运行时不能 fetch**：cnchar-draw 内置的 HanziWriter 会用 XHR 联网，不要引入。站点现有的 vendor 内嵌方案已经满足约束。
- **iPad 多点触控**（4-2）和 **ASR**（飞花令口说版）是两个没有实测的风险点，落地前要在真机上试。

---

## 6. 核验方法留痕

- 元数据：`gh api repos/{19 个仓库}`，取 stargazers_count、license.spdx_id、pushed_at、archived、fork、homepage；另外 `gh api repos/X/license` 和 `repos/X/pages`。
- 文件树和源码：`gh api repos/X/git/trees/<branch>?recursive=1`，`gh api repos/X/contents/<path> -H 'Accept: application/vnd.github.raw'` 加 grep。
- demo：`curl -sL -o /dev/null -w '%{http_code} %{size_download}'` 查首页，并从首页 HTML 里取出主 JS/CSS 逐个查状态。
- 浏览器实开：
  - theajack/type：看到敌舰带词飞来和“游戏失败”。
  - kanjiGame：看到“かるた たいせん”的左右对战面板。
  - kana-game：看到 Flow 模式的 5 列、落下的「あ」和 1/10 进度。
- 站点对照：只读了 `SPEC.md`、`SPEC_ARCADE.md`、`parts/15_arcade.js`、`parts/10_core.js`、`content/*.json`，没有修改 research/ 以外的任何文件。
