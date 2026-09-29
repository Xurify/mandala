<script lang="ts">
	import { chart } from '$lib/chart/chart.svelte';
	import { toast } from './styles';
</script>

<div class={toast({ on: chart.status.length > 0 })} role="status" aria-live="polite">
	{chart.status}
</div>
