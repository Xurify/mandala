import { chart } from './chart.svelte';
import { chatLink, fillPrompt, isChatApp, newChartPrompt, parseDraftText, reviewPrompt, type ChatApp } from './draft.ts';
import {
	askPrompt,
	editWords,
	fillEdits,
	gapsOf,
	greetingInsight,
	insightSignature,
	moodFor,
	norm,
	reviewChart,
	reviseEdits,
	suggestToday,
	suggestWeek,
	type CellEdit,
	type HelperInsight,
	type HelperMood,
	type HelperPage,
	type HelperPick,
	type WriteMode
} from './helper.ts';
import { blockOfK, hasContent, todayKey, wholeness, type ActionId, type ChartData, type Ref } from './model.ts';

export type { CellEdit, ChatApp, HelperMood, HelperPage, HelperPick, WriteMode };

export type HelperTarget = {
	data(): ChartData;
	applyDraft(next: ChartData): boolean;
	setCells(edits: CellEdit[]): void;
	setToday(ids: ActionId[]): void;
	pinWeek(ids: ActionId[]): void;
	showCell(ref: Ref): void;
	decline?(ids: ActionId[]): void;
	noteShown?(signature: string): void;
	openTool?(pillarIndex: number, id: string): void;
	openCalendar?(): void;
	chartId?(): string;
};

export type HelperPicks = { scope: 'today' | 'week'; picks: HelperPick[] };

const CHAT_APP_KEY = 'mandala_chat_app';

function loadChatApp(): ChatApp {
	try {
		const stored = typeof localStorage === 'undefined' ? null : localStorage.getItem(CHAT_APP_KEY);
		return isChatApp(stored) ? stored : 'claude';
	} catch {
		return 'claude';
	}
}

export type HelperOutcome =
	| { kind: 'chart'; data: ChartData }
	| { kind: 'cells'; edits: CellEdit[] }
	| { kind: 'nothing' }
	| { kind: 'unread' };

export type HelperMoment = { title: string; detail: string; pillars: number[] };

export class HelperStore {
	open = $state(false);
	page = $state<HelperPage>('home');
	direction = $state<1 | -1>(1);
	listening = $state(false);
	picks = $state<HelperPicks | null>(null);
	moment = $state<HelperMoment | null>(null);
	mode = $state<WriteMode>('new');
	goal = $state('');
	question = $state('');
	reply = $state('');
	copied = $state<WriteMode | null>(null);
	sent = $state<ChatApp | null>(null);
	app = $state<ChatApp>(loadChatApp());
	/** Held still, so marking it seen does not swap it out mid-read. */
	lead = $state<HelperInsight | null>(null);
	#cheer = $state(false);
	#cheerTimer: ReturnType<typeof setTimeout> | null = null;
	#swapped = new Set<ActionId>();
	#target: HelperTarget;
	#chartId = '';

	outcome: HelperOutcome | null = $derived.by(() => {
		if (!this.reply.trim()) return null;
		const reply = parseDraftText(this.reply);
		if (!reply) return { kind: 'unread' };
		const data = this.#target.data();
		// A reply for this chart's goal fills its gaps, or, after a review, rewrites its weak lines. Anything else
		// is a chart of its own.
		if (hasContent(data) && norm(reply.goal) === norm(data.goal)) {
			const edits = this.mode === 'review' ? reviseEdits(data, reply) : fillEdits(data, reply);
			return edits.length ? { kind: 'cells', edits } : { kind: 'nothing' };
		}
		return { kind: 'chart', data: reply };
	});

	mood: HelperMood = $derived.by(() =>
		moodFor({
			cheer: this.#cheer,
			puzzled: this.page === 'review' && reviewChart(this.#target.data()).length > 0,
			listening: this.listening,
			offering: (this.page === 'today' || this.page === 'week') && this.picks !== null && this.moment === null,
			waiting: this.page === 'write' && this.copied !== null && this.copied !== 'ask' && !this.reply.trim()
		})
	);

	constructor(target: HelperTarget) {
		this.#target = target;
		this.#chartId = target.chartId?.() ?? '';
	}

	get data(): ChartData {
		return this.#target.data();
	}

	follow(chartId: string): void {
		if (chartId === this.#chartId) return;
		this.#chartId = chartId;
		this.reset();
		if (this.open) this.#takeLead();
	}

	/**
	 * Without a page, opens where it was left, so a person who went to paste a prompt comes back to the box
	 * for the reply. A finished moment does not wait for a reopen.
	 */
	show(page?: HelperPage, mode?: WriteMode): void {
		const opening = !this.open;
		this.open = true;
		if (this.moment) this.reset();
		if (opening && this.page === 'home') this.#takeLead();
		if (page) this.go(page, mode);
	}

	hide(): void {
		this.open = false;
		this.listening = false;
	}

	toggle(): void {
		if (this.open) this.hide();
		else this.show();
	}

	go(page: HelperPage, mode?: WriteMode): void {
		this.direction = page === 'home' ? -1 : 1;
		this.moment = null;
		this.page = page;
		if (page === 'today' || page === 'week') this.#deal(page);
		if (page === 'write') this.mode = mode ?? this.#defaultMode();
	}

	back(): void {
		this.go('home');
		this.picks = null;
	}

	finish(): void {
		this.hide();
		this.reset();
	}

	swap(key: ActionId): void {
		const current = this.picks;
		if (!current) return;
		this.#swapped.add(key);
		if (current.scope === 'today') this.#target.decline?.([key]);
		const keep = current.picks.filter((pick) => pick.id !== key);
		const exclude = new Set([...current.picks.map((pick) => pick.id), ...this.#swapped]);
		const data = this.#target.data();
		const options = current.scope === 'today' ? suggestToday(data, new Date(), 8, exclude) : suggestWeek(data, 8, new Date(), exclude);
		const taken = new Set(keep.map((pick) => pick.pillarIndex));
		const next = options.find((pick) => !taken.has(pick.pillarIndex)) ?? options[0];
		this.picks = { ...current, picks: next ? current.picks.map((pick) => (pick.id === key ? next : pick)) : keep };
	}

	commit(): void {
		const current = this.picks;
		if (!current || current.picks.length === 0) return;
		const keys = current.picks.map((pick) => pick.id);
		const pillars = current.picks.map((pick) => pick.pillarIndex);
		if (current.scope === 'today') {
			this.#target.setToday(keys);
			this.#land({ title: 'Today is set', detail: 'One at a time. Tick each one as it happens.', pillars });
		} else {
			this.#target.pinWeek(keys);
			this.#land({ title: `${keys.length} pinned for this week`, detail: 'They lead your picks each day.', pillars });
		}
	}

	decline(): void {
		const current = this.picks;
		if (current?.scope === 'today') this.#target.decline?.(current.picks.map((pick) => pick.id));
		this.back();
	}

	showCell(key: string): void {
		this.#target.showCell(key);
	}

	openTool(pillarIndex: number, id: string): void {
		this.#target.openTool?.(pillarIndex, id);
	}

	openCalendar(): void {
		this.#target.openCalendar?.();
		this.hide();
	}

	prompt(mode: WriteMode = this.mode): string {
		const data = this.#target.data();
		if (mode === 'new') return newChartPrompt(this.goal);
		if (mode === 'fill') return fillPrompt(data);
		if (mode === 'review') return reviewPrompt(data);
		return askPrompt(data, this.question);
	}

	markCopied(mode: WriteMode = this.mode): void {
		this.copied = mode;
		this.sent = null;
	}

	openIn(app: ChatApp = this.app): void {
		this.useApp(app);
		window.open(chatLink(app, this.prompt()), '_blank', 'noopener');
		this.copied = this.mode;
		this.sent = app;
	}

	useApp(app: ChatApp): void {
		this.app = app;
		try {
			localStorage.setItem(CHAT_APP_KEY, app);
		} catch {
		}
	}

	receive(text: string): boolean {
		if (!parseDraftText(text)) return false;
		this.reply = text;
		const outcome = this.outcome;
		if (this.page !== 'write') this.go('write', outcome?.kind === 'cells' || outcome?.kind === 'nothing' ? 'fill' : 'new');
		return true;
	}

	applyReply(): void {
		const outcome = this.outcome;
		if (outcome?.kind === 'chart') {
			if (!this.#target.applyDraft(outcome.data)) return;
			const next = this.#target.chartId?.();
			if (next) this.#chartId = next;
			const written = outcome.data.actions.flat().filter((action) => action.trim()).length;
			this.#land({ title: 'Your chart is ready', detail: `8 pillars and ${written} actions for “${outcome.data.goal}”.`, pillars: [0, 1, 2, 3, 4, 5, 6, 7] });
		} else if (outcome?.kind === 'cells') {
			const words = editWords(this.#target.data(), outcome.edits);
			const pillars = [...new Set(outcome.edits.map((edit) => (edit.key.startsWith('p') ? Number(edit.key.slice(1)) : Number(edit.key.slice(1).split('_')[0]))))];
			this.#target.setCells(outcome.edits);
			if (this.mode !== 'review' && wholeness(this.#target.data()).chart) {
				this.#land({ title: 'Every line is written', detail: `${words.done} Your own lines stayed as they were.`, pillars: [0, 1, 2, 3, 4, 5, 6, 7] });
			} else this.#land({ title: words.done.replace(/\.$/, ''), detail: 'Your lines stayed as they were.', pillars });
		} else return;
		this.reply = '';
		this.copied = null;
		this.sent = null;
		this.goal = '';
	}

	#defaultMode(): WriteMode {
		const data = this.#target.data();
		if (!data.goal.trim()) return 'new';
		if (gapsOf(data).total > 0) return 'fill';
		return 'ask';
	}

	#deal(scope: 'today' | 'week'): void {
		this.#swapped.clear();
		const data = this.#target.data();
		this.picks = { scope, picks: scope === 'today' ? suggestToday(data) : suggestWeek(data) };
	}

	#takeLead(): void {
		const data = this.#target.data();
		const lead = data.goal.trim() ? greetingInsight(data) : null;
		this.lead = lead;
		if (lead) this.#target.noteShown?.(insightSignature(lead));
	}

	#land(moment: HelperMoment): void {
		this.moment = moment;
		this.picks = null;
		this.#cheer = true;
		if (this.#cheerTimer) clearTimeout(this.#cheerTimer);
		this.#cheerTimer = setTimeout(() => (this.#cheer = false), 2400);
	}

	reset(): void {
		this.page = 'home';
		this.direction = -1;
		this.picks = null;
		this.moment = null;
		this.reply = '';
		this.copied = null;
		this.sent = null;
		this.goal = '';
		this.question = '';
		this.lead = null;
	}
}

export const helper = new HelperStore({
	data: () => chart.data,
	applyDraft: (next) => chart.applyDraft(next, true),
	setCells: (edits) => {
		for (const edit of edits) chart.setText(edit.key, edit.after, true);
		const first = edits[0];
		if (first) chart.select(first.key.startsWith('p') ? 4 : blockOfK(Number(first.key.slice(1).split('_')[0])));
	},
	setToday: (keys) => {
		chart.setFocus(todayKey(), keys, true);
		chart.setViewMode('today');
	},
	pinWeek: (keys) => {
		for (const key of keys) chart.setActionMeta(key, { pinned: true });
	},
	showCell: (key) => chart.jumpToKey(key),
	openTool: (pillarIndex, id) => chart.openTool(pillarIndex, id),
	openCalendar: () => chart.setViewMode('calendar'),
	decline: (keys) => chart.declineToday(keys),
	noteShown: (signature) => chart.noteShown(signature),
	chartId: () => chart.activeId
});
