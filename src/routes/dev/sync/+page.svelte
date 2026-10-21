<script lang="ts">
	import { chart } from '$lib/chart/chart.svelte';
	import { fetchShare, publishChart, secretFor, shareUrl, unpublishChart } from '$lib/chart/sync/publish';
	import { filledCount } from '$lib/chart/model';
	import Wordmark from '$lib/components/Wordmark.svelte';
	import Button from '$lib/components/ui/Button.svelte';
	import Card from '$lib/components/ui/Card.svelte';
	import Eyebrow from '$lib/components/ui/Eyebrow.svelte';
	import Notice from '$lib/components/ui/Notice.svelte';
	import { textField } from '$lib/components/ui/styles';

	// Publishing needs the API's database: set TURSO_DATABASE_URL (a file: URL works locally).
	let shareId = $state('');
	let shareMessage = $state('');
	let fetchedGoal = $state('');

	async function check(): Promise<void> {
		fetchedGoal = '';
		try {
			const share = await fetchShare(shareId);
			fetchedGoal = share.chart
				? `Goal: “${share.chart.goal}” · ${filledCount(share.chart)} filled`
				: 'Not found.';
		} catch (error) {
			fetchedGoal = error instanceof Error ? error.message : 'Fetch failed.';
		}
	}

	async function publish(): Promise<void> {
		shareMessage = '';
		try {
			const existing = secretFor(shareId) ? shareId : null;
			const result = await publishChart(chart.data, existing);
			shareId = result.id;
			shareMessage = 'Published. The link serves the latest version.';
		} catch (error) {
			shareMessage = error instanceof Error ? error.message : 'Publish failed.';
		}
	}

	async function stopSharing(): Promise<void> {
		try {
			await unpublishChart(shareId);
			shareMessage = 'Share removed.';
			shareId = '';
		} catch (error) {
			shareMessage = error instanceof Error ? error.message : 'Could not stop sharing.';
		}
	}
</script>

<svelte:head>
	<title>Sync harness · Mandala</title>
	<meta name="robots" content="noindex" />
</svelte:head>

<div class="page-gutter mx-auto flex max-w-[820px] flex-col gap-6 pb-40">
	<header class="flex flex-col gap-6">
		<Wordmark />
		<div class="flex flex-col gap-3">
			<Eyebrow>Prototype</Eyebrow>
			<h1 class="m-0 font-serif text-[clamp(1.9rem,4vw,2.8rem)] font-[480] tracking-[-0.012em] text-balance">
				Sync harness
			</h1>
			<p class="m-0 max-w-[62ch] text-pretty text-muted">
				Publishing gives a read-only link that serves the latest version of
				one chart.
			</p>
		</div>
	</header>

	<Notice>
		Device sync lives in the app: More actions, then Sync devices. Both need
		<code>TURSO_DATABASE_URL</code>; a <code>file:</code> URL works for local dev.
	</Notice>

	<Card class="flex flex-col gap-4">
		<Eyebrow>Publish a chart</Eyebrow>
		<div class="flex flex-wrap items-end gap-4">
			<Button onclick={publish}>{secretFor(shareId) ? 'Update share' : 'Publish current chart'}</Button>
			{#if shareId}
				<Button variant="ghost" onclick={check}>Check link</Button>
				<Button variant="danger" onclick={stopSharing}>Stop sharing</Button>
			{/if}
		</div>
		{#if shareId}
			<p class="m-0 text-[0.84rem] break-all text-muted">
				<a class="underline" href="/s/{shareId}" target="_blank">{shareUrl(shareId)}</a>
			</p>
		{/if}
		{#if shareMessage}<p class="m-0 text-[0.84rem] text-muted">{shareMessage}</p>{/if}
		{#if fetchedGoal}<p class="m-0 text-[0.84rem] text-muted">{fetchedGoal}</p>{/if}
	</Card>
</div>
