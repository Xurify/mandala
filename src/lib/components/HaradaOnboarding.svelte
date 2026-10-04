<script lang="ts">
	import { chart } from '$lib/chart/chart.svelte';
	import Icon from './Icon.svelte';
	import Button from './ui/Button.svelte';
	import Dialog from './ui/Dialog.svelte';
	import { cn } from './ui/cn';
	import { textArea, textField } from './ui/styles';

	interface Props {
		open?: boolean;
	}

	let { open = $bindable(false) }: Props = $props();

	let currentStep = $state<1 | 2 | 3>(1);
	let audience = $state<'self' | 'both'>('self');

	let tangibleSelf = $state('');
	let tangibleOthers = $state('');
	let intangibleSelf = $state('');
	let intangibleOthers = $state('');

	let suggestionTangibleSelf = $state('');
	let suggestionTangibleOthers = $state('');
	let suggestionIntangibleSelf = $state('');
	let suggestionIntangibleOthers = $state('');

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
		suggestionTangibleSelf = extractPillarName(tangibleSelf, '');
		suggestionTangibleOthers = extractPillarName(tangibleOthers, '');
		suggestionIntangibleSelf = extractPillarName(intangibleSelf, '');
		suggestionIntangibleOthers = extractPillarName(intangibleOthers, '');
		currentStep = 3;
	}

	function handleApply(): void {
		const suggestions = [
			suggestionTangibleSelf.trim(),
			suggestionTangibleOthers.trim(),
			suggestionIntangibleSelf.trim(),
			suggestionIntangibleOthers.trim()
		];

		suggestions.forEach((suggestion, index) => {
			if (suggestion) {
				chart.setText(`p${index}`, suggestion);
			}
		});

		try {
			sessionStorage.setItem('mandala-harada-completed', 'true');
		} catch {
			// storage blocked
		}

		chart.say('Added the pillars.');
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
				<div class="flex flex-col gap-1.5">
					<div class="flex items-center gap-1.5">
						<span class="size-2 rounded-full bg-chart-1"></span>
						<span class="text-[0.78rem] font-bold text-text">What you practice</span>
					</div>
					<p class="text-[0.74rem] text-muted">What skill or routine will you do?</p>
					<textarea
						class={cn(textArea, 'h-20 resize-none text-[0.82rem]')}
						placeholder="e.g. Practice speaking for 15 minutes"
						bind:value={tangibleSelf}
					></textarea>
				</div>

				<div class="flex flex-col gap-1.5">
					<div class="flex items-center gap-1.5">
						<span class="size-2 rounded-full bg-chart-2"></span>
						<span class="text-[0.78rem] font-bold text-text">Who it is for</span>
					</div>
					<p class="text-[0.74rem] text-muted">What will other people see you do?</p>
					<textarea
						class={cn(textArea, 'h-20 resize-none text-[0.82rem]')}
						placeholder="e.g. Talk with a partner for 20 minutes"
						bind:value={tangibleOthers}
					></textarea>
				</div>

				<div class="flex flex-col gap-1.5">
					<div class="flex items-center gap-1.5">
						<span class="size-2 rounded-full bg-chart-3"></span>
						<span class="text-[0.78rem] font-bold text-text">How you keep going</span>
					</div>
					<p class="text-[0.74rem] text-muted">What helps you continue when it is hard?</p>
					<textarea
						class={cn(textArea, 'h-20 resize-none text-[0.82rem]')}
						placeholder="e.g. Write one thing that went well after each try"
						bind:value={intangibleSelf}
					></textarea>
				</div>

				<div class="flex flex-col gap-1.5">
					<div class="flex items-center gap-1.5">
						<span class="size-2 rounded-full bg-chart-4"></span>
						<span class="text-[0.78rem] font-bold text-text">Who you show up for</span>
					</div>
					<p class="text-[0.74rem] text-muted">Who do you want to spend time with?</p>
					<textarea
						class={cn(textArea, 'h-20 resize-none text-[0.82rem]')}
						placeholder="e.g. Call one friend on Sunday"
						bind:value={intangibleOthers}
					></textarea>
				</div>
			</div>
		</div>
	{:else}
		<div class="flex flex-col gap-4">
			<p class="text-[0.84rem] text-muted">
				Four pillar names from what you wrote. Edit any of them, then add them to the chart.
			</p>

			<div class="flex flex-col gap-3">
				<div class="flex flex-col gap-1">
					<span class="text-[0.74rem] font-bold text-muted">Pillar 1 · What you practice</span>
					<input
						type="text"
						class={cn(textField, 'text-[0.88rem] font-medium')}
						placeholder="Pillar name"
						bind:value={suggestionTangibleSelf}
					/>
				</div>

				<div class="flex flex-col gap-1">
					<span class="text-[0.74rem] font-bold text-muted">Pillar 2 · Who it is for</span>
					<input
						type="text"
						class={cn(textField, 'text-[0.88rem] font-medium')}
						placeholder="Pillar name"
						bind:value={suggestionTangibleOthers}
					/>
				</div>

				<div class="flex flex-col gap-1">
					<span class="text-[0.74rem] font-bold text-muted">Pillar 3 · How you keep going</span>
					<input
						type="text"
						class={cn(textField, 'text-[0.88rem] font-medium')}
						placeholder="Pillar name"
						bind:value={suggestionIntangibleSelf}
					/>
				</div>

				<div class="flex flex-col gap-1">
					<span class="text-[0.74rem] font-bold text-muted">Pillar 4 · Who you show up for</span>
					<input
						type="text"
						class={cn(textField, 'text-[0.88rem] font-medium')}
						placeholder="Pillar name"
						bind:value={suggestionIntangibleOthers}
					/>
				</div>
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
				<Button variant="primary" onclick={goToStep3}>See pillar ideas</Button>
			{:else}
				<Button variant="ghost" onclick={() => (currentStep = 2)}>← Back</Button>
				<Button variant="primary" onclick={handleApply}>Add to chart</Button>
			{/if}
		</div>
	{/snippet}
</Dialog>
