<script lang="ts">
	import '../app.css';
	import sourceSansLatin from '@fontsource-variable/source-sans-3/files/source-sans-3-latin-wght-normal.woff2?url';
	import sourceSerifLatin from '@fontsource-variable/source-serif-4/files/source-serif-4-latin-opsz-normal.woff2?url';

	let { children } = $props();
</script>

<svelte:head>
	<title>Mandala Method</title>
	<meta
		name="description"
		content="One goal at the center, eight pillars around it, eight actions for each. Type or write by hand. Saved on this device."
	/>
	<meta name="mobile-web-app-capable" content="yes" />
	<meta name="apple-mobile-web-app-capable" content="yes" />
	<meta name="apple-mobile-web-app-title" content="Mandala" />
	<link rel="preload" href={sourceSansLatin} as="font" type="font/woff2" crossorigin="anonymous" />
	<link rel="preload" href={sourceSerifLatin} as="font" type="font/woff2" crossorigin="anonymous" />
	<link rel="apple-touch-icon" href="/apple-touch-icon.png" />
	<link rel="manifest" href="/manifest.webmanifest" />
</svelte:head>

{@render children()}
