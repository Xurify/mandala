import { describe, expect, it } from 'vitest';
import { A, slotted } from './fixtures.ts';
import { actionForPillar, INGEST_REQUEST, INGEST_RESULT, ingest, ingestWords, isHello, isIngestRequest, minutesCoveredByPerson, ready, type IngestRequest } from './ingest.ts';
import { emptyChart, type ChartData } from './model.ts';
import { minutesOn, sessionsOn } from './timer.ts';

const now = new Date(2026, 9, 14, 21, 0);
const morning = new Date(2026, 9, 14, 9, 30).getTime();
const MINUTE = 60_000;
const S1 = 'session_01k7cdefghjkmnpqrstvwxyz01';
const S2 = 'session_01k7cdefghjkmnpqrstvwxyz02';
const S3 = 'session_01k7cdefghjkmnpqrstvwxyz03';

function chart(): ChartData {
	const data = slotted(emptyChart());
	data.goal = 'Read a novel in Slovak';
	data.pillars[0] = 'Listening';
	data.pillars[2] = 'Grammar';
	data.actions[0]![0] = 'Finish a podcast episode';
	data.actions[0]![1] = 'Podcast at breakfast';
	data.actions[2]![0] = 'One lesson of the course';
	data.meta = { [A.a0_0]: { kind: 'milestone' }, [A.a0_1]: { kind: 'routine' } };
	data.tools = { p2: [{ id: 'tool_01k7cdefghjkmnpqrstvwxyz00', url: 'https://example.com/course', title: 'The course', kind: 'staple' }] };
	return data;
}

function request(sessions: IngestRequest['sessions']): IngestRequest {
	return { type: INGEST_REQUEST, version: 1, requestId: 'req-1', sessions };
}

describe('time from a page', () => {
	it('lands on the routine of a pillar, as links are handed out', () => {
		const data = chart();
		expect(actionForPillar(data, 0)).toBe(A.a0_1);
		expect(actionForPillar(data, 2)).toBe(A.a2_0);
		expect(actionForPillar(data, 5)).toBeNull();
	});

	it('logs each session once, on the day it started, and answers with what happened', () => {
		const data = chart();
		const first = ingest(data, request([{ id: S1, pillar: 0, minutes: 25, startedAt: morning }]), now);
		expect(first.changed).toBe(true);
		expect(first.result).toEqual({ type: INGEST_RESULT, version: 1, requestId: 'req-1', logged: [S1], known: [], trimmed: [], skipped: [] });
		expect(sessionsOn(data, '2026-10-14')).toEqual([{ id: S1, action: A.a0_1, at: '09:30', minutes: 25, source: 'extension' }]);

		const again = ingest(data, request([{ id: S1, pillar: 0, minutes: 25, startedAt: morning }]), now);
		expect(again.changed).toBe(false);
		expect(again.result.known).toEqual([S1]);
		expect(sessionsOn(data, '2026-10-14')).toHaveLength(1);
	});

	it('keeps passive time apart, and counts it by the chart’s weight', () => {
		const data = chart();
		ingest(data, request([{ id: S1, action: A.a0_1, minutes: 20, startedAt: morning }, { id: S2, action: A.a0_1, minutes: 40, mode: 'passive', startedAt: morning + 30 * MINUTE }]), now);
		expect(sessionsOn(data, '2026-10-14').map((session) => session.mode)).toEqual([undefined, 'passive']);
		expect(minutesOn(data, '2026-10-14')).toBe(40);
		data.passiveWeight = 1;
		expect(minutesOn(data, '2026-10-14')).toBe(60);
		data.passiveWeight = 0;
		expect(minutesOn(data, '2026-10-14')).toBe(20);
	});

	it('ties a shelf link to its pillar’s action and marks the link opened that day', () => {
		const data = chart();
		const { result } = ingest(data, request([{ id: S1, link: 'tool_01k7cdefghjkmnpqrstvwxyz00', minutes: 15, startedAt: morning }]), now);
		expect(result.logged).toEqual([S1]);
		expect(sessionsOn(data, '2026-10-14')[0]).toMatchObject({ action: A.a2_0, link: 'tool_01k7cdefghjkmnpqrstvwxyz00' });
		expect(data.tools?.p2?.[0]?.opened).toEqual(['2026-10-14']);
	});

	it('skips what it cannot place, and says why', () => {
		const data = chart();
		const { changed, result } = ingest(
			data,
			request([
				{ id: 'nope', pillar: 0, minutes: 5, startedAt: morning },
				{ id: S1, pillar: 5, minutes: 5, startedAt: morning },
				{ id: S2, action: A.a0_0, minutes: 0, startedAt: morning },
				{ id: S3, action: A.a0_0, minutes: 5, startedAt: now.getTime() + 10 * MINUTE },
				{ id: 'session_01k7cdefghjkmnpqrstvwxyz04', link: 'tool_01k7cdefghjkmnpqrstvwxyz00', action: A.a0_0, minutes: 5, startedAt: morning }
			]),
			now
		);
		expect(changed).toBe(false);
		expect(result.skipped.map((skip) => skip.id)).toEqual(['nope', S1, S2, S3, 'session_01k7cdefghjkmnpqrstvwxyz04']);
		expect(result.skipped[1]?.reason).toBe('the pillar has no actions written');
		expect(result.skipped[4]?.reason).toContain('another pillar');
	});

	it('leaves the person\u2019s own timer as the record where the two overlap', () => {
		const data = chart();
		// A 30-minute block by hand, 09:40 to 10:10, and a stopwatch running since 11:00.
		data.days = { '2026-10-14': { focus: [], checked: [], sessions: [{ action: A.a0_1, at: '09:40', minutes: 30 }] } };
		data.timer = { action: A.a0_1, since: new Date(2026, 9, 14, 11, 0).getTime() };
		expect(minutesCoveredByPerson(data, '2026-10-14', morning, 25, now)).toBe(15);
		const { result } = ingest(
			data,
			request([
				{ id: S1, action: A.a0_1, minutes: 25, startedAt: morning },
				{ id: S2, action: A.a0_1, minutes: 20, startedAt: morning + 15 * MINUTE },
				{ id: S3, action: A.a0_1, minutes: 30, startedAt: new Date(2026, 9, 14, 11, 10).getTime() }
			]),
			now
		);
		expect(result.logged).toEqual([S1]);
		expect(result.trimmed).toEqual([{ id: S1, minutes: 10 }]);
		expect(result.skipped.map((skip) => skip.id)).toEqual([S2, S3]);
		expect(sessionsOn(data, '2026-10-14').map((session) => session.minutes)).toEqual([10, 30]);
	});

	it('lets sessions from pages sit side by side: their ids tell them apart', () => {
		const data = chart();
		ingest(data, request([{ id: S1, action: A.a0_1, minutes: 25, startedAt: morning }]), now);
		const { result } = ingest(data, request([{ id: S2, action: A.a0_1, minutes: 25, mode: 'passive', startedAt: morning }]), now);
		expect(result.logged).toEqual([S2]);
		expect(result.trimmed).toEqual([]);
	});

	it('puts what came in into one line', () => {
		const data = chart();
		const { logged } = ingest(data, request([{ id: S1, action: A.a0_1, minutes: 20, startedAt: morning }, { id: S2, action: A.a0_1, minutes: 40, mode: 'passive', startedAt: morning }]), now);
		expect(ingestWords(data, logged)).toBe('Logged 20 min + 40 min passive on “Podcast at breakfast”.');
	});

	it('knows its own messages', () => {
		expect(isIngestRequest(request([]))).toBe(true);
		expect(isIngestRequest({ type: 'mandala:ingest' })).toBe(false);
		expect(isHello({ type: 'mandala:hello' })).toBe(true);
		expect(ready()).toEqual({ type: 'mandala:ready', version: 1 });
	});
});
