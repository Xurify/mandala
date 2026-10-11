import { dateKeyOf, isRoutine, isUrl, type ChartData, type Tool, type ToolKind } from './model.ts';

/** How many of the last 14 days a repeat tool is opened before Bindu asks if it is known. */
export const KNOWN_DAYS = 10;
const KNOWN_WINDOW = 14;

const VIDEO = /(?:youtu\.be\/|youtube\.com\/(?:watch\?(?:.*&)?v=|shorts\/|embed\/|live\/))([A-Za-z0-9_-]{11})/;

export function videoId(url: string): string | null {
	return url.match(VIDEO)?.[1] ?? null;
}

/** No API needed: YouTube serves thumbnails by id. */
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

/** The first link in some text, so a pasted share ("Watch this! https://…") still lands. */
export function linkIn(text: string): string | null {
	// Pasted SVG carries its namespace, http://www.w3.org/2000/svg, which is not a link.
	if (svgIn(text)) return null;
	const match = text.match(/https?:\/\/[^\s<>"']+/);
	if (!match) return null;
	const url = match[0].replace(/[.,;:!?)]+$/, '');
	return isUrl(url) ? url : null;
}

export function newTool(url: string, title = '', kind: ToolKind = 'repeat'): Tool {
	return { id: Math.random().toString(36).slice(2, 10), url: url.trim(), title: title.trim() || hostOf(url), kind };
}

export function shelfOf(data: ChartData, pillarIndex: number): Tool[] {
	return data.tools?.[`p${pillarIndex}`] ?? [];
}

export function toolCount(data: ChartData): number {
	return Object.values(data.tools ?? {}).reduce((sum, list) => sum + list.length, 0);
}

function parts(key: string): { pillarIndex: number; actionIndex: number } | null {
	const match = key.match(/^a([0-7])_([0-7])$/);
	return match ? { pillarIndex: Number(match[1]), actionIndex: Number(match[2]) } : null;
}

export function toolsFor(data: ChartData, key: string): Tool[] {
	const at = parts(key);
	if (!at) return [];
	const routine = isRoutine(data.meta?.[key]);
	return shelfOf(data, at.pillarIndex).filter((tool) => tool.action === at.actionIndex || (tool.action === undefined && routine));
}

function jitter(seed: string): number {
	let hash = 2166136261;
	for (const char of seed) {
		hash ^= char.charCodeAt(0);
		hash = Math.imul(hash, 16777619);
	}
	return (hash >>> 0) / 4294967296;
}

export function nextTool(data: ChartData, key: string, now: Date = new Date(), skip: ReadonlySet<string> = new Set()): Tool | null {
	const today = dateKeyOf(now);
	const open = toolsFor(data, key).filter((tool) => !tool.known && !skip.has(tool.id));
	if (open.length === 0) return null;
	const fresh = open.filter((tool) => !tool.opened?.includes(today));
	const pool = fresh.length > 0 ? fresh : open;
	const last = (tool: Tool) => tool.opened?.[tool.opened.length - 1] ?? '';
	// Ties settle by the day and the action, so two routines on one shelf do not hand out the same thing.
	return [...pool].sort((a, b) => last(a).localeCompare(last(b)) || jitter(`${today}:${key}:${a.id}`) - jitter(`${today}:${key}:${b.id}`))[0] ?? null;
}

/**
 * Dealt in order, so two routines on one shelf never hold the same tool at once. When passing has used a
 * shelf up, it starts round again rather than showing nothing.
 */
export function dealTools(
	data: ChartData,
	keys: readonly string[],
	now: Date = new Date(),
	passed: ReadonlyMap<string, ReadonlySet<string>> = new Map()
): Map<string, Tool | null> {
	const out = new Map<string, Tool | null>();
	const taken = new Set<string>();
	for (const key of keys) {
		const own = passed.get(key) ?? new Set<string>();
		const tool =
			nextTool(data, key, now, new Set([...own, ...taken])) ?? nextTool(data, key, now, taken) ?? nextTool(data, key, now, own) ?? nextTool(data, key, now);
		out.set(key, tool);
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
