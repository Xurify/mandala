<script lang="ts">
	import type { Snippet } from 'svelte';
	import type { HTMLAttributes } from 'svelte/elements';
	import { cn } from './cn';
	import { card } from './styles';

	type Props = Omit<HTMLAttributes<HTMLDivElement>, 'class'> & {
		children: Snippet;
		class?: string;
	};

	let { children, class: className, ...rest }: Props = $props();
</script>

<div class={cn(card(), className)} {...rest}>
	{@render children()}
</div>
