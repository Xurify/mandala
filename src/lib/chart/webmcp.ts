import { finishedOn } from './board.ts';
import { ACTION_MAX, chartFromDraft, GOAL_MAX, PILLAR_MAX } from './draft.ts';
import { gapsOf, lineFault, progressOf, reviewChart, suggestToday, type CellEdit, type HelperOffer } from './helper.ts';
import { dateKeyOf, getByKey, getDayLog, isActionId, isRoutine, slotOf, type ActionId, type ChartData } from './model.ts';

/**
 * Tools an agent in the browser can call, through WebMCP (`document.modelContext`). The agent reads, proposes lines that
 * wait in Bindu for the person to keep, and does the small daily things a tap does. Nothing here shares, syncs, exports or
 * deletes: an agent that read a hostile page elsewhere has no way to send the person's days out through this one.
 */

export type AgentTarget = {
	data(): ChartData;
	now(): Date;
	offer(offer: HelperOffer): void;
	finish(id: ActionId): void;
	reopen(id: ActionId): void;
	setToday(ids: ActionId[]): void;
	logTime(id: ActionId, minutes: number): void;
};

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

const CHART_WORDS =
	'A Mandala chart has one goal in the center, eight pillars around it (the drivers of the goal), and eight actions under each pillar that the person schedules and ticks.';
const TESTS =
	'Every action must pass two tests. Calendar: it can be scheduled and marked done ("Study geography for 20 minutes a day", not "Do better in geography"). Control: it is a behaviour the person can do ("Post two videos a day", not "Get 10 million views"). A pillar is a short heading for one driver, a few words.';
const CELLS = 'Cells: "p0" to "p7" are the pillars; "a{pillar}_{slot}" is an action, both 0 to 7, so "a2_5" is the sixth action of the third pillar.';

const READ: AgentToolAnnotations = { readOnlyHint: true, untrustedContentHint: true };

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

function isDone(data: ChartData, id: ActionId, dateKey: string): boolean {
	const meta = data.meta?.[id];
	return isRoutine(meta) ? finishedOn(data, id, dateKey) : meta?.done === true;
}

export function chartForAgent(data: ChartData, now: Date): unknown {
	const dateKey = dateKeyOf(now);
	const log = getDayLog(data, dateKey);
	return {
		goal: data.goal.trim(),
		brief: data.brief,
		pillars: data.pillars.map((name, pillarIndex) => ({
			cell: `p${pillarIndex}`,
			name: name.trim(),
			actions: (data.actions[pillarIndex] ?? []).map((text, slot) => {
				const id = data.actionIds[pillarIndex]![slot]!;
				const meta = data.meta?.[id];
				return {
					cell: `a${pillarIndex}_${slot}`,
					id,
					text: text.trim(),
					...(meta?.kind ? { kind: meta.kind } : {}),
					...(text.trim() && isDone(data, id, dateKey) ? { done: true } : {}),
					...(meta?.pinned ? { pinned: true } : {})
				};
			})
		})),
		today: { date: dateKey, picked: log.focus.filter((id) => written(data, id)), ticked: log.checked.filter((id) => written(data, id)) }
	};
}

/** Lines become edits only where they change something. The goal stays the person's to write. */
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
		const max = cell.startsWith('p') ? PILLAR_MAX : ACTION_MAX;
		if (!after) {
			refused.push({ cell, reason: 'Empty. Clearing a line is done by hand.' });
			continue;
		}
		if (after.length > max) {
			refused.push({ cell, reason: `Too long: ${after.length} characters, at most ${max}.` });
			continue;
		}
		const before = getByKey(data, cell).trim();
		if (before === after) edits.delete(cell);
		else edits.set(cell, { key: cell, before, after });
	}
	return { edits: [...edits.values()], refused };
}

/** Bindu's rules read English, so these are notes for the agent to weigh, not refusals. */
function notesOn(data: ChartData, edits: readonly CellEdit[]): { cell: string; text: string; note: string }[] {
	return edits.flatMap((edit) => {
		const pillar = edit.key.startsWith('p');
		const pillarIndex = Number(edit.key.slice(1).split('_')[0]);
		const fault = lineFault(edit.after, { max: pillar ? PILLAR_MAX : ACTION_MAX, kind: pillar ? 'pillar' : 'action', pillar: pillar ? undefined : data.pillars[pillarIndex] });
		return fault ? [{ cell: edit.key, text: edit.after, note: fault.reason }] : [];
	});
}

export function agentTools(target: AgentTarget): AgentTool[] {
	return [
		{
			name: 'read_chart',
			title: 'Read the chart',
			description: `${CHART_WORDS} Returns the open chart: goal, the person's brief, each pillar with its eight actions (cell, id, text, and whether it is a routine, a milestone, done or pinned), and today's picks and ticks by action id. An empty text is a gap. ${CELLS}`,
			inputSchema: { type: 'object', properties: {} },
			annotations: READ,
			execute: async () => json(chartForAgent(target.data(), target.now()))
		},
		{
			name: 'review_chart',
			title: 'Find weak lines',
			description: `Runs Bindu's rules over the chart and returns the lines that fail, each with why, plus the empty cells. The rules read English; for another language, judge the lines yourself. ${TESTS}`,
			inputSchema: { type: 'object', properties: {} },
			annotations: READ,
			execute: async () => {
				const data = target.data();
				const gaps = gapsOf(data);
				return json({
					weak: reviewChart(data, 64).map((finding) => ({ cell: finding.key, text: finding.text, why: finding.reason })),
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
						pillar: target.data().pillars[pick.pillarIndex]?.trim(),
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
				const name = (index: number) => data.pillars[index]?.trim() || `Pillar ${index + 1}`;
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
			name: 'propose_lines',
			title: 'Propose lines for the chart',
			description: `Shows pillars or actions to the person in Bindu, the chart's helper, with what each replaces. Nothing is written until they press Keep, so tell them to look. Use it to fill gaps or rewrite weak lines. Send only the lines you mean to change; a new call replaces a proposal still waiting. ${TESTS} Pillars at most ${PILLAR_MAX} characters, actions at most ${ACTION_MAX}. Write in the chart's own language. The goal is not a cell here. ${CELLS}`,
			inputSchema: {
				type: 'object',
				properties: {
					lines: {
						type: 'array',
						minItems: 1,
						maxItems: 72,
						items: {
							type: 'object',
							properties: {
								cell: { type: 'string', pattern: CELL.source, description: 'p0 to p7 for a pillar, a0_0 to a7_7 for an action' },
								text: { type: 'string', description: 'The new line' }
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
				target.offer({ kind: 'cells', edits });
				return json({
					shown: true,
					message: `Shown in Bindu: ${edits.length} ${edits.length === 1 ? 'line' : 'lines'}. Nothing is written until the person presses Keep.`,
					refused,
					notes: notesOn(data, edits)
				});
			}
		},
		{
			name: 'propose_chart',
			title: 'Propose a whole chart',
			description: `Shows a complete chart to the person in Bindu. Keeping it opens it as a new chart beside the one they have, or fills this one if it is empty. Nothing is written until they press Keep. Ask the person about their goal, their time on a normal day, any date, and where they stand before writing. ${TESTS} Goal at most ${GOAL_MAX} characters. Exactly 8 pillars and 8 actions for each, none empty.`,
			inputSchema: {
				type: 'object',
				properties: {
					goal: { type: 'string', maxLength: GOAL_MAX },
					pillars: { type: 'array', minItems: 8, maxItems: 8, items: { type: 'string', maxLength: PILLAR_MAX } },
					actions: {
						type: 'array',
						minItems: 8,
						maxItems: 8,
						description: 'Eight actions for each pillar, in pillar order',
						items: { type: 'array', minItems: 8, maxItems: 8, items: { type: 'string', maxLength: ACTION_MAX } }
					},
					brief: {
						type: 'object',
						description: 'What the person told you, a few words each. Leave out what they did not say.',
						properties: { timeline: { type: 'string' }, situation: { type: 'string' }, focus: { type: 'string' }, constraint: { type: 'string' } }
					}
				},
				required: ['goal', 'pillars', 'actions']
			},
			annotations: {},
			execute: async (input) => {
				const chart = chartFromDraft(input);
				if (!chart) return 'Not shown: a chart needs a goal, exactly 8 pillars, and 8 written actions under each.';
				target.offer({ kind: 'chart', data: chart });
				return 'Shown in Bindu. Nothing is written until the person keeps it.';
			}
		},
		{
			name: 'finish_action',
			title: 'Mark an action done',
			description: 'Marks an action done today, as a tick on the chart does: a routine is ticked for today, anything else is finished. The person sees a note that it happened.',
			inputSchema: { type: 'object', properties: { id: { type: 'string', description: 'An action id from read_chart' } }, required: ['id'] },
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
			inputSchema: { type: 'object', properties: { id: { type: 'string', description: 'An action id from read_chart' } }, required: ['id'] },
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
			description: "Puts these actions on today's list, in this order, replacing what was there. Three from different pillars is the method's usual day. Ticks already made today stay.",
			inputSchema: {
				type: 'object',
				properties: { ids: { type: 'array', minItems: 1, maxItems: 8, items: { type: 'string' }, description: 'Action ids from read_chart or suggest_today' } },
				required: ['ids']
			},
			annotations: {},
			execute: async (input) => {
				const data = target.data();
				const ids: ActionId[] = [];
				for (const value of idsIn(input.ids)) {
					const found = actionIn(data, value);
					if ('error' in found) return `Today was not changed. ${found.error}`;
					if (!ids.includes(found.id)) ids.push(found.id);
				}
				if (ids.length === 0 || ids.length > 8) return 'Today was not changed. Give 1 to 8 action ids.';
				target.setToday(ids);
				return `Today has ${ids.length} ${ids.length === 1 ? 'action' : 'actions'}.`;
			}
		},
		{
			name: 'log_time',
			title: 'Log time on an action',
			description: `Logs minutes spent on an action, ending now, as if a stopwatch had run. At most ${MAX_MINUTES} minutes.`,
			inputSchema: {
				type: 'object',
				properties: { id: { type: 'string', description: 'An action id from read_chart' }, minutes: { type: 'integer', minimum: 1, maximum: MAX_MINUTES } },
				required: ['id', 'minutes']
			},
			annotations: {},
			execute: async (input) => {
				const found = actionIn(target.data(), input.id);
				if ('error' in found) return found.error;
				const minutes = Number(input.minutes);
				if (!Number.isInteger(minutes) || minutes < 1 || minutes > MAX_MINUTES) return `Not logged. Minutes must be a whole number from 1 to ${MAX_MINUTES}.`;
				target.logTime(found.id, minutes);
				return `Logged ${minutes} min on “${found.text}”.`;
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
