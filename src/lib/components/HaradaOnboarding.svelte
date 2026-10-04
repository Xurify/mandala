<script lang="ts">
	import { chart } from '$lib/chart/chart.svelte';
	import Button from './ui/Button.svelte';
	import Dialog from './ui/Dialog.svelte';
	import { cn } from './ui/cn';
	import { textArea, textField } from './ui/styles';

	interface Props {
		open?: boolean;
	}

	let { open = $bindable(false) }: Props = $props();

	type PerspectiveId = 'tangibleSelf' | 'tangibleOthers' | 'intangibleSelf' | 'intangibleOthers';

	interface PerspectiveDefinition {
		id: PerspectiveId;
		label: string;
		sublabel: string;
		placeholder: string;
		chartColorClass: string;
	}

	const perspectives: PerspectiveDefinition[] = [
		{
			id: 'tangibleSelf',
			label: 'What you practice',
			sublabel: 'What skill or routine will you do?',
			placeholder: 'e.g. Practice speaking for 15 minutes',
			chartColorClass: 'bg-chart-1'
		},
		{
			id: 'tangibleOthers',
			label: 'Who it is for',
			sublabel: 'What will other people see you do?',
			placeholder: 'e.g. Talk with a partner for 20 minutes',
			chartColorClass: 'bg-chart-2'
		},
		{
			id: 'intangibleSelf',
			label: 'How you keep going',
			sublabel: 'What helps you continue when it is hard?',
			placeholder: 'e.g. Write one thing that went well after each try',
			chartColorClass: 'bg-chart-3'
		},
		{
			id: 'intangibleOthers',
			label: 'Who you show up for',
			sublabel: 'Who do you want to spend time with?',
			placeholder: 'e.g. Call one friend on Sunday',
			chartColorClass: 'bg-chart-4'
		}
	];

	let currentStep = $state<1 | 2 | 3>(1);
	let audience = $state<'self' | 'both'>('self');

	let rawNotes = $state<Record<PerspectiveId, string>>({
		tangibleSelf: '',
		tangibleOthers: '',
		intangibleSelf: '',
		intangibleOthers: ''
	});

	let suggestions = $state<Record<PerspectiveId, string>>({
		tangibleSelf: '',
		tangibleOthers: '',
		intangibleSelf: '',
		intangibleOthers: ''
	});

	const filledPerspectives = $derived(
		perspectives.filter((perspective) => rawNotes[perspective.id].trim().length > 0)
	);
	const hasAnyNotes = $derived(filledPerspectives.length > 0);

	function extractPillarName(input: string, fallback: string): string {
		const trimmed = input.trim();
		if (!trimmed) return '';
		const firstSentence = trimmed.split(/[.!?\n]/)[0]?.trim() ?? '';
		const candidate = firstSentence.slice(0, 36);
		return candidate || fallback;
	}

	function goToStep2(): void {
		currentStep = 2;
	}

	function goToStep3(): void {
		for (const perspective of perspectives) {
			suggestions[perspective.id] = extractPillarName(rawNotes[perspective.id], '');
		}
		currentStep = 3;
	}

	function handleApply(): void {
		const nonEmpty = filledPerspectives
			.map((perspective) => suggestions[perspective.id].trim())
			.filter((candidate) => candidate.length > 0);

		if (nonEmpty.length === 0) {
			open = false;
			return;
		}

		const emptySlots: number[] = [];
		for (let pillarIndex = 0; pillarIndex < 8; pillarIndex++) {
			if (!chart.data.pillars[pillarIndex]?.trim()) {
				emptySlots.push(pillarIndex);
			}
		}

		nonEmpty.forEach((suggestion, index) => {
			const targetIndex = emptySlots[index] ?? index;
			if (targetIndex < 8) {
				chart.setText(`p${targetIndex}`, suggestion);
			}
		});

		try {
			sessionStorage.setItem('mandala-harada-completed', 'true');
		} catch {
			// storage blocked
		}

		chart.say(nonEmpty.length === 1 ? 'Added 1 pillar.' : `Added ${nonEmpty.length} pillars.`);
		open = false;
		currentStep = 1;
	}

	function handleDismiss(): void {
		try {
			sessionStorage.setItem('mandala-harada-completed', 'true');
		} catch {
			// storage blocked
		}
		open = false;
	}
</script>

<Dialog bind:open title="Name the pillars" description="Four ways to look at the goal. Skip any box that does not fit.">
	{#if currentStep === 1}
		<div class="flex flex-col gap-5">
			<div class="rounded-[18px] bg-sunken p-4 text-center">
				<p class="text-[0.76rem] font-bold tracking-wider text-muted uppercase">The goal</p>
				<p class="mt-1 font-serif text-[1.25rem] font-medium text-text">
					{chart.data.goal.trim() || 'Your main goal'}
				</p>
			</div>

			<div class="flex flex-col gap-2.5">
				<p class="text-[0.88rem] font-medium text-text">Who is this goal ultimately for?</p>
				<div class="grid grid-cols-2 gap-2.5 max-[500px]:grid-cols-1">
					<button
						type="button"
						class="flex flex-col gap-1 rounded-[16px] border-2 p-3.5 text-left motion-safe:transition-all cursor-pointer {audience === 'self' ? 'border-ink bg-surface shadow-sm' : 'border-line bg-sunken hover:border-muted'}"
						onclick={() => (audience = 'self')}
					>
						<span class="text-[0.88rem] font-semibold text-text">Mainly for myself</span>
						<span class="text-[0.78rem] text-muted">Personal growth, mastery, and satisfaction</span>
					</button>

					<button
						type="button"
						class="flex flex-col gap-1 rounded-[16px] border-2 p-3.5 text-left motion-safe:transition-all cursor-pointer {audience === 'both' ? 'border-ink bg-surface shadow-sm' : 'border-line bg-sunken hover:border-muted'}"
						onclick={() => (audience = 'both')}
					>
						<span class="text-[0.88rem] font-semibold text-text">For myself and others</span>
						<span class="text-[0.78rem] text-muted">Family, colleagues, clients, or community</span>
					</button>
				</div>
			</div>
		</div>
	{:else if currentStep === 2}
		<div class="flex flex-col gap-4">
			<p class="text-[0.84rem] text-muted">
				Write a few words in any box. Skip the ones that do not fit.
			</p>

			<div class="grid grid-cols-2 gap-3 max-[600px]:grid-cols-1">
				{#each perspectives as perspective (perspective.id)}
					<div class="flex flex-col gap-1.5">
						<div class="flex items-center gap-1.5">
							<span class={cn('size-2 rounded-full', perspective.chartColorClass)}></span>
							<span class="text-[0.78rem] font-bold text-text">{perspective.label}</span>
						</div>
						<p class="text-[0.74rem] text-muted">{perspective.sublabel}</p>
						<textarea
							class={cn(textArea, 'h-20 resize-none text-[0.82rem]')}
							placeholder={perspective.placeholder}
							bind:value={rawNotes[perspective.id]}
						></textarea>
					</div>
				{/each}
			</div>
		</div>
	{:else}
		<div class="flex flex-col gap-4">
			<p class="text-[0.84rem] text-muted">
				{filledPerspectives.length === 1
					? '1 pillar name from what you wrote. Edit it, then add it to the chart.'
					: `${filledPerspectives.length} pillar names from what you wrote. Edit any of them, then add them to the chart.`}
			</p>

			<div class="flex flex-col gap-3">
				{#each filledPerspectives as perspective, index (perspective.id)}
					<div class="flex flex-col gap-1">
						<span class="text-[0.74rem] font-bold text-muted">Pillar {index + 1} · {perspective.label}</span>
						<input
							type="text"
							class={cn(textField, 'text-[0.88rem] font-medium')}
							placeholder="Pillar name"
							bind:value={suggestions[perspective.id]}
						/>
					</div>
				{/each}
			</div>
		</div>
	{/if}

	{#snippet footer()}
		<div class="flex w-full items-center justify-between gap-2">
			{#if currentStep === 1}
				<Button variant="ghost" onclick={handleDismiss}>Skip for now</Button>
				<Button variant="primary" onclick={goToStep2}>Continue →</Button>
			{:else if currentStep === 2}
				<Button variant="ghost" onclick={() => (currentStep = 1)}>← Back</Button>
				<Button variant="primary" disabled={!hasAnyNotes} onclick={goToStep3}>See pillar ideas</Button>
			{:else}
				<Button variant="ghost" onclick={() => (currentStep = 2)}>← Back</Button>
				<Button variant="primary" onclick={handleApply}>Add to chart</Button>
			{/if}
		</div>
	{/snippet}
</Dialog>
