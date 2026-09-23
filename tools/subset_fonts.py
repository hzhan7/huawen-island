#!/usr/bin/env python3
"""给离线单机版裁字体：只保留 docs/index.html 里真正出现过的字符。

依赖：pip install fonttools brotli（本仓库的 .venv 里已装）。
字体原件（SIL OFL 1.1）从 google/fonts 下载到 vendor/offline/：
  ZCOOLKuaiLe-Regular.ttf  ofl/zcoolkuaile/
  Baloo2[wght].ttf         ofl/baloo2/
产物：vendor/offline/zcool-subset.woff2、baloo2-subset.woff2（由 make_offline.py 内嵌）。
"""
import pathlib

from fontTools import subset
from fontTools.ttLib import TTFont

ROOT = pathlib.Path(__file__).resolve().parent.parent
VEN = ROOT / "vendor" / "offline"
# emoji 一律交给系统字体；这里只留 ASCII、带调拼音、CJK、部首、CJK 标点与全角符号
RANGES = ((0x20, 0x7e), (0xa0, 0x24f), (0x2000, 0x206f), (0x2e80, 0x2eff),
          (0x3000, 0x303f), (0x3400, 0x9fff), (0xff00, 0xffef))


def wanted() -> str:
    page = (ROOT / "docs" / "index.html").read_text("utf-8")
    keep = {c for c in set(page) if any(a <= ord(c) <= b for a, b in RANGES)}
    return "".join(sorted(keep))


def covered(src: pathlib.Path, text: str) -> str:
    cmap = set()
    for t in TTFont(src)["cmap"].tables:
        cmap |= set(t.cmap)
    return "".join(c for c in text if ord(c) in cmap)


def cut(src: pathlib.Path, out: pathlib.Path, text: str) -> str:
    have = covered(src, text)
    opts = subset.Options()
    opts.flavor = "woff2"
    opts.layout_features = ["kern", "liga", "ccmp", "locl", "palt"]
    opts.drop_tables += ["DSIG"]
    font = subset.load_font(str(src), opts)
    sub = subset.Subsetter(options=opts)
    sub.populate(text=have)
    sub.subset(font)
    subset.save_font(font, str(out), opts)
    print(f"{out.name}: {len(have)}/{len(text)} 个字符，{out.stat().st_size / 1024:.0f} KB")
    return have


def main() -> None:
    text = wanted()
    print("页面用到的字符", len(text))
    have = set(cut(VEN / "ZCOOLKuaiLe-Regular.ttf", VEN / "zcool-subset.woff2", text))
    cut(VEN / "Baloo2.ttf", VEN / "baloo2-subset.woff2", "".join(c for c in text if ord(c) < 0x250))
    miss = [c for c in text if ord(c) >= 0x3400 and c not in have]
    print(f"ZCOOL KuaiLe 没有的字 {len(miss)} 个（回退到楷体）：{''.join(miss[:40])}")


if __name__ == "__main__":
    main()
