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
	import BrandMark from './BrandMark.svelte';
	import ChartSwitcher from './ChartSwitcher.svelte';
	import DraftDialog from './DraftDialog.svelte';
	import MandalaGrid from './MandalaGrid.svelte';
	import MethodGuide from './MethodGuide.svelte';
	import PresetPicker from './PresetPicker.svelte';
	import ProgressRing from './ProgressRing.svelte';
	import SidePanel from './SidePanel.svelte';
	import Icon from './Icon.svelte';
	import type { Preset } from '$lib/chart/presets';

	let menuOpen = $state(false);
	let menuContainerElement: HTMLDivElement | null = $state(null);
	let menuTriggerElement: HTMLButtonElement | null = $state(null);
	let fileInputElement: HTMLInputElement | null = $state(null);
	let isDraggingFile = $state(false);
	let dragCounter = 0;
	let isMobile = $state(false);
	let searchInputElement: HTMLInputElement | null = $state(null);
	let methodOpen = $state(false);
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
		menuOpen = false;
		exportChartFile();
	}

	async function handleExportPoster() {
		menuOpen = false;
		chart.say('Generating high-resolution poster…', true);
		try {
			await exportChartPng(chart.data);
			chart.say('Poster exported.');
		} catch (error) {
			chart.say('Failed to generate poster image.');
		}
	}

	function handlePrintChart() {
		menuOpen = false;
		window.print();
	}

	function handleImportClick() {
		menuOpen = false;
		fileInputElement?.click();
	}

	function handleCopyAsText() {
		menuOpen = false;
		copyText();
	}

	function handleClearChart() {
		menuOpen = false;
		if (chart.dirty) {
			const userConfirmed = window.confirm(
				'Are you sure you want to clear your chart? This action cannot be undone.'
			);
			if (!userConfirmed) return;
		}
		chart.clearAll();
	}

	function handleOpenDraft() {
		menuOpen = false;
		draftOpen = true;
	}

	function handleApplyDraft(data: ChartData): void {
		if (chart.applyDraft(data)) draftOpen = false;
	}

	function handleOpenPresets() {
		menuOpen = false;
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
			if (menuOpen) {
				menuOpen = false;
				menuTriggerElement?.focus();
			} else if (chart.query.trim()) {
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

	function handleWindowClick(event: MouseEvent) {
		if (menuOpen && menuContainerElement && !menuContainerElement.contains(event.target as Node)) {
			menuOpen = false;
		}
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
	onclick={handleWindowClick}
/>
<svelte:document onvisibilitychange={persistHidden} />

<div class="wrap">
	<header class="top">
		<div class="topbar">
			<div class="name">
				<BrandMark />
				<span class="wordmark">Mandala</span>
			</div>

			<div class="search-box">
				<span class="search-icon" aria-hidden="true">
					<Icon name="search" size={16} />
				</span>
				<input
					bind:this={searchInputElement}
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
						class="search-clear-btn"
						aria-label="Clear search"
						onclick={() => chart.setQuery('')}
					>
						<Icon name="close" size={12} strokeWidth={2.2} />
					</button>
				{:else}
					<kbd class="search-kbd" aria-hidden="true">/</kbd>
				{/if}
			</div>

			<div class="menu-wrap" bind:this={menuContainerElement}>
				<button
					bind:this={menuTriggerElement}
					class="icon-btn"
					type="button"
					aria-label="More actions"
					title="More actions"
					aria-haspopup="menu"
					aria-expanded={menuOpen}
					onclick={() => {
						menuOpen = !menuOpen;
					}}
				>
					<Icon name="more" size={20} />
				</button>

				{#if menuOpen}
					<div
						class="menu-backdrop"
						aria-hidden="true"
						onclick={() => {
							menuOpen = false;
						}}
					></div>
					<div class="menu-dropdown" role="menu">
						<button class="menu-item" type="button" role="menuitem" onclick={handlePrintChart}>
							<span class="menu-item-main">
								<Icon name="printer" size={16} />
								<span>Print chart</span>
							</span>
							<span class="menu-badge">Ctrl+P</span>
						</button>
						<button class="menu-item" type="button" role="menuitem" onclick={handleExportPoster}>
							<span class="menu-item-main">
								<Icon name="image" size={16} />
								<span>Export poster</span>
							</span>
							<span class="menu-badge">.png</span>
						</button>
						<button class="menu-item" type="button" role="menuitem" onclick={handleExportChart}>
							<span class="menu-item-main">
								<Icon name="download" size={16} />
								<span>Export data</span>
							</span>
							<span class="menu-badge">.json</span>
						</button>
						<button class="menu-item" type="button" role="menuitem" onclick={handleImportClick}>
							<span class="menu-item-main">
								<Icon name="upload" size={16} />
								<span>Import data</span>
							</span>
							<span class="menu-badge">.json</span>
						</button>
						<button class="menu-item" type="button" role="menuitem" onclick={handleCopyAsText}>
							<span class="menu-item-main">
								<Icon name="copy" size={16} />
								<span>Copy as text</span>
							</span>
						</button>
						<div class="menu-divider" role="separator"></div>
						<div class="menu-theme-row">
							<span class="menu-theme-label">Theme</span>
							<div class="seg seg-sm" role="group" aria-label="Color theme">
								<button
									type="button"
									aria-pressed={chart.theme === 'system'}
									onclick={() => chart.setTheme('system')}
								>
									<Icon name="monitor" size={12} />
									<span>Auto</span>
								</button>
								<button
									type="button"
									aria-pressed={chart.theme === 'light'}
									onclick={() => chart.setTheme('light')}
								>
									<Icon name="sun" size={12} />
									<span>Light</span>
								</button>
								<button
									type="button"
									aria-pressed={chart.theme === 'dark'}
									onclick={() => chart.setTheme('dark')}
								>
									<Icon name="moon" size={12} />
									<span>Dark</span>
								</button>
							</div>
						</div>
						<div class="menu-divider" role="separator"></div>
						<button class="menu-item danger" type="button" role="menuitem" onclick={handleClearChart}>
							<span class="menu-item-main">
								<Icon name="trash" size={16} />
								<span>Clear chart</span>
							</span>
						</button>
					</div>
				{/if}
			</div>
		</div>

		<div class="hero">
			<div class="hero-main">
				<p class="eyebrow">Your chart</p>
				<ChartSwitcher />
				<p class="lede">
					One goal at the center, eight pillars around it, eight actions for each. Type, or write
					by hand.
				</p>
				<div class="hero-actions">
					<button type="button" class="btn btn-primary" onclick={handleOpenPresets}>
						<Icon name="list" size={16} />
						<span>Start from a preset</span>
					</button>
					<button type="button" class="btn btn-soft" onclick={handleOpenDraft}>
						<Icon name="sparkles" size={16} />
						<span>Get a prompt</span>
					</button>
					<MethodGuide
						open={methodOpen}
						onopen={() => {
							methodOpen = true;
						}}
						onclose={() => {
							methodOpen = false;
						}}
					/>
				</div>
			</div>

			<div class="hero-progress">
				<ProgressRing size={isMobile ? 56 : 76} />
				<dl class="stats">
					<div class="stat" class:done={chart.milestones.goalSet}>
						<dt>Goal</dt>
						<dd>{chart.milestones.goalSet ? 'Set' : 'Not yet'}</dd>
					</div>
					<div class="stat" class:done={chart.milestones.pillarsCount === 8}>
						<dt>Pillars</dt>
						<dd>{chart.milestones.pillarsCount}<span>/8</span></dd>
					</div>
					<div class="stat" class:done={chart.milestones.actionsCount === 64}>
						<dt>Actions</dt>
						<dd>{chart.milestones.actionsCount}<span>/64</span></dd>
					</div>
				</dl>
			</div>
		</div>

		<DraftDialog
			open={draftOpen}
			onclose={() => {
				draftOpen = false;
			}}
			onapply={handleApplyDraft}
		/>
		<PresetPicker
			open={presetOpen}
			onclose={() => {
				presetOpen = false;
			}}
			onapply={handleApplyPreset}
		/>
		<input
			bind:this={fileInputElement}
			type="file"
			accept=".json,application/json"
			class="visually-hidden"
			tabindex="-1"
			aria-hidden="true"
			onchange={handleFileImport}
		/>
	</header>

	<div class="results" aria-live="polite">
		{#if chart.query.trim() && !shownHits.length}
			<div class="res-note">
				{chart.unread.length
					? 'No matches. Handwriting is only searchable after it has been read.'
					: 'No matches.'}
			</div>
		{/if}
		{#each shownHits as key (key)}
			<button
				type="button"
				class="res"
				onclick={() => {
					selectBlock(blockOfKey(key), key);
					chart.setViewMode('edit');
				}}
			>
				<b>{labelOfKey(chart.data, key)}</b>
				{getByKey(chart.data, key).trim()}
			</button>
		{/each}
		{#if extraHits}
			<div class="res-note">+{extraHits} more</div>
		{/if}
	</div>

	<div class="notice" class:on={noticeOn}>
		<span>{noticeText}</span>
		{#if chart.unread.length || chart.reading}
			<button
				class="btn btn-sm"
				class:btn-primary={!chart.reading}
				class:btn-soft={chart.reading}
				type="button"
				onclick={onRead}
			>
				{chart.reading ? 'Stop' : 'Read handwriting'}
			</button>
		{/if}
	</div>

	{#if effectiveViewMode === 'view'}
		<div
			class="view-mode-toolbar"
			class:scale-fit={chart.viewScale === 'fit'}
			class:scale-large={chart.viewScale === 'large'}
		>
			<span class="view-toolbar-hint">Double-click a cell to edit its block</span>
			<div class="seg seg-sm" role="group" aria-label="Chart scale">
				<button
					type="button"
					aria-pressed={chart.viewScale === 'fit'}
					title="Fit entire chart on screen without scrolling"
					onclick={() => chart.setViewScale('fit')}
				>
					<Icon name="minimize" size={13} />
					<span>Fit</span>
				</button>
				<button
					type="button"
					aria-pressed={chart.viewScale === 'large'}
					title="Enlarge chart for maximum text readability"
					onclick={() => chart.setViewScale('large')}
				>
					<Icon name="maximize" size={13} />
					<span>Large</span>
				</button>
			</div>
		</div>
	{/if}

	<main
		class="layout mode-{effectiveViewMode}"
		class:scale-fit={chart.viewScale === 'fit'}
		class:scale-large={chart.viewScale === 'large'}
	>
		{#if effectiveViewMode === 'view' || effectiveViewMode === 'split'}
			<div class="chart">
				<MandalaGrid onSelect={selectBlock} onEdit={handleEditBlock} />
			</div>
		{/if}
		{#if effectiveViewMode === 'edit' || effectiveViewMode === 'split'}
			<div class="side">
				<SidePanel />
				<textarea
					class="export-box"
					class:on={!!chart.exportFallback}
					readonly
					aria-label="Chart as text"
					value={chart.exportFallback}
				></textarea>
			</div>
		{/if}
	</main>

	<div class="dock-wrap">
		<div class="toast" class:on={!!chart.status} role="status" aria-live="polite">
			{chart.status}
		</div>
		<div class="dock" role="tablist" aria-label="Layout view mode">
			<button
				type="button"
				role="tab"
				class="dock-btn"
				aria-selected={effectiveViewMode === 'view'}
				title="Full 9×9 chart (V)"
				onclick={() => {
					chart.setViewMode('view');
					if (isMobile) window.scrollTo({ top: 0, behavior: 'smooth' });
				}}
			>
				<Icon name="grid" size={16} />
				<span>Chart</span>
			</button>
			<button
				type="button"
				role="tab"
				class="dock-btn"
				aria-selected={effectiveViewMode === 'edit'}
				title="Focused block editor (E)"
				onclick={() => chart.setViewMode('edit')}
			>
				<Icon name="edit" size={16} />
				<span>Edit</span>
			</button>
			{#if !isMobile}
				<button
					type="button"
					role="tab"
					class="dock-btn"
					aria-selected={effectiveViewMode === 'split'}
					title="Chart and editor side by side (S)"
					onclick={() => chart.setViewMode('split')}
				>
					<Icon name="columns" size={16} />
					<span>Split</span>
				</button>
			{/if}
		</div>
	</div>

	{#if isDraggingFile}
		<div class="drop-overlay" aria-hidden="true">
			<div class="drop-modal">Drop your Mandala JSON file here to import</div>
		</div>
	{/if}
</div>
