import { useEffect, useId, useRef, useState } from "react";
import { focusAuthor, useServices } from "./ctx.ts";
import { searchAuthors, type SearchHit } from "../lib/search.ts";

export function SearchBox() {
  const services = useServices();
  const [query, setQuery] = useState("");
  const [hits, setHits] = useState<SearchHit[]>([]);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const listId = useId();
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const results = query.trim() ? searchAuthors(services.searchIndex, query) : [];
    setHits(results);
    setOpen(results.length > 0);
    setActive(0);
  }, [query, services.searchIndex]);

  useEffect(() => {
    const onDocDown = (e: PointerEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", onDocDown);
    return () => document.removeEventListener("pointerdown", onDocDown);
  }, []);

  function choose(hit: SearchHit): void {
    setQuery("");
    setOpen(false);
    focusAuthor(services, hit.author.id);
  }

  function onKeyDown(e: React.KeyboardEvent): void {
    // Korean IME: the keystroke that commits a composition must not select
    if ((e.nativeEvent as KeyboardEvent).isComposing || e.keyCode === 229) return;
    if (!open) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive((a) => Math.min(a + 1, hits.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((a) => Math.max(a - 1, 0));
    } else if (e.key === "Enter" || e.key === "Return" || e.keyCode === 13) {
      e.preventDefault();
      const hit = hits[active];
      if (hit) choose(hit);
    } else if (e.key === "Escape") {
      setOpen(false);
    }
  }

  return (
    <div className="searchbox" ref={rootRef}>
      <input
        type="search"
        role="combobox"
        aria-expanded={open}
        aria-controls={listId}
        aria-activedescendant={open && hits[active] ? `${listId}-${active}` : undefined}
        aria-label="작가 검색 — 한국어·원어·다른 표기 지원"
        placeholder="작가 검색 (한국어·원어)"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        onKeyDown={onKeyDown}
        onFocus={() => hits.length > 0 && setOpen(true)}
      />
      {open && (
        <ul className="search-results" role="listbox" id={listId} aria-label="검색 결과">
          {hits.map((hit, i) => (
            <li
              key={hit.author.id}
              id={`${listId}-${i}`}
              role="option"
              aria-selected={i === active}
              className={i === active ? "is-active" : ""}
              onPointerDown={(e) => {
                e.preventDefault();
                choose(hit);
              }}
              onPointerEnter={() => setActive(i)}
            >
              <span className="hit-ko">{hit.author.names.ko}</span>
              <span className="hit-original">{hit.author.names.original}</span>
              {hit.matched !== hit.author.names.ko &&
                hit.matched !== hit.author.names.original && (
                  <span className="hit-alias">{hit.matched}</span>
                )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
