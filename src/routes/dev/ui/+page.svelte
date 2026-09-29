<script lang="ts">
	import { chart } from '$lib/chart/chart.svelte';
	import BrandMark from '$lib/components/BrandMark.svelte';
	import Button from '$lib/components/ui/Button.svelte';
	import Card from '$lib/components/ui/Card.svelte';
	import Dialog from '$lib/components/ui/Dialog.svelte';
	import Dock from '$lib/components/ui/Dock.svelte';
	import DockTab from '$lib/components/ui/DockTab.svelte';
	import Eyebrow from '$lib/components/ui/Eyebrow.svelte';
	import IconButton from '$lib/components/ui/IconButton.svelte';
	import Menu from '$lib/components/ui/Menu.svelte';
	import MenuDivider from '$lib/components/ui/MenuDivider.svelte';
	import MenuItem from '$lib/components/ui/MenuItem.svelte';
	import Notice from '$lib/components/ui/Notice.svelte';
	import SegmentedControl from '$lib/components/ui/SegmentedControl.svelte';

	const themes = [
		{ value: 'system', label: 'Auto', icon: 'monitor' as const },
		{ value: 'light', label: 'Light', icon: 'sun' as const },
		{ value: 'dark', label: 'Dark', icon: 'moon' as const }
	];

	const scales = [
		{ value: 'fit', label: 'Fit', icon: 'minimize' as const },
		{ value: 'large', label: 'Large', icon: 'maximize' as const }
	];

	let scale = $state('fit');
	let view = $state('edit');
	let dialogOpen = $state(false);

	function setTheme(next: string): void {
		if (next === 'system' || next === 'light' || next === 'dark') chart.setTheme(next);
	}

</script>

<svelte:head>
	<title>UI primitives · Mandala</title>
	<meta name="robots" content="noindex" />
</svelte:head>

<div class="mx-auto flex max-w-[1180px] flex-col gap-8 px-7 pt-8 pb-40">
	<header class="flex flex-wrap items-end justify-between gap-6">
		<div class="flex max-w-[62ch] flex-col gap-3">
			<a href="/" class="inline-flex items-center gap-2.5 text-text no-underline">
				<BrandMark />
				<span class="font-serif text-[1.25rem] font-[560]">Mandala</span>
			</a>
			<div>
				<Eyebrow>Design system</Eyebrow>
				<h1 class="m-0 mt-2 font-serif text-[clamp(1.9rem,4vw,2.8rem)] font-[480] tracking-tight text-balance">
					UI primitives
				</h1>
			</div>
			<p class="m-0 text-pretty text-muted">
				Every variant, on the same tokens as the app. Product screens still get one primary action.
				Delete this route when you don't want the catalog.
			</p>
		</div>
		<SegmentedControl
			label="Color theme"
			size="sm"
			options={themes}
			value={chart.theme}
			onchange={setTheme}
		/>
	</header>

	<Card class="flex flex-col gap-4">
		<Eyebrow>Button</Eyebrow>
		<div class="flex flex-wrap items-center gap-3">
			<Button icon="list">Start from a preset</Button>
			<Button variant="soft" icon="sparkles">Get a prompt</Button>
			<Button variant="ghost" icon="info">How it works</Button>
		</div>
		<div class="flex flex-wrap items-center gap-3">
			<Button size="sm">Use this chart</Button>
			<Button size="sm" variant="soft">Cancel</Button>
			<Button size="sm" variant="ghost">Not now</Button>
		</div>
	</Card>

	<Card class="flex flex-col gap-4">
		<Eyebrow>Icon button</Eyebrow>
		<div class="flex items-center gap-2">
			<IconButton icon="close" label="Close" />
			<IconButton icon="more" label="More actions" />
			<Menu align="start" label="More actions">
				<MenuItem icon="printer" badge="Ctrl+P" onclick={() => chart.say('Printed')}>
					Print chart
				</MenuItem>
				<MenuItem icon="image" badge=".png" onclick={() => chart.say('Poster exported')}>
					Export poster
				</MenuItem>
				<MenuDivider />
				<MenuItem icon="trash" tone="danger" onclick={() => (dialogOpen = true)}>
					Clear chart
				</MenuItem>
			</Menu>
		</div>
	</Card>

	<Card class="flex flex-col gap-4">
		<Eyebrow>Segmented control</Eyebrow>
		<SegmentedControl label="Chart scale" options={scales} bind:value={scale} />
	</Card>

	<Card class="flex flex-col gap-4">
		<Eyebrow>Notice</Eyebrow>
		<Notice>
			Handwriting is ready to read.
			{#snippet action()}
				<Button size="sm" onclick={() => chart.say('Read started')}>Read</Button>
			{/snippet}
		</Notice>
	</Card>

	<Card class="flex flex-col gap-4">
		<Eyebrow pip="goal">Center goal</Eyebrow>
		<Eyebrow pip={0}>Pillar 1 · top left</Eyebrow>
		<Eyebrow pip={4}>Pillar 5 · right</Eyebrow>
		<p class="m-0 max-w-[62ch] text-pretty text-muted">
			Eyebrows stay sans, uppercase, and quiet. The pip uses the pillar hue. The goal pip is ink.
		</p>
	</Card>

	<Card class="flex flex-wrap items-center gap-3">
		<Button variant="soft" onclick={() => (dialogOpen = true)}>Open a dialog</Button>
		<Button variant="ghost" onclick={() => chart.say('Copied as text')}>Show a toast</Button>
	</Card>
</div>

<Dialog bind:open={dialogOpen} title="Clear this chart?" size="sm">
	<p class="m-0 text-muted">The goal, pillars, and actions on this chart go away. This stays on this device.</p>
	{#snippet footer()}
		<Button variant="ghost" onclick={() => (dialogOpen = false)}>Cancel</Button>
		<Button
			onclick={() => {
				dialogOpen = false;
				chart.say('Chart cleared');
			}}>Clear chart</Button
		>
	{/snippet}
</Dialog>

<Dock label="Layout view mode">
	<DockTab icon="grid" selected={view === 'view'} onclick={() => (view = 'view')}>Chart</DockTab>
	<DockTab icon="edit" selected={view === 'edit'} onclick={() => (view = 'edit')}>Edit</DockTab>
	<DockTab icon="columns" selected={view === 'split'} onclick={() => (view = 'split')}>Split</DockTab>
</Dock>
