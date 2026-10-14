<script lang="ts">
	import type { HelperOffer, HelperStore } from '$lib/chart/helper.svelte';
	import HelperDraft from './HelperDraft.svelte';

	let { helper }: { helper: HelperStore } = $props();

	// Held past Keep, so the page fading out under the moment still shows what was kept.
	let held: HelperOffer | null = null;
	const draft = $derived.by(() => {
		if (helper.offer) held = helper.offer;
		return held;
	});
</script>

<div class="flex flex-col gap-3 px-4 pt-1 pb-4">
	<p class="m-0 text-[0.84rem] leading-snug text-pretty text-muted">
		{draft?.kind === 'chart' ? 'Nothing opens until you keep it.' : 'Nothing is written until you keep it. Your other lines stay as they are.'}
	</p>
	{#if draft}
		<HelperDraft data={helper.data} {draft} onkeep={() => helper.keepOffer()} aside="Not now" onaside={() => helper.back()} />
	{/if}
</div>
