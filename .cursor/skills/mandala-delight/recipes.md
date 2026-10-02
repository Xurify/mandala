# Recipes

Working versions of these live in `src/lib/components/FocusPicker.svelte`.

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
