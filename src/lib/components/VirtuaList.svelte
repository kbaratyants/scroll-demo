<script lang="ts">
	import { VList } from "virtua/svelte";
	import MessageItem from "$lib/components/MessageItem.svelte";
	import type { Message } from "$lib/data/messages";

	let { messages }: { messages: Message[] } = $props();
</script>

<VList data={messages} style="height: 600px;" getKey={(message) => message.id}>
	{#snippet children(message)}
		<MessageItem {message} />
	{/snippet}
</VList>
