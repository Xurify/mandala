<script lang="ts" module>
	import type { ActionMeta } from '$lib/chart/model';

	export type FocusAction = {
		key: string;
		text: string;
		meta: ActionMeta | undefined;
		pillarIndex: number;
		pillarName: string;
	};
</script>

<script lang="ts">
	import type { Snippet } from 'svelte';
	import type { Attachment } from 'svelte/attachments';
	import { chart } from '$lib/chart/chart.svelte';
	import { HUES, pillarActivityLast7 } from '$lib/chart/model';
	import Icon from './Icon.svelte';
	import Button from './ui/Button.svelte';
	import Eyebrow from './ui/Eyebrow.svelte';
	import { cn } from './ui/cn';

	type Props = {
		actions: FocusAction[];
		selected?: string[];
		max?: number;
		inset?: boolean;
		footer?: Snippet;
	};

	type DropTarget = number | 'day' | null;

	type Drag = {
		entry: FocusAction;
		x: number;
		y: number;
		w: number;
		h: number;
		dx: number;
		dy: number;
		over: DropTarget;
		returning: boolean;
	};

	let { actions, selected = $bindable([]), max = 3, inset = false, footer }: Props = $props();

	let root = $state<HTMLDivElement | null>(null);
	let limited = $state(false);
	let shaking = $state(false);
	let cursor = $state<number[]>(Array(8).fill(0));
	let flipDirection = $state<1 | -1>(1);
	let drag = $state<Drag | null>(null);
	let swallowClick = false;

	const groups = $derived.by(() => {
		const list = Array.from({ length: 8 }, (_, pillarIndex) => ({
			pillarIndex,
			pillarName: chart.data.pillars[pillarIndex]?.trim() || `Pillar ${pillarIndex + 1}`,
			actions: [] as FocusAction[]
		}));
		for (const entry of actions) list[entry.pillarIndex]?.actions.push(entry);
		return list;
	});

	const decks = $derived(
		groups.map((group) => {
			const deck = group.actions.filter((entry) => !selected.includes(entry.key));
			const at = deck.length > 0 ? (((cursor[group.pillarIndex] ?? 0) % deck.length) + deck.length) % deck.length : 0;
			return { ...group, deck, at, top: deck[at] };
		})
	);

	const picked = $derived(
		selected
			.map((key) => actions.find((entry) => entry.key === key))
			.filter((entry): entry is FocusAction => entry !== undefined)
	);

	const full = $derived(picked.length >= max);
	const dragging = $derived(drag !== null && !drag.returning);
	const landing = $derived.by(() => {
		if (!dragging || full || drag === null || drag.over === null) return null;
		if (drag.over === 'day' || !picked[drag.over]) return picked.length;
		return null;
	});
	const goal = $derived(chart.data.goal.trim());
	const COUNT_WORDS = ['zero', 'one', 'two', 'three', 'four', 'five'];
	const maxWord = $derived(COUNT_WORDS[max] ?? String(max));
	const SLOT_TILT = [-1.6, 1.1, -0.6, 0.9, -1.2];

	function toggle(key: string): void {
		if (swallowClick) return;
		if (selected.includes(key)) {
			selected = selected.filter((existing) => existing !== key);
			limited = false;
			return;
		}
		if (selected.length >= max) {
			limited = true;
			shaking = true;
			return;
		}
		selected = [...selected, key];
		limited = false;
	}

	function place(key: string, target: number | 'day'): boolean {
		const occupant = typeof target === 'number' ? picked[target] : undefined;
		if (occupant) {
			selected = selected.map((existing) => (existing === occupant.key ? key : existing));
			limited = false;
			return true;
		}
		if (selected.length >= max) {
			limited = true;
			shaking = true;
			return false;
		}
		selected = [...selected, key];
		limited = false;
		return true;
	}

	function dropTargetAt(x: number, y: number): DropTarget {
		const hit = document.elementFromPoint(x, y)?.closest<HTMLElement>('[data-drop]');
		if (!hit || !root?.contains(hit)) return null;
		return hit.dataset.slot === undefined ? 'day' : Number(hit.dataset.slot);
	}

	function finishDrag(target: DropTarget): void {
		const current = drag;
		if (!current) return;
		if (target !== null && place(current.entry.key, target)) {
			drag = null;
			return;
		}
		current.returning = true;
		current.dx = 0;
		current.dy = 0;
		current.over = null;
		setTimeout(() => {
			if (drag === current) drag = null;
		}, 260);
	}

	// Touch waits for a still press so a swipe keeps scrolling the page.
	function draggable(entry: FocusAction): Attachment<HTMLElement> {
		return (node) => {
			let pointerId = -1;
			let startX = 0;
			let startY = 0;
			let armed = false;
			let timer = 0;

			const begin = (): void => {
				const rect = node.getBoundingClientRect();
				armed = true;
				drag = { entry, x: rect.left, y: rect.top, w: rect.width, h: rect.height, dx: 0, dy: 0, over: null, returning: false };
				node.setPointerCapture(pointerId);
				navigator.vibrate?.(8);
			};

			const down = (event: PointerEvent): void => {
				if (event.button !== 0 || drag) return;
				pointerId = event.pointerId;
				startX = event.clientX;
				startY = event.clientY;
				armed = false;
				if (event.pointerType === 'touch') timer = window.setTimeout(begin, 220);
			};

			const move = (event: PointerEvent): void => {
				if (event.pointerId !== pointerId) return;
				const dx = event.clientX - startX;
				const dy = event.clientY - startY;
				if (!armed) {
					if (Math.hypot(dx, dy) < 6) return;
					if (event.pointerType === 'touch') {
						clearTimeout(timer);
						pointerId = -1;
						return;
					}
					begin();
				}
				if (!drag) return;
				drag.dx = dx;
				drag.dy = dy;
				drag.over = dropTargetAt(event.clientX, event.clientY);
			};

			const up = (event: PointerEvent): void => {
				if (event.pointerId !== pointerId) return;
				clearTimeout(timer);
				pointerId = -1;
				if (!armed) return;
				armed = false;
				swallowClick = true;
				setTimeout(() => (swallowClick = false));
				finishDrag(event.type === 'pointerup' ? dropTargetAt(event.clientX, event.clientY) : null);
			};

			const holdStill = (event: Event): void => {
				if (armed) event.preventDefault();
			};

			node.addEventListener('pointerdown', down);
			node.addEventListener('pointermove', move);
			node.addEventListener('pointerup', up);
			node.addEventListener('pointercancel', up);
			node.addEventListener('touchmove', holdStill, { passive: false });
			node.addEventListener('contextmenu', holdStill);
			return () => {
				clearTimeout(timer);
				node.removeEventListener('pointerdown', down);
				node.removeEventListener('pointermove', move);
				node.removeEventListener('pointerup', up);
				node.removeEventListener('pointercancel', up);
				node.removeEventListener('touchmove', holdStill);
				node.removeEventListener('contextmenu', holdStill);
			};
		};
	}

	function flip(pillarIndex: number, step: 1 | -1): void {
		flipDirection = step;
		cursor[pillarIndex] = (cursor[pillarIndex] ?? 0) + step;
	}

	function onCardKey(event: KeyboardEvent, pillarIndex: number): void {
		if (event.key === 'ArrowRight') flip(pillarIndex, 1);
		else if (event.key === 'ArrowLeft') flip(pillarIndex, -1);
		else return;
		event.preventDefault();
	}

	function suggest(): void {
		const activity = pillarActivityLast7(chart.data);
		const order = [...decks]
			.filter((group) => group.deck.length > 0)
			.sort((a, b) => (activity[a.pillarIndex] ?? 0) - (activity[b.pillarIndex] ?? 0) || a.pillarIndex - b.pillarIndex);
		const next = [...selected];
		for (const group of order) {
			if (next.length >= max) break;
			if (next.some((key) => group.actions.some((entry) => entry.key === key))) continue;
			const choice =
				(group.top && !group.top.meta?.done ? group.top : undefined) ??
				group.deck.find((entry) => !entry.meta?.done) ??
				group.top;
			if (choice) next.push(choice.key);
		}
		for (const group of order) {
			if (next.length >= max) break;
			const choice = group.deck.find((entry) => !next.includes(entry.key));
			if (choice) next.push(choice.key);
		}
		selected = next;
		limited = false;
	}

	const focusRing = 'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink';
	const grab = 'touch-manipulation select-none [-webkit-touch-callout:none]';
</script>

{#snippet face(entry: FocusAction, withPillar = true)}
	{#if withPillar}
		<span class="flex items-center gap-2">
			<span class="pip size-2.5 shrink-0 rounded-full" style:--pip-h={HUES[entry.pillarIndex]} aria-hidden="true"></span>
			<span class="min-w-0 flex-1 truncate text-[0.82rem] font-semibold">{entry.pillarName}</span>
			{#if entry.meta?.pinned}
				<Icon name="pin" size={12} class="shrink-0 text-muted" />
			{/if}
		</span>
	{:else if entry.meta?.pinned}
		<Icon name="pin" size={12} class="text-muted" />
	{/if}
	<span
		class={cn(
			'line-clamp-4 font-serif text-[1.12rem] leading-[1.18] font-[500] tracking-[-0.01em] text-pretty',
			entry.meta?.done && 'text-muted line-through'
		)}>{entry.text}</span
	>
{/snippet}

<div bind:this={root} class="@container flex flex-col gap-10">
	<section
		class={cn('flex flex-col gap-4', shaking && 'motion-safe:animate-shake')}
		aria-label="Your {maxWord}"
		data-drop
		onanimationend={(event) => {
			if (event.target === event.currentTarget) shaking = false;
		}}
	>
		<ol class="m-0 grid list-none gap-3 p-0 @min-[540px]:grid-cols-3" aria-label="Chosen actions">
			{#each Array(max) as _, slot (slot)}
				{@const entry = picked[slot]}
				{@const over = dragging && drag?.over === slot}
				<li class="relative min-w-0" data-drop data-slot={slot}>
					{#if entry}
						{#key entry.key}
							<button
								type="button"
								class={cn(
									'pillar-cell group relative flex w-full cursor-pointer flex-col justify-between gap-3 rounded-[22px] border-0 p-4 text-left text-on-p shadow-float rotate-[var(--tilt)] motion-safe:animate-deal-in motion-safe:transition-[rotate,translate,scale,opacity] motion-safe:duration-200 motion-safe:ease-ui can-hover:hover:rotate-0 can-hover:hover:-translate-y-1',
									inset ? 'min-h-[118px]' : 'min-h-[92px] @min-[540px]:min-h-[164px]',
									over && 'scale-[0.95] rotate-0 opacity-60',
									focusRing
								)}
								style:--h={HUES[entry.pillarIndex]}
								style:--tilt="{SLOT_TILT[slot] ?? 0}deg"
								onclick={() => toggle(entry.key)}
								aria-label="Remove {entry.text}"
							>
								<span class="flex items-center justify-between gap-2">
									<span class="truncate text-[0.74rem] font-semibold tracking-[0.08em] uppercase opacity-75">
										{entry.pillarName}
									</span>
									<span
										class="flex size-7 shrink-0 items-center justify-center rounded-full bg-ink text-[0.78rem] font-semibold text-on-ink tabular-nums can-hover:group-hover:hidden group-focus-visible:hidden"
										aria-hidden="true">{slot + 1}</span
									>
									<span
										class="hidden size-7 shrink-0 items-center justify-center rounded-full bg-ink text-on-ink can-hover:group-hover:flex group-focus-visible:flex"
										aria-hidden="true"><Icon name="close" size={14} /></span
									>
								</span>
								<span
									class={cn(
										'line-clamp-3 font-serif leading-[1.12] font-[520] tracking-[-0.015em] text-balance',
										inset ? 'text-[1.08rem]' : 'text-[1.2rem] @min-[540px]:text-[1.4rem]'
									)}>{entry.text}</span
								>
							</button>
						{/key}
						{#if over}
							<span
								class="pointer-events-none absolute inset-0 flex items-center justify-center motion-safe:animate-pop-in"
								aria-hidden="true"
							>
								<span class="flex items-center gap-1.5 rounded-full bg-ink px-3.5 py-2 text-[0.85rem] font-semibold text-on-ink shadow-float">
									<Icon name="refresh" size={14} /> Swap
								</span>
							</span>
						{/if}
					{:else}
						<div
							class={cn(
								'flex h-full flex-col justify-between gap-3 rounded-[22px] bg-sunken p-4 text-muted motion-safe:transition-[scale,background-color] motion-safe:duration-200 motion-safe:ease-ui',
								inset ? 'min-h-[118px]' : 'min-h-[92px] @min-[540px]:min-h-[164px]',
								dragging && slot === picked.length && 'bg-sunken-hover text-text',
								landing === slot && 'scale-[1.04]'
							)}
						>
							<span class="font-serif text-[2rem] leading-none font-[480] tabular-nums opacity-50" aria-hidden="true">
								{slot + 1}
							</span>
							<span class="text-[0.88rem] text-pretty">
								{#if slot === picked.length}
									{dragging ? 'Drop it here' : slot === 0 ? 'Drag a card here' : 'Drag another'}
								{/if}
							</span>
						</div>
					{/if}
				</li>
			{/each}
		</ol>

		<div class="flex flex-wrap items-center justify-between gap-x-4 gap-y-3">
			<p class="m-0 text-[0.9rem] text-pretty text-muted" aria-live="polite">
				{#if dragging}
					{full ? 'Drop it on a card to swap.' : 'Drop it into your day.'}
				{:else if limited}
					{maxWord.charAt(0).toUpperCase() + maxWord.slice(1)} is the limit. Drop a card on one to swap it.
				{:else if full}
					That's your day.
				{:else if picked.length === 0}
					Flip through each pillar. Tap or drag what fits today.
				{:else}
					{max - picked.length} more, or start with {picked.length}.
				{/if}
			</p>
			<div class="flex flex-wrap items-center gap-2">
				{#if !full && actions.length > picked.length}
					<Button variant="soft" size="sm" icon="sparkles" onclick={suggest}>
						{picked.length === 0 ? `Deal me ${maxWord}` : 'Deal the rest'}
					</Button>
				{/if}
				{#if footer}
					{@render footer()}
				{/if}
			</div>
		</div>
	</section>

	<section class="flex flex-col gap-4" aria-label="Your pillars">
		<div class="flex flex-col gap-1">
			<Eyebrow>Your pillars</Eyebrow>
			{#if goal}
				<p class="m-0 text-[0.92rem] text-pretty text-muted">
					Toward <span class="font-medium text-text">{goal}</span>
				</p>
			{/if}
		</div>

		<ul
			class={cn(
				'm-0 grid list-none grid-cols-2 items-start gap-x-3 gap-y-5 p-0 @min-[720px]:grid-cols-4',
				inset && 'px-2'
			)}
		>
			{#each decks as group (group.pillarIndex)}
				{@const top = group.top}
				<li class="relative min-w-0 pb-3" style:--h={HUES[group.pillarIndex]}>
						{#if group.deck.length > 2}
							<span
								class="pillar-action absolute inset-x-0 top-0 bottom-3 origin-bottom rotate-[-4deg] rounded-[22px] opacity-50 shadow-card"
								aria-hidden="true"
							></span>
						{/if}
						{#if group.deck.length > 1}
							<span
								class="pillar-action absolute inset-x-0 top-0 bottom-3 origin-bottom rotate-[3deg] rounded-[22px] opacity-80 shadow-card"
								aria-hidden="true"
							></span>
						{/if}

						{#if top}
							<div class="relative">
								{#key top.key}
									<button
										type="button"
										class={cn(
											'pillar-action relative flex min-h-[176px] w-full cursor-grab flex-col gap-3 rounded-[22px] border-0 p-4 pb-14 text-left text-text shadow-card motion-safe:transition-[translate,box-shadow,scale,opacity] motion-safe:duration-200 motion-safe:ease-ui can-hover:hover:-translate-y-1 can-hover:hover:shadow-float active:scale-[0.97]',
											flipDirection === 1 ? 'motion-safe:animate-card-in' : 'motion-safe:animate-pop-in',
											full && 'opacity-80',
											drag?.entry.key === top.key && 'invisible',
											grab,
											focusRing
										)}
										onclick={() => toggle(top.key)}
										onkeydown={(event) => onCardKey(event, group.pillarIndex)}
										aria-label={group.deck.length > 1
											? `Add ${top.text}, ${group.at + 1} of ${group.deck.length}`
											: `Add ${top.text}`}
										aria-keyshortcuts={group.deck.length > 1 ? 'ArrowLeft ArrowRight' : undefined}
										{@attach draggable(top)}
									>
										{@render face(top)}
									</button>
								{/key}
								{#if group.deck.length > 1}
									<span
										class="pointer-events-none absolute bottom-4 left-4 text-[0.76rem] text-muted tabular-nums"
										aria-hidden="true"
									>
										{group.at + 1} / {group.deck.length}
									</span>
								{/if}
								{#if group.deck.length > 1}
									<button
										type="button"
										class={cn(
											'absolute right-3 bottom-3 flex size-10 cursor-pointer items-center justify-center rounded-full border-0 bg-surface text-text shadow-card motion-safe:transition-transform motion-safe:duration-150 can-hover:hover:translate-x-0.5 active:scale-90',
											focusRing
										)}
										onclick={() => flip(group.pillarIndex, 1)}
										aria-label="Next {group.pillarName} action"
									>
										<Icon name="arrow-right" size={16} />
									</button>
								{/if}
							</div>
						{:else}
							<div class="relative flex min-h-[176px] flex-col justify-between gap-3 rounded-[22px] bg-sunken p-4 text-muted">
								<span class="flex items-center gap-2">
									<span
										class="pip size-2.5 shrink-0 rounded-full opacity-40"
										style:--pip-h={HUES[group.pillarIndex]}
										aria-hidden="true"
									></span>
									<span class="truncate text-[0.82rem] font-semibold">{group.pillarName}</span>
								</span>
								<span class="text-[0.88rem]">
									{group.actions.length > 0 ? 'All in your day' : 'Nothing open'}
								</span>
							</div>
						{/if}
				</li>
			{/each}
		</ul>
	</section>

	{#if drag}
		<div
			class={cn(
				'pointer-events-none fixed z-50',
				drag.returning && 'motion-safe:transition-[translate] motion-safe:duration-[240ms] motion-safe:ease-ui'
			)}
			style:left="{drag.x}px"
			style:top="{drag.y}px"
			style:width="{drag.w}px"
			style:height="{drag.h}px"
			style:translate="{drag.dx}px {drag.dy}px"
			style:--h={HUES[drag.entry.pillarIndex]}
			aria-hidden="true"
		>
			<div
				class={cn(
					'pillar-action flex size-full flex-col gap-3 rounded-[22px] p-4 text-text shadow-float motion-safe:transition-[rotate,scale] motion-safe:duration-150 motion-safe:ease-ui',
					drag.returning ? 'rotate-0' : drag.over !== null ? 'scale-[0.94] rotate-[-1deg]' : 'scale-[1.06] rotate-[4deg]'
				)}
			>
				{@render face(drag.entry)}
			</div>
		</div>
	{/if}
</div>
