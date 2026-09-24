#!/usr/bin/env bash
# 배포본이 실제로 쓰는 글자만 담은 Noto Serif 한 벌을 굽는다 — 유지보수자가 손으로 돌린다.
#
# 왜: Google 의 124개 유니코드 서브셋은 "그 쪽에 쓰인 것만 받는다"가 약속이었지만, 색인 한 쪽이
# 1,806명의 이름을 그리느라 78개 파일 4.1MB 를 받았다(2026-09-23 실측). 이 사이트 전체가 그리는
# 글자는 3천 자 남짓이고, 그것을 한 파일에 담으면 두 굵기 합쳐 1MB 아래다 — 한 번 받으면 어느 쪽에도 있다.
#
# 어떻게: dist/ 의 글자 전집(scripts/glyph-corpus.mjs)으로 원본 폰트를 잘라 public/fonts/ 에 두고,
# fonts.css 끝의 표식 블록에 그 글자들의 unicode-range 를 단 @font-face 를 적는다. **같은 가족 이름으로,
# 맨 뒤에** — 브라우저는 뒤에 선언된 얼굴부터 보므로 전집 안의 글자는 이 한 벌에서 오고, 전집 밖의 글자
# (데이터가 자란 뒤 새로 나온 글자)는 예전처럼 Google 서브셋 한 조각으로 떨어진다. 깨지지 않고 느려질 뿐이다.
#
# 굵기 600 은 이름·제목·표제·런타임 문장에만 쓰이므로 그 글자만 담는다(--bold). 거기 없는 굵은 글자도 같은
# 길로 떨어진다.
#
# 그리스·키릴 문자는 통째로 Noto Serif 가 맡는다 — KR 폰트는 악센트 없는 그리스 글자만 있어 Πλάτων 의 ά 가
# 다른 글꼴로 떨어졌다(2026-09-23 심사: 그리스 이름 58/58). 한 이름은 한 글꼴이어야 하므로 그 문자권은 KR 에서 빼고
# Noto Serif 에 통째로 맡긴다. KR 에 없는 확장 라틴 몇 자와 일본 신자체 한자는 Noto Serif·Noto Serif JP 에서 잘라
# **같은 가족 이름**으로 잇는다. 아랍·히브리·데바나가리·타이·타밀·에티오피아는 시스템 글꼴로 — 낱말 전체가 한 글꼴로
# 떨어지므로 깨지지 않는다.
#
# 필요한 것: /usr/bin/python3 에 fonttools + brotli (pip install --user fonttools brotli). 원본 폰트는
# notofonts(OFL 1.1)에서 ~/.cache/one-book/fonts/ 로 한 번 받는다.
#
#   npm run build && bash scripts/subset-fonts.sh && npm run build
set -euo pipefail
cd "$(dirname "$0")/.."
[ -d dist/authors ] || { echo "dist/ 가 없다 — 먼저 npm run build" >&2; exit 1; }

CACHE="${HOME}/.cache/one-book/fonts"
OUT=public/fonts
CSS=$OUT/fonts.css
PY=/usr/bin/python3
SUBSET="$($PY -c 'import os,sysconfig;print(os.path.join(sysconfig.get_path("scripts", "posix_user"),"pyftsubset"))')"
[ -x "$SUBSET" ] || SUBSET="$(command -v pyftsubset)"
$PY -c 'import fontTools, brotli' 2>/dev/null || { echo "fonttools/brotli 가 없다: $PY -m pip install --user fonttools brotli" >&2; exit 1; }

mkdir -p "$CACHE"
fetch() { [ -s "$CACHE/$1" ] || curl -sfL --max-time 180 -o "$CACHE/$1" "$2"; }
fetch NotoSerifKR-Regular.otf  https://github.com/notofonts/noto-cjk/raw/main/Serif/SubsetOTF/KR/NotoSerifKR-Regular.otf
fetch NotoSerifKR-SemiBold.otf https://github.com/notofonts/noto-cjk/raw/main/Serif/SubsetOTF/KR/NotoSerifKR-SemiBold.otf
fetch NotoSerifJP-Regular.otf  https://github.com/notofonts/noto-cjk/raw/main/Serif/SubsetOTF/JP/NotoSerifJP-Regular.otf
fetch NotoSerifJP-SemiBold.otf https://github.com/notofonts/noto-cjk/raw/main/Serif/SubsetOTF/JP/NotoSerifJP-SemiBold.otf
fetch NotoSerifSC-Regular.otf  https://github.com/notofonts/noto-cjk/raw/main/Serif/SubsetOTF/SC/NotoSerifSC-Regular.otf
fetch NotoSerifSC-SemiBold.otf https://github.com/notofonts/noto-cjk/raw/main/Serif/SubsetOTF/SC/NotoSerifSC-SemiBold.otf
fetch NotoSerif-Regular.ttf    https://github.com/notofonts/notofonts.github.io/raw/main/fonts/NotoSerif/hinted/ttf/NotoSerif-Regular.ttf
fetch NotoSerif-SemiBold.ttf   https://github.com/notofonts/notofonts.github.io/raw/main/fonts/NotoSerif/hinted/ttf/NotoSerif-SemiBold.ttf

TMP="$(mktemp -d)"
node scripts/glyph-corpus.mjs > "$TMP/all.txt"
node scripts/glyph-corpus.mjs --bold > "$TMP/bold.txt"
# 그리스(U+0370–03FF, 1F00–1FFF)·키릴(U+0400–052F)은 Noto Serif 의 몫 — KR 전집에서 뺀다
split() { node -e '
const fs=require("fs");const lgc=(c)=>{const k=c.codePointAt(0);return (k>=0x370&&k<=0x3ff)||(k>=0x1f00&&k<=0x1fff)||(k>=0x400&&k<=0x52f);};
const t=[...fs.readFileSync(process.argv[1],"utf8")];fs.writeFileSync(process.argv[2],t.filter((c)=>!lgc(c)).join(""));fs.writeFileSync(process.argv[3],t.filter(lgc).join(""));' "$@"; }
split "$TMP/all.txt" "$TMP/all-kr.txt" "$TMP/gc.txt"
split "$TMP/bold.txt" "$TMP/bold-kr.txt" "$TMP/gc-bold.txt"
count() { node -e 'process.stdout.write(String([...require("fs").readFileSync(process.argv[1],"utf8")].length))' "$1"; }
echo "전집 $(count "$TMP/all.txt")자 · 굵은 글자 후보 $(count "$TMP/bold.txt")자"

rm -f "$OUT"/nskr-*.woff2
bake() { # name source corpus → prints the file name it wrote
  "$SUBSET" "$CACHE/$2" --text-file="$TMP/$3" --flavor=woff2 --layout-features='*' --no-hinting --desubroutinize \
    --output-file="$TMP/$1.woff2" 2>"$TMP/$1.err" || { cat "$TMP/$1.err" >&2; exit 1; }
  local h; h="$(shasum "$TMP/$1.woff2" | cut -c1-8)"
  cp "$TMP/$1.woff2" "$OUT/nskr-$1-$h.woff2"
  echo "nskr-$1-$h.woff2"
}
F400="$(bake kr-400 NotoSerifKR-Regular.otf all-kr.txt)"
F600="$(bake kr-600 NotoSerifKR-SemiBold.otf bold-kr.txt)"
# KR 에 없는 글자 + 그리스·키릴 전부를 Noto Serif 로
$PY -c '
import sys
from fontTools.ttLib import TTFont
cm = set(TTFont(sys.argv[1]).getBestCmap())
rest = "".join(c for c in open(sys.argv[2], encoding="utf-8").read() if ord(c) not in cm)
open(sys.argv[3], "w", encoding="utf-8").write(rest + open(sys.argv[4], encoding="utf-8").read()); print(f"KR 밖 {len(rest)}자 + 그리스·키릴")
' "$OUT/$F400" "$TMP/all.txt" "$TMP/rest.txt" "$TMP/gc.txt"
L400="$(bake lgc-400 NotoSerif-Regular.ttf rest.txt)"
L600="$(bake lgc-600 NotoSerif-SemiBold.ttf rest.txt)"
J400="$(bake jp-400 NotoSerifJP-Regular.otf rest.txt)"
J600="$(bake jp-600 NotoSerifJP-SemiBold.otf rest.txt)"
# 간체자(余华·许三观卖血记)는 KR·JP 어느 쪽에도 없다 — 같은 Noto Serif CJK 설계의 SC 에서 잘라 잇는다(2026-09-24 감사:
# 이름 한가운데 글자가 시스템 글꼴로 떨어졌다).
S400="$(bake sc-400 NotoSerifSC-Regular.otf rest.txt)"
S600="$(bake sc-600 NotoSerifSC-SemiBold.otf rest.txt)"

$PY - "$CSS" "$TMP/all.txt" "$OUT/$F400" "$OUT/$F600" "$OUT/$L400" "$OUT/$L600" "$OUT/$J400" "$OUT/$J600" "$OUT/$S400" "$OUT/$S600" <<'PYEOF'
import sys, re, os
from fontTools.ttLib import TTFont
css_path, corpus_path, *files = sys.argv[1:]
corpus = set(ord(c) for c in open(corpus_path, encoding="utf-8").read())

def ranges(cps):
    cps = sorted(cps); out = []; i = 0
    while i < len(cps):
        j = i
        while j + 1 < len(cps) and cps[j + 1] == cps[j] + 1: j += 1
        out.append(f"U+{cps[i]:x}" if i == j else f"U+{cps[i]:x}-{cps[j]:x}"); i = j + 1
    return ", ".join(out)

# 뒤의 글꼴은 앞의 글꼴이 이미 가진 글자를 다시 맡지 않는다 — 한 글자에 한 얼굴.
taken = {400: set(), 600: set()}
faces, notes = [], []
for path in files:
    name = os.path.basename(path); weight = 600 if "-600-" in name else 400
    cm = set(TTFont(path).getBestCmap()) - taken[weight]
    if not cm:
        notes.append(f"{name}: 새 글자 없음"); os.remove(path); continue
    taken[weight] |= cm
    faces.append(f"@font-face {{\n  font-family: 'Noto Serif KR';\n  font-style: normal;\n  font-weight: {weight};\n  font-display: swap;\n"
                 f"  src: url(/fonts/{name}) format('woff2');\n  unicode-range: {ranges(cm)};\n}}\n")
    notes.append(f"{name}: {len(cm)}자 {os.path.getsize(path)//1024}KB")
missing = corpus - taken[400]
block = ("/* subset:start — scripts/subset-fonts.sh 가 굽는다. 손으로 고치지 않는다.\n"
         " * 배포본 전집의 글자만 담은 한 벌. 같은 가족 이름으로 맨 뒤에 서서, 전집 안의 글자는 여기서 오고\n"
         " * 전집 밖의 글자는 위의 Google 서브셋 조각으로 떨어진다.\n * " + "\n * ".join(notes) + "\n"
         f" * 어느 글꼴에도 없는 글자 {len(missing)}자(아랍·데바나가리·타이·에티오피아 등 — 시스템 글꼴로, 낱말 단위라 깨지지 않는다). */\n"
         + "".join(faces) + "/* subset:end */\n")
css = open(css_path, encoding="utf-8").read()
css = re.sub(r"/\* subset:start.*?/\* subset:end \*/\n", "", css, flags=re.S).rstrip("\n") + "\n\n" + block
open(css_path, "w", encoding="utf-8").write(css)
print("\n".join(notes)); print(f"어느 글꼴에도 없는 글자 {len(missing)}자")
PYEOF
rm -rf "$TMP"
echo "다음: npm run build (dist/fonts 갱신) → QA 의 폰트 예산 계약이 잰다."
