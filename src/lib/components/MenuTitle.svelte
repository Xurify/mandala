<script lang="ts">
	import { onMount } from 'svelte';
	import Icon from './Icon.svelte';

	type Props = {
		title: string;
		label: string;
		expanded: boolean;
		onclick: () => void;
		/** Something waits behind the menu: an ink dot on the chevron. */
		dot?: boolean;
	};

	let { title, label, expanded, onclick, dot = false }: Props = $props();

	const LINES = 2;
	const type =
		'font-serif text-[clamp(1.85rem,3.4vw,2.55rem)] leading-[1.12] font-[460] tracking-[-0.015em] max-[900px]:text-[clamp(1.7rem,7.2vw,2.15rem)]';
	const knob = 'ms-[0.35em] size-[34px] translate-y-[-0.06em] align-middle max-[900px]:size-[30px]';

	let width = $state(0);
	let fonts = $state(0);
	let probe = $state<HTMLSpanElement | null>(null);
	/** Where a title too long for two lines is cut, so the chevron after it stays in view. */
	let cut = $state<number | null>(null);

	const shown = $derived(cut === null ? title : `${title.slice(0, cut).trimEnd()}…`);
	/** The chevron rides on the last word, so it never wraps to a line of its own. */
	const head = $derived(shown.slice(0, shown.lastIndexOf(' ') + 1));
	const tail = $derived(shown.slice(shown.lastIndexOf(' ') + 1));

	function lay(node: HTMLSpanElement, text: string): void {
		const space = text.lastIndexOf(' ');
		const last = document.createElement('span');
		last.className = 'whitespace-nowrap';
		const chevron = document.createElement('span');
		chevron.className = `inline-block ${knob}`;
		last.append(text.slice(space + 1), chevron);
		node.replaceChildren(text.slice(0, space + 1), last);
	}

	function fit(node: HTMLSpanElement, text: string): number | null {
		const line = parseFloat(getComputedStyle(node).lineHeight);
		const fits = (words: string): boolean => {
			lay(node, words);
			return node.offsetHeight <= line * (LINES + 0.5);
		};
		if (!line || fits(text)) return null;
		let low = 0;
		let high = text.length - 1;
		while (low < high) {
			const mid = Math.ceil((low + high) / 2);
			if (fits(`${text.slice(0, mid).trimEnd()}…`)) low = mid;
			else high = mid - 1;
		}
		// A cut between words reads better, when one is close.
		const space = text.lastIndexOf(' ', low);
		return space > 0 && space > low - 12 ? space : low;
	}

	$effect(() => {
		void fonts;
		if (!probe || width === 0) return;
		cut = fit(probe, title);
	});

	onMount(() => {
		void document.fonts?.ready.then(() => (fonts += 1));
	});
</script>

<h1 class="relative m-0 [font:inherit]" bind:clientWidth={width}>
	<button
		class="group inline-block max-w-full min-w-0 cursor-pointer rounded-[14px] border-0 bg-transparent py-0.5 ps-0 pe-1 -ms-1 text-start text-text focus-visible:outline-none {type}"
		type="button"
		aria-haspopup="menu"
		aria-expanded={expanded}
		aria-label={label}
		title={title}
		{onclick}
	>
		<span>
			{head}<span class="whitespace-nowrap"
				>{tail}<span
					class="relative inline-flex items-center justify-center rounded-full text-text bg-sunken group-hover:bg-sunken-hover group-focus-visible:bg-ink group-focus-visible:text-on-ink group-aria-expanded:bg-sunken-hover {knob}"
				>
					{#if dot}
						<span class="absolute -end-px -top-px size-2.5 rounded-full bg-ink ring-2 ring-bg motion-safe:animate-pop-in" aria-hidden="true"></span>
					{/if}
					<Icon
						name="chevron-down"
						size={16}
						strokeWidth={2}
						class="motion-safe:transition-transform motion-safe:duration-200 motion-safe:ease-[cubic-bezier(0.16,1,0.3,1)] group-aria-expanded:rotate-180"
					/>
				</span></span
			>
		</span>
	</button>
	<!-- Laid out off screen at the full width, word by word, to find where the title has to end. -->
	<span bind:this={probe} class="pointer-events-none invisible absolute start-0 top-0 block w-full ps-0 pe-1 {type}" aria-hidden="true"></span>
</h1>
