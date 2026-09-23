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

function png(size: number): Uint8Array {
	const raw = new Uint8Array(size * (1 + size * 4));
	const cx = (size - 1) / 2;
	const rOuter = size * 0.42;
	const rInner = size * 0.14;
	for (let y = 0; y < size; y++) {
		const row = y * (1 + size * 4);
		raw[row] = 0;
		for (let x = 0; x < size; x++) {
			const dx = x - cx;
			const dy = y - cx;
			const d = Math.sqrt(dx * dx + dy * dy);
			const i = row + 1 + x * 4;
			let r = 31;
			let g = 34;
			let b = 40;
			if (d < rOuter) {
				r = 91;
				g = 79;
				b = 212;
			}
			if (d < rInner) {
				r = 244;
				g = 245;
				b = 247;
			}
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
