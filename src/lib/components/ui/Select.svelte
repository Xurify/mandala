<script lang="ts">
	import Icon from '../Icon.svelte';
	import { cn } from './cn';
	import { select } from './styles';

	export type SelectOption = { value: string; label: string };

	type Props = {
		options: readonly SelectOption[];
		value?: string;
		/** Accessible name when no visible label is wired with `labelledBy`. */
		label: string;
		labelledBy?: string;
		disabled?: boolean;
		size?: 'md' | 'sm';
		placeholder?: string;
		class?: string;
		onchange?: (value: string) => void;
	};

	let {
		options,
		value = $bindable(''),
		label,
		labelledBy,
		disabled = false,
		size = 'md',
		placeholder = 'Choose',
		class: className,
		onchange
	}: Props = $props();

	let open = $state(false);
	let root = $state<HTMLDivElement | null>(null);
	let trigger = $state<HTMLButtonElement | null>(null);
	let active = $state(0);
	/**
	 * Where the list sits, in viewport terms. It is fixed rather than hung off the trigger, so a select inside a
	 * scrolling dialog body does not grow that body and scroll the page away; it opens upward when the room below
	 * is short. A scroll anywhere closes it, since the trigger would move out from under it.
	 */
	let place = $state<{ top?: number; bottom?: number; left: number; width: number } | null>(null);
	const GAP = 8;
	const LIST_MAX = 320;

	function placeList(): void {
		if (!trigger) return;
		const rect = trigger.getBoundingClientRect();
		const below = window.innerHeight - rect.bottom - GAP;
		const wanted = Math.min(LIST_MAX, options.length * 44 + 12);
		const up = below < wanted && rect.top - GAP > below;
		place = up
			? { bottom: window.innerHeight - rect.top + GAP, left: rect.left, width: rect.width }
			: { top: rect.bottom + GAP, left: rect.left, width: rect.width };
	}

	$effect(() => {
		if (!open) return;
		// The list's own scrolling (to the chosen option, or through a long list) is not the page moving.
		const away = (event?: Event): void => {
			if (event?.target instanceof Node && root?.contains(event.target)) return;
			close(false);
		};
		window.addEventListener('scroll', away, true);
		window.addEventListener('resize', away);
		return () => {
			window.removeEventListener('scroll', away, true);
			window.removeEventListener('resize', away);
		};
	});

	const uid = $props.id();
	const listId = $derived(`${uid}-list`);
	const valueId = $derived(`${uid}-value`);
	const styles = $derived(select({ size, open }));
	const current = $derived(options.find((option) => option.value === value));
	const locked = $derived(disabled || options.length === 0);

	function indexOfValue(): number {
		const index = options.findIndex((option) => option.value === value);
		return index < 0 ? 0 : index;
	}

	/** Focus without scrolling anything but the list itself: a page scroll would close the list. */
	function focusOption(index: number): void {
		const item = root?.querySelectorAll<HTMLElement>('[role="option"]')[index];
		if (!item) return;
		item.focus({ preventScroll: true });
		const list = item.parentElement;
		if (!list) return;
		const top = item.offsetTop;
		const bottom = top + item.offsetHeight;
		if (top < list.scrollTop) list.scrollTop = top;
		else if (bottom > list.scrollTop + list.clientHeight) list.scrollTop = bottom - list.clientHeight;
	}

	function openList(): void {
		if (locked || open) return;
		active = indexOfValue();
		placeList();
		open = true;
		queueMicrotask(() => focusOption(active));
	}

	function close(focusTrigger = true): void {
		if (!open) return;
		open = false;
		if (focusTrigger) queueMicrotask(() => trigger?.focus());
	}

	function choose(next: string): void {
		if (next !== value) {
			value = next;
			onchange?.(next);
		}
		close();
	}

	function stepValue(delta: number): void {
		if (!options.length) return;
		const index = indexOfValue();
		const next = options[Math.min(options.length - 1, Math.max(0, index + delta))];
		if (!next || next.value === value) return;
		value = next.value;
		onchange?.(next.value);
	}

	function moveActive(delta: number): void {
		if (!options.length) return;
		active = (active + delta + options.length) % options.length;
		focusOption(active);
	}

	function onTriggerKey(event: KeyboardEvent): void {
		if (locked || event.ctrlKey || event.metaKey) return;
		if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
			event.preventDefault();
			if (event.altKey) openList();
			else stepValue(event.key === 'ArrowDown' ? 1 : -1);
			return;
		}
		if (event.key === 'Enter' || event.key === ' ') {
			event.preventDefault();
			openList();
		}
	}

	function onListKey(event: KeyboardEvent): void {
		if (!open) return;
		if (event.key === 'Escape') {
			event.preventDefault();
			event.stopImmediatePropagation();
			close();
			return;
		}
		if (event.key === 'ArrowDown') {
			event.preventDefault();
			moveActive(1);
			return;
		}
		if (event.key === 'ArrowUp') {
			event.preventDefault();
			moveActive(-1);
			return;
		}
		if (event.key === 'Home') {
			event.preventDefault();
			active = 0;
			focusOption(0);
			return;
		}
		if (event.key === 'End') {
			event.preventDefault();
			active = options.length - 1;
			focusOption(active);
			return;
		}
		if (event.key === 'Enter' || event.key === ' ') {
			event.preventDefault();
			const option = options[active];
			if (option) choose(option.value);
			return;
		}
		if (event.key.length !== 1) return;
		const needle = event.key.toLowerCase();
		const start = (active + 1) % options.length;
		const ordered = [...options.slice(start), ...options.slice(0, start)];
		const match = ordered.find((option) => option.label.toLowerCase().startsWith(needle));
		if (!match) return;
		event.preventDefault();
		active = options.indexOf(match);
		focusOption(active);
	}
</script>

<div class={cn(styles.wrap(), open && 'z-[60]', className)} bind:this={root}>
	<button
		bind:this={trigger}
		type="button"
		class={styles.trigger()}
		disabled={locked}
		aria-haspopup="listbox"
		aria-expanded={open}
		aria-controls={open ? listId : undefined}
		aria-label={labelledBy ? undefined : label}
		aria-labelledby={labelledBy ? `${labelledBy} ${valueId}` : undefined}
		onclick={() => (open ? close(false) : openList())}
		onkeydown={onTriggerKey}
	>
		<span id={valueId} class={cn(styles.value(), !current && 'text-muted')}>
			{current?.label ?? placeholder}
		</span>
		<Icon name="chevron-down" size={16} class={styles.chevron()} />
	</button>
	{#if open}
		<button type="button" class={styles.backdrop()} aria-hidden="true" tabindex={-1} onclick={() => close()}></button>
		<div
			id={listId}
			class={cn(styles.panel(), place && 'fixed', place?.bottom !== undefined && 'origin-bottom-left')}
			style:top={place?.top !== undefined ? `${place.top}px` : undefined}
			style:bottom={place?.bottom !== undefined ? `${place.bottom}px` : undefined}
			style:left={place ? `${place.left}px` : undefined}
			style:width={place ? `${place.width}px` : undefined}
			style:min-width={place ? `${place.width}px` : undefined}
			role="listbox"
			aria-label={label}
			tabindex={-1}
			onkeydown={onListKey}
		>
			{#each options as option, index (option.value)}
				<button
					type="button"
					role="option"
					class={styles.option()}
					aria-selected={option.value === value}
					tabindex={index === active ? 0 : -1}
					onclick={() => choose(option.value)}
					onmouseenter={() => (active = index)}
					onfocus={() => (active = index)}
				>
					<span class="min-w-0 truncate">{option.label}</span>
					{#if option.value === value}
						<Icon name="check" size={16} class={styles.check()} />
					{:else}
						<span class="size-4 shrink-0" aria-hidden="true"></span>
					{/if}
				</button>
			{/each}
		</div>
	{/if}
</div>
