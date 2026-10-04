<script lang="ts">
	import { cn } from './cn';

	interface Props {
		class?: string;
	}

	let { class: className }: Props = $props();
</script>

<span class={cn('ms-1 inline-flex items-center gap-[3px]', className)} aria-hidden="true">
	<span class="size-1 rounded-full bg-current opacity-35 motion-safe:animate-dot-bounce"></span>
	<span class="size-1 rounded-full bg-current opacity-35 motion-safe:animate-dot-bounce" style:animation-delay="160ms"></span>
	<span class="size-1 rounded-full bg-current opacity-35 motion-safe:animate-dot-bounce" style:animation-delay="320ms"></span>
</span>
