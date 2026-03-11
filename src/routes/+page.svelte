<script lang="ts">
	import { onMount, tick } from "svelte";
	import VirtuaList from "$lib/components/VirtuaList.svelte";
	import VirtuaInfiniteList from "$lib/components/VirtuaInfiniteList.svelte";
	import VirtuaRestorableList from "$lib/components/VirtuaRestorableList.svelte";
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
	const INFINITE_BATCH_SIZE = 200;
	const INFINITE_MAX_NEWER_ITEMS = 200000;
	const INFINITE_MAX_OLDER_ITEMS = 100000;
	const INFINITE_INITIAL_ID_BASE = 1_000_000;

	type DemoMode = "grouped" | "infinite" | "restorable";
	const DEMO_MODES: DemoMode[] = ["grouped", "infinite", "restorable"];
	const RESTORABLE_IDS = ["1", "2", "3"] as const;

	let selectedScenario = $state<number>(INITIAL_SCENARIO);
	let items = $state(generateMessages(INITIAL_SCENARIO, INITIAL_SCENARIO));
	let olderMessageId = $state(0);
	let isLoadingOlder = $state(false);
	let isLoadingInfiniteTop = $state(false);
	let isLoadingInfiniteBottom = $state(false);
	let hasMoreInfiniteTop = $state(true);
	let hasMoreInfiniteBottom = $state(true);
	let nextInfiniteMessageId = $state<number>(INFINITE_INITIAL_ID_BASE + INITIAL_SCENARIO);
	let nextInfiniteOlderMessageId = $state<number>(INFINITE_INITIAL_ID_BASE - 1);
	let loadedInfiniteBottomCount = $state<number>(INITIAL_SCENARIO);
	let loadedInfiniteTopCount = $state<number>(0);
	let infiniteUseShift = $state(false);
	let demoMode = $state<DemoMode>("grouped");
	let showRestorableList = $state(true);
	let selectedRestorableId = $state<(typeof RESTORABLE_IDS)[number]>("1");
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
		getScrollOffset(): number;
	};
	let listRef: VirtuaListApi | undefined = $state();
	let scrollMode = $state<ScrollMode>("instant");
	let goToIndexInput = $state("");
	let listHeightPx = $state(600);
	let isResizingList = $state(false);
	let resizeStartY = 0;
	let resizeStartHeight = 0;
	let resizePointerId: number | null = null;
	let resizeHandleEl: HTMLButtonElement | null = $state(null);
	const MIN_LIST_HEIGHT_PX = 280;
	const MAX_LIST_HEIGHT_PX = 1100;

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

	function applyListHeight(nextHeight: number): void {
		const clampedHeight = Math.max(
			MIN_LIST_HEIGHT_PX,
			Math.min(MAX_LIST_HEIGHT_PX, Math.round(nextHeight))
		);
		if (clampedHeight === listHeightPx) return;
		const currentOffset = listRef?.getScrollOffset() ?? 0;
		listHeightPx = clampedHeight;
		requestAnimationFrame(() => {
			listRef?.scrollToOffset(currentOffset);
		});
	}

	function startListResize(event: PointerEvent): void {
		if (event.button !== 0) return;
		isResizingList = true;
		resizeStartY = event.clientY;
		resizeStartHeight = listHeightPx;
		resizePointerId = event.pointerId;
		resizeHandleEl?.setPointerCapture(event.pointerId);
		event.preventDefault();
	}

	function continueListResize(event: PointerEvent): void {
		if (!isResizingList || resizePointerId !== event.pointerId) return;
		applyListHeight(resizeStartHeight + (event.clientY - resizeStartY));
	}

	function finishListResize(event: PointerEvent): void {
		if (!isResizingList || resizePointerId !== event.pointerId) return;
		isResizingList = false;
		resizePointerId = null;
		resizeHandleEl?.releasePointerCapture(event.pointerId);
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
		if (demoMode === "grouped") {
			items = generateMessages(size, size);
			olderMessageId = 0;
		} else if (demoMode === "infinite") {
			items = generateMessages(size, size).map((message, index) => ({
				id: INFINITE_INITIAL_ID_BASE + index,
				text: message.text
			}));
			hasMoreInfiniteBottom = size < INFINITE_MAX_NEWER_ITEMS;
			hasMoreInfiniteTop = true;
			nextInfiniteMessageId = INFINITE_INITIAL_ID_BASE + size;
			nextInfiniteOlderMessageId = INFINITE_INITIAL_ID_BASE - 1;
			loadedInfiniteBottomCount = size;
			loadedInfiniteTopCount = 0;
			infiniteUseShift = false;
			isLoadingInfiniteTop = false;
			isLoadingInfiniteBottom = false;
		} else {
			items = generateMessages(size, size).map((message, index) => ({
				id: index + 1,
				text: message.text
			}));
		}
		expandedMessageIds = new Set();
		scrollTop();
	}

	function switchDemoMode(nextMode: DemoMode) {
		if (demoMode === nextMode) return;
		demoMode = nextMode;
		loadScenario(selectedScenario);
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
		if (demoMode !== "grouped") {
			return;
		}
		if (isLoadingOlder) {
			return;
		}

		isLoadingOlder = true;
		const olderMessages = buildOlderMessages(100);

		items = [...olderMessages, ...items];
		isLoadingOlder = false;
	}

	async function loadMoreInfiniteBottom() {
		if (demoMode !== "infinite" || isLoadingInfiniteBottom || !hasMoreInfiniteBottom) return;

		isLoadingInfiniteBottom = true;
		await new Promise((resolve) => setTimeout(resolve, 500));

		const remaining = Math.max(0, INFINITE_MAX_NEWER_ITEMS - loadedInfiniteBottomCount);
		const batchSize = Math.min(INFINITE_BATCH_SIZE, remaining);
		if (batchSize === 0) {
			hasMoreInfiniteBottom = false;
			isLoadingInfiniteBottom = false;
			return;
		}

		const newItems = generateMessages(batchSize, nextInfiniteMessageId).map((message, index) => ({
			id: nextInfiniteMessageId + index,
			text: message.text
		}));
		nextInfiniteMessageId += batchSize;
		loadedInfiniteBottomCount += batchSize;
		items = [...items, ...newItems];
		hasMoreInfiniteBottom = loadedInfiniteBottomCount < INFINITE_MAX_NEWER_ITEMS;
		isLoadingInfiniteBottom = false;
	}

	async function loadMoreInfiniteTop() {
		if (demoMode !== "infinite" || isLoadingInfiniteTop || !hasMoreInfiniteTop) return;

		isLoadingInfiniteTop = true;
		infiniteUseShift = true;
		await new Promise((resolve) => setTimeout(resolve, 350));

		const remaining = Math.max(0, INFINITE_MAX_OLDER_ITEMS - loadedInfiniteTopCount);
		const batchSize = Math.min(INFINITE_BATCH_SIZE, remaining);
		if (batchSize === 0) {
			hasMoreInfiniteTop = false;
			isLoadingInfiniteTop = false;
			return;
		}

		const olderItemsStartId = nextInfiniteOlderMessageId - batchSize + 1;
		const olderItems = generateMessages(batchSize, nextInfiniteOlderMessageId).map(
			(message, index) => ({
				id: olderItemsStartId + index,
				text: `Older: ${message.text}`
			})
		);
		nextInfiniteOlderMessageId = olderItemsStartId - 1;
		loadedInfiniteTopCount += batchSize;
		items = [...olderItems, ...items];
		hasMoreInfiniteTop = loadedInfiniteTopCount < INFINITE_MAX_OLDER_ITEMS;
		await tick();
		infiniteUseShift = false;
		isLoadingInfiniteTop = false;
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
		<span class="mode-group" aria-label="Demo mode">
			{#each DEMO_MODES as mode}
				<button
					type="button"
					class="mode-btn"
					class:active={demoMode === mode}
					onclick={() => switchDemoMode(mode)}
				>
					{mode}
				</button>
			{/each}
		</span>
		{#each STRESS_SCENARIOS as scenario}
			<button
				type="button"
				class:active={selectedScenario === scenario}
				onclick={() => loadScenario(scenario)}
			>
				Load {scenario / 1000}k
			</button>
		{/each}
		{#if demoMode === "grouped"}
			<button type="button" onclick={loadOlder} disabled={isLoadingOlder}>
				{isLoadingOlder ? "Loading..." : "Load older (prepend 100)"}
			</button>
		{/if}
		{#if demoMode === "restorable"}
			<button type="button" onclick={() => (showRestorableList = !showRestorableList)}>
				{showRestorableList ? "Hide list" : "Show list"}
			</button>
			<span class="restorable-id-group">
				{#each RESTORABLE_IDS as id}
					<label class="restorable-id-option">
						<input
							type="radio"
							name="restorable-list-id"
							checked={selectedRestorableId === id}
							onchange={() => (selectedRestorableId = id)}
						/>
						{id}
					</label>
				{/each}
			</span>
		{/if}
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

	<div class="list-resize-shell" bind:this={scrollMetricsRoot}>
		{#if demoMode === "grouped"}
			<VirtuaList
				bind:this={listRef}
				{items}
				heightPx={listHeightPx}
				{expandedMessageIds}
				onToggleMessageExpand={toggleMessageExpanded}
				onDateHeaderClick={openDatePicker}
			/>
		{:else if demoMode === "infinite"}
			<VirtuaInfiniteList
				bind:this={listRef}
				{items}
				heightPx={listHeightPx}
				shift={infiniteUseShift}
				isLoadingTop={isLoadingInfiniteTop}
				isLoadingBottom={isLoadingInfiniteBottom}
				hasMoreTop={hasMoreInfiniteTop}
				hasMoreBottom={hasMoreInfiniteBottom}
				onLoadTop={loadMoreInfiniteTop}
				onLoadBottom={loadMoreInfiniteBottom}
			/>
		{:else}
			{#if showRestorableList}
				{#key `${selectedRestorableId}:${items.length}`}
					<VirtuaRestorableList
						bind:this={listRef}
						{items}
						heightPx={listHeightPx}
						listId={selectedRestorableId}
					/>
				{/key}
			{:else}
				<div class="restorable-placeholder">List hidden. Click "Show list" to restore.</div>
			{/if}
		{/if}
		<button
			bind:this={resizeHandleEl}
			type="button"
			class="resize-handle"
			class:is-resizing={isResizingList}
			aria-label="Resize list height"
			onpointerdown={startListResize}
			onpointermove={continueListResize}
			onpointerup={finishListResize}
			onpointercancel={finishListResize}
		></button>
	</div>

	{#if demoMode === "grouped" && datePickerOpen}
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

	.restorable-id-group {
		display: inline-flex;
		align-items: center;
		gap: 10px;
		padding: 0 2px;
	}

	.restorable-id-option {
		display: inline-flex;
		align-items: center;
		gap: 4px;
		font-size: 0.85rem;
		color: #374151;
	}

	.restorable-placeholder {
		height: 120px;
		display: grid;
		place-items: center;
		border: 1px dashed #d1d5db;
		border-radius: 10px;
		color: #6b7280;
		background: #f9fafb;
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

	.list-resize-shell {
		position: relative;
	}

	.resize-handle {
		display: block;
		width: 100%;
		height: 12px;
		margin-top: 4px;
		padding: 0;
		border: none;
		border-radius: 8px;
		background:
			repeating-linear-gradient(
				90deg,
				#cbd5e1 0,
				#cbd5e1 8px,
				transparent 8px,
				transparent 14px
			)
			center / 120px 2px no-repeat;
		cursor: ns-resize;
		touch-action: none;
		opacity: 0.8;
	}

	.resize-handle:hover,
	.resize-handle.is-resizing {
		opacity: 1;
		background-color: #f3f4f6;
	}
</style>
