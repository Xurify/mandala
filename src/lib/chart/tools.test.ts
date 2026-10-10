import { describe, expect, it } from 'vitest';
import { dateKeyOf, emptyChart, parseChart, type ChartData, type Tool } from './model.ts';
import { dealTools, hostOf, linkIn, nearKnown, newTool, nextTool, opened, openedLately, thumbnailOf, toolsFor, videoId } from './tools.ts';

const now = new Date(2026, 9, 10, 12);
const day = (offset: number) => dateKeyOf(new Date(2026, 9, 10 + offset, 12));

function chart(): ChartData {
	const data = emptyChart();
	data.goal = 'Hold a conversation in Slovak';
	data.pillars[1] = 'Listening';
	data.actions[1] = ['Watch one vlog at breakfast', 'Shadow a clip after lunch', '', '', '', '', '', ''];
	data.meta = { a1_0: { kind: 'routine' } };
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
	it('hands unassigned tools to routines, and named ones to their action', () => {
		const data = chart();
		data.tools = { p1: [tool('a'), tool('b', { action: 1 }), tool('c', { action: 0 })] };
		expect(toolsFor(data, 'a1_0').map((entry) => entry.id)).toEqual(['a', 'c']);
		expect(toolsFor(data, 'a1_1').map((entry) => entry.id)).toEqual(['b']);
		expect(toolsFor(data, 'a2_0')).toEqual([]);
	});

	it('rotates: never opened first, then the one that waited longest, holding still within a day', () => {
		const data = chart();
		data.tools = {
			p1: [tool('a', { opened: [day(-1)] }), tool('b', { opened: [day(-5)] }), tool('c'), tool('d', { known: true })]
		};
		expect(nextTool(data, 'a1_0', now)?.id).toBe('c');
		expect(nextTool(data, 'a1_0', now)?.id).toBe('c');
		expect(nextTool(data, 'a1_0', now, new Set(['c']))?.id).toBe('b');
		data.tools.p1 = data.tools.p1!.map((entry) => (entry.id === 'c' ? opened(entry, now) : entry));
		// Opened today, c steps aside for the rest; once they are all opened today it comes round again.
		expect(nextTool(data, 'a1_0', now)?.id).toBe('b');
		data.tools.p1 = data.tools.p1!.map((entry) => (entry.known ? entry : opened(entry, now)));
		expect(nextTool(data, 'a1_0', now)).not.toBeNull();
	});

	it('deals different tools to two routines, and passes over one without moving the other', () => {
		const data = chart();
		data.meta = { a1_0: { kind: 'routine' }, a1_1: { kind: 'routine' } };
		data.tools = { p1: [tool('a'), tool('b'), tool('c')] };
		const dealt = dealTools(data, ['a1_0', 'a1_1'], now);
		expect(dealt.get('a1_0')?.id).not.toBe(dealt.get('a1_1')?.id);
		const first = dealt.get('a1_0')!.id;
		const passed = new Map([['a1_1', new Set([dealt.get('a1_1')!.id])]]);
		const again = dealTools(data, ['a1_0', 'a1_1'], now, passed);
		expect(again.get('a1_0')?.id).toBe(first);
		expect(again.get('a1_1')?.id).not.toBe(dealt.get('a1_1')?.id);
		expect(again.get('a1_1')?.id).not.toBe(first);
		// Passing over everything starts the shelf round again instead of leaving the row empty.
		const all = new Map([['a1_1', new Set(['a', 'b', 'c'])]]);
		expect(dealTools(data, ['a1_0', 'a1_1'], now, all).get('a1_1')).not.toBeNull();
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
		data.tools = { p1: [tool('a', { action: 1, opened: [day(-1)] })], p9: [tool('x')] };
		const loaded = parseChart(JSON.stringify({ ...data, tools: { ...data.tools, p2: [{ id: 'bad', url: 'not a link' }, 'junk'] } }));
		expect(loaded?.tools).toEqual({ p1: [tool('a', { action: 1, opened: [day(-1)] })] });
	});
});
