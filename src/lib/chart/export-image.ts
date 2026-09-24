import { drawStrokes } from './ink.ts';
import {
	cellKey,
	exportFilename,
	getByKey,
	HUES,
	info,
	inkOf,
	type ChartData
} from './model.ts';

function wrapText(
	context: CanvasRenderingContext2D,
	text: string,
	maxWidth: number,
	maxLines = 4
): string[] {
	const words = text.split(/\s+/);
	const lines: string[] = [];
	let currentLine = '';

	for (const word of words) {
		const testLine = currentLine ? `${currentLine} ${word}` : word;
		const metrics = context.measureText(testLine);
		if (metrics.width > maxWidth && currentLine) {
			lines.push(currentLine);
			currentLine = word;
			if (lines.length === maxLines - 1) {
				break;
			}
		} else {
			currentLine = testLine;
		}
	}

	if (currentLine && lines.length < maxLines) {
		lines.push(currentLine);
	}

	return lines;
}

function drawRoundedRect(
	context: CanvasRenderingContext2D,
	coordinateX: number,
	coordinateY: number,
	width: number,
	height: number,
	radius: number
): void {
	context.beginPath();
	context.moveTo(coordinateX + radius, coordinateY);
	context.lineTo(coordinateX + width - radius, coordinateY);
	context.quadraticCurveTo(
		coordinateX + width,
		coordinateY,
		coordinateX + width,
		coordinateY + radius
	);
	context.lineTo(coordinateX + width, coordinateY + height - radius);
	context.quadraticCurveTo(
		coordinateX + width,
		coordinateY + height,
		coordinateX + width - radius,
		coordinateY + height
	);
	context.lineTo(coordinateX + radius, coordinateY + height);
	context.quadraticCurveTo(
		coordinateX,
		coordinateY + height,
		coordinateX,
		coordinateY + height - radius
	);
	context.lineTo(coordinateX, coordinateY + radius);
	context.quadraticCurveTo(coordinateX, coordinateY, coordinateX + radius, coordinateY);
	context.closePath();
}

export async function createChartPosterCanvas(data: ChartData): Promise<HTMLCanvasElement> {
	const canvas = document.createElement('canvas');
	const totalSize = 2500;
	canvas.width = totalSize;
	canvas.height = totalSize;

	const context = canvas.getContext('2d');
	if (!context) {
		throw new Error('Canvas 2D context is not available.');
	}

	// Wait for font if available
	if (document.fonts?.ready) {
		try {
			await document.fonts.ready;
		} catch {
			// font fallback
		}
	}

	// Background
	context.fillStyle = '#fafafb';
	context.fillRect(0, 0, totalSize, totalSize);

	// Header
	const margin = 100;
	const headerTop = 90;

	context.textAlign = 'center';
	context.textBaseline = 'top';

	context.font = '600 32px "Bricolage Grotesque Variable", "Segoe UI", system-ui, sans-serif';
	context.fillStyle = '#6b7280';
	context.fillText('MANDALA METHOD', totalSize / 2, headerTop);

	const goalText = data.goal.trim() || 'Central Goal';
	context.font = '700 48px "Bricolage Grotesque Variable", "Segoe UI", system-ui, sans-serif';
	context.fillStyle = '#111827';
	context.fillText(goalText, totalSize / 2, headerTop + 48);

	// Grid placement
	const gridTop = 220;
	const gridSize = totalSize - margin * 2;
	const blockGap = 18;
	const blockSize = (gridSize - blockGap * 2) / 3;
	const cellGap = 8;
	const cellSize = (blockSize - cellGap * 2) / 3;

	for (let blockIndex = 0; blockIndex < 9; blockIndex++) {
		const blockColumn = blockIndex % 3;
		const blockRow = Math.floor(blockIndex / 3);
		const blockX = margin + blockColumn * (blockSize + blockGap);
		const blockY = gridTop + blockRow * (blockSize + blockGap);

		// Subtle block container background
		context.fillStyle = '#f3f4f6';
		drawRoundedRect(context, blockX - 4, blockY - 4, blockSize + 8, blockSize + 8, 16);
		context.fill();

		for (let cellIndex = 0; cellIndex < 9; cellIndex++) {
			const cellColumn = cellIndex % 3;
			const cellRow = Math.floor(cellIndex / 3);
			const cellX = blockX + cellColumn * (cellSize + cellGap);
			const cellY = blockY + cellRow * (cellSize + cellGap);

			const key = cellKey(blockIndex, cellIndex);
			const cellInformation = info(blockIndex, cellIndex);
			const text = getByKey(data, key).trim();
			const strokes = inkOf(data, key);

			let fillColor = '#ffffff';
			let textColor = '#1f2937';
			let borderColor = '#e5e7eb';
			let cornerRadius = 10;

			if (cellInformation.type === 'goal') {
				fillColor = '#1e293b';
				textColor = '#ffffff';
				borderColor = '#0f172a';
				cornerRadius = cellSize / 2;
			} else if (cellInformation.type === 'pillar') {
				const hue = HUES[cellInformation.k];
				fillColor = `hsl(${hue}, 60%, 82%)`;
				textColor = `hsl(${hue}, 80%, 15%)`;
				borderColor = `hsl(${hue}, 50%, 68%)`;
				cornerRadius = 18;
			} else {
				const hue = HUES[cellInformation.k];
				fillColor = `hsl(${hue}, 35%, 95%)`;
				textColor = '#1f2937';
				borderColor = `hsl(${hue}, 30%, 86%)`;
				cornerRadius = 8;
			}

			// Draw cell background
			context.fillStyle = fillColor;
			drawRoundedRect(context, cellX, cellY, cellSize, cellSize, cornerRadius);
			context.fill();

			// Draw cell border
			context.strokeStyle = borderColor;
			context.lineWidth = 1.5;
			context.stroke();

			// Render handwriting or text
			if (strokes.length > 0 && !text) {
				const inkCanvas = document.createElement('canvas');
				inkCanvas.width = cellSize * 2;
				inkCanvas.height = cellSize * 2;
				drawStrokes(inkCanvas, strokes, textColor, 2);
				context.drawImage(inkCanvas, cellX, cellY, cellSize, cellSize);
			} else if (text) {
				context.save();
				context.beginPath();
				drawRoundedRect(context, cellX, cellY, cellSize, cellSize, cornerRadius);
				context.clip();

				const isPrimary = cellInformation.type === 'goal' || cellInformation.type === 'pillar';
				context.fillStyle = textColor;
				context.font = `${isPrimary ? '600' : '500'} ${isPrimary ? '24px' : '20px'} "Bricolage Grotesque Variable", "Segoe UI", system-ui, sans-serif`;
				context.textAlign = 'center';
				context.textBaseline = 'middle';

				const maxContentWidth = cellSize - 18;
				const lines = wrapText(context, text, maxContentWidth, 4);
				const lineHeight = isPrimary ? 28 : 24;
				const totalTextHeight = lines.length * lineHeight;
				const startY = cellY + (cellSize - totalTextHeight) / 2 + lineHeight / 2;

				lines.forEach((line, index) => {
					context.fillText(line, cellX + cellSize / 2, startY + index * lineHeight);
				});

				context.restore();
			}
		}
	}

	// Footer
	context.textAlign = 'center';
	context.textBaseline = 'bottom';
	context.font = '500 22px "Bricolage Grotesque Variable", "Segoe UI", system-ui, sans-serif';
	context.fillStyle = '#9ca3af';
	context.fillText(
		'1 Center Goal • 8 Strategic Pillars • 64 Immediate Actions',
		totalSize / 2,
		totalSize - 36
	);

	return canvas;
}

export async function exportChartPng(data: ChartData): Promise<void> {
	const canvas = await createChartPosterCanvas(data);
	const blob = await new Promise<Blob | null>((resolve) => {
		canvas.toBlob((result) => resolve(result), 'image/png');
	});

	if (!blob) {
		throw new Error('Failed to generate PNG image.');
	}

	const downloadUrl = URL.createObjectURL(blob);
	const downloadLink = document.createElement('a');
	const baseFilename = exportFilename(data).replace(/\.json$/, '');
	downloadLink.href = downloadUrl;
	downloadLink.download = `${baseFilename}-poster.png`;
	downloadLink.click();
	URL.revokeObjectURL(downloadUrl);
}
