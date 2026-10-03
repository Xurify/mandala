<script lang="ts">
	import { HUES } from '$lib/chart/model';
	import { arcPath, PILLAR_ANGLES, pillarArc } from '$lib/chart/ring';
	import Button from './Button.svelte';
	import { cn } from './cn';
	import Eyebrow from './Eyebrow.svelte';
	import { toast } from './styles';

	type Props = {
		kicker?: string;
		subject: string;
		count?: number;
		/** Milliseconds on the clock. 0 keeps the ring full and skips the leave. */
		life?: number;
		/** Absolute time the slip is removed. The fade starts one beat before this. */
		until?: number;
		/** While held, the fade reverses and the clock waits. */
		held?: boolean;
		/** Changing it restarts the ring. */
		clock?: string | number;
		onundo?: () => void;
		class?: string;
	};

	const LEAVE_MS = 680;

	let {
		kicker = '',
		subject,
		count = 1,
		life = 0,
		until = 0,
		held = false,
		clock = 0,
		onundo,
		class: className
	}: Props = $props();

	let leaving = $state(false);

	// The slip starts leaving before it is removed, so the end is not a cut.
	$effect(() => {
		const reduce =
			typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
		if (reduce || life <= 0 || held || until <= 0) {
			leaving = false;
			return;
		}
		const wait = until - Date.now() - LEAVE_MS;
		if (wait <= 0) {
			leaving = true;
			return;
		}
		leaving = false;
		const timeout = setTimeout(() => {
			leaving = true;
		}, Math.max(0, wait));
		return () => clearTimeout(timeout);
	});

	const clockwise = [...PILLAR_ANGLES].sort((a, b) => a - b);
	const segments = HUES.map((hue, pillar) => {
		const { start, end } = pillarArc(pillar, { radius: 34, stroke: 9, gap: 8 });
		return { hue, d: arcPath(50, 50, 34, start, end), turn: clockwise.indexOf(PILLAR_ANGLES[pillar]) };
	});

	const named = $derived(kicker.length > 0);
	const s = $derived(toast({ named }));
	const step = $derived(life / segments.length);
	const sheets = [
		{ sheet: '9px -10px', fan: '16px -18px', tilt: '2.5deg', fanTilt: '6deg' },
		{ sheet: '-5px -6px', fan: '-12px -13px', tilt: '-2deg', fanTilt: '-5deg' }
	];
</script>

<div
	class={cn(
		s.root(),
		'transition-[opacity,translate,scale] ease-[cubic-bezier(0.33,0,0.2,1)]',
		leaving && 'opacity-0 motion-safe:-translate-y-2 motion-safe:scale-[0.98]',
		className
	)}
	style:transition-duration="{LEAVE_MS}ms"
>
	{#each sheets.slice(0, Math.min(2, count - 1)).reverse() as sheet (sheet.sheet)}
		<div
			class={s.sheet()}
			style:--sheet={leaving ? '0px 0px' : sheet.sheet}
			style:--fan={leaving ? '0px 0px' : sheet.fan}
			style:--tilt={leaving ? '0deg' : sheet.tilt}
			style:--tilt-fan={leaving ? '0deg' : sheet.fanTilt}
			style:transition-duration={leaving ? `${LEAVE_MS}ms` : undefined}
			aria-hidden="true"
		></div>
	{/each}
	<div class={s.slip()}>
		{#key clock}
			<svg class={s.mark()} viewBox="0 0 100 100" aria-hidden="true">
				{#each segments as segment, pillar (pillar)}
					<path
						class="pillar-stroke fill-none stroke-[9] [stroke-linecap:round] {life > 0
							? 'motion-safe:animate-ring-drain group-focus-within:[animation-play-state:paused] group-hover:[animation-play-state:paused]'
							: ''}"
						d={segment.d}
						style:--h={segment.hue}
						style:animation-duration={life > 0 ? `${step}ms` : undefined}
						style:animation-delay={life > 0 ? `${segment.turn * step}ms` : undefined}
					/>
				{/each}
				<circle class="fill-ink" cx="50" cy="50" r="10" />
			</svg>
		{/key}
		<div class={s.text()}>
			{#if named}
				<Eyebrow>{kicker}</Eyebrow>
			{/if}
			<p class={s.words()}>{subject}</p>
		</div>
		{#if count > 1}
			{#key count}
				<p class={s.count()}><span aria-hidden="true">×{count}</span><span class="sr-only">, {count} times</span></p>
			{/key}
		{/if}
		{#if onundo}
			<Button size="sm" variant="soft" icon="undo" class="shrink-0" onclick={onundo}>Undo</Button>
		{/if}
	</div>
</div>
