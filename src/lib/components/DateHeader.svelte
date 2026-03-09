<script lang="ts">
	let { date }: { date: string } = $props();
</script>

<div class="date-header">
	<span>{date}</span>
</div>

<style>
	.date-header {
		position: sticky;
		top: 0;
		z-index: 1;
		background: white;
		padding: 8px 16px;
		border-bottom: 1px solid #e5e7eb;
		font-size: 0.8rem;
		font-weight: 600;
		color: #4b5563;
	}
</style>
