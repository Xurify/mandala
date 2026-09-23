import { renderInkBlob } from './ink.ts';

const MODEL_ID = 'Xenova/trocr-small-handwritten';

export type ReadResult = {
	texts: Map<string, string>;
	failed: 'cancelled' | 'offline' | 'error' | null;
};

type ImageToText = (input: string) => Promise<Array<{ generated_text?: string }>>;

let pipelinePromise: Promise<ImageToText> | null = null;

async function loadPipeline(): Promise<ImageToText> {
	if (!pipelinePromise) {
		pipelinePromise = (async () => {
			const { pipeline, env } = await import('@xenova/transformers');
			env.allowLocalModels = false;
			return (await pipeline('image-to-text', MODEL_ID)) as unknown as ImageToText;
		})();
	}
	try {
		return await pipelinePromise;
	} catch (err) {
		pipelinePromise = null;
		throw err;
	}
}

export async function readUnreadInk(
	items: Array<{ key: string; strokes: number[][] }>,
	signal: AbortSignal
): Promise<ReadResult> {
	const texts = new Map<string, string>();
	if (signal.aborted) return { texts, failed: 'cancelled' };

	let captioner: ImageToText;
	try {
		captioner = await loadPipeline();
	} catch {
		return { texts, failed: navigator.onLine ? 'error' : 'offline' };
	}

	if (signal.aborted) return { texts, failed: 'cancelled' };

	try {
		for (const item of items) {
			if (signal.aborted) return { texts, failed: 'cancelled' };
			if (!item.strokes.length) {
				texts.set(item.key, '');
				continue;
			}
			const blob = await renderInkBlob(item.strokes, 'image/png');
			const url = URL.createObjectURL(blob);
			try {
				const out = await captioner(url);
				const raw = out?.[0]?.generated_text ?? '';
				texts.set(item.key, String(raw).replace(/\s+/g, ' ').trim().slice(0, 120));
			} finally {
				URL.revokeObjectURL(url);
			}
		}
		return { texts, failed: null };
	} catch {
		if (signal.aborted) return { texts, failed: 'cancelled' };
		return { texts, failed: navigator.onLine ? 'error' : 'offline' };
	}
}
