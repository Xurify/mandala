<script lang="ts">
	import type { HelperStore } from '$lib/chart/helper.svelte';
	import HelperFace from './HelperFace.svelte';
	import HelperPanel from './HelperPanel.svelte';
	import { noteOut } from './ui/motion';

	interface Props {
		helper: HelperStore;
	}

	let { helper }: Props = $props();

	let launcher: HTMLButtonElement | null = $state(null);

	function close(): void {
		helper.hide();
		launcher?.focus();
	}
</script>

{#if helper.open}
	<div
		class="fixed end-[max(20px,env(safe-area-inset-right,20px))] bottom-[calc(max(18px,env(safe-area-inset-bottom,18px))+70px)] z-50 flex h-[min(640px,calc(100dvh-132px))] w-[min(400px,calc(100vw-32px))] origin-bottom-right motion-safe:animate-note-in print:hidden max-[900px]:inset-x-2.5 max-[900px]:bottom-[max(10px,env(safe-area-inset-bottom,10px))] max-[900px]:h-[min(82dvh,640px)] max-[900px]:w-auto"
		out:noteOut
	>
		<HelperPanel {helper} onclose={close} autofocus class="w-full shadow-float" />
	</div>
{/if}

<button
	bind:this={launcher}
	type="button"
	class="group/launcher fixed end-[max(20px,env(safe-area-inset-right,20px))] bottom-[max(18px,env(safe-area-inset-bottom,18px))] z-40 grid size-[56px] cursor-pointer place-items-center rounded-full border-0 bg-surface p-0 shadow-float motion-safe:transition-[translate,scale,opacity] motion-safe:duration-200 motion-safe:ease-ui can-hover:hover:-translate-y-0.5 active:scale-[0.97] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink print:hidden max-[900px]:bottom-[calc(max(18px,env(safe-area-inset-bottom,18px))+66px)] max-[900px]:size-[50px] {helper.open ? 'max-[900px]:pointer-events-none max-[900px]:opacity-0' : ''}"
	aria-label={helper.open ? 'Close Bindu' : helper.unread ? 'Talk to Bindu, new reply' : 'Talk to Bindu'}
	aria-expanded={helper.open}
	title="Talk to Bindu"
	onclick={() => (helper.open ? close() : helper.show())}
>
	<HelperFace mood={helper.mood} size={42} class="max-[900px]:size-[38px]" />
	{#if helper.unread && !helper.open}
		<span
			class="absolute end-0.5 top-0.5 size-3 rounded-full bg-ink shadow-[0_0_0_2.5px_var(--surface)] motion-safe:animate-pop-in"
			aria-hidden="true"
		></span>
	{/if}
</button>
