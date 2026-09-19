# GitHub 调研：休闲 / 养成 / 创作类（兼顾女孩喜好）

调研日期：2026-09-18。所有星数、许可证、最近推送日期都来自当天的 `gh api repos/OWNER/REPO`；demo 状态来自当天的 `curl` 与浏览器试玩。

证据等级标注：
- **[实测]**：本次亲手跑过：API 返回、curl 状态码、读了源码或文件树、在浏览器里打开或试玩。
- **[原文]**：摘自该仓库 README 或 LICENSE 的原话大意。
- **[推断]**：我的判断或设计建议，还没有验证。

---

## 0. 先说结论

1. **GitHub 上这类“完整又好玩”的儿童休闲网页游戏很少，星数普遍很低。** [实测] 例如：
   - `dress up game language:JavaScript` 共 160 个结果，最高只有 16★；
   - `cooking game language:JavaScript` 共 148 个结果，最高 52★，而且是纯文字游戏；
   - `room decorator javascript` 与 `dollhouse game javascript` 都是 0 个结果；
   - 搜 `toca boca`，前排几乎全是 APK 破解版的垃圾仓库。

   原因是 Papa's 系列、Toca Boca、Talking Tom 都是闭源商业产品。**高星的开源项目是“零件”**，比如分层 SVG 换装系统（3.7k★）、等距绘图库（2.9k★）、数字填色生成器、钢琴块（1.9k★）、合成大西瓜的物理骨架。**完整的休闲游戏大多只有 0–60★**，但机制写得很清楚，值得照着做。

   所以策略是：**借“机制骨架”，美术自己画（Canvas / emoji / SVG），不整仓搬运。** 这也正好满足“单 HTML、运行时不 fetch 外部资源”的约束。

2. **养成、收集、装扮最好当作“元游戏层”，别做成又一个主游戏。**
   - 11 个街机赚金币、种子和胶囊；
   - 回到“小岛”喂宠物、扭蛋、布置房间、种字；
   - 真实时钟驱动，孩子会每天回来。

   这样核心仍然是会动的街机（符合家长“要像游戏”的要求），养成负责留存。paradise-isle、Gacha Zoo、Krepagotchi 三个仓库拼起来，正好是这一层的样板。

3. **下一批最值得做的 6 个**（按“投入 / 两个孩子都爱 / 华文能真正进机制”排序）：

| 优先级 | 新玩法（暂名）        | 借哪个仓库的机制                             | 用哪个题库栏目      | 适合谁               |
|--------|-----------------------|----------------------------------------------|---------------------|----------------------|
| 1      | 合成大汉字            | moonfloof/suika-game（+ kusazh/hanzi 的思路） | build、words        | 都适合               |
| 2      | 华文小吃店            | DigitalCyberSoft/pizzashop 的“订单 spec”机制 | words、passages     | 都适合（P4 读长单）  |
| 3      | 声调钢琴块 / 歌词钢琴 | arcxingye/EatKano                            | pick、twisters      | 都适合               |
| 4      | 拼音填色              | drakarah/paintbynumbersgenerator             | chars、words        | P2 女孩为主          |
| 5      | 量词换装 / 侦探画像   | Codennnn/vue-color-avatar + notion-avatar    | words、passages     | P2 换装，P4 画像     |
| 6      | 字宠物 + 汉字扭蛋     | krepagotchi + gacha-zoo + paradise-isle      | 全部（经济系统）    | 都适合               |

4. **许可证红线：**
   - pizzashop、kusazh/hanzi、kawaii-room-maker 在 GitHub 上都识别不到许可证，**只能借玩法，不能拷代码或素材**。
   - kidpix、KanaMaster 是 GPL-3.0，建议只借设计。
   - Koi 是 Apache-2.0 加 Commons Clause（禁止出售），家庭非商业使用可以，但代码量大，建议只借玩法。
   - 其余入选仓库是 MIT、CC0、Unlicense 或 Apache-2.0，可以直接改。
   - 美术素材另有许可：vue-color-avatar 是 CC BY 4.0，要署名；notion-avatar 是 CC0。

---

## 1. 总表（25 个仓库，其中 23 个入选、2 个参考）

| #  | 仓库                                         | 类型           | ★    | 许可证               | 最近推送   | demo（当天实测）          | 适合            | 改编难度 |
|----|----------------------------------------------|----------------|------|----------------------|------------|---------------------------|-----------------|----------|
| 1  | arcxingye/EatKano                            | 钢琴块         | 1906 | MIT                  | 2025-11-07 | 200，可进游戏             | 都适合          | 低       |
| 2  | SamToki/KanaMaster                           | 文字 × 音游    | 20   | GPL-3.0              | 2026-09-14 | 200                       | P4              | 只借设计 |
| 3  | 111116/webosu                                | 节奏点圈       | 652  | MIT                  | 2024-07-23 | 打不开（000）             | P4 男孩         | 中       |
| 4  | googlecreativelab/chrome-music-lab           | 音乐创作       | 2419 | Apache-2.0（已归档） | 2024-02-28 | 200                       | 都适合          | 中       |
| 5  | danielbrendel/krepagotchi-game               | 电子宠物       | 49   | MIT                  | 2026-09-08 | 200，落地页               | 都适合          | 中       |
| 6  | JohnSpahr/MyTalkingRon                       | 会说话的宠物   | 0    | CC0-1.0              | 2024-05-30 | 200                       | P2              | 低       |
| 7  | Acedio/animalese.js                          | 宠物“动森语”   | 489  | 代码 MIT，音频 CC BY | 2025-05-20 | 200                       | P2              | 低       |
| 8  | Codennnn/vue-color-avatar                    | 换装           | 3769 | MIT，素材 CC BY 4.0  | 2025-07-24 | 503（当天挂了）           | P2 / P4         | 低–中    |
| 9  | Mayandev/notion-avatar                       | 换装素材       | 3223 | MIT，素材 CC0        | 2026-06-06 | 200                       | P4              | 低       |
| 10 | wolfderechter/DollMaker                      | 纸娃娃         | 10   | MIT                  | 2024-12-14 | 200，可用                 | P2              | 低       |
| 11 | DigitalCyberSoft/pizzashop                   | 按订单做披萨   | 1    | 无                   | 2026-06-28 | 200，已试玩               | 都适合          | 只借机制 |
| 12 | enesbabekoglu/Restaurant-Game-Canvas-JS      | 餐厅经营       | 2    | MIT                  | 2024-12-11 | 200                       | 都适合          | 中       |
| 13 | appleweiping/paradise-isle                   | 海岛养成总枢纽 | 4    | MIT                  | 2026-07-17 | 200，已试玩               | 都适合          | 中–高    |
| 14 | jobtalle/Koi                                 | 锦鲤繁殖收集   | 411  | Apache-2.0 + Commons Clause | 2026-04-07 | 200             | P2 女孩         | 高       |
| 15 | jdan/isomer                                  | 等距房间绘制库 | 2909 | MIT                  | 2022-04-20 | 200                       | P2 / P4         | 低–中    |
| 16 | teru776/kawaii-room-maker                    | Toca 式房间    | 0    | 无（README 自称 MIT）| 2026-04-04 | 200，已试玩               | P2              | 极低     |
| 17 | vikrum/kidpix                                | 儿童画画       | 742  | GPL-3.0              | 2025-11-18 | 200                       | P2（P4 也爱）   | 只借设计 |
| 18 | drakarah/paintbynumbersgenerator             | 数字填色生成器 | 431  | MIT                  | 2026-08-18 | 200                       | P2 为主         | 低–中    |
| 19 | KyleMit/Splotch                              | 魔法刷揭图     | 5    | MIT                  | 2026-09-18 | 200                       | P2              | 低       |
| 20 | gavilanbe/gacha-zoo                          | 扭蛋收集       | 0    | MIT                  | 2026-06-19 | 200，已试玩               | 都适合          | 中       |
| 21 | moonfloof/suika-game                         | 合成大西瓜     | 61   | Unlicense（matter.js 为 MIT） | 2025-10-06 | 200              | 都适合          | 低       |
| 22 | kusazh/hanzi                                 | 合成大漢字     | 1    | 无                   | 2026-06-10 | 200，已试玩               | P4              | 只借思路 |
| 23 | ganlvtech/phaser-catch-the-cat               | 围住小猫       | 756  | MIT                  | 2022-12-25 | 200                       | 都适合          | 低       |
| 参 | furnishup/blueprint3d                        | 3D 室内设计    | 1979 | MIT                  | 2021-01-20 | —                         | —               | 不推荐   |
| 参 | jeremyckahn/farmhand                         | 农场经营       | 141  | GPL-2.0              | 2026-09-17 | —                         | —               | 不推荐   |

说明：GitHub 对 animalese.js、suika-game、Koi 的许可证识别为 NOASSERTION。我读了 LICENSE 原文，上表写的是原文里的实际条款（见各条目）。

**CDN 可用性 [实测，cdnjs API]：**
- matter-js 0.20.0、phaser 4.2.1、tone 15.5.42、isomer 0.2.6、pixi.js 8.17.1、howler 2.2.4 都在 cdnjs 上；
- zdog 不在 cdnjs，但 jsDelivr npm 返回 200。

---

## 2. 逐个笔记

### 🎹 钢琴块 / 音乐节奏

#### 1. arcxingye/EatKano（吃掉小鹿乃）

- **仓库与数据：**
  - 地址：https://github.com/arcxingye/EatKano
  - 数据：1906★，MIT，JavaScript，2025-11-07 推送 [实测]
  - demo：https://arcxingye.github.io/EatKano/index.html 返回 200。打开是标题页，点 Start 后进入 4 列格子，小鹿乃头像块往下走 [实测]
- **实现：** 游戏逻辑只有 `static/index.js` 一个文件（643 行，21.9KB），DOM + CSS `translate3D` 移动行 [实测源码]。
  - 有三种模式：计时、无尽、练习（源码里的常量是 `MODE_NORMAL / MODE_ENDLESS / MODE_PRACTICE`）[实测源码]。
  - 依赖 jQuery、bootstrap、createjs、jsencrypt，全部来自 staticfile、cnblogs、createjs 等不允许的域名 [实测 index.html]。**需要去掉依赖，用 Canvas 重写。**
  - 小鹿乃立绘是 VTuber 的形象，不能用。
- **为什么好玩：** 一根手指就能玩，越来越快，失误立刻结束，“再来一局”冲动很强。10 岁男孩爱比每秒点击数（CPS），8 岁女孩爱“点出一首歌”。
- **华文融进机制：**
  - **声调钢琴：** 4 列就是 4 个声调（列头画 ˉ ˊ ˇ ˋ 和四条音高线）。每行滚下来一个楷体大字，孩子要点它**读音声调对应的那一列**。点对了播放下一个音符（五声音阶），点错等于“踩白块”，游戏结束。题目来自 pick 和 chars 的拼音。
  - **歌词钢琴：** 每行 4 块都写着字，只有“绕口令 / 儿歌 / 古诗的下一个字”是正确的黑块。连续点对就是把整首唱出来（TTS 或合成旋律跟唱），孩子不知不觉就读了一遍。题目来自 twisters 和 readaloud。
- **适合谁：** 都适合。P2 玩慢速声调模式，P4 玩歌词无尽模式、冲 CPS。
- **改编可行性：** 低。不需要美术，旋律用 WebAudio 合成（引擎 spec 已有五声音阶音乐），大约 300 行 Canvas [推断]。

#### 2. SamToki/KanaMaster（假名征服者）

- **仓库与数据：**
  - 地址：https://github.com/SamToki/KanaMaster
  - 数据：20★，GPL-3.0，2026-09-14 推送 [实测]
  - demo：https://SamToki.github.io/KanaMaster 返回 200 [实测]
- **README 原文大意：** 日文假名记忆训练游戏，结合了音游元素，面向初学者 [原文]。
- **为什么值得看：** 这是和“华文小岛”最接近的现成先例，说明“文字记忆 + 音游手感”能做成完整产品；README 提到有面向高手的高难度 [原文]，具体判定规则还没细看 [推断]。
- **华文融进机制：** 做成**拼音征服者**。音符是汉字，沿轨道落下，孩子在判定线处按它的**声调键**（1/2/3/4）或点拼音按钮，要准也要快。第 6 关以后只播 TTS、不显示字，变成“听音打谱”。题目来自 pick 和 words。这也可以作为已有“节拍绕口令”（45_beat）的第二种模式。
- **适合谁：** P4。
- **改编可行性：** GPL-3.0，只借判定窗口、难度曲线这些设计，不拷代码。

#### 3. 111116/webosu（网页版 osu!）

- **仓库与数据：**
  - 地址：https://github.com/111116/webosu
  - 数据：652★，MIT，PixiJS [实测]
  - demo：README 里的 http://osugame.online/ 当天打不开（curl 返回 000）[实测]
- **README 原文大意：** 跟着音乐节奏点圆圈；部分媒体文件版权属于 ppy 等人，要另查许可 [原文]。
- **为什么好玩：** osu! 的“缩圈判定 + Perfect 爆光”手感很强，男孩很喜欢。
- **华文融进机制：** 做成**笔顺 osu**。一个大字的每一笔起点依次冒出圆圈，顺序严格按笔顺（用 HanziWriter 的 medians 数据），圈跟着节拍缩小，点中就画出这一笔。整字打完，字亮起、TTS 读出，再飞进“已征服”墙。点错顺序算 Miss。题目来自 chars。这样笔顺记忆变成了节奏记忆。
- **适合谁：** P4 男孩。
- **改编可行性：** 中。只取缩圈判定逻辑（PixiJS 在 cdnjs 上），也可以直接用现有 HW.arcade 的 Canvas 实现；谱面和音乐不能用，自己合成。

#### 4. googlecreativelab/chrome-music-lab

- **仓库与数据：**
  - 地址：https://github.com/googlecreativelab/chrome-music-lab
  - 数据：2419★，Apache-2.0，已归档 [实测]
  - demo：https://musiclab.chromeexperiments.com 返回 200 [实测]
- **仓库里的实验** [实测目录]：arpeggios、chords、harmonics & strings、melodymaker、pianoroll、soundspinner、soundwaves、spectrogram。每个子项目用 webpack 构建 [原文子 README]。
- **为什么好玩：** 零门槛“玩声音”。点格子就出旋律，还能看到声音的形状；小学音乐课常用，8 岁女孩可以玩很久。
- **华文融进机制：**
  - **声调旋律格**（Melody Maker 变体）：纵轴是四个声调的音高轮廓。孩子在格子里画出一个词的声调走向，例如“妈妈 mā ma”是高平加轻声。播放时 TTS 读词，合成器按同样的轮廓“唱”一遍，把声调变成看得见、听得见的旋律。
  - **声谱画声调**（Spectrogram 变体）：孩子对着麦克风读“mā má mǎ mà”，实时画出音高线，和标准轮廓叠在一起比较。这里只用 WebAudio 做音高检测，不需要语音识别（ASR）。题目来自 pick 和 speak。
- **适合谁：** 都适合。
- **改编可行性：** 中。只借交互；Tone.js 在 cdnjs 上 [实测]。麦克风在 Artifact 的 iframe 里可能没有权限，要沿用火箭游戏的降级方案 [推断]。

### 🐣 电子宠物 / 会说话的宠物

#### 5. danielbrendel/krepagotchi-game

- **仓库与数据：**
  - 地址：https://github.com/danielbrendel/krepagotchi-game
  - 数据：49★，MIT，Phaser，后端是 PHP（asatru 框架）[实测文件树与 README 徽章]
  - 官网：https://www.krepagotchi.com 返回 200，是 Minecraft 苦力怕风格的落地页 [实测]
- **玩法** [原文]：
  - 喂食、清洁、生病治疗、抚摸、玩耍（随机出现球类游戏或戳泡泡小游戏）；
  - 想法气泡、收发信件、生日庆祝、跨年派对；
  - 饥饿满、亲密为 0、家里脏都会扣健康，健康归零宠物就“爆炸”。
- **为什么好玩：**
  - 苦力怕造型对 10 岁男孩（Minecraft 世代）吸引力极强；
  - “需求衰减 → 采取行动 → 表情反馈”的照顾循环，加上生日和节日惊喜，会让孩子每天回来看。
- **华文融进机制：**
  - **需求用汉字说：** 头顶的想法气泡只写字或词（渴、困、脏、饿、想玩球），不配图标。孩子得读懂才能做对动作；做错了，宠物做鬼脸、心情下降。
  - **冰箱喂食：** 食物都贴着词语标签（words），宠物用 TTS 说“我想吃香蕉”，孩子把“香蕉”拖到嘴边；拖成“香肠”它会吐出来。
  - **宠物来信：** 每天一封短信（stories、passages 的短文），读完点 🔊 或答一题才能拆开礼物；回信就是 compose 的写话题。
  - **玩耍 = 街机：** 玩耍按钮直接跳到已有的气球、接字篮等游戏，赢了给宠物加亲密度。
- **适合谁：** 都适合。外形可选：哥哥用苦力怕 / 方块风，妹妹用小猫 / 兔子。**不要做“死亡 / 爆炸”**，改成“睡着了 / 离家出走一天”，可以恢复 [推断]。
- **改编可行性：** 中。PHP 后端不要，只取客户端的状态机；像素 PNG 换成 emoji 或 Canvas 绘制。

#### 6. JohnSpahr/MyTalkingRon

- **仓库与数据：**
  - 地址：https://github.com/JohnSpahr/MyTalkingRon
  - 数据：0★，CC0-1.0 [实测]
  - demo：https://johnspahr.github.io/MyTalkingRon/ 返回 200
- **实现** [实测源码 ron2.js，约 3KB]：`webkitSpeechRecognition` 听写，`onresult` 拿到文字，再用 `speechSynthesis` 以 `pitch = 0.1` 的怪声复述。
- **为什么好玩：** Talking Tom 最核心的笑点就是“用怪声学你说话”，8 岁孩子百玩不厌。
- **华文融进机制：** 做成**学舌小猫**。
  - 孩子朗读 readaloud 句子，`recognition.lang = 'zh-CN'` 转成文字；
  - 小猫用尖细嗓子（pitch 约 1.8）复述**它听到的内容**；
  - 同时把识别结果和原句逐字比对：读对的字变金色，漏读的字小猫歪头说“咦？”。
  - 孩子为了让小猫“学对”，会主动读得更清楚。talk（看图会话）也能用：小猫提问，孩子回答。
- **适合谁：** P2 女孩（P4 也会觉得好笑）。
- **改编可行性：** 代码量极小。风险 [推断，需实测]：
  - Firefox 不支持 SpeechRecognition；
  - Chrome 的识别要经过 Google 服务器，必须联网；
  - claude.ai Artifact 的 iframe 可能拿不到麦克风。
  - 所以要有降级：没有识别时只录音回放加变调，用 WebAudio 的 `playbackRate` 实现，同样好笑。

#### 7. Acedio/animalese.js（动森村民说话声）

- **仓库与数据：**
  - 地址：https://github.com/Acedio/animalese.js
  - 数据：489★；LICENSE 原文：代码 MIT，`animalese.wav` 音频 CC BY 4.0 [实测]
  - demo：http://acedio.github.io/animalese.js/ 返回 200
- **文件大小：** `animalese.wav` 为 172KB，`animalese.js` 为 1.9KB [实测文件树]。
- **为什么好玩：** 动物森友会里村民“咿咿呀呀”的说话声可爱度满分，女孩尤其喜欢。
- **华文融进机制：** 宠物和 NPC 的每句台词这样播放：
  1. 先按拼音字母放一段“动物语”，每个音节的音高按声调走：一声高平，四声下滑；
  2. 再用 TTS 读标准普通话；
  3. 对话框逐字跳亮，像动森那样。

  这样每句 NPC 台词都自然变成跟读材料，“小动物说话带声调”本身也是在演示声调。
- **适合谁：** P2。
- **改编可行性：** 低。wav 转成 data URI 约 230KB [推断]，页面要写 CC BY 署名。

### 👗 换装 / 装扮

#### 8. Codennnn/vue-color-avatar

- **仓库与数据：**
  - 地址：https://github.com/Codennnn/vue-color-avatar
  - 数据：3769★，代码 MIT；README 原文说素材来自 Micah Lanier 的 Avatar Illustration System，**CC BY 4.0** [实测]
  - demo：https://vue-color-avatar.leoku.dev 当天返回 503 [实测]
- **素材：** `src/assets/widgets/` 下约 39 个小 SVG，每个几 KB [实测文件树]。按类别：
  - tops 9、mouth 8、eyes 4、eyebrows 4、nose 3、clothes 3
  - glasses 2、earrings 2、ear 2、face 1、beard 1
- **为什么好玩：** 分层 SVG 加上任意换色，点一下就变样，结果还能存成头像。这是换装游戏的最小内核。
- **华文融进机制：**
  - **量词衣柜（P2）：** 顾客娃娃用 TTS 加文字点单，例如“我想要**一顶**红色的帽子、**一件**蓝色的衬衫、**一副**圆眼镜”。衣柜抽屉按量词分组（一顶、一件、一条、一双、一副），颜色词、形容词（长长的、卷卷的）要读懂才能配对。装扮完成后上 T 台走秀，按匹配度给星，照片存进相册。
  - **侦探画像（P4 男孩版）：** 读一段人物描写（passages 常见“他有一头短短的卷发，戴着黑框眼镜，不笑的时候嘴巴抿成一条线”），从部件里拼出嫌疑人。描写里有否定句（“没有胡子”），拼对就抓到坏人。
- **适合谁：** 量词衣柜给 P2，侦探画像给 P4。
- **改编可行性：** 低到中。SVG 可以直接内联，不需要 Vue；页面要写 CC BY 署名。

#### 9. Mayandev/notion-avatar

- **仓库与数据：**
  - 地址：https://github.com/Mayandev/notion-avatar
  - 数据：3223★；代码 MIT，README 原文说素材是 **CC0** [实测]
  - demo：https://notion-avatar.app 返回 200
- **素材：** `public/avatar/part/` 下共 212 个 SVG 部件 [实测文件树]：
  - hair 59、mouth 20、beard 17、eyebrows 16、face 16、accessories 15
  - glasses 15、eyes 14、details 14、nose 14、festival 12
- **为什么有用：** 黑白线稿风，部件数量多，而且是 CC0，可以随便改。
- **华文融进机制：**
  - 作为“侦探画像”的主素材库（见上一条）；
  - 线稿也可以直接当“拼音填色”的底图（见第 18 条）。
  - festival 类部件可以做节日装扮（例如春节帽子），用于节日主题周。
- **适合谁：** P4。
- **改编可行性：** 低。挑 60 个左右的部件内联，大约 300KB 以内 [推断]。

#### 10. wolfderechter/DollMaker

- **仓库与数据：**
  - 地址：https://github.com/wolfderechter/DollMaker
  - 数据：10★，MIT，纯 JS + Canvas [实测]
  - demo：https://wolfderechter.github.io/DollMaker/ 已试玩。左边是纸娃娃，右边是 Hair / Dress / Face / Shoes / Accessory 标签页 [实测]
- **README 原文大意：** 拖拽调整图层顺序；用 localStorage 保存多个娃娃；可以导出成图片；适配手机 [原文]。
- **素材：** 全是 PNG，每条裙子 50–90KB [实测文件树]。
- **为什么值得看：** 这是标准的“纸娃娃”交互骨架：点选即换、图层叠放、保存作品。
- **华文融进机制：** 只取代码骨架（图层、存档、导出），素材换成第 8、9 条的 SVG。玩法见第 8 条。
- **适合谁：** P2。
- **改编可行性：** 代码低难度，素材需要全部替换。

### 🍕 开餐厅 / 做菜（Papa's 类）

#### 11. DigitalCyberSoft/pizzashop（Pizza Palace）⭐ 本类最佳机制

- **仓库与数据：**
  - 地址：https://github.com/DigitalCyberSoft/pizzashop
  - 数据：1★，**GitHub 识别不到许可证**，仓库创建于 2026-06-26 [实测]
  - demo：https://digitalcybersoft.github.io/pizzashop/game.html
- **试玩过程** [实测]：
  - 先是烤箱加载页；
  - 点 New Game 后，每次解锁一种新配料都有弹窗；
  - 然后顾客 “Pizzabot 3000” 下单：“A **whole** pizza on a cheese **base**, covered all over in **olive**”，关键词带颜色高亮。
- **README 原文大意** [原文]：
  - 游戏教的是**读懂越来越复杂的英语**，不是手速；
  - 每张订单先生成结构化的“布局 spec”（6–12 片，每片有底料和配料），英文句子由 spec 渲染出来；
  - 评分时逐片比对 spec，并接受所有旋转、镜像等价解；
  - 30 级自适应难度，从“a whole pizza with ham”一直到带否定、条件、空间约束的多句订单。
- **为什么好玩：** Papa's 系列的“读单 → 做菜 → 上菜 → 小费”循环。难度由**语言复杂度**驱动，本质是阅读理解，孩子却觉得自己在开店。
- **华文融进机制：** 移植成**新加坡小贩中心“华文小吃店”**（鸡饭、叻沙、煎蛋饼、珍珠奶茶、披萨）。
  1. 订单 spec 通过中文句子模板生成：
     - P2：“一碗面，加**两个**鸡蛋”，练数量词和量词。
     - P4：“**一半**加辣椒，**另一半不要**；**如果**有虾，**就不要**放葱”，外加方位（左边、右边、中间）。
  2. 孩子点配料把菜做出来，系统逐格比对 spec，按速度给小费。
  3. 配料名就是 words 里的听写词，点一下就用 TTS 读。
  4. P2 可以开“只听不看”模式：顾客只用 TTS 下单。
- **适合谁：** 都适合。P2 听单，P4 读长单。
- **改编可行性：** **没有许可证，不能拷代码或素材**，只能按 README 公开描述的机制重写。机制本身不复杂（spec 生成 + 模板渲染 + 比对），估计 500–700 行 [推断]。菜品用 emoji 或 Canvas 绘制。

#### 12. enesbabekoglu/Restaurant-Game-Canvas-JS

- **仓库与数据：**
  - 地址：https://github.com/enesbabekoglu/Restaurant-Game-Canvas-JS
  - 数据：2★，MIT，Canvas，仓库 58MB（大部分是图片素材）[实测]
  - demo：https://enesbabekoglu.com.tr/proje-oyun/ 返回 200
- **README 原文大意** [原文]：
  - 在柜台接受或拒绝订单，去市场采购食材，做菜；
  - 按用时给 1–3 星；
  - 支持多语言，有音效和背景音乐，可以“手持物品”。
- **为什么好玩：** 经营循环完整：采购 → 接单 → 烹饪 → 计时评星。
- **华文融进机制：**
  - **市场采购：** 妈妈给一张购物清单（words 词语），摊主用 TTS 报价，孩子在摊位上找对的食材。
  - **烹饪顺序：** 菜谱用“先……再……然后……最后……”（order 排句子栏目的顺序词），把步骤卡按顺序拖进锅里，顺序错了菜就糊（冒黑烟、抖屏）。
  - 可以和第 11 条合成一个“小吃店”。
- **适合谁：** 都适合。
- **改编可行性：** 中。代码可以借（MIT），素材全部换成 emoji 或 Canvas。

### 🏝️ 农场 / 种植 / 小岛养成（元游戏层）

#### 13. appleweiping/paradise-isle（天堂小岛）⭐ 最贴合约束的样板

- **仓库与数据：**
  - 地址：https://github.com/appleweiping/paradise-isle
  - 数据：4★，MIT，TypeScript + Vite [实测]
  - 仓库在 2026-07-17 创建，同一天推送后再无更新 [实测]。**社区验证很少**，可能是 AI 辅助生成的 [推断]。
  - demo：https://appleweiping.github.io/paradise-isle/
- **试玩过程** [实测]：
  - 标题页有三个存档槽；
  - 起名后进入等距海岛，左上是新手任务“初来乍到——在农田里种下 2 颗胡萝卜种子”；
  - 底栏是：背包、商店、任务、图鉴、换装、邻居、布置、设置。
  - 画风简朴扁平。
- **README 原文大意** [原文]：
  - **没有后端、账号或素材文件**，所有图形启动时用 Canvas 程序化画出，音效和五声音阶 BGM 由 WebAudio 合成；
  - 共 14 个系统，包括：作物五阶段实时生长（错过会枯萎）、24 种鱼的图鉴、7 个槽位共 44 件服装的纸娃娃、8 只宠物、42 种建筑布置、每日任务、20 个成就；
  - 好友码可以把整座岛压缩成一串文字；
  - 真实时钟驱动，离线也会生长；
  - 核心逻辑是纯 TS，和渲染完全解耦。
- **为什么好玩：** “我的小岛”经营。种田、钓鱼、换装、养宠、布置全在一处，真实时间让孩子每天回来。名字和世界观几乎就是“华文小岛”的元游戏层。
- **华文融进机制：** 当作华文小岛的**枢纽**。11 个街机赚到的金币、种子、胶囊都在这里花掉。
  - **字田：** 每块田种一个生字（chars）。成熟时间就是间隔重复（SRS）的复习间隔；到期不复习，字苗会“枯萎”。复习一次（写字打怪兽，或用 HanziWriter 描一遍）等于浇水加收获。孩子会自己回来“救庄稼”，复习就自动完成了。
  - **汉字图鉴：** 把原来的鱼类图鉴改成“部首家族”图鉴，集齐一个部首解锁一种建筑。
  - **兄妹互访：** 两个孩子各一座岛，用好友码互相参观（原仓库已有这个功能）。
- **适合谁：** 都适合。
- **改编可行性：** 中到高。MIT，可以直接用代码，但要用 vite build 出产物后内联成单个 HTML；视觉需要按 SPEC_ARCADE 的热带风格重做。

#### 14. jobtalle/Koi（Koi Farm）

- **仓库与数据：**
  - 地址：https://github.com/jobtalle/Koi
  - 数据：411★ [实测]；这是 Steam 和 itch 上架商业游戏的源码 [原文]
  - 许可证：LICENSE 原文是 “Apache 2.0 with Commons Clause”，**禁止出售**；家庭非商业使用可以 [实测]
  - 官网：https://koifarmgame.com/ 返回 200
- **为什么好玩：** README 原文只写了 “A Koi breeding game” [原文]。以下是我的推断：配种出新花纹的惊喜感加上收集欲，截图画面很美，很适合 8 岁女孩；锦鲤、“年年有余”本身也是中华文化符号 [推断]。
- **华文融进机制：** 做成**字锦鲤**。
  - 每条鱼背上的花纹是一个部件（氵、木、口、青、日……）；
  - 两条鱼游到一起“配对”，**只有能组成真字的组合才会产卵**，例如氵 + 青 → 小鱼“清”，出生时 TTS 读“清，清水的清”；
  - 鱼池图鉴就是已经发现的字。

  这样组字（build 栏目）变成了繁殖玩法。
- **适合谁：** P2 女孩（P4 可以挑战高级组字）。
- **改编可行性：** 高。原作是 WebGL 专用渲染，代码量大，建议只借玩法，用 Canvas 2D 画简化的锦鲤 [推断]。

### 🏠 装饰房间（Toca Boca 类）

#### 15. jdan/isomer

- **仓库与数据：**
  - 地址：https://github.com/jdan/isomer
  - 数据：2909★，MIT [实测]
  - cdnjs 上有 isomer 0.2.6 [实测]
  - demo：http://jdan.github.io/isomer 返回 200
- **为什么有用：** 几行代码就能画出等距方块房间和家具，不需要美术，能画出 Toca 式立体房间。
- **华文融进机制：** 做成**方位词装修**。
  - 任务卡（TTS 加文字）：“把台灯放在书桌的**上面**，把小猫放在床的**下面**，把画挂在窗户的**左边**”。孩子把家具拖进等距房间，系统按网格坐标判定上、下、左、右、前、后、里、外。
  - 自由模式：点房间里任何东西，TTS 读出词语，同时浮出拼音。
  - P4 版：读一段“我的房间”描写（passages），按描写还原布置。
- **适合谁：** P2 为主，P4 做“按图纸搭建”。
- **改编可行性：** 低到中。

#### 16. teru776/kawaii-room-maker（わたしのおへやメーカー）

- **仓库与数据：**
  - 地址：https://github.com/teru776/kawaii-room-maker
  - 数据：0★，仓库只有 10KB [实测]
  - 许可证：README 自称 MIT，但**仓库里没有 LICENSE 文件**，GitHub 识别为 NONE [实测]
  - demo：https://teru776.github.io/kawaii-room-maker/
- **试玩过程** [实测]：标题页之后是房间编辑器，底部目录有家具、装饰、植物、宠物四页，物品全是 emoji；右下有小猫吉祥物给提示。
- **README 原文大意：** 面向 8–10 岁，灵感来自 Toca Boca；没有分数，没有计时 [原文]。
- **为什么好玩：** 纯创作，没有压力，适合当“奖励时间”。
- **华文融进机制：**
  - 同第 15 条的方位词任务；
  - 每个 emoji 物品下写中文词，点一下读音；
  - 新家具要在街机里赢才能解锁，让装饰成为练习的动力。
- **适合谁：** P2。
- **改编可行性：** 想法极简单，但许可证不清楚，直接自己重写（反正只有 10KB）。

### 🎨 画画 / 填色

#### 17. vikrum/kidpix（JS Kid Pix）

- **仓库与数据：**
  - 地址：https://github.com/vikrum/kidpix
  - 数据：742★，GPL-3.0 [实测]
  - 背景：Kid Pix 1.0 在 1989 年进入公有领域，这是它的 HTML/JS 重写版 [原文]
  - demo：https://kidpix.app/ 返回 200
- **素材：** 仓库里有 210 个音频文件 [实测文件树]。
- **为什么好玩：** 每个工具都有搞怪音效和动画。TNT 橡皮会炸掉画面，印章“咚”地盖下，疯狂刷子会乱跳。孩子画画时一直在笑，男孩也爱玩 TNT。
- **华文融进机制：**
  - **象形字印章：** 印章是日、月、山、水、火、木、鸟、鱼、人、雨这些字。盖下去先是楷体字，0.5 秒后“变身”成对应的小图画，播放“字 → 图”的演变动画。
  - **魔法毛笔：** 用 HanziWriter 在画布上写一个字，写对了这个字就在画里活过来：写“雨”就下雨，写“鸟”就飞过一只鸟。
  - 用 chars 的象形字子集。
- **适合谁：** P2（P4 也会玩）。
- **改编可行性：** GPL-3.0，拷代码的话整页也要 GPL，所以建议只借交互和音效设计。音效用 WebAudio 合成。

#### 18. drakarah/paintbynumbersgenerator

- **仓库与数据：**
  - 地址：https://github.com/drakarah/paintbynumbersgenerator
  - 数据：431★，MIT [实测]
  - demo：https://drakarah.github.io/paintbynumbersgenerator/index.html 返回 200
- **README 原文大意：** 用 k-means 把图片量化成少数颜色，再矢量化成 SVG 数字填色图；有 CLI 版本，也可以限定调色板 [原文]。
- **为什么好玩：** “数字填色”类 App（如 Happy Color）在孩子中很受欢迎：只要对号入座，画面一点点显现，解压又有成就感。
- **华文融进机制：** 做成**拼音填色**。
  - 开发时用这个生成器离线把图片（鱼尾狮、滨海湾、熊猫）转成区域 SVG，内嵌进页面；运行时不需要它。
  - 每个区域里写的是**汉字**，不是数字；调色板按钮上写**拼音**。孩子选了“qīng”色，就要找出所有读 qīng 的字的区域涂上，画面慢慢显现。
  - P4 版：色块按钮写部首、近义词或反义词，例如“把‘高兴’的近义词都涂红色”。
  - 涂错会提示。
- **适合谁：** 都适合，P2 为主。
- **改编可行性：** 低到中。每幅 SVG 大约 50–200KB [推断]，运行时逻辑简单。

#### 19. KyleMit/Splotch

- **仓库与数据：**
  - 地址：https://github.com/KyleMit/Splotch
  - 数据：5★，MIT，当天还有推送，非常活跃 [实测]
  - demo：https://splotch.art/ 返回 200
- **README 原文大意** [原文]：
  - 给 2 岁以上幼儿的画画 PWA，按钮大、颜色亮、没有菜单；
  - 内置涂色书，“魔法刷”一刷，下面的图就显现出来；
  - “AI 化”功能要调用付费模型，我们不用。
- **为什么好玩：** 刷一下，图就出来，即时满足感很强。
- **华文融进机制：** 做成**刮刮乐认字**。
  - 底图是一个词的图画（例如苹果），上面盖着一层；
  - 孩子用魔法刷刮开，同时 TTS 读“苹果 píngguǒ”；
  - 刮开 70% 后浮出几个候选字，选对（或用 HanziWriter 写对）就得到一张贴纸，进贴纸册。
- **适合谁：** P2。原作面向 2 岁以上，对 8 岁偏幼，所以只借“揭图”这个机制 [推断]。
- **改编可行性：** 低。蒙版用 Canvas 的 `globalCompositeOperation = 'destination-out'` 就能做。仓库有 1.4GB，不要整个克隆 [实测 size]。

### 🥚 收集图鉴 / 扭蛋开蛋（务必防赌博化）

#### 20. gavilanbe/gacha-zoo

- **仓库与数据：**
  - 地址：https://github.com/gavilanbe/gacha-zoo
  - 数据：0★，MIT，**整个游戏是一个 428KB 的 index.html**，用 Three.js r160 [实测]
  - 背景音乐是 14 个 m4a 文件，每个约 1MB [实测]
  - demo：https://gavilanbe.github.io/gacha-zoo/
- **试玩过程** [实测]：
  - 画面中间是 3D 扭蛋机（机身写着 “Serie Bosque”），顶部有一条计数（显示 12/12），底部一排“?”收集格；
  - 右侧“游戏厅”有好几个小游戏（记忆类 “¿Quién falta?”、找内鬼 “El impostor”、点球等），**用来赚币**。
- **README 原文大意：** 14 个系列的体素（voxel）小动物，可以作为 PWA 安装 [原文]。
- **为什么好玩：** 拉杆、胶囊弹出、开箱动画是孩子最爱的“惊喜时刻”；一格格的“?”让人想集齐。
- **华文融进机制，并防赌博化：**
  - 硬币**只能靠练习赚**：每局街机按星数发币，**不设任何购买**。
  - **不做纯随机：** 每个系列显示进度；每拉 5 次必出一个没有的；重复的自动变成“碎片”，攒够可以兑换指定的一只。惊喜放在动画里，不放在概率里。
  - 每只动物就是一个**汉字精灵**，例如“森森”由三个木组成、身上写着字。卡背有拼音、组词、例句（来自 chars）。
  - 集齐一个部首系列，解锁这个部首的小故事（stories）。
- **适合谁：** 都适合。
- **改编可行性：** 中。Three.js 在 cdnjs 上。音乐要换成 WebAudio 合成，否则单是音乐就 14MB。体素模型是否由代码生成，还需要读源码确认 [推断]。

> 其他扭蛋类找到的都更弱：codebytequill/kawaii-cat-gachapon-game 1★、无许可证；DragonMarquise/GachaGameSimulator 是 AGPL；两个原神抽卡模拟器是赌博化模拟，不适合，都没有入选。[实测]

### 🍉 合成类（休闲）

#### 21. moonfloof/suika-game（合成大西瓜克隆）

- **仓库与数据：**
  - 地址：https://github.com/moonfloof/suika-game
  - 数据：61★ [实测]
  - 许可证：LICENSE 原文写明 index.js、index.html 和 assets 全部是 **Unlicense（公有领域）**，自带的 matter.js 是 MIT [实测]
  - demo：https://moonfloof.github.io/suika-game/ 返回 200，Canvas 能渲染出水果精灵 [实测]
- **实现** [实测源码]：
  - `index.js` 共 401 行；
  - `fruitSizes` 表定义 11 级水果的半径和分数；
  - 在 `Events.on(engine, 'collisionStart')` 里，同半径的两个水果合并成下一级。
- **为什么好玩：** 合成大西瓜在中国小孩里是现象级游戏。物理掉落、连锁合成、堆到顶线就输，“再来一局”冲动极强。
- **华文融进机制：** 做成**合成大汉字**，把规则从“同级合并”改成“**能组成字或词才合并**”。
  - **叠字链（P2）：** 木 → 林 → 森，火 → 炎 → 焱，日 → 昌 → 晶，口 → 吕 → 品，人 → 从 → 众，石 → 砳 → 磊，又 → 双 → 叒，土 → 圭 → 垚。顺便教“品字结构”。
  - **词语球（P2 / P4）：** 掉下来的是字球，“朋”碰到“友”就合成一个更大的“朋友”球，TTS 读词。题目来自 words 的听写词。
  - **偏旁球（P4）：** 氵 + 青 = 清。题目来自 build 栏目，所以还能“打出连锁”。

  下一个要掉的球提前显示，孩子要**规划把“朋”放到“友”旁边**。这是真正的策略，不是答题。
- **适合谁：** 都适合。
- **改编可行性：** 低。matter.js 0.20.0 在 cdnjs 上 [实测]；把水果 PNG 换成 Canvas 画的彩色果冻球，上面写楷体字。

#### 22. kusazh/hanzi（合成大漢字）

- **仓库与数据：**
  - 地址：https://github.com/kusazh/hanzi
  - 数据：1★，**GitHub 识别不到许可证** [实测]
  - demo：https://kus.ai/hanzi/
- **试玩过程** [实测]：点击以后，**部件以真实字形作为刚体**掉进黑色容器，用的是繁体。
- **README 原文大意：** 用了 CHISE 的字形分解数据、台湾教育部《国语小字典》、matter.js、opentype.js 和思源宋体子集 [原文]。
- **为什么值得看：** 说明“合成大西瓜 × 汉字”已经有人做出来，而且可以玩。
- **华文融进机制：** 同第 21 条；另外可以借它“用 opentype 读出字形轮廓，生成 matter.js 多边形”的思路，让碰撞体本身就是字的形状，视觉上更像汉字。
- **适合谁：** P4（要改成简体）。
- **改编可行性：** 没有许可证，只借思路。

#### 23. ganlvtech/phaser-catch-the-cat（捉住小猫 / 围住神经猫）

- **仓库与数据：**
  - 地址：https://github.com/ganlvtech/phaser-catch-the-cat
  - 数据：756★，MIT，Phaser 3 [实测]
  - demo：https://ganlvtech.github.io/phaser-catch-the-cat/ 返回 200
  - 主场景 `mainScene.ts` 约 10KB，自带多种小猫寻路 solver [实测文件树]
- **README 原文大意：** 点击小圆点放路障；你走一步，小猫走一步；围住小猫就赢，让它逃到边界就输 [原文]。
- **为什么好玩：** 猫、回合制，一局一分钟，还带点策略，两个孩子都能玩。
- **华文融进机制：** 每个圆点上写一个字，本回合规则写在顶部，例如“只能点**三点水**的字”或“只能点读 **qīng** 的字”，只有符合规则的格子才能放路障。点错字，小猫白走一步。越到后面，规则越难，比如“反义词”“能和‘花’组词的字”。题目来自 chars 和 build。
- **适合谁：** 都适合。P2 玩部首和拼音规则，P4 玩组词和反义规则。
- **改编可行性：** 低。Phaser 在 cdnjs 上，也可以直接用 HW.arcade 的 Canvas 重写（六边形网格加 BFS）。
- **备注：** 这个偏益智，可能和益智分支重复。

---

## 3. 没入选的仓库和原因

| 仓库                                        | ★    | 许可证       | 不选的原因                                                              |
|---------------------------------------------|------|--------------|-------------------------------------------------------------------------|
| furnishup/blueprint3d                       | 1979 | MIT          | 3D 室内设计工具，偏成人，对 iPad 太重                                   |
| jeremyckahn/farmhand                        | 141  | GPL-2.0      | React 经营游戏，系统复杂，GPL                                           |
| bemusic/bemuse                              | 1248 | AGPL-3.0     | 硬核 BMS 音游，许可证最严                                               |
| 1j01/jspaint                                | 7881 | MIT          | 复刻 MS Paint，是工具不是游戏，儿童吸引力不如 Kid Pix                   |
| piskelapp/piskel                            | 12796| Apache-2.0   | 像素编辑器，工具向                                                      |
| liyupi/daxigua                              | 1431 | 无           | 合成大西瓜魔改版，无许可证，是 Cocos 编译产物                           |
| FunkinCrew/Funkin                           | 3761 | NOASSERTION  | Haxe 写的，不是 JS，素材版权复杂                                        |
| lvandeve/etherealfarm                       | 37   | GPL-3.0      | 放置类数值游戏，不适合 8–10 岁                                          |
| bangtutorial/lembah-kenanga                 | 13   | MIT          | 农场代码不错（无引擎、WebAudio），但用 PNG 素材、印尼语，paradise-isle 更贴合 |
| Gmast2662/grow-your-garden                  | 11   | MIT          | README 自述由 AI 编写且作者已停止维护                                   |
| sankerone/electronic-pet                    | 7    | 无           | “完成任务喂宠物”的思路对，但依赖 Supabase 后端；README 称 MIT 却没有 LICENSE 文件 |
| cbarkinozer/hanzi_fusion                    | 3    | 无           | “汉字版 Little Alchemy”的思路好，但用 Flutter，无许可证                 |
| chrisdavidmills/emogotchi                   | 65   | CC0          | 主题是“让 Emo 保持痛苦”，不适合儿童                                     |
| TriForMine/Delixia                          | 12   | Apache-2.0   | Overcooked 类，用 Babylon.js 3D 联机，太重                              |
| vyse12138/minecraft-threejs                 | 575  | MIT          | 可以做“方块造字”创作玩法，但 3D 在 iPad 上有性能风险，暂缓              |
| Mantan21 / shadorki 原神抽卡模拟器          | 291 / 733 | MIT / 无 | 赌博化抽卡模拟，明确不适合                                              |

---

## 4. 设计原则（给实现者）

1. **华文必须写在机制的“判定条件”里，不能写在弹窗里。** 上面每一条的共同点是：“谁能合并”“点哪一列”“放在哪里”“哪两条鱼能配对”都由华文知识决定，答错的代价是游戏内的代价（踩白块、菜糊了、小猫多走一步），不是“回答错误”的红叉弹窗。
2. **养成层做成“经济系统”，不另外出题。**
   - 金币、种子、胶囊只从 11 个街机加上面这些新玩法里产出；
   - 花费在宠物、房间、岛屿、扭蛋上；
   - 需要复习的内容，以“字田枯萎”“宠物想吃某个词”这类形式回流到街机。
3. **防赌博化：**
   - 不花真钱，不设付费货币；
   - 概率公开，保底可见，重复的变碎片可以兑换；
   - 每天开蛋次数有上限，但可以选；
   - 不做“损失厌恶”的惩罚：宠物不会死，作物枯萎可以救回。
4. **麦克风和语音识别都是“增强”，不是“依赖”。** Artifact 的 iframe 和部分浏览器拿不到，必须能降级到节拍、点击或回放变调 [推断，需实测]。
5. **素材署名：** vue-color-avatar 与 animalese 的 CC BY 4.0 要在关于页写署名；notion-avatar、suika-game 不需要，但写上更好。

---

## 5. 附：执行过的检索

- **`gh api search/repositories`**（按 stars 排序，每条取前 15）：
  - tamagotchi（JS / TS）、virtual pet html5、pet simulator、dress up game（JS / html5）、paper doll、avatar maker、character creator svg；
  - cooking game（JS / html5）、restaurant game、papa's game、cake game、burger game、food truck；
  - room decorator、room decoration game、isometric room、dollhouse、toca boca；
  - farm game JS、farming game html5 / phaser、garden game、plant growing；
  - piano tiles（JS / html5）、rhythm game JS、taiko、suika、合成大西瓜、watermelon matter.js、merge game；
  - color by number、paint by numbers、kid pix、coloring book、drawing app kids；
  - sticker album、sticker book、gacha、gachapon、egg hatching、creature collector、monster collector、pokemon game；
  - kids game（html5 / JS）、cozy game、aquarium、cat game、talking tom、pou、overcooked clone、pizza、sushi、fashion game、dress up svg；
  - plants vs zombies、minecraft clone、animal crossing、draw and guess、你画我猜、换装、电子宠物、hanzi game。
- **GitHub topics 页**（按 stars 排序）：virtual-pet、tamagotchi、dress-up-game、cooking-game、farming-game、piano-tiles、rhythm-game、coloring-book、gacha。
- **元数据复核：** 入选的 25 个仓库逐个跑了 `gh api repos/OWNER/REPO`；许可证有疑问的读了 LICENSE 原文（animalese、Koi、suika-game）。
- **demo 检查：** 23 个 demo 都用 curl 检查过；其中 7 个在浏览器里打开或试玩过：EatKano、suika、paradise-isle、pizzashop、kawaii-room-maker、gacha-zoo、kus.ai/hanzi。另外 DollMaker 和 krepagotchi 只看了首屏。
