<script lang="ts">
	import { chart } from '$lib/chart/chart.svelte';
	import { clipboardPicture, pastedPicture, readIcon } from '$lib/chart/site-icon';
	import { isApplePlatform, modifierLabel } from '$lib/chart/shortcuts';
	import { tick } from 'svelte';
	import { fetchTitle, hostOf, iconOf, linkIn, nearKnown, openedLately, shelfOf, thumbnailOf, upNext } from '$lib/chart/tools';
	import { isRoutine, type Tool } from '$lib/chart/model';
	import Icon from './Icon.svelte';
	import ToolFace from './ToolFace.svelte';
	import Button from './ui/Button.svelte';
	import IconButton from './ui/IconButton.svelte';
	import Menu from './ui/Menu.svelte';
	import MenuDivider from './ui/MenuDivider.svelte';
	import MenuItem from './ui/MenuItem.svelte';
	import SegmentedControl from './ui/SegmentedControl.svelte';
	import Select from './ui/Select.svelte';
	import { cn } from './ui/cn';
	import { foldOut } from './ui/motion';
	import { fieldInk } from './ui/styles';

	let { pillarIndex }: { pillarIndex: number } = $props();

	const tools = $derived(shelfOf(chart.data, pillarIndex));
	const rotation = $derived(tools.filter((tool) => !tool.known));
	const known = $derived(tools.filter((tool) => tool.known));
	const next = $derived(upNext(chart.data, pillarIndex));
	const routines = $derived(
		(chart.data.actions[pillarIndex] ?? []).flatMap((text, index) => (text.trim() && isRoutine(chart.data.meta?.[`a${pillarIndex}_${index}`]) ? [index] : []))
	);
	const uses = $derived([
		{ value: 'any', label: routines.length ? 'Any routine here' : 'Any routine here (none yet)' },
		...(chart.data.actions[pillarIndex] ?? []).flatMap((text, index) => (text.trim() ? [{ value: String(index), label: `${index + 1} · ${text.trim()}` }] : []))
	]);
	const kinds = [
		{ value: 'repeat', label: 'Repeat', title: 'Comes round until you press Know this' },
		{ value: 'once', label: 'Once', title: 'Put away after the first open' }
	];
	const asked = $derived(new Set(nearKnown(chart.data).filter((entry) => entry.pillarIndex === pillarIndex).map((entry) => entry.tool.id)));

	let draft = $state('');
	let field = $state<HTMLInputElement | null>(null);
	let section = $state<HTMLElement | null>(null);
	let picker = $state<HTMLInputElement | null>(null);
	let iconFor = '';
	let editing = $state<string | null>(null);
	let showKnown = $state(false);
	let added = $state<string | null>(null);

	$effect(() => {
		void pillarIndex;
		editing = null;
		showKnown = false;
	});

	function who(tool: Tool): string {
		if (tool.action !== undefined) return `for action ${tool.action + 1}`;
		return routines.length ? 'any routine' : 'no routine yet';
	}

	function detailOf(tool: Tool): string {
		return [tool.known ? 'known' : who(tool), !tool.known && tool.kind === 'once' ? 'once' : null].filter(Boolean).join(' · ');
	}

	function chooseIcon(host: string): void {
		iconFor = host;
		picker?.click();
	}

	async function setIcon(host: string, file: File): Promise<void> {
		const icon = await readIcon(file);
		if (!icon) {
			chart.say("Couldn't read that image. Try an SVG, PNG or JPEG.");
			return;
		}
		chart.setIcon(host, icon);
		chart.say(`Icon set for ${host}.`);
	}

	function onpick(event: Event & { currentTarget: HTMLInputElement }): void {
		const input = event.currentTarget;
		const file = input.files?.[0];
		input.value = '';
		if (file && iconFor) void setIcon(iconFor, file);
	}

	let iconMenu = $state<string | null>(null);
	const mod = typeof navigator === 'undefined' ? 'Ctrl' : modifierLabel(isApplePlatform(navigator.userAgent));

	async function pasteIcon(host: string): Promise<void> {
		const file = await clipboardPicture();
		if (file) await setIcon(host, file);
		else chart.say(`Nothing to paste. Copy an image or SVG code, then press ${mod} V on the link.`);
	}

	function onRowPaste(event: ClipboardEvent & { currentTarget: HTMLElement }, toolId: string, host: string): void {
		if ((event.target as HTMLElement | null)?.closest('input, textarea')) return;
		const file = pastedPicture(event.clipboardData);
		if (!file) return;
		event.preventDefault();
		event.stopPropagation();
		const row = event.currentTarget;
		if (iconMenu === toolId) {
			iconMenu = null;
			void tick().then(() => row.querySelector<HTMLElement>('[aria-haspopup="menu"]')?.focus());
		}
		void setIcon(host, file);
	}
	let rejected = $state(false);
	let picture = $state(false);

	/** A pasted link lands as a tool at once; its title arrives when the site answers. */
	function add(text: string): void {
		const url = linkIn(text);
		if (!url) {
			rejected = text.trim() !== '';
			return;
		}
		rejected = false;
		draft = '';
		const tool = chart.addTool(pillarIndex, url);
		added = tool.id;
		void fetchTitle(url).then((title) => {
			if (title) chart.updateTool(pillarIndex, tool.id, { title });
		});
	}

	function onpaste(event: ClipboardEvent): void {
		picture = false;
		if (pastedPicture(event.clipboardData)) {
			event.preventDefault();
			rejected = false;
			picture = true;
			return;
		}
		const text = event.clipboardData?.getData('text') ?? '';
		if (!linkIn(text)) return;
		event.preventDefault();
		add(text);
	}

	function onkeydown(event: KeyboardEvent): void {
		if (event.key === 'Enter') {
			event.preventDefault();
			add(draft);
		}
	}

	/** A row that leaves the list takes its focused button with it, so focus goes to the row after it, or the field. */
	async function leave(tool: Tool, change: () => void): Promise<void> {
		const list = tool.known ? known : rotation;
		const after = list[list.findIndex((entry) => entry.id === tool.id) + 1] ?? list[list.findIndex((entry) => entry.id === tool.id) - 1];
		editing = null;
		change();
		await tick();
		const target = after ? section?.querySelector<HTMLElement>(`[data-tool="${after.id}"] [aria-expanded]`) : null;
		(target ?? field)?.focus();
	}

	function setKnown(tool: Tool, value: boolean): void {
		void leave(tool, () => chart.updateTool(pillarIndex, tool.id, { known: value || undefined }));
	}
</script>

{#snippet row(tool: Tool)}
	{@const host = hostOf(tool.url)}
	{@const iconable = !thumbnailOf(tool.url)}
	{@const open = editing === tool.id}
	{@const nextFor = next.get(tool.id)}
	<li
		data-tool={tool.id}
		class={cn(
			'flex flex-col rounded-[16px] focus:outline-none',
			// A filled animation in the settings leaves a stacking context, so without a z-index a list opened there paints under later rows.
			open && 'relative z-[1] bg-surface shadow-card',
			added === tool.id && 'motion-safe:animate-pop-in'
		)}
		tabindex="-1"
		onpaste={iconable ? (event) => onRowPaste(event, tool.id, host) : undefined}
		out:foldOut
	>
		<div class="flex items-center gap-1 p-1">
			<a
				href={tool.url}
				target="_blank"
				rel="noopener noreferrer"
				class="flex min-w-0 flex-1 items-center rounded-[12px] px-1.5 py-1 text-text no-underline hover:bg-sunken focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-ink"
				title={nextFor === undefined ? undefined : `Today hands this out for action ${nextFor + 1}`}
				onclick={() => chart.openTool(pillarIndex, tool.id)}
			>
				<ToolFace {tool} detail={detailOf(tool)} tag={nextFor === undefined ? undefined : 'Up next'} class="min-w-0 flex-1" />
			</a>
			<IconButton
				icon="chevron-down"
				label="Settings for {tool.title}"
				class={cn('size-9 text-muted hover:text-text [&_svg]:motion-safe:transition-transform [&_svg]:motion-safe:duration-200', open && 'text-text [&_svg]:rotate-180')}
				aria-expanded={open}
				aria-controls="tool-{tool.id}"
				onclick={() => (editing = open ? null : tool.id)}
			/>
		</div>
		{#if asked.has(tool.id) && !open}
			<p class="m-0 flex flex-wrap items-center gap-x-2 gap-y-1 px-2.5 pb-2 text-[0.84rem] leading-snug text-pretty">
				<span>Opened on {openedLately(tool)} of the last 14 days. Know it by now?</span>
				<Button size="sm" variant="soft" icon="check" onclick={() => setKnown(tool, true)}>Know this</Button>
			</p>
		{/if}
		{#if open}
			<div id="tool-{tool.id}" class="flex flex-col gap-2.5 px-2.5 pt-1 pb-2.5 motion-safe:animate-pop-in" out:foldOut>
				<div class="grid grid-cols-[auto_minmax(0,1fr)] items-center gap-x-3 gap-y-2 @max-[360px]:grid-cols-1">
					<span id="tool-{tool.id}-by" class="text-[0.8rem] font-[560] text-muted">Handed out by</span>
					<Select
						size="sm"
						class="w-full max-w-[18rem]"
						label="Which action hands out {tool.title}"
						labelledBy="tool-{tool.id}-by"
						options={uses}
						value={tool.action === undefined ? 'any' : String(tool.action)}
						onchange={(value) => chart.updateTool(pillarIndex, tool.id, { action: value === 'any' ? undefined : Number(value) })}
					/>
					<span class="text-[0.8rem] font-[560] text-muted" aria-hidden="true">Comes round</span>
					<SegmentedControl
						size="sm"
						label="How often {tool.title} comes round"
						options={kinds}
						value={tool.kind}
						onchange={(value) => chart.updateTool(pillarIndex, tool.id, { kind: value === 'once' ? 'once' : 'repeat' })}
					/>
				</div>
				<div class="flex flex-wrap items-center gap-1.5">
					<Button size="sm" variant="soft" icon={tool.known ? 'undo' : 'check'} onclick={() => setKnown(tool, !tool.known)}>
						{tool.known ? 'Back in rotation' : 'Know this'}
					</Button>
					{#if tool.action !== undefined}
						<Button size="sm" variant="ghost" icon="arrow-left" onclick={() => chart.jumpToKey(`a${pillarIndex}_${tool.action}`)}>See action {tool.action + 1}</Button>
					{/if}
					{#if iconable}
						{@const icon = iconOf(chart.data, tool.url)}
						<Menu
							label="Icon for {host}"
							bind:open={() => iconMenu === tool.id, (value) => (iconMenu = value ? tool.id : iconMenu === tool.id ? null : iconMenu)}
						>
							{#snippet trigger({ expanded, toggle })}
								<Button size="sm" variant="ghost" icon="image" aria-haspopup="menu" aria-expanded={expanded} onclick={toggle}>
									{icon ? 'Site icon' : 'Add an icon'}
								</Button>
							{/snippet}
							<MenuItem icon="upload" onclick={() => chooseIcon(host)}>{icon ? 'Choose another image' : 'Choose an image'}</MenuItem>
							<MenuItem icon="clipboard" shortcut="{mod} V" onclick={() => pasteIcon(host)}>Paste an image</MenuItem>
							{#if icon}
								<MenuDivider />
								<MenuItem
									icon="trash"
									tone="danger"
									onclick={() => {
										chart.setIcon(host, null);
										chart.say(`Icon removed from ${host}.`);
									}}
								>
									Remove icon
								</MenuItem>
							{/if}
						</Menu>
					{/if}
					<Button size="sm" variant="danger" icon="trash" class="ms-auto" onclick={() => leave(tool, () => chart.removeTool(pillarIndex, tool.id))}>Remove</Button>
				</div>
			</div>
		{/if}
	</li>
{/snippet}

<section bind:this={section} class="flex flex-col gap-2.5" aria-label="Shelf">
	{#if tools.length === 0}
		<p class="m-0 max-w-[48ch] text-[0.86rem] leading-snug text-pretty text-muted">
			The material this pillar's actions use: videos, texts, sites. A routine hands them out one a day in Today.
		</p>
	{/if}

	<div class={cn('flex flex-col gap-1', rotation.length > 0 && 'rounded-[22px] bg-bg p-1.5')}>
		{#if rotation.length}
			<ul class="m-0 flex list-none flex-col gap-0.5 p-0" aria-label="In rotation">
				{#each rotation as tool (tool.id)}
					{@render row(tool)}
				{/each}
			</ul>
		{/if}
		<div class="relative">
			<span class="pointer-events-none absolute top-1/2 left-3.5 -translate-y-1/2 text-muted"><Icon name="plus" size={16} /></span>
			<input
				bind:this={field}
				type="url"
				class={cn(fieldInk, 'pr-4 pl-10')}
				placeholder="Paste a video, a text, a site"
				aria-label="Add a link to this shelf"
				aria-invalid={rejected || picture || undefined}
				bind:value={draft}
				{onpaste}
				{onkeydown}
				oninput={() => {
					rejected = false;
					picture = false;
				}}
			/>
		</div>
		{#if rejected}
			<p class="m-0 px-2 pb-1 text-[0.8rem] text-muted">That is not a link. Paste one that starts with https.</p>
		{:else if picture}
			<p class="m-0 px-2 pb-1 text-[0.8rem] text-pretty text-muted">That is a picture. To make it a site's icon, paste it on that link's row above.</p>
		{/if}
	</div>
	<input bind:this={picker} type="file" accept="image/*,.svg,.ico" class="hidden" tabindex="-1" aria-hidden="true" onchange={onpick} />

	{#if routines.length === 0 && rotation.some((tool) => tool.action === undefined)}
		<p class="m-0 flex items-start gap-1.5 text-[0.82rem] leading-snug text-pretty text-muted">
			<Icon name="info" size={14} class="mt-0.5 shrink-0" />
			Nothing hands these out yet. Make an action here a routine, or open a link's settings and pick one.
		</p>
	{/if}

	{#if known.length}
		<div class="flex flex-col gap-1">
			<Button
				size="sm"
				variant="ghost"
				icon={showKnown ? 'chevron-down' : 'chevron-right'}
				class="self-start"
				aria-expanded={showKnown}
				aria-controls="shelf-{pillarIndex}-known"
				onclick={() => (showKnown = !showKnown)}
			>
				Known by now · {known.length}
			</Button>
			{#if showKnown}
				<ul id="shelf-{pillarIndex}-known" class="m-0 flex list-none flex-col gap-0.5 rounded-[22px] bg-bg p-1.5 opacity-90 motion-safe:animate-pop-in" aria-label="Known by now" out:foldOut>
					{#each known as tool (tool.id)}
						{@render row(tool)}
					{/each}
				</ul>
			{/if}
		</div>
	{/if}
</section>
