<script lang="ts">
	import type { Snippet } from 'svelte';
	import { cn } from './cn';
	import { card } from './styles';

	type Props = {
		children: Snippet;
		class?: string;
	};

	let { children, class: className }: Props = $props();
</script>

<div class={cn(card(), className)}>
	{@render children()}
</div>
