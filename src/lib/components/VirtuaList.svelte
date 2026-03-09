<script lang="ts">
	import { VList } from "virtua/svelte";
	import MessageItem from "$lib/components/MessageItem.svelte";
	import type { Message } from "$lib/data/messages";

	let { items }: { items: Message[] } = $props();
</script>

<VList data={items} style="height: 600px;" getKey={(message) => message.id}>
	{#snippet children(message)}
		<MessageItem {message} />
	{/snippet}
</VList>
