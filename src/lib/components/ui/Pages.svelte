<script lang="ts">
	import { onMount, type Snippet } from 'svelte';
	import { cn } from './cn';
	import { pageIn, pageOut } from './motion';

	type Props = {
		/** The page in view. A new value turns to it. */
		view: string;
		/** 1 turns forward, so the new page comes in from the right. -1 turns back. */
		direction?: number;
		/** The accessible name of the page in view. */
		label?: string;
		page: Snippet<[string]>;
		class?: string;
		pageClass?: string;
	};

	let { view, direction = 1, label, page, class: className, pageClass }: Props = $props();

	let viewport = $state<HTMLDivElement | null>(null);
	/** The height of the page in view. The viewport eases to it, so a turn changes size smoothly. */
	let height = $state<number | null>(null);
	let settled = $state(false);

	onMount(() => {
		const frame = requestAnimationFrame(() => (settled = true));
		return () => cancelAnimationFrame(frame);
	});

	$effect(() => {
		void view;
		viewport?.scrollTo({ top: 0 });
	});

	function measure(node: HTMLElement): () => void {
		const update = (): void => {
			// The page that is leaving keeps its size until it is gone; only the arriving one sets the height.
			if (node.dataset.view === view) height = node.offsetHeight;
		};
		const observer = new ResizeObserver(update);
		observer.observe(node);
		update();
		return () => observer.disconnect();
	}
</script>

<div
	bind:this={viewport}
	class={cn(
		'min-h-0 shrink overflow-x-hidden overflow-y-auto overscroll-contain',
		settled && 'motion-safe:transition-[height] motion-safe:duration-[420ms] motion-safe:ease-[cubic-bezier(0.16,1,0.3,1)]',
		className
	)}
	style:height={height === null ? undefined : `${height}px`}
>
	<div class="grid">
		{#key view}
			<section
				class={cn('min-w-0 self-start [grid-area:1/1] focus:outline-none', pageClass)}
				data-view={view}
				tabindex="-1"
				aria-label={label}
				in:pageIn={{ direction }}
				out:pageOut={{ direction }}
				{@attach measure}
			>
				{@render page(view)}
			</section>
		{/key}
	</div>
</div>
