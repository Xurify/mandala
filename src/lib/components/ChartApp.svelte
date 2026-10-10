<script lang="ts">
	import { onMount, untrack } from 'svelte';
	import { chart } from '$lib/chart/chart.svelte';
	import { helper } from '$lib/chart/helper.svelte';
	import {
		blockOfKey,
		getByKey,
		labelOfKey,
		parseChart,
		parseText,
		searchHits,
		type ChartData
	} from '$lib/chart/model';
	import type { AppTheme, ViewScale } from '$lib/chart/chart.svelte';
	import { ACCENTS } from '$lib/chart/accent';
	import type { Preset } from '$lib/chart/presets';
	import { decodeChartShare, isShareHash } from '$lib/chart/share';
	import { supportsDirectoryPicker } from '$lib/chart/backup';
	import { titleOf } from '$lib/chart/library';
	import { isApplePlatform, modifierLabel } from '$lib/chart/shortcuts';
	import Wordmark from './Wordmark.svelte';
	import ChartSwitcher from './ChartSwitcher.svelte';
	import Helper from './Helper.svelte';
	import ExportDialog from './ExportDialog.svelte';
	import ImportDialog from './ImportDialog.svelte';
	import MandalaGrid from './MandalaGrid.svelte';
	import MethodGuide from './MethodGuide.svelte';
	import PresetPicker from './PresetPicker.svelte';
	import ProgressRing from './ProgressRing.svelte';
	import SidePanel from './SidePanel.svelte';
	import TodayView from './TodayView.svelte';
	import YearView from './YearView.svelte';
	import CommandPalette, { type CommandItem } from './CommandPalette.svelte';
	import ShortcutsDialog from './ShortcutsDialog.svelte';
	import ShareDialog from './ShareDialog.svelte';
	import Icon from './Icon.svelte';
	import { cn } from './ui/cn';
	import { fieldInk } from './ui/styles';
	import Button from './ui/Button.svelte';
	import Dialog from './ui/Dialog.svelte';
	import IconButton from './ui/IconButton.svelte';
	import Dock from './ui/Dock.svelte';
	import DockTab from './ui/DockTab.svelte';
	import Eyebrow from './ui/Eyebrow.svelte';
	import Menu from './ui/Menu.svelte';
	import MenuDivider from './ui/MenuDivider.svelte';
	import MenuItem from './ui/MenuItem.svelte';
	import SegmentedControl from './ui/SegmentedControl.svelte';

	const themes = [
		{ value: 'system', label: 'Auto', icon: 'monitor' as const },
		{ value: 'light', label: 'Light', icon: 'sun' as const },
		{ value: 'dark', label: 'Dark', icon: 'moon' as const }
	];

	const accentName = $derived(ACCENTS.find((item) => item.id === chart.accent)?.label ?? 'Ink');

	const scales = [
		{ value: 'fit', label: 'Fit', icon: 'minimize' as const, title: 'Fit entire chart on screen without scrolling' },
		{ value: 'large', label: 'Large', icon: 'maximize' as const, title: 'Enlarge chart for maximum text readability' }
	];

	let isDraggingFile = $state(false);
	let dragCounter = 0;
	let isMobile = $state(
		typeof window !== 'undefined' && window.matchMedia('(max-width: 900px)').matches
	);
	let searchInputElement: HTMLInputElement | null = $state(null);
	let presetOpen = $state(false);
	let importOpen = $state(false);
	let exportOpen = $state(false);
	let shareOpen = $state(false);
	let incomingShare = $state<ChartData | null>(null);
	let paletteOpen = $state(false);
	let clearOpen = $state(false);
	let paletteQuery = $state('');
	let shortcutsOpen = $state(false);
	let modKey = $state('Ctrl');
	let updateReady = $state(false);

	const shownHits = $derived(chart.hits.slice(0, 10));
	const extraHits = $derived(Math.max(0, chart.hits.length - 10));

	const effectiveViewMode = $derived(
		isMobile && chart.viewMode === 'split' ? 'edit' : chart.viewMode
	);

	$effect(() => {
		const chartId = chart.activeId;
		untrack(() => helper.follow(chartId));
	});

	onMount(() => {
		chart.load();
		modKey = modifierLabel(isApplePlatform(navigator.userAgent));
		if (chart.theme === 'light' || chart.theme === 'dark') {
			document.documentElement.setAttribute('data-theme', chart.theme);
		} else {
			document.documentElement.removeAttribute('data-theme');
		}
		if (chart.accent === 'ink') {
			document.documentElement.removeAttribute('data-accent');
		} else {
			document.documentElement.setAttribute('data-accent', chart.accent);
		}
		const themeMediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
		const handleThemeChange = (): void => chart.bumpTheme();
		themeMediaQuery.addEventListener('change', handleThemeChange);

		const mobileMediaQuery = window.matchMedia('(max-width: 900px)');
		isMobile = mobileMediaQuery.matches;
		const handleMobileChange = (event: MediaQueryListEvent): void => {
			isMobile = event.matches;
		};
		mobileMediaQuery.addEventListener('change', handleMobileChange);

		if (supportsDirectoryPicker()) void chart.restoreBackupHandle();

		if (typeof navigator.serviceWorker !== 'undefined') {
			navigator.serviceWorker.addEventListener('message', (event) => {
				const data = event.data as { type?: string } | null;
				if (data?.type === 'mandala-updated') updateReady = true;
			});
		}

		// Opening a share link loads the app with the chart in the hash. A pasted link
		// in the same tab only fires hashchange, so handle both.
		const handleShareHash = (): void => {
			if (!isShareHash(window.location.hash)) return;
			decodeChartShare(window.location.hash).then((data) => {
				if (!data) return;
				incomingShare = data;
				shareOpen = true;
				window.history.replaceState(null, '', window.location.pathname + window.location.search);
			});
		};
		handleShareHash();
		window.addEventListener('hashchange', handleShareHash);

		return () => {
			themeMediaQuery.removeEventListener('change', handleThemeChange);
			mobileMediaQuery.removeEventListener('change', handleMobileChange);
			window.removeEventListener('hashchange', handleShareHash);
		};
	});

	function persistHidden(): void {
		if (document.visibilityState === 'hidden') chart.saveNow();
	}

	function selectBlock(blockIndex: number, targetKey?: string): void {
		if (targetKey) {
			chart.jumpToKey(targetKey);
		} else {
			chart.select(blockIndex);
		}
		if (effectiveViewMode === 'edit') {
			requestAnimationFrame(() => {
				const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
				document.querySelector('.panel')?.scrollIntoView({
					block: isMobile ? 'start' : 'nearest',
					behavior: reduceMotion ? 'auto' : 'smooth'
				});
			});
		}
	}

	function handleEditBlock(blockIndex: number, targetKey?: string): void {
		selectBlock(blockIndex, targetKey);
		chart.setViewMode('edit');
	}

	function handlePrintChart() {
		window.print();
	}

	function handleOpenExport(): void {
		exportOpen = true;
	}

	function handleOpenImport(): void {
		importOpen = true;
	}

	function handleApplyImport(data: ChartData): void {
		if (chart.importChart(data, 'Chart imported.')) {
			importOpen = false;
		}
	}

	function handleClearChart() {
		if (!chart.dirty) {
			chart.clearAll();
			return;
		}
		clearOpen = true;
	}

	function confirmClear(): void {
		clearOpen = false;
		chart.clearAll();
	}

	function handleOpenPresets() {
		presetOpen = true;
	}

	function handleApplyPreset(preset: Preset): void {
		if (chart.applyPreset(preset)) presetOpen = false;
	}

	function handleWindowKeydown(event: KeyboardEvent): void {
		const inDialog =
			(event.target instanceof Element && event.target.closest('dialog') !== null) ||
			document.querySelector('dialog[open]') !== null;
		if (inDialog) return;
		if (event.target instanceof Element && event.target.closest('[data-helper]')) return;

		const isTyping =
			event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement;

		if (event.key === 'Escape') {
			if (chart.query.trim()) {
				chart.setQuery('');
			} else if (chart.viewMode === 'edit') {
				chart.setViewMode('view');
			} else if (chart.sel !== 4) {
				chart.selectGoal();
			}
		} else if (!isTyping && (event.key === 'v' || event.key === 'V')) {
			event.preventDefault();
			chart.setViewMode('view');
		} else if (!isTyping && (event.key === 'e' || event.key === 'E')) {
			event.preventDefault();
			chart.setViewMode('edit');
		} else if (!isTyping && !isMobile && (event.key === 's' || event.key === 'S')) {
			event.preventDefault();
			chart.setViewMode('split');
		} else if (!isTyping && event.key === 'Enter' && chart.viewMode === 'view') {
			event.preventDefault();
			chart.setViewMode('edit');
		} else if (event.altKey && event.key === 'ArrowRight') {
			event.preventDefault();
			chart.selectNextPillar();
		} else if (event.altKey && event.key === 'ArrowLeft') {
			event.preventDefault();
			chart.selectPreviousPillar();
		} else if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') {
			event.preventDefault();
			paletteOpen = true;
		} else if (!isTyping && event.key === '?') {
			event.preventDefault();
			shortcutsOpen = true;
		} else if (event.key === '/' && !isTyping) {
			event.preventDefault();
			searchInputElement?.focus();
		} else if (!isTyping && (event.key === 't' || event.key === 'T')) {
			event.preventDefault();
			chart.setViewMode('today');
		} else if (!isTyping && (event.key === 'y' || event.key === 'Y')) {
			event.preventDefault();
			chart.setViewMode('year');
		}
	}

	function isTheme(value: string): value is AppTheme {
		return value === 'system' || value === 'light' || value === 'dark';
	}

	function isScale(value: string): value is ViewScale {
		return value === 'fit' || value === 'large';
	}


	function importChartContent(content: string): boolean {
		const parsedChart = parseChart(content) ?? parseText(content);
		if (!parsedChart) {
			chart.say('Invalid chart file. Please choose a valid JSON or text chart.');
			return false;
		}
		return chart.importChart(parsedChart);
	}


	function handleDragEnter(event: DragEvent) {
		event.preventDefault();
		dragCounter++;
		if (event.dataTransfer?.types.includes('Files')) {
			isDraggingFile = true;
		}
	}

	function handleDragOver(event: DragEvent) {
		event.preventDefault();
	}

	function handleDragLeave(event: DragEvent) {
		event.preventDefault();
		dragCounter--;
		if (dragCounter <= 0) {
			dragCounter = 0;
			isDraggingFile = false;
		}
	}

	async function handleDrop(event: DragEvent) {
		event.preventDefault();
		dragCounter = 0;
		isDraggingFile = false;
		const file = event.dataTransfer?.files?.[0];
		if (!file) return;

		const isJson = file.name.endsWith('.json') || file.type === 'application/json';
		const isText = file.name.endsWith('.txt') || file.type === 'text/plain';

		if (!isJson && !isText) {
			chart.say('Please drop a valid .json or .txt file.');
			return;
		}

		try {
			const text = await file.text();
			importChartContent(text);
		} catch {
			chart.say('Failed to read the dropped file.');
		}
	}

	async function copyText() {
		const text = chart.exported();
		const fallback = () => {
			chart.exportFallback = text;
			chart.say('Copy was blocked here. The text is selected below, so you can copy it manually.');
			queueMicrotask(() => {
				const box = document.querySelector<HTMLTextAreaElement>('.export-box');
				box?.focus();
				box?.select();
			});
		};
		if (navigator.clipboard?.writeText) {
			try {
				await navigator.clipboard.writeText(text);
				chart.exportFallback = '';
				chart.say('Copied as text.');
			} catch {
				fallback();
			}
		} else fallback();
	}


	function handleBackupMenu(): void {
		if (chart.backupState === 'needs-permission') void chart.resumeBackups();
		else if (chart.backupState === 'off') void chart.enableBackups();
		else void chart.disableBackups();
	}

	function handleApplyShare(data: ChartData): void {
		if (chart.importChart(data, 'Shared chart added.')) {
			incomingShare = null;
			shareOpen = false;
		}
	}

	const backupBadge = $derived(
		chart.backupLastAt
			? new Date(chart.backupLastAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
			: undefined
	);

	const paletteCommands = $derived.by((): CommandItem[] => {
		const items: CommandItem[] = [
			{ id: 'today', label: 'Go to Today', section: 'Actions', icon: 'calendar', run: () => chart.setViewMode('today') },
			{ id: 'year', label: 'Go to Year in focus', section: 'Actions', icon: 'clock', run: () => chart.setViewMode('year') },
			{ id: 'chart', label: 'Go to Chart', section: 'Actions', icon: 'grid', run: () => chart.setViewMode('view') },
			{ id: 'edit', label: 'Go to Editor', section: 'Actions', icon: 'edit', run: () => chart.setViewMode('edit') }
		];
		if (!isMobile) {
			items.push({ id: 'split', label: 'Go to Split view', section: 'Actions', icon: 'columns', run: () => chart.setViewMode('split') });
		}
		items.push(
			{ id: 'new-chart', label: 'New chart', section: 'Actions', icon: 'file-text', run: () => chart.newChart() },
			{ id: 'duplicate', label: 'Duplicate chart', section: 'Actions', icon: 'copy', run: () => chart.duplicateChart() },
			{ id: 'preset', label: 'Start from a preset', section: 'Actions', icon: 'list', run: () => (presetOpen = true) },
			{ id: 'helper', label: 'Open Bindu', section: 'Actions', icon: 'sparkles', run: () => helper.show() },
			{ id: 'export', label: 'Export chart', section: 'Actions', icon: 'download', run: () => (exportOpen = true) },
			{ id: 'import', label: 'Import chart', section: 'Actions', icon: 'upload', run: () => (importOpen = true) },
			{ id: 'print', label: 'Print chart', section: 'Actions', icon: 'printer', run: () => window.print() },
			{
				id: 'shortcuts',
				label: 'Keyboard shortcuts',
				section: 'Actions',
				icon: 'keyboard',
				hint: '?',
				run: () => (shortcutsOpen = true)
			},
			{ id: 'theme-light', label: 'Light theme', section: 'Actions', icon: 'sun', run: () => chart.setTheme('light') },
			{ id: 'theme-dark', label: 'Dark theme', section: 'Actions', icon: 'moon', run: () => chart.setTheme('dark') },
			{ id: 'theme-auto', label: 'Match system theme', section: 'Actions', icon: 'monitor', run: () => chart.setTheme('system') },
			...ACCENTS.map((item) => ({
				id: `accent-${item.id}`,
				label: `${item.label} accent`,
				section: 'Actions' as const,
				run: () => chart.setAccent(item.id)
			}))
		);
		if (supportsDirectoryPicker()) {
			items.push({
				id: 'backup',
				label:
					chart.backupState === 'on'
						? 'Turn off backups'
						: chart.backupState === 'needs-permission'
							? 'Resume backups'
							: 'Keep a backup folder',
				section: 'Actions',
				icon: 'folder',
				tone: chart.backupState === 'on' ? 'danger' : undefined,
				run: handleBackupMenu
			});
		}
		for (const key of searchHits(chart.data, paletteQuery).slice(0, 6)) {
			items.push({
				id: `hit-${key}`,
				label: getByKey(chart.data, key).trim() || key,
				section: 'Your chart',
				icon: 'file-text',
				hint: labelOfKey(chart.data, key),
				run: () => {
					selectBlock(blockOfKey(key), key);
					chart.setViewMode('edit');
				}
			});
		}
		return items;
	});

	function handleGoHome(event: MouseEvent): void {
		if (
			event.defaultPrevented ||
			event.button !== 0 ||
			event.metaKey ||
			event.ctrlKey ||
			event.shiftKey ||
			event.altKey
		) {
			return;
		}
		if (chart.query) {
			chart.setQuery('');
		}
		if (chart.viewMode !== 'view') {
			chart.setViewMode('view');
		}
		chart.selectGoal();
		chart.clearFocusedKey();
		window.scrollTo({ top: 0, behavior: 'smooth' });
	}
</script>

<svelte:window
	onpagehide={() => chart.saveNow()}
	ondragenter={handleDragEnter}
	ondragover={handleDragOver}
	ondragleave={handleDragLeave}
	ondrop={handleDrop}
	onkeydown={handleWindowKeydown}
/>
<svelte:document onvisibilitychange={persistHidden} />

<!-- The Bindu launcher sits at the right of the row above the dock on a phone: 50px, plus a 16px gap. -->
<div
	class="page-gutter mx-auto max-w-295 max-[600px]:[--dock-aside:66px] pb-[calc(128px+env(safe-area-inset-bottom,0px))] max-[900px]:pb-[calc(112px+env(safe-area-inset-bottom,0px))] print:!m-0 print:!w-full print:!max-w-full print:!p-0"
>
	<header class="relative z-30 print:hidden">
		<div class="flex items-center gap-x-4 gap-y-3 max-[900px]:flex-wrap max-[900px]:gap-x-2 max-[900px]:gap-y-2.5">
			<Wordmark class="max-[900px]:flex-auto" onclick={handleGoHome} />

			<div class="relative ms-auto w-full max-w-[340px] flex-[0_1_340px] max-[900px]:order-3 max-[900px]:ms-0 max-[900px]:max-w-none max-[900px]:flex-auto">
				<span class="pointer-events-none absolute start-[15px] top-1/2 flex -translate-y-1/2 text-muted" aria-hidden="true">
					<Icon name="search" size={16} />
				</span>
				<input
					bind:this={searchInputElement}
					class={cn(fieldInk, 'peer ps-[42px] pe-10 [&::-webkit-search-cancel-button]:hidden')}
					type="search"
					placeholder="Search your chart"
					aria-label="Search the chart"
					autocomplete="off"
					spellcheck="false"
					value={chart.query}
					oninput={(event) => chart.setQuery(event.currentTarget.value)}
				/>					{#if chart.query.trim()}
						<button
							type="button"
							class="absolute end-[9px] top-1/2 flex size-[26px] -translate-y-1/2 cursor-pointer items-center justify-center rounded-full border-0 p-0 text-text bg-sunken-hover after:absolute after:-inset-2 after:content-[''] focus-visible:bg-ink focus-visible:text-on-ink focus-visible:outline-none"
							aria-label="Clear search"
							onclick={() => chart.setQuery('')}
						>
							<Icon name="close" size={12} strokeWidth={2.2} />
						</button>
					{:else}
						<kbd class="pointer-events-none absolute end-3 top-1/2 min-w-[22px] -translate-y-1/2 rounded-md bg-surface px-1.5 py-px text-center font-sans text-[0.72rem] font-semibold text-muted shadow-card peer-focus:hidden max-[900px]:hidden" aria-hidden="true">/</kbd>
					{/if}
				</div>

				<IconButton
					icon="command"
					label="Open commands"
					class="hidden max-[900px]:flex"
					aria-keyshortcuts="Control+K Meta+K"
					onclick={() => (paletteOpen = true)}
				/>

			<Menu label="More actions">
				<MenuItem icon="command" shortcut="{modKey}+K" onclick={() => (paletteOpen = true)}>Open commands</MenuItem>
				<MenuItem icon="printer" shortcut="{modKey}+P" onclick={handlePrintChart}>Print chart</MenuItem>
				<MenuItem icon="download" badge=".png, .json" onclick={handleOpenExport}>Export chart</MenuItem>
				<MenuItem icon="upload" badge=".json, .txt" onclick={handleOpenImport}>Import chart</MenuItem>
				<MenuItem icon="keyboard" shortcut="?" onclick={() => (shortcutsOpen = true)}>Keyboard shortcuts</MenuItem>
				{#if supportsDirectoryPicker()}
					{#if chart.backupState === 'on'}
						<MenuItem icon="folder" tone="danger" badge={backupBadge} onclick={handleBackupMenu}>Turn off backups</MenuItem>
					{:else}
						<MenuItem icon="folder" onclick={handleBackupMenu}>
							{chart.backupState === 'needs-permission' ? 'Resume backups' : 'Keep a backup folder'}
						</MenuItem>
					{/if}
				{/if}
				<MenuDivider />
				<div class="flex items-center justify-between gap-3 py-1.5 ps-3 pe-1.5 text-[0.9rem]">
					<span class="text-muted">Theme</span>
					<SegmentedControl
						label="Color theme"
						size="sm"
						options={themes}
						value={chart.theme}
						onchange={(value) => {
							if (isTheme(value)) chart.setTheme(value);
						}}
					/>
				</div>
				<div class="flex flex-col gap-2 px-3 py-1.5 text-[0.9rem]">
					<span class="text-muted">Accent <span class="text-text">{accentName}</span></span>
					<div class="grid w-max grid-cols-5 gap-1.5" role="group" aria-label="Accent color">
						{#each ACCENTS as item (item.id)}
							<button
								type="button"
								class="size-[42px] cursor-pointer appearance-none rounded-full border-0 p-0 motion-safe:transition-[scale] motion-safe:duration-150 motion-safe:ease-ui active:scale-[0.96] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink aria-pressed:shadow-[0_0_0_2px_var(--surface),0_0_0_4px_var(--text)] coarse:size-11"
								style:background={item.id === 'ink' ? 'var(--ink)' : `var(--swatch-${item.id})`}
								aria-pressed={chart.accent === item.id}
								aria-label={item.label}
								title={item.title}
								onclick={() => chart.setAccent(item.id)}
							></button>
						{/each}
					</div>
				</div>
				<MenuDivider />
				<MenuItem icon="trash" tone="danger" onclick={handleClearChart}>Clear chart</MenuItem>
			</Menu>
		</div>

		<div class="mt-8 mb-6 grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-12 gap-y-5 max-[900px]:mt-6 max-[900px]:mb-5 max-[900px]:grid-cols-1 max-[900px]:gap-4">
			<div class="min-w-0">
				<Eyebrow class="mb-2">Your chart</Eyebrow>
				<ChartSwitcher />
				{#if effectiveViewMode !== 'today'}
					<div class="mt-3.5 flex flex-wrap items-center gap-2 max-[900px]:mt-3">
						<Button icon="list" onclick={handleOpenPresets}>Start from a preset</Button>
						<Button variant="soft" icon="sparkles" onclick={() => helper.show('write', 'new')}>Start a chart</Button>
						<MethodGuide />
					</div>
				{/if}
			</div>

			{#if effectiveViewMode !== 'today'}
			<div class="flex items-center gap-5 rounded-[28px] bg-surface py-3.5 pr-6 pl-3.5 shadow-card max-[900px]:gap-4 max-[900px]:rounded-3xl max-[900px]:py-2.5 max-[900px]:pr-5 max-[900px]:pl-2.5">
				<ProgressRing size={isMobile ? 56 : 76} />
				<dl class="m-0 grid min-w-[132px] gap-[3px] max-[900px]:min-w-0 max-[900px]:flex-1 max-[900px]:grid-cols-3 max-[900px]:justify-between max-[900px]:gap-2">
					<div class="flex items-baseline justify-between gap-[18px] text-[0.86rem] max-[900px]:flex-col max-[900px]:items-start max-[900px]:gap-0 max-[900px]:text-[0.82rem]">
						<dt class="text-muted">Goal</dt>
						<dd class="m-0 font-[620] tabular-nums {chart.milestones.goalSet ? 'text-success' : ''} max-[900px]:text-base">{chart.milestones.goalSet ? 'Set' : 'Not yet'}</dd>
					</div>
					<div class="flex items-baseline justify-between gap-[18px] text-[0.86rem] max-[900px]:flex-col max-[900px]:items-start max-[900px]:gap-0 max-[900px]:text-[0.82rem]">
						<dt class="text-muted">Pillars</dt>
						<dd class="m-0 font-[620] tabular-nums max-[900px]:text-base {chart.milestones.pillarsCount === 8 ? 'text-success' : ''}">
							{chart.milestones.pillarsCount}<span class="font-medium {chart.milestones.pillarsCount === 8 ? 'text-success' : 'text-muted'}">/8</span>
						</dd>
					</div>
					<div class="flex items-baseline justify-between gap-[18px] text-[0.86rem] max-[900px]:flex-col max-[900px]:items-start max-[900px]:gap-0 max-[900px]:text-[0.82rem]">
						<dt class="text-muted">Actions</dt>
						<dd class="m-0 font-[620] tabular-nums max-[900px]:text-base {chart.milestones.actionsCount === 64 ? 'text-success' : ''}">
							{chart.milestones.actionsCount}<span class="font-medium {chart.milestones.actionsCount === 64 ? 'text-success' : 'text-muted'}">/64</span>
						</dd>
					</div>
				</dl>
			</div>
			{/if}
		</div>

		<PresetPicker bind:open={presetOpen} onapply={handleApplyPreset} />
		<ImportDialog bind:open={importOpen} onapply={handleApplyImport} />
		<ExportDialog bind:open={exportOpen} oncopytext={copyText} />
		<ShareDialog bind:open={shareOpen} data={incomingShare} onapply={handleApplyShare} />
		<CommandPalette bind:open={paletteOpen} bind:query={paletteQuery} commands={paletteCommands} />
		<Dialog
			bind:open={clearOpen}
			title="Clear this chart?"
			description="The goal, pillars, and actions go away. They do not go to recently deleted."
			size="sm"
		>
			<div class="flex min-h-[52px] items-center rounded-[16px] bg-sunken px-3 py-2">
				<span class="min-w-0">
					<span class="block truncate text-[0.95rem] font-medium text-text">{titleOf(chart.data)}</span>
					<span class="mt-0.5 block text-[0.72rem] leading-tight text-muted tabular-nums">
						{chart.filled} of 73
					</span>
				</span>
			</div>
			{#snippet footer()}
				<Button variant="ghost" onclick={() => (clearOpen = false)}>Cancel</Button>
				<Button variant="danger" onclick={confirmClear}>Clear chart</Button>
			{/snippet}
		</Dialog>
		<ShortcutsDialog bind:open={shortcutsOpen} mod={modKey} desktop={!isMobile} />
	</header>

	<div class="mb-5 flex max-w-[900px] flex-wrap gap-1.5 empty:hidden print:hidden" aria-live="polite">
		{#if chart.query.trim() && !shownHits.length}
			<div class="px-0.5 py-1.5 text-[0.86rem] text-muted">No matches.</div>
		{/if}
		{#each shownHits as key (key)}
			<button
				type="button"
				class="max-w-full min-h-[34px] cursor-pointer truncate rounded-full border-0 px-3.5 text-start font-sans text-[0.86rem] text-text shadow-card bg-surface hover:bg-sunken focus-visible:bg-sunken focus-visible:outline-none"
				onclick={() => {
					selectBlock(blockOfKey(key), key);
					chart.setViewMode('edit');
				}}
			>
				<b class="me-1.5 font-[620]">{labelOfKey(chart.data, key)}</b>
				{getByKey(chart.data, key).trim()}
			</button>
		{/each}
		{#if extraHits}
			<div class="px-0.5 py-1.5 text-[0.86rem] text-muted">+{extraHits} more</div>
		{/if}
	</div>

	{#if effectiveViewMode === 'view'}
		<div
			class="chart-frame mx-auto mb-3.5 flex w-full items-center justify-between gap-3 print:hidden max-[900px]:mb-2.5 max-[900px]:justify-end"
		>
			<span class="text-[0.84rem] text-muted max-[900px]:hidden">Double-click a cell to edit its block</span>
			<SegmentedControl
				label="Chart scale"
				size="sm"
				options={scales}
				value={chart.viewScale}
				onchange={(value) => {
					if (isScale(value)) chart.setViewScale(value);
				}}
			/>
		</div>
	{/if}

	<main
		class={cn(
			'flex w-full flex-wrap items-start gap-7 print:!m-0 print:!block print:!gap-0 max-[900px]:block',
			(effectiveViewMode === 'view' || effectiveViewMode === 'edit' || effectiveViewMode === 'today' || effectiveViewMode === 'year') && 'flex-col items-center'
		)}
	>
		<div class="print-sheet contents">
			<header class="print-mast hidden">
				<div class="min-w-0">
					<p class="print-kicker">Mandala</p>
					<h1 class="print-title">{chart.data.goal.trim() || 'Untitled'}</h1>
				</div>
				<p class="print-meta">
					{chart.milestones.pillarsCount} of 8 pillars · {chart.milestones.actionsCount} of 64 actions
				</p>
			</header>
			<div
				class={cn(
					'chart min-w-0 @container',
					(effectiveViewMode === 'edit' || effectiveViewMode === 'today' || effectiveViewMode === 'year') && 'hidden',
					effectiveViewMode === 'view' && 'chart-frame mx-auto w-full flex-none',
					effectiveViewMode === 'split' && 'max-w-[660px] flex-[1_1_520px]'
				)}
			>
				<MandalaGrid
					mode={effectiveViewMode === 'edit' || effectiveViewMode === 'today' || effectiveViewMode === 'year' ? 'view' : effectiveViewMode}
					onSelect={selectBlock}
					onEdit={handleEditBlock}
				/>
			</div>
		</div>
		{#if effectiveViewMode === 'edit' || effectiveViewMode === 'split'}
			<div
				class={cn(
					'side @container print:hidden max-[900px]:w-full max-[900px]:max-w-none max-[900px]:min-w-0',
					effectiveViewMode === 'edit' && 'mx-auto w-full max-w-[700px] flex-none',
					effectiveViewMode === 'split' && 'min-w-[320px] max-w-[520px] flex-[1_1_380px]'
				)}
			>
				{#key chart.activeId}
					<SidePanel />
				{/key}
				<textarea
					class={cn(
						'mt-3.5 hidden min-h-40 w-full rounded-[20px] border-0 bg-surface p-3.5 font-sans text-[0.85rem] text-text shadow-card',
						chart.exportFallback && 'block'
					)}
					readonly
					aria-label="Chart as text"
					value={chart.exportFallback}
				></textarea>
			</div>
		{/if}
		{#if effectiveViewMode === 'today'}
			<!-- Picks live in the view until "Start my day". Remount per chart so they don't follow the switch. -->
			{#key chart.activeId}
				<TodayView />
			{/key}
		{/if}
		{#if effectiveViewMode === 'year'}
			<YearView />
		{/if}
	</main>

	{#if updateReady}
		<div class="fixed inset-x-0 bottom-[calc(max(18px,env(safe-area-inset-bottom,18px))+74px)] z-40 flex justify-center px-4 max-[600px]:pr-[calc(1rem+var(--dock-aside,0px))] print:hidden">
			<div class="pointer-events-auto flex items-center gap-3 rounded-full bg-ink py-2 pl-5 pr-2 text-[0.86rem] font-medium text-on-ink shadow-float" role="status">
				<span>Mandala was updated.</span>
				<button
					type="button"
					class="shadow-press inline-flex min-h-[34px] cursor-pointer appearance-none items-center rounded-full border-0 px-3.5 font-sans text-[0.82rem] font-[560] text-ink bg-on-ink hover:bg-[color-mix(in_oklch,var(--ink)_14%,var(--on-ink))] motion-safe:transition-[scale] motion-safe:duration-150 motion-safe:ease-ui active:scale-[0.97] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-on-ink"
					onclick={() => location.reload()}
				>
					Refresh
				</button>
				<button
					type="button"
					class="inline-flex size-[34px] cursor-pointer appearance-none items-center justify-center rounded-full border-0 p-0 text-on-ink hover:bg-[color-mix(in_oklch,var(--on-ink)_14%,transparent)] motion-safe:transition-[scale] motion-safe:duration-150 motion-safe:ease-ui active:scale-[0.94] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-on-ink"
					aria-label="Dismiss update notice"
					onclick={() => (updateReady = false)}
				>
					<Icon name="close" size={13} />
				</button>
			</div>
		</div>
	{/if}

	<Helper {helper} />

	<Dock label="Layout view mode">
		<DockTab
			icon="calendar"
			selected={effectiveViewMode === 'today'}
			title="Today's focus (T)"
			onclick={() => chart.setViewMode('today')}
		>
			Today
		</DockTab>
		<DockTab
			icon="grid"
			selected={effectiveViewMode === 'view'}
			title="Full 9×9 chart (V)"
			onclick={() => {
				chart.setViewMode('view');
				if (isMobile) window.scrollTo({ top: 0, behavior: 'smooth' });
			}}
		>
			Chart
		</DockTab>
		<DockTab
			icon="edit"
			selected={effectiveViewMode === 'edit'}
			title="Focused block editor (E)"
			onclick={() => chart.setViewMode('edit')}
		>
			Edit
		</DockTab>
		{#if !isMobile}
			<DockTab
				icon="columns"
				selected={effectiveViewMode === 'split'}
				title="Chart and editor side by side (S)"
				onclick={() => chart.setViewMode('split')}
			>
				Split
			</DockTab>
		{/if}
	</Dock>

	{#if isDraggingFile}
		<div class="pointer-events-none fixed inset-0 z-[100] flex items-center justify-center bg-[oklch(0.2_0.02_60/0.4)] backdrop-blur-[4px] print:hidden" aria-hidden="true">
			<div class="rounded-[28px] border-2 border-dashed border-ink bg-surface px-12 py-8 text-center font-serif text-[1.2rem] font-medium text-text shadow-float">Drop your Mandala JSON file here to import</div>
		</div>
	{/if}
</div>
