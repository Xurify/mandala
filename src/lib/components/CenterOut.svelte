<script lang="ts">
	import { tick } from 'svelte';
	import { chart } from '$lib/chart/chart.svelte';
	import { HUES, idx, TEXT_MAX } from '$lib/chart/model';
	import { morph } from '$lib/chart/morph';
	import { getPreset, listPresets, type PresetId } from '$lib/chart/presets';
	import { arcPath, pillarArc } from '$lib/chart/ring';
	import {
		actionsMatchPreset,
		countCompletedBlocks,
		nextUnfinishedPillar,
		pillarsToWrite,
		presetActionsToLend,
		resumeStep,
		type StartStep
	} from '$lib/chart/start';
	import DaySeal from './DaySeal.svelte';
	import { fitCellField } from './goal-fit';
	import Icon from './Icon.svelte';
	import Button from './ui/Button.svelte';
	import Eyebrow from './ui/Eyebrow.svelte';
	import Pages from './ui/Pages.svelte';
	import { cn } from './ui/cn';
	import { textField } from './ui/styles';

	type Props = {
		/** Left out when Bindu is off, which takes the chat app door with it. */
		ondraftinchat?: () => void;
		onopenguide: () => void;
		showGuideLink?: boolean;
		class?: string;
	};

	let { ondraftinchat, onopenguide, showGuideLink = false, class: className }: Props = $props();

	type Step = StartStep | 'done';

	const resumeAt = resumeStep(chart.data);
	let step = $state<Step>(resumeAt.step);
	let currentPillar = $state(resumeAt.pillar ?? 0);
	let turnDirection = $state(1);
	let pillarWithPresetActions = $state<number | null>(null);
	let animateArrivingLines = $state(false);
	let onFirstPage = $state(true);
	let sheetElement = $state<HTMLElement | null>(null);

	const presets = listPresets();
	const borrowedPreset = $derived(chart.borrowedPreset ? getPreset(chart.borrowedPreset) : undefined);
	const goalText = $derived(chart.data.goal.trim());
	const namedPillars = $derived(chart.data.pillars.flatMap((name, k) => (name.trim() ? [k] : [])));
	const actionCounts = $derived(chart.milestones.pillarActionCounts);
	const completedBlocks = $derived(countCompletedBlocks(chart.data));
	const chartComplete = $derived(Boolean(goalText) && completedBlocks === 8);
	const nextPillar = $derived(nextUnfinishedPillar(chart.data, step === 'actions' ? currentPillar : undefined));
	const anyActionsWritten = $derived(namedPillars.some((k) => (actionCounts[k] ?? 0) > 0));
	const completedPillars = $derived(namedPillars.filter((k) => actionCounts[k] === 8));
	const ringIndex = $derived(step === 'goal' ? 0 : step === 'pillars' ? 1 : 2);
	const pageKey = $derived(step === 'actions' ? `actions-${currentPillar}` : step);

	const pageLabels: Record<Step, string> = {
		goal: 'The goal',
		pillars: 'The pillars',
		overview: 'The outer ring',
		actions: 'A pillar’s actions',
		done: 'The chart'
	};

	const RING_GEOMETRY = { radius: 40, stroke: 8, gap: 8 };
	const ringArcs = HUES.map((hue, pillarIndex) => {
		const { start, end } = pillarArc(pillarIndex, RING_GEOMETRY);
		return { hue, pillarIndex, d: arcPath(50, 50, RING_GEOMETRY.radius, start, end) };
	});
	const ARC_DRAW_DELAY_S = 0.25;
	const ARC_STAGGER_S = 0.06;
	const DOT_LANDS_AT_S = ARC_DRAW_DELAY_S + 8 * ARC_STAGGER_S + 0.1;
	const DEAL_DELAY_MS = 80;
	const DEAL_STAGGER_MS = 70;
	const SEAL_DRAW_START_S = 0.35;
	const PAUSE_AFTER_SEAL_S = 0.35;

	function pillarName(k: number): string {
		return chart.data.pillars[k]?.trim() ?? '';
	}

	function stepBackIfClearedElsewhere(): void {
		if (step === 'goal' || step === 'done') return;
		if (!goalText) step = 'goal';
		else if (step !== 'pillars' && namedPillars.length === 0) step = 'pillars';
		else if (step === 'actions' && !pillarName(currentPillar)) step = 'overview';
	}

	$effect(stepBackIfClearedElsewhere);

	function writeWithoutToast(key: string, value: string): void {
		if (!chart.inStartSheet) chart.openStartSheet(chart.borrowedPreset);
		chart.setText(key, value, true);
	}

	function stopBorrowing(): void {
		chart.openStartSheet(null);
	}

	function writeGoal(value: string): void {
		writeWithoutToast('g', value);
		if (!value.trim() && chart.borrowedPreset) stopBorrowing();
	}

	async function borrowPreset(id: PresetId): Promise<void> {
		const preset = getPreset(id);
		if (!preset) return;
		chart.openStartSheet(id);
		chart.setText('g', preset.goal);
		await tick();
		const goalField = sheetElement?.querySelector<HTMLInputElement>('#start-goal');
		goalField?.focus();
		goalField?.setSelectionRange(goalField.value.length, goalField.value.length);
	}

	async function goTo(to: Step, direction: 1 | -1, options: { animateLines?: boolean; focusKey?: string } = {}): Promise<void> {
		const focusWasInSheet = sheetElement?.contains(document.activeElement) ?? false;
		animateArrivingLines = options.animateLines ?? false;
		turnDirection = direction;
		onFirstPage = false;
		step = to;
		if (!focusWasInSheet) return;
		await tick();
		const arrivingPage = sheetElement?.querySelector<HTMLElement>(`[data-view="${pageKey}"]`);
		const hasMouse = window.matchMedia('(pointer: fine)').matches;
		const focusTarget =
			(options.focusKey ? arrivingPage?.querySelector<HTMLElement>(`[data-key="${options.focusKey}"]`) : null) ??
			(hasMouse ? arrivingPage?.querySelector<HTMLElement>('[data-empty="true"], [data-next-pillar]') : null) ??
			sheetElement?.querySelector<HTMLElement>('[data-forward]');
		focusTarget?.focus({ preventScroll: true });
	}

	function openPillar(k: number): void {
		currentPillar = k;
		const lentActions = presetActionsToLend(chart.data, borrowedPreset, k);
		lentActions?.forEach((action, i) => writeWithoutToast(`a${k}_${i}`, action));
		pillarWithPresetActions = lentActions ? k : null;
		void goTo('actions', 1, { animateLines: Boolean(lentActions) });
	}

	function returnUntouchedPresetActions(k: number): void {
		if (pillarWithPresetActions !== k || !actionsMatchPreset(chart.data, borrowedPreset, k)) return;
		for (let i = 0; i < 8; i++) writeWithoutToast(`a${k}_${i}`, '');
	}

	function goBack(): void {
		if (step === 'pillars') void goTo('goal', -1);
		else if (step === 'overview') void goTo('pillars', -1);
		else if (step === 'actions') {
			returnUntouchedPresetActions(currentPillar);
			pillarWithPresetActions = null;
			void goTo('overview', -1);
		}
	}

	function goForward(): void {
		if (step === 'goal' && goalText) {
			const pillars = pillarsToWrite(chart.data, borrowedPreset);
			pillars?.forEach((name, k) => writeWithoutToast(`p${k}`, name));
			void goTo('pillars', 1, { animateLines: Boolean(pillars?.some((name) => name)) });
		} else if (step === 'pillars' && namedPillars.length > 0) void goTo('overview', 1);
		else if (step === 'overview' || step === 'actions') {
			if (nextPillar !== null) openPillar(nextPillar);
			else void goTo('done', 1);
		}
	}

	function closeSheet(): void {
		morph(() => chart.closeStartSheet());
	}

	function stopForNow(): void {
		if (chartComplete) void goTo('done', 1);
		else closeSheet();
	}

	function moveToNextFieldOnEnter(event: KeyboardEvent, keys: string[], key: string): void {
		if (event.key !== 'Enter' || event.shiftKey) return;
		event.preventDefault();
		const nextKey = keys[keys.indexOf(key) + 1];
		if (nextKey) sheetElement?.querySelector<HTMLElement>(`[data-key="${nextKey}"]`)?.focus();
		else goForward();
	}

	const pillarKeys = Array.from({ length: 8 }, (_, k) => `p${k}`);

	function actionKeys(k: number): string[] {
		return Array.from({ length: 8 }, (_, i) => `a${k}_${i}`);
	}

	const forwardLabel = $derived.by(() => {
		if (step === 'goal' || step === 'pillars') return 'Next';
		if (nextPillar === null) return 'Finish';
		return step === 'overview' && !anyActionsWritten ? 'Start writing' : 'Next pillar';
	});

	const endingTitle = $derived(chartComplete ? 'Chart complete' : 'Chart drawn');
	const endingMessage = $derived.by(() => {
		if (chartComplete) return 'One goal, 8 pillars, 64 actions. Don’t take them all on at once: Today asks for three a day, and the chart stays the map.';
		const emptyBlocks = 8 - completedBlocks;
		return `${completedBlocks} of 8 blocks written. ${emptyBlocks === 1 ? 'The empty one is a hole' : 'The empty ones are holes'} in the plan. Keep building, above the chart, fills them when you know what goes there.`;
	});
	const sealArcStagger = $derived(Math.min(0.16, 0.6 / Math.max(1, completedPillars.length)));
	const endingTextDelay = $derived(SEAL_DRAW_START_S + completedPillars.length * sealArcStagger + PAUSE_AFTER_SEAL_S);

	const cellFieldClass =
		'field h-full min-h-0 w-full min-w-0 resize-none rounded-[22px] border-0 px-3 pt-[28px] pb-2.5 text-[15px] leading-[1.3] motion-safe:transition-[box-shadow] motion-safe:duration-150 focus:z-[3] focus:shadow-[0_0_0_2px_var(--accent),0_10px_24px_-10px_oklch(0_0_0/0.3)] focus:outline-none max-[900px]:rounded-[16px] max-[900px]:px-2 max-[900px]:pt-[22px] max-[900px]:pb-1.5 max-[900px]:text-[13px] max-[900px]:leading-[1.25] max-[900px]:hyphens-auto coarse:focus:text-base';
	const cellNumberClass = 'pointer-events-none absolute top-2.5 start-3 z-[4] text-[0.72rem] font-[650] tabular-nums max-[900px]:top-[7px] max-[900px]:start-2 max-[900px]:text-[0.66rem]';
	const titleClass = 'm-0 font-serif text-[1.85rem] leading-[1.12] font-[480] tracking-[-0.02em] text-balance wrap-anywhere max-[900px]:text-[1.5rem]';
	const ledeClass = 'm-0 text-[0.98rem] leading-snug text-pretty text-muted';
	const roomForFocusRingsClass = '-mx-3 px-3 overflow-x-clip overflow-y-visible';
</script>

{#snippet centerCell(text: string, hue?: number)}
	<div
		class={cn(
			'@container flex aspect-square min-w-0 items-center justify-center overflow-hidden rounded-[22px] p-[9%] text-center max-[900px]:rounded-[16px]',
			hue === undefined ? 'bg-goal font-serif font-[560] text-goal-fg' : 'pillar-cell font-[650] text-on-p'
		)}
		style:--h={hue}
		title={text}
	>
		<span class="line-clamp-5 text-[clamp(11px,11cqi,16px)] leading-[1.2] text-balance wrap-anywhere">{text}</span>
	</div>
{/snippet}

{#snippet blockOfFields(keys: string[], centerText: string, hue: number | undefined, kind: 'pillar' | 'action')}
	<div class="mx-auto grid w-full max-w-[400px] grid-cols-3 gap-2 max-[900px]:gap-1.5">
		{#each [0, 1, 2, 3, 4, 5, 6, 7, 8] as slot (slot)}
			{#if slot === 4}
				{@render centerCell(centerText, hue)}
			{:else}
				{@const k = idx(slot)}
				{@const key = keys[k] ?? ''}
				{@const text = chart.textOf(key)}
				<div
					class={cn('relative aspect-square min-w-0', animateArrivingLines && text && 'motion-safe:animate-deal-in')}
					style:animation-delay={animateArrivingLines ? `${DEAL_DELAY_MS + k * DEAL_STAGGER_MS}ms` : undefined}
				>
					<span class={cn(cellNumberClass, kind === 'pillar' ? 'text-on-p opacity-70' : 'text-muted opacity-80')} aria-hidden="true">{k + 1}</span>
					<textarea
						class={cn(
							cellFieldClass,
							kind === 'pillar'
								? 'pillar-cell font-semibold text-on-p placeholder:text-on-p placeholder:opacity-60 can-hover:hover:pillar-hot'
								: 'pillar-action text-text placeholder:text-muted placeholder:opacity-75 can-hover:hover:action-hot'
						)}
						style:--h={kind === 'pillar' ? HUES[k] : hue}
						maxlength={TEXT_MAX}
						spellcheck="false"
						autocapitalize="sentences"
						aria-label={kind === 'pillar' ? `Pillar ${k + 1}` : `${centerText} action ${k + 1}`}
						placeholder={kind === 'pillar' ? `Pillar ${k + 1}` : `Action ${k + 1}`}
						value={text}
						data-fit={text}
						data-key={key}
						data-empty={text.trim() === ''}
						{@attach fitCellField}
						onkeydown={(event) => moveToNextFieldOnEnter(event, keys, key)}
						oninput={(event) => writeWithoutToast(key, event.currentTarget.value)}
					></textarea>
				</div>
			{/if}
		{/each}
	</div>
{/snippet}

{#snippet pillarOverview()}
	<div class="mx-auto grid w-full max-w-[400px] grid-cols-3 gap-2 max-[900px]:gap-1.5" role="group" aria-label="Pillars">
		{#each [0, 1, 2, 3, 4, 5, 6, 7, 8] as slot (slot)}
			{#if slot === 4}
				{@render centerCell(goalText)}
			{:else}
				{@const k = idx(slot)}
				{@const name = pillarName(k)}
				{@const actionCount = actionCounts[k] ?? 0}
				{#if name}
					<button
						type="button"
						class="@container relative flex aspect-square min-w-0 cursor-pointer appearance-none items-center justify-center overflow-hidden rounded-[22px] border-0 p-[9%] text-center font-sans font-[650] text-on-p pillar-cell shadow-card motion-safe:transition-[scale,translate,box-shadow] motion-safe:duration-150 motion-safe:ease-ui can-hover:hover:pillar-hot can-hover:hover:-translate-y-1 can-hover:hover:shadow-float active:scale-[0.97] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink max-[900px]:rounded-[16px]"
						style:--h={HUES[k]}
						data-next-pillar={k === nextPillar ? '' : undefined}
						aria-label="{name}, {actionCount} of 8 actions"
						onclick={() => openPillar(k)}
					>
						<span class="line-clamp-4 text-[clamp(11px,11cqi,15px)] leading-[1.2] text-balance wrap-anywhere">{name}</span>
						<span class="absolute top-2 end-2.5 inline-flex items-center gap-0.5 text-[0.7rem] font-[650] tabular-nums max-[900px]:top-1.5 max-[900px]:end-2" aria-hidden="true">
							{#if actionCount === 8}
								<span class="flex size-4 items-center justify-center rounded-full bg-ink text-on-ink"><Icon name="check" size={10} strokeWidth={2.6} /></span>
							{:else}
								<span class="opacity-70">{actionCount}/8</span>
							{/if}
						</span>
					</button>
				{:else}
					<button
						type="button"
						class="flex aspect-square min-w-0 cursor-pointer appearance-none items-center justify-center rounded-[22px] border-0 p-0 dot-fill motion-safe:transition-[scale,translate] motion-safe:duration-150 motion-safe:ease-ui can-hover:hover:-translate-y-1 active:scale-[0.97] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink max-[900px]:rounded-[16px]"
						style:--h={HUES[k]}
						aria-label="Name pillar {k + 1}"
						title="Name pillar {k + 1}"
						onclick={() => void goTo('pillars', -1, { focusKey: `p${k}` })}
					>
						<Icon name="plus" size={18} />
					</button>
				{/if}
			{/if}
		{/each}
	</div>
{/snippet}

<section
	bind:this={sheetElement}
	class={cn(
		'mx-auto flex w-full max-w-[600px] flex-col rounded-[30px] bg-surface p-6 shadow-card max-[900px]:rounded-[26px] max-[900px]:px-3.5 max-[900px]:py-[18px]',
		className
	)}
	aria-label="A new chart"
>
	{#if step !== 'done'}
		<div class={cn('mb-5 flex min-h-1.5 items-center justify-between gap-3 max-[900px]:mb-4', showGuideLink && '-mt-2.5 -me-2.5 mb-3 max-[900px]:mb-2.5')}>
			<ol class="m-0 flex list-none items-center gap-1.5 p-0" aria-label="Ring {ringIndex + 1} of 3">
				{#each [0, 1, 2] as position (position)}
					<li
						class={cn(
							'h-1.5 rounded-full motion-safe:transition-[width] motion-safe:duration-300 motion-safe:ease-[cubic-bezier(0.16,1,0.3,1)]',
							position === ringIndex ? 'w-6 bg-ink' : position < ringIndex ? 'w-1.5 bg-ink' : 'w-1.5 bg-sunken-hover'
						)}
					></li>
				{/each}
			</ol>
			{#if showGuideLink}
				<Button variant="ghost" icon="book" aria-haspopup="dialog" onclick={onopenguide}>How the method works</Button>
			{/if}
		</div>
	{/if}

	<Pages view={pageKey} direction={turnDirection} label={pageLabels[step]} class={roomForFocusRingsClass}>
		{#snippet page(current)}
			{@const pageStep = (current.startsWith('actions-') ? 'actions' : current) as Step}
			{#if pageStep === 'goal'}
				<div class="flex flex-col gap-5 max-[900px]:gap-4">
					<div class="flex items-center gap-4">
						<svg class="block size-[64px] shrink-0 overflow-visible max-[900px]:size-[52px]" viewBox="0 0 100 100" aria-hidden="true">
							{#each ringArcs as arc (arc.pillarIndex)}
								<path
									class={cn('ring-track fill-none stroke-[8] [stroke-dasharray:1] [stroke-linecap:round]', onFirstPage && 'motion-safe:animate-seal-draw')}
									d={arc.d}
									pathLength="1"
									style:--h={arc.hue}
									style:animation-delay={onFirstPage ? `${ARC_DRAW_DELAY_S + arc.pillarIndex * ARC_STAGGER_S}s` : undefined}
								/>
							{/each}
							<circle
								class={cn('fill-ink origin-center [transform-box:fill-box]', onFirstPage && 'motion-safe:animate-stamp')}
								cx="50"
								cy="50"
								r="10"
								style:animation-delay={onFirstPage ? `${DOT_LANDS_AT_S}s` : undefined}
							/>
						</svg>
						<div class="flex min-w-0 flex-col gap-1">
							<Eyebrow class="m-0">Start in the center</Eyebrow>
							<h2 class={titleClass}>What do you want to get done?</h2>
						</div>
					</div>
					<p class={ledeClass}>
						One clear aim for the center cell. Specific is easier to build around than broad.
						<br />
						<b>You can start more charts later.</b>
					</p>
					<input
						id="start-goal"
						class={cn(textField, 'h-[52px] text-[1.05rem]')}
						type="text"
						maxlength={TEXT_MAX}
						autocomplete="off"
						spellcheck="false"
						autocapitalize="sentences"
						aria-label="Your goal"
						placeholder="Run a half marathon by June"
						value={chart.data.goal}
						data-empty={!goalText}
						oninput={(event) => writeGoal(event.currentTarget.value)}
						onkeydown={(event) => {
							if (event.key === 'Enter') {
								event.preventDefault();
								goForward();
							}
						}}
					/>
					<div class="flex flex-col gap-2">
						<p class="m-0 text-[0.84rem] font-medium text-muted" id="start-borrow">Or borrow one and make it yours</p>
						<div class="flex flex-wrap gap-1.5" role="group" aria-labelledby="start-borrow">
							{#each presets as preset (preset.id)}
								{@const isBorrowed = chart.borrowedPreset === preset.id && Boolean(goalText)}
								<Button
									size="sm"
									variant="soft"
									icon={isBorrowed ? 'check' : undefined}
									aria-pressed={isBorrowed}
									title={preset.goal}
									onclick={() => borrowPreset(preset.id)}
								>
									{preset.title}
								</Button>
							{/each}
						</div>
					</div>
				</div>
			{:else if pageStep === 'pillars'}
				<div class="flex flex-col gap-5 max-[900px]:gap-4">
					<div class="flex flex-col gap-2">
						<Eyebrow class="m-0">The first ring</Eyebrow>
						<h2 class={titleClass}>What would make it happen?</h2>
						<p class={ledeClass}>
							{borrowedPreset
								? `The ${borrowedPreset.title} preset’s eight. Keep, rename, or swap any for your own.`
								: 'Eight things that have to be true for this goal: a skill, a habit, your health, the people around you. Leave one empty only if you don’t know it yet.'}
						</p>
					</div>
					{@render blockOfFields(pillarKeys, goalText, undefined, 'pillar')}
					<p class="m-0 text-center text-[0.84rem] text-muted tabular-nums" aria-live="polite">{namedPillars.length} of 8 named</p>
				</div>
			{:else if pageStep === 'overview'}
				<div class="flex flex-col gap-5 max-[900px]:gap-4">
					<div class="flex flex-col gap-2">
						<Eyebrow class="m-0">The outer ring</Eyebrow>
						<h2 class={titleClass}>Eight actions under each pillar</h2>
						<p class={ledeClass}>
							One block at a time, in any order. Each action is something you can mark done, and that is yours to do.
						</p>
					</div>
					{@render pillarOverview()}
					<p class="m-0 text-center text-[0.84rem] text-muted tabular-nums" aria-live="polite">{completedBlocks} of 8 blocks written</p>
				</div>
			{:else if pageStep === 'actions'}
				{@const k = Number(current.slice('actions-'.length))}
				{@const name = pillarName(k)}
				<div class="flex flex-col gap-5 max-[900px]:gap-4">
					<div class="flex flex-col gap-2">
						<Eyebrow class="m-0" pip={k}>Block {namedPillars.indexOf(k) + 1} of {namedPillars.length}</Eyebrow>
						<h2 class={titleClass}>Eight actions for {name}</h2>
						<p class={ledeClass}>
							{pillarWithPresetActions === k && borrowedPreset
								? `The ${borrowedPreset.title} preset’s, to start from. Keep, rewrite, or replace any.`
								: 'Things you can mark done, and that are yours to do. Start each with a verb. Leave a cell empty rather than write filler.'}
						</p>
					</div>
					{@render blockOfFields(actionKeys(k), name, HUES[k], 'action')}
					<p class="m-0 text-center text-[0.84rem] text-muted tabular-nums" aria-live="polite">{actionCounts[k] ?? 0} of 8 written</p>
				</div>
			{:else}
				<div class="flex flex-col items-center gap-4 pt-2 pb-1 text-center">
					<DaySeal moved={completedPillars} play step={sealArcStagger} label={endingTitle} class="size-[116px]" />
					<div class="flex flex-col gap-1.5">
						<h2 class="m-0 text-[1.3rem] leading-tight font-[620] text-balance motion-safe:animate-done-in" style:animation-delay="{endingTextDelay}s">
							{endingTitle}
						</h2>
						<p class="m-0 max-w-[40ch] text-[0.94rem] leading-snug text-pretty text-muted motion-safe:animate-done-in" style:animation-delay="{endingTextDelay + 0.08}s">
							{endingMessage}
						</p>
					</div>
				</div>
			{/if}
		{/snippet}
	</Pages>

	<div class="mt-6 flex items-center gap-1.5 max-[900px]:mt-5">
		{#if step === 'done'}
			<Button class="mx-auto min-w-[10rem] motion-safe:animate-done-in" style="animation-delay: {endingTextDelay + 0.16}s" data-forward onclick={closeSheet}>
				See the chart
			</Button>
		{:else}
			{#if step === 'goal'}
				{#if ondraftinchat}
					<Button variant="ghost" icon="sparkles" class="-ms-2" onclick={ondraftinchat}>Have a chat app draft it</Button>
				{/if}
			{:else}
				<Button variant="ghost" icon="arrow-left" class="-ms-2 max-[900px]:px-3" onclick={goBack}>
					<span class="max-[900px]:sr-only">{step === 'actions' ? 'All pillars' : 'Back'}</span>
				</Button>
			{/if}
			<div class="ms-auto flex items-center gap-1.5">
				{#if step !== 'goal'}
					<Button variant="ghost" onclick={stopForNow}>Done for now</Button>
				{/if}
				<Button
					data-forward
					disabled={(step === 'goal' && !goalText) || (step === 'pillars' && namedPillars.length === 0)}
					onclick={goForward}
				>
					{forwardLabel}
				</Button>
			</div>
		{/if}
	</div>
</section>
