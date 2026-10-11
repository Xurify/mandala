<script lang="ts">
	let { on }: { on: boolean } = $props();
</script>

<span
	class="flex size-4 shrink-0 items-center justify-center rounded-[5px] motion-safe:transition-colors motion-safe:duration-150 {on
		? 'bg-accent text-on-accent'
		: 'shadow-[inset_0_0_0_1.5px_var(--line)] group-hover:shadow-[inset_0_0_0_1.5px_var(--muted)]'}"
	aria-hidden="true"
>
	{#if on}
		<svg class="block" width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
			<path
				d="M3.45 8.95 6.2 11.7 12.45 5.35"
				stroke="currentColor"
				stroke-width="2.25"
				stroke-linecap="round"
				stroke-linejoin="round"
			/>
		</svg>
	{/if}
</span>
