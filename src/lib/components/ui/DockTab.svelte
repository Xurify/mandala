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
	tabindex={selected ? undefined : -1}
	class={cn(dockTab(), className)}
	{...rest}
>
	{#if icon}
		<Icon name={icon} size={16} />
	{/if}
	{#if children}
		<span class={cn(icon && !selected && 'max-[500px]:sr-only')}>{@render children()}</span>
	{/if}
</button>
