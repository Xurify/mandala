<script lang="ts">
	import type { Snippet } from 'svelte';
	import type { HTMLButtonAttributes } from 'svelte/elements';
	import Icon, { type IconName } from '../Icon.svelte';
	import { cn } from './cn';
	import { dockTab } from './styles';

	type Props = Omit<HTMLButtonAttributes, 'role' | 'aria-selected' | 'class'> & {
		selected?: boolean;
		icon?: IconName;
		class?: string;
		children?: Snippet;
	};

	let { selected = false, icon, class: className, children, type, ...rest }: Props = $props();
</script>

<button
	type={type ?? 'button'}
	role="tab"
	aria-selected={selected}
	class={cn(dockTab(), className)}
	{...rest}
>
	{#if icon}
		<Icon name={icon} size={16} />
	{/if}
	{#if children}
		{@render children()}
	{/if}
</button>
