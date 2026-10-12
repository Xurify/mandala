import type { Attachment } from 'svelte/attachments';

/**
 * Moves a floating layer to the end of the page, so a stacking context in the view it opened from cannot sink it
 * under the dock. Svelte only clears the nodes left between its own markers, so the layer removes itself, after
 * its outro.
 */
export const toBody: Attachment<HTMLElement> = (node) => {
	document.body.append(node);
	return () => node.remove();
};
