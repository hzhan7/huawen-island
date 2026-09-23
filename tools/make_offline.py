#!/usr/bin/env python3
"""把 build/build.py 产出的 docs/index.html 打包成完全离线的单文件。

联网依赖只有三处，本脚本把它们全部内嵌：
  1. <script src=cdn.jsdelivr.net/hanzi-writer>  → 内联 vendor/offline/hanzi-writer.min.js
  2. cdnjs 的 matter.js（52_suika / 57_sling 运行时 import）→ 预先内联，两个游戏的
     loadMatter() 见到 window.Matter 就直接返回，不会再发请求
  3. Google Fonts（<link> + 街机 CSS 里的 @import）→ 换成内嵌 woff2 子集的 @font-face

另外注入一个 localStorage 兜底：Safari 打开 file:// 页面时禁用 localStorage，
没有兜底的话每次读取都拿到默认值，花朵/饼干/字卡会边玩边清零。

用法：python3 tools/make_offline.py [输出路径]（默认 ~/Desktop/华文小岛单机版/index.html）
字体子集用 tools/subset_fonts.py 生成。
"""
import base64
import pathlib
import re
import sys

ROOT = pathlib.Path(__file__).resolve().parent.parent
SRC = ROOT / "docs" / "index.html"
VEN = ROOT / "vendor" / "offline"

FONT_CSS = """<style>
/* 离线内嵌字体（SIL Open Font License 1.1，全文见「许可证」文件夹）：
   ZCOOL KuaiLe = 标题/数字的手写体，Baloo 2 = HUD 数字。均已按本页用到的字符裁剪。 */
@font-face{font-family:"ZCOOL KuaiLe";font-style:normal;font-weight:400;font-display:swap;
src:url(data:font/woff2;base64,%ZCOOL%) format("woff2")}
@font-face{font-family:"Baloo 2";font-style:normal;font-weight:400 800;font-display:swap;
src:url(data:font/woff2;base64,%BALOO%) format("woff2")}
</style>"""

SHIM = """<script>
/* 离线单机版：Safari 打开 file:// 时 localStorage 会抛 SecurityError，
   这里退回到内存版，保证一局里的进度是连贯的（刷新即清空，想长期保存请用「启动游戏.command」）。*/
(function (W, D) {
  'use strict';
  var ok = false;
  try { W.localStorage.setItem('__hw_probe', '1'); W.localStorage.removeItem('__hw_probe'); ok = true; } catch (e) { ok = false; }
  if (ok) return;
  var m = Object.create(null);
  var shim = {
    getItem: function (k) { k = String(k); return k in m ? m[k] : null; },
    setItem: function (k, v) { m[String(k)] = String(v); },
    removeItem: function (k) { delete m[String(k)]; },
    clear: function () { m = Object.create(null); },
    key: function (i) { var ks = Object.keys(m); return i < ks.length ? ks[i] : null; }
  };
  Object.defineProperty(shim, 'length', { get: function () { return Object.keys(m).length; } });
  try { Object.defineProperty(W, 'localStorage', { value: shim, configurable: true }); } catch (e) { /* 只能这样了 */ }
  function tip() {
    var b = D.createElement('div');
    b.setAttribute('role', 'status');
    b.style.cssText = 'position:fixed;left:8px;right:8px;bottom:8px;z-index:99999;margin:0 auto;max-width:34em;' +
      'background:#FFF3CD;color:#5B4300;border:2px solid #E0A800;border-radius:12px;padding:10px 12px;' +
      'font:14px/1.5 -apple-system,"PingFang SC",sans-serif;box-shadow:0 8px 24px -12px rgba(0,0,0,.5)';
    b.innerHTML = '\\u26a0\\ufe0f \\u8fd9\\u6837\\u76f4\\u63a5\\u6253\\u5f00\\uff0c\\u6d4f\\u89c8\\u5668\\u4e0d\\u5141\\u8bb8\\u5b58\\u8fdb\\u5ea6\\uff08\\u5237\\u65b0\\u5c31\\u6e05\\u7a7a\\uff09\\u3002' +
      '\\u60f3\\u8ba9\\u82b1\\u6735\\u3001\\u5b57\\u5361\\u3001\\u5b57\\u5ba0\\u957f\\u671f\\u4fdd\\u7559\\uff0c\\u8bf7\\u53cc\\u51fb\\u540c\\u4e00\\u6587\\u4ef6\\u5939\\u91cc\\u7684\\u300c\\u542f\\u52a8\\u6e38\\u620f.command\\u300d\\u3002' +
      ' <button type="button" style="margin-left:6px;border:0;border-radius:8px;padding:4px 10px;background:#E0A800;color:#3B2C00;font:inherit;font-weight:700">\\u77e5\\u9053\\u4e86</button>';
    b.querySelector('button').onclick = function () { b.remove(); };
    D.body.appendChild(b);
    setTimeout(function () { b.remove(); }, 20000);
  }
  if (D.readyState === 'loading') D.addEventListener('DOMContentLoaded', tip); else tip();
}(window, document));
</script>"""


def inline_js(path: pathlib.Path, note: str) -> str:
    code = path.read_text("utf-8")
    if "</script" in code.lower():
        raise SystemExit(f"{path.name} 里有 </script>，不能直接内联")
    return f"<!-- {note} -->\n<script>\n{code}\n</script>"


def main() -> int:
    out = pathlib.Path(sys.argv[1]).expanduser() if len(sys.argv) > 1 else \
        pathlib.Path.home() / "Desktop" / "华文小岛单机版" / "index.html"
    html = SRC.read_text("utf-8")
    n = {}

    # 1. 字体：删掉 preconnect + Google Fonts <link>，换成内嵌 @font-face
    html, n["preconnect"] = re.subn(r'<link rel="preconnect" href="https://fonts\.[^"]*"[^>]*>\n?', "", html)
    css = FONT_CSS.replace("%ZCOOL%", base64.b64encode((VEN / "zcool-subset.woff2").read_bytes()).decode()) \
                  .replace("%BALOO%", base64.b64encode((VEN / "baloo2-subset.woff2").read_bytes()).decode())
    html, n["fonts_link"] = re.subn(r'<link rel="stylesheet" href="https://fonts\.googleapis\.com/[^"]*">',
                                    lambda _m: css, html)
    # 街机模块运行时还会注入一条 @import（离线时会静默失败，直接去掉）
    html, n["fonts_import"] = re.subn(r'@import url\(\\?"https://fonts\.googleapis\.com/[^)]*\);?', "", html)

    # 1b. 图标：本地打开时浏览器会去要 /favicon.ico，给个内嵌的省掉 404
    icon = ("<link rel=\"icon\" href=\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' "
            "viewBox='0 0 64 64'%3E%3Crect width='64' height='64' rx='14' fill='%23E3402B'/%3E%3Ctext "
            "x='32' y='47' font-size='42' text-anchor='middle' fill='white' font-family='Kaiti SC,STKaiti,serif'"
            "%3E%E6%96%87%3C/text%3E%3C/svg%3E\">")
    html, n["icon"] = re.subn(r"<title>", lambda _m: icon + "\n<title>", html, count=1)

    # 2. hanzi-writer：换成内联
    html, n["hanzi"] = re.subn(r'<script src="https://cdn\.jsdelivr\.net/npm/hanzi-writer@[^"]*"></script>',
                               lambda _m: inline_js(VEN / "hanzi-writer.min.js", "hanzi-writer 3.7.3（MIT）离线内联"),
                               html)

    # 3. matter.js：提前内联，两个物理游戏的 loadMatter() 就会走 window.Matter 分支
    matter = inline_js(VEN / "matter.min.js", "matter-js 0.20.0（MIT）离线内联；52_suika / 57_sling 共用")
    html, n["matter"] = re.subn(r"</head>", lambda _m: SHIM + "\n" + matter + "\n</head>", html, count=1)

    for k, v in n.items():
        if not v:
            raise SystemExit(f"替换失败：{k}（docs/index.html 的写法变了？）")
    left = sorted(set(re.findall(r'(?:src|href)="(https://[^"]+)"', html)))
    if left:
        raise SystemExit("仍有外链：" + ", ".join(left))

    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(html, "utf-8")
    print(f"{out}  {out.stat().st_size / 1048576:.2f} MB  （替换 {n}）")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
