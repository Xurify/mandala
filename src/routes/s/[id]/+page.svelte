<script lang="ts">
	import { page } from '$app/state';
	import { fetchShare } from '$lib/chart/sync/publish';
	import { describe, filledCount, getByKey, type ChartData } from '$lib/chart/model';
	import MandalaGrid from '$lib/components/MandalaGrid.svelte';
	import BrandMark from '$lib/components/BrandMark.svelte';
	import Dialog from '$lib/components/ui/Dialog.svelte';
	import Eyebrow from '$lib/components/ui/Eyebrow.svelte';
	import IconButton from '$lib/components/ui/IconButton.svelte';
	import Notice from '$lib/components/ui/Notice.svelte';

	// Read-only view of a published chart. The link serves the owner's latest
	// pushed snapshot at the moment it opens; visitors can refresh manually.
	const id = $derived(page.params.id ?? '');

	let chartData = $state<ChartData | null>(null);
	let updatedAt = $state<number | null>(null);
	let error = $state('');
	let loading = $state(true);
	let refreshing = $state(false);

	async function load(): Promise<void> {
		if (!id) return;
		try {
			const share = await fetchShare(id);
			if (share.chart) {
				chartData = share.chart;
				updatedAt = share.updatedAt;
				error = '';
			} else {
				error = 'This shared chart is no longer available.';
			}
		} catch {
			error = 'Could not load the shared chart. Check your connection and try again.';
		} finally {
			loading = false;
		}
	}

	// One fetch when the page opens; no polling. Refresh re-runs the same
	// fetch without replacing the chart with a loading flash.
	$effect(() => {
		void id;
		void load();
	});

	async function refresh(): Promise<void> {
		if (refreshing || loading) return;
		refreshing = true;
		try {
			await load();
		} finally {
			refreshing = false;
		}
	}

	const title = $derived(chartData?.goal.trim() || 'A shared chart');

	// Filled cells open in a dialog so clamped text stays readable.
	let expanded = $state<{ label: string; text: string } | null>(null);
	let showExpanded = $state(false);

	function selectCell(blockIndex: number, targetKey?: string, cellIndex?: number): void {
		if (!chartData || !targetKey || cellIndex === undefined) return;
		const text = getByKey(chartData, targetKey).trim();
		if (text === '') return;
		expanded = { label: describe(blockIndex, cellIndex), text };
		showExpanded = true;
	}
</script>

<svelte:head>
	<title>{title} · Mandala</title>
	<meta name="robots" content="noindex" />
	<meta property="og:title" content={title} />
	<meta property="og:description" content="A goal chart shared from Mandala." />
</svelte:head>

<div class="mx-auto flex min-h-dvh max-w-[560px] flex-col gap-6 px-6 pt-8 pb-16">
	<header class="flex items-center justify-between gap-4">
		<a
			href="/"
			class="inline-flex items-center gap-2.5 rounded-lg text-text no-underline transition-[opacity,transform] duration-150 ease-ui hover:opacity-90 active:scale-[0.98] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink"
			aria-label="Mandala home"
		>
			<BrandMark />
			<span class="font-serif text-[1.25rem] font-[560]">Mandala</span>
		</a>
		<div class="flex items-center gap-1">
			<Eyebrow>Shared chart</Eyebrow>
			<IconButton
				icon="refresh"
				label="Refresh"
				onclick={refresh}
				disabled={refreshing || loading}
				class={refreshing ? 'motion-safe:[&>svg]:animate-spin' : ''}
			/>
		</div>
	</header>

	{#if loading}
		<p class="m-0 text-muted" role="status">Loading…</p>
	{:else if error}
		<Notice>{error}</Notice>
	{:else if chartData}
		<div class="flex flex-col gap-2">
			<h1 class="m-0 font-serif text-[clamp(1.6rem,4vw,2.2rem)] font-[480] tracking-tight text-balance">
				{chartData.goal.trim() || 'Untitled chart'}
			</h1>
			<p class="m-0 text-[0.9rem] text-muted">
				{filledCount(chartData)} filled cells
				{#if updatedAt !== null}
					· updated {new Date(updatedAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
				{/if}
			</p>
		</div>

		<MandalaGrid mode="view" source={chartData} onSelect={selectCell} />

		{#if expanded}
			<Dialog bind:open={showExpanded} title={expanded.label} size="sm">
				<p class="m-0 font-serif text-[1.25rem] leading-[1.35] text-pretty">{expanded.text}</p>
			</Dialog>
		{/if}

		<p class="m-0 max-w-[62ch] text-pretty text-[0.9rem] text-muted">
			A read-only snapshot of {chartData.goal.trim() ? 'their' : 'the'} chart, published by the owner.
			<a class="underline" href="/">Make your own</a> — it's local-first and free.
		</p>
	{/if}
</div>
