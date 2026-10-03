<script lang="ts">
	import { chart } from '$lib/chart/chart.svelte';
	import { fetchShare, publishChart, secretFor, shareUrl, unpublishChart } from '$lib/chart/sync/publish';
	import { filledCount } from '$lib/chart/model';
	import Button from '$lib/components/ui/Button.svelte';
	import Card from '$lib/components/ui/Card.svelte';
	import Eyebrow from '$lib/components/ui/Eyebrow.svelte';
	import Notice from '$lib/components/ui/Notice.svelte';

	// Dev-only harness for the two sync surfaces. Device sync needs the API's
	// database: set TURSO_DATABASE_URL (a file: URL works locally). Publishing
	// uses the same routes. This page is scaffolding — the app doesn't offer
	// sync in its UI yet.
	let room = $state(`dev-${Math.random().toString(36).slice(2, 7)}`);
	let lastSyncedGoal = $state('');

	let shareId = $state('');
	let shareMessage = $state('');
	let fetchedGoal = $state('');

	const statusLabel: Record<string, string> = {
		off: 'Off',
		syncing: 'Syncing…',
		synced: 'Synced',
		error: 'Error — check the server logs'
	};

	async function enable(): Promise<void> {
		chart.enableSync(room.trim() || 'default-dev-key');
		await chart.pullSync();
		lastSyncedGoal = chart.data.goal;
	}

	async function push(): Promise<void> {
		await chart.pushSync();
		lastSyncedGoal = chart.data.goal;
	}

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

<div class="mx-auto flex max-w-[820px] flex-col gap-6 px-7 pt-8 pb-40">
	<header class="flex flex-col gap-3">
		<Eyebrow>Prototype</Eyebrow>
		<h1 class="m-0 font-serif text-[clamp(1.9rem,4vw,2.8rem)] font-[480] tracking-tight text-balance">
			Sync harness
		</h1>
		<p class="m-0 max-w-[62ch] text-pretty text-muted">
			Two surfaces, one table. Device sync keeps your charts in step across
			your own devices; publishing gives a read-only link that serves the
			latest version of one chart.
		</p>
	</header>

	<Notice>
		Whole-chart sync: pull on open, push after edits. Set
		<code>TURSO_DATABASE_URL</code> to a <code>file:</code> URL for local dev.
	</Notice>

	<Card class="flex flex-col gap-4">
		<div class="flex items-center justify-between gap-4">
			<Eyebrow>Device sync</Eyebrow>
			<span class="text-[0.84rem] tabular-nums text-muted">{statusLabel[chart.syncStatus]}</span>
		</div>
		<div class="flex flex-wrap items-end gap-4">
			<label class="flex min-w-[12rem] flex-1 flex-col gap-1.5">
				<span class="text-[0.84rem] font-[560]">Sync key</span>
				<input
					class="h-[42px] w-full rounded-full border-0 bg-sunken px-4 font-sans text-base font-normal text-text motion-safe:transition-[background-color,box-shadow] motion-safe:duration-150 hover:bg-sunken-hover focus:bg-surface focus:shadow-[0_0_0_1.5px_var(--ink)] focus:outline-none"
					type="text"
					autocomplete="off"
					spellcheck="false"
					bind:value={room}
				/>
			</label>
			<Button onclick={enable} icon="link">Sync this chart</Button>
			<Button variant="soft" onclick={push}>Push now</Button>
			{#if chart.syncEnabled}
				<Button variant="ghost" onclick={() => chart.pullSync()}>Pull now</Button>
				<Button variant="ghost" onclick={() => chart.disableSync()}>Turn off</Button>
			{/if}
		</div>
		<p class="m-0 text-[0.84rem] tabular-nums text-muted">
			{#if lastSyncedGoal}Last synced goal “{lastSyncedGoal}”{:else}Not synced yet{/if}
		</p>
	</Card>

	<Card class="flex flex-col gap-4">
		<Eyebrow>Publish a chart</Eyebrow>
		<div class="flex flex-wrap items-end gap-4">
			<Button onclick={publish}>{secretFor(shareId) ? 'Update share' : 'Publish current chart'}</Button>
			{#if shareId}
				<Button variant="ghost" onclick={check}>Check link</Button>
				<Button variant="ghost" onclick={stopSharing}>Stop sharing</Button>
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
