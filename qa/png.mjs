// 스크린샷 PNG 를 픽셀로 푼다 — 의존성 없이. 상태 단언이 픽셀을 증명하지 못한 자리에서 쓴다:
// "이 단추는 팔레트 색이다"는 getComputedStyle 이 아니라 그려진 픽셀이 답한다(::-webkit-search-cancel-button 은
// 계산 스타일을 돌려주지 않는다). 8비트 RGB/RGBA, 비인터레이스 — Playwright 가 내놓는 그 형식만.
import { inflateSync } from "node:zlib";

export function decodePng(buf) {
  if (buf.readUInt32BE(0) !== 0x89504e47) throw new Error("PNG 가 아니다");
  let pos = 8, width = 0, height = 0, colorType = 0, bitDepth = 0;
  const idat = [];
  while (pos < buf.length) {
    const len = buf.readUInt32BE(pos), type = buf.toString("ascii", pos + 4, pos + 8), data = buf.subarray(pos + 8, pos + 8 + len);
    if (type === "IHDR") { width = data.readUInt32BE(0); height = data.readUInt32BE(4); bitDepth = data[8]; colorType = data[9]; if (data[12] !== 0) throw new Error("인터레이스 PNG"); }
    else if (type === "IDAT") idat.push(data);
    else if (type === "IEND") break;
    pos += 12 + len;
  }
  if (bitDepth !== 8 || (colorType !== 2 && colorType !== 6)) throw new Error(`지원하지 않는 PNG (depth ${bitDepth}, color ${colorType})`);
  const bpp = colorType === 6 ? 4 : 3, stride = width * bpp;
  const raw = inflateSync(Buffer.concat(idat));
  const out = Buffer.alloc(height * stride);
  let prev = Buffer.alloc(stride);
  for (let y = 0; y < height; y++) {
    const filter = raw[y * (stride + 1)], line = raw.subarray(y * (stride + 1) + 1, (y + 1) * (stride + 1)), cur = out.subarray(y * stride, (y + 1) * stride);
    for (let i = 0; i < stride; i++) {
      const a = i >= bpp ? cur[i - bpp] : 0, b = prev[i], c = i >= bpp ? prev[i - bpp] : 0;
      let v = line[i];
      if (filter === 1) v += a;
      else if (filter === 2) v += b;
      else if (filter === 3) v += (a + b) >> 1;
      else if (filter === 4) { const p = a + b - c, pa = Math.abs(p - a), pb = Math.abs(p - b), pc = Math.abs(p - c); v += pa <= pb && pa <= pc ? a : pb <= pc ? b : c; }
      cur[i] = v & 255;
    }
    prev = cur;
  }
  return { width, height, bpp, data: out, at(x, y) { const i = (y * width + x) * bpp; return [out[i], out[i + 1], out[i + 2]]; } };
}

/** 조건을 만족하는 픽셀 수 — 예: 팔레트 밖의 파란 픽셀. */
export function countPixels(png, pred) {
  let n = 0;
  for (let y = 0; y < png.height; y++) for (let x = 0; x < png.width; x++) { const [r, g, b] = png.at(x, y); if (pred(r, g, b)) n++; }
  return n;
}
