import { useMemo } from "react";
import { useAppState, useServices } from "./ctx.ts";
import { GENRE_DEFS, PERIOD_DEFS, REGION_DEFS, RELATION_DEFS } from "../types.ts";
import {
  evidenceLabel,
  genderLabel,
  genreLabel,
  languageLabel,
  periodDesc,
  periodLabel,
  regionLabel,
  relationTypeDesc,
  relationTypeLabel,
  reviewLabel
} from "../i18n/index.ts";
import { METHODOLOGY } from "../i18n/methodology.ts";
import type { EvidenceLevel, ReviewStatus } from "../types.ts";

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
  const { locale } = useAppState();
  const m = METHODOLOGY[locale];
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

  const genreKo = new Map<string, string>(GENRE_DEFS.map((g) => [g.id, genreLabel(g.id, locale)]));
  const periodKo = new Map<string, string>(
    PERIOD_DEFS.map((p) => [p.id, periodLabel(p.id, locale)])
  );
  const regionKo = new Map<string, string>(
    REGION_DEFS.map((r) => [r.id, regionLabel(r.id, locale)])
  );
  const relKo = new Map<string, string>(
    RELATION_DEFS.map((r) => [r.id, relationTypeLabel(r.id, locale)])
  );

  return (
    <main className="methodology-page">
      <h1>{m.title}</h1>
      <p className="method-lede">
        {m.lede.pre(authors.length, works.length, relations.length)}
        <strong>{m.lede.strong}</strong>
        {m.lede.post}
      </p>

      <section>
        <h2>{m.eraHead}</h2>
        <p>{m.eraBody}</p>
        <ul>
          {PERIOD_DEFS.map((p) => (
            <li key={p.id}>
              <strong>{periodLabel(p.id, locale)}</strong> — {periodDesc(p.id, locale)}
            </li>
          ))}
        </ul>
      </section>

      <section>
        <h2>{m.selHead}</h2>
        <ol>
          {m.selItems.map((item, i) => (
            <li key={i}>{item}</li>
          ))}
        </ol>
        <p>{m.selClose}</p>
      </section>

      <section>
        <h2>{m.relHead}</h2>
        <p>
          {m.relBody.pre}
          <strong>{m.relBody.strong}</strong>
        </p>
        <ul>
          {RELATION_DEFS.map((r) => (
            <li key={r.id}>
              <strong>{relationTypeLabel(r.id, locale)}</strong> —{" "}
              {relationTypeDesc(r.id, locale)}
            </li>
          ))}
        </ul>
        <p>
          {m.relClose.pre}
          <strong>{evidenceLabel("editorial_inference", locale)}</strong>
          {m.relClose.post}
        </p>
      </section>

      <section>
        <h2>{m.coordHead}</h2>
        <p>
          <strong>{m.coord.semStrong}</strong>
          {m.coord.semBody(dataset.positions.version, dataset.positions.seed)}
          <strong>{m.coord.geoStrong}</strong>
          {m.coord.geoBody}
        </p>
        <p>
          <strong>{m.coord.terrainStrong}</strong>
          {m.coord.terrainBody}
        </p>
      </section>

      <section>
        <h2>{m.srcHead}</h2>
        <p>
          {m.srcBody.pre}
          <strong>{reviewLabel("reviewed", locale)}</strong>
          {m.srcBody.mid1}
          <strong>{reviewLabel("verified", locale)}</strong>
          {m.srcBody.mid2}
          {m.srcBody.post}
        </p>
        <table className="dist-table dist-table--wide">
          <tbody>
            {[...dist.review].map(([k, n]) => (
              <tr key={k}>
                <th scope="row">{reviewLabel(k as ReviewStatus, locale)}</th>
                <td>{m.countAuthors(n)}</td>
              </tr>
            ))}
            {[...dist.evidence].map(([k, n]) => (
              <tr key={k}>
                <th scope="row">
                  {m.relRowPrefix}
                  {evidenceLabel(k as EvidenceLevel, locale)}
                </th>
                <td>{m.countRels(n)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section>
        <h2>{m.distHead}</h2>
        <p>{m.distBody}</p>
        <div className="dist-grid">
          <DistTable
            title={m.distTitles.regions}
            data={dist.regions}
            labelOf={(k) => regionKo.get(k) ?? k}
            total={authors.length}
          />
          <DistTable
            title={m.distTitles.languages}
            data={dist.languages}
            labelOf={(k) => languageLabel(k, locale)}
            total={authors.length}
          />
          <DistTable
            title={m.distTitles.gender}
            data={dist.gender}
            labelOf={(k) => genderLabel(k as "female" | "male" | "other" | "unknown", locale)}
            total={authors.length}
          />
          <DistTable
            title={m.distTitles.genres}
            data={dist.genres}
            labelOf={(k) => genreKo.get(k) ?? k}
            total={authors.length}
          />
          <DistTable
            title={m.distTitles.periods}
            data={dist.periods}
            labelOf={(k) => periodKo.get(k) ?? k}
            total={authors.length}
          />
          <DistTable
            title={m.distTitles.relTypes}
            data={dist.relTypes}
            labelOf={(k) => relKo.get(k) ?? k}
            total={relations.length}
          />
        </div>
      </section>

      <section>
        <h2>{m.logHead}</h2>
        <ul>
          <li>
            {m.logV01(authors.length, works.length, relations.length, dataset.positions.version)}
          </li>
        </ul>
        <p>
          {m.closing.pre}
          <strong>{m.closing.strong}</strong>
          {m.closing.mid}
          <em>{m.closing.em}</em>
        </p>
      </section>
    </main>
  );
}
