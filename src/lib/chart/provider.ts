import type Anthropic from '@anthropic-ai/sdk';

export type ProviderId = 'openrouter' | 'gemini' | 'claude' | 'openai';

/** A provider the person pays for, and the key that bills them. Device-only: never synced, shared, or exported. */
export type Connection = { provider: ProviderId; key: string; model?: string };

export type Provider = {
	id: ProviderId;
	label: string;
	icon: 'sparkles' | 'gemini' | 'claude' | 'openai';
	defaultModel: string;
	keyUrl: string;
	keyPattern: RegExp;
	/** OpenAI's chat format. Claude goes through Anthropic's own SDK instead. */
	endpoint?: string;
};

export const PROVIDERS: readonly Provider[] = [
	{
		id: 'openrouter',
		label: 'OpenRouter',
		icon: 'sparkles',
		defaultModel: 'openrouter/auto',
		keyUrl: 'https://openrouter.ai/settings/keys',
		keyPattern: /^sk-or-[\w-]{20,}$/,
		endpoint: 'https://openrouter.ai/api/v1/chat/completions'
	},
	{
		id: 'gemini',
		label: 'Gemini',
		icon: 'gemini',
		defaultModel: 'gemini-3.8-flash',
		keyUrl: 'https://aistudio.google.com/apikey',
		keyPattern: /^AIza[\w-]{30,}$/,
		endpoint: 'https://generativelanguage.googleapis.com/v1beta/openai/chat/completions'
	},
	{
		id: 'claude',
		label: 'Claude',
		icon: 'claude',
		defaultModel: 'claude-opus-5-5',
		keyUrl: 'https://console.anthropic.com/settings/keys',
		keyPattern: /^sk-ant-[\w-]{20,}$/
	},
	{
		id: 'openai',
		label: 'OpenAI',
		icon: 'openai',
		defaultModel: 'gpt-6.1-sol',
		keyUrl: 'https://platform.openai.com/api-keys',
		keyPattern: /^sk-[\w-]{20,}$/,
		endpoint: 'https://api.openai.com/v1/chat/completions'
	}
];

export const CONNECTION_KEY = 'mandala_ai_provider';
export const OPENROUTER_VERIFIER_KEY = 'mandala_openrouter_verifier';

export function providerOf(id: ProviderId): Provider {
	return PROVIDERS.find((provider) => provider.id === id)!;
}

export function isProviderId(value: unknown): value is ProviderId {
	return PROVIDERS.some((provider) => provider.id === value);
}

export function modelOf(connection: Connection): string {
	return connection.model?.trim() || providerOf(connection.provider).defaultModel;
}

export function looksLikeKey(provider: ProviderId, value: string): boolean {
	return providerOf(provider).keyPattern.test(value.trim());
}

export function readConnection(raw: string | null): Connection | null {
	if (!raw) return null;
	try {
		const value = JSON.parse(raw) as Partial<Connection>;
		if (!isProviderId(value.provider) || typeof value.key !== 'string' || !value.key.trim()) return null;
		const model = typeof value.model === 'string' && value.model.trim() ? value.model.trim() : undefined;
		return { provider: value.provider, key: value.key.trim(), ...(model ? { model } : {}) };
	} catch {
		return null;
	}
}

export function loadConnection(): Connection | null {
	try {
		return readConnection(typeof localStorage === 'undefined' ? null : localStorage.getItem(CONNECTION_KEY));
	} catch {
		return null;
	}
}

export function saveConnection(connection: Connection | null): void {
	try {
		if (connection) localStorage.setItem(CONNECTION_KEY, JSON.stringify(connection));
		else localStorage.removeItem(CONNECTION_KEY);
	} catch {
	}
}

export type ProviderReply = { ok: true; text: string } | { ok: false; reason: string } | { ok: false; aborted: true };

const BUSY = 'is busy, or this key hit its limit. Try again in a minute.';

/** One request, from this browser straight to the provider, billed to the person's own account. */
export async function sendPrompt(connection: Connection, prompt: string, signal?: AbortSignal): Promise<ProviderReply> {
	const provider = providerOf(connection.provider);
	return provider.endpoint ? sendChat(provider, connection, prompt, signal) : sendClaude(connection, prompt, signal);
}

async function sendChat(provider: Provider, connection: Connection, prompt: string, signal?: AbortSignal): Promise<ProviderReply> {
	let response: Response;
	try {
		response = await fetch(provider.endpoint!, {
			method: 'POST',
			signal,
			headers: {
				authorization: `Bearer ${connection.key}`,
				'content-type': 'application/json',
				...(provider.id === 'openrouter' ? { 'x-title': 'Mandala' } : {})
			},
			body: JSON.stringify({ model: modelOf(connection), messages: [{ role: 'user', content: prompt }] })
		});
	} catch (error) {
		if (error instanceof DOMException && error.name === 'AbortError') return { ok: false, aborted: true };
		return { ok: false, reason: `Could not reach ${provider.label}. Check your connection.` };
	}
	const body = (await response.json().catch(() => null)) as ChatBody | null;
	const said = typeof body?.error?.message === 'string' ? body.error.message : '';
	if (!response.ok || body?.error) return { ok: false, reason: refusalOf(provider.label, response.status, said) };
	const choice = body?.choices?.[0];
	if (choice?.finish_reason === 'content_filter') return { ok: false, reason: `${provider.label} would not write this one.` };
	if (choice?.finish_reason === 'length') return { ok: false, reason: 'The reply ran out of room. Try again.' };
	const text = typeof choice?.message?.content === 'string' ? choice.message.content.trim() : '';
	return text ? { ok: true, text } : { ok: false, reason: `${provider.label} sent back nothing. Try again.` };
}

type ChatBody = {
	error?: { message?: unknown };
	choices?: { finish_reason?: string; message?: { content?: unknown } }[];
};

function refusalOf(label: string, status: number, said: string): string {
	if (status === 401 || status === 403) return `${label} did not accept that key. Check it, or connect again.`;
	if (status === 402) return `${label} says this account is out of credit.`;
	if (status === 429 || status >= 500) return `${label} ${BUSY}`;
	return said ? `${label} said: ${said}` : `${label} could not take that request.`;
}

async function sendClaude(connection: Connection, prompt: string, signal?: AbortSignal): Promise<ProviderReply> {
	let Client: typeof Anthropic;
	try {
		({ default: Client } = await import('@anthropic-ai/sdk'));
	} catch {
		return { ok: false, reason: 'Could not reach Claude. Check your connection.' };
	}
	const client = new Client({ apiKey: connection.key, dangerouslyAllowBrowser: true, maxRetries: 1 });
	try {
		const message = await client.beta.messages
			.stream(
				{
					model: modelOf(connection),
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
		if (error instanceof Client.APIConnectionError) return { ok: false, reason: 'Could not reach Claude. Check your connection.' };
		if (error instanceof Client.APIError) {
			const body = error.error as { error?: { message?: unknown } } | undefined;
			return { ok: false, reason: refusalOf('Claude', error.status ?? 0, typeof body?.error?.message === 'string' ? body.error.message : '') };
		}
		return { ok: false, reason: 'Something went wrong on the way to Claude. Try again.' };
	}
}

function base64url(bytes: Uint8Array): string {
	return btoa(String.fromCharCode(...bytes)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export async function codeChallenge(verifier: string): Promise<string> {
	return base64url(new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(verifier))));
}

/**
 * OpenRouter's sign-in, with no server: the person approves on openrouter.ai and comes back with a code that
 * only this tab's verifier can trade for a key (PKCE).
 */
export async function openRouterSignInUrl(callbackUrl: string): Promise<string> {
	const verifier = base64url(crypto.getRandomValues(new Uint8Array(32)));
	sessionStorage.setItem(OPENROUTER_VERIFIER_KEY, verifier);
	const query = new URLSearchParams({ callback_url: callbackUrl, code_challenge: await codeChallenge(verifier), code_challenge_method: 'S256' });
	return `https://openrouter.ai/auth?${query}`;
}

export function openRouterSignInPending(): boolean {
	try {
		return sessionStorage.getItem(OPENROUTER_VERIFIER_KEY) !== null;
	} catch {
		return false;
	}
}

export async function finishOpenRouterSignIn(code: string): Promise<{ ok: true; key: string } | { ok: false; reason: string }> {
	const verifier = sessionStorage.getItem(OPENROUTER_VERIFIER_KEY);
	sessionStorage.removeItem(OPENROUTER_VERIFIER_KEY);
	if (!verifier) return { ok: false, reason: 'That sign-in started in another tab. Connect again from here.' };
	try {
		const response = await fetch('https://openrouter.ai/api/v1/auth/keys', {
			method: 'POST',
			headers: { 'content-type': 'application/json' },
			body: JSON.stringify({ code, code_verifier: verifier, code_challenge_method: 'S256' })
		});
		const body = (await response.json().catch(() => null)) as { key?: unknown } | null;
		if (response.ok && typeof body?.key === 'string' && body.key) return { ok: true, key: body.key };
		return { ok: false, reason: 'OpenRouter did not finish connecting. Try again.' };
	} catch {
		return { ok: false, reason: 'Could not reach OpenRouter. Check your connection.' };
	}
}
