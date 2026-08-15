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
