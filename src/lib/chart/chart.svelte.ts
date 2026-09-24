import {
	blockOfKey,
	emptyChart,
	exampleChart,
	exportText,
	filledCount,
	getByKey,
	hasContent,
	inkChanged,
	inkOf,
	markCaptionKept,
	parseChart,
	searchHits,
	setByKey,
	STORAGE_KEY,
	unreadKeys,
	type ChartData,
	type InputMode
} from './model.ts';

export class ChartStore {
	data: ChartData = $state(emptyChart());
	sel = $state(4);
	mode: InputMode = $state('type');
	fingerDraw = $state(false);
	query = $state('');
	status = $state('');
	reading = $state(false);
	exportFallback = $state('');
	saveWarned = $state(false);
	themeTick = $state(0);
	hoveredColorIndex = $state<number | null>(null);

	#saveTimer: ReturnType<typeof setTimeout> | null = null;
	#statusTimer: ReturnType<typeof setTimeout> | null = null;
	#readAbort: AbortController | null = null;

	filled = $derived(filledCount(this.data));
	hits = $derived(searchHits(this.data, this.query));
	unread = $derived(unreadKeys(this.data));
	dirty = $derived(hasContent(this.data));

	load(): void {
		try {
			const raw = localStorage.getItem(STORAGE_KEY);
			if (!raw) return;
			const parsed = parseChart(raw);
			if (parsed) this.data = parsed;
		} catch {
			// private mode / blocked storage
		}
	}

	saveNow(): void {
		if (this.#saveTimer) {
			clearTimeout(this.#saveTimer);
			this.#saveTimer = null;
		}
		try {
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
	}

	loadExample(): void {
		this.data = exampleChart();
		this.saveNow();
		this.say('Example loaded. Edit any cell to make it yours.');
	}

	clearAll(): void {
		this.data = emptyChart();
		this.saveNow();
		this.say('Chart cleared.');
	}

	importChart(importedData: ChartData): void {
		this.data = importedData;
		this.sel = 4;
		this.saveNow();
		this.say('Chart imported successfully.');
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
