<script lang="ts">
	import type { HelperStore, WriteMode } from '$lib/chart/helper.svelte';
	import { draftButton, editWords, gapsOf, groupEdits } from '$lib/chart/helper';
	import { HUES, setByKey } from '$lib/chart/model';
	import Icon from './Icon.svelte';
	import MiniChart from './MiniChart.svelte';
	import Button from './ui/Button.svelte';
	import SegmentedControl from './ui/SegmentedControl.svelte';
	import { cn } from './ui/cn';
	import { textArea, textField } from './ui/styles';

	let { helper }: { helper: HelperStore } = $props();

	const gaps = $derived(gapsOf(helper.data).total);
	const options = $derived([
		{ value: 'new', label: 'New chart' },
		...(gaps > 0 ? [{ value: 'fill', label: 'Fill the gaps' }] : []),
		{ value: 'ask', label: 'Ask' }
	]);
	const outcome = $derived(helper.outcome);
	/** The chart as it would be, so a pillar the reply names is called by that name. */
	const preview = $derived.by(() => {
		if (outcome?.kind !== 'cells') return helper.data;
		const next = $state.snapshot(helper.data);
		for (const edit of outcome.edits) setByKey(next, edit.key, edit.after);
		return next;
	});
	const copied = $derived(helper.copied === helper.mode);
	/** The prompt went straight into a chat app by link, so pasting it there is done too. */
	const opened = $derived(copied ? helper.sent : null);
	const answered = $derived(outcome !== null && outcome.kind !== 'unread');
	let failed = $state(false);

	// A chart filled by hand while this page is open has no gaps left to ask for.
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
					: 'It reads your chart with the question. The answer stays there.';
		return { there };
	});
	const APPS = { claude: 'Claude', chatgpt: 'ChatGPT' } as const;

	async function copy(): Promise<void> {
		const mode: WriteMode = helper.mode;
		try {
			await navigator.clipboard.writeText(helper.prompt(mode));
			failed = false;
			helper.markCopied(mode);
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
	<!-- The thread between two steps fills in ink once the step above it is done. -->
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
				<p class="m-0 text-[0.95rem] leading-tight font-[620]">Copy the prompt</p>
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
				<div class="flex flex-wrap items-center gap-x-1 gap-y-1.5">
					<Button size="sm" variant="soft" icon={copied && !opened ? 'check' : 'copy'} onclick={copy}>{copied && !opened ? 'Copied' : 'Copy'}</Button>
					<!-- The same prompt, straight into a chat app's box. The person still presses send there. -->
					<Button size="sm" variant="ghost" icon="arrow-up-right" aria-label="Open the prompt in Claude" onclick={() => helper.openIn('claude')}>Claude</Button>
					<Button size="sm" variant="ghost" icon="arrow-up-right" aria-label="Open the prompt in ChatGPT" onclick={() => helper.openIn('chatgpt')}>ChatGPT</Button>
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
				<p class="m-0 text-[0.95rem] leading-tight font-[620]">{opened ? `It is in ${APPS[opened]}'s box. Send it there.` : 'Paste it into any chat app'}</p>
				<p class="m-0 text-[0.84rem] leading-snug text-pretty text-muted">{steps.there}</p>
			</div>
		</li>

		{#if helper.mode !== 'ask'}
			<li class="relative flex gap-3">
				<span class={marker(outcome?.kind === 'chart' || outcome?.kind === 'cells', copied && !answered)} aria-hidden="true">
					{#if outcome?.kind === 'chart' || outcome?.kind === 'cells'}{@render check()}{:else}3{/if}
				</span>
				<div class="flex min-w-0 flex-1 flex-col gap-2.5 pt-1">
					<p class="m-0 text-[0.95rem] leading-tight font-[620]">Paste the reply here</p>
					{#if outcome?.kind === 'chart'}
						{@const data = outcome.data}
						<div class="flex flex-col gap-3 rounded-[20px] bg-bg p-3.5 motion-safe:animate-pop-in">
							<div class="flex items-start gap-3.5">
								<MiniChart {data} play="fill" cell={8} label="A full chart, 64 actions" />
								<p class="m-0 min-w-0 flex-1 text-[0.98rem] leading-snug font-[620] text-pretty">{data.goal}</p>
							</div>
							<ol class="m-0 grid list-none grid-cols-2 gap-x-3 gap-y-1 p-0 text-[0.84rem] leading-[1.35]">
								{#each data.pillars as pillar, pillarIndex (pillarIndex)}
									<li class="flex min-w-0 items-center gap-1.5">
										<span class="pip size-2 shrink-0 rounded-full" style:--pip-h={HUES[pillarIndex]} aria-hidden="true"></span>
										<span class="truncate">{pillar}</span>
									</li>
								{/each}
							</ol>
							<div class="flex items-center gap-2">
								<Button size="sm" onclick={() => helper.applyReply()}>{draftButton(helper.data)}</Button>
								<Button size="sm" variant="ghost" onclick={() => (helper.reply = '')}>Paste another</Button>
							</div>
						</div>
					{:else if outcome?.kind === 'cells'}
						{@const words = editWords(helper.data, outcome.edits)}
						<div class="flex flex-col gap-3 rounded-[20px] bg-bg p-3.5 motion-safe:animate-pop-in">
							<div class="flex max-h-[220px] flex-col gap-3 overflow-y-auto overscroll-contain">
								{#each groupEdits(preview, outcome.edits) as group (group.key)}
									<section class="flex min-w-0 flex-col gap-1" aria-label={group.label}>
										<p class="m-0 flex items-center gap-1.5 text-[0.76rem] font-[620]">
											{#if group.pillarIndex !== null}
												<span class="pip size-2 shrink-0 rounded-full" style:--pip-h={HUES[group.pillarIndex]} aria-hidden="true"></span>
												<span class="pillar-ink" style:--h={HUES[group.pillarIndex]}>{group.label}</span>
											{:else}
												<span class="text-muted">{group.label}</span>
											{/if}
										</p>
										<ul class="m-0 flex list-none flex-col gap-0.5 p-0 ps-3.5">
											{#each group.edits as edit (edit.key)}
												<li class="text-[0.88rem] leading-snug text-pretty">{edit.after}</li>
											{/each}
										</ul>
									</section>
								{/each}
							</div>
							<div class="flex items-center gap-2">
								<Button size="sm" onclick={() => helper.applyReply()}>{words.button}</Button>
								<Button size="sm" variant="ghost" onclick={() => (helper.reply = '')}>Paste another</Button>
							</div>
						</div>
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
</div>
