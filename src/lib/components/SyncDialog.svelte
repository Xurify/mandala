<script lang="ts">
	import { chart } from '$lib/chart/chart.svelte';
	import { formatAgo } from '$lib/chart/library';
	import Icon from './Icon.svelte';
	import Button from './ui/Button.svelte';
	import Dialog from './ui/Dialog.svelte';
	import Eyebrow from './ui/Eyebrow.svelte';
	import IconButton from './ui/IconButton.svelte';
	import { textField } from './ui/styles';

	interface Props {
		open?: boolean;
		/** A key that arrived in a link, waiting for the person to say yes. */
		joining?: string | null;
	}

	let { open = $bindable(false), joining = $bindable(null) }: Props = $props();

	const sync = chart.sync;
	let typing = $state(false);
	let typed = $state('');
	let wrong = $state(false);
	let copied = $state<'link' | 'key' | null>(null);
	let leaving = $state(false);
	let clock = $state(Date.now());

	const asking = $derived(joining !== null && joining !== sync.key);
	const link = $derived(sync.key && typeof location !== 'undefined' ? `${location.origin}/#sync=${sync.key}` : '');
	const title = $derived(
		asking ? 'Sync this device?' : !sync.key ? 'Your charts on every device' : sync.status === 'unavailable' ? 'Sync cannot run here' : 'Sync is on'
	);

	const status = $derived.by((): string => {
		if (sync.status === 'syncing') return 'Syncing…';
		if (sync.status === 'offline') return 'Offline. It catches up when the connection is back.';
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

	async function copy(what: 'link' | 'key'): Promise<void> {
		const text = what === 'link' ? link : (sync.key ?? '');
		try {
			await navigator.clipboard.writeText(text);
			copied = what;
			setTimeout(() => {
				if (copied === what) copied = null;
			}, 2000);
		} catch {
			chart.say('Could not copy. Select the key and copy it by hand.');
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
			<Eyebrow class="mt-6 mb-2">Add another device</Eyebrow>
			<p class="m-0 text-[0.92rem] leading-[1.5] text-pretty text-muted">
				Open this link on your phone or another computer. It carries the key, so send it only to yourself.
			</p>
			<Button class="mt-3 w-full" icon={copied === 'link' ? 'check' : 'link'} onclick={() => void copy('link')} data-autofocus>
				{copied === 'link' ? 'Link copied' : 'Copy link'}
			</Button>

			<p class="m-0 mt-5 mb-2 text-[0.84rem] text-muted">Or type this key there</p>
			<div class="flex items-center gap-2 rounded-[18px] bg-sunken py-1.5 ps-4 pe-1.5">
				<span class="min-w-0 flex-1 text-[1rem] font-[560] tracking-[0.06em] tabular-nums select-all" data-sync-key>
					{#each sync.key.split('-') as part, index (index)}{#if index > 0}-<wbr />{/if}<span class="whitespace-nowrap">{part}</span>{/each}
				</span>
				<IconButton icon={copied === 'key' ? 'check' : 'copy'} label={copied === 'key' ? 'Key copied' : 'Copy key'} onclick={() => void copy('key')} />
			</div>
			<p class="m-0 mt-3 text-[0.84rem] leading-[1.45] text-pretty text-muted">
				Anyone with this key can read and change your charts. Keep it like a password. Charts are sealed on this device with it, so the server keeps a copy it cannot read.
			</p>
		{/if}
		{#if leaving}
			<p class="m-0 mt-5 text-[0.92rem] leading-[1.5] text-pretty" role="alert">
				Your charts stay on this device. To turn sync back on here, you will need the key from another device, so copy it first if this is the only one.
			</p>
		{/if}
	{:else}
		<p class="m-0 text-[0.95rem] leading-[1.5] text-pretty">
			Keep the same charts on your phone and your computer. They are sealed on this device before they leave, with a key only your devices hold.
		</p>
		{#if typing}
			<label class="mt-5 flex flex-col gap-1.5">
				<span class="text-[0.84rem] font-[560]">Sync key from your other device</span>
				<input
					class={textField}
					type="text"
					autocomplete="off"
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
			<Button variant="ghost" onclick={() => (typing = true)}>I have a key</Button>
			<Button onclick={turnOn} data-autofocus>Turn on sync</Button>
		{/if}
	{/snippet}
</Dialog>
