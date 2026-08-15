import { useEffect, useRef, useState } from "react";
import { useServices } from "./ctx.ts";
import { createGlobe } from "../globe/renderer.ts";
import { geoPositions, semanticPositions } from "../data/load.ts";

function detectWebGL(): boolean {
  try {
    const canvas = document.createElement("canvas");
    return Boolean(
      canvas.getContext("webgl2") ?? canvas.getContext("webgl")
    );
  } catch {
    return false;
  }
}

export function GlobeView() {
  const services = useServices();
  const ref = useRef<HTMLDivElement>(null);
  const [webglOk] = useState(detectWebGL);

  useEffect(() => {
    const el = ref.current;
    if (!webglOk || !el) return;
    const { dataset, store } = services;
    const sem = semanticPositions(dataset);
    const geo = geoPositions(dataset);
    // dev fallback before the layout freeze exists: geography stands in
    const semOrGeo = sem.size > 0 ? sem : geo;
    const handle = createGlobe(el, dataset, semOrGeo, geo, store, {
      onSelect: (id) => store.selectAuthor(id),
      onHover: (id) => store.set({ hoveredAuthorId: id }),
      onRelationPick: (rel) => store.set({ pickedRelationId: rel.id })
    });
    services.globeRef.current = handle;
    return () => {
      services.globeRef.current = null;
      handle.dispose();
    };
  }, [services, webglOk]);

  if (!webglOk) {
    return (
      <div className="globe-fallback">
        <h2>3차원 지도를 사용할 수 없는 환경입니다</h2>
        <p>
          이 브라우저에서는 WebGL을 사용할 수 없습니다. 모든 작가와 관계는{" "}
          <a href="#/writers">작가 목록</a>에서 동일하게 탐색할 수 있습니다.
        </p>
      </div>
    );
  }

  return (
    <div
      className="globe-container"
      ref={ref}
      role="application"
      aria-label="문학의 행성 3차원 지도. 드래그로 회전, 휠·핀치로 확대. 키보드 탐색은 작가 목록 페이지를 이용하세요."
    />
  );
}
