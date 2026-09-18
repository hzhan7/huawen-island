# 华文小岛

给新加坡小学生（P2–P6）练华文的网页小游戏，覆盖**听、说、读、写**。一共 14 个游戏，每轮 3–5 分钟，可以随时切换年级。

**在线玩：** https://hzhan7.github.io/huawen-island/ （iPad、手机、电脑都能用）

| 技能 | 游戏 |
|---|---|
| 听 | 顺风耳（听音选词）· 故事电台（听故事答题）· 听写大挑战（田字格里手写） |
| 说 | 朗读小明星 · 绕口令擂台（计时破纪录）· 小小主持人（看图会话，对齐口试） |
| 读 | 知识闯关（拼音/成语/关联词/病句/古诗等 22 类）· 拼音连连看 · 句子排排队 · 阅读小侦探 |
| 写 | 笔顺描红（看→描→默写）· 偏旁魔术 · 错字侦探 · 小作家（造句/看图写话） |

奖励机制：每轮得 0–3 颗星，换成小红花；小红花攒够了解锁红色印章。「今日四件事」是听说读写各玩一轮。答错的题自动进错题本，重练答对两次就会移出。

## 两个版本

- **GitHub Pages（`docs/index.html`）**：进度存在这台设备的浏览器里，不用登录。
- **claude.ai Artifact（`dist/index.html`）**：进度存在云端，换设备也在，还有「AI 老师点评」（造句、看图写话、会话）。

两个版本的进度不互通。

## 题库

`content/*.json` 按年级（`p2`…`p6`）和栏目组织，格式和出题规则见 [SPEC.md](SPEC.md)。每个年级有：50 个听写词、30 个写字表字、50 道知识题、20 道听音选词、6 篇听力故事、8 段朗读、5 条绕口令、6 个会话话题、15 道排句、4 篇阅读、15 道偏旁题、15 道错字题、8 道写作题。

## 构建

```bash
python3 -m venv .venv && .venv/bin/pip install pypinyin
(mkdir -p vendor && cd vendor && npm pack hanzi-writer-data@2.0.1 && tar xzf hanzi-writer-data-2.0.1.tgz)
.venv/bin/python build/build.py
```

构建会同时生成 `dist/index.html`（Artifact 版）和 `docs/index.html`（Pages 版）。校验结果写在 `build/report.txt`，包括：字段和答案下标、用 pypinyin 交叉核对拼音、错字下标、笔顺缺字，以及朗读用「地」的读音分类。

笔顺数据来自 [hanzi-writer-data](https://github.com/chanind/hanzi-writer-data)（Make Me a Hanzi，Arphic Public License），构建时只把用到的字内嵌进页面。
