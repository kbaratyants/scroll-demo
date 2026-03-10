<script lang="ts">
	import { onMount } from "svelte";
	import VirtuaList from "$lib/components/VirtuaList.svelte";
	import DatePicker from "$lib/components/DatePicker.svelte";
	import { generateMessages, type Message } from "$lib/data/messages";
	import { createFpsMonitor } from "$lib/metrics/fps";
	import { countNodesInScrollContainer } from "$lib/metrics/dom";
	import {
		getDateLabel,
		findFirstMessageIndexByDate,
		getDateRange,
		getDateFromMessageId
	} from "$lib/utils/dates";

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

	type ScrollMode = "instant" | "smooth" | "optimized";
	const SCROLL_MODES: ScrollMode[] = ["instant", "smooth", "optimized"];

	type VirtuaListApi = {
		scrollToIndex(index: number, opts?: { smooth?: boolean }): void;
		scrollToIndexOptimized(index: number): Promise<void>;
		scrollToOffset(offset: number): void;
	};
	let listRef: VirtuaListApi | undefined = $state();
	let scrollMode = $state<ScrollMode>("instant");
	let goToIndexInput = $state("");

	function scrollByMode(index: number) {
		if (!listRef) return;
		switch (scrollMode) {
			case "smooth":
				listRef.scrollToIndex(index, { smooth: true });
				break;
			case "optimized":
				listRef.scrollToIndexOptimized(index);
				break;
			default:
				listRef.scrollToIndex(index);
		}
	}

	function scrollTop() {
		scrollByMode(0);
	}

	function scrollMiddle() {
		scrollByMode(Math.floor(items.length / 2));
	}

	function scrollBottom() {
		scrollByMode(items.length - 1);
	}

	function randomScroll() {
		scrollByMode(Math.floor(Math.random() * items.length));
	}

	function scrollToSpecificIndex() {
		const parsed = parseInt(goToIndexInput, 10);
		if (Number.isNaN(parsed)) return;
		const clamped = Math.max(0, Math.min(parsed, items.length - 1));
		scrollByMode(clamped);
	}

	let datePickerOpen = $state(false);
	let datePickerAnchor = $state({ year: 2024, month: 0, day: 1 });

	function openDatePicker(dateLabel: string) {
		if (!items.length) return;
		const firstMsg = items.find((m) => getDateLabel(m.id) === dateLabel);
		if (firstMsg) {
			const d = getDateFromMessageId(firstMsg.id);
			datePickerAnchor = { year: d.getFullYear(), month: d.getMonth(), day: d.getDate() };
		}
		datePickerOpen = true;
	}

	function handleDateSelect(date: Date) {
		datePickerOpen = false;
		const index = findFirstMessageIndexByDate(items, date);
		if (index !== -1) {
			listRef?.scrollToIndexOptimized(index);
		}
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
		<button type="button" onclick={scrollTop}>Top</button>
		<button type="button" onclick={scrollMiddle}>Middle</button>
		<button type="button" onclick={scrollBottom}>Bottom</button>
		<button type="button" onclick={randomScroll}>Random</button>
		<span class="mode-group">
			{#each SCROLL_MODES as mode}
				<button
					type="button"
					class="mode-btn"
					class:active={scrollMode === mode}
					onclick={() => (scrollMode = mode)}
				>
					{mode}
				</button>
			{/each}
		</span>
		<span class="goto-group">
			<input
				type="number"
				class="goto-input"
				bind:value={goToIndexInput}
				placeholder="index"
				min="0"
				max={items.length - 1}
				onkeydown={(e) => e.key === "Enter" && scrollToSpecificIndex()}
			/>
			<button type="button" onclick={scrollToSpecificIndex}>Go to</button>
		</span>
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
			onDateHeaderClick={openDatePicker}
		/>
	</div>

	{#if datePickerOpen}
		{@const range = getDateRange(items)}
		<DatePicker
			initialYear={datePickerAnchor.year}
			initialMonth={datePickerAnchor.month}
			initialDay={datePickerAnchor.day}
			minDate={range?.min}
			maxDate={range?.max}
			onselect={handleDateSelect}
			onclose={() => (datePickerOpen = false)}
		/>
	{/if}
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

	.mode-group {
		display: flex;
		border: 1px solid #d1d5db;
		border-radius: 8px;
		overflow: hidden;
	}

	.mode-btn {
		border: none;
		border-radius: 0;
		border-right: 1px solid #d1d5db;
		padding: 8px 10px;
		font-size: 0.8rem;
		text-transform: capitalize;
	}

	.mode-btn:last-child {
		border-right: none;
	}

	.goto-group {
		display: flex;
		align-items: center;
		gap: 4px;
	}

	.goto-input {
		width: 80px;
		padding: 7px 8px;
		border: 1px solid #d1d5db;
		border-radius: 8px;
		font-size: 0.85rem;
	}

	.goto-input::-webkit-inner-spin-button,
	.goto-input::-webkit-outer-spin-button {
		-webkit-appearance: none;
		margin: 0;
	}

	.goto-input {
		-moz-appearance: textfield;
		appearance: textfield;
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
