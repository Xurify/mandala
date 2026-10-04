<script lang="ts">
	import { chart } from '$lib/chart/chart.svelte';
	import { HUES, getByKey, pillarActivityLast7, weekStartKey } from '$lib/chart/model';
	import Icon from './Icon.svelte';
	import Button from './ui/Button.svelte';
	import Dialog from './ui/Dialog.svelte';
	import Eyebrow from './ui/Eyebrow.svelte';
	import { cn } from './ui/cn';
	import { textArea, textField } from './ui/styles';

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

	const maxActivity = $derived(Math.max(...activity, 1));

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
	let editingKey = $state<string | null>(null);

	function leadOf(actions: { key: string; text: string }[]): { key: string; text: string } | undefined {
		return actions.find((action) => !chart.metaOf(action.key)?.done) ?? actions[0];
	}

	function focusField(node: HTMLInputElement): void {
		node.focus();
		node.setSelectionRange(node.value.length, node.value.length);
	}

	function togglePillarExpand(pillarIndex: number): void {
		editingKey = null;
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

	<Dialog bind:open title="Weekly reflection" description="A calm look back at your progress this week.">
	<div class="flex flex-col gap-6">
		<section class="flex flex-col gap-2">
			<Eyebrow>Balance</Eyebrow>
			<div class="flex items-center gap-1.5 py-2" role="img" aria-label="7-day pillar balance">
				{#each HUES as hue, pillarIndex (pillarIndex)}
					{@const level = activity[pillarIndex] ?? 0}
					{@const opacity = level === 0 ? 0.18 : 0.45 + (level / maxActivity) * 0.55}
					<span
						class="h-2 flex-1 rounded-full"
						style:--h={hue}
						style:background-color="oklch(var(--ring-fill-l) 0.13 var(--h))"
						style:opacity={opacity}
					></span>
				{/each}
			</div>
			<p class="text-[0.86rem] text-pretty text-muted">Bright bars are pillars you used in the last 7 days.</p>
		</section>

		<section class="flex flex-col gap-2">
			<Eyebrow>Closed</Eyebrow>
			{#if closedMilestones.length > 0}
				<div class="flex flex-col gap-1.5">
					{#each closedMilestones as milestone (milestone.key)}
						<div class="flex min-h-11 items-center gap-2.5 px-3 py-2">
							<span class="flex size-4 shrink-0 items-center justify-center rounded-full bg-success text-surface" aria-hidden="true">
								<Icon name="check" size={10} strokeWidth={2.6} />
							</span>
							<span class="text-[0.88rem] font-medium text-text">{milestone.text}</span>
							<span class="ms-auto text-[0.76rem] text-muted">{milestone.pillarName}</span>
						</div>
					{/each}
				</div>
			{:else}
				<p class="text-[0.86rem] text-pretty text-muted">Nothing closed this week. That is fine.</p>
			{/if}
		</section>

		{#if neglectedPillars.length > 0}
			<section class="flex flex-col gap-2">
				<Eyebrow>Quiet this week</Eyebrow>
				<p class="text-[0.86rem] text-pretty text-muted">
					No actions here in the last 7 days. Rewrite one that isn't working.
				</p>
				<div class="flex flex-col">
					{#each neglectedPillars as pillar (pillar.pillarIndex)}
						{@const lead = leadOf(pillar.actions)}
						{@const rest = pillar.actions.filter((action) => action.key !== lead?.key)}
						{@const isExpanded = expandedPillarIndex === pillar.pillarIndex}
						{#if lead}
							<div>
								<div class="flex items-center">
									{#if editingKey === lead.key}
										<div class="flex min-w-0 flex-1 items-center gap-3 px-3">
											<span
												class="size-3.5 shrink-0 rounded-[4px]"
												style:--h={HUES[pillar.pillarIndex]}
												style:background-color="oklch(var(--ring-fill-l) 0.13 var(--h))"
												aria-hidden="true"
											></span>
											<input
												type="text"
												class={cn(textField, 'min-w-0 flex-1 text-[0.9rem]')}
												value={lead.text}
												aria-label="Rewrite {lead.text}"
												onblur={() => {
													if (editingKey === lead.key) editingKey = null;
												}}
												onchange={(event) => chart.setText(lead.key, event.currentTarget.value)}
												{@attach focusField}
											/>
										</div>
									{:else}
										<button
											type="button"
											class="flex min-h-11 min-w-0 flex-1 cursor-pointer items-center gap-3 rounded-full border-0 px-3 py-1.5 text-left hover:bg-sunken focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink"
											onclick={() => (editingKey = lead.key)}
										>
											<span
												class="size-3.5 shrink-0 rounded-[4px]"
												style:--h={HUES[pillar.pillarIndex]}
												style:background-color="oklch(var(--ring-fill-l) 0.13 var(--h))"
												aria-hidden="true"
											></span>
											<span class="flex min-w-0 flex-col">
												<span class="truncate text-[0.92rem] font-medium text-text">{lead.text}</span>
												<span class="truncate text-[0.72rem] text-muted">{pillar.name}</span>
											</span>
										</button>
									{/if}
									{#if rest.length > 0}
										<button
											type="button"
											class="flex size-11 shrink-0 cursor-pointer items-center justify-center rounded-full border-0 text-muted hover:bg-sunken hover:text-text motion-safe:transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink"
											aria-expanded={isExpanded}
											aria-label={isExpanded ? `Hide other ${pillar.name} actions` : `Show ${rest.length} other ${pillar.name} actions`}
											onclick={() => togglePillarExpand(pillar.pillarIndex)}
										>
											<Icon name={isExpanded ? 'chevron-down' : 'chevron-right'} size={15} />
										</button>
									{/if}
								</div>

								{#if isExpanded}
									<div class="flex flex-col pb-1 pl-9">
										{#each rest as action (action.key)}
											{#if editingKey === action.key}
												<input
													type="text"
													class={cn(textField, 'text-[0.9rem]')}
													value={action.text}
													aria-label="Rewrite {action.text}"
													onblur={() => {
														if (editingKey === action.key) editingKey = null;
													}}
													onchange={(event) => chart.setText(action.key, event.currentTarget.value)}
													{@attach focusField}
												/>
											{:else}
												<button
													type="button"
													class="flex min-h-11 w-full cursor-pointer items-center rounded-full border-0 px-4 text-left text-[0.9rem] text-text hover:bg-sunken focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink"
													onclick={() => (editingKey = action.key)}
												>
													{action.text}
												</button>
											{/if}
										{/each}
									</div>
								{/if}
							</div>
						{/if}
					{/each}
				</div>
			</section>
		{/if}

		<section class="flex flex-col gap-2">
			<Eyebrow>Note</Eyebrow>
			<textarea
				class={cn(textArea, 'min-h-24 resize-none')}
				placeholder="What happened this week?"
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
