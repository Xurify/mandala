<script lang="ts">
	import { onMount } from 'svelte';
	import { chart } from '$lib/chart/chart.svelte';
	import { blockOfKey, CELL_COUNT, getByKey, labelOfKey } from '$lib/chart/model';
	import { readUnreadInk } from '$lib/chart/ocr';
	import MandalaGrid from './MandalaGrid.svelte';
	import SidePanel from './SidePanel.svelte';

	let exampleArmed = $state(false);
	let clearArmed = $state(false);
	let exampleTimer: ReturnType<typeof setTimeout> | null = null;
	let clearTimer: ReturnType<typeof setTimeout> | null = null;

	const shownHits = $derived(chart.hits.slice(0, 10));
	const extraHits = $derived(Math.max(0, chart.hits.length - 10));
	const noticeOn = $derived(chart.reading || chart.unread.length > 0);
	const noticeText = $derived.by(() => {
		if (chart.reading) return 'Reading handwriting…';
		const n = chart.unread.length;
		if (!n) return '';
		return (
			`${n} handwritten note${n === 1 ? ' isn’t' : 's aren’t'} searchable yet.` +
			' First read downloads a handwriting model (~120MB) to this device.'
		);
	});

	onMount(() => {
		chart.load();
		const mq = window.matchMedia('(prefers-color-scheme: dark)');
		const onTheme = () => chart.bumpTheme();
		mq.addEventListener('change', onTheme);
		return () => mq.removeEventListener('change', onTheme);
	});

	function persistHidden() {
		if (document.visibilityState === 'hidden') chart.saveNow();
	}

	function selectBlock(b: number) {
		chart.select(b);
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
		const setArmed = (v: boolean) => {
			if (kind === 'example') exampleArmed = v;
			else clearArmed = v;
		};
		const setTimer = (t: ReturnType<typeof setTimeout> | null) => {
			if (kind === 'example') exampleTimer = t;
			else clearTimer = t;
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
			keys.map((k) => ({ key: k, strokes: chart.strokesOf(k) })),
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
		let msg = `Read ${done} note${done === 1 ? '.' : 's.'}`;
		if (missed) msg += ` ${missed} ${missed === 1 ? 'was' : 'were'} too unclear to read.`;
		if (result.failed === 'offline') {
			msg += ' Need a connection the first time to download the handwriting model.';
		} else if (result.failed) {
			msg += ' Something went wrong. Try again.';
		}
		chart.say(msg);
	}
</script>

<svelte:window onpagehide={() => chart.saveNow()} />
<svelte:document onvisibilitychange={persistHidden} />

<div class="wrap">
	<header class="top">
		<div class="brand">
			<h1>Mandala Method</h1>
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
			<button class="btn" type="button" onclick={copyText}>Copy as text</button>
			<button class="btn" class:armed={exampleArmed} type="button" onclick={() => arm('example')}>
				{exampleArmed ? 'Click again to confirm' : 'Load example'}
			</button>
			<button class="btn" class:armed={clearArmed} type="button" onclick={() => arm('clear')}>
				{clearArmed ? 'Click again to confirm' : 'Clear all'}
			</button>
		</div>
	</header>

	<div class="search">
		<input
			type="search"
			placeholder="Search goal, pillars and actions"
			aria-label="Search the chart"
			autocomplete="off"
			spellcheck="false"
			value={chart.query}
			oninput={(e) => chart.setQuery(e.currentTarget.value)}
		/>
		<div class="results" aria-live="polite">
			{#if chart.query.trim() && !shownHits.length}
				<div class="res-note">
					{chart.unread.length
						? 'No matches. Handwriting is only searchable after it has been read.'
						: 'No matches.'}
				</div>
			{/if}
			{#each shownHits as k (k)}
				<button type="button" class="res" onclick={() => selectBlock(blockOfKey(k))}>
					<b>{labelOfKey(chart.data, k)}</b>
					{getByKey(chart.data, k).trim()}
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
</div>
