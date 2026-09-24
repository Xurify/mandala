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
		parseChart
	} from '$lib/chart/model';
	import { readUnreadInk } from '$lib/chart/ocr';
	import MandalaGrid from './MandalaGrid.svelte';
	import SidePanel from './SidePanel.svelte';

	let menuOpen = $state(false);
	let menuContainerElement: HTMLDivElement | null = $state(null);
	let menuTriggerElement: HTMLButtonElement | null = $state(null);
	let fileInputElement: HTMLInputElement | null = $state(null);
	let isDraggingFile = $state(false);
	let dragCounter = 0;

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

	onMount(() => {
		chart.load();
		const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
		const onTheme = () => chart.bumpTheme();
		mediaQuery.addEventListener('change', onTheme);
		return () => mediaQuery.removeEventListener('change', onTheme);
	});

	function persistHidden() {
		if (document.visibilityState === 'hidden') chart.saveNow();
	}

	function selectBlock(blockIndex: number) {
		chart.select(blockIndex);
		if (window.matchMedia('(max-width: 900px)').matches) {
			const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
			document.querySelector('.panel')?.scrollIntoView({
				block: 'nearest',
				behavior: reduce ? 'auto' : 'smooth'
			});
		}
	}

	function handleExportChart() {
		menuOpen = false;
		exportChartFile();
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

	function handleWindowKeydown(event: KeyboardEvent) {
		if (event.key === 'Escape' && menuOpen) {
			menuOpen = false;
			menuTriggerElement?.focus();
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
					<circle
						role="presentation"
						cx="75"
						cy="75"
						r="18"
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
			<div class="progress">
				<div class="track">
					<div class="fill" style:width="{(chart.filled / CELL_COUNT) * 100}%"></div>
				</div>
				<span class="progress-label">{chart.filled} of {CELL_COUNT} filled</span>
			</div>
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
				<svg
					class="chevron"
					viewBox="0 0 16 16"
					fill="none"
					stroke="currentColor"
					stroke-width="1.8"
					stroke-linecap="round"
					stroke-linejoin="round"
					aria-hidden="true"
				>
					<path d="M4 6l4 4 4-4" />
				</svg>
			</button>

			{#if menuOpen}
				<div class="menu-dropdown" role="menu">
					<button
						class="menu-item"
						type="button"
						role="menuitem"
						onclick={handleExportChart}
					>
						<span>Export</span>
						<span class="menu-badge">.json</span>
					</button>
					<button
						class="menu-item"
						type="button"
						role="menuitem"
						onclick={handleImportClick}
					>
						<span>Import</span>
						<span class="menu-badge">.json</span>
					</button>
					<button
						class="menu-item"
						type="button"
						role="menuitem"
						onclick={handleCopyAsText}
					>
						<span>Copy as text</span>
					</button>
					<div class="menu-divider" role="separator"></div>
					<button
						class="menu-item danger"
						type="button"
						role="menuitem"
						onclick={handleClearChart}
					>
						<span>Clear chart</span>
					</button>
					<div class="menu-divider" role="separator"></div>
					<button
						class="menu-item subtle"
						type="button"
						role="menuitem"
						onclick={handleLoadExample}
					>
						<span>Load example</span>
					</button>
				</div>
			{/if}
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

	<div class="search">
		<input
			type="search"
			placeholder="Search goal, pillars and actions"
			aria-label="Search the chart"
			autocomplete="off"
			spellcheck="false"
			value={chart.query}
			oninput={(event) => chart.setQuery(event.currentTarget.value)}
		/>
		<div class="results" aria-live="polite">
			{#if chart.query.trim() && !shownHits.length}
				<div class="res-note">
					{chart.unread.length
						? 'No matches. Handwriting is only searchable after it has been read.'
						: 'No matches.'}
				</div>
			{/if}
			{#each shownHits as key (key)}
				<button type="button" class="res" onclick={() => selectBlock(blockOfKey(key))}>
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

	<div class="layout">
		<div class="chart">
			<MandalaGrid onSelect={selectBlock} />
		</div>
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
	</div>

	{#if isDraggingFile}
		<div class="drop-overlay" aria-hidden="true">
			<div class="drop-modal">Drop your Mandala JSON file here to import</div>
		</div>
	{/if}
</div>
