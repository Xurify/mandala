<script lang="ts">
	import { onMount } from 'svelte';
	import { chart } from '$lib/chart/chart.svelte';
	import {
		blockOfKey,
		CELL_COUNT,
		exportFilename,
		exportJson,
		getByKey,
		HUES,
		idx,
		labelOfKey,
		parseChart,
		POS
	} from '$lib/chart/model';
	import { exportChartPng } from '$lib/chart/export-image';
	import { readUnreadInk } from '$lib/chart/ocr';
	import MandalaGrid from './MandalaGrid.svelte';
	import SidePanel from './SidePanel.svelte';
	import Icon from './Icon.svelte';

	let menuOpen = $state(false);
	let menuContainerElement: HTMLDivElement | null = $state(null);
	let menuTriggerElement: HTMLButtonElement | null = $state(null);
	let fileInputElement: HTMLInputElement | null = $state(null);
	let isDraggingFile = $state(false);
	let dragCounter = 0;
	let isMobile = $state(false);
	let searchInputElement: HTMLInputElement | null = $state(null);

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

	const selectedBlockTitle = $derived.by(() => {
		if (chart.sel === 4) return chart.data.goal.trim() || 'Center Goal & Pillars';
		const pillarIndex = idx(chart.sel);
		return chart.data.pillars[pillarIndex]?.trim() || `Pillar ${pillarIndex + 1}`;
	});

	const selectedBlockSubtitle = $derived.by(() => {
		if (chart.sel === 4) {
			const pillarsCount = chart.milestones.pillarsCount;
			return `${pillarsCount} of 8 pillars set · Goal in center`;
		}
		const pillarIndex = idx(chart.sel);
		const count = chart.milestones.pillarActionCounts[pillarIndex] ?? 0;
		return `Pillar ${pillarIndex + 1} (${POS[pillarIndex]}) · ${count} of 8 actions defined`;
	});

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

	function handleEditCurrentBlock(): void {
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

	function handleLoadExample() {
		menuOpen = false;
		if (chart.dirty) {
			const userConfirmed = window.confirm(
				'Loading the example will replace your current chart. Do you want to proceed?'
			);
			if (!userConfirmed) return;
		}
		chart.loadExample();
	}

	function handleWindowKeydown(event: KeyboardEvent): void {
		const isTyping =
			event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement;

		if (event.key === 'Escape') {
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
		if (chart.dirty) {
			const userConfirmed = window.confirm(
				'Importing will replace your current chart. Do you want to proceed?'
			);
			if (!userConfirmed) {
				return false;
			}
		}
		chart.importChart(parsedChart);
		return true;
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

	function handleMarkPointerEnter(colorIndex: number, event: PointerEvent) {
		if (event.pointerType === 'touch') return;
		chart.hoveredColorIndex = colorIndex;
	}

	function handleMarkPointerLeave(event: PointerEvent) {
		if (event.pointerType === 'touch') return;
		chart.hoveredColorIndex = null;
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
		<div class="brand">
			<div class="name">
				<svg class="mark" viewBox="0 0 150 150" aria-hidden="true">
					<rect
						role="presentation"
						x="14"
						y="14"
						width="36"
						height="36"
						rx="8"
						fill="#b85c5a"
						class:highlight={chart.hoveredColorIndex === 0}
						onpointerenter={(event) => handleMarkPointerEnter(0, event)}
						onpointerleave={handleMarkPointerLeave}
					/>
					<rect
						role="presentation"
						x="57"
						y="14"
						width="36"
						height="36"
						rx="8"
						fill="#c98a3f"
						class:highlight={chart.hoveredColorIndex === 1}
						onpointerenter={(event) => handleMarkPointerEnter(1, event)}
						onpointerleave={handleMarkPointerLeave}
					/>
					<rect
						role="presentation"
						x="100"
						y="14"
						width="36"
						height="36"
						rx="8"
						fill="#c4b230"
						class:highlight={chart.hoveredColorIndex === 2}
						onpointerenter={(event) => handleMarkPointerEnter(2, event)}
						onpointerleave={handleMarkPointerLeave}
					/>
					<rect
						role="presentation"
						x="14"
						y="57"
						width="36"
						height="36"
						rx="8"
						fill="#4f9a62"
						class:highlight={chart.hoveredColorIndex === 3}
						onpointerenter={(event) => handleMarkPointerEnter(3, event)}
						onpointerleave={handleMarkPointerLeave}
					/>
					<rect
						role="presentation"
						x="57"
						y="57"
						width="36"
						height="36"
						rx="8"
						fill="#d5ddf5"
						class:highlight={chart.hoveredColorIndex === -1}
						onpointerenter={(event) => handleMarkPointerEnter(-1, event)}
						onpointerleave={handleMarkPointerLeave}
					/>
					<rect
						role="presentation"
						x="100"
						y="57"
						width="36"
						height="36"
						rx="8"
						fill="#20a3a3"
						class:highlight={chart.hoveredColorIndex === 4}
						onpointerenter={(event) => handleMarkPointerEnter(4, event)}
						onpointerleave={handleMarkPointerLeave}
					/>
					<rect
						role="presentation"
						x="14"
						y="100"
						width="36"
						height="36"
						rx="8"
						fill="#4a8fc4"
						class:highlight={chart.hoveredColorIndex === 5}
						onpointerenter={(event) => handleMarkPointerEnter(5, event)}
						onpointerleave={handleMarkPointerLeave}
					/>
					<rect
						role="presentation"
						x="57"
						y="100"
						width="36"
						height="36"
						rx="8"
						fill="#8079d0"
						class:highlight={chart.hoveredColorIndex === 6}
						onpointerenter={(event) => handleMarkPointerEnter(6, event)}
						onpointerleave={handleMarkPointerLeave}
					/>
					<rect
						role="presentation"
						x="100"
						y="100"
						width="36"
						height="36"
						rx="8"
						fill="#c26a9c"
						class:highlight={chart.hoveredColorIndex === 7}
						onpointerenter={(event) => handleMarkPointerEnter(7, event)}
						onpointerleave={handleMarkPointerLeave}
					/>
				</svg>
				<h1>Mandala Method</h1>
			</div>
			<p class="lede">
				One goal at the center, eight pillars around it, eight actions for each. Type, or write by
				hand.
			</p>
		</div>
		<div class="top-controls">
			<div class="view-mode-seg" role="tablist" aria-label="Layout view mode">
				<button
					type="button"
					role="tab"
					class="view-mode-btn"
					class:active={effectiveViewMode === 'view'}
					aria-selected={effectiveViewMode === 'view'}
					title="View Mode: Big 9×9 chart (V)"
					onclick={() => chart.setViewMode('view')}
				>
					<Icon name="grid" size={14} />
					<span>View</span>
				</button>
				<button
					type="button"
					role="tab"
					class="view-mode-btn"
					class:active={effectiveViewMode === 'edit'}
					aria-selected={effectiveViewMode === 'edit'}
					title="Edit Mode: Focused block editor (E)"
					onclick={() => chart.setViewMode('edit')}
				>
					<Icon name="edit" size={14} />
					<span>Edit</span>
				</button>
				{#if !isMobile}
					<button
						type="button"
						role="tab"
						class="view-mode-btn desktop-only"
						class:active={effectiveViewMode === 'split'}
						aria-selected={effectiveViewMode === 'split'}
						title="Split Mode: Side-by-side view (S)"
						onclick={() => chart.setViewMode('split')}
					>
						<Icon name="columns" size={14} />
						<span>Split</span>
					</button>
				{/if}
			</div>

			<div class="menu-wrap" bind:this={menuContainerElement}>
				<button
					bind:this={menuTriggerElement}
					class="menu-trigger"
					type="button"
					aria-haspopup="menu"
					aria-expanded={menuOpen}
					onclick={() => {
						menuOpen = !menuOpen;
					}}
				>
					<span>Actions</span>
					<Icon name="chevron-down" size={14} class="chevron" />
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
					<button
						class="menu-item"
						type="button"
						role="menuitem"
						onclick={handlePrintChart}
					>
						<span class="menu-item-main">
							<Icon name="printer" size={16} />
							<span>Print chart</span>
						</span>
						<span class="menu-badge">Ctrl+P</span>
					</button>
					<button
						class="menu-item"
						type="button"
						role="menuitem"
						onclick={handleExportPoster}
					>
						<span class="menu-item-main">
							<Icon name="image" size={16} />
							<span>Export poster</span>
						</span>
						<span class="menu-badge">.png</span>
					</button>
					<button
						class="menu-item"
						type="button"
						role="menuitem"
						onclick={handleExportChart}
					>
						<span class="menu-item-main">
							<Icon name="download" size={16} />
							<span>Export data</span>
						</span>
						<span class="menu-badge">.json</span>
					</button>
					<button
						class="menu-item"
						type="button"
						role="menuitem"
						onclick={handleImportClick}
					>
						<span class="menu-item-main">
							<Icon name="upload" size={16} />
							<span>Import data</span>
						</span>
						<span class="menu-badge">.json</span>
					</button>
					<button
						class="menu-item"
						type="button"
						role="menuitem"
						onclick={handleCopyAsText}
					>
						<span class="menu-item-main">
							<Icon name="copy" size={16} />
							<span>Copy as text</span>
						</span>
					</button>
					<div class="menu-divider" role="separator"></div>
					<div class="menu-theme-row">
						<span class="menu-theme-label">Theme</span>
						<div class="theme-seg" role="group" aria-label="Color theme">
							<button
								type="button"
								class="theme-btn"
								class:active={chart.theme === 'system'}
								onclick={() => chart.setTheme('system')}
							>
								<Icon name="monitor" size={12} />
								<span>Auto</span>
							</button>
							<button
								type="button"
								class="theme-btn"
								class:active={chart.theme === 'light'}
								onclick={() => chart.setTheme('light')}
							>
								<Icon name="sun" size={12} />
								<span>Light</span>
							</button>
							<button
								type="button"
								class="theme-btn"
								class:active={chart.theme === 'dark'}
								onclick={() => chart.setTheme('dark')}
							>
								<Icon name="moon" size={12} />
								<span>Dark</span>
							</button>
						</div>
					</div>
					<div class="menu-divider" role="separator"></div>
					<button
						class="menu-item danger"
						type="button"
						role="menuitem"
						onclick={handleClearChart}
					>
						<span class="menu-item-main">
							<Icon name="trash" size={16} />
							<span>Clear chart</span>
						</span>
					</button>
					<div class="menu-divider" role="separator"></div>
					<button
						class="menu-item subtle"
						type="button"
						role="menuitem"
						onclick={handleLoadExample}
					>
						<span class="menu-item-main">
							<Icon name="sparkles" size={16} />
							<span>Load example</span>
						</span>
					</button>
				</div>
			{/if}
		</div>
	</div>
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

	<div class="progress-wrap">
		<div class="milestones-bar">
			<div class="milestones-group">
				<div class="milestone-badge" class:done={chart.milestones.goalSet}>
					<Icon name="target" size={12} strokeWidth={1.9} />
					<span class="badge-label">Goal</span>
					<span class="badge-count">{chart.milestones.goalSet ? '1/1' : '0/1'}</span>
					{#if chart.milestones.goalSet}
						<Icon name="check" size={10} strokeWidth={2.6} class="badge-done-check" />
					{/if}
				</div>
				<div class="milestone-badge" class:done={chart.milestones.pillarsCount === 8}>
					<Icon name="compass" size={12} strokeWidth={1.9} />
					<span class="badge-label">Pillars</span>
					<span class="badge-count">{chart.milestones.pillarsCount}/8</span>
					{#if chart.milestones.pillarsCount === 8}
						<Icon name="check" size={10} strokeWidth={2.6} class="badge-done-check" />
					{/if}
				</div>
				<div class="milestone-badge" class:done={chart.milestones.actionsCount === 64}>
					<Icon name="list" size={12} strokeWidth={2} />
					<span class="badge-label">Actions</span>
					<span class="badge-count">{chart.milestones.actionsCount}/64</span>
					{#if chart.milestones.actionsCount === 64}
						<Icon name="check" size={10} strokeWidth={2.6} class="badge-done-check" />
					{/if}
				</div>
			</div>
			<span class="progress-label">{chart.filled} of {CELL_COUNT} filled</span>
		</div>
		<div class="track">
			<div class="fill" style:width="{(chart.filled / CELL_COUNT) * 100}%"></div>
		</div>
	</div>

	<div class="search">
		<div class="search-box">
			<span class="search-icon" aria-hidden="true">
				<Icon name="search" size={16} />
			</span>
			<input
				bind:this={searchInputElement}
				type="search"
				placeholder="Search goal, pillars and actions"
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
					<Icon name="close" size={13} />
				</button>
			{/if}
		</div>
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
	</div>

	<div class="notice" class:on={noticeOn}>
		<span>{noticeText}</span>
		{#if chart.unread.length || chart.reading}
			<button class="btn" class:primary={!chart.reading} type="button" onclick={onRead}>
				{chart.reading ? 'Stop' : 'Read handwriting'}
			</button>
		{/if}
	</div>
	<div class="status" role="status" aria-live="polite">{chart.status}</div>

	{#if isMobile}
		<div class="mobile-view-toggle" role="tablist" aria-label="View mode">
			<button
				type="button"
				role="tab"
				class="mobile-view-btn"
				class:active={effectiveViewMode === 'view'}
				aria-selected={effectiveViewMode === 'view'}
				onclick={() => {
					chart.setViewMode('view');
				}}
			>
				<Icon name="grid" size={15} />
				<span>9×9 Chart</span>
			</button>
			<button
				type="button"
				role="tab"
				class="mobile-view-btn"
				class:active={effectiveViewMode === 'edit'}
				aria-selected={effectiveViewMode === 'edit'}
				onclick={() => {
					chart.setViewMode('edit');
				}}
			>
				<Icon name="edit" size={15} />
				<span>Editor</span>
			</button>
		</div>
	{/if}

	{#if effectiveViewMode === 'view'}
		<div class="view-mode-toolbar">
			<div class="view-toolbar-meta">
				<span class="view-toolbar-badge">9×9 Full Chart</span>
				<span class="view-toolbar-hint">Double-click any cell to edit</span>
			</div>
			<div class="view-scale-seg" role="group" aria-label="Chart scale">
				<button
					type="button"
					class="scale-btn"
					class:active={chart.viewScale === 'fit'}
					title="Fit entire chart on screen without scrolling"
					onclick={() => chart.setViewScale('fit')}
				>
					<Icon name="minimize" size={13} />
					<span>Fit Screen</span>
				</button>
				<button
					type="button"
					class="scale-btn"
					class:active={chart.viewScale === 'large'}
					title="Enlarge chart for maximum text readability"
					onclick={() => chart.setViewScale('large')}
				>
					<Icon name="maximize" size={13} />
					<span>Expanded</span>
				</button>
			</div>
		</div>
	{/if}

	<div
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
				{#if isMobile && effectiveViewMode === 'edit'}
					<div class="mobile-peek-wrap">
						<button
							type="button"
							class="mobile-peek-btn"
							onclick={() => {
								chart.setViewMode('view');
								window.scrollTo({ top: 0, behavior: 'smooth' });
							}}
						>
							<Icon name="grid" size={16} />
							<span>View Full 9×9 Grid</span>
							<Icon name="arrow-right" size={14} class="peek-arrow" />
						</button>
					</div>
				{/if}
				<textarea
					class="export-box"
					class:on={!!chart.exportFallback}
					readonly
					aria-label="Chart as text"
					value={chart.exportFallback}
				></textarea>
			</div>
		{/if}
	</div>

	{#if effectiveViewMode === 'view'}
		<div class="view-selection-card">
			<div class="selection-meta">
				<span
					class="selection-pip"
					style:--pip-h={chart.sel === 4 ? undefined : HUES[idx(chart.sel)]}
					class:goal-pip={chart.sel === 4}
				></span>
				<div class="selection-text">
					<strong class="selection-title">{selectedBlockTitle}</strong>
					<span class="selection-sub">{selectedBlockSubtitle}</span>
				</div>
			</div>
			<button
				type="button"
				class="selection-edit-action"
				onclick={handleEditCurrentBlock}
			>
				<Icon name="edit" size={14} />
				<span>Edit This Block</span>
				<span class="action-key-badge">E</span>
			</button>
		</div>
	{/if}

	{#if isDraggingFile}
		<div class="drop-overlay" aria-hidden="true">
			<div class="drop-modal">Drop your Mandala JSON file here to import</div>
		</div>
	{/if}
</div>
