<script lang="ts">
	import { labelOfKey, type ChartData } from '$lib/chart/model';
	import Button from './ui/Button.svelte';
	import Dialog from './ui/Dialog.svelte';
	import Icon from './Icon.svelte';

	interface Props {
		open?: boolean;
		data?: ChartData | null;
		onapply?: (data: ChartData) => void;
	}

	let { open = $bindable(false), data = null, onapply }: Props = $props();

	const pillarCount = $derived(data ? data.pillars.filter((pillar) => pillar.trim().length > 0).length : 0);
	const actionCount = $derived(
		data
			? data.actions.reduce(
					(accumulator, row) => accumulator + row.filter((action) => action.trim().length > 0).length,
					0
				)
			: 0
	);
	const dayCount = $derived(data?.days ? Object.keys(data.days).length : 0);
</script>

<Dialog
	bind:open
	title="A chart was shared with you"
	description="Importing adds it as a new chart. Your current charts stay untouched."
	size="sm"
>
	{#if data}
		<div class="flex items-start gap-2.5 rounded-[18px] bg-sunken px-4 py-3 text-[0.88rem] leading-[1.4] text-text">
			<div class="mt-0.5 text-ink">
				<Icon name="link" size={16} />
			</div>
			<div class="flex min-w-0 flex-col gap-0.5">
				<div class="truncate font-[620]">{data.goal.trim() || '(No goal specified)'}</div>
				<div class="text-[0.8rem] text-muted">
					{pillarCount} {pillarCount === 1 ? 'pillar' : 'pillars'} · {actionCount} {actionCount === 1 ? 'action' : 'actions'}{dayCount > 0 ? ` · ${dayCount} day${dayCount === 1 ? '' : 's'} of history` : ''}
				</div>
			</div>
		</div>
	{/if}

	{#snippet footer()}
		<Button variant="soft" onclick={() => (open = false)}>Not now</Button>
		<Button disabled={!data} onclick={() => data && onapply?.(data)}>Add as new chart</Button>
	{/snippet}
</Dialog>
