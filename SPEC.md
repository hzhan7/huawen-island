# 华文小岛 · 规格书（所有 agent 共用，唯一契约）

项目根：本仓库根目录（下文简称 ROOT；最初在临时目录生成，已迁到 `~/Projects/huawen-island/`）

## 0. 产品一句话
给在新加坡读小学、有中国华文底子的两个孩子（刚读完 P2、P4，即将读 P3、P5）玩的华文练习网页游戏。覆盖 **听 / 说 / 读 / 写**，年级 **P2–P6 可选**。单个 HTML（claude.ai Artifact），手机/iPad/电脑都能玩。核心要求：**好玩** + **覆盖华文基础知识** + **内容绝对准确**（错一个拼音就是在教错）。

## 1. 文件布局
```
ROOT/content/<组>.json      题库（按年级分 key，见 §2），build 时按 年级→栏目 深合并
ROOT/content/_sample.json   每个栏目 1 条示例（= schema 示范，引擎开发用）
ROOT/parts/00_head.html     <title> + Google Fonts <link> + 全部 <style>（E1）
ROOT/parts/10_core.js       HW 核心：存储/档案/地图/奖励/错题本/TTS/音效/ASR/AI/汉字书写/ctx（E1）
ROOT/parts/20_games_a.js    游戏：pick story dictation readaloud twister talk（E2）
ROOT/parts/30_games_b.js    游戏：quiz match order passage stroke build typo compose（E3）
ROOT/build/build.py         构建+校验脚本 → ROOT/dist/index.html + ROOT/build/report.txt
ROOT/vendor/package/<字>.json  hanzi-writer-data 2.0.1 笔顺数据（已下载，9580 字）
ROOT/.venv/bin/python        装了 pypinyin 的 python（拼音交叉核对用）
```
最终 `dist/index.html` 结构（build.py 负责拼接，页面**不要**写 `<!doctype>/<html>/<head>/<body>`，发布时平台自动包）：
```
parts/00_head.html
<script src="https://cdn.jsdelivr.net/npm/hanzi-writer@3.7.3/dist/hanzi-writer.min.js"></script>
<div id="app"></div>
<script>window.HW_DATA = {...合并后的题库...};</script>
<script>window.HW_STROKES = {"晴": {...hanzi-writer-data...}, ...};</script>
<script> parts/10_core.js </script>
<script> parts/20_games_a.js </script>
<script> parts/30_games_b.js </script>
<script>HW.boot();</script>
```
**CSP 硬约束**：外部脚本只能来自 cdn.jsdelivr.net/npm/ 和 cdnjs；**任何 fetch/XHR 都会被静默拦截**（包括 hanzi-writer 默认的笔顺数据加载）→ 笔顺数据必须内嵌（HW_STROKES）。样式表只能来自 fonts.googleapis.com。不能有音频文件 → 音效用 WebAudio 合成，朗读用 speechSynthesis。

## 2. 题库 schema（content/*.json）
顶层：`{"p2": {栏目: [...]}, "p3": {...}, ..., "p6": {...}}`。一个文件可以只含部分年级、部分栏目；build 深合并。
通用规则：
- UTF-8 合法 JSON，无注释。简体字。中文句子用全角标点（，。！？：；“”《》……）。
- 拼音：带调号（ā á ǎ à，ü 写成 ü，如 lǜ、nǚ），**每个汉字一个音节，音节间单空格**，不含标点。轻声不标调（妈妈 mā ma）。“一”“不”按课本注音标变调（一个 yí gè，一起 yì qǐ，不是 bú shì）。避免儿化词。
- 选择题：`c` 为 3–4 个选项，`a` 为正确选项下标（0 起），**必须恰好一个正确答案**；干扰项要“像但错”，不能也对。引擎会随机打乱选项。
- `e` 讲解：孩子能看懂的一句话，≤40 字。
- 原创内容，不抄课本原文（民间绕口令、古诗、成语除外）。积极、适龄。
- **会被 TTS 朗读的文本**（pick.say/ctx、stories 全部、readaloud、twisters、talk.sample、words.w/s）：数字写汉字（“三点半”不写“3:30”），不含英文字母/缩写（写“地铁”不写 MRT），避免 TTS 易读错的多音字歧义语境。
- 生活场景：新加坡日常（组屋、巴刹、小贩中心、食阁、地铁、巴士、德士、东海岸公园、滨海湾花园、植物园、圣淘沙、榴莲、红毛丹、国庆日、华人新年、中秋节、屠妖节、开斋节、学校食堂、华文课、CCA 写作“课外活动”）与中国文化（节日、成语故事、古诗）交替。

### 年级难度标尺（孩子有中国华文底子，每级按该年级偏上、接近中国部编版同年级）
| 年级 | 字词 | 语法/知识点 | 听/读短文长度 |
|------|------|-------------|---------------|
| P2 | 常用双音节词、AABB/ABB 叠词、常见量词 | 反义词、近义词、简单句、标点（，。？！） | 60–100 字 |
| P3 | 四字词语入门、常见成语约 10 个 | 关联词（因为…所以…/虽然…但是…/一边…一边…）、形近字、同音字 | 100–160 字 |
| P4 | 成语、多音字 | 修辞（比喻、拟人）、词语搭配、近义词辨析 | 150–220 字 |
| P5 | 成语与惯用语 | 复句关联词、病句、修辞（排比、夸张、设问、反问） | 220–300 字 |
| P6 | 成语典故、歇后语、俗语、古诗名句 | 复杂复句、概括主旨、作者态度、写法 | 280–400 字 |

### 栏目定义（名字即 JSON key）
**words**（字词库；听写、拼音连连看共用）每年级 **50** 条：
`{"w":"晴朗","py":"qíng lǎng","s":"今天天气晴朗，我们去东海岸公园放风筝。","m":"天空没有云，阳光很好"}`
w 为 2–4 字常考词；s 必须包含 w，P2 ≤20 字，P6 ≤40 字；m 可选。

**chars**（写字表；笔顺描红用）每年级 **30** 条：
`{"c":"晴","py":"qíng","bs":"日","jg":"左右","words":["晴天","晴朗","雨过天晴"]}`
jg ∈ 独体/左右/上下/左中右/上中下/半包围/全包围/品字形。选该年级真正常写、笔顺易错的字。

**quiz**（基础知识闯关）每年级 **50** 条：
`{"t":"量词","q":"一（　）小狗","c":["只","条","头","匹"],"a":0,"e":"小狗、小猫这类小动物用“只”。"}`
t 只能取：拼音 声调 部首 笔画 笔顺 量词 近义词 反义词 词语搭配 叠词 多音字 形近字 同音字 成语 关联词 标点 修辞 病句 歇后语 古诗 俗语 地区词。
各年级题型分布按上面难度标尺；“地区词”= 新加坡说法 vs 中国说法（如 德士/出租车、巴刹/菜市场、食阁/美食广场），每年级 2–3 题，趣味向。空位统一用全角括号+全角空格“（　）”。

**pick**（听音选词·顺风耳）每年级 **20** 条：
`{"say":"再见","ctx":"放学了，我对老师说再见。","py":"zài jiàn","c":["再见","在见","再建","在件"],"a":0}`
引擎先读 say，可点“听句子”读 ctx；孩子选出 ctx 语境里 say 的正确写法。ctx 必须包含 say 原文。干扰项用同音/近音/形近字替换，**任何干扰项都不能是与 say 同音的合法词语且在 ctx 里也说得通**。

**stories**（听故事答题·故事电台）每年级 **6** 篇：
`{"title":"巴刹里的早晨","text":"……全文……","qs":[{"q":"……？","c":[...],"a":1,"e":"……"}]}`
长度按标尺；P2–P4 每篇 3 题，P5–P6 每篇 4 题（含 1 道推断题）。题目只靠听就能答。

**readaloud**（朗读小明星）每年级 **8** 条：
`{"title":"雨后","text":"……","tip":"“是”是翘舌音 shì，别读成 sì。","hard":[{"w":"湿漉漉","py":"shī lù lù"}]}`
text 长度：P2 30–50 字，P3 50–70，P4 70–100，P5 100–140，P6 120–180。hard 2–4 个难读词。

**twisters**（绕口令擂台）每年级 **5** 条：
`{"text":"四是四，十是十，十四是十四，四十是四十。","py":"sì shì sì shí shì shí shí sì shì shí sì sì shí shì sì shí","tip":"分清平舌 s 和翘舌 sh"}`
py 每个汉字一个音节、不含标点。P2 短（≤25 字），逐级变长变难。

**talk**（小小主持人·看图说话/会话，对齐新加坡口试“看录像会话”）每年级 **6** 条：
`{"topic":"排队买饭","scene":"🏫🍱🧍‍♂️🧍‍♀️🧍","desc":"学校食堂里，同学们排队买午饭，有人插队。","q":"如果有人插队，你会怎么做？","follow":["你为什么这样做？","你在生活中见过类似的事吗？"],"starters":["我觉得……，因为……","如果我是……，我会……"],"words":["井然有序","耐心"],"sample":"……示范回答……"}`
sample 长度：P2 40–60 字 … P6 120–180 字，口语化、结构清楚（观点+理由+例子）。

**order**（句子排排队）每年级 **15** 条：
`{"tiles":["放学后，","我和妈妈","去巴刹","买菜"],"ans":"放学后，我和妈妈去巴刹买菜。","alts":[]}`
tiles 按正确顺序给（引擎打乱）；ans = tiles 拼接 + 末尾标点（最多多 1 个字符）。只有一种自然语序；若确有另一种也对，把它的下标顺序写进 alts（如 [[1,0,2,3]]）。P2–P4 为词组块 4–7 块；P5–P6 至少一半题加 `"mode":"para"`：tiles 是 4–6 个完整句子（各自带标点），排成一段通顺的话，ans = 拼接。

**passages**（阅读小侦探）每年级 **4** 篇：
`{"title":"……","text":"第一段……\n第二段……","qs":[{"k":"细节","q":"……","c":[...],"a":2,"e":"……"}]}`
k ∈ 词义/细节/推断/主旨/写法。长度按标尺；每篇 4–5 题，P5–P6 必含推断和主旨。

**build**（偏旁魔术：加偏旁组新字）每年级 **15** 条：
`{"base":"青","rad":"日","ans":"晴","py":"qíng","hint":"晴天","opts":["日","氵","忄","讠"]}`
opts 3–4 个偏旁（含 rad）。hint 是含 ans 的常用词。其他偏旁即使也能与 base 组字，也必须组不出 hint 里的那个字。

**typo**（错字侦探）每年级 **15** 条：
`{"s":"放学了，我们明天在见。","i":8,"bad":"在","good":"再","opts":["再","在","才"],"e":"“再见”的“再”表示又一次。"}`
s 是**含一个错别字**的句子；i 是错字在 s 中的下标（0 起，标点也算一个字符），必须 s[i]==bad；opts 含 good，3–4 个。

**compose**（小作家：造句/写话）每年级 **8** 条：
`{"kind":"造句","prompt":"用“一边……一边……”造句","pattern":"一边……一边……","scene":"","desc":"","min":10,"eg":["弟弟一边吃早餐，一边听故事。"],"check":["用上了“一边……一边……”","两个动作同时发生","句子末尾有标点"]}`
kind ∈ 造句/看图写话/仿写/续写。看图写话要填 scene（3–8 个 emoji 组成的“图”）和 desc（画面描述）。min 字数：P2 10–40，P3 20–60，P4 50–100，P5 80–150，P6 100–200。P2–P3 以造句为主，P5–P6 以写话/续写为主。

## 3. 引擎契约（E1 实现，E2/E3 使用）
纯原生 JS（无框架、无构建），ES2020，不用 `import`。全局命名空间 `window.HW`。

### 注册游戏
```js
HW.register({ id:'pick', skill:'listen', name:'顺风耳', blurb:'听一听，选出正确的词', icon:'👂',
  needs:['tts'],            // 可选：'tts' | 'hanzi' | 'asr'（asr 仅为增强，不应阻止游戏）
  start(ctx){ ...; return cleanupFn /* 可选 */ } });
```
skill ∈ listen/speak/read/write。14 个游戏 id 与分工：
- E2（20_games_a.js）：`pick` 顺风耳(listen) · `story` 故事电台(listen) · `dictation` 听写大挑战(listen) · `readaloud` 朗读小明星(speak) · `twister` 绕口令擂台(speak) · `talk` 小小主持人(speak)
- E3（30_games_b.js）：`quiz` 知识闯关(read) · `match` 拼音连连看(read) · `order` 句子排排队(read) · `passage` 阅读小侦探(read) · `stroke` 笔顺描红(write) · `build` 偏旁魔术(write) · `typo` 错字侦探(write) · `compose` 小作家(write)

### ctx（每次开局新建）
| 成员 | 说明 |
|---|---|
| `ctx.el` | 游戏区容器（已清空）。顶栏（游戏名/进度/退出）由核心渲染，游戏只管 el 内部 |
| `ctx.grade` / `ctx.gradeNum` | `'p3'` / `3` |
| `ctx.G` | 当前年级题库：`{words,chars,quiz,pick,stories,readaloud,twisters,talk,order,passages,build,typo,compose}`，每个都保证是数组（可能为空） |
| `ctx.review` | 错题重练时为该游戏的题目对象数组（与 G 里对象同形），否则 `null`；非 null 时必须只用这些题 |
| `ctx.h(tag, props, ...children)` | 建元素。props：`class`、`style`(字符串)、`on:{click:fn}`、其余当 attribute；children 可为字符串/元素/数组/null |
| `ctx.pick(arr, n)` | 随机取 ≤n 个，优先本档案最近没见过的，并记为已见 |
| `ctx.shuffle(arr)` | 返回打乱的新数组 |
| `ctx.setProgress(done, total)` | 更新顶栏进度 |
| `ctx.next(fn, ms=900)` | 安全延时：游戏已退出则不执行。**所有 setTimeout 都用它** |
| `ctx.alive()` | 游戏还在进行中返回 true |
| `ctx.tts` | `{ok, speak(text,{rate}) → Promise(读完才 resolve；不支持时立即 resolve), stop()}`；rate 缺省按年级（P2 0.8 → P6 0.95） |
| `ctx.sfx` | `{good(), bad(), tap(), win(), flip()}` WebAudio 合成 |
| `ctx.asr` | `{ok, listen({onInterim}) → Promise<string>, stop()}`；不支持/被拒时 ok=false，游戏必须有无麦克风的降级玩法（自评/家长评星） |
| `ctx.ai` | `{ok() → Promise<bool>, review({task, text}) → Promise<{stars:1-3, praise, tips:string[], better}>}`；只在 ok() 为 true 时显示“请 AI 老师点评”按钮，失败要 catch 并提示 |
| `ctx.hanzi` | `{has(ch) → bool, create(el, ch, opts) → HanziWriter|null}`；核心负责 charDataLoader（读 HW_STROKES）和给 el 加田字格；opts 透传 HanziWriter.create |
| `ctx.mcq({options, answer, onAnswer(ok, idx), big})` | 返回一个 `.hw-choices` 元素：点击后标 `.is-right/.is-wrong`、锁定、调用 onAnswer。**不**自动计分。options 按传入顺序显示（需要打乱由游戏先 shuffle 并换算 answer） |
| `ctx.score.right()` | 记对 + 连击 + 音效（≥3 连击有特效） |
| `ctx.score.wrong(item, note)` | 记错 + 音效 + 写入错题本：item=题目对象原样，note=给家长/孩子看的一行说明（如“晴朗 qíng lǎng，你选了：情朗”） |
| `ctx.finish(result)` | 结束本轮：result 可为 `{correct,total}` 或 `{stars:0-3}`，缺省用 score 计数。核心显示结算页（星星、小红花、新印章）并存档 |
| `ctx.toast(msg)` | 轻提示 |
| `ctx.mem` | `{get(key), set(key, value)}`：本档案、本游戏的小型持久键值（如绕口令最佳用时），值须可 JSON 化且很小，随档案一起存档 |
| `ctx.profile` | 只读：`{name, avatar}`，用于“大宝，太棒了！”这类称呼 |

游戏自定义样式：`HW.css(cssText)` 注入；只能用 §4 的 token，类名以 `g-<id>-` 开头。

### 核心职责（E1）
- 档案：多个孩子档案（名字、头像 emoji、年级）。首次打开预置两个示例档案 **“大宝 · P5”“小宝 · P3”**（可改名改年级/删除/新增）。
- 地图首页：四个技能区（听/说/读/写）各列游戏卡；当前档案、年级切换（P2–P6 随时切）、小红花数；**今日四件事**（听说读写各完成一轮 → 当日奖励印章）；错题本入口；印章册入口；学习记录（每个技能的轮数、平均星）。
- 奖励：每轮 0–3 星 = 小红花数；累计小红花解锁**印章**（像老师在作业本上盖的红色印章：“棒”“优”“好样的”“听力王”“小书虫”“神笔”“金嗓子”“鱼尾狮”“熊猫”“榴莲”“月饼”……约 24 枚，CSS 画成红色方章/圆章，楷体字）。
- 错题本：按游戏分组列出 note，可“重练”（以 ctx.review 启动该游戏），答对 2 次自动移出；每档案上限 120 条。
- 存储：`claude.use("db")`（Artifact db capability；类型定义见 `/private/tmp/claude-501/bundled-skills/2.1.275/94a9ea5d85c4ffd6d63c6f757169a77b/artifact-capabilities/0.2.52/db.d.ts`）存 `profiles/<id>` 文档；localStorage（`hw.v1.*`，所有读写 try/catch）做即时缓存与离线降级。先用 localStorage 渲染，db 到达后合并（updatedAt 新者胜）并订阅。db 为 null 时静默只用 localStorage。
- AI 点评：`claude.use("sample")`（类型定义同目录 `sample.d.ts`），modelTier 'quick'，要求返回 JSON；为 null 时 `ai.ok()` 返回 false。只在孩子点击按钮时调用。
- TTS：优先 zh-CN 语音（Tingting / 婷婷 / Google 普通话 / Xiaoxiao 等），其次任何 zh 语音；没有中文语音时首页显示一行提示。iOS 首次发声必须在点击事件里。
- ASR：`SpeechRecognition || webkitSpeechRecognition`，lang zh-CN；iframe 里常被拒 → ok=false 并记住。
- 汉字书写：HanziWriter（全局 `HanziWriter`，可能加载失败 → hanzi.has 恒 false）。
- 结算页、连击特效、彩带（尊重 prefers-reduced-motion）。
- 所有 HW.register 的游戏在地图上自动出现；缺题（该年级栏目为空）的游戏卡显示为“题目准备中”不可点。

## 4. 设计 token 与公共组件（E1 定义取值；E2/E3 只准用这些）
视觉方向：**“作业本 × 田字格 × 红印章 × 小红花”**——中国小学生最熟悉的物件（护眼绿作业本纸、红色田字格、老师的红印章、小红花奖励），配新加坡生活元素。浅色=作业本；深色=**黑板模式**（墨绿黑板 + 粉笔白）。按平台规矩：token 在裸 `:root` 定义完整浅色；`@media (prefers-color-scheme: dark)` 用 `:root:not([data-theme="light"])` 重定义；`:root[data-theme="dark"]` 再定义一次；body 背景用 token。
CSS 变量（名字固定）：`--bg --paper --ink --ink-soft --line --accent(朱红印章/田字格红) --good --bad --gold --listen --speak --read --write --radius --shadow --font-display --font-kai --font-body --font-py`
- `--font-kai`：`"Kaiti SC","STKaiti","KaiTi","楷体",“Noto Serif SC”,serif`（学写字必须楷体/宋体，不能用花体）
- `--font-display`：Google Fonts “ZCOOL KuaiLe”（标题用，克制使用）+ 回退
- `--font-py`：拼音要显示好调号，用系统无衬线（"Helvetica Neue",Arial,sans-serif）
公共类（E1 负责样式，E2/E3 直接用）：
`.hw-stack`（竖排 gap）`.hw-row`（横排可换行 gap）`.hw-card` `.hw-btn` `.hw-btn.primary` `.hw-btn.ghost` `.hw-btn.big` `.hw-icon-btn`（圆形喇叭/麦克风按钮）`.hw-choices` `.hw-choice`（状态 `.is-right .is-wrong .is-dim`）`.hw-kai` `.hw-py` `.hw-big`（大号楷体字）`.hw-passage`（阅读正文，行高 2）`.hw-q`（题干）`.hw-tag`（小药丸标签）`.hw-muted` `.hw-center` `.hw-tianzige`（田字格框）`.hw-tiles` `.hw-tile`（`.is-placed`）`.hw-slots` `.hw-textarea` `.hw-feedback`（`.good .bad`）`.hw-meter`（进度条，内含 span）`.hw-scene`（大号 emoji “图”）`.hw-hl-ok` `.hw-hl-miss`（逐字比对高亮）
点击目标 ≥44px；手机宽 360px 也不横向滚动；键盘焦点可见。

## 5. 构建与校验（build.py）
- 深合并 `content/*.json`（跳过 `_sample.json`）→ HW_DATA。
- 校验（错误写 report.txt，严重错误令退出码非 0）：必填字段；`a` 越界；选项重复；pinyin 音节数 == 汉字数（words/chars/pick/twisters/hard）；`typo.s[typo.i]==typo.bad`；`pick.ctx` 含 `say`；`order.ans` 与 tiles 拼接一致；`build.opts` 含 `rad`；各栏目条数统计表（年级×栏目）。
- 拼音交叉核对：用 `ROOT/.venv/bin/python` + pypinyin 对 words.py / chars.py / pick.py / twisters.py / hard.py 做逐音节比对，不一致的列进 report 的“拼音待人工核对”清单（pypinyin 也会错，只列不改）。
- 收集笔顺需要的字：words 的所有汉字 + chars.c → 从 `vendor/package/<字>.json` 读取，缺的列入 report。
- 输出 `dist/index.html`（结构见 §1）并打印大小。
