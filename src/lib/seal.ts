// Ex libris seal glyphs — each author's mark is the first grapheme of the
// surname they are conventionally cited by, in the original script. Derived
// from data (names.original), not curated per author; the override map exists
// only where citation convention and token order disagree.

// East Asian scripts write the family name first, so the seal is the first
// grapheme of the whole name. Everything else takes the last space-separated
// token (surname-last convention), which also handles RTL scripts correctly
// (logical order puts the family name last for Arabic/Persian/Urdu names here).
const EAST_ASIAN_FIRST =
  /^[⺀-⻿　-〿぀-ヿㇰ-ㇿ㐀-䶿一-鿿가-힯豈-﫿]/;

/** authorId → glyph, only where the cited surname is not the last token */
export const SEAL_OVERRIDES: Record<string, string> = {
  "machado-de-assis": "M", // cited as Machado, not Assis
  "gabriel-garcia-marquez": "G", // García Márquez — first surname carries
  "joao-guimaraes-rosa": "G", // Guimarães Rosa
  "ngugi-wa-thiongo": "N", // cited as Ngũgĩ
  "ursula-k-le-guin": "L" // Le Guin — the particle is part of the surname
};

const segmenter =
  typeof Intl !== "undefined" && "Segmenter" in Intl
    ? new Intl.Segmenter("und", { granularity: "grapheme" })
    : null;

/** First user-perceived character (grapheme cluster), e.g. Bengali ঠাকুর → ঠা. */
export function firstGrapheme(s: string): string {
  if (segmenter) {
    for (const g of segmenter.segment(s)) return g.segment;
    return "";
  }
  return [...s][0] ?? "";
}

export function sealGlyph(authorId: string, originalName: string): string {
  const override = SEAL_OVERRIDES[authorId];
  if (override) return override;
  const name = originalName.trim().replace(/\s+/g, " ");
  if (name === "") return "·";
  if (EAST_ASIAN_FIRST.test(name)) return firstGrapheme(name);
  const tokens = name.split(" ");
  return firstGrapheme(tokens[tokens.length - 1]!).toLocaleUpperCase();
}
