<script lang="ts">
	import type { Message } from "$lib/data/messages";

	let { message }: { message: Message } = $props();
</script>

<article class="message-item" style={`height: ${message.height}px;`}>
	<div class="id">#{message.id}</div>
	<p class="text">{message.text}</p>
</article>

<style>
	.message-item {
		box-sizing: border-box;
		padding: 12px 16px;
		border-bottom: 1px solid #e5e7eb;
	}

	.id {
		font-size: 0.8rem;
		font-weight: 600;
		color: #6b7280;
		margin-bottom: 6px;
	}

	.text {
		margin: 0;
		line-height: 1.4;
		color: #111827;
	}
</style>
