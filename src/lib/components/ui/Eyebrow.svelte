<script lang="ts">
	import type { Snippet } from 'svelte';
	import { HUES } from '$lib/chart/model';
	import { cn } from './cn';
	import { eyebrow } from './styles';

	type Props = {
		children: Snippet;
		pip?: number | 'goal';
		class?: string;
	};

	let { children, pip, class: className }: Props = $props();
	const hue = $derived(typeof pip === 'number' ? HUES[pip] : undefined);
</script>

<p class={cn(eyebrow(), className)}>
	{#if pip === 'goal'}
		<span class="size-2 shrink-0 rounded-full bg-ink" aria-hidden="true"></span>
	{:else if hue !== undefined}
		<span class="pip size-2 shrink-0 rounded-full" style:--pip-h={hue} aria-hidden="true"></span>
	{/if}
	{@render children()}
</p>
