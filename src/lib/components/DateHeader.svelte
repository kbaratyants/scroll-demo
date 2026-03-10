<script lang="ts">
	let {
		date,
		onclick
	}: {
		date: string;
		onclick?: () => void;
	} = $props();
</script>

<button type="button" class="date-header" onclick={onclick}>
	<span>{date}</span>
</button>

<style>
	.date-header {
		display: block;
		width: 100%;
		position: sticky;
		top: 0;
		z-index: 2;
		background: white;
		padding: 8px 16px;
		border: none;
		border-bottom: 1px solid #e5e7eb;
		font-size: 0.8rem;
		font-weight: 600;
		color: #4b5563;
		cursor: pointer;
		text-align: left;
	}

	.date-header:hover {
		background: #f3f4f6;
		color: #1f2937;
	}
</style>
