<script lang="ts">
	import { HUES, info } from '$lib/chart/model';
	import Icon from './Icon.svelte';

	interface Props {
		open?: boolean;
		onopen?: () => void;
		onclose?: () => void;
	}

	let { open = false, onopen, onclose }: Props = $props();

	let dialogElement: HTMLDialogElement | null = $state(null);
	let triggerElement: HTMLButtonElement | null = $state(null);
	let focusK = $state<number | null>(null);

	const mapCaption = $derived(
		focusK === null
			? 'Each color is one pillar. It sits beside the goal, then again at the center of its own block. The lighter cells are that pillar’s eight actions.'
			: `Pillar ${focusK + 1} is written next to the goal, then copied into the center of its block. The lighter cells around that center are its actions.`
	);

	$effect(() => {
		const dialog = dialogElement;
		if (!dialog) return;
		if (open && !dialog.open) dialog.showModal();
		if (!open && dialog.open) dialog.close();
	});

	function requestClose(): void {
		focusK = null;
		onclose?.();
	}

	function handleDialogClose(): void {
		focusK = null;
		if (open) onclose?.();
		triggerElement?.focus();
	}

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

	function handleDialogClick(event: MouseEvent): void {
		if (event.target === dialogElement) requestClose();
	}
</script>

<button
	bind:this={triggerElement}
	type="button"
	class="method-link"
	onclick={() => onopen?.()}
	aria-haspopup="dialog"
	aria-expanded={open}
>
	<Icon name="info" size={14} />
	<span>How it works</span>
</button>

<dialog
	bind:this={dialogElement}
	class="method-dialog"
	aria-labelledby="method-title"
	onclick={handleDialogClick}
	onclose={handleDialogClose}
>
	<div class="method-sheet">
		<div class="method-head">
			<h2 id="method-title">The Mandala Method</h2>
			<button type="button" class="method-close" onclick={requestClose} aria-label="Close">
				<Icon name="close" size={16} />
			</button>
		</div>
		<div class="method-body">
			<figure class="method-map" class:is-active={focusK !== null}>
				<div
					class="method-map-grid"
					aria-hidden="true"
					onpointerdown={pressPointer}
					onpointermove={trackPointer}
					onpointerleave={clearPointer}
					onclick={togglePillar}
				>
					{#each [0, 1, 2, 3, 4, 5, 6, 7, 8] as block (block)}
						<div class="method-block">
							{#each [0, 1, 2, 3, 4, 5, 6, 7, 8] as cell (cell)}
								{@const cellInfo = info(block, cell)}
								{#if cellInfo.type === 'goal'}
									<span class="method-dot goal"></span>
								{:else}
									<span
										class="method-dot {cellInfo.type}"
										class:on={focusK === cellInfo.k}
										data-k={cellInfo.k}
										style:--h={HUES[cellInfo.k]}
									></span>
								{/if}
							{/each}
						</div>
					{/each}
				</div>
				<figcaption>
					<p class="method-map-caption">{mapCaption}</p>
					<ul class="method-legend">
						<li>
							<span class="method-swatch goal" aria-hidden="true"></span>
							<span>Goal</span>
						</li>
						<li>
							<span class="method-samples" aria-hidden="true">
								{#each HUES as hue (hue)}
									<span class="method-swatch pillar" style:--h={hue}></span>
								{/each}
							</span>
							<span>Pillar</span>
						</li>
						<li>
							<span class="method-samples" aria-hidden="true">
								{#each HUES as hue (hue)}
									<span class="method-swatch action" style:--h={hue}></span>
								{/each}
							</span>
							<span>Action</span>
						</li>
					</ul>
				</figcaption>
			</figure>
			<p>
				A mandala chart is a goal-setting sheet. The 9×9 grid is nine 3×3 blocks. You build it as a
				plan and keep it. You do not redraw it every day.
			</p>

			<h3>How it’s built</h3>
			<ol>
				<li>Write your main goal in the center cell of the center block.</li>
				<li>Fill the eight cells around it with the themes that would get you there.</li>
				<li>Copy each theme into the center of one surrounding block.</li>
				<li>
					Around each theme, write eight concrete actions or habits. That is 64 actions.
				</li>
			</ol>
			<p>
				The point is to break a vague ambition into themes, and the themes into things you can
				actually do. Empty cells show gaps in the plan.
			</p>

			<h3>How often you use it</h3>
			<ul>
				<li>
					<strong>Setup.</strong> Once, usually in a single sitting. It often takes a few revisions.
				</li>
				<li>
					<strong>Review.</strong> Weekly, monthly, or quarterly. Cross off what has become a habit,
					swap actions that are not working, and adjust themes when priorities shift.
				</li>
				<li>
					<strong>Day to day.</strong> Leave the grid alone. Pull one or a few actions into your
					normal to-do list or habit tracker. The chart is the map. The daily list is the route for
					that day.
				</li>
			</ul>
			<p>
				A single 3×3 is the smaller form of the same idea, for working through one theme. It is not a
				daily rewrite of the full chart.
			</p>

			<h3>Ohtani’s sheet</h3>
			<p>
				Shohei Ohtani filled this same 9×9 as a
				<a
					href="https://www.nippon.com/en/japan-topics/g01204/"
					target="_blank"
					rel="noopener noreferrer"
					>first-year at Hanamaki Higashi High School<span class="visually-hidden">
						(opens in a new tab)</span
					></a
				>. The center goal was to be the No. 1 draft pick of all eight NPB clubs.
				<a
					href="https://www.sponichi.co.jp/baseball/news/2013/02/02/gazo/G20130202005109500.html"
					target="_blank"
					rel="noopener noreferrer"
					>Sports Nippon<span class="visually-hidden"> (opens in a new tab)</span></a
				>
				printed the handwritten sheet in 2013. The eight themes were body building, control,
				sharpness, 160 km/h, breaking balls, mental strength, character, and luck.
			</p>
			<p class="method-note">
				Takashi Harada, who created the Harada Method, calls that sheet the
				<a href="https://harada-educate.jp/ow64/" target="_blank" rel="noopener noreferrer"
					>Open Window 64<span class="visually-hidden"> (opens in a new tab)</span></a
				>. The 64 is the number of actions, not an 8×8 grid. Coverage often calls the same page a
				mandala chart. The Harada Method is wider than the grid: it pairs this sheet with a
				longer-term goal page, daily routines, and reflection.
			</p>
		</div>
	</div>
</dialog>
