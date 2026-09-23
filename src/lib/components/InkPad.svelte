<script lang="ts">
	import { chart } from '$lib/chart/chart.svelte';
	import { drawStrokes, widthFor } from '$lib/chart/ink';
	import { describe, HUES, info, type CellType } from '$lib/chart/model';

	let {
		cellKey,
		block,
		cell
	}: {
		cellKey: string;
		block: number;
		cell: number;
	} = $props();

	const i = $derived(info(block, cell));
	const type: CellType = $derived(i.type);
	const hue = $derived(i.type === 'goal' ? undefined : HUES[i.k]);
	const strokes = $derived(chart.strokesOf(cellKey));
	const blank = $derived(strokes.length === 0);

	let drawing = false;
	let cur: number[] | null = null;
	let pid: number | null = null;
	let color = '#000';

	function paint(canvas: HTMLCanvasElement) {
		drawStrokes(canvas, chart.strokesOf(cellKey), getComputedStyle(canvas).color, 1);
	}

	function fit(canvas: HTMLCanvasElement) {
		const r = canvas.getBoundingClientRect();
		const dpr = Math.min(window.devicePixelRatio || 1, 3);
		const w = Math.max(1, Math.round(r.width * dpr));
		if (canvas.width !== w || canvas.height !== w) {
			canvas.width = w;
			canvas.height = w;
		}
		paint(canvas);
	}

	function attachPad(canvas: HTMLCanvasElement) {
		void strokes;
		void chart.themeTick;
		fit(canvas);
		const ro = new ResizeObserver(() => fit(canvas));
		ro.observe(canvas);
		return () => ro.disconnect();
	}

	function addPoint(canvas: HTMLCanvasElement, e: PointerEvent) {
		if (!cur) return;
		const r = canvas.getBoundingClientRect();
		const x = Math.max(0, Math.min(1000, Math.round(((e.clientX - r.left) / r.width) * 1000)));
		const y = Math.max(0, Math.min(1000, Math.round(((e.clientY - r.top) / r.height) * 1000)));
		const p = Math.max(1, Math.round((e.pressure || 0.5) * 100));
		const n = cur.length;
		const ctx = canvas.getContext('2d');
		if (!ctx) return;
		ctx.strokeStyle = color;
		ctx.fillStyle = color;
		ctx.lineCap = 'round';
		ctx.lineJoin = 'round';
		if (n === 0) {
			ctx.beginPath();
			ctx.arc((x * canvas.width) / 1000, (y * canvas.height) / 1000, widthFor(canvas.width, p, 1) / 2, 0, Math.PI * 2);
			ctx.fill();
		} else {
			ctx.lineWidth = widthFor(canvas.width, (p + cur[n - 1]!) / 2, 1);
			ctx.beginPath();
			ctx.moveTo((cur[n - 3]! * canvas.width) / 1000, (cur[n - 2]! * canvas.height) / 1000);
			ctx.lineTo((x * canvas.width) / 1000, (y * canvas.height) / 1000);
			ctx.stroke();
		}
		cur.push(x, y, p);
	}

	function onDown(e: PointerEvent) {
		const canvas = e.currentTarget as HTMLCanvasElement;
		if (e.pointerType === 'touch' && !chart.fingerDraw) return;
		if (e.pointerType === 'mouse' && e.button !== 0) return;
		e.preventDefault();
		try {
			canvas.setPointerCapture(e.pointerId);
		} catch {
			// capture optional
		}
		drawing = true;
		pid = e.pointerId;
		cur = [];
		color = getComputedStyle(canvas).color;
		addPoint(canvas, e);
	}

	function onMove(e: PointerEvent) {
		if (!drawing || e.pointerId !== pid) return;
		e.preventDefault();
		const canvas = e.currentTarget as HTMLCanvasElement;
		const evs = e.getCoalescedEvents?.() ?? [];
		for (const ev of evs.length ? evs : [e]) addPoint(canvas, ev);
	}

	function onEnd(e: PointerEvent) {
		if (!drawing || e.pointerId !== pid) return;
		drawing = false;
		if (cur?.length) chart.pushStroke(cellKey, cur);
		cur = null;
		pid = null;
	}

	function undo(e: MouseEvent) {
		e.stopPropagation();
		chart.undoStroke(cellKey);
	}

	function clear(e: MouseEvent) {
		e.stopPropagation();
		chart.clearInk(cellKey);
	}
</script>

<div class="slot">
	<div class="pad {type}" class:blank style:--h={hue}>
		<canvas
			aria-label="Handwriting area: {describe(block, cell)}"
			{@attach attachPad}
			onpointerdown={onDown}
			onpointermove={onMove}
			onpointerup={onEnd}
			onpointercancel={onEnd}
		></canvas>
		<div class="tools">
			<button type="button" class="tool" aria-label="Undo last stroke" onclick={undo}>↶</button>
			<button type="button" class="tool" aria-label="Clear handwriting" onclick={clear}>×</button>
		</div>
	</div>
	<input
		type="text"
		class="caption"
		maxlength="120"
		value={chart.textOf(cellKey)}
		placeholder="Type to make searchable"
		spellcheck="false"
		aria-label="Text for {describe(block, cell)}"
		oninput={(e) => chart.setText(cellKey, e.currentTarget.value)}
	/>
</div>
