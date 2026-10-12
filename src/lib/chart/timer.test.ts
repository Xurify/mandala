import { describe, expect, it } from 'vitest';
import { dateKeyOf, emptyChart, parseChart, type ChartData } from './model.ts';
import {
	addSession,
	clockFace,
	formatMinutes,
	isForgotten,
	isOver,
	minutesByPillar,
	minutesOn,
	minutesRun,
	remainingMs,
	ringShare,
	sessionEndingAt,
	sessionOf,
	sessionsOn
} from './timer.ts';

const MINUTE = 60_000;
const start = new Date(2026, 9, 12, 9, 30).getTime();
const today = dateKeyOf(new Date(start));

function chart(): ChartData {
	const data = emptyChart();
	data.goal = 'Play a set at the open mic';
	data.pillars[0] = 'Technique';
	data.pillars[3] = 'Songs';
	data.actions[0]![0] = 'Scales for 15 minutes before work';
	data.actions[3]![2] = 'Run the set once, start to end';
	return data;
}

describe('the stopwatch', () => {
	it('counts whole minutes and has no end', () => {
		const timer = { key: 'a0_0', since: start };
		expect(minutesRun(timer, start + 12 * MINUTE + 40_000)).toBe(12);
		expect(minutesRun(timer, start + 59_000)).toBe(0);
		expect(remainingMs(timer, start + 5 * MINUTE)).toBeNull();
		expect(isOver(timer, start + 600 * MINUTE)).toBe(false);
	});

	it('logs on the day it started, from its start time', () => {
		const logged = sessionOf({ key: 'a0_0', since: start }, start + 20 * MINUTE);
		expect(logged).toEqual({ dateKey: today, session: { key: 'a0_0', at: '09:30', minutes: 20 } });
	});

	it('logs nothing for under a minute, or for a break', () => {
		expect(sessionOf({ key: 'a0_0', since: start }, start + 20_000)).toBeNull();
		expect(sessionOf({ key: 'a0_0', since: start }, start + 59_999)).toBeNull();
		expect(sessionOf({ since: start, length: 5 }, start + 5 * MINUTE)).toBeNull();
	});

	it('takes a stopwatch left on for hours as forgotten', () => {
		expect(isForgotten({ key: 'a0_0', since: start }, start + 181 * MINUTE)).toBe(true);
		expect(isForgotten({ key: 'a0_0', since: start }, start + 90 * MINUTE)).toBe(false);
		expect(isForgotten({ key: 'a0_0', since: start, length: 25 }, start + 600 * MINUTE)).toBe(false);
	});

	it('goes round the ring once an hour', () => {
		expect(ringShare({ key: 'a0_0', since: start }, start + 15 * MINUTE)).toBeCloseTo(0.25);
		expect(ringShare({ key: 'a0_0', since: start }, start + 75 * MINUTE)).toBeCloseTo(0.25);
	});
});

describe('a block', () => {
	it('empties over its length and ends', () => {
		const timer = { key: 'a3_2', since: start, length: 25 };
		expect(remainingMs(timer, start + 20 * MINUTE)).toBe(5 * MINUTE);
		expect(ringShare(timer, start + 20 * MINUTE)).toBeCloseTo(0.2);
		expect(isOver(timer, start + 25 * MINUTE)).toBe(true);
	});

	it('counts no further than its length when it is stopped late', () => {
		expect(minutesRun({ key: 'a3_2', since: start, length: 25 }, start + 90 * MINUTE)).toBe(25);
		expect(minutesRun({ key: 'a3_2', since: start, length: 25 }, start + 10 * MINUTE)).toBe(10);
	});
});

describe('the log', () => {
	it('keeps sessions per day, read in time order', () => {
		const data = chart();
		addSession(data, today, { key: 'a3_2', at: '18:00', minutes: 25 });
		addSession(data, today, { key: 'a0_0', at: '07:10', minutes: 15 });
		addSession(data, today, { key: 'a0_0', at: '12:30', minutes: 10 });
		expect(sessionsOn(data, today).map((session) => session.at)).toEqual(['07:10', '12:30', '18:00']);
		expect(minutesOn(data, today)).toBe(50);
		expect(minutesOn(data, today, 'a0_0')).toBe(25);
		expect(data.days?.[today]?.checked).toEqual([]);
	});

	it('adds time spent before it was logged, ending now', () => {
		const now = new Date(2026, 9, 12, 19, 0);
		expect(sessionEndingAt('a3_2', 45, now)).toEqual({ dateKey: today, session: { key: 'a3_2', at: '18:15', minutes: 45 } });
		const justAfterMidnight = new Date(2026, 9, 13, 0, 20);
		expect(sessionEndingAt('a3_2', 60, justAfterMidnight).session.at).toBe('00:00');
	});

	it('sums the last seven days per pillar', () => {
		const data = chart();
		const now = new Date(2026, 9, 12, 20);
		const back = (days: number) => dateKeyOf(new Date(2026, 9, 12 - days, 12));
		addSession(data, back(0), { key: 'a0_0', at: '07:00', minutes: 15 });
		addSession(data, back(6), { key: 'a3_2', at: '18:00', minutes: 40 });
		addSession(data, back(7), { key: 'a3_2', at: '18:00', minutes: 90 });
		const minutes = minutesByPillar(data, now);
		expect(minutes[0]).toBe(15);
		expect(minutes[3]).toBe(40);
		expect(minutes.reduce((sum, value) => sum + value, 0)).toBe(55);
	});

	it('travels through a save and keeps a running timer', () => {
		const data = chart();
		addSession(data, today, { key: 'a0_0', at: '07:10', minutes: 15 });
		data.timer = { key: 'a3_2', since: start, length: 25 };
		const again = parseChart(JSON.stringify(data))!;
		expect(again.days?.[today]?.sessions).toEqual([{ key: 'a0_0', at: '07:10', minutes: 15 }]);
		expect(again.timer).toEqual({ key: 'a3_2', since: start, length: 25 });
	});

	it('drops a timer it cannot read', () => {
		const read = (timer: unknown) => parseChart(JSON.stringify({ ...chart(), timer }))!.timer;
		expect(read({ key: 'goal', since: 'soon' })).toBeUndefined();
		expect(read({ since: start })).toBeUndefined();
		expect(read({ since: start, length: 5 })).toEqual({ since: start, length: 5 });
	});
});

describe('words', () => {
	it('says minutes and hours plainly', () => {
		expect(formatMinutes(45)).toBe('45 min');
		expect(formatMinutes(60)).toBe('1 h');
		expect(formatMinutes(80)).toBe('1 h 20 min');
	});

	it('reads like a clock', () => {
		expect(clockFace(4 * MINUTE + 5_000)).toBe('4:05');
		expect(clockFace(62 * MINUTE + 5_000)).toBe('1:02:05');
	});
});
