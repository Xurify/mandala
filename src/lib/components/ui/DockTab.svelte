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
		<!-- On a phone only the open tab shows its name, so the dock fits; the rest keep it for screen readers and the title. -->
		<span class={cn(icon && !selected && 'max-[420px]:sr-only')}>{@render children()}</span>
	{/if}
</button>
