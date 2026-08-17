# Art-direction pass R10 — visual target slice (2026-08-18)

The functional Kafka slice (1d00a28) is approved and FROZEN. This pass replaces
placeholder representation — imagined portraits, initial seals, the circular
reticle, relation lines, work buildings — with a coherent visual grammar built
from rights-verified archival material and world-class map/archive/editorial
references. Data, features, regressions (20 scenes) and performance budgets are
preserved; representation may be boldly replaced.

## Slice

Three authors, three scripts, full far/mid/near coverage:

| author | sphere | script | died | PD basis |
|---|---|---|---|---|
| franz-kafka | central-europe | Latin (German) | 1924 | life+70 expired 1995 |
| natsume-soseki | east-asia | Kanji/Kana | 1916 | life+70 expired 1987 |
| rabindranath-tagore | south-asia | Bengali | 1941 | life+70 expired 2012 (India life+60 → 2002) |

## Method (ordered, per CPO directive)

1. **Research first** — real portraits/signatures/manuscripts/first editions
   with verified rights + provenance (this file's ledger); strong game-map /
   cultural-archive / editorial-design references observed directly.
   Pinterest/ArtStation: discovery only, never evidence.
2. **Directions before implementation** — ≥2 direction theses, each with
   static keyframes (far/mid/near) and a motion storyboard; panel review;
   ONE winner; discarded directions recorded below with reasons.
3. **Implement the winner** on the slice only, preserving function/perf.
4. **Blind A/B** — unlabeled current-vs-new captures to fresh reviewers.
5. Ship: provenance ledger, discarded directions, rationale, captures,
   reproducible review bundle.

## Grammar principle

Every shape, color, height and motion must express a stated piece of
information or an interaction state. Anything that expresses nothing is
removed. (Extends design-thesis §⑥; the knowledge contract — sources,
evidence levels, direction, uncertainty — is never weakened by styling.)

## Asset provenance ledger

<!-- one row per asset ingested; no asset enters the build without a row -->

| asset | author | source (collection) | file/page URL | license basis | pixel size |
|---|---|---|---|---|---|
| kafka-portrait-1906-atelier-jacobi.jpg | franz-kafka | Wikimedia Commons (photographer: Atelier Jacobi / Sigismund Jacobi, 1860-1935) | https://commons.wikimedia.org/wiki/File:Kafka1906.jpg | PD-old-auto-expired (deathyear=1935) | 494x794 |
| kafka-portrait-1923-last-photo.jpg | franz-kafka | Wikimedia Commons (photographer unknown; cited from Klaus Wagenbach, Kafka Bildarchiv, Morgan Library exhibition, Reiner Stach) | https://commons.wikimedia.org/wiki/File:Franz_Kafka,_1923.jpg | PD-two (PD-EU-no author disclosure + PD-1996) | 1992x2656 |
| kafka-signature.svg | franz-kafka | Wikimedia Commons (vector traced by user Jon C from a GIF sourced via projekt-gutenberg.org, c. 1913 signature) | https://commons.wikimedia.org/wiki/File:Franz_Kafka%27s_signature.svg | PD-signature (DE) | 418x118 (vector SVG, 9 KB) |
| kafka-notebook-manuscript-1922.jpg | franz-kafka | National Library of Israel, Givat Ram, Jerusalem (Vessel to Vessel digital gallery) | https://commons.wikimedia.org/wiki/File:Kafka%27s_notebook.JPG | PD-old (generic) | 3959x2489 |
| kafka-die-verwandlung-1915-firstedition-cover.jpg | franz-kafka | Antiquariat Dr. Haack Leipzig -> private Vienna collection (photographed by H.-P. Haack) | https://commons.wikimedia.org/wiki/File:Franz_Kafka_Die_Verwandlung_1916_Orig.-Pappband.jpg | CC-BY-3.0 | 920x1480 |
| 01_portrait_natsume_souseki_1912.jpg | natsume-soseki | Wikimedia Commons, reproduced from National Diet Library digitized volume 'Soseki Zenshu, Vol. 8' (漱石全集. 第8巻, 1929) | https://commons.wikimedia.org/wiki/File:Natsume_Souseki.jpg | PD (Public Domain, Japan + US) | 1024x1396 |
| 02_calligraphy_seal_natsume_souseki.jpg | natsume-soseki | Wikimedia Commons (privately owned original; photographic reproduction uploaded to Commons) | https://commons.wikimedia.org/wiki/File:Calligraphy_of_Natsume_Souseki.jpg | PD (Public Domain, Japan + US) | 320x1089 |
| 03_manuscript_i_am_a_cat.jpg | natsume-soseki | Wikimedia Commons, reproduced from National Diet Library Digital Collections — 1936 'Soseki Zenshu' (漱石全集) published by Soseki Zenshu Kankokai | https://commons.wikimedia.org/wiki/File:Manuscripts_of_%22I_Am_a_Cat%22.jpg | PD Mark 1.0 | 1724x1289 |
| 04_cover_i_am_a_cat_goyo_1906.jpg | natsume-soseki | Wikimedia Commons, digitized from Yale University Beinecke Rare Book & Manuscript Library | https://commons.wikimedia.org/wiki/File:I_AM_A_CAT_by_K._Ando.jpg | PD Mark 1.0 | 2305x3294 |
| 05_cover_kokoro_1914_lowres.jpg | natsume-soseki | Wikimedia Commons (source listed on file page only as 'Katalog', i.e. an auction/library catalog scan) | https://commons.wikimedia.org/wiki/File:Natsume_S%C3%B4seki_Umschlag_%22Kokoro%22.jpg | PD-Japan | 266x343 |
| portrait_LOC_1917.jpg | rabindranath-tagore | Wikimedia Commons | https://commons.wikimedia.org/wiki/File:Rabindranath_Tagore,_three-quarter-length_portrait,_seated,_facing_right_LCCN91481036.jpg | PD-old-70-expired, CC-PD-Mark (Library of Congress copy) | 473x640 |
| portrait-1909.jpg | rabindranath-tagore | Wikimedia Commons | https://commons.wikimedia.org/wiki/File:Rabindranath_Tagore_in_1909.jpg | PD-old-100-expired, CC-PD-Mark | 1071x1500 |
| signature_bengali_1920.jpg | rabindranath-tagore | Wikimedia Commons | https://commons.wikimedia.org/wiki/File:%E0%A6%B0%E0%A6%AC%E0%A7%80%E0%A6%A8%E0%A7%8D%E0%A6%A6%E0%A7%8D%E0%A6%B0%E0%A6%A8%E0%A6%BE%E0%A6%A5_%E0%A6%A0%E0%A6%BE%E0%A6%95%E0%A7%81%E0%A6%B0_%E0%A6%AC%E0%A6%BE%E0%A6%82%E0%A6%B2%E0%A6%BE_%E0%A6%B8%E0%A7%8D%E0%A6%AC%E0%A6%BE%E0%A6%95%E0%A7%8D%E0%A6%B7%E0%A6%B0.jpg | PD-India-URAA (public domain per file page license tags) | 955x277 |
| signature_traced.svg | rabindranath-tagore | Wikimedia Commons | https://commons.wikimedia.org/wiki/File:Rabindranath_Tagore_Signature.svg | PD-India | 221x59 (SVG, vector -- nominal viewbox size) |
| gitanjali_title_page_1913.jpg | rabindranath-tagore | Wikimedia Commons | https://commons.wikimedia.org/wiki/File:Gitanjali_title_page_Rabindranath_Tagore.jpg | PD-India, PD-US (dual license per file page) | 1897x3226 |
| gitanjali_manuscript_page20.jpg | rabindranath-tagore | Wikimedia Commons | https://commons.wikimedia.org/wiki/File:Original_manuscript_of_Gitanjali_-_Rabindranath_Tagore_-_Rothenstein_collection.pdf | Public Domain Mark 1.0 (CC0-equivalent per file page) | 960x1474 |

Deviations recorded by the collectors (honest gaps, not silently filled):
- Kafka: Starke-illustrated 1915 jacket exists only on Pinterest/dealer sites → excluded by rule; the plain first-edition binding (CC-BY-3.0, attribution H.-P. Haack required if shipped) stands in. An NLI press photo carried a false CC-PD-Mark (AFP credit) → rejected.
- Soseki: no Kokoro manuscript on Commons (I-am-a-Cat MS page used); the 1905 Japanese first edition is absent (1906 English Goyō-design cover used); banknote-source claim for the 1912 portrait is unverified.
- Tagore: no Latin signature exists on Commons (Bengali only — a finding, not a gap); the Gitanjali manuscript is the English Rothenstein autograph (with corrections), not Bengali.

## Chosen direction (2026-08-18, three independent verdicts converged)

**paper-planet (종이의 행성) + the copperplate life dial** — the planet's
crust is the paper the authors left: cloth-bound far globe (period-dye
color), manuscript-paper territories (facsimile ground for asset-verified
authors, laid-paper + hatched band as the HONEST fallback), deckle-edge +
stitch borders, real first editions standing as work buildings (plain board
+ letterpress spine slip + diagonal hatching when unowned), the author's
REAL mark (signature / brush + red seals) inked at the territory heart,
photo-corner-mounted archival portraits, and the 감상인(鑑賞印) selection
protocol — vermilion is the selection channel's only user. Zoom depth IS
evidence depth. Grafted from the losing direction: the LIFE DIAL as the
selection instrument (tick ring = years, brass arc = active span, pointer =
timeline year, works at their year positions) — it encodes real data where
the appreciation stamp alone encoded only a binary state.

Convergence: the maker's own recommendation and both independent judges
(graphic-designer, visual-art-director) reached the same hybrid without
seeing each other's verdicts. Mandatory fixes carried into implementation:
badge anchoring at the label's leading edge (mockups anchored badges on
letter centers — 5 confirmed label-destroying overlaps), fallback boards
must visibly carry their hatching (never read as broken images), line/label
avoidance, and coverage: collect more slice-work covers so Kafka's realm is
not 4/5 fallback.

## Discarded directions

- **copperplate-uranographia** (art-r10/directions/copperplate-uranographia/)
  — the strongest single instrument (life dial) and the strictest
  quantitative encoding, but: its identity layer (linescreen portrait +
  signature facsimile) has NO fallback grammar for asset-poor authors —
  the most branded element is undesigned at scale; and it renders every
  culture through one European engraving lens (the AD: "그 문화를 유럽
  판화로 그린다") where paper-planet differentiates material by culture.
  The dial survives via the graft.
- **specimen-atlas** (no keyframes — rejected at thesis stage by the maker)
  — Penguin-Clothbound repeated-motif fields: motif density/placement
  carries no information (grammar-principle violation risk is structural),
  and flat two-tone fields discard the height/wash channels that already
  carry data. Its strongest idea (author's mark as monument) is absorbed
  stronger by paper-planet's real-hand marks.

## Decision log

- 2026-08-18: slice authors fixed (above) — three scripts stress the grammar
  (seal/signature treatment cannot be Latin-only); all three PD-safe by
  life+70 with margin.
