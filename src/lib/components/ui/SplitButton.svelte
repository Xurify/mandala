<script lang="ts">
	import type { Snippet } from 'svelte';
	import Icon, { type IconName } from '../Icon.svelte';
	import Menu from './Menu.svelte';
	import { cn } from './cn';
	import { button, splitButton } from './styles';

	type Props = {
		children: Snippet;
		label: Snippet;
		menuLabel: string;
		icon?: IconName;
		variant?: 'primary' | 'soft';
		size?: 'md' | 'sm';
		disabled?: boolean;
		class?: string;
		onclick?: (event: MouseEvent) => void;
	};

	let { children, label, menuLabel, icon, variant = 'soft', size = 'md', disabled = false, class: className, onclick }: Props = $props();
	const styles = $derived(splitButton({ size }));
	const buttonClass = $derived(button({ variant, size }));
</script>

<Menu align="start" label={menuLabel} float class={className}>
	{#snippet trigger({ expanded, toggle })}
		<span class={styles.wrap()}>
			<button type="button" class={cn(buttonClass, styles.main())} {disabled} {onclick}>
				{#if icon}<Icon name={icon} size={size === 'sm' ? 16 : 18} />{/if}{@render label()}
			</button>
			<button
				type="button"
				class={cn(buttonClass, styles.toggle())}
				aria-label={menuLabel}
				aria-haspopup="menu"
				aria-expanded={expanded}
				{disabled}
				onclick={toggle}
			>
				<Icon name="chevron-down" size={16} class={cn('motion-safe:transition-transform motion-safe:duration-150 motion-safe:ease-ui', expanded && 'rotate-180')} />
			</button>
		</span>
	{/snippet}
	{@render children()}
</Menu>
