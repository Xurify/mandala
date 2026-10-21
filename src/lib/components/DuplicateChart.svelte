<script lang="ts">
	import { untrack } from 'svelte';
	import { chart } from '$lib/chart/chart.svelte';
	import { hasHistory, historyOf, UNTITLED } from '$lib/chart/library';
	import { TEXT_MAX } from '$lib/chart/model';
	import { formatMinutes } from '$lib/chart/timer';
	import Button from './ui/Button.svelte';
	import Dialog from './ui/Dialog.svelte';
	import { textField } from './ui/styles';

	let { open = $bindable(false) }: { open?: boolean } = $props();

	let name = $state('');
	let withHistory = $state(false);
	let field = $state<HTMLInputElement | null>(null);

	const past = $derived(open && hasHistory(chart.data) ? historyOf(chart.data) : null);
	const detail = $derived.by(() => {
		if (!past) return '';
		const logged = past.minutes > 0 ? `${formatMinutes(past.minutes)} logged` : '';
		if (past.finished === 0 && !logged) return 'The board, reflections, and links already opened.';
		const things = past.finished === 1 ? '1 thing' : `${past.finished} things`;
		const days = past.days === 1 ? '1 day' : `${past.days} days`;
		const line = past.finished === 0 ? logged : `${things} finished on ${days}${logged ? `, ${logged}` : ''}`;
		return `${line}. The calendar would count them twice.`;
	});

	$effect(() => {
		if (!open) return;
		untrack(() => {
			name = chart.data.goal;
			withHistory = false;
		});
		const timer = setTimeout(() => {
			field?.focus();
			field?.select();
		}, 0);
		return () => clearTimeout(timer);
	});

	function duplicate(): void {
		const fresh = past !== null && !withHistory;
		open = false;
		chart.duplicateChart(fresh, name.trim().slice(0, TEXT_MAX));
	}
</script>

<Dialog bind:open title="Duplicate chart" description="A new chart with the same pillars, actions, and shelves." size="sm">
	<form id="duplicate-chart" class="flex flex-col gap-4" onsubmit={(event) => { event.preventDefault(); duplicate(); }}>
		<label class="flex flex-col">
			<span class="sr-only">Goal of the new chart</span>
			<input
				bind:this={field}
				class={textField}
				type="text"
				placeholder={UNTITLED}
				maxlength={TEXT_MAX}
				autocomplete="off"
				spellcheck="false"
				bind:value={name}
			/>
		</label>
		{#if past}
			<label class="flex cursor-pointer items-center justify-between gap-3 px-3.5 text-[0.84rem]">
				<span>
					Include history
					<span class="block text-[0.78rem] leading-[1.35] text-pretty text-muted">{detail}</span>
				</span>
				<input type="checkbox" class="size-4 shrink-0 cursor-pointer" bind:checked={withHistory} />
			</label>
		{/if}
	</form>
	{#snippet footer()}
		<Button variant="ghost" onclick={() => (open = false)}>Cancel</Button>
		<Button type="submit" form="duplicate-chart">Duplicate</Button>
	{/snippet}
</Dialog>
