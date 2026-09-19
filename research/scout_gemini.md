# Gemini scout 结果（主线程已用 gh api 核验其中的 GitHub 仓库，2026-09-18）

核验结论：chanind/hanzi-writer ✅ MIT 4978★；phaserjs/phaser ✅ MIT 40k★；mumuy/pacman ✅ MIT 1643★；netmanfisher/chinese-ludo ⚠️ MIT 但仅 4★；**lizliz404/BrainRush ❌ 0★ 且无许可证（scout 写的 MIT 是错的，不能复用代码）**。研究数字（Habgood & Ainsworth 2011「自由游玩时长 7 倍」）来自 scout，未回查原文，引用前需核对。

### 一、 7–10 岁儿童（新加坡及亚洲城市）热门游戏偏好与留存机制

根据新加坡资讯通信媒体发展局（IMDA）、《海峡时报》（The Straits Times） 以及游戏社区调研数据，7–10 岁（小学 P2–P4 阶段）孩子对游戏的追求已从简单的单机点击转向**角色扮演（RP）、快节奏轻竞技、个性化装扮与虚拟资产养成**。

*   **男女生玩法偏好分化**：
    *   **女孩（~8 岁 / P2）偏好（表达、审美与生活模拟）**：高频参与 Roblox 头部时尚换装竞技《Dress To Impress》（定时主题穿搭、走秀与互评投票）、经典宠物养成《Adopt Me!》（孵蛋、装扮、建房、交易）、生活模拟《Brookhaven RP》 及《Toca Life World》（自由摆放世界、过家家剧情）。
    *   **男孩（~10 岁 / P4）偏好（对抗、技巧与建造破坏）**：热衷于 Supercell 的快节奏 3v3 动作射击《荒野乱斗》（Brawl Stars）、高自由度沙盒《Minecraft》（红石电路、生存建造）、轻量派对闯关《蛋仔派对》（Eggy Party） 及《宝可梦》（Pokémon）属性克制与图鉴收集。
*   **长线“每日回访”的核心游戏机制**：
    1.  **确定性养成与资产可视化（Pet / Home Progression）**：如《Adopt Me!》通过持续完成宠物的“饥饿/洗澡/上学”需求升级宠物，让孩子对虚拟资产产生情感连接。
    2.  **即时个性化装扮（Cosmetic Customization）**：如《Dress To Impress》 与《蛋仔派对》，外观不直接售卖数值，而是通过局内代币兑换皮肤、动作、称号，满足同龄人展示欲。
    3.  **微任务与短周期目标（Bite-sized Quests & Streaks）**：单局时长控制在 3–5 分钟（如《荒野乱斗》单局 3 分钟），配合每日签到奖励（Daily Streak）与“每日 3 项简单任务”，降低进入门槛。
    4.  **轻社交与合作（Asynchronous Co-op / Local Versus）**：兄妹/同伴间的互相参观家园、合作通关或低惩罚性的趣味 PK。

---

### 二、 国内主流儿童识字/语文 App 游戏化机制拆解

头部语文/识字类产品（洪恩、悟空、叫叫等）均围绕“遗忘曲线”与“游戏闭环”将汉字结构、拼音与阅读拆解为具体交互。

*   **洪恩识字（iHuman Inc. 官方披露）**：
    *   **五步教学闭环（玩、认、练、写、说）**：
        1.  *玩*：以“字源象形动画”为交互载体（如将“木”字化为小树苗生长，点击浇水发芽）。
        2.  *认*：字形演变展示（甲骨文 $\rightarrow$ 楷体）。
        3.  *练*：嵌入街机小游戏（如打地鼠认字、跳格子辨音）。
        4.  *写*：全屏笔顺引导与 AI 轨迹容错纠错。
        5.  *说*：语音识别打分跟读。
    *   **留存驱动**：130+ 本“字集绘本”分级解锁机制（只使用已学汉字构成故事）；每完成一课解锁专属精灵卡牌/建筑部件。
*   **悟空识字（官方应用商店功能说明）**：
    *   **西游 RPG 叙事推进**：将 1200 个汉字嵌入花果山、大闹天宫等阶梯地图关卡，孩子扮演孙悟空学习技能打败妖怪。
    *   **每日节奏控制**：默认每日限定学习 6 个新字、复习若干旧字，防止认知过载，同时建立每天固定打卡的仪式感。
*   **叫叫 / 斑马（产品功能解析）**：
    *   **每日 15 分钟探索式故事包**：以 IP 动画主角为学伴（如叫叫小鸡），采用“交互式有声绘本”，把填空、选词融入剧情推进中，通关奖励金币用于装饰虚拟小屋。

---

### 三、 适合改编为华文学习的 GitHub 开源 HTML5 游戏与组件

在 GitHub 上可直接复用/改编的成熟开源 Canvas/HTML5 项目：

| 仓库名称 / 开发者 | 许可证 (License) | 核心功能与语言学习改造点 | 仓库地址 |
| :--- | :--- | :--- | :--- |
| **hanzi-writer** (chanind) | **MIT** | **汉字笔顺动画与书写测验库**：支持 9000+ 简繁汉字笔顺动画、手写笔迹评分、实时描红与容错检测。最适合用于“书写练字”模块的核心引擎。 | [chanind/hanzi-writer](https://github.com/chanind/hanzi-writer) |
| **Phaser** (phaserjs) | **MIT** | **主流 2D HTML5 游戏引擎**：支持 Canvas/WebGL、粒子系统、物理碰撞与移动端触控。适合搭建平台跳跃、射击打字、消消乐等中型网页游戏。 | [phaserjs/phaser](https://github.com/phaserjs/phaser) |
| **BrainRush** (lizliz404) | **MIT / Open Source** | **儿童快节奏词汇/运算反应游戏**：React + Canvas 架构，内置 60 秒限时冲刺、错题本回顾与像素角色反馈。极易将英数题库替换为华文“拼音对对碰”或“汉字辨义”。 | [lizliz404/BrainRush](https://github.com/lizliz404/BrainRush) |
| **chinese-ludo** (netmanfisher) | **MIT / Open Source** | **纯原生 JS 中国飞行棋**：支持 2–4 人本地/同屏对战与动画判定。可改造为“答对华文词汇/成语即可掷骰子移动”的双人兄妹对战棋盘。 | [netmanfisher/chinese-ludo](https://github.com/netmanfisher/chinese-ludo) |
| **pacman** (mumuy) | **MIT / Open Source** | **HTML5 经典吃豆人**：可将地图上的豆子替换为偏旁部首（如吃到“氵”+“木”+“每”组成“海”），把躲避幽灵与汉字拼装结合。 | [mumuy/pacman](https://github.com/mumuy/pacman) |

---

### 四、 儿童教育游戏设计研究结论：如何提升动机与避免设计陷阱

根据游戏化学术界与学习科学（Learning Sciences）的研究：

1.  **避免“巧克力裹西兰花”（Chocolate-Covered Broccoli）效应**：
    *   *现象与弊端*：由 Amy Bruckman 与 Brenda Laurel 提出，指将枯燥的机械刷题（西兰花）强行包装在与学习内容脱节的游戏皮囊（巧克力，如“答对一道选择题开一枪”）之下。7–10 岁的孩子会迅速识破这种设计并产生厌烦心理。
2.  **核心原则：内生性融合理论（Intrinsic Integration Theory）**：
    *   *实验数据（Habgood & Ainsworth, 2011, 《Journal of the Learning Sciences》）*：研究者在对 7–11 岁儿童的数学游戏 *Zombie Division* 实验中证实，将教学机制内嵌于游戏核心玩法的组别（Intrinsic Integration），其**自由选择游玩时长高出外挂奖励组 7 倍**，且知识迁移能力显著提高。
    *   *华文落地做法*：汉字偏旁部首本身就是“魔法合成配方”（如火+火=炎），拼音是“声波施法密码”，成语理解是解开地图机关的线索，让知识成为游戏内解决问题的直接工具。
3.  **自决理论（Self-Determination Theory, SDT）驱动持续留存**：
    *   **自主感（Autonomy）**：提供非线性关卡选择、可自定义的个人形象（换装/打扮宠物）。
    *   **胜任感（Competence）**：设置微阶梯难度（Scaffolding），在 8 岁（P2 侧重认读与笔画）与 10 岁（P4 侧重组词、成语及句意）之间动态自适应分级。
    *   **归属感/关联感（Relatedness）**：支持兄妹协作（如双人共建小岛、共同挑战 Boss）。
4.  **剔除赌博式抽卡（Gacha），采用“确定性收集与成就系统”**：
    *   *风险*：新加坡官方与《海峡时报》指出，无保底随机抽卡机制类似赌博心理，易引发冲动消费与成瘾焦虑。
    *   *健康替代方案*：
        *   **里程碑图鉴系统**：收集进度（如“集齐 50 个动物汉字卡”）完全透明可见。
        *   **努力兑换机制（Earned Currency）**：完成每日识字/复习获得小金币，100% 确定兑换指定家具或装扮道具。

---

### 本次检索覆盖到的来源清单

1.  **IMDA (Infocomm Media Development Authority Singapore)** - *A Safety Guide to Popular Online Games in Singapore*
    `https://www.digitalforlife.gov.sg/learn/articles/a-safety-guide-to-popular-online-games-in-singapore`
2.  **The Straits Times (海峡时报)** - *Parents, take note of these video games popular among kids*
    `https://www.straitstimes.com/singapore/parents-take-note-of-these-video-games-popular-among-kids`
3.  **ResearchGate / Journal of the Learning Sciences** - *Motivating Children to Learn Effectively: Exploring the Value of Intrinsic Integration in Educational Games (Habgood & Ainsworth)*
    `https://doi.org/10.1080/10508406.2010.508029`
4.  **ResearchGate** - *Investigating the Impact of Chocolate Broccoli Design Factors on the Effectiveness of Educational Games*
    `https://www.researchgate.net/publication/Investigating_the_Impact_of_Chocolate_Broccoli_Design_Factors`
5.  **GitHub / chanind** - *Hanzi Writer: Chinese character stroke order animations and practice quizzes (MIT License)*
    `https://github.com/chanind/hanzi-writer`
6.  **GitHub / phaserjs** - *Phaser: A fun, free and fast 2D game framework for making HTML5 games (MIT License)*
    `https://github.com/phaserjs/phaser`
7.  **GitHub / lizliz404** - *BrainRush: Kids mental math & vocabulary reaction game*
    `https://github.com/lizliz404/BrainRush`
8.  **GitHub / netmanfisher** - *chinese-ludo: Classic Chinese board game in vanilla JavaScript*
    `https://github.com/netmanfisher/chinese-ludo`
9.  **洪恩官方 (iHuman Inc.)** - *洪恩识字与洪恩写字教学体系与产品功能披露*
    `https://www.ihuman.com`

---
