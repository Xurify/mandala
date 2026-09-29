<script lang="ts">
	import { chart } from '$lib/chart/chart.svelte';
	import { titleOf } from '$lib/chart/library';
	import Icon from './Icon.svelte';

	let open = $state(false);
	let wrapElement: HTMLDivElement | null = $state(null);

	const activeTitle = $derived(titleOf(chart.data));

	function close(): void {
		open = false;
	}

	function toggle(): void {
		open = !open;
	}

	function handleWindowClick(event: MouseEvent): void {
		if (open && wrapElement && !wrapElement.contains(event.target as Node)) {
			close();
		}
	}

	function handleWindowKeydown(event: KeyboardEvent): void {
		if (event.key !== 'Escape' || !open) return;
		event.preventDefault();
		event.stopImmediatePropagation();
		close();
	}

	function handleSelect(id: string): void {
		chart.switchChart(id);
		close();
	}

	function handleNew(): void {
		chart.newChart();
		close();
	}

	function handleDelete(): void {
		const active = chart.charts.find((item) => item.active);
		if (!active || !chart.canDeleteChart) return;
		const userConfirmed = window.confirm(
			`Delete “${active.title}”? This cannot be undone.`
		);
		if (!userConfirmed) return;
		chart.deleteChart(active.id);
		close();
	}
</script>

<svelte:window onclick={handleWindowClick} onkeydowncapture={handleWindowKeydown} />

<div class="menu-wrap chart-switch" bind:this={wrapElement}>
	<button
		class="chart-title-btn"
		type="button"
		aria-haspopup="menu"
		aria-expanded={open}
		aria-label="Switch chart: {activeTitle}"
		title={activeTitle}
		onclick={toggle}
	>
		<span class="chart-title">{activeTitle}</span>
		<span class="chart-title-chevron">
			<Icon name="chevron-down" size={16} strokeWidth={2} class="chevron" />
		</span>
	</button>
	{#if open}
		<div class="menu-backdrop" aria-hidden="true" onclick={close}></div>
		<div class="menu-dropdown chart-switch-menu" role="menu">
			{#each chart.charts as item (item.id)}
				<button
					class="menu-item"
					class:active={item.active}
					type="button"
					role="menuitem"
					onclick={() => handleSelect(item.id)}
				>
					<span class="menu-item-main">
						{#if item.active}
							<Icon name="check" size={16} />
						{:else}
							<span class="chart-switch-spacer" aria-hidden="true"></span>
						{/if}
						<span class="chart-switch-item-title">{item.title}</span>
					</span>
					<span class="menu-badge">{item.filled}/73</span>
				</button>
			{/each}
			<div class="menu-divider" role="separator"></div>
			<button class="menu-item" type="button" role="menuitem" onclick={handleNew}>
				<span class="menu-item-main">
					<Icon name="grid" size={16} />
					<span>New blank chart</span>
				</span>
			</button>
			{#if chart.canDeleteChart}
				<button
					class="menu-item danger"
					type="button"
					role="menuitem"
					onclick={handleDelete}
				>
					<span class="menu-item-main">
						<Icon name="trash" size={16} />
						<span>Delete this chart</span>
					</span>
				</button>
			{/if}
		</div>
	{/if}
</div>
