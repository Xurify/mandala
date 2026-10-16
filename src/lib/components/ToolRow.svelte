<script lang="ts">
	import { chart } from '$lib/chart/chart.svelte';
	import { HUES, TOOL_KINDS, type Tool } from '$lib/chart/model';
	import { isApplePlatform } from '$lib/chart/shortcuts';
	import { sameLink, shelfOf, toolDetail } from '$lib/chart/tools';
	import { tick } from 'svelte';
	import ToolFace from './ToolFace.svelte';
	import Eyebrow from './ui/Eyebrow.svelte';
	import IconButton from './ui/IconButton.svelte';
	import Menu from './ui/Menu.svelte';
	import MenuDivider from './ui/MenuDivider.svelte';
	import MenuItem from './ui/MenuItem.svelte';
	import { cn } from './ui/cn';

	interface Props {
		pillarIndex: number;
		tool: Tool;
		/** The action Today hands this out for, when it is up next. */
		nextFor?: number;
		settingsOpen?: boolean;
		settingsLabel?: string;
		onsettings: () => void;
		/** Where focus goes when the row leaves and no row is left beside it. */
		onempty?: () => void;
	}

	let { pillarIndex, tool, nextFor, settingsOpen = false, settingsLabel = 'Who hands it out', onsettings, onempty }: Props = $props();

	let root = $state<HTMLElement | null>(null);
	let open = $state(false);
	let page = $state<'main' | 'move'>('main');

	const kinds = [
		{ value: 'repeat', label: 'Repeat', detail: 'until known' },
		{ value: 'once', label: 'Once', detail: 'then put away' },
		{ value: 'staple', label: 'Staple', detail: 'for good' }
	] as const;
	const removeKey = typeof navigator !== 'undefined' && isApplePlatform(navigator.userAgent) ? '⌫' : 'Del';
	const others = $derived(
		chart.data.pillars.flatMap((pillar, index) =>
			index === pillarIndex ? [] : [{ index, name: pillar.trim() || `Pillar ${index + 1}`, has: shelfOf(chart.data, index).some((each) => sameLink(each.url, tool.url)) }]
		)
	);

	/** A row that leaves the list takes its focus with it, so focus goes to the row beside it. */
	async function leave(change: () => void): Promise<void> {
		const row = root?.closest('li');
		const beside = (row?.nextElementSibling ?? row?.previousElementSibling)?.querySelector<HTMLElement>('[data-tool-face]');
		change();
		await tick();
		if (beside?.isConnected) beside.focus();
		else onempty?.();
	}

	function remove(): void {
		void leave(() => chart.removeTools([{ pillarIndex, id: tool.id }]));
	}

	function setKnown(value: boolean): void {
		void leave(() => chart.updateTool(pillarIndex, tool.id, { known: value || undefined }));
	}

	function setKind(value: string): void {
		const kind = TOOL_KINDS.find((each) => each === value) ?? 'repeat';
		if (kind === tool.kind) return;
		if (kind === 'staple' && tool.known) void leave(() => chart.updateTool(pillarIndex, tool.id, { kind }));
		else chart.updateTool(pillarIndex, tool.id, { kind });
	}

	function move(to: number): void {
		void leave(() => chart.moveTools([{ pillarIndex, id: tool.id }], to));
	}

	async function turn(event: MouseEvent, to: 'main' | 'move'): Promise<void> {
		event.preventDefault();
		page = to;
		await tick();
		root?.querySelector<HTMLElement>('[role="menu"] [role="menuitem"]')?.focus();
	}

	function onkeydown(event: KeyboardEvent): void {
		if (event.key !== 'Delete' && event.key !== 'Backspace') return;
		if (open || event.altKey || event.ctrlKey || event.metaKey) return;
		if (!(event.target instanceof HTMLElement) || !event.target.matches('[data-tool-face]')) return;
		event.preventDefault();
		remove();
	}
</script>

<div bind:this={root} class="flex items-center gap-1 p-1">
	<a
		href={tool.url}
		target="_blank"
		rel="noopener noreferrer"
		data-tool-face
		class="flex min-w-0 flex-1 items-center rounded-[12px] px-1.5 py-1 text-text no-underline hover:bg-sunken focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-ink"
		title={nextFor === undefined ? undefined : `Today hands this out for action ${nextFor + 1}`}
		aria-keyshortcuts="Delete"
		onclick={() => chart.openTool(pillarIndex, tool.id)}
		{onkeydown}
	>
		<ToolFace {tool} detail={toolDetail(chart.data, pillarIndex, tool)} tag={nextFor === undefined ? undefined : 'Up next'} class="min-w-0 flex-1" />
	</a>
	<Menu
		label={tool.title}
		float
		bind:open
		onopenchange={(value) => {
			if (!value) page = 'main';
		}}
	>
		{#snippet trigger({ expanded, toggle })}
			<IconButton
				icon="more"
				label="More for {tool.title}"
				class={cn('size-9 text-muted hover:text-text', (expanded || settingsOpen) && 'text-text')}
				aria-haspopup="menu"
				aria-expanded={expanded}
				onclick={toggle}
			/>
		{/snippet}
		{#if page === 'move'}
			<MenuItem icon="chevron-left" onclick={(event) => turn(event, 'main')}>Back</MenuItem>
			<Eyebrow class="px-3 pt-2 pb-1">Move to</Eyebrow>
			{#each others as other (other.index)}
				<MenuItem badge={other.has ? 'Has it' : undefined} onclick={() => move(other.index)}>
					<span class="pip size-2.5 shrink-0 rounded-full" style:--pip-h={HUES[other.index]} aria-hidden="true"></span>
					<span class="truncate">{other.name}</span>
				</MenuItem>
			{/each}
		{:else}
			{#if tool.kind !== 'staple'}
				<MenuItem icon={tool.known ? 'undo' : 'check'} onclick={() => setKnown(!tool.known)}>{tool.known ? 'Back in rotation' : 'Know this'}</MenuItem>
				<MenuDivider />
			{/if}
			<Eyebrow class="px-3 pt-1.5 pb-1">Comes round</Eyebrow>
			{#each kinds as kind (kind.value)}
				<MenuItem checked={tool.kind === kind.value} onclick={() => setKind(kind.value)}>
					<span class="flex min-w-0 items-baseline gap-2">
						{kind.label}
						<span class="truncate text-[0.8rem] font-normal text-muted">{kind.detail}</span>
					</span>
				</MenuItem>
			{/each}
			<MenuDivider />
			<MenuItem icon="arrow-right" onclick={(event) => turn(event, 'move')}>Move to another shelf</MenuItem>
			<MenuItem icon="edit" onclick={onsettings}>{settingsLabel}</MenuItem>
			<MenuDivider />
			<MenuItem icon="trash" tone="danger" shortcut={removeKey} onclick={remove}>Remove</MenuItem>
		{/if}
	</Menu>
</div>
