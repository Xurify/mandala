<script lang="ts">
	import { chart } from '$lib/chart/chart.svelte';
	import { cellKey, describe, HUES, idx, info, POS } from '$lib/chart/model';
	import InkPad from './InkPad.svelte';

	const panelTitle = $derived.by(() => {
		if (chart.sel === 4) return chart.data.goal.trim() || 'Goal and pillars';
		const k = idx(chart.sel);
		return chart.data.pillars[k]?.trim() || 'Unnamed pillar';
	});

	const panelSub = $derived(
		chart.sel === 4
			? 'Write the goal in the middle, then eight pillars that would make it almost inevitable.'
			: `Pillar ${idx(chart.sel) + 1}, ${POS[idx(chart.sel)]} of the center. Add eight actions that strengthen it.`
	);

	function hue(c: number) {
		const i = info(chart.sel, c);
		return i.type === 'goal' ? undefined : HUES[i.k];
	}

	function placeholder(c: number) {
		const i = info(chart.sel, c);
		if (i.type === 'goal') return 'Your main goal, 6 to 12 months out';
		if (chart.sel === 4) return `Pillar ${i.k + 1}`;
		if (i.type === 'pillar') return 'Name this pillar';
		return `Action ${idx(c) + 1}`;
	}
</script>

<div class="panel">
	<h2>{panelTitle}</h2>
	<p class="sub">{panelSub}</p>
	<div class="modebar">
		<div class="seg" role="group" aria-label="Input mode">
			<button
				type="button"
				aria-pressed={chart.mode === 'type'}
				onclick={() => chart.setMode('type')}
			>
				Type
			</button>
			<button
				type="button"
				aria-pressed={chart.mode === 'ink'}
				onclick={() => chart.setMode('ink')}
			>
				Ink
			</button>
		</div>
		<label class="finger" class:on={chart.mode === 'ink'}>
			<input
				type="checkbox"
				checked={chart.fingerDraw}
				onchange={(e) => {
					chart.fingerDraw = e.currentTarget.checked;
				}}
			/>
			Draw with finger
		</label>
	</div>
	<p class="inkhelp" class:on={chart.mode === 'ink'}>
		Write with a pen in each pad. Reading handwriting runs on this device the first time you tap
		Read handwriting (needs a download). After that it works offline. Type under a pad to make it
		searchable without reading.
	</p>
	<div class="fields">
		{#each Array(9) as _, c (c)}
			{#if chart.mode === 'ink'}
				<InkPad cellKey={cellKey(chart.sel, c)} block={chart.sel} cell={c} />
			{:else}
				<textarea
					class="field {info(chart.sel, c).type}"
					style:--h={hue(c)}
					maxlength="120"
					spellcheck="false"
					autocapitalize="sentences"
					aria-label={describe(chart.sel, c)}
					placeholder={placeholder(c)}
					value={chart.textOf(cellKey(chart.sel, c))}
					oninput={(e) => chart.setText(cellKey(chart.sel, c), e.currentTarget.value)}
				></textarea>
			{/if}
		{/each}
	</div>
	<ul class="tips">
		<li class="touch-tip">
			With Apple Pencil, Type mode uses Scribble (handwriting becomes text as you write). Ink mode
			keeps your handwriting as you drew it.
		</li>
		<li>Pillars should cover different angles: skills, habits, health, resources, support, mindset.</li>
		<li>Actions should start with a verb and be within your control.</li>
		<li>Editing a pillar here also updates it in the center block.</li>
	</ul>
</div>
