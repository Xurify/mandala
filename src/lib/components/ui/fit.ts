import type { Attachment } from 'svelte/attachments';

/**
 * Shrinks the text until its longest word fits across, down to `floor` of the size its classes give it, so a
 * name never breaks inside a word where the browser has no hyphenation to do it well. Lines past the box are
 * the line clamp's to cut. Pass the text, so new words fit again.
 */
export function fitWords(text: string, floor = 0.7): Attachment<HTMLElement> {
	return (node) => {
		void text;
		const fit = (): void => {
			node.style.fontSize = '';
			const max = parseFloat(getComputedStyle(node).fontSize);
			let size = max;
			while (node.scrollWidth > node.clientWidth + 1 && size - 0.5 >= max * floor) {
				size -= 0.5;
				node.style.fontSize = `${size}px`;
			}
		};
		fit();
		const observer = new ResizeObserver(fit);
		observer.observe(node);
		void document.fonts?.ready.then(fit);
		return () => observer.disconnect();
	};
}
