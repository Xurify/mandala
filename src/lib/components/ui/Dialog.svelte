<script lang="ts">
	import type { Snippet } from 'svelte';
	import { cn } from './cn';
	import IconButton from './IconButton.svelte';
	import { dialog, scrollFade } from './styles';

	type Props = {
		open?: boolean;
		title: string;
		description?: string;
		size?: 'md' | 'sm';
		children: Snippet;
		footer?: Snippet;
		class?: string;
		oncancel?: (event: Event) => void;
	};

	let {
		open = $bindable(false),
		title,
		description,
		size = 'md',
		children,
		footer,
		class: className,
		oncancel
	}: Props = $props();

	let el = $state<HTMLDialogElement | null>(null);
	let moreAbove = $state(false);
	let moreBelow = $state(false);
	const uid = $props.id();
	const styles = $derived(dialog({ size, footer: Boolean(footer) }));

	function watchScroll(node: HTMLElement): () => void {
		const update = () => {
			const leftover = node.scrollHeight - node.clientHeight - node.scrollTop;
			moreAbove = node.scrollTop > 8;
			moreBelow = leftover > 8;
		};
		update();
		node.addEventListener('scroll', update, { passive: true });
		const observer = new ResizeObserver(update);
		observer.observe(node);
		for (const child of node.children) observer.observe(child);
		const mutations = new MutationObserver(() => {
			for (const child of node.children) observer.observe(child);
			update();
		});
		mutations.observe(node, { childList: true });
		const frame = requestAnimationFrame(update);
		return () => {
			cancelAnimationFrame(frame);
			node.removeEventListener('scroll', update);
			observer.disconnect();
			mutations.disconnect();
		};
	}

	$effect(() => {
		const node = el;
		if (!node) return;
		if (open && !node.open) {
			node.showModal();
			// First control is Close, and focusing it paints a ring on open, so the panel takes focus. A dialog
			// whose answer is safe to give with Enter (it can be undone) marks that button `data-autofocus`.
			(node.querySelector<HTMLElement>('[data-autofocus]') ?? node).focus({ preventScroll: true });
		} else if (!open && node.open) node.close();
	});

	function onDialogClick(event: MouseEvent): void {
		if (event.target === event.currentTarget) open = false;
	}
</script>

<dialog
	bind:this={el}
	tabindex="-1"
	class={cn(styles.panel(), className)}
	aria-labelledby={uid}
	onclick={onDialogClick}
	oncancel={(event) => oncancel?.(event)}
	onclose={() => (open = false)}
>
	<div class={styles.sheet()}>
		<div class={styles.head()}>
			<div class="min-w-0">
				<h2 id={uid} class={styles.title()}>{title}</h2>
				{#if description}
					<p class={styles.sub()}>{description}</p>
				{/if}
			</div>
			<IconButton icon="close" label="Close" onclick={() => (open = false)} />
		</div>
		<div class="relative flex min-h-0 flex-1 flex-col">
			<div class={styles.body()} data-dialog-scroll {@attach watchScroll}>
				{@render children()}
			</div>
			<div class={scrollFade({ edge: 'top', on: moreAbove })} aria-hidden="true"></div>
			<div class={scrollFade({ edge: 'bottom', on: moreBelow })} aria-hidden="true"></div>
		</div>
		{#if footer}
			<div class={styles.foot()}>
				{@render footer()}
			</div>
		{/if}
	</div>
</dialog>
