# Recipes

Working versions of the drag recipes live in `src/lib/components/FocusPicker.svelte`. The page, swap, sweep, and thread recipes live in the `Helper*.svelte` components.

## Pointer drag as an attachment

```ts
import type { Attachment } from 'svelte/attachments';

type Drag = { entry: Item; x: number; y: number; w: number; h: number; dx: number; dy: number; over: Target; returning: boolean };
let drag = $state<Drag | null>(null);
let swallowClick = false;

function draggable(entry: Item): Attachment<HTMLElement> {
	return (node) => {
		let pointerId = -1, startX = 0, startY = 0, armed = false, timer = 0;

		const begin = () => {
			const r = node.getBoundingClientRect();
			armed = true;
			drag = { entry, x: r.left, y: r.top, w: r.width, h: r.height, dx: 0, dy: 0, over: null, returning: false };
			node.setPointerCapture(pointerId);
			navigator.vibrate?.(8);
		};
		const down = (e: PointerEvent) => {
			if (e.button !== 0 || drag) return;
			pointerId = e.pointerId; startX = e.clientX; startY = e.clientY; armed = false;
			if (e.pointerType === 'touch') timer = window.setTimeout(begin, 220);
		};
		const move = (e: PointerEvent) => {
			if (e.pointerId !== pointerId) return;
			const dx = e.clientX - startX, dy = e.clientY - startY;
			if (!armed) {
				if (Math.hypot(dx, dy) < 6) return;
				if (e.pointerType === 'touch') { clearTimeout(timer); pointerId = -1; return; } // it's a scroll
				begin();
			}
			if (!drag) return;
			drag.dx = dx; drag.dy = dy; drag.over = dropTargetAt(e.clientX, e.clientY);
		};
		const up = (e: PointerEvent) => {
			if (e.pointerId !== pointerId) return;
			clearTimeout(timer); pointerId = -1;
			if (!armed) return;
			armed = false;
			swallowClick = true; setTimeout(() => (swallowClick = false));
			finishDrag(e.type === 'pointerup' ? dropTargetAt(e.clientX, e.clientY) : null);
		};
		const holdStill = (e: Event) => { if (armed) e.preventDefault(); };

		node.addEventListener('pointerdown', down);
		node.addEventListener('pointermove', move);
		node.addEventListener('pointerup', up);
		node.addEventListener('pointercancel', up);
		node.addEventListener('touchmove', holdStill, { passive: false });
		node.addEventListener('contextmenu', holdStill);
		return () => { /* clearTimeout + remove all six */ };
	};
}
```

Spring back on a miss: set `returning = true`, zero `dx` and `dy`, let a `transition-[translate]` play, then clear `drag` after about 260ms. Check `drag === current` first so a newer drag isn't wiped out.

## Ghost

```svelte
{#if drag}
	<div
		class={cn('pointer-events-none fixed z-50', drag.returning && 'motion-safe:transition-[translate] motion-safe:duration-[240ms] motion-safe:ease-ui')}
		style:left="{drag.x}px" style:top="{drag.y}px" style:width="{drag.w}px" style:height="{drag.h}px"
		style:translate="{drag.dx}px {drag.dy}px"
		aria-hidden="true"
	>
		<div class={cn('pillar-action size-full rounded-[22px] shadow-float motion-safe:transition-[rotate,scale]',
			drag.returning ? 'rotate-0' : drag.over !== null ? 'scale-[0.94] rotate-[-1deg]' : 'scale-[1.06] rotate-[4deg]')}>
			…same face snippet as the source card…
		</div>
	</div>
{/if}
```

Put `translate` on the outer element and `rotate`/`scale` on the inner one, so each has its own transition. A `fixed` ghost inside a `Dialog` still works because the dialog's open animation has no fill, so no transformed ancestor remains.

## Drop targets

```ts
function dropTargetAt(x: number, y: number) {
	const hit = document.elementFromPoint(x, y)?.closest<HTMLElement>('[data-drop]');
	if (!hit || !root?.contains(hit)) return null;
	return hit.dataset.slot === undefined ? 'zone' : Number(hit.dataset.slot);
}
```

Mark the whole tray `data-drop` and each slot `data-drop data-slot={i}`. The innermost one wins.

## Keyframes

```css
--animate-deal-in: deal-in 0.42s cubic-bezier(0.34, 1.56, 0.64, 1) both;
--animate-card-in: card-in 0.36s cubic-bezier(0.16, 1, 0.3, 1) both;

@keyframes deal-in {
	from { opacity: 0; transform: translateY(28px) rotate(-6deg) scale(0.9); }
	to { opacity: 1; } /* no transform, so the element's own rotate survives */
}
@keyframes card-in {
	from { opacity: 0; transform: perspective(700px) rotateY(-24deg) translateX(14px); }
	to { opacity: 1; transform: none; }
}
```

Re-trigger an arrival by wrapping the element in `{#key item.key}`.

## Testing drag from devtools

```js
Element.prototype.setPointerCapture = () => {}; // synthetic pointers have no capture target
const opts = (x, y, buttons) => ({ bubbles: true, pointerId: 7, pointerType: 'mouse', isPrimary: true, button: 0, buttons, clientX: x, clientY: y });
card.dispatchEvent(new PointerEvent('pointerdown', opts(x0, y0, 1)));
for (let i = 1; i <= 12; i++) { card.dispatchEvent(new PointerEvent('pointermove', opts(lerpX(i), lerpY(i), 1))); await wait(16); }
// screenshot here for the mid-drag frame
card.dispatchEvent(new PointerEvent('pointerup', opts(x1, y1, 0)));
```

This doesn't test touch. Touch has to be checked on a real phone or with CDP touch emulation.

## Pages that turn

The store keeps `page` and `direction` (1 going in, -1 going back). The panel stacks the old and new page in one grid cell and eases its own height to the new one.

```svelte
<script lang="ts">
	let height = $state<number | null>(null);
	let settled = $state(false); // no height transition on first paint
	onMount(() => { const f = requestAnimationFrame(() => (settled = true)); return () => cancelAnimationFrame(f); });

	function measure(node: HTMLElement) {
		const update = () => { if (node.dataset.view === view) height = node.offsetHeight; }; // ignore the page that is leaving
		const observer = new ResizeObserver(update);
		observer.observe(node);
		update();
		return () => observer.disconnect();
	}
</script>

<div class={cn('min-h-0 shrink overflow-y-auto', settled && 'motion-safe:transition-[height] motion-safe:duration-[420ms] motion-safe:ease-[cubic-bezier(0.16,1,0.3,1)]')}
	style:height={height === null ? undefined : `${height}px`}>
	<div class="grid">
		{#key view}
			<section class="min-w-0 self-start [grid-area:1/1]" data-view={view}
				in:pageIn={{ direction: store.direction }} out:pageOut={{ direction: store.direction }} {@attach measure}>
				…
			</section>
		{/key}
	</div>
</div>
```

`pageIn` and `pageOut` are in `ui/motion.ts`. In: 380ms expo-out, 70ms late, from `28px * direction`. Out: 220ms, fading in place and drifting `-14px * direction`. Under reduced motion both are a short fade.

## A button that opens out

```svelte
<div class={cn('grid motion-safe:transition-[grid-template-columns,opacity] motion-safe:duration-300',
	open ? 'grid-cols-[1fr]' : 'grid-cols-[0fr] opacity-0')}>
	<div class="min-w-0 overflow-clip [overflow-clip-margin:4px]">
		<IconButton data-back icon="arrow-left" label="Back" inert={!open} onclick={back} />
	</div>
</div>
```

`inert` keeps the hidden button out of the tab order. The clip margin leaves room for the focus ring.

## Swap a card in place

```svelte
{#each picks as pick, index (index)}          <!-- keyed by slot, so the slot stays -->
	<li class="grid motion-safe:animate-deal-in" style:animation-delay="{60 + index * 70}ms">
		{#key pick.key}                          <!-- keyed by card, so the face is replaced -->
			<div class={cn('[grid-area:1/1]', swapped.has(pick.key) && 'origin-top motion-safe:animate-flip-in')}
				out:fade={{ duration: 160 }}>…</div>
		{/key}
	</li>
{/each}
```

Only cards that came from a swap get `flip-in`; the first hand is dealt. After the swap, `await tick()` and focus the new card's button by its label (`CSS.escape` the label).

## Sweep, then mark

`MiniChart.svelte` with `play="read"`: every written cell plays `scan` with a delay of `block * 42 + cell * 7` ms, so the light moves in reading order. Flagged cells carry an outline and play `mark-in` after the sweep ends:

```css
@keyframes mark-in {
	from { outline-color: transparent; outline-offset: 7px; }
}
```

Turn `play` off about a second after the page opens, so later changes to the data show without replaying the sweep.

## A live list

When the list is `$derived` from the chart, fixing the thing removes the row. Give the row `out:foldOut`: opacity goes first, then the height closes, so the rows below move up once. A transition is local, so it plays when the row leaves and not when the page does.

## Steps on a thread

```svelte
{#snippet thread(done: boolean)}
	<span class="absolute start-[13px] top-7 bottom-0 w-0.5 -translate-x-1/2 overflow-hidden rounded-full bg-sunken">
		<span class={cn('absolute inset-0 origin-top bg-ink motion-safe:transition-[scale] motion-safe:duration-500',
			done ? 'scale-y-100' : 'scale-y-0')}></span>
	</span>
{/snippet}
```

Each step is a `relative` row with its marker (`size-7`, `z-[1]`) and the thread from the marker down. The check inside a done marker is a polyline with `pathLength="1"` playing `seal-draw`.

## A view that becomes another

`morph(update, type?)` in `src/lib/chart/morph.ts` wraps `document.startViewTransition` and applies the change inside `flushSync`, so the new DOM is there when the browser takes the after picture. `chart.setViewMode`, `setTheme`, and `setAccent` go through it.

- Name what travels: `[view-transition-name:focus-block]` on the chart's selected block in chart view, and on the editor's 3×3 when the editor is alone. Never on two visible elements at once, or the browser skips the transition.
- Name the stage, `main`, so it gets its own fade and rise, and turn the root's animation off so the header does not crossfade.
- Fade the travelling thing's old face out in about 180ms. The group still moves over 440ms; the stretched old picture should be gone before it reads as blur.
- A `type` ("theme") lets the stylesheet style one kind of change on its own: `:root:active-view-transition-type(theme)::view-transition-new(root)`.
- Browsers without the API, and reduced motion, just apply the change.

When testing with Playwright, wait for a menu's own open animation before clicking inside it. Clicking mid-animation can scroll the page, and it looks like the transition did it.

