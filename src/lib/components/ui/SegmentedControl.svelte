<script lang="ts">
	import Icon, { type IconName } from '../Icon.svelte';
	import { cn } from './cn';
	import { segmented } from './styles';

	export type SegmentOption = { value: string; label: string; icon?: IconName; title?: string };

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

	let track = $state<HTMLDivElement | null>(null);
	let thumbX = $state(0);
	let thumbW = $state(0);
	let thumbOn = $state(false);

	$effect(() => {
		const root = track;
		const current = value;
		if (!root) return;

		const measure = (): void => {
			const button = root.querySelector<HTMLButtonElement>(`[data-value="${CSS.escape(current)}"]`);
			if (!button || button.offsetWidth === 0) return;
			thumbX = button.offsetLeft;
			thumbW = button.offsetWidth;
			thumbOn = true;
		};

		measure();
		const observer = new ResizeObserver(measure);
		observer.observe(root);
		return () => observer.disconnect();
	});

	function pick(next: string): void {
		value = next;
		onchange?.(next);
	}
</script>

<div bind:this={track} class={cn(styles.group(), className)} role="group" aria-label={label}>
	{#if thumbOn}
		<span
			class="pointer-events-none absolute top-[3px] bottom-[3px] z-0 rounded-full bg-surface shadow-seg motion-safe:transition-[left,width] motion-safe:duration-[380ms] motion-safe:ease-[cubic-bezier(0.4,0,0.15,1)]"
			style:left="{thumbX}px"
			style:width="{thumbW}px"
			aria-hidden="true"
		></span>
	{/if}
	{#each options as option (option.value)}
		<button
			type="button"
			class={cn(styles.option(), !thumbOn && 'aria-pressed:bg-surface aria-pressed:shadow-seg')}
			data-value={option.value}
			aria-pressed={value === option.value}
			title={option.title}
			onclick={() => pick(option.value)}
		>
			{#if option.icon}
				<Icon name={option.icon} size={size === 'sm' ? 13 : 16} />
			{/if}
			<span>{option.label}</span>
		</button>
	{/each}
</div>
