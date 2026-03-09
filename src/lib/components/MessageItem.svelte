<script lang="ts">
	import type { Message } from "$lib/data/messages";

	let {
		message,
		expanded = false,
		onToggleExpand
	}: {
		message: Message;
		expanded?: boolean;
		onToggleExpand?: () => void;
	} = $props();

	function buildTranscript(text: string): string {
		return `${text} Detailed transcript: ${text.toLowerCase()} ${text.toLowerCase()} Additional context for testing dynamic content growth.`;
	}
</script>

<article
	class="message-item"
	data-id={message.id}
>
	<div class="id">#{message.id}</div>
	<p class="text">{message.text}</p>
	{#if expanded}
		<p class="transcript">{buildTranscript(message.text)}</p>
	{/if}
	<button type="button" class="expand-toggle" onclick={onToggleExpand}>
		{expanded ? "Collapse" : "Expand"}
	</button>
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

	.transcript {
		margin: 8px 0 0;
		padding: 8px 10px;
		border-radius: 8px;
		background: #f3f4f6;
		line-height: 1.5;
		color: #1f2937;
	}

	.expand-toggle {
		margin-top: 8px;
		padding: 4px 10px;
		border: 1px solid #d1d5db;
		border-radius: 999px;
		background: #f9fafb;
		font-size: 0.75rem;
		cursor: pointer;
	}
</style>
