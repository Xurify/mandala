<script lang="ts">
	import { onMount } from 'svelte';
	import { chart } from '$lib/chart/chart.svelte';
	import {
		blockOfKey,
		CELL_COUNT,
		exportFilename,
		exportJson,
		getByKey,
		labelOfKey,
		parseChart,
		type ChartData
	} from '$lib/chart/model';
	import { exportChartPng } from '$lib/chart/export-image';
	import { readUnreadInk } from '$lib/chart/ocr';
	import type { AppTheme, ViewScale } from '$lib/chart/chart.svelte';
	import type { Preset } from '$lib/chart/presets';
	import BrandMark from './BrandMark.svelte';
	import ChartSwitcher from './ChartSwitcher.svelte';
	import DraftDialog from './DraftDialog.svelte';
	import MandalaGrid from './MandalaGrid.svelte';
	import MethodGuide from './MethodGuide.svelte';
	import PresetPicker from './PresetPicker.svelte';
	import ProgressRing from './ProgressRing.svelte';
	import SidePanel from './SidePanel.svelte';
	import Icon from './Icon.svelte';
	import { cn } from './ui/cn';
	import Button from './ui/Button.svelte';
	import Dock from './ui/Dock.svelte';
	import DockTab from './ui/DockTab.svelte';
	import Eyebrow from './ui/Eyebrow.svelte';
	import Menu from './ui/Menu.svelte';
	import MenuDivider from './ui/MenuDivider.svelte';
	import MenuItem from './ui/MenuItem.svelte';
	import Notice from './ui/Notice.svelte';
	import SegmentedControl from './ui/SegmentedControl.svelte';

	const themes = [
		{ value: 'system', label: 'Auto', icon: 'monitor' as const },
		{ value: 'light', label: 'Light', icon: 'sun' as const },
		{ value: 'dark', label: 'Dark', icon: 'moon' as const }
	];

	const scales = [
		{ value: 'fit', label: 'Fit', icon: 'minimize' as const, title: 'Fit entire chart on screen without scrolling' },
		{ value: 'large', label: 'Large', icon: 'maximize' as const, title: 'Enlarge chart for maximum text readability' }
	];

	let fileInputElement: HTMLInputElement | null = $state(null);
	let isDraggingFile = $state(false);
	let dragCounter = 0;
	let isMobile = $state(false);
	let searchInputElement: HTMLInputElement | null = $state(null);
	let draftOpen = $state(false);
	let presetOpen = $state(false);

	const shownHits = $derived(chart.hits.slice(0, 10));
	const extraHits = $derived(Math.max(0, chart.hits.length - 10));
	const noticeOn = $derived(chart.reading || chart.unread.length > 0);
	const noticeText = $derived.by(() => {
		if (chart.reading) return 'Reading handwriting…';
		const unreadCount = chart.unread.length;
		if (!unreadCount) return '';
		return (
			`${unreadCount} handwritten note${unreadCount === 1 ? ' isn’t' : 's aren’t'} searchable yet.` +
			' First read downloads a handwriting model (~120MB) to this device.'
		);
	});

	const effectiveViewMode = $derived(
		isMobile && chart.viewMode === 'split' ? 'edit' : chart.viewMode
	);

	onMount(() => {
		chart.load();
		if (chart.theme === 'light' || chart.theme === 'dark') {
			document.documentElement.setAttribute('data-theme', chart.theme);
		} else {
			document.documentElement.removeAttribute('data-theme');
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

		return () => {
			themeMediaQuery.removeEventListener('change', handleThemeChange);
			mobileMediaQuery.removeEventListener('change', handleMobileChange);
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

	function handleExportChart() {
		exportChartFile();
	}

	async function handleExportPoster() {
		chart.say('Generating high-resolution poster…', true);
		try {
			await exportChartPng(chart.data);
			chart.say('Poster exported.');
		} catch (error) {
			chart.say('Failed to generate poster image.');
		}
	}

	function handlePrintChart() {
		window.print();
	}

	function handleImportClick() {
		fileInputElement?.click();
	}

	function handleCopyAsText() {
		copyText();
	}

	function handleClearChart() {
		if (chart.dirty) {
			const userConfirmed = window.confirm(
				'Are you sure you want to clear your chart? This action cannot be undone.'
			);
			if (!userConfirmed) return;
		}
		chart.clearAll();
	}

	function handleOpenDraft() {
		draftOpen = true;
	}

	function handleApplyDraft(data: ChartData): void {
		if (chart.applyDraft(data)) draftOpen = false;
	}

	function handleOpenPresets() {
		presetOpen = true;
	}

	function handleApplyPreset(preset: Preset): void {
		if (chart.applyPreset(preset)) presetOpen = false;
	}

	function handleWindowKeydown(event: KeyboardEvent): void {
		const isTyping =
			event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement;

		if (event.key === 'Escape') {
			const escapeFromGuide =
				event.target instanceof Element && event.target.closest('dialog') !== null;
			if (escapeFromGuide) return;
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
		} else if (
			(event.key === '/' || ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k')) &&
			!isTyping
		) {
			event.preventDefault();
			searchInputElement?.focus();
		}
	}

	function isTheme(value: string): value is AppTheme {
		return value === 'system' || value === 'light' || value === 'dark';
	}

	function isScale(value: string): value is ViewScale {
		return value === 'fit' || value === 'large';
	}

	function exportChartFile() {
		const jsonContent = exportJson(chart.data);
		const filename = exportFilename(chart.data);
		const blob = new Blob([jsonContent], { type: 'application/json' });
		const downloadUrl = URL.createObjectURL(blob);
		const downloadLink = document.createElement('a');
		downloadLink.href = downloadUrl;
		downloadLink.download = filename;
		downloadLink.click();
		URL.revokeObjectURL(downloadUrl);
		chart.say(`Exported as ${filename}`);
	}

	function importChartText(content: string): boolean {
		const parsedChart = parseChart(content);
		if (!parsedChart) {
			chart.say('Invalid chart file. Please choose a valid Mandala JSON file.');
			return false;
		}
		return chart.importChart(parsedChart);
	}

	async function handleFileImport(event: Event) {
		const target = event.currentTarget as HTMLInputElement;
		const file = target.files?.[0];
		if (!file) return;

		try {
			const text = await file.text();
			importChartText(text);
		} catch {
			chart.say('Failed to read the imported file.');
		} finally {
			target.value = '';
		}
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

		if (!file.name.endsWith('.json') && file.type !== 'application/json') {
			chart.say('Please drop a valid .json file.');
			return;
		}

		try {
			const text = await file.text();
			importChartText(text);
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
				chart.say('Copied to clipboard.');
			} catch {
				fallback();
			}
		} else fallback();
	}

	async function onRead() {
		if (chart.reading) {
			chart.stopRead();
			return;
		}
		const keys = chart.unread;
		if (!keys.length) return;
		const signal = chart.beginRead();
		const result = await readUnreadInk(
			keys.map((key) => ({ key, strokes: chart.strokesOf(key) })),
			signal
		);
		if (signal.aborted || result.failed === 'cancelled') {
			chart.reading = false;
			chart.say('Stopped.');
			return;
		}
		let done = 0;
		let missed = 0;
		for (const [key, text] of result.texts) {
			if (!text) missed++;
			else if (chart.applyRead(key, text)) done++;
			else missed++;
		}
		chart.saveNow();
		chart.reading = false;
		let message = `Read ${done} note${done === 1 ? '.' : 's.'}`;
		if (missed) message += ` ${missed} ${missed === 1 ? 'was' : 'were'} too unclear to read.`;
		if (result.failed === 'offline') {
			message += ' Need a connection the first time to download the handwriting model.';
		} else if (result.failed) {
			message += ' Something went wrong. Try again.';
		}
		chart.say(message);
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

<div
	class="mx-auto max-w-[1180px] pt-[max(24px,env(safe-area-inset-top,24px))] pr-[max(28px,env(safe-area-inset-right,28px))] pb-[calc(128px+env(safe-area-inset-bottom,0px))] pl-[max(28px,env(safe-area-inset-left,28px))] max-[900px]:pt-[max(14px,env(safe-area-inset-top,14px))] max-[900px]:pr-[max(14px,env(safe-area-inset-right,14px))] max-[900px]:pb-[calc(112px+env(safe-area-inset-bottom,0px))] max-[900px]:pl-[max(14px,env(safe-area-inset-left,14px))] print:!m-0 print:!w-full print:!max-w-full print:!p-0"
>
	<header class="relative z-30 print:hidden">
		<div class="flex items-center gap-x-4 gap-y-3 max-[900px]:flex-wrap max-[900px]:gap-x-2 max-[900px]:gap-y-2.5">
			<div class="flex min-w-0 shrink-0 items-center gap-2.5 text-text max-[900px]:flex-auto">
				<BrandMark />
				<span class="font-serif text-[1.3rem] leading-none font-[560] tracking-[-0.02em]">Mandala</span>
			</div>

			<div class="relative ms-auto w-full max-w-[340px] flex-[0_1_340px] max-[900px]:order-3 max-[900px]:ms-0 max-[900px]:max-w-none max-[900px]:flex-auto">
				<span class="pointer-events-none absolute start-[15px] top-1/2 flex -translate-y-1/2 text-muted" aria-hidden="true">
					<Icon name="search" size={16} />
				</span>
				<input
					bind:this={searchInputElement}
					class="peer h-[42px] w-full rounded-full border-0 bg-sunken ps-[42px] pe-10 font-sans text-base text-text motion-safe:transition-[background-color,box-shadow] motion-safe:duration-150 placeholder:text-muted hover:bg-sunken-hover focus:bg-surface focus:shadow-[0_0_0_1.5px_var(--ink)] focus:outline-none focus-visible:bg-surface focus-visible:shadow-[0_0_0_1.5px_var(--ink)] focus-visible:outline-none [&::-webkit-search-cancel-button]:hidden"
					type="search"
					placeholder="Search your chart"
					aria-label="Search the chart"
					autocomplete="off"
					spellcheck="false"
					value={chart.query}
					oninput={(event) => chart.setQuery(event.currentTarget.value)}
				/>
				{#if chart.query.trim()}
					<button
						type="button"
						class="absolute end-[9px] top-1/2 flex size-[26px] -translate-y-1/2 cursor-pointer items-center justify-center rounded-full border-0 bg-sunken-hover p-0 text-text after:absolute after:-inset-2 after:content-['']"
						aria-label="Clear search"
						onclick={() => chart.setQuery('')}
					>
						<Icon name="close" size={12} strokeWidth={2.2} />
					</button>
				{:else}
					<kbd class="pointer-events-none absolute end-3 top-1/2 min-w-[22px] -translate-y-1/2 rounded-md bg-surface px-1.5 py-px text-center font-sans text-[0.72rem] font-semibold text-muted shadow-card peer-focus:hidden max-[900px]:hidden" aria-hidden="true">/</kbd>
				{/if}
			</div>

			<Menu label="More actions">
				<MenuItem icon="printer" badge="Ctrl+P" onclick={handlePrintChart}>Print chart</MenuItem>
				<MenuItem icon="image" badge=".png" onclick={handleExportPoster}>Export poster</MenuItem>
				<MenuItem icon="download" badge=".json" onclick={handleExportChart}>Export data</MenuItem>
				<MenuItem icon="upload" badge=".json" onclick={handleImportClick}>Import data</MenuItem>
				<MenuItem icon="copy" onclick={handleCopyAsText}>Copy as text</MenuItem>
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
				<MenuDivider />
				<MenuItem icon="trash" tone="danger" onclick={handleClearChart}>Clear chart</MenuItem>
			</Menu>
		</div>

		<div class="mt-8 mb-6 grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-12 gap-y-5 max-[900px]:mt-6 max-[900px]:mb-5 max-[900px]:grid-cols-1 max-[900px]:gap-4">
			<div class="min-w-0">
				<Eyebrow class="mb-2">Your chart</Eyebrow>
				<ChartSwitcher />
				<div class="mt-3.5 flex flex-wrap items-center gap-2 max-[900px]:mt-3">
					<Button icon="list" onclick={handleOpenPresets}>Start from a preset</Button>
					<Button variant="soft" icon="sparkles" onclick={handleOpenDraft}>Get a prompt</Button>
					<MethodGuide />
				</div>
			</div>

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
		</div>

		<DraftDialog bind:open={draftOpen} onapply={handleApplyDraft} />
		<PresetPicker bind:open={presetOpen} onapply={handleApplyPreset} />
		<input
			bind:this={fileInputElement}
			type="file"
			accept=".json,application/json"
			class="sr-only"
			tabindex="-1"
			aria-hidden="true"
			onchange={handleFileImport}
		/>
	</header>

	<div class="mb-5 flex max-w-[900px] flex-wrap gap-1.5 empty:hidden print:hidden" aria-live="polite">
		{#if chart.query.trim() && !shownHits.length}
			<div class="px-0.5 py-1.5 text-[0.86rem] text-muted">
				{chart.unread.length
					? 'No matches. Handwriting is only searchable after it has been read.'
					: 'No matches.'}
			</div>
		{/if}
		{#each shownHits as key (key)}
			<button
				type="button"
				class="max-w-full min-h-[34px] cursor-pointer truncate rounded-full border-0 bg-surface px-3.5 text-start font-sans text-[0.86rem] text-text shadow-card motion-safe:transition-colors motion-safe:duration-[120ms] hover:bg-sunken"
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

	{#if noticeOn}
		<Notice class="mb-5 print:hidden">
			{noticeText}
			{#snippet action()}
				<Button size="sm" variant={chart.reading ? 'soft' : 'primary'} onclick={onRead}>
					{chart.reading ? 'Stop' : 'Read handwriting'}
				</Button>
			{/snippet}
		</Notice>
	{/if}

	{#if effectiveViewMode === 'view'}
		<div
			class={cn(
				'mx-auto mb-3.5 flex w-full items-center justify-between gap-3 print:hidden max-[900px]:mb-2.5 max-[900px]:justify-end',
				chart.viewScale === 'fit' && 'max-w-[min(940px,calc(100vh-180px),100%)]',
				chart.viewScale === 'large' && 'max-w-[min(1120px,100%)]'
			)}
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
			(effectiveViewMode === 'view' || effectiveViewMode === 'edit') && 'flex-col items-center'
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
					effectiveViewMode === 'edit' && 'hidden',
					effectiveViewMode === 'view' && 'mx-auto w-full max-w-none flex-none motion-safe:transition-[max-width] motion-safe:duration-200 motion-safe:ease-ui',
					effectiveViewMode === 'view' && chart.viewScale === 'fit' && 'max-w-[min(940px,calc(100vh-180px),100%)]',
					effectiveViewMode === 'view' && chart.viewScale === 'large' && 'max-w-[min(1120px,100%)]',
					effectiveViewMode === 'split' && 'max-w-[660px] flex-[1_1_520px]'
				)}
			>
				<MandalaGrid
					mode={effectiveViewMode === 'edit' ? 'view' : effectiveViewMode}
					scale={chart.viewScale}
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
				<SidePanel />
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
	</main>

	<Dock label="Layout view mode">
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
