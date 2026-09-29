<script lang="ts">
	import { getPreset, listPresets, type Preset, type PresetId } from '$lib/chart/presets';
	import Icon from './Icon.svelte';

	interface Props {
		open?: boolean;
		onclose?: () => void;
		onapply?: (preset: Preset) => void;
	}

	let { open = false, onclose, onapply }: Props = $props();

	const summaries = listPresets();

	let dialogElement: HTMLDialogElement | null = $state(null);
	let selectedId = $state<PresetId>('language');

	const selected = $derived(getPreset(selectedId));

	$effect(() => {
		const dialog = dialogElement;
		if (!dialog) return;
		if (open && !dialog.open) dialog.showModal();
		if (!open && dialog.open) dialog.close();
	});

	function resetPicker(): void {
		selectedId = 'language';
	}

	function requestClose(): void {
		onclose?.();
	}

	function handleDialogClose(): void {
		resetPicker();
		if (open) onclose?.();
	}

	function handleDialogClick(event: MouseEvent): void {
		if (event.target === dialogElement) requestClose();
	}

	function applySelected(): void {
		if (selected) onapply?.(selected);
	}
</script>

<dialog
	bind:this={dialogElement}
	class="method-dialog preset-dialog"
	aria-labelledby="preset-title"
	onclick={handleDialogClick}
	onclose={handleDialogClose}
>
	<div class="method-sheet">
		<div class="method-head">
			<div>
				<h2 id="preset-title">Presets</h2>
				<p class="draft-sub">Each one fills the whole chart. Edit anything after.</p>
			</div>
			<button type="button" class="icon-btn" onclick={requestClose} aria-label="Close">
				<Icon name="close" size={18} />
			</button>
		</div>
		<div class="method-body draft-form">
			<fieldset class="preset-list">
				<legend class="visually-hidden">Choose a preset</legend>
				{#each summaries as summary (summary.id)}
					<label class="preset-option">
						<input type="radio" name="preset" value={summary.id} bind:group={selectedId} />
						<span class="preset-option-copy">
							<span class="preset-option-title">{summary.title}</span>
							<span class="preset-option-goal">{summary.goal}</span>
						</span>
					</label>
				{/each}
			</fieldset>
			{#if selected}
				<div class="preset-preview">
					<h3>Pillars</h3>
					<ol class="preset-pillars">
						{#each selected.pillars as pillar (pillar)}
							<li>{pillar}</li>
						{/each}
					</ol>
				</div>
			{/if}
			<div class="dialog-foot">
				<button class="btn btn-ghost" type="button" onclick={requestClose}>Cancel</button>
				<button class="btn btn-primary" type="button" onclick={applySelected}>Use this preset</button>
			</div>
		</div>
	</div>
</dialog>
