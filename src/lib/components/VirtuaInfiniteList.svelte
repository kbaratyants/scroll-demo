<script lang="ts">
	import { tick } from "svelte";
	import { VList } from "virtua/svelte";
	import type { VListHandle } from "virtua/svelte";
	import type { ScrollToIndexOpts } from "virtua";
	import type { Message } from "$lib/data/messages";

	const LOAD_MORE_THRESHOLD_PX = 500;
	const MAX_ANIMATED_SCROLL_PX = 3000;

	let {
		items,
		heightPx = 600,
		isLoadingMore = false,
		hasMore = true,
		onLoadMore
	}: {
		items: Message[];
		heightPx?: number;
		isLoadingMore?: boolean;
		hasMore?: boolean;
		onLoadMore?: () => void;
	} = $props();

	let listRef: VListHandle | undefined = $state();
	let optimizedScrollGeneration = 0;
	let loadScheduled = false;

	function waitForLayout(): Promise<void> {
		return new Promise((resolve) => requestAnimationFrame(() => resolve()));
	}

	function requestLoadMoreIfNeeded(): void {
		if (!listRef || !hasMore || isLoadingMore || loadScheduled) {
			return;
		}

		const offset = listRef.getScrollOffset();
		const viewport = listRef.getViewportSize();
		const scrollSize = listRef.getScrollSize();
		const remaining = scrollSize - (offset + viewport);

		if (remaining > LOAD_MORE_THRESHOLD_PX) {
			return;
		}

		loadScheduled = true;
		queueMicrotask(() => {
			loadScheduled = false;
			if (!isLoadingMore && hasMore) {
				onLoadMore?.();
			}
		});
	}

	export function scrollToIndex(index: number, opts?: ScrollToIndexOpts): void {
		if (!items.length) return;
		const boundedIndex = Math.max(0, Math.min(index, items.length - 1));
		listRef?.scrollToIndex(boundedIndex, opts);
	}

	export async function scrollToIndexOptimized(index: number): Promise<void> {
		if (!listRef || !items.length) return;

		const generation = ++optimizedScrollGeneration;
		const boundedIndex = Math.max(0, Math.min(index, items.length - 1));
		const currentOffset = listRef.getScrollOffset();
		const targetOffset = listRef.getItemOffset(boundedIndex);
		const distance = Math.abs(targetOffset - currentOffset);

		if (distance === 0) return;
		if (distance <= MAX_ANIMATED_SCROLL_PX) {
			listRef.scrollToIndex(boundedIndex, { smooth: true });
			return;
		}

		const direction = Math.sign(targetOffset - currentOffset);
		const maxScroll = listRef.getScrollSize() - listRef.getViewportSize();
		const jumpOffset = Math.max(
			0,
			Math.min(targetOffset - direction * MAX_ANIMATED_SCROLL_PX, maxScroll)
		);
		listRef.scrollTo(jumpOffset);

		await tick();
		await waitForLayout();
		if (generation !== optimizedScrollGeneration) return;

		listRef.scrollToIndex(boundedIndex, { smooth: true });
	}

	export function scrollToOffset(offset: number): void {
		listRef?.scrollTo(offset);
	}

	export function getScrollOffset(): number {
		return listRef?.getScrollOffset() ?? 0;
	}

	$effect(() => {
		items.length;
		tick().then(requestLoadMoreIfNeeded);
	});
</script>

<div class="infinite-list-shell">
	<VList
		bind:this={listRef}
		data={items}
		style={`height: ${heightPx}px;`}
		onscroll={requestLoadMoreIfNeeded}
		getKey={(item) => item.id}
	>
		{#snippet children(item)}
			<article class="item">
				<div class="item-id">#{item.id}</div>
				<p class="item-text">{item.text}</p>
			</article>
		{/snippet}
	</VList>

	<div class="status-row" aria-live="polite">
		{#if isLoadingMore}
			Loading more...
		{:else if !hasMore}
			Reached max items.
		{/if}
	</div>
</div>

<style>
	.infinite-list-shell {
		position: relative;
	}

	.item {
		box-sizing: border-box;
		padding: 12px 16px;
		border-bottom: 1px solid #e5e7eb;
	}

	.item-id {
		font-size: 0.8rem;
		font-weight: 600;
		color: #6b7280;
		margin-bottom: 6px;
	}

	.item-text {
		margin: 0;
		line-height: 1.4;
		color: #111827;
	}

	.status-row {
		min-height: 24px;
		padding: 6px 0 2px;
		font-size: 0.8rem;
		color: #6b7280;
	}
</style>
