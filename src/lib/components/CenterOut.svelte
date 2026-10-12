<script lang="ts">
	import { tick } from 'svelte';
	import { chart } from '$lib/chart/chart.svelte';
	import { HUES, idx, TEXT_MAX } from '$lib/chart/model';
	import { morph } from '$lib/chart/morph';
	import { getPreset, listPresets, type PresetId } from '$lib/chart/presets';
	import { arcPath, pillarArc } from '$lib/chart/ring';
	import {
		actionsFor,
		actionsUntouched,
		blocksWritten,
		nextPillar,
		ringFor,
		startPage,
		type StartPage
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
		ondraft: () => void;
		onguide: () => void;
		/** The method's door, for a page with no heading of its own above the sheet. */
		guide?: boolean;
		class?: string;
	};

	let { ondraft, onguide, guide = false, class: className }: Props = $props();

	type Step = StartPage | 'done';

	const resumed = startPage(chart.data);
	let step = $state<Step>(resumed.page);
	let pillar = $state(resumed.pillar ?? 0);
	let direction = $state(1);
	/** The pillar whose eight actions came from the preset on arrival, so Back can take them away again. */
	let lent = $state<number | null>(null);
	/** Lines that just arrived from the preset deal in; lines already there sit still. */
	let dealing = $state(false);
	/** The ring draws itself once, on the first page the sheet opens to, not again on the way back. */
	let firstPaint = $state(true);
	let sheet = $state<HTMLElement | null>(null);

	const presets = listPresets();
	const preset = $derived(chart.startPreset ? getPreset(chart.startPreset) : undefined);
	const goal = $derived(chart.data.goal.trim());
	const named = $derived(chart.data.pillars.flatMap((name, k) => (name.trim() ? [k] : [])));
	const counts = $derived(chart.milestones.pillarActionCounts);
	const blocks = $derived(blocksWritten(chart.data));
	const whole = $derived(Boolean(goal) && blocks === 8);
	const upNext = $derived(nextPillar(chart.data, step === 'actions' ? pillar : -1));
	const begun = $derived(named.some((k) => (counts[k] ?? 0) > 0));
	const sealed = $derived(named.filter((k) => counts[k] === 8));
	const ring = $derived(step === 'goal' ? 0 : step === 'pillars' ? 1 : 2);
	/** Each block is its own page, so moving to the next pillar turns one. */
	const view = $derived(step === 'actions' ? `actions-${pillar}` : step);

	const heading: Record<Step, string> = {
		goal: 'The goal',
		pillars: 'The pillars',
		pick: 'The outer ring',
		actions: 'A pillar’s actions',
		done: 'The chart'
	};

	const GEOMETRY = { radius: 40, stroke: 8, gap: 8 };
	const arcs = HUES.map((hue, pillarIndex) => {
		const { start, end } = pillarArc(pillarIndex, GEOMETRY);
		return { hue, pillarIndex, d: arcPath(50, 50, GEOMETRY.radius, start, end) };
	});
	const DOT = 0.25 + 8 * 0.06 + 0.1;

	function nameOf(k: number): string {
		return chart.data.pillars[k]?.trim() ?? '';
	}

	/** A ring cleared from elsewhere (Clear chart, another tab) sends the sheet back to the first empty one. */
	$effect(() => {
		if (step === 'goal' || step === 'done') return;
		if (!goal) step = 'goal';
		else if (step !== 'pillars' && named.length === 0) step = 'pillars';
		else if (step === 'actions' && !nameOf(pillar)) step = 'pick';
	});

	/** Quiet, so the last line of the chart does not toast: the sheet's own ending says it. */
	function write(key: string, value: string): void {
		if (!chart.starting) chart.beginStart(chart.startPreset);
		chart.setText(key, value, true);
	}

	function writeGoal(value: string): void {
		write('g', value);
		// An emptied goal stops borrowing, so the ring no longer follows that preset.
		if (!value.trim() && chart.startPreset) chart.beginStart(null);
	}

	async function borrow(id: PresetId): Promise<void> {
		const lender = getPreset(id);
		if (!lender) return;
		chart.beginStart(id);
		chart.setText('g', lender.goal);
		await tick();
		const field = sheet?.querySelector<HTMLInputElement>('#start-goal');
		field?.focus();
		field?.setSelectionRange(field.value.length, field.value.length);
	}

	async function turn(to: Step, way: 1 | -1, deal = false, focusKey?: string): Promise<void> {
		const inside = sheet?.contains(document.activeElement) ?? false;
		dealing = deal;
		direction = way;
		firstPaint = false;
		step = to;
		if (!inside) return;
		await tick();
		// The arriving page is the last one in its grid cell; the leaving one is still fading above it.
		const arriving = sheet?.querySelector<HTMLElement>(`[data-view="${view}"]`);
		const fine = window.matchMedia('(pointer: fine)').matches;
		const target =
			(focusKey ? arriving?.querySelector<HTMLElement>(`[data-key="${focusKey}"]`) : null) ??
			(fine ? arriving?.querySelector<HTMLElement>('[data-empty="true"], [data-first]') : null) ??
			sheet?.querySelector<HTMLElement>('[data-next]');
		target?.focus({ preventScroll: true });
	}

	function open(k: number): void {
		pillar = k;
		const lines = actionsFor(chart.data, preset, k);
		lines?.forEach((line, i) => write(`a${k}_${i}`, line));
		lent = lines ? k : null;
		void turn('actions', 1, Boolean(lines));
	}

	function back(): void {
		if (step === 'pillars') void turn('goal', -1);
		else if (step === 'pick') void turn('pillars', -1);
		else if (step === 'actions') {
			// Lines the preset lent and nobody touched go back with it, so the outer ring counts only what was kept.
			if (lent === pillar && actionsUntouched(chart.data, preset, pillar)) {
				for (let i = 0; i < 8; i++) write(`a${pillar}_${i}`, '');
			}
			lent = null;
			void turn('pick', -1);
		}
	}

	function next(): void {
		if (step === 'goal' && goal) {
			const lines = ringFor(chart.data, preset);
			lines?.forEach((name, k) => write(`p${k}`, name));
			void turn('pillars', 1, Boolean(lines?.some((name) => name)));
		} else if (step === 'pillars' && named.length > 0) void turn('pick', 1);
		else if (step === 'pick' || step === 'actions') {
			if (upNext !== null) open(upNext);
			else void turn('done', 1);
		}
	}

	/** Stopping keeps every line. A whole chart still gets its ending; anything else goes back to the grid. */
	function pause(): void {
		if (whole) void turn('done', 1);
		else morph(() => chart.endStart());
	}

	function finish(): void {
		morph(() => chart.endStart());
	}

	function onFieldKeydown(event: KeyboardEvent, keys: string[], key: string): void {
		if (event.key !== 'Enter' || event.shiftKey) return;
		event.preventDefault();
		const at = keys.indexOf(key);
		const following = keys[at + 1];
		if (following) sheet?.querySelector<HTMLElement>(`[data-key="${following}"]`)?.focus();
		else next();
	}

	const pillarKeys = Array.from({ length: 8 }, (_, k) => `p${k}`);

	function actionKeys(k: number): string[] {
		return Array.from({ length: 8 }, (_, i) => `a${k}_${i}`);
	}

	const primaryLabel = $derived.by(() => {
		if (step === 'goal' || step === 'pillars') return 'Next';
		if (upNext === null) return 'Finish';
		return step === 'pick' && !begun ? 'Start writing' : 'Next pillar';
	});

	const doneTitle = $derived(whole ? 'Chart complete' : 'Chart drawn');
	const doneLine = $derived.by(() => {
		if (whole) return 'One goal, 8 pillars, 64 actions. Don’t take them all on at once: Today asks for three a day, and the chart stays the map.';
		const holes = 8 - blocks;
		return `${blocks} of 8 blocks written. ${holes === 1 ? 'The empty one is a hole' : 'The empty ones are holes'} in the plan. Keep building, above the chart, fills them when you know what goes there.`;
	});
	const sealStep = $derived(Math.min(0.16, 0.6 / Math.max(1, sealed.length)));
	const sealAfter = $derived(0.35 + sealed.length * sealStep + 0.35);

	const cellField =
		'field h-full min-h-0 w-full min-w-0 resize-none rounded-[22px] border-0 px-3 pt-[28px] pb-2.5 text-[15px] leading-[1.3] motion-safe:transition-[box-shadow] motion-safe:duration-150 focus:z-[3] focus:shadow-[0_0_0_2px_var(--accent),0_10px_24px_-10px_oklch(0_0_0/0.3)] focus:outline-none max-[900px]:rounded-[16px] max-[900px]:px-2 max-[900px]:pt-[22px] max-[900px]:pb-1.5 max-[900px]:text-[13px] max-[900px]:leading-[1.25] max-[900px]:hyphens-auto';
	const cellNumber = 'pointer-events-none absolute top-2.5 left-3 z-[4] text-[0.72rem] font-[650] tabular-nums max-[900px]:top-[7px] max-[900px]:left-2 max-[900px]:text-[0.66rem]';
	const title = 'm-0 font-serif text-[1.85rem] leading-[1.12] font-[480] tracking-[-0.02em] text-balance wrap-anywhere max-[900px]:text-[1.5rem]';
	const lede = 'm-0 max-w-[50ch] text-[0.98rem] leading-snug text-pretty text-muted';
</script>

{#snippet center(text: string, hue?: number)}
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

{#snippet lines(keys: string[], centerText: string, hue: number | undefined, kind: 'pillar' | 'action')}
	<div class="mx-auto grid w-full max-w-[400px] grid-cols-3 gap-2 max-[900px]:gap-1.5">
		{#each [0, 1, 2, 3, 4, 5, 6, 7, 8] as slot (slot)}
			{#if slot === 4}
				{@render center(centerText, hue)}
			{:else}
				{@const at = idx(slot)}
				{@const key = keys[at] ?? ''}
				{@const text = chart.textOf(key)}
				<div
					class={cn('relative aspect-square min-w-0', dealing && text && 'motion-safe:animate-deal-in')}
					style:animation-delay={dealing ? `${80 + at * 70}ms` : undefined}
				>
					<span class={cn(cellNumber, kind === 'pillar' ? 'text-on-p opacity-70' : 'text-muted opacity-80')} aria-hidden="true">{at + 1}</span>
					<textarea
						class={cn(
							cellField,
							kind === 'pillar'
								? 'pillar-cell font-semibold text-on-p placeholder:text-on-p placeholder:opacity-60 can-hover:hover:pillar-hot'
								: 'pillar-action text-text placeholder:text-muted placeholder:opacity-75 can-hover:hover:action-hot'
						)}
						style:--h={kind === 'pillar' ? HUES[at] : hue}
						maxlength={TEXT_MAX}
						spellcheck="false"
						autocapitalize="sentences"
						aria-label={kind === 'pillar' ? `Pillar ${at + 1}` : `${centerText} action ${at + 1}`}
						placeholder={kind === 'pillar' ? `Pillar ${at + 1}` : `Action ${at + 1}`}
						value={text}
						data-fit={text}
						data-key={key}
						data-empty={text.trim() === ''}
						{@attach fitCellField}
						onkeydown={(event) => onFieldKeydown(event, keys, key)}
						oninput={(event) => write(key, event.currentTarget.value)}
					></textarea>
				</div>
			{/if}
		{/each}
	</div>
{/snippet}

{#snippet outerRing()}
	<div class="mx-auto grid w-full max-w-[400px] grid-cols-3 gap-2 max-[900px]:gap-1.5" role="group" aria-label="Pillars">
		{#each [0, 1, 2, 3, 4, 5, 6, 7, 8] as slot (slot)}
			{#if slot === 4}
				{@render center(goal)}
			{:else}
				{@const at = idx(slot)}
				{@const name = nameOf(at)}
				{@const count = counts[at] ?? 0}
				{#if name}
					<button
						type="button"
						class="@container relative flex aspect-square min-w-0 cursor-pointer appearance-none items-center justify-center overflow-hidden rounded-[22px] border-0 p-[9%] text-center font-sans font-[650] text-on-p pillar-cell shadow-card motion-safe:transition-[scale,translate,box-shadow] motion-safe:duration-150 motion-safe:ease-ui can-hover:hover:pillar-hot can-hover:hover:-translate-y-1 can-hover:hover:shadow-float active:scale-[0.97] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink max-[900px]:rounded-[16px]"
						style:--h={HUES[at]}
						data-first={at === upNext ? '' : undefined}
						aria-label="{name}, {count} of 8 actions"
						onclick={() => open(at)}
					>
						<span class="line-clamp-4 text-[clamp(11px,11cqi,15px)] leading-[1.2] text-balance wrap-anywhere">{name}</span>
						<span class="absolute top-2 right-2.5 inline-flex items-center gap-0.5 text-[0.7rem] font-[650] tabular-nums max-[900px]:top-1.5 max-[900px]:right-2" aria-hidden="true">
							{#if count === 8}
								<span class="flex size-4 items-center justify-center rounded-full bg-ink text-on-ink"><Icon name="check" size={10} strokeWidth={2.6} /></span>
							{:else}
								<span class="opacity-70">{count}/8</span>
							{/if}
						</span>
					</button>
				{:else}
					<button
						type="button"
						class="flex aspect-square min-w-0 cursor-pointer appearance-none items-center justify-center rounded-[22px] border-0 p-0 dot-fill motion-safe:transition-[scale,translate] motion-safe:duration-150 motion-safe:ease-ui can-hover:hover:-translate-y-1 active:scale-[0.97] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink max-[900px]:rounded-[16px]"
						style:--h={HUES[at]}
						aria-label="Name pillar {at + 1}"
						title="Name pillar {at + 1}"
						onclick={() => void turn('pillars', -1, false, `p${at}`)}
					>
						<Icon name="plus" size={18} />
					</button>
				{/if}
			{/if}
		{/each}
	</div>
{/snippet}

<section
	bind:this={sheet}
	class={cn(
		'mx-auto flex w-full max-w-[600px] flex-col rounded-[30px] bg-surface p-6 shadow-card max-[900px]:rounded-[26px] max-[900px]:px-3.5 max-[900px]:py-[18px]',
		className
	)}
	aria-label="A new chart"
>
	{#if step !== 'done'}
		<div class={cn('mb-5 flex min-h-1.5 items-center justify-between gap-3 max-[900px]:mb-4', guide && '-mt-2.5 -me-2.5 mb-3 max-[900px]:mb-2.5')}>
			<ol class="m-0 flex list-none items-center gap-1.5 p-0" aria-label="Ring {ring + 1} of 3">
				{#each [0, 1, 2] as position (position)}
					<li
						class={cn(
							'h-1.5 rounded-full motion-safe:transition-[width] motion-safe:duration-300 motion-safe:ease-[cubic-bezier(0.16,1,0.3,1)]',
							position === ring ? 'w-6 bg-ink' : position < ring ? 'w-1.5 bg-ink' : 'w-1.5 bg-sunken-hover'
						)}
					></li>
				{/each}
			</ol>
			{#if guide}
				<Button variant="ghost" icon="info" aria-haspopup="dialog" onclick={onguide}>How the method works</Button>
			{/if}
		</div>
	{/if}

	<!-- Room on both sides, so a cell's focus ring and a lifted pillar are not cut at the page's edge. -->
	<Pages {view} {direction} label={heading[step]} class="-mx-3 px-3 overflow-x-clip overflow-y-visible">
		{#snippet page(current)}
			{@const at = (current.startsWith('actions-') ? 'actions' : current) as Step}
			{#if at === 'goal'}
				<div class="flex flex-col gap-5 max-[900px]:gap-4">
					<div class="flex items-center gap-4">
						<svg class="block size-[64px] shrink-0 overflow-visible max-[900px]:size-[52px]" viewBox="0 0 100 100" aria-hidden="true">
							{#each arcs as arc (arc.pillarIndex)}
								<path
									class={cn('ring-track fill-none stroke-[8] [stroke-dasharray:1] [stroke-linecap:round]', firstPaint && 'motion-safe:animate-seal-draw')}
									d={arc.d}
									pathLength="1"
									style:--h={arc.hue}
									style:animation-delay={firstPaint ? `${0.25 + arc.pillarIndex * 0.06}s` : undefined}
								/>
							{/each}
							<circle
								class={cn('fill-ink origin-center [transform-box:fill-box]', firstPaint && 'motion-safe:animate-stamp')}
								cx="50"
								cy="50"
								r="10"
								style:animation-delay={firstPaint ? `${DOT}s` : undefined}
							/>
						</svg>
						<div class="flex min-w-0 flex-col gap-1">
							<Eyebrow class="m-0">Start in the center</Eyebrow>
							<h2 class={title}>What do you want to get done?</h2>
						</div>
					</div>
					<p class={lede}>
						One goal, something you could finish. A date helps. Then you build out from it: eight pillars, then eight actions under each. It usually takes one sitting, and you can stop anywhere.
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
						data-empty={!goal}
						oninput={(event) => writeGoal(event.currentTarget.value)}
						onkeydown={(event) => {
							if (event.key === 'Enter') {
								event.preventDefault();
								next();
							}
						}}
					/>
					<div class="flex flex-col gap-2">
						<p class="m-0 text-[0.84rem] font-medium text-muted" id="start-borrow">Or borrow one and make it yours</p>
						<div class="flex flex-wrap gap-1.5" role="group" aria-labelledby="start-borrow">
							{#each presets as lender (lender.id)}
								{@const borrowed = chart.startPreset === lender.id && Boolean(goal)}
								<Button
									size="sm"
									variant="soft"
									icon={borrowed ? 'check' : undefined}
									aria-pressed={borrowed}
									title={lender.goal}
									onclick={() => borrow(lender.id)}
								>
									{lender.title}
								</Button>
							{/each}
						</div>
					</div>
				</div>
			{:else if at === 'pillars'}
				<div class="flex flex-col gap-5 max-[900px]:gap-4">
					<div class="flex flex-col gap-2">
						<Eyebrow class="m-0">The first ring</Eyebrow>
						<h2 class={title}>What would make it happen?</h2>
						<p class={lede}>
							{preset
								? `The ${preset.title} preset’s eight. Keep, rename, or swap any for your own.`
								: 'Eight things that have to be true for this goal: a skill, a habit, your health, the people around you. Leave one empty only if you don’t know it yet.'}
						</p>
					</div>
					{@render lines(pillarKeys, goal, undefined, 'pillar')}
					<p class="m-0 text-center text-[0.84rem] text-muted tabular-nums" aria-live="polite">{named.length} of 8 named</p>
				</div>
			{:else if at === 'pick'}
				<div class="flex flex-col gap-5 max-[900px]:gap-4">
					<div class="flex flex-col gap-2">
						<Eyebrow class="m-0">The outer ring</Eyebrow>
						<h2 class={title}>Eight actions under each pillar</h2>
						<p class={lede}>
							One block at a time, in any order. Each action is something you can mark done, and that is yours to do.
						</p>
					</div>
					{@render outerRing()}
					<p class="m-0 text-center text-[0.84rem] text-muted tabular-nums" aria-live="polite">{blocks} of 8 blocks written</p>
				</div>
			{:else if at === 'actions'}
				{@const k = Number(current.slice('actions-'.length))}
				{@const name = nameOf(k)}
				<div class="flex flex-col gap-5 max-[900px]:gap-4">
					<div class="flex flex-col gap-2">
						<Eyebrow class="m-0" pip={k}>Block {named.indexOf(k) + 1} of {named.length}</Eyebrow>
						<h2 class={title}>Eight actions for {name}</h2>
						<p class={lede}>
							{lent === k && preset
								? `The ${preset.title} preset’s, to start from. Keep, rewrite, or replace any.`
								: 'Things you can mark done, and that are yours to do. Start each with a verb. Leave a cell empty rather than write filler.'}
						</p>
					</div>
					{@render lines(actionKeys(k), name, HUES[k], 'action')}
					<p class="m-0 text-center text-[0.84rem] text-muted tabular-nums" aria-live="polite">{counts[k] ?? 0} of 8 written</p>
				</div>
			{:else}
				<div class="flex flex-col items-center gap-4 pt-2 pb-1 text-center">
					<DaySeal moved={sealed} play step={sealStep} label={doneTitle} class="size-[116px]" />
					<div class="flex flex-col gap-1.5">
						<h2 class="m-0 text-[1.3rem] leading-tight font-[620] text-balance motion-safe:animate-done-in" style:animation-delay="{sealAfter}s">
							{doneTitle}
						</h2>
						<p class="m-0 max-w-[40ch] text-[0.94rem] leading-snug text-pretty text-muted motion-safe:animate-done-in" style:animation-delay="{sealAfter + 0.08}s">
							{doneLine}
						</p>
					</div>
				</div>
			{/if}
		{/snippet}
	</Pages>

	<!-- The buttons are relabelled rather than replaced, so keyboard focus stays put as pages turn. -->
	<div class="mt-6 flex items-center gap-1.5 max-[900px]:mt-5">
		{#if step === 'done'}
			<Button class="mx-auto min-w-[10rem] motion-safe:animate-done-in" style="animation-delay: {sealAfter + 0.16}s" data-next onclick={finish}>
				See the chart
			</Button>
		{:else}
			{#if step === 'goal'}
				<Button variant="ghost" icon="sparkles" class="-ms-2" onclick={ondraft}>Have a chat app draft it</Button>
			{:else}
				<Button variant="ghost" icon="arrow-left" class="-ms-2 max-[900px]:px-3" onclick={back}>
					<span class="max-[900px]:sr-only">{step === 'actions' ? 'All pillars' : 'Back'}</span>
				</Button>
			{/if}
			<div class="ms-auto flex items-center gap-1.5">
				{#if step !== 'goal'}
					<Button variant="ghost" onclick={pause}>Done for now</Button>
				{/if}
				<Button
					data-next
					disabled={(step === 'goal' && !goal) || (step === 'pillars' && named.length === 0)}
					onclick={next}
				>
					{primaryLabel}
				</Button>
			</div>
		{/if}
	</div>
</section>
