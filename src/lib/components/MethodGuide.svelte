<script lang="ts">
	import { HUES, info } from '$lib/chart/model';
	import Button from './ui/Button.svelte';
	import Dialog from './ui/Dialog.svelte';
	import { cn } from './ui/cn';

	let open = $state(false);
	let focusK = $state<number | null>(null);

	const mapCaption = $derived(
		focusK === null
			? 'Each color is one pillar. It sits beside the goal, then again at the center of its own block. The lighter cells are that pillar’s eight actions.'
			: `Pillar ${focusK + 1} is written next to the goal, then copied into the center of its block. The lighter cells around that center are its actions.`
	);

	const sampleHue = HUES[3];
	const linkClass =
		'text-text underline decoration-muted underline-offset-[3px] hover:decoration-text focus-visible:rounded-[2px] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink';

	let fromMouse = false;

	function pillarFromEvent(event: Event): number | null {
		const target = event.target;
		if (!(target instanceof Element)) return null;
		const marked = target.closest('[data-k]');
		if (!(marked instanceof HTMLElement) || marked.dataset.k === undefined) return null;
		const k = Number(marked.dataset.k);
		return Number.isInteger(k) ? k : null;
	}

	function trackPointer(event: PointerEvent): void {
		if (event.pointerType !== 'mouse') return;
		focusK = pillarFromEvent(event);
	}

	function clearPointer(event: PointerEvent): void {
		if (event.pointerType !== 'mouse') return;
		focusK = null;
	}

	function pressPointer(event: PointerEvent): void {
		fromMouse = event.pointerType === 'mouse';
	}

	function togglePillar(event: MouseEvent): void {
		if (fromMouse) return;
		const k = pillarFromEvent(event);
		focusK = k === null || focusK === k ? null : k;
	}

	$effect(() => {
		if (!open) focusK = null;
	});
</script>

<Button variant="ghost" icon="info" aria-haspopup="dialog" aria-expanded={open} onclick={() => (open = true)}>
	How it works
</Button>

<Dialog bind:open title="The Mandala Method">
	<figure class="m-0 mb-[18px] rounded-[22px] bg-bg px-4 pt-[18px] pb-3.5">
		<div
			class="mx-auto mb-3.5 grid w-[min(232px,100%)] grid-cols-3 gap-[5px]"
			aria-hidden="true"
			onpointerdown={pressPointer}
			onpointermove={trackPointer}
			onpointerleave={clearPointer}
			onclick={togglePillar}
		>
			{#each [0, 1, 2, 3, 4, 5, 6, 7, 8] as block (block)}
				<div class="grid grid-cols-3 gap-0.5">
					{#each [0, 1, 2, 3, 4, 5, 6, 7, 8] as cell (cell)}
						{@const cellInfo = info(block, cell)}
						{#if cellInfo.type === 'goal'}
							<span class="aspect-square cursor-default rounded-[28%] bg-ink"></span>
						{:else}
							<span
								class={cn(
									'aspect-square cursor-pointer rounded-[3px] pillar-action motion-safe:transition-opacity motion-safe:duration-150 motion-safe:ease-ui',
									cellInfo.type === 'pillar' && 'rounded-[28%] pillar-cell',
									focusK !== null && focusK !== cellInfo.k && 'opacity-[0.22]'
								)}
								data-k={cellInfo.k}
								style:--h={HUES[cellInfo.k]}
							></span>
						{/if}
					{/each}
				</div>
			{/each}
		</div>
		<figcaption>
			<p class="m-0 mb-2.5 text-[0.9rem]">{mapCaption}</p>
			<ul class="m-0 flex list-none flex-wrap items-center gap-x-4 gap-y-2 p-0 text-[0.8rem] font-semibold text-muted">
				<li class="flex items-center gap-1.5">
					<span class="size-3 shrink-0 rounded-[28%] bg-ink" aria-hidden="true"></span>
					<span>Goal</span>
				</li>
				<li class="flex items-center gap-1.5">
					<span class="size-3 shrink-0 rounded-[28%] pillar-cell" style:--h={sampleHue} aria-hidden="true"></span>
					<span>Pillar</span>
				</li>
				<li class="flex items-center gap-1.5">
					<span class="size-3 shrink-0 rounded-[3px] pillar-action" style:--h={sampleHue} aria-hidden="true"></span>
					<span>Action</span>
				</li>
			</ul>
		</figcaption>
	</figure>
	<p class="mb-2.5">
		A mandala chart is a goal-setting sheet. The 9×9 grid is nine 3×3 blocks. You build it once, as a
		plan, and keep it. You do not redraw it every day.
	</p>

	<h3 class="mt-[22px] mb-1.5 font-serif text-[1.1rem] font-[560] tracking-[-0.01em]">How it’s built</h3>
	<ol class="mb-2.5 list-decimal space-y-1.5 ps-5">
		<li>Write one goal in the center.</li>
		<li>Around it, name the eight pillars that would make that goal happen.</li>
		<li>Copy each pillar into the center of its own block.</li>
		<li>Around each pillar, write eight concrete actions or habits. That is 64.</li>
	</ol>
	<p class="mb-2.5">
		Empty lines are holes in the plan. Leave them empty until you know what belongs there.
	</p>
	<p class="mb-2.5">
		One chart is one direction. Keep a separate chart for each real aim, and switch between them.
	</p>

	<h3 class="mt-[22px] mb-1.5 font-serif text-[1.1rem] font-[560] tracking-[-0.01em]">Two tests</h3>
	<p class="mb-2.5">Every pillar and every action has to pass both.</p>
	<ul class="mb-2.5 list-disc space-y-1.5 ps-5">
		<li>
			<strong>It can be marked done.</strong> Done, or not done. “Study for 20 minutes” passes. “Do better”
			fails, because it never ends.
		</li>
		<li>
			<strong>It is yours to do.</strong> “Post one video on Tuesday” passes. “Get a million views”
			fails. A grade or a finish time can sit in the center. It does not belong in a pillar or an action.
		</li>
	</ul>

	<h3 class="mt-[22px] mb-1.5 font-serif text-[1.1rem] font-[560] tracking-[-0.01em]">How often you use it</h3>
	<ul class="mb-2.5 list-disc space-y-1.5 ps-5">
		<li>
			<strong>Setup.</strong> Once, usually in a single sitting. It often takes a few revisions.
		</li>
		<li>
			<strong>Review.</strong> Weekly, monthly, or quarterly. Retire what is now a habit, swap actions
			that are not happening, and move a pillar when the drivers of the goal have changed.
		</li>
		<li>
			<strong>Day to day.</strong> Leave the grid alone. Pull a few actions onto a normal list. The
			chart is the map. The list is the day.
		</li>
	</ul>
	<p class="mb-2.5">
		A single 3×3 is the smaller form, for working one pillar. It is not a daily rewrite of the full
		chart.
	</p>

	<h3 class="mt-5.5 mb-1.5 font-serif text-[1.1rem] font-[560] tracking-[-0.01em]">Ohtani’s sheet</h3>
	<p class="mb-2.5">
		Shohei Ohtani filled this same 9×9 as a
		<a
			class={linkClass}
			href="https://www.nippon.com/en/japan-topics/g01204/"
			target="_blank"
			rel="noopener noreferrer"
			>first-year at Hanamaki Higashi High School<span class="sr-only"> (opens in a new tab)</span></a
		>. The center goal was to be the No. 1 draft pick of all eight NPB clubs.
		<a
			class={linkClass}
			href="https://www.sponichi.co.jp/baseball/news/2013/02/02/gazo/G20130202005109500.html"
			target="_blank"
			rel="noopener noreferrer"
			>Sports Nippon<span class="sr-only"> (opens in a new tab)</span></a
		>
		printed the handwritten sheet in 2013. The eight pillars were body building, control,
		sharpness, 160 km/h, breaking balls, mental strength, character, and luck.
	</p>
	<p class="mb-0 text-muted">
		Takashi Harada, who created the Harada Method, calls that sheet the
		<a class={linkClass} href="https://harada-educate.jp/ow64/" target="_blank" rel="noopener noreferrer"
			>Open Window 64<span class="sr-only"> (opens in a new tab)</span></a
		>. The 64 is the number of actions, not an 8×8 grid. Coverage often calls the same page a
		mandala chart. The Harada Method is wider than the grid: it pairs this sheet with a
		longer-term goal page, daily routines, and reflection.
	</p>
</Dialog>
