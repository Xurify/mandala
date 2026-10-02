<script lang="ts">
	import { chart } from '$lib/chart/chart.svelte';
	import { HUES, getByKey, pillarActivityLast7, weekStartKey } from '$lib/chart/model';
	import { arcPath, pillarArc } from '$lib/chart/ring';
	import Icon from './Icon.svelte';
	import Button from './ui/Button.svelte';
	import Dialog from './ui/Dialog.svelte';

	interface Props {
		open?: boolean;
	}

	let { open = $bindable(false) }: Props = $props();

	const currentWeekKey = $derived(weekStartKey());
	const activity = $derived(pillarActivityLast7(chart.data));

	let reflectionNote = $state('');

	$effect(() => {
		if (open) {
			const saved = chart.data.weeks?.[currentWeekKey];
			reflectionNote = saved?.note ?? '';
		}
	});

	const VIEW = 100;
	const CENTER = VIEW / 2;
	const GEOMETRY = { radius: 40, stroke: 8, gap: 5 };

	const ringSegments = $derived(
		HUES.map((hue, pillarIndex) => {
			const level = activity[pillarIndex] ?? 0;
			const { start, end } = pillarArc(pillarIndex, GEOMETRY);
			const isActive = level > 0;
			return {
				hue,
				track: arcPath(CENTER, CENTER, GEOMETRY.radius, start, end),
				isActive,
				level
			};
		})
	);

	type MilestoneEntry = {
		key: string;
		text: string;
		pillarName: string;
	};

	const closedMilestones = $derived.by((): MilestoneEntry[] => {
		const results: MilestoneEntry[] = [];
		for (let pillarIndex = 0; pillarIndex < 8; pillarIndex++) {
			const pillarName = chart.data.pillars[pillarIndex]?.trim() || `Pillar ${pillarIndex + 1}`;
			for (let actionIndex = 0; actionIndex < 8; actionIndex++) {
				const key = `a${pillarIndex}_${actionIndex}`;
				const meta = chart.metaOf(key);
				if (meta?.kind === 'milestone' && meta.done) {
					const text = getByKey(chart.data, key).trim();
					if (text) {
						results.push({ key, text, pillarName });
					}
				}
			}
		}
		return results;
	});

	type NeglectedPillar = {
		pillarIndex: number;
		name: string;
		actions: { key: string; text: string }[];
	};

	const neglectedPillars = $derived.by((): NeglectedPillar[] => {
		const results: NeglectedPillar[] = [];
		for (let pillarIndex = 0; pillarIndex < 8; pillarIndex++) {
			if ((activity[pillarIndex] ?? 0) === 0) {
				const name = chart.data.pillars[pillarIndex]?.trim() || `Pillar ${pillarIndex + 1}`;
				const actions: { key: string; text: string }[] = [];
				for (let actionIndex = 0; actionIndex < 8; actionIndex++) {
					const key = `a${pillarIndex}_${actionIndex}`;
					const text = getByKey(chart.data, key).trim();
					if (text) {
						actions.push({ key, text });
					}
				}
				if (actions.length > 0) {
					results.push({ pillarIndex, name, actions });
				}
			}
		}
		return results;
	});

	let expandedPillarIndex = $state<number | null>(null);

	function togglePillarExpand(pillarIndex: number): void {
		expandedPillarIndex = expandedPillarIndex === pillarIndex ? null : pillarIndex;
	}

	function handleDismiss(): void {
		chart.dismissWeekNotice(currentWeekKey);
		open = false;
	}

	function handleSave(): void {
		chart.saveWeekReflection(currentWeekKey, { note: reflectionNote });
		chart.say('Weekly reflection saved.');
		open = false;
	}
</script>

<Dialog bind:open title="Weekly Reflection" description="A calm look back at your progress this week.">
	<div class="flex flex-col gap-6">
		<section class="flex flex-col items-center gap-3">
			<h3 class="text-[0.82rem] font-bold tracking-wider text-muted uppercase">Pillar Balance</h3>
			<div class="relative size-[100px]" role="img" aria-label="7-day pillar balance ring">
				<svg class="block overflow-visible" viewBox="0 0 {VIEW} {VIEW}" width="100" height="100" aria-hidden="true">
					{#each ringSegments as segment, pillarIndex (pillarIndex)}
						<path
							class="fill-none stroke-[8] [stroke-linecap:round] motion-safe:transition-opacity motion-safe:duration-300"
							d={segment.track}
							style:stroke="oklch(0.65 0.14 {segment.hue})"
							style:opacity={segment.isActive ? 1 : 0.18}
						/>
					{/each}
				</svg>
				<span class="absolute inset-0 flex items-center justify-center text-muted">
					<Icon name="compass" size={24} />
				</span>
			</div>
			<p class="text-center text-[0.82rem] text-muted">
				Glowing slices show pillars you engaged with in the last 7 days.
			</p>
		</section>

		<section class="flex flex-col gap-2">
			<h3 class="text-[0.82rem] font-bold tracking-wider text-muted uppercase">Milestones Closed</h3>
			{#if closedMilestones.length > 0}
				<div class="flex flex-col gap-1.5">
					{#each closedMilestones as milestone (milestone.key)}
						<div class="flex items-center gap-2.5 rounded-[14px] bg-sunken px-3.5 py-2.5">
							<span class="flex size-4 shrink-0 items-center justify-center rounded-full bg-success text-surface" aria-hidden="true">
								<Icon name="check" size={10} strokeWidth={2.6} />
							</span>
							<span class="text-[0.88rem] font-medium text-text">{milestone.text}</span>
							<span class="ms-auto text-[0.76rem] text-muted">{milestone.pillarName}</span>
						</div>
					{/each}
				</div>
			{:else}
				<p class="text-[0.86rem] text-muted italic">Nothing closed this week — that is completely fine.</p>
			{/if}
		</section>

		{#if neglectedPillars.length > 0}
			<section class="flex flex-col gap-2">
				<div class="flex items-center justify-between">
					<h3 class="text-[0.82rem] font-bold tracking-wider text-muted uppercase">Tune Up</h3>
					<span class="text-[0.76rem] text-muted">Feeling stuck? Swap an action.</span>
				</div>
				<div class="flex flex-col gap-2">
					{#each neglectedPillars as pillar (pillar.pillarIndex)}
						{@const isExpanded = expandedPillarIndex === pillar.pillarIndex}
						<div class="rounded-[16px] bg-sunken p-3">
							<button
								type="button"
								class="flex w-full cursor-pointer items-center justify-between text-left"
								onclick={() => togglePillarExpand(pillar.pillarIndex)}
								aria-expanded={isExpanded}
							>
								<div class="flex items-center gap-2">
									<span class="size-2 rounded-full" style:background-color="oklch(0.65 0.14 {HUES[pillar.pillarIndex]})"></span>
									<span class="text-[0.88rem] font-semibold text-text">{pillar.name}</span>
								</div>
								<Icon name={isExpanded ? 'chevron-down' : 'chevron-right'} size={15} class="text-muted" />
							</button>

							{#if isExpanded}
								<div class="mt-3 flex flex-col gap-1.5 border-t border-line pt-2.5">
									{#each pillar.actions as action (action.key)}
										<div class="flex items-center gap-2">
											<input
												type="text"
												class="w-full rounded-[10px] border border-line bg-surface px-2.5 py-1 text-[0.82rem] text-text placeholder:text-muted focus:shadow-[0_0_0_2px_var(--ink)] focus:outline-none"
												value={action.text}
												onchange={(event) => chart.setText(action.key, event.currentTarget.value)}
											/>
										</div>
									{/each}
								</div>
							{/if}
						</div>
					{/each}
				</div>
			</section>
		{/if}

		<section class="flex flex-col gap-2">
			<h3 class="text-[0.82rem] font-bold tracking-wider text-muted uppercase">Reflection Note</h3>
			<textarea
				class="min-h-24 w-full resize-none rounded-[16px] border border-line bg-sunken p-3 text-[0.88rem] text-text placeholder:text-muted focus:shadow-[0_0_0_2px_var(--ink)] focus:outline-none"
				placeholder="What went well? What did you learn this week? (Optional)"
				bind:value={reflectionNote}
			></textarea>
		</section>
	</div>

	{#snippet footer()}
		<div class="flex w-full items-center justify-between gap-2">
			<Button variant="ghost" onclick={handleDismiss}>Dismiss</Button>
			<Button variant="primary" onclick={handleSave}>Done</Button>
		</div>
	{/snippet}
</Dialog>
