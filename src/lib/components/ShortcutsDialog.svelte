<script lang="ts">
	import { visibleShortcuts } from '$lib/chart/shortcuts';
	import Dialog from './ui/Dialog.svelte';
	import Eyebrow from './ui/Eyebrow.svelte';

	type Props = {
		open?: boolean;
		mod?: string;
		desktop?: boolean;
	};

	let { open = $bindable(false), mod = 'Ctrl', desktop = true }: Props = $props();

	const groups = $derived(visibleShortcuts(mod, desktop));
</script>

<Dialog
	bind:open
	title="Keyboard shortcuts"
	description="These work when you are not typing in a field."
>
	{#each groups as group (group.title)}
		<section class="mb-5 last:mb-0">
			<Eyebrow class="mb-1.5">{group.title}</Eyebrow>
			<ul class="m-0 flex list-none flex-col p-0">
				{#each group.items as item (item.label)}
					<li class="flex min-h-9 items-center justify-between gap-4 py-1">
						<span class="text-[0.92rem] text-pretty">{item.label}</span>
						<span class="flex shrink-0 items-center gap-1">
							{#each item.keys as key, index (`${item.label}-${index}`)}
								<kbd
									class="rounded-md bg-sunken px-2 py-0.5 text-center font-sans text-[0.75rem] font-semibold text-muted"
									>{key}</kbd
								>
							{/each}
						</span>
					</li>
				{/each}
			</ul>
		</section>
	{/each}
</Dialog>
