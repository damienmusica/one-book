import { useMemo, useState } from "react";
import { useAppState, useContent, useServices, useT } from "./ctx.ts";
import { visibleAuthorIds } from "../lib/filter.ts";
import { searchAuthors } from "../lib/search.ts";
import {
  languageLabel,
  periodShort,
  regionLabel,
  reviewLabel,
  tierLabel
} from "../i18n/index.ts";
import { lifeSpan } from "./bits.tsx";
import { focusAuthor } from "./ctx.ts";

type SortKey = "name" | "anchorYear" | "difficulty" | "tier";

const TIER_ORDER = { anchor: 0, major: 1, context: 2 } as const;

export function WritersPage() {
  const state = useAppState();
  const services = useServices();
  const { dataset, searchIndex, worksByAuthor } = services;
  const t = useT();
  const content = useContent();
  const locale = state.locale;
  const [q, setQ] = useState("");
  const [sort, setSort] = useState<SortKey>("name");
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
          return (
            content.authorName(a).localeCompare(content.authorName(b), locale) * dir
          );
      }
    });
  }, [asc, content, dataset.authors, locale, q, searchIndex, sort, state.filters, state.year, state.yearMode]);

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
        <h1>{t.writersTitle}</h1>
        <p className="writers-note">{t.writersNote(rows.length)}</p>
        <input
          type="search"
          aria-label={t.writersSearchAria}
          placeholder={t.writersSearchPlaceholder}
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
      </div>
      <div className="writers-table-wrap">
        <table className="writers-table">
          <thead>
            <tr>
              {header("name", t.colName)}
              <th scope="col">{t.colOriginal}</th>
              <th scope="col">{t.colLife}</th>
              {header("anchorYear", t.colAnchorYear)}
              <th scope="col">{t.colPeriods}</th>
              <th scope="col">{t.colRegionLang}</th>
              <th scope="col">{t.colWorks}</th>
              {header("difficulty", t.colDifficulty)}
              {header("tier", t.colTier)}
              <th scope="col">{t.colReview}</th>
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
                      {content.authorName(a)}
                    </button>
                  </th>
                  <td className="col-original">{a.names.original}</td>
                  <td>{lifeSpan(a, t)}</td>
                  <td>{a.anchorYear}</td>
                  <td>{a.periods.map((p) => periodShort(p, locale)).join(", ")}</td>
                  <td>
                    {a.regions.map((r) => regionLabel(r, locale)).join(", ")} ·{" "}
                    {a.languages.map((c) => languageLabel(c, locale)).join(", ")}
                  </td>
                  <td className="col-works">
                    {works
                      .slice(0, 3)
                      .map((w) => content.workTitle(w))
                      .join(" · ")}
                  </td>
                  <td>{a.difficulty}</td>
                  <td>{tierLabel(a.tier, locale)}</td>
                  <td className="col-review">
                    {reviewLabel(a.reviewStatus, locale).split(" ")[0]}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {rows.length === 0 && <p className="empty-note">{t.noRows}</p>}
      </div>
    </main>
  );
}
