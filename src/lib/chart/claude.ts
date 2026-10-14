import type Anthropic from '@anthropic-ai/sdk';

/** Device-only: never synced, shared, or exported. */
export const CLAUDE_KEY = 'mandala_claude_key';
export const CLAUDE_MODEL = 'claude-opus-5-5';

export function loadClaudeKey(): string {
	try {
		return (typeof localStorage === 'undefined' ? null : localStorage.getItem(CLAUDE_KEY))?.trim() ?? '';
	} catch {
		return '';
	}
}

export function saveClaudeKey(key: string): void {
	try {
		if (key.trim()) localStorage.setItem(CLAUDE_KEY, key.trim());
		else localStorage.removeItem(CLAUDE_KEY);
	} catch {
	}
}

export function looksLikeClaudeKey(value: string): boolean {
	return /^sk-ant-[\w-]{20,}$/.test(value.trim());
}

export type ClaudeReply = { ok: true; text: string } | { ok: false; reason: string } | { ok: false; aborted: true };

function apiMessage(error: InstanceType<typeof Anthropic.APIError>): string {
	const body = error.error as { error?: { message?: unknown } } | undefined;
	return typeof body?.error?.message === 'string' ? body.error.message : '';
}

/**
 * One request, from this browser straight to Anthropic on the person's own key. The SDK is imported on first
 * use, so it stays out of the page's startup.
 */
export async function askClaude(key: string, prompt: string, signal?: AbortSignal): Promise<ClaudeReply> {
	let Client: typeof Anthropic;
	try {
		({ default: Client } = await import('@anthropic-ai/sdk'));
	} catch {
		return { ok: false, reason: 'Could not reach Claude. Check your connection.' };
	}
	const client = new Client({ apiKey: key, dangerouslyAllowBrowser: true, maxRetries: 1 });
	try {
		const message = await client.beta.messages
			.stream(
				{
					model: CLAUDE_MODEL,
					max_tokens: 16000,
					output_config: { effort: 'medium' },
					betas: ['server-side-fallback-2026-07-01'],
					fallbacks: 'default',
					messages: [{ role: 'user', content: prompt }]
				},
				{ signal }
			)
			.finalMessage();
		if (message.stop_reason === 'refusal') return { ok: false, reason: 'Claude would not write this one.' };
		if (message.stop_reason === 'max_tokens') return { ok: false, reason: 'The reply ran out of room. Try again.' };
		const text = message.content.flatMap((block) => (block.type === 'text' ? [block.text] : [])).join('\n').trim();
		return text ? { ok: true, text } : { ok: false, reason: 'Claude sent back nothing. Try again.' };
	} catch (error) {
		if (error instanceof Client.APIUserAbortError) return { ok: false, aborted: true };
		if (error instanceof Client.AuthenticationError) return { ok: false, reason: 'Claude did not accept that key. Check it, or add a new one.' };
		if (error instanceof Client.PermissionDeniedError) return { ok: false, reason: 'That key is not allowed to use Claude here. Check it in the Claude Console.' };
		if (error instanceof Client.RateLimitError) return { ok: false, reason: 'Claude is busy. Try again in a minute.' };
		if (error instanceof Client.APIConnectionError) return { ok: false, reason: 'Could not reach Claude. Check your connection.' };
		if (error instanceof Client.APIError) {
			if ((error.status ?? 0) >= 500) return { ok: false, reason: 'Claude is busy. Try again in a minute.' };
			const said = apiMessage(error);
			return { ok: false, reason: said ? `Claude said: ${said}` : 'Claude could not take that request.' };
		}
		return { ok: false, reason: 'Something went wrong on the way to Claude. Try again.' };
	}
}
