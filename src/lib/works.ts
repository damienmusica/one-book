import type { Author, Work } from "../types.ts";

/**
 * The editorially selected works for an author, in curated order.
 *
 * `author.readingOrder` is the explicit editorial ranking (entry work first —
 * the schema requires readingOrder[0] === readingEntry). Works outside it
 * follow in publication order. Display code must never take the raw works
 * array head as "major works": file order is by year, which drops
 * late-published masterpieces (Bulgakov's The Master and Margarita, 1966,
 * sits behind three 1920s works).
 */
export function majorWorksOf(author: Author, authorWorks: Work[], limit?: number): Work[] {
  const byId = new Map(authorWorks.map((w) => [w.id, w]));
  const curated = author.readingOrder
    .map((id) => byId.get(id))
    .filter((w): w is Work => w !== undefined);
  const inCurated = new Set(curated.map((w) => w.id));
  const rest = authorWorks.filter((w) => !inCurated.has(w.id));
  const all = [...curated, ...rest];
  return limit === undefined ? all : all.slice(0, limit);
}
