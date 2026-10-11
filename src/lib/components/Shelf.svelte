<script lang="ts">
	import { chart } from '$lib/chart/chart.svelte';
	import { clipboardPicture, pastedPicture, readIcon } from '$lib/chart/site-icon';
	import { isApplePlatform, modifierLabel } from '$lib/chart/shortcuts';
	import { tick } from 'svelte';
	import { fetchTitle, hostOf, iconOf, linkIn, nearKnown, openedLately, shelfOf, thumbnailOf } from '$lib/chart/tools';
	import { isRoutine } from '$lib/chart/model';
	import Icon from './Icon.svelte';
	import ToolFace from './ToolFace.svelte';
	import Button from './ui/Button.svelte';
	import Eyebrow from './ui/Eyebrow.svelte';
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
	const inRotation = $derived(tools.filter((tool) => !tool.known).length);
	const routines = $derived(
		(chart.data.actions[pillarIndex] ?? []).flatMap((text, index) => (text.trim() && isRoutine(chart.data.meta?.[`a${pillarIndex}_${index}`]) ? [index] : []))
	);
	const uses = $derived([
		{ value: 'any', label: routines.length ? 'Any routine here' : 'Any routine here (none yet)' },
		...(chart.data.actions[pillarIndex] ?? []).flatMap((text, index) => (text.trim() ? [{ value: String(index), label: text.trim() }] : []))
	]);
	const kinds = [
		{ value: 'repeat', label: 'Repeat' },
		{ value: 'once', label: 'Once' }
	];
	const asked = $derived(new Set(nearKnown(chart.data).filter((entry) => entry.pillarIndex === pillarIndex).map((entry) => entry.tool.id)));

	let draft = $state('');
	let picker = $state<HTMLInputElement | null>(null);
	let iconFor = '';

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
</script>

<section class="mt-6 flex flex-col gap-3" aria-labelledby="shelf-{pillarIndex}">
	<div class="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
		<Eyebrow pip={pillarIndex}><span id="shelf-{pillarIndex}">Shelf</span></Eyebrow>
		{#if tools.length}
			<span class="text-[0.82rem] text-muted tabular-nums">{inRotation} in rotation{tools.length - inRotation ? `, ${tools.length - inRotation} known` : ''}</span>
		{/if}
	</div>

	<div class="relative">
		<span class="pointer-events-none absolute top-1/2 left-3.5 -translate-y-1/2 text-muted"><Icon name="link" size={16} /></span>
		<input
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
	<input bind:this={picker} type="file" accept="image/*,.svg,.ico" class="hidden" tabindex="-1" aria-hidden="true" onchange={onpick} />
	{#if rejected}
		<p class="m-0 -mt-1 text-[0.8rem] text-muted">That is not a link. Paste one that starts with https.</p>
	{:else if picture}
		<p class="m-0 -mt-1 text-[0.8rem] text-pretty text-muted">That is a picture. To make it a site's icon, paste it on that link's row below.</p>
	{/if}

	{#if tools.length === 0}
		<p class="m-0 max-w-[48ch] text-[0.86rem] leading-snug text-pretty text-muted">
			The material this pillar's actions use: videos, texts, sites. A routine hands them out one a day in Today. Once the action is written, paste what it watches.
		</p>
	{:else}
		<ul class="m-0 flex list-none flex-col gap-1 p-0">
			{#each tools as tool (tool.id)}
				{@const host = hostOf(tool.url)}
				{@const iconable = !thumbnailOf(tool.url)}
				<!-- Focusable by click, so a paste right after pointing at a row lands on that row's site. -->
				<li
					class="flex flex-col gap-2 rounded-[18px] bg-bg px-3 py-2.5 focus:outline-none"
					tabindex="-1"
					onpaste={iconable ? (event) => onRowPaste(event, tool.id, host) : undefined}
					out:foldOut
				>
					<div class="flex items-center gap-2">
						<a
							href={tool.url}
							target="_blank"
							rel="noopener noreferrer"
							class="min-w-0 flex-1 rounded-[12px] text-text no-underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink"
							onclick={() => chart.openTool(pillarIndex, tool.id)}
						>
							<ToolFace {tool} />
						</a>
						{#if iconable}
							{@const icon = iconOf(chart.data, tool.url)}
							<Menu
								label="Icon for {host}"
								bind:open={() => iconMenu === tool.id, (open) => (iconMenu = open ? tool.id : iconMenu === tool.id ? null : iconMenu)}
							>
								{#snippet trigger({ expanded, toggle })}
									<IconButton
										icon="image"
										label={icon ? `Icon for ${host}` : `Add an icon for ${host}`}
										class="size-9 text-muted hover:text-text"
										aria-haspopup="menu"
										aria-expanded={expanded}
										onclick={toggle}
									/>
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
						<IconButton icon="trash" label="Remove {tool.title}" class="size-9 text-muted hover:text-danger" onclick={() => chart.removeTool(pillarIndex, tool.id)} />
					</div>
					{#if asked.has(tool.id)}
						<p class="m-0 flex flex-wrap items-center gap-x-2 gap-y-1 text-[0.84rem] leading-snug text-pretty">
							<span>Opened on {openedLately(tool)} of the last 14 days. Know it by now?</span>
							<Button size="sm" onclick={() => chart.updateTool(pillarIndex, tool.id, { known: true })}>Know this</Button>
						</p>
					{/if}
					<div class="flex flex-wrap items-center gap-x-3 gap-y-2">
						<Select
							size="sm"
							class="w-[min(100%,16rem)]"
							label="Which action hands out {tool.title}"
							options={uses}
							value={tool.action === undefined ? 'any' : String(tool.action)}
							onchange={(value) => chart.updateTool(pillarIndex, tool.id, { action: value === 'any' ? undefined : Number(value) })}
						/>
						<SegmentedControl
							size="sm"
							label="How often {tool.title} comes round"
							options={kinds}
							value={tool.kind}
							onchange={(value) => chart.updateTool(pillarIndex, tool.id, { kind: value === 'once' ? 'once' : 'repeat' })}
						/>
						<Button
							size="sm"
							variant="ghost"
							icon={tool.known ? 'undo' : 'check'}
							aria-pressed={Boolean(tool.known)}
							onclick={() => chart.updateTool(pillarIndex, tool.id, { known: tool.known ? undefined : true })}
						>
							{tool.known ? 'Back in rotation' : 'Know this'}
						</Button>
					</div>
				</li>
			{/each}
		</ul>
		{#if routines.length === 0 && tools.some((tool) => tool.action === undefined)}
			<p class="m-0 flex items-start gap-1.5 text-[0.82rem] leading-snug text-pretty text-muted">
				<Icon name="info" size={14} class="mt-0.5 shrink-0" />
				Nothing hands these out yet. Make an action here a routine, or pick one above.
			</p>
		{/if}
	{/if}
</section>
