import { createClient, type Client } from '@libsql/client';
import { env } from '$env/dynamic/private';

/**
 * One SQLite table backs both surfaces: a device-sync row keyed by the
 * owner's personal sync key, and a published share row keyed by its public
 * id. The row's `secret` column authorizes writes; reads only need the key.
 *
 * Dev without a Turso account: set TURSO_DATABASE_URL=file:./local/charts.db.
 * Production: the libsql:// URL plus TURSO_AUTH_TOKEN.
 */
let client: Client | null = null;
let schemaReady: Promise<void> | null = null;

function databaseUrl(): string {
	const raw = env.TURSO_DATABASE_URL?.trim();
	if (!raw) {
		throw new Error('TURSO_DATABASE_URL is not set.');
	}
	return raw;
}

export function db(): Client {
	client ??= createClient({
		url: databaseUrl(),
		authToken: env.TURSO_AUTH_TOKEN?.trim() || undefined
	});
	return client;
}

const SCHEMA = `
	CREATE TABLE IF NOT EXISTS charts (
		key TEXT PRIMARY KEY,
		secret TEXT NOT NULL,
		data TEXT NOT NULL,
		updated_at INTEGER NOT NULL
	)
`;

export function initDb(): Promise<void> {
	schemaReady ??= db()
		.execute(SCHEMA)
		.then(() => undefined);
	return schemaReady;
}
