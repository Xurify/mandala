<script lang="ts">
	import type { Snippet } from 'svelte';
	import { dock } from './styles';
	import Toast from './Toast.svelte';

	type Props = {
		label: string;
		/** The tabs step aside while the page has nothing for them yet; the toast above stays. */
		away?: boolean;
		children: Snippet;
	};

	let { label, away = false, children }: Props = $props();
	const styles = $derived(dock({ away }));
</script>

<div class={styles.wrap()}>
	<Toast />
	<div class={styles.bar()} role="tablist" aria-label={label}>
		{@render children()}
	</div>
</div>
