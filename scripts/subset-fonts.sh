#!/usr/bin/env bash
# 배포본이 실제로 쓰는 글자만 담은 Noto Serif KR 한 벌을 굽는다 — 유지보수자가 손으로 돌린다.
#
# 왜: Google 의 124개 유니코드 서브셋은 "그 쪽에 쓰인 것만 받는다"가 약속이었지만, 색인 한 쪽이
# 1,806명의 이름을 그리느라 78개 파일 4.1MB 를 받았다(2026-09-23 실측). 이 사이트 전체가 그리는
# 글자는 3천 자 남짓이고, 그것을 한 파일에 담으면 두 굵기 합쳐 1MB 아래다 — 한 번 받으면 어느 쪽에도 있다.
#
# 어떻게: dist/ 의 글자 전집(scripts/glyph-corpus.mjs)으로 원본 OTF 를 잘라 public/fonts/ 에 두고,
# fonts.css 끝의 표식 블록에 그 글자들의 unicode-range 를 단 @font-face 를 적는다. **같은 가족 이름으로,
# 맨 뒤에** — 브라우저는 뒤에 선언된 얼굴부터 보므로 전집 안의 글자는 이 한 벌에서 오고, 전집 밖의 글자
# (데이터가 자란 뒤 새로 나온 글자)는 예전처럼 Google 서브셋 한 조각으로 떨어진다. 깨지지 않고 느려질 뿐이다.
#
# 굵기 600 은 이름·제목·표제·런타임 문장에만 쓰이므로 그 글자만 담는다(--bold). 거기 없는 굵은 글자도 같은
# 길로 떨어진다.
#
# 필요한 것: /usr/bin/python3 에 fonttools + brotli (pip install --user fonttools brotli). 원본 OTF 는
# notofonts/noto-cjk(OFL 1.1)에서 ~/.cache/one-book/fonts/ 로 한 번 받는다.
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
for f in NotoSerifKR-Regular.otf NotoSerifKR-SemiBold.otf; do
  [ -s "$CACHE/$f" ] || curl -sfL --max-time 180 -o "$CACHE/$f" "https://github.com/notofonts/noto-cjk/raw/main/Serif/SubsetOTF/KR/$f"
done

TMP="$(mktemp -d)"
node scripts/glyph-corpus.mjs > "$TMP/all.txt"
node scripts/glyph-corpus.mjs --bold > "$TMP/bold.txt"
count() { node -e 'process.stdout.write(String([...require("fs").readFileSync(process.argv[1],"utf8")].length))' "$1"; }
echo "전집 $(count "$TMP/all.txt")자 · 굵은 글자 후보 $(count "$TMP/bold.txt")자"

rm -f "$OUT"/nskr-*.woff2
bake() { # weight source corpus
  "$SUBSET" "$CACHE/$2" --text-file="$TMP/$3" --flavor=woff2 --layout-features='*' --no-hinting --desubroutinize \
    --output-file="$TMP/$1.woff2" 2>"$TMP/$1.err" || { cat "$TMP/$1.err" >&2; exit 1; }
  local h; h="$(shasum "$TMP/$1.woff2" | cut -c1-8)"
  cp "$TMP/$1.woff2" "$OUT/nskr-$1-$h.woff2"
  echo "nskr-$1-$h.woff2"
}
F400="$(bake 400 NotoSerifKR-Regular.otf all.txt)"
F600="$(bake 600 NotoSerifKR-SemiBold.otf bold.txt)"

$PY - "$CSS" "$OUT/$F400" "$OUT/$F600" "$TMP/all.txt" <<'PY'
import sys, re
from fontTools.ttLib import TTFont
css_path, f400, f600, corpus_path = sys.argv[1:5]
corpus = set(ord(c) for c in open(corpus_path, encoding="utf-8").read())

def ranges(cps):
    cps = sorted(cps); out = []; i = 0
    while i < len(cps):
        j = i
        while j + 1 < len(cps) and cps[j + 1] == cps[j] + 1: j += 1
        out.append(f"U+{cps[i]:x}" if i == j else f"U+{cps[i]:x}-{cps[j]:x}"); i = j + 1
    return ", ".join(out)

def face(path, weight):
    t = TTFont(path); cm = set(t.getBestCmap())
    size = __import__("os").path.getsize(path)
    return (f"@font-face {{\n  font-family: 'Noto Serif KR';\n  font-style: normal;\n  font-weight: {weight};\n  font-display: swap;\n"
            f"  src: url(/fonts/{path.split('/')[-1]}) format('woff2');\n  unicode-range: {ranges(cm)};\n}}\n"), len(cm), size

b400, n400, s400 = face(f400, 400)
b600, n600, s600 = face(f600, 600)
missing = len(corpus - set(TTFont(f400).getBestCmap()))
block = ("/* subset:start — scripts/subset-fonts.sh 가 굽는다. 손으로 고치지 않는다.\n"
         " * 배포본 전집의 글자만 담은 한 벌. 같은 가족 이름으로 맨 뒤에 서서, 전집 안의 글자는 여기서 오고\n"
         f" * 전집 밖의 글자는 위의 Google 서브셋 조각으로 떨어진다. 400: {n400}자 {s400//1024}KB · 600: {n600}자 {s600//1024}KB\n"
         f" * · 폰트에 없는 글자 {missing}자(아랍·데바나가리 등 — 시스템 글꼴로). */\n" + b400 + b600 + "/* subset:end */\n")
css = open(css_path, encoding="utf-8").read()
css = re.sub(r"/\* subset:start.*?/\* subset:end \*/\n", "", css, flags=re.S).rstrip("\n") + "\n\n" + block
open(css_path, "w", encoding="utf-8").write(css)
print(f"400 {n400}자 {s400//1024}KB · 600 {n600}자 {s600//1024}KB · 폰트에 없는 글자 {missing}자")
PY
rm -rf "$TMP"
echo "다음: npm run build (dist/fonts 갱신) → QA 의 폰트 예산 계약이 잰다."
