import { ICON_MAX } from './model.ts';
import { svgIn } from './tools.ts';

const SIDE = 128;

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

function svgFile(svg: string): File {
	return new File([svg], 'pasted.svg', { type: 'image/svg+xml' });
}

export function pastedPicture(data: DataTransfer | null): File | null {
	if (!data) return null;
	const file = [...data.files].find((item) => item.type.startsWith('image/') || /\.svg$/i.test(item.name));
	if (file) return file;
	const svg = svgIn(data.getData('text/plain')) ?? svgIn(data.getData('text/html'));
	return svg ? svgFile(svg) : null;
}

export async function clipboardPicture(): Promise<File | null> {
	try {
		if (navigator.clipboard?.read) {
			for (const item of await navigator.clipboard.read()) {
				const type = item.types.find((kind) => kind.startsWith('image/'));
				if (type) return new File([await item.getType(type)], type === 'image/svg+xml' ? 'pasted.svg' : 'pasted', { type });
				if (item.types.includes('text/plain')) {
					const svg = svgIn(await (await item.getType('text/plain')).text());
					if (svg) return svgFile(svg);
				}
			}
			return null;
		}
		const svg = svgIn(await navigator.clipboard.readText());
		return svg ? svgFile(svg) : null;
	} catch {
		return null;
	}
}
