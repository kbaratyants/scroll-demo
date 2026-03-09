<script lang="ts">
	import { VList } from "virtua/svelte";
	import type { VListHandle } from "virtua/svelte";
	import MessageItem from "$lib/components/MessageItem.svelte";
	import DateHeader from "$lib/components/DateHeader.svelte";
	import type { Message } from "$lib/data/messages";

	let { items }: { items: Message[] } = $props();
	let listRef: VListHandle | undefined = $state();
	let rootRef: HTMLDivElement | undefined = $state();

	interface MessageGroup {
		date: string;
		messages: Message[];
		startIndex: number;
		endIndex: number;
	}

	export interface ScrollAnchor {
		id: number;
		top: number;
		scrollTop: number;
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

	function getScrollContainer(): HTMLElement | null {
		const viewport = rootRef?.firstElementChild;
		if (!(viewport instanceof HTMLElement)) {
			return null;
		}
		return viewport;
	}

	export function captureAnchor(): ScrollAnchor | null {
		const container = getScrollContainer();
		if (!container) {
			return null;
		}

		const containerRect = container.getBoundingClientRect();
		const nodes = container.querySelectorAll<HTMLElement>("[data-id]");

		for (const node of nodes) {
			const nodeRect = node.getBoundingClientRect();
			const intersectsViewport =
				nodeRect.bottom > containerRect.top && nodeRect.top < containerRect.bottom;
			if (!intersectsViewport || nodeRect.top < containerRect.top) {
				continue;
			}

			const id = Number(node.dataset.id);
			if (Number.isNaN(id)) {
				continue;
			}

			return {
				id,
				top: nodeRect.top - containerRect.top,
				scrollTop: container.scrollTop
			};
		}

		return null;
	}

	export function restoreAnchor(anchor: ScrollAnchor | null): void {
		if (!anchor) {
			return;
		}

		const container = getScrollContainer();
		if (!container) {
			return;
		}

		const anchoredNode = container.querySelector<HTMLElement>(`[data-id="${anchor.id}"]`);
		if (!anchoredNode) {
			return;
		}

		const containerRect = container.getBoundingClientRect();
		const newTop = anchoredNode.getBoundingClientRect().top - containerRect.top;
		const delta = newTop - anchor.top;

		if (delta !== 0) {
			container.scrollTop += delta;
		}
	}

	export function scrollToIndex(index: number): void {
		const boundedIndex = Math.max(0, Math.min(index, items.length - 1));
		listRef?.scrollToIndex(findGroupIndexByMessageIndex(boundedIndex));
	}

	export function scrollToOffset(offset: number): void {
		listRef?.scrollTo(offset);
	}
</script>

<div bind:this={rootRef}>
	<VList bind:this={listRef} data={groups} style="height: 600px;" getKey={(group) => group.startIndex}>
		{#snippet children(group)}
			<section>
				<DateHeader date={group.date} />
				{#each group.messages as message (message.id)}
					<MessageItem {message} />
				{/each}
			</section>
		{/snippet}
	</VList>
</div>
