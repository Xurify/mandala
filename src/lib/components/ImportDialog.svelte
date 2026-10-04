<script lang="ts">
	import { parseChart, parseText, type ChartData } from '$lib/chart/model';
	import Button from './ui/Button.svelte';
	import Dialog from './ui/Dialog.svelte';
	import Icon from './Icon.svelte';
	import { cn } from './ui/cn';
	import { textArea } from './ui/styles';

	interface Props {
		open?: boolean;
		onapply?: (data: ChartData) => void;
	}

	let { open = $bindable(false), onapply }: Props = $props();

	let rawText = $state('');
	let errorMessage = $state('');
	let isDraggingOver = $state(false);
	let fileInputElement: HTMLInputElement | null = $state(null);

	const parsedChart = $derived(
		rawText.trim() ? (parseChart(rawText) ?? parseText(rawText)) : null
	);
	const pillarCount = $derived(
		parsedChart ? parsedChart.pillars.filter((pillar) => pillar.trim().length > 0).length : 0
	);
	const actionCount = $derived(
		parsedChart
			? parsedChart.actions.reduce(
					(accumulator, row) =>
						accumulator + row.filter((action) => action.trim().length > 0).length,
					0
				)
			: 0
	);

	function resetState(): void {
		rawText = '';
		errorMessage = '';
		isDraggingOver = false;
	}

	$effect(() => {
		if (!open) {
			resetState();
		}
	});

	async function handlePasteFromClipboard(): Promise<void> {
		errorMessage = '';
		if (!navigator.clipboard?.readText) {
			errorMessage =
				'Clipboard reading is not supported in this browser. Please paste using keyboard shortcuts.';
			return;
		}

		try {
			const clipboardText = await navigator.clipboard.readText();
			if (clipboardText.trim()) {
				rawText = clipboardText;
			} else {
				errorMessage = 'Your clipboard is empty.';
			}
		} catch {
			errorMessage = 'Clipboard permission was not granted. Paste directly into the box instead.';
		}
	}

	function handleOpenFilePicker(): void {
		fileInputElement?.click();
	}

	async function handleFileSelected(event: Event): Promise<void> {
		const target = event.currentTarget as HTMLInputElement;
		const file = target.files?.[0];
		if (!file) return;

		await processFile(file);
		target.value = '';
	}

	function handleDragOver(event: DragEvent): void {
		event.preventDefault();
		isDraggingOver = true;
	}

	function handleDragLeave(event: DragEvent): void {
		event.preventDefault();
		isDraggingOver = false;
	}

	async function handleFileDrop(event: DragEvent): Promise<void> {
		event.preventDefault();
		isDraggingOver = false;
		const file = event.dataTransfer?.files?.[0];
		if (!file) return;

		await processFile(file);
	}

	async function processFile(file: File): Promise<void> {
		const isJson = file.name.endsWith('.json') || file.type === 'application/json';
		const isText = file.name.endsWith('.txt') || file.type === 'text/plain';

		if (!isJson && !isText) {
			errorMessage = 'Please choose a .json backup file or a .txt outline.';
			return;
		}

		try {
			const fileContent = await file.text();
			rawText = fileContent;
			errorMessage = '';
		} catch {
			errorMessage = 'Could not read the selected file.';
		}
	}

	function handleImport(): void {
		if (!parsedChart) {
			errorMessage = 'Please choose a valid chart file or paste chart text before importing.';
			return;
		}
		errorMessage = '';
		onapply?.(parsedChart);
	}
</script>

<input
	bind:this={fileInputElement}
	type="file"
	accept=".json,.txt,application/json,text/plain"
	class="hidden"
	onchange={handleFileSelected}
/>

<Dialog
	bind:open
	title="Import chart"
	description="Restore from a backup file, text outline, or clipboard."
	size="md"
>
	<div class="flex flex-col gap-3.5">
		<button
			type="button"
			class="group flex cursor-pointer flex-col items-center justify-center gap-1.5 rounded-[20px] border-2 border-dashed p-4.5 text-center motion-safe:transition-[background-color,border-color] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink {isDraggingOver
				? 'border-ink bg-sunken'
				: 'border-line bg-sunken/40 hover:border-ink/50 hover:bg-sunken'}"
			onclick={handleOpenFilePicker}
			ondragover={handleDragOver}
			ondragleave={handleDragLeave}
			ondrop={handleFileDrop}
		>
			<div class="flex size-9 items-center justify-center rounded-full bg-surface text-muted shadow-card group-hover:text-text">
				<Icon name="upload" size={17} />
			</div>
			<div class="text-[0.88rem] font-[580]">Choose a file or drop it here</div>
			<div class="text-[0.78rem] text-muted">Supports .json backups and .txt outlines</div>
		</button>

		<div class="flex items-center gap-3 text-[0.74rem] font-semibold tracking-[0.1em] text-muted uppercase">
			<span class="h-px flex-1 bg-line"></span>
			<span>or paste text</span>
			<span class="h-px flex-1 bg-line"></span>
		</div>

		<div class="flex flex-col gap-1.5">
			<div class="flex items-center justify-between gap-2">
				<span class="text-[0.78rem] font-semibold tracking-[0.08em] text-muted uppercase">
					Chart text
				</span>
				<Button
					type="button"
					size="sm"
					variant="soft"
					icon="clipboard"
					onclick={handlePasteFromClipboard}
				>
					Paste from clipboard
				</Button>
			</div>

			<textarea
				class={cn(textArea, 'h-48 text-[0.88rem] leading-[1.5]')}
				placeholder={`Goal: Launch your side project\n\nPillar 1: Product validation\n  - Interview 20 prospective users\n  - Build a landing page\n\nPillar 2: Rapid prototyping\n  - Build MVP in 2 weeks`}
				bind:value={rawText}
				spellcheck="false"
			></textarea>
		</div>

		{#if parsedChart}
			<div class="flex items-start gap-2.5 rounded-[18px] bg-bg px-4 py-3 text-[0.88rem] leading-[1.4] text-text shadow-card">
				<div class="mt-0.5 text-ink">
					<Icon name="check" size={16} strokeWidth={2.4} />
				</div>
				<div class="flex min-w-0 flex-col gap-0.5">
					<div class="truncate font-[620]">
						{parsedChart.goal || '(No goal specified)'}
					</div>
					<div class="text-[0.8rem] text-muted">
						{pillarCount} {pillarCount === 1 ? 'pillar' : 'pillars'} · {actionCount} {actionCount === 1 ? 'action' : 'actions'}
					</div>
				</div>
			</div>
		{:else if rawText.trim()}
			<div class="rounded-[18px] bg-sunken px-4 py-3 text-[0.86rem] leading-[1.4] text-danger" role="alert">
				Could not find a goal or pillars in this content. Make sure your text or file includes a goal or pillar names.
			</div>
		{/if}

		{#if errorMessage}
			<p class="m-0 text-[0.84rem] text-danger" role="alert">{errorMessage}</p>
		{/if}
	</div>

	{#snippet footer()}
		<Button variant="soft" onclick={() => (open = false)}>Cancel</Button>
		<Button variant="primary" onclick={handleImport} disabled={!parsedChart}>
			Import chart
		</Button>
	{/snippet}
</Dialog>
