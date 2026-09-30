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
import { oklchToRgb, toHex } from './ring.ts';

const PALETTE = {
	paper: toHex(oklchToRgb(0.972, 0.008, 85)),
	surface: toHex(oklchToRgb(0.994, 0.004, 85)),
	ink: toHex(oklchToRgb(0.24, 0.012, 60)),
	muted: toHex(oklchToRgb(0.51, 0.014, 65)),
	line: toHex(oklchToRgb(0.9, 0.01, 80)),
	onInk: toHex(oklchToRgb(0.985, 0.006, 85))
};

function wrapText(
	context: CanvasRenderingContext2D,
	text: string,
	maxWidth: number,
	maxLines: number,
	allowEllipsis = true
): string[] {
	const words = text.split(/\s+/);
	const lines: string[] = [];
	let currentLine = '';

	for (let wordIndex = 0; wordIndex < words.length; wordIndex++) {
		const word = words[wordIndex];
		const testLine = currentLine ? `${currentLine} ${word}` : word;
		const metrics = context.measureText(testLine);

		if (metrics.width > maxWidth && currentLine) {
			if (lines.length === maxLines - 1) {
				if (allowEllipsis) {
					currentLine = `${currentLine}…`;
				}
				lines.push(currentLine);
				currentLine = '';
				break;
			}
			lines.push(currentLine);
			currentLine = word;
		} else {
			currentLine = testLine;
		}
	}

	if (currentLine && lines.length < maxLines) {
		lines.push(currentLine);
	}

	return lines;
}

function fitCellText(
	context: CanvasRenderingContext2D,
	text: string,
	maxWidth: number,
	maxHeight: number,
	baseFontSize: number,
	minFontSize: number,
	fontWeight: string,
	maxLines: number
): { lines: string[]; fontSize: number; lineHeight: number } {
	for (let currentFontSize = baseFontSize; currentFontSize >= minFontSize; currentFontSize -= 1) {
		const lineHeight = Math.round(currentFontSize * 1.25);
		context.font = `${fontWeight} ${currentFontSize}px "Source Sans 3 Variable", "Segoe UI", system-ui, sans-serif`;
		const lines = wrapText(context, text, maxWidth, maxLines, false);
		const totalHeight = lines.length * lineHeight;

		if (totalHeight <= maxHeight) {
			const joinedWords = lines.join(' ').replace(/\s+/g, ' ').trim();
			const originalWords = text.trim().replace(/\s+/g, ' ');
			if (joinedWords === originalWords) {
				return { lines, fontSize: currentFontSize, lineHeight };
			}
		}
	}

	const fallbackLineHeight = Math.round(minFontSize * 1.25);
	context.font = `${fontWeight} ${minFontSize}px "Source Sans 3 Variable", "Segoe UI", system-ui, sans-serif`;
	const lines = wrapText(context, text, maxWidth, maxLines, true);
	return { lines, fontSize: minFontSize, lineHeight: fallbackLineHeight };
}

function drawRoundedRectangle(
	context: CanvasRenderingContext2D,
	coordinateX: number,
	coordinateY: number,
	width: number,
	height: number,
	radius: number
): void {
	if (typeof context.roundRect === 'function') {
		context.beginPath();
		context.roundRect(coordinateX, coordinateY, width, height, radius);
		return;
	}

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

	if (document.fonts) {
		try {
			await Promise.all([
				document.fonts.load('600 22px "Source Sans 3 Variable"'),
				document.fonts.load('700 48px "Source Sans 3 Variable"'),
				document.fonts.load('500 18px "Source Sans 3 Variable"'),
				document.fonts.ready
			]);
		} catch {
			// font fallback
		}
	}

	// Canvas paper background
	context.fillStyle = PALETTE.paper;
	context.fillRect(0, 0, totalSize, totalSize);

	// Grid geometry: mathematically balanced 2100px square grid
	const gridSize = 2100;
	const sideMargin = Math.round((totalSize - gridSize) / 2); // 200px
	const gridTop = 240;
	const blockGap = 24;
	const blockSize = Math.round((gridSize - blockGap * 2) / 3); // 684px
	const blockPadding = 18;
	const cellGap = 12;
	const cellSize = Math.round((blockSize - blockPadding * 2 - cellGap * 2) / 3); // 208px

	// Header
	context.textAlign = 'center';
	context.textBaseline = 'top';

	const eyebrowTop = 64;
	context.font = '600 22px "Source Sans 3 Variable", "Segoe UI", system-ui, sans-serif';
	context.fillStyle = PALETTE.muted;
	if ('letterSpacing' in context) {
		context.letterSpacing = '0.14em';
	}
	context.fillText('MANDALA METHOD', totalSize / 2, eyebrowTop);

	const goalText = data.goal.trim() || 'Central Goal';
	const titleTop = eyebrowTop + 38;
	context.font = '700 48px "Source Sans 3 Variable", "Segoe UI", system-ui, sans-serif';
	context.fillStyle = PALETTE.ink;
	if ('letterSpacing' in context) {
		context.letterSpacing = '-0.01em';
	}

	const maxTitleWidth = gridSize;
	const titleLines = wrapText(context, goalText, maxTitleWidth, 2, true);
	const titleLineHeight = 56;
	for (let lineIndex = 0; lineIndex < titleLines.length; lineIndex++) {
		context.fillText(
			titleLines[lineIndex],
			totalSize / 2,
			titleTop + lineIndex * titleLineHeight
		);
	}

	// Reset letter spacing for grid text
	if ('letterSpacing' in context) {
		context.letterSpacing = '0px';
	}

	// Render the 9 blocks
	for (let blockIndex = 0; blockIndex < 9; blockIndex++) {
		const blockColumn = blockIndex % 3;
		const blockRow = Math.floor(blockIndex / 3);
		const blockX = sideMargin + blockColumn * (blockSize + blockGap);
		const blockY = gridTop + blockRow * (blockSize + blockGap);

		// Block card container
		const blockRadius = 30;
		drawRoundedRectangle(context, blockX, blockY, blockSize, blockSize, blockRadius);
		context.fillStyle = PALETTE.surface;
		context.fill();
		context.strokeStyle = PALETTE.line;
		context.lineWidth = 1;
		context.stroke();

		// Render the 9 cells inside the block
		for (let cellIndex = 0; cellIndex < 9; cellIndex++) {
			const cellColumn = cellIndex % 3;
			const cellRow = Math.floor(cellIndex / 3);
			const cellX = blockX + blockPadding + cellColumn * (cellSize + cellGap);
			const cellY = blockY + blockPadding + cellRow * (cellSize + cellGap);

			const key = cellKey(blockIndex, cellIndex);
			const cellInformation = info(blockIndex, cellIndex);
			const text = getByKey(data, key).trim();
			const strokes = inkOf(data, key);

			let fillColor = PALETTE.surface;
			let textColor = PALETTE.ink;
			let cornerRadius = Math.round(cellSize * 0.13); // 27px

			if (cellInformation.type === 'goal') {
				fillColor = PALETTE.ink;
				textColor = PALETTE.onInk;
				cornerRadius = Math.round(cellSize * 0.28); // 58px
			} else if (cellInformation.type === 'pillar') {
				const hue = HUES[cellInformation.k];
				fillColor = toHex(oklchToRgb(0.845, 0.082, hue));
				textColor = PALETTE.ink;
				cornerRadius = Math.round(cellSize * 0.28); // 58px
			} else {
				const hue = HUES[cellInformation.k];
				fillColor = toHex(oklchToRgb(0.945, 0.03, hue));
				textColor = PALETTE.ink;
			}

			// Draw cell background
			drawRoundedRectangle(context, cellX, cellY, cellSize, cellSize, cornerRadius);
			context.fillStyle = fillColor;
			context.fill();

			// Render handwriting or text
			if (strokes.length > 0 && !text) {
				const inkCanvas = document.createElement('canvas');
				inkCanvas.width = cellSize * 2;
				inkCanvas.height = cellSize * 2;
				drawStrokes(inkCanvas, strokes, textColor, 2);
				context.drawImage(inkCanvas, cellX, cellY, cellSize, cellSize);
			} else if (text) {
				context.save();
				drawRoundedRectangle(context, cellX, cellY, cellSize, cellSize, cornerRadius);
				context.clip();

				const isGoal = cellInformation.type === 'goal';
				const isPillar = cellInformation.type === 'pillar';

				const maxContentWidth = cellSize - 32;
				const maxContentHeight = cellSize - 24;

				let baseFontSize = 18;
				let minFontSize = 14;
				let fontWeight = '500';
				let maxLines = 5;

				if (isGoal) {
					baseFontSize = 23;
					minFontSize = 16;
					fontWeight = '600';
					maxLines = 5;
				} else if (isPillar) {
					baseFontSize = 21;
					minFontSize = 16;
					fontWeight = '600';
					maxLines = 4;
				}

				const { lines, fontSize, lineHeight } = fitCellText(
					context,
					text,
					maxContentWidth,
					maxContentHeight,
					baseFontSize,
					minFontSize,
					fontWeight,
					maxLines
				);

				context.fillStyle = textColor;
				context.font = `${fontWeight} ${fontSize}px "Source Sans 3 Variable", "Segoe UI", system-ui, sans-serif`;
				context.textAlign = 'center';
				context.textBaseline = 'middle';

				const totalTextHeight = lines.length * lineHeight;
				const startY = cellY + (cellSize - totalTextHeight) / 2 + lineHeight / 2;

				for (let lineIndex = 0; lineIndex < lines.length; lineIndex++) {
					context.fillText(
						lines[lineIndex],
						cellX + cellSize / 2,
						startY + lineIndex * lineHeight
					);
				}

				context.restore();
			}
		}
	}

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
