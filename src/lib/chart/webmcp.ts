import { boardOf, finishedOn, LANE_NAMES, LANES, tomorrowOf, type Lane } from './board.ts';
import { ACTION_MAX, chartFromDraft, GOAL_MAX, METHOD, PILLAR_MAX } from './draft.ts';
import { gapsOf, progressOf, suggestToday, type CellEdit, type HelperOffer, type KindChange } from './helper.ts';
import {
	dateKeyOf,
	dateKeyOffset,
	getByKey,
	getDayLog,
	isActionId,
	isRoutine,
	idAt,
	isUrl,
	pillarOfAction,
	slotOf,
	TEXT_MAX,
	TOOL_KINDS,
	weekStartKey,
	wordsOf,
	type ActionId,
	type ActionKind,
	type ChartData,
	type Tool,
	type ToolKind
} from './model.ts';
import { keptFor, openedLately, shelfOf, toolInChart, upNext } from './tools.ts';

/**
 * Tools an agent in the browser can call, through WebMCP (`document.modelContext`). The agent reads, proposes what
 * needs judgment (lines, kinds, a note for the week) to Bindu for the person to keep, and does the small daily things
 * a tap does. Nothing here shares, syncs, exports or deletes: an agent that read a hostile page elsewhere has no way
 * to send the person's days out through this one.
 */

export type AgentTarget = {
	data(): ChartData;
	now(): Date;
	reflectionWeek(): string;
	/** False while Bindu is turned off on this device. */
	offer(offer: HelperOffer): boolean;
	finish(id: ActionId): void;
	reopen(id: ActionId): void;
	setToday(ids: ActionId[]): void;
	planTomorrow(ids: ActionId[]): void;
	pin(ids: ActionId[], pinned: boolean): void;
	moveCard(id: ActionId, lane: Lane, index: number): boolean;
	logTime(id: ActionId, minutes: number, link?: string): void;
	startTimer(id: ActionId, minutes?: number, link?: string): void;
	stopTimer(): void;
	addLink(pillarIndex: number, url: string, title: string, kind: ToolKind): void;
	updateLink(pillarIndex: number, id: string, patch: LinkPatch): void;
};

export type LinkPatch = Partial<Pick<Tool, 'kind' | 'known' | 'action'>>;

export type AgentToolAnnotations = {
	readOnlyHint?: boolean;
	consequentialHint?: boolean;
	untrustedContentHint?: boolean;
};

export type AgentTool = {
	name: string;
	title: string;
	description: string;
	inputSchema: Record<string, unknown>;
	annotations: AgentToolAnnotations;
	execute(input: Record<string, unknown>): Promise<string>;
};

const CELL = /^(p[0-7]|a[0-7]_[0-7])$/;
const MAX_MINUTES = 600;
const BLOCK_MAX = 120;
const NOTE_MAX = 600;
const WEEKS_BACK = 12;
const URL_MAX = 2048;
const KIND_NAMES = ['standard', 'routine', 'milestone'] as const;

const CHART_WORDS =
	'A Mandala chart has one goal in the center, eight pillars around it (the drivers of the goal), and eight actions under each pillar that the person schedules and ticks.';
const TESTS =
	'Every action must pass two tests. Calendar: it can be scheduled and marked done ("Study geography for 20 minutes a day", not "Do better in geography"). Control: it is a behaviour the person can do ("Post two videos a day", not "Get 10 million views"). A pillar is a short heading for one driver, a few words.';
const CELLS = 'Cells: "p0" to "p7" are the pillars; "a{pillar}_{slot}" is an action, both 0 to 7, so "a2_5" is the sixth action of the third pillar.';
const KINDS =
	'Kinds: a "routine" is a habit done again and again ("Play Spanish audio at breakfast"); it shows on Today every day and is ticked each day, never finished. A "milestone" happens once and is then done for good ("Book a trial lesson"). A "standard" action is done on some days, picked when it fits.';

const LINK_KINDS =
	'Kinds: "repeat" comes round until the person marks it known; "once" is put away after its first open; "staple" stays for good and is never asked about, like a dictionary or a course the person always goes back to.';

const KIND_WORDS: Record<ToolKind, string> = { repeat: 'a repeat link', once: 'a one-time link', staple: 'a staple' };

const BINDU_OFF = 'Not shown: Bindu is turned off on this device, so there is nowhere to show it. The person can turn it on in More actions.';

const READ: AgentToolAnnotations = { readOnlyHint: true, untrustedContentHint: true };
const ID_LIST = { type: 'array', minItems: 1, maxItems: 8, items: { type: 'string' }, description: 'Action ids from read_chart or suggest_today' };
const ONE_ID = { type: 'object', properties: { id: { type: 'string', description: 'An action id from read_chart' } }, required: ['id'] };

function json(value: unknown): string {
	return JSON.stringify(value);
}

function written(data: ChartData, id: ActionId): string | null {
	const at = slotOf(data, id);
	const text = at ? (data.actions[at.pillarIndex]?.[at.slot] ?? '').trim() : '';
	return text || null;
}

function idsIn(value: unknown): unknown[] {
	return Array.isArray(value) ? value : [value];
}

/** An action id that names a written line on this chart, or why not. */
function actionIn(data: ChartData, value: unknown): { id: ActionId; text: string } | { error: string } {
	if (typeof value !== 'string' || !isActionId(value)) return { error: `"${String(value)}" is not an action id. Read the chart for ids.` };
	const text = written(data, value);
	return text ? { id: value, text } : { error: `${value} is not a written action on this chart.` };
}

function quoted(texts: readonly string[]): string {
	return texts.map((text) => `“${text}”`).join(', ');
}

function plural(count: number, one: string): string {
	return `${count} ${count === 1 ? one : `${one}s`}`;
}

function pillarName(data: ChartData, pillarIndex: number): string {
	return data.pillars[pillarIndex]?.trim() || `Pillar ${pillarIndex + 1}`;
}

function isDone(data: ChartData, id: ActionId, dateKey: string): boolean {
	const meta = data.meta?.[id];
	return isRoutine(meta) ? finishedOn(data, id, dateKey) : meta?.done === true;
}

export function chartForAgent(data: ChartData, now: Date): unknown {
	const dateKey = dateKeyOf(now);
	const log = getDayLog(data, dateKey);
	const board = boardOf(data, dateKey);
	const laneOf = (id: ActionId): Lane | undefined => LANES.find((lane) => board[lane].some((card) => card.id === id));
	const timer = data.timer;
	return {
		goal: data.goal.trim(),
		brief: data.brief,
		pillars: data.pillars.map((name, pillarIndex) => ({
			cell: `p${pillarIndex}`,
			name: name.trim(),
			shelf: shelfOf(data, pillarIndex).map((tool) => ({ id: tool.id, title: tool.title, url: tool.url })),
			actions: (data.actions[pillarIndex] ?? []).map((text, slot) => {
				const id = data.actionIds[pillarIndex]![slot]!;
				const meta = data.meta?.[id];
				const line = text.trim();
				return {
					cell: `a${pillarIndex}_${slot}`,
					id,
					text: line,
					...(line ? { kind: meta?.kind ?? 'standard', lane: laneOf(id) } : {}),
					...(line && isDone(data, id, dateKey) ? { done: true } : {}),
					...(meta?.pinned ? { pinned: true } : {})
				};
			})
		})),
		today: { date: dateKey, picked: log.focus.filter((id) => written(data, id)), ticked: log.checked.filter((id) => written(data, id)) },
		tomorrow: getDayLog(data, tomorrowOf(dateKey)).focus.filter((id) => written(data, id)),
		...(timer
			? { timer: { action: timer.action, ...(timer.length ? { blockMinutes: timer.length } : { stopwatch: true }), minutesSoFar: Math.floor((now.getTime() - timer.since) / 60_000) } }
			: {})
	};
}

/**
 * Lines become edits only where they change something. The goal stays the person's to write. The prompt's caps are
 * a request, as a pasted reply's are, so a line in a longer language is held to the cell limit, not refused at the cap.
 */
export function linesToEdits(data: ChartData, lines: unknown): { edits: CellEdit[]; refused: { cell: string; reason: string }[] } {
	const edits = new Map<string, CellEdit>();
	const refused: { cell: string; reason: string }[] = [];
	for (const line of Array.isArray(lines) ? lines : []) {
		const record = (line && typeof line === 'object' ? line : {}) as Record<string, unknown>;
		const cell = typeof record.cell === 'string' ? record.cell : '';
		const after = typeof record.text === 'string' ? record.text.replace(/\s+/g, ' ').trim() : '';
		if (cell === 'g' || cell === 'goal') {
			refused.push({ cell, reason: 'The goal is the person’s to write. Suggest it in words instead.' });
			continue;
		}
		if (!CELL.test(cell)) {
			refused.push({ cell, reason: 'Not a cell. Use p0 to p7, or a0_0 to a7_7.' });
			continue;
		}
		if (!after) {
			refused.push({ cell, reason: 'Empty. Clearing a line is done by hand.' });
			continue;
		}
		if (after.length > TEXT_MAX) {
			refused.push({ cell, reason: `Too long: ${after.length} characters, at most ${TEXT_MAX}.` });
			continue;
		}
		const before = getByKey(data, cell).trim();
		if (before === after) edits.delete(cell);
		else edits.set(cell, { key: cell, before, after });
	}
	return { edits: [...edits.values()], refused };
}

function kindOf(name: unknown): ActionKind | undefined | null {
	if (name === 'standard') return undefined;
	return name === 'routine' || name === 'milestone' ? name : null;
}

/** Kinds become changes only where they differ. A milestone already finished stays as it is. */
export function kindsToChanges(data: ChartData, kinds: unknown): { changes: KindChange[]; refused: { id: string; reason: string }[] } {
	const changes = new Map<ActionId, KindChange>();
	const refused: { id: string; reason: string }[] = [];
	for (const entry of Array.isArray(kinds) ? kinds : []) {
		const record = (entry && typeof entry === 'object' ? entry : {}) as Record<string, unknown>;
		const found = actionIn(data, record.id);
		if ('error' in found) {
			refused.push({ id: String(record.id), reason: found.error });
			continue;
		}
		const after = kindOf(record.kind);
		if (after === null) {
			refused.push({ id: found.id, reason: 'Kind must be standard, routine or milestone.' });
			continue;
		}
		const meta = data.meta?.[found.id];
		if (meta?.kind === 'milestone' && meta.done) {
			refused.push({ id: found.id, reason: `“${found.text}” is a milestone already finished.` });
			continue;
		}
		if (meta?.kind === after) changes.delete(found.id);
		else changes.set(found.id, { id: found.id, text: found.text, pillarIndex: pillarOfAction(data, found.id) ?? 0, before: meta?.kind, after });
	}
	return { changes: [...changes.values()], refused };
}

/** What a week held: what was ticked each day, what was finished, time per pillar, and the note kept for it. */
export function weekForAgent(data: ChartData, now: Date, weeksAgo: number, reflectionWeek: string): unknown {
	const start = new Date(`${weekStartKey(now)}T12:00`);
	start.setDate(start.getDate() - 7 * weeksAgo);
	const from = dateKeyOf(start);
	const today = dateKeyOf(now);
	const days: Record<string, string[]> = {};
	const minutes: Record<string, number> = {};
	const finished: string[] = [];
	let to = from;
	for (let offset = 0; offset < 7; offset++) {
		const key = dateKeyOffset(offset, start);
		if (key > today) break;
		to = key;
		const log = data.days?.[key];
		if (!log) continue;
		const ticked = log.checked.map((id) => wordsOf(data, id)).filter(Boolean);
		if (ticked.length) days[key] = ticked;
		for (const session of log.sessions ?? []) {
			const pillarIndex = pillarOfAction(data, session.action);
			if (pillarIndex === null) continue;
			const name = pillarName(data, pillarIndex);
			minutes[name] = (minutes[name] ?? 0) + session.minutes;
		}
	}
	for (const [id, meta] of Object.entries(data.meta ?? {})) {
		if (meta.kind === 'milestone' && meta.done && meta.doneAt && meta.doneAt >= from && meta.doneAt <= to) finished.push(wordsOf(data, id as ActionId));
	}
	const note = data.weeks?.[from]?.note?.trim();
	return {
		from,
		to,
		ticksByDay: days,
		finished: finished.filter(Boolean),
		minutesByPillar: minutes,
		...(note ? { note } : {}),
		...(from === reflectionWeek ? { reflectionDue: !data.weeks?.[from]?.savedAt } : {})
	};
}

export function shelvesForAgent(data: ChartData, now: Date): unknown {
	return data.pillars.flatMap((name, pillarIndex) => {
		const tools = shelfOf(data, pillarIndex);
		if (tools.length === 0) return [];
		const next = upNext(data, pillarIndex, now);
		const routine = (data.actions[pillarIndex] ?? []).some((text, slot) => text.trim() && isRoutine(data.meta?.[idAt(data, pillarIndex, slot)]));
		return [
			{
				pillar: pillarIndex,
				name: name.trim(),
				links: tools.map((tool) => {
					const kept = keptFor(data, tool);
					const dealt = next.get(tool.id);
					return {
						id: tool.id,
						title: tool.title,
						url: tool.url,
						kind: tool.kind,
						...(tool.known ? { known: true } : {}),
						handedOutBy: kept ?? (routine ? 'any routine' : null),
						...(dealt === undefined ? {} : { upNextFor: idAt(data, pillarIndex, dealt) }),
						openedDaysOfLast14: openedLately(tool, now)
					};
				})
			}
		];
	});
}

function shelvedLink(data: ChartData, value: unknown): { pillarIndex: number; tool: Tool } | null {
	for (let pillarIndex = 0; pillarIndex < 8; pillarIndex++) {
		const tool = shelfOf(data, pillarIndex).find((each) => each.id === value);
		if (tool) return { pillarIndex, tool };
	}
	return null;
}

export function agentTools(target: AgentTarget): AgentTool[] {
	function dayList(input: Record<string, unknown>, dateKey: string, apply: (ids: ActionId[]) => void, day: 'Today' | 'Tomorrow'): string {
		const data = target.data();
		const picked: { id: ActionId; text: string }[] = [];
		const habits: string[] = [];
		for (const value of idsIn(input.ids)) {
			const found = actionIn(data, value);
			if ('error' in found) return `${day} was not changed. ${found.error}`;
			if (picked.some((entry) => entry.id === found.id) || habits.includes(found.text)) continue;
			const meta = data.meta?.[found.id];
			if (isRoutine(meta)) habits.push(found.text);
			else if (meta?.done && !finishedOn(data, found.id, dateKeyOf(target.now()))) return `${day} was not changed. “${found.text}” was finished on another day.`;
			else picked.push(found);
		}
		const routines = (count: number) => (count === 1 ? 'is a routine' : 'are routines');
		if (picked.length + habits.length === 0 || picked.length + habits.length > 8) return `${day} was not changed. Give 1 to 8 action ids.`;
		if (picked.length === 0) return `${day} was not changed. ${quoted(habits)} ${routines(habits.length)}, on Today every day already. Pick other actions.`;
		const timed = data.timer?.action;
		const stopping = day === 'Today' && timed && getDayLog(data, dateKey).focus.includes(timed) && !picked.some((entry) => entry.id === timed) ? written(data, timed) : null;
		apply(picked.map((entry) => entry.id));
		return [
			`${day}'s focus is now: ${quoted(picked.map((entry) => entry.text))}.`,
			habits.length ? `${quoted(habits)} ${routines(habits.length)}, on Today every day as a habit.` : '',
			stopping ? `The stopwatch on “${stopping}” stopped, since that action is off today's list, and its time so far was logged.` : ''
		]
			.filter(Boolean)
			.join(' ');
	}

	return [
		{
			name: 'read_chart',
			title: 'Read the chart',
			description: `${CHART_WORDS} Returns the open chart: goal, the person's brief, each pillar with its shelf of links and its eight actions (cell, id, text, kind, board lane, and whether it is done or pinned), today's and tomorrow's lists and ticks by action id, and a running timer. An empty text is a gap. ${CELLS} ${KINDS}`,
			inputSchema: { type: 'object', properties: {} },
			annotations: READ,
			execute: async () => json(chartForAgent(target.data(), target.now()))
		},
		{
			name: 'review_chart',
			title: 'Review the chart',
			description: `Returns the chart's lines with the method's tests, for you to judge in the language the chart is written in. Nothing on the page judges words; you do. For each line that fails a test, write a rewrite that keeps what the person meant, then send the rewrites with propose_lines.`,
			inputSchema: { type: 'object', properties: {} },
			annotations: READ,
			execute: async () => {
				const data = target.data();
				const gaps = gapsOf(data);
				return json({
					method: METHOD.join('\n'),
					goal: data.goal.trim(),
					brief: data.brief,
					pillars: data.pillars.map((name, pillarIndex) => ({
						cell: `p${pillarIndex}`,
						name: name.trim(),
						actions: (data.actions[pillarIndex] ?? []).flatMap((text, slot) => (text.trim() ? [{ cell: `a${pillarIndex}_${slot}`, text: text.trim() }] : []))
					})),
					emptyPillars: gaps.pillars.map((index) => `p${index}`),
					emptyActions: data.actions.flatMap((row, pillarIndex) => row.flatMap((text, slot) => (text.trim() ? [] : [`a${pillarIndex}_${slot}`])))
				});
			}
		},
		{
			name: 'suggest_today',
			title: "Suggest today's three",
			description:
				'Bindu picks three actions for today, from different pillars, each with why: pinned ones first, then a quiet pillar, then one with momentum. Nothing is set until set_today is called with the ids.',
			inputSchema: { type: 'object', properties: {} },
			annotations: READ,
			execute: async () =>
				json(
					suggestToday(target.data(), target.now()).map((pick) => ({
						id: pick.id,
						text: pick.text,
						pillar: pillarName(target.data(), pick.pillarIndex),
						why: pick.why,
						...(pick.tool ? { tool: { title: pick.tool.title, url: pick.tool.url } } : {})
					}))
				)
		},
		{
			name: 'progress',
			title: 'How it is going',
			description: 'The last 7 days: ticks, the pillars they touched, quiet pillars, minutes logged per pillar, the current streak in days, and up to three insights in words.',
			inputSchema: { type: 'object', properties: {} },
			annotations: READ,
			execute: async () => {
				const data = target.data();
				const progress = progressOf(data, target.now());
				const name = (index: number) => pillarName(data, index);
				return json({
					ticks: progress.ticks,
					pillarsTicked: progress.pillars.map(name),
					quietPillars: progress.quiet.map(name),
					minutes: Object.fromEntries(progress.minutes.flatMap((minutes, index) => (minutes > 0 ? [[name(index), minutes]] : []))),
					streakDays: progress.streak,
					milestonesDone: progress.milestones,
					actionsWritten: progress.written,
					insights: progress.insights.map((insight) => insight.text)
				});
			}
		},
		{
			name: 'week_history',
			title: 'Read a week',
			description: `What one week held, Monday to Sunday: what was ticked each day, the milestones finished, minutes per pillar, and the note the person kept for it. weeksAgo 0 is this week, up to ${WEEKS_BACK}. reflectionDue says the person has not written this week's note yet; propose_reflection can draft it.`,
			inputSchema: { type: 'object', properties: { weeksAgo: { type: 'integer', minimum: 0, maximum: WEEKS_BACK, description: `How many weeks back: 0 is this week, 1 last week, up to ${WEEKS_BACK}. Leave out for this week.` } } },
			annotations: READ,
			execute: async (input) => {
				const back = input.weeksAgo === undefined ? 0 : Number(input.weeksAgo);
				if (!Number.isInteger(back) || back < 0 || back > WEEKS_BACK) return `weeksAgo must be a whole number from 0 to ${WEEKS_BACK}.`;
				return json(weekForAgent(target.data(), target.now(), back, target.reflectionWeek()));
			}
		},
		{
			name: 'read_shelves',
			title: "Read the pillars' shelves",
			description: `Each pillar's shelf: the links (videos, texts, sites) its actions use. For each link: its id, title, url, kind, whether it is known, which action hands it out (an action id, "any routine" in its pillar, or null when nothing does yet), the action Today hands it out for, and on how many of the last 14 days it was opened. Known links wait on the shelf and are not handed out. Pillars with an empty shelf are left out. ${LINK_KINDS}`,
			inputSchema: { type: 'object', properties: {} },
			annotations: READ,
			execute: async () => json(shelvesForAgent(target.data(), target.now()))
		},
		{
			name: 'propose_lines',
			title: 'Propose lines for the chart',
			description: `Shows pillars or actions to the person in Bindu, the chart's helper, with what each replaces. Nothing is written until they press Keep, so tell them to look. Use it to fill gaps or rewrite lines that fail the tests. Send only the lines you mean to change; a new call replaces a proposal still waiting. ${TESTS} Aim for pillars of at most ${PILLAR_MAX} characters and actions of at most ${ACTION_MAX}; a longer language may run over, up to ${TEXT_MAX}. Write in the chart's own language. The goal is not a cell here. ${CELLS}`,
			inputSchema: {
				type: 'object',
				properties: {
					lines: {
						type: 'array',
						minItems: 1,
						maxItems: 72,
						description: 'The pillars and actions to change, each a cell and its new line',
						items: {
							type: 'object',
							properties: {
								cell: { type: 'string', pattern: CELL.source, description: 'p0 to p7 for a pillar, a0_0 to a7_7 for an action' },
								text: { type: 'string', maxLength: TEXT_MAX, description: 'The new line' }
							},
							required: ['cell', 'text']
						}
					}
				},
				required: ['lines']
			},
			annotations: {},
			execute: async (input) => {
				const data = target.data();
				if (!data.goal.trim()) return 'This chart has no goal yet. Use propose_chart to propose a whole chart.';
				const { edits, refused } = linesToEdits(data, input.lines);
				if (edits.length === 0) return json({ shown: false, message: 'Nothing new: every line given is already written that way, or was refused.', refused });
				if (!target.offer({ kind: 'cells', edits })) return BINDU_OFF;
				return json({ shown: true, message: `Shown in Bindu: ${plural(edits.length, 'line')}. Nothing is written until the person presses Keep.`, refused });
			}
		},
		{
			name: 'propose_chart',
			title: 'Propose a whole chart',
			description: `Shows a complete chart to the person in Bindu. Keeping it opens it as a new chart beside the one they have, or fills this one if it is empty. Nothing is written until they press Keep. Ask the person about their goal, their time on a normal day, any date, and where they stand before writing. ${TESTS} Goal at most ${GOAL_MAX} characters. Exactly 8 pillars and 8 actions for each, none empty.`,
			inputSchema: {
				type: 'object',
				properties: {
					goal: { type: 'string', maxLength: GOAL_MAX, description: 'The goal in the center, in the person\'s words and language' },
					pillars: { type: 'array', minItems: 8, maxItems: 8, description: 'Eight pillar headings, p0 to p7 in order', items: { type: 'string', maxLength: TEXT_MAX } },
					actions: {
						type: 'array',
						minItems: 8,
						maxItems: 8,
						description: 'Eight actions for each pillar, in pillar order',
						items: { type: 'array', minItems: 8, maxItems: 8, items: { type: 'string', maxLength: TEXT_MAX } }
					},
					brief: {
						type: 'object',
						description: 'What the person told you, a few words each. Leave out what they did not say.',
						properties: {
							timeline: { type: 'string', description: 'By when, or for how long' },
							situation: { type: 'string', description: 'Where they stand today' },
							focus: { type: 'string', description: 'What matters most to them' },
							constraint: { type: 'string', description: 'What limits them, such as time on a normal day' }
						}
					}
				},
				required: ['goal', 'pillars', 'actions']
			},
			annotations: {},
			execute: async (input) => {
				const chart = chartFromDraft(input);
				if (!chart) return 'Not shown: a chart needs a goal, exactly 8 pillars, and 8 written actions under each.';
				if (!target.offer({ kind: 'chart', data: chart })) return BINDU_OFF;
				return 'Shown in Bindu. Nothing is written until the person keeps it.';
			}
		},
		{
			name: 'propose_kinds',
			title: 'Propose what kind each action is',
			description: `Shows the person which actions you would mark as routines, milestones or standard, in Bindu. Nothing changes until they press Keep. Judge from what each line says, in its own language. Send only the actions whose kind you would change. ${KINDS}`,
			inputSchema: {
				type: 'object',
				properties: {
					kinds: {
						type: 'array',
						minItems: 1,
						maxItems: 64,
						description: 'The actions whose kind would change, each with its new kind',
						items: {
							type: 'object',
							properties: { id: { type: 'string', description: 'An action id from read_chart' }, kind: { type: 'string', enum: [...KIND_NAMES], description: 'The kind it would be' } },
							required: ['id', 'kind']
						}
					}
				},
				required: ['kinds']
			},
			annotations: {},
			execute: async (input) => {
				const { changes, refused } = kindsToChanges(target.data(), input.kinds);
				if (changes.length === 0) return json({ shown: false, message: 'Nothing new: every action given is already that kind, or was refused.', refused });
				if (!target.offer({ kind: 'kinds', changes })) return BINDU_OFF;
				return json({ shown: true, message: `Shown in Bindu: ${plural(changes.length, 'action')}. Nothing changes until the person presses Keep.`, refused });
			}
		},
		{
			name: 'propose_reflection',
			title: "Draft the week's note",
			description: `Shows a draft of the person's note for the week in Bindu: one or two sentences on what happened and what they want next week to hold, in their voice and language. Bindu says it back to them when the new week starts. Nothing is saved until they press Keep. Read week_history first. At most ${NOTE_MAX} characters.`,
			inputSchema: { type: 'object', properties: { note: { type: 'string', maxLength: NOTE_MAX, description: 'One or two sentences in the person\'s voice and language' } }, required: ['note'] },
			annotations: {},
			execute: async (input) => {
				const after = typeof input.note === 'string' ? input.note.trim() : '';
				if (!after) return 'Not shown: the note is empty.';
				if (after.length > NOTE_MAX) return `Not shown: ${after.length} characters, at most ${NOTE_MAX}.`;
				const weekKey = target.reflectionWeek();
				const before = target.data().weeks?.[weekKey]?.note?.trim() ?? '';
				if (before === after) return 'Not shown: that is already the note for this week.';
				if (!target.offer({ kind: 'note', weekKey, before, after })) return BINDU_OFF;
				return 'Shown in Bindu. Nothing is saved until the person keeps it.';
			}
		},
		{
			name: 'finish_action',
			title: 'Mark an action done',
			description: 'Marks an action done today, as a tick on the chart does: a routine is ticked for today, anything else is finished. The person sees a note that it happened.',
			inputSchema: ONE_ID,
			annotations: {},
			execute: async (input) => {
				const data = target.data();
				const found = actionIn(data, input.id);
				if ('error' in found) return found.error;
				if (isDone(data, found.id, dateKeyOf(target.now()))) return `“${found.text}” is already done.`;
				target.finish(found.id);
				return `Finished “${found.text}”.`;
			}
		},
		{
			name: 'reopen_action',
			title: 'Reopen an action',
			description: 'Takes back a done mark: a routine is unticked for today, anything else is open again.',
			inputSchema: ONE_ID,
			annotations: {},
			execute: async (input) => {
				const data = target.data();
				const found = actionIn(data, input.id);
				if ('error' in found) return found.error;
				if (!isDone(data, found.id, dateKeyOf(target.now()))) return `“${found.text}” is not done, so there is nothing to reopen.`;
				target.reopen(found.id);
				return `Reopened “${found.text}”.`;
			}
		},
		{
			name: 'set_today',
			title: "Set today's actions",
			description:
				"Puts these actions on today's list, in this order, replacing what was there. Three from different pillars is the method's usual day. A routine is on Today every day already, as a habit, so pick other actions. Ticks already made today stay; a running timer on an action taken off the list stops, and its time is logged. The reply names what Today now shows; tell the person that, not what you asked for.",
			inputSchema: { type: 'object', properties: { ids: ID_LIST }, required: ['ids'] },
			annotations: {},
			execute: async (input) => dayList(input, dateKeyOf(target.now()), (ids) => target.setToday(ids), 'Today')
		},
		{
			name: 'plan_tomorrow',
			title: "Plan tomorrow's actions",
			description: "Puts these actions on tomorrow's list, replacing what was planned. Tomorrow opens with them. Same rules as set_today.",
			inputSchema: { type: 'object', properties: { ids: ID_LIST }, required: ['ids'] },
			annotations: {},
			execute: async (input) => dayList(input, tomorrowOf(dateKeyOf(target.now())), (ids) => target.planTomorrow(ids), 'Tomorrow')
		},
		{
			name: 'pin_actions',
			title: 'Pin actions for the week',
			description: "Pins actions, or unpins them with pinned false. A pinned action leads Bindu's picks each day until it is unpinned.",
			inputSchema: { type: 'object', properties: { ids: ID_LIST, pinned: { type: 'boolean', default: true, description: 'True to pin, false to unpin' } }, required: ['ids'] },
			annotations: {},
			execute: async (input) => {
				const data = target.data();
				const pinned = input.pinned !== false;
				const ids: ActionId[] = [];
				for (const value of idsIn(input.ids)) {
					const found = actionIn(data, value);
					if ('error' in found) return `Nothing was ${pinned ? 'pinned' : 'unpinned'}. ${found.error}`;
					if (Boolean(data.meta?.[found.id]?.pinned) !== pinned && !ids.includes(found.id)) ids.push(found.id);
				}
				if (ids.length === 0) return `Every action given is already ${pinned ? 'pinned' : 'unpinned'}.`;
				target.pin(ids, pinned);
				return `${pinned ? 'Pinned' : 'Unpinned'} ${quoted(ids.map((id) => written(data, id)!))}.`;
			}
		},
		{
			name: 'move_card',
			title: 'Move an action on the board',
			description: `Moves an action between the board's lists: ${LANES.map((lane) => `"${lane}" (${LANE_NAMES[lane]})`).join(', ')}. Doing puts it on today's list; Done finishes it, as a tick does. A routine never goes to Done. It goes to the end of the list unless index says where, from 0.`,
			inputSchema: {
				type: 'object',
				properties: { id: { type: 'string', description: 'An action id from read_chart' }, lane: { type: 'string', enum: [...LANES], description: 'The list to move it to' },
					index: { type: 'integer', minimum: 0, description: 'Its place in that list, from 0. Leave out for the end.' }
				},
				required: ['id', 'lane']
			},
			annotations: {},
			execute: async (input) => {
				const data = target.data();
				const found = actionIn(data, input.id);
				if ('error' in found) return found.error;
				const lane = LANES.find((each) => each === input.lane);
				if (!lane) return `Lane must be one of ${LANES.join(', ')}.`;
				if (lane === 'done' && isRoutine(data.meta?.[found.id])) return `“${found.text}” is a routine, so it never goes to Done. Use finish_action to tick it for today.`;
				const length = boardOf(data, dateKeyOf(target.now()))[lane].length;
				const index = Number.isInteger(input.index) ? Math.min(Number(input.index), length) : length;
				if (!target.moveCard(found.id, lane, index)) return `“${found.text}” was not moved.`;
				return `Moved “${found.text}” to ${LANE_NAMES[lane]}.`;
			}
		},
		{
			name: 'log_time',
			title: 'Log time on an action',
			description: `Logs minutes spent on an action, ending now, as if a stopwatch had run. At most ${MAX_MINUTES} minutes. An optional link id from read_shelves records which video or resource on the shelf was studied.`,
			inputSchema: {
				type: 'object',
				properties: {
					id: { type: 'string', description: 'An action id from read_chart' },
					minutes: { type: 'integer', minimum: 1, maximum: MAX_MINUTES, description: 'Whole minutes spent, ending now' },
					link: { type: 'string', description: 'An optional link id from read_shelves' }
				},
				required: ['id', 'minutes']
			},
			annotations: {},
			execute: async (input) => {
				const data = target.data();
				const found = actionIn(data, input.id);
				if ('error' in found) return found.error;
				const minutes = Number(input.minutes);
				if (!Number.isInteger(minutes) || minutes < 1 || minutes > MAX_MINUTES) return `Not logged. Minutes must be a whole number from 1 to ${MAX_MINUTES}.`;
				const linkId =
					typeof input.link === 'string' && input.link.trim()
						? input.link.trim()
						: typeof input.link_id === 'string' && input.link_id.trim()
							? input.link_id.trim()
							: undefined;
				if (linkId) {
					const matched = toolInChart(data, linkId);
					if (!matched) return `“${linkId}” is not a link on this chart's shelves.`;
					const actionSlot = slotOf(data, found.id);
					if (actionSlot && actionSlot.pillarIndex !== matched.pillarIndex) {
						return `“${matched.tool.title}” is on ${pillarName(data, matched.pillarIndex)}'s shelf, not ${pillarName(data, actionSlot.pillarIndex)}.`;
					}
					target.logTime(found.id, minutes, linkId);
					return `Logged ${minutes} min on “${found.text}” (${matched.tool.title}).`;
				}
				target.logTime(found.id, minutes);
				return `Logged ${minutes} min on “${found.text}”.`;
			}
		},
		{
			name: 'start_timer',
			title: 'Start a timer on an action',
			description: `Starts a stopwatch on an action, or a focus block when minutes is given (25 is the usual block, at most ${BLOCK_MAX}). Its time is logged when it stops. One timer runs at a time: starting one logs and stops the one running. An optional link id from read_shelves ties the time to that video or resource.`,
			inputSchema: {
				type: 'object',
				properties: {
					id: { type: 'string', description: 'An action id from read_chart' },
					minutes: { type: 'integer', minimum: 1, maximum: BLOCK_MAX, description: 'Length of a focus block. Leave out for a stopwatch.' },
					link: { type: 'string', description: 'An optional link id from read_shelves' }
				},
				required: ['id']
			},
			annotations: {},
			execute: async (input) => {
				const data = target.data();
				const found = actionIn(data, input.id);
				if ('error' in found) return found.error;
				const minutes = input.minutes === undefined ? undefined : Number(input.minutes);
				if (minutes !== undefined && (!Number.isInteger(minutes) || minutes < 1 || minutes > BLOCK_MAX)) return `Not started. Minutes must be a whole number from 1 to ${BLOCK_MAX}.`;
				const linkId =
					typeof input.link === 'string' && input.link.trim()
						? input.link.trim()
						: typeof input.link_id === 'string' && input.link_id.trim()
							? input.link_id.trim()
							: undefined;
				if (linkId) {
					const matched = toolInChart(data, linkId);
					if (!matched) return `“${linkId}” is not a link on this chart's shelves.`;
					const actionSlot = slotOf(data, found.id);
					if (actionSlot && actionSlot.pillarIndex !== matched.pillarIndex) {
						return `“${matched.tool.title}” is on ${pillarName(data, matched.pillarIndex)}'s shelf, not ${pillarName(data, actionSlot.pillarIndex)}.`;
					}
				}
				const running = data.timer?.action && data.timer.action !== found.id ? written(data, data.timer.action) : null;
				target.startTimer(found.id, minutes, linkId);
				const toolTitle = linkId ? toolInChart(data, linkId)?.tool.title : null;
				const withTool = toolTitle ? ` (${toolTitle})` : '';
				return [minutes ? `Started a ${minutes}-minute block on “${found.text}”${withTool}.` : `Started a stopwatch on “${found.text}”${withTool}.`, running ? `The timer on “${running}” stopped, and its time was logged.` : '']
					.filter(Boolean)
					.join(' ');
			}
		},
		{
			name: 'stop_timer',
			title: 'Stop the running timer',
			description: 'Stops the running timer and logs its time. A stopwatch left on for hours asks the person how long it really took instead.',
			inputSchema: { type: 'object', properties: {} },
			annotations: {},
			execute: async () => {
				const timer = target.data().timer;
				if (!timer) return 'No timer is running.';
				const text = timer.action ? written(target.data(), timer.action) : null;
				const minutes = Math.floor((target.now().getTime() - timer.since) / 60_000);
				target.stopTimer();
				if (target.data().timer) return `The stopwatch on “${text}” ran for hours, so the person is being asked how long it really took.`;
				if (!text) return 'Stopped the break.';
				return minutes < 1 ? `Stopped the timer on “${text}”. It ran under a minute, so nothing was logged.` : `Stopped the timer on “${text}”, and logged its time.`;
			}
		},
		{
			name: 'add_shelf_link',
			title: "Save a link to a pillar's shelf",
			description:
				`Saves a link (a video, an article, a course) to a pillar's shelf, where Bindu hands it out with that pillar's actions. Use the page the person is on when they say "save this". ${LINK_KINDS} Leave kind out for "repeat".`,
			inputSchema: {
				type: 'object',
				properties: {
					pillar: { type: 'integer', minimum: 0, maximum: 7, description: 'The pillar, 0 to 7, as in read_chart' },
					path: {
						type: 'string',
						format: 'uri',
						pattern: '^https?://',
						maxLength: URL_MAX,
						description: 'An http or https link to save. It is stored on the shelf as text and opened only when the person taps it; nothing here fetches it.'
					},
					title: { type: 'string', maxLength: TEXT_MAX, description: 'A short name for the link, as the page titles itself' },
					kind: { type: 'string', enum: [...TOOL_KINDS], description: 'How it comes round. Leave out for repeat.' }
				},
				required: ['pillar', 'path']
			},
			annotations: {},
			execute: async (input) => {
				const data = target.data();
				const pillarIndex = Number(input.pillar);
				if (!Number.isInteger(pillarIndex) || pillarIndex < 0 || pillarIndex > 7) return 'Not saved. Pillar must be 0 to 7.';
				const url = typeof input.path === 'string' ? input.path.trim() : '';
				if (!isUrl(url) || url.length > URL_MAX) return 'Not saved. Give an http or https link.';
				const name = pillarName(data, pillarIndex);
				if ((data.tools?.[`p${pillarIndex}`] ?? []).some((tool) => tool.url === url)) return `That link is already on ${name}'s shelf.`;
				const title = typeof input.title === 'string' ? input.title.replace(/\s+/g, ' ').trim().slice(0, TEXT_MAX) : '';
				const kind = input.kind === undefined ? 'repeat' : TOOL_KINDS.find((each) => each === input.kind);
				if (!kind) return `Not saved. Kind must be one of ${TOOL_KINDS.join(', ')}.`;
				target.addLink(pillarIndex, url, title, kind);
				return `Saved to ${name}'s shelf.`;
			}
		},
		{
			name: 'update_shelf_link',
			title: 'Change a link on a shelf',
			description: `Changes how a link on a shelf comes round: its kind, whether it is known (a known link waits on the shelf and is not handed out), or which action hands it out (an action id from the same pillar, or "any" for any routine there). A staple is never known. Link ids come from read_shelves. ${LINK_KINDS}`,
			inputSchema: {
				type: 'object',
				properties: {
					id: { type: 'string', description: 'A link id from read_shelves' },
					kind: { type: 'string', enum: [...TOOL_KINDS], description: 'How it comes round' },
					known: { type: 'boolean', description: 'True once the person knows it, so it waits on the shelf; false to hand it out again' },
					action: { type: 'string', description: 'An action id from read_chart in the same pillar, or "any"' }
				},
				required: ['id']
			},
			annotations: {},
			execute: async (input) => {
				const data = target.data();
				const found = shelvedLink(data, input.id);
				if (!found) return `"${String(input.id)}" is not a link on this chart. Read the shelves for ids.`;
				const { pillarIndex, tool } = found;
				const patch: LinkPatch = {};
				if (input.kind !== undefined) {
					const kind = TOOL_KINDS.find((each) => each === input.kind);
					if (!kind) return `Not changed. Kind must be one of ${TOOL_KINDS.join(', ')}.`;
					if (kind !== tool.kind) patch.kind = kind;
				}
				const kind = patch.kind ?? tool.kind;
				if (input.known !== undefined) {
					if (typeof input.known !== 'boolean') return 'Not changed. Known must be true or false.';
					if (input.known && kind === 'staple') return `Not changed. “${tool.title}” is a staple, which stays in rotation and is never known.`;
					if (input.known !== Boolean(tool.known)) patch.known = input.known || undefined;
				}
				if (input.action !== undefined) {
					if (input.action === 'any') {
						if (keptFor(data, tool)) patch.action = undefined;
					} else {
						const action = actionIn(data, input.action);
						if ('error' in action) return `Not changed. ${action.error}`;
						if (slotOf(data, action.id)?.pillarIndex !== pillarIndex) return `Not changed. “${action.text}” is not in ${pillarName(data, pillarIndex)}, so it cannot hand out this link.`;
						if (action.id !== keptFor(data, tool)) patch.action = action.id;
					}
				}
				if (Object.keys(patch).length === 0) return `“${tool.title}” already comes round that way. Nothing changed.`;
				target.updateLink(pillarIndex, tool.id, patch);
				const after = shelfOf(target.data(), pillarIndex).find((each) => each.id === tool.id) ?? { ...tool, ...patch };
				const kept = keptFor(target.data(), after);
				const by = kept ? `handed out by “${written(target.data(), kept)}”` : 'handed out by any routine in its pillar';
				return `“${after.title}” on ${pillarName(data, pillarIndex)}'s shelf is now ${KIND_WORDS[after.kind]}, ${after.known ? 'known and waiting on the shelf' : by}.`;
			}
		}
	];
}

type ModelContext = { registerTool(tool: AgentTool, options?: { signal?: AbortSignal }): unknown };

/** Chrome's origin trial puts it on `document`; the first explainer put it on `navigator`. */
export function modelContext(scope: { document?: unknown; navigator?: unknown } = globalThis): ModelContext | null {
	for (const host of [scope.document, scope.navigator]) {
		const context = (host as { modelContext?: Partial<ModelContext> } | undefined)?.modelContext;
		if (typeof context?.registerTool === 'function') return context as ModelContext;
	}
	return null;
}

/** Aborting the signal takes every tool back. */
export function registerAgentTools(target: AgentTarget, signal: AbortSignal, context: ModelContext | null = modelContext()): boolean {
	if (!context) return false;
	for (const tool of agentTools(target)) {
		try {
			void Promise.resolve(context.registerTool(tool, { signal })).catch(() => {});
		} catch {
			// A browser on an older draft of the API refuses a shape it does not know; the app works the same without it.
		}
	}
	return true;
}
