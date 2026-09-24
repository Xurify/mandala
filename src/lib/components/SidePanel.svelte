<script lang="ts">
	import { chart } from '$lib/chart/chart.svelte';
	import { cellKey, describe, HUES, idx, info, POS } from '$lib/chart/model';
	import InkPad from './InkPad.svelte';

	const textareaElements: (HTMLTextAreaElement | null)[] = $state(Array(9).fill(null));
	let activePulseIndex: number | null = $state(null);

	const panelTitle = $derived.by(() => {
		if (chart.sel === 4) return chart.data.goal.trim() || 'Goal and pillars';
		const pillarIndex = idx(chart.sel);
		return chart.data.pillars[pillarIndex]?.trim() || `Pillar ${pillarIndex + 1}`;
	});

	const panelSub = $derived(
		chart.sel === 4
			? 'Write the goal in the middle, then eight pillars that make it inevitable.'
			: `Pillar ${idx(chart.sel) + 1}, ${POS[idx(chart.sel)]} of the center.`
	);

	const currentPillarActionsCount = $derived(
		chart.sel === 4 ? null : (chart.milestones.pillarActionCounts[idx(chart.sel)] ?? 0)
	);

	$effect(() => {
		const targetKey = chart.focusedKey;
		if (!targetKey) return;
		for (let cellIndex = 0; cellIndex < 9; cellIndex++) {
			if (cellKey(chart.sel, cellIndex) === targetKey) {
				const targetElement = textareaElements[cellIndex];
				if (targetElement) {
					targetElement.focus();
					activePulseIndex = cellIndex;
					setTimeout(() => {
						if (activePulseIndex === cellIndex) {
							activePulseIndex = null;
						}
					}, 1600);
				}
				chart.clearFocusedKey();
				break;
			}
		}
	});

	function hue(cellIndex: number): number | undefined {
		const cellInformation = info(chart.sel, cellIndex);
		return cellInformation.type === 'goal' ? undefined : HUES[cellInformation.k];
	}

	function placeholder(cellIndex: number): string {
		const cellInformation = info(chart.sel, cellIndex);
		if (cellInformation.type === 'goal') return 'Your main goal, 6 to 12 months out';
		if (chart.sel === 4) return `Pillar ${cellInformation.k + 1}`;
		if (cellInformation.type === 'pillar') return 'Name this pillar';
		return `Action ${idx(cellIndex) + 1}`;
	}

	function isPanelCellHighlighted(cellIndex: number): boolean {
		if (chart.hoveredColorIndex === null) return false;
		const cellInformation = info(chart.sel, cellIndex);
		if (cellInformation.type === 'goal') {
			return chart.hoveredColorIndex === -1;
		}
		return cellInformation.k === chart.hoveredColorIndex;
	}

	function handleFieldPointerEnter(cellIndex: number, event: PointerEvent): void {
		if (event.pointerType === 'touch') return;
		const cellInformation = info(chart.sel, cellIndex);
		chart.hoveredColorIndex = cellInformation.type === 'goal' ? -1 : cellInformation.k;
	}

	function handleFieldPointerLeave(event: PointerEvent): void {
		if (event.pointerType === 'touch') return;
		chart.hoveredColorIndex = null;
	}

	function handleFieldKeydown(cellIndex: number, event: KeyboardEvent): void {
		if (event.key === 'Enter' && !event.shiftKey) {
			event.preventDefault();
			const nextIndex = (cellIndex + 1) % 9;
			textareaElements[nextIndex]?.focus();
		}
	}
</script>

<div class="panel">
	<div class="panel-nav">
		<div class="nav-left">
			{#if chart.sel !== 4}
				<button
					type="button"
					class="nav-btn center-link"
					onclick={() => chart.selectGoal()}
				>
					<span>← Goal</span>
				</button>
			{:else}
				<span class="nav-pill active">Center</span>
			{/if}
		</div>

		<div class="pillar-stepper" role="group" aria-label="Select pillar">
			{#each Array(8) as _, pillarIndex (pillarIndex)}
				<button
					type="button"
					class="stepper-dot"
					class:active={chart.sel !== 4 && idx(chart.sel) === pillarIndex}
					class:filled={(chart.milestones.pillarActionCounts[pillarIndex] ?? 0) > 0 || (chart.data.pillars[pillarIndex] ?? '').trim() !== ''}
					style:--h={HUES[pillarIndex]}
					aria-label="Pillar {pillarIndex + 1}"
					onclick={() => chart.selectPillar(pillarIndex)}
				>
					{pillarIndex + 1}
				</button>
			{/each}
		</div>

		<div class="nav-arrows">
			<button
				type="button"
				class="nav-btn arrow"
				aria-label="Previous pillar"
				onclick={() => chart.selectPreviousPillar()}
			>
				‹
			</button>
			<button
				type="button"
				class="nav-btn arrow"
				aria-label="Next pillar"
				onclick={() => chart.selectNextPillar()}
			>
				›
			</button>
		</div>
	</div>

	<h2>{panelTitle}</h2>
	<p class="sub">
		{panelSub}
		{#if currentPillarActionsCount !== null}
			<span class="pillar-counter">
				• {currentPillarActionsCount} of 8 actions defined
			</span>
		{/if}
	</p>

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
				onchange={(event) => {
					chart.fingerDraw = event.currentTarget.checked;
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
		{#each Array(9) as _, cellIndex (cellIndex)}
			{#if chart.mode === 'ink'}
				<InkPad cellKey={cellKey(chart.sel, cellIndex)} block={chart.sel} cell={cellIndex} />
			{:else}
				<div class="field-container">
					<textarea
						bind:this={textareaElements[cellIndex]}
						class="field {info(chart.sel, cellIndex).type}"
						class:highlight={isPanelCellHighlighted(cellIndex)}
						class:pulse={activePulseIndex === cellIndex}
						style:--h={hue(cellIndex)}
						maxlength="120"
						spellcheck="false"
						autocapitalize="sentences"
						aria-label={describe(chart.sel, cellIndex)}
						placeholder={placeholder(cellIndex)}
						value={chart.textOf(cellKey(chart.sel, cellIndex))}
						onkeydown={(event) => handleFieldKeydown(cellIndex, event)}
						oninput={(event) => chart.setText(cellKey(chart.sel, cellIndex), event.currentTarget.value)}
						onpointerenter={(event) => handleFieldPointerEnter(cellIndex, event)}
						onpointerleave={handleFieldPointerLeave}
					></textarea>
					{#if chart.textOf(cellKey(chart.sel, cellIndex)).length >= 100}
						<span class="char-count">
							{120 - chart.textOf(cellKey(chart.sel, cellIndex)).length}
						</span>
					{/if}
				</div>
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
