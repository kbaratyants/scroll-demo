export function countNodesInScrollContainer(container: HTMLElement | null): number {
	if (!container) {
		return 0;
	}

	// Count rendered row nodes in both benchmark modes.
	return container.querySelectorAll(".message-item, .item").length;
}
