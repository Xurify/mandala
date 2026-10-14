<script lang="ts">
	import type { HelperStore, WriteMode } from '$lib/chart/helper.svelte';
	import { CHAT_APPS, chatLink, type ChatApp } from '$lib/chart/draft';
	import { looksLikeKey, openRouterSignInUrl, PROVIDERS, providerOf, type ProviderId } from '$lib/chart/provider';
	import { gapsOf } from '$lib/chart/helper';
	import { hasContent } from '$lib/chart/model';
	import HelperDraft from './HelperDraft.svelte';
	import Icon from './Icon.svelte';
	import BouncingDots from './ui/BouncingDots.svelte';
	import Button from './ui/Button.svelte';
	import Eyebrow from './ui/Eyebrow.svelte';
	import MenuDivider from './ui/MenuDivider.svelte';
	import MenuItem from './ui/MenuItem.svelte';
	import SegmentedControl from './ui/SegmentedControl.svelte';
	import SplitButton from './ui/SplitButton.svelte';
	import { cn } from './ui/cn';
	import { textArea, textField } from './ui/styles';

	let { helper }: { helper: HelperStore } = $props();

	const gaps = $derived(gapsOf(helper.data).total);
	const written = $derived(hasContent(helper.data));
	const options = $derived([
		{ value: 'new', label: 'New chart' },
		...(gaps > 0 ? [{ value: 'fill', label: 'Fill the gaps' }] : []),
		...(written ? [{ value: 'review', label: 'Review' }] : []),
		{ value: 'ask', label: 'Ask' }
	]);
	const app = $derived(CHAT_APPS.find((entry) => entry.id === helper.app) ?? CHAT_APPS[0]!);
	const way = $derived(helper.way === 'prompt' ? null : (CHAT_APPS.find((entry) => entry.id === helper.way) ?? null));
	const outcome = $derived(helper.outcome);

	const copied = $derived(helper.copied === helper.mode);
	const opened = $derived(copied ? helper.sent : null);
	let link = $state<{ mode: WriteMode; app: ChatApp } | null>(null);
	const linked = $derived(copied && link?.mode === helper.mode ? link.app : null);
	const answered = $derived(outcome !== null && outcome.kind !== 'unread');
	let failed = $state(false);
	let connecting = $state(false);
	let choice = $state<ProviderId>('openrouter');
	let keyDraft = $state('');
	let modelDraft = $state('');
	let leaving = $state(false);
	const connected = $derived(helper.connection ? providerOf(helper.connection.provider) : null);
	const live = $derived(helper.aiEnabled ? connected : null);
	const chosen = $derived(providerOf(choice));
	const providerOptions = PROVIDERS.map((provider) => ({ value: provider.id, label: provider.label }));
	const replyFromProvider = $derived(helper.repliedBy === 'provider');
	const sendingThisMode = $derived(helper.sending !== null && helper.sending === helper.mode);
	const ready = $derived(helper.mode === 'new' ? helper.goal.trim() !== '' : helper.mode === 'ask' ? helper.question.trim() !== '' : true);
	const sendLabel = $derived(
		live ? (helper.mode === 'ask' ? `Ask ${live.label}` : helper.mode === 'review' ? `Review with ${live.label}` : `Write with ${live.label}`) : ''
	);

	function saveKey(event: SubmitEvent): void {
		event.preventDefault();
		if (!looksLikeKey(choice, keyDraft)) return;
		const model = choice === 'openrouter' ? modelDraft.trim() : '';
		helper.connect({ provider: choice, key: keyDraft.trim(), ...(model ? { model } : {}) });
		keyDraft = '';
		modelDraft = '';
		connecting = false;
	}

	function turnOnAi(): void {
		helper.setAiEnabled(true);
		if (!helper.connection) connecting = true;
	}

	async function signInWithOpenRouter(): Promise<void> {
		leaving = true;
		location.assign(await openRouterSignInUrl(`${location.origin}${location.pathname}`));
	}

	function setModel(value: string): void {
		const connection = helper.connection;
		if (!connection) return;
		const model = value.trim();
		helper.connect({ provider: connection.provider, key: connection.key, ...(model ? { model } : {}) });
	}

	$effect(() => {
		if (helper.mode === 'fill' && gaps === 0) helper.mode = 'ask';
	});

	const steps = $derived.by(() => {
		const mode = helper.mode;
		const there =
			mode === 'new'
				? 'It asks you a few questions first, then writes the whole chart.'
				: mode === 'fill'
					? `It keeps your lines and writes only the ${gaps === 1 ? 'one that is' : `${gaps} that are`} empty.`
					: mode === 'review'
						? "It rewrites only the lines you can't tick off, or that aren't up to you."
						: 'It reads your chart with the question. The answer stays there.';
		return { there };
	});
	const APPS = Object.fromEntries(CHAT_APPS.map((entry) => [entry.id, entry.label])) as Record<(typeof CHAT_APPS)[number]['id'], string>;

	function handOff(): void {
		if (way) {
			link = null;
			helper.openIn(way.id);
		} else void copy();
	}

	async function copy(): Promise<void> {
		const mode: WriteMode = helper.mode;
		helper.useWay('prompt');
		try {
			await navigator.clipboard.writeText(helper.prompt(mode));
			failed = false;
			link = null;
			helper.markCopied(mode);
		} catch {
			failed = true;
		}
	}

	async function copyLink(): Promise<void> {
		const mode: WriteMode = helper.mode;
		try {
			await navigator.clipboard.writeText(chatLink(helper.app, helper.prompt(mode)));
			failed = false;
			helper.markCopied(mode);
			link = { mode, app: helper.app };
		} catch {
			failed = true;
		}
	}

	function marker(done: boolean, current: boolean): string {
		return cn(
			'relative z-[1] grid size-7 shrink-0 place-items-center rounded-full text-[0.8rem] leading-none font-[620] tabular-nums motion-safe:transition-[scale] motion-safe:duration-300 motion-safe:ease-[cubic-bezier(0.34,1.56,0.64,1)]',
			done ? 'bg-ink text-on-ink' : current ? 'bg-surface text-text shadow-[inset_0_0_0_1.5px_var(--ink)]' : 'bg-sunken text-muted',
			done && 'scale-100',
			!done && !current && 'scale-90'
		);
	}
</script>

{#snippet check()}
	<svg class="block size-3.5" viewBox="0 0 16 16" aria-hidden="true">
		<polyline
			class="fill-none stroke-current [stroke-dasharray:1] [stroke-linecap:round] [stroke-linejoin:round] motion-safe:animate-seal-draw"
			points="3.5 8.5 6.6 11.4 12.5 4.8"
			stroke-width="2.2"
			pathLength="1"
		/>
	</svg>
{/snippet}

{#snippet thread(done: boolean)}
	<span class="absolute start-[13px] top-7 bottom-0 w-0.5 -translate-x-1/2 overflow-hidden rounded-full bg-sunken" aria-hidden="true">
		<span
			class={cn(
				'absolute inset-0 origin-top bg-ink motion-safe:transition-[scale] motion-safe:duration-500 motion-safe:ease-[cubic-bezier(0.16,1,0.3,1)]',
				done ? 'scale-y-100' : 'scale-y-0'
			)}
		></span>
	</span>
{/snippet}

<div class="flex flex-col gap-4 px-4 pt-1 pb-4">
	<SegmentedControl options={options} bind:value={helper.mode} size="sm" label="What the prompt is for" />

	<ol class="m-0 flex list-none flex-col p-0">
		<li class="relative flex gap-3 pb-5">
			{@render thread(copied)}
			<span class={marker(copied, !copied)} aria-hidden="true">{#if copied}{@render check()}{:else}1{/if}</span>
			<div class="flex min-w-0 flex-1 flex-col gap-2.5 pt-1">
				<p class="m-0 text-[0.95rem] leading-tight font-[620]">{live ? `Write it with ${live.label}, or send the prompt` : way ? 'Send the prompt' : 'Copy the prompt'}</p>
				{#if helper.mode === 'new'}
					<input
						class={textField}
						type="text"
						maxlength="200"
						autocomplete="off"
						aria-label="Your goal"
						placeholder="Your goal, if you have one"
						bind:value={helper.goal}
						onfocus={() => (helper.listening = true)}
						onblur={() => (helper.listening = false)}
					/>
				{:else if helper.mode === 'ask'}
					<textarea
						class={cn(textArea, 'min-h-[76px] resize-none')}
						maxlength="600"
						rows="2"
						aria-label="Your question"
						placeholder="Ask here, or in the chat app"
						bind:value={helper.question}
						onfocus={() => (helper.listening = true)}
						onblur={() => (helper.listening = false)}
					></textarea>
				{/if}
				{#if live}
					<div class="flex flex-wrap items-center gap-2">
						<Button size="sm" variant={answered || helper.askAnswer ? 'soft' : 'primary'} icon={live.icon} disabled={!ready || helper.sending !== null} onclick={() => helper.send()}>
							{#if sendingThisMode}<span class="inline-flex items-center">Writing<BouncingDots /></span>{:else}{sendLabel}{/if}
						</Button>
						{#if sendingThisMode}
							<Button size="sm" variant="ghost" onclick={() => helper.cancel()}>Stop</Button>
						{:else if !ready}
							<span class="text-[0.8rem] text-muted">{helper.mode === 'new' ? 'Type your goal first.' : 'Type your question first.'}</span>
						{/if}
					</div>
					{#if helper.sendError}
						<p class="m-0 text-[0.82rem] leading-snug text-pretty text-danger motion-safe:animate-pop-in" role="alert">{helper.sendError}</p>
					{/if}
				{/if}
				<div class="flex flex-wrap items-center gap-2">
					<SplitButton size="sm" icon={way ? way.icon : copied && !opened && !linked ? 'check' : 'copy'} more="Other ways to send the prompt" onclick={handOff}>
						{#snippet label()}{way ? `Open in ${way.label}` : copied && !opened && !linked ? 'Prompt copied' : 'Copy prompt'}{/snippet}
						<div role="group" aria-labelledby="handoff-open">
							<Eyebrow class="px-3 pt-2 pb-1"><span id="handoff-open">One click</span></Eyebrow>
							{#each CHAT_APPS as entry (entry.id)}
								<MenuItem icon={entry.icon} checked={helper.way === entry.id} onclick={() => ((link = null), helper.openIn(entry.id))}>{entry.label}</MenuItem>
							{/each}
						</div>
						<MenuDivider />
						<div role="group" aria-labelledby="handoff-paste">
							<Eyebrow class="px-3 pt-2 pb-1"><span id="handoff-paste">Copy and paste</span></Eyebrow>
							<MenuItem icon="copy" badge="Any chat app" checked={helper.way === 'prompt'} onclick={copy}>Copy prompt</MenuItem>
							<MenuItem icon="link" badge="Opens {app.label}" onclick={copyLink}>Copy link</MenuItem>
						</div>
					</SplitButton>
					{#if failed}
						<span class="basis-full text-[0.8rem] text-danger">Copying was blocked here. Try again.</span>
					{/if}
				</div>
			</div>
		</li>

		<li class={cn('relative flex gap-3', helper.mode !== 'ask' && 'pb-5')}>
			{#if helper.mode !== 'ask'}{@render thread(answered || opened !== null)}{/if}
			<span class={marker(answered || opened !== null || (helper.mode === 'ask' && copied), copied && !answered && !opened)} aria-hidden="true">
				{#if answered || opened !== null || (helper.mode === 'ask' && copied)}{@render check()}{:else}2{/if}
			</span>
			<div class="flex min-w-0 flex-1 flex-col gap-1 pt-1">
				<p class="m-0 text-[0.95rem] leading-tight font-[620]">{sendingThisMode && live
						? `${live.label} is writing. It can take a minute.`
						: helper.askAnswer && helper.mode === 'ask' && live
							? `${live.label} answered`
							: replyFromProvider && live
								? `${live.label} wrote it`
								: opened
						? `It is in ${APPS[opened]}'s box. Send it there.`
						: linked
							? `Paste the link into any browser. ${APPS[linked]} opens with it.`
							: 'Paste it into any chat app'}</p>
				{#if helper.askAnswer && helper.mode === 'ask'}
					<p class="m-0 mt-1.5 rounded-[20px] bg-bg p-3.5 text-[0.92rem] leading-[1.5] text-pretty whitespace-pre-line motion-safe:animate-pop-in">{helper.askAnswer}</p>
				{:else}
					<p class="m-0 text-[0.84rem] leading-snug text-pretty text-muted">{steps.there}</p>
				{/if}
			</div>
		</li>

		{#if helper.mode !== 'ask'}
			<li class="relative flex gap-3">
				<span class={marker(outcome?.kind === 'chart' || outcome?.kind === 'cells', copied && !answered)} aria-hidden="true">
					{#if outcome?.kind === 'chart' || outcome?.kind === 'cells'}{@render check()}{:else}3{/if}
				</span>
				<div class="flex min-w-0 flex-1 flex-col gap-2.5 pt-1">
					<p class="m-0 text-[0.95rem] leading-tight font-[620]">{replyFromProvider && live ? `${live.label}'s reply` : 'Paste the reply here'}</p>
					{#if outcome?.kind === 'chart' || outcome?.kind === 'cells'}
						<HelperDraft data={helper.data} draft={outcome} onkeep={() => helper.applyReply()} aside="Paste another" onaside={() => (helper.reply = '')} />
					{:else}
						<textarea
							class={cn(textArea, 'min-h-[76px] resize-none')}
							rows="2"
							data-reply
							aria-label="The reply from the chat app"
							placeholder="Paste the whole reply"
							bind:value={helper.reply}
							onfocus={() => (helper.listening = true)}
							onblur={() => (helper.listening = false)}
						></textarea>
						{#if outcome?.kind === 'unread'}
							<p class="m-0 flex items-start gap-1.5 text-[0.82rem] leading-snug text-pretty text-muted motion-safe:animate-pop-in">
								<Icon name="info" size={14} class="mt-0.5 shrink-0" />
								That does not look like a chart yet. Paste the whole reply, braces and all.
							</p>
						{:else if outcome?.kind === 'nothing'}
							<p class="m-0 text-[0.82rem] leading-snug text-pretty text-muted motion-safe:animate-pop-in">
								Nothing new in that reply. Every line it fills is already written here.
							</p>
						{/if}
					{/if}
				</div>
			</li>
		{/if}
	</ol>

	{#if helper.askingConsent}
		<section class="flex flex-col gap-2.5 rounded-[20px] bg-bg p-3.5 motion-safe:animate-pop-in" aria-labelledby="ai-consent-title">
			<p id="ai-consent-title" class="m-0 text-[0.95rem] leading-tight font-[620]">Let Mandala send your chart to an AI?</p>
			<ul class="m-0 flex list-disc flex-col gap-1.5 ps-4 text-[0.84rem] leading-snug text-pretty text-muted">
				<li>When you press Write, Review or Ask, this browser sends the chart, what you told Bindu, and your question to the connected provider. Nothing goes before you press.</li>
				<li>The provider (ex. Claude <b>Anthropic</b>) bills your account, and keeps the text under its own terms.</li>
				<li>Turn it off any time in the "more actions" menu. Copying a prompt will always be available.</li>
			</ul>
			<div class="flex items-center gap-2">
				<Button size="sm" onclick={turnOnAi}>Turn on</Button>
				<Button size="sm" variant="ghost" onclick={() => (helper.askingConsent = false)}>Not now</Button>
			</div>
		</section>
	{:else if connected && helper.connection && !helper.aiEnabled}
		<p class="m-0 flex flex-wrap items-center gap-x-2 gap-y-1 text-[0.8rem] leading-snug text-muted">
			<span class="inline-flex items-center gap-1.5"><Icon name={connected.icon} size={14} />Your {connected.label} key is saved. AI is off.</span>
			<button type="button" class="cursor-pointer border-0 bg-transparent p-0 font-sans text-[0.8rem] font-[600] text-text underline decoration-line underline-offset-4 hover:decoration-text focus-visible:rounded focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink" onclick={() => (helper.askingConsent = true)}>Turn on</button>
			<button type="button" class="cursor-pointer border-0 bg-transparent p-0 font-sans text-[0.8rem] font-[600] text-text underline decoration-line underline-offset-4 hover:decoration-text focus-visible:rounded focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink" onclick={() => helper.connect(null)}>Disconnect</button>
		</p>
	{:else if connected && helper.connection}
		<div class="flex flex-col gap-2">
			<p class="m-0 flex flex-wrap items-center gap-x-2 gap-y-1 text-[0.8rem] leading-snug text-muted">
				<span class="inline-flex items-center gap-1.5"><Icon name={connected.icon} size={14} />{connected.label} is connected on this device.</span>
				<button type="button" class="cursor-pointer border-0 bg-transparent p-0 font-sans text-[0.8rem] font-[600] text-text underline decoration-line underline-offset-4 hover:decoration-text focus-visible:rounded focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink" onclick={() => helper.connect(null)}>Disconnect</button>
			</p>
			{#if connected.id === 'openrouter'}
				<label class="flex flex-col gap-1">
					<span class="text-[0.8rem] font-[600] text-muted">Model</span>
					<input
						class={cn(textField, 'h-9 text-[0.86rem]')}
						type="text"
						autocomplete="off"
						spellcheck="false"
						placeholder={connected.defaultModel}
						value={helper.connection.model ?? ''}
						onchange={(event) => setModel(event.currentTarget.value)}
					/>
					<span class="text-[0.76rem] leading-snug text-pretty text-muted">Any model on openrouter.ai. openrouter/free costs nothing, with a daily limit.</span>
				</label>
			{/if}
		</div>
	{:else if connecting && helper.aiEnabled}
		<form class="flex flex-col gap-2.5 rounded-[20px] bg-bg p-3.5 motion-safe:animate-pop-in" onsubmit={saveKey}>
			<p class="m-0 text-[0.95rem] leading-tight font-[620]">Connect an AI provider</p>
			<SegmentedControl options={providerOptions} bind:value={choice} size="sm" label="AI provider" />
			{#if choice === 'openrouter'}
				<Button class="self-start" size="sm" icon="sparkles" disabled={leaving} onclick={signInWithOpenRouter}>
					{#if leaving}<span class="inline-flex items-center">Opening OpenRouter<BouncingDots /></span>{:else}Connect OpenRouter{/if}
				</Button>
				<p class="m-0 text-[0.8rem] leading-snug text-muted">Or paste a key you already have:</p>
			{/if}
			<input
				class={textField}
				type="password"
				autocomplete="off"
				spellcheck="false"
				aria-label="Your {chosen.label} API key"
				placeholder="Your {chosen.label} key"
				bind:value={keyDraft}
			/>
			{#if choice === 'openrouter'}
				<input class={textField} type="text" autocomplete="off" spellcheck="false" aria-label="Model" placeholder="Model: {chosen.defaultModel}" bind:value={modelDraft} />
			{/if}
			<p class="m-0 text-[0.8rem] leading-snug text-pretty text-muted">
				Billed by {chosen.label}, separately from a ChatGPT, Claude or Gemini subscription. Copying the prompt costs nothing extra. The key stays on this device and never syncs.
				<a class="font-[600] text-text underline decoration-line underline-offset-4 hover:decoration-text" href={chosen.keyUrl} target="_blank" rel="noopener noreferrer">Get a key</a>
			</p>
			<div class="flex items-center gap-2">
				<Button size="sm" variant="soft" type="submit" disabled={!looksLikeKey(choice, keyDraft)}>Save key</Button>
				<Button size="sm" variant="ghost" onclick={() => ((connecting = false), (keyDraft = ''), (modelDraft = ''))}>Cancel</Button>
			</div>
		</form>
	{:else}
		<Button class="self-start" size="sm" variant="ghost" icon="sparkles" onclick={() => (helper.aiEnabled ? (connecting = true) : (helper.askingConsent = true))}>Connect an AI provider</Button>
	{/if}
</div>
