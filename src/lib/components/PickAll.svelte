<script lang="ts">
	import PickMark from './PickMark.svelte';

	type Props = {
		total: number;
		picked: number;
		label?: string;
		disabled?: boolean;
		onclick: () => void;
	};

	let { total, picked, label = 'Select all', disabled = false, onclick }: Props = $props();

	const all = $derived(total > 0 && picked === total);
	const words = $derived(all ? (total === 1 ? '1 selected' : `All ${total} selected`) : picked > 0 ? `${picked} of ${total} selected` : label);
</script>

<div class="sticky top-0 z-10 bg-surface pb-1">
	<button
		type="button"
		class="group flex min-h-[44px] w-full cursor-pointer items-center gap-3 rounded-[14px] border-0 bg-transparent px-3 py-1.5 text-start select-none hover:bg-sunken focus-visible:bg-sunken focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink disabled:pointer-events-none disabled:opacity-40 coarse:min-h-12"
		role="checkbox"
		aria-checked={all ? true : picked > 0 ? 'mixed' : false}
		{disabled}
		{onclick}
	>
		<PickMark on={all} mixed={picked > 0 && !all} />
		<span class="text-[0.86rem] font-[560] text-text tabular-nums">{words}</span>
	</button>
</div>
