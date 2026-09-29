<script lang="ts">
	import { chart } from '$lib/chart/chart.svelte';
	import { cellKey, describe, HUES, idx, info, POS } from '$lib/chart/model';
	import Icon from './Icon.svelte';
	import InkPad from './InkPad.svelte';
	import { cn } from './ui/cn';
	import Eyebrow from './ui/Eyebrow.svelte';
	import SegmentedControl from './ui/SegmentedControl.svelte';

	const inputModes = [
		{ value: 'type', label: 'Type', icon: 'type' as const },
		{ value: 'ink', label: 'Ink', icon: 'ink' as const }
	];

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

	function centerGoalText(_text: string) {
		return (node: HTMLTextAreaElement) => {
			let frame = 0;
			const apply = (): void => {
				node.style.paddingTop = '0px';
				node.style.paddingBottom = '0px';
				node.style.height = 'auto';
				node.style.aspectRatio = 'auto';
				const contentHeight = node.scrollHeight;
				node.style.height = '';
				node.style.aspectRatio = '';
				const room = node.clientHeight - contentHeight;
				const top = room / 2;
				if (top >= 26) {
					node.style.paddingTop = `${top}px`;
					node.style.paddingBottom = `${top}px`;
				} else {
					node.style.paddingTop = '26px';
					node.style.paddingBottom = '10px';
				}
			};
			const schedule = (): void => {
				cancelAnimationFrame(frame);
				frame = requestAnimationFrame(apply);
			};
			schedule();
			const observer = new ResizeObserver(schedule);
			observer.observe(node);
			return () => {
				cancelAnimationFrame(frame);
				observer.disconnect();
			};
		};
	}
</script>

<div class="rounded-[30px] bg-surface p-6 shadow-card max-[900px]:rounded-[26px] max-[900px]:px-3.5 max-[900px]:py-[18px]">
	<div class="mb-[26px] flex items-center gap-2.5 max-[900px]:mb-5 max-[900px]:gap-1.5 @max-[360px]:gap-1" role="tablist" aria-label="Chart sections">
		<button
			type="button"
			role="tab"
			class="relative inline-flex min-h-[34px] shrink-0 cursor-pointer items-center gap-1.5 rounded-full border-0 bg-sunken px-3.5 text-[0.84rem] font-semibold whitespace-nowrap text-text motion-safe:transition-[background-color,color,transform] motion-safe:duration-150 motion-safe:ease-ui after:absolute after:inset-y-[-5px] after:inset-x-0 after:content-[''] hover:bg-sunken-hover active:scale-[0.96] aria-selected:bg-ink aria-selected:text-on-ink @max-[360px]:px-[9px] @max-[360px]:[&_span]:hidden"
			aria-selected={chart.sel === 4}
			onclick={() => chart.selectGoal()}
			aria-label="Center goal and core vision"
		>
			<Icon name="target" size={14} />
			<span>Goal</span>
		</button>

		<div class="flex min-w-0 flex-1 items-center justify-center gap-1.5 max-[900px]:gap-1 @max-[360px]:gap-[3px]" role="group" aria-label="Select pillar">
			{#each Array(8) as _, pillarIndex (pillarIndex)}
				{@const isSelected = chart.sel !== 4 && idx(chart.sel) === pillarIndex}
				{@const pillarName = chart.data.pillars[pillarIndex]?.trim() || `Pillar ${pillarIndex + 1}`}
				{@const actionsCount = chart.milestones.pillarActionCounts[pillarIndex] ?? 0}
				{@const isFilled = actionsCount > 0 || (chart.data.pillars[pillarIndex] ?? '').trim() !== ''}
				<button
					type="button"
					role="tab"
					class={cn(
						'relative inline-flex h-8 w-8 min-w-[22px] flex-[0_1_32px] cursor-pointer items-center justify-center rounded-full border-0 p-0 text-[0.78rem] font-[650] tabular-nums motion-safe:transition-[background-color,box-shadow,transform] motion-safe:duration-150 motion-safe:ease-ui after:absolute after:-inset-y-1.5 after:-inset-x-0.5 after:content-[\'\'] active:scale-[0.94] max-[900px]:h-7 max-[900px]:w-7 max-[900px]:flex-[0_1_28px] max-[900px]:text-[0.74rem]',
						!isFilled && !isSelected && 'dot-fill',
						isFilled && !isSelected && 'pillar-cell text-on-p',
						!isSelected && 'can-hover:hover:pillar-cell can-hover:hover:text-on-p',
						isSelected &&
							'z-[2] bg-[oklch(0.6_0.14_var(--h))] text-[oklch(0.99_0_0)] shadow-[0_0_0_2px_var(--surface),0_0_0_4px_oklch(0.6_0.14_var(--h))]'
					)}
					style:--h={HUES[pillarIndex]}
					title="{pillarName} ({actionsCount}/8 actions)"
					aria-label="Pillar {pillarIndex + 1}: {pillarName}"
					aria-selected={isSelected}
					onclick={() => chart.selectPillar(pillarIndex)}
				>
					<span>{pillarIndex + 1}</span>
					{#if actionsCount === 8}
						<span class="absolute -top-[3px] -right-[3px] flex size-3.5 items-center justify-center rounded-full bg-success text-surface shadow-[0_0_0_2px_var(--surface)]" aria-hidden="true">
							<Icon name="check" size={10} strokeWidth={2.5} />
						</span>
					{/if}
				</button>
			{/each}
		</div>
		<div class="inline-flex shrink-0 gap-0.5">
			<button
				type="button"
				class="relative inline-flex size-[34px] cursor-pointer items-center justify-center rounded-full border-0 bg-transparent p-0 text-muted motion-safe:transition-[background-color,color,transform] motion-safe:duration-150 after:absolute after:inset-y-[-5px] after:inset-x-0 after:content-[''] hover:bg-sunken hover:text-text active:scale-[0.94] max-[900px]:size-[30px]"
				aria-label="Previous section"
				onclick={() => chart.selectPreviousPillar()}
			>
				<Icon name="chevron-left" size={15} />
			</button>
			<button
				type="button"
				class="relative inline-flex size-[34px] cursor-pointer items-center justify-center rounded-full border-0 bg-transparent p-0 text-muted motion-safe:transition-[background-color,color,transform] motion-safe:duration-150 after:absolute after:inset-y-[-5px] after:inset-x-0 after:content-[''] hover:bg-sunken hover:text-text active:scale-[0.94] max-[900px]:size-[30px]"
				aria-label="Next section"
				onclick={() => chart.selectNextPillar()}
			>
				<Icon name="chevron-right" size={15} />
			</button>
		</div>
	</div>

	<div class="mb-[18px]">
		<div class="mb-2.5 flex items-center justify-between gap-2">
			<Eyebrow pip={chart.sel === 4 ? 'goal' : idx(chart.sel)}>
				{#if chart.sel === 4}
					Center goal
				{:else}
					Pillar {idx(chart.sel) + 1} · {POS[idx(chart.sel)]}
				{/if}
			</Eyebrow>
			{#if currentPillarActionsCount !== null}
				<span class={cn('inline-flex items-center gap-[5px] text-[0.82rem] font-medium text-muted tabular-nums', currentPillarActionsCount === 8 && 'font-semibold text-success')}>
					{#if currentPillarActionsCount === 8}
						<Icon name="check" size={12} strokeWidth={2.4} />
					{/if}
					<span>{currentPillarActionsCount} of 8 actions</span>
				</span>
			{/if}
		</div>

		<h2 class="mb-1.5 font-serif text-[1.85rem] leading-[1.15] font-[480] tracking-[-0.02em] text-balance wrap-anywhere max-[900px]:text-[1.55rem]">{panelTitle}</h2>
		<p class="mb-5 text-[0.92rem] leading-[1.45] text-pretty text-muted max-[900px]:mb-4 max-[900px]:text-[0.86rem]">{panelSub}</p>
	</div>

	<div class="mb-4 flex flex-wrap items-center gap-x-3.5 gap-y-2">
		<SegmentedControl
			label="Input mode"
			options={inputModes}
			value={chart.mode}
			onchange={(value) => {
				if (value === 'type' || value === 'ink') chart.setMode(value);
			}}
		/>
		<label class={cn('hidden items-center gap-1.5 text-[0.88rem] text-muted', chart.mode === 'ink' && 'inline-flex')}>
			<input
				class="size-[18px] accent-ink"
				type="checkbox"
				checked={chart.fingerDraw}
				onchange={(event) => {
					chart.fingerDraw = event.currentTarget.checked;
				}}
			/>
			<span>Draw with finger</span>
		</label>
	</div>

	<p class={cn('mb-4 hidden text-[0.88rem] text-muted', chart.mode === 'ink' && 'block')}>
		Write with a pen in each pad. Reading handwriting runs on this device the first time you tap
		Read handwriting (needs a download). After that it works offline. Type under a pad to make it
		searchable without reading.
	</p>

	<div class="grid grid-cols-3 gap-2.5 max-[900px]:gap-1.5">
		{#each Array(9) as _, cellIndex (cellIndex)}
			{#if chart.mode === 'ink'}
				<InkPad cellKey={cellKey(chart.sel, cellIndex)} block={chart.sel} cell={cellIndex} />
			{:else}
				<div
					class={cn('relative aspect-square w-full min-w-0', cellIndex === 4 && 'z-[2]')}
				>
					{#if cellIndex === 4}
						<span
							class={cn(
								'pointer-events-none absolute top-2.5 left-3 z-[2] inline-flex items-center gap-1 rounded-full bg-black/8 px-[7px] py-0.5 text-[0.62rem] font-bold tracking-[0.08em] text-on-p uppercase max-[900px]:top-[7px] max-[900px]:left-2 max-[900px]:px-[5px] max-[900px]:py-px max-[900px]:text-[0.56rem] dark:bg-white/16',
								chart.sel === 4 && 'left-1/2 -translate-x-1/2 bg-[oklch(0.5_0_0/0.22)] text-goal-fg'
							)}
						>
							<Icon name={chart.sel === 4 ? 'target' : 'compass'} size={11} />
							<span>{chart.sel === 4 ? 'Goal' : 'Pillar'}</span>
						</span>
					{:else}
						<span class="pointer-events-none absolute top-2.5 left-3 z-[2] inline-flex items-center gap-[5px] max-[900px]:top-[7px] max-[900px]:left-2">
							<span class={cn('text-[0.72rem] font-[650] tabular-nums opacity-80', chart.sel === 4 ? 'text-on-p opacity-70' : 'text-muted')}>{chart.sel === 4 ? `P${idx(cellIndex) + 1}` : idx(cellIndex) + 1}</span>
							{#if chart.textOf(cellKey(chart.sel, cellIndex)).trim().length > 0}
								<span class="size-[5px] rounded-full bg-success" aria-hidden="true"></span>
							{/if}
						</span>
					{/if}
					<textarea
						bind:this={textareaElements[cellIndex]}
						class={cn(
							'field h-full min-h-0 w-full min-w-0 resize-none scroll-mt-20 scroll-mb-[140px] rounded-[20px] border-0 bg-sunken px-3 pt-[30px] pb-3 text-[15px] leading-[1.35] text-text motion-safe:transition-[background-color,box-shadow] motion-safe:duration-150 placeholder:text-muted placeholder:opacity-75 focus:z-[3] focus:shadow-[0_0_0_2px_var(--ink),0_10px_24px_-10px_oklch(0_0_0/0.3)] focus:outline-none focus-visible:z-[3] focus-visible:shadow-[0_0_0_2px_var(--ink),0_10px_24px_-10px_oklch(0_0_0/0.3)] focus-visible:outline-none max-[900px]:rounded-[15px] max-[900px]:px-2 max-[900px]:pt-[22px] max-[900px]:pb-[7px] max-[900px]:leading-[1.25] max-[900px]:[scrollbar-width:none] max-[900px]:[&::-webkit-scrollbar]:hidden',
							info(chart.sel, cellIndex).type === 'goal' &&
								'goal bg-goal px-4 text-center font-serif text-[17px] font-[520] text-goal-fg rounded-[26px] placeholder:text-goal-fg placeholder:opacity-55 can-hover:hover:bg-goal-hover can-hover:[&.highlight]:bg-goal-hover max-[900px]:rounded-[20px] max-[900px]:text-[15px]',
							info(chart.sel, cellIndex).type === 'pillar' &&
								'pillar pillar-cell rounded-[26px] font-semibold text-on-p placeholder:text-on-p placeholder:opacity-60 can-hover:hover:pillar-hot can-hover:[&.highlight]:pillar-hot max-[900px]:rounded-[20px]',
							info(chart.sel, cellIndex).type === 'action' &&
								'action pillar-action can-hover:hover:action-hot can-hover:[&.highlight]:action-hot',
							isPanelCellHighlighted(cellIndex) && 'highlight',
							activePulseIndex === cellIndex && 'motion-safe:animate-target'
						)}
						style:--h={hue(cellIndex)}
						maxlength="120"
						spellcheck="false"
						autocapitalize="sentences"
						aria-label={describe(chart.sel, cellIndex)}
						placeholder={placeholder(cellIndex)}
						value={chart.textOf(cellKey(chart.sel, cellIndex))}
						{@attach info(chart.sel, cellIndex).type === 'goal'
							? centerGoalText(chart.textOf(cellKey(chart.sel, cellIndex)))
							: undefined}
						onkeydown={(event) => handleFieldKeydown(cellIndex, event)}
						oninput={(event) => chart.setText(cellKey(chart.sel, cellIndex), event.currentTarget.value)}
						onpointerenter={(event) => handleFieldPointerEnter(cellIndex, event)}
						onpointerleave={handleFieldPointerLeave}
					></textarea>
					{#if chart.textOf(cellKey(chart.sel, cellIndex)).length >= 100}
						<span class="pointer-events-none absolute right-2 bottom-2 rounded-full bg-ink px-1.5 py-px text-[0.68rem] font-semibold text-on-ink print:hidden">
							{120 - chart.textOf(cellKey(chart.sel, cellIndex)).length}
						</span>
					{/if}
				</div>
			{/if}
		{/each}
	</div>

	<ul class="mt-6 list-none border-t border-line pt-[18px] text-[0.86rem] text-muted max-[900px]:hidden">
		<li class="tip relative mb-1.5 hidden ps-4 text-text before:absolute before:start-0.5 before:top-[0.62em] before:size-[5px] before:rounded-full before:bg-line before:content-[''] coarse:!block">
			With Apple Pencil, Type mode uses Scribble (handwriting becomes text as you write). Ink mode
			keeps your handwriting as you drew it.
		</li>
		<li class="tip relative mb-1.5 ps-4 before:absolute before:start-0.5 before:top-[0.62em] before:size-[5px] before:rounded-full before:bg-line before:content-['']">Pillars should cover different angles: skills, habits, health, resources, support, mindset.</li>
		<li class="tip relative mb-1.5 ps-4 before:absolute before:start-0.5 before:top-[0.62em] before:size-[5px] before:rounded-full before:bg-line before:content-['']">Actions should start with a verb and be within your control.</li>
		<li class="tip relative mb-1.5 ps-4 before:absolute before:start-0.5 before:top-[0.62em] before:size-[5px] before:rounded-full before:bg-line before:content-['']">Editing a pillar here also updates it in the center block.</li>
	</ul>
</div>
