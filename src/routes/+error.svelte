<script lang="ts">
	import { onMount } from 'svelte';
	import { page } from '$app/state';
	import BrandMark from '$lib/components/BrandMark.svelte';
	import HelperFace from '$lib/components/HelperFace.svelte';
	import type { HelperMood } from '$lib/chart/helper.svelte';
	import { filledCount } from '$lib/chart/model';
	import { LIBRARY_KEY, formatUpdated, parseLibrary, titleOf } from '$lib/chart/library';
	import Button from '$lib/components/ui/Button.svelte';
	import Eyebrow from '$lib/components/ui/Eyebrow.svelte';
	import Icon from '$lib/components/Icon.svelte';
	import SegmentedControl from '$lib/components/ui/SegmentedControl.svelte';

	interface SavedGoalItem {
		id: string;
		title: string;
		filled: number;
		updated: string;
	}

	const missing = $derived(page.status === 404);
	const statusHeading = $derived(missing ? 'Lost your place?' : 'Something went wrong');
	const statusExplanation = $derived(
		missing
			? "This page doesn't exist. It might have moved, or the link has a typo. Everything you've written is safe on this device."
			: "An error occurred while opening this page. Everything you've written is safe on this device."
	);

	const themeOptions = [
		{ value: 'system', label: 'Auto', icon: 'monitor' as const },
		{ value: 'light', label: 'Light', icon: 'sun' as const },
		{ value: 'dark', label: 'Dark', icon: 'moon' as const }
	];

	let currentTheme = $state<'system' | 'light' | 'dark'>('system');
	let savedGoals = $state<SavedGoalItem[]>([]);

	const binduNotes = [
		"Need a hand getting back? I'm right here.",
		'Take your time. No rush at all.',
		"Everything you've saved is safe on this device.",
		'One goal in the center, eight pillars around it.',
		'Tap any saved goal below to pick up where you left off.'
	];

	let noteIndex = $state(0);
	let currentMood = $state<HelperMood>('puzzled');
	let isHopping = $state(false);

	function interactBindu(): void {
		noteIndex = (noteIndex + 1) % binduNotes.length;
		currentMood =
			currentMood === 'happy'
				? 'listening'
				: currentMood === 'listening'
					? 'thinking'
					: 'happy';
		isHopping = true;
		setTimeout(() => {
			isHopping = false;
		}, 550);
	}

	function handleThemeChange(selectedTheme: string): void {
		const nextTheme = selectedTheme as 'system' | 'light' | 'dark';
		currentTheme = nextTheme;
		if (typeof window !== 'undefined') {
			if (nextTheme === 'light' || nextTheme === 'dark') {
				document.documentElement.setAttribute('data-theme', nextTheme);
				localStorage.setItem('theme', nextTheme);
			} else {
				document.documentElement.removeAttribute('data-theme');
				localStorage.removeItem('theme');
			}
		}
	}

	function openSavedGoal(goalId: string): void {
		try {
			const storedData = localStorage.getItem(LIBRARY_KEY);
			if (storedData) {
				const library = parseLibrary(storedData);
				if (library) {
					library.activeId = goalId;
					localStorage.setItem(LIBRARY_KEY, JSON.stringify(library));
				}
			}
		} catch {
			// Storage access blocked or restricted
		}
		window.location.href = '/';
	}

	onMount(() => {
		try {
			const storedTheme = localStorage.getItem('theme');
			if (storedTheme === 'light' || storedTheme === 'dark') {
				currentTheme = storedTheme;
				document.documentElement.setAttribute('data-theme', storedTheme);
			}

			const storedData = localStorage.getItem(LIBRARY_KEY);
			if (storedData) {
				const library = parseLibrary(storedData);
				if (library && library.charts.length > 0) {
					savedGoals = library.charts
						.filter((record) => record.data.goal.trim().length > 0)
						.sort((first, second) => second.updatedAt - first.updatedAt)
						.slice(0, 3)
						.map((record) => ({
							id: record.id,
							title: titleOf(record.data),
							filled: filledCount(record.data),
							updated: formatUpdated(record.updatedAt)
						}));
				}
			}
		} catch {
			savedGoals = [];
		}

		const handleKeyDown = (event: KeyboardEvent): void => {
			if (event.key === 'Escape' || event.key === 'Enter') {
				const active = document.activeElement;
				if (active && (active.tagName === 'BUTTON' || active.tagName === 'A')) {
					return;
				}
				window.location.href = '/';
			}
		};

		window.addEventListener('keydown', handleKeyDown);
		return () => {
			window.removeEventListener('keydown', handleKeyDown);
		};
	});
</script>

<svelte:head>
	<title>{statusHeading} · Mandala</title>
</svelte:head>

<div
	class="mx-auto flex min-h-dvh max-w-[880px] flex-col px-7 pt-[max(24px,env(safe-area-inset-top,24px))] pb-16 max-[900px]:px-4 max-[900px]:pt-[max(16px,env(safe-area-inset-top,16px))]"
>
	<header class="flex flex-wrap items-center justify-between gap-3">
		<a
			href="/"
			class="inline-flex min-w-0 items-center gap-2.5 rounded-full py-1 pr-3 text-text no-underline transition-opacity duration-150 ease-ui hover:opacity-80 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink"
			aria-label="Return to Mandala home"
		>
			<BrandMark />
			<span class="font-serif text-[1.3rem] leading-none font-[560] tracking-[-0.02em]">Mandala</span>
		</a>

		<SegmentedControl
			label="Theme"
			size="sm"
			options={themeOptions}
			value={currentTheme}
			onchange={handleThemeChange}
		/>
	</header>

	<main class="my-auto flex flex-col items-center py-10 text-center max-[900px]:py-6">
		<div
			class="relative flex w-full max-w-[540px] flex-col items-center rounded-[32px] bg-surface p-9 shadow-card motion-safe:animate-pop-in max-[900px]:p-6"
		>
			<div class="mb-5 flex flex-col items-center gap-3">
				<button
					type="button"
					class="group relative flex size-24 cursor-pointer items-center justify-center rounded-full border-0 bg-transparent p-0 transition-transform duration-150 ease-ui hover:scale-105 active:scale-95 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ink"
					onclick={interactBindu}
					aria-label="Talk to Bindu, click to change reaction"
				>
					<HelperFace
						mood={currentMood}
						size={88}
						class={isHopping ? 'motion-safe:animate-hop' : ''}
					/>
				</button>

				<button
					type="button"
					onclick={interactBindu}
					class="group flex cursor-pointer items-center gap-2 rounded-full border-0 px-4 py-1.5 text-left text-[0.86rem] text-text bg-sunken transition-[scale] duration-150 ease-ui hover:bg-sunken-hover active:scale-[0.98] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink"
					aria-label="Click for another note from Bindu"
				>
					<span class="font-medium text-muted">Bindu:</span>
					<span class="text-text">{binduNotes[noteIndex]}</span>
				</button>
			</div>

			<div class="mb-2">
				<Eyebrow>Error {page.status}</Eyebrow>
			</div>

			<h1
				class="m-0 font-serif text-[clamp(1.9rem,5vw,2.5rem)] leading-[1.1] font-[600] tracking-[-0.03em] text-balance text-text"
			>
				{statusHeading}
			</h1>

			<p class="m-0 mt-3 max-w-[420px] text-[0.98rem] leading-[1.5] text-pretty text-muted">
				{statusExplanation}
			</p>

			<div class="mt-7 flex flex-wrap items-center justify-center gap-3">
				<Button href="/" variant="primary">
					Return home
					<Icon name="arrow-right" size={16} />
				</Button>
				<Button href="/#presets" variant="soft">
					Browse presets
				</Button>
			</div>

			{#if savedGoals.length > 0}
				<div class="mt-8 w-full border-t border-line/60 pt-6 text-left">
					<div class="mb-3 px-1">
						<Eyebrow pip="goal">Your saved goals</Eyebrow>
					</div>
					<div class="flex flex-col gap-2">
						{#each savedGoals as goal (goal.id)}
							<button
								type="button"
								onclick={() => openSavedGoal(goal.id)}
								class="flex w-full cursor-pointer items-center justify-between gap-3 rounded-[18px] border-0 px-4 py-3 text-left bg-sunken transition-[scale] duration-150 ease-ui hover:bg-sunken-hover active:scale-[0.98] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink"
							>
								<div class="min-w-0 flex-1">
									<div class="truncate text-[0.94rem] font-[560] text-text">{goal.title}</div>
									<div class="text-[0.78rem] text-muted">{goal.updated}</div>
								</div>
								<div class="flex shrink-0 items-center gap-1.5 text-[0.82rem] font-medium text-muted">
									<span class="tabular-nums">{goal.filled} of 73 cells</span>
									<Icon name="arrow-right" size={14} />
								</div>
							</button>
						{/each}
					</div>
				</div>
			{/if}

			<p class="m-0 mt-6 text-[0.78rem] text-muted/80">
				Press <kbd class="rounded bg-sunken px-1.5 py-0.5 font-mono text-[0.72rem]">Esc</kbd> or
				<kbd class="rounded bg-sunken px-1.5 py-0.5 font-mono text-[0.72rem]">Enter</kbd> to return home
			</p>
		</div>
	</main>
</div>
