<script lang="ts">
	import { tick } from "svelte";
	import { VList } from "virtua/svelte";
	import type { VListHandle } from "virtua/svelte";
	import type { ScrollToIndexOpts } from "virtua";
	import MessageItem from "$lib/components/MessageItem.svelte";
	import DateHeader from "$lib/components/DateHeader.svelte";
	import type { Message } from "$lib/data/messages";

	const MAX_ANIMATED_SCROLL_PX = 3000;

	let {
		items,
		expandedMessageIds = new Set<number>(),
		onToggleMessageExpand
	}: {
		items: Message[];
		expandedMessageIds?: ReadonlySet<number>;
		onToggleMessageExpand?: (id: number) => void;
	} = $props();
	let listRef: VListHandle | undefined = $state();

	interface MessageGroup {
		date: string;
		messages: Message[];
		startIndex: number;
		endIndex: number;
	}

	function getDateLabel(messageId: number): string {
		const baseDate = new Date(2024, 0, 1);
		const dayOffset = Math.floor(messageId / 40);
		baseDate.setDate(baseDate.getDate() + dayOffset);
		return new Intl.DateTimeFormat("en-US", { day: "numeric", month: "long" }).format(baseDate);
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

	export async function scrollToIndexOptimized(index: number): Promise<void> {
		if (!listRef) return;

		const boundedIndex = Math.max(0, Math.min(index, items.length - 1));
		const groupIndex = findGroupIndexByMessageIndex(boundedIndex);

		const currentOffset = listRef.getScrollOffset();
		const targetOffset = listRef.getItemOffset(groupIndex);
		const distance = Math.abs(targetOffset - currentOffset);

		if (distance <= MAX_ANIMATED_SCROLL_PX) {
			listRef.scrollToIndex(groupIndex, { smooth: true });
			return;
		}

		const direction = Math.sign(targetOffset - currentOffset);
		const jumpOffset = targetOffset - direction * MAX_ANIMATED_SCROLL_PX;
		listRef.scrollTo(jumpOffset);

		await tick();

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
				<DateHeader date={group.date} />
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
