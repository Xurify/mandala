<script lang="ts">
	import type { HelperStore, WriteMode } from '$lib/chart/helper.svelte';
	import { looksLikeClaudeKey } from '$lib/chart/claude';
	import { CHAT_APPS, chatLink, type ChatApp } from '$lib/chart/draft';
	import { gapsOf } from '$lib/chart/helper';
	import { hasContent } from '$lib/chart/model';
	import HelperDraft from './HelperDraft.svelte';
	import Icon from './Icon.svelte';
	import BouncingDots from './ui/BouncingDots.svelte';
	import Button from './ui/Button.svelte';
	import SegmentedControl from './ui/SegmentedControl.svelte';
	import Select from './ui/Select.svelte';
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
	const appOptions = CHAT_APPS.map((app) => ({ value: app.id, label: app.label, icon: app.icon }));
	const app = $derived(CHAT_APPS.find((entry) => entry.id === helper.app) ?? CHAT_APPS[0]!);
	const outcome = $derived(helper.outcome);
	const copied = $derived(helper.copied === helper.mode);
	const opened = $derived(copied ? helper.sent : null);
	let link = $state<{ mode: WriteMode; app: ChatApp } | null>(null);
	const linked = $derived(copied && link?.mode === helper.mode ? link.app : null);
	const answered = $derived(outcome !== null && outcome.kind !== 'unread');
	let failed = $state(false);
	let adding = $state(false);
	let draftKey = $state('');
	const fromClaude = $derived(helper.wrote !== null && helper.wrote === helper.mode && helper.reply.trim() !== '');
	const writingHere = $derived(helper.writing !== null && helper.writing === helper.mode);
	const ready = $derived(helper.mode === 'new' ? helper.goal.trim() !== '' : helper.mode === 'ask' ? helper.question.trim() !== '' : true);
	const claudeLabel = $derived(helper.mode === 'ask' ? 'Ask Claude' : helper.mode === 'review' ? 'Review with Claude' : 'Write with Claude');

	function saveKey(event: SubmitEvent): void {
		event.preventDefault();
		if (!looksLikeClaudeKey(draftKey)) return;
		helper.setClaudeKey(draftKey);
		draftKey = '';
		adding = false;
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
						? 'It runs the two tests on every line, in any language, and rewrites the ones that fail.'
						: 'It reads your chart with the question. The answer stays there.';
		return { there };
	});
	const APPS = Object.fromEntries(CHAT_APPS.map((entry) => [entry.id, entry.label])) as Record<(typeof CHAT_APPS)[number]['id'], string>;

	async function copy(): Promise<void> {
		const mode: WriteMode = helper.mode;
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
				<p class="m-0 text-[0.95rem] leading-tight font-[620]">{helper.claudeKey ? 'Write it with Claude, or copy the prompt' : 'Copy the prompt'}</p>
				{#if helper.mode === 'review'}
					<p class="m-0 text-[0.84rem] leading-snug text-pretty text-muted">The whole chart goes with it. Lines that pass come back as they are.</p>
				{:else if helper.mode === 'new'}
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
				{#if helper.claudeKey}
					<div class="flex flex-wrap items-center gap-2">
						<Button size="sm" variant={answered || helper.answer ? 'soft' : 'primary'} icon="claude" disabled={!ready || helper.writing !== null} onclick={() => helper.askClaude()}>
							{#if writingHere}<span class="inline-flex items-center">Writing<BouncingDots /></span>{:else}{claudeLabel}{/if}
						</Button>
						{#if writingHere}
							<Button size="sm" variant="ghost" onclick={() => helper.stopClaude()}>Stop</Button>
						{:else if !ready}
							<span class="text-[0.8rem] text-muted">{helper.mode === 'new' ? 'Type your goal first.' : 'Type your question first.'}</span>
						{/if}
					</div>
					{#if helper.failure}
						<p class="m-0 text-[0.82rem] leading-snug text-pretty text-danger motion-safe:animate-pop-in" role="alert">{helper.failure}</p>
					{/if}
				{/if}
				<div class="flex flex-wrap items-center gap-2">
					<Button size="sm" variant="soft" icon={copied && !opened && !linked ? 'check' : 'copy'} onclick={copy}>{copied && !opened && !linked ? 'Prompt copied' : 'Copy prompt'}</Button>
					<Button size="sm" variant="soft" icon={app.icon} onclick={() => ((link = null), helper.openIn())}>Open in {app.label}</Button>
					<Button size="sm" variant="soft" icon={linked ? 'check' : 'link'} onclick={copyLink}>{linked ? 'Link copied' : 'Copy link'}</Button>
					<Select
						size="sm"
						class="w-[9.5rem]"
						label="Which chat app to open"
						options={appOptions}
						value={helper.app}
						onchange={(value) => {
							if (CHAT_APPS.some((entry) => entry.id === value)) helper.useApp(value as (typeof CHAT_APPS)[number]['id']);
						}}
					/>
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
				<p class="m-0 text-[0.95rem] leading-tight font-[620]">{writingHere
						? 'Claude is writing. It can take a minute.'
						: helper.answer && helper.mode === 'ask'
							? 'Claude answered'
							: fromClaude
								? 'Claude wrote it'
								: opened
						? `It is in ${APPS[opened]}'s box. Send it there.`
						: linked
							? `Paste the link into any browser. ${APPS[linked]} opens with it.`
							: 'Paste it into any chat app'}</p>
				{#if helper.answer && helper.mode === 'ask'}
					<p class="m-0 mt-1.5 rounded-[20px] bg-bg p-3.5 text-[0.92rem] leading-[1.5] text-pretty whitespace-pre-line motion-safe:animate-pop-in">{helper.answer}</p>
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
					<p class="m-0 text-[0.95rem] leading-tight font-[620]">{fromClaude ? "Claude's reply" : 'Paste the reply here'}</p>
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

	{#if helper.claudeKey}
		<p class="m-0 flex flex-wrap items-center gap-x-2 gap-y-1 text-[0.8rem] leading-snug text-muted">
			<span class="inline-flex items-center gap-1.5"><Icon name="claude" size={14} />Your Claude key is on this device.</span>
			<button
				type="button"
				class="cursor-pointer border-0 bg-transparent p-0 font-sans text-[0.8rem] font-[600] text-text underline decoration-line underline-offset-4 hover:decoration-text focus-visible:rounded focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink"
				onclick={() => helper.setClaudeKey('')}
			>
				Remove it
			</button>
		</p>
	{:else if adding}
		<form class="flex flex-col gap-2.5 rounded-[20px] bg-bg p-3.5 motion-safe:animate-pop-in" onsubmit={saveKey}>
			<p class="m-0 text-[0.95rem] leading-tight font-[620]">Write with your own Claude key</p>
			<input
				class={textField}
				type="password"
				autocomplete="off"
				spellcheck="false"
				aria-label="Your Claude API key"
				placeholder="sk-ant-…"
				bind:value={draftKey}
			/>
			<p class="m-0 text-[0.8rem] leading-snug text-pretty text-muted">
				It stays on this device and never syncs. Requests go from this browser straight to Anthropic, billed to your account.
				<a class="font-[600] text-text underline decoration-line underline-offset-4 hover:decoration-text" href="https://console.anthropic.com/settings/keys" target="_blank" rel="noopener noreferrer">Get a key</a>
			</p>
			<div class="flex items-center gap-2">
				<Button size="sm" variant="soft" type="submit" disabled={!looksLikeClaudeKey(draftKey)}>Save key</Button>
				<Button size="sm" variant="ghost" onclick={() => ((adding = false), (draftKey = ''))}>Cancel</Button>
			</div>
		</form>
	{:else}
		<Button class="self-start" size="sm" variant="ghost" icon="claude" onclick={() => (adding = true)}>Use your own Claude key</Button>
	{/if}
</div>
