export function widthFor(w: number, pr: number, boost = 1): number {
	return w * (0.008 + 0.014 * (pr / 100)) * boost;
}

export function drawStrokes(
	canvas: HTMLCanvasElement,
	strokes: number[][],
	color: string,
	boost = 1,
	bg?: string
): void {
	const ctx = canvas.getContext('2d');
	if (!ctx) return;
	const w = canvas.width;
	const h = canvas.height;
	if (bg) {
		ctx.fillStyle = bg;
		ctx.fillRect(0, 0, w, h);
	} else {
		ctx.clearRect(0, 0, w, h);
	}
	ctx.strokeStyle = color;
	ctx.fillStyle = color;
	ctx.lineCap = 'round';
	ctx.lineJoin = 'round';
	for (const s of strokes) {
		const n = s.length / 3;
		if (n === 1) {
			ctx.beginPath();
			ctx.arc((s[0]! * w) / 1000, (s[1]! * h) / 1000, widthFor(w, s[2]!, boost) / 2, 0, Math.PI * 2);
			ctx.fill();
			continue;
		}
		for (let i = 1; i < n; i++) {
			ctx.lineWidth = widthFor(w, (s[i * 3 + 2]! + s[i * 3 - 1]!) / 2, boost);
			ctx.beginPath();
			ctx.moveTo((s[i * 3 - 3]! * w) / 1000, (s[i * 3 - 2]! * h) / 1000);
			ctx.lineTo((s[i * 3]! * w) / 1000, (s[i * 3 + 1]! * h) / 1000);
			ctx.stroke();
		}
	}
}

export function renderInkBlob(strokes: number[][], type: string): Promise<Blob> {
	return new Promise((resolve, reject) => {
		const canvas = document.createElement('canvas');
		canvas.width = 384;
		canvas.height = 384;
		drawStrokes(canvas, strokes, '#000', 1, '#fff');
		canvas.toBlob((blob) => {
			if (!blob) reject(new Error('Failed to render handwriting'));
			else resolve(blob);
		}, type, 0.92);
	});
}
