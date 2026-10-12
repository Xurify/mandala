<script lang="ts">
	import type { HelperStore } from '$lib/chart/helper.svelte';
	import HelperFace from './HelperFace.svelte';
	import HelperPanel from './HelperPanel.svelte';
	import { noteOut } from './ui/motion';

	interface Props {
		helper: HelperStore;
		/** No launcher while the page offers Bindu's one job itself. An open panel still shows it, to close. */
		quiet?: boolean;
	}

	let { helper, quiet = false }: Props = $props();

	let launcher: HTMLButtonElement | null = $state(null);

	function close(): void {
		helper.hide();
		if (quiet) return;
		const launchers = [launcher, document.querySelector<HTMLElement>('[data-bindu-launcher]')];
		launchers.find((each) => each && each.getClientRects().length > 0)?.focus();
	}
</script>

{#if helper.open}
	<div
		class="fixed end-[max(20px,env(safe-area-inset-right,20px))] bottom-[calc(max(18px,env(safe-area-inset-bottom,18px))+70px)] z-50 flex max-h-[min(660px,calc(100dvh-132px))] w-[min(392px,calc(100vw-32px))] flex-col origin-bottom-right [view-transition-name:bindu-panel] motion-safe:animate-note-in print:hidden max-[900px]:inset-x-2.5 max-[900px]:bottom-[max(10px,env(safe-area-inset-bottom,10px))] max-[900px]:max-h-[min(86dvh,660px)] max-[900px]:w-auto"
		out:noteOut
	>
		<HelperPanel {helper} onclose={close} autofocus class="w-full shadow-float" />
	</div>
{/if}

{#if !quiet || helper.open}
<button
	bind:this={launcher}
	type="button"
	class="group/launcher fixed end-[max(20px,env(safe-area-inset-right,20px))] [view-transition-name:bindu-launcher] bottom-[max(18px,env(safe-area-inset-bottom,18px))] z-40 grid size-[56px] cursor-pointer place-items-center rounded-full border-0 bg-surface p-0 shadow-float motion-safe:transition-[translate,scale,opacity] motion-safe:duration-200 motion-safe:ease-ui can-hover:hover:-translate-y-0.5 active:scale-[0.97] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink print:hidden max-[900px]:hidden"
	aria-label={helper.open ? 'Close Bindu' : 'Open Bindu'}
	aria-expanded={helper.open}
	title="Bindu"
	onclick={() => (helper.open ? close() : helper.show())}
>
	<HelperFace mood={helper.mood} size={42} />
</button>
{/if}
