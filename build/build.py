#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""华文小岛 · 构建 + 校验（SPEC §1 §5）

用法（在任意目录运行均可；相对路径按 ROOT 解析）:
  .venv/bin/python build/build.py                     # 默认：content/*.json → dist/index.html + build/report.txt
  .venv/bin/python build/build.py --strict            # 有错误就不输出 dist
  .venv/bin/python build/build.py --content-glob content/_sample.json \
        --out build/_selftest/dist/index.html --report build/_selftest/report.txt
  可选：--parts-dir DIR（默认 ROOT/parts）  --vendor-dir DIR（默认 ROOT/vendor/package）
        --no-node（跳过 node 语法检查与嵌入回读校验）  --root DIR

退出码：0 = 无错误；1 = 有错误（默认仍输出 dist，--strict 时不输出）；2 = 参数/环境致命问题。
报告分节：构建信息 / 错误 / 警告 / 拼音待人工核对 / 拼音提示 / 笔顺缺字 / 条数统计。
错误与警告每行带代码（如 [E-PY-COUNT]），便于 grep。
"""
from __future__ import annotations

import argparse
import glob
import hashlib
import json
import re
import shutil
import subprocess
import sys
import time
import unicodedata
from pathlib import Path

SCRIPT_DIR = Path(__file__).resolve().parent
DEFAULT_ROOT = SCRIPT_DIR.parent

# ---------------------------------------------------------------- 契约常量（SPEC §2）
GRADES = ["p2", "p3", "p4", "p5", "p6"]
COLUMNS = ["words", "chars", "quiz", "pick", "stories", "readaloud", "twisters",
           "talk", "order", "passages", "build", "typo", "compose"]
TARGET = {"words": 50, "chars": 30, "quiz": 50, "pick": 20, "stories": 6, "readaloud": 8,
          "twisters": 5, "talk": 6, "order": 15, "passages": 4, "build": 15, "typo": 15,
          "compose": 8}
FIELDS = {
    "words": {"w", "py", "s", "m"},
    "chars": {"c", "py", "bs", "jg", "words"},
    "quiz": {"t", "q", "c", "a", "e"},
    "pick": {"say", "ctx", "py", "c", "a"},
    "stories": {"title", "text", "qs"},
    "readaloud": {"title", "text", "tip", "hard"},
    "twisters": {"text", "py", "tip"},
    "talk": {"topic", "scene", "desc", "q", "follow", "starters", "words", "sample"},
    "order": {"tiles", "ans", "alts", "mode"},
    "passages": {"title", "text", "qs"},
    "build": {"base", "rad", "ans", "py", "hint", "opts"},
    "typo": {"s", "i", "bad", "good", "opts", "e"},
    "compose": {"kind", "prompt", "pattern", "scene", "desc", "min", "eg", "check"},
}
QS_FIELDS = {"stories": {"q", "c", "a", "e", "k"}, "passages": {"k", "q", "c", "a", "e"}}
QUIZ_T = ["拼音", "声调", "部首", "笔画", "笔顺", "量词", "近义词", "反义词", "词语搭配", "叠词",
          "多音字", "形近字", "同音字", "成语", "关联词", "标点", "修辞", "病句", "歇后语", "古诗",
          "俗语", "地区词"]
JG = {"独体", "左右", "上下", "左中右", "上中下", "半包围", "全包围", "品字形"}
PASSAGE_K = {"词义", "细节", "推断", "主旨", "写法"}
COMPOSE_KIND = {"造句", "看图写话", "仿写", "续写"}

LISTEN_LEN = {2: (60, 100), 3: (100, 160), 4: (150, 220), 5: (220, 300), 6: (280, 400)}
READALOUD_LEN = {2: (30, 50), 3: (50, 70), 4: (70, 100), 5: (100, 140), 6: (120, 180)}
TALK_LEN = {2: (40, 60), 3: (40, 180), 4: (40, 180), 5: (40, 180), 6: (120, 180)}  # SPEC 只给了两端
COMPOSE_MIN = {2: (10, 40), 3: (20, 60), 4: (50, 100), 5: (80, 150), 6: (100, 200)}
WORD_S_MAX = {2: 20, 3: 40, 4: 40, 5: 40, 6: 40}  # SPEC：P2 ≤20，P6 ≤40；中间年级按 40 放宽

HW_CDN = "https://cdn.jsdelivr.net/npm/hanzi-writer@3.7.3/dist/hanzi-writer.min.js"
JS_PARTS = ["10_core.js", "20_games_a.js", "30_games_b.js"]
GAME_IDS = {"20_games_a.js": ["pick", "story", "dictation", "readaloud", "twister", "talk"],
            "30_games_b.js": ["quiz", "match", "order", "passage", "stroke", "build", "typo", "compose"]}
ALLOWED_URL_PREFIX = ("https://cdn.jsdelivr.net/npm/", "https://cdnjs.cloudflare.com/",
                      "https://fonts.googleapis.com/", "https://fonts.gstatic.com/")
SIZE_LIMIT = 16 * 1024 * 1024

HZ = r"\u3007\u3400-\u4dbf\u4e00-\u9fff\uf900-\ufaff\U00020000-\U0003134f"
HANZI_RE = re.compile(f"[{HZ}]")
HANZI_RUN_RE = re.compile(f"[{HZ}]+")
HANZI_ONLY_RE = re.compile(f"[{HZ}]+")
TONE_CHARS = "āáǎàēéěèīíǐìōóǒòūúǔùǖǘǚǜńňǹḿ"
PINYIN_LIKE_RE = re.compile(f"[a-zü{TONE_CHARS} ]+")
ALNUM_RE = re.compile(r"[A-Za-z0-9\uff10-\uff19\uff21-\uff3a\uff41-\uff5a]")
HALF_PUNCT = ',?!:;()"\''
END_PUNCT = "。！？…”"
NEUTRAL_CHARS = set("子们的了着过吗呢吧么啊呀头巴么")
BLANK = "（\u3000）"
SEV_ORDER = {"REVIEW": 6, "POLY": 5, "YIBU": 4, "NEUTRAL": 3, "YIBU_RULE": 2, "NEUTRAL_COMMON": 1, "HINT": 0}


def zlen(s: str) -> int:
    """字数：非空白字符数（含标点）。"""
    return sum(1 for ch in s if not ch.isspace())


def hz_list(s: str) -> list[str]:
    return HANZI_RE.findall(s)


def short(s, n=14) -> str:
    s = str(s).replace("\n", "⏎")
    return s if len(s) <= n else s[:n] + "…"


# ---------------------------------------------------------------- 报告
class Report:
    def __init__(self):
        self.errors: list[str] = []
        self.warnings: list[str] = []
        self.py_entries: list[dict] = []   # 拼音比对结果
        self.missing_strokes: dict[str, list[str]] = {}
        self.info: list[str] = []
        self.de_table: dict = {}   # TTS“地”分类

    def err(self, code, loc, msg):
        self.errors.append(f"[{code}] {loc}: {msg}")

    def warn(self, code, loc, msg):
        self.warnings.append(f"[{code}] {loc}: {msg}")


class Item:
    """单条题目的校验上下文。"""

    def __init__(self, rep: Report, grade: str, col: str, idx: int, it, src: str, sub: str = ""):
        self.rep, self.grade, self.col, self.idx, self.it, self.src = rep, grade, col, idx, it, src
        self.gn = int(grade[1])
        label = ""
        if isinstance(it, dict):
            for k in ("w", "c", "say", "title", "topic", "q", "s", "prompt", "text", "ans"):
                if isinstance(it.get(k), str) and it.get(k):
                    label = short(it[k])
                    break
            if col == "build" and isinstance(it.get("ans"), str):
                label = f"{it.get('base')}+{it.get('rad')}={it.get('ans')}"
            if col == "order" and isinstance(it.get("ans"), str):
                label = short(it["ans"])
        self.loc = f"{grade}.{col}[{idx}]{sub}「{label}」({src})"

    def err(self, code, msg):
        self.rep.err(code, self.loc, msg)

    def warn(self, code, msg):
        self.rep.warn(code, self.loc, msg)

    # 字段取值 + 类型检查
    def s(self, f, required=True, nonempty=True, obj=None, pfx=""):
        obj = self.it if obj is None else obj
        if f not in obj:
            if required:
                self.err("E-MISSING", f"缺少字段 {pfx}{f}")
            return None
        v = obj[f]
        if not isinstance(v, str):
            self.err("E-TYPE", f"{pfx}{f} 应为字符串，实际 {type(v).__name__}")
            return None
        if nonempty and not v.strip():
            self.err("E-EMPTY", f"{pfx}{f} 为空")
            return None
        if v != v.strip():
            self.warn("W-SPACE-EDGE", f"{pfx}{f} 首尾有空白")
        return v

    def strlist(self, f, required=True, min_n=1, obj=None, pfx=""):
        obj = self.it if obj is None else obj
        if f not in obj:
            if required:
                self.err("E-MISSING", f"缺少字段 {pfx}{f}")
            return None
        v = obj[f]
        if not isinstance(v, list) or not all(isinstance(x, str) and x.strip() for x in v):
            self.err("E-TYPE", f"{pfx}{f} 应为非空字符串数组")
            return None
        if len(v) < min_n:
            self.err("E-EMPTY", f"{pfx}{f} 至少 {min_n} 项，实际 {len(v)}")
            return None
        return v

    def unknown_fields(self, allowed, obj=None, pfx=""):
        obj = self.it if obj is None else obj
        extra = sorted(set(obj) - allowed)
        if extra:
            self.warn("W-FIELD-UNKNOWN", f"未定义的字段 {pfx}{extra}（拼错了？）")


# ---------------------------------------------------------------- 拼音
class PinyinChecker:
    """pypinyin 交叉核对 + 音节格式校验。pypinyin 不可用时 ok=False，只做基本格式检查。"""

    def __init__(self, rep: Report):
        self.rep = rep
        self.ok = False
        self._cache_run: dict[str, list] = {}
        self._cache_het: dict[str, set] = {}
        try:
            from pypinyin import Style, pinyin
            from pypinyin.contrib.tone_convert import to_normal, to_tone, to_tone3
            from pypinyin.pinyin_dict import pinyin_dict
            self._pinyin, self._Style = pinyin, Style
            self._to_normal, self._to_tone, self._to_tone3 = to_normal, to_tone, to_tone3
            self.valid = set()
            for v in pinyin_dict.values():
                for x in v.split(","):
                    self.valid.add(to_normal(x, v_to_u=True))
            try:
                from pypinyin.contrib.tone_sandhi import ToneSandhiMixin
                from pypinyin.converter import DefaultConverter
                from pypinyin.core import Pinyin

                class _C(ToneSandhiMixin, DefaultConverter):
                    pass
                self._sandhi = Pinyin(_C())
            except Exception:  # noqa: BLE001
                self._sandhi = None
            import pypinyin
            self.version = pypinyin.__version__
            self.ok = True
        except Exception as e:  # noqa: BLE001
            self.version = None
            rep.warn("W-PYPINYIN", "环境", f"pypinyin 不可用（{e}）：跳过拼音交叉核对与音节合法性检查。请用 ROOT/.venv/bin/python 运行")

    # ---- 格式
    def split_check(self, V: Item, field: str, py) -> list[str] | None:
        """返回音节列表；格式有错时报 E-PY-FORMAT 并返回 None。"""
        if not isinstance(py, str):
            return None
        probs = []
        nfc = unicodedata.normalize("NFC", py)
        if nfc != py:
            probs.append("含组合附加符（请用预组合调号字符）")
            py = nfc
        if py != py.strip():
            probs.append("首尾有空白")
        if re.search(r" {2,}|[\t\u3000\u00a0]", py):
            probs.append("音节之间必须是单个半角空格")
        sylls = py.split()
        for s in sylls:
            bad = re.sub(f"[a-zü{TONE_CHARS}]", "", s)
            if bad:
                probs.append(f"音节「{s}」含非法字符 {sorted(set(bad))}（标点/数字/大写/全角都不行）")
                continue
            if "v" in s:
                probs.append(f"音节「{s}」用了 v，应写 ü")
                continue
            if sum(1 for ch in s if ch in TONE_CHARS) > 1:
                probs.append(f"音节「{s}」有多个调号")
                continue
            if self.ok:
                try:
                    base = self._to_normal(s, v_to_u=True)
                    if base not in self.valid:
                        probs.append(f"音节「{s}」不是合法普通话音节（{base}）" +
                                     ("；j/q/x/y 后写 u 不写 ü" if "ü" in base and base[:1] in "jqxy" else "") +
                                     ("；避免儿化" if base.endswith("r") and base != "er" else ""))
                        continue
                    canon = self._to_tone(self._to_tone3(s))
                    if canon != s:
                        probs.append(f"音节「{s}」调号位置不规范，应为「{canon}」")
                except Exception as e:  # noqa: BLE001
                    probs.append(f"音节「{s}」无法解析（{e}）")
        if probs:
            V.err("E-PY-FORMAT", f"{field}「{py}」: " + "；".join(probs))
            return None
        return sylls

    NUMERALS = set("零〇一二三四五六七八九十百千万亿两")

    def yibu_rule(self, chars, sylls, j):
        """课本“一/不”变调规则的期望读音（启发式，只用于给待核对分档，不自动放行）。"""
        ch = chars[j]
        prev = chars[j - 1] if j > 0 else ""
        nextc = chars[j + 1] if j + 1 < len(chars) else ""
        nxt = self.tone_num(sylls[j + 1]) if j + 1 < len(sylls) else None
        if prev and nextc and prev == nextc and not (j >= 2 and chars[j - 2] == ch):  # 看一看、好不好；排除 一闪一闪
            return ("yi" if ch == "一" else "bu"), "夹在重叠词中间读轻声"
        if ch == "一" and (prev == "第" or prev in self.NUMERALS or nextc in self.NUMERALS or nextc in "月日号"):
            return "yī", "序数/数字/日期读本调"
        if nxt is None:
            return ("yī" if ch == "一" else "bù"), "在末尾读本调"
        if nxt == 4:
            return ("yí" if ch == "一" else "bú"), "后字第4声"
        if nxt in (1, 2, 3):
            return ("yì" if ch == "一" else "bù"), f"后字第{nxt}声"
        return None, "后字轻声，看原调"

    def is_toneless(self, s: str) -> bool:
        return not any(ch in TONE_CHARS for ch in s)

    def tone_num(self, s: str) -> int:
        try:
            t = self._to_tone3(s)
            return int(t[-1]) if t[-1:].isdigit() else 5
        except Exception:  # noqa: BLE001
            return 0

    # ---- pypinyin 读音
    def _run(self, run: str) -> list[tuple[str, str]]:
        if run in self._cache_run:
            return self._cache_run[run]
        T = self._Style.TONE
        d = [x[0] for x in self._pinyin(run, style=T)]
        if len(d) != len(run):
            d = [self._pinyin(ch, style=T)[0][0] for ch in run]
        if self._sandhi is not None:
            sd = [x[0] for x in self._sandhi.pinyin(run, style=T)]
            if len(sd) != len(run):
                sd = d
        else:
            sd = d
        res = list(zip(d, sd))
        self._cache_run[run] = res
        return res

    def aligned(self, s: str) -> list[tuple[str, str]]:
        out = []
        for m in HANZI_RUN_RE.finditer(s):
            out.extend(self._run(m.group()))
        return out

    def aligned_in_context(self, s: str, ctx: str):
        if not isinstance(ctx, str):
            return None
        idx = ctx.find(s)
        if idx < 0:
            return None
        allr = self.aligned(ctx)
        k = len(hz_list(ctx[:idx]))
        n = len(hz_list(s))
        r = allr[k:k + n]
        return r if len(r) == n else None

    def hetero(self, ch: str) -> list[str]:
        if ch not in self._cache_het:
            self._cache_het[ch] = self._pinyin(ch, style=self._Style.TONE, heteronym=True)[0]
        return self._cache_het[ch]

    def norm(self, s: str) -> str:
        return self._to_normal(s, v_to_u=True)

    def py_str(self, s: str) -> str:
        return " ".join(d for d, _ in self.aligned(s))

    # ---- 核对
    def check(self, V: Item, field: str, target: str, sylls: list[str], contexts=(), note="", standalone=True):
        if not self.ok or sylls is None or not isinstance(target, str):
            return
        chars = hz_list(target)
        if len(chars) != len(sylls):
            return  # 条数不符已经报了错
        refs = []
        for c in contexts:
            r = self.aligned_in_context(target, c)
            if r:
                refs.append(("语境", r))
        if standalone or not refs:
            refs.insert(0, ("单独", self.aligned(target)))
        issues = []
        worst = None
        for j, (ch, h) in enumerate(zip(chars, sylls)):
            defaults = [r[j][0] for _, r in refs]
            sandhis = [r[j][1] for _, r in refs]
            if h in defaults:
                continue
            cands = self.hetero(ch)
            no_reading = all(d == ch for d in defaults)
            if no_reading:
                sev = "REVIEW"
                detail = f"第{j + 1}字「{ch}」pypinyin 无此字读音，手写 {h}"
            elif ch in "一不":
                if h in sandhis:
                    continue
                rule, why = self.yibu_rule(chars, sylls, j)
                sev = "YIBU_RULE" if rule == h else "YIBU"
                detail = (f"第{j + 1}字「{ch}」手写 {h}，pypinyin {'/'.join(dict.fromkeys(defaults + sandhis))}；"
                          f"课本变调规则（{why}）→ {rule or '无法判断'}")
            elif self.is_toneless(h) and any(self.norm(c) == h for c in list(cands) + defaults):
                sev = "NEUTRAL_COMMON" if (ch in NEUTRAL_CHARS or (j > 0 and chars[j - 1] == ch)) else "NEUTRAL"
                detail = f"第{j + 1}字「{ch}」手写轻声 {h}，pypinyin {'/'.join(dict.fromkeys(defaults))}"
            elif h in cands:
                # pypinyin 在这里给的不是该字的默认读音 = 它按词组词典有意选了语境读音（如 银行 háng），
                # 手写却是另一个读音 → 典型多音字误标，列入待核对；否则只是 pypinyin 取了默认音，降级为提示
                ctx_pick = [d for d in defaults if d != cands[0]]
                if ctx_pick:
                    sev = "POLY"
                    detail = f"第{j + 1}字「{ch}」手写 {h}，pypinyin 按词组读 {'/'.join(dict.fromkeys(ctx_pick))}（不是该字默认音 {cands[0]}），候选 [{' '.join(cands)}]"
                else:
                    sev = "HINT"
                    detail = f"第{j + 1}字「{ch}」手写 {h}，pypinyin 只给了该字默认音 {cands[0]}；手写在候选 [{' '.join(cands)}] 里"
            else:
                sev = "REVIEW"
                detail = f"第{j + 1}字「{ch}」手写 {h}，pypinyin {'/'.join(dict.fromkeys(defaults))}，候选 [{' '.join(cands)}] 里都没有"
            issues.append(detail)
            if worst is None or SEV_ORDER[sev] > SEV_ORDER[worst]:
                worst = sev
        if issues:
            self.rep.py_entries.append({
                "sev": worst, "loc": V.loc, "field": field, "text": target,
                "hand": " ".join(sylls), "pp": " ".join(d for d, _ in refs[0][1]) + ("" if refs[0][0] == "单独" else "（语境）"),
                "ctx_pp": [" ".join(d for d, _ in r) for n, r in refs[1:]],
                "issues": issues, "note": note})

    def add_review(self, V: Item, field: str, text: str, hand: str, msg: str, pp: str = "", note: str = ""):
        self.rep.py_entries.append({"sev": "REVIEW", "loc": V.loc, "field": field, "text": text,
                                    "hand": hand, "pp": pp or (self.py_str(text) if self.ok else ""),
                                    "ctx_pp": [], "issues": [msg], "note": note})


# ---------------------------------------------------------------- 通用检查
def check_text(V: Item, field: str, text, tts=False):
    if not isinstance(text, str) or not text:
        return
    if tts:
        bad = sorted(set(ALNUM_RE.findall(text)))
        if bad:
            V.err("E-TTS-ALNUM", f"{field} 会被朗读，不能含数字/英文字母 {bad}：「{short(text, 30)}」（数字写汉字，MRT 写地铁）")
    hits = []
    for k, ch in enumerate(text):
        if ch in HALF_PUNCT:
            prev = text[k - 1] if k > 0 else ""
            nxt = text[k + 1] if k + 1 < len(text) else ""
            if HANZI_RE.match(prev or " ") or HANZI_RE.match(nxt or " ") or prev in "，。！？：；“”" or nxt in "，。！？：；“”":
                hits.append(ch)
    if hits:
        V.warn("W-PUNCT-HALF", f"{field} 中文句子里有半角标点 {sorted(set(hits))}：「{short(text, 30)}」")
    if "..." in text or re.search(r"(?<!…)…(?!…)", text):
        V.warn("W-PUNCT-ELLIPSIS", f"{field} 省略号应写成“……”：「{short(text, 30)}」")
    if text.count("“") != text.count("”"):
        V.warn("W-PUNCT-QUOTE", f"{field} 双引号“”不成对：「{short(text, 30)}」")
    if text.count("《") != text.count("》"):
        V.warn("W-PUNCT-BOOK", f"{field} 书名号不成对")
    if re.search(f"[{HZ}，。！？：；、“”] +[{HZ}，。！？：；、“”]", text):
        V.warn("W-SPACE-IN-TEXT", f"{field} 中文之间有空格：「{short(text, 30)}」")


def check_choices(V: Item, obj: dict, pfx="", cf="c", af="a", tts=False, text_check=True):
    c = obj.get(cf)
    a = obj.get(af)
    if cf not in obj:
        V.err("E-MISSING", f"缺少字段 {pfx}{cf}")
        return None
    if not isinstance(c, list) or not all(isinstance(x, str) and x.strip() for x in c):
        V.err("E-TYPE", f"{pfx}{cf} 应为非空字符串数组")
        return None
    n = len(c)
    if n < 2:
        V.err("E-CHOICE-COUNT", f"{pfx}{cf} 只有 {n} 个选项")
    elif not 3 <= n <= 4:
        V.warn("W-CHOICE-COUNT", f"{pfx}{cf} 有 {n} 个选项（SPEC 要求 3–4 个）")
    stripped = [x.strip() for x in c]
    if len(set(stripped)) != n:
        dup = sorted({x for x in stripped if stripped.count(x) > 1})
        V.err("E-CHOICE-DUP", f"{pfx}{cf} 选项重复 {dup}")
    if af not in obj:
        V.err("E-MISSING", f"缺少字段 {pfx}{af}")
        return None
    if type(a) is not int:
        V.err("E-ANSWER-TYPE", f"{pfx}{af} 应为整数下标，实际 {a!r}")
        return None
    if not 0 <= a < n:
        V.err("E-ANSWER-RANGE", f"{pfx}{af}={a} 越界（共 {n} 个选项）")
        return None
    if text_check:
        for x in c:
            check_text(V, f"{pfx}{cf}", x, tts=tts)
    return c, a


def check_e(V: Item, obj: dict, pfx=""):
    if "e" not in obj:
        V.warn("W-E-MISSING", f"缺少讲解 {pfx}e")
        return
    e = V.s("e", obj=obj, pfx=pfx)
    if e:
        check_text(V, f"{pfx}e", e)
        if zlen(e) > 40:
            V.warn("W-E-LONG", f"{pfx}e 讲解 {zlen(e)} 字（SPEC ≤40）")


def check_len(V: Item, field: str, text, rng, unit="字"):
    if not isinstance(text, str):
        return
    lo, hi = rng
    n = zlen(text)
    if not lo <= n <= hi:
        V.warn("W-LEN", f"{field} {n}{unit}，本年级建议 {lo}–{hi}{unit}（按非空白字符计，含标点）")


# ---------------------------------------------------------------- 各栏目校验
def v_words(V: Item, it, pyc: PinyinChecker):
    w, py, s = V.s("w"), V.s("py"), V.s("s")
    m = V.s("m", required=False)
    if w:
        non = [ch for ch in w if not HANZI_RE.match(ch)]
        if non:
            V.err("E-WORD-NONHANZI", f"w 只能是汉字，含 {non}")
        if not 2 <= len(w) <= 4:
            V.warn("W-WORD-LEN", f"w 为 {len(w)} 字（SPEC 2–4 字）")
        check_text(V, "w", w, tts=True)
    if s:
        check_text(V, "s", s, tts=True)
        if w and w not in s:
            V.err("E-WORD-NOT-IN-S", f"例句 s 不包含 w「{w}」：「{s}」")
        mx = WORD_S_MAX[V.gn]
        if zlen(s) > mx:
            V.warn("W-LEN", f"例句 s {zlen(s)} 字，本年级 ≤{mx}")
    if m:
        check_text(V, "m", m)
    sylls = pyc.split_check(V, "py", py) if py else None
    if w and sylls is not None:
        if len(sylls) != len(hz_list(w)):
            V.err("E-PY-COUNT", f"py「{py}」{len(sylls)} 个音节，w「{w}」{len(hz_list(w))} 个汉字")
        else:
            pyc.check(V, "py", w, sylls, contexts=[s] if s else [])


def v_chars(V: Item, it, pyc):
    c, py, bs, jg = V.s("c"), V.s("py"), V.s("bs"), V.s("jg")
    words = V.strlist("words")
    if c and (len(c) != 1 or not HANZI_RE.match(c)):
        V.err("E-CHAR-SINGLE", f"c 必须是单个汉字，实际「{c}」")
        c = None
    if bs and len(bs) != 1:
        V.warn("W-CHAR-BS", f"部首 bs「{bs}」不是单字")
    if jg and jg not in JG:
        V.err("E-CHAR-JG", f"jg「{jg}」不在 {sorted(JG)}")
    if c and words:
        miss = [w for w in words if c not in w]
        if miss:
            V.err("E-CHAR-WORDS", f"words 里这些词不含「{c}」：{miss}")
        for w in words:
            check_text(V, "words", w)
    sylls = pyc.split_check(V, "py", py) if py else None
    if c and sylls is not None:
        if len(sylls) != 1:
            V.err("E-PY-COUNT", f"py「{py}」应为 1 个音节")
        else:
            pyc.check(V, "py", c, sylls, contexts=words or [])


def v_quiz(V: Item, it, pyc):
    t, q = V.s("t"), V.s("q")
    if t and t not in QUIZ_T:
        V.err("E-QUIZ-T", f"t「{t}」不在允许的题型里")
    if q:
        check_text(V, "q", q)
        blanks = re.findall(r"[（(][ \u3000\u00a0_]*[）)]", q)
        wrong = [b for b in blanks if b != BLANK]
        if wrong:
            V.warn("W-QUIZ-BLANK", f"空位应写成全角括号+一个全角空格“（　）”，发现 {wrong}：「{short(q, 30)}」")
    ca = check_choices(V, it)
    check_e(V, it)
    if ca and q and t in ("拼音", "多音字", "声调") and pyc.ok:
        quiz_pinyin(V, it, q, t, ca[0], ca[1], pyc)


def quiz_pinyin(V: Item, it, q, t, c, a, pyc: PinyinChecker):
    """拼音类选择题：答案与 pypinyin 比对，并检查有没有干扰项恰好等于 pypinyin 读音。"""
    if not all(PINYIN_LIKE_RE.fullmatch(unicodedata.normalize("NFC", o)) for o in c):
        return
    sylls = pyc.split_check(V, f"c[{a}]", unicodedata.normalize("NFC", c[a]))
    if sylls is None:
        return
    quotes = re.findall(r"“([^”]+)”", q)
    targets = [x for x in quotes if HANZI_ONLY_RE.fullmatch(x) and len(x) == len(sylls)]
    if not targets:
        return
    X = targets[0]
    wider = [y for y in quotes if y != X and X in y]
    ctx_word = wider[-1] if wider else None  # “处”在“处理”中读 chǔ，在“到处”中读？→ 问的是最后一个
    note = f"题干：{short(q, 40)}" + (f"；按语境词「{ctx_word}」比对" if ctx_word else "")
    if ctx_word:
        pyc.check(V, f"c[{a}]（正确选项）", X, sylls, contexts=[ctx_word], standalone=False, note=note)
    else:
        pyc.check(V, f"c[{a}]（正确选项）", X, sylls, contexts=[q], note=note)
    ref = None
    if ctx_word:
        ref = pyc.aligned_in_context(X, ctx_word)
    elif t == "拼音":
        ref = pyc.aligned(X)
    if ref:
        ref_s = " ".join(d for d, _ in ref)
        for k, o in enumerate(c):
            if k != a and unicodedata.normalize("NFC", o).strip() == ref_s:
                pyc.add_review(V, f"c[{k}]（干扰项）", X, o,
                               f"干扰项「{o}」正好等于 pypinyin 读音 {ref_s}，而答案是 c[{a}]「{c[a]}」→ 可能答案错位或有两个对的",
                               pp=ref_s + ("（语境）" if ctx_word else ""), note=note)


def v_pick(V: Item, it, pyc):
    say, ctx, py = V.s("say"), V.s("ctx"), V.s("py")
    if say:
        check_text(V, "say", say, tts=True)
    if ctx:
        check_text(V, "ctx", ctx, tts=True)
    if say and ctx and say not in ctx:
        V.err("E-PICK-CTX", f"ctx 不包含 say「{say}」：「{ctx}」")
    ca = check_choices(V, it)
    if ca and say:
        c, a = ca
        if c[a] != say:
            V.err("E-PICK-ANSWER", f"正确选项 c[{a}]「{c[a]}」≠ say「{say}」")
    sylls = pyc.split_check(V, "py", py) if py else None
    if say and sylls is not None:
        if len(sylls) != len(hz_list(say)):
            V.err("E-PY-COUNT", f"py「{py}」{len(sylls)} 个音节，say「{say}」{len(hz_list(say))} 个汉字")
        else:
            pyc.check(V, "py", say, sylls, contexts=[ctx] if ctx else [])


def v_qs_block(V: Item, it, kind: str, tts: bool):
    qs = it.get("qs")
    if "qs" not in it:
        V.err("E-MISSING", "缺少字段 qs")
        return []
    if not isinstance(qs, list) or not qs:
        V.err("E-TYPE", "qs 应为非空数组")
        return []
    for j, qd in enumerate(qs):
        pfx = f"qs[{j}]."
        if not isinstance(qd, dict):
            V.err("E-ITEM-TYPE", f"{pfx} 应为对象")
            continue
        V.unknown_fields(QS_FIELDS[kind], obj=qd, pfx=pfx)
        q = V.s("q", obj=qd, pfx=pfx)
        if q:
            check_text(V, pfx + "q", q, tts=tts)
        if kind == "passages" or "k" in qd:  # stories 的 k 可选（标注推断题用）
            k = V.s("k", obj=qd, pfx=pfx)
            if k and k not in PASSAGE_K:
                V.err("E-PASSAGE-K", f"{pfx}k「{k}」不在 {sorted(PASSAGE_K)}")
        check_choices(V, qd, pfx=pfx, tts=tts)
        check_e(V, qd, pfx=pfx)
    return qs


def v_stories(V: Item, it, pyc):
    title, text = V.s("title"), V.s("text")
    if title:
        check_text(V, "title", title, tts=True)
    if text:
        check_text(V, "text", text, tts=True)
        check_len(V, "text", text, LISTEN_LEN[V.gn])
    qs = v_qs_block(V, it, "stories", tts=True)
    want = 3 if V.gn <= 4 else 4
    if qs and len(qs) != want:
        V.warn("W-QS-COUNT", f"{len(qs)} 道题（本年级每篇 {want} 题）")
    if qs and V.gn >= 5 and any(isinstance(q, dict) and "k" in q for q in qs) \
            and not any(isinstance(q, dict) and q.get("k") == "推断" for q in qs):
        V.warn("W-STORY-INFER", "P5–P6 每篇应含 1 道推断题（已标 k 但没有 推断）")


def v_readaloud(V: Item, it, pyc):
    title, text, tip = V.s("title"), V.s("text"), V.s("tip")
    if title:
        check_text(V, "title", title, tts=True)
    if text:
        check_text(V, "text", text, tts=True)
        check_len(V, "text", text, READALOUD_LEN[V.gn])
    hard = it.get("hard")
    if "hard" not in it:
        V.err("E-MISSING", "缺少字段 hard")
        return
    if not isinstance(hard, list):
        V.err("E-TYPE", "hard 应为数组")
        return
    if not 2 <= len(hard) <= 4:
        V.warn("W-HARD-COUNT", f"hard {len(hard)} 个（SPEC 2–4 个）")
    for j, hd in enumerate(hard):
        pfx = f"hard[{j}]."
        if not isinstance(hd, dict):
            V.err("E-ITEM-TYPE", f"{pfx} 应为对象")
            continue
        V.unknown_fields({"w", "py"}, obj=hd, pfx=pfx)
        w, py = V.s("w", obj=hd, pfx=pfx), V.s("py", obj=hd, pfx=pfx)
        if w and text and w not in text:
            V.err("E-HARD-NOT-IN-TEXT", f"{pfx}w「{w}」不在朗读正文里")
        sylls = pyc.split_check(V, pfx + "py", py) if py else None
        if w and sylls is not None:
            if len(sylls) != len(hz_list(w)):
                V.err("E-PY-COUNT", f"{pfx}py「{py}」{len(sylls)} 个音节，w「{w}」{len(hz_list(w))} 个汉字")
            else:
                pyc.check(V, pfx + "py", w, sylls, contexts=[text] if text else [])


def v_twisters(V: Item, it, pyc):
    text, py, tip = V.s("text"), V.s("py"), V.s("tip")
    if text:
        check_text(V, "text", text, tts=True)
        if V.gn == 2 and len(hz_list(text)) > 25:
            V.warn("W-LEN", f"P2 绕口令 {len(hz_list(text))} 字（≤25）")
    sylls = pyc.split_check(V, "py", py) if py else None
    if text and sylls is not None:
        n = len(hz_list(text))
        if len(sylls) != n:
            V.err("E-PY-COUNT", f"py {len(sylls)} 个音节，text {n} 个汉字")
        else:
            pyc.check(V, "py", text, sylls)


def v_talk(V: Item, it, pyc):
    for f in ("topic", "scene", "desc", "q"):
        v = V.s(f)
        if v and f in ("desc", "q"):
            check_text(V, f, v)
    for f in ("follow", "starters", "words"):
        lst = V.strlist(f)
        for x in lst or []:
            check_text(V, f, x)
    sample = V.s("sample")
    if sample:
        check_text(V, "sample", sample, tts=True)
        check_len(V, "sample", sample, TALK_LEN[V.gn])


def v_order(V: Item, it, pyc):
    tiles = V.strlist("tiles", min_n=2)
    ans = V.s("ans")
    mode = it.get("mode")
    if mode is not None and mode != "para":
        V.err("E-ORDER-MODE", f"mode 只能是 \"para\" 或不写，实际 {mode!r}")
    para = mode == "para"
    if ans:
        check_text(V, "ans", ans)
    if tiles:
        if len(set(tiles)) != len(tiles):
            V.warn("W-ORDER-DUP-TILE", "tiles 有完全相同的块，判分时注意")
        n = len(tiles)
        if para:
            if not 4 <= n <= 6:
                V.warn("W-ORDER-TILES", f"段落模式 {n} 块（SPEC 4–6 句）")
            nopunct = [t for t in tiles if t[-1:] not in "。！？…”：；"]
            if nopunct:
                V.warn("W-ORDER-PARA-PUNCT", f"段落模式每块应是带句末标点的完整句子：{[short(t, 10) for t in nopunct]}")
        elif not 4 <= n <= 7:
            V.warn("W-ORDER-TILES", f"{n} 块（SPEC 4–7 块）")
    if tiles and ans:
        join = "".join(tiles)
        if para:
            if ans != join:
                V.err("E-ORDER-ANS", f"段落模式 ans 必须等于 tiles 拼接：\n      拼接=「{join}」\n      ans =「{ans}」")
        else:
            extra = ans[len(join):] if ans.startswith(join) else None
            if extra is None or len(extra) > 1 or (extra and extra not in END_PUNCT):
                V.err("E-ORDER-ANS", f"ans 必须 = tiles 拼接 + 至多 1 个句末标点：\n      拼接=「{join}」\n      ans =「{ans}」")
    alts = it.get("alts")
    if alts is not None:
        if not isinstance(alts, list):
            V.err("E-ORDER-ALTS", "alts 应为数组")
        elif tiles:
            n = len(tiles)
            for p in alts:
                if not (isinstance(p, list) and all(type(x) is int for x in p) and sorted(p) == list(range(n))):
                    V.err("E-ORDER-ALTS", f"alts 项 {p} 不是 0..{n - 1} 的排列")
                elif p == list(range(n)):
                    V.warn("W-ORDER-ALTS", f"alts 项 {p} 就是正确顺序本身")


def v_passages(V: Item, it, pyc):
    title, text = V.s("title"), V.s("text")
    if title:
        check_text(V, "title", title)
    if text:
        check_text(V, "text", text)
        check_len(V, "text", text, LISTEN_LEN[V.gn])
    qs = v_qs_block(V, it, "passages", tts=False)
    if qs:
        if not 4 <= len(qs) <= 5:
            V.warn("W-QS-COUNT", f"{len(qs)} 道题（SPEC 每篇 4–5 题）")
        if V.gn >= 5:
            ks = {q.get("k") for q in qs if isinstance(q, dict)}
            lack = [k for k in ("推断", "主旨") if k not in ks]
            if lack:
                V.warn("W-PASSAGE-K", f"P5–P6 必含推断和主旨题，缺 {lack}")


def v_build(V: Item, it, pyc):
    base, rad, ans, py, hint = V.s("base"), V.s("rad"), V.s("ans"), V.s("py"), V.s("hint")
    opts = V.strlist("opts")
    if ans and (len(ans) != 1 or not HANZI_RE.match(ans)):
        V.err("E-BUILD-ANS", f"ans 必须是单个汉字，实际「{ans}」")
        ans = None
    if hint:
        check_text(V, "hint", hint)
    if ans and hint and ans not in hint:
        V.err("E-BUILD-HINT", f"hint「{hint}」不含 ans「{ans}」")
    if opts:
        if len(set(opts)) != len(opts):
            V.err("E-CHOICE-DUP", f"opts 重复 {opts}")
        if not 3 <= len(opts) <= 4:
            V.warn("W-CHOICE-COUNT", f"opts {len(opts)} 个（SPEC 3–4 个）")
        if rad and rad not in opts:
            V.err("E-BUILD-RAD", f"opts {opts} 不含 rad「{rad}」")
    sylls = pyc.split_check(V, "py", py) if py else None
    if ans and sylls is not None:
        if len(sylls) != 1:
            V.err("E-PY-COUNT", f"py「{py}」应为 1 个音节")
        else:
            pyc.check(V, "py", ans, sylls, contexts=[hint] if hint else [])


def v_typo(V: Item, it, pyc):
    s, bad, good = V.s("s"), V.s("bad"), V.s("good")
    i = it.get("i")
    opts = V.strlist("opts")
    if "i" not in it:
        V.err("E-MISSING", "缺少字段 i")
    elif type(i) is not int:
        V.err("E-TYPE", f"i 应为整数，实际 {i!r}")
        i = None
    if s:
        check_text(V, "s", s)
    for f, v in (("bad", bad), ("good", good)):
        if v and len(v) != 1:
            V.warn("W-TYPO-LEN", f"{f}「{v}」不是单字（引擎按单字高亮）")
    if s and bad and type(i) is int:
        if not 0 <= i < len(s) or s[i:i + len(bad)] != bad:
            where = [m.start() for m in re.finditer(re.escape(bad), s)]
            got = s[i] if 0 <= i < len(s) else "越界"
            V.err("E-TYPO-INDEX", f"s[{i}]=「{got}」≠ bad「{bad}」；bad 在 s 中的下标是 {where}")
        elif s.count(bad) > 1:
            V.warn("W-TYPO-MULTI", f"bad「{bad}」在句中出现 {s.count(bad)} 次，确认 i 指对了")
    if bad and good and bad == good:
        V.err("E-TYPO-SAME", "bad 与 good 相同")
    if opts:
        if len(set(opts)) != len(opts):
            V.err("E-CHOICE-DUP", f"opts 重复 {opts}")
        if not 3 <= len(opts) <= 4:
            V.warn("W-CHOICE-COUNT", f"opts {len(opts)} 个（SPEC 3–4 个）")
        if good and good not in opts:
            V.err("E-TYPO-GOOD", f"opts {opts} 不含 good「{good}」")
    check_e(V, it)


def v_compose(V: Item, it, pyc):
    kind, prompt = V.s("kind"), V.s("prompt")
    pattern = V.s("pattern", nonempty=False)
    scene, desc = V.s("scene", nonempty=False), V.s("desc", nonempty=False)
    if kind and kind not in COMPOSE_KIND:
        V.err("E-COMPOSE-KIND", f"kind「{kind}」不在 {sorted(COMPOSE_KIND)}")
    if kind == "看图写话" and (not (scene or "").strip() or not (desc or "").strip()):
        V.err("E-COMPOSE-SCENE", "看图写话必须填 scene（emoji 图）和 desc（画面描述）")
    if prompt:
        check_text(V, "prompt", prompt)
    if desc:
        check_text(V, "desc", desc)
    mn = it.get("min")
    if "min" not in it:
        V.err("E-MISSING", "缺少字段 min")
    elif type(mn) is not int or mn <= 0:
        V.err("E-TYPE", f"min 应为正整数，实际 {mn!r}")
        mn = None
    else:
        lo, hi = COMPOSE_MIN[V.gn]
        if not lo <= mn <= hi:
            V.warn("W-COMPOSE-MIN", f"min={mn}，本年级建议 {lo}–{hi}")
    eg = V.strlist("eg")
    V.strlist("check")
    frags = [f for f in re.split(r"[…\s、，,；;／/]+|\.{3,}", pattern or "") if f.strip()]
    ordered = "…" in (pattern or "") or "..." in (pattern or "")
    for x in eg or []:
        check_text(V, "eg", x)
        if type(mn) is int and len(hz_list(x)) < mn:
            V.warn("W-COMPOSE-EG-SHORT", f"范例只有 {len(hz_list(x))} 个汉字，低于 min={mn}：「{short(x, 20)}」")
        pos = 0
        for f in frags:
            k = x.find(f, pos if ordered else 0)
            if k < 0:
                V.warn("W-COMPOSE-PATTERN", f"范例没按 pattern「{pattern}」写（缺「{f}」{'或顺序不对' if ordered else ''}）：「{short(x, 20)}」")
                break
            if ordered:
                pos = k + len(f)


VALIDATORS = {"words": v_words, "chars": v_chars, "quiz": v_quiz, "pick": v_pick,
              "stories": v_stories, "readaloud": v_readaloud, "twisters": v_twisters,
              "talk": v_talk, "order": v_order, "passages": v_passages, "build": v_build,
              "typo": v_typo, "compose": v_compose}


def dup_key(col, it):
    g = it.get
    key = {"words": lambda: g("w"), "chars": lambda: g("c"),
           "quiz": lambda: (g("q"), json.dumps(g("c"), ensure_ascii=False)),
           "pick": lambda: (g("say"), g("ctx")), "stories": lambda: g("title"),
           "readaloud": lambda: g("title"), "twisters": lambda: g("text"), "talk": lambda: g("topic"),
           "order": lambda: g("ans"), "passages": lambda: g("title"),
           "build": lambda: (g("base"), g("ans")), "typo": lambda: g("s"),
           "compose": lambda: g("prompt")}.get(col)
    if not key:
        return None
    try:
        k = key()
        hash(k)
        return k
    except TypeError:
        return None


# ---------------------------------------------------------------- 合并
def resolve_inputs(root: Path, globs: list[str] | None, rep: Report) -> list[Path]:
    if not globs:
        files = sorted(Path(p) for p in glob.glob(str(root / "content" / "*.json")))
        skipped = [f for f in files if f.name == "_sample.json"]
        files = [f for f in files if f.name != "_sample.json" and "_parts" not in f.parts]
        rep.info.append(f"默认输入 content/*.json；跳过 {[f.name for f in skipped]} 与 content/_parts/")
        return files
    out = []
    for gpat in globs:
        p = gpat if Path(gpat).is_absolute() else str(root / gpat)
        hits = sorted(Path(x) for x in glob.glob(p, recursive=True))
        if not hits:
            rep.err("E-INPUT", "输入", f"--content-glob {gpat} 没匹配到任何文件")
        out.extend(h for h in hits if h not in out)
    return out


def load_and_merge(files: list[Path], rep: Report):
    data = {g: {} for g in GRADES}
    origin = {g: {} for g in GRADES}
    for f in files:
        raw = f.read_bytes()
        try:
            txt = raw.decode("utf-8")
        except UnicodeDecodeError as e:
            rep.err("E-JSON", f.name, f"不是合法 UTF-8：{e}")
            continue
        if txt.startswith("\ufeff"):
            rep.warn("W-BOM", f.name, "文件带 BOM，已忽略")
            txt = txt[1:]
        try:
            obj = json.loads(txt)
        except json.JSONDecodeError as e:
            line = txt.splitlines()[e.lineno - 1] if 0 < e.lineno <= len(txt.splitlines()) else ""
            rep.err("E-JSON", f.name, f"JSON 解析失败：第 {e.lineno} 行第 {e.colno} 列 {e.msg}；该行：{short(line.strip(), 60)}")
            continue
        if not isinstance(obj, dict):
            rep.err("E-JSON", f.name, "顶层必须是 {\"p2\": {...}, ...} 对象")
            continue
        for g, cols in obj.items():
            if g not in GRADES:
                rep.err("E-GRADE", f.name, f"未知年级 key「{g}」（只能是 {GRADES}），整组忽略")
                continue
            if not isinstance(cols, dict):
                rep.err("E-GRADE", f"{f.name}:{g}", "年级下必须是 {栏目: [...]} 对象")
                continue
            for col, items in cols.items():
                if col not in COLUMNS:
                    rep.warn("W-COL-UNKNOWN", f"{f.name}:{g}", f"未定义的栏目「{col}」（仍然并入 HW_DATA）")
                if not isinstance(items, list):
                    rep.err("E-COL-TYPE", f"{f.name}:{g}.{col}", "栏目必须是数组，整栏忽略")
                    continue
                data[g].setdefault(col, []).extend(items)
                origin[g].setdefault(col, []).extend([f.name] * len(items))
    # 规范列顺序 + 补空数组
    merged = {}
    for g in GRADES:
        merged[g] = {c: data[g].get(c, []) for c in COLUMNS}
        for c in data[g]:
            if c not in merged[g]:
                merged[g][c] = data[g][c]
        for c in merged[g]:
            origin[g].setdefault(c, [])
    return merged, origin


def validate(data, origin, rep: Report, pyc: PinyinChecker):
    for g in GRADES:
        for col, items in data[g].items():
            fn = VALIDATORS.get(col)
            seen = {}
            for i, it in enumerate(items):
                V = Item(rep, g, col, i, it, origin[g][col][i])
                if not isinstance(it, dict):
                    V.err("E-ITEM-TYPE", f"题目必须是对象，实际 {type(it).__name__}")
                    continue
                if fn is None:
                    continue
                V.unknown_fields(FIELDS[col])
                try:
                    fn(V, it, pyc)
                except Exception as e:  # noqa: BLE001  校验器自身异常不应让构建崩
                    V.err("E-VALIDATOR", f"校验器异常 {type(e).__name__}: {e}")
                k = dup_key(col, it)
                if k is not None and k != (None, None):
                    if k in seen:
                        V.warn("W-DUP", f"与 {g}.{col}[{seen[k]}] 重复")
                    else:
                        seen[k] = i
        # 年级级别
        gn = int(g[1])
        quiz = [q for q in data[g]["quiz"] if isinstance(q, dict)]
        region = sum(1 for q in quiz if q.get("t") == "地区词")
        if region > 3 or (len(quiz) >= TARGET["quiz"] and region < 2):
            rep.warn("W-QUIZ-REGION", f"{g}.quiz", f"地区词 {region} 题（SPEC 每年级 2–3 题）")
        if gn >= 5:
            orders = [o for o in data[g]["order"] if isinstance(o, dict)]
            para = sum(1 for o in orders if o.get("mode") == "para")
            if orders and para * 2 < len(orders):
                rep.warn("W-ORDER-PARA-RATIO", f"{g}.order", f"段落模式 {para}/{len(orders)}（P5–P6 至少一半）")
        comp = [c for c in data[g]["compose"] if isinstance(c, dict)]
        if comp:
            zj = sum(1 for c in comp if c.get("kind") == "造句")
            if gn <= 3 and zj * 2 < len(comp):
                rep.warn("W-COMPOSE-MIX", f"{g}.compose", f"造句 {zj}/{len(comp)}（P2–P3 以造句为主）")
            if gn >= 5 and zj * 2 > len(comp):
                rep.warn("W-COMPOSE-MIX", f"{g}.compose", f"造句 {zj}/{len(comp)}（P5–P6 以写话/续写为主）")


# ---------------------------------------------------------------- 笔顺
def collect_strokes(data, vendor: Path, rep: Report):
    need: dict[str, list[str]] = {}
    for g in GRADES:
        for w in data[g]["words"]:
            if isinstance(w, dict) and isinstance(w.get("w"), str):
                for ch in hz_list(w["w"]):
                    need.setdefault(ch, []).append(f"{g}.words「{w['w']}」")
        for c in data[g]["chars"]:
            if isinstance(c, dict) and isinstance(c.get("c"), str):
                for ch in hz_list(c["c"]):
                    need.setdefault(ch, []).append(f"{g}.chars「{ch}」")
    strokes = {}
    for ch, where in need.items():
        p = vendor / f"{ch}.json"
        if not p.is_file():
            rep.missing_strokes[ch] = where
            continue
        try:
            d = json.loads(p.read_text("utf-8"))
        except Exception as e:  # noqa: BLE001
            rep.missing_strokes[ch] = where + [f"（数据文件损坏：{e}）"]
            continue
        keep = {k: d[k] for k in ("strokes", "medians", "radStrokes") if k in d}
        if "strokes" not in keep or "medians" not in keep:
            rep.missing_strokes[ch] = where + ["（数据缺 strokes/medians）"]
            continue
        strokes[ch] = keep
    return strokes, len(need)


# ---------------------------------------------------------------- 拼装

# ---------------- TTS：结构助词“地”朗读修正 ----------------
# 实测 macOS/iOS 婷婷语音把状语后的“地”一律读成 dì。build 时对题库里每个“地”按上下文分类，
# 输出 window.HW_TTS_DE（读 de 的三字窗口“前字+地+后字”），核心 TTS 朗读前把这些“地”换成“的”，屏幕显示不变。
DI_NEXT = set("球面上下铁方址点图板区震位毯里底道势形带盘平狱主理质基域段标名窖壳层表貌产铺")
DI_PREV = set("草扫各境处特土田陆场工本外当园空遍实旱耕墓营领洼席盆湿绿荒坡基林的满大天平此该原落两内盆")
TTS_DE_MANUAL = {  # 规则判不准的，人工裁决：三字窗口 -> "de" / "di"
    "看地球": "di",   # 去看看地球（AA 规则误判）
    "说地铁": "di",   # 说说地铁站
    "把地扫": "di",   # 把地扫得干干净净
    "静地带": "de",   # 冷静地带着（“地带”误判）
}

def _hz(c):
    return bool(c) and "一" <= c <= "鿿"

def classify_de(t: str, j: int) -> str:
    prev = t[j - 1] if j >= 1 else ""
    prev2 = t[j - 2] if j >= 2 else ""
    nxt = t[j + 1] if j + 1 < len(t) else ""
    key = prev + "地" + nxt
    if key in TTS_DE_MANUAL:
        return TTS_DE_MANUAL[key]
    if _hz(prev) and prev == prev2:          # AA地：慢慢地、轻轻地
        return "de"
    if not _hz(prev):                         # 句首/标点后：地铁、地上七颗星
        return "di"
    if prev in DI_PREV:
        return "di"
    if nxt in DI_NEXT:
        return "di"
    return "de"

def tts_de_table(data):
    seen = {}
    def walk(x):
        if isinstance(x, str):
            for m in re.finditer("地", x):
                j = m.start()
                key = (x[j - 1] if j else "") + "地" + (x[j + 1] if j + 1 < len(x) else "")
                ctx = x[max(0, j - 5):j + 4]
                seen.setdefault(key, (classify_de(x, j), ctx))
        elif isinstance(x, dict):
            for v in x.values():
                walk(v)
        elif isinstance(x, list):
            for v in x:
                walk(v)
    walk(data)
    return seen

def js_embed(obj) -> str:
    """JSON 嵌进 <script>：'<' 一律写成 \\u003c（覆盖 </script、<!-- 两种情况），U+2028/2029 转义。
    结果既是合法 JSON 也是合法 JS 字面量。"""
    s = json.dumps(obj, ensure_ascii=False, separators=(",", ":"))
    return s.replace("<", "\\u003c").replace("\u2028", "\\u2028").replace("\u2029", "\\u2029")


def read_part(parts_dir: Path, name: str, rep: Report) -> str:
    p = parts_dir / name
    if not p.is_file():
        rep.warn("W-PART-MISSING", f"parts/{name}", "文件不存在，按空字符串拼装")
        return ""
    return p.read_text("utf-8")


def check_head(head: str, rep: Report):
    for tag in ("<!doctype", "<html", "<head", "<body", "</html", "</head", "</body"):
        if tag in head.lower():
            rep.warn("W-HEAD-TAG", "parts/00_head.html", f"含 {tag}…，SPEC 要求不写这些外壳标签")
    if head and "<title" not in head.lower():
        rep.warn("W-HEAD-TITLE", "parts/00_head.html", "没有 <title>")


def check_js_part(name: str, code: str, rep: Report) -> str:
    if re.search(r"</script", code, re.I):
        n = len(re.findall(r"</script", code, re.I))
        rep.warn("W-JS-SCRIPT-CLOSE", f"parts/{name}", f"含 {n} 处 </script，已自动改写为 <\\/script")
        code = re.sub(r"</(script)", r"<\\/\1", code, flags=re.I)
    if "<!--" in code:
        rep.warn("W-JS-HTML-COMMENT", f"parts/{name}", "含 <!--，放进 <script> 可能改变解析，请改写（如 '<'+'!--'）")
    if re.search(r"\bfetch\s*\(|XMLHttpRequest", code):
        rep.warn("W-JS-FETCH", f"parts/{name}", "出现 fetch/XMLHttpRequest：Artifact CSP 会静默拦截")
    if re.search(r"^\s*(import|export)\s", code, re.M):
        rep.warn("W-JS-MODULE", f"parts/{name}", "出现 import/export 语句：SPEC 要求普通脚本")
    for gid in GAME_IDS.get(name, []):
        if code and not re.search(r"\bid\s*:\s*['\"]" + gid + r"['\"]", code):
            rep.warn("W-GAME-MISSING", f"parts/{name}", f"没找到 id:'{gid}' 的 HW.register")
    if name == "10_core.js" and code and not re.search(r"\bboot\b", code):
        rep.warn("W-CORE-BOOT", "parts/10_core.js", "没找到 boot，末尾的 HW.boot() 会报错")
    return code


NODE_HELPER = r"""
const vm = require('vm');
let buf = '';
process.stdin.setEncoding('utf8');
process.stdin.on('data', d => buf += d);
process.stdin.on('end', () => {
  const p = JSON.parse(buf);
  const res = {syntax: [], data: null, dataError: null};
  for (const s of p.scripts) {
    try { new vm.Script(s.code, {filename: s.name}); res.syntax.push({name: s.name, ok: true}); }
    catch (e) {
      const st = String((e && e.stack) || '').split('\n').slice(0, 3).map(x => x.slice(0, 200)).join(' | ');
      res.syntax.push({name: s.name, ok: false, msg: `${e && e.name}: ${e && e.message} @ ${st}`});
    }
  }
  try {
    const ctx = {window: {}}; vm.createContext(ctx);
    for (const c of p.data) new vm.Script(c).runInContext(ctx);
    res.data = {HW_DATA: ctx.window.HW_DATA, HW_STROKES: ctx.window.HW_STROKES};
  } catch (e) { res.dataError = String((e && e.stack) || e).split('\n').slice(0, 3).join(' | '); }
  process.stdout.write(JSON.stringify(res));
});
"""


def node_checks(scripts: list[tuple[str, str]], data_scripts: list[str], data, strokes, rep: Report):
    node = shutil.which("node")
    if not node:
        rep.warn("W-NODE", "环境", "找不到 node：跳过 JS 语法检查与嵌入回读校验")
        return "跳过（无 node）"
    payload = json.dumps({"scripts": [{"name": n, "code": c} for n, c in scripts], "data": data_scripts},
                         ensure_ascii=False)
    try:
        r = subprocess.run([node, "-e", NODE_HELPER], input=payload.encode("utf-8"),
                           capture_output=True, timeout=180)
    except Exception as e:  # noqa: BLE001
        rep.warn("W-NODE", "环境", f"node 运行失败：{e}")
        return "失败"
    if r.returncode != 0:
        rep.warn("W-NODE", "环境", f"node 退出码 {r.returncode}：{r.stderr.decode('utf-8', 'replace')[:300]}")
        return "失败"
    res = json.loads(r.stdout.decode("utf-8"))
    bad = 0
    for s in res["syntax"]:
        if not s["ok"]:
            bad += 1
            rep.err("E-JS-SYNTAX", s["name"], s["msg"])
    if res["dataError"]:
        rep.err("E-EMBED", "HW_DATA/HW_STROKES", f"嵌入脚本执行失败：{res['dataError']}")
        return f"语法 {len(res['syntax']) - bad}/{len(res['syntax'])} 通过；嵌入回读失败"
    d = res["data"] or {}
    same_d = d.get("HW_DATA") == data
    same_s = d.get("HW_STROKES") == strokes
    if not same_d:
        rep.err("E-EMBED", "HW_DATA", "浏览器端读到的 HW_DATA 与源数据不一致（转义问题）")
    if not same_s:
        rep.err("E-EMBED", "HW_STROKES", "浏览器端读到的 HW_STROKES 与源数据不一致（转义问题）")
    return (f"语法 {len(res['syntax']) - bad}/{len(res['syntax'])} 通过；"
            f"嵌入回读 HW_DATA {'一致' if same_d else '不一致'}、HW_STROKES {'一致' if same_s else '不一致'}")


def check_urls(html: str, rep: Report):
    for m in re.finditer(r"<(script|link)\b[^>]*\b(src|href)\s*=\s*[\"']([^\"']+)[\"']", html, re.I):
        url = m.group(3)
        if not (url + "/").startswith(ALLOWED_URL_PREFIX) and not url.startswith(ALLOWED_URL_PREFIX):
            rep.warn("W-EXT-URL", f"<{m.group(1)}>", f"外部地址 {url} 不在 CSP 白名单（jsdelivr/npm、cdnjs、Google Fonts）")


# ---------------------------------------------------------------- 报告输出
def fmt_bytes(n: int) -> str:
    return f"{n:,} B ({n / 1024:.1f} KB)" if n < 1024 * 1024 else f"{n:,} B ({n / 1024 / 1024:.2f} MB)"


def stats_table(data) -> list[str]:
    cols = list(data[GRADES[0]].keys())
    w = max(len(c) for c in cols) + 2
    lines = ["栏目".ljust(w - 2) + "".join(g.rjust(10) for g in GRADES) + "    目标/年级",
             "-" * (w + 10 * len(GRADES) + 12)]
    for c in cols:
        row = c.ljust(w)
        for g in GRADES:
            n = len(data[g].get(c, []))
            t = TARGET.get(c)
            cell = f"{n}/{t}" + ("*" if t and n < t else " ") if t else f"{n} "
            row += cell.rjust(10)
        lines.append(row + f"    {TARGET.get(c, '-')}")
    lines.append("（* = 未达 SPEC 目标条数）")
    lines.append("")
    lines.append("quiz 题型分布：")
    for g in GRADES:
        cnt = {}
        for q in data[g]["quiz"]:
            if isinstance(q, dict):
                cnt[q.get("t")] = cnt.get(q.get("t"), 0) + 1
        lines.append(f"  {g}: " + ("、".join(f"{k}{v}" for k, v in sorted(cnt.items(), key=lambda x: -x[1])) or "（无）"))
    return lines


PY_SECTIONS = [
    ("REVIEW", "A. 读音不一致（手写读音不在 pypinyin 任何候选里，优先核对）"),
    ("POLY", "B. 多音字（pypinyin 按词组词典给了非默认读音，手写用了另一个读音 —— 常见多音字误标，优先核对）"),
    ("YIBU", "C. “一/不”变调 · 与课本变调规则也不符（手写与 pypinyin 普通/变调读音都不同，优先核对）"),
    ("NEUTRAL", "D. 轻声 · 需确认（手写不标调，pypinyin 标了调）"),
    ("YIBU_RULE", "E. “一/不”变调 · 与课本变调规则一致（多半是 pypinyin 没变调，扫一眼；注意“一年级”这类序数）"),
    ("NEUTRAL_COMMON", "F. 轻声 · 常见模式（叠字 / 子们的了着过吗呢吧么头巴，扫一眼即可）"),
]


def fmt_py_entry(e) -> list[str]:
    head = f"- {e['loc']} {e['field']}"
    lines = [head, f"    文本：{e['text']}", f"    手写：{e['hand']}", f"    pypinyin：{e['pp']}"]
    for c in e["ctx_pp"]:
        lines.append(f"    pypinyin（语境）：{c}")
    if e["note"]:
        lines.append(f"    {e['note']}")
    for i in e["issues"]:
        lines.append(f"    · {i}")
    return lines


def write_report(path: Path, rep: Report, meta: list[str], data, sizes, strokes_n, need_n, pyc):
    L = []
    L.append("华文小岛 build report")
    L.append("=" * 60)
    L += meta
    L.append("")
    L.append(f"== 错误（{len(rep.errors)}）==")
    L += rep.errors or ["（无）"]
    L.append("")
    L.append(f"== 警告（{len(rep.warnings)}）==")
    L += rep.warnings or ["（无）"]
    L.append("")
    review = [e for e in rep.py_entries if e["sev"] != "HINT"]
    hints = [e for e in rep.py_entries if e["sev"] == "HINT"]
    L.append(f"== 拼音待人工核对（{len(review)} 条）==")
    if not pyc.ok:
        L.append("（pypinyin 不可用，未做交叉核对）")
    L.append("说明：pypinyin 也会错，这里只列不改；每条先看“手写”与“文本”，再看 pypinyin 与候选。")
    for sev, title in PY_SECTIONS:
        ents = [e for e in review if e["sev"] == sev]
        L.append("")
        L.append(f"-- {title}：{len(ents)} 条")
        for e in ents:
            L += fmt_py_entry(e)
    L.append("")
    L.append(f"== 拼音提示（{len(hints)} 条，已降级：手写读音在该字的多音候选里，pypinyin 只是取了该字默认音）==")
    for e in hints:
        L += fmt_py_entry(e)
    if not hints:
        L.append("（无）")
    L.append("")
    L.append(f"== 笔顺缺字（{len(rep.missing_strokes)} / 需要 {need_n} 字，已内嵌 {strokes_n} 字）==")
    for ch, where in rep.missing_strokes.items():
        L.append(f"- {ch}：{'；'.join(where[:6])}{' …' if len(where) > 6 else ''}")
    if not rep.missing_strokes:
        L.append("（无）")
    L.append("")
    L.append("== 条数统计 ==")
    L += stats_table(data)
    L.append("")
    L.append("== 大小 ==")
    L += sizes
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text("\n".join(L) + "\n", "utf-8")


# ---------------------------------------------------------------- main
def main(argv=None) -> int:
    ap = argparse.ArgumentParser(description="华文小岛 构建 + 校验（SPEC §1 §5）",
                                 formatter_class=argparse.RawDescriptionHelpFormatter, epilog=__doc__)
    ap.add_argument("--root", default=str(DEFAULT_ROOT), help="项目根（默认 build/ 的上一级）")
    ap.add_argument("--content-glob", action="append", default=None,
                    help="题库文件 glob，可多次给；相对路径按 ROOT 解析。给了就不再自动跳过 _sample.json")
    ap.add_argument("--parts-dir", default=None, help="parts 目录（默认 ROOT/parts）")
    ap.add_argument("--vendor-dir", default=None, help="笔顺数据目录（默认 ROOT/vendor/package）")
    ap.add_argument("--out", default=None, help="输出 HTML（默认 ROOT/dist/index.html）")
    ap.add_argument("--report", default=None, help="报告路径（默认 ROOT/build/report.txt）")
    ap.add_argument("--pages-out", default=None, help="GitHub Pages 完整页面（默认 ROOT/docs/index.html）")
    ap.add_argument("--no-pages", action="store_true", help="不输出 Pages 版")
    ap.add_argument("--strict", action="store_true", help="有错误时不输出 dist")
    ap.add_argument("--no-node", action="store_true", help="跳过 node 语法检查与嵌入回读")
    args = ap.parse_args(argv)

    root = Path(args.root).resolve()
    if not root.is_dir():
        print(f"ROOT 不存在：{root}", file=sys.stderr)
        return 2

    def rp(p, default):
        if p is None:
            return default
        p = Path(p)
        return p if p.is_absolute() else root / p

    parts_dir = rp(args.parts_dir, root / "parts")
    vendor = rp(args.vendor_dir, root / "vendor" / "package")
    out = rp(args.out, root / "dist" / "index.html")
    report_path = rp(args.report, root / "build" / "report.txt")

    t0 = time.time()
    rep = Report()
    pyc = PinyinChecker(rep)
    files = resolve_inputs(root, args.content_glob, rep)
    if not files:
        rep.err("E-INPUT", "输入", "没有任何题库文件")
    data, origin = load_and_merge(files, rep)
    validate(data, origin, rep, pyc)
    if not vendor.is_dir():
        rep.err("E-VENDOR", "vendor", f"笔顺数据目录不存在：{vendor}")
    strokes, need_n = collect_strokes(data, vendor, rep)

    # 拼装
    head = read_part(parts_dir, "00_head.html", rep)
    check_head(head, rep)
    js = {}
    for n in JS_PARTS:
        js[n] = check_js_part(n, read_part(parts_dir, n, rep), rep)
    data_js = f"<script>window.HW_DATA = {js_embed(data)};</script>"
    strokes_js = f"<script>window.HW_STROKES = {js_embed(strokes)};</script>"
    de_tab = tts_de_table(data)
    de_keys = sorted(k for k, (v, _) in de_tab.items() if v == "de")
    rep.info.append(f"TTS“地”修正：共 {len(de_tab)} 种上下文，读 de {len(de_keys)} 种，读 dì {len(de_tab) - len(de_keys)} 种")
    rep.de_table = de_tab
    tts_js = f"<script>window.HW_TTS_DE = {js_embed(de_keys)};</script>"
    pieces = [
        ("parts/00_head.html", head.rstrip("\n")),
        ("hanzi-writer 3.7.3 <script src>", f'<script src="{HW_CDN}"></script>'),
        ('<div id="app">', '<div id="app"></div>'),
        ("HW_DATA", data_js),
        ("HW_STROKES", strokes_js),
        ("HW_TTS_DE", tts_js),
    ]
    for n in JS_PARTS:
        pieces.append((f"parts/{n}", f"<script>\n{js[n].rstrip()}\n</script>"))
    pieces.append(("HW.boot()", "<script>HW.boot();</script>"))
    html = "\n".join(p for _, p in pieces) + "\n"
    check_urls(html, rep)

    node_summary = "跳过（--no-node）"
    if not args.no_node:
        inline = [(f"parts/00_head.html <script>#{k}", m.group(1)) for k, m in enumerate(
            re.finditer(r"<script(?![^>]*\bsrc\s*=)[^>]*>(.*?)</script>", head, re.I | re.S))]
        inline += [(f"parts/{n}", js[n]) for n in JS_PARTS]
        inline.append(("HW.boot()", "HW.boot();"))
        node_summary = node_checks(inline, [data_js[8:-9], strokes_js[8:-9]], data, strokes, rep)

    total = len(html.encode("utf-8"))
    if total > SIZE_LIMIT:
        rep.err("E-SIZE", "dist", f"{fmt_bytes(total)} 超过 Artifact 16MB 上限")
    sizes = [f"  {name:<34} {fmt_bytes(len(p.encode('utf-8')))}" for name, p in pieces]
    sizes.append(f"  {'合计 dist/index.html':<34} {fmt_bytes(total)}")

    wrote = False
    if rep.errors and args.strict:
        dist_line = f"未输出（--strict 且有 {len(rep.errors)} 个错误）；{out} 保持原样"
    else:
        out.parent.mkdir(parents=True, exist_ok=True)
        out.write_text(html, "utf-8")
        wrote = True
        dist_line = f"{out}  {fmt_bytes(total)}  sha256={hashlib.sha256(html.encode('utf-8')).hexdigest()[:16]}"

    review_n = sum(1 for e in rep.py_entries if e["sev"] != "HINT")
    hint_n = len(rep.py_entries) - review_n
    meta = [
        f"时间：{time.strftime('%Y-%m-%d %H:%M:%S')}   用时 {time.time() - t0:.1f}s",
        f"ROOT：{root}",
        f"Python：{sys.executable}   pypinyin：{pyc.version or '不可用'}",
        f"输入文件（{len(files)}）：{', '.join(str(f.relative_to(root)) if f.is_relative_to(root) else str(f) for f in files) or '无'}",
        *rep.info,
        f"parts 目录：{parts_dir}",
        f"node 检查：{node_summary}",
        f"dist：{dist_line}",
        f"结论：错误 {len(rep.errors)} / 警告 {len(rep.warnings)} / 拼音待核对 {review_n} / 拼音提示 {hint_n} / 笔顺缺字 {len(rep.missing_strokes)}",
    ]
    write_report(report_path, rep, meta, data, sizes, len(strokes), need_n, pyc)
    with open(report_path, "a", encoding="utf-8") as f:
        f.write("\n== TTS“地”分类（de=朗读时换成“的”；规则判错就加进 TTS_DE_MANUAL）==\n")
        for k, (v, ctx) in sorted(rep.de_table.items(), key=lambda kv: (kv[1][0], kv[0])):
            f.write(f"  {v:<3} {k}   …{ctx}…\n")

    # GitHub Pages 版：完整文档（Artifact 版由平台套外壳，这里自己补 doctype/head/body 与平台同款基础样式）
    if wrote and not args.no_pages:
        page_out = rp(args.pages_out, root / "docs" / "index.html")
        body = "\n".join(p for n, p in pieces if n != "parts/00_head.html")
        page = ("<!doctype html>\n<html lang=\"zh-CN\">\n<head>\n<meta charset=\"utf-8\">\n"
                "<meta name=\"viewport\" content=\"width=device-width, initial-scale=1, viewport-fit=cover\">\n"
                "<style>:root{padding-top:env(safe-area-inset-top,0px);padding-bottom:env(safe-area-inset-bottom,0px)}"
                "body{margin:0}img{max-width:100%}[hidden]{display:none!important}</style>\n"
                + head.rstrip("\n") + "\n</head>\n<body>\n" + body + "\n</body>\n</html>\n")
        page_out.parent.mkdir(parents=True, exist_ok=True)
        page_out.write_text(page, "utf-8")
        print(f"  pages：{page_out}  {fmt_bytes(len(page.encode('utf-8')))}")

    print(f"华文小岛 build：输入 {len(files)} 个文件")
    print(f"  错误 {len(rep.errors)} / 警告 {len(rep.warnings)} / 拼音待核对 {review_n} / 拼音提示 {hint_n} / 笔顺缺字 {len(rep.missing_strokes)}（需 {need_n} 字，内嵌 {len(strokes)} 字）")
    print(f"  node：{node_summary}")
    print(f"  dist：{dist_line}")
    for s in sizes:
        print(s)
    print(f"  report：{report_path}")
    for e in rep.errors[:15]:
        print("  " + e)
    if len(rep.errors) > 15:
        print(f"  …… 另有 {len(rep.errors) - 15} 个错误，见 report")
    if not wrote and args.strict:
        print("  --strict：有错误，未输出 dist")
    return 1 if rep.errors else 0


if __name__ == "__main__":
    sys.exit(main())
