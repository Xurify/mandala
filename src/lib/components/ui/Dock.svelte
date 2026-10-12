<script lang="ts">
	import type { Snippet } from 'svelte';
	import { dock } from './styles';
	import Toast from './Toast.svelte';

	type Props = {
		label: string;
		hideTabs?: boolean;
		children: Snippet;
	};

	let { label, hideTabs = false, children }: Props = $props();
	const styles = $derived(dock({ hideTabs }));
</script>

<div class={styles.wrap()}>
	<Toast />
	<div class={styles.bar()} role="tablist" aria-label={label}>
		{@render children()}
	</div>
</div>
