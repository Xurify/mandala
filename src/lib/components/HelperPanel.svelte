<script lang="ts">
	import { onMount, tick } from 'svelte';
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
	import { pageIn, pageOut } from './ui/motion';

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
		if (view === 'review') return { title: 'Review', sub: 'Can each line be ticked, by you?' };
		if (view === 'write') return { title: 'Write with a chat app', sub: 'I write the prompt, it writes the lines' };
		return { title: 'Bindu', sub: goal ? `Reading “${goal}”` : 'Your chart helper, on this device' };
	});

	let root: HTMLDivElement | null = $state(null);
	let viewport: HTMLDivElement | null = $state(null);
	/** The height of the page in view. The viewport eases to it, so a page turn changes size smoothly. */
	let height = $state<number | null>(null);
	let settled = $state(false);

	onMount(() => {
		const frame = requestAnimationFrame(() => (settled = true));
		return () => cancelAnimationFrame(frame);
	});

	function measure(node: HTMLElement): () => void {
		const update = (): void => {
			if (node.dataset.view === view) height = node.offsetHeight;
		};
		const observer = new ResizeObserver(update);
		observer.observe(node);
		update();
		return () => observer.disconnect();
	}

	/** Where focus goes after a page turn: into the new page, or back to the door it came out of. */
	let previous: HelperPage | 'moment' | null = null;
	$effect(() => {
		const current = view;
		if (previous === null) previous = current;
		if (current === previous) return;
		const from = previous;
		previous = current;
		viewport?.scrollTo({ top: 0 });
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
	class={cn('flex min-h-0 flex-col overflow-hidden rounded-[28px] bg-surface text-text', className)}
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

	<div
		bind:this={viewport}
		class={cn(
			'min-h-0 shrink overflow-x-hidden overflow-y-auto overscroll-contain',
			settled && 'motion-safe:transition-[height] motion-safe:duration-[420ms] motion-safe:ease-[cubic-bezier(0.16,1,0.3,1)]'
		)}
		style:height={height === null ? undefined : `${height}px`}
	>
		<div class="grid">
			{#key view}
				<section
					class="min-w-0 self-start pt-1 [grid-area:1/1] focus:outline-none"
					data-view={view}
					tabindex="-1"
					aria-label={heading.title}
					in:pageIn={{ direction: helper.direction }}
					out:pageOut={{ direction: helper.direction }}
					{@attach measure}
				>
					{#if view === 'moment' && helper.moment}
						<HelperMoment moment={helper.moment} ondone={() => helper.finish()} />
					{:else if view === 'today' || view === 'week'}
						<HelperPicks {helper} />
					{:else if view === 'progress'}
						<HelperProgress {helper} {reveal} />
					{:else if view === 'review'}
						<HelperReview {helper} {reveal} />
					{:else if view === 'write'}
						<HelperWrite {helper} />
					{:else}
						<HelperHome {helper} {reveal} />
					{/if}
				</section>
			{/key}
		</div>
	</div>
</div>
