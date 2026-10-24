/**
 * The sync key is the only secret: it names the room on the server and locks what goes into it. Charts are
 * sealed on the device with a key derived from it, so the server holds only what it cannot read. Losing the
 * key loses the way back to that copy, never the charts on the device.
 */

const ALPHABET = '0123456789abcdefghjkmnpqrstvwxyz';
const LENGTH = 25;
const GROUP = 5;
const SALT = 'mandala-sync';
const RAW = 0;
const GZIP = 1;

export type SyncSecrets = { room: string; seal: CryptoKey };

const encoder = new TextEncoder();
const decoder = new TextDecoder();

/** 125 random bits, written in five groups of five. */
export function newSyncKey(): string {
	const bytes = crypto.getRandomValues(new Uint8Array(LENGTH));
	return group(Array.from(bytes, (byte) => ALPHABET[byte & 31]).join(''));
}

/** As typed or pasted: any case, any spacing or dashes, and the letters people confuse with digits. */
export function normalizeSyncKey(typed: string): string | null {
	const plain = typed
		.toLowerCase()
		.replace(/[il]/g, '1')
		.replace(/o/g, '0')
		.replace(/[^0-9a-z]/g, '');
	if (plain.length !== LENGTH || [...plain].some((char) => !ALPHABET.includes(char))) return null;
	return group(plain);
}

function group(plain: string): string {
	return plain.match(new RegExp(`.{1,${GROUP}}`, 'g'))!.join('-');
}

export async function syncSecrets(key: string): Promise<SyncSecrets> {
	const material = await crypto.subtle.importKey('raw', encoder.encode(key.replace(/-/g, '')), 'HKDF', false, ['deriveBits', 'deriveKey']);
	const params = (info: string) => ({ name: 'HKDF', hash: 'SHA-256', salt: encoder.encode(SALT), info: encoder.encode(info) });
	const roomBits = await crypto.subtle.deriveBits(params('room'), material, 256);
	const seal = await crypto.subtle.deriveKey(params('seal'), material, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
	return { room: toHex(new Uint8Array(roomBits)), seal };
}

/** `id` is bound into the seal, so a row moved under another id fails to open. */
export async function sealText(key: CryptoKey, id: string, text: string): Promise<string> {
	const packed = await pack(encoder.encode(text));
	const iv = crypto.getRandomValues(new Uint8Array(12));
	const sealed = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv, additionalData: encoder.encode(id) }, key, packed));
	const out = new Uint8Array(iv.length + sealed.length);
	out.set(iv);
	out.set(sealed, iv.length);
	return toBase64(out);
}

export async function openText(key: CryptoKey, id: string, sealed: string): Promise<string> {
	const bytes = fromBase64(sealed);
	const packed = await crypto.subtle.decrypt(
		{ name: 'AES-GCM', iv: bytes.subarray(0, 12), additionalData: encoder.encode(id) },
		key,
		bytes.subarray(12)
	);
	return decoder.decode(await unpack(new Uint8Array(packed)));
}

async function pack(bytes: Uint8Array): Promise<Uint8Array<ArrayBuffer>> {
	if (typeof CompressionStream === 'undefined') return withHead(RAW, bytes);
	return withHead(GZIP, await through(bytes, new CompressionStream('gzip')));
}

async function unpack(bytes: Uint8Array<ArrayBuffer>): Promise<Uint8Array<ArrayBuffer>> {
	const body = bytes.subarray(1);
	if (bytes[0] === RAW) return body;
	if (bytes[0] === GZIP) return through(body, new DecompressionStream('gzip'));
	throw new Error('Unknown sync format.');
}

function withHead(head: number, body: Uint8Array): Uint8Array<ArrayBuffer> {
	const out = new Uint8Array(body.length + 1);
	out[0] = head;
	out.set(body, 1);
	return out;
}

async function through(bytes: Uint8Array, stream: CompressionStream | DecompressionStream): Promise<Uint8Array<ArrayBuffer>> {
	const piped = new Blob([bytes as BlobPart]).stream().pipeThrough(stream);
	return new Uint8Array(await new Response(piped).arrayBuffer());
}

function toHex(bytes: Uint8Array): string {
	return Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
}

function toBase64(bytes: Uint8Array): string {
	let binary = '';
	for (let index = 0; index < bytes.length; index += 0x8000) binary += String.fromCharCode(...bytes.subarray(index, index + 0x8000));
	return btoa(binary);
}

function fromBase64(text: string): Uint8Array<ArrayBuffer> {
	const binary = atob(text);
	const bytes = new Uint8Array(binary.length);
	for (let index = 0; index < binary.length; index++) bytes[index] = binary.charCodeAt(index);
	return bytes;
}
