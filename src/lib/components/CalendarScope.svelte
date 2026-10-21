<script lang="ts">
	import { untrack } from 'svelte';
	import { chart } from '$lib/chart/chart.svelte';
	import Icon from './Icon.svelte';
	import MenuTitle from './MenuTitle.svelte';
	import Eyebrow from './ui/Eyebrow.svelte';
	import Menu from './ui/Menu.svelte';
	import MenuDivider from './ui/MenuDivider.svelte';
	import MenuItem from './ui/MenuItem.svelte';

	const scoped = $derived(chart.goals.find((goal) => goal.id === chart.calendarScope));
	const title = $derived(chart.goals.length === 1 ? (chart.goals[0]?.title ?? '') : (scoped?.title ?? 'All charts'));
	const listed = $derived.by(() => {
		const at = new Map(chart.charts.map((item) => [item.id, item.updatedAt]));
		return chart.goals.slice().sort((a, b) => (at.get(b.id) ?? 0) - (at.get(a.id) ?? 0));
	});
	let open = $state(false);

	$effect(() => {
		chart.viewMode;
		untrack(() => {
			open = false;
		});
	});

	const titleClass =
		'm-0 font-serif text-[clamp(1.85rem,3.4vw,2.55rem)] leading-[1.12] font-[460] tracking-[-0.015em] text-text max-[900px]:text-[clamp(1.7rem,7.2vw,2.15rem)]';
</script>

<Eyebrow class="mb-2">Your calendar</Eyebrow>
{#if chart.goals.length > 1}
	<Menu class="max-w-full [&_[role=menu]]:w-[min(24rem,calc(100vw-32px))]" align="start" label="Charts on the calendar" bind:open>
		{#snippet trigger({ expanded, toggle })}
			<MenuTitle {title} label="Charts on the calendar: {title}" {expanded} onclick={toggle} />
		{/snippet}
		{@render scope('all', 'All charts', 'calendar')}
		<MenuDivider />
		{#each listed as goal (goal.id)}
			{@render scope(goal.id, goal.title)}
		{/each}
	</Menu>
{:else}
	<h1 class={titleClass}>{title}</h1>
{/if}

{#snippet scope(id: string, label: string, icon?: 'calendar')}
	{@const chosen = (scoped?.id ?? 'all') === id}
	<MenuItem {icon} active={chosen} onclick={() => (chart.calendarScope = id)}>
		<span class="flex min-w-0 flex-1 items-center justify-between gap-3">
			<span class="truncate">{label}</span>
			{#if chosen}<Icon name="check" size={16} class="shrink-0" />{/if}
		</span>
	</MenuItem>
{/snippet}
