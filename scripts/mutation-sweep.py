#!/usr/bin/env python3
"""Mutation sweep: 「하나의 책」의 계약은 실제로 이빨이 있는가?

MAINTAINER TOOL, NOT CI. `literary-planet/` 아래 파일을 제자리에서 패치하고
계약 묶음을 돌려, 그 변화를 어떤 검사가 잡았는지 기록한다. 레포 루트에서:

    python3 scripts/mutation-sweep.py              # 유닛 레인만
    python3 scripts/mutation-sweep.py --browser    # + 브라우저 계약 (느림)

SURVIVED 는 비어 있는 보증이다: 제품이 그 성질을 조용히 잃는 동안 묶음은 초록이다.

이 파일이 존재하는 이유: 이 프로젝트는 **상태 단언이 픽셀을 증명하지 못한
자리를 다섯 번** 겪었다 — 렌즈 배율이 한 릴리스 내내 엉뚱한 곳에 렌더되는 동안
프로브는 초록이었고, "펼쳐진 산문 0" 계약이 전부 초록인 채 카드는 839자·버튼
40개였고, 라벨 계측이 18을 보고하는 동안 화면에는 이름이 하나도 없었다.
2026-08-31 철거로 3D 를 겨냥한 변이 190건이 전부 무의미해졌고, 이 표는 새
표면(정적 616쪽)을 겨냥해 다시 쓴 것이다.

**메모리 사본에서 복원한다, git 이 아니라** — git 복원은 미커밋 편집을 삼킨다
(실측 2회).

Interrupt-safe: 복원이 `finally` + `atexit` 양쪽에 걸려 있다. Kill-safe 도 —
변이 전에 원본을 `.mutation-sweep-backup/` 에 떨어뜨리고, 그 디렉터리가 남아
있으면 다음 실행은 **돌기를 거부한다**(`--repair` 로 되돌린 뒤 다시 부른다).
2026-08-25 에 3초짜리 정찰이 파이프 뒤에서 살아남아 35분 동안 트리를 갈아엎은
값을 치르고 얻은 규율이다.
"""
import argparse
import atexit
import pathlib
import shutil
import subprocess
import sys

# Resolve the repo from this file's own location (`<repo>/scripts/`), not from
# `git rev-parse`. The review bundle ships the tree as `git archive` output,
# which carries no `.git`, so the git call died at import time — before argparse
# — and took both `npm run universe:mutation-sweep` and reproduce.mjs's
# `mutation-fast` step with it. Worse, unzipping inside *some other* checkout
# made rev-parse succeed and the sweep would have patched files under the wrong
# toplevel. `__file__` resolves identically in-repo and in the unzipped tree.
# 2026-08-31 분가 이후 이 레포가 곧 제품이다 — 옛 경로(`<노스피어>/literary-planet`)는 없다.
REPO = str(pathlib.Path(__file__).resolve().parent.parent)
LP = REPO
# 죽어도 남는 원본 사본. 정상 종료 때 지운다 — 남아 있다는 것 자체가
# "지난 실행이 복원을 마치지 못했다"는 신호다.
BACKUP = pathlib.Path(REPO) / ".mutation-sweep-backup"

G = "src/universe/grammar.ts"
L = "src/universe/lenses.ts"
P = "src/universe/personal.ts"
R = "src/universe/readiness.ts"
S = "src/universe/scene.ts"
C = "src/universe/components/OrbitCard.tsx"
U = "src/universe/UniverseApp.tsx"
CSS = "src/universe/universe.css"
LAB = "src/globe/labels.ts"
ASM = "src/data/assemble.ts"
GEN = "scripts/generate-static-pages.ts"

# (lane, name, file, needle, replacement)
G = "scripts/generate-static-pages.ts"
R = "src/book/readiness.ts"
A = "src/data/assemble.ts"
S = "src/schema.ts"
T = "src/types.ts"

MUTATIONS = [
    # --- 정보 폭탄 절단: 목록은 잘려 있어야 한다 -------------------------------
    ("browser", "관계 목록을 다시 전부 편다 (정보 폭탄 복귀)", G,
     '<ul class="rels">${relRow(rels[0], a.id)}</ul>',
     '<ul class="rels">${rels.map((r) => relRow(r, a.id)).join("")}</ul>'),
    ("browser", "접힘을 없앤다 — 나머지 관계가 그대로 쏟아진다", G,
     "? `<details><summary>나머지 관계 ${rels.length - 1} — 선이 그어진 이유</summary>",
     "? `<div><span>나머지 관계 ${rels.length - 1} — 선이 그어진 이유</span>"),
    ("browser", "목록 한 줄이 다시 문단이 된다 (한 문장 절단 해제)", G,
     '<p class="sig">${esc(firstSentence(w.significance))}</p>',
     '<p class="sig">${esc(w.significance)}</p>'),
    # --- 판본 레이어: 없는 것을 있다고 말하지 않는다 ---------------------------
    ("browser", "판본이 없는데 상품 딥링크를 낸다 (없는 판본을 주장한다)", G,
     '  <a href="${ALADIN_SEARCH(term)}" rel="nofollow noopener">알라딘에서 찾기</a>',
     '  <a href="${ALADIN_ISBN("9788937460449")}" rel="nofollow noopener">알라딘에서 찾기</a>'),
    ("browser", "부재에서 날짜를 뗀다 (부재가 사실에서 분위기로 내려간다)", G,
     "한국어 판본을 아직 검수하지 않았다 (${esc(d.editions.checkedAt)} 확인).",
     "한국어 판본을 아직 검수하지 않았다."),
    ("fast", "ISBN 체크섬 검사를 없앤다 (아무 13자리나 판본이 된다)", S,
     'isbn13: z.string().refine(isbn13Valid, { message: "ISBN-13 체크섬이 맞지 않는다" }),',
     "isbn13: z.string(),"),
    ("fast", "판본이 존재하지 않는 작품에 붙어도 통과시킨다", A,
     "        if (!workById.has(workId)) {\n          errors.push(`editions.json: unknown work id '${workId}'`);",
     "        if (false) {\n          errors.push(`editions.json: unknown work id '${workId}'`);"),
    # --- 준비도 사다리가 표면을 지배한다 --------------------------------------
    ("fast", "미검수 작가의 작품도 실물 기록을 주장한다", R,
     "  return Boolean(work.world) && READY_IDS.has(work.authorId);",
     "  return Boolean(work.world);"),
    ("fast", "무스탬프를 신선으로 친다 (검수 안 한 것이 검수된 것이 된다)", R,
     'reason: "no-stamp"',
     'reason: "stale"'),
    # --- 철거가 되돌아오지 않는다 ---------------------------------------------
    ("fast", "출력을 비우지 않는다 (은퇴한 진입점이 dist 에 남아 함께 배포된다)", G,
     "rmSync(OUT, { recursive: true, force: true });",
     "// rmSync(OUT, { recursive: true, force: true });"),
    ("browser", "죽은 표면으로 가는 링크를 되살린다", G,
     '  <a href="/#${esc(a.id)}">여기서 읽기 시작</a>',
     '  <a href="/#${esc(a.id)}">여기서 읽기 시작</a>\n  <a href="/universe.html">성계에서 보기</a>'),
    ("browser", "옛 이름을 되돌린다", G,
     '  <a class="brand" href="/authors/">하나의 책</a>',
     '  <a class="brand" href="/authors/">문학의 성계</a>'),
    # --- 고전 확장 (결정 (134)) --------------------------------------------------
    ("fast", "연도 하한을 1700 으로 되돌린다 (고전이 Zod 에서 죽는다)", S,
     "const lifeYear = z.number().int().min(-3000).max(2030);",
     "const lifeYear = z.number().int().min(1700).max(2030);"),
    ("fast", "초간 연도를 작품 연도와 같은 축으로 되돌린다 (기원전 초판이 통과한다)", S,
     "const printYear = z.number().int().min(1400).max(2030);",
     "const printYear = z.number().int().min(-3000).max(2030);"),
    ("fast", "yearBasis 를 아무 문자열이나 받게 한다", S,
     '      .enum(["attested", "composition-range", "earliest-manuscript", "first-print"])',
     "      .string()"),
    ("fast", "authorKind 를 아무 문자열이나 받게 한다 (없는 저자 유형이 생긴다)", S,
     'authorKind: z.enum(["person", "corpus"]).optional(),',
     "authorKind: z.string().optional(),"),
    ("fast", "저본 유형을 아무 문자열이나 받게 한다 (중역이 원전 직역이 된다)", S,
     'sourceTextBasis: z.enum(["original", "relay", "adaptation"]).optional(),',
     "sourceTextBasis: z.string().optional(),"),
    ("fast", "한 곳만 뒤지고 없다고 적을 수 있게 한다", S,
     'searched: z.array(z.string().min(2)).min(2, "한 곳만 뒤지고 없다고 적지 않는다"),',
     "searched: z.array(z.string().min(2)),"),
    ("fast", "부재 원장이 유령 작품을 가리켜도 통과시킨다", A,
     "        if (!workById.has(workId)) errors.push(`editions.json: unknown work id '${workId}' (absent)`);",
     "        if (false) errors.push(`editions.json: unknown work id '${workId}' (absent)`);"),
    ("fast", "고대·중세 시대층을 지운다", T,
     '    id: "antiquity-medieval",',
     '    id: "roots-duplicate-probe",'),
    ("fast", "부재를 미검수와 같은 문장으로 낸다 (찾았고 없었다가 아직 안 봤다가 된다)", G,
     "  const gone = d.editions.absent?.[w.id];",
     "  const gone = undefined as { checkedAt: string; searched: string[]; note?: string } | undefined;"),
    ("fast", "관계 0인 작가가 빈 섹션을 다시 찍는다", G,
     "  if (!rels.length) {",
     "  if (false) {"),

    # --- 상태 사다리 (2026-08-31, CPO) ------------------------------------------
    ("browser", "「모르는 책」 기본값을 저장한다 (표시하지 않은 책이 레코드가 된다)", G,
     "  if(s)p.state[id]={s:s,at:Date.now()};else delete p.state[id];",
     "  p.state[id]={s:s,at:Date.now()};"),
    ("browser", "칸을 오른 시각을 남기지 않는다", G,
     "if(s)p.state[id]={s:s,at:Date.now()};",
     "if(s)p.state[id]={s:s};"),
    ("browser", "v2 이관을 하지 않는다 (옛 기록을 버린다)", G,
     "    for(var k in (old.want||{}))p.state[k]={s:'want',at:old.want[k]};",
     "    ;"),
    ("browser", "사다리에서 한 칸을 뺀다", G,
     "['have','구매한 책'],['read','읽은 책']",
     "['read','읽은 책']"),
    # --- 정문이 담을 책을 세운다 -----------------------------------------------
    ("browser", "정문에서 담기 버튼을 지운다", G,
     chr(39) + '<button class="want" data-want="' + chr(39) + "+w.id+",
     chr(39) + '<span data-gone="' + chr(39) + "+w.id+")
]


def run(cmd, cwd=LP):
    return subprocess.run(cmd, cwd=cwd, shell=True, capture_output=True, text=True)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--browser", action="store_true", help="also run the browser contracts (slow)")
    ap.add_argument(
        "--only",
        action="append",
        help="이름에 이 문자열이 든 변이만 돈다 (반복 가능). 새 기제를 붙인 직후 "
        "그 기제만 재는 데 쓴다 — 브라우저 레인 전체는 한 시간이 넘고, 그동안 "
        "트리가 잠긴다.",
    )
    ap.add_argument(
        "--lane",
        action="append",
        choices=["fast", "browser"],
        help="run ONLY these lanes (repeatable). 새 레인을 붙인 직후 그 레인만 "
        "재는 데 쓴다 — 전체 스윕은 두 시간이 넘고, 그동안 트리가 잠긴다.",
    )
    ap.add_argument(
        "--repair",
        action="store_true",
        help="지난 실행이 남긴 .mutation-sweep-backup/ 에서 원본을 되돌리고 끝낸다.",
    )
    args = ap.parse_args()

    if args.repair:
        if not BACKUP.exists():
            sys.exit("되돌릴 사본이 없다 — 트리는 이미 원본이다.")
        n = 0
        for f in sorted(BACKUP.iterdir()):
            rel = f.name.replace("__", "/")
            target = pathlib.Path(LP) / rel
            text = f.read_text(encoding="utf-8")
            if target.read_text(encoding="utf-8") != text:
                target.write_text(text, encoding="utf-8")
                n += 1
                print(f"  되돌림 {rel}")
        shutil.rmtree(BACKUP)
        print(f"{n}개 파일을 되돌렸다. dist 는 `npm run build` 로 다시 짓는다.")
        return

    if BACKUP.exists():
        sys.exit(
            "지난 실행이 복원을 마치지 못했다 (.mutation-sweep-backup/ 이 남아 있다).\n"
            "  python3 scripts/mutation-sweep.py --repair\n"
            "로 되돌린 뒤 다시 부른다 — 그러지 않으면 변이된 트리 위에 변이를 얹는다."
        )

    # `--browser` 는 브라우저가 필요한 레인 **전부**다: 넓은 화면(verify-journey)·
    # 비행(verify-flight)·손안(verify-mobile). 셋 다 같은 dist 를 쓰므로 빌드도 함께 탄다.
    #
    # `flight` 가 따로 있는 이유는 **속도**다. 조준 루프(드래그 → 투영 재측정 →
    # 다시 드래그)를 여정 파일에 넣었더니 한 판이 8분이 됐고, 변이 22건이 네
    # 시간으로 불어 트리를 그동안 잠갔다(2026-08-25 실측). 느린 계약은 자기
    # 레인을 갖는다 — 지금 비행 레인 한 판은 60초다.
    lanes = set(args.lane) if args.lane else {"fast"} | ({"browser"} if args.browser else set())
    cases = [m for m in MUTATIONS if m[0] in lanes]
    if args.only:
        cases = [m for m in cases if any(k in m[1] for k in args.only)]
        if not cases:
            sys.exit("--only 가 아무 변이와도 맞지 않는다")

    originals = {}
    for _, _, rel, _, _ in cases:
        path = f"{LP}/{rel}"
        if path not in originals:
            originals[path] = open(path, encoding="utf-8").read()

    # 죽어도 남는 사본을 먼저 떨어뜨린다 — 메모리 사본은 프로세스와 함께 죽는다
    BACKUP.mkdir(exist_ok=True)
    for path, text in originals.items():
        (BACKUP / pathlib.Path(path).relative_to(LP).as_posix().replace("/", "__")).write_text(
            text, encoding="utf-8"
        )

    def restore():
        for path, text in originals.items():
            try:
                if open(path, encoding="utf-8").read() != text:
                    open(path, "w", encoding="utf-8").write(text)
            except OSError:
                pass

    atexit.register(restore)

    needs_dist = bool(lanes & {"browser"})
    if needs_dist:
        print("browser lane: building the baseline dist once…")
        b = run("npm run build")
        if b.returncode != 0:
            print(b.stdout[-1500:], b.stderr[-1500:])
            sys.exit("baseline build failed")

    survived, killed, broken = [], [], []
    try:
        for lane, name, rel, needle, repl in cases:
            path = f"{LP}/{rel}"
            text = originals[path]
            if needle not in text:
                broken.append((name, f"needle not found in {rel}"))
                print(f"  ??  {name}\n      needle not found in {rel} — mutation is stale")
                continue
            open(path, "w", encoding="utf-8").write(text.replace(needle, repl, 1))
            try:
                if lane == "fast":
                    res = run("npm run test")
                    caught = res.returncode != 0
                else:
                    build = run("npm run build")
                    if build.returncode != 0:
                        caught = True  # a type error is a caught mutation
                    else:
                        harness = "node qa/verify-book.mjs"
                        res = run(harness)
                        caught = res.returncode != 0
            finally:
                open(path, "w", encoding="utf-8").write(text)
            (killed if caught else survived).append(name)
            print(f"  {'✓ KILLED  ' if caught else '✗ SURVIVED'} [{lane}] {name}")
    finally:
        restore()
        if needs_dist:
            # 마지막 변이가 만든 dist 가 남으면 이후 검증이 유령 실패를 낸다
            # (실측: 스윕 직후 여정 계약이 88/3 로 나왔고 원인은 오염된 dist).
            print("restoring the baseline dist…")
            run("npm run build")

    shutil.rmtree(BACKUP, ignore_errors=True)

    print(f"\nkilled {len(killed)} · survived {len(survived)} · stale {len(broken)}")
    if survived:
        print("\nSURVIVED — 계약이 비어 있는 자리:")
        for s in survived:
            print(f"  · {s}")
    if broken:
        print("\nSTALE — 코드가 바뀌어 변이가 적용되지 않음 (변이를 갱신하라):")
        for n, why in broken:
            print(f"  · {n}: {why}")
    sys.exit(1 if (survived or broken) else 0)


if __name__ == "__main__":
    main()
