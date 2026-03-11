<script lang="ts">
	import { tick } from "svelte";
	import type { ScrollToIndexOpts } from "virtua";
	import type { Message } from "$lib/data/messages";
	import VirtuaList from "$lib/components/VirtuaList.svelte";

	const LOAD_MORE_THRESHOLD_PX = 500;
	const REARM_FACTOR = 2;

	type VirtuaListApi = {
		scrollToIndex(index: number, opts?: ScrollToIndexOpts): void;
		scrollToIndexOptimized(index: number): Promise<void>;
		scrollToOffset(offset: number): void;
		getScrollOffset(): number;
		getScrollSize(): number;
		getViewportSize(): number;
	};

	let {
		items,
		heightPx = 600,
		shift = false,
		isLoadingTop = false,
		isLoadingBottom = false,
		hasMoreTop = true,
		hasMoreBottom = true,
		onLoadTop,
		onLoadBottom
	}: {
		items: Message[];
		heightPx?: number;
		shift?: boolean;
		isLoadingTop?: boolean;
		isLoadingBottom?: boolean;
		hasMoreTop?: boolean;
		hasMoreBottom?: boolean;
		onLoadTop?: () => void;
		onLoadBottom?: () => void;
	} = $props();

	let listRef: VirtuaListApi | undefined = $state();
	let topLoadScheduled = false;
	let bottomLoadScheduled = false;
	let topLoadLocked = false;
	let bottomLoadLocked = false;

	function requestLoadBottomIfNeeded(): void {
		if (!listRef || !hasMoreBottom || isLoadingBottom || bottomLoadScheduled || bottomLoadLocked) {
			return;
		}

		const offset = listRef.getScrollOffset();
		const viewport = listRef.getViewportSize();
		const scrollSize = listRef.getScrollSize();
		const remaining = scrollSize - (offset + viewport);
		if (remaining > LOAD_MORE_THRESHOLD_PX) return;

		bottomLoadLocked = true;
		bottomLoadScheduled = true;
		queueMicrotask(() => {
			bottomLoadScheduled = false;
			if (!isLoadingBottom && hasMoreBottom) {
				onLoadBottom?.();
			}
		});
	}

	function requestLoadTopIfNeeded(): void {
		if (!listRef || !hasMoreTop || isLoadingTop || topLoadScheduled || topLoadLocked) {
			return;
		}

		const offset = listRef.getScrollOffset();
		if (offset > LOAD_MORE_THRESHOLD_PX) return;

		topLoadLocked = true;
		topLoadScheduled = true;
		queueMicrotask(() => {
			topLoadScheduled = false;
			if (!isLoadingTop && hasMoreTop) {
				onLoadTop?.();
			}
		});
	}

	function handleScroll(): void {
		const offset = listRef?.getScrollOffset() ?? 0;
		const viewport = listRef?.getViewportSize() ?? 0;
		const scrollSize = listRef?.getScrollSize() ?? 0;
		const remaining = scrollSize - (offset + viewport);

		// Rearm triggers only after the user moves away from the edge.
		if (offset > LOAD_MORE_THRESHOLD_PX * REARM_FACTOR) {
			topLoadLocked = false;
		}
		if (remaining > LOAD_MORE_THRESHOLD_PX * REARM_FACTOR) {
			bottomLoadLocked = false;
		}

		requestLoadTopIfNeeded();
		requestLoadBottomIfNeeded();
	}

	export function scrollToIndex(index: number, opts?: ScrollToIndexOpts): void {
		listRef?.scrollToIndex(index, opts);
	}

	export function scrollToIndexOptimized(index: number): Promise<void> {
		return listRef?.scrollToIndexOptimized(index) ?? Promise.resolve();
	}

	export function scrollToOffset(offset: number): void {
		listRef?.scrollToOffset(offset);
	}

	export function getScrollOffset(): number {
		return listRef?.getScrollOffset() ?? 0;
	}

	$effect(() => {
		items.length;
		tick().then(requestLoadBottomIfNeeded);
	});
</script>

<div class="infinite-list-shell">
	<VirtuaList
		bind:this={listRef}
		{items}
		{heightPx}
		{shift}
		onScroll={handleScroll}
	/>

	<div class="status-row" aria-live="polite">
		{#if isLoadingTop}
			Loading older...
		{:else if isLoadingBottom}
			Loading more...
		{:else if !hasMoreTop && !hasMoreBottom}
			Reached limits.
		{/if}
	</div>
</div>

<style>
	.infinite-list-shell {
		position: relative;
	}

	.status-row {
		min-height: 24px;
		padding: 6px 0 2px;
		font-size: 0.8rem;
		color: #6b7280;
	}
</style>
