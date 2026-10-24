import { describe, expect, it } from 'vitest';
import { libsqlUrl } from './db';

describe('libsqlUrl', () => {
	it('rewrites the turso scheme to the one the client accepts', () => {
		expect(libsqlUrl('turso://charts-org.turso.io')).toBe('libsql://charts-org.turso.io');
	});

	it('leaves other urls as they are', () => {
		expect(libsqlUrl('libsql://charts-org.turso.io')).toBe('libsql://charts-org.turso.io');
		expect(libsqlUrl('file:./local/charts.db')).toBe('file:./local/charts.db');
	});
});
