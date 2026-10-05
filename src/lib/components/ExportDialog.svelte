<script lang="ts">
	import { chart } from '$lib/chart/chart.svelte';
	import { exportFilename, exportJson } from '$lib/chart/model';
	import { exportChartPng } from '$lib/chart/export-image';
	import { shareUrl } from '$lib/chart/share';
	import { shareUrl as publishedUrl } from '$lib/chart/sync/publish';
	import Button from './ui/Button.svelte';
	import BouncingDots from './ui/BouncingDots.svelte';
	import Dialog from './ui/Dialog.svelte';
	import Icon from './Icon.svelte';

	interface Props {
		open?: boolean;
		oncopytext?: () => void;
	}

	let { open = $bindable(false), oncopytext }: Props = $props();

	let isExportingPng = $state(false);
	let isSharing = $state(false);

	async function handlePublish(): Promise<void> {
		try {
			const existing = chart.shareId !== '';
			await chart.publishShare();
			if (chart.shareId) {
				await navigator.clipboard.writeText(publishedUrl(chart.shareId));
				chart.say(existing ? 'Share page updated. Link copied.' : 'Share page published. Link copied.');
			}
		} catch (error) {
			chart.say(error instanceof Error ? error.message : 'Could not publish here.');
		}
	}

	function pagePath(id: string): string {
		return `/s/${id}`;
	}

	async function handleCopyLink(): Promise<void> {
		try {
			await navigator.clipboard.writeText(publishedUrl(chart.shareId));
			chart.say('Link copied.');
		} catch {
			chart.say('Could not copy the link here.');
		}
	}

	async function handleStopSharing(): Promise<void> {
		try {
			await chart.stopSharing();
			chart.say('Sharing stopped. The link no longer works.');
		} catch (error) {
			chart.say(error instanceof Error ? error.message : 'Could not stop sharing.');
		}
	}

	async function handleShareLink(): Promise<void> {
		if (isSharing) return;
		isSharing = true;
		try {
			const url = await shareUrl(chart.data);
			await navigator.clipboard.writeText(url);
			chart.say('Share link copied.');
			open = false;
		} catch {
			chart.say('Could not create the share link here.');
		} finally {
			isSharing = false;
		}
	}

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
			class="group flex w-full cursor-pointer items-center justify-between gap-3.5 rounded-[20px] border-0 p-3.5 text-start font-sans text-text bg-sunken motion-safe:transition-[scale] motion-safe:duration-150 hover:bg-sunken-hover active:scale-[0.98] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink"
			onclick={handleExportPoster}
			disabled={isExportingPng}
		>
			<div class="flex min-w-0 items-center gap-3">
				<div class="flex size-10 shrink-0 items-center justify-center rounded-full bg-surface text-muted shadow-card group-hover:text-text">
					<Icon name="image" size={18} />
				</div>
				<div class="flex min-w-0 flex-col gap-0.5">
					<span class="text-[0.92rem] font-[620]">
						{#if isExportingPng}
							<span class="inline-flex items-center">
								Generating poster
								<BouncingDots />
							</span>
						{:else}
							Poster image
						{/if}
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
			class="group flex w-full cursor-pointer items-center justify-between gap-3.5 rounded-[20px] border-0 p-3.5 text-start font-sans text-text bg-sunken motion-safe:transition-[scale] motion-safe:duration-150 hover:bg-sunken-hover active:scale-[0.98] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink"
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
			class="group flex w-full cursor-pointer items-center justify-between gap-3.5 rounded-[20px] border-0 p-3.5 text-start font-sans text-text bg-sunken motion-safe:transition-[scale] motion-safe:duration-150 hover:bg-sunken-hover active:scale-[0.98] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink"
			onclick={handleShareLink}
			disabled={isSharing}
		>
			<div class="flex min-w-0 items-center gap-3">
				<div class="flex size-10 shrink-0 items-center justify-center rounded-full bg-surface text-muted shadow-card group-hover:text-text">
					<Icon name="link" size={18} />
				</div>
			<div class="flex min-w-0 flex-col gap-0.5">
				<span class="text-[0.92rem] font-[620]">Share link</span>
				<span class="text-[0.8rem] leading-[1.35] text-pretty text-muted">
					The whole chart carried in the link. No account needed.
				</span>
			</div>
			</div>
			<span class="shrink-0 rounded-[7px] bg-surface px-2 py-0.5 text-[0.72rem] font-[560] text-muted tabular-nums shadow-card">
				Link
			</span>
		</button>

		<button
			type="button"
			class="group flex w-full cursor-pointer items-center justify-between gap-3.5 rounded-[20px] border-0 p-3.5 text-start font-sans text-text bg-sunken motion-safe:transition-[scale] motion-safe:duration-150 hover:bg-sunken-hover active:scale-[0.98] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink"
			onclick={handlePublish}
			disabled={chart.shareBusy}
		>
			<div class="flex min-w-0 items-center gap-3">
				<div class="flex size-10 shrink-0 items-center justify-center rounded-full bg-surface text-muted shadow-card group-hover:text-text">
					<Icon name="eye" size={18} />
				</div>
				<div class="flex min-w-0 flex-col gap-0.5">
						<span class="text-[0.92rem] font-[620]">{chart.shareId ? 'Update share page' : 'Publish a share page'}</span>
						<span class="text-[0.8rem] leading-[1.35] text-pretty text-muted">
							A read-only page that stays current when your chart changes.
						</span>
					</div>
			</div>
			<span class="shrink-0 rounded-[7px] bg-surface px-2 py-0.5 text-[0.72rem] font-[560] text-muted tabular-nums shadow-card">
				Live
			</span>
		</button>

		{#if chart.shareId}
			<div class="flex flex-col gap-3 rounded-[20px] bg-sunken p-3.5">
				<div class="flex items-center justify-between gap-3">
					<div class="flex min-w-0 flex-col gap-0.5">
						<span class="text-[0.84rem] font-[620]">Share page is live</span>
						<a
							class="truncate text-[0.8rem] text-muted underline decoration-ink/30 hover:text-text"
							href={pagePath(chart.shareId)}
							target="_blank"
							rel="noreferrer"
						>{publishedUrl(chart.shareId)}</a>
					</div>
					<Button size="sm" variant="soft" onclick={handleCopyLink}>Copy link</Button>
				</div>
				<label class="flex cursor-pointer items-center justify-between gap-3 text-[0.84rem]">
					<span>
						Keep the page up to date
						<span class="block text-[0.78rem] text-muted">Publishes automatically after edits, about 4 seconds later.</span>
					</span>
					<input
						type="checkbox"
						class="size-4 shrink-0 cursor-pointer"
						checked={chart.autoShare}
						onchange={(event) => chart.setAutoShare(event.currentTarget.checked)}
					/>
				</label>
				<div class="flex items-center justify-between gap-3">
					<span class="text-[0.78rem] text-muted">
						{#if chart.shareUpdatedAt !== null}
							Updated {new Date(chart.shareUpdatedAt).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}
						{/if}
					</span>
					<Button size="sm" variant="danger" disabled={chart.shareBusy} onclick={handleStopSharing}>Stop sharing</Button>
				</div>
			</div>
		{/if}

		<button
			type="button"
			class="group flex w-full cursor-pointer items-center justify-between gap-3.5 rounded-[20px] border-0 p-3.5 text-start font-sans text-text bg-sunken motion-safe:transition-[scale] motion-safe:duration-150 hover:bg-sunken-hover active:scale-[0.98] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink"
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
