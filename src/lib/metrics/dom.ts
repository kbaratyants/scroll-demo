export function countNodesInScrollContainer(container: HTMLElement | null): number {
	if (!container) {
		return 0;
	}

	// Count all descendant element nodes inside the scroll container.
	return container.querySelectorAll(".message-item").length;
}
