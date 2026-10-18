import { crc32, deflateSync } from 'node:zlib';

export type Rgb = readonly [number, number, number];

/** A width × height PNG of one opaque colour, for tiles whose pixels a test can check. */
export function solidPng(
  width: number,
  height: number,
  [r, g, b]: Rgb,
): Buffer {
  // Each scanline: filter type 0 (none), then RGB triplets.
  const row = Buffer.alloc(1 + width * 3);
  for (let x = 0; x < width; x++) {
    row.set([r, g, b], 1 + x * 3);
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr.set([8, 2, 0, 0, 0], 8); // 8-bit RGB, no interlace
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(Buffer.concat(Array(height).fill(row)))),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

function chunk(type: string, data: Buffer): Buffer {
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([length, body, crc]);
}
