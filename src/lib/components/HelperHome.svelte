<script lang="ts">
	import type { HelperStore } from '$lib/chart/helper.svelte';
	import { doorsFor, nextMove, noteFor, progressOf, suggestToday, type HelperDoor } from '$lib/chart/helper';
	import { HUES } from '$lib/chart/model';
	import { arcPath, pillarArc } from '$lib/chart/ring';
	import Icon, { type IconName } from './Icon.svelte';
	import Button from './ui/Button.svelte';

	let { helper, reveal }: { helper: HelperStore; reveal: (key: string) => void } = $props();

	const note = $derived(noteFor(helper.data, new Date(), helper.lead));
	const lead = $derived(nextMove(helper.data));
	const doors = $derived(doorsFor(helper.data));
	const picked = $derived(suggestToday(helper.data).map((pick) => pick.pillarIndex));
	const ticked = $derived(new Set(progressOf(helper.data).pillars));

	const RING = { radius: 38, stroke: 13, gap: 9 };
	const arcs = HUES.map((hue, pillarIndex) => {
		const { start, end } = pillarArc(pillarIndex, RING);
		return { hue, pillarIndex, d: arcPath(50, 50, RING.radius, start, end) };
	});

	const ICONS: Record<HelperDoor['page'], IconName> = {
		home: 'grid',
		today: 'calendar',
		week: 'pin',
		progress: 'clock',
		review: 'eye',
		write: 'copy'
	};
</script>

<div class="flex flex-col gap-4 px-4 pt-1 pb-4">
	<!-- Bindu's note: what it would say first, if it could only say one thing. -->
	<div class="rounded-[22px] rounded-ss-[8px] bg-bg px-4 py-3.5 motion-safe:animate-pop-in">
		<p class="m-0 text-[1.02rem] leading-[1.45] text-pretty">{note.text}</p>
		{#if note.insight?.key}
			{@const key = note.insight.key}
			<button
				type="button"
				class="mt-1.5 cursor-pointer border-0 bg-transparent p-0 font-sans text-[0.84rem] font-[600] text-text underline decoration-line underline-offset-4 hover:decoration-text focus-visible:rounded focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink"
				onclick={() => reveal(key)}
			>
				Open it
			</button>
		{/if}
	</div>

	<Button class="w-full motion-safe:animate-pop-in [animation-delay:60ms]" data-door={lead.page} onclick={() => helper.go(lead.page, lead.mode)}>{lead.label}</Button>

	{#if doors.length}
		<ul class="-mx-1.5 m-0 flex list-none flex-col p-0">
			{#each doors as door, index (door.page)}
				<li class="motion-safe:animate-pop-in" style:animation-delay="{110 + index * 40}ms">
					<button
						type="button"
						data-door={door.page}
						class="group/door flex min-h-[56px] w-full cursor-pointer items-center gap-3 rounded-[18px] border-0 bg-transparent px-1.5 py-1.5 text-start font-sans text-text hover:bg-sunken focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-ink active:scale-[0.985] motion-safe:transition-[scale] motion-safe:duration-150 motion-safe:ease-ui"
						onclick={() => helper.go(door.page, door.mode)}
					>
						<span class="grid size-10 shrink-0 place-items-center rounded-full bg-sunken text-text group-hover/door:bg-surface" aria-hidden="true">
							{#if door.page === 'today' && picked.length}
								<!-- The pillars today's picks would come from. -->
								<span class="flex items-center gap-[3px]">
									{#each picked as pillarIndex, dot (dot)}
										<span class="pip size-[7px] rounded-full" style:--pip-h={HUES[pillarIndex]}></span>
									{/each}
								</span>
							{:else if door.page === 'progress'}
								<!-- The ring, lit for each pillar ticked in the last 7 days. -->
								<svg class="block size-[22px] overflow-visible" viewBox="0 0 100 100">
									{#each arcs as arc (arc.pillarIndex)}
										<path
											class="{ticked.has(arc.pillarIndex) ? 'pillar-stroke' : 'ring-track'} fill-none stroke-[13] [stroke-linecap:round]"
											d={arc.d}
											style:--h={arc.hue}
										/>
									{/each}
								</svg>
							{:else}
								<Icon name={ICONS[door.page]} size={18} />
							{/if}
						</span>
						<span class="flex min-w-0 flex-1 flex-col gap-0.5">
							<span class="text-[0.95rem] leading-tight font-[600]">{door.label}</span>
							<span class="truncate text-[0.8rem] leading-tight text-muted">{door.detail}</span>
						</span>
						<Icon
							name="chevron-right"
							size={16}
							class="shrink-0 text-muted motion-safe:transition-transform motion-safe:duration-200 motion-safe:ease-ui can-hover:group-hover/door:translate-x-0.5"
						/>
					</button>
				</li>
			{/each}
		</ul>
	{/if}
</div>
