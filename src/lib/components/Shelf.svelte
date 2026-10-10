<script lang="ts">
	import { chart } from '$lib/chart/chart.svelte';
	import { fetchTitle, linkIn, nearKnown, openedLately, shelfOf } from '$lib/chart/tools';
	import { isRoutine } from '$lib/chart/model';
	import Icon from './Icon.svelte';
	import ToolFace from './ToolFace.svelte';
	import Button from './ui/Button.svelte';
	import Eyebrow from './ui/Eyebrow.svelte';
	import IconButton from './ui/IconButton.svelte';
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
	let rejected = $state(false);

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
			aria-invalid={rejected || undefined}
			bind:value={draft}
			{onpaste}
			{onkeydown}
			oninput={() => (rejected = false)}
		/>
	</div>
	{#if rejected}
		<p class="m-0 -mt-1 text-[0.8rem] text-muted">That is not a link. Paste one that starts with https.</p>
	{/if}

	{#if tools.length === 0}
		<p class="m-0 max-w-[48ch] text-[0.86rem] leading-snug text-pretty text-muted">
			The material this pillar's actions use: videos, texts, sites. A routine hands them out one a day in Today. Once the action is written, paste what it watches.
		</p>
	{:else}
		<ul class="m-0 flex list-none flex-col gap-1 p-0">
			{#each tools as tool (tool.id)}
				<li class="flex flex-col gap-2 rounded-[18px] bg-bg px-3 py-2.5" out:foldOut>
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
