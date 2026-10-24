<script lang="ts">
	import { tick } from 'svelte';
	import { chart } from '$lib/chart/chart.svelte';
	import { actionKey, HUES, idAt, idx, TEXT_MAX } from '$lib/chart/model';
	import Button from './ui/Button.svelte';
	import Dialog from './ui/Dialog.svelte';
	import IconButton from './ui/IconButton.svelte';
	import { fitCellField } from './goal-fit';
	import { cn } from './ui/cn';

	type Props = {
		pillar?: number | null;
		/** The cell of its block the tap landed on, as the chart counts them (4 is the pillar), to start typing in. */
		focus?: number | null;
	};

	let { pillar = $bindable(null), focus = null }: Props = $props();

	/** Held while the dialog closes, so its words do not change on the way out. */
	let shown = $state(0);
	let fields = $state<(HTMLTextAreaElement | null)[]>([]);
	let last = $state<string | null>(null);

	$effect(() => {
		if (pillar === null) return;
		shown = pillar;
		last = null;
	});

	$effect(() => {
		const cell = focus;
		if (pillar === null || cell === null) return;
		// After the dialog has taken focus for itself on opening.
		void tick().then(() => requestAnimationFrame(() => fields[cell]?.focus({ preventScroll: true })));
	});

	const name = $derived(chart.data.pillars[shown]?.trim() || `Pillar ${shown + 1}`);
	const written = $derived((chart.data.actions[shown] ?? []).filter((text) => text.trim()).length);

	function keyAt(cellIndex: number): string {
		return cellIndex === 4 ? `p${shown}` : actionKey(shown, idx(cellIndex));
	}

	function close(): void {
		pillar = null;
	}

	function openEditor(): void {
		const key = last ?? `p${shown}`;
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
			{@const key = keyAt(cellIndex)}
			{@const meta = cellIndex === 4 ? undefined : chart.data.meta?.[idAt(chart.data, shown, idx(cellIndex))]}
			<textarea
				bind:this={fields[cellIndex]}
				class={cn(
					'field m-0 aspect-square w-full min-w-0 resize-none self-start border-0 p-2 font-sans text-[15px] leading-[1.25] text-pretty text-text placeholder:text-muted placeholder:opacity-75 motion-safe:transition-[box-shadow] motion-safe:duration-150 focus:shadow-[0_0_0_2px_var(--accent)] focus:outline-none coarse:focus:text-base',
					cellIndex === 4
						? 'pillar-cell rounded-[28%] text-center font-semibold text-on-p placeholder:text-on-p placeholder:opacity-60'
						: 'pillar-action rounded-[16px]',
					meta?.kind === 'milestone' && meta.done && 'text-muted line-through'
				)}
				maxlength={TEXT_MAX}
				rows="1"
				autocapitalize="sentences"
				aria-label={cellIndex === 4 ? `Pillar ${shown + 1}` : `Action ${idx(cellIndex) + 1}`}
				placeholder={cellIndex === 4 ? 'Name this pillar' : `Action ${idx(cellIndex) + 1}`}
				value={chart.textOf(key)}
				data-fit={chart.textOf(key)}
				{@attach fitCellField}
				onfocus={() => (last = key)}
				onblur={() => chart.settle()}
				onkeydown={(event) => {
					if (event.key !== 'Enter' || event.shiftKey) return;
					event.preventDefault();
					fields[(cellIndex + 1) % 9]?.focus();
				}}
				oninput={(event) => chart.setText(key, event.currentTarget.value)}
			></textarea>
		{/each}
	</div>
	{#snippet footer()}
		<div class="me-auto flex">
			<IconButton icon="chevron-left" label="Previous pillar" onclick={() => step(-1)} />
			<IconButton icon="chevron-right" label="Next pillar" onclick={() => step(1)} />
		</div>
		<Button variant="soft" icon="edit" onclick={openEditor}>Open in the editor</Button>
	{/snippet}
</Dialog>
