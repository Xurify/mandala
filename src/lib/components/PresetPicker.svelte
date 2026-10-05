<script lang="ts">
	import { HUES, idx } from '$lib/chart/model';
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
	let visibleId = $state<PresetId>('language');
	let dim = $state(false);
	let swap = 0;
	const selected = $derived(getPreset(selectedId));
	const shown = $derived(getPreset(visibleId));

	$effect(() => {
		if (open) return;
		selectedId = 'language';
	});

	// Swap the names once they have faded, so the cells stay put.
	$effect(() => {
		const next = selectedId;
		if (!open) {
			visibleId = 'language';
			dim = false;
			return;
		}
		if (next === visibleId) return;
		if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
			visibleId = next;
			dim = false;
			return;
		}
		const generation = ++swap;
		dim = true;
		const timeout = window.setTimeout(() => {
			visibleId = next;
			requestAnimationFrame(() => {
				if (generation !== swap) return;
				dim = false;
			});
		}, 200);
		return () => window.clearTimeout(timeout);
	});

	function applySelected(): void {
		if (selected) onapply?.(selected);
	}
</script>

{#snippet fadingName(label: string)}
	<span
		class="block max-w-full text-balance motion-safe:transition-opacity motion-safe:duration-200 motion-safe:ease-ui {dim
			? 'opacity-0'
			: 'opacity-100'}"
	>
		{label}
	</span>
{/snippet}

{#snippet radioPip(checked: boolean)}
	<span
		class="mt-[3px] flex size-4 shrink-0 items-center justify-center rounded-full motion-safe:transition-colors motion-safe:duration-150 {checked
			? 'bg-accent text-on-accent'
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
		<fieldset class="m-0 grid min-w-0 grid-cols-2 gap-1.5 rounded-[22px] border-0 bg-sunken p-1.5 max-[640px]:grid-cols-1">
			<legend class="sr-only">Choose a preset</legend>
			{#each summaries as summary (summary.id)}
				{@const isChecked = selectedId === summary.id}
				<label
					class="group flex min-w-0 cursor-pointer items-start gap-2.5 rounded-[16px] px-3 py-2.5 motion-safe:transition-[scale] motion-safe:duration-150 motion-safe:ease-ui active:scale-[0.98] has-focus-visible:outline-2 has-focus-visible:outline-offset-2 has-focus-visible:outline-ink {isChecked
						? 'bg-surface shadow-seg'
						: 'hover:bg-sunken-hover'}"
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

		{#if shown}
			<div class="rounded-[22px] bg-bg p-2">
				<div
					class="mx-auto grid w-full max-w-[30rem] grid-cols-3 gap-[5px]"
					role="group"
					aria-label="{shown.title} pillars"
				>
					{#each [0, 1, 2, 3, 4, 5, 6, 7, 8] as slot (slot)}
						{#if slot === 4}
							<div
								class="flex h-12 items-center justify-center overflow-hidden rounded-[11px] bg-goal px-2 text-center font-serif text-[0.84rem] leading-[1.15] font-[560] tracking-[-0.01em] text-balance text-goal-fg"
							>
								{@render fadingName(shown.title)}
							</div>
						{:else}
							{@const k = idx(slot)}
							<div
								class="pillar-cell flex h-12 items-center justify-center overflow-hidden rounded-[11px] px-2 text-center text-[0.78rem] leading-[1.15] font-[620] tracking-[-0.011em] text-balance text-on-p"
								style:--h={HUES[k]}
							>
								{@render fadingName(shown.pillars[k] ?? '')}
							</div>
						{/if}
					{/each}
				</div>
			</div>
		{/if}
	</div>
	{#snippet footer()}
		<Button variant="ghost" onclick={() => (open = false)}>Cancel</Button>
		<Button onclick={applySelected}>Use this preset</Button>
	{/snippet}
</Dialog>
