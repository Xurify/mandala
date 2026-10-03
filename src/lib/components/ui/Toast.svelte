<script lang="ts">
	import { chart } from '$lib/chart/chart.svelte';
	import { HUES } from '$lib/chart/model';
	import { arcPath, pillarArc } from '$lib/chart/ring';
	import Eyebrow from './Eyebrow.svelte';
	import { toast } from './styles';

	const segments = HUES.map((hue, pillarIndex) => {
		const { start, end } = pillarArc(pillarIndex, { radius: 34, stroke: 9, gap: 8 });
		return { hue, d: arcPath(50, 50, 34, start, end) };
	});

	const on = $derived(chart.status.length > 0);
	const words = $derived(chart.statusSubject || chart.status);
</script>

<div
	class="group absolute bottom-[calc(100%+10px)] left-1/2 z-10 w-max max-w-[min(20rem,calc(100vw-2rem))] transition-[opacity,translate] duration-[240ms] ease-ui {on
		? 'pointer-events-auto'
		: 'pointer-events-none'}"
	style:translate={on ? '-50% 0' : '-50% 14px'}
	style:opacity={on ? 1 : 0}
	role="status"
	aria-live="polite"
	aria-atomic="true"
>
	<div
		class="relative origin-bottom motion-safe:transition-[translate] motion-safe:duration-200 motion-safe:ease-ui motion-safe:group-hover:-translate-y-1"
	>
		{#if chart.statusCount >= 3}
			<div
				class="absolute inset-0 rounded-[20px] bg-surface shadow-card transition-[translate,rotate] duration-200 ease-ui [translate:var(--sheet)] [rotate:var(--tilt)] motion-safe:animate-sheet-peek motion-safe:group-hover:[translate:var(--fan)] motion-safe:group-hover:[rotate:var(--tilt-fan)]"
				style:--sheet="10px -12px"
				style:--fan="18px -22px"
				style:--tilt="3deg"
				style:--tilt-fan="7deg"
				aria-hidden="true"
			></div>
		{/if}
		{#if chart.statusCount >= 2}
			<div
				class="absolute inset-0 rounded-[20px] bg-surface shadow-card transition-[translate,rotate] duration-200 ease-ui [translate:var(--sheet)] [rotate:var(--tilt)] motion-safe:animate-sheet-peek motion-safe:group-hover:[translate:var(--fan)] motion-safe:group-hover:[rotate:var(--tilt-fan)]"
				style:--sheet="-6px -7px"
				style:--fan="-14px -16px"
				style:--tilt="-3deg"
				style:--tilt-fan="-7deg"
				aria-hidden="true"
			></div>
		{/if}
		{#key chart.statusToken}
			<div class="{toast()} relative {on ? 'motion-safe:animate-sheet-in' : ''}">
				<div class="flex items-center gap-3">
					<svg class="block size-10 shrink-0 overflow-visible" viewBox="0 0 100 100" aria-hidden="true">
						{#each segments as segment, pillarIndex (pillarIndex)}
							<path
								class="pillar-stroke fill-none stroke-[9] [stroke-linecap:round]"
								d={segment.d}
								style:--h={segment.hue}
							/>
						{/each}
						<circle class="fill-ink" cx="50" cy="50" r="10" />
					</svg>
					<div class="min-w-0">
						{#if chart.statusKicker}
							<Eyebrow>{chart.statusKicker}</Eyebrow>
						{/if}
						<p
							class="m-0 font-serif text-[1.12rem] leading-[1.15] font-[460] tracking-[-0.02em] text-balance line-clamp-2 group-hover:line-clamp-none {chart.statusKicker
								? 'mt-0.5'
								: ''}"
						>
							{words}
						</p>
					</div>
					{#if chart.statusCount > 1}
						{#key chart.statusCount}
							<p
								class="m-0 grid h-9 min-w-9 shrink-0 place-items-center rounded-full bg-sunken px-2 font-serif text-[0.95rem] leading-none font-[520] tracking-[-0.03em] text-text tabular-nums motion-safe:animate-toast-tick"
							>
								×{chart.statusCount}
							</p>
						{/key}
					{/if}
				</div>
			</div>
		{/key}
	</div>
</div>
