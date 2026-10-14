import { chart } from './chart.svelte';
import { askClaude, loadClaudeKey, saveClaudeKey } from './claude.ts';
import { chatLink, fillPrompt, isChatApp, newChartPrompt, parseDraftText, reviewPrompt, type ChatApp } from './draft.ts';
import {
	askPrompt,
	editWords,
	fillEdits,
	gapsOf,
	greetingInsight,
	insightSignature,
	moodFor,
	progressOf,
	norm,
	reviseEdits,
	suggestToday,
	suggestWeek,
	type CellEdit,
	type HelperInsight,
	type HelperMood,
	type HelperOffer,
	type HelperPage,
	type HelperPick,
	type KindChange,
	type WriteMode
} from './helper.ts';
import { blockOfK, getByKey, hasContent, todayKey, wholeness, wordsOf, type ActionId, type ChartData, type Ref } from './model.ts';
import { LANE_NAMES, tomorrowOf } from './board.ts';
import type { AgentTarget } from './webmcp.ts';

export type { CellEdit, ChatApp, HelperMood, HelperOffer, HelperPage, HelperPick, WriteMode };

export type HelperTarget = {
	data(): ChartData;
	applyDraft(next: ChartData): boolean;
	setCells(edits: CellEdit[]): void;
	setToday(ids: ActionId[]): void;
	pinWeek(ids: ActionId[]): void;
	setKinds?(changes: KindChange[]): void;
	saveNote?(weekKey: string, note: string): void;
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
	offer = $state<HelperOffer | null>(null);
	mode = $state<WriteMode>('new');
	goal = $state('');
	question = $state('');
	reply = $state('');
	copied = $state<WriteMode | null>(null);
	sent = $state<ChatApp | null>(null);
	app = $state<ChatApp>(loadChatApp());
	claudeKey = $state(loadClaudeKey());
	/** The mode a request to Claude is out for. */
	writing = $state<WriteMode | null>(null);
	failure = $state('');
	answer = $state('');
	/** The mode whose reply came from Claude, not a paste. */
	wrote = $state<WriteMode | null>(null);
	#request: AbortController | null = null;
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
		// A reply for this chart's goal fills its gaps, or, after a review, rewrites the lines that failed. Anything else
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
			listening: this.listening,
			offering: ((this.page === 'today' || this.page === 'week') && this.picks !== null && this.moment === null) || (this.page === 'offer' && this.offer !== null),
			waiting: this.writing !== null || (this.page === 'write' && this.copied !== null && this.copied !== 'ask' && !this.reply.trim())
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
		this.offer = null;
	}

	/** Replaces any offer still waiting: the agent's latest is the one it means. */
	propose(offer: HelperOffer): void {
		this.show();
		this.offer = offer;
		this.go('offer');
	}

	/** A line, or a kind, the person changed while the offer waited stays theirs. */
	keepOffer(): void {
		const offer = this.offer;
		if (!offer) return;
		const data = this.#target.data();
		if (offer.kind === 'kinds') {
			const changes = offer.changes.filter((change) => wordsOf(data, change.id) === change.text && data.meta?.[change.id]?.kind === change.before);
			if (changes.length === 0) return this.back();
			this.#target.setKinds?.(changes);
			const routines = changes.filter((change) => change.after === 'routine').length;
			this.#land({
				title: `Sorted ${changes.length} ${changes.length === 1 ? 'action' : 'actions'}`,
				detail: routines ? 'Routines show on Today every day, as habits.' : 'Milestones close once they are done.',
				pillars: [...new Set(changes.map((change) => change.pillarIndex))].sort((a, b) => a - b)
			});
		} else if (offer.kind === 'note') {
			this.#target.saveNote?.(offer.weekKey, offer.after);
			this.#land({ title: 'Week saved', detail: 'Bindu says it back to you when the new week starts.', pillars: progressOf(data).pillars });
		} else {
			const kept: HelperOffer = offer.kind === 'cells' ? { kind: 'cells', edits: offer.edits.filter((edit) => getByKey(data, edit.key).trim() === edit.before) } : offer;
			if (kept.kind === 'cells' && kept.edits.length === 0) return this.back();
			if (!this.#keep(kept, kept.kind === 'cells' && kept.edits.every((edit) => edit.before))) return;
		}
		this.offer = null;
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

	prompt(mode: WriteMode = this.mode, direct = false): string {
		const data = this.#target.data();
		if (mode === 'new') return newChartPrompt(this.goal, direct);
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

	setClaudeKey(key: string): void {
		saveClaudeKey(key);
		this.claudeKey = loadClaudeKey();
		this.failure = '';
	}

	/** Sends the same prompt a chat app would get, and treats the reply as if it had been pasted. */
	async askClaude(): Promise<void> {
		const mode = this.mode;
		if (!this.claudeKey || this.writing) return;
		const request = new AbortController();
		this.#request = request;
		this.writing = mode;
		this.failure = '';
		this.answer = '';
		this.reply = '';
		this.wrote = null;
		const result = await askClaude(this.claudeKey, this.prompt(mode, true), request.signal);
		if (this.#request !== request) return;
		this.writing = null;
		this.#request = null;
		if (!result.ok) {
			if (!('aborted' in result)) this.failure = result.reason;
			return;
		}
		if (mode === 'ask') this.answer = result.text;
		else this.reply = result.text;
		this.wrote = mode;
	}

	stopClaude(): void {
		this.#request?.abort();
		this.#request = null;
		this.writing = null;
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
		if (outcome?.kind !== 'chart' && outcome?.kind !== 'cells') return;
		if (!this.#keep(outcome, this.mode === 'review')) return;
		this.reply = '';
		this.copied = null;
		this.sent = null;
		this.goal = '';
		this.failure = '';
		this.wrote = null;
	}

	#keep(outcome: Extract<HelperOffer, { kind: 'chart' | 'cells' }>, rewriting: boolean): boolean {
		if (outcome.kind === 'chart') {
			if (!this.#target.applyDraft(outcome.data)) return false;
			const next = this.#target.chartId?.();
			if (next) this.#chartId = next;
			const written = outcome.data.actions.flat().filter((action) => action.trim()).length;
			this.#land({ title: 'Your chart is ready', detail: `8 pillars and ${written} actions for “${outcome.data.goal}”.`, pillars: [0, 1, 2, 3, 4, 5, 6, 7] });
			return true;
		}
		const words = editWords(this.#target.data(), outcome.edits);
		const pillars = [...new Set(outcome.edits.map((edit) => (edit.key.startsWith('p') ? Number(edit.key.slice(1)) : Number(edit.key.slice(1).split('_')[0]))))];
		this.#target.setCells(outcome.edits);
		if (!rewriting && wholeness(this.#target.data()).chart) {
			this.#land({ title: 'Every line is written', detail: `${words.done} Your own lines stayed as they were.`, pillars: [0, 1, 2, 3, 4, 5, 6, 7] });
		} else this.#land({ title: words.done.replace(/\.$/, ''), detail: 'Your lines stayed as they were.', pillars });
		return true;
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
		this.stopClaude();
		this.failure = '';
		this.answer = '';
		this.wrote = null;
		this.page = 'home';
		this.direction = -1;
		this.picks = null;
		this.moment = null;
		this.offer = null;
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
	setKinds: (changes) => {
		for (const change of changes) chart.setActionMeta(change.id, { kind: change.after });
	},
	saveNote: (weekKey, note) => chart.saveWeekReflection(weekKey, { note }),
	showCell: (key) => chart.jumpToKey(key),
	openTool: (pillarIndex, id) => chart.openTool(pillarIndex, id),
	openCalendar: () => chart.setViewMode('calendar'),
	decline: (keys) => chart.declineToday(keys),
	noteShown: (signature) => chart.noteShown(signature),
	chartId: () => chart.activeId
});

/** What an agent in the browser acts on. A change it makes says so in a slip, since the person did not tap it. */
export const agentTarget: AgentTarget = {
	data: () => chart.data,
	now: () => new Date(),
	reflectionWeek: () => chart.reflectionWeek,
	offer: (offer) => helper.propose(offer),
	finish: (id) => {
		chart.finish(id);
		chart.say(`Your assistant finished “${wordsOf(chart.data, id)}”.`);
	},
	reopen: (id) => {
		chart.reopen(id);
		chart.say(`Your assistant reopened “${wordsOf(chart.data, id)}”.`);
	},
	setToday: (ids) => {
		const stopped = chart.setFocus(todayKey(), ids, true);
		const set = `Your assistant set today: ${plural(ids.length, 'action')}.`;
		chart.say(stopped ? `${set} ${stopped}` : set);
	},
	planTomorrow: (ids) => {
		chart.setFocus(tomorrowOf(chart.today), ids, true);
		chart.say(`Your assistant planned tomorrow: ${plural(ids.length, 'action')}.`);
	},
	pin: (ids, pinned) => {
		for (const id of ids) chart.setActionMeta(id, { pinned: pinned || undefined });
		chart.say(`Your assistant ${pinned ? 'pinned' : 'unpinned'} ${ids.length === 1 ? `“${wordsOf(chart.data, ids[0]!)}”` : plural(ids.length, 'action')}.`);
	},
	moveCard: (id, lane, index) => {
		const moved = chart.moveCard(id, lane, index);
		if (moved) chart.say(`Your assistant moved “${wordsOf(chart.data, id)}” to ${LANE_NAMES[lane]}.`);
		return moved;
	},
	logTime: (id, minutes) => chart.logTime(id, minutes),
	startTimer: (id, minutes) => chart.startTimer(id, minutes),
	stopTimer: () => chart.stopTimer(),
	addLink: (pillarIndex, url, title, kind) => {
		chart.addTool(pillarIndex, url, title, kind);
		chart.say(`Your assistant saved a link to ${chart.data.pillars[pillarIndex]?.trim() || `Pillar ${pillarIndex + 1}`}.`);
	}
};

function plural(count: number, one: string): string {
	return `${count} ${count === 1 ? one : `${one}s`}`;
}
