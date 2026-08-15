import { useMemo, useState } from "react";
import { useAppState, useServices } from "./ctx.ts";
import { visibleAuthorIds } from "../lib/filter.ts";
import { searchAuthors } from "../lib/search.ts";
import { PERIOD_DEFS, REVIEW_STATUS_KO } from "../types.ts";
import { languageLabel, lifeSpan, regionLabel } from "./bits.tsx";
import { focusAuthor } from "./ctx.ts";

type SortKey = "ko" | "anchorYear" | "difficulty" | "tier";

const periodKo = new Map(PERIOD_DEFS.map((p) => [p.id, p.ko.split(" ")[0] ?? p.id]));
const TIER_ORDER = { anchor: 0, major: 1, context: 2 } as const;
const TIER_KO = { anchor: "앵커", major: "주요", context: "맥락" } as const;

export function WritersPage() {
  const state = useAppState();
  const services = useServices();
  const { dataset, searchIndex, worksByAuthor } = services;
  const [q, setQ] = useState("");
  const [sort, setSort] = useState<SortKey>("ko");
  const [asc, setAsc] = useState(true);

  const rows = useMemo(() => {
    const visible = visibleAuthorIds(dataset.authors, state.filters, state.year, state.yearMode);
    let list = dataset.authors.filter((a) => visible.has(a.id));
    if (q.trim()) {
      const hitIds = new Set(searchAuthors(searchIndex, q, 200).map((h) => h.author.id));
      list = list.filter((a) => hitIds.has(a.id));
    }
    const dir = asc ? 1 : -1;
    return [...list].sort((a, b) => {
      switch (sort) {
        case "anchorYear":
          return (a.anchorYear - b.anchorYear) * dir;
        case "difficulty":
          return (a.difficulty - b.difficulty) * dir;
        case "tier":
          return (TIER_ORDER[a.tier] - TIER_ORDER[b.tier]) * dir;
        default:
          return a.names.ko.localeCompare(b.names.ko, "ko") * dir;
      }
    });
  }, [asc, dataset.authors, q, searchIndex, sort, state.filters, state.year, state.yearMode]);

  function header(key: SortKey, label: string) {
    const active = sort === key;
    return (
      <th scope="col" aria-sort={active ? (asc ? "ascending" : "descending") : "none"}>
        <button
          type="button"
          className="sort-btn"
          onClick={() => {
            if (active) setAsc(!asc);
            else {
              setSort(key);
              setAsc(true);
            }
          }}
        >
          {label}
          {active ? (asc ? " ↑" : " ↓") : ""}
        </button>
      </th>
    );
  }

  return (
    <main className="writers-page">
      <div className="writers-tools">
        <h1>작가 목록</h1>
        <p className="writers-note">
          지도의 필터가 이 목록에도 적용됩니다. 현재 {rows.length}명 표시 중. 행을 선택하면
          지도의 해당 위치로 이동합니다.
        </p>
        <input
          type="search"
          aria-label="목록에서 작가 검색"
          placeholder="이름·표기 검색"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
      </div>
      <div className="writers-table-wrap">
        <table className="writers-table">
          <thead>
            <tr>
              {header("ko", "이름")}
              <th scope="col">원어 표기</th>
              <th scope="col">생몰</th>
              {header("anchorYear", "중심 연도")}
              <th scope="col">시대층</th>
              <th scope="col">지역 · 언어</th>
              <th scope="col">대표작</th>
              {header("difficulty", "난도")}
              {header("tier", "구분")}
              <th scope="col">검토</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((a) => {
              const works = worksByAuthor.get(a.id) ?? [];
              return (
                <tr key={a.id}>
                  <th scope="row">
                    <button
                      type="button"
                      className="author-link"
                      onClick={() => focusAuthor(services, a.id)}
                    >
                      {a.names.ko}
                    </button>
                  </th>
                  <td className="col-original">{a.names.original}</td>
                  <td>{lifeSpan(a)}</td>
                  <td>{a.anchorYear}</td>
                  <td>{a.periods.map((p) => periodKo.get(p)).join(", ")}</td>
                  <td>
                    {a.regions.map(regionLabel).join(", ")} ·{" "}
                    {a.languages.map(languageLabel).join(", ")}
                  </td>
                  <td className="col-works">
                    {works
                      .slice(0, 3)
                      .map((w) => w.titleKo)
                      .join(" · ")}
                  </td>
                  <td>{a.difficulty}</td>
                  <td>{TIER_KO[a.tier]}</td>
                  <td className="col-review">{REVIEW_STATUS_KO[a.reviewStatus].split(" ")[0]}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {rows.length === 0 && (
          <p className="empty-note">
            조건에 맞는 작가가 없습니다. 필터를 완화하거나 검색어를 바꿔 보세요.
          </p>
        )}
      </div>
    </main>
  );
}
