<script lang="ts">
	import type { Snippet } from 'svelte';
	import type { HTMLButtonAttributes } from 'svelte/elements';
	import Icon, { type IconName } from '../Icon.svelte';
	import { cn } from './cn';
	import { button } from './styles';

	type Props = Omit<HTMLButtonAttributes, 'class'> & {
		variant?: 'primary' | 'soft' | 'ghost' | 'danger';
		size?: 'md' | 'sm';
		icon?: IconName;
		href?: string;
		class?: string;
		children?: Snippet;
	};

	let {
		variant = 'primary',
		size = 'md',
		icon,
		href,
		class: className,
		children,
		type,
		...rest
	}: Props = $props();
</script>

<svelte:element
	this={href ? 'a' : 'button'}
	{href}
	type={href ? undefined : (type ?? 'button')}
	class={cn(button({ variant, size }), className)}
	{...rest}
>
	{#if icon}
		<Icon name={icon} size={size === 'sm' ? 16 : 18} />
	{/if}
	{#if children}
		{@render children()}
	{/if}
</svelte:element>
