import { useMemo } from "react";
import { useServices } from "./ctx.ts";
import {
  EVIDENCE_LEVEL_KO,
  GENDER_KO,
  GENRE_DEFS,
  PERIOD_DEFS,
  REGION_DEFS,
  RELATION_DEFS,
  REVIEW_STATUS_KO,
  LANGUAGE_LABELS
} from "../types.ts";

function count<T>(items: T[], key: (t: T) => string[]): Map<string, number> {
  const m = new Map<string, number>();
  for (const item of items) {
    for (const k of key(item)) m.set(k, (m.get(k) ?? 0) + 1);
  }
  return new Map([...m].sort((a, b) => b[1] - a[1]));
}

function DistTable({
  title,
  data,
  labelOf,
  total
}: {
  title: string;
  data: Map<string, number>;
  labelOf: (k: string) => string;
  total: number;
}) {
  return (
    <div className="dist-block">
      <h3>{title}</h3>
      <table className="dist-table">
        <tbody>
          {[...data].map(([k, n]) => (
            <tr key={k}>
              <th scope="row">{labelOf(k)}</th>
              <td>{n}</td>
              <td className="dist-pct">{((n / total) * 100).toFixed(0)}%</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function MethodologyPage() {
  const { dataset } = useServices();
  const { authors, relations, works } = dataset;

  const dist = useMemo(
    () => ({
      regions: count(authors, (a) => a.regions),
      languages: count(authors, (a) => a.languages),
      gender: count(authors, (a) => [a.gender]),
      genres: count(authors, (a) => a.genres),
      periods: count(authors, (a) => a.periods),
      review: count(authors, (a) => [a.reviewStatus]),
      evidence: count(relations, (r) => [r.evidenceLevel]),
      relTypes: count(relations, (r) => [r.type])
    }),
    [authors, relations]
  );

  const regionKo = new Map<string, string>(REGION_DEFS.map((r) => [r.id, r.ko]));
  const periodKo = new Map<string, string>(PERIOD_DEFS.map((p) => [p.id, p.ko]));
  const genreKo = new Map<string, string>(GENRE_DEFS.map((g) => [g.id, g.ko]));
  const relKo = new Map<string, string>(RELATION_DEFS.map((r) => [r.id, r.ko]));

  return (
    <main className="methodology-page">
      <h1>방법론 — 이 지도는 어떻게 만들어졌나</h1>
      <p className="method-lede">
        《문학의 행성》은 20세기 세계문학의 작가 {authors.length}명, 작품 {works.length}편,
        관계 {relations.length}개를 회전하는 구면 위에 배치한 독서·연구 도구다. 여기 실린
        정전(canon)은 <strong>객관적 진리가 아니라 편집 가능한 지도</strong>다 — 아래에 그
        편집의 규칙과 한계를 공개한다.
      </p>

      <section>
        <h2>시대 범위와 층 구조</h2>
        <p>
          중심 범위는 20세기다. '20세기 작가'를 출생연도로 기계적으로 자르지 않고 주요 작품
          발표 시기·활동 시기·후대 영향으로 판단했으며, 시간층은 실제 문학사처럼 의도적으로
          겹치게 설계했다. '20세기'라는 시간 필터와 '모더니즘'이라는 미학·운동 필터는 별개
          축이며 별개 필터로 제공된다.
        </p>
        <ul>
          {PERIOD_DEFS.map((p) => (
            <li key={p.id}>
              <strong>{p.ko}</strong> — {p.description}
            </li>
          ))}
        </ul>
      </section>

      <section>
        <h2>선정 기준</h2>
        <ol>
          <li>형식적 혁신 — 서사·시·극의 문법 자체를 바꾸었는가.</li>
          <li>후대 작가와 다른 언어권에 미친 확인 가능한 영향.</li>
          <li>시대·지역·언어권을 대표하면서 내부의 복잡성을 보여주는가.</li>
          <li>번역·잡지·비평을 통한 문학권 사이의 매개 역할.</li>
          <li>지속적인 재독과 비평적 논쟁의 대상인가.</li>
          <li>서구 중심 정전에서 배제되어 온 전통의 복원 필요.</li>
          <li>판매량·수상 경력만으로는 선정하지 않았다.</li>
        </ol>
        <p>
          초기 코퍼스 100명은 위 기준으로 고른 필수 검토 목록이며, 확장 슬레이트(발저, 츠바이크,
          레비, 먼로, 파묵, 무라카미 등)는 다음 판에서 같은 기준으로 검토된다.
        </p>
      </section>

      <section>
        <h2>관계 유형과 근거 수준</h2>
        <p>
          모든 관계선은 세 가지 근거 수준 중 하나를 명시한다. 이 구분을 섞는 것이 이런 지도의
          가장 흔한 부정직함이므로, 기계 검증이 이를 강제한다:{" "}
          <strong>직접 영향·번역·사사 관계는 출처 없이 저장될 수 없다.</strong>
        </p>
        <ul>
          {RELATION_DEFS.map((r) => (
            <li key={r.id}>
              <strong>{r.ko}</strong> — {r.description}
            </li>
          ))}
        </ul>
        <p>
          '카프카와 베케트가 비슷하다'는 것만으로는 영향 관계가 되지 않는다 — 그런 관계는{" "}
          <strong>{EVIDENCE_LEVEL_KO.editorial_inference}</strong>로 점선 표시된다. 관계
          수는 작가마다 다르며, 억지로 균등하게 만들지 않았다.
        </p>
      </section>

      <section>
        <h2>좌표 계산 방식</h2>
        <p>
          <strong>문학적 친연성 모드</strong>의 좌표는 관계 그래프(유형별 가중치)와 운동·시대
          태그로부터 시드 고정 구면 force-directed 배치로 계산한다. 같은 데이터와 시드에서는
          항상 같은 좌표가 나오며(결정성 테스트로 보증), 계산된 좌표는 버전과 함께 동결된다
          (현재 v{dataset.positions.version}, seed {dataset.positions.seed}). 새 작가가
          추가되어도 기존 좌표는 재계산하지 않고, 이웃 앵커의 가중 중심으로 증분 배치한다 —
          사용자의 공간 기억을 보존하기 위해서다.{" "}
          <strong>실제 지리 모드</strong>는 작가의 대표 활동지 경위도를 쓰되, 도시가 밀집한
          지역(예: 중부유럽)에서는 겹친 점이 읽히도록 결정적 최소 변위를 적용한다 — 지도학의
          표준적 displacement 관행이며, 정확한 좌표는 데이터 파일에 보존된다. 두 모드의
          분리가 이 지도의 핵심 주장이다: 문학적 거리는 지리적 거리가 아니다.
        </p>
      </section>

      <section>
        <h2>데이터 출처와 검토 상태</h2>
        <p>
          프로필 초안은 LLM(유지관리자 대화형 사용)이 작성하고, 기계 검증(스키마·교차 참조·연도
          논리) → Wikidata 생몰년 교차확인 → 편집 정독 샘플링을 통과한 배치가{" "}
          <strong>{REVIEW_STATUS_KO.reviewed}</strong> 상태가 된다.{" "}
          <strong>{REVIEW_STATUS_KO.verified}</strong>는 외부 검증 절차가 갖춰질 때까지
          부여하지 않는다. 출처는 확인 가능한 기관·문헌만 기록하며, 검증되지 않은 딥 링크는
          기록하지 않는다. 번역 제목은 출판사마다 다를 수 있어 항상 원제를 병기한다.
        </p>
        <table className="dist-table dist-table--wide">
          <tbody>
            {[...dist.review].map(([k, n]) => (
              <tr key={k}>
                <th scope="row">{REVIEW_STATUS_KO[k as keyof typeof REVIEW_STATUS_KO]}</th>
                <td>{n}명</td>
              </tr>
            ))}
            {[...dist.evidence].map(([k, n]) => (
              <tr key={k}>
                <th scope="row">
                  관계: {EVIDENCE_LEVEL_KO[k as keyof typeof EVIDENCE_LEVEL_KO]}
                </th>
                <td>{n}개</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section>
        <h2>분포 — 이 지도의 편중을 숫자로 공개한다</h2>
        <p>
          어떤 정전도 중립적이지 않다. 아래 수치는 이 지도가 현재 무엇을 과대·과소 대표하는지
          보여준다. 편중의 축소는 다음 확장의 명시적 목표다.
        </p>
        <div className="dist-grid">
          <DistTable
            title="지역"
            data={dist.regions}
            labelOf={(k) => regionKo.get(k) ?? k}
            total={authors.length}
          />
          <DistTable
            title="언어"
            data={dist.languages}
            labelOf={(k) => LANGUAGE_LABELS[k] ?? k}
            total={authors.length}
          />
          <DistTable
            title="젠더"
            data={dist.gender}
            labelOf={(k) => GENDER_KO[k as keyof typeof GENDER_KO]}
            total={authors.length}
          />
          <DistTable
            title="장르"
            data={dist.genres}
            labelOf={(k) => genreKo.get(k) ?? k}
            total={authors.length}
          />
          <DistTable
            title="시대층"
            data={dist.periods}
            labelOf={(k) => periodKo.get(k) ?? k}
            total={authors.length}
          />
          <DistTable
            title="관계 유형"
            data={dist.relTypes}
            labelOf={(k) => relKo.get(k) ?? k}
            total={relations.length}
          />
        </div>
      </section>

      <section>
        <h2>변경 기록</h2>
        <ul>
          <li>
            v0.1 (2026-08) — 최초 공개 코퍼스: 작가 {authors.length}명 · 작품 {works.length}
            편 · 관계 {relations.length}개 · 좌표 v{dataset.positions.version}.
          </li>
        </ul>
        <p>
          이 프로젝트는 지식 아틀라스 Noosphere 항성계의 <strong>제1행성</strong>('Booksphere'
          계보)이며, 같은 원칙을 상속한다: <em>담론의 상태를 기록하되, 판정하지 않는다.</em>
        </p>
      </section>
    </main>
  );
}
