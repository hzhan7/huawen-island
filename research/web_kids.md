# 新加坡 P2 女孩 / P4 男孩喜欢什么：游戏、IP 与儿童游戏设计原则（2024–2026 调研）

> 调研日期：2026-09-18（新加坡时间）。服务对象：「华文小岛」2.0 玩法设计。
> 证据等级标注：
> - 【实测】我在 2026-09-18 用 curl 直接拉到的一手数据（Roblox 官方 API、Apple App Store 新加坡区 RSS）
> - 【原文】我打开了原网页或论文，内容来自原文
> - 【摘要】只看到搜索引擎摘要，没打开原文，可信度低一档
> - 【推断】我自己的推论或设计建议，不是任何来源的结论

---

## 0. 一页结论

1. **新加坡本地没有公开的「具体游戏 × 年龄 × 性别」儿童调查**（MCI/MDDI 的调查只报告游戏时长和风险，不点名游戏）。所以本文用三类证据互相印证：新加坡本地信号（政府调查、本地新闻、App Store 新加坡区榜单）；同类城市/市场的大样本调查（澳大利亚 Roy Morgan 2025、英国 Childwise 2025、日本小学馆 2025）；Roblox 平台实时数据。
2. **Roblox 是这个年龄段的第一平台**：澳大利亚 8–9 岁 66%、10–11 岁 69% 在玩【原文】；新加坡 App Store 免费游戏榜第 3、畅销榜第 12【实测】；新加坡本地新闻里有 9 岁男孩偷家里约 S$6,000 买 Roblox 礼品卡的报道【原文】。
3. **今天 Roblox 最热的几乎全是同一种回路：「蛋 → 孵化 → 稀有宠物 → 收益 → 升级 → 再去拿更稀有的蛋」**。2026-09-18 在线人数第 1 名 Steal An Egg 有 249 万人同时在线，前 15 名里 Adopt Me!、Ride A Pet、Jump for Animals!、Fish It! 都是这一类【实测】。
4. **跨性别共享的是**：冒险/探索、角色扮演、养宠物、收集、荒诞幽默（Italian Brainrot 在日本同时是低年级女生流行语第 1、男生第 2【原文】）。**差异主要在题材**：男孩更多格斗/射击/动作，女孩更多时装/音乐/派对，但「冒险」两性都是 43%【原文】。
5. **流行 IP 换得很快**：Grow a Garden 2025-08 峰值 2,230 万同时在线【原文】，到 2026-09-18 只剩约 3.3 万，排第 39【实测】。所以要借的是**回路和机制**，不是某个 IP 的外形（何况 IP 外形有版权）。
6. **研究里最硬的三条设计原则**：
   - **学习内容就是玩法本身**（intrinsic integration）：7–8 岁孩子自由选择时，玩这种版本的时间是「答题换游戏」版本的 **7 倍**（75.7 分钟 vs 10.28 分钟），而且学得更多【原文】。这正是 1.0「题卡+按钮」失败的原因。
   - **多次短局优于单次长局**，而且画面简洁、剧情少的教育游戏效果反而更好【原文】。
   - **竞争和合作结合**最有效【原文】，正好适合兄妹两人一起玩。

---

## 1. 新加坡本地信号

| 信号 | 内容 | 等级 | 来源 |
|---|---|---|---|
| MCI 青少年游戏调查（2022-10 至 2023-02，810 名 10–18 岁青少年及家长） | 47% 每天玩游戏，且通常每次 ≥2 小时；只有 31% 的家长完全清楚孩子和谁一起玩，25% 完全不清楚；只有 48% 的家长能准确估计孩子的游戏时长。**没有点名具体游戏** | 原文 | https://www.mddi.gov.sg/newsroom/survey-on-childs-online-gaming-activities/ |
| MDDI 家长数字使用研究（2025-02，孩子 2–17 岁） | 在孩子使用设备的家长中，94% 说孩子用设备做休闲活动，**以看视频和玩游戏为主**。没有游戏名 | 原文 | https://www.mddi.gov.sg/newsroom/mddi-study-shows-most-parents-guide-children-s-digital-use-but-would-like-more-support/ |
| MOH「Grow Well SG」屏幕指引（2025-01-21） | 7–12 岁儿童的休闲屏幕时间建议**每天少于 2 小时**（学校功课除外） | 原文 | https://www.moh.gov.sg/newsroom/grow-well-sg-to-support-families--in-building-healthy-habits-in-children-/ |
| Mothership 2025-10-11 | 新加坡一名 9 岁男孩偷家里近 S$6,000 买 Roblox 礼品卡（账户里有 23 万多点） | 原文 | https://mothership.sg/2025/10/boy-steals-6000-roblox/ |
| Mothership 2020 | 新加坡一名 5 岁女孩一个月在手游里花了近 S$1,500 | 摘要 | https://mothership.sg/2020/08/roblox-singapore-girl-1500/ |
| 新加坡宝可梦卡热潮（ANN 转载 ST，2026-05） | 2026 年五一期间两场卡牌展共约 1–1.2 万人次；现场有 12 岁男孩带着估值约 $2,000 的评级卡讨价还价 | 原文 | https://asianews.network/cash-cards-and-charizards-inside-singapores-pokemon-trading-boom/ |
| 哪吒之魔童闹海 | 全球票房约 22 亿美元，影史动画片第一；2025-03-06 在新加坡上映 | 摘要 | https://en.wikipedia.org/wiki/Ne_Zha_2 ； https://geekculture.co/worlds-top-grossing-animated-film-ne-zha-2-to-premiere-in-singapore-mar-2025/ |

### 1.1 App Store 新加坡区游戏榜【实测，2026-09-18 22:06 SGT 拉取】

注意：这是全年龄榜单，不是儿童榜，只能当旁证。数据来源：`https://itunes.apple.com/sg/rss/{topfree|toppaid|topgrossing}applications/limit=100/genre=6014/json`；Family 子类是 genre=7009。

- **免费游戏榜**：Roblox 第 3｜Hay Day 第 19｜Pokémon GO 第 39｜Among Us 第 47｜Plants vs. Zombies 2 第 53｜Brawl Stars 第 59｜Magic Tiles 3（钢琴节奏）第 60
- **付费游戏榜**：**Minecraft 第 1**｜Bloons TD 6 第 2｜Geometry Dash 第 3｜Stardew Valley 第 5｜Papa's 系列烹饪经营游戏有 6 款进前 30（第 11/14/22/23/25/29）｜Pou 第 16｜Terraria 第 26
- **Family 免费榜**：Hay Day 第 1｜UNO 第 5｜Crossy Road 第 16｜Cooking Mama 第 18｜Sky: Children of the Light 第 19｜My Talking Angela 第 22｜**Eggy Party（蛋仔派对海外版）第 26**
- **游戏畅销榜**：Roblox 第 12｜Pokémon GO 第 15

【推断】付费榜能看出家长愿意花钱的方向：Minecraft 类创造、塔防、节奏跑酷，以及 Papa's 系列那种「限时接单 → 做菜 → 顾客打分」的经营游戏，这些都有明显的儿童/家庭属性。

---

## 2. Roblox：现在孩子们在玩什么

### 2.1 实时在线排行【实测：Roblox explore-api `get-sorts`，2026-09-18 22:07 SGT；人数是全球同时在线】

新加坡周五 22:07 相当于美东周五上午（美国孩子在上学），所以只是这一刻的快照。

| # | 体验 | 同时在线 | 上线日期 | 官方描述里的核心回路 |
|---|---|---|---|---|
| 1 | Steal An Egg | 2,488,114 | 2026-07-25 | 偷蛋 → 孵出稀有宠物 → 宠物产钱 → 升级跑步机和基地 → 训练速度 → 去偷别人的蛋（不到 2 个月累计 39.6 亿次访问） |
| 2 | Brookhaven RP | 490,347 | 2020-04 | 小镇角色扮演：房子、车、宠物，「想当谁就当谁」 |
| 3 | Blox Fruits | 407,858 | 2019-01 | 动作 RPG：练剑、吃果实拿能力、打 Boss、出海 |
| 4 | Murder Mystery 2 | 286,478 | 2014 | 12 人一局的躲猫猫推理（无辜者/警长/凶手） |
| 6 | RIVALS | 220,304 | 2024-05 | 1v1 到 5v5 的 FPS 对战，先拿 5 分获胜 |
| 7 | 99 Nights in the Forest | 205,610 | 2025-03 | 和朋友一起在森林里建营地，撑过 99 夜 |
| 8 | Adopt Me! | 176,682 | 2017 | 领养并养大宠物、交易、收集传说宠物、布置梦想之家；有每日星星奖励和连续登录 28 天送蛋 |
| 9 | Ride A Pet | 164,971 | 2026-04 | 在地图上找蛋 → 孵出更快的宠物 → 骑着去找更稀有的蛋 → 变异 |
| 12 | Jump for Animals! | 135,087 | 2026-08 | 练跳跃力 → 跳上新区域 → 从巨兽那里偷蛋带回家 → 孵化稀有动物 |
| 13 | Steal a Brainrot | 121,327 | 2025-05 | 买 Brainrot 角色 → 被动产钱 → 偷别人的/防守自己的 → 转生 |
| 14 | Fish It! | 88,767 | 2024-10 | 钓鱼收集，号称有 100 万种以上变体 |
| 15 | Dress To Impress | 83,338 | 2023-10 | 按主题换装 → 走秀 → 互相打星 |
| 39 | Grow a Garden | 32,990 | 2025-03 | 种菜 → 收获 → 卖钱 → 买更稀有的种子 |

API 调用：`https://apis.roblox.com/explore-api/v1/get-sorts?sessionId=…&device=computer&country=sg`；详情：`https://games.roblox.com/v1/games?universeIds=…`

### 2.2 各爆款的纪录和机制（2025 年）

| 体验 | 纪录 / 规模 | 核心机制 | 等级与来源 |
|---|---|---|---|
| Grow a Garden | 2025-03-26 上线，由一名 16 岁少年 3 天做出来；2025-06-21 同时在线 2,130 万，08-23 达 2,230 万；约 35% 玩家不满 13 岁 | 种子 → 作物**离线也会长** → 收获卖钱 → 买更奇特的种子；每周限定物品提高留存；宠物来自抽奖箱；背景音乐是莫扎特《土耳其进行曲》 | 原文 https://en.wikipedia.org/wiki/Grow_a_Garden |
| Steal a Brainrot | 2025-05-16 上线；2025-10 同时在线 2,540 万，是第一个超过 2,500 万的游戏 | 传送带上买角色 → 被动产钱 → 偷与守（像夺旗）→ 转生。**有「孩子因为角色被偷而哭」的视频传播**；有付费赢的批评 | 原文 https://en.wikipedia.org/wiki/Steal_a_Brainrot |
| Adopt Me! | 截至 2025-11 累计 408 亿次访问；同时在线峰值 192 万 | 蛋孵宠物 → 照顾宠物长大 → 4 只长大的同种宠物合成 Neon，Neon 再往上合成 Mega Neon → 交易 → 布置房子。有澳洲孩子花掉 8,000 澳元 | 原文 https://en.wikipedia.org/wiki/Adopt_Me! |
| Dress to Impress | 2023-11 上线；与 Charli XCX 联动后同时在线峰值 65.1 万 | 限时按主题搭配 → T 台走秀 → 其他玩家打 1–5 星 → 前三名上领奖台 | 原文 https://en.wikipedia.org/wiki/Dress_to_Impress |

### 2.3 同类市场的儿童调查

**澳大利亚 Roy Morgan「Young Australians」（2025 年 4–12 月，6–13 岁的 Roblox 玩家 n=792）**【原文】https://www.roymorgan.com/findings/10136-yas-roblox-for-young-australians-survey-december-2025

- 6–13 岁有 61% 玩 Roblox。按年龄：6–7 岁 41%，**8–9 岁 66%**，**10–11 岁 69%**，12–13 岁 70%
- 最常玩的类型：冒险 43%，动作 37%，模拟 32%
- 最喜欢的单款：Dress To Impress 7%，Adopt Me! 5%，Grow a Garden 5%，Brookhaven 4%，Blox Fruits 4%（很分散，没有哪款占绝对多数）
- **性别差异**（男 vs 女，在各自性别的 Roblox 玩家中）：

| 类型 | 男孩 | 女孩 | 说明 |
|---|---|---|---|
| 格斗 | 45% | 10% | 男孩明显更高 |
| 射击 | 38% | 6% | 男孩明显更高 |
| 动作 | 49% | 23% | 男孩明显更高 |
| 时装 | 6% | 45% | 女孩明显更高 |
| 音乐 | 8% | 22% | 女孩明显更高 |
| 派对 | 14% | 26% | 女孩明显更高 |
| **冒险** | **43%** | **43%** | **两性相同** |
| **角色扮演** | **26%** | **29%** | **两性接近** |

**英国 Childwise「Playground Buzz」2025 夏季（2025 年 6–7 月，1,360 多名 3–12 岁儿童）**【摘要，经 Kidscreen 2025-10-17 转述】https://kidscreen.com/2025/10/17/which-roblox-games-are-kids-favorites/

- 7–12 岁最喜欢的 Roblox 游戏前三：Grow a Garden、Dress to Impress、Adopt Me
- 角色扮演是这几款的共同点，「尤其受女孩欢迎」
- Roblox 是 7–12 岁玩手游的首选

**英国/美国 Beano Brain（2025）**【原文】https://insights.beanobrain.com/gen-alpha-open-world-gaming ； https://insights.beanobrain.com/the-top-3-gaming-genres-for-gen-alpha

- 62% 的孩子经常玩游戏
- Gen Alpha 最喜欢的三大类型：大逃杀、策略、大亨经营（Tycoon）
- 开放世界吸引孩子的原因：自由、没有固定路线；可以自定义形象来表达自己（在同伴中是「社交货币」）；**「和朋友在一起」是孩子最喜欢的一点**；能练出技能

**日本小学馆 JS 研究所 × 《コロコロコミック》研究所「2025 小学生年度趋势」（2025 年 4–10 月，每项约 900–1,000 人；读者群：《ぷっちぐみ》低年级女生、《コロコロ》男生、《ちゃお》高年级女生）**【原文】https://prtimes.jp/main/html/rd/p/000000018.000140019.html

- 流行语：低年级女生第 1 名「Italian Brainrot」，第 2 名「Tung Tung Tung Sahur」；男生第 1 名「火影跑/Naruto 舞」，第 2 名「Italian Brainrot」
- 女生在玩的游戏：第 1 名《集合啦！动物森友会》，第 2 名 Minecraft，第 5 名 Roblox
- 男生想要的游戏：第 1 名《大金刚 Bananza》，第 2 名《马力欧赛车 World》，第 5 名《超级马力欧派对 空前盛会》
- 男生想要的玩具：第 1 名「战斗陀螺 X（Beyblade X）」，第 4 名宝可梦卡，第 5 名 Duel Masters

【推断】日本和新加坡同属东亚大城市，孩子接触的 Nintendo、宝可梦、三丽鸥、Brainrot 内容高度重合，所以这份数据的参考价值高于英美数据。

---

## 3. 其他 IP 速览（为什么吸引孩子）

| IP | 2024–2026 热度证据 | 吸引点 | 等级与来源 |
|---|---|---|---|
| **Minecraft** | 《我的世界大电影》2025 年全球票房约 9.6 亿美元；新加坡 App Store 付费榜第 1【实测】；日本女生在玩的游戏第 2【原文】 | 自由建造、探索、生存，和朋友一起搭世界；英国 Ofcom 定性研究里有孩子用它「让自己平静」 | 摘要 https://www.boxofficemojo.com/release/rl746096129/ ；Ofcom 摘要 |
| **宝可梦** | 《宝可梦传说 Z-A》截至 2025-12-31 销量 1,230 万；2026-03-05 推出生活模拟游戏《Pokopia》；新加坡卡牌热 | **收集图鉴**、稀有度、进化、交换、对战 | 摘要 https://www.rpgsite.net/news/19498-pokemon-legends-z-a-has-sold-123-million-copies-as-december-31-2025 ；https://www.pokemon.com/us/pokemon-news/pokemon-pokopia-launching-on-march-5-2026-is-available-for-preorder-now |
| **马力欧赛车 World** | Switch 2 首发，2025 年 11 月 Nintendo 财报时已卖 957 万套；日本男生想要的游戏第 2 | 短局（一场几分钟）、道具逆转、家人同屏对战 | 摘要 https://www.shacknews.com/article/146659/mario-kart-world-november-2025-nintendo-sales |
| **Brawl Stars** | Supercell 2024 年创纪录，Brawl Stars 收入比 2023 年翻倍多；新加坡免费榜第 59【实测】 | 约 3 分钟一局、角色收集与升级、组队 | 摘要 https://gameworldobserver.com/2025/02/11/supercell-record-revenue-2024-new-mistakes-strong-teams |
| **Toca Boca World** | Toca Boca 全系列下载超过 10 亿次 | 开放式过家家：没有分数、没有计时，自己编故事和布置场景 | 原文 https://en.wikipedia.org/wiki/Toca_Boca |
| **三丽鸥** | 2025 年角色人气投票：布丁狗第 1（561 万票），大耳狗第 2，帕恰狗第 3，库洛米第 4，Hello Kitty 第 5；总票数 6,316 万 | 可爱形象、贴纸/小物收集、角色认同 | 摘要 https://www.sanrio.co.jp/special/characterranking/2025/en/result/ |
| **蛋仔派对 / Eggy Party** | 网易出品；2023-09-08 在东南亚上线；国服 2022-12 日活 4,733 万；2023 年初每周上传 100 多万张 UGC 地图；新加坡 Family 免费榜第 26【实测】 | 圆滚滚的角色、32 人淘汰闯关、自己做地图、皮肤盲盒；在中国小学生中是「社交货币」（「蛋搭子」） | 原文 https://zh.wikipedia.org/wiki/蛋仔派对 ；https://news.pedaily.cn/202307/518020.shtml |
| **动物森友会** | 日本女生在玩的游戏第 1 | 岛屿布置、收集家具/虫/鱼、每天回来看看 | 原文（小学馆） |
| **KPop Demon Hunters** | 2025-06-20 在 Netflix 上线，成为 Netflix 史上观看最多的原创作品；歌曲《Golden》获 2026 年奥斯卡最佳原创歌曲 | 偶像、唱歌驱魔、姐妹团，女孩男孩都喜欢 | 摘要 https://en.wikipedia.org/wiki/KPop_Demon_Hunters |
| **Italian Brainrot** | 日本低年级女生流行语第 1、男生第 2；Roblox 上的 Steal a Brainrot 创下同时在线纪录 | **押韵的荒诞名字**（Tung Tung Tung Sahur、Ballerina Cappuccina）、AI 生成的混搭生物、洗脑配乐 | 原文（小学馆）；https://en.wikipedia.org/wiki/Italian_brainrot |
| **哪吒 2 / 西游记 / 黑神话** | 哪吒 2 是影史动画票房第一 | 中国神话英雄、变身、法宝。**是华文游戏里唯一可以合理自己改编的「本土 IP」类型**（神话本身是公版） | 摘要 |

---

## 4. 为什么吸引他们：六种核心驱动力

| 驱动力 | 代表 | 证据 | 对华文小岛的含义【推断】 |
|---|---|---|---|
| **收集 + 稀有度** | 宝可梦、Adopt Me、Steal An Egg、Fish It | 实时在线前 15 名里有 5 款是「蛋/宠物/收集」回路【实测】 | 每学会一个字/词就得到一张「字宠」卡，按掌握程度分稀有度 |
| **养成 + 离线成长** | Grow a Garden、Adopt Me、动物森友会 | 作物离线也会长，每周有限定物品【原文】 | 词语种子「隔天才成熟」，正好对应间隔复习 |
| **自定义形象 / 布置** | Dress to Impress、Toca、Brookhaven、动森 | 自定义能在同伴中提升地位【原文 Beano】；女孩玩时装类的比例 45% vs 男孩 6%【原文 Roy Morgan】 | 用奖励布置自己的岛和小屋、给角色换装，这些要作为「可以选」的选项，不强迫 |
| **社交 / 一起玩** | Brookhaven、99 Nights、马力欧赛车、蛋仔 | 「和朋友在一起」是孩子最喜欢的一点【原文】；竞争+合作对行为结果最有效【原文】 | 兄妹同屏合作（共同守护营火）+ 友好对抗（赛车、比分） |
| **竞速 / 对战 / 短局** | 马力欧赛车、Brawl Stars、RIVALS、MM2 | 男孩在格斗/射击/动作类别明显更高【原文】 | 60–180 秒一局，分数和最佳纪录一目了然 |
| **升级 / 转生 / 数字变大** | Blox Fruits、Steal a Brainrot 转生、Tycoon 类 | Tycoon 是 Gen Alpha 三大类型之一【原文】 | 等级、连击、「转生」换皮肤；数字越来越大的爽感 |
| **荒诞幽默 + 押韵** | Italian Brainrot | 两性都排前二【原文】 | **绕口令、押韵儿歌天然就是「华文版 Brainrot」**：比如给怪兽起押韵的中文名字 |

---

## 5. 性别和年龄：有差异，但不要做成刻板印象

**有据可查的差异**：

- 男孩：格斗、射击、动作明显更高；女孩：时装、音乐、派对明显更高（Roy Morgan 2025）【原文】
- 在年纪更大的初中生里：男孩偏好「动作/策略」玩法，女孩偏好「创造」玩法，而**「探索」对所有孩子都有吸引力，女孩尤甚**；93% 的孩子想要和自己同性别的角色；**50% 的孩子宁愿自己琢磨，也不想要提示或答案**（Kinzie & Joseph 2008，ETR&D，样本是 middle school，比我们的两个孩子大 2–4 岁）【原文，经 platipy 摘要】 https://link.springer.com/article/10.1007/s11423-007-9076-z ；https://platipy.readthedocs.io/en/latest/research/kinzie2008.html
- 7–12 岁的角色扮演「尤其受女孩欢迎」（Childwise）【摘要】

**同样有据可查的共同点**：

- 冒险 43% vs 43%，角色扮演 26% vs 29%【原文】
- Italian Brainrot 在男女生中都排前二【原文】
- Roblox 最热的「蛋/宠物」回路没有性别标签【实测】

**年龄比性别更关键**：NN/g 的儿童 UX 研究（在美国、中国、以色列测试了 80 多个网站和 36 个 App）要求至少区分 3–5、6–8、9–12 岁三档，相差两岁的孩子在同一任务上表现就明显不同【原文】 https://www.nngroup.com/articles/childrens-websites-usability-issues/ ；https://www.nngroup.com/articles/kids-cognition/

- **6–8 岁（P2 女孩）**：阅读还在发展中，要用**动画演示目标和步骤**；反馈要**夸张**，细微的表情和声音她们看不懂；不要出依赖拼写的难题，要容错
- **9–12 岁（P4 男孩）**：开始能用逻辑做推理，可以上策略和规则组合，但指示依然要清楚

**建议【推断】**：

- 核心回路两人共用：探索 + 收集 + 养宠
- 在「模式」上给选择，不按性别分配：有创造/装扮/音乐类（P2 大概率会选），也有动作/对战/竞速类（P4 大概率会选）
- 难度按年级分档（P2 / P4 两套题库和速度曲线），不是按性别分档
- 角色要能自选性别和外观，因为孩子普遍想要和自己同性别的角色

---

## 6. 儿童游戏设计的可靠原则（带出处）

| # | 原则 | 证据 | 等级与来源 |
|---|---|---|---|
| 1 | **学习内容就是玩法本身，不要「先答题再玩」** | Zombie Division 研究：Study 1 有 58 名 7 岁 1 个月到 8 岁 10 个月的孩子，intrinsic 版在固定时长下学得更多；Study 2 有 16 名孩子自由选择，intrinsic 版平均玩 75.7 分钟，extrinsic 版只玩 10.28 分钟（7 倍多） | 原文（论文 PDF 已读）Habgood & Ainsworth 2011, *J. Learning Sciences* 20(2) https://shura.shu.ac.uk/3556/ |
| 2 | **多次短局**，画面简洁，剧情可以薄 | 游戏组相对非游戏组 g=0.33；**多次游戏的效果显著，单次游戏和对照组没有差别**；示意性画面优于写实画面；情境包装越重，学习效果越小（p=.01）；简单游戏化（0.53）与复杂机制（0.25）的差异不显著 | 原文 Clark, Tanner-Smith & Killingsworth 2016, *Rev. Educ. Res.* 86(1) https://pmc.ncbi.nlm.nih.gov/articles/PMC4748544/ |
| 3 | **竞争 + 合作**，加一点故事外壳 | 游戏化对认知 g=.49、动机 g=.36、行为 g=.25；「game fiction」以及「竞争与合作结合」对行为结果特别有效 | 原文（摘要）Sailer & Homner 2020, *Educ. Psych. Rev.* https://doi.org/10.1007/s10648-019-09498-w |
| 4 | **满足自主、胜任、关系三种需求**；操作要直觉 | 感知到的自主和胜任预测玩家是否享受、是否继续玩；操作越直觉，胜任感越强 | 原文（摘要）Ryan, Rigby & Przybylski 2006, *Motivation & Emotion* 30 https://selfdeterminationtheory.org/SDT/documents/2006_RyanRigbyPrzybylski_MandE.pdf |
| 5 | **挑战 + 幻想 + 好奇**；幻想要和技能绑定（intrinsic fantasy） | 挑战来自结果不确定：可变难度、多层目标、隐藏信息、随机性；认知好奇来自「让学习者觉得自己的知识不完整」 | 摘要 Malone 1981, *Cognitive Science* 5 https://onlinelibrary.wiley.com/doi/abs/10.1207/s15516709cog0504_2 |
| 6 | **自适应难度，目标正确率约 85%** | 理论推导：对梯度类学习者，最优训练正确率约 85%（出错约 15.87%）。**注意：这是在机器学习模型上推出来的，套到儿童身上是类比** | 摘要 Wilson et al. 2019, *Nat. Commun.* 10:4646 https://www.nature.com/articles/s41467-019-12552-4 |
| 7 | **四支柱**：主动、专注（少干扰）、有意义（和生活相关）、社交互动 | 教育 App 设计框架 | 摘要 Hirsh-Pasek et al. 2015, *PSPI* 16(1) https://journals.sagepub.com/doi/abs/10.1177/1529100615569721 |
| 8 | **8–12 岁儿童自己说的「好游戏」**：选择权、掌握感、朋友、创造、身份认同 | UNICEF RITEC-8 的八个维度：自主、胜任、情绪、关系、创造、身份、安全、多元包容；研究对象是 8–12 岁儿童 | 原文 https://joanganzcooneycenter.org/2024/04/30/new-research-from-unicef-innocenti-tests-the-ritec-framework-with-kids/ ；工具箱 https://www.unicef.org/childrightsandbusiness/workstreams/responsible-technology/online-gaming/ritec-design-toolbox |
| 9 | **Juice（手感）**：粒子、屏幕抖动、挤压拉伸、音效、连击数字 | 同一个灰色打砖块游戏，只加效果不改规则，体验就「活」了过来 | 摘要 Jonasson & Purho，GDC Europe 2012「Juice it or lose it」 https://www.youtube.com/watch?v=Fy0aCDmgnxg |
| 10 | **按年龄分档的 UX**：大按钮、动画指引、夸张反馈、容错 | 见第 5 节 | 原文 NN/g |
| 11 | **控制时长** | 新加坡 MOH：7–12 岁休闲屏幕时间每天少于 2 小时 | 原文 MOH |

---

## 7. 要避开的（红线）

| 风险 | 证据 | 建议【推断】 |
|---|---|---|
| 操纵性设计：拟社会压力（「角色会伤心」）、人为制造的倒计时、诱饵、导航限制、广告压力 | 3–5 岁孩子常用的 App 里**只有 20% 没有操纵性设计**；家庭社经地位越低，孩子用的 App 操纵性越强 | 摘要 Radesky et al. 2022, *JAMA Netw Open* https://jamanetwork.com/journals/jamanetworkopen/fullarticle/2793493 ——不用「不来就枯萎/死掉」的惩罚；只奖励不惩罚 |
| 付费 / 抽奖箱 | Adopt Me 有 8,000 澳元的案例；新加坡 9 岁男孩偷约 S$6,000 | 本站**完全不涉及钱**；抽蛋只用答题挣来的币，公开概率，加保底 |
| 「偷」和让人失去进度 | Steal a Brainrot 里有孩子因角色被偷而哭 | 兄妹之间不要做「偷走对方的收藏」。可以改成「一起去偷巨兽的蛋」（PvE，参考 Jump for Animals） |
| 陌生人社交 | MCI：三分之一的青少年有时或经常和陌生人一起玩；Roblox 2026-01 起全球强制年龄验证才能聊天【摘要】 | 纯单机/同屏，不做任何聊天 |
| IP 侵权 | —— | 只借机制，不用宝可梦、三丽鸥、Roblox 等的名字、角色和素材；角色原创，或用公版的中国神话（孙悟空、哪吒） |
| 流行 IP 很快过气 | Grow a Garden 从 2,230 万跌到约 3.3 万同时在线【原文 + 实测】 | 做持久的底层回路（收集/养成/短局对战），皮肤可以按季节更新 |

---

## 8. 映射到华文小岛：可借鉴的玩法原型【推断】

| 原型（来源 IP） | 华文玩法设想 | 更可能吸引谁 | 用到的题库栏目 |
|---|---|---|---|
| **孵蛋养字宠**（Adopt Me / Steal An Egg / 宝可梦） | 答对题攒「蛋能量」→ 孵出以部首为「族」的字宠（氵族是鱼、木族是树精、口族是话匣子）。同一个字答对 4 次（隔天复习）→ 合成「霓虹」金卡。图鉴按单元分区域 | 两人都会喜欢（核心回路） | chars、build、words |
| **词语菜园**（Grow a Garden） | 听写正确就种下「词语种子」，第二天才成熟（天然的间隔复习）→ 收获时要朗读或组词；连续全对会长出「变异」的金色果实 | P2 为主，P4 也可以 | words、readaloud、chars |
| **换装走秀**（Dress to Impress） | 抽一个主题（如「运动会」「中秋节」）→ 60 秒内拖选贴着词语的服饰和道具（要选和主题搭的词）→ 走 T 台 → 用看图说话/造句描述自己的造型 → 由兄妹或 AI 评委打星 | P2 为主 | talk、compose、quiz（词义） |
| **一起守营火**（99 Nights in the Forest） | 兄妹合作模式：每一「夜」有怪物靠近，两人轮流答题添柴，火越大光圈越大；第 N 夜出 Boss（绕口令挑战） | 兄妹合作 | twisters、stories、pick |
| **马力欧赛车**（已有赛车选道） | 加道具：答对拿「加速蘑菇」，连对 3 题「漂移」；保存「幽灵车」，可以和哥哥/妹妹的最佳成绩比 | P4 为主 | quiz、typo、pick |
| **Brawl Stars / 陀螺对战** | 90 秒汉字卡牌对战：出「偏旁+部件」组字当攻击，字越难伤害越高；角色卡可以升级 | P4 为主 | build、chars |
| **Brainrot 押韵怪兽** | 原创押韵中文名字的荒诞生物（如「咚咚咚·冬瓜侠」「芭蕾·咖啡喵」），每只怪兽的「咒语」就是一句绕口令，读对才能收服 | 两人都会喜欢 | twisters、readaloud |
| **偶像打节拍**（KPop Demon Hunters） | 节拍条上飘来字词，按节拍读出或点击，完美连击就放「声音护盾」驱散小怪 | P2 为主 | twisters、readaloud、pick |
| **动森式小岛**（动物森友会 / Toca） | 「华文小岛」本身做成可以布置的家园：所有小游戏挣到的家具、植物、字宠都摆在岛上。没有分数，只有「我的岛」 | 两人（尤其 P2） | 全部（作为元层） |
| **中国神话闯关**（哪吒 / 西游） | 孙悟空七十二变 = 同一个部件加不同偏旁；哪吒风火轮跑酷 + 阅读理解关卡 | P4 为主 | build、passages、order |
| **Papa's 餐厅**（新加坡付费榜多款） | 顾客用语音点菜（听力）→ 按「句子积木」顺序装盘（排句子）→ 顾客打分 | 两人 | pick、order、stories |

**通用参数建议【推断，依据第 6 节】**：

- 每局 60–180 秒，每次 3–5 局就结束（配合 MOH 每天 2 小时上限）
- 按正确率自适应难度，目标约 80–85%
- 每一次按键都要有 juice：粒子、音效、连击数字
- 奖励只加不减，没有「不来就死」的惩罚
- 兄妹同屏时一局合作、一局友好对抗

---

## 9. 数据缺口与不确定性

- 新加坡没有公开的「P2/P4 × 具体游戏 × 性别」数据。本文用澳洲、英国、日本数据推到新加坡，属于**推断**。新加坡孩子的华人家庭背景可能让中国 IP（蛋仔、哪吒）的渗透率高于澳英，但没有数据证实。
- Roblox 实时排名受时段影响很大：抓取时是美国上学时间，亚洲晚上。
- App Store 榜单是全年龄的。
- Childwise、Ofcom 的完整报告要付费或无法访问，相关数字标为【摘要】。
- Kinzie & Joseph 2008 的样本是初中生。
- Wilson 2019 的 85% 规则来自机器学习推导。

## 10. 来源清单

**一手/实测**
- Roblox Explore API（实测 2026-09-18）：https://apis.roblox.com/explore-api/v1/get-sorts ；Games API：https://games.roblox.com/v1/games ；公开排行页：https://www.roblox.com/charts/top-playing-now
- Apple App Store 新加坡区 RSS（实测 2026-09-18）：https://itunes.apple.com/sg/rss/topfreeapplications/limit=100/genre=6014/json

**新加坡**
- MCI 游戏调查：https://www.mddi.gov.sg/newsroom/survey-on-childs-online-gaming-activities/
- MDDI 2025：https://www.mddi.gov.sg/newsroom/mddi-study-shows-most-parents-guide-children-s-digital-use-but-would-like-more-support/
- MOH Grow Well SG：https://www.moh.gov.sg/newsroom/grow-well-sg-to-support-families--in-building-healthy-habits-in-children-/
- Mothership 2025-10：https://mothership.sg/2025/10/boy-steals-6000-roblox/
- 宝可梦卡热潮：https://asianews.network/cash-cards-and-charizards-inside-singapores-pokemon-trading-boom/

**同类市场调查**
- Roy Morgan 2025：https://www.roymorgan.com/findings/10136-yas-roblox-for-young-australians-survey-december-2025
- Childwise via Kidscreen：https://kidscreen.com/2025/10/17/which-roblox-games-are-kids-favorites/
- Beano Brain：https://insights.beanobrain.com/gen-alpha-open-world-gaming ；https://insights.beanobrain.com/the-top-3-gaming-genres-for-gen-alpha
- 小学馆 2025 小学生趋势：https://prtimes.jp/main/html/rd/p/000000018.000140019.html

**游戏/IP**
- https://en.wikipedia.org/wiki/Grow_a_Garden
- https://en.wikipedia.org/wiki/Steal_a_Brainrot
- https://en.wikipedia.org/wiki/Adopt_Me!
- https://en.wikipedia.org/wiki/Dress_to_Impress
- https://en.wikipedia.org/wiki/Toca_Boca
- https://zh.wikipedia.org/wiki/蛋仔派对
- https://www.sanrio.co.jp/special/characterranking/2025/en/result/
- https://www.shacknews.com/article/146659/mario-kart-world-november-2025-nintendo-sales
- https://www.rpgsite.net/news/19498-pokemon-legends-z-a-has-sold-123-million-copies-as-december-31-2025
- https://gameworldobserver.com/2025/02/11/supercell-record-revenue-2024-new-mistakes-strong-teams
- https://en.wikipedia.org/wiki/KPop_Demon_Hunters
- https://en.wikipedia.org/wiki/Italian_brainrot
- https://en.wikipedia.org/wiki/Ne_Zha_2
- https://about.roblox.com/newsroom/2026/01/roblox-age-checks-required-to-chat

**设计研究**
- Habgood & Ainsworth 2011：https://shura.shu.ac.uk/3556/
- Clark et al. 2016：https://pmc.ncbi.nlm.nih.gov/articles/PMC4748544/
- Sailer & Homner 2020：https://doi.org/10.1007/s10648-019-09498-w
- Ryan, Rigby & Przybylski 2006：https://selfdeterminationtheory.org/SDT/documents/2006_RyanRigbyPrzybylski_MandE.pdf
- Malone 1981：https://onlinelibrary.wiley.com/doi/abs/10.1207/s15516709cog0504_2
- Wilson et al. 2019：https://www.nature.com/articles/s41467-019-12552-4
- Hirsh-Pasek et al. 2015：https://journals.sagepub.com/doi/abs/10.1177/1529100615569721
- Kinzie & Joseph 2008：https://link.springer.com/article/10.1007/s11423-007-9076-z
- NN/g：https://www.nngroup.com/articles/kids-cognition/ ；https://www.nngroup.com/articles/childrens-websites-usability-issues/
- UNICEF RITEC：https://joanganzcooneycenter.org/2024/04/30/new-research-from-unicef-innocenti-tests-the-ritec-framework-with-kids/
- Radesky et al. 2022：https://jamanetwork.com/journals/jamanetworkopen/fullarticle/2793493
- Juice it or lose it：https://www.youtube.com/watch?v=Fy0aCDmgnxg
