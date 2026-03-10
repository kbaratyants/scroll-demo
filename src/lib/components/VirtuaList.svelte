<script lang="ts">
	import { tick } from "svelte";
	import { VList } from "virtua/svelte";
	import type { VListHandle } from "virtua/svelte";
	import type { ScrollToIndexOpts } from "virtua";
	import MessageItem from "$lib/components/MessageItem.svelte";
	import DateHeader from "$lib/components/DateHeader.svelte";
	import FloatingGroupHeader from "$lib/components/FloatingGroupHeader.svelte";
	import type { Message } from "$lib/data/messages";
	import { getDateLabel } from "$lib/utils/dates";

	const MAX_ANIMATED_SCROLL_PX = 3000;

	let {
		items,
		heightPx = 600,
		expandedMessageIds = new Set<number>(),
		onToggleMessageExpand,
		onDateHeaderClick
	}: {
		items: Message[];
		heightPx?: number;
		expandedMessageIds?: ReadonlySet<number>;
		onToggleMessageExpand?: (id: number) => void;
		onDateHeaderClick?: (date: string) => void;
	} = $props();
	let listRef: VListHandle | undefined = $state();
	let optimizedScrollGeneration = 0;
	let listContainer: HTMLDivElement | undefined = $state();
	let floatingHeaderEl: HTMLDivElement | undefined = $state();
	let floatingHeaderHeight = $state(0);
	let activeGroupIndex = $state(0);
	let floatingHeaderOffsetY = $state(0);
	let scrollUpdateRafId = 0;
	const headerRefs = new Map<number, HTMLElement>();
	let containerResizeObserver: ResizeObserver | undefined;
	let headerResizeObserver: ResizeObserver | undefined;

	interface GroupMeta {
	date: number;
		startIndex: number;
	}

type FlatItem =
		| {
				type: "header";
				key: string;
				date: number;
		  }
		| {
				type: "message";
				key: string;
				message: Message;
		  };

	let flattenResult = $derived.by(() => {
		const flatItems: FlatItem[] = [];
		const messageIndexToGroupIndex = new Int32Array(items.length);
		let currentDate = "";
		let currentGroupIndex = -1;
		let currentGroupHeaderDate = -1;

		for (let i = 0; i < items.length; i += 1) {
			const message = items[i];
			const date = getDateLabel(message.id);

			if (date !== currentDate) {
				currentDate = date;
				currentGroupIndex += 1;
				currentGroupHeaderDate = message.id;
				flatItems.push({
					type: "header",
					key: `header-${date}-${currentGroupHeaderDate}`,
					date: currentGroupHeaderDate
				});
			}

			flatItems.push({
				type: "message",
				key: `message-${message.id}`,
				message
			});
			messageIndexToGroupIndex[i] = currentGroupIndex;
		}

		return {
			flatItems,
			messageIndexToGroupIndex
		};
	});

	let groupMetaResult = $derived.by(() => {
		const groups: GroupMeta[] = [];
		const dateIndex = new Map<number, number>();
		const flatIndexToGroupIndex: number[] = new Array(flatItems.length);
		let currentGroupIndex = -1;

		for (let i = 0; i < flatItems.length; i += 1) {
			const item = flatItems[i];
			if (item.type === "header") {
				currentGroupIndex += 1;
				groups.push({
					date: item.date,
					startIndex: i
				});
				dateIndex.set(item.date, i);
			}

			flatIndexToGroupIndex[i] = currentGroupIndex >= 0 ? currentGroupIndex : 0;
		}

		return {
			groups,
			dateIndex,
			flatIndexToGroupIndex
		};
	});
	let flatItems = $derived(flattenResult.flatItems);
	let messageIndexToGroupIndex = $derived(flattenResult.messageIndexToGroupIndex);
	let groups = $derived(groupMetaResult.groups);
	let dateIndex = $derived(groupMetaResult.dateIndex);
	let flatIndexToGroupIndex = $derived(groupMetaResult.flatIndexToGroupIndex);
	let activeGroupDate = $derived(groups[activeGroupIndex]?.date ?? -1);
	let activeGroupDateLabel = $derived(activeGroupDate >= 0 ? getDateLabel(activeGroupDate) : "");

	function findGroupIndexByMessageIndex(index: number): number {
		if (!groups.length) {
			return 0;
		}

		return messageIndexToGroupIndex[index] ?? groups.length - 1;
	}

	function findGroupByFlatIndex(index: number): number {
		if (!groups.length) {
			return 0;
		}
		if (index < 0) {
			return 0;
		}

		const cachedGroupIndex = flatIndexToGroupIndex[index];
		if (cachedGroupIndex != null) {
			return cachedGroupIndex;
		}

		// Fallback binary search for safety when index is out of prepared cache range.
		let low = 0;
		let high = groups.length - 1;
		let resolved = 0;

		while (low <= high) {
			const mid = (low + high) >> 1;
			if (groups[mid].startIndex <= index) {
				resolved = mid;
				low = mid + 1;
			} else {
				high = mid - 1;
			}
		}

		return resolved;
	}

	export function scrollToIndex(index: number, opts?: ScrollToIndexOpts): void {
		const boundedIndex = Math.max(0, Math.min(index, items.length - 1));
		const targetGroupIndex = findGroupIndexByMessageIndex(boundedIndex);
		const targetFlatIndex = groups[targetGroupIndex]?.startIndex ?? 0;
		listRef?.scrollToIndex(targetFlatIndex, opts);
	}

	export function scrollToDate(date: number, opts?: ScrollToIndexOpts): void {
		const targetFlatIndex = dateIndex.get(date);
		if (targetFlatIndex == null) return;
		listRef?.scrollToIndex(targetFlatIndex, opts);
	}

	function waitForLayout(): Promise<void> {
		return new Promise((resolve) => requestAnimationFrame(() => resolve()));
	}

	export async function scrollToIndexOptimized(index: number): Promise<void> {
		if (!listRef || !items.length) return;

		const generation = ++optimizedScrollGeneration;

		const boundedIndex = Math.max(0, Math.min(index, items.length - 1));
		const groupIndex = findGroupIndexByMessageIndex(boundedIndex);
		const targetFlatIndex = groups[groupIndex]?.startIndex ?? 0;

		const currentOffset = listRef.getScrollOffset();
		const targetOffset = listRef.getItemOffset(targetFlatIndex);
		const distance = Math.abs(targetOffset - currentOffset);

		if (distance === 0) return;

		if (distance <= MAX_ANIMATED_SCROLL_PX) {
			listRef.scrollToIndex(targetFlatIndex, { smooth: true });
			return;
		}

		const direction = Math.sign(targetOffset - currentOffset);
		const maxScroll = listRef.getScrollSize() - listRef.getViewportSize();
		const jumpOffset = Math.max(0, Math.min(
			targetOffset - direction * MAX_ANIMATED_SCROLL_PX,
			maxScroll
		));

		listRef.scrollTo(jumpOffset);

		await tick();
		await waitForLayout();

		if (generation !== optimizedScrollGeneration) return;

		listRef.scrollToIndex(targetFlatIndex, { smooth: true });
	}

	export function scrollToOffset(offset: number): void {
		listRef?.scrollTo(offset);
	}

	export function getScrollOffset(): number {
		return listRef?.getScrollOffset() ?? 0;
	}

	function measureFloatingHeaderHeight(): void {
		floatingHeaderHeight = floatingHeaderEl?.offsetHeight ?? 0;
	}

	function getFirstVisibleIndex(): number {
		if (!listRef || flatItems.length === 0) {
			return 0;
		}

		// Virtua Svelte handle does not expose getVirtualItems(); findItemIndex(offset) is an equivalent way.
		const offset = listRef.getScrollOffset();
		return Math.max(0, Math.min(flatItems.length - 1, listRef.findItemIndex(offset)));
	}

	function updateFloatingHeaderState(): void {
		let nextActiveGroupIndex = 0;
		let nextFloatingHeaderOffsetY = 0;

		if (!groups.length || !listRef) {
			// Keep default next values.
		} else {
			const firstVisibleIndex = getFirstVisibleIndex();
			nextActiveGroupIndex = findGroupByFlatIndex(firstVisibleIndex);
			const nextGroup = groups[nextActiveGroupIndex + 1];

			if (nextGroup && floatingHeaderHeight) {
				const nextHeaderIndex = nextGroup.startIndex;
				const scrollOffset = listRef.getScrollOffset();
				const nextHeaderOffset = listRef.getItemOffset(nextHeaderIndex);
				let nextHeaderTop = nextHeaderOffset - scrollOffset;

				// Virtua-first path is preferred to avoid DOM reads in scroll/RAF hot path.
				// Fallback to DOM only when Virtua position looks invalid/suspicious.
				if (!Number.isFinite(nextHeaderTop) || nextHeaderTop < -1) {
					const nextHeaderEl = headerRefs.get(nextHeaderIndex);
					if (nextHeaderEl && listContainer) {
						const containerTop = listContainer.getBoundingClientRect().top;
						nextHeaderTop = nextHeaderEl.getBoundingClientRect().top - containerTop;
					}
				}

				if (Number.isFinite(nextHeaderTop)) {
					nextFloatingHeaderOffsetY = Math.min(0, nextHeaderTop - floatingHeaderHeight);
				}
			}
		}

		if (
			activeGroupIndex === nextActiveGroupIndex &&
			floatingHeaderOffsetY === nextFloatingHeaderOffsetY
		) {
			return;
		}

		activeGroupIndex = nextActiveGroupIndex;
		floatingHeaderOffsetY = nextFloatingHeaderOffsetY;
	}

	function scheduleFloatingHeaderUpdate(): void {
		if (scrollUpdateRafId) return;
		scrollUpdateRafId = requestAnimationFrame(() => {
			scrollUpdateRafId = 0;
			updateFloatingHeaderState();
		});
	}

	function getHeaderResizeObserver(): ResizeObserver | undefined {
		if (typeof ResizeObserver === "undefined") return undefined;
		if (!headerResizeObserver) {
			headerResizeObserver = new ResizeObserver(() => {
				scheduleFloatingHeaderUpdate();
			});
			for (const headerEl of headerRefs.values()) {
				headerResizeObserver.observe(headerEl);
			}
		}
		return headerResizeObserver;
	}

	function registerHeaderRef(node: HTMLElement, headerIndex: number) {
		let currentHeaderIndex = headerIndex;
		headerRefs.set(currentHeaderIndex, node);
		getHeaderResizeObserver()?.observe(node);

		return {
			update(nextHeaderIndex: number) {
				if (nextHeaderIndex === currentHeaderIndex) return;
				getHeaderResizeObserver()?.unobserve(node);
				headerRefs.delete(currentHeaderIndex);
				currentHeaderIndex = nextHeaderIndex;
				headerRefs.set(currentHeaderIndex, node);
				getHeaderResizeObserver()?.observe(node);
			},
			destroy() {
				getHeaderResizeObserver()?.unobserve(node);
				headerRefs.delete(currentHeaderIndex);
			}
		};
	}

	$effect(() => {
		flatItems.length;
		groups.length;
		tick().then(() => {
			measureFloatingHeaderHeight();
			updateFloatingHeaderState();
		});
	});

	$effect(() => {
		if (typeof ResizeObserver === "undefined" || !listContainer) return;
		containerResizeObserver?.disconnect();
		containerResizeObserver = new ResizeObserver(() => {
			scheduleFloatingHeaderUpdate();
		});
		containerResizeObserver.observe(listContainer);

		return () => {
			containerResizeObserver?.disconnect();
			containerResizeObserver = undefined;
		};
	});

	$effect(() => {
		return () => {
			if (scrollUpdateRafId) {
				cancelAnimationFrame(scrollUpdateRafId);
			}
			containerResizeObserver?.disconnect();
			containerResizeObserver = undefined;
			headerResizeObserver?.disconnect();
			headerResizeObserver = undefined;
		};
	});
</script>

<div class="list-shell" bind:this={listContainer}>
	<VList
		bind:this={listRef}
		data={flatItems}
		style={`height: ${heightPx}px;`}
		shift={true}
		onscroll={scheduleFloatingHeaderUpdate}
		getKey={(item) => item.key}
	>
		{#snippet children(item, index)}
			{#if item.type === "header"}
				<section
					class="group-header-row"
					data-group-header-index={index}
					use:registerHeaderRef={index}
				>
				<DateHeader
					date={getDateLabel(item.date)}
					onclick={() => onDateHeaderClick?.(getDateLabel(item.date))}
				/>
				</section>
			{:else}
				<MessageItem
					message={item.message}
					expanded={expandedMessageIds.has(item.message.id)}
					onToggleExpand={() => onToggleMessageExpand?.(item.message.id)}
				/>
			{/if}
		{/snippet}
	</VList>

	{#if activeGroupDateLabel}
		<div class="floating-header-layer" bind:this={floatingHeaderEl}>
			<FloatingGroupHeader
				date={activeGroupDateLabel}
				offsetY={floatingHeaderOffsetY}
				onclick={() => onDateHeaderClick?.(activeGroupDateLabel)}
			/>
		</div>
	{/if}
</div>

<style>
	.list-shell {
		position: relative;
	}

	.group-header-row {
		position: relative;
		z-index: 0;
	}

	.floating-header-layer {
		position: absolute;
		top: 0;
		left: 0;
		right: 24px;
		z-index: 5;
		pointer-events: none;
	}

	.floating-header-layer :global(.floating-date-header) {
		pointer-events: auto;
	}
</style>
