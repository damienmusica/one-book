import type { Author } from "../types.ts";

export interface SearchHit {
  author: Author;
  /** which name form matched, for result display */
  matched: string;
  score: number;
}

/** lowercase, NFC, strip spaces/dots/middle dots so "ts엘리엇", "T.S. Eliot" both match */
export function normalizeQuery(s: string): string {
  return s
    .normalize("NFC")
    .toLowerCase()
    .replace(/[\s.·'’ʼ-]/g, "");
}

interface IndexEntry {
  author: Author;
  forms: Array<{ raw: string; norm: string }>;
}

export function buildSearchIndex(authors: Author[]): IndexEntry[] {
  return authors.map((author) => ({
    author,
    forms: [author.names.ko, author.names.original, ...author.names.aliases].map((raw) => ({
      raw,
      norm: normalizeQuery(raw)
    }))
  }));
}

export function searchAuthors(index: IndexEntry[], query: string, limit = 12): SearchHit[] {
  const q = normalizeQuery(query);
  if (q.length === 0) return [];
  const hits: SearchHit[] = [];
  for (const entry of index) {
    let best: SearchHit | null = null;
    for (let i = 0; i < entry.forms.length; i++) {
      const form = entry.forms[i];
      if (!form) continue;
      const idx = form.norm.indexOf(q);
      if (idx < 0) continue;
      // prefix beats substring; earlier forms (ko, original) beat aliases;
      // shorter forms beat longer ones at equal position
      const score =
        (idx === 0 ? 1000 : 500) - i * 10 - idx * 2 - form.norm.length * 0.1;
      if (!best || score > best.score) {
        best = { author: entry.author, matched: form.raw, score };
      }
    }
    if (best) hits.push(best);
  }
  hits.sort(
    (a, b) => b.score - a.score || a.author.names.ko.localeCompare(b.author.names.ko, "ko")
  );
  return hits.slice(0, limit);
}
