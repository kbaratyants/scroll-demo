<script lang="ts">
	import { tick } from "svelte";
	import { VList } from "virtua/svelte";
	import type { VListHandle } from "virtua/svelte";
	import type { ScrollToIndexOpts } from "virtua";
	import MessageItem from "$lib/components/MessageItem.svelte";
	import DateHeader from "$lib/components/DateHeader.svelte";
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

	interface MessageGroup {
		date: string;
		messages: Message[];
		startIndex: number;
		endIndex: number;
	}

	let groups: MessageGroup[] = $derived.by(() => {
		const normalized: MessageGroup[] = [];
		let current: MessageGroup | null = null;

		for (let i = 0; i < items.length; i += 1) {
			const message = items[i];
			const date = getDateLabel(message.id);
			if (!current || current.date !== date) {
				current = { date, messages: [message], startIndex: i, endIndex: i };
				normalized.push(current);
				continue;
			}
			current.messages.push(message);
			current.endIndex = i;
		}

		return normalized;
	});

	function findGroupIndexByMessageIndex(index: number): number {
		if (!groups.length) {
			return 0;
		}
		for (let i = 0; i < groups.length; i += 1) {
			const group = groups[i];
			if (index >= group.startIndex && index <= group.endIndex) {
				return i;
			}
		}
		return groups.length - 1;
	}

	export function scrollToIndex(index: number, opts?: ScrollToIndexOpts): void {
		const boundedIndex = Math.max(0, Math.min(index, items.length - 1));
		listRef?.scrollToIndex(findGroupIndexByMessageIndex(boundedIndex), opts);
	}

	function waitForLayout(): Promise<void> {
		return new Promise((resolve) => requestAnimationFrame(() => resolve()));
	}

	export async function scrollToIndexOptimized(index: number): Promise<void> {
		if (!listRef || !items.length) return;

		const generation = ++optimizedScrollGeneration;

		const boundedIndex = Math.max(0, Math.min(index, items.length - 1));
		const groupIndex = findGroupIndexByMessageIndex(boundedIndex);

		const currentOffset = listRef.getScrollOffset();
		const targetOffset = listRef.getItemOffset(groupIndex);
		const distance = Math.abs(targetOffset - currentOffset);

		if (distance === 0) return;

		if (distance <= MAX_ANIMATED_SCROLL_PX) {
			listRef.scrollToIndex(groupIndex, { smooth: true });
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

		listRef.scrollToIndex(groupIndex, { smooth: true });
	}

	export function scrollToOffset(offset: number): void {
		listRef?.scrollTo(offset);
	}
</script>

<div>
	<VList
		bind:this={listRef}
		data={groups}
		style="height: 600px;"
		shift={true}
		getKey={(group) => group.startIndex}
	>
		{#snippet children(group)}
			<section>
				<DateHeader
					date={group.date}
					onclick={() => onDateHeaderClick?.(group.date)}
				/>
				{#each group.messages as message (message.id)}
					<MessageItem
						{message}
						expanded={expandedMessageIds.has(message.id)}
						onToggleExpand={() => onToggleMessageExpand?.(message.id)}
					/>
				{/each}
			</section>
		{/snippet}
	</VList>
</div>
