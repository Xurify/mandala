import { UNTITLED } from './library.ts';

/** Title when one burst covers charts that do not share a name. */
const MANY = 'Charts';

export type SlipBurst = {
	key: string;
	subject: string;
	count: number;
	mixed: boolean;
};

/** Spoken sentence. Mixed bursts say how many charts, since one name would be wrong. */
export function burstToast(kicker: string, subject: string, count: number, mixed = false): string {
	if (mixed) return `${kicker} ${count} ${count === 1 ? 'chart' : 'charts'}.`;
	const name = subject.trim() || UNTITLED;
	if (count > 1) return `${kicker} “${name}” ×${count}.`;
	return `${kicker} “${name}”.`;
}

/**
 * Continue a burst only while the same action is still on screen.
 * `amount` is how many this gesture did. A different action starts over.
 * Names that diverge drop the single title.
 */
export function nextSlipBurst(
	previous: SlipBurst | null,
	key: string,
	subject: string,
	amount = 1,
	mixedBatch = false
): SlipBurst {
	const name = subject.trim() || UNTITLED;
	const add = Math.max(1, amount);
	const same = previous !== null && previous.key === key && previous.count > 0;
	if (!same) {
		return { key, subject: mixedBatch ? MANY : name, count: add, mixed: mixedBatch };
	}
	const mixed = previous.mixed || mixedBatch || previous.subject !== name;
	return {
		key,
		subject: mixed ? MANY : name,
		count: previous.count + add,
		mixed
	};
}

/** One shared title, or a mixed batch. */
export function batchSubject(titles: readonly string[]): { subject: string; mixed: boolean } {
	const names = titles.map((title) => title.trim() || UNTITLED);
	const subject = names[0] ?? UNTITLED;
	const mixed = names.some((name) => name !== subject);
	return { subject, mixed };
}
