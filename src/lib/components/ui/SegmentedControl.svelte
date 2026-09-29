<script lang="ts">
	import Icon, { type IconName } from '../Icon.svelte';
	import { cn } from './cn';
	import { segmented } from './styles';

	export type SegmentOption = { value: string; label: string; icon?: IconName };

	type Props = {
		options: SegmentOption[];
		value?: string;
		size?: 'md' | 'sm';
		label: string;
		class?: string;
		onchange?: (value: string) => void;
	};

	let {
		options,
		value = $bindable(''),
		size = 'md',
		label,
		class: className,
		onchange
	}: Props = $props();

	const styles = $derived(segmented({ size }));

	function pick(next: string): void {
		value = next;
		onchange?.(next);
	}
</script>

<div class={cn(styles.group(), className)} role="group" aria-label={label}>
	{#each options as option (option.value)}
		<button
			type="button"
			class={styles.option()}
			aria-pressed={value === option.value}
			onclick={() => pick(option.value)}
		>
			{#if option.icon}
				<Icon name={option.icon} size={size === 'sm' ? 13 : 16} />
			{/if}
			<span>{option.label}</span>
		</button>
	{/each}
</div>
