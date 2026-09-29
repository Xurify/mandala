<script lang="ts">
	import { chart } from '$lib/chart/chart.svelte';
	import { titleOf } from '$lib/chart/library';
	import Icon from './Icon.svelte';
	import Menu from './ui/Menu.svelte';
	import MenuDivider from './ui/MenuDivider.svelte';
	import MenuItem from './ui/MenuItem.svelte';

	const activeTitle = $derived(titleOf(chart.data));

	function handleSelect(id: string): void {
		chart.switchChart(id);
	}

	function handleNew(): void {
		chart.newChart();
	}

	function handleDelete(): void {
		const active = chart.charts.find((item) => item.active);
		if (!active || !chart.canDeleteChart) return;
		const userConfirmed = window.confirm(`Delete “${active.title}”? This cannot be undone.`);
		if (!userConfirmed) return;
		chart.deleteChart(active.id);
	}
</script>

<Menu class="max-w-full" align="start" label="Switch chart">
	{#snippet trigger({ expanded, toggle })}
		<button
			class="group inline-flex max-w-full cursor-pointer items-center gap-3.5 rounded-[14px] border-0 bg-transparent py-0.5 ps-0 pe-1 -ms-1 text-start font-serif text-[clamp(2.1rem,4.8vw,3.4rem)] leading-[1.08] font-[460] tracking-[-0.028em] text-text focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink max-[900px]:gap-2.5 max-[900px]:text-[clamp(1.8rem,8.4vw,2.4rem)]"
			type="button"
			aria-haspopup="menu"
			aria-expanded={expanded}
			aria-label="Switch chart: {activeTitle}"
			title={activeTitle}
			onclick={toggle}
		>
			<span class="min-w-0 truncate">{activeTitle}</span>
			<span
				class="inline-flex size-[34px] shrink-0 items-center justify-center rounded-full bg-sunken text-text motion-safe:transition-colors motion-safe:duration-150 group-hover:bg-sunken-hover group-aria-expanded:bg-sunken-hover max-[900px]:size-[30px]"
			>
				<Icon
					name="chevron-down"
					size={16}
					strokeWidth={2}
					class="motion-safe:transition-transform motion-safe:duration-200 motion-safe:ease-[cubic-bezier(0.16,1,0.3,1)] group-aria-expanded:rotate-180"
				/>
			</span>
		</button>
	{/snippet}
	{#each chart.charts as item (item.id)}
		<MenuItem
			icon={item.active ? 'check' : undefined}
			active={item.active}
			badge="{item.filled}/73"
			onclick={() => handleSelect(item.id)}
		>
			{#if !item.active}
				<span class="inline-block size-4 shrink-0" aria-hidden="true"></span>
			{/if}
			<span class="inline-block max-w-[28ch] truncate">{item.title}</span>
		</MenuItem>
	{/each}
	<MenuDivider />
	<MenuItem icon="grid" onclick={handleNew}>New blank chart</MenuItem>
	{#if chart.canDeleteChart}
		<MenuItem icon="trash" tone="danger" onclick={handleDelete}>Delete this chart</MenuItem>
	{/if}
</Menu>
