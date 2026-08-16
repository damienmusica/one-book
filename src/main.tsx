import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { loadDataset } from "./data/load.ts";
import { Store } from "./state/store.ts";
import { connectUrl } from "./state/url.ts";
import { attachQAHandle, connectInstrumentation, instr } from "./lib/instrument.ts";
import { AppCtx, buildServices } from "./components/ctx.ts";
import { App } from "./components/App.tsx";
import { ErrorBoundary } from "./components/ErrorBoundary.tsx";
import "./styles.css";

const rootEl = document.getElementById("root");
if (!rootEl) throw new Error("#root missing");
const root = createRoot(rootEl);

try {
  const dataset = loadDataset();
  const store = new Store();

  const rm = window.matchMedia("(prefers-reduced-motion: reduce)");
  store.set({ reducedMotion: rm.matches });
  rm.addEventListener("change", (e) => store.set({ reducedMotion: e.matches }));

  connectUrl(store, {
    authorIds: new Set(dataset.authors.map((a) => a.id)),
    tourIds: new Set(dataset.tours.map((t) => t.id))
  });

  // instrumentation is always recording (bounded rings); the overlay and the
  // QA harness are just two readers of the same data
  connectInstrumentation(store);
  attachQAHandle(store, dataset);
  if (new URLSearchParams(window.location.search).has("debug")) instr.setOverlay(true);

  const services = buildServices(store, dataset);
  root.render(
    <StrictMode>
      <ErrorBoundary>
        <AppCtx.Provider value={services}>
          <App />
        </AppCtx.Provider>
      </ErrorBoundary>
    </StrictMode>
  );
} catch (err) {
  root.render(
    <div className="fatal-error" role="alert">
      <h1>문학의 행성</h1>
      <p>데이터를 불러오는 중 문제가 발생했습니다. 아래 내용을 개발자에게 전달해 주세요.</p>
      <pre>{String(err)}</pre>
    </div>
  );
}
