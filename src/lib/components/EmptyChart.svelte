<script lang="ts">
	import { HUES } from '$lib/chart/model';
	import { arcPath, pillarArc } from '$lib/chart/ring';
	import Button from './ui/Button.svelte';
	import Eyebrow from './ui/Eyebrow.svelte';

	interface Props {
		onpreset: () => void;
		onchat: () => void;
		onwrite: () => void;
	}

	let { onpreset, onchat, onwrite }: Props = $props();

	const GEOMETRY = { radius: 40, stroke: 8, gap: 8 };
	const arcs = HUES.map((hue, pillarIndex) => {
		const { start, end } = pillarArc(pillarIndex, GEOMETRY);
		return { hue, pillarIndex, d: arcPath(50, 50, GEOMETRY.radius, start, end) };
	});
	/** The words wait for the ring: eight arcs draw in pillar order, then the center dot lands. */
	const DOT = 0.25 + 8 * 0.06 + 0.1;
</script>

<!-- A new chart is the mandala before anything is written: eight empty places around one dot. -->
<section class="mx-auto flex w-full max-w-[560px] flex-col items-center gap-5 px-4 pt-4 pb-12 text-center max-[900px]:gap-4 max-[900px]:px-0 max-[900px]:pt-0" aria-labelledby="empty-chart-title">
	<svg class="block size-[132px] overflow-visible max-[900px]:size-[96px]" viewBox="0 0 100 100" aria-hidden="true">
		{#each arcs as arc (arc.pillarIndex)}
			<path
				class="ring-track fill-none stroke-[8] [stroke-dasharray:1] [stroke-linecap:round] motion-safe:animate-seal-draw"
				d={arc.d}
				pathLength="1"
				style:--h={arc.hue}
				style:animation-delay="{0.25 + arc.pillarIndex * 0.06}s"
			/>
		{/each}
		<circle class="fill-ink origin-center [transform-box:fill-box] motion-safe:animate-stamp" cx="50" cy="50" r="9" style:animation-delay="{DOT}s" />
	</svg>
	<div class="flex flex-col items-center gap-2">
		<div class="motion-safe:animate-done-in" style:animation-delay="{DOT + 0.15}s"><Eyebrow class="m-0">A new chart</Eyebrow></div>
		<h2
			id="empty-chart-title"
			class="m-0 font-serif text-[2rem] leading-[1.1] font-[480] tracking-[-0.02em] text-balance motion-safe:animate-done-in max-[900px]:text-[1.6rem]"
			style:animation-delay="{DOT + 0.2}s"
		>
			One goal in the center
		</h2>
		<p class="m-0 max-w-[40ch] text-[0.98rem] leading-snug text-pretty text-muted motion-safe:animate-done-in" style:animation-delay="{DOT + 0.28}s">
			Eight pillars around it, and eight actions under each. Start from a preset, let a chat app write it, or write it yourself.
		</p>
	</div>
	<div class="flex flex-wrap items-center justify-center gap-2 motion-safe:animate-done-in" style:animation-delay="{DOT + 0.38}s">
		<Button icon="list" onclick={onpreset}>Start from a preset</Button>
		<Button variant="soft" icon="sparkles" onclick={onchat}>Write with a chat app</Button>
		<Button variant="ghost" icon="edit" onclick={onwrite}>Write it myself</Button>
	</div>
</section>
