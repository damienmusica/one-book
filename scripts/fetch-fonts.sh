#!/usr/bin/env bash
# Noto Serif KR 을 자체 호스팅용으로 굽는다 — 유지보수자가 손으로 돌린다(네트워크).
#
# 왜 자체 호스팅인가: 이 제품은 독자의 표시를 밖으로 내보내지 않는다고 말한다.
# 폰트 CDN 한 줄이 모든 페이지에서 독자의 IP 를 제3자에게 보낸다면 그 말이 반만 참이 된다.
#
# 왜 스크립트인가: public/fonts/fonts.css 는 손으로 쓰지 않는다. Google 의 서브셋
# 경계(unicode-range)는 그들이 폰트를 갱신할 때 바뀌고, 그때 이걸 다시 돌린다.
#
#   bash scripts/fetch-fonts.sh
set -euo pipefail
cd "$(dirname "$0")/.."
OUT=public/fonts
UA='Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/120 Safari/537.36'
API='https://fonts.googleapis.com/css2?family=Noto+Serif+KR:wght@400;600&display=swap'

mkdir -p "$OUT"
curl -sf --max-time 30 -A "$UA" "$API" -o /tmp/nsk.css
grep -o 'https://fonts.gstatic.com/[^)]*' /tmp/nsk.css | sort -u > /tmp/nsk-urls.txt
echo "서브셋 $(wc -l < /tmp/nsk-urls.txt)개"

python3 - <<'PY'
import urllib.request, os, re, pathlib, concurrent.futures
out = pathlib.Path("public/fonts")
urls = [l.strip() for l in open("/tmp/nsk-urls.txt") if l.strip()]

def get(u):
    f = out / os.path.basename(u)
    if f.exists() and f.stat().st_size > 0:
        return 0
    f.write_bytes(urllib.request.urlopen(u, timeout=30).read())
    return f.stat().st_size

with concurrent.futures.ThreadPoolExecutor(8) as ex:
    total = sum(ex.map(get, urls))
print(f"받음 {round(total/1024/1024, 2)} MB")

css = pathlib.Path("/tmp/nsk.css").read_text(encoding="utf-8")
css = re.sub(r"https://fonts\.gstatic\.com/s/notoserifkr/[^)]*/([^)/]+\.woff2)", r"/fonts/\1", css)
assert "fonts.gstatic.com" not in css, "CDN URL 이 남았다"
header = """/* Noto Serif KR — Google Fonts, SIL Open Font License 1.1 (OFL.txt 동봉).
 *
 * 자체 호스팅한다. 이 제품은 독자의 표시를 밖으로 내보내지 않는다고 말하는데,
 * 폰트 CDN 한 줄이 모든 페이지에서 독자의 IP 를 제3자에게 보낸다면 그 말이 반만
 * 참이 된다. 유니코드 서브셋이 전부 여기 있고, 브라우저는 그중 그 쪽에 실제로
 * 쓰인 것만 받는다.
 *
 * 이 파일은 손으로 쓰지 않는다 — scripts/fetch-fonts.sh 가 굽는다.
 */
"""
(out / "fonts.css").write_text(header + css, encoding="utf-8")
print(f"fonts.css — {css.count('@font-face')} faces")
PY

[ -s "$OUT/OFL.txt" ] || curl -sf --max-time 20 \
  https://raw.githubusercontent.com/notofonts/noto-cjk/main/Serif/LICENSE -o "$OUT/OFL.txt"
echo "완료 — $(du -sh "$OUT" | cut -f1)"
