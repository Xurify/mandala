import { chart } from './chart.svelte';
import { draftPrompt, fillPrompt, parseDraftText, type ChartAnswers } from './draft.ts';
import {
	aimParts,
	askPrompt,
	briefOf,
	chartAnswersFromText,
	chatReply,
	clarifyOf,
	chipsFor,
	DRAFT_QUESTIONS,
	editWords,
	extraChips,
	fillEdits,
	fillPlan,
	followUpQuestion,
	greetingFor,
	greetingInsight,
	helpChips,
	helpReply,
	insightChip,
	insightSignature,
	insightsFor,
	isCancellation,
	isCardRejection,
	isMissingCard,
	methodAnswer,
	moodFor,
	norm,
	offerChips,
	pillarMentioned,
	progressReport,
	reviewChart,
	routeOf,
	splitGoal,
	suggestToday,
	suggestWeek,
	type CardState,
	type CellEdit,
	type HelperCard,
	type HelperChip,
	type HelperJob,
	type HelperMessage,
	type HelperMood,
	type HelperPick,
	type HelperRoute
} from './helper.ts';
import { blockOfK, hasContent, todayKey, type ChartBrief, type ChartData } from './model.ts';

export type { CardState, CellEdit, HelperCard, HelperMessage, HelperMood };

/** What the helper may read and change. The app passes the chart store; the lab passes a sandbox. */
export type HelperTarget = {
	data(): ChartData;
	applyDraft(next: ChartData): boolean;
	setCells(edits: CellEdit[]): void;
	setToday(keys: string[]): void;
	pinWeek(keys: string[]): void;
	showCell(key: string): void;
	/** Suggestions turned down today, so they are not offered again today. */
	decline?(keys: string[]): void;
	/** An insight was shown, so the greeting does not repeat it. */
	noteShown?(signature: string): void;
	/** Replace what Bindu kept from the draft. */
	setBrief?(brief: ChartBrief | undefined): void;
	/** The chart the conversation belongs to. The lab leaves it out and keeps one thread. */
	chartId?(): string;
};

/**
 * Bindu: reads the chart, the day log and the method, and answers from them, instantly and offline. Writing
 * lines is handed to whatever chat app the person uses: Bindu writes the prompt, and reads the pasted reply.
 */
export class HelperStore {
	open = $state(false);
	messages: HelperMessage[] = $state([]);
	unread = $state(false);
	step = $state<'idle' | 'direction' | 'extra' | 'offer'>('idle');
	#cheer = $state(false);
	listening = $state(false);

	mood: HelperMood = $derived.by(() => {
		const openCard = this.messages.find((entry) => entry.state === 'open')?.card?.kind ?? null;
		return moodFor({ cheer: this.#cheer, card: openCard, step: this.step, listening: this.listening });
	});

	#target: HelperTarget;
	#seq = 1;
	#direction = '';
	/** What came with the goal: level, what is hard, a constraint. Kept for the prompt and the brief. */
	#said = '';
	/** The answers behind the last draft prompt, kept on the chart when its reply is pasted. */
	#answers: ChartAnswers | null = null;
	#help = $state(false);
	/** What the last clean review looked at, so asking again does not repeat the same verdict. */
	#cleanReview = '';
	#cheerTimer: ReturnType<typeof setTimeout> | null = null;
	#chartId = '';
	#threads = new Map<string, HelperMessage[]>();
	#thanks = 0;
	#lead = $state<HelperChip | null>(null);
	/** A message Bindu asked about, kept so a chip can act on it as first sent. */
	#unsure = $state<{ text: string; chips: HelperChip[] } | null>(null);
	#swapped = new Set<string>();

	constructor(target: HelperTarget) {
		this.#target = target;
		this.#chartId = target.chartId?.() ?? '';
	}

	/** Each chart keeps its own conversation. */
	follow(chartId: string): void {
		if (chartId === this.#chartId) return;
		if (this.#chartId) this.#threads.set(this.#chartId, this.messages);
		this.#chartId = chartId;
		this.messages = this.#threads.get(chartId) ?? [];
		this.#threads.delete(chartId);
		this.step = 'idle';
		this.unread = false;
		this.#clearTurn();
		if (this.open && this.messages.length === 0) this.#greet();
	}

	#greet(): void {
		const data = this.#target.data();
		const top = data.goal.trim() ? greetingInsight(data) : null;
		this.#aside(greetingFor(data));
		this.#lead = insightChip(top ?? undefined);
		if (top) this.#target.noteShown?.(insightSignature(top));
	}

	/** What Bindu kept from the draft, with a way to forget each line. */
	showFacts(): void {
		this.open = true;
		const has = Boolean(this.#target.data().brief);
		this.#push({
			from: 'helper',
			text: has
				? 'This is what I kept from when we drafted the chart. Prompts I write for you carry it.'
				: 'Nothing yet. When we draft a chart together, I keep your answers here.',
			card: has ? { kind: 'facts' } : undefined,
			aside: true
		});
	}

	forget(field: keyof ChartBrief): void {
		const brief = this.#target.data().brief;
		if (!brief?.[field]) return;
		const next = { ...brief };
		delete next[field];
		this.#target.setBrief?.(next);
	}

	get data(): ChartData {
		return this.#target.data();
	}

	get chips(): HelperChip[] {
		const openCard = this.messages.find((entry) => entry.state === 'open')?.card;
		// The open card already offers this job as its button.
		const cardJob: HelperJob | null =
			openCard?.kind === 'picks' ? openCard.scope : openCard?.kind === 'findings' ? 'review' : openCard?.kind === 'chart' ? 'draft' : null;
		return this.#draftChips(this.#baseChips()).filter((chip) => !(chip.act.kind === 'job' && chip.act.job === cardJob));
	}

	/**
	 * Under an open draft, chips are about the draft. Today, week and fill read the chart behind it, so they
	 * wait until the draft is kept. The review chip names what it will check, and steps aside right after a
	 * clean review of the same thing.
	 */
	#draftChips(chips: HelperChip[]): HelperChip[] {
		const draft = this.#openDraft();
		const reviewed = reviewSignature(draft?.data ?? this.#target.data(), draft?.id) === this.#cleanReview;
		const isJob = (chip: HelperChip, ...jobs: HelperJob[]) => chip.act.kind === 'job' && jobs.includes(chip.act.job);
		if (!draft || this.step !== 'idle') return chips.filter((chip) => !(reviewed && isJob(chip, 'review')));
		const review: HelperChip[] = reviewed ? [] : [{ label: 'Review this draft', act: { kind: 'job', job: 'review' } }];
		return [...review, ...chips.filter((chip) => !isJob(chip, 'review', 'today', 'week', 'fill'))];
	}

	#baseChips(): HelperChip[] {
		if (this.step === 'offer') return offerChips();
		if (this.step === 'extra') return extraChips(this.#said);
		if (this.step === 'direction') return [];
		if (this.#unsure) return this.#unsure.chips;
		if (this.#lead) {
			const lead = this.#lead;
			return [lead, ...chipsFor(this.#target.data()).filter((chip) => chip.label !== lead.label)];
		}
		if (this.#help) return helpChips();
		return chipsFor(this.#target.data());
	}

	get placeholder(): string {
		if (this.step === 'direction') return 'Run a half marathon, learn Spanish…';
		if (this.step === 'extra') return 'Time a day, or a date';
		return 'Ask, or paste a reply';
	}

	show(job?: HelperJob): void {
		this.open = true;
		this.unread = false;
		if (this.messages.length === 0) this.#greet();
		if (job) this.start(job);
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
		this.#clearTurn();
		this.#greet();
	}

	cancel(): void {
		if (this.step !== 'idle' || this.#direction) {
			this.step = 'idle';
			this.#clearTurn();
			this.#aside('Draft cancelled.');
		}
	}

	choose(chip: HelperChip): void {
		const act = chip.act;
		if (act.kind === 'job') this.start(act.job);
		else if (act.kind === 'send') this.send(act.text);
		else if (act.kind === 'aim') this.#beginAim();
		else if (act.kind === 'show') this.showCell(act.key);
		else if (act.kind === 'reading') this.#pickReading(act.route);
		else this.#dismissAim();
	}

	send(raw: string): void {
		const text = raw.trim();
		if (!text) return;
		// A pasted chart is the reply to a prompt, whatever step the draft is on. Its JSON is not worth showing.
		const pasted = parseDraftText(text);
		this.#push({ from: 'you', text: pasted ? 'A pasted reply.' : text.length > 600 ? `${text.slice(0, 600)}…` : text });

		if (isMissingCard(text) && this.#showChartCard()) return;
		if (pasted) {
			this.step = 'idle';
			this.#received(pasted);
			return;
		}

		if (this.step === 'direction') {
			if (isCancellation(text) || /^(?:no|nope|nah)\.?$/i.test(text)) return this.cancel();
			const parts = splitGoal(text);
			this.#direction = parts.goal || text;
			this.#said = parts.said;
			const question = followUpQuestion(parts.said);
			if (!question) return this.#handOff(chartAnswersFromText(this.#direction, '', this.#said));
			this.step = 'extra';
			this.#say(question);
			return;
		}
		if (this.step === 'extra') {
			if (isCancellation(text)) return this.cancel();
			return this.#handOff(chartAnswersFromText(this.#direction, text, this.#said));
		}
		if (this.step === 'offer') {
			if (isCancellation(text) || /^(?:no|nope|nah|stay|stay\s+(?:with|on)\s+this\s+chart|keep\s+this\s+chart|leave\s+it)\.?$/i.test(text)) {
				this.#dismissAim();
				return;
			}
			this.step = 'idle';
		}
		this.#help = false;
		this.#lead = null;
		this.#unsure = null;

		const openMessage = this.messages.find((entry) => entry.state === 'open');
		if (openMessage && isCardRejection(text)) {
			this.skip(openMessage.id);
			return;
		}

		const data = this.#target.data();
		const route = routeOf(text, data);
		const unsure = route === 'clarify' ? clarifyOf(text) : null;
		if (unsure) {
			this.#unsure = { text, chips: unsure.chips };
			this.#say(unsure.question);
			return;
		}
		this.#dispatch(route, text, data);
	}

	#pickReading(route: HelperRoute): void {
		const unsure = this.#unsure;
		if (!unsure) return;
		this.#unsure = null;
		this.#dispatch(route, unsure.text, this.#target.data());
	}

	/** Does what `routeOf` decided. What no rule answers is handed to a chat app, with the chart. */
	#dispatch(route: HelperRoute, text: string, data: ChartData): void {
		if (route === 'cancel') {
			this.#clearTurn();
			this.step = 'idle';
			this.#aside('Nothing to cancel.');
			return;
		}
		if (route === 'chat') {
			const reply = chatReply(text, data, this.#thanks++);
			this.#help = reply.nextStep;
			this.#say(reply.text);
			return;
		}
		if (route === 'facts') return this.showFacts();
		if (route === 'progress') {
			this.#say(progressReport(data));
			this.#lead = insightChip(insightsFor(data).find((insight) => insight.key));
			return;
		}
		if (route === 'today' || route === 'week' || route === 'review' || route === 'draft' || route === 'fill') return this.start(route);
		if (route === 'help') {
			this.#help = data.goal.trim() !== '' && !fillPlan(data);
			this.#say(helpReply(data));
			return;
		}
		const method = route === 'method' ? methodAnswer(text) : null;
		if (method) {
			this.#say(method.text);
			if (method.job) this.#lead = chipsFor(data).find((chip) => chip.act.kind === 'job' && chip.act.job === method.job) ?? null;
			return;
		}
		const aim = route === 'aim' ? aimParts(text, data) : null;
		if (aim) {
			this.#direction = aim.aim;
			this.#said = aim.said;
			// With no goal yet there is nothing to stay on, so the draft starts right away.
			if (!data.goal.trim()) return this.#beginAim();
			this.step = 'offer';
			const opening = 'A new goal gets its own chart. Your current one stays.';
			this.#say(aim.said ? `${opening} I kept what you told me.` : opening);
			return;
		}
		const mentioned = pillarMentioned(text, data);
		if (route === 'pillar' && mentioned !== null) {
			const name = (data.pillars[mentioned] ?? '').trim();
			const empty = (data.actions[mentioned] ?? []).filter((action) => !action.trim()).length;
			this.#say(
				empty > 0
					? `${name} still has ${empty} empty ${empty === 1 ? 'action' : 'actions'}. Fill the gaps gives you a prompt for them.`
					: `${name} is already full. We can review its actions or pick one for today.`
			);
			return;
		}
		this.#say('I answer from your chart and the method, so this one is for a chat app. The prompt carries your chart with the question.', {
			kind: 'prompt',
			text: askPrompt(data, text)
		});
	}

	start(job: HelperJob): void {
		this.#clearTurn();
		this.step = 'idle';
		const data = this.#target.data();
		if (job === 'draft') {
			this.step = 'direction';
			this.#say(DRAFT_QUESTIONS[0]);
			return;
		}
		if (job === 'review') {
			// Review what is in front of the person: an open draft before the chart behind it.
			const draft = this.#openDraft();
			return this.#review(draft?.data ?? data, draft?.id);
		}
		if (job === 'week' || job === 'today') return this.#picks(job, data);
		if (!fillPlan(data)) {
			this.#say(data.goal.trim() ? 'Every line is filled. Review my chart instead?' : 'Give the chart a goal first, then the rest can follow.');
			return;
		}
		this.#say('Copy this into any chat app. It asks only for the empty lines and keeps yours as they are. Paste the reply here, and I add just the new ones.', {
			kind: 'prompt',
			text: fillPrompt(data)
		});
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
			this.#celebrate(
				card.data.brief ? 'Done. I kept your answers for later. Ask what I know any time.' : 'Done. Plan this week whenever you like.'
			);
		} else if (card.kind === 'cells') {
			const words = editWords(this.#target.data(), card.edits);
			this.#target.setCells(card.edits);
			this.#settle(id, 'used');
			this.#celebrate(words.done);
		} else if (card.kind === 'picks') {
			const keys = card.picks.map((pick) => pick.key);
			if (card.scope === 'today') this.#target.setToday(keys);
			else this.#target.pinWeek(keys);
			this.#settle(id, 'used');
			this.#celebrate(card.scope === 'today' ? 'Today is set. One at a time.' : 'Pinned. They will lead your picks each day.');
		}
	}

	/** Trade one pick for the next best, from a pillar the others don't use where it can. */
	swap(id: number, key: string): void {
		const message = this.messages.find((entry) => entry.id === id);
		const card = message?.card;
		if (!message || card?.kind !== 'picks' || message.state !== 'open') return;
		this.#swapped.add(key);
		if (card.scope === 'today') this.#target.decline?.([key]);
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
		if (message.card.kind === 'picks' && message.card.scope === 'today') this.#target.decline?.(message.card.picks.map((pick) => pick.key));
	}

	showCell(key: string): void {
		this.#target.showCell(key);
	}

	/** The prompt for a whole chart, as a blank form, for the panel's "another chat app" link. */
	promptText(): string {
		return draftPrompt();
	}

	/** Hands the draft to a chat app: the person's answers, in a prompt to copy. */
	#handOff(answers: ChartAnswers): void {
		this.step = 'idle';
		this.#answers = answers;
		this.#direction = '';
		this.#said = '';
		this.#say('Here is a prompt with your answers. Copy it into any chat app, then paste the whole reply here.', {
			kind: 'prompt',
			text: draftPrompt(answers)
		});
	}

	/** A goal named in passing: ask the follow-up, or hand it off straight away. */
	#beginAim(): void {
		const question = followUpQuestion(this.#said);
		if (!question) return this.#handOff(chartAnswersFromText(this.#direction, '', this.#said));
		this.step = 'extra';
		this.#say(question);
	}

	/**
	 * A chart pasted from a chat app. For this chart's goal it fills only the empty lines; anything else is a
	 * new draft, with the answers that asked for it.
	 */
	#received(reply: ChartData): void {
		const data = this.#target.data();
		if (hasContent(data) && norm(reply.goal) === norm(data.goal)) {
			const edits = fillEdits(data, reply);
			if (edits.length === 0) return this.#say('Nothing new in that reply. Every line it fills is already written here.');
			this.#say(`${edits.length} ${edits.length === 1 ? 'line' : 'lines'} for the empty cells, ready to add.`, { kind: 'cells', edits });
			return;
		}
		const brief = this.#answers ? briefOf(this.#answers) : undefined;
		this.#answers = null;
		this.#say('Here is your chart.', { kind: 'chart', data: brief ? { ...reply, brief } : reply });
	}

	#review(data: ChartData, draftId?: number): void {
		const findings = reviewChart(data);
		const where = draftId ? 'this draft' : data.goal.trim() ? `"${data.goal.trim()}"` : 'this chart';
		const signature = reviewSignature(data, draftId);
		if (findings.length === 0) {
			if (this.#cleanReview === signature) {
				this.#say('Still clean. Nothing changed since the last check.');
				return;
			}
			this.#cleanReview = signature;
			this.#say(`Every line in ${where} can be marked done, and it is yours to do.`);
			this.#cheerOnly();
			return;
		}
		this.#cleanReview = '';
		const count = findings.length === 1 ? 'One line' : `${findings.length} lines`;
		this.#say(`${count} in ${where} could be clearer. Open one to make it something you can tick.`, { kind: 'findings', findings, draft: draftId });
	}

	/** The newest chart card still waiting on a decision, if there is one. */
	#openDraft(): { id: number; data: ChartData } | null {
		const message = [...this.messages].reverse().find((entry) => entry.state === 'open' && entry.card?.kind === 'chart');
		return message?.card?.kind === 'chart' ? { id: message.id, data: message.card.data } : null;
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

	#clearTurn(): void {
		this.#help = false;
		this.#lead = null;
		this.#unsure = null;
		this.#direction = '';
		this.#said = '';
	}

	#dismissAim(): void {
		this.#clearTurn();
		this.step = 'idle';
		this.#say('Staying with this chart.');
	}

	/** Moves a message to the end of the conversation, so the card is in view. */
	#bringDown(id: number): void {
		const message = this.messages.find((entry) => entry.id === id);
		if (!message || this.messages[this.messages.length - 1]?.id === id) return;
		this.messages = [...this.messages.filter((entry) => entry.id !== id), message];
	}

	/** Answers "I don't see the chart" from the panel itself. False when there is no chart card to point at. */
	#showChartCard(): boolean {
		const card = [...this.messages].reverse().find((entry) => entry.card?.kind === 'chart' && entry.state !== 'skipped');
		if (!card) return false;
		if (card.state === 'used') {
			this.#aside('It is on your chart now. Close this panel to see it.');
			return true;
		}
		this.#aside('Here it is. It is not saved yet.');
		this.#bringDown(card.id);
		return true;
	}

	#push(entry: Omit<HelperMessage, 'id'>): HelperMessage {
		const message: HelperMessage = { id: this.#seq++, ...entry };
		this.messages = [...this.messages, message];
		return message;
	}

	/** A greeting or status line. */
	#aside(text: string): void {
		this.#push({ from: 'helper', text, aside: true });
		if (!this.open) this.unread = true;
	}

	#say(text: string, card?: HelperCard): void {
		if (card) {
			// A review of a draft leaves that draft open.
			const keep = card.kind === 'findings' ? card.draft : undefined;
			this.messages = this.messages.map((entry) => (entry.state === 'open' && entry.id !== keep ? { ...entry, state: 'skipped' } : entry));
		}
		this.#push({ from: 'helper', text, card, state: card ? 'open' : undefined });
		if (!this.open) this.unread = true;
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

/** What a review looked at: which chart, and every line on it. */
function reviewSignature(data: ChartData, draftId?: number): string {
	return `${draftId ?? 'chart'}:${JSON.stringify([data.goal, data.pillars, data.actions])}`;
}

export const helper = new HelperStore({
	data: () => chart.data,
	applyDraft: (next) => chart.applyDraft(next),
	setCells: (edits) => {
		for (const edit of edits) chart.setText(edit.key, edit.after);
		const first = edits[0];
		if (first) chart.select(first.key.startsWith('p') ? 4 : blockOfK(Number(first.key.slice(1).split('_')[0])));
		chart.say(editWords(chart.data, edits).done);
	},
	setToday: (keys) => {
		chart.setFocus(todayKey(), keys, true);
		chart.setViewMode('today');
	},
	pinWeek: (keys) => {
		for (const key of keys) chart.setActionMeta(key, { pinned: true });
		chart.say(`Pinned ${keys.length} for this week.`);
	},
	showCell: (key) => chart.jumpToKey(key),
	decline: (keys) => chart.declineToday(keys),
	noteShown: (signature) => chart.noteShown(signature),
	setBrief: (brief) => chart.setBrief(brief),
	chartId: () => chart.activeId
});
