import { exportJson, parseChart, type ChartData } from './model.ts';

/**
 * Share links carry a whole chart in the URL hash: `#c=z.<base64url>` when
 * gzipped (via CompressionStream, when the browser has it) or `#c=<base64url>`
 * for the plain JSON fallback. `.` never appears in base64url, so the `z.`
 * prefix is unambiguous.
 */
const SHARE_PREFIX = 'c=';
const COMPRESSED_PREFIX = 'z.';

function bytesToBase64Url(bytes: Uint8Array): string {
	let binary = '';
	for (let index = 0; index < bytes.length; index++) {
		binary += String.fromCharCode(bytes[index]!);
	}
	return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function base64UrlToBytes(text: string): Uint8Array | null {
	try {
		const base64 = text.replace(/-/g, '+').replace(/_/g, '/');
		const padded = base64 + '='.repeat((4 - (base64.length % 4)) % 4);
		const binary = atob(padded);
		const bytes = new Uint8Array(binary.length);
		for (let index = 0; index < binary.length; index++) {
			bytes[index] = binary.charCodeAt(index);
		}
		return bytes;
	} catch {
		return null;
	}
}

async function gzipBytes(bytes: Uint8Array): Promise<Uint8Array | null> {
	if (typeof CompressionStream === 'undefined') return null;
	try {
		const stream = new Blob([bytes as BlobPart])
			.stream()
			.pipeThrough(new CompressionStream('gzip'));
		const buffer = await new Response(stream).arrayBuffer();
		return new Uint8Array(buffer);
	} catch {
		return null;
	}
}

async function gunzipBytes(bytes: Uint8Array): Promise<Uint8Array | null> {
	if (typeof DecompressionStream === 'undefined') return null;
	try {
		const stream = new Blob([bytes as BlobPart])
			.stream()
			.pipeThrough(new DecompressionStream('gzip'));
		const buffer = await new Response(stream).arrayBuffer();
		return new Uint8Array(buffer);
	} catch {
		return null;
	}
}

export function isShareHash(hash: string): boolean {
	return hash.startsWith(`#${SHARE_PREFIX}`);
}

export async function encodeChartShare(data: ChartData): Promise<string> {
	const raw = new TextEncoder().encode(exportJson(data));
	const compressed = await gzipBytes(raw);
	if (compressed && compressed.length < raw.length) {
		return `${SHARE_PREFIX}${COMPRESSED_PREFIX}${bytesToBase64Url(compressed)}`;
	}
	return SHARE_PREFIX + bytesToBase64Url(raw);
}

export function shareUrl(data: ChartData): Promise<string> {
	return encodeChartShare(data).then((payload) => `${location.origin}${location.pathname}#${payload}`);
}

export async function decodeChartShare(hash: string): Promise<ChartData | null> {
	if (!isShareHash(hash)) return null;
	const payload = hash.slice(1 + SHARE_PREFIX.length).trim();
	if (!payload) return null;
	const compressed = payload.startsWith(COMPRESSED_PREFIX);
	const bytes = base64UrlToBytes(compressed ? payload.slice(COMPRESSED_PREFIX.length) : payload);
	if (!bytes) return null;
	let text: string | null = null;
	if (compressed) {
		const raw = await gunzipBytes(bytes);
		if (raw) text = new TextDecoder().decode(raw);
	} else {
		text = new TextDecoder().decode(bytes);
	}
	if (!text) return null;
	return parseChart(text);
}
