<script lang="ts">
	export type IconName =
		| 'search'
		| 'close'
		| 'chevron-down'
		| 'chevron-left'
		| 'chevron-right'
		| 'arrow-right'
		| 'arrow-up-right'
		| 'arrow-left'
		| 'target'
		| 'grid'
		| 'edit'
		| 'type'
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
		| 'maximize'
		| 'minimize'
		| 'info'
		| 'more'
		| 'calendar'
		| 'pin'
		| 'link'
		| 'refresh'
		| 'folder'
		| 'command'
		| 'keyboard'
		| 'clock'
		| 'plus';

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
	{:else if name === 'arrow-up-right'}
		<line x1="7" y1="17" x2="17" y2="7" />
		<polyline points="8 7 17 7 17 16" />
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
	{:else if name === 'type'}
		<polyline points="4 7 4 4 20 4 20 7" />
		<line x1="12" y1="4" x2="12" y2="20" />
		<line x1="9" y1="20" x2="15" y2="20" />
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
		<path d="M12 3l1.9 4.8L18.7 9.7l-4.8 1.9L12 16.4l-1.9-4.8L5.3 9.7l4.8-1.9L12 3z" />
		<path d="M19 15l1 2.5 2.5 1-2.5 1-1 2.5-1-2.5-2.5-1 2.5-1 1-2.5z" />
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
	{/if}
</svg>
