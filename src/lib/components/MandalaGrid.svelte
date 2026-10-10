<script lang="ts">
	import type { Attachment } from 'svelte/attachments';
	import { chart } from '$lib/chart/chart.svelte';
	import {
		cellKey,
		describe,
		getByKey,
		HUES,
		idx,
		info,
		type ActionMeta,
		type ChartData
	} from '$lib/chart/model';
	import {
		fullLinesThatFit,
		largestSizeThatFits,
		remeasureWhenFontSettles,
		saveGoalFitForNextVisit,
		smallestFontSizeForSentence,
		type CellKind
	} from './goal-fit';
	import { cn } from './ui/cn';

	let {
		mode = 'split',
		// A read-only grid can be driven by plain data (shared chart page) instead
		// of the singleton store.
		source = null,
		onSelect,
		onEdit
	}: {
		mode?: 'view' | 'edit' | 'split';
		source?: ChartData | null;
		onSelect?: (blockIndex: number, targetKey?: string, cellIndex?: number) => void;
		onEdit?: (blockIndex: number, targetKey?: string) => void;
	} = $props();

	const view = $derived(mode === 'view');
	const data = $derived(source ?? chart.data);

	function textOf(key: string): string {
		return getByKey(data, key);
	}

	function metaOf(key: string): ActionMeta | undefined {
		return data.meta?.[key];
	}

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
		const text = textOf(key);
		const query = source ? '' : chart.query.trim().toLowerCase();
		const hit = query !== '' && text.toLowerCase().includes(query);
		const cellInformation = info(blockIndex, cellIndex);
		const type = cellInformation.type;
		const meta = metaOf(key);
		const isMilestoneDone = type === 'action' && meta?.kind === 'milestone' && Boolean(meta?.done);
		const highlighted =
			!source &&
			chart.hoveredColorIndex !== null &&
			((type === 'goal' && chart.hoveredColorIndex === -1) ||
				(type !== 'goal' && cellInformation.k === chart.hoveredColorIndex));
		const placeholder = text.trim() === '';
		const hasText = !placeholder;

		return cn(
			'cell relative flex flex-col aspect-square min-w-0 cursor-pointer items-center justify-center overflow-hidden border-0 text-center font-sans leading-[1.15] motion-safe:transition-[transform,box-shadow] motion-safe:duration-[180ms] motion-safe:ease-ui',
			'focus-visible:z-[1] focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-ink',
			'can-hover:hover:z-2 can-hover:hover:scale-[1.04] can-hover:hover:shadow-[0_6px_16px_-4px_oklch(0_0_0/0.2)]',
			view ? 'rounded-[11px]' : 'rounded-[7px] text-[clamp(8px,1.55cqw,12px)]',
			// 28% radius needs ~8% inset or the curve slices the first and last letters.
			type === 'action' && (view ? 'p-[max(4px,5%)]' : 'p-[max(3px,4%)]'),
			type === 'pillar' && 'p-[max(5px,10%)]',
			type === 'goal' && 'p-[max(6px,10%)]',
			view && type === 'action' && 'text-[clamp(8.5px,1.3cqw,13px)]',
			view && type === 'pillar' && 'text-[clamp(9px,1.45cqw,13.5px)]',
			view && type === 'goal' && 'font-serif text-[clamp(10.5px,1.6cqw,16px)] tracking-[-0.01em]',
			type === 'goal' &&
				'goal bg-goal text-goal-fg can-hover:hover:bg-goal-hover can-hover:[&.highlight]:bg-goal-hover',
			type === 'goal' && (view ? 'font-[560]' : 'font-semibold'),
			type === 'pillar' &&
				'pillar pillar-cell text-on-p can-hover:hover:pillar-hot can-hover:[&.highlight]:pillar-hot',
			type === 'pillar' && (view ? 'font-[620]' : 'font-semibold'),
			type === 'action' &&
				'action pillar-action text-text can-hover:hover:action-hot can-hover:[&.highlight]:action-hot',
			isMilestoneDone && 'line-through opacity-60 text-muted',
			(type === 'goal' || type === 'pillar') && 'rounded-[28%]',
			placeholder &&
				type === 'goal' &&
				"before:font-medium before:opacity-60 before:content-['Your_goal']",
			placeholder &&
				type === 'pillar' &&
				'before:text-[0.88em] before:font-medium before:opacity-50 before:content-[attr(data-placeholder)]',
				hasText &&
				// Compact mode swaps words for dots below 480px container width —
				// only where a side panel shows the words. Read-only grids keep text.
				(!source &&
					"filled @max-[480px]:after:size-[32%] @max-[480px]:after:rounded-full @max-[480px]:after:bg-current @max-[480px]:after:opacity-60 @max-[480px]:after:content-[''] print:after:hidden") ||
				(source && 'filled'),
			hasText ? 'filled' : 'empty',
			hit && 'hit shadow-[inset_0_0_0_2px_var(--ink)]',
			query !== '' && !hit && 'dim opacity-[0.18]',
			highlighted && 'highlight'
		);
	}

	function blockClass(blockIndex: number): string {
		const selected = !source && chart.sel === blockIndex;
		const highlighted = isBlockHighlighted(blockIndex);
		return cn(
			'block !grid grid-cols-3 bg-surface shadow-card motion-safe:transition-shadow motion-safe:duration-[180ms]',
			view ? 'gap-[5px] rounded-[22px] p-2' : 'gap-[3px] rounded-[18px] p-1.5',
			'max-[900px]:gap-0.5 max-[900px]:rounded-[13px] max-[900px]:p-1',
			selected && 'sel shadow-[var(--shadow-sm),0_0_0_2px_var(--ink)]',
			// The same name as the editor's block, so switching views carries one into the other.
			selected && view && '[view-transition-name:focus-block]',
			highlighted &&
				!selected &&
				'can-hover:shadow-[var(--shadow-sm),0_0_0_2px_oklch(var(--p-l-hover)_var(--p-c-hover)_var(--block-h)/0.55)]',
			highlighted && 'highlight',
			landedOn(blockIndex) && 'motion-safe:animate-glow'
		);
	}

	/** A block whose pillar just became whole glows once. A full chart glows block by block, in pillar order. */
	function landedOn(blockIndex: number): boolean {
		const landed = chart.landed;
		if (source || !landed || blockIndex === 4) return false;
		return landed.chart || landed.pillars.includes(idx(blockIndex));
	}

	function isBlockHighlighted(blockIndex: number): boolean {
		if (source || chart.hoveredColorIndex === null) return false;
		if (blockIndex === 4) return chart.hoveredColorIndex === -1;
		return idx(blockIndex) === chart.hoveredColorIndex;
	}

	function handlePointerEnter(blockIndex: number, cellIndex: number, event: PointerEvent): void {
		if (source || event.pointerType === 'touch') return;
		const cellInformation = info(blockIndex, cellIndex);
		chart.hoveredColorIndex = cellInformation.type === 'goal' ? -1 : cellInformation.k;
	}

	function handlePointerLeave(event: PointerEvent): void {
		if (source || event.pointerType === 'touch') return;
		chart.hoveredColorIndex = null;
	}

	function aria(blockIndex: number, cellIndex: number): string {
		const key = cellKey(blockIndex, cellIndex);
		const text = textOf(key).trim();
		return `${describe(blockIndex, cellIndex)}: ${text || 'empty'}`;
	}

	function kindOf(element: HTMLElement): CellKind {
		const kind = element.dataset.kind;
		if (kind === 'goal' || kind === 'pillar' || kind === 'action') return kind;
		return 'action';
	}

	const fitCellText: Attachment = (element) => {
		if (!(element instanceof HTMLSpanElement)) return;
		const cell = element.parentElement;
		if (!(cell instanceof HTMLElement)) return;

		let frame = 0;

		const clearClamp = (): void => {
			element.style.display = '';
			element.style.overflow = '';
			element.style.overflowWrap = '';
			element.style.webkitLineClamp = '';
			element.style.webkitBoxOrient = '';
		};

		const apply = (): void => {
			const text = (element.textContent ?? '').replace(/\s+/g, ' ').trim();
			clearClamp();
			if (text === '' || getComputedStyle(element).display === 'none') {
				element.style.fontSize = '';
				cell.removeAttribute('title');
				return;
			}

			const cellStyle = getComputedStyle(cell);
			const available =
				cell.clientHeight -
				parseFloat(cellStyle.paddingTop) -
				parseFloat(cellStyle.paddingBottom) -
				1;
			if (available <= 0) return;

			// The button carries the design size. The span may already wear a fitted size.
			const max = parseFloat(cellStyle.fontSize);
			if (!Number.isFinite(max) || max <= 0) return;

			const kind = kindOf(element);
			const min = smallestFontSizeForSentence(max, kind);
			element.style.display = 'block';
			element.style.overflow = 'visible';
			const fits = (size: number): boolean => {
				element.style.fontSize = `${size}px`;
				return element.scrollHeight <= available && element.scrollWidth <= element.clientWidth + 1;
			};

			const chosen = largestSizeThatFits(min, max, fits);
			const snapped = chosen === max ? max : Math.floor(chosen * 100 + 1e-6) / 100;
			const next = `${snapped}px`;
			if (element.style.fontSize !== next) element.style.fontSize = next;
			if (kind === 'goal' && !source) saveGoalFitForNextVisit('cell', snapped);

			const overflow =
				element.scrollHeight > available || element.scrollWidth > element.clientWidth + 1;
			if (!overflow) {
				clearClamp();
				cell.removeAttribute('title');
				return;
			}

			// Still too long at the floor: ellipsize on a whole line, never through a letter.
			element.style.overflowWrap = 'anywhere';
			element.style.display = '-webkit-box';
			element.style.webkitBoxOrient = 'vertical';
			element.style.overflow = 'hidden';
			const line = parseFloat(getComputedStyle(element).lineHeight);
			let lines = fullLinesThatFit(available, Number.isFinite(line) ? line : snapped * 1.15);
			element.style.webkitLineClamp = String(lines);
			if (element.scrollHeight > available + 1 && lines > 1) {
				lines -= 1;
				element.style.webkitLineClamp = String(lines);
			}
			cell.title = text;
		};

		const schedule = (): void => {
			cancelAnimationFrame(frame);
			frame = requestAnimationFrame(apply);
		};

		apply();
		schedule();
		const stopFace = remeasureWhenFontSettles(schedule);
		const onBeforePrint = (): void => apply();
		const onAfterPrint = (): void => schedule();
		window.addEventListener('beforeprint', onBeforePrint);
		window.addEventListener('afterprint', onAfterPrint);
		const resizeObserver = new ResizeObserver(schedule);
		resizeObserver.observe(cell);
		const textObserver = new MutationObserver(schedule);
		textObserver.observe(element, { characterData: true, childList: true, subtree: true });
		const classObserver = new MutationObserver(schedule);
		classObserver.observe(cell, { attributes: true, attributeFilter: ['class'] });
		return () => {
			cancelAnimationFrame(frame);
			stopFace();
			window.removeEventListener('beforeprint', onBeforePrint);
			window.removeEventListener('afterprint', onAfterPrint);
			resizeObserver.disconnect();
			textObserver.disconnect();
			classObserver.disconnect();
			clearClamp();
			element.style.fontSize = '';
			cell.removeAttribute('title');
		};
	};
</script>

<div
	class={cn(
		// Container for the cells' cqw-based type so the grid works anywhere,
		// including read-only pages that have no @container ancestor.
		'mandala @container grid w-full grid-cols-3 max-[900px]:mx-auto max-[900px]:max-w-[480px] max-[900px]:gap-1',
		view ? 'aspect-square gap-2.5' : 'gap-1.5'
	)}
>
	{#each Array(9) as _, blockIndex (blockIndex)}
		<div
			class={blockClass(blockIndex)}
			style:--block-h={blockHue(blockIndex)}
			style:animation-delay={chart.landed?.chart && blockIndex !== 4 ? `${idx(blockIndex) * 70}ms` : undefined}
		>
			{#each Array(9) as _, cellIndex (`${blockIndex}:${cellIndex}`)}
				{@const cellInformation = info(blockIndex, cellIndex)}
				{@const key = cellKey(blockIndex, cellIndex)}
				{@const meta = metaOf(key)}
				<button
					type="button"
					class={cellClass(blockIndex, cellIndex)}
					style:--h={hue(blockIndex, cellIndex)}
					aria-label={aria(blockIndex, cellIndex)}
					data-placeholder={cellPlaceholder(blockIndex, cellIndex)}
					onclick={() => onSelect?.(blockIndex, key, cellIndex)}
					ondblclick={() => onEdit?.(blockIndex, key)}
					onpointerenter={(event) => handlePointerEnter(blockIndex, cellIndex, event)}
					onpointerleave={handlePointerLeave}
				>
					{#if cellInformation.type === 'action' && meta?.pinned}
						<span
							class="pointer-events-none absolute top-1 left-1 size-1 rounded-full bg-current opacity-70 @max-[480px]:hidden"
							aria-hidden="true"
						></span>
					{/if}
					{#if cellInformation.type === 'action' && meta?.note}
						<span
							class="pointer-events-none absolute right-1 bottom-1 size-1 rounded-full bg-muted opacity-70 @max-[480px]:hidden"
							aria-hidden="true"
						></span>
					{/if}
					<span
						class={cn(
							'block w-full min-w-0 text-balance hyphens-auto',
							!source && '@max-[480px]:hidden'
						)}
						data-kind={cellInformation.type}
						{@attach fitCellText}>{textOf(key)}</span
					>
				</button>
			{/each}
		</div>
	{/each}
</div>
