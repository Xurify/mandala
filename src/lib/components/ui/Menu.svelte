<script lang="ts">
	import type { Snippet } from 'svelte';
	import IconButton from './IconButton.svelte';
	import { setMenu } from './menu';
	import { cn } from './cn';
	import { menu } from './styles';

	type TriggerArgs = { expanded: boolean; toggle: () => void };

	type Props = {
		children: Snippet;
		/** Sets aria-haspopup="menu" and aria-expanded. Without this, the trigger is an icon button. */
		trigger?: Snippet<[TriggerArgs]>;
		align?: 'start' | 'end';
		label?: string;
		class?: string;
	};

	let {
		children,
		trigger,
		align = 'end',
		label = 'More actions',
		class: className
	}: Props = $props();

	let expanded = $state(false);
	let root = $state<HTMLDivElement | null>(null);
	const styles = $derived(menu({ align }));

	function close(): void {
		if (!expanded) return;
		expanded = false;
		queueMicrotask(() => root?.querySelector<HTMLElement>('[aria-haspopup="menu"]')?.focus());
	}

	function toggle(): void {
		if (expanded) close();
		else expanded = true;
	}

	function onKey(event: KeyboardEvent): void {
		if (!expanded || event.key !== 'Escape') return;
		event.preventDefault();
		close();
	}

	setMenu({ close });
</script>

<svelte:window onkeydown={onKey} />

<div class={cn(styles.wrap(), expanded && 'z-[2]', className)} bind:this={root}>
	<div class={styles.trigger()}>
		{#if trigger}
			{@render trigger({ expanded, toggle })}
		{:else}
			<IconButton
				icon="more"
				{label}
				aria-haspopup="menu"
				aria-expanded={expanded}
				onclick={toggle}
			/>
		{/if}
	</div>
	{#if expanded}
		<div class={styles.backdrop()} aria-hidden="true" onclick={close}></div>
		<div class={styles.panel()} role="menu">
			{@render children()}
		</div>
	{/if}
</div>
