import { newId } from './id.ts';
import { dateKeyOf, idAt, isRoutine, isUrl, slotOf, type ActionId, type ChartData, type Tool, type ToolKind } from './model.ts';

/** How many of the last 14 days a repeat tool is opened before Bindu asks if it is known. */
export const KNOWN_DAYS = 10;
const KNOWN_WINDOW = 14;

const VIDEO = /(?:youtu\.be\/|youtube\.com\/(?:watch\?(?:.*&)?v=|shorts\/|embed\/|live\/))([A-Za-z0-9_-]{11})/;

export function videoId(url: string): string | null {
	return url.match(VIDEO)?.[1] ?? null;
}

export function thumbnailOf(url: string): string | null {
	const id = videoId(url);
	return id ? `https://i.ytimg.com/vi/${id}/mqdefault.jpg` : null;
}

export function hostOf(url: string): string {
	try {
		return new URL(url).hostname.replace(/^www\./, '');
	} catch {
		return '';
	}
}

export function iconOf(data: ChartData, url: string): string | null {
	return data.icons?.[hostOf(url)] ?? null;
}

export function svgIn(text: string): string | null {
	return text.match(/<svg[\s>][\s\S]*<\/svg>/i)?.[0] ?? null;
}

export function linkIn(text: string): string | null {
	if (svgIn(text)) return null;
	const match = text.match(/https?:\/\/[^\s<>"']+/);
	if (!match) return null;
	const url = match[0].replace(/[.,;:!?)]+$/, '');
	return isUrl(url) ? url : null;
}

export function newTool(url: string, title = '', kind: ToolKind = 'repeat'): Tool {
	return { id: newId('tool'), url: url.trim(), title: title.trim() || hostOf(url), kind };
}

export function shelfOf(data: ChartData, pillarIndex: number): Tool[] {
	return data.tools?.[`p${pillarIndex}`] ?? [];
}

export function keptFor(data: ChartData, tool: Tool): ActionId | undefined {
	return tool.action && slotOf(data, tool.action) ? tool.action : undefined;
}

export function toolsFor(data: ChartData, id: ActionId): Tool[] {
	const at = slotOf(data, id);
	if (!at) return [];
	const routine = isRoutine(data.meta?.[id]);
	return shelfOf(data, at.pillarIndex).filter((tool) => {
		const kept = keptFor(data, tool);
		return kept === id || (kept === undefined && routine);
	});
}

function jitter(seed: string): number {
	let hash = 2166136261;
	for (const char of seed) {
		hash ^= char.charCodeAt(0);
		hash = Math.imul(hash, 16777619);
	}
	return (hash >>> 0) / 4294967296;
}

export function nextTool(data: ChartData, id: ActionId, now: Date = new Date(), skip: ReadonlySet<string> = new Set()): Tool | null {
	const today = dateKeyOf(now);
	const open = toolsFor(data, id).filter((tool) => !tool.known && !skip.has(tool.id));
	if (open.length === 0) return null;
	const fresh = open.filter((tool) => !tool.opened?.includes(today));
	const pool = fresh.length > 0 ? fresh : open;
	const last = (tool: Tool) => tool.opened?.[tool.opened.length - 1] ?? '';
	// Ties settle by the day and the action, so two routines on one shelf do not hand out the same thing.
	return [...pool].sort((a, b) => last(a).localeCompare(last(b)) || jitter(`${today}:${id}:${a.id}`) - jitter(`${today}:${id}:${b.id}`))[0] ?? null;
}

export function dealOrder(data: ChartData): ActionId[] {
	const written: ActionId[] = [];
	for (let pillarIndex = 0; pillarIndex < 8; pillarIndex++) {
		for (let actionIndex = 0; actionIndex < 8; actionIndex++) {
			if ((data.actions[pillarIndex]?.[actionIndex] ?? '').trim()) written.push(idAt(data, pillarIndex, actionIndex));
		}
	}
	const meta = (id: ActionId) => data.meta?.[id];
	return [
		...written.filter((id) => isRoutine(meta(id)) && meta(id)?.pinned),
		...written.filter((id) => isRoutine(meta(id)) && !meta(id)?.pinned),
		...written.filter((id) => !isRoutine(meta(id)))
	];
}

export function upNext(data: ChartData, pillarIndex: number, now: Date = new Date()): Map<string, number> {
	const out = new Map<string, number>();
	for (const [id, tool] of dealTools(data, dealOrder(data), now)) {
		const at = slotOf(data, id);
		if (tool && at?.pillarIndex === pillarIndex && !out.has(tool.id)) out.set(tool.id, at.slot);
	}
	return out;
}

/**
 * Dealt in order, so two routines on one shelf never hold the same tool at once. When passing has used a
 * shelf up, it starts round again rather than showing nothing.
 */
export function dealTools(
	data: ChartData,
	ids: readonly ActionId[],
	now: Date = new Date(),
	passed: ReadonlyMap<ActionId, ReadonlySet<string>> = new Map()
): Map<ActionId, Tool | null> {
	const out = new Map<ActionId, Tool | null>();
	const taken = new Set<string>();
	for (const id of ids) {
		const own = passed.get(id) ?? new Set<string>();
		const tool =
			nextTool(data, id, now, new Set([...own, ...taken])) ?? nextTool(data, id, now, taken) ?? nextTool(data, id, now, own) ?? nextTool(data, id, now);
		out.set(id, tool);
		if (tool) taken.add(tool.id);
	}
	return out;
}

export function opened(tool: Tool, now: Date = new Date()): Tool {
	const today = dateKeyOf(now);
	const days = tool.opened?.includes(today) ? tool.opened : [...(tool.opened ?? []), today].slice(-60);
	const next: Tool = { ...tool, opened: days };
	if (tool.kind === 'once') next.known = true;
	return next;
}

export function openedLately(tool: Tool, now: Date = new Date()): number {
	const since = new Date(now);
	since.setDate(now.getDate() - (KNOWN_WINDOW - 1));
	const floor = dateKeyOf(since);
	return (tool.opened ?? []).filter((day) => day >= floor && day <= dateKeyOf(now)).length;
}

export function nearKnown(data: ChartData, now: Date = new Date()): { pillarIndex: number; tool: Tool; days: number }[] {
	const out: { pillarIndex: number; tool: Tool; days: number }[] = [];
	for (let pillarIndex = 0; pillarIndex < 8; pillarIndex++) {
		for (const tool of shelfOf(data, pillarIndex)) {
			if (tool.kind !== 'repeat' || tool.known) continue;
			const days = openedLately(tool, now);
			if (days >= KNOWN_DAYS) out.push({ pillarIndex, tool, days });
		}
	}
	return out.sort((a, b) => b.days - a.days);
}

/** The title a link carries, from YouTube's oEmbed (which allows the browser to ask), then noembed. Null when neither answers. */
export async function fetchTitle(url: string): Promise<string | null> {
	const ask = async (endpoint: string): Promise<string | null> => {
		try {
			const response = await fetch(endpoint, { signal: AbortSignal.timeout(6000) });
			if (!response.ok) return null;
			const body = (await response.json()) as { title?: unknown };
			return typeof body.title === 'string' && body.title.trim() ? body.title.trim() : null;
		} catch {
			return null;
		}
	};
	const encoded = encodeURIComponent(url);
	if (videoId(url)) {
		const title = await ask(`https://www.youtube.com/oembed?url=${encoded}&format=json`);
		if (title) return title;
	}
	return ask(`https://noembed.com/embed?url=${encoded}`);
}
