<script lang="ts">
	/** `mixed`: some of a list is picked, for the box that picks it all. */
	let { on, mixed = false }: { on: boolean; mixed?: boolean } = $props();
</script>

<span
	class="flex size-4 shrink-0 items-center justify-center rounded-[5px] motion-safe:transition-colors motion-safe:duration-150 {on || mixed
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
	{:else if mixed}
		<svg class="block" width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
			<path d="M4.5 8h7" stroke="currentColor" stroke-width="2.25" stroke-linecap="round" />
		</svg>
	{/if}
</span>
