<script lang="ts">
	import { onMount } from 'svelte';
	import { chart } from '$lib/chart/chart.svelte';
	import { coachFixtures } from '$lib/chart/coach-fixtures';
	import { holdoutDataset } from '$lib/chart/coach-holdout';
	import { CoachStopped } from '$lib/chart/coach-protocol';
	import { holdoutChartMetrics, scoreChart, scoreReply, summarizeScores } from '$lib/chart/coach-score';
	import { chartAnswersMessage } from '$lib/chart/draft';
	import { exampleChart } from '$lib/chart/example';
	import {
		chartAnswersFromText,
		describeCoachProgress,
		describeKey,
		fillPlan,
		reviewChart,
		routeOf,
		suggestToday,
		suggestWeek
	} from '$lib/chart/helper';
	import { HelperStore, type HelperMood } from '$lib/chart/helper.svelte';
	import { dateKeyOffset, emptyChart, HUES, setByKey, setMeta, todayKey, type ChartData } from '$lib/chart/model';
	import Wordmark from '$lib/components/Wordmark.svelte';
	import HelperFace from '$lib/components/HelperFace.svelte';
	import HelperPanel from '$lib/components/HelperPanel.svelte';
	import Button from '$lib/components/ui/Button.svelte';
	import Card from '$lib/components/ui/Card.svelte';
	import Eyebrow from '$lib/components/ui/Eyebrow.svelte';
	import SegmentedControl from '$lib/components/ui/SegmentedControl.svelte';
	import { textArea, textField } from '$lib/components/ui/styles';

	type Coach = typeof import('$lib/chart/coach.browser');
	type Scenario = 'example' | 'half' | 'flawed' | 'empty';

	const themes = [
		{ value: 'system', label: 'Auto', icon: 'monitor' as const },
		{ value: 'light', label: 'Light', icon: 'sun' as const },
		{ value: 'dark', label: 'Dark', icon: 'moon' as const }
	];
	const scenarios = [
		{ value: 'example', label: 'Full, with a week' },
		{ value: 'half', label: 'Half done' },
		{ value: 'flawed', label: 'Weak cells' },
		{ value: 'empty', label: 'Empty' }
	];
	const faceScenarios: { mood: HelperMood; moment: string }[] = [
		{ mood: 'waiting', moment: 'Waking up or downloading' },
		{ mood: 'thinking', moment: 'Writing a reply' },
		{ mood: 'happy', moment: 'Kept a card, clean review' },
		{ mood: 'sorry', moment: 'Stopped or failed' },
		{ mood: 'puzzled', moment: 'Open findings card' },
		{ mood: 'offering', moment: 'Proposed a card' },
		{ mood: 'curious', moment: 'Asked and waiting' },
		{ mood: 'listening', moment: 'Message box focused' },
		{ mood: 'idle', moment: 'Resting, greeting' }
	];
	const field = textField;
	const area = textArea;
	const pre =
		'm-0 max-h-64 overflow-auto rounded-2xl bg-sunken px-3.5 py-3 font-mono text-[0.76rem] leading-[1.5] whitespace-pre-wrap text-text';

	function build(kind: Scenario): ChartData {
		if (kind === 'empty') return emptyChart();
		const data = exampleChart();
		if (kind === 'example') {
			data.days = {
				[dateKeyOffset(-1)]: { focus: ['a0_0', 'a1_0', 'a2_0'], checked: ['a0_0', 'a1_0'], started: true },
				[dateKeyOffset(-2)]: { focus: ['a0_1', 'a3_0', 'a1_2'], checked: ['a3_0'], started: true }
			};
			data.meta = { a4_1: { kind: 'milestone', pinned: true } };
		}
		if (kind === 'half') {
			data.pillars[6] = '';
			data.actions[6] = data.actions[6]!.map(() => '');
			data.actions[2] = data.actions[2]!.map((action, index) => (index < 3 ? action : ''));
		}
		if (kind === 'flawed') {
			data.actions[0]![0] = 'Work hard every day';
			data.actions[0]![1] = 'Get 10 million views';
			data.actions[1]![2] = data.actions[1]![3]!;
			data.actions[3]![0] = 'Discipline';
			data.pillars[5] = 'Be more confident';
		}
		return data;
	}

	let scenario = $state<Scenario>('example');
	let sample = $state<ChartData>(build('example'));
	let preferred = $state<number | null>(null);
	let events = $state<string[]>([]);

	function note(text: string): void {
		events = [`${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}  ${text}`, ...events].slice(0, 12);
	}

	const lab = new HelperStore({
		data: () => sample,
		selectedPillar: () => preferred,
		applyDraft: (next) => {
			sample = next;
			note(`Chart replaced: ${next.goal}`);
			return true;
		},
		setCells: (edits) => {
			for (const edit of edits) setByKey(sample, edit.key, edit.after);
			note(`Changed ${edits.length} cells: ${edits.map((edit) => edit.key).join(', ')}`);
		},
		setToday: (keys) => {
			sample.days = { ...sample.days, [todayKey()]: { focus: keys, checked: [], started: true } };
			note(`Today set: ${keys.join(', ')}`);
		},
		pinWeek: (keys) => {
			for (const key of keys) setMeta(sample, key, { pinned: true });
			note(`Pinned: ${keys.join(', ')}`);
		},
		showCell: (key) => note(`Show ${describeKey(sample, key)} (${key})`)
	});

	function pickScenario(value: string): void {
		if (value !== 'example' && value !== 'half' && value !== 'flawed' && value !== 'empty') return;
		scenario = value;
		sample = build(value);
		lab.reset();
		note(`Scenario: ${value}`);
	}

	const findings = $derived(reviewChart(sample));
	const week = $derived(suggestWeek(sample));
	const today = $derived(suggestToday(sample));
	const plan = $derived(fillPlan(sample, preferred));

	let coach: Coach | null = $state(null);
	let webgpu = $state<boolean | null>(null);
	const canRun = $derived(webgpu === true);

	let loaded = $state(false);
	let modelName = $state('…');

	function refresh(): void {
		loaded = coach?.coachLoaded() ?? false;
		modelName = coach?.coachModel() ?? '…';
	}
	let progressText = $state('');
	let progressRatio = $state<number | null>(null);
	const load = $derived(progressText ? describeCoachProgress(progressText, progressRatio) : null);
	let running = $state<string | null>(null);
	let elapsed = $state<Record<string, number>>({});

	onMount(() => {
		let stop = () => {};
		void import('$lib/chart/coach.browser').then(async (module) => {
			coach = module;
			refresh();
			stop = module.watchCoachProgress((update) => {
				progressText = update.text;
				progressRatio = update.ratio;
			});
			webgpu = await module.detectWebGPU();
		});
		return () => stop();
	});

	async function timed<T>(id: string, run: (module: Coach) => Promise<T>): Promise<T | null> {
		if (!coach || running) return null;
		running = id;
		const started = performance.now();
		try {
			coach.resumeCoach();
			return await run(coach);
		} catch (error) {
			if (!(error instanceof CoachStopped)) {
				progressText = error instanceof Error ? error.message : 'Failed.';
				progressRatio = null;
			}
			return null;
		} finally {
			elapsed = { ...elapsed, [id]: Math.round(performance.now() - started) };
			refresh();
			running = null;
		}
	}

	function seconds(id: string): string {
		const ms = elapsed[id];
		return ms === undefined ? '' : `${(ms / 1000).toFixed(1)} s`;
	}

	let direction = $state('Run my first half marathon');
	let extra = $state('By October. I can run 5 km now and work late on Tuesdays.');
	const answers = $derived(chartAnswersFromText(direction, extra));
	let drafted = $state<{ chart: ChartData | null; raw: string } | null>(null);

	let filled = $state<string[] | null>(null);
	let rewrites = $state<{ before: string; after: string | null }[]>([]);
	let question = $state('Which pillar should I start with?');
	let reply = $state('');

	type HoldoutRow = {
		model: string;
		direction: string;
		filled: number;
		faults: number;
		copies: number;
		constraint: boolean;
		seconds: number;
	};
	let holdoutRows = $state<HoldoutRow[]>([]);
	let holdoutNote = $state('');

	async function scoreHoldout(count: number): Promise<void> {
		if (!coach || running) return;
		running = 'holdout';
		holdoutNote = '';
		const started = performance.now();
		try {
			await coach.loadCoach();
			refresh();
			const label = 'Qwen3 4B';
			const setups = holdoutDataset.slice(0, count);
			for (const setup of setups) {
				const mark = performance.now();
				const result = await coach.proposeChart(setup);
				const report = result.chart
					? holdoutChartMetrics(result.chart, setup.constraint)
					: { filled: 0, faults: 1, copies: 0, constraint: false };
				const row: HoldoutRow = {
					model: label,
					direction: setup.direction,
					...report,
					seconds: Math.round((performance.now() - mark) / 1000)
				};
				holdoutRows = [...holdoutRows.filter((seen) => !(seen.model === row.model && seen.direction === row.direction)), row];
			}
		} catch (error) {
			if (!(error instanceof CoachStopped)) holdoutNote = error instanceof Error ? error.message : 'The run stopped.';
		} finally {
			elapsed = { ...elapsed, holdout: Math.round(performance.now() - started) };
			refresh();
			running = null;
		}
	}

	let probe = $state('Plan my week');
	let pasted = $state('');
	const fixtureSummary = summarizeScores(coachFixtures.map((fixture) => fixture.reply));
	const pastedScore = $derived(pasted.trim() ? scoreReply(pasted) : null);

	function setTheme(next: string): void {
		if (next === 'system' || next === 'light' || next === 'dark') chart.setTheme(next);
	}
</script>

<svelte:head>
	<title>AI lab · Mandala</title>
	<meta name="robots" content="noindex" />
</svelte:head>

{#snippet dot(pillarIndex: number)}
	<span class="pip mt-[0.38em] size-2.5 shrink-0 rounded-full" style:--pip-h={HUES[pillarIndex]} aria-hidden="true"></span>
{/snippet}

{#snippet picks(list: { key: string; text: string; pillarIndex: number; why: string }[])}
	<ul class="m-0 flex list-none flex-col gap-2 p-0">
		{#each list as pick (pick.key)}
			<li class="flex min-w-0 gap-2.5 text-[0.88rem] leading-snug">
				{@render dot(pick.pillarIndex)}
				<span class="flex min-w-0 flex-col">
					<span>{pick.text}</span>
					<span class="text-[0.76rem] text-muted">{pick.why}</span>
				</span>
			</li>
		{:else}
			<li class="text-[0.88rem] text-muted">Nothing open.</li>
		{/each}
	</ul>
{/snippet}

<div class="page-gutter mx-auto flex max-w-[1180px] flex-col gap-8 pb-40">
	<header class="flex flex-col gap-6">
		<div class="flex items-center justify-between gap-4">
			<Wordmark />
			<SegmentedControl label="Color theme" size="sm" options={themes} value={chart.theme} onchange={setTheme} />
		</div>
		<div class="flex max-w-[62ch] flex-col gap-3">
			<div>
				<Eyebrow>Lab</Eyebrow>
				<h1 class="m-0 mt-2 font-serif text-[clamp(1.9rem,4vw,2.8rem)] font-[480] tracking-tight text-balance">AI features</h1>
			</div>
			<p class="m-0 text-pretty text-muted">
				Everything Bindu can do, against a sandbox chart. Rules run instantly. Bindu writes with Qwen3 4B in this browser, or with the
				browser's own model where WebGPU is missing. Your real charts are not touched here.
			</p>
		</div>
	</header>

	<Card class="flex flex-col gap-4">
		<div class="flex flex-wrap items-center justify-between gap-3">
			<Eyebrow>Engine</Eyebrow>
			<div class="flex gap-2">
				<Button size="sm" variant="soft" disabled={!coach || !canRun || loaded || running !== null} onclick={() => timed('load', (module) => module.loadCoach())}>
					{loaded ? 'Loaded' : running === 'load' ? 'Loading' : 'Load the model'}
				</Button>
				<Button size="sm" variant="ghost" disabled={!running} onclick={() => coach?.interruptCoach()}>Stop</Button>
			</div>
		</div>
		<dl class="m-0 grid grid-cols-2 gap-x-6 gap-y-3 text-[0.88rem] sm:grid-cols-3">
			<div class="flex min-w-0 flex-col gap-0.5">
				<dt class="text-[0.76rem] text-muted">WebGPU</dt>
				<dd class="m-0 font-[620]">{webgpu === null ? 'Checking' : webgpu ? 'Available' : 'Not available'}</dd>
			</div>
			<div class="flex min-w-0 flex-col gap-0.5">
				<dt class="text-[0.76rem] text-muted">Model</dt>
				<dd class="m-0 font-[620] break-all">{modelName}</dd>
			</div>
			<div class="flex min-w-0 flex-col gap-0.5">
				<dt class="text-[0.76rem] text-muted">State</dt>
				<dd class="m-0 font-[620]">{loaded ? 'In memory' : running ? `Running: ${running}` : 'Not loaded'}</dd>
			</div>
			<div class="flex min-w-0 flex-col gap-0.5">
				<dt class="text-[0.76rem] text-muted">Load time</dt>
				<dd class="m-0 font-[620] tabular-nums">{seconds('load') || '—'}</dd>
			</div>
		</dl>
		<p class="m-0 min-h-[1.4em] text-[0.84rem] text-muted" role="status">
			{load?.label ?? ''}
			{#if load?.detail}<span class="tabular-nums"> · {load.detail}</span>{/if}
			{#if load?.downloadFillRatio != null}<span class="tabular-nums"> · {Math.round(load.downloadFillRatio * 100)}%</span>{/if}
		</p>
	</Card>

	<Card class="flex flex-col gap-4">
		<Eyebrow>Holdout dataset</Eyebrow>
		<p class="m-0 text-[0.88rem] text-pretty text-muted">
			Same invented starting answers, on Qwen3 4B. Filled is action cells out of 64. Copies are near-duplicates the checker caught.
		</p>
		<div class="flex flex-wrap items-end gap-2">
			<div class="flex h-[42px] items-center gap-2">
				<Button disabled={!canRun || running !== null} onclick={() => scoreHoldout(8)}>
					{running === 'holdout' ? 'Scoring' : 'Score 8'}
				</Button>
				<Button variant="soft" disabled={!canRun || running !== null} onclick={() => scoreHoldout(50)}>Score 50</Button>
				{#if seconds('holdout')}
					<span class="text-[0.82rem] text-muted tabular-nums">{seconds('holdout')}</span>
				{/if}
			</div>
		</div>
		{#if holdoutNote}<p class="m-0 text-[0.88rem] text-danger" role="alert">{holdoutNote}</p>{/if}
		<pre class={pre}>{holdoutRows.map((row) => `${row.model} · ${row.direction} · ${row.filled}/64 · faults ${row.faults} · copies ${row.copies} · constraint ${row.constraint ? 'yes' : 'no'} · ${row.seconds}s`).join('\n') || 'Nothing scored yet.'}</pre>
	</Card>

	<Card class="flex flex-col gap-4">
		<div class="flex flex-wrap items-center justify-between gap-x-4 gap-y-3">
			<Eyebrow>Sandbox chart</Eyebrow>
			<SegmentedControl
				class="max-w-full"
				label="Scenario"
				size="sm"
				options={scenarios}
				value={scenario}
				onchange={pickScenario}
			/>
		</div>
		<div class="grid grid-cols-[minmax(0,1fr)_minmax(0,400px)] gap-6 max-[900px]:grid-cols-1">
			<div class="flex min-h-0 min-w-0 flex-col gap-4">
				<p class="m-0 text-[1.05rem] font-[620]">{sample.goal || 'No goal yet'}</p>
				<ol class="m-0 grid list-none grid-cols-2 gap-x-5 gap-y-2.5 p-0 max-[640px]:grid-cols-1">
					{#each sample.pillars as pillar, pillarIndex (pillarIndex)}
						<li>
							<button
								type="button"
								class="flex w-full min-w-0 cursor-pointer gap-2 rounded-xl border-0 px-2 py-1 text-start font-sans text-[0.88rem] text-text hover:bg-sunken focus-visible:outline-2 focus-visible:outline-ink aria-pressed:bg-sunken"
								aria-pressed={preferred === pillarIndex}
								onclick={() => (preferred = preferred === pillarIndex ? null : pillarIndex)}
							>
								{@render dot(pillarIndex)}
								<span class="min-w-0 flex-1 truncate">{pillar || `Pillar ${pillarIndex + 1}`}</span>
								<span class="text-muted tabular-nums">{(sample.actions[pillarIndex] ?? []).filter((action) => action.trim()).length}/8</span>
							</button>
						</li>
					{/each}
				</ol>
				<p class="m-0 text-[0.8rem] text-muted">Press a pillar to act as the selected block. Bindu fills that one first.</p>
				<div class="flex min-h-0 flex-1 flex-col gap-1.5">
					<span class="text-[0.82rem] font-semibold">What Bindu changed</span>
					<pre class="m-0 min-h-28 flex-1 overflow-auto rounded-2xl bg-sunken px-3.5 py-3 font-mono text-[0.76rem] leading-[1.5] whitespace-pre-wrap text-text">{events.join('\n') || 'Nothing yet.'}</pre>
				</div>
			</div>
			<div class="h-[600px] min-w-0 rounded-[28px] shadow-float">
				<HelperPanel helper={lab} class="h-full" />
			</div>
		</div>
	</Card>

	<Card class="flex flex-col gap-4">
		<Eyebrow>Rules, no model</Eyebrow>
		<div class="grid grid-cols-3 gap-6 max-[900px]:grid-cols-1">
			<section class="flex min-w-0 flex-col gap-2.5">
				<h2 class="m-0 text-[0.95rem] font-[620]">Review · {findings.length}</h2>
				<ul class="m-0 flex list-none flex-col gap-2 p-0">
					{#each findings as finding (finding.key)}
						<li class="flex flex-col text-[0.88rem] leading-snug">
							<span class="text-[0.74rem] font-semibold text-muted">{describeKey(sample, finding.key)} · {finding.code}</span>
							<span>{finding.text}</span>
							<span class="text-[0.76rem] text-muted">{finding.reason}</span>
						</li>
					{:else}
						<li class="text-[0.88rem] text-muted">Every cell passes.</li>
					{/each}
				</ul>
			</section>
			<section class="flex min-w-0 flex-col gap-2.5">
				<h2 class="m-0 text-[0.95rem] font-[620]">This week · {week.length}</h2>
				{@render picks(week)}
			</section>
			<section class="flex min-w-0 flex-col gap-2.5">
				<h2 class="m-0 text-[0.95rem] font-[620]">Today · {today.length}</h2>
				{@render picks(today)}
				<p class="m-0 mt-2 text-[0.8rem] text-muted">
					Fill plan: {plan ? (plan.kind === 'pillars' ? `${plan.empty.length} pillars` : `${plan.empty.length} actions in pillar ${plan.pillarIndex + 1}`) : 'nothing to fill'}
				</p>
			</section>
		</div>
	</Card>

	<div class="grid grid-cols-2 gap-6 max-[900px]:grid-cols-1">
		<Card class="flex min-w-0 flex-col gap-3.5">
			<Eyebrow>Draft from two answers</Eyebrow>
			<label class="flex flex-col gap-1.5">
				<span class="text-[0.82rem] font-semibold">What is the goal? One line is enough.</span>
				<input class={field} bind:value={direction} />
			</label>
			<label class="flex flex-col gap-1.5">
				<span class="text-[0.82rem] font-semibold">Anything I should know?</span>
				<input class={field} bind:value={extra} />
			</label>
			<pre class={pre}>{chartAnswersMessage(answers)}</pre>
			<div class="flex flex-wrap items-center gap-3">
				<Button
					size="sm"
					disabled={!canRun || running !== null || !answers.direction}
					onclick={async () => (drafted = await timed('draft', (module) => module.proposeChart(answers)))}
				>
					{running === 'draft' ? 'Writing' : 'Write the chart'}
				</Button>
				{#if drafted?.chart}
					<Button size="sm" variant="soft" onclick={() => {
							if (!drafted?.chart) return;
							sample = drafted.chart;
							note('Draft sent to sandbox');
						}}>Send to sandbox</Button>
				{/if}
				<span class="text-[0.82rem] text-muted tabular-nums">{seconds('draft')}</span>
			</div>
			{#if drafted}
				{#if drafted.chart}
					<p class="m-0 text-[0.95rem] font-[620]">{drafted.chart.goal}</p>
					<ol class="m-0 grid list-none grid-cols-2 gap-x-3 gap-y-1 p-0 text-[0.86rem]">
						{#each drafted.chart.pillars as pillar, pillarIndex (pillarIndex)}
							<li class="flex gap-2">{@render dot(pillarIndex)}<span>{pillar}</span></li>
						{/each}
					</ol>
					<p class="m-0 text-[0.82rem] text-muted">
						Method issues: {scoreChart(drafted.chart).length === 0 ? 'none' : scoreChart(drafted.chart).map((issue) => issue.code).join(', ')}
					</p>
				{:else}
					<p class="m-0 text-[0.88rem] text-danger" role="alert">No complete chart. Raw reply below.</p>
					<pre class={pre}>{drafted.raw}</pre>
				{/if}
			{/if}
		</Card>

		<Card class="flex min-w-0 flex-col gap-3.5">
			<Eyebrow>Narrow jobs</Eyebrow>
			<div class="flex flex-col gap-2">
				<span class="text-[0.82rem] font-semibold">Fill empty actions · {plan ? (plan.kind === 'pillars' ? 'pillars' : sample.pillars[plan.pillarIndex]) : 'nothing'}</span>
				<div class="flex flex-wrap items-center gap-3">
					<Button
						size="sm"
						variant="soft"
						disabled={!canRun || running !== null || !plan}
						onclick={async () => {
							if (!plan) return;
							const current = plan;
							filled = await timed('fill', (module) =>
								current.kind === 'pillars'
									? module.fillPillars(sample, current.empty.length)
									: module.fillActions(sample, current.pillarIndex, current.empty.length)
							);
						}}
					>
						{running === 'fill' ? 'Writing' : 'Fill'}
					</Button>
					<span class="text-[0.82rem] text-muted tabular-nums">{seconds('fill')}</span>
				</div>
				{#if filled}
					<pre class={pre}>{filled.map((line, index) => `${index + 1}. ${line}`).join('\n')}</pre>
				{/if}
			</div>
			<div class="flex flex-col gap-2">
				<span class="text-[0.82rem] font-semibold">Rewrite weak cells · {findings.length}</span>
				<div class="flex flex-wrap items-center gap-3">
					<Button
						size="sm"
						variant="soft"
						disabled={!canRun || running !== null || findings.length === 0}
						onclick={async () => {
							const list = findings.slice(0, 3);
							rewrites =
								(await timed('rewrite', async (module) => {
									const out: { before: string; after: string | null }[] = [];
									for (const finding of list) out.push({ before: finding.text, after: await module.rewriteCell(sample, finding) });
									return out;
								})) ?? [];
						}}
					>
						{running === 'rewrite' ? 'Rewriting' : 'Rewrite three'}
					</Button>
					<span class="text-[0.82rem] text-muted tabular-nums">{seconds('rewrite')}</span>
				</div>
				{#each rewrites as rewrite (rewrite.before)}
					<p class="m-0 text-[0.88rem] leading-snug">
						<s class="text-muted">{rewrite.before}</s><br />{rewrite.after ?? 'No better line.'}
					</p>
				{/each}
			</div>
			<div class="flex flex-col gap-2">
				<span class="text-[0.82rem] font-semibold">Ask about the chart</span>
				<input class={field} bind:value={question} />
				<div class="flex flex-wrap items-center gap-3">
					<Button
						size="sm"
						variant="soft"
						disabled={!canRun || running !== null || !question.trim()}
						onclick={async () => (reply = (await timed('ask', (module) => module.answer(sample, question))) ?? '')}
					>
						{running === 'ask' ? 'Thinking' : 'Ask'}
					</Button>
					<span class="text-[0.82rem] text-muted tabular-nums">{seconds('ask')}</span>
				</div>
				{#if reply}<p class="m-0 text-[0.9rem] leading-[1.45] text-pretty">{reply}</p>{/if}
			</div>
		</Card>
	</div>

	<div class="grid grid-cols-2 gap-6 max-[900px]:grid-cols-1">
		<Card class="flex min-w-0 flex-col gap-3.5">
			<Eyebrow>Router and parser</Eyebrow>
			<label class="flex flex-col gap-1.5">
				<span class="text-[0.82rem] font-semibold">A message to Bindu</span>
				<input class={field} bind:value={probe} />
			</label>
			<p class="m-0 text-[0.9rem]">Routes to <b class="font-[620]">{routeOf(probe, sample)}</b></p>
			<label class="flex flex-col gap-1.5">
				<span class="text-[0.82rem] font-semibold">Paste a model reply</span>
				<textarea class={area} rows="4" placeholder="JSON from any chat app" bind:value={pasted}></textarea>
			</label>
			{#if pastedScore}
				<p class="m-0 text-[0.88rem]">
					{pastedScore.parsed ? 'A whole chart.' : 'Not a whole chart.'}
					{pastedScore.issues.length ? `Issues: ${pastedScore.issues.map((issue) => issue.code).join(', ')}` : ''}
				</p>
			{/if}
		</Card>

		<Card class="flex min-w-0 flex-col gap-3.5">
			<Eyebrow>Scorer baseline</Eyebrow>
			<p class="m-0 text-[0.9rem] tabular-nums">
				Fixtures parsed {fixtureSummary.parsed} of {fixtureSummary.total}. With method issues {fixtureSummary.withIssues} of {fixtureSummary.parsed}.
			</p>
			<ul class="m-0 flex list-none flex-col gap-1.5 p-0 text-[0.88rem]">
				{#each coachFixtures as fixture (fixture.name)}
					{@const score = scoreReply(fixture.reply)}
					<li class="flex justify-between gap-3">
						<span>{fixture.name}</span>
						<span class="text-muted">{score.parsed ? (score.issues.length ? score.issues.map((issue) => issue.code).join(', ') : 'clean') : 'unparsed'}</span>
					</li>
				{/each}
			</ul>
			<p class="m-0 text-[0.8rem] text-muted">Run <code>bun run score:coach</code> for the 50 held-out answer sets.</p>
		</Card>
	</div>

	<Card class="flex flex-col gap-4">
		<Eyebrow>Bindu's faces</Eyebrow>
		<div class="flex flex-wrap gap-8">
			{#each faceScenarios as scenario (scenario.mood)}
				<figure class="m-0 flex flex-col items-center gap-2.5">
					<div class="flex items-end gap-3">
						<HelperFace mood={scenario.mood} size={28} />
						<HelperFace mood={scenario.mood} size={46} />
						<HelperFace mood={scenario.mood} size={80} />
					</div>
					<figcaption class="flex flex-col items-center text-center">
						<span class="text-[0.84rem] font-[560] text-text capitalize">{scenario.mood}</span>
						<span class="text-[0.74rem] text-muted">{scenario.moment}</span>
					</figcaption>
				</figure>
			{/each}
		</div>
	</Card>
</div>
