<script lang="ts">
	import { onMount } from "svelte";
	import VirtuaList from "$lib/components/VirtuaList.svelte";
	import { generateMessages, type Message } from "$lib/data/messages";
	import { createFpsMonitor } from "$lib/metrics/fps";
	import { countNodesInScrollContainer } from "$lib/metrics/dom";

	const STRESS_SCENARIOS = [10000, 50000, 100000] as const;
	const METRIC_POLL_INTERVAL_MS = 250;
	const INITIAL_SCENARIO = STRESS_SCENARIOS[0];

	let selectedScenario = $state<number>(INITIAL_SCENARIO);
	let items = $state(generateMessages(INITIAL_SCENARIO, INITIAL_SCENARIO));
	let olderMessageId = $state(0);
	let isLoadingOlder = $state(false);
	let expandedMessageIds = $state<Set<number>>(new Set());
	let fps = $state(0);
	let domNodes = $state(0);
	let scrollLatencyMs = $state(0);
	let scrollMetricsRoot: HTMLDivElement | null = $state(null);

	function buildOlderMessages(count: number): Message[] {
		const batch = generateMessages(count, Date.now());
		return batch.map((message) => ({
			id: olderMessageId--,
			text: `Older: ${message.text}`
		}));
	}

	type VirtuaListApi = {
		scrollToIndex(index: number, smooth: boolean): void;
		scrollToOffset(offset: number): void;
	};
	let listRef: VirtuaListApi | undefined = $state();

	function scrollTop() {
		listRef?.scrollToOffset(0);
	}

	function scrollMiddle() {
		listRef?.scrollToIndex(Math.floor(items.length / 2), true);
	}

	function scrollBottom() {
		listRef?.scrollToIndex(items.length - 1, true);
	}

	function randomScroll() {
		const randomIndex = Math.floor(Math.random() * items.length);
		listRef?.scrollToIndex(randomIndex, true);
	}

	function formatMetric(value: number): string {
		return Number.isFinite(value) ? value.toFixed(1) : "0.0";
	}

	function loadScenario(size: number) {
		selectedScenario = size;
		items = generateMessages(size, size);
		olderMessageId = 0;
		expandedMessageIds = new Set();
		scrollTop();
	}

	function toggleMessageExpanded(messageId: number) {
		const next = new Set(expandedMessageIds);
		if (next.has(messageId)) {
			next.delete(messageId);
		} else {
			next.add(messageId);
		}
		expandedMessageIds = next;
	}

	function loadOlder() {
		if (isLoadingOlder) {
			return;
		}

		isLoadingOlder = true;
		const olderMessages = buildOlderMessages(100);

		items = [...olderMessages, ...items];
		isLoadingOlder = false;
	}

	onMount(() => {
		const fpsMonitor = createFpsMonitor();
		fpsMonitor.start();

		let rafId = 0;
		let pendingScrollEventTs = 0;
		const onScroll = (event: Event) => {
			pendingScrollEventTs = event.timeStamp;
			if (rafId) {
				return;
			}

			rafId = requestAnimationFrame((now) => {
				scrollLatencyMs = Math.max(0, now - pendingScrollEventTs);
				rafId = 0;
			});
		};

		scrollMetricsRoot?.addEventListener("scroll", onScroll, { capture: true, passive: true });
		const interval = window.setInterval(() => {
			fps = fpsMonitor.getCurrentFps();
			domNodes = countNodesInScrollContainer(scrollMetricsRoot);
		}, METRIC_POLL_INTERVAL_MS);

		return () => {
			fpsMonitor.stop();
			if (rafId) {
				cancelAnimationFrame(rafId);
			}
			scrollMetricsRoot?.removeEventListener("scroll", onScroll, true);
			window.clearInterval(interval);
		};
	});
</script>

<main class="page">
	<h1>Virtual List Benchmark</h1>

	<div class="controls">
		{#each STRESS_SCENARIOS as scenario}
			<button
				type="button"
				class:active={selectedScenario === scenario}
				onclick={() => loadScenario(scenario)}
			>
				Load {scenario / 1000}k
			</button>
		{/each}
		<button type="button" onclick={loadOlder} disabled={isLoadingOlder}>
			{isLoadingOlder ? "Loading..." : "Load older (prepend 100)"}
		</button>
		<button type="button" onclick={scrollTop}>Scroll top</button>
		<button type="button" onclick={scrollMiddle}>Scroll middle</button>
		<button type="button" onclick={scrollBottom}>Scroll bottom</button>
		<button type="button" onclick={randomScroll}>Random scroll</button>
	</div>

	<section class="metrics">
		<div class="metric">
			<span class="metric-label">FPS</span>
			<strong>{fps}</strong>
		</div>
		<div class="metric">
			<span class="metric-label">DOM nodes</span>
			<strong>{domNodes}</strong>
		</div>
		<div class="metric">
			<span class="metric-label">Scroll latency</span>
			<strong>{formatMetric(scrollLatencyMs)} ms</strong>
		</div>
	</section>

	<div bind:this={scrollMetricsRoot}>
		<VirtuaList
			bind:this={listRef}
			{items}
			{expandedMessageIds}
			onToggleMessageExpand={toggleMessageExpanded}
		/>
	</div>
</main>

<style>
	.page {
		max-width: 900px;
		margin: 24px auto;
		padding: 0 16px;
	}

	h1 {
		margin: 0 0 16px;
		font-size: 1.5rem;
	}

	.controls {
		display: flex;
		flex-wrap: wrap;
		gap: 8px;
		margin-bottom: 12px;
	}

	button {
		padding: 8px 12px;
		border: 1px solid #d1d5db;
		border-radius: 8px;
		background: #fff;
		cursor: pointer;
	}

	button:hover {
		background: #f9fafb;
	}

	button.active {
		background: #111827;
		color: #fff;
		border-color: #111827;
	}

	.metrics {
		display: grid;
		grid-template-columns: repeat(3, minmax(0, 1fr));
		gap: 10px;
		margin-bottom: 12px;
	}

	.metric {
		border: 1px solid #e5e7eb;
		border-radius: 10px;
		padding: 10px 12px;
		background: #f9fafb;
	}

	.metric-label {
		display: block;
		font-size: 0.8rem;
		color: #6b7280;
		margin-bottom: 2px;
	}
</style>
