import { describe, expect, it } from 'vitest';
import { chartFromDraft, chatLink, fillPrompt, newChartPrompt, parseDraftText, reviewPrompt } from './draft.ts';
import { emptyChart } from './model.ts';

const sample = {
	goal: 'Run a half marathon in under 2 hours by October',
	pillars: [
		'Training plan',
		'Speed',
		'Endurance',
		'Recovery',
		'Nutrition',
		'Gear',
		'Mindset',
		'Schedule'
	],
	actions: Array.from({ length: 8 }, (_, pillar) =>
		Array.from({ length: 8 }, (_, action) => `Do pillar ${pillar} step ${action}`)
	)
};

describe('chartFromDraft', () => {
	it('builds a full chart from a complete draft', () => {
		const chart = chartFromDraft(sample);
		expect(chart?.goal).toBe(sample.goal);
		expect(chart?.pillars).toHaveLength(8);
		expect(chart?.actions[3]).toHaveLength(8);
	});

	it('rejects a short action row', () => {
		const broken = {
			...sample,
			actions: sample.actions.map((row, index) => (index === 2 ? row.slice(0, 7) : row))
		};
		expect(chartFromDraft(broken)).toBeNull();
	});

	it('keeps empty lines empty, and reads a long line in full', () => {
		const long = 'Lerne jeden Morgen zehn neue Vokabeln mit Karteikarten';
		const partial = { ...sample, pillars: sample.pillars.map((pillar, index) => (index === 7 ? '' : pillar)), actions: sample.actions.map((row) => row.map((action, index) => (index === 0 ? long : index === 7 ? '' : action))) };
		const chart = chartFromDraft(partial);
		expect(chart?.pillars[7]).toBe('');
		expect(chart?.actions[0]![7]).toBe('');
		expect(chart?.actions[0]![0]).toBe(long);
		expect(chartFromDraft({ ...sample, pillars: Array(8).fill('') })).toBeNull();
	});
});

describe('parseDraftText', () => {
	it('reads JSON wrapped in a fence', () => {
		const chart = parseDraftText('```json\n' + JSON.stringify(sample) + '\n```');
		expect(chart?.pillars[0]).toBe('Training plan');
	});
});

describe('newChartPrompt', () => {
	it('asks the chat app to interview first, and keeps the method and the JSON shape', () => {
		const prompt = newChartPrompt();
		expect(prompt).toContain('Ask for it first');
		expect(prompt).toContain('up to three short questions');
		expect(prompt).toContain('own pillar');
		expect(prompt).toContain('work hard');
		expect(prompt).toContain("[Don't]");
		expect(prompt).toContain('10 million views');
		expect(prompt).toContain('"pillars"');
		expect(prompt).toContain('"brief"');
	});

	it('carries the goal when there is one', () => {
		const prompt = newChartPrompt('  Learn   Slovak ');
		expect(prompt).toContain('My goal: Learn Slovak');
		expect(prompt).not.toContain('Ask for it first');
	});

	it('writes at once in a single request, with no questions and no brief', () => {
		const prompt = newChartPrompt('Learn Slovak', { oneShot: true });
		expect(prompt).toContain('My goal: Learn Slovak');
		expect(prompt).toContain('Do not ask me anything');
		expect(prompt).not.toContain('up to three short questions');
		expect(prompt).not.toContain('"brief"');
		expect(prompt).toContain('"pillars"');
	});
});

describe('fillPrompt', () => {
	it('carries the chart so far and what the person said before', () => {
		const data = emptyChart();
		data.goal = 'Run a half marathon';
		data.pillars[0] = 'Easy runs';
		data.brief = { timeline: 'By October', constraint: 'A bad knee' };
		const prompt = fillPrompt(data);
		expect(prompt).toContain('word for word');
		expect(prompt).toContain('"goal":"Run a half marathon"');
		expect(prompt).toContain('- Timeline: By October');
		expect(prompt).toContain('- To work around: A bad knee');
		expect(prompt).not.toContain('"brief"');
	});
});

describe('the brief in a reply', () => {
	it('keeps what the person said, and drops what is not text', () => {
		const chart = parseDraftText(JSON.stringify({ ...sample, brief: { timeline: 'By October', focus: 3 } }));
		expect(chart?.brief).toEqual({ timeline: 'By October' });
		expect(parseDraftText(JSON.stringify(sample))?.brief).toBeUndefined();
	});
});

describe('chatLink', () => {
	it('opens a chat app with the prompt in its box', () => {
		const prompt = 'Help me & "plan"';
		expect(chatLink('claude', prompt)).toBe(`https://claude.ai/new?q=${encodeURIComponent(prompt)}`);
		expect(chatLink('chatgpt', prompt)).toBe(`https://chatgpt.com/?q=${encodeURIComponent(prompt)}`);
		expect(chatLink('claude', newChartPrompt('Speak Slovak')).length).toBeLessThan(8000);
		expect(chatLink('grok', 'hi')).toBe('https://grok.com/?q=hi');
	});
});

describe('reviewPrompt', () => {
	it('carries the chart and asks for the same shape back, in its own language', () => {
		const data = emptyChart();
		data.goal = 'Hovoriť po slovensky';
		data.pillars[0] = 'Počúvanie';
		data.actions[0]![0] = 'Pozerať jedno video denne';
		const prompt = reviewPrompt(data);
		expect(prompt).toContain('"Pozerať jedno video denne"');
		expect(prompt).toContain('in the language it is written in');
		expect(prompt).toContain('{"goal":"...","pillars":["..."],"actions":[["..."],["..."]]}');
		expect(prompt).not.toContain('coach');
	});
});
