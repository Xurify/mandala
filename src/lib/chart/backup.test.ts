import { describe, expect, it } from 'vitest';
import {
	clearBackupHandle,
	loadBackupHandle,
	saveBackupHandle
} from './backup.ts';

const hasIndexedDb = typeof indexedDB !== 'undefined';

describe('backup handle store', () => {
	it.skipIf(!hasIndexedDb)('persists and clears a handle', async () => {
		const handle = { name: 'Mandala backups', kind: 'directory' } as FileSystemDirectoryHandle;
		await saveBackupHandle(handle);
		expect(await loadBackupHandle()).toEqual(handle);
		await clearBackupHandle();
		expect(await loadBackupHandle()).toBeNull();
	});

	it.skipIf(!hasIndexedDb)('returns null when nothing was stored', async () => {
		await clearBackupHandle();
		expect(await loadBackupHandle()).toBeNull();
	});
});
