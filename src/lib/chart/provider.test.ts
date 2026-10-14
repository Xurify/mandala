import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
	codeChallenge,
	finishOpenRouterSignIn,
	looksLikeKey,
	modelOf,
	openRouterSignInPending,
	openRouterSignInUrl,
	readConnection,
	sendPrompt,
	type Connection
} from './provider.ts';

const sdk = vi.hoisted(() => ({ requests: [] as unknown[], next: null as null | (() => Promise<unknown>) }));

vi.mock('@anthropic-ai/sdk', async (original) => {
	const real = (await original()) as typeof import('@anthropic-ai/sdk');
	class Fake extends real.default {
		constructor(options: ConstructorParameters<typeof real.default>[0]) {
			super(options);
			Object.assign(this, {
				beta: { messages: { stream: (request: unknown) => (sdk.requests.push(request), { finalMessage: () => sdk.next!() }) } }
			});
		}
	}
	return { ...real, default: Fake };
});

function answer(status: number, body: unknown) {
	return vi.fn(async (_url: string, _init: RequestInit) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } }));
}

function storage(): Storage {
	const items = new Map<string, string>();
	return {
		getItem: (key) => items.get(key) ?? null,
		setItem: (key, value) => void items.set(key, value),
		removeItem: (key) => void items.delete(key),
		clear: () => items.clear(),
		key: () => null,
		get length() {
			return items.size;
		}
	};
}

beforeEach(() => {
	vi.stubGlobal('sessionStorage', storage());
	sdk.requests = [];
});

afterEach(() => {
	vi.unstubAllGlobals();
});

describe('a saved connection', () => {
	it('reads only a known provider with a key, and fills in the default model', () => {
		expect(readConnection(JSON.stringify({ provider: 'gemini', key: ' AIza-x ' }))).toEqual({ provider: 'gemini', key: 'AIza-x' });
		expect(readConnection(JSON.stringify({ provider: 'nope', key: 'x' }))).toBeNull();
		expect(readConnection(JSON.stringify({ provider: 'openai', key: '' }))).toBeNull();
		expect(readConnection('not json')).toBeNull();
		expect(modelOf({ provider: 'openrouter', key: 'k' })).toBe('openrouter/auto');
		expect(modelOf({ provider: 'openrouter', key: 'k', model: 'openrouter/free' })).toBe('openrouter/free');
	});

	it("tells each provider's keys apart", () => {
		expect(looksLikeKey('openrouter', 'sk-or-v1-0123456789abcdef0123456789')).toBe(true);
		expect(looksLikeKey('openrouter', 'sk-ant-api03-0123456789abcdef0123')).toBe(false);
		expect(looksLikeKey('gemini', 'AIzaSyA0123456789abcdefghijklmnopqrstu')).toBe(true);
		expect(looksLikeKey('claude', 'sk-ant-api03-0123456789abcdef0123')).toBe(true);
		expect(looksLikeKey('openai', 'sk-proj-0123456789abcdef0123456789')).toBe(true);
		expect(looksLikeKey('openai', 'hello')).toBe(false);
	});
});

describe('sendPrompt in the chat format', () => {
	const gemini: Connection = { provider: 'gemini', key: 'AIza-test' };

	it('posts the prompt with the key and the model, and returns the text', async () => {
		const fetch = answer(200, { choices: [{ finish_reason: 'stop', message: { content: ' {"goal":"x"} ' } }] });
		vi.stubGlobal('fetch', fetch);
		expect(await sendPrompt(gemini, 'Hello')).toEqual({ ok: true, text: '{"goal":"x"}' });
		const [url, init] = fetch.mock.calls[0]!;
		expect(url).toBe('https://generativelanguage.googleapis.com/v1beta/openai/chat/completions');
		expect((init.headers as Record<string, string>).authorization).toBe('Bearer AIza-test');
		expect(JSON.parse(init.body as string)).toEqual({ model: 'gemini-3.8-flash', messages: [{ role: 'user', content: 'Hello' }] });
	});

	it('names the app to OpenRouter and uses the chosen model', async () => {
		const fetch = answer(200, { choices: [{ message: { content: 'ok' } }] });
		vi.stubGlobal('fetch', fetch);
		await sendPrompt({ provider: 'openrouter', key: 'sk-or-x', model: 'openrouter/free' }, 'Hi');
		const [url, init] = fetch.mock.calls[0]!;
		expect(url).toBe('https://openrouter.ai/api/v1/chat/completions');
		expect((init.headers as Record<string, string>)['x-title']).toBe('Mandala');
		expect(JSON.parse(init.body as string).model).toBe('openrouter/free');
	});

	it('says in one sentence why a request failed', async () => {
		const cases: [number, unknown, string][] = [
			[401, {}, 'Gemini did not accept that key. Check it, or connect again.'],
			[402, {}, 'Gemini says this account is out of credit.'],
			[429, {}, 'Gemini is busy, or this key hit its limit. Try again in a minute.'],
			[400, { error: { message: 'model not found' } }, 'Gemini said: model not found'],
			[200, { choices: [{ finish_reason: 'length', message: { content: '{' } }] }, 'The reply ran out of room. Try again.'],
			[200, { choices: [{ finish_reason: 'content_filter', message: { content: '' } }] }, 'Gemini would not write this one.'],
			[200, { error: { message: 'upstream failed' } }, 'Gemini said: upstream failed']
		];
		for (const [status, body, reason] of cases) {
			vi.stubGlobal('fetch', answer(status, body));
			expect(await sendPrompt(gemini, 'Hi'), reason).toEqual({ ok: false, reason });
		}
		vi.stubGlobal('fetch', vi.fn(async () => Promise.reject(new TypeError('Failed to fetch'))));
		expect(await sendPrompt(gemini, 'Hi')).toEqual({ ok: false, reason: 'Could not reach Gemini. Check your connection.' });
		vi.stubGlobal('fetch', vi.fn(async () => Promise.reject(new DOMException('stop', 'AbortError'))));
		expect(await sendPrompt(gemini, 'Hi')).toEqual({ ok: false, aborted: true });
	});
});

describe('sendPrompt to Claude', () => {
	it("goes through Anthropic's SDK and reads a refusal", async () => {
		sdk.next = async () => ({ stop_reason: 'end_turn', content: [{ type: 'text', text: 'Done' }] });
		expect(await sendPrompt({ provider: 'claude', key: 'sk-ant-x' }, 'Hi')).toEqual({ ok: true, text: 'Done' });
		expect(sdk.requests[0]).toMatchObject({ model: 'claude-opus-5-5', messages: [{ role: 'user', content: 'Hi' }] });
		sdk.next = async () => ({ stop_reason: 'refusal', content: [] });
		expect(await sendPrompt({ provider: 'claude', key: 'sk-ant-x' }, 'Hi')).toEqual({ ok: false, reason: 'Claude would not write this one.' });
	});
});

describe('signing in with OpenRouter', () => {
	it('derives the S256 challenge from the verifier (RFC 7636)', async () => {
		expect(await codeChallenge('dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk')).toBe('E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM');
	});

	it('sends the person to approve, and trades the code for a key with the same verifier', async () => {
		const url = new URL(await openRouterSignInUrl('https://mandala.app/'));
		expect(url.origin + url.pathname).toBe('https://openrouter.ai/auth');
		expect(url.searchParams.get('callback_url')).toBe('https://mandala.app/');
		expect(url.searchParams.get('code_challenge_method')).toBe('S256');
		expect(openRouterSignInPending()).toBe(true);
		const verifier = sessionStorage.getItem('mandala_openrouter_verifier')!;
		expect(url.searchParams.get('code_challenge')).toBe(await codeChallenge(verifier));

		const fetch = answer(200, { key: 'sk-or-v1-new' });
		vi.stubGlobal('fetch', fetch);
		expect(await finishOpenRouterSignIn('the-code')).toEqual({ ok: true, key: 'sk-or-v1-new' });
		expect(JSON.parse(fetch.mock.calls[0]![1].body as string)).toEqual({ code: 'the-code', code_verifier: verifier, code_challenge_method: 'S256' });
		expect(openRouterSignInPending()).toBe(false);
	});

	it('refuses a code when this tab did not start the sign-in', async () => {
		expect(await finishOpenRouterSignIn('stray')).toEqual({ ok: false, reason: 'That sign-in started in another tab. Connect again from here.' });
	});
});
