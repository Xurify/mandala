import { ICON_MAX } from './model.ts';

/** Longest side of an icon drawn down: twice the largest face, so it stays sharp on a dense screen. */
const SIDE = 128;

/**
 * Any picture the browser can draw, as a data URL small enough to keep: an SVG as written when it is small,
 * anything else (or a heavy SVG) drawn at 128px. Null when the browser cannot read it.
 */
export async function readIcon(file: File): Promise<string | null> {
	const svg = file.type === 'image/svg+xml' || /\.svg$/i.test(file.name);
	if (svg) {
		const text = (await file.text()).trim();
		if (!/<svg[\s>]/i.test(text)) return null;
		const url = `data:image/svg+xml,${encodeURIComponent(text)}`;
		if (url.length <= ICON_MAX) return url;
	}
	// An SVG picked from a folder can arrive without a type, and an image only decodes one that has it.
	const source = URL.createObjectURL(svg ? new Blob([await file.arrayBuffer()], { type: 'image/svg+xml' }) : file);
	try {
		const image = new Image();
		image.src = source;
		await image.decode();
		const width = image.naturalWidth || SIDE;
		const height = image.naturalHeight || SIDE;
		// A vector grows to the full size; a small bitmap is not blown up.
		const scale = svg ? SIDE / Math.max(width, height) : Math.min(1, SIDE / Math.max(width, height));
		const canvas = document.createElement('canvas');
		canvas.width = Math.max(1, Math.round(width * scale));
		canvas.height = Math.max(1, Math.round(height * scale));
		const context = canvas.getContext('2d');
		if (!context) return null;
		context.drawImage(image, 0, 0, canvas.width, canvas.height);
		const png = canvas.toDataURL('image/png');
		if (png.length <= ICON_MAX) return png;
		// A photo is heavy as PNG. Safari cannot write WebP and hands back PNG, so JPEG is the last try.
		const webp = canvas.toDataURL('image/webp', 0.86);
		if (webp.startsWith('data:image/webp') && webp.length <= ICON_MAX) return webp;
		const jpeg = canvas.toDataURL('image/jpeg', 0.86);
		return jpeg.length <= ICON_MAX ? jpeg : null;
	} catch {
		return null;
	} finally {
		URL.revokeObjectURL(source);
	}
}
