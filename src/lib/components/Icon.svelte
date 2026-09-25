<script lang="ts">
	interface Props {
		name:
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
			| 'type'
			| 'ink'
			| 'printer'
			| 'image'
			| 'download'
			| 'upload'
			| 'copy'
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
			| 'info';
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
	class="ui-icon {className}"
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
	{:else if name === 'chevron-down'}
		<polyline points="6 9 12 15 18 9" />
	{:else if name === 'chevron-left'}
		<polyline points="15 18 9 12 15 6" />
	{:else if name === 'chevron-right'}
		<polyline points="9 18 15 12 9 6" />
	{:else if name === 'arrow-right'}
		<line x1="5" y1="12" x2="19" y2="12" />
		<polyline points="12 5 19 12 12 19" />
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
	{:else if name === 'ink'}
		<path d="M12 19l7-7 3 3-7 7-3-3z" />
		<path d="M18 13l-1.5-7.5L2 2l3.5 14.5L13 18l5-5z" />
		<path d="M2 2l7.586 7.586" />
		<circle cx="11" cy="11" r="2" />
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
	{/if}
</svg>
