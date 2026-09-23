<script lang="ts">
	import { chart } from '$lib/chart/chart.svelte';
	import { drawStrokes } from '$lib/chart/ink';
	import { cellKey, describe, HUES, info } from '$lib/chart/model';

	let { onSelect }: { onSelect: (b: number) => void } = $props();

	function hue(b: number, c: number): number | undefined {
		const i = info(b, c);
		return i.type === 'goal' ? undefined : HUES[i.k];
	}

	function cellClass(b: number, c: number): string {
		const key = cellKey(b, c);
		const text = chart.textOf(key);
		const hasText = text.trim() !== '';
		const hasInk = chart.strokesOf(key).length > 0;
		const q = chart.query.trim().toLowerCase();
		const hit = q !== '' && text.toLowerCase().includes(q);
		const parts = ['cell', info(b, c).type];
		if (hasText) parts.push('filled');
		else parts.push('empty');
		if (hasInk && !hasText) parts.push('ink-only');
		if (hit) parts.push('hit');
		if (q !== '' && !hit) parts.push('dim');
		return parts.join(' ');
	}

	function aria(b: number, c: number): string {
		const key = cellKey(b, c);
		const text = chart.textOf(key).trim();
		const hasInk = chart.strokesOf(key).length > 0;
		return `${describe(b, c)}: ${text || (hasInk ? 'handwriting' : 'empty')}`;
	}

	function attachThumb(b: number, c: number) {
		return (canvas: HTMLCanvasElement) => {
			const key = cellKey(b, c);
			const strokes = chart.strokesOf(key);
			const text = chart.textOf(key).trim();
			void chart.themeTick;
			if (!strokes.length || text) return;
			drawStrokes(canvas, strokes, getComputedStyle(canvas).color, 1.6);
		};
	}
</script>

<div class="mandala">
	{#each Array(9) as _, b (b)}
		<div class="block" class:sel={chart.sel === b}>
			{#each Array(9) as _, c (`${b}:${c}`)}
				<button
					type="button"
					class={cellClass(b, c)}
					style:--h={hue(b, c)}
					aria-label={aria(b, c)}
					onclick={() => onSelect(b)}
				>
					<span>{chart.textOf(cellKey(b, c))}</span>
					<canvas class="thumb" width="96" height="96" {@attach attachThumb(b, c)}></canvas>
				</button>
			{/each}
		</div>
	{/each}
</div>
