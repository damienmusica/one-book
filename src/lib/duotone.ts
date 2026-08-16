// Duotone token mapping (thesis §⑤-3): portrait assets are grayscale plates;
// color belongs to the token sheet. Shadows take the plate ink, lights take
// the paper — computed once per image into a canvas.

function hexChannel(hex: string, i: number): number {
  return parseInt(hex.slice(1 + i * 2, 3 + i * 2), 16);
}

/** draw `img` into `canvas` mapped from grayscale onto an ink→paper ramp */
export function duotoneInto(
  canvas: HTMLCanvasElement,
  img: HTMLImageElement,
  ink = "#181310",
  paper = "#e5d7b8"
): void {
  const w = img.naturalWidth;
  const h = img.naturalHeight;
  if (w === 0 || h === 0) return;
  canvas.width = w;
  canvas.height = h;
  // every call reads pixels straight back — willReadFrequently keeps the
  // canvas on the CPU instead of round-tripping the GPU per portrait
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) return;
  ctx.drawImage(img, 0, 0);
  const data = ctx.getImageData(0, 0, w, h);
  const px = data.data;
  const lut = new Uint8ClampedArray(256 * 3);
  for (let v = 0; v < 256; v++) {
    const t = v / 255;
    for (let c = 0; c < 3; c++) {
      lut[v * 3 + c] = hexChannel(ink, c) + (hexChannel(paper, c) - hexChannel(ink, c)) * t;
    }
  }
  for (let i = 0; i < px.length; i += 4) {
    const v = px[i]!; // grayscale source: r == g == b
    px[i] = lut[v * 3]!;
    px[i + 1] = lut[v * 3 + 1]!;
    px[i + 2] = lut[v * 3 + 2]!;
  }
  ctx.putImageData(data, 0, 0);
}
