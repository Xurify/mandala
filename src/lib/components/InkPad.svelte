<script lang="ts">
	import { chart } from '$lib/chart/chart.svelte';
	import { drawStrokes, widthFor } from '$lib/chart/ink';
	import { describe, HUES, info, type CellType } from '$lib/chart/model';
	import Icon from './Icon.svelte';

	let {
		cellKey,
		block,
		cell
	}: {
		cellKey: string;
		block: number;
		cell: number;
	} = $props();

	const cellInformation = $derived(info(block, cell));
	const type: CellType = $derived(cellInformation.type);
	const hue = $derived(cellInformation.type === 'goal' ? undefined : HUES[cellInformation.k]);
	const strokes = $derived(chart.strokesOf(cellKey));
	const blank = $derived(strokes.length === 0);
	const isHighlighted = $derived(
		chart.hoveredColorIndex !== null &&
			((cellInformation.type === 'goal' && chart.hoveredColorIndex === -1) ||
				(cellInformation.type !== 'goal' && cellInformation.k === chart.hoveredColorIndex))
	);

	let drawing = false;
	let currentStroke: number[] | null = null;
	let activePointerId: number | null = null;
	let strokeColor = '#000';

	function paint(canvas: HTMLCanvasElement) {
		drawStrokes(canvas, chart.strokesOf(cellKey), getComputedStyle(canvas).color, 1);
	}

	function fit(canvas: HTMLCanvasElement) {
		const boundingBox = canvas.getBoundingClientRect();
		const devicePixelRatio = Math.min(window.devicePixelRatio || 1, 3);
		const targetWidth = Math.max(1, Math.round(boundingBox.width * devicePixelRatio));
		if (canvas.width !== targetWidth || canvas.height !== targetWidth) {
			canvas.width = targetWidth;
			canvas.height = targetWidth;
		}
		paint(canvas);
	}

	function attachPad(canvas: HTMLCanvasElement) {
		void strokes;
		void chart.themeTick;
		fit(canvas);
		const resizeObserver = new ResizeObserver(() => fit(canvas));
		resizeObserver.observe(canvas);
		return () => resizeObserver.disconnect();
	}

	function addPoint(canvas: HTMLCanvasElement, event: PointerEvent) {
		if (!currentStroke) return;
		const boundingBox = canvas.getBoundingClientRect();
		const positionX = Math.max(
			0,
			Math.min(1000, Math.round(((event.clientX - boundingBox.left) / boundingBox.width) * 1000))
		);
		const positionY = Math.max(
			0,
			Math.min(1000, Math.round(((event.clientY - boundingBox.top) / boundingBox.height) * 1000))
		);
		const pressure = Math.max(1, Math.round((event.pressure || 0.5) * 100));
		const strokeLength = currentStroke.length;
		const canvasContext = canvas.getContext('2d');
		if (!canvasContext) return;
		canvasContext.strokeStyle = strokeColor;
		canvasContext.fillStyle = strokeColor;
		canvasContext.lineCap = 'round';
		canvasContext.lineJoin = 'round';
		if (strokeLength === 0) {
			canvasContext.beginPath();
			canvasContext.arc(
				(positionX * canvas.width) / 1000,
				(positionY * canvas.height) / 1000,
				widthFor(canvas.width, pressure, 1) / 2,
				0,
				Math.PI * 2
			);
			canvasContext.fill();
		} else {
			canvasContext.lineWidth = widthFor(
				canvas.width,
				(pressure + currentStroke[strokeLength - 1]!) / 2,
				1
			);
			canvasContext.beginPath();
			canvasContext.moveTo(
				(currentStroke[strokeLength - 3]! * canvas.width) / 1000,
				(currentStroke[strokeLength - 2]! * canvas.height) / 1000
			);
			canvasContext.lineTo((positionX * canvas.width) / 1000, (positionY * canvas.height) / 1000);
			canvasContext.stroke();
		}
		currentStroke.push(positionX, positionY, pressure);
	}

	function onDown(event: PointerEvent) {
		const canvas = event.currentTarget as HTMLCanvasElement;
		if (event.pointerType === 'touch' && !chart.fingerDraw) return;
		if (event.pointerType === 'mouse' && event.button !== 0) return;
		event.preventDefault();
		try {
			canvas.setPointerCapture(event.pointerId);
		} catch {
			// capture optional
		}
		drawing = true;
		activePointerId = event.pointerId;
		currentStroke = [];
		strokeColor = getComputedStyle(canvas).color;
		addPoint(canvas, event);
	}

	function onMove(event: PointerEvent) {
		if (!drawing || event.pointerId !== activePointerId) return;
		event.preventDefault();
		const canvas = event.currentTarget as HTMLCanvasElement;
		const coalescedEvents = event.getCoalescedEvents?.() ?? [];
		for (const individualEvent of coalescedEvents.length ? coalescedEvents : [event]) {
			addPoint(canvas, individualEvent);
		}
	}

	function onEnd(event: PointerEvent) {
		if (!drawing || event.pointerId !== activePointerId) return;
		drawing = false;
		if (currentStroke?.length) chart.pushStroke(cellKey, currentStroke);
		currentStroke = null;
		activePointerId = null;
	}

	function undo(event: MouseEvent) {
		event.stopPropagation();
		chart.undoStroke(cellKey);
	}

	function clear(event: MouseEvent) {
		event.stopPropagation();
		chart.clearInk(cellKey);
	}

	function handlePadPointerEnter(event: PointerEvent) {
		if (event.pointerType === 'touch') return;
		chart.hoveredColorIndex = cellInformation.type === 'goal' ? -1 : cellInformation.k;
	}

	function handlePadPointerLeave(event: PointerEvent) {
		if (event.pointerType === 'touch') return;
		chart.hoveredColorIndex = null;
	}
</script>

<div class="slot">
	<div class="pad {type}" class:blank class:highlight={isHighlighted} style:--h={hue}>
		<canvas
			aria-label="Handwriting area: {describe(block, cell)}"
			{@attach attachPad}
			onpointerdown={onDown}
			onpointermove={onMove}
			onpointerup={onEnd}
			onpointercancel={onEnd}
			onpointerenter={handlePadPointerEnter}
			onpointerleave={handlePadPointerLeave}
		></canvas>
		<div class="tools">
			<button type="button" class="tool" aria-label="Undo last stroke" onclick={undo}>
				<Icon name="undo" size={13} />
			</button>
			<button type="button" class="tool" aria-label="Clear handwriting" onclick={clear}>
				<Icon name="close" size={13} />
			</button>
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
		oninput={(event) => chart.setText(cellKey, event.currentTarget.value)}
	/>
</div>
