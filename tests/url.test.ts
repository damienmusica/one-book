import { describe, expect, it } from "vitest";
import { parseHash, serializeState } from "../src/state/url.ts";
import { initialState } from "../src/state/store.ts";
import type { AppState } from "../src/state/store.ts";

const valid = {
  authorIds: new Set(["franz-kafka", "jorge-luis-borges"]),
  tourIds: new Set(["kafka-constellation"])
};

function roundTrip(patch: Partial<AppState>): Partial<AppState> {
  const state = { ...initialState(), ...patch };
  return parseHash(serializeState(state), valid);
}

describe("url state", () => {
  it("default state serializes to bare #/", () => {
    expect(serializeState(initialState())).toBe("#/");
  });

  it("round-trips author, mode, year, filters, tour", () => {
    const out = roundTrip({
      selectedAuthorId: "franz-kafka",
      mode: "geo",
      year: 1968,
      yearMode: "active",
      filters: {
        ...initialState().filters,
        periods: ["early-modernism", "mid-century"],
        relationTypes: ["documented_influence"],
        regions: ["east-asia"],
        speculativeOnly: true
      },
      tourId: "kafka-constellation",
      tourStop: 2
    });
    expect(out.selectedAuthorId).toBe("franz-kafka");
    expect(out.mode).toBe("geo");
    expect(out.year).toBe(1968);
    expect(out.yearMode).toBe("active");
    expect(out.filters?.periods).toEqual(["early-modernism", "mid-century"]);
    expect(out.filters?.relationTypes).toEqual(["documented_influence"]);
    expect(out.filters?.regions).toEqual(["east-asia"]);
    expect(out.filters?.speculativeOnly).toBe(true);
    expect(out.tourId).toBe("kafka-constellation");
    expect(out.tourStop).toBe(2);
  });

  it("drops unknown author and tour ids", () => {
    const out = parseHash("#/?a=nobody&t=fake-tour", valid);
    expect(out.selectedAuthorId).toBeNull();
    expect(out.tourId).toBeNull();
  });

  it("routes pages", () => {
    expect(parseHash("#/writers", valid).page).toBe("writers");
    expect(parseHash("#/methodology", valid).page).toBe("methodology");
    expect(parseHash("#/", valid).page).toBe("globe");
    expect(parseHash("", valid).page).toBe("globe");
  });

  it("clamps out-of-range years", () => {
    expect(parseHash("#/?y=1700", valid).year).toBe(1850);
    expect(parseHash("#/?y=abcd", valid).year).toBe(2026);
  });

  it("ignores unknown filter values", () => {
    const out = parseHash("#/?p=roots,fake-period", valid);
    expect(out.filters?.periods).toEqual(["roots"]);
  });
});
