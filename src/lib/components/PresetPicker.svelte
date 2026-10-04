<script lang="ts">
	import { HUES } from '$lib/chart/model';
	import { getPreset, listPresets, type Preset, type PresetId } from '$lib/chart/presets';
	import Button from './ui/Button.svelte';
	import Dialog from './ui/Dialog.svelte';

	interface Props {
		open?: boolean;
		onapply?: (preset: Preset) => void;
	}

	let { open = $bindable(false), onapply }: Props = $props();

	const summaries = listPresets();
	let selectedId = $state<PresetId>('language');
	const selected = $derived(getPreset(selectedId));

	$effect(() => {
		if (open) return;
		selectedId = 'language';
	});

	function applySelected(): void {
		if (selected) onapply?.(selected);
	}
</script>

{#snippet radioPip(checked: boolean)}
	<span
		class="mt-[3px] flex size-4 shrink-0 items-center justify-center rounded-full motion-safe:transition-colors motion-safe:duration-150 {checked
			? 'bg-ink text-on-ink'
			: 'shadow-[inset_0_0_0_1.5px_var(--line)] group-hover:shadow-[inset_0_0_0_1.5px_var(--muted)]'}"
		aria-hidden="true"
	>
		{#if checked}
			<span class="size-1.5 rounded-full bg-surface"></span>
		{/if}
	</span>
{/snippet}

<Dialog
	bind:open
	title="Start from a preset"
	description="Each one fills all 64 cells. Change anything after."
>
	<div class="flex flex-col gap-2.5">
		<fieldset class="m-0 grid min-w-0 grid-cols-2 gap-1.5 border-0 p-0 max-[640px]:grid-cols-1">
			<legend class="sr-only">Choose a preset</legend>
			{#each summaries as summary (summary.id)}
				{@const isChecked = selectedId === summary.id}
				<label
					class="group flex min-w-0 cursor-pointer items-start gap-2.5 rounded-[15px] px-3.5 py-2 motion-safe:transition-[background-color,box-shadow] motion-safe:duration-150 has-focus-visible:outline-2 has-focus-visible:outline-offset-2 has-focus-visible:outline-ink {isChecked
						? 'bg-surface shadow-card'
						: 'bg-sunken hover:bg-sunken-hover'}"
				>
					<input class="sr-only" type="radio" name="preset" value={summary.id} bind:group={selectedId} />
					{@render radioPip(isChecked)}
					<span class="flex min-w-0 flex-col gap-0.5">
						<span class="text-[0.9rem] font-[620] leading-snug text-text">{summary.title}</span>
						<span class="text-[0.78rem] leading-[1.3] text-pretty text-muted">{summary.goal}</span>
					</span>
				</label>
			{/each}
		</fieldset>

		{#if selected}
			<div class="flex flex-col gap-1.5 rounded-[18px] bg-bg px-3.5 py-2.5 ring-1 ring-line/60">
				<div class="flex items-center justify-between">
					<h3 class="m-0 text-[0.7rem] font-semibold tracking-[0.12em] text-muted uppercase">Pillars</h3>
					<span class="text-[0.74rem] text-muted">8 areas</span>
				</div>
				<ol class="m-0 grid list-none grid-cols-2 gap-x-4 gap-y-1 p-0 text-[0.84rem] leading-[1.3] max-[640px]:grid-cols-1">
					{#each selected.pillars as pillar, pillarIndex (pillar)}
						<li class="flex min-w-0 items-center gap-2">
							<span class="pip size-2 shrink-0 rounded-full" style:--pip-h={HUES[pillarIndex]} aria-hidden="true"></span>
							<span class="text-end text-muted tabular-nums">{pillarIndex + 1}.</span>
							<span class="truncate text-text font-medium">{pillar}</span>
						</li>
					{/each}
				</ol>
			</div>
		{/if}
	</div>
	{#snippet footer()}
		<Button variant="ghost" onclick={() => (open = false)}>Cancel</Button>
		<Button onclick={applySelected}>Use this preset</Button>
	{/snippet}
</Dialog>
