<script lang="ts">
	import { encode } from 'uqr';
	import { cn } from './ui/cn';

	interface Props {
		text: string;
		label: string;
		class?: string;
	}

	let { text, label, class: className }: Props = $props();

	const code = $derived(encode(text, { ecc: 'M', border: 0 }));
	const modules = $derived(code.data.flatMap((row, y) => row.flatMap((on, x) => (on ? [`M${x} ${y}h1v1h-1z`] : []))).join(''));
</script>

<!-- Four modules of quiet paper around the code, as the QR spec asks, so a camera finds its edges. -->
<svg
	viewBox="-4 -4 {code.size + 8} {code.size + 8}"
	role="img"
	aria-label={label}
	shape-rendering="crispEdges"
	class={cn('block rounded-[18px] bg-qr-paper text-qr-ink', className)}
	data-qr={text}
>
	<path d={modules} fill="currentColor" />
</svg>
