import {
	blockOfK,
	blockOfKey,
	emptyChart,
	exportText,
	filledCount,
	getByKey,
	hasContent,
	idx,
	inkChanged,
	inkOf,
	markCaptionKept,
	progressMilestones,
	searchHits,
	setByKey,
	STORAGE_KEY,
	unreadKeys,
	type ChartData,
	type InputMode,
	type Milestones
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
import { exampleChart } from './example.ts';
import { buildChart, type Preset } from './presets/index.ts';

export type AppTheme = 'system' | 'light' | 'dark';
export type ViewMode = 'view' | 'edit' | 'split';
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
		if (storedMode === 'view' || storedMode === 'edit' || storedMode === 'split') {
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
	mode: InputMode = $state('type');
	theme: AppTheme = $state(loadInitialTheme());
	viewMode: ViewMode = $state(loadInitialViewMode());
	viewScale: ViewScale = $state(loadInitialViewScale());
	fingerDraw = $state(false);
	query = $state('');
	status = $state('');
	reading = $state(false);
	exportFallback = $state('');
	saveWarned = $state(false);
	themeTick = $state(0);
	hoveredColorIndex = $state<number | null>(null);
	focusedKey = $state<string | null>(null);

	#saveTimer: ReturnType<typeof setTimeout> | null = null;
	#statusTimer: ReturnType<typeof setTimeout> | null = null;
	#readAbort: AbortController | null = null;

	filled = $derived(filledCount(this.data));
	hits = $derived(searchHits(this.data, this.query));
	unread = $derived(unreadKeys(this.data));
	dirty = $derived(hasContent(this.data));
	milestones: Milestones = $derived(progressMilestones(this.data));
	charts: ChartSummary[] = $derived(
		summarize(this.#library.charts, this.#library.activeId, this.data)
	);
	chartCount = $derived(this.#library.charts.length);
	canAddChart = $derived(this.#library.charts.length < CHART_CAP);
	canDeleteChart = $derived(this.#library.charts.length > 1);

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

	setMode(mode: InputMode): void {
		this.mode = mode;
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
		markCaptionKept(this.data, key);
		this.save();
	}

	pushStroke(key: string, stroke: number[]): void {
		const existing = this.data.ink[key] ?? [];
		this.data.ink[key] = [...existing, stroke];
		inkChanged(this.data, key);
		this.save();
	}

	undoStroke(key: string): void {
		const existing = this.data.ink[key];
		if (!existing?.length) return;
		existing.pop();
		if (!existing.length) delete this.data.ink[key];
		inkChanged(this.data, key);
		this.save();
	}

	clearInk(key: string): void {
		if (!this.data.ink[key]) return;
		delete this.data.ink[key];
		inkChanged(this.data, key);
		this.save();
	}

	textOf(key: string): string {
		return getByKey(this.data, key);
	}

	strokesOf(key: string): number[][] {
		return inkOf(this.data, key);
	}

	exported(): string {
		return exportText(this.data);
	}

	jumpToKey(key: string): void {
		this.select(blockOfKey(key));
		this.focusedKey = key;
		if (this.viewMode === 'view') {
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

	beginRead(): AbortSignal {
		this.#readAbort?.abort();
		this.#readAbort = new AbortController();
		this.reading = true;
		return this.#readAbort.signal;
	}

	stopRead(): void {
		this.#readAbort?.abort();
		this.#readAbort = null;
		this.reading = false;
	}

	applyRead(key: string, text: string): boolean {
		const trimmedText = text.replace(/\s+/g, ' ').trim().slice(0, 120);
		if (!trimmedText) return false;
		const current = getByKey(this.data, key).trim();
		if (current === '' || this.data.rd[key] === 'stale') {
			setByKey(this.data, key, trimmedText);
			this.data.rd[key] = 'ink';
			return true;
		}
		return false;
	}
}

export const chart = new ChartStore();
