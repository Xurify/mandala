import { chart } from './chart.svelte';
import { draftPrompt, parseDraftText, type ChartAnswers } from './draft.ts';
import {
	aimOf,
	briefOf,
	chartAnswersFromText,
	chatReply,
	conversationHistory,
	chipsFor,
	describeCoachProgress,
	DRAFT_QUESTIONS,
	extraChips,
	fillPillarChip,
	fillPlan,
	greetingFor,
	helpChips,
	helpReply,
	insightChip,
	insightsFor,
	intentOf,
	isCancellation,
	isCardRejection,
	isHelpRequest,
	isPillarActionRequest,
	moodFor,
	offerChips,
	pillarMentioned,
	progressReport,
	reviewChart,
	suggestToday,
	suggestWeek,
	textOfKey,
	type CardState,
	type HelperPick,
	type CellEdit,
	type ChatMessage,
	type CoachLoad,
	type HelperCard,
	type HelperChip,
	type HelperFinding,
	type HelperJob,
	type HelperMessage,
	type HelperMood
} from './helper.ts';
import { COACH_MODEL_ID } from './coach-model.ts';
import { CoachStopped } from './coach-protocol.ts';
import { blockOfK, idx, todayKey, type ChartData } from './model.ts';

export type { CardState, CellEdit, HelperCard, HelperMessage, HelperMood };

/** What the helper may read and change. The app passes the chart store; the lab passes a sandbox. */
export type HelperTarget = {
	data(): ChartData;
	selectedPillar(): number | null;
	applyDraft(next: ChartData): boolean;
	setCells(edits: CellEdit[]): void;
	setToday(keys: string[]): void;
	pinWeek(keys: string[]): void;
	showCell(key: string): void;
	/** Suggestions turned down today, so they are not offered again today. */
	decline?(keys: string[]): void;
	/** The chart the conversation belongs to. The lab leaves it out and keeps one thread. */
	chartId?(): string;
};

type Coach = typeof import('./coach.browser.ts');

const CONSENT_KEY = 'mandala-helper-model';

function loadCoachModule(): Promise<Coach> {
	return import('./coach.browser.ts');
}

function readConsent(): boolean {
	try {
		return typeof localStorage !== 'undefined' && localStorage.getItem(CONSENT_KEY) === COACH_MODEL_ID;
	} catch {
		return false;
	}
}

function persistModelConsent(): void {
	try {
		localStorage.setItem(CONSENT_KEY, COACH_MODEL_ID);
	} catch {
		// Private mode keeps the consent for this session only.
		return;
	}
}

function clearModelConsent(): void {
	try {
		localStorage.removeItem(CONSENT_KEY);
	} catch {
		return;
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
	step = $state<'idle' | 'direction' | 'extra' | 'offer'>('idle');
	#cheer = $state(false);
	#sorry = $state(false);
	listening = $state(false);

	mood: HelperMood = $derived.by(() => {
		const openCard = this.messages.find((entry) => entry.state === 'open')?.card?.kind ?? null;
		return moodFor({
			busy: this.busy,
			status: this.progress?.label,
			cheer: this.#cheer,
			sorry: this.#sorry,
			card: openCard,
			step: this.step,
			listening: this.listening
		});
	});

	#target: HelperTarget;
	#seq = 1;
	#direction = '';
	#sketch: ChartData | null = null;
	#sketchId = 0;
	#help = $state(false);
	#pillarFill = $state<number | null>(null);
	#fillPillar: number | null = null;
	#pending: (() => Promise<void>) | null = null;
	#consent = readConsent();
	#cheerTimer: ReturnType<typeof setTimeout> | null = null;
	#warming = false;
	#progressStop: (() => void) | null = null;
	#chartId = '';
	#threads = new Map<string, HelperMessage[]>();
	#jobChart: string | null = null;
	#thanks = 0;
	#lead = $state<HelperChip | null>(null);
	#swapped = new Set<string>();

	constructor(target: HelperTarget) {
		this.#target = target;
		this.#chartId = target.chartId?.() ?? '';
	}

	/** Each chart keeps its own conversation. A job still running for the old chart is stopped, and its replies are dropped. */
	follow(chartId: string): void {
		if (chartId === this.#chartId) return;
		if (this.#chartId) {
			this.#threads.set(
				this.#chartId,
				this.messages.map((entry) => (entry.state === 'working' ? { ...entry, state: 'skipped' } : entry))
			);
		}
		if (this.busy) void this.stop();
		this.#chartId = chartId;
		this.messages = this.#threads.get(chartId) ?? [];
		this.#threads.delete(chartId);
		this.step = 'idle';
		this.#pending = null;
		this.#sorry = false;
		this.unread = false;
		this.#clearTurn();
		if (this.open && this.messages.length === 0) this.#greet();
	}

	#greet(): void {
		const data = this.#target.data();
		const top = insightsFor(data)[0];
		this.#aside(greetingFor(data));
		this.#lead = top && top.weight >= 30 ? insightChip(top) : null;
	}

	get #stale(): boolean {
		return this.#jobChart !== null && this.#jobChart !== this.#chartId;
	}

	get data(): ChartData {
		return this.#target.data();
	}

	get chips(): HelperChip[] {
		if (this.busy) return [];
		if (this.step === 'offer') return offerChips();
		if (this.step === 'extra') return extraChips(this.#sketch !== null);
		if (this.step === 'direction') return [];
		if (this.#lead) return [this.#lead, ...chipsFor(this.#target.data(), this.#target.selectedPillar())];
		if (this.#help) return helpChips();
		if (this.#pillarFill !== null) {
			const name = (this.#target.data().pillars[this.#pillarFill] ?? '').trim();
			if (name) return [fillPillarChip(name, this.#pillarFill)];
		}
		return chipsFor(this.#target.data(), this.#target.selectedPillar());
	}

	get placeholder(): string {
		if (this.step === 'direction') return 'Run a half marathon, learn Spanish…';
		if (this.step === 'extra') return 'A date, how much time you have, or write the actions';
		return 'Ask, or say what you need';
	}

	show(job?: HelperJob): void {
		this.open = true;
		this.unread = false;
		if (this.messages.length === 0) this.#greet();
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
		this.#sorry = false;
		this.#clearTurn();
		this.#greet();
	}

	cancel(): void {
		if (this.step !== 'idle' || this.#direction || this.#sketch) {
			this.step = 'idle';
			this.#clearTurn();
			this.#aside('Draft cancelled.');
		}
	}

	choose(chip: HelperChip): void {
		const act = chip.act;
		if (act.kind === 'job') void this.start(act.job, act.pillar);
		else if (act.kind === 'send') void this.send(act.text);
		else if (act.kind === 'sketch') void this.#sketchAim();
		else if (act.kind === 'show') this.showCell(act.key);
		else this.#dismissAim();
	}

	async send(raw: string): Promise<void> {
		const text = raw.trim();
		if (!text || this.busy) return;
		const history = conversationHistory(this.messages, 8);
		this.#push({ from: 'you', text: text.length > 600 ? `${text.slice(0, 600)}…` : text });
		this.#sorry = false;

		if (this.step === 'direction') {
			if (isCancellation(text) || /^(?:no|nope|nah)\.?$/i.test(text)) {
				this.step = 'idle';
				this.#clearTurn();
				this.#aside('Draft cancelled.');
				return;
			}
			this.#direction = text;
			this.step = 'extra';
			this.#say(DRAFT_QUESTIONS[1]);
			return;
		}
		if (this.step === 'extra') {
			if (isCancellation(text)) {
				this.step = 'idle';
				this.#clearTurn();
				this.#aside('Draft cancelled.');
				return;
			}
			const answers = chartAnswersFromText(this.#direction, text);
			if (this.#sketch) {
				await this.#withModel(() => this.#fillSketch(answers), 'draft');
				return;
			}
			this.step = 'idle';
			await this.#withModel(() => this.#draft(answers), 'draft');
			return;
		}
		if (this.step === 'offer') {
			if (
				isCancellation(text) ||
				/^(?:no|nope|nah|stay|stay\s+(?:with|on)\s+this\s+chart|keep\s+this\s+chart|leave\s+it)\.?$/i.test(text)
			) {
				this.#dismissAim();
				return;
			}
			this.step = 'idle';
		}
		this.#help = false;
		this.#lead = null;
		this.#pillarFill = null;

		const openMessage = this.messages.find((entry) => entry.state === 'open');
		if (openMessage && isCardRejection(text)) {
			this.skip(openMessage.id);
			return;
		}

		const data = this.#target.data();
		const intent = intentOf(text);
		if (intent === 'cancel') {
			this.#clearTurn();
			this.step = 'idle';
			this.#aside('Nothing to cancel.');
			return;
		}
		if (intent === 'chat') {
			const reply = chatReply(text, data, this.#thanks++);
			this.#help = reply.nextStep;
			this.#say(reply.text);
			return;
		}
		if (intent === 'progress') {
			this.#say(progressReport(data));
			this.#lead = insightChip(insightsFor(data).find((insight) => insight.key));
			return;
		}
		if (intent === 'chart') {
			const parsed = parseDraftText(text);
			if (parsed) this.#say('That reply holds a whole chart. Here it is.', { kind: 'chart', data: parsed });
			return;
		}
		if (intent !== 'ask') {
			await this.start(intent);
			return;
		}
		if (isHelpRequest(text)) {
			this.#help = data.goal.trim() !== '' && !fillPlan(data);
			this.#say(helpReply(data));
			return;
		}
		const aim = aimOf(text, data);
		if (aim) {
			this.#direction = aim;
			this.#sketch = null;
			this.#sketchId = 0;
			this.step = 'offer';
			this.#say(data.goal.trim() ? 'That is a new chart. This one stays.' : 'I can sketch a chart for that.');
			return;
		}
		const mentioned = pillarMentioned(text, data);
		if (mentioned !== null && isPillarActionRequest(text)) {
			const name = (data.pillars[mentioned] ?? '').trim();
			const empty = (data.actions[mentioned] ?? []).filter((action) => !action.trim()).length;
			if (empty > 0) {
				this.#pillarFill = mentioned;
				this.#say(`${name} still has ${empty} empty ${empty === 1 ? 'action' : 'actions'}.`);
				return;
			}
			this.#say(`${name} is already full. We can review its actions or pick one for today.`);
			return;
		}
		await this.#withModel(() => this.#answer(text, history, mentioned ?? this.#target.selectedPillar()));
	}

	async start(job: HelperJob, pillar?: number): Promise<void> {
		if (this.busy) return;
		this.#sorry = false;
		this.#clearTurn();
		this.step = 'idle';
		this.#fillPillar = job === 'fill' ? (pillar ?? this.#target.selectedPillar()) : null;
		const data = this.#target.data();
		if (job === 'draft') {
			this.step = 'direction';
			this.#say(DRAFT_QUESTIONS[0]);
			return;
		}
		if (job === 'review') return this.#review(data);
		if (job === 'week') return this.#picks('week', data);
		if (job === 'today') return this.#picks('today', data);
		const plan = fillPlan(data, this.#fillPillar ?? this.#target.selectedPillar());
		if (!plan) {
			this.#say(data.goal.trim() ? 'Every line is filled. Review my chart instead?' : 'Give the chart a goal first, then I can fill the rest.');
			return;
		}
		await this.#withModel(() => this.#fill());
	}

	allowDownload(id: number): void {
		this.#consent = true;
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
			// A draft can open as a new chart. The conversation that made it goes with it.
			const next = this.#target.chartId?.();
			if (next) this.#chartId = next;
			this.#settle(id, 'used');
			this.#clearTurn();
			this.step = 'idle';
			this.#celebrate('Done. Plan this week whenever you like.');
		} else if (card.kind === 'cells') {
			this.#target.setCells(card.edits);
			this.#settle(id, 'used');
			this.#celebrate(card.edits.length === 1 ? 'Changed it.' : `Changed ${card.edits.length} lines.`);
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

	/** Trade one pick for the next best, from a pillar the others don't use where it can. */
	swap(id: number, key: string): void {
		const message = this.messages.find((entry) => entry.id === id);
		const card = message?.card;
		if (!message || card?.kind !== 'picks' || message.state !== 'open') return;
		this.#swapped.add(key);
		this.#target.decline?.([key]);
		const keep = card.picks.filter((pick) => pick.key !== key);
		const exclude = new Set([...card.picks.map((pick) => pick.key), ...this.#swapped]);
		const data = this.#target.data();
		const options = card.scope === 'today' ? suggestToday(data, new Date(), 8, exclude) : suggestWeek(data, 8, new Date(), exclude);
		const taken = new Set(keep.map((pick) => pick.pillarIndex));
		const next: HelperPick | undefined = options.find((pick) => !taken.has(pick.pillarIndex)) ?? options[0];
		const picks = next ? card.picks.map((pick) => (pick.key === key ? next : pick)) : keep;
		if (picks.length === 0) {
			this.#settle(id, 'skipped');
			this.#aside('Nothing else is open right now.');
			return;
		}
		this.messages = this.messages.map((entry) => (entry.id === id ? { ...entry, card: { ...card, picks } } : entry));
		if (!next) this.#aside('Nothing else is open right now.');
	}

	skip(id: number): void {
		const message = this.messages.find((entry) => entry.id === id);
		if (!message?.card || message.state !== 'open') return;
		this.#settle(id, 'skipped');
		if (message.card.kind === 'picks') this.#target.decline?.(message.card.picks.map((pick) => pick.key));
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
			this.#say('Every line can be marked done, and it is yours to do.');
			this.#cheerOnly();
			return;
		}
		const count = findings.length === 1 ? 'One line' : `${findings.length} lines`;
		this.#say(`${count} could be clearer. I can rewrite them, and you choose what stays.`, { kind: 'findings', findings });
	}

	#picks(scope: 'today' | 'week', data: ChartData): void {
		this.#swapped.clear();
		const picks = scope === 'today' ? suggestToday(data) : suggestWeek(data);
		if (picks.length === 0) {
			this.#say('There is nothing open to pick yet. Add a few actions first.');
			return;
		}
		this.#say(
			scope === 'today'
				? "Pick today's three, from different pillars."
				: `${picks.length} for this week, starting with the pillars you have not used. Pinned ones lead each day.`,
			{ kind: 'picks', scope, picks }
		);
	}

	async #draft(answers: ReturnType<typeof chartAnswersFromText>): Promise<void> {
		const coach = await loadCoachModule();
		let draftId = 0;
		const result = await coach.proposeChart(answers, (partial) => {
			if (!draftId) {
				this.#say('Pillars first. The actions follow, one pillar at a time.', { kind: 'chart', data: partial });
				draftId = this.messages[this.messages.length - 1]?.id ?? 0;
				this.#settle(draftId, 'working');
				return;
			}
			this.#patchChart(draftId, partial);
		});
		if (!result.chart) {
			if (draftId) this.#settle(draftId, 'skipped');
			this.#fail('I lost the thread on that one. Try again, or copy the prompt into another chat app.', { kind: 'prompt' });
			return;
		}
		const finished = { ...result.chart, brief: briefOf(answers) };
		if (draftId) {
			this.#patchChart(draftId, finished);
			this.#settle(draftId, 'open');
		} else this.#say('Here is a first chart.', { kind: 'chart', data: finished });
		const written = result.chart.actions.flat().filter((action) => action.trim()).length;
		this.#say(written === 64 ? 'All 64 actions are in. Use this chart, or ask me to start again.' : `${written} of 64 actions are in. The empty ones stayed empty.`);
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
			persistModelConsent();
		} catch {
			this.#warming = false;
			if (!coach.coachLoaded()) {
				this.#consent = false;
				clearModelConsent();
			}
		} finally {
			stop();
			if (!this.busy) this.progress = null;
		}
	}

	async #fill(): Promise<void> {
		const coach = await loadCoachModule();
		const data = this.#target.data();
		const plan = fillPlan(data, this.#fillPillar ?? this.#target.selectedPillar());
		if (!plan) return;
		if (plan.kind === 'pillars') {
			const lines = await coach.fillPillars(data, plan.empty.length);
			if (!lines) return this.#fail('I could not name those pillars. Try once more?');
			const edits = plan.empty.slice(0, lines.length).map((pillarIndex, index) => ({ key: `p${pillarIndex}`, before: '', after: lines[index] ?? '' }));
			const short = lines.length < plan.empty.length ? ` ${plan.empty.length - lines.length} left empty.` : '';
			this.#say(`${edits.length} pillars for "${data.goal.trim()}". Keep the ones that matter.${short}`, { kind: 'cells', edits });
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
		const short = lines.length < plan.empty.length ? ` ${plan.empty.length - lines.length} left empty.` : '';
		this.#say(`${edits.length} for ${name}. Each one is something you can do.${short}`, { kind: 'cells', edits });
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

	async #answer(question: string, history: readonly ChatMessage[] = [], pillar: number | null = null): Promise<void> {
		const coach = await loadCoachModule();
		const reply = await coach.answer(this.#target.data(), question, history, pillar);
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
		coach.resumeCoach();
		this.busy = true;
		this.#jobChart = this.#chartId;
		this.progress = describeCoachProgress(coach.coachLoaded() ? 'Thinking.' : 'Waking up.');
		this.#progressStop ??= coach.watchCoachProgress((update) => {
			this.progress = describeCoachProgress(update.text, update.ratio);
		});
		try {
			await run();
			this.modelReady = coach.coachLoaded();
			if (this.modelReady) persistModelConsent();
		} catch (error) {
			if (this.#stale) return;
			if (error instanceof CoachStopped) {
				this.messages = this.messages.map((entry) =>
					entry.state === 'working' ? { ...entry, state: 'skipped' } : entry
				);
				this.#clearTurn();
				this.step = 'idle';
				this.#sorry = true;
				this.#aside('Stopped.', true);
			} else {
				if (!coach.coachLoaded()) {
					this.#consent = false;
					clearModelConsent();
				}
				this.#fail('Something stopped me. Try again in a moment.');
			}
		} finally {
			if (this.#stale) {
				this.step = 'idle';
				this.#clearTurn();
			}
			this.#jobChart = null;
			this.busy = false;
			this.progress = null;
			if (!this.open) this.unread = true;
		}
	}

	#clearTurn(): void {
		this.#help = false;
		this.#lead = null;
		this.#pillarFill = null;
		this.#sketch = null;
		this.#sketchId = 0;
		this.#direction = '';
	}

	#dismissAim(): void {
		this.#clearTurn();
		this.step = 'idle';
		this.#say('Staying with this chart.');
	}

	#patchChart(id: number, data: ChartData): void {
		if (this.#stale) return;
		this.messages = this.messages.map((entry) => (entry.id === id ? { ...entry, card: { kind: 'chart', data } } : entry));
	}

	async #sketchAim(): Promise<void> {
		if (this.busy || !this.#direction.trim()) return;
		const again = this.#sketch !== null;
		this.#help = false;
		this.#pillarFill = null;
		const answers = chartAnswersFromText(this.#direction, '');
		await this.#withModel(async () => {
			const coach = await loadCoachModule();
			let draftId = again ? this.#sketchId : 0;
			if (again && draftId) this.#settle(draftId, 'working');
			const result = await coach.proposePillars(answers, (partial) => {
				this.#sketch = partial;
				if (!draftId) {
					this.#say('Here are eight parts of the goal.', { kind: 'chart', data: partial });
					draftId = this.messages[this.messages.length - 1]?.id ?? 0;
					this.#sketchId = draftId;
					this.#settle(draftId, 'working');
					return;
				}
				this.#sketchId = draftId;
				this.#patchChart(draftId, partial);
			});
			if (!result.chart) {
				if (draftId) this.#settle(draftId, 'skipped');
				this.#sketch = null;
				this.step = 'offer';
				this.#fail('I could not name those pillars. Try once more?');
				return;
			}
			this.#sketch = result.chart;
			if (draftId) this.#settle(draftId, 'open');
			this.step = 'extra';
			if (!again) this.#say(DRAFT_QUESTIONS[1]);
		}, 'draft');
	}

	async #fillSketch(answers: ChartAnswers): Promise<void> {
		const coach = await loadCoachModule();
		const draft = this.#sketch;
		const draftId = this.#sketchId;
		if (!draft || !draftId) return;
		this.#settle(draftId, 'working');
		const filled = await coach.fillDraftActions(draft, answers, (partial) => {
			this.#sketch = partial;
			this.#patchChart(draftId, partial);
		});
		this.#patchChart(draftId, { ...filled, brief: briefOf(answers) });
		this.#settle(draftId, 'open');
		this.step = 'idle';
		this.#sketch = null;
		const written = filled.actions.flat().filter((action) => action.trim()).length;
		this.#say(
			written === 64
				? 'All 64 actions are in. Use this chart, or ask me to start again.'
				: `${written} of 64 actions are in. The empty ones stayed empty.`
		);
	}

	#push(entry: Omit<HelperMessage, 'id'>): HelperMessage {
		const message: HelperMessage = { id: this.#seq++, ...entry };
		this.messages = [...this.messages, message];
		return message;
	}

	/** A greeting or status line: shown, never sent to the model. */
	#aside(text: string, preserveSorry = false): void {
		if (this.#stale) return;
		if (!preserveSorry) this.#sorry = false;
		this.#push({ from: 'helper', text, aside: true });
		if (!this.open) this.unread = true;
	}

	#say(text: string, card?: HelperCard, preserveSorry = false): void {
		if (this.#stale) return;
		if (!preserveSorry) this.#sorry = false;
		if (card) {
			if (this.messages.some((entry) => entry.state === 'open' && entry.card?.kind === 'download')) this.#pending = null;
			this.messages = this.messages.map((entry) => (entry.state === 'open' ? { ...entry, state: 'skipped' } : entry));
		}
		this.#push({ from: 'helper', text, card, state: card ? 'open' : undefined });
		if (!this.open) this.unread = true;
	}

	#fail(text: string, card?: HelperCard): void {
		this.#sorry = true;
		this.#say(text, card, true);
	}

	#settle(id: number, state: CardState): void {
		if (this.#stale) return;
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
		chart.say(edits.length === 1 ? 'Changed 1 line.' : `Changed ${edits.length} lines.`);
	},
	setToday: (keys) => {
		chart.setFocus(todayKey(), keys);
		chart.setViewMode('today');
	},
	pinWeek: (keys) => {
		for (const key of keys) chart.setActionMeta(key, { pinned: true });
		chart.say(`Pinned ${keys.length} for this week.`);
	},
	showCell: (key) => chart.jumpToKey(key),
	decline: (keys) => chart.declineToday(keys),
	chartId: () => chart.activeId
});
