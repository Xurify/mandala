<script lang="ts">
	import type { Snippet } from 'svelte';
	import { cn } from './cn';
	import { notice } from './styles';

	type Props = {
		children: Snippet;
		action?: Snippet;
		class?: string;
	};

	let { children, action, class: className }: Props = $props();
</script>

<div class={cn(notice(), className)}>
	<span>{@render children()}</span>
	{#if action}
		{@render action()}
	{/if}
</div>
