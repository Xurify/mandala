import { briefLines } from './draft.ts';
import { nearKnown, nextTool } from './tools.ts';
import { formatMinutes, minutesByPillar, passiveMinutesByPillar, ranMinutesByPillar } from './timer.ts';
import { dateKeyOf, exportText, getByKey, hasContent, idAt, isOpenFocus, isRoutine, labelOfKey, pillarOfAction, weekStartKey, type ActionId, type ActionKind, type ActionMeta, type ChartData, type Ref, type ToolKind } from './model.ts';

/** Letters and digits in any script, so a reply in Japanese or Russian still compares to its chart. */
export function norm(value: string): string {
	return value.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ').trim();
}

export type HelperPage = 'home' | 'today' | 'week' | 'progress' | 'write' | 'offer';
export type WriteMode = 'new' | 'fill' | 'review' | 'ask';

export type CellEdit = { key: string; before: string; after: string };

export type KindChange = { id: ActionId; text: string; pillarIndex: number; before: ActionKind | undefined; after: ActionKind | undefined };

/** What an agent in the browser wrote. It waits on its own page until the person keeps it. */
export type HelperOffer =
	| { kind: 'chart'; data: ChartData }
	| { kind: 'cells'; edits: CellEdit[] }
	| { kind: 'kinds'; changes: KindChange[] }
	| { kind: 'note'; weekKey: string; before: string; after: string };

export type HelperMood = 'idle' | 'listening' | 'happy' | 'puzzled' | 'offering' | 'curious';

export type HelperMoodOptions = {
	cheer?: boolean;
	listening?: boolean;
	offering?: boolean;
	waiting?: boolean;
};

export function moodFor(options: HelperMoodOptions = {}): HelperMood {
	if (options.cheer) return 'happy';
	if (options.listening) return 'listening';
	if (options.offering) return 'offering';
	if (options.waiting) return 'curious';
	return 'idle';
}

export type HelperPick = {
	id: ActionId;
	text: string;
	pillarIndex: number;
	why: string;
	tool?: { id: string; title: string; url: string; kind: ToolKind };
};

function actionKey(pillarIndex: number, actionIndex: number): string {
	return `a${pillarIndex}_${actionIndex}`;
}

function filled(value: string | undefined): boolean {
	return (value ?? '').trim() !== '';
}

export function actionGaps(data: ChartData): { pillarIndex: number; empty: number[] }[] {
	return [0, 1, 2, 3, 4, 5, 6, 7].flatMap((pillarIndex) => {
		const empty = (data.actions[pillarIndex] ?? []).flatMap((action, index) => (filled(action) ? [] : [index]));
		return filled(data.pillars[pillarIndex]) && empty.length > 0 ? [{ pillarIndex, empty }] : [];
	});
}

export function gapsOf(data: ChartData): { pillars: number[]; actions: { pillarIndex: number; empty: number[] }[]; total: number } {
	if (!filled(data.goal)) return { pillars: [], actions: [], total: 0 };
	const pillars = data.pillars.flatMap((pillar, index) => (filled(pillar) ? [] : [index]));
	const actions = actionGaps(data);
	const total = pillars.length + data.actions.flat().filter((action) => !filled(action)).length;
	return { pillars, actions, total };
}


const DAY_MS = 86_400_000;
const STUCK_PICKS = 3;
const STUCK_WINDOW = 14;
const MOMENTUM_WINDOW = 7;

function daysBetween(fromKey: string, now: Date): number {
	const [year, month, day] = fromKey.split('-').map(Number);
	const from = new Date(year!, month! - 1, day!);
	const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
	return Math.round((today.getTime() - from.getTime()) / DAY_MS);
}

/** Same number for the same day and key, so ties settle differently each day but hold still within one. */
function dayJitter(dateKey: string, key: string): number {
	let hash = 2166136261;
	for (const char of `${dateKey}:${key}`) {
		hash ^= char.charCodeAt(0);
		hash = Math.imul(hash, 16777619);
	}
	return (hash >>> 0) / 4294967296;
}

export type ActionHistory = {
	sinceTick: number | null;
	recentTicks: number;
	missedPicks: number;
	recentDrops: number;
};

export type PickHistory = {
	actions: Map<ActionId, ActionHistory>;
	pillarSinceTick: (number | null)[];
	declinedToday: Set<ActionId>;
	droppedToday: Set<ActionId>;
};

export function pickHistory(data: ChartData, now: Date = new Date()): PickHistory {
	const actions = new Map<ActionId, ActionHistory>();
	const entry = (id: ActionId) => {
		let found = actions.get(id);
		if (!found) {
			found = { sinceTick: null, recentTicks: 0, missedPicks: 0, recentDrops: 0 };
			actions.set(id, found);
		}
		return found;
	};
	const pillarSinceTick: (number | null)[] = Array.from({ length: 8 }, () => null);
	for (const [dateKey, log] of Object.entries(data.days ?? {})) {
		const ago = daysBetween(dateKey, now);
		if (ago < 0) continue;
		for (const id of log.checked) {
			const found = entry(id);
			if (found.sinceTick === null || ago < found.sinceTick) found.sinceTick = ago;
			if (ago > 0 && ago <= MOMENTUM_WINDOW) found.recentTicks += 1;
			const pillarIndex = pillarOfAction(data, id);
			if (pillarIndex !== null) {
				const seen = pillarSinceTick[pillarIndex];
				if (seen == null || ago < seen) pillarSinceTick[pillarIndex] = ago;
			}
		}
		if (ago > 0 && ago <= STUCK_WINDOW) {
			for (const id of log.focus) if (!log.checked.includes(id)) entry(id).missedPicks += 1;
		}
		if (ago <= MOMENTUM_WINDOW) for (const id of log.dropped ?? []) entry(id).recentDrops += 1;
	}
	const today = data.days?.[dateKeyOf(now)];
	return {
		actions,
		pillarSinceTick,
		declinedToday: new Set(today?.declined ?? []),
		droppedToday: new Set(today?.dropped ?? [])
	};
}

/** Picked again and again, never ticked. Better made smaller than offered again. */
export function isStuck(history: ActionHistory | undefined): boolean {
	return (history?.missedPicks ?? 0) >= STUCK_PICKS && (history?.recentTicks ?? 0) === 0;
}

export function quietestPillar(history: PickHistory, dateKey: string, among: readonly number[]): number | null {
	const gap = (index: number) => Math.min(history.pillarSinceTick[index] ?? 99, 99);
	const ranked = [...among].sort((a, b) => gap(b) - gap(a) || dayJitter(dateKey, `p${b}`) - dayJitter(dateKey, `p${a}`));
	return ranked[0] ?? null;
}

type Candidate = { id: ActionId; pillarIndex: number; text: string; pinned: boolean; milestone: boolean; history: ActionHistory | undefined };

function candidates(data: ChartData, history: PickHistory, now: Date, exclude: ReadonlySet<ActionId>): Candidate[] {
	const done = new Set(data.days?.[dateKeyOf(now)]?.checked ?? []);
	const out: Candidate[] = [];
	data.actions.forEach((row, pillarIndex) => {
		if (!filled(data.pillars[pillarIndex])) return;
		row.forEach((action, actionIndex) => {
			const id = idAt(data, pillarIndex, actionIndex);
			const meta = data.meta?.[id];
			if (!filled(action) || !isOpenFocus(meta)) return;
			if (done.has(id) || exclude.has(id) || history.declinedToday.has(id) || history.droppedToday.has(id)) return;
			const past = history.actions.get(id);
			if (isStuck(past) && !meta?.pinned) return;
			out.push({ id, pillarIndex, text: action.trim(), pinned: meta?.pinned === true, milestone: meta?.kind === 'milestone', history: past });
		});
	});
	return out;
}

function scoreOf(candidate: Candidate, history: PickHistory, dateKey: string): number {
	const pillarGap = history.pillarSinceTick[candidate.pillarIndex];
	const actionGap = candidate.history?.sinceTick ?? null;
	let score = Math.min(pillarGap ?? 14, 14) * 2 + Math.min(actionGap ?? 21, 21);
	if (candidate.pinned) score += 100;
	if (candidate.milestone) score += 4;
	score -= (candidate.history?.missedPicks ?? 0) * 4;
	score -= (candidate.history?.recentDrops ?? 0) * 6;
	return score + dayJitter(dateKey, candidate.id) * 3;
}

function pillarName(data: ChartData, pillarIndex: number): string {
	return (data.pillars[pillarIndex] ?? '').trim();
}

function plural(count: number, one: string, many = `${one}s`): string {
	return `${count} ${count === 1 ? one : many}`;
}

type PickRole = 'pinned' | 'quiet' | 'momentum' | 'best';

function whyFor(data: ChartData, candidate: Candidate, role: PickRole, history: PickHistory): string {
	if (role === 'pinned' || candidate.pinned) return 'Pinned for this week.';
	const name = pillarName(data, candidate.pillarIndex);
	const pillarGap = history.pillarSinceTick[candidate.pillarIndex];
	if (role === 'quiet') {
		if (pillarGap === null) return `Nothing ticked in ${name} yet.`;
		return `${name} last had a tick ${pillarGap === 1 ? 'yesterday' : `${pillarGap} days ago`}.`;
	}
	const past = candidate.history;
	if (role === 'momentum' && past) return `Done ${past.recentTicks === 1 ? 'once' : plural(past.recentTicks, 'time')} this week. Keep it going.`;
	if (past?.sinceTick == null) return candidate.milestone ? 'A one-time step, not started yet.' : 'Not started yet.';
	return `Last done ${past.sinceTick === 1 ? 'yesterday' : `${past.sinceTick} days ago`}.`;
}

function toPick(data: ChartData, candidate: Candidate, role: PickRole, history: PickHistory, now: Date): HelperPick {
	const pick: HelperPick = { id: candidate.id, text: candidate.text, pillarIndex: candidate.pillarIndex, why: whyFor(data, candidate, role, history) };
	const tool = nextTool(data, candidate.id, now);
	if (tool) pick.tool = { id: tool.id, title: tool.title, url: tool.url, kind: tool.kind };
	return pick;
}

export function suggestToday(
	data: ChartData,
	now: Date = new Date(),
	count = 3,
	exclude: ReadonlySet<ActionId> = new Set()
): HelperPick[] {
	const history = pickHistory(data, now);
	const dateKey = dateKeyOf(now);
	const pool = candidates(data, history, now, exclude)
		.map((candidate) => ({ candidate, score: scoreOf(candidate, history, dateKey) }))
		.sort((a, b) => b.score - a.score);
	const picks: HelperPick[] = [];
	const used = new Set<ActionId>();
	const usedPillars = new Set<number>();
	const take = (candidate: Candidate | undefined, role: PickRole) => {
		if (!candidate || picks.length >= count || used.has(candidate.id)) return;
		picks.push(toPick(data, candidate, role, history, now));
		used.add(candidate.id);
		usedPillars.add(candidate.pillarIndex);
	};
	const fresh = (candidate: Candidate) => !used.has(candidate.id) && !usedPillars.has(candidate.pillarIndex);

	for (const { candidate } of pool) if (candidate.pinned && fresh(candidate)) take(candidate, 'pinned');
	const open = new Set(pool.filter(({ candidate }) => fresh(candidate)).map(({ candidate }) => candidate.pillarIndex));
	const quiet = quietestPillar(history, dateKey, [...open]);
	take(pool.find(({ candidate }) => candidate.pillarIndex === quiet && fresh(candidate))?.candidate, 'quiet');
	take(pool.find(({ candidate }) => fresh(candidate) && (candidate.history?.recentTicks ?? 0) > 0)?.candidate, 'momentum');
	for (const { candidate } of pool) if (fresh(candidate)) take(candidate, 'best');
	for (const { candidate } of pool) take(candidate, 'best');
	return picks;
}

export function suggestWeek(
	data: ChartData,
	count = 6,
	now: Date = new Date(),
	exclude: ReadonlySet<ActionId> = new Set()
): HelperPick[] {
	const history = pickHistory(data, now);
	const dateKey = dateKeyOf(now);
	const pool = candidates(data, history, now, exclude)
		.map((candidate) => ({ candidate, score: scoreOf(candidate, history, dateKey) }))
		.sort((a, b) => b.score - a.score);
	const picks: HelperPick[] = [];
	const used = new Set<ActionId>();
	for (let round = 0; picks.length < count; round++) {
		const usedPillars = new Set<number>();
		let added = false;
		for (const { candidate } of pool) {
			if (picks.length >= count) break;
			if (used.has(candidate.id) || usedPillars.has(candidate.pillarIndex)) continue;
			if (picks.filter((pick) => pick.pillarIndex === candidate.pillarIndex).length > round) continue;
			picks.push(toPick(data, candidate, candidate.pinned ? 'pinned' : 'best', history, now));
			used.add(candidate.id);
			usedPillars.add(candidate.pillarIndex);
			added = true;
		}
		if (!added) break;
	}
	return picks;
}
export function greetingInsight(data: ChartData, now: Date = new Date()): HelperInsight | null {
	const top = unseenInsights(data, now)[0];
	return top && top.weight >= 30 ? top : null;
}
export function fillEdits(current: ChartData, reply: ChartData): CellEdit[] {
	const edits: CellEdit[] = [];
	current.pillars.forEach((pillar, pillarIndex) => {
		const after = (reply.pillars[pillarIndex] ?? '').trim();
		if (!pillar.trim() && after) edits.push({ key: `p${pillarIndex}`, before: '', after });
	});
	current.actions.forEach((row, pillarIndex) =>
		row.forEach((action, actionIndex) => {
			const after = (reply.actions[pillarIndex]?.[actionIndex] ?? '').trim();
			if (!action.trim() && after) edits.push({ key: `a${pillarIndex}_${actionIndex}`, before: '', after });
		})
	);
	return edits;
}
export function reviseEdits(current: ChartData, reply: ChartData): CellEdit[] {
	const edits: CellEdit[] = [];
	const differs = (before: string, after: string) => after !== '' && norm(before) !== norm(after);
	current.pillars.forEach((pillar, pillarIndex) => {
		const after = (reply.pillars[pillarIndex] ?? '').trim();
		if (differs(pillar.trim(), after)) edits.push({ key: `p${pillarIndex}`, before: pillar.trim(), after });
	});
	current.actions.forEach((row, pillarIndex) =>
		row.forEach((action, actionIndex) => {
			const after = (reply.actions[pillarIndex]?.[actionIndex] ?? '').trim();
			if (differs(action.trim(), after)) edits.push({ key: `a${pillarIndex}_${actionIndex}`, before: action.trim(), after });
		})
	);
	return edits;
}

export function askPrompt(data: ChartData, question = ''): string {
	const asked = question.replace(/\s+/g, ' ').trim().slice(0, 600);
	return [
		'I use a Mandala chart: one goal in the center, eight pillars around it (the drivers of the goal), and eight actions under each pillar that I can schedule and tick.',
		data.goal.trim() ? `Here is my chart:\n\n${exportText(data)}` : 'I have not set a goal yet.',
		...briefLines(data.brief),
		'',
		asked ? `My question: ${asked}` : 'Read it, then wait for my question.',
		'',
		'Answer in a few plain sentences. Keep to what I can do, and say it the way the chart says things.'
	].join('\n');
}

export function groupEdits(data: ChartData, edits: readonly CellEdit[]): { key: string; label: string; pillarIndex: number | null; edits: CellEdit[] }[] {
	const groups: { key: string; label: string; pillarIndex: number | null; edits: CellEdit[] }[] = [];
	for (const edit of edits) {
		const isPillar = edit.key.startsWith('p');
		const pillarIndex = isPillar ? null : Number(edit.key.slice(1).split('_')[0]);
		const key = isPillar ? 'pillars' : `a${pillarIndex}`;
		let group = groups.find((entry) => entry.key === key);
		if (!group) {
			const label = isPillar ? 'Pillars' : (data.pillars[pillarIndex!] ?? '').trim() || `Pillar ${pillarIndex! + 1}`;
			group = { key, label, pillarIndex, edits: [] };
			groups.push(group);
		}
		group.edits.push(edit);
	}
	return groups;
}

export function draftButton(current: ChartData): string {
	return hasContent(current) ? 'Open as a new chart' : 'Start this chart';
}

export function editWords(data: ChartData, edits: readonly CellEdit[]): { button: string; done: string } {
	const count = edits.length;
	const pillarCount = edits.filter((edit) => edit.key.startsWith('p')).length;
	const pillars = pillarCount === count;
	const counted = [pillarCount ? plural(pillarCount, 'pillar') : '', count - pillarCount ? plural(count - pillarCount, 'action') : '']
		.filter(Boolean)
		.join(' and ');
	const rewrites = edits.filter((edit) => edit.before.trim()).length;
	if (rewrites > 0 && rewrites < count) return { button: `Keep ${count} lines`, done: `Added ${plural(count - rewrites, 'line')} and rewrote ${rewrites}.` };
	if (rewrites > 0) return { button: count === 1 ? 'Keep the rewrite' : `Keep ${count} rewrites`, done: `Rewrote ${counted}.` };
	const groups = groupEdits(data, edits);
	const where = !pillars && groups.length === 1 ? ` to ${groups[0]!.label}` : '';
	return { button: 'Add to chart', done: `Added ${counted}${where}.` };
}

export function describeKey(data: ChartData, key: string): string {
	if (key.startsWith('p')) return `Pillar ${Number(key.slice(1)) + 1}`;
	return labelOfKey(data, key);
}

export function textOfKey(data: ChartData, ref: Ref): string {
	return getByKey(data, ref).trim();
}
function currentStreak(data: ChartData, now: Date): number {
	let streak = 0;
	const date = new Date(now);
	const active = (key: string) => (data.days?.[key]?.checked.length ?? 0) > 0;
	if (!active(dateKeyOf(date))) date.setDate(date.getDate() - 1);
	while (active(dateKeyOf(date))) {
		streak += 1;
		date.setDate(date.getDate() - 1);
	}
	return streak;
}

function listNames(names: readonly string[]): string {
	if (names.length <= 1) return names[0] ?? '';
	return `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`;
}

function quietPillars(data: ChartData, history: PickHistory, days = 7): number[] {
	return data.pillars.flatMap((name, index) => {
		if (!filled(name) || !(data.actions[index] ?? []).some(filled)) return [];
		const gap = history.pillarSinceTick[index];
		return gap === null || gap >= days ? [index] : [];
	});
}

export type HelperInsight = {
	id: 'today' | 'yesterday' | 'comeback' | 'streak' | 'stuck' | 'dropped' | 'quiet' | 'rhythm' | 'time' | 'background' | 'words' | 'follow' | 'retire' | 'tool';
	text: string;
	/** Higher shows first. Above 30 is worth a greeting. */
	weight: number;
	key?: string;
	ref?: string;
};

export function insightSignature(insight: HelperInsight): string {
	return `${insight.id}:${insight.key ?? insight.ref ?? ''}`;
}

const DAY_BOUND = new Set<HelperInsight['id']>(['today', 'yesterday', 'comeback']);
const SHOWN_WINDOW = 3;

export function unseenInsights(data: ChartData, now: Date = new Date()): HelperInsight[] {
	const shown = new Map<string, number>();
	for (const [dateKey, log] of Object.entries(data.days ?? {})) {
		const ago = daysBetween(dateKey, now);
		if (ago < 0 || ago >= SHOWN_WINDOW) continue;
		for (const signature of log.shown ?? []) shown.set(signature, Math.min(ago, shown.get(signature) ?? ago));
	}
	return insightsFor(data, now).filter((insight) => {
		const ago = shown.get(insightSignature(insight));
		if (ago === undefined) return true;
		return DAY_BOUND.has(insight.id) ? ago > 0 : false;
	});
}

function quote(text: string): string {
	return `\u201c${text}\u201d`;
}

export function insightsFor(data: ChartData, now: Date = new Date()): HelperInsight[] {
	if (!filled(data.goal) || !data.days) return [];
	const insights: HelperInsight[] = [];
	const history = pickHistory(data, now);
	const today = data.days[dateKeyOf(now)];
	const yesterdayDate = new Date(now);
	yesterdayDate.setDate(now.getDate() - 1);
	const yesterday = data.days[dateKeyOf(yesterdayDate)];
	const everTicked = Object.values(data.days).some((log) => log.checked.length > 0);
	if (!everTicked) return [];

	if (today && today.focus.length > 0) {
		const done = today.focus.filter((key) => today.checked.includes(key)).length;
		if (done === today.focus.length) insights.push({ id: 'today', text: done === 1 ? "Today's pick is done." : `All ${done} of today's picks are done.`, weight: 50 });
		else if (done > 0) insights.push({ id: 'today', text: `${done} of ${today.focus.length} done today.`, weight: 20 });
	}

	if (yesterday && yesterday.focus.length > 0) {
		const done = yesterday.focus.filter((key) => yesterday.checked.includes(key)).length;
		insights.push({
			id: 'yesterday',
			text: done === yesterday.focus.length ? 'Yesterday you finished everything you picked.' : `Yesterday you finished ${done} of ${yesterday.focus.length}.`,
			weight: done === yesterday.focus.length ? 28 : 18
		});
	}

	if (today && today.checked.length > 0) {
		let gap = 0;
		const date = new Date(now);
		for (let step = 1; step <= 60; step++) {
			date.setDate(date.getDate() - 1);
			if ((data.days[dateKeyOf(date)]?.checked.length ?? 0) > 0) break;
			gap = step;
		}
		if (gap >= 4 && gap < 60) insights.push({ id: 'comeback', text: `First tick in ${gap + 1} days. Good to see you.`, weight: 45 });
	}

	const streak = currentStreak(data, now);
	if (streak >= 3) insights.push({ id: 'streak', text: `${streak} days in a row.`, weight: 15 + Math.min(streak, 15) });

	for (const [action, past] of history.actions) {
		const text = textOfKey(data, action);
		if (!text) continue;
		if (isStuck(past)) {
			insights.push({ id: 'stuck', key: action, text: `You picked ${quote(text)} ${plural(past.missedPicks, 'time')} and haven't ticked it. A smaller version might go.`, weight: 40 + past.missedPicks });
		} else if (past.recentDrops >= 2) {
			insights.push({ id: 'dropped', key: action, text: `${quote(text)} came off the list ${past.recentDrops === 2 ? 'twice' : `${past.recentDrops} times`} this week.`, weight: 32 });
		}
	}

	const quiet = quietPillars(data, history);
	if (quiet.length > 0 && quiet.length < 8) {
		const longest = quietestPillar(history, dateKeyOf(now), quiet)!;
		const gap = history.pillarSinceTick[longest];
		const name = pillarName(data, longest);
		insights.push({
			id: 'quiet',
			ref: `p${longest}`,
			text: gap === null ? `Nothing ticked in ${name} yet.` : `${name} hasn't had a tick in ${gap} days.`,
			weight: 30
		});
	}

	const times: number[] = [];
	for (const [dateKey, log] of Object.entries(data.days)) {
		const ago = daysBetween(dateKey, now);
		if (ago < 0 || ago > 14) continue;
		for (const clock of Object.values(log.at ?? {})) {
			const hour = Number(clock.split(':')[0]);
			if (Number.isFinite(hour)) times.push(hour);
		}
	}
	if (times.length >= 5) {
		const share = (test: (hour: number) => boolean) => times.filter(test).length / times.length;
		if (share((hour) => hour < 12) >= 0.7) insights.push({ id: 'rhythm', text: 'Most of your ticks land before noon.', weight: 16 });
		else if (share((hour) => hour >= 18) >= 0.7) insights.push({ id: 'rhythm', text: 'Most of your ticks happen in the evening.', weight: 16 });
		else if (share((hour) => hour >= 12 && hour < 18) >= 0.7) insights.push({ id: 'rhythm', text: 'Most of your ticks happen in the afternoon.', weight: 16 });
	}

	const minutes = minutesByPillar(data, now);
	const total = minutes.reduce((sum, value) => sum + value, 0);
	const most = minutes.indexOf(Math.max(...minutes));
	if (total >= 60 && minutes[most]! / total >= 0.5 && filled(pillarName(data, most))) {
		insights.push({ id: 'time', ref: `p${most}`, text: `Most of your time this week went to ${pillarName(data, most)}: ${formatMinutes(minutes[most]!)}.`, weight: 32 });
	}
	insights.push(...inTheBackground(data, now));

	insights.push(...ownWords(data, now), ...followThrough(data, now), ...readyToRetire(data, now), ...knownByNow(data, now));

	return insights.sort((a, b) => b.weight - a.weight);
}

/** A pillar fed mostly by sound in the background: an hour or more, three quarters of what ran. */
function inTheBackground(data: ChartData, now: Date): HelperInsight[] {
	const passive = passiveMinutesByPillar(data, now);
	const active = ranMinutesByPillar(data, 'active', now);
	const out: HelperInsight[] = [];
	for (let pillarIndex = 0; pillarIndex < 8; pillarIndex++) {
		const ran = passive[pillarIndex]! + active[pillarIndex]!;
		if (passive[pillarIndex]! < 60 || passive[pillarIndex]! / ran < 0.75 || !filled(pillarName(data, pillarIndex))) continue;
		const atScreen = active[pillarIndex]! > 0 ? `${formatMinutes(active[pillarIndex]!)} at the screen` : 'none at the screen';
		out.push({
			id: 'background',
			ref: `p${pillarIndex}`,
			text: `${pillarName(data, pillarIndex)} ran mostly in the background this week: ${formatMinutes(passive[pillarIndex]!)} with sound on, ${atScreen}. One block in front of it would count for more.`,
			weight: 30
		});
	}
	return out.slice(0, 1);
}

function ownWords(data: ChartData, now: Date): HelperInsight[] {
	const lastWeek = new Date(now);
	lastWeek.setDate(now.getDate() - 7);
	const previous = weekStartKey(lastWeek);
	const note = (data.weeks?.[previous]?.note ?? '').replace(/\s+/g, ' ').trim();
	if (!note || (data.weeks?.[weekStartKey(now)]?.note ?? '').trim()) return [];
	const said = note.length > 120 ? `${note.slice(0, 117).replace(/\s+\S*$/, '')}\u2026` : note;
	return [{ id: 'words', ref: previous, text: `Last week you wrote: ${quote(said)} Still true?`, weight: 33 }];
}

const FOLLOW_WINDOW = 28;

function followThrough(data: ChartData, now: Date): HelperInsight[] {
	const picked = Array.from({ length: 8 }, () => 0);
	const finished = Array.from({ length: 8 }, () => 0);
	for (const [dateKey, log] of Object.entries(data.days ?? {})) {
		const ago = daysBetween(dateKey, now);
		if (ago <= 0 || ago > FOLLOW_WINDOW) continue;
		for (const id of log.focus) {
			const pillarIndex = pillarOfAction(data, id);
			if (pillarIndex === null) continue;
			picked[pillarIndex]! += 1;
			if (log.checked.includes(id)) finished[pillarIndex]! += 1;
		}
	}
	const total = picked.reduce((sum, count) => sum + count, 0);
	const counted = picked.flatMap((count, index) => (count >= 4 && filled(data.pillars[index]) ? [index] : []));
	if (total < 10 || counted.length < 2) return [];
	const rate = (index: number) => finished[index]! / picked[index]!;
	const ranked = [...counted].sort((a, b) => rate(b) - rate(a));
	const best = ranked[0]!;
	const worst = ranked[ranked.length - 1]!;
	if (rate(best) - rate(worst) < 0.4) return [];
	return [
		{
			id: 'follow',
			ref: `p${worst}`,
			text: `You finish ${pillarName(data, best)} picks ${finished[best]} of ${picked[best]} times. ${pillarName(data, worst)}, ${finished[worst]} of ${picked[worst]}.`,
			weight: 22
		}
	];
}

function readyToRetire(data: ChartData, now: Date): HelperInsight[] {
	const out: HelperInsight[] = [];
	for (const [action, meta] of Object.entries(data.meta ?? {}) as [ActionId, ActionMeta][]) {
		if (!isRoutine(meta)) continue;
		const text = textOfKey(data, action);
		if (!text) continue;
		let days = 0;
		for (let offset = 0; offset < 14; offset++) {
			const date = new Date(now);
			date.setDate(now.getDate() - offset);
			if (data.days?.[dateKeyOf(date)]?.checked.includes(action)) days += 1;
		}
		if (days >= 10) {
			out.push({ id: 'retire', key: action, text: `${quote(text)} is ticked on ${days} of the last 14 days. It may be a habit now, and the cell could hold something new.`, weight: 24 });
		}
	}
	return out;
}

export function weekStrip(data: ChartData, now: Date = new Date()): { key: string; label: string; today: boolean; ticks: number[] }[] {
	const letters = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
	return Array.from({ length: 7 }, (_, index) => {
		const date = new Date(now);
		date.setDate(now.getDate() - (6 - index));
		const key = dateKeyOf(date);
		const ticks = (data.days?.[key]?.checked ?? [])
			.flatMap((id) => {
				const pillarIndex = pillarOfAction(data, id);
				return pillarIndex === null ? [] : [pillarIndex];
			})
			.sort((a, b) => a - b);
		return { key, label: letters[date.getDay()]!, today: index === 6, ticks };
	});
}

export type HelperProgress = {
	ticks: number;
	pillars: number[];
	streak: number;
	milestones: number;
	written: number;
	everTicked: boolean;
	quiet: number[];
	/** Counted minutes per pillar this week, passive ones at the chart's weight. */
	minutes: number[];
	/** Passive minutes per pillar this week, as they ran. */
	passive: number[];
	insights: HelperInsight[];
};

export function progressOf(data: ChartData, now: Date = new Date()): HelperProgress {
	const history = pickHistory(data, now);
	const strip = weekStrip(data, now);
	return {
		ticks: strip.reduce((sum, day) => sum + day.ticks.length, 0),
		pillars: [...new Set(strip.flatMap((day) => day.ticks))].sort((a, b) => a - b),
		streak: currentStreak(data, now),
		milestones: Object.values(data.meta ?? {}).filter((meta) => meta.kind === 'milestone' && meta.done).length,
		written: data.actions.flat().filter(filled).length,
		everTicked: Object.values(data.days ?? {}).some((log) => log.checked.length > 0),
		quiet: quietPillars(data, history),
		minutes: minutesByPillar(data, now),
		passive: passiveMinutesByPillar(data, now),
		insights: insightsFor(data, now).filter((insight) => !['streak', 'quiet', 'time'].includes(insight.id)).slice(0, 3)
	};
}

export function noteFor(
	data: ChartData,
	now: Date = new Date(),
	insight: HelperInsight | null = greetingInsight(data, now)
): { text: string; insight: HelperInsight | null } {
	if (!filled(data.goal)) return { text: 'Every chart starts with one goal. I can turn yours into a prompt that writes the rest.', insight: null };
	if (insight) return { text: insight.text, insight };
	const gaps = gapsOf(data);
	if (gaps.pillars.length > 0) {
		const count = gaps.pillars.length;
		return { text: `\u201c${data.goal.trim()}\u201d still needs ${count === 1 ? 'one more pillar' : `${count} pillars`}.`, insight: null };
	}
	if (gaps.actions.length === 1) {
		const row = gaps.actions[0]!;
		const count = row.empty.length;
		return { text: `${pillarName(data, row.pillarIndex)} still has ${plural(count, 'empty action')}.`, insight: null };
	}
	if (gaps.actions.length > 1) return { text: `${plural(gaps.total, 'action')} are still empty, across ${gaps.actions.length} pillars.`, insight: null };
	const today = data.days?.[dateKeyOf(now)];
	if (today && today.focus.length > 0) {
		const done = today.focus.filter((key) => today.checked.includes(key)).length;
		if (done < today.focus.length) return { text: `${done} of ${today.focus.length} done today. One at a time.`, insight: null };
	}
	return { text: 'The chart is full. Three for today is a good next step.', insight: null };
}

export type HelperDoor = { page: Exclude<HelperPage, 'offer'>; mode?: WriteMode; label: string; detail: string };

export function nextMove(data: ChartData, now: Date = new Date()): HelperDoor {
	if (!filled(data.goal)) return { page: 'write', mode: 'new', label: 'Start a chart', detail: '' };
	if (gapsOf(data).total > 0) return { page: 'write', mode: 'fill', label: 'Fill the gaps', detail: '' };
	const today = data.days?.[dateKeyOf(now)];
	if (!today?.focus.length && suggestToday(data, now).length > 0) return { page: 'today', label: "Pick today's three", detail: '' };
	return { page: 'progress', label: 'See how it is going', detail: '' };
}

export function doorsFor(data: ChartData, now: Date = new Date()): HelperDoor[] {
	if (!filled(data.goal)) return [];
	const lead = nextMove(data, now);
	const hasActions = data.actions.some((row) => row.some(filled));
	const doors: HelperDoor[] = [];
	if (hasActions) {
		const today = data.days?.[dateKeyOf(now)];
		const picks = suggestToday(data, now);
		const names = [...new Set(picks.map((pick) => pillarName(data, pick.pillarIndex)))];
		const done = today ? today.focus.filter((key) => today.checked.includes(key)).length : 0;
		doors.push({
			page: 'today',
			label: "Pick today's three",
			detail: today?.focus.length ? `${done} of ${today.focus.length} done today` : names.length ? `From ${listNames(names)}` : 'Nothing open to pick'
		});
		const week = suggestWeek(data, 6, now);
		doors.push({ page: 'week', label: 'Plan this week', detail: week.length ? `${plural(week.length, 'action')}, one per pillar` : 'Nothing open to plan' });
		const progress = progressOf(data, now);
		doors.push({
			page: 'progress',
			label: 'How it is going',
			detail: progress.everTicked ? `${plural(progress.ticks, 'tick')} in 7 days` : 'Nothing ticked yet'
		});
	}
	if (hasActions) doors.push({ page: 'write', mode: 'review', label: 'Review my chart', detail: "Rewrite the lines you can't tick off" });
	doors.push({ page: 'write', label: 'Fill chart using a prompt', detail: 'Start a chart, fill it, or ask' });
	return doors.filter((door) => door.page === 'write' || door.page !== lead.page);
}

function knownByNow(data: ChartData, now: Date): HelperInsight[] {
	return nearKnown(data, now).slice(0, 1).map(({ pillarIndex, tool, days }) => ({
		id: 'tool',
		ref: tool.id,
		text: `You have opened ${quote(tool.title)} on ${days} of the last 14 days. Know it by now? ${pillarName(data, pillarIndex)}'s shelf has a button for that.`,
		weight: 26
	}));
}

export type WeekReview = {
	closed: { id: ActionId; text: string; pillarIndex: number }[];
	quiet: { pillarIndex: number; lead: { id: ActionId; text: string }; rest: { id: ActionId; text: string }[] }[];
	moved: number[];
	ticks: number;
};

export function weekInReview(data: ChartData, now: Date = new Date(), since: string = weekStartKey(now)): WeekReview {
	const today = dateKeyOf(now);
	const closed: WeekReview['closed'] = [];
	const quiet: WeekReview['quiet'] = [];
	const progress = progressOf(data, now);
	for (let pillarIndex = 0; pillarIndex < 8; pillarIndex++) {
		const actions: { id: ActionId; text: string }[] = [];
		for (let actionIndex = 0; actionIndex < 8; actionIndex++) {
			const id = idAt(data, pillarIndex, actionIndex);
			const text = (data.actions[pillarIndex]?.[actionIndex] ?? '').trim();
			if (!text) continue;
			actions.push({ id, text });
			const meta = data.meta?.[id];
			if (meta?.kind === 'milestone' && meta.done && meta.doneAt && meta.doneAt >= since && meta.doneAt <= today) {
				closed.push({ id, text, pillarIndex });
			}
		}
		if (!progress.quiet.includes(pillarIndex) || actions.length === 0) continue;
		const lead = actions.find((action) => !data.meta?.[action.id]?.done) ?? actions[0]!;
		quiet.push({ pillarIndex, lead, rest: actions.filter((action) => action.id !== lead.id) });
	}
	return { closed, quiet, moved: progress.pillars, ticks: progress.ticks };
}
