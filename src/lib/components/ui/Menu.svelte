<script lang="ts">
	import type { Snippet } from 'svelte';
	import IconButton from './IconButton.svelte';
	import { setMenu } from './menu';
	import { cn } from './cn';
	import { menu } from './styles';

	type TriggerArgs = { expanded: boolean; toggle: () => void };

	type Props = {
		children: Snippet;
		/** Sets aria-haspopup="menu" and aria-expanded. Without this, the trigger is an icon button. */
		trigger?: Snippet<[TriggerArgs]>;
		align?: 'start' | 'end';
		label?: string;
		class?: string;
		open?: boolean;
		/** A scrolling panel clips an absolute menu, so this pins it to the viewport instead, and closes it on scroll. */
		float?: boolean;
		onopenchange?: (open: boolean) => void;
	};

	let {
		children,
		trigger,
		align = 'end',
		label = 'More actions',
		class: className,
		open: expanded = $bindable(false),
		float = false,
		onopenchange
	}: Props = $props();

	let root = $state<HTMLDivElement | null>(null);
	let up = $state(false);
	let pinnedToViewport = $state(false);
	const styles = $derived(menu({ align }));
	/** The dock floats over the bottom of the page: 18px off the edge, a 54px bar, and a gap above it. */
	const DOCK_ROOM = 96;

	/** An ancestor that is a containing block for fixed boxes (a transform, a filter) would pin the panel to itself. */
	function insideFixedContainer(): boolean {
		for (let node = root?.parentElement; node; node = node.parentElement) {
			const style = getComputedStyle(node);
			if (style.transform !== 'none' || style.filter !== 'none' || style.backdropFilter !== 'none' || style.perspective !== 'none' || style.willChange.includes('transform')) return true;
			if (/paint|layout|strict|content/.test(style.contain)) return true;
		}
		return false;
	}

	function frame(): { top: number; right: number; bottom: number; left: number } {
		const inDialog = Boolean(root?.closest('dialog'));
		const box = { top: 8, left: 8, right: window.innerWidth - 8, bottom: window.innerHeight - (inDialog ? 8 : DOCK_ROOM) };
		if (!root || !insideFixedContainer()) return box;
		for (let node = root.parentElement; node && node !== document.documentElement; node = node.parentElement) {
			const style = getComputedStyle(node);
			const clips = (value: string) => value === 'auto' || value === 'scroll' || value === 'hidden' || value === 'clip';
			const rect = node.getBoundingClientRect();
			if (clips(style.overflowY)) {
				box.top = Math.max(box.top, rect.top + 8);
				box.bottom = Math.min(box.bottom, rect.bottom - 8);
			}
			if (clips(style.overflowX)) {
				box.left = Math.max(box.left, rect.left + 8);
				box.right = Math.min(box.right, rect.right - 8);
			}
		}
		return box;
	}

	function pinToViewport(panel: HTMLElement): boolean {
		const trigger = root?.getBoundingClientRect();
		if (!trigger || insideFixedContainer()) return false;
		const box = frame();
		const gap = 8;
		const natural = panel.scrollHeight;
		const below = box.bottom - trigger.bottom - gap;
		const above = trigger.top - gap - box.top;
		const opensUp = natural > below && above > below;
		const room = Math.max(120, Math.floor(opensUp ? above : below));
		const height = Math.min(natural, room);
		const width = panel.offsetWidth;
		const top = opensUp ? trigger.top - gap - height : trigger.bottom + gap;
		const left = align === 'start' ? trigger.left : trigger.right - width;
		Object.assign(panel.style, {
			position: 'fixed',
			top: `${top}px`,
			bottom: 'auto',
			left: `${Math.max(box.left, Math.min(left, box.right - width))}px`,
			right: 'auto',
			maxHeight: `${room}px`
		});
		up = opensUp;
		pinnedToViewport = true;
		return true;
	}

	$effect(() => {
		if (!float || !expanded) return;
		const closeUnlessInside = (event?: Event): void => {
			if (event?.target instanceof Node && root?.querySelector('[role="menu"]')?.contains(event.target)) return;
			close();
		};
		window.addEventListener('scroll', closeUnlessInside, true);
		window.addEventListener('resize', closeUnlessInside);
		return () => {
			window.removeEventListener('scroll', closeUnlessInside, true);
			window.removeEventListener('resize', closeUnlessInside);
		};
	});

	function place(panel: HTMLElement): void {
		pinnedToViewport = float && pinToViewport(panel);
		if (pinnedToViewport) return;
		const trigger = root?.getBoundingClientRect();
		if (!trigger) return;
		const box = frame();
		const gap = 8;
		const natural = panel.scrollHeight;
		const below = box.bottom - trigger.bottom - gap;
		const above = trigger.top - gap - box.top;
		up = natural > below && above > below;
		panel.style.maxHeight = `${Math.max(120, Math.floor(up ? above : below))}px`;
	}

	function close(): void {
		if (!expanded) return;
		expanded = false;
		onopenchange?.(false);
		queueMicrotask(() => root?.querySelector<HTMLElement>('[aria-haspopup="menu"]')?.focus());
	}

	function toggle(): void {
		if (expanded) close();
		else {
			up = false;
			expanded = true;
			onopenchange?.(true);
		}
	}

	function menuItems(): HTMLElement[] {
		const panel = root?.querySelector<HTMLElement>('[role="menu"]');
		if (!panel) return [];
		return [...panel.querySelectorAll<HTMLElement>('[role="menuitem"]')];
	}

	function focusItem(item: HTMLElement | undefined): void {
		if (!item) return;
		item.focus();
		item.scrollIntoView({ block: 'nearest' });
	}

	function onKey(event: KeyboardEvent): void {
		if (!expanded || !root) return;
		if (!(event.target instanceof Node) || !root.contains(event.target)) return;
		if (event.altKey || event.ctrlKey || event.metaKey) return;

		if (event.key === 'Escape') {
			event.preventDefault();
			event.stopImmediatePropagation();
			close();
			return;
		}

		const items = menuItems();
		const field = root.querySelector<HTMLInputElement>('[data-menu-find]');
		const inField =
			event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement;
		const index = event.target instanceof HTMLElement ? items.indexOf(event.target) : -1;

		if (event.key === 'ArrowDown' || event.key === 'ArrowUp' || event.key === 'Home' || event.key === 'End') {
			if (inField && (event.key === 'Home' || event.key === 'End' || event.key === 'ArrowUp')) return;
			if (!items.length) return;
			let next: HTMLElement | undefined;
			if (event.key === 'Home') next = items[0];
			else if (event.key === 'End') next = items[items.length - 1];
			else if (event.key === 'ArrowDown') {
				next = inField || index < 0 || index === items.length - 1 ? items[0] : items[index + 1];
			} else if (index === 0 && field) next = field;
			else if (index <= 0) next = items[items.length - 1];
			else next = items[index - 1];
			event.preventDefault();
			event.stopPropagation();
			focusItem(next);
			return;
		}

		if (!field || inField || event.key.length !== 1) return;
		if (event.key === ' ' && event.target instanceof HTMLElement && event.target.closest('[role="menuitem"]')) {
			return;
		}
		event.preventDefault();
		event.stopPropagation();
		field.focus();
		field.value += event.key;
		field.dispatchEvent(new Event('input', { bubbles: true }));
	}

	setMenu({ close });
</script>

<svelte:window onkeydowncapture={onKey} />

<div class={cn(styles.wrap(), expanded && 'z-[60]', className)} bind:this={root}>
	<div class={styles.trigger()}>
		{#if trigger}
			{@render trigger({ expanded, toggle })}
		{:else}
			<IconButton
				icon="more"
				{label}
				aria-haspopup="menu"
				aria-expanded={expanded}
				onclick={toggle}
			/>
		{/if}
	</div>
	{#if expanded}
		<div class={styles.backdrop()} aria-hidden="true" onclick={close}></div>
		<div
			class={cn(styles.panel(), up && !pinnedToViewport && 'top-auto bottom-[calc(100%+8px)]', up && (align === 'start' ? 'origin-bottom-left' : 'origin-bottom-right'))}
			role="menu"
			aria-label={label}
			{@attach place}
		>
			{@render children()}
		</div>
	{/if}
</div>
