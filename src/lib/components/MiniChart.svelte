<script lang="ts">
	import { cellKey, getByKey, HUES, info, type ChartData } from '$lib/chart/model';
	import { cn } from './ui/cn';

	interface Props {
		data: ChartData;
		play?: 'fill' | null;
		cell?: number;
		label: string;
		class?: string;
	}

	let { data, play = null, cell = 9, label, class: className }: Props = $props();

	function delayOf(index: number, k: number | null): string | undefined {
		return play === 'fill' ? `${(k ?? 0) * 90 + index * 14}ms` : undefined;
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
						where.type === 'goal' ? 'bg-ink' : where.type === 'pillar' ? 'bg-sunken' : 'pillar-action'
					)}
					style:width="{cell}px"
					style:height="{cell}px"
					style:--h={k === null ? undefined : HUES[k]}
				>
					{#if written && k !== null}
						<span
							class={cn('absolute inset-0', where.type === 'pillar' ? 'pillar-dot' : 'pillar-cell', play && 'motion-safe:animate-scan')}
							style:animation-delay={delayOf(index, k)}
						></span>
					{/if}
				</span>
			{/each}
		</div>
	{/each}
</div>
