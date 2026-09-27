<script lang="ts">
	import { draftPrompt, parseDraftText } from '$lib/chart/draft';
	import type { ChartData } from '$lib/chart/model';
	import Icon from './Icon.svelte';

	interface Props {
		open?: boolean;
		onclose?: () => void;
		onapply?: (data: ChartData) => void;
	}

	let { open = false, onclose, onapply }: Props = $props();

	const promptText = draftPrompt();

	let dialogElement: HTMLDialogElement | null = $state(null);
	let pasteOpen = $state(false);
	let reply = $state('');
	let errorText = $state('');
	let copied = $state(false);
	let copiedTimer: ReturnType<typeof setTimeout> | null = null;

	$effect(() => {
		const dialog = dialogElement;
		if (!dialog) return;
		if (open && !dialog.open) dialog.showModal();
		if (!open && dialog.open) dialog.close();
	});

	function resetDraft(): void {
		pasteOpen = false;
		reply = '';
		errorText = '';
		copied = false;
		if (copiedTimer) {
			clearTimeout(copiedTimer);
			copiedTimer = null;
		}
	}

	function requestClose(): void {
		onclose?.();
	}

	function handleDialogClose(): void {
		resetDraft();
		if (open) onclose?.();
	}

	function handleDialogClick(event: MouseEvent): void {
		if (event.target === dialogElement) requestClose();
	}

	async function copyPrompt(): Promise<void> {
		errorText = '';
		const fallback = () => {
			errorText = 'Copy was blocked. Select the prompt and copy it yourself.';
		};
		if (!navigator.clipboard?.writeText) {
			fallback();
			return;
		}
		try {
			await navigator.clipboard.writeText(promptText);
			copied = true;
			if (copiedTimer) clearTimeout(copiedTimer);
			copiedTimer = setTimeout(() => {
				copied = false;
			}, 2000);
		} catch {
			fallback();
		}
	}

	function applyReply(): void {
		const chart = parseDraftText(reply);
		if (!chart) {
			errorText = 'That reply has no complete chart. Ask for the JSON again.';
			return;
		}
		errorText = '';
		onapply?.(chart);
	}
</script>

<dialog
	bind:this={dialogElement}
	class="method-dialog draft-dialog"
	aria-labelledby="draft-title"
	onclick={handleDialogClick}
	onclose={handleDialogClose}
>
	<div class="method-sheet">
		<div class="method-head">
			<div>
				<h2 id="draft-title">Prompt</h2>
				<p class="draft-sub">Paste into ChatGPT, Claude, or Gemini.</p>
			</div>
			<button type="button" class="method-close" onclick={requestClose} aria-label="Close">
				<Icon name="close" size={16} />
			</button>
		</div>
		<div class="method-body draft-form">
			<p class="draft-note">
				Fill the blanks in the chat. Add what you know about the direction, your situation, and the
				separate aims.
			</p>
			<div class="draft-panel">
				<pre class="draft-prompt-text">{promptText}</pre>
				<div class="draft-panel-foot">
					<button class="draft-copy" type="button" onclick={copyPrompt}>
						<Icon name="copy" size={14} />
						<span>{copied ? 'Copied' : 'Copy prompt'}</span>
					</button>
				</div>
			</div>
			{#if !pasteOpen}
				<button class="draft-reveal" type="button" onclick={() => (pasteOpen = true)}>
					Paste a reply
				</button>
			{:else}
				<label class="draft-field">
					<span>Paste the reply</span>
					<textarea rows="3" placeholder="Paste the JSON when it comes back" bind:value={reply}
					></textarea>
				</label>
				<div class="draft-panel-foot">
					<button class="draft-copy" type="button" onclick={applyReply}>Use this chart</button>
				</div>
			{/if}
			{#if errorText}
				<p class="draft-error" role="alert">{errorText}</p>
			{/if}
		</div>
	</div>
</dialog>
