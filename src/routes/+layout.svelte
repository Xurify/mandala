<script lang="ts">
	import '@fontsource-variable/bricolage-grotesque';
	import '../app.css';
	import favicon from '$lib/assets/favicon.svg';

	let { children } = $props();
</script>

<svelte:head>
	<title>Mandala Method</title>
	<meta
		name="description"
		content="One goal at the center, eight pillars around it, eight actions for each. Type or write by hand. Saved on this device."
	/>
	<meta name="theme-color" content="#f4f5f7" media="(prefers-color-scheme: light)" />
	<meta name="theme-color" content="#1f2228" media="(prefers-color-scheme: dark)" />
	<meta name="mobile-web-app-capable" content="yes" />
	<meta name="apple-mobile-web-app-capable" content="yes" />
	<meta name="apple-mobile-web-app-title" content="Mandala" />
	<link rel="icon" href={favicon} />
	<link rel="apple-touch-icon" href="/apple-touch-icon.png" />
	<link rel="manifest" href="/manifest.webmanifest" />
</svelte:head>

{@render children()}
