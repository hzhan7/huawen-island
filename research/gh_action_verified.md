# 核验报告 · GitHub 动作/街机类候选（对 gh_action.md 的对抗式复核）

> 核验日期 2026-09-18 · 核验员：动作/街机分支
> 证据等级：**【实测】** = 本次亲手跑 `gh api repos/…`、`gh api …/git/trees`、`curl`（状态码/字节数）、读源码、无头 Chrome 试跑拿到的结果；**【原文】** = README、源码注释、网页上的原话（附链接）；**【推断】** = 我的判断，没有让孩子试玩过。
> 原始数据在 scratchpad `verify/meta.tsv`、`verify/trees/*.txt`、`verify/src/*`（临时文件，结论已抄进本文）。

---

## 0. 结论

1. **23 个仓库全部真实存在，都没有 archived，星数和 SPDX 许可跟 gh_action.md 写的一致**【实测】。**删掉 1 个**：`TheCodingRocket/ChickenHop`，授权链断了（见 §3）。
2. **原笔记有 9 处事实错误或漏报**，最要紧的 4 条：
   - **Menja 的 CodePen 原帖已经打不开**：`codepen.io/MillerTime/pen/BexBbE` 返回 404，同一作者的其它 pen 都是 200。所以“从 CodePen 按 MIT 取码”这条路走不通了，只剩 GitHub 上的 GPL-3.0 版 → **只能借鉴玩法**。
   - **GeekBoySupreme/crossy-road 不是只能用键盘**：页面上自带 4 个方向按钮。无头 Chrome 里点两下“前进”，计分从 0 变成 2。
   - **mumuy/pacman 的 index.html 写死了域名**：`if(!location.hostname.includes('passer-by.com')) location.href='https://passer-by.com/'`，还会把外层 iframe 顶掉。直接放进 Artifact 会被跳走，代码必须先删掉这段。
   - **doodle-jump 和两个 Flappy 仓库的美术、音效都是从原版游戏里扒下来的**。doodle-jump 的 README Credits 自己写明音效来自 sounds-resource 上的 doodlejump 音效包；omariosouto 的 `sprites.png` 我打开看了，就是原版 Flappy Bird 的整张精灵图。MIT 只管代码，**素材一律不能搬**。
3. **原来的“华文融合创意”大约有一半是给已有玩法换了张皮**：t-rex“按序吃字”、打砖块“接字胶囊”和已有的接字篮（catcher）是同一个知识任务；太空射击“听音打字”等于气球射击（balloon）；“错别字飞船”和平台“顶错字”等于打地鼠找错字（mole）；Flappy“缺口选字”等于华文赛车（racer）的选项门。
4. **还有一批创意要用的数据，题库里根本没有**【实测 content/*.json】：
   - 题库没有部首表。每个年级的 `chars` 只有 30 个字，部首几乎不重复，词语里的字没有部首字段。所以“踩氵旁”“同部首三消”“吃木字旁”这类规则现在填不满。
   - 原笔记说“成语 30 / 歇后语 6 / 俗语 13 题”，这是 P2–P6 五个年级加起来的数。**P4 题库里歇后语、俗语都是 0**，成语只有 8 题。
   - 量词题 P2 有 5 题，P4 只有 2 题。
5. **推荐做进华文小岛的 5 个**（§6 有改进后的设计）：
   - ① **切字忍者·结构刀**：借 Menja 的玩法；
   - ② **声调铺路跑酷**：用 t-rex-runner 的代码；
   - ③ **组词弹弓**：用 matter.js；
   - ④ **跳跳字梯**：用 doodle-jump 的代码，只要代码不要素材；
   - ⑤ **量词炮**：用 spaceinvaders 的代码。

   已有 11 个游戏还没碰过四块知识：声调要孩子自己“产出”、字的结构、组词（`chars.words`）、量词。这 5 个正好分别补上。
6. **融合好不好，用一条判据**：把汉字全换成颜色或图形，游戏还能照样玩通，就说明华文是贴上去的皮。换掉以后这个操作动作本身就没意义了，才算真正长在机制里（Habgood & Ainsworth 2011 说的内在整合，见 §5）。

---

## 1. 核验总表（23 个，按推荐度排序）

星数、许可、最近 push、是否 archived 都是 2026-09-18 `gh api repos/OWNER/REPO` 的读数【实测】；demo 是同一天 `curl -sL` 的最终状态码【实测】；“触摸”一栏是对主 JS/HTML 做 grep 的结果【实测】。

| # | 仓库 | ★ | 许可 (spdx) | 最近 push | archived | demo 状态 | 触摸 | 结论 | 推荐度 |
|---|------|---|------------|-----------|----------|-----------|------|------|--------|
| 1 | [MilllerTime/menja](https://github.com/MilllerTime/menja) | 54 | GPL-3.0 | 2026-06-23 | 否 | [menja.cmiller.tech](https://menja.cmiller.tech/) 200；CodePen 原帖 **404** | 有（pointer+touch） | **只借鉴玩法**（GPL） | ★★★★★ |
| 2 | [wayou/t-rex-runner](https://github.com/wayou/t-rex-runner) | 2186 | BSD-3-Clause | 2024-07-28 | 否 | 仓库自己的 [wayou.github.io/t-rex-runner](https://wayou.github.io/t-rex-runner/) 200（homepage 填的 chromedino.com 是第三方站） | 有 | **可复用代码**（保留 BSD 声明） | ★★★★☆ |
| 3 | [liabru/matter-js](https://github.com/liabru/matter-js/blob/master/examples/slingshot.js) | 18418 | MIT | 2024-08-17 | 否 | [brm.io/matter-js/demo/#slingshot](https://brm.io/matter-js/demo/#slingshot) 200 | 有（Mouse.js 注册了 touchstart/move/end） | **可复用代码** | ★★★★☆ |
| 4 | [takosenpai2687/doodle-jump](https://github.com/takosenpai2687/doodle-jump) | 6 | MIT | 2026-05-26 | 否 | [github.io](https://takosenpai2687.github.io/doodle-jump/) 200 | 有（点屏幕左/右半边） | **可复用代码（素材除外）** | ★★★★☆ |
| 5 | [dwmkerr/spaceinvaders](https://github.com/dwmkerr/spaceinvaders) | 213 | MIT | 2026-09-10 | 否 | [github.io](https://dwmkerr.github.io/spaceinvaders/) 200 | 有（滑动移动、点按开火） | **可复用代码**（4 个 wav 换成合成音） | ★★★★☆ |
| 6 | [GeekBoySupreme/crossy-road](https://github.com/GeekBoySupreme/crossy-road) | 30 | MIT | 2020-08-16 | 否 | glitch **410**（已下线）；本地无头试跑能玩 | 屏幕上有 4 个方向按钮（**原笔记写成只有键盘，错**） | **可复用代码**（删掉 fontawesome） | ★★★☆☆ |
| 7 | [oldj/html5-tower-defense](https://github.com/oldj/html5-tower-defense) | 386 | MIT | 2019-03-15 | 否 | [td.html](https://oldj.net/static/html5-tower-defense/td.html) 200（跳到 s.oldj.net） | 无（click/hover，iPad 点按应能触发 click【推断】） | **可复用代码** | ★★★☆☆ |
| 8 | [mumuy/pacman](https://github.com/mumuy/pacman) | 1643 | MIT | 2026-05-07 | 否 | [passer-by.com/pacman](https://passer-by.com/pacman/) 200 | 无（只有键盘） | **可复用代码（必须先删域名锁）** | ★★★☆☆ |
| 9 | [KilledByAPixel/LittleJS](https://github.com/KilledByAPixel/LittleJS) | 4181 | MIT | 2026-09-15 | 否 | [examples](https://killedbyapixel.github.io/LittleJS/examples/) 200 | 有（引擎自带虚拟手柄） | **可复用代码**（引擎/思路） | ★★★☆☆ |
| 10 | [nebez/floppybird](https://github.com/nebez/floppybird) | 600 | Apache-2.0 | 2026-02-17 | 否 | [nebezb.com/floppybird](https://nebezb.com/floppybird/) 200，`?easy` 有效 | 有 | **可复用代码（素材除外）** | ★★☆☆☆ |
| 11 | [omariosouto/flappy-bird-devsoutinho](https://github.com/omariosouto/flappy-bird-devsoutinho) | 238 | MIT | 2024-03-06 | 否 | **有在线 demo**：[github.io](https://omariosouto.github.io/flappy-bird-devsoutinho/) 200（原笔记说没有，错；README 里的 mariosouto.com 链接是 404） | 只有 window click | **可复用代码（精灵图是原版，不能用）** | ★★☆☆☆ |
| 12 | [wanfungchui/Boxy-Run](https://github.com/wanfungchui/Boxy-Run) | 30 | Apache-2.0 | 2024-03-20 | 否 | [github.io](https://wanfungchui.github.io/Boxy-Run/) 200 | 无（只有键盘） | 可复用代码，但**建议只借玩法**（引擎里已有 racer 透视车道） | ★★☆☆☆ |
| 13 | [tddyco/canvas-td](https://github.com/tddyco/canvas-td) | 41 | MIT | 2019-02-10 | 否 | [canvas-td.teddy.io](https://canvas-td.teddy.io) 200 | 无（click） | 可复用代码（oldj 版的备选） | ★★☆☆☆ |
| 14 | [platzhersh/pacman-canvas](https://github.com/platzhersh/pacman-canvas) | 352 | CC0-1.0 | 2026-02-28 | 否 | [pacman.platzh1rsch.ch](http://pacman.platzh1rsch.ch) 200 | **有**（hammer.js 滑动 + virtualjoystick.js，原笔记漏报） | 可复用代码（音效不能用；地图要改成内联） | ★★☆☆☆ |
| 15 | [jakesgordon/javascript-tiny-platformer](https://github.com/jakesgordon/javascript-tiny-platformer) | 193 | MIT | 2025-06-01 | 否 | [demo](https://jakesgordon.com/games/tiny-platformer/) 200 | 无（只有键盘） | 可复用代码 | ★★☆☆☆ |
| 16 | [end3r/Gamedev-Canvas-workshop](https://github.com/end3r/Gamedev-Canvas-workshop) | 436 | NOASSERTION（LICENSE 正文：代码 CC0） | 2022-06-09 | 否 | [breakout.enclavegames.com](https://breakout.enclavegames.com) 200 | 无（键盘+mousemove） | 可复用代码 | ★★☆☆☆ |
| 17 | [jakesgordon/javascript-breakout](https://github.com/jakesgordon/javascript-breakout) | 78 | NOASSERTION（LICENSE 正文是 MIT） | 2025-06-01 | 否 | [demo](https://jakesgordon.com/games/breakout/) 200 | 有 | 可复用代码（mp3 来源不明，不用） | ★★☆☆☆ |
| 18 | [bibhuticoder/snake.io](https://github.com/bibhuticoder/snake.io) | 48 | MIT | 2017-09-07 | 否 | [github.io](https://bibhuticoder.github.io/snake.io) 200 | 无（按住鼠标才转向） | **只借鉴玩法**（半成品，见 §2） | ★★☆☆☆ |
| 19 | [rembound/Bubble-Shooter-HTML5](https://github.com/rembound/Bubble-Shooter-HTML5) | 59 | MIT（但 JS 文件头是 GPL-3.0） | 2023-10-17 | 否 | [教程页](https://rembound.com/articles/bubble-shooter-game-tutorial-with-html5-and-javascript) 200 | 无（mousemove/mousedown） | **只借鉴玩法**（许可冲突） | ★★☆☆☆ |
| 20 | [jackrugile/radius-raid-js13k](https://github.com/jackrugile/radius-raid-js13k) | 273 | MIT | 2024-04-23 | 否 | 跳到 [js13kgames.com/games/radius-raid](https://js13kgames.com/games/radius-raid) 200 | 无（WASD+鼠标） | 只借鉴玩法（量词枪挪到 spaceinvaders 上做） | ★☆☆☆☆ |
| 21 | [ishaanSh06/PolyDash](https://github.com/ishaanSh06/PolyDash) | 6 | BSD-3-Clause | 2024-11-03 | 否 | [github.io](https://ishaanSh06.github.io/PolyDash/) 200 | 无（只有键盘） | 只借鉴玩法（外链背景图 9.6MB，外链音乐 6.1MB） | ★☆☆☆☆ |
| 22 | [knadh/wordpluck](https://github.com/knadh/wordpluck) | 53 | MIT | 2023-05-23 | 否 | README 的 .com 是 404，但 **[wordpluck.netlify.app](https://wordpluck.netlify.app) 200 能玩**（原笔记说 demo 已下线，错） | 无（键盘） | 只借鉴玩法 | ★☆☆☆☆ |
| ✗ | [TheCodingRocket/ChickenHop](https://github.com/TheCodingRocket/ChickenHop) | 18 | MIT（仓库声明） | 2026-08-08 | 否 | [chickenhop.netlify.app](https://chickenhop.netlify.app) 200 | 有 | **剔除**（授权链断，见 §3） | — |

CDN【实测 200】：`cdnjs …/matter-js/0.20.0/matter.min.js`（83,476 B）、`cdn.jsdelivr.net/npm/littlejsengine@1.18.29/dist/littlejs.min.js`（189,949 B，jsDelivr 显示 latest=1.18.29）、`cdnjs …/three.js/99/three.min.js`（551,410 B）、`…/three.js/r128/three.min.js`（603,445 B）、`cdnjs …/p5.js/1.9.4/p5.min.js`（1,034,532 B）。

---

## 2. 纠错清单（对照 gh_action.md，全部【实测】）

| 原笔记写的 | 核验结果 | 证据 |
|-----------|---------|------|
| Menja：CodePen 公开帖可以按 MIT 取码（403 是反爬） | 用 curl_cffi 模拟 Safari 过掉 Cloudflare 以后：`/pen/BexBbE` 返回 **404 “404 on CodePen”**，oEmbed 返回 `Not Found`。同一作者的 `qBZRpQV`、`QvbEKp` 都是 200，对照 pen `chriscoyier/gfdDu` 的 oEmbed 也是 200。说明这个 pen 已经删除或设成私有。**CodePen MIT 这条路没了，按 GPL-3.0 处理。** CodePen 的规则“公开 pen 自动 MIT”本身属实【原文 [CodePen Licensing](https://blog.codepen.io/documentation/licensing/)】，历史存档【CodePen 官方 Facebook 视频曾引用该 URL】，但现在拿不到带 MIT 标注的副本 | curl_cffi 输出 |
| crossy-road（GeekBoySupreme）“仅键盘” | index.html 里有 `#forward/#left/#backward/#right` 四个按钮，script.js 第 431–437 行给它们绑了 click。无头 Chrome 调两次 `forward.click()` 后 `counter=2`。但页面**没有 viewport meta**，手机上整页缩小显示，按钮很小，棋盘也按横屏视角铺，右边被裁掉（截图 `crossy_0.png`） | tools/shot.js 试跑 |
| omariosouto Flappy“仓库无在线 demo” | https://omariosouto.github.io/flappy-bird-devsoutinho/ 200，页面加载 `jogo.js`。README 里写的 mariosouto.com demo 是 404 | curl |
| wordpluck demo“实测 404” | `.com` 确实 404，但 https://wordpluck.netlify.app 200，标题 “word pluck - a browser based typing game” | curl |
| mumuy/pacman 只写了“MIT（作者要求注明来源）” | index.html 第 20–26 行：不是 file:// 打开、域名又不含 passer-by.com 时，`location.href='https://passer-by.com/'`；否则把 `window.top` 改成自身（顶掉外层 iframe）。页面还从 passer-by.com 加载 common.css、common.js、projects.js、stat.js。**MIT 允许删，但不删就不能嵌进 Artifact** | raw index.html |
| doodle-jump 只写了“素材要换” | README Credits【原文】：音效全部来自 sounds-resource.com 上的 doodlejump 音效包，美术“from random web search”。`doodler_right.png` 目视就是原版 Doodle Jump 的角色（Lima Sky）。**只能用代码**。另外仓库自带 lib/p5.min.js（1.05MB）和 p5.sound，不是从 cdnjs 引的 | README + 目视 |
| omariosouto `sprites.png` 13.7KB（没提来源） | 目视：Get Ready、Game Over、奖牌、绿水管、小鸟，就是原版 Flappy Bird 整张精灵图。floppybird 的音效文件名 `sfx_wing/sfx_hit/sfx_die/sfx_point/sfx_swooshing` 也和原版一样【推断：多半是扒的】 | 目视 |
| matter.js slingshot“触摸属推断，需真机测” | 源码层面已确认：`src/core/Mouse.js` 第 126–128 行注册了 touchmove/touchstart/touchend。**但要放进 HW.arcade 就不该用 MouseConstraint 和 Matter.Render**：引擎自己管画布和指针，应该在 `spec.down/move/up` 里改 Constraint 的锚点、在 `spec.draw` 里自己画刚体【推断】。另外示例里积木是 **25×40 px**，写不下两个字的词，放大积木后金字塔稳定性要重新调 | slingshot.js 第 50–57 行 |
| snake.io 当成可移植的基底 | README 的 todos【原文】里 “basic game components i.e menu, game-over-message” 还没做完；`script.js` 里写着 `fpsLimit = 20`（锁 20 帧）；只有按住鼠标时才转向；画布固定 800×400。**这是个半成品原型**，只能借玩法 | 源码 |
| radius-raid 没提性能 | README 原文说：不在 Chrome 里跑的话帧率不够（作者原话大意是“你会玩得很难受”）→ iPad Safari 有风险 | README |
| “quiz 成语 30 / 歇后语 6 / 俗语 13 题” | 这是 P2–P6 合计。**P4：成语 8、歇后语 0、俗语 0**；P2：三类都是 0。歇后语只在 P6 有，俗语只在 P5/P6 有。P4 words 里另有 23 个四字词（恍然大悟、半途而废、刻舟求剑……），可以拿来做成语玩法 | content/quiz_a.json、quiz_b.json、words.json |
| PolyDash“背景图/音乐是 Dropbox 外链” | 外链现在还能打开，但背景 PNG **9,587,062 字节**、音乐 mp3 **6,082,350 字节**（曲名 “White Bat Audio - Inception”，有版权），两个加起来就快占满 16MB，**一概不用** | curl |
| platzhersh 没提触摸和运行依赖 | 用 jquery.hammer + virtualjoystick 支持触摸；地图用 `$.ajax('data/map.json')` 加载，排行榜走 `data/db-handler.php` → 做成单页要把地图内联、把排行榜删掉 | 源码 |

没有问题的条目：23 个仓库的星数、spdx、push 日期；t-rex 精灵图 2,520 B、index.js 90KB；floppybird 的 `?easy`、外部统计脚本 `yummy.nebez.dev/script.js`、Clones 列表里的 flappy-math-saga（链接 200）；tiny-platformer 全仓 43,304 B、只有键盘；Bubble Shooter 的 MIT/GPL 冲突；oldj “没有用到图片”【原文】并带中英文语言包；end3r LICENSE 写明“代码 CC0”；jakesgordon breakout 的 LICENSE 正文是 MIT；Habgood & Ainsworth 2011 的“7 倍”（见 §5）。

---

## 3. 剔除与降级

- **剔除 TheCodingRocket/ChickenHop**。站点 HTML 第一行注释写 “(C) 2020 Moses Odhiambo”，启动画面写 “CROSSY ROAD BY ZIDAN ANANTA”，README 说“Please don't sue me”“Pay a visit to the original creator”却不给链接。音频里还有一个 `katamari.mp3`，274KB【实测】。仓库的 MIT 声明管不到这些。过马路这一类有 GeekBoySupreme 版就够了。
- **降为只借鉴玩法**：
  - Menja：GPL，CodePen 那份已经 404；
  - Bubble Shooter：许可冲突；
  - snake.io：半成品；
  - radius-raid：没有触摸，还只适配 Chrome；
  - PolyDash：素材是外链、体积太大；
  - wordpluck：2012 年的 CreateJS，词库是英文。
- **跨分支提醒**：`research/gh_puzzle.md` 第 19、42、128 行把 rembound/Bubble-Shooter-HTML5 写成“MIT、★主推底座”，**没注意到 `bubble-shooter-example.js` 文件头写的是 GPL-3.0**（第 5–8 行：“GNU General Public License … version 3”）。要么按 GPL 处理，要么照着教程文章重写。

---

## 4. 题库能不能撑起这些创意（【实测】content/*.json，只读）

| 数据 | P2 | P4 | 影响哪些创意 |
|------|----|----|-------------|
| `words` 词语（w/py/s；s 里都包含 w） | 50（字数 2:37 / 3:7 / 4:6），共 103 个不同的字 | 50（2 字 27 / 4 字 23），共 131 个不同的字 | 挖空句、按序拼词、成语 |
| `chars` 写字表（c/py/bs/jg/words） | 30 | 30 | 组词、结构、部首 |
| `chars.jg` 结构分布 | 独体 14、左右 4、上下 4、半包围 4、全包围 2、左中右 1、品字形 1 | 左右 10、半包围 6、独体 5、上下 4、全包围 2、左中右 1、上中下 1、品字形 1 | **切字按结构**：P2 能切的只有 8 个 |
| `chars.bs` 部首 | 30 个字里最多 2 个同部首（门/日/囗/辶 各 2 个） | 同上（囗 2 个，其余各 1 个） | **所有“同部首”规则现在都填不满** |
| words.py 声调（按音节） | 一声 35、二声 20、三声 19、四声 40、轻声 5（共 119） | 35 / 33 / 19 / 54 / 2（共 146） | **声调类玩法的数据最充足** |
| quiz 量词 | 5 | 2 | 量词炮/量词枪要**新建一张表** |
| quiz 反义词 / 近义词 | 5 / 5 | 3 / 6 | 反义词防线要新建表 |
| quiz 成语 / 俗语 / 歇后语 | 0 / 0 / 0 | 8 / 0 / 0 | 原笔记的弹弓“俗语、歇后语进阶”**超纲** |
| quiz 多音字 | 0 | 6 | P4 的声调玩法可以用 |
| `typo` 错别字 | 15 | 15 | 找错字已经有 mole |

引擎限制【实测 parts/15_arcade.js 第 76–81 行注释】：
- `g.charPool()` 给的是**不带声调**的拼音；
- `g.similarChars()` **只按读音造干扰字，不懂字形**。所以“形近字干扰”（例如拿“借”去干扰“惜”）引擎做不了，只能从 quiz 形近字题（P2 4 题 / P4 2 题）里取，或者手工补；
- `g.pinyinOf()` 能给出带调拼音，并处理“一 / 不”变调，声调玩法靠它就够了。

**组词类玩法还有一个隐患**【推断】：干扰字可能碰巧也能组成真词。比如中心字“火”，干扰字挑了“花”，可“火花”就是个词，孩子答对反被判错。必须离线拿词典（例如 CC-CEDICT，许可需要另外核实）把这种字排除掉。

---

## 5. 挑战原来的“华文融合创意”

**判定标准**（依据 Habgood & Ainsworth 2011：把学习内容做进核心机制的“内在整合”版，在固定时长里学得更多；自由选择时，孩子玩它的时间是外挂题版的 7 倍，对象是 7–11 岁儿童【原文 [ERIC EJ922627](https://eric.ed.gov/?id=EJ922627)】；实验用的 *Zombie Division* 是拿武器去“除”僵尸身上的数字【来源 [Habgood ECGBL 2015](http://shura.shu.ac.uk/10652/3/Habgood_ZombieDivision_ECGBL2015.pdf)】）。一个融合方案要同时满足 5 条：

1. **换皮测试**：把汉字换成色块以后，游戏还成立吗？成立，就说明华文只是贴上去的皮。
2. **判断落在核心动作里**：知识决定“往哪跳、朝哪个方向划、打哪个”，而不是先暂停答题、答完再玩。
3. **答错有物理后果**：踏板碎、刀被弹开、鸟弹回来，不弹窗。
4. **不跟已有 11 个玩法重复同一个知识任务**。
5. **错题本不被污染**：因为手没跟上（跳偏、瞄歪、物理连锁倒塌）造成的失败，不能按 `g.wrong(item)` 记成华文错题。只有孩子明确选中了错的字，才算错。

逐条对照原创意：

| 原创意 | 换皮测试 | 跟已有玩法重复 | 其它问题 | 判定 |
|-------|---------|---------------|---------|------|
| 弹弓“积木塔上写词，打落正确词” | 过（要看懂挖空句） | 知识任务约等于 balloon（N 选 1） | 积木塔一倒就是连锁：正确积木可能被顺带撞下来，错词积木也会掉，**罚错词不公平**，还会把手上的失误记成错题；25×40 的积木写不下两字词；“俗语、歇后语进阶”对 P4 超纲 | **要改**（§6-③） |
| Flappy“缺口选字” | 过 | **跟 racer 选项门是同一件事**（穿过写着正确答案的门） | 撞墙是因为时机没掐准还是选错了缺口，分不清 → 错题本被污染 | **降级**；Flappy 更适合做“声调隧道”（见 §6-② 备注） |
| Doodle“踩氵旁的字” | 过 | 不重复 | **没有部首数据**；原版易碎踏板是白色，一眼就能分出来，改造时必须和实心踏板长得一样；P2 在移动中读字负担重 | **要改**（§6-④） |
| 平台“顶错字” | 过 | **等于 mole** | 只有键盘 | 放弃 |
| 切水果“按结构下刀” | **最好**：刀的方向本身就是结构判断，换成色块就没有“竖着切还是横着切”的道理了 | 不重复（已有游戏都没碰过字的结构） | P2 有 14/30 是独体字；要补结构数据；GPL | **保留并加强**（§6-①） |
| 过马路“组词宝石” | 过 | 主题和 frog 相近，知识任务不重复 | 干扰字可能碰巧能组词；页面不适配竖屏 | 保留为备选 |
| t-rex“按序吃字金币” | 过 | **等于 catcher** | — | 换成声调铺路（§6-②） |
| Boxy-Run“声调车道” | 过 | 形式像 racer，但练的是听辨声调 | 引擎已有 `g.roadPos` 透视车道，不需要 three.js | 当作 racer 的一个模式就行 |
| 太空射击“听音打字阵” | 过 | **等于 balloon** | — | 换成量词炮（§6-⑤） |
| “错别字飞船” | 过 | **等于 mole** | — | 放弃 |
| 量词枪（radius-raid） | **很好**：弹种必须对上敌人，和 Zombie Division 同一种结构 | 不重复 | 底座没有触摸、要双手操作；数据要新建 | 思路搬到 spaceinvaders 上（§6-⑤） |
| 泡泡龙“同部首三消” | 过 | 益智分支也在做 | 没有部首数据，许可冲突 | 交给益智分支 |
| GD“声调地形” | **不过**：地形看得见，孩子只要看地形跳就行，不必知道声调 | — | 素材 15MB | 把地形改成孩子自己“铺”出来（§6-②） |
| 塔防“字塔认音” | 过 | 不重复 | P4 适合；代码是 2010 年的 IE9 风格，迷宫式塔防 | 第二期 |
| 吃豆人“能量豆写拼音” | 过，但知识判断是间歇的（每颗能量豆才判断一次） | 不重复 | 要先删域名锁；只有键盘 | 第二期 |
| 打砖块“接字胶囊” | 过 | **等于 catcher** | — | 放弃，只保留“砖阵拼成一个大字”当彩蛋 |
| slither“只吃对的豆” | 过 | 和 snake 部分重叠 | 半成品；部首规则没数据 | 只借玩法 |
| wordpluck“打拼音” | 过 | 不重复 | P2 不适合；益智分支也有打字僵尸 | 放弃 |

---

## 6. 推荐做进华文小岛的 5 个（改进版融合设计）

### ① 切字忍者·结构刀（借 Menja 的玩法，GPL → 在 HW.arcade 里重写）★★★★★
- **为什么好玩**：在 iPad 上划屏最自然；字块碎开有粒子；连击后有慢动作。Menja 现成的参数【实测 globalConfig.js，注释原文 “Number of cubes that must be smashed before activating a feature”】可以直接照搬：累计切碎 10 块以后开放慢动作，25 块以后出现坚固块和旋转块，指针速度低于 60 不算切中。原笔记写成“连击后慢动作”，不准确。
- **规则**：字块抛上来以后——
  - 左右结构 / 左中右 → **竖着划**，字沿中缝裂成左右两半；
  - 上下 / 上中下 → **横着划**；
  - 独体字 → **是炸弹，不能切**，切到就炸、扣心；
  - 半包围 / 全包围 → 只在 P4 出现，要**画个圈**把它圈住。

  切对了，两半飞开，TTS 读出这个字和 `chars.words` 里的一个组词。方向划错了，刀被弹开，字还在空中，可以再补一刀。
- **为什么一定要用到华文**：刀往哪个方向划就是对字的结构的判断，一秒钟就要做一次决定；已有的 11 个游戏没有一个碰过字的结构。
- **数据**：先用 `chars.jg`（P2 8 个能切、14 个独体；P4 14 个能切、5 个独体）。要扩到 words 里的一百多个字，得离线生成一张结构表：用开放的 IDS 拆字数据取第一层的 ⿰/⿱ 符号（**数据许可要另外核实**）。品字形和有争议的字不放进来。
- **P2 / P4**：P2 只有竖切、横切、别切三种，慢动作常开，每次最多同时飞 2 个字；P4 加上画圈，还会同时飞多个字、出现旋转字块，笔画多的字要切两刀。
- **防止错题本被污染**：只有指针速度达标、而且完整划过字块的那一刀才判对错；没划到只算 `g.miss`。
- **工作量**：中等【推断】：切割判定（线段和圆相交，再用 `clip` 把字画成两半）约 200 行。

### ② 声调铺路跑酷（t-rex-runner 底座，BSD-3 可复用；或者照着它的循环重写）★★★★☆
- **为什么好玩**：一只手就能玩，越跑越快，死了马上重来，破纪录上瘾【推断】。t-rex 的 index.html 已经把 3 个音效用 base64 内联了【实测】，本来就适合做单页。
- **规则**（取代原来的“吃字金币”和 GD 的“声调地形”）：前方地面是断开的，每个缺口上方飘着一个字（按词语或朗读句的顺序出现）。孩子要**用手指画出这个字的声调符号**来铺路：
  - 一声 → 横划，铺一段平桥；
  - 二声 ↗，铺一段上坡；
  - 三声 ∨，铺一段先下后上的凹槽；
  - 四声 ↘，铺一段下坡；
  - 轻声 → 轻点一下，铺一块小踏板。

  铺对了，小人顺着这段路型跑过去，还会顺势起跳；铺错了，路和下一段对不上，小人绊倒掉进缺口，扣心（P2 只减速）。
- **为什么一定要用到华文**：孩子要自己把声调想出来、画出来，而不是从选项里认出来；手势就是考试里标声调的那个符号。地形是孩子自己铺出来的，屏幕上看不到答案，所以不会犯 GD 原创意那种“看地形就能过”的毛病。
- **数据**：words.py 的带调音节，P2 119 个、P4 146 个【实测】；朗读段落可以用 `g.pinyinOf` 转成带调拼音；P4 再加 quiz 多音字 6 题，先播句子，按句中的读音铺路。
- **P2 / P4**：P2 字的上方显示不带调的拼音（mao），只考“画哪个调”；P4 只显示汉字，要连着铺完整句、整个成语，而且句子里有多音字。
- **风险**：三声的 ∨ 在小屏上不好识别，留 4 个大按钮作为辅助模式（按钮模式就退化成四选一，只当无障碍兜底）。
- **备注**：如果还要做一个 Flappy，就做“声调隧道”：到岔路口时 TTS 读一个音节，孩子要飞进走向和这个声调一致的那条通道。练的是听辨声调；做法可以借 omariosouto 的 9KB Canvas 循环，但精灵图不能用。

### ③ 组词弹弓（matter.js 0.20.0，cdnjs，MIT 可复用）★★★★☆
- **为什么好玩**：拉弓、飞出去、城堡轰然倒塌，物理破坏的快感，P4 男孩最爱【推断】。
- **怎么改**：不再用“一座写满词的积木塔”，换成 **3–4 座分开的小堡垒**，每座堡垒顶上的小怪举着一个字；弹弓里的鸟是一个中心字（`chars.c`，例如“火”）。
  - 打中能和中心字组成词的字（`chars.words`：车/山/红），两个字合成横幅“火车！”，TTS 朗读，堡垒倒塌；
  - 打中组不成词的字，鸟被钢盾弹回来，损失一只鸟。

  每关有多个正确目标（`chars.words` 每个字给了 3 个组词），孩子要把能组词的字都找出来，而不是做单选题。越往后，正确答案越放在更远、更难打的堡垒上。
- **P4**：鸟带着成语的前两个字（P4 words 里有 23 个四字词），堡垒上是后两个字的候选。**不用俗语和歇后语**，P4 题库里没有，而且超纲。
- **防止错题本被污染**：只算鸟**第一下直接撞到**的那只小怪；堡垒倒塌时被连带砸中的都不算，瞄歪了记 `g.miss`。
- **实现**：用 `Matter.Engine.update` 在 `spec.update` 里推进物理，自己在 `spec.draw` 里画刚体和字；弹弓拖拽用 `spec.down/move/up` 去改 Constraint 的 `pointA`，不用 MouseConstraint 和 Matter.Render【推断】。
- **干扰字**：必须离线查词典，排除掉碰巧能组成真词的字（§4 的隐患）。

### ④ 跳跳字梯（doodle-jump 的 MIT 代码，素材全部重画；主要给 P2）★★★★☆
- **为什么好玩**：往上跳没有尽头，左右穿屏，弹簧一下飞很高。仓库 2026-01 修好了 iOS，点屏幕左右半边就能移动【原文 README】。
- **怎么改**：“同部首”规则没有数据，改成题库里现成的规则。顶上的牌子每 12 块踏板换一次规则：
  - P2：“只踩一声字 / 只踩四声字”（数据足）、“只踩能跟〔火〕组词的字”（`chars.words`）、“只踩左右结构”（`chars.jg`）；
  - P4：“按顺序踩出成语”（23 个四字词，每层一个字）、“踩句子里读 zhòng 的‘重’”（多音字）。

  写着对的字的踏板是实心的；写着错的字的踏板**外观和实心踏板完全一样**，一踩就碎（借仓库里的 fragile 逻辑，原版是白色，要改掉）。连续踩对 5 块出弹簧；黑洞里装的是 typo 的错字。
- **为什么一定要用到华文**：每一跳的落点都由分类判断决定，是连续不断的判断，不是一道题一道题地做。“按序踩出成语”和 catcher 的“按序接字”是同一类任务，只在 P4 的成语关里用，而且用的是成语，不是普通听写词。
- **P2 减负**：同一高度最多 2 块踏板，字号 ≥ 36px，掉下去不死、回到上一块踏对的踏板（护盾）【推断】。

### ⑤ 量词炮（spaceinvaders 的 MIT 代码，已有触摸；主要给 P4）★★★★☆
- **为什么好玩**：敌阵压下来，越来越快，爆炸很爽；这个仓库本来就支持“滑动移动、点按开火”【原文 index.html】。
- **规则**（Zombie Division 式，量词枪的思路搬到这个有触摸的底座上）：敌阵是一个个名词，带 emoji 图，例如 🐟 鱼、📖 书、🌳 树、🚗 车；炮台的弹种**自动轮换**（本 → 条 → 棵 → 辆……），孩子要趁当前弹种还在的时候，去打一个跟它配得上的敌人。配对了就爆炸，TTS 读“一条鱼”；配不上，子弹被吸收，那个敌人加速俯冲。弹种不能自己选，所以没法一个个试过去。
- **为什么一定要用到华文**：量词和名词的搭配就是瞄准的依据，而且一个量词往往能配好几个名词（条：鱼/河/裤子），是分类判断，不是单选题。
- **数据**：要**新建一张量词表**，60–80 对，按新加坡 P2/P4 课本用词整理。每个名词要列出**所有可以接受的量词**（例如“一只狗 / 一条狗”都对），否则会误判。现在题库里量词题只有 P2 5 题、P4 2 题，这张表**要请家长或老师过目**。
- **P2**：只用 个 / 只 / 本 / 条 四种，敌人不俯冲。

**第二期**（有余力再做）：
- 塔防“字塔认音”（oldj，MIT，零图片，自带中文界面）；
- 吃豆人“能量豆写拼音”（mumuy，删掉域名锁以后能用；或者用 platzhersh 的 CC0 版，已有触摸）；
- 过马路“组词宝石”（GeekBoySupreme，MIT，three r99，要补 viewport meta 和竖屏镜头）。

---

## 7. 方法与原始命令（可复现）

- 元数据：`gh api repos/$r --jq '[.full_name,.stargazers_count,(.license.spdx_id//"NONE"),.pushed_at,.archived,.fork,.homepage,.default_branch,.size]'`，23 个仓库逐个跑。
- 文件树：`gh api "repos/$r/git/trees/$branch?recursive=1"`，全部没有被截断；源码用 `raw.githubusercontent.com` 拉取后 grep `touchstart|touchmove|touchend|pointerdown|pointermove|pointerup`、`keydown|keyCode`、`mousedown|click`。
- Demo / CDN：`curl -sL -o /dev/null -w "%{http_code} %{size_download} %{url_effective}"`，带桌面 Chrome UA。
- CodePen：先用普通 curl 被 Cloudflare 拦（403 “Just a moment…”），再用 `curl_cffi` 模拟 Safari（`impersonate="safari"`）请求 pen 页和 `codepen.io/api/oembed`，拿同一作者的其它 pen 和第三方 pen 做对照。
- 试跑：`node tools/shot.js --page <scratch>/crossy/index.html --size 390x844|1280x800 --steps …`（项目自带的无头 Chrome 工具，只读使用），检查 `THREE.REVISION=99`、按钮数 4、点两次以后 counter=2。
- 题库：用 python 只读统计 `content/quiz_a.json`、`quiz_b.json`（按年级、按 `t` 计数），以及 `words.json`（`chars.jg`、`chars.bs` 的分布，words.py 的声调分布）。
- 学习科学来源：Habgood, M. P. J., & Ainsworth, S. E. (2011). *Journal of the Learning Sciences*, 20(2), 169–206. https://eric.ed.gov/?id=EJ922627 ；Zombie Division 机制：http://shura.shu.ac.uk/10652/3/Habgood_ZombieDivision_ECGBL2015.pdf
- CodePen 许可：https://blog.codepen.io/documentation/licensing/ ；Menja 作者页：https://menja.cmiller.tech/ （页面原文 “An 8kB game by Caleb Miller”）；CodePen 官方曾引用过原帖 URL：https://www.facebook.com/CodePen/videos/game/370635960227438/
