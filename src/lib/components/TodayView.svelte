<script lang="ts">
	import { chart } from '$lib/chart/chart.svelte';
	import { HUES, getByKey, isUrl, todayKey, pillarActivityLast7 } from '$lib/chart/model';
	import type { ActionMeta } from '$lib/chart/model';
	import Icon from './Icon.svelte';
	import WeeklyReflection from './WeeklyReflection.svelte';
	import Button from './ui/Button.svelte';
	import Notice from './ui/Notice.svelte';
	import { cn } from './ui/cn';

	const dateKey = todayKey();
	let reflectionOpen = $state(false);

	type ActionEntry = {
		key: string;
		text: string;
		meta: ActionMeta | undefined;
		pillarIndex: number;
		pillarName: string;
	};

	const allActions = $derived.by((): ActionEntry[] => {
		const entries: ActionEntry[] = [];
		for (let pillarIndex = 0; pillarIndex < 8; pillarIndex++) {
			const pillarName = chart.data.pillars[pillarIndex]?.trim() || `Pillar ${pillarIndex + 1}`;
			for (let actionIndex = 0; actionIndex < 8; actionIndex++) {
				const key = `a${pillarIndex}_${actionIndex}`;
				const text = getByKey(chart.data, key).trim();
				if (!text) continue;
				entries.push({ key, text, meta: chart.metaOf(key), pillarIndex, pillarName });
			}
		}
		return entries;
	});

	const sortedActions = $derived.by((): ActionEntry[] => {
		const activity = pillarActivityLast7(chart.data);
		return [...allActions].sort((actionA, actionB) => {
			const pinnedA = actionA.meta?.pinned ? -1 : 0;
			const pinnedB = actionB.meta?.pinned ? -1 : 0;
			if (pinnedA !== pinnedB) return pinnedA - pinnedB;
			const activityA = activity[actionA.pillarIndex] ?? 0;
			const activityB = activity[actionB.pillarIndex] ?? 0;
			if (activityA !== activityB) return activityA - activityB;
			return actionA.pillarIndex - actionB.pillarIndex;
		});
	});

	const activity = $derived(pillarActivityLast7(chart.data));

	const selectedKeys = $state<string[]>([]);
	let confirmed = $state(chart.todayLog.focus.length > 0);
	let shaking = $state(false);

	$effect(() => {
		if (chart.todayLog.focus.length > 0) {
			confirmed = true;
			selectedKeys.length = 0;
			selectedKeys.push(...chart.todayLog.focus);
		}
	});

	function toggleSelect(key: string): void {
		if (confirmed) return;
		const index = selectedKeys.indexOf(key);
		if (index >= 0) {
			selectedKeys.splice(index, 1);
		} else {
			if (selectedKeys.length >= 3) {
				triggerShake();
				return;
			}
			selectedKeys.push(key);
		}
	}

	function triggerShake(): void {
		shaking = true;
		setTimeout(() => { shaking = false; }, 400);
	}

	function confirm(): void {
		if (selectedKeys.length === 0) return;
		chart.setFocus(dateKey, [...selectedKeys]);
		confirmed = true;
	}

	function adjust(): void {
		confirmed = false;
	}

	function toggleChecked(key: string): void {
		chart.toggleChecked(dateKey, key);
		checkAllDone();
	}

	let allDone = $state(false);
	function checkAllDone(): void {
		const focusKeys = chart.todayLog.focus;
		allDone = focusKeys.length > 0 && focusKeys.every((focusKey) => chart.todayLog.checked.includes(focusKey));
	}

	const focusEntries = $derived.by((): ActionEntry[] => {
		return chart.todayLog.focus
			.map((focusKey) => allActions.find((actionEntry) => actionEntry.key === focusKey))
			.filter((entry): entry is ActionEntry => entry !== undefined);
	});

	function maxActivity(): number {
		return Math.max(...activity, 1);
	}

	const today = new Date();
	const dayLabel = today.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });
</script>

<div class="mx-auto w-full max-w-[620px] px-4 py-6 max-[900px]:px-3 max-[900px]:py-4">
	{#if chart.weekReflectionDue}
		<div class="mb-5">
			<Notice>
				{#snippet children()}
					Take a moment to reflect on your week.
				{/snippet}
				{#snippet action()}
					<Button size="sm" variant="soft" onclick={() => (reflectionOpen = true)}>
						Reflect
					</Button>
				{/snippet}
			</Notice>
		</div>
	{/if}

	<div class="mb-5">
		<p class="text-[0.82rem] font-medium text-muted">{dayLabel}</p>
		<h2 class="font-serif text-[1.7rem] font-[480] leading-[1.15] tracking-[-0.02em] text-text max-[900px]:text-[1.45rem]">
			{confirmed ? "Today's focus" : 'What are you focusing on today?'}
		</h2>
	</div>

	{#if !confirmed}
		<div class="mb-5 flex items-center gap-2" aria-label="Pillar activity over the last 7 days">
			{#each Array(8) as _, pillarIndex (pillarIndex)}
				{@const level = activity[pillarIndex] ?? 0}
				{@const maxLevel = maxActivity()}
				{@const opacity = level === 0 ? 0.18 : 0.4 + (level / maxLevel) * 0.6}
				<div
					class="h-2 flex-1 rounded-full"
					style:background-color="oklch(0.65 0.14 {HUES[pillarIndex]})"
					style:opacity={opacity}
					title="{chart.data.pillars[pillarIndex]?.trim() || `Pillar ${pillarIndex + 1}`}: {level} active day{level === 1 ? '' : 's'} this week"
					aria-hidden="true"
				></div>
			{/each}
		</div>

		<div class="mb-4 flex items-center justify-between">
			<span class="text-[0.82rem] text-muted">Select up to 3</span>
			<span
				class={cn(
					'text-[0.82rem] font-semibold tabular-nums',
					selectedKeys.length === 0 ? 'text-muted' : 'text-text'
				)}
				aria-live="polite"
			>
				{selectedKeys.length} / 3
			</span>
		</div>

		<div class={cn('mb-5 flex flex-col gap-1.5', shaking && 'motion-safe:animate-shake')}>
			{#each sortedActions as entry (entry.key)}
				{@const isSelected = selectedKeys.includes(entry.key)}
				{@const isDone = entry.meta?.done}
				<button
					type="button"
					class={cn(
						'group flex w-full flex-col gap-0.5 rounded-[16px] border-0 px-4 py-3 text-left motion-safe:transition-[background-color,box-shadow] motion-safe:duration-150',
						isSelected
							? 'bg-ink text-on-ink shadow-[0_2px_12px_oklch(0_0_0/0.18)]'
							: isDone
								? 'bg-sunken text-muted line-through'
								: 'bg-sunken text-text hover:bg-sunken-hover'
					)}
					onclick={() => toggleSelect(entry.key)}
					aria-pressed={isSelected}
				>
					<span class="flex items-center justify-between gap-2">
						<span class="text-[0.92rem] font-medium leading-snug">{entry.text}</span>
						{#if entry.meta?.pinned}
							<Icon name="pin" size={12} class={cn('shrink-0 opacity-60', isSelected && 'opacity-80')} />
						{/if}
					</span>
					{#if entry.meta?.note}
						<span class={cn('text-[0.78rem]', isSelected ? 'opacity-70' : 'text-muted')}>
							{#if isUrl(entry.meta.note)}
								<Icon name="link" size={11} class="mr-0.5 align-middle" />{entry.meta.note}
							{:else}
								{entry.meta.note}
							{/if}
						</span>
					{/if}
					<span class={cn('text-[0.72rem]', isSelected ? 'opacity-60' : 'text-muted opacity-70')}>{entry.pillarName}</span>
				</button>
			{/each}
			{#if allActions.length === 0}
				<p class="py-6 text-center text-[0.88rem] text-muted">Add actions to your chart first.</p>
			{/if}
		</div>

		<button
			type="button"
			class="w-full rounded-full bg-ink px-6 py-3 text-[0.92rem] font-semibold text-on-ink motion-safe:transition-opacity disabled:opacity-40"
			disabled={selectedKeys.length === 0}
			onclick={confirm}
		>
			Start my day
		</button>
	{:else}
		<div class={cn('mb-5 flex flex-col gap-2', allDone && 'motion-safe:animate-ring-pulse')}>
			{#each focusEntries as entry (entry.key)}
				{@const isChecked = chart.todayLog.checked.includes(entry.key)}
				<button
					type="button"
					class={cn(
						'group flex w-full items-start gap-3.5 rounded-[16px] border-0 px-4 py-3.5 text-left motion-safe:transition-[background-color,opacity] motion-safe:duration-200',
						isChecked ? 'bg-sunken opacity-60' : 'bg-sunken hover:bg-sunken-hover'
					)}
					onclick={() => toggleChecked(entry.key)}
					aria-pressed={isChecked}
				>
					<span
						class={cn(
							'mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full border-2 motion-safe:transition-[background-color,border-color] motion-safe:duration-150',
							isChecked
								? 'border-success bg-success text-surface'
								: 'border-line bg-transparent group-hover:border-muted'
						)}
						aria-hidden="true"
					>
						{#if isChecked}
							<Icon name="check" size={12} strokeWidth={2.5} />
						{/if}
					</span>
					<span class="flex flex-col gap-0.5">
						<span class={cn('text-[0.95rem] font-medium leading-snug', isChecked && 'line-through')}>{entry.text}</span>
						{#if entry.meta?.note}
							<span class="text-[0.78rem] text-muted">
								{#if isUrl(entry.meta.note)}
									<a
										href={entry.meta.note}
										target="_blank"
										rel="noopener noreferrer"
										class="inline-flex items-center gap-1 underline underline-offset-2 hover:text-text"
										onclick={(event) => event.stopPropagation()}
									>
										<Icon name="link" size={11} />
										{entry.meta.note}
									</a>
								{:else}
									{entry.meta.note}
								{/if}
							</span>
						{/if}
					</span>
				</button>
			{/each}
		</div>

		{#if allDone}
			<p class="mb-4 text-center text-[0.88rem] font-medium text-success">
				Done for today.
			</p>
		{/if}

		<button
			type="button"
			class="w-full rounded-full border border-line bg-transparent px-6 py-2.5 text-[0.85rem] font-medium text-muted hover:bg-sunken hover:text-text motion-safe:transition-colors"
			onclick={adjust}
		>
			Adjust
		</button>
	{/if}

	<div class="mt-8 flex justify-center border-t border-line pt-4">
		<button
			type="button"
			class="cursor-pointer text-[0.82rem] font-medium text-muted hover:text-text motion-safe:transition-colors"
			onclick={() => (reflectionOpen = true)}
		>
			Weekly reflection
		</button>
	</div>

	<WeeklyReflection bind:open={reflectionOpen} />
</div>
