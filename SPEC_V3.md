# 华文小岛 3.0 · 第一批（在 SPEC.md、SPEC_ARCADE.md 之上追加；冲突时以本文件为准）

ROOT = `/Users/hainan/Projects/huawen-island`（git 仓库，**不要 commit/push**）。
设计依据：`research/GAME_SHORTLIST.md`（**必读你负责的那一节**，以及 §0、§1 的“五关”判据）。家长的原话：游戏形式是为了“让小孩子有兴趣继续做下去，以玩的形式做华文”；并要求“去 GitHub 找有趣的、吸引小朋友的游戏类型，学着结合华文知识来做”。对象：新加坡 P4 男孩（约 10 岁）+ P2 女孩（约 8 岁），中国国籍、有华文底子。

## 1. 每个新游戏必须过的五关（来自 GAME_SHORTLIST §1）
1. **换皮测试**：把汉字换成色块还能玩通 → 不合格。华文判断必须决定合并/方向/路线/物理结果。
2. **乱按测试**：乱按会很快输。
3. **决策点**：华文判断落在每一次操作上。
4. **错了有游戏内后果**（踏板碎、刀被弹开、鸟被钢盾弹回），不是弹 ✗。
5. **错题本不被污染**：手没跟上 → `g.miss`；只有真正的华文判断错误才 `g.wrong(item, note)`。

另：每次 `g.right(item, …)` 传入的 item 加上字段 `hz`（本次掌握的汉字字符串，如 `"清"` 或 `"火车"`），供之后的字宠/图鉴元游戏统计掌握度。

## 2. 第一批 6 个游戏（引擎 HW.arcade 见 SPEC_ARCADE §3 与 parts/15_arcade.js 源码）
| id | 文件 | 技能 | GAME_SHORTLIST 节 | 可复用代码 / 只借玩法 | 数据 |
|---|---|---|---|---|---|
| `suika` 合成大汉字 | `parts/52_suika.js` | write | ① | moonfloof/suika-game（**Unlicense，可复用**）+ matter.js（MIT，cdnjs 0.20.0） | `recipes`（新）+ build + words |
| `tug` 兄妹拔河抢字 | `parts/53_tug.js` | listen | ② | kanjiGame 无许可 → 只借玩法 | pick + words + chars |
| `stall` 华文小吃店 | `parts/54_stall.js` | read | ③ | pizzashop 无许可 → 只借玩法 | `menu`（新）+ quiz 量词/搭配 |
| `slash` 切字忍者 | `parts/55_slash.js` | write | ④ | menja GPL-3.0 → **只借玩法，不许抄代码** | `jg`（新）+ chars.jg + HW_STROKES radStrokes |
| `tonerun` 声调跑酷 | `parts/56_tonerun.js` | listen | ⑤ | wayou/t-rex-runner（**BSD-3，可复用**，保留版权声明） | chars.py + words.py（过滤轻声、一/不变调） |
| `sling` 组词弹弓 | `parts/57_sling.js` | read | ⑥ | matter-js examples/slingshot（**MIT，可复用**） | `zuci`（新）+ chars.words |

复用代码时在文件头注释写明来源仓库、许可证和版权行（Unlicense/BSD-3/MIT 的要求）。GPL 与无许可证的仓库只看玩法，不复制任何代码或素材。原仓库的图片/音频一律不用：Canvas/emoji 重画、WebAudio 合成（CSP 禁止运行时 fetch）。
**matter.js 加载**（suika、sling 共用，只加载一次）：
```js
function loadMatter(){ return window.Matter ? Promise.resolve(window.Matter) : (window.__hwMatterP ||= new Promise((res, rej) => {
  const s = document.createElement('script'); s.src = 'https://cdnjs.cloudflare.com/ajax/libs/matter-js/0.20.0/matter.min.js';
  s.onload = () => res(window.Matter); s.onerror = rej; document.head.appendChild(s); })); }
```
加载完成前显示“加载中”；失败要给出友好提示（不白屏）。不要用 Matter.Render / MouseConstraint，物理在 spec.update 里 `Engine.update`，绘制在 spec.draw 里自己画。

## 3. 新数据栏目（D 组 agent 生成到 content/，build 会并入 HW_DATA；**游戏读取方式**：`const X = ((window.HW_DATA||{})[ctx.grade]||{}).recipes || []`，缺失时要有兜底）
年级 key 为 p2…p6；**每年级只能用该年级及以下的字**（来源：该年级及更低年级的 words/chars/build/pick 里出现过的字），P2 的内容要让 8 岁孩子能玩。
- `content/ext_recipes.json` → 栏目 `recipes`（合成配方，每年级 40–60 条）：`{"a":"氵","b":"青","ans":"清","py":"qīng","word":"清水"}`。a、b 是两个部件（部首或声旁，可以是成字部件），`a+b` 必须**真能**组成 ans（按规范字形的一级拆分）；word 是含 ans 的常用词（该年级能懂）。另可有 `"chain":true` 表示 ans 还能作为部件继续合成（如 木+木=林，林+木=森），并在 `chains` 数组里列出（可选）。
- `content/ext_jg.json` → 栏目 `jg`（字的结构，覆盖该年级 words 与 chars 里的**全部**汉字）：`{"c":"晴","jg":"左右"}`，jg ∈ 独体/左右/上下/左中右/上中下/半包围/全包围/品字形。有争议或不典型的字写 `"skip":true`。
- `content/ext_zuci.json` → 栏目 `zuci`（组词弹弓，每年级 25–30 条）：`{"c":"火","ok":[{"x":"车","w":"火车"},{"x":"山","w":"火山"},{"x":"花","w":"火花"}],"bad":["鸟","跑","书","快","云"]}`。w 是 c 与 x 组成的真实常用词（c 在前或在后都可以，w 写完整词）；**bad 里的字与 c 无论前后都组不成任何词**（用 pypinyin 的词组库 `pypinyin.phrases_dict` 与人工判断双重排除）；ok 至少 3 个、bad 至少 5 个，全部是该年级认识的字。
- `content/ext_menu.json` → 栏目 `menu`（小吃店，新加坡小贩中心；各年级可相同或逐级增加）：
  `{"id":"chicken_rice","name":"鸡饭","emoji":"🍗","mw":"盘","base":[{"id":"rice","name":"白饭","emoji":"🍚"},{"id":"chicken","name":"鸡肉","emoji":"🍗"}],"extra":[{"id":"egg","name":"荷包蛋","emoji":"🍳","mw":"个"},{"id":"cucumber","name":"黄瓜片","emoji":"🥒","mw":"片"},{"id":"chili","name":"辣椒酱","emoji":"🌶️","mw":"勺"}]}`
  另附同文件栏目 `menuwords`：颜色、位置（最上面/中间/最下面）、数量词与量词搭配表 `[{"n":"沙爹","mw":"串"}]`。**家长需要过目**：在 `research/MENU_FOR_PARENT_REVIEW.md` 列出全部菜名/量词，标注“新加坡说法/中国说法”。
所有新数据：简体、拼音带调号（同 SPEC.md §2 规则）、JSON 合法。

## 4. 测试（同 SPEC_ARCADE §6）
各用自己的 `build/_v3_<id>/` 目录：parts 用符号链接（只链接 00_head.html、10_core.js、15_arcade.js、20_games_a.js、30_games_b.js 与自己的文件），`build.py --parts-dir … --out … --report … --pages-out …`，`node tools/shot.js` 截图/按步骤试玩。新数据若尚未生成，用现有栏目兜底开发；reviewer 阶段必须用真实新数据测。控制台 0 错误；手机 390×844 与电脑 1280×800；P2 与 P4 各玩一局到结算。
