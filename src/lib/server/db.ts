import { createClient, type Client } from '@libsql/client';
import { env } from '$env/dynamic/private';
import { LIMIT_SCHEMA } from './limit';

/**
 * Dev without a Turso account: TURSO_DATABASE_URL=file:./local/charts.db.
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

export function hasDb(): boolean {
	return Boolean(env.TURSO_DATABASE_URL?.trim());
}

export function db(): Client {
	client ??= createClient({
		url: databaseUrl(),
		authToken: env.TURSO_AUTH_TOKEN?.trim() || undefined
	});
	return client;
}

const SCHEMA = [
	`CREATE TABLE IF NOT EXISTS charts (
		key TEXT PRIMARY KEY,
		secret TEXT NOT NULL,
		data TEXT NOT NULL,
		updated_at INTEGER NOT NULL
	)`,
	// `size` sits before `data`, so adding up a room's sizes never reads the sealed charts.
	`CREATE TABLE IF NOT EXISTS sync_rows (
		room TEXT NOT NULL,
		id TEXT NOT NULL,
		size INTEGER NOT NULL,
		updated_at INTEGER NOT NULL,
		data TEXT,
		PRIMARY KEY (room, id)
	)`,
	'CREATE INDEX IF NOT EXISTS sync_rows_by_time ON sync_rows (room, updated_at)',
	LIMIT_SCHEMA
];

export function initDb(): Promise<void> {
	schemaReady ??= db()
		.batch(SCHEMA, 'write')
		.then(() => undefined)
		.catch((error: unknown) => {
			schemaReady = null;
			throw error;
		});
	return schemaReady;
}
