<script module lang="ts">
	import type { IconName } from './Icon.svelte';

	export type CommandSection = 'Actions' | 'Your chart';

	export type CommandItem = {
		id: string;
		label: string;
		section: CommandSection;
		icon?: IconName;
		hint?: string;
		tone?: 'danger';
		run: () => void;
	};
</script>

<script lang="ts">
	import Icon from './Icon.svelte';
	import { cn } from './ui/cn';
	import { scrollFade } from './ui/styles';

	interface Props {
		open?: boolean;
		commands?: CommandItem[];
		query?: string;
	}

	let { open = $bindable(false), commands = [], query = $bindable('') }: Props = $props();

	let el = $state<HTMLDialogElement | null>(null);
	let inputElement = $state<HTMLInputElement | null>(null);
	let listElement = $state<HTMLUListElement | null>(null);
	let active = $state(0);
	let moreAbove = $state(false);
	let moreBelow = $state(false);

	const filtered = $derived.by((): CommandItem[] => {
		const needle = query.trim().toLowerCase();
		const matches = needle
			? commands.filter(
					(item) =>
						item.label.toLowerCase().includes(needle) ||
						item.hint?.toLowerCase().includes(needle)
				)
			: commands;
		return matches.slice(0, 24);
	});

	$effect(() => {
		void filtered.length;
		active = 0;
	});

	$effect(() => {
		const node = el;
		if (!node) return;
		if (open && !node.open) {
			query = '';
			active = 0;
			node.showModal();
			queueMicrotask(() => inputElement?.focus());
		} else if (!open && node.open) {
			node.close();
		}
	});

	$effect(() => {
		void active;
		listElement
			?.querySelector('[aria-selected="true"]')
			?.scrollIntoView({ block: 'nearest' });
	});

	function choose(item: CommandItem): void {
		open = false;
		item.run();
	}

	function watchList(node: HTMLElement): () => void {
		const update = () => {
			moreAbove = node.scrollTop > 8;
			moreBelow = node.scrollHeight - node.clientHeight - node.scrollTop > 8;
		};
		update();
		node.addEventListener('scroll', update, { passive: true });
		const observer = new ResizeObserver(update);
		observer.observe(node);
		const frame = requestAnimationFrame(update);
		return () => {
			cancelAnimationFrame(frame);
			node.removeEventListener('scroll', update);
			observer.disconnect();
		};
	}

	function onInputKeydown(event: KeyboardEvent): void {
		if (event.key === 'ArrowDown') {
			event.preventDefault();
			if (filtered.length > 0) active = (active + 1) % filtered.length;
		} else if (event.key === 'ArrowUp') {
			event.preventDefault();
			if (filtered.length > 0) active = (active + filtered.length - 1) % filtered.length;
		} else if (event.key === 'Enter') {
			event.preventDefault();
			const item = filtered[active];
			if (item) choose(item);
		}
	}
</script>

<dialog
	bind:this={el}
	class="dialog-backdrop m-auto w-[min(34rem,calc(100vw-32px))] max-h-[min(78dvh,620px)] overflow-hidden rounded-[30px] border-0 bg-surface p-0 text-text shadow-float outline-none open:flex open:flex-col open:motion-safe:animate-dialog print:hidden"
	onclick={(event) => {
		if (event.target === event.currentTarget) open = false;
	}}
	onclose={() => (open = false)}
>
	<div class="relative z-20 flex shrink-0 items-center gap-3 bg-surface px-6">
		<span class="text-muted" aria-hidden="true">
			<Icon name="command" size={16} />
		</span>
		<input
			bind:this={inputElement}
			bind:value={query}
			class="h-[56px] w-full border-0 bg-transparent font-sans text-[1rem] text-text placeholder:text-muted focus:outline-none"
			type="text"
			placeholder="Type a command or search your chart"
			role="combobox"
			aria-expanded="true"
			aria-controls="command-list"
			aria-activedescendant={filtered[active] ? `cmd-${filtered[active].id}` : undefined}
			spellcheck="false"
			autocomplete="off"
			onkeydown={onInputKeydown}
		/>
	</div>

	<div class="relative flex min-h-0 flex-1 flex-col">
	<ul
		bind:this={listElement}
		id="command-list"
		data-dialog-scroll
		class="min-h-0 flex-1 overflow-y-auto overscroll-contain p-2"
		role="listbox"
		aria-label="Commands"
		{@attach watchList}
	>
		{#each filtered as item, index (item.id)}
			{@const showHeader = index === 0 || filtered[index - 1]!.section !== item.section}
			{#if showHeader}
				<li
					class="px-3.5 pb-1 pt-2.5 text-[0.72rem] font-semibold tracking-[0.12em] text-muted uppercase"
					role="presentation"
				>
					{item.section}
				</li>
			{/if}
			<li class="p-0" role="presentation">
				<button
					type="button"
					id="cmd-{item.id}"
					role="option"
					aria-selected={index === active}
					class={cn(
						'flex min-h-[44px] w-full cursor-pointer items-center gap-3 rounded-[14px] border-0 px-3.5 text-left font-sans text-[0.9rem] focus-visible:outline-none',
						item.tone === 'danger'
							? 'text-danger focus-visible:bg-danger-wash aria-selected:bg-danger-wash'
							: 'text-text focus-visible:bg-sunken aria-selected:bg-sunken'
					)}
					onclick={() => choose(item)}
					onpointerenter={() => (active = index)}
				>
					{#if item.icon}
						<Icon
							name={item.icon}
							size={16}
							class={item.tone === 'danger' ? 'shrink-0 text-danger' : 'shrink-0 text-muted'}
						/>
					{/if}
					<span class="min-w-0 flex-1 truncate">{item.label}</span>
					{#if item.hint}
						<span class="shrink-0 text-[0.78rem] text-muted">{item.hint}</span>
					{/if}
				</button>
			</li>
		{:else}
			<li class="px-4 py-8 text-center text-[0.88rem] text-muted" role="presentation">No matches.</li>
		{/each}
	</ul>
	<div class={scrollFade({ edge: 'top', on: moreAbove })} aria-hidden="true"></div>
	<div class={scrollFade({ edge: 'bottom', on: moreBelow })} aria-hidden="true"></div>
	</div>

	<div class="relative z-20 flex shrink-0 items-center gap-4 bg-surface px-6 py-2.5 text-[0.74rem] text-muted" aria-hidden="true">
		<span><kbd class="font-semibold">↑↓</kbd> navigate</span>
		<span><kbd class="font-semibold">↵</kbd> run</span>
		<span><kbd class="font-semibold">esc</kbd> close</span>
	</div>
</dialog>
