<script lang="ts">
	import { draftButton, editWords, groupEdits, type HelperOffer, type KindChange } from '$lib/chart/helper';
	import { HUES, setByKey, type ActionKind, type ChartData } from '$lib/chart/model';
	import MiniChart from './MiniChart.svelte';
	import Button from './ui/Button.svelte';

	interface Props {
		data: ChartData;
		draft: HelperOffer;
		onkeep: () => void;
		aside: string;
		onaside: () => void;
	}

	let { data, draft, onkeep, aside, onaside }: Props = $props();

	const KIND_LABELS: Record<ActionKind | 'standard', string> = { standard: 'Standard', routine: 'Routine', milestone: 'Milestone' };

	const kindGroups = $derived.by(() => {
		if (draft.kind !== 'kinds') return [];
		const groups: { pillarIndex: number; label: string; changes: KindChange[] }[] = [];
		for (const change of draft.changes) {
			let group = groups.find((entry) => entry.pillarIndex === change.pillarIndex);
			if (!group) {
				group = { pillarIndex: change.pillarIndex, label: data.pillars[change.pillarIndex]?.trim() || `Pillar ${change.pillarIndex + 1}`, changes: [] };
				groups.push(group);
			}
			group.changes.push(change);
		}
		return groups.sort((a, b) => a.pillarIndex - b.pillarIndex);
	});

	const preview = $derived.by(() => {
		if (draft.kind !== 'cells') return data;
		const next = $state.snapshot(data);
		for (const edit of draft.edits) setByKey(next, edit.key, edit.after);
		return next;
	});
</script>

{#if draft.kind === 'chart'}
	{@const chart = draft.data}
	<div class="flex flex-col gap-3 rounded-[20px] bg-bg p-3.5 motion-safe:animate-pop-in">
		<div class="flex items-start gap-3.5">
			<MiniChart data={chart} play="fill" cell={8} label="A full chart, 64 actions" />
			<p class="m-0 min-w-0 flex-1 text-[0.98rem] leading-snug font-[620] text-pretty">{chart.goal}</p>
		</div>
		<ol class="m-0 grid list-none grid-cols-2 gap-x-3 gap-y-1 p-0 text-[0.84rem] leading-[1.35]">
			{#each chart.pillars as pillar, pillarIndex (pillarIndex)}
				<li class="flex min-w-0 items-center gap-1.5">
					<span class="pip size-2 shrink-0 rounded-full" style:--pip-h={HUES[pillarIndex]} aria-hidden="true"></span>
					<span class="truncate">{pillar}</span>
				</li>
			{/each}
		</ol>
		<div class="flex items-center gap-2">
			<Button size="sm" onclick={onkeep}>{draftButton(data)}</Button>
			<Button size="sm" variant="ghost" onclick={onaside}>{aside}</Button>
		</div>
	</div>
{:else if draft.kind === 'kinds'}
	<div class="flex flex-col gap-3 rounded-[20px] bg-bg p-3.5 motion-safe:animate-pop-in">
		<div class="flex max-h-[220px] flex-col gap-3 overflow-y-auto overscroll-contain">
			{#each kindGroups as group (group.pillarIndex)}
				<section class="flex min-w-0 flex-col gap-1" aria-label={group.label}>
					<p class="m-0 flex items-center gap-1.5 text-[0.76rem] font-[620]">
						<span class="pip size-2 shrink-0 rounded-full" style:--pip-h={HUES[group.pillarIndex]} aria-hidden="true"></span>
						<span class="pillar-ink" style:--h={HUES[group.pillarIndex]}>{group.label}</span>
					</p>
					<ul class="m-0 flex list-none flex-col gap-1.5 p-0 ps-3.5">
						{#each group.changes as change (change.id)}
							<li class="flex flex-col text-[0.88rem] leading-snug text-pretty">
								<span>{change.text}</span>
								<span class="text-[0.8rem] text-muted"><span class="line-through">{KIND_LABELS[change.before ?? 'standard']}</span> {KIND_LABELS[change.after ?? 'standard']}</span>
							</li>
						{/each}
					</ul>
				</section>
			{/each}
		</div>
		<div class="flex items-center gap-2">
			<Button size="sm" onclick={onkeep}>{draft.changes.length === 1 ? 'Keep it' : `Keep all ${draft.changes.length}`}</Button>
			<Button size="sm" variant="ghost" onclick={onaside}>{aside}</Button>
		</div>
	</div>
{:else if draft.kind === 'note'}
	<div class="flex flex-col gap-3 rounded-[20px] bg-bg p-3.5 motion-safe:animate-pop-in">
		{#if draft.before}
			<p class="m-0 text-[0.8rem] leading-snug text-pretty text-muted line-through">{draft.before}</p>
		{/if}
		<p class="m-0 font-serif text-[1.02rem] leading-snug tracking-[-0.005em] text-pretty">“{draft.after}”</p>
		<div class="flex items-center gap-2">
			<Button size="sm" onclick={onkeep}>Save the week</Button>
			<Button size="sm" variant="ghost" onclick={onaside}>{aside}</Button>
		</div>
	</div>
{:else}
	{@const words = editWords(data, draft.edits)}
	<div class="flex flex-col gap-3 rounded-[20px] bg-bg p-3.5 motion-safe:animate-pop-in">
		<div class="flex max-h-[220px] flex-col gap-3 overflow-y-auto overscroll-contain">
			{#each groupEdits(preview, draft.edits) as group (group.key)}
				<section class="flex min-w-0 flex-col gap-1" aria-label={group.label}>
					<p class="m-0 flex items-center gap-1.5 text-[0.76rem] font-[620]">
						{#if group.pillarIndex !== null}
							<span class="pip size-2 shrink-0 rounded-full" style:--pip-h={HUES[group.pillarIndex]} aria-hidden="true"></span>
							<span class="pillar-ink" style:--h={HUES[group.pillarIndex]}>{group.label}</span>
						{:else}
							<span class="text-muted">{group.label}</span>
						{/if}
					</p>
					<ul class="m-0 flex list-none flex-col gap-1 p-0 ps-3.5">
						{#each group.edits as edit (edit.key)}
							<li class="flex flex-col text-[0.88rem] leading-snug text-pretty">
								{#if edit.before.trim()}
									<span class="text-[0.8rem] text-muted line-through">{edit.before}</span>
								{/if}
								<span>{edit.after}</span>
							</li>
						{/each}
					</ul>
				</section>
			{/each}
		</div>
		<div class="flex items-center gap-2">
			<Button size="sm" onclick={onkeep}>{words.button}</Button>
			<Button size="sm" variant="ghost" onclick={onaside}>{aside}</Button>
		</div>
	</div>
{/if}
