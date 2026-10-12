<script lang="ts">
	import { cn } from './ui/cn';

	type Props = {
		/** How much of the ring is drawn, 0 to 1. */
		share: number;
		/** The action's pillar hue. A break has none and draws in ink. */
		hue?: number;
		/** Drawn whole, with a check in place of the dot. */
		done?: boolean;
		/** Draw the ring and the check in, once, as the moment happens. */
		play?: boolean;
		class?: string;
	};

	let { share, hue, done = false, play = false, class: className }: Props = $props();
</script>

<svg class={cn('shrink-0 overflow-visible', className)} viewBox="0 0 100 100" aria-hidden="true">
	<g transform="rotate(-90 50 50)">
		<circle class="ring-track fill-none stroke-[11]" cx="50" cy="50" r="38" style:--h={hue ?? 60} />
		<circle
			class={cn(
				'fill-none stroke-[11] [stroke-dasharray:1] [stroke-linecap:round]',
				hue === undefined ? 'stroke-ink' : 'pillar-stroke',
				done ? play && 'motion-safe:animate-seal-draw' : 'motion-safe:transition-[stroke-dashoffset] motion-safe:duration-1000 motion-safe:ease-linear'
			)}
			cx="50"
			cy="50"
			r="38"
			pathLength="1"
			style:stroke-dashoffset={done ? 0 : 1 - Math.min(1, Math.max(0, share))}
			style:--h={hue}
		/>
	</g>
	{#if done}
		<polyline
			class={cn(
				'fill-none stroke-text stroke-[10] [stroke-dasharray:1] [stroke-linecap:round] [stroke-linejoin:round]',
				play && 'motion-safe:animate-seal-draw motion-safe:[animation-delay:0.42s]'
			)}
			points="34 51 45 62 66 40"
			pathLength="1"
		/>
	{:else}
		<circle class="fill-ink" cx="50" cy="50" r="9" />
	{/if}
</svg>
