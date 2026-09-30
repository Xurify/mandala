<script lang="ts">
	import type { Attachment } from 'svelte/attachments';
	import { chart } from '$lib/chart/chart.svelte';
	import { drawStrokes } from '$lib/chart/ink';
	import { cellKey, describe, HUES, idx, info } from '$lib/chart/model';
	import { goalTypeMin, largestFittingSize } from './goal-fit';
	import { cn } from './ui/cn';

	let {
		mode = 'split',
		onSelect,
		onEdit
	}: {
		mode?: 'view' | 'edit' | 'split';
		onSelect: (blockIndex: number, targetKey?: string) => void;
		onEdit?: (blockIndex: number, targetKey?: string) => void;
	} = $props();

	const view = $derived(mode === 'view');

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
		const type = cellInformation.type;
		const highlighted =
			chart.hoveredColorIndex !== null &&
			((type === 'goal' && chart.hoveredColorIndex === -1) ||
				(type !== 'goal' && cellInformation.k === chart.hoveredColorIndex));
		const placeholder = !hasText && !hasInk;

		return cn(
			'cell relative flex flex-col aspect-square min-w-0 cursor-pointer items-center justify-center overflow-hidden border-0 text-center font-sans motion-safe:transition-[background-color,transform,box-shadow] motion-safe:duration-[180ms] motion-safe:ease-ui',
			'focus-visible:z-[1] focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-ink',
			'can-hover:hover:z-2 can-hover:hover:scale-[1.04] can-hover:hover:shadow-[0_6px_16px_-4px_oklch(0_0_0/0.2)]',
			view ? 'rounded-[11px] leading-[1.25]' : 'rounded-[7px] p-[3px] text-[clamp(8px,1.55cqw,12px)] leading-[1.15]',
			view && type === 'action' && 'px-1 py-[5px] text-[clamp(8.5px,1.3cqw,13px)]',
			view && type === 'pillar' && 'px-1 py-[5px] text-[clamp(9px,1.45cqw,13.5px)]',
			view &&
				type === 'goal' &&
				'px-[clamp(10px,1.15em,18px)] py-1.5 font-serif text-[clamp(10.5px,1.6cqw,16px)] tracking-[-0.01em]',
			type === 'goal' &&
				'goal bg-goal text-goal-fg can-hover:hover:bg-goal-hover can-hover:[&.highlight]:bg-goal-hover',
			type === 'goal' && (view ? 'font-[560]' : 'font-semibold'),
			type === 'pillar' &&
				'pillar pillar-cell text-on-p can-hover:hover:pillar-hot can-hover:[&.highlight]:pillar-hot',
			type === 'pillar' && (view ? 'font-[620]' : 'font-semibold'),
			type === 'action' &&
				'action pillar-action text-text can-hover:hover:action-hot can-hover:[&.highlight]:action-hot',
			(type === 'goal' || type === 'pillar') && 'rounded-[28%]',
			placeholder &&
				type === 'goal' &&
				"before:font-medium before:opacity-60 before:content-['Your_goal']",
			placeholder &&
				type === 'pillar' &&
				'before:text-[0.88em] before:font-medium before:opacity-50 before:content-[attr(data-placeholder)]',
			hasText &&
				"filled @max-[480px]:after:size-[32%] @max-[480px]:after:rounded-full @max-[480px]:after:bg-current @max-[480px]:after:opacity-60 @max-[480px]:after:content-[''] print:after:hidden",
			hasText ? 'filled' : 'empty',
			hasInk && !hasText && 'ink-only',
			hit && 'hit shadow-[inset_0_0_0_2px_var(--ink)]',
			query !== '' && !hit && 'dim opacity-[0.18]',
			highlighted && 'highlight'
		);
	}

	function blockClass(blockIndex: number): string {
		const selected = chart.sel === blockIndex;
		const highlighted = isBlockHighlighted(blockIndex);
		return cn(
			'block !grid grid-cols-3 bg-surface shadow-card motion-safe:transition-shadow motion-safe:duration-[180ms]',
			view ? 'gap-[5px] rounded-[22px] p-2' : 'gap-[3px] rounded-[18px] p-1.5',
			'max-[900px]:gap-0.5 max-[900px]:rounded-[13px] max-[900px]:p-1',
			selected && 'sel shadow-[var(--shadow-sm),0_0_0_2px_var(--ink)]',
			highlighted &&
				!selected &&
				'can-hover:shadow-[var(--shadow-sm),0_0_0_2px_oklch(var(--p-l-hover)_var(--p-c-hover)_var(--block-h)/0.55)]',
			highlighted && 'highlight'
		);
	}

	function isBlockHighlighted(blockIndex: number): boolean {
		if (chart.hoveredColorIndex === null) return false;
		if (blockIndex === 4) return chart.hoveredColorIndex === -1;
		return idx(blockIndex) === chart.hoveredColorIndex;
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

	let grid = $state<HTMLDivElement | null>(null);

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

	const fitGoalText: Attachment = (element) => {
		if (!(element instanceof HTMLSpanElement)) return;
		const cell = element.parentElement;
		if (!(cell instanceof HTMLElement)) return;

		let frame = 0;

		const apply = (): void => {
			const text = element.textContent ?? '';
			element.style.fontSize = '';
			element.style.display = '';
			element.style.overflow = '';
			element.style.removeProperty('-webkit-line-clamp');
			if (text.trim() === '' || getComputedStyle(element).display === 'none') return;

			const cellStyle = getComputedStyle(cell);
			const available =
				cell.clientHeight - parseFloat(cellStyle.paddingTop) - parseFloat(cellStyle.paddingBottom);
			if (available <= 0) return;

			element.style.display = 'block';
			element.style.overflow = 'visible';
			element.style.setProperty('-webkit-line-clamp', 'unset');

			const max = parseFloat(getComputedStyle(element).fontSize);
			if (!Number.isFinite(max) || max <= 0) {
				element.style.display = '';
				element.style.overflow = '';
				element.style.removeProperty('-webkit-line-clamp');
				return;
			}

			const min = goalTypeMin(max);
			const fits = (size: number): boolean => {
				element.style.fontSize = `${size}px`;
				return element.scrollHeight <= available + 1;
			};

			const chosen = largestFittingSize(min, max, fits);

			element.style.display = '';
			element.style.overflow = '';
			element.style.removeProperty('-webkit-line-clamp');
			element.style.fontSize = chosen >= max - 0.25 ? '' : `${chosen.toFixed(2)}px`;
		};

		const schedule = (): void => {
			cancelAnimationFrame(frame);
			frame = requestAnimationFrame(apply);
		};

		schedule();
		const resizeObserver = new ResizeObserver(schedule);
		resizeObserver.observe(cell);
		const textObserver = new MutationObserver(schedule);
		textObserver.observe(element, { characterData: true, childList: true, subtree: true });
		const classObserver = new MutationObserver(schedule);
		classObserver.observe(cell, { attributes: true, attributeFilter: ['class'] });
		return () => {
			cancelAnimationFrame(frame);
			resizeObserver.disconnect();
			textObserver.disconnect();
			classObserver.disconnect();
			element.style.fontSize = '';
			element.style.display = '';
			element.style.overflow = '';
			element.style.removeProperty('-webkit-line-clamp');
		};
	};

	function paintThumbs(color?: string) {
		if (!grid) return;
		for (const canvas of grid.querySelectorAll<HTMLCanvasElement>('canvas[data-ink-key]')) {
			const key = canvas.dataset.inkKey;
			if (!key) continue;
			const strokes = chart.strokesOf(key);
			if (!strokes.length || chart.textOf(key).trim()) continue;
			drawStrokes(canvas, strokes, color ?? getComputedStyle(canvas).color, 2.2);
		}
	}
</script>

<svelte:window onbeforeprint={() => paintThumbs('#1f1b16')} onafterprint={() => paintThumbs()} />

<div
	bind:this={grid}
	class={cn(
		'mandala grid w-full grid-cols-3 max-[900px]:mx-auto max-[900px]:max-w-[480px] max-[900px]:gap-1',
		view ? 'aspect-square gap-2.5' : 'gap-1.5'
	)}
>
	{#each Array(9) as _, blockIndex (blockIndex)}
		<div class={blockClass(blockIndex)} style:--block-h={blockHue(blockIndex)}>
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
					<span
						class={cn(
							'w-full hyphens-manual wrap-break-word @max-[480px]:hidden',
							view ? 'line-clamp-5' : 'line-clamp-4'
						)}
						{@attach info(blockIndex, cellIndex).type === 'goal' ? fitGoalText : undefined}
						>{chart.textOf(cellKey(blockIndex, cellIndex))}</span
					>
					<canvas
						class="thumb pointer-events-none absolute inset-0 hidden size-full [.ink-only_&]:!block"
						data-ink-key={cellKey(blockIndex, cellIndex)}
						width="192"
						height="192"
						{@attach attachThumb(blockIndex, cellIndex)}
					></canvas>
				</button>
			{/each}
		</div>
	{/each}
</div>
