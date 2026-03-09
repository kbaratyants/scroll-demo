export interface FpsMonitor {
	start(): void;
	stop(): void;
	getCurrentFps(): number;
}

export function createFpsMonitor(): FpsMonitor {
	let rafId: number | null = null;
	let lastTime = 0;
	let frameCount = 0;
	let currentFps = 0;

	const tick = (time: number) => {
		if (lastTime === 0) {
			lastTime = time;
		}

		frameCount += 1;
		const elapsed = time - lastTime;

		// Update FPS roughly once per second to reduce noise.
		if (elapsed >= 1000) {
			currentFps = Math.round((frameCount * 1000) / elapsed);
			frameCount = 0;
			lastTime = time;
		}

		rafId = requestAnimationFrame(tick);
	};

	const start = () => {
		if (rafId !== null) return;
		lastTime = 0;
		frameCount = 0;
		rafId = requestAnimationFrame(tick);
	};

	const stop = () => {
		if (rafId === null) return;
		cancelAnimationFrame(rafId);
		rafId = null;
	};

	const getCurrentFps = () => currentFps;

	return {
		start,
		stop,
		getCurrentFps
	};
}
