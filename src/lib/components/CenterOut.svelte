<script lang="ts">
	import { tick } from 'svelte';
	import { chart } from '$lib/chart/chart.svelte';
	import { HUES, idx, TEXT_MAX } from '$lib/chart/model';
	import { morph } from '$lib/chart/morph';
	import { getPreset, listPresets, type PresetId } from '$lib/chart/presets';
	import { arcPath, pillarArc } from '$lib/chart/ring';
	import { actionsFor, actionsUntouched, ringFor, startPage, type StartPage } from '$lib/chart/start';
	import DaySeal from './DaySeal.svelte';
	import { fitCellField } from './goal-fit';
	import Button from './ui/Button.svelte';
	import Eyebrow from './ui/Eyebrow.svelte';
	import MethodGuide from './MethodGuide.svelte';
	import Pages from './ui/Pages.svelte';
	import { cn } from './ui/cn';
	import { textField } from './ui/styles';

	type Props = {
		ondraft: () => void;
		/** How it works, for a page with no heading of its own above the sheet. */
		guide?: boolean;
		class?: string;
	};

	let { ondraft, guide = false, class: className }: Props = $props();

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
	const pillarName = $derived(chart.data.pillars[pillar]?.trim() ?? '');
	const written = $derived(chart.milestones.pillarActionCounts[pillar] ?? 0);
	const ring = $derived(step === 'goal' ? 0 : step === 'pillars' ? 1 : 2);

	const heading: Record<Step, string> = {
		goal: 'The goal',
		pillars: 'The pillars',
		pick: 'The first pillar',
		actions: 'Its actions',
		done: 'Chart started'
	};

	const GEOMETRY = { radius: 40, stroke: 8, gap: 8 };
	const arcs = HUES.map((hue, pillarIndex) => {
		const { start, end } = pillarArc(pillarIndex, GEOMETRY);
		return { hue, pillarIndex, d: arcPath(50, 50, GEOMETRY.radius, start, end) };
	});
	const DOT = 0.25 + 8 * 0.06 + 0.1;

	/** A ring cleared from elsewhere (Clear chart, another tab) sends the sheet back to the first empty one. */
	$effect(() => {
		if (step === 'goal' || step === 'done') return;
		if (!goal) step = 'goal';
		else if (step !== 'pillars' && named.length === 0) step = 'pillars';
		else if (step === 'actions' && !pillarName) step = 'pick';
	});

	function write(key: string, value: string, quiet = false): void {
		if (!chart.starting) chart.beginStart(chart.startPreset);
		chart.setText(key, value, quiet);
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

	async function turn(to: Step, way: 1 | -1, deal = false): Promise<void> {
		const inside = sheet?.contains(document.activeElement) ?? false;
		dealing = deal;
		direction = way;
		firstPaint = false;
		step = to;
		if (!inside) return;
		await tick();
		// The arriving page is the last one in its grid cell; the leaving one is still fading above it.
		const arriving = sheet?.querySelector<HTMLElement>(`[data-view="${to}"]`);
		const fine = window.matchMedia('(pointer: fine)').matches;
		const target =
			(fine ? arriving?.querySelector<HTMLElement>('[data-empty="true"], [data-first]') : null) ??
			sheet?.querySelector<HTMLElement>('[data-next]');
		target?.focus({ preventScroll: true });
	}

	function open(k: number): void {
		pillar = k;
		const lines = actionsFor(chart.data, preset, k);
		lines?.forEach((line, i) => write(`a${k}_${i}`, line, true));
		lent = lines ? k : null;
		void turn('actions', 1, Boolean(lines));
	}

	function back(): void {
		if (step === 'pillars') void turn('goal', -1);
		else if (step === 'pick') void turn('pillars', -1);
		else if (step === 'actions') {
			// Lines the preset lent and nobody touched go back with it, so another pillar can be tried.
			if (lent === pillar && actionsUntouched(chart.data, preset, pillar)) {
				for (let i = 0; i < 8; i++) write(`a${pillar}_${i}`, '', true);
			}
			lent = null;
			void turn('pick', -1);
		}
	}

	function next(): void {
		if (step === 'goal' && goal) {
			const lines = ringFor(chart.data, preset);
			lines?.forEach((name, k) => write(`p${k}`, name, true));
			void turn('pillars', 1, Boolean(lines?.some((name) => name)));
		} else if (step === 'pillars' && named.length > 0) void turn('pick', 1);
		else if (step === 'pick' || step === 'actions') void turn('done', 1);
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
	const actionKeys = $derived(Array.from({ length: 8 }, (_, i) => `a${pillar}_${i}`));

	const doneLine = $derived.by(() => {
		const pillars = named.length === 1 ? '1 pillar' : `${named.length} pillars`;
		if (written === 0) return `${pillars} around your goal. Their actions can wait in the chart until you know them.`;
		const actions = written === 1 ? '1 action' : `${written} actions`;
		return `${pillars} around your goal, and ${actions} for ${pillarName}. The empty cells are the rest of the plan.`;
	});
	const sealStep = $derived(Math.min(0.16, 0.6 / Math.max(1, named.length)));
	const sealAfter = $derived(0.35 + named.length * sealStep + 0.35);

	const cellField =
		'field h-full min-h-0 w-full min-w-0 resize-none rounded-[22px] border-0 px-3 pt-[28px] pb-2.5 text-[15px] leading-[1.3] motion-safe:transition-[box-shadow] motion-safe:duration-150 focus:z-[3] focus:shadow-[0_0_0_2px_var(--accent),0_10px_24px_-10px_oklch(0_0_0/0.3)] focus:outline-none max-[900px]:rounded-[16px] max-[900px]:px-2 max-[900px]:pt-[22px] max-[900px]:pb-1.5 max-[900px]:text-[13px] max-[900px]:leading-[1.25] max-[900px]:hyphens-auto';
	const cellNumber = 'pointer-events-none absolute top-2.5 left-3 z-[4] text-[0.72rem] font-[650] tabular-nums max-[900px]:top-[7px] max-[900px]:left-2 max-[900px]:text-[0.66rem]';
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

{#snippet lines(keys: string[], hue: number, kind: 'pillar' | 'action')}
	<div class="mx-auto grid w-full max-w-[400px] grid-cols-3 gap-2 max-[900px]:gap-1.5">
		{#each [0, 1, 2, 3, 4, 5, 6, 7, 8] as slot (slot)}
			{#if slot === 4}
				{#if kind === 'pillar'}
					{@render center(goal)}
				{:else}
					{@render center(pillarName, hue)}
				{/if}
			{:else}
				{@const at = idx(slot)}
				{@const key = keys[at] ?? ''}
				{@const cellHue = kind === 'pillar' ? HUES[at] : hue}
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
						style:--h={cellHue}
						maxlength={TEXT_MAX}
						spellcheck="false"
						autocapitalize="sentences"
						aria-label={kind === 'pillar' ? `Pillar ${at + 1}` : `${pillarName} action ${at + 1}`}
						placeholder={kind === 'pillar' ? `Pillar ${at + 1}` : `Action ${at + 1}`}
						value={text}
						data-fit={text}
						data-key={key}
						data-empty={text.trim() === ''}
						{@attach fitCellField}
						onkeydown={(event) => onFieldKeydown(event, keys, key)}
						oninput={(event) => write(key, event.currentTarget.value)}
						onblur={() => chart.settle()}
					></textarea>
				</div>
			{/if}
		{/each}
	</div>
{/snippet}

{#snippet pick()}
	<div class="mx-auto grid w-full max-w-[400px] grid-cols-3 gap-2 max-[900px]:gap-1.5" role="group" aria-label="Pillars">
		{#each [0, 1, 2, 3, 4, 5, 6, 7, 8] as slot (slot)}
			{#if slot === 4}
				{@render center(goal)}
			{:else}
				{@const at = idx(slot)}
				{@const name = chart.data.pillars[at]?.trim() ?? ''}
				{#if name}
					<button
						type="button"
						class="@container relative flex aspect-square min-w-0 cursor-pointer appearance-none items-center justify-center overflow-hidden rounded-[22px] border-0 p-[9%] text-center font-sans font-[650] text-on-p pillar-cell shadow-card motion-safe:transition-[scale,translate,box-shadow] motion-safe:duration-150 motion-safe:ease-ui can-hover:hover:pillar-hot can-hover:hover:-translate-y-1 can-hover:hover:shadow-float active:scale-[0.97] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink max-[900px]:rounded-[16px]"
						style:--h={HUES[at]}
						data-first={at === named[0] ? '' : undefined}
						aria-label="Start with {name}"
						onclick={() => open(at)}
					>
						<span class="line-clamp-4 text-[clamp(11px,11cqi,15px)] leading-[1.2] text-balance wrap-anywhere">{name}</span>
						{#if chart.milestones.pillarActionCounts[at]}
							<span class="absolute top-2 right-2.5 text-[0.7rem] font-[650] tabular-nums opacity-70">{chart.milestones.pillarActionCounts[at]}</span>
						{/if}
					</button>
				{:else}
					<div class="aspect-square min-w-0 rounded-[22px] pillar-dot max-[900px]:rounded-[16px]" style:--h={HUES[at]} aria-hidden="true"></div>
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
				<MethodGuide />
			{/if}
		</div>
	{/if}

	<!-- Room on both sides, so a cell's focus ring and a lifted pillar are not cut at the page's edge. -->
	<Pages view={step} {direction} label={heading[step]} class="-mx-3 px-3 overflow-x-clip overflow-y-visible">
		{#snippet page(current)}
			{@const at = current as Step}
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
							<h2 class="m-0 font-serif text-[1.85rem] leading-[1.12] font-[480] tracking-[-0.02em] text-balance max-[900px]:text-[1.5rem]">
								What do you want to get done?
							</h2>
						</div>
					</div>
					<p class="m-0 max-w-[48ch] text-[0.98rem] leading-snug text-pretty text-muted">
						One goal for this chart, something you could finish. A date helps. Pillars and actions come next, one ring at a time.
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
						<h2 class="m-0 font-serif text-[1.85rem] leading-[1.12] font-[480] tracking-[-0.02em] text-balance max-[900px]:text-[1.5rem]">
							What would make it happen?
						</h2>
						<p class="m-0 max-w-[50ch] text-[0.98rem] leading-snug text-pretty text-muted">
							{preset
								? `These are the ${preset.title} preset’s. Keep, rename, or clear any of them.`
								: 'Name the areas that would get you there: a skill, a habit, people, your health.'}
							Eight fill the ring. A few is a fine start.
						</p>
					</div>
					{@render lines(pillarKeys, 0, 'pillar')}
					<p class="m-0 text-center text-[0.84rem] text-muted tabular-nums" aria-live="polite">{named.length} of 8 named</p>
				</div>
			{:else if at === 'pick'}
				<div class="flex flex-col gap-5 max-[900px]:gap-4">
					<div class="flex flex-col gap-2">
						<Eyebrow class="m-0">The outer ring</Eyebrow>
						<h2 class="m-0 font-serif text-[1.85rem] leading-[1.12] font-[480] tracking-[-0.02em] text-balance max-[900px]:text-[1.5rem]">
							Which pillar comes first?
						</h2>
						<p class="m-0 max-w-[50ch] text-[0.98rem] leading-snug text-pretty text-muted">
							Each pillar gets eight actions you can tick off. Write one pillar’s now. The others wait in the chart.
						</p>
					</div>
					{@render pick()}
				</div>
			{:else if at === 'actions'}
				<div class="flex flex-col gap-5 max-[900px]:gap-4">
					<div class="flex flex-col gap-2">
						<Eyebrow class="m-0" pip={pillar}>Pillar {pillar + 1}</Eyebrow>
						<h2 class="m-0 font-serif text-[1.85rem] leading-[1.12] font-[480] tracking-[-0.02em] text-balance wrap-anywhere max-[900px]:text-[1.5rem]">
							Eight actions for {pillarName}
						</h2>
						<p class="m-0 max-w-[50ch] text-[0.98rem] leading-snug text-pretty text-muted">
							{lent === pillar
								? 'The preset’s, to start from. Each one passes two tests: you can mark it done, and it is yours to do.'
								: 'Things you can mark done, and that are yours to do. Start each with a verb.'}
						</p>
					</div>
					{@render lines(actionKeys, HUES[pillar] ?? 0, 'action')}
					<p class="m-0 text-center text-[0.84rem] text-muted tabular-nums" aria-live="polite">{written} of 8 written</p>
				</div>
			{:else}
				<div class="flex flex-col items-center gap-4 pt-2 pb-1 text-center">
					<DaySeal moved={named} play step={sealStep} label="Chart started" class="size-[116px]" />
					<div class="flex flex-col gap-1.5">
						<h2 class="m-0 text-[1.3rem] leading-tight font-[620] text-balance motion-safe:animate-done-in" style:animation-delay="{sealAfter}s">
							Chart started
						</h2>
						<p class="m-0 max-w-[38ch] text-[0.94rem] leading-snug text-pretty text-muted motion-safe:animate-done-in" style:animation-delay="{sealAfter + 0.08}s">
							{doneLine}
						</p>
					</div>
				</div>
			{/if}
		{/snippet}
	</Pages>

	<!-- One button each side, relabelled rather than replaced, so keyboard focus stays put as pages turn. -->
	<div class="mt-6 flex items-center justify-between gap-2 max-[900px]:mt-5">
		{#if step === 'done'}
			<Button class="mx-auto min-w-[10rem] motion-safe:animate-done-in" style="animation-delay: {sealAfter + 0.16}s" data-next onclick={finish}>
				See the chart
			</Button>
		{:else}
			{#if step === 'goal'}
				<Button variant="ghost" icon="sparkles" class="-ms-2" onclick={ondraft}>Have a chat app draft it</Button>
			{:else}
				<Button variant="ghost" icon="arrow-left" class="-ms-2" onclick={back}>Back</Button>
			{/if}
			<Button
				variant={step === 'pick' ? 'soft' : 'primary'}
				data-next
				disabled={(step === 'goal' && !goal) || (step === 'pillars' && named.length === 0)}
				onclick={next}
			>
				{step === 'pick' ? 'Skip for now' : step === 'actions' ? 'Done for now' : 'Next'}
			</Button>
		{/if}
	</div>
</section>
