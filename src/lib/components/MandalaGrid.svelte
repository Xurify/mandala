<script lang="ts">
	import { chart } from '$lib/chart/chart.svelte';
	import { drawStrokes } from '$lib/chart/ink';
	import { cellKey, describe, HUES, idx, info } from '$lib/chart/model';

	let {
		onSelect,
		onEdit
	}: {
		onSelect: (blockIndex: number, targetKey?: string) => void;
		onEdit?: (blockIndex: number, targetKey?: string) => void;
	} = $props();

	function hue(blockIndex: number, cellIndex: number): number | undefined {
		const cellInformation = info(blockIndex, cellIndex);
		return cellInformation.type === 'goal' ? undefined : HUES[cellInformation.k];
	}

	function blockHue(blockIndex: number): number | undefined {
		return blockIndex === 4 ? undefined : HUES[idx(blockIndex)];
	}

	function cellPlaceholder(blockIndex: number, cellIndex: number): string {
		const cellInformation = info(blockIndex, cellIndex);
		if (cellInformation.type === 'goal') return 'Your goal';
		if (cellInformation.type === 'pillar') return `Pillar ${cellInformation.k + 1}`;
		return '';
	}

	function cellClass(blockIndex: number, cellIndex: number): string {
		const key = cellKey(blockIndex, cellIndex);
		const text = chart.textOf(key);
		const hasText = text.trim() !== '';
		const hasInk = chart.strokesOf(key).length > 0;
		const query = chart.query.trim().toLowerCase();
		const hit = query !== '' && text.toLowerCase().includes(query);
		const cellInformation = info(blockIndex, cellIndex);
		const parts = ['cell', cellInformation.type];
		if (hasText) parts.push('filled');
		else parts.push('empty');
		if (hasInk && !hasText) parts.push('ink-only');
		if (hit) parts.push('hit');
		if (query !== '' && !hit) parts.push('dim');

		const isColorHighlighted =
			chart.hoveredColorIndex !== null &&
			((cellInformation.type === 'goal' && chart.hoveredColorIndex === -1) ||
				(cellInformation.type !== 'goal' && cellInformation.k === chart.hoveredColorIndex));
		if (isColorHighlighted) {
			parts.push('highlight');
		}

		return parts.join(' ');
	}

	function isBlockHighlighted(blockIndex: number): boolean {
		if (chart.hoveredColorIndex === null) return false;
		if (blockIndex === 4) return chart.hoveredColorIndex === -1;
		return idx(blockIndex) === chart.hoveredColorIndex;
	}

	function isBlockCompleted(blockIndex: number): boolean {
		if (blockIndex === 4) {
			return chart.milestones.goalSet && chart.milestones.pillarsCount === 8;
		}
		const pillarIndex = idx(blockIndex);
		return (chart.milestones.pillarActionCounts[pillarIndex] ?? 0) === 8;
	}

	function handlePointerEnter(blockIndex: number, cellIndex: number, event: PointerEvent): void {
		if (event.pointerType === 'touch') return;
		const cellInformation = info(blockIndex, cellIndex);
		chart.hoveredColorIndex = cellInformation.type === 'goal' ? -1 : cellInformation.k;
	}

	function handlePointerLeave(event: PointerEvent): void {
		if (event.pointerType === 'touch') return;
		chart.hoveredColorIndex = null;
	}

	function aria(blockIndex: number, cellIndex: number): string {
		const key = cellKey(blockIndex, cellIndex);
		const text = chart.textOf(key).trim();
		const hasInk = chart.strokesOf(key).length > 0;
		return `${describe(blockIndex, cellIndex)}: ${text || (hasInk ? 'handwriting' : 'empty')}`;
	}

	function attachThumb(blockIndex: number, cellIndex: number) {
		return (canvas: HTMLCanvasElement) => {
			const key = cellKey(blockIndex, cellIndex);
			const strokes = chart.strokesOf(key);
			const text = chart.textOf(key).trim();
			void chart.themeTick;
			if (!strokes.length || text) return;
			drawStrokes(canvas, strokes, getComputedStyle(canvas).color, 2.2);
		};
	}
</script>

<div class="mandala">
	{#each Array(9) as _, blockIndex (blockIndex)}
		<div
			class="block"
			class:sel={chart.sel === blockIndex}
			class:highlight={isBlockHighlighted(blockIndex)}
			class:completed={isBlockCompleted(blockIndex)}
			style:--block-h={blockHue(blockIndex)}
		>
			{#each Array(9) as _, cellIndex (`${blockIndex}:${cellIndex}`)}
				<button
					type="button"
					class={cellClass(blockIndex, cellIndex)}
					style:--h={hue(blockIndex, cellIndex)}
					aria-label={aria(blockIndex, cellIndex)}
					data-placeholder={cellPlaceholder(blockIndex, cellIndex)}
					onclick={() => onSelect(blockIndex, cellKey(blockIndex, cellIndex))}
					ondblclick={() => onEdit?.(blockIndex, cellKey(blockIndex, cellIndex))}
					onpointerenter={(event) => handlePointerEnter(blockIndex, cellIndex, event)}
					onpointerleave={handlePointerLeave}
				>
					<span>{chart.textOf(cellKey(blockIndex, cellIndex))}</span>
					<canvas class="thumb" width="192" height="192" {@attach attachThumb(blockIndex, cellIndex)}
					></canvas>
				</button>
			{/each}
		</div>
	{/each}
</div>
