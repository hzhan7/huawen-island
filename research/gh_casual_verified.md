# 核验：GitHub 休闲 / 养成 / 创作类（兼顾女孩喜好）

- 核验对象：`research/gh_casual.md`，共 23 个候选仓库。
- 核验日期：2026-09-18。
- 核验方法：
  - 每个仓库都跑了 `gh api repos/OWNER/REPO`，看星数、spdx、推送时间、是否归档、仓库大小和 homepage。
  - 许可证有疑问的，读 LICENSE 原文，或调 `gh api repos/.../license`。
  - README 和文件树用 `gh api .../contents` 和 `git/trees?recursive=1` 读。
  - demo 用 `curl -L` 看状态码和页面内容；其中 4 个用浏览器打开截图：suika、catch-the-cat、pizzashop、kus.ai/hanzi。
  - CDN 可用性用 cdnjs API 查。
- 证据等级：
  - **[实测]**：本次亲手跑出来的结果。
  - **[原文]**：仓库 README 或 LICENSE 原话的大意。
  - **[推断]**：我的判断，没有验证过。
  - **[笔记]**：沿用 gh_casual.md 的试玩结论，本次没有重做。

---

## 0. 结论先说

1. **23 个仓库全部真实存在，没有编造。** 星数、spdx、推送日期与笔记一致 [实测]。但有 **19 处事实错误或遗漏**，见第 2 节。其中 4 处会直接改变结论：
   - **KanaMaster 不是音游。** 实际是“限时三选一答题”，正是 1.0 被家长否掉的形态。**删除**。
   - **vue-color-avatar 只有头肩像。** 笔记把“tops”当成上衣，其实 tops 是 9 种发型或头饰，clothes 只有 3 种领口。它做不出裙子、裤子、鞋，所以“量词衣柜”不能建在它上面，要换成 DollMaker 的全身纸娃娃。
   - **webosu 的 demo 域名已经变成广告跳转页，不能给孩子用。** GitHub Pages 返回 404，也就是说没有能玩的官方 demo。
   - **kusazh/hanzi 的合并是自动的**：两个部件一碰到，只要能组成字就合并。这说明“合成大汉字”里华文知识是**摆放策略**，不是答题。这一点**支持**把它排第一。
2. **删除 2 个**：
   - SamToki/KanaMaster：玩法与笔记描述不符，而且是题卡形态。
   - KyleMit/Splotch：面向 2 岁以上幼儿；魔法刷揭图用 20 行 Canvas 就能实现，不需要这个 1.39GB 的仓库。

   **降级 6 个**：webosu、vue-color-avatar、isomer、Koi、Restaurant、chrome-music-lab。
3. **判断“融合是否真”的标尺。** 现有 11 个街机里有 6 个本质是“**移动的选择题**”：先出一道题，再从飘动的选项里点对的那个。这 6 个是气球、青蛙、赛车、打地鼠、钓鱼、接字篮 [实测：SPEC_ARCADE.md §4]。本分支的价值不在于再做一种“A 型”，而在于找到下面两型：
   - **A 型：移动的选择题。** 题目和答案在外，游戏只是皮。不懂华文也能靠排除法、手速或运气混过去一部分。
   - **B 型：知识即规则。** 华文知识决定物理、寻路或合并。孩子不懂，就**规划不出好的局面**；懂的孩子会主动利用规则。
   - **C 型：知识即指令。** 要读懂或听懂一段话，才能把东西**造出来**，而且系统按结构判分，不是按选项判分。
4. **本分支最值得做的 5 个**（第 4 节展开）：

| 名次 | 玩法                  | 借哪个仓库                                                | 类型                    | 复用方式                           | 推荐度 |
|------|-----------------------|-----------------------------------------------------------|-------------------------|------------------------------------|--------|
| 1    | 合成大汉字            | moonfloof/suika-game，参考 kusazh/hanzi                   | B                       | 代码可复用（Unlicense）            | ★★★    |
| 2    | 华文小吃店            | DigitalCyberSoft/pizzashop                                | C                       | 只借鉴玩法（无许可证）             | ★★★    |
| 3    | 围住小猫·字路版       | ganlvtech/phaser-catch-the-cat                            | B                       | 代码可复用（MIT，猫的图要自己画）  | ★★★    |
| 4    | 字田 + 孵字蛋（元游戏）| appleweiping/paradise-isle + gavilanbe/gacha-zoo          | 复习调度 + 奖励         | 只借概念，开蛋动画代码可复用（MIT）| ★★     |
| 5    | 背诵钢琴              | arcxingye/EatKano                                         | A+（连续背诵）          | 代码可复用（MIT，去外链依赖）      | ★★     |

   兼顾女孩的备选：
   - 量词衣柜：DollMaker，★★；
   - 人群里找嫌疑人：notion-avatar，★★；
   - 魔法毛笔：kidpix，只借设计，★★；
   - 学舌小猫：MyTalkingRon，★★。

---

## 1. 核验总表

★ 是当天 `gh api` 的 `stargazers_count`。“推”列：★★★ 强推，★★ 推荐，★ 备选，✗ 删除。

| #  | 仓库                                    | ★    | spdx（GitHub） | 实际条款（读原文）                              | 最近推送   | 归档 | demo 实测                                                                    | 浏览器能玩         | 复用判定         | 推  |
|----|-----------------------------------------|------|----------------|-------------------------------------------------|------------|------|------------------------------------------------------------------------------|--------------------|------------------|-----|
| 1  | moonfloof/suika-game                    | 61   | NOASSERTION    | Unlicense，覆盖 index.js、index.html、assets；内置 matter.js 为 MIT | 2025-10-06 | 否   | moonfloof.github.io/suika-game 200，标题页截图正常；README 里的 tombofry 链接 404 | 是                 | 可复用代码       | ★★★ |
| 2  | DigitalCyberSoft/pizzashop              | 1    | 无（license API 404） | 无                                          | 2026-06-28 | 否   | game.html 200，`#play` 进单截图正常                                          | 是                 | 只借鉴玩法       | ★★★ |
| 3  | ganlvtech/phaser-catch-the-cat          | 756  | MIT            | MIT（猫 SVG 来源未说明）                        | 2022-12-25 | 否   | 200，六边形棋盘截图正常；窄屏会横向溢出                                      | 是                 | 可复用代码       | ★★★ |
| 4  | kusazh/hanzi                            | 1    | 无             | 无                                              | 2026-06-10 | 否   | kus.ai/hanzi 200，点开封面后部件以字形掉落                                   | 是（繁体）         | 只借鉴玩法       | ★★（原型参考） |
| 5  | appleweiping/paradise-isle              | 4    | MIT            | MIT                                             | 2026-07-17 | 否   | 200；产物是单个 JS 文件，170,832 字节                                        | 是 [笔记试玩]      | 可复用，但建议只借概念 | ★★ |
| 6  | gavilanbe/gacha-zoo                     | 0    | MIT            | MIT                                             | 2026-06-19 | 否   | 200（428,830 字节单 HTML）                                                   | 是 [笔记试玩]      | 可复用代码（开蛋动画） | ★★ |
| 7  | arcxingye/EatKano                       | 1906 | MIT            | MIT                                             | 2025-11-07 | 否   | github.io 200；xingye.me/game/eatkano 200                                    | 是 [笔记试玩]      | 可复用代码       | ★★  |
| 8  | wolfderechter/DollMaker                 | 10   | MIT            | MIT（PNG 美术来源 README 未说明）               | 2024-12-14 | 否   | 200                                                                          | 是 [笔记试玩]      | 可复用代码       | ★★  |
| 9  | Mayandev/notion-avatar                  | 3223 | MIT            | 代码 MIT，素材 CC0                              | 2026-06-06 | 否   | 200                                                                          | 是（头像生成器）   | 可复用素材       | ★★  |
| 10 | vikrum/kidpix                           | 742  | GPL-3.0        | GPL-3.0                                         | 2025-11-18 | 否   | 200                                                                          | 是                 | 只借鉴玩法       | ★★  |
| 11 | JohnSpahr/MyTalkingRon                  | 0    | CC0-1.0        | CC0                                             | 2024-05-30 | 否   | 200                                                                          | 是（要语音识别）   | 可复用代码       | ★★  |
| 12 | drakarah/paintbynumbersgenerator        | 431  | MIT            | MIT                                             | 2026-08-18 | 否   | drakarah.github.io/... 200；GitHub homepage 字段指向 drake7707 → 404        | 是（生成工具）     | 可复用（开发期离线用） | ★★ |
| 13 | danielbrendel/krepagotchi-game          | 49   | MIT            | MIT                                             | 2026-09-08 | 否   | www 是落地页；**真正的游戏在 game.krepagotchi.com**，200，含 `Phaser.Game`   | 是（依赖 PHP 后端）| 只借鉴玩法       | ★   |
| 14 | Acedio/animalese.js                     | 489  | NOASSERTION    | 代码 MIT；animalese.wav 为 CC BY 4.0            | 2025-05-20 | 否   | 200                                                                          | 是（组件）         | 可复用代码（需署名） | ★ |
| 15 | Codennnn/vue-color-avatar               | 3769 | MIT            | 代码 MIT，素材 CC BY 4.0（Micah Lanier）        | 2025-07-24 | 否   | 503                                                                          | 当天打不开         | 可复用（需署名） | ★   |
| 16 | teru776/kawaii-room-maker               | 0    | 无             | README 写 MIT，但没有 LICENSE 文件              | 2026-04-04 | 否   | 200                                                                          | 是 [笔记试玩]      | 只借鉴玩法       | ★   |
| 17 | jdan/isomer                             | 2909 | MIT            | MIT                                             | 2022-04-20 | 否   | 200；cdnjs 有 0.2.6                                                          | 是（绘图库）       | 可复用代码       | ★   |
| 18 | jobtalle/Koi                            | 411  | NOASSERTION    | Apache-2.0 加 Commons Clause（禁止出售）        | 2026-04-07 | 否   | koifarmgame.com 200，但**是售卖页**（Steam、itch、App Store）                | **没有免费网页版** | 只借鉴玩法       | ★   |
| 19 | googlecreativelab/chrome-music-lab      | 2419 | Apache-2.0     | Apache-2.0                                      | 2024-02-28 | **是** | 200                                                                        | 是                 | 可复用代码       | ★   |
| 20 | enesbabekoglu/Restaurant-Game-Canvas-JS | 2    | MIT            | MIT                                             | 2024-12-11 | 否   | /proje-oyun/ 302 跳到 **/projeler/restoran-oyunu/**，200，标题 “Babek's Steak House” | 是            | 可复用代码       | ★   |
| 21 | 111116/webosu                           | 652  | MIT            | 代码 MIT；另有 LICENSE-CC-BYNC.md；README 说部分媒体版权属于 ppy 等人 | 2024-07-23 | 否 | osugame.online 返回 “Redirecting...” 广告跳转页；111116.github.io/webosu 404 | **不能**        | 只借鉴玩法       | ★   |
| ✗  | SamToki/KanaMaster                      | 20   | GPL-3.0        | GPL-3.0；README 说美术设计保留版权              | 2026-09-14 | 否   | 200                                                                          | 是，但是答题游戏   | —                | 删除 |
| ✗  | KyleMit/Splotch                         | 5    | MIT            | MIT                                             | 2026-09-18 | 否   | 200                                                                          | 是（2 岁以上幼儿） | —                | 删除 |

CDN 可用性 [实测]：
- cdnjs 上有：matter-js 0.20.0、phaser 4.2.1（3.x 共 60 个版本，3.90.0 文件返回 200）、tone 15.5.42、pixi.js 8.17.1、three.js 0.186.0、isomer 0.2.6、opentype.js 1.3.4；
- gacha-zoo 用的 `cdn.jsdelivr.net/npm/three@0.160.0` 返回 200，属于允许的 CDN。

---

## 2. 更正清单（gh_casual.md 里写错或漏掉的）

| #  | 仓库                 | 笔记原文                                   | 核验结果                                                                                                                                  | 影响                                         |
|----|----------------------|--------------------------------------------|-------------------------------------------------------------------------------------------------------------------------------------------|----------------------------------------------|
| 1  | SamToki/KanaMaster   | “汉字音符沿轨道落下，在判定线处按键……音游手感” | README 原文说它是 “a quiz game … inspired by rhythm games” [原文]。demo 界面是“问题 + 选项1/2/3 + 血量 + 连击 + 当前时限 + 平均反应用时” [实测页面文字]，也就是**限时三选一答题**，没有下落轨道 | **删除**。它正是 1.0 被否的“题卡 + 按钮”形态，只能当反例 |
| 2  | Codennnn/vue-color-avatar | “tops 9（上衣）……量词衣柜”            | tops = beanie、clean、danny、fonze、funny、pixie、punk、turban、wave，是**发型或头饰**；clothes 只有 collared、crew、open 三种**领口**；没有裙子、裤子、鞋 [实测文件树] | “一条裙子、一双鞋”做不出来，量词衣柜改用 DollMaker；本仓库降为 ★ |
| 3  | Mayandev/notion-avatar | “festival 部件可以做春节装扮周”          | festival 只有 christmas 6 个、halloween 6 个 [实测文件树]                                                                                  | 没有春节素材，要自己画                       |
| 4  | 111116/webosu        | “osugame.online 当天打不开（000）”         | 今天返回 200，但内容是 “Redirecting...” 加反广告拦截脚本的**跳转页** [实测]；111116.github.io/webosu 是 404                                 | **不能把链接给孩子**；只借缩圈判定的思路     |
| 5  | 111116/webosu        | 许可证只写了 MIT                           | 仓库里还有 `LICENSE-CC-BYNC.md`（CC BY-NC 4.0 全文）；README 说部分媒体属于 ppy 等人 [实测]；谱面来自外部 Sayobot [原文]                   | 只借鉴玩法                                   |
| 6  | kusazh/hanzi         | “部件以真实字形作为刚体掉落”（对）；没说合并规则 | `mergeZi()` 在 `collisionStart` 里用 `partDict[a+b]` 查，能组成字就**自动合并**，有多个结果时随机挑一个；新等级 = a.level + b.level + 1；得分 = 笔画数^(等级/2+1)；运行时 fetch `dictionary.json` 和思源宋体 TC 子集；版本 0.3；手指按下时才随机出部件，**没有“下一个”预告** [实测源码 + 试玩] | 证明“懂部件的孩子能规划落点”这个 B 型机制成立 |
| 7  | danielbrendel/krepagotchi-game | demo 写的是 www.krepagotchi.com  | www 是落地页，真正的游戏在 https://game.krepagotchi.com（200，`Phaser.Game(gameconfig)`）[实测]；网页版要 PHP（asatru）后端，另有 itch、gamejolt 桌面包 [原文] | 更正 demo 地址                               |
| 8  | danielbrendel/krepagotchi-game | “哥哥用苦力怕造型”              | Krepa 的外形是 Minecraft 苦力怕的致敬（像素绿怪、会爆炸）[原文 + 落地页]；**直接画成苦力怕属于模仿 Mojang 的角色** [推断]                  | 改成原创“方块怪”，不要照抄苦力怕             |
| 9  | enesbabekoglu/Restaurant-Game-Canvas-JS | demo `/proje-oyun/` 返回 200 | 302 跳到 `../projeler/restoran-oyunu`，最终是 https://enesbabekoglu.com.tr/projeler/restoran-oyunu/ ，200，有 canvas [实测]                | 更正 demo 地址                               |
| 10 | jobtalle/Koi         | “官网返回 200”，适合 P2 女孩                | 官网是售卖页：Buy now、Steam、itch、App Store [实测]；没有免费网页版；要用 electron 或 squish 构建 [原文]                                  | 孩子没法先试玩；玩法又和偏旁钓鱼、合成大汉字重叠，降为 ★ |
| 11 | gavilanbe/gacha-zoo  | “14 个 m4a，每个约 1MB”；“体素模型是否由代码生成还需确认” | 实际 **15 个** m4a（music.m4a 加 s1–s14），共 15,774,876 字节 [实测]。README 原文说所有生物都是“用代码一格一格建出来的体素” [原文]，笔记的疑问已经解决 | 音乐必须换成合成的；模型可以沿用 |
| 12 | gavilanbe/gacha-zoo  | 没提后端                                   | 仓库里有 `wrangler.toml`（Cloudflare D1，`FAMILY_CODE`）和 `schema.sql`，表有 players（带 PIN）、offers（交易）、scores（周榜）；页面里有 `fetch('/api/'+p)` [实测] | 移植时要把联网部分剥掉；“交易市场”也不适合孩子 |
| 13 | arcxingye/EatKano    | “需用 Canvas 重写，约 300 行”               | 不必重写：MIT，DOM 加 `translate3D` 在 iPad 上够用。要去掉的是 5 个不允许的外链（code.createjs.com、passport.cnblogs.com 的 jsencrypt、staticfile 的 bootstrap 和 jquery）、PHP 排行榜（SubmitResults.php、rank.php、conn.php、kano.sql）和鹿乃立绘 [实测] | 改编成本比笔记说的更低                       |
| 14 | wolfderechter/DollMaker | “素材是 PNG，需要换成 SVG”               | 27 个 PNG 共 929,573 字节，base64 后约 1.24MB，远小于 16MB，**可以直接内嵌** [实测]；分类是 dress 9、hair 6、shoes 5、accessory 4、face 2、body 1；但 README 没说明美术出处 [实测] | 可以直接当量词衣柜的底子；出处不明，要标注 |
| 15 | DigitalCyberSoft/pizzashop | “重写约 500–700 行”                  | 原作 `game-core.js` **2,383 行（149KB）**，`game-ui.js` 72KB [实测]。500–700 行只够一个简化的中文 MVP（约 10 级），做到原作 30 级那种完整度是几千行的活 [推断] | 按 MVP 规划                                  |
| 16 | DigitalCyberSoft/pizzashop | 没提音效来源                          | README 说音效来自 Kenney，是 CC0 [原文]；美术由 gpt-image-1 生成；运行时没有任何网络请求 [原文]                                              | 就算代码不能拷，CC0 音效也可以用             |
| 17 | appleweiping/paradise-isle | “可能是 AI 辅助生成的 [推断]”        | 整个仓库只有 **1 个 commit**；仓库里有 `.claude/launch.json`（Claude Code 的配置）和可选的 `server/index.mjs` [实测]。README 自称是 2011 年腾讯《QQ天堂岛》的致敬重制，含**斗兽**、**能量每 90 秒回 1 点**（手游式限流）[原文] | 别整仓 fork：去掉能量限流和斗兽，只借“作物 = 复习间隔”的概念 |
| 18 | drakarah/paintbynumbersgenerator | 没提维护状态                     | README 说是 “proof of concept … not being actively maintained” [原文]；GitHub homepage 字段指向 drake7707.github.io，返回 404 [实测]；设置里有 `kMeansColorRestrictions` 和 `maximumNumberOfFacets` [原文] | 可以限定调色板，正好支撑“声调填色”（见第 3 节）|
| 19 | Acedio/animalese.js  | “每个音节的音高按声调走”                    | 源码里 pitch 是**一次调用一个全局值**（`Math.floor(i * pitch)` 重采样），只认 A–Z 字母 [实测源码]                                          | 按声调变音高要自己改：逐音节调用，音节内的滑音还要另写 |

笔记里核对无误的项目（摘要）[实测]：
- suika-game：401 行、`fruitSizes` 11 级、`collisionStart` 同半径合并、`loseHeight = 84`、Unlicense 原文都对；
- MyTalkingRon：`pitch = 0.1`、`webkitSpeechRecognition`、LICENSE 为 CC0 都对；
- 数量都对：notion-avatar 212 个部件、vue-color-avatar 39 个 SVG、kidpix 210 个音频；
- 状态都对：chrome-music-lab 已归档、Splotch 仓库 1,458,570KB、kawaii-room-maker 仓库里没有 LICENSE；
- 许可证都对：Koi 的 LICENSE.md 是 Commons Clause 加 Apache 2.0，animalese 是代码 MIT 加音频 CC BY 4.0。

---

## 3. 挑战原“华文融合创意”：会不会变成题卡换皮？

判定问题只有两个：
- ①**孩子不懂华文，能不能靠手速、排除法或运气赢？**
- ②**华文是“规则”还是“关卡之间插的题”？**

| 原创意（笔记）               | 类型   | 不懂华文能赢吗                                                     | 与现有 11 个重复                   | 判定                   | 更好的融合（改法）                                                                 |
|------------------------------|--------|--------------------------------------------------------------------|------------------------------------|------------------------|------------------------------------------------------------------------------------|
| 合成大汉字：叠字、词语球、偏旁球 | B     | 能随机丢，但合成得少、很快堆满；懂部件的孩子会**有意**把 氵 丢到 青 旁边 | 内容和偏旁钓鱼重叠（都是 build 栏目），机制不同 | **真融合**             | 保留。修正 4 处，见 §4-1                                                            |
| 华文小吃店（订单 spec）      | C      | 不能：读不懂订单就做不对菜                                          | 无                                 | **真融合**             | 保留，把语法阶梯换成华文特有的，见 §4-2                                             |
| 围住小猫：只能点符合规则的格子放路障 | B（有缺陷） | 能部分混过去                                              | 益智分支可能也收了                 | **半真**：知识变成“找字”，策略被规则掐死；字随机分布时可能根本围不住 | 改成“**字决定猫的路**”，路障哪里都能放，见 §4-3 |
| 声调钢琴：4 列 = 4 声         | A      | 不能，但本质是限速四选一                                            | 和赛车四选一同构                   | **偏换皮**，另有多音字、变调（一、不）、轻声没有列的问题 | 降级为“背诵钢琴”，见 §4-5 |
| 歌词钢琴：每行点“下一个字”    | A+     | 不能；而且连起来是一整首                                            | 内容若用 twisters 会和节拍绕口令撞 | **可以**               | 改用古诗、课文、readaloud；干扰字选同音字或形近字                                  |
| 拼音填色：选 qīng 色，找所有读 qīng 的字 | A（搜索） | 不能，但读 qīng 的常用字很少，是“找字”任务                | 无                                 | **弱**                 | 改成**声调填色**：调色板就是 4 个声调加轻声，每块区域的颜色 = 那个字的声调；开发时用生成器的 `kMeansColorRestrictions` 把图限定成 5 色。P4 版调色板换成 5 个部首 |
| 量词衣柜：顾客说“一顶红色的帽子” | 换皮  | **能**：名词“帽子”已经指明了东西，量词是多余信息                     | 无                                 | **换皮**               | 抽屉**只标量词**（顶、件、条、双、副、只），顾客只说名词（“我要红裙子”），孩子得知道裙子在“条”抽屉才找得快；再用量词表达数量：“一只袜子”给 1 只，“一双袜子”给 2 只 |
| 侦探画像：读描写拼出嫌疑人    | C      | 不能                                                                | 无                                 | 真融合，但**不会动**   | 改成“**人群里找人**”：notion-avatar 拼出的路人从屏幕走过，读描写（含“没有戴眼镜”这类否定），在人走出屏幕前点中 |
| 汉字精灵扭蛋：卡背有拼音和组词 | 装饰 | 能：卡背可以不看                                                    | 无                                 | **换皮加赌博化风险**   | 改成**孵字蛋**：蛋自己选、不随机；蛋上是部件剪影，在街机里答对这些字就给蛋“加温”；保留拉杆、胶囊抖动、礼花这些惊喜动画，去掉概率 |
| 字田：成熟时间 = 复习间隔     | 调度   | 这是复习调度，不是游戏                                              | 无                                 | **好**：唯一让复习“自己回来”的设计 | 收获 = 打一局含到期字的街机（沿用 `ctx.review`）；枯萎可以救回；**不要**照搬原作的能量限流 |
| 电子宠物：需求写成汉字        | C（词汇小） | 不能，但“饿、渴、困、脏、病”几天就学完了                     | 无                                 | 可以，但天花板低       | 用 words 词库扩大“我想吃___”的范围；宠物每天来一封信（stories 短文）；**只做睡着或闹脾气，不做死亡或爆炸** |
| 学舌小猫：语音识别逐字比对    | 说话   | 要读出来                                                            | 声音火箭已经用了麦克风音量         | 可以，但 ASR 靠不住    | **先做回声**：录音后加速回放，不依赖识别也好笑；ASR 比对只在支持的浏览器里当彩蛋，**不用 ASR 给孩子判分**（儿童语音、新加坡口音、Safari 和 iframe 的限制）[推断] |
| 方位词装修（isomer 等距视图） | C      | 不能                                                                | 无                                 | 真融合，但**等距视角让左右前后有歧义** | 用 kawaii-room-maker 那种正面 2D 房间，考上下、左右、里外；前后留给 P4 |
| 魔法毛笔：写对“雨”就下雨      | 写字   | 不能（HanziWriter 判笔画）                                          | 写字打怪兽已经是“写对就发射”        | 可以，偏创作           | 作为 P2 的奖励画板：写对的字变成可以拖着画的“活印章”                                |
| 笔顺 osu：按笔顺依次冒圈      | A→无   | **能**：圈一个一个出来，照着点就行，不需要知道笔顺                   | 写字打怪兽                         | **换皮**               | 一次显示所有笔画起点，**不标序号**，孩子按正确笔顺踩拍点；点错顺序算 Miss                   |
| 字锦鲤：部件配种成字          | B      | 不能                                                                | 和偏旁钓鱼、合成大汉字重叠          | 真融合但冗余           | 不单独做；可以做合成大汉字的图鉴皮肤                                                |
| 动物语 NPC                    | 装饰   | —                                                                   | —                                  | 只是组件               | 只当 NPC 配音；声调滑音要改源码                                                     |

---

## 4. 本分支最值得做的 5 个（含改进后的融合设计）

### 4-1 合成大汉字 ★★★（两个孩子都适合）

- **仓库**：https://github.com/moonfloof/suika-game ，代码可复用（Unlicense）。参考 https://github.com/kusazh/hanzi ，只借鉴玩法。
- **为什么排第一**：
  - 物理掉落、连锁、堆到顶线就输，“会动”，也有“再来一局”的冲动；
  - 核心是 B 型：懂部件的孩子会规划落点，不懂的只能碰运气；
  - kus.ai 已经证明“部件碰撞自动成字”能玩 [实测试玩]。
- **对原创意的 4 处修正：**
  1. **删掉生僻字。** 焱、砳、叒、垚不在小学常用字里 [推断]。叠字链只留林森、昌晶、吕品、从众、双、炎。叠字（木 + 木 → 林）用的正好是原作“同级合并”的直觉，适合 P2 入门。
  2. **词语球合成后“爆开”，不要变大。** 原设计里“朋友”球不能继续合并，会变成占地方的死球。改成：朋 + 友碰到 → 爆成星星、读出“朋友”、腾出空间。这样认词直接等于“活下去”。
  3. **出球要防卡死。** 大约 70% 的球是“场上已经有搭档”的部件，其余随机 [推断，需调参]；保留原作的“下一个”预告（`nextFruitImg`），kusazh 没有预告。
  4. **合并规则用 kusazh 的做法**（`partDict[a+b]`，自动合并），但结果字只从 chars 和 build 题库里选，不从全字典随机。合成出新字时 TTS 读“清，清水的清”。
- **分级：**
  - P2：叠字，加 5–6 个常见偏旁（口、木、日、氵、亻、扌）配常用右部件；
  - P4：偏旁全池，加词语爆破，加连锁加分。
- **技术：** matter-js 0.20.0 从 cdnjs 加载；水果 PNG 换成 Canvas 画的果冻球，上面写楷体字。kusazh 的“字形轮廓当刚体”第一版不做，因为要内嵌字体，体积大。

### 4-2 华文小吃店 ★★★（P2 听单，P4 读长单）

- **仓库**：https://github.com/DigitalCyberSoft/pizzashop ，没有许可证，**只借鉴玩法**；Kenney 的 CC0 音效可以单独用 [原文]。
- **核心要照搬的是想法，不是代码**：订单先生成结构化 spec，句子从 spec 渲染出来，评分按 spec 比对，并接受所有等价解 [原文]。这保证“读懂才能做对”，而且不需要解析孩子的输入。
- **把原作的“分数 / 百分比”阶梯换成华文特有的语法阶梯：**
  - P2：数量加量词（一碗、两串、三杯）、颜色、“不要”、简单方位。叠冰淇淋最直观：“最下面是巧克力，中间是草莓，最上面是香草”。
  - P4：“除了……都……”“只……”“一半……另一半……”“如果……就……”“先……再……”；再加**改单**，例如顾客中途说“哎呀，我改一下：不要葱了”，考听力里的转折。
- **会动：** 顾客排队、耐心条、上菜时硬币飞出、做得快有小费。
- **场景：** 新加坡小贩中心，卖鸡饭、叻沙、冰淇淋面包、珍珠奶茶。配料名取自 words 词库，点一下就读。
- **规模：** 先做约 10 级的中文 MVP，大约 700–1000 行 [推断]；不要对标原作的 30 级。

### 4-3 围住小猫·字路版 ★★★（两个孩子都适合）

- **仓库**：https://github.com/ganlvtech/phaser-catch-the-cat ，MIT，代码可复用。主场景 `mainScene.ts` 10KB，寻路 `nearestSolver.ts` 6KB [实测]。猫的 SVG 来源没有说明，像 2014 年“围住神经猫”的原图 [推断]，**要自己画猫**。
- **原创意的问题**：“只有写三点水的格子能放路障”会带来三个后果：
  - 知识退化成“找字”；
  - 符合规则的格子可能离猫很远，原作最好玩的“预判围堵”没了；
  - 字随机分布时，局面可能根本围不住。
- **改法：字决定猫的路。**
  - 路障**哪里都能放**，原作的策略完整保留。
  - 猫**只能踩某一类字**：“水猫只踩带氵的字”“这只猫只踩第一声的字”。孩子必须看懂哪些格子是猫的路，才不会把路障浪费在猫根本不会走的格子上。浪费一步，猫就多走一步。
  - **P4 版“词语接龙猫”**：猫只能跳到能和脚下这个字组成词的相邻格子（花 → 园 → 林……），整个棋盘就是一张词语图。
  - 生成关卡时，用仓库自带的 solver 验证“N 个路障内一定能围住”[推断]。
- **注意：**
  - 原作画布尺寸固定，528px 宽时棋盘会横向溢出 [实测截图]，要改成自适应；
  - 棋盘从 11×11 缩到 9×9，手机上字才看得清。
  - 益智分支可能也收了这个仓库，请主线程去重。

### 4-4 字田 + 孵字蛋（元游戏层）★★

- **仓库**：
  - https://github.com/appleweiping/paradise-isle ：MIT；只有 1 个 commit，含 `.claude/`，建议只借概念；
  - https://github.com/gavilanbe/gacha-zoo ：MIT，开蛋动画代码可复用；
  - 可选 https://github.com/danielbrendel/krepagotchi-game ：MIT，只借“需求 → 行动”的照顾循环。
- **为什么要做**：家长要的是“会动的游戏”，所以主角仍然是街机；这一层负责**让孩子每天回来**，把复习调度变成可以看见的东西。
- **字田**：每个生字是一株苗，“成熟” = 到了复习时间。收获 = 玩一局包含到期字的街机，用现有的 `ctx.review` 喂错题和到期字。过期的苗会枯萎，但**永远可以救回**。
- **孵字蛋替代扭蛋**：
  - 蛋自己选，不随机；
  - 蛋上画着部件剪影（例如“森森”是三个木）；
  - 在街机里答对相关的字，蛋就“加温”；
  - gacha-zoo 的拉杆、胶囊抖动、礼花动画照用，**去掉概率、交易市场和联网**。
- **不要照搬的**：paradise-isle 的能量值（每 90 秒回 1 点，是手游的限流套路）、斗兽战斗、NPC 捣蛋。

### 4-5 背诵钢琴 ★★（P4 冲速度，P2 慢速加 3 条命）

- **仓库**：https://github.com/arcxingye/EatKano ，MIT，代码可复用：`static/index.js` 643 行，有计时、无尽、练习三种模式 [实测源码]。要去掉 5 个外链、PHP 排行榜和鹿乃立绘。
- **玩法**：
  - 每行 4 块，只有古诗、课文或 readaloud 段落里的“下一个字”是对的；干扰字选这个字的同音字或形近字。
  - 点对一块，就用 WebAudio 放出下一个五声音符，连起来“弹完”一整首。
  - 越弹越快，逼出背诵的流利度。
- **为什么不是声调钢琴**：4 列 = 4 声只是限速的四选一，和赛车同构。而且多音字、变调（一、不）、轻声都没有列可放；一错就死，对 P2 太狠。声调钢琴可以留作练习模式，不当主玩法。
- **避免重复**：不用 twisters（节拍绕口令已经在用）；听写词的“按字序接字”接字篮已经在做，也不重复。

### 兼顾 P2 女孩的备选（★★）

- **量词衣柜**：https://github.com/wolfderechter/DollMaker ，MIT，PNG 约 0.93MB 可以直接内嵌。玩法按第 3 节改：抽屉只标量词，用“只 / 双”表达数量。
- **人群里找嫌疑人（P4 也爱）**：https://github.com/Mayandev/notion-avatar ，素材 CC0。
- **魔法毛笔**：https://github.com/vikrum/kidpix ，GPL-3.0，只借设计。写对的字变成能拖着画的“活印章”，TNT 橡皮那种搞怪音效用 WebAudio 合成。
- **学舌小猫**：https://github.com/JohnSpahr/MyTalkingRon ，CC0。先做回声，ASR 只当彩蛋。

---

## 5. 删除和降级的理由

- **删除 SamToki/KanaMaster**：
  - 实际是限时三选一答题，不是下落音符 [实测]；
  - GPL-3.0，README 还说美术设计保留版权 [原文]；
  - 它的计分层（血量、连击、反应时间）现有街机都有了。
- **删除 KyleMit/Splotch**：
  - 面向 2 岁以上幼儿 [原文]，对 8 岁偏幼；
  - 魔法刷揭图用 `destination-out` 大约 20 行就能做 [推断]；
  - 仓库 1.39GB [实测]，没有必要引用。
- **降级：**

| 仓库              | 降级原因                                                                          |
|-------------------|-----------------------------------------------------------------------------------|
| webosu            | 没有能玩的 demo，链接指向广告跳转页；笔顺 osu 的概念自己写不到 100 行               |
| vue-color-avatar  | 只有头肩像，只适合做“玩家头像”                                                    |
| isomer            | 等距视角让方位词有歧义                                                            |
| Koi               | 没有网页试玩，而且与偏旁钓鱼、合成大汉字重叠                                        |
| Restaurant        | 被 pizzashop 的机制覆盖，“先……再……”又和贪吃蛇排句重叠                             |
| chrome-music-lab  | 已归档，“看声调轮廓”对有华文底子的孩子边际价值低（他们多半发音没问题，弱在标调和认字）[推断] |

---

## 6. 执行记录（可复查）

- `gh api repos/{23 个仓库}`，取 stargazers_count、license.spdx_id、pushed_at、created_at、archived、size、homepage。
- LICENSE 原文：suika-game/LICENSE、animalese.js/LICENSE.md、Koi/LICENSE.md、webosu/LICENSE 与 LICENSE-CC-BYNC.md、MyTalkingRon/LICENSE。
- `gh api repos/DigitalCyberSoft/pizzashop/license` → 404。
- 文件树：
  - vue-color-avatar 的 `src/assets/widgets`、notion-avatar 的 `public/avatar/part`；
  - DollMaker 的 images，gacha-zoo 的根目录（m4a 合计），paradise-isle 的 src（63 个文件，366KB）与 `.claude`；
  - catch-the-cat 的 src 与 assets，kusazh/hanzi 的 tools。
- 源码：
  - suika `index.js`（`wc -l` = 401）、pizzashop `game-core.js`（`wc -l` = 2383）、EatKano `static/index.js`（643）与 index.html 外链；
  - kusazh `index.html` 的 `mergeZi`、animalese.js、MyTalkingRon 的 ron2.js。
- curl：25 个 demo 或 homepage（含 drake7707 旧地址、tombofry 旧地址、game.krepagotchi.com、restoran-oyunu 跳转、osugame.online 页面内容）。
- 浏览器截图：suika 标题页、catch-the-cat 棋盘、pizzashop 的 `#play` 订单、kus.ai/hanzi 试玩（网络请求里有 dictionary.json 和 SourceHanSerifTC-Heavy-Subset.otf，都返回 200）。
- 现有玩法对照：`/Users/hainan/Projects/huawen-island/SPEC_ARCADE.md` §4，只读。
