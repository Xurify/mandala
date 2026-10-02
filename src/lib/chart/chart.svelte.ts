import {
	blockOfK,
	blockOfKey,
	emptyChart,
	exportText,
	filledCount,
	getDayLog,
	getMeta,
	getWeekReflection,
	getByKey,
	hasContent,
	idx,
	pillarActivityLast7,
	progressMilestones,
	searchHits,
	setByKey,
	setMeta,
	STORAGE_KEY,
	todayKey,
	weekStartKey,
	type ActionMeta,
	type ChartData,
	type DayLog,
	type Milestones,
	type WeekReflection
} from './model.ts';
import {
	CHART_CAP,
	LIBRARY_KEY,
	activeRecord,
	cloneChart,
	emptyLibrary,
	flushActive,
	migrateFromV1,
	newRecord,
	parseLibrary,
	summarize,
	type ChartLibrary,
	type ChartSummary
} from './library.ts';
import { exampleChart, isExampleChart } from './example.ts';
import { buildChart, type Preset } from './presets/index.ts';
import {
	clearBackupHandle,
	loadBackupHandle,
	pickBackupDirectory,
	queryBackupPermission,
	requestBackupPermission,
	saveBackupHandle,
	supportsDirectoryPicker,
	writeBackupFile
} from './backup.ts';

export type AppTheme = 'system' | 'light' | 'dark';
export type ViewMode = 'view' | 'edit' | 'split' | 'today' | 'year';
export type BackupState = 'off' | 'on' | 'needs-permission';
export type ViewScale = 'fit' | 'large';

function loadInitialTheme(): AppTheme {
	if (typeof window === 'undefined') return 'system';
	try {
		const storedTheme = localStorage.getItem('theme');
		if (storedTheme === 'dark' || storedTheme === 'light') {
			return storedTheme;
		}
		return 'system';
	} catch {
		return 'system';
	}
}

function loadInitialViewMode(): ViewMode {
	if (typeof window === 'undefined') return 'view';
	try {
		const storedMode = localStorage.getItem('mandala_view_mode');
		if (
			storedMode === 'view' ||
			storedMode === 'edit' ||
			storedMode === 'split' ||
			storedMode === 'today' ||
			storedMode === 'year'
		) {
			return storedMode;
		}
		return 'view';
	} catch {
		return 'view';
	}
}

function loadInitialViewScale(): ViewScale {
	if (typeof window === 'undefined') return 'fit';
	try {
		const storedScale = localStorage.getItem('mandala_view_scale');
		if (storedScale === 'fit' || storedScale === 'large') {
			return storedScale;
		}
		return 'fit';
	} catch {
		return 'fit';
	}
}

function loadInitialLibrary(): ChartLibrary {
	if (typeof window === 'undefined') {
		return emptyLibrary();
	}
	try {
		const rawLibrary = localStorage.getItem(LIBRARY_KEY);
		if (rawLibrary) {
			const parsed = parseLibrary(rawLibrary);
			if (parsed) return parsed;
		}
		return migrateFromV1(localStorage.getItem(STORAGE_KEY));
	} catch {
		return emptyLibrary();
	}
}

const bootLibrary = loadInitialLibrary();

export class ChartStore {
	#library: ChartLibrary = $state(bootLibrary);
	data: ChartData = $state(cloneChart(activeRecord(bootLibrary).data));
	sel = $state(4);
	theme: AppTheme = $state(loadInitialTheme());
	viewMode: ViewMode = $state(loadInitialViewMode());
	viewScale: ViewScale = $state(loadInitialViewScale());
	query = $state('');
	status = $state('');
	exportFallback = $state('');
	saveWarned = $state(false);
	themeTick = $state(0);
	hoveredColorIndex = $state<number | null>(null);
	focusedKey = $state<string | null>(null);

	#saveTimer: ReturnType<typeof setTimeout> | null = null;
	#statusTimer: ReturnType<typeof setTimeout> | null = null;

	#backupHandle: FileSystemDirectoryHandle | null = null;
	backupState: BackupState = $state('off');
	backupLastAt = $state<number | null>(null);
	#backupWarned = false;

	filled = $derived(filledCount(this.data));
	hits = $derived(searchHits(this.data, this.query));
	dirty = $derived(hasContent(this.data));
	milestones: Milestones = $derived(progressMilestones(this.data));
	charts: ChartSummary[] = $derived(
		summarize(this.#library.charts, this.#library.activeId, this.data)
	);
	chartCount = $derived(this.#library.charts.length);
	canAddChart = $derived(this.#library.charts.length < CHART_CAP);
	canDeleteChart = $derived(this.#library.charts.length > 1);

	todayLog: DayLog = $derived(getDayLog(this.data, todayKey()));
	pillarActivity: number[] = $derived(pillarActivityLast7(this.data));
	weekReflectionDue: boolean = $derived.by(() => {
		if (typeof window === 'undefined') return false;
		const now = new Date();
		if (now.getDay() !== 0) return false;
		const weekKey = weekStartKey(now);
		const reflection = getWeekReflection(this.data, weekKey);
		if (reflection.dismissed) return false;
		const hasDayLogThisWeek = this.pillarActivity.some((count) => count > 0);
		return hasDayLogThisWeek;
	});

	load(): void {
		try {
			const rawLibrary = localStorage.getItem(LIBRARY_KEY);
			if (rawLibrary) {
				const parsed = parseLibrary(rawLibrary);
				if (parsed) {
					this.#adopt(parsed);
					return;
				}
			}
			this.#adopt(migrateFromV1(localStorage.getItem(STORAGE_KEY)));
			this.saveNow();
		} catch {
			// private mode / blocked storage
		}
	}

	#adopt(library: ChartLibrary): void {
		this.#library = library;
		this.data = cloneChart(activeRecord(library).data);
		this.sel = 4;
		this.query = '';
	}

	#resetView(): void {
		this.sel = 4;
		this.query = '';
		this.focusedKey = null;
	}

	#flush(): void {
		this.#library.charts = flushActive(
			this.#library.charts,
			this.#library.activeId,
			this.data
		);
	}

	saveNow(): void {
		if (this.#saveTimer) {
			clearTimeout(this.#saveTimer);
			this.#saveTimer = null;
		}
		this.#flush();
		try {
			localStorage.setItem(LIBRARY_KEY, JSON.stringify(this.#library));
			localStorage.setItem(STORAGE_KEY, JSON.stringify(this.data));
		} catch {
			if (!this.saveWarned) {
				this.saveWarned = true;
				this.say('Your browser blocked saving, so this chart will be lost when you close the page.');
			}
		}
		if (this.backupState === 'on') void this.#writeBackup();
	}

	save(): void {
		if (this.#saveTimer) clearTimeout(this.#saveTimer);
		this.#saveTimer = setTimeout(() => this.saveNow(), 300);
	}

	say(message: string, keep = false): void {
		this.status = message;
		if (this.#statusTimer) clearTimeout(this.#statusTimer);
		if (!keep) {
			this.#statusTimer = setTimeout(() => {
				this.status = '';
			}, 5000);
		}
	}

	select(blockIndex: number): void {
		this.sel = blockIndex;
	}

	setViewMode(mode: ViewMode): void {
		this.viewMode = mode;
		document.documentElement.dataset.view = mode;
		try {
			localStorage.setItem('mandala_view_mode', mode);
		} catch {
			// storage blocked
		}
	}

	setViewScale(scale: ViewScale): void {
		this.viewScale = scale;
		if (scale === 'large') document.documentElement.dataset.scale = 'large';
		else delete document.documentElement.dataset.scale;
		try {
			localStorage.setItem('mandala_view_scale', scale);
		} catch {
			// storage blocked
		}
	}

	setQuery(value: string): void {
		this.query = value;
	}

	setText(key: string, value: string): void {
		setByKey(this.data, key, value);
		this.save();
	}

	textOf(key: string): string {
		return getByKey(this.data, key);
	}

	metaOf(key: string): ActionMeta | undefined {
		return getMeta(this.data, key);
	}

	setActionMeta(key: string, patch: Partial<ActionMeta>): void {
		setMeta(this.data, key, patch);
		this.data = { ...this.data };
		this.save();
	}

	toggleDone(key: string): void {
		const current = getMeta(this.data, key);
		const isDone = !current?.done;
		setMeta(this.data, key, {
			kind: current?.kind ?? 'milestone',
			done: isDone,
			doneAt: isDone ? todayKey() : undefined
		});
		this.data = { ...this.data };
		this.save();
	}

	setFocus(dateKey: string, keys: string[]): void {
		if (!this.data.days) this.data.days = {};
		const existing = this.data.days[dateKey] ?? { focus: [], checked: [] };
		this.data.days[dateKey] = { ...existing, focus: keys, started: true };
		this.data = { ...this.data };
		this.save();
	}

	toggleChecked(dateKey: string, key: string): void {
		if (!this.data.days) this.data.days = {};
		const existing = this.data.days[dateKey] ?? { focus: [], checked: [] };
		const isChecked = existing.checked.includes(key);
		this.data.days[dateKey] = {
			...existing,
			checked: isChecked
				? existing.checked.filter((checkedKey) => checkedKey !== key)
				: [...existing.checked, key]
		};
		this.data = { ...this.data };
		this.save();
	}

	saveWeekReflection(weekKey: string, patch: Partial<{ note: string; swapped: string[] }>): void {
		if (!this.data.weeks) this.data.weeks = {};
		const existing = getWeekReflection(this.data, weekKey);
		this.data.weeks[weekKey] = { ...existing, ...patch };
		this.data = { ...this.data };
		this.save();
	}

	dismissWeekNotice(weekKey: string): void {
		if (!this.data.weeks) this.data.weeks = {};
		const existing = getWeekReflection(this.data, weekKey);
		this.data.weeks[weekKey] = { ...existing, dismissed: true };
		this.data = { ...this.data };
		this.save();
	}

	exported(): string {
		return exportText(this.data);
	}

	jumpToKey(key: string): void {
		this.select(blockOfKey(key));
		this.focusedKey = key;
		if (this.viewMode === 'view' || this.viewMode === 'today') {
			this.setViewMode('edit');
		}
	}

	clearFocusedKey(): void {
		this.focusedKey = null;
	}

	selectGoal(): void {
		this.sel = 4;
	}

	selectPillar(pillarIndex: number): void {
		this.sel = blockOfK(pillarIndex);
	}

	selectNextPillar(): void {
		if (this.sel === 4) {
			this.sel = blockOfK(0);
		} else {
			const currentPillar = idx(this.sel);
			const nextPillar = (currentPillar + 1) % 8;
			this.sel = blockOfK(nextPillar);
		}
	}

	selectPreviousPillar(): void {
		if (this.sel === 4) {
			this.sel = blockOfK(7);
		} else {
			const currentPillar = idx(this.sel);
			const previousPillar = (currentPillar + 7) % 8;
			this.sel = blockOfK(previousPillar);
		}
	}

	setTheme(theme: AppTheme): void {
		this.theme = theme;
		try {
			if (theme === 'system') {
				localStorage.removeItem('theme');
				document.documentElement.removeAttribute('data-theme');
			} else {
				localStorage.setItem('theme', theme);
				document.documentElement.setAttribute('data-theme', theme);
			}
		} catch {
			// private mode / storage blocked
		}
		this.bumpTheme();
	}

	applyPreset(preset: Preset): boolean {
		return this.#fillOrSpawn(
			buildChart(preset),
			`${preset.title} preset loaded. Edit any cell to make it yours.`
		);
	}

	loadExample(): boolean {
		return this.#fillOrSpawn(
			exampleChart(),
			'Example chart loaded. Edit any cell to make it yours.'
		);
	}

	checkForMatchingExample(): { id: string; active: boolean } | null {
		if (isExampleChart(this.data)) {
			return { id: this.#library.activeId, active: true };
		}
		let best: { id: string; updatedAt: number } | null = null;
		for (const record of this.#library.charts) {
			if (record.id === this.#library.activeId) continue;
			if (!isExampleChart(record.data)) continue;
			if (!best || record.updatedAt > best.updatedAt) {
				best = { id: record.id, updatedAt: record.updatedAt };
			}
		}
		if (!best) return null;
		return { id: best.id, active: false };
	}

	clearAll(): void {
		this.data = emptyChart();
		this.saveNow();
		this.say('Chart cleared.');
	}

	importChart(importedData: ChartData, message = 'Chart imported.'): boolean {
		return this.#fillOrSpawn(importedData, message);
	}

	applyDraft(next: ChartData): boolean {
		return this.#fillOrSpawn(next, 'Draft ready. Edit any cell to make it yours.');
	}

	newChart(): boolean {
		if (!this.canAddChart) {
			this.say('Chart limit reached (12). Delete one first.');
			return false;
		}
		this.#flush();
		const record = newRecord(emptyChart());
		this.#library.charts = [...this.#library.charts, record];
		this.#library.activeId = record.id;
		this.data = emptyChart();
		this.#resetView();
		this.saveNow();
		this.say('New chart.');
		return true;
	}

	duplicateChart(): boolean {
		if (!this.canAddChart) {
			this.say('Chart limit reached (12). Delete one first.');
			return false;
		}
		this.#flush();
		const record = newRecord(this.data);
		this.#library.charts = [...this.#library.charts, record];
		this.#library.activeId = record.id;
		this.data = cloneChart(record.data);
		this.#resetView();
		this.saveNow();
		this.say('Chart duplicated.');
		return true;
	}

	switchChart(id: string): void {
		if (id === this.#library.activeId) return;
		const record = this.#library.charts.find((chart) => chart.id === id);
		if (!record) return;
		this.#flush();
		this.#library.activeId = id;
		this.data = cloneChart(record.data);
		this.#resetView();
		this.saveNow();
	}

	deleteChart(id: string): void {
		if (this.#library.charts.length <= 1) {
			this.data = emptyChart();
			this.saveNow();
			this.say('Chart cleared.');
			return;
		}
		this.#flush();
		const remaining = this.#library.charts.filter((chart) => chart.id !== id);
		if (remaining.length === this.#library.charts.length) return;
		this.#library.charts = remaining;
		if (this.#library.activeId === id) {
			const next = remaining.slice().sort((a, b) => b.updatedAt - a.updatedAt)[0]!;
			this.#library.activeId = next.id;
			this.data = cloneChart(next.data);
			this.#resetView();
		}
		this.saveNow();
		this.say('Chart deleted.');
	}

	#fillOrSpawn(next: ChartData, message: string): boolean {
		if (!this.dirty) {
			this.data = cloneChart(next);
			this.#resetView();
			this.saveNow();
			this.say(message);
			return true;
		}
		if (!this.canAddChart) {
			this.say('Chart limit reached (12). Delete one first.');
			return false;
		}
		this.#flush();
		const record = newRecord(next);
		this.#library.charts = [...this.#library.charts, record];
		this.#library.activeId = record.id;
		this.data = cloneChart(next);
		this.#resetView();
		this.saveNow();
		this.say(message);
		return true;
	}

	bumpTheme(): void {
		this.themeTick += 1;
	}

	async restoreBackupHandle(): Promise<void> {
		if (!supportsDirectoryPicker()) return;
		const handle = await loadBackupHandle();
		if (!handle) return;
		this.#backupHandle = handle;
		const permission = await queryBackupPermission(handle);
		if (permission === 'granted') {
			this.backupState = 'on';
			await this.#writeBackup();
		} else {
			this.backupState = 'needs-permission';
		}
	}

	async enableBackups(): Promise<void> {
		try {
			const handle = await pickBackupDirectory();
			if (!handle) return;
			this.#backupHandle = handle;
			await saveBackupHandle(handle);
			this.backupState = 'on';
			await this.#writeBackup();
			this.say('Backups on. Your charts now save to that folder as you edit.');
		} catch (error) {
			if ((error as DOMException)?.name === 'AbortError') return;
			this.say('Could not open a backup folder here.');
		}
	}

	async resumeBackups(): Promise<void> {
		const handle = this.#backupHandle;
		if (!handle) return;
		const permission = await requestBackupPermission(handle);
		if (permission === 'granted') {
			this.backupState = 'on';
			await this.#writeBackup();
			this.say('Backups resumed.');
		} else {
			this.say('Backup permission was not granted.');
		}
	}

	async disableBackups(): Promise<void> {
		this.#backupHandle = null;
		this.backupState = 'off';
		this.backupLastAt = null;
		await clearBackupHandle();
		this.say('Backups turned off.');
	}

	async #writeBackup(): Promise<void> {
		const handle = this.#backupHandle;
		if (!handle) return;
		try {
			await writeBackupFile(handle, JSON.stringify(this.#library));
			this.backupLastAt = Date.now();
		} catch (error) {
			if ((error as DOMException)?.name === 'NotAllowedError') {
				this.backupState = 'needs-permission';
				return;
			}
			if (!this.#backupWarned) {
				this.#backupWarned = true;
				this.say('Backup write failed. Charts still save in this browser.');
			}
		}
	}
}

export const chart = new ChartStore();

if (typeof document !== 'undefined') {
	document.documentElement.dataset.view = chart.viewMode;
	if (chart.viewScale === 'large') document.documentElement.dataset.scale = 'large';
	else delete document.documentElement.dataset.scale;
}
