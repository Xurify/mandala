<script lang="ts">
	import { HUES } from '$lib/chart/model';
	import { arcPath, pillarArc } from '$lib/chart/ring';

	export type IconName =
		| 'search'
		| 'close'
		| 'chevron-down'
		| 'chevron-left'
		| 'chevron-right'
		| 'arrow-right'
		| 'arrow-left'
		| 'target'
		| 'grid'
		| 'edit'
		| 'printer'
		| 'image'
		| 'download'
		| 'upload'
		| 'copy'
		| 'file-text'
		| 'clipboard'
		| 'trash'
		| 'sparkles'
		| 'undo'
		| 'sun'
		| 'moon'
		| 'monitor'
		| 'check'
		| 'compass'
		| 'list'
		| 'eye'
		| 'columns'
		| 'board'
		| 'maximize'
		| 'minimize'
		| 'info'
		| 'more'
		| 'calendar'
		| 'pin'
		| 'link'
		| 'shelf'
		| 'refresh'
		| 'folder'
		| 'command'
		| 'keyboard'
		| 'clock'
		| 'timer'
		| 'hourglass'
		| 'stop'
		| 'plus'
		| 'book'
		| 'bindu'
		| 'key'
		| 'claude'
		| 'openai'
		| 'gemini'
		| 'mistral'
		| 'perplexity'
		| 'grok';

	interface Props {
		name: IconName;
		size?: number;
		strokeWidth?: number;
		class?: string;
	}

	let {
		name,
		size = 18,
		strokeWidth = 1.8,
		class: className = ''
	}: Props = $props();

	// Optically tuned for icon sizes (16-24px): wider gap (16°) prevents color bleeding,
	// slightly bolder face features keep eyes and smile crisp and cheerful at small sizes.
	const binduRing = { radius: 9.2, stroke: 2.8, gap: 16 };
	const binduSegments = HUES.map((hue, pillarIndex) => {
		const { start, end } = pillarArc(pillarIndex, binduRing);
		return { hue, d: arcPath(12, 12, binduRing.radius, start, end) };
	});
</script>

<svg
	class="inline-block shrink-0 align-middle {className}"
	width={size}
	height={size}
	viewBox="0 0 24 24"
	fill="none"
	stroke="currentColor"
	stroke-width={strokeWidth}
	stroke-linecap="round"
	stroke-linejoin="round"
	aria-hidden="true"
>
	{#if name === 'search'}
		<circle cx="11" cy="11" r="7" />
		<line x1="16.5" y1="16.5" x2="21" y2="21" />
	{:else if name === 'close'}
		<line x1="18" y1="6" x2="6" y2="18" />
		<line x1="6" y1="6" x2="18" y2="18" />
	{:else if name === 'plus'}
		<line x1="12" y1="5" x2="12" y2="19" />
		<line x1="5" y1="12" x2="19" y2="12" />
	{:else if name === 'chevron-down'}
		<polyline points="6 9 12 15 18 9" />
	{:else if name === 'chevron-left'}
		<polyline points="15 18 9 12 15 6" />
	{:else if name === 'chevron-right'}
		<polyline points="9 18 15 12 9 6" />
	{:else if name === 'arrow-right'}
		<line x1="5" y1="12" x2="19" y2="12" />
		<polyline points="12 5 19 12 12 19" />
	<!-- Brand marks (simple-icons, CC0), filled rather than stroked. -->
	{:else if name === 'claude'}
		<path fill="currentColor" stroke="none" d="m4.7144 15.9555 4.7174-2.6471.079-.2307-.079-.1275h-.2307l-.7893-.0486-2.6956-.0729-2.3375-.0971-2.2646-.1214-.5707-.1215-.5343-.7042.0546-.3522.4797-.3218.686.0608 1.5179.1032 2.2767.1578 1.6514.0972 2.4468.255h.3886l.0546-.1579-.1336-.0971-.1032-.0972L6.973 9.8356l-2.55-1.6879-1.3356-.9714-.7225-.4918-.3643-.4614-.1578-1.0078.6557-.7225.8803.0607.2246.0607.8925.686 1.9064 1.4754 2.4893 1.8336.3643.3035.1457-.1032.0182-.0728-.164-.2733-1.3539-2.4467-1.445-2.4893-.6435-1.032-.17-.6194c-.0607-.255-.1032-.4674-.1032-.7285L6.287.1335 6.6997 0l.9957.1336.419.3642.6192 1.4147 1.0018 2.2282 1.5543 3.0296.4553.8985.2429.8318.091.255h.1579v-.1457l.1275-1.706.2368-2.0947.2307-2.6957.0789-.7589.3764-.9107.7468-.4918.5828.2793.4797.686-.0668.4433-.2853 1.8517-.5586 2.9021-.3643 1.9429h.2125l.2429-.2429.9835-1.3053 1.6514-2.0643.7286-.8196.85-.9046.5464-.4311h1.0321l.759 1.1293-.34 1.1657-1.0625 1.3478-.8804 1.1414-1.2628 1.7-.7893 1.36.0729.1093.1882-.0183 2.8535-.607 1.5421-.2794 1.8396-.3157.8318.3886.091.3946-.3278.8075-1.967.4857-2.3072.4614-3.4364.8136-.0425.0304.0486.0607 1.5482.1457.6618.0364h1.621l3.0175.2247.7892.522.4736.6376-.079.4857-1.2142.6193-1.6393-.3886-3.825-.9107-1.3113-.3279h-.1822v.1093l1.0929 1.0686 2.0035 1.8092 2.5075 2.3314.1275.5768-.3218.4554-.34-.0486-2.2039-1.6575-.85-.7468-1.9246-1.621h-.1275v.17l.4432.6496 2.3436 3.5214.1214 1.0807-.17.3521-.6071.2125-.6679-.1214-1.3721-1.9246L14.38 17.959l-1.1414-1.9428-.1397.079-.674 7.2552-.3156.3703-.7286.2793-.6071-.4614-.3218-.7468.3218-1.4753.3886-1.9246.3157-1.53.2853-1.9004.17-.6314-.0121-.0425-.1397.0182-1.4328 1.9672-2.1796 2.9446-1.7243 1.8456-.4128.164-.7164-.3704.0667-.6618.4008-.5889 2.386-3.0357 1.4389-1.882.929-1.0868-.0062-.1579h-.0546l-6.3385 4.1164-1.1293.1457-.4857-.4554.0608-.7467.2307-.2429 1.9064-1.3114Z" />
	{:else if name === 'openai'}
		<path fill="currentColor" stroke="none" d="M22.2819 9.8211a5.9847 5.9847 0 0 0-.5157-4.9108 6.0462 6.0462 0 0 0-6.5098-2.9A6.0651 6.0651 0 0 0 4.9807 4.1818a5.9847 5.9847 0 0 0-3.9977 2.9 6.0462 6.0462 0 0 0 .7427 7.0966 5.98 5.98 0 0 0 .511 4.9107 6.051 6.051 0 0 0 6.5146 2.9001A5.9847 5.9847 0 0 0 13.2599 24a6.0557 6.0557 0 0 0 5.7718-4.2058 5.9894 5.9894 0 0 0 3.9977-2.9001 6.0557 6.0557 0 0 0-.7475-7.0729zm-9.022 12.6081a4.4755 4.4755 0 0 1-2.8764-1.0408l.1419-.0804 4.7783-2.7582a.7948.7948 0 0 0 .3927-.6813v-6.7369l2.02 1.1686a.071.071 0 0 1 .038.052v5.5826a4.504 4.504 0 0 1-4.4945 4.4944zm-9.6607-4.1254a4.4708 4.4708 0 0 1-.5346-3.0137l.142.0852 4.783 2.7582a.7712.7712 0 0 0 .7806 0l5.8428-3.3685v2.3324a.0804.0804 0 0 1-.0332.0615L9.74 19.9502a4.4992 4.4992 0 0 1-6.1408-1.6464zM2.3408 7.8956a4.485 4.485 0 0 1 2.3655-1.9728V11.6a.7664.7664 0 0 0 .3879.6765l5.8144 3.3543-2.0201 1.1685a.0757.0757 0 0 1-.071 0l-4.8303-2.7865A4.504 4.504 0 0 1 2.3408 7.872zm16.5963 3.8558L13.1038 8.364 15.1192 7.2a.0757.0757 0 0 1 .071 0l4.8303 2.7913a4.4944 4.4944 0 0 1-.6765 8.1042v-5.6772a.79.79 0 0 0-.407-.667zm2.0107-3.0231l-.142-.0852-4.7735-2.7818a.7759.7759 0 0 0-.7854 0L9.409 9.2297V6.8974a.0662.0662 0 0 1 .0284-.0615l4.8303-2.7866a4.4992 4.4992 0 0 1 6.6802 4.66zM8.3065 12.863l-2.02-1.1638a.0804.0804 0 0 1-.038-.0567V6.0742a4.4992 4.4992 0 0 1 7.3757-3.4537l-.142.0805L8.704 5.459a.7948.7948 0 0 0-.3927.6813zm1.0976-2.3654l2.602-1.4998 2.6069 1.4998v2.9994l-2.5974 1.4997-2.6067-1.4997Z" />
	{:else if name === 'gemini'}
		<path fill="currentColor" stroke="none" d="M11.04 19.32Q12 21.51 12 24q0-2.49.93-4.68.96-2.19 2.58-3.81t3.81-2.55Q21.51 12 24 12q-2.49 0-4.68-.93a12.3 12.3 0 0 1-3.81-2.58 12.3 12.3 0 0 1-2.58-3.81Q12 2.49 12 0q0 2.49-.96 4.68-.93 2.19-2.55 3.81a12.3 12.3 0 0 1-3.81 2.58Q2.49 12 0 12q2.49 0 4.68.96 2.19.93 3.81 2.55t2.55 3.81" />
	{:else if name === 'mistral'}
		<path fill="currentColor" stroke="none" d="M17.143 3.429v3.428h-3.429v3.429h-3.428V6.857H6.857V3.43H3.43v13.714H0v3.428h10.286v-3.428H6.857v-3.429h3.429v3.429h3.429v-3.429h3.428v3.429h-3.428v3.428H24v-3.428h-3.43V3.429z" />
	{:else if name === 'perplexity'}
		<path fill="currentColor" stroke="none" d="M22.3977 7.0896h-2.3106V.0676l-7.5094 6.3542V.1577h-1.1554v6.1966L4.4904 0v7.0896H1.6023v10.3976h2.8882V24l6.932-6.3591v6.2005h1.1554v-6.0469l6.9318 6.1807v-6.4879h2.8882V7.0896zm-3.4657-4.531v4.531h-5.355l5.355-4.531zm-13.2862.0676 4.8691 4.4634H5.6458V2.6262zM2.7576 16.332V8.245h7.8476l-6.1149 6.1147v1.9723H2.7576zm2.8882 5.0404v-3.8852h.0001v-2.6488l5.7763-5.7764v7.0111l-5.7764 5.2993zm12.7086.0248-5.7766-5.1509V9.0618l5.7766 5.7766v6.5588zm2.8882-5.0652h-1.733v-1.9723L13.3948 8.245h7.8478v8.087z" />
	{:else if name === 'grok'}
		<path fill="currentColor" stroke="none" d="M14.234 10.162 22.977 0h-2.072l-7.591 8.824L7.251 0H.258l9.168 13.343L.258 24H2.33l8.016-9.318L16.749 24h6.993zm-2.837 3.299-.929-1.329L3.076 1.56h3.182l5.965 8.532.929 1.329 7.754 11.09h-3.182z" />
	{:else if name === 'arrow-left'}
		<line x1="19" y1="12" x2="5" y2="12" />
		<polyline points="12 19 5 12 12 5" />
	{:else if name === 'target'}
		<circle cx="12" cy="12" r="9" />
		<circle cx="12" cy="12" r="5" />
		<circle cx="12" cy="12" r="1.5" fill="currentColor" />
	{:else if name === 'grid'}
		<rect x="3" y="3" width="6" height="6" rx="1.5" />
		<rect x="15" y="3" width="6" height="6" rx="1.5" />
		<rect x="9" y="3" width="6" height="6" rx="1.5" />
		<rect x="3" y="9" width="6" height="6" rx="1.5" />
		<rect x="9" y="9" width="6" height="6" rx="1.5" />
		<rect x="15" y="9" width="6" height="6" rx="1.5" />
		<rect x="3" y="15" width="6" height="6" rx="1.5" />
		<rect x="9" y="15" width="6" height="6" rx="1.5" />
		<rect x="15" y="15" width="6" height="6" rx="1.5" />
	{:else if name === 'edit'}
		<path d="M12 20h9" />
		<path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" />
	{:else if name === 'printer'}
		<polyline points="6 9 6 2 18 2 18 9" />
		<path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2" />
		<rect x="6" y="14" width="12" height="8" rx="1" />
	{:else if name === 'image'}
		<rect x="3" y="3" width="18" height="18" rx="2" />
		<circle cx="8.5" cy="8.5" r="1.5" />
		<polyline points="21 15 16 10 5 21" />
	{:else if name === 'download'}
		<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
		<polyline points="7 10 12 15 17 10" />
		<line x1="12" y1="15" x2="12" y2="3" />
	{:else if name === 'upload'}
		<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
		<polyline points="17 8 12 3 7 8" />
		<line x1="12" y1="3" x2="12" y2="15" />
	{:else if name === 'copy'}
		<rect x="9" y="9" width="13" height="13" rx="2" />
		<path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
	{:else if name === 'file-text'}
		<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
		<polyline points="14 2 14 8 20 8" />
		<line x1="16" y1="13" x2="8" y2="13" />
		<line x1="16" y1="17" x2="8" y2="17" />
		<line x1="10" y1="9" x2="8" y2="9" />
	{:else if name === 'clipboard'}
		<rect width="8" height="4" x="8" y="2" rx="1" ry="1" />
		<path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2" />
	{:else if name === 'trash'}
		<polyline points="3 6 5 6 21 6" />
		<path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
		<line x1="10" y1="11" x2="10" y2="17" />
		<line x1="14" y1="11" x2="14" y2="17" />
	{:else if name === 'sparkles'}
		<path d="M9.937 15.5A2 2 0 0 0 8.5 14.063l-6.135-1.582a.5.5 0 0 1 0-.962L8.5 9.936A2 2 0 0 0 9.937 8.5l1.582-6.135a.5.5 0 0 1 .963 0L14.063 8.5A2 2 0 0 0 15.5 9.937l6.135 1.581a.5.5 0 0 1 0 .964L15.5 14.063a2 2 0 0 0-1.437 1.437l-1.582 6.135a.5.5 0 0 1-.963 0z" />
		<path d="M20 3v4" />
		<path d="M22 5h-4" />
	{:else if name === 'undo'}
		<path d="M3 7v6h6" />
		<path d="M21 17a9 9 0 0 0-9-9 9 9 0 0 0-6 2.3L3 13" />
	{:else if name === 'sun'}
		<circle cx="12" cy="12" r="4" />
		<line x1="12" y1="2" x2="12" y2="4" />
		<line x1="12" y1="20" x2="12" y2="22" />
		<line x1="4.22" y1="4.22" x2="5.64" y2="5.64" />
		<line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
		<line x1="2" y1="12" x2="4" y2="12" />
		<line x1="20" y1="12" x2="22" y2="12" />
		<line x1="4.22" y1="19.78" x2="5.64" y2="18.36" />
		<line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
	{:else if name === 'moon'}
		<path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
	{:else if name === 'monitor'}
		<rect x="2" y="3" width="20" height="14" rx="2" />
		<line x1="8" y1="21" x2="16" y2="21" />
		<line x1="12" y1="17" x2="12" y2="21" />
	{:else if name === 'check'}
		<polyline points="20 6 9 17 4 12" />
	{:else if name === 'compass'}
		<circle cx="12" cy="12" r="10" />
		<polygon points="16.24 7.76 14.12 14.12 7.76 16.24 9.88 9.88 16.24 7.76" fill="currentColor" fill-opacity="0.2" />
	{:else if name === 'list'}
		<line x1="8" y1="6" x2="21" y2="6" />
		<line x1="8" y1="12" x2="21" y2="12" />
		<line x1="8" y1="18" x2="21" y2="18" />
		<line x1="3" y1="6" x2="3.01" y2="6" />
		<line x1="3" y1="12" x2="3.01" y2="12" />
		<line x1="3" y1="18" x2="3.01" y2="18" />
	{:else if name === 'eye'}
		<path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z" />
		<circle cx="12" cy="12" r="3" />
	{:else if name === 'columns'}
		<rect x="3" y="3" width="18" height="18" rx="2" />
		<line x1="12" y1="3" x2="12" y2="21" />
	{:else if name === 'board'}
		<rect x="3" y="3" width="18" height="18" rx="2" />
		<line x1="8" y1="7" x2="8" y2="15" />
		<line x1="12" y1="7" x2="12" y2="11" />
		<line x1="16" y1="7" x2="16" y2="17" />
	{:else if name === 'maximize'}
		<polyline points="15 3 21 3 21 9" />
		<polyline points="9 21 3 21 3 15" />
		<line x1="21" y1="3" x2="14" y2="10" />
		<line x1="3" y1="21" x2="10" y2="14" />
	{:else if name === 'minimize'}
		<polyline points="4 14 10 14 10 20" />
		<polyline points="20 10 14 10 14 4" />
		<line x1="14" y1="10" x2="21" y2="3" />
		<line x1="3" y1="21" x2="10" y2="14" />
	{:else if name === 'info'}
		<circle cx="12" cy="12" r="9" />
		<line x1="12" y1="11" x2="12" y2="16" />
		<line x1="12" y1="8" x2="12.01" y2="8" />
	{:else if name === 'more'}
		<circle cx="5" cy="12" r="1.4" fill="currentColor" />
		<circle cx="12" cy="12" r="1.4" fill="currentColor" />
		<circle cx="19" cy="12" r="1.4" fill="currentColor" />
	{:else if name === 'calendar'}
		<rect x="3" y="4" width="18" height="18" rx="2" />
		<line x1="16" y1="2" x2="16" y2="6" />
		<line x1="8" y1="2" x2="8" y2="6" />
		<line x1="3" y1="10" x2="21" y2="10" />
	{:else if name === 'pin'}
		<line x1="12" y1="17" x2="12" y2="22" />
		<path d="M5 17h14v-1.76a2 2 0 0 0-1.11-1.79l-1.78-.9A2 2 0 0 1 15 10.76V6h1a2 2 0 0 0 0-4H8a2 2 0 0 0 0 4h1v4.76a2 2 0 0 1-1.11 1.79l-1.78.9A2 2 0 0 0 5 15.24Z" />
	{:else if name === 'link'}
		<path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
		<path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
	{:else if name === 'shelf'}
		<path d="M4 4v16" />
		<path d="M8 8v12" />
		<path d="M12 6v14" />
		<path d="m16 6 4 14" />
	{:else if name === 'refresh'}
		<polyline points="23 4 23 10 17 10" />
		<polyline points="1 20 1 14 7 14" />
		<path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
	{:else if name === 'folder'}
		<path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
	{:else if name === 'command'}
		<path d="M18 3a3 3 0 0 0-3 3v12a3 3 0 0 0 3 3 3 3 0 0 0 3-3 3 3 0 0 0-3-3H6a3 3 0 0 0-3 3 3 3 0 0 0 3 3 3 3 0 0 0 3-3V6a3 3 0 0 0-3-3 3 3 0 0 0-3 3 3 3 0 0 0 3 3h12a3 3 0 0 0 3-3 3 3 0 0 0-3-3z" />
	{:else if name === 'keyboard'}
		<rect x="2" y="5" width="20" height="14" rx="2" />
		<path d="M6 9h.01M10 9h.01M14 9h.01M18 9h.01M8 13h.01M12 13h.01M16 13h.01M7 16h10" />
	{:else if name === 'clock'}
		<circle cx="12" cy="12" r="9" />
		<polyline points="12 7 12 12 15 14" />
	{:else if name === 'timer'}
		<line x1="10" y1="2" x2="14" y2="2" />
		<line x1="12" y1="14" x2="15" y2="11" />
		<circle cx="12" cy="14" r="8" />
	{:else if name === 'hourglass'}
		<path d="M6 2h12" />
		<path d="M6 22h12" />
		<path d="M7 2v2.5c0 2.5 5 4.5 5 7.5s-5 5-5 7.5V22" />
		<path d="M17 2v2.5c0 2.5-5 4.5-5 7.5s5 5 5 7.5V22" />
	{:else if name === 'stop'}
		<rect x="6.5" y="6.5" width="11" height="11" rx="2" fill="currentColor" stroke="none" />
	{:else if name === 'book'}
		<path d="M2 4h6a4 4 0 0 1 4 4v13a3 3 0 0 0-3-3H2z" />
		<path d="M22 4h-6a4 4 0 0 0-4 4v13a3 3 0 0 1 3-3h7z" />
	{:else if name === 'bindu'}
		<circle cx="12" cy="12" r="7.4" class="fill-ink stroke-none" />
		{#each binduSegments as segment (segment.hue)}
			<path
				class="pillar-stroke fill-none stroke-[2.8] [stroke-linecap:round]"
				style:--h={segment.hue}
				d={segment.d}
			/>
		{/each}
		<ellipse cx="9.5" cy="11.2" rx="1.2" ry="1.5" class="fill-on-ink stroke-none" />
		<ellipse cx="14.5" cy="11.2" rx="1.2" ry="1.5" class="fill-on-ink stroke-none" />
		<path
			d="M 9.8 14.1 Q 12 16.3 14.2 14.1"
			class="stroke-on-ink fill-none stroke-[1.4] [stroke-linecap:round]"
		/>
	{:else if name === 'key'}
		<circle cx="7.5" cy="15.5" r="4.5" />
		<path d="m10.7 12.3 9.8-9.8" />
		<path d="m15.5 7.5 3 3" />
		<path d="m19 4 2.5 2.5" />
	{/if}
</svg>
