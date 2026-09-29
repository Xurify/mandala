<script lang="ts">
	import type { Snippet } from 'svelte';
	import { dock } from './styles';
	import Toast from './Toast.svelte';

	type Props = {
		label: string;
		children: Snippet;
	};

	let { label, children }: Props = $props();
	const styles = dock();
</script>

<div class={styles.wrap()}>
	<Toast />
	<div class={styles.bar()} role="tablist" aria-label={label}>
		{@render children()}
	</div>
</div>
