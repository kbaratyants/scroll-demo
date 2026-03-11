<script lang="ts">
	import { onMount } from "svelte";
	import { browser } from "$app/environment";
	import type { CacheSnapshot, ScrollToIndexOpts } from "virtua";
	import type { Message } from "$lib/data/messages";
	import VirtuaList from "$lib/components/VirtuaList.svelte";

	type VirtuaListApi = {
		scrollToIndex(index: number, opts?: ScrollToIndexOpts): void;
		scrollToIndexOptimized(index: number): Promise<void>;
		scrollToOffset(offset: number): void;
		getScrollOffset(): number;
		getCache(): CacheSnapshot | undefined;
	};

	let {
		items,
		heightPx = 600,
		listId
	}: {
		items: Message[];
		heightPx?: number;
		listId: string;
	} = $props();

	let listRef: VirtuaListApi | undefined = $state();

	function storageKeyFor(id: string, itemCount: number): string {
		return `virtua-restorable-${id}-${itemCount}`;
	}

	function readPersistedState(): { offset: number; cache: CacheSnapshot | undefined } {
		if (!browser) {
			return { offset: 0, cache: undefined };
		}

		const serialized = sessionStorage.getItem(storageKeyFor(listId, items.length));
		if (!serialized) {
			return { offset: 0, cache: undefined };
		}

		try {
			const parsed = JSON.parse(serialized) as [number, CacheSnapshot];
			return { offset: parsed[0] ?? 0, cache: parsed[1] };
		} catch {
			return { offset: 0, cache: undefined };
		}
	}

	const persistedState = readPersistedState();
	const restoredOffset = persistedState.offset;
	const restoredCache = persistedState.cache;

	function persistState(): void {
		if (!browser || !listRef) {
			return;
		}

		sessionStorage.setItem(
			storageKeyFor(listId, items.length),
			JSON.stringify([listRef.getScrollOffset(), listRef.getCache()])
		);
	}

	onMount(() => {
		if (restoredOffset > 0) {
			listRef?.scrollToOffset(restoredOffset);
		}

		return () => {
			persistState();
		};
	});

	export function scrollToIndex(index: number, opts?: ScrollToIndexOpts): void {
		listRef?.scrollToIndex(index, opts);
	}

	export function scrollToIndexOptimized(index: number): Promise<void> {
		return listRef?.scrollToIndexOptimized(index) ?? Promise.resolve();
	}

	export function scrollToOffset(offset: number): void {
		listRef?.scrollToOffset(offset);
	}

	export function getScrollOffset(): number {
		return listRef?.getScrollOffset() ?? 0;
	}
</script>

<VirtuaList bind:this={listRef} {items} {heightPx} shift={false} cache={restoredCache} />
