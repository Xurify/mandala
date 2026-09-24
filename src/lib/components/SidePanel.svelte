<script lang="ts">
	import { chart } from '$lib/chart/chart.svelte';
	import { cellKey, describe, HUES, idx, info, POS } from '$lib/chart/model';
	import Icon from './Icon.svelte';
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
			? 'Write your core goal in the center, then set eight pillars to make it inevitable.'
			: 'Add eight concrete actions that directly support and strengthen this pillar.'
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
	<div class="stepper-bar" role="tablist" aria-label="Chart sections">
		<button
			type="button"
			role="tab"
			class="stepper-goal-btn"
			class:active={chart.sel === 4}
			aria-selected={chart.sel === 4}
			onclick={() => chart.selectGoal()}
			aria-label="Center goal and core vision"
		>
			<Icon name="target" size={14} />
			<span>Goal</span>
		</button>

		<div class="pillar-stepper" role="group" aria-label="Select pillar">
			{#each Array(8) as _, pillarIndex (pillarIndex)}
				{@const isSelected = chart.sel !== 4 && idx(chart.sel) === pillarIndex}
				{@const pillarName = chart.data.pillars[pillarIndex]?.trim() || `Pillar ${pillarIndex + 1}`}
				{@const actionsCount = chart.milestones.pillarActionCounts[pillarIndex] ?? 0}
				{@const isFilled = actionsCount > 0 || (chart.data.pillars[pillarIndex] ?? '').trim() !== ''}
				<button
					type="button"
					role="tab"
					class="stepper-dot"
					class:active={isSelected}
					class:filled={isFilled}
					class:all-done={actionsCount === 8}
					style:--h={HUES[pillarIndex]}
					title="{pillarName} ({actionsCount}/8 actions)"
					aria-label="Pillar {pillarIndex + 1}: {pillarName}"
					aria-selected={isSelected}
					onclick={() => chart.selectPillar(pillarIndex)}
				>
					<span class="dot-num">{pillarIndex + 1}</span>
					{#if actionsCount === 8}
						<span class="dot-check" aria-hidden="true">
							<Icon name="check" size={10} strokeWidth={2.5} />
						</span>
					{/if}
				</button>
			{/each}
		</div>

		<div class="nav-arrows">
			<button
				type="button"
				class="nav-btn arrow"
				aria-label="Previous section"
				onclick={() => chart.selectPreviousPillar()}
			>
				<Icon name="chevron-left" size={15} />
			</button>
			<button
				type="button"
				class="nav-btn arrow"
				aria-label="Next section"
				onclick={() => chart.selectNextPillar()}
			>
				<Icon name="chevron-right" size={15} />
			</button>
		</div>
	</div>

	<div class="panel-header">
		<div class="panel-meta-row">
			<div
				class="panel-tag"
				class:goal-tag={chart.sel === 4}
				style:--tag-h={chart.sel === 4 ? undefined : HUES[idx(chart.sel)]}
			>
				{#if chart.sel === 4}
					<Icon name="target" size={13} />
					<span>Center Goal</span>
				{:else}
					<span class="tag-pip" aria-hidden="true" style:--pip-h={HUES[idx(chart.sel)]}></span>
					<span>Pillar {idx(chart.sel) + 1} · {POS[idx(chart.sel)]}</span>
				{/if}
			</div>

			{#if currentPillarActionsCount !== null}
				<div class="panel-actions-badge" class:done={currentPillarActionsCount === 8}>
					{#if currentPillarActionsCount === 8}
						<Icon name="check" size={12} strokeWidth={2.2} />
						<span>8 of 8 actions defined</span>
					{:else}
						<span>{currentPillarActionsCount} of 8 defined</span>
					{/if}
				</div>
			{/if}
		</div>

		<h2>{panelTitle}</h2>
		<p class="sub">{panelSub}</p>
	</div>

	<div class="modebar">
		<div class="seg" role="group" aria-label="Input mode">
			<button
				type="button"
				aria-pressed={chart.mode === 'type'}
				onclick={() => chart.setMode('type')}
			>
				<Icon name="type" size={14} />
				<span>Type</span>
			</button>
			<button
				type="button"
				aria-pressed={chart.mode === 'ink'}
				onclick={() => chart.setMode('ink')}
			>
				<Icon name="ink" size={14} />
				<span>Ink</span>
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
			<span>Draw with finger</span>
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
				<div
					class="field-container"
					class:center-cell={cellIndex === 4}
					class:has-content={chart.textOf(cellKey(chart.sel, cellIndex)).trim().length > 0}
				>
					{#if cellIndex === 4}
						<span class="cell-role-badge">
							<Icon name={chart.sel === 4 ? 'target' : 'compass'} size={11} />
							<span>{chart.sel === 4 ? 'Goal' : 'Pillar'}</span>
						</span>
					{:else}
						<span
							class="cell-index-badge"
							class:pillar-ref={chart.sel === 4}
							style:--ref-h={chart.sel === 4 ? HUES[idx(cellIndex)] : undefined}
						>
							<span class="badge-num">{chart.sel === 4 ? `P${idx(cellIndex) + 1}` : idx(cellIndex) + 1}</span>
							{#if chart.textOf(cellKey(chart.sel, cellIndex)).trim().length > 0}
								<span class="badge-pip" aria-hidden="true"></span>
							{/if}
						</span>
					{/if}
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
