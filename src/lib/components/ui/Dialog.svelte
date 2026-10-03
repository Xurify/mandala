<script lang="ts">
	import type { Snippet } from 'svelte';
	import { cn } from './cn';
	import IconButton from './IconButton.svelte';
	import { dialog } from './styles';

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
	const uid = $props.id();
	const styles = $derived(dialog({ size, footer: Boolean(footer) }));

	$effect(() => {
		const node = el;
		if (!node) return;
		if (open && !node.open) {
			node.showModal();
			// First control is Close. Focusing it paints a ring on open.
			node.focus({ preventScroll: true });
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
		<div class={styles.body()}>
			{@render children()}
		</div>
		{#if footer}
			<div class={styles.foot()}>
				{@render footer()}
			</div>
		{/if}
	</div>
</dialog>
