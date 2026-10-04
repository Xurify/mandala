import { chart } from './chart.svelte';
import { draftPrompt, parseDraftText } from './draft.ts';
import {
	briefFromAnswers,
	chipsFor,
	describeCoachProgress,
	DRAFT_QUESTIONS,
	fillPlan,
	greetingFor,
	intentOf,
	reviewChart,
	suggestToday,
	suggestWeek,
	textOfKey,
	type CoachLoad,
	type HelperChip,
	type HelperFinding,
	type HelperJob,
	type HelperPick
} from './helper.ts';
import { blockOfK, idx, todayKey, type ChartData } from './model.ts';

export type HelperMood = 'idle' | 'listening' | 'thinking' | 'happy' | 'puzzled';

export type CellEdit = { key: string; before: string; after: string; reason?: string };

export type HelperCard =
	| { kind: 'chart'; data: ChartData }
	| { kind: 'cells'; edits: CellEdit[] }
	| { kind: 'picks'; scope: 'today' | 'week'; picks: HelperPick[] }
	| { kind: 'findings'; findings: HelperFinding[] }
	| { kind: 'download' }
	| { kind: 'prompt' };

export type CardState = 'working' | 'open' | 'used' | 'skipped';

export type HelperMessage = {
	id: number;
	from: 'helper' | 'you';
	text: string;
	card?: HelperCard;
	state?: CardState;
};

/** What the helper may read and change. The app passes the chart store; the lab passes a sandbox. */
export type HelperTarget = {
	data(): ChartData;
	selectedPillar(): number | null;
	applyDraft(next: ChartData): boolean;
	setCells(edits: CellEdit[]): void;
	setToday(keys: string[]): void;
	pinWeek(keys: string[]): void;
	showCell(key: string): void;
};

type Coach = typeof import('./coach.browser.ts');

const CONSENT_KEY = 'mandala-helper-model';

function loadCoachModule(): Promise<Coach> {
	return import('./coach.browser.ts');
}

function readConsent(): boolean {
	try {
		return typeof localStorage !== 'undefined' && localStorage.getItem(CONSENT_KEY) === '1';
	} catch {
		return false;
	}
}

export class HelperStore {
	open = $state(false);
	messages: HelperMessage[] = $state([]);
	busy = $state(false);
	progress = $state<CoachLoad | null>(null);
	unread = $state(false);
	webgpu = $state<boolean | null>(null);
	modelReady = $state(false);
	step = $state<'idle' | 'direction' | 'extra'>('idle');
	#cheer = $state(false);
	#trouble = $state(false);
	listening = $state(false);

	mood: HelperMood = $derived(
		this.busy ? 'thinking' : this.#cheer ? 'happy' : this.#trouble ? 'puzzled' : this.listening ? 'listening' : 'idle'
	);

	#target: HelperTarget;
	#seq = 1;
	#direction = '';
	#pending: (() => Promise<void>) | null = null;
	#consent = readConsent();
	#cheerTimer: ReturnType<typeof setTimeout> | null = null;
	#warming = false;
	#progressStop: (() => void) | null = null;

	constructor(target: HelperTarget) {
		this.#target = target;
	}

	get data(): ChartData {
		return this.#target.data();
	}

	get chips(): HelperChip[] {
		if (this.busy || this.step !== 'idle') return [];
		return chipsFor(this.#target.data(), this.#target.selectedPillar());
	}

	get placeholder(): string {
		if (this.step === 'direction') return 'Run a half marathon, learn Spanish…';
		if (this.step === 'extra') return 'By when, where you stand, or say go';
		return 'Ask, or say what you need';
	}

	show(job?: HelperJob): void {
		this.open = true;
		this.unread = false;
		if (this.messages.length === 0) this.#say(greetingFor(this.#target.data()));
		void this.#warm();
		if (job) void this.start(job);
	}

	hide(): void {
		this.open = false;
		this.listening = false;
	}

	toggle(): void {
		if (this.open) this.hide();
		else this.show();
	}

	reset(): void {
		this.messages = [];
		this.step = 'idle';
		this.#pending = null;
		this.#trouble = false;
		this.#say(greetingFor(this.#target.data()));
	}

	async send(raw: string): Promise<void> {
		const text = raw.trim();
		if (!text || this.busy) return;
		this.#push({ from: 'you', text: text.length > 600 ? `${text.slice(0, 600)}…` : text });
		this.#trouble = false;

		if (this.step === 'direction') {
			this.#direction = text;
			this.step = 'extra';
			this.#say(DRAFT_QUESTIONS[1]);
			return;
		}
		if (this.step === 'extra') {
			this.step = 'idle';
			const brief = briefFromAnswers(this.#direction, text);
			await this.#withModel(() => this.#draft(brief), 'draft');
			return;
		}

		const intent = intentOf(text);
		if (intent === 'chart') {
			const data = parseDraftText(text);
			if (data) this.#say('That reply holds a whole chart. Here it is.', { kind: 'chart', data });
			return;
		}
		if (intent === 'ask') {
			await this.#withModel(() => this.#answer(text));
			return;
		}
		await this.start(intent);
	}

	async start(job: HelperJob): Promise<void> {
		if (this.busy) return;
		this.#trouble = false;
		this.step = 'idle';
		const data = this.#target.data();
		if (job === 'draft') {
			this.step = 'direction';
			this.#say(DRAFT_QUESTIONS[0]);
			return;
		}
		if (job === 'review') return this.#review(data);
		if (job === 'week') return this.#picks('week', data);
		if (job === 'today') return this.#picks('today', data);
		const plan = fillPlan(data, this.#target.selectedPillar());
		if (!plan) {
			this.#say(data.goal.trim() ? 'Every cell is filled. Want a review instead?' : 'Give the chart a goal first, then I can fill the rest.');
			return;
		}
		await this.#withModel(() => this.#fill());
	}

	allowDownload(id: number): void {
		this.#consent = true;
		try {
			localStorage.setItem(CONSENT_KEY, '1');
		} catch {
			// Private mode keeps the consent for this session only.
		}
		this.#settle(id, 'used');
		const run = this.#pending;
		this.#pending = null;
		if (run) void this.#run(run);
	}

	use(id: number): void {
		const message = this.messages.find((entry) => entry.id === id);
		const card = message?.card;
		if (!message || !card || message.state !== 'open') return;
		if (card.kind === 'chart') {
			if (!this.#target.applyDraft(card.data)) return;
			this.#settle(id, 'used');
			this.#celebrate('Done. Pick five to eight for this week whenever you like.');
		} else if (card.kind === 'cells') {
			this.#target.setCells(card.edits);
			this.#settle(id, 'used');
			this.#celebrate(card.edits.length === 1 ? 'Changed it.' : `Changed ${card.edits.length} cells.`);
		} else if (card.kind === 'picks') {
			const keys = card.picks.map((pick) => pick.key);
			if (card.scope === 'today') this.#target.setToday(keys);
			else this.#target.pinWeek(keys);
			this.#settle(id, 'used');
			this.#celebrate(card.scope === 'today' ? 'Today is set. One at a time.' : 'Pinned. They will lead your picks each day.');
		} else if (card.kind === 'findings') {
			this.#settle(id, 'used');
			void this.#withModel(() => this.#rewrite(card.findings));
		}
	}

	skip(id: number): void {
		const message = this.messages.find((entry) => entry.id === id);
		if (!message?.card || message.state !== 'open') return;
		this.#settle(id, 'skipped');
		if (message.card.kind === 'download') {
			this.#pending = null;
			this.#say('No problem. Copy the prompt into any chat app and paste the reply here.', { kind: 'prompt' });
		}
	}

	showCell(key: string): void {
		this.#target.showCell(key);
	}

	promptText(): string {
		return draftPrompt();
	}

	async stop(): Promise<void> {
		const coach = await loadCoachModule();
		await coach.interruptCoach();
	}

	async #review(data: ChartData): Promise<void> {
		const findings = reviewChart(data);
		if (findings.length === 0) {
			this.#say('Every cell passes both tests: you can tick it, and it is yours to do. Nice work.');
			this.#cheerOnly();
			return;
		}
		const count = findings.length === 1 ? 'One cell' : `${findings.length} cells`;
		this.#say(`${count} could be sharper. I can rewrite them, and you choose what stays.`, { kind: 'findings', findings });
	}

	#picks(scope: 'today' | 'week', data: ChartData): void {
		const picks = scope === 'today' ? suggestToday(data) : suggestWeek(data);
		if (picks.length === 0) {
			this.#say('There is nothing open to pick yet. Add a few actions first.');
			return;
		}
		this.#say(
			scope === 'today'
				? 'Three for today, from different pillars.'
				: `${picks.length} for this week, starting with the quiet pillars. Pinned ones lead your daily picks.`,
			{ kind: 'picks', scope, picks }
		);
	}

	async #draft(brief: ReturnType<typeof briefFromAnswers>): Promise<void> {
		const coach = await loadCoachModule();
		let draftId = 0;
		const result = await coach.proposeChart(brief, (partial) => {
			if (!draftId) {
				this.#say('Pillars first. The actions follow, one pillar at a time.', { kind: 'chart', data: partial });
				draftId = this.messages[this.messages.length - 1]?.id ?? 0;
				this.#settle(draftId, 'working');
				return;
			}
			this.messages = this.messages.map((entry) =>
				entry.id === draftId ? { ...entry, card: { kind: 'chart', data: partial } } : entry
			);
		});
		if (!result.chart) {
			if (draftId) this.#settle(draftId, 'skipped');
			this.#fail('I lost the thread on that one. Try again, or copy the prompt into another chat app.', { kind: 'prompt' });
			return;
		}
		if (draftId) this.#settle(draftId, 'open');
		else this.#say('Here is a first chart.', { kind: 'chart', data: result.chart });
		const written = result.chart.actions.flat().filter((action) => action.trim()).length;
		this.#say(written === 64 ? 'All 64 actions are in. Use it, or ask me to start again.' : `${written} of 64 actions are in. The blanks stayed empty.`);
	}

	async #warm(): Promise<void> {
		if (this.#warming || !this.#consent) return;
		this.#warming = true;
		const coach = await loadCoachModule();
		if (this.webgpu === null) this.webgpu = await coach.detectWebGPU();
		if (!this.webgpu || coach.coachLoaded()) {
			this.modelReady = coach.coachLoaded();
			return;
		}
		const stop = coach.watchCoachProgress((update) => {
			if (!this.busy) this.progress = describeCoachProgress(update.text, update.ratio);
		});
		try {
			await coach.loadCoach();
			this.modelReady = true;
		} catch {
			this.#warming = false;
		} finally {
			stop();
			if (!this.busy) this.progress = null;
		}
	}

	async #fill(): Promise<void> {
		const coach = await loadCoachModule();
		const data = this.#target.data();
		const plan = fillPlan(data, this.#target.selectedPillar());
		if (!plan) return;
		if (plan.kind === 'pillars') {
			const lines = await coach.fillPillars(data, plan.empty.length);
			if (!lines) return this.#fail('I could not name those pillars. Try once more?');
			const edits = plan.empty.slice(0, lines.length).map((pillarIndex, index) => ({ key: `p${pillarIndex}`, before: '', after: lines[index] ?? '' }));
			const short = lines.length < plan.empty.length ? ` ${plan.empty.length - lines.length} stayed blank.` : '';
			this.#say(`${edits.length} pillars for "${data.goal.trim()}". Keep the ones that would change the outcome.${short}`, { kind: 'cells', edits });
			return;
		}
		const lines = await coach.fillActions(data, plan.pillarIndex, plan.empty.length);
		if (!lines) return this.#fail('I could not finish that pillar. Try once more?');
		const edits = plan.empty.slice(0, lines.length).map((actionIndex, index) => ({
			key: `a${plan.pillarIndex}_${actionIndex}`,
			before: '',
			after: lines[index] ?? ''
		}));
		const name = (data.pillars[plan.pillarIndex] ?? '').trim();
		const short = lines.length < plan.empty.length ? ` ${plan.empty.length - lines.length} stayed blank.` : '';
		this.#say(`${edits.length} for ${name}. Each one is something you can schedule.${short}`, { kind: 'cells', edits });
	}

	async #rewrite(findings: HelperFinding[]): Promise<void> {
		const coach = await loadCoachModule();
		const data = this.#target.data();
		const edits: CellEdit[] = [];
		for (const finding of findings) {
			if (textOfKey(data, finding.key) !== finding.text) continue;
			const after = await coach.rewriteCell(data, finding);
			if (after) edits.push({ key: finding.key, before: finding.text, after, reason: finding.reason });
		}
		if (edits.length === 0) return this.#fail('I could not improve on those. They may be fine as they are.');
		this.#say('Here is how I would put them.', { kind: 'cells', edits });
	}

	async #answer(question: string): Promise<void> {
		const coach = await loadCoachModule();
		const reply = await coach.answer(this.#target.data(), question);
		if (!reply) return this.#fail('I am not sure. Try asking another way.');
		this.#say(reply);
	}

	async #withModel(run: () => Promise<void>, job?: HelperJob): Promise<void> {
		const coach = await loadCoachModule();
		if (this.webgpu === null) this.webgpu = await coach.detectWebGPU();
		if (!this.webgpu) {
			this.#say(
				job === 'draft'
					? "This browser can't run me on the device. Copy the prompt into any chat app, then paste the reply here."
					: "This browser can't run me on the device. Review, week, and today still work.",
				job === 'draft' ? { kind: 'prompt' } : undefined
			);
			return;
		}
		if (!coach.coachLoaded() && !this.#consent) {
			this.#say('I write with a small model that lives in this browser. It is a one-time download.', { kind: 'download' });
			this.#pending = run;
			return;
		}
		await this.#run(run);
	}

	async #run(run: () => Promise<void>): Promise<void> {
		const coach = await loadCoachModule();
		this.busy = true;
		this.progress = describeCoachProgress(coach.coachLoaded() ? 'Thinking.' : 'Waking up.');
		this.#progressStop ??= coach.watchCoachProgress((update) => {
			this.progress = describeCoachProgress(update.text, update.ratio);
		});
		try {
			await run();
			this.modelReady = coach.coachLoaded();
		} catch {
			this.#fail('Something stopped me. Try again in a moment.');
		} finally {
			this.busy = false;
			this.progress = null;
			if (!this.open) this.unread = true;
		}
	}

	#push(entry: Omit<HelperMessage, 'id'>): HelperMessage {
		const message: HelperMessage = { id: this.#seq++, ...entry };
		this.messages = [...this.messages, message];
		return message;
	}

	#say(text: string, card?: HelperCard): void {
		if (card) {
			if (this.messages.some((entry) => entry.state === 'open' && entry.card?.kind === 'download')) this.#pending = null;
			this.messages = this.messages.map((entry) => (entry.state === 'open' ? { ...entry, state: 'skipped' } : entry));
		}
		this.#push({ from: 'helper', text, card, state: card ? 'open' : undefined });
		if (!this.open) this.unread = true;
	}

	#fail(text: string, card?: HelperCard): void {
		this.#trouble = true;
		this.#say(text, card);
	}

	#settle(id: number, state: CardState): void {
		this.messages = this.messages.map((entry) => (entry.id === id ? { ...entry, state } : entry));
	}

	#cheerOnly(): void {
		this.#cheer = true;
		if (this.#cheerTimer) clearTimeout(this.#cheerTimer);
		this.#cheerTimer = setTimeout(() => {
			this.#cheer = false;
		}, 2400);
	}

	#celebrate(text: string): void {
		this.#say(text);
		this.#cheerOnly();
	}
}

export const helper = new HelperStore({
	data: () => chart.data,
	selectedPillar: () => (chart.sel === 4 ? null : idx(chart.sel)),
	applyDraft: (next) => chart.applyDraft(next),
	setCells: (edits) => {
		for (const edit of edits) chart.setText(edit.key, edit.after);
		const first = edits[0];
		if (first) chart.select(first.key.startsWith('p') ? 4 : blockOfK(Number(first.key.slice(1).split('_')[0])));
		chart.say(edits.length === 1 ? 'Changed 1 cell.' : `Changed ${edits.length} cells.`);
	},
	setToday: (keys) => {
		chart.setFocus(todayKey(), keys);
		chart.setViewMode('today');
	},
	pinWeek: (keys) => {
		for (const key of keys) chart.setActionMeta(key, { pinned: true });
		chart.say(`Pinned ${keys.length} for this week.`);
	},
	showCell: (key) => chart.jumpToKey(key)
});
