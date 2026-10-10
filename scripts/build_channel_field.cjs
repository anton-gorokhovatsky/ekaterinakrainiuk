/* Reproducible reconstruction of Terrain's scalar field: seed 87, scale 2.6,
   warp 1.1, three octaves, contrast 1.7, Drift amplitude .15.
   Reference and adaptation: docs/design-direction.md. No runtime dependencies. */
const fs = require('node:fs');
const path = require('node:path');
const { deflateSync } = require('node:zlib');
const tileW = 192, tileH = 108, columns = 13, frames = 90;
const rows = Math.ceil((frames + 1) / columns);
const width = tileW * columns, height = tileH * rows;
const pixels = Buffer.alloc(width * height * 4);
const interpolate = (a, b, t) => a + (b - a) * t;
const ease = t => t * t * (3 - 2 * t);
function lattice(x, y, z, w, seed) {
  let h = Math.imul(x, 374761393) ^ Math.imul(y, 668265263)
    ^ Math.imul(z, 1440662683) ^ Math.imul(w, 1274126177)
    ^ Math.imul(seed, 1013904223);
  h = Math.imul(h ^ (h >>> 15), 2246822519);
  h = Math.imul(h ^ (h >>> 13), 3266489917);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}
function noise(x, y, z, w, seed) {
  const ix = Math.floor(x), iy = Math.floor(y), iz = Math.floor(z), iw = Math.floor(w);
  const sx = ease(x - ix), sy = ease(y - iy), sz = ease(z - iz), sw = ease(w - iw);
  function slice(dz, dw) {
    return interpolate(
      interpolate(lattice(ix, iy, iz + dz, iw + dw, seed), lattice(ix + 1, iy, iz + dz, iw + dw, seed), sx),
      interpolate(lattice(ix, iy + 1, iz + dz, iw + dw, seed), lattice(ix + 1, iy + 1, iz + dz, iw + dw, seed), sx), sy);
  }
  if (z === 0 && w === 0) return slice(0, 0);
  return interpolate(interpolate(slice(0, 0), slice(0, 1), sw), interpolate(slice(1, 0), slice(1, 1), sw), sz);
}
function layers(x, y, z, w, seed, count) {
  let result = 0, weight = 1, total = 0, scale = 1;
  for (let n = 0; n < count; n++) {
    result += weight * noise(x * scale, y * scale, z, w, seed + n * 1319);
    total += weight; weight *= .5; scale *= 2;
  }
  return result / total;
}
function scalar(x, y, z, w) {
  const u = x * 2.6, v = y * 2.6 * 9 / 16;
  const horizontal = layers(u + 5.2, v + 1.3, z, w, 98, 2);
  const vertical = layers(u + 9.1, v + 7.7, z, w, 116, 2);
  const value = layers(u + 2.2 * (horizontal - .5), v + 2.2 * (vertical - .5), z, w, 87, 3);
  return Math.max(0, Math.min(1, (value - .5) * 1.7 + .5));
}
for (let tile = 0; tile <= frames; tile++) {
  const angle = 2 * Math.PI * (tile - 1) / frames;
  const z = tile ? Math.cos(angle) * .15 : 0, w = tile ? Math.sin(angle) * .15 : 0;
  const ox = tile % columns * tileW, oy = Math.floor(tile / columns) * tileH;
  for (let y = 0; y < tileH; y++) for (let x = 0; x < tileW; x++) {
    const value = Math.round(scalar(x / (tileW - 1), y / (tileH - 1), z, w) * 65535);
    const i = ((oy + y) * width + ox + x) * 4;
    pixels[i] = value >>> 8; pixels[i + 1] = value & 255; pixels[i + 2] = 0; pixels[i + 3] = 255;
  }
}
// PNG RGBA, filter 0, using only Node's standard library.
function crc32(data) {
  let crc = 0xffffffff;
  for (const byte of data) {
    crc ^= byte;
    for (let n = 0; n < 8; n++) crc = (crc >>> 1) ^ ((crc & 1) ? 0xedb88320 : 0);
  }
  return (crc ^ 0xffffffff) >>> 0;
}
function chunk(type, bytes) {
  const name = Buffer.from(type), length = Buffer.alloc(4), crc = Buffer.alloc(4);
  length.writeUInt32BE(bytes.length); crc.writeUInt32BE(crc32(Buffer.concat([name, bytes])));
  return Buffer.concat([length, name, bytes, crc]);
}
const header = Buffer.alloc(13);
header.writeUInt32BE(width, 0); header.writeUInt32BE(height, 4);
header[8] = 8; header[9] = 6;
const scanlines = Buffer.alloc(height * (width * 4 + 1));
for (let y = 0; y < height; y++) pixels.copy(scanlines, y * (width * 4 + 1) + 1, y * width * 4, (y + 1) * width * 4);
const png = Buffer.concat([
  Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
  chunk('IHDR', header), chunk('IDAT', deflateSync(scanlines, { level: 9 })), chunk('IEND', Buffer.alloc(0)),
]);
const destination = process.argv[2] || path.join(__dirname, '../assets/illustrations/channel-terrain-field.png');
fs.writeFileSync(destination, png);
console.log(`Continuous field atlas: ${width}x${height}, ${frames} phases plus still. Saved ${destination}`);
