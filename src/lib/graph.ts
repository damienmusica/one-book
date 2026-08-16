import type { Relation } from "../types.ts";

export interface Adjacency {
  /** author id → relations touching it */
  byAuthor: Map<string, Relation[]>;
}

export function buildAdjacency(relations: Relation[]): Adjacency {
  const byAuthor = new Map<string, Relation[]>();
  for (const r of relations) {
    for (const id of [r.sourceId, r.targetId]) {
      const list = byAuthor.get(id) ?? [];
      list.push(r);
      byAuthor.set(id, list);
    }
  }
  return { byAuthor };
}

export function neighborsOf(adj: Adjacency, id: string): Array<{ otherId: string; relation: Relation }> {
  const rels = adj.byAuthor.get(id) ?? [];
  return rels
    .map((relation) => ({
      otherId: relation.sourceId === id ? relation.targetId : relation.sourceId,
      relation
    }))
    .sort((a, b) => b.relation.weight - a.relation.weight);
}

export interface PathHop {
  fromId: string;
  toId: string;
  relation: Relation;
  /**
   * How the traversal runs relative to the relation's canonical
   * source→target direction. Rendering must derive arrows from this plus
   * `relation.direction` — never from traversal order alone, or a hop walked
   * against a directed edge shows the influence reversed.
   */
  along: "forward" | "backward";
}

/** Resolve a BFS path (which is undirected) into hops that keep each relation's canonical direction. */
export function pathHops(path: Relation[], fromId: string): PathHop[] {
  let cur = fromId;
  return path.map((relation) => {
    const along = relation.sourceId === cur ? "forward" : "backward";
    const toId = along === "forward" ? relation.targetId : relation.sourceId;
    const hop: PathHop = { fromId: cur, toId, relation, along };
    cur = toId;
    return hop;
  });
}

/**
 * Shortest relation path between two authors (undirected BFS).
 * Returns the sequence of relations, or null when no path exists.
 */
export function shortestPath(adj: Adjacency, fromId: string, toId: string): Relation[] | null {
  if (fromId === toId) return [];
  const prev = new Map<string, { via: Relation; from: string }>();
  const visited = new Set<string>([fromId]);
  let frontier = [fromId];
  while (frontier.length > 0) {
    const next: string[] = [];
    for (const id of frontier) {
      for (const { otherId, relation } of neighborsOf(adj, id)) {
        if (visited.has(otherId)) continue;
        visited.add(otherId);
        prev.set(otherId, { via: relation, from: id });
        if (otherId === toId) {
          const path: Relation[] = [];
          let cur = toId;
          while (cur !== fromId) {
            const step = prev.get(cur);
            if (!step) return null;
            path.unshift(step.via);
            cur = step.from;
          }
          return path;
        }
        next.push(otherId);
      }
    }
    frontier = next;
  }
  return null;
}
