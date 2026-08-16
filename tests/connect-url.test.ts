// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { Store } from "../src/state/store.ts";
import { connectUrl } from "../src/state/url.ts";

const valid = {
  authorIds: new Set(["marcel-proust", "franz-kafka"]),
  tourIds: new Set<string>()
};

/** simulate a user navigation: link click / back button */
function goTo(hash: string) {
  window.history.replaceState(null, "", hash);
  window.dispatchEvent(new HashChangeEvent("hashchange"));
}

async function frame() {
  await new Promise((r) => requestAnimationFrame(() => r(null)));
}

describe("connectUrl", () => {
  it("applies a map-link click even when the hash matches the last store-written URL", async () => {
    // real-use repro (2026-08-16 feedback): select author → methodology →
    // click 지도 → URL changed but the body stayed on methodology. Cause: the
    // hashchange handler skipped hashes equal to the last store-written URL,
    // but replaceState never fires hashchange, so the guard could only ever
    // suppress genuine user navigations.
    window.history.replaceState(null, "", "#/");
    const store = new Store();
    const off = connectUrl(store, valid);

    // 1. store-initiated selection writes the URL (this poisoned the old guard)
    store.selectAuthor("marcel-proust", { openPanel: true });
    await frame();
    await frame();
    expect(window.location.hash).toBe("#/?a=marcel-proust");

    // 2. user clicks the methodology nav link (pageHref carries state along)
    goTo("#/methodology?a=marcel-proust");
    expect(store.getState().page).toBe("methodology");

    // 3. user clicks the map nav link — exactly the hash the store last wrote
    goTo("#/?a=marcel-proust");
    expect(store.getState().page).toBe("globe");
    expect(store.getState().selectedAuthorId).toBe("marcel-proust");

    off();
  });

  it("round-trips page switches repeatedly without desyncing", async () => {
    window.history.replaceState(null, "", "#/?a=franz-kafka");
    const store = new Store();
    const off = connectUrl(store, valid);
    expect(store.getState().selectedAuthorId).toBe("franz-kafka");

    for (let i = 0; i < 3; i++) {
      goTo("#/writers?a=franz-kafka");
      expect(store.getState().page).toBe("writers");
      goTo("#/?a=franz-kafka");
      expect(store.getState().page).toBe("globe");
      expect(store.getState().selectedAuthorId).toBe("franz-kafka");
    }
    off();
  });
});
