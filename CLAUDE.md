# 하나의 책 — 에이전트 지침

이 레포는 2026-08-31 Noosphere 에서 분가했다. **Noosphere 의 CLAUDE.md 는 여기 적용되지
않는다** — 이 파일과 `docs/` 가 정본이다. 개인 전역 지침은 `~/dotfiles/AGENTS.md`.

## 먼저 읽을 것

- `docs/one-book.md` — 제품 정의·깊이 사다리·상태 사다리·무엇을 색인하는가
- `docs/one-sentence-contract.md` — 상급 게이트·손 떼기 조건·예산
- `docs/qc-sketch-wave.md` — 생성물 QC 의 실측과 규칙(최초형 주장 27.8%)
- `docs/backend-design.md` — Supabase `book` 스키마, 서버 코드 0

## 불변

- **지어내지 않는다 — 없는 것은 없다고 적는다.** 범위는 데이터 주장(결정 (135) #18).
- **작품이 작가보다 깊을 수 없다.** 깊이 = `silhouette | sketch | plate`, 작가·작품 양쪽.
- 검토되지 않은 쪽(도판 아닌 것)은 `noindex,follow`, sitemap 에 없다.
- 페이지 예산 1,750자(그려진 글자, 접힌 것 제외), 코퍼스 전수, 내려갈 수만 있다.
- 제3자 요청 0 — 폰트도 자체 호스팅(`scripts/fetch-fonts.sh`).
- 비밀키·토큰을 레포·CI 에 넣지 않는다. 유지보수자 로컬 키는 허용(결정 (135) #4).
- 런타임·빌드·CI 에 LLM 호출 없음. 큐레이션 도구(유지보수자 실행)에서는 허용.

## 생성과 QC 는 분리한다

생성 워크플로우는 자기 출력을 검증하지 않는다. QC 는 별도 워크플로우·별도 컨텍스트로,
"틀린 것을 찾아라"만 받는다. 표본이 오류 패턴을 특정하면(예: 최초형 주장) 그 표면은 전수.

## 워크플로우 규칙

- 대량 생성·QC 는 `agent(..., { model: 'opus' })`. 판단·설계는 세션 모델이 직접.
- 인제스트 스크립트(`scripts/ingest-*.ts`)는 **고칠 수 있는 것은 고치고, 못 고치는 것은
  버리고, 버린 이유를 센다.** `--write` 없이 먼저 돌려 본다.
- 인제스트 검증기를 믿지 말고 **합성 위반을 넣어 실제로 잡히는지** 본다(결정 (121)).
  프로브가 목표 검사보다 앞의 검사에 걸리면 그 프로브는 아무것도 증명하지 않는다.
- 배포는 수동 `npx wrangler pages deploy dist --project-name=literary-planet`.
  Pages 는 없는 경로에 `index.html` 을 200 으로 준다 — **제목으로 확인**한다.

## 명령

```bash
npm run release     # typecheck → test → build → verify:book (브라우저 계약)
npm run build       # validate:data → dist/
npm run verify:book # qa/verify-book.mjs — 계약 70+, 페이지 예산 전수
```

## 규율

라운드 착수 · 규칙을 추가하려는 순간 · 범위가 바뀐 직후 — 세 시점에 세 질문:
**목적지 한 줄 · 상속한 가정 · 이유가 소멸한 작업.** "하드 제약"이라는 이름은 재검토
면제 사유가 아니다(결정 (135) 반성).
