<script lang="ts">
	import { chart } from '$lib/chart/chart.svelte';
	import { parseDraftText } from '$lib/chart/draft';
	import { exampleChart } from '$lib/chart/example';
	import { describeKey, fillPlan, reviewChart, routeOf, suggestToday, suggestWeek } from '$lib/chart/helper';
	import { HelperStore, type HelperMood } from '$lib/chart/helper.svelte';
	import { dateKeyOffset, emptyChart, HUES, setByKey, setMeta, todayKey, type ChartData } from '$lib/chart/model';
	import Wordmark from '$lib/components/Wordmark.svelte';
	import HelperFace from '$lib/components/HelperFace.svelte';
	import HelperPanel from '$lib/components/HelperPanel.svelte';
	import Card from '$lib/components/ui/Card.svelte';
	import Eyebrow from '$lib/components/ui/Eyebrow.svelte';
	import SegmentedControl from '$lib/components/ui/SegmentedControl.svelte';
	import { textArea, textField } from '$lib/components/ui/styles';

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
		{ mood: 'happy', moment: 'Kept a card, clean review' },
		{ mood: 'puzzled', moment: 'Open findings card' },
		{ mood: 'offering', moment: 'Proposed a card' },
		{ mood: 'curious', moment: 'Asked and waiting' },
		{ mood: 'listening', moment: 'Message box focused' },
		{ mood: 'idle', moment: 'Resting, greeting' }
	];
	const field = textField;
	const area = textArea;

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
	let events = $state<string[]>([]);

	function note(text: string): void {
		events = [`${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}  ${text}`, ...events].slice(0, 12);
	}

	const lab = new HelperStore({
		data: () => sample,
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
	const plan = $derived(fillPlan(sample));

	let probe = $state('Plan my week');
	let pasted = $state('');
	const pastedChart = $derived(pasted.trim() ? parseDraftText(pasted) : null);
	const pastedFindings = $derived(pastedChart ? reviewChart(pastedChart, 99) : []);

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
				<h1 class="m-0 mt-2 font-serif text-[clamp(1.9rem,4vw,2.8rem)] font-[480] tracking-tight text-balance">Bindu</h1>
			</div>
			<p class="m-0 text-pretty text-muted">
				Everything Bindu can do, against a sandbox chart. It runs on rules, instantly. Writing goes to a chat app through a prompt,
				and the pasted reply comes back here. Your real charts are not touched.
			</p>
		</div>
	</header>

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
						<li class="flex min-w-0 gap-2 px-2 py-1 text-[0.88rem]">
							{@render dot(pillarIndex)}
							<span class="min-w-0 flex-1 truncate">{pillar || `Pillar ${pillarIndex + 1}`}</span>
							<span class="text-muted tabular-nums">{(sample.actions[pillarIndex] ?? []).filter((action) => action.trim()).length}/8</span>
						</li>
					{/each}
				</ol>
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
		<Eyebrow>Rules</Eyebrow>
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
					Gaps: {plan ? (plan.kind === 'pillars' ? `${plan.empty.length} pillars` : `actions, starting in pillar ${plan.pillarIndex + 1}`) : 'none'}
				</p>
			</section>
		</div>
	</Card>

	<div class="grid grid-cols-2 gap-6 max-[900px]:grid-cols-1">
		<Card class="flex min-w-0 flex-col gap-3.5">
			<Eyebrow>Router and parser</Eyebrow>
			<label class="flex flex-col gap-1.5">
				<span class="text-[0.82rem] font-semibold">A message to Bindu</span>
				<input class={field} bind:value={probe} />
			</label>
			<p class="m-0 text-[0.9rem]">Routes to <b class="font-[620]">{routeOf(probe, sample)}</b></p>
			<label class="flex flex-col gap-1.5">
				<span class="text-[0.82rem] font-semibold">Paste a chat app's reply</span>
				<textarea class={area} rows="4" placeholder="JSON from any chat app" bind:value={pasted}></textarea>
			</label>
			{#if pasted.trim()}
				<p class="m-0 text-[0.88rem]">
					{pastedChart ? 'A whole chart.' : 'Not a whole chart.'}
					{pastedFindings.length ? `Review flags: ${pastedFindings.map((finding) => finding.code).join(', ')}` : ''}
				</p>
			{/if}
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
