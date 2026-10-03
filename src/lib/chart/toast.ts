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

export const SLIP_MS = 5000;
export const SLIP_UNDO_MS = 8000;
export const SLIP_CAP = 1;

export type Slip = {
	id: number;
	key: string;
	kicker: string;
	subject: string;
	count: number;
	mixed: boolean;
	until: number;
	/** Deleted chart ids the slip can put back. */
	undo: string[];
};

/**
 * One slip at a time. A repeat of the showing action merges into it and restarts its clock.
 * A different action replaces it.
 */
export function placeSlip(
	pile: readonly Slip[],
	now: number,
	nextId: number,
	input: {
		key: string;
		kicker: string;
		subject: string;
		amount?: number;
		mixedBatch?: boolean;
		keep?: boolean;
		undo?: string[];
	}
): { pile: Slip[]; nextId: number } {
	const amount = input.amount ?? 1;
	const mixedBatch = input.mixedBatch ?? false;
	const undo = input.undo ?? [];
	const life = undo.length > 0 ? SLIP_UNDO_MS : SLIP_MS;
	if (input.keep) {
		const slip = freshSlip(nextId, now, input.key, input.kicker, input.subject, amount, mixedBatch, undo);
		slip.until = Number.POSITIVE_INFINITY;
		return { pile: [slip], nextId: nextId + 1 };
	}
	const live = pile.filter((slip) => slip.until > now && slip.until < Number.POSITIVE_INFINITY);
	const existing = live.find((slip) => slip.key === input.key);
	if (existing) {
		const burst = nextSlipBurst(
			{
				key: existing.key,
				subject: existing.subject,
				count: existing.count,
				mixed: existing.mixed
			},
			input.key,
			input.subject,
			amount,
			mixedBatch
		);
		const updated: Slip = {
			...existing,
			subject: burst.subject,
			count: burst.count,
			mixed: burst.mixed,
			undo: [...existing.undo, ...undo],
			until: now + (existing.undo.length > 0 || undo.length > 0 ? SLIP_UNDO_MS : SLIP_MS)
		};
		const rest = live.filter((slip) => slip.id !== existing.id);
		return { pile: [...rest, updated].slice(-SLIP_CAP), nextId };
	}
	const created = freshSlip(nextId, now, input.key, input.kicker, input.subject, amount, mixedBatch, undo);
	created.until = now + life;
	return { pile: [...live, created].slice(-SLIP_CAP), nextId: nextId + 1 };
}

function freshSlip(
	id: number,
	now: number,
	key: string,
	kicker: string,
	subject: string,
	amount: number,
	mixedBatch: boolean,
	undo: string[]
): Slip {
	const burst = nextSlipBurst(null, key, subject, amount, mixedBatch);
	return {
		id,
		key,
		kicker,
		subject: burst.subject,
		count: burst.count,
		mixed: burst.mixed,
		until: now + SLIP_MS,
		undo: [...undo]
	};
}

/** One shared title, or a mixed batch. */
export function batchSubject(titles: readonly string[]): { subject: string; mixed: boolean } {
	const names = titles.map((title) => title.trim() || UNTITLED);
	const subject = names[0] ?? UNTITLED;
	const mixed = names.some((name) => name !== subject);
	return { subject, mixed };
}
