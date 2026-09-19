# 第三方许可声明（Third-Party Notices）

华文小岛自己的代码、题库和画面都是本项目写的。下面列出**用到的别人的代码、库和数据**，以及它们的许可证。

- 许可证原文用 `gh api repos/<owner>/<repo>/license` 读取，日期是 2026-09-19。
- Chromium 的许可证按 t-rex-runner 提取源码时的年代，取 `40.0.2214.115` 标签下的 `LICENSE`。
- 所有复用的仓库，原作的图片、音频、字体**一律没用**。画面都用 Canvas 或 emoji 重画，音效都用 WebAudio 合成。

## 1. 总表

| # | 组件 | 用在哪里 | 怎么用 | 许可证 | 会不会随页面分发 |
|---|------|----------|--------|--------|------------------|
| 1 | [moonfloof/suika-game](https://github.com/moonfloof/suika-game) | `parts/52_suika.js` 合成大汉字 | 移植了手感参数、合并流程和 mulberry32 随机数（`index.js`） | Unlicense（GitHub 的 spdx 显示 NOASSERTION，因为 LICENSE 前面多了一段说明；正文就是 Unlicense） | 会，改写后的代码在页面里 |
| 2 | [matter.js 0.20.0](https://github.com/liabru/matter-js) | `parts/52_suika.js`、`parts/57_sling.js` | 物理引擎。运行时从 cdnjs 加载，**不内嵌、不改动** | MIT | 不会，由 cdnjs 提供；文件自带 “License MIT” 版权头 |
| 3 | [liabru/matter-js `examples/slingshot.js`](https://github.com/liabru/matter-js/blob/master/examples/slingshot.js) | `parts/57_sling.js` 组词弹弓 | 改写了发射和重装流程，以及鸟的密度、出膛限速等手感参数 | MIT（与 #2 同一个仓库、同一份 LICENSE） | 会，改写后的代码在页面里 |
| 4 | [wayou/t-rex-runner](https://github.com/wayou/t-rex-runner) | `parts/56_tonerun.js` 声调跑酷 | 移植了跑酷手感：重力、起跳、加速、间距、距离表闪烁、云的视差、跑步帧率、眨眼 | BSD-3-Clause（仓库 LICENSE）；`index.js` 本身提取自 Chromium，受 Chromium 的 BSD 许可约束 | 会。两份版权声明和许可全文都照录在该文件的头注释里，构建时注释会原样进入页面 |
| 5 | [hanzi-writer 3.7.3](https://github.com/chanind/hanzi-writer) | 笔顺描红、听写、写字打怪兽 | 运行时从 jsdelivr 加载，不内嵌 | MIT | 不会，由 jsdelivr 提供 |
| 6 | [hanzi-writer-data 2.0.1](https://github.com/chanind/hanzi-writer-data)（数据源于 [Make Me a Hanzi](https://github.com/skishore/makemeahanzi)，原始字形来自文鼎科技 Arphic 的字体） | 所有要画笔顺或字形的地方 | 构建时只把用到的字的笔顺数据内嵌进页面（`HW_STROKES`） | Arphic Public License | 会，内嵌在页面里；许可证全文见 `licenses/ARPHICPL-hanzi-writer-data.txt` |
| 7 | Google Fonts：Baloo 2、Noto Serif SC、ZCOOL KuaiLe | 界面字体 | 运行时从 fonts.googleapis.com 加载 | SIL Open Font License 1.1（google/fonts 仓库 `ofl/` 目录下各有 `OFL.txt`） | 不会，由 Google Fonts 提供 |

### 只在构建或测试时用、不进页面的工具

| 工具 | 用途 | 许可证 |
|------|------|--------|
| [pypinyin](https://github.com/mozillazg/python-pinyin) | 构建时交叉核对拼音；用它的词组库复查“组不成词”的干扰字 | MIT |
| [hanzi_chaizi](https://github.com/howl-anderson/hanzi_chaizi) | 生成合成配方的候选；构建时复查拆分（可选） | Apache-2.0 |
| [puppeteer-core](https://github.com/puppeteer/puppeteer) | `tools/shot.js` 无头 Chrome 试玩和截图 | Apache-2.0 |

### 只借玩法、没有复制任何代码或素材的仓库（致谢）

| 仓库 | 借了什么 | 许可状态 | 对应游戏 |
|------|----------|----------|----------|
| [kusazh/hanzi](https://github.com/kusazh/hanzi) | “部件一碰就自动成字” | 没有许可证 → 只借玩法 | 合成大汉字 |
| [pinkrec6/kanjiGame](https://github.com/pinkrec6/kanjiGame) | 歌留多抢牌：两人同时按、点错锁手、先到者得分 | 没有许可证 → 只借玩法 | 兄妹拔河 |
| [DigitalCyberSoft/pizzashop](https://github.com/DigitalCyberSoft/pizzashop) | 订单先生成结构化 spec，再渲染成句子，最后按 spec 判分 | 没有许可证 → 只借玩法 | 华文小吃店 |
| [MilllerTime/menja](https://github.com/MilllerTime/menja) | “抛块、划屏切碎”，以及慢动作、坚固块等节奏设计 | GPL-3.0 → 只借玩法，不抄代码 | 切字忍者 |

## 2. 已知缺口（留给构建脚本负责人）

- hanzi-writer-data 的 Arphic Public License 第 1、2 条要求：分发时附上许可文件，而且不能改动。
  - 仓库里已经放了这份文件：`licenses/ARPHICPL-hanzi-writer-data.txt`。2026-09-19 已和上游 `ARPHICPL.TXT` 逐字比对，内容一致。
  - 但构建出来的两个单页（`docs/index.html`、`dist/index.html`）内嵌了笔顺数据，**页面里却没有这份许可证，也没有指向它的说明**。GitHub Pages 版和仓库在一起，问题不大。claude.ai 版是单独分发的。
  - 建议 `build/build.py` 在内嵌 `HW_STROKES` 的地方加一段注释，写明数据来源和 Arphic Public License，最好直接附上全文。
- matter.js 和 hanzi-writer 在页面运行时从 CDN 加载，本项目不分发它们的文件，所以不需要另外附带许可证。上面的 MIT 原文只是存档备查。

---

## 3. 许可证原文

### 3.1 moonfloof/suika-game —— Unlicense

来源：https://github.com/moonfloof/suika-game/blob/main/LICENSE

```text
This license applies to index.js, index.html, and all files in the
assets folder. Matter.js, also included in this project, uses the MIT
license, with a license notice at the top of its file.

This is free and unencumbered software released into the public domain.

Anyone is free to copy, modify, publish, use, compile, sell, or
distribute this software, either in source code form or as a compiled
binary, for any purpose, commercial or non-commercial, and by any
means.

In jurisdictions that recognize copyright laws, the author or authors
of this software dedicate any and all copyright interest in the
software to the public domain. We make this dedication for the benefit
of the public at large and to the detriment of our heirs and
successors. We intend this dedication to be an overt act of
relinquishment in perpetuity of all present and future rights to this
software under copyright law.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND,
EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT.
IN NO EVENT SHALL THE AUTHORS BE LIABLE FOR ANY CLAIM, DAMAGES OR
OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE,
ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR
OTHER DEALINGS IN THE SOFTWARE.

For more information, please refer to <https://unlicense.org>
```

### 3.2 liabru/matter-js（matter.js 本体与 examples/slingshot.js）—— MIT

来源：https://github.com/liabru/matter-js/blob/master/LICENSE

```text
The MIT License (MIT)

Copyright (c) Liam Brummitt and contributors.

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in
all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
THE SOFTWARE.
```

### 3.3 wayou/t-rex-runner —— BSD 3-Clause

来源：https://github.com/wayou/t-rex-runner/blob/gh-pages/LICENSE

```text
BSD 3-Clause License

Copyright (c) 2022, 牛さん
All rights reserved.

Redistribution and use in source and binary forms, with or without
modification, are permitted provided that the following conditions are met:

1. Redistributions of source code must retain the above copyright notice, this
   list of conditions and the following disclaimer.

2. Redistributions in binary form must reproduce the above copyright notice,
   this list of conditions and the following disclaimer in the documentation
   and/or other materials provided with the distribution.

3. Neither the name of the copyright holder nor the names of its
   contributors may be used to endorse or promote products derived from
   this software without specific prior written permission.

THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS "AS IS"
AND ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE
IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE ARE
DISCLAIMED. IN NO EVENT SHALL THE COPYRIGHT HOLDER OR CONTRIBUTORS BE LIABLE
FOR ANY DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR CONSEQUENTIAL
DAMAGES (INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR
SERVICES; LOSS OF USE, DATA, OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER
CAUSED AND ON ANY THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY,
OR TORT (INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE
OF THIS SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.
```

### 3.4 Chromium（t-rex-runner 的 `index.js` 提取自 Chromium）—— BSD 3-Clause

`index.js` 的文件头原文是这样写的：

```text
// Copyright (c) 2014 The Chromium Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.
// extract from chromium source code by @liuwayong
```

下面是其中 “the LICENSE file” 所指的 Chromium 许可证。

来源：https://github.com/chromium/chromium/blob/40.0.2214.115/LICENSE

当前版本见 https://github.com/chromium/chromium/blob/main/LICENSE。它的条款相同，只是版权行改成了 “Copyright 2015 The Chromium Authors”，第 3 条的名称改成了 Google LLC。

```text
// Copyright 2014 The Chromium Authors. All rights reserved.
//
// Redistribution and use in source and binary forms, with or without
// modification, are permitted provided that the following conditions are
// met:
//
//    * Redistributions of source code must retain the above copyright
// notice, this list of conditions and the following disclaimer.
//    * Redistributions in binary form must reproduce the above
// copyright notice, this list of conditions and the following disclaimer
// in the documentation and/or other materials provided with the
// distribution.
//    * Neither the name of Google Inc. nor the names of its
// contributors may be used to endorse or promote products derived from
// this software without specific prior written permission.
//
// THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS
// "AS IS" AND ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT
// LIMITED TO, THE IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS FOR
// A PARTICULAR PURPOSE ARE DISCLAIMED. IN NO EVENT SHALL THE COPYRIGHT
// OWNER OR CONTRIBUTORS BE LIABLE FOR ANY DIRECT, INDIRECT, INCIDENTAL,
// SPECIAL, EXEMPLARY, OR CONSEQUENTIAL DAMAGES (INCLUDING, BUT NOT
// LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES; LOSS OF USE,
// DATA, OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER CAUSED AND ON ANY
// THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY, OR TORT
// (INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE
// OF THIS SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.
```

### 3.5 chanind/hanzi-writer —— MIT

来源：https://github.com/chanind/hanzi-writer/blob/master/LICENSE

```text
The MIT License (MIT)

Copyright (c) 2014 David Chanin

Permission is hereby granted, free of charge, to any person obtaining a copy of
this software and associated documentation files (the "Software"), to deal in
the Software without restriction, including without limitation the rights to
use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of
the Software, and to permit persons to whom the Software is furnished to do so,
subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS
FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR
COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER
IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN
CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
```

### 3.6 chanind/hanzi-writer-data —— Arphic Public License

- `chanind/hanzi-writer-data` 没有 GitHub 能识别的 LICENSE 文件（`gh api .../license` 返回 404）。它的 `package.json` 写的是 `"license": "SEE LICENSE IN ARPHICPL.TXT"`。
- 它的 README 说明：数据来自 Make Me A Hanzi 项目，原始字形来自文鼎科技（Arphic Technology）1999 年发布的字体，按 Arphic Public License 再分发。
- 许可证全文放在仓库里：[`licenses/ARPHICPL-hanzi-writer-data.txt`](licenses/ARPHICPL-hanzi-writer-data.txt)。它和上游 https://github.com/chanind/hanzi-writer-data/blob/master/ARPHICPL.TXT 一字不差（2026-09-19 用 `diff` 核对过）。按这份许可证的要求，这个文件保持原样，**不要改动**。
