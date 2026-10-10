<script lang="ts">
	import { cellKey, getByKey, HUES, info, type ChartData } from '$lib/chart/model';
	import { cn } from './ui/cn';

	interface Props {
		data: ChartData;
		/** Cells to mark, by key. A pillar key marks both places the pillar sits. */
		flagged?: readonly string[];
		/** `fill` writes the cells in pillar by pillar. `read` sweeps the grid in reading order, then marks. */
		play?: 'fill' | 'read' | null;
		/** One cell, in px. */
		cell?: number;
		label: string;
		class?: string;
	}

	let { data, flagged = [], play = null, cell = 9, label, class: className }: Props = $props();

	const marked = $derived(new Set(flagged));
	/** When the sweep is done, in ms. Marks land after it. */
	const READ_END = 9 * 42 + 9 * 7;

	function delayOf(block: number, index: number, k: number | null): string | undefined {
		if (play === 'fill') return `${(k ?? 0) * 90 + index * 14}ms`;
		if (play === 'read') return `${block * 42 + index * 7}ms`;
		return undefined;
	}
</script>

<div class={cn('grid shrink-0 grid-cols-3', className)} style:gap="{Math.max(2, cell / 3)}px" role="img" aria-label={label}>
	{#each { length: 9 } as _, block (block)}
		<div class="grid grid-cols-3 gap-px">
			{#each { length: 9 } as _, index (index)}
				{@const where = info(block, index)}
				{@const key = cellKey(block, index)}
				{@const written = getByKey(data, key).trim() !== ''}
				{@const k = where.type === 'goal' ? null : where.k}
				<span
					class={cn(
						'relative overflow-hidden rounded-[2.5px]',
						where.type === 'goal' ? 'bg-ink' : where.type === 'pillar' ? 'bg-sunken' : 'pillar-action',
						// An outline is drawn outside the clip, so the mark reads at this size.
						marked.has(key) && 'z-[1] outline-[1.5px] outline-offset-1 outline-ink outline-solid',
						marked.has(key) && play === 'read' && 'motion-safe:animate-mark-in'
					)}
					style:width="{cell}px"
					style:height="{cell}px"
					style:--h={k === null ? undefined : HUES[k]}
					style:animation-delay={marked.has(key) && play === 'read' ? `${READ_END + 60}ms` : undefined}
				>
					{#if written && k !== null}
						<span
							class={cn('absolute inset-0', where.type === 'pillar' ? 'pillar-dot' : 'pillar-cell', play && 'motion-safe:animate-scan')}
							style:animation-delay={delayOf(block, index, k)}
						></span>
					{/if}
				</span>
			{/each}
		</div>
	{/each}
</div>
