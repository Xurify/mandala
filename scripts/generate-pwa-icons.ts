import { deflateSync } from 'node:zlib';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { arcPath, BRAND, pillarArc, toHex, type Arc, type RingGeometry } from '../src/lib/chart/ring';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const staticDir = join(root, 'static');
const assetsDir = join(root, 'src/lib/assets');

type Rgb = readonly [number, number, number];

/** App icons are full-bleed so iOS/Android masks can crop them; content stays inside the 80% safe zone. */
const APP = { radius: 0.28, stroke: 0.105, gap: 7, dot: 0.085 };
/** Favicon is read at 16px, so the ring runs larger and thicker on a rounded tile. */
const FAVICON = { radius: 31, stroke: 15, gap: 8, dot: 11, tile: 24 };

function crcTable(): Uint32Array {
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
	view.setUint32(8 + data.length, crc32(out.subarray(4, 8 + data.length)));
	return out;
}

function encodePng(size: number, rgba: Uint8Array): Uint8Array {
	const raw = new Uint8Array(size * (1 + size * 4));
	for (let y = 0; y < size; y++) {
		raw[y * (1 + size * 4)] = 0;
		raw.set(rgba.subarray(y * size * 4, (y + 1) * size * 4), y * (1 + size * 4) + 1);
	}
	const ihdr = new Uint8Array(13);
	const view = new DataView(ihdr.buffer);
	view.setUint32(0, size);
	view.setUint32(4, size);
	ihdr[8] = 8;
	ihdr[9] = 6;
	const parts = [
		Uint8Array.of(137, 80, 78, 71, 13, 10, 26, 10),
		chunk('IHDR', ihdr),
		chunk('IDAT', deflateSync(raw)),
		chunk('IEND', new Uint8Array(0))
	];
	const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0));
	let offset = 0;
	for (const part of parts) {
		out.set(part, offset);
		offset += part.length;
	}
	return out;
}

function clockwiseAngle(dx: number, dy: number): number {
	return ((Math.atan2(dy, dx) * 180) / Math.PI + 90 + 360) % 360;
}

function onArc(dx: number, dy: number, arc: Arc, { radius, stroke }: RingGeometry): boolean {
	const distance = Math.hypot(dx, dy);
	const sweep = arc.end - arc.start;
	const along = (clockwiseAngle(dx, dy) - arc.start + 360) % 360;
	if (along <= sweep && Math.abs(distance - radius) <= stroke / 2) return true;
	for (const angle of [arc.start, arc.end]) {
		const radians = ((angle - 90) * Math.PI) / 180;
		const ex = radius * Math.cos(radians);
		const ey = radius * Math.sin(radians);
		if (Math.hypot(dx - ex, dy - ey) <= stroke / 2) return true;
	}
	return false;
}

function colorAt(dx: number, dy: number, arcs: Arc[]): Rgb {
	if (Math.hypot(dx, dy) <= APP.dot) return BRAND.paper;
	for (let k = 0; k < arcs.length; k++) {
		if (onArc(dx, dy, arcs[k]!, APP)) return BRAND.pillars[k]!;
	}
	return BRAND.ink;
}

function appIcon(size: number): Uint8Array {
	const arcs = Array.from({ length: 8 }, (_, k) => pillarArc(k, APP));
	const rgba = new Uint8Array(size * size * 4);
	const offsets = [0.125, 0.375, 0.625, 0.875];
	for (let y = 0; y < size; y++) {
		for (let x = 0; x < size; x++) {
			let r = 0;
			let g = 0;
			let b = 0;
			for (const sy of offsets) {
				for (const sx of offsets) {
					const color = colorAt((x + sx) / size - 0.5, (y + sy) / size - 0.5, arcs);
					r += color[0];
					g += color[1];
					b += color[2];
				}
			}
			const i = (y * size + x) * 4;
			rgba[i] = Math.round(r / 16);
			rgba[i + 1] = Math.round(g / 16);
			rgba[i + 2] = Math.round(b / 16);
			rgba[i + 3] = 255;
		}
	}
	return encodePng(size, rgba);
}

function ringPaths(cx: number, cy: number, geometry: RingGeometry, indent: string): string {
	return BRAND.pillars
		.map((color, k) => {
			const { start, end } = pillarArc(k, geometry);
			return `${indent}<path d="${arcPath(cx, cy, geometry.radius, start, end)}" stroke="${toHex(color)}"/>`;
		})
		.join('\n');
}

function faviconSvg(): string {
	const { radius, stroke, gap, dot, tile } = FAVICON;
	return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">
	<rect width="100" height="100" rx="${tile}" fill="${toHex(BRAND.ink)}"/>
	<g fill="none" stroke-width="${stroke}" stroke-linecap="round">
${ringPaths(50, 50, { radius, stroke, gap }, '\t\t')}
	</g>
	<circle cx="50" cy="50" r="${dot}" fill="${toHex(BRAND.paper)}"/>
</svg>
`;
}

function logoSvg(): string {
	const geometry = { radius: 34, stroke: 14, gap: 7 };
	return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 96" fill="none">
	<g stroke-width="${geometry.stroke}" stroke-linecap="round">
${ringPaths(48, 48, geometry, '\t\t')}
	</g>
	<circle cx="48" cy="48" r="12" fill="${toHex(BRAND.ink)}"/>
	<text
		x="112"
		y="66"
		fill="${toHex(BRAND.ink)}"
		font-family="Source Sans 3 Variable, Source Sans 3, Segoe UI, sans-serif"
		font-size="54"
		font-weight="560"
		letter-spacing="-1.2"
	>Mandala</text>
</svg>
`;
}

mkdirSync(staticDir, { recursive: true });
writeFileSync(join(staticDir, 'icon-192.png'), appIcon(192));
writeFileSync(join(staticDir, 'icon-512.png'), appIcon(512));
writeFileSync(join(staticDir, 'apple-touch-icon.png'), appIcon(180));
writeFileSync(join(assetsDir, 'favicon.svg'), faviconSvg());
writeFileSync(join(assetsDir, 'logo.svg'), logoSvg());
console.log('wrote app icons, favicon.svg, logo.svg');
