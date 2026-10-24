<script lang="ts">
	import type { Snippet } from 'svelte';
	import { dock } from './styles';
	import Toast from './Toast.svelte';

	type Props = {
		label: string;
		hideTabs?: boolean;
		children: Snippet;
		above?: Snippet;
	};

	let { label, hideTabs = false, children, above }: Props = $props();
	const styles = $derived(dock({ hideTabs }));

	function walk(event: KeyboardEvent): void {
		const bar = event.currentTarget as HTMLElement;
		const tabs = [...bar.querySelectorAll<HTMLButtonElement>('[role="tab"]')];
		if (!tabs.length) return;
		const current = tabs.findIndex((tab) => tab.getAttribute('aria-selected') === 'true');
		let next: HTMLButtonElement | undefined;
		if (event.key === 'ArrowRight') next = tabs[((current < 0 ? 0 : current) + 1) % tabs.length];
		else if (event.key === 'ArrowLeft') next = tabs[((current < 0 ? 0 : current) - 1 + tabs.length) % tabs.length];
		else if (event.key === 'Home') next = tabs[0];
		else if (event.key === 'End') next = tabs[tabs.length - 1];
		if (!next) return;
		event.preventDefault();
		next.click();
		next.focus();
	}
</script>

<div class={styles.wrap()}>
	<Toast />
	{@render above?.()}
	<div class={styles.bar()} role="tablist" tabindex="-1" aria-label={label} onkeydown={walk}>
		{@render children()}
	</div>
</div>
