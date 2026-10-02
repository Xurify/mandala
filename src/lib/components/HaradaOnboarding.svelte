<script lang="ts">
	import { chart } from '$lib/chart/chart.svelte';
	import Icon from './Icon.svelte';
	import Button from './ui/Button.svelte';
	import Dialog from './ui/Dialog.svelte';

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
		suggestionTangibleSelf = extractPillarName(tangibleSelf, 'Core skills');
		suggestionTangibleOthers = extractPillarName(tangibleOthers, 'External impact');
		suggestionIntangibleSelf = extractPillarName(intangibleSelf, 'Mindset & resilience');
		suggestionIntangibleOthers = extractPillarName(intangibleOthers, 'Community & trust');
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

		chart.say('Pillars applied to chart.');
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

<Dialog bind:open title="Harada 4 Perspectives" description="Balance your pillars across tangible and intangible, self and others.">
	{#if currentStep === 1}
		<div class="flex flex-col gap-5">
			<div class="rounded-[18px] bg-sunken p-4 text-center">
				<p class="text-[0.76rem] font-bold tracking-wider text-muted uppercase">Your central goal</p>
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

		{#snippet footer()}
			<div class="flex w-full items-center justify-between gap-2">
				<Button variant="ghost" onclick={handleDismiss}>Skip for now</Button>
				<Button variant="primary" onclick={goToStep2}>Continue →</Button>
			</div>
		{/snippet}
	{:else if currentStep === 2}
		<div class="flex flex-col gap-4">
			<p class="text-[0.84rem] text-muted">
				Reflect on your goal through all 4 quadrants. Jot brief thoughts or keywords in any or all boxes.
			</p>

			<div class="grid grid-cols-2 gap-3 max-[600px]:grid-cols-1">
				<div class="flex flex-col gap-1.5 rounded-[16px] bg-sunken p-3">
					<div class="flex items-center gap-1.5">
						<span class="size-2 rounded-full bg-chart-1"></span>
						<span class="text-[0.78rem] font-bold text-text uppercase tracking-wider">Tangible × Self</span>
					</div>
					<p class="text-[0.74rem] text-muted">What skill or routine will you physically build?</p>
					<textarea
						class="h-20 w-full resize-none rounded-[10px] border border-line bg-surface p-2 text-[0.82rem] text-text placeholder:text-muted focus:shadow-[0_0_0_2px_var(--ink)] focus:outline-none"
						placeholder="e.g. Daily speaking practice, vocabulary review"
						bind:value={tangibleSelf}
					></textarea>
				</div>

				<div class="flex flex-col gap-1.5 rounded-[16px] bg-sunken p-3">
					<div class="flex items-center gap-1.5">
						<span class="size-2 rounded-full bg-chart-2"></span>
						<span class="text-[0.78rem] font-bold text-text uppercase tracking-wider">Tangible × Others</span>
					</div>
					<p class="text-[0.74rem] text-muted">What tangible proof or service will others experience?</p>
					<textarea
						class="h-20 w-full resize-none rounded-[10px] border border-line bg-surface p-2 text-[0.82rem] text-text placeholder:text-muted focus:shadow-[0_0_0_2px_var(--ink)] focus:outline-none"
						placeholder="e.g. Fluent conversation, mentoring others"
						bind:value={tangibleOthers}
					></textarea>
				</div>

				<div class="flex flex-col gap-1.5 rounded-[16px] bg-sunken p-3">
					<div class="flex items-center gap-1.5">
						<span class="size-2 rounded-full bg-chart-3"></span>
						<span class="text-[0.78rem] font-bold text-text uppercase tracking-wider">Intangible × Self</span>
					</div>
					<p class="text-[0.74rem] text-muted">What mindset, belief, or emotional calm will anchor you?</p>
					<textarea
						class="h-20 w-full resize-none rounded-[10px] border border-line bg-surface p-2 text-[0.82rem] text-text placeholder:text-muted focus:shadow-[0_0_0_2px_var(--ink)] focus:outline-none"
						placeholder="e.g. Embrace mistakes as learning, self-compassion"
						bind:value={intangibleSelf}
					></textarea>
				</div>

				<div class="flex flex-col gap-1.5 rounded-[16px] bg-sunken p-3">
					<div class="flex items-center gap-1.5">
						<span class="size-2 rounded-full bg-chart-4"></span>
						<span class="text-[0.78rem] font-bold text-text uppercase tracking-wider">Intangible × Others</span>
					</div>
					<p class="text-[0.74rem] text-muted">Who do you want to inspire, encourage, or connect with?</p>
					<textarea
						class="h-20 w-full resize-none rounded-[10px] border border-line bg-surface p-2 text-[0.82rem] text-text placeholder:text-muted focus:shadow-[0_0_0_2px_var(--ink)] focus:outline-none"
						placeholder="e.g. Deep connection with native speakers"
						bind:value={intangibleOthers}
					></textarea>
				</div>
			</div>
		</div>

		{#snippet footer()}
			<div class="flex w-full items-center justify-between gap-2">
				<Button variant="ghost" onclick={() => (currentStep = 1)}>← Back</Button>
				<Button variant="primary" onclick={goToStep3}>Generate Pillar Ideas →</Button>
			</div>
		{/snippet}
	{:else}
		<div class="flex flex-col gap-4">
			<p class="text-[0.84rem] text-muted">
				Here are 4 suggested pillar names synthesized from your reflections. You can edit each one before applying to your chart.
			</p>

			<div class="flex flex-col gap-3">
				<div class="flex flex-col gap-1 rounded-[14px] bg-sunken p-3">
					<span class="text-[0.74rem] font-bold text-muted uppercase tracking-wider">Pillar 1 · Tangible Self</span>
					<input
						type="text"
						class="rounded-[10px] border border-line bg-surface px-3 py-1.5 text-[0.88rem] font-medium text-text placeholder:text-muted focus:shadow-[0_0_0_2px_var(--ink)] focus:outline-none"
						placeholder="Pillar name"
						bind:value={suggestionTangibleSelf}
					/>
				</div>

				<div class="flex flex-col gap-1 rounded-[14px] bg-sunken p-3">
					<span class="text-[0.74rem] font-bold text-muted uppercase tracking-wider">Pillar 2 · Tangible Others</span>
					<input
						type="text"
						class="rounded-[10px] border border-line bg-surface px-3 py-1.5 text-[0.88rem] font-medium text-text placeholder:text-muted focus:shadow-[0_0_0_2px_var(--ink)] focus:outline-none"
						placeholder="Pillar name"
						bind:value={suggestionTangibleOthers}
					/>
				</div>

				<div class="flex flex-col gap-1 rounded-[14px] bg-sunken p-3">
					<span class="text-[0.74rem] font-bold text-muted uppercase tracking-wider">Pillar 3 · Intangible Self</span>
					<input
						type="text"
						class="rounded-[10px] border border-line bg-surface px-3 py-1.5 text-[0.88rem] font-medium text-text placeholder:text-muted focus:shadow-[0_0_0_2px_var(--ink)] focus:outline-none"
						placeholder="Pillar name"
						bind:value={suggestionIntangibleSelf}
					/>
				</div>

				<div class="flex flex-col gap-1 rounded-[14px] bg-sunken p-3">
					<span class="text-[0.74rem] font-bold text-muted uppercase tracking-wider">Pillar 4 · Intangible Others</span>
					<input
						type="text"
						class="rounded-[10px] border border-line bg-surface px-3 py-1.5 text-[0.88rem] font-medium text-text placeholder:text-muted focus:shadow-[0_0_0_2px_var(--ink)] focus:outline-none"
						placeholder="Pillar name"
						bind:value={suggestionIntangibleOthers}
					/>
				</div>
			</div>
		</div>

		{#snippet footer()}
			<div class="flex w-full items-center justify-between gap-2">
				<Button variant="ghost" onclick={() => (currentStep = 2)}>← Back</Button>
				<Button variant="primary" onclick={handleApply}>Apply to Chart</Button>
			</div>
		{/snippet}
	{/if}
</Dialog>
