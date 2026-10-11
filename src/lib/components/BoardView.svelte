<script lang="ts">
	import { tick } from 'svelte';
	import type { Attachment } from 'svelte/attachments';
	import { chart } from '$lib/chart/chart.svelte';
	import {
		LANES,
		LANE_NAMES,
		besideLane,
		boardOf,
		canGo,
		doneByWeek,
		findCard,
		placed,
		wholeIndex,
		type Card,
		type Lane
	} from '$lib/chart/board';
	import { HUES, actionKey, dateKeyOffset, todayKey, weekStartKey } from '$lib/chart/model';
	import Icon from './Icon.svelte';
	import Button from './ui/Button.svelte';
	import Dialog from './ui/Dialog.svelte';
	import Eyebrow from './ui/Eyebrow.svelte';
	import IconButton from './ui/IconButton.svelte';
	import SegmentedControl from './ui/SegmentedControl.svelte';
	import Select from './ui/Select.svelte';
	import { cn } from './ui/cn';
	import { textField } from './ui/styles';

	let { narrow = false }: { narrow?: boolean } = $props();

	const today = todayKey();
	const monday = weekStartKey();
	const board = $derived(boardOf(chart.data));

	const pillarName = (pillarIndex: number): string => chart.data.pillars[pillarIndex]?.trim() || `Pillar ${pillarIndex + 1}`;

	let pillar = $state('all');
	const query = $derived(chart.query.trim().toLowerCase());
	const shown = (card: Card): boolean =>
		(pillar === 'all' || card.pillarIndex === Number(pillar)) && (!query || card.text.toLowerCase().includes(query));

	const pillarOptions = $derived.by(() => {
		const present = new Set(LANES.flatMap((lane) => board[lane].map((card) => card.pillarIndex)));
		return [
			{ value: 'all', label: 'All pillars' },
			...[...present].sort((a, b) => a - b).map((pillarIndex) => ({ value: String(pillarIndex), label: pillarName(pillarIndex) }))
		];
	});

	type Drag = {
		card: Card;
		from: Lane;
		fromIndex: number;
		x: number;
		y: number;
		w: number;
		h: number;
		/** Where the card was taken hold of, so it shrinks toward the finger over a tab. */
		ox: number;
		oy: number;
		dx: number;
		dy: number;
		/** The list under it, whether or not that list takes it. Null over no list. */
		lane: Lane | null;
		/** In the target list without the card. */
		index: number;
		/** Over a tab on a phone, so it goes to the end of that list. */
		tab: boolean;
		landing: boolean;
	};

	type Lift = { key: string; from: Lane; fromIndex: number; lane: Lane; index: number };

	let root = $state<HTMLDivElement | null>(null);
	let drag = $state<Drag | null>(null);
	let lift = $state<Lift | null>(null);
	let stamped = $state<string | null>(null);
	let said = $state('');
	let swallowClick = false;
	let pointer = { x: 0, y: 0 };
	let frame = 0;

	const view = $derived(lift ? placed(board, lift.key, lift.lane, lift.index, today) : board);

	const firstLane = (): Lane => (board.doing.length > 0 ? 'doing' : board.todo.length > 0 ? 'todo' : 'open');
	let lane = $state<Lane>(firstLane());

	const counts = $derived(
		Object.fromEntries(LANES.map((each) => [each, view[each].filter(shown).length])) as Record<Lane, number>
	);

	const weekLabel = `Week of ${new Date(`${monday}T12:00`).toLocaleDateString('en-US', { month: 'long', day: 'numeric' })}`;

	const summary = $derived.by((): string => {
		if (query) {
			const matches = LANES.reduce((total, each) => total + board[each].filter(shown).length, 0);
			const quoted = `“${chart.query.trim()}”`;
			return matches === 0 ? `No cards match ${quoted}.` : `${matches === 1 ? '1 card matches' : `${matches} cards match`} ${quoted}.`;
		}
		const doing = board.doing.filter(shown).length;
		const todo = board.todo.filter(shown).length;
		const moving = [doing > 0 && `${doing} doing`, todo > 0 && `${todo} to do`].filter(Boolean);
		const week = doneByWeek(board.done.filter(shown)).week.length;
		const first = moving.length > 0 ? `${moving.join(', ')}.` : 'Drag what comes next into To do.';
		return week > 0 ? `${first} ${week} done this week.` : first;
	});

	const status = $derived.by((): string | null => {
		const current = drag;
		if (current && !current.landing) {
			if (current.lane === null) return 'Drop it on a list.';
			if (!canGo(current.card, current.lane)) return 'A routine stays out of Done. Tick it in Today.';
			return `Drop it in ${LANE_NAMES[current.lane]}.`;
		}
		if (lift) return `${LANE_NAMES[lift.lane]}. Arrows carry it, Space puts it down, Escape puts it back.`;
		return null;
	});

	function shortDay(key: string | undefined): string {
		if (!key) return 'Done';
		if (key === today) return 'Today';
		if (key === dateKeyOffset(-1)) return 'Yesterday';
		const date = new Date(`${key}T12:00`);
		if (key >= dateKeyOffset(-6)) return date.toLocaleDateString('en-US', { weekday: 'short' });
		const sameYear = date.getFullYear() === new Date().getFullYear();
		return date.toLocaleDateString('en-US', sameYear ? { month: 'short', day: 'numeric' } : { month: 'short', day: 'numeric', year: 'numeric' });
	}

	function where(key: string, inLane: Lane): string {
		const list = view[inLane].filter(shown);
		const at = list.findIndex((card) => card.key === key);
		return inLane === 'todo' || inLane === 'doing' ? `${LANE_NAMES[inLane]}, ${at + 1} of ${list.length}` : LANE_NAMES[inLane];
	}

	function stamp(key: string): void {
		stamped = key;
		setTimeout(() => {
			if (stamped === key) stamped = null;
		}, 1400);
	}

	function commit(card: Card, from: Lane, to: Lane, index: number): boolean {
		if (!chart.moveCard(card.key, to, index)) return false;
		if (to === 'done' && from !== 'done') stamp(card.key);
		return true;
	}

	async function focusCard(key: string): Promise<void> {
		await tick();
		const button = root?.querySelector<HTMLElement>(`[data-card="${key}"] button`);
		button?.focus({ preventScroll: true });
		button?.scrollIntoView({ block: 'nearest' });
	}

	function restOf(inLane: Lane, key: string): Card[] {
		return board[inLane].filter((card) => card.key !== key);
	}

	function laneAt(x: number, y: number): { lane: Lane; tab: boolean } | null {
		const hit = document.elementFromPoint(x, y);
		if (!hit || !root?.contains(hit)) return null;
		const tab = hit.closest<HTMLElement>('[data-lane-tabs] [data-value]');
		if (tab) return { lane: tab.dataset.value as Lane, tab: true };
		const tray = hit.closest<HTMLElement>('[data-lane]');
		return tray ? { lane: tray.dataset.lane as Lane, tab: false } : null;
	}

	function indexAt(inLane: Lane, y: number, key: string): number {
		const items = [...(root?.querySelectorAll<HTMLElement>(`[data-list="${inLane}"] [data-card]`) ?? [])].filter(
			(item) => item.dataset.card !== key
		);
		let at = items.length;
		for (let index = 0; index < items.length; index++) {
			const rect = items[index]!.getBoundingClientRect();
			if (y < rect.top + rect.height / 2) {
				at = index;
				break;
			}
		}
		return wholeIndex(restOf(inLane, key), shown, at);
	}

	let spring = 0;
	let springLane: Lane | null = null;

	/** A held card resting on a phone's tab opens that list, so it can go to a place in it. */
	function springTo(target: Lane | null): void {
		if (target === springLane) return;
		clearTimeout(spring);
		springLane = target;
		if (target === null) return;
		spring = window.setTimeout(() => {
			springLane = null;
			lane = target;
			retarget(pointer.x, pointer.y);
		}, 380);
	}

	function retarget(x: number, y: number): void {
		const current = drag;
		if (!current || current.landing) return;
		const target = laneAt(x, y);
		springTo(target?.tab && target.lane !== lane ? target.lane : null);
		current.lane = target?.lane ?? null;
		current.tab = target?.tab ?? false;
		if (!target || !canGo(current.card, target.lane)) return;
		current.index = target.tab ? restOf(target.lane, current.card.key).length : indexAt(target.lane, y, current.card.key);
	}

	/** Near the edge of a list, or of the window on a phone, the page keeps moving under a held card. */
	function autoscroll(): void {
		const current = drag;
		if (!current || current.landing) return;
		const { x, y } = pointer;
		let moved = false;
		const scroller = document.elementFromPoint(x, y)?.closest<HTMLElement>('[data-scroller]');
		if (scroller && scroller.scrollHeight > scroller.clientHeight) {
			const rect = scroller.getBoundingClientRect();
			const edge = 56;
			const push = y < rect.top + edge ? y - rect.top - edge : y > rect.bottom - edge ? y - rect.bottom + edge : 0;
			if (push !== 0) {
				scroller.scrollTop += push * 0.3;
				moved = true;
			}
		}
		// The dock covers the bottom of the window.
		const push = y < 72 ? y - 72 : y > innerHeight - 132 ? y - innerHeight + 132 : 0;
		if (push !== 0 && narrow) {
			scrollBy(0, push * 0.3);
			moved = true;
		}
		if (moved) retarget(x, y);
		frame = requestAnimationFrame(autoscroll);
	}

	async function finishDrag(drop: boolean): Promise<void> {
		const current = drag;
		if (!current || current.landing) return;
		cancelAnimationFrame(frame);
		springTo(null);
		const dropping = drop && current.lane !== null && canGo(current.card, current.lane);
		const to = dropping ? current.lane! : current.from;
		const index = dropping ? current.index : current.fromIndex;
		const moved = to !== current.from || ((to === 'todo' || to === 'doing') && index !== current.fromIndex);
		current.lane = to;
		current.index = index;
		// A card dropped on a phone's tab for a list not on screen has no slot to fly into.
		current.tab = narrow && to !== lane;
		current.landing = true;
		await tick();
		const slot = root?.querySelector<HTMLElement>('[data-slot]');
		const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
		if (slot && !reduce) {
			const rect = slot.getBoundingClientRect();
			current.dx = rect.left - current.x;
			current.dy = rect.top - current.y;
			await new Promise((resolve) => setTimeout(resolve, 220));
		}
		if (moved && commit(current.card, current.from, to, index)) {
			said = `Moved to ${where(current.card.key, to)}.`;
			if (narrow && to !== lane) chart.say(`Moved to ${LANE_NAMES[to]}.`);
		}
		if (drag === current) drag = null;
	}

	// Touch waits for a still press so a swipe keeps scrolling the page.
	function draggable(key: string): Attachment<HTMLElement> {
		return (node) => {
			let pointerId = -1;
			let startX = 0;
			let startY = 0;
			let armed = false;
			let timer = 0;

			const begin = (): void => {
				const found = findCard(board, key);
				if (!found || lift) return;
				const rect = node.getBoundingClientRect();
				armed = true;
				drag = {
					card: found.card,
					from: found.lane,
					fromIndex: found.index,
					x: rect.left,
					y: rect.top,
					w: rect.width,
					h: rect.height,
					ox: startX - rect.left,
					oy: startY - rect.top,
					dx: 0,
					dy: 0,
					lane: found.lane,
					index: found.index,
					tab: false,
					landing: false
				};
				node.setPointerCapture(pointerId);
				navigator.vibrate?.(8);
				frame = requestAnimationFrame(autoscroll);
			};

			const down = (event: PointerEvent): void => {
				if (event.button !== 0 || drag || lift) return;
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
				if (!drag || drag.landing) return;
				pointer = { x: event.clientX, y: event.clientY };
				drag.dx = dx;
				drag.dy = dy;
				retarget(event.clientX, event.clientY);
			};

			const up = (event: PointerEvent): void => {
				if (event.pointerId !== pointerId) return;
				clearTimeout(timer);
				pointerId = -1;
				if (!armed) return;
				armed = false;
				swallowClick = true;
				setTimeout(() => (swallowClick = false));
				if (event.type === 'pointerup') retarget(event.clientX, event.clientY);
				void finishDrag(event.type === 'pointerup');
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

	function onWindowKey(event: KeyboardEvent): void {
		if (drag && event.key === 'Escape') {
			event.preventDefault();
			event.stopPropagation();
			const current = drag;
			current.lane = null;
			void finishDrag(false);
		}
	}

	async function carry(card: Card, to: Lane, index: number): Promise<void> {
		if (!lift) return;
		lift = { ...lift, lane: to, index };
		if (narrow) lane = to;
		said = where(card.key, to);
		await focusCard(card.key);
	}

	async function onCardKey(event: KeyboardEvent, card: Card): Promise<void> {
		const held = lift;
		const take = event.key === ' ' || (held !== null && event.key === 'Enter');
		if (!take && !held) return;
		if (!take && !['Escape', 'ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(event.key)) return;
		event.preventDefault();
		event.stopPropagation();
		if (event.repeat && take) return;

		if (take && !held) {
			const found = findCard(board, card.key);
			if (!found || drag) return;
			lift = { key: card.key, from: found.lane, fromIndex: found.index, lane: found.lane, index: found.index };
			said = `Picked up ${card.text}. ${where(card.key, found.lane)}. Arrows carry it, Space puts it down, Escape puts it back.`;
			return;
		}
		if (!held) return;

		if (take) {
			lift = null;
			const moved = held.lane !== held.from || ((held.lane === 'todo' || held.lane === 'doing') && held.index !== held.fromIndex);
			if (moved) commit(card, held.from, held.lane, held.index);
			said = moved ? `Put down in ${where(card.key, held.lane)}.` : 'Put down where it was.';
			await focusCard(card.key);
			return;
		}
		if (event.key === 'Escape') {
			lift = null;
			if (narrow) lane = held.from;
			said = `Put back in ${LANE_NAMES[held.from]}.`;
			await focusCard(card.key);
			return;
		}
		if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
			const to = besideLane(card, held.lane, event.key === 'ArrowRight' ? 1 : -1);
			if (!to) return;
			const at = view[held.lane].filter(shown).findIndex((entry) => entry.key === card.key);
			await carry(card, to, wholeIndex(restOf(to, card.key), shown, at));
			return;
		}
		if (held.lane !== 'todo' && held.lane !== 'doing') {
			said = held.lane === 'open' ? 'Open keeps the order of the chart.' : 'Done keeps the newest first.';
			return;
		}
		const at = view[held.lane].filter(shown).findIndex((entry) => entry.key === card.key);
		const next = at + (event.key === 'ArrowDown' ? 1 : -1);
		if (next < 0 || next >= view[held.lane].filter(shown).length) return;
		await carry(card, held.lane, wholeIndex(restOf(held.lane, card.key), shown, next));
	}

	type Entry = { id: string; card?: Card; source?: boolean; slot?: boolean; earlier?: boolean };

	function entriesOf(inLane: Lane): Entry[] {
		const current = drag;
		const cards = view[inLane].filter(shown);
		let slotAt = -1;
		if (current && current.lane === inLane && !current.tab && canGo(current.card, inLane)) {
			slotAt = placed(board, current.card.key, inLane, current.index, today)[inLane]
				.filter(shown)
				.findIndex((card) => card.key === current.card.key);
		}
		const out: Entry[] = [];
		let count = 0;
		let past = false;
		for (const card of cards) {
			const source = current?.card.key === card.key;
			if (!source && count === slotAt) out.push({ id: 'slot', slot: true });
			if (inLane === 'done' && !past && (card.doneAt ?? '') < monday && !source) {
				past = true;
				if (out.some((entry) => entry.card && !entry.source)) out.push({ id: 'earlier', earlier: true });
			}
			out.push({ id: card.key, card, source });
			if (!source) count += 1;
		}
		if (slotAt >= count) out.push({ id: 'slot', slot: true });
		return out;
	}

	const EMPTY: Record<Lane, string> = {
		open: 'Every action is on the move.',
		todo: 'Drag what comes next here.',
		doing: 'Drag what you are on now here.',
		done: 'Finished cards land here.'
	};

	let sheetOpen = $state(false);
	let sheetKey = $state<string | null>(null);
	const sheet = $derived(sheetKey ? findCard(board, sheetKey) : null);

	function openSheet(card: Card): void {
		if (swallowClick || lift || drag) return;
		sheetKey = card.key;
		sheetOpen = true;
	}

	$effect(() => {
		if (sheetOpen || !sheetKey) return;
		const key = sheetKey;
		const found = findCard(board, key);
		if (narrow && found && found.lane !== lane) lane = found.lane;
		sheetKey = null;
		void focusCard(key);
	});

	function moveFromSheet(value: string): void {
		const found = sheet;
		if (!found) return;
		const to = value as Lane;
		commit(found.card, found.lane, to, restOf(to, found.card.key).length);
	}

	function openInEditor(): void {
		const key = sheetKey;
		sheetOpen = false;
		if (key) chart.jumpToKey(key);
	}

	const roomy = $derived(
		Array.from({ length: 8 }, (_, pillarIndex) => pillarIndex)
			.filter((pillarIndex) => chart.data.actions[pillarIndex]?.some((action) => !action.trim()))
			.map((pillarIndex) => ({ value: String(pillarIndex), label: pillarName(pillarIndex) }))
	);

	let addOpen = $state(false);
	let addLane = $state<Lane>('open');
	let addPillar = $state('');
	let addText = $state('');
	const uid = $props.id();

	function openAdd(to: Lane): void {
		addLane = to;
		addPillar = roomy.some((option) => option.value === pillar) ? pillar : (roomy[0]?.value ?? '');
		addText = '';
		addOpen = true;
	}

	function add(): void {
		const text = addText.trim();
		const pillarIndex = Number(addPillar);
		const slot = chart.data.actions[pillarIndex]?.findIndex((action) => !action.trim()) ?? -1;
		if (!text || addPillar === '' || slot < 0) return;
		const key = actionKey(pillarIndex, slot);
		chart.setText(key, text);
		if (addLane !== 'open') chart.moveCard(key, addLane, restOf(addLane, key).length);
		addOpen = false;
		if (narrow) lane = addLane;
		void focusCard(key);
	}

	const todayFocus = $derived(new Set(chart.todayLog.focus));
	const todayTicks = $derived(new Set(chart.todayLog.checked));

	const focusRing = 'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink';
	/** In dark the sunken tone is lighter than a card, so a tray drops to the page's own tone to stay below its cards. */
	const tray = 'rounded-[24px] bg-sunken shadow-well dark:bg-bg';
	/** An index card: paper, with its pillar's hue along the top edge. */
	const cardStock =
		'relative flex flex-col gap-1.5 overflow-hidden rounded-[16px] bg-surface px-3.5 pt-[15px] pb-3.5 before:pointer-events-none before:absolute before:inset-x-0 before:top-0 before:h-1 before:pillar-cell';
</script>

<svelte:window onkeydowncapture={onWindowKey} />

{#snippet face(card: Card, inLane: Lane)}
	<span class="flex min-w-0 items-center gap-2 text-[0.74rem] leading-4">
		<span class="pillar-ink min-w-0 flex-1 truncate font-bold tracking-[0.06em] uppercase" style:--h={HUES[card.pillarIndex]}
			>{pillarName(card.pillarIndex)}</span
		>
		{#if inLane === 'done'}
			<span class="flex shrink-0 items-center gap-1 text-muted">
				<span
					class={cn(
						'flex size-4 items-center justify-center rounded-full bg-ink text-on-ink',
						stamped === card.key && 'motion-safe:animate-stamp'
					)}
					aria-hidden="true"
				>
					<Icon name="check" size={10} strokeWidth={3} />
				</span>
				<span class="sr-only">Done</span>
				<span class="tabular-nums">{shortDay(card.doneAt)}</span>
			</span>
		{:else if todayTicks.has(card.key) || todayFocus.has(card.key)}
			<span class="flex shrink-0 items-center gap-1 text-muted">
				<Icon name={todayTicks.has(card.key) ? 'check' : 'calendar'} size={12} />
				{#if todayTicks.has(card.key)}<span class="sr-only">Ticked</span>{/if}
				Today
			</span>
		{:else if card.routine}
			<span class="flex shrink-0 items-center gap-1 text-muted">
				<Icon name="refresh" size={12} />
				Routine
			</span>
		{/if}
	</span>
	<span class="block text-[0.96rem] leading-[1.34] font-[520] text-pretty text-text">{card.text}</span>
{/snippet}

{#snippet cardItem(entry: Entry, inLane: Lane)}
	{@const card = entry.card!}
	{@const lifted = lift?.key === card.key}
	<li
		data-card={card.key}
		class={cn('min-w-0', entry.source && 'pointer-events-none absolute h-0 w-full overflow-hidden opacity-0')}
		aria-hidden={entry.source ? 'true' : undefined}
	>
		<button
			type="button"
			class={cn(
				cardStock,
				'w-full cursor-grab border-0 text-left shadow-card touch-manipulation select-none [-webkit-touch-callout:none] motion-safe:transition-[translate,rotate,box-shadow,scale] motion-safe:duration-150 motion-safe:ease-ui active:scale-[0.98] can-hover:hover:-translate-y-0.5 can-hover:hover:shadow-float',
				lifted && '-translate-y-1 rotate-[1.2deg] shadow-float can-hover:hover:-translate-y-1',
				focusRing
			)}
			style:--h={HUES[card.pillarIndex]}
			tabindex={entry.source ? -1 : undefined}
			aria-describedby="{uid}-hint"
			onclick={() => openSheet(card)}
			onkeydown={(event) => void onCardKey(event, card)}
			onkeyup={(event) => {
				if (event.key === ' ') event.preventDefault();
			}}
			{@attach draggable(card.key)}
		>
			{@render face(card, inLane)}
		</button>
	</li>
{/snippet}

{#snippet list(inLane: Lane, scrolls: boolean)}
	{@const entries = entriesOf(inLane)}
	{@const refused = drag !== null && !drag.landing && drag.lane === inLane && !canGo(drag.card, inLane)}
	<ol
		data-list={inLane}
		data-scroller={scrolls ? '' : undefined}
		class={cn(
			'relative m-0 flex list-none flex-col gap-2 p-2',
			scrolls && 'max-h-[max(360px,calc(100dvh-236px))] min-h-[180px] flex-1 overflow-y-auto',
			refused && 'opacity-45 motion-safe:transition-opacity motion-safe:duration-150'
		)}
		aria-label={LANE_NAMES[inLane]}
	>
		{#each entries as entry (entry.id)}
			{#if entry.slot}
				<li
					data-slot
					class="shrink-0 rounded-[18px] bg-sunken-hover shadow-[inset_0_1px_3px_oklch(0_0_0/0.08)]"
					style:height="{drag?.h ?? 72}px"
					aria-hidden="true"
				></li>
			{:else if entry.earlier}
				<li class="px-2 pt-2.5 pb-0.5"><Eyebrow>Earlier</Eyebrow></li>
			{:else}
				{@render cardItem(entry, inLane)}
			{/if}
		{/each}
		{#if !entries.some((entry) => !entry.source)}
			<li class="rounded-[18px] px-3 py-6 text-center text-[0.86rem] text-pretty text-muted">
				{query || pillar !== 'all' ? 'Nothing here matches.' : EMPTY[inLane]}
			</li>
		{/if}
	</ol>
{/snippet}

<div bind:this={root} class="mx-auto w-full pt-2 max-[900px]:pt-0">
	<header class="mb-5 flex flex-wrap items-end justify-between gap-x-6 gap-y-3 max-[900px]:mb-3">
		<div class="min-w-0">
			<Eyebrow class="mb-2">{weekLabel}</Eyebrow>
			<h2
				class="m-0 font-serif text-[2rem] leading-[1.08] font-[480] tracking-[-0.025em] text-balance text-text max-[900px]:text-[1.6rem]"
			>
				Your board
			</h2>
			<p class="m-0 mt-1.5 max-w-[56ch] text-[0.95rem] text-pretty text-muted" aria-live="polite">
				{status ?? summary}
			</p>
		</div>
		{#if pillarOptions.length > 2}
			<Select size="sm" label="Show a pillar" options={pillarOptions} bind:value={pillar} class="w-[220px] max-[900px]:w-full" />
		{/if}
	</header>

	<p id="{uid}-hint" class="sr-only">Space picks the card up. Enter opens it.</p>
	<p class="sr-only" aria-live="assertive">{said}</p>

	{#if LANES.every((each) => board[each].length === 0)}
		<section class="mx-auto mt-2 flex max-w-[520px] flex-col items-start gap-4 rounded-[28px] bg-surface p-6 shadow-card">
			<p class="m-0 text-[0.95rem] text-pretty text-muted">
				Every action on the chart is a card here. Write a few first.
			</p>
			<Button onclick={() => chart.setViewMode('view')}>Open the chart</Button>
		</section>
	{:else if narrow}
		<div
			data-lane-tabs
			class="paper sticky top-[env(safe-area-inset-top,0px)] z-20 -mx-[14px] flex justify-center px-[14px] py-2.5"
		>
			<SegmentedControl
				label="List"
				options={LANES.map((each) => ({ value: each, label: `${LANE_NAMES[each]} ${counts[each]}` }))}
				value={lane}
				onchange={(value) => (lane = value as Lane)}
			/>
		</div>
		<!-- Every list stays mounted, so a card held while the tabs switch keeps its pointer. -->
		{#each LANES as each (each)}
			<section data-lane={each} class={cn(tray, 'mt-1', each !== lane && 'hidden')} aria-label={LANE_NAMES[each]}>
				{@render list(each, false)}
				{#if each !== 'done' && roomy.length > 0}
					<div class="px-2 pb-2">
						<Button variant="ghost" size="sm" icon="plus" class="w-full" onclick={() => openAdd(each)}>Add a card</Button>
					</div>
				{/if}
			</section>
		{/each}
	{:else}
		<div class="grid grid-cols-4 items-stretch gap-3">
			{#each LANES as each (each)}
				{@const over = drag !== null && !drag.landing && drag.lane === each && each !== drag.from && canGo(drag.card, each)}
				<section
					data-lane={each}
					class={cn(tray, 'flex min-w-0 flex-col', over && 'bg-sunken-hover dark:bg-sunken')}
					aria-labelledby="{uid}-{each}"
				>
					<header class="flex min-h-[52px] items-center justify-between gap-2 ps-4 pe-1.5 pt-1.5">
						<h3 id="{uid}-{each}" class="m-0 flex items-center gap-2 text-[0.98rem] font-[620] tracking-[-0.005em] text-text">
							<Icon name="lane-{each}" size={17} class={each === 'open' || each === 'todo' ? 'text-muted' : 'text-text'} />
							{LANE_NAMES[each]}
							<span class="min-w-6 rounded-full bg-surface px-1.5 py-px text-center text-[0.74rem] font-semibold text-muted tabular-nums shadow-card"
								>{counts[each]}</span
							>
						</h3>
						{#if each !== 'done' && roomy.length > 0}
							<IconButton icon="plus" label="Add a card to {LANE_NAMES[each]}" class="text-muted hover:text-text" onclick={() => openAdd(each)} />
						{/if}
					</header>
					{@render list(each, true)}
				</section>
			{/each}
		</div>
	{/if}

	{#if drag}
		<div
			class={cn(
				'pointer-events-none fixed z-50',
				drag.landing && 'motion-safe:transition-[translate] motion-safe:duration-200 motion-safe:ease-ui'
			)}
			style:left="{drag.x}px"
			style:top="{drag.y}px"
			style:width="{drag.w}px"
			style:translate="{drag.dx}px {drag.dy}px"
			style:--h={HUES[drag.card.pillarIndex]}
			aria-hidden="true"
		>
			<div
				class={cn(
					cardStock,
					'shadow-float motion-safe:transition-[rotate,scale] motion-safe:duration-150 motion-safe:ease-ui',
					drag.landing
						? 'rotate-0'
						: drag.tab
							? 'scale-50 rotate-0'
							: drag.lane !== null && !canGo(drag.card, drag.lane)
								? 'scale-100 rotate-0'
								: 'scale-[1.03] rotate-[2.5deg]'
				)}
				style:transform-origin="{drag.ox}px {drag.oy}px"
			>
				{@render face(drag.card, drag.from)}
			</div>
		</div>
	{/if}
</div>

<Dialog bind:open={sheetOpen} title={sheet?.card.text ?? ''} description={sheet ? pillarName(sheet.card.pillarIndex) : undefined} size="sm">
	{#if sheet}
		{@const card = sheet.card}
		<div class="flex flex-col gap-4">
			<div class="flex flex-wrap items-center justify-between gap-3">
				<span class="text-[0.9rem] text-muted">List</span>
				<SegmentedControl
					label="List"
					options={LANES.filter((each) => canGo(card, each)).map((each) => ({ value: each, label: LANE_NAMES[each] }))}
					value={sheet.lane}
					onchange={moveFromSheet}
				/>
			</div>
			{#if sheet.lane === 'done'}
				<p class="m-0 text-[0.9rem] text-pretty text-muted">
					Finished {card.doneAt === today ? 'today' : shortDay(card.doneAt) === 'Yesterday' ? 'yesterday' : `on ${new Date(`${card.doneAt}T12:00`).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}`}. It is on the calendar.
				</p>
			{:else if card.routine}
				<p class="m-0 text-[0.9rem] text-pretty text-muted">A routine never goes to Done. Tick it in Today, day by day.</p>
			{/if}
			{#if todayTicks.has(card.key)}
				<p class="m-0 text-[0.9rem] text-pretty text-muted">Ticked today.</p>
			{:else if todayFocus.has(card.key)}
				<p class="m-0 text-[0.9rem] text-pretty text-muted">One of today's three.</p>
			{/if}
		</div>
	{/if}
	{#snippet footer()}
		<Button variant="soft" icon="edit" onclick={openInEditor}>Open in the editor</Button>
	{/snippet}
</Dialog>

<Dialog bind:open={addOpen} title="New card" description="It is written into the chart as one of the pillar's actions." size="sm">
	<form
		class="flex flex-col gap-4"
		onsubmit={(event) => {
			event.preventDefault();
			add();
		}}
	>
		<div class="flex flex-col gap-1.5">
			<span id="{uid}-pillar" class="text-[0.9rem] text-muted">Pillar</span>
			<Select labelledBy="{uid}-pillar" label="Pillar" options={roomy} bind:value={addPillar} />
		</div>
		<label class="flex flex-col gap-1.5">
			<span class="text-[0.9rem] text-muted">Action</span>
			<input class={textField} maxlength="120" bind:value={addText} placeholder="A step you could finish this week" data-autofocus />
		</label>
	</form>
	{#snippet footer()}
		<Button variant="ghost" onclick={() => (addOpen = false)}>Cancel</Button>
		<Button disabled={!addText.trim() || addPillar === ''} onclick={add}>Add to {LANE_NAMES[addLane]}</Button>
	{/snippet}
</Dialog>
