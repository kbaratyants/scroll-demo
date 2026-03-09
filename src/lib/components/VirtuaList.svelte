<script lang="ts">
	import { VList } from "virtua/svelte";
	import type { VListHandle } from "virtua/svelte";
	import MessageItem from "$lib/components/MessageItem.svelte";
	import type { Message } from "$lib/data/messages";

	let { items }: { items: Message[] } = $props();
	let listRef: VListHandle | undefined = $state();

	export function scrollToIndex(index: number): void {
		listRef?.scrollToIndex(index);
	}

	export function scrollToOffset(offset: number): void {
		listRef?.scrollTo(offset);
	}
</script>

<VList bind:this={listRef} data={items} style="height: 600px;" getKey={(message) => message.id}>
	{#snippet children(message)}
		<MessageItem {message} />
	{/snippet}
</VList>
