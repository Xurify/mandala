<script lang="ts">
	import { draftPrompt, parseDraftText } from '$lib/chart/draft';
	import type { ChartData } from '$lib/chart/model';
	import Button from './ui/Button.svelte';
	import Dialog from './ui/Dialog.svelte';

	interface Props {
		open?: boolean;
		onapply?: (data: ChartData) => void;
	}

	let { open = $bindable(false), onapply }: Props = $props();

	const promptText = draftPrompt();

	let pasteOpen = $state(false);
	let reply = $state('');
	let errorText = $state('');
	let copied = $state(false);
	let copiedTimer: ReturnType<typeof setTimeout> | null = null;

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

	$effect(() => {
		if (open) return;
		resetDraft();
	});

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

<Dialog
	bind:open
	title="Prompt"
	description="Paste into ChatGPT, Claude, or Gemini."
	size="sm"
>
	<div class="flex flex-col gap-3.5">
		<p class="m-0 rounded-[18px] bg-sunken px-4 py-3.5 text-[0.88rem] leading-[1.45] text-pretty text-muted">
			Fill the blanks in the chat. Add what you know about the direction, your situation, and the
			separate aims.
		</p>
		<div class="flex min-h-0 flex-col overflow-hidden rounded-[20px] bg-bg shadow-card">
			<pre
				class="m-0 max-h-[min(40vh,340px)] overflow-auto px-[18px] py-4 font-sans text-[0.86rem] leading-[1.55] break-words whitespace-pre-wrap text-text overscroll-contain"
			>{promptText}</pre>
			<div class="flex justify-end border-t border-line p-2">
				<Button size="sm" icon="copy" onclick={copyPrompt}>{copied ? 'Copied' : 'Copy prompt'}</Button>
			</div>
		</div>
		{#if !pasteOpen}
			<button
				class="cursor-pointer self-start border-0 bg-transparent px-0.5 py-1 font-sans text-[0.88rem] font-[560] text-text underline decoration-line underline-offset-4 hover:decoration-text focus-visible:rounded focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink"
				type="button"
				onclick={() => (pasteOpen = true)}
			>
				Paste a reply
			</button>
		{:else}
			<label class="flex flex-col gap-1.5">
				<span class="text-[0.82rem] font-semibold">Paste the reply</span>
				<textarea
					class="resize-y rounded-2xl border-0 bg-sunken px-3.5 py-3 font-sans text-[0.95rem] leading-[1.45] text-text focus-visible:bg-surface focus-visible:shadow-[0_0_0_1.5px_var(--ink)] focus-visible:outline-none"
					rows="3"
					placeholder="Paste the JSON when it comes back"
					bind:value={reply}
				></textarea>
			</label>
			<div class="flex items-center justify-end gap-2">
				<Button onclick={applyReply}>Use this chart</Button>
			</div>
		{/if}
		{#if errorText}
			<p class="m-0 text-[0.88rem] text-danger" role="alert">{errorText}</p>
		{/if}
	</div>
</Dialog>
