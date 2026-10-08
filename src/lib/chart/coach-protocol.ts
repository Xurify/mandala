import type { ChatMessage } from './helper.ts';

export class CoachStopped extends Error {
	constructor() {
		super('Stopped.');
		this.name = 'CoachStopped';
	}
}

export type CoachRequest =
	| { type: 'load'; id: number; model: string }
	/** Answers "yes" when the weights are already on this device. */
	| { type: 'cached'; id: number; model: string }
	| {
			type: 'complete';
			id: number;
			model: string;
			messages: ChatMessage[];
			maxTokens: number;
			temperature: number;
			thinking?: boolean;
	  }
	| { type: 'interrupt' };

export type CoachResponse =
	| { type: 'progress'; text: string; ratio?: number }
	| { type: 'done'; id: number; text: string; stats?: string }
	| { type: 'error'; id: number; text: string };
