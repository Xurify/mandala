export type IdKind = 'chart' | 'action' | 'tool' | 'share' | 'session';

export type Id<Kind extends IdKind> = `${Kind}_${string}`;

const ALPHABET = '0123456789abcdefghjkmnpqrstvwxyz';
const SUFFIX = /^[0-7][0-9a-hjkmnp-tv-z]{25}$/;

/**
 * A TypeID: what the id names, then a UUIDv7 in lowercase Crockford base32. Ids sort by when they were
 * made, read at a glance (`action_01k7…`), and turn back into a UUID for a database column.
 */
export function newId<Kind extends IdKind>(kind: Kind, now: number = Date.now()): Id<Kind> {
	const bytes = crypto.getRandomValues(new Uint8Array(16));
	let time = now;
	for (let index = 5; index >= 0; index--) {
		bytes[index] = time % 256;
		time = Math.floor(time / 256);
	}
	bytes[6] = (bytes[6]! & 0x0f) | 0x70;
	bytes[8] = (bytes[8]! & 0x3f) | 0x80;
	let value = 0n;
	for (const byte of bytes) value = (value << 8n) | BigInt(byte);
	let suffix = '';
	for (let index = 0; index < 26; index++) {
		suffix = ALPHABET[Number(value & 31n)] + suffix;
		value >>= 5n;
	}
	return `${kind}_${suffix}`;
}

export function isId<Kind extends IdKind>(kind: Kind, value: unknown): value is Id<Kind> {
	return typeof value === 'string' && value.startsWith(`${kind}_`) && SUFFIX.test(value.slice(kind.length + 1));
}
