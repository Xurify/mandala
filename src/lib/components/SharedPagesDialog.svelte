<script lang="ts">
	import { chart } from '$lib/chart/chart.svelte';
	import { formatAgo, type SharedPage } from '$lib/chart/library';
	import { shareUrl } from '$lib/chart/sync/publish';
	import Button from './ui/Button.svelte';
	import Dialog from './ui/Dialog.svelte';
	import BouncingDots from './ui/BouncingDots.svelte';

	interface Props {
		open?: boolean;
	}

	let { open = $bindable(false) }: Props = $props();

	let stopping = $state<string | null>(null);
	let now = $state(Date.now());

	$effect(() => {
		if (!open) return;
		now = Date.now();
		const timer = setInterval(() => (now = Date.now()), 30_000);
		return () => clearInterval(timer);
	});

	function detail(page: SharedPage, at: number): string {
		const parts = [`Updated ${formatAgo(page.share.updatedAt, at)}`];
		if (page.share.auto) parts.push('keeps up to date');
		if (page.deletedAt !== undefined) parts.unshift('Chart deleted');
		return parts.join(' · ');
	}

	async function copy(id: string): Promise<void> {
		try {
			await navigator.clipboard.writeText(shareUrl(id));
			chart.say('Link copied.');
		} catch {
			chart.say('Could not copy the link here.');
		}
	}

	async function stop(chartId: string, title: string): Promise<void> {
		stopping = chartId;
		try {
			await chart.stopSharingChart(chartId);
			chart.say(`Stopped sharing “${title}”. The link no longer works.`);
		} catch (error) {
			chart.say(error instanceof Error ? error.message : 'Could not stop sharing.');
		} finally {
			stopping = null;
		}
	}
</script>

<Dialog bind:open title="Shared pages" size="sm">
	{#if chart.shares.length === 0}
		<p class="m-0 text-[0.95rem] leading-[1.5] text-pretty">
			Nothing is published. A share page, from Export, shows the latest version of one chart to anyone with its link, and
			waits here so you can stop it.
		</p>
	{:else}
		<p class="m-0 mb-4 text-[0.92rem] leading-[1.5] text-pretty text-muted">
			Anyone with a link sees that chart's plan, never your days. Stopping a page takes it down for everyone.
		</p>
		<ul class="m-0 flex list-none flex-col gap-1.5 p-0">
			{#each chart.shares as page (page.share.id)}
				<li class="flex flex-wrap items-center gap-x-3 gap-y-1.5 rounded-[18px] bg-sunken py-2 ps-4 pe-2">
					<div class="flex min-w-[12rem] flex-1 flex-col gap-0.5">
						<span class="truncate text-[0.92rem] leading-snug font-[560]">{page.title}</span>
						<span class="truncate text-[0.8rem] text-muted tabular-nums">{detail(page, now)}</span>
						<a
							class="truncate text-[0.78rem] text-muted underline decoration-ink/30 hover:text-text"
							href="/s/{page.share.id}"
							target="_blank"
							rel="noreferrer">{shareUrl(page.share.id)}</a
						>
					</div>
					<div class="ms-auto flex shrink-0 items-center gap-1.5">
						<Button variant="soft" size="sm" onclick={() => copy(page.share.id)} aria-label="Copy the link to {page.title}">Copy link</Button>
						<Button
							variant="danger"
							size="sm"
							disabled={stopping !== null}
							onclick={() => stop(page.chartId, page.title)}
							aria-label="Stop sharing {page.title}"
						>
							{#if stopping === page.chartId}<span class="inline-flex items-center">Stopping<BouncingDots /></span>{:else}Stop{/if}
						</Button>
					</div>
				</li>
			{/each}
		</ul>
	{/if}
</Dialog>
