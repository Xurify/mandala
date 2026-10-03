<script lang="ts">
	import type { Snippet } from 'svelte';
	import Icon, { type IconName } from '../Icon.svelte';
	import { cn } from './cn';
	import { getMenu } from './menu';
	import { menuItem } from './styles';

	type Props = {
		children: Snippet;
		icon?: IconName;
		badge?: string;
		shortcut?: string;
		tone?: 'default' | 'danger';
		active?: boolean;
		id?: string;
		class?: string;
		onclick?: (event: MouseEvent) => void;
	};

	let {
		children,
		icon,
		badge,
		shortcut,
		tone = 'default',
		active = false,
		id,
		class: className,
		onclick
	}: Props = $props();

	const menu = getMenu();
	const styles = $derived(menuItem({ tone, active }));

	function onClick(event: MouseEvent): void {
		onclick?.(event);
		if (!event.defaultPrevented) menu?.close();
	}
</script>

<button
	type="button"
	role="menuitem"
	{id}
	class={cn(styles.base(), className)}
	aria-current={active ? 'true' : undefined}
	onclick={onClick}
>
	<span class={styles.main()}>
		{#if icon}
			<Icon name={icon} size={16} class={styles.icon()} />
		{/if}
		{@render children()}
	</span>
	{#if badge}
		<span class={styles.badge()}>{badge}</span>
	{/if}
	{#if shortcut}
		<kbd class={cn(styles.badge(), 'coarse:hidden')}>{shortcut}</kbd>
	{/if}
</button>
