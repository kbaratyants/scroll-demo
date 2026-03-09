<script lang="ts">
	import VirtuaList from "$lib/components/VirtuaList.svelte";
	import { generateMessages, type Message } from "$lib/data/messages";

	let items = $state(generateMessages(5000, 42));
	let olderMessageId = $state(0);
	let isLoadingOlder = $state(false);
	let expandedMessageIds = $state<Set<number>>(new Set());

	function buildOlderMessages(count: number): Message[] {
		const batch = generateMessages(count, Date.now());
		return batch.map((message) => ({
			id: olderMessageId--,
			text: `Older: ${message.text}`
		}));
	}

	type VirtuaListApi = {
		scrollToIndex(index: number, smooth: boolean): void;
		scrollToOffset(offset: number): void;
	};
	let listRef: VirtuaListApi | undefined = $state();

	function scrollTop() {
		listRef?.scrollToOffset(0);
	}

	function scrollMiddle() {
		listRef?.scrollToIndex(Math.floor(items.length / 2), true);
	}

	function scrollBottom() {
		listRef?.scrollToIndex(items.length - 1, true);
	}

	function randomScroll() {
		const randomIndex = Math.floor(Math.random() * items.length);
		listRef?.scrollToIndex(randomIndex, true);
	}

	function toggleMessageExpanded(messageId: number) {
		const next = new Set(expandedMessageIds);
		if (next.has(messageId)) {
			next.delete(messageId);
		} else {
			next.add(messageId);
		}
		expandedMessageIds = next;
	}

	function loadOlder() {
		if (isLoadingOlder) {
			return;
		}

		isLoadingOlder = true;
		const olderMessages = buildOlderMessages(100);

		items = [...olderMessages, ...items];
		isLoadingOlder = false;
	}
</script>

<main class="page">
	<h1>Virtual List Benchmark</h1>

	<div class="controls">
		<button type="button" onclick={loadOlder} disabled={isLoadingOlder}>
			{isLoadingOlder ? "Loading..." : "Load older (prepend 100)"}
		</button>
		<button type="button" onclick={scrollTop}>Scroll top</button>
		<button type="button" onclick={scrollMiddle}>Scroll middle</button>
		<button type="button" onclick={scrollBottom}>Scroll bottom</button>
		<button type="button" onclick={randomScroll}>Random scroll</button>
	</div>

	<VirtuaList
		bind:this={listRef}
		{items}
		{expandedMessageIds}
		onToggleMessageExpand={toggleMessageExpanded}
	/>
</main>

<style>
	.page {
		max-width: 900px;
		margin: 24px auto;
		padding: 0 16px;
	}

	h1 {
		margin: 0 0 16px;
		font-size: 1.5rem;
	}

	.controls {
		display: flex;
		flex-wrap: wrap;
		gap: 8px;
		margin-bottom: 12px;
	}

	button {
		padding: 8px 12px;
		border: 1px solid #d1d5db;
		border-radius: 8px;
		background: #fff;
		cursor: pointer;
	}

	button:hover {
		background: #f9fafb;
	}
</style>
