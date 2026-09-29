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
	title="Presets"
	description="Each one fills the whole chart. Edit anything after."
	class="max-h-[min(84dvh,740px)]"
>
	<div class="flex flex-col gap-3.5">
		<fieldset class="m-0 grid min-w-0 grid-cols-2 gap-2 border-0 p-0 max-[640px]:grid-cols-1">
			<legend class="sr-only">Choose a preset</legend>
			{#each summaries as summary (summary.id)}
				<label
					class="flex min-w-0 cursor-pointer items-start gap-2.5 rounded-[18px] bg-sunken px-3.5 py-3 motion-safe:transition-[background-color,box-shadow] motion-safe:duration-150 hover:bg-sunken-hover has-checked:bg-surface has-checked:shadow-[0_0_0_2px_var(--ink)] has-focus-visible:outline-2 has-focus-visible:outline-offset-2 has-focus-visible:outline-ink"
				>
					<input class="mt-[3px] shrink-0 accent-ink" type="radio" name="preset" value={summary.id} bind:group={selectedId} />
					<span class="flex min-w-0 flex-col gap-0.5">
						<span class="text-[0.92rem] font-[620]">{summary.title}</span>
						<span class="text-[0.8rem] leading-[1.35] text-pretty text-muted">{summary.goal}</span>
					</span>
				</label>
			{/each}
		</fieldset>
		{#if selected}
			<div class="flex flex-col gap-2.5 rounded-[20px] bg-bg px-[18px] py-4">
				<h3 class="m-0 text-[0.72rem] font-semibold tracking-[0.12em] text-muted uppercase">Pillars</h3>
				<ol class="m-0 grid list-none grid-cols-2 gap-x-4 gap-y-[5px] p-0 text-[0.88rem] leading-[1.4] max-[640px]:grid-cols-1">
					{#each selected.pillars as pillar, pillarIndex (pillar)}
						<li class="grid min-w-0 grid-cols-[1.6em_minmax(0,1fr)] items-baseline gap-x-[0.35em]">
							<span class="text-end text-muted tabular-nums">{pillarIndex + 1}.</span>
							<span>{pillar}</span>
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
