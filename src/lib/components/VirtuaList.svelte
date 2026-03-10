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
		expandedMessageIds = new Set<number>(),
		onToggleMessageExpand,
		onDateHeaderClick
	}: {
		items: Message[];
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

	interface GroupMeta {
		date: string;
		startIndex: number;
	}

	type FlatListItem =
		| {
				kind: "header";
				key: string;
				date: string;
				groupIndex: number;
		  }
		| {
				kind: "message";
				key: string;
				message: Message;
				groupIndex: number;
		  };

	let flattenResult = $derived.by(() => {
		const flatItems: FlatListItem[] = [];
		const groups: GroupMeta[] = [];
		const messageIndexToGroupIndex = new Int32Array(items.length);
		const flatIndexToGroupIndex: number[] = [];
		let currentDate = "";
		let currentGroupIndex = -1;

		for (let i = 0; i < items.length; i += 1) {
			const message = items[i];
			const date = getDateLabel(message.id);

			if (date !== currentDate) {
				currentDate = date;
				currentGroupIndex += 1;
				groups.push({
					date,
					startIndex: flatItems.length
				});
				flatItems.push({
					kind: "header",
					key: `header-${currentGroupIndex}-${date}`,
					date,
					groupIndex: currentGroupIndex
				});
				flatIndexToGroupIndex.push(currentGroupIndex);
			}

			flatItems.push({
				kind: "message",
				key: `message-${message.id}`,
				message,
				groupIndex: currentGroupIndex
			});
			messageIndexToGroupIndex[i] = currentGroupIndex;
			flatIndexToGroupIndex.push(currentGroupIndex);
		}

		return {
			flatItems,
			groups,
			messageIndexToGroupIndex,
			flatIndexToGroupIndex
		};
	});
	let flatItems = $derived(flattenResult.flatItems);
	let groups = $derived(flattenResult.groups);
	let messageIndexToGroupIndex = $derived(flattenResult.messageIndexToGroupIndex);
	let flatIndexToGroupIndex = $derived(flattenResult.flatIndexToGroupIndex);
	let activeGroupDate = $derived(groups[activeGroupIndex]?.date ?? "");

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
		if (!groups.length || !listRef) {
			activeGroupIndex = 0;
			floatingHeaderOffsetY = 0;
			return;
		}

		const firstVisibleIndex = getFirstVisibleIndex();
		activeGroupIndex = findGroupByFlatIndex(firstVisibleIndex);
		const nextGroup = groups[activeGroupIndex + 1];

		if (!nextGroup || !listContainer || !floatingHeaderHeight) {
			floatingHeaderOffsetY = 0;
			return;
		}

		const nextHeaderEl = listContainer.querySelector<HTMLElement>(
			`[data-group-header-index="${nextGroup.startIndex}"]`
		);
		if (!nextHeaderEl) {
			floatingHeaderOffsetY = 0;
			return;
		}

		const containerTop = listContainer.getBoundingClientRect().top;
		const nextHeaderTop = nextHeaderEl.getBoundingClientRect().top - containerTop;
		floatingHeaderOffsetY = Math.min(0, nextHeaderTop - floatingHeaderHeight);
	}

	function scheduleFloatingHeaderUpdate(): void {
		if (scrollUpdateRafId) return;
		scrollUpdateRafId = requestAnimationFrame(() => {
			scrollUpdateRafId = 0;
			updateFloatingHeaderState();
		});
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
		return () => {
			if (scrollUpdateRafId) {
				cancelAnimationFrame(scrollUpdateRafId);
			}
		};
	});
</script>

<div class="list-shell" bind:this={listContainer}>
	<VList
		bind:this={listRef}
		data={flatItems}
		style="height: 600px;"
		shift={true}
		onscroll={scheduleFloatingHeaderUpdate}
		getKey={(item) => item.key}
	>
		{#snippet children(item, index)}
			{#if item.kind === "header"}
				<section class="group-header-row" data-group-header-index={index}>
				<DateHeader
					date={item.date}
					onclick={() => onDateHeaderClick?.(item.date)}
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

	{#if activeGroupDate}
		<div class="floating-header-layer" bind:this={floatingHeaderEl}>
			<FloatingGroupHeader
				date={activeGroupDate}
				offsetY={floatingHeaderOffsetY}
				onclick={() => onDateHeaderClick?.(activeGroupDate)}
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
		right: 0;
		z-index: 5;
		pointer-events: none;
	}

	.floating-header-layer :global(.floating-date-header) {
		pointer-events: auto;
	}
</style>
