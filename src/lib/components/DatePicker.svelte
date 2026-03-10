<script lang="ts">
	let {
		initialYear,
		initialMonth,
		initialDay,
		minDate,
		maxDate,
		onselect,
		onclose
	}: {
		initialYear: number;
		initialMonth: number;
		initialDay: number;
		minDate?: Date;
		maxDate?: Date;
		onselect: (date: Date) => void;
		onclose: () => void;
	} = $props();

	const today = new Date();

	let viewYear = $state(initialYear);
	let viewMonth = $state(initialMonth);

	const WEEKDAYS = ["Mo", "Tu", "We", "Th", "Fr", "Sa", "Su"];
	const MONTH_NAMES = [
		"January", "February", "March", "April", "May", "June",
		"July", "August", "September", "October", "November", "December"
	];

	interface CalendarDay {
		date: number;
		month: number;
		year: number;
		isCurrentMonth: boolean;
		isDisabled: boolean;
		isSelected: boolean;
		isToday: boolean;
	}

	function sameDay(y: number, m: number, d: number, other: Date): boolean {
		return y === other.getFullYear() && m === other.getMonth() && d === other.getDate();
	}

	let days: CalendarDay[] = $derived.by(() => {
		const firstDay = new Date(viewYear, viewMonth, 1);
		let startWeekday = firstDay.getDay() - 1;
		if (startWeekday < 0) startWeekday = 6;

		const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
		const daysInPrevMonth = new Date(viewYear, viewMonth, 0).getDate();

		const result: CalendarDay[] = [];

		for (let i = startWeekday - 1; i >= 0; i--) {
			const d = daysInPrevMonth - i;
			const m = viewMonth === 0 ? 11 : viewMonth - 1;
			const y = viewMonth === 0 ? viewYear - 1 : viewYear;
			result.push(buildDay(d, m, y, false));
		}

		for (let d = 1; d <= daysInMonth; d++) {
			result.push(buildDay(d, viewMonth, viewYear, true));
		}

		const remaining = 7 - (result.length % 7);
		if (remaining < 7) {
			for (let d = 1; d <= remaining; d++) {
				const m = viewMonth === 11 ? 0 : viewMonth + 1;
				const y = viewMonth === 11 ? viewYear + 1 : viewYear;
				result.push(buildDay(d, m, y, false));
			}
		}

		return result;
	});

	function buildDay(date: number, month: number, year: number, isCurrentMonth: boolean): CalendarDay {
		const d = new Date(year, month, date);
		let isDisabled = false;
		if (minDate) {
			const min = new Date(minDate.getFullYear(), minDate.getMonth(), minDate.getDate());
			if (d < min) isDisabled = true;
		}
		if (maxDate) {
			const max = new Date(maxDate.getFullYear(), maxDate.getMonth(), maxDate.getDate());
			if (d > max) isDisabled = true;
		}
		return {
			date,
			month,
			year,
			isCurrentMonth,
			isDisabled,
			isSelected: year === initialYear && month === initialMonth && date === initialDay,
			isToday: sameDay(year, month, date, today)
		};
	}

	function prevMonth() {
		if (viewMonth === 0) {
			viewMonth = 11;
			viewYear--;
		} else {
			viewMonth--;
		}
	}

	function nextMonth() {
		if (viewMonth === 11) {
			viewMonth = 0;
			viewYear++;
		} else {
			viewMonth++;
		}
	}

	function selectDay(day: CalendarDay) {
		if (day.isDisabled) return;
		onselect(new Date(day.year, day.month, day.date));
	}

	let backdropEl: HTMLDivElement | undefined = $state();

	function handleBackdropClick(e: MouseEvent) {
		if (e.target === backdropEl) onclose();
	}

	function handleKeydown(e: KeyboardEvent) {
		if (e.key === "Escape") onclose();
	}
</script>

<svelte:window onkeydown={handleKeydown} />

<!-- svelte-ignore a11y_click_events_have_key_events a11y_no_static_element_interactions -->
<div class="backdrop" role="presentation" bind:this={backdropEl} onclick={handleBackdropClick}>
	<div class="picker">
		<div class="header">
			<button type="button" class="nav-btn" onclick={prevMonth}>&larr;</button>
			<span class="month-label">{MONTH_NAMES[viewMonth]} {viewYear}</span>
			<button type="button" class="nav-btn" onclick={nextMonth}>&rarr;</button>
		</div>

		<div class="grid">
			{#each WEEKDAYS as wd}
				<span class="weekday">{wd}</span>
			{/each}

			{#each days as day}
				<button
					type="button"
					class="day"
					class:other-month={!day.isCurrentMonth}
					class:disabled={day.isDisabled}
					class:selected={day.isSelected}
					class:today={day.isToday}
					disabled={day.isDisabled}
					onclick={() => selectDay(day)}
				>
					{day.date}
				</button>
			{/each}
		</div>

		<button type="button" class="close-btn" onclick={onclose}>Cancel</button>
	</div>
</div>

<style>
	.backdrop {
		position: fixed;
		inset: 0;
		z-index: 100;
		background: rgba(0, 0, 0, 0.25);
		display: flex;
		align-items: center;
		justify-content: center;
	}

	.picker {
		background: #fff;
		border-radius: 12px;
		padding: 16px 20px;
		box-shadow: 0 8px 30px rgba(0, 0, 0, 0.15);
		display: flex;
		flex-direction: column;
		gap: 10px;
		width: 280px;
	}

	.header {
		display: flex;
		align-items: center;
		justify-content: space-between;
	}

	.month-label {
		font-size: 0.9rem;
		font-weight: 600;
		color: #111827;
	}

	.nav-btn {
		width: 32px;
		height: 32px;
		padding: 0;
		border: 1px solid #e5e7eb;
		border-radius: 8px;
		background: #fff;
		cursor: pointer;
		font-size: 0.9rem;
		display: flex;
		align-items: center;
		justify-content: center;
	}

	.nav-btn:hover {
		background: #f3f4f6;
	}

	.grid {
		display: grid;
		grid-template-columns: repeat(7, 1fr);
		gap: 2px;
		text-align: center;
	}

	.weekday {
		font-size: 0.7rem;
		font-weight: 600;
		color: #9ca3af;
		padding: 4px 0;
	}

	.day {
		aspect-ratio: 1;
		border: none;
		border-radius: 8px;
		background: transparent;
		font-size: 0.8rem;
		cursor: pointer;
		color: #111827;
		padding: 0;
		display: flex;
		align-items: center;
		justify-content: center;
	}

	.day:hover:not(.disabled) {
		background: #f3f4f6;
	}

	.day.other-month {
		color: #d1d5db;
	}

	.day.disabled {
		color: #e5e7eb;
		cursor: default;
	}

	.day.today {
		font-weight: 700;
		box-shadow: inset 0 0 0 1px #d1d5db;
	}

	.day.selected {
		background: #111827;
		color: #fff;
		font-weight: 600;
	}

	.day.selected:hover {
		background: #1f2937;
	}

	.close-btn {
		padding: 8px 12px;
		border: 1px solid #d1d5db;
		border-radius: 8px;
		background: #fff;
		cursor: pointer;
		font-size: 0.85rem;
	}

	.close-btn:hover {
		background: #f9fafb;
	}
</style>
