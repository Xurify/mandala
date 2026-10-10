<script lang="ts">
	import { chart } from '$lib/chart/chart.svelte';
	import { DEMOS, type Demo } from '$lib/chart/demos';
	import Wordmark from '$lib/components/Wordmark.svelte';
	import Button from '$lib/components/ui/Button.svelte';
	import Card from '$lib/components/ui/Card.svelte';
	import Eyebrow from '$lib/components/ui/Eyebrow.svelte';
	import SegmentedControl from '$lib/components/ui/SegmentedControl.svelte';

	const themes = [
		{ value: 'system', label: 'Auto', icon: 'monitor' as const },
		{ value: 'light', label: 'Light', icon: 'sun' as const },
		{ value: 'dark', label: 'Dark', icon: 'moon' as const }
	];
	const groups = [...new Set(DEMOS.map((demo) => demo.group))];
	let copied = $state<string | null>(null);

	function setTheme(next: string): void {
		if (next === 'system' || next === 'light' || next === 'dark') chart.setTheme(next);
	}

	async function copyReply(demo: Demo): Promise<void> {
		if (!demo.reply) return;
		try {
			await navigator.clipboard.writeText(demo.reply());
			copied = demo.id;
			setTimeout(() => {
				if (copied === demo.id) copied = null;
			}, 2000);
		} catch {
			copied = null;
		}
	}
</script>

<svelte:head>
	<title>Demos · Mandala</title>
	<meta name="robots" content="noindex" />
</svelte:head>

<div class="page-gutter mx-auto flex max-w-[1180px] flex-col gap-8 pb-40">
	<header class="flex flex-col gap-6">
		<div class="flex items-center justify-between gap-4">
			<Wordmark />
			<SegmentedControl label="Color theme" size="sm" options={themes} value={chart.theme} onchange={setTheme} />
		</div>
		<div class="flex max-w-[62ch] flex-col gap-3">
			<div>
				<Eyebrow>Lab</Eyebrow>
				<h1 class="m-0 mt-2 font-serif text-[clamp(1.9rem,4vw,2.8rem)] font-[480] tracking-tight text-balance">Demos</h1>
			</div>
			<p class="m-0 text-pretty text-muted">
				Each demo opens the app set up to show one thing, as a new chart. Nothing you have saved changes. Delete a demo chart from
				the chart menu when you are done. Try them on a phone too, and with reduced motion on, where everything still works without
				the movement.
			</p>
		</div>
	</header>

	{#each groups as group (group)}
		<section class="flex flex-col gap-3.5" aria-labelledby="group-{group}">
			<h2 id="group-{group}" class="m-0 text-[1.1rem] font-[620]">{group}</h2>
			<div class="grid grid-cols-3 gap-4 max-[1000px]:grid-cols-2 max-[640px]:grid-cols-1">
				{#each DEMOS.filter((demo) => demo.group === group) as demo (demo.id)}
					<Card class="flex flex-col gap-3">
						<h3 class="m-0 text-[1rem] leading-tight font-[620]">{demo.title}</h3>
						<ol class="m-0 flex flex-1 flex-col gap-1.5 ps-5 text-[0.88rem] leading-snug text-pretty text-muted">
							{#each demo.steps as step, index (index)}
								<li>{step}</li>
							{/each}
						</ol>
						<div class="flex flex-wrap items-center gap-2 pt-1">
							<Button size="sm" variant="soft" icon="arrow-right" href="/?demo={demo.id}">Open demo</Button>
							{#if demo.reply}
								<Button size="sm" variant="ghost" icon={copied === demo.id ? 'check' : 'copy'} onclick={() => copyReply(demo)}>
									{copied === demo.id ? 'Copied' : 'Copy a sample reply'}
								</Button>
							{/if}
						</div>
					</Card>
				{/each}
			</div>
		</section>
	{/each}
</div>
