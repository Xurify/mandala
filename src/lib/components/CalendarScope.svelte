<script lang="ts">
	import { chart } from '$lib/chart/chart.svelte';
	import Icon from './Icon.svelte';
	import Eyebrow from './ui/Eyebrow.svelte';
	import Menu from './ui/Menu.svelte';
	import MenuDivider from './ui/MenuDivider.svelte';
	import MenuItem from './ui/MenuItem.svelte';

	const scoped = $derived(chart.goals.find((goal) => goal.id === chart.calendarScope));
	const title = $derived(chart.goals.length === 1 ? (chart.goals[0]?.title ?? '') : (scoped?.title ?? 'All charts'));
	/** The chevron rides on the last word, so it never wraps to a line of its own. */
	const head = $derived(title.slice(0, title.lastIndexOf(' ') + 1));
	const tail = $derived(title.slice(title.lastIndexOf(' ') + 1));

	const titleClass =
		'm-0 font-serif text-[clamp(1.85rem,3.4vw,2.55rem)] leading-[1.12] font-[460] tracking-[-0.015em] text-text max-[900px]:text-[clamp(1.7rem,7.2vw,2.15rem)]';
</script>

<Eyebrow class="mb-2">Your calendar</Eyebrow>
{#if chart.goals.length > 1}
	<Menu class="max-w-full [&_[role=menu]]:w-[min(24rem,calc(100vw-32px))]" align="start" label="Charts on the calendar">
		{#snippet trigger({ expanded, toggle })}
			<h1 class="m-0 [font:inherit]">
				<button
					class="group inline-block max-w-full min-w-0 cursor-pointer rounded-[14px] border-0 bg-transparent py-0.5 ps-0 pe-1 -ms-1 text-start font-serif text-[clamp(1.85rem,3.4vw,2.55rem)] leading-[1.12] font-[460] tracking-[-0.015em] text-text focus-visible:outline-none max-[900px]:text-[clamp(1.7rem,7.2vw,2.15rem)]"
					type="button"
					aria-haspopup="menu"
					aria-expanded={expanded}
					aria-label="Charts on the calendar: {title}"
					onclick={toggle}
				>
					<span class="line-clamp-2">
						{head}<span class="whitespace-nowrap"
							>{tail}<span
								class="ms-[0.35em] inline-flex size-[34px] translate-y-[-0.06em] items-center justify-center rounded-full align-middle text-text bg-sunken group-hover:bg-sunken-hover group-focus-visible:bg-ink group-focus-visible:text-on-ink group-aria-expanded:bg-sunken-hover max-[900px]:size-[30px]"
							>
								<Icon
									name="chevron-down"
									size={16}
									strokeWidth={2}
									class="motion-safe:transition-transform motion-safe:duration-200 motion-safe:ease-[cubic-bezier(0.16,1,0.3,1)] group-aria-expanded:rotate-180"
								/>
							</span></span
						>
					</span>
				</button>
			</h1>
		{/snippet}
		{@render scope('all', 'All charts', 'calendar')}
		<MenuDivider />
		{#each chart.goals as goal (goal.id)}
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
