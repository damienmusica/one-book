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
| kafka-der-prozess-1925-firstedition-cover.jpg | franz-kafka | Antiquariat Dr. Haack Leipzig → private collection (photographed by H.-P. Haack) | https://commons.wikimedia.org/wiki/File:Kafka_Der_Prozess_1925.jpg | CC-PD-Mark / PD-old-70-expired (file page license template = pd) | 1132x1577 |
| kafka-das-schloss-1926-firstedition-cover.jpg | franz-kafka | Antiquariat Dr. Haack Leipzig → private collection, Switzerland (photographed by H.-P. Haack) | https://commons.wikimedia.org/wiki/File:Kafka_Das_Schloss_1926.jpg | PD-text (plain typographic cover below threshold of originality; UsageTerms=Public domain, AttributionRequired=false per API extmetadata) | 1166x1580 |
| kafka-in-der-strafkolonie-1919-firstedition-titlepage.jpg | franz-kafka | Antiquariat Dr. Haack Leipzig (photographed by H.-P. Haack) | https://commons.wikimedia.org/wiki/File:Kafka_Strafkolonie_(1919).jpg | CC-BY-3.0 (attribution H.-P. Haack — REQUIRED in-app if shipped) | 1055x1532 |
| 06_cover_sorekara_1910_shunyodo.jpg | natsume-soseki | National Diet Library Digital Collections (dl.ndl.go.jp/pid/887086), mirrored to Wikimedia Commons | https://commons.wikimedia.org/wiki/File:NDL887086_%E3%81%9D%E3%82%8C%E3%81%8B%E3%82%89_part1.pdf | PD-Japan / PD-scan | 6224x9360 |
| 07_cover_sanshiro_1909_shunyodo.jpg | natsume-soseki | National Diet Library Digital Collections (dl.ndl.go.jp/pid/886555), mirrored to Wikimedia Commons | https://commons.wikimedia.org/wiki/File:NDL886555_%E4%B8%89%E5%9B%9B%E9%83%8E_part1.pdf | PD-Japan / PD-scan | 5679x8857 |
| 08_cover_uzurakago-botchan_1907_shunyodo.jpg | natsume-soseki | National Diet Library Digital Collections (dl.ndl.go.jp/pid/885509), mirrored to Wikimedia Commons | https://commons.wikimedia.org/wiki/File:NDL885509_%E9%B6%89%E7%B1%A0_part1.pdf | PD-Japan / PD-scan | 5394x9047 |
| gitanjali_bengali_titlepage_1913_3rdedition.jpg | rabindranath-tagore | Digital Library of India scan, mirrored to Wikimedia Commons (Bengali Gitanjali, 1913 3rd edition — NOT the 1910 1st; recorded below) | https://commons.wikimedia.org/wiki/File:%E0%A6%97%E0%A7%80%E0%A6%A4%E0%A6%BE%E0%A6%9E%E0%A7%8D%E0%A6%9C%E0%A6%B2%E0%A6%BF_-_%E0%A6%B0%E0%A6%AC%E0%A7%80%E0%A6%A8%E0%A7%8D%E0%A6%A6%E0%A7%8D%E0%A6%B0%E0%A6%A8%E0%A6%BE%E0%A6%A5_%E0%A6%A0%E0%A6%BE%E0%A6%95%E0%A7%81%E0%A6%B0.djvu | PD-old-80-expired, CC-PD-Mark | 1920x2938 (Commons thumb renderer caps the 2700x4132 djvu page at 1920px) |
| home_and_the_world_cover_macmillan.jpg | rabindranath-tagore | Internet Archive (archive.org/details/hometheworld00tagouoft), mirrored to Wikimedia Commons | https://commons.wikimedia.org/wiki/File:The_Home_and_the_World_-_cover_page.jpg | PD-US | 535x881 |

Deviations recorded by the collectors (honest gaps, not silently filled):
- Kafka: Starke-illustrated 1915 jacket exists only on Pinterest/dealer sites → excluded by rule; the plain first-edition binding (CC-BY-3.0, attribution H.-P. Haack required if shipped) stands in. An NLI press photo carried a false CC-PD-Mark (AFP credit) → rejected.
- Soseki: no Kokoro manuscript on Commons (I-am-a-Cat MS page used); the 1905 Japanese first edition is absent (1906 English Goyō-design cover used); banknote-source claim for the 1912 portrait is unverified.
- Tagore: no Latin signature exists on Commons (Bengali only — a finding, not a gap); the Gitanjali manuscript is the English Rothenstein autograph (with corrections), not Bengali; the Bengali Gitanjali title page is the 1913 3rd edition — no 1910 1st-edition scan exists on Commons/DLI.

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

### Implementation scope (what shipped in R10-3, what deliberately did not)

Shipped: cloth sea, paper land + laid-line texture, deckle coasts, stitch
borders, manuscript facsimile grounds (3 slice authors, worker-clipped to
nation runs), real signature/brush marks (compact when unengaged — the full
spread is a selection/near reading), 감상인 selection frame + life dial
(ticks/brass arc/needle = real years), standing first-edition cover boards
(11 works) with hatched fallback boards, letterpress label slips, photo-corner
archival portraits (labeled 기록 사진).

NOT shipped, recorded honestly — **relation-line re-encoding** (mockup: ink
route conventions, width = evidence count, pecked = disputed). This is a
semantic re-encoding, not a re-skin: it changes what the legend promises and
what the contract tests pin (`relation type → color+dash` is the proven,
tested channel). Doing it inside R10-3 would have re-opened the R5-A semantic
contract mid-art-pass. Left as the first candidate for a follow-up pass with
its own legend/methodology/test change, per the taxonomy-change rule
(taxonomy doc + schema + validation in the same change).

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

## Signature wave — R12 (2026-08-24, CPO ruling C·E)

Why: the asset bottleneck was verification labour, not scarcity — Wikidata P109
(signature) exists for 65 of the 97 authors without a mark, and a signature is
below the threshold of originality regardless of the signer's death year. Files
were surveyed (Commons imageinfo + extmetadata), staged by
`art-r10/stage-signatures.mjs` (which applies the policy, not the licence
judgement), rasterized by `render-svg.mjs`, and inked by `build-art-assets.py`
through the same path as the first three marks. **Held (6):** living authors
(Pynchon · Atwood · DeLillo — living-person rule), share-alike traces (Le Guin,
Narayan — need a human look before a derivative ships), and Woolf (the file is
the verso of a photograph, not an isolated signature). 32 authors have no P109
claim at all. Ledger rows (one per shipped mark; the full provenance row lives in
`art-r10/staging/<author>/provenance.json`):

| asset | author | source (collection) | file/page URL | license basis | pixel size |
|---|---|---|---|---|---|
| signature.svg | lu-xun | Wikimedia Commons (Original: Lu Xun Vector:  逾刃) — 鲁迅lx.jpg | https://commons.wikimedia.org/wiki/File:Lu_Xun%27s_Signature.svg | Public domain — A signature is below the threshold of originality; file page carries a public-domain tag | 276x172 |
| signature.png | premchand | Wikimedia Commons (प्रेमचंद) | https://commons.wikimedia.org/wiki/File:Hastakshar_premchand_(transparent).png | Public domain — A signature is below the threshold of originality; file page carries a public-domain tag | 170x45 |
| signature.svg | witold-gombrowicz | Wikimedia Commons (Witold Gombrowicz) — File:Gombrowicz faksymile (cropped).png | https://commons.wikimedia.org/wiki/File:Gombrowicz_signature.svg | Public domain — A signature is below the threshold of originality; file page carries a public-domain tag | 661x103 |
| signature.jpg | elias-canetti | Wikimedia Commons (Elias Canetti) — http://www.havelshouseofhistory.com/Canetti,%20E%20Sign.jpg | https://commons.wikimedia.org/wiki/File:Unterschrift_von_Elias_Canetti.jpg | Public domain — A signature is below the threshold of originality; file page carries a public-domain tag | 400x84 |
| signature.png | cesar-vallejo | Wikimedia Commons (César Vallejo) — Own work | https://commons.wikimedia.org/wiki/File:Firma_cvallejo.png | Public domain — A signature is below the threshold of originality; file page carries a public-domain tag | 324x58 |
| signature.jpg | anna-akhmatova | Wikimedia Commons (Anna Akhmatova) — Анна Ахматова. Стихотворения. Издательство "Молодая гвардия", серия "XX век. Поэт и время", Москва, 1989 / Own work photo by Vizu | https://commons.wikimedia.org/wiki/File:%D0%90%D1%85%D0%BC%D0%B0%D1%82%D0%BE%D0%B2%D0%B0_%D0%90%D0%BD%D0%BD%D0%B0_%D0%B0%D0%B2%D1%82%D0%BE%D0%B3%D1%80%D0%B0%D1%84.JPG | Public domain — A signature is below the threshold of originality; file page carries a public-domain tag | 1255x624 |
| signature.svg | marina-tsvetaeva | Wikimedia Commons (M. Tsvetaeva) — based on File:Tsvetaeva signature 1941.jpg | https://commons.wikimedia.org/wiki/File:Tsvetaeva_signature_1941.svg | Public domain — A signature is below the threshold of originality; file page carries a public-domain tag | 323x111 |
| signature.svg | sadegh-hedayat | Wikimedia Commons (Sadeq Hedayat) — https://www.facebook.com/photo/?fbid=3818946388173054 | https://commons.wikimedia.org/wiki/File:Sadeq_Hedayat_signature.svg | Public domain — A signature is below the threshold of originality; file page carries a public-domain tag | 480x256 |
| signature.svg | marcel-proust | Wikimedia Commons (Morn) — https://cabourg.fr/sites/ville_dev/files/marcel-proust-signature.png | https://commons.wikimedia.org/wiki/File:Marcel_Proust_signature.svg | Public domain — A signature is below the threshold of originality; file page carries a public-domain tag | 632x187 |
| signature.svg | james-joyce | Wikimedia Commons (James Joyce
 Created in vector format by Scewing) — Heritage Auction Galleries | https://commons.wikimedia.org/wiki/File:James_Joyce_signature.svg | Public domain — A signature is below the threshold of originality; file page carries a public-domain tag | 585x146 |
| signature.png | william-faulkner | Wikimedia Commons (William Faulkner) — http://www.tomfolio.com/signatures/f/FaulknerWilliam.html | https://commons.wikimedia.org/wiki/File:Faulkner_signature.png | Public domain — A signature is below the threshold of originality; file page carries a public-domain tag | 303x73 |
| signature.svg | thomas-mann | Wikimedia Commons (Original:  Darldarl Vector:  Morn) — Own work | https://commons.wikimedia.org/wiki/File:Thomas_Mann_signature.svg | Public domain — A signature is below the threshold of originality; file page carries a public-domain tag | 500x230 |
| signature.svg | robert-musil | Wikimedia Commons (R. Musil) — File:Robert_Musil_Signature.jpg | https://commons.wikimedia.org/wiki/File:Robert_Musil_Signature.svg | Public domain — A signature is below the threshold of originality; file page carries a public-domain tag | 229x92 |
| signature.svg | fernando-pessoa | Wikimedia Commons (Fernando Pessoa) — This file was derived from:  Assinatura pessoa fernando.jpg | https://commons.wikimedia.org/wiki/File:Fernando_Pessoa_signature.svg | CC0 — Uploader released the trace under CC0; the signature itself is below the threshold of originality | 251x72 |
| signature.jpg | william-butler-yeats | Wikimedia Commons (William Butler Yeats) — Nobel Prize Website | https://commons.wikimedia.org/wiki/File:Yeats_Signature.jpg | Public domain — A signature is below the threshold of originality; file page carries a public-domain tag | 262x100 |
| signature.svg | rainer-maria-rilke | Wikimedia Commons (Rainer Maria Rilke, Birkho) — https://pictures.abebooks.com/inventory/30947374933.jpg | https://commons.wikimedia.org/wiki/File:Unterschrift_Rainer_Maria_Rilke_%C3%B6sterreichischer_Erz%C3%A4hler_und_Lyriker.svg | Public domain — A signature is below the threshold of originality; file page carries a public-domain tag | 1612x301 |
| signature.svg | ts-eliot | Wikimedia Commons (TS Eliot) — Traced in Adobe Illustrator from http://services.tomfolio.com/tfsigs/e/EliotTS.jpg | https://commons.wikimedia.org/wiki/File:TS_Eliot_Signature.svg | Public domain — A signature is below the threshold of originality; file page carries a public-domain tag | 225x67 |
| signature.svg | gertrude-stein | Wikimedia Commons (Gertrude Stein (vectorized by telrúnya.)) — This W3C-unspecified vector image was created with Inkscape . Original: http://www.tomfolio.com/autographimg.asp?sigid=1143&ret=AGIni | https://commons.wikimedia.org/wiki/File:Gertrude_Stein-_Autograph.svg | Public domain — A signature is below the threshold of originality; file page carries a public-domain tag | 185x75 |
| signature.png | luigi-pirandello | Wikimedia Commons (Luigi Pirandello) — Personal collection | https://commons.wikimedia.org/wiki/File:Pirandello_-_signature.png | Public domain — A signature is below the threshold of originality; file page carries a public-domain tag | 3884x1092 |
| signature.svg | bertolt-brecht | Wikimedia Commons (Bertolt Brecht) — Vectorized version of File:Unterschrift Bertolt Brecht (1898–1956).png | https://commons.wikimedia.org/wiki/File:Bertolt_Brecht_Signature.svg | Public domain — A signature is below the threshold of originality; file page carries a public-domain tag | 772x185 |
| signature.svg | mikhail-bulgakov | Wikimedia Commons (Kaidor) — Own work based on File:Автограф Михаила Булгакова 1937.jpg | https://commons.wikimedia.org/wiki/File:Mikhail_Bulgakov_signature.svg | Public domain — A signature is below the threshold of originality; file page carries a public-domain tag | 650x287 |
| signature.png | isaac-babel | Wikimedia Commons (Birkho) — Own work | https://commons.wikimedia.org/wiki/File:Unterschrift_Isaak_Emmanuilowitsch_Babel_sowjetischer_Journalist_und_Schriftsteller.png | CC0 — Uploader released the trace under CC0; the signature itself is below the threshold of originality | 646x309 |
| signature.svg | federico-garcia-lorca | Wikimedia Commons (Morn) — Traced from bitmap at http://www.superstock.co.uk/stock-photos-images/1566-0201401 | https://commons.wikimedia.org/wiki/File:Federico_Garc%C3%ADa_Lorca_signature.svg | Public domain — A signature is below the threshold of originality; file page carries a public-domain tag | 600x360 |
| signature.svg | gabriel-garcia-marquez | Wikimedia Commons (Gabriel Marquez Signature.png
Original by DaViD BeLtRaN 901
modified by Jak
derivative work: Ninrouter) — This file was derived from:  Gabriel Marquez Signature.png: | https://commons.wikimedia.org/wiki/File:Gabriel_Marquez_Signature.svg | Public domain — A signature is below the threshold of originality; file page carries a public-domain tag | 803x189 |
| signature.svg | toni-morrison | Wikimedia Commons (Toni Morrison; vectorized by Pbrks) — File:Toni Morrison (signature).jpg | https://commons.wikimedia.org/wiki/File:Toni_Morrison_(signature).svg | Public domain — A signature is below the threshold of originality; file page carries a public-domain tag | 243x105 |
| signature.svg | georges-perec | Wikimedia Commons (Farisori) — Own work | https://commons.wikimedia.org/wiki/File:Firma_Perec.svg | Public domain — A signature is below the threshold of originality; file page carries a public-domain tag | 518x432 |
| signature.svg | milan-kundera | Wikimedia Commons (Milan Kundera) — File:Milan Kundera signature.jpg | https://commons.wikimedia.org/wiki/File:Milan_Kundera_signature.svg | Public domain — A signature is below the threshold of originality; file page carries a public-domain tag | 934x203 |
| signature.svg | stanislaw-lem | Wikimedia Commons (Stanisław Lem) — Traced in "Wycinek i szkic" from http://autografy.eu/index.php/2011/01/stanislaw-lem/ | https://commons.wikimedia.org/wiki/File:Stanis%C5%82aw_Lem_signature.svg | Public domain — A signature is below the threshold of originality; file page carries a public-domain tag | 308x156 |
| signature.svg | umberto-eco | Wikimedia Commons (Diego Grez) — Umberto-eco001.jpg | https://commons.wikimedia.org/wiki/File:Umberto_Eco_signature.svg | CC BY 3.0 — Uploader's trace licensed CC BY — attribution carried in this row; the signature itself is below the threshold of originality | 764x457 |
| signature.png | jose-saramago | Wikimedia Commons (Unknown authorUnknown author) — Biblioteca Nacional de Portugal | https://commons.wikimedia.org/wiki/File:Assinatura_Jos%C3%A9_Saramago.png | Public domain — A signature is below the threshold of originality; file page carries a public-domain tag | 860x318 |
| signature.svg | octavia-butler | Wikimedia Commons (Flickr user POP; changed by an anonymous contributor who was logged in as Förbätterlig) — Own work based on: Octavia E. Butler signature.jpg (orignally from: https://www.flickr.com/photos/58558794@N07/48608066182/) | https://commons.wikimedia.org/wiki/File:Octavia_E._Butler_signature.svg | Public domain — A signature is below the threshold of originality; file page carries a public-domain tag | 1284x307 |
| signature.svg | yukio-mishima | Wikimedia Commons (Yukio Mishima) — https://commons.m.wikimedia.org/wiki/File:Yukio_Mishima_signature.png#mw-jump-to-license | https://commons.wikimedia.org/wiki/File:Yukio_Mishima_signature.svg | Public domain — A signature is below the threshold of originality; file page carries a public-domain tag | 779x2082 |
| signature.svg | jorge-luis-borges | Wikimedia Commons (Jorge Luis Borges) — This file was derived from:  Buenos Aires L1.jpg: | https://commons.wikimedia.org/wiki/File:Jorge_Luis_Borges_firma.svg | Public domain — A signature is below the threshold of originality; file page carries a public-domain tag | 818x288 |
| signature.svg | pablo-neruda | Wikimedia Commons (Pablo Neruda) — http://atinachile.bligoo.com/content/view/2417/101_anos_de_Pablo_Neruda.html | https://commons.wikimedia.org/wiki/File:Firma_Pablo_Neruda.svg | Public domain — A signature is below the threshold of originality; file page carries a public-domain tag | 348x285 |
| signature.svg | julio-cortazar | Wikimedia Commons (Julio Cortázar) — iCollector | https://commons.wikimedia.org/wiki/File:Julio_Cort%C3%A1zar_signature.svg | Public domain — A signature is below the threshold of originality; file page carries a public-domain tag | 585x306 |
| signature.png | clarice-lispector | Wikimedia Commons (Clarice Lispector) — http://literatortura.com/2015/07/o-jornalismo-a-claricear/ | https://commons.wikimedia.org/wiki/File:Clarice-Lispector-Unterschrift.png | Public domain — A signature is below the threshold of originality; file page carries a public-domain tag | 549x111 |
| signature.svg | derek-walcott | Wikimedia Commons (Original:  Derek Walcott
Upload:  Omerta-ve
Vectorization:  Carnby) — This file was derived from:  Firma-Derek-Walcott.png: | https://commons.wikimedia.org/wiki/File:Derek_Walcott_signature.svg | Public domain — A signature is below the threshold of originality; file page carries a public-domain tag | 471x154 |
| signature.svg | samuel-beckett | Wikimedia Commons (Er-ik) — Own work, traced from http://leevidor.com/img/beckett_samuel_autograph_1.jpg | https://commons.wikimedia.org/wiki/File:Samuel_Beckett_signature.svg | Public domain — A signature is below the threshold of originality; file page carries a public-domain tag | 198x35 |
| signature.svg | vladimir-nabokov | Wikimedia Commons (Vladimir Nabokov
 Created in vector format by Scewing) — https://ihavegoodbooks.blogspot.com/2010/09/eye-by-vladimir-nabokov.html | https://commons.wikimedia.org/wiki/File:Vladimir_Nabokov_signature.svg | Public domain — A signature is below the threshold of originality; file page carries a public-domain tag | 585x119 |
| signature.svg | albert-camus | Wikimedia Commons (Albert Camus) — This file was derived from:  Albert Camus Signature.jpg | https://commons.wikimedia.org/wiki/File:Albert_Camus_signature.svg | Public domain — A signature is below the threshold of originality; file page carries a public-domain tag | 290x62 |
| signature.svg | ernest-hemingway | Wikimedia Commons (Ernest Hemingway) — Traced in Adobe Illustrator from http://www.kruegerbooks.com/books/sig/ernest.jpg | https://commons.wikimedia.org/wiki/File:Ernest_Hemingway_Signature.svg | Public domain — A signature is below the threshold of originality; file page carries a public-domain tag | 234x61 |
| signature.svg | george-orwell | Wikimedia Commons (George Orwell) — Scan from The Complete Works of George Orwell | https://commons.wikimedia.org/wiki/File:Orwell-Signature.svg | Public domain — A signature is below the threshold of originality; file page carries a public-domain tag | 512x206 |
| signature.svg | simone-de-beauvoir | Wikimedia Commons (Simone de Beauvoir) — File:Simone_de_Beauvoir_(signature).jpg | https://commons.wikimedia.org/wiki/File:Simone_de_Beauvoir_signature.svg | Public domain — A signature is below the threshold of originality; file page carries a public-domain tag | 797x104 |
| signature.svg | paul-celan | Wikimedia Commons (Pacha Tchernof) — Paul Celan signature.jpg vectorized with Affinity Designer | https://commons.wikimedia.org/wiki/File:Paul_Celan_signature.svg | Public domain — A signature is below the threshold of originality; file page carries a public-domain tag | 512x77 |
| signature.svg | zora-neale-hurston | Wikimedia Commons (Zora Neale Hurston
Created in vector format by Scewing) — Beinecke Rare Book & Manuscript Library | https://commons.wikimedia.org/wiki/File:Zora_Neale_Hurston_signature.svg | Public domain — A signature is below the threshold of originality; file page carries a public-domain tag | 585x190 |
| signature.svg | flannery-oconnor | Wikimedia Commons (Flannery O'Connor) — From signed book | https://commons.wikimedia.org/wiki/File:Flannery_OConnor_signature_May_1952.svg | Public domain — A signature is below the threshold of originality; file page carries a public-domain tag | 908x195 |
| signature.png | marguerite-duras | Wikimedia Commons (Marguerite Duras) — https://www.artcurial.com/fr/lot-marguerite-duras-le-marin-de-gibraltar-1567-168 | https://commons.wikimedia.org/wiki/File:Signature_of_Marguerite_Duras.png | Public domain — A signature is below the threshold of originality; file page carries a public-domain tag | 650x300 |
| signature.svg | wislawa-szymborska | Wikimedia Commons (Wisława Szymborska) — Traced in "Wycinek i szkic" from http://autografy.eu/wp-content/uploads/2011/01/wislawa-szymborska.jpg | https://commons.wikimedia.org/wiki/File:Wis%C5%82awa_Szymborska_signature.svg | Public domain — A signature is below the threshold of originality; file page carries a public-domain tag | 753x121 |
| signature.svg | gustave-flaubert | Wikimedia Commons (G. Flaubert) — G. Flaubert | https://commons.wikimedia.org/wiki/File:G._Flaubert_signature.svg | Public domain — A signature is below the threshold of originality; file page carries a public-domain tag | 393x118 |
| signature.svg | leo-tolstoy | Wikimedia Commons (Leo Tolstoy
 Created in vector format by Scewing) — Heritage Auction Gallery | https://commons.wikimedia.org/wiki/File:Leo_Tolstoy_signature.svg | Public domain — A signature is below the threshold of originality; file page carries a public-domain tag | 585x119 |
| signature.svg | fyodor-dostoevsky | Wikimedia Commons (Fyodor Dostoyevsky) — Traced in Adobe Illustrator from w:File:Dostsignature.jpg | https://commons.wikimedia.org/wiki/File:Fyodor_Dostoyevsky_Signature.svg | Public domain — A signature is below the threshold of originality; file page carries a public-domain tag | 567x101 |
| signature.svg | anton-chekhov | Wikimedia Commons (Anton Chekhov) — This file was derived from:  Подпись Антон Чехов.jpg: | https://commons.wikimedia.org/wiki/File:Anton_Chekhov_signature.svg | Public domain — A signature is below the threshold of originality; file page carries a public-domain tag | 427x298 |
| signature.png | henrik-ibsen | Wikimedia Commons (Henrik Ibsen) — From the frontispiece of  Literary Lives: Henrik Ibsen by Edmund Gosse, published by Scribner, New York, 1908 | https://commons.wikimedia.org/wiki/File:Henrik_Ibsen%27s_signature.png | Public domain — A signature is below the threshold of originality; file page carries a public-domain tag | 285x58 |
| signature.png | henry-james | Wikimedia Commons (Henry James) — https://archive.org/details/roderickhudsonja00jameiala | https://commons.wikimedia.org/wiki/File:Henry_James_signature_(1907).png | Public domain — A signature is below the threshold of originality; file page carries a public-domain tag | 781x443 |
| signature.svg | joseph-conrad | Wikimedia Commons (Joseph Conrad
 Created in vector format by Scewing) — Heritage Auctions | https://commons.wikimedia.org/wiki/File:Joseph_Conrad_signature_1925.svg | Public domain — A signature is below the threshold of originality; file page carries a public-domain tag | 585x249 |
| signature.png | machado-de-assis | Wikimedia Commons (Autograph of Machado de Assis) — http://www.bairrodocatete.com.br/machadodeassis1.html - acessada em 2008-12-08 | https://commons.wikimedia.org/wiki/File:Assinatura_de_Machado_de_Assis.png | Public domain — A signature is below the threshold of originality; file page carries a public-domain tag | 1902x387 |
| signature.svg | charles-baudelaire | Wikimedia Commons (Original uploader was Hedning at sv.wikipedia) — Originally from sv.wikipedia; description page is/was here. | https://commons.wikimedia.org/wiki/File:Baudelaire_signatur.svg | Public domain — A signature is below the threshold of originality; file page carries a public-domain tag | 387x64 |
| signature.svg | walt-whitman | Wikimedia Commons (Walt Whitman
 Created in vector format by Scewing) — Heritage Auctions | https://commons.wikimedia.org/wiki/File:Walt_Whitman_signature.svg | Public domain — A signature is below the threshold of originality; file page carries a public-domain tag | 585x134 |
| signature.svg | friedrich-nietzsche | Wikimedia Commons (Friedrich Nietzsche) — Traced in Adobe Illustrator from Nietzsche - Ainsi parlait Zarathoustra.djvu | https://commons.wikimedia.org/wiki/File:Friedrich_Nietzsche_Signature.svg | Public domain — A signature is below the threshold of originality; file page carries a public-domain tag | 262x66 |

Held, with reasons:

- virginia-woolf — file is more than a signature — needs a crop or a different file (Virginia Woolf 1927 verso.png)
- thomas-pynchon — living author — held by the living-person rule (Thomas Pynchon signature.svg)
- ursula-k-le-guin — share-alike licence (CC BY-SA 4.0) — needs a human look before a derivative ships (Ursula K. Le Guin signature.svg)
- margaret-atwood — living author — held by the living-person rule (Margaret Atwood signature.svg)
- don-delillo — living author — held by the living-person rule (Don DeLillo signature.svg)
- rk-narayan — file is more than a signature — needs a crop or a different file (R. K. Narayan.jpg)
