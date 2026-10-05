<script lang="ts">
	import type { HTMLAnchorAttributes } from 'svelte/elements';
	import BrandMark from './BrandMark.svelte';
	import { cn } from './ui/cn';

	let {
		class: className,
		onclick
	}: {
		class?: string;
		onclick?: HTMLAnchorAttributes['onclick'];
	} = $props();
</script>

<a
	href="/"
	class={cn(
		'flex h-[42px] min-w-0 shrink-0 cursor-pointer items-center gap-2.5 rounded-lg text-text no-underline transition-[opacity,transform] duration-150 ease-ui hover:opacity-90 active:scale-[0.98] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink',
		className
	)}
	aria-label="Mandala home"
	{onclick}
>
	<BrandMark />
	<span class="font-serif text-[1.3rem] leading-none font-[560] tracking-[-0.02em]">Mandala</span>
</a>
