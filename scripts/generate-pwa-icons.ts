import { deflateSync } from 'node:zlib';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const dir = join(dirname(fileURLToPath(import.meta.url)), '../static');

function crcTable() {
	const table = new Uint32Array(256);
	for (let n = 0; n < 256; n++) {
		let c = n;
		for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
		table[n] = c;
	}
	return table;
}

const CRC = crcTable();

function crc32(buf: Uint8Array): number {
	let c = 0xffffffff;
	for (const b of buf) c = CRC[(c ^ b) & 0xff]! ^ (c >>> 8);
	return (c ^ 0xffffffff) >>> 0;
}

function chunk(type: string, data: Uint8Array): Uint8Array {
	const out = new Uint8Array(8 + data.length + 4);
	const view = new DataView(out.buffer);
	view.setUint32(0, data.length);
	for (let i = 0; i < 4; i++) out[4 + i] = type.charCodeAt(i);
	out.set(data, 8);
	const crcSrc = out.subarray(4, 8 + data.length);
	view.setUint32(8 + data.length, crc32(crcSrc));
	return out;
}

const BG = [0x0f, 0x12, 0x15] as const;
const CELLS = [
	[0xb8, 0x5c, 0x5a],
	[0xc9, 0x8a, 0x3f],
	[0xc4, 0xb2, 0x30],
	[0x4f, 0x9a, 0x62],
	[0xd5, 0xdd, 0xf5],
	[0x20, 0xa3, 0xa3],
	[0x4a, 0x8f, 0xc4],
	[0x80, 0x79, 0xd0],
	[0xc2, 0x6a, 0x9c]
] as const;

function inRoundRect(px: number, py: number, x: number, y: number, w: number, h: number, rad: number) {
	const cx = Math.min(Math.max(px, x + rad), x + w - rad);
	const cy = Math.min(Math.max(py, y + rad), y + h - rad);
	const dx = px - cx;
	const dy = py - cy;
	return dx * dx + dy * dy <= rad * rad;
}

function png(size: number): Uint8Array {
	const raw = new Uint8Array(size * (1 + size * 4));
	const pad = size * (14 / 150);
	const gap = size * (7 / 150);
	const cell = (size - pad * 2 - gap * 2) / 3;
	const rad = cell * (8 / 36);
	for (let y = 0; y < size; y++) {
		const row = y * (1 + size * 4);
		raw[row] = 0;
		for (let x = 0; x < size; x++) {
			let r = BG[0];
			let g = BG[1];
			let b = BG[2];
			const samples = [
				[0.25, 0.25],
				[0.75, 0.25],
				[0.25, 0.75],
				[0.75, 0.75]
			];
			let hit = 0;
			let hr = 0;
			let hg = 0;
			let hb = 0;
			for (const [sx, sy] of samples) {
				const px = x + sx;
				const py = y + sy;
				for (let i = 0; i < 9; i++) {
					const col = i % 3;
					const line = (i - col) / 3;
					const cx0 = pad + col * (cell + gap);
					const cy0 = pad + line * (cell + gap);
					const color = CELLS[i]!;
					const inside =
						i === 4
							? (px - (cx0 + cell / 2)) ** 2 + (py - (cy0 + cell / 2)) ** 2 <=
								(cell / 2) ** 2
							: inRoundRect(px, py, cx0, cy0, cell, cell, rad);
					if (inside) {
						hit++;
						hr += color[0];
						hg += color[1];
						hb += color[2];
						break;
					}
				}
			}
			if (hit) {
				r = Math.round((r * (4 - hit) + hr) / 4);
				g = Math.round((g * (4 - hit) + hg) / 4);
				b = Math.round((b * (4 - hit) + hb) / 4);
			}
			const i = row + 1 + x * 4;
			raw[i] = r;
			raw[i + 1] = g;
			raw[i + 2] = b;
			raw[i + 3] = 255;
		}
	}

	const ihdr = new Uint8Array(13);
	const view = new DataView(ihdr.buffer);
	view.setUint32(0, size);
	view.setUint32(4, size);
	ihdr[8] = 8;
	ihdr[9] = 6;
	const idat = deflateSync(raw);
	const sig = Uint8Array.of(137, 80, 78, 71, 13, 10, 26, 10);
	const parts = [sig, chunk('IHDR', ihdr), chunk('IDAT', idat), chunk('IEND', new Uint8Array(0))];
	const total = parts.reduce((n, p) => n + p.length, 0);
	const out = new Uint8Array(total);
	let o = 0;
	for (const p of parts) {
		out.set(p, o);
		o += p.length;
	}
	return out;
}

mkdirSync(dir, { recursive: true });
writeFileSync(join(dir, 'icon-192.png'), png(192));
writeFileSync(join(dir, 'icon-512.png'), png(512));
writeFileSync(join(dir, 'apple-touch-icon.png'), png(180));
console.log('wrote PWA icons');
