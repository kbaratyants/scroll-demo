<script lang="ts">
	let {
		date,
		offsetY = 0,
		onclick
	}: {
		date: string;
		offsetY?: number;
		onclick?: () => void;
	} = $props();
</script>

<button
	type="button"
	class="floating-date-header"
	style={`transform: translateY(${offsetY}px);`}
	onclick={onclick}
>
	<span>{date}</span>
</button>

<style>
	.floating-date-header {
		display: block;
		width: 100%;
		background: white;
		padding: 8px 16px;
		border: none;
		border-bottom: 1px solid #e5e7eb;
		font-size: 0.8rem;
		font-weight: 600;
		color: #4b5563;
		cursor: pointer;
		text-align: left;
		will-change: transform;
	}

	.floating-date-header:hover {
		background: #f3f4f6;
		color: #1f2937;
	}
</style>
