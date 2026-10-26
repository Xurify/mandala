<script lang="ts">
	import type { Snippet } from 'svelte';
	import Icon, { type IconName } from '../Icon.svelte';
	import { cn } from './cn';
	import { getMenu } from './menu';
	import { menuItem } from './styles';

	type Props = {
		children: Snippet;
		icon?: IconName;
		iconSize?: number;
		badge?: string;
		count?: number;
		shortcut?: string;
		tone?: 'default' | 'danger';
		active?: boolean;
		checked?: boolean;
		id?: string;
		class?: string;
		onclick?: (event: MouseEvent) => void;
	};

	let {
		children,
		icon,
		iconSize,
		badge,
		count,
		shortcut,
		tone = 'default',
		active = false,
		checked = false,
		id,
		class: className,
		onclick
	}: Props = $props();

	const menu = getMenu();
	const styles = $derived(menuItem({ tone, active }));
	const effectiveIconSize = $derived(iconSize ?? (icon === 'bindu' ? 20 : 18));

	function onClick(event: MouseEvent): void {
		onclick?.(event);
		if (!event.defaultPrevented) menu?.close();
	}
</script>

<button
	type="button"
	role="menuitem"
	tabindex={-1}
	{id}
	class={cn(styles.base(), className)}
	aria-current={active || checked ? 'true' : undefined}
	onclick={onClick}
>
	<span class={styles.main()}>
		{#if icon}
			<Icon name={icon} size={effectiveIconSize} class={styles.icon()} />
		{/if}
		{@render children()}
	</span>
	{#if badge}
		<span class={styles.badge()}>{badge}</span>
	{/if}
	{#if count}
		<span class={styles.count()}>{count}</span>
	{/if}
	{#if shortcut}
		<kbd class={cn(styles.badge(), 'min-w-5 text-center coarse:hidden')}>{shortcut}</kbd>
	{/if}
	{#if checked}
		<Icon name="check" size={16} class="shrink-0 text-text" />
	{/if}
</button>
