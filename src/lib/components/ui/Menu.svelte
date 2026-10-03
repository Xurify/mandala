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
		onopenchange?: (open: boolean) => void;
	};

	let {
		children,
		trigger,
		align = 'end',
		label = 'More actions',
		class: className,
		onopenchange
	}: Props = $props();

	let expanded = $state(false);
	let root = $state<HTMLDivElement | null>(null);
	const styles = $derived(menu({ align }));

	function close(): void {
		if (!expanded) return;
		expanded = false;
		onopenchange?.(false);
		queueMicrotask(() => root?.querySelector<HTMLElement>('[aria-haspopup="menu"]')?.focus());
	}

	function toggle(): void {
		if (expanded) close();
		else {
			expanded = true;
			onopenchange?.(true);
		}
	}

	function menuItems(): HTMLElement[] {
		const panel = root?.querySelector<HTMLElement>('[role="menu"]');
		if (!panel) return [];
		return [...panel.querySelectorAll<HTMLElement>('[role="menuitem"]')];
	}

	function focusItem(item: HTMLElement | undefined): void {
		if (!item) return;
		item.focus();
		item.scrollIntoView({ block: 'nearest' });
	}

	function onKey(event: KeyboardEvent): void {
		if (!expanded || !root) return;
		if (!(event.target instanceof Node) || !root.contains(event.target)) return;
		if (event.altKey || event.ctrlKey || event.metaKey) return;

		if (event.key === 'Escape') {
			event.preventDefault();
			event.stopImmediatePropagation();
			close();
			return;
		}

		const items = menuItems();
		const field = root.querySelector<HTMLInputElement>('[data-menu-find]');
		const inField =
			event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement;
		const index = event.target instanceof HTMLElement ? items.indexOf(event.target) : -1;

		if (event.key === 'ArrowDown' || event.key === 'ArrowUp' || event.key === 'Home' || event.key === 'End') {
			if (inField && (event.key === 'Home' || event.key === 'End' || event.key === 'ArrowUp')) return;
			if (!items.length) return;
			let next: HTMLElement | undefined;
			if (event.key === 'Home') next = items[0];
			else if (event.key === 'End') next = items[items.length - 1];
			else if (event.key === 'ArrowDown') {
				next = inField || index < 0 || index === items.length - 1 ? items[0] : items[index + 1];
			} else if (index === 0 && field) next = field;
			else if (index <= 0) next = items[items.length - 1];
			else next = items[index - 1];
			event.preventDefault();
			event.stopPropagation();
			focusItem(next);
			return;
		}

		if (!field || inField || event.key.length !== 1) return;
		if (event.key === ' ' && event.target instanceof HTMLElement && event.target.closest('[role="menuitem"]')) {
			return;
		}
		event.preventDefault();
		event.stopPropagation();
		field.focus();
		field.value += event.key;
		field.dispatchEvent(new Event('input', { bubbles: true }));
	}

	setMenu({ close });
</script>

<svelte:window onkeydowncapture={onKey} />

<div class={cn(styles.wrap(), expanded && 'z-[60]', className)} bind:this={root}>
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
		<div class={styles.panel()} role="menu" aria-label={label}>
			{@render children()}
		</div>
	{/if}
</div>
