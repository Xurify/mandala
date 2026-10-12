let context: AudioContext | null = null;

/** Browsers hold sound until a tap, so the tap that starts a timer readies it for the end. */
export function readyChime(): void {
	if (typeof window === 'undefined' || typeof AudioContext === 'undefined') return;
	try {
		context ??= new AudioContext();
		if (context.state === 'suspended') void context.resume();
	} catch {
		context = null;
	}
}

export function chime(): void {
	readyChime();
	if (!context) return;
	const start = context.currentTime + 0.02;
	[659.25, 987.77].forEach((frequency, index) => {
		const at = start + index * 0.24;
		const tone = context!.createOscillator();
		const gain = context!.createGain();
		tone.type = 'sine';
		tone.frequency.value = frequency;
		gain.gain.setValueAtTime(0, at);
		gain.gain.linearRampToValueAtTime(0.16, at + 0.02);
		gain.gain.exponentialRampToValueAtTime(0.0001, at + 1.4);
		tone.connect(gain).connect(context!.destination);
		tone.start(at);
		tone.stop(at + 1.45);
	});
	try {
		navigator.vibrate?.([70, 60, 70]);
	} catch {}
}
