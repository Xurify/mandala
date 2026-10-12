<script lang="ts">
	import { chart } from '$lib/chart/chart.svelte';
	import { actionKey, HUES, idAt, idx } from '$lib/chart/model';
	import Button from './ui/Button.svelte';
	import Dialog from './ui/Dialog.svelte';
	import IconButton from './ui/IconButton.svelte';
	import { cn } from './ui/cn';
	import { fitWords } from './ui/fit';

	/** The pillar whose block is open, or null. */
	let { pillar = $bindable(null) }: { pillar?: number | null } = $props();

	/** Held while the dialog closes, so its words do not change on the way out. */
	let shown = $state(0);
	$effect(() => {
		if (pillar !== null) shown = pillar;
	});

	const name = $derived(chart.data.pillars[shown]?.trim() || `Pillar ${shown + 1}`);
	const words = $derived((chart.data.actions[shown] ?? []).map((text) => text.trim()));
	const written = $derived(words.filter(Boolean).length);

	function close(): void {
		pillar = null;
	}

	function edit(key: string): void {
		close();
		chart.jumpToKey(key);
	}

	function step(by: 1 | -1): void {
		pillar = (shown + by + 8) % 8;
	}
</script>

<Dialog
	bind:open={() => pillar !== null, (value) => !value && close()}
	title={name}
	description="Pillar {shown + 1} · {written} of 8 actions written"
>
	<div class="grid grid-cols-3 gap-1.5" style:--h={HUES[shown]}>
		{#each Array(9) as _, cellIndex (cellIndex)}
			{#if cellIndex === 4}
				<button
					type="button"
					class="flex aspect-square min-w-0 cursor-pointer items-center justify-center rounded-[28%] border-0 p-[10%] text-center font-sans text-[0.92rem] leading-tight font-[620] text-balance text-on-p pillar-cell can-hover:hover:pillar-hot focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink"
					aria-label="Edit {name}"
					onclick={() => edit(`p${shown}`)}
				>
					<span class="line-clamp-4 w-full" {@attach fitWords(name)}>{name}</span>
				</button>
			{:else}
				{@const slot = idx(cellIndex)}
				{@const text = words[slot] ?? ''}
				{@const meta = chart.data.meta?.[idAt(chart.data, shown, slot)]}
				{@const done = meta?.kind === 'milestone' && meta.done === true}
				<button
					type="button"
					class={cn(
						'flex aspect-square min-w-0 cursor-pointer items-center justify-center overflow-hidden rounded-[16px] border-0 p-2 text-center font-sans text-[0.8rem] leading-[1.2] text-pretty text-text pillar-action can-hover:hover:action-hot focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink',
						done && 'text-muted line-through'
					)}
					aria-label={text ? `Edit action ${slot + 1}: ${text}${done ? ', done' : ''}` : `Write action ${slot + 1}`}
					onclick={() => edit(actionKey(shown, slot))}
				>
					{#if text}
						<span class="line-clamp-6 w-full" {@attach fitWords(text)}>{text}</span>
					{:else}
						<span class="text-muted" aria-hidden="true">+</span>
					{/if}
				</button>
			{/if}
		{/each}
	</div>
	{#snippet footer()}
		<div class="me-auto flex">
			<IconButton icon="chevron-left" label="Previous pillar" onclick={() => step(-1)} />
			<IconButton icon="chevron-right" label="Next pillar" onclick={() => step(1)} />
		</div>
		<Button variant="soft" icon="edit" onclick={() => edit(`p${shown}`)}>Edit</Button>
	{/snippet}
</Dialog>
