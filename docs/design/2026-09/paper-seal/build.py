#!/usr/bin/env python3
"""Builds the paper-seal mockups from the *current* pages and the shipped graph.

Nothing here writes prose. Every sentence is lifted from lab/current/*.html or
dist/walk-*.json and re-typeset. What this file adds is the seal rule:

    seal(author) = f(original-script name, slug, depth)   — no new data, no images.
"""
import html, json, re, unicodedata
from pathlib import Path

HERE = Path(__file__).resolve().parent
CUR = HERE.parent / "current"
OB = Path("/Users/damienmusica/Desktop/LASHHILLAPPS/one-book")
GRAPH = json.loads((OB / "dist/graph.json").read_text())
WALK = json.loads((OB / "dist/walk-cdd3c29fa5.json").read_text())
ART = json.loads((OB / "public/art/manifest.json").read_text())
BY = {a["i"]: a for a in GRAPH["authors"]}

B = "/paper-seal/"  # absolute: the lab server rewrites /x/index.html -> /x, which breaks relative URLs
LOCAL = {  # links that resolve inside the mock
    "/": B + "front.html", "/authors/": B + "index.html", "/shelf/": "#",
    "/authors/franz-kafka/": B + "author-kafka.html", "/authors/murasaki-shikibu/": B + "author-murasaki.html",
    "/authors/qu-yuan/": B + "author-sketch.html", "/works/franz-kafka--die-verwandlung/": B + "work.html",
    "/#franz-kafka": B + "author-kafka.html", "/#murasaki-shikibu": B + "author-murasaki.html", "/#qu-yuan": B + "author-sketch.html",
}
def href(h): return LOCAL.get(h, "#")
def esc(s): return html.escape(s, quote=True)

# ── the per-author variable ────────────────────────────────────────────────
def script_of(s):
    for ch in s:
        if not ch.isalpha(): continue
        n = unicodedata.name(ch, "")
        for key, tag in (("CJK", "han"), ("HIRAGANA", "kana"), ("KATAKANA", "kana"), ("HANGUL", "hangul"),
                         ("ARABIC", "arabic"), ("HEBREW", "hebrew"), ("CYRILLIC", "cyrillic"), ("GREEK", "greek"), ("LATIN", "latin")):
            if key in n: return tag
        return "other"
    return "other"

CHO = "ㄱㄲㄴㄷㄸㄹㅁㅂㅃㅅㅆㅇㅈㅉㅊㅋㅌㅍㅎ"
def graphemes(word):
    out = []
    for ch in word:
        if out and unicodedata.category(ch).startswith("M"): out[-1] += ch
        else: out.append(ch)
    return out

def seal_glyphs(o):
    """川 · А · ㄱㅅㅇ — carved in the author's own script.
    han/kana → first character of the name · hangul → initial consonants of every syllable ·
    everything else → first grapheme of the last word (the name readers call them by), upper-cased."""
    sc = script_of(o)
    letters = [g for g in graphemes(o) if g[0].isalpha()]
    if sc in ("han", "kana"): return [letters[0]], sc
    if sc == "hangul":
        return [CHO[(ord(g[0]) - 0xAC00) // 588] for g in letters if "가" <= g[0] <= "힣"][:4], sc
    last = [w for w in re.split(r"[\s\-]+", o) if any(c.isalpha() for c in w)][-1]
    g = [x for x in graphemes(last) if x[0].isalpha()][0]
    return [g.upper() if sc in ("latin", "cyrillic", "greek") else g], sc

def fnv(s):
    h = 0x811C9DC5
    for b in s.encode(): h = ((h ^ b) * 0x01000193) & 0xFFFFFFFF
    return h

_uid = [0]
BLACK = 'fill="#000"'
def seal(slug, tone="red", cls="", texture=False, o=None, depth=None, label=None):
    a = BY.get(slug, {})
    o = o or a.get("o") or a.get("k") or slug
    depth = depth or a.get("d", "sketch")
    glyphs, sc = seal_glyphs(o)
    h = fnv(slug); rot = (h % 900) / 100 - 4.5; seed = h % 997
    _uid[0] += 1; uid = f"s{_uid[0]}"
    size = {"han": 70, "kana": 66, "latin": 80, "cyrillic": 78, "greek": 76, "hangul": 60, "arabic": 86}.get(sc, 60)
    dy = {"latin": 4, "cyrillic": 4, "greek": 4, "arabic": -12}.get(sc, 1)
    if len(glyphs) == 1:
        pos = [(50, 50 + dy, size)]
    elif len(glyphs) == 2:
        pos = [(50, 30, 40), (50, 72, 40)]
    else:  # read like a seal: right column first, top to bottom
        cells = [(70, 30), (70, 72), (30, 30), (30, 72)]
        pos = [(x, y, 38) for x, y in cells[:len(glyphs)]]
    def texts(extra):
        return "".join(f'<text x="{x}" y="{y}" font-size="{fs}" text-anchor="middle" dominant-baseline="central" {extra}>{esc(g)}</text>'
                       for g, (x, y, fs) in zip(glyphs, pos))
    aria = esc(label or f"{a.get('k', slug)}의 인장 — {''.join(glyphs)}")
    pencil = depth != "plate" or tone == "pencil"
    if pencil:   # drawn, not yet cut: the page has not been pressed against its sources
        body = (f'<defs><pattern id="{uid}h" width="3.4" height="3.4" patternUnits="userSpaceOnUse" patternTransform="rotate(-52)">'
                f'<line x1="0" y1="0" x2="0" y2="3.4" stroke="var(--pencil)" stroke-width="1.5"/></pattern></defs>'
                f'<rect x="7" y="7" width="86" height="86" rx="7" fill="none" stroke="var(--pencil)" stroke-width="1.6" stroke-dasharray="4 3.2"/>'
                + texts(f'fill="url(#{uid}h)" stroke="var(--pencil)" stroke-width=".5"'))
        return f'<svg class="seal pencil {cls}" viewBox="0 0 100 100" role="img" aria-label="{aria} (연필)" style="transform:rotate({rot:.1f}deg)">{body}</svg>'
    fill = "var(--seal)" if tone == "red" else "var(--ink)"
    filt = ""
    flt_attr = ""
    if texture:  # uneven paste: every impression differs, seeded by the slug
        filt = (f'<filter id="{uid}f" x="-6%" y="-6%" width="112%" height="112%">'
                f'<feTurbulence type="fractalNoise" baseFrequency=".03" numOctaves="2" seed="{seed}" result="lo"/>'
                f'<feDisplacementMap in="SourceGraphic" in2="lo" scale="2.6" result="d"/>'
                f'<feTurbulence type="fractalNoise" baseFrequency=".55" numOctaves="2" seed="{seed + 7}" result="hi"/>'
                f'<feColorMatrix in="hi" type="matrix" values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 1 0 0 0 0" result="a"/>'
                f'<feComponentTransfer in="a" result="m"><feFuncA type="table" tableValues="1 1 1 1 1 1 .96 .7 .25 0 0"/></feComponentTransfer>'
                f'<feComposite in="d" in2="m" operator="in"/></filter>')
        flt_attr = f' filter="url(#{uid}f)"'
    body = (f'<defs>{filt}<mask id="{uid}m"><rect width="100" height="100" fill="#fff"/>{texts(BLACK)}</mask></defs>'
            f'<g{flt_attr}><rect x="5" y="5" width="90" height="90" rx="8" fill="{fill}" mask="url(#{uid}m)"/></g>')
    tone_cls = "ink" if tone == "ink" else ""
    return f'<svg class="seal {tone_cls} {cls}" viewBox="0 0 100 100" role="img" aria-label="{aria}" style="transform:rotate({rot:.1f}deg)">{body}</svg>'

def orig_html(o, lang, extra=""):
    sc = script_of(o)
    mode = " v" if sc in ("han", "kana") else (" rtl" if sc in ("arabic", "hebrew") else "")
    return f'<p class="orig{mode}{extra}" lang="{lang}">{esc(o)}</p>'

def autograph(slug, red_seal):
    for kind in ("signatures", "marks"):
        m = ART[kind].get(slug)
        if m: return f'<div class="autograph"><img src="/art/{m["file"]}" width="{m["w"]}" height="{m["h"]}" alt="{esc(BY[slug]["k"])}의 서명">{red_seal}</div>', m
    return f'<div class="autograph solo">{red_seal}</div>', None

# ── the reader's stamp ─────────────────────────────────────────────────────
def mark(work, big=False, ladder=True):
    lad = ""
    if ladder:
        lad = ('<div class="mark-ladder" role="group" aria-label="상태">'
               '<button type="button" data-set="want">관심 있는 책</button><button type="button" data-set="opened">펼쳐본 책</button>'
               '<button type="button" data-set="have">구매한 책</button><button type="button" data-set="read">읽은 책</button>'
               '<button type="button" class="clear" data-set="">모르는 책</button></div>'
               '<p class="mark-done"><a href="#">서재</a>에 꽂혔다.</p>')
    return (f'<div class="mark{" big" if big else ""}" data-work="{work}" data-state="">'
            f'<button type="button" class="mark-main" data-set="want" aria-pressed="false"><span class="pip" aria-hidden="true"></span>'
            f'<span class="mark-label">관심 있는 책</span><span class="chev" aria-hidden="true">▾</span></button>{lad}</div>')

# ── parsing the current pages (exact sentences, no retyping) ───────────────
def grab(pat, s, flags=re.S):
    m = re.search(pat, s, flags); return m.group(1).strip() if m else None

def parse_works(block):
    out = []
    for li in re.findall(r"<li>(.*?)</li>", block, re.S):
        t = re.search(r'<span class="t"><a href="([^"]+)">(.*?)</a></span>', li, re.S)
        out.append(dict(href=t.group(1), t=t.group(2), y=grab(r'<span class="y">(.*?)</span>', li), tag=grab(r'<span class="tag">(.*?)</span>', li),
                        work=grab(r'data-work="([^"]+)"', li), entry=grab(r'<p class="entrywhy">(.*?)</p>', li), sig=grab(r'<p class="sig">(.*?)</p>', li)))
    return out

def parse_rels(block):
    out = []
    for li in re.findall(r"<li>(.*?)</li>", block, re.S):
        a = re.search(r'<a href="([^"]+)">(?:<strong>)?(.*?)(?:</strong>)?</a>', li, re.S)
        out.append(dict(href=a.group(1), k=a.group(2), rt=grab(r'<span class="rt">(.*?)</span>', li),
                        sum=grab(r'<p class="sum">(.*?)<span class="ev">', li), ev=grab(r'<span class="ev">(.*?)</span>', li)))
    return out

def parse_author(name):
    s = (CUR / name).read_text(); body = s[s.index("<article"):]
    d = dict(h1=grab(r"<h1>(.*?)</h1>", body), orig=grab(r'<p class="orig">(.*?)</p>', body), life=grab(r'<p class="life">(.*?)</p>', body),
             why=grab(r'<p class="why">(.*?)</p>', body), slug=grab(r'data-author="([^"]+)"', body), title=grab(r"<title>(.*?)</title>", s),
             desc=grab(r'<meta name="description" content="([^"]*)"', s))
    d["h2"] = re.findall(r"<h2>(.*?)</h2>", body)
    ol = grab(r'<ol class="works">(.*?)</ol>', body); d["ordered"] = parse_works(ol) if ol else []
    m = re.search(r'<details><summary>(그 밖의 작품[^<]*)</summary><ul class="works">(.*?)</ul></details>', body, re.S)
    d["more"] = (m.group(1), parse_works(m.group(2))) if m else None
    ul = re.search(r'</h2>\s*<ul class="works">(.*?)</ul>', body, re.S); d["plainworks"] = parse_works(ul.group(1)) if ul else []
    d["warn"] = re.findall(r'<p class="warn">(.*?)</p>', body, re.S)
    d["absent"] = re.findall(r'<p class="absent">(.*?)</p>', body, re.S)
    lead = re.search(r'<h2>이어지는 한 사람</h2>\s*<ul class="rels">(.*?)</ul>', body, re.S); d["lead"] = parse_rels(lead.group(1)) if lead else []
    rest = re.search(r'<details><summary>(나머지 관계[^<]*)</summary>\s*<ul class="rels">(.*?)</ul></details>', body, re.S)
    d["rest"] = (rest.group(1), parse_rels(rest.group(2))) if rest else None
    near = re.search(r'<details class="near"><summary>(.*?)</summary>\s*<ul class="works">(.*?)</ul>', body, re.S)
    d["near"] = (near.group(1), [dict(href=h, k=k, y=y, tag=("도판" if "tag" in tail else None))
                 for h, k, y, tail in re.findall(r'<li><span class="t"><a href="([^"]+)">(.*?)</a></span><span class="y">(.*?)</span>(.*?)</li>', near.group(2))]) if near else None
    d["doors"] = re.findall(r'<a href="([^"]+)">(.*?)</a>', grab(r'<div class="doors">(.*?)</div>', body) or "")
    d["srcs"] = (re.findall(r'<p class="life">(출처[^<]*)</p>', body) or [None])[0]
    return d

FOOT = "검토 156 · 도판 157 · 스케치 1647 · 실루엣 2 · 작품 4062 · 관계 391 · 출처 338."
MOTTO = "지어내지 않는다: 없는 것은 없다고 적는다."
ICON = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 32 32'%3E%3Crect x='3' y='3' width='26' height='26' rx='3' fill='%23b4271b'/%3E%3Cpath d='M10 9h12M16 9v14M10 23h12' stroke='%23f0e7cd' stroke-width='2.6' fill='none'/%3E%3C/svg%3E"

def page(title, desc, body, current="", body_cls=""):
    nav = "".join(f'<a href="{h}"{" aria-current=\"page\"" if current == t else ""}>{t}</a>' for t, h in (("첫 장", B + "front.html"), ("서재", "#"), ("색인", B + "index.html")))
    return f"""<!doctype html>
<html lang="ko">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="color-scheme" content="light">
<title>{title}</title>
<meta name="description" content="{desc}">
<link rel="stylesheet" href="/fonts/fonts.css">
<link rel="stylesheet" href="{B}ps.css">
<link rel="icon" href="{ICON}">
<script defer src="{B}ps.js"></script>
</head>
<body class="{body_cls}">
<div class="wrap">
<header class="site">
  <a class="brand" href="{B}index.html">하나의 책</a>
  <nav>{nav}</nav>
</header>
<div class="rule-head"></div>
{body}
<footer class="colophon">
  <div class="rule-foot"></div>
  <p class="motto">{MOTTO}</p>
  <p class="counts">{FOOT}</p>
</footer>
</div>
</body>
</html>
"""

def work_li(w, cover=True):
    cov = ""
    c = ART["covers"].get(w["work"]) if cover else None
    if c: cov = f'<figure class="cover"><img src="/art/{c["file"]}" width="{c["w"]}" height="{c["h"]}" alt="『{esc(w["t"])}』 초판 표지" loading="lazy"></figure>'
    tag = f'<span class="tag">{w["tag"]}</span>' if w["tag"] else ""
    entry = f'<p class="entrywhy">{w["entry"]}</p>' if w["entry"] else ""
    sig = f'<p class="sig">{w["sig"]}</p>' if w["sig"] else ""
    return (f'<li>{cov}<div class="head"><span class="t"><a href="{href(w["href"])}">{w["t"]}</a></span><span class="y">{w["y"]}</span>{tag}</div>'
            f'{entry}{sig}{mark(w["work"])}</li>')

def rel_li(r):
    slug = r["href"].strip("/").split("/")[-1]
    return (f'<li>{seal(slug, tone="ink", cls="xs")}<div class="who"><a href="{href(r["href"])}">{r["k"]}</a><span class="rt">{r["rt"]}</span></div>'
            f'<p class="sum">{r["sum"]}<span class="ev">{r["ev"]}</span></p></li>')

def note(text):
    head, rest = text.split(" — ", 1)
    pips = ""
    m = re.match(r"난도 (\d)/(\d)", head)
    if m: pips = '<span class="pips" aria-hidden="true">' + "".join(f'<i class="{"on" if i < int(m.group(1)) else ""}"></i>' for i in range(int(m.group(2)))) + "</span>"
    return f'<div class="note"><p class="label">{head}{pips}</p><p>{rest}</p></div>'

def author_page(src, out):
    d = parse_author(src); slug = d["slug"]; a = BY[slug]; sketch = a["d"] != "plate"
    red = seal(slug, texture=True)
    auto, sigm = autograph(slug, red)
    band = ('<p class="unproved"><b>스케치</b><span>아직 출처에 대보지 않은 쪽</span></p>' if sketch else "")
    tp = (f'<header class="title-page"><h1 class="name">{d["h1"]}</h1>{orig_html(d["orig"], a["l"])}{auto}'
          f'<p class="imprint">{"".join(f"<span>{x}</span>" for x in d["life"].split(" · "))}</p></header>')
    rows = []
    # why
    side = f'<p class="label">{"스케치" if sketch else "도판"}</p>'
    go = "".join(f'<a class="go" href="{href(h)}">{t}</a>' for h, t in d["doors"][:1]) if not sketch else ""
    rows.append(f'<section class="row"><div class="side">{side}</div><div class="main"><p class="ready" id="lp-ready" data-author="{slug}" hidden></p>'
                f'<p class="lede cap">{d["why"]}</p>{go}</div></section>')
    # works
    if d["ordered"]:
        credits = []
        if sigm: credits.append(f'서명 — {sigm["provenance"]["licence"]} · Wikimedia Commons')
        covs = [ART["covers"][w["work"]] for w in d["ordered"] + (d["more"][1] if d["more"] else []) if w["work"] in ART["covers"]]
        if covs: credits.append("초판 표지 사진 — " + " · ".join(sorted({c["license"] for c in covs})) + " · Wikimedia Commons")
        notes = "".join(note(w) for w in d["warn"])
        cred = "".join(f'<p class="credit">{esc(c)}</p>' for c in credits)
        rows.append(f'<section class="row"><h2 class="side label">{d["h2"][0]}</h2><div class="main"><ol class="works ord">{"".join(work_li(w) for w in d["ordered"])}</ol></div>'
                    f'<aside class="aside">{notes}{cred}</aside></section>')
        if d["more"]:
            rows.append(f'<section class="row"><div class="side"></div><div class="main"><details><summary>{d["more"][0]}</summary><ul class="works plain">{"".join(work_li(w) for w in d["more"][1])}</ul></details></div></section>')
    if d["plainworks"] and not d["ordered"]:
        ab = "".join(f'<p class="absent">{x}</p>' for x in d["absent"][:1])
        rows.append(f'<section class="row"><h2 class="side label">{d["h2"][0]}</h2><div class="main"><ul class="works plain bare">{"".join(work_li(w) for w in d["plainworks"])}</ul></div>'
                    f'<aside class="aside">{ab}</aside></section>')
    # relations
    if d["lead"]:
        rest = f'<details><summary>{d["rest"][0]}</summary><ul class="rels">{"".join(rel_li(r) for r in d["rest"][1])}</ul></details>' if d["rest"] else ""
        rows.append(f'<section class="row"><h2 class="side label">이어지는 한 사람</h2><div class="main"><ul class="rels lead">{"".join(rel_li(r) for r in d["lead"])}</ul>{rest}</div></section>')
    elif len(d["absent"]) > 1:
        rows.append(f'<section class="row"><div class="side"></div><div class="main"><p class="absent">{d["absent"][1]}</p></div></section>')
    if d["near"]:
        lis = "".join(f'<li>{seal(h.strip("/").split("/")[-1], tone="ink", cls="xxs")}<a href="{href(h)}">{k}</a>{f"<span class=tag>{t}</span>" if t else ""}<span class="y">{y}</span></li>' for h, k, y, t in
                      [(n["href"], n["k"], n["y"], n["tag"]) for n in d["near"][1]])
        tail = ""
        if sketch: tail = '<div class="doors" style="margin-top:18px">' + "".join(f'<a class="go{" quiet" if i else ""}" href="{href(h)}">{t}</a>' for i, (h, t) in enumerate(d["doors"])) + "</div>"
        rows.append(f'<section class="row"><div class="side"></div><div class="main"><details class="nearby"><summary>{d["near"][0]}</summary><ul class="near">{lis}</ul></details>{tail}</div></section>')
    if d["srcs"]:
        rows.append(f'<section class="row"><div class="side"></div><div class="main"><p class="srcs">{d["srcs"]}</p></div></section>')
    body = f'<article class="{"sketch" if sketch else ""}">{band}{tp}<div class="sheet">{"".join(rows)}</div></article>'
    (HERE / out).write_text(page(d["title"], d["desc"], body))

# ── work ───────────────────────────────────────────────────────────────────
def work_page():
    s = (CUR / "work.html").read_text(); body = s[s.index("<article"):]
    wid = "franz-kafka--die-verwandlung"; aslug = "franz-kafka"
    h1 = grab(r"<h1>(.*?)</h1>", body); orig = grab(r'<p class="orig">(.*?)</p>', body)
    life = re.sub(r"\s*<select.*?</select>", "", grab(r'<p class="life">(.*?)</p>', body), flags=re.S)
    life = re.sub(r'href="([^"]+)"', lambda m: f'href="{href(m.group(1))}"', life)
    why = grab(r'<p class="why">(.*?)</p>', body)
    bq = re.search(r'<blockquote class="open"><p>(.*?)</p><p class="ko">(.*?)</p><span class="lbl">(.*?)</span>', body, re.S)
    facts = [x.split(" — ", 1) for x in re.findall(r'<p class="edrow">(.*?)</p>', body)]
    h2 = re.findall(r"<h2>(.*?)</h2>", body)
    rels = parse_rels(grab(r'<ul class="rels">(.*?)</ul>', body))
    eds = []
    for li in re.findall(r"<li>(.*?)</li>", grab(r'<ul class="eds">(.*?)</ul>', body), re.S):
        meta = re.findall(r'<span class="meta">(.*?)</span>', li)
        links = re.findall(r'<a href="([^"]+)" rel="[^"]+">(.*?)</a>', li)
        eds.append(dict(pub=grab(r'<span class="pub">(.*?)</span>', li), meta=meta, links=links, isbn=grab(r'<span class="isbn">ISBN (.*?)</span>', li), sig=grab(r'<p class="sig">(.*?)</p>', li)))
    doors = re.findall(r'<a href="([^"]+)">(.*?)</a>', grab(r'<div class="doors">(.*?)</div>', body))
    srcs = re.findall(r'<p class="life">(출처[^<]*)</p>', body)[0]
    cov = ART["covers"][wid]

    def ed_rows(e):
        yr = next((m for m in e["meta"] if re.fullmatch(r"\d{4}", m)), "")
        who = next((m for m in e["meta"] if "옮김" in m or "원서" in m), "")
        flag = " · ".join(m for m in e["meta"] if m not in (yr, who))
        src, _, why_ = e["sig"].partition(" — ")
        links = "".join(f'<a href="{esc(h)}" rel="nofollow noopener">{t}</a>' for h, t in e["links"])
        whytd = (f'{why_}<span class="src">{src}</span>' if why_ else f'<span class="src">{src}</span>')
        return (f'<tr class="ed"><td class="pub">{e["pub"]}</td><td class="tr">{who}</td><td class="yr">{yr}</td><td class="flag">{flag}</td>'
                f'<td class="isbn">ISBN {e["isbn"]}</td><td class="get">{links}</td></tr><tr class="why"><td colspan="6">{whytd}</td></tr>')
    ko = [e for e in eds if any("옮김" in m for m in e["meta"])]; orig_eds = [e for e in eds if e not in ko]
    table = (f'<table class="eds"><thead><tr><th>출판사</th><th>옮긴이</th><th>연도</th><th>저본</th><th>ISBN</th><th></th></tr></thead>'
             f'<tbody class="grp"><tr class="gh"><th colspan="6">한국어 {len(ko)}</th></tr>{"".join(ed_rows(e) for e in ko)}</tbody>'
             f'<tbody class="grp"><tr class="gh"><th colspan="6">{orig_eds[0]["meta"][0]} {len(orig_eds)}</th></tr>{"".join(ed_rows(e) for e in orig_eds)}</tbody></table>')
    factrows = "".join(f"<tr><th>{k}</th><td>{v}</td></tr>" for k, v in facts)
    year = re.search(r"· (\d{4}) ·", life).group(1)
    tp = (f'<header class="title-page" style="position:relative"><p class="label">{seal(aslug, cls="xs")} &nbsp;{life}</p>'
          f'<h1 class="name xl">{h1}</h1><p class="orig" lang="de">{orig}</p><span class="stamped" aria-hidden="true">관심 있는 책</span>'
          f'<div style="margin-top:clamp(24px,3.4vw,40px)">{mark(wid, big=True)}</div></header>')
    rows = [
        f'<section class="row"><div class="side"></div><div class="main"><p class="lede cap">{why}</p>'
        f'<blockquote class="opening"><p lang="de">{bq.group(1)}</p><p class="ko">{bq.group(2)}</p><span class="label">{bq.group(3)}</span></blockquote></div>'
        f'<aside class="aside"><figure class="cover fig"><img src="/art/{cov["file"]}" width="{cov["w"]}" height="{cov["h"]}" alt="『변신』 초판 표지">'
        f'<figcaption>{facts[2][0]} — {facts[2][1]}<br>사진 {cov["license"]} · Wikimedia Commons</figcaption></figure></aside></section>',
        f'<section class="row"><div class="side"></div><div class="main"><table class="facts">{factrows}</table></div></section>',
        f'<section class="row"><h2 class="side label">{h2[0]}</h2><div class="main"><ul class="rels">{"".join(rel_li(r) for r in rels)}</ul></div></section>',
        f'<section class="row"><h2 class="side label">{h2[1]}</h2><div class="wide">{table}</div></section>',
        f'<section class="row"><div class="side"></div><div class="main"><div class="doors">{"".join(f"<a class=\"go{' quiet' if i else ''}\" href=\"{href(h)}\">{t}</a>" for i, (h, t) in enumerate(doors))}</div><p class="srcs" style="margin-top:14px">{srcs}</p></div></section>',
    ]
    dock = (f'<div class="dock"><p class="what"><b>{h1}</b>프란츠 카프카 · {year}</p>{mark(wid, ladder=False)}</div>')
    body = f'<article data-stamp-for="{wid}">{tp}<div class="sheet">{"".join(rows)}</div></article>{dock}'
    (HERE / "work.html").write_text(page(grab(r"<title>(.*?)</title>", s), grab(r'<meta name="description" content="([^"]*)"', s), body, body_cls="has-dock"))

# ── index ──────────────────────────────────────────────────────────────────
def index_items():
    s = (CUR / "index.html").read_text()
    secs = re.split(r"<h2>(.*?)</h2>", s[s.index("<h2>"):])[1:]
    out = []
    for title, block in zip(secs[0::2], secs[1::2]):
        items = re.findall(r'<li data-h="([^"]*)" data-r="([^"]*)" data-p="([^"]*)"><a href="/authors/([^/]+)/">(.*?)</a><span class="y">(.*?)</span></li>', block)
        out.append((title, items))
    return s, out

def index_page():
    s, secs = index_items()
    h1 = grab(r"<h1>(.*?)</h1>", s); lede = re.sub(r"\s+", " ", grab(r'<p class="life">(.*?)</p>', s))
    selects = re.findall(r'(<select id="f[rp]">.*?</select>)', s, re.S)
    take = {"도판": 44, "스케치": 18, "실루엣": 2}
    gloss = {"도판": "쪽이 채워졌다", "스케치": "아직 출처에 대보지 않은 쪽", "실루엣": "이름과 자리로 서 있다"}
    cls = {"도판": "", "스케치": "sk", "실루엣": "sil"}
    out = []; names = []
    for title, items in secs:
        kind, n = title.split(" ")
        lis = []
        for hh, r, p, slug, k, y in items[:take[kind]]:
            a = BY[slug]; names.append((k, slug, a["o"]))
            lis.append(f'<li data-h="{hh}" data-r="{r}" data-p="{p}"><a href="{href("/authors/" + slug + "/")}">{seal(slug, cls="", depth=("plate" if kind == "도판" else "sketch"))}'
                       f'<span class="k">{k}</span><span class="o" lang="{a["l"]}">{esc(a["o"])}</span><span class="y">{y}</span></a></li>')
        more = f'<p class="more">목업 — {kind} {n}인 가운데 앞의 {len(lis)}인.</p>' if len(lis) < int(n) else ""
        out.append(f'<section class="album-sec"><div class="album-h"><h2>{kind}</h2><span class="n">{n}</span><span class="label">{gloss[kind]}</span></div>'
                   f'<ul class="album {cls[kind]}">{"".join(lis)}</ul>{more}</section>')
    head, _, tail = h1.partition(" — ")
    legend = (f'<p class="legend"><span>{seal("franz-kafka", cls="xxs")}도판 — {gloss["도판"]}</span>'
              f'<span>{seal("qu-yuan", cls="xxs")}스케치 — {gloss["스케치"]}</span></p>')
    tp = (f'<header class="title-page" style="padding-bottom:0"><h1 class="name">{head}</h1><p class="orig">{tail}</p></header>'
          f'<div class="index-lede"><p class="lede">{lede}</p><a class="go" href="{B}front.html">책을 펴기</a></div>'
          f'<div class="find"><div class="line"><input type="search" id="q" placeholder="이름이나 책 제목으로 찾기" autocomplete="off" spellcheck="false" aria-label="이름이나 책 제목으로 찾기"></div>'
          f'<div class="axes">{selects[0]}{selects[1]}<span id="cnt"></span></div></div>{legend}')
    (HERE / "index.html").write_text(page(grab(r"<title>(.*?)</title>", s), grab(r'<meta name="description" content="([^"]*)"', s) or "", tp + "".join(out), current="색인"))
    return names

# ── front ──────────────────────────────────────────────────────────────────
def front_page(names):
    s = (CUR / "front.html").read_text()
    lede = re.sub(r"\s+", " ", grab(r'<p class="life">(.*?)</p>', s))
    slug = "witold-gombrowicz"   # ISO week 39 of 2026 — what the live first page opens on today
    w = WALK[slug]; a = BY[slug]
    auto, sigm = autograph(slug, seal(slug, texture=True))
    works = "".join(work_li(dict(href=f'/works/{x["id"]}/', t=x["t"], y=x["y"], tag=None, work=x["id"], entry=None, sig=x["s"]), cover=False) for x in w["works"])
    to = {"franz-kafka": B + "author-kafka.html", "murasaki-shikibu": B + "author-murasaki.html", "qu-yuan": B + "author-sketch.html"}
    extra = [("프란츠 카프카", "franz-kafka", "Franz Kafka"), ("무라사키 시키부", "murasaki-shikibu", "紫式部"), ("굴원", "qu-yuan", "屈原")]
    seen = set(); opts = []
    for k, sl, o in extra + names:
        if sl in seen: continue
        seen.add(sl); opts.append(f'<option value="{esc(k)}" data-h="{esc(o)}"{f" data-to={to[sl]}" if sl in to else ""}>')
    regions = re.findall(r'<option value="([a-z\-]+)">(.*?)</option>', grab(r'<select id="fr">(.*?)</select>', (CUR / "index.html").read_text()))
    periods = re.findall(r'<option value="([a-z\-]+)">(.*?)</option>', grab(r'<select id="fp">(.*?)</select>', (CUR / "index.html").read_text()))
    def meters(pairs, key):
        rows = []
        for code, ko in pairs:
            tot = sum(1 for x in GRAPH["authors"] if (x["r"] == code if key == "r" else code in x["p"]))
            rows.append(f'<li><span class="t">{ko.split(" ")[0] if key == "p" else ko}</span><span class="m"><i style="width:0%"></i></span><span class="y">0/{tot}</span></li>')
        return "".join(rows)
    verso = (f'<section class="verso"><h1 class="book-title">하나의 책</h1><p class="book-sub">세계문학의 지도</p>'
             f'<form class="door" id="door" autocomplete="off"><label for="anchor">아는 이름에서 펴기</label>'
             f'<div class="line"><input id="anchor" name="anchor" list="authors" placeholder="좋아한 작가 이름" enterkeyhint="go"><button type="submit">책을 펴기</button></div>'
             f'<p class="miss" hidden>아직 없는 이름이다 — <a href="{B}index.html">색인</a>은 지금도 열려 있다.</p><datalist id="authors">{"".join(opts)}</datalist></form>'
             f'<p class="lede">{lede}</p><p class="census">만난 작가 <strong>0</strong><span>/ 1806</span></p></section>')
    recto = (f'<section class="recto" id="{slug}"><p class="label">이번 주에 열린 쪽</p><h2 class="name">{w["ko"]}</h2>'
             f'<p class="orig" lang="{a["l"]}">{esc(w["or"])}</p><p class="life">{w["life"]}</p>{auto}<p class="lede">{w["why"]}</p>'
             f'<ul class="works plain">{works}</ul><div class="doors"><a class="go" href="#{slug}">이 쪽을 펴기</a><a class="go quiet" href="#">다른 쪽</a></div></section>')
    lit = (f'<div class="sheet"><section class="row"><div class="side"></div><div class="wide"><details class="literacy"><summary>문해의 지도 — 어느 영역이 열려 있는가</summary>'
           f'<p class="absent">배지가 아니다. 어디를 지도 없이 읽을 수 있는지를 말한다.</p>'
           f'<h3 class="label" style="margin:18px 0 6px">권역</h3><ul class="meters">{meters(regions, "r")}</ul>'
           f'<h3 class="label" style="margin:18px 0 6px">시대</h3><ul class="meters">{meters(periods, "p")}</ul></details></div></section></div>')
    body = f'<main class="spread">{verso}{recto}</main>{lit}'
    (HERE / "front.html").write_text(page(grab(r"<title>(.*?)</title>", s), grab(r'<meta name="description" content="([^"]*)"', s), body, current="첫 장"))

if __name__ == "__main__":
    author_page("author-kafka.html", "author-kafka.html")
    author_page("author-murasaki.html", "author-murasaki.html")
    author_page("author-sketch.html", "author-sketch.html")
    work_page()
    front_page(index_page())
    print("built:", sorted(p.name for p in HERE.glob("*.html")))
