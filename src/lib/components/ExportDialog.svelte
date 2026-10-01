<script lang="ts">
	import { chart } from '$lib/chart/chart.svelte';
	import { exportFilename, exportJson } from '$lib/chart/model';
	import { exportChartPng } from '$lib/chart/export-image';
	import Button from './ui/Button.svelte';
	import Dialog from './ui/Dialog.svelte';
	import Icon from './Icon.svelte';

	interface Props {
		open?: boolean;
		oncopytext?: () => void;
	}

	let { open = $bindable(false), oncopytext }: Props = $props();

	let isExportingPng = $state(false);

	async function handleExportPoster(): Promise<void> {
		if (isExportingPng) return;
		isExportingPng = true;
		chart.say('Generating high-resolution poster…', true);
		try {
			await exportChartPng(chart.data);
			chart.say('Poster exported.');
			open = false;
		} catch {
			chart.say('Failed to generate poster image.');
		} finally {
			isExportingPng = false;
		}
	}

	function handleExportData(): void {
		const jsonContent = exportJson(chart.data);
		const filename = exportFilename(chart.data);
		const blob = new Blob([jsonContent], { type: 'application/json' });
		const downloadUrl = URL.createObjectURL(blob);
		const downloadLink = document.createElement('a');
		downloadLink.href = downloadUrl;
		downloadLink.download = filename;
		downloadLink.click();
		URL.revokeObjectURL(downloadUrl);
		chart.say(`Exported as ${filename}`);
		open = false;
	}

	function handleCopyText(): void {
		oncopytext?.();
		open = false;
	}
</script>

<Dialog
	bind:open
	title="Export chart"
	description="Choose how you want to save or share your chart."
	size="sm"
>
	<div class="flex flex-col gap-2.5">
		<button
			type="button"
			class="group flex w-full cursor-pointer items-center justify-between gap-3.5 rounded-[20px] border-0 bg-sunken p-3.5 text-start font-sans text-text motion-safe:transition-[background-color,transform] motion-safe:duration-150 hover:bg-sunken-hover active:scale-[0.98] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink"
			onclick={handleExportPoster}
			disabled={isExportingPng}
		>
			<div class="flex min-w-0 items-center gap-3">
				<div class="flex size-10 shrink-0 items-center justify-center rounded-full bg-surface text-muted shadow-card group-hover:text-text">
					<Icon name="image" size={18} />
				</div>
				<div class="flex min-w-0 flex-col gap-0.5">
					<span class="text-[0.92rem] font-[620]">
						{isExportingPng ? 'Generating poster…' : 'Poster image'}
					</span>
					<span class="text-[0.8rem] leading-[1.35] text-pretty text-muted">
						High-resolution graphic with the complete 9×9 grid.
					</span>
				</div>
			</div>
			<span class="shrink-0 rounded-[7px] bg-surface px-2 py-0.5 text-[0.72rem] font-[560] text-muted tabular-nums shadow-card">
				.png
			</span>
		</button>

		<button
			type="button"
			class="group flex w-full cursor-pointer items-center justify-between gap-3.5 rounded-[20px] border-0 bg-sunken p-3.5 text-start font-sans text-text motion-safe:transition-[background-color,transform] motion-safe:duration-150 hover:bg-sunken-hover active:scale-[0.98] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink"
			onclick={handleExportData}
		>
			<div class="flex min-w-0 items-center gap-3">
				<div class="flex size-10 shrink-0 items-center justify-center rounded-full bg-surface text-muted shadow-card group-hover:text-text">
					<Icon name="download" size={18} />
				</div>
				<div class="flex min-w-0 flex-col gap-0.5">
					<span class="text-[0.92rem] font-[620]">Data backup</span>
					<span class="text-[0.8rem] leading-[1.35] text-pretty text-muted">
						Complete chart data in JSON format for backup or transfer.
					</span>
				</div>
			</div>
			<span class="shrink-0 rounded-[7px] bg-surface px-2 py-0.5 text-[0.72rem] font-[560] text-muted tabular-nums shadow-card">
				.json
			</span>
		</button>

		<button
			type="button"
			class="group flex w-full cursor-pointer items-center justify-between gap-3.5 rounded-[20px] border-0 bg-sunken p-3.5 text-start font-sans text-text motion-safe:transition-[background-color,transform] motion-safe:duration-150 hover:bg-sunken-hover active:scale-[0.98] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink"
			onclick={handleCopyText}
		>
			<div class="flex min-w-0 items-center gap-3">
				<div class="flex size-10 shrink-0 items-center justify-center rounded-full bg-surface text-muted shadow-card group-hover:text-text">
					<Icon name="copy" size={18} />
				</div>
				<div class="flex min-w-0 flex-col gap-0.5">
					<span class="text-[0.92rem] font-[620]">Copy as text</span>
					<span class="text-[0.8rem] leading-[1.35] text-pretty text-muted">
						Formatted outline for notes, emails, or AI prompts.
					</span>
				</div>
			</div>
			<span class="shrink-0 rounded-[7px] bg-surface px-2 py-0.5 text-[0.72rem] font-[560] text-muted tabular-nums shadow-card">
				Text
			</span>
		</button>
	</div>

	{#snippet footer()}
		<Button variant="soft" onclick={() => (open = false)}>Close</Button>
	{/snippet}
</Dialog>
