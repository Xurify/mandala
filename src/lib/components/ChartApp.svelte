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

	let exampleArmed = $state(false);
	let clearArmed = $state(false);
	let exampleTimer: ReturnType<typeof setTimeout> | null = null;
	let clearTimer: ReturnType<typeof setTimeout> | null = null;
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

	function arm(kind: 'example' | 'clear') {
		const run = kind === 'example' ? () => chart.loadExample() : () => chart.clearAll();
		if (!chart.dirty) {
			run();
			return;
		}
		const armed = kind === 'example' ? exampleArmed : clearArmed;
		const setArmed = (isArmed: boolean) => {
			if (kind === 'example') exampleArmed = isArmed;
			else clearArmed = isArmed;
		};
		const setTimer = (timer: ReturnType<typeof setTimeout> | null) => {
			if (kind === 'example') exampleTimer = timer;
			else clearTimer = timer;
		};
		const existing = kind === 'example' ? exampleTimer : clearTimer;
		if (armed) {
			if (existing) clearTimeout(existing);
			setArmed(false);
			run();
		} else {
			setArmed(true);
			setTimer(
				setTimeout(() => {
					setArmed(false);
				}, 3000)
			);
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
</script>

<svelte:window
	onpagehide={() => chart.saveNow()}
	ondragenter={handleDragEnter}
	ondragover={handleDragOver}
	ondragleave={handleDragLeave}
	ondrop={handleDrop}
/>
<svelte:document onvisibilitychange={persistHidden} />

<div class="wrap">
	<header class="top">
		<div class="brand">
			<div class="name">
				<svg class="mark" viewBox="0 0 150 150" aria-hidden="true">
					<rect x="14" y="14" width="36" height="36" rx="8" fill="#b85c5a" />
					<rect x="57" y="14" width="36" height="36" rx="8" fill="#c98a3f" />
					<rect x="100" y="14" width="36" height="36" rx="8" fill="#c4b230" />
					<rect x="14" y="57" width="36" height="36" rx="8" fill="#4f9a62" />
					<circle cx="75" cy="75" r="18" fill="#d5ddf5" />
					<rect x="100" y="57" width="36" height="36" rx="8" fill="#20a3a3" />
					<rect x="14" y="100" width="36" height="36" rx="8" fill="#4a8fc4" />
					<rect x="57" y="100" width="36" height="36" rx="8" fill="#8079d0" />
					<rect x="100" y="100" width="36" height="36" rx="8" fill="#c26a9c" />
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
		<div class="btns">
			<button class="btn" type="button" onclick={exportChartFile}>Export</button>
			<button class="btn" type="button" onclick={() => fileInputElement?.click()}>Import</button>
			<button class="btn" type="button" onclick={copyText}>Copy as text</button>
			<button class="btn" class:armed={exampleArmed} type="button" onclick={() => arm('example')}>
				{exampleArmed ? 'Click again to confirm' : 'Load example'}
			</button>
			<button class="btn" class:armed={clearArmed} type="button" onclick={() => arm('clear')}>
				{clearArmed ? 'Click again to confirm' : 'Clear all'}
			</button>
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
