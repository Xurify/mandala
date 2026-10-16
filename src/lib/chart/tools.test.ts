import { describe, expect, it } from 'vitest';
import { A, slotted } from './fixtures.ts';
import { ICON_MAX, dateKeyOf, emptyChart, parseChart, type ChartData, type Tool } from './model.ts';
import { dealOrder, dealTools, hostOf, sameLink, iconOf, linkIn, svgIn, nearKnown, newTool, nextTool, opened, openedLately, thumbnailOf, toolDetail, toolsFor, upNext, videoId } from './tools.ts';

const now = new Date(2026, 9, 10, 12);
const day = (offset: number) => dateKeyOf(new Date(2026, 9, 10 + offset, 12));

function chart(): ChartData {
	const data = slotted(emptyChart());
	data.goal = 'Hold a conversation in Slovak';
	data.pillars[1] = 'Listening';
	data.actions[1] = ['Watch one vlog at breakfast', 'Shadow a clip after lunch', '', '', '', '', '', ''];
	data.meta = { [A.a1_0]: { kind: 'routine' } };
	return data;
}

function tool(id: string, extra: Partial<Tool> = {}): Tool {
	return { id, url: `https://youtu.be/${id}00000000000`.slice(0, 28), title: id, kind: 'repeat', ...extra };
}

describe('links', () => {
	it('reads a YouTube id from every way YouTube writes a link', () => {
		for (const url of [
			'https://youtu.be/SZaaZpKLTFE',
			'https://www.youtube.com/watch?v=SZaaZpKLTFE',
			'https://www.youtube.com/watch?feature=share&v=SZaaZpKLTFE&t=12',
			'https://www.youtube.com/shorts/SZaaZpKLTFE?feature=share',
			'https://youtube.com/embed/SZaaZpKLTFE'
		]) {
			expect(videoId(url)).toBe('SZaaZpKLTFE');
		}
		expect(videoId('https://comprehensiblerussian.com/#/home')).toBeNull();
		expect(thumbnailOf('https://youtu.be/SZaaZpKLTFE')).toBe('https://i.ytimg.com/vi/SZaaZpKLTFE/mqdefault.jpg');
		expect(thumbnailOf('https://readline.app/r/moya-devushka')).toBeNull();
	});

	it('names the site, and finds the link in a shared sentence', () => {
		expect(hostOf('https://www.lingq.com/en/learn/ru/web/reader/23800803')).toBe('lingq.com');
		expect(linkIn('Watch this! https://youtu.be/7VXq-j5Ni1g.')).toBe('https://youtu.be/7VXq-j5Ni1g');
		expect(linkIn('no link here')).toBeNull();
		expect(newTool('https://readline.app/r/moya-devushka').title).toBe('readline.app');
	});
});

describe('the shelf', () => {
	it('keeps a staple for good: opening never puts it away, and Bindu never asks if it is known', () => {
		const data = chart();
		const days = Array.from({ length: 14 }, (_, index) => day(-index));
		data.tools = { p1: [tool('a', { kind: 'staple', opened: days }), tool('b', { opened: days })] };
		expect(opened(data.tools.p1![0]!, now).known).toBeUndefined();
		expect(nearKnown(data, now).map((entry) => entry.tool.id)).toEqual(['b']);
		const parsed = parseChart(JSON.stringify({ ...data, tools: { p1: [{ ...tool('c', { kind: 'staple' }), known: true }] } }))?.tools?.p1?.[0];
		expect(parsed?.kind).toBe('staple');
		expect(parsed?.known).toBeUndefined();
	});

	it('hands unassigned tools to routines, and named ones to their action', () => {
		const data = chart();
		data.tools = { p1: [tool('a'), tool('b', { action: A.a1_1 }), tool('c', { action: A.a1_0 })] };
		expect(toolsFor(data, A.a1_0).map((entry) => entry.id)).toEqual(['a', 'c']);
		expect(toolsFor(data, A.a1_1).map((entry) => entry.id)).toEqual(['b']);
		expect(toolsFor(data, A.a2_0)).toEqual([]);
	});

	it('says under a tool who hands it out, how often, or that it is known', () => {
		const data = chart();
		expect(toolDetail(data, 1, tool('a'))).toBe('any routine');
		expect(toolDetail(data, 1, tool('b', { action: A.a1_1, kind: 'once' }))).toBe('for action 2 · once');
		expect(toolDetail(data, 1, tool('c', { known: true, kind: 'once' }))).toBe('known');
		expect(toolDetail(data, 2, tool('d'))).toBe('no routine yet');
		expect(toolDetail(data, 1, tool('e', { kind: 'staple' }))).toBe('any routine · staple');
	});

	it('rotates: never opened first, then the one that waited longest, holding still within a day', () => {
		const data = chart();
		data.tools = {
			p1: [tool('a', { opened: [day(-1)] }), tool('b', { opened: [day(-5)] }), tool('c'), tool('d', { known: true })]
		};
		expect(nextTool(data, A.a1_0, now)?.id).toBe('c');
		expect(nextTool(data, A.a1_0, now)?.id).toBe('c');
		expect(nextTool(data, A.a1_0, now, new Set(['c']))?.id).toBe('b');
		data.tools.p1 = data.tools.p1!.map((entry) => (entry.id === 'c' ? opened(entry, now) : entry));
		expect(nextTool(data, A.a1_0, now)?.id).toBe('b');
		data.tools.p1 = data.tools.p1!.map((entry) => (entry.known ? entry : opened(entry, now)));
		expect(nextTool(data, A.a1_0, now)).not.toBeNull();
	});

	it('deals different tools to two routines, and passes over one without moving the other', () => {
		const data = chart();
		data.meta = { [A.a1_0]: { kind: 'routine' }, [A.a1_1]: { kind: 'routine' } };
		data.tools = { p1: [tool('a'), tool('b'), tool('c')] };
		const dealt = dealTools(data, [A.a1_0, A.a1_1], now);
		expect(dealt.get(A.a1_0)?.id).not.toBe(dealt.get(A.a1_1)?.id);
		const first = dealt.get(A.a1_0)!.id;
		const passed = new Map([[A.a1_1, new Set([dealt.get(A.a1_1)!.id])]]);
		const again = dealTools(data, [A.a1_0, A.a1_1], now, passed);
		expect(again.get(A.a1_0)?.id).toBe(first);
		expect(again.get(A.a1_1)?.id).not.toBe(dealt.get(A.a1_1)?.id);
		expect(again.get(A.a1_1)?.id).not.toBe(first);
		const all = new Map([[A.a1_1, new Set(['a', 'b', 'c'])]]);
		expect(dealTools(data, [A.a1_0, A.a1_1], now, all).get(A.a1_1)).not.toBeNull();
	});

	it('deals in the order Today does: pinned routines, other routines, then the rest', () => {
		const data = chart();
		data.actions[0] = ['Say hello', '', '', '', '', '', '', ''];
		data.meta = { [A.a1_1]: { kind: 'routine', pinned: true }, [A.a1_0]: { kind: 'routine' } };
		expect(dealOrder(data)).toEqual([A.a1_1, A.a1_0, A.a0_0]);
	});

	it('shows on the shelf what each action hands out next, the same as Today', () => {
		const data = chart();
		data.meta = { [A.a1_0]: { kind: 'routine' }, [A.a1_1]: { kind: 'routine' } };
		data.tools = { p1: [tool('a', { opened: [day(-1)] }), tool('b'), tool('c', { action: A.a1_1 }), tool('d', { known: true })] };
		const dealt = dealTools(data, dealOrder(data), now);
		const next = upNext(data, 1, now);
		expect(next.get(dealt.get(A.a1_0)!.id)).toBe(0);
		expect(next.get(dealt.get(A.a1_1)!.id)).toBe(1);
		expect(next.has('d')).toBe(false);
		expect(upNext(data, 2, now).size).toBe(0);
	});

	it('retires a once tool when it is opened, and keeps a repeat one', () => {
		expect(opened(tool('a', { kind: 'once' }), now)).toMatchObject({ known: true, opened: [day(0)] });
		expect(opened(tool('b'), now).known).toBeUndefined();
		expect(opened(opened(tool('b'), now), now).opened).toEqual([day(0)]);
	});

	it('asks about a repeat tool opened most days lately', () => {
		const data = chart();
		const often = Array.from({ length: 11 }, (_, index) => day(-index));
		data.tools = { p1: [tool('a', { opened: often }), tool('b', { opened: often.slice(0, 4) }), tool('c', { kind: 'once', opened: often })] };
		expect(openedLately(data.tools.p1![0]!, now)).toBe(11);
		expect(nearKnown(data, now).map((entry) => entry.tool.id)).toEqual(['a']);
		data.tools.p1![0]!.known = true;
		expect(nearKnown(data, now)).toEqual([]);
	});

	it('survives save and load, and drops what is not a tool', () => {
		const data = chart();
		data.tools = { p1: [tool('a', { action: A.a1_1, opened: [day(-1)] })], p9: [tool('x')] };
		const loaded = parseChart(JSON.stringify({ ...data, tools: { ...data.tools, p2: [{ id: 'bad', url: 'not a link' }, 'junk'] } }));
		expect(loaded?.tools).toEqual({ p1: [tool('a', { action: A.a1_1, opened: [day(-1)] })] });
	});

	it('gives every tool on a site the icon the person set for it', () => {
		const data = chart();
		const svg = 'data:image/svg+xml,%3Csvg%2F%3E';
		data.icons = { 'readline.app': svg };
		expect(iconOf(data, 'https://www.readline.app/moya-devushka')).toBe(svg);
		expect(iconOf(data, 'https://readline.app/other')).toBe(svg);
		expect(iconOf(data, 'https://example.com')).toBeNull();
		expect(iconOf(emptyChart(), 'https://readline.app')).toBeNull();
	});

	it('keeps icons through save and load, and drops what is not a picture', () => {
		const data = chart();
		const png = 'data:image/png;base64,iVBORw0KGgo=';
		const loaded = parseChart(
			JSON.stringify({
				...data,
				icons: {
					'Readline.app': png,
					'localhost:5173': png,
					'bad host/': png,
					'script.example': 'javascript:alert(1)',
					'html.example': 'data:text/html,<p>',
					'huge.example': `data:image/png;base64,${'A'.repeat(ICON_MAX)}`,
					'number.example': 4
				}
			})
		);
		expect(loaded?.icons).toEqual({ 'readline.app': png, 'localhost:5173': png });
		expect(parseChart(JSON.stringify({ ...data, icons: { 'a.example': 'junk' } }))?.icons).toBeUndefined();
	});

	it('finds SVG markup in a paste, and does not read its namespace as a link', () => {
		const svg = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path d="M2 2h20v20H2z"/></svg>';
		expect(svgIn(svg)).toBe(svg);
		expect(svgIn(`<?xml version="1.0"?>\n<!-- logo -->\n${svg}\n`)).toBe(svg);
		expect(svgIn('<SVG\n  width="16">x</SVG>')).toBe('<SVG\n  width="16">x</SVG>');
		expect(svgIn('<svgfoo></svg>')).toBeNull();
		expect(svgIn('https://readline.app')).toBeNull();
		expect(linkIn(svg)).toBeNull();
		expect(linkIn('Watch this! https://youtu.be/6mCmru24BOI.')).toBe('https://youtu.be/6mCmru24BOI');
	});
});

describe('the same link twice', () => {
	it('knows one video however YouTube writes it, and one page whatever the www or the closing slash', () => {
		expect(sameLink('https://youtu.be/SZaaZpKLTFE', 'https://www.youtube.com/watch?v=SZaaZpKLTFE&t=12')).toBe(true);
		expect(sameLink('https://youtu.be/SZaaZpKLTFE', 'https://youtu.be/wzMrFFcC1BU')).toBe(false);
		expect(sameLink('https://www.Example.com/read/', 'https://example.com/read')).toBe(true);
		expect(sameLink('https://example.com/read?page=2', 'https://example.com/read?page=3')).toBe(false);
	});
});
