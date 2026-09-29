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
		tone?: 'default' | 'danger';
		active?: boolean;
		class?: string;
		onclick?: (event: MouseEvent) => void;
	};

	let {
		children,
		icon,
		badge,
		tone = 'default',
		active = false,
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

<button type="button" role="menuitem" class={cn(styles.base(), className)} onclick={onClick}>
	<span class={styles.main()}>
		{#if icon}
			<Icon name={icon} size={16} class={styles.icon()} />
		{/if}
		{@render children()}
	</span>
	{#if badge}
		<span class={styles.badge()}>{badge}</span>
	{/if}
</button>
