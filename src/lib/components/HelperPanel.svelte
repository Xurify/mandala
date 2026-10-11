<script lang="ts">
	import { tick } from 'svelte';
	import { fade } from 'svelte/transition';
	import type { HelperPage, HelperStore } from '$lib/chart/helper.svelte';
	import HelperFace from './HelperFace.svelte';
	import HelperHome from './HelperHome.svelte';
	import HelperMoment from './HelperMoment.svelte';
	import HelperPicks from './HelperPicks.svelte';
	import HelperProgress from './HelperProgress.svelte';
	import HelperReview from './HelperReview.svelte';
	import HelperWrite from './HelperWrite.svelte';
	import IconButton from './ui/IconButton.svelte';
	import { cn } from './ui/cn';
	import Pages from './ui/Pages.svelte';

	interface Props {
		helper: HelperStore;
		onclose?: () => void;
		autofocus?: boolean;
		class?: string;
	}

	let { helper, onclose, autofocus = false, class: className }: Props = $props();

	const view = $derived<HelperPage | 'moment'>(helper.moment ? 'moment' : helper.page);
	const goal = $derived(helper.data.goal.trim());

	const heading = $derived.by((): { title: string; sub: string } => {
		if (view === 'today') return { title: "Today's three", sub: 'From different pillars' };
		if (view === 'week') return { title: 'This week', sub: 'One per pillar, quiet ones first' };
		if (view === 'progress') return { title: 'How it is going', sub: 'The last 7 days, from your ticks' };
		if (view === 'review') return { title: 'Weak lines', sub: 'Lines that cannot be ticked, or are not yours to do' };
		if (view === 'write') return { title: 'Fill chart using a prompt', sub: 'I write the prompt, a chat app writes the lines' };
		return { title: 'Bindu', sub: goal ? `Reading “${goal}”` : 'Your chart helper, on this device' };
	});

	let root: HTMLDivElement | null = $state(null);
	/** Where focus goes after a page turn: into the new page, or back to the door it came out of. */
	let previous: HelperPage | 'moment' | null = null;
	$effect(() => {
		const current = view;
		if (previous === null) previous = current;
		if (current === previous) return;
		const from = previous;
		previous = current;
		void tick().then(() => {
			if (!root?.contains(document.activeElement) && document.activeElement !== document.body) return;
			const page = root?.querySelector<HTMLElement>(`[data-view="${current}"]`);
			if (current === 'moment') page?.querySelector<HTMLElement>('[data-autofocus]')?.focus({ preventScroll: true });
			else if (current === 'home') (page?.querySelector<HTMLElement>(`[data-door="${from}"]`) ?? page)?.focus({ preventScroll: true });
			else root?.querySelector<HTMLElement>('[data-back]')?.focus({ preventScroll: true });
		});
	});

	function onkeydown(event: KeyboardEvent): void {
		if (event.key !== 'Escape') return;
		event.stopPropagation();
		if (helper.moment) helper.finish();
		else if (helper.page !== 'home') helper.back();
		else onclose?.();
	}

	/** A chart reply pasted anywhere in the panel lands on the write page, ready to keep. */
	function onpaste(event: ClipboardEvent): void {
		const target = event.target as HTMLElement | null;
		if (target?.dataset.reply !== undefined) return;
		const text = event.clipboardData?.getData('text') ?? '';
		if (helper.receive(text)) event.preventDefault();
	}

	/** Shows a cell on the chart. On a phone the panel covers the chart, so it steps aside. */
	function reveal(key: string): void {
		helper.showCell(key);
		if (onclose && window.matchMedia('(max-width: 900px)').matches) onclose();
	}

	function focusOnMount(node: HTMLElement): void {
		if (autofocus) requestAnimationFrame(() => node.focus({ preventScroll: true }));
	}
</script>

<div
	bind:this={root}
	class={cn('flex min-h-0 flex-col overflow-hidden rounded-[28px] bg-surface text-text outline-none', className)}
	role="dialog"
	tabindex="-1"
	aria-label="Bindu"
	data-helper
	{onkeydown}
	{onpaste}
	{@attach focusOnMount}
>
	<header class="flex shrink-0 items-center gap-1 ps-2.5 pe-2 pt-2.5 pb-1.5">
		<!-- The back button opens out from nothing, so the face slides over to make room. -->
		<div
			class={cn(
				'grid motion-safe:transition-[grid-template-columns,opacity] motion-safe:duration-300 motion-safe:ease-[cubic-bezier(0.16,1,0.3,1)]',
				view !== 'home' && view !== 'moment' ? 'grid-cols-[1fr]' : 'grid-cols-[0fr] opacity-0'
			)}
		>
			<!-- Clipped with room for the focus ring. -->
			<div class="min-w-0 overflow-clip [overflow-clip-margin:4px]">
				<IconButton
					data-back
					icon="arrow-left"
					label="Back"
					inert={view === 'home' || view === 'moment'}
					onclick={() => helper.back()}
				/>
			</div>
		</div>
		<HelperFace mood={helper.mood} size={40} class="mx-1.5 shrink-0" />
		<div class="grid min-w-0 flex-1">
			{#key heading.title}
				<div class="min-w-0 [grid-area:1/1]" in:fade={{ duration: 220, delay: 60 }} out:fade={{ duration: 120 }}>
					<h2 class="m-0 truncate text-[1.02rem] leading-tight font-[620]">{heading.title}</h2>
					<p class="m-0 mt-0.5 truncate text-[0.8rem] leading-snug text-muted">{heading.sub}</p>
				</div>
			{/key}
		</div>
		{#if onclose}
			<IconButton icon="close" label="Close Bindu" onclick={onclose} />
		{/if}
	</header>

	<Pages view={view} direction={helper.direction} label={heading.title} pageClass="pt-1">
		{#snippet page(current)}
			{#if current === 'moment' && helper.moment}
				<HelperMoment moment={helper.moment} ondone={() => helper.finish()} />
			{:else if current === 'today' || current === 'week'}
				<HelperPicks {helper} />
			{:else if current === 'progress'}
				<HelperProgress {helper} {reveal} />
			{:else if current === 'review'}
				<HelperReview {helper} {reveal} />
			{:else if current === 'write'}
				<HelperWrite {helper} />
			{:else}
				<HelperHome {helper} {reveal} />
			{/if}
		{/snippet}
	</Pages>
</div>
