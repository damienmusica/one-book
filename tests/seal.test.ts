import { describe, expect, it } from "vitest";
import { firstGrapheme, sealGlyph } from "../src/lib/seal.ts";

describe("sealGlyph", () => {
  it("takes the surname initial for surname-last names", () => {
    expect(sealGlyph("franz-kafka", "Franz Kafka")).toBe("K");
    expect(sealGlyph("ts-eliot", "T. S. Eliot")).toBe("E");
    expect(sealGlyph("simone-de-beauvoir", "Simone de Beauvoir")).toBe("B");
  });

  it("uppercases Cyrillic and Greek surnames", () => {
    expect(sealGlyph("anna-akhmatova", "Анна Ахматова")).toBe("А");
    expect(sealGlyph("fyodor-dostoevsky", "Фёдор Достоевский")).toBe("Д");
  });

  it("takes the first character for East Asian surname-first names", () => {
    expect(sealGlyph("yasunari-kawabata", "川端康成")).toBe("川");
    expect(sealGlyph("lu-xun", "魯迅")).toBe("魯");
    expect(sealGlyph("park-kyung-ni", "朴景利")).toBe("朴");
    expect(sealGlyph("yi-sang", "李箱")).toBe("李");
  });

  it("keeps whole grapheme clusters for Indic scripts", () => {
    // Bengali: Tagore's ঠাকুর starts with the cluster ঠা, not the bare ঠ
    expect(sealGlyph("rabindranath-tagore", "রবীন্দ্রনাথ ঠাকুর")).toBe("ঠা");
    expect(sealGlyph("premchand", "प्रेमचंद")).toBe("प्रे");
  });

  it("takes the family name (last logical token) for RTL names", () => {
    expect(sealGlyph("naguib-mahfouz", "نجيب محفوظ")).toBe("م");
    expect(sealGlyph("sadegh-hedayat", "صادق هدایت")).toBe("ه");
  });

  it("applies citation-convention overrides", () => {
    expect(sealGlyph("gabriel-garcia-marquez", "Gabriel García Márquez")).toBe("G");
    expect(sealGlyph("machado-de-assis", "Machado de Assis")).toBe("M");
    expect(sealGlyph("ursula-k-le-guin", "Ursula K. Le Guin")).toBe("L");
    // no override → plain rule
    expect(sealGlyph("federico-garcia-lorca", "Federico García Lorca")).toBe("L");
  });

  it("handles mononyms and empty input", () => {
    expect(sealGlyph("colette", "Colette")).toBe("C");
    expect(sealGlyph("x", "   ")).toBe("·");
  });
});

describe("firstGrapheme", () => {
  it("returns full clusters, not code units", () => {
    expect(firstGrapheme("Ахматова")).toBe("А");
    expect(firstGrapheme("ঠাকুর")).toBe("ঠা");
    expect(firstGrapheme("")).toBe("");
  });
});

describe("seal carving (D9 v2)", async () => {
  const { sealCarve, SEAL_SIZE } = await import("../src/globe/seal-texture.ts");

  it("is deterministic per author key and distinct across keys", () => {
    const a1 = sealCarve("franz-kafka");
    const a2 = sealCarve("franz-kafka");
    expect(a1).toEqual(a2);
    const b = sealCarve("james-joyce");
    expect(JSON.stringify(b)).not.toBe(JSON.stringify(a1));
  });

  it("keeps the stamping rotation within ±2.2 degrees", () => {
    for (const key of ["a", "b", "c", "kim-souwol", "toni-morrison"]) {
      const deg = (sealCarve(key).rotation * 180) / Math.PI;
      expect(Math.abs(deg)).toBeLessThanOrEqual(2.2 + 1e-9);
    }
  });

  it("punches nicks only along the face border band", () => {
    const inset = 30;
    for (const key of ["x", "y", "z"]) {
      const { nicks } = sealCarve(key);
      expect(nicks.length).toBeGreaterThanOrEqual(10);
      expect(nicks.length).toBeLessThanOrEqual(16);
      for (const n of nicks) {
        expect(n.r).toBeGreaterThanOrEqual(1.2);
        expect(n.r).toBeLessThanOrEqual(4.6);
        // center sits within jitter distance of the face perimeter rectangle
        const dLeft = Math.abs(n.x - inset);
        const dRight = Math.abs(n.x - (SEAL_SIZE - inset));
        const dTop = Math.abs(n.y - inset);
        const dBottom = Math.abs(n.y - (SEAL_SIZE - inset));
        expect(Math.min(dLeft, dRight, dTop, dBottom)).toBeLessThanOrEqual(2 + 1e-9);
      }
    }
  });
});
