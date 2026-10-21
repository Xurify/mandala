<script lang="ts">
	import { chart } from '$lib/chart/chart.svelte';
	import { formatAgo } from '$lib/chart/library';
	import Icon from './Icon.svelte';
	import Button from './ui/Button.svelte';
	import Dialog from './ui/Dialog.svelte';
	import Eyebrow from './ui/Eyebrow.svelte';
	import IconButton from './ui/IconButton.svelte';
	import QrCode from './QrCode.svelte';
	import { cn } from './ui/cn';
	import { textField } from './ui/styles';

	interface Props {
		open?: boolean;
		/** A key that arrived in a link, waiting for the person to say yes. */
		joining?: string | null;
	}

	let { open = $bindable(false), joining = $bindable(null) }: Props = $props();

	const sync = chart.sync;
	const SAVED_NAME = 'Mandala sync';
	let typing = $state(false);
	let typed = $state('');
	let wrong = $state(false);
	let copied = $state<'link' | 'key' | null>(null);
	let leaving = $state(false);
	let showKey = $state(false);
	let typedVisible = $state(false);
	let saved = $state(false);
	let saveForm = $state<HTMLFormElement | null>(null);
	let clock = $state(Date.now());

	const asking = $derived(joining !== null && joining !== sync.key);
	const link = $derived(sync.key && typeof location !== 'undefined' ? `${location.origin}/#sync=${sync.key}` : '');
	const title = $derived(
		asking ? 'Sync this device?' : !sync.key ? 'Your charts on every device' : sync.status === 'unavailable' ? 'Sync cannot run here' : 'Sync is on'
	);

	const status = $derived.by((): string => {
		if (sync.status === 'syncing') return 'Syncing…';
		if (sync.status === 'offline') return 'Offline. It catches up when the connection is back.';
		if (sync.status === 'limited') return 'Paused for a moment, after a lot at once. It goes on by itself.';
		if (sync.status === 'unavailable') return 'This copy of Mandala has no database for sync, so your charts stay on this device.';
		if (sync.status === 'error') return sync.problem || 'Something went wrong. It tries again soon.';
		if (sync.lastAt === null) return 'Not synced yet.';
		const ago = formatAgo(sync.lastAt, clock);
		return ago === 'Just now' ? 'Synced just now.' : `Synced ${ago.endsWith('ago') ? ago : `at ${ago}`}.`;
	});

	$effect(() => {
		if (!open) return;
		clock = Date.now();
		const timer = setInterval(() => (clock = Date.now()), 20_000);
		return () => clearInterval(timer);
	});

	$effect(() => {
		if (open) return;
		typing = false;
		typed = '';
		wrong = false;
		leaving = false;
		showKey = false;
		typedVisible = false;
		saved = false;
		joining = null;
	});

	function turnOn(): void {
		sync.turnOn();
	}

	function join(key: string): void {
		if (!sync.join(key)) {
			wrong = true;
			return;
		}
		joining = null;
		typing = false;
		typed = '';
		wrong = false;
	}

	function turnOff(): void {
		sync.turnOff();
		leaving = false;
		chart.say('Sync turned off on this device.');
	}

	/**
	 * Chromium stores it through the credential API. Other browsers offer to save a password when a form that
	 * holds one is submitted, so the hidden form is submitted and the page stays put.
	 */
	async function saveToPasswords(): Promise<void> {
		const key = sync.key;
		if (!key) return;
		// Newer than the TS DOM lib.
		const Saved = (window as unknown as { PasswordCredential?: new (data: { id: string; name: string; password: string }) => Credential }).PasswordCredential;
		if (Saved) {
			try {
				await navigator.credentials.store(new Saved({ id: SAVED_NAME, name: SAVED_NAME, password: key }));
				saved = true;
				return;
			} catch {}
		}
		saveForm?.requestSubmit();
		saved = true;
	}

	async function copy(what: 'link' | 'key'): Promise<void> {
		const text = what === 'link' ? link : (sync.key ?? '');
		try {
			await navigator.clipboard.writeText(text);
			copied = what;
			setTimeout(() => {
				if (copied === what) copied = null;
			}, 2000);
		} catch {
			chart.say('Could not copy. Show the key and copy it by hand.');
		}
	}
</script>

<Dialog bind:open {title} size="sm">
	{#if asking}
		<p class="m-0 text-[0.95rem] leading-[1.5] text-pretty">
			The charts on this device and on your other one will be on both. Nothing here is removed.
		</p>
		{#if sync.key}
			<p class="m-0 mt-3 text-[0.9rem] leading-[1.5] text-pretty text-muted">
				This device syncs with another key now. It moves to this one, and the charts it already has come along.
			</p>
		{/if}
	{:else if sync.key}
		<div class="flex items-center gap-2" aria-live="polite">
			<p class="m-0 min-w-0 flex-1 text-[0.95rem] leading-[1.45] text-pretty" data-sync-status={sync.status}>{status}</p>
			<IconButton icon="refresh" label="Sync now" disabled={sync.status === 'syncing'} onclick={() => void sync.now()} />
		</div>
		{#if sync.status !== 'unavailable'}
			<Eyebrow class="mt-6 mb-3">Add another device</Eyebrow>
			<div class="flex flex-col items-center gap-3 rounded-[22px] bg-sunken px-4 pt-5 pb-4">
				<QrCode text={link} label="QR code that opens Mandala on another device" class="size-[184px]" />
				<p class="m-0 text-center text-[0.92rem] leading-[1.45] text-pretty">Scan this with your phone's camera. Only on your own devices.</p>
			</div>
			<div class="mt-3 flex flex-wrap gap-2">
				<Button variant="soft" size="sm" icon={copied === 'link' ? 'check' : 'link'} onclick={() => void copy('link')}>
					{copied === 'link' ? 'Link copied' : 'Copy link'}
				</Button>
				<Button variant="soft" size="sm" icon={saved ? 'check' : 'key'} onclick={() => void saveToPasswords()}>
					{saved ? 'Offered to your passwords' : 'Save to passwords'}
				</Button>
				<Button variant="ghost" size="sm" icon="eye" aria-expanded={showKey} onclick={() => (showKey = !showKey)}>
					{showKey ? 'Hide the key' : 'Show the key'}
				</Button>
			</div>
			{#if showKey}
				<div class="mt-3 flex items-center gap-2 rounded-[18px] bg-sunken py-1.5 ps-4 pe-1.5">
					<span class="min-w-0 flex-1 text-[1rem] font-[560] tracking-[0.06em] tabular-nums select-all" data-sync-key>
						{#each sync.key.split('-') as part, index (index)}{#if index > 0}-<wbr />{/if}<span class="whitespace-nowrap">{part}</span>{/each}
					</span>
					<IconButton icon={copied === 'key' ? 'check' : 'copy'} label={copied === 'key' ? 'Key copied' : 'Copy key'} onclick={() => void copy('key')} />
				</div>
				<p class="m-0 mt-2 text-[0.84rem] leading-[1.45] text-pretty text-muted">Type it on a device that cannot scan. Whoever has it can open your charts.</p>
			{/if}
			<form bind:this={saveForm} class="sr-only" aria-hidden="true" onsubmit={(event) => event.preventDefault()}>
				<input type="text" name="username" autocomplete="username" value={SAVED_NAME} tabindex="-1" readonly />
				<input type="password" name="password" autocomplete="new-password" value={sync.key} tabindex="-1" readonly />
			</form>
		{/if}
		{#if leaving}
			<p class="m-0 mt-5 text-[0.92rem] leading-[1.5] text-pretty" role="alert">
				Your charts stay on this device. To sync it again later, you need another synced device or the key in your saved passwords.
			</p>
		{/if}
	{:else}
		<p class="m-0 text-[0.95rem] leading-[1.5] text-pretty">
			Keep the same charts on your phone and your computer.
		</p>
		{#if typing}
			<p class="m-0 mt-3 text-[0.9rem] leading-[1.5] text-pretty text-muted">
				Easiest is to scan the code on your other device. Or paste the key, or pick it from your saved passwords.
			</p>
			<input class="sr-only" type="text" autocomplete="username" value={SAVED_NAME} tabindex="-1" aria-hidden="true" readonly />
			<label class="mt-4 flex flex-col gap-1.5">
				<span class="text-[0.84rem] font-[560]">Sync key</span>
				<span class="relative">
				<input
					class={cn(textField, 'pe-12')}
					type={typedVisible ? 'text' : 'password'}
					autocomplete="current-password"
					autocapitalize="off"
					spellcheck="false"
					placeholder="xxxxx-xxxxx-xxxxx-xxxxx-xxxxx"
					aria-invalid={wrong}
					aria-describedby={wrong ? 'sync-key-wrong' : undefined}
					bind:value={typed}
					oninput={() => (wrong = false)}
					onkeydown={(event) => {
						if (event.key === 'Enter') join(typed);
					}}
					{@attach (node: HTMLInputElement) => node.focus()}
				/>
				<IconButton
					icon="eye"
					label={typedVisible ? 'Hide the key' : 'Show the key'}
					aria-pressed={typedVisible}
					class="absolute end-0 top-0 size-[42px]"
					onclick={() => (typedVisible = !typedVisible)}
				/>
				</span>
			</label>
			{#if wrong}
				<p id="sync-key-wrong" class="m-0 mt-2 flex items-center gap-1.5 text-[0.84rem] text-danger">
					<Icon name="info" size={16} />That is not a sync key. It is 25 letters and numbers.
				</p>
			{/if}
		{/if}
	{/if}

	{#snippet footer()}
		{#if asking}
			<Button variant="soft" onclick={() => (open = false)}>Not now</Button>
			<Button onclick={() => joining && join(joining)}>Sync this device</Button>
		{:else if sync.key}
			{#if leaving}
				<Button variant="soft" onclick={() => (leaving = false)}>Keep sync</Button>
				<Button variant="danger" onclick={turnOff}>Turn off here</Button>
			{:else}
				<Button variant="ghost" onclick={() => (leaving = true)}>Turn off here</Button>
				<Button variant="soft" onclick={() => (open = false)}>Done</Button>
			{/if}
		{:else if typing}
			<Button variant="soft" onclick={() => (typing = false)}>Back</Button>
			<Button disabled={typed.trim().length === 0} onclick={() => join(typed)}>Sync this device</Button>
		{:else}
			<Button variant="ghost" onclick={() => (typing = true)}>I have a sync key</Button>
			<Button onclick={turnOn} data-autofocus>Turn on sync</Button>
		{/if}
	{/snippet}
</Dialog>
