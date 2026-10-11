<script lang="ts">
	import type { Tool } from '$lib/chart/model';
	import { hostOf, thumbnailOf, videoId } from '$lib/chart/tools';
	import Icon from './Icon.svelte';
	import { cn } from './ui/cn';

	interface Props {
		tool: Pick<Tool, 'url' | 'title' | 'kind' | 'known'>;
		/** `sm` is a row in a list; `md` is a card's face. */
		size?: 'sm' | 'md';
		class?: string;
	}

	let { tool, size = 'sm', class: className }: Props = $props();

	const picture = $derived(thumbnailOf(tool.url));
	const host = $derived(hostOf(tool.url));
	const short = $derived(/\/shorts\//.test(tool.url));
	// Built as one string: Svelte trims the space at the start of a block, so pieces would run together.
	const caption = $derived(
		[videoId(tool.url) ? (short ? 'YouTube short' : 'YouTube') : host, tool.known ? 'known' : tool.kind === 'once' ? 'once' : null].filter(Boolean).join(' · ')
	);
</script>

<!-- A tool's face: the video's own picture when it has one, the site's name when it does not. -->
<span class={cn('flex min-w-0 items-center gap-3', className)}>
	<span
		class={cn(
			'relative shrink-0 overflow-hidden rounded-[10px] bg-sunken',
			size === 'sm' ? 'h-9 w-16' : 'h-[54px] w-24',
			tool.known && 'opacity-55'
		)}
		aria-hidden="true"
	>
		{#if picture}
			<img src={picture} alt="" class={cn('size-full object-cover', short && 'object-top')} loading="lazy" decoding="async" />
			<span class="absolute inset-0 grid place-items-center">
				<span class="grid size-5 place-items-center rounded-full bg-[oklch(0.2_0.02_60/0.7)] text-[oklch(0.99_0_0)]">
					<svg viewBox="0 0 10 10" class="ms-px size-2.5 fill-current"><path d="M2 1.2v7.6L8.4 5z" /></svg>
				</span>
			</span>
		{:else}
			<span class="grid size-full place-items-center text-muted"><Icon name="link" size={size === 'sm' ? 14 : 18} /></span>
		{/if}
	</span>
	<span class="flex min-w-0 flex-1 flex-col gap-0.5">
		<span class={cn('truncate leading-snug font-[560]', size === 'sm' ? 'text-[0.9rem]' : 'text-[0.95rem]', tool.known && 'text-muted')}>{tool.title || host}</span>
		<span class="truncate text-[0.74rem] leading-none text-muted">{caption}</span>
	</span>
</span>
