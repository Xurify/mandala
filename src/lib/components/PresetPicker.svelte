<script lang="ts">
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

<Dialog
	bind:open
	title="Start from a preset"
	description="Each one fills all 64 cells. Change anything after."
>
	<div class="flex flex-col gap-3">
		<fieldset class="m-0 grid min-w-0 grid-cols-2 gap-1.5 border-0 p-0 max-[640px]:grid-cols-1">
			<legend class="sr-only">Choose a preset</legend>
			{#each summaries as summary (summary.id)}
				<label
					class="flex min-w-0 cursor-pointer items-start gap-2.5 rounded-[16px] bg-sunken px-3.5 py-2.5 motion-safe:transition-[background-color,box-shadow] motion-safe:duration-150 hover:bg-sunken-hover has-checked:bg-surface has-checked:shadow-[0_0_0_2px_var(--ink)] has-focus-visible:outline-2 has-focus-visible:outline-offset-2 has-focus-visible:outline-ink"
				>
					<input class="mt-[3px] shrink-0 accent-ink" type="radio" name="preset" value={summary.id} bind:group={selectedId} />
					<span class="flex min-w-0 flex-col gap-0.5">
						<span class="text-[0.9rem] font-[620] leading-snug">{summary.title}</span>
						<span class="text-[0.78rem] leading-[1.3] text-pretty text-muted">{summary.goal}</span>
					</span>
				</label>
			{/each}
		</fieldset>

		{#if selected}
			<div class="flex flex-col gap-2 rounded-[18px] bg-sunken px-4 py-3">
				<h3 class="m-0 text-[0.7rem] font-semibold tracking-[0.12em] text-muted uppercase">Pillars</h3>
				<ol class="m-0 grid list-none grid-cols-2 gap-x-4 gap-y-1 p-0 text-[0.84rem] leading-[1.35] max-[640px]:grid-cols-1">
					{#each selected.pillars as pillar, pillarIndex (pillar)}
						<li class="grid min-w-0 grid-cols-[1.5em_minmax(0,1fr)] items-baseline gap-x-[0.3em]">
							<span class="text-end text-muted tabular-nums">{pillarIndex + 1}.</span>
							<span class="truncate">{pillar}</span>
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
