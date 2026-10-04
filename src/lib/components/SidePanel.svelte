<script lang="ts">
	import type { Attachment } from 'svelte/attachments';
	import { chart } from '$lib/chart/chart.svelte';
	import { cellKey, describe, HUES, idx, info, isUrl, POS } from '$lib/chart/model';
	import { goalTypeMin, largestFittingSize, rememberGoalFit, watchFaceSwap } from './goal-fit';
	import HaradaOnboarding from './HaradaOnboarding.svelte';
	import Icon from './Icon.svelte';
	import Button from './ui/Button.svelte';
	import { cn } from './ui/cn';
	import { fieldInk } from './ui/styles';
	import Eyebrow from './ui/Eyebrow.svelte';
	import Notice from './ui/Notice.svelte';
	import SegmentedControl from './ui/SegmentedControl.svelte';

	const actionKinds = [
		{ value: 'standard', label: 'Standard' },
		{ value: 'routine', label: 'Routine' },
		{ value: 'milestone', label: 'Milestone' }
	];

	const textareaElements: (HTMLTextAreaElement | null)[] = $state(Array(9).fill(null));
	let activePulseIndex: number | null = $state(null);
	let activeCellIndex: number | null = $state(null);
	let haradaOpen = $state(false);

	const showHaradaNotice = $derived.by((): boolean => {
		if (chart.sel !== 4) return false;
		if (!chart.data.goal.trim()) return false;
		let filledPillars = 0;
		for (let pillarIndex = 0; pillarIndex < 8; pillarIndex++) {
			if ((chart.data.pillars[pillarIndex] ?? '').trim() !== '') {
				filledPillars++;
			}
		}
		if (filledPillars >= 3) return false;
		if (typeof window !== 'undefined') {
			try {
				if (sessionStorage.getItem('mandala-harada-completed') === 'true') {
					return false;
				}
			} catch {
				// storage blocked
			}
		}
		return true;
	});

	const effectiveCellIndex = $derived.by((): number | null => {
		if (chart.sel === 4) return null;
		if (activeCellIndex !== null && activeCellIndex !== 4) return activeCellIndex;
		for (let cellIndex = 0; cellIndex < 9; cellIndex++) {
			if (cellIndex !== 4 && chart.textOf(cellKey(chart.sel, cellIndex)).trim() !== '') {
				return cellIndex;
			}
		}
		return 0;
	});

	const activeActionKey = $derived(
		effectiveCellIndex !== null ? cellKey(chart.sel, effectiveCellIndex) : null
	);

	const panelTitle = $derived.by(() => {
		if (chart.sel === 4) return chart.data.goal.trim() || 'Goal and pillars';
		const pillarIndex = idx(chart.sel);
		return chart.data.pillars[pillarIndex]?.trim() || `Pillar ${pillarIndex + 1}`;
	});

	const currentPillarActionsCount = $derived(
		chart.sel === 4 ? null : (chart.milestones.pillarActionCounts[idx(chart.sel)] ?? 0)
	);

	$effect(() => {
		const targetKey = chart.focusedKey;
		if (!targetKey) return;
		for (let cellIndex = 0; cellIndex < 9; cellIndex++) {
			if (cellKey(chart.sel, cellIndex) === targetKey) {
				activeCellIndex = cellIndex;
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

	const GOAL_PAD_TOP = 26;
	const GOAL_PAD_BOTTOM = 10;

	const fitGoalField: Attachment = (element) => {
		if (!(element instanceof HTMLTextAreaElement)) return;
		const host = element.parentElement;
		let frame = 0;

		const contentHeight = (): number => {
			element.style.height = 'auto';
			element.style.aspectRatio = 'auto';
			const height = element.scrollHeight;
			element.style.height = '';
			element.style.aspectRatio = '';
			return height;
		};

		const syncColor = (): void => {
			const hide = element.hasAttribute('data-clamped') && document.activeElement !== element;
			element.style.color = hide ? 'transparent' : '';
		};

		const designSize = (): number => {
			const root = document.documentElement;
			const saved = root.style.getPropertyValue('--goal-field-size');
			root.style.removeProperty('--goal-field-size');
			element.style.fontSize = '';
			const max = parseFloat(getComputedStyle(element).fontSize);
			if (saved) root.style.setProperty('--goal-field-size', saved);
			return max;
		};

		const apply = (): void => {
			element.style.fontSize = '';
			element.style.paddingTop = `${GOAL_PAD_TOP}px`;
			element.style.paddingBottom = `${GOAL_PAD_BOTTOM}px`;
			element.removeAttribute('data-clamped');
			host?.removeAttribute('data-goal-clamped');
			if (element.clientHeight <= 0) {
				syncColor();
				return;
			}

			const max = designSize();
			if (!Number.isFinite(max) || max <= 0 || element.value.trim() === '') {
				centerShortText();
				syncColor();
				return;
			}

			const min = goalTypeMin(max);
			const fits = (size: number): boolean => {
				element.style.fontSize = `${size}px`;
				return contentHeight() <= element.clientHeight + 1;
			};
			const chosen = largestFittingSize(min, max, fits);
			const clamped = !fits(min);
			const used = chosen >= max - 0.25 ? max : chosen;
			const next = `${used.toFixed(2)}px`;
			if (element.style.fontSize !== next) element.style.fontSize = next;
			rememberGoalFit('field', used);

			if (clamped) {
				element.style.paddingTop = `${GOAL_PAD_TOP}px`;
				element.style.paddingBottom = `${GOAL_PAD_BOTTOM}px`;
				element.setAttribute('data-clamped', '');
				host?.setAttribute('data-goal-clamped', '');
				host?.style.setProperty('--goal-fit', getComputedStyle(element).fontSize);
				const clamp = host?.querySelector<HTMLElement>(':scope > .goal-clamp');
				if (clamp) {
					const counter = element.value.length >= 100 ? 22 : 0;
					clamp.style.display = '-webkit-box';
					clamp.style.webkitBoxOrient = 'vertical';
					clamp.style.overflow = 'hidden';
					clamp.style.paddingBottom = `${GOAL_PAD_BOTTOM + counter}px`;
					const style = getComputedStyle(clamp);
					const line = parseFloat(style.lineHeight);
					const inner =
						clamp.clientHeight - parseFloat(style.paddingTop) - parseFloat(style.paddingBottom);
					let lines = Math.max(
						1,
						Math.floor(inner / (Number.isFinite(line) && line > 0 ? line : chosen))
					);
					clamp.style.webkitLineClamp = String(lines);
					if (clamp.scrollHeight > clamp.clientHeight + 1 && lines > 1) {
						lines -= 1;
						clamp.style.webkitLineClamp = String(lines);
					}
				}
				syncColor();
				return;
			}

			host?.style.removeProperty('--goal-fit');
			const clamp = host?.querySelector<HTMLElement>(':scope > .goal-clamp');
			if (clamp) {
				clamp.style.display = '';
				clamp.style.removeProperty('-webkit-line-clamp');
				clamp.style.paddingBottom = '';
			}

			centerShortText();
			syncColor();
		};

		const centerShortText = (): void => {
			element.style.paddingTop = '0px';
			element.style.paddingBottom = '0px';
			const room = element.clientHeight - contentHeight();
			const top = room / 2;
			if (top >= GOAL_PAD_TOP) {
				element.style.paddingTop = `${top}px`;
				element.style.paddingBottom = `${top}px`;
			} else {
				element.style.paddingTop = `${GOAL_PAD_TOP}px`;
				element.style.paddingBottom = `${GOAL_PAD_BOTTOM}px`;
			}
		};

		const schedule = (): void => {
			cancelAnimationFrame(frame);
			frame = requestAnimationFrame(() => {
				frame = requestAnimationFrame(apply);
			});
		};

		apply();
		schedule();
		const stopFace = watchFaceSwap(schedule);
		const resizeObserver = new ResizeObserver(schedule);
		resizeObserver.observe(host ?? element);
		window.addEventListener('resize', schedule);
		element.addEventListener('focus', schedule);
		element.addEventListener('blur', schedule);
		const textObserver = new MutationObserver(schedule);
		textObserver.observe(element, { attributes: true, attributeFilter: ['data-fit'] });
		return () => {
			cancelAnimationFrame(frame);
			stopFace();
			resizeObserver.disconnect();
			textObserver.disconnect();
			window.removeEventListener('resize', schedule);
			element.removeEventListener('focus', schedule);
			element.removeEventListener('blur', schedule);
			element.style.color = '';
			element.style.fontSize = '';
			element.style.paddingTop = '';
			element.style.paddingBottom = '';
			element.removeAttribute('data-clamped');
			host?.removeAttribute('data-goal-clamped');
			host?.style.removeProperty('--goal-fit');
		};
	};
</script>

<div class="rounded-[30px] bg-surface p-6 shadow-card max-[900px]:rounded-[26px] max-[900px]:px-3.5 max-[900px]:py-[18px]">
	<div class="mb-[26px] flex items-center gap-2.5 max-[900px]:mb-5 max-[900px]:gap-1.5 @max-[360px]:gap-1" role="tablist" aria-label="Chart sections">
		<button
			type="button"
			role="tab"
			class="relative inline-flex min-h-[34px] shrink-0 cursor-pointer items-center gap-1.5 rounded-full border-0 px-3.5 text-[0.84rem] font-semibold whitespace-nowrap text-text bg-sunken motion-safe:transition-[color,scale] motion-safe:duration-150 motion-safe:ease-ui after:absolute after:inset-y-[-5px] after:inset-x-0 after:content-[''] hover:bg-sunken-hover not-aria-selected:focus-visible:bg-sunken-hover focus-visible:outline-none active:scale-[0.96] aria-selected:bg-ink aria-selected:text-on-ink @max-[360px]:px-[9px] @max-[360px]:[&_span]:hidden"
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
						'relative inline-flex h-8 w-8 min-w-[22px] flex-[0_1_32px] cursor-pointer items-center justify-center rounded-full border-0 p-0 text-[0.78rem] font-[650] tabular-nums motion-safe:transition-[box-shadow,scale] motion-safe:duration-150 motion-safe:ease-ui after:absolute after:-inset-y-1.5 after:-inset-x-0.5 after:content-[\'\'] focus-visible:outline-none active:scale-[0.94] max-[900px]:h-7 max-[900px]:w-7 max-[900px]:flex-[0_1_28px] max-[900px]:text-[0.74rem]',
						!isFilled && !isSelected && 'dot-fill',
						isFilled && !isSelected && 'pillar-cell text-on-p',
						!isSelected && 'can-hover:hover:pillar-cell can-hover:hover:text-on-p',
						isSelected &&
							'z-[2] text-[oklch(0.99_0_0)] bg-[oklch(0.6_0.14_var(--h))] shadow-[0_0_0_2px_var(--surface),0_0_0_4px_oklch(0.6_0.14_var(--h))]'
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
				class="relative inline-flex size-[34px] cursor-pointer items-center justify-center rounded-full border-0 p-0 text-muted motion-safe:transition-[color,scale] motion-safe:duration-150 after:absolute after:inset-y-[-5px] after:inset-x-0 after:content-[''] hover:bg-sunken hover:text-text focus-visible:bg-sunken focus-visible:text-text focus-visible:outline-none active:scale-[0.94] max-[900px]:size-[30px]"
				aria-label="Previous section"
				onclick={() => chart.selectPreviousPillar()}
			>
				<Icon name="chevron-left" size={15} />
			</button>
			<button
				type="button"
				class="relative inline-flex size-[34px] cursor-pointer items-center justify-center rounded-full border-0 p-0 text-muted motion-safe:transition-[color,scale] motion-safe:duration-150 after:absolute after:inset-y-[-5px] after:inset-x-0 after:content-[''] hover:bg-sunken hover:text-text focus-visible:bg-sunken focus-visible:text-text focus-visible:outline-none active:scale-[0.94] max-[900px]:size-[30px]"
				aria-label="Next section"
				onclick={() => chart.selectNextPillar()}
			>
				<Icon name="chevron-right" size={15} />
			</button>
		</div>
	</div>

	<div class="mb-5 max-[900px]:mb-4">
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

		<h2 class="font-serif text-[1.85rem] leading-[1.15] font-[480] tracking-[-0.02em] text-balance wrap-anywhere max-[900px]:text-[1.55rem]">{panelTitle}</h2>
	</div>

	{#if showHaradaNotice}
		<div class="mb-4">
			<Notice>
				{#snippet children()}
					Suggest pillars for this goal?
				{/snippet}
				{#snippet action()}
					<Button size="sm" variant="soft" onclick={() => (haradaOpen = true)}>
						Explore
					</Button>
				{/snippet}
			</Notice>
		</div>
	{/if}

	<div class="grid grid-cols-3 gap-2.5 max-[900px]:gap-1.5">
		{#each Array(9) as _, cellIndex (cellIndex)}
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
					{#if info(chart.sel, cellIndex).type === 'action'}
						{@const actionMeta = chart.metaOf(cellKey(chart.sel, cellIndex))}
						{#if actionMeta?.pinned || actionMeta?.done || actionMeta?.note}
							<span class="pointer-events-none absolute top-2.5 right-2.5 z-[2] inline-flex items-center gap-1 text-muted max-[900px]:top-[7px] max-[900px]:right-2">
								{#if actionMeta.pinned}
									<Icon name="pin" size={11} />
								{/if}
								{#if actionMeta.done}
									<Icon name="check" size={11} class="text-success" />
								{/if}
								{#if actionMeta.note}
									<Icon name="link" size={11} class="opacity-80" />
								{/if}
							</span>
						{/if}
					{/if}
				{/if}
				<textarea
					bind:this={textareaElements[cellIndex]}
					class={cn(
						'field h-full min-h-0 w-full min-w-0 resize-none scroll-mt-20 scroll-mb-[140px] rounded-[20px] border-0 bg-sunken px-3 pt-[30px] pb-3 text-[15px] leading-[1.35] text-text motion-safe:transition-[box-shadow] motion-safe:duration-150 placeholder:text-muted placeholder:opacity-75 focus:z-[3] focus:shadow-[0_0_0_2px_var(--ink),0_10px_24px_-10px_oklch(0_0_0/0.3)] focus:outline-none focus-visible:z-[3] focus-visible:shadow-[0_0_0_2px_var(--ink),0_10px_24px_-10px_oklch(0_0_0/0.3)] focus-visible:outline-none max-[900px]:rounded-[15px] max-[900px]:px-2 max-[900px]:pt-[22px] max-[900px]:pb-[7px] max-[900px]:leading-[1.25] max-[900px]:[scrollbar-width:none] max-[900px]:[&::-webkit-scrollbar]:hidden',
						info(chart.sel, cellIndex).type === 'goal' &&
							'goal bg-goal px-4 text-center font-serif text-[17px] font-[520] text-goal-fg rounded-[26px] placeholder:text-goal-fg placeholder:opacity-55 can-hover:hover:bg-goal-hover can-hover:[&.highlight]:bg-goal-hover max-[900px]:rounded-[20px] max-[900px]:text-[15px] [[data-goal-clamped]:not(:focus-within)_&]:overflow-hidden [[data-goal-clamped]:not(:focus-within)_&]:text-transparent',
						info(chart.sel, cellIndex).type === 'pillar' &&
							'pillar pillar-cell rounded-[26px] font-semibold text-on-p placeholder:text-on-p placeholder:opacity-60 can-hover:hover:pillar-hot can-hover:[&.highlight]:pillar-hot max-[900px]:rounded-[20px]',
						info(chart.sel, cellIndex).type === 'action' &&
							'action pillar-action can-hover:hover:action-hot can-hover:[&.highlight]:action-hot',
						info(chart.sel, cellIndex).type === 'action' &&
							chart.metaOf(cellKey(chart.sel, cellIndex))?.done &&
							'line-through opacity-60 text-muted',
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
					data-fit={info(chart.sel, cellIndex).type === 'goal'
						? chart.textOf(cellKey(chart.sel, cellIndex))
						: undefined}
					{@attach info(chart.sel, cellIndex).type === 'goal' ? fitGoalField : undefined}
					onfocus={() => {
						activeCellIndex = cellIndex;
					}}
					onkeydown={(event) => handleFieldKeydown(cellIndex, event)}
					oninput={(event) => chart.setText(cellKey(chart.sel, cellIndex), event.currentTarget.value)}
					onpointerenter={(event) => handleFieldPointerEnter(cellIndex, event)}
					onpointerleave={handleFieldPointerLeave}
				></textarea>
				{#if info(chart.sel, cellIndex).type === 'goal'}
					<span
						class="goal-clamp pointer-events-none absolute inset-0 z-[1] px-4 text-center font-serif text-[length:var(--goal-fit,17px)] leading-[1.35] font-[520] text-goal-fg opacity-0 max-[900px]:px-2 max-[900px]:text-[length:var(--goal-fit,15px)] max-[900px]:leading-[1.25] [[data-goal-clamped]:not(:focus-within)_&]:opacity-100"
						style:padding-top="{GOAL_PAD_TOP}px"
						style:padding-bottom="{GOAL_PAD_BOTTOM}px"
						aria-hidden="true">{chart.textOf(cellKey(chart.sel, cellIndex))}</span
					>
				{/if}
				{#if chart.textOf(cellKey(chart.sel, cellIndex)).length >= 100}
					<span class="pointer-events-none absolute right-2 bottom-2 z-[2] rounded-full bg-ink px-1.5 py-px text-[0.68rem] font-semibold text-on-ink print:hidden">
						{120 - chart.textOf(cellKey(chart.sel, cellIndex)).length}
					</span>
				{/if}
			</div>
		{/each}
	</div>

	{#if activeActionKey && effectiveCellIndex !== null && info(chart.sel, effectiveCellIndex).type === 'action'}
		{@const meta = chart.metaOf(activeActionKey)}
		{@const actionHasText = chart.textOf(activeActionKey).trim().length > 0}
		{#if actionHasText}
			<div class="mt-4 flex flex-col gap-2.5">
				<div class="flex flex-wrap items-center justify-between gap-2">
					<div class="flex flex-wrap items-center gap-2.5">
						<Eyebrow>Action {idx(effectiveCellIndex) + 1}</Eyebrow>
						<SegmentedControl
							size="sm"
							label="Action type"
							options={actionKinds}
							value={meta?.kind ?? 'standard'}
							onchange={(value) => {
								chart.setActionMeta(activeActionKey, {
									kind: value === 'routine' || value === 'milestone' ? value : undefined
								});
							}}
						/>
					</div>

					<div class="flex items-center gap-1.5">
						{#if meta?.kind === 'routine'}
							<Button
								size="sm"
								variant={meta?.pinned ? 'soft' : 'ghost'}
								icon="pin"
								aria-pressed={Boolean(meta?.pinned)}
								onclick={() => chart.setActionMeta(activeActionKey, { pinned: !meta?.pinned })}
							>
								{meta?.pinned ? 'Pinned' : 'Pin'}
							</Button>
						{/if}
						{#if meta?.kind === 'milestone'}
							<Button
								size="sm"
								variant={meta?.done ? 'soft' : 'ghost'}
								icon="check"
								aria-pressed={Boolean(meta?.done)}
								onclick={() => chart.toggleDone(activeActionKey)}
							>
								{meta?.done ? 'Completed' : 'Mark done'}
							</Button>
						{/if}
					</div>
				</div>

				<div class="flex items-center gap-2">
					<div class="relative flex-1">
						<span class="pointer-events-none absolute top-1/2 left-3.5 -translate-y-1/2 text-muted">
							<Icon name="link" size={16} />
						</span>
						<input
							type="text"
							class={cn(fieldInk, 'pr-4 pl-10')}
							placeholder="Add link or note (e.g. YouTube, article, chapter)..."
							value={meta?.note ?? ''}
							oninput={(event) => chart.setActionMeta(activeActionKey, { note: event.currentTarget.value })}
						/>
					</div>
					{#if meta?.note && isUrl(meta.note)}
						<a
							href={meta.note}
							target="_blank"
							rel="noopener noreferrer"
							class="inline-flex size-[42px] shrink-0 items-center justify-center rounded-full text-muted bg-sunken hover:bg-sunken-hover hover:text-text focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink"
							title="Open link in new tab"
							aria-label="Open link in new tab"
						>
							<Icon name="arrow-right" size={13} />
						</a>
					{/if}
				</div>
			</div>
		{/if}
	{/if}

	<ul class="mt-6 list-none border-t border-line pt-[18px] text-[0.86rem] text-muted max-[900px]:hidden">
		<li class="tip relative mb-1.5 ps-4 before:absolute before:start-0.5 before:top-[0.62em] before:size-[5px] before:rounded-full before:bg-line before:content-['']">Pillars should cover different angles: skills, habits, health, resources, support, mindset.</li>
		<li class="tip relative mb-1.5 ps-4 before:absolute before:start-0.5 before:top-[0.62em] before:size-[5px] before:rounded-full before:bg-line before:content-['']">Actions should start with a verb and be within your control.</li>
		<li class="tip relative mb-1.5 ps-4 before:absolute before:start-0.5 before:top-[0.62em] before:size-[5px] before:rounded-full before:bg-line before:content-['']">Editing a pillar here also updates it in the center block.</li>
		<li class="tip relative mb-1.5 ps-4 before:absolute before:start-0.5 before:top-[0.62em] before:size-[5px] before:rounded-full before:bg-line before:content-['']">
			<button
				type="button"
				class="cursor-pointer border-0 bg-transparent p-0 text-muted underline underline-offset-2 hover:text-text focus-visible:text-text focus-visible:outline-none"
				onclick={() => (haradaOpen = true)}
			>
				Suggest pillars
			</button>
		</li>
	</ul>

	<HaradaOnboarding bind:open={haradaOpen} />
</div>
