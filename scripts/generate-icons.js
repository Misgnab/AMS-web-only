import fs from 'fs';
import path from 'path';
import zlib from 'zlib';

function createPng(width, height, drawFn) {
  // RGBA buffer: height rows, each row has 1 filter byte (0) + width * 4 bytes
  const rowSize = 1 + width * 4;
  const rawBuffer = Buffer.alloc(rowSize * height);

  for (let y = 0; y < height; y++) {
    const rowOffset = y * rowSize;
    rawBuffer[rowOffset] = 0; // Filter type 0 (None)
    for (let x = 0; x < width; x++) {
      const pixelOffset = rowOffset + 1 + x * 4;
      const [r, g, b, a] = drawFn(x, y, width, height);
      rawBuffer[pixelOffset] = r;
      rawBuffer[pixelOffset + 1] = g;
      rawBuffer[pixelOffset + 2] = b;
      rawBuffer[pixelOffset + 3] = a;
    }
  }

  const compressedData = zlib.deflateSync(rawBuffer);

  // Helper to make chunk
  function makeChunk(type, data) {
    const len = data.length;
    const buf = Buffer.alloc(8 + len + 4);
    buf.writeUInt32BE(len, 0);
    buf.write(type, 4, 4, 'ascii');
    data.copy(buf, 8);

    // CRC32 calculation
    let crc = 0xffffffff;
    const crcTable = [];
    for (let n = 0; n < 256; n++) {
      let c = n;
      for (let k = 0; k < 8; k++) {
        c = (c & 1) ? (0xedb88320 ^ (c >>> 1)) : (c >>> 1);
      }
      crcTable[n] = c;
    }
    const typeAndData = Buffer.concat([Buffer.from(type, 'ascii'), data]);
    for (let i = 0; i < typeAndData.length; i++) {
      crc = (crc >>> 8) ^ crcTable[(crc ^ typeAndData[i]) & 0xff];
    }
    crc = (crc ^ 0xffffffff) >>> 0;
    buf.writeUInt32BE(crc, 8 + len);
    return buf;
  }

  // Header: 8-byte PNG signature
  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

  // IHDR: 13 bytes
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // 8 bits per channel
  ihdr[9] = 6; // Color type 6 (RGBA)
  ihdr[10] = 0; // Compression
  ihdr[11] = 0; // Filter
  ihdr[12] = 0; // Interlace

  const ihdrChunk = makeChunk('IHDR', ihdr);
  const idatChunk = makeChunk('IDAT', compressedData);
  const iendChunk = makeChunk('IEND', Buffer.alloc(0));

  return Buffer.concat([signature, ihdrChunk, idatChunk, iendChunk]);
}

// Distance to line segment for checkmark rendering
function distToSegment(px, py, x1, y1, x2, y2) {
  const l2 = (x2 - x1) * (x2 - x1) + (y2 - y1) * (y2 - y1);
  if (l2 === 0) return Math.hypot(px - x1, py - y1);
  let t = ((px - x1) * (x2 - x1) + (py - y1) * (y2 - y1)) / l2;
  t = Math.max(0, Math.min(1, t));
  return Math.hypot(px - (x1 + t * (x2 - x1)), py - (y1 + t * (y2 - y1)));
}

// Standard Icon drawer
function drawStandardIcon(x, y, w, h) {
  const nx = x / w;
  const ny = y / h;

  // Background rounded rect (#0F172A)
  const cornerR = 0.22;
  const inBgCorner = 
    (nx < cornerR && ny < cornerR && Math.hypot(nx - cornerR, ny - cornerR) > cornerR) ||
    (nx > 1 - cornerR && ny < cornerR && Math.hypot(nx - (1 - cornerR), ny - cornerR) > cornerR) ||
    (nx < cornerR && ny > 1 - cornerR && Math.hypot(nx - cornerR, ny - (1 - cornerR)) > cornerR) ||
    (nx > 1 - cornerR && ny > 1 - cornerR && Math.hypot(nx - (1 - cornerR), ny - (1 - cornerR)) > cornerR);

  if (inBgCorner) return [0, 0, 0, 0]; // Transparent outside outer card

  // Base background: Slate-900 (#0F172A -> #1E293B gradient)
  let r = Math.round(15 + ny * 15);
  let g = Math.round(23 + ny * 18);
  let b = Math.round(42 + ny * 17);
  let a = 255;

  // Center Shield/Card: [0.22, 0.22] to [0.78, 0.78]
  const cardPad = 0.22;
  const cardR = 0.12;
  const inCardX = nx >= cardPad && nx <= 1 - cardPad;
  const inCardY = ny >= cardPad && ny <= 1 - cardPad;
  
  const inCardCorner =
    (nx < cardPad + cardR && ny < cardPad + cardR && Math.hypot(nx - (cardPad + cardR), ny - (cardPad + cardR)) > cardR) ||
    (nx > 1 - cardPad - cardR && ny < cardPad + cardR && Math.hypot(nx - (1 - cardPad - cardR), ny - (cardPad + cardR)) > cardR) ||
    (nx < cardPad + cardR && ny > 1 - cardPad - cardR && Math.hypot(nx - (cardPad + cardR), ny - (1 - cardPad - cardR)) > cardR) ||
    (nx > 1 - cardPad - cardR && ny > 1 - cardPad - cardR && Math.hypot(nx - (1 - cardPad - cardR), ny - (1 - cardPad - cardR)) > cardR);

  if (inCardX && inCardY && !inCardCorner) {
    // Vibrant Blue Gradient (#3B82F6 -> #1D4ED8)
    const t = (ny - cardPad) / (1 - 2 * cardPad);
    r = Math.round(59 * (1 - t) + 29 * t);
    g = Math.round(130 * (1 - t) + 78 * t);
    b = Math.round(246 * (1 - t) + 216 * t);
  }

  // Checkmark points:
  // p1: (0.37, 0.51), p2: (0.46, 0.60), p3: (0.64, 0.40)
  const d1 = distToSegment(nx, ny, 0.37, 0.51, 0.46, 0.60);
  const d2 = distToSegment(nx, ny, 0.46, 0.60, 0.64, 0.40);
  const checkDist = Math.min(d1, d2);
  const strokeW = 0.045;

  if (checkDist <= strokeW) {
    // Smooth anti-aliased edge
    const alphaEdge = Math.min(1, Math.max(0, (strokeW - checkDist) / 0.008));
    r = Math.round(255 * alphaEdge + r * (1 - alphaEdge));
    g = Math.round(255 * alphaEdge + g * (1 - alphaEdge));
    b = Math.round(255 * alphaEdge + b * (1 - alphaEdge));
  }

  // Top right badge dot: Emerald pulse at (0.72, 0.28)
  const dotDist = Math.hypot(nx - 0.72, ny - 0.28);
  if (dotDist <= 0.06) {
    if (dotDist <= 0.045) {
      r = 16; g = 185; b = 129; // Emerald-500
    } else {
      r = 15; g = 23; b = 42; // Slate border
    }
  }

  return [r, g, b, a];
}

// Maskable Icon drawer (full-bleed background, safe zone padded artwork)
function drawMaskableIcon(x, y, w, h) {
  const nx = x / w;
  const ny = y / h;

  // Base full bleed background: Slate-900 (#0F172A -> #1E293B)
  let r = Math.round(15 + ny * 15);
  let g = Math.round(23 + ny * 18);
  let b = Math.round(42 + ny * 17);
  let a = 255;

  // Scale coordinates into 0.75 safe zone
  const cx = 0.5;
  const cy = 0.5;
  const scale = 0.75;
  const snx = (nx - cx) / scale + cx;
  const sny = (ny - cy) / scale + cy;

  if (snx >= 0 && snx <= 1 && sny >= 0 && sny <= 1) {
    const cardPad = 0.24;
    const cardR = 0.12;
    const inCardX = snx >= cardPad && snx <= 1 - cardPad;
    const inCardY = sny >= cardPad && sny <= 1 - cardPad;
    
    const inCardCorner =
      (snx < cardPad + cardR && sny < cardPad + cardR && Math.hypot(snx - (cardPad + cardR), sny - (cardPad + cardR)) > cardR) ||
      (snx > 1 - cardPad - cardR && sny < cardPad + cardR && Math.hypot(snx - (1 - cardPad - cardR), sny - (cardPad + cardR)) > cardR) ||
      (snx < cardPad + cardR && sny > 1 - cardPad - cardR && Math.hypot(snx - (cardPad + cardR), sny - (1 - cardPad - cardR)) > cardR) ||
      (snx > 1 - cardPad - cardR && sny > 1 - cardPad - cardR && Math.hypot(snx - (1 - cardPad - cardR), sny - (1 - cardPad - cardR)) > cardR);

    if (inCardX && inCardY && !inCardCorner) {
      const t = (sny - cardPad) / (1 - 2 * cardPad);
      r = Math.round(59 * (1 - t) + 29 * t);
      g = Math.round(130 * (1 - t) + 78 * t);
      b = Math.round(246 * (1 - t) + 216 * t);
    }

    const d1 = distToSegment(snx, sny, 0.37, 0.51, 0.46, 0.60);
    const d2 = distToSegment(snx, sny, 0.46, 0.60, 0.64, 0.40);
    const checkDist = Math.min(d1, d2);
    const strokeW = 0.045;

    if (checkDist <= strokeW) {
      const alphaEdge = Math.min(1, Math.max(0, (strokeW - checkDist) / 0.008));
      r = Math.round(255 * alphaEdge + r * (1 - alphaEdge));
      g = Math.round(255 * alphaEdge + g * (1 - alphaEdge));
      b = Math.round(255 * alphaEdge + b * (1 - alphaEdge));
    }

    const dotDist = Math.hypot(snx - 0.72, sny - 0.28);
    if (dotDist <= 0.06) {
      if (dotDist <= 0.045) {
        r = 16; g = 185; b = 129;
      } else {
        r = 15; g = 23; b = 42;
      }
    }
  }

  return [r, g, b, a];
}

const publicDir = path.resolve(process.cwd(), 'public');

// Generate 192x192
console.log('Generating pwa-192x192.png...');
fs.writeFileSync(path.join(publicDir, 'pwa-192x192.png'), createPng(192, 192, drawStandardIcon));

// Generate 512x512
console.log('Generating pwa-512x512.png...');
fs.writeFileSync(path.join(publicDir, 'pwa-512x512.png'), createPng(512, 512, drawStandardIcon));

// Generate maskable 512x512
console.log('Generating pwa-maskable-512x512.png...');
fs.writeFileSync(path.join(publicDir, 'pwa-maskable-512x512.png'), createPng(512, 512, drawMaskableIcon));

// Generate apple-touch-icon 180x180
console.log('Generating apple-touch-icon.png...');
fs.writeFileSync(path.join(publicDir, 'apple-touch-icon.png'), createPng(180, 180, drawStandardIcon));

// Generate favicon-32x32.png
console.log('Generating favicon-32x32.png...');
fs.writeFileSync(path.join(publicDir, 'favicon-32x32.png'), createPng(32, 32, drawStandardIcon));

console.log('All PWA icon assets generated successfully!');
