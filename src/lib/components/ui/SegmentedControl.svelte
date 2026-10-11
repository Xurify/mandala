<script lang="ts">
	import Icon, { type IconName } from '../Icon.svelte';
	import { cn } from './cn';
	import { segmented } from './styles';

	export type SegmentOption = { value: string; label: string; icon?: IconName; title?: string; detail?: string };

	type Props = {
		options: SegmentOption[];
		value?: string;
		size?: 'md' | 'sm';
		label: string;
		/** The options switch what a panel shows, so they are tabs: `aria-selected`, and arrow keys move between them. */
		tabs?: boolean;
		class?: string;
		onchange?: (value: string) => void;
	};

	let {
		options,
		value = $bindable(''),
		size = 'md',
		label,
		tabs = false,
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

	function walk(event: KeyboardEvent): void {
		const step = event.key === 'ArrowRight' ? 1 : event.key === 'ArrowLeft' ? -1 : 0;
		if (!tabs || !step) return;
		event.preventDefault();
		const at = options.findIndex((option) => option.value === value);
		const next = options[(at + step + options.length) % options.length];
		if (!next) return;
		pick(next.value);
		track?.querySelector<HTMLButtonElement>(`[data-value="${CSS.escape(next.value)}"]`)?.focus();
	}
</script>

<div bind:this={track} class={cn(styles.group(), className)} role={tabs ? 'tablist' : 'group'} aria-label={label} onkeydown={walk}>
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
			class={cn(styles.option(), !thumbOn && 'aria-pressed:bg-surface aria-pressed:shadow-seg aria-selected:bg-surface aria-selected:shadow-seg')}
			data-value={option.value}
			role={tabs ? 'tab' : undefined}
			aria-pressed={tabs ? undefined : value === option.value}
			aria-selected={tabs ? value === option.value : undefined}
			tabindex={tabs && value !== option.value ? -1 : undefined}
			title={option.title}
			onclick={() => pick(option.value)}
		>
			{#if option.icon}
				<Icon name={option.icon} size={size === 'sm' ? 13 : 16} />
			{/if}
			<span class="translate-y-px">{option.label}</span>
			{#if option.detail}
				<span class="translate-y-px font-[520] tabular-nums opacity-70">{option.detail}</span>
			{/if}
		</button>
	{/each}
</div>
