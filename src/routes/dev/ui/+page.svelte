<script lang="ts">
	import { exampleChart } from '$lib/chart/example';
	import { chart } from '$lib/chart/chart.svelte';
	import { HUES, POS } from '$lib/chart/model';
	import Wordmark from '$lib/components/Wordmark.svelte';
	import BrandMark from '$lib/components/BrandMark.svelte';
	import CommandPalette, { type CommandItem } from '$lib/components/CommandPalette.svelte';
	import DaySeal from '$lib/components/DaySeal.svelte';
	import Icon, { type IconName } from '$lib/components/Icon.svelte';
	import MandalaGrid from '$lib/components/MandalaGrid.svelte';
	import ProgressRing from '$lib/components/ProgressRing.svelte';
	import ShortcutsDialog from '$lib/components/ShortcutsDialog.svelte';
	import Button from '$lib/components/ui/Button.svelte';
	import BouncingDots from '$lib/components/ui/BouncingDots.svelte';
	import Card from '$lib/components/ui/Card.svelte';
	import { cn } from '$lib/components/ui/cn';
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
	import Select from '$lib/components/ui/Select.svelte';
	import { dock, fieldInk, menu, textArea, textField } from '$lib/components/ui/styles';
	import ToastLab from './ToastLab.svelte';

	const themes = [
		{ value: 'system', label: 'Auto', icon: 'monitor' as const },
		{ value: 'light', label: 'Light', icon: 'sun' as const },
		{ value: 'dark', label: 'Dark', icon: 'moon' as const }
	];

	const scales = [
		{ value: 'fit', label: 'Fit', icon: 'minimize' as const },
		{ value: 'large', label: 'Large', icon: 'maximize' as const }
	];

	const actionKinds = [
		{ value: 'standard', label: 'Standard' },
		{ value: 'routine', label: 'Routine' },
		{ value: 'milestone', label: 'Milestone' }
	];

	const iconSet = {
		search: true,
		close: true,
		'chevron-down': true,
		'chevron-left': true,
		'chevron-right': true,
		'arrow-right': true,
		'arrow-left': true,
		target: true,
		grid: true,
		edit: true,
		type: true,
		printer: true,
		image: true,
		download: true,
		upload: true,
		copy: true,
		'file-text': true,
		clipboard: true,
		trash: true,
		sparkles: true,
		undo: true,
		sun: true,
		moon: true,
		monitor: true,
		check: true,
		compass: true,
		list: true,
		eye: true,
		columns: true,
		maximize: true,
		minimize: true,
		info: true,
		more: true,
		calendar: true,
		pin: true,
		link: true,
		refresh: true,
		folder: true,
		command: true,
		keyboard: true,
		clock: true,
		plus: true
	} satisfies Record<IconName, true>;

	const iconNames = Object.keys(iconSet) as IconName[];

	const surfaces = [
		{ name: 'bg', swatch: 'bg-bg' },
		{ name: 'surface', swatch: 'bg-surface' },
		{ name: 'sunken', swatch: 'bg-sunken' },
		{ name: 'sunken-hover', swatch: 'bg-sunken-hover' },
		{ name: 'soft', swatch: 'bg-soft' },
		{ name: 'soft-hover', swatch: 'bg-soft-hover' },
		{ name: 'ink', swatch: 'bg-ink' },
		{ name: 'ink-hover', swatch: 'bg-ink-hover' },
		{ name: 'on-ink', swatch: 'bg-on-ink' },
		{ name: 'accent', swatch: 'bg-accent' },
		{ name: 'accent-hover', swatch: 'bg-accent-hover' },
		{ name: 'on-accent', swatch: 'bg-on-accent' },
		{ name: 'text', swatch: 'bg-text' },
		{ name: 'muted', swatch: 'bg-muted' },
		{ name: 'line', swatch: 'bg-line' },
		{ name: 'success', swatch: 'bg-success' },
		{ name: 'danger', swatch: 'bg-danger' },
		{ name: 'danger-wash', swatch: 'bg-danger-wash' },
		{ name: 'goal', swatch: 'bg-goal' }
	];

	type AccentStop = { accent: string; hover: string; fg?: string };

	type AccentOption = {
		id: string;
		name: string;
		note: string;
		group: string;
		light: AccentStop;
		dark: AccentStop;
		applied?: boolean;
		css?: string;
	};

	const accentOptions: AccentOption[] = [
		{
			id: 'coffee',
			name: 'Coffee',
			group: 'Brown',
			note: 'Hue 80, 20° from the gold pillar. Deepest brown.',
			light: { accent: 'oklch(0.38 0.073 80)', hover: 'oklch(0.44 0.079 80)' },
			dark: { accent: 'oklch(0.52 0.068 80)', hover: 'oklch(0.54 0.068 80)' }
		},
		{
			id: 'walnut',
			name: 'Walnut',
			group: 'Brown',
			note: 'Same hue, more color. Reads as wood.',
			light: { accent: 'oklch(0.42 0.08 80)', hover: 'oklch(0.48 0.086 80)' },
			dark: { accent: 'oklch(0.52 0.075 80)', hover: 'oklch(0.54 0.075 80)' }
		},
		{
			id: 'taupe',
			name: 'Taupe',
			group: 'Brown',
			note: 'Same hue, quieter. The sand brown.',
			light: { accent: 'oklch(0.42 0.054 80)', hover: 'oklch(0.48 0.058 80)' },
			dark: { accent: 'oklch(0.52 0.049 80)', hover: 'oklch(0.54 0.049 80)' }
		},
		{
			id: 'bark',
			name: 'Bark',
			group: 'Brown',
			note: 'Lighter brown. Cream label still clears.',
			light: { accent: 'oklch(0.46 0.059 80)', hover: 'oklch(0.52 0.064 80)' },
			dark: { accent: 'oklch(0.52 0.054 80)', hover: 'oklch(0.54 0.054 80)' }
		},
		{
			id: 'honey',
			name: 'Honey',
			group: 'Brown',
			note: 'Brightest brown. Closest in feel to the gold pillar.',
			light: { accent: 'oklch(0.48 0.092 80)', hover: 'oklch(0.54 0.099 80)' },
			dark: { accent: 'oklch(0.52 0.087 80)', hover: 'oklch(0.54 0.087 80)' }
		},
		{
			id: 'khaki',
			name: 'Khaki',
			group: 'Brown',
			note: 'Hue 84, 16° from the yellow-green pillar. Brown toward sap.',
			light: { accent: 'oklch(0.42 0.079 84)', hover: 'oklch(0.48 0.085 84)' },
			dark: { accent: 'oklch(0.52 0.074 84)', hover: 'oklch(0.54 0.074 84)' }
		},
		{
			id: 'sap',
			name: 'Sap',
			group: 'Green',
			note: 'Hue 125, 25° from the yellow-green pillar. Sat best last round.',
			light: { accent: 'oklch(0.42 0.09 125)', hover: 'oklch(0.48 0.1 125)' },
			dark: { accent: 'oklch(0.53 0.07 125)', hover: 'oklch(0.55 0.07 125)' }
		},
		{
			id: 'sap-deep',
			name: 'Deep sap',
			group: 'Green',
			note: 'Same hue as sap, darker.',
			light: { accent: 'oklch(0.38 0.088 125)', hover: 'oklch(0.44 0.095 125)' },
			dark: { accent: 'oklch(0.51 0.083 125)', hover: 'oklch(0.53 0.083 125)' }
		},
		{
			id: 'moss',
			name: 'Moss',
			group: 'Green',
			note: 'Hue 118, 18° from the yellow-green pillar.',
			light: { accent: 'oklch(0.38 0.082 118)', hover: 'oklch(0.44 0.089 118)' },
			dark: { accent: 'oklch(0.51 0.077 118)', hover: 'oklch(0.53 0.077 118)' }
		},
		{
			id: 'olive',
			name: 'Olive',
			group: 'Green',
			note: 'Hue 122, 22° from the yellow-green pillar.',
			light: { accent: 'oklch(0.42 0.094 122)', hover: 'oklch(0.48 0.102 122)' },
			dark: { accent: 'oklch(0.51 0.089 122)', hover: 'oklch(0.53 0.089 122)' }
		},
		{
			id: 'grove',
			name: 'Grove',
			group: 'Green',
			note: 'Hue 116, 16° from the yellow-green pillar. Gray olive.',
			light: { accent: 'oklch(0.42 0.06 116)', hover: 'oklch(0.48 0.065 116)' },
			dark: { accent: 'oklch(0.51 0.055 116)', hover: 'oklch(0.53 0.055 116)' }
		},
		{
			id: 'fern',
			name: 'Fern',
			group: 'Green',
			note: 'Hue 128, 22° from the green pillar. Darker than leaf.',
			light: { accent: 'oklch(0.38 0.092 128)', hover: 'oklch(0.44 0.099 128)' },
			dark: { accent: 'oklch(0.51 0.087 128)', hover: 'oklch(0.53 0.087 128)' }
		},
		{
			id: 'leaf',
			name: 'Leaf',
			group: 'Green',
			note: 'Hue 132, 18° from the green pillar. Brightest green.',
			light: { accent: 'oklch(0.48 0.123 132)', hover: 'oklch(0.54 0.133 132)' },
			dark: { accent: 'oklch(0.51 0.118 132)', hover: 'oklch(0.53 0.118 132)' }
		},
		{
			id: 'field',
			name: 'Field',
			group: 'Green',
			note: 'Sap’s hue, lighter. More leaf than moss.',
			light: { accent: 'oklch(0.48 0.111 125)', hover: 'oklch(0.54 0.12 125)' },
			dark: { accent: 'oklch(0.51 0.106 125)', hover: 'oklch(0.53 0.106 125)' }
		},
		{
			id: 'pine',
			name: 'Pine',
			group: 'Teal',
			note: 'Hue 166, 16° from the green pillar. Deeper teal.',
			light: { accent: 'oklch(0.38 0.073 166)', hover: 'oklch(0.44 0.079 166)' },
			dark: { accent: 'oklch(0.51 0.068 166)', hover: 'oklch(0.53 0.068 166)' }
		},
		{
			id: 'creek',
			name: 'Creek',
			group: 'Teal',
			note: 'Hue 168, 18° from the green pillar.',
			light: { accent: 'oklch(0.42 0.078 168)', hover: 'oklch(0.48 0.084 168)' },
			dark: { accent: 'oklch(0.51 0.073 168)', hover: 'oklch(0.53 0.073 168)' }
		},
		{
			id: 'tide',
			name: 'Tide',
			group: 'Teal',
			note: 'Hue 170, 20° from the green pillar. Teal light enough to see.',
			light: { accent: 'oklch(0.48 0.088 170)', hover: 'oklch(0.54 0.095 170)' },
			dark: { accent: 'oklch(0.51 0.083 170)', hover: 'oklch(0.53 0.083 170)' }
		},
		{
			id: 'teal',
			name: 'Teal',
			group: 'Teal',
			note: 'Hue 172, 22° from the green pillar.',
			light: { accent: 'oklch(0.4 0.075 172)', hover: 'oklch(0.46 0.078 172)' },
			dark: { accent: 'oklch(0.52 0.06 172)', hover: 'oklch(0.54 0.065 172)' }
		},
		{
			id: 'ink',
			name: 'Ink',
			group: 'In the app',
			note: 'What main uses. The accent is the ink token.',
			light: { accent: 'oklch(0.24 0.012 60)', hover: 'oklch(0.33 0.014 60)' },
			dark: {
				accent: 'oklch(0.95 0.008 85)',
				hover: 'oklch(0.88 0.01 85)',
				fg: 'oklch(0.2 0.01 65)'
			},
			applied: true,
			css: ['--accent: var(--ink);', '--accent-hover: var(--ink-hover);', '--on-accent: var(--on-ink);'].join('\n')
		}
	];

	const accentGroups = [...new Set(accentOptions.map((option) => option.group))];

	function accentCss(option: AccentOption): string {
		if (option.css) return option.css;
		return [
			'/* :root */',
			`--accent: ${option.light.accent};`,
			`--accent-hover: ${option.light.hover};`,
			'',
			'/* both dark blocks in src/app.css */',
			`--accent: ${option.dark.accent};`,
			`--accent-hover: ${option.dark.hover};`
		].join('\n');
	}

	const catalog = [
		['type', 'Type'],
		['surfaces', 'Surfaces'],
		['accent', 'Accent'],
		['buttons', 'Buttons'],
		['icon-buttons', 'Icon buttons'],
		['fields', 'Fields'],
		['segmented', 'Segmented'],
		['menus', 'Menus'],
		['dialogs', 'Dialogs'],
		['feedback', 'Feedback'],
		['toasts', 'Toasts'],
		['brand', 'Brand'],
		['chart', 'Chart'],
		['icons', 'Icons']
	] as const;

	const field = textField;

	const link =
		'cursor-pointer self-start border-0 bg-transparent px-0.5 py-1 font-sans text-[0.88rem] font-[560] text-text underline decoration-line underline-offset-4 hover:decoration-text focus-visible:rounded focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink';

	const cell =
		'cell relative flex aspect-square min-w-0 cursor-pointer items-center justify-center overflow-hidden border-0 px-1 text-center font-sans text-[13px] leading-[1.2] focus-visible:z-[1] focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-ink';

	const sample = exampleChart();
	const menuPanel = menu({ align: 'start' }).panel();
	const dockBar = dock().bar();

	const commands: CommandItem[] = [
		{
			id: 'print',
			label: 'Print chart',
			section: 'Actions',
			icon: 'printer',
			hint: 'Ctrl+P',
			run: () => chart.say('Printed')
		},
		{
			id: 'export',
			label: 'Export poster',
			section: 'Actions',
			icon: 'image',
			hint: '.png',
			run: () => chart.say('Poster exported')
		},
		{
			id: 'clear',
			label: 'Clear chart',
			section: 'Actions',
			icon: 'trash',
			tone: 'danger',
			run: () => chart.say('Chart cleared')
		},
		{
			id: 'health',
			label: 'Health',
			section: 'Your chart',
			icon: 'target',
			hint: 'Pillar',
			run: () => chart.say('Opened Health')
		}
	];

	let scale = $state('fit');
	let kind = $state('routine');
	let view = $state('edit');
	let dockView = $state('edit');
	let dialogOpen = $state(false);
	let guideOpen = $state(false);
	let shortcutsOpen = $state(false);
	let paletteOpen = $state(false);
	let pinned = $state(true);
	let pickedModel = $state('qwen3');
	const modelChoices = [
		{ value: 'qwen15', label: 'Qwen2.5 1.5B' },
		{ value: 'qwen17', label: 'Qwen3 1.7B' },
		{ value: 'qwen3', label: 'Qwen3 4B' },
		{ value: 'qwen3t', label: 'Qwen3 4B, thinking' }
	];

	let name = $state('Morning chart');
	let query = $state('walk');
	let reply = $state('');
	let keepUpdated = $state(true);
	let preset = $state('health');
	let sealPlay = $state(0);
	let accentId = $state('sap');
	let copiedId = $state('');
	let copyTimer = 0;

	function setTheme(next: string): void {
		if (next === 'system' || next === 'light' || next === 'dark') chart.setTheme(next);
	}

	$effect(() => {
		const option = accentOptions.find((item) => item.id === accentId);
		const theme = chart.theme;
		const media = window.matchMedia('(prefers-color-scheme: dark)');
		const apply = () => {
			if (!option) return;
			const dark = theme === 'dark' || (theme !== 'light' && media.matches);
			const stop = dark ? option.dark : option.light;
			document.documentElement.style.setProperty('--accent', option.id === 'ink' ? 'var(--ink)' : stop.accent);
			document.documentElement.style.setProperty(
				'--accent-hover',
				option.id === 'ink' ? 'var(--ink-hover)' : stop.hover
			);
			document.documentElement.style.setProperty(
				'--on-accent',
				option.id === 'ink' ? 'var(--on-ink)' : 'oklch(0.985 0.006 85)'
			);
		};
		apply();
		media.addEventListener('change', apply);
		return () => {
			media.removeEventListener('change', apply);
			document.documentElement.style.removeProperty('--accent');
			document.documentElement.style.removeProperty('--accent-hover');
			document.documentElement.style.removeProperty('--on-accent');
		};
	});

	async function copyAccent(option: AccentOption): Promise<void> {
		try {
			await navigator.clipboard.writeText(accentCss(option));
			copiedId = option.id;
			window.clearTimeout(copyTimer);
			copyTimer = window.setTimeout(() => {
				copiedId = '';
			}, 1600);
			chart.say('Copied accent CSS');
		} catch {
			copiedId = '';
		}
	}
</script>

<svelte:head>
	<title>UI primitives · Mandala</title>
	<meta name="robots" content="noindex" />
</svelte:head>

<div class="page-gutter mx-auto flex max-w-[1180px] flex-col gap-8 pb-40">
	<header class="flex flex-col gap-6">
		<div class="flex items-center justify-between gap-4">
			<Wordmark />
			<SegmentedControl
				label="Color theme"
				size="sm"
				options={themes}
				value={chart.theme}
				onchange={setTheme}
			/>
		</div>
		<div class="flex max-w-[62ch] flex-col gap-3">
			<div>
				<Eyebrow>Design system</Eyebrow>
				<h1 class="m-0 mt-2 font-serif text-[clamp(1.9rem,4vw,2.8rem)] font-[480] tracking-tight text-balance">
					UI primitives
				</h1>
			</div>
			<p class="m-0 text-pretty text-muted">
				Every variant and state, on the same tokens as the app. Product screens still get one primary
				action. Delete this route when you don't want the catalog.
			</p>
		</div>
	</header>

	<nav class="flex flex-wrap gap-x-4 gap-y-1" aria-label="Catalog">
		{#each catalog as [id, label] (id)}
			<a class={link} href="#{id}">{label}</a>
		{/each}
	</nav>

	<Card id="type" class="flex scroll-mt-6 flex-col gap-5">
		<Eyebrow>Type</Eyebrow>
		<div class="flex max-w-[62ch] flex-col gap-3">
			<p class="m-0 font-serif text-[clamp(1.85rem,3.4vw,2.55rem)] leading-[1.12] font-[460] tracking-[-0.028em] text-balance">
				Chart title
			</p>
			<h2 class="m-0 font-serif text-[1.6rem] leading-[1.15] font-[480] tracking-[-0.02em] text-balance">
				Dialog heading
			</h2>
			<p class="m-0 text-[0.95rem] text-pretty">
				Body copy stays near a rem, with pretty wrapping, and runs no wider than about 62 characters.
			</p>
			<p class="m-0 text-pretty text-muted">Lede and helper text use the muted ink.</p>
			<p class="m-0 text-[0.88rem] text-danger" role="alert">That reply was not a chart.</p>
			<p class="m-0 text-[0.88rem] text-success">Goal is set.</p>
		</div>
		<dl class="m-0 flex flex-wrap gap-8">
			<div>
				<dt class="text-[0.86rem] text-muted">Actions</dt>
				<dd class="m-0 text-[1.35rem] font-[620] tabular-nums">24<span class="font-medium text-muted">/64</span></dd>
			</div>
			<div>
				<dt class="text-[0.86rem] text-muted">Pillars</dt>
				<dd class="m-0 text-[1.35rem] font-[620] text-success tabular-nums">8<span class="font-medium text-success">/8</span></dd>
			</div>
		</dl>
		<div class="flex flex-wrap items-center gap-2">
			<kbd class="rounded-md bg-sunken px-2 py-0.5 text-center font-sans text-[0.75rem] font-semibold text-muted">Ctrl</kbd>
			<kbd class="rounded-md bg-sunken px-2 py-0.5 text-center font-sans text-[0.75rem] font-semibold text-muted">K</kbd>
			<span class="text-[0.8rem] text-muted">opens commands</span>
		</div>
	</Card>

	<Card id="surfaces" class="flex scroll-mt-6 flex-col gap-5">
		<Eyebrow>Surfaces</Eyebrow>
		<div class="grid grid-cols-[repeat(auto-fill,minmax(7.5rem,1fr))] gap-x-3 gap-y-4">
			{#each surfaces as surface (surface.name)}
				<div class="flex flex-col items-center gap-1.5">
					<div class={cn('h-14 w-full rounded-2xl shadow-card', surface.swatch)}></div>
					<span class="text-center text-[0.75rem] leading-none text-muted">{surface.name}</span>
				</div>
			{/each}
		</div>
		<div class="flex flex-wrap items-center gap-2.5">
			{#each HUES as hue, pillar (hue)}
				<span
					class="pillar-dot size-9 rounded-full"
					style:--h={hue}
					title="Pillar {pillar + 1}"
				></span>
			{/each}
		</div>
		<div class="flex flex-wrap items-center gap-4">
			<div class="flex h-20 w-40 items-center justify-center rounded-[22px] bg-bg text-[0.82rem] text-muted shadow-card">
				Card
			</div>
			<div class="flex h-20 w-40 items-center justify-center rounded-[22px] bg-bg text-[0.82rem] text-muted shadow-float">
				Float
			</div>
			<div
				class="inline-flex h-[42px] items-center justify-center rounded-full bg-ink px-[18px] text-[0.9rem] font-[560] text-on-ink shadow-press"
			>
				Press
			</div>
		</div>
	</Card>

	<Card id="accent" class="flex scroll-mt-6 flex-col gap-4">
		<Eyebrow>Accent</Eyebrow>
		<p class="m-0 max-w-[68ch] text-pretty text-muted">
			Sap sat best of the last set. These are browns, olives, and teals in the gaps the pillars leave open. Pick one
			to preview it here. Copy the CSS into <span class="text-text">src/app.css</span>: light pair in
			<span class="text-text">:root</span>, dark pair in both dark blocks. Every option clears 4.5:1 for the cream
			label, including hover.
		</p>
		<div class="flex flex-col gap-6" role="group" aria-label="Accent variations">
			{#each accentGroups as group (group)}
				<section class="flex flex-col gap-3">
					<h2 class="m-0 text-[0.95rem] font-[620]">{group}</h2>
					<div class="grid grid-cols-1 gap-3 min-[900px]:grid-cols-3">
			{#each accentOptions.filter((option) => option.group === group) as option (option.id)}
				<div
					class={cn(
						'flex flex-col gap-3 rounded-[22px] p-4',
						accentId === option.id ? 'bg-surface shadow-[0_0_0_1.5px_var(--ink)]' : 'bg-sunken'
					)}
				>
					<button
						type="button"
						class="flex cursor-pointer flex-col gap-3 border-0 bg-transparent p-0 text-left text-text focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink"
						aria-pressed={accentId === option.id}
						onclick={() => (accentId = option.id)}
					>
						<span class="flex flex-wrap items-baseline gap-x-2 gap-y-1">
							<span class="text-[1rem] font-[620]">{option.name}</span>
							{#if option.applied}
								<span class="text-[0.75rem] font-semibold tracking-[0.08em] text-muted uppercase">In the app</span>
							{/if}
						</span>
						<span class="text-[0.88rem] text-pretty text-muted">{option.note}</span>
						<span class="flex flex-wrap gap-2">
							<span
								class="inline-flex h-9 min-w-[5.5rem] items-center justify-center rounded-full px-3 text-[0.8rem] font-[560]"
								style:background={option.light.accent}
								style:color={option.light.fg ?? 'oklch(0.985 0.006 85)'}
							>
								Light
							</span>
							<span
								class="inline-flex h-9 min-w-[5.5rem] items-center justify-center rounded-full px-3 text-[0.8rem] font-[560]"
								style:background={option.dark.accent}
								style:color={option.dark.fg ?? 'oklch(0.985 0.006 85)'}
							>
								Dark
							</span>
						</span>
					</button>
					<Button
						size="sm"
						variant="ghost"
						icon="copy"
						onclick={() => void copyAccent(option)}
					>
						{copiedId === option.id ? 'Copied' : 'Copy CSS'}
					</Button>
				</div>
						{/each}
					</div>
				</section>
			{/each}
		</div>
		<div class="flex flex-wrap items-center gap-3">
			<Button icon="list">Start from a preset</Button>
			<Button variant="soft" icon="sparkles">Get a prompt</Button>
		</div>
	</Card>

	<Card id="buttons" class="flex scroll-mt-6 flex-col gap-4">
		<Eyebrow>Button</Eyebrow>
		<div class="flex flex-wrap items-center gap-3">
			<Button icon="list">Start from a preset</Button>
			<Button variant="soft" icon="sparkles">Get a prompt</Button>
			<Button variant="ghost" icon="info">How it works</Button>
			<Button variant="danger" icon="trash">Clear chart</Button>
		</div>
		<div class="flex flex-wrap items-center gap-3">
			<Button size="sm">Use this chart</Button>
			<Button size="sm" variant="soft">Cancel</Button>
			<Button size="sm" variant="ghost">Not now</Button>
			<Button size="sm" variant="danger">Delete now</Button>
		</div>
		<div class="flex flex-wrap items-center gap-3">
			<Button disabled>Start from a preset</Button>
			<Button variant="soft" disabled>Get a prompt</Button>
			<Button variant="ghost" disabled>How it works</Button>
			<Button variant="danger" disabled>Clear chart</Button>
		</div>
		<div class="flex flex-wrap items-center gap-3">
			<Button
				size="sm"
				variant={pinned ? 'soft' : 'ghost'}
				icon="pin"
				aria-pressed={pinned}
				onclick={() => (pinned = !pinned)}
			>
				{pinned ? 'Pinned' : 'Pin'}
			</Button>
			<Button href="#icons" variant="ghost" icon="grid">Icon set</Button>
			<Button class="w-full max-w-[320px]">Open the chart</Button>
		</div>
	</Card>

	<Card id="icon-buttons" class="flex scroll-mt-6 flex-col gap-4">
		<Eyebrow>Icon button</Eyebrow>
		<div class="flex flex-wrap items-center gap-2">
			<IconButton icon="close" label="Close" />
			<IconButton icon="more" label="More actions" />
			<IconButton icon="search" label="Search" />
			<IconButton icon="undo" label="Undo" />
			<IconButton icon="printer" label="Print" />
			<IconButton icon="trash" label="Delete" disabled />
		</div>
	</Card>

	<Card id="fields" class="flex scroll-mt-6 flex-col gap-5">
		<Eyebrow>Fields</Eyebrow>
		<div class="grid items-end gap-4 md:grid-cols-2">
			<div class="flex flex-col gap-1.5">
				<span id="catalog-model" class="text-[0.82rem] font-semibold">Model</span>
				<Select label="Model" labelledBy="catalog-model" options={modelChoices} bind:value={pickedModel} />
			</div>
			<label class="flex flex-col gap-1.5">
				<span class="text-[0.82rem] font-semibold">Chart name</span>
				<input class={field} type="text" bind:value={name} spellcheck="false" />
			</label>
			<label class="flex flex-col gap-1.5">
				<span class="text-[0.82rem] font-semibold">Disabled</span>
				<input class={field} type="text" value="Locked title" disabled />
			</label>
			<div class="flex flex-col gap-1.5">
				<span id="catalog-model-locked" class="text-[0.82rem] font-semibold">Locked</span>
				<Select
					label="Locked model"
					labelledBy="catalog-model-locked"
					options={modelChoices}
					value="qwen3"
					disabled
				/>
			</div>
		</div>
		<label class="flex max-w-[340px] flex-col gap-1.5">
			<span class="text-[0.82rem] font-semibold">Search</span>
			<span class="relative">
				<span class="pointer-events-none absolute start-[15px] top-1/2 flex -translate-y-1/2 text-muted" aria-hidden="true">
					<Icon name="search" size={16} />
				</span>
				<input
					class={cn(fieldInk, 'ps-[42px] pe-10 [&::-webkit-search-cancel-button]:hidden')}
					type="search"
					placeholder="Search your chart"
					aria-label="Search the chart"
					autocomplete="off"
					spellcheck="false"
					bind:value={query}
				/>
				{#if query.trim()}
					<button
						type="button"
						class="absolute end-[9px] top-1/2 flex size-[26px] -translate-y-1/2 cursor-pointer items-center justify-center rounded-full border-0 p-0 text-text bg-sunken-hover after:absolute after:-inset-2 after:content-[''] focus-visible:bg-ink focus-visible:text-on-ink focus-visible:outline-none"
						aria-label="Clear search"
						onclick={() => (query = '')}
					>
						<Icon name="close" size={12} />
					</button>
				{/if}
			</span>
		</label>
		<label class="flex flex-col gap-1.5">
			<span class="text-[0.82rem] font-semibold">Paste the reply</span>
			<textarea
				class={cn(textArea, 'min-h-24 text-[0.95rem]')}
				rows="3"
				placeholder="Paste the JSON when it comes back"
				bind:value={reply}
			></textarea>
		</label>
		<label class="flex max-w-md cursor-pointer items-center justify-between gap-3 text-[0.9rem]">
			<span>
				Keep the page up to date
				<span class="block text-[0.78rem] text-muted">Publishes after edits.</span>
			</span>
			<input class="size-4 shrink-0 cursor-pointer" type="checkbox" bind:checked={keepUpdated} />
		</label>
		<fieldset class="m-0 grid max-w-xl grid-cols-2 gap-1.5 rounded-[22px] border-0 bg-sunken p-1.5 max-[640px]:grid-cols-1">
			<legend class="sr-only">Choose a preset</legend>
			<label
				class="group flex min-w-0 cursor-pointer items-start gap-2.5 rounded-[16px] px-3 py-2.5 motion-safe:transition-[scale] motion-safe:duration-150 motion-safe:ease-ui active:scale-[0.98] has-focus-visible:outline-2 has-focus-visible:outline-offset-2 has-focus-visible:outline-ink {preset === 'health'
					? 'bg-surface shadow-seg'
					: 'hover:bg-sunken-hover'}"
			>
				<input class="sr-only" type="radio" name="catalog-preset" value="health" bind:group={preset} />
				<span
					class="mt-[3px] flex size-4 shrink-0 items-center justify-center rounded-full motion-safe:transition-colors motion-safe:duration-150 {preset === 'health'
						? 'bg-accent text-on-accent'
						: 'shadow-[inset_0_0_0_1.5px_var(--line)] group-hover:shadow-[inset_0_0_0_1.5px_var(--muted)]'}"
					aria-hidden="true"
				>
					{#if preset === 'health'}
						<span class="size-1.5 rounded-full bg-surface"></span>
					{/if}
				</span>
				<span class="flex min-w-0 flex-col gap-0.5">
					<span class="text-[0.92rem] font-[620]">Health first</span>
					<span class="text-[0.8rem] leading-[1.35] text-pretty text-muted">Sleep, food, and a daily walk.</span>
				</span>
			</label>
			<label
				class="group flex min-w-0 cursor-pointer items-start gap-2.5 rounded-[16px] px-3 py-2.5 motion-safe:transition-[scale] motion-safe:duration-150 motion-safe:ease-ui active:scale-[0.98] has-focus-visible:outline-2 has-focus-visible:outline-offset-2 has-focus-visible:outline-ink {preset === 'blank'
					? 'bg-surface shadow-seg'
					: 'hover:bg-sunken-hover'}"
			>
				<input class="sr-only" type="radio" name="catalog-preset" value="blank" bind:group={preset} />
				<span
					class="mt-[3px] flex size-4 shrink-0 items-center justify-center rounded-full motion-safe:transition-colors motion-safe:duration-150 {preset === 'blank'
						? 'bg-accent text-on-accent'
						: 'shadow-[inset_0_0_0_1.5px_var(--line)] group-hover:shadow-[inset_0_0_0_1.5px_var(--muted)]'}"
					aria-hidden="true"
				>
					{#if preset === 'blank'}
						<span class="size-1.5 rounded-full bg-surface"></span>
					{/if}
				</span>
				<span class="flex min-w-0 flex-col gap-0.5">
					<span class="text-[0.92rem] font-[620]">Blank chart</span>
					<span class="text-[0.8rem] leading-[1.35] text-pretty text-muted">One goal, empty pillars.</span>
				</span>
			</label>
		</fieldset>
		<button class={link} type="button" onclick={() => chart.say('Paste opened')}>Paste a reply</button>
	</Card>

	<Card id="segmented" class="flex scroll-mt-6 flex-col gap-4">
		<Eyebrow>Segmented control</Eyebrow>
		<SegmentedControl label="Chart scale" options={scales} bind:value={scale} />
		<SegmentedControl size="sm" label="Action type" options={actionKinds} bind:value={kind} />
	</Card>

	<Card id="menus" class="flex scroll-mt-6 flex-col gap-4">
		<Eyebrow>Menu</Eyebrow>
		<div class="flex flex-wrap items-start gap-6">
			<div class={cn(menuPanel, 'relative top-auto w-[min(340px,100%)]')} role="menu" aria-label="Chart list">
				<MenuItem icon="check" active badge="12/73">
					<span class="flex min-w-0 flex-col gap-px">
						<span class="max-w-[28ch] truncate">Morning chart</span>
						<span class="text-[0.72rem] leading-tight font-normal text-muted">Updated today</span>
					</span>
				</MenuItem>
				<MenuItem icon="grid" badge="3/73">
					<span class="max-w-[28ch] truncate">Blank chart</span>
				</MenuItem>
				<MenuDivider />
				<MenuItem icon="edit" badge="R">Rename chart</MenuItem>
				<MenuItem icon="copy" badge="D" onclick={() => chart.say('Chart duplicated')}>Duplicate chart</MenuItem>
				<MenuItem icon="plus">New chart</MenuItem>
				<MenuDivider />
				<MenuItem icon="trash" tone="danger" badge="Del" onclick={() => (dialogOpen = true)}>
					Delete chart
				</MenuItem>
			</div>
			<div class="flex flex-wrap items-center gap-3">
				<Menu align="start" label="More actions">
					<MenuItem icon="printer" badge="Ctrl+P" onclick={() => chart.say('Printed')}>Print chart</MenuItem>
					<MenuItem icon="image" badge=".png" onclick={() => chart.say('Poster exported')}>
						Export poster
					</MenuItem>
					<MenuItem icon="command" badge="Ctrl+K" onclick={() => (paletteOpen = true)}>Open commands</MenuItem>
					<MenuDivider />
					<MenuItem icon="trash" tone="danger" onclick={() => (dialogOpen = true)}>Clear chart</MenuItem>
				</Menu>
				<Menu align="end" label="Chart actions">
					{#snippet trigger({ expanded, toggle })}
						<Button
							variant="soft"
							icon="chevron-down"
							aria-haspopup="menu"
							aria-expanded={expanded}
							onclick={toggle}
						>
							Chart actions
						</Button>
					{/snippet}
					<MenuItem icon="upload">Import chart</MenuItem>
					<MenuItem icon="keyboard" onclick={() => (shortcutsOpen = true)}>Keyboard shortcuts</MenuItem>
					<MenuDivider />
					<MenuItem icon="folder" tone="danger">Turn off backups</MenuItem>
				</Menu>
			</div>
		</div>
	</Card>

	<Card id="dialogs" class="flex scroll-mt-6 flex-col gap-4">
		<Eyebrow>Dialog</Eyebrow>
		<div class="flex flex-wrap items-center gap-3">
			<Button variant="soft" onclick={() => (dialogOpen = true)}>Small dialog</Button>
			<Button variant="soft" onclick={() => (guideOpen = true)}>Dialog with description</Button>
			<Button variant="ghost" onclick={() => (shortcutsOpen = true)}>Keyboard shortcuts</Button>
			<Button variant="ghost" icon="command" onclick={() => (paletteOpen = true)}>Commands</Button>
		</div>
	</Card>

	<div id="feedback" class="flex scroll-mt-6 flex-col gap-8">
		<Card class="flex flex-col gap-4">
			<Eyebrow>Notice</Eyebrow>
			<Notice>
				Eight pillars are named. The actions are still open.
				{#snippet action()}
					<Button size="sm" onclick={() => chart.say('Action confirmed')}>Write actions</Button>
				{/snippet}
			</Notice>
			<Notice>
				This chart stays on this device.
				{#snippet action()}
					<Button size="sm" variant="soft" onclick={() => chart.say('Guide opened')}>How it works</Button>
				{/snippet}
			</Notice>
			<Notice>A quiet note with no action.</Notice>
		</Card>

		<Card class="flex flex-col gap-4">
			<Eyebrow>Bouncing dots</Eyebrow>
			<div class="flex flex-wrap items-center gap-6 text-[0.88rem] text-muted">
				<span class="inline-flex items-center">Thinking <BouncingDots /></span>
				<span class="inline-flex items-center">Loading <BouncingDots /></span>
				<span class="inline-flex items-center">Downloading <BouncingDots /></span>
				<span class="inline-flex items-center">Generating poster <BouncingDots /></span>
			</div>
		</Card>

		<Card class="flex flex-col gap-4">
			<Eyebrow>Eyebrow</Eyebrow>
			<div class="flex flex-col gap-2">
				<Eyebrow>Design system</Eyebrow>
				<Eyebrow pip="goal">Center goal</Eyebrow>
				{#each POS as place, pillar (place)}
					<Eyebrow pip={pillar}>Pillar {pillar + 1} · {place}</Eyebrow>
				{/each}
			</div>
		</Card>

		<Card id="toasts" class="flex scroll-mt-6 flex-col gap-4">
			<div class="flex flex-wrap items-end justify-between gap-3">
				<div class="flex max-w-[62ch] flex-col gap-1.5">
					<Eyebrow>Toast lab</Eyebrow>
					<p class="m-0 text-pretty text-muted">
						Three takes on the same moments, each above a dock. Play the story, or fire one action at a time.
					</p>
				</div>
				<div class="flex flex-wrap gap-2">
					<Button size="sm" variant="ghost" onclick={() => chart.say('Copied as text')}>Live note</Button>
					<Button size="sm" variant="ghost" onclick={() => chart.note('Duplicated', 'Morning chart')}>
						Live repeat
					</Button>
				</div>
			</div>
			<ToastLab />
		</Card>

		<Card class="flex flex-col gap-4">
			<Eyebrow>Dock</Eyebrow>
			<div class={cn(dockBar, 'relative w-fit')} role="tablist" aria-label="Dock specimen">
				<DockTab icon="grid" selected={dockView === 'view'} onclick={() => (dockView = 'view')}>Chart</DockTab>
				<DockTab icon="edit" selected={dockView === 'edit'} onclick={() => (dockView = 'edit')}>Edit</DockTab>
				<DockTab icon="columns" selected={dockView === 'split'} onclick={() => (dockView = 'split')}>Split</DockTab>
			</div>
			<p class="m-0 text-[0.88rem] text-pretty text-muted">
				The live dock stays fixed at the bottom of this page. The bar above is the same tabs, in the flow.
			</p>
		</Card>
	</div>

	<Card id="brand" class="flex scroll-mt-6 flex-col gap-5">
		<Eyebrow>Brand</Eyebrow>
		<div class="flex flex-wrap items-end gap-8">
			<div class="flex items-center gap-2.5">
				<BrandMark />
				<span class="font-serif text-[1.3rem] leading-none font-[560] tracking-[-0.02em]">Mandala</span>
			</div>
			<ProgressRing size={56} />
			<ProgressRing size={76} />
			<DaySeal class="size-24" moved={[0, 2, 5]} label="Three pillars moved" />
			{#key sealPlay}
				<DaySeal class="size-28" play moved={[0, 1, 2, 3, 4, 5]} label="Day sealed, six pillars" />
			{/key}
		</div>
		<div>
			<Button size="sm" variant="soft" onclick={() => (sealPlay += 1)}>Replay seal</Button>
		</div>
	</Card>

	<Card id="chart" class="flex scroll-mt-6 flex-col gap-5">
		<Eyebrow>Chart cells</Eyebrow>
		<div class="grid max-w-md grid-cols-4 gap-2">
			<button
				type="button"
				aria-label="Empty goal"
				class={cn(cell, "goal rounded-[28%] bg-goal font-serif text-[15px] font-[560] text-goal-fg before:font-medium before:opacity-60 before:content-['Your_goal']")}
			></button>
			<button
				type="button"
				class={cn(cell, 'pillar pillar-cell rounded-[28%] font-[620] text-on-p')}
				style:--h={HUES[0]}
			>
				Health
			</button>
			<button
				type="button"
				class={cn(cell, 'action pillar-action rounded-[11px] text-text')}
				style:--h={HUES[1]}
			>
				Walk
			</button>
			<button
				type="button"
				class={cn(cell, 'action pillar-action rounded-[11px] text-muted line-through opacity-60')}
				style:--h={HUES[3]}
			>
				Done
			</button>
		</div>
		<div class="max-w-[520px]">
			<MandalaGrid mode="view" source={sample} />
		</div>
	</Card>

	<Card id="icons" class="flex scroll-mt-6 flex-col gap-4">
		<Eyebrow>Icons</Eyebrow>
		<ul class="m-0 grid list-none grid-cols-[repeat(auto-fill,minmax(7.25rem,1fr))] gap-2 p-0">
			{#each iconNames as name (name)}
				<li>
					<div class="flex min-h-16 flex-col items-center justify-center gap-1.5 rounded-2xl bg-sunken px-2 py-3 text-text">
						<Icon {name} size={18} />
						<span class="max-w-full truncate text-[0.72rem] text-muted">{name}</span>
					</div>
				</li>
			{/each}
		</ul>
	</Card>
</div>

<Dialog bind:open={dialogOpen} title="Clear this chart?" size="sm">
	<p class="m-0 text-muted">The goal, pillars, and actions on this chart go away. This stays on this device.</p>
	{#snippet footer()}
		<Button variant="ghost" onclick={() => (dialogOpen = false)}>Cancel</Button>
		<Button
			variant="danger"
			onclick={() => {
				dialogOpen = false;
				chart.say('Chart cleared');
			}}>Clear chart</Button
		>
	{/snippet}
</Dialog>

<Dialog
	bind:open={guideOpen}
	title="The Mandala method"
	description="One goal in the center, eight pillars around it, eight actions on each pillar."
>
	<p class="m-0 text-pretty text-muted">
		Write the goal once. Name the pillars. Then fill the actions you can actually do. Review the chart. You do not redraw it every morning.
	</p>
</Dialog>

<ShortcutsDialog bind:open={shortcutsOpen} />
<CommandPalette bind:open={paletteOpen} {commands} />

<Dock label="Layout view mode">
	<DockTab icon="grid" selected={view === 'view'} onclick={() => (view = 'view')}>Chart</DockTab>
	<DockTab icon="edit" selected={view === 'edit'} onclick={() => (view = 'edit')}>Edit</DockTab>
	<DockTab icon="columns" selected={view === 'split'} onclick={() => (view = 'split')}>Split</DockTab>
</Dock>
