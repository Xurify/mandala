import type { ChartData } from './model.ts';
import { exportFilename, exportJson } from './model.ts';

export const BACKUP_FILENAME = 'mandala-backup.json';

type PermissionState = 'granted' | 'denied' | 'prompt';

/** File System Access permission methods are newer than the TS DOM lib. */
type PermissionedDirectoryHandle = FileSystemDirectoryHandle & {
	queryPermission?: (descriptor: { mode: 'read' | 'readwrite' }) => Promise<PermissionState>;
	requestPermission?: (descriptor: { mode: 'read' | 'readwrite' }) => Promise<PermissionState>;
};

declare global {
	interface Window {
		showDirectoryPicker?: (options?: { mode?: 'read' | 'readwrite' }) => Promise<FileSystemDirectoryHandle>;
	}
}

export function supportsDirectoryPicker(): boolean {
	return typeof window !== 'undefined' && typeof window.showDirectoryPicker === 'function';
}

export async function pickBackupDirectory(): Promise<FileSystemDirectoryHandle | null> {
	if (!window.showDirectoryPicker) return null;
	try {
		return await window.showDirectoryPicker({ mode: 'readwrite' });
	} catch (error) {
		if ((error as DOMException)?.name === 'AbortError') return null;
		throw error;
	}
}

export async function queryBackupPermission(
	handle: FileSystemDirectoryHandle
): Promise<PermissionState> {
	const permissioned = handle as PermissionedDirectoryHandle;
	if (!permissioned.queryPermission) return 'prompt';
	try {
		return await permissioned.queryPermission({ mode: 'readwrite' });
	} catch {
		return 'prompt';
	}
}

export async function requestBackupPermission(
	handle: FileSystemDirectoryHandle
): Promise<PermissionState> {
	const permissioned = handle as PermissionedDirectoryHandle;
	if (!permissioned.requestPermission) return 'denied';
	try {
		return await permissioned.requestPermission({ mode: 'readwrite' });
	} catch {
		return 'denied';
	}
}

const DB_NAME = 'mandala-backup';
const STORE = 'handles';
const KEY = 'backup-dir';

function openDb(): Promise<IDBDatabase> {
	return new Promise((resolve, reject) => {
		const request = indexedDB.open(DB_NAME, 1);
		request.onupgradeneeded = () => {
			const db = request.result;
			if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE);
		};
		request.onsuccess = () => resolve(request.result);
		request.onerror = () => reject(request.error);
	});
}

function withStore<T>(
	mode: IDBTransactionMode,
	run: (store: IDBObjectStore) => IDBRequest<T>
): Promise<T> {
	return openDb().then(
		(db) =>
			new Promise<T>((resolve, reject) => {
				const tx = db.transaction(STORE, mode);
				const request = run(tx.objectStore(STORE));
				request.onsuccess = () => resolve(request.result);
				request.onerror = () => reject(request.error);
				tx.oncomplete = () => db.close();
			})
	);
}

export async function saveBackupHandle(handle: FileSystemDirectoryHandle): Promise<void> {
	await withStore('readwrite', (store) => store.put(handle, KEY));
}

export async function loadBackupHandle(): Promise<FileSystemDirectoryHandle | null> {
	try {
		const handle = await withStore<FileSystemDirectoryHandle | undefined>('readonly', (store) =>
			store.get(KEY)
		);
		return handle ?? null;
	} catch {
		return null;
	}
}

export async function clearBackupHandle(): Promise<void> {
	try {
		await withStore('readwrite', (store) => store.delete(KEY));
	} catch {
		// nothing to clear
	}
}

export async function writeBackupFile(
	handle: FileSystemDirectoryHandle,
	json: string
): Promise<void> {
	const fileHandle = await handle.getFileHandle(BACKUP_FILENAME, { create: true });
	const writable = await fileHandle.createWritable();
	try {
		await writable.write(json);
	} finally {
		await writable.close();
	}
}

export function downloadText(filename: string, text: string, mime = 'application/json'): void {
	const blob = new Blob([text], { type: mime });
	const downloadUrl = URL.createObjectURL(blob);
	const downloadLink = document.createElement('a');
	downloadLink.href = downloadUrl;
	downloadLink.download = filename;
	downloadLink.click();
	URL.revokeObjectURL(downloadUrl);
}

export function downloadChartJson(data: ChartData): void {
	downloadText(exportFilename(data), exportJson(data));
}
